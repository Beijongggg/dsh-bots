/**
 * 回归：HTTP 路由层分发（handleApi）+ BotsApi.patch 语义与回滚。
 * 覆盖批次⑦观察项：路由层 handleApi 与 patch 回滚语义此前无直测。
 *
 * 只读直测不写生产代码：handleApi / BotsApi 经 internals 导出（纯追加的测试槽位）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

const { internals } = await import("../lib/index.js");
const { BotsApi, handleApi, writeRegistryAtomic, readRegistry } = internals;

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 夹具 ----------
function makeCtx() {
  return { logger: { info() {}, warn() {}, error() {}, debug() {} } };
}

/** 本轮创建的全部临时 home；运行循环 finally 里统一清理（对齐 watcher.test 惯例）。 */
const homes = [];

function mkHome(registry) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-bots-route-"));
  writeRegistryAtomic(home, registry);
  homes.push(home);
  return home;
}

/** 最小合法 registry 条目（permission 显式；model 空 → patch 变更走内置脚手架，不 spawn）。 */
function bot(overrides = {}) {
  return {
    id: "worker",
    name: "Worker",
    role: "coder",
    modelProvider: "",
    model: "",
    port: 3201,
    permission: "workspace-write",
    enabled: true,
    ...overrides
  };
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

// ---------- 路由分发 ----------
test("dispatch：list/detail 200，未知路径 404，错误方法 405，未知 action 404", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const list = await call(api, "GET", "/api/bots");
  assert.equal(list.status, 200);
  assert.equal(list.body.bots.length, 1);
  assert.equal(list.body.bots[0].id, "worker");

  const detail = await call(api, "GET", "/api/bots/worker");
  assert.equal(detail.status, 200);
  assert.equal(detail.body.bot.name, "Worker");

  const notFound = await call(api, "GET", "/api/other");
  assert.equal(notFound.status, 404);

  const methodNotAllowed = await call(api, "PUT", "/api/bots");
  assert.equal(methodNotAllowed.status, 405);

  const unknownAction = await call(api, "GET", "/api/bots/worker/unknownaction");
  assert.equal(unknownAction.status, 404);

  const missing = await call(api, "GET", "/api/bots/nope");
  assert.equal(missing.status, 404);
});

test("dispatch：跨站请求被拒（CSRF，fail-open 缺头放行）", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const crossSite = await call(api, "GET", "/api/bots", { "sec-fetch-site": "cross-site" });
  assert.equal(crossSite.status, 403);

  const sameOrigin = await call(api, "GET", "/api/bots", { "sec-fetch-site": "same-origin" });
  assert.equal(sameOrigin.status, 200);

  const noHeader = await call(api, "GET", "/api/bots");
  assert.equal(noHeader.status, 200);
});

// ---------- patch 校验（失败不改注册表） ----------
test("patch 校验失败：400 + 注册表不变", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const emptyName = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { name: "" });
  assert.equal(emptyName.status, 400);

  const badPermission = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { permission: "root" });
  assert.equal(badPermission.status, 400);

  const badPort = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { port: 70 });
  assert.equal(badPort.status, 400);

  // 全部失败后注册表仍是原始权限
  assert.equal(readRegistry(home).worker.permission, "workspace-write");
});

test("patch 端口冲突：400", async () => {
  const home = mkHome({ worker: bot(), other: bot({ id: "other", port: 3202 }) });
  const api = new BotsApi(makeCtx(), home);

  const clash = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { port: 3202 });
  assert.equal(clash.status, 400);
});

test("patch 未知 id：404", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/nope", { "content-type": "application/json" }, { name: "x" });
  assert.equal(res.status, 404);
});

// ---------- patch 成功语义 ----------
test("patch group（changed=false）：不触发脚手架，注册表更新", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { group: "alpha" });
  assert.equal(res.status, 200);
  assert.equal(readRegistry(home).worker.group, "alpha");
});

test("patch permission（changed=true）：200 + 注册表权限更新（scaffold 先于写）", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { permission: "read-only" });
  assert.equal(res.status, 200);
  assert.equal(readRegistry(home).worker.permission, "read-only");
  // 内置脚手架（model 空 → 不 spawn）应在写注册表前完成，生成 profile 清单
  assert.ok(fs.existsSync(path.join(home, "profiles", "worker", "cordis.patch.yml")), "scaffold 应已生成 cordis.patch.yml");
});

test("patch 回滚：脚手架失败 → 500 + 注册表不变（scaffold-before-write 不变量）", async () => {
  const home = mkHome({ worker: bot() });
  // 把 profile 目录预先占位成普通文件，迫使内置脚手架 mkdirSync 抛 EEXIST
  fs.mkdirSync(path.join(home, "profiles"), { recursive: true });
  fs.writeFileSync(path.join(home, "profiles", "worker"), "not-a-dir");
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { permission: "read-only" });
  assert.equal(res.status, 500, "脚手架失败应映射为 500 而非部分成功");
  assert.equal(readRegistry(home).worker.permission, "workspace-write", "脚手架失败后注册表必须保持原值");
});

// ---------- reasoningEffort（推理等级）语义 ----------
test("patch reasoningEffort（model 联动）：200 + 注册表 + settings.yaml 活源 + pin 行", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" },
    { modelProvider: "deepseek-official", model: "deepseek-v4-pro", reasoningEffort: "max" });
  assert.equal(res.status, 200);
  const reg = readRegistry(home).worker;
  assert.equal(reg.modelProvider, "deepseek-official");
  assert.equal(reg.model, "deepseek-v4-pro");
  assert.equal(reg.reasoningEffort, "max");

  // 第四源：settings.yaml 的 agent-default-model 段（运行中 bot 的活源）
  const settings = fs.readFileSync(path.join(home, "profiles", "worker", "settings.yaml"), "utf8");
  assert.match(settings, /^agent-default-model:\s*$/m, "settings.yaml 应含 agent-default-model 段");
  assert.match(settings, /^\s+provider: 'deepseek-official'$/m, "settings.yaml 应含 provider");
  assert.match(settings, /^\s+model: 'deepseek-v4-pro'$/m, "settings.yaml 应含 model");
  assert.match(settings, /^\s+reasoningEffort: 'max'$/m, "settings.yaml 应含 reasoningEffort");

  // pin：cordis.patch.yml 也应带 reasoningEffort 行
  const patchYaml = fs.readFileSync(path.join(home, "profiles", "worker", "cordis.patch.yml"), "utf8");
  assert.match(patchYaml, /reasoningEffort: 'max'/, "cordis.patch.yml 应含 reasoningEffort");
});

test("patch reasoningEffort 清空：注册表置空 + settings.yaml 段去 effort 行 + pin 去 effort 行", async () => {
  const home = mkHome({ worker: bot({ modelProvider: "deepseek-official", model: "deepseek-v4-pro", reasoningEffort: "high" }) });
  // 预置 settings.yaml 活源（模拟既有四源一致的 bot）
  const settingsPath = path.join(home, "profiles", "worker", "settings.yaml");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath,
    "agent-presets:\n  default: bot-nopersona\n\nagent-default-model:\n  provider: 'deepseek-official'\n  model: 'deepseek-v4-pro'\n  reasoningEffort: 'high'\n",
    "utf8");
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { reasoningEffort: "" });
  assert.equal(res.status, 200);
  assert.equal(readRegistry(home).worker.reasoningEffort, "", "注册表 reasoningEffort 应清空");

  const settings = fs.readFileSync(settingsPath, "utf8");
  assert.match(settings, /^agent-default-model:\s*$/m, "段保留");
  assert.match(settings, /^\s+model: 'deepseek-v4-pro'$/m, "model 保留");
  assert.ok(!/reasoningEffort/.test(settings), "settings.yaml 不应再有 reasoningEffort 行");

  const patchYaml = fs.readFileSync(path.join(home, "profiles", "worker", "cordis.patch.yml"), "utf8");
  assert.ok(!/reasoningEffort/.test(patchYaml), "cordis.patch.yml 不应再有 reasoningEffort 行");
});

test("patch 清空 model：settings.yaml 的 agent-default-model 段整体删除", async () => {
  const home = mkHome({ worker: bot({ modelProvider: "deepseek-official", model: "deepseek-v4-pro", reasoningEffort: "low" }) });
  const settingsPath = path.join(home, "profiles", "worker", "settings.yaml");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath,
    "agent-presets:\n  default: bot-nopersona\n\nagent-default-model:\n  provider: 'deepseek-official'\n  model: 'deepseek-v4-pro'\n  reasoningEffort: 'low'\n",
    "utf8");
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { model: "" });
  assert.equal(res.status, 200);
  const settings = fs.readFileSync(settingsPath, "utf8");
  assert.ok(!/agent-default-model/.test(settings), "模型清空后段应删除");
  assert.match(settings, /agent-presets/, "其他内容保留");
});

test("patch reasoningEffort 非法类型：400 + 注册表不变", async () => {
  const home = mkHome({ worker: bot() });
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "PATCH", "/api/bots/worker", { "content-type": "application/json" }, { reasoningEffort: 42 });
  assert.equal(res.status, 400);
  assert.equal(readRegistry(home).worker.reasoningEffort, undefined, "注册表不应写入非法值");
});

test("create 携带 reasoningEffort：201 + 注册表 + settings.yaml 活源", async () => {
  const home = mkHome({});
  const api = new BotsApi(makeCtx(), home);

  const res = await call(api, "POST", "/api/bots", { "content-type": "application/json" }, {
    name: "评审员",
    role: "双审评审：证据卫生、复证纪律",
    modelProvider: "deepseek-official",
    model: "deepseek-v4-flash",
    reasoningEffort: "low"
  });
  assert.equal(res.status, 201);
  const id = res.body.bot.id;
  assert.equal(res.body.bot.reasoningEffort, "low");
  assert.equal(readRegistry(home)[id].reasoningEffort, "low");
  const settings = fs.readFileSync(path.join(home, "profiles", id, "settings.yaml"), "utf8");
  assert.match(settings, /^\s+reasoningEffort: 'low'$/m, "settings.yaml 应含 reasoningEffort");
});

// ---------- 上下文窗口对齐（模型上下文容量与当前模型一致） ----------
const { alignContextWindowForBot } = internals;

test("alignContextWindowForBot：日志模型与当前模型一致且无显式配置 → 保留上报值", () => {
  const stats = { contextPressure: { pressureTokens: 100, contextWindow: 9999, provider: "p", model: "m" } };
  const out = alignContextWindowForBot(stats, { modelProvider: "p", model: "m" }, "/nonexistent");
  assert.equal(out.contextPressure.contextWindow, 9999, "一致且无显式配置时应保留日志上报值");
});

test("alignContextWindowForBot：显式 settings contextWindow 始终优先（F-T9，同模型日志旧值不绕过）", () => {
  const stats = { contextPressure: { pressureTokens: 100, contextWindow: 9999, provider: "niko", model: "gpt-5.6-sol" } };
  const currentBot = { id: "worker", modelProvider: "niko", model: "gpt-5.6-sol" };
  const home = mkHome({ worker: bot() });
  fs.mkdirSync(path.join(home, "profiles", "worker"), { recursive: true });
  fs.writeFileSync(path.join(home, "profiles", "worker", "settings.yaml"),
    "llm-pi-ai:\n  providers:\n    niko:\n      models:\n        - id: gpt-5.6-sol\n          contextWindow: 300000\n");
  const out = alignContextWindowForBot(stats, currentBot, home);
  assert.equal(out.contextPressure.contextWindow, 300000, "同模型日志旧值 9999 不应绕过显式 settings 配置 300000");
});

test("alignContextWindowForBot：日志模型与当前模型不同 → 按当前模型 DSH 解析值覆盖", () => {
  const stats = { contextPressure: { pressureTokens: 115, contextWindow: 1000000, provider: "opencode-go", model: "deepseek-v4-flash" } };
  const currentBot = { id: "worker", modelProvider: "niko", model: "gpt-5.6-sol" };
  const home = mkHome({ worker: bot() });
  fs.mkdirSync(path.join(home, "profiles", "worker"), { recursive: true });
  fs.writeFileSync(path.join(home, "profiles", "worker", "settings.yaml"),
    "llm-pi-ai:\n  providers:\n    niko:\n      models:\n        - id: gpt-5.6-sol\n        - id: claude-opus-5\n          contextWindow: 1000000\n");
  const out = alignContextWindowForBot(stats, currentBot, home);
  assert.equal(out.contextPressure.contextWindow, 262144, "niko/gpt-5.6-sol 无显式配置 → DSH 默认 262144（262k）");
  assert.equal(out.contextPressure.pressureTokens, 115, "pressureTokens 保留");
});

test("alignContextWindowForBot：当前模型显式配置 contextWindow → 用显式值", () => {
  const stats = { contextPressure: { pressureTokens: 50 } };
  const currentBot = { id: "worker", modelProvider: "opencode-go", model: "deepseek-v4-flash" };
  const home = mkHome({ worker: bot() });
  fs.mkdirSync(path.join(home, "profiles", "worker"), { recursive: true });
  fs.writeFileSync(path.join(home, "profiles", "worker", "settings.yaml"),
    "llm-pi-ai:\n  providers:\n    opencode-go:\n      models:\n        - id: deepseek-v4-flash\n          contextWindow: 1000000\n");
  const out = alignContextWindowForBot(stats, currentBot, home);
  assert.equal(out.contextPressure.contextWindow, 1000000, "settings.yaml 显式 1M 应保留");
});

test("alignContextWindowForBot：deepseek-official 无显式 → 默认 1M", () => {
  const stats = { contextPressure: { pressureTokens: 10, contextWindow: 500000, provider: "old", model: "old-model" } };
  const currentBot = { id: "worker", modelProvider: "deepseek-official", model: "deepseek-v4-flash" };
  const home = mkHome({ worker: bot() });
  fs.mkdirSync(path.join(home, "profiles", "worker"), { recursive: true });
  fs.writeFileSync(path.join(home, "profiles", "worker", "settings.yaml"), "agent-presets:\n  default: bot-nopersona\n");
  const out = alignContextWindowForBot(stats, currentBot, home);
  assert.equal(out.contextPressure.contextWindow, 1000000, "deepseek-official 默认 1M（官方 dsh-llm-deepseek 默认）");
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
      console.error("✗", name, "—", error.message);
    }
  }
} finally {
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
