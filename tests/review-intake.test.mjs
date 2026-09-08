/**
 * F-RV-24 生产 task intake 回归：task-spec 工件 → source snapshot 物化 → 盲审双席
 * initial invocation。fail-closed 逐项 + 幂等语义 + admission 交互。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { intakeTaskSpec } from "../lib/review-intake.js";
import { readSnapshot, snapshotFileFor } from "../lib/review-evidence.js";
import { readInvocationManifest } from "../lib/review-orchestrator.js";
import { readManifest, submitReviewArtifact } from "../lib/review-store.js";
import { readFlow, registerInitial } from "../lib/review-flow.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-rv24-intake-"));
  homes.push(home);
  return home;
}
function mkSourceRoot(files = { "main.c": "int main(){return 0;}\n", "README.md": "# demo\n" }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-rv24-src-"));
  homes.push(root);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}
const specBody = JSON.stringify({
  goal: "验证 intake 链",
  registeredCommands: [{ command: "wc", args: ["-l", "main.c"] }]
});

test("F-RV-24 正常链：task-spec 工件 + 快照物化 + 盲审双席 invocation 全部落盘", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  const outcome = intakeTaskSpec(home, { taskId: "T-RV24-1", body: specBody, sourceRoot: root });
  assert.equal(outcome.ok, true, outcome.reason);

  const specManifest = readManifest(home, outcome.taskSpecArtifactId);
  assert.equal(specManifest.stage, "task-spec");
  assert.equal(specManifest.authorBotId, "user");
  assert.equal(specManifest.taskId, "T-RV24-1");

  const snapshot = readSnapshot(home, outcome.snapshotId);
  assert.ok(snapshot, "快照 manifest 校验通过");
  assert.equal(snapshot.fileCount, 2);
  assert.equal(snapshot.cycleId, "snap-T-RV24-1", "cycleId 确定性派生自 taskId");
  assert.ok(fs.existsSync(snapshotFileFor(home, outcome.snapshotId)));

  for (const [invocationId, stage, reviewer] of [
    [outcome.initialLeadInvocationId, "initial-lead", "reviewer-lead"],
    [outcome.initialSecondInvocationId, "initial-second", "reviewer-second"]
  ]) {
    const manifest = readInvocationManifest(home, reviewer, invocationId);
    assert.equal(manifest.stage, stage);
    assert.equal(manifest.targetReviewer, reviewer);
    assert.equal(manifest.sourceSnapshotId, outcome.snapshotId);
    assert.equal(manifest.createdBy, "host-event");
    assert.deepEqual(manifest.artifactIds, [outcome.taskSpecArtifactId]);
    const parts = fs.readFileSync(
      path.join(home, "bots", "review", "invocations", invocationId, "parts.json"), "utf8");
    assert.match(parts, new RegExp(`taskSpecArtifactId=${outcome.taskSpecArtifactId}`));
    assert.match(parts, new RegExp(`snapshotId=${outcome.snapshotId}`));
  }
  assert.equal(readFlow(home, "T-RV24-1"), null, "intake 本身不建 flow（admission 仍视 flow=null）");
});

test("F-RV-24 同 taskId+body+root 重放全链幂等（同工件/同 invocation ID）", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  const first = intakeTaskSpec(home, { taskId: "T-RV24-2", body: specBody, sourceRoot: root });
  const second = intakeTaskSpec(home, { taskId: "T-RV24-2", body: specBody, sourceRoot: root });
  assert.equal(second.ok, true, second.reason);
  assert.equal(second.taskSpecArtifactId, first.taskSpecArtifactId);
  assert.equal(second.initialLeadInvocationId, first.initialLeadInvocationId);
  assert.equal(second.initialSecondInvocationId, first.initialSecondInvocationId);
  assert.equal(second.snapshotId, first.snapshotId);
});

test("F-RV-24 同 taskId 换正文 → 幂等冲突拒绝", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  assert.equal(intakeTaskSpec(home, { taskId: "T-RV24-3", body: specBody, sourceRoot: root }).ok, true);
  const conflict = intakeTaskSpec(home, { taskId: "T-RV24-3", body: `${specBody}changed`, sourceRoot: root });
  assert.equal(conflict.ok, false);
  assert.match(conflict.reason, /task-spec 工件提交失败/);
});

test("F-RV-24 flow 已存在 → 拒绝重复 intake（不隐式续期）", () => {
  const home = mkHome();
  const root = mkSourceRoot();
  const outcome = intakeTaskSpec(home, { taskId: "T-RV24-4", body: specBody, sourceRoot: root });
  assert.equal(outcome.ok, true, outcome.reason);
  // 用独立 initial-lead 工件登记，令 flow 落盘（task-spec 工件不能充当 initial 工件）
  const initial = submitReviewArtifact(home, {
    taskId: "T-RV24-4", stage: "initial-lead", authorBotId: "reviewer-lead",
    body: "lead blind", idempotencyKey: "rv24-4-lead"
  });
  registerInitial(home, {
    taskId: "T-RV24-4", stage: "initial-lead", artifactId: initial.artifactId,
    status: "completed", envelope: { schemaVersion: 1, body: "lead blind" },
    sourceSnapshotId: outcome.snapshotId
  });
  assert.ok(readFlow(home, "T-RV24-4"));
  const repeat = intakeTaskSpec(home, { taskId: "T-RV24-4", body: specBody, sourceRoot: root });
  assert.equal(repeat.ok, false);
  assert.match(repeat.reason, /已存在评审流程/);
});

test("F-RV-24 fail closed：sourceRoot 不存在 / 空 body / 非法 taskId / 非法 createdBy", () => {
  const home = mkHome();
  const missing = intakeTaskSpec(home, { taskId: "T-RV24-5", body: specBody, sourceRoot: path.join(home, "no-such-dir") });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /sourceRoot 不可用/);

  const empty = intakeTaskSpec(home, { taskId: "T-RV24-6", body: "   ", sourceRoot: mkSourceRoot() });
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /body 必须为非空字符串/);

  const badId = intakeTaskSpec(home, { taskId: "../evil", body: specBody, sourceRoot: mkSourceRoot() });
  assert.equal(badId.ok, false);
  assert.match(badId.reason, /taskId 必须为安全标识符/);

  const badCreator = intakeTaskSpec(home, {
    taskId: "T-RV24-7", body: specBody, sourceRoot: mkSourceRoot(), createdBy: "attacker"
  });
  assert.equal(badCreator.ok, false);
  assert.match(badCreator.reason, /invocation 创建失败/);
  assert.equal(badCreator.taskId, "T-RV24-7", "失败结果回带 taskId 供确定性重试");
});

test("F-RV-24 返修要点 3：同 taskId 换 sourceRoot → 幂等冲突拒绝（canonical realpath 比对）", () => {
  const home = mkHome();
  const rootA = mkSourceRoot({ "main.c": "A\n" });
  const rootB = mkSourceRoot({ "main.c": "B\n" });
  assert.equal(intakeTaskSpec(home, { taskId: "T-RV24-8", body: specBody, sourceRoot: rootA }).ok, true);
  const switched = intakeTaskSpec(home, { taskId: "T-RV24-8", body: specBody, sourceRoot: rootB });
  assert.equal(switched.ok, false);
  assert.match(switched.reason, /幂等冲突.*不同 sourceRoot/);
  // 快照 manifest 记录 canonical realpath
  const snapshot = readSnapshot(home, "snap-T-RV24-8");
  assert.equal(snapshot.root, fs.realpathSync(rootA));
});

test("F-RV-24 返修穿透实测：HTTP 层合法请求 → 201 → 落盘全链；无 principal 403；非法 taskId 400", async () => {
  const internals = (await import("../lib/index.js")).internals;
  const mockRes = () => {
    const captured = { status: null, headers: null, body: "" };
    return {
      captured,
      writeHead(status, headers) { captured.status = status; captured.headers = headers; },
      end(chunk) { captured.body = String(chunk ?? ""); }
    };
  };
  const mockBodyReq = (url, payload) => {
    const raw = JSON.stringify(payload);
    const req = { url, method: "POST", headers: { "content-type": "application/json" } };
    req.on = (event, cb) => {
      if (event === "data") cb(Buffer.from(raw));
      else if (event === "end") cb();
    };
    return req;
  };
  const home = mkHome();
  const root = mkSourceRoot();
  const api = { dshHome: home, readRegistry: () => ({}) };
  api.reviewPrincipalProvider = async () => ({ ok: true, principal: { role: "user" } });

  const res = mockRes();
  await internals.handleReviewApi(
    mockBodyReq("/api/bots/review/intake", { body: specBody, sourceRoot: root, taskId: "T-RV24-HTTP" }),
    res, api
  );
  assert.equal(res.captured.status, 201, `合法请求必须穿透全链：${res.captured.body}`);
  const created = JSON.parse(res.captured.body);
  assert.ok(created.initialLeadInvocationId && created.initialSecondInvocationId);
  assert.ok(readInvocationManifest(home, "reviewer-lead", created.initialLeadInvocationId));
  assert.ok(readSnapshot(home, created.snapshotId), "落盘快照 manifest 校验通过");

  // 无 principal → 403（P5-4 fail closed）
  const anonApi = { dshHome: home, readRegistry: () => ({}) };
  const resAnon = mockRes();
  await internals.handleReviewApi(
    mockBodyReq("/api/bots/review/intake", { body: specBody, sourceRoot: root }),
    resAnon, anonApi
  );
  assert.equal(resAnon.captured.status, 403, "无 principal 必须 403");

  // role≠user → 403
  const rogueApi = { dshHome: home, readRegistry: () => ({}) };
  rogueApi.reviewPrincipalProvider = async () => ({ ok: true, principal: { role: "assistant" } });
  const resRogue = mockRes();
  await internals.handleReviewApi(
    mockBodyReq("/api/bots/review/intake", { body: specBody, sourceRoot: root }),
    resRogue, rogueApi
  );
  assert.equal(resRogue.captured.status, 403, "role≠user 必须 403");

  // taskId 存在但非法 → 400
  const resBadId = mockRes();
  await internals.handleReviewApi(
    mockBodyReq("/api/bots/review/intake", { body: specBody, sourceRoot: root, taskId: 123 }),
    resBadId, api
  );
  assert.equal(resBadId.captured.status, 400, "taskId 非安全字符串必须 400");

  // 多余键 → 400
  const resExtra = mockRes();
  await internals.handleReviewApi(
    mockBodyReq("/api/bots/review/intake", { body: specBody, sourceRoot: root, evil: 1 }),
    resExtra, api
  );
  assert.equal(resExtra.captured.status, 400, "additionalProperties=false");
});

function mkWritable(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) { try { fs.chmodSync(dir, 0o644); } catch { /* 尽力 */ } return; }
  try { fs.chmodSync(dir, 0o700); } catch { /* 尽力 */ }
  for (const name of fs.readdirSync(dir)) {
    mkWritable(path.join(dir, name));
  }
}

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
