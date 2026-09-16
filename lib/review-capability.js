/**
 * Review bot instance capabilities（v1 评审形态）。通用原语（HMAC 签名／nonce
 * 单次消费／capability 账／secret／实例身份注册表）已拆入组织层共用件
 * lib/org/capability-base.js（org-v2 02 号票，纯增量重构、语义零变化）；本文件
 * 保留评审特有面（评审操作白名单／capability 布局／job 槽位与崩溃自愈／
 * binding schema／签发与校验流程）并作评审消费者的稳定门面。
 */

import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync
} from "node:fs";
import { dirname, join } from "node:path";

import {
  INSTANCE_IDENTITY_FIELDS, NONCE_RETENTION_MS, appendLedgerRecord,
  canonicalPayloadJSON, cleanupExpiredNoncesIn, consumeNonceOnce, currentInstanceRow,
  isCapabilityEnvelope, isNewFormatInstanceRow, isPlainObject, nextCapabilityNonce,
  nonceFileIn, pidAlive, readLedgerFailClosed, readOrCreateSecret, readSecretFile,
  safeBotId, signCapabilityPayload, validStartedAt, verifyCapabilitySignature,
  writeFileAtomic
} from "./org/capability-base.js";
import { acquireStoreLock, readJsonl, writeFileDurable } from "./review-store.js";

// ---------------- Layout ----------------

export function capabilitiesDir(dshHome) {
  return join(dshHome, "bots", "review", "capabilities");
}
export function capabilityLedgerFile(dshHome, botId) {
  if (!safeBotId(botId)) throw new TypeError("botId 必须为安全的非空字符串");
  return join(capabilitiesDir(dshHome), `${botId}.jsonl`);
}
export function activeCapabilityFile(dshHome, botId, jobId = null) {
  if (!safeBotId(botId)) throw new TypeError("botId 必须为安全的非空字符串");
  if (jobId === null) return join(capabilitiesDir(dshHome), `${botId}.active.json`);
  if (!safeBotId(jobId)) throw new TypeError("jobId 必须为安全的非空字符串");
  // Job capabilities use a per-job active slot; concurrent jobs for one bot
  // must not revoke one another merely by issuing a new nonce. A nested path
  // also prevents delimiter collisions between botId and jobId.
  return join(capabilitiesDir(dshHome), botId, `${jobId}.active.json`);
}
export function secretFileFor(dshHome) {
  return join(dshHome, "bots", "review", "capability", "secret");
}
export function nonceFileFor(dshHome, nonce) {
  return nonceFileIn(join(dshHome, "bots", "review", "capability", "nonces"), nonce);
}

// ---------------- Constants ----------------

export const CAPABILITY_DEFAULTS = { ttlMs: 3600_000 };

export const CAPABILITY_OPERATIONS = [
  "review.execute",
  "artifact.read",
  "artifact.submit",
  "evidence.read",
  "evidence.probe",
  "results.read",
  "job.claim",
  "job.heartbeat",
  "job.report"
];

// 原语转发（共用件唯一实现，此处仅保持评审门面出口不变）。
export { nextCapabilityNonce, signCapabilityPayload, verifyCapabilitySignature };
export { NONCE_RETENTION_MS, INSTANCE_IDENTITY_FIELDS, isNewFormatInstanceRow };

// ---------------- Payload binding（F-RV-25 补修切片） ----------------

const BINDING_REQUIRED_KEYS = ["invocationId", "taskId", "sourceSnapshotId"];
const BINDING_ALLOWED_KEYS = [...BINDING_REQUIRED_KEYS, "taskSpecArtifactId"];
const BINDING_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * binding 严格 schema（副审条件一）：存在时必须为固定字段集严格对象——必填
 * invocationId/taskId/sourceSnapshotId，可选 taskSpecArtifactId（probe）；逐字段
 * 非空安全 ID；额外键拒绝。binding 进入 canonical payload，HMAC 天然覆盖。
 */
function validateBinding(binding) {
  if (!isPlainObject(binding)) return { ok: false, reason: "binding 必须为严格对象" };
  for (const key of Object.keys(binding)) {
    if (!BINDING_ALLOWED_KEYS.includes(key)) return { ok: false, reason: `binding 含未允许键 ${key}` };
  }
  for (const key of BINDING_REQUIRED_KEYS) {
    if (!(key in binding)) return { ok: false, reason: `binding 缺必填键 ${key}` };
    if (typeof binding[key] !== "string" || !BINDING_ID_RE.test(binding[key])) {
      return { ok: false, reason: `binding.${key} 必须为非空安全 ID` };
    }
  }
  if ("taskSpecArtifactId" in binding
      && (typeof binding.taskSpecArtifactId !== "string" || !BINDING_ID_RE.test(binding.taskSpecArtifactId))) {
    return { ok: false, reason: "binding.taskSpecArtifactId 必须为非空安全 ID" };
  }
  return { ok: true };
}

// ---------------- Capability-state lock（F-RV-26 slot 一致性） ----------------

export function capabilityLockDir(dshHome) {
  return join(dshHome, "bots", "review", "capability", "lock");
}
export function capabilityEpochFile(dshHome) {
  return join(dshHome, "bots", "review", "capability", "epoch.json");
}

/**
 * F-RV-26：capability 生命周期写操作（issue/revoke）共用一把独立锁域的写锁——
 * 与 store 锁（bots/review/lock）物理分离；禁止在持有 store 锁时获取本锁
 * （锁序不变式，本批已审计全部生产调用点：issueJobDispatch 在 createEngineeringJob
 * 锁外与 pump backfill 中调用、productionJobCapabilityProvider 先于 claim/heartbeat/
 * report 的 store 锁、revoke 无生产调用点——无嵌套）。锁内先对本 bot 执行确定性
 * reconcile（崩溃半程状态自愈），再执行操作；ledger 追加（O_APPEND）在锁内，
 * 为线性化点。不变式（双方向均禁）：ledger 末事件 ⟺ slot 存在性。
 * 锁获取失败 → 抛错拒绝（fail closed），不降级无锁执行。
 */
function withCapabilityLock(dshHome, botId, operation) {
  const lock = acquireStoreLock(dshHome, {
    lockDir: capabilityLockDir(dshHome),
    epochFile: capabilityEpochFile(dshHome),
    lockAuditType: "capability-lock-takeover"
  });
  try {
    reconcileBotCapabilityState(dshHome, botId);
    return operation();
  } finally {
    lock.release();
  }
}

/**
 * F-RV-26 崩溃窗自愈：锁内以 ledger 为审计真源重放该 bot 每 jobId 的末事件——
 * 末=issued 而槽缺失/内容不符 → 用 issued 记录的 envelope 重写槽；末=revoked
 * （bot-wide revoked 清空全部）或无 issued 而槽在 → 删槽；镜像按末条 issued
 * 记录重写（兼容视图，不参与授权判定）。ledger 损坏 → fail closed。
 */
function reconcileBotCapabilityState(dshHome, botId) {
  const ledgerFile = capabilityLedgerFile(dshHome, botId);
  if (!existsSync(ledgerFile)) return;
  const ledger = readJsonl(ledgerFile);
  if (ledger.corrupt.length > 0) {
    throw new Error(`capability ledger 损坏，reconcile fail closed：${String(ledger.corrupt.length)} 条`);
  }
  const lastIssuedByJob = new Map();
  let lastIssued = null;
  for (const record of ledger.parsed) {
    if (record?.type === "issued" && record.payload && typeof record.payload === "object") {
      lastIssuedByJob.set(record.payload.jobId ?? null, record);
      lastIssued = record;
    } else if (record?.type === "revoked") {
      if (record.jobId === undefined || record.jobId === null) {
        lastIssuedByJob.clear();
        lastIssued = null;
      } else {
        lastIssuedByJob.delete(record.jobId);
      }
    }
  }
  const slotsDir = join(capabilitiesDir(dshHome), botId);
  const expectedSlots = new Set();
  for (const [jobId, record] of lastIssuedByJob) {
    if (jobId === null) continue;
    const slotFile = activeCapabilityFile(dshHome, botId, jobId);
    const expected = `${JSON.stringify({ payload: record.payload, sig: record.sig })}\n`;
    expectedSlots.add(`${jobId}.active.json`);
    if (!existsSync(slotFile) || readFileSync(slotFile, "utf8") !== expected) {
      writeFileAtomic(slotFile, expected);
    }
  }
  if (existsSync(slotsDir)) {
    for (const name of readdirSync(slotsDir)) {
      if (!expectedSlots.has(name)) rmSync(join(slotsDir, name), { force: true });
    }
  }
  const mirrorFile = activeCapabilityFile(dshHome, botId);
  const mirrorExpected = lastIssued
    ? `${JSON.stringify({ payload: lastIssued.payload, sig: lastIssued.sig })}\n`
    : null;
  if (mirrorExpected) {
    if (!existsSync(mirrorFile) || readFileSync(mirrorFile, "utf8") !== mirrorExpected) {
      writeFileAtomic(mirrorFile, mirrorExpected);
    }
  } else if (existsSync(mirrorFile)) {
    rmSync(mirrorFile, { force: true });
  }
}

// ---------------- Issuance and revocation ----------------

/**
 * Issue and activate a signed capability. registryItems is an injectable view
 * used by deterministic host tests; production reads instances.jsonl.
 * F-RV-17：pid/startedAt/hostInstanceId 缺省时一律从该 bot 最新新格式实例行解析
 * （签发与校验同一身份源）；旧格式/损坏注册表 fail closed（见 INSTANCE_IDENTITY_FIELDS）。
 */
export function issueCapability(dshHome, {
  botId,
  pid = null,
  hostInstanceId = null,
  operations,
  ttlMs = CAPABILITY_DEFAULTS.ttlMs,
  startedAt = null,
  jobId = null,
  binding = null,
  secretFile = secretFileFor(dshHome),
  registryItems
}) {
  if (!safeBotId(botId)) throw new TypeError("botId 必须为安全的非空字符串");
  if (!(hostInstanceId === null || (typeof hostInstanceId === "string" && hostInstanceId !== ""))) {
    throw new TypeError("hostInstanceId 必须为 null（从注册表解析）或非空字符串");
  }
  if (!Array.isArray(operations) || operations.length === 0) throw new TypeError("operations 非空数组");
  for (const operation of operations) {
    if (!CAPABILITY_OPERATIONS.includes(operation) || operation === "decision.write") {
      throw new TypeError(`非法 operation：${String(operation)}（不在能力白名单）`);
    }
  }
  if (!Number.isFinite(ttlMs)) throw new TypeError("ttlMs 必须为有限数值");
  if (!(jobId === null || (typeof jobId === "string" && jobId !== ""))) {
    throw new TypeError("jobId 必须为 null 或非空字符串");
  }
  // F-RV-25 补修：binding 缺省不写入 payload（job/普通 capability 形状零变化）；
  // 提供时必须通过严格 schema。
  if (binding !== null) {
    const bindingCheck = validateBinding(binding);
    if (!bindingCheck.ok) throw new TypeError(`binding 非法：${bindingCheck.reason}`);
  }

  const current = currentInstanceRow(dshHome, botId, registryItems);
  if (!current.ok) throw new Error(current.reason);
  const row = current.row;
  const boundPid = pid ?? row.pid;
  const boundStartedAt = startedAt ?? row.startedAt;
  const boundHostInstanceId = hostInstanceId ?? row.hostInstanceId;
  if (!Number.isInteger(boundPid) || boundPid <= 0) throw new TypeError("pid 必须为正整数（真实进程 PID）");
  if (!validStartedAt(boundStartedAt)) throw new TypeError("startedAt 必须来自当前实例注册表或显式提供");
  if (row.pid !== boundPid
      || row.startedAt !== boundStartedAt
      || row.hostInstanceId !== boundHostInstanceId) {
    throw new Error("重启/实例变更：签发参数与当前注册表实例不匹配");
  }
  if (!pidAlive(boundPid)) throw new Error("注册表 PID 当前不存活，拒绝签发 capability");

  const issuedAt = Date.now();
  const payload = {
    botId,
    pid: boundPid,
    startedAt: boundStartedAt,
    hostInstanceId: boundHostInstanceId,
    operations: [...operations],
    issuedAt,
    expiresAt: issuedAt + ttlMs,
    nonce: nextCapabilityNonce(),
    jobId,
    ...(binding !== null ? { binding } : {})
  };
  const secret = readOrCreateSecret(secretFile);
  const envelope = { payload, sig: signCapabilityPayload(secret, payload) };

  // F-RV-26：写入序列整体在 capability-state 锁内线性化；ledger 追加（O_APPEND）
  // 为线性化点，槽写在 ledger 记录之后（崩溃半程由 reconcile 以 ledger 为真源自愈）。
  return withCapabilityLock(dshHome, botId, () => {
    mkdirSync(capabilitiesDir(dshHome), { recursive: true });
    appendLedgerRecord(capabilityLedgerFile(dshHome, botId), { type: "issued", ...envelope });
    writeFileDurable(activeCapabilityFile(dshHome, botId, jobId), `${JSON.stringify(envelope)}\n`);
    // Preserve the historical bot-wide view for callers that only inspect the
    // latest capability. Validation of job-bound envelopes uses the job slot
    // above, so this compatibility mirror cannot authorize another job.
    // F-RV-26：并发签发竞争写同一镜像文件——rename 原子落定、豁免读回比对。
    writeFileAtomic(activeCapabilityFile(dshHome, botId), `${JSON.stringify(envelope)}\n`);
    return envelope;
  });
}

/** Return the stored signed envelope, or null when absent/corrupt. */
export function readActiveCapability(dshHome, botId, jobId = null) {
  const file = activeCapabilityFile(dshHome, botId, jobId);
  if (!existsSync(file)) return null;
  try {
    const envelope = JSON.parse(readFileSync(file, "utf8"));
    return isCapabilityEnvelope(envelope) ? envelope : null;
  } catch {
    return null;
  }
}

/** Delete the active envelope and append the existing revoked ledger shape. */
export function revokeCapability(dshHome, botId, jobId = null) {
  // F-RV-26：删除与 revoked 留痕整体在 capability-state 锁内线性化，
  // 与并发 issue 不再交错出"ledger 末事件=revoked 但槽仍在"矛盾态。
  return withCapabilityLock(dshHome, botId, () => {
    const had = readActiveCapability(dshHome, botId, jobId) !== null;
    if (jobId !== null) {
      rmSync(activeCapabilityFile(dshHome, botId, jobId), { force: true });
    } else {
      // A bot-wide revoke invalidates every job-scoped slot as well as the
      // historical compatibility mirror; otherwise a retained job token could
      // remain usable after callers revoke the bot capability.
      const prefix = `${botId}.`;
      if (existsSync(capabilitiesDir(dshHome))) {
        for (const name of readdirSync(capabilitiesDir(dshHome), { withFileTypes: true })) {
          if (name.name === `${botId}.active.json`) {
            rmSync(join(capabilitiesDir(dshHome), name.name), { force: true });
          } else if (name.isDirectory() && name.name === botId) {
            rmSync(join(capabilitiesDir(dshHome), name.name), { recursive: true, force: true });
          }
        }
      }
    }
    if (existsSync(capabilityLedgerFile(dshHome, botId))) {
      const record = { type: "revoked", botId, at: Date.now() };
      if (jobId !== null) record.jobId = jobId;
      appendLedgerRecord(capabilityLedgerFile(dshHome, botId), record);
    }
    return had;
  });
}

// ---------------- Validation ----------------

function validatePayloadShape(payload) {
  if (typeof payload.botId !== "string" || payload.botId === "") return false;
  if (!Number.isInteger(payload.pid) || payload.pid <= 0) return false;
  if (!validStartedAt(payload.startedAt)) return false;
  if (typeof payload.hostInstanceId !== "string" || payload.hostInstanceId === "") return false;
  if (!Array.isArray(payload.operations) || payload.operations.length === 0) return false;
  if (payload.operations.some((op) => !CAPABILITY_OPERATIONS.includes(op) || op === "decision.write")) return false;
  if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) return false;
  if (typeof payload.nonce !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.nonce)) return false;
  // F-RV-25 补修：binding 存在时必须通过严格 schema（缺失允许——job/普通兼容）。
  if ("binding" in payload && !validateBinding(payload.binding).ok) return false;
  return payload.jobId === null || (typeof payload.jobId === "string" && payload.jobId !== "");
}

function sameEnvelope(left, right) {
  try {
    return canonicalPayloadJSON(left) === canonicalPayloadJSON(right);
  } catch {
    return false;
  }
}

function consumeNonce(dshHome, payload) {
  return consumeNonceOnce(dirname(nonceFileFor(dshHome, payload.nonce)), {
    nonce: payload.nonce, botId: payload.botId
  });
}

// ---------------- nonce 记录过期清理（F-RV-11 规划项落地；原语在共用件） ----------------

export function cleanupExpiredNonces(dshHome, options = {}) {
  return cleanupExpiredNoncesIn(dirname(nonceFileFor(dshHome, "nonce-cleanup-dir")), options);
}

function strictCheck(dshHome, {
  botId,
  operation,
  capability,
  secretFile,
  registryItems,
  operationOptional
}) {
  if (!safeBotId(botId)) return { ok: false, reason: "botId 非法，fail closed" };
  const envelope = capability ?? readActiveCapability(dshHome, botId);
  if (!envelope) return { ok: false, reason: "无活态 capability（未签发或已吊销）" };
  if (!isCapabilityEnvelope(envelope)) {
    return { ok: false, reason: "capability 载体格式非法：必须为签名 {payload,sig} envelope" };
  }

  let secret;
  try {
    secret = readSecretFile(secretFile ?? secretFileFor(dshHome));
  } catch {
    return { ok: false, reason: "capability secret 不可用，fail closed" };
  }
  if (!verifyCapabilitySignature(secret, envelope)) {
    return { ok: false, reason: "capability 签名无效（疑似伪造或 payload 被篡改）" };
  }

  const payload = envelope.payload;
  if (!validatePayloadShape(payload)) return { ok: false, reason: "capability payload 字段非法" };
  if (payload.botId !== botId) {
    return { ok: false, reason: `跨 bot 冒用：capability.botId=${String(payload.botId)} ≠ 声明 ${String(botId)}` };
  }
  if (payload.expiresAt <= Date.now()) return { ok: false, reason: "capability 已过期" };
  if (!operationOptional || operation !== null) {
    if (typeof operation !== "string" || !payload.operations.includes(operation)) {
      return { ok: false, reason: `越权 operation：${String(operation)} 不在 scope（${payload.operations.join(",")}）` };
    }
  }

  // Job-scoped capabilities have independent active slots. A bot may work on
  // multiple jobs concurrently; a later issuance for job B must not revoke job A.
  const active = readActiveCapability(dshHome, botId, payload.jobId ?? null);
  if (!active || !sameEnvelope(active, envelope)) {
    return { ok: false, reason: "capability 已吊销或轮换，不是当前活态载体" };
  }

  const current = currentInstanceRow(dshHome, botId, registryItems);
  if (!current.ok) return { ok: false, reason: current.reason };
  if (current.row.pid !== payload.pid
      || current.row.startedAt !== payload.startedAt
      || current.row.hostInstanceId !== payload.hostInstanceId) {
    return { ok: false, reason: "重启/实例变更导致 capability 失效（PID/startedAt/hostInstanceId 不匹配）" };
  }
  if (!pidAlive(payload.pid)) {
    return { ok: false, reason: "注册表 PID 已死亡，重启/实例变更导致 capability 失效" };
  }

  try {
    if (!consumeNonce(dshHome, payload)) return { ok: false, reason: "capability nonce 已消费，拒绝重放" };
  } catch {
    return { ok: false, reason: "capability nonce 无法安全消费，fail closed" };
  }
  return { ok: true, capability: envelope };
}

/** Non-consuming validation for host dispatch reuse/reissue decisions. */
export function isCapabilityCurrent(dshHome, envelope, { secretFile = undefined, registryItems } = {}) {
  try {
    if (!isCapabilityEnvelope(envelope) || !verifyCapabilitySignature(readSecretFile(secretFile ?? secretFileFor(dshHome)), envelope)) return false;
    const payload = envelope.payload;
    if (!validatePayloadShape(payload) || payload.expiresAt <= Date.now()) return false;
    const active = readActiveCapability(dshHome, payload.botId, payload.jobId ?? null);
    if (!active || !sameEnvelope(active, envelope)) return false;
    const current = currentInstanceRow(dshHome, payload.botId, registryItems);
    return current.ok && current.row.pid === payload.pid
      && current.row.startedAt === payload.startedAt
      && current.row.hostInstanceId === payload.hostInstanceId
      && pidAlive(payload.pid);
  } catch {
    return false;
  }
}

/** F-RV-19 派发受信链校验：验签宿主写入的 dispatch capability（secret 读取失败 → false）。 */
export function verifySignedCapability(dshHome, envelope, secretFile = undefined) {
  try {
    return verifyCapabilitySignature(readSecretFile(secretFile ?? secretFileFor(dshHome)), envelope);
  } catch {
    return false;
  }
}

export function checkCapability(dshHome, {
  botId,
  operation,
  capability = null,
  secretFile = secretFileFor(dshHome),
  registryItems
}) {
  return strictCheck(dshHome, {
    botId, operation, capability, secretFile, registryItems, operationOptional: false
  });
}

export function checkAuthorBinding(dshHome, {
  authorBotId,
  operation = null,
  capability = null,
  secretFile = secretFileFor(dshHome),
  registryItems
}) {
  if (typeof authorBotId !== "string" || authorBotId === "") {
    return { ok: false, reason: "authorBotId 缺失" };
  }
  const result = strictCheck(dshHome, {
    botId: authorBotId,
    operation,
    capability,
    secretFile,
    registryItems,
    operationOptional: true
  });
  if (!result.ok && /跨 bot 冒用/.test(result.reason)) {
    return { ok: false, reason: `author 绑定失败：${result.reason}` };
  }
  return result;
}

export function readCapabilityLedger(dshHome, botId) {
  return readLedgerFailClosed(capabilityLedgerFile(dshHome, botId));
}
