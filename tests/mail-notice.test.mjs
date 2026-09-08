/**
 * 回归：邮件到达通知文案纯函数（mailNoticeText）—— 直读 client.js 模块级逻辑
 * （捕获型 loader 同 notify-diff.test.mjs：stub react/primitives，不碰 DOM）。
 * 文案以真实 zh/en 字典渲染（占位符用官方同款 {x} 替换），钉住：
 *   - outbox 通知模板（只挂 bot 名）；inbox 通知模板（带发件人）；
 *   - botId/from 经名单映射为显示名，未知回落原始 id；
 *   - zh/en 键存在且占位符一致。
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
const { mailNoticeText, localeDicts } = mod;

const results = [];
const test = (name, fn) => results.push([name, fn]);

/** 官方 translate 同款占位符替换（测试内联，避免依赖运行时）。 */
function makeT(dict) {
  return (key, params) => dict[key].replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "");
}
const tZh = makeT(localeDicts.zh);
const tEn = makeT(localeDicts.en);
const names = new Map([["worker", "研究员"], ["lead", "领队"]]);

test("outbox 事件 → 「{name}」回复：{text}（botId 映射显示名）", () => {
  const ev = { botId: "worker", dir: "outbox", from: "bot", text: "已处理完任务", at: "2026-08-23T03:00:00.000Z", id: "worker-x" };
  assert.equal(mailNoticeText(ev, names, tZh), "「研究员」回复：已处理完任务");
  assert.equal(mailNoticeText(ev, names, tEn), "“研究员” replied: 已处理完任务");
});

test("inbox 事件 → 「{name}」来信（{from}）：{text}（from 映射显示名）", () => {
  const ev = { botId: "worker", dir: "inbox", from: "lead", text: "派个任务", at: "2026-08-23T03:00:00.000Z", seq: 7 };
  assert.equal(mailNoticeText(ev, names, tZh), "「研究员」来信（领队）：派个任务");
  assert.equal(mailNoticeText(ev, names, tEn), "“研究员” mail from 领队: 派个任务");
});

test("未知名回落原始 id（已删除的 bot / 外部发件人）", () => {
  const ev = { botId: "ghost", dir: "inbox", from: "someone", text: "hi", at: null, seq: 1 };
  assert.equal(mailNoticeText(ev, names, tZh), "「ghost」来信（someone）：hi");
  assert.equal(mailNoticeText(ev, null, tZh), "「ghost」来信（someone）：hi", "无名单也不能崩");
});

test("zh/en 键存在且占位符集合一致", () => {
  for (const key of ["mail.reply", "mail.incoming"]) {
    assert.ok(typeof localeDicts.zh[key] === "string" && localeDicts.zh[key].length > 0, `zh 缺 ${key}`);
    assert.ok(typeof localeDicts.en[key] === "string" && localeDicts.en[key].length > 0, `en 缺 ${key}`);
    const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    assert.equal(ph(localeDicts.zh[key]), ph(localeDicts.en[key]), `${key} 中英占位符不一致`);
  }
});

test("text 内的花括号 / 特殊字符不被模板替换误伤", () => {
  const ev = { botId: "worker", dir: "outbox", from: "bot", text: "结果 {a} 与 100% 完成", at: null, id: "x" };
  assert.equal(mailNoticeText(ev, names, tZh), "「研究员」回复：结果 {a} 与 100% 完成");
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
