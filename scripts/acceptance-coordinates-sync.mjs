/**
 * 规格附录 A 坐标回写／漂移校验（org-v2 14 号票；规格 Testing Decisions「坐标齐备度」
 * 与附录 A 的通则「执行坐标可标『待实现批补齐』；切换批前置判据含『A 组坐标无空缺』」）。
 *
 * 坐标的**唯一机械源**＝`lib/org/acceptance-coordinates.js` 的 `A_GROUP_COORDINATES`；
 * 规格附录 A 是判据语义的唯一权威。两边靠本脚本对齐：把坐标表的执行坐标／级别
 * 单元格逐行写回规格表（判据文本与证据列不动），无 `--write` 时只读核对。
 * 同理的既有形态＝`scripts/role-card-drift-check.mjs`（卡＝唯一源、派生物固化＋漂移即红）。
 *
 * 门内落点＝**全量回归门**（不新起第五道门）：`tests/org-acceptance-coordinates.test.mjs`
 * 以子进程调用本脚本取退出码（真规格干跑＝0；漂移副本＝1；副本 `--write` 回写到位；
 * 缺参＝1），故坐标漂移随每批回归执行；漂移即非零退出（fail closed）。
 *
 * 用法：
 *   node scripts/acceptance-coordinates-sync.mjs                    # 核对真规格（漂移即非零退出）
 *   node scripts/acceptance-coordinates-sync.mjs --write            # 回写真规格附录 A 坐标列
 *   node scripts/acceptance-coordinates-sync.mjs --spec <path>      # 对**规格副本**核对／回写（负例测试用）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SPEC_PATH } from "../lib/org/durability.js";
import {
  A_GROUP_COORDINATES,
  rewriteAppendixA,
  scanAcceptanceSpec,
  validateAcceptanceCoordinates
} from "../lib/org/acceptance-coordinates.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 规格件绝对路径。 */
export function specFile(repoRootOverride = repoRoot) {
  return join(repoRootOverride, SPEC_PATH);
}

/**
 * 校验（可回写）。`only`＝只回写点名的判据 id（缺省回写全表；负例测试用）。
 * 返回 `{ok, wrote, output[]}`：`ok:false` 即结论为漂移（退出码 1）。
 */
export function runAcceptanceSync({ repoRoot: root = repoRoot, specPath = null, write = false } = {}) {
  const path = specPath ?? specFile(root);
  const specText = readFileSync(path, "utf8");
  const validated = validateAcceptanceCoordinates({ repoRoot: root });
  if (!validated.ok) {
    return {
      ok: false, wrote: false, scanned: validated.scanned, violations: validated.violations,
      output: [
        `acceptance-coordinates: FAIL（坐标表自校验 ${validated.violations.length} 项）`,
        ...validated.violations.map((line) => `  - ${line}`)
      ]
    };
  }
  const before = scanAcceptanceSpec(specText);
  if (!write) {
    return {
      ok: before.ok, wrote: false, scanned: before.scanned, violations: before.violations,
      output: before.ok
        ? [`acceptance-coordinates: OK（${before.scanned}/${A_GROUP_COORDINATES.length} 坐标与规格附录 A 同拍）`]
        : [
          `acceptance-coordinates: FAIL（${before.violations.length} 项坐标漂移）`,
          ...before.violations.map((line) => `  - ${line}`)
        ]
    };
  }
  const rewritten = rewriteAppendixA(specText, A_GROUP_COORDINATES);
  const after = scanAcceptanceSpec(rewritten);
  if (rewritten !== specText) writeFileSync(path, rewritten);
  return {
    ok: after.ok, wrote: rewritten !== specText, scanned: after.scanned, violations: after.violations,
    output: after.ok
      ? [`acceptance-coordinates: 回写完成（${after.scanned}/${A_GROUP_COORDINATES.length} 坐标与规格附录 A 同拍；规格${rewritten === specText ? "已同拍、零改动" : "已回写"}）`]
      : [
        `acceptance-coordinates: 回写后仍漂移（${after.violations.length} 项）`,
        ...after.violations.map((line) => `  - ${line}`)
      ]
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const argv = process.argv.slice(2);
  const specIdx = argv.indexOf("--spec");
  // `--spec <path>`：负例测试与外部核对用（对**临时规格副本**跑漂移／回写，不碰真规格）
  const specPath = specIdx >= 0 ? String(argv[specIdx + 1] ?? "") : null;
  if (specIdx >= 0 && specPath === "") {
    console.log("acceptance-coordinates: FAIL（--spec 缺路径参数）");
    process.exit(1);
  }
  const result = runAcceptanceSync({ write: argv.includes("--write"), specPath });
  for (const line of result.output) console.log(line);
  process.exit(result.ok ? 0 : 1);
}
