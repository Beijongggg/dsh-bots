/**
 * 回归：bootstrap 锚点席位与双席起步编制（org-v2 13 号票；规格 §I、附录 A `V-A1.4`）。
 *
 * 判据坐标（三字段口径）：
 *   - 「建锚点函数建 v2 锚点席位」「空表重建目标＝v2 锚点」「损坏表移开分支保留」
 *     → 缝① `internals.bootstrapRegistry`（注册表自举写面，见本文件前两节）；
 *   - 「bootstrap 锚点席位不可删」「非空注册表必有锚点在场」
 *     → 缝② `BotsApi.remove`／`BotsApi.patch`（HTTP 面行为）；
 *   - 「双席（值班统筹＋实施者）就绪自举、其余岗位按需拉起」
 *     → 缝③ `role-cards.minimalRosterState`（编制契约纯函数）；
 *   - 「v1 专有注入与席位名硬编码删除」
 *     → 缝④ 源码扫描（lib/index.js 席位名字符串字面量清零、client.js 锚点判定走席位标记）。
 *
 * 只测公开行为：注册表文件读回、HTTP 面拒绝码、编制状态返回值、源码字面量——
 * 不摸私有函数、不 mock 内部实现。
 */
import assert from "node:assert/strict";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");
const { BotsApi, bootstrapRegistry, createBootstrapAnchor, readRegistry, writeRegistryAtomic } = internals;
const { BOOTSTRAP_ANCHOR_POST, MINIMAL_ROSTER_POSTS, ON_DEMAND_POSTS, STANDING_POST_SLUGS, minimalRosterState, isBootstrapAnchorSeat } =
  await import("../lib/org/role-cards.js");

const results = [];
const test = (name, fn) => results.push([name, fn]);

const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pod-anchor-"));
  homes.push(home);
  return home;
}
process.on("exit", () => { for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true }); });

function makeCtx() {
  return { logger: { info() {}, warn() {}, error() {}, debug() {} } };
}
function bot(overrides = {}) {
  return {
    id: "worker", name: "Worker", role: "coder", post: "",
    modelProvider: "", model: "", port: 3201, permission: "workspace-write",
    enabled: true, ...overrides
  };
}

// ---------- 缝① 注册表自举写面 ----------

test("空注册表自举：写入 v2 锚点席位（值班统筹／duty-coordinator／home 岗位绑定／3101）", () => {
  const home = mkHome();
  const registry = bootstrapRegistry(home, makeCtx().logger);

  const anchor = registry[BOOTSTRAP_ANCHOR_POST];
  assert.ok(anchor !== undefined, "空表自举必须建出 bootstrap 锚点席位");
  assert.equal(anchor.id, "duty-coordinator", "v2 语义 id＝锚点岗位 slug");
  assert.equal(anchor.name, "值班统筹", "显示名＝岗位卡显示名");
  assert.equal(anchor.post, "duty-coordinator", "锚点席位的 home 岗位绑定必须落表（04 号票 post 缝）");
  assert.equal(anchor.bootstrapAnchor, true, "席位身份＝bootstrap 锚点标记（不可删保护按标记判定）");
  assert.equal(anchor.port, 3101, "锚点席位固定占分配起点端口");
  assert.equal(anchor.permission, "read-only", "统筹岗不实施工件；实例基底档保持 v1 默认（用户裁定）");
  assert.equal(anchor.workspace, path.join(home, "pod-workspaces", "duty-coordinator"));
  assert.equal(Object.keys(registry).length, 1, "空表自举只建锚点席位（实施者等其余席位按需拉起）");

  assert.deepEqual(readRegistry(home), registry, "自举结果必须落盘（读回一致）");
});

test("空文件视同空表：同样写锚点席位", () => {
  const home = mkHome();
  fs.mkdirSync(path.join(home, "pod"), { recursive: true });
  fs.writeFileSync(path.join(home, "pod", "bots.json"), "");
  const registry = bootstrapRegistry(home, makeCtx().logger);
  assert.equal(registry[BOOTSTRAP_ANCHOR_POST]?.bootstrapAnchor, true);
  assert.equal(readRegistry(home)[BOOTSTRAP_ANCHOR_POST]?.bootstrapAnchor, true);
});

test("损坏表：重命名备份分支保留原样，重建目标是 v2 锚点", () => {
  const home = mkHome();
  fs.mkdirSync(path.join(home, "pod"), { recursive: true });
  fs.writeFileSync(path.join(home, "pod", "bots.json"), "{broken");
  const registry = bootstrapRegistry(home, makeCtx().logger);

  assert.equal(registry[BOOTSTRAP_ANCHOR_POST]?.bootstrapAnchor, true, "损坏表重建目标＝v2 锚点");
  const aside = fs.readdirSync(path.join(home, "pod")).find((n) => n.startsWith("bots.json.corrupt-"));
  assert.ok(aside !== undefined, "损坏表必须移开为 .corrupt-<ts> 备份（分支保留原样）");
  assert.equal(fs.readFileSync(path.join(home, "pod", aside), "utf8"), "{broken", "备份内容原样");
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, "pod", "bots.json"), "utf8"))[BOOTSTRAP_ANCHOR_POST].id, "duty-coordinator");
});

test("非空注册表：零触碰（不注入锚点、不重写文件）", () => {
  const home = mkHome();
  const existing = { worker: bot() };
  writeRegistryAtomic(home, existing);
  const before = fs.readFileSync(path.join(home, "pod", "bots.json"), "utf8");
  const registry = bootstrapRegistry(home, makeCtx().logger);

  assert.equal(registry[BOOTSTRAP_ANCHOR_POST], undefined, "非空表不新建席位（锚点只在整表空时自动出现）");
  assert.equal(fs.readFileSync(path.join(home, "pod", "bots.json"), "utf8"), before, "非空表自举不得改写注册表");
});

test("锚点席位记录：实例 id／显示名／home 岗位三者同源，权限档 read-only", () => {
  const home = mkHome();
  const anchor = createBootstrapAnchor(home, "2026-09-20T00:00:00.000Z");
  assert.deepEqual(
    { id: anchor.id, name: anchor.name, post: anchor.post, createdAt: anchor.createdAt, enabled: anchor.enabled },
    { id: BOOTSTRAP_ANCHOR_POST, name: "值班统筹", post: BOOTSTRAP_ANCHOR_POST, createdAt: "2026-09-20T00:00:00.000Z", enabled: true }
  );
  assert.equal(isBootstrapAnchorSeat(anchor), true, "锚点席位按标记判定");
  assert.equal(isBootstrapAnchorSeat(bot({ post: "duty-coordinator" })), false, "锚点是席位不是岗位特权：用户自建同岗席位不获不可删保护");
});

// ---------- 缝② HTTP 面锚点保护 ----------

test("bootstrap 锚点席位不可删（400），注册表保持在场", async () => {
  const home = mkHome();
  bootstrapRegistry(home, makeCtx().logger);
  const api = new BotsApi(makeCtx(), home);
  await assert.rejects(() => api.remove(BOOTSTRAP_ANCHOR_POST), /不可删除/);
  assert.equal(readRegistry(home)[BOOTSTRAP_ANCHOR_POST]?.bootstrapAnchor, true, "拒绝后锚点仍在场");
});

test("保护按席位标记判定，不按席位名字符串：用户自建席位（含 v1 旧名）可删；未知 id 404", async () => {
  const home = mkHome();
  bootstrapRegistry(home, makeCtx().logger);
  const registry = readRegistry(home);
  registry["duty-coordinator-2"] = bot({ id: "duty-coordinator-2", name: "第二统筹", post: "duty-coordinator", port: 3202 });
  registry.lead = bot({ id: "lead", name: "旧领队", port: 3203 });
  writeRegistryAtomic(home, registry);
  const api = new BotsApi(makeCtx(), home);

  await assert.rejects(() => api.remove("nonexistent"), /不存在/);
  assert.deepEqual(await api.remove("lead"), { deleted: true, id: "lead" }, "v1 旧名记录不享保护（保护不靠席位名字符串）");
  assert.deepEqual(await api.remove("duty-coordinator-2"), { deleted: true, id: "duty-coordinator-2" }, "用户自建同岗席位可删（锚点是席位不是岗位特权）");
  const after = readRegistry(home);
  assert.equal(after.lead, undefined);
  assert.equal(after["duty-coordinator-2"], undefined);
  assert.equal(after[BOOTSTRAP_ANCHOR_POST]?.bootstrapAnchor, true);
});

test("锚点席位 home 岗位不可改绑（400；含清空），改绑即等于拿掉锚点", async () => {
  const home = mkHome();
  bootstrapRegistry(home, makeCtx().logger);
  const api = new BotsApi(makeCtx(), home);

  await assert.rejects(() => api.patch(BOOTSTRAP_ANCHOR_POST, { post: "implementer" }), /不可改绑/);
  await assert.rejects(() => api.patch(BOOTSTRAP_ANCHOR_POST, { post: "" }), /不可改绑/);
  assert.equal(readRegistry(home)[BOOTSTRAP_ANCHOR_POST].post, "duty-coordinator", "拒绝后岗位绑定原样");
  // 原值重写（幂等）与其它字段变更不受影响
  const same = await api.patch(BOOTSTRAP_ANCHOR_POST, { post: BOOTSTRAP_ANCHOR_POST });
  assert.equal(same.bot.post, "duty-coordinator");
});

test("非锚点席位照旧可改绑 home 岗位", async () => {
  const home = mkHome();
  bootstrapRegistry(home, makeCtx().logger);
  const registry = readRegistry(home);
  registry.worker = bot();
  writeRegistryAtomic(home, registry);
  const api = new BotsApi(makeCtx(), home);
  const patched = await api.patch("worker", { post: "implementer" });
  assert.equal(patched.bot.post, "implementer");
});

// ---------- 缝③ 双席起步编制（编制契约） ----------

test("起步编制契约：锚点＋实施者双席，项目经理／研究员按需拉起，锚点岗在常设岗册内", () => {
  assert.equal(BOOTSTRAP_ANCHOR_POST, "duty-coordinator", "锚点＝值班统筹");
  assert.deepEqual([...MINIMAL_ROSTER_POSTS], ["duty-coordinator", "implementer"], "最小起步编制＝双席");
  assert.deepEqual([...ON_DEMAND_POSTS], ["project-lead", "researcher"], "其余岗位按需拉起");
  for (const post of [...MINIMAL_ROSTER_POSTS, ...ON_DEMAND_POSTS]) {
    assert.ok(STANDING_POST_SLUGS.includes(post), `${post} 必须在常设岗册内（可作实例 home 岗位）`);
  }
  assert.ok(!MINIMAL_ROSTER_POSTS.includes("verifier"), "复核者不入常驻编制（V-A1.3）");
});

test("编制状态纯函数：锚点席位（按标记）＋双席岗位齐备才算起步编制就绪，按需岗不影响", () => {
  const empty = minimalRosterState({});
  assert.deepEqual(empty, {
    anchorPresent: false, minimalComplete: false,
    missing: [...MINIMAL_ROSTER_POSTS], onDemandPresent: []
  });

  const anchorOnly = minimalRosterState({ [BOOTSTRAP_ANCHOR_POST]: createBootstrapAnchor(mkHome(), "2026-09-20T00:00:00.000Z") });
  assert.equal(anchorOnly.anchorPresent, true, "锚点席位在场（按席位标记判定）");
  assert.equal(anchorOnly.minimalComplete, false, "只有锚点＝未齐备（起步编制是双席）");
  assert.deepEqual(anchorOnly.missing, ["implementer"]);

  const twoSeats = {
    [BOOTSTRAP_ANCHOR_POST]: createBootstrapAnchor(mkHome(), "2026-09-20T00:00:00.000Z"),
    implementer: bot({ id: "implementer", post: "implementer", port: 3102 })
  };
  const ready = minimalRosterState(twoSeats);
  assert.equal(ready.minimalComplete, true, "值班统筹＋实施者双席＝起步编制齐备");
  assert.deepEqual(ready.missing, []);
  assert.equal(ready.anchorPresent, true);
  assert.deepEqual(ready.onDemandPresent, [], "起步编制齐备时按需岗仍未拉起");

  const withOnDemand = {
    ...twoSeats,
    "project-lead": bot({ id: "project-lead", post: "project-lead", port: 3103 }),
    researcher: bot({ id: "researcher", post: "researcher", port: 3104 })
  };
  const expanded = minimalRosterState(withOnDemand);
  assert.equal(expanded.minimalComplete, true, "按需岗不抬升起步编制门槛");
  assert.deepEqual(expanded.missing, []);
  assert.deepEqual(expanded.onDemandPresent, [...ON_DEMAND_POSTS], "按需岗只作实况回报");

  // 只有按需岗在场（无锚点、无实施者）＝未齐备：编制判定不认按需岗
  assert.equal(minimalRosterState({ "project-lead": bot({ id: "project-lead", post: "project-lead" }) }).minimalComplete, false);

  // 席位身份与岗位绑定分开判：用户自建的同岗席位补上岗位缺口，但**不是**锚点席位
  const userMadeDuty = minimalRosterState({
    "duty-coordinator-2": bot({ id: "duty-coordinator-2", post: "duty-coordinator" }),
    implementer: bot({ id: "implementer", post: "implementer" })
  });
  assert.deepEqual(userMadeDuty.missing, [], "岗位缺口由用户自建席位补上");
  assert.equal(userMadeDuty.anchorPresent, false, "同岗 ≠ 锚点席位（锚点是席位不是岗位特权）");
  assert.equal(userMadeDuty.minimalComplete, false, "无 bootstrap 锚点席位＝起步编制不齐备");
});

test("锚点席位判据两处实现等价（前端 bundle ↔ 合同源，漂移即红）", async () => {
  let captured = null;
  const previousWindow = globalThis.window;
  globalThis.window = { __ModuleLoader__: { load: (opts) => { captured = opts; } } };
  try {
    await import("../lib/client.js");
    const mod = captured.factory((id) => {
      if (id === "react") return { memo: (fn) => fn };
      if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
      throw new Error("unexpected require: " + id);
    });
    assert.equal(typeof mod.isAnchorSeat, "function", "前端锚点判据须可导出（等价性绑定的前提）");
    const table = [
      { label: "锚点席位记录", bot: { id: "duty-coordinator", post: "duty-coordinator", bootstrapAnchor: true } },
      { label: "用户自建同岗席位", bot: { id: "duty-coordinator-2", post: "duty-coordinator" } },
      { label: "v1 旧名记录", bot: { id: "lead", name: "领队", role: "统筹" } },
      { label: "普通席位", bot: { id: "worker", post: "implementer" } },
      { label: "空记录", bot: {} },
      { label: "缺记录", bot: undefined }
    ];
    for (const { label, bot: record } of table) {
      assert.equal(mod.isAnchorSeat(record), isBootstrapAnchorSeat(record),
        `两处锚点判据分叉（${label}）：前端 ${mod.isAnchorSeat(record)} vs 合同源 ${isBootstrapAnchorSeat(record)}`);
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
});

// ---------- 缝④ v1 席位名硬编码清零（源码扫描） ----------

test("lib/index.js：v1 内置席位标识符与字符串字面量清零，锚点走 v2 席位标记", () => {
  const src = readFileSync(new URL("../lib/index.js", import.meta.url), "utf8");
  assert.ok(!/\bLEAD_BOT_ID\b/.test(src), "残留 v1 内置席位常量 LEAD_BOT_ID");
  assert.ok(!/createLeadBot/.test(src), "残留 v1 建锚点函数 createLeadBot");
  assert.ok(!/"[^"\n]*领队[^"\n]*"/.test(src), "残留 v1 席位名字符串字面量（领队）");
  assert.ok(/bootstrapAnchor/.test(src), "锚点席位标记缺失");
});

test("lib/client.js：锚点席位判定走席位标记，v1 席位名与本地化键清零", () => {
  const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  assert.ok(!/lead\.notDeletable/.test(src), "残留 v1 本地化键 lead.notDeletable");
  assert.ok(!/\blead\b/i.test(src), "残留 v1 席位名／id 字面量（lead）");
  assert.ok(!/领队/.test(src), "残留 v1 席位名（领队）");
  assert.ok(/anchor\.notDeletable/.test(src), "锚点席位本地化键缺失");
  assert.ok(/function isAnchorSeat\(bot\)\s*\{[^}]*bot\.bootstrapAnchor === true/.test(src),
    "锚点席位判定未按席位标记（bootstrapAnchor === true）");
});

test("双席起步编制经公开面可起：自举得锚点席位 → create 建实施者席位 → 编制齐备", async () => {
  const home = mkHome();
  bootstrapRegistry(home, makeCtx().logger);
  const api = new BotsApi(makeCtx(), home);

  assert.equal(minimalRosterState(readRegistry(home)).minimalComplete, false, "自举后只有锚点席位");
  // create 走内置脚手架回退路径（临时 home、无 create-bot 脚本可用），不 spawn 进程
  const created = await api.create({ name: "实施者", post: "implementer", role: "承接执行" });
  assert.equal(created.bot.post, "implementer", "实施者席位的 home 岗位绑定落表（经 create 写入口）");
  assert.equal(created.bot.bootstrapAnchor, undefined, "用户建的席位不带锚点标记（锚点是席位不是岗位特权）");

  const roster = minimalRosterState(readRegistry(home));
  assert.equal(roster.anchorPresent, true);
  assert.deepEqual(roster.missing, []);
  assert.equal(roster.minimalComplete, true, "双席（值班统筹＋实施者）起即编制齐备");

  // 双席即可用的机械前提：两席的 home op 集非空且互不假装对方岗位
  const { availableOps } = await import("../lib/org/op-set.js");
  assert.ok(availableOps("duty-coordinator", null).includes("task.intake"));
  assert.ok(availableOps("implementer", null).includes("task.accept"));
});

let failed = 0;
for (const [name, fn] of results) {
  try {
    await fn();
    console.log("✓", name);
  } catch (error) {
    failed += 1;
    console.error("✗", name, "—", error.message);
  }
}
process.exit(failed > 0 ? 1 : 0);
