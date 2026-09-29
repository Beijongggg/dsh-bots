/**
 * bot→host 组织命令通道（org-v2 07 号票；规格 §D「capability 递送不经 mail」、
 * §E「简报与 capability 信封经接单响应携带」与附录 A `V-A4.3`／`V-A4.6`）。
 *
 * bot 实例侧的组织命令 dispatch：岗位工具（op-set 工具面派生）的 execute 注入
 * 本通道，op 路由三路——
 *   1. `ledger.read`：GET `/api/bots/_ledger`（只读投影，公开读面）；
 *   2. `evidence.probe`（执行面）：**判据真源＝台账投影里的简报预登记**——只收
 *      `{taskId, index}`（模型无入口自带判据文本，「不得自报判据」）；台账简报
 *      与本地持有件逐字比对（`criterionMatches`，canonical 口径）后才经探针
 *      白名单执行（`runCriterion`，fail closed）；
 *   3. `review.report`／`artifact.read`（08 号票复核面）：报告 POST
 *      `/api/bots/_ledger/reviews`（actor kind=post＋CSRF 令牌＋帽信封）；移交件
 *      GET `/api/bots/_ledger/review-handoff?taskId=`（帽信封随头携带）。复核帽
 *      与命令能力**分槽持有**（帽＝role 信封 post=verifier；命令链信封互不覆盖），
 *      报告响应携带的续签帽被捕获回持；首帽由 host 在复核请求成功后签发，
 *      delivery 通道只向该次 fresh-context 会话递送；
 *   4. 其余＝台账命令：POST `/api/bots/_ledger/commands`，actor 固定
 *      `kind:"post"`＋本 bot id，附持有的 capability 信封与 CSRF 令牌头
 *      （变更面令牌会话，GET `/api/bots/_csrf` 引导；403 csrf-* 重取重试一次）。
 *
 * **链式能力持有侧**（06 号票 dispatcher 语义的对面）：每响应携带的
 * `capability` 随下一命令回传，角色、任务与帽分槽持有。首张角色能力在父子
 * IPC 绑定代际后由 host 签发；任务能力在派单点签发，均经认证 delivery 领取。
 * **接单即得契约**：`task.accept` 成功响应携带的 `task.brief` 被捕获持有，
 * 作为探针逐字比对的本地持有件（stale/tamper tripwire）；amend 通知到达后经
 * `brief.refresh` 把持有件重同步为台账真源（19 号票②——读面驱动、只许当前
 * 归属者，刷新后探针恢复可用）。
 */
import { criterionMatches, runCriterion } from "./probe.js";
import { BOT_ID_HEADER, createHostChannel } from "./host-channel.js";
import { OP_SET, TASK_SCOPED_OPS } from "./op-set.js";

export function createPostChannel({ origin, botId, probeCtx, fetchImpl = fetch, logger, credential = null, review = null } = {}) {
  if (typeof origin !== "string" || origin === "") throw new Error("createPostChannel 需要 host origin");
  if (typeof botId !== "string" || botId === "") throw new Error("createPostChannel 需要 botId");
  if (typeof fetchImpl !== "function") throw new Error("createPostChannel 需要 fetch 实现");
  // CSRF 会话与变更面投递口径＝共用原语（11 号票抽件；邮件通道腿同源，08 号票
  // 的「403 csrf-* 重取重试一次」纪律只此一份）
  const channel = createHostChannel({ origin, botId, fetchImpl, logger });
  const getJson = (path) => channel.getJson(path);
  let capability = null; // 最近一次响应携带的信封（链式持有）
  let reviewHat = null; // 复核帽信封（08 号票；与命令链信封分槽持有）
  let roleCapability = null;
  const taskCapabilities = new Map();
  const heldBriefs = new Map(); // taskId → 接单响应捕获的简报（逐字比对的本地持有件）

  function capture(envelope) {
    if (!envelope || envelope.payload?.botId !== botId) return;
    if (envelope.payload.post === "verifier") reviewHat = envelope;
    else if (envelope.payload.kind === "role") roleCapability = envelope;
    else if (envelope.payload.kind === "task") taskCapabilities.set(envelope.payload.taskId, envelope);
    else capability = envelope; // Legacy injected transports do not supply a typed envelope.
  }

  async function receiveGrants() {
    if (credential === null) return { ok: true };
    const identity = credential();
    if (!identity) return { ok: false, code: "delivery-unavailable", reason: "父进程尚未绑定本实例组织通道" };
    const { body } = await channel.postJson("/api/bots/_ledger/delivery",
      { ...identity, ...(review ? { review } : {}) }, { [BOT_ID_HEADER]: botId });
    if (body?.ok !== true) return body;
    roleCapability = null;
    reviewHat = null;
    taskCapabilities.clear();
    for (const envelope of body.capabilities ?? []) capture(envelope);
    return { ok: true };
  }

  async function readLedgerView() {
    const { body } = await getJson("/api/bots/_ledger");
    return body;
  }

  /** 投影内定位任务（共用原语）：读台账视图并按 taskId 取任务投影；视图不可读
   *  或任务不在时返回 {error}/{task:null}，拒绝码由调用方按各自路由面处置。 */
  async function fetchLedgerTask(taskId) {
    let view;
    try {
      if (review !== null) {
        const handoff = await readHandoff({ taskId });
        if (handoff.status !== 200) throw new Error(handoff.body?.reason ?? "复核移交件不可读");
        return { task: handoff.body };
      }
      view = await readLedgerView();
    } catch (error) {
      return { error };
    }
    return { task: (view?.tasks ?? []).find((entry) => entry.taskId === taskId) ?? null };
  }

  /** 执行面路由：判据真源＝台账投影；持有件逐字比对后才跑白名单。 */
  async function runProbe(args) {
    const { taskId, index } = args ?? {};
    if (typeof taskId !== "string" || taskId === "" || !Number.isInteger(index) || index < 0) {
      return { ok: false, code: "probe-args", reason: "evidence.probe 只收 {taskId, index}（判据由台账预登记，不收调用方判据文本）" };
    }
    const located = await fetchLedgerTask(taskId);
    if (located.error !== undefined) {
      return { ok: false, code: "probe-ledger-unreadable", reason: `台账投影不可读（fail closed）：${located.error.message}` };
    }
    const task = located.task;
    if (task === null) return { ok: false, code: "probe-task-unknown", reason: `台账无任务：${taskId}` };
    if (task.brief === null || task.brief === undefined) {
      return { ok: false, code: "probe-no-brief", reason: "任务无预登记判据（模型不得自报判据）" };
    }
    const held = heldBriefs.get(taskId);
    if (held !== undefined && !criterionMatches(held, task.brief)) {
      return { ok: false, code: "probe-stale-brief", reason: "本地持有简报与台账真源不一致（amend 后未重新接单——逐字一致校验失败）" };
    }
    const criterion = task.brief.acceptance?.[index];
    if (criterion === undefined) {
      return { ok: false, code: "probe-index", reason: `判据索引越界（共 ${String(task.brief.acceptance?.length ?? 0)} 条）` };
    }
    return runCriterion(criterion, probeCtx ?? {});
  }

  /**
   * 持有件刷新（org-v2 19 号票②）：amend 显式通知承接方后，本 op 把本地持有
   * 简报重同步为台账真源——探针的逐字比对 tripwire（probe-stale-brief）由此
   * 恢复可用，合法修改路径不再打成死路。只许当前归属者刷新（持有件＝承接方
   * 接单契约）；读面驱动（GET 台账投影＋本地状态更新），不落台账事件。
   */
  async function refreshBrief(args) {
    if (typeof args?.taskId !== "string" || args.taskId === "") {
      return { ok: false, code: "brief-refresh-args", reason: "brief.refresh 只收 {taskId}" };
    }
    const located = await fetchLedgerTask(args.taskId);
    if (located.error !== undefined) {
      return { ok: false, code: "brief-refresh-ledger-unreadable", reason: `台账投影不可读（fail closed）：${located.error.message}` };
    }
    const task = located.task;
    if (task === null) return { ok: false, code: "brief-refresh-task-unknown", reason: `台账无任务：${args.taskId}` };
    if (task.owner !== botId) {
      return { ok: false, code: "brief-refresh-not-owner", reason: `只有当前归属者可刷新持有件（owner=${String(task.owner ?? "(无)")}）` };
    }
    if (task.brief === null || task.brief === undefined) {
      return { ok: false, code: "brief-refresh-no-brief", reason: "任务无简报可同步" };
    }
    heldBriefs.set(args.taskId, task.brief);
    return { ok: true, taskId: args.taskId, brief: task.brief };
  }

  /** 变更面投递（命令面与复核面同语义；CSRF 纪律在共用原语内）。 */
  const postWithCsrfRetry = (payload, path = "/api/bots/_ledger/commands") => channel.postJson(path, payload);

  /** 复核帽捕获：响应携带 post=verifier 的信封即回持（续签链的帽侧）。 */
  function captureReviewHat(body) {
    if (body?.capability?.payload?.post === "verifier") reviewHat = body.capability;
  }

  /**
   * 复核报告提交（08 号票）：帽信封随体携带；**单次消费在台账腿**（27 号票——
   * 通道只做入口预筛），续签帽随响应捕获。
   */
  async function submitReview(args) {
    if (args?.report === undefined || args?.report === null || typeof args?.report !== "object") {
      return { ok: false, code: "review-report-required", reason: "review.report 须携带 report 对象" };
    }
    const payload = {
      taskId: args.taskId,
      actor: { kind: "post", id: botId },
      report: args.report,
      idempotencyKey: args.idempotencyKey
    };
    if (review) payload.review = review;
    if (reviewHat !== null) payload.capability = reviewHat;
    const final = await postWithCsrfRetry(payload, "/api/bots/_ledger/reviews");
    captureReviewHat(final.body);
    return final.body;
  }

  /** 复核移交件读（08 号票）：帽信封随头携带（读面不消费 nonce）。 */
  async function readHandoff(args) {
    if (typeof args?.taskId !== "string" || args.taskId === "") {
      return { ok: false, code: "artifact-read-args", reason: "artifact.read 须给 taskId，可加 artifactId 读取登记工件正文" };
    }
    const headers = { [BOT_ID_HEADER]: botId };
    if (review) headers["x-dsh-bots-review-request"] = String(review.requestSeq);
    if (reviewHat !== null) headers["x-dsh-bots-capability"] = JSON.stringify(reviewHat);
    const response = await fetchImpl(
      `${origin}/api/bots/_ledger/review-handoff?taskId=${encodeURIComponent(args.taskId)}`
        + (args.artifactId === undefined ? "" : `&artifactId=${encodeURIComponent(args.artifactId)}`),
      { method: "GET", headers }
    );
    return { status: response.status, body: await response.json() };
  }

  async function postCommand(args, op) {
    const payload = {
      op,
      taskId: args.taskId,
      actor: { kind: "post", id: botId },
      idempotencyKey: args.idempotencyKey,
      payload: args.payload ?? {}
    };
    if (args.expectedStatus !== undefined) payload.expectedStatus = args.expectedStatus;
    if (args.expectedSeq !== undefined) payload.expectedSeq = args.expectedSeq;
    const held = TASK_SCOPED_OPS.includes(op) ? taskCapabilities.get(args.taskId) : roleCapability;
    if (held ?? capability) payload.capability = held ?? capability;
    return postWithCsrfRetry(payload);
  }

  async function dispatch(op, args = {}) {
    if (review && (!OP_SET.verifier.includes(op) || args.taskId !== review.taskId)) {
      return { ok: false, code: "review-scope", reason: "复核会话只可操作被召集的任务与复核工具" };
    }
    if (op === "ledger.read") {
      return readLedgerView();
    }
    const received = await receiveGrants();
    if (received?.ok !== true) return received;
    if (op === "review.report") {
      return submitReview(args);
    }
    if (op === "artifact.read") {
      return readHandoff(args);
    }
    if (op === "evidence.probe") {
      // 探针腿只认 evidence.probe——执行面其余 op（review.report 复核报告、
      // knowledge.register 知识登记）由 host 侧对应面执行，走下方通用命令腿
      // （10 号票：登记命令化后 bot 侧无共享面直写通道，但 op 仍是「命令」而非
      // 本地执行；用 EXECUTE_OPS 整集撒网会把它们误截到探针腿）。
      return runProbe(args);
    }
    if (op === "brief.refresh") {
      return refreshBrief(args);
    }
    const { status, body } = await postCommand(args, op);
    if (body?.capability !== undefined) capture(body.capability);
    if (op === "task.accept" && body?.ok === true && body?.task?.brief !== undefined && body?.task?.brief !== null) {
      heldBriefs.set(body.task.taskId ?? args.taskId, body.task.brief); // 接单即得契约
    }
    if (status >= 400 && !body?.ok) logger?.warn?.(`[dsh-bots] 命令 ${op} 被拒（${String(body?.code ?? status)}）`);
    return body;
  }
  // Nonce consumption is sequential within a process even when tools are called
  // concurrently. Reads and probes can share this queue without changing authority.
  let pending = Promise.resolve();
  const send = (op, args = {}) => {
    const result = pending.then(() => dispatch(op, args));
    pending = result.catch(() => {});
    return result;
  };
  send.ready = receiveGrants;
  return send;
}
