/**
 * 邮件中继命令面回归（org-v2 11 号票；规格 §E、§I.6 与附录 A
 * `V-A4.4`／`V-A2.13`／`V-A4.7`）。
 *
 * 只测外部行为：host 侧中继面（`createMailRelay`）的投递／消费汇报／游标结论，
 * 与 HTTP 面的认证与 fail closed 语义；不触真实 `~/.dsh`（夹具临时目录）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import {
  createMailHttpApi, createMailRelay, createMailRejectionRecorder, MAIL_INBOX_KEYS
} from "../lib/org/mail-relay.js";
import {
  inboxDirFor, messagesPathFor, readAllInboxLines, readMaxReceiptSeq, readOutbox, readReceipts, responseState,
  writeReceipt
} from "../lib/mail-plane.js";

const HOMES = [];
function mkHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-mail-relay-fixture-"));
  HOMES.push(home);
  return home;
}
process.on("exit", () => {
  for (const home of HOMES) rmSync(home, { recursive: true, force: true });
});

const REGISTRY = {
  a: { id: "a", name: "发信者" },
  b: { id: "b", name: "收信者" },
  c: { id: "c", name: "第三席" }
};

/** 每测一件独立 home：消费水位／游标是每实例状态，测试间不共享。 */
function relay() {
  const home = mkHome();
  return { home, relay: createMailRelay({ dshHome: home, readRegistry: () => REGISTRY }) };
}

test("mail.send：host 唯一写者——投递落收件人 inbox，消息键封闭且不承载任务状态（V-A4.4／V-A2.13）", () => {
  const { home, relay: r } = relay();
  const receipt = r.send({ from: "a", to: "b", text: "请处理任务 X", taskId: "T-1" });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.to, "b");
  assert.equal(receipt.seq, 1);
  const lines = readAllInboxLines(home, "b");
  assert.equal(lines.length, 1, "投递恰落一条");
  assert.equal(lines[0].from, "a");
  assert.equal(lines[0].text, "请处理任务 X");
  assert.equal(lines[0].taskId, "T-1", "关联键＝taskId");
  assert.equal(lines[0].seq, 1);
  for (const key of Object.keys(lines[0])) {
    assert.ok(MAIL_INBOX_KEYS.includes(key), `消息键须在封闭枚举内（V-A2.13）：${key}`);
  }
  assert.equal("kind" in lines[0], false, "kind 枚举已废止（11 号票形态改造）");
});

test("消费汇报 host 落盘：claim → finalize＋receipt 水位；skipped-stale 只记水位；参数非法 fail closed（at-least-once）", () => {
  const { home, relay: r } = relay();
  const sent = r.send({ from: "a", to: "b", text: "任务", taskId: "T-1" });

  const claimed = r.consume({ botId: "b", messageId: sent.messageId, seq: sent.seq, phase: "claim" });
  assert.equal(claimed.ok, true);
  assert.equal(responseState(home, "b", sent.messageId).state, "claimed", "认领标记先于回合落盘");

  const done = r.consume({ botId: "b", messageId: sent.messageId, seq: sent.seq, phase: "finalize", outcome: "replied" });
  assert.equal(done.ok, true);
  assert.deepEqual(responseState(home, "b", sent.messageId), { state: "finalized", outcome: "replied" });
  assert.equal(readMaxReceiptSeq(home, "b"), sent.seq, "消费水位＝已消费 seq");

  // 积压跳过（v1 静默丢失的可观测化路径）：只记水位，不触发回合
  const stale = r.send({ from: "a", to: "b", text: "积压件" });
  assert.equal(r.consume({ botId: "b", messageId: stale.messageId, seq: stale.seq, outcome: "skipped-stale" }).ok, true);
  assert.equal(readMaxReceiptSeq(home, "b"), stale.seq);
  assert.ok(readReceipts(home, "b").some((record) => record.outcome === "skipped-stale"));

  // fail closed：参数非法／实例不在册／凭据不在该实例 inbox 内 一律拒且不落盘
  const bad = r.consume({ botId: "b", messageId: "", seq: 0, phase: "claim" });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "mail-consume-args");
  assert.equal(r.consume({ botId: "ghost", messageId: "m", seq: 1, phase: "claim" }).code, "mail-bot-unknown");
  const forged = r.consume({ botId: "b", messageId: "in-b-99", seq: 99, outcome: "skipped-stale" });
  assert.equal(forged.code, "mail-consume-unknown-message",
    "伪造 receipt 不改事实（邮件零权威线，V-A3.7）");
  assert.equal(readMaxReceiptSeq(home, "b"), stale.seq, "拒绝不推进水位");
});

test("cursor：host 侧算起始游标——存量无 water mark 即落基线不回放；水位落后 → replay", () => {
  const { relay: r } = relay();
  assert.equal(r.send({ from: "a", to: "c", text: "一" }).seq, 1);
  assert.equal(r.send({ from: "a", to: "c", text: "二" }).seq, 2);

  const first = r.cursor({ botId: "c" });
  assert.equal(first.ok, true);
  assert.deepEqual({ lastSeq: first.lastSeq, replay: first.replay, baseline: first.baseline },
    { lastSeq: 2, replay: false, baseline: 2 }, "旧数据迁移：写基线、存量不回放");

  // 停机期间到达新邮件（seq=3 无 receipt）→ 水位 2 落后文件最大 3 → 回放
  const third = r.send({ from: "a", to: "c", text: "三" });
  assert.equal(third.seq, 3);
  const after = r.cursor({ botId: "c" });
  assert.deepEqual({ lastSeq: after.lastSeq, replay: after.replay }, { lastSeq: 2, replay: true });

  // 消费汇报后水位追平 → 不再回放
  assert.equal(r.consume({ botId: "c", messageId: third.messageId, seq: third.seq, outcome: "processed" }).ok, true);
  assert.deepEqual({ lastSeq: r.cursor({ botId: "c" }).lastSeq, replay: r.cursor({ botId: "c" }).replay },
    { lastSeq: 3, replay: false });
  assert.equal(r.cursor({ botId: "ghost" }).code, "mail-bot-unknown");
});

test("幂等回复与投递去重：同 replyToMessageId／同 replyTo／同 idempotencyKey 重放不落第二条", () => {
  const { home, relay: r } = relay();

  // outbox（bot→user 回复）：同 replyToMessageId 重放 → 返回既有行
  const first = r.send({ from: "b", to: "user", text: "回复一", replyToMessageId: "m-1", taskId: "T-1" });
  const again = r.send({ from: "b", to: "user", text: "崩溃重放不应产生的第二条", replyToMessageId: "m-1" });
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  assert.equal(again.messageId, first.messageId);
  assert.deepEqual(readOutbox(home, "b").map((msg) => msg.text), ["回复一"]);
  assert.equal(readOutbox(home, "b")[0].taskId, "T-1", "outbox 行同样带关联键");

  // inbox 自动回信：同 replyTo 重放 → 返回既有行（回路由去重，防崩溃重发）
  const reply = r.send({ from: "b", to: "a", text: "答复", replyTo: 7 });
  const replyAgain = r.send({ from: "b", to: "a", text: "重复答复", replyTo: 7 });
  assert.equal(replyAgain.replayed, true);
  assert.equal(replyAgain.messageId, reply.messageId);
  assert.equal(readAllInboxLines(home, "a").length, 1);

  // 通道重试：同 idempotencyKey 重放 → 不落第二条（投递幂等锚）
  const tool = r.send({ from: "a", to: "b", text: "咨询", idempotencyKey: "k-1" });
  const retry = r.send({ from: "a", to: "b", text: "咨询", idempotencyKey: "k-1" });
  assert.equal(retry.replayed, true);
  assert.equal(retry.messageId, tool.messageId);
  assert.equal(readAllInboxLines(home, "b").length, 1);
});

test("回信锚按发信人分域：B、C 同序号各自投递，重启后各自重放仍去重", () => {
  const { home, relay: r } = relay();
  const b = r.send({ from: "b", to: "a", text: "B 的回信", replyTo: 1 });
  const c = r.send({ from: "c", to: "a", text: "C 的回信", replyTo: 1 });
  assert.equal(b.ok, true);
  assert.equal(c.ok, true);
  assert.equal(b.replayed, undefined);
  assert.equal(c.replayed, undefined, "B 预先写入同锚不能压制 C 的回信");
  assert.deepEqual([b.seq, c.seq], [1, 2]);
  assert.notEqual(b.messageId, c.messageId);

  const restarted = createMailRelay({ dshHome: home, readRegistry: () => REGISTRY });
  for (const [from, first] of [["b", b], ["c", c]]) {
    const replay = restarted.send({ from, to: "a", text: "崩溃后的回信重放", replyTo: 1 });
    assert.deepEqual(replay, { ...first, replayed: true });
  }
  assert.deepEqual(readAllInboxLines(home, "a").map(({ from, text, replyTo }) => ({ from, text, replyTo })), [
    { from: "b", text: "B 的回信", replyTo: 1 },
    { from: "c", text: "C 的回信", replyTo: 1 }
  ]);
});

test("投递幂等键按发信人分域：B、C 同键各自投递，同发信人重放只返回自己的消息", () => {
  const { home, relay: r } = relay();
  const b = r.send({ from: "b", to: "a", text: "B 的咨询", idempotencyKey: "k1" });
  const c = r.send({ from: "c", to: "a", text: "C 的咨询", idempotencyKey: "k1" });
  assert.equal(b.ok, true);
  assert.equal(c.ok, true);
  assert.equal(b.replayed, undefined);
  assert.equal(c.replayed, undefined, "C 的同名幂等键不能命中 B 的投递");
  assert.deepEqual([b.seq, c.seq], [1, 2]);
  assert.notEqual(b.messageId, c.messageId);

  const restarted = createMailRelay({ dshHome: home, readRegistry: () => REGISTRY });
  for (const [from, first] of [["b", b], ["c", c]]) {
    const replay = restarted.send({ from, to: "a", text: "通道重试", idempotencyKey: "k1" });
    assert.deepEqual(replay, { ...first, replayed: true });
  }
  assert.deepEqual(readAllInboxLines(home, "a").map(({ from, text }) => ({ from, text })), [
    { from: "b", text: "B 的咨询" },
    { from: "c", text: "C 的咨询" }
  ]);
});

test("历史裸锚读取已有 from 分域，缺发信人的行不去重，旧行字节不变", () => {
  const { home, relay: r } = relay();
  const legacyRows = [
    { id: "old-reply", seq: 1, from: "b", text: "旧回信", kind: "mail-response", replyTo: 7 },
    { id: "old-key", seq: 2, from: "b", text: "旧投递", idempotencyKey: "old-k" },
    { id: "unknown-sender", seq: 3, text: "无发信人旧行", replyTo: 8, idempotencyKey: "unknown-k" }
  ];
  const legacyBytes = legacyRows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  mkdirSync(inboxDirFor(home, "a"), { recursive: true });
  writeFileSync(messagesPathFor(home, "a"), legacyBytes);

  assert.deepEqual(r.send({ from: "b", to: "a", text: "旧回信重放", replyTo: 7 }),
    { ok: true, to: "a", messageId: "old-reply", seq: 1, replayed: true });
  assert.deepEqual(r.send({ from: "b", to: "a", text: "旧投递重放", idempotencyKey: "old-k" }),
    { ok: true, to: "a", messageId: "old-key", seq: 2, replayed: true });

  const cReply = r.send({ from: "c", to: "a", text: "C 的新回信", replyTo: 7 });
  const cKey = r.send({ from: "c", to: "a", text: "C 的新投递", idempotencyKey: "old-k" });
  const unknownReply = r.send({ from: "b", to: "a", text: "有发信人的回信", replyTo: 8 });
  const unknownKey = r.send({ from: "b", to: "a", text: "有发信人的投递", idempotencyKey: "unknown-k" });
  for (const result of [cReply, cKey, unknownReply, unknownKey]) {
    assert.equal(result.ok, true);
    assert.equal(result.replayed, undefined, "旧锚仅能去重同发信人的消息");
  }
  assert.deepEqual([cReply.seq, cKey.seq, unknownReply.seq, unknownKey.seq], [4, 5, 6, 7]);
  assert.deepEqual(readAllInboxLines(home, "a").slice(0, 3), legacyRows);
  assert.equal(readFileSync(messagesPathFor(home, "a"), "utf8").slice(0, legacyBytes.length), legacyBytes,
    "升级只读旧行，不迁移、不改写");
});

test("HTTP 投递按 actor 注入的发信人分域，自带回信锚与幂等键均保留", async () => {
  const { home, relay: r } = relay();
  const api = { mailRelay: r };
  for (const from of ["b", "c"]) {
    const body = { actor: { kind: "post", id: from }, to: "a", text: `${from} 的回信`, replyTo: 1, idempotencyKey: "k1" };
    const first = await callMailApi(api, "POST", "/api/bots/_mail/send", { body });
    assert.equal(first.status, 200);
    assert.equal(first.body.ok, true);
    assert.equal(first.body.replayed, undefined);
    const replay = await callMailApi(api, "POST", "/api/bots/_mail/send", { body });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body, { ...first.body, replayed: true });
  }
  assert.deepEqual(readAllInboxLines(home, "a").map(({ from, replyTo, idempotencyKey }) => ({ from, replyTo, idempotencyKey })), [
    { from: "b", replyTo: 1, idempotencyKey: "k1" },
    { from: "c", replyTo: 1, idempotencyKey: "k1" }
  ]);
});

test("语义失败各按其道（V-A4.7 分支三）：未知收件人／自发／空正文／夹带键／发信者不在册一律拒且零写入", () => {
  const { home, relay: r } = relay();
  assert.equal(r.send({ from: "a", to: "nobody", text: "x" }).code, "mail-unknown-recipient");
  assert.equal(r.send({ from: "a", to: "a", text: "x" }).code, "mail-self-send");
  assert.equal(r.send({ from: "a", to: "b", text: "   " }).code, "mail-empty-text");
  assert.equal(r.send({ from: "a", to: "b", text: "x", status: "delivered" }).code, "mail-unknown-key",
    "邮件内容不承载任务状态：夹带状态类键即拒（V-A2.13）");
  assert.equal(r.send({ from: "ghost", to: "b", text: "x" }).code, "mail-sender-unknown");
  assert.equal(r.send({ from: "a", to: "b", text: "x", taskId: "" }).code, "mail-invalid-task-id");
  assert.equal(r.send({ from: "a", to: "b" }).code, "mail-empty-text");
  assert.equal(readAllInboxLines(home, "b").length, 0, "拒绝零写入（fail closed）");
  assert.deepEqual(readOutbox(home, "a"), [], "outbox 同样零写入");

  // 名字解析：唯一命中可投递（v1 consult 语义）；空 to＝只查名单不投递
  assert.equal(r.send({ from: "a", to: "收信者", text: "按名字投递" }).ok, true);
  assert.equal(readAllInboxLines(home, "b").length, 1);
  const roster = r.send({ from: "a", to: "", text: "" });
  assert.equal(roster.ok, true);
  assert.equal(roster.delivered, false);
  assert.deepEqual(roster.roster.map((line) => line.split("（")[0]), ["b", "c"], "名单排除自己");
  assert.equal(readAllInboxLines(home, "b").length, 1, "查名单不投递");
});

test("鉴权拒绝留痕（V-A4.7 分支二）：回执＋有任务锚时落 command-rejected，无锚时只留日志", async () => {
  const { relay: r } = relay();
  const seen = [];
  const recordRejection = (rejection) => { seen.push(rejection); };
  const api = { mailRelay: r };

  // 有锚：负载自带 taskId → 留痕件可落事件（此处由注入钩子接管，验证调用形状）
  const spoof = await callMailApi(api, "POST", "/api/bots/_mail/send", {
    body: { actor: { kind: "post", id: "a" }, from: "b", to: "b", text: "夹带身份", taskId: "T-9" },
    hooks: { recordRejection }
  });
  assert.equal(spoof.status, 409);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], {
    taskId: "T-9", actor: { kind: "post", id: "a" }, op: "mail.send",
    code: "mail-actor-spoof", reason: "发信者／汇报者身份由通道认证注入，负载不得自带 from／botId"
  }, "留痕负载＝{taskId, actor, op, code, reason}（actor 取认证名，不取负载）");

  // host 冒名同样留痕（403）；语义失败不留痕（走分支三）
  await callMailApi(api, "POST", "/api/bots/_mail/send", {
    body: { actor: { kind: "host", id: "host" }, to: "b", text: "x", taskId: "T-9" },
    hooks: { recordRejection }
  });
  await callMailApi(api, "POST", "/api/bots/_mail/send", {
    body: { actor: { kind: "post", id: "a" }, to: "nobody", text: "x", taskId: "T-9" },
    hooks: { recordRejection }
  });
  assert.equal(seen.length, 2, "语义失败（未知收件人）不进鉴权留痕");
  assert.equal(seen[1].code, "host-channel-forbidden");

  // 留痕件本体：台账认账**且 actor 在任务承担链上**的 taskId 才落事件；无锚／
  // 无台账／actor 与任务无关联＝只留日志（自报 taskId 不得向任意在册任务植入
  // 拒绝事件——身份认证失败时 actor 不可信，锚点须与台账事实自洽）
  const events = [];
  const ledger = {
    task: (taskId) => (taskId === "T-9" ? { taskId, owner: "a", dispatcher: "d" } : null),
    reject: (taskId, actor, key, op, code, reason) => events.push({ taskId, actor, op, code, reason })
  };
  const recorder = createMailRejectionRecorder({ logger: { warn() {} } });
  assert.equal(recorder({ taskId: "T-9", actor: { kind: "post", id: "a" }, code: "mail-actor-spoof", reason: "夹带" },
    { ledgerHost: { ledger } }), true, "锚＝台账认账且 actor 是任务 owner");
  assert.equal(recorder({ taskId: "T-9", actor: { kind: "post", id: "d" }, code: "mail-actor-spoof", reason: "夹带" },
    { ledgerHost: { ledger } }), true, "dispatcher 同在承担链上");
  assert.deepEqual(events, [
    { taskId: "T-9", actor: { kind: "post", id: "a" }, op: "mail.send", code: "mail-actor-spoof", reason: "夹带" },
    { taskId: "T-9", actor: { kind: "post", id: "d" }, op: "mail.send", code: "mail-actor-spoof", reason: "夹带" }
  ]);
  assert.equal(recorder({ taskId: "T-9", actor: { kind: "post", id: "bystander" }, code: "mail-actor-spoof" },
    { ledgerHost: { ledger } }), false, "actor 与任务无关联（非 owner/dispatcher）：只留日志");
  assert.equal(recorder({ taskId: "unknown-task", actor: { kind: "post", id: "a" }, code: "mail-actor-spoof" },
    { ledgerHost: { ledger } }), false, "台账无此任务：不落事件（凭空造事实即违零权威线）");
  assert.equal(recorder({ actor: { kind: "post", id: "a" }, code: "mail-actor-forbidden" },
    { ledgerHost: { ledger } }), false, "无锚：只留日志");
  assert.equal(recorder({ taskId: "T-9", actor: { kind: "post", id: "a" }, code: "x" }, {}), false, "未接线台账：不落事件");
});

// ---------- HTTP 面（bot→host 认证命令通道；零 capability 门槛） ----------

const json = (res, status, value) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let raw = "";
  req.on("data", (chunk) => { raw += chunk; });
  req.on("end", () => {
    if (raw === "") return resolve(null);
    try { resolve(JSON.parse(raw)); } catch (error) { reject(error); }
  });
});
const routeSegments = (req) => new URL(req.url, "http://dsh.local").pathname
  .split("/").filter(Boolean).map((seg) => decodeURIComponent(seg));

function makeReq(method, url, { headers = {}, body = null } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { ...headers };
  process.nextTick(() => {
    if (body !== null) req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  });
  return req;
}

async function callMailApi(api, method, url, { headers = {}, body = null, hooks = {} } = {}) {
  const res = {
    status: null, payload: null,
    writeHead(status) { this.status = status; },
    end(text) { this.payload = text === undefined ? null : JSON.parse(text); }
  };
  await createMailHttpApi({ json, readBody, routeSegments, ...hooks })(makeReq(method, url, { headers, body }), res, api);
  return { status: res.status, body: res.payload };
}

test("HTTP cursor（35 号票）：POST actor 认证落基线，GET 下线 405 且零写", async () => {
  const { home, relay: r } = relay();
  const api = { mailRelay: r };
  assert.equal(r.send({ from: "a", to: "b", text: "存量一" }).seq, 1);
  assert.equal(r.send({ from: "a", to: "b", text: "存量二" }).seq, 2);

  // 读面 GET 下线：405 且不触发任何写（迁移条件满足时也不落基线）
  const get = await callMailApi(api, "GET", "/api/bots/_mail/cursor", { headers: { "x-dsh-bots-bot-id": "b" } });
  assert.equal(get.status, 405, "GET cursor 下线（读面零写）");
  assert.equal(readMaxReceiptSeq(home, "b"), 0, "匿名 GET 不得推进水位／落基线");

  // 写面 POST：认证 actor 方可触发迁移基线
  const post = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "post", id: "b" } } });
  assert.equal(post.status, 200);
  assert.equal(post.body.ok, true);
  assert.deepEqual({ lastSeq: post.body.lastSeq, replay: post.body.replay, baseline: post.body.baseline },
    { lastSeq: 2, replay: false, baseline: 2 }, "认证 POST 触发旧数据迁移：写基线、存量不回放");
  assert.equal(readMaxReceiptSeq(home, "b"), 2);
});

test("HTTP cursor 条件触发三路径（35 号票）：prune 只经认证 POST／迁移写一次／二次纯读不覆写", async () => {
  const { home, relay: r } = relay();
  const api = { mailRelay: r };

  // 路径一 prune 超限：505 件 receipts（mtime 递增保证淘汰最旧），水位 505
  for (let i = 1; i <= 505; i += 1) {
    writeReceipt(home, "b", { messageId: `m-${i}`, seq: i });
    const file = join(inboxDirFor(home, "b"), "receipts", `m-${i}.json`);
    const stamp = new Date(Date.now() + i * 10);
    utimesSync(file, stamp, stamp);
  }
  assert.equal(readReceipts(home, "b").length, 505);

  // 匿名 GET：405 且不触发 prune（写副作用不可经读面触发）
  const get = await callMailApi(api, "GET", "/api/bots/_mail/cursor", { headers: { "x-dsh-bots-bot-id": "b" } });
  assert.equal(get.status, 405);
  assert.equal(readReceipts(home, "b").length, 505, "GET 不得触发 prune");

  // 认证 POST：prune 至 500，水位 505 只增不减
  const pruned = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "post", id: "b" } } });
  assert.equal(pruned.status, 200);
  assert.deepEqual({ lastSeq: pruned.body.lastSeq, replay: pruned.body.replay }, { lastSeq: 505, replay: false });
  assert.equal(readReceipts(home, "b").length, 500, "认证 POST 触发 prune（保留 500）");
  assert.equal(readMaxReceiptSeq(home, "b"), 505, "水位只增不减");

  // 路径二 零水位迁移：bot c 有存量无水位 → 认证 POST 写一次基线
  assert.equal(r.send({ from: "a", to: "c", text: "旧一" }).seq, 1);
  const migrate = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "post", id: "c" } } });
  assert.deepEqual({ lastSeq: migrate.body.lastSeq, replay: migrate.body.replay, baseline: migrate.body.baseline },
    { lastSeq: 1, replay: false, baseline: 1 });

  // 路径三 纯读：二次 POST 不覆写（无 baseline 键，水位保持迁移基线）
  const reread = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "post", id: "c" } } });
  assert.equal(reread.status, 200);
  assert.equal(reread.body.baseline, undefined, "二次读取不再写基线（纯读）");
  assert.deepEqual({ lastSeq: reread.body.lastSeq, replay: reread.body.replay }, { lastSeq: 1, replay: false });
  assert.equal(readMaxReceiptSeq(home, "c"), 1, "存量基线认／继续有效，不重建");
});

test("HTTP 面：actor 认证（注册实例＋kind=post）——未在册／host 冒名／负载夹带 from 一律拒且零写入", async () => {
  const { home, relay: r } = relay();
  const api = { mailRelay: r };

  const ok = await callMailApi(api, "POST", "/api/bots/_mail/send",
    { body: { actor: { kind: "post", id: "a" }, to: "b", text: "投递" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  assert.equal(readAllInboxLines(home, "b").length, 1);

  const ghostSeen = [];
  const ghost = await callMailApi(api, "POST", "/api/bots/_mail/send",
    { body: { actor: { kind: "post", id: "ghost" }, to: "b", text: "投递" }, hooks: { recordRejection: (r) => ghostSeen.push(r) } });
  assert.equal(ghost.status, 403);
  assert.equal(ghost.body.code, "mail-sender-unknown");
  assert.equal(ghostSeen.length, 1, "relay 判定的身份类拒绝（不在册发信者）也进鉴权留痕");
  assert.equal(ghostSeen[0].code, "mail-sender-unknown");

  const host = await callMailApi(api, "POST", "/api/bots/_mail/send",
    { body: { actor: { kind: "host", id: "host" }, to: "b", text: "投递" } });
  assert.equal(host.status, 403);
  assert.equal(host.body.code, "host-channel-forbidden");

  const spoof = await callMailApi(api, "POST", "/api/bots/_mail/send",
    { body: { actor: { kind: "post", id: "a" }, from: "b", to: "b", text: "投递" } });
  assert.equal(spoof.status, 409);
  assert.equal(spoof.body.code, "mail-actor-spoof");

  const semantic = await callMailApi(api, "POST", "/api/bots/_mail/send",
    { body: { actor: { kind: "post", id: "a" }, to: "nobody", text: "投递" } });
  assert.equal(semantic.status, 409);
  assert.equal(semantic.body.code, "mail-unknown-recipient");

  assert.equal(readAllInboxLines(home, "b").length, 1, "全部拒绝路径零写入");

  // 消费汇报与游标：同一认证口径（35 号票：cursor 同为 POST＋actor 认证）
  const cursor = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "post", id: "b" } } });
  assert.equal(cursor.status, 200);
  assert.equal(cursor.body.ok, true);
  const cursorSeen = [];
  const cursorGhost = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "post", id: "ghost" } }, hooks: { recordRejection: (r) => cursorSeen.push(r) } });
  assert.equal(cursorGhost.status, 403);
  assert.equal(cursorGhost.body.code, "mail-bot-unknown");
  assert.equal(cursorSeen.length, 1, "cursor 中继判定的身份类拒绝同样进鉴权留痕");
  assert.equal(cursorSeen[0].op, "mail.cursor");
  const cursorHost = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "host", id: "host" } } });
  assert.equal(cursorHost.status, 403);
  assert.equal(cursorHost.body.code, "host-channel-forbidden");
  const cursorSpoof = await callMailApi(api, "POST", "/api/bots/_mail/cursor",
    { body: { actor: { kind: "post", id: "b" }, botId: "a" } });
  assert.equal(cursorSpoof.status, 409);
  assert.equal(cursorSpoof.body.code, "mail-actor-spoof");
  const cursorGet = await callMailApi(api, "GET", "/api/bots/_mail/cursor",
    { headers: { "x-dsh-bots-bot-id": "b" } });
  assert.equal(cursorGet.status, 405, "GET cursor 下线（读面零写）");

  // 未接线＝503 fail closed（通道不可用分支：客户端按分支一有限重试；无 bot 侧降级通道）；错误方法 405
  const unwired = await callMailApi({}, "POST", "/api/bots/_mail/send",
    { body: { actor: { kind: "post", id: "a" }, to: "b", text: "投递" } });
  assert.equal(unwired.status, 503);
  assert.equal(unwired.body.code, "mail-channel-unwired");
  const wrongMethod = await callMailApi(api, "DELETE", "/api/bots/_mail/send",
    { body: { actor: { kind: "post", id: "a" }, to: "b", text: "投递" } });
  assert.equal(wrongMethod.status, 405);
});

test("HTTP 面：中继内部异常＝投递面故障→503（通道不可用分支），不裸 500", async () => {
  const api = { mailRelay: { send: () => { throw new Error("relay boom"); }, consume: () => ({}), cursor: () => ({}) } };
  const res = await callMailApi(api, "POST", "/api/bots/_mail/send",
    { body: { actor: { kind: "post", id: "a" }, to: "b", text: "投递" } });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, "mail-relay-failed");
});
