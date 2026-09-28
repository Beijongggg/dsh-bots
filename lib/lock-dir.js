/**
 * 跨进程 lockdir 互斥核心（36 号票 A9 抽件）。
 *
 * 本体原分居 `lib/knowledge.js` 的 `acquireIndexLock` 与 `lib/mail-seq-lock.js`
 * 两份同型拷贝（K-1／F-S15 两处同修）：知识索引「读索引 → 分配 ID → 原子写回」
 * 与邮局 inbox「读最大 seq → 追加」都靠同一把 lockdir 写锁跨进程互斥，协议不
 * 该有两份实现——36 号票把两锁同批同口径收口，本模块即那唯一一份。
 *
 * 协议：
 *   - **获取**＝`mkdirSync(dir)` 原子抢占（目录创建唯一成功者）＋写
 *     `owner.json{pid, at}`（跨进程归属判定的唯一凭据）；
 *   - **等待**＝`tickMs` 步进自旋（`Atomics.wait` 睡眠），`spinMs` 内未获得即
 *     抛错——**`spinMs` 就是单次事件循环冻结的上限**（36 号票裁定：6000→1500，
 *     宿主 HTTP／SSE／台账 ticker 不再被独占数秒）；
 *   - **接管**＝两条判据：①持有者**已死**（`owner.json` 的 pid 经
 *     `process.kill(pid, 0)` 判为 `ESRCH`）→ 立即接管，不再等陈旧阈值——死主锁
 *     是最常见的一次性长等待（进程崩在临界区里），本快路把它从 `staleMs` 降到
 *     毫秒级；②无有效 pid 且目录 mtime 超过 `staleMs` → 沿用未知归属恢复。
 *     已知 pid 存活或无权探测时，即使目录陈旧也不接管；PID 复用同样保守超时。
 *     目录年龄不能证明活持有者已结束临界区。②是兼容旧锁的恢复机制，不能当作
 *     死亡证明；缺省保持 `spinMs > staleMs`，让未知归属可在等待窗口内恢复；
 *   - **接管前复核**＝rm 之前二次观测，`ino` 相同（还是同一把锁）且接管判据
 *     仍成立才删——收窄「删掉接管者新锁」的窗口（K-1 互斥不因快路退化）；
 *   - **释放**＝核对锁内 `owner.json` 的 pid：**仅确认仍属本进程才删**——已被
 *     他人接管、或 owner 不可读（无法证明归属）均不删（防「释放误删活锁」；
 *     泄漏的锁目录由后续获取者的接管自愈）；
 *   - **留痕**＝本次获取发生过争用（等待或接管）或超时，回调一次 `onWait(info)`；
 *     是否落账、落给谁由调用方决定（见 `lib/lock-trace.js`）。无争用的快路径
 *     不回调——不制造噪声。
 *
 * 前提：同一台机器上的进程共享该目录（与本协议既有的 pid 归属核对同前提）。
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 缺省参数（**两个锁共用的单一源**，36 号票裁定值）：`spinMs` 1500＝单次冻结
 * 上限；`staleMs` 1000 只用于无有效 pid 的陈旧锁恢复，不适用于活持有者；
 * `tickMs` 10＝自旋步进。参数回退改这一处（调用点也可
 * 按次覆盖 `{spinMs, staleMs, tickMs}`，无需新增配置面）。
 */
export const LOCK_DEFAULTS = Object.freeze({ spinMs: 1500, staleMs: 1000, tickMs: 10 });

/** 读一次锁目录状态；目录已消失 → null。pid 不可读/非法 → null（保守判据）。 */
function readLockState(dir) {
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    return null;
  }
  let pid = null;
  try {
    const owner = JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
    // process.kill 只接受有符号 32 位 pid；越界值是损坏归属，不能据探测异常判存活。
    if (Number.isInteger(owner?.pid) && owner.pid > 0 && owner.pid <= 0x7fffffff) pid = owner.pid;
  } catch {
    // owner 缺失/不可读/非法：归属不可证明，按下述保守判据处理
  }
  return { ino: stat.ino, mtimeMs: stat.mtimeMs, pid };
}

/** 进程是否仍在：`ESRCH`＝已死；其余（含 `EPERM`＝存在但不可信号）一律当存活。 */
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

/** 已知持有者只按死亡证明接管；归属不明时才用陈旧恢复。 */
function isAbandoned(state, staleMs) {
  if (state.pid !== null) return !pidAlive(state.pid);
  return Date.now() - state.mtimeMs > staleMs;
}

/**
 * 判定并接管被放弃的锁目录。返回 `{takenOver, holderPid, gone}`：
 * `gone`＝观测到锁目录已不在（他人接管或释放）——调用方立即重试获取，不必睡。
 */
function takeOverAbandoned(dir, staleMs) {
  const first = readLockState(dir);
  if (first === null) return { takenOver: false, holderPid: null, gone: true };
  if (!isAbandoned(first, staleMs)) return { takenOver: false, holderPid: first.pid, gone: false };
  // rm 前复核：仍观测到**同一把**锁且放弃判据仍成立，才删（防删掉接管者的新锁）
  const again = readLockState(dir);
  if (again === null) return { takenOver: false, holderPid: first.pid, gone: true };
  if (again.ino !== first.ino || !isAbandoned(again, staleMs)) {
    return { takenOver: false, holderPid: again.pid, gone: false };
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // 删除失败（EACCES／EBUSY 等）：**不得当作「已删除」**——调用方若据此立即重试，
    // 会变成无 sleep、无超时的紧循环（宿主线程 100% 占用且永不返回，比本票要消除的
    // 数秒冻结更糟）。落回自旋＋deadline，最终以 LOCK_TIMEOUT fail closed。
    return { takenOver: false, holderPid: again.pid, gone: false };
  }
  return { takenOver: true, holderPid: again.pid, gone: true };
}

/**
 * 获取锁目录互斥；成功返回句柄 `{waitMs, tookOver, release()}`——`waitMs`＝本次
 * 获取耗时（指标），`tookOver`＝期间是否接管过被放弃的锁。
 * `lockId`＝留痕字段用的锁标识（机器可读，如 `knowledge-index`）；`label`＝超时
 * 文案用的锁名（人读，缺省同 `lockId`）——两者刻意分开：文案给人与模型看，
 * 留痕字段给日志解析与指标用。
 * 超时抛错（文案＝`<锁名>超时（<spinMs>ms 内未获得）`；带 `code="LOCK_TIMEOUT"`、
 * `lockId`、`dir`、`waitMs`、`holderPid`），调用方据此 fail closed（可重试），
 * **不得吞错后无锁写入**。
 */
export function acquireLockDir(dir, {
  lockId = "lockdir",
  label = lockId,
  spinMs = LOCK_DEFAULTS.spinMs,
  staleMs = LOCK_DEFAULTS.staleMs,
  tickMs = LOCK_DEFAULTS.tickMs,
  onWait
} = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + spinMs;
  let tookOver = false;
  let contended = false;
  let holderPid = null;
  const report = (outcome) => {
    if (typeof onWait !== "function") return;
    try {
      onWait({ lockId, dir, outcome, tookOver, holderPid, waitMs: Date.now() - startedAt });
    } catch {
      // 留痕出口（宿主 logger）抛错不得成为新的失败点：取锁结论与超时语义照旧
      // ——否则一次日志故障就会让「已取得的锁」没有句柄可释放，或顶替 LOCK_TIMEOUT。
    }
  };

  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(join(dir, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }));
      if (contended) report("acquired"); // 有争用才留痕；无争用零回调
      return {
        waitMs: Date.now() - startedAt,
        tookOver,
        release() {
          let own = false;
          try {
            const owner = JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
            own = owner.pid === process.pid; // 已被他人接管 → false，不动别人的锁
          } catch {
            // owner 缺失/不可读：无法证明锁仍属本进程，保守不删（F-E：恰逢接管者
            // rm→mkdir 间隙时强删会删掉他人的新锁，制造无互斥临界区）；泄漏的锁
            // 目录由后续获取者的接管自愈。
          }
          if (!own) return;
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* 已被接管删除：无害 */ }
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      contended = true;
      const verdict = takeOverAbandoned(dir, staleMs);
      if (verdict.holderPid !== null) holderPid = verdict.holderPid;
      if (verdict.takenOver) tookOver = true;
      // deadline 每轮都判（先于任何 continue）：任何循环路径都受 spinMs 封顶，
      // 不存在「释放/接管后立即重试」演化成的无 sleep、无超时紧循环。
      if (Date.now() >= deadline) {
        report("timeout");
        const waitedMs = Date.now() - startedAt;
        const timeout = new Error(`${label}超时（${spinMs}ms 内未获得）`);
        timeout.code = "LOCK_TIMEOUT";
        timeout.lockId = lockId;
        timeout.dir = dir;
        timeout.waitMs = waitedMs;
        timeout.holderPid = holderPid;
        throw timeout;
      }
      if (verdict.takenOver || verdict.gone) continue; // 锁目录已释放/被接管：立即重试，不必睡
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, tickMs);
    }
  }
}
