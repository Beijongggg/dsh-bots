/**
 * 评审 job 受信链（R2-11：authenticated user decision → engineering job 机械
 * 创建＋编码方 job 工具/reviewer 证据工具注册＋两个生产 capability provider）。
 * 自 lib/index.js 评审 job 受信链区域机械抽取（2026-09-07 架构评审候选 6；
 * 行为不变——index.js 以同名解构继续暴露 internals 键与 apply 三路径接线）。
 * workspaceDirFor（index.js bot 工作区路径助手）由宿主注入，避免与 index.js
 * 循环依赖；其余依赖为各 review-* 模块直连 import。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { appendAudit, bodyFileFor, readManifest, submitReviewArtifact, verifyArtifactIntegrity, writeFileDurable, quarantineArtifact } from "./review-store.js";
import { currentClaimedInvocation } from "./review-orchestrator.js";
import { runProbe, scopedRead, scopedSearch } from "./review-evidence.js";
import { advanceFixFlow, readFlow } from "./review-flow.js";
import { readDecisions } from "./review-results.js";
import { botHoldsActiveLease, claimJob, createEngineeringJob, heartbeatJob, jobsDir, readJob, reportFix, validateFixReportSubmission } from "./review-jobs.js";
import { checkCapability, isCapabilityCurrent, issueCapability, nonceFileFor } from "./review-capability.js";
import { validateWorkspaceTriple } from "./review-enforcement.js";

/** 创建评审 job 受信链五件套（job 机械创建＋两 provider＋两工具注册器；workspaceDirFor 注入）。 */
export function createReviewJobTools({ workspaceDirFor }) {
  /**
   * host 侧受信链：authenticated user decision（choice=authorize-repair）机械创建
   * engineering job（P0.3 行 154-172）：参数全部取自 decision 记录（findingIds/scope/
   * acceptanceCriteria），调用方不得自由填参。repairCycle 缺省 = 该 task 既有 job 最大
   * repairCycle + 1。
   */
  function createJobFromDecision(dshHome, { taskId, decisionRevision, engineeringBotId, repairCycle = null, lockOpts }) {
    let decision;
    try {
      const decisions = readDecisions(dshHome, taskId);
      decision = decisions.find((row) => row.revision === decisionRevision);
    } catch (error) {
      return { ok: false, reason: `decision store 不可读：${error instanceof Error ? error.message : String(error)}` };
    }
    if (!decision) return { ok: false, reason: `decision revision=${decisionRevision} 不存在（task ${taskId}）` };
    if (decision.choice !== "authorize-repair") return { ok: false, reason: `decision choice=${decision.choice} 未授权修复` };
    if (typeof engineeringBotId !== "string" || engineeringBotId === "") return { ok: false, reason: "engineeringBotId 必填" };
    // F-RV-3：job 的快照绑定只能来自 flow（host 解析，调用方不得自由填参）
    let sourceSnapshotId = null;
    try {
      const flow = readFlow(dshHome, taskId);
      sourceSnapshotId = flow?.sourceSnapshotId ?? null;
    } catch (error) {
      return { ok: false, reason: `flow 不可读（fail closed）：${error instanceof Error ? error.message : String(error)}` };
    }
    if (!sourceSnapshotId) {
      return { ok: false, reason: `flow 未锚定 sourceSnapshotId，无法创建 job（F-RV-3）：task ${taskId}` };
    }
    let cycle = repairCycle;
    if (cycle === null) {
      cycle = 1;
      try {
        const dir = jobsDir(dshHome);
        if (existsSync(dir)) {
          for (const name of readdirSync(dir)) {
            if (!name.endsWith(".json")) continue;
            try {
              const job = JSON.parse(readFileSync(join(dir, name), "utf8"));
              if (job?.taskId === taskId && Number.isInteger(job.repairCycle) && job.repairCycle >= cycle) {
                cycle = job.repairCycle + 1;
              }
            } catch { /* 单条坏记录不阻断；job 读取路径自有 fail-closed 校验 */ }
          }
        }
      } catch { /* 目录不可读按 cycle=1 处理并交由 createEngineeringJob 的锁内校验兜底 */ }
    }
    const created = createEngineeringJob(dshHome, {
      taskId,
      decisionRevision,
      authorizedFindingIds: [...decision.findingIds],
      scope: [...decision.scope],
      acceptanceCriteria: decision.acceptanceCriteria,
      engineeringBotId,
      repairCycle: cycle,
      sourceSnapshotId,
      lockOpts
    });
    if (created.ok) issueJobDispatch(dshHome, created.jobId, engineeringBotId);
    return created;
  }
  
  /**
   * F-RV-19 生产受信链·派发面：宿主（web host）为可领取 job 写入签名 claim capability
   * （jobs/<jobId>.dispatch.json）。bot 实例未注册/离线时签发失败 → 转 pending 留痕，
   * 由泵每 tick 的 backfillJobDispatches 在实例上线后补发。
   */
  function issueJobDispatch(dshHome, jobId, engineeringBotId) {
    const file = join(jobsDir(dshHome), `${jobId}.dispatch.json`);
    try {
      const job = readJob(dshHome, jobId);
      if (!job) throw new Error("job 不存在或损坏");
      if (job.engineeringBotId !== engineeringBotId) throw new Error("dispatch bot 与 job.engineeringBotId 不一致");
      if (existsSync(file)) {
        let existing = null;
        try { existing = JSON.parse(readFileSync(file, "utf8")); } catch { /* replace only in a retryable job state */ }
        const claim = existing?.claim;
        const usable = existing?.jobId === jobId && existing?.botId === engineeringBotId && claim
          && isCapabilityCurrent(dshHome, claim)
          && !existsSync(nonceFileFor(dshHome, claim.payload.nonce));
        if (usable) return { ok: true, idempotent: true };
        appendAudit(dshHome, { type: "job-dispatch-replaced", jobId, botId: engineeringBotId, reason: "既有 dispatch 已消费、过期或无效" });
      }
      const claim = issueCapability(dshHome, { botId: engineeringBotId, operations: ["job.claim"], jobId });
      writeFileDurable(file, `${JSON.stringify({ jobId, botId: engineeringBotId, issuedAt: new Date().toISOString(), claim })}\n`);
      appendAudit(dshHome, { type: "job-dispatch-issued", jobId, botId: engineeringBotId });
      return { ok: true, idempotent: false };
    } catch (error) {
      appendAudit(dshHome, {
        type: "job-dispatch-pending", jobId, botId: engineeringBotId,
        reason: error instanceof Error ? error.message : String(error)
      });
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /** 泵每 tick：为 created/requeued 且尚无 dispatch 件的 job 补发（bot 实例上线后自动补齐）。 */
  function backfillJobDispatches(dshHome) {
    if (!existsSync(jobsDir(dshHome))) return;
    for (const name of readdirSync(jobsDir(dshHome))) {
      if (!name.endsWith(".json") || name.endsWith(".lease.json") || name.endsWith(".dispatch.json")) continue;
      const jobId = name.slice(0, -".json".length);
      let job;
      try { job = readJob(dshHome, jobId); } catch { continue; }
      if (!job || !["created", "requeued"].includes(job.status)) continue;
      issueJobDispatch(dshHome, jobId, job.engineeringBotId);
    }
  }
  
  /**
   * F-RV-19 生产 capability provider（在编码方 bot 进程内执行）：
   * - job.claim ← 宿主派发时写入的签名 dispatch capability（验签＋bot/job/operation/有效期绑定）；
   * - job.heartbeat / job.report ← 链式签发，仅当本 bot 持有效 lease（该 lease 只能经
   *   签名 claim 建立）；无有效前置一律返回 null → 工具如实拒绝。
   * secret 同 OS 用户可读为已登记残留风险（P6-4 前）。
   */
  function productionJobCapabilityProvider(dshHome, botId, operation, jobId) {
    try {
      if (typeof jobId !== "string" || jobId === "") return null;
      if (operation === "job.claim") {
        const dispatch = JSON.parse(readFileSync(join(jobsDir(dshHome), `${jobId}.dispatch.json`), "utf8"));
        const claim = dispatch?.claim;
        if (dispatch?.jobId === jobId && dispatch?.botId === botId && claim
          && isCapabilityCurrent(dshHome, claim)
          && claim.payload?.botId === botId && claim.payload?.jobId === jobId
          && Array.isArray(claim.payload?.operations) && claim.payload.operations.includes("job.claim")
          && claim.payload?.expiresAt > Date.now()
          && !existsSync(nonceFileFor(dshHome, claim.payload.nonce))) {
          return claim;
        }
        return null;
      }
      if (operation === "job.heartbeat" || operation === "job.report") {
        if (!botHoldsActiveLease(dshHome, jobId, botId)) return null;
        return issueCapability(dshHome, { botId, operations: [operation], jobId });
      }
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * 三路径接线（P6-1，R2-11）：sessionWorkspace（bot 工作区）/workspaceRoot（sandbox 写
   * 边界，bot 显式登记）/registry.workspace（展示别名，只允许等于 workspaceRoot）。
   * 任一缺失 → 校验失败（无隐式回退）。
   */
  function validateBotWorkspaceTriple(dshHome, bot) {
    return validateWorkspaceTriple({
      sessionWorkspace: workspaceDirFor(dshHome, bot?.id),
      workspaceRoot: bot?.workspaceRoot,
      registryWorkspace: bot?.workspace
    });
  }
  
  /**
   * engineering bot 实例的评审 job 工具（R2-11）：claim/heartbeat/report 只能经宿主受信
   * 调用链——工具闭包持有宿主签发的短期 HMAC capability（opts.capabilityProvider 注入，
   * 见 P0.2 行 94-98）；模型只见 token 不见 secret。默认无提供者 → 工具如实拒绝
   * （P6-4 实例派发授权后由宿主注入），绝不绕过 claimJob/reportFix 的签名校验。
   */
  function registerReviewJobTools(ctx, api, botId, opts = {}) {
    const tools = ctx.get("tools");
    if (tools === undefined) return;
    const dshHome = api.dshHome;
    const capabilityProvider = opts.capabilityProvider ?? null;
    const held = async (operation, jobId) => {
      if (typeof capabilityProvider !== "function") {
        return { ok: false, reason: "宿主未注入 job capability（P6-4 派发授权后可用）" };
      }
      try {
        const capability = await capabilityProvider(operation, jobId);
        return capability ? { ok: true, capability } : { ok: false, reason: "宿主未签发 job capability" };
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }
    };
    /** capability 绑定的 hostInstanceId（签发时注册表身份）。无 capability → null，绝不回落本进程 id（F-RV-2）。 */
    const boundHostInstanceId = (h) => (h.ok ? h.capability?.payload?.hostInstanceId ?? null : null);
    const toolBase = {
      parameters: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"] },
      output: {
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["claimed", "reported", "ok", "rejected"] },
            jobId: { type: "string" },
            note: { type: "string" }
          },
          required: ["status", "jobId"],
          additionalProperties: false
        },
        render: (_args, value) => [{ type: "text", text: `${value.status} ${value.jobId}${value.note ? `：${value.note}` : ""}` }]
      }
    };
    const registrations = [];
    registrations.push(tools.register({
      ...toolBase,
      name: "engineering_job.claim",
      description: "编码方认领分配给你的工程修复 job（jobId 由宿主派发通知提供）。claim 需要宿主签发的短期 capability；未签发/过期/伪造一律拒绝。同一 job 同一时间只有一个有效 claim。",
      async execute(args) {
        const jobId = String(args.jobId ?? "");
        const h = await held("job.claim", jobId);
        if (!h.ok) return { status: "rejected", jobId, note: h.reason };
        const result = claimJob(dshHome, { jobId, botId, hostInstanceId: boundHostInstanceId(h), capability: h.capability, lockOpts: opts.lockOpts });
        return result.ok
          ? { status: "claimed", jobId, note: `leaseUntil=${result.lease?.leaseUntil ?? "?"}` }
          : { status: "rejected", jobId, note: result.reason };
      }
    }));
    registrations.push(tools.register({
      ...toolBase,
      name: "engineering_job.heartbeat",
      description: "续期当前 job claim 的 lease（claim 后周期性调用，防止宿主回收）。每次续期必须持宿主新签发的 job.heartbeat capability；未持有/过期/伪造一律拒绝，不使用任何 hostInstanceId fallback（F-RV-2）。",
      async execute(args) {
        const jobId = String(args.jobId ?? "");
        const h = await held("job.heartbeat", jobId);
        if (!h.ok) return { status: "rejected", jobId, note: h.reason };
        const result = heartbeatJob(dshHome, {
          jobId, botId, claimOwner: botId, leaseMs: opts.jobLeaseMs,
          capability: h.capability, lockOpts: opts.lockOpts
        });
        return result.ok
          ? { status: "ok", jobId, note: `leaseUntil=${result.leaseUntil}` }
          : { status: "rejected", jobId, note: result.reason };
      }
    }));
    registrations.push(tools.register({
      ...toolBase,
      name: "engineering_job.report",
      description: "提交返修报告（生产提交通道，F-RV-3/F-RV-14）：body 为十字段 schema 的严格 JSON（FIX_REPORT_SCHEMA，10 必填字段，无结论类字段）；宿主受信链内落 fix-report 工件（authorBotId 恒为当前 bot，不能伪造 reviewer）并经 reportFix 关闭 job 后自动触发复检。findingIds/changedPaths 必须与正文逐项一致且落在 job 授权范围（job.scope/task/快照）内；越权拒绝。",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          body: { type: "string", description: "十字段 fix-report JSON（严格 JSON 文本）" },
          findingIds: { type: "array", items: { type: "string" }, description: "本报告覆盖的授权 F-编号（须与正文 inputFindingIds 一致）" },
          changedPaths: { type: "array", items: { type: "string" }, description: "实际修改路径（须与正文 changedFiles 一致且在 job.scope 内）" }
        },
        required: ["jobId", "body", "findingIds", "changedPaths"]
      },
      output: toolBase.output,
      async execute(args) {
        const jobId = String(args.jobId ?? "");
        const body = String(args.body ?? "");
        const findingIds = Array.isArray(args.findingIds) ? args.findingIds.map(String) : [];
        const changedPaths = Array.isArray(args.changedPaths) ? args.changedPaths.map(String) : [];
        // F-RV-22：同一已完成报告的重放不应先索取新 capability；先读 job，
        // 仅在非终态路径要求 job.report capability。
        const job = readJob(dshHome, jobId);
        if (!job) return { status: "rejected", jobId, note: "job 不存在或损坏" };
        const previousReport = job.status === "fix-reported"
          ? [...(job.events ?? [])].reverse().find((event) => event.type === "fix-reported")
          : null;
        if (previousReport) {
          let previousBody = null;
          try { previousBody = readFileSync(bodyFileFor(dshHome, previousReport.reportArtifactId), "utf8"); } catch { /* reportFix will fail closed */ }
          if (previousBody !== body) {
            return { status: "rejected", jobId, note: "fix-reported 已有不同正文，终态拒绝且不落新工件" };
          }
          const replay = reportFix(dshHome, {
            jobId, botId, fixReportArtifactId: previousReport.reportArtifactId,
            findingIds, changedPaths, capability: null,
            workspaceRoot: opts.jobWorkspaceRoot, lockOpts: opts.lockOpts
          });
          if (!replay.ok) return { status: "rejected", jobId, note: replay.reason };
          return {
            status: "reported", jobId,
            note: "fix-report 已接受（幂等重放）；复检推进：idempotent-replay（既有工件，不重复触发复检）"
          };
        }
        const preflight = validateFixReportSubmission(dshHome, {
          jobId, botId, body, findingIds, changedPaths,
          workspaceRoot: opts.jobWorkspaceRoot
        });
        if (!preflight.ok) return { status: "rejected", jobId, note: preflight.reason };
        const h = await held("job.report", jobId);
        if (!h.ok) return { status: "rejected", jobId, note: h.reason };
        let submitted;
        try {
          submitted = submitReviewArtifact(dshHome, {
            taskId: job.taskId,
            stage: "fix-report",
            authorBotId: botId,
            body,
            // F-RV-22：幂等键＝jobId＋正文哈希——同正文重试幂等返回既有工件；
            // 正文修正后为新键新工件，旧件成无害孤立件（终态防重不受影响）。
            sourceSnapshotId: job.sourceSnapshotId,
            idempotencyKey: `fix-report:${jobId}:${createHash("sha256").update(body, "utf8").digest("hex")}`
          });
        } catch (error) {
          return { status: "rejected", jobId, note: error instanceof Error ? error.message : String(error) };
        }
        if (!submitted || submitted.status === "quarantined") {
          return { status: "rejected", jobId, note: `fix-report 提交失败：${submitted?.status ?? "?"}` };
        }
        const result = reportFix(dshHome, {
          jobId, botId, fixReportArtifactId: submitted.artifactId, findingIds, changedPaths,
          capability: h.capability, workspaceRoot: opts.jobWorkspaceRoot, lockOpts: opts.lockOpts
        });
        if (!result.ok) {
          // The immutable artifact was written before the final lease/state gate;
          // quarantine it on rejection so failed attempts are never silent orphan
          // reports that look submit-able on a later retry.
          try { quarantineArtifact(dshHome, submitted.artifactId, `engineering_job.report rejected after artifact submit: ${result.reason}`, { jobId, botId }); } catch { /* preserve original rejection */ }
          return { status: "rejected", jobId, note: result.reason };
        }
        // F-RV-3/F-RV-22：首次接受后触发复检推进；幂等重放不重复触发
        let recheckStep = null;
        if (result.idempotent) {
          recheckStep = "idempotent-replay（既有工件，不重复触发复检）";
        } else {
          try {
            const advanced = advanceFixFlow(dshHome, {
              taskId: job.taskId, fixReportArtifactId: submitted.artifactId, engineeringBotId: botId
            });
            recheckStep = advanced?.step ?? null;
          } catch (error) {
            recheckStep = `advanceFixFlow:${error instanceof Error ? error.message : String(error)}`;
          }
        }
        return {
          status: "reported",
          jobId,
          note: `fix-report 已接受${result.idempotent ? "（幂等重放）" : ""}${recheckStep ? `；复检推进：${recheckStep}` : ""}`
        };
      }
    }));
    return registrations;
  }
  
  /** task-spec 工件在 invocation 输入集中必须唯一可定；否则返回 null（fail closed）。 */
  function taskSpecArtifactIdFor(dshHome, manifest) {
    const specIds = (manifest?.artifactIds ?? []).filter((id) => {
      try { return readManifest(dshHome, id)?.stage === "task-spec"; } catch { return false; }
    });
    return specIds.length === 1 ? specIds[0] : null;
  }
  
  /**
   * F-RV-25 补修（payload binding 切片·provider 面）：弃用布尔包装——单次扫描取得
   * bound（currentClaimedInvocation），binding 全部取自同一对象（单源，含 probe 的
   * taskSpecArtifactId 从 bound.manifest.artifactIds 确定，不接受调用参数扩展授权
   * 范围）；binding 进入 canonical payload，HMAC 覆盖。无活态 claimed invocation →
   * null。lease 来源为宿主身份认证级信任，非密码学证明（L2 登记 P6-4）。
   */
  function productionReviewerCapabilityProvider(dshHome, botId, operation) {
    try {
      if (!["evidence.read", "artifact.read", "evidence.probe"].includes(operation)) return null;
      const bound = currentClaimedInvocation(dshHome, botId);
      if (!bound) return null;
      const binding = {
        invocationId: bound.invocationId,
        taskId: bound.manifest.taskId,
        sourceSnapshotId: bound.manifest.sourceSnapshotId
      };
      if (operation === "evidence.probe") {
        const specId = taskSpecArtifactIdFor(dshHome, bound.manifest);
        if (!specId) return null;
        binding.taskSpecArtifactId = specId;
      }
      return issueCapability(dshHome, { botId, operations: [operation], binding });
    } catch {
      return null;
    }
  }
  
  /**
   * reviewer bot 实例的评审证据工具（F-RV-25）：review_read / review_search /
   * review_probe 只能经宿主受信调用链——工具闭包每次调用现取宿主链式签发的短期
   * HMAC capability（opts.capabilityProvider 注入，默认生产 provider）；模型只见
   * token 不见 secret。限额全数沿用 review-evidence 的 EVIDENCE_LIMITS，零旁路。
   * review_probe 的 registeredCommands 取自 task-spec 工件正文（工具侧验 manifest
   * stage/taskId/完整性后解析），模型不得自报——否则逐字登记白名单形同虚设。
   * 返修要点 7（方案 A 绑定，三工具统一）：以当前 claimed invocation 为锚——
   * manifest.targetReviewer == botId（扫描固有）、taskId == invocation.taskId、
   * cycleId == invocation.sourceSnapshotId、taskSpecArtifactId ∈ invocation.artifactIds；
   * 跨 task/cycle 访问一律拒绝。
   */
  function registerReviewerEvidenceTools(ctx, api, botId, opts = {}) {
    const tools = ctx.get("tools");
    if (tools === undefined) return;
    const dshHome = api.dshHome;
    const capabilityProvider = opts.capabilityProvider
      ?? ((operation) => productionReviewerCapabilityProvider(dshHome, botId, operation));
    const held = async (operation) => {
      try {
        const capability = await capabilityProvider(operation);
        return capability ? { ok: true, capability } : { ok: false, reason: "宿主未签发 evidence capability（无活态 claimed invocation 或实例未注册）" };
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }
    };
    // 返修（token 自身 binding 强制校验，副审条件二）：binding 缺失的 evidence
    // capability 一律拒绝（含历史/旧 token）；binding 与本次调用解析的 bound 全等
    // （两次扫描必须比较 invocationId——TOCTOU 收敛语义：token 与当前 claimed
    // invocation 不同源 → fail closed，下次调用重取新 token）。参数级检查保留第二层。
    const anchorFromToken = (capability, operation) => {
      const payload = capability?.payload;
      if (!payload || typeof payload !== "object" || !payload.binding) {
        return { ok: false, reason: "evidence capability 缺 payload binding（旧 token 或非受信签发），拒绝" };
      }
      const b = payload.binding;
      const bound = currentClaimedInvocation(dshHome, botId);
      if (!bound) return { ok: false, reason: "无活态 claimed invocation（token 与当前上下文不同源，fail closed）" };
      const expected = {
        invocationId: bound.invocationId,
        taskId: bound.manifest.taskId,
        sourceSnapshotId: bound.manifest.sourceSnapshotId
      };
      if (operation === "evidence.probe") {
        const specId = taskSpecArtifactIdFor(dshHome, bound.manifest);
        if (!specId) return { ok: false, reason: "task-spec 工件无法唯一确定（fail closed）" };
        expected.taskSpecArtifactId = specId;
      }
      for (const key of Object.keys(expected)) {
        if (b[key] !== expected[key]) {
          return { ok: false, reason: `capability binding.${key} 与当前 claimed invocation 不符（token=${b[key]}，当前=${expected[key]}）——fail closed，重取新 token` };
        }
      }
      return { ok: true, bound, binding: b };
    };
    const registrations = [];
    // 注意 output 必须包在 output: { schema, render } 键下——cordis loader 对工具
    // 声明做严格 schema 校验（真实 loader 拒绝平铺形状：本次 P7-5 首次拉起实证）。
    const outputBase = {
      output: {
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["read", "searched", "probed", "rejected"] },
            cycleId: { type: "string" },
            note: { type: "string" },
            relPath: { type: "string" },
            byteLength: { type: "number" },
            content: { type: "string" }
          },
          required: ["status"],
          additionalProperties: false
        },
        render: (_args, value) => [{
          type: "text",
          text: value.content !== undefined
            ? `${value.status} ${value.cycleId}${value.relPath ? ` ${value.relPath}` : ""}\n${value.content}`
            : `${value.status} ${value.cycleId ?? ""}${value.note ? `：${value.note}` : ""}`.trim()
        }]
      }
    };
  
    registrations.push(tools.register({
      ...outputBase,
      name: "review_read",
      description: "读取评审证据快照中的单个文件（仅限本任务 cycle 的物化 source snapshot，路径必须在快照清单内；宿主受信 capability 校验，越权/伪造一律拒绝）。",
      parameters: {
        type: "object",
        properties: { cycleId: { type: "string" }, relPath: { type: "string" } },
        required: ["cycleId", "relPath"],
        additionalProperties: false
      },
      async execute(args) {
        const cycleId = String(args.cycleId ?? "");
        const relPath = String(args.relPath ?? "");
        const h = await held("evidence.read");
        if (!h.ok) return { status: "rejected", cycleId, note: h.reason };
        const anchor = anchorFromToken(h.capability, "evidence.read");
        if (!anchor.ok) return { status: "rejected", cycleId, note: anchor.reason };
        // 三工具对称（返修）：capability 本体消费型校验（HMAC/operation/expiry/slot/
        // 注册表身份/nonce 单次消费）——token 由 provider 每次现取，消费即弃。
        const checked = checkCapability(dshHome, { botId, operation: "evidence.read", capability: h.capability });
        if (!checked.ok) return { status: "rejected", cycleId, note: `capability 校验失败：${checked.reason}` };
        if (cycleId !== anchor.binding.sourceSnapshotId) {
          return { status: "rejected", cycleId, note: `cycleId 与 capability binding 不符（期望 ${anchor.binding.sourceSnapshotId}）` };
        }
        const result = scopedRead(dshHome, { cycleId, relPath });
        if (!result.ok) return { status: "rejected", cycleId, note: result.reason };
        return { status: "read", cycleId, relPath, byteLength: result.byteLength, content: result.content };
      }
    }));
  
    registrations.push(tools.register({
      ...outputBase,
      name: "review_search",
      description: "在评审证据快照内做大小写不敏感子串检索（文件名与内容；单文件超限跳过并计数）。仅限本任务 cycle 的物化快照；宿主受信 capability 校验。",
      parameters: {
        type: "object",
        properties: { cycleId: { type: "string" }, query: { type: "string" } },
        required: ["cycleId", "query"],
        additionalProperties: false
      },
      async execute(args) {
        const cycleId = String(args.cycleId ?? "");
        const query = String(args.query ?? "");
        const h = await held("evidence.read");
        if (!h.ok) return { status: "rejected", cycleId, note: h.reason };
        const anchor = anchorFromToken(h.capability, "evidence.read");
        if (!anchor.ok) return { status: "rejected", cycleId, note: anchor.reason };
        // 三工具对称（返修）：capability 本体消费型校验——与 read 同款。
        const checked = checkCapability(dshHome, { botId, operation: "evidence.read", capability: h.capability });
        if (!checked.ok) return { status: "rejected", cycleId, note: `capability 校验失败：${checked.reason}` };
        if (cycleId !== anchor.binding.sourceSnapshotId) {
          return { status: "rejected", cycleId, note: `cycleId 与 capability binding 不符（期望 ${anchor.binding.sourceSnapshotId}）` };
        }
        const result = scopedSearch(dshHome, { cycleId, query });
        if (!result.ok) return { status: "rejected", cycleId, note: result.reason };
        return { status: "searched", cycleId, note: `hits=${result.hits.length} skipped=${result.skipped} ${JSON.stringify(result.hits.slice(0, 20))}` };
      }
    }));
  
    registrations.push(tools.register({
      ...outputBase,
      name: "review_probe",
      description: "在评审证据快照的一次性副本内运行与任务登记逐字一致的探针命令（bwrap 沙箱、超时/输出限额）。命令必须已在 task-spec 工件正文的 registeredCommands 中逐字登记（工具自行读取并校验该工件，模型不得自报）；宿主受信 capability 校验。",
      parameters: {
        type: "object",
        properties: {
          cycleId: { type: "string" },
          taskId: { type: "string" },
          taskSpecArtifactId: { type: "string", description: "本任务 task-spec 工件 ID（invocation parts 已提供）" },
          command: { type: "string" },
          args: { type: "array", items: { type: "string" } },
          timeoutMs: { type: "number" }
        },
        required: ["cycleId", "taskId", "taskSpecArtifactId", "command", "args"],
        additionalProperties: false
      },
      async execute(args) {
        const cycleId = String(args.cycleId ?? "");
        const h = await held("evidence.probe");
        if (!h.ok) return { status: "rejected", cycleId, note: h.reason };
        const anchor = anchorFromToken(h.capability, "evidence.probe");
        if (!anchor.ok) return { status: "rejected", cycleId, note: anchor.reason };
        // 授权范围由 binding 单源确定（taskSpecArtifactId 取自 invocation 输入集，
        // 不接受调用参数扩展授权范围）；参数仅作一致性第二层校验。
        const taskId = String(args.taskId ?? "");
        if (taskId !== anchor.binding.taskId) {
          return { status: "rejected", cycleId, note: `taskId 与 capability binding 不符（期望 ${anchor.binding.taskId}，收到 ${taskId}）` };
        }
        const taskSpecArtifactId = anchor.binding.taskSpecArtifactId;
        if (args.taskSpecArtifactId !== undefined && String(args.taskSpecArtifactId) !== taskSpecArtifactId) {
          return { status: "rejected", cycleId, note: `taskSpecArtifactId 与 capability binding 不符（期望 ${taskSpecArtifactId}，不接受参数扩展授权范围）` };
        }
        // registeredCommands 单一事实源 = task-spec 工件正文（不得由调用方自报）
        let manifest;
        try { manifest = readManifest(dshHome, taskSpecArtifactId); }
        catch (error) { return { status: "rejected", cycleId, note: `task-spec 工件 manifest 不可读：${error.message}` }; }
        if (!manifest || manifest.stage !== "task-spec" || manifest.taskId !== taskId
            || !verifyArtifactIntegrity(dshHome, taskSpecArtifactId, manifest).ok) {
          return { status: "rejected", cycleId, note: "task-spec 工件绑定失败（stage/taskId/完整性）" };
        }
        let registeredCommands = null;
        try {
          const parsed = JSON.parse(readFileSync(manifest.bodyPath, "utf8"));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
              && Array.isArray(parsed.registeredCommands)) {
            registeredCommands = parsed.registeredCommands;
          }
        } catch { /* 非 JSON 正文 → 视为未登记 */ }
        if (!registeredCommands) {
          return { status: "rejected", cycleId, note: "任务未登记探针命令（task-spec 正文需含 registeredCommands）" };
        }
        const probe = runProbe(dshHome, {
          cycleId,
          registeredCommands,
          command: String(args.command ?? ""),
          args: Array.isArray(args.args) ? args.args.map(String) : [],
          timeoutMs: args.timeoutMs,
          capability: h.capability,
          botId
        });
        return {
          status: "probed",
          cycleId,
          note: `ok=${probe.ok} exit=${probe.exitCode} stdout=${probe.stdoutBytes}B stderr=${probe.stderrBytes}B elapsed=${probe.window?.elapsedMs ?? "?"}ms${probe.ok ? "" : ` reason=${probe.reason ?? "?"}`}`
        };
      }
    }));
    return registrations;
  }
  return {
    createJobFromDecision,
    issueJobDispatch,
    backfillJobDispatches,
    productionJobCapabilityProvider,
    validateBotWorkspaceTriple,
    registerReviewJobTools,
    productionReviewerCapabilityProvider,
    registerReviewerEvidenceTools
  };
}
