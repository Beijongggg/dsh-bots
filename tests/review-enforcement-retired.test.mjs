/**
 * v1 评审残余退役完整性扫描（org-v2 15 号票；规格 §I 迁移清单第 4 项）——
 * tests/review-enforcement-retired.test.mjs。
 * 判据：enforcement 矩阵形态随 v1 废弃后，仓库**活面**（lib/ scripts/ tests/）
 * 不得残留任何 review-enforcement 引用或文件；历史件（artifacts/archive、
 * docs/TEMP-guidance-*、PLAN、CHANGELOG、.scratch）只读保留、不在扫描范围。
 * sentinel 在用原语的迁移归宿＝lib/sentinel-shadow.js（行为等价由 sentinel 系
 * 既有测试把守，此处只扫退役完整性）。
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const results = [];
const test = (name, fn) => results.push([name, fn]);

test("退役两件＋矩阵测试不存在（文件级）", () => {
  for (const rel of [
    "lib/review-enforcement.js",
    "scripts/review-enforcement-probe.cjs",
    "tests/review-enforcement-matrix.test.mjs"
  ]) {
    assert.equal(existsSync(path.join(repoRoot, rel)), false, `${rel} 必须已退役`);
  }
});

test("活面零 review-enforcement 引用（lib/ scripts/ tests/ 逐文件扫描；本扫描器自排除）", () => {
  const offenders = [];
  const self = fileURLToPath(import.meta.url);
  const scan = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (name.isDirectory()) { scan(full); continue; }
      if (full === self) continue;
      if (!/\.(js|cjs|mjs)$/.test(name.name)) continue;
      const source = readFileSync(full, "utf8");
      if (source.includes("review-enforcement")) offenders.push(path.relative(repoRoot, full));
    }
  };
  for (const dir of ["lib", "scripts", "tests"]) scan(path.join(repoRoot, dir));
  assert.deepEqual(offenders, [], "活面不得残留 review-enforcement 引用");
});

test("回归入口不再装配矩阵测试（tests/ 无矩阵测试文件；本扫描器除外）", () => {
  const self = path.basename(fileURLToPath(import.meta.url));
  const names = readdirSync(path.join(repoRoot, "tests"))
    .filter((n) => n.startsWith("review-enforcement") && n !== self);
  assert.deepEqual(names, []);
});

// ---------------- 运行 ----------------
let failed = 0;
for (const [name, fn] of results) {
  try { await fn(); console.log("✓", name); }
  catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
}
process.exit(failed > 0 ? 1 : 0);
