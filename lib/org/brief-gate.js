/**
 * 台账命令面的简报前置门（org-v2 23 号票⑤：自 `lib/org/task-ledger.js` 拆出——
 * 台账逾千行一票多因，简报前置校验自成一块）。校验器本体在 `lib/org/brief.js`，
 * 本件只做「校验结论 → 台账拒绝件」的映射与四命令的 placement：
 *   - `task.intake`（creates）：简报在场即须合法（可携带）；
 *   - `task.plan`：同 intake（立项产出简报，可携带）；
 *   - `task.amend`：必须携带完整合法件（冻结件只允许被完整合法件置换）＋冻结
 *     复核点不可降级（19 号票①，规格 §C「可加审不可免审」）；
 *   - `task.assign`：派出即冻结——简报须已在且合法（07 号票，`V-A2.4`）。
 *
 * 19 号票④分码：判据缺口与结构违规同判 fail closed、不同拒绝码——缺口＝
 * `criteria-gap`（先分解为可观测项，分解不出来标 needs-user 上浮），结构违规＝
 * `invalid-brief`（只可改件）；两类同时在案结构违规优先、缺口原因仍随理由可见。
 * 拒绝码与理由文本逐字保持，行为保持由既有台账回归锁定。
 */
import { droppedReviewPoints, validateBrief } from "./brief.js";

/**
 * 简报校验结论 → 拒绝码与理由；合法返回 null（07 号票：简报入事实源必校验）。
 */
export function briefReject(brief) {
  const verdict = validateBrief(brief);
  if (verdict.ok) return null;
  if (verdict.violations.length > 0) {
    const parts = verdict.gap !== null ? [...verdict.violations, verdict.gap.reason] : verdict.violations;
    return { code: "invalid-brief", reason: `四要素简报不合法（fail closed）：${parts.join("；")}` };
  }
  return { code: "criteria-gap", reason: `简报判据缺口（fail closed）：${verdict.gap.reason}` };
}

/**
 * 命令面简报前置门（plan／amend／assign 三命令的统一入口；intake 在 creates
 * 分支内以 briefReject 直查——其拒绝序位在 class 校验之后、supersedes 校验之前，
 * 单独保留）。返回拒绝件 `{code, reason}` 或 null（放行）。
 * 入参＝命令确定性层已备好的三件：spec.type／payload／当前任务投影（existing）。
 */
export function briefGate({ type, payload, existing } = {}) {
  if (type === "plan" && payload?.brief !== undefined && payload.brief !== null) {
    return briefReject(payload.brief);
  }
  if (type === "amend") {
    if (payload?.brief === undefined || payload.brief === null) {
      return { code: "invalid-brief", reason: "amend 必须携带完整简报（冻结件只允许被完整合法件置换）" };
    }
    const denied = briefReject(payload.brief);
    if (denied !== null) return denied;
    // 冻结复核点不可降级（19 号票①；规格 §C「可加审不可免审」在 amend 通道
    // 兑现——08 号票已在 review.request 通道把守降级请求，本门守置换件的
    // 删减与整体省略，拒绝回执逐点可归因）
    const dropped = droppedReviewPoints(existing?.brief, payload.brief);
    if (dropped.length > 0) {
      return {
        code: "review-exemption-forbidden",
        reason: `amend 置换件删减已冻结复核点（${dropped.join("、")}）——可加审不可免审，免审不得经置换或省略兑现`
      };
    }
    return null;
  }
  if (type === "assign") {
    if (existing?.brief === null || existing?.brief === undefined) {
      return {
        code: "brief-missing",
        reason: "派出即冻结：简报须在派单前成形（intake/plan/amend 携带）——无契约不得派单"
      };
    }
    return briefReject(existing.brief);
  }
  return null;
}
