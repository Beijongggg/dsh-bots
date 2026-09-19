/**
 * 记忆与知识层策略回归（org-v2 10 号票；规格 §G 与附录 A `V-A7.6`–`V-A7.10`）。
 *
 * 判据落点：
 *   - `V-A7.6` 写入分流三问可判；**推理过程不进任何面** → 本模块（路由纯函数
 *     全分支 + 推理优先级负例）
 *   - `V-A7.7` 晋升门槛三条可查；强制性由简报输出格式预声明 → 本模块（门槛
 *     判定 + 简报预声明字段的冻结期校验）
 *   - `V-A7.8` 失效唯一机制＝显式取代／废弃；无自动失效、无访问热字段 → 本模块
 *     （登记动作形状 + 「无自动机制」反向断言）
 *   - `V-A7.9` 冲突裁决：知识与台账冲突台账胜；与岗位卡冲突岗位卡胜 → 本模块
 *   - `V-A7.10` 移交只传指针、接手方拉取；工件归档不删档、无保留期上限 → 本模块
 *
 * 只测外部行为：策略纯函数的结论；不触真实 ~/.dsh、不写盘。
 */
import assert from "node:assert/strict";

const results = [];
const test = (name, fn) => results.push([name, fn]);

const {
  routeContent, evaluatePromotion, promotionRequired, planInvalidation, resolveConflict, buildHandoff,
  orgConstantFace,
  MEMORY_ROUTES, PROMOTION_GATES, INVALIDATION_ACTIONS, CONFLICT_FACES
} = await import("../lib/org/memory-layer.js");

// ===================== 缝① 写入分流三问（V-A7.6） =====================

test("三问分流：本任务历史事实 → 台账（Q①）", () => {
  const r = routeContent({ isTaskHistory: true });
  assert.equal(r.route, "ledger");
  assert.ok(r.reason.includes("台账"), "理由须点名台账");
});

test("三问分流：换一个不同任务仍成立 → 知识库（Q②）", () => {
  const r = routeContent({ holdsAcrossTasks: true });
  assert.equal(r.route, "knowledge");
});

test("三问分流：中间产物 → taskId 键工件存档（Q③）", () => {
  const r = routeContent({ isIntermediateArtifact: true, taskId: "TK-1" });
  assert.equal(r.route, "artifact");
  assert.equal(r.taskId, "TK-1");
});

test("中间产物缺 taskId → 判 needs（工件以 taskId 为键，无键即无法路由）", () => {
  const r = routeContent({ isIntermediateArtifact: true });
  assert.equal(r.route, null);
  assert.equal(r.needs, "taskId");
  assert.ok(r.reason.includes("taskId"));
});

test("推理过程任何面都不进——即便同时标为可复用/本任务事实（V-A7.6 末句，优先级最高）", () => {
  for (const extra of [
    { holdsAcrossTasks: true },
    { isTaskHistory: true },
    { isIntermediateArtifact: true, taskId: "TK-1" },
    { holdsAcrossTasks: true, isTaskHistory: true, isIntermediateArtifact: true, taskId: "TK-1" }
  ]) {
    const r = routeContent({ isReasoning: true, ...extra });
    assert.equal(r.route, null, `推理过程不得路由：${JSON.stringify(extra)}`);
    assert.ok(r.reason.includes("推理过程"), "理由须点名推理过程");
  }
});

test("三问优先级：任务历史优先于可复用（Q①→Q② 顺序不可倒）", () => {
  assert.equal(routeContent({ isTaskHistory: true, holdsAcrossTasks: true }).route, "ledger");
});

test("无可路由面 → route:null 且理由说明（并非所有内容都有承载面）", () => {
  const r = routeContent({});
  assert.equal(r.route, null);
  assert.ok(typeof r.reason === "string" && r.reason.length > 0);
});

test("路由值域封闭：MEMORY_ROUTES 恰为三面（共享侧无第三面）", () => {
  assert.deepEqual(Array.from(MEMORY_ROUTES), ["ledger", "knowledge", "artifact"]);
});

test("分流输入非对象 → 一律抛（fail closed，不静默路由）", () => {
  for (const bad of [null, undefined, "x", 42, []]) {
    assert.throws(() => routeContent(bad), /对象/, `${String(bad)} 应抛`);
  }
});

// ===================== 缝② 晋升门槛三条（V-A7.7） =====================

test("晋升门槛三条齐备即通过；门槛 id 封闭枚举", () => {
  assert.deepEqual(Array.from(PROMOTION_GATES),
    ["model-swap-test", "self-contained", "traced"]);
  const r = evaluatePromotion({ modelSwapTest: true, selfContained: true, traced: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.failed, []);
});

test("晋升门槛：任一不过即 ok:false 并点名缺哪条（可查）", () => {
  const cases = [
    [{ modelSwapTest: false, selfContained: true, traced: true }, "model-swap-test"],
    [{ modelSwapTest: true, selfContained: false, traced: true }, "self-contained"],
    [{ modelSwapTest: true, selfContained: true, traced: false }, "traced"]
  ];
  for (const [input, expected] of cases) {
    const r = evaluatePromotion(input);
    assert.equal(r.ok, false, JSON.stringify(input));
    assert.deepEqual(r.failed, [expected]);
    assert.ok(r.reason.includes(expected), "理由须点名未过门槛");
  }
});

test("晋升门槛：缺省（未评估）＝不过（默认保守，不得静默放行）", () => {
  const r = evaluatePromotion({});
  assert.equal(r.ok, false);
  assert.equal(r.failed.length, 3);
});

test("晋升门槛输入非对象 → 抛（fail closed）", () => {
  for (const bad of [null, undefined, "x"]) {
    assert.throws(() => evaluatePromotion(bad), /对象/);
  }
});

test("晋升强制性读面：缺省＝未声明（不强制）；false 与 true 分别可辨（V-A7.7）", () => {
  assert.deepEqual(promotionRequired({}), { required: false, declared: false });
  assert.deepEqual(promotionRequired({ promotion: { required: false } }), { required: false, declared: true });
  assert.deepEqual(promotionRequired({ promotion: { required: true } }), { required: true, declared: true });
  // 畸形预声明不得被读成「已声明为真」——保守取未声明
  assert.deepEqual(promotionRequired({ promotion: { required: "yes" } }), { required: false, declared: false });
  assert.deepEqual(promotionRequired(null), { required: false, declared: false });
});

test("登记不构成任务完成依据：晋升门槛与强制性读面互不代偿（V-A7.7 末句）", () => {
  // 强制性＝派单方要求；门槛＝内容质量。required:true 不会让不过门槛的内容过，
  // 门槛全过也不会让「未声明强制」的单子变成强制。
  const required = promotionRequired({ promotion: { required: true } });
  const gate = evaluatePromotion({ modelSwapTest: true, selfContained: true, traced: false });
  assert.equal(required.required, true);
  assert.equal(gate.ok, false, "强制性不得代偿门槛");
});

// ===================== 缝③ 失效唯一机制（V-A7.8） =====================

test("失效动作值域封闭：恰为显式取代／废弃两种（V-A7.8）", () => {
  assert.deepEqual(Array.from(INVALIDATION_ACTIONS), ["supersede", "deprecate"]);
});

test("取代登记：须给后继 id，产出 append 语义补丁（旧痕迹保留、不物理删除）", () => {
  const r = planInvalidation({ action: "supersede", targetId: "R-2026-001", successorId: "R-2026-002" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { id: "R-2026-001", status: "updated", supersededBy: "R-2026-002" });
});

test("废弃登记：不给后继，产出 status=deprecated 补丁", () => {
  const r = planInvalidation({ action: "deprecate", targetId: "R-2026-001" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { id: "R-2026-001", status: "deprecated" });
});

test("取代缺后继 id → 拒（取代必有收口对象；防「取代成一个洞」）", () => {
  const r = planInvalidation({ action: "supersede", targetId: "R-2026-001" });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.includes("successorId")));
});

test("自动失效形态一律拒：expire/ttl/delete/purge/auto-* 不在动作值域（V-A7.8「不做自动失效」）", () => {
  for (const action of ["expire", "auto-expire", "ttl", "delete", "purge", "archive", "score", "hot"]) {
    const r = planInvalidation({ action, targetId: "R-2026-001" });
    assert.equal(r.ok, false, `动作 ${action} 应拒`);
    assert.ok(r.violations.some((v) => v.includes("动作")), "违例须点名动作不在值域");
  }
});

test("无自动失效（时间无关）：planInvalidation 对时间输入不敏感——同输入不同时刻产出同一补丁", () => {
  const base = { action: "supersede", targetId: "R-2026-001", successorId: "R-2026-002" };
  const a = planInvalidation({ ...base, now: new Date("2020-01-01T00:00:00Z") });
  const b = planInvalidation({ ...base, now: new Date("2099-12-31T23:59:59Z") });
  assert.deepEqual(a.patch, b.patch, "补丁不得随时间变化（无 TTL、无到期自动动作）");
  const c = planInvalidation({ ...base, expiresAt: "2020-01-01T00:00:00Z", ttlDays: 1 });
  assert.deepEqual(c.patch, a.patch, "夹带到期字段不改变补丁形状（不得落地为机制）");
});

test("无访问热字段：补丁键封闭——只许 id/status/supersededBy，计数字段进不来", () => {
  const r = planInvalidation({ action: "deprecate", targetId: "R-2026-001" });
  assert.deepEqual(Object.keys(r.patch).sort(), ["id", "status"]);
  const hot = planInvalidation({
    action: "deprecate", targetId: "R-2026-001",
    accessCount: 12, hitCount: 3, lastAccessedAt: "2026-09-19T00:00:00Z", score: 0.9
  });
  assert.deepEqual(Object.keys(hot.patch).sort(), ["id", "status"], "热字段不得进补丁（V-A7.8 无热字段）");
});

test("失效登记输入非对象 / 缺 targetId → 拒（fail closed）", () => {
  assert.throws(() => planInvalidation(null), /对象/);
  assert.equal(planInvalidation({ action: "deprecate" }).ok, false);
  assert.equal(planInvalidation({ action: "deprecate", targetId: "  " }).ok, false);
});

// ===================== 缝④ 冲突裁决（V-A7.9） =====================

test("裁决面词表封闭：恰三面（规格只定义其中两对，本模块不自定序）", () => {
  assert.deepEqual(Array.from(CONFLICT_FACES), ["role-card", "ledger", "knowledge"]);
});

test("知识与台账冲突 → 台账胜（V-A7.9 上半）", () => {
  const r = resolveConflict({ faces: ["knowledge", "ledger"] });
  assert.equal(r.winner, "ledger");
  assert.deepEqual(r.losers, ["knowledge"]);
  assert.equal(r.requiresInvalidation, true, "败方是知识条目 → 须取代收口");
  assert.ok(r.reason.includes("台账胜"));
});

test("知识与岗位卡冲突 → 岗位卡胜（V-A7.9 下半）", () => {
  const r = resolveConflict({ faces: ["knowledge", "role-card"] });
  assert.equal(r.winner, "role-card");
  assert.deepEqual(r.losers, ["knowledge"]);
  assert.equal(r.requiresInvalidation, true);
  assert.ok(r.reason.includes("岗位卡胜"));
});

test("规格未定义的冲突对（台账×岗位卡）→ 拒，不发明优先级（§G 只定义两对）", () => {
  const r = resolveConflict({ faces: ["ledger", "role-card"] });
  assert.equal(r.ok, false);
  assert.equal(r.winner, null, "不得凭空择胜方");
  assert.ok(r.violations.some((v) => v.includes("spec-undefined-conflict")), "违例须标明「规格未定义」");
  assert.ok(r.violations.some((v) => v.includes("ledger×role-card")), "违例须点名未定义对");
});

test("三面同冲含未定义对 → 同样拒（不静默择一）", () => {
  for (const faces of [["knowledge", "ledger", "role-card"], ["role-card", "knowledge", "ledger"]]) {
    const r = resolveConflict({ faces });
    assert.equal(r.ok, false, JSON.stringify(faces));
    assert.equal(r.winner, null);
    assert.ok(r.violations.some((v) => v.includes("spec-undefined-conflict")));
  }
});

test("不是冲突的情形拒：单面 / 空 / 重复同面（不得把「自比」当冲突处理）", () => {
  for (const faces of [[], ["knowledge"], ["ledger", "ledger"], ["knowledge", "knowledge"]]) {
    const r = resolveConflict({ faces });
    assert.equal(r.ok, false, `${JSON.stringify(faces)} 应拒`);
    assert.ok(r.violations.length > 0);
  }
});

test("值域外面名一律拒（裁决表封闭）", () => {
  const r = resolveConflict({ faces: ["knowledge", "mail"] });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.includes("mail")));
});

test("裁决输入非对象 / faces 非数组 → 抛（fail closed）", () => {
  assert.throws(() => resolveConflict(null), /对象/);
  assert.throws(() => resolveConflict({ faces: "knowledge,ledger" }), /数组/);
});

// ===================== 缝⑥ 组织常量在配置面（V-A7.5 第三分句） =====================

test("记忆三层：岗位私有＝workspace 自由笔记；共享面无第三面；**组织常量在配置面**", () => {
  // 第三分句的机械落点：组织常量各有其**配置面**归属模块，且都不在运行时记忆面
  // （知识库根／台账）——不是「文档说说」。未落地者单列待办，不虚构坐标。
  const face = orgConstantFace();
  assert.deepEqual(face.entries.map((c) => c.kind).sort(), ["例程登记项", "岗位卡"].sort(),
    "已落地的组织常量须逐类有配置面坐标");
  for (const item of face.entries) {
    assert.equal(item.face, "config", `${item.kind} 须在配置面`);
    assert.ok(item.module.startsWith("lib/"), `归属模块须在仓库代码面：${item.module}`);
    assert.ok(!item.module.includes("knowledge"), `配置面不得落在知识库运行时目录：${item.module}`);
    assert.ok(Array.isArray(item.exports) && item.exports.length > 0, `${item.kind} 须点名其常量导出`);
  }
  // 评测集＝组织常量但尚未落地：归 12 号票（V-A7.4），此处只登记待办不装成已存在
  assert.deepEqual(face.pending.map((c) => c.kind), ["评测集"]);
  assert.equal(face.pending[0].ticket, "12");
});

test("组织常量导出确实存在：按坐标逐个解析（防坐标漂移成空指针）", async () => {
  for (const item of orgConstantFace().entries) {
    const mod = await import(`../${item.module}`);
    for (const name of item.exports) {
      assert.ok(name in mod, `${item.module} 缺导出 ${name}（组织常量坐标漂移）`);
    }
  }
});

// ===================== 缝⑤ 移交只传指针（V-A7.10） =====================

test("移交件＝三件指针：任务 id ＋ 工件坐标 ＋ 知识条目 id；模式恒为拉取", () => {
  const h = buildHandoff({
    taskId: "TK-2026-001",
    artifacts: [{ location: "artifacts/runs/x/out.json" }],
    knowledgeIds: ["R-2026-001"]
  });
  assert.equal(h.ok, true);
  assert.equal(h.mode, "pull", "接手方拉取式自取（不推送内容）");
  assert.equal(h.pointers.taskId, "TK-2026-001");
  assert.deepEqual(h.pointers.artifacts, ["artifacts/runs/x/out.json"]);
  assert.deepEqual(h.pointers.knowledgeIds, ["R-2026-001"]);
});

test("移交只传指针：坐标条目夹带正文（body/content/excerpt/summary）即拒（V-A7.10 不复制内容）", () => {
  for (const field of ["body", "content", "excerpt", "summary", "text"]) {
    const h = buildHandoff({
      taskId: "TK-1",
      artifacts: [{ location: "a/b.json", [field]: "……正文……" }],
      knowledgeIds: []
    });
    assert.equal(h.ok, false, `artifact 条目含 ${field} 应拒`);
    assert.ok(h.violations.some((v) => v.includes(field)), `违例须点名 ${field}`);
  }
});

test("移交只传指针：知识条目 id 不得以内联摘要数组形态夹带（只给 id）", () => {
  const h = buildHandoff({
    taskId: "TK-1",
    artifacts: [],
    knowledgeIds: [{ id: "R-2026-001", summary: "结论正文" }]
  });
  assert.equal(h.ok, false);
  assert.ok(h.violations.some((v) => v.includes("knowledgeIds")));
});

test("工件归档不删档、无保留期上限：夹带 retention/expiresAt/ttl 字段一律拒（V-A7.10）", () => {
  for (const field of ["retention", "retentionDays", "expiresAt", "ttlDays", "deleteAfter"]) {
    const h = buildHandoff({
      taskId: "TK-1",
      artifacts: [{ location: "a/b.json", [field]: 30 }],
      knowledgeIds: []
    });
    assert.equal(h.ok, false, `artifact 条目含 ${field} 应拒（无保留期上限）`);
  }
});

test("移交件单源形状：坐标条目键封闭为 location（不给格式之外的转述位）", () => {
  const h = buildHandoff({
    taskId: "TK-1",
    artifacts: [{ location: "a/b.json", format: "json" }],
    knowledgeIds: []
  });
  assert.equal(h.ok, false);
  assert.ok(h.violations.some((v) => v.includes("format")));
});

test("缺 taskId → 拒（任务 id 是指针根，无根不成移交）", () => {
  const h = buildHandoff({ artifacts: [{ location: "a/b.json" }], knowledgeIds: [] });
  assert.equal(h.ok, false);
  assert.ok(h.violations.some((v) => v.includes("taskId")));
});

test("移交输入非对象 → 抛（fail closed）", () => {
  assert.throws(() => buildHandoff(null), /对象/);
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  // 纯函数模块，无夹具清理
}
process.exit(failed > 0 ? 1 : 0);
