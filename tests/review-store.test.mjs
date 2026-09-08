import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  reviewDir, spoolDir, artifactsDir, artifactDirFor, bodyFileFor, manifestFileFor,
  eventsFileFor, idemFile, quarantineDir, lockDirFor,
  utf8Bytes, sha256Hex, writeFileDurable,
  acquireStoreLock, currentEpoch, assertEpochCurrent,
  readManifest, foldEvents, readArtifactState,
  quarantineArtifact, readAudit,
  submitReviewArtifact, appendEventLocked, artifactStatus,
  EVENT_TYPES, MANIFEST_KEYS
} from "../lib/review-store.js";

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-r205-store-"));
  homes.push(home);
  return home;
}
function eventFiles(home, artifactId) {
  return fs.readdirSync(eventsFileFor(home, artifactId)).filter((name) => name.endsWith(".json")).sort();
}
function readEvents(home, artifactId) {
  return eventFiles(home, artifactId).map((name) => JSON.parse(fs.readFileSync(path.join(eventsFileFor(home, artifactId), name), "utf8")));
}
function reservationFiles(home) {
  return fs.readdirSync(idemFile(home)).filter((name) => name.endsWith(".json"));
}

const SAMPLE = "你好 review 正文\n第二行 🚀";

test("P0.6 frozen layout: direct review root, one event per file, one reservation per key", () => {
  const home = mkHome();
  const result = submitReviewArtifact(home, {
    taskId: "T-1", stage: "initial-lead", authorBotId: "lead", body: SAMPLE, idempotencyKey: "key-one"
  });
  assert.equal(spoolDir(home), reviewDir(home), "冻结布局没有额外 spool 层");
  assert.equal(artifactsDir(home), path.join(reviewDir(home), "artifacts"));
  assert.ok(fs.existsSync(bodyFileFor(home, result.artifactId)));
  assert.ok(fs.existsSync(manifestFileFor(home, result.artifactId)));
  assert.ok(fs.statSync(eventsFileFor(home, result.artifactId)).isDirectory());
  assert.equal(eventFiles(home, result.artifactId).length, 1);
  assert.match(eventFiles(home, result.artifactId)[0], /^1-E-[A-Za-z0-9.-]+\.json$/);
  assert.equal(reservationFiles(home).length, 1);
  assert.match(reservationFiles(home)[0], /^[0-9a-f]{64}\.json$/);
  assert.ok(!fs.existsSync(path.join(reviewDir(home), "idem.jsonl")));
  assert.ok(!fs.existsSync(path.join(artifactDirFor(home, result.artifactId), "events.jsonl")));
});

test("immutable body/manifest use UTF-8 byteLength and verified sha256", () => {
  const home = mkHome();
  const { artifactId } = submitReviewArtifact(home, {
    taskId: "T-2", stage: "s", authorBotId: "a", body: SAMPLE, idempotencyKey: "key-two"
  });
  const bytes = Buffer.from(SAMPLE, "utf8");
  assert.equal(utf8Bytes(SAMPLE), bytes.length);
  assert.notEqual(utf8Bytes(SAMPLE), SAMPLE.length);
  assert.match(sha256Hex(bytes), /^[0-9a-f]{64}$/);
  const manifest = readManifest(home, artifactId);
  assert.equal(manifest.sha256, sha256Hex(bytes));
  assert.equal(manifest.byteLength, bytes.length);
  assert.equal(manifest.bodyPath, bodyFileFor(home, artifactId));
  assert.equal(fs.readFileSync(bodyFileFor(home, artifactId), "utf8"), SAMPLE);
  assert.equal(readArtifactState(home, artifactId).status, "submitted");
});

test("same key + different sourceSnapshotId rejects instead of reusing an artifact", () => {
  const home = mkHome();
  submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "same",
    sourceSnapshotId: "snap-a", idempotencyKey: "snapshot-key"
  });
  assert.throws(() => submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "same",
    sourceSnapshotId: "snap-b", idempotencyKey: "snapshot-key"
  }), /idempotencyKey 冲突/);
});

test("event schema binds filename, hash, writerEpoch and legal transition", () => {
  const home = mkHome();
  const { artifactId } = submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "x", idempotencyKey: "event-schema"
  });
  const first = readEvents(home, artifactId)[0];
  assert.equal(first.seq, 1);
  assert.equal(first.type, "submitted");
  assert.match(first.eventId, /^E-/);
  assert.match(first.eventHash, /^[0-9a-f]{64}$/);
  assert.ok(Number.isInteger(first.writerEpoch) && first.writerEpoch > 0);
  const lock = acquireStoreLock(home);
  let second;
  try { second = appendEventLocked(lock, home, artifactId, "relayed", { from: "host" }); }
  finally { lock.release(); }
  assert.equal(second.seq, 2);
  assert.equal(second.writerEpoch, currentEpoch(home));
  const state = readArtifactState(home, artifactId);
  assert.equal(state.ok, true);
  assert.equal(state.status, "relayed");
  assert.equal(state.lastSeq, 2);
  assert.equal(foldEvents(readEvents(home, artifactId)).ok, true);
  assert.equal(foldEvents([readEvents(home, artifactId)[1]]).ok, false, "缺 seq=1 fail closed");
});

test("F-P9-06 corrupt JSON tail makes read fail closed, never returns submitted", () => {
  const home = mkHome();
  const { artifactId } = submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "body", idempotencyKey: "broken-tail"
  });
  const broken = path.join(eventsFileFor(home, artifactId), "2-E-broken-tail.json");
  fs.writeFileSync(broken, "{broken-tail");
  const state = readArtifactState(home, artifactId);
  assert.equal(state.ok, false);
  assert.equal(state.corrupt, true);
  assert.match(state.reason, /JSON 损坏/);
  assert.notEqual(state.status, "submitted");
  assert.equal(artifactStatus(home, artifactId), "quarantined");
});

test("F-P9-06 quarantine appends reference and preserves immutable source directory", () => {
  const home = mkHome();
  const { artifactId } = submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "body", idempotencyKey: "quarantine-ref"
  });
  const originalBodyHash = sha256Hex(fs.readFileSync(bodyFileFor(home, artifactId)));
  const record = quarantineArtifact(home, artifactId, "counterexample corrupt tail");
  assert.ok(fs.existsSync(artifactDirFor(home, artifactId)), "源件目录未移动");
  assert.equal(sha256Hex(fs.readFileSync(bodyFileFor(home, artifactId))), originalBodyHash, "源正文未改写");
  assert.equal(record.objectType, "artifact");
  assert.equal(record.objectId, artifactId);
  assert.match(record.evidenceHash, /^[0-9a-f]{64}$/);
  assert.ok(Number.isFinite(Date.parse(record.discoveredAt)));
  assert.equal(record.immutableSourcePreserved, true);
  assert.ok(fs.existsSync(record.quarantinePath), "引用记录存在");
  assert.ok(record.quarantinePath.startsWith(path.join(quarantineDir(home), "artifact", artifactId)));
  const state = readArtifactState(home, artifactId);
  assert.equal(state.ok, false);
  assert.equal(state.quarantined, true);
});

test("event hash mismatch and illegal transition fail closed", () => {
  const home = mkHome();
  const { artifactId } = submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "x", idempotencyKey: "bad-hash"
  });
  const file = path.join(eventsFileFor(home, artifactId), eventFiles(home, artifactId)[0]);
  const event = JSON.parse(fs.readFileSync(file, "utf8"));
  event.taskId = "tampered";
  fs.writeFileSync(file, JSON.stringify(event));
  const state = readArtifactState(home, artifactId);
  assert.equal(state.ok, false);
  assert.match(state.reason, /hash 不符/);

  const home2 = mkHome();
  const b = submitReviewArtifact(home2, { taskId: "T", stage: "s", authorBotId: "a", body: "y", idempotencyKey: "terminal" });
  let lock = acquireStoreLock(home2);
  try { appendEventLocked(lock, home2, b.artifactId, "failed", { reason: "terminal" }); }
  finally { lock.release(); }
  lock = acquireStoreLock(home2);
  try { assert.throws(() => appendEventLocked(lock, home2, b.artifactId, "relayed", { from: "late" }), /非法 transition/); }
  finally { lock.release(); }
  assert.ok(fs.existsSync(artifactDirFor(home2, b.artifactId)));
  assert.equal(readArtifactState(home2, b.artifactId).quarantined, true);
});

test("manifest additionalProperties=false and body hash corruption are read failures", () => {
  const home = mkHome();
  const { artifactId } = submitReviewArtifact(home, {
    taskId: "T", stage: "s", authorBotId: "a", body: "body", idempotencyKey: "manifest-strict"
  });
  const file = manifestFileFor(home, artifactId);
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...manifest, extra: true }));
  assert.throws(() => readManifest(home, artifactId), /未允许键 extra/);
  assert.equal(readArtifactState(home, artifactId).ok, false);
});

test("F-P9-06 lock has hostInstanceId/pid/startedAt/writerEpoch and stale epoch is rejected/audited", () => {
  const home = mkHome();
  const lock = acquireStoreLock(home);
  const ownerFile = path.join(lockDirFor(home), "owner.json");
  const owner = JSON.parse(fs.readFileSync(ownerFile, "utf8"));
  assert.deepEqual(Object.keys(owner).sort(), ["hostInstanceId", "pid", "startedAt", "writerEpoch"].sort());
  assert.equal(owner.hostInstanceId, lock.hostInstanceId);
  assert.equal(owner.pid, process.pid);
  assert.equal(owner.startedAt, lock.startedAt);
  assert.equal(owner.writerEpoch, lock.writerEpoch);
  assert.equal(lock.epoch, lock.writerEpoch);
  lock.release();
  const next = acquireStoreLock(home);
  try {
    assert.equal(next.writerEpoch, owner.writerEpoch + 1);
    const fenced = assertEpochCurrent(home, owner.writerEpoch);
    assert.equal(fenced.ok, false);
    assert.match(fenced.reason, /延迟写入拒绝/);
    const fake = { ...lock, epoch: next.epoch, writerEpoch: next.writerEpoch };
    assert.throws(() => appendEventLocked(fake, home, "no-object", "submitted", { taskId: "T", stage: "s", idempotencyKeyHash: "0".repeat(64) }), /owner 身份/);
    assert.ok(readAudit(home).some((entry) => entry.type === "event-fenced"));
  } finally { next.release(); }
});

test("live owner and unknown owner both refuse takeover", () => {
  const home = mkHome();
  const lock = acquireStoreLock(home);
  assert.throws(() => acquireStoreLock(home, { spinMs: 80, staleMs: 1, tickMs: 5 }), /存活进程/);
  fs.writeFileSync(path.join(lockDirFor(home), "owner.json"), JSON.stringify({ pid: process.pid }));
  assert.throws(() => acquireStoreLock(home, { spinMs: 80, staleMs: 1, tickMs: 5 }), /身份不明/);
  fs.rmSync(lockDirFor(home), { recursive: true, force: true });
});

test("writeFileDurable leaves no tmp and reads exact bytes", () => {
  const home = mkHome();
  const file = path.join(home, "deep", "x.txt");
  writeFileDurable(file, "持久化内容");
  assert.equal(fs.readFileSync(file, "utf8"), "持久化内容");
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((name) => name.endsWith(".tmp")), []);
});

test("frozen exported constants remain compatible", () => {
  assert.deepEqual(EVENT_TYPES, ["submitted", "relayed", "acknowledged", "failed", "superseded"]);
  // F-RV-20：sourceSnapshotId 为可选键（fix-report 侧由 reportFix 强制绑定 job 快照）
  assert.deepEqual(MANIFEST_KEYS, ["artifactId", "taskId", "stage", "authorBotId", "createdAt", "bodyPath", "sha256", "byteLength", "sourceSnapshotId"]);
});

let failed = 0;
try {
  for (const [name, fn] of tests) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.stack ?? error.message); }
  }
} finally {
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
