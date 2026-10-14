/**
 * v2 词表扫描（org-v2 11 号票；规格 §E 与附录 A `V-A4.8`）。
 *
 * 「v2 词表**无 skill**、无运行时 skill 装载机制」的机械形态：
 *   1. **词表无 skill**：`lib/` 下生产代码（非注释行）不得出现 `skill` 记号
 *      （大小写不敏感）——bot 面词表（岗位卡／op-set／工具描述／提示段／客户端
 *      文案）里没有「技能」这个概念。中文对应词 `技能` 同判（同一词表的两种语言
 *      面：`lib/client.js` 是双语界面文案的落点）。v2 的对应物是**岗位卡 + op-set
 *      派生工具面**；
 *   2. **无运行时装载机制**：不得以**非字面说明符**动态 `import(...)`——运行时按
 *      名装载模块正是「运行时 skill 装载」的形态。字面说明符的动态 import
 *      （如 `await import("../mail-plane.js")`）不在此列：它在静态上可判、不是
 *      按名装载。
 *
 * 注释行豁免：设计说明里解释「本版无 skill」不构成词表成员（词表＝会被渲染进
 * 提示／工具描述／界面文案的字面）。扫描器自身不扫：其字面是**检测样本**。
 * 只读 walk；结论形状与 `scripts/preflight.mjs` 的 `namingLint` 同源
 * （`{ok, scanned, violations[]}`）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { isCommentLine, walkJs } from "./face-scan.js";

/** 词表禁记号：`skill` 与其中文对应词 `技能`（同一词表的两种语言面）。 */
export const SKILL_TOKENS = Object.freeze([/skill/i, /技能/]);

/** 本扫描器自身豁免（其字面为检测样本，非词表成员）。 */
export const VOCABULARY_SCAN_EXEMPT_MODULES = Object.freeze(["org/vocabulary-face.js"]);

/** 运行时按名装载形态：`import(` 后紧跟非引号（说明符是变量／表达式）。 */
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*(?!["'`])/;

/**
 * 扫 `repoRoot/lib`，返回 `{ok, scanned, violations[], hits[]}`：
 *   - `violations`＝一违例一行（`<repo 相对路径>: line <n> <记号> → …`）；
 *   - `hits`＝命中的文件（repo 相对路径，供账实核验；正例下应为空）。
 */
export function scanVocabularyFace(repoRoot) {
  const libDir = join(repoRoot, "lib");
  if (!existsSync(libDir)) {
    return { ok: false, scanned: 0, violations: [`lib/ 不存在：${libDir}`], hits: [] };
  }
  const exempt = new Set(VOCABULARY_SCAN_EXEMPT_MODULES);
  const violations = [];
  const hits = [];
  let scanned = 0;

  for (const file of walkJs(libDir)) {
    const relFromLib = relative(libDir, file).split(/[\\/]/).join("/");
    if (exempt.has(relFromLib)) continue;
    scanned += 1;
    const relFromRepo = `lib/${relFromLib}`;
    let flagged = false;
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      const trimmed = line.trim();
      if (isCommentLine(trimmed)) return;
      for (const token of SKILL_TOKENS) {
        const m = line.match(token);
        if (m) {
          flagged = true;
          violations.push(
            `${relFromRepo}: line ${String(index + 1)} 出现词表禁记号「${m[0]}」` +
            `→ v2 词表无 skill，对应物＝岗位卡＋op-set 派生工具面（V-A4.8）`
          );
          break;
        }
      }
      if (DYNAMIC_IMPORT_PATTERN.test(line)) {
        flagged = true;
        violations.push(
          `${relFromRepo}: line ${String(index + 1)} 非字面说明符的动态 import` +
          `→ 运行时按名装载模块即「运行时装载机制」形态（V-A4.8）；字面说明符不受限`
        );
      }
    });
    if (flagged) hits.push(relFromRepo);
  }
  return { ok: violations.length === 0, scanned, violations, hits: hits.sort() };
}
