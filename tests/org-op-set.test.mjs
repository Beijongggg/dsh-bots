/**
 * op-set 岗位表与工具面派生回归（org-v2 06 号票；规格 §D/§E 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A3.3` op-set 岗位表与实际签发对账一致；`ledger.read` 四常设岗有、复核帽无
 *     → 本模块（表内容负例＋对账函数）
 *   - `V-A3.4` 复核帽不含任何写 op（机械检查，不靠约定）→ 本模块（写分类×表交∩空）
 *   - `V-A4.1` 工具按岗位卡派生注册、一 op 一工具、工具名即 op 名；工具清单与
 *     op-set 表逐项一致 → 本模块（派生面×表逐项相等）
 *   - `V-A4.9` 复核帽注册集不含写工具（不是「注册了但拒绝」）→ 本模块
 *
 * 只测外部行为：导出的契约表、分类集与派生/对账纯函数的结论；不触真实
 * ~/.dsh、不依赖台账数据。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EXECUTE_OPS,
  LEDGER_COMMAND_OPS,
  OP_SET,
  READ_OPS,
  RESERVED_OPS,
  STANDING_POST_SLUGS,
  TASK_SCOPED_OPS,
  WRITE_OPS,
  availableOps,
  deriveToolFace,
  reconcileIssuedVsOpSet,
  validateOpSet
} from "../lib/org/op-set.js";
import { OPS } from "../lib/org/task-ledger.js";
import { ROLE_CARDS, STANDING_POST_SLUGS as CARD_STANDING_SLUGS } from "../lib/org/role-cards.js";

test("op-set 表覆盖五类角色类别，键与岗位卡 slug 集一致（V-A3.3 前置）", () => {
  assert.deepEqual(Object.keys(OP_SET).sort(), [...STANDING_POST_SLUGS, "verifier"].sort());
  assert.deepEqual(STANDING_POST_SLUGS, CARD_STANDING_SLUGS, "op-set 与岗位卡两处常设岗清单必须是同一份");
});

test("ledger.read 四常设岗有、复核帽无（V-A3.3）", () => {
  for (const slug of STANDING_POST_SLUGS) {
    assert.ok(OP_SET[slug].includes("ledger.read"), `${slug} 须持 ledger.read`);
  }
  assert.ok(!OP_SET.verifier.includes("ledger.read"), "复核帽不得持 ledger.read");
});

test("表内 op 全部真实存在：台账命令面 op ∪ ledger.read ∪ 执行面；保留集**按岗位**单列不混入", () => {
  const known = new Set([...Object.keys(OPS), "ledger.read", ...EXECUTE_OPS]);
  for (const [slug, ops] of Object.entries(OP_SET)) {
    for (const op of ops) {
      assert.ok(known.has(op), `${slug} 的 op ${op} 不在命令面词表（不得登记不可执行的 op）`);
      const ownReserved = RESERVED_OPS[slug] ?? [];
      assert.ok(!ownReserved.includes(op), `${slug} 的 op ${op} 属本岗保留集，不得混入可执行表`);
    }
  }
  // 保留集语义＝按岗位暂缓升表：本岗保留的 op 不得同时在本岗可执行表
  for (const [slug, ops] of Object.entries(RESERVED_OPS)) {
    for (const op of ops) {
      assert.ok(!OP_SET[slug].includes(op), `${slug} 的保留 op ${op} 不得同时在本岗可执行表`);
    }
  }
});

test("分类是封闭枚举：读集∪写集＝命令面全词表∪ledger.read，执行面单列，三类两两不交（机械检查的完备性前提）", () => {
  const classified = new Set([...READ_OPS, ...WRITE_OPS]);
  assert.deepEqual([...classified].sort(), [...LEDGER_COMMAND_OPS, "ledger.read"].sort());
  for (const op of READ_OPS) assert.ok(!WRITE_OPS.includes(op), `${op} 不得同时属读写两类`);
  for (const op of WRITE_OPS) assert.ok(!READ_OPS.includes(op), `${op} 不得同时属读写两类`);
  // 执行面（非台账命令工具）：不在读写两类内（不落台账事件），但须在册
  const universe = new Set([...LEDGER_COMMAND_OPS, ...READ_OPS, ...EXECUTE_OPS]);
  for (const op of EXECUTE_OPS) {
    assert.ok(!READ_OPS.includes(op) && !WRITE_OPS.includes(op), `执行面 op ${op} 不得混入读写两类`);
    assert.ok(universe.has(op), `执行面 op ${op} 须在封闭词表内`);
  }
});

test("evidence.probe 升表（07 号票）：承接岗可执行、复核帽仍在保留集（其执行面随 08 升表）", () => {
  for (const slug of ["researcher", "implementer"]) {
    assert.ok(OP_SET[slug].includes("evidence.probe"), `${slug} 须持 evidence.probe`);
    assert.ok(!RESERVED_OPS[slug].includes("evidence.probe"), `${slug} 保留集不得再留已升表 op`);
  }
  assert.ok(RESERVED_OPS.verifier.includes("evidence.probe"), "复核帽的 evidence.probe 仍在保留集（归 08 号票）");
  assert.equal(OP_SET.verifier.includes("evidence.probe"), false, "复核帽可执行表仍不含 evidence.probe");
});

test("task.decline 升表（07 号票带理由拒收）：承接岗可执行且属任务域执行集", () => {
  assert.ok(TASK_SCOPED_OPS.includes("task.decline"), "decline 须绑定任务能力（任务域 op）");
  for (const slug of ["researcher", "implementer"]) {
    assert.ok(OP_SET[slug].includes("task.decline"), `${slug} 须持 task.decline`);
  }
  assert.ok(!OP_SET["project-lead"].includes("task.decline"), "派单方无拒收 op（拒收是被派方的动作）");
});

test("复核帽不含任何写 op——可执行集与保留集双向机械检查（V-A3.4）", () => {
  for (const op of OP_SET.verifier) {
    assert.ok(!WRITE_OPS.includes(op), `复核帽可执行表不得含写 op：${op}`);
    assert.ok(READ_OPS.includes(op), `复核帽可执行表只收读 op：${op}`);
  }
  for (const op of RESERVED_OPS.verifier) {
    assert.ok(!WRITE_OPS.includes(op), `复核帽保留集不得预置写 op：${op}`);
  }
});

test("任务域 op 集（须绑定 taskId 的能力）：台账命令类属写集、执行面类属执行集，与承接岗执行面一致", () => {
  for (const op of TASK_SCOPED_OPS) {
    assert.ok(WRITE_OPS.includes(op) || EXECUTE_OPS.includes(op),
      `任务域 op ${op} 须分类为写 op 或执行面 op（须绑定任务能力）`);
  }
  for (const slug of ["researcher", "implementer"]) {
    for (const op of OP_SET[slug]) {
      if (op === "ledger.read") continue;
      assert.ok(TASK_SCOPED_OPS.includes(op), `${slug} 的 op ${op} 应属任务域执行集`);
    }
  }
});

test("工具面派生：一 op 一工具、工具名即 op 名、与 op-set 表逐项一致（V-A4.1）", () => {
  for (const [slug, ops] of Object.entries(OP_SET)) {
    const face = deriveToolFace(slug);
    assert.deepEqual(face.map((tool) => tool.name).sort(), [...ops].sort(), `${slug} 工具清单与 op-set 不一致`);
    assert.equal(new Set(face.map((tool) => tool.name)).size, face.length, `${slug} 工具名有重复（一 op 一工具被破）`);
    for (const tool of face) {
      assert.equal(tool.op, tool.name, "工具名即 op 名");
      assert.equal(typeof tool.execute, "function", "工具必须带执行件（注入 dispatch）");
    }
  }
});

test("复核帽注册集不含写工具（不是「注册了但拒绝」）（V-A4.9）", () => {
  const face = deriveToolFace("verifier");
  for (const tool of face) assert.ok(!WRITE_OPS.includes(tool.op), `复核帽注册集含写工具：${tool.op}`);
});

test("执行面工具派生（07 号票）：evidence.probe 工具 kind＝probe-execute，与台账命令工具区分", () => {
  const face = deriveToolFace("implementer");
  const probeTool = face.find((tool) => tool.op === "evidence.probe");
  assert.equal(probeTool.kind, "probe-execute");
  assert.ok(probeTool.description.includes("白名单"), "执行面工具描述须点明白名单纪律");
  const ledgerTool = face.find((tool) => tool.op === "task.accept");
  assert.equal(ledgerTool.kind, "ledger-command");
});

test("简报不进系统提示段（V-A4.3 后半）：提示段组装面无简报引用；命令通道不触提示服务", () => {
  const source = readFileSync(new URL("../lib/index.js", import.meta.url), "utf8");
  const start = source.indexOf("function registerTeamPromptSection");
  const end = source.indexOf("\nfunction ", start);
  assert.ok(start > 0 && end > start, "提示段注册函数可定位");
  const body = source.slice(start, end);
  assert.equal(/\bbrief\b/.test(body), false, "提示段组装不得引用任务简报（任务动态对象进提示段会串台）");
  const channel = readFileSync(new URL("../lib/org/post-channel.js", import.meta.url), "utf8");
  assert.ok(!channel.includes("systemPrompt"), "bot→host 命令通道不得触提示服务（简报只经接单响应携带）");
});

test("动态工具面不变量：可用集＝home op 集 ∪ 当次签发 op 集（V-A1.4 借用不变量）", () => {
  // 复核帽戴在实施者实例上：home（implementer）∪ 签发（verifier 读 op）⊇ 签发读 op
  const verifierReads = RESERVED_OPS.verifier.length > 0 ? RESERVED_OPS.verifier : ["results.read"];
  const merged = availableOps("implementer", { ops: verifierReads });
  for (const op of OP_SET.implementer) assert.ok(merged.includes(op), "home 集不得因借用丢失");
  for (const op of verifierReads) assert.ok(merged.includes(op), "当次签发 op 必须并入可用集");
  // 无能力＝仅 home 集
  assert.deepEqual(availableOps("implementer", null), OP_SET.implementer);
});

test("对账：签发集 ⊆ 持有者岗位表；越表签发、复核帽写签发均报违例（V-A3.3）", () => {
  const ok = reconcileIssuedVsOpSet([
    { botId: "bot-a", post: "project-lead", ops: ["task.assign", "task.settle"] },
    { botId: "bot-b", post: "researcher", ops: ["task.accept", "ledger.read"] }
  ]);
  assert.equal(ok.ok, true, `合法签发不该报违例：${ok.violations?.join("；")}`);

  const over = reconcileIssuedVsOpSet([
    { botId: "bot-a", post: "researcher", ops: ["task.assign"] }
  ]);
  assert.equal(over.ok, false);
  assert.ok(over.violations.some((v) => v.includes("task.assign") && v.includes("researcher")));

  const verifierWrite = reconcileIssuedVsOpSet([
    { botId: "bot-c", post: "verifier", ops: ["task.report"] }
  ]);
  assert.equal(verifierWrite.ok, false, "给复核帽签发写 op 必须报违例");
});

test("validateOpSet：表被改坏（未知 op／复核帽写 op／常设岗缺 ledger.read）即报违例", () => {
  const broken = validateOpSet({
    ...OP_SET,
    "duty-coordinator": [...OP_SET["duty-coordinator"], "task nonexistent"],
    verifier: [...OP_SET.verifier, "task.report"]
  });
  assert.equal(broken.ok, false);
  assert.ok(broken.violations.some((v) => v.includes("duty-coordinator")));
  assert.ok(broken.violations.some((v) => v.includes("verifier") && v.includes("task.report")));

  const missingRead = validateOpSet({
    ...OP_SET,
    "project-lead": OP_SET["project-lead"].filter((op) => op !== "ledger.read")
  });
  assert.equal(missingRead.ok, false);
  assert.ok(missingRead.violations.some((v) => v.includes("project-lead") && v.includes("ledger.read")));
});

test("岗位卡覆盖：表键不超出在册岗位卡 slug（表与卡同源，无孤儿岗位）", () => {
  const cardSlugs = new Set(ROLE_CARDS.map((card) => card.slug));
  for (const slug of Object.keys(OP_SET)) {
    assert.ok(cardSlugs.has(slug), `op-set 键 ${slug} 无对应岗位卡`);
  }
});

test("registerPostTools：注册集＝派生面（岗位表），复核帽注册集天然不含写工具（V-A4.1/V-A4.9）", async () => {
  const { registerPostTools } = await import("../lib/org/op-set.js");
  const registered = [];
  const fakeTools = { register(tool) { registered.push(tool.name); return () => {}; } };
  const disposers = registerPostTools({ tools: fakeTools, post: "implementer", dispatch: async () => ({ ok: true }) });
  assert.deepEqual(registered.sort(), [...OP_SET.implementer].sort(), "注册集与 op-set 表逐项一致");
  assert.equal(disposers.length, registered.length, "逐工具 disposer");

  const verifierRegs = [];
  registerPostTools({
    tools: { register(tool) { verifierRegs.push(tool.name); return () => {}; } },
    post: "verifier", dispatch: async () => ({})
  });
  for (const name of verifierRegs) {
    assert.ok(!WRITE_OPS.includes(name), `复核帽注册集不含写工具（注册时即排除，非拒绝式）：${name}`);
  }

  assert.throws(() => registerPostTools({ tools: undefined, post: "implementer" }), /tools 服务/);
});
