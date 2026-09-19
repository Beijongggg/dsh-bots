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
 *      报告响应携带的续签帽被捕获回持；帽的初次分发＝13 号票自举（本通道不伪造）；
 *   4. 其余＝台账命令：POST `/api/bots/_ledger/commands`，actor 固定
 *      `kind:"post"`＋本 bot id，附持有的 capability 信封与 CSRF 令牌头
 *      （变更面令牌会话，GET `/api/bots/_csrf` 引导；403 csrf-* 重取重试一次）。
 *
 * **链式能力持有侧**（06 号票 dispatcher 语义的对面）：每响应携带的
 * `capability` 随下一命令回传——单次消费下不断链。首张能力的分发＝13 号票
 * 自举（host 对 post 位实例的 role/task 能力出渠），本通道不伪造信封。
 * **接单即得契约**：`task.accept` 成功响应携带的 `task.brief` 被捕获持有，
 * 作为探针逐字比对的本地持有件（stale/tamper tripwire）。
 */
import { EXECUTE_OPS } from "./op-set.js";
import { criterionMatches, runCriterion } from "./probe.js";

const TOKEN_HEADER = "x-dsh-bots-token";

export function createPostChannel({ origin, botId, probeCtx, fetchImpl = fetch, logger } = {}) {
  if (typeof origin !== "string" || origin === "") throw new Error("createPostChannel 需要 host origin");
  if (typeof botId !== "string" || botId === "") throw new Error("createPostChannel 需要 botId");
  if (typeof fetchImpl !== "function") throw new Error("createPostChannel 需要 fetch 实现");
  let csrfToken = null;
  let capability = null; // 最近一次响应携带的信封（链式持有）
  let reviewHat = null; // 复核帽信封（08 号票；与命令链信封分槽持有）
  const heldBriefs = new Map(); // taskId → 接单响应捕获的简报（逐字比对的本地持有件）

  async function getJson(path) {
    const response = await fetchImpl(`${origin}${path}`, { method: "GET" });
    return { status: response.status, body: await response.json() };
  }

  async function ensureCsrf() {
    if (csrfToken !== null) return csrfToken;
    const { body } = await getJson("/api/bots/_csrf");
    if (typeof body?.token !== "string" || body.token === "") {
      throw new Error(`CSRF 令牌引导失败（${JSON.stringify(body)}）`);
    }
    csrfToken = body.token;
    return csrfToken;
  }

  async function readLedgerView() {
    const { body } = await getJson("/api/bots/_ledger");
    return body;
  }

  /** 执行面路由：判据真源＝台账投影；持有件逐字比对后才跑白名单。 */
  async function runProbe(args) {
    const { taskId, index } = args ?? {};
    if (typeof taskId !== "string" || taskId === "" || !Number.isInteger(index) || index < 0) {
      return { ok: false, code: "probe-args", reason: "evidence.probe 只收 {taskId, index}（判据由台账预登记，不收调用方判据文本）" };
    }
    let view;
    try {
      view = await readLedgerView();
    } catch (error) {
      return { ok: false, code: "probe-ledger-unreadable", reason: `台账投影不可读（fail closed）：${error.message}` };
    }
    const task = (view?.tasks ?? []).find((entry) => entry.taskId === taskId);
    if (task === undefined) return { ok: false, code: "probe-task-unknown", reason: `台账无任务：${taskId}` };
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

  async function sendOnce(token, payload, path = "/api/bots/_ledger/commands") {
    const response = await fetchImpl(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", [TOKEN_HEADER]: token },
      body: JSON.stringify(payload)
    });
    return { response, body: await response.json() };
  }

  /** 变更面 CSRF 纪律（命令面与复核面同语义）：403 csrf-* 即令牌轮换重取、重试一次。 */
  async function postWithCsrfRetry(payload, path = "/api/bots/_ledger/commands") {
    const first = await sendOnce(await ensureCsrf(), payload, path);
    if (!(first.response.status === 403 && typeof first.body?.code === "string" && first.body.code.startsWith("csrf-"))) {
      return first;
    }
    csrfToken = null; // 令牌轮换：重取并重试一次（多标签页宽限语义的客户端侧）
    return sendOnce(await ensureCsrf(), payload, path);
  }

  /** 复核帽捕获：响应携带 post=verifier 的信封即回持（续签链的帽侧）。 */
  function captureReviewHat(body) {
    if (body?.capability?.payload?.post === "verifier") reviewHat = body.capability;
  }

  /** 复核报告提交（08 号票）：帽信封随体携带（单次消费），续签帽随响应捕获。 */
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
    if (reviewHat !== null) payload.capability = reviewHat;
    const final = await postWithCsrfRetry(payload, "/api/bots/_ledger/reviews");
    captureReviewHat(final.body);
    return final.body;
  }

  /** 复核移交件读（08 号票）：帽信封随头携带（读面不消费 nonce）。 */
  async function readHandoff(args) {
    if (typeof args?.taskId !== "string" || args.taskId === "") {
      return { ok: false, code: "artifact-read-args", reason: "artifact.read 只收 {taskId}（判据与坐标以台账冻结简报为准）" };
    }
    const headers = { "x-dsh-bots-bot-id": botId };
    if (reviewHat !== null) headers["x-dsh-bots-capability"] = JSON.stringify(reviewHat);
    const response = await fetchImpl(
      `${origin}/api/bots/_ledger/review-handoff?taskId=${encodeURIComponent(args.taskId)}`,
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
    if (capability !== null) payload.capability = capability; // 链式持有：随命令回传
    return postWithCsrfRetry(payload);
  }

  return async function dispatch(op, args = {}) {
    if (op === "ledger.read") {
      return readLedgerView();
    }
    if (op === "review.report") {
      return submitReview(args);
    }
    if (op === "artifact.read") {
      return readHandoff(args);
    }
    if (EXECUTE_OPS.includes(op)) {
      return runProbe(args);
    }
    const { response, body } = await postCommand(args, op);
    if (body?.capability !== undefined) capability = body.capability;
    if (op === "task.accept" && body?.ok === true && body?.task?.brief !== undefined && body?.task?.brief !== null) {
      heldBriefs.set(body.task.taskId ?? args.taskId, body.task.brief); // 接单即得契约
    }
    if (!response.ok && !body?.ok) logger?.warn?.(`[dsh-bots] 命令 ${op} 被拒（${String(body?.code ?? response.status)}）`);
    return body;
  };
}
