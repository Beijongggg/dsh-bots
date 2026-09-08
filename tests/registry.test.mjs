/**
 * 回归：注册表读写 / 原子写 / id 与端口分配。
 * 覆盖批次③将触碰的写路径（writeRegistryAtomic / uniqueId / allocatePort）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-reg-"));
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
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-reg-"));
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

let failed = 0;
for (const [name, fn] of results) {
  try {
    fn();
    console.log("✓", name);
  } catch (error) {
    failed += 1;
    console.error("✗", name, "—", error.message);
  }
}
process.exit(failed > 0 ? 1 : 0);
