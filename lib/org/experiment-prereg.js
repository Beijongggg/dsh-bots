/**
 * 放大验收实验的预登记件机械面（org-v2 17 号票；规格 §J「放大验证实验设计」、
 * 附录 A B 组 `V-B1`／`V-B2` 与「预登记件（实验前冻结，跑完不得改）」节）。
 *
 * 本模块只把守**预登记件**这一件事：基准集（3–5 个任务按放大机制各取一、每任务
 * 四要素简报＋可执行 acceptance）、对照口径（裸实例＝同模型、同基础工具面、
 * 无组织命令 op、无组织层脚手架、预算同量级）、数值门槛与成本口径的形状，
 * 以及**冻结摘要**与裸对照入集判定。判据语义不在本模块（语义权威＝规格附录 A，
 * 冻结）——故本件不是第二份判据清单，而是「实验前必须由用户预登记并随即冻结」
 * 这条纪律的机械面。
 *
 * 数值门槛（绝对预算 B、量级倍数、重派封顶、初审与越权阈值——规格 §Testing
 * Decisions 与「预登记件」节逐条点名）属**用户域**：本模块只判「填没填、是不是
 * 正数、两臂预算是否同量级」，**不发明数值**。未填＝判缺口（`gaps`），非正数＝
 * 违例（`violations`）；两条路都 `ok: false`（fail closed），冻结与判定都进不去。
 *
 * 对照口径按**命令面**切（规格 §J 价值表述括注「裸＝去组织层不去基础工具面」）：
 * 组织命令词表取 `lib/org/op-set.js` 的台账命令面（**单一源**，本模块不另抄
 * 一份），裸侧一条都不许持；基础工具面（文件与执行工具）两臂须相同。
 *
 * 冻结＝对规范化 JSON 取 sha256：预登记件任何一字节改动都会换摘要，故「跑完
 * 未改」可由摘要复验（`preregistrationUnchanged`）。入集判定（`admitBareSet`）
 * 按 `V-B1`「裸对照先跑，失败方入集、裸跑成功即出集，不留在集里充数」——出集
 * 带走的机制如实登记进 `mechanismsLost`（诊断事实），入集为空即无结论可出。
 */
import { canonicalJson, sha256Hex } from "./store-base.js";
import { isPlainObject } from "./capability-base.js";
import { isTaskId } from "./ledger-events.js";
import { validateBrief } from "./brief.js";
import { LEDGER_COMMAND_OPS } from "./op-set.js";
import { isNonEmptyString } from "./is-non-empty-string.js";
import { COST_TOKEN_COMPONENTS, closedKeys, isPositiveNumber, sameStringSet, stringListViolations } from "./experiment-shape.js";

/** 预登记件 schema 版本（形状变更须走规格修订，不静默兼容旧形状）。 */
export const PREREG_SCHEMA_VERSION = "org-v2/amplification-prereg@1";

/** 放大机制封闭枚举（规格 §J：多跳研究、跨文件代码改动、长周期值守例程）。 */
export const EXPERIMENT_MECHANISMS = Object.freeze([
  Object.freeze({ id: "multi-hop-research", label: "多跳研究" }),
  Object.freeze({ id: "cross-file-change", label: "跨文件代码改动" }),
  Object.freeze({ id: "long-running-duty", label: "长周期值守例程" })
]);

/** 机制 id 列表（覆盖判定的封闭词表）。 */
export const MECHANISM_IDS = Object.freeze(EXPERIMENT_MECHANISMS.map((entry) => entry.id));

/**
 * 组织命令 op 词表＝台账命令面**单一源**（`lib/org/op-set.js`）。裸侧持有其中
 * 任何一条即违「无组织命令 op」；组织侧声明的 op 须落在同一词表内（口径闭包）。
 */
export const ORG_COMMAND_OPS = Object.freeze([...LEDGER_COMMAND_OPS]);

/** 预登记件顶层键（封闭枚举）。 */
export const PREREG_KEYS = Object.freeze(["schemaVersion", "experimentId", "tasks", "profiles", "thresholds", "costMetrics"]);

/** 基准集任务条目键（封闭枚举）。 */
export const PREREG_TASK_KEYS = Object.freeze(["taskId", "mechanism", "brief"]);

/** 对照剖面条目键（封闭枚举）。 */
export const PROFILE_KEYS = Object.freeze(["model", "baseTools", "ops", "scaffolding", "budgetB"]);

/**
 * 数值门槛键（封闭枚举；**五项全属用户域**——规格 §Testing Decisions「绝对预算 B、
 * 量级倍数、重派封顶、初审与越权阈值由用户在实验前填进预登记件」）。前三项之外的
 * 两项是组织运行期的既有缝（台账租约的 `redispatchCap`、复核上浮轮次与连续越权
 * 阈值），预登记把它们钉在冻结点上，实验期内不得改。
 */
export const THRESHOLD_KEYS = Object.freeze([
  "budgetB", "magnitudeMultiple", "redispatchCap", "reviewRoundsToEscalate", "unauthorizedAttempts"
]);

/** 数值门槛的中文名（缺口／违例理由共用，免两处各写一份）。 */
export const THRESHOLD_LABELS = Object.freeze({
  budgetB: "绝对预算 B",
  magnitudeMultiple: "量级倍数",
  redispatchCap: "重派封顶",
  reviewRoundsToEscalate: "初审阈值",
  unauthorizedAttempts: "越权阈值"
});

/** 成本口径键（封闭枚举；币值字段非空即拒）。 */
export const COST_METRIC_KEYS = Object.freeze(["tokens", "wallClock", "rounds", "currency"]);

/** 裸对照跑分记录键（封闭枚举）。 */
export const BARE_RUN_KEYS = Object.freeze(["taskId", "arm", "at", "outcome", "failureReason"]);

/** 基准集任务数上下限（规格 §J「3–5 个」）。 */
export const MIN_BENCHMARK_TASKS = 3;
export const MAX_BENCHMARK_TASKS = 5;

/** 任务数区间的展示字形。 */
const TASK_COUNT_HINT = `${String(MIN_BENCHMARK_TASKS)}–${String(MAX_BENCHMARK_TASKS)}`;

/** 基准集校验（任务集与机制覆盖；入集判定与预登记校验共用同一段，免两处漂移）。 */
function validateTaskSet(tasks, violations) {
  if (!Array.isArray(tasks)) {
    violations.push("tasks（基准集）须为数组");
    return;
  }
  if (tasks.length < MIN_BENCHMARK_TASKS || tasks.length > MAX_BENCHMARK_TASKS) {
    violations.push(`基准集须为 ${TASK_COUNT_HINT} 个任务（当前 ${String(tasks.length)} 个）`);
  }
  const mechanisms = [];
  tasks.forEach((task, index) => {
    const at = `tasks[${String(index)}]`;
    if (!closedKeys(task, PREREG_TASK_KEYS, at, violations)) return;
    if (!isTaskId(task.taskId)) {
      violations.push(`${at} 的任务标识 ${String(task.taskId)} 非台账任务号形状（TK-…；判据落点须可回读台账）`);
    }
    if (!MECHANISM_IDS.includes(task.mechanism)) {
      violations.push(`${at} 的 mechanism「${String(task.mechanism)}」不在机制词表（${MECHANISM_IDS.join("｜")}）`);
    } else {
      mechanisms.push(task.mechanism);
    }
    // 简报违例逐条上卷（点名任务，便于定位是哪一件不可入集）
    const brief = validateBrief(task.brief);
    brief.violations.forEach((line) => violations.push(`${at} 的简报不合契约：${line}`));
    if (brief.gap !== null) {
      // 「在但不可执行」在基准集里是**硬拒**（判据执行面是本实验的通过与否判据，
      // 不可执行即无法出结论），不按简报流程的缺口（可上浮）处置。
      violations.push(`${at} 的简报存在判据缺口（基准集要求每任务可执行 acceptance）：${brief.gap.reason}`);
    }
  });
  for (const id of MECHANISM_IDS) {
    if (!mechanisms.includes(id)) {
      violations.push(`基准集未覆盖放大机制 ${id}（${EXPERIMENT_MECHANISMS.map((entry) => entry.label).join("／")}各取一）`);
    }
  }
}

/** 对照口径校验（`V-B2`：同模型、同基础工具面、无组织命令 op、无组织层脚手架、预算同量级）。 */
function validateProfiles(profiles, thresholds, violations, gaps) {
  if (!closedKeys(profiles, ["bare", "org"], "profiles（对照口径）", violations)) return;
  const bare = profiles.bare;
  const org = profiles.org;
  const bareShape = closedKeys(bare, PROFILE_KEYS, "profiles.bare", violations);
  const orgShape = closedKeys(org, PROFILE_KEYS, "profiles.org", violations);
  if (!bareShape || !orgShape) {
    violations.push("profiles 须同时给出 bare 与 org 两臂（缺一臂即对照差分不成立）");
    return;
  }

  if (typeof bare.model !== "string" || bare.model === "" || bare.model !== org.model) {
    violations.push(`对照口径须同模型：bare.model=${String(bare.model)}，org.model=${String(org.model)}`);
  }
  const bareTools = stringListViolations(bare.baseTools, "profiles.bare.baseTools", violations);
  const orgTools = stringListViolations(org.baseTools, "profiles.org.baseTools", violations);
  if (bareTools && orgTools && bare.baseTools.length > 0) {
    if (!sameStringSet(bare.baseTools, org.baseTools)) {
      violations.push(`对照口径须同基础工具面（按命令面切，不去掉文件与执行工具）：bare=${[...bare.baseTools].sort().join("、")}，org=${[...org.baseTools].sort().join("、")}`);
    }
  } else if (bareTools && orgTools) {
    violations.push("基础工具面须为非空列表（两臂同面）");
  }
  if (stringListViolations(bare.ops, "profiles.bare.ops", violations)) {
    const held = bare.ops.filter((op) => ORG_COMMAND_OPS.includes(op));
    if (held.length > 0) {
      violations.push(`裸实例不得持组织命令 op（按命令面切）：${held.join("、")}`);
    }
  }
  if (stringListViolations(org.ops, "profiles.org.ops", violations)) {
    // 组织命令面＝op-set 的**冻结词表**：组织侧声明的 op 必须是其中一条
    // （表外 op 即词表漂移——「无组织命令 op」这条差分才有封闭的参照物）。
    const unknown = org.ops.filter((op) => !ORG_COMMAND_OPS.includes(op));
    if (org.ops.length === 0) violations.push("组织侧须声明其组织命令 op（空声明＝对照差分不成立）");
    if (unknown.length > 0) {
      violations.push(`组织侧声明的 op 不在组织命令词表内：${unknown.join("、")}（词表＝op-set 单一源）`);
    }
  }
  if (stringListViolations(bare.scaffolding, "profiles.bare.scaffolding", violations) && bare.scaffolding.length > 0) {
    violations.push(`裸实例不得带组织层脚手架：${bare.scaffolding.join("、")}`);
  }
  if (stringListViolations(org.scaffolding, "profiles.org.scaffolding", violations) && org.scaffolding.length === 0) {
    violations.push("组织侧须声明其组织层脚手架（口径闭包：无声明即无法核验「裸侧无脚手架」切得干净）");
  }
  // 两臂预算同属**用户域**（预算 B 的数值）：未填＝缺口（与门槛同列），填了非正数才是违例
  const budgetGaps = [];
  for (const [arm, value] of [["bare", bare.budgetB], ["org", org.budgetB]]) {
    if (value === null || value === undefined) budgetGaps.push(`profiles.${arm}.budgetB`);
    else if (!isPositiveNumber(value)) violations.push(`profiles.${arm}.budgetB 须为正数（token 为主口径；当前 ${String(value)}）`);
  }
  if (budgetGaps.length > 0) {
    gaps.push(`${budgetGaps.join("、")} 未预登记——预算 B 数值属用户域（两臂预算须由用户填进预登记件并随即冻结）`);
  }
  // 预算同量级：以用户预登记的门槛 B 与量级倍数为判（未预登记时此项无处可判，留缺口）
  const bareBudget = isPositiveNumber(bare.budgetB);
  const orgBudget = isPositiveNumber(org.budgetB);
  if (bareBudget && orgBudget && isPositiveNumber(thresholds?.budgetB) && typeof thresholds?.magnitudeMultiple === "number"
    && Number.isFinite(thresholds.magnitudeMultiple) && thresholds.magnitudeMultiple > 1) {
    const low = thresholds.budgetB / thresholds.magnitudeMultiple;
    const high = thresholds.budgetB * thresholds.magnitudeMultiple;
    for (const [arm, value] of [["bare", bare.budgetB], ["org", org.budgetB]]) {
      if (value < low || value > high) {
        violations.push(`对照口径须预算同量级：profiles.${arm}.budgetB=${String(value)} 超出预登记门槛 B=${String(thresholds.budgetB)} × 量级倍数 ${String(thresholds.magnitudeMultiple)} 的区间 [${String(low)}，${String(high)}]`);
      }
    }
  }
}

/** 数值门槛校验（用户域：未填＝缺口、非正数／非数＝违例；两条路都 fail closed）。 */
function validateThresholds(thresholds, violations, gaps) {
  if (!closedKeys(thresholds, THRESHOLD_KEYS, "thresholds（数值门槛）", violations)) return;
  const unregistered = [];
  for (const key of THRESHOLD_KEYS) {
    const label = THRESHOLD_LABELS[key];
    const value = thresholds[key];
    if (value === null || value === undefined) {
      unregistered.push(`${key}（${label}）`);
      continue;
    }
    const predicate = key === "magnitudeMultiple"
      ? (candidate) => typeof candidate === "number" && Number.isFinite(candidate) && candidate > 1
      : isPositiveNumber;
    if (!predicate(value)) {
      violations.push(`thresholds.${key} 须为${key === "magnitudeMultiple" ? "大于 1 的数" : "正数"}（${label}；当前 ${String(value)}）`);
    }
  }
  if (unregistered.length > 0) {
    gaps.push(`thresholds.${unregistered.join("、")} 未预登记——数值门槛属用户域（规格 §Testing Decisions 逐条点名：绝对预算 B、量级倍数、重派封顶、初审与越权阈值须由用户填进预登记件并随即冻结）`);
  }
}

/** 成本口径校验（`V-B4`：token 四分量＋墙钟＋轮次；币值字段非空即拒）。 */
function validateCostMetrics(costMetrics, violations) {
  if (!closedKeys(costMetrics, COST_METRIC_KEYS, "costMetrics（成本口径）", violations)) return;
  const tokens = [...(Array.isArray(costMetrics.tokens) ? costMetrics.tokens : [])].sort();
  const expected = [...COST_TOKEN_COMPONENTS].sort();
  if (tokens.join("\u0000") !== expected.join("\u0000")) {
    violations.push(`costMetrics.tokens 须恰为 token 四分量（${COST_TOKEN_COMPONENTS.join("、")}）——缺项或多项都不叫四分量`);
  }
  if (costMetrics.wallClock !== "wallClockMs") violations.push("costMetrics.wallClock 须为 wallClockMs（墙钟毫秒）");
  if (costMetrics.rounds !== "rounds") violations.push("costMetrics.rounds 须为 rounds（轮次）");
  if (costMetrics.currency !== null && costMetrics.currency !== undefined) {
    violations.push(`costMetrics.currency 非空（${String(costMetrics.currency)}）——成本口径不做币值换算（token 为主口径）`);
  }
}

/**
 * 预登记件校验（fail closed）。返回：
 *   - `violations`＝结构违例（形状／口径／基准集硬拒）；
 *   - `gaps`＝用户域未预登记项（数值门槛），与违例分列但仍 `ok: false`
 *     ——冻结与结论判定都不许在缺口上放行。
 */
export function validatePreregistration(prereg) {
  const violations = [];
  const gaps = [];
  if (!closedKeys(prereg, PREREG_KEYS, "预登记件", violations)) return { ok: false, violations, gaps };
  if (prereg.schemaVersion !== PREREG_SCHEMA_VERSION) {
    violations.push(`schemaVersion 须为 ${PREREG_SCHEMA_VERSION}（当前 ${String(prereg.schemaVersion)}）`);
  }
  if (typeof prereg.experimentId !== "string" || prereg.experimentId === "") {
    violations.push("experimentId 须为非空字符串（判定记录与证据包的回读锚）");
  }
  validateTaskSet(prereg.tasks, violations);
  validateProfiles(prereg.profiles, prereg.thresholds, violations, gaps);
  validateThresholds(prereg.thresholds, violations, gaps);
  validateCostMetrics(prereg.costMetrics, violations);
  return { ok: violations.length === 0 && gaps.length === 0, violations, gaps };
}

/**
 * 预登记件的规范化摘要（键序无关：同一内容同摘要的唯一依据）。不可序列化＝
 * fail closed 折算，不让 JSON 的怪形状穿透成异常（冻结与未改核验两条腿共用）。
 */
function digestOf(prereg) {
  try {
    return { ok: true, digest: sha256Hex(canonicalJson(prereg)), reason: null };
  } catch (error) {
    return { ok: false, digest: null, reason: `预登记件不可序列化（fail closed）：${error.message}` };
  }
}

/**
 * 冻结预登记件：对规范化 JSON 取 sha256。**非法件拒冻**（`ok: false`，
 * `digest: null`）——冻结面不接受「先冻上、后面再补门槛」的走法（那正是
 * 「跑完不得改」要挡的形状）。
 */
export function freezePreregistration(prereg, { now = () => new Date().toISOString() } = {}) {
  const verdict = validatePreregistration(prereg);
  if (!verdict.ok) {
    return { ok: false, record: null, canonical: null, violations: verdict.violations, gaps: verdict.gaps };
  }
  const digested = digestOf(prereg);
  if (!digested.ok) {
    return { ok: false, record: null, canonical: null, violations: [digested.reason], gaps: [] };
  }
  return {
    ok: true,
    // 冻结记录＝判定面收的唯一形状（摘要＋冻结时点＋实验标识，可独立落件与回读）
    record: {
      schemaVersion: prereg.schemaVersion,
      experimentId: prereg.experimentId,
      digest: digested.digest,
      frozenAt: now()
    },
    canonical: canonicalJson(prereg),
    violations: [],
    gaps: []
  };
}

/**
 * 「跑完未改」核验：盘面上的预登记件摘要须与冻结摘要逐字相等。摘要非法或内容
 * 改动一律拒（`code: "prereg-mutated"`）——静默放行会把这门变成空门。
 */
export function preregistrationUnchanged(prereg, frozenDigest) {
  const digested = digestOf(prereg);
  if (!digested.ok) return { ok: false, code: "prereg-mutated", digest: null, reason: digested.reason };
  const digest = digested.digest;
  if (typeof frozenDigest !== "string" || !/^[a-f0-9]{64}$/.test(frozenDigest)) {
    return { ok: false, code: "prereg-mutated", digest, reason: `冻结摘要形状非法：${String(frozenDigest)}（预登记件冻结须留下 64 位十六进制摘要）` };
  }
  if (digest !== frozenDigest) {
    return { ok: false, code: "prereg-mutated", digest, reason: `预登记件已改（冻结 ${frozenDigest}，现盘面 ${digest}）——跑完不得改，改过即不可作为本次结论依据` };
  }
  return { ok: true, digest };
}

/** 冻结记录键（`freeze --out` 落下的件；判定面按此形状取摘要与冻结时点）。 */
export const FROZEN_RECORD_KEYS = Object.freeze(["schemaVersion", "experimentId", "digest", "frozenAt", "preregPath"]);

/**
 * 冻结记录核验（判定面前置）：摘要形状、**冻结时点**与 experimentId 绑定齐备才
 * 算「实验前冻结」有据可查——只收摘要的走法会让「实验前」这半边失守（冻结可以
 * 发生在跑完之后而无人察觉）。
 */
export function validateFrozenRecord(frozen, prereg) {
  const violations = [];
  if (!closedKeys(frozen, FROZEN_RECORD_KEYS, "冻结记录", violations)) {
    return { ok: false, digest: null, frozenAt: null, violations };
  }
  if (typeof frozen.digest !== "string" || !/^[a-f0-9]{64}$/.test(frozen.digest)) {
    violations.push(`冻结记录缺 64 位十六进制摘要（当前 ${String(frozen.digest)}）`);
  }
  if (typeof frozen.frozenAt !== "string" || Number.isNaN(Date.parse(frozen.frozenAt))) {
    violations.push(`冻结记录缺可解析的冻结时点 frozenAt（当前 ${String(frozen.frozenAt)}）——「实验前冻结」须有时点可核`);
  }
  if (!isNonEmptyString(frozen.experimentId)) {
    violations.push("冻结记录缺 experimentId（判定记录与证据包的回读锚）");
  } else if (isPlainObject(prereg) && isNonEmptyString(prereg.experimentId) && frozen.experimentId !== prereg.experimentId) {
    violations.push(`冻结记录的 experimentId（${frozen.experimentId}）与预登记件（${prereg.experimentId}）不一致`);
  }
  return violations.length > 0
    ? { ok: false, digest: null, frozenAt: null, violations }
    : { ok: true, digest: frozen.digest, frozenAt: frozen.frozenAt, violations: [] };
}

/** 裸跑记录校验（入集判定输入；失败必留原因——`V-B5` 归因要接这条腿）。 */
function bareRunVerdict(run, violations) {
  if (!closedKeys(run, BARE_RUN_KEYS, "裸对照跑分", violations)) {
    violations.push("裸对照跑分须为对象");
    return null;
  }
  if (run.arm !== "bare") violations.push(`裸对照跑分的 arm 须为 bare（当前 ${String(run.arm)}）`);
  if (typeof run.at !== "string" || Number.isNaN(Date.parse(run.at))) {
    violations.push(`裸对照跑分须带可解析的完成时点 at（当前 ${String(run.at)}）`);
  }
  if (run.outcome !== "passed" && run.outcome !== "failed") {
    violations.push(`裸对照跑分 outcome 须为 passed 或 failed（当前 ${String(run.outcome)}）`);
    return null;
  }
  if (run.outcome === "failed" && (typeof run.failureReason !== "string" || run.failureReason.trim() === "")) {
    violations.push(`裸对照失败的跑分须记失败原因（V-B5 归因输入；任务 ${String(run.taskId)}）`);
  }
  return run.outcome;
}

/**
 * 裸对照入集判定（`V-B1`）：每件候选任务须有且仅有一条裸跑记录，裸跑失败即入集、
 * 裸跑成功即出集，不留在集里充数。出集带走的机制由 `mechanismsLost` 如实登记
 * （诊断事实，随结论一并读）；但**入集为空**即无结论可出——fail closed，不许拿
 * 「候选都过了」冒充通过。
 */
export function admitBareSet({ prereg, bareRuns } = {}) {
  const violations = [];
  if (!isPlainObject(prereg) || !Array.isArray(prereg.tasks)) {
    return { ok: false, admitted: [], excluded: [], mechanismsLost: [], violations: ["admitBareSet 需要含 tasks 的预登记件（fail closed）"] };
  }
  if (!Array.isArray(bareRuns)) {
    return { ok: false, admitted: [], excluded: [], mechanismsLost: [], violations: ["bareRuns 须为数组（裸对照先跑是入集前提）"] };
  }
  const taskIds = prereg.tasks.map((task) => (isPlainObject(task) ? task.taskId : null));
  const byTask = new Map();
  bareRuns.forEach((run, index) => {
    const outcome = bareRunVerdict(run, violations);
    if (!isPlainObject(run) || typeof run.taskId !== "string") return;
    if (!taskIds.includes(run.taskId)) {
      violations.push(`裸对照跑分第 ${String(index)} 条的 taskId ${run.taskId} 不在基准集内（候选集由预登记件冻结）`);
      return;
    }
    if (byTask.has(run.taskId)) {
      violations.push(`任务 ${run.taskId} 有多条裸对照跑分（入集判定须唯一口径）`);
      return;
    }
    byTask.set(run.taskId, outcome);
  });
  const admitted = [];
  const excluded = [];
  for (const task of prereg.tasks) {
    if (!isPlainObject(task) || typeof task.taskId !== "string") continue;
    if (!byTask.has(task.taskId)) {
      violations.push(`任务 ${task.taskId} 无裸对照跑分记录——基准集入集前须先跑裸对照（V-B1）`);
      continue;
    }
    const outcome = byTask.get(task.taskId);
    if (outcome === "failed") admitted.push(task.taskId);
    if (outcome === "passed") excluded.push(task.taskId);
  }
  const admittedMechanisms = prereg.tasks
    .filter((task) => isPlainObject(task) && admitted.includes(task.taskId))
    .map((task) => task.mechanism);
  const mechanismsLost = MECHANISM_IDS.filter((id) => !admittedMechanisms.includes(id));
  if (admitted.length === 0) {
    violations.push(`入集任务为空——基准集候选（${MECHANISM_IDS.join("、")}）全部裸跑通过即出集，本次实验无结论可出（不许拿候选充数）`);
  }
  return { ok: violations.length === 0, admitted, excluded, mechanismsLost, violations };
}
