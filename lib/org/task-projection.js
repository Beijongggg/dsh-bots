/**
 * 任务台账投影（org-v2 40 号票）——`lib/org/task-projection.js`。
 *
 * **为什么单独一件**：台账的**状态词表**（哪些态、谁能从谁来、每态谁负责）与
 * **折叠本体**（事件序列 → 任务投影）此前住在 `lib/org/task-ledger.js`（1700+ 行）
 * 里，与命令面、写锁、锁 fencing、鉴权入口混在一件；而「状态＝事件序列的投影」
 * 是台账唯一可检验的读语义，读面深化（41–46 号票）要反复折它。故 40 号票把词表与
 * 折叠抽到本件，`task-ledger.js` 原地 import＋**原样再导出**，既有导入点一行不改。
 *
 * **本件只收折叠与词表，不收命令面**（票面定案 3）：依赖闭包限于
 * `./ledger-events.js`（事件契约叶件）与 `./review-kit.js`（复核事实折叠），二者
 * 不反向引用本件——`human-inbox.js`／`brief-gate.js`／`unauthorized-count.js`
 * 属命令面，不得入内。读依赖（`readLog`）一律**注入**，本件不隐式读全局、不碰文件。
 *
 * **投影是纯函数**：`projectEvents(events, taskId)` 不读盘、不留内存态，
 * 非法转移／坏链／断号在折叠时 fail closed（返回 `{ok:false}` 或抛）；`applyEvent`
 * 是逐事件折叠原语，`foldTaskEvents(taskId, rows)` 是**单任务折叠**段（41 号票的
 * 常驻投影按它续折新事件——复用同一段判定，不另留一份）。
 *
 * 词表可见面与搬来前逐名一致：`ALLOWED_FROM` 及两条状态集推导
 * （`STALLABLE_STATES`／`NON_CLOSED_STATES`）仍是本件私有；`allowedFrom(type)`
 * 导出供命令面门链复用（同一张表，不另留一份）。台账的公开面一条没变。
 */
import {
  STATE_EVENT_TARGET,
  isTaskId,
  validateEventRecord
} from "./ledger-events.js";
import { collectReviewState, taskReviewScope } from "./review-kit.js";

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
  // ＋delivered／settled（结算/关闭超时上浮，09 号票）
  // ＋triaged（立项期判据缺口 needs-user 上浮，19 号票——简报未冻结前分解失败即标 needs-user）
  escalated: [...HOLDING_STATES, "planned", "delivered", "settled", "triaged"]
});

/**
 * 状态事件的来态白名单；非状态事件（null）不受转移表约束。
 * 表本身私有（对外只见查询函数）——折叠与命令面门链读**同一张表**（单一原语），
 * 不得各留一份：命令面拒绝「非法转移」与折叠 fail closed 必须是同一判定。
 */
export function allowedFrom(type) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_FROM, type) ? ALLOWED_FROM[type] : null;
}

// ---------------- 投影（折叠本体） ----------------

/** 折叠起始态：无事件时的空任务（字段即状态投影的封闭形状）。 */
export function emptyTask(taskId) {
  return {
    taskId,
    class: null,
    status: null,
    owner: null,
    producer: null,
    dispatcher: null,
    lease: { acceptBy: null, expiresAt: null, heartbeats: 0 },
    dispatchCount: 0,
    brief: null,
    acceptance: null,
    routineId: null,
    window: null,
    supersedesTaskId: null,
    parentTaskId: null,
    createdAt: null,
    updatedAt: null,
    lastSeq: 0,
    resumeFrom: null,
    waitingClass: null,
    escalationCause: null,
    lastRejection: null
  };
}

/** 逐事件折（就地改 `task`；增量折叠原语，见 `projectEvents`）。 */
export function applyEvent(task, event) {
  if (event.type === "command-rejected") {
    task.lastRejection = { at: event.at, op: event.op, code: event.code, reason: event.reason };
    return;
  }
  if (event.type === "exception") return; // 异常是告警事件，不改状态（状态改写仍走命令面）
  if (event.type === "judgement") return; // LLM 判断输入：只落事实，不写状态
  if (event.type === "review-requested" || event.type === "review-reported") return; // 复核事实：由 review-kit 折叠消费，不改状态
  if (event.type === "unauthorized-notified") return; // 越权通知（24 号票①）：告知事实，不改状态（状态改写走 escalated）
  if (event.type === "heartbeat") {
    const base = task.lease.expiresAt !== null ? Date.parse(task.lease.expiresAt) : Date.parse(event.at);
    task.lease.heartbeats += 1;
    task.lease.expiresAt = new Date(base + task.lease.leaseMs).toISOString();
    if (typeof event.progress === "string") task.lease.progress = event.progress;
    return;
  }
  if (event.type === "amend") {
    if (event.brief) {
      task.brief = event.brief;
      task.acceptance = event.brief.acceptance ?? null; // 判据随置换件同拍（25 号票）
    }
    return;
  }
  // 状态事件
  task.status = STATE_EVENT_TARGET[event.type](event);
  // 人间接口（09 号票）：挂起裁定类与上浮原因随事件投影——wait-user 记声明值，
  // escalated 归「上浮终裁」类并记原因；任何其他状态事件都意味着离开挂起（清空）
  if (event.type === "wait-user") {
    task.waitingClass = event.class;
    task.escalationCause = null;
  } else if (event.type === "escalated") {
    task.waitingClass = "escalation";
    task.escalationCause = event.cause;
  } else {
    task.waitingClass = null;
    task.escalationCause = null;
  }
  if (event.type === "intake") {
    task.class = event.class;
    task.brief = event.brief ?? null;
    task.acceptance = task.brief?.acceptance ?? null;
    task.routineId = event.routineId ?? null;
    task.window = event.window ?? null;
    task.supersedesTaskId = event.supersedesTaskId ?? null;
    task.parentTaskId = event.parentTaskId ?? null;
    task.createdAt = event.at;
    task.dispatchCount = 0;
  }
  if (event.type === "plan" && event.brief) { // 立项产出简报（07 号票）
    task.brief = event.brief;
    task.acceptance = event.brief.acceptance ?? null;
  }
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
  // 产出方＝report 的历史事实（report 属 ownerOnly 命令，actor 即当时归属者）。
  // 归属让渡（租约回收/上浮/重排）清 owner 不清产出方：复核移交件读面与关闭登记
  // 门都发生在归属已让渡的窗口（16 号票 rv1 真实面 blocker——owner=null 使登记门
  // 永拒）；重派重跑时后报者覆盖。
  if (event.type === "report") task.producer = event.actor?.id ?? task.producer;
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
 *
 * 纯函数：不读盘、不留态；`events` 须按 seq 升序且**全局 seq 连续**（跨任务行
 * 一并校验——链的连续性与本任务过滤无关，故本函数容忍跨任务行在场）。
 */
export function projectEvents(events, taskId) {
  // 全序流逐行校验（跨任务行也校验并推进 lastSeq），再交单任务折叠——两段职责分明，
  // 单任务段与 `foldTaskEvents` 是**同一段代码**（常驻投影增量续折复用，41 号票）。
  const rows = [];
  let lastSeq = 0;
  for (const event of events) {
    const schema = validateEventRecord(event, lastSeq);
    if (!schema.ok) return { ok: false, reason: schema.reason, corrupt: true };
    lastSeq = event.seq; // 全局 seq 连续性是事实源不变量，与本任务过滤无关
    if (event.taskId !== taskId) continue;
    rows.push(event);
  }
  return foldTaskEvents(taskId, rows);
}

/**
 * 任务行 → 任务投影（**单任务折叠**）：`projectEvents` 的单任务段，语义逐字相同。
 *
 * 喂入面是**该任务的行**（按 seq 升序、**已过事实源校验**）：全局 seq 连续性与
 * hash 链的校验由喂入方负责——`projectEvents` 在喂入前逐行校验；常驻投影
 * （41 号票）喂的行取自已校验的当前事件流与本进程刚写入（写前已过 schema）的事件。
 * 故本函数不重复校验（不静默降级：捏造的坏行由喂入面的校验挡住），
 * 非状态事件不受转移表约束、非法转移在此 fail closed。
 */
export function foldTaskEvents(taskId, rows) {
  const task = emptyTask(taskId);
  for (const event of rows) {
    if (event.type !== "command-rejected" && event.type !== "exception" && event.type !== "judgement") {
      const from = allowedFrom(event.type);
      if (event.type !== "intake" && from !== null && !from.includes(task.status)) {
        return { ok: false, reason: `非法 transition：${String(task.status)} → ${String(event.type)}`, corrupt: true };
      }
    }
    applyEvent(task, event);
    task.lastSeq = event.seq;
  }
  task.updatedAt = task.lastSeq > 0 ? rows.find((event) => event.seq === task.lastSeq)?.at ?? null : null;
  // 普通岗位也须读到复核事实；lastRejection 只是历史拒绝，不能替代当前闭合结论。
  // 与交付门共用 review-kit 折叠，不新增状态或第二套判定（16 号票真实 smoke）。
  task.reviews = [...collectReviewState(taskReviewScope(task, rows)).subjects.values()];
  return { ok: true, task };
}

/**
 * 序列 → 全部任务投影（事件流里出现过的每个 taskId 一条；**含已关闭**——归档不删档）。
 * 与 `projectEvents` 同一条 fail closed 口径：投影损坏即抛（读侧统一抛、命令面统一转码）。
 */
export function foldAll(events) {
  const ids = [];
  const seen = new Set();
  for (const event of events) {
    if (!seen.has(event.taskId)) {
      seen.add(event.taskId);
      ids.push(event.taskId);
    }
  }
  return ids.map((id) => {
    const projection = projectEvents(events, id);
    if (!projection.ok) throw new Error(`台账投影损坏（fail closed）：${projection.reason}`);
    return projection.task;
  });
}

// ---------------- 读查询 ----------------

/**
 * 建读面投影（票面定案 4：**读依赖注入**，本件不隐式读全局）。
 *
 * `readLog()` → 事件数组（按 seq 升序）：**已过 schema＋hash 链＋全局 seq 连续性
 * 校验**的事件流。校验失败须**抛**（fail closed 的边界在注入件上，与本件其余读法
 * 同口径：读侧抛，命令面统一转码）。台账本体把自己的 `readEvents()` 注入进来，
 * 测试注入内存事件流——本件因此可脱离文件系统测。
 */
export function createTaskProjection({ readLog } = {}) {
  if (typeof readLog !== "function") {
    throw new Error("createTaskProjection 需要注入 readLog（读依赖注入，不隐式读全局）");
  }

  /** 读某序号处的结论：`seq` 为整数＝折到该序号为止；`"latest"`＝当前。 */
  function at(taskId, seq = "latest") {
    if (!isTaskId(taskId)) return null;
    if (seq !== "latest" && !(Number.isInteger(seq) && seq >= 0)) {
      throw new Error(`at 的 seq 须为整数或 "latest"（实得 ${String(seq)}）`);
    }
    const events = readLog();
    const window = seq === "latest" ? events : events.filter((event) => event.seq <= seq);
    if (!window.some((event) => event.taskId === taskId)) return null; // 该序号处任务尚未开档
    const projection = projectEvents(window, taskId);
    if (!projection.ok) throw new Error(`台账投影损坏（fail closed）：${projection.reason}`);
    return projection.task;
  }

  /** 事件窗口：`seq > seq0` 的事件（通知投影／增量消费的读法）。 */
  function since(seq0 = 0) {
    return readLog().filter((event) => event.seq > seq0);
  }

  /** 某任务的全部事件（按 seq 升序）；未开档＝空数组（与 `events({taskId})` 同口径）。 */
  function taskEvents(taskId) {
    return readLog().filter((event) => event.taskId === taskId);
  }

  /** 当前态快照：末序号＋全部任务当前投影（含已关闭）。 */
  function snapshot() {
    const events = readLog();
    return {
      lastSeq: events.length === 0 ? 0 : events[events.length - 1].seq,
      tasks: foldAll(events)
    };
  }

  return { at, since, taskEvents, snapshot };
}
