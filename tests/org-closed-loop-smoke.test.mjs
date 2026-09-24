/**
 * 最小闭环烟测（org-v2 14 号票；规格 §I「切换点判据第 4 条」／§B／附录 A 执行坐标）。
 *
 * 一条任务在**仓内**真正跑完全链：收单 → 派单 → 实施 → 复核帽 → 结算（关闭）。
 * 全程走**真接口**（HTTP 台账命令面／复核面、真 capability 签发与鉴权三元组、
 * 真台账落盘与事件投影），只把「实例」注入成注册表行与时钟——所以它证明的是
 * 「五段骨架＋投影」这一层，不证明「实例真的在干活」（真实例/真模型不在仓内）。
 *
 * 断言的判据（A 组坐标落点属本模块的那几条，逐条见各用例名）：
 *   - `V-A2.1` 台账＝单一写者的事件日志；bot 无直写通道 → 全链只经命令面写入
 *   - `V-A2.2` 状态为事件投影：换一个只读事件文件的台账门面，投影与在跑的一致
 *   - `V-A2.3` 主干十态顺序贯通（`MAIN_FLOW` 全序列在链上出现过，终态 `closed`）
 *   - `V-A2.7` 必审拦截：复核点未闭合时交付被拒（交付即跨对外边界）
 *   - `V-A2.12` 通知＝台账事件投影（含「无事件不通知」）
 *   - `V-A1.3` 复核帽由当次空闲实例佩戴：选择器排除产出方、台账腿复验空闲
 *   - `V-A2.9` 关闭不可重开（终态只读）
 *   - §B 关闭前置：命中复核点已闭合 ＋ 产出已按「谁产出谁登记」登记
 *
 * 只测外部行为：HTTP 状态码与响应体、台账事件与投影、通知投影；不 spawn 进程、
 * 不触真实 `~/.dsh`（夹具全在临时数据根）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { internals } from "../lib/index.js";
import { createTaskLedger, eventsFile, MAIN_FLOW, EVENT_TYPES, projectEvents } from "../lib/org/task-ledger.js";
import { createCapabilityIssuer } from "../lib/org/capability-issue.js";
import { createLedgerAccessKit, createLedgerCommandDispatcher } from "../lib/org/permissions.js";
import { createLedgerHost } from "../lib/org/ledger-host.js";
import { createReviewFaceGate, selectReviewer } from "../lib/org/review-kit.js";
import { criterionRunnerInjection } from "../lib/org/criterion-runner.js";
import { registerReport, reportsDirFor } from "../lib/knowledge.js";
import { clockAt, writeInstanceRow } from "./helpers/capability-fixture.mjs";
import { VALID_BRIEF } from "./helpers/brief-fixture.mjs";

const { handleApi } = internals;

const HOMES = [];
process.on("exit", () => {
  for (const home of HOMES) rmSync(home, { recursive: true, force: true });
});

function mkHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-closed-loop-"));
  HOMES.push(home);
  return home;
}

// ---------------- HTTP 面调用件（与 tests/ledger-host.test.mjs 同形） ----------------

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
  const res = makeRes();
  await handleApi(makeReq(method, url, body, headers), res, api);
  let parsed = res.body;
  try { parsed = JSON.parse(res.body); } catch { /* 原始文本 */ }
  return { status: res.status, body: parsed };
}

// ---------------- 装具：真台账＋真签发＋真 dispatch＋真复核帽门 ----------------

const TASK_ID = "TK-00000014";
/**
 * 夹具简报：交付坐标＝知识登记落盘的报告文件（**任务自己产出的坐标**），验收判据就
 * 检查该坐标含报告正文——25 号票起关闭前置会在关闸时**真跑**这条判据，故夹具必须
 * 给出真能跑过的坐标（旧夹具指向 `docs/x.md`，那是永远跑不过的死判据）。
 */
const PRODUCED_LOCATION = "bots/knowledge/reports/R-2026-001.md";
const BRIEF = Object.freeze({
  ...VALID_BRIEF,
  deliverables: [{ format: "markdown", location: PRODUCED_LOCATION }],
  acceptance: [{ probe: "fs.contains", args: { location: PRODUCED_LOCATION, text: "闭环跑通" } }],
  reviewPoints: ["before-external-visibility"]
});
const POSTS = Object.freeze({ implementer: "implementer", "project-lead": "project-lead", verifier: "verifier" });

function mkRig() {
  const clock = clockAt(Date.parse("2026-09-20T09:00:00.000Z"));
  const home = mkHome();
  for (const botId of Object.keys(POSTS)) writeInstanceRow(home, botId);
  const logger = { warn() {}, info() {}, error() {} };
  const postForBot = (botId) => POSTS[botId] ?? null;
  const issuer = createCapabilityIssuer({ dshHome: home, now: clock.now });
  const access = createLedgerAccessKit({ issuer, postForBot, logger });
  const ledger = createTaskLedger({
    dshHome: home, now: clock.now, authorize: access.authorize,
    // 复核报告的帽验签（27 号票）：台账腿＝权威门＋唯一消费点（烟测须真持帽提交）
    reviewHat: issuer,
    ...criterionRunnerInjection({ cwd: join(dirname(new URL(import.meta.url).pathname), "..") })
  });
  issuer.bindLedger(ledger); // 吊销投影腿绑同一门面（构造顺序解耦）
  const dispatcher = createLedgerCommandDispatcher({ ledger, issuer, postForBot, logger });
  const frames = [];
  const host = createLedgerHost({
    ledger, dispatchCommand: dispatcher, now: clock.now,
    readBotIds: () => Object.keys(POSTS), isAlive: () => true,
    broadcast: (type, data) => frames.push({ type, data }),
    logger,
    reviewGate: createReviewFaceGate({ issuer, ledger }),
    issuer,
    authorizeCommand: access.authorize,
    // 宿主侧执行面：知识登记在 host 进程内落盘（bot 侧零直写；V-A4.5）
    knowledgeRegister: ({ payload, botId }) => registerReport({ dshHome: home, botId, input: payload })
  });
  const api = { dshHome: home, ledgerHost: host, ctx: { logger } };
  return { clock, home, ledger, issuer, host, api, frames };
}

/** 岗位实例持一张**当次签发的角色能力**（role-cap 分发通道归 07/13 票留界，此处按宿主签发面直接签）。 */
function roleCap(issuer, botId) {
  const issued = issuer.issueRoleCapability({ botId, post: POSTS[botId] });
  assert.equal(issued.ok, true, `角色能力签发失败：${issued.reason}`);
  return issued.envelope;
}

const USER = { kind: "user", id: "user" };
const POST = (id) => ({ kind: "post", id });

/**
 * 跑一次完整闭环（**单次真跑**，各用例共享这一跑的产物——烟测的语义就是「跑一次」）。
 * 返回链上每一步的回执，供逐段断言。
 */
async function runClosedLoop() {
  const rig = mkRig();
  const { home, ledger, issuer, api } = rig;
  const steps = {};
  const command = async (name, body) => {
    const res = await call(api, "POST", "/api/bots/_ledger/commands", body);
    steps[name] = res;
    return res;
  };

  // ① 收单（人间面）：用户下单＝四要素简报预登记（含必审点）
  await command("intake", {
    op: "task.intake", taskId: TASK_ID, actor: USER, idempotencyKey: "loop-intake",
    payload: { class: "project", brief: { ...BRIEF } }
  });
  // ② 分诊（值班统筹）与立项（派单方）
  await command("triage", {
    op: "task.triage", taskId: TASK_ID, actor: USER, idempotencyKey: "loop-triage",
    expectedStatus: "intake", expectedSeq: 1, payload: { decision: "立项" }
  });
  steps.plan = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.plan", taskId: TASK_ID, actor: POST("project-lead"), idempotencyKey: "loop-plan",
    capability: roleCap(issuer, "project-lead"), expectedStatus: "triaged", expectedSeq: 2, payload: {}
  });
  // 派单：assign 回执携带被派方的第一张任务能力（签发联动）
  steps.assign = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.assign", taskId: TASK_ID, actor: POST("project-lead"), idempotencyKey: "loop-assign",
    capability: roleCap(issuer, "project-lead"), expectedStatus: "planned", expectedSeq: 3,
    payload: { assignee: "implementer", dispatcher: "project-lead" }
  });

  // ③ 实施（承接岗位，持单次消费＋链式续签的任务能力）
  let cap = steps.assign.body.capability;
  const held = [];
  for (const [name, op, payload] of [
    ["accept", "task.accept", {}],
    ["start", "task.start", {}],
    ["report", "task.report", { deliverable: "闭环烟测的交付件" }]
  ]) {
    const res = await call(api, "POST", "/api/bots/_ledger/commands", {
      op, taskId: TASK_ID, actor: POST("implementer"), idempotencyKey: `loop-${name}`,
      capability: cap, expectedStatus: ledger.task(TASK_ID).status, expectedSeq: ledger.task(TASK_ID).lastSeq,
      payload
    });
    steps[name] = res;
    cap = res.body.capability ?? cap;
    held.push({ name, delivered: res.body.ok === true, renewed: res.body.capability !== undefined });
  }
  steps.implementerChain = held;

  // ④ 复核帽：当次空闲实例佩戴（排除产出方；台账腿复验空闲）
  const candidates = [{ botId: "verifier" }, { botId: "implementer" }];
  steps.reviewerSelection = selectReviewer({
    candidates,
    holdingsFor: (botId) => ledger.holdingsFor(botId),
    excludeBotIds: ["implementer"]
  });
  // 负例（台账权威门）：产出方自任复核者即拒
  steps.selfReview = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "review.request", taskId: TASK_ID, actor: USER, idempotencyKey: "loop-self-review",
    payload: { point: "before-external-visibility", reviewer: "implementer" }
  });
  // 复核召集（必审点来自简报冻结清单，可加审不可免审）
  steps.reviewRequest = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "review.request", taskId: TASK_ID, actor: POST("project-lead"), idempotencyKey: "loop-review-request",
    capability: roleCap(issuer, "project-lead"),
    payload: { point: "before-external-visibility", reviewer: "verifier" }
  });
  // 必审拦截：复核未闭合时交付被拒（V-A2.7）——烟测要看见这道门真的关着
  // （授权通过而命令被拒同样续签，续签帽接着用于后面的合法交付）
  steps.deliverBlocked = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.deliver", taskId: TASK_ID, actor: POST("implementer"), idempotencyKey: "loop-deliver-blocked",
    capability: cap, expectedStatus: "produced", expectedSeq: ledger.task(TASK_ID).lastSeq, payload: {}
  });
  cap = steps.deliverBlocked.body.capability ?? cap;
  // 复核者持帽读移交件（fresh context：只含冻结简报与复核史，读不消费帽）＋提交报告
  const hat = roleCap(issuer, "verifier");
  steps.handoff = await call(api, "GET", `/api/bots/_ledger/review-handoff?taskId=${TASK_ID}`, null, {
    "x-dsh-bots-bot-id": "verifier",
    "x-dsh-bots-capability": JSON.stringify(hat)
  });
  steps.reviewReport = await call(api, "POST", "/api/bots/_ledger/reviews", {
    taskId: TASK_ID, actor: POST("verifier"), idempotencyKey: "loop-review-report",
    capability: hat,
    report: { subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "复核实例模型（身份登记）" }
  });

  // ⑤ 结算（派单方）：交付 → 结算 → 关闭（关闭前置须先过）
  steps.deliver = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.deliver", taskId: TASK_ID, actor: POST("implementer"), idempotencyKey: "loop-deliver",
    capability: cap, expectedStatus: "produced", expectedSeq: ledger.task(TASK_ID).lastSeq, payload: {}
  });
  cap = steps.deliver.body.capability ?? cap;
  steps.settle = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.settle", taskId: TASK_ID, actor: POST("project-lead"), idempotencyKey: "loop-settle",
    capability: roleCap(issuer, "project-lead"),
    expectedStatus: "delivered", expectedSeq: ledger.task(TASK_ID).lastSeq, payload: {}
  });
  // 关闭前置（§B）：产出尚未登记时关闭被拒——门是活的，不是纸面条款
  steps.closeBlocked = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.close", taskId: TASK_ID, actor: POST("project-lead"), idempotencyKey: "loop-close-blocked",
    capability: roleCap(issuer, "project-lead"),
    expectedStatus: "settled", expectedSeq: ledger.task(TASK_ID).lastSeq, payload: {}
  });
  // 交付前另签一张**未消费**的任务能力（宿主签发面），交付后用它试探：应被投影吊销
  // ——区分「单次消费」（已用过的帽＝replayed）与「离开在办态即吊销」（未用过的帽也失效）
  const spare = issuer.issueTaskCapability({ taskId: TASK_ID, botId: "implementer", post: "implementer" });
  assert.equal(spare.ok, true, spare.reason);
  // 交付后任务能力即随「离开在办态」吊销：已消费的帽＝replayed，未消费的帽＝revoked
  steps.replayedCapAfterDeliver = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.heartbeat", taskId: TASK_ID, actor: POST("implementer"), idempotencyKey: "loop-stale-cap",
    capability: cap, payload: {}
  });
  steps.revokedCapAfterDeliver = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.heartbeat", taskId: TASK_ID, actor: POST("implementer"), idempotencyKey: "loop-revoked-cap",
    capability: spare.envelope, payload: {}
  });
  // 产出按「谁产出谁登记」登记（登记方＝产出方，锚本任务）——执行面 op 不进任务域，
  // 由岗位**角色能力**覆盖（op-set：执行面 op 四个常设岗各持一份）
  steps.register = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "knowledge.register", actor: POST("implementer"), idempotencyKey: "loop-register",
    capability: roleCap(issuer, "implementer"),
    payload: { title: "闭环烟测产出", summary: "闭环跑通", body: "# 闭环跑通的结论", task: TASK_ID }
  });
  steps.close = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.close", taskId: TASK_ID, actor: POST("project-lead"), idempotencyKey: "loop-close",
    capability: roleCap(issuer, "project-lead"),
    expectedStatus: "settled", expectedSeq: ledger.task(TASK_ID).lastSeq, payload: {}
  });
  steps.reopen = await call(api, "POST", "/api/bots/_ledger/commands", {
    op: "task.close", taskId: TASK_ID, actor: POST("project-lead"), idempotencyKey: "loop-reopen",
    capability: roleCap(issuer, "project-lead"),
    expectedStatus: "closed", expectedSeq: ledger.task(TASK_ID).lastSeq, payload: {}
  });

  // 只回吐用例真正消费的产物（rig 内部件不出模块边界）
  return { home: rig.home, ledger: rig.ledger, frames: rig.frames, steps };
}

// 单次真跑：全部用例共享同一次闭环的产物（烟测语义＝「跑一次」）。
const RUN = await runClosedLoop();
const { home, ledger, frames, steps } = RUN;

test("闭环烟测 ①：五段全链贯通——主干十态按序出现且终态为 closed（V-A2.3／§I 切换点判据④）", () => {
  const all = ledger.events();
  const stateEvents = all.filter((event) => event.taskId === TASK_ID);
  // 逐事件重放投影：状态序列即事件序列的投影（状态不是被写回的字段）
  const visited = [];
  for (const event of stateEvents) {
    const projected = projectEvents(all.filter((row) => row.seq <= event.seq), TASK_ID);
    assert.equal(projected.ok, true, projected.reason);
    if (visited[visited.length - 1] !== projected.task.status) visited.push(projected.task.status);
  }
  assert.deepEqual(visited, [...MAIN_FLOW], "主干十态按序走完（含终态 closed）");
  assert.equal(ledger.task(TASK_ID).status, "closed", "闭环终点＝closed");
  // 每一段的命令回执都在案（五段＝收单／派单／实施／复核帽／结算）
  assert.equal(steps.intake.body.status, "intake");
  assert.equal(steps.triage.body.status, "triaged");
  assert.equal(steps.plan.body.status, "planned");
  assert.equal(steps.assign.body.status, "assigned");
  assert.equal(steps.accept.body.status, "accepted");
  assert.equal(steps.start.body.status, "running");
  assert.equal(steps.report.body.status, "produced");
  assert.equal(steps.reviewReport.body.ok, true, steps.reviewReport.body.reason);
  assert.equal(steps.deliver.body.status, "delivered");
  assert.equal(steps.settle.body.status, "settled");
  assert.equal(steps.close.body.status, "closed");
  // 事件序列＝命令序列的投影（状态事件类型逐段可核）
  const types = stateEvents.map((event) => event.type);
  for (const type of ["intake", "triage", "plan", "assign", "accept", "start", "report", "deliver", "settle", "close"]) {
    assert.ok(types.includes(type), `事件序列缺 ${type}`);
  }
  // 不新增台账事件类型（封闭词表；V-A6.7 的「不新增事件类型」同口径）
  for (const event of stateEvents) {
    assert.ok(EVENT_TYPES.includes(event.type), `${event.type} 不在封闭事件词表内`);
  }
  // 每一步写入都广播台账投影（人间收件箱与 SSE 的数据源；帧不是死数据）
  assert.ok(frames.some((frame) => frame.type === "ledger" && Array.isArray(frame.data.tasks)),
    "未闭合队列的每一步变化都广播投影");
});

test("闭环烟测 ②：台账投影可核——换只读门面重新投影同一数据根，与在跑投影一致（V-A2.2 钉桩）", () => {
  assert.ok(existsSync(eventsFile(home)), "台账事件文件是证据落点");
  const reread = createTaskLedger({ dshHome: home });
  assert.deepEqual(
    reread.tasks().map((task) => ({ taskId: task.taskId, status: task.status })),
    ledger.tasks().map((task) => ({ taskId: task.taskId, status: task.status })),
    "投影只由事件决定：换门面重读必须得到同一结论"
  );
  assert.equal(reread.openQueue().length, 0, "闭环后未闭合队列为空");
  const lines = readFileSync(eventsFile(home), "utf8").trim().split("\n");
  assert.equal(lines.length, ledger.events().length, "落盘行数＝事件数（append-only，无静默丢失）");
});

test("闭环烟测 ③：通知＝台账事件投影——派单达被派方、复核请求达复核者、关闭达派单方（V-A2.12）", () => {
  const { notifications } = ledger.notificationsAfter(0);
  const to = (type) => notifications.filter((note) => note.type === type).map((note) => note.to);
  assert.deepEqual(to("assign"), ["implementer"], "派单通知达被派方");
  assert.deepEqual(to("review-requested"), ["verifier"], "复核请求达当次复核者");
  assert.ok(to("close").includes("project-lead"), "关闭通知达派单方");
  assert.equal(new Set(notifications.map((note) => note.seq)).size, notifications.length, "通知与事件一一对应，无凭空通知");
  assert.deepEqual(ledger.notificationsAfter(ledger.events().length).notifications, [], "无新事件不通知");
});

test("闭环烟测 ④：复核帽由当次空闲实例佩戴，产出方自任即被机械拒绝（V-A1.3／V-A2.7）", () => {
  assert.deepEqual(steps.reviewerSelection, { botId: "verifier" }, "选择器排除产出方、只挑空闲实例");
  assert.equal(steps.selfReview.status, 409);
  assert.equal(steps.selfReview.body.code, "reviewer-is-producer");
  assert.equal(steps.deliverBlocked.status, 409);
  assert.equal(steps.deliverBlocked.body.code, "review-gaps-open", "必审点未闭合时交付被拒");
  assert.equal(steps.handoff.status, 200);
  assert.deepEqual(steps.handoff.body.brief.reviewPoints, ["before-external-visibility"]);
  assert.equal(steps.handoff.body.requests[0].reviewer, "verifier");
  assert.ok(!JSON.stringify(steps.handoff.body).includes("judgement"), "移交件不含产出方推理轨迹");
});

test("闭环烟测 ⑤：实施段持真能力链——单次消费＋链式续签，交付即自动吊销（V-A3.2／V-A4.3）", () => {
  assert.equal(steps.assign.body.capability?.payload?.botId, "implementer", "assign 回执携带被派方首张任务能力");
  for (const step of steps.implementerChain) {
    assert.equal(step.delivered, true, `${step.name} 持能力通过`);
    assert.equal(step.renewed, true, `${step.name} 回执续签下一张能力（单次消费下不断链）`);
  }
  // 授权通过而被拒（必审未闭合）同样续签：复核轮的合法交付用的是续签帽，不是重签
  assert.equal(steps.deliverBlocked.body.capability?.payload?.taskId, TASK_ID);
  // 交付＝离开在办持有态 → 任务能力自动吊销（投影判定，无吊销窗口）：
  // 已消费的帽＝单次消费拒（replayed）；宿主另签未消费的帽＝吊销拒（revoked）
  assert.equal(steps.replayedCapAfterDeliver.status, 409);
  assert.equal(steps.replayedCapAfterDeliver.body.code, "capability-replayed");
  assert.equal(steps.revokedCapAfterDeliver.status, 409);
  assert.equal(steps.revokedCapAfterDeliver.body.code, "capability-revoked");
  assert.equal(steps.register.status, 200, "知识登记经 host 侧执行面落盘（bot 无直写通道）");
});

test("闭环烟测 ⑥：关闭前置成立且终态只读——产出登记锚本任务，重开被拒（§B／V-A2.9）", () => {
  // 关闭前置是活门：产出未登记时那次关闭尝试被拒（链上真的发生过）
  assert.equal(steps.closeBlocked.status, 409);
  // 关闭前置第三条（25 号票）在产出登记之前先跑判据：那次尝试的产出坐标还没落盘，
  // 故先撞上判据门（`acceptance-check-failed`）；登记之后判据与登记两门同过。
  assert.equal(steps.closeBlocked.body.code, "acceptance-check-failed");
  assert.equal(steps.closeBlocked.body.failedIndex, 0, "回执点名第几条判据");
  assert.match(steps.closeBlocked.body.reason, /闭环烟测产出|R-2026-001\.md/, "回执点名坐标");
  assert.equal(steps.close.status, 200);
  assert.equal(steps.close.body.status, "closed");
  assert.equal(steps.reopen.status, 409);
  assert.equal(steps.reopen.body.code, "task-closed", "终态不可重开");
  assert.equal(ledger.task(TASK_ID).status, "closed");
  // 产出登记面：登记方＝产出方、锚本任务
  const artifacts = ledger.artifactsFor(TASK_ID);
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].botId, "implementer");
  assert.equal(artifacts[0].task, TASK_ID);
});
