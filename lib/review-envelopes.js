/** Stage-specific reviewer RPC envelope schemas (PLAN P0.3). */
import { createHash } from "node:crypto";

export const REVIEW_ENVELOPE_SCHEMA_VERSION = 1;
export const REVIEW_DECISIONS = Object.freeze(["approve", "reject", "disagree-and-commit"]);
export const DELTA_NEXT_ACTIONS = Object.freeze(["final", "discussion"]);

const BODY_ONLY_STAGES = new Set([
  "initial-lead",
  "initial-second",
  "recheck-lead",
  "recheck-second",
  "discussion-second",
  "recheck-discussion-second"
]);
const FINAL_STAGES = new Set(["final-lead", "recheck-final-lead"]);
const DELTA_STAGES = new Set(["delta-lead", "recheck-delta-lead"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactKeys(envelope, required, optional = []) {
  const keys = Object.keys(envelope);
  const allowed = new Set([...required, ...optional]);
  const extra = keys.find((key) => !allowed.has(key));
  if (extra) return `envelope 含额外字段 ${extra}（additionalProperties=false）`;
  const missing = required.find((key) => !Object.hasOwn(envelope, key));
  if (missing) return `envelope 缺少字段 ${missing}`;
  return null;
}

function validateCommon(envelope) {
  if (!isPlainObject(envelope)) return "envelope 必须为普通对象";
  if (envelope.schemaVersion !== REVIEW_ENVELOPE_SCHEMA_VERSION) {
    return `schemaVersion 必须为 ${REVIEW_ENVELOPE_SCHEMA_VERSION}`;
  }
  if (typeof envelope.body !== "string" || envelope.body.length === 0) return "body 必须为非空字符串";
  return null;
}

function validateStringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    return `${field} 必须为非空字符串数组`;
  }
  return null;
}

/** Validate a reviewer envelope without inferring semantics from natural language. */
export function validateReviewEnvelope({ stage, envelope }) {
  if (!BODY_ONLY_STAGES.has(stage) && !FINAL_STAGES.has(stage) && !DELTA_STAGES.has(stage)) {
    return { ok: false, reason: `stage=${String(stage)} 没有 reviewer envelope schema` };
  }
  const commonError = validateCommon(envelope);
  if (commonError) return { ok: false, reason: commonError };

  if (BODY_ONLY_STAGES.has(stage)) {
    const keyError = exactKeys(envelope, ["schemaVersion", "body"]);
    return keyError ? { ok: false, reason: keyError } : { ok: true };
  }

  if (FINAL_STAGES.has(stage)) {
    const keyError = exactKeys(envelope, ["schemaVersion", "body", "decision", "findingIds"]);
    if (keyError) return { ok: false, reason: keyError };
    if (!REVIEW_DECISIONS.includes(envelope.decision)) {
      return { ok: false, reason: `decision 非法：${String(envelope.decision)}` };
    }
    const findingError = validateStringArray(envelope.findingIds, "findingIds");
    return findingError ? { ok: false, reason: findingError } : { ok: true };
  }

  const keyError = exactKeys(
    envelope,
    ["schemaVersion", "body", "nextAction", "discussionFindingIds"],
    ["discussionBody"]
  );
  if (keyError) return { ok: false, reason: keyError };
  if (!DELTA_NEXT_ACTIONS.includes(envelope.nextAction)) {
    return { ok: false, reason: `nextAction 非法：${String(envelope.nextAction)}` };
  }
  const findingError = validateStringArray(envelope.discussionFindingIds, "discussionFindingIds");
  if (findingError) return { ok: false, reason: findingError };
  const hasDiscussionBody = Object.hasOwn(envelope, "discussionBody");
  if (envelope.nextAction === "discussion") {
    if (!hasDiscussionBody || typeof envelope.discussionBody !== "string" || envelope.discussionBody.length === 0) {
      return { ok: false, reason: "nextAction=discussion 时 discussionBody 必须为非空字符串" };
    }
  } else if (hasDiscussionBody) {
    return { ok: false, reason: "nextAction=final 时不得出现 discussionBody" };
  }
  return { ok: true };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashUtf8(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Hash canonical JSON and the exact UTF-8 bytes of body/discussionBody. */
export function envelopeHashes(envelope) {
  if (!isPlainObject(envelope)) throw new TypeError("envelope 必须为普通对象");
  if (typeof envelope.body !== "string") throw new TypeError("body 必须为字符串");
  const canonical = canonicalJson(envelope);
  const result = {
    jsonHash: hashUtf8(canonical),
    bodyHash: hashUtf8(envelope.body),
    bodyBytes: Buffer.byteLength(envelope.body, "utf8")
  };
  if (Object.hasOwn(envelope, "discussionBody")) {
    if (typeof envelope.discussionBody !== "string") throw new TypeError("discussionBody 必须为字符串");
    result.discussionBodyHash = hashUtf8(envelope.discussionBody);
    result.discussionBodyBytes = Buffer.byteLength(envelope.discussionBody, "utf8");
  }
  return result;
}
