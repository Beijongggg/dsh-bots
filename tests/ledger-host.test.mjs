/**
 * 台账宿主接线回归（org-v2 05 号票；规格 §B 与附录 A 执行坐标）。
 *
 * 判据落点（与 tests/task-ledger.test.mjs 分工：那边测台账本体，这边测接线）：
 *   - `V-A2.1` 单一写者／bot 无直写通道 → 本模块（命令面是唯一写入口；HTTP 无旁路
 *     写通道：`_ledger` 只暴露读与命令）
 *   - `V-A2.5` 租约回收接线（实例死亡判定注入）→ 本模块
 *   - `V-A2.11` v1 两处静默丢失不再存在：收单积压超限截断／回合失败不重试
 *     → 本模块（投递面异常 → 台账处置任务＋异常事件，告警可核、条目级幂等）
 *   - `V-A2.12` 通知＝事件投影；`ledger` SSE 事件承载台账投影 → 本模块
 *
 * 只测外部行为：命令面返回码、台账事件序列与投影、通知投影、HTTP 状态码与广播
 * 帧；全程临时 DSH_HOME，不 spawn 进程、不触真实 ~/.dsh。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { internals } from "../lib/index.js";
import { createLedgerHost, startLedgerTicker, windowKeyFor } from "../lib/org/ledger-host.js";
import { createTaskLedger, eventsFile, ledgerDir } from "../lib/org/task-ledger.js";

const ledgerDirExists = (home) => existsSync(ledgerDir(home));
import { receiptsDirFor } from "../lib/mail-plane.js";

const { handleApi, createLedgerHost: createHostViaInternals, createTaskLedger: createLedgerViaInternals } = internals;

function mkHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-ledger-host-"));
  mkdirSync(join(home, "bots", "inbox"), { recursive: true });
  return home;
}

/** 写一条 skipped-stale receipt（v1 收单积压超限截断的现场证据）。 */
function writeStaleReceipt(home, botId, { messageId, seq, at }) {
  const dir = receiptsDirFor(home, botId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${messageId}.json`), JSON.stringify({ messageId, seq, outcome: "skipped-stale", at }) + "\n");
}

/** 写一条回合失败回复（v1 回合失败不重试的现场证据）。 */
function writeErrorReply(home, botId, { id, at, text = "[bot error] rpc timeout" }) {
  const dir = join(home, "bots", "outbox", botId);
  mkdirSync(dir, { recursive: true });
  const name = `${at.replace(/[:.]/g, "-")}.jsonl`;
  writeFileSync(join(dir, name), JSON.stringify({ id, text, from: "bot", timestamp: at }) + "\n");
}

/** CAS 两件取当前投影（状态改写类命令必填；见 task-ledger 测试同一口径）。 */
function cas(ledger, taskId) {
  const task = ledger.task(taskId);
  return { expectedStatus: task.status, expectedSeq: task.lastSeq };
}

const AT = "2026-09-16T10:05:00.000Z";
const NOW = Date.parse(AT);

/** 开一张最简任务（非 CAS 路径，仅供锁/读写语义用例）。 */
function openTaskViaLedger(ledger, taskId) {
  return ledger.command({
    op: "task.intake", taskId, actor: { kind: "host", id: "web" },
    idempotencyKey: `${taskId}-intake`, payload: { class: "project", brief: {} }
  });
}

function mkHost(home, { botIds = ["researcher"], alive = true, broadcast = () => {} } = {}) {
  const ledger = createTaskLedger({ dshHome: home, now: () => NOW });
  const host = createLedgerHost({
    ledger,
    now: () => NOW,
    readBotIds: () => botIds,
    isAlive: () => alive,
    broadcast,
    logger: { warn() {}, info() {} }
  });
  return { ledger, host };
}

test("异常汇入：收单积压截断与回合失败不再静默——处置任务＋异常事件＋用户通知（V-A2.11）", () => {
  const home = mkHome();
  try {
    writeStaleReceipt(home, "researcher", { messageId: "researcher-1-a", seq: 7, at: AT });
    writeStaleReceipt(home, "researcher", { messageId: "researcher-1-b", seq: 8, at: AT });
    writeErrorReply(home, "researcher", { id: "researcher-out-1", at: AT });
    const { ledger, host } = mkHost(home);
    const result = host.tick();
    assert.equal(result.anomalies.length, 2, "两类异常各归一次账");
    const sources = result.anomalies.map((a) => a.source).sort();
    assert.deepEqual(sources, ["inbox-backlog", "turn-failure"]);
    // 异常＝台账事实（而非只有日志）：处置任务＋exception 事件
    for (const anomaly of result.anomalies) {
      const task = ledger.task(anomaly.taskId);
      assert.equal(task.class, "duty", "异常处置＝常设（duty）任务");
      assert.equal(task.status, "intake");
      const exceptions = ledger.events({ taskId: anomaly.taskId }).filter((e) => e.type === "exception");
      assert.equal(exceptions.length, 1);
      assert.equal(exceptions[0].kind, "task-stalled");
      assert.equal(exceptions[0].detail.botId, "researcher");
      assert.equal(exceptions[0].detail.count, anomaly.source === "inbox-backlog" ? 2 : 1);
    }
    // 通知＝事件投影：异常事件推给用户
    const notes = ledger.notificationsAfter(0).notifications.filter((n) => n.type === "exception");
    assert.equal(notes.length, 2);
    assert.ok(notes.every((n) => n.to === "user"), "异常告警的收件人＝用户");
    // 幂等：同一条目重复汇入不产生第二条异常事件
    const again = host.ingestAnomalies(NOW);
    assert.deepEqual(again, []);
    const total = ledger.tasks().reduce((sum, task) => sum + ledger.events({ taskId: task.taskId }).filter((e) => e.type === "exception").length, 0);
    assert.equal(total, 2);
    // 持续异常不按时间窗反复开任务：仍只有两张处置任务
    assert.equal(ledger.tasks().length, 2);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("异常汇入只报本窗新增：旧条目（上一时间窗）不重复告警", () => {
  const home = mkHome();
  try {
    const oldWindow = windowKeyFor(NOW - 60 * 60 * 1000);
    writeStaleReceipt(home, "researcher", { messageId: "researcher-old", seq: 3, at: oldWindow });
    const { ledger, host } = mkHost(home);
    assert.deepEqual(host.ingestAnomalies(NOW), [], "上个时间窗的旧条目不入账");
    assert.equal(ledger.tasks().length, 0);
    // 本窗新增条目 → 入账
    writeStaleReceipt(home, "researcher", { messageId: "researcher-new", seq: 9, at: AT });
    const fresh = host.ingestAnomalies(NOW);
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].source, "inbox-backlog");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("值守轮询：实例死亡回收租约并广播台账投影，无变化不广播（V-A2.5／V-A2.12）", () => {
  const home = mkHome();
  try {
    const frames = [];
    const { ledger, host } = mkHost(home, { alive: false, broadcast: (type, data) => frames.push({ type, data }) });
    // 一张在手任务（承接者已死）
    ledger.command({ op: "task.intake", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, idempotencyKey: "a", payload: { class: "project", brief: {} } });
    ledger.command({ op: "task.triage", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, ...cas(ledger, "TK-00000050"), idempotencyKey: "b", payload: { decision: "立项" } });
    ledger.command({ op: "task.plan", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, ...cas(ledger, "TK-00000050"), idempotencyKey: "c", payload: {} });
    ledger.command({ op: "task.assign", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, ...cas(ledger, "TK-00000050"), idempotencyKey: "d", payload: { assignee: "researcher", dispatcher: "project-lead" } });
    frames.length = 0; // 只观察值守轮的广播
    const first = host.tick();
    assert.equal(first.released.length, 1);
    assert.equal(first.released[0].cause, "instance-death");
    assert.equal(ledger.task("TK-00000050").status, "planned");
    host.broadcastProjection();
    assert.equal(frames.filter((f) => f.type === "ledger").length, 1, "变化时广播台账投影");
    assert.equal(typeof frames[0].data.lastSeq, "number");
    assert.ok(Array.isArray(frames[0].data.tasks), "载荷＝台账投影（tasks）");
    // 第二拍：无变化 → 由接线层按 changed 决定不广播（此处直接核 changed 标志）
    assert.equal(host.tick().changed, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- HTTP 面 ----------------

function makeReq(method, url, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = {};
  process.nextTick(() => {
    if (body !== null) req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  });
  return req;
}

function makeRes() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(text) { this.body = text; }
  };
}

async function call(api, method, url, body = null) {
  const req = makeReq(method, url, body);
  const res = makeRes();
  await handleApi(req, res, api);
  let parsed = res.body;
  try { parsed = JSON.parse(res.body); } catch { /* 原始文本 */ }
  return { status: res.status, body: parsed };
}

test("HTTP 面：读投影／通知投影／命令面；未接线 404、非 GET 读 405", async () => {
  const home = mkHome();
  try {
    const frames = [];
    const { ledger, host } = mkHost(home, { broadcast: (type, data) => frames.push({ type, data }) });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    const empty = await call(api, "GET", "/api/bots/_ledger");
    assert.equal(empty.status, 200);
    assert.equal(empty.body.lastSeq, 0);
    assert.deepEqual(empty.body.tasks, []);

    const create = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000060", actor: { kind: "user", id: "user" },
      idempotencyKey: "h1", payload: { class: "project", brief: { goal: "g" } }
    });
    assert.equal(create.status, 200);
    assert.equal(create.body.ok, true);
    assert.equal(create.body.status, "intake");
    assert.equal(frames.filter((f) => f.type === "ledger").length, 1, "命令写入后广播投影");

    // 非法转移：fail closed（409）但拒绝也进台账（可核）；user 通道可达命令面
    // （06 号票起 host kind 在 HTTP 被 403，见上一条回归）
    const rejected = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.close", taskId: "TK-00000060", actor: { kind: "user", id: "user" },
      expectedStatus: "intake", expectedSeq: 1, idempotencyKey: "h2", payload: {}
    });
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.ok, false);
    assert.equal(rejected.body.code, "illegal-transition");

    const tasks = await call(api, "GET", "/api/bots/_ledger/tasks");
    assert.equal(tasks.body.tasks.length, 1);
    assert.equal(tasks.body.tasks[0].status, "intake");

    const notes = await call(api, "GET", "/api/bots/_ledger/notifications?cursor=0");
    assert.equal(notes.status, 200);
    assert.deepEqual(notes.body.notifications, [], "intake 不产生通知（无事件不通知）");

    const wrongMethod = await call(api, "POST", "/api/bots/_ledger/tasks");
    assert.equal(wrongMethod.status, 405);

    const unwired = await call({ dshHome: home, ctx: { logger: { warn() {} } } }, "GET", "/api/bots/_ledger");
    assert.equal(unwired.status, 404, "台账未接线（bot 实例／库直测）→ 404");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("HTTP 命令面是唯一写入口：台账事件只由命令面产生（V-A2.1）", async () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };
    // 读面不产生事件
    await call(api, "GET", "/api/bots/_ledger");
    await call(api, "GET", "/api/bots/_ledger/tasks");
    await call(api, "GET", "/api/bots/_ledger/notifications?cursor=0");
    assert.equal(ledger.events().length, 0, "只读请求不得写入事实源");
    // 台账模块导出面不含裸 append（写通道只有命令面）
    assert.equal(typeof createLedgerViaInternals({ dshHome: home }).append, "undefined");
    assert.equal(typeof createHostViaInternals, "function");
    assert.equal(eventsFile(home), join(home, "bots", "ledger", "events.jsonl"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("接线：宿主实例注册台账值守，bot 实例不构造台账（无直写通道，V-A2.1）", async () => {
  const home = mkHome();
  const previousHome = process.env.DSH_HOME;
  const previousAutostart = process.env.DSH_BOTS_AUTOSTART;
  process.env.DSH_HOME = home;
  process.env.DSH_BOTS_AUTOSTART = "0"; // 应急闸：接线测试不拉起真实 bot 进程
  const applied = [];
  const mkCtx = (baseUrl) => ({
    baseUrl,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    effect: (fn, name) => { applied.push(name); return () => {}; },
    get: () => undefined
  });
  try {
    // 宿主（主 web，profile=web）→ 注册台账值守；台账域此时无写入（写锁惰性获取）
    const { apply } = await import("../lib/index.js");
    await apply(mkCtx("file:///tmp/profiles/web/"));
    assert.ok(applied.includes("dsh-bots: 台账值守（租约回收＋异常汇入＋写锁释放）"), "宿主须注册台账值守");
    assert.equal(ledgerDirExists(home), false, "启动不写台账（写锁与事件按需惰性创建）");

    // bot 实例（profile == 注册 botId）→ 不构造台账、不注册值守
    const hostEffects = applied.length;
    await apply(mkCtx(`file://${home}/profiles/lead/`));
    const botEffects = applied.slice(hostEffects);
    assert.ok(botEffects.length > 0, "bot 实例应注册实例侧 effect（watcher／工具）");
    assert.equal(botEffects.some((name) => String(name).includes("台账")), false,
      "bot 实例不得注册台账值守（bot 无台账文件直写通道）");
    assert.equal(botEffects.some((name) => String(name).includes("邮件到达通知")), false,
      "bot 实例不启动宿主侧邮件监视器（既有纪律保持）");
    assert.equal(ledgerDirExists(home), false, "bot 实例不创建台账域");
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previousHome;
    if (previousAutostart === undefined) delete process.env.DSH_BOTS_AUTOSTART; else process.env.DSH_BOTS_AUTOSTART = previousAutostart;
    rmSync(home, { recursive: true, force: true });
  }
});

test("HTTP 命令面拒绝缺 actor 的命令且台账保持可读（写入前校验，防事实源被写坏）；host 冒名被通道策略拒（06 号票）", async () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };
    await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000080", actor: { kind: "user", id: "user" },
      idempotencyKey: "k1", payload: { class: "project", brief: {} }
    });
    // 通道策略（06 号票）：HTTP 上不得声明 kind=host（进程内身份）
    const hostImpersonation = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.triage", taskId: "TK-00000080", actor: { kind: "host", id: "web" },
      idempotencyKey: "k0", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" }
    });
    assert.equal(hostImpersonation.status, 403);
    assert.equal(hostImpersonation.body.code, "host-channel-forbidden");
    const noActor = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.judge", taskId: "TK-00000080", idempotencyKey: "k2", payload: { intent: "x" }
    });
    assert.equal(noActor.status, 409);
    assert.equal(noActor.body.code, "invalid-actor");
    // 事实源未被写坏：投影仍可读、可继续推进
    const after = await call(api, "GET", "/api/bots/_ledger");
    assert.equal(after.status, 200);
    assert.equal(after.body.tasks[0].status, "intake");
    const badBody = await call(api, "POST", "/api/bots/_ledger/commands", "not-an-object");
    assert.equal(badBody.status, 400);
    assert.equal(badBody.body.code, "invalid-command-body");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("HTTP 命令面经 dispatchCommand 出手并透传 capability 信封（06 号票签发联动通道）", async () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    const seen = [];
    host.dispatchCommand = async (input) => {
      seen.push(input);
      return { ok: true, taskId: input.taskId, status: "intake", seq: 1, via: "dispatcher" };
    };
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };
    const envelope = { payload: { v: 1, botId: "bot-a" }, sig: "ab".repeat(32) };
    const result = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000083", actor: { kind: "user", id: "user" },
      capability: envelope, idempotencyKey: "k1", payload: { class: "project" }
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.via, "dispatcher", "接线了 dispatcher 就不得直落裸命令面");
    assert.deepEqual(seen[0].capability, envelope, "信封必须原样透传给鉴权面");
    assert.equal(ledger.events().length, 0, "dispatcher 接管时裸命令面未被调用");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("值守 disposer 释放台账写锁（宿主停机/热重载不留悬空写锁）", () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    openTaskViaLedger(ledger, "TK-00000081");
    assert.equal(ledger.holdsWriterLock(), true);
    const dispose = startLedgerTicker({ host, intervalMs: 60_000, logger: { warn() {} } });
    dispose();
    assert.equal(ledger.holdsWriterLock(), false, "disposer 须释放写锁");
    // 释放后新宿主可直接取得写锁（重启语义）
    const restarted = createTaskLedger({ dshHome: home, now: () => NOW, lockSpinMs: 0 });
    assert.equal(openTaskViaLedger(restarted, "TK-00000082").ok, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
