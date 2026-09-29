/**
 * 放大验收实验的结论判定与记录面（org-v2 17 号票；规格 §J 与附录 A `V-B3`／
 * `V-B5`／`V-B6`）。
 *
 * 判定按**预登记门槛**（用户域数值，本模块只应用不发明），两态 fail closed：
 *   - 前置＝预登记件合法且**跑完未改**（摘要复验）、**冻结在实验之前**
 *     （冻结时点早于两臂每一条跑分的完成时点——「实验前必须由用户预登记并随即
 *     冻结」的机械面）、裸对照先跑且失败方入集、每任务每臂跑分唯一；
 *   - 每件入集任务：组织内跑判据须与**该任务简报的 acceptance** 逐字一致
 *     （`V-B3`：不得事后新增判据）、组织内跑在 `预算 B × 量级倍数` 内通过；
 *   - 理由分**结构断裂**（记录不成立，无结论可出＝`ok: false`）与**门槛不过**
 *     （有结论的负结论＝`passed: false`）两类，各带封闭的 `reasonCodes`——
 *     不靠对中文措辞做子串匹配来分类。
 *
 * **机制归因不进判定**（`V-B5`）：判定面输入键封闭为 `prereg／frozen／runs`——
 * 归因数据没有入口，不是靠调用纪律（负例见测试）。
 *
 * 记录面（`V-B6`）：`experimentRecords` 把结论封成台账命令（`task.judge` 的
 * `judgement` 事实：`taskId／actor／idempotencyKey`＋`intent／input`，**不扩事件
 * 词表**）、CHANGELOG 四要件摘要（范围／变化／验证／授权依据）与增量包文件绑定。
 * 本模块不写盘：落账由既有台账命令面执行，目标任务由调用方点名（记录须挂在真
 * 任务上，否则台账拒收）。
 */
import { canonicalJson } from "./store-base.js";
import { isPlainObject } from "./capability-base.js";
import { isTaskId, isValidActor } from "./ledger-events.js";
import {
  admitBareSet, preregistrationUnchanged, validateFrozenRecord, validatePreregistration
} from "./experiment-prereg.js";
import { aggregateRunCost } from "./experiment-cost.js";
import { isNonEmptyText } from "./experiment-shape.js";

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

/**
 * 理由码封闭枚举。结构断裂（`structural: true`）＝记录不成立、无结论可出；
 * 其余＝有结论的负结论（该任务没过门槛）。**分类靠码，不靠措辞。**
 */
export const VERDICT_REASONS = Object.freeze([
  Object.freeze({ code: "freeze-record-invalid", structural: true, label: "冻结记录不成立" }),
  Object.freeze({ code: "freeze-after-run", structural: true, label: "冻结晚于跑分（实验前冻结失守）" }),
  Object.freeze({ code: "duplicate-run", structural: true, label: "同一任务同一臂有多条跑分" }),
  Object.freeze({ code: "org-run-missing", structural: true, label: "缺组织内跑分记录" }),
  Object.freeze({ code: "run-order", structural: true, label: "组织内跑不晚于裸对照（裸对照先跑失守）" }),
  Object.freeze({ code: "criteria-drift", structural: true, label: "组织内跑判据与简报 acceptance 不一致" }),
  Object.freeze({ code: "cost-unavailable", structural: true, label: "成本不可采" }),
  Object.freeze({ code: "acceptance-failed", structural: false, label: "组织内跑判据未通过" }),
  Object.freeze({ code: "budget-exceeded", structural: false, label: "组织内跑超预算量级" })
]);

/** 码 → 结构断裂判定（单一源：上面那张表的派生）。 */
const STRUCTURAL_CODES = new Set(VERDICT_REASONS.filter((entry) => entry.structural).map((entry) => entry.code));

const reason = (code, message) => ({ code, message });

const emptyJudgement = (reasons) => ({
  ok: false,
  passed: false,
  reasons,
  preregDigest: null,
  thresholds: null,
  admission: { admitted: [], excluded: [], mechanismsLost: [] },
  perTask: []
});

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
  if (run.outcome === "failed" && !isNonEmptyText(run.failureReason)) {
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
function criteriaMatch(run, brief) {
  const shapeOf = (list) => canonicalJson(list.map((entry) => ({ probe: entry.probe, args: entry.args })));
  try {
    return shapeOf(run.acceptance) === shapeOf(Array.isArray(brief?.acceptance) ? brief.acceptance : []);
  } catch {
    return false;
  }
}

/**
 * 结论判定。输入：`{prereg, frozen, runs}`（键封闭）。`frozen` 为冻结记录
 * （`{digest, frozenAt, experimentId?}`，即 `freezePreregistration` 的产物或
 * `freeze --out` 落下的件）；`runs` 为两臂运行记录数组。
 */
export function judgeExperiment(input = {}) {
  if (!isPlainObject(input)) return emptyJudgement(["判定输入须为对象（fail closed）"]);
  const unknown = Object.keys(input).filter((key) => !VERDICT_INPUT_KEYS.includes(key));
  if (unknown.length > 0) {
    return emptyJudgement(unknown.map((key) => `判定输入含未定义键 ${key}——判定面输入键封闭（${VERDICT_INPUT_KEYS.join("／")}）；机制归因（V-B5）只作诊断、不进通过与否的判定`));
  }
  const { prereg, frozen, runs } = input;

  const structural = validatePreregistration(prereg);
  if (!structural.ok) {
    return emptyJudgement([...structural.violations, ...structural.gaps].map((line) => `预登记件不合法：${line}`));
  }
  const frozenRecord = validateFrozenRecord(frozen, prereg);
  if (!frozenRecord.ok) {
    return emptyJudgement(frozenRecord.violations.map((line) => `冻结记录不成立（${VERDICT_REASONS.find((entry) => entry.code === "freeze-record-invalid").code}）：${line}`));
  }
  const unchanged = preregistrationUnchanged(prereg, frozenRecord.digest);
  if (!unchanged.ok) return emptyJudgement([`${unchanged.code}：${unchanged.reason}`]);
  if (!Array.isArray(runs)) return emptyJudgement(["runs 须为运行记录数组（两臂跑分）"]);

  const tasks = prereg.tasks;
  const violations = [];
  const validated = [];
  runs.forEach((run, index) => {
    const verdict = runRecordVerdict(run, index, tasks, violations);
    if (verdict !== null) validated.push(verdict);
  });
  if (violations.length > 0) return emptyJudgement(violations);

  // 每任务每臂**至多一条**跑分：多条即口径不唯一，结论不得被调用方排序左右
  const seen = new Map();
  for (const run of validated) {
    const key = `${run.taskId}\u0000${run.arm}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) {
      violations.push(`任务 ${run.taskId} 的 ${run.arm} 臂有多条跑分记录——同一任务同一臂须唯一（否则结论可被记录顺序左右）`);
    }
  }
  if (violations.length > 0) return emptyJudgement(violations);

  // 实验前冻结：每一条跑分（两臂）都须晚于冻结时点
  const frozenAt = Date.parse(frozenRecord.frozenAt);
  for (const run of validated) {
    if (Date.parse(run.at) <= frozenAt) {
      violations.push(`任务 ${run.taskId} 的 ${run.arm} 臂跑分完成于冻结时点（${frozenRecord.frozenAt}）之前或同一刻——「实验前必须由用户预登记并随即冻结」失守（freeze-after-run）`);
    }
  }
  if (violations.length > 0) return emptyJudgement(violations);

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
    const bare = bareRuns.find((run) => run.taskId === task.taskId);
    const org = orgRuns.find((run) => run.taskId === task.taskId);
    const reasons = [];
    if (org === undefined) {
      reasons.push(reason("org-run-missing", `任务 ${task.taskId} 无组织内跑分记录（V-B3：判据沿用该任务简报的 acceptance，须实跑）`));
    } else {
      if (Date.parse(org.at) <= Date.parse(bare.at)) {
        reasons.push(reason("run-order", `任务 ${task.taskId} 的组织内跑不晚于裸对照完成时点——基准集须裸对照先跑（V-B1）`));
      }
      if (!criteriaMatch(org, task.brief)) {
        reasons.push(reason("criteria-drift", `任务 ${task.taskId} 的组织内跑判据与简报 acceptance 不一致（V-B3：判据沿用简报预登记件，事后不得新增或替换判据）`));
      }
      if (org.outcome !== "passed" || org.acceptance.some((entry) => entry.ok !== true)) {
        reasons.push(reason("acceptance-failed", `任务 ${task.taskId} 的组织内跑判据未通过：${org.failureReason ?? org.acceptance.find((entry) => entry.ok !== true)?.reason ?? "无原因"}`));
      }
    }
    const bareCost = costOfRun(bare);
    const orgCost = org === undefined ? { ok: false, cost: null, violations: [] } : costOfRun(org);
    if (!bareCost.ok) reasons.push(reason("cost-unavailable", `任务 ${task.taskId} 裸对照成本不可采：${bareCost.violations.join("；")}`));
    if (org !== undefined && !orgCost.ok) reasons.push(reason("cost-unavailable", `任务 ${task.taskId} 组织内跑成本不可采：${orgCost.violations.join("；")}`));
    if (orgCost.ok && orgCost.cost.totalTokens > budgetTokens) {
      reasons.push(reason("budget-exceeded", `任务 ${task.taskId} 组织内跑超预算量级：${String(orgCost.cost.totalTokens)} token ＞ 预算 B ${String(prereg.thresholds.budgetB)} × 量级倍数 ${String(prereg.thresholds.magnitudeMultiple)}＝${String(budgetTokens)}`));
    }
    perTask.push({
      taskId: task.taskId,
      mechanism: task.mechanism,
      bareCost: bareCost.ok ? bareCost.cost : null,
      orgCost: orgCost.ok ? orgCost.cost : null,
      budgetTokens,
      conclusion: reasons.length > 0 ? "fail" : "pass",
      reasons: reasons.map((entry) => entry.message),
      reasonCodes: reasons.map((entry) => entry.code)
    });
  }

  const admissionSummary = { admitted: admission.admitted, excluded: admission.excluded, mechanismsLost: admission.mechanismsLost };
  const structuralReasons = perTask
    .filter((entry) => entry.conclusion === "fail" && entry.reasonCodes.some((code) => STRUCTURAL_CODES.has(code)))
    .flatMap((entry) => entry.reasons);
  if (structuralReasons.length > 0) {
    return {
      ...emptyJudgement(structuralReasons),
      preregDigest: unchanged.digest,
      frozenAt: frozenRecord.frozenAt,
      thresholds: { ...prereg.thresholds },
      admission: admissionSummary,
      perTask
    };
  }

  const failureReasons = perTask.flatMap((entry) => entry.reasons);
  return {
    ok: true,
    passed: failureReasons.length === 0,
    reasons: [],
    preregDigest: unchanged.digest,
    frozenAt: frozenRecord.frozenAt,
    thresholds: { ...prereg.thresholds },
    admission: admissionSummary,
    perTask
  };
}

/**
 * 记录面封件（`V-B6`）：合法判定（`ok: true`）才可入账。返回四件——台账命令
 * （`task.judge` 的 `judgement` 事实，含目标任务／actor／幂等键）、CHANGELOG 四要件
 * 摘要、增量包文件绑定与违例清单。**两态都记**（通过与否都留痕）；判定未成立
 * （`ok: false`）不得入账（fail closed）。目标任务须为台账任务号、actor 须合法
 * ——「通过记录进台账」必须挂得回一张真任务，不落无名事实。
 */
export function experimentRecords(input = {}) {
  const violations = [];
  if (!isPlainObject(input)) return { ok: false, ledger: null, changelog: null, evidence: null, violations: ["记录面输入须为对象（fail closed）"] };
  const { prereg, frozen, verdict, artifacts = [], taskId, actor, idempotencyKey } = input;
  if (!isPlainObject(verdict) || verdict.ok !== true || typeof verdict.passed !== "boolean") {
    return { ok: false, ledger: null, changelog: null, evidence: null, violations: ["判定未成立（ok:false）或形状不符——无结论可入账（fail closed）"] };
  }
  if (!isPlainObject(prereg) || !isNonEmptyText(prereg.experimentId)) {
    violations.push("预登记件缺 experimentId（记录面的回读锚）");
  }
  if (!isTaskId(taskId)) {
    violations.push(`台账目标任务号非法：${String(taskId)}（记录须挂得回一张真任务，TK- 前缀）`);
  }
  if (!isValidActor(actor)) {
    violations.push(`台账 actor 形状非法：${JSON.stringify(actor ?? null)}（须为 {kind: host|user|post, id}）`);
  }
  if (!isNonEmptyText(idempotencyKey)) {
    violations.push("缺 idempotencyKey（同源结论重复登记只留一条）");
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
      if (!isNonEmptyText(entry.path)) violations.push(`${label}缺 path`);
      if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) violations.push(`${label}的 sha256 须为 64 位十六进制（当前 ${String(entry.sha256)}）`);
      if (!Number.isInteger(entry.bytes) || entry.bytes < 0) violations.push(`${label}的 bytes 须为非负整数`);
    });
  }
  if (violations.length > 0) return { ok: false, ledger: null, changelog: null, evidence: null, violations };

  const digest = verdict.preregDigest ?? (isPlainObject(frozen) ? frozen.digest : frozen) ?? null;
  const passed = verdict.passed;
  const perTask = Array.isArray(verdict.perTask) ? verdict.perTask : [];
  const ledger = {
    op: "task.judge",
    taskId,
    actor,
    idempotencyKey,
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
        tasks: perTask.map((entry) => ({ taskId: entry.taskId, mechanism: entry.mechanism, conclusion: entry.conclusion }))
      }
    }
  };
  const passedCount = perTask.filter((entry) => entry.conclusion === "pass").length;
  const lost = verdict.admission?.mechanismsLost ?? [];
  const changelog = {
    scope: `org-v2 17 号票能力放大验收实验（B 组 V-B1–V-B6；预登记件 ${String(prereg.experimentId)}）`,
    change: passed
      ? `实验通过：入集 ${String(perTask.length)} 件任务全部在预登记门槛内由组织形式完成（裸对照均先跑且未通过）`
      : `实验不通过：入集 ${String(perTask.length)} 件任务中 ${String(perTask.length - passedCount)} 件未过预登记门槛（结论按门槛判，不做事后判据调整）`,
    verification: `冻结摘要与冻结时点 ${String(digest).slice(0, 12)}…／${String(verdict.frozenAt ?? "未记")}；入集任务 ${String(perTask.length)} 件（通过 ${String(passedCount)} 件）${lost.length > 0 ? `；出集带走的机制：${lost.join("、")}` : ""}；机制归因清单只作诊断、不进判定`,
    authorization: "用户预登记并冻结的任务集／对照口径／数值门槛／成本口径；本记录只落结论事实"
  };
  return { ok: true, ledger, changelog, evidence: { packageInputs: artifacts }, violations: [] };
}
