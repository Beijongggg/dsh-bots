/**
 * 验收判据执行面的装配件（org-v2 25 号票；规格 §B 关闭前置第三条与 §E 探针接线）。
 *
 * 位置与职责：`lib/org/task-ledger.js` 只定义**注入缝**（`criterionRunnerFor`），
 * 本体不 import 探针与数据根；本件是那个缝的**唯一装配面**——宿主（`lib/index.js`）
 * 与端到端测试（`tests/org-closed-loop-smoke.test.mjs`）用同一个工厂，不停两份接线。
 *
 * 接线形态：
 *   - 判据真源＝调用方给的判据对象（**已由台账本体从任务投影的简报里取出**——
 *     简报是冻结件、派出即冻、改动只走 amend；模型无入口自带判据文本，同
 *     `lib/org/post-channel.js` 的「不得自报判据」口径）。
 *   - 执行＝`runCriterion`（白名单封闭、参数键逐字一致、沙箱快照、隔离子进程），
 *     机械面零放宽：本件只补执行上下文，不做任何放行判定。
 *   - `dshHome` 由调用方（台账门面）传入——执行面本体不猜数据根。
 */
import { runCriterion } from "./probe.js";

/**
 * 建执行面。`ctx` 由调用方一次给全（台账门面补 `dshHome`；`cwd`／`timeoutMs`／
 * `tmpdir`／`listMailAnomalies` 由宿主或测试给）。返回 `(criterion) => Promise<verdict>`，
 * 形状即 `createTaskLedger({ criterionRunnerFor })` 期望的返回值。
 */
function createCriterionRunner(ctx = {}) {
  return (criterion) => runCriterion(criterion, ctx);
}

/**
 * `createTaskLedger` 的注入件（宿主与测试同一装配路径）：
 *   `createTaskLedger({ ...criterionRunnerInjection({ cwd: repoRoot }), dshHome })`
 * `criterionRunCtx` 只带**非 dshHome** 的上下文——数据根由台账本体补，调用方少传一个
 * 可能与产出登记面漂移的值（判据坐标与产出登记读的必须是同一个数据根）。
 */
export function criterionRunnerInjection(ctx = {}) {
  return {
    criterionRunnerFor: (_taskId, taskCtx) => createCriterionRunner(taskCtx),
    criterionRunCtx: ctx
  };
}
