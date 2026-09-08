/**
 * Deterministic host flow for the frozen P0.3 main and repair chains.
 * This module creates invocations and route intents only; it never executes RPC.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { bothInitialsPresent } from "./review-protocol.js";
import { validateReviewEnvelope, envelopeHashes } from "./review-envelopes.js";
import { openDiscussion, readThreadState } from "./review-discussion.js";
import { createInvocation } from "./review-orchestrator.js";
import { createRouteIntent, reconcileRoutes } from "./review-relay.js";
import {
  writeFileDurable, appendAudit, readManifest, readArtifactState
} from "./review-store.js";

export function flowDir(dshHome) {
  return join(dshHome, "bots", "review", "flow");
}

export function flowFileFor(dshHome, taskId) {
  return join(flowDir(dshHome), `${taskId}.json`);
}

export function emptyFlow(taskId, { stage = "initials", reviewCycle = 1 } = {}) {
  return {
    taskId,
    reviewCycle,
    sourceSnapshotId: null,
    repairCycle: 0,
    stage,
    initials: [],
    deltaInvocationId: null,
    deltaArtifactId: null,
    deltaNextAction: null,
    discussionThreadId: null,
    discussionInvocationId: null,
    finalInvocationId: null,
    finalArtifactId: null,
    fixReportArtifactId: null,
    reinspection: [],
    recheckInitials: [],
    recheckDeltaInvocationId: null,
    recheckDeltaArtifactId: null,
    recheckDeltaNextAction: null,
    recheckDiscussionThreadId: null,
    recheckDiscussionInvocationId: null,
    recheckFinalInvocationId: null,
    recheckFinalArtifactId: null,
    closed: false,
    updatedAt: new Date().toISOString()
  };
}

export function readFlow(dshHome, taskId) {
  const file = flowFileFor(dshHome, taskId);
  if (!existsSync(file)) return null;
  // F-RV-4：损坏 flow 必须 fail closed（抛错），绝不返回 null 触发调用方重建，
  // 也不覆盖原文件；null 仅表示“文件不存在”。
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`flow 损坏（fail closed）：${file}（${error instanceof Error ? error.message : String(error)}）`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) || parsed.taskId !== taskId) {
    throw new Error(`flow schema 损坏（fail closed）：${file}`);
  }
  return parsed;
}

function saveFlow(dshHome, flow) {
  flow.updatedAt = new Date().toISOString();
  writeFileDurable(flowFileFor(dshHome, flow.taskId), `${JSON.stringify(flow)}\n`);
  return flow;
}

function committedStatus(status) {
  return ["submitted", "committed", "completed"].includes(status);
}

function envelopeEvidenceFile(dshHome, artifactId) {
  return join(dshHome, "bots", "review", "artifacts", artifactId, "review-envelope.json");
}

function bindEnvelopeEvidence(dshHome, artifactId, stage, envelope) {
  const evidence = { stage, ...envelopeHashes(envelope) };
  const file = envelopeEvidenceFile(dshHome, artifactId);
  if (existsSync(file)) {
    const existing = JSON.parse(readFileSync(file, "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(evidence)) throw new Error("artifact 已绑定不同 reviewer envelope");
    return evidence;
  }
  writeFileDurable(file, `${JSON.stringify(evidence)}\n`);
  return evidence;
}

function validateBoundArtifact(dshHome, { artifactId, taskId, stage, authorBotId, body = null }) {
  let manifest;
  try { manifest = readManifest(dshHome, artifactId); } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (!manifest) return { ok: false, reason: "artifact manifest 缺失" };
  if (manifest.taskId !== taskId || manifest.stage !== stage || manifest.authorBotId !== authorBotId) {
    return { ok: false, reason: "artifact task/stage/author 绑定不符" };
  }
  const state = readArtifactState(dshHome, artifactId);
  if (!state.ok || !committedStatus(state.status)) return { ok: false, reason: "artifact 未 committed" };
  if (typeof body === "string" && readFileSync(manifest.bodyPath, "utf8") !== body) {
    return { ok: false, reason: "artifact 正文不等于 envelope.body" };
  }
  return { ok: true };
}

function invocationParts(taskId, cycle, bindings) {
  return [
    `taskId=${taskId}`,
    `cycle=${String(cycle)}`,
    ...Object.entries(bindings).map(([key, value]) => `${key}=${String(value)}`)
  ];
}

/** Register either a blind initial review or a blind recheck initial review. */
export function registerInitial(dshHome, { taskId, stage, artifactId, status = "completed", envelope, sourceSnapshotId = null }) {
  if (!["initial-lead", "initial-second", "recheck-lead", "recheck-second"].includes(stage)) {
    throw new TypeError(`registerInitial stage 非法：${String(stage)}`);
  }
  if (typeof artifactId !== "string" || artifactId === "") throw new TypeError("artifactId 非空字符串");
  const authorBotId = stage.endsWith("-lead") ? "reviewer-lead" : "reviewer-second";
  const envelopeCheck = validateReviewEnvelope({ stage, envelope });
  if (!envelopeCheck.ok) throw new Error(`initial envelope 非法：${envelopeCheck.reason}`);
  const binding = validateBoundArtifact(dshHome, { artifactId, taskId, stage, authorBotId, body: envelope.body });
  if (!binding.ok) throw new Error(`initial artifact 非法：${binding.reason}`);
  bindEnvelopeEvidence(dshHome, artifactId, stage, envelope);
  if (status !== "completed") throw new Error("initial invocation/output 必须 completed");
  let flow = readFlow(dshHome, taskId) ?? emptyFlow(taskId);
  // F-RV-13：flow 锚定唯一 sourceSnapshotId（首次登记绑定；后续必须一致）。
  if (typeof sourceSnapshotId === "string" && sourceSnapshotId !== "") {
    if (flow.sourceSnapshotId !== null && flow.sourceSnapshotId !== sourceSnapshotId) {
      throw new Error(`flow 已绑定 snapshot=${flow.sourceSnapshotId}，拒绝改绑 ${sourceSnapshotId}（F-RV-13）`);
    }
    flow.sourceSnapshotId = sourceSnapshotId;
  }
  const collection = stage.startsWith("recheck-") ? flow.recheckInitials : flow.initials;
  const sameStage = collection.find((entry) => entry.stage === stage);
  if (sameStage && sameStage.artifactId !== artifactId) throw new Error(`${stage} 已登记不同 artifact`);
  if (!sameStage) collection.push({ stage, artifactId, status });
  else if (committedStatus(status)) sameStage.status = status;
  return saveFlow(dshHome, flow);
}

function routeSecondInitialAfterGate(dshHome, artifactId, stage) {
  const authorBotId = "reviewer-second";
  const intent = createRouteIntent(dshHome, { artifactId, stage, authorBotId });
  if (!intent.ok) return { completed: false, reason: intent.reason };
  return reconcileRoutes(dshHome, { artifactId, stage, authorBotId });
}

function createLeadInvocation(dshHome, {
  taskId, cycle, artifactId, stage, idempotencyKey, bindings, sourceSnapshotId
}) {
  return createInvocation(dshHome, {
    taskId,
    artifactId,
    stage,
    targetReviewer: "reviewer-lead",
    createdBy: "host",
    idempotencyKey,
    parts: invocationParts(taskId, cycle, bindings),
    sourceSnapshotId
  });
}

/**
 * Advance task-spec → blind initials → delta-lead → optional R1/R2 → final-lead.
 * deltaArtifactId/deltaEnvelope represent a committed delta reviewer output.
 */
export async function advanceMainFlow(dshHome, {
  taskId,
  reviewCycle = 1,
  deltaArtifactId = null,
  deltaEnvelope = null,
  discussionThreadId = null
}) {
  let flow = readFlow(dshHome, taskId) ?? emptyFlow(taskId, { reviewCycle });
  if (!flow.deltaInvocationId && !flow.deltaArtifactId) flow.reviewCycle = reviewCycle;
  if (flow.reviewCycle !== reviewCycle) {
    return { step: "review-cycle-mismatch", reason: `flow=${flow.reviewCycle}, input=${reviewCycle}`, flow };
  }
  if (flow.finalArtifactId) return { step: "final-done", flow };

  if (!bothInitialsPresent(flow.initials)) {
    return { step: "awaiting-both-initials", flow };
  }
  const leadInitial = flow.initials.find((entry) => entry.stage === "initial-lead");
  const secondInitial = flow.initials.find((entry) => entry.stage === "initial-second");

  if (!flow.deltaInvocationId) {
    const route = routeSecondInitialAfterGate(dshHome, secondInitial.artifactId, "initial-second");
    if (!route.completed) {
      appendAudit(dshHome, { type: "flow-initial-second-route-incomplete", taskId, reason: JSON.stringify(route) });
      return { step: "initial-second-route-incomplete", reason: route.reason ?? JSON.stringify(route), flow };
    }
    const invocation = createLeadInvocation(dshHome, {
      taskId,
      cycle: reviewCycle,
      artifactId: secondInitial.artifactId,
      stage: "delta-lead",
      idempotencyKey: `review-invocation:${taskId}:${reviewCycle}:delta-lead`,
      bindings: { leadInitialArtifactId: leadInitial.artifactId, secondInitialArtifactId: secondInitial.artifactId },
      sourceSnapshotId: flow.sourceSnapshotId
    });
    flow.deltaInvocationId = invocation.invocationId;
    flow.stage = "delta-lead";
    saveFlow(dshHome, flow);
    if (!deltaArtifactId) return { step: "delta-invoked", flow };
  }

  if (!flow.deltaArtifactId && (deltaArtifactId || deltaEnvelope)) {
    if (typeof deltaArtifactId !== "string" || deltaArtifactId === "") {
      return { step: "delta-envelope-invalid", reason: "deltaArtifactId 非空字符串", flow };
    }
    const check = validateReviewEnvelope({ stage: "delta-lead", envelope: deltaEnvelope });
    if (!check.ok) return { step: "delta-envelope-invalid", reason: check.reason, flow };
    const binding = validateBoundArtifact(dshHome, {
      artifactId: deltaArtifactId, taskId, stage: "delta-lead", authorBotId: "reviewer-lead", body: deltaEnvelope.body
    });
    if (!binding.ok) return { step: "delta-envelope-invalid", reason: binding.reason, flow };
    try { bindEnvelopeEvidence(dshHome, deltaArtifactId, "delta-lead", deltaEnvelope); }
    catch (error) { return { step: "delta-envelope-invalid", reason: error.message, flow }; }
    flow.deltaArtifactId = deltaArtifactId;
    flow.deltaNextAction = deltaEnvelope.nextAction;
    // F-RV-13：先持久化 delta 注册，admission 才能批准 discussion/final 创建。
    saveFlow(dshHome, flow);

    if (deltaEnvelope.nextAction === "discussion") {
      const threadId = discussionThreadId ?? `discussion-${reviewCycle}`;
      const opened = openDiscussion(dshHome, {
        taskId,
        cycleId: reviewCycle,
        threadId,
        deltaArtifactId,
        stage: "delta-lead",
        envelope: deltaEnvelope,
        sourceSnapshotId: flow.sourceSnapshotId
      });
      flow.discussionThreadId = threadId;
      flow.discussionInvocationId = opened.invocationId;
      flow.stage = "discussion-second";
      saveFlow(dshHome, flow);
      return { step: "discussion-invoked", flow, discussion: opened };
    }

    const finalInvocation = createLeadInvocation(dshHome, {
      taskId,
      cycle: reviewCycle,
      artifactId: deltaArtifactId,
      stage: "final-lead",
      idempotencyKey: `review-invocation:${taskId}:${reviewCycle}:final-lead`,
      bindings: { deltaArtifactId },
      sourceSnapshotId: flow.sourceSnapshotId
    });
    flow.finalInvocationId = finalInvocation.invocationId;
    flow.stage = "final-lead";
    saveFlow(dshHome, flow);
    return { step: "final-invoked", flow };
  }

  if (flow.discussionThreadId && !flow.finalInvocationId) {
    const thread = readThreadState(dshHome, taskId, reviewCycle, flow.discussionThreadId);
    if (thread?.closed && thread.finalInvocationId) {
      flow.finalInvocationId = thread.finalInvocationId;
      flow.stage = "final-lead";
      saveFlow(dshHome, flow);
      return { step: "final-invoked", flow };
    }
    return { step: "awaiting-discussion-r2", flow };
  }
  return { step: flow.finalInvocationId ? "awaiting-final" : "awaiting-delta", flow };
}

/** Route a committed final-lead artifact to exactly reviewer-second + user-facing. */
export function registerFinal(dshHome, { taskId, artifactId, envelope, copyToUserFacing = null }) {
  let flow = readFlow(dshHome, taskId) ?? emptyFlow(taskId);
  if (!flow.finalInvocationId) return { ok: false, reason: "final-lead invocation 前置缺失", flow };
  const check = validateReviewEnvelope({ stage: "final-lead", envelope });
  if (!check.ok) return { ok: false, reason: check.reason, flow };
  const binding = validateBoundArtifact(dshHome, {
    artifactId, taskId, stage: "final-lead", authorBotId: "reviewer-lead", body: envelope.body
  });
  if (!binding.ok) return { ok: false, reason: binding.reason, flow };
  try { bindEnvelopeEvidence(dshHome, artifactId, "final-lead", envelope); }
  catch (error) { return { ok: false, reason: error.message, flow }; }
  if (flow.finalArtifactId && flow.finalArtifactId !== artifactId) {
    appendAudit(dshHome, { type: "flow-final-conflict", taskId, existing: flow.finalArtifactId, incoming: artifactId });
    return { ok: false, reason: "final-lead 已存在且不一致", flow };
  }
  const intent = createRouteIntent(dshHome, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  const reconcile = intent.ok
    ? reconcileRoutes(dshHome, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead", copyToUserFacing })
    : { completed: false, reason: intent.reason };
  if (reconcile.completed) {
    flow.finalArtifactId = artifactId;
    flow.stage = "user-decision";
  }
  saveFlow(dshHome, flow);
  return { ok: reconcile.completed, flow, reconcile, recipients: intent.recipients ?? [] };
}

/**
 * Advance authorized fix-report → blind rechecks → recheck-delta-lead →
 * optional R1/R2 → recheck-final-lead.
 */
export function advanceFixFlow(dshHome, {
  taskId,
  fixReportArtifactId,
  engineeringBotId,
  repairCycle = 1,
  recheckDeltaArtifactId = null,
  recheckDeltaEnvelope = null,
  discussionThreadId = null
}) {
  let flow = readFlow(dshHome, taskId) ?? emptyFlow(taskId);
  if (flow.recheckFinalArtifactId) return { step: "recheck-final-done", flow };
  if (typeof fixReportArtifactId !== "string" || fixReportArtifactId === "") throw new TypeError("fixReportArtifactId 非空字符串");
  if (typeof engineeringBotId !== "string" || engineeringBotId === "") throw new TypeError("engineeringBotId 非空字符串");
  const fixBinding = validateBoundArtifact(dshHome, {
    artifactId: fixReportArtifactId, taskId, stage: "fix-report", authorBotId: engineeringBotId
  });
  if (!fixBinding.ok) return { step: "fix-report-invalid", reason: fixBinding.reason, flow };
  flow.repairCycle = repairCycle;
  flow.fixReportArtifactId = fixReportArtifactId;
  // F-RV-13：先持久化 fix-report 注册，admission 才能批准复检双席创建。
  saveFlow(dshHome, flow);

  if (flow.reinspection.length === 0) {
    const intent = createRouteIntent(dshHome, {
      artifactId: fixReportArtifactId,
      stage: "fix-report",
      authorBotId: engineeringBotId
    });
    const routed = intent.ok
      ? reconcileRoutes(dshHome, { artifactId: fixReportArtifactId, stage: "fix-report", authorBotId: engineeringBotId })
      : { completed: false, reason: intent.reason };
    if (!routed.completed) return { step: "fix-report-route-incomplete", reason: routed.reason ?? JSON.stringify(routed), flow };
    const lead = createInvocation(dshHome, {
      taskId, artifactId: fixReportArtifactId, stage: "recheck-lead", targetReviewer: "reviewer-lead",
      createdBy: "host", idempotencyKey: `review-invocation:${taskId}:${repairCycle}:recheck-lead`,
      parts: invocationParts(taskId, repairCycle, { fixReportArtifactId }),
      sourceSnapshotId: flow.sourceSnapshotId
    });
    const second = createInvocation(dshHome, {
      taskId, artifactId: fixReportArtifactId, stage: "recheck-second", targetReviewer: "reviewer-second",
      createdBy: "host", idempotencyKey: `review-invocation:${taskId}:${repairCycle}:recheck-second`,
      parts: invocationParts(taskId, repairCycle, { fixReportArtifactId }),
      sourceSnapshotId: flow.sourceSnapshotId
    });
    flow.reinspection = [
      { reviewer: "reviewer-lead", stage: "recheck-lead", invocationId: lead.invocationId },
      { reviewer: "reviewer-second", stage: "recheck-second", invocationId: second.invocationId }
    ];
    flow.stage = "recheck-initials";
    saveFlow(dshHome, flow);
    return { step: "recheck-initials-invoked", flow };
  }

  if (!bothInitialsPresent(flow.recheckInitials)) return { step: "awaiting-both-recheck-initials", flow };
  const leadInitial = flow.recheckInitials.find((entry) => entry.stage === "recheck-lead");
  const secondInitial = flow.recheckInitials.find((entry) => entry.stage === "recheck-second");

  if (!flow.recheckDeltaInvocationId) {
    const route = routeSecondInitialAfterGate(dshHome, secondInitial.artifactId, "recheck-second");
    if (!route.completed) return { step: "recheck-second-route-incomplete", reason: route.reason ?? JSON.stringify(route), flow };
    const invocation = createLeadInvocation(dshHome, {
      taskId,
      cycle: repairCycle,
      artifactId: secondInitial.artifactId,
      stage: "recheck-delta-lead",
      idempotencyKey: `review-invocation:${taskId}:${repairCycle}:recheck-delta-lead`,
      bindings: { recheckLeadArtifactId: leadInitial.artifactId, recheckSecondArtifactId: secondInitial.artifactId },
      sourceSnapshotId: flow.sourceSnapshotId
    });
    flow.recheckDeltaInvocationId = invocation.invocationId;
    flow.stage = "recheck-delta-lead";
    saveFlow(dshHome, flow);
    if (!recheckDeltaArtifactId) return { step: "recheck-delta-invoked", flow };
  }

  if (!flow.recheckDeltaArtifactId && (recheckDeltaArtifactId || recheckDeltaEnvelope)) {
    if (typeof recheckDeltaArtifactId !== "string" || recheckDeltaArtifactId === "") {
      return { step: "recheck-delta-envelope-invalid", reason: "recheckDeltaArtifactId 非空字符串", flow };
    }
    const check = validateReviewEnvelope({ stage: "recheck-delta-lead", envelope: recheckDeltaEnvelope });
    if (!check.ok) return { step: "recheck-delta-envelope-invalid", reason: check.reason, flow };
    const binding = validateBoundArtifact(dshHome, {
      artifactId: recheckDeltaArtifactId, taskId, stage: "recheck-delta-lead",
      authorBotId: "reviewer-lead", body: recheckDeltaEnvelope.body
    });
    if (!binding.ok) return { step: "recheck-delta-envelope-invalid", reason: binding.reason, flow };
    try { bindEnvelopeEvidence(dshHome, recheckDeltaArtifactId, "recheck-delta-lead", recheckDeltaEnvelope); }
    catch (error) { return { step: "recheck-delta-envelope-invalid", reason: error.message, flow }; }
    flow.recheckDeltaArtifactId = recheckDeltaArtifactId;
    flow.recheckDeltaNextAction = recheckDeltaEnvelope.nextAction;
    // F-RV-13：先持久化 recheck-delta 注册，admission 才能批准 discussion/final 创建。
    saveFlow(dshHome, flow);
    if (recheckDeltaEnvelope.nextAction === "discussion") {
      const threadId = discussionThreadId ?? `recheck-discussion-${repairCycle}`;
      const opened = openDiscussion(dshHome, {
        taskId,
        cycleId: `repair-${repairCycle}`,
        threadId,
        deltaArtifactId: recheckDeltaArtifactId,
        stage: "recheck-delta-lead",
        envelope: recheckDeltaEnvelope,
        sourceSnapshotId: flow.sourceSnapshotId
      });
      flow.recheckDiscussionThreadId = threadId;
      flow.recheckDiscussionInvocationId = opened.invocationId;
      flow.stage = "recheck-discussion-second";
      saveFlow(dshHome, flow);
      return { step: "recheck-discussion-invoked", flow, discussion: opened };
    }
    const finalInvocation = createLeadInvocation(dshHome, {
      taskId,
      cycle: repairCycle,
      artifactId: recheckDeltaArtifactId,
      stage: "recheck-final-lead",
      idempotencyKey: `review-invocation:${taskId}:${repairCycle}:recheck-final-lead`,
      bindings: { recheckDeltaArtifactId },
      sourceSnapshotId: flow.sourceSnapshotId
    });
    flow.recheckFinalInvocationId = finalInvocation.invocationId;
    flow.stage = "recheck-final-lead";
    saveFlow(dshHome, flow);
    return { step: "recheck-final-invoked", flow };
  }

  if (flow.recheckDiscussionThreadId && !flow.recheckFinalInvocationId) {
    const thread = readThreadState(dshHome, taskId, `repair-${repairCycle}`, flow.recheckDiscussionThreadId);
    if (thread?.closed && thread.finalInvocationId) {
      flow.recheckFinalInvocationId = thread.finalInvocationId;
      flow.stage = "recheck-final-lead";
      saveFlow(dshHome, flow);
      return { step: "recheck-final-invoked", flow };
    }
    return { step: "awaiting-recheck-discussion-r2", flow };
  }
  return { step: flow.recheckFinalInvocationId ? "awaiting-recheck-final" : "awaiting-recheck-delta", flow };
}

/** Route a committed recheck-final-lead artifact to the frozen recipient set. */
export function registerRecheckFinal(dshHome, { taskId, artifactId, envelope, copyToUserFacing = null }) {
  let flow = readFlow(dshHome, taskId) ?? emptyFlow(taskId);
  if (!flow.recheckFinalInvocationId) return { ok: false, reason: "recheck-final-lead invocation 前置缺失", flow };
  const check = validateReviewEnvelope({ stage: "recheck-final-lead", envelope });
  if (!check.ok) return { ok: false, reason: check.reason, flow };
  const binding = validateBoundArtifact(dshHome, {
    artifactId, taskId, stage: "recheck-final-lead", authorBotId: "reviewer-lead", body: envelope.body
  });
  if (!binding.ok) return { ok: false, reason: binding.reason, flow };
  try { bindEnvelopeEvidence(dshHome, artifactId, "recheck-final-lead", envelope); }
  catch (error) { return { ok: false, reason: error.message, flow }; }
  if (flow.recheckFinalArtifactId && flow.recheckFinalArtifactId !== artifactId) {
    return { ok: false, reason: "recheck-final-lead 已登记不同 artifact", flow };
  }
  const intent = createRouteIntent(dshHome, { artifactId, stage: "recheck-final-lead", authorBotId: "reviewer-lead" });
  const reconcile = intent.ok
    ? reconcileRoutes(dshHome, { artifactId, stage: "recheck-final-lead", authorBotId: "reviewer-lead", copyToUserFacing })
    : { completed: false, reason: intent.reason };
  if (reconcile.completed) {
    flow.recheckFinalArtifactId = artifactId;
    flow.stage = "user-decision";
  }
  saveFlow(dshHome, flow);
  return { ok: reconcile.completed, flow, reconcile, recipients: intent.recipients ?? [] };
}
