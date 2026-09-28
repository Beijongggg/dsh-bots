/**
 * 锁等待留痕（36 号票 A9 的可观测腿）。
 *
 * 为什么走宿主日志而不落新文件：知识库根顶层级是**封闭枚举**（`index.jsonl`／
 * `reports/`／`REPORT_TEMPLATE.md`／`.lock`，`V-A7.5`「共享侧无第三面」），在
 * 那里新落一个等待指标文件＝长出第三面，须走规格修订——故指标随宿主
 * `logger.warn` 单行落账（字段可解析），不新增文件面。
 *
 * 口径（两锁共用）：
 *   - 普通等待**超阈**（缺省 100ms：快路径毫秒级，超阈即有争用）才告警；
 *   - 接管（陈旧／死主锁）与超时**无条件**告警——低频且是关键信号；
 *   - 无 logger（测试夹具、工具脚本、未装配的面）静默：留痕不得成为新的失败点。
 */

/** 普通等待的告警阈值（缺省；调用方口径可覆盖）。 */
export const LOCK_WAIT_WARN_MS = 100;

/** 单行留痕：`lock/waitMs/outcome/takeover/holderPid/dir` 六字段可解析＝指标。 */
export function formatLockWait({ lock, dir, waitMs, outcome, tookOver = false, holderPid = null }) {
  return `[dsh-bots] 锁等待 lock=${lock} waitMs=${waitMs} outcome=${outcome}` +
    ` takeover=${tookOver ? 1 : 0} holderPid=${holderPid === null ? "unknown" : holderPid} dir=${dir}`;
}

/**
 * 造留痕出口：宿主 `logger.warn` 优先。返回的回调可作 `acquireLockDir` 的
 * `onWait`（也即两个锁模块透传的 `onWait`）。
 */
export function lockWaitSink(logger, { warnMs = LOCK_WAIT_WARN_MS } = {}) {
  return (info) => {
    if (info.outcome !== "timeout" && info.tookOver !== true && info.waitMs < warnMs) return;
    logger?.warn?.(formatLockWait(info));
  };
}
