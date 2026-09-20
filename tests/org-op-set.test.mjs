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
  MUTATING_OPS,
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
  const known = new Set([...Object.keys(OPS), ...READ_OPS, ...EXECUTE_OPS]);
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

test("分类是封闭枚举：读写集覆盖命令面全词表∪ledger.read（08 起另含复核读面，单列在案），执行面单列，三类两两不交", () => {
  const classified = new Set([...READ_OPS, ...WRITE_OPS]);
  for (const op of LEDGER_COMMAND_OPS) {
    assert.ok(classified.has(op), `命令面 op ${op} 漏分类（新命令面 op 必须归类，漏分类即被此处抓出）`);
  }
  assert.ok(classified.has("ledger.read"));
  assert.deepEqual(READ_OPS, ["ledger.read", "artifact.read", "brief.refresh"]); // 08 号票：复核移交件读面；19 号票：承接方持有件刷新（读面驱动、不落事件）
  for (const op of READ_OPS) {
    assert.ok(!LEDGER_COMMAND_OPS.includes(op) || op === "ledger.read", `读面扩展 op ${op} 不得是台账命令（读面不落事件）`);
  }
  for (const op of READ_OPS) assert.ok(!WRITE_OPS.includes(op), `${op} 不得同时属读写两类`);
  for (const op of WRITE_OPS) assert.ok(!READ_OPS.includes(op), `${op} 不得同时属读写两类`);
  // 执行面（非台账命令工具）：不在读写两类内（不落台账事件），但须在册
  const universe = new Set([...LEDGER_COMMAND_OPS, ...READ_OPS, ...EXECUTE_OPS]);
  for (const op of EXECUTE_OPS) {
    assert.ok(!READ_OPS.includes(op) && !WRITE_OPS.includes(op), `执行面 op ${op} 不得混入读写两类`);
    assert.ok(universe.has(op), `执行面 op ${op} 须在封闭词表内`);
  }
});

test("evidence.probe 升表（07 号票）：承接岗可执行；复核帽执行面已随 08 升表", () => {
  for (const slug of ["researcher", "implementer"]) {
    assert.ok(OP_SET[slug].includes("evidence.probe"), `${slug} 须持 evidence.probe`);
    assert.ok(!RESERVED_OPS[slug].includes("evidence.probe"), `${slug} 保留集不得再留已升表 op`);
  }
  assert.ok(OP_SET.verifier.includes("evidence.probe"), "复核帽可执行表含 evidence.probe（08 号票升表）");
});

test("复核面 op 升表（08 号票）：复核帽可执行集＝移交件读＋探针＋报告；保留集收缩为裁定包/移交读", () => {
  assert.deepEqual([...OP_SET.verifier].sort(), ["artifact.read", "evidence.probe", "review.report"].sort());
  assert.deepEqual([...RESERVED_OPS.verifier].sort(), ["evidence.read", "results.read"].sort());
  // 复核面读/报告 op 不得进常设岗行（复核帽专用面）
  for (const slug of STANDING_POST_SLUGS) {
    for (const op of ["artifact.read", "review.report"]) {
      assert.ok(!OP_SET[slug].includes(op), `${slug} 不得持复核帽专用 op ${op}`);
    }
  }
});

test("review.request 升表（08 号票）：project-lead 持之，属命令面写集（管理类）", () => {
  assert.ok(OP_SET["project-lead"].includes("review.request"));
  assert.ok(!RESERVED_OPS["project-lead"].includes("review.request"));
  assert.ok(WRITE_OPS.includes("review.request"), "review.request 是台账命令（落事件），属写集");
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
    assert.ok(READ_OPS.includes(op) || EXECUTE_OPS.includes(op), `复核帽可执行表只收读面/执行面 op：${op}`);
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
      // 读面 op 不属任务域执行集：ledger.read 是公开投影读；brief.refresh（19 号票②）
      // 是实例侧本地同步（读台账投影＋本地状态更新，不经 host 任务域能力授权）。
      // knowledge.register（10 号票）：登记是**角色能力**而非任务域 op——§G 的时点
      // 是「任务关闭或归档流程内」，但登记动作属产出岗的常驻职责（谁产出谁登记，
      // 值班统筹亦然），授权由角色能力承载、不绑单张任务。
      // mail.send（11 号票 §E）：投递**零 capability 门槛**——规格把 mail 定为全员
      // 基础工具、零权威投递通道（V-A3.7），故不接任务域授权；关联键 taskId 只是
      // 邮件内容里的关联信息，不构成授权绑定。
      if (op === "ledger.read" || op === "brief.refresh"
        || op === "knowledge.register" || op === "knowledge.deprecate"
        || op === "mail.send") continue;
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

test("knowledge.register 升表（10 号票 V-A4.5 命令化）：四常设岗持之、复核帽不持；属宿主侧执行面", () => {
  for (const slug of STANDING_POST_SLUGS) {
    assert.ok(OP_SET[slug].includes("knowledge.register"),
      `${slug} 须持 knowledge.register（§G「谁产出谁登记」——登记是产出岗的角色职责）`);
    assert.ok(!RESERVED_OPS[slug].includes("knowledge.register"), `${slug} 保留集不得再留已升表 op`);
  }
  assert.ok(!OP_SET.verifier.includes("knowledge.register"),
    "复核帽无任何写 op，不得持知识登记（V-A4.9）");
  assert.ok(EXECUTE_OPS.includes("knowledge.register"), "分类＝宿主侧执行面（非台账命令）");
  assert.ok(!LEDGER_COMMAND_OPS.includes("knowledge.register"), "知识登记不是台账状态命令");
  assert.ok(!WRITE_OPS.includes("knowledge.register"), "不落台账事件，不属台账写集");
  assert.ok(!TASK_SCOPED_OPS.includes("knowledge.register"),
    "不绑任务域：登记是角色能力（产出方在任务关闭/归档流程内登记，不是任务域 op）");
});

test("knowledge.register 工具派生（kind＝knowledge-register）", () => {
  const tool = deriveToolFace("researcher").find((entry) => entry.op === "knowledge.register");
  assert.equal(tool.kind, "knowledge-register");
  assert.equal(tool.writes, false, "不落台账事件故 writes=false（共享面写者身份由 op-set 分类表达）");
  assert.ok(tool.description.includes("knowledge.register"), "描述须点名 op");
});

test("复核帽不含任何**变异** op——写集 ∪ 共享面写者（V-A3.4 的本义）", () => {
  for (const op of OP_SET.verifier) {
    assert.ok(!MUTATING_OPS.includes(op), `复核帽可执行表不得含变异 op：${op}`);
  }
  for (const op of RESERVED_OPS.verifier) {
    assert.ok(!MUTATING_OPS.includes(op), `复核帽保留集不得预置变异 op：${op}`);
  }
  assert.ok(MUTATING_OPS.includes("knowledge.register"),
    "共享面写者须计入变异集（否则复核帽可经它写共享面）");
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
