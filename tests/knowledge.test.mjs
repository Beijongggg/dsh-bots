/**
 * 回归：团队调研知识底座（v1 MVP）—— 独立模块 lib/knowledge.js 全链路。
 * 真实 tmp 目录驱动，不 mock 生产逻辑。模块设计：纯函数核心（路径规划/
 * 索引读/ID 生成/登记/检索）与 index.js 的工具注册层分离（同 stats.js 先例）。
 *
 * 语义不变量（PROPOSAL-knowledge-base.md）：
 *   - knowledge/ 目录 + REPORT_TEMPLATE.md 安装时创建，幂等且**不覆盖**用户模板；
 *   - 索引 index.jsonl 一行一条；损坏行跳过；ID = R-<年>-<三位序号>（跨年重置）；
 *   - registerReport：title/body/summary 必填；id/botId/date 自动填充；
 *     supersedes → 旧条目标 status=updated + supersededBy（保留旧版痕迹）；
 *     reused → 旧条目 reusedBy 追加（去重）；未知 supersedes 报错、未知 reused 忽略；
 *   - searchIndex：标题/标签/摘要/核心结论子串命中（大小写不敏感），status 过滤，
 *     空 query 全列、按登记倒序截 10；不做全文检索。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { deadPid } from "./helpers/dead-pid-fixture.mjs";

const { ensureKnowledgeBase, readIndex, nextReportId, registerReport, deprecateReport, searchIndex,
  auditKnowledgeIndex,
  knowledgeDir, indexFile, reportsDirFor, templateFileFor, acquireIndexLock } = await import("../lib/knowledge.js");
const { internals } = await import("../lib/index.js");
const { registerKnowledgeTools } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 夹具 ----------
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-kb-"));
  homes.push(home);
  return home;
}
const NOW = new Date("2026-08-24T06:00:00.000Z");

const input = (overrides = {}) => ({
  title: "调研标题", body: "# 报告正文\n...",
  summary: "三句摘要", tags: ["标签A", "标签B"],
  conclusions: ["结论1", "结论2"], sources: ["来源1"],
  appliesTo: "后续同类调研", task: "T-2026-001/用户委派", ...overrides
});

// ---------- 安装 ----------
test("ensureKnowledgeBase：目录+模板创建，幂等且不覆盖用户模板", () => {
  const home = mkHome();
  assert.equal(fs.existsSync(knowledgeDir(home)), false);
  ensureKnowledgeBase(home);
  assert.ok(fs.existsSync(path.dirname(indexFile(home))), "index.jsonl 所在目录就位");
  assert.ok(fs.existsSync(templateFileFor(home)), "模板创建");
  const template = fs.readFileSync(templateFileFor(home), "utf8");
  assert.ok(template.includes("## 摘要"), "默认模板含摘要节");

  // 用户自定义模板 → 再 ensure 不得覆盖
  fs.writeFileSync(templateFileFor(home), "# 我的模板\n");
  ensureKnowledgeBase(home);
  assert.equal(fs.readFileSync(templateFileFor(home), "utf8"), "# 我的模板\n", "模板不覆盖");
});

// ---------- ID 生成 ----------
test("nextReportId：空库 R-<年>-001；已有递增；跨年重置", () => {
  const home = mkHome();
  assert.equal(nextReportId(home, NOW), "R-2026-001");
  ensureKnowledgeBase(home);
  fs.appendFileSync(indexFile(home), JSON.stringify({ id: "R-2026-001" }) + "\n");
  fs.appendFileSync(indexFile(home), JSON.stringify({ id: "R-2026-002" }) + "\n");
  assert.equal(nextReportId(home, NOW), "R-2026-003");
  assert.equal(nextReportId(home, new Date("2027-03-01T00:00:00.000Z")), "R-2027-001",
    "跨年重新编号");
});

// ---------- 登记 ----------
test("registerReport 新建：索引行+报告文件+自动字段", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const r = registerReport({ dshHome: home, botId: "bot-mt0x6r0y", input: input(), now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.id, "R-2026-001");
  assert.ok(fs.existsSync(path.join(reportsDirFor(home), "R-2026-001.md")), "报告文件落盘");
  const entries = readIndex(home);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "R-2026-001");
  assert.equal(entries[0].botId, "bot-mt0x6r0y", "产出者自动填充");
  assert.equal(entries[0].date, "2026-08-24T06:00:00.000Z", "交付日期自动填充");
  assert.equal(entries[0].status, "valid", "默认状态");
  assert.deepEqual(entries[0].tags, ["标签A", "标签B"]);
});

test("registerReport 校验：缺必填 → ok:false 且不动索引/报告", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  for (const bad of [
    input({ title: "" }),
    input({ body: "" }),
    input({ summary: "" }),
    input({ title: undefined, summary: undefined })
  ]) {
    const r = registerReport({ dshHome: home, botId: "b", input: bad, now: NOW });
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
  assert.equal(readIndex(home).length, 0, "校验失败不动索引");
});

test("registerReport supersedes：旧条目标 updated + supersededBy（保留痕迹）", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  const r = registerReport({ dshHome: home, botId: "b",
    input: input({ title: "新版本", supersedes: "R-2026-001" }), now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.id, "R-2026-002");
  const entries = readIndex(home);
  const oldEntry = entries.find((e) => e.id === "R-2026-001");
  assert.equal(oldEntry.status, "updated", "旧条目状态翻转");
  assert.equal(oldEntry.supersededBy, "R-2026-002", "旧条目保留新版指针");
  assert.equal(entries.find((e) => e.id === "R-2026-002").status, "valid");
});

test("registerReport：supersedes 指向不存在的 id → ok:false（防悬空指针）", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const r = registerReport({ dshHome: home, botId: "b",
    input: input({ supersedes: "R-2020-999" }), now: NOW });
  assert.equal(r.ok, false);
  assert.equal(readIndex(home).length, 0);
});

test("registerReport reused：旧条目 reusedBy 追加且去重；未知 id 忽略", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  const r = registerReport({ dshHome: home, botId: "c",
    input: input({ title: "复用报告", reused: ["R-2026-001", "R-2026-001", "R-2020-999"] }),
    now: NOW });
  assert.equal(r.ok, true);
  const entries = readIndex(home);
  assert.deepEqual(entries.find((e) => e.id === "R-2026-001").reusedBy, ["R-2026-002"],
    "reusedBy 追加且去重（未知 id 静默忽略）");
});

test("registerReport 双填兼容：同一旧 id 同时 supersedes + reused → updated+supersededBy+reusedBy 三标记齐备（O-2 明文化）", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW }); // R-2026-001
  const r = registerReport({ dshHome: home, botId: "c",
    input: input({ title: "取代且沿用", supersedes: "R-2026-001", reused: ["R-2026-001"] }),
    now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.id, "R-2026-002");
  const oldEntry = readIndex(home).find((e) => e.id === "R-2026-001");
  assert.equal(oldEntry.status, "updated", "取代 → 旧条目标 updated");
  assert.equal(oldEntry.supersededBy, "R-2026-002", "取代 → supersededBy 指针");
  assert.deepEqual(oldEntry.reusedBy, ["R-2026-002"], "沿用 → reusedBy（与 supersedes 并存，互不排斥）");
});

test("registerReport 存储失败（目录不可写）→ ok:false，不吞错", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  fs.chmodSync(knowledgeDir(home), 0o555);
  try {
    const r = registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
    assert.equal(r.ok, false, "目录只读应报错");
  } finally {
    fs.chmodSync(knowledgeDir(home), 0o755);
  }
});

// ---------- 失效登记：废弃（10 号票 V-A7.8「显式取代／废弃」的废弃腿） ----------
test("deprecateReport：显式废弃登记——append 语义翻状态、不物理删除、旧痕迹保留", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input({ title: "待废弃" }), now: NOW });
  const r = deprecateReport({ dshHome: home, id: "R-2026-001", reason: "被后续实测否定", now: NOW });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.id, "R-2026-001");
  const entry = readIndex(home).find((e) => e.id === "R-2026-001");
  assert.equal(entry.status, "deprecated", "状态翻为 deprecated");
  assert.equal(entry.deprecatedReason, "被后续实测否定", "废弃理由留痕");
  assert.ok(fs.existsSync(path.join(reportsDirFor(home), "R-2026-001.md")), "报告全文不删档（append 语义）");
  // 废弃是唯一失效机制：无自动失效字段落地
  for (const key of ["expiresAt", "ttlDays", "accessCount", "hitCount", "lastAccessedAt", "score"]) {
    assert.equal(key in entry, false, `废弃登记不得引入自动失效/热字段：${key}`);
  }
});

test("deprecateReport：未知 id / 已废弃 / 非法入参 → ok:false 且不动索引", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  const before = fs.readFileSync(indexFile(home), "utf8");
  assert.equal(deprecateReport({ dshHome: home, id: "R-2020-999", now: NOW }).ok, false, "未知 id 拒");
  assert.equal(deprecateReport({ dshHome: home, id: "", now: NOW }).ok, false, "空 id 拒");
  assert.equal(deprecateReport({ dshHome: home, id: "R-2026-001", reason: 42, now: NOW }).ok, false,
    "理由非字符串拒（不给非文本留痕）");
  assert.equal(fs.readFileSync(indexFile(home), "utf8"), before, "拒绝路径不动索引");
  assert.equal(deprecateReport({ dshHome: home, id: "R-2026-001", reason: "误", now: NOW }).ok, true);
  assert.equal(deprecateReport({ dshHome: home, id: "R-2026-001", reason: "再误", now: NOW }).ok, false,
    "已废弃不二次废弃（状态转移非法即拒）");
});

test("deprecateReport：并发下不丢更新（同锁协议）", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  for (let i = 1; i <= 5; i++) registerReport({ dshHome: home, botId: "b", input: input({ title: `报${i}` }), now: NOW });
  const results = [1, 2, 3, 4, 5].map((i) =>
    deprecateReport({ dshHome: home, id: `R-2026-00${i}`, reason: "批量废弃", now: NOW }));
  assert.ok(results.every((r) => r.ok === true), JSON.stringify(results));
  const entries = readIndex(home);
  assert.equal(entries.length, 5, "五条都在（不物理删除）");
  assert.ok(entries.every((e) => e.status === "deprecated"));
});

// ---------- 检索 ----------
test("searchIndex：标题/标签/摘要/结论子串命中，大小写不敏感", () => {
  const entries = [
    { id: "R-2026-001", title: "视觉模型对比", tags: ["vision"], summary: "对比了 A 和 B", conclusions: ["C 最优"], status: "valid", date: "2026-08-24T06:00:00.000Z" },
    { id: "R-2026-002", title: "调研数据格式", tags: ["data"], summary: "CSV 最佳", conclusions: ["见正文"], status: "valid", date: "2026-08-24T07:00:00.000Z" }
  ];
  assert.equal(searchIndex(entries, "视觉").length, 1);
  assert.equal(searchIndex(entries, "VISION").length, 1, "标签命中不区分大小写");
  assert.equal(searchIndex(entries, "CSV").length, 1, "摘要命中");
  assert.equal(searchIndex(entries, "最优").length, 1, "核心结论命中");
  assert.equal(searchIndex(entries, "r-2026-002").length, 1, "id 可寻址命中（大小写不敏感）");
  assert.equal(searchIndex(entries, "不存在").length, 0);
});

test("searchIndex：status 过滤；空 query 全列、登记倒序截 10", () => {
  const entries = [];
  for (let i = 1; i <= 12; i++) {
    entries.push({ id: `R-2026-${String(i).padStart(3, "0")}`, title: `报告${i}`, tags: [], summary: "s", conclusions: [], status: i === 2 ? "updated" : "valid", date: `2026-08-2${i}` });
  }
  assert.equal(searchIndex(entries, "", null).length, 10, "空 query 截 10 条");
  assert.equal(searchIndex(entries, "", null)[0].id, "R-2026-012", "倒序（最近登记在前）");
  const onlyUpdated = searchIndex(entries, "", "updated");
  assert.equal(onlyUpdated.length, 1);
  assert.equal(onlyUpdated[0].id, "R-2026-002");
});

// ---------- 读 ----------
test("readIndex：跳过损坏行，文件缺失 → []", () => {
  const home = mkHome();
  assert.deepEqual(readIndex(home), [], "文件缺失");
  ensureKnowledgeBase(home);
  fs.appendFileSync(indexFile(home), "{bad json}\n" +
    JSON.stringify({ id: "R-2026-001", title: "好行" }) + "\n" +
    JSON.stringify(["not", "object"]) + "\n");
  const entries = readIndex(home);
  assert.equal(entries.length, 1, "仅干净行进索引");
  assert.equal(entries[0].id, "R-2026-001");
});

// ---------- 并发互斥（K-1 修复） ----------
test("acquireIndexLock：唯一获取；持锁时自旋超时；释放后可再获取", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const lock = acquireIndexLock(home);
  assert.throws(() => acquireIndexLock(home, { spinMs: 150, tickMs: 10 }), /锁超时/,
    "持锁时第二获取者应超时");
  lock.release();
  const again = acquireIndexLock(home, { spinMs: 500, tickMs: 10 });
  again.release();
  assert.equal(fs.existsSync(path.join(knowledgeDir(home), ".lock")), false, "释放后锁目录清理");
});

test("registerReport：陈旧锁（持有者死亡未释放）自动接管，登记不阻塞", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  // 伪造死锁：手建 .lock 且 mtime 设为 10s 前（> staleMs=1000，走 mtime 慢路接管）
  const lockDir = path.join(knowledgeDir(home), ".lock");
  fs.mkdirSync(lockDir);
  const past = new Date(Date.now() - 10_000);
  fs.utimesSync(lockDir, past, past);
  const r = registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  assert.equal(r.ok, true, "陈旧锁应被接管而非报错");
  assert.equal(r.id, "R-2026-001");
  assert.equal(readIndex(home).length, 1, "登记成功");
  assert.equal(fs.existsSync(lockDir), false, "接管后锁目录被清理");
});

test("registerReport：索引损坏/非对象行重写后原样保留（K-2 不吞修复线索）", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const corrupt = "{bad json, not parseable";
  const arrLine = JSON.stringify(["not", "an", "object"]);
  const goodLine = JSON.stringify({ id: "R-2026-099", title: "前置好行" });
  fs.appendFileSync(indexFile(home), `${goodLine}\n${corrupt}\n${arrLine}\n`);
  const r = registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.id, "R-2026-100", "水位次 max(99 好行, 1 好行+2 不可解析)+1＝100");
  const raw = fs.readFileSync(indexFile(home), "utf8");
  assert.ok(raw.includes(corrupt), "损坏行原样保留");
  assert.ok(raw.includes(arrLine), "非对象行原样保留");
  assert.deepEqual(readIndex(home).map((e) => e.id), ["R-2026-099", "R-2026-100"],
    "读侧仍只回干净行");
});

test("acquireIndexLock：owner.json 不可读时 release 不删锁（F-E：防误删他人接管的新锁）", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const lock = acquireIndexLock(home);
  const lockDir = path.join(knowledgeDir(home), ".lock");
  try {
    fs.rmSync(path.join(lockDir, "owner.json")); // 归属不可证明（缺失与不可读同路径）
    lock.release();
    assert.ok(fs.existsSync(lockDir), "无法证明归属时不得删除锁目录（泄漏由 3s 陈旧接管自愈）");
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test("acquireIndexLock（36 号票 A9）：死主锁不等 staleMs 即接管；活主锁不抢", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const lockDir = path.join(knowledgeDir(home), ".lock");
  // 死主（owner.json 的 pid 已不存在）：快路立即接管——staleMs 拉大到 60s 把慢路关掉，
  // 取得锁这件事本身就证明走的是死主快路，而不是等陈旧阈值。
  fs.mkdirSync(lockDir);
  fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ pid: deadPid(), at: Date.now() }));
  const lock = acquireIndexLock(home, { spinMs: 3000, staleMs: 60_000, tickMs: 10 });
  assert.equal(lock.tookOver, true, "死主锁须被立即接管");
  lock.release();

  // 活主（本进程）且未陈旧：不得被快路抢走，fail closed 超时且锁目录保持
  fs.mkdirSync(lockDir);
  fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }));
  try {
    assert.throws(() => acquireIndexLock(home, { spinMs: 300, staleMs: 60_000, tickMs: 10 }), /锁超时/,
      "活持有者的锁不得被快路接管");
    assert.ok(fs.existsSync(lockDir), "活主锁目录不得被删");
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test("registerReport（36 号票 A9）：锁争用经 logger 留痕——无争用零告警，接管留一行", () => {
  const clean = mkHome();
  ensureKnowledgeBase(clean);
  const quiet = [];
  const first = registerReport({
    dshHome: clean, botId: "b", input: input(), now: NOW, logger: { warn: (line) => quiet.push(line) }
  });
  assert.equal(first.ok, true, first.error);
  assert.deepEqual(quiet, [], "亚阈快路径不留痕（留痕不制造噪声）");

  const home = mkHome();
  ensureKnowledgeBase(home);
  const lockDir = path.join(knowledgeDir(home), ".lock");
  fs.mkdirSync(lockDir);
  fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ pid: deadPid(), at: Date.now() }));
  const lines = [];
  const r = registerReport({
    dshHome: home, botId: "b", input: input(), now: NOW, logger: { warn: (line) => lines.push(line) }
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.id, "R-2026-001");
  assert.equal(lines.length, 1, "接管恰留一行（指标随行：lock／waitMs／outcome／takeover／holderPid／dir）");
  assert.ok(lines[0].includes("lockId=knowledge-index"), lines[0]);
  assert.ok(lines[0].includes("takeover=1"), lines[0]);
  assert.ok(lines[0].includes("outcome=acquired"), lines[0]);
  assert.equal(fs.existsSync(lockDir), false, "接管后锁目录已清理");
});

test("deprecateReport（36 号票 A9）：与登记同一留痕口径（同一把索引锁）", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  const lockDir = path.join(knowledgeDir(home), ".lock");
  fs.mkdirSync(lockDir);
  fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ pid: deadPid(), at: Date.now() }));
  const lines = [];
  const r = deprecateReport({
    dshHome: home, id: "R-2026-001", reason: "36 号票留痕口径", now: NOW,
    logger: { warn: (line) => lines.push(line) }
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(lines.length, 1, "接管恰留一行");
  assert.ok(lines[0].includes("lockId=knowledge-index") && lines[0].includes("takeover=1"), lines[0]);
});

test("registerReport（36 号票 A9）：默认冻结上限 1.5s（旧缺省 6s）——超时留痕且零落盘", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const lockDir = path.join(knowledgeDir(home), ".lock");
  // mtime 设为未来（远端写入/时钟偏差形态）：陈旧接管永不成立 → 观察纯 spin 上限
  fs.mkdirSync(lockDir);
  fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }));
  const future = new Date(Date.now() + 3_600_000);
  fs.utimesSync(lockDir, future, future);
  const lines = [];
  const startedAt = Date.now();
  const r = registerReport({
    dshHome: home, botId: "b", input: input(), now: NOW, logger: { warn: (line) => lines.push(line) }
  });
  const elapsed = Date.now() - startedAt;
  try {
    assert.equal(r.ok, false, "拿不到锁不得无锁写入");
    assert.match(r.error, /锁超时/);
    assert.ok(elapsed >= 1400, `默认 spinMs 须实际跑满自旋窗口（实得 ${elapsed}ms）`);
    assert.ok(elapsed < 5000, `默认冻结上限已从 6000ms 收紧（实得 ${elapsed}ms）`);
    assert.equal(lines.filter((line) => line.includes("outcome=timeout")).length, 1, "超时无条件留痕");
    assert.equal(readIndex(home).length, 0, "超时路径零落盘");
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test("knowledge_search 工具：命中超过 10 条 → truncated=true 且恰返 10（F-C +1 哨兵）", async () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  for (let i = 1; i <= 12; i++) {
    registerReport({ dshHome: home, botId: "b", input: input({ title: `系列报告${i}` }), now: NOW });
  }
  const registered = [];
  const tools = { register: (t) => { registered.push(t); return () => {}; } };
  const ctx = { get: (n) => (n === "tools" ? tools : undefined), logger: { info() {}, warn() {}, debug() {} } };
  registerKnowledgeTools(ctx, { dshHome: home }, "b");
  const search = registered.find((t) => t.name === "knowledge_search");

  const many = await search.execute({ query: "系列报告" });
  assert.equal(many.results.length, 10, "命中 12 → 恰返 10");
  assert.equal(many.truncated, true, "截断标志");
  assert.equal(many.total, 10, "total 语义不变＝返回条数");

  const few = await search.execute({ query: "系列报告1" }); // 命中 1/10/11/12 共 4 条
  assert.equal(few.results.length, 4);
  assert.equal(few.truncated, false, "未截断不带标志");
});

test("registerReport 并发：4 子进程真并行登记，索引零丢失/零撞号", async () => {
  // 真并发（spawn + Promise.all；不用 spawnSync——串行会掩盖竞态）。
  // 300 条底座拉长临界区（与审查者复现窗口一致）；完整断言：
  // 全部 ok、ID 全局唯一、每个返回的 ID 都落索引、总数 = 底座 + 登记数。
  const home = mkHome();
  ensureKnowledgeBase(home);
  const SEED = 300, PROCS = 4, N = 25;
  const seed = [];
  for (let i = 1; i <= SEED; i++) {
    seed.push(JSON.stringify({ id: `R-2026-${String(i).padStart(3, "0")}`, title: `底座${i}`, tags: [], summary: "s", conclusions: [], status: "valid", date: NOW.toISOString() }));
  }
  fs.appendFileSync(indexFile(home), seed.join("\n") + "\n");

  const KB_MODULE = fileURLToPath(new URL("../lib/knowledge.js", import.meta.url));
  const script = `
import { pathToFileURL } from "node:url";
const { registerReport } = await import(pathToFileURL(process.env.KB_MODULE).href);
const home = process.env.KB_HOME;
const botId = process.env.KB_BOT;
const now = new Date(process.env.KB_NOW);
const n = Number(process.env.KB_N);
const out = [];
for (let i = 0; i < n; i++) {
  const r = registerReport({ dshHome: home, botId, now, input: {
    title: '并发-' + botId + '-' + i, body: '正文-' + i, summary: '摘要-' + i
  }});
  out.push({ ok: r.ok, id: r.id, error: r.error });
}
process.stdout.write(JSON.stringify(out));
`;
  const runChild = (botId) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, KB_MODULE, KB_HOME: home, KB_NOW: NOW.toISOString(), KB_N: String(N) }
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`子进程 ${botId} 退出码 ${code}: ${stderr}`));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`子进程 ${botId} 输出解析失败：${stdout.slice(0, 200)}`)); }
    });
  });

  const perBot = await Promise.all(["bot-a", "bot-b", "bot-c", "bot-d"].map(runChild));
  const all = perBot.flat();
  assert.equal(all.length, PROCS * N, "每个进程都完成 N 次登记");
  const failed = all.filter((x) => !x.ok);
  assert.equal(failed.length, 0, `并发登记应全部 ok（失败样例 ${JSON.stringify(failed.slice(0, 3))}）`);
  const ids = all.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "ID 不得重复（撞号）");
  const finalEntries = readIndex(home);
  const finalIds = new Set(finalEntries.map((e) => e.id));
  for (const id of ids) {
    assert.ok(finalIds.has(id), `登记返回 ${id} 但索引无此条（丢失）`);
  }
  assert.equal(finalEntries.length, SEED + ids.length, "索引总数 = 底座 + 全部成功登记（无丢失）");
});

// ---------- 工具集成 ----------
test("检索面维持索引级子串：报告正文不参与检索（否决全文检索；10 号票 §G 检索面口径）", async () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const unique = "ZQ正文独有串QZ";
  registerReport({
    dshHome: home, botId: "b", now: NOW,
    input: input({ title: "索引级报告", summary: "索引里的摘要", body: `# 正文\n${unique}` })
  });
  // 索引级：标题/摘要等索引字段命中
  assert.equal(searchIndex(readIndex(home), "索引里的摘要").length, 1, "索引字段可命中");
  // 全文级：正文独有串**不得**命中——searchIndex 只吃索引行，正文不在其内
  assert.equal(searchIndex(readIndex(home), unique).length, 0, "正文不参与检索（否决全文检索）");
  // 工具面同口径：knowledge_search 亦读不到正文
  const registered = [];
  registerKnowledgeTools(
    { get: (n) => (n === "tools" ? { register: (t) => { registered.push(t); return () => {}; } } : undefined), logger: { debug() {}, info() {}, warn() {} } },
    { dshHome: home }, "b"
  );
  const search = registered.find((t) => t.name === "knowledge_search");
  const viaTool = await search.execute({ query: unique });
  assert.equal(viaTool.results.length, 0, "工具面同样检索不到正文");
});

test("registerKnowledgeTools：**只**注册读取工具 knowledge_search（写口已命令化，读取面照旧；V-A4.5）", async () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const registered = [];
  const tools = { register: (tool) => { registered.push(tool); return () => {}; } };
  const ctx = { get: (name) => (name === "tools" ? tools : undefined), logger: { info() {}, warn() {} } };
  const api = { dshHome: home };
  registerKnowledgeTools(ctx, api, "bot-mt0x6r0y");
  assert.deepEqual(registered.map((t) => t.name), ["knowledge_search"],
    "bot 侧知识工具只剩读取面（写口＝host 侧 knowledge.register 命令）");

  const search = registered.find((t) => t.name === "knowledge_search");
  // 读取面端到端：登记（host 侧路径）→ 检索回读
  const res = registerReport({ dshHome: home, botId: "bot-mt0x6r0y", input: input({ title: "工具侧报告" }), now: NOW });
  assert.equal(res.ok, true);
  const found = await search.execute({ query: "工具侧" });
  assert.equal(found.status, undefined, "search 结果无 status 字段（输出 schema 形状）");
  assert.equal(found.total, 1, "total 计数");
  assert.equal(found.results.length, 1);
  assert.equal(found.results[0].id, "R-2026-001");
  const all = await search.execute({ query: "" });
  assert.equal(all.results.length, 1, "空 query 全列");
});

test("F-R4-1（命令化后的延续形态）：knowledge.register 描述经 describeOp 现读嵌入 REPORT_TEMPLATE.md；模板缺失降级", async () => {
  const { deriveToolFace } = await import("../lib/org/op-set.js");
  const { internals: idx } = await import("../lib/index.js");
  const describeFor = idx.buildRegisterDescription;
  assert.equal(typeof describeFor, "function", "描述构造面须可测（导出供只读断言）");

  // 有模板：描述含现读模板结构节 + 基础句保留
  const home = mkHome();
  ensureKnowledgeBase(home);
  const face = deriveToolFace("researcher", { describeOp: ({ op, description }) => (op === "knowledge.register" ? describeFor(home) : description) });
  const tool = face.find((t) => t.op === "knowledge.register");
  assert.ok(tool.description.includes("报告模板结构（REPORT_TEMPLATE.md 现读"), "标注动态来源（非静态内联）");
  assert.ok(tool.description.includes("## 摘要"), "描述含现读模板结构节");
  assert.ok(tool.description.includes("supersedes 与 reused 可对同一旧 id 同时填"), "基础句保留");
  assert.ok(tool.description.includes("命令化"), "基础句须说明写口在 host（命令化）");

  // 无模板：降级为纯基础描述，不带模板节
  const home2 = mkHome();
  const face2 = deriveToolFace("researcher", { describeOp: ({ op, description }) => (op === "knowledge.register" ? describeFor(home2) : description) });
  const tool2 = face2.find((t) => t.op === "knowledge.register");
  assert.ok(!tool2.description.includes("报告模板结构（REPORT_TEMPLATE.md"), "无模板 → 无模板节");
  assert.ok(tool2.description.includes("把一份产出登记进团队共享知识库"), "基础句仍在");
});

// ---------- 34 号票 A7a：损坏行占序号水位 ----------
test("A7a 稀疏序号的最高号索引损坏：已有报告占号，预览与登记均不覆盖正文", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const corrupt = '{"id":"R-2026-100",';
  fs.writeFileSync(indexFile(home), JSON.stringify({ id: "R-2026-099", status: "valid" }) + "\n" + corrupt + "\n");
  const priorReport = path.join(reportsDirFor(home), "R-2026-100.md");
  fs.writeFileSync(priorReport, "ORIGINAL");

  assert.equal(nextReportId(home, NOW), "R-2026-101");
  const registered = registerReport({ dshHome: home, botId: "b", input: input({ body: "NEW" }), now: NOW });
  assert.equal(registered.ok, true, registered.error);
  assert.equal(registered.id, "R-2026-101");
  assert.equal(fs.readFileSync(priorReport, "utf8"), "ORIGINAL");
  assert.ok(fs.readFileSync(indexFile(home), "utf8").includes(corrupt), "损坏行仍保留修复线索");
});

test("A7a 索引缺失、修复删行或 id 字段损坏时，未登记报告仍占当年序号", () => {
  for (const index of [undefined, "", '{}\n', '{"id":"R-2026-001","status":"valid"}\n']) {
    const home = mkHome();
    ensureKnowledgeBase(home);
    if (index !== undefined) fs.writeFileSync(indexFile(home), index);
    const priorReport = path.join(reportsDirFor(home), "R-2026-005.md");
    fs.writeFileSync(priorReport, "ORIGINAL");
    fs.writeFileSync(path.join(reportsDirFor(home), "R-2025-999.md"), "OTHER YEAR");
    fs.writeFileSync(path.join(reportsDirFor(home), "R-2026-888.md.bak"), "BACKUP");

    assert.equal(nextReportId(home, NOW), "R-2026-006");
    const registered = registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
    assert.equal(registered.ok, true, registered.error);
    assert.equal(registered.id, "R-2026-006");
    assert.equal(fs.readFileSync(priorReport, "utf8"), "ORIGINAL");
    assert.equal(nextReportId(home, new Date("2027-01-01T00:00:00Z")), "R-2027-001");
  }
});

test("A7a 损坏行占序号水位：索引仅剩损坏行＋既有报告文件 → 新登记不复用 id、不覆盖正文", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const r1 = registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  assert.equal(r1.id, "R-2026-001");
  // 模拟 R-2026-001 索引行截断损坏（报告文件保留 ORIGINAL）
  const onlyLine = fs.readFileSync(indexFile(home), "utf8").split("\n").filter((l) => l.trim() !== "");
  assert.equal(onlyLine.length, 1);
  const truncated = onlyLine[0].slice(0, 20);
  assert.throws(() => JSON.parse(truncated), "截断行须确实不可解析");
  fs.writeFileSync(indexFile(home), truncated + "\n");
  const before = fs.readFileSync(path.join(reportsDirFor(home), "R-2026-001.md"), "utf8");
  const r2 = registerReport({ dshHome: home, botId: "b",
    input: input({ title: "新", body: "NEW", summary: "s2" }), now: NOW });
  assert.equal(r2.ok, true);
  assert.notEqual(r2.id, "R-2026-001", "损坏行占位，不得复用旧 id");
  assert.equal(fs.readFileSync(path.join(reportsDirFor(home), "R-2026-001.md"), "utf8"), before,
    "旧正文不得被覆盖");
  assert.ok(fs.readFileSync(indexFile(home), "utf8").includes(truncated), "损坏行仍原样保留（K-2）");
});

test("A7a nextReportId 与 registerReport 同水位：单损坏行 → R-2026-002", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  fs.appendFileSync(indexFile(home), "{truncated\n");
  assert.equal(nextReportId(home, NOW), "R-2026-002");
});

// ---------- 34 号票 A7b：valid 以外一律拒（两终态） ----------
test("A7b 废弃→取代即拒：已 deprecated 条目不可再被取代，不动任何文件", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  assert.equal(deprecateReport({ dshHome: home, id: "R-2026-001", reason: "被否定", now: NOW }).ok, true);
  const indexBefore = fs.readFileSync(indexFile(home), "utf8");
  const reportsBefore = fs.readdirSync(reportsDirFor(home)).sort();
  const r = registerReport({ dshHome: home, botId: "b",
    input: input({ title: "取代已废弃", supersedes: "R-2026-001" }), now: NOW });
  assert.equal(r.ok, false, "已废弃条目不可再被取代");
  assert.equal(fs.readFileSync(indexFile(home), "utf8"), indexBefore, "拒绝路径不动索引");
  assert.deepEqual(fs.readdirSync(reportsDirFor(home)).sort(), reportsBefore, "拒绝路径不写新报告");
  const target = readIndex(home).find((e) => e.id === "R-2026-001");
  assert.equal(target.status, "deprecated", "目标仍是废弃态");
  assert.equal("supersededBy" in target, false, "不叠加后继指针");
});

test("A7b 取代→废弃即拒：已 updated（有后继）条目不可再被废弃，不动索引", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  registerReport({ dshHome: home, botId: "b",
    input: input({ title: "新版", supersedes: "R-2026-001" }), now: NOW });
  const indexBefore = fs.readFileSync(indexFile(home), "utf8");
  const r = deprecateReport({ dshHome: home, id: "R-2026-001", reason: "事后废弃", now: NOW });
  assert.equal(r.ok, false, "有后继条目不可再废弃");
  assert.equal(fs.readFileSync(indexFile(home), "utf8"), indexBefore, "拒绝路径不动索引");
  const target = readIndex(home).find((e) => e.id === "R-2026-001");
  assert.equal(target.status, "updated");
  assert.equal(target.supersededBy, "R-2026-002");
  assert.equal("deprecatedReason" in target, false, "不叠加废弃理由");
  assert.equal("deprecatedAt" in target, false, "不叠加废弃时间");
});

test("A7b 已 updated 条目不可二次取代：后继指针不被改写", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  registerReport({ dshHome: home, botId: "b", input: input(), now: NOW });
  registerReport({ dshHome: home, botId: "b",
    input: input({ title: "新版", supersedes: "R-2026-001" }), now: NOW });
  const r = registerReport({ dshHome: home, botId: "b",
    input: input({ title: "又一版", supersedes: "R-2026-001" }), now: NOW });
  assert.equal(r.ok, false, "已有后继即拒，不改写指针");
  assert.equal(readIndex(home).find((e) => e.id === "R-2026-001").supersededBy, "R-2026-002");
});

test("A7b 未知状态 fail closed：非 valid／updated／deprecated 条目取代废弃一律拒", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  fs.appendFileSync(indexFile(home), JSON.stringify({ id: "R-2026-001", title: "异态", status: "archived" }) + "\n");
  const indexBefore = fs.readFileSync(indexFile(home), "utf8");
  assert.equal(registerReport({ dshHome: home, botId: "b",
    input: input({ title: "取代异态", supersedes: "R-2026-001" }), now: NOW }).ok, false);
  assert.equal(deprecateReport({ dshHome: home, id: "R-2026-001", now: NOW }).ok, false);
  assert.equal(fs.readFileSync(indexFile(home), "utf8"), indexBefore, "拒绝路径不动索引");
});

// ---------- 34 号票存量：只读核验 ----------
test("auditKnowledgeIndex：只读报损坏行＋混合态＋未知状态，不写盘", () => {
  const home = mkHome();
  ensureKnowledgeBase(home);
  const good = { id: "R-2026-001", title: "好行", status: "valid" };
  const mixedDeprecated = { id: "R-2026-002", title: "废弃又被取代", status: "deprecated",
    deprecatedReason: "x", deprecatedAt: NOW.toISOString(), supersededBy: "R-2026-003" };
  const mixedUpdated = { id: "R-2026-003", title: "取代又被废弃", status: "updated",
    supersededBy: "R-2026-004", deprecatedReason: "y", deprecatedAt: NOW.toISOString() };
  const unknown = { id: "R-2026-004", title: "异态", status: "archived" };
  const nonStringResidual = { id: "R-2026-005", title: "非串残留", status: "valid", supersededBy: null };
  const corrupt = "{truncated";
  const arrLine = JSON.stringify(["not", "object"]);
  fs.writeFileSync(indexFile(home),
    [JSON.stringify(good), "", corrupt, JSON.stringify(mixedDeprecated),
     arrLine, JSON.stringify(mixedUpdated), JSON.stringify(unknown),
     JSON.stringify(nonStringResidual)].join("\n") + "\n");
  const before = fs.readFileSync(indexFile(home), "utf8");
  const a = auditKnowledgeIndex(home);
  assert.equal(a.ok, true);
  assert.deepEqual(a.corrupt.map((c) => c.line), [3, 5], "行号＝文件物理行号（空行跳过但占号）");
  assert.ok(a.corrupt.every((c) => typeof c.raw === "string"), "损坏行带原文");
  const mixedIds = Object.fromEntries(a.mixed.map((m) => [m.id, m.problems]));
  assert.ok(mixedIds["R-2026-002"].includes("deprecated+supersededBy"));
  assert.ok(mixedIds["R-2026-003"].includes("updated+deprecatedReason"));
  assert.ok(mixedIds["R-2026-004"].includes("unknown-status"));
  assert.ok(mixedIds["R-2026-005"].includes("valid+residual"), "非串残留（null）同样报");
  assert.equal("R-2026-001" in mixedIds, false, "干净行不上榜");
  assert.equal(fs.readFileSync(indexFile(home), "utf8"), before, "核验只读不写");
});

test("auditKnowledgeIndex：文件缺失 → 空榜单（ok:true）", () => {
  const home = mkHome();
  const a = auditKnowledgeIndex(home);
  assert.equal(a.ok, true);
  assert.deepEqual(a.corrupt, []);
  assert.deepEqual(a.mixed, []);
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
