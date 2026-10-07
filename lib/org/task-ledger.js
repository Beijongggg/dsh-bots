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
 * 折叠本体与状态词表自 40 号票起住 `./task-projection.js`（`emptyTask`／`applyEvent`／
 * `projectEvents` 与主干/旁路状态集、责任表、转移白名单）；本模块自该件导入并按名
 * 再导出，读面读法与命令面判定语义零变化。
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
 * 四要素简报契约（org-v2 07 号票，`V-A2.4`；校验器在 `lib/org/brief.js`、命令面
 * 前置门在 `lib/org/brief-gate.js`——23 号票⑤拆出）：简报
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
 * `recordReviewReport` 入账（**复核帽验签在此**——本面是复核报告的**权威门**与
 * 复核面**唯一消费点**（27 号票：报告是事实源事件一条，换通道也须持帽，通道门
 * 只做入口预筛；帽腿通过即消费，与命令面「授权通过即消费」同口径）；复核帽无
 * 台账写 op——报告是唯一可写产物且形状封闭；指定关系与「产出方不得自任」在此
 * 复核）；**连续两轮未闭合自动上浮用户终裁**
 * （`escalated`，cause=review-rounds-exhausted，通知投影达 user）。清单外（咨询性）
 * 请求与报告不阻断交付。复核事实事件不改状态、由 review-kit 折叠消费。
 *
 * 连续越权上浮（org-v2 20 号票，规格 §D「连续越权通知派单方并计入上浮」）：拒绝回执
 * 链按**岗位实例**折叠（trailing 连续，判定在 `lib/org/unauthorized-count.js`），
 * 达阈串由 `sweep` 通知派单方并对在手任务上浮用户终裁（`escalated`，cause=
 * out-of-bounds——09 号票预冻词表，越权处置永不可代）；通知派单方＝**台账事件投影**
 * （24 号票①裁定：§B「通知＝台账事件投影，无事件不通知」——每被越权任务落一条
 * 非状态事件 `unauthorized-notified`，含无在手任务路径，NOTIFY_TO 路由派单方）；
 * 每越权串每任务至多一次（事件本体即锚点），运维性能力面拒绝不计数不洗链，
 * 阈值＝`LEASE_DEFAULTS.unauthorizedThreshold` 用户域缝。
 */
import { randomBytes } from "node:crypto";
import { statSync } from "node:fs";
import { join } from "node:path";

import {
  acquireStoreLock as baseAcquireStoreLock,
  appendJsonlLine,
  createReservationIndex,
  eventHashFor,
  readJsonl,
  requireLockOwnership,
  reservationKeyHash
} from "./store-base.js";
import { isNonEmptyString } from "./is-non-empty-string.js";
import { briefGate, briefReject } from "./brief-gate.js";
// 事件契约叶件（28 号票行为保持抽取）：类型表／负载键白名单／校验器唯一住
// `./ledger-events.js`（证据面复验复用同一件，不拉进本模块的组织图闭包）。
// `EVENT_TYPES`／`isTaskId`／`validateEventRecord` 仍自本模块再导出（既有调用方不变）。
import {
  EVENT_EXTRA_KEYS,
  EVENT_TYPES,
  TRIAGE_DECISIONS,
  isTaskId,
  isValidActor,
  validateEventRecord
} from "./ledger-events.js";
export { EVENT_TYPES, TRIAGE_DECISIONS, isTaskId, validateEventRecord };
// 状态词表与折叠本体（40 号票搬家）：唯一住 `./task-projection.js`，本模块 import 后
// **原样再导出**——既有导入点（op-set／capability-issue／experiment-verdict／
// review-artifacts／测试）一行不改，且词表是**同一批对象**，不是两处各留一份。
import {
  BYPASS_STATES,
  CLOSED_STATES,
  HOLDING_STATES,
  MAIN_FLOW,
  RESUME_STATES,
  STATE_RESPONSIBILITY,
  TASK_STATES,
  allowedFrom,
  createTaskProjection,
  foldAll as foldAllTasks,
  foldTaskEvents,
  projectEvents
} from "./task-projection.js";
export {
  BYPASS_STATES, CLOSED_STATES, HOLDING_STATES, MAIN_FLOW,
  RESUME_STATES, STATE_RESPONSIBILITY, TASK_STATES, projectEvents
};
import { PRE_SCREEN_DECISION_IDS, RULING_CLASS_IDS, preScreenBoundary, preScreenEscalation, userRulingRequirement } from "./human-inbox.js";
import {
  REVIEW_BOUNDARY_IDS,
  UNCLOSED_ROUNDS_TO_ESCALATE,
  collectReviewState,
  openMandatorySubjects,
  taskReviewScope,
  validateReviewReport,
  verifyReviewHat
} from "./review-kit.js";
import {
  DEFAULT_UNAUTHORIZED_THRESHOLD,
  UNAUTHORIZED_ESCALATION_ACTOR,
  pendingNoticeTaskIds,
  unauthorizedThreats
} from "./unauthorized-count.js";
import { readIndex } from "../knowledge.js";

// ---------------- 关闭前置（规格 §B；14 号票） ----------------

/**
 * 产出登记面的缺省读取器：本数据根知识库索引中**锚本任务**的条目
 * （`entry.task === taskId`——登记命令的 `task` 字段即产出与本任务的关联键）。
 * 这里按任务过滤只为少读几行；**权威锚定判定在 `closePrecondition` 内**（注入面
 * 同样受判，见该函数注）。索引损坏行由 `readIndex` 跳过（读侧口径），读取异常即抛
 * （调用方 fail closed，落 `artifact-registry-unreadable`）。
 */
function readArtifacts(dshHome, taskId) {
  return readIndex(dshHome).filter((entry) => entry?.task === taskId);
}

/**
 * 关闭前置判定（规格 §B「关闭前置＝验收判据均有可执行检查的通过记录、命中的复核点
 * 已闭合、产出已按『谁产出谁登记』登记」；org-v2 14 号票实现前两项、25 号票补齐第三项）：
 *
 *   ① **命中的复核点已闭合**——与 `task.deliver` 同一门（`openMandatorySubjects`，
 *      `V-A2.7`）：关闭是同一批边界的收口，交付时闭合过的必审点在关闭处不得被绕过
 *      （交付之后仍可加审，加审点同样须闭合）。
 *   ② **验收判据均有可执行检查的通过记录**（25 号票）——**关闸时现跑**：由确定性层
 *      按简报里**冻结的验收判据**逐条执行（白名单、沙箱快照、逐字一致校验照旧），
 *      全部通过才准关闭；任一条不过即拒，拒绝理由点名 **index／命令／原因**并带该次
 *      快照摘要（`snapshotSha256`）以便复验。**不新增台账事件类型**，也不把探针结论
 *      存成第二份事实源——现跑得到的是关闸那一刻的真实结论，且**不采信任何一方的
 *      自报**（与 `evidence.probe` 的分工：那条是承接方干活时的自检，本条是边界上的
 *      复核）。
 *      - 执行面是**注入缝**（照 `artifactsFor` 的先例）：未接线时 fail closed
 *        （`acceptance-check-unwired`——「跑不了」不等于「过了」）。台账本体因此不
 *        直接依赖 repo 路径与 mail 面；接线件＝`lib/org/criterion-runner.js`。
 *      - 遍历顺序＝便宜的先判：复核点 → 判据现跑 → 产出登记（判据可能很重，
 *        `node.tests` 要派生整树副本＋子进程）。
 *      - 超时＝不过（不是跳过）；结论口径＝`ok === true` 才算过。
 *   ③ **产出已按「谁产出谁登记」登记**——产出登记面须存在「登记方（`botId`）＝本任务
 *      产出方（`producer`——report 派生的历史事实，非易变归属 `owner`）且锚本任务
 *      （`task === taskId`）」的条目。他人登记不算产出方
 *      自己登记；该实例别的产出也不算本任务产出。
 *
 * **适用范围**＝`class=project` 的任务（与②③一致）。`class=duty` 例程任务的承载面是
 * 台账本身（§B 值守例程段：例程任务的验收判据可由健康探针或回归结果自动生成），不归
 * 知识库登记——对例程任务适用登记门会把值守链锁死（合法路径不得打成死路）。判据门
 * （②）更进一步：**无判据的例程任务豁免**（生成机制未做，对它适用判据门＝发明凭空的
 * 判据）；例程任务**自己登记了判据**时照跑——判据存在即须有通过记录（§B 的字面要求），
 * 对「自产判据」豁免等于放行一条无通过记录的关闭路径。
 *
 * **进门形状（org-v2 42 号票）＝任务快照一件**：`snapshot = { task, events, artifacts }`
 * ——调用方不再散拼三件实参，交进门的是一条**任务快照**：
 *   - `task`＝任务投影（冻结简报的承运者）；
 *   - `events`＝**本任务域**的事件序列（读面 `taskEvents(taskId)`）；本函数只读本任务
 *     域，故**任务片段与含他任务行的历史等价**（`taskReviewScope` 内部按 taskId 过滤，
 *     见 `./review-kit.js`）——这条容忍度是 23 号票「任务域读取」的既有语义，改形后
 *     照旧成立（生产侧由此不再把整条历史交到关闸判定手上）；
 *   - `artifacts`＝产出登记面条目数组（调用方注入；负例测试可注入任意形状）。
 * `criterionRunner`＝判据执行面（注入缝，有判据要现跑；异步）。
 */
export async function closePrecondition({ snapshot, criterionRunner = null } = {}) {
  const { task, events, artifacts = [] } = snapshot ?? {};
  const open = openMandatorySubjects(taskReviewScope(task, events));
  if (open.length > 0) {
    return {
      ok: false,
      code: "review-gaps-open",
      reason: `必审复核点未闭合（${open.join("、")}）——关闭前置：命中的复核点须已闭合`
    };
  }
  const readiness = await acceptanceReadiness(task, criterionRunner);
  if (!readiness.ok) return readiness;
  return artifactRegistrationVerdict(task, artifacts);
}

/** 产出方两段口径的单一原语（02 号票纪律「同一原语不得在两处各留一份」；16 号票
 *  rv1 真实面 blocker 收口——单用易变 owner 使产出方判定在归属让渡窗口失真）：
 *  report 后取 `producer`（report 派生的历史事实——归属让渡不清、重派重跑后后报者
 *  覆盖）；尚无 report 时取当前归属 `owner`（正在实施的人；真实面登记常发生在
 *  report 前的实施窗口）。复核移交件读面、关闭登记门与独立性门（reviewer-is-producer）
 *  三处共用本判定。 */
export function producerOf(task) {
  return task?.producer ?? task?.owner ?? null;
}

/** 纯登记判定共用于关闭预检和异步检查后的同步提交段，避免两处口径分叉。 */
function artifactRegistrationVerdict(task, artifacts) {
  if (task?.class === "duty") return { ok: true };
  // 锚定与登记方**两件都在这里判**：注入 `artifacts` 的调用方（负例测试／别的接线）也得
  // 满足同一契约——把锚定留在读侧会让注入路径静默少一道校验（判据随注入面流失）。
  const registered = (Array.isArray(artifacts) ? artifacts : []).some(
    (entry) => entry?.task === task?.taskId && entry?.botId === producerOf(task)
  );
  if (!registered) {
    return {
      ok: false,
      code: "artifact-not-registered",
      reason: "产出未按「谁产出谁登记」登记（须有「登记方＝本任务产出方」且「锚本任务」的产出条目）"
        + "——关闭前置：产出须先登记"
    };
  }
  return { ok: true };
}

/** 判据命令的紧凑转述（拒绝理由用；白名单外／缺键的判据也须能点名它长什么样）。 */
function criterionLabel(criterion) {
  if (criterion === null || typeof criterion !== "object" || Array.isArray(criterion)) {
    return String(criterion);
  }
  const probe = typeof criterion.probe === "string" && criterion.probe !== "" ? criterion.probe : "(未名命令)";
  const args = criterion.args === null || typeof criterion.args !== "object" || Array.isArray(criterion.args)
    ? criterion.args
    : criterion.args;
  return `${probe} ${JSON.stringify(args)}`;
}

/**
 * 验收判据的现跑段（§B 关闭前置的第三条；25 号票）。
 *
 * 判据真源＝**任务投影里的简报**（`intake` 预登记或 `plan` 产出；`amend` 置换件——
 * 冻结件的改动只走这条通道且已通知承接方）——不是调用方自带文本（「模型不得自报判据」
 * 同一口径）。
 *
 * 无判据两义需分开处置，否则会把合法路径打成死路：
 *   - `duty` 任务无判据＝**豁免**（生成机制未做，此处不发明判据）；
 *   - 非例程任务无判据（简报缺省，或 `acceptance` 非非空数组）＝**根上就拒**
 *     （`acceptance-criteria-unwired`）——没有判据就没有可通过的检查，凭「空」放行
 *     正是关闭前置要挡的假绿。
 *
 * **这两条分支今日不可达（如实标注，独立复核实测）**：简报的「验收判据非空」是不变量，
 * 收单门（`invalid-brief`）与 amend 通道都拒无判据件；`duty` 任务没有简报也走不到
 * `settled`（`task.assign` 即 `brief-missing`）。故它们今日不是活缺陷、也**无用例覆盖**；
 * 但将来若放开「无判据简报」或让 duty 任务走完主干，这两条就会变成真的 fail-open 口子——
 * 届时必须先补覆盖再放开（口径在此登记，不靠注释之外的记忆）。
 */
async function acceptanceReadiness(task, criterionRunner) {
  const raw = task?.acceptance;
  const criteria = Array.isArray(raw) ? raw : null;
  if (criteria === null || criteria.length === 0) {
    return task?.class === "duty"
      ? { ok: true }
      : {
        ok: false,
        code: "acceptance-criteria-unwired",
        reason: "任务无预登记验收判据（简报缺省或为空）——关闭前置：验收判据均须有可执行检查的通过记录"
      };
  }
  if (typeof criterionRunner !== "function") {
    return {
      ok: false,
      code: "acceptance-check-unwired",
      reason: `验收判据执行面未接线（fail closed）：「跑不了」不等于「过了」；本任务预登记判据 ${String(criteria.length)} 条待跑`
    };
  }
  // 逐条现跑：不过即拒，拒绝理由点名第几条／什么命令／为什么（可复验的锚＝快照摘要）。
  // **执行面抛错不得逃逸**：命令面的契约是「拒绝＝{ok:false,code,reason}＋落 command-rejected」，
  // 异常逃出去会变成 500 且**无账可查**（证据断链）——故此处把抛错折算成判据不过，
  // 与「跑不了不等于过了」同一口径（fail closed）。
  for (const [index, criterion] of criteria.entries()) {
    let verdict;
    try {
      verdict = await criterionRunner(criterion);
    } catch (error) {
      return {
        ok: false,
        code: "acceptance-check-failed",
        reason: `验收判据 #${String(index)} 执行面抛错（fail closed）：${error?.message ?? String(error)}`,
        failedIndex: index,
        snapshotSha256: null,
        probeCode: null
      };
    }
    if (verdict !== null && typeof verdict === "object" && verdict.ok === true) continue;
    const reason = verdict?.reason ?? "判据执行面无结论（fail closed）";
    return {
      ok: false,
      code: "acceptance-check-failed",
      reason: `验收判据 #${String(index)} 未通过（${criterionLabel(criterion)}）：${reason}`,
      failedIndex: index,
      snapshotSha256: verdict?.snapshotSha256 ?? null,
      probeCode: verdict?.code ?? null
    };
  }
  return { ok: true };
}

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

// （任务 id／actor 形状判定随事件契约下沉 `./ledger-events.js`；本模块 import 复用。）

// ---------------- 命令面词表与缝 ----------------
// 状态词表（主干/旁路状态集、责任表、转移白名单）与折叠本体自 40 号票起住
// `./task-projection.js`（投影单一归属）：本模块 import 后**原样再导出**，词表是
// 同一批对象而非另留一份。此处留命令面自己的表——队列滞留处置、异常类别、租约缝、
// op 表、通知路由。

/**
 * 队列滞留的确定性处置表（07 号票；05 号票 STATE_RESPONSIBILITY 三条队列态
 * onTimeout 的执行面）：intake 分诊超时→上浮用户；triaged 立项超时→退回分诊
 * （`return` 事件，通知值班统筹）；planned 派单滞留→上浮用户（`escalated`）。
 * 时限＝`LEASE_DEFAULTS.stallMs`（用户域缝），自进入该状态（updatedAt）起算。
 */
const QUEUE_STALL_ACTIONS = Object.freeze({
  intake: {
    type: "wait-user",
    payload: () => ({ class: "escalation", reason: "分诊时限内未分诊→上浮用户" })
  },
  triaged: { type: "return", payload: () => ({ reason: "立项时限内未立项→退回分诊并通知值班统筹" }) },
  planned: {
    type: "escalated",
    payload: (task) => ({ cause: "queue-stall", dispatchCount: task.dispatchCount, previousOwner: task.owner })
  },
  // 结算/关闭超时（09 号票；STATE_RESPONSIBILITY 两条 onTimeout 的执行面）：
  // 「登记异常并上浮用户」——先登记 task-stalled 异常（无静默丢失），再上浮终裁；
  // 绝不自动结算、绝不自动关闭（挂起由用户清理，到期只投影「已过期」）
  delivered: {
    type: "escalated",
    exceptionKind: "task-stalled",
    payload: (task) => ({ cause: "settle-timeout", dispatchCount: task.dispatchCount, previousOwner: task.owner })
  },
  settled: {
    type: "escalated",
    exceptionKind: "task-stalled",
    payload: (task) => ({ cause: "close-timeout", dispatchCount: task.dispatchCount, previousOwner: task.owner })
  }
});

/** 异常四类（统一走台账、不静默丢失）。 */
export const EXCEPTION_KINDS = Object.freeze([
  "instance-death", "task-stalled", "waiting-user", "waiting-external"
]);

/** 租约与重派默认值（数值属用户域：可配置的缝，宿主接线可逐项覆盖）。
 *  `stallMs`＝队列滞留时限（intake/triaged/planned 三队列态共用一条缝；07 号票）；
 *  `unauthorizedThreshold`＝连续越权上浮阈值（20 号票，§D；缺省见 unauthorized-count 模块）。 */
export const LEASE_DEFAULTS = Object.freeze({
  acceptMs: 10 * 60 * 1000,
  leaseMs: 15 * 60 * 1000,
  redispatchCap: 3,
  stallMs: 30 * 60 * 1000,
  unauthorizedThreshold: DEFAULT_UNAUTHORIZED_THRESHOLD
});

// ---------------- 事件表 ----------------
// （`NON_STATE_TYPES`／`TRIAGE_DECISIONS`／`STATE_EVENT_TARGET`／`EVENT_TYPES`／
//  `EVENT_EXTRA_KEYS` 随事件契约下沉 `./ledger-events.js`；本模块 import 复用。）

// （`EVENT_EXTRA_KEYS` 负载键白名单随事件契约下沉 `./ledger-events.js`：命令面
//   负载键校验与事件 schema 校验共用同一张表，不得在此另留一份。）

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
  "review-reported": "owner",
  "unauthorized-notified": "dispatcher"
});

/**
 * 收件人解析表（23 号票⑦：四层嵌套三元改表驱动，与 NOTIFY_TO 的角色词表同源）：
 * 角色名 → 解析器。assignee／dispatcher／reviewer＝事件负载优先、任务投影兜底；
 * owner＝**任务在手者**（amend 后须通知承接方本人，不是改动发起人）；表外角色
 * ＝角色名直发（user／duty-coordinator 等岗位 slug）。
 */
const NOTIFY_RECIPIENT = Object.freeze({
  assignee: (event, task) => event.assignee ?? task.owner,
  dispatcher: (event, task) => event.dispatcher ?? task.dispatcher,
  owner: (_event, task) => task.owner,
  reviewer: (event, task) => event.reviewer ?? task.owner
});

// ---------------- 记录校验 ----------------
// 事件 schema＋hash 链校验器（含类型表、负载键白名单、taskId/actor 形状、两张事实
// 表词表）唯一住 `./ledger-events.js`——证据面复验与台账写读侧用**同一个**
// `validateEventRecord`（02 号票纪律：同一原语不得在两处各留一份）。本模块 import
// 复用并按需再导出（`export { validateEventRecord }`，见文件头 import 段）。

// ---------------- 投影 ----------------
// 折叠本体（`emptyTask`／`applyEvent`／`projectEvents`／`foldAll`）自 40 号票起住
// `./task-projection.js`（本模块 import 复用并按需再导出）；状态＝序列的投影，
// 折叠是纯函数，读依赖一律注入。此处不再留第二份。

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

/**
 * 建台账门面。`dshHome`＝数据根；`now`＝时钟（注入以便假时钟测试）；
 * `lease`＝时限/封顶覆盖（用户域数值的缝）。
 *
 * 执行面注入缝（25 号票，照 `artifactsFor` 先例）：
 *   - `criterionRunnerFor(taskId)` → `async (criterion) => verdict`：验收判据现跑
 *     的执行面（缺省 `null`＝未接线，关闭前置 fail closed──「跑不了」不等于
 *     「过了」）。装配件＝`lib/org/criterion-runner.js`（宿主与烟测共用）。
 *   - `criterionRunCtx`＝执行面上的**非 dshHome** 上下文（`cwd`／`timeoutMs`／
 *     `tmpdir`／`listMailAnomalies`）；`dshHome` 一律由本门面补（与产出登记面
 *     读同一个数据根，免调用方两处各传一次可能漂移的值）。
 *   - `reviewHat`＝复核帽签发/验签门面（27 号票）：`recordReviewReport` 的**权威门**
 *     ——复核报告是事实源里的事件一条，唯一写者门口必须验凭据，任何通道（HTTP、
 *     进程内直调）都绕不过。本面只调 `verify`，**从不签发**（签发权在 host）。
 *     缺省 `null`＝未接线：报告入账 fail closed（`review-hat-unwired`），不做
 *     「没接线就跳过验帽」的降级。
 *
 * 读依赖注入缝（41 号票，常驻投影的读面缝；与 `now`／`artifactsFor` 同风格）：
 *   - `readEventsFile(file)` → `{lines, corrupt, parsed}`（缺省 `readJsonl`）：**整文件读**
 *     这一动作本身——常驻态每次重折都经它；注入即得「全文读次数」的可数面（验收计数）。
 *   - `statEventsFile(file)` → `fs.statSync` 同形（缺省 `statSync`）：**失效检查**这一动作
 *     ——常驻态每次读先经它取文件键（size／mtime），取得写锁的跨越点再经它强制查一次。
 *
 * 写路径：命令面 → `ensureLock()`（首次写获取并持有台账写锁；**跨越点强制重查文件**，
 * 见 41 号票）→ 事件 schema 组装 → `requireLockOwnership`（fencing：迟写者拒）→
 * O_APPEND 追加 → 常驻态续折（不重读全文）→ 幂等预留落盘。
 * 读路径：不加锁（append-only 文件，读侧 fail closed 校验 hash 链）；**读经常驻投影**
 * （实例私有，见 `residentState`）。
 */
export function createTaskLedger({
  dshHome, now = () => Date.now(), lease = {}, lockSpinMs, authorize,
  artifactsFor = null, criterionRunnerFor = null, criterionRunCtx = null, reviewHat = null,
  readEventsFile = readJsonl, statEventsFile = statSync
} = {}) {
  if (typeof dshHome !== "string" || dshHome === "") throw new Error("createTaskLedger 需要 dshHome");
  for (const [name, injected] of [["readEventsFile", readEventsFile], ["statEventsFile", statEventsFile]]) {
    if (typeof injected !== "function") throw new Error(`createTaskLedger 的 ${name} 须为函数（读依赖注入缝）`);
  }
  // 注入件形状在构造期响亮拒绝（畸形注入＝装配错误）；**显式留空**才是「未接线」的
  // 合法表达，由 `recordReviewReport` fail closed 拒（`review-hat-unwired`）——两者
  // 不是同一种情况，故一个抛一个回码。
  if (reviewHat !== null && typeof reviewHat?.verify !== "function") {
    throw new Error("createTaskLedger 的 reviewHat 须为带 verify 的签发/验签门面（未接线请显式留空）");
  }
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

  /**
   * 产出登记面读取（**唯一读取点**：读面 `ledger.artifactsFor` 与关闭前置门共用——
   * 两处各写一次「缺省还是注入」的分支必然漂移）。读取异常原样抛出，由调用方
   * fail closed（关闭前置门转 `artifact-registry-unreadable`）。
   */
  function resolveArtifacts(taskId) {
    return artifactsFor === null ? readArtifacts(dshHome, taskId) : artifactsFor(taskId);
  }

  /**
   * 验收判据执行面解析（**唯一解析点**：关闭前置门与将来别的消费点共用——两处
   * 各写一次「缺省还是注入」的分支必然漂移）。未接线＝null（调用方 fail closed）。
   * `dshHome` 由本门面补进 ctx：执行面本体不必知道数据根从哪来，调用方也不必
   * 与产出登记面各传一次可能漂移的值。
   */
  function resolveCriterionRunner(taskId) {
    if (criterionRunnerFor === null) return null;
    // `dshHome` **最后展开**＝台账根优先：调用方 ctx 里就算带了同名键也不得改判据的执行根
    // （判据坐标与产出登记面必须读同一个数据根，否则「登记在 A、判据跑在 B」是可漂移面）
    return criterionRunnerFor(taskId, { ...(criterionRunCtx ?? {}), dshHome });
  }

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
    // 跨越点（**无锁 → 持锁**，41 号票）：本实例是进程级长命的，且读路径不检查 `closed`
    // ——「我们松锁期间别的进程写过」是真实窗口（含本次获取的自旋窗口，`LOCK_DEFAULTS`
    // 上限 6s）。故在此**强制再查一次文件**：键不符即当场重折，不把松锁期间的追加
    // 交给「下一次读」碰运气。重折失败（坏行/坏链）不在此抛——读侧下一次读按同一
    // fail closed 口径抛／转码，`ensureLock` 只答锁状态（既有形状不变）。
    try {
      residentState();
    } catch {
      resident = null; // 缓存作废：交给下一次读按 fail closed 报
    }
    return { ok: true, lock };
  }

  // ---------------- 常驻投影（41 号票：读不再全文重折） ----------------

  /**
   * 常驻当前态＝**实例私有**（不按数据根共享：同一数据根上的另一个实例是自己的
   * 事实读者，手里也各有一份；故「写完再经台账读」的既有用例换新实例新折，自洽）。
   *
   * 形状＝`{key, events, lastSeq, tasks}`：文件键＋当前事件流＋末序号＋全部任务当前
   * 投影。**内存只留当前态**：不保留任何按序号的／历史的投影——`at(taskId, seq)`
   * 一律回落磁盘折叠（见读面 `at`）。
   *
   * 失效规则：**每次读先查文件（size／mtime），变了才重折**；取得写锁的跨越点再强制
   * 查一次（`ensureLock`）；本进程自己的追加**续折**（`noteSelfWrittenEvent`），
   * 不重读也不重折全文。
   */
  let resident = null;

  /** 文件键（size／mtime）；文件不在＝空流（与 `readJsonl` 同口径）。 */
  function eventsKey() {
    try {
      const info = statEventsFile(eventsFile(dshHome));
      return `${String(info.size)}:${String(info.mtimeMs)}`;
    } catch {
      return "absent";
    }
  }

  /** 一次重折：读全文（过校验）＋折全部任务（**先取文件键再读**：并发写只可能多折一次，不会误判新鲜）。 */
  function foldResident(key) {
    const events = readEventsFromDisk();
    const tasks = new Map(foldAllTasks(events).map((task) => [task.taskId, task]));
    return { key, events, lastSeq: events.length === 0 ? 0 : events[events.length - 1].seq, tasks };
  }

  /** 常驻当前态：键不符才重折——**每次读都先查文件**（失效检查是必需项，不是保险）。 */
  function residentState() {
    const key = eventsKey();
    if (resident !== null && resident.key === key) return resident;
    resident = foldResident(key);
    return resident;
  }

  /** 读全量事件（常驻态；对调用方仍是「已过校验的全序流」）。 */
  function readEvents() {
    return residentState().events;
  }

  /**
   * 唯一全文读（fail closed：坏行/坏链即抛，不静默跳过）。41 号票起只作两处来源：
   * 常驻态的重折，以及 `at(taskId, seq)` 的历史读回落（历史读不经常驻态）。
   */
  function readEventsFromDisk() {
    const parsed = readEventsFile(eventsFile(dshHome));
    if (parsed.corrupt.length > 0) throw new Error(`台账事件日志存在 ${parsed.corrupt.length} 条损坏行（fail closed）`);
    let previousSeq = 0;
    for (const event of parsed.parsed) {
      const schema = validateEventRecord(event, previousSeq);
      if (!schema.ok) throw new Error(`台账事件链损坏（fail closed）：${schema.reason}`);
      previousSeq = event.seq;
    }
    return parsed.parsed;
  }

  /**
   * 自写续折（41 号票）：本进程刚把 `event` 追加进事实源（单写者＝持锁期间无别的台账
   * 写者）——**不重读、不重折全文**，直接把它续进常驻当前态：只折**本任务的行**
   * （`foldTaskEvents`＝`projectEvents` 的单任务段，同一段判定，不另留一份）。
   *
   * 两道守卫，任一不符即**作废缓存**（宁可下一次读多折一次，不可把坏事件／别人的事件
   * 吞进常驻态）：
   *   - **序号守卫**：本事件须恰是常驻末序号的下一条（`writeEvent` 只自校 seq 连续，
   *     全局连续性靠这条守）——不符＝窗口内另有写者或重号，作废（下一次读整折即响亮
   *     fail closed，不让常驻态悄悄持有一条坏事件）；
   *   - **字节守卫**：写后 size − 写前 size 恰为本行字节数（另有写者即不符）。
   * 文件键按**写后实测**更新。
   */
  function noteSelfWrittenEvent(event, sizeBefore) {
    if (resident === null) return; // 无常驻态可续（下一次读自然整折）
    if (event.seq !== resident.lastSeq + 1) {
      resident = null;
      return;
    }
    let info;
    try {
      info = statEventsFile(eventsFile(dshHome));
    } catch {
      resident = null;
      return;
    }
    // 与 `appendJsonlLine` 同格式（JSON 一行 ＋ "\n" 收尾）
    const lineBytes = Buffer.byteLength(JSON.stringify(event)) + 1;
    if (info.size !== sizeBefore + lineBytes) {
      resident = null;
      return;
    }
    const rows = resident.events.filter((row) => row.taskId === event.taskId);
    rows.push(event);
    const projection = foldTaskEvents(event.taskId, rows);
    if (!projection.ok) {
      resident = null; // 不该发生（写前已过门链与 schema 校验）：保守作废，下一次读整折并 fail closed
      return;
    }
    resident.events = [...resident.events, event];
    resident.tasks.set(event.taskId, projection.task);
    resident.lastSeq = event.seq;
    resident.key = `${String(info.size)}:${String(info.mtimeMs)}`;
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
    const file = eventsFile(dshHome);
    const sizeBefore = fileSizeOf(file);
    appendJsonlLine(file, event);
    noteSelfWrittenEvent(event, sizeBefore);
    return { ok: true };
  }

  /** 追加前的文件字节数（文件不在＝0）。 */
  function fileSizeOf(file) {
    try {
      return statEventsFile(file).size;
    } catch {
      return 0;
    }
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

  /**
   * 常驻态内查任务投影：不存在＝null。41 号票起**不再逐次重折**（旧实现按传入的
   * 事件流跑 `projectEvents`＝每次重校全序流）：投影在整折时一次算出，且投影损坏
   * 在整折时已 fail closed 抛（读侧统一抛、命令面统一转 code，口径不变）。
   */
  function findTask(state, taskId) {
    return state.tasks.get(taskId) ?? null;
  }

  function loadTask(taskId) {
    return findTask(residentState(), taskId);
  }

  /**
   * 拒绝回执（fail closed：不执行、状态不变、结论落 `command-rejected` 事件）。
   * `detail`＝事件负载的既白名单明细（`EVENT_EXTRA_KEYS`）；`extraResult`＝只入
   * 回执（供 dispatch 续签判定等消费）、**不进事件**的机械标记——事件 schema
   * 键封闭，标记不落事件面（21 号票 ①）。
   */
  function reject(taskId, actor, idempotencyKey, op, code, reason, detail = {}, extraResult = {}) {
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
    const result = { ok: false, code, reason, ...extraResult };
    reserve(idempotencyKey, { taskId, op, result });
    return result;
  }

  function lastSeqOf() {
    return residentState().lastSeq;
  }

  /** 某实例在手的进行中任务（常驻投影内查；`state` 缺省＝取当前常驻态）。 */
  function holdingsOf(botId, state = residentState()) {
    for (const task of state.tasks.values()) {
      if (task.owner === botId && HOLDING_STATES.includes(task.status)) return task;
    }
    return null;
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

  /**
   * judgement 事实＋条件上浮的共享入账腿（`recordPreScreen`／`recordNeedsUser`
   * 同型段收敛）。机械规则：上浮失败响亮回报不静默；`escalate` 为真但任务已挂起
   * （waiting-user）不上浮；`eventFrom`＝主结论事件口径（"judgement"＝裁决事实
   * 为主、"escalation"＝上浮事实为主）；`extra`＝调用方异构字段的并集注入。
   */
  async function judgementEscalationLeg({ taskId, actor, op, idempotencyKey, intent, input, escalate, cause, eventFrom, extra = {} }) {
    const recorded = await ledger.judgement({
      taskId, actor, intent, input,
      idempotencyKey: `${idempotencyKey}:judgement`
    });
    if (recorded.ok !== true) return recorded;
    const current = ledger.task(taskId);
    const escalation = escalate && current.status !== "waiting-user"
      ? appendStateEvent({
        task: current, type: "escalated", actor,
        payload: { cause, dispatchCount: current.dispatchCount, previousOwner: current.owner },
        idempotencyKey: `${idempotencyKey}:escalated`, op
      })
      : null;
    const escalatedOk = escalation !== null && escalation.ok === true;
    const result = { ok: true, taskId, escalated: escalatedOk, cause: escalatedOk ? cause : null, ...extra };
    if (escalation !== null && escalation.ok !== true) {
      result.escalationError = { code: escalation.code, reason: escalation.reason };
    }
    if (escalatedOk) result.status = escalation.status;
    reserve(idempotencyKey, { taskId, op, result });
    return { ...result, event: escalatedOk && eventFrom === "escalation" ? escalation.event : recorded.event };
  }

  /**
   * 读面投影（40 号票增量＋41 号票常驻化）：新读法 `at`／`since`／`taskEvents` 的
   * **本体住在 `./task-projection.js`，台账读面只委派**——把本模块自己的读路径作为
   * `readLog` 注入进去（已过坏行／schema／hash 链／全局 seq 连续性校验），不另开
   * 第二条读路径：故新旧读法是**同一份事实源、同一套 fail closed 口径**。
   *
   * 两处注入是**两种读口径**（41 号票）：
   *   - `residentProjection`：`since`／`taskEvents` 走**常驻当前态**（不重读全文）；
   *   - `diskProjection`：`at(taskId, seq)`（含 `"latest"`）**回落磁盘折叠**——
   *     常驻态只留当前态，不保留任何按序号的／历史的投影。
   */
  const residentProjection = createTaskProjection({ readLog: readEvents });
  const diskProjection = createTaskProjection({ readLog: readEventsFromDisk });

  const ledger = {
    dshHome,
    leaseOptions: leaseOpts,

    /** 读：任务产出登记面（关闭前置②的读面；可注入，缺省读本数据根知识库索引）。 */
    artifactsFor(taskId) {
      return resolveArtifacts(taskId);
    },

    /**
     * 读：某序号处的任务结论（`seq` 为整数＝折到该序号为止；`"latest"`＝当前）。
     * 纯委派 `./task-projection.js`：**历史读回落磁盘折叠**（41 号票——常驻态只留
     * 当前态，不留按序号的投影；`"latest"` 也走同一口径，读面不出现「有时吃缓存、
     * 有时不吃」的分叉）；**历史读也过事实源校验**（不静默降级），非法 seq 与投影
     * 损坏一律抛（fail closed，与 `task()` 同口径）；未开档＝null。
     */
    at(taskId, seq = "latest") {
      return diskProjection.at(taskId, seq);
    },
    /** 读：`seq > 游标`的事件窗口（跨任务、含非状态事件；通知投影／增量消费的读法）。 */
    since(seq = 0) {
      return residentProjection.since(seq);
    },
    /** 读：某任务的全部事件（按 seq 升序）；未开档＝空数组。 */
    taskEvents(taskId) {
      return residentProjection.taskEvents(taskId);
    },
    /** 读：单任务投影（不存在＝null）。取常驻当前态（每次读先查文件，变了才重折）。 */
    task(taskId) {
      if (!isTaskId(taskId)) return null;
      return residentState().tasks.get(taskId) ?? null;
    },
    /** 读：全部任务投影（含已关闭——归档不删档）。常驻当前态，不逐任务重折。 */
    tasks() {
      return [...residentState().tasks.values()];
    },
    /** 读：未闭合队列（重启后由此重建在办集合；`V-A2.2`）。 */
    openQueue() {
      return [...residentState().tasks.values()].filter((task) => !CLOSED_STATES.includes(task.status));
    },
    /** 读：某实例在手的进行中任务（`V-A2.6`）。 */
    holdingsFor(botId) {
      return holdingsOf(botId);
    },
    /** 读：SSE `ledger` 事件载荷（台账投影）。 */
    view() {
      const state = residentState();
      const tasks = [...state.tasks.values()];
      return {
        lastSeq: state.lastSeq,
        open: tasks.filter((task) => !CLOSED_STATES.includes(task.status)).length,
        tasks
      };
    },
    /**
     * 通知投影：`seq > cursor` 的可通知事件（无事件不通知——通知不是独立事实源）。
     * `to` 为岗位 slug／`user`／被派实例 id；收件人解析用的任务投影＝常驻当前投影
     * （与旧 `projectEvents(events, taskId).task` 同物，不再逐事件重折）。
     */
    notificationsAfter(cursor = 0) {
      const state = residentState();
      const notifications = [];
      for (const event of state.events) {
        if (event.seq <= cursor) continue;
        const role = NOTIFY_TO[event.type];
        if (role === undefined) continue;
        const task = state.tasks.get(event.taskId);
        // 收件人解析按 NOTIFY_RECIPIENT 表（角色 → 解析器；表外角色＝角色名直发）
        const resolver = NOTIFY_RECIPIENT[role];
        const to = resolver !== undefined ? resolver(event, task) : role;
        notifications.push({
          seq: event.seq, taskId: event.taskId, type: event.type, to,
          text: `${event.type}：任务 ${event.taskId}（seq ${String(event.seq)}）`
        });
      }
      return { cursor: state.lastSeq, notifications };
    },

    /**
     * 命令面（唯一写入口）。合法性与 CAS 由确定性层判定；**不接受调用方直写状态**。
     * 返回 `{ok:true, taskId, status, seq, task, event}` 或
     * `{ok:false, code, reason}`（fail closed，状态不变）；鉴权门**之后**的拒绝
     * 额外携带 `authorized: true`（授权有效且岗位信封已被本命令消费——dispatch
     * 续签判据，21 号票 ①；只入回执不进事件）。
     */
    async command(input = {}) {
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
      // 命令面拒绝的统一出口（fail closed：不执行／状态不变／结论落
      // `command-rejected` 事件——V-A3.6）。前四条结构校验（unknown-op／
      // invalid-task-id／invalid-actor／幂等键）无任务锚点，不落账、直接回裸错误码。
      // 续签标记（21 号票 ①）：`authorized: true` 只加在**鉴权门之后**的拒绝上——
      // 授权有效且岗位信封已被本命令单次消费（装了 authorize 时；标记只入回执、
      // 不进事件负载——事件 schema 键封闭），dispatch 据此续签；鉴权门之前的
      // 拒绝（角色不符／鉴权失败）不带：未获授权的命令不续签。
      let authorized = false;
      // `extraResult`（回执第 5 参，照 `reject` 的形状）：只入回执／幂等预留、**不进
      // 事件**的机械标记（25 号票的判据复验锚 `snapshotSha256`／`failedIndex`）。
      const rejectHere = (code, reason, detail, extraResult) =>
        reject(taskId, actor, idempotencyKey, op, code, reason, detail,
          // 两者**合并**：`authorized`（21 号票①的续签判据：授权有效且信封已消费）不得被
          // 判据类拒绝的复验锚顶掉——关闭前置四类拒绝同样可能发生在鉴权门之后
          { ...(extraResult ?? {}), ...(authorized ? { authorized: true } : {}) });
      if (!spec.actorKinds.includes(actor.kind)) {
        return rejectHere("actor-not-allowed", `${actor.kind} 不得调用 ${op}（状态写入角色受限）`);
      }
      // 鉴权三元组（06 号票；V-A3.2）：kind=post 须过信封/白名单/任务域，拒绝沿
      // reject() 落账（V-A3.6）。未装 authorize（纯确定性层用法）＝不设此门。
      if (authorize !== undefined) {
        const verdict = authorize({ op, taskId, actor, capability: input.capability });
        if (verdict && verdict.ok === false) {
          return rejectHere(verdict.code ?? "unauthorized", verdict.reason ?? "鉴权拒绝（fail closed）");
        }
        // 岗位实例：授权有效——内置鉴权面（createLedgerAuthorizer）下即信封已验签
        // 通过并被本命令单次消费；注入自定 authorize 而未消费信封时，标记只表
        // 「鉴权门通过」（续签按此口径执行）。
        authorized = actor.kind === "post";
      }
      // 负载键白名单：未定义键即拒（fail closed——不静默丢弃调用方以为记下的字段）
      const allowedPayload = new Set(["taskId", ...(EVENT_EXTRA_KEYS[spec.type] ?? [])]);
      const unknownKeys = Object.keys(payload ?? {}).filter((key) => !allowedPayload.has(key));
      if (unknownKeys.length > 0) {
        return rejectHere("unknown-payload-key",
          `${op} 的负载含未定义键：${unknownKeys.join("、")}（白名单见 EVENT_EXTRA_KEYS）`);
      }
      // 读：一次取常驻当前态（本命令后续「拿到事件」的点全吃这一份快照——与旧实现
      // 「一次 readEvents 快照」同义；41 号票只换来源，判定一个字不改）
      let state;
      let existing;
      try {
        state = residentState();
        existing = findTask(state, taskId);
      } catch (error) {
        return { ok: false, code: "ledger-corrupt", reason: error.message };
      }

      if (spec.creates) {
        if (existing !== null) return rejectHere("task-exists", `任务 ${taskId} 已存在（不重复开档）`);
        const taskClass = payload.class;
        if (taskClass !== "duty" && taskClass !== "project") {
          return rejectHere("invalid-class", `class 须为 duty|project：${String(taskClass)}`);
        }
        if (payload.brief !== undefined && payload.brief !== null) {
          const denied = briefReject(payload.brief);
          if (denied !== null) return rejectHere(denied.code, denied.reason);
        }
        if (payload.supersedesTaskId !== undefined) {
          if (!isTaskId(payload.supersedesTaskId)) {
            return rejectHere("invalid-supersedes", "supersedesTaskId 非法");
          }
          let old;
          try {
            old = findTask(state, payload.supersedesTaskId);
          } catch (error) {
            return { ok: false, code: "ledger-corrupt", reason: error.message };
          }
          if (old === null) return rejectHere("supersedes-not-found", `被取代任务不存在：${payload.supersedesTaskId}`);
          if (!CLOSED_STATES.includes(old.status)) {
            return rejectHere("supersedes-not-closed", `被取代任务未闭合（${old.status}）——关闭即只读，改动用新任务引用`);
          }
        }
        const created = appendStateEvent({
          task: { taskId }, type: "intake", actor, payload: { ...payload, taskId }, idempotencyKey, op
        });
        return created;
      }

      if (existing === null) return rejectHere("task-not-found", `任务不存在：${taskId}`);
      if (CLOSED_STATES.includes(existing.status)) {
        return rejectHere("task-closed",
          `任务已终态（${existing.status}）——关闭不可重开，改动用 supersedesTaskId 开新任务`);
      }
      // CAS：期望状态＋期望序号**都必填**（规格 §D「命令携带期望状态与序号，不符即拒」）
      if (spec.cas) {
        if (typeof expectedStatus !== "string" || expectedStatus === "" || !Number.isInteger(expectedSeq)) {
          return rejectHere("cas-required",
            "状态改写类命令必须携带期望状态与期望序号（CAS）", { expectedStatus: expectedStatus ?? null, expectedSeq: expectedSeq ?? null });
        }
        if (expectedStatus !== existing.status) {
          return rejectHere("cas-mismatch",
            `期望状态 ${expectedStatus} 与当前 ${existing.status} 不符（CAS 拒绝）`,
            { expectedStatus, expectedSeq, taskStatus: existing.status });
        }
        if (expectedSeq !== existing.lastSeq) {
          return rejectHere("cas-mismatch",
            `期望序号 ${String(expectedSeq)} 与当前 ${String(existing.lastSeq)} 不符（CAS 拒绝）`,
            { expectedStatus, expectedSeq, taskStatus: existing.status });
        }
      }
      // 转移合法性
      const from = allowedFrom(spec.type);
      if (from !== null && !from.includes(existing.status)) {
        return rejectHere("illegal-transition",
          `非法转移：${existing.status} → ${spec.type}`);
      }
      // 永不可代（09 号票，V-A5.4）：用户域裁定请求与「冲突仲裁／越权处置」两类
      // 上浮，其状态改写只许 user principal 行使——代理（post）与确定性层（host）
      // 都不得代裁（含取消：处置本身也不可代）；其余挂起点不受此门
      const requirement = userRulingRequirement({ task: existing });
      if (requirement !== null && actor.kind !== "user") {
        return rejectHere("ruling-not-delegable",
          `${op} 被拒：${requirement.reason}——终裁只许 user 行使`);
      }
      // 权限：承接类转移只许当前归属者本人（合法性判定在前——非法转移先报非法）；
      // wait-user 的 post 触发同限归属者，host／user 上浮裁定放行（规格 §F）
      const ownerRequired = spec.ownerOnly || (spec.postOwnerOnly && actor.kind === "post");
      if (ownerRequired && existing.owner !== actor.id) {
        return rejectHere("not-owner", `非当前归属者（owner=${String(existing.owner)}）不得执行 ${op}`);
      }
      // 类型专项校验：分诊四值、异常四类（未知取值即拒，不静默降级）
      if (spec.type === "triage" && TRIAGE_DECISIONS[payload.decision] === undefined) {
        return rejectHere("invalid-triage-decision",
          `分诊取值须为 ${Object.keys(TRIAGE_DECISIONS).join("|")} 之一：${String(payload.decision)}`);
      }
      // 简报契约（07 号票，V-A2.4）：立项可携带简报、amend 必须携带完整合法简报
      // （冻结件只允许被完整合法件置换）＋冻结复核点不可降级（19 号票①）、派出即
      // 冻结（assign 前置校验在场与合法）——前置门拆至 lib/org/brief-gate.js
      // （23 号票⑤），拒绝码与判定序位保持
      const briefDenied = briefGate({ type: spec.type, payload, existing });
      if (briefDenied !== null) return rejectHere(briefDenied.code, briefDenied.reason);
      if (spec.type === "decline" && payload.reason !== undefined && !isNonEmptyString(payload.reason)) {
        return rejectHere("decline-reason-required",
          "拒收理由给出时须为非空字符串（规格 §B「可带理由拒收」——理由可选，给出即留痕）");
      }
      if (spec.type === "exception" && !EXCEPTION_KINDS.includes(payload.kind)) {
        return rejectHere("invalid-exception-kind",
          `异常类别须为 ${EXCEPTION_KINDS.join("|")}：${String(payload.kind)}`);
      }
      // 目标状态由事件类型决定；resume 类须给白名单内的归位点
      if (spec.type === "unblock" || spec.type === "resume") {
        if (!RESUME_STATES.includes(payload.resumeTo)) {
          return rejectHere("invalid-resume-target",
            `resumeTo 须为 ${RESUME_STATES.join("|")} 之一：${String(payload.resumeTo)}`);
        }
      }
      // 人间接口（09 号票，V-A5.1）：waiting-user 是「裁定」通道——只有三类裁定
      // 能进（不可逆写入放行／上浮终裁／用户域裁定请求），缺省或枚举外即拒；
      // 裁定类不得由触发方身份反推（不静默降级），其余到人事件走告知面不挂起
      if (spec.type === "wait-user" && !RULING_CLASS_IDS.includes(payload.class)) {
        return rejectHere("invalid-ruling-class",
          `裁定类 class 须为 ${RULING_CLASS_IDS.join("|")} 之一：${String(payload.class)}`);
      }
      // 复核件套（08 号票，规格 §C）：请求须给必审枚举点或咨询主题（二选一）；
      // 简报冻结点不可降级（可加审不可免审）；强制加审须留归因；复核帽＝当次
      // 空闲实例佩戴、排除本任务产出方
      if (spec.type === "review-requested") {
        const hasPoint = isNonEmptyString(payload.point);
        const hasTopic = isNonEmptyString(payload.topic);
        if (hasPoint === hasTopic) {
          return rejectHere("invalid-review-point",
            hasPoint && hasTopic
              ? "point 与 topic 只能给一个（必审复核点或咨询主题，二选一）"
              : "复核请求须给必审枚举点 point 或咨询主题 topic（二选一）");
        }
        if (hasPoint && !REVIEW_BOUNDARY_IDS.includes(payload.point)) {
          return rejectHere("invalid-review-point",
            `point 须在必审清单边界枚举（${REVIEW_BOUNDARY_IDS.join("｜")}）：${String(payload.point)}`);
        }
        const briefPoints = Array.isArray(existing.brief?.reviewPoints) ? existing.brief.reviewPoints : [];
        const fromBrief = hasPoint && briefPoints.includes(payload.point);
        if (fromBrief && payload.mandatory === false) {
          return rejectHere("review-exemption-forbidden",
            "简报冻结复核点不可降级为咨询性（命中即强制，可加审不可免审）");
        }
        const mandatory = fromBrief || payload.mandatory === true;
        if (mandatory && payload.mandatory !== true) payload.mandatory = true; // 解析结论落事件（冻结点/强制加审同录）
        if (mandatory && !fromBrief && !isNonEmptyString(payload.attribution)) {
          return rejectHere("review-attribution-required",
            "加审须留归因：attribution 必填（枚举点 ∉ 简报冻结清单的强制请求）");
        }
        if (!isNonEmptyString(payload.reviewer)) {
          return rejectHere("reviewer-required",
            "复核请求须指定 reviewer（复核帽＝当次空闲实例佩戴，按需召集）");
        }
        if (payload.reviewer === producerOf(existing)) {
          return rejectHere("reviewer-is-producer",
            "本任务产出方不得自任复核者（独立性硬要求；产出方按 report 历史事实判）");
        }
        if (holdingsOf(payload.reviewer, state) !== null) {
          return rejectHere("reviewer-not-idle",
            `实例 ${payload.reviewer} 当前持有进行中任务（复核帽由当次空闲实例佩戴，V-A1.3 台账查询腿）`);
        }
      }
      // 必审拦截（V-A2.7）：必审复核点未闭合（未复核或最近报告 gaps-open）时
      // 交付转移被拒——复核点是边界事件，交付即跨越对外边界
      if (spec.type === "deliver") {
        const open = openMandatorySubjects(taskReviewScope(existing, state.events));
        if (open.length > 0) {
          return rejectHere("review-gaps-open",
            `必审复核点未闭合（${open.join("、")}）——gaps 未闭合不得交付／回笼`);
        }
      }
      if (spec.type === "assign") {
        if (typeof payload.assignee !== "string" || payload.assignee === "") {
          return rejectHere("invalid-assignee", "派单须指定 assignee");
        }
        const held = holdingsOf(payload.assignee, state);
        if (held !== null && held.taskId !== taskId) {
          return rejectHere("assignee-holding",
            `实例 ${payload.assignee} 已持进行中任务 ${held.taskId}（一实例一进行中任务，机械拒绝）`);
        }
      }
      // 关闭前置（规格 §B；14 号票两项＋25 号票判据项）：命中的复核点已闭合 ＋ 验收
      // 判据均有可执行检查的通过记录（关闸现跑，不采信自报）＋ 产出已按「谁产出谁登记」
      // 登记。产出登记面读失败＝fail closed（不静默放行——把读不到当成「不需要登记」
      // 正是假绿）。判据执行面未接线同样 fail closed（acceptance-check-unwired）。
      if (spec.type === "close") {
        let registered;
        try {
          registered = resolveArtifacts(taskId);
        } catch (error) {
          return rejectHere("artifact-registry-unreadable",
            `产出登记面不可读（fail closed）：${error?.message ?? String(error)}`);
        }
        // 执行面解析同样受 fail closed 约束：工厂抛错不得逃出命令面（逃出去＝500＋无账，
        // 契约是「拒绝＝{ok:false,code,reason}＋落 command-rejected」）
        let criterionRunner;
        try {
          criterionRunner = resolveCriterionRunner(taskId);
        } catch (error) {
          return rejectHere("acceptance-check-unwired",
            `验收判据执行面不可用（fail closed）：「跑不了」不等于「过了」；${error?.message ?? String(error)}`);
        }
        // 进门＝任务快照（42 号票）：事件取**本任务域读法**（`taskEvents`），不再把
        // 命令面手上的整条日志交到关闸判定手上；任务域读取语义不变（`taskReviewScope`
        // 内按 taskId 过滤）。判据／登记两腿仍由注入面给。
        const verdict = await closePrecondition({
          snapshot: { task: existing, events: ledger.taskEvents(taskId), artifacts: registered },
          criterionRunner
        });
        // 另一条同键命令可能已在等待期间完成。先重放首次结论，不能用本次检查
        // 的拒绝或成功覆盖它；鉴权信封也不在此重复消费。
        const completed = idempotencyGate(idempotencyKey);
        if (completed.error) return completed.error;
        if (completed.prior !== null) {
          return { ...completed.prior.result, replayed: true, task: ledger.task(completed.prior.result.taskId ?? taskId) };
        }
        // 检查期间同一 host 可处理其他命令。异步前通过的 CAS 只覆盖旧投影，
        // 回来须重读本任务；重验到追加之间不再 await，不能写入过期的关闭事件。
        let current;
        try {
          current = loadTask(taskId);
        } catch (error) {
          return { ok: false, code: "ledger-corrupt", reason: error.message };
        }
        if (current?.lastSeq !== existing.lastSeq || current?.status !== existing.status) {
          return rejectHere("cas-mismatch",
            "关闭检查期间任务已变化，须按当前状态与序号重新提交（CAS 拒绝）",
            { expectedStatus, expectedSeq, taskStatus: current?.status ?? null });
        }
        if (!verdict.ok) {
          // 判据类拒绝的复验锚（快照摘要／第几条）只入回执与幂等预留记录，**不进事件**
          // ——事件 schema 键封闭（EVENT_EXTRA_KEYS），照 21 号票①的 extraResult 先例；
          // 理由串本身已点名 index／命令／原因，故账上可读、回执可复验。
          return rejectHere(verdict.code, verdict.reason,
            {},
            verdict.code === "acceptance-check-failed"
              ? { snapshotSha256: verdict.snapshotSha256 ?? null, failedIndex: verdict.failedIndex }
              : {});
        }
        // 登记面不在台账事件流中，任务 CAS 不变也可能撤除或读失败，须重新取件。
        // 本段纯同步，判据不重跑；登记与预检共用同一谓词。
        let registration;
        try {
          registration = artifactRegistrationVerdict(current, resolveArtifacts(taskId));
        } catch (error) {
          return rejectHere("artifact-registry-unreadable",
            `产出登记面不可读（fail closed）：${error?.message ?? String(error)}`);
        }
        if (!registration.ok) return rejectHere(registration.code, registration.reason);
      }
      return appendStateEvent({ task: existing, type: spec.type, actor, payload, idempotencyKey, op });
    },

    /**
     * LLM 判断输入（承接岗提交）：只落 `judgement` 事实，**从不改状态**——状态
     * 改写一律由确定性层按转移表执行（规格 §B）。命令面的薄包装（校验与写只在一处）。
     */
    async judgement({ taskId, actor, intent, input, idempotencyKey } = {}) {
      return await ledger.command({ op: "task.judge", taskId, actor, idempotencyKey, payload: { intent, input } });
    },

    /**
     * 异常登记（四类统一走台账、不静默丢失）。异常是**告警事件**：不改状态，
     * 状态改写仍走命令面。`idempotencyKey` 必填——同源异常重复登记只留一条。
     */
    async raiseException({ taskId, kind, detail = {}, actor = { kind: "host", id: "web" }, idempotencyKey } = {}) {
      return await ledger.command({ op: "task.exception", taskId, actor, idempotencyKey, payload: { kind, detail } });
    },

    /**
     * 复核报告入账（org-v2 08 号票；规格 §C「gaps 报告」；帽腿＝**权威门**——27 号票）。
     * 复核帽不是任务 owner、无台账写 op——报告由 host 侧经本面落盘（写路径仍是台账
     * 内部的单一写者通道）。机械校验：**复核帽验签**（本面是权威门：报告是事实源里
     * 的事件一条，换通道也得持帽）、报告形状（`validateReviewReport`，复核者只读的
     * 形状层——不携带改工件／改判据字段）、subject 已登记请求、提交者＝指定复核者、
     * 产出方不得自任。强制点**连续两轮未闭合自动上浮用户终裁**（追加 `escalated`，
     * cause=review-rounds-exhausted；已挂起不重复上浮）。
     *
     * **帽腿三段式与唯一消费点（27 号票口径，`verifyReviewHat` 单一源）**：
     *   ① 预验（`consumeNonce:false`）——签名／身份／TTL／代际／活态；② 帽腿——post
     *   须为 verifier 且帽内含 `review.report`（**在消费之前**：非帽信封不被烧）；
     *   ③ **消费**（`consumeNonce:true`＝复验＋`consumeNonceOnce` 独占消费）——本面
     *   是复核面**唯一的消费点**（通道门只做入口预筛，不消费；读面不消费）。据此
     *   「一次提交恰好消费一次」：**过了帽腿即消费**，其后的确定性拒绝（形状／任务
     *   终态／产出方自任／未请求 subject／非指定复核者）照旧消费——与命令面
     *   「授权通过而被拒同样消费信封＋续签」同构（21 号票①）；**未过帽腿的拒绝
     *   （无帽／他人帽／非复核帽／帽缺 op）与预验失败（过期／重放／代际）不消费**。
     *   幂等键重放仍在帽腿之前短路（结构前置，命令面同序），不消费新帽。
     */
    async recordReviewReport({ taskId, reviewer, report, capability, idempotencyKey } = {}) {
      const op = "review.report";
      const gate = idempotencyGate(idempotencyKey);
      if (gate.error) return gate.error;
      if (gate.prior !== null) {
        return { ...gate.prior.result, replayed: true, task: ledger.task(gate.prior.result.taskId ?? taskId) };
      }
      if (!isTaskId(taskId)) return { ok: false, code: "invalid-task-id", reason: `taskId 非法（须 TK- 前缀）：${String(taskId)}` };
      if (!isNonEmptyString(reviewer)) return { ok: false, code: "invalid-reviewer", reason: "reviewer 必填" };
      const asPost = { kind: "post", id: reviewer };
      const hatArgs = { issuer: reviewHat, envelope: capability, botId: reviewer, taskId, op };
      // ①② 预验＋帽腿（不消费）：任一腿不过即拒，且**不烧帽**（越权尝试不消耗任何人的帽）
      const hat = verifyReviewHat(hatArgs);
      if (!hat.ok) return reject(taskId, asPost, idempotencyKey, op, hat.code, hat.reason);
      // ③ 消费（唯一消费点）：复验＋独占消费——删掉 TOCTOU 窗口（TTL／代际／活态／重放）
      const consumed = verifyReviewHat({ ...hatArgs, consumeNonce: true });
      if (!consumed.ok) return reject(taskId, asPost, idempotencyKey, op, consumed.code, consumed.reason);
      // 帽腿之后的 **reject 回执**都带 `authorized: true`（只入回执与幂等预留、
      // **不进事件**——照命令面 21 号票①的同一标记口径）：授权有效且信封已被本次
      // 提交消费，host 据此续签（连报不断链）；**帽腿之前的拒绝不带**——未获授权的
      // 提交不换新信封，已消费旧帽的重放（③ 拒）也在其中，否则一张旧帽可以无限
      // 换新帽。台账不可读／写锁失败等结构性失败（`ledger-corrupt`／锁码）与命令面
      // 同形：不是 reject 路径、不带该标记（那种失败下续签也没有意义）。
      const rejectAuthorized = (code, reason) =>
        reject(taskId, asPost, idempotencyKey, op, code, reason, {}, { authorized: true });
      const shape = validateReviewReport(report);
      if (!shape.ok) {
        return rejectAuthorized("invalid-review-report",
          `复核报告形状不符（fail closed）：${shape.violations.join("；")}`);
      }
      // 读：一次取常驻当前态（本命令后续「拿到事件」的点全吃这一份快照——与旧实现
      // 「一次 readEvents 快照」同义；41 号票只换来源，判定一个字不改）
      let state;
      let existing;
      try {
        state = residentState();
        existing = findTask(state, taskId);
      } catch (error) {
        return { ok: false, code: "ledger-corrupt", reason: error.message };
      }
      if (existing === null) {
        return rejectAuthorized("task-not-found", `任务不存在：${taskId}`);
      }
      if (CLOSED_STATES.includes(existing.status)) {
        return rejectAuthorized("task-closed",
          `任务已终态（${existing.status}），不再受理复核报告`);
      }
      if (reviewer === producerOf(existing)) {
        return rejectAuthorized("reviewer-is-producer",
          "本任务产出方不得自任复核者（独立性硬要求；产出方按 report 历史事实判）");
      }
      const entry = collectReviewState(taskReviewScope(existing, state.events)).subjects.get(report.subject);
      if (entry === undefined) {
        return rejectAuthorized("review-not-requested",
          `subject 未在本任务登记复核请求：${String(report.subject)}`);
      }
      if (entry.reviewer !== reviewer) {
        return rejectAuthorized("not-designated-reviewer",
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
        taskId, actor: asPost, payload,
        at: new Date(now()).toISOString(), writerEpoch: held.lock.writerEpoch, seq
      });
      const written = writeEvent(event);
      if (!written.ok) return written;
      const afterEntry = collectReviewState(taskReviewScope(existing, readEvents()))
        .subjects.get(report.subject);
      let escalated = false;
      let escalationError = null;
      if (afterEntry.mandatory && report.verdict === "gaps-open" &&
          afterEntry.consecutiveUnclosed >= UNCLOSED_ROUNDS_TO_ESCALATE && existing.status !== "waiting-user") {
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
     * 验收初审裁决入账（org-v2 09 号票；规格 §F、`V-A5.4`）。初审代理（值班统筹
     * 或指派的便宜模型实例）的处置结论经本面落台账——写路径仍是台账单一写者
     * 通道。机械规则：
     *   - **处置须在必审清单外**：命中必审清单且有未闭合者只可整理裁定包
     *     （`preScreenBoundary` 结论＝package-only 时处置即拒，`pre-screen-dispose-forbidden`）；
     *   - 结论以 `judgement` 事实留痕（非状态、幂等、可审计）；
     *   - **初审拒绝或判据连续两轮未闭合＝强制上浮用户终裁**（追加 `escalated`，
     *     cause 由 `preScreenEscalation` 给出；已挂起不重复上浮，上浮失败响亮返回）。
     */
    async recordPreScreen({ taskId, reviewer, disposition, note, idempotencyKey } = {}) {
      const op = "review.prescreen";
      const gate = idempotencyGate(idempotencyKey);
      if (gate.error) return gate.error;
      if (gate.prior !== null) {
        return { ...gate.prior.result, replayed: true, task: ledger.task(gate.prior.result.taskId ?? taskId) };
      }
      const actor = { kind: "host", id: "prescreen" };
      if (!isTaskId(taskId)) return { ok: false, code: "invalid-task-id", reason: `taskId 非法（须 TK- 前缀）：${String(taskId)}` };
      if (!isNonEmptyString(reviewer)) return { ok: false, code: "invalid-reviewer", reason: "reviewer（初审代理身份）必填" };
      if (!PRE_SCREEN_DECISION_IDS.includes(disposition)) {
        return reject(taskId, actor, idempotencyKey, op, "invalid-prescreen-disposition",
          `初审处置须为 ${PRE_SCREEN_DECISION_IDS.join("|")} 之一：${String(disposition)}`);
      }
      // 读：一次取常驻当前态（本命令后续「拿到事件」的点全吃这一份快照——与旧实现
      // 「一次 readEvents 快照」同义；41 号票只换来源，判定一个字不改）
      let state;
      let existing;
      try {
        state = residentState();
        existing = findTask(state, taskId);
      } catch (error) {
        return { ok: false, code: "ledger-corrupt", reason: error.message };
      }
      if (existing === null) return reject(taskId, actor, idempotencyKey, op, "task-not-found", `任务不存在：${taskId}`);
      if (CLOSED_STATES.includes(existing.status)) {
        return reject(taskId, actor, idempotencyKey, op, "task-closed", `任务已终态（${existing.status}），不再受理初审裁决`);
      }
      const boundary = preScreenBoundary(taskReviewScope(existing, state.events));
      if (boundary.mode === "package-only") {
        return reject(taskId, actor, idempotencyKey, op, "pre-screen-dispose-forbidden", boundary.reason);
      }
      const { subjects } = collectReviewState(taskReviewScope(existing, readEvents()));
      const consecutiveUnclosed = [...subjects.values()]
        .filter((entry) => entry.mandatory)
        .reduce((max, entry) => Math.max(max, entry.consecutiveUnclosed), 0);
      const verdict = preScreenEscalation({ decision: disposition, entry: { consecutiveUnclosed } });
      return await judgementEscalationLeg({
        taskId, actor, op, idempotencyKey,
        intent: "pre-screen", input: { reviewer, disposition, note: note ?? null },
        escalate: verdict.escalate, cause: verdict.cause, eventFrom: "judgement",
        extra: { disposition, reviewer, escalationReason: verdict.reason }
      });
    },

    /**
     * 判据缺口 needs-user 上浮入账（org-v2 19 号票；规格 §B「分解不出来标
     * `needs-user` 上浮」，2026-09-19 用户裁定＝扩枚举：`ESCALATION_CAUSES` 增
     * `needs-user`，上浮入口照 `recordPreScreen` 同型）。机械规则：
     *   - **锚定**：本任务最近一次拒绝须为 `criteria-gap`（`lastRejection` 投影）
     *     ——「分解不出来」的主张必须紧跟真实的判据缺口拒绝，不得作通用挂起旁路
     *     （拒收/退回/失败各有其通道）；
     *   - 结论以 `judgement` 事实留痕（intent=needs-user，携带缺口归因与锚）；
     *   - 上浮＝`escalated` 事件（cause=needs-user；来态扩 triaged——立项期缺口
     *     在简报未冻结前上浮），通知投影达 user；已挂起不重复上浮（零事件——
     *     该分支不校验原挂起原因：上浮主张的成立以锚为准，他因挂起复用此入口
     *     时同样不重复落事件，同 `recordPreScreen` 口径）。
     * 生产触发面（谁代表承接流程调本面）随 13/14 召集接线，同 `recordPreScreen`
     * 留界口径；needs-user 不在永不可代表内——user 可经 amend＋resume 补判据复归。
     */
    async recordNeedsUser({ taskId, reason, idempotencyKey } = {}) {
      const op = "task.needs-user";
      const gate = idempotencyGate(idempotencyKey);
      if (gate.error) return gate.error;
      if (gate.prior !== null) {
        return { ...gate.prior.result, replayed: true, task: ledger.task(gate.prior.result.taskId ?? taskId) };
      }
      const actor = { kind: "host", id: "needs-user" };
      if (!isTaskId(taskId)) return { ok: false, code: "invalid-task-id", reason: `taskId 非法（须 TK- 前缀）：${String(taskId)}` };
      if (!isNonEmptyString(reason)) {
        return { ok: false, code: "needs-user-reason-required", reason: "上浮理由必填（「分解不出来」的归因留痕）" };
      }
      let existing;
      try {
        existing = loadTask(taskId);
      } catch (error) {
        return { ok: false, code: "ledger-corrupt", reason: error.message };
      }
      if (existing === null) return reject(taskId, actor, idempotencyKey, op, "task-not-found", `任务不存在：${taskId}`);
      if (CLOSED_STATES.includes(existing.status)) {
        return reject(taskId, actor, idempotencyKey, op, "task-closed", `任务已终态（${existing.status}），不再受理 needs-user 上浮`);
      }
      const anchor = existing.lastRejection;
      if (anchor === null || anchor === undefined || anchor.code !== "criteria-gap") {
        return reject(taskId, actor, idempotencyKey, op, "criteria-gap-anchor-missing",
          "needs-user 上浮须锚定在案的判据缺口拒绝（最近一次拒绝码须为 criteria-gap）——本任务无此锚");
      }
      if (existing.status === "waiting-user") {
        const result = { ok: true, taskId, escalated: false, cause: null, note: "已挂起，不重复上浮" };
        reserve(idempotencyKey, { taskId, op, result });
        return result;
      }
      return await judgementEscalationLeg({
        taskId, actor, op, idempotencyKey,
        intent: "needs-user",
        input: { reason, anchor: { op: anchor.op, code: anchor.code, at: anchor.at } },
        escalate: true, cause: "needs-user", eventFrom: "escalation"
      });
    },

    /**
     * 值守例程触发：幂等键＝「例程 id＋时间窗」，重复触发不产生第二个任务
     * （`V-A2.10`）。例程任务＝class `duty`。
     */
    async triggerRoutine({ routineId, window, actor = { kind: "host", id: "web" }, brief, taskId } = {}) {
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
     * 连续越权达阈（20 号票）→ 通知派单方并对在手任务上浮用户终裁（每串至多一次）。
     */
    async sweep({ at = now(), isInstanceAlive = () => true } = {}) {
      const released = [];
      const escalated = [];
      const stalled = [];
      const exceptionFailures = [];
      for (const task of ledger.openQueue()) {
        if (!HOLDING_STATES.includes(task.status) || task.owner === null) {
          // 队列态滞留检查（intake/triaged/planned）
          const stallAction = QUEUE_STALL_ACTIONS[task.status];
          if (stallAction === undefined || typeof task.updatedAt !== "string") continue;
          if (at - Date.parse(task.updatedAt) < leaseOpts.stallMs) continue;
          const stallPayload = stallAction.payload(task);
          if (stallAction.exceptionKind !== undefined) {
            // 需先登记异常的处置（结算/关闭超时）：异常事件不占状态、幂等按滞留拍计；
            // 登记失败**响亮回报**（exceptionFailures），上浮动作仍照做——异常是记录，
            // 不是处置的前置条件，但绝不静默吞掉失败
            const exception = await ledger.raiseException({
              taskId: task.taskId,
              kind: stallAction.exceptionKind,
              detail: {
                cause: stallPayload.cause ?? stallAction.type,
                previousStatus: task.status,
                dispatchCount: task.dispatchCount
              },
              idempotencyKey: `sweep-exception:${stallAction.exceptionKind}:${task.taskId}:${String(task.lastSeq)}`
            });
            if (exception.ok !== true) {
              exceptionFailures.push({
                taskId: task.taskId, kind: stallAction.exceptionKind, code: exception.code ?? null
              });
            }
          }
          const result = appendStateEvent({
            task, type: stallAction.type, actor: { kind: "host", id: "web" },
            payload: stallPayload,
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
        const exception = await ledger.raiseException({
          taskId: task.taskId,
          kind: exceptionKind,
          detail: { cause, previousOwner: task.owner, deadline, dispatchCount: task.dispatchCount },
          idempotencyKey: `sweep-exception:${exceptionKind}:${task.taskId}:${String(task.lastSeq)}`
        });
        if (exception.ok !== true) {
          exceptionFailures.push({ taskId: task.taskId, kind: exceptionKind, code: exception.code ?? null });
        }
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
      // 连续越权上浮（20 号票，§D「连续越权通知派单方并计入上浮」）：拒绝回执链按
      // 岗位实例折叠（判定与通知投影在 lib/org/unauthorized-count.js），达阈且本串
      // 未处置的实例＝通知派单方＋对在手任务上浮用户终裁（escalated，cause=
      // out-of-bounds——词表 09 号票预冻，越权处置永不可代）。腿内**通知先行、
      // 上浮后行**：通知事件即锚点（串内已通知/已上浮的守卫都在 unauthorized-count.js
      // 纯函数面），先落通知使通知写失败保住下拍重试窗口——上浮成功后整串即被守卫
      // 抑制，通知后行则其写失败将永不补发（24 号票复审缺口收口）；上浮写失败经
      // exceptionFailures 响亮回报、下拍补上浮，已落通知不回滚。无在手任务＝只通知
      // 不上浮（拒绝本就 fail closed）；上浮目标限在手四态＝escalated 来态白名单内
      // 的合法转移。
      const unauthorized = [];
      const state = residentState();
      const events = state.events;
      const tasks = [...state.tasks.values()];
      const taskById = new Map(
        tasks.filter((task) => typeof task?.taskId === "string").map((task) => [task.taskId, task])
      );
      for (const threat of unauthorizedThreats({
        events, tasks, threshold: leaseOpts.unauthorizedThreshold
      })) {
        const pending = pendingNoticeTaskIds(events, threat);
        const notices = [];
        for (const notice of threat.notices) {
          if (!pending.includes(notice.taskId)) continue; // 本串已通知过（事件锚点）
          const target = taskById.get(notice.taskId);
          if (target === undefined) {
            // 事件流不变量破缺（被越权 taskId 无任务投影）——响亮回报，不锚幻影任务
            exceptionFailures.push({ taskId: notice.taskId, kind: "unauthorized-notify", code: "task-projection-missing" });
            continue;
          }
          const written = appendStateEvent({
            task: target,
            type: "unauthorized-notified", actor: { ...UNAUTHORIZED_ESCALATION_ACTOR },
            payload: { instanceId: threat.actor, count: threat.count },
            idempotencyKey: `unauthorized-notify:${threat.actor}:${notice.taskId}:${String(threat.firstSeq)}`,
            op: "task.sweep"
          });
          if (written.ok) notices.push({ ...notice, seq: written.seq });
          else {
            exceptionFailures.push({ taskId: notice.taskId, kind: "unauthorized-notify", code: written.code ?? null });
          }
        }
        const held = holdingsOf(threat.actor, state);
        let escalatedTaskId = null;
        if (held !== null) {
          const result = appendStateEvent({
            task: held, type: "escalated", actor: { ...UNAUTHORIZED_ESCALATION_ACTOR },
            payload: { cause: "out-of-bounds", dispatchCount: held.dispatchCount, previousOwner: held.owner },
            idempotencyKey: `unauthorized-escalate:${threat.actor}:${held.taskId}:${String(held.lastSeq)}`,
            op: "task.sweep"
          });
          if (result.ok) escalatedTaskId = held.taskId;
          else {
            exceptionFailures.push({ taskId: held.taskId, kind: "unauthorized-escalation", code: result.code ?? null });
          }
        }
        if (escalatedTaskId !== null || notices.length > 0) {
          unauthorized.push({
            actor: threat.actor, count: threat.count, taskIds: threat.taskIds,
            escalatedTaskId, notices
          });
        }
      }
      return { released, escalated, stalled, exceptionFailures, unauthorized };
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
