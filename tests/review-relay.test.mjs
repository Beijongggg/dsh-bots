import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  routesDir, routeDirFor, routeFileFor, ROUTE_STATUS,
  recipientKind, createRouteIntent, readRoute, readRoutes,
  deliverRoute, quarantineRoute, reconcileRoutes, resetFailedRoute
} from "../lib/review-relay.js";
import { acquireStoreLock, readManifest, submitReviewArtifact } from "../lib/review-store.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];
const sha256Of = (buf) => createHash("sha256").update(buf).digest("hex");

function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-relay-"));
  homes.push(home);
  return home;
}
function makeArtifact(home, suffix, body = `终审正文 ${suffix}`) {
  return submitReviewArtifact(home, {
    taskId: "T", stage: "final-lead", authorBotId: "reviewer-lead",
    body, idempotencyKey: `relay-${suffix}`
  }).artifactId;
}
function makeUserFacingHook(home) {
  return (artifactId, { bodyFile, sha256, byteLength }) => {
    const dir = path.join(home, "bots", "review", "results", "T", artifactId);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, "body.md");
    fs.copyFileSync(bodyFile, target);
    const bytes = fs.readFileSync(target);
    assert.equal(sha256Of(bytes), sha256);
    assert.equal(bytes.length, byteLength);
    return target;
  };
}

test("R2-08 intent 固定 required 全集，子集先于任何目标写入被拒绝", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "intent");
  const route = createRouteIntent(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead"
  });
  assert.equal(route.ok, true);
  assert.deepEqual(route.recipients, ["reviewer-second", "user-facing"]);
  assert.equal(readRoutes(home, artifactId).length, 2);
  assert.ok(readRoutes(home, artifactId).every((item) => item.status === "pending"));

  const other = makeArtifact(home, "subset");
  const rejected = createRouteIntent(home, {
    artifactId: other, stage: "final-lead", authorBotId: "reviewer-lead",
    recipients: ["reviewer-second"]
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /不得缩小\/扩大/);
  assert.equal(fs.existsSync(routeDirFor(home, other)), false);
});

test("F-P9-08 prepared 事件存在，reviewer 收到不可变正文副本与无源路径 meta", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "copy", "不可变正文副本 αβ");
  createRouteIntent(home, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  const delivered = deliverRoute(home, { artifactId, recipient: "reviewer-second" });
  assert.equal(delivered.ok, true);

  const route = readRoute(home, artifactId, "reviewer-second");
  assert.equal(route.status, "committed");
  assert.deepEqual(route.events.map((event) => event.type), ["pending", "prepared", "committed"]);
  assert.deepEqual(route.events.map((event) => event.seq), [1, 2, 3]);
  assert.ok(route.events.every((event) => Number.isInteger(event.writerEpoch) && event.writerEpoch > 0));
  assert.ok(route.events.every((event) => /^[0-9a-f]{64}$/.test(event.eventHash)));

  const targetDir = path.join(home, "bots", "review", "deliveries", "reviewer-second", artifactId);
  const bodyFile = path.join(targetDir, "body.md");
  const metaFile = path.join(targetDir, "meta.json");
  const source = fs.readFileSync(readManifest(home, artifactId).bodyPath);
  const copied = fs.readFileSync(bodyFile);
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  assert.deepEqual(copied, source);
  assert.equal(meta.sha256, sha256Of(source));
  assert.equal(meta.byteLength, source.length);
  assert.equal(Object.hasOwn(meta, "bodyPath"), false);
  assert.equal(fs.readFileSync(routeFileFor(home, artifactId, "reviewer-second"), "utf8").includes("bodyPath"), false);

  const idempotent = deliverRoute(home, { artifactId, recipient: "reviewer-second" });
  assert.equal(idempotent.ok, true);
  assert.equal(idempotent.idempotent, true);
  assert.equal(readRoute(home, artifactId, "reviewer-second").events.length, 3);
});

test("F-P9-08 committed 后目标被篡改，reconcile 隔离 recipient 与 route", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "tamper");
  const hook = makeUserFacingHook(home);
  const first = reconcileRoutes(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead", copyToUserFacing: hook
  });
  assert.equal(first.completed, true);

  const bodyFile = path.join(home, "bots", "review", "deliveries", "reviewer-second", artifactId, "body.md");
  fs.writeFileSync(bodyFile, "TAMPERED");
  const reconciled = reconcileRoutes(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead", copyToUserFacing: hook
  });
  assert.equal(reconciled.completed, false);
  assert.deepEqual(reconciled.quarantined, ["reviewer-second"]);
  const route = readRoute(home, artifactId, "reviewer-second");
  assert.equal(route.status, "quarantined");
  assert.match(route.reason, /复核失败/);
  const quarantineDir = path.join(home, "bots", "review", "quarantine", "route", `${artifactId}--reviewer-second`);
  assert.ok(fs.readdirSync(quarantineDir).some((name) => name.endsWith(".json")));
});

test("F-P9-08 resetFailedRoute 保留 manifest 与全部历史，追加 failed 后可重试", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "reset");
  createRouteIntent(home, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  quarantineRoute(home, artifactId, "user-facing", "目标暂不可用");
  const before = readRoute(home, artifactId, "user-facing");
  assert.equal(before.status, "quarantined");
  const reset = resetFailedRoute(home, artifactId, "user-facing");
  assert.equal(reset, true);
  assert.ok(fs.existsSync(routeFileFor(home, artifactId, "user-facing")));
  const after = readRoute(home, artifactId, "user-facing");
  assert.equal(after.status, "failed");
  assert.deepEqual(after.events.map((event) => event.type), ["pending", "quarantined", "failed"]);

  const delivered = deliverRoute(home, {
    artifactId, recipient: "user-facing", copyToUserFacing: makeUserFacingHook(home)
  });
  assert.equal(delivered.ok, true);
  assert.deepEqual(readRoute(home, artifactId, "user-facing").events.map((event) => event.type),
    ["pending", "quarantined", "failed", "prepared", "committed"]);
});

test("F-P9-08 route 状态写受 writerEpoch fencing；旧 epoch 被拒绝且不追加事件", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "epoch");
  const old = acquireStoreLock(home);
  const oldEpoch = old.writerEpoch;
  old.release();
  const advanced = acquireStoreLock(home);
  assert.ok(advanced.writerEpoch > oldEpoch);
  advanced.release();

  const rejected = createRouteIntent(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead", expectedWriterEpoch: oldEpoch
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /writerEpoch 不匹配|fencing/);
  assert.equal(readRoutes(home, artifactId).length, 0);
});

test("R2-08 常量、路径和 recipient kind 保持导出兼容", () => {
  const home = mkHome();
  assert.deepEqual(ROUTE_STATUS, ["pending", "prepared", "committed", "failed", "quarantined"]);
  assert.equal(recipientKind("reviewer-lead"), "reviewer");
  assert.equal(recipientKind("user-facing"), "user-facing");
  assert.equal(routesDir(home), path.join(home, "bots", "review", "routes"));
});

test("F-RV-8 user-facing copy 瞬时失败 → failed 可重试（不隔离）；reconcile 重投成功", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "retryable");
  createRouteIntent(home, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  const failingHook = () => { throw new Error("瞬时故障"); };
  const first = reconcileRoutes(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead", copyToUserFacing: failingHook
  });
  assert.equal(first.completed, false, "瞬时失败不得完成");
  const route = readRoute(home, artifactId, "user-facing");
  assert.equal(route.status, "failed", "瞬时失败 → failed（可重试语义），不得隔离");
  assert.ok(route.events.some((event) => event.type === "failed"));
  assert.ok(!route.events.some((event) => event.type === "quarantined"), "不得隔离");

  // hook 恢复后 reconcile 重投 → committed（prepared→failed→prepared→committed 合法链）
  const second = reconcileRoutes(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead", copyToUserFacing: makeUserFacingHook(home)
  });
  assert.equal(second.completed, true);
  assert.equal(readRoute(home, artifactId, "user-facing").status, "committed");
});

test("F-RV-10 route intent/pending 崩溃恢复：intent 落盘未投递 → reconcile 补投并 committed", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "recover");
  const intent = createRouteIntent(home, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  assert.equal(intent.ok, true);
  // 模拟崩溃：只有 intent，两条腿都未投递
  assert.ok(readRoutes(home, artifactId).every((item) => item.status === "pending"));
  const reconcile = reconcileRoutes(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead", copyToUserFacing: makeUserFacingHook(home)
  });
  assert.equal(reconcile.completed, true, "pending 腿由 reconcile 补投");
  for (const recipient of ["reviewer-second", "user-facing"]) {
    const route = readRoute(home, artifactId, recipient);
    assert.equal(route.status, "committed");
    assert.deepEqual(route.events.map((event) => event.type), ["pending", "prepared", "committed"]);
  }
});

test("F-RV-10 intent 落盘但 pending 事件未写的崩溃窗 → createRouteIntent 持锁补 pending 自愈", () => {
  const home = mkHome();
  const artifactId = makeArtifact(home, "heal");
  createRouteIntent(home, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  // 模拟崩溃：intent 文件在、事件目录未落（intent 写入与 pending 事件之间中断）
  fs.rmSync(path.join(routesDir(home), artifactId, "events"), { recursive: true, force: true });
  const orphan = readRoute(home, artifactId, "reviewer-second");
  assert.equal(orphan.status, null, "崩溃窗内 status 为 null（无事件）");
  const healed = createRouteIntent(home, { artifactId, stage: "final-lead", authorBotId: "reviewer-lead" });
  assert.equal(healed.ok, true, "同 intent 重入不再抛「缺 pending 事件」，而是持锁补齐（null→pending 唯一治愈边）");
  for (const recipient of ["reviewer-second", "user-facing"]) {
    const route = readRoute(home, artifactId, recipient);
    assert.equal(route.status, "pending");
    assert.deepEqual(route.events.map((event) => event.type), ["pending"]);
  }
  const reconcile = reconcileRoutes(home, {
    artifactId, stage: "final-lead", authorBotId: "reviewer-lead", copyToUserFacing: makeUserFacingHook(home)
  });
  assert.equal(reconcile.completed, true);
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
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
