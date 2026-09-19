/**
 * 人间接口／初审边界／裁定包回归（org-v2 09 号票；规格 §F 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A5.1` 只有三类裁定进 waiting-user，其余到人事件纯告知不挂起
 *     → 本模块（三类裁定封闭枚举＋告知分类不交集）
 *   - `V-A5.2` 投递面＝台账事件投影的人间收件箱、内嵌终裁操作；mail 回文永不构成裁定
 *     → 本模块（收件箱投影：待裁项带裁定包与可选动作；裁定只认 user principal）
 *   - `V-A5.4` 初审代理边界：必审产出只整理裁定包；初审拒绝或两轮未闭合强制上浮；
 *     模型指派、越权处置、冲突仲裁永不可代 → 本模块（初审边界判定＋永不可代三项）
 *   - `V-A5.5` 终裁＝台账命令特化视图，继承幂等键、CAS 与事件审计，不另起命令面
 *     → 本模块（裁定动作表 ⊆ 台账命令词表；推迟＝零台账事件）
 *   - `V-A5.6` 裁定包五件齐备、不附全文工件 → 本模块（五件齐备与缺件即拒）
 *
 * 只测外部行为：模块导出的判定结论与投影形状；台账侧闸门（wait-user 裁定类必填、
 * escalated 原因封闭、非委代项归属门、挂起语义）在 `tests/task-ledger.test.mjs`，
 * 收件箱 HTTP 投递面在 `tests/ledger-host.test.mjs`。不触真实 ~/.dsh。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ESCALATION_CAUSES,
  ESCALATION_CAUSE_IDS,
  NON_DELEGABLE,
  NON_DELEGABLE_IDS,
  NOTICE_KINDS,
  NOTICE_KIND_IDS,
  PRE_SCREEN_DECISIONS,
  PRE_SCREEN_DECISION_IDS,
  RULING_ACTIONS,
  RULING_ACTION_IDS,
  RULING_ACTOR,
  RULING_CLASSES,
  RULING_CLASS_IDS,
  UNAUTHORIZED_CODES,
  applyRuling,
  buildInbox,
  buildRulingPackage,
  isExpired,
  isUnauthorizedCode,
  noticesFrom,
  preScreenBoundary,
  preScreenEscalation,
  rulingActionsFor,
  userRulingRequirement
} from "../lib/org/human-inbox.js";
import { LEDGER_COMMAND_OPS } from "../lib/org/op-set.js";

test("只有三类裁定可进 waiting-user：封闭枚举三条，各带判据文本（V-A5.1）", () => {
  assert.deepEqual(RULING_CLASS_IDS, ["irreversible-write", "escalation", "user-domain"]);
  assert.equal(RULING_CLASSES.length, 3);
  for (const entry of RULING_CLASSES) {
    assert.ok(typeof entry.criterion === "string" && entry.criterion !== "", `${entry.id} 须带判据文本`);
  }
  assert.equal(Object.isFrozen(RULING_CLASSES), true, "裁定类枚举须冻结（防运行时扩表）");
  assert.equal(Object.isFrozen(RULING_CLASS_IDS), true);
});

test("永不可代三项：模型指派／越权处置／冲突仲裁＝封闭枚举，且与裁定类不混用（V-A5.4）", () => {
  assert.deepEqual(NON_DELEGABLE_IDS, ["model-assignment", "out-of-bounds-handling", "conflict-arbitration"]);
  for (const entry of NON_DELEGABLE) {
    assert.ok(typeof entry.criterion === "string" && entry.criterion !== "");
  }
  assert.equal(Object.isFrozen(NON_DELEGABLE), true);
});

test("上浮原因＝封闭枚举：在案两路（复核两轮未闭合、队列滞留/租约链）与冲突/越权/初审拒绝同在表内（V-A5.1）", () => {
  for (const id of ["review-rounds-exhausted", "queue-stall", "accept-timeout", "lease-expired", "instance-death"]) {
    assert.ok(ESCALATION_CAUSE_IDS.includes(id), `${id} 是 sweep／复核在案原因，须在枚举内`);
  }
  for (const id of ["pre-screen-rejected", "conflict", "out-of-bounds"]) {
    assert.ok(ESCALATION_CAUSE_IDS.includes(id), `${id} 是初审拒绝／永不可代两项的上浮原因，须在枚举内`);
  }
  assert.ok(ESCALATION_CAUSE_IDS.includes("needs-user"), "needs-user 是判据缺口分解不出来的上浮原因（规格 §B 原词；2026-09-19 用户裁定扩条，19 号票）");
  for (const entry of ESCALATION_CAUSES) {
    assert.ok(typeof entry.criterion === "string" && entry.criterion !== "");
  }
  assert.equal(Object.isFrozen(ESCALATION_CAUSES), true, "原因枚举须冻结（台账 schema 以它为封闭词表）");
  assert.equal(ESCALATION_CAUSE_IDS.length, ESCALATION_CAUSES.length);
});

test("永不可代的归属判定：用户域挂起与冲突／越权上浮只许 user 终裁，其余挂起点不误伤（V-A5.4）", () => {
  assert.equal(userRulingRequirement({ task: { status: "running", waitingClass: null } }), null, "非挂起态无归属要求");
  assert.equal(
    userRulingRequirement({ task: { status: "waiting-user", waitingClass: "irreversible-write" } }),
    null,
    "不可逆写入放行不在永不可代三项内"
  );
  const domain = userRulingRequirement({ task: { status: "waiting-user", waitingClass: "user-domain" } });
  assert.ok(domain !== null && domain.reason.includes("用户域"), "用户域裁定请求须点名理由");
  assert.equal(domain.nonDelegable, null, "预算类用户域裁定不硬指某一项永不可代 id");
  const conflict = userRulingRequirement({
    task: { status: "waiting-user", waitingClass: "escalation", escalationCause: "conflict" }
  });
  assert.equal(conflict.nonDelegable, "conflict-arbitration");
  const outOfBounds = userRulingRequirement({
    task: { status: "waiting-user", waitingClass: "escalation", escalationCause: "out-of-bounds" }
  });
  assert.equal(outOfBounds.nonDelegable, "out-of-bounds-handling");
  for (const cause of ["review-rounds-exhausted", "queue-stall", "accept-timeout", "lease-expired", "instance-death"]) {
    assert.equal(
      userRulingRequirement({ task: { status: "waiting-user", waitingClass: "escalation", escalationCause: cause } }),
      null,
      `${cause} 不在永不可代三项内（既有恢复语义不误伤）`
    );
  }
});

test("业务截止时间到期只投影「已过期」：缺省与坏值都不算到期，且不构成自动动作（V-A5.3）", () => {
  const now = Date.parse("2026-10-02T00:00:00.000Z");
  assert.equal(isExpired({ task: { brief: { dueAt: "2026-10-01T00:00:00.000Z" } }, now }), true, "已过＝投影过期");
  assert.equal(isExpired({ task: { brief: { dueAt: "2026-10-02T00:00:00.000Z" } }, now }), true, "到期当刻即过期");
  assert.equal(isExpired({ task: { brief: { dueAt: "2026-10-03T00:00:00.000Z" } }, now }), false, "未到＝不过期");
  assert.equal(isExpired({ task: { brief: {} }, now }), false, "缺省＝无到期投影");
  assert.equal(isExpired({ task: {}, now }), false);
  assert.equal(isExpired({ task: { brief: { dueAt: "垃圾时间" } }, now }), false, "坏值不得当成到期（fail closed）");
  assert.equal(isExpired({ task: { brief: { dueAt: "2026-10-01T00:00:00.000Z" } }, now: undefined }), false, "无时钟＝不投影");
});

test("初审代理边界：未命中必审清单可处置（通过／回笼）；命中未闭合只可整理裁定包（V-A5.4）", () => {
  const noPoints = preScreenBoundary({ brief: { reviewPoints: [] }, events: [], taskId: "TK-TEST0001" });
  assert.equal(noPoints.mode, "dispose");
  assert.deepEqual(noPoints.allowedDecisions, ["approve", "return"]);
  assert.deepEqual(noPoints.openMandatory, []);
  const hit = preScreenBoundary({ brief: { reviewPoints: ["before-external-visibility"] }, events: [], taskId: "TK-TEST0001" });
  assert.equal(hit.mode, "package-only", "命中必审清单＝只可整理裁定包");
  assert.deepEqual(hit.openMandatory, ["before-external-visibility"]);
  assert.deepEqual(hit.allowedDecisions, [], "命中必审＝不得自行处置（通过／回笼都不行）");
  // 必审点已闭合（复核者报 closed）→ 回到可处置
  const events = [
    { seq: 2, taskId: "TK-TEST0001", type: "review-requested", point: "before-external-visibility", mandatory: true, reviewer: "bot-reviewer" },
    { seq: 3, taskId: "TK-TEST0001", type: "review-reported", subject: "before-external-visibility", verdict: "closed", gaps: [], modelIdentity: "m" }
  ];
  const closed = preScreenBoundary({ brief: { reviewPoints: ["before-external-visibility"] }, events, taskId: "TK-TEST0001" });
  assert.equal(closed.mode, "dispose", "必审闭合后可处置");
  // 咨询性（topic）不入必审集：不阻断处置
  const advisory = preScreenBoundary({
    brief: { reviewPoints: [] },
    events: [{ seq: 2, taskId: "TK-TEST0001", type: "review-requested", topic: "命名风格", reviewer: "bot-reviewer" }],
    taskId: "TK-TEST0001"
  });
  assert.equal(advisory.mode, "dispose");
});

test("初审拒绝或判据两轮未闭合＝强制上浮；未知裁决 fail closed 按拒绝处置（V-A5.4）", () => {
  assert.deepEqual(
    preScreenEscalation({ decision: "approve", entry: { consecutiveUnclosed: 0 } }),
    { escalate: false, cause: null, reason: null }
  );
  assert.equal(preScreenEscalation({ decision: "return", entry: { consecutiveUnclosed: 0 } }).cause, "pre-screen-rejected");
  assert.equal(preScreenEscalation({ decision: "approve", entry: { consecutiveUnclosed: 2 } }).cause, "review-rounds-exhausted");
  assert.equal(preScreenEscalation({ decision: "approve", entry: { consecutiveUnclosed: 1 } }).escalate, false, "一轮未闭合尚可修复");
  const unknown = preScreenEscalation({ decision: "闲聊", entry: {} });
  assert.equal(unknown.escalate, true, "未知裁决不得静默放行（fail closed）");
  assert.equal(unknown.cause, "pre-screen-rejected");
  assert.equal(Object.isFrozen(PRE_SCREEN_DECISIONS), true);
  assert.deepEqual(PRE_SCREEN_DECISION_IDS, ["approve", "return"]);
});

test("终裁四式＝台账命令的特化视图：命令全部落在台账命令词表内，不另起命令面（V-A5.5）", () => {
  assert.deepEqual(RULING_ACTION_IDS, ["accept", "reject", "defer", "authorize-repair"]);
  for (const action of RULING_ACTIONS) {
    assert.ok(typeof action.label === "string" && action.label !== "", `${action.id} 须有动作名`);
    assert.ok(typeof action.consequence === "string" && action.consequence !== "", `${action.id} 须写后果`);
    assert.ok(Array.isArray(action.commands), `${action.id} 的 commands 须为数组`);
    for (const command of action.commands) {
      assert.ok(LEDGER_COMMAND_OPS.includes(command.op), `${action.id} 的 ${command.op} 必须在台账命令词表内（不另起命令面）`);
      // 负载构造＝表声明（keys 指名取哪些终裁输入，组装统一走 payloadFromInputs——表即单一源）
      assert.ok(Array.isArray(command.keys) && command.keys.length > 0 && command.keys.every((key) => typeof key === "string"),
        `${action.id}.${command.op} 须声明非空 keys 负载取键（表即单一源）`);
    }
    for (const name of action.requires) {
      assert.equal(typeof name, "string", `${action.id} 的 requires 须为输入名`);
    }
  }
  // 推迟＝投递面节律：零台账命令（照规格 §F「不产生新台账事件语义」）
  assert.deepEqual(RULING_ACTIONS.find((entry) => entry.id === "defer").commands, []);
  assert.deepEqual(RULING_ACTOR, { kind: "user", id: "user" }, "终裁身份＝user principal（V-A3.10）");
});

test("终裁只能由 user 行使；mail 回文之类的来路不构成裁定（V-A5.2／V-A5.5）", () => {
  const calls = [];
  const stub = { command: (input) => { calls.push(input); return { ok: true }; } };
  for (const actor of [{ kind: "post", id: "mail-reply" }, { kind: "host", id: "web" }]) {
    const verdict = applyRuling({
      ledger: stub, action: "accept", taskId: "TK-00000099", actor, idempotencyKey: "k", resumeTo: "running"
    });
    assert.equal(verdict.ok, false, `${actor.kind} 不得行使终裁`);
    assert.equal(verdict.code, "ruling-actor-required");
  }
  assert.deepEqual(calls, [], "拒绝须在触达台账前发生（无写入）");
  const unknown = applyRuling({ ledger: stub, action: "闲聊", taskId: "TK-00000099", idempotencyKey: "k" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "unknown-ruling-action");
  assert.deepEqual(calls, []);
});

test("终裁缺幂等键或必填输入即拒；幂等键带 taskId 分量，不跨任务串键（V-A5.5）", () => {
  const calls = [];
  const stub = {
    command: (input) => { calls.push(input); return { ok: true }; },
    task: () => ({ status: "running", lastSeq: 1 })
  };
  const noKey = applyRuling({ ledger: stub, action: "accept", taskId: "TK-00000099", resumeTo: "running" });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.code, "idempotency-key-required", "缺键即拒（与台账同口径，不拼出 undefined:op 假键）");
  const noInput = applyRuling({ ledger: stub, action: "accept", taskId: "TK-00000099", idempotencyKey: "k1" });
  assert.equal(noInput.ok, false);
  assert.equal(noInput.code, "ruling-payload-required", "requires 声明的输入缺一即拒（不把 undefined 传进台账）");
  const noReason = applyRuling({ ledger: stub, action: "reject", taskId: "TK-00000099", idempotencyKey: "k2" });
  assert.equal(noReason.code, "ruling-payload-required");
  assert.deepEqual(calls, [], "拒绝全部发生在触达台账之前");
  // 同键跨任务：命令面的幂等键含 taskId 分量，两次裁定互不重放
  const first = applyRuling({
    ledger: stub, action: "accept", taskId: "TK-00000098", idempotencyKey: "same-key", resumeTo: "running"
  });
  const second = applyRuling({
    ledger: stub, action: "accept", taskId: "TK-00000099", idempotencyKey: "same-key", resumeTo: "running"
  });
  assert.equal(first.ok && second.ok, true);
  const keys = calls.map((call) => call.idempotencyKey);
  assert.equal(new Set(keys).size, keys.length, "同键跨任务不得拼出同一个台账幂等键");
  assert.ok(keys.every((key) => key.startsWith("same-key:")), "幂等键＝<裁定键>:<taskId>:<op>");
});

test("推迟＝零台账事件：不改状态、不触台账（V-A5.5 与规格 §F 节律口径）", () => {
  const calls = [];
  const stub = { command: (input) => { calls.push(input); return { ok: true }; } };
  const verdict = applyRuling({ ledger: stub, action: "defer", taskId: "TK-00000099", idempotencyKey: "defer-1" });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.deferred, true);
  assert.deepEqual(verdict.results, []);
  assert.deepEqual(calls, [], "推迟不产生任何台账命令（提醒属投递面节律）");
});

test("终裁动作表按挂起态给出可选动作：非挂起任务无可裁定动作（V-A5.2 内嵌裁定操作）", () => {
  const waiting = { status: "waiting-user", waitingClass: "escalation" };
  assert.equal(rulingActionsFor(waiting).length, 4);
  assert.equal(rulingActionsFor({ status: "running" }).length, 0);
  assert.equal(rulingActionsFor(null).length, 0);
});

const PACKET_TASK_ID = "TK-TEST0002";
const PACKET_BRIEF = Object.freeze({
  goal: "改 mail 投递通道",
  deliverables: [{ format: "patch", location: "lib/mail-plane.js" }],
  sources: [{ tool: "ledger.read", ref: PACKET_TASK_ID }],
  boundaries: "不改协议形状",
  acceptance: [{ probe: "fs.contains", args: { location: "lib/mail-plane.js", text: "host" } }],
  reviewPoints: ["before-external-visibility"]
});
const PACKET_EVENTS = Object.freeze([
  { seq: 1, taskId: PACKET_TASK_ID, type: "intake" },
  { seq: 2, taskId: PACKET_TASK_ID, type: "report", deliverable: "坐标：lib/mail-plane.js（补丁）" },
  { seq: 3, taskId: PACKET_TASK_ID, type: "review-requested", point: "before-external-visibility", mandatory: true, reviewer: "bot-reviewer" },
  {
    seq: 4, taskId: PACKET_TASK_ID, type: "review-reported", subject: "before-external-visibility",
    verdict: "gaps-open", modelIdentity: "glm-5.3-flash（复核实例）",
    gaps: [{ severity: "blocker", summary: "host 唯一写者未落实", evidence: "seq 3 事件原文" }],
    criteriaGaps: []
  },
  { seq: 5, taskId: PACKET_TASK_ID, type: "escalated", cause: "review-rounds-exhausted", dispatchCount: 1 }
]);
const PACKET_TASK = Object.freeze({
  taskId: PACKET_TASK_ID,
  status: "waiting-user",
  waitingClass: "escalation",
  escalationCause: "review-rounds-exhausted",
  owner: null,
  lastSeq: 5,
  brief: PACKET_BRIEF
});

test("裁定包五件齐备：冻结简报／判据事实／双方立场＋全轨迹指针／可选动作／模型身份（V-A5.6）", () => {
  const built = buildRulingPackage({
    task: PACKET_TASK, events: PACKET_EVENTS, taskId: PACKET_TASK_ID, modelIdentity: "glm-5.3-flash（初审代理）"
  });
  assert.equal(built.ok, true, JSON.stringify(built.violations));
  assert.deepEqual(Object.keys(built.packet).sort(), ["actions", "brief", "criteriaFacts", "modelIdentity", "positions", "taskId"]);
  assert.equal(built.packet.brief.goal, "改 mail 投递通道", "①冻结简报");
  assert.equal(built.packet.criteriaFacts.cause, "review-rounds-exhausted", "②判据事实");
  assert.deepEqual(built.packet.criteriaFacts.openMandatory, ["before-external-visibility"]);
  assert.equal(built.packet.criteriaFacts.subjects[0].gaps[0].summary, "host 唯一写者未落实");
  assert.deepEqual(built.packet.criteriaFacts.criteria, PACKET_BRIEF.acceptance, "判据原文随包（结果原文在 gaps.evidence／criteriaGaps，均不附工件正文）");
  assert.deepEqual(built.packet.criteriaFacts.subjects[0].gaps[0].evidence, "seq 3 事件原文", "检查结果原文随包");
  assert.ok(built.packet.positions.entries.length >= 2, "③双方立场各一句");
  assert.deepEqual(
    built.packet.positions.entries.map((entry) => entry.side).sort(),
    ["producer", "reviewer"]
  );
  // 尚未产出（队列滞留上浮）＝以机械可得的一对补齐：派单方 vs 归属者
  const notProduced = buildRulingPackage({
    task: { ...PACKET_TASK, waitingClass: "escalation", escalationCause: "queue-stall", brief: null },
    events: [{ seq: 3, taskId: PACKET_TASK_ID, type: "escalated", cause: "queue-stall", dispatchCount: 3 }],
    taskId: PACKET_TASK_ID,
    modelIdentity: "glm-5.3-flash（初审代理）"
  });
  assert.equal(notProduced.ok, false, "缺冻结简报即拒（此处只看立场退路）");
  assert.deepEqual(
    notProduced.violations.some((line) => line.includes("立场")),
    false,
    "队列滞留上浮仍有双方立场可引（派单方／归属者）"
  );
  // 单方可得（只有产出、无复核）时补齐第二句——「双方立场各一句」是硬要求
  const oneSided = buildRulingPackage({
    task: { ...PACKET_TASK, waitingClass: "user-domain", escalationCause: null },
    events: PACKET_EVENTS.filter((event) => event.type === "report"),
    taskId: PACKET_TASK_ID,
    modelIdentity: "glm-5.3-flash（初审代理）"
  });
  assert.equal(oneSided.ok, false, "只有 report／wait-user 事件＝无挂起事实，缺件②");
  const oneSidedSides = buildRulingPackage({
    task: { ...PACKET_TASK, waitingClass: "user-domain", escalationCause: null },
    events: [
      { seq: 2, taskId: PACKET_TASK_ID, type: "report", deliverable: "坐标：lib/mail-plane.js" },
      { seq: 5, taskId: PACKET_TASK_ID, type: "wait-user", class: "user-domain", reason: "预算待定" }
    ],
    taskId: PACKET_TASK_ID,
    modelIdentity: "glm-5.3-flash（初审代理）"
  });
  assert.equal(oneSidedSides.ok, true, JSON.stringify(oneSidedSides.violations));
  assert.deepEqual(
    oneSidedSides.packet.positions.entries.map((entry) => entry.side),
    ["producer", "dispatcher"],
    "只有产出方时以派单方补齐第二句"
  );
  assert.deepEqual(built.packet.positions.trail, { taskId: PACKET_TASK_ID, fromSeq: 1, toSeq: 5 }, "全轨迹指针");
  assert.deepEqual(built.packet.actions.map((entry) => entry.id), ["accept", "reject", "defer", "authorize-repair"], "④可选动作");
  assert.equal(built.packet.modelIdentity, "glm-5.3-flash（初审代理）", "⑤模型身份");
  // 不自动附全文工件：交付物只给坐标
  assert.deepEqual(built.packet.brief.deliverables, [{ format: "patch", location: "lib/mail-plane.js" }]);
});

test("裁定包缺件即拒（fail closed）：缺模型身份／缺冻结简报／非挂起态／无任务（V-A5.6）", () => {
  const base = { task: PACKET_TASK, events: PACKET_EVENTS, taskId: PACKET_TASK_ID };
  const noIdentity = buildRulingPackage({ ...base, modelIdentity: "  " });
  assert.equal(noIdentity.ok, false);
  assert.ok(noIdentity.violations.some((line) => line.includes("模型身份")));
  const noBrief = buildRulingPackage({ ...base, task: { ...PACKET_TASK, brief: null }, modelIdentity: "m" });
  assert.equal(noBrief.ok, false);
  assert.ok(noBrief.violations.some((line) => line.includes("冻结简报")));
  const notWaiting = buildRulingPackage({
    ...base, task: { ...PACKET_TASK, status: "running", waitingClass: null }, modelIdentity: "m"
  });
  assert.equal(notWaiting.ok, false);
  assert.ok(notWaiting.violations.some((line) => line.includes("可选动作")), "非挂起＝无终裁动作可给");
  assert.equal(buildRulingPackage({ modelIdentity: "m" }).ok, false, "无任务即拒");
});

test("告知投影：交付回笼／取消失败／越权计数三类各有来路；越权按连续计数汇总，绝不挂起（V-A5.1）", () => {
  const events = [
    { seq: 1, taskId: "TK-A", type: "deliver" },
    { seq: 2, taskId: "TK-A", type: "command-rejected", op: "task.cancel", code: "task-closed" },
    { seq: 3, taskId: "TK-A", type: "command-rejected", op: "task.resume", code: "capability-required" },
    { seq: 4, taskId: "TK-B", type: "command-rejected", op: "task.claim", code: "op-not-in-opset" },
    { seq: 5, taskId: "TK-A", type: "command-rejected", op: "task.heartbeat", code: "not-owner" },
    { seq: 6, taskId: "TK-A", type: "exception", kind: "task-stalled" },
    { seq: 7, taskId: "TK-A", type: "command-rejected", op: "task.report", code: "capability-malformed" },
    { seq: 8, taskId: "TK-A", type: "command-rejected", op: "task.report", code: "capability-expired" }
  ];
  const notices = noticesFrom({ events, cursor: 0 });
  assert.deepEqual(
    notices.map((entry) => entry.kind),
    ["delivery-return", "cancel-failure", "unauthorized-count", "unauthorized-count", "unauthorized-count"]
  );
  assert.deepEqual(
    notices.filter((entry) => entry.kind === "unauthorized-count").map((entry) => [entry.taskId, entry.count]),
    [["TK-A", 1], ["TK-B", 1], ["TK-A", 1]],
    "越权计数按连续口径：被角色类拒绝／异常打断后重新起算（not-owner 不算越权）"
  );
  // 词形口径（单一源＝能力模块探测码命名）：capability-* 与权限门码＝越权；
  // 运维性码（TTL 到期／重放／离手吊销／活态）不计越权，**也不洗掉越权链**
  assert.equal(isUnauthorizedCode("capability-signature"), true, "签名不符＝越权");
  assert.equal(isUnauthorizedCode("capability-task-scope"), true, "任务域越界＝越权");
  assert.equal(isUnauthorizedCode("task-domain-mismatch"), true);
  assert.equal(isUnauthorizedCode("capability-expired"), false, "运维性码不计越权");
  assert.equal(isUnauthorizedCode("not-owner"), false, "角色类拒绝不算越权");
  assert.deepEqual(UNAUTHORIZED_CODES, ["op-not-in-opset", "post-unassigned", "task-domain-mismatch"], "非 capability- 前缀的门码显式在表");
  const laundering = noticesFrom({
    events: [
      { seq: 1, taskId: "TK-C", type: "command-rejected", op: "task.report", code: "capability-signature" },
      { seq: 2, taskId: "TK-C", type: "command-rejected", op: "task.report", code: "capability-expired" },
      { seq: 3, taskId: "TK-C", type: "command-rejected", op: "task.report", code: "capability-signature" }
    ],
    cursor: 0
  });
  assert.deepEqual(laundering.map((entry) => entry.count), [1, 2], "过期信封不能洗掉连续越权链（既不计数也不重置）");
  // 光标：只看其后
  assert.deepEqual(noticesFrom({ events, cursor: 4 }).map((entry) => entry.kind), ["unauthorized-count"]);
  assert.deepEqual(noticesFrom({ events, cursor: 8 }), []);
  // 告知项不含任何挂起语义（无状态、无台账写入面）
  for (const entry of notices) {
    assert.equal(RULING_CLASS_IDS.includes(entry.kind), false);
    assert.ok(typeof entry.seq === "number" && typeof entry.taskId === "string");
  }
});

test("收件箱＝台账事件投影（只读）：待裁项带裁定包、可选动作、归属与到期标记，告知并列（V-A5.2／V-A5.3）", () => {
  const tasks = [PACKET_TASK, { taskId: "TK-TEST0003", status: "running", brief: null, lastSeq: 9 }];
  const events = [...PACKET_EVENTS, { seq: 6, taskId: PACKET_TASK_ID, type: "deliver" }];
  const readOnly = { tasks: () => tasks, events: () => events }; // 只读面：没有 command
  const inbox = buildInbox({ ledger: readOnly, now: Date.parse("2026-10-02T00:00:00.000Z") });
  assert.equal(inbox.cursor, 6);
  assert.equal(inbox.pending.length, 1, "只有挂起任务进待裁列表");
  const item = inbox.pending[0];
  assert.equal(item.taskId, PACKET_TASK_ID);
  assert.equal(item.waitingClass, "escalation");
  assert.equal(item.escalationCause, "review-rounds-exhausted");
  assert.deepEqual(item.actions.map((entry) => entry.id), RULING_ACTION_IDS, "内嵌终裁操作");
  assert.equal(item.packet.modelIdentity, "host（确定性层组装）", "缺省组装者身份＝确定性层（可覆盖）");
  assert.equal(item.expired, false, "简报无 dueAt＝无到期投影");
  assert.equal(item.userRuling, null, "非永不可代挂起点不标「只许 user」");
  assert.deepEqual(inbox.notices.map((entry) => entry.kind), ["delivery-return"], "告知与待裁并列、互不混淆");
  // 到期投影：业务截止时间已过＝标记已过期（不改状态、不自动取消）
  const expiring = buildInbox({
    ledger: {
      tasks: () => [{ ...PACKET_TASK, brief: { ...PACKET_BRIEF, dueAt: "2026-10-01T00:00:00.000Z" } }],
      events: () => PACKET_EVENTS
    },
    now: Date.parse("2026-10-02T00:00:00.000Z")
  });
  assert.equal(expiring.pending[0].expired, true);
  assert.equal(expiring.pending[0].taskId, PACKET_TASK_ID);
  // 永不可代挂起点在投递面上明确标出（组装者身份可指定为初审代理实例）
  const domain = buildInbox({
    ledger: {
      tasks: () => [{ ...PACKET_TASK, waitingClass: "user-domain", escalationCause: null }],
      events: () => PACKET_EVENTS
    },
    now: Date.parse("2026-10-02T00:00:00.000Z"),
    modelIdentity: "glm-5.3-flash（初审代理）"
  });
  assert.ok(domain.pending[0].userRuling.reason.includes("用户域"));
  assert.equal(domain.pending[0].packet.modelIdentity, "glm-5.3-flash（初审代理）");
});

test("到人告知三类＝交付回笼／取消失败／越权计数：纯告知、不挂起（与裁定类词表不交集，V-A5.1）", () => {
  assert.deepEqual(NOTICE_KIND_IDS, ["delivery-return", "cancel-failure", "unauthorized-count"]);
  for (const entry of NOTICE_KINDS) {
    assert.ok(typeof entry.criterion === "string" && entry.criterion !== "");
    assert.equal(RULING_CLASS_IDS.includes(entry.id), false, `${entry.id} 是告知不是裁定`);
  }
  assert.equal(Object.isFrozen(NOTICE_KINDS), true);
});
