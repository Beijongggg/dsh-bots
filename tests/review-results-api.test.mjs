/** R2-06 / F-P9-07: user-facing results and non-bypassable decisions. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  resultsDir, resultIndexFile, resultBodyFile, decisionsDir, decisionsFileFor,
  NOTIFY_KEYS, DECISION_WRITERS, DECISION_CHOICES,
  publishResult, readIndexEntries, isSafeLogicalId, getResultByArtifact,
  getResultsByTask, notifyPayloadFor, assertNotifyKeys,
  assertDecisionWriter, writeUserDecision, readDecisions
} from "../lib/review-results.js";
import { submitReviewArtifact } from "../lib/review-store.js";
import { createRouteIntent, reconcileRoutes } from "../lib/review-relay.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);
const homes = [];

function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-res-"));
  homes.push(home);
  return home;
}

function publishFinal(home, taskId, idempotencyKey, options = {}) {
  const stage = options.stage ?? "final-lead";
  const { artifactId } = submitReviewArtifact(home, {
    taskId,
    stage,
    authorBotId: "reviewer-lead",
    body: options.body ?? "终审正文",
    idempotencyKey
  });
  // F-RV-15：user-facing route committed 是 decision 的前置——fixture 走真实 relay
  const intent = createRouteIntent(home, { artifactId, stage, authorBotId: "reviewer-lead" });
  const reconcile = reconcileRoutes(home, {
    artifactId, stage, authorBotId: "reviewer-lead",
    copyToUserFacing: (id, { bodyFile }) => {
      const target = resultBodyFile(home, taskId, id);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(bodyFile, target);
      return target;
    }
  });
  if (!intent.ok || !reconcile.completed) {
    throw new Error(`fixture 路由未完成：${JSON.stringify({ intent, reconcile })}`);
  }
  return {
    artifactId,
    published: publishResult(home, {
      taskId,
      artifactId,
      stage,
      authorBotId: "reviewer-lead",
      findingIds: options.findingIds ?? ["F-1", "F-2"]
    })
  };
}

const principal = { principal: { role: "user" } };
function decisionInput(taskId, artifactId, overrides = {}) {
  return {
    taskId,
    artifactId,
    revision: 1,
    choice: "authorize-repair",
    findingIds: ["F-1"],
    scope: ["lib/"],
    acceptanceCriteria: ["targeted tests pass"],
    author: "user",
    ...overrides
  };
}

test("R2-06 publishResult only publishes completed final-lead/recheck-final-lead bodies", () => {
  const home = mkHome();
  const { artifactId, published } = publishFinal(home, "T-1", "r1");
  assert.equal(published.stage, "final-lead");
  assert.equal(published.status, "completed");
  assert.equal(published.idempotent, false);
  const source = fs.readFileSync(path.join(home, "bots/review/artifacts", artifactId, "body.md"));
  assert.deepEqual(fs.readFileSync(resultBodyFile(home, "T-1", artifactId)), source);
  assert.equal(resultBodyFile(home, "T-1", artifactId), path.join(resultsDir(home), "T-1", artifactId, "body.md"));
  const index = readIndexEntries(home);
  assert.equal(index.length, 1);
  assert.match(index[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(index[0].byteLength, source.length);
  assert.equal(index[0].status, "completed");
  assert.equal(publishResult(home, {
    taskId: "T-1", artifactId, stage: "final-lead", authorBotId: "reviewer-lead",
    findingIds: ["F-1", "F-2"]
  }).idempotent, true);

  const invalid = submitReviewArtifact(home, {
    taskId: "T-1", stage: "delta-lead", authorBotId: "reviewer-lead",
    body: "delta", idempotencyKey: "not-final"
  });
  assert.throws(() => publishResult(home, {
    taskId: "T-1", artifactId: invalid.artifactId, stage: "delta-lead", authorBotId: "reviewer-lead"
  }), /不是 user-facing/);
});

test("R2-06 read APIs reject paths and fail closed on body corruption", () => {
  const home = mkHome();
  const { artifactId } = publishFinal(home, "T-2", "r2", { stage: "recheck-final-lead", body: "复检正文" });
  const ok = getResultByArtifact(home, artifactId);
  assert.equal(ok.ok, true);
  assert.equal(ok.content, "复检正文");
  assert.equal(getResultByArtifact(home, "../etc/passwd").status, 400);
  assert.equal(getResultByArtifact(home, "/abs/path").status, 400);
  assert.equal(getResultByArtifact(home, "a/b").status, 400);
  assert.equal(getResultByArtifact(home, "NONEXIST-999").status, 404);
  assert.equal(isSafeLogicalId("/etc/passwd"), false);
  assert.equal(isSafeLogicalId("T-2026-001"), true);
  assert.equal(getResultsByTask(home, "T-2").entries.length, 1);
  fs.writeFileSync(resultBodyFile(home, "T-2", artifactId), "被篡改");
  assert.equal(getResultByArtifact(home, artifactId).status, 500);
});

test("R2-06 notification has exactly seven public fields", () => {
  const home = mkHome();
  publishFinal(home, "T-3", "r3");
  const payload = notifyPayloadFor(readIndexEntries(home)[0]);
  assert.equal(assertNotifyKeys(payload), true);
  assert.deepEqual(Object.keys(payload).sort(), [...NOTIFY_KEYS].sort());
  assert.equal(payload.status, "completed");
  for (const key of ["content", "summary", "body", "path"]) assert.equal(key in payload, false);
});

test("F-P9-07 unauthenticated direct write and unavailable principal fail closed", () => {
  const home = mkHome();
  const { artifactId } = publishFinal(home, "T-AUTH", "auth");
  const input = decisionInput("T-AUTH", artifactId);
  assert.equal(writeUserDecision(home, input).ok, false, "omitted authenticator must reject");
  assert.equal(writeUserDecision(home, {
    ...input, authenticatorResult: { principal: { role: "user" } }
  }).ok, false, "request-body authenticator injection must reject");
  assert.equal(writeUserDecision(home, input, null).ok, false, "null authenticator must reject");
  assert.equal(writeUserDecision(home, input, { ok: false }).ok, false);
  assert.equal(readDecisions(home, "T-AUTH").length, 0);
  assert.equal(assertDecisionWriter(null).ok, false);
});

test("F-P9-07 author injection rejects reviewer-lead and omitted author", () => {
  const home = mkHome();
  const { artifactId } = publishFinal(home, "T-AUTHOR", "author");
  assert.equal(writeUserDecision(home, decisionInput("T-AUTHOR", artifactId, {
    author: "reviewer-lead"
  }), principal).ok, false);
  const omitted = decisionInput("T-AUTHOR", artifactId);
  delete omitted.author;
  assert.equal(writeUserDecision(home, omitted, principal).ok, false);
  assert.equal(readDecisions(home, "T-AUTHOR").length, 0);
});

test("F-P9-07 unpublished or non-task artifact rejects decision", () => {
  const home = mkHome();
  const unpublished = submitReviewArtifact(home, {
    taskId: "T-ART", stage: "final-lead", authorBotId: "reviewer-lead",
    body: "not published", idempotencyKey: "unpublished"
  });
  assert.equal(writeUserDecision(home, decisionInput("T-ART", unpublished.artifactId), principal).ok, false);
  const { artifactId } = publishFinal(home, "T-OTHER", "other");
  assert.equal(writeUserDecision(home, decisionInput("T-ART", artifactId), principal).ok, false);
});

test("F-P9-07 revisions are strictly sequential", () => {
  const home = mkHome();
  const { artifactId } = publishFinal(home, "T-REV", "rev");
  assert.equal(writeUserDecision(home, decisionInput("T-REV", artifactId, { revision: 2 }), principal).ok, false);
  assert.equal(writeUserDecision(home, decisionInput("T-REV", artifactId), principal).ok, true);
  assert.equal(writeUserDecision(home, decisionInput("T-REV", artifactId, {
    revision: 3, choice: "accept", findingIds: [], scope: [], acceptanceCriteria: []
  }), principal).ok, false);
});

test("F-P9-07 same revision is idempotent only for identical complete content", () => {
  const home = mkHome();
  const { artifactId } = publishFinal(home, "T-IDEM", "idem");
  const input = decisionInput("T-IDEM", artifactId);
  assert.equal(writeUserDecision(home, input, principal).ok, true);
  assert.equal(writeUserDecision(home, input, principal).idempotent, true);
  for (const changed of [
    { choice: "accept" },
    { findingIds: ["F-2"] },
    { scope: ["tests/"] },
    { acceptanceCriteria: ["different"] }
  ]) {
    const result = writeUserDecision(home, decisionInput("T-IDEM", artifactId, changed), principal);
    assert.equal(result.ok, false);
    assert.match(result.reason, /不一致|拒绝覆盖/);
  }
});

test("F-P9-07 authenticated user writes frozen decision contract", () => {
  const home = mkHome();
  const { artifactId } = publishFinal(home, "T-OK", "ok");
  const written = writeUserDecision(home, decisionInput("T-OK", artifactId), principal);
  assert.equal(written.ok, true);
  assert.equal(written.decision.author, "user");
  assert.deepEqual(written.decision.findingIds, ["F-1"]);
  assert.deepEqual(written.decision.scope, ["lib/"]);
  assert.deepEqual(written.decision.acceptanceCriteria, ["targeted tests pass"]);
  assert.match(written.decision.hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(written.decision).sort(), [
    "acceptanceCriteria", "artifactId", "at", "author", "choice", "findingIds",
    "hash", "revision", "scope", "taskId"
  ]);
  assert.equal(fs.existsSync(decisionsFileFor(home, "T-OK")), true);
  assert.equal(fs.readFileSync(resultIndexFile(home), "utf8").includes("authorize-repair"), false);
});

test("R2-06 frozen writer and choice enumerations", () => {
  assert.deepEqual(DECISION_WRITERS, ["user"]);
  assert.equal(DECISION_CHOICES.includes("authorize-repair"), true);
  for (const role of ["lead", "reviewer-lead", "reviewer-second", "coder-bot", "engineering"]) {
    assert.equal(assertDecisionWriter({ principal: { role } }).ok, false);
  }
  assert.equal(assertDecisionWriter(principal).ok, true);
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
