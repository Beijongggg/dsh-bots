/**
 * Frozen two-message review discussion bridge (PLAN P0.5).
 * R1 is copied byte-for-byte from the lead delta envelope; R2 is copied
 * byte-for-byte from the second reviewer's stage-specific envelope.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { validateReviewEnvelope, envelopeHashes } from "./review-envelopes.js";
import { createInvocation } from "./review-orchestrator.js";
import {
  submitReviewArtifact, writeFileDurable, appendAudit, readManifest, readArtifactState
} from "./review-store.js";

export function threadsDir(dshHome) {
  return join(dshHome, "bots", "review", "threads");
}

export function threadFileFor(dshHome, taskId, cycleId, threadId) {
  return join(threadsDir(dshHome), taskId, `${String(cycleId)}-${threadId}.json`);
}

export const DISCUSSION_MAX_ROUNDS = 2;
export const DISCUSSION_ROUND_AUTHORS = Object.freeze({ 1: "reviewer-lead", 2: "reviewer-second" });

function safeLogicalId(value) {
  return typeof value === "string" && value.length > 0 &&
    !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}

function validId(value) {
  return safeLogicalId(value) || (Number.isInteger(value) && value > 0);
}

export function readThreadState(dshHome, taskId, cycleId, threadId) {
  const file = threadFileFor(dshHome, taskId, cycleId, threadId);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`线程状态不可解析（${file}）`);
  }
}

function saveThread(dshHome, thread) {
  writeFileDurable(
    threadFileFor(dshHome, thread.taskId, thread.cycleId, thread.threadId),
    `${JSON.stringify(thread)}\n`
  );
  return thread;
}

function writeDiscussionBinding(dshHome, artifactId, binding) {
  writeFileDurable(
    join(dshHome, "bots", "review", "artifacts", artifactId, "discussion-binding.json"),
    `${JSON.stringify(binding)}\n`
  );
}

function envelopeEvidence(dshHome, artifactId, stage, envelope) {
  return {
    file: join(dshHome, "bots", "review", "artifacts", artifactId, "review-envelope.json"),
    value: { stage, ...envelopeHashes(envelope) }
  };
}

function requireEnvelopeEvidence(dshHome, artifactId, stage, envelope) {
  const expected = envelopeEvidence(dshHome, artifactId, stage, envelope);
  if (!existsSync(expected.file)) throw new Error("delta artifact 缺 reviewer envelope 绑定证据");
  const existing = JSON.parse(readFileSync(expected.file, "utf8"));
  if (JSON.stringify(existing) !== JSON.stringify(expected.value)) throw new Error("artifact 已绑定不同 reviewer envelope");
  return existing;
}

function bindEnvelopeEvidence(dshHome, artifactId, stage, envelope) {
  const evidence = envelopeEvidence(dshHome, artifactId, stage, envelope);
  if (existsSync(evidence.file)) {
    const existing = JSON.parse(readFileSync(evidence.file, "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(evidence.value)) throw new Error("artifact 已绑定不同 reviewer envelope");
  } else {
    writeFileDurable(evidence.file, `${JSON.stringify(evidence.value)}\n`);
  }
  return evidence.value;
}

function threadsForCycle(dshHome, taskId, cycleId) {
  const dir = join(threadsDir(dshHome), taskId);
  if (!existsSync(dir)) return [];
  const prefix = `${String(cycleId)}-`;
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => {
      try { return JSON.parse(readFileSync(join(dir, name), "utf8")); }
      catch { throw new Error(`线程状态不可解析（${join(dir, name)}）`); }
    });
}

function reject(dshHome, reason, detail = {}) {
  const safe = {};
  for (const key of ["taskId", "cycleId", "threadId", "round", "replyTo", "authorBotId", "stage", "expectedStage", "expectedReplyTo"]) {
    if (Object.hasOwn(detail, key)) safe[key] = detail[key];
  }
  appendAudit(dshHome, { type: "discussion-rejected", reason, ...safe });
  return { accepted: false, reason };
}

function requireCommittedArtifact(dshHome, { artifactId, taskId, stage, authorBotId, body }) {
  const manifest = readManifest(dshHome, artifactId);
  if (!manifest) throw new Error(`绑定 artifact 不存在：${artifactId}`);
  if (manifest.taskId !== taskId || manifest.stage !== stage || manifest.authorBotId !== authorBotId) {
    throw new Error(`绑定 artifact 元数据不符：${artifactId}`);
  }
  const state = readArtifactState(dshHome, artifactId);
  if (!state.ok || !["submitted", "committed", "completed"].includes(state.status)) {
    throw new Error(`绑定 artifact 未 committed：${artifactId}`);
  }
  if (typeof body === "string") {
    const actual = readFileSync(manifest.bodyPath, "utf8");
    if (actual !== body) throw new Error(`绑定 artifact 正文不等于 envelope.body：${artifactId}`);
  }
}

/**
 * Open the cycle's only thread from a committed delta envelope and immediately
 * materialize R1 plus the one legal second-reviewer invocation.
 */
export function openDiscussion(dshHome, {
  taskId,
  cycleId,
  threadId,
  deltaArtifactId,
  stage = "delta-lead",
  envelope,
  sourceSnapshotId = null
}) {
  if (!safeLogicalId(taskId)) throw new TypeError("taskId 必须为安全逻辑 ID");
  if (!validId(cycleId)) throw new TypeError("cycleId 必须为安全逻辑 ID 或正整数");
  if (!safeLogicalId(threadId)) throw new TypeError("threadId 必须为安全逻辑 ID");
  if (!safeLogicalId(deltaArtifactId)) throw new TypeError("deltaArtifactId 必须为安全逻辑 ID");
  if (stage !== "delta-lead" && stage !== "recheck-delta-lead") throw new TypeError("stage 必须为 delta-lead/recheck-delta-lead");

  const check = validateReviewEnvelope({ stage, envelope });
  if (!check.ok) throw new TypeError(`delta envelope 非法：${check.reason}`);
  if (envelope.nextAction !== "discussion") throw new TypeError("只有 nextAction=discussion 可打开讨论");
  requireCommittedArtifact(dshHome, {
    artifactId: deltaArtifactId, taskId, stage, authorBotId: "reviewer-lead", body: envelope.body
  });
  requireEnvelopeEvidence(dshHome, deltaArtifactId, stage, envelope);

  const existing = readThreadState(dshHome, taskId, cycleId, threadId);
  if (existing) {
    const same = existing.deltaArtifactId === deltaArtifactId &&
      existing.deltaEnvelopeHashes?.jsonHash === envelopeHashes(envelope).jsonHash;
    if (!same) {
      appendAudit(dshHome, { type: "thread-conflict", taskId, cycleId, threadId, reason: "同线程绑定不一致" });
      throw new Error("线程冲突：同 task/cycle/thread 但 delta artifact/envelope 不一致");
    }
    return { thread: existing, created: false, artifactId: existing.rounds[0]?.artifactId, invocationId: existing.discussionInvocationId };
  }

  if (threadsForCycle(dshHome, taskId, cycleId).length > 0) {
    appendAudit(dshHome, { type: "thread-conflict", taskId, cycleId, threadId, reason: "每 cycle 只允许一个 discussion thread" });
    throw new Error("第二 discussion thread 拒绝：每 cycle 只允许一个 thread");
  }

  const discussionStage = stage === "delta-lead" ? "discussion-second" : "recheck-discussion-second";
  const finalStage = stage === "delta-lead" ? "final-lead" : "recheck-final-lead";
  const r1 = submitReviewArtifact(dshHome, {
    taskId,
    stage: "mail-discuss",
    authorBotId: "reviewer-lead",
    body: envelope.discussionBody,
    idempotencyKey: `review-discussion:${taskId}:${String(cycleId)}:${threadId}:r1`
  });
  writeDiscussionBinding(dshHome, r1.artifactId, {
    taskId,
    cycle: cycleId,
    discussionThreadId: threadId,
    discussRound: 1,
    replyTo: deltaArtifactId
  });
  const invocation = createInvocation(dshHome, {
    taskId,
    artifactId: r1.artifactId,
    stage: discussionStage,
    targetReviewer: "reviewer-second",
    createdBy: "host",
    idempotencyKey: `review-invocation:${taskId}:${String(cycleId)}:${discussionStage}`,
    parts: [
      `taskId=${taskId}`,
      `cycle=${String(cycleId)}`,
      `discussionThreadId=${threadId}`,
      `discussRound=1`,
      `replyTo=${deltaArtifactId}`,
      envelope.discussionBody
    ],
    sourceSnapshotId
  });
  const now = new Date().toISOString();
  const thread = saveThread(dshHome, {
    taskId,
    cycleId,
    threadId,
    sourceSnapshotId,
    deltaStage: stage,
    discussionStage,
    finalStage,
    deltaArtifactId,
    deltaEnvelopeHashes: envelopeHashes(envelope),
    rounds: [{
      round: 1,
      artifactId: r1.artifactId,
      authorBotId: "reviewer-lead",
      replyTo: deltaArtifactId,
      bodyHash: envelopeHashes(envelope).discussionBodyHash,
      bodyBytes: envelopeHashes(envelope).discussionBodyBytes,
      at: now
    }],
    discussionInvocationId: invocation.invocationId,
    finalInvocationId: null,
    closed: false,
    openedAt: now
  });
  appendAudit(dshHome, { type: "discussion-r1-committed", taskId, cycleId, threadId, artifactId: r1.artifactId });
  return { thread, created: true, artifactId: r1.artifactId, invocationId: invocation.invocationId };
}

/**
 * Commit the unique R2 reviewer envelope. Calls that resemble ordinary
 * send_mail (no nested stage envelope), R1 replays, R3, or final-stage attempts
 * are rejected without writing an artifact.
 */
export function bridgeDiscussionEnvelope(dshHome, input, opts = {}) {
  if (opts.source === "send_mail") {
    return reject(dshHome, "send-mail-review-discussion-bypass", input ?? {});
  }
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return reject(dshHome, "binding-invalid");
  }
  const { taskId, cycleId, threadId, round, replyTo, authorBotId, stage, invocationId, envelope } = input;
  if (typeof taskId !== "string" || !validId(cycleId) || typeof threadId !== "string") {
    return reject(dshHome, "binding-invalid", { taskId, cycleId, threadId });
  }
  const thread = readThreadState(dshHome, taskId, cycleId, threadId);
  if (!thread) return reject(dshHome, "thread-not-open", { taskId, cycleId, threadId });
  if (thread.closed) return reject(dshHome, "thread-closed", { taskId, cycleId, threadId });
  if (invocationId !== thread.discussionInvocationId) {
    return reject(dshHome, "invocation-mismatch", { taskId, cycleId, threadId, stage });
  }
  if (round !== 2) {
    const reason = Number.isInteger(round) && round > DISCUSSION_MAX_ROUNDS ? "round-invalid" : "round-mismatch";
    return reject(dshHome, reason, { taskId, cycleId, threadId, round });
  }
  if (thread.rounds.length !== 1) return reject(dshHome, "round-mismatch", { taskId, cycleId, threadId, round });
  if (authorBotId !== DISCUSSION_ROUND_AUTHORS[2]) {
    return reject(dshHome, "author-mismatch", { taskId, cycleId, threadId, authorBotId });
  }
  if (stage !== thread.discussionStage) {
    return reject(dshHome, "stage-mismatch", { taskId, cycleId, threadId, stage, expectedStage: thread.discussionStage });
  }
  const r1ArtifactId = thread.rounds[0].artifactId;
  try {
    requireCommittedArtifact(dshHome, {
      artifactId: r1ArtifactId, taskId, stage: "mail-discuss", authorBotId: "reviewer-lead"
    });
    const binding = JSON.parse(readFileSync(
      join(dshHome, "bots", "review", "artifacts", r1ArtifactId, "discussion-binding.json"), "utf8"));
    if (binding.taskId !== taskId || binding.cycle !== cycleId || binding.discussionThreadId !== threadId ||
        binding.discussRound !== 1 || binding.replyTo !== thread.deltaArtifactId) {
      return reject(dshHome, "r1-binding-invalid", { taskId, cycleId, threadId });
    }
  } catch {
    return reject(dshHome, "r1-binding-invalid", { taskId, cycleId, threadId });
  }
  if (replyTo !== r1ArtifactId) {
    return reject(dshHome, "replyto-mismatch", { taskId, cycleId, threadId, replyTo, expectedReplyTo: r1ArtifactId });
  }
  const envelopeCheck = validateReviewEnvelope({ stage, envelope });
  if (!envelopeCheck.ok) return reject(dshHome, `envelope-invalid:${envelopeCheck.reason}`, { taskId, cycleId, threadId });

  const r2 = submitReviewArtifact(dshHome, {
    taskId,
    stage: "mail-discuss",
    authorBotId: "reviewer-second",
    body: envelope.body,
    idempotencyKey: `review-discussion:${taskId}:${String(cycleId)}:${threadId}:r2`
  });
  bindEnvelopeEvidence(dshHome, r2.artifactId, stage, envelope);
  writeDiscussionBinding(dshHome, r2.artifactId, {
    taskId,
    cycle: cycleId,
    discussionThreadId: threadId,
    discussRound: 2,
    replyTo: r1ArtifactId
  });
  const finalInvocation = createInvocation(dshHome, {
    taskId,
    artifactId: r2.artifactId,
    stage: thread.finalStage,
    targetReviewer: "reviewer-lead",
    createdBy: "host",
    idempotencyKey: `review-invocation:${taskId}:${String(cycleId)}:${thread.finalStage}`,
    parts: [
      `taskId=${taskId}`,
      `cycle=${String(cycleId)}`,
      `discussionThreadId=${threadId}`,
      `discussRound=2`,
      `replyTo=${r1ArtifactId}`,
      envelope.body
    ],
    sourceSnapshotId: thread.sourceSnapshotId ?? null
  });
  const hashes = envelopeHashes(envelope);
  const updated = saveThread(dshHome, {
    ...thread,
    rounds: [...thread.rounds, {
      round: 2,
      artifactId: r2.artifactId,
      authorBotId: "reviewer-second",
      replyTo: r1ArtifactId,
      bodyHash: hashes.bodyHash,
      bodyBytes: hashes.bodyBytes,
      at: new Date().toISOString()
    }],
    finalInvocationId: finalInvocation.invocationId,
    closed: true,
    closedAt: new Date().toISOString()
  });
  appendAudit(dshHome, { type: "discussion-closed", taskId, cycleId, threadId, artifactId: r2.artifactId });
  return { accepted: true, artifactId: r2.artifactId, invocationId: finalInvocation.invocationId, thread: updated };
}
