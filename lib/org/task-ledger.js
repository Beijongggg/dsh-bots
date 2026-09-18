/**
 * 任务台账面（org-v2 05 号票；规格 §B 与附录 A `V-A2.1`–`V-A2.12`）。
 *
 * 任务升格为一等对象：**host 侧 append-only 事件日志、单一写者**（写锁＋epoch
 * fencing 由 `lib/org/store-base.js` 提供），**状态是事件序列的投影**——本模块
 * 不留任何内存态，每次读取都从事件日志折叠，故清空内存态重启后未闭合队列可
 * 原样重建（`V-A2.2`）。bot 侧**无台账文件直写通道**：事件只能经命令面写，
 * 命令面在写前要求持有台账写锁；bot 实例从不构造台账（接线只在宿主侧，见
 * lib/index.js），他进程同刻写入被锁拒绝（`V-A2.1`）。
 *
 * 命令面纪律（规格 §B 生命周期段；06 号票起命令面可装鉴权器）：
 *   - **合法性由确定性层校验**：命令只声明 op，目标状态由本模块的转移表决定，
 *     **调用方不能传目标状态**；期望状态/序号不符（CAS）即拒；拒绝 fail closed
 *     ——状态不变，且**拒绝本身记台账事件**（`command-rejected`）与幂等预留；
 *     例外＝结构性拒绝四类（unknown-op／invalid-task-id／invalid-actor／缺
 *     幂等键）只回执不落账——**06 号票处置：维持不落账**。前两类无法归到任务流、
 *     后两类无可信幂等锚点，落账既无法归因也成写放大/骚扰面；权限类拒绝
 *     （鉴权三元组）全部落账（`V-A3.6`，见 lib/org/permissions.js）。
 *   - **岗位实例命令经鉴权三元组**（06 号票，`lib/org/permissions.js`）：装入
 *     `authorize` 钩子后，kind=post 的命令须持 host 签发 capability 信封（实例
 *     活态／op∈岗位白名单／任务域匹配），拒绝沿同一条 `reject()` 路径落账。
 *     确定性层自身只把守**角色类**粗门：承接类转移（accept/start/report/
 *     deliver/block/fail）只许当前归属者调用（`ownerOnly`）；挂起类 `wait-user`
 *     的 post 触发须归属者本人（`postOwnerOnly`）。
 *   - **命令自带幂等键**：重复提交返回首次结论且不再落事件（`replayed: true`）。
 *
 * 归属＝`owner + lease + heartbeat`（`V-A2.5`／`V-A2.6`）：派单以 CAS 写归属；
 * 被派方逾期未接由 `sweep` 自动释放回队列并通知派单方；租约到期或实例死亡自动
 * 回收，重派达封顶则**上浮用户**。**一实例同时只持一个进行中任务**——第二次归属
 * 机械拒绝（`HOLDING_STATES`＝承接者在手状态）。
 *
 * 时限与封顶数值属用户域：本模块只提供缝（`LEASE_DEFAULTS` 可逐项覆盖），
 * 规格只要求「必须有这两项与可配置的缝」。
 *
 * 异常四类（实例死亡／任务停滞／等待用户／等待外部依赖）统一走台账事件
 * （`exception`），**不静默丢失**（`V-A2.11`）；通知＝台账事件投影，无事件不通知
 * （`V-A2.12`）。关闭不可重开、归档不删档；要改用 `supersedesTaskId` 开新任务
 * （`V-A2.9`）。
 *
 * 四要素简报契约（org-v2 07 号票，`V-A2.4`；校验器在 `lib/org/brief.js`）：简报
 * 进入事实源的每一处都校验——intake/plan 可携带（在场即须合法）、amend 必须携带
 * 完整合法件（冻结件只允许被完整合法件置换）、**派出即冻结**（assign 前置：简报
 * 必须已在且合法）；`task.accept` 成功结论携带冻结简报（接单即得契约，`V-A4.3`）。
 * 带理由拒收＝`task.decline`（assigned→planned 归队、清归属、通知派单方；理由可
 * 带——规格 §B「可带理由拒收」，给出即须非空）。队列滞留超时（intake/triaged/
 * planned）由 `sweep` 按 QUEUE_STALL_ACTIONS 确定性处置（05 号票 STATE_RESPONSIBILITY
 * 的执行面补齐）。派单默认记录派单方（dispatcher＝派单动作发起者），拒收/回收的
 * 「通知派单方」由此可路由。
 *
 * 复核件套（org-v2 08 号票，规格 §C、`V-A2.7`；机械面在 `lib/org/review-kit.js`）：
 * **复核点是边界事件而非流程阶段**——必审拦截装在 `task.deliver`（跨越对外边界）
 * 一处，不在结算处另设；必审集＝简报冻结 `reviewPoints`（三判据封闭枚举）∪ 强制
 * 复核请求，gaps 未闭合交付即拒（`review-gaps-open`）。复核请求＝`review.request`
 * 命令（点∈枚举或咨询主题二选一、简报冻结点**不可降级**＝可加审不可免审、强制加审
 * 须留归因、reviewer 须当次空闲且**排除产出方**）。复核报告经 host 侧
 * `recordReviewReport` 入账（复核帽无台账写 op——报告是唯一可写产物且形状封闭；
 * 指定关系与「产出方不得自任」在此复核）；**连续两轮未闭合自动上浮用户终裁**
 * （`escalated`，cause=review-rounds-exhausted，通知投影达 user）。清单外（咨询性）
 * 请求与报告不阻断交付。复核事实事件不改状态、由 review-kit 折叠消费。
 */
import { randomBytes } from "node:crypto";
import { join } from "node:path";

import {
  acquireStoreLock as baseAcquireStoreLock,
  appendJsonlLine,
  createEventSourcing,
  createReservationIndex,
  eventHashFor,
  readJsonl,
  requireLockOwnership,
  reservationKeyHash
} from "./store-base.js";
import { isNonEmptyString, validateBrief } from "./brief.js";
import {
  REVIEW_BOUNDARY_IDS,
  collectReviewState,
  openMandatorySubjects,
  validateReviewReport
} from "./review-kit.js";

// ---------------- 坐标 ----------------

/** 台账域根：`<dshHome>/bots/ledger`（与评审单 store 锁域互不嵌套，锁序不变式）。 */
export function ledgerDir(dshHome) {
  return join(dshHome, "bots", "ledger");
}
/** 事件日志：唯一的事实源（append-only、单行一条、O_APPEND 原子追加）。 */
export function eventsFile(dshHome) {
  return join(ledgerDir(dshHome), "events.jsonl");
}
/** 台账写锁目录／epoch／audit（各域独立坐标）。 */
export function lockDirFor(dshHome) {
  return join(ledgerDir(dshHome), "lock");
}
export function epochFile(dshHome) {
  return join(ledgerDir(dshHome), "epoch.json");
}
export function auditFile(dshHome) {
  return join(ledgerDir(dshHome), "audit.jsonl");
}
/** 幂等键预留索引：one-file-per-key（键→首次结论）。 */
export function idempotencyDir(dshHome) {
  return join(ledgerDir(dshHome), "idempotency");
}

const TASK_ID_RE = /^TK-[A-Za-z0-9]{4,40}$/;
const ACTOR_KINDS = ["host", "user", "post"];

/** 任务 id 形状（v2 前缀 `TK-`；旧评审前缀 `T-`／`J-` 随形态退役，不得复用）。 */
export function isTaskId(value) {
  return typeof value === "string" && TASK_ID_RE.test(value);
}

// ---------------- 状态集与责任表 ----------------

/** 主干十态（顺序即生命周期序）。 */
export const MAIN_FLOW = Object.freeze([
  "intake", "triaged", "planned", "assigned", "accepted",
  "running", "produced", "delivered", "settled", "closed"
]);
/** 旁路四态。 */
export const BYPASS_STATES = Object.freeze(["blocked", "waiting-user", "failed", "cancelled"]);
export const TASK_STATES = Object.freeze([...MAIN_FLOW, ...BYPASS_STATES]);
/** 终态：不可重开、不可复活（要改＝`supersedesTaskId` 开新任务）。 */
export const CLOSED_STATES = Object.freeze(["closed", "cancelled"]);
/** 承接者「在手」状态：这期间该实例不得再被归属第二个任务（`V-A2.6`）。 */
export const HOLDING_STATES = Object.freeze(["assigned", "accepted", "running", "produced"]);
/** 可停摆的活状态（可作为 block／wait-user／fail 的来态）。 */
const STALLABLE_STATES = Object.freeze(MAIN_FLOW.filter((state) => state !== "closed"));
/** 非终态（取消的来态：终态不可再取消）。 */
const NON_CLOSED_STATES = Object.freeze([...STALLABLE_STATES, "blocked", "waiting-user", "failed"]);

/**
 * 每态必须答「下一步谁负责、超时怎么办」——答不出即删（规格 §B 生命周期段）。
 * 责任字段是岗位 slug（与 `lib/org/role-cards.js` 同表）或 `user`；超时字段是
 * **该状态超时时的确定性处置**。执行面落点：在手状态（assigned/accepted/
 * running/produced）与队列状态（intake/triaged/planned）的超时已由 `sweep`
 * 执行（07 号票：在手三条＋队列滞留三条）；结算/关闭超时＝09 人间接口、
 * blocked 超时上浮＝08 复核件套，仍随其归属票落地。
 */
export const STATE_RESPONSIBILITY = Object.freeze({
  intake: { responsible: "duty-coordinator", onTimeout: "分诊时限内未分诊→上浮用户（waiting-user）" },
  triaged: { responsible: "project-lead", onTimeout: "立项时限内未立项→退回分诊并通知值班统筹" },
  planned: { responsible: "project-lead", onTimeout: "队列滞留超时→按派单封顶规则上浮用户" },
  assigned: { responsible: "承接岗位（被派实例）", onTimeout: "逾期未接→释放回队列并通知派单方" },
  accepted: { responsible: "承接岗位（被派实例）", onTimeout: "租约到期→回收回队列并通知派单方" },
  running: { responsible: "承接岗位（被派实例）", onTimeout: "心跳缺失超租约→回收回队列，重派封顶后上浮用户" },
  produced: { responsible: "project-lead", onTimeout: "交付时限内未交付→通知派单方并计入重派" },
  delivered: { responsible: "project-lead（项目）／duty-coordinator（例程）", onTimeout: "结算超时→登记异常并上浮用户" },
  settled: { responsible: "project-lead（项目）／duty-coordinator（例程）", onTimeout: "关闭超时→登记异常并上浮用户" },
  closed: { responsible: "无（只读）", onTimeout: "无（终态；要改＝supersedesTaskId 开新任务）" },
  blocked: { responsible: "承接岗位（被派实例）", onTimeout: "阻塞超时→上浮用户（waiting-user）并通知派单方" },
  "waiting-user": { responsible: "user", onTimeout: "无自动动作（等用户终裁；不占租约、不烧 token）" },
  failed: { responsible: "承接岗位（被派实例）", onTimeout: "失败超时→退还队列（requeue）或按封顶上浮用户" },
  cancelled: { responsible: "无（只读）", onTimeout: "无（终态；归档不删档）" }
});

/**
 * 队列滞留的确定性处置表（07 号票；05 号票 STATE_RESPONSIBILITY 三条队列态
 * onTimeout 的执行面）：intake 分诊超时→上浮用户；triaged 立项超时→退回分诊
 * （`return` 事件，通知值班统筹）；planned 派单滞留→上浮用户（`escalated`）。
 * 时限＝`LEASE_DEFAULTS.stallMs`（用户域缝），自进入该状态（updatedAt）起算。
 */
const QUEUE_STALL_ACTIONS = Object.freeze({
  intake: { type: "wait-user", payload: () => ({ reason: "分诊时限内未分诊→上浮用户" }) },
  triaged: { type: "return", payload: () => ({ reason: "立项时限内未立项→退回分诊并通知值班统筹" }) },
  planned: {
    type: "escalated",
    payload: (task) => ({ cause: "queue-stall", dispatchCount: task.dispatchCount, previousOwner: task.owner })
  }
});

/** 异常四类（统一走台账、不静默丢失）。 */
export const EXCEPTION_KINDS = Object.freeze([
  "instance-death", "task-stalled", "waiting-user", "waiting-external"
]);

/** 租约与重派默认值（数值属用户域：可配置的缝，宿主接线可逐项覆盖）。
 *  `stallMs`＝队列滞留时限（intake/triaged/planned 三队列态共用一条缝；07 号票）。 */
export const LEASE_DEFAULTS = Object.freeze({
  acceptMs: 10 * 60 * 1000,
  leaseMs: 15 * 60 * 1000,
  redispatchCap: 3,
  stallMs: 30 * 60 * 1000
});

// ---------------- 事件表 ----------------

const NON_STATE_TYPES = Object.freeze([
  "heartbeat", "amend", "judgement", "command-rejected", "exception",
  "review-requested", "review-reported"
]);

/**
 * 分诊四值 → 目标状态（规格 §B：直办／立项／澄清／拒收）。**直办与立项在本票都落到
 * `triaged`**——两者的差异是执行形态（直办＝命中确定性规则表／例程后不再走立项流程）
 * 不属台账状态机，归 07 号票（四要素简报与派单）；本票只做取值合法性与确定性映射，
 * 未知取值即拒（不静默降级成某个状态）。
 */
export const TRIAGE_DECISIONS = Object.freeze({
  "直办": "triaged",
  "立项": "triaged",
  "澄清": "waiting-user",
  "拒收": "cancelled"
});

/** 状态事件类型 → 目标状态（**目标只由 op/事件类型决定，不接受调用方直写状态**）。 */
const STATE_EVENT_TARGET = Object.freeze({
  intake: () => "intake",
  triage: (payload) => TRIAGE_DECISIONS[payload.decision],
  plan: () => "planned",
  assign: () => "assigned",
  accept: () => "accepted",
  decline: () => "planned",
  return: () => "intake",
  start: () => "running",
  report: () => "produced",
  deliver: () => "delivered",
  settle: () => "settled",
  close: () => "closed",
  block: () => "blocked",
  unblock: (payload) => payload.resumeTo,
  "wait-user": () => "waiting-user",
  resume: (payload) => payload.resumeTo,
  fail: () => "failed",
  requeue: () => "planned",
  cancel: () => "cancelled",
  "lease-expired": () => "planned",
  "lease-reclaimed": () => "planned",
  escalated: () => "waiting-user"
});

/** 可恢复到的状态白名单（block／wait-user 之后的归位点）。 */
export const RESUME_STATES = Object.freeze([
  "triaged", "planned", "assigned", "accepted", "running", "produced", "delivered"
]);

/** 状态事件的来态白名单。 */
const ALLOWED_FROM = Object.freeze({
  intake: null,
  triage: ["intake"],
  plan: ["triaged"],
  assign: ["planned"],
  accept: ["assigned"],
  decline: ["assigned"],
  return: ["triaged"],
  start: ["accepted"],
  report: ["running"],
  deliver: ["produced"],
  settle: ["delivered"],
  close: ["settled"],
  block: STALLABLE_STATES,
  unblock: ["blocked"],
  "wait-user": STALLABLE_STATES,
  resume: ["waiting-user"],
  fail: STALLABLE_STATES,
  requeue: ["failed", "blocked"],
  cancel: NON_CLOSED_STATES,
  "lease-expired": ["assigned"],
  "lease-reclaimed": HOLDING_STATES,
  // 上浮的来态＝在手四态（租约回收链）＋planned（队列滞留上浮，07 号票 sweep 驱动）
  escalated: [...HOLDING_STATES, "planned"]
});

export const EVENT_TYPES = Object.freeze([...Object.keys(STATE_EVENT_TARGET), ...NON_STATE_TYPES]);

/** 状态事件的来态白名单；非状态事件（null）不受转移表约束。 */
function allowedFrom(type) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_FROM, type) ? ALLOWED_FROM[type] : null;
}

/** 每次落事件可携带的额外键（schema 白名单，防未定义键混入事实源）。 */
const EVENT_EXTRA_KEYS = Object.freeze({
  intake: ["class", "brief", "routineId", "window", "supersedesTaskId", "parentTaskId"],
  triage: ["decision", "note"],
  plan: ["brief"],
  assign: ["assignee", "dispatcher", "lease"],
  accept: [],
  decline: ["reason"],
  start: [],
  report: ["deliverable"],
  deliver: [],
  settle: [],
  close: [],
  block: ["reason", "previousStatus"],
  unblock: ["resumeTo", "reason"],
  "wait-user": ["reason", "previousStatus"],
  resume: ["resumeTo"],
  fail: ["reason"],
  requeue: [],
  cancel: ["reason", "attribution"],
  "lease-expired": ["cause", "previousOwner", "dispatcher"],
  "lease-reclaimed": ["cause", "previousOwner", "dispatcher"],
  escalated: ["cause", "dispatchCount", "previousOwner"],
  return: ["reason"],
  heartbeat: ["progress"],
  amend: ["brief"],
  judgement: ["intent", "input"],
  "command-rejected": ["op", "code", "reason", "expectedStatus", "expectedSeq"],
  exception: ["kind", "detail"],
  "review-requested": ["point", "topic", "mandatory", "attribution", "reviewer"],
  "review-reported": ["subject", "verdict", "gaps", "criteriaGaps", "modelIdentity", "reviewer"]
});

/** 命令面：op → 事件类型／可用角色／负载键／约束。（导出＝op-set 表与鉴权面的词表源。）
 *  06 号票起管理类 op 放行 kind=post——**岗位维度的细分白名单在鉴权器**
 *  （op-set 表 ∪ 当次签发，见 lib/org/permissions.js），确定性层只守角色类粗门。 */
export const OPS = Object.freeze({
  "task.intake": { type: "intake", actorKinds: ["host", "user", "post"], creates: true },
  "task.triage": { type: "triage", actorKinds: ["host", "user", "post"], cas: true },
  "task.plan": { type: "plan", actorKinds: ["host", "user", "post"], cas: true },
  "task.assign": { type: "assign", actorKinds: ["host", "user", "post"], cas: true },
  "task.accept": { type: "accept", actorKinds: ["post"], cas: true, ownerOnly: true },
  "task.decline": { type: "decline", actorKinds: ["post"], cas: true, ownerOnly: true },
  "task.start": { type: "start", actorKinds: ["post"], cas: true, ownerOnly: true },
  "task.report": { type: "report", actorKinds: ["post"], cas: true, ownerOnly: true },
  "task.deliver": { type: "deliver", actorKinds: ["post", "host"], cas: true, ownerOnly: true },
  "task.settle": { type: "settle", actorKinds: ["host", "user", "post"], cas: true },
  "task.close": { type: "close", actorKinds: ["host", "user", "post"], cas: true },
  "task.block": { type: "block", actorKinds: ["post", "host"], cas: true, ownerOnly: true },
  "task.unblock": { type: "unblock", actorKinds: ["host", "user", "post"], cas: true },
  "task.wait-user": { type: "wait-user", actorKinds: ["host", "user", "post"], cas: true, postOwnerOnly: true },
  "task.resume": { type: "resume", actorKinds: ["host", "user", "post"], cas: true },
  "task.fail": { type: "fail", actorKinds: ["post", "host"], cas: true, ownerOnly: true },
  "task.requeue": { type: "requeue", actorKinds: ["host", "user", "post"], cas: true },
  "task.cancel": { type: "cancel", actorKinds: ["host", "user", "post"], cas: true },
  "task.heartbeat": { type: "heartbeat", actorKinds: ["post", "host"], ownerOnly: true },
  "task.return": { type: "return", actorKinds: ["host", "user"], cas: true },
  "task.amend": { type: "amend", actorKinds: ["host", "user", "post"], cas: true },
  "task.judge": { type: "judgement", actorKinds: ["post", "host"] },
  "task.exception": { type: "exception", actorKinds: ["host", "post", "user"] },
  // 复核请求（08 号票）：非状态事实。管理类 op（host/user）＋project-lead 岗位
  // （op-set 表，06 号票对账口径）；负载校验见命令面专项段。
  "review.request": { type: "review-requested", actorKinds: ["host", "user", "post"] }
});

/** 通知＝台账事件投影：事件类型 → 收件人角色（无映射＝不通知）。 */
const NOTIFY_TO = Object.freeze({
  assign: "assignee",
  accept: "dispatcher",
  decline: "dispatcher",
  report: "dispatcher",
  deliver: "dispatcher",
  block: "dispatcher",
  "wait-user": "user",
  return: "duty-coordinator",
  escalated: "user",
  "lease-expired": "dispatcher",
  "lease-reclaimed": "dispatcher",
  exception: "user",
  amend: "owner",
  close: "dispatcher",
  cancel: "dispatcher",
  "review-requested": "reviewer",
  "review-reported": "owner"
});

// ---------------- 记录校验 ----------------

const CORE_KEYS = ["seq", "eventId", "type", "at", "taskId", "actor", "writerEpoch", "eventHash"];

/**
 * schema／hash 链校验**复用共用件原语**（`createEventSourcing`，02 号票纪律：同一原语
 * 不得在两处各留一份）：类型表与负载键白名单喂给共用件，`taskId`／`actor` 作为每类的
 * 公共负载键加入白名单。**转移合法性不交给共用件的 `foldEvents`**——共用件的 fold 假设
 * 「事件类型即状态」，而台账的事件类型是命令、状态是类型到状态的映射（且含 heartbeat／
 * judgement 等非状态事件），故折叠在 `projectEvents` 内按状态映射表实现。
 */
const ledgerSchema = createEventSourcing({
  eventTypes: EVENT_TYPES,
  payloadKeysByType: Object.fromEntries(
    EVENT_TYPES.map((type) => [type, ["taskId", "actor", ...(EVENT_EXTRA_KEYS[type] ?? [])]])
  ),
  legalTransition: () => true
});

function isValidActor(actor) {
  return Boolean(actor) && typeof actor === "object" && !Array.isArray(actor) &&
    ACTOR_KINDS.includes(actor.kind) && typeof actor.id === "string" && actor.id !== "";
}

/**
 * 事件 schema＋hash 链校验（fail closed：任一条不符即视为事实源损坏）。
 * 通用部分（核心键／键白名单／type／at／writerEpoch／eventHash 复算）委托共用件；
 * 台账域附加：全局 seq 连续性、taskId 形状、actor 形状。
 */
export function validateEventRecord(event, previousSeq = 0) {
  const generic = ledgerSchema.validateEventRecord(event);
  if (!generic.ok) return generic;
  if (!Number.isInteger(event.seq) || event.seq !== previousSeq + 1) {
    return { ok: false, reason: `事件 seq 不连续（期望 ${String(previousSeq + 1)}，实际 ${String(event.seq)}）` };
  }
  if (!isTaskId(event.taskId)) return { ok: false, reason: `事件 taskId 非法（${String(event.taskId)}）` };
  if (!isValidActor(event.actor)) return { ok: false, reason: "事件 actor 非法（须 {kind: host|user|post, id}）" };
  return { ok: true };
}

// ---------------- 投影 ----------------

function emptyTask(taskId) {
  return {
    taskId,
    class: null,
    status: null,
    owner: null,
    dispatcher: null,
    lease: { acceptBy: null, expiresAt: null, heartbeats: 0 },
    dispatchCount: 0,
    brief: null,
    routineId: null,
    window: null,
    supersedesTaskId: null,
    parentTaskId: null,
    createdAt: null,
    updatedAt: null,
    lastSeq: 0,
    resumeFrom: null,
    lastRejection: null
  };
}

function applyEvent(task, event) {
  if (event.type === "command-rejected") {
    task.lastRejection = { at: event.at, op: event.op, code: event.code, reason: event.reason };
    return;
  }
  if (event.type === "exception") return; // 异常是告警事件，不改状态（状态改写仍走命令面）
  if (event.type === "judgement") return; // LLM 判断输入：只落事实，不写状态
  if (event.type === "review-requested" || event.type === "review-reported") return; // 复核事实：由 review-kit 折叠消费，不改状态
  if (event.type === "heartbeat") {
    const base = task.lease.expiresAt !== null ? Date.parse(task.lease.expiresAt) : Date.parse(event.at);
    task.lease.heartbeats += 1;
    task.lease.expiresAt = new Date(base + task.lease.leaseMs).toISOString();
    if (typeof event.progress === "string") task.lease.progress = event.progress;
    return;
  }
  if (event.type === "amend") {
    if (event.brief) task.brief = event.brief;
    return;
  }
  // 状态事件
  task.status = STATE_EVENT_TARGET[event.type](event);
  if (event.type === "intake") {
    task.class = event.class;
    task.brief = event.brief ?? null;
    task.routineId = event.routineId ?? null;
    task.window = event.window ?? null;
    task.supersedesTaskId = event.supersedesTaskId ?? null;
    task.parentTaskId = event.parentTaskId ?? null;
    task.createdAt = event.at;
    task.dispatchCount = 0;
  }
  if (event.type === "plan" && event.brief) task.brief = event.brief; // 立项产出简报（07 号票）
  if (event.type === "assign") {
    task.owner = event.assignee;
    task.dispatcher = event.dispatcher ?? task.dispatcher;
    task.dispatchCount += 1;
    task.lease = {
      acceptBy: event.lease?.acceptBy ?? null,
      expiresAt: event.lease?.expiresAt ?? null,
      heartbeats: 0,
      leaseMs: event.lease?.leaseMs ?? task.lease.leaseMs
    };
  }
  if (event.type === "accept" && task.lease.acceptBy !== null) {
    task.lease.acceptBy = null; // 已接单：接单时限不再适用，之后由租约心跳把守
  }
  if (event.type === "block" || event.type === "wait-user") task.resumeFrom = event.previousStatus ?? task.resumeFrom;
  if (event.type === "lease-expired" || event.type === "lease-reclaimed" || event.type === "escalated") {
    task.owner = null;
    task.lease = { acceptBy: null, expiresAt: null, heartbeats: 0, leaseMs: task.lease.leaseMs };
  }
  if (event.type === "unblock" || event.type === "resume") task.resumeFrom = null;
  if (event.type === "requeue" || event.type === "decline") task.owner = null;
}

/**
 * 事件序列 → 任务投影（provenance 根＝taskId；状态＝序列折叠的结论）。
 * 非法转移/坏链在折叠时 fail closed（返回 {ok:false}）。
 */
export function projectEvents(events, taskId) {
  const task = emptyTask(taskId);
  let lastSeq = 0;
  for (const event of events) {
    const schema = validateEventRecord(event, lastSeq);
    if (!schema.ok) return { ok: false, reason: schema.reason, corrupt: true };
    lastSeq = event.seq; // 全局 seq 连续性是事实源不变量，与本任务过滤无关
    if (event.taskId !== taskId) continue;
    if (event.type !== "command-rejected" && event.type !== "exception" && event.type !== "judgement") {
      const from = allowedFrom(event.type);
      if (event.type !== "intake" && from !== null && !from.includes(task.status)) {
        return { ok: false, reason: `非法 transition：${String(task.status)} → ${String(event.type)}`, corrupt: true };
      }
    }
    applyEvent(task, event);
    task.lastSeq = event.seq;
  }
  task.updatedAt = task.lastSeq > 0 ? events.find((event) => event.seq === task.lastSeq)?.at ?? null : null;
  return { ok: true, task };
}

// ---------------- 台账 ----------------

function leaseOptions(overrides = {}) {
  const merged = { ...LEASE_DEFAULTS };
  for (const key of Object.keys(LEASE_DEFAULTS)) {
    if (Number.isInteger(overrides[key]) && overrides[key] > 0) merged[key] = overrides[key];
  }
  return merged;
}

function newTaskId() {
  return `TK-${randomBytes(5).toString("hex")}`;
}

function newEventId() {
  return `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

/** 简报校验结论 → 拒绝理由文本；合法返回 null（07 号票：简报入事实源必校验）。 */
function briefRejectReason(brief) {
  const verdict = validateBrief(brief);
  if (verdict.ok) return null;
  const parts = [...verdict.violations, ...(verdict.gap !== null ? [verdict.gap.reason] : [])];
  return `四要素简报不合法（fail closed）：${parts.join("；")}`;
}

/**
 * 建台账门面。`dshHome`＝数据根；`now`＝时钟（注入以便假时钟测试）；
 * `lease`＝时限/封顶覆盖（用户域数值的缝）。
 *
 * 写路径：命令面 → `ensureLock()`（首次写获取并持有台账写锁）→ 事件 schema 组装
 * → `requireLockOwnership`（fencing：迟写者拒绝）→ O_APPEND 追加 → 幂等预留落盘。
 * 读路径：不加锁（append-only 文件，读侧 fail closed 校验 hash 链）。
 */
export function createTaskLedger({ dshHome, now = () => Date.now(), lease = {}, lockSpinMs, authorize } = {}) {
  if (typeof dshHome !== "string" || dshHome === "") throw new Error("createTaskLedger 需要 dshHome");
  const leaseOpts = leaseOptions(lease);
  const reservations = createReservationIndex({
    dir: idempotencyDir(dshHome),
    validate(record) {
      if (!record || typeof record !== "object") return { ok: false, reason: "记录非对象" };
      if (typeof record.idempotencyKeyHash !== "string" || record.idempotencyKeyHash !== reservationKeyHash(record.idempotencyKey ?? "")) {
        return { ok: false, reason: "幂等键 hash 不符" };
      }
      if (!record.result || typeof record.result !== "object") return { ok: false, reason: "缺首次结论" };
      return { ok: true };
    }
  });

  let lock = null;
  let closed = false;

  function lockOptions(extra = {}) {
    return {
      lockDir: lockDirFor(dshHome),
      epochFile: epochFile(dshHome),
      auditFile: auditFile(dshHome),
      ...(Number.isInteger(lockSpinMs) && lockSpinMs >= 0 ? { spinMs: lockSpinMs } : {}),
      ...extra
    };
  }

  function ensureLock() {
    if (closed) return { ok: false, code: "ledger-closed", reason: "台账已关闭（写锁已释放）" };
    if (lock !== null) return { ok: true, lock };
    try {
      lock = baseAcquireStoreLock(dshHome, lockOptions());
    } catch (error) {
      return { ok: false, code: "ledger-locked", reason: `台账写锁被其他写者持有（fail closed）：${error.message}` };
    }
    return { ok: true, lock };
  }

  /** 读全量事件（fail closed：坏行/坏链即抛，不静默跳过）。 */
  function readEvents() {
    const parsed = readJsonl(eventsFile(dshHome));
    if (parsed.corrupt.length > 0) throw new Error(`台账事件日志存在 ${parsed.corrupt.length} 条损坏行（fail closed）`);
    let previousSeq = 0;
    for (const event of parsed.parsed) {
      const schema = validateEventRecord(event, previousSeq);
      if (!schema.ok) throw new Error(`台账事件链损坏（fail closed）：${schema.reason}`);
      previousSeq = event.seq;
    }
    return parsed.parsed;
  }

  function writeEvent(event) {
    // 写前校验（fail closed）：不合规事件绝不入事实源——否则读侧会永久判损坏。
    const schema = validateEventRecord(event, event.seq - 1);
    if (!schema.ok) {
      return { ok: false, code: "invalid-event", reason: `事件 schema 校验失败，拒绝写入（fail closed）：${schema.reason}` };
    }
    const held = ensureLock();
    if (!held.ok) return held;
    try {
      requireLockOwnership(held.lock, {
        ownerDir: lockDirFor(dshHome), epochPath: epochFile(dshHome), auditFile: auditFile(dshHome)
      }, "ledger-append", { seq: event.seq, type: event.type });
    } catch (error) {
      return { ok: false, code: "ledger-fenced", reason: error.message };
    }
    appendJsonlLine(eventsFile(dshHome), event);
    return { ok: true };
  }

  function buildEvent(type, { taskId, actor, payload = {}, at, writerEpoch, seq }) {
    const event = { seq, eventId: newEventId(), type, at, taskId, actor, writerEpoch };
    for (const key of EVENT_EXTRA_KEYS[type] ?? []) {
      if (payload[key] !== undefined) event[key] = payload[key];
    }
    event.eventHash = eventHashFor(event);
    return event;
  }

  /**
   * 幂等前置（命令／判断输入／异常登记共用）：键必填；命中即返回首次结论（不再落事件）。
   * 返回 {prior} 或 {error}。
   */
  function idempotencyGate(idempotencyKey) {
    if (typeof idempotencyKey !== "string" || idempotencyKey === "") {
      return { error: { ok: false, code: "idempotency-key-required", reason: "命令必须自带幂等键" } };
    }
    try {
      return { prior: reservations.readByHash(reservationKeyHash(idempotencyKey)) };
    } catch (error) {
      return { error: { ok: false, code: "idempotency-index-corrupt", reason: error.message } };
    }
  }

  function reserve(idempotencyKey, record) {
    const keyHash = reservationKeyHash(idempotencyKey);
    reservations.write({ idempotencyKeyHash: keyHash, idempotencyKey, at: new Date(now()).toISOString(), ...record });
    return keyHash;
  }

  /** 事件流内查任务投影：不存在＝null；投影损坏＝抛（fail closed——读侧统一抛、命令面统一转 code）。 */
  function findTask(events, taskId) {
    if (!events.some((event) => event.taskId === taskId)) return null;
    const projection = projectEvents(events, taskId);
    if (!projection.ok) throw new Error(`台账投影损坏（fail closed）：${projection.reason}`);
    return projection.task;
  }

  function loadTask(taskId) {
    return findTask(readEvents(), taskId);
  }

  function reject(taskId, actor, idempotencyKey, op, code, reason, detail = {}) {
    const seq = lastSeqOf() + 1;
    const held = ensureLock();
    if (held.ok) {
      const event = buildEvent("command-rejected", {
        taskId, actor, payload: { op, code, reason, ...detail }, at: new Date(now()).toISOString(),
        writerEpoch: held.lock.writerEpoch, seq
      });
      const written = writeEvent(event);
      if (!written.ok) return written;
    }
    const result = { ok: false, code, reason };
    reserve(idempotencyKey, { taskId, op, result });
    return result;
  }

  function lastSeqOf() {
    const events = readEvents();
    return events.length === 0 ? 0 : events[events.length - 1].seq;
  }

  function holdingsOf(botId, events = readEvents()) {
    for (const task of foldAll(events)) {
      if (task.owner === botId && HOLDING_STATES.includes(task.status)) return task;
    }
    return null;
  }

  function foldAll(events = readEvents()) {
    const ids = [];
    const seen = new Set();
    for (const event of events) {
      if (!seen.has(event.taskId)) {
        seen.add(event.taskId);
        ids.push(event.taskId);
      }
    }
    return ids.map((id) => findTask(events, id));
  }

  function appendStateEvent({ task, type, actor, payload, idempotencyKey, op }) {
    const seq = lastSeqOf() + 1;
    const held = ensureLock();
    if (!held.ok) return held;
    const at = new Date(now()).toISOString();
    const enriched = { ...payload };
    if (type === "assign") {
      enriched.lease = {
        acceptBy: new Date(now() + leaseOpts.acceptMs).toISOString(),
        expiresAt: new Date(now() + leaseOpts.acceptMs + leaseOpts.leaseMs).toISOString(),
        leaseMs: leaseOpts.leaseMs
      };
      // 派单方默认＝派单动作的发起者（拒收/回收的「通知派单方」由此可路由；
      // 显式 payload.dispatcher 优先——host 代为派单时可点名真实派单岗位）
      enriched.dispatcher = payload.dispatcher ?? actor.id;
    }
    // 状态事件的来态留痕（用于 resume/审计可核；键已入 EVENT_EXTRA_KEYS 白名单）
    if ((type === "block" || type === "wait-user") && task) enriched.previousStatus = task.status;
    const event = buildEvent(type, {
      taskId: task?.taskId ?? payload.taskId, actor, payload: enriched, at,
      writerEpoch: held.lock.writerEpoch, seq
    });
    const written = writeEvent(event);
    if (!written.ok) return written;
    const after = loadTask(event.taskId);
    const result = { ok: true, taskId: event.taskId, status: after.status, seq: event.seq };
    reserve(idempotencyKey, { taskId: event.taskId, op, result });
    return { ...result, task: after, event };
  }

  const ledger = {
    dshHome,
    leaseOptions: leaseOpts,

    /** 读：全部事件（按 seq 升序）。 */
    events({ taskId } = {}) {
      const events = readEvents();
      return taskId === undefined ? events : events.filter((event) => event.taskId === taskId);
    },
    /** 读：单任务投影（不存在＝null）。 */
    task(taskId) {
      if (!isTaskId(taskId)) return null;
      return findTask(readEvents(), taskId);
    },
    /** 读：全部任务投影（含已关闭——归档不删档）。 */
    tasks() {
      return foldAll();
    },
    /** 读：未闭合队列（重启后由此重建在办集合；`V-A2.2`）。 */
    openQueue() {
      return foldAll().filter((task) => !CLOSED_STATES.includes(task.status));
    },
    /** 读：某实例在手的进行中任务（`V-A2.6`）。 */
    holdingsFor(botId) {
      return holdingsOf(botId);
    },
    /** 读：SSE `ledger` 事件载荷（台账投影）。 */
    view() {
      const events = readEvents();
      const tasks = foldAll(events);
      return {
        lastSeq: events.length === 0 ? 0 : events[events.length - 1].seq,
        open: tasks.filter((task) => !CLOSED_STATES.includes(task.status)).length,
        tasks
      };
    },
    /**
     * 通知投影：`seq > cursor` 的可通知事件（无事件不通知——通知不是独立事实源）。
     * `to` 为岗位 slug／`user`／被派实例 id。
     */
    notificationsAfter(cursor = 0) {
      const events = readEvents();
      const notifications = [];
      for (const event of events) {
        if (event.seq <= cursor) continue;
        const role = NOTIFY_TO[event.type];
        if (role === undefined) continue;
        const task = projectEvents(events, event.taskId).task;
        // 收件人解析：assignee＝被派方；dispatcher＝派单方；owner＝**任务在手者**
        // （amend 后须通知承接方本人，不是改动发起人）；其余＝角色名（user）。
        const to = role === "assignee" ? (event.assignee ?? task.owner)
          : role === "dispatcher" ? (event.dispatcher ?? task.dispatcher)
            : role === "owner" ? task.owner
              : role === "reviewer" ? (event.reviewer ?? task.owner)
                : role;
        notifications.push({
          seq: event.seq, taskId: event.taskId, type: event.type, to,
          text: `${event.type}：任务 ${event.taskId}（seq ${String(event.seq)}）`
        });
      }
      return { cursor: events.length === 0 ? 0 : events[events.length - 1].seq, notifications };
    },

    /**
     * 命令面（唯一写入口）。合法性与 CAS 由确定性层判定；**不接受调用方直写状态**。
     * 返回 `{ok:true, taskId, status, seq, task, event}` 或
     * `{ok:false, code, reason}`（fail closed，状态不变）。
     */
    command(input = {}) {
      const { op, taskId, actor, idempotencyKey, expectedStatus, expectedSeq, payload = {} } = input;
      if (typeof op !== "string" || OPS[op] === undefined) return { ok: false, code: "unknown-op", reason: `未知命令 op：${String(op)}` };
      const spec = OPS[op];
      if (!isTaskId(taskId)) return { ok: false, code: "invalid-task-id", reason: `taskId 非法（须 TK- 前缀）：${String(taskId)}` };
      if (!isValidActor(actor)) return { ok: false, code: "invalid-actor", reason: "actor 须为 {kind: host|user|post, id}" };
      const gate = idempotencyGate(idempotencyKey);
      if (gate.error) return gate.error;
      if (gate.prior !== null) {
        return { ...gate.prior.result, replayed: true, task: ledger.task(gate.prior.result.taskId ?? taskId) };
      }
      if (!spec.actorKinds.includes(actor.kind)) {
        return reject(taskId, actor, idempotencyKey, op, "actor-not-allowed", `${actor.kind} 不得调用 ${op}（状态写入角色受限）`);
      }
      // 鉴权三元组（06 号票；V-A3.2）：kind=post 须过信封/白名单/任务域，拒绝沿
      // reject() 落账（V-A3.6）。未装 authorize（纯确定性层用法）＝不设此门。
      if (authorize !== undefined) {
        const verdict = authorize({ op, taskId, actor, capability: input.capability });
        if (verdict && verdict.ok === false) {
          return reject(taskId, actor, idempotencyKey, op, verdict.code ?? "unauthorized", verdict.reason ?? "鉴权拒绝（fail closed）");
        }
      }
      // 负载键白名单：未定义键即拒（fail closed——不静默丢弃调用方以为记下的字段）
      const allowedPayload = new Set(["taskId", ...(EVENT_EXTRA_KEYS[spec.type] ?? [])]);
      const unknownKeys = Object.keys(payload ?? {}).filter((key) => !allowedPayload.has(key));
      if (unknownKeys.length > 0) {
        return reject(taskId, actor, idempotencyKey, op, "unknown-payload-key",
          `${op} 的负载含未定义键：${unknownKeys.join("、")}（白名单见 EVENT_EXTRA_KEYS）`);
      }
      let events;
      let existing;
      try {
        events = readEvents();
        existing = findTask(events, taskId);
      } catch (error) {
        return { ok: false, code: "ledger-corrupt", reason: error.message };
      }

      if (spec.creates) {
        if (existing !== null) return reject(taskId, actor, idempotencyKey, op, "task-exists", `任务 ${taskId} 已存在（不重复开档）`);
        const taskClass = payload.class;
        if (taskClass !== "duty" && taskClass !== "project") {
          return reject(taskId, actor, idempotencyKey, op, "invalid-class", `class 须为 duty|project：${String(taskClass)}`);
        }
        if (payload.brief !== undefined && payload.brief !== null) {
          const reason = briefRejectReason(payload.brief);
          if (reason !== null) return reject(taskId, actor, idempotencyKey, op, "invalid-brief", reason);
        }
        if (payload.supersedesTaskId !== undefined) {
          if (!isTaskId(payload.supersedesTaskId)) {
            return reject(taskId, actor, idempotencyKey, op, "invalid-supersedes", "supersedesTaskId 非法");
          }
          let old;
          try {
            old = findTask(events, payload.supersedesTaskId);
          } catch (error) {
            return { ok: false, code: "ledger-corrupt", reason: error.message };
          }
          if (old === null) return reject(taskId, actor, idempotencyKey, op, "supersedes-not-found", `被取代任务不存在：${payload.supersedesTaskId}`);
          if (!CLOSED_STATES.includes(old.status)) {
            return reject(taskId, actor, idempotencyKey, op, "supersedes-not-closed", `被取代任务未闭合（${old.status}）——关闭即只读，改动用新任务引用`);
          }
        }
        const created = appendStateEvent({
          task: { taskId }, type: "intake", actor, payload: { ...payload, taskId }, idempotencyKey, op
        });
        return created;
      }

      if (existing === null) return reject(taskId, actor, idempotencyKey, op, "task-not-found", `任务不存在：${taskId}`);
      if (CLOSED_STATES.includes(existing.status)) {
        return reject(taskId, actor, idempotencyKey, op, "task-closed",
          `任务已终态（${existing.status}）——关闭不可重开，改动用 supersedesTaskId 开新任务`);
      }
      // CAS：期望状态＋期望序号**都必填**（规格 §D「命令携带期望状态与序号，不符即拒」）
      if (spec.cas) {
        if (typeof expectedStatus !== "string" || expectedStatus === "" || !Number.isInteger(expectedSeq)) {
          return reject(taskId, actor, idempotencyKey, op, "cas-required",
            "状态改写类命令必须携带期望状态与期望序号（CAS）", { expectedStatus: expectedStatus ?? null, expectedSeq: expectedSeq ?? null });
        }
        if (expectedStatus !== existing.status) {
          return reject(taskId, actor, idempotencyKey, op, "cas-mismatch",
            `期望状态 ${expectedStatus} 与当前 ${existing.status} 不符（CAS 拒绝）`,
            { expectedStatus, expectedSeq, taskStatus: existing.status });
        }
        if (expectedSeq !== existing.lastSeq) {
          return reject(taskId, actor, idempotencyKey, op, "cas-mismatch",
            `期望序号 ${String(expectedSeq)} 与当前 ${String(existing.lastSeq)} 不符（CAS 拒绝）`,
            { expectedStatus, expectedSeq, taskStatus: existing.status });
        }
      }
      // 转移合法性
      const from = allowedFrom(spec.type);
      if (from !== null && !from.includes(existing.status)) {
        return reject(taskId, actor, idempotencyKey, op, "illegal-transition",
          `非法转移：${existing.status} → ${spec.type}`);
      }
      // 权限：承接类转移只许当前归属者本人（合法性判定在前——非法转移先报非法）；
      // wait-user 的 post 触发同限归属者，host／user 上浮裁定放行（规格 §F）
      const ownerRequired = spec.ownerOnly || (spec.postOwnerOnly && actor.kind === "post");
      if (ownerRequired && existing.owner !== actor.id) {
        return reject(taskId, actor, idempotencyKey, op, "not-owner", `非当前归属者（owner=${String(existing.owner)}）不得执行 ${op}`);
      }
      // 类型专项校验：分诊四值、异常四类（未知取值即拒，不静默降级）
      if (spec.type === "triage" && TRIAGE_DECISIONS[payload.decision] === undefined) {
        return reject(taskId, actor, idempotencyKey, op, "invalid-triage-decision",
          `分诊取值须为 ${Object.keys(TRIAGE_DECISIONS).join("|")} 之一：${String(payload.decision)}`);
      }
      // 简报契约（07 号票，V-A2.4）：立项可携带简报、amend 必须携带完整合法简报
      // （冻结件只允许被完整合法件置换）、派出即冻结（assign 前置校验在场与合法）
      if (spec.type === "plan" && payload.brief !== undefined && payload.brief !== null) {
        const reason = briefRejectReason(payload.brief);
        if (reason !== null) return reject(taskId, actor, idempotencyKey, op, "invalid-brief", reason);
      }
      if (spec.type === "amend") {
        if (payload.brief === undefined || payload.brief === null) {
          return reject(taskId, actor, idempotencyKey, op, "invalid-brief",
            "amend 必须携带完整简报（冻结件只允许被完整合法件置换）");
        }
        const reason = briefRejectReason(payload.brief);
        if (reason !== null) return reject(taskId, actor, idempotencyKey, op, "invalid-brief", reason);
      }
      if (spec.type === "assign") {
        if (existing.brief === null || existing.brief === undefined) {
          return reject(taskId, actor, idempotencyKey, op, "brief-missing",
            "派出即冻结：简报须在派单前成形（intake/plan/amend 携带）——无契约不得派单");
        }
        const reason = briefRejectReason(existing.brief);
        if (reason !== null) return reject(taskId, actor, idempotencyKey, op, "invalid-brief", reason);
      }
      if (spec.type === "decline" && payload.reason !== undefined && !isNonEmptyString(payload.reason)) {
        return reject(taskId, actor, idempotencyKey, op, "decline-reason-required",
          "拒收理由给出时须为非空字符串（规格 §B「可带理由拒收」——理由可选，给出即留痕）");
      }
      if (spec.type === "exception" && !EXCEPTION_KINDS.includes(payload.kind)) {
        return reject(taskId, actor, idempotencyKey, op, "invalid-exception-kind",
          `异常类别须为 ${EXCEPTION_KINDS.join("|")}：${String(payload.kind)}`);
      }
      // 目标状态由事件类型决定；resume 类须给白名单内的归位点
      if (spec.type === "unblock" || spec.type === "resume") {
        if (!RESUME_STATES.includes(payload.resumeTo)) {
          return reject(taskId, actor, idempotencyKey, op, "invalid-resume-target",
            `resumeTo 须为 ${RESUME_STATES.join("|")} 之一：${String(payload.resumeTo)}`);
        }
      }
      // 复核件套（08 号票，规格 §C）：请求须给必审枚举点或咨询主题（二选一）；
      // 简报冻结点不可降级（可加审不可免审）；强制加审须留归因；复核帽＝当次
      // 空闲实例佩戴、排除本任务产出方
      if (spec.type === "review-requested") {
        const hasPoint = isNonEmptyString(payload.point);
        const hasTopic = isNonEmptyString(payload.topic);
        if (hasPoint === hasTopic) {
          return reject(taskId, actor, idempotencyKey, op, "invalid-review-point",
            hasPoint && hasTopic
              ? "point 与 topic 只能给一个（必审复核点或咨询主题，二选一）"
              : "复核请求须给必审枚举点 point 或咨询主题 topic（二选一）");
        }
        if (hasPoint && !REVIEW_BOUNDARY_IDS.includes(payload.point)) {
          return reject(taskId, actor, idempotencyKey, op, "invalid-review-point",
            `point 须在必审清单边界枚举（${REVIEW_BOUNDARY_IDS.join("｜")}）：${String(payload.point)}`);
        }
        const briefPoints = Array.isArray(existing.brief?.reviewPoints) ? existing.brief.reviewPoints : [];
        const fromBrief = hasPoint && briefPoints.includes(payload.point);
        if (fromBrief && payload.mandatory === false) {
          return reject(taskId, actor, idempotencyKey, op, "review-exemption-forbidden",
            "简报冻结复核点不可降级为咨询性（命中即强制，可加审不可免审）");
        }
        const mandatory = fromBrief || payload.mandatory === true;
        if (mandatory && payload.mandatory !== true) payload.mandatory = true; // 解析结论落事件（冻结点/强制加审同录）
        if (mandatory && !fromBrief && !isNonEmptyString(payload.attribution)) {
          return reject(taskId, actor, idempotencyKey, op, "review-attribution-required",
            "加审须留归因：attribution 必填（枚举点 ∉ 简报冻结清单的强制请求）");
        }
        if (!isNonEmptyString(payload.reviewer)) {
          return reject(taskId, actor, idempotencyKey, op, "reviewer-required",
            "复核请求须指定 reviewer（复核帽＝当次空闲实例佩戴，按需召集）");
        }
        if (payload.reviewer === existing.owner) {
          return reject(taskId, actor, idempotencyKey, op, "reviewer-is-producer",
            "本任务产出方不得自任复核者（独立性硬要求）");
        }
        if (holdingsOf(payload.reviewer, events) !== null) {
          return reject(taskId, actor, idempotencyKey, op, "reviewer-not-idle",
            `实例 ${payload.reviewer} 当前持有进行中任务（复核帽由当次空闲实例佩戴，V-A1.3 台账查询腿）`);
        }
      }
      // 必审拦截（V-A2.7）：必审复核点未闭合（未复核或最近报告 gaps-open）时
      // 交付转移被拒——复核点是边界事件，交付即跨越对外边界
      if (spec.type === "deliver") {
        const open = openMandatorySubjects({ brief: existing.brief, events, taskId });
        if (open.length > 0) {
          return reject(taskId, actor, idempotencyKey, op, "review-gaps-open",
            `必审复核点未闭合（${open.join("、")}）——gaps 未闭合不得交付／回笼`);
        }
      }
      if (spec.type === "assign") {
        if (typeof payload.assignee !== "string" || payload.assignee === "") {
          return reject(taskId, actor, idempotencyKey, op, "invalid-assignee", "派单须指定 assignee");
        }
        const held = holdingsOf(payload.assignee, events);
        if (held !== null && held.taskId !== taskId) {
          return reject(taskId, actor, idempotencyKey, op, "assignee-holding",
            `实例 ${payload.assignee} 已持进行中任务 ${held.taskId}（一实例一进行中任务，机械拒绝）`);
        }
      }
      return appendStateEvent({ task: existing, type: spec.type, actor, payload, idempotencyKey, op });
    },

    /**
     * LLM 判断输入（承接岗提交）：只落 `judgement` 事实，**从不改状态**——状态
     * 改写一律由确定性层按转移表执行（规格 §B）。命令面的薄包装（校验与写只在一处）。
     */
    judgement({ taskId, actor, intent, input, idempotencyKey } = {}) {
      return ledger.command({ op: "task.judge", taskId, actor, idempotencyKey, payload: { intent, input } });
    },

    /**
     * 异常登记（四类统一走台账、不静默丢失）。异常是**告警事件**：不改状态，
     * 状态改写仍走命令面。`idempotencyKey` 必填——同源异常重复登记只留一条。
     */
    raiseException({ taskId, kind, detail = {}, actor = { kind: "host", id: "web" }, idempotencyKey } = {}) {
      return ledger.command({ op: "task.exception", taskId, actor, idempotencyKey, payload: { kind, detail } });
    },

    /**
     * 复核报告入账（org-v2 08 号票；规格 §C「gaps 报告」）。复核帽不是任务
     * owner、无台账写 op——报告由 host 侧经本面落盘（写路径仍是台账内部的
     * 单一写者通道）。机械校验：报告形状（`validateReviewReport`，复核者只读
     * 的形状层——不携带改工件／改判据字段）、subject 已登记请求、提交者＝指定
     * 复核者、产出方不得自任。强制点**连续两轮未闭合自动上浮用户终裁**（追加
     * `escalated`，cause=review-rounds-exhausted；已挂起不重复上浮）。
     */
    recordReviewReport({ taskId, reviewer, report, idempotencyKey } = {}) {
      const op = "review.report";
      const gate = idempotencyGate(idempotencyKey);
      if (gate.error) return gate.error;
      if (gate.prior !== null) {
        return { ...gate.prior.result, replayed: true, task: ledger.task(gate.prior.result.taskId ?? taskId) };
      }
      if (!isTaskId(taskId)) return { ok: false, code: "invalid-task-id", reason: `taskId 非法（须 TK- 前缀）：${String(taskId)}` };
      if (!isNonEmptyString(reviewer)) return { ok: false, code: "invalid-reviewer", reason: "reviewer 必填" };
      const shape = validateReviewReport(report);
      if (!shape.ok) {
        return reject(taskId, { kind: "post", id: reviewer }, idempotencyKey, op, "invalid-review-report",
          `复核报告形状不符（fail closed）：${shape.violations.join("；")}`);
      }
      let events;
      let existing;
      try {
        events = readEvents();
        existing = findTask(events, taskId);
      } catch (error) {
        return { ok: false, code: "ledger-corrupt", reason: error.message };
      }
      if (existing === null) {
        return reject(taskId, { kind: "post", id: reviewer }, idempotencyKey, op, "task-not-found", `任务不存在：${taskId}`);
      }
      if (CLOSED_STATES.includes(existing.status)) {
        return reject(taskId, { kind: "post", id: reviewer }, idempotencyKey, op, "task-closed",
          `任务已终态（${existing.status}），不再受理复核报告`);
      }
      if (reviewer === existing.owner) {
        return reject(taskId, { kind: "post", id: reviewer }, idempotencyKey, op, "reviewer-is-producer",
          "本任务产出方不得自任复核者（独立性硬要求）");
      }
      const entry = collectReviewState({ brief: existing.brief, events, taskId }).subjects.get(report.subject);
      if (entry === undefined) {
        return reject(taskId, { kind: "post", id: reviewer }, idempotencyKey, op, "review-not-requested",
          `subject 未在本任务登记复核请求：${String(report.subject)}`);
      }
      if (entry.reviewer !== reviewer) {
        return reject(taskId, { kind: "post", id: reviewer }, idempotencyKey, op, "not-designated-reviewer",
          `当前指定复核者＝${String(entry.reviewer ?? "(无)")}，非提交者`);
      }
      const seq = lastSeqOf() + 1;
      const held = ensureLock();
      if (!held.ok) return held;
      const payload = {
        subject: report.subject,
        verdict: report.verdict,
        gaps: report.gaps,
        modelIdentity: report.modelIdentity,
        reviewer
      };
      if (report.criteriaGaps !== undefined) payload.criteriaGaps = report.criteriaGaps;
      const event = buildEvent("review-reported", {
        taskId, actor: { kind: "post", id: reviewer }, payload,
        at: new Date(now()).toISOString(), writerEpoch: held.lock.writerEpoch, seq
      });
      const written = writeEvent(event);
      if (!written.ok) return written;
      const afterEntry = collectReviewState({ brief: existing.brief, events: readEvents(), taskId })
        .subjects.get(report.subject);
      let escalated = false;
      let escalationError = null;
      if (afterEntry.mandatory && report.verdict === "gaps-open" &&
          afterEntry.consecutiveUnclosed >= 2 && existing.status !== "waiting-user") {
        const escalation = appendStateEvent({
          task: ledger.task(taskId), type: "escalated", actor: { kind: "host", id: "review-kit" },
          payload: { cause: "review-rounds-exhausted", previousOwner: existing.owner },
          idempotencyKey: `review-escalate:${taskId}:${report.subject}:${String(seq)}`, op
        });
        escalated = escalation.ok === true;
        if (!escalated) escalationError = { code: escalation.code, reason: escalation.reason }; // 上浮失败响亮返回，不静默
      }
      const result = {
        ok: true, taskId, subject: report.subject, round: afterEntry.rounds,
        consecutiveUnclosed: afterEntry.consecutiveUnclosed, escalated
      };
      if (escalationError !== null) result.escalationError = escalationError;
      reserve(idempotencyKey, { taskId, op, result });
      return { ...result, event };
    },

    /**
     * 值守例程触发：幂等键＝「例程 id＋时间窗」，重复触发不产生第二个任务
     * （`V-A2.10`）。例程任务＝class `duty`。
     */
    triggerRoutine({ routineId, window, actor = { kind: "host", id: "web" }, brief, taskId } = {}) {
      if (typeof routineId !== "string" || routineId === "") {
        return { ok: false, code: "invalid-routine-id", reason: "例程 id 必填" };
      }
      if (typeof window !== "string" || window === "") {
        return { ok: false, code: "invalid-window", reason: "时间窗必填（幂等键＝例程 id＋时间窗）" };
      }
      const id = taskId ?? newTaskId();
      return ledger.command({
        op: "task.intake",
        taskId: id,
        actor,
        idempotencyKey: `routine:${routineId}:${window}`,
        payload: { class: "duty", brief, routineId, window }
      });
    },

    /**
     * 轮询回收（值守例程的一份）：逾期未接／租约到期／实例死亡 → 释放回队列并
     * 通知派单方；重派达封顶 → 上浮用户（`escalated`）。同时把两类异常登记进
     * 台账（`instance-death`／`task-stalled`），无静默丢失。队列滞留（intake／
     * triaged／planned 超 `stallMs`）按 QUEUE_STALL_ACTIONS 确定性处置（07 号票）。
     */
    sweep({ at = now(), isInstanceAlive = () => true } = {}) {
      const released = [];
      const escalated = [];
      const stalled = [];
      for (const task of ledger.openQueue()) {
        if (!HOLDING_STATES.includes(task.status) || task.owner === null) {
          // 队列态滞留检查（intake/triaged/planned）
          const stallAction = QUEUE_STALL_ACTIONS[task.status];
          if (stallAction === undefined || typeof task.updatedAt !== "string") continue;
          if (at - Date.parse(task.updatedAt) < leaseOpts.stallMs) continue;
          const result = appendStateEvent({
            task, type: stallAction.type, actor: { kind: "host", id: "web" },
            payload: stallAction.payload(task),
            idempotencyKey: `stall:${stallAction.type}:${task.taskId}:${String(task.lastSeq)}`,
            op: "task.sweep"
          });
          if (result.ok) stalled.push({ taskId: task.taskId, from: task.status, action: stallAction.type });
          continue;
        }
        const holderDead = !isInstanceAlive(task.owner);
        const deadline = task.status === "assigned" ? task.lease.acceptBy : task.lease.expiresAt;
        const timedOut = typeof deadline === "string" && at >= Date.parse(deadline);
        if (!holderDead && !timedOut) continue;
        const cause = holderDead ? "instance-death" : (task.status === "assigned" ? "accept-timeout" : "lease-expired");
        const exceptionKind = holderDead ? "instance-death" : "task-stalled";
        ledger.raiseException({
          taskId: task.taskId,
          kind: exceptionKind,
          detail: { cause, previousOwner: task.owner, deadline, dispatchCount: task.dispatchCount },
          idempotencyKey: `sweep-exception:${exceptionKind}:${task.taskId}:${String(task.lastSeq)}`
        });
        const overCap = task.dispatchCount >= leaseOpts.redispatchCap;
        if (overCap) {
          const result = appendStateEvent({
            task, type: "escalated", actor: { kind: "host", id: "web" },
            payload: { cause, dispatchCount: task.dispatchCount, previousOwner: task.owner },
            idempotencyKey: `escalate:${task.taskId}:${String(task.dispatchCount)}:${cause}`,
            op: "task.sweep"
          });
          if (result.ok) escalated.push({ taskId: task.taskId, cause, dispatchCount: task.dispatchCount });
          continue;
        }
        const type = cause === "accept-timeout" ? "lease-expired" : "lease-reclaimed";
        const result = appendStateEvent({
          task, type, actor: { kind: "host", id: "web" },
          payload: { cause, previousOwner: task.owner, dispatcher: task.dispatcher },
          idempotencyKey: `reclaim:${type}:${task.taskId}:${String(task.lastSeq)}`,
          op: "task.sweep"
        });
        if (result.ok) released.push({ taskId: task.taskId, cause, dispatchCount: task.dispatchCount });
      }
      return { released, escalated, stalled };
    },

    /** 关闭台账（释放写锁；重启重建＝关旧门面后按同一 dshHome 建新门面）。 */
    close() {
      if (lock !== null) {
        try { lock.release(); } catch { /* 锁已不在 */ }
        lock = null;
      }
      closed = true;
    },
    /** 是否已持有写锁（诊断用；不改变语义）。 */
    holdsWriterLock() {
      return lock !== null;
    }
  };

  return ledger;
}
