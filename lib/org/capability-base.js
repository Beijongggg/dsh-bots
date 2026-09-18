/**
 * 组织层共用件：capability 原语（org-v2 02 号票；规格 §I 迁移清单第 4 项、§C、§D）。
 *
 * 自 v1 评审 capability 门面（lib/review-capability.js，已随 03 号票退役）原样
 * 迁出的通用原语，语义零变化：
 * HMAC 签名/验签（canonical payload）／nonce 生成与单次消费（wx 独占创建）／
 * capability 账（O_APPEND 行级原子追加＋损坏 fail-closed 读取）／secret 文件
 * 读写（0600 独占创建）／实例身份注册表读取（五字段代际绑定，冻结语义照用
 * ——spec §D「capability 唯一绑定源」；v2 台账命令鉴权直接复用）。
 * 权限面（06 号票）直接长在本模块上。
 *
 * 纪律：同一原语不得在两处各留一份（02 号票验收项）；本模块不依赖任何已退役
 * 评审面模块。
 */
import {
  createHmac, randomBytes, timingSafeEqual
} from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, renameSync, rmSync, writeFileSync, writeSync
} from "node:fs";
import { dirname, join } from "node:path";

import {
  appendJsonlLine, canonicalJson, fsyncDirectory, pidAlive, readJsonl, safeObjectId
} from "./store-base.js";

// ---------------- payload signing ----------------

export function canonicalPayloadJSON(payload) {
  // Protocol canonical form: recursively sort object keys, then JSON.stringify.
  return canonicalJson(payload);
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

export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** 签名载体必须是严格 {payload, sig} 两键对象。 */
export function isCapabilityEnvelope(value) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 2 && keys[0] === "payload" && keys[1] === "sig"
    && isPlainObject(value.payload) && typeof value.sig === "string";
}

// ---------------- nonce ----------------

export const NONCE_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** A cryptographically random nonce, suitable for a single capability use. */
export function nextCapabilityNonce() {
  return randomBytes(18).toString("hex");
}

export function nonceFileIn(nonceDir, nonce) {
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
    throw new TypeError("capability nonce 格式非法");
  }
  return join(nonceDir, `${nonce}.json`);
}

/**
 * nonce 单次消费：wx 独占创建消费记录（EEXIST＝已消费，拒绝重放）。
 * 消费顺序纪律（原语义照用）：过期校验必须先于 nonce 查验执行——过期能力
 * 无论记录在否都会被拒，nonce 记录只需覆盖「能力仍有效」的窗口。
 */
export function consumeNonceOnce(nonceDir, record) {
  const file = nonceFileIn(nonceDir, record.nonce);
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(file, `${JSON.stringify({
      nonce: record.nonce,
      ...record,
      consumedAt: Date.now()
    })}\n`, { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

/**
 * nonce 记录过期清理（F-RV-11 规划项落地，语义原样）。只删可解析且
 * consumedAt 早于保留期的 *.json；不可解析/非 JSON/读取失败的一律保留
 * （证据面不猜测）。目录不存在＝无清理面（成功空扫）。
 */
export const NONCE_RETENTION_MS = 30 * 24 * 3600_000;

export function cleanupExpiredNoncesIn(nonceDir, { now = Date.now(), retentionMs = NONCE_RETENTION_MS } = {}) {
  const result = { ok: true, removed: 0, kept: 0, skipped: 0 };
  let entries;
  try {
    entries = readdirSync(nonceDir);
  } catch (error) {
    if (error?.code === "ENOENT") return result;
    return { ...result, ok: false };
  }
  for (const name of entries) {
    if (!name.endsWith(".json")) { result.skipped += 1; continue; }
    const file = join(nonceDir, name);
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

// ---------------- secret files ----------------

export function readSecretFile(file) {
  // Refuse links/non-regular files and require the protocol's 0600 mode.
  const stat = lstatSync(file);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) {
    throw new Error("capability secret 文件权限或类型非法");
  }
  const secret = readFileSync(file);
  if (secret.length === 0) throw new Error("capability secret 文件为空");
  return secret;
}

export function readOrCreateSecret(file) {
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

// ---------------- capability ledger ----------------

// F-RV-9/F-RV-26：ledger 追加必须是 O_APPEND 行级原子写（单次 write + fsync）。
// 禁止"读全文件→拼接→整文件替换"：并发签发/吊销会互相丢行。崩溃撕裂尾行由
// 读侧 fail closed 兜底（readLedgerFailClosed）。实现＝store-base.appendJsonlLine
// 同一原语（02 号票纪律：同一原语不得两处各留一份）。
export function appendLedgerRecord(ledgerFile, record) {
  appendJsonlLine(ledgerFile, record);
}

/** capability 账读取：任何损坏行 fail closed（不静默丢弃）。 */
export function readLedgerFailClosed(ledgerFile) {
  const ledger = readJsonl(ledgerFile);
  if (ledger.corrupt.length > 0) {
    throw new Error(`capability ledger 存在 ${ledger.corrupt.length} 条损坏记录（fail closed）`);
  }
  return ledger.parsed;
}

/**
 * 整文件状态的并发竞争写入面——rename 原子落定后豁免 writeFileDurable 的读回
 * 比对：多进程竞争同一目标时读回会读到竞争者内容而误报失败。
 */
export function writeFileAtomic(file, data) {
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
}

// ---------------- instance identity registry（五字段代际绑定，F-RV-17 冻结语义） ----------------

/**
 * 生产实例行统一为五字段 {botId, pid, startedAt, hostInstanceId, at}：
 * - botId：bot 逻辑 id（安全字符串）；
 * - pid：写入进程 PID；
 * - startedAt：写入进程启动时刻（进程重启必变）；
 * - hostInstanceId：写入进程的运行时实例身份（host 行标识 web 宿主，bot 行为
 *   该 bot 进程自身的派生身份；写入者重启必轮换）；
 * - at：注册行写入时刻。
 *
 * capability 的真闸门是 HMAC secret，本表只提供实例绑定面。读取方：issue 与
 * check 使用同一 currentInstanceRow()——对同一 bot 取最新行并强制新格式，签发
 * 与校验采用同一身份源。旧格式行（缺任一必填字段）不得隐式兼容、不得猜测转换
 * （不补默认值、不跳过字段）：该 bot 的签发/校验一律 fail closed。最新行损坏
 * （JSON 解析失败）→ 整个注册表 fail closed，不得回退旧“看似有效”行。
 */
export const INSTANCE_IDENTITY_FIELDS = ["botId", "pid", "startedAt", "hostInstanceId", "at"];

export function instanceRegistryFile(dshHome) {
  return join(dshHome, "bots", "started", "instances.jsonl");
}

export function isNewFormatInstanceRow(row) {
  if (!isPlainObject(row)) return false;
  if (typeof row.botId !== "string" || row.botId === "" || !safeBotId(row.botId)) return false;
  if (!Number.isInteger(row.pid) || row.pid <= 0) return false;
  if (!validStartedAt(row.startedAt)) return false;
  if (typeof row.hostInstanceId !== "string" || row.hostInstanceId === "") return false;
  if (!validStartedAt(row.at)) return false;
  return true;
}

function loadRegistryItems(dshHome, registryItems) {
  if (registryItems !== undefined) return Array.isArray(registryItems) ? registryItems : null;
  const file = instanceRegistryFile(dshHome);
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
 * 同一身份源读取：该 bot 最新实例行必须为冻结新格式；注册表损坏（任一 JSON
 * 行解析失败）或最新行旧格式/缺字段 → fail closed，不回退更旧行、不猜测转换。
 */
export function currentInstanceRow(dshHome, botId, registryItems) {
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

// ---------------- shared id helpers ----------------

export function validStartedAt(value) {
  return (typeof value === "string" && value !== "") || (typeof value === "number" && Number.isFinite(value));
}

// safeBotId 与 pidAlive ＝ store-base 同名原语的域别名（botId/id 安全字符串与
// 进程存活判定各只有一份实现；02 号票去重纪律）。
export function safeBotId(value) {
  return safeObjectId(value);
}

export { pidAlive };
