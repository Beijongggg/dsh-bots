/**
 * 放大验收实验（17 号票）预登记件与运行记录的测试共用夹具。
 *
 * 单一事实源：各用例在 `preregFixture()` 之上做单点破坏。夹具里的 op 名与工具名
 * 是**手工抄的仓内真实词**（不是从被测模块 import 的）——这样「裸侧持组织命令
 * op 即拒」等用例才有红的意义；被测模块的组织命令词表另由
 * `tests/org-experiment-prereg.test.mjs` 与 `lib/org/op-set.js` 单源对账锁定。
 */
/** 一条真能表达为探针白名单命令的验收判据（坐标＝任务自己的交付物）。 */
function executableAcceptance(location, text) {
  return [{ probe: "fs.contains", args: { location, text } }];
}

/** 四要素简报＋可执行验收判据（坐标即该任务交付物，符合「任务自己产出的坐标」）。 */
export function briefFor(goal, location) {
  return {
    goal,
    deliverables: [{ format: "markdown", location }],
    sources: [{ tool: "issue", ref: "org-v2-build/17" }],
    boundaries: "不改真实运行面；不新增事后判据",
    acceptance: executableAcceptance(location, goal),
    reviewPoints: []
  };
}

/** 基准集三任务：三机制各取一（`V-B1`）。 */
export const ABLATION_TASKS = Object.freeze([
  Object.freeze({ taskId: "TK-17a00001", mechanism: "multi-hop-research", brief: briefFor("多跳研究报告", "bots/knowledge/reports/R-2026-101.md") }),
  Object.freeze({ taskId: "TK-17a00002", mechanism: "cross-file-change", brief: briefFor("跨文件改动", "bots/knowledge/reports/R-2026-102.md") }),
  Object.freeze({ taskId: "TK-17a00003", mechanism: "long-running-duty", brief: briefFor("长周期值守例程", "bots/knowledge/reports/R-2026-103.md") })
]);

/** 基础工具面（裸侧与组织侧相同——「按命令面切，不是去掉文件与执行工具」）。 */
export const BASE_TOOLS = Object.freeze(["fs.read", "fs.write", "exec", "mail.send"]);

/** 组织命令 op（仓内真实词；裸侧一条都不许持）。 */
export const ORG_OPS = Object.freeze([
  "task.intake", "task.triage", "task.plan", "task.assign", "task.accept",
  "task.report", "task.close", "task.judge", "review.request"
]);

/** 合法基线预登记件（数值门槛已由用户预登记——用例在此之上做单点破坏）。 */
export function preregFixture(overrides = {}) {
  const base = {
    schemaVersion: "org-v2/amplification-prereg@1",
    experimentId: "org-v2-amplification-20260929",
    tasks: ABLATION_TASKS.map((task) => ({ ...task, brief: structuredClone(task.brief) })),
    profiles: {
      bare: { model: "niko/gpt-5.6-sol", baseTools: [...BASE_TOOLS], ops: [], scaffolding: [], budgetB: 400000 },
      org: { model: "niko/gpt-5.6-sol", baseTools: [...BASE_TOOLS], ops: [...ORG_OPS], scaffolding: ["task-ledger", "review-kit"], budgetB: 400000 }
    },
    thresholds: {
      budgetB: 400000,
      magnitudeMultiple: 4,
      redispatchCap: 3,
      reviewRoundsToEscalate: 2,
      unauthorizedAttempts: 3
    },
    costMetrics: {
      tokens: ["uncachedInputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"],
      wallClock: "wallClockMs",
      rounds: "rounds",
      currency: null
    }
  };
  return { ...base, ...overrides };
}

/** 裸对照跑分记录（`V-B1` 入集判定输入；组织内跑的另一条腿在执行面）。 */
export function bareRun(taskId, outcome = "failed", overrides = {}) {
  return {
    taskId,
    arm: "bare",
    at: "2026-09-30T02:00:00.000Z",
    outcome,
    ...(outcome === "failed" ? { failureReason: "裸实例超预算未产出合格判据" } : {}),
    ...overrides
  };
}

/** 一条会话日志：恰一组 usage 样本（token 总量按分量给；官方会话日志形状）。 */
export function sessionOf(tokens = {}) {
  const { input = 0, output = 0, cacheRead = 0, cacheWrite = 0 } = tokens;
  return {
    sessionId: "s-1",
    events: [
      {
        type: "assistant/chunk",
        time: 1000,
        data: { turn: 1, step: 1, chunk: { type: "usage", usage: { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite } } }
      },
      { type: "step/end", time: 2000, data: { turn: 1, step: 1 } }
    ]
  };
}

/**
 * 运行记录：判据逐条沿用简报登记件（`V-B3`）；`acceptance` 可整体替换做负例。
 * 两臂共用同一形状，`failureReason` 在判不过时必填（记录面 fail closed）。
 */
export function runRecord(taskId, arm, { at, outcome = "passed", acceptance, tokens = { input: 100 }, failureReason } = {}) {
  const task = ABLATION_TASKS.find((entry) => entry.taskId === taskId);
  return {
    runId: `run-${arm}-${taskId}`,
    taskId,
    arm,
    at,
    startedAt: "2026-09-30T02:00:00.000Z",
    endedAt: "2026-09-30T02:05:00.000Z",
    outcome,
    ...(failureReason === undefined ? {} : { failureReason }),
    acceptance: acceptance ?? task.brief.acceptance.map((entry) => ({ ...entry, ok: outcome === "passed", reason: outcome === "passed" ? null : "未产出合格件" })),
    sessions: [sessionOf(tokens)]
  };
}

/** 三任务两臂的合法跑分：裸对照先跑且失败入集，组织内在预算内通过。 */
export function greenRuns() {
  const bare = ABLATION_TASKS.map((task) => runRecord(task.taskId, "bare", {
    at: "2026-09-30T03:00:00.000Z",
    outcome: "failed",
    failureReason: "裸实例超预算未产出合格判据"
  }));
  const org = ABLATION_TASKS.map((task) => runRecord(task.taskId, "org", { at: "2026-09-30T04:00:00.000Z" }));
  return [...bare, ...org];
}
