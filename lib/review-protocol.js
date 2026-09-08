/**
 * Frozen review protocol tables from PLAN-expanded-engineering.md P0.3.
 * This module is intentionally pure: stages, authors, recipients and host
 * transitions are closed enumerations. Callers cannot narrow or widen routes.
 */

export const STAGES = Object.freeze([
  "task-spec",
  "initial-lead",
  "initial-second",
  "delta-lead",
  "discussion-second",
  "final-lead",
  "fix-report",
  "recheck-lead",
  "recheck-second",
  "recheck-delta-lead",
  "recheck-discussion-second",
  "recheck-final-lead",
  "user-decision"
]);

export const STAGE_CONST = Object.freeze(Object.fromEntries(STAGES.map((stage) => [stage, stage])));

export const STAGE_AUTHORS = Object.freeze({
  "task-spec": "user",
  "initial-lead": "reviewer-lead",
  "initial-second": "reviewer-second",
  "delta-lead": "reviewer-lead",
  "discussion-second": "reviewer-second",
  "final-lead": "reviewer-lead",
  "fix-report": null,
  "recheck-lead": "reviewer-lead",
  "recheck-second": "reviewer-second",
  "recheck-delta-lead": "reviewer-lead",
  "recheck-discussion-second": "reviewer-second",
  "recheck-final-lead": "reviewer-lead",
  "user-decision": "user"
});

export const STAGE_RECIPIENTS = Object.freeze({
  "task-spec": [],
  "initial-lead": [],
  "initial-second": ["reviewer-lead"],
  "delta-lead": ["reviewer-lead"],
  "discussion-second": ["reviewer-second"],
  "final-lead": ["reviewer-second", "user-facing"],
  "fix-report": ["reviewer-lead", "reviewer-second"],
  "recheck-lead": [],
  "recheck-second": ["reviewer-lead"],
  "recheck-delta-lead": ["reviewer-lead"],
  "recheck-discussion-second": ["reviewer-second"],
  "recheck-final-lead": ["reviewer-second", "user-facing"],
  "user-decision": []
});

export const RECIPIENT_SPACE = Object.freeze([
  "reviewer-lead",
  "reviewer-second",
  "user-facing"
]);

export const STAGE_TRANSITIONS = Object.freeze({
  "task-spec": ["initial-lead", "initial-second"],
  "initial-lead": ["delta-lead"],
  "initial-second": ["delta-lead"],
  "delta-lead": ["discussion-second", "final-lead"],
  "discussion-second": ["final-lead"],
  "final-lead": ["user-decision"],
  // Only the host may take this edge, and only for a user choice authorizing repair.
  "user-decision": ["fix-report"],
  "fix-report": ["recheck-lead", "recheck-second"],
  "recheck-lead": ["recheck-delta-lead"],
  "recheck-second": ["recheck-delta-lead"],
  "recheck-delta-lead": ["recheck-discussion-second", "recheck-final-lead"],
  "recheck-discussion-second": ["recheck-final-lead"],
  "recheck-final-lead": ["user-decision"]
});

function sameRecipientSet(actual, required) {
  if (actual.length !== required.length) return false;
  if (new Set(actual).size !== actual.length) return false;
  return actual.every((recipient) => required.includes(recipient));
}

/**
 * Validate the closed stage/author/recipient contract.
 * Omitted recipients are filled by the host. Supplied recipients must equal
 * the complete required set, order-independently; subsets and supersets fail.
 */
export function validateStageCombination({ stage, authorBotId, recipients = null }) {
  if (typeof stage !== "string" || !STAGES.includes(stage)) {
    return { ok: false, reason: `未知 stage：${String(stage)}` };
  }
  if (typeof authorBotId !== "string" || authorBotId === "") {
    return { ok: false, reason: "authorBotId 必须为非空字符串" };
  }
  const fixedAuthor = STAGE_AUTHORS[stage];
  if (fixedAuthor !== null && authorBotId !== fixedAuthor) {
    return { ok: false, reason: `stage=${stage} 作者必须为 ${fixedAuthor}（实际 ${authorBotId}）` };
  }

  const required = STAGE_RECIPIENTS[stage];
  if (recipients === null || recipients === undefined) {
    return { ok: true, stage, recipients: [...required] };
  }
  if (!Array.isArray(recipients) || recipients.some((recipient) => typeof recipient !== "string")) {
    return { ok: false, reason: "recipients 必须为字符串数组（或省略）" };
  }
  if (!sameRecipientSet(recipients, required)) {
    return {
      ok: false,
      reason: `stage=${stage} required recipients 由 host 固定，不得缩小/扩大（required=${JSON.stringify(required)}）`
    };
  }
  return { ok: true, stage, recipients: [...required] };
}

export function validateStageTransition({ from, to }) {
  if (!STAGES.includes(to)) return { ok: false, reason: `目标 stage 非法：${String(to)}` };
  if (from === null || from === undefined) {
    return to === "task-spec"
      ? { ok: true }
      : { ok: false, reason: `非法首发 stage：${to}（必须为 task-spec）` };
  }
  if (!STAGES.includes(from)) return { ok: false, reason: `源 stage 非法：${String(from)}` };
  const allowed = STAGE_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return { ok: false, reason: `非法转移：${from} → ${to}（允许：${allowed.join(",")}）` };
  }
  return { ok: true };
}

const PRESENT_STATUSES = new Set(["completed"]);

/** True when either frozen blind pair is fully present and committed/completed. */
export function bothInitialsPresent(initialStates) {
  if (!Array.isArray(initialStates)) return false;
  const present = (stage) => initialStates.some((entry) =>
    entry?.stage === stage && PRESENT_STATUSES.has(entry.status));
  return (present("initial-lead") && present("initial-second")) ||
    (present("recheck-lead") && present("recheck-second"));
}

/**
 * F-RV-13：可信创建边界 admission——按当前 flow 状态机械断言可合法创建的下一阶段
 * invocation stage（冻结 13-stage 表的确定性投影）。空数组 = 该状态无合法下一步，
 * 任何新的创建必须拒绝。flow=null（新任务尚无流程）→ 只允许盲审双席 initial。
 */
export function expectedNextStages(flow) {
  if (flow === null || flow === undefined) {
    return ["initial-lead", "initial-second"];
  }
  // 复检（repair）链优先：一旦进入复检流程，只允许复检阶段的下一步。
  const recheckActive = flow.reinspection.length > 0
    || flow.recheckDeltaInvocationId || flow.recheckDeltaArtifactId
    || flow.recheckDiscussionThreadId || flow.recheckFinalInvocationId
    || flow.recheckFinalArtifactId || bothInitialsPresent(flow.recheckInitials);
  if (recheckActive) {
    if (!bothInitialsPresent(flow.recheckInitials)) return ["recheck-lead", "recheck-second"];
    if (!flow.recheckDeltaInvocationId) return ["recheck-delta-lead"];
    if (!flow.recheckDeltaArtifactId) return [];
    if (flow.recheckDeltaNextAction === "discussion") {
      if (!flow.recheckDiscussionInvocationId) return ["recheck-discussion-second"];
      if (!flow.recheckFinalInvocationId) return ["recheck-final-lead"];
      return [];
    }
    if (!flow.recheckFinalInvocationId) return ["recheck-final-lead"];
    return [];
  }
  // 主链：fix-report 已接受（复检尚未启动）→ 首建复检双席盲审
  if (flow.fixReportArtifactId) return ["recheck-lead", "recheck-second"];
  if (!bothInitialsPresent(flow.initials)) return ["initial-lead", "initial-second"];
  if (!flow.deltaInvocationId) return ["delta-lead"];
  if (!flow.deltaArtifactId) return [];
  if (flow.deltaNextAction === "discussion") {
    if (!flow.discussionInvocationId) return ["discussion-second"];
    if (!flow.finalInvocationId) return ["final-lead"];
    return [];
  }
  if (!flow.finalInvocationId) return ["final-lead"];
  return [];
}
