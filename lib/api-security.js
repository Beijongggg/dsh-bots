/**
 * /api/pod 变更面 CSRF 令牌会话（B1，2026-09-05）。
 *
 * 威胁模型与边界（与 PLAN §十一 B1 一致）：
 * - 浏览器面：令牌经 GET /api/pod/_csrf（同源可读，跨站读取受 SOP 阻断）引导，
 *   client 自动携带于变更请求头；无令牌的跨站/跨源 POST/PATCH/DELETE 被拒——
 *   弥补旧防线「缺 Sec-Fetch-Site 头即放行（fail-open）」的空窗。
 * - 同机面：本机单用户部署下，同用户进程可自由读令牌端点，令牌层对其不设防
 *   （等价于其可直接读文件）；完整同机隔离不在 B1 范围（B4 env/mode 收紧）。
 * - GET 只读面不要求令牌：SOP 已阻浏览器跨站读取；反代/对外暴露场景按 F-RV-28
 *   登记的重评触发条件整体重评，不在此预支。
 *
 * 生命周期：令牌惰性首铸；超过 rotateAfterMs 后的下一次签发触发轮换（旧令牌
 * 进 previous，在剩余有效期＋graceMs 内继续受认）——多标签页各自缓存的旧令牌
 * 在宽限窗内仍可用，宽限窗取值大于客户端的「403 → 重取 → 重试」耗时即可。
 * 所有比较 timing-safe；verify 的三类 code（required/invalid/expired）即统一
 * 错误码，随 403 响应体 code 字段返回。
 */
import { randomBytes, timingSafeEqual } from "node:crypto";

/** 变更请求携带令牌的请求头名（Node 侧 req.headers 键已小写；client 侧同名）。 */
export const TOKEN_HEADER = "x-pod-token";

/** 变更方法集（门控范围；GET/HEAD/SSE 不设门）。 */
export function isMutatingMethod(method) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

/** timing-safe 字符串等值比较（长度不等/空串直接 false，不抛异常）。 */
function tokenEquals(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * 创建令牌会话（宿主 apply 恒接线到 api.apiSecurity；库直测不接线 → handleApi
 * 沿用旧 fail-open 行为）。
 * now/ttlMs/rotateAfterMs/graceMs 均可注入（测试时钟用）。
 */
export function createApiSecurity({ now = Date.now, ttlMs = 30 * 60_000, rotateAfterMs = 15 * 60_000, graceMs = 60_000 } = {}) {
  let current = null;  // { token, issuedAt, expiresAt }
  let previous = null; // { token, expiresAt }

  function mint() {
    const issuedAt = now();
    return { token: randomBytes(32).toString("base64url"), issuedAt, expiresAt: issuedAt + ttlMs };
  }

  /** 签发（GET /api/pod/_csrf）：惰性首铸；距签发超过 rotateAfterMs → 轮换。 */
  function issue() {
    if (!current) current = mint();
    else if (now() - current.issuedAt >= rotateAfterMs) {
      previous = { token: current.token, expiresAt: current.expiresAt };
      current = mint();
    }
    return { token: current.token, expiresAt: current.expiresAt };
  }

  /** 校验请求头令牌：current 未过期即过；previous 在剩余有效期＋grace 内受认。 */
  function verify(token) {
    if (typeof token !== "string" || token === "") return { ok: false, code: "csrf-token-required" };
    const at = now();
    if (current && tokenEquals(token, current.token)) {
      return at < current.expiresAt ? { ok: true } : { ok: false, code: "csrf-token-expired" };
    }
    if (previous && tokenEquals(token, previous.token)) {
      return at < previous.expiresAt + graceMs ? { ok: true } : { ok: false, code: "csrf-token-expired" };
    }
    return { ok: false, code: "csrf-token-invalid" };
  }

  return { issue, verify };
}
