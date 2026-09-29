/** A disposable native Agent, composed before publication with only verifier tools.
 * Never adopts the bot's persistent session or seeds producer history. */
import { createHash, randomUUID } from "node:crypto";
import { registerPostTools } from "./op-set.js";
import { canonicalJson } from "./store-base.js";

export async function runFreshReview({ ctx, bot, cwd, review, dispatch, signal, timeoutMs = 10 * 60 * 1000 } = {}) {
  const agents = ctx.get("agents");
  if (typeof agents?.create !== "function") throw new Error("宿主缺少 agents.create，复核会话未启动");
  if (!bot.modelProvider || !bot.model) throw new Error("复核实例未配置模型指派");
  let submitted = false;
  const sessionId = `org-review-${randomUUID()}`;
  const modelIdentity = `${bot.modelProvider}/${bot.model}`;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new Error("复核会话超时")), timeoutMs);
  const reviewSignal = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  let handle, onAbort;
  try {
    handle = await agents.create({
      sessionId,
      meta: { cwd },
      agentOptions: { provider: bot.modelProvider, model: bot.model },
      signal: reviewSignal,
      setup(agentCtx) {
        const tools = agentCtx.get("tools");
        if (typeof tools?.restrict !== "function") throw new Error("宿主缺少 scoped tools.restrict，复核会话拒载");
        // Native restrictions apply to inherited tools; scoped registrations survive.
        tools.restrict({ allow: [] });
        registerPostTools({ tools, post: "verifier", dispatch: async (op, args = {}) => {
          if (args.taskId !== review.taskId) return { ok: false, code: "review-task-mismatch" };
          let input = args;
          if (op === "review.report") {
            const report = { ...args.report, subject: review.subject, modelIdentity };
            const digest = createHash("sha256").update(canonicalJson(report)).digest("hex");
            input = { ...args, idempotencyKey: `review:${review.requestSeq}:${sessionId}:${digest}`, report };
          }
          const result = await dispatch(op, input);
          if (op === "review.report" && result?.ok === true) submitted = true;
          return result;
        } });
      }
    });
    reviewSignal.throwIfAborted();
    handle.agent.followup({ id: randomUUID(), role: "user", source: { kind: "plugin", plugin: "dsh-bots" },
      content: [{ type: "text", text: `独立复核 ${review.taskId}，对象 ${review.subject}。通过 artifact.read 读取冻结简报与移交件，按预登记判据运行 evidence.probe；提交 review.report，报告 gaps、严重度与证据坐标。不得修改工件或放宽判据。` }] });
    await new Promise((resolve, reject) => {
      onAbort = () => reject(reviewSignal.reason);
      reviewSignal.addEventListener("abort", onAbort, { once: true });
      if (reviewSignal.aborted) { onAbort(); return; }
      Promise.resolve().then(() => handle.agent.whenIdle()).then(resolve, reject);
    });
    if (!submitted) throw new Error("复核会话结束但没有成功入账的报告");
    return { ok: true, sessionId };
  } finally {
    clearTimeout(timer);
    if (onAbort) reviewSignal.removeEventListener("abort", onAbort);
    await handle?.dispose();
  }
}
