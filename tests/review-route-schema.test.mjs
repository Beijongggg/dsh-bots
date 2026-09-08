import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  STAGES, STAGE_CONST, STAGE_AUTHORS, STAGE_RECIPIENTS, RECIPIENT_SPACE,
  STAGE_TRANSITIONS, validateStageCombination, validateStageTransition, bothInitialsPresent
} from "../lib/review-protocol.js";
import {
  REVIEW_ENVELOPE_SCHEMA_VERSION, REVIEW_DECISIONS, DELTA_NEXT_ACTIONS,
  validateReviewEnvelope, envelopeHashes
} from "../lib/review-envelopes.js";

const results = [];
const test = (name, fn) => results.push([name, fn]);

const EXPECTED_STAGES = [
  "task-spec", "initial-lead", "initial-second", "delta-lead", "discussion-second",
  "final-lead", "fix-report", "recheck-lead", "recheck-second", "recheck-delta-lead",
  "recheck-discussion-second", "recheck-final-lead", "user-decision"
];
const EXPECTED_AUTHORS = {
  "task-spec": "user", "initial-lead": "reviewer-lead", "initial-second": "reviewer-second",
  "delta-lead": "reviewer-lead", "discussion-second": "reviewer-second", "final-lead": "reviewer-lead",
  "fix-report": null, "recheck-lead": "reviewer-lead", "recheck-second": "reviewer-second",
  "recheck-delta-lead": "reviewer-lead", "recheck-discussion-second": "reviewer-second",
  "recheck-final-lead": "reviewer-lead", "user-decision": "user"
};
const EXPECTED_RECIPIENTS = {
  "task-spec": [], "initial-lead": [], "initial-second": ["reviewer-lead"],
  "delta-lead": ["reviewer-lead"], "discussion-second": ["reviewer-second"],
  "final-lead": ["reviewer-second", "user-facing"],
  "fix-report": ["reviewer-lead", "reviewer-second"], "recheck-lead": [],
  "recheck-second": ["reviewer-lead"], "recheck-delta-lead": ["reviewer-lead"],
  "recheck-discussion-second": ["reviewer-second"],
  "recheck-final-lead": ["reviewer-second", "user-facing"], "user-decision": []
};
const EXPECTED_TRANSITIONS = {
  "task-spec": ["initial-lead", "initial-second"], "initial-lead": ["delta-lead"],
  "initial-second": ["delta-lead"], "delta-lead": ["discussion-second", "final-lead"],
  "discussion-second": ["final-lead"], "final-lead": ["user-decision"],
  "user-decision": ["fix-report"], "fix-report": ["recheck-lead", "recheck-second"],
  "recheck-lead": ["recheck-delta-lead"], "recheck-second": ["recheck-delta-lead"],
  "recheck-delta-lead": ["recheck-discussion-second", "recheck-final-lead"],
  "recheck-discussion-second": ["recheck-final-lead"], "recheck-final-lead": ["user-decision"]
};

test("R2-01 13 行 stage/作者/required recipients/transition 逐字冻结", () => {
  assert.deepEqual(STAGES, EXPECTED_STAGES);
  assert.deepEqual(STAGE_CONST, Object.fromEntries(EXPECTED_STAGES.map((stage) => [stage, stage])));
  assert.deepEqual(STAGE_AUTHORS, EXPECTED_AUTHORS);
  assert.deepEqual(STAGE_RECIPIENTS, EXPECTED_RECIPIENTS);
  assert.deepEqual(STAGE_TRANSITIONS, EXPECTED_TRANSITIONS);
  assert.deepEqual(RECIPIENT_SPACE, ["reviewer-lead", "reviewer-second", "user-facing"]);
});

test("required recipients 省略时 host 返回全集；完全相等允许且顺序无关", () => {
  for (const stage of STAGES) {
    const authorBotId = STAGE_AUTHORS[stage] ?? "engineering-bot-7";
    const omitted = validateStageCombination({ stage, authorBotId });
    assert.equal(omitted.ok, true, stage);
    assert.deepEqual(omitted.recipients, EXPECTED_RECIPIENTS[stage], stage);
    const reversed = [...EXPECTED_RECIPIENTS[stage]].reverse();
    const exact = validateStageCombination({ stage, authorBotId, recipients: reversed });
    assert.equal(exact.ok, true, `${stage}: exact required set`);
    assert.deepEqual(exact.recipients, EXPECTED_RECIPIENTS[stage]);
  }
});

test("F-P9-02：final-lead required recipients 不可缩为 reviewer-second", () => {
  const result = validateStageCombination({
    stage: "final-lead", authorBotId: "reviewer-lead", recipients: ["reviewer-second"]
  });
  assert.notEqual(result.ok, true);
  assert.match(result.reason, /required recipients 由 host 固定，不得缩小\/扩大/);
});

test("required recipients 任意子集、超集、错位集合、重复项均拒绝", () => {
  const bad = [
    ["reviewer-second"],
    ["user-facing"],
    ["reviewer-second", "user-facing", "reviewer-lead"],
    ["reviewer-lead", "user-facing"],
    ["reviewer-second", "reviewer-second"]
  ];
  for (const recipients of bad) {
    const result = validateStageCombination({ stage: "final-lead", authorBotId: "reviewer-lead", recipients });
    assert.equal(result.ok, false, JSON.stringify(recipients));
    assert.match(result.reason, /不得缩小\/扩大/);
  }
  assert.equal(validateStageCombination({ stage: "initial-lead", authorBotId: "reviewer-lead", recipients: [] }).ok, true);
  assert.equal(validateStageCombination({ stage: "initial-lead", authorBotId: "reviewer-lead", recipients: ["reviewer-second"] }).ok, false);
});

test("stage 枚举与作者契约 fail closed", () => {
  assert.match(validateStageCombination({ stage: "final", authorBotId: "reviewer-lead" }).reason, /未知 stage/);
  assert.match(validateStageCombination({ stage: "final-lead", authorBotId: "reviewer-second" }).reason, /作者必须为 reviewer-lead/);
  assert.match(validateStageCombination({ stage: "fix-report", authorBotId: "" }).reason, /非空字符串/);
});

test("每条冻结 transition 允许，未列跳转与非法首发拒绝", () => {
  assert.equal(validateStageTransition({ from: null, to: "task-spec" }).ok, true);
  assert.equal(validateStageTransition({ from: null, to: "initial-lead" }).ok, false);
  for (const [from, targets] of Object.entries(EXPECTED_TRANSITIONS)) {
    for (const to of targets) assert.equal(validateStageTransition({ from, to }).ok, true, `${from}->${to}`);
  }
  assert.equal(validateStageTransition({ from: "initial-lead", to: "final-lead" }).ok, false);
  assert.equal(validateStageTransition({ from: "discussion-second", to: "delta-lead" }).ok, false);
  assert.equal(validateStageTransition({ from: "recheck-final-lead", to: "fix-report" }).ok, false);
  assert.equal(validateStageTransition({ from: "nope", to: "task-spec" }).ok, false);
});

test("bothInitialsPresent 支持初审与复检盲对，未 committed/quarantined 不算齐", () => {
  assert.equal(bothInitialsPresent([
    { stage: "initial-lead", status: "completed" }, { stage: "initial-second", status: "completed" }
  ]), true);
  assert.equal(bothInitialsPresent([
    { stage: "recheck-lead", status: "completed" }, { stage: "recheck-second", status: "completed" }
  ]), true);
  assert.equal(bothInitialsPresent([
    { stage: "initial-lead", status: "submitted" }, { stage: "initial-second", status: "uncommitted" }
  ]), false);
  assert.equal(bothInitialsPresent([
    { stage: "recheck-lead", status: "quarantined" }, { stage: "recheck-second", status: "submitted" }
  ]), false);
});

test("body-only envelope 恰有 schemaVersion/body；缺失或额外字段拒绝", () => {
  for (const stage of ["initial-lead", "initial-second", "recheck-lead", "recheck-second", "discussion-second", "recheck-discussion-second"]) {
    assert.deepEqual(validateReviewEnvelope({ stage, envelope: { schemaVersion: 1, body: "正文" } }), { ok: true });
    assert.equal(validateReviewEnvelope({ stage, envelope: { schemaVersion: 1 } }).ok, false);
    assert.equal(validateReviewEnvelope({ stage, envelope: { schemaVersion: 1, body: "正文", extra: true } }).ok, false);
  }
  assert.equal(validateReviewEnvelope({ stage: "initial-lead", envelope: { schemaVersion: 2, body: "正文" } }).ok, false);
  assert.equal(validateReviewEnvelope({ stage: "initial-lead", envelope: { schemaVersion: 1, body: "" } }).ok, false);
});

test("final envelope decision 仅机械枚举；findingIds 与 additionalProperties 严格", () => {
  assert.equal(REVIEW_ENVELOPE_SCHEMA_VERSION, 1);
  assert.deepEqual(REVIEW_DECISIONS, ["approve", "reject", "disagree-and-commit"]);
  for (const stage of ["final-lead", "recheck-final-lead"]) {
    for (const decision of REVIEW_DECISIONS) {
      assert.equal(validateReviewEnvelope({ stage, envelope: { schemaVersion: 1, body: "终审", decision, findingIds: [] } }).ok, true);
    }
    assert.equal(validateReviewEnvelope({ stage, envelope: { schemaVersion: 1, body: "终审", decision: "maybe", findingIds: [] } }).ok, false);
    assert.equal(validateReviewEnvelope({ stage, envelope: { schemaVersion: 1, body: "终审", decision: "approve" } }).ok, false);
    assert.equal(validateReviewEnvelope({ stage, envelope: { schemaVersion: 1, body: "终审", decision: "approve", findingIds: [], extra: 1 } }).ok, false);
  }
});

test("delta envelope nextAction/conditional discussionBody/additionalProperties 严格", () => {
  assert.deepEqual(DELTA_NEXT_ACTIONS, ["final", "discussion"]);
  const base = { schemaVersion: 1, body: "delta", discussionFindingIds: ["F-1"] };
  for (const stage of ["delta-lead", "recheck-delta-lead"]) {
    assert.equal(validateReviewEnvelope({ stage, envelope: { ...base, nextAction: "final" } }).ok, true);
    assert.equal(validateReviewEnvelope({ stage, envelope: { ...base, nextAction: "discussion", discussionBody: "R1 原字节" } }).ok, true);
    assert.equal(validateReviewEnvelope({ stage, envelope: { ...base, nextAction: "other" } }).ok, false);
    assert.equal(validateReviewEnvelope({ stage, envelope: { ...base, nextAction: "discussion" } }).ok, false, "discussion 缺 body");
    assert.equal(validateReviewEnvelope({ stage, envelope: { ...base, nextAction: "final", discussionBody: "非法" } }).ok, false, "final 带 discussionBody");
    assert.equal(validateReviewEnvelope({ stage, envelope: { ...base, nextAction: "final", extra: true } }).ok, false);
  }
});

test("envelopeHashes 使用 canonical JSON、UTF-8 byteLength，并单列 discussionBody", () => {
  const envelope = { nextAction: "discussion", body: "正文🙂", schemaVersion: 1, discussionFindingIds: [], discussionBody: "原文甲\n乙" };
  const hashes = envelopeHashes(envelope);
  const canonical = '{"body":"正文🙂","discussionBody":"原文甲\\n乙","discussionFindingIds":[],"nextAction":"discussion","schemaVersion":1}';
  assert.equal(hashes.jsonHash, createHash("sha256").update(canonical, "utf8").digest("hex"));
  assert.equal(hashes.bodyHash, createHash("sha256").update(envelope.body, "utf8").digest("hex"));
  assert.equal(hashes.bodyBytes, Buffer.byteLength(envelope.body, "utf8"));
  assert.equal(hashes.discussionBodyHash, createHash("sha256").update(envelope.discussionBody, "utf8").digest("hex"));
  assert.equal(hashes.discussionBodyBytes, Buffer.byteLength(envelope.discussionBody, "utf8"));
});

let failed = 0;
for (const [name, fn] of results) {
  try { await fn(); console.log("✓", name); }
  catch (error) { failed += 1; console.error("✗", name, "—", error.stack ?? error.message); }
}
process.exit(failed > 0 ? 1 : 0);
