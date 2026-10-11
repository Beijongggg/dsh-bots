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
import { runHostContractProbe } from "../lib/org/host-contract.js";
import { createLedgerAccessKit } from "../lib/org/permissions.js";
import { RULING_ACTOR } from "../lib/org/human-inbox.js";
import { createTaskLedger, eventsFile, ledgerDir, EVENT_TYPES } from "../lib/org/task-ledger.js";
import { BOOTSTRAP_ANCHOR_POST } from "../lib/org/role-cards.js";
import { deprecateReport, readIndex, registerReport, reportsDirFor } from "../lib/knowledge.js";

const ledgerDirExists = (home) => existsSync(ledgerDir(home));
import { receiptsDirFor } from "../lib/mail-plane.js";
import { deadPid } from "./helpers/dead-pid-fixture.mjs";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";
import { ACCEPTANCE_RUNNER, criterionInjection } from "./helpers/criterion-fixture.mjs";
import { wireReviewHat } from "./helpers/capability-fixture.mjs";

/** 已有夹具的判据执行面：本组用例测的不是判据门，显式声明「判据面已接线」（25 号票）。 */
const CRITERION_INJECTION = Object.freeze(criterionInjection(ACCEPTANCE_RUNNER));

test("宿主巡检：FAIL 与运行面 SKIP 自动进入 duty 台账，重复结果只记一次（16 号票）", async () => {
  const home = mkHome();
  const ledger = createTaskLedger({ dshHome: home });
  const host = createLedgerHost({
    ledger,
    probeHostContract: async () => ({
      face: "deploy", results: [
        { probeId: "P-CONFIG-IDS", face: "HF-CONFIG-IDS", state: "FAIL", reason: "配置标记缺失" },
        { probeId: "P-CLIENT-SLOTS", face: "HF-CLIENT-SLOTS", state: "SKIP", reason: "槽位载体缺失" },
        { probeId: "P-RPC", face: "HF-RPC", state: "PASS" }
      ]
    })
  });
  try {
    await host.tick();
    const tasks = host.ledger.tasks();
    assert.equal(tasks.length, 2, "两处失效各有一张处置任务");
    assert.ok(tasks.every((task) => task.class === "duty"));
    assert.deepEqual(host.ledger.since(0).filter((event) => event.type === "exception")
      .map((event) => event.detail.probeId).sort(), ["P-CLIENT-SLOTS", "P-CONFIG-IDS"]);
    await host.tick();
    assert.equal(host.ledger.since(0).filter((event) => event.type === "exception").length, 2);
    assert.equal(host.ledger.notificationsAfter(0).notifications.filter((note) => note.type === "exception").length, 2);
  } finally {
    ledger.close();
    rmSync(home, { recursive: true, force: true });
  }
});

test("宿主巡检不可执行或报告畸形：响亮入账，下次巡检可恢复，租约扫描仍可用", async () => {
  const home = mkHome();
  const ledger = createTaskLedger({ dshHome: home });
  let unavailable = true;
  const host = createLedgerHost({
    ledger,
    probeHostContract: async () => {
      if (unavailable) throw new Error("探针子进程超时");
      return { face: "deploy", results: [] };
    }
  });
  try {
    await host.tick({ at: 0 });
    assert.equal(host.ledger.tasks().length, 1);
    assert.match(host.ledger.since(0).find((event) => event.type === "exception").detail.reason, /超时/);
    unavailable = false;
    await host.tick({ at: 10 * 60 * 1000 });
    const faults = host.ledger.since(0).filter((event) => event.type === "exception");
    assert.equal(faults.length, 2);
    assert.match(faults[1].detail.reason, /报告/);
  } finally {
    ledger.close();
    rmSync(home, { recursive: true, force: true });
  }
});

test("宿主巡检用独立子进程：零退出码的空报告不能放行，超时被终止并入账", async () => {
  const home = mkHome();
  const repoRoot = join(home, "source");
  mkdirSync(join(repoRoot, "scripts"), { recursive: true });
  const script = join(repoRoot, "scripts", "host-contract-probe.mjs");
  writeFileSync(script, `import {writeFileSync} from 'node:fs';
    const path=process.argv.find(arg=>arg.startsWith('--report=')).slice(9);
    writeFileSync(path, JSON.stringify({face:'deploy',gatePass:true,results:[],counts:{pass:0,fail:0,skip:0}}));`);
  const ledger = createTaskLedger({ dshHome: home });
  const host = createLedgerHost({ ledger,
    probeHostContract: () => runHostContractProbe({ repoRoot, dshHome: home, timeoutMs: 500 }) });
  try {
    await host.tick({ at: 0 });
    assert.match(host.ledger.since(0).find((event) => event.type === "exception").detail.reason, /报告/);
    writeFileSync(script, "setInterval(() => {}, 1000);");
    await host.tick({ at: 10 * 60 * 1000 });
    assert.match(host.ledger.since(0).filter((event) => event.type === "exception")[1].detail.reason, /超时/);
  } finally {
    ledger.close();
    rmSync(home, { recursive: true, force: true });
  }
});

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
      const exceptions = ledger.taskEvents(anomaly.taskId).filter((e) => e.type === "exception");
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
    const total = ledger.tasks().reduce((sum, task) => sum + ledger.taskEvents(task.taskId).filter((e) => e.type === "exception").length, 0);
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

    const empty = await call(api, "GET", "/api/pod/_ledger");
    assert.equal(empty.status, 200);
    assert.equal(empty.body.lastSeq, 0);
    assert.deepEqual(empty.body.tasks, []);

    const create = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000060", actor: { kind: "user", id: "user" },
      idempotencyKey: "h1", payload: { class: "project", brief: { ...VALID_BRIEF } }
    });
    assert.equal(create.status, 200);
    assert.equal(create.body.ok, true);
    assert.equal(create.body.status, "intake");
    assert.equal(frames.filter((f) => f.type === "ledger").length, 1, "命令写入后广播投影");

    // 非法转移：fail closed（409）但拒绝也进台账（可核）；user 通道可达命令面
    // （06 号票起 host kind 在 HTTP 被 403，见上一条回归）
    const rejected = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.close", taskId: "TK-00000060", actor: { kind: "user", id: "user" },
      expectedStatus: "intake", expectedSeq: 1, idempotencyKey: "h2", payload: {}
    });
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.ok, false);
    assert.equal(rejected.body.code, "illegal-transition");

    const tasks = await call(api, "GET", "/api/pod/_ledger/tasks");
    assert.equal(tasks.body.tasks.length, 1);
    assert.equal(tasks.body.tasks[0].status, "intake");

    const notes = await call(api, "GET", "/api/pod/_ledger/notifications?cursor=0");
    assert.equal(notes.status, 200);
    assert.deepEqual(notes.body.notifications, [], "intake 不产生通知（无事件不通知）");

    const wrongMethod = await call(api, "POST", "/api/pod/_ledger/tasks");
    assert.equal(wrongMethod.status, 405);

    const unwired = await call({ dshHome: home, ctx: { logger: { warn() {} } } }, "GET", "/api/pod/_ledger");
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

    const before = ledger.view().lastSeq;
    const inbox = await call(api, "GET", "/api/pod/_ledger/inbox?cursor=0");
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
    assert.equal(ledger.view().lastSeq, before, "投递面是只读投影：读不改台账");
    assert.equal(ledger.task("TK-00000095").status, "waiting-user");
    const wrongMethod = await call(api, "POST", "/api/pod/_ledger/inbox");
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
    await call(api, "GET", "/api/pod/_ledger");
    await call(api, "GET", "/api/pod/_ledger/tasks");
    await call(api, "GET", "/api/pod/_ledger/notifications?cursor=0");
    assert.equal(ledger.view().lastSeq, 0, "只读请求不得写入事实源");
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
  const previousAutostart = process.env.POD_AUTOSTART;
  process.env.DSH_HOME = home;
  process.env.POD_AUTOSTART = "0"; // 应急闸：接线测试不拉起真实 bot 进程
  const applied = [];
  const mkCtx = (baseUrl) => ({
    baseUrl,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    effect: (fn, name) => { applied.push(name); return () => {}; },
    // bot 分支三面（提示段/知识库/岗位工具）经 inject 等待服务就绪（16 号票
    // ptc-r2）；本测试的合成 ctx 无宿主服务——挂起等待＝永不触发，与无该服务
    // 宿主的跳过语义一致。
    inject: (names, cb) => { applied.push(`pod: 等待服务 ${names.join("+")}`); },
    get: () => undefined
  });
  try {
    // 宿主（主 web，profile=web）→ 注册台账值守；台账域此时无写入（写锁惰性获取）
    const { apply } = await import("../lib/index.js");
    await apply(mkCtx("file:///tmp/profiles/web/"));
    assert.ok(applied.includes("pod: 台账值守（租约回收＋异常汇入＋写锁释放）"), "宿主须注册台账值守");
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
    if (previousAutostart === undefined) delete process.env.POD_AUTOSTART; else process.env.POD_AUTOSTART = previousAutostart;
    rmSync(home, { recursive: true, force: true });
  }
});

test("HTTP 命令面拒绝缺 actor 的命令且台账保持可读（写入前校验，防事实源被写坏）；host 冒名被通道策略拒（06 号票）", async () => {
  const home = mkHome();
  try {
    const { ledger, host } = mkHost(home);
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };
    await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000080", actor: { kind: "user", id: "user" },
      idempotencyKey: "k1", payload: { class: "project", brief: { ...VALID_BRIEF } }
    });
    // 通道策略（06 号票）：HTTP 上不得声明 kind=host（进程内身份）
    const hostImpersonation = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.triage", taskId: "TK-00000080", actor: { kind: "host", id: "web" },
      idempotencyKey: "k0", expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" }
    });
    assert.equal(hostImpersonation.status, 403);
    assert.equal(hostImpersonation.body.code, "host-channel-forbidden");
    const noActor = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.judge", taskId: "TK-00000080", idempotencyKey: "k2", payload: { intent: "x" }
    });
    assert.equal(noActor.status, 409);
    assert.equal(noActor.body.code, "invalid-actor");
    // 事实源未被写坏：投影仍可读、可继续推进
    const after = await call(api, "GET", "/api/pod/_ledger");
    assert.equal(after.status, 200);
    assert.equal(after.body.tasks[0].status, "intake");
    const badBody = await call(api, "POST", "/api/pod/_ledger/commands", "not-an-object");
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
    const result = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000083", actor: { kind: "user", id: "user" },
      capability: envelope, idempotencyKey: "k1", payload: { class: "project" }
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.via, "dispatcher", "接线了 dispatcher 就不得直落裸命令面");
    assert.deepEqual(seen[0].capability, envelope, "信封必须原样透传给鉴权面");
    assert.equal(ledger.view().lastSeq, 0, "dispatcher 接管时裸命令面未被调用");
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
    // 实例行（活 pid＝本进程）＋签发面＋复核面 gate 全真接线（27 号票：同一签发面
    // 也给台账腿——报告入账的权威门与唯一消费点在台账，通道门只做入口预筛）
    const row = {
      botId: "bot-reviewer", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-reviewer", at: Date.now()
    };
    mkdirSync(join(home, "bots", "started"), { recursive: true });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
    const { issuer, ledger } = wireReviewHat({
      home, now: () => NOW, ledgerOptions: { ...CRITERION_INJECTION }
    });
    const reviewGate = createReviewFaceGate({ issuer, ledger });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} }, reviewGate, issuer
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    // 任务（简报带复核点）＋复核请求
    const created = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000070", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvh-intake", payload: {
        class: "project", brief: { ...VALID_BRIEF, reviewPoints: ["before-external-visibility"] }
      }
    });
    assert.equal(created.body.ok, true);
    const requested = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "review.request", taskId: "TK-00000070", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvh-request", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
    });
    assert.equal(requested.body.ok, true, requested.body.reason);

    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    assert.equal(hat.ok, true, hat.reason);
    const hatHeader = JSON.stringify(hat.envelope);

    // 未携帽读移交件 → 403（fail closed）
    const naked = await call(api, "GET", "/api/pod/_ledger/review-handoff?taskId=TK-00000070");
    assert.equal(naked.status, 403);
    assert.equal(naked.body.code, "capability-malformed", "未携帽＝信封缺格，验签腿 fail closed");

    // 携帽读 → 200，移交件含冻结简报与指定关系、不含判断输入
    const handoff = await call(api, "GET", "/api/pod/_ledger/review-handoff?taskId=TK-00000070", null, {
      "x-pod-bot-id": "bot-reviewer",
      "x-pod-capability": hatHeader
    });
    assert.equal(handoff.status, 200);
    assert.equal(handoff.body.taskId, "TK-00000070");
    assert.equal(handoff.body.requests[0].reviewer, "bot-reviewer");
    assert.deepEqual(handoff.body.brief.reviewPoints, ["before-external-visibility"]);

    // 携帽报 closed → 200＋续签帽；上浮不触发（一轮闭合）
    const reportBody = {
      taskId: "TK-00000070", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvh-report",
      capability: hat.envelope,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    };
    const reported = await call(api, "POST", "/api/pod/_ledger/reviews", reportBody);
    assert.equal(reported.status, 200);
    assert.equal(reported.body.ok, true);
    assert.equal(reported.body.escalated, false);
    assert.equal(reported.body.capability?.payload?.post, "verifier", "响应携带续签帽（链式）");

    // 同键缓存成功不代表本次消费。旧帽反复重放、新帽重放都不能增发帽或追加事件。
    const afterReport = ledger.view().lastSeq;
    for (const capability of [hat.envelope, hat.envelope, reported.body.capability]) {
      const replay = await call(api, "POST", "/api/pod/_ledger/reviews", { ...reportBody, capability });
      assert.equal(replay.status, 200);
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.capability === undefined, true, "缓存成功的重放不重签帽");
    }
    assert.equal(ledger.view().lastSeq, afterReport, "同键重放零追加事件");
    const nextReport = await call(api, "POST", "/api/pod/_ledger/reviews", {
      ...reportBody, idempotencyKey: "rvh-report-next", capability: reported.body.capability
    });
    assert.equal(nextReport.status, 200, "重放没有烧掉新帽，新键提交仍可正常消费并续签");
    assert.equal(nextReport.body.capability?.payload?.post, "verifier");

    // 他人冒用帽 → 403（信封属 bot-reviewer）
    const impostor = await call(api, "POST", "/api/pod/_ledger/reviews", {
      taskId: "TK-00000070", actor: { kind: "post", id: "bot-other" }, idempotencyKey: "rvh-bad",
      capability: hat.envelope,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "m" }
    });
    assert.equal(impostor.status, 403);
    assert.equal(impostor.body.code, "capability-bot-mismatch");

    // 通知投影：复核请求送达指定复核者
    const notes = await call(api, "GET", "/api/pod/_ledger/notifications?cursor=0");
    assert.ok(notes.body.notifications.some((n) => n.type === "review-requested" && n.to === "bot-reviewer"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("复核移交件读（16 号票 rv1 blocker）：归属让渡（owner=null）后产出方登记的工件仍可读，他人登记不出现", async () => {
  const home = mkHome();
  try {
    const row = {
      botId: "bot-reviewer", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-reviewer", at: Date.now()
    };
    mkdirSync(join(home, "bots", "started"), { recursive: true });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify({
      botId: "bot-producer", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-producer", at: Date.now()
    })}\n`, { flag: "a" });
    const { issuer, ledger } = wireReviewHat({
      home, now: () => NOW, ledgerOptions: { ...CRITERION_INJECTION }
    });
    const reviewGate = createReviewFaceGate({ issuer, ledger });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} }, reviewGate, issuer
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    // 真实链到 produced，随后实例死亡 → sweep 回收：归属清空、任务回 planned
    // （真实面 TK-20260929 seq 22→31 场景：产出已登记，复核发生在 owner=null 窗口）
    const USER = { kind: "user", id: "user" };
    const PRODUCER = { kind: "post", id: "bot-producer" };
    await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000071", actor: USER, idempotencyKey: "hnd-intake",
      payload: { class: "project", brief: { ...VALID_BRIEF, reviewPoints: ["before-external-visibility"] } }
    });
    for (const [op, actor, payload, key] of [
      ["task.triage", USER, { decision: "立项" }, "hnd-triage"],
      ["task.plan", USER, {}, "hnd-plan"],
      ["task.assign", USER, { assignee: "bot-producer" }, "hnd-assign"],
      ["task.accept", PRODUCER, {}, "hnd-accept"],
      ["task.start", PRODUCER, {}, "hnd-start"],
      ["task.report", PRODUCER, {}, "hnd-report"]
    ]) {
      const task = ledger.task("TK-00000071");
      const step = await call(api, "POST", "/api/pod/_ledger/commands", {
        op, taskId: "TK-00000071", actor, expectedStatus: task.status, expectedSeq: task.lastSeq,
        idempotencyKey: key, payload
      });
      assert.equal(step.body.ok, true, `${op}: ${step.body.reason}`);
    }
    await ledger.sweep({ isInstanceAlive: () => false });
    const reclaimed = ledger.task("TK-00000071");
    assert.equal(reclaimed.owner, null, "租约回收清当前归属");
    assert.equal(reclaimed.producer, "bot-producer", "产出方保留为历史事实");

    // 产出方登记（锚本任务）＋他人登记（同锚）：只有产出方条目进移交件面
    const mine = registerReport({
      dshHome: home, botId: "bot-producer",
      input: { title: "本任务产出", summary: "s", body: "b", task: "TK-00000071" }
    });
    const theirs = registerReport({
      dshHome: home, botId: "someone-else",
      input: { title: "他人产出", summary: "s", body: "b", task: "TK-00000071" }
    });
    assert.equal((await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "review.request", taskId: "TK-00000071", actor: USER, idempotencyKey: "hnd-request",
      payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
    })).body.ok, true);

    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    assert.equal(hat.ok, true, hat.reason);
    const hatHeaders = { "x-pod-bot-id": "bot-reviewer", "x-pod-capability": JSON.stringify(hat.envelope) };

    // 产出方不得自任（spec §C 独立性；第三道门同口径）：归属已让渡，产出方本人仍不得
    // 被指定为复核者、也不得以 verifier 帽给自己的产出入账报告
    const selfReview = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "review.request", taskId: "TK-00000071", actor: USER, idempotencyKey: "hnd-self-request",
      payload: { point: "before-external-visibility", reviewer: "bot-producer" }
    });
    assert.equal(selfReview.body.code, "reviewer-is-producer", "产出方按历史事实判，不按易变归属漏过");
    const selfHat = issuer.issueRoleCapability({ botId: "bot-producer", post: "verifier" });
    assert.equal(selfHat.ok, true, selfHat.reason);
    // 报告腿的独立性门是台账权威门（HTTP 通道对非指定者另有先拒；进程内直调绕不过此门）
    const selfReport = await ledger.recordReviewReport({
      taskId: "TK-00000071", reviewer: "bot-producer",
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "m" },
      capability: selfHat.envelope, idempotencyKey: "hnd-self-report"
    });
    assert.equal(selfReport.code, "reviewer-is-producer", "报告腿同判：产出方自任在 reviewer-is-producer 拒");

    const handoff = await call(api, "GET", "/api/pod/_ledger/review-handoff?taskId=TK-00000071", null, hatHeaders);
    assert.equal(handoff.status, 200);
    assert.ok(handoff.body.artifacts.some((entry) => entry.id === mine.id),
      "归属让渡后产出方登记的工件仍出现在移交件列表（rv1 blocker 修复）");
    assert.equal(handoff.body.artifacts.some((entry) => entry.id === theirs.id), false, "他人登记不出现");

    const body = await call(api, "GET",
      `/api/pod/_ledger/review-handoff?taskId=TK-00000071&artifactId=${encodeURIComponent(mine.id)}`, null, hatHeaders);
    assert.equal(body.status, 200, "产出方工件正文可读");
    assert.equal(body.body.artifact.id, mine.id);
    assert.equal(typeof body.body.artifact.sha256, "string");
    const theirsBody = await call(api, "GET",
      `/api/pod/_ledger/review-handoff?taskId=TK-00000071&artifactId=${encodeURIComponent(theirs.id)}`, null, hatHeaders);
    assert.equal(theirsBody.status, 403, "他人工件仍拒（review-artifact-forbidden）");
    assert.equal(theirsBody.body.code, "review-artifact-forbidden");
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
    const { issuer, ledger } = wireReviewHat({
      home, now: () => NOW, ledgerOptions: { ...CRITERION_INJECTION }
    });
    const reviewGate = createReviewFaceGate({ issuer, ledger });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} }, reviewGate, issuer
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000071", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvr-intake", payload: {
        class: "project", brief: { ...VALID_BRIEF, reviewPoints: ["before-external-visibility"] }
      }
    });
    const requested = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "review.request", taskId: "TK-00000071", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvr-request", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
    });
    assert.equal(requested.body.ok, true, requested.body.reason);

    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    assert.equal(hat.ok, true, hat.reason);

    // 入口预筛通过（被指定），但台账腿拒绝：subject 未在本任务登记复核请求
    const rejectedBody = {
      taskId: "TK-00000071", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvr-bad",
      capability: hat.envelope,
      report: { subject: "before-irreversible-write", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    };
    const rejected = await call(api, "POST", "/api/pod/_ledger/reviews", rejectedBody);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.code, "review-not-requested");
    assert.equal(rejected.body.capability?.payload?.post, "verifier",
      "预筛通过（帽腿已过、已被台账腿消费）而报告被拒：同样续签帽，否则复核者连报即断链");

    const afterRejection = ledger.view().lastSeq;
    for (const capability of [hat.envelope, hat.envelope, rejected.body.capability]) {
      const replay = await call(api, "POST", "/api/pod/_ledger/reviews", { ...rejectedBody, capability });
      assert.equal(replay.status, 409);
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.code, "review-not-requested");
      assert.equal(replay.body.capability === undefined, true, "缓存拒绝带 authorized 也不得重复签帽");
    }
    assert.equal(ledger.view().lastSeq, afterRejection, "拒绝结果的重放也不再落事件");

    // 续签帽可连报：换合法 subject 提交即 200（链式接力）
    const reported = await call(api, "POST", "/api/pod/_ledger/reviews", {
      taskId: "TK-00000071", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvr-ok",
      capability: rejected.body.capability,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(reported.status, 200, reported.body.reason);
    assert.equal(reported.body.ok, true);

    // 边界：入口预筛自身拒绝（无帽）不给新帽——鉴权失败不续签
    const naked = await call(api, "POST", "/api/pod/_ledger/reviews", {
      taskId: "TK-00000071", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvr-naked",
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(naked.status, 403);
    assert.equal(naked.body.capability, undefined, "未过预筛：不续签（越权不换新信封）");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("复核面消费点在台账腿（27 号票）：同一信封二次提交即 capability-replayed；入口预筛不消费帽", async () => {
  const home = mkHome();
  try {
    const row = {
      botId: "bot-reviewer", pid: process.pid, startedAt: `proc:${process.pid}`,
      hostInstanceId: "gen-reviewer", at: Date.now()
    };
    mkdirSync(join(home, "bots", "started"), { recursive: true });
    writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
    const { issuer, ledger } = wireReviewHat({
      home, now: () => NOW, ledgerOptions: { ...CRITERION_INJECTION }
    });
    const reviewGate = createReviewFaceGate({ issuer, ledger });
    const host = createLedgerHost({
      ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
      logger: { warn() {}, info() {} }, reviewGate, issuer
    });
    const api = { dshHome: home, ledgerHost: host, ctx: { logger: { warn() {}, error() {}, info() {} } } };

    await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "task.intake", taskId: "TK-00000072", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvp-intake", payload: {
        class: "project", brief: { ...VALID_BRIEF, reviewPoints: ["before-external-visibility"] }
      }
    });
    assert.equal((await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "review.request", taskId: "TK-00000072", actor: { kind: "user", id: "user" },
      idempotencyKey: "rvp-request", payload: { point: "before-external-visibility", reviewer: "bot-reviewer" }
    })).body.ok, true);

    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    assert.equal(hat.ok, true, hat.reason);
    // 入口预筛拒（无帽）不消费任何帽：同一张帽随后照常提交成功
    const naked = await call(api, "POST", "/api/pod/_ledger/reviews", {
      taskId: "TK-00000072", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvp-naked",
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(naked.status, 403);
    const reported = await call(api, "POST", "/api/pod/_ledger/reviews", {
      taskId: "TK-00000072", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvp-ok",
      capability: hat.envelope,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(reported.status, 200, reported.body.reason);
    assert.equal(reported.body.ok, true);

    // 一次提交恰好消费一次：同一信封重放——预筛仍放行（它不消费），台账腿的消费点拒
    const replay = await call(api, "POST", "/api/pod/_ledger/reviews", {
      taskId: "TK-00000072", actor: { kind: "post", id: "bot-reviewer" }, idempotencyKey: "rvp-replay",
      capability: hat.envelope,
      report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "review-model" }
    });
    assert.equal(replay.status, 409);
    assert.equal(replay.body.code, "capability-replayed");
    assert.equal(replay.body.capability, undefined,
      "已消费信封的重放拒绝发生在帽腿之前：不续签（否则一张旧帽可无限换新帽）");
    assert.equal(ledger.taskEvents("TK-00000072").filter((e) => e.type === "review-reported").length, 1,
      "重放不得落第二条复核报告");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------- 知识登记命令化 HTTP（org-v2 10 号票 V-A4.5） ----------------

/**
 * 知识命令腿夹具（30 号票）：与「knowledge.register 命令化」用例同一装配——在册实例行、
 * 台账、签发器、鉴权装配件、宿主接线（登记执行体落临时 DSH_HOME）。形状门用例与既有
 * 用例共用一份装配，避免第三份手抄（装配漂移＝用例间口径分叉）。
 */
function mkKnowledgeHost(home, { logger = { warn() {}, error() {}, info() {} } } = {}) {
  const row = {
    botId: "bot-researcher", pid: process.pid, startedAt: `proc:${process.pid}`,
    hostInstanceId: "gen-knowledge-gate", at: Date.now()
  };
  mkdirSync(join(home, "bots", "started"), { recursive: true });
  writeFileSync(instanceRegistryFile(home), `${JSON.stringify(row)}\n`, { flag: "a" });
  const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home, now: () => NOW });
  const issuer = createCapabilityIssuer({ dshHome: home, ledger, now: () => NOW });
  const access = createLedgerAccessKit({ issuer, postForBot: (botId) => (botId === "bot-researcher" ? "researcher" : null) });
  const host = createLedgerHost({
    ledger, now: () => NOW, readBotIds: () => [], isAlive: () => true, broadcast: () => {},
    logger,
    authorizeCommand: access.authorize,
    // 与 lib/index.js 生产装配同形（36 号票 A9 起执行体带 logger）：索引锁争用
    // 留痕经宿主 logger 出栈；夹具拷贝漂移＝用例与实际接线口径分叉。
    knowledgeRegister: ({ op, payload, botId }) =>
      (op === "knowledge.deprecate"
        ? deprecateReport({ dshHome: home, id: payload.id, reason: payload.reason, logger })
        : registerReport({ dshHome: home, botId, input: payload, logger }))
  });
  const api = { dshHome: home, ledgerHost: host, ctx: { logger } };
  return { ledger, issuer, access, host, api };
}

test("knowledge.register 命令腿：索引锁留痕经宿主 logger 出栈（36 号票 A9）", async () => {
  const home = mkHome();
  try {
    const warns = [];
    const { issuer, api } = mkKnowledgeHost(home, { logger: { warn: (line) => warns.push(line) } });
    const role = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    assert.equal(role.ok, true, role.reason);

    // 死主锁：.lock 持有者 pid 已不存在 → 快路接管并留痕（宿主事件循环不再为其冻结）
    const lockDir = join(home, "bots", "knowledge", ".lock");
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, "owner.json"), JSON.stringify({ pid: deadPid(), at: Date.now() }));

    const ok = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "k-trace",
      capability: role.envelope, payload: { title: "留痕", summary: "s", body: "b" }
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.ok, true);
    assert.equal(warns.length, 1, "接管恰留一行（留痕随宿主日志，不落新文件面）");
    assert.ok(warns[0].includes("lockId=knowledge-index") && warns[0].includes("takeover=1") && warns[0].includes("outcome=acquired"),
      warns[0]);
    assert.equal(readIndex(home).length, 1, "接管后登记照常落盘");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("知识命令腿 actor 形状门：无 actor／畸形 actor 一律拒（与台账 invalid-actor 同源；零落盘、不消耗信封）", async () => {
  const home = mkHome();
  try {
    const { issuer, api } = mkKnowledgeHost(home);
    const role = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    assert.equal(role.ok, true, role.reason);

    // 形状负例（每次**随体携带一张活信封**——负例若走到鉴权门就会烧掉它）
    const malformed = [
      ["缺 actor", undefined],
      ["actor=null", null],
      ["空对象", {}],
      ["user 无 id", { kind: "user" }],
      ["user 空 id", { kind: "user", id: "" }],
      ["post 无 id", { kind: "post" }],
      ["未知 kind", { kind: "agent", id: "bot-researcher" }]
    ];
    for (const [label, actor] of malformed) {
      const res = await call(api, "POST", "/api/pod/_ledger/commands", {
        op: "knowledge.register", actor, idempotencyKey: `k-shape-${label}`, capability: role.envelope,
        payload: { title: "形状负例", summary: "s", body: "b" }
      });
      assert.equal(res.status, 403, `${label}：${JSON.stringify(res.body)}`);
      assert.equal(res.body.code, "invalid-actor",
        `${label}：形状门与台账结构性拒绝同码（同源 isValidActor）——实得 ${String(res.body.code)}`);
    }
    assert.equal(readIndex(home).length, 0, "形状负例零落盘（共享面无写入）");

    // 已知通道策略不回退：host 仍由通道层拦（码不变）
    const hostActor = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "host", id: "web" }, idempotencyKey: "k-shape-host",
      payload: { title: "host 冒名", summary: "s", body: "b" }
    });
    assert.equal(hostActor.status, 403);
    assert.equal(hostActor.body.code, "host-channel-forbidden", "host 冒名结论码不变（通道策略先拦）");

    // 不消耗：形状门在鉴权门**之前**——同一张信封随后照常可用（正例不回退）
    const ok = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "k-shape-after",
      capability: role.envelope, payload: { title: "形状负例之后", summary: "s", body: "b" }
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(readIndex(home).length, 1, "信封未被形状负例消耗");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("知识命令腿 actor 归属门：user 只许声明 user principal 本人，他人 id 即伪造归属（user 正例不回退）", async () => {
  const home = mkHome();
  try {
    const { issuer, api } = mkKnowledgeHost(home);

    // 伪造归属：user 自声明**在册实例**的 id（索引 botId 字段是产出方归属，不由调用方指定）
    const role = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    const forged = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "user", id: "bot-researcher" }, idempotencyKey: "k-spoof",
      capability: role.envelope, payload: { title: "冒名登记", summary: "s", body: "b" }
    });
    assert.equal(forged.status, 403, JSON.stringify(forged.body));
    assert.equal(forged.body.code, "knowledge-actor-spoof",
      "user 声明非本人 id＝伪造产出方归属（照 11 号票 mail 面 spoof 语义与命名）");
    assert.equal(readIndex(home).length, 0, "伪造归属零落盘");

    // user principal 本人（CSRF 通道的唯一 user 身份）照常可登记：产出方记 principal 本人
    const mine = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.register", actor: { ...RULING_ACTOR }, idempotencyKey: "k-user",
      payload: { title: "人间登记", summary: "s", body: "b" }
    });
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.equal(readIndex(home).length, 1);
    assert.equal(readIndex(home)[0].botId, RULING_ACTOR.id, "产出方＝user principal 本人");

    // 废弃腿同门（同一拦截腿两 op）：伪造归属在废弃腿同样拒、且不改状态
    const deprecated = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.deprecate", actor: { kind: "user", id: "bot-researcher" }, idempotencyKey: "k-spoof-dep",
      payload: { id: readIndex(home)[0].id, reason: "冒名废弃" }
    });
    assert.equal(deprecated.status, 403, JSON.stringify(deprecated.body));
    assert.equal(deprecated.body.code, "knowledge-actor-spoof");
    assert.equal(readIndex(home)[0].status, "valid", "伪造归属的废弃尝试不得改状态");

    // user principal 本人在废弃腿同样成立（正例覆盖两 op：register 与 deprecate）
    const mineDeprecate = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.deprecate", actor: { ...RULING_ACTOR }, idempotencyKey: "k-user-dep",
      payload: { id: readIndex(home)[0].id, reason: "人间废弃" }
    });
    assert.equal(mineDeprecate.status, 200, JSON.stringify(mineDeprecate.body));
    assert.equal(readIndex(home)[0].status, "deprecated");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("knowledge.register 命令化：授权过的岗位实例经 host 执行登记（bot 侧无直写通道）", async () => {
  const home = mkHome();
  try {
    const { ledger, issuer, api } = mkKnowledgeHost(home);

    // 未携 capability → 403（fail closed；不因「登记是轻动作」而放行）
    const naked = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "k-naked",
      payload: { title: "裸登记", summary: "s", body: "b" }
    });
    assert.equal(naked.status, 403, JSON.stringify(naked.body));
    assert.equal(readIndex(home).length, 0, "未授权不得落盘");

    // 持岗位角色能力 → 200 且索引落一行（写者＝host 进程）
    const role = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    assert.equal(role.ok, true, role.reason);
    const ok = await call(api, "POST", "/api/pod/_ledger/commands", {
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
    assert.equal(ledger.view().lastSeq, 0, "knowledge.register 是宿主侧执行面 op，不落台账事件");

    // 复核帽不得持该 op：帽信封调用即拒（op 不在 availableOps）
    const hat = issuer.issueRoleCapability({ botId: "bot-reviewer", post: "verifier" });
    const denied = await call(api, "POST", "/api/pod/_ledger/commands", {
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
    const { ledger, issuer, api } = mkKnowledgeHost(home);

    const role = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    const seeded = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.register", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "d-0",
      capability: role.envelope, payload: { title: "将被废弃", summary: "s", body: "b" }
    });
    assert.equal(seeded.body.ok, true, seeded.body.reason);

    // 未携 capability → 403；废弃路径零写入
    const naked = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.deprecate", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "d-1",
      payload: { id: "R-2026-001", reason: "无授权尝试" }
    });
    assert.equal(naked.status, 403, JSON.stringify(naked.body));
    assert.equal(readIndex(home)[0].status, "valid", "未授权不得改状态");

    // 持角色能力 → 200，状态翻 deprecated 且旧痕迹保留
    const role2 = issuer.issueRoleCapability({ botId: "bot-researcher", post: "researcher" });
    const ok = await call(api, "POST", "/api/pod/_ledger/commands", {
      op: "knowledge.deprecate", actor: { kind: "post", id: "bot-researcher" }, idempotencyKey: "d-2",
      capability: role2.envelope, payload: { id: "R-2026-001", reason: "被后续实测否定" }
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const entry = readIndex(home)[0];
    assert.equal(entry.status, "deprecated");
    assert.equal(entry.deprecatedReason, "被后续实测否定", "理由留痕");
    assert.equal(ledger.view().lastSeq, 0, "废弃腿同样不落台账事件");
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
    const res = await call(api, "POST", "/api/pod/_ledger/commands", {
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
    const res2 = await call(api2, "POST", "/api/pod/_ledger/commands", {
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
    const events = ledger.taskEvents(raised.taskId);
    const exception = events.find((event) => event.type === "exception");
    assert.ok(exception !== undefined, "失效本体落 exception 事件");
    assert.equal(exception.kind, "waiting-external", "宿主面失效＝等待外部依赖（异常四类之内）");
    assert.equal(exception.detail.probeId, failure.probeId);
    for (const event of ledger.since(0)) {
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
    assert.equal(ledger.taskEvents(raised.taskId).filter((event) => event.type === "exception").length, 2);
    // 输入 fail closed：缺探针 id／缺面 id 即拒，不落任何事件
    const before = ledger.view().lastSeq;
    assert.equal((await host.registerProbeFailure({ face: "HF-X" })).code, "probe-failure-args");
    assert.equal((await host.registerProbeFailure({ probeId: "P-X" })).code, "probe-failure-args");
    assert.equal(ledger.view().lastSeq, before, "参数不合法＝零写入");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
