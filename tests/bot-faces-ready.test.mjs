/**
 * bot 实例三面（团队提示段／知识库工具／岗位工具面）的服务等待注册（16 号票
 * ptc-r2）：DSH_TOOLS_MODE=ptc 下官方 web patch 的 tools 行等 ptcRuntime 就绪，
 * ctx.get("tools") 在 apply 时点可能取空——原 ctx.effect 立即取空即静默跳过，
 * 岗位工具面与 org-ready 引导随 PTC 切换丢失（2026-09-29 真实面实证：引导
 * 零审计行、通道行缺失）。改为 ctx.inject 等待服务就绪后注册；无该服务的宿主
 * （纯 web 无 agent 工具面）回调永不执行＝与原静默跳过等价。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const results = [];
const test = (name, fn) => results.push([name, fn]);

const internals = await import("../lib/index.js").then((m) => m.internals).catch(() => null);

/** 记录型 ctx：inject(names, cb) 挂起等待；effect 收集 disposer；get 按表返回。 */
function makeWaitingCtx({ services = {} } = {}) {
  const injected = [];
  const effects = [];
  return {
    injected, effects,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    inject(names, cb) { injected.push({ names, cb }); },
    effect(fn, label) { effects.push({ fn, label }); },
    get(name) { return services[name]; },
    baseUrl: "file:///tmp/x/implementer"
  };
}

test("internals 导出 registerBotFacesOnReady（等待注册的单一坐标）", () => {
  assert.ok(internals, "lib/index.js internals 可导入");
  assert.equal(typeof internals.registerBotFacesOnReady, "function", "registerBotFacesOnReady 须导出");
});

test("三面经 ctx.inject 声明等待：systemPrompt 一次＋tools 一次，不立即注册", () => {
  const ctx = makeWaitingCtx();
  internals.registerBotFacesOnReady(ctx, { readRegistry: () => ({}) }, "implementer", null, "");
  const waits = ctx.injected.map((row) => row.names.join(","));
  assert.deepEqual(waits.sort(), ["systemPrompt", "tools"], "两个等待声明");
  assert.equal(ctx.effects.length, 0, "服务未就绪前不产生任何注册 effect");
});

test("tools 延迟就绪：回调触发时岗位面与知识库工具注册执行（apply 时点取空的静默跳过消失）", () => {
  const ctx = makeWaitingCtx(); // services 空——apply 等价时点 get("tools") 为空
  const registered = [];
  const registrations = [];
  // 捕获注册函数被调用：借助 knowledge/org 注册都会先取 tools 服务的形状，
  // 这里用一个最小 tools 服务记录 register 调用（与官方 tools.register 形状一致）。
  const tools = { register(def) { registered.push(def.name); return () => {}; }, restrict() {} };
  internals.registerBotFacesOnReady(ctx, { readRegistry: () => ({}) }, "implementer", null, "");
  const toolsWait = ctx.injected.find((row) => row.names.includes("tools"));
  assert.ok(toolsWait, "tools 等待声明在位");
  // 就绪触发：回调收到注入了 tools 的 ctx（官方 inject 语义），注册立即发生
  toolsWait.cb({ ...ctx, get: (name) => (name === "tools" ? tools : undefined) });
  assert.ok(registered.includes("knowledge_search"), "知识库工具在就绪后注册");
  // org 工具面无 home 岗位输入时静默不注册；有岗位时经 op-set 派生（下一条用例）
});

test("岗位工具面随 tools 就绪注册：绑定 home 岗位的实例注册 op 工具", () => {
  const ctx = makeWaitingCtx();
  const registered = [];
  const tools = { register(def) { registered.push(def.name); return () => {}; }, restrict() {} };
  const api = { readRegistry: () => ({ worker: { id: "worker", post: "implementer" } }), dshHome: "/tmp/dsh-none" };
  internals.registerBotFacesOnReady(ctx, api, "worker", null, "http://127.0.0.1:3100");
  const toolsWait = ctx.injected.find((row) => row.names.includes("tools"));
  toolsWait.cb({ ...ctx, get: (name) => (name === "tools" ? tools : undefined) });
  assert.ok(registered.length > 1, "岗位 op 工具按 op-set 派生注册");
});

test("无该服务的宿主：inject 回调不触发即不注册（纯 web 跳过语义保持）", () => {
  const ctx = makeWaitingCtx();
  internals.registerBotFacesOnReady(ctx, { readRegistry: () => ({}) }, "implementer", null, "");
  // 不触发任何回调（服务永不出现）——无异常、无 effect
  assert.equal(ctx.effects.length, 0);
});

test("disposer 经 ctx.effect 挂接：卸载时清理已注册面", () => {
  const ctx = makeWaitingCtx();
  const disposed = [];
  const tools = { register() { return () => disposed.push("tool"); }, restrict() {} };
  const systemPrompt = { variable() { return () => {}; }, section() { return () => disposed.push("section"); } };
  internals.registerBotFacesOnReady(ctx, { readRegistry: () => ({}) }, "implementer", null, "");
  ctx.injected.find((row) => row.names.includes("tools")).cb({ ...ctx, get: (n) => (n === "tools" ? tools : undefined) });
  ctx.injected.find((row) => row.names.includes("systemPrompt")).cb({ ...ctx, get: (n) => (n === "systemPrompt" ? systemPrompt : undefined) });
  assert.ok(ctx.effects.length > 0, "注册产生的 disposer 挂入 effect");
  for (const { fn } of ctx.effects) { const dispose = fn(); if (typeof dispose === "function") dispose(); }
  assert.ok(disposed.length > 0, "effect 卸载时调用注册 disposer");
});

test("装配面接线：apply 的 bot 分支三处 ctx.effect 注册已由等待注册替代（源码钉住）", () => {
  const source = readFileSync(fileURLToPath(new URL("../lib/index.js", import.meta.url)), "utf8");
  const botBranch = source.slice(source.indexOf("if (botInstanceId !== null)"), source.indexOf("// 邮件到达通知监视器"));
  assert.ok(botBranch.includes("registerBotFacesOnReady("), "bot 分支调用等待注册");
  for (const fn of ["registerTeamPromptSection", "registerKnowledgeTools", "registerOrgTools"]) {
    assert.ok(!botBranch.includes(`() => ${fn}(ctx`), `${fn} 不再以立即执行 effect 直接注册`);
  }
});

// ---------- 运行 ----------
let failed = 0;
for (const [name, fn] of results) {
  try {
    await fn();
    console.log("✓", name);
  } catch (error) {
    failed += 1;
    console.error("✗", name, "—", error.stack ?? error.message);
  }
}
console.log(failed === 0 ? "\nbot-faces-ready 测试全部通过" : `\n${failed} 项失败`);
process.exit(failed > 0 ? 1 : 0);
