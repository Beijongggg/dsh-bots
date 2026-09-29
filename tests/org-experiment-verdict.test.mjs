/**
 * 放大验收实验的结论判定回归（org-v2 17 号票；规格 §J 与附录 A `V-B2`／`V-B3`／
 * `V-B5`／`V-B6`）。
 *
 * 判据落点：
 *   - 结论按**预登记门槛**判（两态、fail closed）：预登记件未改、门槛已登记、
 *     组织内跑判据**沿用该任务简报的 acceptance**（事后不得新增判据）、裸对照先跑
 *     且失败方才入集、组织内跑在预算同量级内完成；
 *   - `V-B5` 机制归因**不进通过与否的判定**：判定面输入键封闭，归因进不来；
 *   - `V-B6` 记录面：台账 `judgement` 事实负载（不扩事件词表）＋CHANGELOG 四要件
 *     摘要＋增量包文件绑定。
 *
 * 只测外部行为：`judgeExperiment`／`experimentRecords` 的结论与点名；不读盘、
 * 不触真实运行面、不发明门槛数值（数值由用例给）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { freezePreregistration } from "../lib/org/experiment-prereg.js";
import { experimentRecords, judgeExperiment } from "../lib/org/experiment-verdict.js";
import { ABLATION_TASKS, bareRun, preregFixture } from "./helpers/prereg-fixture.mjs";

const names = (lines, needle) => lines.some((line) => line.includes(needle));

/** 一条会话日志：恰一组 usage 样本（token 总量按分量给）。 */
function sessionOf(tokens = {}) {
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

/** 运行记录：判据逐条沿用简报登记件（`V-B3`），可整体改判据做负例。 */
function runRecord(taskId, arm, { at, outcome = "passed", acceptance, tokens = { input: 100 }, failureReason } = {}) {
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
function greenRuns() {
  const bare = ABLATION_TASKS.map((task) => runRecord(task.taskId, "bare", {
    at: "2026-09-30T03:00:00.000Z",
    outcome: "failed",
    failureReason: "裸实例超预算未产出合格判据"
  }));
  const org = ABLATION_TASKS.map((task) => runRecord(task.taskId, "org", { at: "2026-09-30T04:00:00.000Z" }));
  return [...bare, ...org];
}

function frozenFixture() {
  const prereg = preregFixture();
  return { prereg, frozen: freezePreregistration(prereg) };
}

test("全绿：门槛已登记、预登记未改、裸先跑失败入集、组织内在预算内通过即判过（V-B6）", () => {
  const { prereg, frozen } = frozenFixture();
  const verdict = judgeExperiment({ prereg, frozen, runs: greenRuns() });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.passed, true);
  assert.deepEqual(verdict.reasons, []);
  assert.equal(verdict.preregDigest, frozen.digest);
  assert.deepEqual(verdict.thresholds, { budgetB: 400000, magnitudeMultiple: 4 });
  assert.deepEqual(verdict.admission.admitted, ABLATION_TASKS.map((task) => task.taskId));
  assert.deepEqual(verdict.admission.excluded, []);
  const first = verdict.perTask[0];
  assert.equal(first.taskId, ABLATION_TASKS[0].taskId);
  assert.equal(first.conclusion, "pass");
  assert.equal(first.orgCost.totalTokens, 100);
  assert.equal(first.bareCost.totalTokens, 100);
});

test("预登记已改即拒：冻结摘要与盘面不符时无结论可出（跑完不得改）", () => {
  const { frozen } = frozenFixture();
  const mutated = preregFixture({ thresholds: { budgetB: 800000, magnitudeMultiple: 4 } });
  const verdict = judgeExperiment({ prereg: mutated, frozen, runs: greenRuns() });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.passed, false);
  assert.ok(names(verdict.reasons, "prereg-mutated") || names(verdict.reasons, "已改"));
});

test("事后不得新增判据：组织内跑判据须与简报 acceptance 逐字一致（V-B3）", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (
    run.taskId === ABLATION_TASKS[0].taskId && run.arm === "org"
      ? { ...run, acceptance: [...run.acceptance, { probe: "fs.contains", args: { location: "bots/knowledge/reports/R-2026-101.md", text: "另加的判据" }, ok: true, reason: null }] }
      : run
  ));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.passed, false);
  assert.ok(names(verdict.reasons, "判据"));
  assert.ok(names(verdict.reasons, ABLATION_TASKS[0].taskId));
});

test("裸对照先跑：组织内跑早于裸对照跑分即拒（V-B1「先跑」）", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (
    run.arm === "org" ? { ...run, at: "2026-09-30T02:30:00.000Z" } : run
  ));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.ok(names(verdict.reasons, "先跑"));
});

test("门槛判定：组织内跑超预算量级即判不过（按预登记门槛，不按事后口径）", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (
    run.arm === "org" ? { ...run, sessions: [sessionOf({ input: 2_000_000 })] } : run
  ));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.passed, false);
  const entry = verdict.perTask[0];
  assert.equal(entry.conclusion, "fail");
  assert.ok(names(entry.reasons, "预算"));
  assert.equal(entry.budgetTokens, 1_600_000);
});

test("组织内跑判据未过即判不过：判据不过不得靠归因或说明翻案（V-B3）", () => {
  const { prereg, frozen } = frozenFixture();
  const task = ABLATION_TASKS[1];
  const runs = greenRuns().map((run) => (
    run.taskId === task.taskId && run.arm === "org"
      ? runRecord(task.taskId, "org", {
        at: "2026-09-30T04:00:00.000Z",
        outcome: "failed",
        failureReason: "组织内跑未过判据",
        acceptance: task.brief.acceptance.map((entry) => ({ ...entry, ok: false, reason: "坐标不存在" }))
      })
      : run
  ));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.passed, false);
  const entry = verdict.perTask.find((item) => item.taskId === task.taskId);
  assert.equal(entry.conclusion, "fail");
  assert.ok(names(entry.reasons, "判据") || names(entry.reasons, "未通过"));
});

test("机制归因不进判定：判定面输入键封闭，归因数据进不来（V-B5）", () => {
  const { prereg, frozen } = frozenFixture();
  const withAttribution = judgeExperiment({
    prereg, frozen, runs: greenRuns(),
    attribution: { tasks: [{ taskId: ABLATION_TASKS[0].taskId, appearances: ["decomposition"] }] }
  });
  assert.equal(withAttribution.ok, false);
  assert.ok(names(withAttribution.reasons, "attribution"));
  assert.equal(withAttribution.passed, false);
});

test("记录面：judgement 事实负载＋CHANGELOG 四要件＋增量包文件绑定（V-B6，不扩事件词表）", () => {
  const { prereg, frozen } = frozenFixture();
  const verdict = judgeExperiment({ prereg, frozen, runs: greenRuns() });
  const records = experimentRecords({
    prereg, frozen, verdict,
    artifacts: [{ path: "artifacts/runs/run-20260930/raw.json", sha256: "a".repeat(64), bytes: 1234 }]
  });
  assert.equal(records.ok, true);
  assert.equal(records.ledger.op, "task.judge");
  assert.equal(records.ledger.eventType, "judgement");
  assert.equal(records.ledger.payload.intent, "amplification-experiment-verdict");
  assert.equal(records.ledger.payload.input.preregDigest, frozen.digest);
  assert.equal(records.ledger.payload.input.passed, true);
  assert.deepEqual(Object.keys(records.changelog).sort(), ["authorization", "change", "scope", "verification"]);
  assert.ok(records.changelog.verification.includes(frozen.digest.slice(0, 12)));
  assert.deepEqual(records.evidence.packageInputs, [{ path: "artifacts/runs/run-20260930/raw.json", sha256: "a".repeat(64), bytes: 1234 }]);
  // 不做币值换算：记录面不出现币值字段（结论输出键封闭）
  const flat = JSON.stringify(records);
  for (const forbidden of ["currency", "usd", "cny", "price", "exchange"]) {
    assert.equal(flat.toLowerCase().includes(forbidden), false, `记录面不得含币值字段 ${forbidden}`);
  }
});

test("记录面：未过的实验一样留痕（两态都记），非法绑定即拒（fail closed）", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (run.arm === "org"
    ? { ...run, outcome: "failed", failureReason: "组织内跑判据未过", acceptance: run.acceptance.map((entry) => ({ ...entry, ok: false, reason: "未产出" })) }
    : run));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.passed, false);
  const records = experimentRecords({ prereg, frozen, verdict, artifacts: [] });
  assert.equal(records.ok, true);
  assert.equal(records.ledger.payload.input.passed, false);
  assert.ok(records.changelog.change.includes("不通过") || records.changelog.change.includes("未通过"));

  const badBinding = experimentRecords({ prereg, frozen, verdict, artifacts: [{ path: "x", sha256: "zz", bytes: 1 }] });
  assert.equal(badBinding.ok, false);
  assert.ok(names(badBinding.violations, "sha256"));
});

test("判不过的运行记录必带原因：缺原因即记录不成立，不得当「有结论的不过」", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (run.arm === "org" ? { ...run, outcome: "failed", acceptance: run.acceptance.map((entry) => ({ ...entry, ok: false, reason: "未产出" })) } : run));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.passed, false);
  assert.ok(names(verdict.reasons, "原因"));
});

test("非对象输入一律拒（fail closed，不按形状猜测）", () => {
  for (const bad of [null, undefined, "judge", 42, []]) {
    assert.equal(judgeExperiment(bad).ok, false, `${String(bad)} 应拒`);
  }
});
