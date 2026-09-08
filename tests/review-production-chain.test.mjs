/**
 * F-RV-19/20/22 生产受信链回归：宿主派发签名 claim capability（dispatch 面）＋
 * bot 侧链式 provider（heartbeat/report 凭有效 lease）＋ fix-report manifest 快照
 * 绑定（provenance）＋ report 同工件幂等重放。全部在临时 DSH_HOME 内运行。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { internals } from "../lib/index.js";
import {
  botHoldsActiveLease, claimJob, createEngineeringJob, heartbeatJob, reportFix, expireStaleJobLeases
} from "../lib/review-jobs.js";
import { createSourceSnapshot } from "../lib/review-evidence.js";
import { publishResult, writeUserDecision } from "../lib/review-results.js";
import { submitReviewArtifact } from "../lib/review-store.js";
import { createRouteIntent, deliverRoute } from "../lib/review-relay.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];

function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-prod-"));
  homes.push(home);
  fs.mkdirSync(path.join(home, "bots", "review"), { recursive: true });
  return home;
}
function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-proj-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.js"), "x\n");
  return root;
}
/** 新格式五字段实例行（值自算，模拟 bot 进程 apply 自写）。 */
function writeBotRow(home, botId) {
  const file = path.join(home, "bots", "started", "instances.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const iso = new Date(Date.now() - 1000).toISOString();
  fs.appendFileSync(file, JSON.stringify({
    botId, pid: process.pid, startedAt: iso, hostInstanceId: `host-${process.pid}`, at: iso
  }) + "\n");
}
/** 最小授权链脚手架：final 工件 → user-facing route committed → 索引 → authorize-repair decision。 */
function scaffoldDecision(home) {
  const final = submitReviewArtifact(home, {
    taskId: "T-PC", stage: "final-lead", authorBotId: "reviewer-lead",
    body: "终审正文", idempotencyKey: "pc-final"
  });
  createRouteIntent(home, { artifactId: final.artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  deliverRoute(home, {
    artifactId: final.artifactId, recipient: "user-facing",
    copyToUserFacing: (artifactId, meta) => {
      const target = path.join(home, "bots", "review", "results", "T-PC", artifactId, "body.md");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(meta.bodyFile, target);
      return target;
    }
  });
  publishResult(home, {
    taskId: "T-PC", artifactId: final.artifactId, stage: "final-lead",
    authorBotId: "reviewer-lead", findingIds: ["F-1"], decision: "reject"
  });
  const decision = writeUserDecision(home, {
    taskId: "T-PC", artifactId: final.artifactId, revision: 1, choice: "authorize-repair",
    findingIds: ["F-1"], scope: ["src/"], acceptanceCriteria: "tests pass", author: "user"
  }, { ok: true, principal: { role: "user" } });
  assert.equal(decision.ok, true, `decision 脚手架失败：${decision.reason ?? ""}`);
}
function makeJob(home, snap) {
  const job = createEngineeringJob(home, {
    taskId: "T-PC", decisionRevision: 1, authorizedFindingIds: ["F-1"],
    scope: ["src/"], acceptanceCriteria: "tests pass",
    engineeringBotId: "coder-1", sourceSnapshotId: snap
  });
  assert.equal(job.ok, true, `job 创建失败：${job.reason ?? ""}`);
  return job.jobId;
}
function reportBody(tag) {
  return JSON.stringify({
    taskId: "T-PC", inputFindingIds: ["F-1"], changedFiles: ["src/a.js"],
    actualChanges: `修复 ${tag}`, verifyCommands: ["node --check"], verifyResults: "ok",
    observationWindow: "t1→t2", pendingItems: [], residualRisks: [], needsDeployRestart: false
  });
}

test("F-RV-19 派发面与生产 provider：宿主签名 claim → 链式 heartbeat；无前置/跨 bot 拒绝", () => {
  const home = mkHome();
  const root = mkProject();
  const snap = createSourceSnapshot(home, { cycleId: "snap-pc1", root }).cycleId;
  scaffoldDecision(home);
  const jobId = makeJob(home, snap);
  // bot 实例未注册 → 派发转 pending（留痕不落件）
  const pending = internals.issueJobDispatch(home, jobId, "coder-1");
  assert.equal(pending.ok, false, "无实例行时签发必须失败（fail closed）");
  // 实例上线（写行）→ 补发成功且幂等
  writeBotRow(home, "coder-1");
  const issued = internals.issueJobDispatch(home, jobId, "coder-1");
  assert.equal(issued.ok, true, issued.reason ?? "");
  assert.equal(internals.issueJobDispatch(home, jobId, "coder-1").idempotent, true, "重复派发幂等");
  // provider：claim 凭签名 dispatch；无 lease 不得链式；跨 bot 拒绝
  const claimCap = internals.productionJobCapabilityProvider(home, "coder-1", "job.claim", jobId);
  assert.ok(claimCap?.sig, "claim capability 应来自宿主签名 dispatch");
  assert.equal(internals.productionJobCapabilityProvider(home, "coder-1", "job.heartbeat", jobId), null, "无 lease 不得链式签发");
  assert.equal(internals.productionJobCapabilityProvider(home, "other-bot", "job.claim", jobId), null, "跨 bot 拒绝");
  // claim（消耗签名 capability）→ 有效 lease → 链式 heartbeat 成功
  const claimed = claimJob(home, { jobId, botId: "coder-1", capability: claimCap });
  assert.equal(claimed.ok, true, claimed.reason ?? "");
  assert.equal(botHoldsActiveLease(home, jobId, "coder-1"), true);
  const hbCap = internals.productionJobCapabilityProvider(home, "coder-1", "job.heartbeat", jobId);
  assert.ok(hbCap?.sig, "凭有效 lease 应链式签发 heartbeat capability");
  const hb = heartbeatJob(home, { jobId, botId: "coder-1", capability: hbCap });
  assert.equal(hb.ok, true, hb.reason ?? "");
});

test("F-RV-19 consumed dispatch is reissued after lease expiry and requeue", () => {
  const home = mkHome();
  const root = mkProject();
  const snap = createSourceSnapshot(home, { cycleId: "snap-requeue", root }).cycleId;
  scaffoldDecision(home);
  const jobId = makeJob(home, snap);
  writeBotRow(home, "coder-1");
  assert.equal(internals.issueJobDispatch(home, jobId, "coder-1").ok, true);
  const firstClaim = internals.productionJobCapabilityProvider(home, "coder-1", "job.claim", jobId);
  assert.equal(claimJob(home, { jobId, botId: "coder-1", capability: firstClaim }).ok, true);
  const expired = expireStaleJobLeases(home, { hostInstanceId: "host-test", now: Date.now() + 31_000 });
  assert.equal(expired[0]?.status, "requeued");
  internals.backfillJobDispatches(home);
  const secondClaim = internals.productionJobCapabilityProvider(home, "coder-1", "job.claim", jobId);
  assert.ok(secondClaim?.sig, "requeued job must receive a fresh claim dispatch");
  assert.notEqual(secondClaim.payload.nonce, firstClaim.payload.nonce);
  assert.equal(claimJob(home, { jobId, botId: "coder-1", capability: secondClaim }).ok, true);
});

test("F-RV-20/22 fix-report 快照绑定与同工件幂等重放", () => {
  const home = mkHome();
  const root = mkProject();
  const snap = createSourceSnapshot(home, { cycleId: "snap-pc2", root }).cycleId;
  scaffoldDecision(home);
  const jobId = makeJob(home, snap);
  writeBotRow(home, "coder-1");
  internals.issueJobDispatch(home, jobId, "coder-1");
  const claimCap = internals.productionJobCapabilityProvider(home, "coder-1", "job.claim", jobId);
  claimJob(home, { jobId, botId: "coder-1", capability: claimCap });
  // ① 无快照工件 → F-RV-20 拒绝
  const noSnap = submitReviewArtifact(home, {
    taskId: "T-PC", stage: "fix-report", authorBotId: "coder-1",
    body: reportBody("nosnap"), idempotencyKey: "fr-nosnap"
  });
  const repCap = internals.productionJobCapabilityProvider(home, "coder-1", "job.report", jobId);
  const bad = reportFix(home, {
    jobId, botId: "coder-1", fixReportArtifactId: noSnap.artifactId,
    findingIds: ["F-1"], changedPaths: ["src/a.js"], capability: repCap, workspaceRoot: root
  });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /sourceSnapshotId/);
  // ② 带快照 → 成功
  const art = submitReviewArtifact(home, {
    taskId: "T-PC", stage: "fix-report", authorBotId: "coder-1",
    body: reportBody("v1"), sourceSnapshotId: snap, idempotencyKey: "fr-snap"
  });
  const ok1 = reportFix(home, {
    jobId, botId: "coder-1", fixReportArtifactId: art.artifactId,
    findingIds: ["F-1"], changedPaths: ["src/a.js"], capability: repCap, workspaceRoot: root
  });
  assert.equal(ok1.ok, true, ok1.reason ?? "");
  // ③ 同工件幂等重放（无需新 capability）→ idempotent=true
  const replay = reportFix(home, {
    jobId, botId: "coder-1", fixReportArtifactId: art.artifactId,
    findingIds: ["F-1"], changedPaths: ["src/a.js"], capability: null, workspaceRoot: root
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotent, true, "同工件重放必须幂等返回既有结果");
  // ④ 修正正文新工件 → 终态拒绝（不同工件）
  const art2 = submitReviewArtifact(home, {
    taskId: "T-PC", stage: "fix-report", authorBotId: "coder-1",
    body: reportBody("v2"), sourceSnapshotId: snap, idempotencyKey: "fr-snap-v2"
  });
  const rejected = reportFix(home, {
    jobId, botId: "coder-1", fixReportArtifactId: art2.artifactId,
    findingIds: ["F-1"], changedPaths: ["src/a.js"], capability: null, workspaceRoot: root
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /终态/);
});

let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.stack ?? error.message);
    }
  }
} finally {
  for (const dir of homes.reverse()) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 尽力清理 */ }
  }
}
process.exit(failed > 0 ? 1 : 0);
