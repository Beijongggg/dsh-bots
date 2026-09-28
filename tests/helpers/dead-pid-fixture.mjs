/**
 * 夹具：一个**确证已死**的进程 pid（36 号票 A9 死主锁快路的用例前提）。
 *
 * 死主快路的判据是「`owner.json` 的 pid 经 `process.kill(pid, 0)` 报 `ESRCH`」，
 * 故夹具必须造出同一个事实：拉起一个子进程并**收割**它（`spawnSync` 返回即已
 * reap），再复核 `kill(pid, 0)` 确实报 `ESRCH`——僵尸（未 reap）与 pid 复用都
 * 会让例走成「归属不明」的保守路，夹具前提不成立时立刻炸，不静默降级。
 *
 * 多个锁测试共用此夹具，统一已死 pid 的确认方法。
 */
import { spawnSync } from "node:child_process";

/** 返回确证已死的 pid；夹具前提不成立时抛错。 */
export function deadPid() {
  const child = spawnSync(process.execPath, ["-e", ""]);
  if (child.status !== 0) throw new Error("取死 pid 的夹具子进程未正常退出");
  try {
    process.kill(child.pid, 0);
  } catch (error) {
    if (error?.code === "ESRCH") return child.pid;
    throw error;
  }
  throw new Error(`夹具前提不成立：pid ${String(child.pid)} 仍存活（未确证死亡）`);
}
