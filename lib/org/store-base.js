/**
 * 组织层共用件：store 底座原语（org-v2 02 号票；规格 §I 迁移清单第 4 项、§C、§D）。
 *
 * 自 v1 评审 store 门面（lib/review-store.js，已随 03 号票退役）原样迁出的通用
 * 原语，语义零变化：
 * 锁（mkdir 自旋写锁＋死亡证明接管＋epoch fencing）／原子写（durable 写＋
 * O_APPEND 行级追加）／audit（JSONL 追加与 fail-closed 读取）／事件溯源
 * （hash 链事件记录校验＋按转移表折叠）／幂等键（one-file-per-key 预留索引）。
 * 任务台账（05 号票）与权限面（06 号票）直接长在本模块上，不再复制实现。
 *
 * 纪律：同一原语不得在两处各留一份（02 号票验收项）；本模块不依赖任何已退役
 * 评审面模块（评审面退役时本模块零牵连）。
 */
import { createHash, randomBytes } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  readdirSync, renameSync, rmSync, statSync, writeFileSync, writeSync
} from "node:fs";
import { dirname, join } from "node:path";

// ---------------- common helpers ----------------

export function utf8Bytes(text) {
  return Buffer.byteLength(text, "utf8");
}
export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key]);
    return out;
  }
  return value;
}
export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}
export function fsyncDirectory(dir) {
  try {
    const fd = openSync(dir, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
  } catch {
    // Some filesystems do not support directory fsync. The file rename is still atomic.
  }
}

export function writeFileDurable(file, data) {
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
  fsyncDirectory(dirname(file));
  const expected = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const actual = readFileSync(file);
  if (!actual.equals(expected)) throw new Error(`durable write 读回不一致：${file}`);
  return file;
}

/** Compatibility JSONL reader. Callers must inspect corrupt; readers do not discard it. */
export function readJsonl(file) {
  if (!existsSync(file)) return { lines: [], corrupt: [], parsed: [] };
  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim() !== "");
  const parsed = [];
  const corrupt = [];
  for (const line of lines) {
    try { parsed.push(JSON.parse(line)); } catch { corrupt.push(line); }
  }
  return { lines, corrupt, parsed };
}

// F-RV-9：追加必须是原子的行级写入（O_APPEND + 单次 write + fsync），禁止
// “读全文件→改→整写”（并发写者会丢行）。行内无换行符，短行（<PIPE_BUF）在
// 本地文件系统上原子；崩溃导致的撕裂尾行由各读侧按 corrupt fail closed 兜底。
export function appendJsonlLine(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  const line = `${JSON.stringify(obj)}\n`;
  const fd = openSync(file, "a", 0o600);
  try {
    writeFileSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function safeObjectId(value) {
  return typeof value === "string" && value !== "" && !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}

// ---------------- audit ----------------

/** Append one audit entry with a timestamp to an append-only JSONL audit file. */
export function appendAuditEntry(auditFile, entry) {
  appendJsonlLine(auditFile, { at: new Date().toISOString(), ...entry });
}
/** Read an audit JSONL file; any corrupt line fails closed (throws). */
export function readAuditFailClosed(auditFile) {
  const audit = readJsonl(auditFile);
  if (audit.corrupt.length > 0) throw new Error(`audit 存在 ${audit.corrupt.length} 条损坏记录（fail closed）`);
  return audit.parsed;
}

// ---------------- writer lock and epoch ----------------

export function readWriterEpoch(epochPath) {
  if (!existsSync(epochPath)) return 0;
  let value;
  try { value = JSON.parse(readFileSync(epochPath, "utf8")); }
  catch { throw new Error(`writerEpoch 文件损坏，store fail closed：${epochPath}`); }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !Number.isInteger(value.writerEpoch) || value.writerEpoch < 1) {
    throw new Error(`writerEpoch schema 损坏，store fail closed：${epochPath}`);
  }
  return value.writerEpoch;
}
function writeEpochFile(epochPath, writerEpoch) {
  writeFileDurable(epochPath, `${JSON.stringify({ writerEpoch, at: new Date().toISOString() })}\n`);
}
function procStartIdentity(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return null;
    const fieldsAfterComm = stat.slice(close + 2).trim().split(/\s+/);
    const startTicks = fieldsAfterComm[19]; // field 22 overall
    return startTicks ? `proc:${startTicks}` : null;
  } catch {
    return null;
  }
}
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}
const PROCESS_STARTED_AT = procStartIdentity(process.pid) ?? new Date(Date.now() - Math.floor(process.uptime() * 1000)).toISOString();
const PROCESS_HOST_INSTANCE_ID = `store-host-${process.pid}-${sha256Hex(PROCESS_STARTED_AT).slice(0, 12)}`;
const ACTIVE_LOCK_HANDLES = new WeakSet();

export const LOCK_DEFAULTS = { spinMs: 6000, staleMs: 3000, tickMs: 20 };

function validateOwner(owner) {
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) return false;
  return typeof owner.hostInstanceId === "string" && owner.hostInstanceId !== "" &&
    Number.isInteger(owner.pid) && owner.pid > 0 &&
    typeof owner.startedAt === "string" && owner.startedAt !== "" &&
    Number.isInteger(owner.writerEpoch) && owner.writerEpoch > 0;
}
/** alive/dead/unknown for the exact pid+startedAt identity, not merely the PID number. */
function ownerProcessState(owner) {
  if (!validateOwner(owner)) return "unknown";
  if (!pidAlive(owner.pid)) return "dead";
  const observed = procStartIdentity(owner.pid);
  if (observed === null) return "unknown";
  return observed === owner.startedAt ? "alive" : "dead"; // PID reuse proves the old identity died.
}

/**
 * mkdir 自旋写锁（F-RV-26 参数化）：默认锁目录/epoch 文件由 opts 指定——
 * 各数据面（评审单 store、capability 生命周期、v2 台账…）复用同一套已验证的
 * 锁语义（自旋 + PID+startedAt 死亡证明接管 + epoch fencing 基座），各域锁
 * 目录与 epoch 文件彼此独立，禁止跨域嵌套获取（锁序不变式）。
 * opts：lockDir／epochFile／lockAuditType／auditFile（接管留痕的 audit 文件；
 * 缺省＝锁目录同级的 audit.jsonl）／hostInstanceId。
 */
export function acquireStoreLock(dshHome, opts = {}) {
  const { spinMs, staleMs, tickMs } = { ...LOCK_DEFAULTS, ...opts };
  const hostInstanceId = typeof opts.hostInstanceId === "string" && opts.hostInstanceId !== ""
    ? opts.hostInstanceId : PROCESS_HOST_INSTANCE_ID;
  const startedAt = PROCESS_STARTED_AT;
  const dir = typeof opts.lockDir === "string" && opts.lockDir !== "" ? opts.lockDir : join(dshHome, "lock");
  const epochPath = typeof opts.epochFile === "string" && opts.epochFile !== "" ? opts.epochFile : join(dshHome, "epoch.json");
  const auditType = typeof opts.lockAuditType === "string" && opts.lockAuditType !== "" ? opts.lockAuditType : "lock-takeover";
  const auditFile = typeof opts.auditFile === "string" && opts.auditFile !== "" ? opts.auditFile : join(dirname(dir), "audit.jsonl");
  const ownerFile = join(dir, "owner.json");
  const takeoverDir = join(dir, "takeover");
  const takeoverOwnerFile = join(takeoverDir, "owner.json");
  const deadline = Date.now() + spinMs;

  function installOwner(previousOwner = null) {
    const writerEpoch = readWriterEpoch(epochPath) + 1;
    const owner = { hostInstanceId, pid: process.pid, startedAt, writerEpoch };
    // Persist the fence before owner publication. A crash leaves an unknown lock, never a reused epoch.
    writeEpochFile(epochPath, writerEpoch);
    writeFileDurable(ownerFile, `${JSON.stringify(owner)}\n`);
    if (previousOwner) {
      appendAuditEntry(auditFile, {
        type: auditType, lockDir: dir, previousOwner,
        nextHostInstanceId: hostInstanceId, nextPid: process.pid,
        nextStartedAt: startedAt, nextWriterEpoch: writerEpoch
      });
    }
    try { rmSync(takeoverDir, { recursive: true, force: true }); } catch { /* marker already gone */ }
    const handle = {
      epoch: writerEpoch,
      writerEpoch,
      hostInstanceId,
      pid: process.pid,
      startedAt,
      release() {
        let current = null;
        try { current = JSON.parse(readFileSync(ownerFile, "utf8")); } catch { ACTIVE_LOCK_HANDLES.delete(handle); return; }
        if (current.hostInstanceId !== hostInstanceId || current.pid !== process.pid ||
            current.startedAt !== startedAt || current.writerEpoch !== writerEpoch) {
          ACTIVE_LOCK_HANDLES.delete(handle);
          return;
        }
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* already gone */ }
        ACTIVE_LOCK_HANDLES.delete(handle);
      }
    };
    ACTIVE_LOCK_HANDLES.add(handle);
    return handle;
  }

  for (;;) {
    try {
      mkdirSync(dirname(dir), { recursive: true });
      mkdirSync(dir);
      return installOwner();
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner = null;
      try { owner = JSON.parse(readFileSync(ownerFile, "utf8")); } catch { /* unknown identity */ }
      const state = ownerProcessState(owner);
      let age = 0;
      try { age = Date.now() - statSync(dir).mtimeMs; } catch { continue; }

      if (state === "dead" && age > staleMs) {
        try {
          // Atomic contender election inside the existing dead-owner lock. Unlike rm+retry,
          // a losing contender can never delete a newly published writer lock.
          mkdirSync(takeoverDir);
          const proposedEpoch = readWriterEpoch(epochPath) + 1;
          writeFileDurable(takeoverOwnerFile, `${JSON.stringify({
            hostInstanceId, pid: process.pid, startedAt, writerEpoch: proposedEpoch
          })}\n`);
          let stillOwner = null;
          try { stillOwner = JSON.parse(readFileSync(ownerFile, "utf8")); } catch { /* rejected below */ }
          if (canonicalJson(stillOwner) !== canonicalJson(owner) || ownerProcessState(stillOwner) !== "dead") {
            rmSync(takeoverDir, { recursive: true, force: true });
            continue;
          }
          return installOwner(owner);
        } catch (takeoverError) {
          if (takeoverError?.code !== "EEXIST") {
            try { rmSync(takeoverDir, { recursive: true, force: true }); } catch { /* preserve original error */ }
            throw takeoverError;
          }
          // Another contender is proving ownership. It must itself have a verifiable identity.
          let contender = null;
          try { contender = JSON.parse(readFileSync(takeoverOwnerFile, "utf8")); } catch { /* fail closed below */ }
          const contenderState = ownerProcessState(contender);
          if (contenderState === "dead") {
            let takeoverAge = 0;
            try { takeoverAge = Date.now() - statSync(takeoverDir).mtimeMs; } catch { continue; }
            if (takeoverAge > staleMs) {
              try { rmSync(takeoverDir, { recursive: true, force: true }); } catch { /* competing cleanup */ }
              continue;
            }
          }
          if (Date.now() >= deadline && contenderState === "unknown") {
            throw new Error(`store 写锁 takeover 身份不明，禁止自动接管（fail closed）：${takeoverDir}`);
          }
        }
      }
      if (Date.now() >= deadline) {
        if (state === "unknown") {
          throw new Error(`store 写锁身份不明，无法证明原 PID+startedAt 进程已死亡；禁止接管（fail closed）：${dir}`);
        }
        throw new Error(`store 写锁被存活进程 ${String(owner?.pid)} 持有，等待超时（${String(spinMs)}ms）`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, tickMs);
    }
  }
}

/**
 * 锁内写入的 fencing 前置：lock 句柄必须仍是当前 owner 且 epoch 未被接管，
 * 否则留痕拒绝（appendAuditEntry 到 opts.auditFile）并抛错。
 */
export function requireLockOwnership(lock, { ownerDir, epochPath, auditFile }, operation, detail = {}) {
  const writerEpoch = lock?.writerEpoch ?? lock?.epoch;
  let now;
  try { now = readWriterEpoch(epochPath); }
  catch (error) { return { ok: false, reason: error.message }; }
  const fenced = now === writerEpoch;
  let owner = null;
  try { owner = JSON.parse(readFileSync(join(ownerDir, "owner.json"), "utf8")); } catch { /* rejected below */ }
  const owns = ACTIVE_LOCK_HANDLES.has(lock) && fenced && validateOwner(owner) &&
    owner.writerEpoch === writerEpoch && owner.hostInstanceId === lock?.hostInstanceId &&
    owner.pid === lock?.pid && owner.startedAt === lock?.startedAt;
  if (owns) return writerEpoch;
  const reason = fenced
    ? "当前 lock owner 身份与写入请求不一致（fencing）"
    : `writerEpoch 已从 ${String(writerEpoch)} 推进到 ${String(now)}（被接管），延迟写入拒绝（fencing）`;
  appendAuditEntry(auditFile, { type: `${operation}-fenced`, attemptedWriterEpoch: writerEpoch, ...detail, reason });
  throw new Error(reason);
}

// ---------------- event sourcing core ----------------

export const EVENT_CORE_REQUIRED = ["seq", "eventId", "type", "at", "writerEpoch", "eventHash"];
export const EVENT_FILE_RE = /^([1-9]\d*)-([A-Za-z0-9_.-]+)\.json$/;

export function eventHashFor(event) {
  const copy = { ...event };
  delete copy.eventHash;
  return sha256Hex(canonicalJson(copy));
}

/**
 * 按事件类型表构造事件溯源核心（schema 校验＋hash 链＋转移表折叠）。
 * eventTypes：合法 type 枚举；payloadKeysByType：每 type 允许的额外键；
 * legalTransition(previousStatus, nextType)：状态转移合法性。
 * 返回 { validateEventRecord, foldEvents }——语义与原评审 store 逐字相同，
 * 仅类型表参数化。
 */
export function createEventSourcing({ eventTypes, payloadKeysByType, legalTransition }) {
  const types = new Set(eventTypes);

  function validateEventRecord(event, fileSeq = null, fileEventId = null) {
    if (!event || typeof event !== "object" || Array.isArray(event)) return { ok: false, reason: "事件非对象" };
    for (const key of EVENT_CORE_REQUIRED) if (!(key in event)) return { ok: false, reason: `事件 schema 缺必填键 ${key}` };
    const allowed = new Set([...EVENT_CORE_REQUIRED, ...(payloadKeysByType[event.type] ?? [])]);
    for (const key of Object.keys(event)) if (!allowed.has(key)) return { ok: false, reason: `事件 schema 含未允许键 ${key}` };
    if (!Number.isInteger(event.seq) || event.seq < 1) return { ok: false, reason: `事件 seq 非法（${String(event.seq)}）` };
    if (typeof event.eventId !== "string" || !/^[A-Za-z0-9_.-]+$/.test(event.eventId)) return { ok: false, reason: "事件 eventId 非法" };
    if (!types.has(event.type)) return { ok: false, reason: `事件 type 非法（${String(event.type)}）` };
    if (typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at))) return { ok: false, reason: "事件 at 非法时间" };
    if (!Number.isInteger(event.writerEpoch) || event.writerEpoch < 1) return { ok: false, reason: "事件 writerEpoch 非正整数" };
    if (typeof event.eventHash !== "string" || !/^[0-9a-f]{64}$/.test(event.eventHash)) return { ok: false, reason: "事件 eventHash 非 64 位小写 hex" };
    if (fileSeq !== null && event.seq !== fileSeq) return { ok: false, reason: `事件文件名 seq=${String(fileSeq)} 与记录 seq=${String(event.seq)} 不符` };
    if (fileEventId !== null && event.eventId !== fileEventId) return { ok: false, reason: "事件文件名 eventId 与记录不符" };
    const actualHash = eventHashFor(event);
    if (actualHash !== event.eventHash) return { ok: false, reason: `事件 hash 不符（记录=${event.eventHash}，实算=${actualHash}）` };
    return { ok: true };
  }

  function foldEvents(parsedLines) {
    let lastSeq = 0;
    let status = "uncommitted";
    const events = [];
    const byType = {};
    for (const event of parsedLines) {
      if (!event || typeof event !== "object" || Array.isArray(event)) return { ok: false, reason: "事件行非对象", line: JSON.stringify(event), corrupt: true };
      const schema = validateEventRecord(event);
      if (!schema.ok) return { ok: false, reason: schema.reason, line: JSON.stringify(event), corrupt: true };
      if (!Number.isInteger(event.seq) || event.seq < 1) return { ok: false, reason: `事件 seq 非法（${String(event.seq)}）`, line: JSON.stringify(event), corrupt: true };
      if (event.seq !== lastSeq + 1) return { ok: false, reason: `事件 seq 不连续（期望 ${String(lastSeq + 1)}，实际 ${String(event.seq)}）`, line: JSON.stringify(event), corrupt: true };
      if (!types.has(event.type)) return { ok: false, reason: `事件 type 非法（${String(event.type)}）`, line: JSON.stringify(event), corrupt: true };
      if (typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at))) return { ok: false, reason: "事件 at 非法时间", line: JSON.stringify(event), corrupt: true };
      if (!legalTransition(status, event.type)) return { ok: false, reason: `非法 transition：${status} → ${event.type}`, line: JSON.stringify(event), corrupt: true };
      lastSeq = event.seq;
      status = event.type;
      events.push(event);
      (byType[event.type] ??= []).push(event);
    }
    return {
      ok: true, status,
      // 评审域兼容字段（submittedAt/relayedAt/acknowledgedAt 随评审事件类型表
      // 才有意义；其他数据面——如台账——不读这三个键，用 events/byType 取时刻）。
      submittedAt: byType.submitted?.[0]?.at ?? null,
      relayedAt: byType.relayed?.[0]?.at ?? null,
      acknowledgedAt: byType.acknowledged?.[0]?.at ?? null,
      lastSeq, events
    };
  }

  return { validateEventRecord, foldEvents };
}

// ---------------- one-file idempotency reservations ----------------

/** 幂等键 → 预留文件名 hash（sha256 of the raw key bytes）。 */
export function reservationKeyHash(key) {
  return sha256Hex(Buffer.from(key, "utf8"));
}

/**
 * one-file-per-key 幂等预留索引（F-RV 语义原样）：wx/durable 单文件承载一条
 * 预留记录，readAll 对目录内非法项 fail closed；validate 由调用方提供
 * （域自有 schema——预留记录的业务字段属各数据面）。
 */
export function createReservationIndex({ dir, validate }) {
  function fileForHash(keyHash) {
    return join(dir, `${keyHash}.json`);
  }
  function readByHash(keyHash) {
    const file = fileForHash(keyHash);
    if (!existsSync(file)) return null;
    let record;
    try { record = JSON.parse(readFileSync(file, "utf8")); }
    catch { throw new Error(`reservation JSON 损坏：${file}`); }
    const checked = validate(record, keyHash);
    if (!checked.ok) throw new Error(`reservation schema 损坏：${checked.reason}`);
    return record;
  }
  function readAll() {
    if (!existsSync(dir)) return [];
    const records = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[0-9a-f]{64}\.json$/.test(entry.name)) throw new Error(`reservations 目录含非法项：${entry.name}`);
      records.push(readByHash(entry.name.slice(0, -5)));
    }
    return records;
  }
  function write(record) {
    writeFileDurable(fileForHash(record.idempotencyKeyHash), `${JSON.stringify(record)}\n`);
  }
  function commit(record) {
    if (record.state === "committed") return record;
    const committed = { ...record, state: "committed", committedAt: new Date().toISOString() };
    write(committed);
    return committed;
  }
  return { fileForHash, readByHash, readAll, write, commit };
}
