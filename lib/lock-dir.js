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
 *     毫秒级；②目录 mtime 超过 `staleMs`（持有进程卡死、或归属不可读的兜底）
 *     → 接管。pid 存活、缺失或不可读一律走②，**快路只是新增触发条件，从不
 *     取代慢路**：pid 被复用、跨用户在册等情况仍由 `staleMs` 自愈，不退化为
 *     永久待锁（故缺省保持 `spinMs > staleMs`）；
 *   - **接管前复核**＝rm 之前二次观测，`ino` 相同（还是同一把锁）且②的判据
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
 * 上限；`staleMs` 1000＝慢路接管快进（临界区为毫秒级文件读写，1s 仍是三个
 * 数量级的安全边际）；`tickMs` 10＝自旋步进。回退路径＝改这一处（调用点也可
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
    if (Number.isInteger(owner?.pid) && owner.pid > 0) pid = owner.pid;
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

/** 放弃判据（快路在前：死主免等；慢路兜底：陈旧）。 */
function isAbandoned(state, staleMs) {
  if (state.pid !== null && !pidAlive(state.pid)) return true;
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
    return { takenOver: false, holderPid: again.pid, gone: true }; // 恰被他人接管删除：无害
  }
  return { takenOver: true, holderPid: again.pid, gone: true };
}

/**
 * 获取锁目录互斥；成功返回句柄 `{waitMs, tookOver, release()}`——`waitMs`＝本次
 * 获取耗时（指标），`tookOver`＝期间是否接管过被放弃的锁。
 * `lock`＝留痕字段用的锁标识（机器可读，如 `knowledge-index`）；`label`＝超时
 * 文案用的锁名（人读，缺省同 `lock`）。
 * 超时抛错（文案含锁名、`spinMs` 与锁目录；`code="LOCK_TIMEOUT"`），调用方据此
 * fail closed（可重试），**不得吞错后无锁写入**。
 */
export function acquireLockDir(dir, {
  lock = "lockdir",
  label = lock,
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
    onWait({ lock, dir, outcome, tookOver, holderPid, waitMs: Date.now() - startedAt });
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
      if (verdict.takenOver || verdict.gone) continue; // 锁目录已释放/被接管：立即重试，不必睡
      if (Date.now() >= deadline) {
        report("timeout");
        const waitedMs = Date.now() - startedAt;
        const timeout = new Error(`${label}超时（${spinMs}ms 内未获得）：${dir}`);
        timeout.code = "LOCK_TIMEOUT";
        timeout.lock = lock;
        timeout.dir = dir;
        timeout.waitMs = waitedMs;
        timeout.holderPid = holderPid;
        throw timeout;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, tickMs);
    }
  }
}
