/**
 * bot→host 认证通道原语（org-v2 11 号票抽件；02 纪律：组织命令通道与邮件通道
 * **共用一份 CSRF 会话与投递口径**，不两处各留一份）。
 *
 * 语义（自 07 号票 `createPostChannel` 逐字抽出，行为不变）：
 *   - `getJson(path, headers)`＝GET 读面（不消费令牌）；
 *   - `postJson(path, payload, headers)`＝POST 变更面：CSRF 令牌随头携带，403
 *     `csrf-*` 即令牌轮换（重取后重试**一次**，多标签页宽限语义的客户端侧）；
 *   - 令牌引导 `GET /api/bots/_csrf`（缺 token 字段即抛——调用方按其道处置）。
 *
 * 传输层重试与「通道不可用」判定**不在本原语**：命令面按既有语义直接上抛，
 * 邮件通道腿按 `V-A4.7` 分支一另做有限重试（`lib/org/mail-client.js`）。
 */
const TOKEN_HEADER = "x-dsh-bots-token";

export function createHostChannel({ origin, botId, fetchImpl = fetch, logger } = {}) {
  if (typeof origin !== "string" || origin === "") throw new Error("createHostChannel 需要 host origin");
  if (typeof botId !== "string" || botId === "") throw new Error("createHostChannel 需要 botId");
  if (typeof fetchImpl !== "function") throw new Error("createHostChannel 需要 fetch 实现");
  let csrfToken = null;

  async function ensureCsrf() {
    if (csrfToken !== null) return csrfToken;
    const response = await fetchImpl(`${origin}/api/bots/_csrf`, { method: "GET" });
    const body = await response.json();
    if (typeof body?.token !== "string" || body.token === "") {
      throw new Error(`CSRF 令牌引导失败（${JSON.stringify(body)}）`);
    }
    csrfToken = body.token;
    return csrfToken;
  }

  async function getJson(path, headers = {}) {
    const response = await fetchImpl(`${origin}${path}`, { method: "GET", headers });
    return { status: response.status, body: await response.json() };
  }

  async function sendOnce(token, path, payload, headers) {
    const response = await fetchImpl(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", [TOKEN_HEADER]: token, ...headers },
      body: JSON.stringify(payload)
    });
    return { status: response.status, body: await response.json() };
  }

  /**
   * 变更面 POST：403 `csrf-*` 即令牌轮换重取、重试一次。
   * 返回形状与 `getJson` 一致（`{status, body}`）——调用侧不做两态分叉。
   */
  async function postJson(path, payload, headers = {}) {
    const first = await sendOnce(await ensureCsrf(), path, payload, headers);
    if (!(first.status === 403 && typeof first.body?.code === "string"
      && first.body.code.startsWith("csrf-"))) {
      return first;
    }
    csrfToken = null;
    return sendOnce(await ensureCsrf(), path, payload, headers);
  }

  return { getJson, postJson, logger };
}
