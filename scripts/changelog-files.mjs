/** Monthly changelog storage and legacy archive binding; all operations are read-only. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const LOG_DIR = "docs/changelog";
export const ARCHIVE_MANIFEST = `${LOG_DIR}/archive.json`;
export const LOG_MARKER = "<!-- changelog: monthly-v1 -->";
export const LOG_LIMITS = Object.freeze({ indexLines: 80, indexBytes: 8192, volumeLines: 400, volumeBytes: 32768 });
const volumeName = /^(\d{4}-(?:0[1-9]|1[0-2]))-(\d{2})\.md$/;
const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
const sha = (text) => createHash("sha256").update(text).digest("hex");

function entries(text, path, legacy) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  let fence = null;
  for (let i = 0; i < lines.length; i += 1) {
    const marker = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    if (legacy ? /^(?:## \d{4}-\d{2}-\d{2}\b|- )/.test(lines[i]) : /^## /.test(lines[i])) starts.push(i);
  }
  return starts.map((start, i) => ({
    path, line: start + 1, title: lines[start],
    text: lines.slice(start, starts[i + 1] ?? lines.length).join("\n").trim(),
  }));
}

function layout(repoRoot, read) {
  const index = read("CHANGELOG.md");
  const dir = join(repoRoot, LOG_DIR);
  const names = existsSync(dir) ? readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name).sort().reverse() : [];
  if (!existsSync(join(repoRoot, ARCHIVE_MANIFEST))) {
    if (names.length || index.includes(LOG_MARKER)) throw new Error(`${ARCHIVE_MANIFEST} 缺失`);
    return { index, volumes: [], archive: null };
  }
  if (!index.includes(LOG_MARKER)) throw new Error("CHANGELOG.md 缺少分卷入口标记");
  if (!names.length) throw new Error(`${LOG_DIR} 缺少事件分卷`);
  const byMonth = new Map();
  for (const name of names) {
    const match = name.match(volumeName);
    if (!match || Number(match[2]) === 0) throw new Error(`日志卷名无效：${name}`);
    const parts = byMonth.get(match[1]) ?? [];
    parts.push(Number(match[2]));
    byMonth.set(match[1], parts);
  }
  for (const [month, parts] of byMonth) {
    if (parts.sort((a, b) => a - b).some((part, i) => part !== i + 1)) throw new Error(`${month} 日志卷序号缺失，须从 01 连续编号`);
  }
  const archive = JSON.parse(read(ARCHIVE_MANIFEST));
  if (archive.schemaVersion !== 1 || archive.originalPath !== "CHANGELOG.md"
      || !/^CHANGELOG-legacy-\d{4}-\d{2}-\d{2}\.md$/.test(archive.path ?? "")
      || !/^[0-9a-f]{64}$/.test(archive.sha256 ?? "")
      || !Number.isSafeInteger(archive.byteLength) || archive.byteLength <= 0
      || !Number.isSafeInteger(archive.lineCount) || archive.lineCount <= 0) {
    throw new Error(`${ARCHIVE_MANIFEST} 归档绑定无效`);
  }
  return { index, volumes: names.map((name) => `${LOG_DIR}/${name}`), archive };
}

function readArchive(archive, read) {
  const text = read(archive.path);
  if (sha(text) !== archive.sha256 || Buffer.byteLength(text) !== archive.byteLength || lineCount(text) !== archive.lineCount) {
    throw new Error(`${archive.path} 归档原文的 SHA-256、字节数或行数不符`);
  }
  return text;
}

function volumeEntries(path, text) {
  if (lineCount(text) > LOG_LIMITS.volumeLines || Buffer.byteLength(text) > LOG_LIMITS.volumeBytes) {
    throw new Error(`${path} 超过 ${LOG_LIMITS.volumeLines} 行或 ${LOG_LIMITS.volumeBytes} 字节，须开下一卷`);
  }
  const result = entries(text, path, false);
  if (!result.length) throw new Error(`${path} 没有事件`);
  for (const event of result) {
    const match = event.title.match(/^## (\d{4}-\d{2}-\d{2}) (EV-(\d{8})-[a-z0-9-]+) .+$/);
    if (!match || match[1].slice(0, 7) !== path.split("/").at(-1).slice(0, 7)
        || match[1].replaceAll("-", "") !== match[3]
        || !Number.isFinite(Date.parse(`${match[1]}T00:00:00Z`))
        || new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1]) {
      throw new Error(`${path}:${event.line} 须使用同月有效日期和 EV-YYYYMMDD-slug 事件编号`);
    }
    event.id = match[2];
  }
  return result;
}

export function recentChangelog(repoRoot, count, read) {
  const log = layout(repoRoot, read);
  if (!log.archive) return entries(log.index, "CHANGELOG.md", true).slice(0, count);
  const result = [];
  for (const path of log.volumes) {
    result.push(...volumeEntries(path, read(path)));
    if (result.length >= count) return result.slice(0, count);
  }
  result.push(...entries(readArchive(log.archive, read), log.archive.path, true));
  return result.slice(0, count);
}

export function changelogCatalogue(repoRoot, read) {
  const log = layout(repoRoot, read);
  if (!log.archive) return ["CHANGELOG.md：旧单文件格式。"];
  return [...log.volumes.map((path) => {
    const text = read(path);
    return `${path}：${lineCount(text)} 行，${Buffer.byteLength(text)} 字节`;
  }), `${log.archive.path}：历史原文，校验绑定见 ${ARCHIVE_MANIFEST}`];
}

/** Used by preflight; repositories/fixtures without a changelog retain their previous behavior. */
export function checkChangelog(repoRoot) {
  if (!existsSync(join(repoRoot, "CHANGELOG.md")) && !existsSync(join(repoRoot, LOG_DIR))) return { violations: [] };
  const read = (path) => readFileSync(join(repoRoot, path), "utf8");
  try {
    const log = layout(repoRoot, read);
    if (!log.archive) return { violations: [] };
    if (lineCount(log.index) > LOG_LIMITS.indexLines || Buffer.byteLength(log.index) > LOG_LIMITS.indexBytes) {
      throw new Error(`CHANGELOG.md 入口超过 ${LOG_LIMITS.indexLines} 行或 ${LOG_LIMITS.indexBytes} 字节`);
    }
    if (entries(log.index, "CHANGELOG.md", true).length) throw new Error("CHANGELOG.md 是入口；事件须写入 docs/changelog 分卷");
    const old = readArchive(log.archive, read);
    const ids = new Set(entries(old, log.archive.path, true).map((event) => event.title.match(/^## \S+ (EV-\S+)/)?.[1]).filter(Boolean));
    for (const path of log.volumes) {
      for (const event of volumeEntries(path, read(path))) {
        if (ids.has(event.id)) throw new Error(`事件编号重复：${event.id}`);
        ids.add(event.id);
      }
    }
    return { violations: [] };
  } catch (error) {
    return { violations: [`CHANGELOG: ${error.message}`] };
  }
}
