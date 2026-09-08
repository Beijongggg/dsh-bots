/**
 * 端到端：真实 dsh-client-locale 运行时 × 真实 dsh-bots apply（补桩测试测不到
 * 的路径——冲突检测/查询链/common 回退/语言翻转/卸载注销/重挂无残留）。
 *
 * 装置：捕获型 loader 分别加载官方 client-locale bundle 与本插件 bundle 的
 * factory；官方 apply 以桩服务调起（真实 LocaleRuntime 实例 + 真实 common 字典
 * 注册），本插件 apply 以真实 locale 服务 + 桩 effect/slots/layout 调起。
 * 存在性守卫：官方包未安装时跳过（不耦合测试套件到宿主安装状态）。
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CANDIDATES = [
  "/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js",
  join(homedir(), ".dsh/profiles/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js")
];
const officialPath = CANDIDATES.find((p) => existsSync(p));
if (!officialPath) {
  console.log("⤼ 官方 @deepseek-ai/dsh-client-locale 不在本机（存在性守卫），跳过真实运行时验证");
  process.exit(0);
}

globalThis.window = {};

// --- 1. 官方 bundle：捕获 factory，桩 4 个 require，调起真实 apply ---
let officialCap = null;
globalThis.window.__ModuleLoader__ = { load: (opts) => { officialCap = opts; } };
await import(pathToFileURL(officialPath).href);
const official = officialCap.factory((id) => {
  if (id === "react/jsx-runtime") return {};
  if (id === "react") return {};
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
  if (id === "@deepseek-ai/dsh-client-runtime/client") return { defineStore: (o) => o };
  throw new Error("unexpected official require: " + id);
});
assert.equal(typeof official.LocaleRuntime, "function", "官方 LocaleRuntime 类未导出");

let provided = {};
const settingsHost = {
  subscribe: () => () => {},
  getSnapshot: () => ({ value: undefined }),
  set: () => {}
};
official.apply({
  effect: (fn) => { fn(); return () => {}; },
  provide: (name, svc) => { provided[name] = svc; },
  on: () => {},
  emit: () => {}, // setLocale → publish → ctx.emit("locale/change") 的接线
  slots: { installLocale: () => {}, inject: () => () => {}, register: () => () => {} },
  settingsScope: { bind: () => settingsHost }
});
const locale = provided.locale;
assert.ok(locale && typeof locale.register === "function", "官方 apply 未提供 locale 服务");

// --- 2. 本插件 bundle：捕获 factory，真实 locale + 桩 effect/slots/layout ---
let botsCap = null;
globalThis.window.__ModuleLoader__ = { load: (opts) => { botsCap = opts; } };
await import("../lib/client.js");
const mod = botsCap.factory((id) => {
  if (id === "react") return { memo: (fn) => fn };
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
  throw new Error("unexpected bots require: " + id);
});

class FakeEventSource {
  constructor(url) { this.url = url; this.readyState = 0; }
  addEventListener() {}
  removeEventListener() {}
  close() {}
}
globalThis.EventSource = FakeEventSource;

let disposeEffects = [];
const applyBotPlugin = () => {
  const effects = [];
  const ctx = {
    layout: {},
    locale,
    slots: {
      inject: (key, cb) => { const d = cb(); return typeof d === "function" ? d : () => {}; },
      register: () => () => {}
    },
    effect: (fn) => {
      const d = fn();
      if (typeof d === "function") effects.push(d);
      return () => {
        const i = effects.indexOf(d);
        if (i >= 0) effects.splice(i, 1);
        if (typeof d === "function") { const fn2 = d; d = null; fn2(); }
      };
    }
  };
  mod.apply(ctx);
  disposeEffects = effects;
  return () => { for (const e of effects.splice(0)) e(); };
};

const results = [];
const test = (name, fn) => results.push([name, fn]);

test("真实注册：apply 后 bind 查询 zh 命中 / 参数模板 / common 回退", () => {
  locale.setLocale("zh"); // 确定性前置：无论浏览器探测结果如何，active=zh
  const dispose = applyBotPlugin();
  try {
    const t = locale.bind("bots"); // 与 apply 持有的绑定是同一缓存闭包（bind 按 ns 缓存）
    assert.equal(t("mode.title"), "Bot 模式");
    assert.equal(t("notice.online", { name: "研究员" }), "「研究员」已上线");
    assert.equal(t("close"), "关闭"); // 真 common 回退（官方 apply 注册的 common 字典）
  } finally {
    dispose();
  }
});

test("真实冲突检测：活跃期重复注册同名 ns 必抛（响亮失败非静默串词）", () => {
  locale.setLocale("zh");
  const dispose = applyBotPlugin();
  try {
    assert.throws(() => locale.register("bots", mod.localeDicts), /already has locale/);
  } finally {
    dispose();
  }
});

test("真实语言切换：setLocale('en') 后同一闭包即时翻转 + revision 递增", () => {
  locale.setLocale("zh");
  const dispose = applyBotPlugin();
  try {
    const t = locale.bind("bots");
    const rev0 = locale.getLocale().revision;
    locale.setLocale("en");
    assert.equal(locale.getLocale().active, "en");
    assert.equal(locale.getLocale().revision, rev0 + 1, "revision 递增（槽重铸 t 的触发源）");
    assert.equal(t("mode.title"), "Bot Mode");
    assert.equal(t("close"), "Close");
    // isZhLocale 的依赖形状：getLocale().active 为真实字符串属性
    assert.equal(typeof locale.getLocale().active, "string");
  } finally {
    dispose();
  }
});

test("真实卸载注销：dispose 后 ns 消失，查询回退键自身；重挂无残留", () => {
  locale.setLocale("zh");
  const dispose1 = applyBotPlugin();
  const t = locale.bind("bots");
  assert.equal(t("mode.title"), "Bot 模式");
  dispose1(); // 走真实 register disposer 注销 "bots" ns
  assert.equal(t("mode.title"), "mode.title", "卸载后回退键自身（ns 已注销）");
  const dispose2 = applyBotPlugin(); // 重挂（热重载场景）：再注册不冲突
  assert.equal(t("mode.title"), "Bot 模式", "重挂后恢复命中");
  dispose2();
});

let failed = 0;
for (const [name, fn] of results) {
  try {
    fn();
    console.log("✓", name);
  } catch (error) {
    failed += 1;
    console.error("✗", name, "—", error.message);
  }
}
process.exit(failed > 0 ? 1 : 0);
