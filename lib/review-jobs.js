/**
 * Engineering jobs authorized exclusively by persisted authenticated decisions.
 * R2-07 deliberately does not infer authorization from review prose or caller
 * assertions: createEngineeringJob mechanically consumes review-results rows.
 */

import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  readJsonl, writeFileDurable, appendAudit, acquireStoreLock,
  readManifest, verifyArtifactIntegrity
} from "./review-store.js";
import { checkCapability } from "./review-capability.js";
import { DECISION_CHOICES, readDecisions } from "./review-results.js";
import { readSnapshot } from "./review-evidence.js";
import { readFlow } from "./review-flow.js";
import { validateFixReport } from "./review-report.js";

// ---------------- Layout ----------------

export function jobsDir(dshHome) {
  return join(dshHome, "bots", "review", "jobs");
}
export function jobFileFor(dshHome, jobId) {
  if (!safeLogicalId(jobId)) throw new TypeError("jobId 必须为安全逻辑 ID");
  return join(jobsDir(dshHome), `${jobId}.json`);
}
export function jobEventsFileFor(dshHome, jobId) {
  if (!safeLogicalId(jobId)) throw new TypeError("jobId 必须为安全逻辑 ID");
  return join(jobsDir(dshHome), `${jobId}.events.jsonl`);
}
export function jobLeaseFileFor(dshHome, jobId) {
  if (!safeLogicalId(jobId)) throw new TypeError("jobId 必须为安全逻辑 ID");
  return join(jobsDir(dshHome), `${jobId}.lease.json`);
}

// ---------------- Frozen constants ----------------

export const JOB_EVENT_TYPES = [
  "created", "claimed", "started", "fix-reported", "failed", "expired",
  "dead-lettered", "requeued"
];
export const JOB_DEFAULTS = { leaseMs: 30_000, maxAttempts: 3 };
const TERMINAL_STATUSES = new Set(["fix-reported", "dead-lettered", "failed", "cancelled", "closed"]);
const AUTHORIZED_REPAIR_CHOICE = "authorize-repair";

if (!DECISION_CHOICES.includes(AUTHORIZED_REPAIR_CHOICE)) {
  throw new Error("DECISION_CHOICES 缺少 authorize-repair，R2-07 fail closed");
}

let jobSeq = 0;
export function nextJobId() {
  jobSeq += 1;
  const rand = createHash("sha256")
    .update(`${process.pid}:${Date.now()}:job:${jobSeq}:${Math.random()}`)
    .digest("hex").slice(0, 8);
  return `J-${Date.now().toString(36)}-${jobSeq.toString(36)}-${rand}`;
}

function safeLogicalId(value) {
  return typeof value === "string" && /^[A-Za-z0-9:_-]+$/.test(value)
    && !value.includes("..");
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
function sameValue(left, right) {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}
function subset(values, allowed) {
  return Array.isArray(values) && Array.isArray(allowed) && values.every((value) => allowed.includes(value));
}
function reject(dshHome, type, reason, extra = {}) {
  appendAudit(dshHome, { type, reason, ...extra });
  return { ok: false, reason };
}

// ---------------- Event folding ----------------

const JOB_TRANSITIONS = Object.freeze({
  "created-pending": ["created"],
  created: ["claimed"],
  claimed: ["started", "fix-reported", "expired"],
  started: ["fix-reported", "expired"],
  expired: ["failed"],
  failed: ["requeued", "dead-lettered"],
  requeued: ["claimed"],
  "fix-reported": [],
  "dead-lettered": []
});

function foldJobEvents(parsedLines) {
  let lastSeq = 0;
  let status = "created-pending";
  const events = [];
  for (const line of parsedLines) {
    if (line === null || typeof line !== "object" || Array.isArray(line)) {
      return { ok: false, reason: `事件行非对象：${JSON.stringify(line)}` };
    }
    const { seq, type, at } = line;
    if (!Number.isInteger(seq) || seq !== lastSeq + 1) {
      return { ok: false, reason: `seq 不连续（期望 ${lastSeq + 1}）` };
    }
    if (!JOB_EVENT_TYPES.includes(type)) return { ok: false, reason: `type 非法（${type}）` };
    if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) return { ok: false, reason: "at 非法时间" };
    if (!JOB_TRANSITIONS[status]?.includes(type)) {
      return { ok: false, reason: `非法 job 转移：${status} → ${type}` };
    }
    lastSeq = seq;
    status = type;
    events.push(line);
  }
  return { ok: true, status, lastSeq, events };
}

export function readJobState(dshHome, jobId) {
  const rows = readJsonl(jobEventsFileFor(dshHome, jobId));
  if (rows.corrupt.length > 0) return { ok: false, reason: "job 事件 JSONL 损坏（fail closed）" };
  return foldJobEvents(rows.parsed);
}

export function readJob(dshHome, jobId) {
  const file = jobFileFor(dshHome, jobId);
  if (!existsSync(file)) return null;
  try {
    const metadata = JSON.parse(readFileSync(file, "utf8"));
    const state = readJobState(dshHome, jobId);
    if (!state.ok) return null;
    return { ...metadata, ...state };
  } catch {
    return null;
  }
}

function appendJobEvent(_lock, dshHome, jobId, type, extra = {}) {
  if (!JOB_EVENT_TYPES.includes(type)) throw new TypeError(`非法 job 事件类型 ${type}`);
  const file = jobEventsFileFor(dshHome, jobId);
  mkdirSync(dirname(file), { recursive: true });
  const rows = readJsonl(file);
  if (rows.corrupt.length > 0) throw new Error(`job 事件文件损坏（fail closed）：${jobId}`);
  const folded = foldJobEvents(rows.parsed);
  if (!folded.ok) throw new Error(`job 事件折叠失败：${folded.reason}`);
  const event = { seq: folded.lastSeq + 1, type, at: new Date().toISOString(), ...extra };
  const previous = rows.lines.length === 0 ? "" : `${rows.lines.join("\n")}\n`;
  writeFileDurable(file, `${previous}${JSON.stringify(event)}\n`);
  return event;
}

function readLease(dshHome, jobId) {
  const file = jobLeaseFileFor(dshHome, jobId);
  if (!existsSync(file)) return null;
  // F-RV-5：损坏 lease 必须 fail closed（抛错），绝不解释为“无 lease”，也绝不
  // 在未验证前覆盖原文件；恢复/隔离路径由各调用方以明确错误给出。
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`job lease 损坏（fail closed）：${file}（${error instanceof Error ? error.message : String(error)}）`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`job lease schema 损坏（fail closed）：${file}`);
  }
  return parsed;
}

/** F-RV-19 生产受信链：本 bot 是否持该 job 的有效 lease（heartbeat/report 链式签发前置）。 */
export function botHoldsActiveLease(dshHome, jobId, botId) {
  if (!safeLogicalId(jobId) || typeof botId !== "string" || botId === "") return false;
  try {
    const lease = readLease(dshHome, jobId);
    return !!lease && lease.claimOwner === botId
      && Number.isFinite(lease.leaseUntil) && lease.leaseUntil > Date.now();
  } catch {
    return false;
  }
}

// ---------------- Creation from persisted decisions ----------------

function existingJobs(dshHome) {
  if (!existsSync(jobsDir(dshHome))) return [];
  const jobs = [];
  for (const name of readdirSync(jobsDir(dshHome))) {
    if (!name.endsWith(".json") || name.endsWith(".lease.json")) continue;
    try {
      const job = JSON.parse(readFileSync(join(jobsDir(dshHome), name), "utf8"));
      if (job && typeof job === "object" && !Array.isArray(job)) jobs.push(job);
    } catch {
      throw new Error(`job metadata 损坏：${name}`);
    }
  }
  return jobs;
}

/**
 * Create exactly one job for a persisted authorize-repair decision revision.
 * Frozen job metadata contract (P0.3 line 167):
 * {jobId,taskId,decisionRevision,finalArtifactId,decisionId,engineeringBotId,
 *  authorizedFindingIds,scope,acceptanceCriteria,repairCycle,createdAt}.
 */
export function createEngineeringJob(dshHome, {
  jobId = null,
  taskId,
  decisionRevision,
  finalArtifactId = undefined,
  decisionId = undefined,
  authorizedFindingIds,
  scope,
  acceptanceCriteria,
  engineeringBotId,
  repairCycle = 1,
  sourceSnapshotId = null
}) {
  const auditExtra = { taskId, decisionRevision, engineeringBotId };
  if (!safeLogicalId(taskId)) return reject(dshHome, "job-create-rejected", "taskId 非法", auditExtra);
  if (!Number.isInteger(decisionRevision) || decisionRevision < 1) {
    return reject(dshHome, "job-create-rejected", "decisionRevision 必须为正整数", auditExtra);
  }
  if (!safeLogicalId(engineeringBotId)) {
    return reject(dshHome, "job-create-rejected", "engineeringBotId 必填且必须为安全逻辑 ID", auditExtra);
  }
  if (!Number.isInteger(repairCycle) || repairCycle < 1) {
    return reject(dshHome, "job-create-rejected", "repairCycle 必须为正整数", auditExtra);
  }
  if (!Array.isArray(authorizedFindingIds) || authorizedFindingIds.length === 0
      || authorizedFindingIds.some((id) => typeof id !== "string" || id === "")
      || new Set(authorizedFindingIds).size !== authorizedFindingIds.length) {
    return reject(dshHome, "job-create-rejected", "authorizedFindingIds 必须为无重复非空字符串数组", auditExtra);
  }
  if (!Array.isArray(scope) || scope.length === 0
      || scope.some((prefix) => typeof prefix !== "string" || prefix.trim() === "")) {
    return reject(dshHome, "job-create-rejected", "scope 必须为授权路径前缀非空数组", auditExtra);
  }
  if (acceptanceCriteria === undefined) {
    return reject(dshHome, "job-create-rejected", "acceptanceCriteria 必须提供", auditExtra);
  }

  let decisions;
  try {
    decisions = readDecisions(dshHome, taskId);
  } catch (error) {
    return reject(dshHome, "job-create-rejected", `decision store 不可读：${error.message}`, auditExtra);
  }
  const decision = decisions.find((row) => row.revision === decisionRevision);
  if (!decision) return reject(dshHome, "job-create-rejected", "decisionRevision 对应记录不存在", auditExtra);
  if (decision.choice !== AUTHORIZED_REPAIR_CHOICE) {
    return reject(dshHome, "job-create-rejected", `decision choice=${decision.choice} 未授权修复`, auditExtra);
  }
  if (!subset(authorizedFindingIds, decision.findingIds)) {
    return reject(dshHome, "job-create-rejected", "authorizedFindingIds 超出 decision.findingIds", auditExtra);
  }
  if (!sameValue(scope, decision.scope)) {
    return reject(dshHome, "job-create-rejected", "scope 与 decision 记录不完全一致", auditExtra);
  }
  if (!sameValue(acceptanceCriteria, decision.acceptanceCriteria)) {
    return reject(dshHome, "job-create-rejected", "acceptanceCriteria 与 decision 记录不完全一致", auditExtra);
  }
  if (finalArtifactId !== undefined && finalArtifactId !== decision.artifactId) {
    return reject(dshHome, "job-create-rejected", "finalArtifactId 与 decision.artifactId 不一致", auditExtra);
  }
  if (decisionId !== undefined && decisionId !== decision.hash) {
    return reject(dshHome, "job-create-rejected", "decisionId 与 decision.hash 不一致", auditExtra);
  }
  // F-RV-3：job 必须绑定评审 cycle 的物化 source snapshot（fix-report 提交与复检
  // 全链共用同一快照）。在 decision 授权链校验之后执行，避免掩盖授权类拒绝语义。
  if (typeof sourceSnapshotId !== "string" || sourceSnapshotId === "") {
    return reject(dshHome, "job-create-rejected", "sourceSnapshotId 必填（F-RV-3）", auditExtra);
  }
  if (readSnapshot(dshHome, sourceSnapshotId) === null) {
    return reject(dshHome, "job-create-rejected", "sourceSnapshotId 对应物化快照不存在或损坏（F-RV-3）", auditExtra);
  }

  const jobIdFinal = jobId ?? nextJobId();
  if (!safeLogicalId(jobIdFinal)) return reject(dshHome, "job-create-rejected", "jobId 非法", auditExtra);
  const file = jobFileFor(dshHome, jobIdFinal);
  const lock = acquireStoreLock(dshHome);
  let job;
  try {
    if (existsSync(file)) return reject(dshHome, "job-create-rejected", `job 已存在：${jobIdFinal}`, auditExtra);
    let currentJobs;
    try { currentJobs = existingJobs(dshHome); }
    catch (error) { return reject(dshHome, "job-create-rejected", error.message, auditExtra); }
    if (currentJobs.some((existing) => existing.decisionId === decision.hash)) {
      return reject(dshHome, "job-create-rejected", "该 decisionId 已创建 job，旧 revision 不得重复派发", auditExtra);
    }

    job = {
      jobId: jobIdFinal,
      taskId,
      decisionRevision,
      finalArtifactId: decision.artifactId,
      decisionId: decision.hash,
      engineeringBotId,
      authorizedFindingIds: [...authorizedFindingIds],
      scope: canonicalValue(scope),
      acceptanceCriteria: canonicalValue(acceptanceCriteria),
      repairCycle,
      sourceSnapshotId,
      createdAt: new Date().toISOString()
    };
    mkdirSync(jobsDir(dshHome), { recursive: true });
    writeFileDurable(file, `${JSON.stringify(job)}\n`);
    appendJobEvent(lock, dshHome, jobIdFinal, "created", { repairCycle, generation: 0 });
  } finally {
    lock.release();
  }
  appendAudit(dshHome, {
    type: "job-created", jobId: jobIdFinal, taskId, decisionRevision,
    decisionId: decision.hash, engineeringBotId, repairCycle
  });
  return { ok: true, jobId: jobIdFinal, job };
}

// ---------------- Claim / lease / heartbeat ----------------

export function claimJob(dshHome, {
  jobId,
  botId,
  hostInstanceId = null,
  capability,
  leaseMs = JOB_DEFAULTS.leaseMs,
  secretFile,
  registryItems
}) {
  const job = readJob(dshHome, jobId);
  if (!job) return reject(dshHome, "job-claim-rejected", "job 不存在或损坏", { jobId, botId });
  if (job.engineeringBotId !== botId) {
    return reject(dshHome, "job-claim-rejected", `job 只投 ${job.engineeringBotId}（实际 ${botId}）`, { jobId, botId });
  }

  const checked = checkCapability(dshHome, {
    botId, operation: "job.claim", capability, secretFile, registryItems
  });
  if (!checked.ok) return reject(dshHome, "job-claim-rejected", checked.reason, { jobId, botId });
  const payload = checked.capability.payload;
  if (payload.jobId !== jobId) {
    return reject(dshHome, "job-claim-rejected", "capability payload.jobId 与 jobId 不一致", { jobId, botId });
  }
  if (hostInstanceId !== null && hostInstanceId !== payload.hostInstanceId) {
    return reject(dshHome, "job-claim-rejected", "hostInstanceId 与 capability 不一致", { jobId, botId });
  }
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
    return reject(dshHome, "job-claim-rejected", "leaseMs 非法", { jobId, botId });
  }
  const maxAttempts = JOB_DEFAULTS.maxAttempts;
  if (TERMINAL_STATUSES.has(job.status)) {
    return reject(dshHome, "job-claim-rejected", `job 已终止：${job.status}`, { jobId, botId });
  }

  const lock = acquireStoreLock(dshHome);
  try {
    const state = readJobState(dshHome, jobId);
    if (!state.ok) return reject(dshHome, "job-claim-rejected", state.reason, { jobId, botId });
    if (!new Set(["created", "requeued"]).has(state.status)) {
      return reject(dshHome, "job-claim-rejected", `status=${state.status} 不可 claim`, { jobId, botId });
    }
    const currentLease = (() => {
      try { return readLease(dshHome, jobId); }
      catch (error) { return { corrupt: true, reason: error.message }; }
    })();
    if (currentLease?.corrupt) {
      return reject(dshHome, "job-claim-rejected", currentLease.reason, { jobId, botId });
    }
    if (currentLease) {
      return reject(dshHome, "job-claim-rejected", "同一 job 已有 lease；过期 lease 只能由 host 回收", { jobId, botId });
    }

    const attempt = state.events.filter((event) => event.type === "claimed").length + 1;
    if (attempt > maxAttempts) {
      appendJobEvent(lock, dshHome, jobId, "dead-lettered", { attempt: attempt - 1, maxAttempts });
      return reject(dshHome, "job-claim-rejected", "job 已达到最大尝试次数", { jobId, botId });
    }
    const generation = state.events.filter((event) => event.type === "requeued").length;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const lease = {
      claimOwner: botId,
      claimAt: nowIso,
      leaseUntil: now + leaseMs,
      heartbeatAt: nowIso,
      attempt,
      maxAttempts,
      reportArtifactId: null,
      hostInstanceId: payload.hostInstanceId,
      generation
    };
    writeFileDurable(jobLeaseFileFor(dshHome, jobId), `${JSON.stringify(lease)}\n`);
    appendJobEvent(lock, dshHome, jobId, "claimed", {
      claimOwner: botId, hostInstanceId: payload.hostInstanceId, attempt,
      maxAttempts, generation, nonce: payload.nonce
    });
    return { ok: true, lease };
  } finally {
    lock.release();
  }
}

export function heartbeatJob(dshHome, {
  jobId,
  botId,
  hostInstanceId = null,
  claimOwner = null,
  leaseMs = JOB_DEFAULTS.leaseMs,
  capability,
  secretFile,
  registryItems
}) {
  if (!safeLogicalId(jobId)) return { ok: false, reason: "jobId 非法" };
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) return { ok: false, reason: "leaseMs 非法" };
  if (capability == null) {
    return { ok: false, reason: "无 capability（续租必须持宿主签发的 job.heartbeat capability），拒绝（F-RV-2）" };
  }
  // F-RV-2：heartbeatJob 自身全链校验——HMAC 签名/operation=job.heartbeat/botId/
  // 注册表实例活态/expiry/nonce 单次消费（checkCapability 一体完成），再绑定 jobId。
  const checked = checkCapability(dshHome, {
    botId, operation: "job.heartbeat", capability, secretFile, registryItems
  });
  if (!checked.ok) return { ok: false, reason: `capability 校验失败：${checked.reason}` };
  const payload = checked.capability.payload;
  if (payload.jobId !== jobId) {
    return { ok: false, reason: "capability payload.jobId 与 jobId 不一致，拒绝续租（F-RV-2）" };
  }
  if (hostInstanceId !== null && hostInstanceId !== payload.hostInstanceId) {
    return { ok: false, reason: "hostInstanceId 与 capability 不一致，拒绝续租（F-RV-2）" };
  }
  const lock = acquireStoreLock(dshHome);
  try {
    const state = readJobState(dshHome, jobId);
    if (!state.ok || state.status !== "claimed") return { ok: false, reason: `status=${state.status ?? "corrupt"} 不可 heartbeat` };
    const leaseFile = jobLeaseFileFor(dshHome, jobId);
    let lease;
    try { lease = readLease(dshHome, jobId); }
    catch (error) { return { ok: false, reason: `lease 校验失败（fail closed，原文件未动）：${error.message}` }; }
    if (!lease) return { ok: false, reason: "无有效 lease" };
    // 续租的首要门是上面已校验的签名 capability；lease 内部 hostInstanceId/claimOwner
    // 比对仅作纵深防御，不得单独构成续租依据（F-RV-2）。
    if (lease.hostInstanceId !== payload.hostInstanceId) {
      return { ok: false, reason: "lease 非本 host（capability 绑定身份），拒绝续租（F-RV-2）" };
    }
    if (lease.claimOwner !== botId) {
      return { ok: false, reason: "lease claimOwner 非本 bot，拒绝续租（F-RV-2）" };
    }
    if (claimOwner !== null && lease.claimOwner !== claimOwner) {
      return { ok: false, reason: "lease 非本 claimOwner" };
    }
    if (lease.leaseUntil <= Date.now()) return { ok: false, reason: "lease 已过期，等待 host 回收" };
    const now = Date.now();
    lease.heartbeatAt = new Date(now).toISOString();
    lease.leaseUntil = now + leaseMs;
    writeFileDurable(leaseFile, `${JSON.stringify(lease)}\n`);
    return { ok: true, heartbeatAt: lease.heartbeatAt, leaseUntil: lease.leaseUntil };
  } finally {
    lock.release();
  }
}

// ---------------- Scope-bound fix report ----------------

function realpathAsFarAsPossible(inputPath) {
  let cursor = inputPath;
  const tail = [];
  for (;;) {
    try {
      const real = realpathSync.native(cursor);
      return resolve(real, ...tail.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      const parent = dirname(cursor);
      if (parent === cursor) return resolve(inputPath);
      tail.push(cursor.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
      cursor = parent;
    }
  }
}

function normalizedPath(value, workspaceRoot) {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\0")) return null;
  const absolute = isAbsolute(value) ? resolve(value) : resolve(workspaceRoot, value);
  try { return realpathAsFarAsPossible(absolute); }
  catch { return null; }
}

function withinPrefix(candidate, prefix) {
  const rel = relative(prefix, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function changedPathsWithinScope(changedPaths, scope, workspaceRoot) {
  if (!Array.isArray(changedPaths) || changedPaths.some((entry) => typeof entry !== "string" || entry === "")) {
    return { ok: false, reason: "changedPaths 必须为字符串数组" };
  }
  const root = normalizedPath(workspaceRoot, process.cwd());
  if (!root) return { ok: false, reason: "workspaceRoot 无法规范化" };
  const prefixes = scope.map((prefix) => normalizedPath(prefix, root));
  if (prefixes.some((prefix) => prefix === null || !withinPrefix(prefix, root))) {
    return { ok: false, reason: "job.scope 无法规范化或逃逸 workspaceRoot" };
  }
  for (const changedPath of changedPaths) {
    const candidate = normalizedPath(changedPath, root);
    if (!candidate || !withinPrefix(candidate, root)
        || !prefixes.some((prefix) => withinPrefix(candidate, prefix))) {
      return { ok: false, reason: `changedPath 超出 job.scope：${changedPath}` };
    }
  }
  return { ok: true };
}

/**
 * Non-mutating preflight for the host tool. It deliberately excludes capability
 * and lease checks, which remain authoritative in reportFix; its purpose is to
 * reject malformed/out-of-scope reports before the immutable artifact writer
 * creates a report that can never be accepted.
 */
export function validateFixReportSubmission(dshHome, {
  jobId, botId, body, findingIds, changedPaths, workspaceRoot = process.cwd()
}) {
  const job = readJob(dshHome, jobId);
  if (!job) return { ok: false, reason: "job 不存在或损坏" };
  if (job.engineeringBotId !== botId) return { ok: false, reason: `仅 ${job.engineeringBotId} 可报告` };
  if (typeof body !== "string") return { ok: false, reason: "body 必须为字符串" };
  let report;
  try { report = JSON.parse(body); }
  catch { return { ok: false, reason: "fix-report 正文必须为严格 JSON（十字段 schema）" }; }
  const schemaCheck = validateFixReport(report);
  if (!schemaCheck.ok) return { ok: false, reason: `fix-report schema 校验失败：${schemaCheck.reasons.join("；")}` };
  if (report.taskId !== job.taskId) return { ok: false, reason: "fix-report 正文 taskId 与 job 不符" };
  if (!Array.isArray(findingIds) || findingIds.some((id) => typeof id !== "string" || id === "")) {
    return { ok: false, reason: "findingIds 必须为字符串数组" };
  }
  if (findingIds.some((id) => !job.authorizedFindingIds.includes(id))) {
    return { ok: false, reason: "findingIds 越权" };
  }
  if (!Array.isArray(changedPaths) || changedPaths.some((file) => typeof file !== "string" || file === "")) {
    return { ok: false, reason: "changedPaths 必须为字符串数组" };
  }
  const reportFindingSet = new Set(report.inputFindingIds);
  const argFindingSet = new Set(findingIds);
  if (reportFindingSet.size !== argFindingSet.size || [...reportFindingSet].some((id) => !argFindingSet.has(id))) {
    return { ok: false, reason: "findingIds 参数与正文 inputFindingIds 不一致（以正文为准）" };
  }
  const reportFileSet = new Set(report.changedFiles);
  const argFileSet = new Set(changedPaths);
  if (reportFileSet.size !== argFileSet.size || [...reportFileSet].some((file) => !argFileSet.has(file))) {
    return { ok: false, reason: "changedPaths 参数与正文 changedFiles 不一致（以正文为准）" };
  }
  const reportScope = changedPathsWithinScope(report.changedFiles, job.scope, workspaceRoot);
  if (!reportScope.ok) return { ok: false, reason: `fix-report changedFiles 越 job.scope：${reportScope.reason}` };
  const argScope = changedPathsWithinScope(changedPaths, job.scope, workspaceRoot);
  if (!argScope.ok) return { ok: false, reason: argScope.reason };
  try {
    const flow = readFlow(dshHome, job.taskId);
    if (flow && flow.sourceSnapshotId !== job.sourceSnapshotId) {
      return { ok: false, reason: `snapshot 链不一致：job=${job.sourceSnapshotId}，flow=${flow.sourceSnapshotId}` };
    }
  } catch (error) {
    return { ok: false, reason: `flow 不可读（fail closed）：${error.message}` };
  }
  return { ok: true, job };
}

export function reportFix(dshHome, {
  jobId,
  botId,
  fixReportArtifactId,
  findingIds,
  changedPaths,
  capability,
  workspaceRoot = process.cwd(),
  secretFile,
  registryItems
}) {
  const job = readJob(dshHome, jobId);
  if (!job) return reject(dshHome, "job-fix-report-rejected", "job 不存在或损坏", { jobId, botId });
  if (job.engineeringBotId !== botId) {
    return reject(dshHome, "job-fix-report-rejected", `仅 ${job.engineeringBotId} 可报告`, { jobId, botId });
  }
  if (!safeLogicalId(fixReportArtifactId)) {
    return reject(dshHome, "job-fix-report-rejected", "fixReportArtifactId 非法", { jobId, botId });
  }
  if (job.status === "fix-reported") {
    // F-RV-22：同工件幂等重放——先验证既有事件、工件身份、完整性和参数，
    // 不要求新的 capability，不落新事件，也不允许利用终态分支制造伪造重放。
    const reported = [...(job.events ?? [])].reverse().find((event) => event.type === "fix-reported");
    if (reported && reported.reportArtifactId === fixReportArtifactId
        && sameValue(reported.findingIds ?? [], findingIds ?? [])
        && sameValue(reported.changedPaths ?? [], changedPaths ?? [])) {
      let replayManifest;
      try { replayManifest = readManifest(dshHome, fixReportArtifactId); }
      catch { replayManifest = null; }
      const replayOk = replayManifest
        && replayManifest.stage === "fix-report"
        && replayManifest.taskId === job.taskId
        && replayManifest.authorBotId === botId
        && replayManifest.sourceSnapshotId === job.sourceSnapshotId
        && verifyArtifactIntegrity(dshHome, fixReportArtifactId, replayManifest).ok;
      if (replayOk) return { ok: true, idempotent: true, jobId, reportArtifactId: fixReportArtifactId };
    }
    return reject(dshHome, "job-fix-report-rejected", "fix-reported 是终态，不可重复报告（工件/参数不同或完整性失败）", { jobId, botId });
  }
  if (TERMINAL_STATUSES.has(job.status)) {
    return reject(dshHome, "job-fix-report-rejected", `job 已终止：${job.status}`, { jobId, botId });
  }

  let reportManifest;
  try { reportManifest = readManifest(dshHome, fixReportArtifactId); }
  catch (error) {
    return reject(dshHome, "job-fix-report-rejected", `fix-report manifest 不可读：${error.message}`, { jobId, botId });
  }
  if (!reportManifest) {
    return reject(dshHome, "job-fix-report-rejected", "fix-report 工件不存在", { jobId, botId });
  }
  const reportIntegrity = verifyArtifactIntegrity(dshHome, fixReportArtifactId, reportManifest);
  if (!reportIntegrity.ok || reportManifest.stage !== "fix-report"
      || reportManifest.taskId !== job.taskId || reportManifest.authorBotId !== botId) {
    return reject(dshHome, "job-fix-report-rejected", "fix-report 工件完整性/stage/task/author 绑定失败", { jobId, botId });
  }
  // F-RV-20：fix-report 不可变工件自身必须绑定 job 的 sourceSnapshotId（provenance）
  if (reportManifest.sourceSnapshotId !== job.sourceSnapshotId) {
    return reject(dshHome, "job-fix-report-rejected",
      `fix-report 工件未绑定 job 的 sourceSnapshotId（manifest=${String(reportManifest.sourceSnapshotId)}，job=${String(job.sourceSnapshotId)}）`,
      { jobId, botId });
  }
  // F-RV-14：正文必须为严格 JSON 的十字段 schema（additionalProperties=false；
  // schema 内不存在结论类字段类型，出现即额外键拒绝）。
  let reportBodyText;
  try { reportBodyText = readFileSync(reportManifest.bodyPath, "utf8"); }
  catch (error) {
    return reject(dshHome, "job-fix-report-rejected", `fix-report 正文不可读：${error.message}`, { jobId, botId });
  }
  let report;
  try { report = JSON.parse(reportBodyText); }
  catch {
    return reject(dshHome, "job-fix-report-rejected", "fix-report 正文必须为严格 JSON（十字段 schema）", { jobId, botId });
  }
  const schemaCheck = validateFixReport(report);
  if (!schemaCheck.ok) {
    return reject(dshHome, "job-fix-report-rejected", `fix-report schema 校验失败：${schemaCheck.reasons.join("；")}`, { jobId, botId });
  }
  if (report.taskId !== job.taskId) {
    return reject(dshHome, "job-fix-report-rejected", "fix-report 正文 taskId 与 job 不符", { jobId, botId });
  }
  // F-RV-3/F-RV-14：正文 finding/changedFiles 与 job scope 逐项绑定（单一事实源 = 正文）
  const reportFindingOut = report.inputFindingIds.filter((id) => !job.authorizedFindingIds.includes(id));
  if (reportFindingOut.length > 0) {
    return reject(dshHome, "job-fix-report-rejected", `fix-report inputFindingIds 越权：${reportFindingOut.join(",")}`, { jobId, botId });
  }
  const reportFileCheck = changedPathsWithinScope(report.changedFiles, job.scope, workspaceRoot);
  if (!reportFileCheck.ok) {
    return reject(dshHome, "job-fix-report-rejected", `fix-report changedFiles 越 job.scope：${reportFileCheck.reason}`, { jobId, botId });
  }
  const checked = checkCapability(dshHome, {
    botId, operation: "job.report", capability, secretFile, registryItems
  });
  if (!checked.ok) return reject(dshHome, "job-fix-report-rejected", checked.reason, { jobId, botId });
  if (checked.capability.payload.jobId !== jobId) {
    return reject(dshHome, "job-fix-report-rejected", "capability payload.jobId 与 jobId 不一致", { jobId, botId });
  }
  if (!Array.isArray(findingIds) || findingIds.some((id) => typeof id !== "string" || id === "")) {
    return reject(dshHome, "job-fix-report-rejected", "findingIds 必须为字符串数组", { jobId, botId });
  }
  const outOfScope = findingIds.filter((id) => !job.authorizedFindingIds.includes(id));
  if (outOfScope.length > 0) {
    return reject(dshHome, "job-fix-report-rejected", `findingIds 越权：${outOfScope.join(",")}`, { jobId, botId });
  }
  const pathCheck = changedPathsWithinScope(changedPaths, job.scope, workspaceRoot);
  if (!pathCheck.ok) return reject(dshHome, "job-fix-report-rejected", pathCheck.reason, { jobId, botId });
  // F-RV-14：工具参数与正文逐项一致（集相等；正文是单一事实源）
  const argFindingSet = new Set(findingIds);
  if (argFindingSet.size !== report.inputFindingIds.length
      || report.inputFindingIds.some((id) => !argFindingSet.has(id))) {
    return reject(dshHome, "job-fix-report-rejected", "findingIds 参数与正文 inputFindingIds 不一致（以正文为准）", { jobId, botId });
  }
  const argFileSet = new Set(changedPaths);
  if (argFileSet.size !== report.changedFiles.length
      || report.changedFiles.some((file) => !argFileSet.has(file))) {
    return reject(dshHome, "job-fix-report-rejected", "changedPaths 参数与正文 changedFiles 不一致（以正文为准）", { jobId, botId });
  }
  // F-RV-3：快照链一致性（flow 存在时不得与 job 绑定快照偏离；flow 缺失在
  // 生产路径不可能——复检创建会因无快照 fail closed）
  try {
    const flow = readFlow(dshHome, job.taskId);
    if (flow && flow.sourceSnapshotId !== job.sourceSnapshotId) {
      return reject(dshHome, "job-fix-report-rejected", `snapshot 链不一致：job=${job.sourceSnapshotId}，flow=${flow.sourceSnapshotId}（F-RV-3）`, { jobId, botId });
    }
  } catch (error) {
    return reject(dshHome, "job-fix-report-rejected", `flow 不可读（fail closed）：${error.message}`, { jobId, botId });
  }

  const lock = acquireStoreLock(dshHome);
  try {
    const state = readJobState(dshHome, jobId);
    if (!state.ok || state.status !== "claimed") {
      return reject(dshHome, "job-fix-report-rejected", `status=${state.status ?? "corrupt"} 不可报告`, { jobId, botId });
    }
    const lease = (() => {
      try { return readLease(dshHome, jobId); }
      catch (error) { return { corrupt: true, reason: error.message }; }
    })();
    if (lease?.corrupt) {
      return reject(dshHome, "job-fix-report-rejected", lease.reason, { jobId, botId });
    }
    if (!lease || lease.claimOwner !== botId || lease.leaseUntil <= Date.now()
        || lease.hostInstanceId !== checked.capability.payload.hostInstanceId) {
      return reject(dshHome, "job-fix-report-rejected", "无本 bot/host 的有效 lease", { jobId, botId });
    }
    lease.reportArtifactId = fixReportArtifactId;
    writeFileDurable(jobLeaseFileFor(dshHome, jobId), `${JSON.stringify(lease)}\n`);
    appendJobEvent(lock, dshHome, jobId, "fix-reported", {
      reportArtifactId: fixReportArtifactId,
      findingIds: [...findingIds],
      changedPaths: [...changedPaths],
      attempt: lease.attempt,
      generation: lease.generation
    });
    rmSync(jobLeaseFileFor(dshHome, jobId), { force: true });
  } finally {
    lock.release();
  }
  return { ok: true, jobId, reportArtifactId: fixReportArtifactId };
}

// ---------------- Host-only stale lease recycling ----------------

export function expireStaleJobLeases(dshHome, { hostInstanceId = null, now = Date.now() } = {}) {
  const lock = acquireStoreLock(dshHome);
  const expired = [];
  try {
    if (!existsSync(jobsDir(dshHome))) return expired;
    for (const name of readdirSync(jobsDir(dshHome))) {
      if (!name.endsWith(".lease.json")) continue;
      const jobId = name.slice(0, -".lease.json".length);
      let lease;
      try { lease = readLease(dshHome, jobId); }
      catch (error) {
        // F-RV-5：损坏 lease 不得解释为“无 lease”、不得继续 claim 或覆盖原文件
        appendAudit(dshHome, { type: "job-lease-recycle-rejected", jobId, reason: `lease 损坏：${error.message}` });
        continue;
      }
      if (!lease) {
        appendAudit(dshHome, { type: "job-lease-recycle-rejected", jobId, reason: "lease 损坏" });
        continue;
      }
      if (!Number.isFinite(lease.leaseUntil) || lease.leaseUntil > now) continue;
      const state = readJobState(dshHome, jobId);
      if (!state.ok || state.status !== "claimed") continue;

      appendJobEvent(lock, dshHome, jobId, "expired", {
        claimOwner: lease.claimOwner, previousHostInstanceId: lease.hostInstanceId,
        recycledByHostInstanceId: hostInstanceId, attempt: lease.attempt,
        generation: lease.generation
      });
      appendJobEvent(lock, dshHome, jobId, "failed", {
        attempt: lease.attempt, maxAttempts: lease.maxAttempts,
        generation: lease.generation, reason: "lease-expired"
      });
      rmSync(jobLeaseFileFor(dshHome, jobId), { force: true });

      if (lease.attempt >= lease.maxAttempts) {
        appendJobEvent(lock, dshHome, jobId, "dead-lettered", {
          attempt: lease.attempt, maxAttempts: lease.maxAttempts,
          generation: lease.generation, reason: "max-attempts-exhausted"
        });
        expired.push({ jobId, status: "dead-lettered", attempt: lease.attempt, generation: lease.generation });
      } else {
        const generation = lease.generation + 1;
        appendJobEvent(lock, dshHome, jobId, "requeued", {
          previousAttempt: lease.attempt, nextAttempt: lease.attempt + 1,
          maxAttempts: lease.maxAttempts, generation
        });
        expired.push({ jobId, status: "requeued", attempt: lease.attempt, generation });
      }
    }
    return expired;
  } finally {
    lock.release();
  }
}
