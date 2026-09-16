/**
 * 回归入口：顺序执行 tests/*.test.mjs，任一失败即非零退出。
 * 用法：node tests/run.mjs（或 npm test）
 * 口径（卫生①）：测试文件用本文件 glob 逐个 spawn——**禁止改用
 * `node --test <目录>`**（目录参数语义不同，会扫入依赖/非本仓测试）。
 *
 * 跳过协议（org-v2 01 号票「存在性守卫假绿修法」）：依赖外部载体的测试文件
 * （如真实宿主包）在载体缺失时可打印一行「⤼ SKIP: <原因>」后以 0 退出——
 * 本入口把它**分列计数**进汇总行（`N/N 个测试文件通过（K SKIP：…）`），
 * 使 SKIP 在 preflight ① 的汇总行上与真 PASS 不再同形。跳过不改变退出码
 * （套件不耦合宿主安装状态的纪律不变）；真宿主面的存在性由 ④ 宿主契约门
 * 以三态探针把守。
 */
import { readdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

/** 跳过标记行前缀（单行、机器可检）：`⤼ SKIP: <原因>`。 */
export const SKIP_MARKER = "⤼ SKIP:";

/** 输出中是否含跳过标记（供本入口与 preflight ① 复用同一判定）。 */
export function declaresSkip(output) {
  return typeof output === "string" && output.split("\n").some((line) => line.startsWith(SKIP_MARKER));
}

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
  const skipped = [];
  for (const file of files) {
    console.log(`\n=== ${file} ===`);
    // stdout 管道捕获以检出跳过标记（逐文件缓冲后转发；stderr 保持直通）
    const result = spawnSync(process.execPath, [join(dir, file)], {
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.status !== 0) failed += 1;
    else if (declaresSkip(result.stdout ?? "")) skipped.push(file);
  }
  const summary = `${files.length - failed}/${files.length} 个测试文件通过`
    + (skipped.length > 0 ? `（${skipped.length} SKIP：${skipped.join("、")}）` : "");
  console.log(`\n${summary}`);
  process.exit(failed > 0 ? 1 : 0);
}
