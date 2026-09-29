/**
 * 放大验收实验的结论判定与记录面（org-v2 17 号票；规格 §J 与附录 A `V-B3`／
 * `V-B5`／`V-B6`）。
 *
 * 判定按**预登记门槛**（用户域数值，本模块只应用不发明），两态 fail closed：
 *   - 前置＝预登记件合法且**跑完未改**（摘要复验）、裸对照先跑且失败方入集；
 *   - 每件入集任务：组织内跑判据须与**该任务简报的 acceptance** 逐字一致
 *     （`V-B3`：不得事后新增判据）、组织内跑在 `预算 B × 量级倍数` 内通过；
 *   - 任一结构断裂即 `ok: false`（无结论可出，`passed` 恒 false）；门槛不满足或
 *     判据不过即 `passed: false` 并把理由落到该任务。
 *
 * **机制归因不进判定**（`V-B5`）：判定面输入键封闭为 `prereg／frozen／runs`——
 * 归因数据没有入口，不是靠调用纪律（负例见测试）。
 *
 * 记录面（`V-B6`）：`experimentRecords` 把结论封成三件——台账 `judgement` 事实
 * 负载（`intent`／`input`，**不扩事件词表**）、CHANGELOG 四要件摘要（范围／变化／
 * 验证／授权依据）与增量包文件绑定。本模块不写盘：落账由既有台账命令面执行。
 */
import { canonicalJson } from "./store-base.js";
import { isPlainObject } from "./capability-base.js";
import { admitBareSet, preregistrationUnchanged, validatePreregistration } from "./experiment-prereg.js";
import { aggregateRunCost } from "./experiment-cost.js";

/** 判定面输入键（封闭枚举：机制归因没有入口）。 */
export const VERDICT_INPUT_KEYS = Object.freeze(["prereg", "frozen", "runs"]);

/** 运行记录键（封闭枚举）。 */
export const VERDICT_RUN_KEYS = Object.freeze([
  "runId", "taskId", "arm", "at", "startedAt", "endedAt", "outcome", "failureReason", "acceptance", "sessions"
]);

/** 逐条判据结论键（封闭枚举）。 */
export const RUN_ACCEPTANCE_KEYS = Object.freeze(["probe", "args", "ok", "reason"]);

/** 台账 judgement 事实的 intent（记录面的稳定锚）。 */
export const VERDICT_JUDGEMENT_INTENT = "amplification-experiment-verdict";

/** 增量包文件绑定键（封闭枚举）。 */
export const EVIDENCE_BINDING_KEYS = Object.freeze(["path", "sha256", "bytes"]);

const ACCEPTANCE_ARM_LABEL = Object.freeze({ bare: "裸对照", org: "组织内" });

/**
 * 成本口径只看运行记录的**时点四件**：成本模块的输入键是封闭的（币值字段进不来），
 * 判定面的运行记录另带判据结论与会话日志——投影后再喂给成本面，两个面的形状各自封闭。
 */
function costOfRun(run) {
  if (!isPlainObject(run) || !Array.isArray(run.sessions)) {
    return { ok: false, cost: null, violations: ["运行记录缺会话日志（成本无样本）"] };
  }
  return aggregateRunCost({
    run: { runId: run.runId, taskId: run.taskId, arm: run.arm, startedAt: run.startedAt, endedAt: run.endedAt },
    sessions: run.sessions
  });
}

const emptyJudgement = (reasons) => ({
  ok: false,
  passed: false,
  reasons,
  preregDigest: null,
  thresholds: null,
  admission: { admitted: [], excluded: [], mechanismsLost: [] },
  perTask: []
});

/** 运行记录校验（结构断裂即拒；判据与成本由后续腿各自把守）。 */
function runRecordVerdict(run, index, tasks, violations) {
  const label = `运行记录第 ${String(index)} 条`;
  if (!isPlainObject(run)) {
    violations.push(`${label}须为对象`);
    return null;
  }
  for (const key of Object.keys(run)) {
    if (!VERDICT_RUN_KEYS.includes(key)) violations.push(`${label}含未定义键 ${key}（封闭键集：${VERDICT_RUN_KEYS.join("、")}）`);
  }
  if (!["bare", "org"].includes(run.arm)) violations.push(`${label}的 arm 须为 bare 或 org（当前 ${String(run.arm)}）`);
  if (!tasks.some((task) => task?.taskId === run.taskId)) violations.push(`${label}的 taskId ${String(run.taskId)} 不在预登记基准集内`);
  if (typeof run.at !== "string" || Number.isNaN(Date.parse(run.at))) violations.push(`${label}缺可解析的完成时点 at`);
  if (run.outcome !== "passed" && run.outcome !== "failed") violations.push(`${label}的 outcome 须为 passed 或 failed（当前 ${String(run.outcome)}）`);
  if (run.outcome === "failed" && (typeof run.failureReason !== "string" || run.failureReason.trim() === "")) {
    violations.push(`${label}判不过须记原因（${run.arm === "bare" ? "裸对照失败原因" : "未通过原因"}）`);
  }
  if (!Array.isArray(run.acceptance) || run.acceptance.length === 0) {
    violations.push(`${label}缺判据逐条结论（acceptance）`);
  } else {
    run.acceptance.forEach((entry, at) => {
      if (!isPlainObject(entry)) {
        violations.push(`${label}的 acceptance[${String(at)}] 须为对象`);
        return;
      }
      for (const key of Object.keys(entry)) {
        if (!RUN_ACCEPTANCE_KEYS.includes(key)) violations.push(`${label}的 acceptance[${String(at)}] 含未定义键 ${key}`);
      }
      if (typeof entry.ok !== "boolean") violations.push(`${label}的 acceptance[${String(at)}] 缺 ok 结论`);
    });
  }
  if (!Array.isArray(run.sessions) || run.sessions.length === 0) {
    violations.push(`${label}缺会话日志（成本采集无样本即无结论）`);
  }
  return run;
}

/** 判据身份：运行记录逐条判据须与简报 acceptance 逐字一致（`V-B3`＋「事后不得新增判据」）。 */
function criteriaDrift(run, brief) {
  const shapeOf = (list) => canonicalJson(list.map((entry) => ({ probe: entry.probe, args: entry.args })));
  try {
    return shapeOf(run.acceptance) === shapeOf(Array.isArray(brief?.acceptance) ? brief.acceptance : []);
  } catch {
    return false;
  }
}

/**
 * 结论判定。输入：`{prereg, frozen, runs}`（键封闭）。`frozen` 为冻结件
 * （`{digest}`）或摘要串；`runs` 为两臂运行记录数组。
 */
export function judgeExperiment(input = {}) {
  if (!isPlainObject(input)) return emptyJudgement(["判定输入须为对象（fail closed）"]);
  const unknown = Object.keys(input).filter((key) => !VERDICT_INPUT_KEYS.includes(key));
  if (unknown.length > 0) {
    return emptyJudgement(unknown.map((key) => `判定输入含未定义键 ${key}——判定面输入键封闭（${VERDICT_INPUT_KEYS.join("／")}）；机制归因（V-B5）只作诊断、不进通过与否的判定`));
  }
  const { prereg, frozen, runs } = input;
  const digest = typeof frozen === "string" ? frozen : frozen?.digest;
  const reasons = [];

  const structural = validatePreregistration(prereg);
  if (!structural.ok) {
    return emptyJudgement([...structural.violations, ...structural.gaps].map((line) => `预登记件不合法：${line}`));
  }
  const unchanged = preregistrationUnchanged(prereg, digest);
  if (!unchanged.ok) return emptyJudgement([`${unchanged.code}：${unchanged.reason}`]);
  if (!Array.isArray(runs)) return emptyJudgement(["runs 须为运行记录数组（两臂跑分）"]);

  const tasks = prereg.tasks;
  const validated = [];
  runs.forEach((run, index) => {
    const verdict = runRecordVerdict(run, index, tasks, reasons);
    if (verdict !== null) validated.push(verdict);
  });
  if (reasons.length > 0) return emptyJudgement(reasons);

  const bareRuns = validated.filter((run) => run.arm === "bare");
  const orgRuns = validated.filter((run) => run.arm === "org");
  const admission = admitBareSet({
    prereg,
    bareRuns: bareRuns.map((run) => ({ taskId: run.taskId, arm: run.arm, at: run.at, outcome: run.outcome, failureReason: run.failureReason }))
  });
  if (!admission.ok) return emptyJudgement(admission.violations);

  const budgetTokens = prereg.thresholds.budgetB * prereg.thresholds.magnitudeMultiple;
  const perTask = [];
  for (const task of tasks) {
    if (!admission.admitted.includes(task.taskId)) continue;
    const itemReasons = [];
    const bare = bareRuns.find((run) => run.taskId === task.taskId);
    const org = orgRuns.find((run) => run.taskId === task.taskId);
    if (org === undefined) {
      itemReasons.push(`任务 ${task.taskId} 无组织内跑分记录（V-B3：判据沿用该任务简报的 acceptance，须实跑）`);
    } else {
      if (Date.parse(org.at) <= Date.parse(bare.at)) {
        itemReasons.push(`任务 ${task.taskId} 的组织内跑不晚于裸对照完成时点——基准集须裸对照先跑（V-B1）`);
      }
      if (!criteriaDrift(org, task.brief)) {
        itemReasons.push(`任务 ${task.taskId} 的组织内跑判据与简报 acceptance 不一致（V-B3：判据沿用简报预登记件，事后不得新增或替换判据）`);
      }
      if (org.outcome !== "passed" || org.acceptance.some((entry) => entry.ok !== true)) {
        itemReasons.push(`任务 ${task.taskId} 的组织内跑判据未通过：${org.failureReason ?? org.acceptance.find((entry) => entry.ok !== true)?.reason ?? "无原因"}`);
      }
    }
    const bareCost = costOfRun(bare);
    const orgCost = org === undefined ? { ok: false, cost: null, violations: [] } : costOfRun(org);
    if (!bareCost.ok) itemReasons.push(...bareCost.violations.map((line) => `任务 ${task.taskId} 裸对照成本不可采：${line}`));
    if (org !== undefined && !orgCost.ok) itemReasons.push(...orgCost.violations.map((line) => `任务 ${task.taskId} 组织内跑成本不可采：${line}`));
    if (orgCost.ok && orgCost.cost.totalTokens > budgetTokens) {
      itemReasons.push(`任务 ${task.taskId} 组织内跑超预算量级：${String(orgCost.cost.totalTokens)} token ＞ 预算 B ${String(prereg.thresholds.budgetB)} × 量级倍数 ${String(prereg.thresholds.magnitudeMultiple)}＝${String(budgetTokens)}`);
    }
    const costUnavailable = !bareCost.ok || (org !== undefined && !orgCost.ok);
    perTask.push({
      taskId: task.taskId,
      mechanism: task.mechanism,
      bareCost: bareCost.ok ? bareCost.cost : null,
      orgCost: orgCost.ok ? orgCost.cost : null,
      budgetTokens,
      conclusion: costUnavailable || itemReasons.length > 0 ? "fail" : "pass",
      reasons: itemReasons
    });
  }

  // 结构断裂（记录不成立）与门槛不过（结论为「不过」）分列：前者无结论可出，
  // 后者是有结论的负结论——「先跑」属方法论前置，倒挂即记录不成立。
  const STRUCTURAL_HINTS = ["成本不可采", "无组织内跑分记录", "不一致", "先跑"];
  const structuralReasons = perTask
    .filter((entry) => entry.conclusion === "fail" && entry.reasons.some((line) => STRUCTURAL_HINTS.some((hint) => line.includes(hint))))
    .flatMap((entry) => entry.reasons);
  if (structuralReasons.length > 0) {
    return {
      ...emptyJudgement(structuralReasons),
      preregDigest: unchanged.digest,
      thresholds: { ...prereg.thresholds },
      admission: { admitted: admission.admitted, excluded: admission.excluded, mechanismsLost: admission.mechanismsLost },
      perTask
    };
  }

  const failureReasons = perTask.flatMap((entry) => entry.reasons);
  return {
    ok: true,
    passed: failureReasons.length === 0,
    reasons: [],
    preregDigest: unchanged.digest,
    thresholds: { ...prereg.thresholds },
    admission: { admitted: admission.admitted, excluded: admission.excluded, mechanismsLost: admission.mechanismsLost },
    perTask
  };
}

/**
 * 记录面封件（`V-B6`）：合法判定（`ok: true`）才可入账。返回三件——
 * 台账 `judgement` 事实负载、CHANGELOG 四要件摘要、增量包文件绑定。
 * **两态都记**（通过与否都留痕）；判定未成立（`ok: false`）不得入账（fail closed）。
 */
export function experimentRecords(input = {}) {
  const violations = [];
  if (!isPlainObject(input)) return { ok: false, ledger: null, changelog: null, evidence: null, violations: ["记录面输入须为对象（fail closed）"] };
  const { prereg, frozen, verdict, artifacts = [] } = input;
  if (!isPlainObject(verdict) || verdict.ok !== true || typeof verdict.passed !== "boolean") {
    return { ok: false, ledger: null, changelog: null, evidence: null, violations: ["判定未成立（ok:false）或形状不符——无结论可入账（fail closed）"] };
  }
  if (!isPlainObject(prereg) || typeof prereg.experimentId !== "string" || typeof prereg.experimentId !== "string") {
    violations.push("预登记件缺 experimentId（记录面的回读锚）");
  }
  if (!Array.isArray(artifacts)) {
    violations.push("artifacts 须为增量包文件绑定数组");
  } else {
    artifacts.forEach((entry, index) => {
      const label = `增量包绑定第 ${String(index)} 条`;
      if (!isPlainObject(entry)) {
        violations.push(`${label}须为对象`);
        return;
      }
      for (const key of Object.keys(entry)) {
        if (!EVIDENCE_BINDING_KEYS.includes(key)) violations.push(`${label}含未定义键 ${key}（封闭键集：${EVIDENCE_BINDING_KEYS.join("、")}）`);
      }
      if (typeof entry.path !== "string" || entry.path === "") violations.push(`${label}缺 path`);
      if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) violations.push(`${label}的 sha256 须为 64 位十六进制（当前 ${String(entry.sha256)}）`);
      if (!Number.isInteger(entry.bytes) || entry.bytes < 0) violations.push(`${label}的 bytes 须为非负整数`);
    });
  }
  if (violations.length > 0) return { ok: false, ledger: null, changelog: null, evidence: null, violations };

  const digest = verdict.preregDigest ?? (typeof frozen === "string" ? frozen : frozen?.digest) ?? null;
  const passed = verdict.passed;
  const perTask = Array.isArray(verdict.perTask) ? verdict.perTask : [];
  const ledger = {
    op: "task.judge",
    eventType: "judgement",
    payload: {
      intent: VERDICT_JUDGEMENT_INTENT,
      input: {
        experimentId: prereg.experimentId,
        preregDigest: digest,
        passed,
        thresholds: verdict.thresholds ?? null,
        admitted: verdict.admission?.admitted ?? [],
        excluded: verdict.admission?.excluded ?? [],
        mechanismsLost: verdict.admission?.mechanismsLost ?? [],
        tasks: perTask.map((entry) => ({ taskId: entry.taskId, mechanism: entry.mechanism, conclusion: entry.conclusion }))
      }
    }
  };
  const passedCount = perTask.filter((entry) => entry.conclusion === "pass").length;
  const changelog = {
    scope: `org-v2 17 号票能力放大验收实验（B 组 V-B1–V-B6；预登记件 ${String(prereg.experimentId)}）`,
    change: passed
      ? `实验通过：入集 ${String(perTask.length)} 件任务全部在预登记门槛内由组织形式完成（裸对照均先跑且未通过）`
      : `实验不通过：入集 ${String(perTask.length)} 件任务中 ${String(perTask.length - passedCount)} 件未过预登记门槛（结论按门槛判，不做事后判据调整）`,
    verification: `冻结摘要 ${String(digest).slice(0, 12)}…；入集任务 ${String(perTask.length)} 件（通过 ${String(passedCount)} 件）；机制归因清单只作诊断、不进判定`,
    authorization: "用户预登记并冻结的任务集／对照口径／数值门槛／成本口径；本记录只落结论事实"
  };
  return { ok: true, ledger, changelog, evidence: { packageInputs: artifacts }, violations: [] };
}
