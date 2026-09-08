/**
 * 回归：会话统计推导层（lib/stats.js——官方移植件，批次③拆分的守护网）。
 * ① deriveStats 对合成事件日志的精确断言（同回合用量替换、耗时/首token/解码、
 *    上下文压力与构成缩放）；
 * ② offlineStats 的多帧 zstd 离线读盘（逐帧独立压缩拼接——zstdDecompressSync
 *    只解第一帧，正是 scanZstdFrames 存在的理由——外加撕裂尾帧容错与缓存）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { zstdCompressSync } from "node:zlib";
import { deriveStats, offlineStats } from "../lib/stats.js";

// ---- ① 合成事件：精确断言 ----
const U = { inputTokens: 100, outputTokens: 40, cacheReadTokens: 10, cacheWriteTokens: 5 };
const t0 = 1000, t1 = 1500, t2 = 2500, t3 = 2600, t4 = 3600;
const events = [
  { type: "request/header", time: t0, data: { header: { system: "abcdefgh", tools: [{ name: "x" }] } } },
  { type: "user/message", time: t0, data: { message: { content: [{ type: "text", text: "1234" }] } } },
  { type: "step/start", time: t0, data: { turn: 1, step: 1 } },
  { type: "assistant/chunk", time: t1, data: { turn: 1, step: 1, chunk: { type: "text", text: "hi" } } },
  { type: "assistant/chunk", time: t1, data: { turn: 1, step: 1, chunk: { type: "usage", usage: U } } },
  { type: "assistant/message", time: t2, data: { turn: 1, step: 1, usage: U, message: { content: [{ type: "text", text: "abcd" }] } } },
  { type: "tool/call", time: t2, data: { callId: "c1" } },
  { type: "tool/result", time: t3, data: { message: { source: { callId: "c1" } } } },
  { type: "step/end", time: t4, data: { turn: 1, step: 1 } },
  { type: "turn/end", time: t4, data: { turn: 1 } },
  { type: "request/context", time: t4, data: { contextWindow: 1000 } }
];
const s = deriveStats(events);
assert.deepEqual(s.tokenUsage, {
  uncachedInputTokens: 100, outputTokens: 40, cacheReadTokens: 10, cacheWriteTokens: 5
}, "同 turn+step 的 chunk/message 两份用量样本只计一次");
assert.deepEqual({ turns: s.sessionStats.turns, steps: s.sessionStats.steps }, { turns: 1, steps: 1 });
assert.equal(s.sessionStats.llmMs, 1500, "llmMs = message - stepStart");
assert.equal(s.sessionStats.ttftMs, 500, "首 token = 首 chunk - stepStart");
assert.equal(s.sessionStats.ttftSteps, 1);
assert.equal(s.sessionStats.decodeMs, 1000, "解码 = message - 首 chunk");
assert.equal(s.sessionStats.decodeTokens, 40);
assert.equal(s.sessionStats.toolMs, 100, "工具耗时 = result(2600) - call(2500)");
assert.equal(s.contextPressure.pressureTokens, 115, "100+10+5");
assert.equal(s.contextPressure.contextWindow, 1000);
assert.equal(s.contextPressure.provider, undefined, "无 provider 时不含该字段");
assert.equal(s.contextPressure.model, undefined, "无 model 时不含该字段");
// request/context 带 provider/model 时透传（供后端与当前模型对齐）
const s2 = deriveStats([...events,
  { type: "request/context", time: t4 + 1, data: { provider: "p2", model: "m2", contextWindow: 2000 } }]);
assert.equal(s2.contextPressure.provider, "p2");
assert.equal(s2.contextPressure.model, "m2");
assert.equal(s2.contextPressure.contextWindow, 2000);
const bt = s.contextBreakdown;
assert.ok(bt.systemTokens > 0 && bt.toolsTokens > 0 && bt.messageTokens > 0, "三段构成均非零");
// 三段独立 Math.round，和允许每段 ±1 的舍入误差
assert.ok(Math.abs(bt.systemTokens + bt.toolsTokens + bt.messageTokens - 115) <= 2,
  "构成按 pressureTokens 等比缩放后对齐（±2 舍入容差）");
console.log("✓ deriveStats 合成事件精确断言（usage 去重/耗时/压力/构成缩放）");

// ---- ② 离线多帧 zstd ----
const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-stats-"));
// exit 钩子清理临时目录：正常退出、显式 exit 与断言失败后都会运行
process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
const workspace = path.join(home, "bot-workspaces", "w");
const shard = "-" + workspace.split("/").join("-") + "-";
const sessionDir = path.join(home, "sessions", shard, "sid-1");
fs.mkdirSync(sessionDir, { recursive: true });
const mkEvents = (turn) => [
  { type: "step/start", time: 1000, data: { turn, step: 1 } },
  { type: "assistant/message", time: 2000, data: { turn, step: 1, usage: U, message: { content: [{ type: "text", text: "r" + turn }] } } },
  { type: "step/end", time: 2500, data: { turn, step: 1 } },
  { type: "turn/end", time: 2500, data: { turn } }
];
// 每个事件批次一个独立 flush 帧（与官方持久化写法一致），最后拼一个撕裂尾帧
const frames = [mkEvents(1), mkEvents(2)]
  .map((batch) => zstdCompressSync(Buffer.from(batch.map((e) => JSON.stringify(e)).join("\n") + "\n")));
const torn = zstdCompressSync(Buffer.from(JSON.stringify(mkEvents(3)[0]))).subarray(0, 10); // 写一半的帧头
fs.writeFileSync(path.join(sessionDir, "session.jsonl.zstd"), Buffer.concat([...frames, torn]));

const stats1 = offlineStats(home, workspace, "sid-1");
assert.equal(stats1.sessionStats.turns, 2, "两个完整帧都被解出（单帧解压会只剩 turn 1）");
assert.equal(stats1.tokenUsage.outputTokens, 80, "两回合各 40");
// 无日志 → 全零统计（非 null）
const zero = offlineStats(home, workspace, "sid-nope");
assert.equal(zero.sessionStats.turns, 0);
assert.deepEqual(zero.tokenUsage, { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
// 缓存：同 mtime/size 再读结果一致（值层面不可区分，这里只验证不抛错且数值稳定）
const stats2 = offlineStats(home, workspace, "sid-1");
assert.deepEqual(stats2, stats1);
console.log("✓ offlineStats 多帧 zstd（逐帧解压/撕裂尾帧容错/无日志全零/缓存稳定）");

process.exit(0);
