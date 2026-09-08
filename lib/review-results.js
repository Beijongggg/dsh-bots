/**
 * User-facing review results and authenticated user decisions.
 *
 * R2-06 freezes two independent stores:
 *   - committed final/recheck-final result copies under review/results;
 *   - authenticated user decisions under review/decisions.
 * A decision never becomes part of the immutable review body.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import {
  acquireStoreLock, readJsonl, readManifest, verifyArtifactIntegrity, writeFileDurable
} from "./review-store.js";
import { readRoute } from "./review-relay.js";

// ---------------- Layout ----------------

export function resultsDir(dshHome) {
  return join(dshHome, "bots", "review", "results");
}
export function resultIndexFile(dshHome) {
  return join(resultsDir(dshHome), "index.jsonl");
}
/**
 * Frozen result copy layout: results/<taskId>/<artifactId>/body.md.
 * The two-argument compatibility form only names the historical path; all new
 * reads and writes use the three-argument task-bound form.
 */
export function resultBodyFile(dshHome, taskId, artifactId = undefined) {
  if (artifactId === undefined) {
    // Compatibility: callers that only have artifactId can resolve an already
    // indexed result without reverting the frozen task-bound layout.
    const rows = readJsonl(resultIndexFile(dshHome));
    if (rows.corrupt.length > 0) throw new Error("result index JSONL 损坏，fail closed");
    const indexed = rows.parsed.find((entry) => entry?.artifactId === taskId);
    if (indexed?.taskId) return join(resultsDir(dshHome), indexed.taskId, taskId, "body.md");
    return join(resultsDir(dshHome), `${taskId}.final.md`);
  }
  return join(resultsDir(dshHome), taskId, artifactId, "body.md");
}
export function decisionsDir(dshHome) {
  return join(dshHome, "bots", "review", "decisions");
}
export function decisionsFileFor(dshHome, taskId) {
  return join(decisionsDir(dshHome), `${taskId}.jsonl`);
}

// ---------------- Frozen constants ----------------

export const NOTIFY_KEYS = ["taskId", "artifactId", "stage", "status", "createdAt", "sha256", "byteLength"];
export const DECISION_WRITERS = ["user"];
export const DECISION_CHOICES = Object.freeze([
  "authorize-repair",
  "accept",
  "reject",
  "defer"
]);

const USER_FACING_STAGES = new Set(["final-lead", "recheck-final-lead"]);

// ---------------- Common validation ----------------

export function isSafeLogicalId(id) {
  if (typeof id !== "string" || id === "") return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..") || isAbsolute(id)) return false;
  return /^[A-Za-z0-9:_-]+$/.test(id);
}

function assertLogicalId(name, value) {
  if (!isSafeLogicalId(value)) throw new TypeError(`${name} 必须为安全逻辑 ID`);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key]);
    return out;
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function readJsonlClosed(file, label) {
  const rows = readJsonl(file);
  if (rows.corrupt.length > 0) throw new Error(`${label} JSONL 损坏，fail closed`);
  return rows.parsed;
}

function appendJsonl(file, entry) {
  const previous = existsSync(file) ? readFileSync(file, "utf8") : "";
  const prefix = previous === "" ? "" : `${previous.replace(/\n$/, "")}\n`;
  writeFileDurable(file, `${prefix}${JSON.stringify(entry)}\n`);
}

// ---------------- Result index and immutable bodies ----------------

export function publishResult(dshHome, {
  taskId,
  artifactId,
  stage = "final-lead",
  status = "completed",
  authorBotId,
  sourceArtifactId = artifactId,
  decision = null,
  findingIds = [],
  copy = null
}) {
  assertLogicalId("taskId", taskId);
  assertLogicalId("artifactId", artifactId);
  if (!USER_FACING_STAGES.has(stage)) {
    throw new Error(`stage=${String(stage)} 不是 user-facing final stage`);
  }
  if (status !== "completed") throw new Error("user-facing result 只有 completed 才可发布");
  if (authorBotId !== "reviewer-lead") throw new Error(`${stage} 作者必须为 reviewer-lead`);
  if (!Array.isArray(findingIds) || findingIds.some((id) => typeof id !== "string" || id === "")) {
    throw new TypeError("findingIds 必须为非空字符串数组");
  }

  const index = readIndexEntries(dshHome);
  const existing = index.find((entry) => entry.artifactId === artifactId);
  if (existing) {
    const sameRequest = existing.taskId === taskId && existing.stage === stage
      && existing.status === status && existing.authorBotId === authorBotId
      && existing.sourceArtifactId === sourceArtifactId
      && sameValue(existing.decision, decision)
      && sameValue(existing.findingIds, findingIds);
    if (!sameRequest) throw new Error("artifactId 已按不同发布语义登记");
    const bodyFile = resultBodyFile(dshHome, taskId, artifactId);
    if (!existsSync(bodyFile)) throw new Error("已登记 result 正文缺失，fail closed");
    const body = readFileSync(bodyFile);
    if (createHash("sha256").update(body).digest("hex") !== existing.sha256
        || body.length !== existing.byteLength) {
      throw new Error("已登记 result 正文完整性失败，fail closed");
    }
    return { ...existing, idempotent: true };
  }

  const manifest = readManifest(dshHome, artifactId);
  if (!manifest) throw new Error(`工件 manifest 缺失：${artifactId}`);
  const integrity = verifyArtifactIntegrity(dshHome, artifactId, manifest);
  if (!integrity.ok) throw new Error(`工件完整性失败：${integrity.reason}`);
  if (manifest.taskId !== taskId) throw new Error(`task 绑定不符：manifest.taskId=${manifest.taskId} ≠ ${taskId}`);
  if (manifest.stage !== stage) throw new Error(`stage 绑定不符：manifest.stage=${manifest.stage} ≠ ${stage}`);
  if (manifest.authorBotId !== authorBotId) throw new Error("authorBotId 与 manifest 不一致");

  const target = resultBodyFile(dshHome, taskId, artifactId);
  mkdirSync(join(resultsDir(dshHome), taskId, artifactId), { recursive: true });
  if (copy) copy(manifest.bodyPath, target);
  else writeFileDurable(target, readFileSync(manifest.bodyPath));

  const body = readFileSync(target);
  const sha256 = createHash("sha256").update(body).digest("hex");
  if (sha256 !== manifest.sha256 || body.length !== manifest.byteLength) {
    throw new Error("user-facing 正文 hash/字节不一致");
  }

  const entry = {
    taskId,
    artifactId,
    stage,
    status,
    authorBotId,
    sourceArtifactId,
    createdAt: new Date().toISOString(),
    sha256: manifest.sha256,
    byteLength: manifest.byteLength,
    decision,
    findingIds: [...findingIds]
  };
  appendIndex(dshHome, entry);
  return { ...entry, idempotent: false };
}

export function readIndexEntries(dshHome) {
  return readJsonlClosed(resultIndexFile(dshHome), "result index");
}

function appendIndex(dshHome, entry) {
  mkdirSync(resultsDir(dshHome), { recursive: true });
  appendJsonl(resultIndexFile(dshHome), entry);
}

// ---------------- Read-only result API ----------------

export function getResultByArtifact(dshHome, artifactId) {
  if (!isSafeLogicalId(artifactId)) return { ok: false, status: 400, reason: "非法 artifactId（路径类输入拒绝）" };
  const entry = readIndexEntries(dshHome).find((candidate) => candidate.artifactId === artifactId);
  if (!entry || !USER_FACING_STAGES.has(entry.stage) || entry.status !== "completed") {
    return { ok: false, status: 404, reason: "工件不存在或未 completed" };
  }
  const bodyFile = resultBodyFile(dshHome, entry.taskId, artifactId);
  if (!existsSync(bodyFile)) return { ok: false, status: 404, reason: "正文缺失" };
  const body = readFileSync(bodyFile);
  if (createHash("sha256").update(body).digest("hex") !== entry.sha256 || body.length !== entry.byteLength) {
    return { ok: false, status: 500, reason: "正文 hash 与索引不符（fail closed）" };
  }
  return { ok: true, metadata: { ...entry }, content: body.toString("utf8") };
}

export function getResultsByTask(dshHome, taskId) {
  if (!isSafeLogicalId(taskId)) return { ok: false, status: 400, reason: "非法 taskId" };
  const entries = readIndexEntries(dshHome).filter((entry) =>
    entry.taskId === taskId && USER_FACING_STAGES.has(entry.stage) && entry.status === "completed");
  return { ok: true, entries };
}

// ---------------- Notifications ----------------

export function notifyPayloadFor(entry, { status = entry.status } = {}) {
  return {
    taskId: entry.taskId,
    artifactId: entry.artifactId,
    stage: entry.stage,
    status,
    createdAt: entry.createdAt,
    sha256: entry.sha256,
    byteLength: entry.byteLength
  };
}

export function assertNotifyKeys(payload) {
  return JSON.stringify(Object.keys(payload).sort()) === JSON.stringify([...NOTIFY_KEYS].sort());
}

// ---------------- Authenticated user decisions ----------------

/** Accept the host authenticator result itself; null/unavailable always fails closed. */
export function assertDecisionWriter(authenticatorResult, { principal = null } = {}) {
  if (authenticatorResult === null || authenticatorResult === undefined || typeof authenticatorResult !== "object") {
    return { ok: false, reason: "认证 principal 不可用（fail closed：POST 拒绝）" };
  }
  if (authenticatorResult.ok === false) return { ok: false, reason: "未认证（fail closed：POST 拒绝）" };
  const who = principal ?? authenticatorResult.principal ?? null;
  if (!who || !DECISION_WRITERS.includes(who.role)) {
    return { ok: false, reason: `角色 ${who?.role ?? "unknown"} 无决策写权（仅 user）` };
  }
  return { ok: true, principal: who };
}

function decisionContent(input) {
  return {
    taskId: input.taskId,
    artifactId: input.artifactId,
    revision: input.revision,
    choice: input.choice,
    findingIds: input.findingIds,
    scope: input.scope,
    acceptanceCriteria: input.acceptanceCriteria,
    author: "user"
  };
}

function sameDecisionContent(existing, proposed) {
  return sameValue(decisionContent(existing), decisionContent(proposed));
}

const DECISION_KEYS = [
  "taskId", "artifactId", "revision", "choice", "findingIds", "scope",
  "acceptanceCriteria", "author", "at", "hash"
];

function validScope(scope) {
  if (!Array.isArray(scope) || scope.length === 0) return false;
  return scope.every((prefix) => {
    if (typeof prefix !== "string" || prefix.trim() === "" || prefix.includes("\0") || isAbsolute(prefix)) return false;
    const segments = prefix.replace(/\\/g, "/").split("/").filter(Boolean);
    return segments.length > 0 && !segments.includes(".") && !segments.includes("..");
  });
}

function validateDecisionRow(row, taskId) {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return "decision 行必须为对象";
  if (!sameValue(Object.keys(row).sort(), [...DECISION_KEYS].sort())) return "decision 字段集合不符合冻结契约";
  if (row.taskId !== taskId || !isSafeLogicalId(row.taskId) || !isSafeLogicalId(row.artifactId)) return "decision task/artifact 绑定非法";
  if (!Number.isInteger(row.revision) || row.revision < 1) return "decision revision 非法";
  if (!DECISION_CHOICES.includes(row.choice) || row.author !== "user") return "decision choice/author 非法";
  if (!Array.isArray(row.findingIds) || row.findingIds.some((id) => typeof id !== "string" || id === "")
      || new Set(row.findingIds).size !== row.findingIds.length) return "decision findingIds 非法";
  if (!validScope(row.scope) || row.acceptanceCriteria === undefined || row.acceptanceCriteria === null) return "decision scope/acceptanceCriteria 非法";
  if (typeof row.at !== "string" || !Number.isFinite(Date.parse(row.at))) return "decision at 非法";
  const expected = createHash("sha256").update(canonicalJson(decisionContent(row)), "utf8").digest("hex");
  if (row.hash !== expected) return "decision hash 不匹配";
  return null;
}

/**
 * Persist one authenticated decision.
 *
 * FROZEN R2-06/R2-07 CONTRACT: every stored row has exactly the semantic shape
 * {taskId, artifactId, revision, choice, findingIds[], scope,
 *  acceptanceCriteria, author:"user", at, hash}.
 * Engineering-job creation must mechanically consume this record; callers may
 * not reconstruct authorization from review prose or request parameters.
 *
 * authenticatorResult is mandatory and is normally
 * {principal:{role:"user"}}. null means the host principal is unavailable and
 * therefore rejects the write. Authentication is never accepted from input.
 */
export function writeUserDecision(dshHome, input, authenticatorResult = null) {
  // Authentication is a distinct host-injected argument. Never accept a
  // request-body field as an authenticator result.
  const auth = assertDecisionWriter(authenticatorResult);
  if (!auth.ok) return auth;

  const {
    taskId, artifactId, revision, choice, findingIds, scope,
    acceptanceCriteria, author
  } = input ?? {};

  if (author !== "user") return { ok: false, reason: "author 必须显式为 user，拒绝注入或省略" };
  if (!isSafeLogicalId(taskId) || !isSafeLogicalId(artifactId)) {
    return { ok: false, reason: "taskId/artifactId 非法" };
  }
  if (!Number.isInteger(revision) || revision < 1) return { ok: false, reason: "revision 必须为从 1 开始的整数" };
  if (!DECISION_CHOICES.includes(choice)) return { ok: false, reason: `choice 非法：${String(choice)}` };
  if (!Array.isArray(findingIds) || findingIds.some((id) => typeof id !== "string" || id === "")
      || new Set(findingIds).size !== findingIds.length) {
    return { ok: false, reason: "findingIds 必须为无重复字符串数组" };
  }
  if (!validScope(scope) || acceptanceCriteria === undefined || acceptanceCriteria === null) {
    return { ok: false, reason: "scope 必须为安全的相对路径前缀数组，acceptanceCriteria 必须显式提供" };
  }

  let index;
  try {
    index = readIndexEntries(dshHome);
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  const taskResults = index.filter((entry) => entry.taskId === taskId);
  if (taskResults.length === 0) return { ok: false, reason: "task 尚无已发布结果" };
  const result = taskResults.find((entry) => entry.artifactId === artifactId);
  if (!result || !USER_FACING_STAGES.has(result.stage) || result.status !== "completed") {
    return { ok: false, reason: "artifactId 不是已 committed 的 user-facing final result" };
  }
  const bodyFile = resultBodyFile(dshHome, taskId, artifactId);
  if (!existsSync(bodyFile)) return { ok: false, reason: "user-facing result 正文副本缺失" };
  const body = readFileSync(bodyFile);
  if (createHash("sha256").update(body).digest("hex") !== result.sha256 || body.length !== result.byteLength) {
    return { ok: false, reason: "user-facing result 正文副本完整性失败" };
  }
  // F-RV-15：decision 必须再次确认 user-facing route 为 committed——副本失败/隔离/
  // 未完成（不可逆破坏或半成品）一律拒绝，不构成 user decision 前置。
  const route = readRoute(dshHome, artifactId, "user-facing");
  if (!route || route.corrupt || route.status !== "committed") {
    return { ok: false, reason: "user-facing route 未 committed（副本失败/隔离/未完成），decision 拒绝（F-RV-15）" };
  }

  if (choice === "authorize-repair") {
    if (findingIds.length === 0 || !findingIds.every((id) => result.findingIds.includes(id))) {
      return { ok: false, reason: "authorize-repair findingIds 必须是终审 findingIds 的非空子集" };
    }
  }

  const proposed = { taskId, artifactId, revision, choice, findingIds: [...findingIds], scope, acceptanceCriteria, author: "user" };
  const lock = acquireStoreLock(dshHome);
  try {
    let existingDecisions;
    try { existingDecisions = readDecisions(dshHome, taskId); }
    catch (error) { return { ok: false, reason: error.message }; }
    const sameRevision = existingDecisions.find((decision) => decision.revision === revision);
    const maxRevision = existingDecisions.reduce((max, decision) => Math.max(max, decision.revision), 0);

    if (sameRevision) {
      if (sameDecisionContent(sameRevision, proposed)) {
        return { ok: true, idempotent: true, decision: sameRevision };
      }
      return { ok: false, reason: `revision ${revision} 已存在且内容/artifact/scope 不一致（拒绝覆盖）` };
    }
    if (revision !== maxRevision + 1) {
      return { ok: false, reason: `revision 必须严格顺序递增（expected=${maxRevision + 1}, actual=${revision}）` };
    }

    const at = new Date().toISOString();
    const hash = createHash("sha256").update(canonicalJson(proposed), "utf8").digest("hex");
    const decision = { ...proposed, at, hash };
    mkdirSync(decisionsDir(dshHome), { recursive: true });
    appendJsonl(decisionsFileFor(dshHome, taskId), decision);
    return { ok: true, idempotent: false, decision };
  } finally {
    lock.release();
  }
}

export function readDecisions(dshHome, taskId) {
  if (!isSafeLogicalId(taskId)) throw new TypeError("taskId 必须为安全逻辑 ID");
  const decisions = readJsonlClosed(decisionsFileFor(dshHome, taskId), "decision store");
  let expectedRevision = 1;
  for (const decision of decisions) {
    const invalid = validateDecisionRow(decision, taskId);
    if (invalid) throw new Error(`${invalid}，decision store fail closed`);
    if (decision.revision !== expectedRevision) {
      throw new Error(`decision revision 链不连续（expected=${expectedRevision}），fail closed`);
    }
    expectedRevision += 1;
  }
  return decisions;
}
