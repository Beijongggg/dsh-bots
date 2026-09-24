/**
 * 词法扫描管路（org-v2 11 号票抽件；02 纪律：**同一套 walk／注释判别／函数体提取／
 * 写操作名单只此一份**）。
 *
 * 被三张扫描件共用：`org/knowledge-shared-face.js`（10 号票记忆层）、
 * `org/mail-shared-face.js`（11 号票投递面）、`org/vocabulary-face.js`
 * （11 号票词表面）。纯只读纯函数：不改被扫面、不落盘、无状态。
 */
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * 文件写操作名单（**增改与破坏两类都收**）：只管 `write*` 会让 `rmSync`／
 * `unlinkSync`／`renameSync` 这类破坏型直写静默绕过——删除与「原地覆盖」在共面
 * 纪律上是同等性质的动作。扫描件按各自临界区判据（路径触达邻近度）使用本名单。
 */
export const FS_WRITE_OPS = Object.freeze([
  "writeFileSync", "writeFileAtomic", "appendFileSync", "createWriteStream",
  "mkdirSync", "rmSync", "rmdirSync", "unlinkSync", "renameSync", "copyFileSync", "truncateSync"
]);

/** 行是否落在注释内（`//`、块注释续行 `*`、`/*`）。 */
export function isCommentLine(trimmed) {
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/** 取 `function <name>(` 到下一次顶层 `\n}` 的函数体文本；找不到返回 null。 */
export function functionBody(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const end = text.indexOf("\n}", start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

/** Walk 目录，返回 JS/MJS/CJS 文件路径。扩展名不区分大小写，目录按真实路径去重。 */
export function walkJs(dir) {
  const out = [];
  const visited = new Set();
  const visit = (current) => {
    if (!existsSync(current)) return;
    const real = realpathSync(current);
    if (visited.has(real)) return;
    visited.add(real);
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile() && [".js", ".mjs", ".cjs"].includes(extname(entry).toLowerCase())) out.push(full);
    }
  };
  visit(dir);
  return out.sort();
}
