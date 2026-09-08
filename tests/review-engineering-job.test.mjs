/** R2-07 / F-P9-07: decision-bound engineering jobs and signed leases. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  jobsDir, jobFileFor, jobEventsFileFor, jobLeaseFileFor,
  JOB_EVENT_TYPES, JOB_DEFAULTS, nextJobId, readJobState, readJob,
  createEngineeringJob, claimJob, heartbeatJob, reportFix, expireStaleJobLeases
} from "../lib/review-jobs.js";
import { issueCapability } from "../lib/review-capability.js";
import { publishResult, writeUserDecision } from "../lib/review-results.js";
import { readAudit, submitReviewArtifact } from "../lib/review-store.js";
import { createSourceSnapshot, snapshotFileFor } from "../lib/review-evidence.js";
import { createRouteIntent, reconcileRoutes } from "../lib/review-relay.js";

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const homes = [];

function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-jobs-"));
  homes.push(home);
  return home;
}

/** F-RV-3：job 绑定物化 source snapshot（幂等）。 */
const SNAP = "snap-jobs";
function snapFor(home) {
  if (!fs.existsSync(snapshotFileFor(home, SNAP))) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-jobs-snap-"));
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

function prepareWorkspace(home) {
  const workspace = path.join(home, "workspace");
  fs.mkdirSync(path.join(workspace, "lib"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "tests"), { recursive: true });
  fs.writeFileSync(path.join(workspace, "lib", "existing.js"), "export {};\n");
  return workspace;
}

function publishFinal(home, taskId, key = taskId) {
  const { artifactId } = submitReviewArtifact(home, {
    taskId,
    stage: "final-lead",
    authorBotId: "reviewer-lead",
    body: `final ${taskId}`,
    idempotencyKey: `final-${key}`
  });
  // F-RV-15：fixture 走真实 relay（user-facing route committed 是 decision 的前置）
  const intent = createRouteIntent(home, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  const reconcile = reconcileRoutes(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead",
    copyToUserFacing: (id, { bodyFile }) => {
      const target = path.join(home, "bots", "review", "results", taskId, id, "body.md");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(bodyFile, target);
      return target;
    }
  });
  if (!intent.ok || !reconcile.completed) {
    throw new Error(`fixture 路由未完成：${JSON.stringify({ intent, reconcile })}`);
  }
  publishResult(home, {
    taskId, artifactId, stage: "final-lead", authorBotId: "reviewer-lead",
    findingIds: ["F-1", "F-2"]
  });
  return artifactId;
}

function writeDecision(home, {
  taskId,
  artifactId,
  revision = 1,
  choice = "authorize-repair",
  findingIds = ["F-1", "F-2"],
  scope = ["lib/"],
  acceptanceCriteria = ["targeted tests pass"]
}) {
  const result = writeUserDecision(home, {
    taskId, artifactId, revision, choice, findingIds, scope,
    acceptanceCriteria, author: "user"
  }, { principal: { role: "user" } });
  assert.equal(result.ok, true, result.reason);
  return result.decision;
}

function authorize(home, taskId, options = {}) {
  const artifactId = options.artifactId ?? publishFinal(home, taskId, options.key);
  const decision = writeDecision(home, { taskId, artifactId, ...options });
  return { artifactId, decision };
}

function createAuthorizedJob(home, taskId, options = {}) {
  const workspace = options.workspace ?? prepareWorkspace(home);
  const authorization = authorize(home, taskId, options);
  const result = createEngineeringJob(home, {
    taskId,
    decisionRevision: options.revision ?? 1,
    finalArtifactId: authorization.artifactId,
    decisionId: authorization.decision.hash,
    authorizedFindingIds: options.authorizedFindingIds ?? ["F-1"],
    scope: options.scope ?? ["lib/"],
    acceptanceCriteria: options.acceptanceCriteria ?? ["targeted tests pass"],
    engineeringBotId: options.engineeringBotId ?? "coder-bot",
    repairCycle: options.repairCycle ?? 1,
    sourceSnapshotId: snapFor(home)
  });
  assert.equal(result.ok, true, result.reason);
  return { ...result, ...authorization, workspace };
}

function registry(hostInstanceId = "host-1", botId = "coder-bot") {
  return [{ botId, pid: process.pid, startedAt: "test-process-start", hostInstanceId, at: "2026-08-28T00:00:00.001Z" }];
}

function capability(home, jobId, operation, {
  hostInstanceId = "host-1",
  botId = "coder-bot",
  ttlMs = 60_000
} = {}) {
  const registryItems = registry(hostInstanceId, botId);
  return {
    envelope: issueCapability(home, {
      botId,
      pid: process.pid,
      startedAt: "test-process-start",
      hostInstanceId,
      operations: [operation],
      jobId,
      ttlMs,
      registryItems
    }),
    registryItems,
    hostInstanceId,
    botId
  };
}

function claimWithFreshCapability(home, jobId, options = {}) {
  const cap = capability(home, jobId, "job.claim", options);
  return claimJob(home, {
    jobId,
    botId: cap.botId,
    hostInstanceId: cap.hostInstanceId,
    capability: cap.envelope,
    registryItems: cap.registryItems,
    leaseMs: options.leaseMs ?? 30_000
  });
}

let reportSeq = 0;
/** 十字段 fix-report 正文（F-RV-14：10 必填字段 + additionalProperties=false）。 */
function fixReportBody(job, { findingIds, changedPaths }) {
  return JSON.stringify({
    taskId: job.taskId,
    inputFindingIds: findingIds,
    changedFiles: changedPaths,
    actualChanges: "实际修改内容",
    verifyCommands: ["node --check"],
    verifyResults: "0 失败（实测）",
    observationWindow: "2026-08-28T00:00:00.000Z",
    pendingItems: [],
    residualRisks: [],
    needsDeployRestart: false
  });
}

function reportWithFreshCapability(home, jobId, input) {
  reportSeq += 1;
  const job = readJob(home, jobId);
  const findingIds = input.findingIds ?? ["F-1"];
  const changedPaths = input.changedPaths ?? ["lib/x.js"];
  const cap = capability(home, jobId, "job.report", input);
  const submitted = submitReviewArtifact(home, {
    taskId: job.taskId,
    stage: "fix-report",
    authorBotId: input.botId ?? "coder-bot",
    body: input.body ?? fixReportBody(job, { findingIds, changedPaths }),
    sourceSnapshotId: job.sourceSnapshotId,
    idempotencyKey: `fix-report-${jobId}-${reportSeq}`,
    artifactId: input.fixReportArtifactId
  });
  return reportFix(home, {
    jobId,
    botId: cap.botId,
    capability: cap.envelope,
    registryItems: cap.registryItems,
    fixReportArtifactId: submitted.artifactId,
    findingIds,
    changedPaths,
    workspaceRoot: input.workspaceRoot
  });
}

test("F-P9-07 create rejects missing persisted decision and audits", () => {
  const home = mkHome();
  const result = createEngineeringJob(home, {
    taskId: "T-NONE", decisionRevision: 1, authorizedFindingIds: ["F-1"],
    scope: ["lib/"], acceptanceCriteria: ["tests"], engineeringBotId: "coder-bot"
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /不存在/);
  assert.equal(readAudit(home).some((row) => row.type === "job-create-rejected"), true);
});

test("F-P9-07 create rejects non-authorizing decision choice", () => {
  const home = mkHome();
  const artifactId = publishFinal(home, "T-CHOICE");
  writeDecision(home, {
    taskId: "T-CHOICE", artifactId, choice: "accept", findingIds: [], scope: ["lib/"],
    acceptanceCriteria: ["tests"]
  });
  const result = createEngineeringJob(home, {
    taskId: "T-CHOICE", decisionRevision: 1, authorizedFindingIds: ["F-1"],
    scope: ["lib/"], acceptanceCriteria: ["tests"], engineeringBotId: "coder-bot"
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /未授权修复/);
});

test("F-P9-07 create rejects findingIds escalation", () => {
  const home = mkHome();
  authorize(home, "T-FIND", { findingIds: ["F-1"] });
  const result = createEngineeringJob(home, {
    taskId: "T-FIND", decisionRevision: 1, authorizedFindingIds: ["F-1", "F-2"],
    scope: ["lib/"], acceptanceCriteria: ["targeted tests pass"], engineeringBotId: "coder-bot"
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /超出/);
});

test("F-P9-07 create requires exact decision scope and acceptanceCriteria", () => {
  const home = mkHome();
  authorize(home, "T-EXACT");
  const base = {
    taskId: "T-EXACT", decisionRevision: 1, authorizedFindingIds: ["F-1"],
    engineeringBotId: "coder-bot"
  };
  assert.equal(createEngineeringJob(home, {
    ...base, scope: ["tests/"], acceptanceCriteria: ["targeted tests pass"]
  }).ok, false);
  assert.equal(createEngineeringJob(home, {
    ...base, scope: ["lib/"], acceptanceCriteria: ["different"]
  }).ok, false);
});

test("R2-07 job metadata is frozen from the decision record", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-JOB");
  const job = JSON.parse(fs.readFileSync(jobFileFor(home, created.jobId), "utf8"));
  assert.deepEqual(Object.keys(job).sort(), [
    "acceptanceCriteria", "authorizedFindingIds", "createdAt", "decisionId",
    "decisionRevision", "engineeringBotId", "finalArtifactId", "jobId",
    "repairCycle", "scope", "sourceSnapshotId", "taskId"
  ]);
  assert.equal(job.sourceSnapshotId, SNAP, "F-RV-3：job 绑定评审 cycle 的物化 snapshot");
  assert.equal(job.finalArtifactId, created.artifactId);
  assert.equal(job.decisionId, created.decision.hash);
  assert.equal(readJob(home, created.jobId).status, "created");
  assert.equal(fs.existsSync(jobEventsFileFor(home, created.jobId)), true);
  assert.equal(jobsDir(home), path.join(home, "bots", "review", "jobs"));
});

test("F-P9-07 claim rejects absent, forged, expired and replayed capabilities", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-CAP");
  const base = { jobId: created.jobId, botId: "coder-bot", hostInstanceId: "host-1", registryItems: registry() };
  assert.equal(claimJob(home, { ...base, capability: null }).ok, false);
  assert.equal(claimJob(home, {
    ...base,
    capability: { payload: { botId: "coder-bot", jobId: created.jobId }, sig: "0".repeat(64) }
  }).ok, false);

  const expired = capability(home, created.jobId, "job.claim", { ttlMs: -1 });
  assert.equal(claimJob(home, {
    ...base, capability: expired.envelope, registryItems: expired.registryItems
  }).ok, false);

  const valid = capability(home, created.jobId, "job.claim");
  const claimed = claimJob(home, {
    ...base, capability: valid.envelope, registryItems: valid.registryItems
  });
  assert.equal(claimed.ok, true);
  assert.deepEqual(Object.keys(claimed.lease).sort(), [
    "attempt", "claimAt", "claimOwner", "generation", "heartbeatAt",
    "hostInstanceId", "leaseUntil", "maxAttempts", "reportArtifactId"
  ]);
  assert.equal(claimed.lease.claimOwner, "coder-bot");
  assert.equal(claimed.lease.attempt, 1);
  assert.equal(claimJob(home, {
    ...base, capability: valid.envelope, registryItems: valid.registryItems
  }).ok, false, "nonce replay must reject");
  assert.equal(fs.existsSync(jobLeaseFileFor(home, created.jobId)), true);
});

function heartbeatWithFreshCapability(home, jobId, options = {}) {
  const cap = capability(home, jobId, "job.heartbeat", options);
  return heartbeatJob(home, {
    jobId,
    botId: cap.botId,
    hostInstanceId: cap.hostInstanceId,
    claimOwner: cap.botId,
    capability: cap.envelope,
    registryItems: cap.registryItems
  });
}

test("F-RV-2 job.heartbeat capability 闭环七矩阵", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-HB2");
  assert.equal(claimWithFreshCapability(home, created.jobId).ok, true);

  // ① 无 capability → 拒绝（且不得有 hostInstanceId fallback）
  assert.equal(heartbeatJob(home, {
    jobId: created.jobId, botId: "coder-bot", claimOwner: "coder-bot"
  }).ok, false);

  // ② operation 不匹配（job.report cap 用于 heartbeat）→ 拒绝
  const wrongOp = capability(home, created.jobId, "job.report");
  assert.equal(heartbeatJob(home, {
    jobId: created.jobId, botId: "coder-bot", claimOwner: "coder-bot",
    capability: wrongOp.envelope, registryItems: wrongOp.registryItems
  }).ok, false);

  // ③ jobId 不匹配（cap 绑定另一 job）→ 拒绝
  const other = createAuthorizedJob(home, "T-HB-OTHER");
  const otherCap = capability(home, other.jobId, "job.heartbeat");
  assert.equal(heartbeatJob(home, {
    jobId: created.jobId, botId: "coder-bot", claimOwner: "coder-bot",
    capability: otherCap.envelope, registryItems: otherCap.registryItems
  }).ok, false);

  // ④ 过期 capability → 拒绝
  const expired = capability(home, created.jobId, "job.heartbeat", { ttlMs: -1 });
  assert.equal(heartbeatJob(home, {
    jobId: created.jobId, botId: "coder-bot", claimOwner: "coder-bot",
    capability: expired.envelope, registryItems: expired.registryItems
  }).ok, false);

  // ⑤ 合法新 capability → 成功续租（不发明状态事件）
  const before = readJob(home, created.jobId);
  const okHb = heartbeatWithFreshCapability(home, created.jobId);
  assert.equal(okHb.ok, true);
  assert.equal(readJob(home, created.jobId).events.length, before.events.length, "heartbeat 不发明状态事件");

  // ⑥ 同一 capability 重复 nonce → 拒绝重放
  const cap = capability(home, created.jobId, "job.heartbeat");
  assert.equal(heartbeatJob(home, {
    jobId: created.jobId, botId: cap.botId, claimOwner: cap.botId,
    capability: cap.envelope, registryItems: cap.registryItems
  }).ok, true);
  assert.equal(heartbeatJob(home, {
    jobId: created.jobId, botId: cap.botId, claimOwner: cap.botId,
    capability: cap.envelope, registryItems: cap.registryItems
  }).ok, false, "nonce 单次消费拒绝重放");

  // ⑦ 实例轮换后的旧 capability → 拒绝（注册表身份不匹配）
  assert.equal(readJob(home, created.jobId).status, "claimed");
  const pre = capability(home, created.jobId, "job.heartbeat");
  const rotatedRow = registry("rotated-host", "coder-bot");
  assert.equal(heartbeatJob(home, {
    jobId: created.jobId, botId: "coder-bot", claimOwner: "coder-bot",
    capability: pre.envelope, registryItems: rotatedRow
  }).ok, false, "实例轮换后旧 capability 拒绝（注册表身份不匹配）");
});

test("F-P9-07 reportFix rejects paths beyond job.scope and audits", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-SCOPE");
  assert.equal(claimWithFreshCapability(home, created.jobId).ok, true);
  const rejected = reportWithFreshCapability(home, created.jobId, {
    workspaceRoot: created.workspace,
    changedPaths: [path.join(created.workspace, "tests", "outside.js")]
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /job.scope/);
  assert.equal(readJob(home, created.jobId).status, "claimed");
  assert.equal(readAudit(home).some((row) => row.type === "job-fix-report-rejected"), true);
});

test("R2-07 reportFix rejects finding escalation and accepts normalized in-scope paths", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-REPORT");
  assert.equal(claimWithFreshCapability(home, created.jobId).ok, true);
  assert.equal(reportWithFreshCapability(home, created.jobId, {
    workspaceRoot: created.workspace,
    findingIds: ["F-2"],
    changedPaths: ["lib/new.js"]
  }).ok, false);
  const reported = reportWithFreshCapability(home, created.jobId, {
    workspaceRoot: created.workspace,
    findingIds: ["F-1"],
    changedPaths: ["lib/../lib/new.js"],
    fixReportArtifactId: "A-FIX-OK"
  });
  assert.equal(reported.ok, true);
  assert.equal(readJob(home, created.jobId).status, "fix-reported");
  assert.equal(fs.existsSync(jobLeaseFileFor(home, created.jobId)), false);
});

test("F-P9-07 fix-reported is terminal and cannot be reclaimed", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-TERM");
  assert.equal(claimWithFreshCapability(home, created.jobId).ok, true);
  assert.equal(reportWithFreshCapability(home, created.jobId, {
    workspaceRoot: created.workspace, changedPaths: ["lib/fixed.js"]
  }).ok, true);
  assert.equal(claimWithFreshCapability(home, created.jobId).ok, false);
  assert.equal(readJob(home, created.jobId).status, "fix-reported");
});

test("F-P9-07 three failures dead-letter old job; only new decision revision creates continuation", () => {
  const home = mkHome();
  const workspace = prepareWorkspace(home);
  const created = createAuthorizedJob(home, "T-DEAD", { workspace });

  for (let attempt = 1; attempt <= JOB_DEFAULTS.maxAttempts; attempt += 1) {
    const claimed = claimWithFreshCapability(home, created.jobId, { leaseMs: 1 });
    assert.equal(claimed.ok, true, `attempt ${attempt}`);
    const recycled = expireStaleJobLeases(home, {
      hostInstanceId: "single-host-writer", now: claimed.lease.leaseUntil + 1
    });
    assert.equal(recycled.length, 1);
    assert.equal(recycled[0].attempt, attempt);
    assert.equal(recycled[0].status, attempt === JOB_DEFAULTS.maxAttempts ? "dead-lettered" : "requeued");
  }
  const old = readJob(home, created.jobId);
  assert.equal(old.status, "dead-lettered");
  assert.equal(old.events.filter((event) => event.type === "failed").length, 3);
  assert.equal(old.events.filter((event) => event.type === "requeued").length, 2);
  assert.equal(claimWithFreshCapability(home, created.jobId).ok, false, "old job must never revive");

  writeDecision(home, {
    taskId: "T-DEAD", artifactId: created.artifactId, revision: 2,
    choice: "authorize-repair", findingIds: ["F-1"], scope: ["lib/"],
    acceptanceCriteria: ["targeted tests pass"]
  });
  const next = createEngineeringJob(home, {
    taskId: "T-DEAD", decisionRevision: 2, finalArtifactId: created.artifactId,
    authorizedFindingIds: ["F-1"], scope: ["lib/"],
    acceptanceCriteria: ["targeted tests pass"], engineeringBotId: "coder-bot",
    repairCycle: 2, sourceSnapshotId: snapFor(home)
  });
  assert.equal(next.ok, true, next.reason);
  assert.notEqual(next.jobId, created.jobId);
  assert.equal(claimWithFreshCapability(home, next.jobId).ok, true);
  assert.equal(readJob(home, created.jobId).status, "dead-lettered");
});

test("F-RV-14 十字段 schema 生产校验：非 JSON/缺字段/额外字段/越权/错 task/合法 六矩阵", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-SCHEMA");
  assert.equal(claimWithFreshCapability(home, created.jobId).ok, true);
  const base = { workspaceRoot: created.workspace };
  const job = readJob(home, created.jobId);

  // 普通字符串正文 → 拒绝
  const plain = reportWithFreshCapability(home, created.jobId, { ...base, body: "普通字符串正文" });
  assert.equal(plain.ok, false);
  assert.match(plain.reason, /严格 JSON/);

  // 缺字段 → 拒绝
  const missing = reportWithFreshCapability(home, created.jobId, {
    ...base,
    body: JSON.stringify({ taskId: "T-SCHEMA", inputFindingIds: ["F-1"], changedFiles: ["lib/x.js"] })
  });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /缺必填字段/);

  // 额外字段（结论类）→ 拒绝
  const extra = reportWithFreshCapability(home, created.jobId, {
    ...base,
    body: JSON.stringify({
      ...JSON.parse(fixReportBody(job, { findingIds: ["F-1"], changedPaths: ["lib/x.js"] })),
      conclusion: "通过"
    })
  });
  assert.equal(extra.ok, false);
  assert.match(extra.reason, /额外键/);

  // finding 越权（正文与参数一致但超出 job 授权）→ 拒绝
  const escalation = reportWithFreshCapability(home, created.jobId, { ...base, findingIds: ["F-2"] });
  assert.equal(escalation.ok, false);
  assert.match(escalation.reason, /越权/);

  // changed file 越 job.scope → 拒绝
  const fileEscalation = reportWithFreshCapability(home, created.jobId, {
    ...base, changedPaths: [path.join(created.workspace, "secret.js")]
  });
  assert.equal(fileEscalation.ok, false);
  assert.match(fileEscalation.reason, /job.scope/);

  // 错 task（正文 taskId 与 job 不符）→ 拒绝
  const wrongTask = reportWithFreshCapability(home, created.jobId, {
    ...base,
    body: fixReportBody({ taskId: "T-OTHER" }, { findingIds: ["F-1"], changedPaths: ["lib/x.js"] })
  });
  assert.equal(wrongTask.ok, false);
  assert.match(wrongTask.reason, /taskId/);

  // 合法十字段报告 → 接受
  const valid = reportWithFreshCapability(home, created.jobId, { ...base, findingIds: ["F-1"], changedPaths: ["lib/x.js"] });
  assert.equal(valid.ok, true);
  assert.equal(readJob(home, created.jobId).status, "fix-reported");
});

test("F-RV-5 job lease 损坏 → fail closed：不解释为无 lease、不覆盖原文件、回收跳过", () => {
  const home = mkHome();
  const created = createAuthorizedJob(home, "T-LEASEC");
  fs.writeFileSync(jobLeaseFileFor(home, created.jobId), "{ corrupt !!!");
  const cap = capability(home, created.jobId, "job.claim");
  const claim = claimJob(home, {
    jobId: created.jobId, botId: cap.botId, hostInstanceId: cap.hostInstanceId,
    capability: cap.envelope, registryItems: cap.registryItems
  });
  assert.equal(claim.ok, false);
  assert.match(claim.reason, /损坏|fail closed/);
  assert.equal(fs.readFileSync(jobLeaseFileFor(home, created.jobId), "utf8"), "{ corrupt !!!", "原 lease 文件不得被覆盖");
  const recycled = expireStaleJobLeases(home, {});
  assert.deepEqual(recycled, [], "损坏 lease 不得被当作可回收/可接管的 lease");
  assert.ok(readAudit(home).some((row) => row.type === "job-lease-recycle-rejected" && /损坏/.test(row.reason)));
});

test("R2-07 frozen exports and event types", () => {
  assert.deepEqual(JOB_EVENT_TYPES, [
    "created", "claimed", "started", "fix-reported", "failed", "expired",
    "dead-lettered", "requeued"
  ]);
  assert.deepEqual(JOB_DEFAULTS, { leaseMs: 30_000, maxAttempts: 3 });
  assert.match(nextJobId(), /^J-/);
});

let failed = 0;
try {
  for (const [name, fn] of tests) {
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
    try {
      makeWritable(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* 测试退出清理 */ }
  }
}
process.exit(failed > 0 ? 1 : 0);
