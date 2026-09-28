/**
 * bot 侧邮件通道腿（org-v2 11 号票；规格 §E「mail 收口 host 中继」、附录 A
 * `V-A4.7`「工具失效三分支各按其道，**无文件直写降级路径**」）。
 *
 * bot 侧投递与消费记账**全部经认证 host 命令**（`_mail` 面，零 capability
 * 门槛、actor 仍是认证身份）；本模块**不触文件系统**——host 是投递面唯一写者，
 * 通道失败时没有「本地直写」这条降级路（这是 `V-A4.4` 的客户端侧形态）。
 *
 * 失效三分支各按其道：
 *   1. **通道不可用**（传输失败／5xx）→ 错误回执 `mail-channel-unavailable`
 *      ＋**有限重试**（`retries` 次，缺省 1）；持续不可用→回执上抛调用方
 *      （工具面回给 agent、watcher 记日志并在下拍重试）；
 *   2. **鉴权拒绝**（403）→ 错误回执带 host 结论码＋`rejected: true`，**不重试**
 *      （拒绝是 host 的裁决，重试没有意义）；
 *   3. **语义失败**（409 等）→ host 结论码原样回传，调用方按正常任务流程处置
 *      （报 gaps／修复回合），同样不重试。
 */
import { createHostChannel } from "./host-channel.js";

/** 通道不可用结论码（分支一）。 */
export const MAIL_CHANNEL_UNAVAILABLE = "mail-channel-unavailable";

export function createMailClient({ origin, botId, fetchImpl = fetch, logger, retries = 1 } = {}) {
  const channel = createHostChannel({ origin, botId, fetchImpl, logger });
  const identity = { kind: "post", id: botId };

  /** 有限重试腿：只在「通道不可用」（传输失败／5xx）时重试，鉴权与语义拒绝直接回。
   *  全面 POST 认证命令（35 号票：cursor 的 GET 读面下线，游标腿同走 POST＋actor＋CSRF）。 */
  async function attempt({ path, payload }) {
    let failure = null;
    for (let round = 0; round <= retries; round += 1) {
      try {
        const { status, body } = await channel.postJson(path, payload);
        if (status >= 500) {
          failure = { ok: false, code: MAIL_CHANNEL_UNAVAILABLE, reason: `host 返回 ${status}（通道不可用）` };
          continue;
        }
        return { status, body };
      } catch (error) {
        failure = {
          ok: false, code: MAIL_CHANNEL_UNAVAILABLE,
          reason: `通道不可用（${error instanceof Error ? error.message : String(error)}）`
        };
      }
    }
    return { failure };
  }

  /** host 结论 → 回执（`ok:true` 原样；403 标 `rejected`；其余语义失败原样）。 */
  function interpret({ status, body }) {
    if (body?.ok === true) return body;
    const receipt = {
      ok: false,
      code: typeof body?.code === "string" && body.code !== "" ? body.code : `mail-http-${status}`,
      reason: typeof body?.reason === "string" ? body.reason : `host 拒绝（HTTP ${status}）`
    };
    if (status === 403) receipt.rejected = true;
    return receipt;
  }

  async function post(path, payload) {
    const result = await attempt({ path, payload });
    return result.failure ?? interpret(result);
  }

  /** 投递／回信（对同伴＝inbox 面、`to:"user"`＝本实例 outbox 面）。 */
  async function send(args = {}) {
    return post("/api/bots/_mail/send", { actor: identity, ...args });
  }

  /** 回合前认领（响应标记）。 */
  async function claim({ messageId, seq } = {}) {
    return post("/api/bots/_mail/consume", { actor: identity, messageId, seq, phase: "claim" });
  }

  /** 回合后终结（终结标记＋消费 receipt；at-least-once 的水位在这里前进）。 */
  async function finalize({ messageId, seq, outcome } = {}) {
    return post("/api/bots/_mail/consume", { actor: identity, messageId, seq, phase: "finalize", outcome });
  }

  /** 积压跳过（只记水位，不触发回合）。 */
  async function skip({ messageId, seq } = {}) {
    return post("/api/bots/_mail/consume", { actor: identity, messageId, seq, outcome: "skipped-stale" });
  }

  /** 起始游标（watcher 启动时问 host 要；旧数据迁移的基线也由 host 落）。
   *  35 号票：经 POST 认证命令（actor 注入＋CSRF），GET 读面下线。 */
  async function cursor() {
    return post("/api/bots/_mail/cursor", { actor: identity });
  }

  return { send, claim, finalize, skip, cursor };
}
