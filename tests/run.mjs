/**
 * 回归入口：顺序执行 tests/*.test.mjs，任一失败即非零退出。
 * 用法：node tests/run.mjs（或 npm test）
 * 口径（卫生①）：测试文件用本文件 glob 逐个 spawn——**禁止改用
 * `node --test <目录>`**（目录参数语义不同，会扫入依赖/非本仓测试）。
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((n) => n.endsWith(".test.mjs")).sort();
if (files.length === 0) {
  console.error("没有找到测试文件");
  process.exit(1);
}
let failed = 0;
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const result = spawnSync(process.execPath, [join(dir, file)], { stdio: "inherit" });
  if (result.status !== 0) failed += 1;
}
console.log(`\n${files.length - failed}/${files.length} 个测试文件通过`);
process.exit(failed > 0 ? 1 : 0);
