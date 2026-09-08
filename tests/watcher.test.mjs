/**
 * 回归：inbox watcher 的字节偏移增量读取（startInboxWatcher）。
 * 真实文件驱动、等 WATCH_POLL_MS(1s) tick。消费的可观测信号＝outbox 行数：
 * bot 注册到一个必然拒绝连接的端口（bind 后立即 close），每条被消费的消息
 * 经 handleIncoming 错误路径恰好写一行 [bot error]——成功回合路径由
 * reply-route.test.mjs 的假 RPC 覆盖，这里只测游标语义。
 * 场景：追加触发恰一次 / 撕裂行跨读不处理补全后恰一次 / 截断重置存量跳过。
 */
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-watcher-"));
const inboxDir = path.join(home, "bots", "inbox", "w");
const inboxFile = path.join(inboxDir, "messages.jsonl");
fs.mkdirSync(inboxDir, { recursive: true });

// 必然拒绝连接的端口：先 bind 占住临时端口再立刻 close（环回 closed → RST，
// 比写死端口号更能避免防火墙 DROP 语义拖到 RPC 超时）。
const probe = net.createServer();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const deadPort = probe.address().port;
await new Promise((r) => probe.close(() => r()));

fs.writeFileSync(path.join(home, "bots", "bots.json"), JSON.stringify({
  w: { id: "w", name: "观察对象", role: "干活", modelProvider: "", model: "", port: deadPort, createdAt: new Date().toISOString() }
}));

const line = (seq) => JSON.stringify({ seq, from: "user", text: "m" + seq, at: "2026-08-22T01:00:00.000Z" });
const append = (s) => fs.appendFileSync(inboxFile, s, "utf8");
const outboxCount = () => internals.readOutbox(home, "w").length;
// 间隔 1000ms 的 tick：写后等 1400ms 保证至少一个 tick；「不再变化」的检查再等一个窗口。
const settle = (ms = 1400) => new Promise((r) => setTimeout(r, ms));

// 存量 seq=1 先落盘，再启动 watcher：初始化语义应为 offset=size、lastSeq=1，存量不回放。
fs.writeFileSync(inboxFile, line(1) + "\n", "utf8");
const ctx = { logger: { info() {}, warn() {}, error() {} } };
const dispose = internals.startInboxWatcher(ctx, { dshHome: home }, "w");

try {
  await settle();
  assert.equal(outboxCount(), 0, "启动存量（seq=1）不应被回放");

  // 1) 追加触发：新行恰被消费一次，重复 tick 不重放。
  append(line(2) + "\n");
  await settle();
  assert.equal(outboxCount(), 1, "追加 seq=2 后一个 tick 内应消费一次");
  await settle();
  assert.equal(outboxCount(), 1, "后续 tick 不应重放 seq=2");

  // 2) 撕裂行跨读：半行（无换行）不处理；补全换行后下个 tick 恰处理一次。
  append('{"seq":3,"from":"user","text":"tor');
  await settle();
  assert.equal(outboxCount(), 1, "未换行的半行不应被处理");
  append('n","at":"2026-08-22T02:00:00.000Z"}\n');
  await settle();
  assert.equal(outboxCount(), 2, "补全换行后 seq=3 恰处理一次（pending 承接不丢不重）");
  await settle();
  assert.equal(outboxCount(), 2, "seq=3 也不重放");

  // 3) 截断重置：整文件替换为更短内容 → size < offset → 游标重置、存量跳过；
  //    之后的新增（seq=10 > 重置后的 maxSeq=9）恢复正常消费。
  fs.writeFileSync(inboxFile, line(9) + "\n", "utf8");
  await settle();
  assert.equal(outboxCount(), 2, "截断后的存量（seq=9）不应回放");
  append(line(10) + "\n");
  await settle();
  assert.equal(outboxCount(), 3, "截断重置后新增 seq=10 应正常消费一次");
} finally {
  dispose();
  fs.rmSync(home, { recursive: true, force: true });
}

console.log("✓ inbox watcher 增量游标（追加恰一次/撕裂行跨读/截断重置存量跳过）");
process.exit(0);
