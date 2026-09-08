import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readFlow, registerInitial, advanceMainFlow, registerFinal, advanceFixFlow, registerRecheckFinal
} from "../lib/review-flow.js";
import { bridgeDiscussionEnvelope } from "../lib/review-discussion.js";
import { submitReviewArtifact } from "../lib/review-store.js";
import { readInvocationManifest, readInvocationParts } from "../lib/review-orchestrator.js";
import { createSourceSnapshot, snapshotFileFor } from "../lib/review-evidence.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() { const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-r201-flow-")); homes.push(home); return home; }
/** F-RV-13：物化 source snapshot（幂等），不变量：全链 invocations 共享同一 snapshot。 */
const SNAP = "snap-1";
function snapFor(home) {
  if (!fs.existsSync(snapshotFileFor(home, SNAP))) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-flow-snap-"));
    homes.push(root);
    fs.writeFileSync(path.join(root, "main.c"), "int main(){return 0;}\n");
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
function submit(home, { taskId, stage, authorBotId, body, key }) {
  return submitReviewArtifact(home, { taskId, stage, authorBotId, body, idempotencyKey: key });
}
function userFacingHook(home) {
  return (artifactId, { bodyFile, sha256, byteLength }) => {
    const target = path.join(home, "bots", "review", "results", `${artifactId}.md`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(bodyFile, target);
    const bytes = fs.readFileSync(target);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
    assert.equal(bytes.length, byteLength);
    return target;
  };
}
function routeFile(home, reviewer, artifactId) {
  return path.join(home, "bots", "review", "deliveries", reviewer, artifactId, "body.md");
}

const TASK = "T-R2-01-main";

test("双初审齐备前：initial-second pending，不投主审、不建 delta-lead；initial-lead 永不投副审", async () => {
  const home = mkHome();
  const lead = submit(home, { taskId: TASK, stage: "initial-lead", authorBotId: "reviewer-lead", body: "lead blind", key: "m1-lead" });
  registerInitial(home, { taskId: TASK, stage: "initial-lead", artifactId: lead.artifactId, status: "completed", envelope: { schemaVersion: 1, body: "lead blind" }, sourceSnapshotId: snapFor(home) });
  let result = await advanceMainFlow(home, { taskId: TASK, reviewCycle: 1 });
  assert.equal(result.step, "awaiting-both-initials");
  assert.equal(readFlow(home, TASK).deltaInvocationId, null);

  const second = submit(home, { taskId: TASK, stage: "initial-second", authorBotId: "reviewer-second", body: "second blind", key: "m1-second" });
  result = await advanceMainFlow(home, { taskId: TASK, reviewCycle: 1 });
  assert.equal(result.step, "awaiting-both-initials");
  assert.equal(fs.existsSync(routeFile(home, "reviewer-lead", second.artifactId)), false);
  assert.equal(fs.existsSync(routeFile(home, "reviewer-second", lead.artifactId)), false);
});

test("双齐闸开放：只投 initial-second 给主审并创建一个 delta-lead invocation", async () => {
  const home = mkHome();
  const lead = submit(home, { taskId: TASK, stage: "initial-lead", authorBotId: "reviewer-lead", body: "lead", key: "m2-lead" });
  const second = submit(home, { taskId: TASK, stage: "initial-second", authorBotId: "reviewer-second", body: "second", key: "m2-second" });
  registerInitial(home, { taskId: TASK, stage: "initial-lead", artifactId: lead.artifactId, status: "completed", envelope: { schemaVersion: 1, body: fs.readFileSync(path.join(home, "bots/review/artifacts", lead.artifactId, "body.md"), "utf8") }, sourceSnapshotId: snapFor(home) });
  registerInitial(home, { taskId: TASK, stage: "initial-second", artifactId: second.artifactId, status: "completed", envelope: { schemaVersion: 1, body: fs.readFileSync(path.join(home, "bots/review/artifacts", second.artifactId, "body.md"), "utf8") }, sourceSnapshotId: snapFor(home) });
  const result = await advanceMainFlow(home, { taskId: TASK, reviewCycle: 2 });
  assert.equal(result.step, "delta-invoked");
  assert.ok(fs.existsSync(routeFile(home, "reviewer-lead", second.artifactId)));
  assert.equal(fs.existsSync(routeFile(home, "reviewer-second", lead.artifactId)), false, "initial-lead 全程不投副审");
  const manifest = readInvocationManifest(home, "reviewer-lead", result.flow.deltaInvocationId);
  assert.equal(manifest.stage, "delta-lead");
  assert.equal(manifest.artifactId, second.artifactId);
  assert.equal(manifest.sourceSnapshotId, SNAP, "初审带 snapshot、自动 delta 仍保留同一 snapshot（F-RV-13）");
  const parts = readInvocationParts(home, "reviewer-lead", result.flow.deltaInvocationId);
  assert.ok(parts.includes(`leadInitialArtifactId=${lead.artifactId}`));
  assert.ok(parts.includes(`secondInitialArtifactId=${second.artifactId}`));
});

test("delta-lead nextAction=final：直接创建 final-lead invocation", async () => {
  const home = mkHome();
  const lead = submit(home, { taskId: TASK, stage: "initial-lead", authorBotId: "reviewer-lead", body: "L", key: "m3-l" });
  const second = submit(home, { taskId: TASK, stage: "initial-second", authorBotId: "reviewer-second", body: "S", key: "m3-s" });
  registerInitial(home, { taskId: TASK, stage: "initial-lead", artifactId: lead.artifactId, status: "completed", envelope: { schemaVersion: 1, body: fs.readFileSync(path.join(home, "bots/review/artifacts", lead.artifactId, "body.md"), "utf8") }, sourceSnapshotId: snapFor(home) });
  registerInitial(home, { taskId: TASK, stage: "initial-second", artifactId: second.artifactId, status: "completed", envelope: { schemaVersion: 1, body: fs.readFileSync(path.join(home, "bots/review/artifacts", second.artifactId, "body.md"), "utf8") }, sourceSnapshotId: snapFor(home) });
  await advanceMainFlow(home, { taskId: TASK, reviewCycle: 1 });
  const delta = submit(home, { taskId: TASK, stage: "delta-lead", authorBotId: "reviewer-lead", body: "delta direct", key: "m3-d" });
  const result = await advanceMainFlow(home, {
    taskId: TASK, reviewCycle: 1, deltaArtifactId: delta.artifactId,
    deltaEnvelope: { schemaVersion: 1, body: "delta direct", nextAction: "final", discussionFindingIds: [] }
  });
  assert.equal(result.step, "final-invoked");
  assert.equal(readInvocationManifest(home, "reviewer-lead", result.flow.finalInvocationId).stage, "final-lead");
});

test("delta 讨论分支完整主链：discussionBody 原字节 R1 → discussion-second R2 → final-lead", async () => {
  const home = mkHome();
  const lead = submit(home, { taskId: TASK, stage: "initial-lead", authorBotId: "reviewer-lead", body: "blind lead", key: "m4-l" });
  const second = submit(home, { taskId: TASK, stage: "initial-second", authorBotId: "reviewer-second", body: "blind second", key: "m4-s" });
  registerInitial(home, { taskId: TASK, stage: "initial-lead", artifactId: lead.artifactId, status: "completed", envelope: { schemaVersion: 1, body: fs.readFileSync(path.join(home, "bots/review/artifacts", lead.artifactId, "body.md"), "utf8") }, sourceSnapshotId: snapFor(home) });
  registerInitial(home, { taskId: TASK, stage: "initial-second", artifactId: second.artifactId, status: "completed", envelope: { schemaVersion: 1, body: fs.readFileSync(path.join(home, "bots/review/artifacts", second.artifactId, "body.md"), "utf8") }, sourceSnapshotId: snapFor(home) });
  await advanceMainFlow(home, { taskId: TASK, reviewCycle: 4 });
  const delta = submit(home, { taskId: TASK, stage: "delta-lead", authorBotId: "reviewer-lead", body: "delta body", key: "m4-d" });
  const r1Body = "R1 原字节🙂\n第二行  ";
  const opened = await advanceMainFlow(home, {
    taskId: TASK, reviewCycle: 4, deltaArtifactId: delta.artifactId, discussionThreadId: "only-thread",
    deltaEnvelope: { schemaVersion: 1, body: "delta body", nextAction: "discussion", discussionFindingIds: ["F-1"], discussionBody: r1Body }
  });
  assert.equal(opened.step, "discussion-invoked");
  assert.equal(fs.readFileSync(path.join(home, "bots/review/artifacts", opened.discussion.artifactId, "body.md"), "utf8"), r1Body);
  assert.equal(readInvocationManifest(home, "reviewer-second", opened.discussion.invocationId).stage, "discussion-second");
  assert.equal(readInvocationManifest(home, "reviewer-second", opened.discussion.invocationId).sourceSnapshotId, SNAP, "discussion invocation 不得丢失 snapshot（F-RV-13）");

  const r2 = bridgeDiscussionEnvelope(home, {
    taskId: TASK, cycleId: 4, threadId: "only-thread", round: 2,
    replyTo: opened.discussion.artifactId, authorBotId: "reviewer-second", stage: "discussion-second",
    invocationId: opened.discussion.invocationId,
    envelope: { schemaVersion: 1, body: "R2 exact reply" }
  });
  assert.equal(r2.accepted, true);
  assert.equal(readInvocationManifest(home, "reviewer-lead", r2.invocationId).stage, "final-lead");
  assert.equal(readInvocationManifest(home, "reviewer-lead", r2.invocationId).sourceSnapshotId, SNAP, "final invocation 不得丢失 snapshot（F-RV-13）");
  const advanced = await advanceMainFlow(home, { taskId: TASK, reviewCycle: 4 });
  assert.equal(advanced.step, "final-invoked");
  assert.equal(advanced.flow.finalInvocationId, r2.invocationId);
  assert.equal(fs.existsSync(routeFile(home, "reviewer-second", lead.artifactId)), false, "讨论后仍不泄露 initial-lead");
});

test("final-lead 路由 required 恰为 reviewer-second + user-facing", async () => {
  const home = mkHome();
  const lead = submit(home, { taskId: TASK, stage: "initial-lead", authorBotId: "reviewer-lead", body: "route lead", key: "m5-lead" });
  const second = submit(home, { taskId: TASK, stage: "initial-second", authorBotId: "reviewer-second", body: "route second", key: "m5-second" });
  registerInitial(home, { taskId: TASK, stage: "initial-lead", artifactId: lead.artifactId, status: "completed", envelope: { schemaVersion: 1, body: "route lead" }, sourceSnapshotId: snapFor(home) });
  registerInitial(home, { taskId: TASK, stage: "initial-second", artifactId: second.artifactId, status: "completed", envelope: { schemaVersion: 1, body: "route second" }, sourceSnapshotId: snapFor(home) });
  await advanceMainFlow(home, { taskId: TASK, reviewCycle: 1 });
  const delta = submit(home, { taskId: TASK, stage: "delta-lead", authorBotId: "reviewer-lead", body: "route delta", key: "m5-delta" });
  await advanceMainFlow(home, {
    taskId: TASK, reviewCycle: 1, deltaArtifactId: delta.artifactId,
    deltaEnvelope: { schemaVersion: 1, body: "route delta", nextAction: "final", discussionFindingIds: [] }
  });
  const final = submit(home, { taskId: TASK, stage: "final-lead", authorBotId: "reviewer-lead", body: "final exact", key: "m5-final" });
  const result = registerFinal(home, {
    taskId: TASK, artifactId: final.artifactId,
    envelope: { schemaVersion: 1, body: "final exact", decision: "reject", findingIds: ["F-1"] },
    copyToUserFacing: userFacingHook(home)
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.recipients, ["reviewer-second", "user-facing"]);
  assert.ok(fs.existsSync(routeFile(home, "reviewer-second", final.artifactId)));
  assert.ok(fs.existsSync(path.join(home, "bots/review/results", `${final.artifactId}.md`)));
  assert.equal(fs.existsSync(routeFile(home, "reviewer-lead", final.artifactId)), false);
});

test("复检完整链：fix-report → 双席互盲 → recheck-delta → 讨论 R1/R2 → recheck-final 路由", () => {
  const home = mkHome();
  // F-RV-13：先建立主链 flow 并锚定 sourceSnapshotId；复检 invocations 继承同一快照
  const pLead = submit(home, { taskId: TASK, stage: "initial-lead", authorBotId: "reviewer-lead", body: "blind lead", key: "m6-pl" });
  registerInitial(home, { taskId: TASK, stage: "initial-lead", artifactId: pLead.artifactId, status: "completed", envelope: { schemaVersion: 1, body: "blind lead" }, sourceSnapshotId: snapFor(home) });
  const pSecond = submit(home, { taskId: TASK, stage: "initial-second", authorBotId: "reviewer-second", body: "blind second", key: "m6-ps" });
  registerInitial(home, { taskId: TASK, stage: "initial-second", artifactId: pSecond.artifactId, status: "completed", envelope: { schemaVersion: 1, body: "blind second" }, sourceSnapshotId: snapFor(home) });
  const fix = submit(home, { taskId: TASK, stage: "fix-report", authorBotId: "coder-bot", body: "fix report", key: "m6-fix" });
  let result = advanceFixFlow(home, { taskId: TASK, fixReportArtifactId: fix.artifactId, engineeringBotId: "coder-bot", repairCycle: 1 });
  assert.equal(result.step, "recheck-initials-invoked");
  assert.equal(result.flow.reinspection.length, 2);
  const leadInv = result.flow.reinspection.find((entry) => entry.reviewer === "reviewer-lead");
  const secondInv = result.flow.reinspection.find((entry) => entry.reviewer === "reviewer-second");
  assert.equal(readInvocationManifest(home, "reviewer-lead", leadInv.invocationId).stage, "recheck-lead");
  assert.equal(readInvocationManifest(home, "reviewer-second", secondInv.invocationId).stage, "recheck-second");
  assert.equal(readInvocationManifest(home, "reviewer-lead", leadInv.invocationId).sourceSnapshotId, SNAP, "recheck 双席不丢 snapshot（F-RV-13）");
  assert.equal(readInvocationManifest(home, "reviewer-second", secondInv.invocationId).sourceSnapshotId, SNAP, "recheck 双席不丢 snapshot（F-RV-13）");
  assert.deepEqual(readInvocationParts(home, "reviewer-lead", leadInv.invocationId), readInvocationParts(home, "reviewer-second", secondInv.invocationId), "双齐前输入互盲等价");

  const lead = submit(home, { taskId: TASK, stage: "recheck-lead", authorBotId: "reviewer-lead", body: "RL", key: "m6-rl" });
  const second = submit(home, { taskId: TASK, stage: "recheck-second", authorBotId: "reviewer-second", body: "RS", key: "m6-rs" });
  registerInitial(home, { taskId: TASK, stage: "recheck-lead", artifactId: lead.artifactId, status: "completed", envelope: { schemaVersion: 1, body: "RL" }, sourceSnapshotId: snapFor(home) });
  result = advanceFixFlow(home, { taskId: TASK, fixReportArtifactId: fix.artifactId, engineeringBotId: "coder-bot", repairCycle: 1 });
  assert.equal(result.step, "awaiting-both-recheck-initials");
  assert.equal(fs.existsSync(routeFile(home, "reviewer-lead", second.artifactId)), false);
  registerInitial(home, { taskId: TASK, stage: "recheck-second", artifactId: second.artifactId, status: "completed", envelope: { schemaVersion: 1, body: "RS" }, sourceSnapshotId: snapFor(home) });
  result = advanceFixFlow(home, { taskId: TASK, fixReportArtifactId: fix.artifactId, engineeringBotId: "coder-bot", repairCycle: 1 });
  assert.equal(result.step, "recheck-delta-invoked");
  assert.equal(readInvocationManifest(home, "reviewer-lead", result.flow.recheckDeltaInvocationId).stage, "recheck-delta-lead");
  assert.equal(readInvocationManifest(home, "reviewer-lead", result.flow.recheckDeltaInvocationId).sourceSnapshotId, SNAP, "recheck-delta 不丢 snapshot（F-RV-13）");

  const delta = submit(home, { taskId: TASK, stage: "recheck-delta-lead", authorBotId: "reviewer-lead", body: "RD", key: "m6-rd" });
  result = advanceFixFlow(home, {
    taskId: TASK, fixReportArtifactId: fix.artifactId, engineeringBotId: "coder-bot", repairCycle: 1,
    recheckDeltaArtifactId: delta.artifactId, discussionThreadId: "repair-thread",
    recheckDeltaEnvelope: { schemaVersion: 1, body: "RD", nextAction: "discussion", discussionFindingIds: ["F-1"], discussionBody: "repair R1" }
  });
  assert.equal(result.step, "recheck-discussion-invoked");
  const r2 = bridgeDiscussionEnvelope(home, {
    taskId: TASK, cycleId: "repair-1", threadId: "repair-thread", round: 2,
    replyTo: result.discussion.artifactId, authorBotId: "reviewer-second", stage: "recheck-discussion-second",
    invocationId: result.discussion.invocationId,
    envelope: { schemaVersion: 1, body: "repair R2" }
  });
  assert.equal(r2.accepted, true);
  assert.equal(readInvocationManifest(home, "reviewer-lead", r2.invocationId).stage, "recheck-final-lead");
  assert.equal(readInvocationManifest(home, "reviewer-lead", r2.invocationId).sourceSnapshotId, SNAP, "recheck-final 不丢 snapshot（F-RV-13）");
  result = advanceFixFlow(home, { taskId: TASK, fixReportArtifactId: fix.artifactId, engineeringBotId: "coder-bot", repairCycle: 1 });
  assert.equal(result.step, "recheck-final-invoked");

  const final = submit(home, { taskId: TASK, stage: "recheck-final-lead", authorBotId: "reviewer-lead", body: "RF", key: "m6-rf" });
  const routed = registerRecheckFinal(home, {
    taskId: TASK, artifactId: final.artifactId,
    envelope: { schemaVersion: 1, body: "RF", decision: "approve", findingIds: [] },
    copyToUserFacing: userFacingHook(home)
  });
  assert.equal(routed.ok, true);
  assert.deepEqual(routed.recipients, ["reviewer-second", "user-facing"]);
});

test("F-RV-4 flow 损坏 → fail closed：不重建、不覆盖、不登记新 artifact", async () => {
  const home = mkHome();
  const taskId = "T-RV4";
  const lead = submit(home, { taskId, stage: "initial-lead", authorBotId: "reviewer-lead", body: "x", key: "rv4-lead" });
  const flowFile = path.join(home, "bots", "review", "flow", `${taskId}.json`);
  fs.mkdirSync(path.dirname(flowFile), { recursive: true });
  fs.writeFileSync(flowFile, "{ broken json !!!");
  assert.throws(() => registerInitial(home, {
    taskId, stage: "initial-lead", artifactId: lead.artifactId, status: "completed",
    envelope: { schemaVersion: 1, body: "x" }, sourceSnapshotId: snapFor(home)
  }), /损坏|fail closed/);
  await assert.rejects(() => advanceMainFlow(home, { taskId, reviewCycle: 1 }), /损坏|fail closed/);
  assert.equal(fs.readFileSync(flowFile, "utf8"), "{ broken json !!!", "原损坏 flow 文件不得被覆盖");
  assert.equal(fs.readdirSync(path.dirname(flowFile)).length, 1, "不得重建/新增 flow 登记");
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
