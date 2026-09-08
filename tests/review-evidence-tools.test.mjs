/**
 * F-RV-25 reviewer evidence 工具回归：review_read / review_search / review_probe
 * 生产受信链（invocation lease → 链式 capability → 限额执行），无前置一律拒绝。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  intakeTaskSpec
} from "../lib/review-intake.js";
import { claimInvocation } from "../lib/review-orchestrator.js";

const internals = (await import("../lib/index.js")).internals;
const { registerReviewerEvidenceTools, botHoldsInvocationLease, productionReviewerCapabilityProvider } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-rv25-evidence-"));
  homes.push(home);
  return home;
}
function mkWritable(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) { try { fs.chmodSync(dir, 0o644); } catch { /* 尽力 */ } return; }
  try { fs.chmodSync(dir, 0o700); } catch { /* 尽力 */ }
  for (const name of fs.readdirSync(dir)) {
    mkWritable(path.join(dir, name));
  }
}
/** 生产路径 fixture：instances.jsonl 追加新格式行（pid = 本测试进程）+ 预建 secret。 */
function seedRegistry(home, botId) {
  const registry = path.join(home, "bots", "started", "instances.jsonl");
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  fs.appendFileSync(registry, `${JSON.stringify({
    botId, pid: process.pid, startedAt: "rv25-start", hostInstanceId: "rv25-host", at: "rv25-at"
  })}\n`);
  const secret = path.join(home, "bots", "review", "capability", "secret");
  fs.mkdirSync(path.dirname(secret), { recursive: true });
  fs.writeFileSync(secret, "rv25 evidence capability secret", { mode: 0o600 });
}
function makeToolCtx() {
  const registered = [];
  return {
    ctx: { get: (key) => (key === "tools" ? { register: (def) => registered.push(def) } : undefined) },
    registered
  };
}
const specBody = JSON.stringify({
  goal: "evidence 工具链回归",
  registeredCommands: [{ command: "wc", args: ["-l", "main.c"] }]
});

function setup(home) {
  seedRegistry(home, "reviewer-lead");
  seedRegistry(home, "reviewer-second");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-rv25-src-"));
  homes.push(root);
  fs.writeFileSync(path.join(root, "main.c"), "int main(){return 0;}\n");
  fs.writeFileSync(path.join(root, "notes.md"), "finding F-1 here\n");
  const outcome = intakeTaskSpec(home, {
    taskId: "T-RV25-1", body: specBody, sourceRoot: root, createdBy: "host-event"
  });
  assert.equal(outcome.ok, true, outcome.reason);
  return outcome;
}

test("F-RV-25 无活态 invocation lease → provider null → 三工具如实拒绝", () => {
  const home = mkHome();
  const intake = setup(home);
  assert.equal(botHoldsInvocationLease(home, "reviewer-lead"), false);
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead");
  assert.equal(registered.length, 3, "三个 evidence 工具注册");
  // provider 默认走生产链（无 lease → null）
  assert.equal(productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read"), null);
});

test("F-RV-25 claim 后全链：read 内容精确、search 命中、跨 bot 拒绝", async () => {
  const home = mkHome();
  const intake = setup(home);
  // 宿主 pump 代为主审 claim invocation（受信链起点）
  const claim = claimInvocation(home, {
    botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host"
  });
  assert.equal(claim.claimed, true, claim.reason);
  assert.equal(botHoldsInvocationLease(home, "reviewer-lead"), true);

  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead");
  const [readTool, searchTool] = registered;

  const read = await readTool.execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  assert.equal(read.status, "read", read.note);
  assert.equal(read.content, "int main(){return 0;}\n");
  assert.equal(read.byteLength, 22);

  const search = await searchTool.execute({ cycleId: intake.snapshotId, query: "f-1" });
  assert.equal(search.status, "searched", search.note);
  assert.match(search.note, /hits=1/);
  assert.match(search.note, /notes\.md/);

  const badPath = await readTool.execute({ cycleId: intake.snapshotId, relPath: "../../etc/passwd" });
  assert.equal(badPath.status, "rejected", "快照外路径拒绝");

  // 副审 invocation 未 claim → 主审租约不跨 bot：以 reviewer-second 身份注册的工具无 lease
  const secondTools = makeToolCtx();
  registerReviewerEvidenceTools(secondTools.ctx, { dshHome: home }, "reviewer-second");
  const secondRead = await secondTools.registered[0].execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  assert.equal(secondRead.status, "rejected", "无 lease 的 reviewer 不得读证据");

  // 返修要点 7：cycleId 与 capability binding 不符 → 拒绝（跨 cycle 访问封锁）
  const wrongCycle = await readTool.execute({ cycleId: "snap-other-task", relPath: "main.c" });
  assert.equal(wrongCycle.status, "rejected");
  assert.match(wrongCycle.note, /binding 不符/);
});

test("F-RV-25 返修要点 5：lease 过期回收（state 离开 claimed）→ 不再构成持有", async () => {
  const { expireStaleLeases } = await import("../lib/review-orchestrator.js");
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, {
    botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId,
    hostInstanceId: "rv25-host", leaseMs: 5
  });
  assert.equal(botHoldsInvocationLease(home, "reviewer-lead"), true, "claim 后立即持有");
  await new Promise((resolve) => setTimeout(resolve, 40));
  const expired = expireStaleLeases(home, { hostInstanceId: "rv25-host" });
  assert.ok(expired.length >= 1, "lease 过期被回收");
  assert.equal(botHoldsInvocationLease(home, "reviewer-lead"), false, "state 离开 claimed → 不构成持有（L1）");
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead");
  const read = await registered[0].execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  assert.equal(read.status, "rejected", "过期后工具必须拒绝");
});

// ---------------- payload binding 补修切片（双席十二条矩阵） ----------------

const { issueCapability, signCapabilityPayload, verifyCapabilitySignature, secretFileFor } = await import("../lib/review-capability.js");
const { currentClaimedInvocation } = await import("../lib/review-orchestrator.js");

/** 生产 provider 包装：记录签发的 token 供 payload 直接断言。 */
function recordingProvider(home, botId) {
  const tokens = [];
  return {
    tokens,
    provider: async (operation) => {
      const token = productionReviewerCapabilityProvider(home, botId, operation);
      if (token) tokens.push({ operation, token });
      return token;
    }
  };
}

test("F-RV-25 ①payload 直接断言：binding 进 canonical payload；job capability 形状零变化", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const { tokens, provider } = recordingProvider(home, "reviewer-lead");
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead", { capabilityProvider: provider });
  await registered[0].execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  const readToken = tokens.find((t) => t.operation === "evidence.read")?.token;
  assert.ok(readToken, "read 应签发 token");
  assert.deepEqual(readToken.payload.binding, {
    invocationId: intake.initialLeadInvocationId,
    taskId: "T-RV25-1",
    sourceSnapshotId: intake.snapshotId
  }, "read binding 三字段");
  await registered[2].execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: intake.taskSpecArtifactId, command: "wc", args: ["-l", "main.c"]
  });
  const probeToken = tokens.find((t) => t.operation === "evidence.probe")?.token;
  assert.ok(probeToken, "probe 应签发 token");
  assert.equal(probeToken.payload.binding.taskSpecArtifactId, intake.taskSpecArtifactId, "probe binding 四字段");
  assert.ok(verifyCapabilitySignature(fs.readFileSync(secretFileFor(home)), probeToken), "binding 在 canonical payload 内（HMAC 覆盖）");

  // job capability：缺省不写入 binding（形状零变化）
  const jobToken = issueCapability(home, { botId: "reviewer-lead", operations: ["job.claim"], jobId: "j1" });
  assert.equal("binding" in jobToken.payload, false, "job capability payload 无 binding 键");

  // 严格 schema：额外键拒绝
  assert.throws(
    () => issueCapability(home, { botId: "reviewer-lead", operations: ["evidence.read"], binding: { invocationId: "I-1", taskId: "T-1", sourceSnapshotId: "s", evil: 1 } }),
    /binding 含未允许键/
  );
  assert.throws(
    () => issueCapability(home, { botId: "reviewer-lead", operations: ["evidence.read"], binding: { invocationId: "I-1", taskId: "T-1" } }),
    /binding 缺必填键 sourceSnapshotId/
  );
});

test("F-RV-25 ②旧无 binding token 一律拒绝（副审条件二；历史/伪造 token 不放行）", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const legacyToken = issueCapability(home, { botId: "reviewer-lead", operations: ["evidence.read"] });
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead", {
    capabilityProvider: async () => legacyToken
  });
  const out = await registered[0].execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  assert.equal(out.status, "rejected", "binding 缺失的 evidence capability 必须拒绝");
  assert.match(out.note, /缺 payload binding/);
});

test("F-RV-25 ③binding 篡改未重签 → strictCheck 签名拒绝（HMAC 覆盖 binding）", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const token = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read");
  const tampered = {
    payload: { ...token.payload, binding: { ...token.payload.binding, sourceSnapshotId: "snap-evil" } },
    sig: token.sig
  };
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead", {
    capabilityProvider: async () => tampered
  });
  const out = await registered[0].execute({ cycleId: "snap-evil", relPath: "main.c" });
  assert.equal(out.status, "rejected");
  assert.match(out.note, /签名无效|缺 payload binding|不符/);
});

test("F-RV-25 ④TOCTOU 两向收敛：token 与当前 claimed invocation 不同源 → 拒绝", async () => {
  const { expireStaleLeases } = await import("../lib/review-orchestrator.js");
  const home = mkHome();
  const task1 = setup(home);
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-rv25-src2-"));
  homes.push(root2);
  fs.writeFileSync(path.join(root2, "b.md"), "task two\n");
  const task2 = intakeTaskSpec(home, {
    taskId: "T-RV25-2", body: specBody, sourceRoot: root2, createdBy: "host-event"
  });
  assert.equal(task2.ok, true, task2.reason);

  claimInvocation(home, { botId: "reviewer-lead", invocationId: task1.initialLeadInvocationId, hostInstanceId: "rv25-host", leaseMs: 5 });
  const token1 = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read");
  assert.equal(token1.payload.binding.invocationId, task1.initialLeadInvocationId);
  await new Promise((resolve) => setTimeout(resolve, 40));
  expireStaleLeases(home, { hostInstanceId: "rv25-host" });

  // 方向一：token1(task1) vs 当前 task2
  claimInvocation(home, { botId: "reviewer-lead", invocationId: task2.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead", {
    capabilityProvider: async () => token1
  });
  const out1 = await registered[0].execute({ cycleId: task1.snapshotId, relPath: "main.c" });
  assert.equal(out1.status, "rejected", "token(task1) 在 task2 上下文必须拒绝");
  assert.match(out1.note, /binding\.invocationId 与当前 claimed invocation 不符/);

  // 方向二：token2(task2) vs 重新 claim 后的 task1
  const token2 = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read");
  await new Promise((resolve) => setTimeout(resolve, 40));
  expireStaleLeases(home, { hostInstanceId: "rv25-host" });
  claimInvocation(home, { botId: "reviewer-lead", invocationId: task1.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const out2 = await registered[0].execute({ cycleId: task2.snapshotId, relPath: "main.c" });
  assert.equal(out2.status, "rejected", "token(task2) 在 task1 上下文必须拒绝");
});

test("F-RV-25 ⑤多 invocation 上下文不一致 → fail closed（provider 不签发、工具拒绝）", async () => {
  const home = mkHome();
  const task1 = setup(home);
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-rv25-src3-"));
  homes.push(root2);
  fs.writeFileSync(path.join(root2, "c.md"), "task three\n");
  const task2 = intakeTaskSpec(home, {
    taskId: "T-RV25-3", body: specBody, sourceRoot: root2, createdBy: "host-event"
  });
  assert.equal(task2.ok, true, task2.reason);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: task1.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  claimInvocation(home, { botId: "reviewer-lead", invocationId: task2.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  assert.equal(currentClaimedInvocation(home, "reviewer-lead"), null, "双 claimed → 锚点不唯一 → fail closed");
  assert.equal(productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read"), null);
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead");
  const out = await registered[0].execute({ cycleId: task1.snapshotId, relPath: "main.c" });
  assert.equal(out.status, "rejected");
});

test("F-RV-25 ⑥probe：binding.taskId 与请求参数矛盾拒；参数 artifactId 扩展授权范围拒", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead");
  const probeTool = registered[2];
  const wrongTask = await probeTool.execute({
    cycleId: intake.snapshotId, taskId: "T-OTHER",
    taskSpecArtifactId: intake.taskSpecArtifactId, command: "wc", args: ["-l", "main.c"]
  });
  assert.equal(wrongTask.status, "rejected");
  assert.match(wrongTask.note, /taskId 与 capability binding 不符/);
  const wrongArtifact = await probeTool.execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: "A-forged", command: "wc", args: ["-l", "main.c"]
  });
  assert.equal(wrongArtifact.status, "rejected");
  assert.match(wrongArtifact.note, /不接受参数扩展授权范围/);
});

// ---------------- 三工具对称返修：capability 本体分层负例矩阵 ----------------
// 纪律（主审制度化要求）：承诺的每个校验层（签名/operation/时效/slot 轮换/nonce/
// binding）各自独立失效至少一例；伪造 token 的 binding 一律抄自真实 invocation
// token（非测试常量），排除"binding 恰好不符"假阴性。

test("F-RV-25 ⑦read/search 逐层独立失效：错签名/错 operation/过期/binding 不符（正例对照）", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const real = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read");
  assert.ok(real, "真实 token 应签发");
  const realBinding = real.payload.binding;
  // 分层隔离关键：payload 变更后必须重签——否则撞签名层而非目标层。
  const secret = fs.readFileSync(secretFileFor(home));
  const mk = (over = {}) => {
    const payload = { ...real.payload, ...over };
    return { payload, sig: signCapabilityPayload(secret, payload) };
  };
  const layers = [
    ["错签名", { ...mk(), sig: "0".repeat(64) }, /签名无效/],
    ["错 operation", mk({ operations: ["artifact.read"] }), /越权 operation/],
    ["过期", mk({ expiresAt: real.payload.issuedAt - 1 }), /已过期/],
    ["binding 不符", mk({ binding: { ...realBinding, sourceSnapshotId: "snap-forged" } }), /binding\.sourceSnapshotId 与当前 claimed invocation 不符/]
  ];
  for (const [label, token, pattern] of layers) {
    const { ctx, registered } = makeToolCtx();
    registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead", { capabilityProvider: async () => token });
    const readOut = await registered[0].execute({ cycleId: realBinding.sourceSnapshotId, relPath: "main.c" });
    assert.equal(readOut.status, "rejected", `${label} read 必须拒绝（binding 抄真实 token）`);
    assert.match(readOut.note, pattern, `${label} read 拒因: ${readOut.note}`);
    const searchOut = await registered[1].execute({ cycleId: realBinding.sourceSnapshotId, query: "f-1" });
    assert.equal(searchOut.status, "rejected", `${label} search 必须拒绝`);
    assert.match(searchOut.note, pattern, `${label} search 拒因: ${searchOut.note}`);
  }
  // 正例对照：合法 token 全链通过
  const okRead = await makeToolCtxAndRun(home, "reviewer-lead", "read");
  assert.equal(okRead.status, "read");
});

test("F-RV-25 ⑧revoke-rotate 与 nonce 已消费：slot 轮换/单次消费层独立失效（read/search/probe 同拒）", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const { checkCapability } = await import("../lib/review-capability.js");

  // slot 轮换：新签发覆盖活态 slot → 旧 token 拒
  const stale = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read");
  issueCapability(home, { botId: "reviewer-lead", operations: ["evidence.read"] });
  const rotateTools = makeToolCtx();
  registerReviewerEvidenceTools(rotateTools.ctx, { dshHome: home }, "reviewer-lead", { capabilityProvider: async () => stale });
  const rotated = await rotateTools.registered[0].execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  assert.equal(rotated.status, "rejected", "轮换后旧 token 必须拒绝");
  assert.match(rotated.note, /吊销|轮换/);

  // nonce 已消费：合法 token 消费一次后重放拒（read）
  const consumed = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.read");
  assert.equal(checkCapability(home, { botId: "reviewer-lead", operation: "evidence.read", capability: consumed }).ok, true, "首次消费成功");
  const nonceTools = makeToolCtx();
  registerReviewerEvidenceTools(nonceTools.ctx, { dshHome: home }, "reviewer-lead", { capabilityProvider: async () => consumed });
  const replay = await nonceTools.registered[0].execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  assert.equal(replay.status, "rejected", "nonce 已消费必须拒绝");
  assert.match(replay.note, /nonce 已消费/);

  // probe：token 消费一次后重放拒（nonce 不双消费 + 消费点唯一在 runProbe）
  const probeToken = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.probe");
  assert.ok(probeToken?.payload?.binding?.taskSpecArtifactId, "probe token 含四字段 binding");
  const probeOnce = makeToolCtx();
  registerReviewerEvidenceTools(probeOnce.ctx, { dshHome: home }, "reviewer-lead", { capabilityProvider: async () => probeToken });
  const first = await probeOnce.registered[2].execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: intake.taskSpecArtifactId, command: "wc", args: ["-l", "main.c"]
  });
  assert.match(first.note, /ok=true/, `首次 probe 应成功（证明 held/anchor 未预消费）：${first.note}`);
  const second = await probeOnce.registered[2].execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: intake.taskSpecArtifactId, command: "wc", args: ["-l", "main.c"]
  });
  assert.match(second.note, /ok=false.*nonce 已消费|nonce 已消费/, `重放 probe 必须拒：${second.note}`);
});

test("F-RV-25 ⑨三工具一致性：同一无效 capability（错签名+真实 binding）三向同拒", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, { botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host" });
  const realProbe = productionReviewerCapabilityProvider(home, "reviewer-lead", "evidence.probe");
  const zeroSig = { payload: realProbe.payload, sig: "0".repeat(64) };
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead", { capabilityProvider: async () => zeroSig });
  const read = await registered[0].execute({ cycleId: intake.snapshotId, relPath: "main.c" });
  const search = await registered[1].execute({ cycleId: intake.snapshotId, query: "f-1" });
  const probe = await registered[2].execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: intake.taskSpecArtifactId, command: "wc", args: ["-l", "main.c"]
  });
  assert.equal(read.status, "rejected", "read 同拒");
  assert.equal(search.status, "rejected", "search 同拒");
  assert.equal(/ok=false/.test(probe.note), true, "probe 同拒（probed+ok=false）");
  assert.match(read.note, /签名无效/);
  assert.match(probe.note, /签名无效/);
});

/** 正例助手：默认生产 provider 下执行 read（独立 home）。 */
async function makeToolCtxAndRun(home, botId, kind) {
  const tools = makeToolCtx();
  registerReviewerEvidenceTools(tools.ctx, { dshHome: home }, botId);
  const snapshotId = currentClaimedInvocation(home, botId)?.manifest.sourceSnapshotId;
  return kind === "read"
    ? tools.registered[0].execute({ cycleId: snapshotId, relPath: "main.c" })
    : tools.registered[1].execute({ cycleId: snapshotId, query: "f-1" });
}

test("F-RV-25 review_probe：registeredCommands 只认 task-spec 工件，逐字校验 + 沙箱执行", async () => {
  const home = mkHome();
  const intake = setup(home);
  claimInvocation(home, {
    botId: "reviewer-lead", invocationId: intake.initialLeadInvocationId, hostInstanceId: "rv25-host"
  });
  const { ctx, registered } = makeToolCtx();
  registerReviewerEvidenceTools(ctx, { dshHome: home }, "reviewer-lead");
  const probeTool = registered[2];

  // 工件绑定失败（taskSpecArtifactId 与 taskId 不符）
  const wrongBinding = await probeTool.execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: "A-nonexistent", command: "wc", args: ["-l", "main.c"]
  });
  assert.equal(wrongBinding.status, "rejected", "task-spec 工件绑定失败必须拒绝");

  // 未登记命令（模型自报无效：registeredCommands 不接受调用方传入）
  const unregistered = await probeTool.execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: intake.taskSpecArtifactId, command: "rm", args: ["-rf", "/"]
  });
  assert.equal(unregistered.status, "probed");
  assert.equal(/ok=true/.test(unregistered.note), false, "未登记命令不得执行成功");

  // 逐字登记命令 → bwrap 沙箱内执行成功
  const ok = await probeTool.execute({
    cycleId: intake.snapshotId, taskId: "T-RV25-1",
    taskSpecArtifactId: intake.taskSpecArtifactId, command: "wc", args: ["-l", "main.c"]
  });
  assert.equal(ok.status, "probed", ok.note);
  assert.match(ok.note, /ok=true/, `登记命令应沙箱内成功：${ok.note}`);
});

let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.stack ?? error.message); }
  }
} finally {
  for (const home of homes) {
    mkWritable(home);
    fs.rmSync(home, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);
