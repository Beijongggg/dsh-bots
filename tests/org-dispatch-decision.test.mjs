/**
 * 派单决策缝回归（org-v2 26 号票；规格 §B 归属与租约、§A 岗位集）。
 *
 * 现树里 `task.assign` 的 assignee 由调用方手写字符串，无确定性依据——本模块
 * 把「派给谁」落成纯函数（照 `selectReviewer` 先例）：候选注册表行＋在手查询
 * ＋编制缺口 → 选中者＋可核理由；无可派返回 null（调用方 fail closed）。
 * 承接能力与 op-set 表同源（`table[post]` 含 `task.accept` 即承接岗，不另抄名单）；
 * `INTAKE_RULES` 保持空集（机制先行、无虚条目）。
 *
 * 只测纯函数行为，不触真实 ~/.dsh、不 spawn、不接宿主。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { selectAssignee } from "../lib/org/dispatch-decision.js";
import { INTAKE_RULES } from "../lib/org/dispatch-config.js";
import { OP_SET } from "../lib/org/op-set.js";

const idle = () => null;
const idleRoster = Object.freeze({ missing: [], anchorPresent: true, minimalComplete: true });

test("派单决策：空闲且可承接者首中＋理由可核（V-A2.6）", () => {
  const picked = selectAssignee({
    candidates: [
      { botId: "impl-1", post: "implementer" },
      { botId: "res-1", post: "researcher" }
    ],
    holdingsFor: idle,
    rosterState: idleRoster
  });
  assert.deepEqual(picked?.botId, "impl-1");
  assert.equal(picked?.post, "implementer");
  assert.ok(typeof picked?.reason === "string" && picked.reason.includes("impl-1"), "理由须点名选中者");
  assert.ok(picked.reason.includes("implementer"), "理由须点名岗位");
});

test("派单决策：在忙跳过＋全忙即 null（V-A2.6 一实例一任务同口径）", () => {
  const holdingsFor = (botId) => (botId === "impl-1" ? { taskId: "TK-X" } : null);
  const picked = selectAssignee({
    candidates: [
      { botId: "impl-1", post: "implementer" },
      { botId: "res-1", post: "researcher" }
    ],
    holdingsFor,
    rosterState: idleRoster
  });
  assert.deepEqual(picked?.botId, "res-1", "在忙者跳过，首中空闲者");
  assert.equal(
    selectAssignee({
      candidates: [{ botId: "impl-1", post: "implementer" }],
      holdingsFor,
      rosterState: idleRoster
    }),
    null,
    "无可派即 bare null（调用方 fail closed，不静默指派）"
  );
});

test("派单决策：承接能力与 op-set 同源（非承接岗不可派）", () => {
  // 统筹／项目经理／复核帽无 task.accept（op-set 表现状），即使空闲也不可派
  for (const post of ["duty-coordinator", "project-lead", "verifier", "", "no-such-post"]) {
    assert.equal(
      selectAssignee({ candidates: [{ botId: "x", post }], holdingsFor: idle }),
      null,
      `post=${String(post)} 无承接能力即 null`
    );
  }
  // 同源性：判定跟表走，不跟硬编码岗名——注入表把 implementer 的 task.accept 拿掉即不可派
  const stripped = { ...OP_SET, implementer: OP_SET.implementer.filter((op) => op !== "task.accept") };
  assert.equal(
    selectAssignee({ candidates: [{ botId: "impl-1", post: "implementer" }], holdingsFor: idle, table: stripped }),
    null,
    "表里拿掉 task.accept 即不可派（同源不断）"
  );
  // 注入表给统筹加上 task.accept 即变可派（不另抄名单的反向证明）
  const extended = { ...OP_SET, "duty-coordinator": [...OP_SET["duty-coordinator"], "task.accept"] };
  assert.deepEqual(
    selectAssignee({ candidates: [{ botId: "co-1", post: "duty-coordinator" }], holdingsFor: idle, table: extended })?.botId,
    "co-1"
  );
});

test("派单决策：注册表 id 形状兼容＋holdingsFor 缺失即抛", () => {
  // 注册表现实键为 id（lib/index.js），选择器先例为 botId——双兼容
  assert.deepEqual(
    selectAssignee({ candidates: [{ id: "impl-9", post: "implementer" }], holdingsFor: idle })?.botId,
    "impl-9"
  );
  // 无效行跳过（空 id／非字符串不选中不断链）
  assert.deepEqual(
    selectAssignee({
      candidates: [{ botId: "", post: "implementer" }, { botId: "impl-1", post: "implementer" }],
      holdingsFor: idle
    })?.botId,
    "impl-1"
  );
  // holdingsFor 缺失即抛（照 selectReviewer 先例，不静默当全空闲）
  assert.throws(() => selectAssignee({ candidates: [] }), /holdingsFor/);
});

test("派单决策：编制缺口只进理由不改排序＋INTAKE_RULES 保持空集", () => {
  const candidates = [
    { botId: "res-1", post: "researcher" },
    { botId: "impl-1", post: "implementer" }
  ];
  const first = selectAssignee({
    candidates, holdingsFor: idle, rosterState: { missing: ["implementer"], anchorPresent: true, minimalComplete: false }
  });
  // 输入序即优先级：即使缺口点名 implementer，排前面的 researcher 仍首中（不发明优先级规则）
  assert.deepEqual(first?.botId, "res-1");
  assert.ok(first?.reason.includes("implementer"), "理由须陈述编制缺口（可核）");
  // INTAKE_RULES 保持空集：机制先行、无虚条目（本票不为填表而编规则）
  assert.deepEqual(INTAKE_RULES, [], "INTAKE_RULES 须保持空集");
});
