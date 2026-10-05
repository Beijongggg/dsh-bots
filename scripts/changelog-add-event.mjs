/**
 * changelog 事件原子落档（retro2 导航批，EV-20261005-retro2-nav）。
 *
 * 解决两个会话反复付过的税：
 *  - 「新事件置顶」编辑窗口被并行会话插入打断（Edit→sed→行号连环失效的先例）
 *    ——本脚本把「读卷→插块→写回」压进单进程，窗口毫秒级；
 *  - 整 index 提交裹挟并行会话预暂存件（aec01c0 返工先例）——`--stage` 按
 *    HEAD 基线生成只含本事件的 hunk，`git apply --cached` 精确暂存，不碰
 *    工作树他批改动。
 *
 * 用法：
 *   node scripts/changelog-add-event.mjs --id EV-YYYYMMDD-slug --title 标题 \
 *        --body-file <路径> [--date YYYY-MM-DD] [--stage]
 *
 * 规则依据 README §6.2：标题行 `## <date> <id> <标题>`；同月最新卷顶部插入；
 * 单卷 400 行 / 32 KiB，超出先开下一卷；编号全局唯一。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const changelogDir = join(repoRoot, "docs", "changelog");
const MAX_LINES = 400;
const MAX_BYTES = 32 * 1024;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function fail(msg) {
  console.error(`changelog-add-event: ${msg}`);
  process.exit(1);
}

const id = arg("id");
const title = arg("title");
const bodyFile = arg("body-file");
const date = arg("date") ?? new Date().toISOString().slice(0, 10);
const stage = process.argv.includes("--stage");
if (!id || !/^EV-\d{8}-[a-z0-9-]+$/.test(id)) fail("--id 须形如 EV-YYYYMMDD-slug");
if (!title) fail("--title 必填");
if (!bodyFile) fail("--body-file 必填（正文文件，建议按四要件：范围/变化/验证/授权）");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date 须为 YYYY-MM-DD");

// 编号全局唯一（扫全部卷；只读比较，不依赖 --check-log 的时机）
const month = date.slice(0, 7);
const volumes = readdirSync(changelogDir).filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n));
for (const v of volumes) {
  if (readFileSync(join(changelogDir, v), "utf8").includes(` ${id} `)) {
    fail(`事件编号 ${id} 已存在于 ${v}`);
  }
}

const block = [`## ${date} ${id} ${title}`, "", readFileSync(bodyFile, "utf8").trimEnd(), ""].join("\n");

// 当月最新卷（无则新建 01 卷）
const monthVols = volumes.filter((n) => n.startsWith(`${month}-`)).sort();
let volName;
if (monthVols.length === 0) {
  volName = `${month}-01.md`;
} else {
  const last = monthVols[monthVols.length - 1];
  const text = readFileSync(join(changelogDir, last), "utf8");
  const inserted = insertTop(text, block);
  if (inserted.split("\n").length <= MAX_LINES && Buffer.byteLength(inserted, "utf8") <= MAX_BYTES) {
    writeFileSync(join(changelogDir, last), inserted);
    volName = last;
    console.log(`已置顶插入 ${last}（现 ${inserted.split("\n").length} 行）`);
  } else {
    volName = nextVolume(last);
    console.log(`${last} 追加后将超上限，开新卷 ${volName}`);
  }
}
if (!existsSync(join(changelogDir, volName))) {
  const header = `# ${month} 变更记录 · ${volName.slice(-5, -3)}\n\n新事件置顶；维护与轮转规则见 [README §6.2](../../README.md)。\n\n`;
  writeFileSync(join(changelogDir, volName), header + block);
  console.log(`已创建 ${volName} 并写入本事件`);
}

/** 在第一个 `## ` 事件行之前插入（即卷内置顶）。 */
function insertTop(text, blk) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.startsWith("## "));
  if (i < 0) fail("卷内找不到 `## ` 事件锚点，请人工检查卷头");
  lines.splice(i, 0, blk);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function nextVolume(last) {
  const n = Number(last.slice(-5, -3)) + 1;
  return `${month}-${String(n).padStart(2, "0")}.md`;
}

if (stage) {
  // 按 HEAD 基线生成只含本事件的插入 hunk，精确暂存（不动工作树他批改动）。
  const headText = spawnSync("git", ["-C", repoRoot, "show", `HEAD:docs/changelog/${volName}`], { encoding: "utf8" });
  if (headText.status !== 0) fail(`HEAD 中无 docs/changelog/${volName}（新卷请直接 git add 该文件）`);
  const patch = buildPatch(headText.stdout, block, `docs/changelog/${volName}`);
  const applied = spawnSync("git", ["-C", repoRoot, "apply", "--cached", "-"], { input: patch, encoding: "utf8" });
  if (applied.status !== 0) fail(`git apply --cached 失败：${applied.stderr}\n（index 基线可能已偏离 HEAD，请人工核对）`);
  console.log(`已按 HEAD 基线精确暂存本事件（${volName}）`);
}
console.log(`事件 ${id} 落档完成：docs/changelog/${volName}；提交请显式 pathspec 或沿用本暂存。`);

/** 生成「纯插入」unified patch：锚点前 3 行上下文＋插入块＋锚点起余行（行数守恒，可 apply）。 */
function buildPatch(headText, blk, relPath) {
  const text = headText.endsWith("\n") ? headText.slice(0, -1) : headText;
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.startsWith("## "));
  if (i < 0) fail("HEAD 卷内找不到 `## ` 事件锚点");
  const start = Math.max(0, i - 3);
  const ctx = lines.slice(start, i);
  const after = lines.slice(i);
  const oldCount = ctx.length + after.length;
  const newCount = oldCount + blk.split("\n").length;
  const full = [
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    `@@ -${start + 1},${oldCount} +${start + 1},${newCount} @@`,
    ...ctx.map((c) => ` ${c}`),
    ...blk.split("\n").map((b) => `+${b}`),
    ...after.map((a) => ` ${a}`),
  ];
  return full.join("\n") + "\n";
}
