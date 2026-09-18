/**
 * 派单配置表回归（org-v2 07 号票；规格 §B 收单规则表与值守例程段）。
 *
 * 判据落点（规格无单列附录 A 条目——本模块为 05 号票留界 #6/#8 的票内执行
 * 坐标）：值守例程声明式登记项（例程 id／触发／模板／预算缝）＋收单规则表
 * 匹配语义 → 本模块；展开产物过四要素简报校验（`V-A2.4` 的例程路径）。
 *
 * 07 号票承载（05 号票留界 #6／#8）：值守例程的**声明式登记项**（例程 id／
 * 触发条件或周期／简报模板／预算缝）与**收单确定性规则表**（命中即直办、
 * 未命中上浮值班统筹的匹配逻辑——不在台账状态机内）。
 *
 * 只测外部行为：登记表构建期校验（模板必须展开为合法四要素简报）、模板展开
 * （变量代入）、规则匹配纯函数（命中／未命中）。不触真实 ~/.dsh。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ROUTINE_REGISTRY,
  expandRoutine,
  matchIntakeRule,
  validateDispatchConfig
} from "../lib/org/dispatch-config.js";
import { validateBrief } from "../lib/org/brief.js";

test("构建期校验：例程登记表与收单规则表全量合法（模板展开即合法简报）", () => {
  const verdict = validateDispatchConfig();
  assert.deepEqual(verdict, { ok: true, violations: [] });
});

test("例程登记表登记的是例程形状：id／触发／模板／预算缝四件齐备且 id 唯一", () => {
  const seen = new Set();
  for (const entry of ROUTINE_REGISTRY) {
    assert.ok(typeof entry.routineId === "string" && entry.routineId !== "", "例程 id 必填");
    assert.ok(!seen.has(entry.routineId), `例程 id 重复：${entry.routineId}`);
    seen.add(entry.routineId);
    assert.ok(entry.trigger !== undefined && entry.trigger.kind !== undefined, `${entry.routineId}: 触发条件必填`);
    assert.ok(entry.briefTemplate !== undefined, `${entry.routineId}: 简报模板必填`);
    assert.ok("budget" in entry, `${entry.routineId}: 预算缝必须显式登记（数值属用户域，null＝未设限）`);
  }
});

test("异常处置例程在册（ledger-host 异常汇入的现役消费方）：两类异常源各有登记", () => {
  const ids = ROUTINE_REGISTRY.map((entry) => entry.routineId);
  assert.ok(ids.includes("duty-anomaly-inbox-backlog"), "收单积压异常例程在册");
  assert.ok(ids.includes("duty-anomaly-turn-failure"), "回合失败异常例程在册");
});

test("模板展开：{{var}} 全深度代入，展开产物过 validateBrief（含判据参数位）", () => {
  const brief = expandRoutine("duty-anomaly-inbox-backlog", { botId: "bot-x" });
  assert.ok(brief.goal.includes("bot-x"), "goal 代入实例 id");
  const verdict = validateBrief(brief);
  assert.equal(verdict.ok, true, `展开产物应为合法简报：${JSON.stringify(verdict)}`);
  const probe = brief.acceptance?.[0];
  assert.equal(probe?.args?.botId, "bot-x", "判据参数同样代入（验收判据锚定被处置实例）");
});

test("模板展开：未知例程 id 即拒（fail closed，不静默产出空简报）；缺变量保留原样占位", () => {
  assert.throws(() => expandRoutine("no-such-routine", {}), /未知例程/);
  const brief = expandRoutine("duty-anomaly-turn-failure", {});
  assert.ok(brief.goal.includes("{{botId}}"), "缺变量不静默清空——占位保留，调用方可判");
});

test("收单规则匹配：命中返回规则、未命中返回 null（语义判断上浮值班统筹的机械前提）", () => {
  for (const receipt of [
    { source: "user", text: "帮我把文档目录更新一遍" },
    { source: "event", kind: "webhook", payload: {} }
  ]) {
    assert.equal(matchIntakeRule(receipt), null, "未命中即 null——收单上浮分诊");
  }
  // 规则匹配的命中形态：断言器形态的规则可被命中（表当前可空——机制先行，
  // 条目随 11 号票收单流增补；本例用注入表钉住匹配语义）
  const rules = [{ id: "rule-daily-standup", when: { source: "event", kind: "standup" }, action: "direct" }];
  assert.deepEqual(
    matchIntakeRule({ source: "event", kind: "standup", payload: {} }, rules)?.id,
    "rule-daily-standup"
  );
});
