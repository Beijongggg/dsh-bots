/**
 * R2-01 / R3-04 (F-RV-13) discussion bridge regression:
 * R1 原字节、唯一 R2、轮次/作者/回复绑定、final 后拒绝、send_mail 旁路拒绝、
 * 每 cycle 单 thread；开讨论一律经生产路径 advanceMainFlow（讨论 second invocation
 * 的创建受 F-RV-13 admission 约束），幂等/冲突/负例以直接模块调用复现。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  threadsDir, threadFileFor, DISCUSSION_MAX_ROUNDS, DISCUSSION_ROUND_AUTHORS,
  readThreadState, openDiscussion, bridgeDiscussionEnvelope
} from "../lib/review-discussion.js";
import { readManifest, submitReviewArtifact, writeFileDurable } from "../lib/review-store.js";
import { envelopeHashes } from "../lib/review-envelopes.js";
import { readInvocationManifest } from "../lib/review-orchestrator.js";
import { registerInitial, advanceMainFlow, readFlow } from "../lib/review-flow.js";
import { createSourceSnapshot, snapshotFileFor } from "../lib/review-evidence.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() { const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-r201-disc-")); homes.push(home); return home; }
function bodyFile(home, artifactId) { return path.join(home, "bots", "review", "artifacts", artifactId, "body.md"); }
function bindingFile(home, artifactId) { return path.join(home, "bots", "review", "artifacts", artifactId, "discussion-binding.json"); }
function deltaEnvelope(discussionBody = "R1 exact") {
  return { schemaVersion: 1, body: "delta body", nextAction: "discussion", discussionFindingIds: ["F-9"], discussionBody };
}
// 生产路径的 discussion cycle == flow.reviewCycle（advanceMainFlow 打开），快照锚定 snap-1。
const SNAP = "snap-1";
const BASE = { taskId: "T-R2-01-disc", cycleId: 1, threadId: "thread-one", stage: "delta-lead", sourceSnapshotId: SNAP };
let deltaSeq = 0;

function snapFor(home) {
  if (!fs.existsSync(snapshotFileFor(home, SNAP))) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-disc-snap-"));
    homes.push(root);
    fs.writeFileSync(path.join(root, "main.c"), "int main(){}\n");
    createSourceSnapshot(home, { cycleId: SNAP, root });
  }
  return SNAP;
}

function makeWritable(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) { try { fs.chmodSync(dir, 0o644); } catch { /* 尽力 */ } return; }
  try { fs.chmodSync(dir, 0o700); } catch { /* 尽力 */ }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.lstatSync(full).isDirectory()) makeWritable(full);
    else { try { fs.chmodSync(full, 0o644); } catch { /* 尽力 */ } }
  }
}

/**
 * 生产路径开讨论：双盲初审（flow 锚定 snapshot）→ delta-lead 工件 → advanceMainFlow
 * 携带 delta envelope（nextAction=discussion）自动打开唯一 thread 并创建
 * discussion-second invocation（受 F-RV-13 admission 约束）。返回与 openDiscussion
 * 同形的 {thread, created, artifactId, invocationId}。
 */
async function primeOpen(home, overrides = {}) {
  const input = { ...BASE, ...overrides };
  const taskId = input.taskId;
  const envelope = input.envelope ?? deltaEnvelope();
  snapFor(home);
  let flow = readFlow(home, taskId);
  if (!flow || flow.initials.length === 0) {
    const lead = submitReviewArtifact(home, {
      taskId, stage: "initial-lead", authorBotId: "reviewer-lead",
      body: "blind lead", idempotencyKey: `disc-init-lead-${taskId}`
    });
    registerInitial(home, {
      taskId, stage: "initial-lead", artifactId: lead.artifactId, status: "completed",
      envelope: { schemaVersion: 1, body: "blind lead" }, sourceSnapshotId: SNAP
    });
    const second = submitReviewArtifact(home, {
      taskId, stage: "initial-second", authorBotId: "reviewer-second",
      body: "blind second", idempotencyKey: `disc-init-second-${taskId}`
    });
    registerInitial(home, {
      taskId, stage: "initial-second", artifactId: second.artifactId, status: "completed",
      envelope: { schemaVersion: 1, body: "blind second" }, sourceSnapshotId: SNAP
    });
    await advanceMainFlow(home, { taskId, reviewCycle: input.cycleId });
  }
  flow = readFlow(home, taskId);
  if (flow?.discussionInvocationId) {
    // 已开过讨论：既有 thread（幂等语义）
    const thread = readThreadState(home, taskId, input.cycleId, input.threadId);
    return {
      created: false,
      artifactId: thread?.rounds?.[0]?.artifactId ?? null,
      invocationId: flow.discussionInvocationId,
      thread
    };
  }
  deltaSeq += 1;
  const delta = submitReviewArtifact(home, {
    taskId,
    stage: input.stage,
    authorBotId: "reviewer-lead",
    body: envelope.body,
    idempotencyKey: `disc-delta-${deltaSeq}`
  });
  const opened = await advanceMainFlow(home, {
    taskId,
    reviewCycle: input.cycleId,
    deltaArtifactId: delta.artifactId,
    discussionThreadId: input.threadId,
    deltaEnvelope: envelope
  });
  if (opened.step !== "discussion-invoked") {
    throw new Error(`prime 未打开讨论：${opened.step}`);
  }
  return opened.discussion;
}

test("R1 只来自 delta envelope discussionBody 原字节，绑定 task/cycle/thread/round/replyTo", async () => {
  const home = mkHome();
  const exact = "首轮🙂\r\n尾部空格  ";
  const opened = await primeOpen(home, { envelope: deltaEnvelope(exact) });
  assert.equal(opened.created, true);
  assert.equal(fs.readFileSync(bodyFile(home, opened.artifactId), "utf8"), exact);
  assert.equal(readManifest(home, opened.artifactId).stage, "mail-discuss");
  assert.deepEqual(JSON.parse(fs.readFileSync(bindingFile(home, opened.artifactId), "utf8")), {
    taskId: BASE.taskId, cycle: BASE.cycleId, discussionThreadId: BASE.threadId,
    discussRound: 1, replyTo: opened.thread.deltaArtifactId
  });
  const round = opened.thread.rounds[0];
  assert.equal(round.bodyHash, createHash("sha256").update(exact, "utf8").digest("hex"));
  assert.equal(round.bodyBytes, Buffer.byteLength(exact, "utf8"));
  assert.equal(readInvocationManifest(home, "reviewer-second", opened.invocationId).stage, "discussion-second");
  // F-RV-13：discussion invocation 不得丢失 snapshot
  assert.equal(readInvocationManifest(home, "reviewer-second", opened.invocationId).sourceSnapshotId, SNAP);
});

test("openDiscussion 同绑定幂等；不同 delta/envelope 冲突；同 cycle 第二 thread 拒绝", async () => {
  const home = mkHome();
  const first = await primeOpen(home);
  const again = openDiscussion(home, { ...BASE, deltaArtifactId: first.thread.deltaArtifactId, envelope: deltaEnvelope() });
  assert.equal(again.created, false);
  assert.equal(again.artifactId, first.artifactId);
  assert.equal(again.invocationId, first.invocationId);
  // 不同 delta 工件同 thread → 绑定冲突（正文= envelope.body，且需匹配的 envelope 绑定证据）
  const freshDelta = submitReviewArtifact(home, {
    taskId: BASE.taskId, stage: "delta-lead", authorBotId: "reviewer-lead",
    body: "delta body", idempotencyKey: "disc-delta-fresh"
  });
  writeFileDurable(
    path.join(home, "bots", "review", "artifacts", freshDelta.artifactId, "review-envelope.json"),
    `${JSON.stringify({ stage: "delta-lead", ...envelopeHashes(deltaEnvelope()) })}\n`
  );
  assert.throws(() => openDiscussion(home, { ...BASE, deltaArtifactId: freshDelta.artifactId, envelope: deltaEnvelope() }), /线程冲突/);
  // 同 cycle 第二 thread 拒绝（绑定证据一致 → 命中 thread 数量限制）
  assert.throws(() => openDiscussion(home, {
    ...BASE, threadId: "thread-two", deltaArtifactId: freshDelta.artifactId, envelope: deltaEnvelope()
  }), /第二 discussion thread 拒绝/);
  assert.equal(fs.readdirSync(path.join(threadsDir(home), BASE.taskId)).filter((name) => name.endsWith(".json")).length, 1);
  // 幂等重放不产生新 invocation
  const flow = readFlow(home, BASE.taskId);
  assert.equal(flow.deltaArtifactId.length > 0, true);
  assert.equal(flow.discussionInvocationId, first.invocationId);
});

test("R2 envelope body 机械落唯一 artifact，绑定 round=2/replyTo=R1，并关闭后建 final-lead", async () => {
  const home = mkHome();
  const opened = await primeOpen(home, { envelope: deltaEnvelope("R1") });
  const exactR2 = "副审 R2\n不改写🙂";
  const committed = bridgeDiscussionEnvelope(home, {
    taskId: BASE.taskId, cycleId: BASE.cycleId, threadId: BASE.threadId,
    round: 2, replyTo: opened.artifactId, authorBotId: "reviewer-second", stage: "discussion-second",
    invocationId: opened.invocationId,
    envelope: { schemaVersion: 1, body: exactR2 }
  });
  assert.equal(committed.accepted, true);
  assert.equal(fs.readFileSync(bodyFile(home, committed.artifactId), "utf8"), exactR2);
  assert.equal(readManifest(home, committed.artifactId).stage, "mail-discuss");
  assert.deepEqual(JSON.parse(fs.readFileSync(bindingFile(home, committed.artifactId), "utf8")), {
    taskId: BASE.taskId, cycle: BASE.cycleId, discussionThreadId: BASE.threadId,
    discussRound: 2, replyTo: opened.artifactId
  });
  assert.equal(readInvocationManifest(home, "reviewer-lead", committed.invocationId).stage, "final-lead");
  // F-RV-13：讨论关闭后 final invocation 继承同一 snapshot
  assert.equal(readInvocationManifest(home, "reviewer-lead", committed.invocationId).sourceSnapshotId, SNAP);
  const thread = readThreadState(home, BASE.taskId, BASE.cycleId, BASE.threadId);
  assert.equal(thread.rounds.length, 2);
  assert.equal(thread.closed, true);
  assert.equal(thread.finalInvocationId, committed.invocationId);

  const replay = bridgeDiscussionEnvelope(home, {
    taskId: BASE.taskId, cycleId: BASE.cycleId, threadId: BASE.threadId,
    round: 2, replyTo: opened.artifactId, authorBotId: "reviewer-second", stage: "discussion-second",
    invocationId: opened.invocationId,
    envelope: { schemaVersion: 1, body: exactR2 }
  });
  assert.equal(replay.accepted, false);
  assert.equal(replay.reason, "thread-closed");
  assert.equal(readThreadState(home, BASE.taskId, BASE.cycleId, BASE.threadId).rounds.length, 2, "R2 唯一");
});

test("R3、错轮、错作者、错 replyTo、错 stage、非法 envelope 全拒绝且零 R2", async () => {
  const cases = [
    [{ round: 3, authorBotId: "reviewer-second", stage: "discussion-second" }, "round-invalid"],
    [{ round: 1, authorBotId: "reviewer-lead", stage: "discussion-second" }, "round-mismatch"],
    [{ round: 2, authorBotId: "reviewer-lead", stage: "discussion-second" }, "author-mismatch"],
    [{ round: 2, authorBotId: "reviewer-second", stage: "final-lead" }, "stage-mismatch"]
  ];
  for (const [override, reason] of cases) {
    const home = mkHome();
    const opened = await primeOpen(home);
    const result = bridgeDiscussionEnvelope(home, {
      taskId: BASE.taskId, cycleId: BASE.cycleId, threadId: BASE.threadId,
      round: 2, replyTo: opened.artifactId, authorBotId: "reviewer-second", stage: "discussion-second",
      invocationId: opened.invocationId,
      envelope: { schemaVersion: 1, body: "R2" }, ...override
    });
    assert.equal(result.accepted, false);
    assert.equal(result.reason, reason);
    assert.equal(readThreadState(home, BASE.taskId, BASE.cycleId, BASE.threadId).rounds.length, 1);
  }

  const home = mkHome();
  const opened = await primeOpen(home);
  assert.equal(bridgeDiscussionEnvelope(home, {
    taskId: BASE.taskId, cycleId: BASE.cycleId, threadId: BASE.threadId, round: 2,
    replyTo: "WRONG", authorBotId: "reviewer-second", stage: "discussion-second",
    invocationId: opened.invocationId,
    envelope: { schemaVersion: 1, body: "R2" }
  }).reason, "replyto-mismatch");
  assert.match(bridgeDiscussionEnvelope(home, {
    taskId: BASE.taskId, cycleId: BASE.cycleId, threadId: BASE.threadId, round: 2,
    replyTo: opened.artifactId, authorBotId: "reviewer-second", stage: "discussion-second",
    invocationId: opened.invocationId,
    envelope: { schemaVersion: 1, body: "R2", extra: true }
  }).reason, /^envelope-invalid:/);
  assert.equal(readThreadState(home, BASE.taskId, BASE.cycleId, BASE.threadId).rounds.length, 1);
});

test("普通 send_mail 携 review 绑定拒绝旁路，未 open thread 同样拒绝", async () => {
  const home = mkHome();
  const bypass = bridgeDiscussionEnvelope(home, {
    taskId: BASE.taskId, cycleId: BASE.cycleId, threadId: BASE.threadId, round: 2,
    replyTo: "A-R1", authorBotId: "reviewer-second", stage: "discussion-second",
    envelope: { schemaVersion: 1, body: "mail body" }
  }, { source: "send_mail" });
  assert.equal(bypass.accepted, false);
  assert.equal(bypass.reason, "send-mail-review-discussion-bypass");
  const noThread = bridgeDiscussionEnvelope(home, {
    taskId: BASE.taskId, cycleId: BASE.cycleId, threadId: BASE.threadId, round: 2,
    replyTo: "A-R1", authorBotId: "reviewer-second", stage: "discussion-second",
    envelope: { schemaVersion: 1, body: "mail body" }
  });
  assert.equal(noThread.reason, "thread-not-open");
});

test("final 阶段不得开 discussion（复检链由 main-flow 全链覆盖）", async () => {
  const home = mkHome();
  assert.throws(() => openDiscussion(home, { ...BASE, stage: "final-lead", deltaArtifactId: "A-NONE", envelope: deltaEnvelope() }), /stage 必须/);
});

test("讨论上限与轮次作者冻结", () => {
  assert.equal(DISCUSSION_MAX_ROUNDS, 2);
  assert.deepEqual(DISCUSSION_ROUND_AUTHORS, { 1: "reviewer-lead", 2: "reviewer-second" });
  assert.equal(threadFileFor("/home", "T", 1, "x"), path.join("/home", "bots/review/threads/T/1-x.json"));
});

let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.stack ?? error.message); }
  }
} finally {
  for (const dir of homes.reverse()) {
    try {
      makeWritable(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* 测试退出清理 */ }
  }
}
process.exit(failed > 0 ? 1 : 0);