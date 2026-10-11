/**
 * 回归：bot-health.cjs 会话日志文件名代际（票 06 附属修复）。
 * 背景：现役宿主（dsh-session-format v≥1）写版本化日志名 `session.v<N>.jsonl.zstd`
 * （现役 bot 会话＝`session.v4.jsonl.zstd`）；bot-health 旧实现硬编码旧名
 * `session.jsonl.zstd` ⇒ v4-only 会话被 check 判「会话文件缺失」FAIL，
 * 「疑似进行中」保护对 v4 会话同样失效。
 * 覆盖（不跑任何 repair 动作）：
 *   ① `sessionLogCandidates` / `findSessionLogInDir` 纯逻辑：多代并存按 N 降序、
 *      旧名垫底、目录不存在 → 空，并与 `lib/stats.js::sessionLogCandidates`
 *      逐字对拍（两处实现「必须同步演进」的防漂移棘轮）；
 *   ② 「疑似进行中」保护（`isInProgress`）：v4-only 且新写入 → true，mtime 超 60s → false；
 *   ③ 真跑 CLI `check`（临时 root 夹具）：v4-only 会话不再报缺失，证据里打印
 *      实际命中的版本化文件名；
 *   ④ 多代并存 → CLI 读最高版本（v10 的 3 帧 6 条记录，而非旧名 2 条）；
 *   ⑤ check 全程零写入（前后目录快照一致）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { zstdCompressSync } from "node:zlib";
import { sessionLogCandidates as statsCandidates } from "../lib/stats.js";

const require = createRequire(import.meta.url);
const { sessionLogCandidates, findSessionLogInDir, isInProgress } = require("../scripts/bot-health.cjs");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "pod-bot-health-"));
// exit 钩子清理临时目录：正常退出、显式 exit 与断言失败后都会运行
process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));

/** 一个回合一批记录（每批压成一个独立 zstd 帧，与官方「每 flush 一批一帧」写法一致）。 */
const batch = (turn) => [
  { seq: turn * 10 + 1, type: "step/start", time: 1000 * turn, data: { turn, step: 1 } },
  { seq: turn * 10 + 2, type: "assistant/message", time: 1000 * turn + 500,
    data: { turn, step: 1, message: { content: [{ type: "text", text: "r" + turn }] } } },
];
const logBytes = (turns) => Buffer.concat(
  turns.map((t) => zstdCompressSync(Buffer.from(batch(t).map((e) => JSON.stringify(e)).join("\n") + "\n"))));

// ---- ① helper 纯逻辑（与 lib/stats.js 对拍） ----
const genDir = path.join(home, "gen-dir");
fs.mkdirSync(genDir, { recursive: true });
fs.writeFileSync(path.join(genDir, "session.v3.jsonl.zstd"), logBytes([1, 2]));
fs.writeFileSync(path.join(genDir, "session.v10.jsonl.zstd"), logBytes([1, 2, 3]));
fs.writeFileSync(path.join(genDir, "session.jsonl.zstd"), logBytes([1]));
fs.writeFileSync(path.join(genDir, "session.jsonl"), "{}"); // 无 .zstd 的旧名不是日志件
fs.writeFileSync(path.join(genDir, "notes.txt"), "x");

const expected = [
  path.join(genDir, "session.v10.jsonl.zstd"),
  path.join(genDir, "session.v3.jsonl.zstd"),
  path.join(genDir, "session.jsonl.zstd"),
];
assert.deepEqual(sessionLogCandidates(genDir), expected, "候选序：版本化按 N 降序、旧名垫底");
assert.deepEqual(statsCandidates(genDir), expected, "与 lib/stats.js 同口径逐字一致（防漂移对拍）");
assert.equal(findSessionLogInDir(genDir), expected[0], "多代并存 → 最高版本 v10 胜出");
assert.deepEqual(sessionLogCandidates(path.join(home, "no-such-dir")), [], "目录不存在 → 空候选（不抛）");
assert.equal(findSessionLogInDir(path.join(home, "no-such-dir")), null, "空候选 → null");

const legacyDir = path.join(home, "legacy-dir");
fs.mkdirSync(legacyDir, { recursive: true });
fs.writeFileSync(path.join(legacyDir, "session.jsonl.zstd"), logBytes([1]));
assert.equal(findSessionLogInDir(legacyDir), path.join(legacyDir, "session.jsonl.zstd"),
  "仅旧名（v0 产物）→ 旧名，向后兼容");
console.log("✓ 候选序纯逻辑＋与 lib/stats.js 对拍（多代取最高 N／旧名垫底／空目录）");

// ---- 夹具助手（分片名／addBot）：保护判定与 CLI check 共用 ----
const script = fileURLToPath(new URL("../scripts/bot-health.cjs", import.meta.url));
/** 会话分片目录名 = workspace 的 '/' 全替换为 '-' 再首尾各加 '-'（同 findScopeDirs 口径）。 */
const scopeName = (ws) => "-" + ws.split("/").join("-") + "-";

function addBot(root, botId, sessionId, logs) {
  const ws = path.join(root, "bot-workspaces", botId);
  fs.mkdirSync(ws, { recursive: true });
  fs.writeFileSync(path.join(ws, ".dsh-bot-session.json"), JSON.stringify({ sessionId }));
  const sdir = path.join(root, "sessions", scopeName(ws), sessionId);
  fs.mkdirSync(sdir, { recursive: true });
  for (const [name, buf] of Object.entries(logs)) fs.writeFileSync(path.join(sdir, name), buf);
}

// ---- ② 「疑似进行中」保护（第二处使用点）：v4-only 新写入日志也须被看见 ----
const guardRoot = path.join(home, "guard-root");
addBot(guardRoot, "g", "sid-g", { "session.v4.jsonl.zstd": logBytes([1]) });
const guardWs = path.join(guardRoot, "bot-workspaces", "g");
const guardEntry = { workspace: guardWs };
assert.equal(isInProgress(guardRoot, "g", guardEntry), true,
  "v4-only 且 mtime < 60s → 疑似进行中（旧实现只认旧名，此处会漏判为 false）");
const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
fs.utimesSync(path.join(guardRoot, "sessions", scopeName(guardWs), "sid-g", "session.v4.jsonl.zstd"), stale, stale);
assert.equal(isInProgress(guardRoot, "g", guardEntry), false, "日志 mtime 超 60s → 不判进行中");
console.log("✓ 疑似进行中保护：v4-only 新日志可被看见（mtime 口径不变）");

const root = path.join(home, "dsh-root");
fs.mkdirSync(path.join(root, "bots"), { recursive: true });
fs.writeFileSync(path.join(root, "bots", "bots.json"), JSON.stringify({ v4only: {}, multi: {} }));
addBot(root, "v4only", "sid-v4", { "session.v4.jsonl.zstd": logBytes([1]) });
addBot(root, "multi", "sid-multi", {
  "session.jsonl.zstd": logBytes([1]),
  "session.v3.jsonl.zstd": logBytes([1, 2]),
  "session.v10.jsonl.zstd": logBytes([1, 2, 3]),
});

/** 目录快照（相对路径＋字节数）：校验 check 零写入。 */
function snapshot(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        out.push(path.relative(dir, p) + "/");
        walk(p);
      } else {
        out.push(`${path.relative(dir, p)}:${fs.statSync(p).size}`);
      }
    }
  };
  walk(dir);
  return out;
}

const check = (rootDir, botId) => {
  const r = spawnSync(process.execPath, [script, "check", botId, "--root", rootDir], { encoding: "utf8" });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
};

// ---- ③④⑤ 真跑 CLI check（临时 root；check 全程只读）＋零写入快照 ----
const before = snapshot(root);
const v4 = check(root, "v4only");
assert.equal(v4.status, 0, `v4-only 会话应整体 OK（退出码 0），实际 ${v4.status}：\n${v4.out}`);
assert.match(v4.out, /OK\s+会话日志/, "v4-only 会话日志判 OK");
assert.ok(!v4.out.includes("会话文件缺失"), `修复后不得再报「会话文件缺失」：\n${v4.out}`);
assert.ok(v4.out.includes("session.v4.jsonl.zstd：2 条记录（1 帧），seq 单调递增"),
  `证据摘要须打印实际命中的版本化文件名：\n${v4.out}`);
console.log("✓ CLI check：v4-only 会话不再判缺失，证据带实际命中文件名");

const multi = check(root, "multi");
assert.equal(multi.status, 0, `多代并存应整体 OK（退出码 0），实际 ${multi.status}：\n${multi.out}`);
assert.ok(multi.out.includes("session.v10.jsonl.zstd：6 条记录（3 帧），seq 单调递增"),
  `多代并存须读最高版本 v10（6 条 3 帧，而非旧名 2 条）：\n${multi.out}`);
console.log("✓ CLI check：多代并存读最高版本（v10 胜旧名/v3）");

assert.deepEqual(snapshot(root), before, "check 是只读动作：前后目录快照逐项一致");
console.log("✓ check 零写入（目录快照前后一致）");
