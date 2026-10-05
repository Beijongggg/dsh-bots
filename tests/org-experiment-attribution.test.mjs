/**
 * 放大验收实验的机制归因回归（org-v2 17 号票；规格 §J「机制归因＝事后从台账事件
 * 投影出场清单（分解／互检／外置／并行），不做对照组消融」与附录 A `V-B5`
 * 「每任务一条机制出场清单加裸对照失败原因；**不进通过与否的判定**」）。
 *
 * 判据落点：
 *   - 出场清单从**台账事件**投影（分解＝子任务、互检＝复核请求／报告、外置＝交付物
 *     坐标登记、并行＝任务时间窗重叠）＋裸对照失败原因随任务带出
 *   - 诊断隔离：本模块产出**不含**通过／不通过字段，且判定面不接受它作输入
 *     （后者由 `tests/org-experiment-verdict.test.mjs` 的输入键封闭用例把守）
 *
 * 只测外部行为：`attributeMechanisms` 的投影结果；不读盘、不触真实运行面。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { ATTRIBUTION_MECHANISMS, attributeMechanisms } from "../lib/org/experiment-attribution.js";

const TASKS = Object.freeze([
  { taskId: "TK-17a00001", mechanism: "multi-hop-research" },
  { taskId: "TK-17a00002", mechanism: "cross-file-change" },
  { taskId: "TK-17a00003", mechanism: "long-running-duty" }
]);

/** 台账事件薄记（读数只需 type／taskId／at 与白名单额外键）。 */
function event(type, taskId, at, extra = {}) {
  return { seq: 1, type, taskId, at, actor: { kind: "host", id: "web" }, ...extra };
}

const names = (lines, needle) => lines.some((line) => line.includes(needle));

test("四机制按台账事件投影：分解＝子任务、互检＝复核请求／报告、外置＝交付物坐标（V-B5）", () => {
  const verdict = attributeMechanisms({
    tasks: [TASKS[0]],
    events: [
      event("intake", "TK-17a00001", "2026-09-30T03:00:00.000Z"),
      event("intake", "TK-17a0000a", "2026-09-30T03:05:00.000Z", { parentTaskId: "TK-17a00001" }),
      event("review-requested", "TK-17a00001", "2026-09-30T03:10:00.000Z", { point: "对外交付" }),
      event("review-reported", "TK-17a00001", "2026-09-30T03:20:00.000Z", { subject: "对外交付", verdict: "pass" }),
      event("report", "TK-17a00001", "2026-09-30T03:30:00.000Z", { deliverable: "bots/knowledge/reports/R-2026-101.md" })
    ],
    artifacts: [{ taskId: "TK-17a00001", location: "bots/knowledge/reports/R-2026-101.md" }],
    bareRuns: [{ taskId: "TK-17a00001", outcome: "failed", failureReason: "裸实例超预算未产出合格判据" }]
  });
  assert.equal(verdict.ok, true);
  const [entry] = verdict.tasks;
  assert.deepEqual(entry.appearances, ["decomposition", "cross-check", "externalization"]);
  assert.deepEqual(entry.evidence.decomposition.children, ["TK-17a0000a"]);
  assert.equal(entry.evidence.crossCheck.reviews, 2);
  assert.deepEqual(entry.evidence.externalization.coordinates, ["bots/knowledge/reports/R-2026-101.md"]);
  assert.equal(entry.bareFailureCause, "裸实例超预算未产出合格判据");
});

test("无事件即无出场：清单是事实投影，缺什么不补什么（不充数）", () => {
  const verdict = attributeMechanisms({
    tasks: [TASKS[0]],
    events: [event("intake", "TK-17a00001", "2026-09-30T03:00:00.000Z")],
    bareRuns: [{ taskId: "TK-17a00001", outcome: "failed", failureReason: "未完成" }]
  });
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.tasks[0].appearances, []);
  assert.equal(verdict.tasks[0].evidence.decomposition.children.length, 0);
});

test("事件类型映射封闭：判断输入（judgement）不冒充互检，表外事件不误报", () => {
  const verdict = attributeMechanisms({
    tasks: [TASKS[1]],
    events: [
      event("intake", "TK-17a00002", "2026-09-30T03:00:00.000Z"),
      event("judgement", "TK-17a00002", "2026-09-30T03:05:00.000Z", { intent: "pre-screen", input: { verdict: "pass" } }),
      event("heartbeat", "TK-17a00002", "2026-09-30T03:06:00.000Z"),
      event("command-rejected", "TK-17a00002", "2026-09-30T03:07:00.000Z", { op: "task.close", code: "acceptance-check-failed" })
    ]
  });
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.tasks[0].appearances, []);
});

test("并行＝任务时间窗重叠：只认台账事件窗口的实际重叠（不相交即无并行）", () => {
  const verdict = attributeMechanisms({
    tasks: TASKS,
    events: [
      event("assign", "TK-17a00001", "2026-09-30T03:00:00.000Z"),
      event("report", "TK-17a00001", "2026-09-30T03:30:00.000Z"),
      event("assign", "TK-17a00002", "2026-09-30T03:15:00.000Z"),
      event("report", "TK-17a00002", "2026-09-30T03:45:00.000Z"),
      event("assign", "TK-17a00003", "2026-09-30T05:00:00.000Z"),
      event("report", "TK-17a00003", "2026-09-30T05:30:00.000Z")
    ]
  });
  assert.equal(verdict.ok, true);
  const byTask = Object.fromEntries(verdict.tasks.map((entry) => [entry.taskId, entry]));
  assert.deepEqual(byTask["TK-17a00001"].appearances, ["parallel"]);
  assert.deepEqual(byTask["TK-17a00001"].evidence.parallel.overlapping, ["TK-17a00002"]);
  assert.deepEqual(byTask["TK-17a00002"].evidence.parallel.overlapping, ["TK-17a00001"]);
  assert.deepEqual(byTask["TK-17a00003"].appearances, []);
});

test("诊断隔离：产出无通过／不通过字段，且同一输入重复调用同结果（确定性）", () => {
  const input = {
    tasks: [TASKS[0]],
    events: [event("intake", "TK-17a00001", "2026-09-30T03:00:00.000Z")],
    bareRuns: [{ taskId: "TK-17a00001", outcome: "failed", failureReason: "未完成" }]
  };
  const first = attributeMechanisms(input);
  const second = attributeMechanisms(input);
  assert.deepEqual(first, second);
  const flat = JSON.stringify(first);
  for (const forbidden of ["passed", "verdict", "conclusion", "thresholds", "budgetB"]) {
    assert.equal(flat.includes(forbidden), false, `归因输出不得含判定字段 ${forbidden}（V-B5 只作诊断）`);
  }
  assert.deepEqual(ATTRIBUTION_MECHANISMS.map((entry) => entry.label), ["分解", "互检", "外置", "并行"]);
});

test("任务清单与事件均须为数组；裸跑记录缺原因即拒（归因输入 fail closed）", () => {
  assert.equal(attributeMechanisms(null).ok, false);
  assert.equal(attributeMechanisms({ tasks: [], events: null }).ok, false);
  const noReason = attributeMechanisms({
    tasks: [TASKS[0]],
    events: [],
    bareRuns: [{ taskId: "TK-17a00001", outcome: "failed" }]
  });
  assert.equal(noReason.ok, false);
  assert.ok(names(noReason.violations, "失败原因"));
});
