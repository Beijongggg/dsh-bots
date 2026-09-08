import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  reviewDir, reviewInboxFor, invocationManifestFile, invocationPartsFile,
  invocationEventsFile, invocationLeaseFile,
  INVOCATION_EVENT_TYPES, INVOCATION_MANIFEST_KEYS, INVOCATION_CREATORS,
  DEAD_LETTER_MAX_ATTEMPTS, LEASE_DEFAULTS,
  invocationInputHashes, readInvocationManifest, readInvocationParts,
  foldInvocationEvents, readInvocationState, nextInvocationId,
  createInvocation, claimInvocation, heartbeatInvocation, runInvocation,
  requeueInvocation, expireStaleLeases
} from "../lib/review-orchestrator.js";
import { createSourceSnapshot, snapshotFileFor } from "../lib/review-evidence.js";
import { readAudit, readManifest, verifyArtifactIntegrity } from "../lib/review-store.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];

function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-inv-r2-"));
  homes.push(home);
  return home;
}
/** F-RV-13：物化可用的 source snapshot（幂等）。 */
function snapshotFor(home, cycleId) {
  if (!fs.existsSync(snapshotFileFor(home, cycleId))) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-snap-src-"));
    homes.push(root);
    fs.writeFileSync(path.join(root, "main.c"), "int main(){return 0;}\n");
    createSourceSnapshot(home, { cycleId, root });
  }
  return cycleId;
}
function create(home, suffix, extra = {}) {
  return createInvocation(home, {
    taskId: `T-${suffix}`,
    reviewCycle: 1,
    artifactId: `A-${suffix}`,
    stage: "initial-lead",
    targetReviewer: "reviewer-lead",
    createdBy: "host",
    idempotencyKey: `inv-${suffix}`,
    parts: ["ctx", `request ${suffix}`],
    sourceSnapshotId: snapshotFor(home, `S-${suffix}`),
    ...extra
  });
}
function completedEvents(home, invocationId) {
  return readInvocationState(home, "reviewer-lead", invocationId).events.filter((event) => event.type === "completed");
}

test("R2-04 invocation manifest/事件为冻结字段，sourceSnapshotId 可选且输入两级 hash 钉扎", () => {
  const home = mkHome();
  const made = create(home, "schema");
  const manifest = readInvocationManifest(home, "reviewer-lead", made.invocationId);
  assert.deepEqual(Object.keys(manifest).sort(), [...INVOCATION_MANIFEST_KEYS].sort());
  assert.equal(manifest.createdBy, "host-event");
  assert.equal(manifest.reviewCycle, 1);
  assert.deepEqual(manifest.artifactIds, ["A-schema"]);
  assert.equal(manifest.sourceSnapshotId, "S-schema");
  assert.equal(manifest.maxAttempts, 3);
  const hashes = invocationInputHashes(["ctx", "request schema"]);
  assert.equal(manifest.partsHash, hashes.partsHash);
  assert.equal(manifest.bodyHash, hashes.bodyHash);
  assert.deepEqual(readInvocationParts(home, "reviewer-lead", made.invocationId), ["ctx", "request schema"]);
  const state = readInvocationState(home, "reviewer-lead", made.invocationId);
  assert.equal(state.status, "pending");
  assert.deepEqual(state.events.map((event) => event.seq), [1]);
  assert.ok(Number.isInteger(state.events[0].writerEpoch));
  assert.match(state.events[0].eventHash, /^[0-9a-f]{64}$/);
  assert.equal(path.basename(invocationEventsFile(home, null, made.invocationId)), "events");
});

test("R2-04 创建权和逻辑幂等键：非 host-event/user 拒绝，同键不同输入集拒绝", () => {
  const home = mkHome();
  assert.deepEqual(INVOCATION_CREATORS, ["host-event", "user"]);
  assert.throws(() => create(home, "denied", { createdBy: "reviewer-lead" }), /创建权拒绝/);
  const first = create(home, "idem");
  const same = create(home, "idem", { idempotencyKey: "different-request-key" });
  assert.equal(same.idempotent, true);
  assert.equal(same.invocationId, first.invocationId);
  assert.throws(() => create(home, "idem", { artifactId: "A-other", parts: ["different"] }), /幂等冲突/);
  assert.equal(fs.readdirSync(reviewInboxFor(home)).filter((name) => name.startsWith("I-")).length, 1);
});

test("R2-04 claim lease 记录 generation/claimEpoch/owner/process 身份，stale heartbeat 被拒绝并审计", async () => {
  const home = mkHome();
  const made = create(home, "lease");
  const claimed = claimInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId,
    hostInstanceId: "HOST-A", leaseMs: 10
  });
  assert.equal(claimed.claimed, true);
  const lease = JSON.parse(fs.readFileSync(invocationLeaseFile(home, "reviewer-lead", made.invocationId), "utf8"));
  assert.equal(lease.generation, 1);
  assert.ok(Number.isInteger(lease.claimEpoch) && lease.claimEpoch > 0);
  assert.equal(lease.claimOwner, "HOST-A");
  assert.equal(lease.hostInstanceId, "HOST-A");
  assert.equal(lease.pid, process.pid);
  assert.equal(typeof lease.startedAt, "string");
  assert.equal(lease.attempt, 1);
  assert.equal(lease.requeueGeneration, 0);

  await new Promise((resolve) => setTimeout(resolve, 25));
  const expired = expireStaleLeases(home, { hostInstanceId: "HOST-B" });
  assert.equal(expired.length, 1);
  assert.equal(readInvocationState(home, "reviewer-lead", made.invocationId).status, "pending");
  const staleHeartbeat = heartbeatInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId,
    hostInstanceId: "HOST-A", generation: 1
  });
  assert.equal(staleHeartbeat.ok, false);
  assert.ok(readAudit(home).some((entry) => entry.type === "invocation-heartbeat-stale" && entry.invocationId === made.invocationId));
});

test("F-P9-05 正常 completed 唯一绑定 outputArtifactId，正文/manifest 落 artifacts 且完整性可验", async () => {
  const home = mkHome();
  const made = create(home, "complete");
  const text = "唯一 reviewer 输出正文 αβ";
  const result = await runInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId,
    hostInstanceId: "HOST-NORMAL",
    runner: async (input) => {
      assert.equal(input, "ctx\nrequest complete");
      return { text, sessionId: "session-one", pid: 4321 };
    }
  });
  assert.equal(result.status, "completed");
  assert.match(result.outputArtifactId, /^O-[0-9a-f]{32}$/);
  const events = completedEvents(home, made.invocationId);
  assert.equal(events.length, 1);
  assert.equal(events[0].outputArtifactId, result.outputArtifactId);
  assert.equal(events[0].outputHash, result.outputHash);
  assert.equal(events[0].byteLength, Buffer.byteLength(text, "utf8"));
  assert.equal(events[0].runnerPid, 4321);

  const artifactDir = path.join(home, "bots", "review", "artifacts", result.outputArtifactId);
  assert.equal(fs.readFileSync(path.join(artifactDir, "body.md"), "utf8"), text);
  const manifest = readManifest(home, result.outputArtifactId);
  assert.equal(manifest.authorBotId, "host");
  assert.equal(manifest.stage, "initial-lead");
  assert.equal(manifest.taskId, "T-complete");
  assert.equal(manifest.sha256, result.outputHash);
  assert.deepEqual(verifyArtifactIntegrity(home, result.outputArtifactId), { ok: true });
  assert.equal(fs.readdirSync(path.join(home, "bots", "review", "artifacts")).length, 1);
});

test("F-P9-05 双 host 慢 runner：A 过期，B 回收提交 NEW，A 迟返 OLD 被 fencing 且无第二产物", async () => {
  const home = mkHome();
  const made = create(home, "race");
  let releaseA;
  let announceA;
  const aStarted = new Promise((resolve) => { announceA = resolve; });
  const aRun = runInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId,
    hostInstanceId: "HOST-A", leaseMs: 15,
    runner: async () => {
      announceA();
      await new Promise((resolve) => { releaseA = resolve; });
      return { text: "OLD" };
    }
  });
  await aStarted;
  await new Promise((resolve) => setTimeout(resolve, 30));
  const expired = expireStaleLeases(home, { hostInstanceId: "HOST-B" });
  assert.equal(expired.length, 1);

  const bResult = await runInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId,
    hostInstanceId: "HOST-B", leaseMs: 1000,
    runner: async () => ({ text: "NEW", sessionId: "new-session" })
  });
  assert.equal(bResult.status, "completed");
  releaseA();
  const aResult = await aRun;
  assert.equal(aResult.status, "stale");
  assert.match(aResult.reason, /过期|接管/);

  const state = readInvocationState(home, "reviewer-lead", made.invocationId);
  assert.equal(state.status, "completed");
  assert.equal(state.events.filter((event) => event.type === "completed").length, 1);
  assert.equal(state.outputArtifactId, bResult.outputArtifactId);
  const artifactRoot = path.join(home, "bots", "review", "artifacts");
  const outputIds = fs.readdirSync(artifactRoot).filter((name) => name.startsWith("O-"));
  assert.deepEqual(outputIds, [bResult.outputArtifactId]);
  assert.equal(fs.readFileSync(path.join(artifactRoot, bResult.outputArtifactId, "body.md"), "utf8"), "NEW");
  assert.ok(readAudit(home).some((entry) => entry.type === "invocation-stale-output-rejected" && entry.invocationId === made.invocationId));
});

test("R2-04 每 generation 最多三次；仅 authenticated user 可给同 invocation 追加 requeueGeneration", async () => {
  const home = mkHome();
  const made = create(home, "retry");
  for (let attempt = 1; attempt <= DEAD_LETTER_MAX_ATTEMPTS; attempt += 1) {
    const result = await runInvocation(home, {
      botId: "reviewer-lead", invocationId: made.invocationId,
      hostInstanceId: `HOST-${attempt}`,
      runner: async () => { throw new Error("RPC unavailable"); }
    });
    assert.equal(result.attempts, attempt);
    assert.equal(result.status, attempt === DEAD_LETTER_MAX_ATTEMPTS ? "dead-letter" : "retry-wait");
  }
  let state = readInvocationState(home, "reviewer-lead", made.invocationId);
  assert.equal(state.status, "dead-letter");
  assert.equal(state.requeueGeneration, 0);
  assert.equal(state.events.filter((event) => event.type === "attempt-failed").length, 3);
  assert.throws(() => requeueInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId, requestedBy: "host"
  }), /authenticated user/);
  // F-RV-6：即使 requestedBy=user，未显式携带 authenticated 也默认拒绝
  assert.throws(() => requeueInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId, requestedBy: "user"
  }), /默认拒绝|authenticated user/);

  const requeued = requeueInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId,
    requestedBy: "user", authenticated: true
  });
  assert.equal(requeued.ok, true);
  assert.equal(requeued.requeueGeneration, 1);
  state = readInvocationState(home, "reviewer-lead", made.invocationId);
  assert.equal(state.status, "pending");
  assert.equal(state.requeueGeneration, 1);
  assert.equal(state.events.filter((event) => event.type === "attempt-failed").length, 3, "既有失败事件保留");
  assert.equal(fs.readdirSync(reviewInboxFor(home)).filter((name) => name.startsWith("I-")).length, 1, "同一逻辑 invocation 未复制");

  const recovered = await runInvocation(home, {
    botId: "reviewer-lead", invocationId: made.invocationId,
    hostInstanceId: "HOST-RECOVERED", runner: async () => ({ text: "RECOVERED" })
  });
  assert.equal(recovered.status, "completed");
  const completed = completedEvents(home, made.invocationId)[0];
  assert.equal(completed.requeueGeneration, 1);
});

test("R2-04 导出常量与路径形状保持可调用", () => {
  const home = mkHome();
  assert.ok(INVOCATION_EVENT_TYPES.includes("completed"));
  assert.ok(INVOCATION_EVENT_TYPES.includes("dead-letter"));
  assert.equal(DEAD_LETTER_MAX_ATTEMPTS, 3);
  assert.equal(LEASE_DEFAULTS.leaseMs, 60000);
  assert.equal(reviewDir(home), path.join(home, "bots", "review"));
  assert.equal(typeof nextInvocationId(), "string");
  assert.equal(foldInvocationEvents([]).status, "pending");
});

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

// ---------- F-RV-13 admission（可信创建边界） ----------

test("F-RV-13 admission：非法 stage / 非法 targetReviewer / 空或不存在 snapshot 机械拒绝", () => {
  const home = mkHome();
  snapshotFor(home, "S-admit");
  const base = {
    taskId: "T-admit", artifactId: "A-admit", createdBy: "host",
    idempotencyKey: "admit-1", parts: ["ctx"], sourceSnapshotId: "S-admit"
  };
  assert.throws(() => createInvocation(home, { ...base, stage: "not-a-stage", targetReviewer: "reviewer-lead" }), /非法 stage/);
  assert.throws(() => createInvocation(home, { ...base, stage: "initial-lead", targetReviewer: "attacker" }), /非法 targetReviewer/);
  assert.throws(() => createInvocation(home, { ...base, stage: "initial-lead", targetReviewer: "reviewer-second" }), /不匹配|作者必须/);
  assert.throws(() => createInvocation(home, { ...base, stage: "initial-lead", targetReviewer: "reviewer-lead", sourceSnapshotId: null }), /sourceSnapshotId 必填/);
  assert.throws(() => createInvocation(home, { ...base, stage: "initial-lead", targetReviewer: "reviewer-lead", sourceSnapshotId: "S-PHANTOM" }), /不存在或损坏/);
  // 无 flow 时只允许盲审双席（非法 transition 机械拒绝）
  assert.throws(() => createInvocation(home, { ...base, stage: "delta-lead", targetReviewer: "reviewer-lead" }), /非法 transition/);
  assert.throws(() => createInvocation(home, { ...base, stage: "final-lead", targetReviewer: "reviewer-lead" }), /非法 transition/);
  assert.throws(() => createInvocation(home, { ...base, stage: "user-decision", targetReviewer: "reviewer-lead" }), /非法 transition|不匹配/);
});

test("F-RV-7 dead-letter 转移矩阵：仅经 retry-wait；claimed→dead-letter 直跳为非法分支", () => {
  const home = mkHome();
  const made = create(home, "dlm");
  const invocationId = made.invocationId;
  const eventsDir = invocationEventsFile(home, null, invocationId);
  fs.mkdirSync(eventsDir, { recursive: true });
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
    }
    return value;
  };
  const mkEvent = (seq, eventId, type, extra = {}) => {
    const event = { seq, eventId, type, at: "2026-01-01T00:00:00.000Z", writerEpoch: 1, ...extra };
    const copy = { ...event };
    delete copy.eventHash;
    event.eventHash = createHash("sha256").update(JSON.stringify(sortKeys(copy))).digest("hex");
    return event;
  };
  const writeEvents = (events) => {
    for (const entry of fs.readdirSync(eventsDir)) fs.rmSync(path.join(eventsDir, entry), { force: true });
    for (const event of events) {
      fs.writeFileSync(path.join(eventsDir, `${event.seq}-${event.eventId}.json`), `${JSON.stringify(event)}\n`);
    }
  };

  // 合法链：created → claimed → expired → dead-letter（expired 先落 retry-wait 标）
  writeEvents([
    mkEvent(1, "c0", "created"),
    mkEvent(2, "c1", "claimed"),
    mkEvent(3, "c2", "expired"),
    mkEvent(4, "c3", "dead-letter")
  ]);
  assert.equal(readInvocationState(home, null, invocationId).status, "dead-letter");

  // 非法直跳：created → claimed → dead-letter（无过期/失败先落）→ 折叠判损坏
  writeEvents([
    mkEvent(1, "d0", "created"),
    mkEvent(2, "d1", "claimed"),
    mkEvent(3, "d2", "dead-letter")
  ]);
  const state = readInvocationState(home, null, invocationId);
  assert.equal(state.ok, false);
  assert.match(state.reason, /非法 invocation transition/);
  // 非法直跳后 requeue 也不得放行（状态损坏 fail closed）
  assert.throws(() => requeueInvocation(home, {
    botId: "reviewer-lead", invocationId, requestedBy: "user", authenticated: true
  }), /损坏/);
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
    try {
      makeWritable(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* 测试退出清理 */ }
  }
}
process.exit(failed > 0 ? 1 : 0);
