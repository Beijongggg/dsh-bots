/**
 * 人间接口件套（org-v2 09 号票；规格 §F 与附录 A `V-A5.1`–`V-A5.6`，GLOSSARY.md
 * 「人间收件箱」「裁定包」「验收初审」词条）。
 *
 * 人间接口＝**台账事件的投影面**，不是第二个命令面：
 *   - 只有**三类裁定**能进 `waiting-user`（`irreversible-write` 不可逆写入的放行／
 *     `escalation` 上浮终裁／`user-domain` 用户域裁定请求）——封闭枚举，台账侧
 *     `task.wait-user` 必填校验（枚举外即拒）；
 *   - 其余到人事件（交付回笼、取消失败、越权计数）＝**纯告知**，不挂起、不改状态；
 *   - 终裁＝`actor=user` 的既有台账命令（接单／驳回／推迟／授权修复四式的特化视图），
 *     继承幂等键、CAS 与事件审计；**mail 回文永不构成裁定**（回文不是台账命令入口）；
 *   - 挂起无限期：无超时自动动作、不占租约、不烧 token；简报边界声明的业务截止
 *     时间到期只投影「已过期」供用户清理，仍不自动取消；
 *   - 验收初次审理由**初审代理**（值班统筹或指派的便宜模型实例）行使：未命中必审
 *     清单的产出可处置（通过／回笼），命中清单的只可整理裁定包；初审拒绝或判据
 *     两轮未闭合强制上浮；模型指派、越权处置、冲突仲裁三项**永不可代**。
 *
 * 本模块只做判定与投影（纯函数为主）；命令写入仍走 `lib/org/task-ledger.js`
 * （本模块**不 import 台账模块** `task-ledger.js`，避免循环依赖：台账 import 本模块
 * 的封闭枚举）。两张事实表的词表（裁定类／上浮原因）自 28 号票起住事件契约叶件
 * `./ledger-events.js`（本模块 import 后原地再导出，台账 schema 与证据复验方同源）。
 */
import { UNCLOSED_ROUNDS_TO_ESCALATE, collectReviewState, openMandatorySubjects, reviewScope } from "./review-kit.js";
import { isParseableDueAt } from "./brief.js";
import { trailingRunSteps } from "./run-count.js";
// 两张事实表的封闭词表（裁定类／上浮原因）随事件契约下沉 `./ledger-events.js`
// （28 号票行为保持抽取：台账 schema 与证据复验方共用同一枚举来源）；本模块
// 原地再导出，既有调用方（如 `task-ledger.js` 的 `RULING_CLASS_IDS`）不受影响。
import {
  ESCALATION_CAUSES,
  ESCALATION_CAUSE_IDS,
  RULING_CLASSES,
  RULING_CLASS_IDS
} from "./ledger-events.js";
export { ESCALATION_CAUSES, ESCALATION_CAUSE_IDS, RULING_CLASSES, RULING_CLASS_IDS };

/** 永不可代三项（封闭枚举；`V-A5.4`——连「处置」本身都不可由代理代行）。 */
export const NON_DELEGABLE = Object.freeze([
  { id: "model-assignment", criterion: "模型指派：换模型/换实例属人间面专属，不设岗位 op" },
  { id: "out-of-bounds-handling", criterion: "越权处置：连续越权如何处置由用户裁定" },
  { id: "conflict-arbitration", criterion: "冲突仲裁：两岗/两实例冲突的裁决由用户作出" }
]);

/** 永不可代 id 列表。 */
export const NON_DELEGABLE_IDS = Object.freeze(NON_DELEGABLE.map((entry) => entry.id));

/** 到人**告知**三类（封闭枚举；纯告知不挂起，`V-A5.1`／§F）。 */
export const NOTICE_KINDS = Object.freeze([
  { id: "delivery-return", criterion: "交付回笼：交付转移完成的告知" },
  { id: "cancel-failure", criterion: "取消失败：取消失败的告知" },
  { id: "unauthorized-count", criterion: "越权计数：连续越权次数累计的告知" }
]);

/** 告知类 id 列表。 */
export const NOTICE_KIND_IDS = Object.freeze(NOTICE_KINDS.map((entry) => entry.id));

/**
 * 业务截止时间是否已过（纯函数，投递面投影用）：简报边界声明的 `dueAt` 到期
 * 只**投影**「已过期」供用户清理——不产生台账事件、不自动取消、不改状态
 * （`V-A5.3`；挂起无限期，唯一例外只是这一条投影）。缺省／坏值／无时钟一律
 * 判否（fail closed：宁可不提示，不误报到期）。
 */
export function isExpired({ task, now } = {}) {
  const dueAt = task?.brief?.dueAt;
  if (!isParseableDueAt(dueAt) || !Number.isFinite(now)) return false;
  return Date.parse(dueAt) <= now;
}

/** 初审代理的两种处置（封闭枚举；`V-A5.4`——初审不是终裁，处置只在必审清单外有效）。 */
export const PRE_SCREEN_DECISIONS = Object.freeze([
  { id: "approve", criterion: "通过：未命中必审清单的产出可由初审代理放行" },
  { id: "return", criterion: "回笼：退回承接方；初审拒绝＝强制上浮（不得把问题压在下面）" }
]);

/** 初审处置 id 列表。 */
export const PRE_SCREEN_DECISION_IDS = Object.freeze(PRE_SCREEN_DECISIONS.map((entry) => entry.id));

/**
 * 初审边界判定（纯函数；`V-A5.4`）：必审清单（简报冻结 `reviewPoints` ∪ 强制请求
 * 的 point）有未闭合者 → `package-only`（只可整理裁定包，不得自行处置）；无未闭合
 * 必审点 → `dispose`（可通过／回笼）。咨询性 topic 不入必审集、不阻断处置。
 */
export function preScreenBoundary({ brief, events, taskId } = {}) {
  const openMandatory = openMandatorySubjects({ brief, events, taskId });
  const mode = openMandatory.length > 0 ? "package-only" : "dispose";
  return {
    mode,
    openMandatory,
    allowedDecisions: mode === "dispose" ? PRE_SCREEN_DECISION_IDS : [],
    reason: mode === "dispose"
      ? "未命中必审清单：初审代理可处置（通过／回笼）"
      : `命中必审清单未闭合（${openMandatory.join("、")}）：只可整理裁定包，不得自行处置`
  };
}

/**
 * 初审的强制上浮判定（纯函数；`V-A5.4`）：初审拒绝（`return`）或判据连续两轮
 * 未闭合 → 必须上浮用户终裁（cause 分别＝`pre-screen-rejected`／
 * `review-rounds-exhausted`）。未知裁决 fail closed——按拒绝处置，绝不静默放行。
 */
export function preScreenEscalation({ decision, entry } = {}) {
  const consecutiveUnclosed = Number.isInteger(entry?.consecutiveUnclosed) ? entry.consecutiveUnclosed : 0;
  if (consecutiveUnclosed >= UNCLOSED_ROUNDS_TO_ESCALATE) {
    return { escalate: true, cause: "review-rounds-exhausted", reason: "判据连续两轮未闭合" };
  }
  if (decision === "return") {
    return { escalate: true, cause: "pre-screen-rejected", reason: "初审拒绝：不得把问题压在下面" };
  }
  if (decision === "approve") return { escalate: false, cause: null, reason: null };
  return {
    escalate: true,
    cause: "pre-screen-rejected",
    reason: `未知初审裁决 ${String(decision)}（fail closed：按拒绝处置）`
  };
}

/** 上浮原因 → 永不可代 id（冲突仲裁／越权处置两项）。 */
const NON_DELEGABLE_BY_CAUSE = Object.freeze({
  conflict: "conflict-arbitration",
  "out-of-bounds": "out-of-bounds-handling"
});

/**
 * 终裁归属判定（纯函数）：该任务当前挂起点的裁定是否**只许 user 行使**。
 * 命中情形＝`user-domain`（用户域裁定请求：模型指派、预算等）与上浮原因为
 * 冲突／越权处置两类（永不可代三项之中两项；模型指派本就无岗位 op）。
 * 其余挂起点（不可逆写入放行、复核两轮未闭合等）不在其内——不误伤既有恢复语义。
 * 返回 `null`（无此要求）或 `{reason, nonDelegable}`。
 */
export function userRulingRequirement({ task } = {}) {
  if (!task || task.status !== "waiting-user") return null;
  if (task.waitingClass === "user-domain") {
    return { reason: "用户域裁定请求（模型指派、预算等只属用户域）", nonDelegable: null };
  }
  const nonDelegable = NON_DELEGABLE_BY_CAUSE[task.escalationCause];
  if (nonDelegable === undefined) return null;
  return {
    reason: `上浮原因 ${String(task.escalationCause)} 属永不可代（${nonDelegable}）`,
    nonDelegable
  };
}

/** 终裁身份：裁定只由 user principal 行使（`V-A3.10` 全权／`V-A5.5`）。 */
export const RULING_ACTOR = Object.freeze({ kind: "user", id: "user" });

/**
 * 终裁四式（`V-A5.5`）＝**既有台账命令的特化视图**，不是第二个命令面：
 * 每式声明它要用的台账 op 序列（幂等键、CAS 与事件审计随台账命令继承），
 * `requires` 声明动作级必须提供的输入（可选输入如 attribution 不入此列），
 * `commands[].keys` 声明各命令负载取哪些输入（表声明可对账，负载组装统一走
 * `payloadFromInputs`），`consequence` 写清各自后果。
 * `defer` 的 ops 为空——推迟属**投递面节律**（规格 §F「提醒属投递面节律，
 * 不产生新台账事件语义」），不落事件、不改状态。
 */
export const RULING_ACTIONS = Object.freeze([
  {
    id: "accept",
    label: "接单（放行）",
    commands: [{ op: "task.resume", keys: ["resumeTo"] }],
    requires: ["resumeTo"],
    consequence: "任务归位 resumeTo（白名单内），组织继续推进"
  },
  {
    id: "reject",
    label: "驳回（终止）",
    commands: [{ op: "task.cancel", keys: ["reason", "attribution"] }],
    requires: ["reason"],
    consequence: "任务取消（终态、归档不删档）并通知派单方"
  },
  {
    id: "defer",
    label: "推迟",
    commands: [],
    requires: [],
    consequence: "维持挂起（无限期、无超时自动动作）；提醒节律属投递面，不产生台账事件"
  },
  {
    id: "authorize-repair",
    label: "授权修复",
    commands: [
      { op: "task.amend", keys: ["brief"] },
      { op: "task.resume", keys: ["resumeTo"] }
    ],
    requires: ["brief", "resumeTo"],
    consequence: "以完整合法简报置换冻结件后归位 resumeTo——授权范围写进简报，不放宽任何合同"
  }
]);

/** 命令负载＝按命令声明的 keys 从终裁输入取值（undefined 键不入负载——可选输入如 attribution）。 */
function payloadFromInputs(keys, inputs) {
  const payload = {};
  for (const key of keys) {
    if (inputs[key] !== undefined) payload[key] = inputs[key];
  }
  return payload;
}

/** 终裁动作 id 列表。 */
export const RULING_ACTION_IDS = Object.freeze(RULING_ACTIONS.map((entry) => entry.id));

/** 某挂起任务可用的终裁动作（非挂起＝无可裁定动作）。 */
export function rulingActionsFor(task) {
  if (!task || task.status !== "waiting-user") return [];
  return [...RULING_ACTIONS];
}

/**
 * 行使一次终裁（`V-A5.5`）：只接受 user principal，动作按表映射到既有台账命令。
 * 幂等键＝`<用户裁定键>:<taskId>:<op>`——**缺键即拒**（与台账同口径：裁定不猜
 * 幂等锚点），并带 taskId 分量以免同键跨任务串键重放（漏裁）。CAS 随首个命令
 * 传入、复合动作的后续命令取当刻投影（不猜序号）；`requires` 声明必填输入，
 * 缺一即拒（不把 undefined 当值传进台账）。任一步失败即停并回报已执行结果。
 * `defer` 不触台账（零事件）。**mail 回文不构成裁定**：回文没有 ticket 路径——
 * 任何来源只要不是 user principal 一律在触达台账前被拒。
 */
export async function applyRuling({
  ledger,
  action,
  taskId,
  actor = RULING_ACTOR,
  idempotencyKey,
  expectedStatus,
  expectedSeq,
  resumeTo,
  reason,
  attribution,
  brief
} = {}) {
  const spec = RULING_ACTIONS.find((entry) => entry.id === action);
  if (spec === undefined) {
    return { ok: false, code: "unknown-ruling-action", reason: `未知终裁动作：${String(action)}` };
  }
  if (!actor || actor.kind !== "user") {
    return {
      ok: false,
      code: "ruling-actor-required",
      reason: "终裁只许 user principal 行使（邮件回文、代理转述都不构成裁定）"
    };
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
    return { ok: false, code: "idempotency-key-required", reason: "终裁须携带幂等键（继承台账幂等语义；缺键即拒）" };
  }
  const inputs = { resumeTo, reason, attribution, brief };
  for (const name of spec.requires) {
    const value = inputs[name];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      return { ok: false, code: "ruling-payload-required", reason: `${spec.id} 须提供 ${name}（终裁不猜输入）` };
    }
  }
  if (spec.commands.length === 0) {
    return { ok: true, action: spec.id, taskId, deferred: true, results: [] };
  }
  const results = [];
  let cas = { expectedStatus, expectedSeq };
  for (const command of spec.commands) {
    const result = await ledger.command({
      op: command.op, taskId, actor, ...cas,
      idempotencyKey: `${idempotencyKey}:${String(taskId)}:${command.op}`,
      payload: payloadFromInputs(command.keys, inputs)
    });
    results.push({ op: command.op, ok: result.ok === true, code: result.code ?? null, replayed: result.replayed === true });
    if (result.ok !== true) {
      return { ok: false, code: result.code ?? "ruling-command-failed", failedAt: command.op, results, action: spec.id, taskId };
    }
    // 复合动作的下一步取当刻投影（上一步已推进 seq；不猜序号）
    const task = ledger.task(taskId);
    cas = { expectedStatus: task?.status, expectedSeq: task?.lastSeq };
  }
  return { ok: true, action: spec.id, taskId, results };
}

/** 裁定包五件（`V-A5.6`，封闭清单；缺件即拒——不交半包）。 */
export const PACKET_PIECES = Object.freeze([
  "brief", "criteriaFacts", "positions", "actions", "modelIdentity"
]);

/** 本任务事件里最近一条满足谓词的事件（末次语义只此一处）。 */
function latestEvent(scoped, predicate) {
  return [...scoped].reverse().find(predicate);
}

/** 判据事实：触发上浮／挂起的事实本身（命中条目＋可执行检查原文），不是转述。 */
function criteriaFactsFor({ task, events, taskId }) {
  const scoped = (events ?? []).filter((event) => taskId === undefined || event?.taskId === taskId);
  const waiting = latestEvent(scoped, (event) => event.type === "wait-user" || event.type === "escalated");
  if (waiting === undefined) return null;
  const key = task.taskId ?? taskId;
  // 复核状态查询域（23 号票②）：三件套捆装一次，折叠与必审开启集共用
  const scope = reviewScope({ brief: task.brief, events: scoped, taskId: key });
  const { subjects } = collectReviewState(scope);
  return {
    waitingClass: task.waitingClass ?? null,
    cause: task.escalationCause ?? waiting.cause ?? null,
    reason: waiting.reason ?? null,
    previousStatus: waiting.previousStatus ?? null,
    openMandatory: openMandatorySubjects(scope),
    subjects: [...subjects.values()]
      .filter((entry) => entry.mandatory)
      .map((entry) => {
        const last = entry.reports[entry.reports.length - 1] ?? null;
        return {
          subject: entry.subject,
          verdict: last?.verdict ?? null,
          consecutiveUnclosed: entry.consecutiveUnclosed,
          gaps: (last?.gaps ?? []).map((gap) => ({
            severity: gap?.severity ?? null, summary: gap?.summary ?? null, evidence: gap?.evidence ?? null
          })),
          criteriaGaps: last?.criteriaGaps ?? [],
          modelIdentity: last?.modelIdentity ?? null
        };
      }),
    // 判据**原文**（预登记的可执行检查）：检查**结果**原文随各 subject 的
    // gaps[].evidence／criteriaGaps 同包给出；两者都不附工件正文
    criteria: Array.isArray(task.brief?.acceptance) ? task.brief.acceptance : []
  };
}

/**
 * 双方立场各一句（产出方 vs 复核者优先，不足则以派单方／归属者机械事实句补齐）
 * ＋全轨迹指针。补齐句口径（24 号票③，2026-09-19 用户裁定＝补齐合规＋显式标注）：
 * 机械事实句可充当立场件（越权类上浮等无产出／复核事件的场景，机械事实就是
 * 最小充分上下文），但须以〔机械事实〕前缀显式标注性质——不冒名立场。
 */
function positionsFor({ task, events, taskId }) {
  const scoped = (events ?? []).filter((event) => taskId === undefined || event?.taskId === taskId);
  const entries = [];
  const lastReport = latestEvent(scoped, (event) => event.type === "report");
  if (lastReport !== undefined) {
    entries.push({ side: "producer", statement: `报出产出：${lastReport.deliverable ?? "（未记坐标）"}` });
  }
  const lastReview = latestEvent(scoped, (event) => event.type === "review-reported");
  if (lastReview !== undefined) {
    const gaps = (lastReview.gaps ?? []).map((gap) => gap?.summary).filter((line) => typeof line === "string" && line !== "");
    entries.push({
      side: "reviewer",
      statement: `复核结论 ${String(lastReview.verdict)}：${gaps.join("；") || "（无判据缺口摘要）"}`
    });
  }
  // 「双方立场各一句」是判据硬要求：第一顺位＝产出方 vs 复核者；不足两句时以
  // 机械可得的事实补齐（派单方派单／归属在手）——补齐句带〔机械事实〕前缀显式
  // 标注性质（24 号票③裁定：补齐合规，不冒名立场）；要么两句，要么算缺件（不交半包）
  const waiting = latestEvent(scoped, (event) => event.type === "wait-user" || event.type === "escalated");
  if (waiting !== undefined) {
    const dispatchCount = waiting.dispatchCount ?? task.dispatchCount ?? 0;
    const fallback = [
      {
        side: "dispatcher",
        statement: `〔机械事实〕派单 ${String(dispatchCount)} 次后停在此处（${String(task.escalationCause ?? task.waitingClass ?? "等待")}）`
      },
      {
        side: "holder",
        statement: task.owner === null || task.owner === undefined
          ? "〔机械事实〕无归属者在手"
          : `〔机械事实〕归属者 ${String(task.owner)} 在手`
      }
    ];
    for (const entry of fallback) {
      if (entries.length >= 2) break;
      entries.push(entry);
    }
  }
  return { entries, trail: { taskId: task.taskId ?? taskId, fromSeq: 1, toSeq: task.lastSeq ?? null } };
}

/**
 * 组装裁定包（`V-A5.6`，纯函数）：五件齐备才交付（缺件即拒，不交半包）——
 * ①冻结简报（四要素＋判据，未设＝缺件）②判据事实（命中条目＋可执行检查原文）
 * ③各方立场各一句＋全轨迹指针④可选动作及后果⑤模型身份（组装者须具名）。
 * **不附工件全文**：包里只有坐标与事实原文，按指针取用。
 */
export function buildRulingPackage({ task, events, taskId, modelIdentity } = {}) {
  const violations = [];
  if (!task) return { ok: false, packet: null, violations: ["缺任务投影：裁定包只能对在场任务组装"] };
  const brief = task.brief ?? null;
  if (brief === null) violations.push("缺件①冻结简报：派出即冻结，裁定包必须附冻结件");
  const criteriaFacts = brief === null ? null : criteriaFactsFor({ task, events, taskId });
  if (brief !== null && criteriaFacts === null) violations.push("缺件②判据事实：无可引的挂起／上浮事实");
  const positions = positionsFor({ task, events, taskId });
  if (positions.entries.length < 2) violations.push("缺件③立场：须双方各一句（产出方／复核者优先，否则派单方／归属者）");
  const actions = rulingActionsFor(task);
  if (actions.length === 0) violations.push("缺件④可选动作：非挂起任务无终裁动作可给");
  if (typeof modelIdentity !== "string" || modelIdentity.trim() === "") {
    violations.push("缺件⑤模型身份：组装者身份必须具名（不具名即拒）");
  }
  if (violations.length > 0) return { ok: false, packet: null, violations };
  return {
    ok: true,
    violations: [],
    packet: {
      taskId: task.taskId ?? taskId,
      brief,
      criteriaFacts,
      positions,
      actions,
      modelIdentity
    }
  };
}

/**
 * 越权计数只认**能力面**拒绝。词形口径（单一源＝能力模块的探测码命名）：
 *   - `capability-*` 前缀的一切码（含未来新增）＋权限门的 `op-not-in-opset`／
 *     `post-unassigned`／`task-domain-mismatch` ＝ 越权尝试，计入连续计数；
 *   - **运维性码**（TTL 到期／nonce 重放／任务离手自动吊销／实例活态比对失败）
 *     ＝ 非越权，但**也不打断**连续计数（否则一次过期信封即可洗掉越权链）；
 *   - 角色类拒绝（`not-owner`／`actor-not-allowed` 等）＝打断连续计数。
 * `host-channel-forbidden` 不入表：它只由 HTTP 层 403 产出，永不进 `command-rejected`。
 *
 * **27 号票补充**：复核报告面的拒绝现在也落 `command-rejected`（op=`review.report`，
 * 台账腿为权威门）——本词形口径对其一体适用：无帽（`capability-malformed`）／他人帽
 * （`capability-bot-mismatch`）＝能力面码、计入连续越权；`review-hat-required`／
 * `review-hat-op-missing`／`not-designated-reviewer` 属角色类＝打断串；已消费重放
 * （`capability-replayed`）＝运维性、不计数不洗链。本票**不扩**本词表（那是 §D 计数
 * 面的语义，另票再议）。
 */
export const UNAUTHORIZED_CODES = Object.freeze(["op-not-in-opset", "post-unassigned", "task-domain-mismatch"]);

/** 能力面运维性码（不计越权、不打断计数）。 */
const OPERATIONAL_CAPABILITY_CODES = Object.freeze([
  "capability-expired", "capability-replayed", "capability-revoked", "instance-not-alive"
]);

/** 是否越权尝试（导出＝投递面与 §D 计数面共用同一判定，02 纪律）。 */
export function isUnauthorizedCode(code) {
  if (typeof code !== "string") return false;
  if (OPERATIONAL_CAPABILITY_CODES.includes(code)) return false;
  return code.startsWith("capability-") || UNAUTHORIZED_CODES.includes(code);
}

/** 是否能力面拒绝（越权 ∪ 运维性）：能力面拒绝不透传为角色类拒绝（导出＝告知面与 §D 连续越权计数面共用同一判定，02 纪律）。 */
export function isCapabilityFaceCode(code) {
  return typeof code === "string" && (code.startsWith("capability-") || code === "instance-not-alive" || UNAUTHORIZED_CODES.includes(code));
}

/**
 * 能力面拒绝的连续计数归类（告知任务链与 §D 实例链两分类器共用同一核心，02 纪律；
 * 20 号票提取）：越权尝试＝`count`、运维性能力面拒绝＝`ignore`（不计数不洗链）、
 * 非能力面（角色类）拒绝＝`reset`（打断连续计数）。
 */
export function classifyCapabilityFaceRejection(code) {
  if (!isCapabilityFaceCode(code)) return "reset";
  return isUnauthorizedCode(code) ? "count" : "ignore";
}

/** 任务链的分类器（09 号票口径）：能力面拒绝按共用归类，其余任务事件打断任务串。 */
function classifyTaskEvent(event) {
  if (event.type !== "command-rejected") return "reset";
  if (event.op === "task.cancel") return "reset";
  return classifyCapabilityFaceRejection(event.code);
}

/**
 * 到人告知投影（纯函数，`V-A5.1`／§F）：**纯告知、不挂起**——交付回笼（`deliver`）、
 * 取消失败（`task.cancel` 被拒）、越权计数（能力面拒绝按**连续**口径计数，被角色类
 * 拒绝或异常打断后重新起算）。告知只描述事件，不进待裁列表、不改状态。折叠语义
 * ＝共用原语（`lib/org/run-count.js`，20 号票提取——与 §D 实例链计数同源不同键维：
 * 本面按任务链、计数面按岗位实例链）。
 */
export function noticesFrom({ events, cursor = 0 } = {}) {
  const { steps } = trailingRunSteps({
    events, cursor, keyOf: (event) => event?.taskId ?? null, classify: classifyTaskEvent
  });
  const notices = [];
  for (const step of steps) {
    const event = step.event;
    if (event.type === "deliver") {
      notices.push({
        kind: "delivery-return", taskId: event.taskId, seq: event.seq,
        text: `交付回笼：任务 ${String(event.taskId)} 已交付转移（seq ${String(event.seq)}）`
      });
    } else if (event.type === "command-rejected" && event.op === "task.cancel") {
      notices.push({
        kind: "cancel-failure", taskId: event.taskId, seq: event.seq,
        text: `取消失败：${String(event.code)}（${String(event.reason ?? "无理由")}）`
      });
    } else if (step.action === "count") {
      notices.push({
        kind: "unauthorized-count", taskId: event.taskId, seq: event.seq, count: step.count,
        text: `越权计数：连续第 ${String(step.count)} 次能力面拒绝（${String(event.code)}，op=${String(event.op)}）`
      });
    }
  }
  return notices;
}

/**
 * 人间收件箱投影（`V-A5.2`）：**待裁项＝挂起任务的直接投影**（内嵌裁定包、可选
 * 终裁动作、归位点、到期标记、永不可代标注），**告知项＝告知投影**；两者并列不混。
 * 只读——本函数不触任何写面（台账由调用方以只读面注入）。`modelIdentity`＝组装者
 * 身份（缺省＝确定性层组装；初审代理由其自身模型身份覆盖）。
 */
export function buildInbox({ ledger, now, cursor = 0, modelIdentity = "host（确定性层组装）" } = {}) {
  const tasks = ledger.tasks();
  const events = ledger.events();
  const pending = tasks
    .filter((task) => task.status === "waiting-user")
    .map((task) => {
      const built = buildRulingPackage({ task, events, taskId: task.taskId, modelIdentity });
      return {
        taskId: task.taskId,
        waitingClass: task.waitingClass,
        escalationCause: task.escalationCause,
        resumeFrom: task.resumeFrom,
        since: task.updatedAt,
        expired: isExpired({ task, now }),
        userRuling: userRulingRequirement({ task }),
        actions: rulingActionsFor(task),
        packet: built.ok ? built.packet : null,
        packetViolations: built.violations
      };
    });
  return {
    cursor: events.length === 0 ? 0 : events[events.length - 1].seq,
    pending,
    notices: noticesFrom({ events, cursor })
  };
}
