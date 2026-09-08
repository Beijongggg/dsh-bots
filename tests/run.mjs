/**
 * 回归入口：顺序执行 tests/*.test.mjs，任一失败即非零退出。
 * 用法：node tests/run.mjs（或 npm test）
 * 口径（卫生①）：测试文件用本文件 glob 逐个 spawn——**禁止改用
 * `node --test <目录>`**（目录参数语义不同，会扫入依赖/非本仓测试）。
 */
import { readdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

/**
 * 探测给定目录（默认 os.tmpdir()）可写性：写删一个探测文件，任何失败
 * （EROFS/EACCES 等）视为不可写，返回一行定向提示；可写返回 null。
 * 只读 /tmp 下测试会成片 EROFS，属环境问题非产品缺陷（复现条件见
 * docs/PROJECT_UNDERSTANDING.md）。
 */
export function tmpdirHint(target = tmpdir()) {
  const probe = join(target, `.dsh-bots-tmpdir-probe-${process.pid}`);
  try {
    writeFileSync(probe, "");
    rmSync(probe);
    return null;
  } catch {
    return `⚠ tmpdir（${target}）不可写：测试套件依赖可写 TMPDIR，` +
      `请改用 TMPDIR=/dev/shm npm test（复现条件见 docs/PROJECT_UNDERSTANDING.md）`;
  }
}

// 入口守护：被 import（如测试文件）时只暴露 tmpdirHint，不执行主流程，
// 否则测试导入即递归 spawn 全部测试。
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const hint = tmpdirHint();
  if (hint) console.error(hint + "\n");

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
}
