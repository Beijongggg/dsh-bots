"use strict";
/**
 * 会话日志文件名代际的**单源模块**（retro R2，EV-20261011-retro-pod-impl）：
 * `lib/stats.js`（ESM）与 `scripts/bot-health.cjs` 共同消费。先例：票 06 代际盲区
 * 同一知识点烧三次（离线读面 v4 全盲、交付抽样只挑旧名件、bot-health 同盲区），
 * 返修后两处手抄实现靠注释「必须同步演进」维系——现收敛为单一 .cjs 底座
 * （`lib/shared.cjs` 同款 ESM/CJS 共用形态），文件名字面量只准出现在本文件
 * （scripts/preflight.mjs 第③门 session-log 名域限 lint 把守）。
 */
const fs = require("node:fs");
const path = require("node:path");

/**
 * 会话日志文件名两代（官方 `dsh-session-format::sessionFormatLogFilename`）：
 * v0 → `session.jsonl.zstd`；v≥1 → `session.v<N>.jsonl.zstd`（现役宿主写版本化名，
 * 现役 bot 会话日志为 `session.v4.jsonl.zstd`）。
 */
const SESSION_LOG_LEGACY_NAME = "session.jsonl.zstd";
const SESSION_LOG_VERSIONED_RE = /^session\.v(\d+)\.jsonl\.zstd$/;

/**
 * 生成一个会话目录内的日志候选路径，**按优先级排序**（先命中者胜）：
 *   ① 全部 `session.v<N>.jsonl.zstd` 按 **N 降序**（最高版本优先；同 N 按文件名
 *      升序，保证同目录同内容的确定性）——现役宿主（dsh-session-format v≥1）
 *      写的就是版本化名；
 *   ② 最后回落无版本旧名 `session.jsonl.zstd`（v0 产物；两者并存时版本化名胜出）。
 * 目录不存在／不可读 → 空数组（调用方走「未找到」分支）。
 */
function sessionLogCandidates(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const versioned = [];
  for (const name of names) {
    const match = SESSION_LOG_VERSIONED_RE.exec(name);
    if (match !== null) versioned.push({ name, version: Number(match[1]) });
  }
  versioned.sort((a, b) => b.version - a.version
    || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const candidates = versioned.map((entry) => path.join(dir, entry.name));
  if (names.includes(SESSION_LOG_LEGACY_NAME)) candidates.push(path.join(dir, SESSION_LOG_LEGACY_NAME));
  return candidates;
}

module.exports = { SESSION_LOG_LEGACY_NAME, SESSION_LOG_VERSIONED_RE, sessionLogCandidates };
