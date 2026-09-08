/**
 * 普通邮局（mail plane）——inbox/outbox 的路径、解析、seq 分配与追加、会话合并。
 * 自 lib/index.js 邮局区域整体抽取（2026-09-04 bot 自启动批；行为不变——
 * index.js 以同名导入继续暴露 internals 键与全部调用点）。
 * F-S15 修复：appendMessage 的「读最大 seq→追加」整段持跨进程锁（.seq.lock），
 * 语义见 lib/mail-seq-lock.js。
 */
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, readSync, renameSync, rmSync, statSync, writeFileSync
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { acquireMailSeqLock } from "./mail-seq-lock.js";

export const DEFAULT_INBOX_LIMIT = 50;

export function inboxDirFor(dshHome, botId) {
  return join(dshHome, "bots", "inbox", botId);
}

export function messagesPathFor(dshHome, botId) {
  return join(inboxDirFor(dshHome, botId), "messages.jsonl");
}

/** bot 回复的 outbox 目录：`<root>/bots/outbox/<botId>/`（回复 JSONL 文件放这里）。 */
export function outboxDirFor(dshHome, botId) {
  return join(dshHome, "bots", "outbox", botId);
}


/**
 * 解析一段 JSONL 文本为对象数组：跳过空行、损坏行与非对象值——邮局三处
 * 读取（maxSeq / inbox / outbox）与 inbox watcher 此前各写了一份该循环。
 */
export function parseJsonlLines(text) {
  const parsed = [];
  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      const value = JSON.parse(trimmed);
      if (value !== null && typeof value === "object") parsed.push(value);
    } catch {
      // 跳过损坏行
    }
  }
  return parsed;
}

/** 文件里现有最大 seq；文件缺失/损坏/读失败 → 0。 */
export function maxSeqInFile(file) {
  if (!existsSync(file)) return 0;
  let seq = 0;
  try {
    for (const msg of parseJsonlLines(readFileSync(file, "utf8"))) {
      if (Number.isInteger(msg?.seq) && msg.seq > seq) seq = msg.seq;
    }
  } catch {
    // 读失败按 seq=0 处理
  }
  return seq;
}

/** 下一条 seq：文件里现有最大 seq + 1；文件缺失 → 1。 */
export function nextSeq(dshHome, botId) {
  return maxSeqInFile(messagesPathFor(dshHome, botId)) + 1;
}

/**
 * 追加一条消息到邮局（一行 JSON），返回完整消息对象。可选 `kind`：
 *   - "mail-response"（bot→bot 任务消息的自动回信标记，见 handleIncoming）；
 *   - "mail-discuss"（双审讨论邮件，见 routeReplyToSender：携带 discussRound
 *     轮次，开环=1，自动续环到 DISCUSSION_MAX_ROUNDS 为止，线程锚点同 replyTo）。
 * 可选 `replyTo` 记录触发消息 seq——不变量：replyTo ⟺ kind 为
 * "mail-response" 或 "mail-discuss" 之一。
 * "mail-discuss" 消息可携带整数 `discussRound`（≥1，缺省按 1 处理）。
 */
export function appendMessage(dshHome, botId, { from, text, at, kind, replyTo, discussRound }) {
  const dir = inboxDirFor(dshHome, botId);
  mkdirSync(dir, { recursive: true });
  let atValue;
  if (typeof at === "string" && at !== "") atValue = at;
  else if (typeof at === "number" && Number.isFinite(at)) atValue = new Date(at).toISOString();
  else atValue = new Date().toISOString();
  // B3：不可猜测 messageId（base64url 22 字符）——receipt/幂等回复的锚点；
  // 旧消息无 id 由 messageIdFor() 回退合成（in-<botId>-<seq>）。
  const message = { id: randomBytes(16).toString("base64url"), seq: 0, from, text, at: atValue };
  if (typeof kind === "string" && kind !== "") message.kind = kind;
  if (Number.isInteger(replyTo) && replyTo > 0) message.replyTo = replyTo;
  if (message.kind === "mail-discuss" && Number.isInteger(discussRound) && discussRound >= 1) {
    message.discussRound = discussRound;
  }
  // F-S15 修复：「读最大 seq→追加」整段持跨进程锁（宿主与各 bot 进程互斥；
  // 临界区毫秒级；锁语义见 lib/mail-seq-lock.js）。
  const file = messagesPathFor(dshHome, botId);
  const lock = acquireMailSeqLock(dir);
  try {
    message.seq = maxSeqInFile(file) + 1;
    appendFileSync(file, JSON.stringify(message) + "\n", "utf8");
  } finally {
    lock.release();
  }
  return message;
}

/** 读回全部消息（文件内顺序 = 时间顺序；跳过损坏行）。 */
export function readAllInboxLines(dshHome, botId) {
  const file = messagesPathFor(dshHome, botId);
  if (!existsSync(file)) return [];
  return parseJsonlLines(readFileSync(file, "utf8"));
}

/** 读回最近 N 条消息（文件内顺序 = 时间顺序；跳过损坏行）。 */
export function readInbox(dshHome, botId, limit = DEFAULT_INBOX_LIMIT) {
  const messages = readAllInboxLines(dshHome, botId);
  const count = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_INBOX_LIMIT;
  return messages.slice(-count);
}

/** 读回 outbox 全部回复（遍历 <botId>/ 下所有 *.jsonl，跳过损坏行）。 */
export function readOutbox(dshHome, botId) {
  const dir = outboxDirFor(dshHome, botId);
  if (!existsSync(dir)) return [];
  const messages = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".jsonl")) continue;
    let raw;
    try {
      raw = readFileSync(join(dir, name), "utf8");
    } catch {
      continue; // 文件可能正被写入/删除，跳过
    }
    messages.push(...parseJsonlLines(raw).filter((msg) => typeof msg.text === "string"));
  }
  return messages;
}

/** outbox 消息 id 的进程内计数器（保证同毫秒内多条回复 id 唯一）。 */
let outboxIdCounter = 0;

/**
 * 追加一条 bot 回复到 outbox（JSONL 一行：{id, text, from:"bot", timestamp}）。
 * 文件名 = 当前时间戳（ISO 的 : 和 . 替换为 -），同毫秒回复追加进同一文件。
 * B3 幂等：带 replyToMessageId 且 outbox 已有对该消息的回复 → 不追加，返回
 * 已有行（崩溃重放窗口不产生重复回复；单消费者模型下判定充分）。
 */
export function appendOutbox(dshHome, botId, text, { replyToMessageId } = {}) {
  const dir = outboxDirFor(dshHome, botId);
  mkdirSync(dir, { recursive: true });
  if (typeof replyToMessageId === "string" && replyToMessageId !== "") {
    const existing = outboxHasReply(dshHome, botId, replyToMessageId);
    if (existing !== null) return existing;
  }
  const timestamp = new Date().toISOString();
  const message = {
    id: `${botId}-${Date.now().toString(36)}-${(outboxIdCounter += 1).toString(36)}`,
    text: String(text),
    from: "bot",
    timestamp
  };
  if (typeof replyToMessageId === "string" && replyToMessageId !== "") {
    message.replyToMessageId = replyToMessageId;
  }
  const fileName = `${timestamp.replace(/[:.]/g, "-")}.jsonl`;
  appendFileSync(join(dir, fileName), JSON.stringify(message) + "\n", "utf8");
  return message;
}

/**
 * outbox 中是否已有对某消息的回复（扫全部 outbox 行的 replyToMessageId）；
 * 命中返回该行，未命中返回 null。B3 幂等回复的机械依据。
 */
export function outboxHasReply(dshHome, botId, messageId) {
  if (typeof messageId !== "string" || messageId === "") return null;
  for (const msg of readOutbox(dshHome, botId)) {
    if (msg.replyToMessageId === messageId) return msg;
  }
  return null;
}

// ---------- B3：消费面 at-least-once（durable receipt / 幂等响应 / 崩溃安全游标） ----------

/**
 * 消息的稳定标识：新消息带不可猜测 id（appendMessage 生成）；历史/损坏行无 id
 * 时回退合成 in-<botId>-<seq>（append-only 语义下稳定）。receipt 与响应标记
 * 均以此为锚。
 */
export function messageIdFor(botId, msg) {
  if (msg !== null && typeof msg === "object" && typeof msg.id === "string" && msg.id !== "") {
    return msg.id;
  }
  const seq = msg !== null && typeof msg === "object" && Number.isInteger(msg.seq) ? msg.seq : 0;
  return `in-${botId}-${seq}`;
}

/** 文件名安全化（生成 id 本就在安全字母表内；回退 id 含 botId，防御性收窄）。 */
function safeFileName(id) {
  return String(id).replace(/[^A-Za-z0-9._-]/g, "_");
}

/** receipts 目录：`inbox/<botId>/receipts/`（每消息一个 JSON 文件）。 */
export function receiptsDirFor(dshHome, botId) {
  return join(inboxDirFor(dshHome, botId), "receipts");
}

/** 基线文件（B3 迁移/截断重置）：seq ≤ 基线的消息视为已消费，不回放。 */
function baselineReceiptPath(dshHome, botId) {
  return join(receiptsDirFor(dshHome, botId), ".baseline.json");
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now().toString(36)}`;
  writeFileSync(tmp, JSON.stringify(value) + "\n", "utf8");
  renameSync(tmp, file);
}

/**
 * 写一条消费 receipt（原子写，后写覆盖）。outcome ∈ processed | skipped-stale。
 * 写失败向上抛（调用方降级为告警——最坏情况崩溃后重放一次，回复幂等兜底）。
 */
export function writeReceipt(dshHome, botId, { messageId, seq, outcome = "processed" }) {
  const dir = receiptsDirFor(dshHome, botId);
  mkdirSync(dir, { recursive: true });
  writeJsonAtomic(join(dir, `${safeFileName(messageId)}.json`), {
    messageId, seq, outcome, at: new Date().toISOString()
  });
}

/** 写基线（seq ≤ 基线视为已消费）。 */
export function writeBaselineReceipt(dshHome, botId, seq) {
  const dir = receiptsDirFor(dshHome, botId);
  mkdirSync(dir, { recursive: true });
  writeJsonAtomic(baselineReceiptPath(dshHome, botId), { seq, at: new Date().toISOString() });
}

/**
 * 读「已消费水位」＝max(基线 seq, 最大 receipt seq)。目录缺失/全损坏 → 0。
 * 只认正整数 seq 的 receipt。
 */
export function readMaxReceiptSeq(dshHome, botId) {
  let max = 0;
  const dir = receiptsDirFor(dshHome, botId);
  try {
    const baseline = JSON.parse(readFileSync(baselineReceiptPath(dshHome, botId), "utf8"));
    if (Number.isInteger(baseline.seq) && baseline.seq > max) max = baseline.seq;
  } catch {
    // 无基线文件：正常（新部署/从未迁移）
  }
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || name.startsWith(".")) continue;
      try {
        const receipt = JSON.parse(readFileSync(join(dir, name), "utf8"));
        if (Number.isInteger(receipt.seq) && receipt.seq > max) max = receipt.seq;
      } catch {
        // 单个损坏 receipt 跳过（fail-open 到重放一次，幂等兜底）
      }
    }
  } catch {
    // 目录不存在：水位 0
  }
  return max;
}

/** receipt 保留上限（超出按 mtime 淘汰最旧；水位语义不受影响——只增不减）。 */
export const RECEIPTS_KEEP = 500;

/** 淘汰旧 receipt（best-effort；启动时调用一次）。 */
export function pruneReceipts(dshHome, botId, keep = RECEIPTS_KEEP) {
  const dir = receiptsDirFor(dshHome, botId);
  let names;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".json") && !n.startsWith("."));
  } catch {
    return;
  }
  if (names.length <= keep) return;
  const statted = [];
  for (const name of names) {
    try {
      statted.push({ name, mtime: statSync(join(dir, name)).mtimeMs });
    } catch {
      // 并发删除等：跳过
    }
  }
  statted.sort((a, b) => a.mtime - b.mtime);
  for (const item of statted.slice(0, statted.length - keep)) {
    try { rmSync(join(dir, item.name), { force: true }); } catch { /* best-effort */ }
  }
}

/**
 * watcher 启动游标决策（B3 崩溃安全）：
 * - 目录不存在 → {lastSeq:0, replay:false}（保持「目录出现后全量处理」语义，
 *   不创建任何文件）；
 * - 有 receipt（水位 w）且 w < 文件最大 seq → {lastSeq:w, replay:true}
 *   （未消费积压回放——bot 停机期间到达的邮件不再丢失）；
 * - 无任何 receipt 且文件已有消息 → 旧数据迁移：写基线＝当前文件最大 seq，
 *   不回放历史（沿用旧「跳过存量」语义，避免 B3 上线瞬间重触发全部历史）；
 * - 水位 ≥ 文件最大（含空文件/无消息）→ {lastSeq:w, replay:false}。
 */
export function initialMailCursor(dshHome, botId) {
  if (!existsSync(inboxDirFor(dshHome, botId))) return { lastSeq: 0, replay: false };
  const file = messagesPathFor(dshHome, botId);
  const fileMax = existsSync(file) ? maxSeqInFile(file) : 0;
  const receiptMax = readMaxReceiptSeq(dshHome, botId);
  if (receiptMax === 0 && fileMax > 0) {
    writeBaselineReceipt(dshHome, botId, fileMax);
    return { lastSeq: fileMax, replay: false, baseline: fileMax };
  }
  return { lastSeq: receiptMax, replay: receiptMax < fileMax };
}

/** responses 目录：`inbox/<botId>/responses/`（每消息一个幂等响应标记）。 */
export function responsesDirFor(dshHome, botId) {
  return join(inboxDirFor(dshHome, botId), "responses");
}

/** 响应标记状态：none（从未处理）/ claimed（进行中或崩溃中断）/ finalized。 */
export function responseState(dshHome, botId, messageId) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(responsesDirFor(dshHome, botId), `${safeFileName(messageId)}.json`), "utf8"));
  } catch {
    return { state: "none" };
  }
  if (raw !== null && typeof raw === "object" && raw.finalized === true) {
    return { state: "finalized", outcome: raw.outcome ?? null };
  }
  return { state: "claimed", messageId: raw?.messageId ?? messageId };
}

/** 认领响应（已存在则保留原标记——崩溃重放场景不覆盖）。 */
export function claimResponse(dshHome, botId, messageId, seq) {
  const dir = responsesDirFor(dshHome, botId);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${safeFileName(messageId)}.json`);
  if (existsSync(file)) return;
  writeJsonAtomic(file, { messageId, seq, claimedAt: new Date().toISOString() });
}

/** 终结响应（补写 finalized+outcome；崩溃中断后重放成功时调用）。 */
export function finalizeResponse(dshHome, botId, messageId, outcome) {
  const dir = responsesDirFor(dshHome, botId);
  mkdirSync(dir, { recursive: true });
  writeJsonAtomic(join(dir, `${safeFileName(messageId)}.json`), {
    messageId, outcome, finalized: true, at: new Date().toISOString()
  });
}

/**
 * 收件方 inbox 是否已存在对某 seq 触发消息的自动回信/讨论件（kind=
 * mail-response|mail-discuss 且 replyTo===seq）——回路由去重，关闭「崩溃
 * 后 outbox 已写、路由重发」的重复投递窗口。
 */
export function inboxHasResponseTo(dshHome, botId, seq) {
  if (!Number.isInteger(seq) || seq <= 0) return false;
  for (const msg of readAllInboxLines(dshHome, botId)) {
    if ((msg.kind === "mail-response" || msg.kind === "mail-discuss") && msg.replyTo === seq) {
      return true;
    }
  }
  return false;
}

/** 解析时间戳：ISO 字符串或 epoch 毫秒数（含数字字符串）；无法解析返回 null。 */
export function parseTimestamp(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/** 会话消息排序：时间戳升序，同时间戳按 id 稳定排序（无时间戳的排最前）。 */
export function compareConversationMessages(a, b) {
  const ta = parseTimestamp(a.timestamp) ?? 0;
  const tb = parseTimestamp(b.timestamp) ?? 0;
  return ta - tb || String(a.id).localeCompare(String(b.id));
}

/**
 * 合并 inbox（user→bot）+ outbox（bot→user），按时间戳升序，得到完整会话历史。
 * 统一消息形状 {id, text, from, timestamp}；`since`（ISO 或 epoch ms）缺省/非法
 * 时不筛选，否则只保留 timestamp 严格晚于它的消息（增量轮询用）。
 */
export function readConversation(dshHome, botId, since = null) {
  const sinceMs = parseTimestamp(since);
  const inbox = readAllInboxLines(dshHome, botId).map((msg) => ({
    id: messageIdFor(botId, msg),
    text: msg.text,
    from: typeof msg.from === "string" && msg.from !== "" ? msg.from : "user",
    timestamp: msg.at
  }));
  const outbox = readOutbox(dshHome, botId);
  const merged = [...inbox, ...outbox];
  if (sinceMs === null) return merged.sort(compareConversationMessages);
  return merged
    .filter((msg) => {
      const t = parseTimestamp(msg.timestamp);
      return t !== null && t > sinceMs;
    })
    .sort(compareConversationMessages);
}

/**
 * 会话读取缓存（GET /api/bots/:id/messages 的 2s 轮询热路径）：
 * inbox 文件 + outbox 目录的签名（文件名:mtime:size）未变时直接复用已解析的
 * 完整会话数组，仅做 since 过滤，避免每次轮询全量读盘并重复解析全部 JSONL。
 * 追加写、新增/删除 outbox 文件都会改变签名，自动失效。
 */
const conversationCache = new Map();
/** 缓存条目上限（超出按插入序淘汰最旧）。 */
const CONVERSATION_CACHE_MAX = 64;

/** outbox 目录签名：每个 *.jsonl 的 name:mtimeMs:size，按文件名稳定排序。 */
function outboxSignature(dir) {
  try {
    const names = readdirSync(dir).filter((n) => n.endsWith(".jsonl")).sort();
    return names.map((n) => {
      const st = statSync(join(dir, n));
      return `${n}:${st.mtimeMs}:${st.size}`;
    }).join("|");
  } catch {
    return ""; // 目录不存在等 → 空签名
  }
}

/**
 * 带缓存的会话读取：语义与 readConversation(dshHome, id, since) 完全一致
 * （返回新数组，调用方可安全排序/持有；缓存内部数组不被外部引用）。
 */
export function readConversationCached(dshHome, botId, since = null) {
  let inboxSig = "";
  try {
    const st = statSync(messagesPathFor(dshHome, botId));
    inboxSig = `${st.mtimeMs}:${st.size}`;
  } catch {
    // inbox 文件尚不存在 → 空签名
  }
  const sig = `${inboxSig}@${outboxSignature(outboxDirFor(dshHome, botId))}`;
  const cached = conversationCache.get(botId);
  let base;
  if (cached !== undefined && cached.sig === sig) {
    base = cached.messages;
  } else {
    base = readConversation(dshHome, botId, null);
    if (conversationCache.size >= CONVERSATION_CACHE_MAX) {
      conversationCache.delete(conversationCache.keys().next().value);
    }
    conversationCache.set(botId, { sig, messages: base });
  }
  const sinceMs = parseTimestamp(since);
  if (sinceMs === null) return base.slice();
  return base.filter((msg) => {
    const t = parseTimestamp(msg.timestamp);
    return t !== null && t > sinceMs;
  });
}

/**
 * 最近一条消息的 text（preview 用）。
 * 只读文件尾部最多 PREVIEW_TAIL_BYTES 字节，避免列表接口全量读大文件；
 * 被截断的不完整行 JSON 解析失败后继续向上找完整行。
 */
/** preview 尾部读取的最大字节数（B3 归位：09-04 抽取时遗漏致 readLastMessage 恒 null）。 */
const PREVIEW_TAIL_BYTES = 8192;

export function readLastMessage(file) {
  let fd;
  try {
    if (!existsSync(file)) return null;
    const size = statSync(file).size;
    if (size === 0) return null;
    fd = openSync(file, "r");
    const readSize = Math.min(size, PREVIEW_TAIL_BYTES);
    const buffer = Buffer.alloc(readSize);
    const { bytesRead } = readSync(fd, buffer, 0, readSize, size - readSize);
    const chunk = buffer.subarray(0, bytesRead).toString("utf8");
    const lines = chunk.split("\n");
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i].trim();
      if (line === "") continue;
      try {
        const msg = JSON.parse(line);
        if (msg !== null && typeof msg === "object" && typeof msg.text === "string") return msg.text;
      } catch {
        // 可能是被截断的不完整行；继续向上找
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // 忽略关闭错误
      }
    }
  }
}

//#endregion
