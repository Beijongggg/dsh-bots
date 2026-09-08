/**
 * 回归：邮件到达通知（v2）—— host 侧监视器的纯函数 scanMailState /
 * createMailMonitor / mailPreview。真实文件驱动（tmp 目录），不 mock 生产逻辑。
 *
 * 语义不变量（与设计文档一致）：
 *   - 每 (bot,dir) 首见即静默基线（host 重启存量不回放；bot 新建亦然）；
 *   - inbox：seq 增量 diff；kind="mail-response"（协议回信）静默；
 *     host 自身 POST /send 的写入按 ownSeq 抑制；文件重写（maxSeq 回退）静默重置；
 *   - outbox：按文件名（=ISO 时间戳变体，字典序==时间序）逐文件行数 diff；
 *     新文件全量事件、同文件追加仅新行、截断/删除静默；
 *   - bot 从注册表移除 → 状态清理（再建同 id 重新静默基线）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");
const { mailPreview, emptyMailState, scanMailState, createMailMonitor, createSseHub, startMailNotifyMonitor } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 夹具 ----------
const homes = [];
function mkHome(registry = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-mailnotify-"));
  fs.mkdirSync(path.join(home, "bots"), { recursive: true });
  if (Object.keys(registry).length > 0) {
    fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify(registry));
  }
  homes.push(home);
  return home;
}
const bot = (id, overrides = {}) => ({
  id, name: id, role: "coder", modelProvider: "", model: "",
  port: 3201, permission: "workspace-write", createdAt: new Date().toISOString(), ...overrides
});
const inboxFile = (home, id) => path.join(home, "bots", "inbox", id, "messages.jsonl");
const outboxDir = (home, id) => path.join(home, "bots", "outbox", id);
/** inbox 一行（含换行）：{seq, from, text, at[, kind]}。 */
const inboxLine = (seq, text, extra = {}) =>
  JSON.stringify({ seq, from: extra.from ?? "user", text, at: extra.at ?? "2026-08-23T01:00:00.000Z", ...extra }) + "\n";
/** outbox 文件内容：一行一个 {id, text, from:"bot", timestamp}。 */
const outboxBody = (id, texts, base = "2026-08-23T02:00:00.000Z") =>
  texts.map((text, i) => JSON.stringify({ id: `${id}-${i}`, text, from: "bot", timestamp: base })).join("\n") + "\n";

const scanOnce = (home, state, botIds, ownSeq) =>
  scanMailState({ dshHome: home, state, botIds, ownSeq });
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- mailPreview ----------
test("mailPreview：短文原样、长文截断加省略号、空白压缩、空值防御", () => {
  assert.equal(mailPreview("hi"), "hi");
  const long = "x".repeat(120);
  assert.equal(mailPreview(long), "x".repeat(80) + "…");
  assert.equal(mailPreview("  a\n\nb\tc  "), "a b c");
  assert.equal(mailPreview(null), "");
  assert.equal(mailPreview(undefined), "");
  assert.equal(mailPreview(123), "123");
});

// ---------- 首见基线 ----------
test("首见基线：存量 inbox + outbox 全静默，且状态被记录", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "old1") + inboxLine(2, "old2"));
  fs.mkdirSync(outboxDir(home, "a"), { recursive: true });
  fs.writeFileSync(path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl"),
    outboxBody("a", ["old reply"]));

  const first = scanOnce(home, emptyMailState(), ["a"]);
  assert.deepEqual(first.events, [], "存量邮件不应回放");
  assert.equal(first.state.inboxSeq.a, 2, "inbox 基线应记录最大 seq");
  assert.deepEqual(first.state.outbox.a, { "2026-08-23T02-00-00-000Z.jsonl": 1 }, "outbox 基线应记录行数");

  const second = scanOnce(home, first.state, ["a"]);
  assert.deepEqual(second.events, [], "无变化 → 无事件");
});

// ---------- inbox 增量 ----------
test("inbox 追加：新消息变事件（dir/from/text 预览/at/seq）", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "你好"));
  const state = scanOnce(home, emptyMailState(), ["a"]).state;

  fs.appendFileSync(inboxFile(home, "a"), inboxLine(2, "任务来了"));
  const { events } = scanOnce(home, state, ["a"]);
  assert.equal(events.length, 1);
  assert.equal(events[0].botId, "a");
  assert.equal(events[0].dir, "inbox");
  assert.equal(events[0].from, "user");
  assert.equal(events[0].text, "任务来了");
  assert.equal(events[0].seq, 2);
  assert.equal(events[0].at, "2026-08-23T01:00:00.000Z");

  const again = scanOnce(home, scanOnce(home, state, ["a"]).state, ["a"]);
  assert.deepEqual(again.events, [], "同一 seq 不重放");
});

test("inbox 协议回信（kind=mail-response）→ 静默", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "任务"));
  const state = scanOnce(home, emptyMailState(), ["a"]).state;

  fs.appendFileSync(inboxFile(home, "a"),
    inboxLine(2, "已处理", { from: "lead", kind: "mail-response", replyTo: 1 }));
  const { events } = scanOnce(home, state, ["a"]);
  assert.deepEqual(events, [], "自动回信是协议流量，不弹通知");
});

test("inbox host 自发 send（ownSends 精确 seq）：自身写入静默，后续 bot 邮件照常", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "早前"));
  const state = scanOnce(home, emptyMailState(), ["a"]).state;

  // 用户在 web UI 连发 2 条（seq 2,3），ownSends 记录 {2,3}
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(2, "你好") + inboxLine(3, "在吗"));
  const own = scanOnce(home, state, ["a"], new Map([["a", new Set([2, 3])]]));
  assert.deepEqual(own.events, [], "用户自发写入全部抑制");

  // 随后 bot→bot 任务邮件（seq 4）照常通知
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(4, "团队任务", { from: "lead" }));
  const later = scanOnce(home, own.state, ["a"], new Map([["a", new Set([2, 3])]]));
  assert.equal(later.events.length, 1);
  assert.equal(later.events[0].seq, 4);
  assert.equal(later.events[0].from, "lead");
});

test("F-4：同 tick 夹层外来邮件不被单值 max-seq 抑制误吞（ownSends 精确匹配）", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  // 基线 maxSeq=5
  fs.appendFileSync(inboxFile(home, "a"),
    inboxLine(1, "a") + inboxLine(2, "b") + inboxLine(3, "c") + inboxLine(4, "d") + inboxLine(5, "e"));
  const state = scanOnce(home, emptyMailState(), ["a"]).state;

  // 同一 1s tick 内：bot 来信 seq6 先落盘 → 用户自发送 seq7 后落盘（ownSends={7}）
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(6, "外来任务", { from: "lead" }));
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(7, "用户发送"));
  const { events } = scanOnce(home, state, ["a"], new Map([["a", new Set([7])]]));
  assert.equal(events.length, 1, "外来 seq6 不可被 max-seq 抑制吞掉");
  assert.equal(events[0].seq, 6);
  assert.equal(events[0].from, "lead");
});

test("inbox 文件重写（maxSeq 回退）→ 静默重置，之后新增恢复", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "x") + inboxLine(2, "y"));
  const state = scanOnce(home, emptyMailState(), ["a"]).state;

  fs.writeFileSync(inboxFile(home, "a"), inboxLine(1, "z")); // 重写：seq 回退
  const reset = scanOnce(home, state, ["a"]);
  assert.deepEqual(reset.events, [], "重写存量不回放");
  assert.equal(reset.state.inboxSeq.a, 1, "基线重置到新 maxSeq");

  fs.appendFileSync(inboxFile(home, "a"), inboxLine(2, "新消息"));
  const after = scanOnce(home, reset.state, ["a"]);
  assert.equal(after.events.length, 1);
  assert.equal(after.events[0].seq, 2);
});

// ---------- outbox 增量 ----------
test("outbox 新文件 → 全量事件；同文件追加 → 仅新行", () => {
  const home = mkHome({ a: bot("a") });
  // 无 outbox 目录：首见空基线
  const state = scanOnce(home, emptyMailState(), ["a"]).state;
  assert.deepEqual(state.outbox.a, {}, "首见空目录记空基线");

  fs.mkdirSync(outboxDir(home, "a"), { recursive: true });
  fs.writeFileSync(path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl"),
    outboxBody("a", ["第一条回复", "第二条回复"]));
  const first = scanOnce(home, state, ["a"]);
  assert.equal(first.events.length, 2, "新文件全部行都是事件");
  assert.equal(first.events[0].dir, "outbox");
  assert.equal(first.events[0].text, "第一条回复");
  assert.equal(first.events[1].text, "第二条回复");

  fs.appendFileSync(path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl"),
    outboxBody("a", ["第三条回复"]).split("\n")[0] + "\n");
  const second = scanOnce(home, first.state, ["a"]);
  assert.equal(second.events.length, 1, "追加仅新行");
  assert.equal(second.events[0].text, "第三条回复");
  assert.equal(second.state.outbox.a["2026-08-23T02-00-00-000Z.jsonl"], 3);
});

test("outbox 多文件按文件名序出事件（文件名=时间戳变体）", () => {
  const home = mkHome({ a: bot("a") });
  const state = scanOnce(home, emptyMailState(), ["a"]).state;
  fs.mkdirSync(outboxDir(home, "a"), { recursive: true });
  fs.writeFileSync(path.join(outboxDir(home, "a"), "2026-08-23T03-00-00-000Z.jsonl"), outboxBody("a", ["后"]));
  fs.writeFileSync(path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl"), outboxBody("a", ["前"]));
  const { events } = scanOnce(home, state, ["a"]);
  assert.deepEqual(events.map((e) => e.text), ["前", "后"], "应按时间序输出");
});

test("outbox 文件截断 → 静默重置；删除 → 基线清除", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(outboxDir(home, "a"), { recursive: true });
  fs.writeFileSync(path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl"), outboxBody("a", ["a", "b"]));
  const state = scanOnce(home, emptyMailState(), ["a"]).state;

  fs.writeFileSync(path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl"), outboxBody("a", ["a"]));
  const trunc = scanOnce(home, state, ["a"]);
  assert.deepEqual(trunc.events, [], "截断不回放");
  assert.equal(trunc.state.outbox.a["2026-08-23T02-00-00-000Z.jsonl"], 1, "截断基线重置");

  fs.appendFileSync(path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl"),
    outboxBody("a", ["恢复"]).split("\n")[0] + "\n");
  const restored = scanOnce(home, trunc.state, ["a"]);
  assert.equal(restored.events.length, 1, "截断后新增恢复通知");
  assert.equal(restored.events[0].text, "恢复");

  fs.rmSync(outboxDir(home, "a"), { recursive: true, force: true });
  const gone = scanOnce(home, restored.state, ["a"]);
  assert.deepEqual(gone.events, [], "目录删除无事件");
  assert.equal(gone.state.outbox.a, undefined, "目录消失基线清除");
});

// ---------- bot 生命周期 ----------
test("bot 从注册表移除 → 状态清理；同 id 重建 → 重新静默基线", () => {
  const home = mkHome({ a: bot("a"), b: bot("b") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "a 的存量"));
  fs.mkdirSync(outboxDir(home, "b"), { recursive: true });
  fs.writeFileSync(path.join(outboxDir(home, "b"), "2026-08-23T02-00-00-000Z.jsonl"), outboxBody("b", ["b 的存量"]));
  const state = scanOnce(home, emptyMailState(), ["a", "b"]).state;
  assert.ok(state.inboxSeq.a !== undefined && state.outbox.b !== undefined);

  // a、b 都从注册表消失，同时出现新 bot c（c 的存量邮件在同一次扫描前已落盘）
  fs.mkdirSync(path.dirname(inboxFile(home, "c")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "c"), inboxLine(1, "c 的存量"));
  const pruned = scanOnce(home, state, ["c"]);
  assert.equal(pruned.state.inboxSeq.a, undefined, "已移除 bot 的 inbox 状态应清理");
  assert.equal(pruned.state.outbox.b, undefined, "已移除 bot 的 outbox 状态应清理");
  assert.deepEqual(pruned.events, [], "新 bot 首见（含存量）→ 静默基线");

  fs.appendFileSync(inboxFile(home, "c"), inboxLine(2, "c 的新邮件"));
  const later = scanOnce(home, pruned.state, ["c"]);
  assert.equal(later.events.length, 1);
  assert.equal(later.events[0].seq, 2);
});

// ---------- createMailMonitor 状态机 ----------
test("createMailMonitor：poll 一次建立基线，两次见增量；ownSends Set 生效", () => {
  const home = mkHome({ a: bot("a") });
  const ownSends = new Map([["a", new Set()]]);
  const monitor = createMailMonitor({ dshHome: home, readRegistry: () => ({ a: bot("a") }), ownSends });
  assert.deepEqual(monitor.poll().events, [], "首 poll 静默基线");

  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "用户发送", { from: "user" }));
  ownSends.get("a").add(1);
  assert.deepEqual(monitor.poll().events, [], "ownSends 含 seq=1 抑制 seq=1");

  fs.appendFileSync(inboxFile(home, "a"), inboxLine(2, "bot 邮件", { from: "lead" }));
  const events = monitor.poll().events;
  assert.equal(events.length, 1);
  assert.equal(events[0].seq, 2);
  assert.deepEqual(monitor.poll().events, [], "无变化 → 无事件");
  assert.deepEqual(monitor.poll().readErrors, [], "正常扫描无读错误诊断");
});

test("scanMailState：ownSeq 缺省（undefined）→ 不抑制", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "x"));
  const state = scanOnce(home, emptyMailState(), ["a"]).state;
  fs.appendFileSync(inboxFile(home, "a"), inboxLine(2, "y"));
  const { events } = scanOnce(home, state, ["a"]);
  assert.equal(events.length, 1, "无 ownSeq 时所有新消息都通知");
});

// ---------- F-2 / F-3：瞬态读失败（chmod 000 模拟）不得重置基线导致恢复后重放 ----------
test("F-2：inbox 瞬态读失败保持基线，恢复后只报新增不重放（附 readErrors 诊断）", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.writeFileSync(inboxFile(home, "a"), inboxLine(1, "x") + inboxLine(2, "y"));
  let state = scanOnce(home, emptyMailState(), ["a"]).state;
  try {
    fs.chmodSync(inboxFile(home, "a"), 0o000);
    const bad = scanOnce(home, state, ["a"]);
    assert.deepEqual(bad.events, [], "读失败拍不回放");
    assert.equal(bad.state.inboxSeq.a, 2, "读失败不得把基线重置为 0");
    assert.ok(bad.readErrors.length >= 1 && bad.readErrors[0].includes("inbox/a"), "读错误应进诊断");
    state = bad.state;

    fs.chmodSync(inboxFile(home, "a"), 0o644);
    fs.appendFileSync(inboxFile(home, "a"), inboxLine(3, "z"));
    const after = scanOnce(home, state, ["a"]);
    assert.deepEqual(after.events.map((e) => e.seq), [3], "恢复后只报新增 seq3，不重放存量");
  } finally {
    fs.chmodSync(inboxFile(home, "a"), 0o644);
  }
});

test("F-2 变体：inbox 首见即读失败 → 保持未首见，恢复后静默基线（存量不回放）", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
  fs.writeFileSync(inboxFile(home, "a"), inboxLine(1, "x") + inboxLine(2, "y"));
  try {
    fs.chmodSync(inboxFile(home, "a"), 0o000);
    const first = scanOnce(home, emptyMailState(), ["a"]);
    assert.deepEqual(first.events, [], "首见+读失败静默");
    assert.equal(first.state.inboxSeq.a, undefined, "首见+读失败保持未首见（下拍重新首见）");
    assert.ok(first.readErrors.length >= 1, "读错误应进诊断");

    fs.chmodSync(inboxFile(home, "a"), 0o644);
    const second = scanOnce(home, first.state, ["a"]);
    assert.deepEqual(second.events, [], "恢复后首次成功扫描＝静默基线，存量不回放");
    fs.appendFileSync(inboxFile(home, "a"), inboxLine(3, "z"));
    const later = scanOnce(home, second.state, ["a"]);
    assert.deepEqual(later.events.map((e) => e.seq), [3]);
  } finally {
    fs.chmodSync(inboxFile(home, "a"), 0o644);
  }
});

test("F-3：outbox 单文件瞬态读失败保持计数，恢复后不重放（附 readErrors 诊断）", () => {
  const home = mkHome({ a: bot("a") });
  fs.mkdirSync(outboxDir(home, "a"), { recursive: true });
  const file = path.join(outboxDir(home, "a"), "2026-08-23T02-00-00-000Z.jsonl");
  fs.writeFileSync(file, outboxBody("a", ["r1", "r2"]));
  let state = scanOnce(home, emptyMailState(), ["a"]).state;
  try {
    fs.chmodSync(file, 0o000);
    const bad = scanOnce(home, state, ["a"]);
    assert.deepEqual(bad.events, [], "读失败拍无事件");
    assert.equal(bad.state.outbox.a["2026-08-23T02-00-00-000Z.jsonl"], 2, "读失败不得丢失该文件基线");
    assert.ok(bad.readErrors.some((e) => e.includes("2026-08-23T02-00-00-000Z.jsonl")), "单文件读错应进诊断");
    state = bad.state;

    fs.chmodSync(file, 0o644);
    const restored = scanOnce(home, state, ["a"]);
    assert.deepEqual(restored.events, [], "恢复后无新增不重放");

    fs.appendFileSync(file, outboxBody("a", ["r3"]).split("\n")[0] + "\n");
    const appended = scanOnce(home, restored.state, ["a"]);
    assert.deepEqual(appended.events.map((e) => e.text), ["r3"], "恢复后追加仅新行");
  } finally {
    fs.chmodSync(file, 0o644);
  }
});

// ---------- startMailNotifyMonitor 端到端（真实 1s tick + 真实 hub） ----------
test("startMailNotifyMonitor：新邮件经 tick 广播 mail 帧，dispose 后停止", async () => {
  const home = mkHome({ a: bot("a") });
  const hub = createSseHub();
  const rec = { chunks: [], write(t) { this.chunks.push(t); return true; }, end() {} };
  hub.subscribe(rec);
  const api = {
    dshHome: home,
    readRegistry: () => ({ a: bot("a") }),
    ownSends: new Map(),
    sseHub: hub
  };
  const ctx = { logger: { info() {}, warn() {}, error() {} } };
  const dispose = startMailNotifyMonitor(ctx, api);
  try {
    assert.equal(rec.chunks.filter((c) => c.includes("event: mail")).length, 0, "启动基线不广播");

    fs.mkdirSync(path.dirname(inboxFile(home, "a")), { recursive: true });
    fs.appendFileSync(inboxFile(home, "a"), inboxLine(1, "新回复"));
    await settle(1600);
    const mailFrames = rec.chunks.filter((c) => c.includes("event: mail"));
    assert.equal(mailFrames.length, 1, "一个 tick 内应广播恰一次 mail 帧");
    assert.ok(mailFrames[0].includes('"botId":"a"'), "帧载荷应含 botId");
    assert.ok(mailFrames[0].includes('"dir":"inbox"'), "帧载荷应含方向");
    assert.ok(mailFrames[0].includes("新回复"), "帧载荷应含正文预览（可被截断）");

    const before = rec.chunks.length;
    fs.appendFileSync(inboxFile(home, "a"), inboxLine(2, "又来"));
    await settle(1300);
    assert.ok(rec.chunks.length > before, "dispose 前仍应持续广播");

    dispose();
    const stopped = rec.chunks.length;
    fs.appendFileSync(inboxFile(home, "a"), inboxLine(3, "不再广播"));
    await settle(1500);
    assert.equal(rec.chunks.length, stopped, "dispose 后不应再有广播");
  } finally {
    dispose();
  }
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
