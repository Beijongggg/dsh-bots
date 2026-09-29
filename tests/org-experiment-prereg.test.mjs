/**
 * 放大验收实验预登记件回归（org-v2 17 号票；规格 §J「放大验证实验设计」、附录 A
 * B 组 `V-B1`／`V-B2` 与「预登记件」节）。
 *
 * 判据落点：
 *   - `V-B1` 基准集：3–5 个任务按放大机制各取一（多跳研究／跨文件代码改动／长周期
 *     值守例程），每任务四要素简报＋可执行 acceptance；裸对照先跑，失败入集、
 *     成功出集 → 本模块（任务集校验＋入集判定）
 *   - `V-B2` 对照口径：裸实例＝同模型、同基础工具面、无组织命令 op、无组织层脚手架、
 *     预算同量级（token 为主口径）→ 本模块（口径机械核验）
 *   - 「预登记件（实验前冻结，跑完不得改）」→ 本模块（冻结摘要与未改核验）
 *
 * 只测外部行为：`validatePreregistration`／`freezePreregistration`／
 * `preregistrationUnchanged`／`admitBareSet` 的结论与点名；不触真实 ~/.dsh、
 * 不写任何盘面。数值门槛属用户域——本模块只判「填没填、是不是正数」，
 * 不发明数值。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { LEDGER_COMMAND_OPS } from "../lib/org/op-set.js";
import {
  COST_TOKEN_COMPONENTS, EXPERIMENT_MECHANISMS, MECHANISM_IDS, ORG_COMMAND_OPS,
  admitBareSet, freezePreregistration, preregistrationUnchanged, validatePreregistration
} from "../lib/org/experiment-prereg.js";
import { ORG_OPS, bareRun, briefFor, preregFixture } from "./helpers/prereg-fixture.mjs";

/** 违例串里点名某词（用例读法统一：不锁死整句措辞）。 */
const names = (lines, needle) => lines.some((line) => line.includes(needle));

test("合法基线预登记件通过校验（基准集三机制各一＋对照口径＋门槛＋成本口径）", () => {
  const verdict = validatePreregistration(preregFixture());
  assert.deepEqual(verdict, { ok: true, violations: [], gaps: [] });
});

test("机制词表＝三机制封闭枚举，且组织命令词表与 op-set 单源（V-B2 的对照前提）", () => {
  assert.deepEqual(MECHANISM_IDS, ["multi-hop-research", "cross-file-change", "long-running-duty"]);
  assert.deepEqual(EXPERIMENT_MECHANISMS.map((entry) => entry.label), ["多跳研究", "跨文件代码改动", "长周期值守例程"]);
  // 组织命令面口径的单一源：实验模块不得另抄一份词表（少一条即「裸侧漏切命令面」）
  assert.deepEqual([...ORG_COMMAND_OPS].sort(), [...LEDGER_COMMAND_OPS].sort());
});

test("基准集数量：多于 5 或少于 3 即拒（V-B1「3–5 个」）", () => {
  const three = preregFixture().tasks;
  const tooMany = preregFixture({
    tasks: [...three, { taskId: "TK-17a00004", mechanism: "multi-hop-research", brief: briefFor("第四件", "bots/knowledge/reports/R-2026-104.md") },
      { taskId: "TK-17a00005", mechanism: "cross-file-change", brief: briefFor("第五件", "bots/knowledge/reports/R-2026-105.md") },
      { taskId: "TK-17a00006", mechanism: "long-running-duty", brief: briefFor("第六件", "bots/knowledge/reports/R-2026-106.md") }]
  });
  const manyVerdict = validatePreregistration(tooMany);
  assert.equal(manyVerdict.ok, false);
  assert.ok(names(manyVerdict.violations, "3–5"));

  const tooFew = validatePreregistration(preregFixture({ tasks: three.slice(0, 2) }));
  assert.equal(tooFew.ok, false);
  assert.ok(names(tooFew.violations, "3–5"));
});

test("机制齐备：三机制各须至少一条，缺一即拒并点名机制（V-B1「各取一」）", () => {
  const tasks = preregFixture().tasks.map((task) => (
    task.mechanism === "long-running-duty" ? { ...task, mechanism: "multi-hop-research" } : task
  ));
  const verdict = validatePreregistration(preregFixture({ tasks }));
  assert.equal(verdict.ok, false);
  assert.ok(names(verdict.violations, "long-running-duty"));
});

test("机制取值封闭：词表外机制即拒（防「按机制各取一」被自造类别稀释）", () => {
  const tasks = preregFixture().tasks.map((task) => (
    task.mechanism === "cross-file-change" ? { ...task, mechanism: "多跳研究" } : task
  ));
  const verdict = validatePreregistration(preregFixture({ tasks }));
  assert.equal(verdict.ok, false);
  assert.ok(names(verdict.violations, "多跳研究"));
});

test("每任务须四要素简报＋可执行 acceptance：简报缺件或判据白名单外即拒（V-B1）", () => {
  const tasks = preregFixture().tasks;
  const withoutBrief = validatePreregistration(preregFixture({
    tasks: [tasks[0], { ...tasks[1], brief: { ...tasks[1].brief, boundaries: "" } }, tasks[2]]
  }));
  assert.equal(withoutBrief.ok, false);
  assert.ok(names(withoutBrief.violations, "boundaries"));

  const inexecutable = validatePreregistration(preregFixture({
    tasks: [tasks[0], tasks[1], { ...tasks[2], brief: { ...tasks[2].brief, acceptance: [{ probe: "shell.exec", args: { cmd: "true" } }] } }]
  }));
  assert.equal(inexecutable.ok, false);
  assert.ok(names(inexecutable.violations, "shell.exec"));
});

test("任务标识形状：非台账任务号即拒（判据落点须可回读台账）", () => {
  const tasks = preregFixture().tasks;
  const verdict = validatePreregistration(preregFixture({
    tasks: [tasks[0], { ...tasks[1], taskId: "task-2" }, tasks[2]]
  }));
  assert.equal(verdict.ok, false);
  assert.ok(names(verdict.violations, "task-2"));
});

test("顶层键封闭：预登记件之外的键即拒（防口径藏进侧门字段）", () => {
  const verdict = validatePreregistration({ ...preregFixture(), note: "本次实验其实还比较了第三种口径" });
  assert.equal(verdict.ok, false);
  assert.ok(names(verdict.violations, "note"));
});

test("数值门槛属用户域：未填即判缺口、非正数即违例（均 fail closed，不发明数值）", () => {
  const unregistered = validatePreregistration(preregFixture({ thresholds: { budgetB: null, magnitudeMultiple: null } }));
  assert.equal(unregistered.ok, false);
  assert.deepEqual(unregistered.violations, []);
  assert.ok(names(unregistered.gaps, "budgetB"));
  assert.ok(names(unregistered.gaps, "用户域"));

  const nonPositive = validatePreregistration(preregFixture({ thresholds: { budgetB: 0, magnitudeMultiple: -1 } }));
  assert.equal(nonPositive.ok, false);
  assert.ok(names(nonPositive.violations, "budgetB") && names(nonPositive.violations, "magnitudeMultiple"));
});

test("两臂预算同属用户域：未填即缺口（只判缺口不判违例），填了非正数才是违例", () => {
  const base = preregFixture();
  const blank = validatePreregistration(preregFixture({
    thresholds: { budgetB: null, magnitudeMultiple: null },
    profiles: {
      bare: { ...base.profiles.bare, budgetB: null },
      org: { ...base.profiles.org, budgetB: null }
    }
  }));
  assert.equal(blank.ok, false);
  assert.deepEqual(blank.violations, []);
  assert.ok(names(blank.gaps, "profiles.bare.budgetB") && names(blank.gaps, "profiles.org.budgetB"));

  const negative = validatePreregistration(preregFixture({
    profiles: { ...base.profiles, bare: { ...base.profiles.bare, budgetB: -1 } }
  }));
  assert.equal(negative.ok, false);
  assert.ok(names(negative.violations, "profiles.bare.budgetB"));
});

test("成本口径：四分量＋墙钟＋轮次齐备；出现币值字段即拒（V-B4「不做币值换算」）", () => {
  const wrongTokens = validatePreregistration(preregFixture({
    costMetrics: { ...preregFixture().costMetrics, tokens: ["inputTokens", "outputTokens"] }
  }));
  assert.equal(wrongTokens.ok, false);
  assert.ok(names(wrongTokens.violations, "uncachedInputTokens"));
  assert.deepEqual(COST_TOKEN_COMPONENTS, ["uncachedInputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"]);

  const withCurrency = validatePreregistration(preregFixture({
    costMetrics: { ...preregFixture().costMetrics, currency: "USD" }
  }));
  assert.equal(withCurrency.ok, false);
  assert.ok(names(withCurrency.violations, "币值"));
});

test("对照口径：同模型、同基础工具面、无组织命令 op、无组织层脚手架（V-B2）", () => {
  const base = preregFixture();
  const otherModel = validatePreregistration(preregFixture({
    profiles: { ...base.profiles, org: { ...base.profiles.org, model: "niko/gpt-5.6-pro" } }
  }));
  assert.equal(otherModel.ok, false);
  assert.ok(names(otherModel.violations, "同模型"));

  const otherTools = validatePreregistration(preregFixture({
    profiles: { ...base.profiles, org: { ...base.profiles.org, baseTools: ["fs.read"] } }
  }));
  assert.equal(otherTools.ok, false);
  assert.ok(names(otherTools.violations, "基础工具面"));

  const bareWithOrgOps = validatePreregistration(preregFixture({
    profiles: { ...base.profiles, bare: { ...base.profiles.bare, ops: [...ORG_OPS] } }
  }));
  assert.equal(bareWithOrgOps.ok, false);
  assert.ok(names(bareWithOrgOps.violations, "组织命令"));

  const bareWithScaffolding = validatePreregistration(preregFixture({
    profiles: { ...base.profiles, bare: { ...base.profiles.bare, scaffolding: ["task-ledger"] } }
  }));
  assert.equal(bareWithScaffolding.ok, false);
  assert.ok(names(bareWithScaffolding.violations, "脚手架"));

  // 预算同量级：裸侧预算与组织侧预算离预登记门槛超过量级倍数即拒（token 为主口径）
  const offScale = validatePreregistration(preregFixture({
    profiles: { ...base.profiles, bare: { ...base.profiles.bare, budgetB: 4000 } }
  }));
  assert.equal(offScale.ok, false);
  assert.ok(names(offScale.violations, "同量级"));
});

test("冻结：非法件拒冻（fail closed）；合法件摘要对键序稳定、内容改动即变", () => {
  const refused = freezePreregistration(preregFixture({ thresholds: { budgetB: null, magnitudeMultiple: null } }));
  assert.equal(refused.ok, false);
  assert.equal(refused.digest, null);
  assert.ok(names(refused.gaps, "budgetB"));

  const first = freezePreregistration(preregFixture());
  assert.equal(first.ok, true);
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.match(first.frozenAt, /^\d{4}-\d{2}-\d{2}T/);

  // 键序不同＝同摘要（canonical JSON）；门槛改动＝新摘要
  const reordered = preregFixture();
  const shuffled = { costMetrics: reordered.costMetrics, thresholds: reordered.thresholds, profiles: reordered.profiles, tasks: reordered.tasks, experimentId: reordered.experimentId, schemaVersion: reordered.schemaVersion };
  assert.equal(freezePreregistration(shuffled).digest, first.digest);

  const changed = freezePreregistration(preregFixture({ thresholds: { budgetB: 500000, magnitudeMultiple: 4 } }));
  assert.notEqual(changed.digest, first.digest);
});

test("跑完未改：摘要同即过；门槛或任务集改动即拒并点名 prereg-mutated", () => {
  const frozen = freezePreregistration(preregFixture());
  assert.deepEqual(preregistrationUnchanged(preregFixture(), frozen.digest), { ok: true, digest: frozen.digest });

  const mutated = preregistrationUnchanged(preregFixture({ thresholds: { budgetB: 800000, magnitudeMultiple: 4 } }), frozen.digest);
  assert.equal(mutated.ok, false);
  assert.equal(mutated.code, "prereg-mutated");
  assert.match(mutated.digest, /^[a-f0-9]{64}$/);

  const malformed = preregistrationUnchanged(preregFixture(), "not-a-digest");
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, "prereg-mutated");
});

test("裸对照入集：失败入集、成功出集；缺裸跑记录即拒（V-B1「裸对照先跑」）", () => {
  const prereg = preregFixture();
  const admitted = admitBareSet({
    prereg,
    bareRuns: [bareRun("TK-17a00001"), bareRun("TK-17a00002", "passed"), bareRun("TK-17a00003")]
  });
  assert.equal(admitted.ok, true);
  assert.deepEqual(admitted.admitted, ["TK-17a00001", "TK-17a00003"]);
  assert.deepEqual(admitted.excluded, ["TK-17a00002"]);
  // 出集带走的机制是**登记的诊断事实**（结论覆盖面据此读），不是可静默丢的细节
  assert.deepEqual(admitted.mechanismsLost, ["cross-file-change"]);

  const missing = admitBareSet({ prereg, bareRuns: [bareRun("TK-17a00001"), bareRun("TK-17a00003")] });
  assert.equal(missing.ok, false);
  assert.ok(names(missing.violations, "TK-17a00002"));
  assert.ok(names(missing.violations, "裸对照"));
});

test("裸对照入集：败因必填；候选全过即无结论可出（fail closed，不充数）", () => {
  const prereg = preregFixture();
  const noReason = admitBareSet({
    prereg,
    bareRuns: [{ taskId: "TK-17a00001", arm: "bare", at: "2026-09-30T02:00:00.000Z", outcome: "failed" }, bareRun("TK-17a00002", "passed"), bareRun("TK-17a00003")]
  });
  assert.equal(noReason.ok, false);
  assert.ok(names(noReason.violations, "失败原因"));

  const allPassed = admitBareSet({
    prereg,
    bareRuns: [bareRun("TK-17a00001", "passed"), bareRun("TK-17a00002", "passed"), bareRun("TK-17a00003", "passed")]
  });
  assert.equal(allPassed.ok, false);
  assert.deepEqual(allPassed.admitted, []);
  assert.ok(names(allPassed.violations, "multi-hop-research") && names(allPassed.violations, "cross-file-change"));
});

test("非对象输入一律拒（fail closed，不按形状猜测）", () => {
  for (const bad of [null, undefined, "prereg", 42, [], [preregFixture()]]) {
    assert.equal(validatePreregistration(bad).ok, false, `${String(bad)} 应拒`);
    assert.equal(freezePreregistration(bad).ok, false, `${String(bad)} 应拒冻`);
  }
});
