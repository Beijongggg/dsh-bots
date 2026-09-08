/**
 * Review invocation ledger.
 *
 * F-RV-12 受控边界（冻结）：
 *   - lease 文件（lease.json）与事件目录（events/<seq>-<eventId>.json）的唯一写者是
 *     持有 store 锁的宿主进程；所有读写都在 acquireStoreLock 临界区内完成；
 *   - 事件折叠（foldInvocationEvents）只发生在锁内，且逐条校验 seq 连续、
 *     writerEpoch、eventHash 与合法 transition；损坏/缺号/非法分支一律 fail closed，
 *     绝不“只折叠可解析部分”；
 *   - lease 归属由 generation/claimEpoch/pid/startedAt/hostInstanceId/requeueGeneration
 *     共同界定，heartbeat 与最终提交必须证明同一归属；过期 lease 只能由 host 回收
 *     （expireStaleLeases），任何机器人侧不得自行接管；
 *   - dead-letter 仅经 retry-wait 到达（F-RV-7）：无 expired/attempt-failed 先落的
 *     “claimed → dead-letter”直跳是非法分支，折叠即判损坏。
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import { STAGES, STAGE_AUTHORS, expectedNextStages } from "./review-protocol.js";
import { readSnapshot } from "./review-evidence.js";
import { flowFileFor, readFlow } from "./review-flow.js";
import {
  acquireStoreLock,
  appendAudit,
  artifactDirFor,
  assertEpochCurrent,
  bodyFileFor,
  currentEpoch,
  manifestFileFor,
  quarantineArtifact,
  verifyArtifactIntegrity,
  writeFileDurable
} from "./review-store.js";

export { assertEpochCurrent, currentEpoch };

export function reviewDir(dshHome) {
  return join(dshHome, "bots", "review");
}
/** Compatibility export; invocations are now global host objects, not bot inbox mail. */
export function reviewInboxFor(dshHome, _botId) {
  return join(reviewDir(dshHome), "invocations");
}
function invocationDir(dshHome, invocationId) {
  return join(reviewInboxFor(dshHome), invocationId);
}
export function invocationManifestFile(dshHome, _botId, invocationId) {
  return join(invocationDir(dshHome, invocationId), "manifest.json");
}
export function invocationPartsFile(dshHome, _botId, invocationId) {
  return join(invocationDir(dshHome, invocationId), "parts.json");
}
/** Compatibility name: the path is now a one-event-per-file directory. */
export function invocationEventsFile(dshHome, _botId, invocationId) {
  return join(invocationDir(dshHome, invocationId), "events");
}
export function invocationLeaseFile(dshHome, _botId, invocationId) {
  return join(invocationDir(dshHome, invocationId), "lease.json");
}

export const INVOCATION_EVENT_TYPES = [
  "created", "claimed", "attempt-failed", "retry-wait", "pending",
  "completed", "dead-letter", "requeued", "expired", "cancelled", "quarantined"
];
export const INVOCATION_MANIFEST_KEYS = [
  "invocationId", "taskId", "reviewCycle", "artifactId", "artifactIds", "stage",
  "targetReviewer", "createdBy", "createdAt", "idempotencyKey", "sourceSnapshotId",
  "partsFile", "partsHash", "bodyHash", "maxAttempts"
];
export const INVOCATION_CREATORS = ["host-event", "user"];
export const DEAD_LETTER_MAX_ATTEMPTS = 3;
export const LEASE_DEFAULTS = { leaseMs: 60000, heartbeatMs: 15000, graceMs: 5000 };

const EVENT_RE = /^([1-9]\d*)-([A-Za-z0-9_.-]+)\.json$/;
const PROCESS_STARTED_AT = (() => {
  try {
    const stat = readFileSync(`/proc/${process.pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    return `proc:${stat.slice(close + 2).trim().split(/\s+/)[19]}`;
  } catch {
    return new Date(Date.now() - Math.floor(process.uptime() * 1000)).toISOString();
  }
})();

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
function safeId(value) {
  return typeof value === "string" && value !== "" && !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}
function eventHash(event) {
  const copy = { ...event };
  delete copy.eventHash;
  return sha256(canonicalJson(copy));
}
function nextEventId() {
  return `IE-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
}

export function invocationInputHashes(parts) {
  if (!Array.isArray(parts) || parts.some((part) => typeof part !== "string")) throw new TypeError("parts 必须是字符串数组");
  const partsJson = JSON.stringify(parts);
  const body = parts.join("\n");
  return {
    partsHash: sha256(Buffer.from(partsJson, "utf8")),
    bodyHash: sha256(Buffer.from(body, "utf8"))
  };
}

function normalizeCreator(createdBy) {
  return createdBy === "host" ? "host-event" : createdBy;
}
function validateManifest(manifest, invocationId) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return "manifest 非对象";
  for (const key of Object.keys(manifest)) if (!INVOCATION_MANIFEST_KEYS.includes(key)) return `manifest 含未允许键 ${key}`;
  for (const key of INVOCATION_MANIFEST_KEYS) if (!(key in manifest)) return `manifest 缺必填键 ${key}`;
  if (manifest.invocationId !== invocationId || !safeId(invocationId)) return "invocationId 与目录名不一致或不安全";
  if (typeof manifest.taskId !== "string" || manifest.taskId === "") return "taskId 非空字符串";
  if (!Number.isInteger(manifest.reviewCycle) || manifest.reviewCycle < 1) return "reviewCycle 非正整数";
  if (!safeId(manifest.artifactId) || !Array.isArray(manifest.artifactIds) || manifest.artifactIds.length < 1 || manifest.artifactIds.some((id) => !safeId(id))) return "artifactIds 非空安全字符串数组";
  if (manifest.artifactIds[0] !== manifest.artifactId || new Set(manifest.artifactIds).size !== manifest.artifactIds.length) return "artifactId/artifactIds 绑定或唯一性非法";
  if (typeof manifest.stage !== "string" || manifest.stage === "") return "stage 非空字符串";
  if (typeof manifest.targetReviewer !== "string" || manifest.targetReviewer === "") return "targetReviewer 非空字符串";
  if (!INVOCATION_CREATORS.includes(manifest.createdBy)) return `createdBy 非法（${manifest.createdBy}）`;
  if (typeof manifest.createdAt !== "string" || !Number.isFinite(Date.parse(manifest.createdAt))) return "createdAt 非合法时间";
  if (typeof manifest.idempotencyKey !== "string" || manifest.idempotencyKey === "") return "idempotencyKey 非空字符串";
  if (manifest.sourceSnapshotId !== null && (typeof manifest.sourceSnapshotId !== "string" || manifest.sourceSnapshotId === "")) return "sourceSnapshotId 必须为 null 或非空字符串";
  if (manifest.partsFile !== "parts.json") return "partsFile 与布局不符";
  if (![manifest.partsHash, manifest.bodyHash].every((hash) => typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash))) return "输入 hash 非法";
  if (manifest.maxAttempts !== DEAD_LETTER_MAX_ATTEMPTS) return `maxAttempts 必须为 ${DEAD_LETTER_MAX_ATTEMPTS}`;
  return null;
}

export function readInvocationManifest(dshHome, botId, invocationId) {
  const file = invocationManifestFile(dshHome, botId, invocationId);
  if (!existsSync(file)) return null;
  let manifest;
  try { manifest = JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(`invocation manifest 不可解析（${file}）`); }
  const invalid = validateManifest(manifest, invocationId);
  if (invalid) throw new Error(`invocation manifest 非法：${invalid}`);
  return manifest;
}
export function readInvocationParts(dshHome, botId, invocationId) {
  const file = invocationPartsFile(dshHome, botId, invocationId);
  if (!existsSync(file)) return null;
  let parts;
  try { parts = JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(`invocation parts 不可解析（${file}）`); }
  if (!Array.isArray(parts) || parts.some((part) => typeof part !== "string")) throw new Error("invocation parts schema 损坏");
  return parts;
}

function transition(status, type) {
  if (type === "created") return status === null ? "pending" : null;
  if (type === "claimed") return status === "pending" ? "claimed" : null;
  if (type === "attempt-failed") return status === "claimed" ? "claimed" : null;
  if (type === "retry-wait") return status === "claimed" ? "retry-wait" : null;
  if (type === "pending") return status === "retry-wait" ? "pending" : null;
  if (type === "expired") return status === "claimed" ? "retry-wait" : null;
  // F-RV-7：dead-letter 只能经 retry-wait（expired/attempt-failed 先落标）到达；
  // 禁止“claimed → dead-letter”直跳（无过期/失败标记者视为非法分支）。
  if (type === "dead-letter") return status === "retry-wait" ? "dead-letter" : null;
  if (type === "requeued") return status === "dead-letter" ? "pending" : null;
  if (type === "completed") return status === "claimed" ? "completed" : null;
  if (type === "cancelled") return ["pending", "claimed"].includes(status) ? "cancelled" : null;
  if (type === "quarantined") return "quarantined";
  return null;
}
function validateEvent(event, seq = null, eventId = null) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return "事件非对象";
  for (const key of ["seq", "eventId", "type", "at", "writerEpoch", "eventHash"]) if (!(key in event)) return `事件缺字段 ${key}`;
  if (!Number.isInteger(event.seq) || event.seq < 1 || (seq !== null && event.seq !== seq)) return "事件 seq 非法/与文件名不符";
  if (typeof event.eventId !== "string" || (eventId !== null && event.eventId !== eventId)) return "eventId 非法/与文件名不符";
  if (!INVOCATION_EVENT_TYPES.includes(event.type)) return `事件 type 非法（${String(event.type)}）`;
  if (typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at))) return "事件 at 非法";
  if (!Number.isInteger(event.writerEpoch) || event.writerEpoch < 1) return "事件 writerEpoch 非法";
  if (event.eventHash !== eventHash(event)) return "事件 eventHash 不匹配";
  return null;
}

export function foldInvocationEvents(parsedLines) {
  let lastSeq = 0;
  let status = null;
  let outputArtifactId = null;
  let outputHash = null;
  let requeueGeneration = 0;
  let attempt = 0;
  let claimOwner = null;
  const events = [];
  for (const event of parsedLines) {
    const invalid = validateEvent(event);
    if (invalid) return { ok: false, reason: invalid, corrupt: true };
    if (event.seq !== lastSeq + 1) return { ok: false, reason: `事件 seq 不连续（期望 ${lastSeq + 1}，实际 ${event.seq}）`, corrupt: true };
    const next = transition(status, event.type);
    if (next === null) return { ok: false, reason: `非法 invocation transition：${status ?? "none"} → ${event.type}`, corrupt: true };
    status = next;
    lastSeq = event.seq;
    events.push(event);
    if (event.type === "claimed") {
      claimOwner = event.claimOwner;
      attempt = event.attempt;
      requeueGeneration = event.requeueGeneration;
    }
    if (event.type === "requeued") {
      requeueGeneration = event.requeueGeneration;
      attempt = 0;
      claimOwner = null;
    }
    if (event.type === "completed") {
      outputArtifactId = event.outputArtifactId;
      outputHash = event.outputHash;
    }
  }
  return {
    ok: true,
    status: status ?? "pending",
    lastSeq,
    events,
    outputArtifactId,
    outputHash,
    requeueGeneration,
    attempt,
    claimOwner,
    completedAt: events.findLast?.((event) => event.type === "completed")?.at ?? null,
    failureCode: [...events].reverse().find((event) => event.type === "attempt-failed")?.failureCode ?? null
  };
}
function readEventDirectory(dshHome, invocationId) {
  const dir = invocationEventsFile(dshHome, null, invocationId);
  if (!existsSync(dir)) return foldInvocationEvents([]);
  const records = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith(".tmp")) return { ok: false, reason: `invocation 事件目录含非法项 ${entry.name}`, corrupt: true };
    const match = EVENT_RE.exec(entry.name);
    if (!match) return { ok: false, reason: `invocation 事件文件名非法 ${entry.name}`, corrupt: true };
    let event;
    try { event = JSON.parse(readFileSync(join(dir, entry.name), "utf8")); }
    catch { return { ok: false, reason: `invocation 事件 JSON 损坏 ${entry.name}`, corrupt: true }; }
    const invalid = validateEvent(event, Number(match[1]), match[2]);
    if (invalid) return { ok: false, reason: `${entry.name}: ${invalid}`, corrupt: true };
    records.push(event);
  }
  records.sort((a, b) => a.seq - b.seq || a.eventId.localeCompare(b.eventId));
  return foldInvocationEvents(records);
}
export function readInvocationState(dshHome, _botId, invocationId) {
  return readEventDirectory(dshHome, invocationId);
}
function assertLock(lock, dshHome) {
  const current = assertEpochCurrent(dshHome, lock.writerEpoch);
  if (!current.ok) throw new Error(current.reason);
}
function appendInvocationEvent(lock, dshHome, invocationId, type, extra = {}) {
  assertLock(lock, dshHome);
  const state = readEventDirectory(dshHome, invocationId);
  if (!state.ok) throw new Error(`invocation 事件 fail closed：${state.reason}`);
  if (transition(state.events.length === 0 ? null : state.status, type) === null) throw new Error(`非法 invocation transition：${state.status} → ${type}`);
  const event = {
    ...extra,
    seq: state.lastSeq + 1,
    eventId: nextEventId(),
    type,
    at: new Date().toISOString(),
    writerEpoch: lock.writerEpoch
  };
  event.eventHash = eventHash(event);
  const dir = invocationEventsFile(dshHome, null, invocationId);
  mkdirSync(dir, { recursive: true });
  writeFileDurable(join(dir, `${event.seq}-${event.eventId}.json`), `${JSON.stringify(event)}\n`);
  return event;
}
function quarantineInvocationLocked(lock, dshHome, invocationId, reason, extra = {}) {
  const state = readEventDirectory(dshHome, invocationId);
  if (state.ok && state.status !== "quarantined") appendInvocationEvent(lock, dshHome, invocationId, "quarantined", { reason, ...extra });
  const dir = join(reviewDir(dshHome), "quarantine", "invocation", invocationId);
  mkdirSync(dir, { recursive: true });
  writeFileDurable(join(dir, `${Date.now()}-${randomBytes(6).toString("hex")}.json`), `${JSON.stringify({
    objectType: "invocation", invocationId, reason, discoveredAt: new Date().toISOString(), writerEpoch: lock.writerEpoch, ...extra
  })}\n`);
  appendAudit(dshHome, { type: "invocation-quarantined", invocationId, reason, writerEpoch: lock.writerEpoch, ...extra });
}

let invSeq = 0;
export function nextInvocationId() {
  invSeq += 1;
  return `I-${Date.now().toString(36)}-${invSeq.toString(36)}-${sha256(`${process.pid}:${Date.now()}:${invSeq}:${Math.random()}`).slice(0, 8)}`;
}
function listInvocationIds(dshHome) {
  const root = reviewInboxFor(dshHome);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

export function createInvocation(dshHome, {
  taskId,
  artifactId,
  artifactIds = null,
  reviewCycle = 1,
  cycle = undefined,
  stage,
  targetReviewer,
  createdBy,
  idempotencyKey,
  parts,
  sourceSnapshotId = null,
  lockOpts
}) {
  const creator = normalizeCreator(createdBy);
  if (!INVOCATION_CREATORS.includes(creator)) {
    appendAudit(dshHome, { type: "invocation-denied", createdBy, reason: "创建权仅 host-event/authenticated user" });
    throw new Error(`invocation 创建权拒绝：createdBy=${createdBy}`);
  }
  if (typeof taskId !== "string" || taskId === "") throw new TypeError("taskId 非空字符串");
  const cycleValue = cycle ?? reviewCycle;
  if (!Number.isInteger(cycleValue) || cycleValue < 1) throw new TypeError("reviewCycle 非正整数");
  const inputs = artifactIds ?? [artifactId];
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.some((id) => !safeId(id)) || new Set(inputs).size !== inputs.length) throw new TypeError("artifactIds 非空唯一安全字符串数组");
  if (artifactId !== undefined && artifactId !== inputs[0]) throw new TypeError("artifactId 必须等于 artifactIds[0]");
  if (typeof stage !== "string" || stage === "") throw new TypeError("stage 非空字符串");
  if (typeof targetReviewer !== "string" || targetReviewer === "") throw new TypeError("targetReviewer 非空字符串");
  if (typeof idempotencyKey !== "string" || idempotencyKey === "") throw new TypeError("idempotencyKey 非空字符串");
  // F-RV-13 可信创建边界 admission（纵深校验；创建权门控不能替代）：
  if (!STAGES.includes(stage)) {
    throw new TypeError(`非法 stage：${String(stage)}（不在冻结 13-stage 表）`);
  }
  if (!["reviewer-lead", "reviewer-second"].includes(targetReviewer)) {
    throw new TypeError(`非法 targetReviewer：${String(targetReviewer)}（仅 reviewer-lead/reviewer-second）`);
  }
  const fixedAuthor = STAGE_AUTHORS[stage];
  if (fixedAuthor === null || fixedAuthor !== targetReviewer) {
    throw new TypeError(`stage/author/target 不匹配：stage=${stage} 作者必须为 ${fixedAuthor}（target=${targetReviewer}）`);
  }
  if (typeof sourceSnapshotId !== "string" || sourceSnapshotId === "") {
    throw new TypeError("sourceSnapshotId 必填（F-RV-13：每个 invocation 必须绑定该 cycle 的物化 source snapshot）");
  }
  if (readSnapshot(dshHome, sourceSnapshotId) === null) {
    throw new Error(`source snapshot 不存在或损坏/不完整（manifest 校验失败），拒绝创建 invocation：${sourceSnapshotId}`);
  }
  const hashes = invocationInputHashes(parts);
  const lock = acquireStoreLock(dshHome, lockOpts);
  try {
    assertLock(lock, dshHome);
    for (const existingId of listInvocationIds(dshHome)) {
      const existing = readInvocationManifest(dshHome, targetReviewer, existingId);
      if (!existing) continue;
      if (existing.taskId === taskId && existing.reviewCycle === cycleValue && existing.stage === stage && existing.targetReviewer === targetReviewer) {
        const sameInputs = canonicalJson(existing.artifactIds) === canonicalJson(inputs) &&
          existing.partsHash === hashes.partsHash && existing.bodyHash === hashes.bodyHash && existing.sourceSnapshotId === sourceSnapshotId;
        if (!sameInputs) {
          appendAudit(dshHome, { type: "invocation-conflict", invocationId: existingId, writerEpoch: lock.writerEpoch, reason: "同逻辑幂等键输入集/hash 不同" });
          throw new Error(`invocation 幂等冲突：同 (taskId,cycle,stage,targetReviewer) 不同输入集（${existingId}）`);
        }
        return { invocationId: existingId, idempotent: true };
      }
    }
    // F-RV-13 非法 transition 机械拒绝：按当前 flow 状态断言 stage 是合法下一步
    // （幂等命中已先行返回——同一逻辑 invocation 的合法重放不被误拒）。
    // F-RV-4：flow 损坏 → 创建边界 fail closed（不重建、不覆盖、不登记）。
    const flowFile = flowFileFor(dshHome, taskId);
    let flow = null;
    if (existsSync(flowFile)) {
      try {
        flow = readFlow(dshHome, taskId);
      } catch (error) {
        appendAudit(dshHome, { type: "invocation-denied", createdBy, reason: `flow 损坏（fail closed）：${error instanceof Error ? error.message : String(error)}` });
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
    const allowed = expectedNextStages(flow);
    if (!allowed.includes(stage)) {
      appendAudit(dshHome, { type: "invocation-denied", createdBy, reason: `非法 transition：${stage}（task ${taskId} 当前允许：${allowed.join(",") || "无"}）` });
      throw new Error(`非法 transition（F-RV-13）：stage=${stage} 不是当前 flow 状态的合法下一步（允许：${allowed.join(",") || "无"}）`);
    }
    const invocationId = nextInvocationId();
    const manifest = {
      invocationId,
      taskId,
      reviewCycle: cycleValue,
      artifactId: inputs[0],
      artifactIds: [...inputs],
      stage,
      targetReviewer,
      createdBy: creator,
      createdAt: new Date().toISOString(),
      idempotencyKey,
      sourceSnapshotId,
      partsFile: "parts.json",
      partsHash: hashes.partsHash,
      bodyHash: hashes.bodyHash,
      maxAttempts: DEAD_LETTER_MAX_ATTEMPTS
    };
    mkdirSync(invocationDir(dshHome, invocationId), { recursive: true });
    writeFileDurable(invocationManifestFile(dshHome, targetReviewer, invocationId), `${JSON.stringify(manifest)}\n`);
    writeFileDurable(invocationPartsFile(dshHome, targetReviewer, invocationId), `${JSON.stringify(parts)}\n`);
    appendInvocationEvent(lock, dshHome, invocationId, "created", { taskId, reviewCycle: cycleValue, stage, requeueGeneration: 0 });
    return { invocationId, idempotent: false };
  } finally {
    lock.release();
  }
}

function readLease(dshHome, botId, invocationId) {
  const file = invocationLeaseFile(dshHome, botId, invocationId);
  if (!existsSync(file)) return null;
  let lease;
  try { lease = JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(`lease JSON 损坏：${file}`); }
  for (const key of ["generation", "claimEpoch", "claimOwner", "hostInstanceId", "pid", "startedAt", "claimedAt", "leaseUntil", "heartbeatAt", "attempt", "requeueGeneration", "fenceEpoch", "active"]) {
    if (!(key in lease)) throw new Error(`lease schema 损坏：缺 ${key}`);
  }
  return lease;
}
function writeLease(dshHome, botId, invocationId, lease) {
  writeFileDurable(invocationLeaseFile(dshHome, botId, invocationId), `${JSON.stringify(lease)}\n`);
}

export function claimInvocation(dshHome, {
  botId, invocationId, hostInstanceId, leaseMs = LEASE_DEFAULTS.leaseMs, lockOpts
}, extra = {}) {
  if (typeof hostInstanceId !== "string" || hostInstanceId === "") throw new TypeError("hostInstanceId 非空字符串");
  const lock = acquireStoreLock(dshHome, { ...lockOpts, hostInstanceId });
  try {
    assertLock(lock, dshHome);
    const manifest = readInvocationManifest(dshHome, botId, invocationId);
    if (!manifest) throw new Error(`invocation 不存在：${invocationId}`);
    if (manifest.targetReviewer !== botId) throw new Error(`invocation 目标 reviewer 不匹配：${invocationId}`);
    let state = readInvocationState(dshHome, botId, invocationId);
    if (!state.ok) throw new Error(`invocation 状态损坏（fail closed）：${state.reason}`);
    const previous = readLease(dshHome, botId, invocationId);
    const now = Date.now();
    if (state.status === "claimed") {
      if (previous?.active && previous.leaseUntil > now) return { claimed: false, invocationId, lease: previous, reason: "lease-holder" };
      if (!extra.force) return { claimed: false, invocationId, lease: previous, reason: "lease-expired-await-recovery" };
      const nextAttempt = (previous?.attempt ?? state.attempt) + 1;
      appendInvocationEvent(lock, dshHome, invocationId, "expired", { previousClaim: previous?.claimOwner ?? null, generation: previous?.generation ?? null, failureCode: "lease-expired" });
      if (nextAttempt >= manifest.maxAttempts) {
        appendInvocationEvent(lock, dshHome, invocationId, "dead-letter", { attempt: nextAttempt, requeueGeneration: state.requeueGeneration, failureCode: "lease-expired" });
        if (previous) writeLease(dshHome, botId, invocationId, { ...previous, active: false, fenceEpoch: lock.writerEpoch });
        return { claimed: false, invocationId, reason: "dead-letter" };
      }
      appendInvocationEvent(lock, dshHome, invocationId, "pending", { attempt: nextAttempt, requeueGeneration: state.requeueGeneration });
      state = readInvocationState(dshHome, botId, invocationId);
    }
    if (state.status !== "pending") return { claimed: false, invocationId, lease: previous, reason: `status=${state.status}` };
    const generation = (previous?.generation ?? 0) + 1;
    const attempt = state.attempt + 1;
    const claimedAt = new Date().toISOString();
    const lease = {
      generation,
      claimEpoch: lock.writerEpoch,
      claimOwner: hostInstanceId,
      hostInstanceId,
      pid: process.pid,
      startedAt: PROCESS_STARTED_AT,
      claimedAt,
      leaseUntil: now + leaseMs,
      heartbeatAt: claimedAt,
      attempt,
      requeueGeneration: state.requeueGeneration,
      fenceEpoch: lock.writerEpoch,
      active: true
    };
    writeLease(dshHome, botId, invocationId, lease);
    appendInvocationEvent(lock, dshHome, invocationId, "claimed", {
      generation,
      claimEpoch: lock.writerEpoch,
      claimOwner: hostInstanceId,
      hostInstanceId,
      pid: process.pid,
      startedAt: PROCESS_STARTED_AT,
      leaseUntil: lease.leaseUntil,
      attempt,
      requeueGeneration: state.requeueGeneration
    });
    return { claimed: true, invocationId, lease };
  } finally {
    lock.release();
  }
}

export function heartbeatInvocation(dshHome, {
  botId, invocationId, hostInstanceId, generation = null,
  leaseMs = LEASE_DEFAULTS.leaseMs, lockOpts
}) {
  const lock = acquireStoreLock(dshHome, { ...lockOpts, hostInstanceId });
  try {
    assertLock(lock, dshHome);
    const lease = readLease(dshHome, botId, invocationId);
    const now = Date.now();
    const owned = lease?.active === true && lease.hostInstanceId === hostInstanceId &&
      lease.pid === process.pid && lease.startedAt === PROCESS_STARTED_AT &&
      (generation === null || generation === lease.generation) && lease.leaseUntil > now;
    if (!owned) {
      appendAudit(dshHome, { type: "invocation-heartbeat-stale", invocationId, hostInstanceId, generation, writerEpoch: lock.writerEpoch });
      return { ok: false, reason: "lease 不存在、已过期/回收或不属于本 host generation" };
    }
    const heartbeatAt = new Date().toISOString();
    const updated = { ...lease, heartbeatAt, leaseUntil: now + leaseMs, fenceEpoch: lock.writerEpoch };
    writeLease(dshHome, botId, invocationId, updated);
    return { ok: true, leaseUntil: updated.leaseUntil, expiresAt: updated.leaseUntil, generation: updated.generation };
  } finally {
    lock.release();
  }
}

/**
 * F-RV-25（返修要点 5·L1 交叉验证）：该 bot 是否当前持有以其为 targetReviewer 的
 * 活态 claimed invocation。判定链（任一不满足 → 不构成持有，fail closed）：
 * ① invocation state 必须为 claimed（completed/retry-wait/cancelled/expired 不构成）；
 * ② lease 与最新 claimed 事件身份字段全字段一致（generation/claimEpoch/claimOwner/
 *    hostInstanceId/pid/startedAt）；leaseUntil 单调不减（heartbeat 不落事件，同一
 *    generation/claimEpoch 下心跳合法延展；回退或换代即失配）；
 * ③ lease active 且未过期。
 * 事件/lease/manifest 损坏 → 不构成持有。lease 来源为宿主身份认证级信任
 * （claimInvocation 受信链），非密码学证明——host-authenticated proof 与 capability
 * secret 同 OS 用户可读合并登记 P6-4。
 */
export function currentClaimedInvocation(dshHome, botId) {
  if (typeof botId !== "string" || botId === "") return null;
  let found = null;
  for (const invocationId of listInvocationIds(dshHome)) {
    if (!existsSync(invocationLeaseFile(dshHome, botId, invocationId))) continue;
    let manifest;
    try { manifest = readInvocationManifest(dshHome, botId, invocationId); }
    catch { continue; }
    if (!manifest || manifest.targetReviewer !== botId) continue;
    let state;
    try { state = readInvocationState(dshHome, botId, invocationId); }
    catch { continue; }
    if (!state?.ok || state.status !== "claimed") continue;
    let lease;
    try { lease = readLease(dshHome, botId, invocationId); }
    catch { continue; }
    const claimed = [...(state.events ?? [])].reverse().find((event) => event.type === "claimed");
    if (!claimed) continue;
    const consistent = claimed.generation === lease.generation
      && claimed.claimEpoch === lease.claimEpoch
      && claimed.claimOwner === lease.claimOwner
      && claimed.hostInstanceId === lease.hostInstanceId
      && claimed.pid === lease.pid
      && claimed.startedAt === lease.startedAt
      && Number.isFinite(claimed.leaseUntil) && Number.isFinite(lease.leaseUntil)
      && lease.leaseUntil >= claimed.leaseUntil;
    if (!consistent) continue;
    if (lease.active === true && lease.leaseUntil > Date.now()) {
      // 多 invocation 上下文不一致 → fail closed（授权锚点不唯一，拒绝签发/绑定）。
      if (found) return null;
      found = { invocationId, manifest };
    }
  }
  return found;
}

export function botHoldsInvocationLease(dshHome, botId) {
  return currentClaimedInvocation(dshHome, botId) !== null;
}

function outputArtifactIdFor(invocationId) {
  return `O-${sha256(`invocation-output:${invocationId}`).slice(0, 32)}`;
}
function writeOutputArtifactLocked(lock, dshHome, manifest, invocationId, outputText, expectedHash) {
  assertLock(lock, dshHome);
  const outputArtifactId = outputArtifactIdFor(invocationId);
  const body = Buffer.from(outputText, "utf8");
  const outputHash = sha256(body);
  if (outputHash !== expectedHash) throw new Error("runner 输出 hash 在最终提交窗口发生变化");
  const dir = artifactDirFor(dshHome, outputArtifactId);
  const bodyFile = bodyFileFor(dshHome, outputArtifactId);
  const manifestFile = manifestFileFor(dshHome, outputArtifactId);
  if (existsSync(bodyFile) || existsSync(manifestFile)) {
    let existing = null;
    try { existing = JSON.parse(readFileSync(manifestFile, "utf8")); } catch { /* conflict below */ }
    const integrity = existing ? verifyArtifactIntegrity(dshHome, outputArtifactId, existing) : { ok: false, reason: "output artifact pair 不完整" };
    if (!integrity.ok || existing.sha256 !== outputHash || existing.byteLength !== body.length || existing.taskId !== manifest.taskId || existing.stage !== manifest.stage || existing.authorBotId !== "host") {
      quarantineArtifact(dshHome, outputArtifactId, `invocation ${invocationId} 出现不同或损坏的唯一输出`, { invocationId, incomingHash: outputHash });
      throw new Error(`同 invocation 已存在不同输出 hash，已隔离：${invocationId}`);
    }
    return { outputArtifactId, outputHash, byteLength: body.length, idempotent: true };
  }
  mkdirSync(dir, { recursive: true });
  const createdAt = new Date().toISOString();
  const outputManifest = {
    artifactId: outputArtifactId,
    taskId: manifest.taskId,
    stage: manifest.stage,
    authorBotId: "host",
    createdAt,
    bodyPath: bodyFile,
    sha256: outputHash,
    byteLength: body.length
  };
  writeFileDurable(bodyFile, body);
  writeFileDurable(manifestFile, `${JSON.stringify(outputManifest)}\n`);
  const verified = verifyArtifactIntegrity(dshHome, outputArtifactId, outputManifest);
  if (!verified.ok) throw new Error(`output artifact 完整性失败：${verified.reason}`);
  return { outputArtifactId, outputHash, byteLength: body.length, idempotent: false };
}
function staleResultLocked(lock, dshHome, invocationId, reason, detail = {}) {
  appendAudit(dshHome, { type: "invocation-stale-output-rejected", invocationId, reason, writerEpoch: lock.writerEpoch, ...detail });
  return { status: "stale", invocationId, reason };
}

export async function runInvocation(dshHome, {
  botId, invocationId, hostInstanceId,
  runner, leaseMs = LEASE_DEFAULTS.leaseMs, lockOpts
}) {
  if (typeof runner !== "function") throw new TypeError("runner 必须为函数");
  const claim = claimInvocation(dshHome, { botId, invocationId, hostInstanceId, leaseMs, lockOpts });
  if (!claim.claimed) throw new Error(`claim 失败：${claim.reason}`);
  const claimToken = { ...claim.lease };
  const manifest = readInvocationManifest(dshHome, botId, invocationId);
  const parts = readInvocationParts(dshHome, botId, invocationId);
  const hashes = invocationInputHashes(parts);
  if (hashes.partsHash !== manifest.partsHash || hashes.bodyHash !== manifest.bodyHash) {
    const lock = acquireStoreLock(dshHome, { ...lockOpts, hostInstanceId });
    try {
      quarantineInvocationLocked(lock, dshHome, invocationId, "parts 与 manifest 两级 hash 不符");
      writeLease(dshHome, botId, invocationId, { ...claimToken, active: false, fenceEpoch: lock.writerEpoch });
    } finally { lock.release(); }
    throw new Error(`invocation 输入钉扎不符（parts/body hash 不一致）：${invocationId}`);
  }

  let result;
  try { result = await runner(parts.join("\n")); }
  catch (error) { result = { error: error instanceof Error ? error.message : String(error) }; }

  const endLock = acquireStoreLock(dshHome, { ...lockOpts, hostInstanceId });
  try {
    assertLock(endLock, dshHome);
    const lease = readLease(dshHome, botId, invocationId);
    const state = readInvocationState(dshHome, botId, invocationId);
    const leaseOwned = lease?.active === true &&
      lease.generation === claimToken.generation &&
      lease.claimEpoch === claimToken.claimEpoch &&
      lease.claimOwner === hostInstanceId && lease.hostInstanceId === hostInstanceId &&
      lease.pid === process.pid && lease.startedAt === PROCESS_STARTED_AT &&
      lease.requeueGeneration === claimToken.requeueGeneration &&
      state.ok && state.status === "claimed";
    if (!leaseOwned || lease.leaseUntil <= Date.now()) {
      return staleResultLocked(endLock, dshHome, invocationId, "claim generation/owner/epoch 已过期或被接管", {
        claimGeneration: claimToken.generation,
        currentGeneration: lease?.generation ?? null,
        claimEpoch: claimToken.claimEpoch,
        currentClaimEpoch: lease?.claimEpoch ?? null
      });
    }
    // The store lock itself is the final serialization point. Its current epoch is
    // asserted above; the immutable claimEpoch must still be the lease's claimEpoch.
    const epochProof = assertEpochCurrent(dshHome, endLock.writerEpoch);
    if (!epochProof.ok || lease.claimEpoch !== claimToken.claimEpoch) {
      return staleResultLocked(endLock, dshHome, invocationId, epochProof.reason ?? "claimEpoch 已变化");
    }

    if (result?.error !== undefined) {
      const failureCode = "runner-error";
      appendInvocationEvent(endLock, dshHome, invocationId, "attempt-failed", {
        attempt: claimToken.attempt,
        requeueGeneration: claimToken.requeueGeneration,
        failureCode,
        error: String(result.error).slice(0, 500)
      });
      appendInvocationEvent(endLock, dshHome, invocationId, "retry-wait", {
        attempt: claimToken.attempt,
        requeueGeneration: claimToken.requeueGeneration,
        failureCode
      });
      if (claimToken.attempt >= manifest.maxAttempts) {
        appendInvocationEvent(endLock, dshHome, invocationId, "dead-letter", {
          attempt: claimToken.attempt,
          requeueGeneration: claimToken.requeueGeneration,
          failureCode
        });
        writeLease(dshHome, botId, invocationId, { ...lease, active: false, fenceEpoch: endLock.writerEpoch });
        appendAudit(dshHome, { type: "invocation-dead-letter", invocationId, attempt: claimToken.attempt, writerEpoch: endLock.writerEpoch });
        return { status: "dead-letter", invocationId, attempts: claimToken.attempt };
      }
      appendInvocationEvent(endLock, dshHome, invocationId, "pending", {
        attempt: claimToken.attempt,
        requeueGeneration: claimToken.requeueGeneration
      });
      writeLease(dshHome, botId, invocationId, { ...lease, active: false, fenceEpoch: endLock.writerEpoch });
      return { status: "retry-wait", invocationId, attempts: claimToken.attempt };
    }

    const outputText = typeof result?.text === "string" ? result.text : "";
    const outputHash = sha256(Buffer.from(outputText, "utf8"));
    const existingCompleted = state.events.find((event) => event.type === "completed");
    if (existingCompleted && existingCompleted.outputHash !== outputHash) {
      quarantineInvocationLocked(endLock, dshHome, invocationId, "同 invocation 出现不同 completed 输出 hash", {
        existingHash: existingCompleted.outputHash,
        incomingHash: outputHash
      });
      return { status: "quarantined", invocationId };
    }
    let output;
    try {
      output = writeOutputArtifactLocked(endLock, dshHome, manifest, invocationId, outputText, outputHash);
    } catch (error) {
      quarantineInvocationLocked(endLock, dshHome, invocationId, error.message, { incomingHash: outputHash });
      writeLease(dshHome, botId, invocationId, { ...lease, active: false, fenceEpoch: endLock.writerEpoch });
      return { status: "quarantined", invocationId, reason: error.message };
    }
    appendInvocationEvent(endLock, dshHome, invocationId, "completed", {
      outputArtifactId: output.outputArtifactId,
      outputHash: output.outputHash,
      byteLength: output.byteLength,
      sessionId: result?.sessionId ?? null,
      runnerPid: result?.pid ?? null,
      hostInstanceId,
      generation: claimToken.generation,
      claimEpoch: claimToken.claimEpoch,
      requeueGeneration: claimToken.requeueGeneration
    });
    writeLease(dshHome, botId, invocationId, { ...lease, active: false, fenceEpoch: endLock.writerEpoch });
    return {
      status: "completed",
      invocationId,
      outputArtifactId: output.outputArtifactId,
      outputHash: output.outputHash,
      byteLength: output.byteLength
    };
  } finally {
    endLock.release();
  }
}

export function requeueInvocation(dshHome, { botId, invocationId, requestedBy, authenticated = false, lockOpts }) {
  // F-RV-6：默认拒绝——authenticated 只能来自宿主注入的已认证 principal；
  // 调用方传入的布尔不被默认信任（缺省即拒绝）。
  if (requestedBy !== "user" || authenticated !== true) {
    throw new Error("requeue 仅 authenticated user 可显式发起（默认拒绝，F-RV-6）");
  }
  const lock = acquireStoreLock(dshHome, lockOpts);
  try {
    assertLock(lock, dshHome);
    const state = readInvocationState(dshHome, botId, invocationId);
    if (!state.ok) throw new Error(`invocation 状态损坏：${state.reason}`);
    if (state.status !== "dead-letter") return { ok: false, reason: `状态 ${state.status} 不可 requeue（仅 dead-letter）` };
    const requeueGeneration = state.requeueGeneration + 1;
    appendInvocationEvent(lock, dshHome, invocationId, "requeued", { requestedBy: "user", requeueGeneration });
    const lease = readLease(dshHome, botId, invocationId);
    if (lease) writeLease(dshHome, botId, invocationId, { ...lease, active: false, requeueGeneration, fenceEpoch: lock.writerEpoch });
    appendAudit(dshHome, { type: "invocation-requeued", invocationId, requestedBy: "user", requeueGeneration, writerEpoch: lock.writerEpoch });
    return { ok: true, invocationId, requeueGeneration };
  } finally {
    lock.release();
  }
}

export function expireStaleLeases(dshHome, { hostInstanceId = "lease-reaper", lockOpts } = {}) {
  const lock = acquireStoreLock(dshHome, { ...lockOpts, hostInstanceId });
  const expired = [];
  try {
    assertLock(lock, dshHome);
    for (const invocationId of listInvocationIds(dshHome)) {
      const manifest = readInvocationManifest(dshHome, null, invocationId);
      const state = readInvocationState(dshHome, null, invocationId);
      if (!state.ok || state.status !== "claimed") continue;
      const lease = readLease(dshHome, null, invocationId);
      if (!lease?.active || lease.leaseUntil > Date.now()) continue;
      const attempt = lease.attempt;
      appendInvocationEvent(lock, dshHome, invocationId, "expired", {
        previousClaim: lease.claimOwner,
        generation: lease.generation,
        attempt,
        requeueGeneration: lease.requeueGeneration,
        failureCode: "lease-expired"
      });
      if (attempt >= manifest.maxAttempts) {
        appendInvocationEvent(lock, dshHome, invocationId, "dead-letter", {
          attempt,
          requeueGeneration: lease.requeueGeneration,
          failureCode: "lease-expired"
        });
      } else {
        appendInvocationEvent(lock, dshHome, invocationId, "pending", {
          attempt,
          requeueGeneration: lease.requeueGeneration
        });
      }
      writeLease(dshHome, null, invocationId, { ...lease, active: false, fenceEpoch: lock.writerEpoch });
      appendAudit(dshHome, { type: "invocation-lease-expired", invocationId, generation: lease.generation, claimEpoch: lease.claimEpoch, writerEpoch: lock.writerEpoch });
      expired.push({ botId: manifest.targetReviewer, invocationId, generation: lease.generation });
    }
    return expired;
  } finally {
    lock.release();
  }
}
