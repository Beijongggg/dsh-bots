/**
 * 评审单 store（v1 评审形态）。通用原语（锁／原子写／audit／事件溯源／幂等键）
 * 已拆入组织层共用件 lib/org/store-base.js（org-v2 02 号票，纯增量重构、语义
 * 零变化）；本文件保留评审特有面（工件布局／manifest／quarantine／提交流／
 * 崩溃 reconcile）并作评审消费者的稳定门面。
 */
import { randomBytes } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, writeSync
} from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";

import {
  appendAuditEntry, canonicalJson, createEventSourcing,
  createReservationIndex, eventHashFor, acquireStoreLock as baseAcquireStoreLock,
  canonicalValue, fsyncDirectory, readAuditFailClosed, readJsonl, readWriterEpoch,
  requireLockOwnership, reservationKeyHash, safeObjectId, sha256Hex, utf8Bytes,
  writeFileDurable, EVENT_FILE_RE
} from "./org/store-base.js";

// ---------------- 增长策略（冻结 2026-09-04，终版全量质量评审处置项） ----------------
// audit.jsonl 与 per-invocation events 属评审证据面：append-only、**无自动轮转/
// 删除**（证据完整性优先于体积）；归档属人工/授权批次动作（如 dev-shm-salvage
// 先例），不得以体积理由程序化清理。capability nonce 消费记录是唯一例外——由
// lib/org/capability-base.js cleanupExpiredNoncesIn 按 30 天保留期自动清理
// （F-RV-11 规划项落地；安全性依据见该函数注释）。

// ---------------- paths ----------------

export function reviewDir(dshHome) {
  return join(dshHome, "bots", "review");
}
export function spoolDir(dshHome) {
  // Compatibility name: the frozen P0.6 store has no extra `spool/` layer.
  return reviewDir(dshHome);
}
export function artifactsDir(dshHome) {
  return join(spoolDir(dshHome), "artifacts");
}
export function quarantineDir(dshHome) {
  return join(spoolDir(dshHome), "quarantine");
}
export function artifactDirFor(dshHome, artifactId) {
  return join(artifactsDir(dshHome), artifactId);
}
export function bodyFileFor(dshHome, artifactId) {
  return join(artifactDirFor(dshHome, artifactId), "body.md");
}
export function manifestFileFor(dshHome, artifactId) {
  return join(artifactDirFor(dshHome, artifactId), "manifest.json");
}
/** Compatibility export: this now names the per-artifact events directory. */
export function eventsFileFor(dshHome, artifactId) {
  return join(artifactDirFor(dshHome, artifactId), "events");
}
/** Compatibility export: this now names the one-file-per-key reservations directory. */
export function idemFile(dshHome) {
  return join(spoolDir(dshHome), "reservations");
}
export function auditFile(dshHome) {
  return join(spoolDir(dshHome), "audit.jsonl");
}
export function lockDirFor(dshHome) {
  return join(spoolDir(dshHome), "lock");
}
export function epochFile(dshHome) {
  return join(spoolDir(dshHome), "epoch.json");
}

// ---------------- frozen constants ----------------

export const EVENT_TYPES = ["submitted", "relayed", "acknowledged", "failed", "superseded"];
export const MANIFEST_KEYS = [
  "artifactId", "taskId", "stage", "authorBotId", "createdAt",
  "bodyPath", "sha256", "byteLength", "sourceSnapshotId"
];
// F-RV-20：sourceSnapshotId 为可选键（存在即须为非空字符串）；fix-report 侧由
// reportFix 强制等于 job.sourceSnapshotId，其余 stage 暂不强制。
const MANIFEST_REQUIRED = MANIFEST_KEYS.filter((key) => key !== "sourceSnapshotId");

// ---------------- common helpers（原语＝组织层共用件，此处仅转发） ----------------

export { canonicalJson, canonicalValue, readJsonl, sha256Hex, utf8Bytes, writeFileDurable };

// ---------------- lock（评审锁域＝共用件锁语义＋评审默认坐标） ----------------

/**
 * 评审单写锁：lib/org/store-base.js 的参数化锁＋评审默认锁域（lock/epoch/audit
 * 三坐标缺省落在评审目录下）。opts 可逐项覆盖（capability 状态锁先例）。
 */
export function acquireStoreLock(dshHome, opts = {}) {
  const merged = { ...opts };
  if (!merged.lockDir) merged.lockDir = lockDirFor(dshHome);
  if (!merged.epochFile) merged.epochFile = epochFile(dshHome);
  if (!merged.auditFile) merged.auditFile = auditFile(dshHome);
  return baseAcquireStoreLock(dshHome, merged);
}

export function currentEpoch(dshHome) {
  return readWriterEpoch(epochFile(dshHome));
}
export function assertEpochCurrent(dshHome, epoch) {
  let now;
  try { now = readWriterEpoch(epochFile(dshHome)); }
  catch (error) { return { ok: false, reason: error.message }; }
  return now === epoch
    ? { ok: true }
    : { ok: false, reason: `writerEpoch 已从 ${String(epoch)} 推进到 ${String(now)}（被接管），延迟写入拒绝（fencing）` };
}
function requireCurrentEpoch(lock, dshHome, operation, detail = {}) {
  return requireLockOwnership(lock, {
    ownerDir: lockDirFor(dshHome), epochPath: epochFile(dshHome), auditFile: auditFile(dshHome)
  }, operation, detail);
}

// ---------------- manifest and integrity ----------------

function validateManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return { ok: false, reason: "manifest 非对象" };
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_KEYS.includes(key)) return { ok: false, reason: `manifest 含未允许键 ${key}（additionalProperties=false）` };
  }
  for (const key of MANIFEST_REQUIRED) {
    if (!(key in manifest)) return { ok: false, reason: `manifest 缺必填键 ${key}` };
  }
  if ("sourceSnapshotId" in manifest
    && (typeof manifest.sourceSnapshotId !== "string" || manifest.sourceSnapshotId === "")) {
    return { ok: false, reason: "manifest.sourceSnapshotId 存在时必须为非空字符串" };
  }
  if (!safeObjectId(manifest.artifactId)) return { ok: false, reason: "artifactId 非空安全字符串" };
  if (typeof manifest.taskId !== "string" || manifest.taskId === "") return { ok: false, reason: "taskId 非空字符串" };
  if (typeof manifest.stage !== "string" || manifest.stage === "") return { ok: false, reason: "stage 非空字符串" };
  if (typeof manifest.authorBotId !== "string" || manifest.authorBotId === "") return { ok: false, reason: "authorBotId 非空字符串" };
  if (typeof manifest.createdAt !== "string" || !Number.isFinite(Date.parse(manifest.createdAt))) return { ok: false, reason: "createdAt 非合法时间" };
  if (typeof manifest.bodyPath !== "string" || !isAbsolute(manifest.bodyPath)) return { ok: false, reason: "bodyPath 必须为绝对路径" };
  if (typeof manifest.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(manifest.sha256)) return { ok: false, reason: "sha256 须为 64 位小写 hex" };
  if (!Number.isInteger(manifest.byteLength) || manifest.byteLength < 0) return { ok: false, reason: "byteLength 须为非负整数" };
  return { ok: true };
}

export function readManifest(dshHome, artifactId) {
  const file = manifestFileFor(dshHome, artifactId);
  if (!existsSync(file)) return null;
  let manifest;
  try { manifest = JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(`manifest 不可解析（${file}）`); }
  const checked = validateManifestShape(manifest);
  if (!checked.ok) throw new Error(`manifest 非法：${checked.reason}`);
  if (manifest.artifactId !== artifactId) throw new Error("manifest.artifactId 与目录名不一致");
  if (manifest.bodyPath !== bodyFileFor(dshHome, artifactId)) throw new Error("manifest.bodyPath 与布局不符（路径注入风险）");
  return manifest;
}

export function verifyArtifactIntegrity(dshHome, artifactId, manifest = null) {
  let actualManifest;
  try { actualManifest = manifest ?? readManifest(dshHome, artifactId); }
  catch (error) { return { ok: false, reason: error.message, corrupt: true }; }
  if (actualManifest === null) return { ok: false, reason: "manifest 缺失", corrupt: true };
  const bodyFile = bodyFileFor(dshHome, artifactId);
  if (!existsSync(bodyFile)) return { ok: false, reason: "正文文件缺失", corrupt: true };
  const bytes = readFileSync(bodyFile);
  const actualHash = sha256Hex(bytes);
  if (actualHash !== actualManifest.sha256) return { ok: false, reason: `sha256 不一致（manifest=${actualManifest.sha256}，实读=${actualHash}）`, corrupt: true };
  if (bytes.length !== actualManifest.byteLength) return { ok: false, reason: `byteLength 不一致（manifest=${String(actualManifest.byteLength)}，实读=${String(bytes.length)}）`, corrupt: true };
  return { ok: true };
}

// ---------------- immutable event files and folding（事件溯源核心＝共用件，评审类型表注入） ----------------

const REVIEW_EVENT_PAYLOAD_KEYS = {
  submitted: ["taskId", "stage", "idempotencyKeyHash", "reservationWriterEpoch", "recoveredByWriterEpoch"],
  relayed: ["from", "recipient", "routeId"],
  acknowledged: ["from", "recipient"],
  failed: ["reason", "from", "recipient"],
  superseded: ["reason", "supersededBy"]
};
function reviewLegalTransition(previous, next) {
  if (previous === "uncommitted") return next === "submitted";
  if (previous === "submitted") return ["relayed", "failed", "superseded"].includes(next);
  if (previous === "relayed") return ["relayed", "acknowledged", "failed", "superseded"].includes(next);
  if (previous === "acknowledged") return next === "superseded";
  return false;
}
const reviewEventCore = createEventSourcing({
  eventTypes: EVENT_TYPES,
  payloadKeysByType: REVIEW_EVENT_PAYLOAD_KEYS,
  legalTransition: reviewLegalTransition
});
export const foldEvents = reviewEventCore.foldEvents;
const validateEventRecord = reviewEventCore.validateEventRecord;

function readEventDirectory(dshHome, artifactId) {
  const dir = eventsFileFor(dshHome, artifactId);
  if (!existsSync(dir)) return foldEvents([]);
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch (error) { return { ok: false, reason: `事件目录不可读：${error.message}`, corrupt: true }; }
  const records = [];
  for (const entry of entries) {
    if (!entry.isFile()) return { ok: false, reason: `事件目录含非文件项 ${entry.name}`, corrupt: true };
    if (entry.name.endsWith(".tmp")) return { ok: false, reason: `事件目录存在未 reconcile 的 tmp：${entry.name}`, corrupt: true };
    const match = EVENT_FILE_RE.exec(entry.name);
    if (!match) return { ok: false, reason: `事件文件名非法：${entry.name}`, corrupt: true };
    const seq = Number(match[1]);
    const eventId = match[2];
    let event;
    try { event = JSON.parse(readFileSync(join(dir, entry.name), "utf8")); }
    catch { return { ok: false, reason: `事件 JSON 损坏：${entry.name}`, corrupt: true }; }
    const checked = validateEventRecord(event, seq, eventId);
    if (!checked.ok) return { ok: false, reason: `${entry.name}: ${checked.reason}`, corrupt: true };
    records.push(event);
  }
  records.sort((a, b) => a.seq - b.seq || a.eventId.localeCompare(b.eventId));
  return foldEvents(records);
}

function quarantineObjectDir(dshHome, objectType, objectId) {
  return join(quarantineDir(dshHome), objectType, objectId);
}
function readQuarantineMarker(dshHome, objectType, objectId) {
  const dir = quarantineObjectDir(dshHome, objectType, objectId);
  if (!existsSync(dir)) return null;
  try {
    const names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
    if (names.length === 0) return { reason: "quarantine 目录存在但无有效引用记录", corrupt: true };
    const latest = JSON.parse(readFileSync(join(dir, names[names.length - 1]), "utf8"));
    return latest;
  } catch (error) {
    return { reason: `quarantine 引用不可读：${error.message}`, corrupt: true };
  }
}

export function readArtifactState(dshHome, artifactId) {
  const marker = readQuarantineMarker(dshHome, "artifact", artifactId);
  if (marker) return { ok: false, reason: `对象已隔离：${marker.reason}`, corrupt: true, quarantined: true };
  if (!existsSync(artifactDirFor(dshHome, artifactId))) return foldEvents([]);
  const integrity = verifyArtifactIntegrity(dshHome, artifactId);
  if (!integrity.ok) return { ok: false, reason: integrity.reason, corrupt: true };
  return readEventDirectory(dshHome, artifactId);
}

function evidenceHashForDirectory(dir) {
  if (!existsSync(dir)) return sha256Hex("missing-source");
  if (statSync(dir).isFile()) return sha256Hex(readFileSync(dir));
  const evidence = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(current, entry.name);
      const rel = relative(dir, full);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) evidence.push([rel, sha256Hex(readFileSync(full))]);
      else evidence.push([rel, "non-regular"]);
    }
  }
  try { walk(dir); } catch (error) { evidence.push(["read-error", sha256Hex(String(error.message))]); }
  return sha256Hex(canonicalJson(evidence));
}
function appendQuarantineReference(dshHome, objectType, objectId, reason, extra = {}) {
  const sourcePath = objectType === "artifact" ? artifactDirFor(dshHome, objectId) : (extra.sourcePath ?? null);
  const evidenceHash = typeof extra.evidenceHash === "string" && /^[0-9a-f]{64}$/.test(extra.evidenceHash)
    ? extra.evidenceHash
    : (sourcePath ? evidenceHashForDirectory(sourcePath) : sha256Hex(canonicalJson(extra.evidence ?? extra)));
  const discoveredAt = new Date().toISOString();
  const record = {
    objectType, objectId, reason, discoveredAt, evidenceHash,
    sourcePath, immutableSourcePreserved: sourcePath ? existsSync(sourcePath) : true,
    ...extra
  };
  delete record.evidence;
  const dir = quarantineObjectDir(dshHome, objectType, objectId);
  mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.json`;
  writeFileDurable(join(dir, name), `${JSON.stringify(record)}\n`);
  return { ...record, quarantinePath: join(dir, name) };
}

/** Append a quarantine reference. The immutable artifact directory is never moved or rewritten. */
export function quarantineArtifact(dshHome, artifactId, reason, extra = {}) {
  return appendQuarantineReference(dshHome, "artifact", artifactId, reason, extra);
}

// ---------------- audit（评审 audit 文件＝共用件原语） ----------------

export function appendAudit(dshHome, entry) {
  appendAuditEntry(auditFile(dshHome), entry);
}
export function readAudit(dshHome) {
  return readAuditFailClosed(auditFile(dshHome));
}

// ---------------- one-file reservations（幂等索引＝共用件原语＋评审 schema） ----------------

function requestHashFor({ taskId, stage, authorBotId, sha256, byteLength, sourceSnapshotId = null }) {
  return sha256Hex(canonicalJson({ taskId, stage, authorBotId, sha256, byteLength, sourceSnapshotId }));
}
function legacyRequestHashFor({ taskId, stage, authorBotId, sha256, byteLength }) {
  return sha256Hex(canonicalJson({ taskId, stage, authorBotId, sha256, byteLength }));
}
function validateReservation(record, keyHash) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return { ok: false, reason: "reservation 非对象" };
  const allowed = [
    "idempotencyKeyHash", "requestHash", "artifactId", "taskId", "stage", "authorBotId",
    "sha256", "byteLength", "sourceSnapshotId", "hostInstanceId", "writerEpoch", "state", "reservedAt",
    "committedAt", "rebuiltAt"
  ];
  for (const key of Object.keys(record)) if (!allowed.includes(key)) return { ok: false, reason: `reservation 含未允许键 ${key}` };
  for (const key of ["idempotencyKeyHash", "requestHash", "artifactId", "taskId", "stage", "authorBotId", "sha256", "byteLength", "hostInstanceId", "writerEpoch", "state", "reservedAt"]) {
    if (!(key in record)) return { ok: false, reason: `reservation 缺必填键 ${key}` };
  }
  if (record.idempotencyKeyHash !== keyHash) return { ok: false, reason: "reservation key hash 与文件名不符" };
  if (typeof record.requestHash !== "string" || !/^[0-9a-f]{64}$/.test(record.requestHash)) return { ok: false, reason: "reservation requestHash 非法" };
  if (!safeObjectId(record.artifactId)) return { ok: false, reason: "reservation artifactId 非法" };
  if ([record.taskId, record.stage, record.authorBotId, record.hostInstanceId].some((value) => typeof value !== "string" || value === "")) return { ok: false, reason: "reservation identity/metadata 非空字符串" };
  if (typeof record.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(record.sha256)) return { ok: false, reason: "reservation sha256 非法" };
  if (!Number.isInteger(record.byteLength) || record.byteLength < 0) return { ok: false, reason: "reservation byteLength 非法" };
  if ("sourceSnapshotId" in record
    && record.sourceSnapshotId !== null
    && (typeof record.sourceSnapshotId !== "string" || record.sourceSnapshotId === "")) {
    return { ok: false, reason: "reservation sourceSnapshotId 非法" };
  }
  if (!Number.isInteger(record.writerEpoch) || record.writerEpoch < 1) return { ok: false, reason: "reservation writerEpoch 非法" };
  if (!["reserved", "committed"].includes(record.state)) return { ok: false, reason: "reservation state 非法" };
  if (typeof record.reservedAt !== "string" || !Number.isFinite(Date.parse(record.reservedAt))) return { ok: false, reason: "reservation reservedAt 非法" };
  if (record.state === "committed" && (typeof record.committedAt !== "string" || !Number.isFinite(Date.parse(record.committedAt)))) return { ok: false, reason: "committed reservation 缺合法 committedAt" };
  return { ok: true };
}
function reservationIndexFor(dshHome) {
  return createReservationIndex({ dir: idemFile(dshHome), validate: validateReservation });
}
function readReservationByHash(dshHome, keyHash) {
  return reservationIndexFor(dshHome).readByHash(keyHash);
}
function readReservations(dshHome) {
  return reservationIndexFor(dshHome).readAll();
}
function writeReservation(dshHome, record) {
  reservationIndexFor(dshHome).write(record);
}
function commitReservation(dshHome, record) {
  return reservationIndexFor(dshHome).commit(record);
}

export class ConflictError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = "ConflictError";
    this.detail = detail;
  }
}

// ---------------- submission ----------------

let artifactSeq = 0;
export function nextArtifactId() {
  artifactSeq += 1;
  const random = sha256Hex(`${process.pid}:${Date.now()}:${artifactSeq}:${Math.random()}`).slice(0, 8);
  return `A-${Date.now().toString(36)}-${artifactSeq.toString(36)}-${random}`;
}
function nextEventId() {
  return `E-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
}
function validateSubmitInput(input) {
  if (!input || typeof input !== "object") return "input 必须是对象";
  if (typeof input.taskId !== "string" || input.taskId === "") return "taskId 非空字符串";
  if (typeof input.stage !== "string" || input.stage === "") return "stage 非空字符串";
  if (typeof input.authorBotId !== "string" || input.authorBotId === "") return "authorBotId 非空字符串";
  if (typeof input.body !== "string") return "body 必须是字符串";
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey === "") return "idempotencyKey 非空字符串";
  if (input.artifactId !== undefined && !safeObjectId(input.artifactId)) return "artifactId 非空安全字符串";
  if (input.sourceSnapshotId !== undefined
    && (typeof input.sourceSnapshotId !== "string" || input.sourceSnapshotId === "")) {
    return "sourceSnapshotId 必须为非空字符串";
  }
  return null;
}
function buildManifest(dshHome, artifactId, { taskId, stage, authorBotId, sha, byteLength, createdAt, sourceSnapshotId = null }) {
  const manifest = {
    artifactId, taskId, stage, authorBotId, createdAt,
    bodyPath: bodyFileFor(dshHome, artifactId), sha256: sha, byteLength
  };
  if (typeof sourceSnapshotId === "string" && sourceSnapshotId !== "") {
    manifest.sourceSnapshotId = sourceSnapshotId;
  }
  return manifest;
}
function writeArtifactPairDurable(dshHome, artifactId, bodyBuf, manifest) {
  const dir = artifactDirFor(dshHome, artifactId);
  mkdirSync(dir, { recursive: true });
  const bodyFile = bodyFileFor(dshHome, artifactId);
  const manifestFile = manifestFileFor(dshHome, artifactId);
  if (existsSync(bodyFile) || existsSync(manifestFile)) throw new Error(`不可变工件目标已存在，禁止覆盖：${artifactId}`);
  const nonce = `${process.pid}.${Date.now()}.${randomBytes(4).toString("hex")}`;
  const bodyTmp = `${bodyFile}.${nonce}.tmp`;
  const manifestTmp = `${manifestFile}.${nonce}.tmp`;
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  const bodyFd = openSync(bodyTmp, "wx");
  const manifestFd = openSync(manifestTmp, "wx");
  try {
    writeSync(bodyFd, bodyBuf); fsyncSync(bodyFd);
    writeSync(manifestFd, manifestBytes); fsyncSync(manifestFd);
  } finally {
    closeSync(bodyFd); closeSync(manifestFd);
  }
  renameSync(bodyTmp, bodyFile);
  renameSync(manifestTmp, manifestFile);
  fsyncDirectory(dir);
  if (!readFileSync(bodyFile).equals(bodyBuf) || !readFileSync(manifestFile).equals(manifestBytes)) {
    throw new Error(`工件 body/manifest durable 读回不一致：${artifactId}`);
  }
  const verified = verifyArtifactIntegrity(dshHome, artifactId, manifest);
  if (!verified.ok) throw new Error(`工件提交前完整性校验失败：${verified.reason}`);
}
function writeNewEventFile(dshHome, artifactId, event) {
  const dir = eventsFileFor(dshHome, artifactId);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${event.seq}-${event.eventId}.json`);
  if (existsSync(file)) throw new Error(`事件目标已存在，禁止覆盖：${file}`);
  writeFileDurable(file, `${JSON.stringify(event)}\n`);
  return file;
}
function buildEvent(seq, type, writerEpoch, extra = {}) {
  for (const key of ["seq", "eventId", "type", "at", "writerEpoch", "eventHash"]) {
    if (key in extra) throw new TypeError(`事件 extra 不得覆盖保留键 ${key}`);
  }
  const event = { ...extra, seq, eventId: nextEventId(), type, at: new Date().toISOString(), writerEpoch };
  event.eventHash = eventHashFor(event);
  return event;
}

function eventTmpTarget(name) {
  const match = /^(.*\.json)\.\d+\.\d+\.[0-9a-f]+\.tmp$/.exec(name);
  return match?.[1] ?? null;
}
/** Resolve crash-left event temp files before assigning a successor sequence. */
function reconcileEventTemps(dshHome, artifactId) {
  const dir = eventsFileFor(dshHome, artifactId);
  if (!existsSync(dir)) return { ok: true };
  const tmpNames = readdirSync(dir).filter((name) => name.endsWith(".tmp")).sort();
  for (const tmpName of tmpNames) {
    const targetName = eventTmpTarget(tmpName);
    if (!targetName || !EVENT_FILE_RE.test(targetName)) return { ok: false, reason: `无法识别事件 tmp：${tmpName}` };
    const tmpFile = join(dir, tmpName);
    const targetFile = join(dir, targetName);
    if (existsSync(targetFile)) {
      if (sha256Hex(readFileSync(tmpFile)) !== sha256Hex(readFileSync(targetFile))) return { ok: false, reason: `事件 tmp 与已提交目标冲突：${tmpName}` };
      rmSync(tmpFile, { force: true });
      fsyncDirectory(dir);
      continue;
    }
    let event;
    try { event = JSON.parse(readFileSync(tmpFile, "utf8")); }
    catch { return { ok: false, reason: `事件 tmp JSON 损坏：${tmpName}` }; }
    const match = EVENT_FILE_RE.exec(targetName);
    const checked = validateEventRecord(event, Number(match[1]), match[2]);
    if (!checked.ok) return { ok: false, reason: `事件 tmp 非法：${checked.reason}` };
    const state = readEventDirectoryIgnoringTmp(dshHome, artifactId);
    if (!state.ok || event.seq !== state.lastSeq + 1 || !reviewLegalTransition(state.status, event.type)) {
      return { ok: false, reason: `事件 tmp 前序未提交或未隔离：${tmpName}` };
    }
    renameSync(tmpFile, targetFile);
    fsyncDirectory(dir);
  }
  return { ok: true };
}
function readEventDirectoryIgnoringTmp(dshHome, artifactId) {
  const dir = eventsFileFor(dshHome, artifactId);
  if (!existsSync(dir)) return foldEvents([]);
  const records = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.endsWith(".tmp")) continue;
    if (!entry.isFile()) return { ok: false, reason: `事件目录含非文件项 ${entry.name}`, corrupt: true };
    const match = EVENT_FILE_RE.exec(entry.name);
    if (!match) return { ok: false, reason: `事件文件名非法：${entry.name}`, corrupt: true };
    let event;
    try { event = JSON.parse(readFileSync(join(dir, entry.name), "utf8")); }
    catch { return { ok: false, reason: `事件 JSON 损坏：${entry.name}`, corrupt: true }; }
    const checked = validateEventRecord(event, Number(match[1]), match[2]);
    if (!checked.ok) return { ok: false, reason: `${entry.name}: ${checked.reason}`, corrupt: true };
    records.push(event);
  }
  records.sort((a, b) => a.seq - b.seq || a.eventId.localeCompare(b.eventId));
  return foldEvents(records);
}

export function appendEventLocked(lock, dshHome, artifactId, type, extra = {}) {
  if (!EVENT_TYPES.includes(type)) throw new TypeError(`非法事件类型 ${type}`);
  const writerEpoch = requireCurrentEpoch(lock, dshHome, "event", { artifactId });
  const tempResult = reconcileEventTemps(dshHome, artifactId);
  if (!tempResult.ok) {
    quarantineArtifact(dshHome, artifactId, `事件 tmp reconcile 失败：${tempResult.reason}`);
    throw new Error(`事件 tmp reconcile 失败，工件已隔离：${tempResult.reason}`);
  }
  const state = readEventDirectory(dshHome, artifactId);
  if (!state.ok) {
    quarantineArtifact(dshHome, artifactId, `事件读取/折叠失败：${state.reason}`);
    throw new Error(`事件读取/折叠失败，工件已隔离（${artifactId}）：${state.reason}`);
  }
  if (!reviewLegalTransition(state.status, type)) {
    quarantineArtifact(dshHome, artifactId, `非法 transition：${state.status} → ${type}`);
    throw new Error(`非法 transition，工件已隔离：${state.status} → ${type}`);
  }
  const event = buildEvent(state.lastSeq + 1, type, writerEpoch, extra);
  writeNewEventFile(dshHome, artifactId, event);
  return event;
}
function appendRecoveredSubmitted(lock, dshHome, artifactId, reservation, manifest) {
  requireCurrentEpoch(lock, dshHome, "event-recovery", { artifactId });
  const tempResult = reconcileEventTemps(dshHome, artifactId);
  if (!tempResult.ok) throw new Error(tempResult.reason);
  const state = readEventDirectory(dshHome, artifactId);
  if (!state.ok || state.status !== "uncommitted") throw new Error(state.reason ?? `status=${String(state.status)}`);
  const event = buildEvent(1, "submitted", lock.writerEpoch, {
    taskId: manifest.taskId, stage: manifest.stage,
    idempotencyKeyHash: reservation.idempotencyKeyHash,
    reservationWriterEpoch: reservation.writerEpoch,
    recoveredByWriterEpoch: lock.writerEpoch
  });
  writeNewEventFile(dshHome, artifactId, event);
  return event;
}

function resumeArtifact(lock, dshHome, reservation, input, bodyBuf, sha, byteLength) {
  const artifactId = reservation.artifactId;
  const { taskId, stage, authorBotId, sourceSnapshotId = null } = input;
  let resumed = false;
  const marker = readQuarantineMarker(dshHome, "artifact", artifactId);
  if (marker) return { resumed: false, quarantined: true };

  let manifest = null;
  if (!existsSync(bodyFileFor(dshHome, artifactId)) || !existsSync(manifestFileFor(dshHome, artifactId))) {
    quarantineArtifact(dshHome, artifactId, "resume: reservation 对应 body 或 manifest 不完整");
    return { resumed: false, quarantined: true };
  }
  try { manifest = readManifest(dshHome, artifactId); }
  catch (error) {
    quarantineArtifact(dshHome, artifactId, `resume manifest 损坏：${error.message}`);
    throw new ConflictError(`manifest 非法，无法续写：${error.message}`, { artifactId });
  }
  if (manifest.taskId !== taskId || manifest.stage !== stage || manifest.authorBotId !== authorBotId
      || (manifest.sourceSnapshotId ?? null) !== sourceSnapshotId) {
    throw new ConflictError("同 artifactId 元数据冲突（taskId/stage/authorBotId 不一致）", { artifactId, manifest });
  }
  if (manifest.sha256 !== sha || manifest.byteLength !== byteLength) throw new ConflictError("同 artifactId 正文 hash 冲突", { artifactId, manifest });

  const integrity = verifyArtifactIntegrity(dshHome, artifactId, manifest);
  if (!integrity.ok) {
    quarantineArtifact(dshHome, artifactId, `resume-integrity: ${integrity.reason}`);
    throw new ConflictError(`续写时正文损坏：${integrity.reason}`, { artifactId });
  }
  let state = readEventDirectory(dshHome, artifactId);
  if (!state.ok) {
    quarantineArtifact(dshHome, artifactId, `resume-state: ${state.reason}`);
    throw new ConflictError(`续写时事件损坏：${state.reason}`, { artifactId });
  }
  if (state.status === "uncommitted") {
    appendRecoveredSubmitted(lock, dshHome, artifactId, reservation, manifest);
    resumed = true;
    state = readEventDirectory(dshHome, artifactId);
  }
  return { resumed, quarantined: false, state };
}

export function submitReviewArtifact(dshHome, input) {
  const invalid = validateSubmitInput(input);
  if (invalid) throw new TypeError(invalid);
  const { taskId, stage, authorBotId, body, idempotencyKey, artifactId: explicitId,
    sourceSnapshotId: inputSourceSnapshotId, lockOpts } = input;
  // Treat omitted optional provenance as the same logical null everywhere. This
  // keeps reservation hashes, recovery, and manifests deterministic.
  const sourceSnapshotId = inputSourceSnapshotId ?? null;
  const bodyBuf = Buffer.from(body, "utf8");
  const sha = sha256Hex(bodyBuf);
  const byteLength = bodyBuf.length;
  const keyHash = reservationKeyHash(idempotencyKey);
  const requestHash = requestHashFor({ taskId, stage, authorBotId, sha256: sha, byteLength, sourceSnapshotId });
  const lock = acquireStoreLock(dshHome, lockOpts);
  try {
    const writerEpoch = requireCurrentEpoch(lock, dshHome, "submit");
    let existing;
    try { existing = readReservationByHash(dshHome, keyHash); }
    catch (error) {
      appendAudit(dshHome, { type: "reservation-corrupt", idempotencyKeyHash: keyHash, writerEpoch, reason: error.message });
      appendQuarantineReference(dshHome, "reservation", keyHash, error.message, { sourcePath: reservationIndexFor(dshHome).fileForHash(keyHash) });
      throw error;
    }
    if (existing) {
      const legacyCompatible = inputSourceSnapshotId === undefined && existing.requestHash === legacyRequestHashFor({ taskId, stage, authorBotId, sha256: sha, byteLength });
      if (existing.requestHash !== requestHash && !legacyCompatible) {
        const existingState = readArtifactState(dshHome, existing.artifactId);
        if (!existingState.ok || existing.state !== "committed") {
          quarantineArtifact(dshHome, existing.artifactId, `幂等冲突时既有工件完整性失败：${existingState.reason ?? `reservation=${String(existing.state)}`}`);
          throw new ConflictError("idempotencyKey 已占用且既有工件不是完整 committed 状态", { artifactId: existing.artifactId });
        }
        const evidence = {
          expectedRequestHash: existing.requestHash, actualRequestHash: requestHash,
          expectedSha: existing.sha256, actualSha: sha,
          expectedBytes: existing.byteLength, actualBytes: byteLength
        };
        appendAudit(dshHome, { type: "submit-conflict", idempotencyKeyHash: keyHash, artifactId: existing.artifactId, writerEpoch, ...evidence });
        appendQuarantineReference(dshHome, "idempotency-conflict", keyHash, "同 key 不同正文", { evidence, existingArtifactId: existing.artifactId, writerEpoch });
        throw new ConflictError(`idempotencyKey 冲突：同 key 不同正文或元数据（记录 requestHash=${existing.requestHash}，本次 requestHash=${requestHash}）`, {
          key: idempotencyKey, artifactId: existing.artifactId
        });
      }
      const resumed = resumeArtifact(lock, dshHome, existing, { ...input, sourceSnapshotId }, bodyBuf, sha, byteLength);
      if (resumed.quarantined) return { artifactId: existing.artifactId, status: "quarantined", idempotent: true, resumed: false };
      commitReservation(dshHome, existing);
      const state = readArtifactState(dshHome, existing.artifactId);
      if (!state.ok) {
        quarantineArtifact(dshHome, existing.artifactId, `submit-return: ${state.reason}`);
        return { artifactId: existing.artifactId, status: "quarantined", idempotent: true, resumed: resumed.resumed };
      }
      return { artifactId: existing.artifactId, status: state.status, idempotent: true, resumed: resumed.resumed };
    }

    const artifactId = explicitId ?? nextArtifactId();
    if (existsSync(artifactDirFor(dshHome, artifactId))) {
      throw new ConflictError("显式 artifactId 的工件目录已存在但无匹配幂等预留", { artifactId });
    }
    const reservedAt = new Date().toISOString();
    const reservation = {
      idempotencyKeyHash: keyHash, requestHash, artifactId,
      taskId, stage, authorBotId, sha256: sha, byteLength, sourceSnapshotId,
      hostInstanceId: lock.hostInstanceId, writerEpoch, state: "reserved", reservedAt
    };
    writeReservation(dshHome, reservation); // durable before body/manifest
    const manifest = buildManifest(dshHome, artifactId, { taskId, stage, authorBotId, sha, byteLength, createdAt: reservedAt, sourceSnapshotId });
    writeArtifactPairDurable(dshHome, artifactId, bodyBuf, manifest);
    appendEventLocked(lock, dshHome, artifactId, "submitted", { taskId, stage, idempotencyKeyHash: keyHash });
    commitReservation(dshHome, reservation); // commit index only after submitted event
    const state = readArtifactState(dshHome, artifactId);
    if (!state.ok) {
      quarantineArtifact(dshHome, artifactId, `submit-after-commit: ${state.reason}`);
      return { artifactId, status: "quarantined", idempotent: false, resumed: false };
    }
    return { artifactId, status: state.status, idempotent: false, resumed: false };
  } finally {
    lock.release();
  }
}

export function artifactStatus(dshHome, artifactId) {
  const state = readArtifactState(dshHome, artifactId);
  return state.ok ? state.status : "quarantined";
}

// ---------------- crash reconciliation ----------------

export function reconcileSpool(dshHome) {
  const result = { resumed: [], quarantined: [], consistent: [] };
  const lock = acquireStoreLock(dshHome);
  try {
    const reservations = readReservations(dshHome);
    const byArtifact = new Map(reservations.map((record) => [record.artifactId, record]));
    const artifactIds = existsSync(artifactsDir(dshHome))
      ? readdirSync(artifactsDir(dshHome), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
      : [];

    for (const artifactId of artifactIds) {
      if (readQuarantineMarker(dshHome, "artifact", artifactId)) {
        result.quarantined.push(artifactId);
        continue;
      }
      try {
        const tempResult = reconcileEventTemps(dshHome, artifactId);
        if (!tempResult.ok) throw new Error(`tmp reconcile: ${tempResult.reason}`);
        const manifest = readManifest(dshHome, artifactId);
        if (manifest === null) throw new Error("manifest 缺失");
        const integrity = verifyArtifactIntegrity(dshHome, artifactId, manifest);
        if (!integrity.ok) throw new Error(integrity.reason);
        let state = readEventDirectory(dshHome, artifactId);
        if (!state.ok) throw new Error(state.reason);
        let reservation = byArtifact.get(artifactId) ?? null;

        if (state.status === "uncommitted") {
          if (!reservation || reservation.sha256 !== manifest.sha256 || reservation.byteLength !== manifest.byteLength) {
            throw new Error("无提交点且无匹配幂等 reservation");
          }
          appendRecoveredSubmitted(lock, dshHome, artifactId, reservation, manifest);
          commitReservation(dshHome, reservation);
          result.resumed.push(artifactId);
          continue;
        }

        const submitted = state.events[0];
        if (submitted.type !== "submitted") throw new Error("首事件不是 submitted");
        const eventKeyHash = submitted.idempotencyKeyHash;
        if (typeof eventKeyHash !== "string" || !/^[0-9a-f]{64}$/.test(eventKeyHash)) throw new Error("submitted 缺 idempotencyKeyHash");
        if (!reservation) {
          const occupied = readReservationByHash(dshHome, eventKeyHash);
          if (occupied && occupied.artifactId !== artifactId) throw new Error("submitted 对应 reservation key 已被其他工件占用");
          reservation = {
            idempotencyKeyHash: eventKeyHash,
            requestHash: requestHashFor({
              taskId: manifest.taskId, stage: manifest.stage, authorBotId: manifest.authorBotId,
              sha256: manifest.sha256, byteLength: manifest.byteLength, sourceSnapshotId: manifest.sourceSnapshotId ?? null
            }),
            artifactId, taskId: manifest.taskId, stage: manifest.stage, authorBotId: manifest.authorBotId,
            sha256: manifest.sha256, byteLength: manifest.byteLength, sourceSnapshotId: manifest.sourceSnapshotId,
            hostInstanceId: lock.hostInstanceId, writerEpoch: submitted.writerEpoch,
            state: "committed", reservedAt: submitted.at,
            committedAt: new Date().toISOString(), rebuiltAt: new Date().toISOString()
          };
          writeReservation(dshHome, reservation);
          byArtifact.set(artifactId, reservation);
        } else {
          if (reservation.idempotencyKeyHash !== eventKeyHash || reservation.sha256 !== manifest.sha256 || reservation.byteLength !== manifest.byteLength) {
            throw new Error("reservation 与 committed 工件不一致");
          }
          commitReservation(dshHome, reservation);
        }
        result.consistent.push(artifactId);
      } catch (error) {
        quarantineArtifact(dshHome, artifactId, `reconcile: ${error.message}`);
        result.quarantined.push(artifactId);
      }
    }

    for (const reservation of reservations) {
      if (!artifactIds.includes(reservation.artifactId) && !result.quarantined.includes(reservation.artifactId)) {
        quarantineArtifact(dshHome, reservation.artifactId, "reconcile: reservation 对应 body/manifest 不完整或缺失", {
          reservationHash: sha256Hex(canonicalJson(reservation))
        });
        result.quarantined.push(reservation.artifactId);
      }
    }
    return result;
  } finally {
    lock.release();
  }
}
