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
import { createCapabilityIssuer } from "../lib/org/capability-issue.js";
import { instanceRegistryFile } from "../lib/org/capability-base.js";
import { createReviewFaceGate } from "../lib/org/review-kit.js";
import { createLedgerAccessKit } from "../lib/org/permissions.js";
import { createTaskLedger, eventsFile, ledgerDir, EVENT_TYPES } from "../lib/org/task-ledger.js";
import { BOOTSTRAP_ANCHOR_POST } from "../lib/org/role-cards.js";
import { deprecateReport, readIndex, registerReport, reportsDirFor } from "../lib/knowledge.js";

const ledgerDirExists = (home) => existsSync(ledgerDir(home));
import { receiptsDirFor } from "../lib/mail-plane.js";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";
import { ACCEPTANCE_RUNNER, criterionInjection } from "./helpers/criterion-fixture.mjs";

/** 已有夹具的判据执行面：本组用例测的不是判据门，显式声明「判据面已接线」（25 号票）。 */
const CRITERION_INJECTION = Object.freeze(criterionInjection(ACCEPTANCE_RUNNER));

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
async function openTaskViaLedger(ledger, taskId) {
  return await ledger.command({
    op: "task.intake", taskId, actor: { kind: "host", id: "web" },
    idempotencyKey: `${taskId}-intake`, payload: { class: "project", brief: { ...VALID_BRIEF } }
  });
}

function mkHost(home, { botIds = ["researcher"], alive = true, broadcast = () => {} } = {}) {
  const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW });
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

test("异常汇入：收单积压截断与回合失败不再静默——处置任务＋异常事件＋用户通知（V-A2.11）", async () => {
  const home = mkHome();
  try {
    writeStaleReceipt(home, "researcher", { messageId: "researcher-1-a", seq: 7, at: AT });
    writeStaleReceipt(home, "researcher", { messageId: "researcher-1-b", seq: 8, at: AT });
    writeErrorReply(home, "researcher", { id: "researcher-out-1", at: AT });
    const { ledger, host } = mkHost(home);
    const result = await host.tick();
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
    const again = await host.ingestAnomalies(NOW);
    assert.deepEqual(again, []);
    const total = ledger.tasks().reduce((sum, task) => sum + ledger.events({ taskId: task.taskId }).filter((e) => e.type === "exception").length, 0);
    assert.equal(total, 2);
    // 持续异常不按时间窗反复开任务：仍只有两张处置任务
    assert.equal(ledger.tasks().length, 2);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("异常汇入只报本窗新增：旧条目（上一时间窗）不重复告警", async () => {
  const home = mkHome();
  try {
    const oldWindow = windowKeyFor(NOW - 60 * 60 * 1000);
    writeStaleReceipt(home, "researcher", { messageId: "researcher-old", seq: 3, at: oldWindow });
    const { ledger, host } = mkHost(home);
    assert.deepEqual(await host.ingestAnomalies(NOW), [], "上个时间窗的旧条目不入账");
    assert.equal(ledger.tasks().length, 0);
    // 本窗新增条目 → 入账
    writeStaleReceipt(home, "researcher", { messageId: "researcher-new", seq: 9, at: AT });
    const fresh = await host.ingestAnomalies(NOW);
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].source, "inbox-backlog");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("值守轮询：实例死亡回收租约并广播台账投影，无变化不广播（V-A2.5／V-A2.12）", async () => {
  const home = mkHome();
  try {
    const frames = [];
    const { ledger, host } = mkHost(home, { alive: false, broadcast: (type, data) => frames.push({ type, data }) });
    // 一张在手任务（承接者已死）
    await ledger.command({ op: "task.intake", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, idempotencyKey: "a", payload: { class: "project", brief: { ...VALID_BRIEF } } });
    await ledger.command({ op: "task.triage", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, ...cas(ledger, "TK-00000050"), idempotencyKey: "b", payload: { decision: "立项" } });
    await ledger.command({ op: "task.plan", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, ...cas(ledger, "TK-00000050"), idempotencyKey: "c", payload: {} });
    await ledger.command({ op: "task.assign", taskId: "TK-00000050", actor: { kind: "host", id: "web" }, ...cas(ledger, "TK-00000050"), idempotencyKey: "d", payload: { assignee: "researcher", dispatcher: "project-lead" } });
    frames.length = 0; // 只观察值守轮的广播
    const first = await host.tick();
    assert.equal(first.released.length, 1);
    assert.equal(first.released[0].cause, "instance-death");
    assert.equal(ledger.task("TK-00000050").status, "planned");
    host.broadcastProjection();
    assert.equal(frames.filter((f) => f.type === "ledger").length, 1, "变化时广播台账投影");
    assert.equal(typeof frames[0].data.lastSeq, "number");
    assert.ok(Array.isArray(frames[0].data.tasks), "载荷＝台账投影（tasks）");
    // 第二拍：无变化 → 由接线层按 changed 决定不广播（此处直接核 changed 标志）
    assert.equal((await host.tick()).changed, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- HTTP 面 ----------------

function makeReq(method, url, body = null, headers = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;
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

async function call(api, method, url, body = null, headers = {}) {
  const req = makeReq(method, url, body, headers);
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
      idempotencyKey: "h1", payload: { class: "project", brief: { ...VALID_BRIEF } }
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

test("人间收件箱投递面：待裁项带裁定包与终裁动作、告知项并列；读面不写台账（V-A5.2／V-A5.3）", async () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };
    // 一张挂起任务（业务截止时间已过）＋一张走完交付的任务（告知项来路）
    const open = async (taskId, brief = { ...VALID_BRIEF }) => await ledger.command({
      op: "task.intake", taskId, actor: { kind: "host", id: "web" },
      idempotencyKey: `${taskId}-intake`, payload: { class: "project", brief }
    });
    const step = async (taskId, op, actor, payload) => await ledger.command({
      op, taskId, actor, ...cas(ledger, taskId), idempotencyKey: `${taskId}-${op}`, payload
    });
    assert.equal((await open("TK-00000095", { ...VALID_BRIEF, dueAt: "2026-09-15T00:00:00.000Z" })).ok, true);
    assert.equal((await step("TK-00000095", "task.triage", { kind: "host", id: "web" }, { decision: "立项" })).ok, true);
    assert.equal((await step("TK-00000095", "task.plan", { kind: "host", id: "web" }, {})).ok, true);
    assert.equal((await step("TK-00000095", "task.assign", { kind: "host", id: "web" }, { assignee: "researcher" })).ok, true);
    assert.equal((await step("TK-00000095", "task.accept", { kind: "post", id: "researcher" }, {})).ok, true);
    assert.equal((await step("TK-00000095", "task.start", { kind: "post", id: "researcher" }, {})).ok, true);
    assert.equal((await step("TK-00000095", "task.wait-user", { kind: "post", id: "researcher" }, {
      class: "irreversible-write", reason: "改真实运行面前请放行"
    })).ok, true);
    assert.equal((await open("TK-00000096")).ok, true);
    assert.equal((await step("TK-00000096", "task.triage", { kind: "host", id: "web" }, { decision: "立项" })).ok, true);
    assert.equal((await step("TK-00000096", "task.plan", { kind: "host", id: "web" }, {})).ok, true);
    assert.equal((await step("TK-00000096", "task.assign", { kind: "host", id: "web" }, { assignee: "researcher" })).ok, true);
    assert.equal((await step("TK-00000096", "task.accept", { kind: "post", id: "researcher" }, {})).ok, true);
    assert.equal((await step("TK-00000096", "task.start", { kind: "post", id: "researcher" }, {})).ok, true);
    assert.equal((await step("TK-00000096", "task.report", { kind: "post", id: "researcher" }, { deliverable: "坐标：docs/x.md" })).ok, true);
    assert.equal((await step("TK-00000096", "task.deliver", { kind: "post", id: "researcher" }, {})).ok, true);

    const before = ledger.events().length;
    const inbox = await call(api, "GET", "/api/bots/_ledger/inbox?cursor=0");
    assert.equal(inbox.status, 200);
    assert.equal(inbox.body.pending.length, 1, "只有挂起任务进待裁列表");
    const item = inbox.body.pending[0];
    assert.equal(item.taskId, "TK-00000095");
    assert.equal(item.waitingClass, "irreversible-write");
    assert.equal(item.resumeFrom, "running");
    assert.equal(item.expired, true, "业务截止时间已过＝投影已过期（不自动取消）");
    assert.deepEqual(item.actions.map((entry) => entry.id), ["accept", "reject", "defer", "authorize-repair"]);
    assert.equal(item.packet.modelIdentity, "host（确定性层组装）");
    assert.equal(item.packet.brief.goal, VALID_BRIEF.goal, "裁定包附冻结简报");
    assert.deepEqual(item.packet.positions.trail.toSeq, ledger.task("TK-00000095").lastSeq);
    assert.deepEqual(inbox.body.notices.map((entry) => entry.kind), ["delivery-return"], "告知项并列、不进待裁");
    assert.ok(inbox.body.cursor > 0);
    assert.equal(ledger.events().length, before, "投递面是只读投影：读不改台账");
    assert.equal(ledger.task("TK-00000095").status, "waiting-user");
    const wrongMethod = await call(api, "POST", "/api/bots/_ledger/inbox");
    assert.equal(wrongMethod.status, 405);
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
    // （13 号票锚点泛化后，注册表自举建出的席位 id＝锚点岗位 slug：`duty-coordinator`）
    const hostEffects = applied.length;
    await apply(mkCtx(`file://${home}/profiles/${BOOTSTRAP_ANCHOR_POST}/`));
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
      idempotencyKey: "k1", payload: { class: "project", brief: { ...VALID_BRIEF } }
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

test("值守 disposer 释放台账写锁（宿主停机/热重载不留悬空写锁）", async () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    await openTaskViaLedger(ledger, "TK-00000081");
    assert.equal(ledger.holdsWriterLock(), true);
    const dispose = startLedgerTicker({ host, intervalMs: 60_000, logger: { warn() {} } });
    dispose();
    assert.equal(ledger.holdsWriterLock(), false, "disposer 须释放写锁");
    // 释放后新宿主可直接取得写锁（重启语义）
    const restarted = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW, lockSpinMs: 0 });
    assert.equal((await openTaskViaLedger(restarted, "TK-00000082")).ok, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 复核面 HTTP（org-v2 08 号票） ----------------

test("复核面 HTTP：移交件读与报告提交经帽信封门；未携帽 403；报告响应携带续签帽", async () => {
  const home = mkHome();
  try {
    // 实例行（活 pid＝本进程）＋签发面＋复核面 gate 全真接线
    const row = {
      botId: "bot-reviewer", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-reviewer", at: Date.now()
    };
    mkdirSync(join(home, "bots", "started"), { recursive: true });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW });
    const issuer = createCapabilityIssuer({ dshHome: home, ledger, now: () => NOW });
    const reviewGate = createReviewFaceGate({ issuer, ledger });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} }, reviewGate, issuer
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    // 任务（简报带复核点）＋复核请求
    const created = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000070", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvh-intake", payload: {
        class: "project", brief: { ...VALID_BRIEF, reviewPoints: ["before-external-visibility"] }
      }
    });
    assert.equal(created.body.ok, true);
    const requested = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "review.request", taskId: "TK-00000070", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvh-request", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
    });
    assert.equal(requested.body.ok, true, requested.body.reason);

    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    assert.equal(hat.ok, true, hat.reason);
    const hatHeader = JSON.stringify(hat.envelope);

    // 未携帽读移交件 → 403（fail closed）
    const naked = await call(api, "GET", "/api/bots/_ledger/review-handoff?taskId=TK-00000070");
    assert.equal(naked.status, 403);
    assert.equal(naked.body.code, "capability-malformed", "未携帽＝信封缺格，验签腿 fail closed");

    // 携帽读 → 200，移交件含冻结简报与指定关系、不含判断输入
    const handoff = await call(api, "GET", "/api/bots/_ledger/review-handoff?taskId=TK-00000070", null, {
      "x-dsh-bots-bot-id": "bot-reviewer",
      "x-dsh-bots-capability": hatHeader
    });
    assert.equal(handoff.status, 200);
    assert.equal(handoff.body.taskId, "TK-00000070");
    assert.equal(handoff.body.requests[0].reviewer, "bot-reviewer");
    assert.deepEqual(handoff.body.brief.reviewPoints, ["before-external-visibility"]);

    // 携帽报 closed → 200＋续签帽；上浮不触发（一轮闭合）
    const reported = await call(api, "POST", "/api/bots/_ledger/reviews", {
      taskId: "TK-00000070", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvh-report",
      capability: hat.envelope,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(reported.status, 200);
    assert.equal(reported.body.ok, true);
    assert.equal(reported.body.escalated, false);
    assert.equal(reported.body.capability?.payload?.post, "verifier", "响应携带续签帽（链式）");

    // 他人冒用帽 → 403（信封属 bot-reviewer）
    const impostor = await call(api, "POST", "/api/bots/_ledger/reviews", {
      taskId: "TK-00000070", actor: { kind: "post", id: "bot-other" }, idempotencyKey: "rvh-bad",
      capability: hat.envelope,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "m" }
    });
    assert.equal(impostor.status, 403);
    assert.equal(impostor.body.code, "capability-bot-mismatch");

    // 通知投影：复核请求送达指定复核者
    const notes = await call(api, "GET", "/api/bots/_ledger/notifications?cursor=0");
    assert.ok(notes.body.notifications.some((n) => n.type === "review-requested" && n.to === "bot-reviewer"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("复核面续签（21 号票 ①）：报告被台账拒绝（review-not-requested）也续签帽——连报不断链", async () => {
  const home = mkHome();
  try {
    const row = {
      botId: "bot-reviewer", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-reviewer", at: Date.now()
    };
    mkdirSync(join(home, "bots", "started"), { recursive: true });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW });
    const issuer = createCapabilityIssuer({ dshHome: home, ledger, now: () => NOW });
    const reviewGate = createReviewFaceGate({ issuer, ledger });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} }, reviewGate, issuer
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000071", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvr-intake", payload: {
        class: "project", brief: { ...VALID_BRIEF, reviewPoints: ["before-external-visibility"] }
      }
    });
    const requested = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "review.request", taskId: "TK-00000071", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvr-request", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
    });
    assert.equal(requested.body.ok, true, requested.body.reason);

    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    assert.equal(hat.ok, true, hat.reason);

    // 帽 gate 通过（被指定），但台账拒绝：subject 未在本任务登记复核请求
    const rejected = await call(api, "POST", "/api/bots/_ledger/reviews", {
      taskId: "TK-00000071", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvr-bad",
      capability: hat.envelope,
      report: { subject: "before-irreversible-write", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.code, "review-not-requested");
    assert.equal(rejected.body.capability?.payload?.post, "verifier",
      "授权有效（帽已被 gate 单次消费）而报告被拒：同样续签帽，否则复核者连报即断链");

    // 续签帽可连报：换合法 subject 提交即 200（链式接力）
    const reported = await call(api, "POST", "/api/bots/_ledger/reviews", {
      taskId: "TK-00000071", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvr-ok",
      capability: rejected.body.capability,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(reported.status, 200, reported.body.reason);
    assert.equal(reported.body.ok, true);

    // 边界：帽 gate 自身拒绝（无帽）不给新帽——鉴权失败不续签
    const naked = await call(api, "POST", "/api/bots/_ledger/reviews", {
      taskId: "TK-00000071", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvr-naked",
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(naked.status, 403);
    assert.equal(naked.body.capability, undefined, "未过帽 gate：不续签（越权不换新信封）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 知识登记命令化 HTTP（org-v2 10 号票 V-A4.5） ----------------

test("knowledge.register 命令化：授权过的岗位实例经 host 执行登记（bot 侧无直写通道）", async () => {
  const home = mkHome();
  try {
    const row = {
      botId: "bot-researcher", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-researcher", at: Date.now()
    };
    mkdirSync(join(home, "bots", "started"), { recursive: true });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW });
    const issuer = createCapabilityIssuer({ dshHome: home, ledger, now: () => NOW });
    const access = createLedgerAccessKit({ issuer, postForBot: (botId) => (botId === "bot-researcher" ? "researcher" : null) });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} },
      authorizeCommand: access.authorize,
      knowledgeRegister: ({ op, payload, botId }) =>
        (op === "knowledge.deprecate"
          ? deprecateReport({ dshHome: home, id: payload.id, reason: payload.reason })
          : registerReport({ dshHome: home, botId, input: payload }))
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    // 未携 capability → 403（fail closed；不因「登记是轻动作」而放行）
    const naked = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "k-naked",
      payload: { title: "裸登记", summary: "s", body: "b" }
    });
    assert.equal(naked.status, 403, JSON.stringify(naked.body));
    assert.equal(readIndex(home).length, 0, "未授权不得落盘");

    // 持岗位角色能力 → 200 且索引落一行（写者＝host 进程）
    const role = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    assert.equal(role.ok, true, role.reason);
    const ok = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "k-ok",
      capability: role.envelope,
      payload: { title: "命令化登记", summary: "摘要", body: "# 正文", conclusions: ["结论1"] }
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.ok, true);
    assert.equal(ok.body.id, "R-2026-001");
    const entries = readIndex(home);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].botId, "bot-researcher", "产出者＝提交命令的实例");
    assert.ok(existsSync(join(reportsDirFor(home), "R-2026-001.md")), "报告全文由 host 落盘");

    // 登记不落台账事件（登记不构成任务完成依据）
    assert.equal(ledger.events().length, 0, "knowledge.register 是宿主侧执行面 op，不落台账事件");

    // 复核帽不得持该 op：帽信封调用即拒（op 不在 availableOps）
    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    const denied = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "k-hat",
      capability: hat.envelope,
      payload: { title: "帽登记", summary: "s", body: "b" }
    });
    assert.equal(denied.status, 403, JSON.stringify(denied.body));
    assert.equal(readIndex(home).length, 1, "拒绝路径零写入");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("knowledge.deprecate：命令化废弃腿——授权后走 host 执行，未接线/未授权一律 fail closed", async () => {
  const home = mkHome();
  try {
    const row = {
      botId: "bot-researcher", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-deprecate", at: Date.now()
    };
    mkdirSync(join(home, "bots", "started"), { recursive: true });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW });
    const issuer = createCapabilityIssuer({ dshHome: home, ledger, now: () => NOW });
    const access = createLedgerAccessKit({ issuer, postForBot: (botId) => (botId === "bot-researcher" ? "researcher" : null) });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} },
      authorizeCommand: access.authorize,
      knowledgeRegister: ({ op, payload, botId }) =>
        (op === "knowledge.deprecate"
          ? deprecateReport({ dshHome: home, id: payload.id, reason: payload.reason })
          : registerReport({ dshHome: home, botId, input: payload }))
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    const role = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    const seeded = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "d-0",
      capability: role.envelope, payload: { title: "将被废弃", summary: "s", body: "b" }
    });
    assert.equal(seeded.body.ok, true, seeded.body.reason);

    // 未携 capability → 403；废弃路径零写入
    const naked = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.deprecate", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "d-1",
      payload: { id: "R-2026-001", reason: "无授权尝试" }
    });
    assert.equal(naked.status, 403, JSON.stringify(naked.body));
    assert.equal(readIndex(home)[0].status, "valid", "未授权不得改状态");

    // 持角色能力 → 200，状态翻 deprecated 且旧痕迹保留
    const role2 = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    const ok = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.deprecate", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "d-2",
      capability: role2.envelope, payload: { id: "R-2026-001", reason: "被后续实测否定" }
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const entry = readIndex(home)[0];
    assert.equal(entry.status, "deprecated");
    assert.equal(entry.deprecatedReason, "被后续实测否定", "理由留痕");
    assert.equal(ledger.events().length, 0, "废弃腿同样不落台账事件");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("知识命令面未接线 → 503 fail closed（不得跳过鉴权直落盘）", async () => {
  const home = mkHome();
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} }
      // authorizeCommand / knowledgeRegister 均未接线
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };
    const res = await call(api, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-x" }, idempotencyKey: "u-1",
      payload: { title: "t", summary: "s", body: "b" }
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "knowledge-command-unwired");
    assert.equal(readIndex(home).length, 0, "未接线路径零写入");

    // 只接线执行面、缺鉴权面 → 同样 503（不得 fail-open 跳过鉴权）
    const host2 = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} },
      knowledgeRegister: () => ({ ok: true, id: "SHOULD-NOT-RUN" })
    });
    const api2 = { dshHome: home, ledgerHost: host2, ctx: { logger: { warn() {}, error() {}, info() {} } } };
    const res2 = await call(api2, "POST", "/api/bots/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-x" }, idempotencyKey: "u-2",
      payload: { title: "t", summary: "s", body: "b" }
    });
    assert.equal(res2.status, 503, "缺鉴权面不得放行（fail-open 即共享面裸写）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 探针失效承载（org-v2 14 号票 V-A6.7；规格 §H） ----------------

test("探针失效以 class=duty 例程任务落台账承载：不新增事件类型、随投影告知、重复失效不另开任务（V-A6.7）", async () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    const failure = { probeId: "P-CLIENT-SLOTS", face: "HF-CLIENT-SLOTS", reason: "槽名在 layout bundle 不在位" };
    const raised = await host.registerProbeFailure(failure);
    assert.equal(raised.ok, true, raised.reason);
    // 承载面＝class=duty 例程任务（§B：例程任务的判据可由健康探针或回归结果自动生成）
    const task = ledger.task(raised.taskId);
    assert.equal(task.class, "duty");
    assert.equal(task.routineId, "duty-probe-failure");
    assert.equal(task.status, "intake", "登记不改状态：处置任务立在待分诊处");
    // 失效本体＝既有异常事件（四类之内），不新增台账事件类型
    const events = ledger.events({ taskId: raised.taskId });
    const exception = events.find((event) => event.type === "exception");
    assert.ok(exception !== undefined, "失效本体落 exception 事件");
    assert.equal(exception.kind, "waiting-external", "宿主面失效＝等待外部依赖（异常四类之内）");
    assert.equal(exception.detail.probeId, failure.probeId);
    for (const event of ledger.events()) {
      assert.ok(EVENT_TYPES.includes(event.type), `${event.type} 不在封闭事件词表内（不得新增事件类型）`);
    }
    // 人间接口告知：通知＝事件投影（exception → user）
    assert.ok(
      ledger.notificationsAfter(0).notifications.some((note) => note.type === "exception" && note.to === "user"),
      "失效须按人间接口告知（投影可见）"
    );
    // 幂等：同一探针持续失效只开一张处置任务、同因重复只留一条异常
    const again = await host.registerProbeFailure(failure);
    assert.equal(again.taskId, raised.taskId);
    assert.equal(again.exceptionReplayed, true, "同因重复登记＝幂等重放");
    assert.equal(ledger.tasks().filter((entry) => entry.routineId === "duty-probe-failure").length, 1);
    // 换因（同一探针再次以不同原因失效）→ 同一处置任务上追加异常，不另开任务
    const other = await host.registerProbeFailure({ ...failure, reason: "令牌未注入" });
    assert.equal(other.taskId, raised.taskId);
    assert.equal(other.exceptionReplayed, false, "不同因＝新异常条目（非重放）");
    assert.equal(ledger.events({ taskId: raised.taskId }).filter((event) => event.type === "exception").length, 2);
    // 输入 fail closed：缺探针 id／缺面 id 即拒，不落任何事件
    const before = ledger.events().length;
    assert.equal((await host.registerProbeFailure({ face: "HF-X" })).code, "probe-failure-args");
    assert.equal((await host.registerProbeFailure({ probeId: "P-X" })).code, "probe-failure-args");
    assert.equal(ledger.events().length, before, "参数不合法＝零写入");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
