/**
 * 回归：JSONL 解析容错与邮局语义（批次③「parseJsonlLines 收敛」的前置基线）。
 * 覆盖 maxSeqInFile / readAllInboxLines / readOutbox / readConversation / appendMessage
 * 对损坏行、空行、since 过滤、taskId／replyTo 形态标记的行为。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { internals } = await import("../lib/index.js");

const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-jsonl-"));
// exit 钩子清理临时目录：正常退出、显式 exit 与断言失败后都会运行
process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
const inboxFile = path.join(home, "bots", "inbox", "w", "messages.jsonl");
fs.mkdirSync(path.dirname(inboxFile), { recursive: true });

// inbox：正常行 + 撕裂行 + 空行 + 乱序（seq 不按文件顺序也能取最大值）
fs.writeFileSync(inboxFile, [
  JSON.stringify({ seq: 1, from: "user", text: "a", at: "2026-08-22T01:00:00.000Z" }),
  "",
  "{torn line without newline",
  JSON.stringify({ seq: 3, from: "user", text: "c", at: "2026-08-22T03:00:00.000Z" }),
  JSON.stringify({ seq: 2, from: "user", text: "b", at: "2026-08-22T02:00:00.000Z" })
].join("\n") + "\n", "utf8");

// outbox：多文件 + 损坏行
const outboxDir = path.join(home, "bots", "outbox", "w");
fs.mkdirSync(outboxDir, { recursive: true });
fs.writeFileSync(path.join(outboxDir, "t1.jsonl"),
  JSON.stringify({ id: "o1", text: "r1", from: "bot", timestamp: "2026-08-22T01:30:00.000Z" }) + "\n{broken\n");
fs.writeFileSync(path.join(outboxDir, "t2.jsonl"),
  JSON.stringify({ id: "o2", text: "r2", from: "bot", timestamp: "2026-08-22T02:30:00.000Z" }) + "\n");

assert.equal(internals.maxSeqInFile(inboxFile), 3, "maxSeq 跳过损坏行取最大 seq（乱序安全）");
assert.equal(internals.maxSeqInFile(path.join(home, "none.jsonl")), 0, "缺失文件 → 0");

const inboxLines = internals.readAllInboxLines(home, "w");
assert.equal(inboxLines.length, 3, "损坏行与空行被跳过");

const outbox = internals.readOutbox(home, "w");
assert.equal(outbox.length, 2, "outbox 损坏行被跳过");

const conversation = internals.readConversation(home, "w");
assert.equal(conversation.length, 5, "inbox + outbox 合并");
assert.deepEqual(conversation.map((m) => m.timestamp), [...conversation.map((m) => m.timestamp)].sort(),
  "会话按时间戳升序（乱序 seq 也按 at 排）");

const since = internals.readConversation(home, "w", "2026-08-22T02:00:00.000Z");
assert.equal(since.length, 2, "since 过滤：严格晚于的只有 seq3 与 o2");
assert.ok(since.every((m) => Date.parse(m.timestamp) > Date.parse("2026-08-22T02:00:00.000Z")));

const appended = internals.appendMessage(home, "w", {
  from: "lead", text: "mail", taskId: "T-7", replyTo: 1, idempotencyKey: "k-1"
});
assert.equal(appended.seq, 4, "appendMessage 接续最大 seq");
assert.equal(appended.taskId, "T-7", "关联键 taskId 落盘（11 号票形态改造）");
assert.equal(appended.replyTo, 1, "回信锚 replyTo 落盘");
assert.equal(appended.idempotencyKey, "k-1", "投递幂等锚落盘");
assert.equal("kind" in appended, false, "kind 枚举已废止");
const plain = internals.appendMessage(home, "w", { from: "user", text: "x" });
assert.equal("kind" in plain, false, "不再写 kind 字段");
assert.equal(plain.taskId, undefined, "无 taskId 时不写字段");
assert.equal(plain.replyTo, undefined, "无回信锚时不写字段");

console.log("✓ JSONL 容错解析 + 邮局语义（maxSeq/readAll/readOutbox/会话合并/since/taskId+replyTo 形态）");

// ---------- F-S15 修复：inbox seq 写锁（跨进程互斥） ----------

const { acquireMailSeqLock } = await import("../lib/mail-seq-lock.js");
const lockHome = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-fs15-"));
process.on("exit", () => fs.rmSync(lockHome, { recursive: true, force: true }));
const lockInbox = path.join(lockHome, "bots", "inbox", "race");
fs.mkdirSync(lockInbox, { recursive: true });

// 锁单测①：唯一获取；持锁时第二获取者超时；释放后可再获取且目录清理
{
  const lock = acquireMailSeqLock(lockInbox);
  let timedOut = false;
  try { acquireMailSeqLock(lockInbox, { spinMs: 150, tickMs: 10 }); }
  catch (error) { timedOut = /锁超时/.test(error.message); }
  assert.ok(timedOut, "持锁时第二获取者应超时");
  lock.release();
  const again = acquireMailSeqLock(lockInbox, { spinMs: 500, tickMs: 10 });
  again.release();
  assert.equal(fs.existsSync(path.join(lockInbox, ".seq.lock")), false, "释放后锁目录清理");
}

// 锁单测②：陈旧锁（mtime 超阈值）自动接管；他进程 owner 的锁保守释放不删
{
  const staleDir = path.join(lockHome, "bots", "inbox", "stale");
  fs.mkdirSync(staleDir, { recursive: true });
  const lockDir = path.join(staleDir, ".seq.lock");
  fs.mkdirSync(lockDir);
  const past = new Date(Date.now() - 10_000);
  fs.utimesSync(lockDir, past, past);
  const taken = acquireMailSeqLock(staleDir, { spinMs: 1000, tickMs: 10 });
  taken.release(); // 接管成功且可正常释放

  const foreignDir = path.join(lockHome, "bots", "inbox", "foreign");
  fs.mkdirSync(foreignDir, { recursive: true });
  const fLockDir = path.join(foreignDir, ".seq.lock");
  const mine = acquireMailSeqLock(foreignDir, { spinMs: 500, tickMs: 10 });
  // 篡改 owner 为他 pid 后 release——验证保守不删（防删掉接管者的新锁）
  fs.writeFileSync(path.join(fLockDir, "owner.json"), JSON.stringify({ pid: 999999, at: Date.now() }));
  mine.release();
  assert.equal(fs.existsSync(fLockDir), true, "owner 属他进程时保守不删锁目录");
  fs.rmSync(fLockDir, { recursive: true, force: true }); // 手工清理（泄漏目录现实路径＝后续陈旧接管自愈）
}

// 并发实测：4 子进程真并发各追加 25 条到同一 inbox（spawn + Promise.all——
// 不用 spawnSync，串行会掩盖竞态）；断言 100 条全在、seq 恰为 1..100 无撞无缺
{
  const { spawn: spawnAsync } = await import("node:child_process");
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const script = `
    import { internals } from ${JSON.stringify(path.join(repoRoot, "lib", "index.js"))};
    const home = ${JSON.stringify(lockHome)};
    for (let i = 0; i < 25; i++) internals.appendMessage(home, "race", { from: "p" + i, text: "m" + i });
  `;
  const children = [];
  for (let p = 0; p < 4; p += 1) {
    children.push(new Promise((resolve, reject) => {
      const child = spawnAsync(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => { err += d; });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`子进程退出 ${code}：${err.slice(0, 300)}`))));
    }));
  }
  await Promise.all(children);

  const lines = internals.readAllInboxLines(lockHome, "race");
  assert.equal(lines.length, 100, "4×25 条全在（零丢失）");
  const seqs = lines.map((m) => m.seq).sort((a, b) => a - b);
  const dup = seqs.some((s, i) => i > 0 && s === seqs[i - 1]);
  assert.equal(dup, false, "seq 零撞号");
  assert.deepEqual([seqs[0], seqs[seqs.length - 1], seqs.length], [1, 100, 100], "seq 恰为 1..100 连续无缺");
  assert.equal(fs.existsSync(path.join(lockInbox, ".seq.lock")), false, "并发结束后锁目录已清理");
}

console.log("✓ F-S15 修复：seq 写锁（唯一获取/陈旧接管/保守释放＋4 子进程×25 条真并发 0 丢失 0 撞号）");
process.exit(0);
