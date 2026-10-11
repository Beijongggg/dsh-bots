/**
 * 回归：注册表读写 / 原子写 / id 与端口分配。
 * 覆盖批次③将触碰的写路径（writeRegistryAtomic / uniqueId / allocatePort）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "pod-reg-"));
// exit 钩子清理临时目录（本文件有模块级 + 测试内两处 mkdtemp，数组收集）
const tmpDirs = [home];
process.on("exit", () => { for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true }); });
const results = [];
const test = (name, fn) => results.push([name, fn]);

test("原子写 + 读回 roundtrip", () => {
  const registry = { a: { id: "a", port: 3101 }, b: { id: "b", port: 3102 } };
  internals.writeRegistryAtomic(home, registry);
  assert.deepEqual(internals.readRegistry(home), registry);
  // 无临时文件残留
  const leftovers = fs.readdirSync(path.join(home, "bots")).filter((n) => n.endsWith(".tmp"));
  assert.equal(leftovers.length, 0, "不应残留 .tmp 文件");
});

test("缺失/空文件 → {}；损坏 JSON → 抛错（apply 侧负责移开重建）", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "pod-reg-"));
  tmpDirs.push(empty);
  assert.deepEqual(internals.readRegistry(empty), {});
  fs.mkdirSync(path.join(empty, "bots"), { recursive: true });
  fs.writeFileSync(path.join(empty, "bots", "bots.json"), "");
  assert.deepEqual(internals.readRegistry(empty), {});
  fs.writeFileSync(path.join(empty, "bots", "bots.json"), "{broken");
  assert.throws(() => internals.readRegistry(empty));
});

test("uniqueId：slug 冲突追加序号；纯中文名回退时间戳 id", () => {
  const registry = { coder: {}, "coder-2": {} };
  assert.equal(internals.uniqueId(registry, "Coder"), "coder-3");
  const fallback = internals.uniqueId(registry, "研究员");
  assert.match(fallback, /^bot-[a-z0-9]+$/);
});

test("allocatePort：跳过已占用端口，从 3101 起顺序分配", () => {
  const registry = { lead: { port: 3101 }, x: { port: 3103 } };
  assert.equal(internals.allocatePort(registry), 3102);
});

test("端口竞争防护语义：并发快照分配同端口后，重查需换端口", () => {
  // 模拟 create() 的防护：两个并发请求从同一快照都拿到 3102
  const snapshot = { lead: { port: 3101 } };
  const p1 = internals.allocatePort(snapshot);
  const p2 = internals.allocatePort(snapshot);
  assert.equal(p1, p2, "同一快照必然同端口（竞争窗口存在）");
  // 第一个写入后，第二个用 fresh 注册表重查 → 必须拿到不同端口
  const fresh = { lead: { port: 3101 }, first: { port: p1 } };
  const p2fresh = internals.allocatePort(fresh);
  assert.notEqual(p2fresh, p1, "fresh 重查应避开已占端口");
});

// ---------- 原型链在册旁路收口（37 号票 F3/R1：铺 39adf0b 的 hasRegisteredBot 口径） ----------
test("uniqueId：原型链名（constructor 等）不再被继承属性误判占用；slug 化天然排除 __proto__", () => {
  const registry = {}; // 无自身字段：constructor/toString 等命中原型链
  assert.equal(internals.uniqueId(registry, "Constructor"), "constructor", "原型链名＝可用 id（不在册）");
  assert.equal(internals.uniqueId(registry, "ToString"), "tostring");
  // slug 字符集 [a-z0-9-]：__proto__ 的下划线被清洗 → 产物恒不可能为 __proto__，
  // 不会以「赋值改原型」损坏注册表对象
  assert.equal(internals.uniqueId(registry, "__proto__"), "proto", "下划线被 slug 清洗");
  assert.equal(Object.getPrototypeOf(registry), Object.prototype, "uniqueId 不触碰注册表原型");
  const withOwn = { constructor: { id: "constructor" } };
  assert.equal(internals.uniqueId(withOwn, "Constructor"), "constructor-2", "真在册（自身字段）仍判占用");
});

test("管理面守卫：原型链名 id 一律 404，不再伪成功/伪放行", async () => {
  const guardHome = fs.mkdtempSync(path.join(os.tmpdir(), "pod-reg-"));
  tmpDirs.push(guardHome);
  const api = new internals.BotsApi({ logger: { warn() {}, info() {} } }, guardHome, null);
  internals.writeRegistryAtomic(guardHome, {
    alpha: { id: "alpha", name: "甲", port: 3101, permission: "workspace-write", readOnly: false, enabled: true }
  });
  assert.deepEqual(api.get("alpha").bot.id, "alpha", "在册实例不受影响（对照）");
  const ghosts = ["toString", "constructor", "hasOwnProperty", "__proto__", "valueOf"];
  for (const ghost of ghosts) {
    assert.throws(() => api.get(ghost), (e) => e.status === 404, `get(${ghost}) → 404`);
    assert.throws(() => api.inbox(ghost), (e) => e.status === 404, `inbox(${ghost}) → 404`);
    assert.throws(() => api.messages(ghost), (e) => e.status === 404, `messages(${ghost}) → 404`);
    assert.throws(() => api.send(ghost, { text: "x" }), (e) => e.status === 404, `send(${ghost}) → 404`);
    await assert.rejects(api.remove(ghost), (e) => e.status === 404, `remove(${ghost}) → 404（旧：伪 deleted:true）`);
    await assert.rejects(api.start(ghost), (e) => e.status === 404, `start(${ghost}) → 404`);
    await assert.rejects(api.stop(ghost), (e) => e.status === 404, `stop(${ghost}) → 404`);
    await assert.rejects(api.patch(ghost, { role: "x" }), (e) => e.status === 404, `patch(${ghost}) → 404`);
    await assert.rejects(api.stats(ghost), (e) => e.status === 404, `stats(${ghost}) → 404`);
  }
  assert.equal(internals.readRegistry(guardHome).alpha.id, "alpha", "守卫拒绝不触碰注册表");
});

test("detectBotInstance：原型链名不误判在册（env 路径）；真在册仍识别", () => {
  const prev = process.env.DSH_BOTS_BOT_ID;
  process.env.DSH_BOTS_BOT_ID = "constructor";
  try {
    const ctx = { logger: { warn() {} } };
    assert.equal(internals.detectBotInstance(ctx, { readRegistry: () => ({}) }), null,
      "空注册表上 constructor 命中原型链 ≠ 在册");
    assert.equal(
      internals.detectBotInstance(ctx, { readRegistry: () => ({ constructor: { id: "constructor" } }) }),
      "constructor",
      "自身字段命中（真在册）仍识别"
    );
  } finally {
    if (prev === undefined) delete process.env.DSH_BOTS_BOT_ID;
    else process.env.DSH_BOTS_BOT_ID = prev;
  }
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
