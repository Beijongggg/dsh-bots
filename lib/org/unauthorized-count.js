/**
 * 连续越权计数与达阈上浮判定（org-v2 20 号票；规格 §D「拒绝＝fail closed 不执行……
 * 连续越权通知派单方并计入上浮」）。
 *
 * 计数落点＝**拒绝回执链的投影**（`command-rejected` 事件按**岗位实例**折叠，
 * trailing 连续——共用原语 `lib/org/run-count.js`，与 09 号票告知投影同源不同键维：
 * 告知面按任务链、本面按实例链，折叠语义一处实现）。口径：
 *   - 计数：能力面越权拒绝（`isUnauthorizedCode`——`capability-*` 前缀＋权限门三码）；
 *   - 运维性能力面拒绝（TTL 到期／重放／吊销／活态不符）：既不计数也不打断——
 *     一次过期信封不得洗掉越权链；
 *   - 打断重计：该实例的一切其他事件（合法命令、角色类拒绝）——「连续」＝trailing，
 *     与复核两轮上浮（08 号票）同型纪律；
 *   - 其他实例／user／host 的事件不触碰本实例的串。
 *
 * 达阈判定（`unauthorizedThreats`）：串计数 ≥ 阈值（用户域数值的缝，缺省
 * `DEFAULT_UNAUTHORIZED_THRESHOLD`，宿主经台账 `lease.unauthorizedThreshold` 注入）
 * 即产出**通知派单方投影**（按被越权任务路由到其派单方）随 sweep 结果由值守日志
 * 回报；**每越权串至多一次**——串内（seq ≥ firstSeq）已存在本面写出的 `escalated`
 * （cause=out-of-bounds，09 号票预冻词表）即不再重复。通知的落点＝**台账事件投影**
 * （24 号票①裁定：实现向合同靠——§B「通知＝台账事件投影，无事件不通知」）：
 * sweep 对每个待通知的被越权任务落一条非状态事件 `unauthorized-notified`（含无在手
 * 任务这类路径——事件锚在被越权任务 taskId 上），NOTIFY_TO 路由派单方；每串每任务
 * 至多一次（`pendingNoticeTaskIds`，事件本体即跨重启锚点）。sweep 腿**通知先行、
 * 上浮后行**：通知写失败下拍重试；上浮写失败经 exceptionFailures 响亮回报、下拍补
 * 上浮（已落通知不回滚）——上浮成功后整串即被守卫抑制，通知后行将失去重试窗口。
 * 续犯可见于告知投影（09 号票按任务持续计数），再上浮须待串被打断后重新达阈。
 *
 * 本模块只做判定与投影（纯函数）；上浮写入走台账 sweep（单一写者不变，cause=
 * out-of-bounds 的 `escalated` 使任务挂入 waiting-user——越权处置永不可代，
 * `userRulingRequirement` 随投影生效）。无在手任务的越权串只告知不上浮（拒绝本就
 * fail closed）。
 */
import { classifyCapabilityFaceRejection } from "./human-inbox.js";
import { trailingRunSteps } from "./run-count.js";

/** 连续越权上浮阈值缺省（用户域数值；经台账 `lease.unauthorizedThreshold` 覆盖注入）。 */
export const DEFAULT_UNAUTHORIZED_THRESHOLD = 3;

/** 上浮事件的写入者身份（host 进程内确定性组件；串守卫据此识别本面已处置的串）。 */
export const UNAUTHORIZED_ESCALATION_ACTOR = Object.freeze({ kind: "host", id: "unauthorized-count" });

/**
 * 实例链的分类器（20 号票口径）：能力面拒绝按共用归类（越权计数、运维性忽略），
 * 该实例其余事件打断。
 */
function classifyInstanceEvent(event) {
  if (event.type !== "command-rejected") return "reset";
  return classifyCapabilityFaceRejection(event.code);
}

/**
 * 按岗位实例折叠拒绝回执链（纯函数）：返回计数非零的实例串，按实例 id 排序
 * （确定性输出）。`taskIds`＝串内被越权任务（按首次被越权序去重）；`firstSeq`／
 * `lastSeq`＝串的越权事件序号界（串守卫据此判「本串已处置」）。
 */
export function unauthorizedRuns({ events, cursor = 0 } = {}) {
  const { steps } = trailingRunSteps({
    events,
    cursor,
    keyOf: (event) =>
      event?.actor?.kind === "post" && typeof event.actor.id === "string" && event.actor.id !== ""
        ? event.actor.id
        : null,
    classify: classifyInstanceEvent
  });
  const runs = new Map();
  for (const step of steps) {
    if (step.action !== "count") continue;
    const run = runs.get(step.key) ?? {
      actor: step.key, count: 0, firstSeq: step.event.seq, lastSeq: step.event.seq, taskIds: []
    };
    run.count = step.count;
    run.lastSeq = step.event.seq;
    if (!run.taskIds.includes(step.event.taskId)) run.taskIds.push(step.event.taskId);
    runs.set(step.key, run);
  }
  return [...runs.values()].sort((a, b) => (a.actor < b.actor ? -1 : a.actor > b.actor ? 1 : 0));
}

/**
 * 本面（`UNAUTHORIZED_ESCALATION_ACTOR`）在串内（seq ≥ firstSeq）写出过满足
 * `match` 的事件——「每越权串至多一次」两类守卫（上浮／通知）共用的锚定帧
 * （02 纪律：锚定口径一处实现，防两处漂移）。
 */
function faceWroteWithinStreak(events, run, match) {
  return (events ?? []).some((event) =>
    event?.actor?.kind === UNAUTHORIZED_ESCALATION_ACTOR.kind &&
    event.actor?.id === UNAUTHORIZED_ESCALATION_ACTOR.id &&
    Number.isInteger(event.seq) && event.seq >= run.firstSeq &&
    match(event));
}

/** 本串是否已处置过：串内已有本面写出的 out-of-bounds 上浮事件（每越权串至多一次）。 */
function escalatedWithinStreak(events, run) {
  return faceWroteWithinStreak(events, run, (event) =>
    event?.type === "escalated" &&
    event.cause === "out-of-bounds" &&
    event.previousOwner === run.actor);
}

/**
 * 本串尚未通知的被越权任务（24 号票①，§B「通知＝台账事件投影，无事件不通知」）：
 * 串内（seq ≥ firstSeq）已有本面写出的 `unauthorized-notified`（instanceId＝本实例、
 * 事件锚在被越权任务上）即已通知。事件本体取代原幂等预留作跨拍锚点（无在手任务的
 * 零事件路径由此补齐事件落点）；串被打断后重新达阈的新串不 suppressed（锚只锚本串）。
 */
export function pendingNoticeTaskIds(events, run) {
  return (run.taskIds ?? []).filter((taskId) =>
    !faceWroteWithinStreak(events, run, (event) =>
      event?.type === "unauthorized-notified" &&
      event.taskId === taskId &&
      event.instanceId === run.actor));
}

/**
 * 达阈威胁投影（纯函数）：对每个达阈且本串未处置的实例串，给出通知派单方投影
 * （`notices`——每被越权任务一条，`to`＝该任务派单方，不在任务表即 null）。
 * 阈值非法即抛（fail closed——不静默按 0/负值全量上浮）。上浮目标（在手任务）
 * 由消费方按台账状态语义选定（本模块不 import 台账，避免循环依赖）。
 */
export function unauthorizedThreats({ events, tasks, threshold = DEFAULT_UNAUTHORIZED_THRESHOLD } = {}) {
  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new Error(`连续越权阈值须为正整数（fail closed）：${String(threshold)}`);
  }
  const byTask = new Map(
    (tasks ?? []).filter((task) => typeof task?.taskId === "string").map((task) => [task.taskId, task])
  );
  const threats = [];
  for (const run of unauthorizedRuns({ events })) {
    if (run.count < threshold || escalatedWithinStreak(events, run)) continue;
    threats.push({
      ...run,
      notices: run.taskIds.map((taskId) => {
        const dispatcher = byTask.get(taskId)?.dispatcher ?? null;
        return {
          kind: "unauthorized-count", to: dispatcher, taskId, actor: run.actor,
          count: run.count, seq: run.lastSeq,
          text: `连续越权达阈：实例 ${run.actor} 已连续 ${run.count} 次能力面拒绝（任务 ${taskId}）——计入上浮（越权处置永不可代）`
        };
      })
    });
  }
  return threats;
}
