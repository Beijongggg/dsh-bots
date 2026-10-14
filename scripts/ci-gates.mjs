/**
 * CI／本地轻量门：preflight ②③ 两门（retro2 导航批接线）。
 *
 * ④门（宿主契约探针）依赖真实安装宿主，不在 CI 跑；①门全量回归由
 * `TMPDIR=/dev/shm node tests/run.mjs` 直接承担。本脚本只做不依赖真实
 * 运行面的机械校验：冻结面 sha 复验＋知识库写者/日志结构/命名/
 * 代码地图覆盖/恒真断言/session-log 名域限 lint。
 */
import { repositoryLint, lintSummary, latestPackage, verifyFrozenFace } from "./preflight.mjs";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
let pass = true;

const pkg = latestPackage(join(repoRoot, "artifacts", "packages"));
if (!pkg) {
  console.error("ci-gates ②冻结面: FAIL（artifacts/packages/ 下无证据包）");
  pass = false;
} else {
  const r = verifyFrozenFace(pkg.path, repoRoot);
  if (r.ok === r.total && r.total > 0) {
    console.log(`ci-gates ②冻结面（${String(pkg.seq).padStart(4, "0")} 包）: ${r.ok}/${r.total} ✅`);
  } else {
    console.error(`ci-gates ②冻结面（${String(pkg.seq).padStart(4, "0")} 包）: ${r.ok}/${r.total} ❌`);
    for (const f of r.failures) console.error(`  - ${f}`);
    pass = false;
  }
}

const lint = repositoryLint(repoRoot);
if (lint.violations.length === 0) {
  console.log(`ci-gates ③repository-lint: 0 违例（${lintSummary(lint)}） ✅`);
} else {
  console.error(`ci-gates ③repository-lint: ${lint.violations.length} 违例 ❌`);
  for (const v of lint.violations) console.error(`  - ${v}`);
  pass = false;
}

console.log(`ci-gates: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
