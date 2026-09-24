/**
 * 台账事件契约叶件（org-v2 28 号票行为保持抽取）——`lib/org/ledger-events.js`。
 *
 * **为什么单独一件**：台账事件的封闭词表（类型／负载键白名单／裁定类与上浮原因
 * 两套枚举）与 schema＋hash 链校验此前住在 `lib/org/task-ledger.js`（1765 行）里。
 * 证据面要**复用同一个校验器**（28 号票：「复验路径可在包外独立重算——复用
 * `validateEventRecord`」），而 `task-ledger.js` 的静态 import 闭包牵动 13 个模块
 * （review-kit／knowledge／memory-layer…，约 250KB）。证据链的执行闭包是
 * **冻结面复验的绑定对象**（`scripts/preflight.mjs` 门②逐文件复验最新包的
 * `sourceManifest`）：把整张组织图拉进闭包，等于此后每次改 `lib/org/*` 都要重出
 * 证据包才能过门②。故此处只抽「事件契约」这一层——它是台账写者与证据复验方
 * **共用的同一原语**（02 号票纪律：同一原语不得在两处各留一份），依赖只有
 * `store-base.js`。
 *
 * 抽取是**行为保持**的：类型表／白名单／枚举／校验器逐字搬来，语义零变化；
 * `task-ledger.js` 与 `human-inbox.js` 原地 import＋再导出，既有调用方不受影响
 * （`EVENT_TYPES`／`isTaskId`／`validateEventRecord` 仍可从 `task-ledger.js` 取，
 * `RULING_CLASS_IDS`／`ESCALATION_CAUSE_IDS` 仍可从 `human-inbox.js` 取）。
 *
 * 本件是**叶件**：除 `./store-base.js` 外不得引入其它仓内依赖——证据面的闭包
 * 大小由这条不变量把守（tests/ledger-events.test.mjs 静态断言 import 面）。
 */
import { createEventSourcing } from "./store-base.js";

// ---------------- 封闭词表 ----------------

/**
 * 三类裁定（封闭枚举，`waiting-user` 的唯一入口词表；`V-A5.1`；09 号票原住
 * human-inbox，28 号票随事件契约下沉至此——`wait-user.class` 白名单的唯一来源）。
 */
export const RULING_CLASSES = Object.freeze([
  { id: "irreversible-write", criterion: "不可逆写入的放行：执行前须用户点头的一次性动作" },
  { id: "escalation", criterion: "上浮终裁：冲突、复核两轮未闭合、越权处置、租约/队列异常" },
  { id: "user-domain", criterion: "用户域裁定请求：模型指派、预算等只属用户域的决定" }
]);

/** 裁定类 id 列表（台账侧必填校验用）。 */
export const RULING_CLASS_IDS = Object.freeze(RULING_CLASSES.map((entry) => entry.id));

/**
 * 上浮终裁原因（封闭枚举；`escalated` 事件的 cause 词表，台账 schema 以它把守）。
 * 两个来源类目：**在案五条**（复核两轮未闭合；sweep 的队列滞留、接单逾期、
 * 租约到期、实例死亡）与**契约六条**（初审拒绝、结算/关闭超时、冲突与越权处置
 * 两项永不可代、`needs-user` 判据缺口分解不出来〔规格 §B 原词；2026-09-19 用户
 * 裁定扩条，19 号票〕）——契约词表的上浮由人间面与后续批次驱动，原因名先冻结
 * 在此，未收录即拒（不静默降级「未分类上浮」）。
 */
export const ESCALATION_CAUSES = Object.freeze([
  { id: "review-rounds-exhausted", criterion: "必审判据连续两轮未闭合（08 号票在案）" },
  { id: "pre-screen-rejected", criterion: "初审拒绝：初审代理不得把问题压在下面（V-A5.4）" },
  { id: "queue-stall", criterion: "队列滞留（派单封顶，07 号票在案）" },
  { id: "accept-timeout", criterion: "接单逾期（租约链在案）" },
  { id: "lease-expired", criterion: "租约到期（租约链在案）" },
  { id: "instance-death", criterion: "实例死亡（租约链在案）" },
  { id: "settle-timeout", criterion: "结算超时（delivered 滞留）" },
  { id: "close-timeout", criterion: "关闭超时（settled 滞留）" },
  { id: "conflict", criterion: "两岗/两实例冲突——冲突仲裁永不可代" },
  { id: "out-of-bounds", criterion: "连续越权达到处置阈值——越权处置永不可代" },
  { id: "needs-user", criterion: "判据缺口分解不出来：验收判据不可执行且无法分解为可观测项（规格 §B 原词，19 号票用户裁定扩条）" }
]);

/** 上浮原因 id 列表。 */
export const ESCALATION_CAUSE_IDS = Object.freeze(ESCALATION_CAUSES.map((entry) => entry.id));

/** 任务 id 形状（v2 前缀 `TK-`；旧评审前缀 `T-`／`J-` 随形态退役，不得复用）。 */
const TASK_ID_RE = /^TK-[A-Za-z0-9]{4,40}$/;

const ACTOR_KINDS = ["host", "user", "post"];

/** 任务 id 形状判定（命令面与读面共用的唯一口径）。 */
export function isTaskId(value) {
  return typeof value === "string" && TASK_ID_RE.test(value);
}

/** 事件 actor 形状判定（`{kind: host|user|post, id}`）。 */
export function isValidActor(actor) {
  return Boolean(actor) && typeof actor === "object" && !Array.isArray(actor) &&
    ACTOR_KINDS.includes(actor.kind) && typeof actor.id === "string" && actor.id !== "";
}

const NON_STATE_TYPES = Object.freeze([
  "heartbeat", "amend", "judgement", "command-rejected", "exception",
  "review-requested", "review-reported", "unauthorized-notified"
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
export const STATE_EVENT_TARGET = Object.freeze({
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

/** 台账事件类型封闭枚举（状态事件＋非状态事实）。 */
export const EVENT_TYPES = Object.freeze([...Object.keys(STATE_EVENT_TARGET), ...NON_STATE_TYPES]);

/** 每次落事件可携带的额外键（schema 白名单，防未定义键混入事实源）。 */
export const EVENT_EXTRA_KEYS = Object.freeze({
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
  "wait-user": ["class", "reason", "previousStatus"],
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
  "review-reported": ["subject", "verdict", "gaps", "criteriaGaps", "modelIdentity", "reviewer"],
  "unauthorized-notified": ["instanceId", "count"]
});

// ---------------- 记录校验 ----------------

const CORE_KEYS = ["seq", "eventId", "type", "at", "taskId", "actor", "writerEpoch", "eventHash"];

/** 状态事件的封闭词表键（类型→字段/词表/报错名；命令面守卫与事件校验共用同一来源）。 */
const STATE_ENUM_KEYS = Object.freeze({
  "wait-user": { field: "class", vocab: RULING_CLASS_IDS, label: "wait-user 裁定类 class" },
  escalated: { field: "cause", vocab: ESCALATION_CAUSE_IDS, label: "上浮原因 cause" }
});

/**
 * schema／hash 链校验**复用共用件原语**（`createEventSourcing`，02 号票纪律：同一原语
 * 不得在两处各留一份）：类型表与负载键白名单喂给共用件，`taskId`／`actor` 作为每类的
 * 公共负载键加入白名单。**转移合法性不交给共用件的 `foldEvents`**——共用件的 fold 假设
 * 「事件类型即状态」，而台账的事件类型是命令、状态是类型到状态的映射（且含 heartbeat／
 * judgement 等非状态事件），故折叠在 `projectEvents`（`task-ledger.js`）内按状态映射表实现。
 */
const ledgerSchema = createEventSourcing({
  eventTypes: EVENT_TYPES,
  payloadKeysByType: Object.fromEntries(
    EVENT_TYPES.map((type) => [type, ["taskId", "actor", ...(EVENT_EXTRA_KEYS[type] ?? [])]])
  ),
  legalTransition: () => true
});

/**
 * 事件 schema＋hash 链校验（fail closed：任一条不符即视为事实源损坏）。
 * 通用部分（核心键／键白名单／type／at／writerEpoch／eventHash 复算）委托共用件；
 * 台账域附加：全局 seq 连续性、taskId 形状、actor 形状。
 *
 * `previousSeq`＝**链上前一条的 seq**（链首传 0）：本门同时把守「全局 seq 连续」
 * 这一事实源不变量，故证据复验方逐条重算时必须按序传上一条，不能各自传 0。
 */
export function validateEventRecord(event, previousSeq = 0) {
  const generic = ledgerSchema.validateEventRecord(event);
  if (!generic.ok) return generic;
  if (!Number.isInteger(event.seq) || event.seq !== previousSeq + 1) {
    return { ok: false, reason: `事件 seq 不连续（期望 ${String(previousSeq + 1)}，实际 ${String(event.seq)}）` };
  }
  if (!isTaskId(event.taskId)) return { ok: false, reason: `事件 taskId 非法（${String(event.taskId)}）` };
  if (!isValidActor(event.actor)) return { ok: false, reason: "事件 actor 非法（须 {kind: host|user|post, id}）" };
  // 人间接口（09 号票，V-A5.1）：挂起与上浮两张事实表的词表封闭——waiting-user
  // 只认三类裁定 class，escalated 只认原因枚举（写路径已在命令面把守；此处兼守
  // 重放/外部写入的事件，未收录即视为事实源损坏）。**迁移归因**：09 之前的台账
  // 里缺 class 的 wait-user／词表外的 escalated 事件属旧格式，按本门判为事实源
  // 损坏（fail closed，不做静默补值）；org-v2 尚未切换，真实运行面未经 09 写入
  // ——若日后需读旧档，须以显式迁移件补字段后重放，不得放宽本门。
  const enumKey = STATE_ENUM_KEYS[event.type];
  if (enumKey !== undefined && !enumKey.vocab.includes(event[enumKey.field])) {
    return { ok: false, reason: `${enumKey.label} 非法（${enumKey.vocab.join("|")}）：${String(event[enumKey.field])}` };
  }
  return { ok: true };
}
