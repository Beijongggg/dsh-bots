/**
 * 回归：client fetch 层 CSRF 客户端协议（架构候选 4——协议两半补齐客户端半边）。
 * 直读 client.js 模块级 fetch 层（捕获型 loader 同 mail-notice.test.mjs：stub
 * react/primitives，不碰 DOM）；桩 globalThis.fetch 逐调用记账，钉住 B1 协议：
 *   - 惰性引导：首次变更请求前 GET /api/bots/_csrf，令牌只引导一次后续复用；
 *   - 403 单次重试：重取到**新**令牌才重发一次，重试再 403 即失败（无第三发）；
 *   - 重取未得新令牌（同值/跨站不可得）→ 不重发，403 原样抛出；
 *   - GET 与 apiText 文本端点一律不带令牌、不触发引导；
 *   - 引导失败（_csrf 不可用）→ 变更请求裸发，403 后不重试（fail closed）。
 * csrfToken 为模块级状态：用例经导出面 refreshCsrfToken 自身归零（200 空 body
 * → token 置 null），不窥内部。
 */
import assert from "node:assert/strict";

let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load: (opts) => { captured = opts; }
  }
};

await import("../lib/client.js");

const mod = captured.factory((id) => {
  if (id === "react") return { memo: (fn) => fn };
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
  throw new Error("unexpected require: " + id);
});
const { api, apiText, refreshCsrfToken } = mod;

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---- fetch 桩：按序脚本化响应，逐调用记账（method/url/headers/body） ----
let calls = null;
let script = null;
const realFetch = globalThis.fetch;
function stubFetch(responses) {
  script = [...responses];
  calls = [];
  globalThis.fetch = (url, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    calls.push({ method, url: String(url), headers: { ...(init.headers || {}) } });
    const next = script.shift();
    if (next === undefined) throw new Error("意外的额外 fetch 调用: " + method + " " + url);
    return typeof next === "function" ? next() : Promise.resolve(next);
  };
}
/** 最小 Response 形状（api/apiText 只用 ok/status/text/json；对象体两读法一致）。 */
const res = (status, body, type) => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(type === "obj" ? body : JSON.parse(text))
  };
};
const csrfJson = (token) => res(200, token === undefined ? {} : { token }, "obj");
const tokenHeader = (call) => call.headers["x-dsh-bots-token"];

/** 模块级 csrfToken 归零（经导出面自身：200 无 token 字段 → 置 null）。 */
async function resetToken() {
  stubFetch([csrfJson(undefined)]);
  await refreshCsrfToken();
  assert.equal(calls.length, 1, "归零路径本身不应多发请求");
}

test("惰性引导：首次变更请求先 GET /_csrf，令牌随请求头携带且只引导一次", async () => {
  await resetToken();
  stubFetch([
    csrfJson("tok-A"),
    res(200, JSON.stringify({ ok: true }), "obj")
  ]);
  const out = await api("/api/bots/x", { method: "POST", body: "{}" });
  assert.deepEqual(out, { ok: true });
  assert.equal(calls.length, 2, "应为 _csrf 引导＋变更请求共两次");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "/api/bots/_csrf");
  assert.equal(calls[1].method, "POST");
  assert.equal(tokenHeader(calls[1]), "tok-A");
  // 缓存复用：第二次变更请求不再引导
  stubFetch([res(200, "null")]);
  await api("/api/bots/y", { method: "DELETE" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(tokenHeader(calls[0]), "tok-A", "缓存令牌直接复用");
});

test("GET 不带令牌也不触发引导（含令牌已缓存时）", async () => {
  await resetToken();
  stubFetch([csrfJson("tok-A"), res(200, "null")]);
  await api("/api/bots/warm", { method: "POST" }); // 经变更请求引导出缓存令牌
  stubFetch([res(200, JSON.stringify({ bots: [] }), "obj")]);
  const out = await api("/api/bots");
  assert.deepEqual(out, { bots: [] });
  assert.equal(calls.length, 1, "GET 前不应有引导调用");
  assert.equal(calls[0].method, "GET");
  assert.equal(tokenHeader(calls[0]), undefined, "GET 一律不带令牌头");
});

test("apiText 文本端点：裸 fetch，无令牌头、无引导", async () => {
  await resetToken();
  stubFetch([csrfJson("tok-A")]);
  await refreshCsrfToken(); // 令牌在缓存中
  stubFetch([res(200, "# 纯文本响应", "text")]);
  const text = await apiText("/api/bots/export/report.md");
  assert.equal(text, "# 纯文本响应");
  assert.equal(calls.length, 1);
  assert.equal(tokenHeader(calls[0]), undefined, "文本端点不经令牌层");
});

test("403 单次重试：重取到新令牌 → 换令牌重发一次并成功", async () => {
  await resetToken();
  stubFetch([csrfJson("tok-A"), res(200, "null")]);
  await api("/api/bots/warm", { method: "POST" }); // 缓存 tok-A
  stubFetch([
    res(403, "forbidden"),       // 旧令牌被拒
    csrfJson("tok-B"),           // 重取 → 新令牌
    res(200, JSON.stringify({ saved: 1 }), "obj")
  ]);
  const out = await api("/api/bots/z", { method: "POST", body: "{}" });
  assert.deepEqual(out, { saved: 1 });
  assert.equal(calls.length, 3, "原请求＋重取＋重试恰好三次");
  assert.equal(calls[0].method, "POST");
  assert.equal(tokenHeader(calls[0]), "tok-A");
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[1].url, "/api/bots/_csrf");
  assert.equal(calls[2].method, "POST");
  assert.equal(tokenHeader(calls[2]), "tok-B", "重试必须携带新令牌");
});

test("403 重试后再 403 → 即失败（HTTP 403 抛出，无第三发）", async () => {
  await resetToken();
  stubFetch([csrfJson("tok-A"), res(200, "null")]);
  await api("/api/bots/warm", { method: "POST" });
  stubFetch([res(403, "one"), csrfJson("tok-B"), res(403, "two")]);
  await assert.rejects(api("/api/bots/z", { method: "POST" }), /HTTP 403/);
  assert.equal(calls.length, 3, "只重试一次，不得有第四发");
});

test("仅令牌变化才重发：重取同值令牌 → 不重试，403 原样抛出", async () => {
  await resetToken();
  stubFetch([csrfJson("tok-A"), res(200, "null")]);
  await api("/api/bots/warm", { method: "POST" });
  stubFetch([res(403, "stale"), csrfJson("tok-A")]);
  await assert.rejects(api("/api/bots/z", { method: "POST" }), /HTTP 403/);
  assert.equal(calls.length, 2, "同值令牌不得重发");
});

test("仅令牌变化才重发：跨站重取不可得（token 置空）→ 不重试", async () => {
  await resetToken();
  stubFetch([csrfJson("tok-A"), res(200, "null")]);
  await api("/api/bots/warm", { method: "POST" });
  stubFetch([res(403, "stale"), csrfJson(undefined)]);
  await assert.rejects(api("/api/bots/z", { method: "POST" }), /HTTP 403/);
  assert.equal(calls.length, 2, "未得新令牌不得重发");
});

test("引导失败（_csrf 不可用）→ 变更请求裸发，403 后不重试（fail closed）", async () => {
  await resetToken();
  stubFetch([
    res(503, "down"),            // 引导失败 → csrfToken 仍 null
    res(403, "no token sent")
  ]);
  await assert.rejects(api("/api/bots/z", { method: "POST" }), /HTTP 403/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "/api/bots/_csrf");
  assert.equal(calls[1].method, "POST");
  assert.equal(tokenHeader(calls[1]), undefined, "无令牌时裸发");
});

let failed = 0;
try {
  if (typeof api !== "function" || typeof apiText !== "function" || typeof refreshCsrfToken !== "function") {
    throw new Error("导出面缺函数：api=" + typeof api + " apiText=" + typeof apiText + " refreshCsrfToken=" + typeof refreshCsrfToken);
  }
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  globalThis.fetch = realFetch;
}
process.exit(failed > 0 ? 1 : 0);
