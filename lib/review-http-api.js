/**
 * 评审只读/决策 HTTP API（R2-10：GET metadata/body + POST decision + POST intake）。
 * 自 lib/index.js 评审只读/决策 API 区域机械抽取（2026-09-04 终版质量评审处置项③；
 * 行为不变——index.js 以同名解构继续暴露 internals 键与 handleApi 分发）。
 * json/routeSegments/readBody（宿主 HTTP 层）与 createJobFromDecision（index.js
 * job 受信链区域本地函数）由宿主注入，避免与 index.js 循环依赖。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { appendAudit } from "./review-store.js";
import { assertDecisionWriter, readIndexEntries, resultBodyFile, writeUserDecision } from "./review-results.js";
import { readRoute } from "./review-relay.js";
import { intakeTaskSpec } from "./review-intake.js";

/** 创建评审 HTTP API 处理器集（四个依赖全部注入）。 */
export function createReviewHttpApi({ json, routeSegments, readBody, createJobFromDecision }) {
  
  /** 查询参数读取（只取首个值；解析失败 → null）。 */
  function queryValue(req, key) {
    try {
      return new URL(req.url, "http://dsh.local").searchParams.get(key) ?? null;
    } catch {
      return null;
    }
  }
  
  /**
   * review API 分发（挂于 /api/bots/review/...，统一 CSRF 检查在 handleApi 已做）：
   *   GET  /api/bots/review/results?taskId=       → 已 completed 的结果元数据清单（七字段）
   *   GET  /api/bots/review/results/<artifactId>  → 单结果元数据（仅已 completed 且 route committed）
   *   GET  /api/bots/review/results/<artifactId>/body → 不可变正文（hash 复核，不符 → 500 fail closed）
   *   POST /api/bots/review/decisions             → 用户决策（authenticated principal 门控；
   *                                                宿主无 principal 提供者 → 恒 403，fail closed）
   */
  async function handleReviewApi(req, res, api) {
    const dshHome = api.dshHome;
    const segs = routeSegments(req);
  
    if (segs.length >= 4 && segs[3] === "results") {
      if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
      if (segs.length === 4) {
        const taskId = queryValue(req, "taskId");
        let entries;
        try { entries = readIndexEntries(dshHome); }
        catch (error) { return json(res, 500, { error: `result index fail closed：${error.message}` }); }
        const filtered = taskId ? entries.filter((entry) => entry.taskId === taskId) : entries;
        const completed = filtered.filter((entry) =>
          entry.status === "completed" && readRoute(dshHome, entry.artifactId, "user-facing")?.status === "committed");
        return json(res, 200, { results: completed.map((entry) => ({
          taskId: entry.taskId, artifactId: entry.artifactId, stage: entry.stage, status: entry.status,
          createdAt: entry.createdAt, sha256: entry.sha256, byteLength: entry.byteLength
        })) });
      }
      if (segs.length === 5) {
        const meta = getResultMetaFor(dshHome, segs[4]);
        if (!meta.ok) return json(res, meta.status, { error: meta.reason });
        return json(res, 200, meta.result);
      }
      if (segs.length === 6 && segs[5] === "body") {
        const meta = getResultMetaFor(dshHome, segs[4]);
        if (!meta.ok) return json(res, meta.status, { error: meta.reason });
        const bodyFile = resultBodyFile(dshHome, meta.result.taskId, segs[4]);
        let bytes;
        try { bytes = readFileSync(bodyFile); }
        catch (error) { return json(res, 500, { error: `正文不可读：${error.message}` }); }
        const hash = createHash("sha256").update(bytes).digest("hex");
        if (hash !== meta.result.sha256 || bytes.length !== meta.result.byteLength) {
          appendAudit(dshHome, { type: "user-facing-body-integrity", artifactId: segs[4], reason: "GET body hash 与索引不符（fail closed）" });
          return json(res, 500, { error: "正文 hash 与索引不符（fail closed）" });
        }
        res.writeHead(200, { "content-type": "text/markdown; charset=utf-8" });
        return res.end(bytes);
      }
      return json(res, 404, { error: "not found" });
    }
  
    if (segs.length === 4 && segs[3] === "decisions") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      // P5-4：principal 由宿主提供者注入；不可用 → 写接口禁用（fail closed，CSRF 不构成身份）
      const provider = api.reviewPrincipalProvider ?? null;
      let auth;
      try { auth = typeof provider === "function" ? await provider(req) : { ok: false }; }
      catch (error) { auth = { ok: false }; }
      if (!auth?.ok) {
        appendAudit(dshHome, { type: "user-decision-denied", reason: auth?.reason ?? "principal 不可用（写接口禁用）" });
        return json(res, 403, { error: auth?.reason ?? "宿主未提供 authenticated user principal，decision POST 禁用（fail closed）" });
      }
      const body = await readBody(req);
      const outcome = writeUserDecision(dshHome, { ...body, author: "user" }, auth);
      if (!outcome.ok) {
        appendAudit(dshHome, { type: "user-decision-rejected", taskId: body?.taskId, reason: outcome.reason });
        return json(res, 400, { error: outcome.reason });
      }
      appendAudit(dshHome, { type: "user-decision-written", taskId: body.taskId, artifactId: body.artifactId, revision: body.revision, idempotent: outcome.idempotent });
      // P0.3：authorize-repair decision 落盘后由 host 机械创建 engineering job（受信链，
      // 参数全部取自 decision 记录）。engineeringBotId 缺省取注册表中第一个 engineering 组 bot。
      let jobResult = null;
      if (outcome.decision?.choice === "authorize-repair" && !outcome.idempotent) {
        const engineeringBotId = api.reviewEngineeringBotId ?? guessEngineeringBotId(api);
        if (!engineeringBotId) {
          appendAudit(dshHome, { type: "job-creation-deferred", taskId: body.taskId, decisionRevision: body.revision, reason: "注册表中无 engineering 组 bot" });
          jobResult = { deferred: true, reason: "注册表中无 engineering 组 bot（job 未创建）" };
        } else {
          jobResult = createJobFromDecision(dshHome, {
            taskId: body.taskId,
            decisionRevision: body.revision,
            engineeringBotId
          });
          appendAudit(dshHome, {
            type: jobResult.ok ? "job-created-from-decision" : "job-creation-failed",
            taskId: body.taskId, decisionRevision: body.revision, engineeringBotId,
            reason: jobResult.ok ? jobResult.jobId : jobResult.reason
          });
        }
      }
      return json(res, 201, { decision: outcome.decision, idempotent: outcome.idempotent, job: jobResult });
    }
  
    // F-RV-24 生产 task intake：POST /api/bots/review/intake。
    // 返修要点 1/2/4：readBody 直接使用（已解析对象；400/413 经 httpError 传播）；
    // principal 判定复用 assertDecisionWriter（缺失/异常/role≠user 恒 403，与 decision
    // 同款 P5-4 fail closed）；taskId 存在但非非空安全字符串 → 400（缺失才自动生成）。
    // handler 只做 schema 校验 + 委托 intakeTaskSpec，零业务逻辑。
    if (segs.length === 4 && segs[3] === "intake") {
      if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
      const provider = api.reviewPrincipalProvider ?? null;
      let auth = null;
      try { auth = typeof provider === "function" ? await provider(req) : null; }
      catch { auth = null; }
      const writer = assertDecisionWriter(auth);
      if (!writer.ok) {
        appendAudit(dshHome, { type: "task-intake-denied", reason: writer.reason });
        return json(res, 403, { error: writer.reason });
      }
      const body = await readBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json(res, 400, { error: "请求体必须为 JSON 对象" });
      }
      for (const key of Object.keys(body)) {
        if (!["body", "sourceRoot", "taskId"].includes(key)) {
          return json(res, 400, { error: `请求体含未允许键 ${key}（additionalProperties=false）` });
        }
      }
      if (typeof body.body !== "string" || body.body.trim() === "" ||
          typeof body.sourceRoot !== "string" || body.sourceRoot === "") {
        return json(res, 400, { error: "body 与 sourceRoot 必填（非空字符串）" });
      }
      if (body.taskId !== undefined
          && (typeof body.taskId !== "string" || body.taskId === ""
            || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(body.taskId))) {
        return json(res, 400, { error: "taskId 存在时必须为非空安全字符串" });
      }
      const outcome = intakeTaskSpec(dshHome, {
        taskId: body.taskId ?? null,
        body: body.body,
        sourceRoot: body.sourceRoot,
        createdBy: "host-event"
      });
      if (!outcome.ok) {
        appendAudit(dshHome, { type: "task-intake-rejected", taskId: outcome.taskId, reason: outcome.reason });
        return json(res, 400, { error: outcome.reason, taskId: outcome.taskId });
      }
      appendAudit(dshHome, {
        type: "task-intake-created", taskId: outcome.taskId, snapshotId: outcome.snapshotId,
        taskSpecArtifactId: outcome.taskSpecArtifactId,
        initialLeadInvocationId: outcome.initialLeadInvocationId,
        initialSecondInvocationId: outcome.initialSecondInvocationId
      });
      return json(res, 201, outcome);
    }
  
    return json(res, 404, { error: "not found" });
  }
  
  /** 注册表中第一个 engineering 组 botId（无 → null）。 */
  function guessEngineeringBotId(api) {
    try {
      const registry = api.readRegistry();
      const bot = Object.values(registry).find((entry) => entry?.group === "engineering");
      return bot?.id ?? null;
    } catch {
      return null;
    }
  }
  
  /** 单结果元数据（仅已 completed 且 user-facing route committed；逻辑 ID 拒绝路径注入）。 */
  function getResultMetaFor(dshHome, artifactId) {
    if (typeof artifactId !== "string" || artifactId === "" || artifactId.includes("/") || artifactId.includes("..")) {
      return { ok: false, status: 400, reason: "非法 artifactId（路径类输入拒绝）" };
    }
    let entries;
    try { entries = readIndexEntries(dshHome); }
    catch (error) { return { ok: false, status: 500, reason: `result index fail closed：${error.message}` }; }
    const entry = entries.find((item) => item.artifactId === artifactId);
    if (!entry || entry.status !== "completed") return { ok: false, status: 404, reason: "结果不存在或未 completed" };
    if (readRoute(dshHome, artifactId, "user-facing")?.status !== "committed") {
      return { ok: false, status: 404, reason: "结果 route 未 committed（不可对外展示）" };
    }
    return { ok: true, result: entry };
  }
  
  return { queryValue, handleReviewApi, guessEngineeringBotId, getResultMetaFor };
}
