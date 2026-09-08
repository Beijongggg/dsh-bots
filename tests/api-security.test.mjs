/**
 * B1（2026-09-05，PLAN §十一）：/api/bots 变更面 CSRF 令牌门控＋principal 适配层。
 * 三层覆盖：①api-security 单元（签发/校验/轮换/宽限/过期）；②principalFor ↔
 * assertDecisionWriter 集成（P5-4 提供者形状）；③handleApi 端到端（门控 403/放行、
 * _csrf 引导端点、decision 写面经 principal 解封、未接线 provider 仍 fail closed）。
 * 只读直测不写生产代码：handleApi / BotsApi 经 internals 导出（对齐 route.test 惯例）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

import { createApiSecurity, isMutatingMethod, TOKEN_HEADER } from "../lib/api-security.js";
import { assertDecisionWriter } from "../lib/review-results.js";

const { internals } = await import("../lib/index.js");
const { BotsApi, handleApi, writeRegistryAtomic } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 单元：签发/校验/轮换 ----------
test("isMutatingMethod：POST/PUT/PATCH/DELETE 为真，GET/HEAD/OPTIONS 为假", () => {
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(isMutatingMethod(m), true);
  for (const m of ["GET", "HEAD", "OPTIONS"]) assert.equal(isMutatingMethod(m), false);
});

test("签发：base64url 32 字节令牌＋expiresAt；rotate 窗口内复签同令牌", () => {
  const sec = createApiSecurity();
  const first = sec.issue();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(typeof first.expiresAt, "number");
  assert.ok(first.expiresAt > Date.now());
  assert.equal(sec.issue().token, first.token, "未到轮换点应复签当前令牌");
});

test("校验矩阵：缺令牌→required；空串/undefined→required；伪造→invalid；有效→ok", () => {
  const sec = createApiSecurity();
  const token = sec.issue().token;
  assert.deepEqual(sec.verify(undefined), { ok: false, code: "csrf-token-required" });
  assert.deepEqual(sec.verify(""), { ok: false, code: "csrf-token-required" });
  assert.deepEqual(sec.verify("forged-token"), { ok: false, code: "csrf-token-invalid" });
  assert.deepEqual(sec.verify(token), { ok: true });
});

test("轮换：旧令牌进 previous，剩余有效期内受认；过期后仅 grace 窗受认，出窗即 expired", () => {
  let t = 0;
  const sec = createApiSecurity({ now: () => t, ttlMs: 10_000, rotateAfterMs: 3_000, graceMs: 1_000 });
  const a = sec.issue();                       // t=0，expiresAt=10000
  t = 3_500;
  const b = sec.issue();                       // 轮换：previous=a，current=b(expiresAt=13500)
  assert.notEqual(b.token, a.token);
  assert.equal(sec.verify(a.token).ok, true, "轮换后旧令牌在剩余有效期内受认");
  t = 10_500;
  assert.equal(sec.verify(a.token).ok, true, "旧令牌过期后仍在 grace 窗内受认");
  t = 11_500;
  assert.deepEqual(sec.verify(a.token), { ok: false, code: "csrf-token-expired" }, "出 grace 窗即拒");
  assert.equal(sec.verify(b.token).ok, true, "新令牌不受轮换影响");
});

test("空白会话：未签发时任意令牌 → invalid（无 current/previous 可匹配）", () => {
  const sec = createApiSecurity();
  assert.deepEqual(sec.verify("anything"), { ok: false, code: "csrf-token-invalid" });
});

// ---------- 集成：principalFor ↔ assertDecisionWriter（P5-4 提供者形状） ----------
test("principalFor：有效令牌 → {ok, principal:{role:'user'}}，经 assertDecisionWriter 认可", () => {
  const sec = createApiSecurity();
  const token = sec.issue().token;
  const auth = sec.principalFor(token);
  assert.equal(auth.ok, true);
  assert.equal(auth.principal.role, "user");
  assert.equal(auth.principal.source, "local-csrf-token");
  assert.equal(assertDecisionWriter(auth).ok, true);
});

test("principalFor：无效令牌 → ok:false，assertDecisionWriter fail closed", () => {
  const sec = createApiSecurity();
  const auth = sec.principalFor("forged");
  assert.equal(auth.ok, false);
  assert.equal(assertDecisionWriter(auth).ok, false);
});

// ---------- 端到端：handleApi 门控 ----------
function makeCtx() {
  return { logger: { info() {}, warn() {}, error() {}, debug() {} } };
}

const homes = [];
function mkHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-sec-"));
  writeRegistryAtomic(home, { worker: {
    id: "worker", name: "Worker", role: "coder", modelProvider: "", model: "",
    port: 3201, permission: "workspace-write", enabled: true
  } });
  homes.push(home);
  return home;
}

function makeReq(method, url, headers = {}, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { ...headers };
  const send = () => {
    if (body !== null) req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
    req.emit("end");
  };
  process.nextTick(send);
  return req;
}

function makeRes() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(s, h) { this.status = s; this.headers = h; },
    end(t) { this.body = t; }
  };
}

async function call(api, method, url, headers = {}, body = null) {
  const req = makeReq(method, url, headers, body);
  const res = makeRes();
  await handleApi(req, res, api);
  let parsed = res.body;
  try { parsed = JSON.parse(res.body); } catch { /* 保留原始文本 */ }
  return { status: res.status, body: parsed };
}

/** 复刻宿主 apply 的接线形状（B1 生产形态）。 */
function makeApi(home, { security = true, provider = true } = {}) {
  const api = new BotsApi(makeCtx(), home);
  if (security) {
    const sec = createApiSecurity();
    api.apiSecurity = sec;
    if (provider) api.reviewPrincipalProvider = (req) => sec.principalFor(req.headers?.[TOKEN_HEADER]);
  }
  return api;
}

test("门控：变更请求无令牌 → 403 code=csrf-token-required；伪造 → invalid；GET 不设门", async () => {
  const api = makeApi(mkHome());
  const missing = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { name: "" });
  assert.equal(missing.status, 403);
  assert.equal(missing.body.code, "csrf-token-required");

  const forged = await call(api, "PATCH", "/api/bots/worker",
    { "content-type": "application/json", [TOKEN_HEADER]: "forged-token" }, { name: "" });
  assert.equal(forged.status, 403);
  assert.equal(forged.body.code, "csrf-token-invalid");

  const reads = await call(api, "GET", "/api/bots");
  assert.equal(reads.status, 200, "GET 只读面不要求令牌");
});

test("门控：有效令牌放行至处理器（坏载荷 400 证明已过门）；未接线 apiSecurity 沿用旧行为", async () => {
  const home = mkHome();
  const api = makeApi(home);
  const token = api.apiSecurity.issue().token;
  const passed = await call(api, "PATCH", "/api/bots/worker",
    { "content-type": "application/json", [TOKEN_HEADER]: token }, { name: "" });
  assert.equal(passed.status, 400, "过门后到达校验层（坏载荷 400 而非 403）");

  const legacy = makeApi(mkHome(), { security: false });
  const ungated = await call(legacy, "PATCH", "/api/bots/worker",
    { "content-type": "application/json" }, { name: "" });
  assert.equal(ungated.status, 400, "库直测未接线 → 沿用旧 fail-open 行为");
});

test("_csrf 端点：GET 签发（token/expiresAt）；非 GET 405；未接线 404", async () => {
  const api = makeApi(mkHome());
  const issued = await call(api, "GET", "/api/bots/_csrf");
  assert.equal(issued.status, 200);
  assert.match(issued.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(typeof issued.body.expiresAt, "number");

  const badMethod = await call(api, "POST", "/api/bots/_csrf");
  assert.equal(badMethod.status, 405);

  const legacy = makeApi(mkHome(), { security: false });
  assert.equal((await call(legacy, "GET", "/api/bots/_csrf")).status, 404, "未接线对称 404");
});

test("decision 写面：有效令牌 → 过 principal 门（空载荷 400 非恒 403）；无令牌 → 门控 403", async () => {
  const api = makeApi(mkHome());
  const token = api.apiSecurity.issue().token;
  const unlocked = await call(api, "POST", "/api/bots/review/decisions",
    { "content-type": "application/json", [TOKEN_HEADER]: token }, {});
  assert.equal(unlocked.status, 400, "principal 已认（B1 解封），空载荷被信封校验拒绝");

  const gated = await call(api, "POST", "/api/bots/review/decisions",
    { "content-type": "application/json" }, {});
  assert.equal(gated.status, 403);
  assert.equal(gated.body.code, "csrf-token-required", "变更面门控先于 principal");
});

test("decision 写面：接线 apiSecurity 但 provider 缺席 → 仍 403 fail closed（P5-4 语义保持）", async () => {
  const api = makeApi(mkHome(), { security: true, provider: false });
  const token = api.apiSecurity.issue().token;
  const denied = await call(api, "POST", "/api/bots/review/decisions",
    { "content-type": "application/json", [TOKEN_HEADER]: token }, {});
  assert.equal(denied.status, 403);
  assert.match(denied.body.error, /principal|宿主/, "拒绝原因应为 principal 缺席而非令牌");
});

// ---------- 运行 ----------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try {
      await fn();
      console.log("✓", name);
    } catch (error) {
      failed += 1;
      console.error("✗", name, "—", error.stack ?? error.message);
    }
  }
} finally {
  for (const dir of homes) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
