/**
 * 普通邮局 inbox seq 写锁（F-S15 修复：2026-09-04 用户指令「解决并发小竞态」，
 * 处置由「保留观察」升级为修复销账）。
 *
 * 竞态本体：appendMessage 的「读最大 seq → +1 → 追加」无互斥——宿主与各 bot
 * 是不同进程（bot→bot 路由会让他 bot 进程写同一 inbox），并发时两方读到同一
 * 最大值 → seq 撞号（游标与 replyTo 依赖 seq 唯一单调）。
 *
 * 锁语义与 lib/knowledge.js acquireIndexLock 同型（K-1 修复的既证模式）：
 *   - lockdir mkdir 原子获取＋owner.json {pid, at}；
 *   - 竞争短自旋（tickMs），超时（spinMs）抛错——调用方不得吞错后无锁写入；
 *   - 陈旧接管：目录 mtime 超过 staleMs 即删锁重试（临界区为毫秒级读＋追加，
 *     3s 陈旧阈值实际不会误伤存活持有者）；
 *   - 保守释放：owner 无法证明属本进程时不删（防删掉接管者的新锁）；泄漏的
 *     锁目录由后续获取者的陈旧接管自愈。
 * 锁路径 <inboxDir>/.seq.lock/（点前缀＋目录形态，不与 messages.jsonl 及
 * *.jsonl 扫描面冲突）。
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** 获取某 bot inbox 的 seq 写锁（跨进程互斥）。 */
export function acquireMailSeqLock(inboxDir, { spinMs = 6000, staleMs = 3000, tickMs = 5 } = {}) {
  const dir = join(inboxDir, ".seq.lock");
  const deadline = Date.now() + spinMs;
  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(join(dir, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }));
      return {
        release() {
          let own = false;
          try {
            const owner = JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
            own = owner.pid === process.pid; // 已被他人接管 → 不动别人的锁
          } catch {
            // owner 缺失/不可读：无法证明锁仍属本进程，保守不删；泄漏目录由
            // 后续获取者的陈旧接管（>staleMs）自愈。
          }
          if (!own) return;
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* 已被接管删除：无害 */ }
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(dir).mtimeMs > staleMs) {
          rmSync(dir, { recursive: true, force: true }); // 陈旧接管：删除重试
          continue;
        }
      } catch {
        // 目录恰逢释放/接管删除：重试获取
      }
      if (Date.now() >= deadline) {
        throw new Error(`邮局 seq 锁超时（${spinMs}ms 内未获得）：${dir}`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, tickMs);
    }
  }
}
