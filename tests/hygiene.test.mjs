/**
 * 回归：孤儿 docblock 检测（T-1 模式三连击后立械）。
 * 历史三例（BotModal / routeReplyToSender / BotStatsLine 插入）均为同一模式：
 * 在既有函数前插入新函数时，新函数连同自己的 docblock 插到旧 docblock 与
 * 旧函数之间，旧 docblock 被架空。可检测症状＝一个 docblock 结束后（中间
 * 只允许空行）紧跟另一个 docblock 开始——中间没有可挂靠的代码。
 *
 * 检测器自测先行：内联夹具断言「历史形状 → 命中」「隔空行变体 → 命中」
 * 「正常代码 → 零误报」——防止检测逻辑被改哑（模式串打错等）后真实文件
 * 断言恒真、网无声死亡。已知局限：插入新函数不带自己的注释、直接吃掉旧
 * docblock 的错误归属无连续 docblock 症状，本网不拦（三例历史形状已覆盖）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 扫描行数组，返回孤儿 docblock 违规描述（file 仅用于报错定位）。
 *  两遍：先标记每个 docblock 的收尾行（从 docblock 起始行到第一个含
 *  收尾符的行），再查收尾行之后（跳空行）是否紧跟另一 docblock——
 *  行尾内联块注释不参与判定。
 */
function findOrphanDocblocks(lines, file) {
  const isDocOpen = (s) => s.trimStart().startsWith("/**");
  const docEnd = new Array(lines.length).fill(false);
  let inDoc = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (inDoc) {
      if (t.includes("*/")) {
        inDoc = false;
        docEnd[i] = true;
      }
    } else if (isDocOpen(lines[i])) {
      if (t.includes("*/")) docEnd[i] = true; // 单行 docblock
      else inDoc = true;
    }
  }
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    if (!docEnd[i]) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j += 1;
    if (j < lines.length && isDocOpen(lines[j])) {
      violations.push(`${file}:${i + 1} docblock 后无代码即接另一 docblock（疑似被插入架空）`);
    }
  }
  return violations;
}

// 检测器自测：哑掉即红。
assert.equal(findOrphanDocblocks([
	"\t\t/** 未选中 Bot 时的功能说明落地页。 */",
	"\t\t/**",
	"\t\t * 新组件注释",
	"\t\t */",
	"\t\tfunction New() {}",
	"",
	"\t\tfunction Old() {}"
], "fixture").length, 1, "相邻双 docblock（历史三例形状）必须命中");

assert.equal(findOrphanDocblocks([
	"\t/** 旧函数注释。 */",
	"",
	"\t/** 新函数注释。 */",
	"\tfunction New() {}"
], "fixture").length, 1, "隔空行变体必须命中（容忍逻辑生效）");

assert.deepEqual(findOrphanDocblocks([
	"const x = 1; /* 行内块注释 */",
	"\t/** 正常注释。 */",
	"\tfunction Ok() {}"
], "fixture"), [], "正常代码（行内块注释/正常挂靠）不得误报");

// 真实文件清零。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];
for (const rel of ["lib/index.js", "lib/client.js", "lib/stats.js", "lib/knowledge.js", "lib/shared.cjs", "scripts/create-bot.cjs"]) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  violations.push(...findOrphanDocblocks(fs.readFileSync(full, "utf8").split("\n"), rel));
}

assert.deepEqual(violations, [], "孤儿 docblock（插入新函数时把别人的注释架空——把旧 docblock 跟着它的函数移走）");

console.log("✓ 孤儿 docblock 检测（检测器自测三夹具 + 真实五文件零违规）");
process.exit(0);
