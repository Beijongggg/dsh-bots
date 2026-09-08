/**
 * 普通邮局（mail plane）——inbox/outbox 的路径、解析、seq 分配与追加、会话合并。
 * 自 lib/index.js 邮局区域整体抽取（2026-09-04 bot 自启动批；行为不变——
 * index.js 以同名导入继续暴露 internals 键与全部调用点）。
 * F-S15 修复：appendMessage 的「读最大 seq→追加」整段持跨进程锁（.seq.lock），
 * 语义见 lib/mail-seq-lock.js。
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
  const message = { seq: 0, from, text, at: atValue };
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
 */
export function appendOutbox(dshHome, botId, text) {
  const dir = outboxDirFor(dshHome, botId);
  mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString();
  const message = {
    id: `${botId}-${Date.now().toString(36)}-${(outboxIdCounter += 1).toString(36)}`,
    text: String(text),
    from: "bot",
    timestamp
  };
  const fileName = `${timestamp.replace(/[:.]/g, "-")}.jsonl`;
  appendFileSync(join(dir, fileName), JSON.stringify(message) + "\n", "utf8");
  return message;
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
    id: `in-${botId}-${String(msg.seq)}`,
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
