/**
 * 回归：官方 locale 系统（"bots" 命名空间字典）—— 键集 zh/en 平衡、模板占位符
 * 一致、client.js 全部 tr/t 键均有定义（含 common 命名空间允许集）、无残留
 * 「tr(中文, 英文) 二元形态」、样本文本快照防措辞漂移。
 *
 * 加载技术与 notify-diff.test.mjs 相同：捕获型 __ModuleLoader__ + 桩 require，
 * 直取 factory 导出的 localeDicts / LOCALE_NS——单一来源、不复制。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const results = [];
const test = (name, fn) => results.push([name, fn]);

// 通用词走官方 common 命名空间回退（关/取消/删除/编辑/保存——文本与 common 完全一致）。
// markdown 面六个键同源：官方 MarkdownText 的 labels 形状（markdownLabelsFor）借用
// common 的 copy／copied／codeBlock.*／markdown.footnotes，勿另立本插件副本。
const COMMON_NS_WORDS = [
  "close", "cancel", "delete", "edit", "save",
  "copy", "copied", "codeBlock.title", "codeBlock.wrap", "codeBlock.unwrap", "markdown.footnotes"
];

test("localeDicts / LOCALE_NS 导出存在，命名空间为 bots", () => {
  assert.ok(mod.localeDicts, "localeDicts 缺失");
  assert.ok(mod.localeDicts.zh, "zh 字典缺失");
  assert.ok(mod.localeDicts.en, "en 字典缺失");
  assert.equal(mod.LOCALE_NS, "bots");
});

test("zh/en 键集完全一致", () => {
  const zhKeys = Object.keys(mod.localeDicts.zh);
  assert.deepEqual([...zhKeys].sort(), Object.keys(mod.localeDicts.en).sort());
});

test("字典规模 ≥ 80 键（覆盖全部 UI 文案）", () => {
  assert.ok(Object.keys(mod.localeDicts.zh).length >= 80, "字典规模异常：" + Object.keys(mod.localeDicts.zh).length);
});

test("模板占位符 zh/en 一致（{name} 类参数化文本）", () => {
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const key of Object.keys(mod.localeDicts.zh)) {
    assert.equal(ph(mod.localeDicts.zh[key]), ph(mod.localeDicts.en[key]), `占位符不一致：${key}`);
  }
});

test("样本快照（防措辞漂移，取自迁移前原文）", () => {
  const { zh, en } = mod.localeDicts;
  assert.equal(zh["notice.online"], "「{name}」已上线");
  assert.equal(en["notice.online"], "“{name}” is online");
  assert.equal(zh["chat.placeholder"], "发消息给 {name}（Enter 发送，Shift+Enter 换行）…");
  assert.equal(en["chat.placeholder"], "Message {name} (Enter to send, Shift+Enter for newline)…");
  assert.equal(zh["stats.tokens"], "输入 {i} tok · 输出 {o} tok");
  assert.equal(en["stats.tokens"], "in {i} tok · out {o} tok");
  assert.equal(zh["delete.title"], "删除 Bot「{name}」？");
  assert.equal(en["delete.title"], "Delete Bot \u201c{name}\u201d?");
  assert.equal(zh["edit.title"], "编辑 Bot「{name}」");
  assert.equal(en["edit.title"], "Edit Bot \u201c{name}\u201d");
  assert.equal(zh["context.ariaLabel"], "上下文已用 {reading}");
  assert.equal(en["context.ariaLabel"], "{reading} of context used");
  assert.equal(zh["pick.intro"], "将你的代理配置组织为一组命名的机器人，每个机器人拥有独立的岗位、模型与工具，可随时启停、相互通信；配置一次，长期复用。");
  assert.equal(en["pick.intro"], "Organize your agents as a team of named bots — each with its own post, model, and tools; start, stop, and message them any time.");
});

test("client.js 源码：tr/t 调用键全部有定义（含 common 允许集）", () => {
  const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  const enKeys = new Set(Object.keys(mod.localeDicts.en));
  const used = new Set();
  for (const m of src.matchAll(/\b(?:t|tr)\(\s*"([^"]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 60, "源码 t/tr 调用键数量异常：" + used.size);
  for (const key of used) {
    assert.ok(enKeys.has(key) || COMMON_NS_WORDS.includes(key), `源码使用未定义键：${key}`);
  }
  // 三元键选择的字面量（t(cond ? "a" : "b", …) 形态）
  for (const key of ["chat.turn", "chat.turns", "chat.message", "chat.messages",
    "discussion.exchange", "discussion.exchanges", "sidebar.expand", "sidebar.collapse"]) {
    assert.ok(enKeys.has(key), `三元键缺失：${key}`);
  }
});

test("模型切换时按目标模型归一化 reasoning effort", () => {
  assert.equal(typeof mod.normalizeEffortForModel, "function");
  const reasoning = (efforts, defaultEffort) => ({ efforts: efforts.map((id) => ({ id, name: id })), defaultEffort });
  assert.equal(mod.normalizeEffortForModel("p", "plain", "max", null), "", "无 reasoning 应清空");
  assert.equal(mod.normalizeEffortForModel("p", "same", "max", reasoning(["off", "max"], "off")), "max", "合法旧值应保留");
  assert.equal(mod.normalizeEffortForModel("p", "fallback", "max", reasoning(["off", "high"], "high")), "high", "非法旧值应使用合法默认值");
  assert.equal(mod.normalizeEffortForModel("p", "clear", "max", reasoning(["off", "high"], "max")), "", "旧值和默认值均非法应清空");

  assert.equal(typeof mod.modelEntryFor, "function");
  const groups = [{ id: "p", models: [
    { id: "A", reasoning: reasoning(["off", "max"], "off") },
    { id: "B", reasoning: reasoning(["off", "high"], "high") },
    { id: "C" }
  ]}];
  const targetB = mod.modelEntryFor(groups, "p", "B");
  assert.equal(targetB.id, "B", "模型切换必须解析目标模型条目");
  assert.equal(mod.normalizeEffortForModel("p", "B", "max", targetB.reasoning), "high", "A→B 应使用 B 的 defaultEffort");
  const targetC = mod.modelEntryFor(groups, "p", "C");
  assert.equal(mod.normalizeEffortForModel("p", "C", "max", targetC.reasoning), "", "A→无 reasoning 模型应清空");
  assert.equal(mod.normalizeEffortForModel("p", "B", "off", targetB.reasoning), "off", "目标模型仍支持时应保留旧 effort");

  // 调用链：模型切换提交值构造（最终 PATCH body 语义）
  assert.equal(typeof mod.modelSelectionValues, "function");
  assert.deepEqual(mod.modelSelectionValues(groups, "p", "B", "max"), {
    modelProvider: "p", model: "B", reasoningEffort: "high"
  }, "A→B 完整提交体：max 归一化为 high");
  assert.deepEqual(mod.modelSelectionValues(groups, "p", "C", "max"), {
    modelProvider: "p", model: "C", reasoningEffort: ""
  }, "A→无 reasoning：提交体清空");
  assert.deepEqual(mod.modelSelectionValues(groups, "p", "B", "off"), {
    modelProvider: "p", model: "B", reasoningEffort: "off"
  }, "目标仍支持：提交体保留旧值");

  const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  assert.match(src, /modelSelectionValues\(dir\.groups, provider, model, bot\.reasoningEffort\)/);
  assert.match(src, /normalizeEffortForModel\(/);
  assert.match(src, /if \(!info \|\| !Array\.isArray\(info\.efforts\)/);
  assert.match(src, /info\.defaultEffort/);
});

test("无残留旧形态：tr(zh, en) 二元字符串 / 模块级 isZh 常量 / 旧二元 tr 签名", () => {
  const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  assert.ok(!/tr\("(?:[^"\\]|\\.)*"\s*,\s*"/.test(src), "残留 tr(zh, en) 二元形态");
  assert.ok(!/\bconst isZh\b/.test(src), "残留 isZh 模块常量（应改用 isZhLocale()）");
  assert.ok(!/const tr\s*=\s*\(zh,\s*en\)/.test(src), "残留旧二元 tr 签名的定义");
  // 垫片形态本身应存在（key/params 单参，apply 绑定后调用时查活动 locale）
  assert.ok(/const tr\s*=\s*\(key,\s*params\)/.test(src), "tr 垫片定义缺失");
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
