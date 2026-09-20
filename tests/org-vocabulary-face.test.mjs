/**
 * v2 词表扫描（org-v2 11 号票；规格 §E、附录 A `V-A4.8`）。
 *
 * 单一事实源：扫描函数在 `lib/org/vocabulary-face.js`，本模块只钉行为边界：
 *   - 「v2 词表无 skill」＝生产代码非注释行不得出现 `skill`／`技能` 记号；
 *   - 「无运行时 skill 装载机制」＝不得出现非字面说明符的动态 import；
 *   - 负例可辨：词表夹带与按名装载都能被抓出，注释说明不误报。
 *
 * 结构对齐 10／11 号票的其他扫描模块：正例扫真实仓库、负例在隔离临时仓库构造。
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SKILL_TOKENS, VOCABULARY_SCAN_EXEMPT_MODULES, scanVocabularyFace } from "../lib/org/vocabulary-face.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const repoRoot = join(import.meta.dirname, "..");

const roots = [];
function mkFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "dsh-bots-vocab-scan-"));
  roots.push(root);
  const lib = join(root, "lib");
  const org = join(lib, "org");
  mkdirSync(org, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    writeFileSync(join(lib, rel), body, "utf8");
  }
  return { root, lib };
}

test("真实仓库：v2 词表无 skill、无非字面动态 import（V-A4.8）", () => {
  const r = scanVocabularyFace(repoRoot);
  assert.deepEqual(r.violations, [], JSON.stringify(r.violations, null, 2));
  assert.deepEqual(r.hits, [], "无命中的词表成员");
  assert.ok(r.scanned > 0, "确有被扫文件");
});

test("禁用记号与豁免名单是冻结枚举", () => {
  assert.deepEqual(SKILL_TOKENS.map((re) => String(re)), ["/skill/i", "/技能/"]);
  assert.deepEqual(Array.from(VOCABULARY_SCAN_EXEMPT_MODULES), ["org/vocabulary-face.js"]);
});

test("负例可辨①：词表夹带 skill／技能（含界面文案）即违例，注释说明不误报", () => {
  const fx = mkFixture({
    "client-copy.js": "export const intro = \"each bot has role, model, and skills\";\n",
    "org/card.js": "export const line = \"每个机器人拥有独立的角色、模型与技能\";\n",
    "plain.js": "// 本版无 skill 概念（注释说明不构成词表成员）\n/** 技能：已退役 */\nexport const ok = 1;\n"
  });
  const r = scanVocabularyFace(fx.root);
  assert.deepEqual(r.hits, ["lib/client-copy.js", "lib/org/card.js"]);
  assert.equal(r.violations.length, 2);
  assert.match(r.violations[0], /skill/i);
  assert.match(r.violations[1], /技能/);
});

test("负例可辨②：非字面说明符的动态 import 即违例；字面说明符放行", () => {
  const fx = mkFixture({
    "loader.js": "export async function load(name) {\n  return import(name);\n}\n",
    "literal.js": "export async function load() {\n  return import(\"../mail-plane.js\");\n}\n"
  });
  const r = scanVocabularyFace(fx.root);
  assert.deepEqual(r.hits, ["lib/loader.js"]);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /非字面说明符/);
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
