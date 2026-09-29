/**
 * session-driver（2026-09-07 架构评审候选 1／PLAN §十一 结构债首件）——DSH 会话
 * 回合协议的单一归属：create →（条件）selectModel → prompt → 轮询 history →
 * 提取 assistant 文本。此前该协议在 runNativeAgentTurn 与 buildReviewRunner
 * 逐行双写（deletion test：删任一份协议知识即在另一处重现）。
 *
 * Interface：createSessionDriver({ rpc, sleep, now }) → { runPrompt }。
 *   runPrompt({ sessionId?, cwd, model?, text, timeoutMs, pollMs?, checkAlive?,
 *               maxMessages?, errorLabel?, onSessionCreated? }) → { text, sessionId }
 *
 * 职责边界（与调用方 adapter 的分工）：
 * - driver 持有协议知识：方法顺序不变量、消息形状、**turn baseline 不变量**
 *   （提取只认 prompt 之后的新回合——复用 session 必拉 pre-prompt history 算
 *   baseline 防旧回合污染；fresh session 缺省也拉〔普通路径序〕，评审 adapter
 *   可声明 skipBaselineHistoryWhenFresh〔构造即 0，与原评审 RPC 序列等价〕）、
 *   **错误终止不变量**（baseline 后 turn/end reason.kind=error 且无 assistant
 *   消息即抛错——不烧满预算；assistant 提取先于错误判定，病态「有文本又
 *   error 收尾」返回模型真实产出；非 error 终止保持旧轮询语义）。
 * - 监督（连续超时计数／总 deadline＋单次超时＋heartbeat 三重约束 F-RV-18）
 *   全部住在调用方提供的 rpc adapter 里——driver 只外加一个 checkAlive 钩子
 *   （每轮轮询的环头/睡后/取史后各调一次，抛错即中止回合）。
 * - session 政策留调用方：持久（.dsh-bot-session.json，经 onSessionCreated
 *   建会话即落盘——回合失败也续上下文，自愈流依赖此序）vs 评审一次性会话。
 * - 轮询预算自回合入口起算（评审既有语义；普通侧原为 prompt 后起算，统一后
 *   严格化幅度 ≤ 建会话耗时）。
 * - sleep 全注入：评审 adapter 传入与 heartbeatFailurePromise 竞速的 sleep，
 *   保真「监督失败即刻打断休眠」的 F-RV-18 语义。
 *
 * 错误：rpc 错误原样透传（上游 isSessionCorruptError 判定依赖原始错误）；
 * 超时/信封异常带 errorLabel 前缀。零第三方依赖。
 */

/** history 应答 → 事件数组（entry.event ?? entry 兼容两种信封）。 */
function historyEventsOf(history) {
  return Array.isArray(history?.events) ? history.events.map((entry) => entry?.event ?? entry) : [];
}

/** 事件流中的 turn baseline：既有 turn/end 的最大回合号（无 → 0）。 */
function baselineTurnOf(events) {
  return events.reduce((max, event) =>
    event?.type === "turn/end" && Number.isInteger(event?.data?.turn) ? Math.max(max, event.data.turn) : max
  , 0);
}

/** baseline 之后最新的 turn/end 事件（无 → undefined）。 */
function latestTurnEndAfter(events, baseline) {
  return [...events].reverse().find((event) =>
    event?.type === "turn/end" && Number.isInteger(event?.data?.turn) && event.data.turn > baseline
  );
}

/** 指定回合的 assistant/message 事件（content 为数组才算命中）。 */
function assistantMessageFor(events, turnEnd) {
  return [...events].reverse().find((event) =>
    event?.type === "assistant/message" && event?.data?.turn === turnEnd.data.turn &&
    Array.isArray(event?.data?.message?.content)
  );
}

/** assistant/message 事件 → 文本（text part 依序拼接；无 text part → 空串）。 */
function assistantTextOf(assistant) {
  return assistant.data.message.content
    .filter((part) => part?.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/**
 * turn/end 的 reason → 可定位错误文本。实证形状（2026-09-29 供应商 400）：
 * reason={kind:"error",error:{message,code}}；缺 error 对象时兜底序列化
 * 整个 reason，保证错误可归因而不是一个空消息。
 */
function turnErrorTextOf(reason) {
  const message = reason?.error?.message;
  if (typeof message === "string" && message !== "") return message;
  try { return JSON.stringify(reason ?? {}); } catch { return String(reason); }
}

/**
 * 创建 driver。rpc：已监督的 (method, payload) => value（监督政策属调用方）；
 * sleep/now 可注入（评审 adapter 的 sleep 与 heartbeat 失败竞速；测试零等待）。
 */
export function createSessionDriver({
  rpc,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now
} = {}) {
  if (typeof rpc !== "function") throw new TypeError("session-driver：rpc 必须为函数");

  async function runPrompt({
    sessionId = null,
    cwd,
    model = null,
    text,
    timeoutMs,
    pollMs = 500,
    checkAlive = null,
    maxMessages = 100,
    errorLabel = "agent turn",
    onSessionCreated = null,
    skipBaselineHistoryWhenFresh = false
  } = {}) {
    if (typeof cwd !== "string" || cwd.trim() === "") throw new TypeError("session-driver：cwd 必须为非空字符串");
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("session-driver：timeoutMs 必须为正整数");
    const callCheckAlive = () => { if (typeof checkAlive === "function") checkAlive(); };
    const startedAt = now();
    let session = sessionId;
    let baseline = 0;
    if (session === null) {
      const created = await rpc("session.create", { cwd });
      session = typeof created?.sessionId === "string" ? created.sessionId : null;
      if (session === null) throw new Error(`session.create 未返回 sessionId（${errorLabel}）`);
      if (typeof onSessionCreated === "function") onSessionCreated(session);
    }
    if (model !== null
      && typeof model.provider === "string" && model.provider !== ""
      && typeof model.model === "string" && model.model !== "") {
      await rpc("session.selectModel", { sessionId: session, provider: model.provider, model: model.model });
    }
    if (session !== sessionId) {
      // 本回合新建的 session：缺省仍拉一次 history 算 baseline（普通路径原序
      // create→selectModel→history→prompt）；评审 adapter 声明
      // skipBaselineHistoryWhenFresh（一次性会话无旧回合，构造即 0——与原评审
      // 路径 RPC 序列逐调用等价）。
      if (skipBaselineHistoryWhenFresh !== true) {
        baseline = baselineTurnOf(historyEventsOf(await rpc("session.history", { sessionId: session, maxMessages })));
      }
    } else {
      // 复用 session：prompt 前拉一次 history 算 baseline（防旧回合污染提取）。
      baseline = baselineTurnOf(historyEventsOf(await rpc("session.history", { sessionId: session, maxMessages })));
    }
    await rpc("session.prompt", {
      sessionId: session,
      mode: "queue",
      content: [{ type: "text", text: String(text) }]
    });
    while (now() - startedAt < timeoutMs) {
      callCheckAlive();
      // sleep 按剩余预算截断（评审监督契约：不得睡过 deadline 后才让下一次
      // rpc 撞上「runner 级超时」——与原评审循环一致；普通侧为轻微严格化）
      await sleep(Math.min(pollMs, Math.max(1, timeoutMs - (now() - startedAt))));
      callCheckAlive();
      const events = historyEventsOf(await rpc("session.history", { sessionId: session, maxMessages }));
      const ended = latestTurnEndAfter(events, baseline);
      if (ended === undefined) continue;
      // assistant 提取先于错误判定：病态「有文本又 error 收尾」时返回模型真实
      // 产出，不因终止原因丢弃已提交的文本。
      const assistant = assistantMessageFor(events, ended);
      if (assistant !== undefined) {
        callCheckAlive();
        return { text: assistantTextOf(assistant), sessionId: session };
      }
      // 错误终止（reason.kind=error）不会再有 assistant 消息可等——立即抛错，
      // 不烧满预算（2026-09-29 TK-20260929：400 工具名拒绝曾轮询至十分钟超时）。
      // 非 error 终止（blocked/aborted 等）不在实证范围，保持旧轮询语义。
      if (ended.data?.reason?.kind === "error") {
        throw new Error(`${errorLabel} turn ended in error: ${turnErrorTextOf(ended.data.reason)}`);
      }
      continue;
    }
    throw new Error(`${errorLabel} timed out after ${timeoutMs}ms`);
  }

  return { runPrompt };
}
