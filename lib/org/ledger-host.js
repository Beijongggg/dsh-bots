/**
 * 台账宿主接线（org-v2 05 号票）：值守轮询、异常汇入与 HTTP 命令／读面。
 *
 * 台账本体＝`lib/org/task-ledger.js`；**唯一写入口是它的命令面**，本模块不新增
 * 任何写通道（`V-A2.1` 的「bot 无台账文件直写通道」由此保持）。本模块做三件事：
 *
 *   1. **值守轮询**（`tick`）：租约回收（逾期未接／租约到期／实例死亡）＋重派封顶
 *      上浮＋连续越权达阈上浮（20 号票，§D——上浮判定在台账 sweep，本模块只回报
 *      与广播），全部经台账命令面落事件（`V-A2.5`）；结论按需广播 SSE `ledger`
 *      事件——载荷＝台账投影（`view()`），人间收件箱的数据源。
 *   2. **异常汇入**（`ingestAnomalies`）：把 v1 两处静默丢失（收单积压超限截断、
 *      回合失败不重试）从「只有日志」变成**台账事实**——每类异常开一张常设处置
 *      任务（值守例程，幂等键＝例程 id＋时间窗），异常本体作 `exception` 事件
 *      登记在该任务上，通知投影随之把事件推给用户（`V-A2.11`／`V-A2.12`）。
 *      读取面在 `lib/mail-plane.js`（receipts／outbox 的所属模块），本模块只做
 *      归因与登记。
 *   2b. **模型更迭评测登记**（`registerModelUpgradeEval`，12 号票 `V-A7.4` ①触发）：
 *      宿主接线在实例模型指派变更后调用，按岗位评测集逐样本登记 `class=duty`
 *      评测任务（计划＝`lib/org/durability.js planModelUpgradeEval`；本模块只落台账）。
 *   3. **HTTP 面**（`createLedgerHttpApi`）：`GET /api/bots/_ledger`（读投影）、
 *      `GET /api/bots/_ledger/notifications?cursor=`（通知投影）、
 *      `POST /api/bots/_ledger/commands`（命令面；变更方法已被 CSRF 令牌门控）、
 *      `GET /api/bots/_ledger/review-handoff`（复核移交件读，08 号票——帽信封门、
 *      读不消费 nonce，07 号票留界⑥的鉴权读落点）、`POST /api/bots/_ledger/reviews`
 *      （复核报告提交，08 号票——通道门＝入口预筛不消费帽，帽的验签与唯一消费点
 *      在台账腿（27 号票），响应携带续签帽）。
 *      路径用 `_ledger` 下划线前缀（bot id 字符集不含 `_`，不与 id 冲突）。
 *      **通道策略（06 号票）**：HTTP 上拒收 `actor.kind=host`（host 内部命令是
 *      进程内确定性组件专用，不得从通道冒名）；命令统一经 `dispatchCommand`
 *      出手（宿主接线装入 06 号票签发联动的 dispatcher，assign/accept/heartbeat
 *      返回件携带下一张 capability；未接线则直落台账命令面）。三元组鉴权本体在
 *      台账的 `authorize` 钩子（`lib/org/permissions.js`），不在本模块。
 *      知识腿（`knowledge.register|deprecate`）**不经台账本体**，故自带 actor 形状／
 *      归属门（30 号票：`knowledgeActorVerdict`），门序＝接线 → 形状 → 鉴权 → 执行。
 */
import { listMailAnomalies } from "../mail-plane.js";
import {
  PROBE_FAILURE_ROUTINE_ID,
  ROUTINE_REGISTRY,
  checkProbeFailureRoutineTrigger,
  expandRoutine
} from "./dispatch-config.js";
import { checkEvalRoutineTrigger, planModelUpgradeEval } from "./durability.js";
import { buildInbox } from "./human-inbox.js";
import { reviewHandoff } from "./review-kit.js";
import { reviewArtifacts } from "./review-artifacts.js";
import { canonicalJson, sha256Hex } from "./store-base.js";
import { isNonEmptyString } from "./is-non-empty-string.js";
import { HOST_CHANNEL_FORBIDDEN, knowledgeActorVerdict } from "./permissions.js";
import { BOT_ID_HEADER } from "./host-channel.js";

/** 异常汇入的节流窗（同一窗内多次 tick 只汇入一次；条目级去重另由幂等键把守）。 */
export const ANOMALY_WINDOW_MS = 10 * 60 * 1000;

/** 时间窗标识（ISO，按 windowMs 向下取整）——例程幂等键的「时间窗」分量。 */
export function windowKeyFor(atMs, windowMs = ANOMALY_WINDOW_MS) {
  return new Date(Math.floor(atMs / windowMs) * windowMs).toISOString();
}

/**
 * 台账宿主门面。依赖全注入：`ledger`（台账门面）、`now`（时钟）、
 * `readBotIds`（当前在册实例）、`isAlive`（实例活态判定，租约回收用）、
 * `broadcast`（SSE 广播；缺省不广播）、`logger`。
 */
export function createLedgerHost({
  ledger,
  dispatchCommand,
  now = () => Date.now(),
  readBotIds = () => [],
  isAlive = () => true,
  broadcast = () => {},
  logger,
  windowMs = ANOMALY_WINDOW_MS,
  reviewGate = null,
  issuer = null,
  authorizeCommand = null,
  knowledgeRegister = null,
  probeHostContract = null
} = {}) {
  if (!ledger || typeof ledger.command !== "function") throw new Error("createLedgerHost 需要台账门面");
  let lastAnomalyWindow = null;
  let lastProbeWindow = null;
  let lastProbeObservation = null;

  /**
   * 异常汇入：把投递面的两类异常登记进台账。
   * - 每类异常一张常设处置任务：例程 `duty-anomaly-<source>`、窗＝「异常源身份」
   *   （botId＋来源）——持续异常**不按时间窗反复开任务**，只把新条目作为异常事件
   *   追加到同一张处置任务上（条目级幂等键＝内容哈希）。
   * - `since`＝当前时间窗起点：只报本窗新增项，旧条目不重复告警。
   */
  async function ingestAnomalies(atMs = now()) {
    const botIds = readBotIds();
    if (botIds.length === 0) return [];
    const window = windowKeyFor(atMs, windowMs);
    let anomalies;
    try {
      anomalies = listMailAnomalies(ledger.dshHome, botIds, { since: Date.parse(window) });
    } catch (error) {
      logger?.warn?.(`[dsh-bots] 台账异常汇入：投递面读取失败（本次跳过）：${error?.message ?? error}`);
      return [];
    }
    const recorded = [];
    for (const anomaly of anomalies) {
      // 简报模板＝值守例程登记表（lib/org/dispatch-config.js，07 号票）：登记项
      // 声明式维护，展开产物过四要素简报校验（简报入事实源必校验的同一契约）
      const routineId = `duty-anomaly-${anomaly.source}`;
      const routine = await ledger.triggerRoutine({
        routineId,
        // 窗＝异常源身份（botId＋来源）：持续异常只开一张处置任务，不按时间窗反复开
        window: `${anomaly.botId}:${anomaly.source}`,
        brief: expandRoutine(routineId, { botId: anomaly.botId })
      });
      if (!routine.ok) {
        logger?.warn?.(`[dsh-bots] 台账异常汇入：处置任务登记失败（${routine.code}）：${routine.reason}`);
        continue;
      }
      const refs = [...anomaly.refs].sort();
      const raised = await ledger.raiseException({
        taskId: routine.taskId,
        kind: anomaly.kind,
        detail: { botId: anomaly.botId, source: anomaly.source, count: anomaly.count, refs, window },
        idempotencyKey: `anomaly:${anomaly.source}:${anomaly.botId}:${sha256Hex(canonicalJson(refs)).slice(0, 16)}`
      });
      if (!raised.ok) {
        logger?.warn?.(`[dsh-bots] 台账异常汇入：异常登记失败（${raised.code}）：${raised.reason}`);
        continue;
      }
      if (raised.replayed !== true) {
        recorded.push({ taskId: routine.taskId, botId: anomaly.botId, source: anomaly.source, count: anomaly.count });
      }
    }
    return recorded;
  }

  /**
   * 模型更迭升级例程①触发（12 号票 `V-A7.4`）：实例模型指派变更 → 按岗位评测集
   * 逐样本登记 `class=duty` 评测任务（例程 id＝`eval-<样本 id>`，触发源声明见
   * `lib/org/durability.js MODEL_UPGRADE_TRIGGER_SOURCE`／登记表，幂等窗＝实例×样本×目标指派）。计划由
   * `lib/org/durability.js planModelUpgradeEval` 出（纯函数，四类跳过情形点名理由）；
   * 本模块只负责落台账与告警——**不新造写通道**（仍走 `ledger.triggerRoutine`）。
   * 登记成功即广播投影（人间收件箱与 SSE 立即可见）。
   */
  async function registerModelUpgradeEval({ botId, post, before, after } = {}) {
    const plan = planModelUpgradeEval({ botId, post, before, after });
    if (plan.action !== "register") {
      logger?.warn?.(`[dsh-bots] 模型指派变更未登记评测任务（跳过）：${plan.reason}`);
      return { ...plan, registered: [] };
    }
    const registered = [];
    for (const assignment of plan.assignments) {
      // 触发器核验前置（fail closed）：登记项声明的触发源须正是模型指派变更——
      // 登记表被改坏／别的例程被塞进本腿，都在落台账**之前**响亮失败
      const entry = ROUTINE_REGISTRY.find((item) => item.routineId === assignment.routineId);
      const trigger = entry === undefined
        ? { ok: false, code: "eval-routine-missing", reason: `评测例程未登记：${assignment.routineId}` }
        : checkEvalRoutineTrigger(entry);
      if (!trigger.ok) {
        logger?.warn?.(`[dsh-bots] 模型更迭评测任务登记失败（${String(trigger.code)}）：${String(trigger.reason)}`);
        registered.push({ ...assignment, ok: false, code: trigger.code, reason: trigger.reason });
        continue;
      }
      const brief = expandRoutine(assignment.routineId, assignment.vars);
      const result = await ledger.triggerRoutine({
        routineId: assignment.routineId,
        window: assignment.window,
        brief
      });
      if (!result.ok) {
        logger?.warn?.(
          `[dsh-bots] 模型更迭评测任务登记失败（${String(result.code)}）：${String(result.reason)}` +
          `（例程 ${assignment.routineId}，实例 ${String(botId)}）`
        );
        registered.push({ ...assignment, ok: false, code: result.code ?? null, reason: result.reason ?? null });
        continue;
      }
      registered.push({ ...assignment, ok: true, taskId: result.taskId, replayed: result.replayed === true });
    }
    // 登记尝试后无条件广播：成功与失败（前置门拒、落台账失败）都可能改变投影
    // （拒绝路径的台账留痕）——失败留痕不等下一拍，人间收件箱即时可见
    broadcastProjection();
    return { ...plan, registered };
  }

  /**
   * 探针失效承载（14 号票 `V-A6.7`；规格 §H「失效可见可归因：探针失败或运行面跳过以
   * **class=duty 例程任务**落台账承载处置（**不新增台账事件类型**）并按人间接口告知」）。
   *
   * 形态与异常汇入同构（`ingestAnomalies`）：例程 `duty-probe-failure` 开一张处置任务
   * （`triggerRoutine` → `class=duty`），失效本体作**既有 `exception` 事件**登记在该任务上
   * ——异常类别取四类之内的 `waiting-external`（宿主面失效＝等外部依赖恢复），台账事件
   * 词表零扩条。失效随通知投影进人间收件箱（`exception → user`），失败可归因。
   *
   * 幂等两段：①任务级＝例程 id＋窗（窗＝`probe:<探针 id>`）——同一探针持续失效只开一张
   * 处置任务，不按时间窗反复开；②条目级＝失效内容哈希——同因重复登记只留一条异常。
   * 登记尝试后**无条件广播投影**（12 号票纪律：拒绝路径的留痕不等下一拍）。
   *
   * 调用方＝宿主侧巡检编排（探针 FAIL，或运行面／部署面上 SKIP——SKIP 视同 FAIL 的
   * 判定在门侧，本腿只承载结论）；本模块不新增写通道（仍走台账命令面）。
   */
  async function registerProbeFailure({ probeId, face, reason } = {}) {
    if (!isNonEmptyString(probeId)) {
      return { ok: false, code: "probe-failure-args", reason: "probeId 必填（失效的探针 id）" };
    }
    if (!isNonEmptyString(face)) {
      return { ok: false, code: "probe-failure-args", reason: "face 必填（失效的面 id）" };
    }
    const detail = {
      probeId,
      face,
      reason: isNonEmptyString(reason) ? reason : "(探针未给原因)"
    };
    // 登记项声明的触发源是**承重的**：本腿只承载「宿主面探针失效」这一路——登记表被改坏
    // （例程缺位／触发源换成别的来源）即在本腿落台账**之前**响亮失败（同 12 号票评测腿
    // 的触发源核验口径：注册表与消费腿共用单一声明，改一处不静默改口径）
    const trigger = checkProbeFailureRoutineTrigger(
      ROUTINE_REGISTRY.find((item) => item.routineId === PROBE_FAILURE_ROUTINE_ID)
    );
    if (!trigger.ok) {
      logger?.warn?.(`[dsh-bots] 探针失效承载失败（${String(trigger.code)}）：${String(trigger.reason)}`);
      return { ...probeFailureVerdict(false), code: trigger.code, reason: trigger.reason };
    }
    // 模板展开失败同样响亮失败（不产出一张空处置任务）
    let brief;
    try {
      brief = expandRoutine(PROBE_FAILURE_ROUTINE_ID, detail);
    } catch (error) {
      const reasonText = String(error?.message ?? error);
      logger?.warn?.(`[dsh-bots] 探针失效承载失败（probe-failure-routine-missing）：${reasonText}`);
      return { ...probeFailureVerdict(false), code: "probe-failure-routine-missing", reason: reasonText };
    }
    const routine = await ledger.triggerRoutine({
      routineId: PROBE_FAILURE_ROUTINE_ID,
      window: `probe:${probeId}`,
      brief
    });
    const raised = routine.ok
      ? await ledger.raiseException({
        taskId: routine.taskId,
        kind: "waiting-external",
        detail,
        idempotencyKey: `probe-failure:${probeId}:${sha256Hex(canonicalJson(detail)).slice(0, 16)}`
      })
      : null;
    if (!routine.ok || raised?.ok !== true) {
      const failure = routine.ok ? raised : routine;
      logger?.warn?.(
        `[dsh-bots] 探针失效承载失败（${String(failure.code)}）：${String(failure.reason)}` +
        `（探针 ${probeId}／面 ${face}）`
      );
      broadcastProjection(); // 失败留痕同样即时可见（不等下一拍）
      return {
        ...probeFailureVerdict(false, routine.ok ? routine.taskId : null),
        code: failure.code ?? null, reason: failure.reason ?? null
      };
    }
    if (raised.replayed !== true) broadcastProjection();
    return probeFailureVerdict(true, routine.taskId, {
      routineReplayed: routine.replayed === true,
      exceptionReplayed: raised.replayed === true
    });
  }

  /**
   * 探针失效承载结论的**单一返回形状**（两条分支同形：成功与失败都带同样五个字段，
   * 调用方不必按分支猜字段）——`code`／`reason` 缺省 null。
   */
  function probeFailureVerdict(ok, taskId = null, { routineReplayed = false, exceptionReplayed = false } = {}) {
    return { ok, taskId, routineReplayed, exceptionReplayed, code: null, reason: null };
  }

  /** 一次值守轮询：回收租约 → 汇入异常（按窗节流）→ 需要时广播投影。 */
  async function tick({ at = now() } = {}) {
    host.delivery?.tick();
    const swept = await ledger.sweep({ at, isInstanceAlive: isAlive });
    const window = windowKeyFor(at, windowMs);
    let anomalies = [];
    if (lastAnomalyWindow !== window) {
      lastAnomalyWindow = window;
      anomalies = await ingestAnomalies(at);
    }
    const probeFailures = [];
    if (probeHostContract !== null && lastProbeWindow !== window) {
      let report;
      try {
        report = await probeHostContract();
        if (report?.face !== "deploy" || !Array.isArray(report.results) || report.results.length === 0
          || report.results.some((row) => !isNonEmptyString(row?.probeId) || !isNonEmptyString(row?.face)
            || !["PASS", "FAIL", "SKIP"].includes(row.state))) {
          throw new Error("宿主探针报告缺失或畸形");
        }
      } catch (error) {
        report = { results: [{
          probeId: "P-HOST-CONTRACT-RUNNER", face: "host-contract-runner", state: "FAIL",
          reason: String(error?.message ?? error)
        }] };
      }
      lastProbeObservation = { checkedAt: now(), report };
      for (const result of report.results) {
        if (result.state === "PASS") continue;
        const recorded = await registerProbeFailure(result);
        if (!recorded.ok) throw new Error(`探针失效登记失败：${recorded.code}`);
        if (!recorded.exceptionReplayed) probeFailures.push({ ...result, taskId: recorded.taskId });
      }
      lastProbeWindow = window;
    }
    const view = ledger.view();
    const payload = {
      ...view,
      swept: {
        released: swept.released.length,
        escalated: swept.escalated.length,
        stalled: swept.stalled.length,
        unauthorized: swept.unauthorized?.length ?? 0
      }
    };
    return {
      ...swept, anomalies, probeFailures, view: payload,
      changed: (swept.released.length + swept.escalated.length + swept.stalled.length +
        (swept.unauthorized?.length ?? 0) + anomalies.length) > 0
    };
  }

  /** 广播台账投影（SSE `ledger` 事件）；只在确有变化时调用，避免空帧。 */
  function broadcastProjection() {
    const view = ledger.view();
    broadcast("ledger", view);
    return view;
  }

  const host = {
    ledger, dispatchCommand, now, tick, ingestAnomalies, broadcastProjection, windowMs,
    registerModelUpgradeEval, registerProbeFailure,
    probeStatus: () => lastProbeObservation,
    reviewGate, issuer, authorizeCommand, knowledgeRegister
  };
  return host;
}

/** 台账值守轮询间隔（租约回收＋异常汇入；与邮件监视器同一量级）。 */
export const LEDGER_TICK_MS = 5000;

/**
 * 启动台账值守（接线层只把 ctx.effect 指向本函数）：每拍执行一次 `host.tick()`，
 * 逐条记录回收/上浮/异常告警，有变化时广播 SSE `ledger` 投影。**disposer 释放台账
 * 写锁**——插件卸载（宿主停机/热重载）时不留悬空写锁，重启后的新宿主可直接取得
 * 写锁（锁的死亡证明接管仍是兜底）。
 */
export function startLedgerTicker({ host, intervalMs = LEDGER_TICK_MS, logger } = {}) {
  if (!host) return () => {};
  /**
   * 记录一拍结论（日志逐类）。`tick` 是异步的（命令面 25 号票起 async——关闭前置要
   * 现跑验收判据），故本函数不再是 try/catch 的同步块，错误由 `tick` 统一兜住。
   */
  const recordTick = (result) => {
    for (const item of result.released) {
      logger?.warn?.(`[dsh-bots] 台账：租约回收 ${item.taskId}（${item.cause}，第 ${String(item.dispatchCount)} 次派单）`);
    }
    for (const item of result.escalated) {
      logger?.warn?.(`[dsh-bots] 台账：重派封顶，上浮用户终裁 ${item.taskId}（${item.cause}）`);
    }
    for (const item of result.stalled ?? []) {
      logger?.warn?.(`[dsh-bots] 台账：队列滞留处置 ${item.taskId}（${item.from} → ${item.action}）`);
    }
    for (const item of result.exceptionFailures ?? []) {
      logger?.warn?.(`[dsh-bots] 台账：异常登记失败（响亮回报，处置照做）${item.taskId}（${String(item.kind)}，${String(item.code)}）`);
    }
    for (const item of result.unauthorized ?? []) {
      logger?.warn?.(`[dsh-bots] 台账：连续越权达阈 ${item.actor}（连续 ${String(item.count)} 次：${item.taskIds.join("、")}）` +
        (item.escalatedTaskId !== null
          ? `——上浮用户终裁 ${item.escalatedTaskId}（越权处置永不可代）`
          : "——通知派单方"));
    }
    for (const item of result.anomalies) {
      logger?.warn?.(`[dsh-bots] 台账：投递面异常入账 ${item.source}（${item.botId}，${String(item.count)} 条）→ 处置任务 ${item.taskId}`);
    }
    if (result.changed) host.broadcastProjection();
  };

  let inFlight = false; // 异步 tick 不得重叠（命令面 async 后一拍可能跨过下一拍）
  const tick = () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const pending = host.tick();
      // `host.tick` 既可同步抛（构造/读面错）也可异步拒（命令面路径）：两路都归到
      // 同一条「下拍重试」告警，不静默吞掉（fail loud 的运维面口径）
      Promise.resolve(pending)
        .then(recordTick)
        .catch((error) => {
          logger?.warn?.(`[dsh-bots] 台账值守扫描异常（下拍重试）：${error instanceof Error ? error.message : String(error)}`);
        })
        .finally(() => { inFlight = false; });
    } catch (error) {
      inFlight = false;
      logger?.warn?.(`[dsh-bots] 台账值守扫描异常（下拍重试）：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  tick(); // 启动即回收一次（宿主重启后的过期租约立即归位）
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    try { host.ledger?.close?.(); } catch { /* 锁已不在 */ }
  };
}

/** 复核帽信封头解析（GET 移交件读面；坏头当畸形信封，由验签腿 fail closed）。 */
function parseCapabilityHeader(raw) {
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return { payload: raw, sig: "" };
  }
}

/**
 * 台账 HTTP 面。`json`／`readBody` 由接线层注入（注入式构造，便于库直测）。
 * 台账未接线（api.ledgerHost 缺失）→ 404，与门控接线对称。
 */
export function createLedgerHttpApi({ json, readBody, routeSegments }) {
  return async function handleLedgerApi(req, res, api) {
    const segs = routeSegments(req);
    const host = api?.ledgerHost;
    if (!host) return json(res, 404, { error: "not found" });
    const tail = segs.slice(3); // segs[2] === "_ledger"
    if (tail.length === 0) {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      return json(res, 200, host.ledger.view());
    }
    if (tail.length === 1 && tail[0] === "notifications") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      const cursor = Number(new URL(req.url, "http://127.0.0.1").searchParams.get("cursor") ?? 0);
      return json(res, 200, host.ledger.notificationsAfter(Number.isInteger(cursor) && cursor > 0 ? cursor : 0));
    }
    if (tail.length === 1 && tail[0] === "tasks") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      return json(res, 200, { tasks: host.ledger.tasks() });
    }
    if (tail.length === 1 && tail[0] === "delivery") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      if (!host.delivery) return json(res, 503, { ok: false, code: "delivery-unwired" });
      const result = host.delivery.read(await readBody(req), req.headers[BOT_ID_HEADER]);
      return json(res, result.ok ? 200 : 403, result);
    }
    if (tail.length === 1 && tail[0] === "readiness") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      if (!host.readiness) return json(res, 503, { ok: false, code: "readiness-unwired" });
      const result = host.readiness();
      return json(res, result.ok ? 200 : 503, result);
    }
    // 人间收件箱（09 号票，V-A5.2）：待裁项（挂起任务＋裁定包＋可选终裁动作＋
    // 到期／永不可代标注）与告知项（交付回笼／取消失败／越权计数）的直接投影。
    // 只读：终裁仍走 POST /commands（actor=user，CSRF 门内），本面不提供写路径。
    if (tail.length === 1 && tail[0] === "inbox") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      const cursor = Number(new URL(req.url, "http://127.0.0.1").searchParams.get("cursor") ?? 0);
      const at = typeof host.now === "function" ? host.now() : Date.now();
      return json(res, 200, buildInbox({
        ledger: host.ledger,
        now: at,
        cursor: Number.isInteger(cursor) && cursor > 0 ? cursor : 0
      }));
    }
    // 复核面（08 号票）：移交件读（鉴权读不消费 nonce；07 号票留界⑥的落点）
    if (tail.length === 1 && tail[0] === "review-handoff") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      if (!host.reviewGate) return json(res, 404, { error: "not found" });
      const taskId = new URL(req.url, "http://127.0.0.1").searchParams.get("taskId") ?? "";
      if (host.delivery && !host.delivery.activeReview(req.headers[BOT_ID_HEADER], {
        taskId, requestSeq: Number(req.headers["x-dsh-bots-review-request"])
      })) return json(res, 403, { ok: false, code: "review-session-inactive" });
      const verdict = host.reviewGate.authorizeHandoff({
        envelope: parseCapabilityHeader(req.headers["x-dsh-bots-capability"]),
        botId: req.headers[BOT_ID_HEADER],
        taskId
      });
      if (!verdict.ok) return json(res, 403, { ok: false, code: verdict.code, reason: verdict.reason });
      const task = host.ledger.task(taskId);
      if (task === null) {
        return json(res, 404, { ok: false, code: "task-not-found", reason: `任务不存在：${taskId}` });
      }
      const artifactId = new URL(req.url, "http://127.0.0.1").searchParams.get("artifactId");
      const artifacts = reviewArtifacts({ ledger: host.ledger, task, artifactId });
      if (!artifacts.ok) return json(res, 403, artifacts);
      return json(res, 200, artifactId === null
        ? { ...reviewHandoff({ task, events: host.ledger.events({ taskId }), taskId }), artifacts: artifacts.artifacts }
        : { taskId, artifact: artifacts.artifact });
    }
    // 复核面（08 号票）：报告提交（通道门＝**入口预筛**，不消费帽；帽的验签与
    // 唯一消费点在台账腿——27 号票；成功响应携带续签帽）
    if (tail.length === 1 && tail[0] === "reviews") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      if (!host.reviewGate) return json(res, 404, { error: "not found" });
      const body = await readBody(req);
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return json(res, 400, { ok: false, code: "invalid-review-body", reason: "报告体须为对象" });
      }
      const botId = body.actor?.id;
      if (host.delivery && (body.taskId !== body.review?.taskId || !host.delivery.activeReview(botId, body.review))) {
        return json(res, 403, { ok: false, code: "review-session-inactive" });
      }
      const verdict = host.reviewGate.authorizeReport({ envelope: body.capability, botId, taskId: body.taskId });
      if (!verdict.ok) return json(res, 403, { ok: false, code: verdict.code, reason: verdict.reason });
      // 信封随命令**传下去**：台账腿是权威门（进程内直调同门），它做预验＋帽腿＋
      // 唯一一次消费；通道门只把入口关（无帽／他人帽／非复核帽／未被指定在此 403）。
      const result = await host.ledger.recordReviewReport({
        taskId: body.taskId, reviewer: botId, report: body.report, capability: body.capability,
        idempotencyKey: body.idempotencyKey
      });
      host.broadcastProjection();
      // 链式续签（06 号票纪律在复核面的兑现；21 号票 ① 收口；27 号票对齐命令面口径）：
      // 续签条件＝**入账成功，或拒绝发生在帽腿之后**（台账回执带 `authorized: true`
      // ＝授权有效且信封已被本次提交消费）——授权通过而报告被拒（review-not-requested／
      // reviewer-is-producer 等常态拒绝）照样续签，否则旧帽已消费而连报断链，须 host
      // 干预才能恢复。预筛 403（未携帽／帽不属本人／非复核帽／未被指定）与**帽腿之前
      // 的拒绝**（含已消费旧帽的重放：预筛看不见 nonce，只有消费点能看见）都不续签
      // ——越权尝试不得换来新信封，一张旧帽也换不出新帽。签发权仍在 host。
      // 幂等重放返回的是首次结论，ok／authorized 不代表本次消费；照命令通道
      // 的规则不重签，随重放带来的新帽也不被消费。
      let capability;
      if (result.replayed !== true && host.issuer !== null && (result.ok === true || result.authorized === true)) {
        const next = host.issuer.issueRoleCapability({ botId, post: "verifier" });
        if (next.ok) capability = next.envelope;
      }
      if (capability) host.delivery?.keep(capability);
      return json(res, result.ok ? 200 : 409, { ...result, capability });
    }
    if (tail.length === 1 && tail[0] === "commands") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      const body = await readBody(req);
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return json(res, 400, { ok: false, code: "invalid-command-body", reason: "命令体须为对象" });
      }
      // 通道策略（06 号票，V-A3.10）：host 是进程内确定性组件的身份，不得从
      // HTTP 通道声明——人间面用 kind=user（CSRF 门已把守），岗位实例用
      // kind=post＋capability 信封（三元组鉴权在台账 authorize 钩子）。
      if (body.actor?.kind === "host") {
        return json(res, 403, { ok: false, ...HOST_CHANNEL_FORBIDDEN });
      }
      // 宿主侧执行面 op（10 号票 `V-A4.5`）：knowledge.register **不是台账命令**，
      // 不入台账状态机、不落事件（登记不构成任务完成依据），但写共享面——故走
      // 本拦截腿：先过与台账同一张能力鉴权门（三元组），再在 **host 进程内**执行
      // 登记。bot 侧因此没有共享面写通道（`generateKnowledgeRegister` 由宿主接线
      // 注入 `lib/knowledge.js registerReport`；未接线＝503 fail closed，不降级）。
      if (body.op === "knowledge.register" || body.op === "knowledge.deprecate") {
        // 未接线＝503 fail closed：鉴权面与执行面**都是硬前置**，缺一即拒
        // （「未接线就跳过鉴权」是 fail-open——共享面写者绝不许走到那条路）
        if (typeof host.knowledgeRegister !== "function" || typeof host.authorizeCommand !== "function") {
          return json(res, 503, {
            ok: false, code: "knowledge-command-unwired",
            reason: "宿主未接线知识命令面（鉴权或执行面缺失，fail closed——无 bot 侧降级直写通道）"
          });
        }
        // actor 形状门（30 号票）：本腿自称「与台账同一张门」，但台账门对 actor
        // 缺席／畸形**直接放行**（user＝全权、host＝进程内组件），形状校验住在台账
        // 本体（`task-ledger.command` 的 isValidActor）；本腿不经台账本体，故须自己
        // 过**同一形状口径**（同源 `knowledgeActorVerdict`，不另抄）。
        // 门序＝形状在鉴权**之前**：形状负例不得烧掉随体信封（负例不消耗、零落盘），
        // 也不得走到执行面；接线门（503）在更前面——宿主态缺失与请求形状无关。
        const actorVerdict = knowledgeActorVerdict(body.actor);
        if (!actorVerdict.ok) {
          return json(res, 403, { ok: false, code: actorVerdict.code, reason: actorVerdict.reason });
        }
        let verdict;
        try {
          verdict = host.authorizeCommand({ op: body.op, actor: body.actor, capability: body.capability });
        } catch (error) {
          return json(res, 403, {
            ok: false, code: "capability-malformed",
            reason: `能力信封不可用（${error?.message ?? String(error)}）`
          });
        }
        // 只有显式 ok:true 才放行（undefined/畸形结论一律当拒绝——同复核腿惯用法）
        if (verdict?.ok !== true) {
          return json(res, 403, {
            ok: false,
            code: verdict?.code ?? "unauthorized",
            reason: verdict?.reason ?? "鉴权拒绝（fail closed）"
          });
        }
        const result = await host.knowledgeRegister({ op: body.op, payload: body.payload ?? {}, botId: body.actor?.id });
        if (body.actor.kind === "post" && host.issuer) {
          const next = host.issuer.issueRoleCapability({ botId: body.actor.id, post: verdict.payload.post });
          if (next.ok) {
            host.delivery?.keep(next.envelope);
            return json(res, result.ok ? 200 : 409, { ...result, capability: next.envelope });
          }
          return json(res, 503, { ...result, capabilityError: { code: next.code, reason: next.reason } });
        }
        return json(res, result.ok ? 200 : 409, result);
      }
      // 所有 op（含 task.judge／task.exception）统一走命令面：op 名与校验只在台账内一处；
      // dispatchCommand＝签发联动 dispatcher（06 号票接线）。未接线时直落台账命令面：
      // 鉴权不受影响（三元组在台账 authorize 钩子内，与 dispatcher 无关），缺的只是
      // 返回件的能力续签联动。
      const dispatch = typeof host.dispatchCommand === "function" ? host.dispatchCommand : (input) => host.ledger.command(input);
      let result = await dispatch(body);
      if (host.delivery) result = host.delivery.afterCommand(body, result);
      // 拒绝亦记台账事件 → 投影变化也要广播（人间收件箱看得到拒绝）
      host.broadcastProjection();
      return json(res, result.ok ? 200 : 409, result);
    }
    return json(res, 404, { error: "not found" });
  };
}
