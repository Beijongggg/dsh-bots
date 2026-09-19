/**
 * 记忆层共享面直写扫描（org-v2 10 号票；规格 §G、附录 A `V-A7.5` +
 * `V-A4.5`）。
 *
 * 语义（`V-A4.5`「knowledge 登记命令化；读取面照旧」＋§G「共享面零直写」）：
 * bot 侧不得出现**经由代码路径直写知识库共面**的写者。唯一合法写者＝
 * `lib/knowledge.js`（`registerReport` / `ensureKnowledgeBase` /
 * `acquireIndexLock` 实现；`lib/index.js` 的 `registerKnowledgeTools` 只
 * 调用其命令面，本身不写盘）。读侧（`readIndex` / `searchIndex` /
 * `readFileSync(templateFileFor(...))`）不受限。
 *
 * 判定（纯词法，不作 AST 分析）：
 *   1. **触达**（touch）＝本文件出现知识库路径表达式——`join(home, "bots",
 *      "knowledge")` 段列、字面 `bots/knowledge`、字面
 *      `knowledge/reports`／`knowledge/index.jsonl`／`REPORT_TEMPLATE.md`，
 *      或路径助手调用 `knowledgeDir(`／`indexFile(`／`reportsDirFor(`／
 *      `templateFileFor(`；
 *   2. **写者调用**（write call）＝`WRITE_OPS` 名单内的调用形态 `op(`（裸
 *      标识符不算——import/解构清单须排除），注释行不算；
 *   3. 两者**行距 ≤ `PROXIMITY_LINES`**（同一语句跨行形态，如先算路径再写）
 *     即判违例，报最小写者行号。
 *
 * 豁免单（`KNOWLEDGE_WRITER_MODULES`）＝按 **lib/ 下相对路径** 认，不按
 * basename——`lib/org/vendor/knowledge.js` 不豁免。扫描器自身
 * （`SCAN_EXEMPT_MODULES`）不扫：其字面量是**检测样本**不是写者意图（该
 * 名单同样冻结枚举、扩缩须落档）。
 *
 * 只读 walk，不动被扫面；结论形状与 `scripts/preflight.mjs` 的 `statusLint`
 * 同源（`{scanned, violations[]}`，另附 `knowledgeEntries` 供账实核验）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

import { indexFile, reportsDirFor, templateFileFor } from "../knowledge.js";

/**
 * 知识库共面唯一合法写者模块名单（**lib/ 下相对路径**，冻结枚举；扩缩须显式
 * 落档于 CHANGELOG 与票面）。
 */
export const KNOWLEDGE_WRITER_MODULES = Object.freeze(["knowledge.js"]);

/**
 * 扫描器自身豁免（其字面为检测样本，非写者意图；同样冻结枚举）。
 */
export const SCAN_EXEMPT_MODULES = Object.freeze(["org/knowledge-shared-face.js"]);

/**
 * 写者调用名单（须以 `op(` 调用形态命中）：**增改与破坏两类都收**——只管
 * `write*` 会让 `rmSync`／`unlinkSync`／`renameSync` 这类破坏型直写静默绕过
 * （删除报告与「原地覆盖」在共面纪律上是同等性质的动作）。
 */
const WRITE_OPS = Object.freeze([
  "writeFileSync", "writeFileAtomic", "appendFileSync", "createWriteStream",
  "mkdirSync", "rmSync", "rmdirSync", "unlinkSync", "renameSync", "copyFileSync", "truncateSync"
]);

/** 触达判据：知识库路径表达式的词法形态（任一命中即「触达」）。 */
const TOUCH_PATTERNS = Object.freeze([
  /['"`]bots['"`]\s*,\s*['"`]knowledge['"`]/,          // join(home, "bots", "knowledge")
  /bots[\/\\]knowledge/,                                 // 字面路径
  /knowledge[\/\\](?:reports|index\.jsonl|REPORT_TEMPLATE\.md)/, // 字面路径
  /\bknowledgeDir\s*\(/,
  /\bindexFile\s*\(/,
  /\breportsDirFor\s*\(/,
  /\btemplateFileFor\s*\(/
]);

/** 触达行与写者行判为同一临界区的最大行距（跨行语句：先算路径再写）。 */
const PROXIMITY_LINES = 5;

/** 行是否落在注释内（`//`、块注释续行 `*`、`/*`）。 */
function isCommentLine(trimmed) {
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/**
 * 扫 `repoRoot/lib` 下全部 js 文件（含 `lib/org/` 嵌套），返回
 * `{ok, scanned, violations[], knowledgeEntries[]}`：
 *   - `violations`＝一违例一行（`<repo 相对路径>: line <n> <op> → 直写知识库共面（豁免：…）`）；
 *   - `knowledgeEntries`＝实际命中的合法写者文件（repo 相对路径，供账实核验）。
 */
export function scanKnowledgeLayerFace(repoRoot) {
  const libDir = join(repoRoot, "lib");
  if (!existsSync(libDir)) {
    return { ok: false, scanned: 0, violations: [`lib/ 不存在：${libDir}`], knowledgeEntries: [] };
  }
  const writerSet = new Set(KNOWLEDGE_WRITER_MODULES);
  const exemptSet = new Set(SCAN_EXEMPT_MODULES);
  const knownWriters = [];
  const violations = [];
  let scanned = 0;

  for (const file of walkJs(libDir)) {
    const relFromLib = relative(libDir, file).split(/[\\/]/).join("/");
    const relFromRepo = `lib/${relFromLib}`;
    if (writerSet.has(relFromLib)) {
      knownWriters.push(relFromRepo);
      continue;
    }
    if (exemptSet.has(relFromLib)) continue;
    scanned += 1;

    const lines = readFileSync(file, "utf8").split("\n");
    const touchLines = [];
    const writeLines = [];
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (isCommentLine(trimmed)) return;
      for (const re of TOUCH_PATTERNS) {
        const m = line.match(re);
        if (m) touchLines.push({ index, token: m[0] }); // 全部形态入列（回显取最长者＝信息量最大）
      }
      for (const op of WRITE_OPS) {
        if (line.includes(`${op}(`)) { writeLines.push({ index, op }); break; }
      }
    });
    if (touchLines.length === 0 || writeLines.length === 0) continue;

    const hit = writeLines.find((w) => touchLines.some((t) => Math.abs(t.index - w.index) <= PROXIMITY_LINES));
    if (hit) {
      const inWindow = touchLines.filter((t) => Math.abs(t.index - hit.index) <= PROXIMITY_LINES);
      // 回显取「行距最近、同距取最长」的路径表达式（信息量最大者）
      const touch = inWindow.sort((a, b) =>
        (Math.abs(a.index - hit.index) - Math.abs(b.index - hit.index)) || (b.token.length - a.token.length)
      )[0];
      violations.push(
        `${relFromRepo}: line ${String(hit.index + 1)} ${hit.op} → 直写知识库共面` +
        `（路径表达式 ${touch.token}；豁免名单：${Array.from(writerSet).join("、") || "（空）"}）`
      );
    }
  }
  return { ok: violations.length === 0, scanned, violations, knowledgeEntries: knownWriters.sort() };
}

/**
 * 知识库根**顶层级条目**封闭枚举（`V-A7.5`「共享侧无第三面」的机械形态）。
 * 四件＝容器协议本体：索引清单／报告全文目录／模板／跨进程写锁目录。
 * 新增顶层级条目＝长出第三面，须走规格修订而非就地加法。
 *
 * **单源（02 纪律）**：前三件的名字从 `lib/knowledge.js` 的路径助手**派生**
 * （`knowledge.js` 是容器协议实现方），不在此另抄一份——助手改名而本表没跟
 * 会让扫描器把真面报成第三面。`.lock` 是跨进程写锁目录（`knowledge.js` 内
 * 私有函数坐标，未导出），按实现事实单列，改锁目录名须同步此处。
 */
export const KNOWLEDGE_CONTAINER_ENTRIES = Object.freeze([
  basename(indexFile("")),
  basename(reportsDirFor("")),
  basename(templateFileFor("")),
  ".lock"
]);

/**
 * 扫知识库根目录，检查顶层级条目是否全在容器协议封闭枚举内。
 * 返回 `{exists, entries[], violations[]}`；**只读**——根不存在时不创建、
 * 直接报 `exists:false`（未安装不是违例：安装由 ensureKnowledgeBase 负责）。
 */
export function knowledgeFaceShape(knowledgeRoot) {
  if (!existsSync(knowledgeRoot)) {
    return { exists: false, entries: [], violations: [] };
  }
  const allowed = new Set(KNOWLEDGE_CONTAINER_ENTRIES);
  const entries = readdirSync(knowledgeRoot).sort();
  const violations = [];
  for (const entry of entries) {
    if (!allowed.has(entry)) {
      violations.push(
        `知识库根顶层级条目 ${entry} 不在容器协议封闭枚举` +
        `（${KNOWLEDGE_CONTAINER_ENTRIES.join("、")}）→ 共享侧无第三面（V-A7.5）：` +
        `新顶层级条目即第三面，须走规格修订`
      );
    }
  }
  return { exists: true, entries, violations };
}

/**
 * 登记写者名单（**lib/ 下相对路径**，冻结枚举）：`index.js`＝host 装配面——
 * `createLedgerHost({knowledgeRegister})` 的箭头函数在 **host 进程内**调
 * `registerReport`（10 号票 `V-A4.5` 命令化后的唯一落点）。bot 实例侧经
 * `knowledge.register` 命令通道提交、无共享面写通道。
 */
export const KNOWLEDGE_REGISTER_WRITER_MODULES = Object.freeze(["index.js"]);

/** bot 实例侧注册面（不得出现 registerReport 直写的函数；名称即断点）。 */
const BOT_SIDE_REGISTRATION_FUNCTIONS = Object.freeze(["registerKnowledgeTools", "registerOrgTools"]);

/**
 * 登记写者审计（`V-A4.5` 命令化后的机械形态）。两项检查：
 *   1. **调用者名单闭合**——扫 `lib/` 全部 js，凡出现 `registerReport(` 调用且
 *      不在 `KNOWLEDGE_REGISTER_WRITER_MODULES` 即违例（新模块直接调＝绕开命令面）；
 *   2. **bot 侧注册面零直写**——`lib/index.js` 里 `registerKnowledgeTools`／
 *      `registerOrgTools` 的函数体内出现 `registerReport(` 即违例（函数体按
 *      `function <name>(` 到下一次顶层 `\n}` 的词法范围取）。
 * 返回 `{callers[], violations[], botSideWriters[]}`。
 */
export function scanKnowledgeRegisterWriters(repoRoot) {
  const libDir = join(repoRoot, "lib");
  if (!existsSync(libDir)) {
    return { callers: [], violations: [`lib/ 不存在：${libDir}`], botSideWriters: [] };
  }
  const allowed = new Set(KNOWLEDGE_REGISTER_WRITER_MODULES);
  const callers = [];
  const violations = [];
  const botSideWriters = [];

  for (const file of walkJs(libDir)) {
    const relFromLib = relative(libDir, file).split(/[\\/]/).join("/");
    if (SCAN_EXEMPT_MODULES.includes(relFromLib)) continue; // 扫描器自身：字面是检测样本
    const raw = readFileSync(file, "utf8");
    // **定义**不算调用：先剥掉 `function registerReport(` 形态，再判剩余出现
    // （lib/knowledge.js 是定义方，不是写者名单的候选）
    const text = raw.replace(/function\s+registerReport\s*\(/g, "function __defined(");
    if (!text.includes("registerReport(")) continue;
    const relFromRepo = `lib/${relFromLib}`;
    callers.push(relFromRepo);
    if (!allowed.has(relFromLib)) {
      violations.push(
        `${relFromRepo}: 出现 registerReport 调用但不在登记写者名单（${Array.from(allowed).join("、")}）` +
        `——bot 侧无共享面直写通道，登记须经 knowledge.register 命令面`
      );
    }
    if (relFromLib !== "index.js") continue;
    for (const fn of BOT_SIDE_REGISTRATION_FUNCTIONS) {
      const body = functionBody(text, fn);
      if (body !== null && body.includes("registerReport(")) {
        botSideWriters.push(`${relFromRepo}: ${fn} 函数体内出现 registerReport（bot 侧直写通道复活）`);
      }
    }
  }
  return { callers: callers.sort(), violations: [...violations, ...botSideWriters], botSideWriters };
}

/** 取 `function <name>(` 到下一次顶层 `\n}` 的函数体文本；找不到返回 null。 */
function functionBody(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const end = text.indexOf("\n}", start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

/** Walk lib/ 与 lib/org/ 两根（含嵌套子目录），返回全部 js 文件绝对路径。 */
function walkJs(dir) {
  const out = [];
  const visit = (current) => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile() && extname(entry) === ".js") out.push(full);
    }
  };
  visit(dir);
  return out.sort();
}
