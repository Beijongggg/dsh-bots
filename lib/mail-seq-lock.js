/**
 * 普通邮局 inbox seq 写锁（F-S15 修复：2026-09-04 用户指令「解决并发小竞态」，
 * 处置由「保留观察」升级为修复销账）。
 *
 * 竞态本体：appendMessage 的「读最大 seq → +1 → 追加」无互斥——宿主与各 bot
 * 是不同进程，并发时两方读到同一最大值 → seq 撞号（游标与 replyTo 依赖 seq
 * 唯一单调）。
 *
 * 36 号票 A9 起锁协议与 `lib/knowledge.js` 的索引写锁**同源**：实现在
 * `lib/lock-dir.js`（同一份代码、同一缺省参数 `LOCK_DEFAULTS`＝spinMs 1500／
 * staleMs 1000／tickMs 10），本模块只固定锁路径与锁名（超时文案、留痕字段
 * `lock=mail-seq`）并透传按次覆盖项——同型锁不再两份拷贝漂移。
 * 锁路径 `<inboxDir>/.seq.lock/`（点前缀＋目录形态，不与 messages.jsonl 及
 * `*.jsonl` 扫描面冲突）。
 */
import { join } from "node:path";

import { acquireLockDir } from "./lock-dir.js";

/** 获取某 bot inbox 的 seq 写锁（跨进程互斥）；语义与超时行为见 lib/lock-dir.js。 */
export function acquireMailSeqLock(inboxDir, options = {}) {
  return acquireLockDir(join(inboxDir, ".seq.lock"), {
    lock: "mail-seq",
    label: "邮局 seq 锁",
    ...options
  });
}
