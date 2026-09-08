/**
 * 回归：通知派生纯函数（deriveBotNotices）—— 直读 client.js 的模块级纯逻辑。
 *
 * client.js 是 window.__ModuleLoader__.load 的浏览器 bundle（本地相对 require 不被
 * loader 解析：只认种子词/物化模块/boot 图行）。node 测试先注入「捕获型 loader」，
 * import 后从捕获的 factory 以桩 require 调起，取导出的纯函数直测——单一来源、不重复。
 * factory 模块级只触 navigator（typeof 守卫）与 document（typeof 守卫），无需额外桩。
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
  if (id === "react") return { memo: (fn) => fn }; // 模块级唯一 react 调用：react.memo(MsgList)
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
  throw new Error("unexpected require: " + id);
});
const derive = mod.deriveBotNotices;

const results = [];
const test = (name, fn) => results.push([name, fn]);

const bot = (id, online, name) => ({ id, name: name ?? id, online });

test("首快照（prev=[]）→ 静默基线，零通知", () => {
  const next = [bot("a", true, "研究员")];
  assert.deepEqual(derive([], next, {}, Date.now()), []);
});

test("无翻转 → 零通知", () => {
  const prev = [bot("a", true, "研究员"), bot("b", false, "工程师")];
  const next = [bot("a", true, "研究员"), bot("b", false, "工程师")];
  assert.deepEqual(derive(prev, next, {}, Date.now()), []);
});

test("在线→离线 / 离线→在线 → 各出一条通知（含名字与新状态）", () => {
  const prev = [bot("a", true, "研究员"), bot("b", false, "工程师")];
  const next = [bot("a", false, "研究员"), bot("b", true, "工程师")];
  const out = derive(prev, next, {}, Date.now());
  assert.deepEqual(out, [
    { id: "a", name: "研究员", online: false },
    { id: "b", name: "工程师", online: true }
  ]);
});

test("新建 / 删除 → 静默（用户自己在 UI 建/删，看得到）", () => {
  const prev = [bot("a", true, "研究员")];
  const next = [bot("a", true, "研究员"), bot("c", true, "新队员")];
  assert.deepEqual(derive(prev, next, {}, Date.now()), [], "新建不报");
  assert.deepEqual(derive(next, prev, {}, Date.now()), [], "删除不报");
});

test("账本命中（期望态一致且窗口内）→ 吞掉", () => {
  const now = 1000;
  const ledger = { a: { expectedOnline: true, until: now + 10000 } };
  const prev = [bot("a", false, "研究员")];
  const next = [bot("a", true, "研究员")];
  assert.deepEqual(derive(prev, next, ledger, now), []);
  // 反向：期望离线、实际离线
  const ledger2 = { a: { expectedOnline: false, until: now + 10000 } };
  assert.deepEqual(derive(next, prev, ledger2, now), []);
});

test("账本过期 → 照常通知（10s 窗口外的翻转视为新事件）", () => {
  const now = 1000;
  const ledger = { a: { expectedOnline: true, until: 500 } }; // 已过期
  const prev = [bot("a", false, "研究员")];
  const next = [bot("a", true, "研究员")];
  assert.deepEqual(derive(prev, next, ledger, now), [{ id: "a", name: "研究员", online: true }]);
});

test("账本不匹配（期望上线却实际离线）→ 照常通知（意外事件）", () => {
  const now = 1000;
  const ledger = { a: { expectedOnline: true, until: now + 10000 } };
  const prev = [bot("a", true, "研究员")];
  const next = [bot("a", false, "研究员")];
  assert.deepEqual(derive(prev, next, ledger, now), [{ id: "a", name: "研究员", online: false }]);
});

test("非法输入（prev/next 非数组）→ 空数组（防御）", () => {
  assert.deepEqual(derive(null, [], {}, Date.now()), []);
  assert.deepEqual(derive(undefined, [], {}, Date.now()), []);
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
