/**
 * 回归：形制统一——Pod 自有信息改用官方 `turn-trigger` 形制（pod 09 号票
 * [[09-turn-trigger-form]]；判据 V-P5.8／V-P5.9，规格 §D5 表为唯一形制源）。
 *
 * 被测面（三条公共缝）：
 *   1. `MessageStream`（会话流）——「外部触发」行只在 bot 因外部来源（relay／邮件类）
 *      开回合时出现，且使用官方形制披露行；用户触发与非外部前置消息**不得**出行
 *      （§E R5④：形制统一不改变拼装锚点，只加行不改序）。
 *   2. `DiscussionGroup`——讨论组／relay 折叠组走同一件 `DisclosureRow`（不自造第二套）。
 *   3. `BotNotices`——右下角堆叠通知保持轻量形制（负例：不得出现任何披露行形制痕迹）。
 *
 * 装载与断言手法与 client-disclosure.test.mjs 同源：`__ModuleLoader__` 捕获式 loader
 * 取模块，无 DOM 迷你渲染器把组件树渲成 `createElement` 同形对象后断言。无头环境
 * 无法真的按键，键盘口径的降级断言见用例名，真机走查转 11 号票清单。
 */
import assert from "node:assert/strict";

// ---------- 装载：捕获型 loader（官方 client bundle 装载协议同形） ----------
let captured = null;
globalThis.window = {
	__ModuleLoader__: {
		load: (opts) => { captured = opts; }
	}
};
await import("../lib/client.js");

// ---------- 迷你渲染器（与 client-disclosure.test.mjs 同实现，独立副本） ----------
function createMiniReact() {
	/** 渲染上下文：`anchor`＝本次 mount 的槽位表；`slot`＝当前组件的槽；`rerender`＝根重渲染。 */
	const root = { anchor: null, slot: null, rerender: () => {} };
	let ctx = { anchor: { slots: new Map() }, slot: { hooks: [], cursor: 0, uid: null }, rerender: () => {} };
	let uidSeq = 0;
	let rootSeq = 0;
	const slotsFor = (anchor, key) => {
		if (!anchor.slots) anchor.slots = new Map();
		if (!anchor.slots.has(key)) anchor.slots.set(key, { hooks: [], cursor: 0, uid: null });
		const slot = anchor.slots.get(key);
		slot.cursor = 0;
		return slot;
	};
	const expand = (node, path) => {
		if (node === null || node === undefined || typeof node === "boolean") return null;
		if (Array.isArray(node)) return node.map((child, index) => expand(child, path + "." + index)).filter((child) => child !== null);
		if (typeof node !== "object") return node;
		if (typeof node.type === "function") {
			const previous = ctx;
			const key = path + ":" + (node.type.name || "anon");
			const slot = slotsFor(previous.anchor, key);
			ctx = { anchor: previous.anchor, slot, rerender: previous.rerender };
			let out;
			try { out = node.type(node.props); } finally { ctx = previous; }
			return expand(out, key);
		}
		return {
			type: node.type,
			props: node.props || {},
			children: (node.children || []).map((child, index) => expand(child, path + "." + index))
				.filter((child) => child !== null)
		};
	};
	const react = {
		createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
		Fragment: Symbol("Fragment"),
		memo: (fn) => fn,
		useState(initial) {
			const slot = ctx.slot;
			const at = slot.cursor++;
			if (!(at in slot.hooks)) slot.hooks[at] = typeof initial === "function" ? initial() : initial;
			return [slot.hooks[at], (next) => {
				slot.hooks[at] = typeof next === "function" ? next(slot.hooks[at]) : next;
				root.rerender();
			}];
		},
		useMemo: (fn) => fn(),
		useRef: (value) => ({ current: value }),
		useEffect: () => {},
		useLayoutEffect: () => {},
		useId() {
			if (!ctx.slot.uid) ctx.slot.uid = "test-body-" + (uidSeq++);
			return ctx.slot.uid;
		},
		useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot()
	};
	return {
		react,
		mount(component, props) {
			const anchor = { id: rootSeq++ };
			const view = { tree: null };
			const render = () => {
				const previous = ctx;
				const key = "$root:" + (component.name || "anon");
				const slot = slotsFor(anchor, key);
				slot.uid = "test-root-" + anchor.id;
				root.anchor = anchor;
				root.slot = slot;
				root.rerender = render;
				ctx = { anchor, slot, rerender: render };
				let out;
				try { out = component(props); } finally { ctx = previous.slot ? previous : root; }
				view.tree = expand(out, key);
			};
			render();
			return view;
		}
	};
}

const harness = createMiniReact();
const primitivesStub = new Proxy({}, {
	get: (_target, key) => (props) => ({ type: String(key), props: props || {}, children: [] })
});
const mod = captured.factory((id) => {
	if (id === "react") return harness.react;
	if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitivesStub;
	throw new Error("unexpected require: " + id);
});
const h = harness.react.createElement;
// 无宿主 locale 面：把本插件词典设为 `tr` 兜底（形状测试不假装有宿主 locale 面，
// 但文案键的存在性与两语言齐备由本文件另一用例直读 localeDicts 断言）。
mod.__setLocaleDictsForTest(mod.localeDicts);

// ---------- 树走查助手 ----------
const walk = (node, fn) => {
	if (node === null || typeof node !== "object") return;
	if (Array.isArray(node)) { for (const child of node) walk(child, fn); return; }
	fn(node);
	for (const child of node.children || []) walk(child, fn);
};
const findAll = (tree, predicate) => {
	const hits = [];
	walk(tree, (node) => { if (predicate(node)) hits.push(node); });
	return hits;
};
const findOne = (tree, predicate) => findAll(tree, predicate)[0] || null;
const hasClass = (node, cls) =>
	!!node && typeof node.props.className === "string" && node.props.className.split(/\s+/).includes(cls);
const byClass = (tree, cls) => findOne(tree, (node) => hasClass(node, cls));
const textOf = (node) => {
	if (node === null || node === undefined) return "";
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (typeof node !== "object") return String(node);
	return (node.children || []).map(textOf).join("");
};
/** 会话流里带 `data-turn-trigger` 的行（＝外部触发行的唯一标记）。 */
const triggerRows = (tree) => findAll(tree, (node) =>
	node && node.props && node.props["data-turn-trigger"] !== undefined);

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ---------- 夹具 ----------
const BOTS = [
	{ id: "b0", name: "首席", role: "" },
	{ id: "b1", name: "调研员", role: "" }
];
/** 外部触发行（V-P5.8 全覆盖）：relay 来源（kind=agent，规格点名的 `agent` 源）。 */
const relayTrigger = () => ({
	kind: "agent",
	name: "调研员",
	time: "14:03",
	timeDateTime: "2026-10-09T06:03:00.000Z",
	text: "把调研结论发我"
});
/** 外部触发行（V-P5.8 全覆盖）：邮件类未知来源（kind=mail）。 */
const mailTrigger = () => ({
	kind: "mail",
	name: "alerts@example.com",
	time: "14:05",
	timeDateTime: "2026-10-09T06:05:00.000Z",
	text: "构建失败：job #42"
});

// ---- 切片 1（V-P5.8）：外部触发行＝官方 turn-trigger 形制逐项 ----
test("V-P5.8 外部触发行：section 根＋data-turn-trigger＋0.5px 边框／radius-xl／code-block 底色；头部 12px 16px＋gap10px；图标 14px；标题 13px；右对齐 time；12px chevron", () => {
	assert.equal(typeof mod.ExternalTriggerRow, "function", "导出面缺 ExternalTriggerRow");
	const view = harness.mount(mod.ExternalTriggerRow, { trigger: relayTrigger() });
	const root = view.tree;
	assert.equal(root.type, "section", "根节点须为 section（官方 TurnTriggerNodeView 同形）");
	assert.equal(root.props["data-turn-trigger"], true, "外部触发行归根须打 data-turn-trigger");
	assert.ok(hasClass(root, "dsh-bots-disclosure"), "外部触发行走披露行基座（不自造第二套）");
	const head = byClass(root, "dsh-bots-disclosure-head");
	assert.ok(head, "折叠头走披露行头部类");
	assert.equal(head.type, "button", "折叠头须是原生 button");
	assert.equal(head.props.type, "button");
	assert.equal(head.props["aria-expanded"], false, "默认折叠");
	assert.equal(head.props["aria-controls"], head.props["aria-controls"], "aria-controls 连线");
	assert.ok(typeof head.props["aria-controls"] === "string" && head.props["aria-controls"].length > 0);
	const icon = byClass(head, "dsh-bots-disclosure-icon");
	assert.ok(icon, "图标槽在头部");
	assert.equal(icon.props["aria-hidden"], true, "图标装饰性");
	const iconNode = findOne(icon, (node) => /^Icon/.test(String(node.type)));
	assert.equal(iconNode.props.size, 14, "图标 14px");
	assert.equal(textOf(byClass(head, "dsh-bots-disclosure-title")), "调研员 触发了本轮回复", "标题为触发来源说明");
	const time = findOne(head, (node) => node.type === "time");
	assert.ok(time, "时间须是 <time> 元素（右对齐见样式表断言）");
	assert.equal(time.props.dateTime, "2026-10-09T06:03:00.000Z", "time 带机器可读 dateTime");
	assert.equal(textOf(time), "14:03");
	const chevron = byClass(head, "dsh-bots-disclosure-chevron");
	assert.ok(chevron, "chevron 槽在头部");
	assert.equal(findOne(chevron, (node) => node.type === "IconChevronDownOutlineRegular").props.size, 12, "chevron 12px");
	assert.equal(byClass(root, "dsh-bots-disclosure-body"), null, "折叠态不渲染展开体");
});

test("V-P5.8 外部触发行展开：说明句＋pre-wrap 正文（限高 240px 见样式表）；chevron 旋转 180°；正文＝触发原文", () => {
	const view = harness.mount(mod.ExternalTriggerRow, { trigger: relayTrigger() });
	const head = byClass(view.tree, "dsh-bots-disclosure-head");
	const bodyId = head.props["aria-controls"];
	head.props.onClick();
	const opened = byClass(view.tree, "dsh-bots-disclosure-head");
	assert.equal(opened.props["aria-expanded"], true, "点击后 aria-expanded 翻真");
	const body = byClass(view.tree, "dsh-bots-disclosure-body");
	assert.ok(body, "展开后渲染展开体");
	assert.equal(body.props.id, bodyId, "aria-controls 指向展开体 id");
	assert.ok(textOf(byClass(body, "dsh-bots-disclosure-note")).length > 0, "展开体含说明句（turn-trigger 读法）");
	assert.equal(textOf(byClass(body, "dsh-bots-disclosure-content")), "把调研结论发我", "正文＝触发原文（pre-wrap 见样式表）");
	assert.ok(byClass(view.tree, "dsh-bots-disclosure-chevron-open"), "展开态 chevron 追加 -open（旋转 180° 见样式表）");
});

test("V-P5.8 `agent` 源图标＝官方变体 IconPaperPlaneOutlineRegular；图标色走 label-tertiary（样式表）", () => {
	const view = harness.mount(mod.ExternalTriggerRow, { trigger: relayTrigger() });
	const icon = byClass(view.tree, "dsh-bots-disclosure-icon");
	assert.ok(findOne(icon, (node) => node.type === "IconPaperPlaneOutlineRegular"),
		"agent 源图标须取 IconPaperPlaneOutlineRegular（规格 §D5 点名）");
});

test("V-P5.8 形制参数逐项落地：披露行样式表含 §D5 表全部条目（边框／圆角／底色／hover／头部／图标／标题／时间／chevron／展开体／过渡／reduced-motion）", () => {
	const source = mod.disclosureCss;
	const fragments = [
		"border:.5px solid var(--dsw-alias-border-l1)",
		"border-radius:var(--dsw-radius-xl)",
		"background:var(--dsw-alias-markdown-code-block)",
		"background:var(--dsw-alias-interactive-bg-hover)",
		"padding:12px 16px",
		"gap:10px",
		"color:var(--dsw-alias-label-tertiary)",
		"font:var(--dsw-font-xs-13)",
		"color:var(--dsw-alias-label-caption)",
		"font:var(--dsw-font-xxs-12)",
		"margin-left:auto",
		"transform:rotate(180deg)",
		"padding:0 16px 12px 40px",
		"max-height:240px",
		"transition:background-color .1s",
		"white-space:pre-wrap",
		"@media (prefers-reduced-motion:reduce){.dsh-bots-disclosure{transition:none}}"
	];
	for (const fragment of fragments) {
		assert.ok(source.includes(fragment), "样式表缺 §D5 形制片段：" + fragment);
	}
	assert.match(source, /\.dsh-bots-disclosure-title\{[^}]*color:var\(--dsw-alias-label-primary\)/,
		"标题色须走 label-primary");
	assert.match(source, /\.dsh-bots-disclosure-note\{[^}]*color:var\(--dsw-alias-label-secondary\)/,
		"说明句色须走 label-secondary");
	// 外部触发行自带的行级类（间距）须有样式归属，不得是裸类名
	assert.match(mod.disclosureCss, /\.dsh-bots-turn-trigger\{[^}]*margin:/,
		"外部触发行行级类 .dsh-bots-turn-trigger 须在样式表中且带行级间距");
});

// ---- 切片 2（V-P5.9）：覆盖范围＝外部触发行＋讨论组；通知面不动 ----
test("V-P5.9 覆盖范围：流转 relay 消息后的 bot 回复前出外部触发行；用户触发回合不出行（§E R5④ 拼装锚点不变）", () => {
	assert.equal(typeof mod.MessageStream, "function", "导出面缺 MessageStream");
	const messages = [
		{ id: "m1", text: "给用户的第一条", from: "bot", timestamp: "2026-10-09T06:00:00.000Z" },
		{ id: "m2", text: "把调研结论发我", from: "b1", timestamp: "2026-10-09T06:03:00.000Z" },
		{ id: "m3", text: "结论如下：……", from: "bot", timestamp: "2026-10-09T06:04:00.000Z" }
	];
	const view = harness.mount(mod.MessageStream, { messages, botId: "b0", botName: "首席", bots: BOTS, t: (key) => key });
	const rows = triggerRows(view.tree);
	assert.equal(rows.length, 1, "只有外部触发的回合出行（用户触发不出现）");
	assert.ok(hasClass(rows[0], "dsh-bots-disclosure"), "外部触发行走官方形制披露行");
	assert.equal(rows[0].type, "section");
	// 锚点不变：触发行排在 relay 折叠组之后、bot 回复之前
	const topNodes = view.tree;
	assert.deepEqual(topNodes.map((node) => (node === rows[0] ? "trigger"
		: (hasClass(node, "dsh-bots-msg") ? "msg" : hasClass(node, "dsh-bots-disc") ? "disc" : "other"))),
		["msg", "disc", "trigger", "msg"],
		"触发行插在触发消息与回合回复之间（不改其它行的相对次序）");
	assert.equal(hasClass(topNodes[3], "dsh-bots-msg"), true, "触发行后紧跟该回合的 bot 回复行");

	const userOnly = harness.mount(mod.MessageStream, {
		messages: [
			{ id: "u1", text: "你好", from: "user", timestamp: "2026-10-09T06:00:00.000Z" },
			{ id: "a1", text: "收到", from: "bot", timestamp: "2026-10-09T06:01:00.000Z" }
		],
		botId: "b0", botName: "首席", bots: BOTS, t: (key) => key
	});
	assert.equal(triggerRows(userOnly.tree).length, 0, "用户触发的回合不得出现外部触发行（零回归）");

	const firstSelf = harness.mount(mod.MessageStream, {
		messages: [{ id: "s1", text: "开场白", from: "bot", timestamp: "2026-10-09T06:00:00.000Z" }],
		botId: "b0", botName: "首席", bots: BOTS, t: (key) => key
	});
	assert.equal(triggerRows(firstSelf.tree).length, 0, "无外部前置消息时不得出行");
});

test("V-P5.9 讨论组／relay 折叠组：同一件 DisclosureRow 形制（不自造第二套），relay 组不再走轻量胶囊头", () => {
	const group = {
		fromId: "b1",
		name: "调研员",
		items: [
			{ id: "m1", text: "第一条", from: "b1", timestamp: "2026-10-09T06:00:00.000Z" },
			{ id: "m2", text: "第二条", from: "b1", timestamp: "2026-10-09T06:03:00.000Z" }
		]
	};
	const view = harness.mount(mod.DiscussionGroup, { group, botId: "b0", t: (key) => key });
	const root = view.tree;
	assert.equal(root.type, "section", "讨论组根＝披露行 section 根");
	assert.ok(hasClass(root, "dsh-bots-disclosure"), "讨论组根走披露行基座");
	assert.ok(hasClass(root, "dsh-bots-disc"), "讨论组保留行级类（间距／身份）");
	const headOf = (tree) => findOne(tree, (node) => node.type === "button" && hasClass(node, "dsh-bots-disclosure-head"));
	const head = headOf(root);
	assert.ok(head, "讨论组头走披露行头部类");
	assert.ok(hasClass(head, "dsh-bots-disc-head"), "讨论组头保留调用点自有类");
	assert.equal(head.props["aria-expanded"], false);
	assert.ok(typeof head.props["aria-controls"] === "string" && head.props["aria-controls"].length > 0, "aria-controls 连线");
	assert.equal(textOf(byClass(head, "dsh-bots-disclosure-title")), "discussion.title", "标题＝讨论组标题文案");
	assert.equal(textOf(byClass(head, "dsh-bots-disclosure-meta")), "discussion.exchanges", "条数落 meta 槽");
	const time = findOne(head, (node) => node.type === "time");
	assert.ok(time, "末条时间落右对齐 <time>");
	assert.equal(time.props.dateTime, "2026-10-09T06:03:00.000Z");
	assert.equal(findOne(byClass(head, "dsh-bots-disclosure-chevron"), (node) => node.type === "IconChevronDownOutlineRegular").props.size, 12);
	assert.equal(byClass(root, "dsh-bots-disclosure-body"), null, "默认折叠不出体");
	head.props.onClick();
	const opened = headOf(view.tree);
	const body = byClass(view.tree, "dsh-bots-disclosure-body");
	assert.ok(body, "展开后出披露行展开体");
	assert.equal(body.props.id, opened.props["aria-controls"]);
	assert.equal(findAll(body, (node) => hasClass(node, "dsh-bots-disc-item")).length, 2, "组内每条往来一个条目（内容槽）");
	assert.equal(findAll(body, (node) => node.type === "MarkdownText").length, 2, "正文仍走官方 MarkdownText");
});

test("V-P5.9 通知面保持轻量形制：BotNotices 不含披露行任何痕迹（负例）", () => {
	assert.equal(typeof mod.BotNotices, "function", "导出面缺 BotNotices（负例直读缝）");
	mod.__setNoticesForTest([
		{ id: "n1", kind: "mail", text: "「调研员」收到新消息", botId: "b1" },
		{ id: "n2", kind: "ok", text: "「首席」已上线" }
	]);
	const view = harness.mount(mod.BotNotices, {});
	mod.__setNoticesForTest([]);
	const root = view.tree;
	assert.ok(hasClass(root, "dsh-bots-notices"), "通知面根类名不得变");
	assert.equal(findAll(root, (node) => node.props && node.props["data-turn-trigger"] !== undefined).length, 0,
		"通知面不得打 data-turn-trigger");
	assert.equal(findAll(root, (node) => typeof node.props.className === "string"
		&& node.props.className.includes("dsh-bots-disclosure")).length, 0,
		"通知面不得套用披露行形制（保持轻量：官方通知是另一套形态）");
	assert.equal(findOne(root, (node) => node.type === "section"), null, "通知项不是 section 披露行");
	assert.equal(findAll(root, (node) => hasClass(node, "dsh-bots-notice")).length, 2, "两条轻量通知行原样");
});

test("V-P5.9 文案 zh／en 齐备无 fallback 缺口：新键两语言同键集、同占位符；触发行自带两语言文案", () => {
	const { zh, en } = mod.localeDicts;
	const triggerKeys = Object.keys(zh).filter((key) => key.startsWith("trigger."));
	assert.ok(triggerKeys.length >= 4, "外部触发行文案键缺失：" + triggerKeys.join(","));
	for (const key of triggerKeys) {
		assert.equal(typeof en[key], "string", "en 缺键（fallback 缺口）：" + key);
		assert.ok(en[key].length > 0, "en 空值：" + key);
	}
	const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
	for (const key of triggerKeys) {
		assert.equal(ph(zh[key]), ph(en[key]), "占位符 zh/en 不一致：" + key);
	}
	// 逐键核对（不靠字典扫描的宽口径）：触发行全部文案键两语言都有非空值
	for (const key of ["trigger.title", "trigger.kind.agent", "trigger.kind.mail", "trigger.note"]) {
		assert.ok(typeof zh[key] === "string" && zh[key].length > 0, "zh 缺键或空值：" + key);
		assert.ok(typeof en[key] === "string" && en[key].length > 0, "en 缺键或空值：" + key);
	}
	assert.equal(zh["trigger.title"].replace("{name}", "调研员"), "调研员 触发了本轮回复");
	// 触发行自带文案（不依赖调用点传 t 时也有字）
	const withT = harness.mount(mod.ExternalTriggerRow, { trigger: relayTrigger(), t: (key, params) => key + ":" + JSON.stringify(params || {}) });
	const title = textOf(byClass(byClass(withT.tree, "dsh-bots-disclosure-head"), "dsh-bots-disclosure-title"));
	assert.ok(title.startsWith("trigger."), "触发行标题须走 locale 键（不硬编码文案）");
});

// ---- 切片 3（V-P5.9 键盘可达，无 DOM 的可执行口径） ----
test("V-P5.9 键盘可达：触发行头部是 Tab 可达原生 button，展开只走 onClick（无自定义键拦截，Esc 不误关）", () => {
	const view = harness.mount(mod.ExternalTriggerRow, { trigger: mailTrigger() });
	const head = byClass(view.tree, "dsh-bots-disclosure-head");
	assert.equal(head.type, "button", "折叠头元素类型必须是原生 button");
	assert.equal(head.props.tabIndex, undefined, "不得移出 Tab 序");
	assert.equal(head.props.disabled, undefined, "不得禁用");
	assert.equal(head.props.onKeyDown, undefined, "不得自写 keydown——Enter/Space 由原生 button 合成 click");
	assert.equal(head.props.onKeyUp, undefined);
	assert.equal(head.props.onKeyPress, undefined);
	assert.equal(typeof head.props.onClick, "function", "键盘激活与点击同通路");
	assert.equal(findOne(view.tree, (node) => node.props && node.props.onKeyDown), null, "整行不得有键拦截（Esc 无处理即不会误关）");
	// 键盘落点可见（仓内扩展，非官方形制参数）：焦点环走 09 的两个调用点类
	assert.match(mod.disclosureCss, /\.dsh-bots-disc-head:focus-visible/,
		"讨论组头须保留键盘焦点环");
	assert.match(mod.disclosureCss, /\.dsh-bots-turn-trigger \.dsh-bots-disclosure-head:focus-visible/,
		"外部触发行头须有键盘焦点环");
});


// ---------- 运行 ----------
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
