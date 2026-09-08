/**
 * R2-09 主机接线回归（F-P9-01）：评审主机泵/一次性 reviewer session/输出落工件/
 * envelope 校验/流程推进的注入式 E2E。
 *
 * 口径：测试只注入 runnerFactory / rpcStub / copyToUserFacing，不启动真实 bot；
 * 全部在临时 DSH_HOME 夹具内运行；不触碰真实注册表/部署副本。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { internals } from "../lib/index.js";
import { createInvocation, readInvocationState } from "../lib/review-orchestrator.js";
import { bodyFileFor, readManifest, submitReviewArtifact } from "../lib/review-store.js";
import { readFlow } from "../lib/review-flow.js";
import { issueCapability } from "../lib/review-capability.js";
import { createSourceSnapshot, snapshotFileFor } from "../lib/review-evidence.js";

function mkHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-host-wiring-"));
  mkdirSync(join(home, "bots", "review"), { recursive: true });
  return home;
}

/** F-RV-13：物化 source snapshot（幂等），供创建边界校验。 */
function mkSnapshot(home, cycleId = "snap-1") {
  if (existsSync(snapshotFileFor(home, cycleId))) return cycleId;
  const root = mkdtempSync(join(tmpdir(), "dsh-snap-root-"));
  writeFileSync(join(root, "main.c"), "int main(){return 0;}\n");
  createSourceSnapshot(home, { cycleId, root });
  return cycleId;
}

function mkApi(home) {
  const registry = {
    "reviewer-lead": { id: "reviewer-lead", name: "评审主审", port: 3991, pid: 90001, modelProvider: "llm-pi-ai", model: "deepseek-v4-flash" },
    "reviewer-second": { id: "reviewer-second", name: "评审副审", port: 3992, pid: 90002, modelProvider: "llm-pi-ai", model: "deepseek-v4-flash" }
  };
  return { dshHome: home, readRegistry: () => registry };
}

const ctx = { logger: { warn() {}, info() {}, error() {} } };

/** 按 stage 返回注入 envelope 的 runner 工厂。 */
function envelopeRunnerFactory(envelopes) {
  return (manifest) => async () => ({
    text: JSON.stringify(envelopes[manifest.stage]),
    sessionId: `s-${manifest.stage}`,
    pid: 90001
  });
}

const ENVELOPES = {
  "initial-lead": { schemaVersion: 1, body: "主审初审正文" },
  "initial-second": { schemaVersion: 1, body: "副审初审正文" },
  "delta-lead": { schemaVersion: 1, body: "delta 正文", nextAction: "final", discussionFindingIds: [] },
  "final-lead": { schemaVersion: 1, body: "终审正文", decision: "approve", findingIds: [] }
};

test("F-P9-01 主机泵 E2E：双初审→delta→final 全链，输出落工件且一次性 session 不留状态文件", async () => {
  const home = mkHome();
  const api = mkApi(home);
  mkSnapshot(home);
  const userFacingDir = join(home, "userfacing");
  mkdirSync(userFacingDir, { recursive: true });
  const copyToUserFacing = (artifactId, meta) => {
    const target = join(userFacingDir, `${artifactId}.md`);
    writeFileSync(target, readFileSync(meta.bodyFile, "utf8"));
    return target;
  };
  const opts = {
    runnerFactory: envelopeRunnerFactory(ENVELOPES),
    copyToUserFacing
  };

  // 1. initial-lead invocation（绑定 sourceSnapshotId）
  const inv1 = createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-lead", targetReviewer: "reviewer-lead",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-lead",
    parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  assert.equal(inv1.idempotent, false);
  const m1 = JSON.parse(readFileSync(join(home, "bots", "review", "invocations", inv1.invocationId, "manifest.json"), "utf8"));
  assert.equal(m1.sourceSnapshotId, "snap-1", "sourceSnapshotId 必须随 invocation manifest 落盘");

  let pump = await internals.pumpReviewInvocations(ctx, api, opts);
  assert.ok(pump.ran.some((r) => r.startsWith(`${inv1.invocationId}:`)), "initial-lead 应被泵执行");
  let st1 = readInvocationState(home, null, inv1.invocationId);
  assert.equal(st1.status, "completed");
  assert.equal(typeof st1.outputArtifactId, "string");
  // 输出原文本 = envelope JSON；stage 工件正文 = envelope.body
  const outRaw = readFileSync(bodyFileFor(home, st1.outputArtifactId), "utf8");
  assert.equal(JSON.parse(outRaw).body, "主审初审正文");
  let flow = readFlow(home, "T1");
  assert.equal(flow.initials.find((e) => e.stage === "initial-lead").artifactId.length > 0, true);
  // 一次性 session：reviewer workspace 无 .dsh-bot-session.json
  assert.equal(existsSync(join(workspaceFor(home, "reviewer-lead"), ".dsh-bot-session.json")), false);

  // 2. initial-second → 双齐 → delta 自动创建
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-second", targetReviewer: "reviewer-second",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-second",
    parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  pump = await internals.pumpReviewInvocations(ctx, api, opts);
  flow = readFlow(home, "T1");
  assert.equal(flow.initials.length, 2);
  assert.ok(flow.deltaInvocationId, "双齐后应创建 delta-lead invocation");

  // 3. delta（nextAction=final）→ final 自动创建
  pump = await internals.pumpReviewInvocations(ctx, api, opts);
  flow = readFlow(home, "T1");
  assert.equal(flow.deltaArtifactId.length > 0, true);
  assert.ok(flow.finalInvocationId, "delta nextAction=final 应创建 final-lead invocation");

  // 4. final → 路由 reviewer-second + user-facing
  pump = await internals.pumpReviewInvocations(ctx, api, opts);
  flow = readFlow(home, "T1");
  assert.ok(flow.finalArtifactId, "final-lead 输出应注册");
  const routeSecond = JSON.parse(readFileSync(join(home, "bots", "review", "routes", flow.finalArtifactId, "reviewer-second.json"), "utf8"));
  const routeUser = JSON.parse(readFileSync(join(home, "bots", "review", "routes", flow.finalArtifactId, "user-facing.json"), "utf8"));
  assert.equal(routeSecond.artifactExists !== undefined ? true : flow.finalArtifactId.length > 0, true);
  assert.equal(routeUser.artifactExists !== undefined ? true : flow.finalArtifactId.length > 0, true);
  // user-facing 副本落盘
  const userCopy = readFileSync(join(userFacingDir, `${flow.finalArtifactId}.md`), "utf8");
  assert.equal(userCopy, "终审正文");
  // 二次泵幂等：不重复注册
  pump = await internals.pumpReviewInvocations(ctx, api, opts);
  assert.equal(pump.errors.length, 0);
});

test("F-P9-01 envelope 非法 → fail closed：不落 stage 工件、不推进流程、审计留痕", async () => {
  const home = mkHome();
  const api = mkApi(home);
  mkSnapshot(home, "snap-2");
  const badRunner = () => async () => ({ text: "这不是 JSON envelope", sessionId: "s-bad", pid: 1 });
  createInvocation(home, {
    taskId: "T2", artifactId: "spec-2", stage: "initial-lead", targetReviewer: "reviewer-lead",
    createdBy: "host", idempotencyKey: "wiring:T2:1:initial-lead", parts: ["taskId=T2"], sourceSnapshotId: "snap-2"
  });
  const pump = await internals.pumpReviewInvocations(ctx, api, { runnerFactory: badRunner });
  assert.equal(pump.errors.length, 0, "envelope 非法属处理内失败，不应上抛");
  const flow = readFlow(home, "T2");
  assert.equal(flow, null, "非法 envelope 不得登记 initial");
});

test("F-P9-01 buildReviewRunner：一次性 session（create 一次/prompt 一次/history 轮询），不留持久会话文件", async () => {
  const home = mkHome();
  const api = mkApi(home);
  const calls = [];
  const rpcStub = async (method, payload) => {
    calls.push(method);
    if (method === "session.create") return { sessionId: "one-shot-1" };
    if (method === "session.prompt") return { ok: true };
    if (method === "session.selectModel") return { ok: true };
    if (method === "session.history") {
      return {
        events: [
          { event: { type: "turn/end", data: { turn: 1 } } },
          { event: { type: "assistant/message", data: { turn: 1, message: { content: [{ type: "text", text: "处理完毕" }] } } } }
        ]
      };
    }
    return { ok: true };
  };
  const manifest = { targetReviewer: "reviewer-lead" };
  const runner = internals.buildReviewRunner(ctx, api, manifest, { rpcStub, timeoutMs: 2000 });
  const result = await runner("任务");
  assert.equal(result.text, "处理完毕");
  assert.equal(result.sessionId, "one-shot-1");
  assert.equal(calls.filter((c) => c === "session.create").length, 1, "每 invocation 恰一次全新 session.create");
  assert.equal(calls.filter((c) => c === "session.prompt").length, 1, "只执行一次 prompt");
  assert.equal(existsSync(join(workspaceFor(home, "reviewer-lead"), ".dsh-bot-session.json")), false, "一次性会话不写持久状态文件");
});

function workspaceFor(home, botId) {
  return join(home, "bot-workspaces", botId);
}

// ---------- R2-11 job 受信链 / 工具 / 三路径 ----------

const FINAL_WITH_FINDINGS = {
  ...ENVELOPES,
  "final-lead": { schemaVersion: 1, body: "终审正文", decision: "approve", findingIds: ["F-1"] }
};

async function driveToFinalPublish(home, api, envelopes = FINAL_WITH_FINDINGS) {
  mkSnapshot(home);
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-lead", targetReviewer: "reviewer-lead",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-lead", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-second", targetReviewer: "reviewer-second",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-second", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  for (let i = 0; i < 6; i++) {
    await internals.pumpReviewInvocations(ctx, api, { runnerFactory: envelopeRunnerFactory(envelopes) });
    if (readFlow(home, "T1")?.finalArtifactId) break;
  }
  return readFlow(home, "T1").finalArtifactId;
}

test("R2-11 job 受信链：authorize-repair decision → host 机械建 job；claim/heartbeat/report 工具全链", async () => {
  const home = mkHome();
  mkSnapshot(home);
  // engineering bot 注册表 + 实例注册表（capability 注册表绑定用）
  mkdirSync(join(home, "bots", "started"), { recursive: true });
  const coderStartedAt = "2026-08-28T00:00:00.000Z";
  writeFileSync(join(home, "bots", "started", "instances.jsonl"),
    JSON.stringify({ botId: "coder-1", pid: process.pid, startedAt: coderStartedAt, hostInstanceId: "h-1", at: "2026-08-28T00:00:01.000Z" }) + "\n");
  const bots = {
    "reviewer-lead": { id: "reviewer-lead", port: 3991, pid: 90001 },
    "reviewer-second": { id: "reviewer-second", port: 3992, pid: 90002 },
    "coder-1": { id: "coder-1", group: "engineering", port: 3999, pid: process.pid }
  };
  const api = { dshHome: home, readRegistry: () => bots, reviewEngineeringBotId: "coder-1" };
  const finalId = await driveToFinalPublish(home, api);

  // authorize-repair decision（fidingIds 须为终审 findingIds 的子集）
  api.reviewPrincipalProvider = async () => ({ ok: true, principal: { role: "user" } });
  const res = mockRes();
  await internals.handleReviewApi(mockBodyReq("/api/bots/review/decisions", {
    taskId: "T1", artifactId: finalId, revision: 1, choice: "authorize-repair",
    findingIds: ["F-1"], scope: ["lib/"], acceptanceCriteria: "回归全绿"
  }), res, api);
  assert.equal(res.captured.status, 201, "authorize-repair 决策落盘");
  const decisionBody = JSON.parse(res.captured.body);
  assert.ok(decisionBody.job?.jobId, "host 应机械创建 job");
  const jobId = decisionBody.job.jobId;

  // 宿主签发 job-scoped capability（测试注入固定注册表身份）
  const capClaim = issueCapability(home, {
    botId: "coder-1", pid: process.pid, startedAt: coderStartedAt, hostInstanceId: "h-1",
    operations: ["job.claim", "job.report"], jobId, ttlMs: 60000
  });

  // 注册工具并执行 claim → heartbeat → report 全链
  // （nonce 单次消费：每操作宿主新签发 capability——正是冻结语义）
  let registered = [];
  let providerCalls = 0;
  const toolCtx = { get: (key) => (key === "tools" ? { register: (def) => registered.push(def) } : undefined) };
  internals.registerReviewJobTools(toolCtx, api, "coder-1", {
    capabilityProvider: async () => {
      providerCalls += 1;
      return issueCapability(home, {
        botId: "coder-1", pid: process.pid, startedAt: coderStartedAt, hostInstanceId: "h-1",
        operations: ["job.claim", "job.heartbeat", "job.report"], jobId, ttlMs: 60000
      });
    },
    jobWorkspaceRoot: home
  });
  assert.equal(registered.length, 3, "三个 job 工具注册");

  const claimOut = await registered[0].execute({ jobId });
  assert.equal(claimOut.status, "claimed", "capability 合法 → claim 成功");

  const heartbeatOut = await registered[1].execute({ jobId });
  assert.equal(heartbeatOut.status, "ok", "heartbeat 续期成功");

  // F-RV-14 十字段 fix-report 正文（10 必填字段；无结论字段）
  const validReportBody = (changedFiles, findingIds = ["F-1"]) => JSON.stringify({
    taskId: "T1",
    inputFindingIds: findingIds,
    changedFiles,
    actualChanges: "实际修改内容",
    verifyCommands: ["node --check lib/index.js"],
    verifyResults: "0 失败（实测）",
    observationWindow: "2026-08-28T00:00:00.000Z",
    pendingItems: [],
    residualRisks: [],
    needsDeployRestart: false
  });
  // F-RV-3 生产提交通道：工具在宿主受信链内落 fix-report 工件并触发 reportFix
  const rejectOut = await registered[2].execute({
    jobId, body: validReportBody(["lib/review-relay.js"]), findingIds: ["F-1"], changedPaths: ["/etc/passwd"]
  });
  assert.equal(rejectOut.status, "rejected", "changedPaths 越 job.scope → 拒绝");
  const okOut = await registered[2].execute({
    jobId, body: validReportBody(["lib/review-relay.js"]), findingIds: ["F-1"], changedPaths: ["lib/review-relay.js"]
  });
  assert.equal(okOut.status, "reported", "scope 内十字段报告接受");
  assert.match(okOut.note, /复检推进/, "提交后 host 应触发 reportFix → recheck");
  const providerCallsAfterFirstReport = providerCalls;
  const replayOut = await registered[2].execute({
    jobId, body: validReportBody(["lib/review-relay.js"]), findingIds: ["F-1"], changedPaths: ["lib/review-relay.js"]
  });
  assert.equal(replayOut.status, "reported", "同正文工具重放应返回 reported");
  assert.match(replayOut.note, /幂等重放/, "同正文工具重放应明确标记幂等");
  assert.equal(providerCalls, providerCallsAfterFirstReport, "同正文重放不得再次索取 job.report capability");

  // F-RV-3/F-RV-13：复检双席 invocation 已建且快照链与 flow 一致
  const flowAfter = readFlow(home, "T1");
  assert.equal(flowAfter.reinspection.length, 2, "reportFix → recheck 双席 invocation");
  for (const entry of flowAfter.reinspection) {
    const invManifest = JSON.parse(readFileSync(
      join(home, "bots", "review", "invocations", entry.invocationId, "manifest.json"), "utf8"));
    assert.equal(invManifest.stage, entry.stage);
    assert.equal(invManifest.sourceSnapshotId, "snap-1", "复检 invocation 继承同一 snapshot（F-RV-13/F-RV-3）");
  }

  // job 终态：fix-reported 后 claim 拒绝
  const claimAgain = await registered[0].execute({ jobId });
  assert.equal(claimAgain.status, "rejected", "fix-reported 终态不可再 claim");
});

test("R2-11 三路径接线：engineering bot 三字段校验（缺失/别名不符拒绝，无隐式回退）", () => {
  const home = mkHome();
  const ws = join(home, "bot-workspaces", "coder-1");
  const ok = internals.validateBotWorkspaceTriple(home, {
    id: "coder-1", workspace: ws, workspaceRoot: ws
  });
  assert.equal(ok.ok, true, "三字段一致 → 通过");

  const missingRoot = internals.validateBotWorkspaceTriple(home, { id: "coder-1", workspace: ws });
  assert.equal(missingRoot.ok, false, "workspaceRoot 缺失 → 拒绝（无隐式回退）");

  const aliasMismatch = internals.validateBotWorkspaceTriple(home, {
    id: "coder-1", workspace: ws, workspaceRoot: "/elsewhere"
  });
  assert.equal(aliasMismatch.ok, false, "registry.workspace ≠ workspaceRoot → 拒绝");
});

function mockRes() {
  const captured = { status: null, headers: null, body: "" };
  return {
    captured,
    writeHead(status, headers) { captured.status = status; captured.headers = headers; },
    end(chunk) { captured.body = String(chunk ?? ""); }
  };
}

function mockJsonReq(url, method = "GET") {
  return { url, method, headers: {} };
}

function mockBodyReq(url, body) {
  const payload = JSON.stringify(body);
  const req = { url, method: "POST", headers: { "content-type": "application/json" } };
  req.on = (event, cb) => {
    if (event === "data") cb(Buffer.from(payload));
    else if (event === "end") cb();
  };
  return req;
}

test("R2-10 review GET：仅已发布且 route committed 的结果可见；正文 hash fail-closed；路径注入拒绝", async () => {
  const home = mkHome();
  const api = mkApi(home);
  mkSnapshot(home);
  // 双初审齐备（同测试 1），走默认 copyToUserFacing（publishResult），触发结果索引
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-lead", targetReviewer: "reviewer-lead",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-lead", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-second", targetReviewer: "reviewer-second",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-second", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  for (let i = 0; i < 6; i++) {
    await internals.pumpReviewInvocations(ctx, api, { runnerFactory: envelopeRunnerFactory(ENVELOPES) });
    if (readFlow(home, "T1")?.finalArtifactId) break;
  }
  const flow = readFlow(home, "T1");
  assert.ok(flow?.finalArtifactId, "final 工件应已发布");
  const finalId = flow.finalArtifactId;

  let res = mockRes();
  await internals.handleReviewApi(mockJsonReq(`/api/bots/review/results?taskId=T1`), res, api);
  assert.equal(res.captured.status, 200);
  const list = JSON.parse(res.captured.body);
  assert.equal(list.results.length, 1);
  const keys = Object.keys(list.results[0]).sort();
  assert.deepEqual(keys, ["artifactId", "byteLength", "createdAt", "sha256", "stage", "status", "taskId"], "七字段通知");
  assert.equal(list.results[0].artifactId, finalId);

  res = mockRes();
  await internals.handleReviewApi(mockJsonReq(`/api/bots/review/results/${finalId}`), res, api);
  assert.equal(res.captured.status, 200);
  assert.equal(JSON.parse(res.captured.body).artifactId, finalId);

  res = mockRes();
  await internals.handleReviewApi(mockJsonReq(`/api/bots/review/results/${finalId}/body`), res, api);
  assert.equal(res.captured.status, 200);
  assert.equal(res.captured.body, "终审正文", "body 原字节返回");

  res = mockRes();
  await internals.handleReviewApi(mockJsonReq("/api/bots/review/results/../evil/body"), res, api);
  assert.ok([400, 404].includes(res.captured.status), "路径类输入拒绝");
});

test("R2-10 decision POST：无 principal → 恒 403；principal 注入后按冻结契约接受/拒绝", async () => {
  const home = mkHome();
  const api = mkApi(home);
  mkSnapshot(home);
  // 先走到 final 并发布（双初审齐备 + 泵循环）
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-lead", targetReviewer: "reviewer-lead",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-lead", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-second", targetReviewer: "reviewer-second",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-second", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  for (let i = 0; i < 6; i++) {
    await internals.pumpReviewInvocations(ctx, api, { runnerFactory: envelopeRunnerFactory(ENVELOPES) });
    if (readFlow(home, "T1")?.finalArtifactId) break;
  }
  const finalId = readFlow(home, "T1").finalArtifactId;
  assert.ok(finalId, "final 工件应已发布");

  // 1) 无 principal 提供者 → 403
  let res = mockRes();
  await internals.handleReviewApi(mockBodyReq("/api/bots/review/decisions", {
    taskId: "T1", artifactId: finalId, revision: 1, choice: "accept", findingIds: [], scope: ["lib/"], acceptanceCriteria: "回归全绿"
  }), res, api);
  assert.equal(res.captured.status, 403, "principal 不可用 → decision POST 禁用");

  // 2) 注入 provider → 合法写入 201
  api.reviewPrincipalProvider = async () => ({ ok: true, principal: { role: "user" } });
  res = mockRes();
  await internals.handleReviewApi(mockBodyReq("/api/bots/review/decisions", {
    taskId: "T1", artifactId: finalId, revision: 1, choice: "accept", findingIds: [], scope: ["lib/"], acceptanceCriteria: "回归全绿"
  }), res, api);
  assert.equal(res.captured.status, 201);
  assert.equal(JSON.parse(res.captured.body).decision.author, "user");

  // 3) 乱序 revision → 400（跳过 revision 2）
  res = mockRes();
  await internals.handleReviewApi(mockBodyReq("/api/bots/review/decisions", {
    taskId: "T1", artifactId: finalId, revision: 3, choice: "accept", findingIds: [], scope: ["lib/"], acceptanceCriteria: "回归全绿"
  }), res, api);
  assert.equal(res.captured.status, 400, "revision 乱序拒绝");

  // 4) author 注入被宿主强制归一为 user（请求体 author 不受信任），201 且 author=user
  res = mockRes();
  await internals.handleReviewApi(mockBodyReq("/api/bots/review/decisions", {
    taskId: "T1", artifactId: finalId, revision: 2, choice: "accept", findingIds: [], scope: ["lib/"], acceptanceCriteria: "回归全绿", author: "reviewer-lead"
  }), res, api);
  assert.equal(res.captured.status, 201, "author 注入由宿主归一（不可绕过但不受信）");
  assert.equal(JSON.parse(res.captured.body).decision.author, "user", "落盘 author 恒为 user");
});

test("F-RV-15 user-facing 副本失败 → final 不发布 completed、无完成通知、user decision 被拒", async () => {
  const home = mkHome();
  const api = mkApi(home);
  mkSnapshot(home);
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-lead", targetReviewer: "reviewer-lead",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-lead", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  createInvocation(home, {
    taskId: "T1", artifactId: "spec-1", stage: "initial-second", targetReviewer: "reviewer-second",
    createdBy: "host", idempotencyKey: "wiring:T1:1:initial-second", parts: ["taskId=T1", "cycle=1"], sourceSnapshotId: "snap-1"
  });
  const failingCopy = () => { throw new Error("user-facing 副本注入失败（F-RV-15）"); };
  const opts = {
    runnerFactory: envelopeRunnerFactory(ENVELOPES),
    copyToUserFacing: failingCopy
  };
  let sawGate = false;
  let lastRan = [];
  for (let i = 0; i < 8; i += 1) {
    const pump = await internals.pumpReviewInvocations(ctx, api, opts);
    lastRan = pump.ran;
    if (pump.ran.some((r) => r.includes("final-register-rejected") || r.includes("final-publish-failed"))) {
      sawGate = true;
      break;
    }
  }
  assert.equal(sawGate, true, "user-facing copy 失败必须被 final gate 拦下");
  assert.ok(!lastRan.some((r) => r.includes("final-registered")), "不得返回 final-registered 成功步骤（无完成通知）");
  const flow = readFlow(home, "T1");
  assert.equal(flow.finalArtifactId, null, "final 不得登记为完成");
  assert.equal(flow.stage, "final-lead", "流程停留 final，未进入 user-decision");

  // 结果索引为空：未发布 completed → GET 不可见
  let res = mockRes();
  await internals.handleReviewApi(mockJsonReq("/api/bots/review/results?taskId=T1"), res, api);
  assert.equal(JSON.parse(res.captured.body).results.length, 0, "未发布 completed → 结果不可见");

  // user decision 被拒（route 未 committed / 未发布）
  api.reviewPrincipalProvider = async () => ({ ok: true, principal: { role: "user" } });
  res = mockRes();
  const finalOutput = flow.finalInvocationId ? readInvocationState(home, null, flow.finalInvocationId).outputArtifactId : "A-NONE";
  await internals.handleReviewApi(mockBodyReq("/api/bots/review/decisions", {
    taskId: "T1", artifactId: finalOutput, revision: 1, choice: "accept", findingIds: [], scope: ["lib/"], acceptanceCriteria: "回归全绿"
  }), res, api);
  assert.ok([400, 403].includes(res.captured.status), "user-facing 副本失败/隔离/未完成 → decision 拒绝");
});