/**
 * pod 06 号票：L2 工具轨迹投影（只读读取面 lib/trace-projection.js）。
 *
 * 职责：把 bot 会话事件流（`session.history` 或落盘多帧 zstd 日志解出的事件数组）
 * 投影成**票面冻结的记录形状**，供 Pod 前端按回合渲染。本件是纯函数 + 只读读盘，
 * 零副作用（`diskTraceCache` 除外——离线读盘的 mtime/size 结果缓存，与
 * lib/stats.js 的 `diskStatsCache` 同一手法、各自的表）。
 *
 * 记录形状（冻结；消费者票 07 逐字依赖，形状变更须走票面 amend）：
 *   { seq, time, callId, parentCallId?, name, argsRaw, state, outputText?,
 *     isError, errorText?, turn, step, subCalls[] }
 *   state ∈ preparing｜running｜ok｜error｜stopped
 *
 * 字段来源（源事件 → 记录字段）：
 *   - 顶层记录锚定 `tool/call`（turn/step/callId/name/arguments/time/seq）；
 *     `tool/result` 补 state／outputText／isError／errorText。
 *   - PTC 信封：外层 `tool/call`（`run_code`）成顶层记录，`tool/ptc-dispatch-start`
 *     与 `tool/ptc-dispatch` 按 `subCallId` 归入其 `subCalls`（同形状、递归），
 *     内层 `name` 逐字保留、不别名化。
 *   - 缺省语义：`parentCallId` 仅子调用有；`outputText`／`errorText` 无可取文本
 *     时**无键**（不是空串以外的占位）；`name` 缺失退化为 `""`；`turn`／`step`
 *     缺失退化为 `0`（消费侧按回合号锚定，0 与真实回合不撞）。
 *
 * 缺口计数：`counters.gap` 汇总「投影缺口」——数据不完整但被确定性回落的事项
 * 条数（缺工具名／孤儿结果／孤儿 PTC 子调用／非事件项）。消费侧票 07 按
 * §E2-R5 把缺口数上浮为可观测项。
 */

import { readFileSync, statSync } from "node:fs";
import { findSessionLogFile, readSessionEventsFromFile } from "./stats.js";

/** 回合收尾原因中「进程/用户把回合打断」的 kind（其余按未闭合处理）。 */
const INTERRUPTED_END_KINDS = new Set(["aborted", "interrupted"]);

/** 缺省回合号／步号（事件字段缺失时的确定性回落）。 */
const TURN_FALLBACK = 0;
const STEP_FALLBACK = 0;

/** 待落定调用的三态（内部态；对外只映射到冻结枚举）。 */
const AWAIT_PREPARING = 1;
const AWAIT_DISPATCHED = 2;
const AWAIT_CLOSED = 3;

/** 整数化（非整数 → 缺省值）。 */
function intOf(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

/** 安全 JSON 序列化（循环引用等 → String 回落，绝不抛）。 */
function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** 参数原样文本：源已是字符串则逐字返回，否则 JSON 序列化（不做结构重写）。 */
function argsRawOf(args) {
  if (typeof args === "string") return args;
  if (args === undefined || args === null) return "";
  if (typeof args === "object") return safeStringify(args);
  return String(args);
}

/**
 * 结果内容块 → 展示文本（text 块逐字；tool-call 块取 name+arguments；
 * tool-result 块递归 content；其余未知块 JSON 序列化——不静默丢内容）。
 */
function contentTextOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts = [];
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block);
    } else if (block?.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    } else if (block?.type === "tool-call" && typeof block.name === "string") {
      parts.push(argsRawOf(block.arguments) === "" ? block.name : `${block.name}(${argsRawOf(block.arguments)})`);
    } else if (block?.type === "tool-result") {
      const nested = contentTextOf(block.content);
      if (nested !== undefined) parts.push(nested);
    } else if (block !== undefined && block !== null) {
      parts.push(safeStringify(block));
    }
  }
  if (parts.length === 0) return undefined;
  return parts.join("\n");
}

/**
 * 结构化失败标量 → 错误文本（事件 data.error 优先；缺各字段时逐级回落）。
 * 返回 undefined ＝ 无可取文本（调用方不再补 errorText 键）。
 */
function structuredErrorText(error) {
  if (error === undefined || error === null) return undefined;
  if (typeof error === "string") return error === "" ? undefined : error;
  for (const key of ["reason", "message", "code", "name"]) {
    const value = error[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return safeStringify(error);
}

/** tool/result 的 message.source.callId（官方 ToolMessageSource 形状）。 */
function resultCallIdOf(data) {
  const source = data?.message?.source;
  const fromSource = source?.callId ?? source?.toolCallId;
  if (typeof fromSource === "string" && fromSource !== "") return fromSource;
  const direct = data?.message?.toolCallId ?? data?.callId;
  return typeof direct === "string" && direct !== "" ? direct : null;
}

/** 结果报错文本：结构化 error 优先，其次 content 文本（与 07 层展示同源）。 */
function resultErrorTextOf(data, outputText) {
  const structured = structuredErrorText(data?.error);
  if (structured !== undefined) return structured;
  return outputText !== undefined && outputText !== "" ? outputText : undefined;
}

/**
 * 投影入口（纯函数）。
 * @param events 会话事件数组（`session.history` 的 `entry.event` 已展开，或落盘日志解出）
 * @returns {{records: Array<object>, counters: {gap: number}}} records 按 seq 严格递增；
 *          非数组输入 → 空轨迹（fail-closed）。
 */
function projectTrace(events) {
  const list = Array.isArray(events) ? events : [];
  const counters = { gap: 0 };
  /** callId → 记录（信封/顶层）。 */
  const envelopes = new Map();
  /** subCallId → 子调用记录。 */
  const subCalls = new Map();
  /** 顶层记录插入序（保证同 seq 时的稳定输出）。 */
  const order = [];
  /** turn → 最近一次 turn/end 的 reason.kind（未闭合的回合不进此表）。 */
  const turnEnds = new Map();
  /** 已见派发开始的 callId／subCallId（乱序事件下用于保持 running）。 */
  const runningCalls = new Set();
  /** parentCallId → 其子调用记录（信封后到时的 turn/step 回填索引）。 */
  const childrenOf = new Map();

  const stateForAwait = (awaitState) =>
    awaitState === AWAIT_DISPATCHED ? "running" : "preparing";

  /** 新建顶层记录（同一 callId 同一会话内只建一次）。 */
  const topRecord = (callId, turn, step, time, seq) => {
    const existing = envelopes.get(callId);
    if (existing !== undefined) return existing;
    const record = {
      seq,
      time,
      callId,
      name: "",
      argsRaw: "",
      state: "preparing",
      isError: false,
      turn,
      step,
      subCalls: []
    };
    const endKind = turnEnds.get(turn);
    if (endKind !== undefined && INTERRUPTED_END_KINDS.has(endKind)) {
      // 回合已按中断收尾：此刻才出现的调用不可能再落定
      record.state = "stopped";
      record._await = AWAIT_CLOSED;
    } else if (runningCalls.has(callId)) {
      // 事件乱序（派发先于 tool/call 到达）：已是执行态，不得回退 preparing
      record.state = "running";
      record._await = AWAIT_DISPATCHED;
    } else {
      record._await = AWAIT_PREPARING;
    }
    envelopes.set(callId, record);
    order.push(record);
    // 信封晚于子调用到达：回填回合/步号（子调用事件不带这两个字段）
    for (const child of childrenOf.get(callId) ?? []) {
      child.turn = turn;
      child.step = step;
    }
    return record;
  };

  /** 新建子调用记录；重复 subCallId 复用并收敛到更早的起序（events 可能乱序）。 */
  const subRecord = (subCallId, time, seq) => {
    const existing = subCalls.get(subCallId);
    if (existing !== undefined) {
      // 同一子调用的 start/settle 两事件：time 取更早（start）者
      existing.time = Math.min(existing.time, time);
      return existing;
    }
    const record = {
      seq,
      time,
      callId: subCallId,
      parentCallId: "",
      name: "",
      argsRaw: "",
      state: "preparing",
      isError: false,
      turn: TURN_FALLBACK,
      step: STEP_FALLBACK,
      subCalls: []
    };
    record._await = AWAIT_PREPARING;
    subCalls.set(subCallId, record);
    return record;
  };

  /** 把子调用挂到信封；信封缺失 → 提升为顶层记录（内层名不得丢失）。 */
  /** 信封缺失的孤儿子调用 → 提升为顶层记录（内层名不得丢失），计一次缺口。 */
  const promoteOrphan = (record) => {
    delete record.parentCallId; // 顶层记录缺省该键
    counters.gap += 1; // 归并关系缺口可观测
    order.push(record);
  };

  for (const event of list) {
    if (event === null || typeof event !== "object" || Array.isArray(event)
      || typeof event.type !== "string" || event.type === "") {
      counters.gap += 1;
      continue;
    }
    const data = event.data ?? {};
    const seq = intOf(event.seq, Number.MAX_SAFE_INTEGER);
    const time = intOf(event.time, TURN_FALLBACK);
    const turn = intOf(data.turn, TURN_FALLBACK);
    const step = intOf(data.step, STEP_FALLBACK);

    switch (event.type) {
      case "tool/call": {
        const callId = typeof data.callId === "string" && data.callId !== "" ? data.callId : null;
        if (callId === null) {
          counters.gap += 1; // 无 callId 无法成记录
          break;
        }
        const record = topRecord(callId, turn, step, time, seq);
        if (typeof data.name === "string" && data.name !== "") {
          record.name = data.name;
        } else {
          counters.gap += 1; // 缺工具名：退化为通用行由 07 层回落
        }
        record.argsRaw = argsRawOf(data.arguments);
        break;
      }
      case "tool/result": {
        const callId = resultCallIdOf(data);
        if (callId === null) {
          counters.gap += 1;
          break;
        }
        const known = envelopes.get(callId);
        if (known === undefined) counters.gap += 1; // 孤儿结果：无 tool/call 可归并
        const record = known ?? topRecord(callId, turn, step, time, seq);
        const outputText = contentTextOf(data.message?.content);
        const isError = data.message?.isError === true || data.error !== undefined;
        record.state = isError ? "error" : "ok";
        record.isError = isError;
        record._await = AWAIT_CLOSED;
        if (outputText !== undefined) record.outputText = outputText;
        const errorText = isError ? resultErrorTextOf(data, outputText) : undefined;
        if (errorText !== undefined) record.errorText = errorText;
        if (record.name === "" && typeof data.name === "string" && data.name !== "") record.name = data.name;
        break;
      }
      case "tool/ptc-dispatch-start":
      case "tool/ptc-dispatch": {
        const subCallId = typeof data.subCallId === "string" && data.subCallId !== "" ? data.subCallId : null;
        if (subCallId === null) {
          counters.gap += 1;
          break;
        }
        const parentCallId = typeof data.parentCallId === "string" && data.parentCallId !== ""
          ? data.parentCallId
          : (typeof data.rootCallId === "string" && data.rootCallId !== "" ? data.rootCallId : null);
        if (parentCallId === null) {
          counters.gap += 1;
          break;
        }
        const record = subRecord(subCallId, time, seq);
        // 先按 parentCallId 归并、缺失才退 rootCallId（保持稳定排序标记），
        // 真正的挂载在事件读完后按 parentCallId 解析（信封可能后到）
        if (typeof data.parentCallId === "string" && data.parentCallId !== "") {
          record.parentCallId = data.parentCallId;
        } else {
          record.parentCallId = parentCallId;
        }
        const owner = record.parentCallId;
        if (!childrenOf.has(owner)) childrenOf.set(owner, []);
        const siblings = childrenOf.get(owner);
        if (!siblings.includes(record)) siblings.push(record);
        // 信封已在 → 立即回填回合/步号（内层事件不带这两个字段）
        const envelope = envelopes.get(owner);
        if (envelope !== undefined) {
          record.turn = envelope.turn;
          record.step = envelope.step;
        }
        if (typeof data.name === "string" && data.name !== "") {
          record.name = data.name;
        } else {
          counters.gap += 1; // 内层缺工具名同样可观测（start／settle 各一次）
        }
        record.argsRaw = argsRawOf(data.arguments);
        if (event.type === "tool/ptc-dispatch-start") {
          runningCalls.add(subCallId);
          if (record._await !== AWAIT_CLOSED) {
            record._await = AWAIT_DISPATCHED;
            record.state = "running";
          }
          // PTC 信封的「执行中」由子调用派发推出（信封自身的 _await 不被内层事件改写）
          const parentRecord = envelopes.get(owner);
          if (parentRecord !== undefined && parentRecord._await === AWAIT_PREPARING) {
            parentRecord._await = AWAIT_DISPATCHED;
            parentRecord.state = "running";
          }
        } else {
          const outputText = contentTextOf(data.content);
          const isError = data.isError === true || data.error !== undefined;
          record.state = isError ? "error" : "ok";
          record.isError = isError;
          record._await = AWAIT_CLOSED;
          if (outputText !== undefined) record.outputText = outputText;
          const errorText = isError ? resultErrorTextOf(data, outputText) : undefined;
          if (errorText !== undefined) record.errorText = errorText;
        }
        break;
      }
      case "turn/end": {
        const kind = data.reason?.kind;
        if (typeof kind === "string" && kind !== "") turnEnds.set(turn, kind);
        break;
      }
      default:
        break;
    }
  }

  // 子调用挂载（信封可能后到：等全部事件读完再按 parentCallId 挂，避免顺序敏感）
  for (const [parentId, children] of childrenOf) {
    const parent = envelopes.get(parentId);
    for (const child of children) {
      if (parent !== undefined && parent !== child) {
        child.turn = parent.turn;
        child.step = parent.step;
        parent.subCalls.push(child);
      } else {
        promoteOrphan(child);
      }
    }
  }

  // 收尾：只有**回合已闭合**（见 turn/end）却仍无结果的调用才改判 stopped；
  // 回合未闭合 → 保持 preparing／running（增量轮询期间不得臆断中断）。
  // `_await === AWAIT_DISPATCHED`（已见派发）的证据比「步骤已结束」更强，
  // 故 running 保持 running，不计缺口。
  const records = [];
  const settle = (record) => {
    const endKind = turnEnds.get(record.turn);
    if (endKind === undefined) {
      record.state = stateForAwait(record._await);
      return;
    }
    if (INTERRUPTED_END_KINDS.has(endKind)) {
      record.state = "stopped";
      return;
    }
    record.state = "stopped";
    if (record._await === AWAIT_PREPARING) counters.gap += 1; // 仅未派发者算缺口
  };
  const flushRecord = (record) => {
    for (const child of record.subCalls) flushRecord(child);
    if (record._await !== AWAIT_CLOSED) settle(record);
    delete record._await;
    return record;
  };
  for (const record of order) records.push(flushRecord(record));
  return { records, counters };
}

//#region 离线读盘（BotsApi.trace 的回退路径）

/** 离线派生轨迹的缓存：workspace:sessionId → {mtimeMs, size, result}；文件未变直接回缓存。 */
const diskTraceCache = new Map();
/** 缓存条目上限（超出按插入序淘汰最旧），防长期运行无限增长。 */
const DISK_TRACE_CACHE_MAX = 64;

/**
 * 离线投影（`BotsApi.trace` 的回退路径，与 lib/stats.js::offlineStats 同款）：
 * 定位落盘日志 → 多帧 zstd 解码 → 投影；mtime/size 未变直接回缓存。
 * 日志缺失／损坏／读取失败一律返回空轨迹（fail-closed，绝不抛）。
 */
function offlineTrace(dshHome, workspace, sessionId) {
  try {
    const file = findSessionLogFile(dshHome, workspace, sessionId);
    if (file === null) return { records: [], counters: { gap: 0 } };
    const st = statSync(file);
    const cacheKey = `${workspace}:${sessionId}`;
    const cached = diskTraceCache.get(cacheKey);
    if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
      return cached.result;
    }
    const result = projectTrace(readSessionEventsFromFile(file));
    if (diskTraceCache.size >= DISK_TRACE_CACHE_MAX) {
      // 简单上限淘汰（按 Map 插入序最旧者），防长期运行无限增长
      diskTraceCache.delete(diskTraceCache.keys().next().value);
    }
    diskTraceCache.set(cacheKey, { mtimeMs: st.mtimeMs, size: st.size, result });
    return result;
  } catch {
    // 损坏日志（扫帧抛错）／stat 竞态／权限问题：空轨迹而非抛到 HTTP 面外
    return { records: [], counters: { gap: 0 } };
  }
}

//#endregion

export { projectTrace, offlineTrace };
