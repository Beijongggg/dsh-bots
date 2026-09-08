import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  artifactDirFor, bodyFileFor, manifestFileFor, eventsFileFor, idemFile,
  quarantineDir, readAudit, readManifest, readArtifactState,
  submitReviewArtifact, ConflictError, reconcileSpool, artifactStatus,
  sha256Hex
} from "../lib/review-store.js";

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-r205-idem-"));
  homes.push(home);
  return home;
}
function reservationNames(home) {
  return fs.existsSync(idemFile(home)) ? fs.readdirSync(idemFile(home)).filter((name) => name.endsWith(".json")) : [];
}
function reservationForOnlyKey(home) {
  const names = reservationNames(home);
  assert.equal(names.length, 1);
  return { file: path.join(idemFile(home), names[0]), record: JSON.parse(fs.readFileSync(path.join(idemFile(home), names[0]), "utf8")) };
}
function quarantineRecords(home, artifactId) {
  const dir = path.join(quarantineDir(home), "artifact", artifactId);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".json")) : [];
}

const input = (key, body = "正文", extra = {}) => ({
  taskId: "T", stage: "s", authorBotId: "author", body, idempotencyKey: key, ...extra
});

test("F-P9-06 reservation is one hashed-key file with request binding and writerEpoch", () => {
  const home = mkHome();
  const result = submitReviewArtifact(home, input("reservation-key"));
  const { file, record } = reservationForOnlyKey(home);
  assert.match(path.basename(file), /^[0-9a-f]{64}\.json$/);
  assert.equal(path.basename(file, ".json"), record.idempotencyKeyHash);
  assert.match(record.requestHash, /^[0-9a-f]{64}$/);
  assert.equal(record.artifactId, result.artifactId);
  assert.equal(record.taskId, "T");
  assert.equal(record.stage, "s");
  assert.equal(record.authorBotId, "author");
  assert.match(record.hostInstanceId, /\S/);
  assert.ok(Number.isInteger(record.writerEpoch) && record.writerEpoch > 0);
  assert.equal(record.state, "committed");
  assert.ok(Number.isFinite(Date.parse(record.reservedAt)));
  assert.ok(Number.isFinite(Date.parse(record.committedAt)));
});

test("same key + same request returns existing artifactId", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("same-key", "正文X"));
  const second = submitReviewArtifact(home, input("same-key", "正文X"));
  assert.equal(first.artifactId, second.artifactId);
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.resumed, false);
  assert.equal(reservationNames(home).length, 1);
  assert.equal(fs.readdirSync(path.dirname(artifactDirFor(home, first.artifactId))).length, 1);
  assert.equal(readArtifactState(home, first.artifactId).lastSeq, 1);
});

test("same key + different body rejects, audits/quarantines conflict evidence, preserves committed artifact", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("conflict-key", "版本一"));
  const bodyHash = sha256Hex(fs.readFileSync(bodyFileFor(home, first.artifactId)));
  assert.throws(
    () => submitReviewArtifact(home, input("conflict-key", "完全不同")),
    (error) => error instanceof ConflictError && /同 key 不同正文或元数据/.test(error.message)
  );
  assert.equal(artifactStatus(home, first.artifactId), "submitted");
  assert.equal(sha256Hex(fs.readFileSync(bodyFileFor(home, first.artifactId))), bodyHash);
  assert.equal(reservationNames(home).length, 1);
  assert.ok(readAudit(home).some((entry) => entry.type === "submit-conflict"));
  const conflictRoot = path.join(quarantineDir(home), "idempotency-conflict");
  assert.ok(fs.existsSync(conflictRoot));
  assert.equal(quarantineRecords(home, first.artifactId).length, 0, "合法既有工件本身不隔离");
});

test("same key + same body but changed immutable metadata rejects", () => {
  const home = mkHome();
  submitReviewArtifact(home, input("metadata-key", "same"));
  assert.throws(
    () => submitReviewArtifact(home, input("metadata-key", "same", { stage: "different" })),
    (error) => error instanceof ConflictError
  );
  assert.equal(reservationNames(home).length, 1);
});

test("durable reservation + complete body/manifest + missing submitted recovers event", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("recover-event", "恢复正文"));
  fs.rmSync(eventsFileFor(home, first.artifactId), { recursive: true, force: true });
  const { file, record } = reservationForOnlyKey(home);
  fs.writeFileSync(file, JSON.stringify({ ...record, state: "reserved", committedAt: undefined }, (_key, value) => value === undefined ? undefined : value));
  assert.equal(readArtifactState(home, first.artifactId).status, "uncommitted");
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.resumed, [first.artifactId]);
  assert.deepEqual(reconciled.quarantined, []);
  const state = readArtifactState(home, first.artifactId);
  assert.equal(state.ok, true);
  assert.equal(state.status, "submitted");
  const event = state.events[0];
  assert.equal(event.reservationWriterEpoch, record.writerEpoch);
  assert.equal(event.recoveredByWriterEpoch, event.writerEpoch);
  assert.ok(event.writerEpoch > record.writerEpoch, "恢复动作由当前 fenced epoch 写入");
  assert.equal(reservationForOnlyKey(home).record.state, "committed");
});

test("submitted exists but reservation missing rebuilds one-key index", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("rebuild-index", "正文"));
  fs.rmSync(idemFile(home), { recursive: true, force: true });
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.quarantined, []);
  assert.deepEqual(reconciled.consistent, [first.artifactId]);
  const { record } = reservationForOnlyKey(home);
  assert.equal(record.artifactId, first.artifactId);
  assert.equal(record.state, "committed");
  assert.ok(record.rebuiltAt);
  const retried = submitReviewArtifact(home, input("rebuild-index", "正文"));
  assert.equal(retried.artifactId, first.artifactId);
  assert.equal(retried.idempotent, true);
});

test("incomplete manifest is logically quarantined without moving source", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("missing-manifest", "正文"));
  fs.rmSync(manifestFileFor(home, first.artifactId), { force: true });
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.quarantined, [first.artifactId]);
  assert.ok(fs.existsSync(artifactDirFor(home, first.artifactId)), "源目录保留");
  assert.ok(fs.existsSync(bodyFileFor(home, first.artifactId)), "现存正文保留");
  assert.ok(quarantineRecords(home, first.artifactId).length > 0);
  assert.equal(readArtifactState(home, first.artifactId).quarantined, true);
});

test("body hash mismatch is quarantined and source bytes are not repaired", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("bad-body", "原正文"));
  fs.writeFileSync(bodyFileFor(home, first.artifactId), "被篡改");
  const corruptHash = sha256Hex(fs.readFileSync(bodyFileFor(home, first.artifactId)));
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.quarantined, [first.artifactId]);
  assert.equal(sha256Hex(fs.readFileSync(bodyFileFor(home, first.artifactId))), corruptHash, "对账不覆盖损坏源件");
  assert.ok(fs.existsSync(artifactDirFor(home, first.artifactId)));
  assert.ok(quarantineRecords(home, first.artifactId).length > 0);
});

test("corrupt event JSON tail makes reconcile quarantine whole artifact", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("bad-event", "正文"));
  fs.writeFileSync(path.join(eventsFileFor(home, first.artifactId), "2-E-broken.json"), "{broken-tail");
  assert.equal(readArtifactState(home, first.artifactId).ok, false);
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.quarantined, [first.artifactId]);
  assert.ok(fs.existsSync(artifactDirFor(home, first.artifactId)));
  assert.ok(quarantineRecords(home, first.artifactId).length > 0);
});

test("unresolved event tmp is reconciled or quarantined before successor seq", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("bad-tmp", "正文"));
  fs.writeFileSync(path.join(eventsFileFor(home, first.artifactId), "2-E-tail.json.1.2.deadbeef.tmp"), "{bad");
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.quarantined, [first.artifactId]);
  assert.equal(readArtifactState(home, first.artifactId).quarantined, true);
});

test("reservation without complete artifact is quarantined and retry never reconstructs source", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("reservation-only", "正文"));
  fs.rmSync(artifactDirFor(home, first.artifactId), { recursive: true, force: true });
  const reconciled = reconcileSpool(home);
  assert.deepEqual(reconciled.quarantined, [first.artifactId]);
  const retried = submitReviewArtifact(home, input("reservation-only", "正文"));
  assert.equal(retried.artifactId, first.artifactId);
  assert.equal(retried.status, "quarantined");
  assert.ok(!fs.existsSync(artifactDirFor(home, first.artifactId)), "retry 不重建不完整源件");
});

test("existing artifactId without matching reservation is rejected", () => {
  const home = mkHome();
  const first = submitReviewArtifact(home, input("explicit-first", "正文"));
  assert.throws(
    () => submitReviewArtifact(home, input("explicit-second", "正文", { artifactId: first.artifactId })),
    (error) => error instanceof ConflictError && /无匹配幂等预留/.test(error.message)
  );
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
