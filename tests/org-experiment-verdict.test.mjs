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
import { VERDICT_REASONS, experimentRecords, judgeExperiment } from "../lib/org/experiment-verdict.js";
import { ABLATION_TASKS, greenRuns, names, preregFixture, runAt, runRecord, sessionOf } from "./helpers/prereg-fixture.mjs";

function frozenFixture() {
  const prereg = preregFixture();
  const frozen = freezePreregistration(prereg);
  assert.equal(frozen.ok, true);
  return { prereg, frozen: frozen.record };
}

/** 台账目标：结论记录须挂得回一张真任务（record `V-B6`）。 */
const LEDGER_TARGET = Object.freeze({ taskId: "TK-17a00009", actor: { kind: "host", id: "web" }, idempotencyKey: "exp-17-verdict" });


test("全绿：门槛已登记、预登记未改、裸先跑失败入集、组织内在预算内通过即判过（V-B6）", () => {
  const { prereg, frozen } = frozenFixture();
  const verdict = judgeExperiment({ prereg, frozen, runs: greenRuns() });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.passed, true);
  assert.deepEqual(verdict.reasons, []);
  assert.equal(verdict.preregDigest, frozen.digest);
  assert.equal(verdict.frozenAt, frozen.frozenAt);
  assert.deepEqual(verdict.thresholds, { budgetB: 400000, magnitudeMultiple: 4, redispatchCap: 3, reviewRoundsToEscalate: 2, unauthorizedAttempts: 3 });
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
  const mutated = preregFixture({
    thresholds: { budgetB: 800000, magnitudeMultiple: 4, redispatchCap: 3, reviewRoundsToEscalate: 2, unauthorizedAttempts: 3 }
  });
  const verdict = judgeExperiment({ prereg: mutated, frozen, runs: greenRuns() });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.passed, false);
  // 分类靠封闭码，不靠中文措辞：判定面出结构化 reasonCodes
  assert.deepEqual(verdict.reasonCodes, ["prereg-mutated"]);
  assert.ok(verdict.reasons.every((line) => typeof line === "string" && !line.includes("prereg-mutated")),
    `码不进中文串：${verdict.reasons.join("；")}`);
});

test("理由码闭合：判定面出的码都登记在 VERDICT_REASONS 封闭表内（结构断裂类）", () => {
  const { frozen } = frozenFixture();
  const mutated = preregFixture({
    thresholds: { budgetB: 800000, magnitudeMultiple: 4, redispatchCap: 3, reviewRoundsToEscalate: 2, unauthorizedAttempts: 3 }
  });
  const broken = judgeExperiment({ prereg: mutated, frozen, runs: greenRuns() });
  const registered = new Set(VERDICT_REASONS.map((entry) => entry.code));
  for (const code of broken.reasonCodes) assert.ok(registered.has(code), `码 ${code} 须登记进 VERDICT_REASONS`);
  assert.ok(VERDICT_REASONS.some((entry) => entry.code === "prereg-mutated" && entry.structural), "prereg-mutated 属结构断裂类");
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

test("裸对照先跑锚开始时刻：组织内跑 startedAt 早于裸对照即拒（V-B1「先跑」）", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (
    run.arm === "org" ? { ...run, startedAt: runAt(-10) } : run
  ));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.ok(names(verdict.reasons, "先跑"));
});

test("实验前冻结锚开始时刻：startedAt 早于冻结而完成时点晚于冻结照样拒（freeze-after-run）", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (run.arm === "bare" && run.taskId === ABLATION_TASKS[0].taskId
    ? { ...run, startedAt: runAt(-24 * 60) }
    : run));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.passed, false);
  assert.ok(names(verdict.reasons, "冻结"));
  assert.ok(names(verdict.reasons, "开始"), `违例须点名开始时刻：${verdict.reasons.join("；")}`);
});

test("裸对照先跑锚开始时刻：裸跑 startedAt 晚于组织内跑即拒（run-order）", () => {
  const { prereg, frozen } = frozenFixture();
  // 组织内跑**先开始、后完成**：完成时点序正常（旧口径看不出问题），开始时刻序倒挂
  const runs = greenRuns().map((run) => {
    if (run.taskId !== ABLATION_TASKS[0].taskId) return run;
    return run.arm === "bare"
      ? { ...run, startedAt: runAt(30), endedAt: runAt(35), at: runAt(40) }
      : { ...run, startedAt: runAt(10) };
  });
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.ok(names(verdict.reasons, "先跑"), verdict.reasons.join("；"));
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

test("实验前冻结：冻结晚于跑分、或只给摘要没给冻结时点，一律无结论可出（fail closed）", () => {
  const { prereg, frozen } = frozenFixture();
  const late = { ...frozen, frozenAt: runAt(24 * 60) };
  const after = judgeExperiment({ prereg, frozen: late, runs: greenRuns() });
  assert.equal(after.ok, false);
  assert.equal(after.passed, false);
  assert.ok(names(after.reasons, "冻结"));

  const digestOnly = judgeExperiment({ prereg, frozen: frozen.digest, runs: greenRuns() });
  assert.equal(digestOnly.ok, false);
  assert.deepEqual(digestOnly.reasonCodes, ["freeze-record-invalid"]);
  assert.ok(names(digestOnly.reasons, "冻结记录不成立"));
});

test("同任务同臂跑分唯一：多条即记录不成立，结论不得被记录顺序左右", () => {
  const { prereg, frozen } = frozenFixture();
  const task = ABLATION_TASKS[1];
  const failing = { ...greenRuns().find((run) => run.taskId === task.taskId && run.arm === "org"), outcome: "failed", failureReason: "判据未过", acceptance: task.brief.acceptance.map((entry) => ({ ...entry, ok: false, reason: "未产出" })) };
  const passing = greenRuns().find((run) => run.taskId === task.taskId && run.arm === "org");
  const runs = greenRuns();
  for (const extra of [
    [...runs, failing],
    [...runs, passing]
  ]) {
    const verdict = judgeExperiment({ prereg, frozen, runs: extra });
    assert.equal(verdict.ok, false, "重复组织内跑分须判记录不成立");
    assert.ok(names(verdict.reasons, "唯一"));
  }
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

test("封闭键集同口径：运行记录、逐条判据、增量包绑定三处未定义键走同一原语", () => {
  const { prereg, frozen } = frozenFixture();
  const cases = [
    greenRuns().map((run) => (run.taskId === ABLATION_TASKS[0].taskId && run.arm === "org" ? { ...run, note: "额外键" } : run)),
    greenRuns().map((run) => (run.taskId === ABLATION_TASKS[0].taskId && run.arm === "org"
      ? { ...run, acceptance: run.acceptance.map((entry) => ({ ...entry, note: "额外键" })) }
      : run))
  ];
  for (const runs of cases) {
    const verdict = judgeExperiment({ prereg, frozen, runs });
    assert.equal(verdict.ok, false);
    assert.ok(names(verdict.reasons, "封闭键集"), verdict.reasons.join("；"));
  }

  const verdict = judgeExperiment({ prereg, frozen, runs: greenRuns() });
  const records = experimentRecords({
    prereg, frozen, verdict, ...LEDGER_TARGET,
    artifacts: [{ path: "x", sha256: "a".repeat(64), bytes: 1, note: "额外键" }]
  });
  assert.equal(records.ok, false);
  assert.ok(names(records.violations, "封闭键集"), records.violations.join("；"));
});

test("记录面 actor 门与台账 task.judge 同源：user 不得封 judgement 事实，post／host 放行", () => {
  const { prereg, frozen } = frozenFixture();
  const verdict = judgeExperiment({ prereg, frozen, runs: greenRuns() });
  const base = { prereg, frozen, verdict, taskId: LEDGER_TARGET.taskId, idempotencyKey: LEDGER_TARGET.idempotencyKey, artifacts: [] };
  const asUser = experimentRecords({ ...base, actor: { kind: "user", id: "u-1" } });
  assert.equal(asUser.ok, false, "台账 task.judge 只收 post／host，user 封出的记录必被真台账拒");
  assert.ok(names(asUser.violations, "post") && names(asUser.violations, "host"), asUser.violations.join("；"));
  for (const kind of ["post", "host"]) {
    const allowed = experimentRecords({ ...base, actor: { kind, id: `${kind}-1` } });
    assert.equal(allowed.ok, true, `${kind} 应放行：${allowed.violations.join("；")}`);
  }
});

test("记录面：judgement 事实负载＋CHANGELOG 四要件＋增量包文件绑定（V-B6，不扩事件词表）", () => {
  const { prereg, frozen } = frozenFixture();
  const verdict = judgeExperiment({ prereg, frozen, runs: greenRuns() });
  const records = experimentRecords({
    prereg, frozen, verdict, ...LEDGER_TARGET,
    artifacts: [{ path: "artifacts/runs/run-20260930/raw.json", sha256: "a".repeat(64), bytes: 1234 }]
  });
  assert.equal(records.ok, true);
  assert.equal(records.ledger.op, "task.judge");
  assert.equal(records.ledger.eventType, "judgement");
  assert.equal(records.ledger.taskId, LEDGER_TARGET.taskId);
  assert.deepEqual(records.ledger.actor, LEDGER_TARGET.actor);
  assert.equal(records.ledger.idempotencyKey, LEDGER_TARGET.idempotencyKey);
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
  const records = experimentRecords({ prereg, frozen, verdict, ...LEDGER_TARGET, artifacts: [] });
  assert.equal(records.ok, true);
  assert.equal(records.ledger.payload.input.passed, false);
  assert.ok(records.changelog.change.includes("不通过") || records.changelog.change.includes("未通过"));

  const badBinding = experimentRecords({ prereg, frozen, verdict, ...LEDGER_TARGET, artifacts: [{ path: "x", sha256: "zz", bytes: 1 }] });
  assert.equal(badBinding.ok, false);
  assert.ok(names(badBinding.violations, "sha256"));

  // 台账腿必须挂得回一张真任务：任务号／actor／幂等键缺一即拒
  for (const [key, value] of [["taskId", "task-9"], ["actor", { kind: "robot", id: "x" }], ["idempotencyKey", ""]]) {
    const broken = experimentRecords({ prereg, frozen, verdict, ...LEDGER_TARGET, [key]: value, artifacts: [] });
    assert.equal(broken.ok, false, `${key} 非法须拒`);
  }
});

test("判不过的运行记录必带原因：缺原因即记录不成立，不得当「有结论的不过」", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (run.arm === "org" ? { ...run, outcome: "failed", acceptance: run.acceptance.map((entry) => ({ ...entry, ok: false, reason: "未产出" })) } : run));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.passed, false);
  assert.ok(names(verdict.reasons, "原因"));
});

test("坏形状会话日志：判定面出 ok:false 而不是抛异常（fail closed，CLI 照出 JSON）", () => {
  const { prereg, frozen } = frozenFixture();
  const runs = greenRuns().map((run) => (run.arm === "bare" && run.taskId === ABLATION_TASKS[0].taskId
    ? { ...run, sessions: [{ sessionId: "s-1", events: [{ type: "step/end" }] }] }
    : run));
  const verdict = judgeExperiment({ prereg, frozen, runs });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.passed, false);
});

test("非对象输入一律拒（fail closed，不按形状猜测）", () => {
  for (const bad of [null, undefined, "judge", 42, []]) {
    assert.equal(judgeExperiment(bad).ok, false, `${String(bad)} 应拒`);
  }
});
