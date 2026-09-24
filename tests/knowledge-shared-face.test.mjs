/**
 * 记忆三层共享面直写扫描（org-v2 10 号票；规格 §G、附录 A `V-A7.5` +
 * `V-A4.5`）。
 *
 * 单一事实源：扫描函数在 `lib/org/knowledge-shared-face.js`，本模块只
 * 钉行为边界：
 *   - 「bot 不经命令面直写知识库共面文件」语义不变式：扫 `lib/*.js` 与
 *     `lib/org/` 下脚本全文，覆盖 JS/MJS/CJS 大小写变体，凡出现对 `knowledge/` 路径下报告/索引的写操作
 *     （writeFileSync / writeFileAtomic / appendFileSync / mkdir 等）且
 *     不在豁免单（仅 `lib/knowledge.js` 的 `registerReport` /
 *     `ensureKnowledgeBase` / `acquireIndexLock` 实现）即违例；
 *   - 「知识库容器协议进白名单、条目内容不属白名单」物理面＝文件系统
 *     路径扫描（字符串字面命中即认），不依赖语义分析；
 *   - 仅做事实观察与汇报，不动被扫面。
 *
 * 与 preflight ③的 `.scratch` 词表 lint 同结构——纯文件 walk + 串匹配 + 违例
 * 列表，本测试在隔离临时仓库里做正负例，端到端不触真实本仓库 `lib/`。
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const results = [];
const test = (name, fn) => results.push([name, fn]);

const { scanKnowledgeLayerFace, knowledgeFaceShape, scanKnowledgeRegisterWriters,
  KNOWLEDGE_WRITER_MODULES, SCAN_EXEMPT_MODULES, KNOWLEDGE_CONTAINER_ENTRIES,
  KNOWLEDGE_REGISTER_WRITER_MODULES } =
  await import("../lib/org/knowledge-shared-face.js");

// ---------- 夹具 ----------
const roots = [];
function mkFixture() {
  const root = mkdtempSync(join(tmpdir(), "dsh-bots-kl-scan-"));
  roots.push(root);
  const lib = join(root, "lib");
  const org = join(lib, "org");
  mkdirSync(org, { recursive: true });
  mkdirSync(join(root, "fake-home", "bots", "knowledge"), { recursive: true });
  return { root, lib, org };
}

/** 知识库根 fixture（建出空根；缺省已存在，测试可自行 rmSync 模拟未安装）。 */
function mkKnowledgeRoot() {
  const root = mkdtempSync(join(tmpdir(), "dsh-bots-kl-face-"));
  roots.push(root);
  return root;
}

/** 在 fixture 里写一个 lib 文件 + 一个 org 文件 */
function writeMod(modDir, rel, body) {
  const p = join(modDir, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
  return p;
}

// ---------- 缝①：洁净基线扫描（全绿） ----------
test("洁净 fixture：仅豁免单实现命中 → violations=[] 且 scanned>0", () => {
  const fx = mkFixture();
  // lib/knowledge.js 的 registerReport 是已登记的合法写者
  writeMod(fx.lib, "knowledge.js", [
    "import { writeFileAtomic } from './shared.cjs';",
    "const { writeFileSync } = require('node:fs');",
    "const dir = join(dshHome, 'bots', 'knowledge');",
    "writeFileAtomic(join(dir, 'reports', id + '.md'), body);",
    "ensureKnowledgeBase 内部用 mkdirSync 创根目录。"
  ].join("\n"));
  // 其他模块均无 knowledge 写者
  writeMod(fx.org, "human-inbox.js", "import { readFileSync } from 'node:fs'; const x = 1;");
  writeMod(fx.lib, "client.js", "export const y = 2;");
  const r = scanKnowledgeLayerFace(fx.root);
  assert.deepEqual(r.violations, []);
  assert.equal(r.scanned, 2, "scanned＝实扫文件数，不含豁免写者与扫描器自身");
  assert.deepEqual(r.knowledgeEntries, ["lib/knowledge.js"]);
});

// ---------- 缝②：违例写者：bot 直写索引（即便在 org/） ----------
test("org/bot-direct-write.js 直写 knowledge/index.jsonl → 违例具名行号", () => {
  const fx = mkFixture();
  writeMod(fx.lib, "knowledge.js", "// 仅豁免单干净基线\n");
  writeMod(fx.lib, "shared.cjs", "module.exports = {};");
  writeMod(fx.org, "bot-direct-write.js", [
    "import { writeFileSync } from 'node:fs';",
    "function updateIndex(dshHome) {",
    "  const path = join(dshHome, 'bots', 'knowledge', 'index.jsonl');",
    "  writeFileSync(path, 'injected');",
    "}"
  ].join("\n"));
  const r = scanKnowledgeLayerFace(fx.root);
  assert.equal(r.violations.length, 1);
  const v = r.violations[0];
  assert.match(v, /lib\/org\/bot-direct-write\.js/);
  assert.match(v, /line 4/);
  assert.match(v, /writeFileSync/);
  assert.match(v, /knowledge/, "违例报文须回显触发直写的路径表达式");
  assert.match(v, /豁免名单/, "违例报文须点名豁免单，便于人工判断是否误报");
});

// ---------- 缝③：违例写法 = append 套构 ----------
test("appendFileSync 到 knowledge/reports/ → 违例（任一写手段都不放过）", () => {
  const fx = mkFixture();
  writeMod(fx.lib, "knowledge.js", "// 干净豁免\n");
  writeMod(fx.lib, "shared.cjs", "module.exports = {};");
  writeMod(fx.org, "report-mutator.js", [
    "import { appendFileSync } from 'node:fs';",
    "export function appendReport(dshHome, id, line) {",
    "  appendFileSync(join(dshHome, 'bots', 'knowledge', 'reports', id + '.md'), line);",
    "}"
  ].join("\n"));
  const r = scanKnowledgeLayerFace(fx.root);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /report-mutator\.js/);
  assert.match(r.violations[0], /appendFileSync/);
});

// ---------- 缝④：豁免单是静态认定的「模块名单」，不是路径字面量 ----------
test("豁免仅按模块文件名 `knowledge.js` 认路径；同名模块在其他目录不豁免", () => {
  const fx = mkFixture();
  writeMod(fx.lib, "knowledge.js", "// 豁免\n");
  writeMod(fx.lib, "shared.cjs", "module.exports = {};");
  mkdirSync(join(fx.org, "vendor"), { recursive: true });
  writeMod(join(fx.root, "lib", "org", "vendor"), "knowledge.js", [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync(join(dshHome, 'bots', 'knowledge', 'index.jsonl'), 'x');"
  ].join("\n"));
  const r = scanKnowledgeLayerFace(fx.root);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /lib\/org\/vendor\/knowledge\.js/);
});

// ---------- 缝⑤：知识库唯一合法写者名单登记在扫描器具名常量 ----------
test("豁免名单是冻结具名常量（扩缩须显式落档）；字面路径形态也回显于违例报文", () => {
  // 防止豁免名单静默扩缩：本测试钉常量字面稳定。
  // 新增合法写者必须显式改常量 + 在票面/CHANGELOG 落档。
  assert.deepEqual(Array.from(KNOWLEDGE_WRITER_MODULES), ["knowledge.js"]);
  assert.deepEqual(Array.from(SCAN_EXEMPT_MODULES), ["org/knowledge-shared-face.js"]);

  // 字面路径形态（而非段列拼接）同样被认，且报文回显该字面
  const fx = mkFixture();
  writeMod(fx.lib, "knowledge.js", "// 豁免\n");
  writeMod(fx.lib, "shared.cjs", "module.exports = {};");
  writeMod(fx.org, "literal-path-writer.js", [
    "import { writeFileSync } from 'node:fs';",
    "export function poke(dshHome) {",
    "  writeFileSync(dshHome + '/bots/knowledge/index.jsonl', 'x');",
    "}"
  ].join("\n"));
  const r = scanKnowledgeLayerFace(fx.root);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /knowledge\/index\.jsonl/, "字面路径形态回显");
  assert.match(r.violations[0], /literal-path-writer\.js/);
});

test("破坏型直写同样被抓：rmSync／unlinkSync／renameSync 命中即违例（不能只管 write*）", () => {
  for (const [op, line] of [
    ["rmSync", "  rmSync(join(dshHome, 'bots', 'knowledge', 'reports'), { recursive: true });"],
    ["unlinkSync", "  unlinkSync(join(dshHome, 'bots', 'knowledge', 'index.jsonl'));"],
    ["renameSync", "  renameSync(src, join(dshHome, 'bots', 'knowledge', 'index.jsonl'));"]
  ]) {
    const fx = mkFixture();
    writeMod(fx.lib, "knowledge.js", "// 豁免\n");
    writeMod(fx.lib, "shared.cjs", "module.exports = {};");
    writeMod(fx.org, `destroyer-${op}.js`, [
      "import { rmSync, unlinkSync, renameSync } from 'node:fs';",
      "export function go(dshHome) {",
      line,
      "}"
    ].join("\n"));
    const r = scanKnowledgeLayerFace(fx.root);
    assert.equal(r.violations.length, 1, `${op} 应被抓出：${JSON.stringify(r.violations)}`);
    assert.match(r.violations[0], new RegExp(op));
  }
});

test("容器协议四件单源：KNOWLEDGE_CONTAINER_ENTRIES 由 lib/knowledge.js 路径助手派生（改助手名即跟动）", async () => {
  const { indexFile, reportsDirFor, templateFileFor } = await import("../lib/knowledge.js");
  const { basename } = await import("node:path");
  assert.deepEqual(Array.from(KNOWLEDGE_CONTAINER_ENTRIES), [
    basename(indexFile("")), basename(reportsDirFor("")), basename(templateFileFor("")), ".lock"
  ], "枚举须与容器协议实现的路径同名（派生态，非另抄一份）");
});

// ---------- 缝⑥：扫描器对真实本仓库跑一次（防回归） ----------
test("真实本仓库扫描：当前 violations=[]（验收 V-A4.5）", () => {
  const repoRoot = join(import.meta.dirname, "..");
  const r = scanKnowledgeLayerFace(repoRoot);
  assert.deepEqual(r.violations, [],
    "真实仓库出现 knowledge 直写即违例：" + JSON.stringify(r.violations, null, 2));
  assert.ok(r.scanned > 0);
});

// ---------- 缝⑦：共享侧「无第三面」＝知识库根顶层级条目封闭枚举（V-A7.5） ----------
test("知识库根：容器协议四件（index.jsonl／reports／REPORT_TEMPLATE.md／.lock）为合法顶层级", () => {
  const root = mkKnowledgeRoot();
  mkdirSync(join(root, "reports"), { recursive: true });
  mkdirSync(join(root, ".lock"), { recursive: true });
  writeFileSync(join(root, "index.jsonl"), "");
  writeFileSync(join(root, "REPORT_TEMPLATE.md"), "# t\n");
  const r = knowledgeFaceShape(root);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.entries.sort(), [".lock", "REPORT_TEMPLATE.md", "index.jsonl", "reports"]);
});

test("知识库根：长出第三面（team-memory.jsonl／notes/／memory/）即违例并具名（V-A7.5 共享侧无第三面）", () => {
  const root = mkKnowledgeRoot();
  writeFileSync(join(root, "index.jsonl"), "");
  writeFileSync(join(root, "team-memory.jsonl"), "{}\n");
  mkdirSync(join(root, "notes"), { recursive: true });
  const r = knowledgeFaceShape(root);
  assert.equal(r.violations.length, 2);
  assert.ok(r.violations.some((v) => v.includes("team-memory.jsonl")), "点名副面文件");
  assert.ok(r.violations.some((v) => v.includes("notes")), "点名副面目录");
  assert.ok(r.violations.every((v) => v.includes("第三面") || v.includes("顶层级")),
    "报文须说明违例性质（顶层级非容器协议件）");
});

test("知识库根不存在 → 不是违例（尚未安装），但报告 exists=false", () => {
  const base = mkKnowledgeRoot();
  const root = join(base, "knowledge-never-installed");
  const r = knowledgeFaceShape(root);
  assert.deepEqual(r.violations, []);
  assert.equal(r.exists, false);
});

test("knowledgeFaceShape 只读：扫描未安装的知识库根不得创建它", () => {
  const base = mkKnowledgeRoot();
  const root = join(base, "knowledge-never-installed");
  knowledgeFaceShape(root);
  assert.equal(existsSync(root), false, "扫描不得创建知识库根（安装归 ensureKnowledgeBase）");
});

// ---------- 缝⑧：登记写者名单闭合（V-A4.5 命令化后的形态） ----------
test("登记写者名单闭合：登记与废弃调用者只有 lib/index.js，新增即违例", () => {
  const repoRoot = join(import.meta.dirname, "..");
  const r = scanKnowledgeRegisterWriters(repoRoot);
  assert.deepEqual(r.violations, [], JSON.stringify(r.violations, null, 2));
  assert.deepEqual(Array.from(KNOWLEDGE_REGISTER_WRITER_MODULES), ["index.js"]);
  assert.ok(r.callers.includes("lib/index.js"), "host 装配面是唯一调用者");
});

test("bot 侧注册面不得直写：registerKnowledgeTools / registerOrgTools 函数体内无登记或废弃调用", () => {
  const repoRoot = join(import.meta.dirname, "..");
  const r = scanKnowledgeRegisterWriters(repoRoot);
  assert.deepEqual(r.botSideWriters, [], "bot 实例侧注册面出现登记或废弃调用＝直写通道复活");
});

test("登记写者扫描是负例可辨的：违规调用者（新模块）被抓出", () => {
  const fx = mkFixture();
  writeMod(fx.lib, "knowledge.js", "export function registerReport() {}\n");
  writeMod(fx.lib, "shared.cjs", "module.exports = {};");
  writeMod(fx.lib, "index.js", "const r = registerReport({});\n");
  writeMod(fx.org, "rogue-writer.js", "export function go() { return registerReport({ dshHome }); }\n");
  const r = scanKnowledgeRegisterWriters(fx.root);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /rogue-writer\.js/);
  assert.match(r.violations[0], /登记写者名单/);
});

test("废弃写者负例：deprecateReport 与 registerReport 共用 host 名单，定义不算调用", () => {
  const fx = mkFixture();
  writeMod(fx.lib, "knowledge.js", "export function registerReport() {}\nexport function deprecateReport() {}\n");
  writeMod(fx.lib, "index.js", "const r = deprecateReport({});\n");
  writeMod(fx.org, "rogue-deprecate.js", "export function go() { return deprecateReport({ dshHome }); }\n");
  const r = scanKnowledgeRegisterWriters(fx.root);
  assert.deepEqual(r.callers, ["lib/index.js", "lib/org/rogue-deprecate.js"]);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /rogue-deprecate\.js.*deprecateReport.*登记写者名单/);
  assert.match(r.violations[0], /knowledge\.deprecate/);
});

test("bot 侧注册面零直写：两个注册函数都拒绝登记与废弃调用", () => {
  for (const fn of ["registerKnowledgeTools", "registerOrgTools"]) {
    for (const writer of ["registerReport", "deprecateReport"]) {
      const fx = mkFixture();
      writeMod(fx.lib, "index.js", `function ${fn}() {\n  ${writer}({});\n}\n`);
      const r = scanKnowledgeRegisterWriters(fx.root);
      assert.equal(r.botSideWriters.length, 1, `${fn} 中的 ${writer} 应被拒绝`);
      assert.match(r.botSideWriters[0], new RegExp(`${fn}.*${writer}`));
      assert.deepEqual(r.violations, r.botSideWriters);
    }
  }
});

test("扫描面覆盖 JS/MJS/CJS 大小写变体：文件直写与命令写者均不可漏扫", () => {
  for (const ext of ["js", "mjs", "cjs", "JS", "MJS", "CJS", "mJs"]) {
    const fx = mkFixture();
    writeMod(fx.org, `rogue.${ext}`, [
      "deprecateReport({});",
      "writeFileSync(join(home, 'bots', 'knowledge', 'index.jsonl'), 'x');"
    ].join("\n"));
    writeMod(fx.org, "notes.txt", "registerReport({});");
    const layer = scanKnowledgeLayerFace(fx.root);
    assert.equal(layer.scanned, 1, `${ext} 应计入扫描，文本文件不扫描`);
    assert.equal(layer.violations.length, 1, `${ext} 文件直写应被拒绝`);
    const writers = scanKnowledgeRegisterWriters(fx.root);
    assert.deepEqual(writers.callers, [`lib/org/rogue.${ext}`]);
    assert.equal(writers.violations.length, 1, `${ext} 命令写者应被拒绝`);
  }
});

test("目录符号链接：跟随外部目录，祖先环与重复目录只扫描一次", () => {
  const fx = mkFixture();
  const external = join(fx.root, "external");
  writeMod(external, "rogue.mjs", "deprecateReport({});\n");
  symlinkSync(external, join(fx.lib, "linked"), "dir");
  symlinkSync(external, join(fx.lib, "linked-again"), "dir");
  symlinkSync(fx.lib, join(external, "back"), "dir");
  const scanUrl = new URL("../lib/org/knowledge-shared-face.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { scanKnowledgeRegisterWriters } from ${JSON.stringify(scanUrl)};
    console.log(JSON.stringify(scanKnowledgeRegisterWriters(process.argv[1])));
  `, fx.root], { encoding: "utf8", timeout: 5000 });
  assert.equal(child.status, 0, child.error?.message ?? child.stderr);
  const r = JSON.parse(child.stdout);
  assert.deepEqual(r.callers, ["lib/linked/rogue.mjs"]);
  assert.equal(r.violations.length, 1);
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
