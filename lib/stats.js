/**
 * dsh-bots 会话统计推导层（ContextMeter / StatsLine 数据源）。
 *
 * 独立成模块的核心理由：四大 projection（tokenUsage / sessionStats /
 * contextPressure / contextBreakdown）与多帧 zstd 会话日志读取都是从官方
 * dsh-client-connection / dsh-session-persistence-jsonl 移植的代码——它们
 * 的生命周期跟随上游演化，隔离在这里让上游变化时只需同步这一个文件。
 *
 * 输入是纯事件数组（session.history 或落盘日志解出），输出与原生
 * StatsLine / ContextMeter 完全同源的数值；零插件状态、零副作用
 * （diskStatsCache 除外——离线读盘的 mtime/size 结果缓存）。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { constants as zlibConstants, zstdDecompressSync as zstdDecompressSyncFrame } from "node:zlib";

//#region 四大 projection（移植自官方 dsh-client-connection）

/** 从 assistant/chunk(usage) 或 assistant/message 事件读一次 provider 用量样本。 */
function usageSampleOf(event) {
  const usage = event?.type === "assistant/chunk" && event.data?.chunk?.type === "usage"
    ? event.data.chunk.usage
    : event?.type === "assistant/message"
      ? event.data?.usage
      : undefined;
  if (usage === undefined || event.data?.turn === undefined || event.data?.step === undefined) {
    return undefined;
  }
  return { turn: event.data.turn, step: event.data.step, usage };
}

/** 整个日志的输入/输出/缓存 token 累计（同 turn+step 样本增量替换，不重复计）。 */
function tokenUsageOf(log) {
  const totals = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let last = null;
  for (const event of log) {
    const sample = usageSampleOf(event);
    if (sample === undefined) continue;
    const buckets = {
      uncachedInputTokens: sample.usage.inputTokens,
      outputTokens: sample.usage.outputTokens,
      cacheReadTokens: sample.usage.cacheReadTokens ?? 0,
      cacheWriteTokens: sample.usage.cacheWriteTokens ?? 0
    };
    const previous = last?.turn === sample.turn && last.step === sample.step ? last.buckets : undefined;
    totals.uncachedInputTokens += buckets.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0);
    totals.outputTokens += buckets.outputTokens - (previous?.outputTokens ?? 0);
    totals.cacheReadTokens += buckets.cacheReadTokens - (previous?.cacheReadTokens ?? 0);
    totals.cacheWriteTokens += buckets.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0);
    last = { turn: sample.turn, step: sample.step, buckets };
  }
  return totals;
}

/** 整个日志的轮次/步数/LLM 耗时/工具耗时/首 token/解码吞吐统计。 */
function sessionStatsOf(log) {
  const value = { turns: 0, steps: 0, llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0 };
  let lastTurn = null;
  let openStep = null;
  const pendingCalls = new Map();
  const isTokenDelta = (chunk) => chunk?.type === "text" && typeof chunk.text === "string" && chunk.text !== "";
  for (const event of log) {
    switch (event?.type) {
      case "step/start":
        openStep = { turn: event.data.turn, step: event.data.step, startTime: event.time, firstTokenTime: null };
        break;
      case "assistant/chunk":
        if (openStep !== null && openStep.turn === event.data.turn && openStep.step === event.data.step
          && openStep.firstTokenTime === null && isTokenDelta(event.data.chunk)) {
          openStep.firstTokenTime = event.time;
        }
        break;
      case "assistant/message": {
        if (openStep === null || openStep.turn !== event.data.turn || openStep.step !== event.data.step) break;
        value.llmMs += Math.max(0, event.time - openStep.startTime);
        if (openStep.firstTokenTime !== null) {
          value.ttftMs += Math.max(0, openStep.firstTokenTime - openStep.startTime);
          value.ttftSteps += 1;
          const outputTokens = event.data.usage?.outputTokens;
          if (typeof outputTokens === "number" && Number.isFinite(outputTokens) && outputTokens >= 0) {
            value.decodeMs += Math.max(0, event.time - openStep.firstTokenTime);
            value.decodeTokens += outputTokens;
          }
        }
        openStep = null;
        break;
      }
      case "tool/call":
        pendingCalls.set(event.data.callId, event.time);
        break;
      case "tool/result": {
        const callId = event.data?.message?.source?.callId;
        const dispatched = pendingCalls.get(callId);
        if (dispatched === undefined) break;
        pendingCalls.delete(callId);
        value.toolMs += Math.max(0, event.time - dispatched);
        break;
      }
      case "step/end":
        if (event.data.turn !== lastTurn) {
          value.turns += 1;
          lastTurn = event.data.turn;
        }
        value.steps += 1;
        openStep = null;
        break;
      case "turn/end":
        pendingCalls.clear();
        break;
      default: break;
    }
  }
  return value;
}

/** 上下文占用：最近一次 provider 上报的 prompt 规模 + 最近一次请求的上下文窗口。 */
function contextPressureOf(log) {
  let pressureTokens;
  for (const event of log) {
    const sample = usageSampleOf(event);
    if (sample === undefined) continue;
    pressureTokens = sample.usage.inputTokens
      + (sample.usage.cacheReadTokens ?? 0)
      + (sample.usage.cacheWriteTokens ?? 0);
  }
  let contextWindow;
  let requestProvider;
  let requestModel;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]?.type === "request/context") {
      contextWindow = log[i].data?.contextWindow;
      requestProvider = typeof log[i].data?.provider === "string" ? log[i].data.provider : undefined;
      requestModel = typeof log[i].data?.model === "string" ? log[i].data.model : undefined;
      break;
    }
  }
  return {
    ...(pressureTokens === undefined ? {} : { pressureTokens }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(requestProvider === undefined ? {} : { provider: requestProvider }),
    ...(requestModel === undefined ? {} : { model: requestModel })
  };
}

// token-meter 固定密度启发式（4 字符/token、每块/每角色 4 token 开销）。
const TM_CHARS_PER_TOKEN = 4;
const TM_BLOCK_OVERHEAD = 4;
const TM_ROLE_OVERHEAD = 4;

function estimateFixtureTokens(blocks) {
  const density = (value) => Math.ceil(String(value).length / TM_CHARS_PER_TOKEN);
  return blocks.reduce((tokens, block) => {
    if (block?.type === "text" || block?.type === "reasoning") return tokens + density(block.text) + TM_BLOCK_OVERHEAD;
    if (block?.type === "tool-call") return tokens + density(block.name) + density(block.arguments) + TM_BLOCK_OVERHEAD;
    if (block?.type === "tool-result") return tokens + estimateFixtureTokens(block.content ?? []) + TM_BLOCK_OVERHEAD;
    return tokens + density(JSON.stringify(block)) + TM_BLOCK_OVERHEAD;
  }, 0);
}

/**
 * 上下文构成估算（系统提示词 / 工具 / 对话消息），份额按实测 pressureTokens
 * 等比缩放，使三者之和与 ContextMeter 的 usedTokens 对齐。
 */
function contextBreakdownOf(log, pressureTokens) {
  let header;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]?.type === "request/header") {
      header = log[i].data?.header;
      break;
    }
  }
  let messageTokens = 0;
  for (const event of log) {
    if (event?.type !== "user/message" && event?.type !== "assistant/message" && event?.type !== "tool/result") continue;
    const content = event.data?.message?.content ?? event.data?.content;
    if (Array.isArray(content) && content.length > 0) {
      messageTokens += estimateFixtureTokens(content) + TM_ROLE_OVERHEAD;
    }
  }
  const systemTokens = typeof header?.system === "string" && header.system !== ""
    ? Math.ceil(header.system.length / TM_CHARS_PER_TOKEN) + TM_ROLE_OVERHEAD
    : 0;
  const toolsTokens = Array.isArray(header?.tools) && header.tools.length > 0
    ? Math.ceil(JSON.stringify(header.tools).length / TM_CHARS_PER_TOKEN) + TM_BLOCK_OVERHEAD
    : 0;
  const total = systemTokens + toolsTokens + messageTokens;
  if (typeof pressureTokens === "number" && pressureTokens > 0 && total > 0) {
    const scale = pressureTokens / total;
    return {
      systemTokens: Math.round(systemTokens * scale),
      toolsTokens: Math.round(toolsTokens * scale),
      messageTokens: Math.round(messageTokens * scale)
    };
  }
  return { systemTokens, toolsTokens, messageTokens };
}

/** 从一段事件日志推导完整统计（BotsApi.stats 的在线路径使用）。 */
function deriveStats(events) {
  const contextPressure = contextPressureOf(events);
  return {
    tokenUsage: tokenUsageOf(events),
    sessionStats: sessionStatsOf(events),
    contextPressure,
    contextBreakdown: contextBreakdownOf(events, contextPressure.pressureTokens)
  };
}

//#endregion

//#region 离线会话日志读取（session.jsonl.zstd 多帧 zstd）

const ZSTD_MAGIC = 4247762216;

/** 离线读盘派生统计的缓存：botId:sessionId → {mtimeMs, size, stats}；文件未变直接回缓存。 */
const diskStatsCache = new Map();
/** 缓存条目上限（超出按插入序淘汰最旧），防长期运行无限增长。 */
const DISK_STATS_CACHE_MAX = 64;

/**
 * 扫描多帧 zstd 流的完整帧边界（移植官方 dsh-session-persistence-jsonl 的
 * scanZstdFrames：逐帧解析 frame header / block header，不做解压）。每条
 * 事件批次是独立 flush 的帧，尾部可能是未收尾的 torn 帧。
 */
function scanZstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset;
    if (buffer.length - offset < 4) return { frames, tornStart: start };
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`);
    }
    offset += 4;
    if (buffer.length - offset < 1) return { frames, tornStart: start };
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryFlag = descriptor & 3;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start };
    offset += remainingHeaderBytes;
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start };
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = blockHeader >>> 1 & 3;
      const blockSize = blockHeader >>> 3;
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start };
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start };
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return { frames };
}

/**
 * 定位会话日志文件：~/.dsh/sessions/<cwd 编码分片>/<sessionId>/session.jsonl.zstd。
 * 分片目录名 = workspace 的 '/' 全部替换为 '-' 再首尾各加 '-'；扫描兜底防编码规则变化。
 */
function findSessionLogFile(dshHome, workspace, sessionId) {
  const shardName = "-" + workspace.split("/").join("-") + "-";
  const sessionsRoot = join(dshHome, "sessions");
  const candidates = [join(sessionsRoot, shardName, sessionId)];
  try {
    for (const entry of readdirSync(sessionsRoot)) {
      const dir = join(sessionsRoot, entry);
      if (entry !== shardName && existsSync(join(dir, sessionId))) candidates.push(join(dir, sessionId));
    }
  } catch {
    // sessions 根不存在 → 走不存在分支
  }
  for (const dir of candidates) {
    const file = join(dir, "session.jsonl.zstd");
    if (existsSync(file)) return file;
  }
  return null;
}

/** 解码一个会话日志文件（多帧 zstd → JSONL 事件数组）；撕裂尾帧/坏行容错跳过。 */
function readSessionEventsFromFile(file) {
  const raw = readFileSync(file);
  const { frames, tornStart } = scanZstdFrames(raw);
  let text = "";
  for (const frame of frames) {
    text += zstdDecompressSyncFrame(raw.subarray(frame.start, frame.end)).toString("utf8");
  }
  if (tornStart !== undefined) {
    try {
      text += zstdDecompressSyncFrame(raw.subarray(tornStart), { finishFlush: zlibConstants.ZSTD_e_flush }).toString("utf8");
    } catch {
      // torn 帧解不出（写一半）→ 丢弃尾部
    }
  }
  const events = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // 撕裂行 → 跳过
    }
  }
  return events;
}

/**
 * 离线派生统计（BotsApi.stats 的回退路径）：定位落盘日志并推导；
 * mtime/size 未变直接回缓存；找不到日志 → 全零统计（与历史行为一致，
 * 前端对无 agent 数据的会话另有降级展示）。
 */
function offlineStats(dshHome, workspace, sessionId) {
  const file = findSessionLogFile(dshHome, workspace, sessionId);
  if (file === null) return deriveStats([]);
  const st = statSync(file);
  const cacheKey = `${workspace}:${sessionId}`;
  const cached = diskStatsCache.get(cacheKey);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return cached.stats;
  }
  const stats = deriveStats(readSessionEventsFromFile(file));
  if (diskStatsCache.size >= DISK_STATS_CACHE_MAX) {
    // 简单上限淘汰（按 Map 插入序最旧者），防长期运行无限增长
    diskStatsCache.delete(diskStatsCache.keys().next().value);
  }
  diskStatsCache.set(cacheKey, { mtimeMs: st.mtimeMs, size: st.size, stats });
  return stats;
}

//#endregion

export { deriveStats, offlineStats, findSessionLogFile, readSessionEventsFromFile, scanZstdFrames };
