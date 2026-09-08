/**
 * Review bot instance capabilities.
 *
 * A capability is issued by the trusted host as an HMAC authenticated envelope
 * and is bound to one currently registered bot process instance. The secret is
 * never returned from this module or written to capability ledgers.
 */

import {
  createHmac, randomBytes, timingSafeEqual
} from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, renameSync, rmSync, writeFileSync, writeSync
} from "node:fs";
import { dirname, join } from "node:path";

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
  if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(nonce)) {
    throw new TypeError("capability nonce 格式非法");
  }
  return join(dshHome, "bots", "review", "capability", "nonces", `${nonce}.json`);
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

/** A cryptographically random nonce, suitable for a single capability use. */
export function nextCapabilityNonce() {
  return randomBytes(18).toString("hex");
}

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

// ---------------- HMAC and secret helpers ----------------

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key]);
    return out;
  }
  return value;
}

function canonicalPayloadJSON(payload) {
  // Protocol canonical form: recursively sort object keys, then JSON.stringify.
  return JSON.stringify(canonicalValue(payload));
}

export function signCapabilityPayload(secret, payload) {
  if (!(typeof secret === "string" || Buffer.isBuffer(secret) || ArrayBuffer.isView(secret))) {
    throw new TypeError("secret 必须为字符串或字节序列");
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("payload 必须为对象");
  }
  return createHmac("sha256", secret).update(canonicalPayloadJSON(payload), "utf8").digest("hex");
}

export function verifyCapabilitySignature(secret, envelope) {
  try {
    if (!isCapabilityEnvelope(envelope)) return false;
    if (!/^[0-9a-f]{64}$/.test(envelope.sig)) return false;
    const expected = Buffer.from(signCapabilityPayload(secret, envelope.payload), "hex");
    const actual = Buffer.from(envelope.sig, "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function readSecretFile(file) {
  // Refuse links/non-regular files and require the protocol's 0600 mode.
  const stat = lstatSync(file);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) {
    throw new Error("capability secret 文件权限或类型非法");
  }
  const secret = readFileSync(file);
  if (secret.length === 0) throw new Error("capability secret 文件为空");
  return secret;
}

function readOrCreateSecret(file) {
  try {
    return readSecretFile(file);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  mkdirSync(dirname(file), { recursive: true });
  const generated = randomBytes(32);
  let fd;
  try {
    fd = openSync(file, "wx", 0o600);
    writeFileSync(fd, generated);
    fsyncSync(fd);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return readSecretFile(file);
}

// ---------------- Registry ----------------

/**
 * 冻结的实例身份语义（F-RV-17）。
 *
 * 生产实例行统一为五字段 {botId, pid, startedAt, hostInstanceId, at}：
 * - botId：bot 逻辑 id（安全字符串）；
 * - pid：写入进程 PID；
 * - startedAt：写入进程启动时刻（ISO-8601 UTC；按 Date.now()-process.uptime()*1000
 *   自算；进程重启必变）；
 * - hostInstanceId：写入进程的运行时实例身份（`host-<写入进程pid>`；host 行标识 web
 *   宿主，bot 行为该 bot 进程自身的派生身份；写入者重启必轮换）；
 * - at：注册行写入时刻（ISO-8601 UTC；写入进程记录）。
 *
 * 写入方（F-RV-19 语义对齐）：每个 dsh 进程（web host 与 bot 实例）在自身 apply 启动
 * 卫生路径自写一行自身身份，五字段值均由写入进程自算、不接受外部传入；bot 进程
 * 重启即自轮换其行。capability 的真闸门是 HMAC secret，本表只提供实例绑定面。
 * 读取方：issueCapability 与 checkCapability 使用同一 currentInstanceRow()——对同一 bot
 * 取最新行并强制新格式，签发与校验采用同一身份源（同一注册表、同一字段集合）。
 * 旧格式行（缺任一必填字段）不得隐式兼容、不得猜测转换（不补默认值、不跳过字段）：
 * 该 bot 的签发/校验一律 fail closed；真实迁移属 P6-4/P7-5 独立授权范围。
 * 最新行损坏（JSON 解析失败）→ 整个注册表 fail closed，不得回退旧“看似有效”行。
 */
export const INSTANCE_IDENTITY_FIELDS = ["botId", "pid", "startedAt", "hostInstanceId", "at"];

export function isNewFormatInstanceRow(row) {
  if (!isPlainObject(row)) return false;
  if (typeof row.botId !== "string" || row.botId === "" || !safeBotId(row.botId)) return false;
  if (!Number.isInteger(row.pid) || row.pid <= 0) return false;
  if (!validStartedAt(row.startedAt)) return false;
  if (typeof row.hostInstanceId !== "string" || row.hostInstanceId === "") return false;
  if (!validStartedAt(row.at)) return false;
  return true;
}

function registryFileFor(dshHome) {
  return join(dshHome, "bots", "started", "instances.jsonl");
}

function loadRegistryItems(dshHome, registryItems) {
  if (registryItems !== undefined) return Array.isArray(registryItems) ? registryItems : null;
  const file = registryFileFor(dshHome);
  if (!existsSync(file)) return [];
  try {
    const rows = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      const parsed = JSON.parse(line);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      rows.push(parsed);
    }
    return rows;
  } catch {
    return null;
  }
}

/**
 * F-RV-17 同一身份源读取：该 bot 最新实例行必须为冻结新格式；注册表损坏（任一 JSON
 * 行解析失败）或最新行旧格式/缺字段 → fail closed，不回退更旧行、不猜测转换。
 */
function currentInstanceRow(dshHome, botId, registryItems) {
  const items = loadRegistryItems(dshHome, registryItems);
  if (items === null) return { ok: false, reason: "实例注册表损坏或不可读，fail closed（不回退旧行）" };
  let latest = null;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.botId === botId) { latest = items[index]; break; }
  }
  if (!latest) return { ok: false, reason: "注册表无当前 bot 实例，fail closed" };
  if (!isNewFormatInstanceRow(latest)) {
    return { ok: false, reason: "最新实例行为旧格式（缺少冻结必填字段），拒绝签发/校验；不得猜测转换（P6-4 迁移范围）" };
  }
  return { ok: true, row: latest };
}

function validStartedAt(value) {
  return (typeof value === "string" && value !== "") || (typeof value === "number" && Number.isFinite(value));
}

function safeBotId(value) {
  return typeof value === "string" && value !== ""
    && !value.includes("/") && !value.includes("\\")
    && value !== "." && value !== "..";
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
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
    throw new Error(`capability ledger 损坏，reconcile fail closed：${ledger.corrupt.length} 条`);
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

// F-RV-9/F-RV-26：ledger 追加必须是 O_APPEND 行级原子写（单次 write + fsync），
// 与 store 侧 appendJsonl 同款。禁止"读全文件→拼接→整文件替换"：并发签发/吊销
// 会互相丢行，且 writeFileDurable 的读回比对撞上并发 rename 会让 issueCapability
// 随机干净失败。崩溃撕裂尾行由读侧 fail closed 兜底（readCapabilityLedger）。
function appendLedgerRecord(dshHome, botId, record) {
  const ledger = capabilityLedgerFile(dshHome, botId);
  mkdirSync(dirname(ledger), { recursive: true });
  const line = `${JSON.stringify(record)}\n`;
  const fd = openSync(ledger, "a", 0o600);
  try {
    writeFileSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

// F-RV-26：整文件状态的并发竞争写入面（bot-wide 兼容镜像）——rename 原子落定后
// 豁免 writeFileDurable 的读回比对：多进程竞争同一目标时读回会读到竞争者内容而
// 误报失败。镜像仅为兼容视图（不能授权任何 job），落定后内容恒为完整合法 envelope。
function writeFileAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`;
  const fd = openSync(tmp, "wx");
  try {
    writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
  try {
    const dir = openSync(dirname(file), "r");
    try { fsyncSync(dir); } finally { closeSync(dir); }
  } catch {
    // 目录 fsync 非所有文件系统支持；rename 本身已原子。
  }
}

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
      throw new TypeError(`非法 operation：${operation}（不在能力白名单）`);
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
    appendLedgerRecord(dshHome, botId, { type: "issued", ...envelope });
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
      appendLedgerRecord(dshHome, botId, record);
    }
    return had;
  });
}

// ---------------- Validation ----------------

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isCapabilityEnvelope(value) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 2 && keys[0] === "payload" && keys[1] === "sig"
    && isPlainObject(value.payload) && typeof value.sig === "string";
}

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
  const file = nonceFileFor(dshHome, payload.nonce);
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(file, `${JSON.stringify({
      nonce: payload.nonce,
      botId: payload.botId,
      consumedAt: Date.now()
    })}\n`, { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

// ---------------- nonce 记录过期清理（F-RV-11 规划项落地） ----------------

/**
 * 删除保留期外的 nonce 消费记录。安全性依据：重放一张 capability 时，
 * strictCheck 的过期校验（payload.expiresAt <= now 即拒）先于 nonce 查验执行，
 * 因此过期能力无论 nonce 记录在否都会被拒；nonce 记录只需覆盖「能力仍有效」
 * 的窗口。保留期默认 30 天——远大于签发侧全部调用点实际 TTL（60s~1h）与
 * 默认 ttl（1h）；ttlMs 签发无上限，故保留期取保守值并留参数。
 * 只删 nonces/ 下可解析且 consumedAt 早于保留期的 *.json；不可解析/非 JSON/
 * 读取失败的一律保留（证据面不猜测）。目录不存在＝无清理面（成功空扫）。
 */
export const NONCE_RETENTION_MS = 30 * 24 * 3600_000;

export function cleanupExpiredNonces(dshHome, { now = Date.now(), retentionMs = NONCE_RETENTION_MS } = {}) {
  const dir = join(dshHome, "bots", "review", "capability", "nonces");
  const result = { ok: true, removed: 0, kept: 0, skipped: 0 };
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (error) {
    if (error?.code === "ENOENT") return result;
    return { ...result, ok: false };
  }
  for (const name of entries) {
    if (!name.endsWith(".json")) { result.skipped += 1; continue; }
    const file = join(dir, name);
    try {
      const record = JSON.parse(readFileSync(file, "utf8"));
      if (record === null || typeof record !== "object" || !Number.isFinite(record.consumedAt)) {
        result.skipped += 1; // 无 consumedAt 的记录不猜语义，保留
        continue;
      }
      if (now - record.consumedAt > retentionMs) {
        rmSync(file, { force: true });
        result.removed += 1;
      } else {
        result.kept += 1;
      }
    } catch {
      result.skipped += 1; // 读取/解析失败保留
    }
  }
  return result;
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
    return { ok: false, reason: `跨 bot 冒用：capability.botId=${payload.botId} ≠ 声明 ${botId}` };
  }
  if (payload.expiresAt <= Date.now()) return { ok: false, reason: "capability 已过期" };
  if (!operationOptional || operation !== null) {
    if (typeof operation !== "string" || !payload.operations.includes(operation)) {
      return { ok: false, reason: `越权 operation：${operation} 不在 scope（${payload.operations.join(",")}）` };
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
  const ledger = readJsonl(capabilityLedgerFile(dshHome, botId));
  // F-RV-26：崩溃撕裂尾行不静默丢弃（与 readAudit 同款 fail closed）。
  if (ledger.corrupt.length > 0) {
    throw new Error(`capability ledger 存在 ${ledger.corrupt.length} 条损坏记录（fail closed）`);
  }
  return ledger.parsed;
}
