/**
 * 放大验收实验的机制归因投影（org-v2 17 号票；规格 §J「机制归因＝事后从台账
 * 事件投影出场清单（分解／互检／外置／并行），**不做对照组消融**」与附录 A
 * `V-B5`「每任务一条机制出场清单加裸对照失败原因；**不进通过与否的判定**」）。
 *
 * 位置与职责：把「组织层到底出了哪种力」从**台账事件**投影成一张诊断清单——
 *   - 分解＝该任务有子任务（`intake` 事件带 `parentTaskId`）；
 *   - 互检＝该任务有复核请求／复核报告事件（08 号票复核件套的事实形态）；
 *   - 外置＝该任务的交付物坐标已登记（`report` 事件的 `deliverable` 或产出登记面）；
 *   - 并行＝该任务的事件时间窗与另一任务重叠（真重叠，不是「同时建了两张票」）。
 *
 * **诊断隔离**：本模块的产出**只描述事实**，不含通过／不通过字段，判定面
 * （`lib/org/experiment-verdict.js`）也不接受它作输入——`V-B5`「只作诊断输出、
 * 不进通过与否的判定」由两侧的结构共同把守，而不是靠调用纪律。
 *
 * 本模块只读输入、零副作用、不触真实运行面。
 */
import { isPlainObject } from "./capability-base.js";
import { EVENT_TYPES } from "./ledger-events.js";
import { isNonEmptyText } from "./experiment-shape.js";

/** 机制出场清单的封闭枚举（与规格 §J 的四种放大机制逐字对应）。 */
export const ATTRIBUTION_MECHANISMS = Object.freeze([
  Object.freeze({ id: "decomposition", label: "分解" }),
  Object.freeze({ id: "cross-check", label: "互检" }),
  Object.freeze({ id: "externalization", label: "外置" }),
  Object.freeze({ id: "parallel", label: "并行" })
]);

/** 机制 id 列表。 */
export const ATTRIBUTION_MECHANISM_IDS = Object.freeze(ATTRIBUTION_MECHANISMS.map((entry) => entry.id));

/**
 * 归因引用的事件类型（**词表单一源＝`ledger-events.EVENT_TYPES`**，本表只是其中
 * 被投影的几条；加载时逐条校验，词表漂移即当场抛而不是静默投影空气）。
 * 互检只认复核件套的两种事实：`judgement`（判断输入）**不在表内**——判断输入
 * 冒充互检会把「谁看了谁的产出」变成「谁提交了自评」。
 */
const DECOMPOSITION_EVENT = "intake";
const EXTERNALIZATION_EVENT = "report";
const REVIEW_EVENT_TYPES = Object.freeze(["review-requested", "review-reported"]);
for (const type of [DECOMPOSITION_EVENT, EXTERNALIZATION_EVENT, ...REVIEW_EVENT_TYPES]) {
  if (!EVENT_TYPES.includes(type)) throw new Error(`归因模块引用的事件类型不在台账事件词表内：${type}`);
}

const parseableAt = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));

/** 任务事件时间窗（可解析时点的闭区间；无时点＝无窗口，不参与并行判定）。 */
function windowOf(events) {
  const times = events.map((event) => Date.parse(event.at)).filter((value) => !Number.isNaN(value));
  if (times.length === 0) return null;
  return { start: Math.min(...times), end: Math.max(...times) };
}

const overlaps = (left, right) => left !== null && right !== null && left.start < right.end && right.start < left.end;

/** 裸跑失败原因（`V-B5` 的诊断输入之一；失败必带原因，缺原因＝违例）。 */
function bareFailureCauses(bareRuns, violations) {
  const causes = new Map();
  if (!Array.isArray(bareRuns)) {
    violations.push("bareRuns 须为数组（裸对照失败原因是归因的必接腿）");
    return causes;
  }
  for (const run of bareRuns) {
    if (!isPlainObject(run) || typeof run.taskId !== "string") {
      violations.push("裸跑记录须为带 taskId 的对象");
      continue;
    }
    if (run.outcome === "failed" && !isNonEmptyText(run.failureReason)) {
      violations.push(`任务 ${run.taskId} 的裸对照失败未记失败原因（V-B5 归因输入）`);
      continue;
    }
    if (run.outcome === "failed") causes.set(run.taskId, run.failureReason);
  }
  return causes;
}

/**
 * 机制出场清单投影。输入：
 *   - `tasks`＝实验任务清单 `{taskId, mechanism}`（由冻结的预登记件给出）；
 *   - `events`＝台账事件序列（全部任务；投影只读，不改事件）；
 *   - `artifacts`＝产出登记面的坐标条目 `{taskId, location}`（可缺省）；
 *   - `bareRuns`＝裸对照跑分记录（失败原因随任务带出）。
 * 输出：`{ok, tasks: [{taskId, mechanism, appearances, mechanisms, evidence, bareFailureCause}], violations}`。
 */
export function attributeMechanisms(input = {}) {
  const violations = [];
  if (!isPlainObject(input)) {
    return { ok: false, tasks: [], violations: ["归因输入须为对象（fail closed）"] };
  }
  const { tasks, events, artifacts = [], bareRuns = [] } = input;
  if (!Array.isArray(tasks)) violations.push("tasks（实验任务清单）须为数组");
  if (!Array.isArray(events)) violations.push("events（台账事件序列）须为数组");
  if (!Array.isArray(artifacts)) violations.push("artifacts（产出登记坐标）须为数组");
  const causes = bareFailureCauses(bareRuns, violations);
  if (violations.length > 0) return { ok: false, tasks: [], violations };

  const own = new Map(tasks.map((task) => [task.taskId, events.filter((event) => event?.taskId === task.taskId)]));
  const windows = new Map([...own].map(([taskId, list]) => [taskId, windowOf(list)]));
  const projected = tasks.map((task) => {
    const list = own.get(task.taskId) ?? [];
    // 分解的腿落在**子任务自己的** intake 事件上（带 parentTaskId），不在本任务事件里
    const children = events
      .filter((event) => event?.type === DECOMPOSITION_EVENT && typeof event.parentTaskId === "string" && event.parentTaskId === task.taskId)
      .map((event) => event.taskId);
    const reviews = list.filter((event) => REVIEW_EVENT_TYPES.includes(event?.type)).length;
    const coordinates = [...new Set([
      ...list.filter((event) => event?.type === EXTERNALIZATION_EVENT && isNonEmptyText(event.deliverable)).map((event) => event.deliverable),
      ...artifacts.filter((entry) => entry?.taskId === task.taskId && typeof entry.location === "string").map((entry) => entry.location)
    ])];
    const overlapping = tasks
      .filter((other) => other.taskId !== task.taskId && overlaps(windows.get(task.taskId) ?? null, windows.get(other.taskId) ?? null))
      .map((other) => other.taskId)
      .sort();
    const mechanisms = {
      decomposition: children.length > 0,
      "cross-check": reviews > 0,
      externalization: coordinates.length > 0,
      parallel: overlapping.length > 0
    };
    return {
      taskId: task.taskId,
      mechanism: task.mechanism,
      mechanisms,
      appearances: ATTRIBUTION_MECHANISM_IDS.filter((id) => mechanisms[id]),
      evidence: {
        decomposition: { children },
        crossCheck: { reviews },
        externalization: { coordinates },
        parallel: { overlapping }
      },
      bareFailureCause: causes.get(task.taskId) ?? null
    };
  });
  return { ok: true, tasks: projected, violations: [] };
}
