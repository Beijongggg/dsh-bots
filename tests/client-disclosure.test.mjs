/**
 * 回归：官方形制披露行基座（pod 03 号票 [[03-official-form-primitives]]）。
 *
 * 被测面＝`lib/client.js` 内的 **披露行**（`DisclosureRow`：图标＋标题＋右对齐
 * `<time>`＋chevron＋展开体）与**令牌化样式基座**（`disclosureCss`）。这两件是
 * 07／08／09 的唯一形状来源，故本文件把它们当**公共缝**测：组件经 `__ModuleLoader__`
 * 捕获式 loader 取到（同 client-fetch.test.mjs／host-contract-gate.test.mjs），
 * 用无 DOM 的迷你渲染器把组件树渲染成 `createElement` 同形的普通对象后断言。
 *
 * 无 DOM 下的键盘口径（显式降级，不假装）：Enter／Space 激活是原生 `<button>` 的
 * 浏览器语义，无头环境无法真的按键，故可执行断言＝「头节点是原生 button（Tab 可达、
 * 无 tabindex=-1、未 disabled）＋展开只走 onClick（未自写 keydown/keyup 拦截，Esc
 * 因此不可能误关）」。真机按键走查归 09／11 号票的人工目视清单。
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

// ---------- 迷你渲染器（无 DOM）：函数组件调用＋useState 槽＋子树展开 ----------
/**
 * 只覆盖本测试所需能力：调用根函数组件、跨重渲染保持它的 useState／useId 槽、
 * 递归展开子组件。嵌套函数组件每次重渲染重建实例（本项目内它们无状态）。
 */
function createMiniReact() {
	let current = null;
	let uidSeq = 0;
	const expand = (node) => {
		if (node === null || node === undefined || typeof node === "boolean") return null;
		if (Array.isArray(node)) return node.map(expand).filter((child) => child !== null);
		if (typeof node !== "object") return node;
		if (typeof node.type === "function") {
			const previous = current;
			current = { hooks: [], cursor: 0 };
			let out;
			try { out = node.type(node.props); } finally { current = previous; }
			return expand(out);
		}
		return {
			type: node.type,
			props: node.props || {},
			children: (node.children || []).map(expand).filter((child) => child !== null)
		};
	};
	const react = {
		createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
		Fragment: Symbol("Fragment"),
		memo: (fn) => fn,
		useState(initial) {
			const instance = current;
			const at = instance.cursor++;
			if (!(at in instance.hooks)) instance.hooks[at] = typeof initial === "function" ? initial() : initial;
			return [instance.hooks[at], (next) => {
				instance.hooks[at] = typeof next === "function" ? next(instance.hooks[at]) : next;
				instance.rerender();
			}];
		},
		useMemo: (fn) => fn(),
		useRef: (value) => ({ current: value }),
		useEffect: () => {},
		useLayoutEffect: () => {},
		useId() {
			if (!current.uid) current.uid = "test-body-" + (uidSeq++);
			return current.uid;
		},
		useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot()
	};
	return {
		react,
		mount(component, props) {
			const instance = { hooks: [], cursor: 0 };
			const view = { tree: null };
			const render = () => {
				const previous = current;
				current = instance;
				instance.cursor = 0;
				let out;
				try { out = component(props); } finally { current = previous; }
				view.tree = expand(out);
			};
			instance.rerender = render;
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

// ---------- 树走查助手 ----------
const walk = (node, fn) => {
	if (node === null || typeof node !== "object") return;
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
const buttonOf = (tree) => findOne(tree, (node) => node.type === "button");
const textOf = (node) => {
	if (node === null || node === undefined) return "";
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (typeof node !== "object") return String(node);
	return (node.children || []).map(textOf).join("");
};

const results = [];
const test = (name, fn) => results.push([name, fn]);

const ROW = () => ({
	icon: h("svg", { className: "stub-icon" }),
	title: "外部触发 · agent",
	time: "14:03",
	timeDateTime: "2026-10-09T06:03:00.000Z",
	children: "正文（pre-wrap）"
});

// ---- 切片 1：官方骨架 ----
test("披露行骨架：section 根＋原生 button 头＋图标／标题／右对齐 time／12px chevron／展开体不在树中", () => {
	assert.equal(typeof mod.DisclosureRow, "function", "导出面缺 DisclosureRow");
	const view = harness.mount(mod.DisclosureRow, ROW());
	const root = view.tree;
	assert.equal(root.type, "section", "根节点须为 section（官方 TurnTriggerNodeView 同形）");
	assert.ok(hasClass(root, "pod-disclosure"), "根类名 pod-disclosure");
	const head = buttonOf(root);
	assert.ok(head, "折叠头须是原生 button");
	assert.equal(head.props.type, "button", "button 须显式 type=button");
	assert.equal(head.props["aria-expanded"], false, "默认折叠");
	assert.equal(typeof head.props.onClick, "function", "折叠头可点击展开");
	assert.equal(typeof head.props.tabIndex, "undefined", "不得用 tabindex 把原生按钮移出 Tab 序");
	assert.equal(head.props.disabled, undefined, "折叠头不得禁用");
	assert.ok(byClass(head, "pod-disclosure-icon"), "图标槽在头部");
	assert.equal(byClass(head, "pod-disclosure-icon").props["aria-hidden"], true, "图标装饰性（aria-hidden）");
	assert.equal(textOf(byClass(head, "pod-disclosure-title")), "外部触发 · agent", "标题走文本槽");
	const time = findOne(head, (node) => node.type === "time");
	assert.ok(time, "时间须是右对齐 <time> 元素");
	assert.ok(hasClass(time, "pod-disclosure-time"));
	assert.equal(time.props.dateTime, "2026-10-09T06:03:00.000Z", "time 带机器可读 dateTime");
	assert.equal(textOf(time), "14:03");
	const chevron = byClass(head, "pod-disclosure-chevron");
	assert.ok(chevron, "chevron 槽在头部");
	assert.equal(chevron.props["aria-hidden"], true);
	const chevronIcon = findOne(chevron, (node) => node.type === "IconChevronDownOutlineRegular");
	assert.ok(chevronIcon, "chevron 须走官方 primitives 变体名 IconChevronDownOutlineRegular");
	assert.equal(chevronIcon.props.size, 12, "chevron 尺寸 12px");
	assert.equal(byClass(root, "pod-disclosure-body"), null, "折叠态不渲染展开体");
	assert.equal(byClass(root, "pod-disclosure-content"), null);
});

// ---- 切片 2：展开／折叠＋aria 连线 ----
test("展开／折叠：aria-expanded 翻转、aria-controls 指向展开体 id、chevron 追加 -open（旋转 180°）", () => {
	const view = harness.mount(mod.DisclosureRow, ROW());
	const bodyId = buttonOf(view.tree).props["aria-controls"];
	assert.equal(typeof bodyId, "string");
	assert.ok(bodyId.length > 0, "aria-controls 须有展开体 id");

	buttonOf(view.tree).props.onClick();
	const openedHead = buttonOf(view.tree);
	assert.equal(openedHead.props["aria-expanded"], true, "点击后 aria-expanded 翻真");
	const body = byClass(view.tree, "pod-disclosure-body");
	assert.ok(body, "展开后渲染展开体");
	assert.equal(body.props.id, bodyId, "aria-controls 指向展开体 id");
	assert.equal(body.props["aria-controls"], undefined, "展开体不重复声明 aria-controls");
	assert.ok(byClass(view.tree, "pod-disclosure-chevron-open"), "展开态 chevron 追加 -open 类");
	assert.equal(byClass(view.tree, "pod-disclosure-content") !== null, true, "展开体含正文槽");

	openedHead.props.onClick();
	assert.equal(buttonOf(view.tree).props["aria-expanded"], false, "再点折叠");
	assert.equal(byClass(view.tree, "pod-disclosure-body"), null, "折叠后展开体移出树");
	assert.equal(byClass(view.tree, "pod-disclosure-chevron-open"), null, "折叠态去掉 -open 类");
});

// ---- 切片 3：受控模式 ----
test("受控模式：open 由调用方持有，点击只回调 onOpenChange，组件不自行改写", () => {
	assert.equal(typeof mod.DisclosureRow, "function");
	const seen = [];
	const view = harness.mount(mod.DisclosureRow, { title: "标题", open: false, onOpenChange: (next) => seen.push(next) });
	buttonOf(view.tree).props.onClick();
	assert.deepEqual(seen, [true], "点击须回调期望的新态");
	assert.equal(buttonOf(view.tree).props["aria-expanded"], false, "受控态不得被组件自行改写");
	assert.equal(byClass(view.tree, "pod-disclosure-body"), null, "受控未翻真时不得自行展开");
	const opened = harness.mount(mod.DisclosureRow, { title: "标题", open: true, onOpenChange: () => {} });
	assert.equal(buttonOf(opened.tree).props["aria-expanded"], true);
	assert.ok(byClass(opened.tree, "pod-disclosure-body"), "受控翻真后渲染展开体");
	buttonOf(opened.tree).props.onClick();
	assert.equal(buttonOf(opened.tree).props["aria-expanded"], true, "受控态点击后仍由调用方持有");
});

// ---- 切片 4：槽位落位与缺省 ----
test("槽位：meta／note／附加类名按需落位，缺省不留空节点（无 09 turn-trigger 痕迹）", () => {
	const bare = harness.mount(mod.DisclosureRow, { title: "只有标题" });
	const bareHead = buttonOf(bare.tree);
	assert.equal(byClass(bareHead, "pod-disclosure-icon"), null, "无 icon 不渲染图标槽");
	assert.equal(byClass(bareHead, "pod-disclosure-meta"), null, "无 meta 不渲染次要位");
	assert.equal(findOne(bareHead, (node) => node.type === "time"), null, "无 time 不渲染时间元素");
	// 2026-10-10 用户裁定 09（turn-trigger 形制）搁置不并入主树：基座不得携带其形制钩子
	//（09 复活时由该票重新加回并同步本断言——见票 03 Comments）
	assert.equal(Object.prototype.hasOwnProperty.call(bare.tree.props, "data-turn-trigger"), false, "基座不得落 data-turn-trigger（09 搁置痕迹守卫）");

	const full = harness.mount(mod.DisclosureRow, {
		icon: h("svg", { className: "stub-icon" }),
		title: "标题",
		meta: "参数摘要",
		time: "14:03",
		timeDateTime: "2026-10-09T06:03:00.000Z",
		note: "说明句",
		children: "正文",
		defaultOpen: true,
		className: "pod-row-extra"
	});
	assert.equal(Object.prototype.hasOwnProperty.call(full.tree.props, "data-turn-trigger"), false, "满槽位渲染同样不得落 data-turn-trigger");
	assert.ok(hasClass(full.tree, "pod-row-extra"), "调用方附加类名落在根节点");
	const fullHead = buttonOf(full.tree);
	assert.equal(textOf(byClass(fullHead, "pod-disclosure-meta")), "参数摘要");
	const body = byClass(full.tree, "pod-disclosure-body");
	assert.ok(body, "defaultOpen 须初始展开");
	assert.equal(textOf(byClass(body, "pod-disclosure-note")), "说明句");
	assert.equal(textOf(byClass(body, "pod-disclosure-content")), "正文");
});

// ---- 切片 5：键盘可达（无 DOM 的可执行口径） ----
test("键盘可达：头部是 Tab 可达的原生 button，展开只走 onClick（无自定义键拦截，Esc 不误关）", () => {
	const view = harness.mount(mod.DisclosureRow, { title: "标题" });
	const head = buttonOf(view.tree);
	assert.equal(head.type, "button", "折叠头元素类型必须是原生 button");
	assert.equal(head.props.type, "button", "type=button（避免表单内 submit 语义）");
	assert.equal(head.props.tabIndex, undefined, "不得移出 Tab 序");
	assert.equal(head.props.disabled, undefined, "不得禁用（禁用即不可聚焦）");
	assert.equal(head.props.onKeyDown, undefined, "不得自写 keydown——Enter/Space 由原生 button 语义合成 click");
	assert.equal(head.props.onKeyUp, undefined);
	assert.equal(head.props.onKeyPress, undefined);
	assert.equal(typeof head.props.onClick, "function", "键盘激活路径与点击同一通路");
	assert.equal(findOne(view.tree, (node) => node.props && node.props.onKeyDown), null, "整行不得有键拦截（Esc 无处理即不会误关）");
});

// ---- 切片 6：令牌化样式基座 ----
test("样式基座：只引用官方令牌（--dsw-*／--ds-*），turn-trigger 逐项形制参数齐备", () => {
	const source = mod.disclosureCss;
	assert.equal(typeof source, "string", "导出面缺 disclosureCss");
	const vars = [...source.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]);
	assert.ok(vars.length >= 12, "令牌引用面异常：" + vars.length + " 处");
	for (const name of vars) {
		assert.match(name, /^--(?:dsw|ds)-/, "样式基座引用了非官方令牌：" + name);
	}
	assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(source), "样式基座不得含硬编码十六进制色值");
	assert.ok(!/\b(?:rgba?|hsla?)\(/.test(source), "样式基座不得含硬编码 rgb/hsl 色值");
	const fragments = [
		"border:.5px solid var(--dsw-alias-border-l1)",
		"border-radius:var(--dsw-radius-xl)",
		"background:var(--dsw-alias-markdown-code-block)",
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
		"background:var(--dsw-alias-interactive-bg-hover)",
		"transition:background-color .1s",
		"white-space:pre-wrap",
		"@media (prefers-reduced-motion:reduce){.pod-disclosure{transition:none}}"
	];
	for (const fragment of fragments) {
		assert.ok(source.includes(fragment), "样式基座缺形制片段：" + fragment);
	}
	assert.match(source, /\.pod-disclosure-note\{[^}]*color:var\(--dsw-alias-label-secondary\)/, "说明句须走 label-secondary 令牌");
	// 类名映射与样式文本不漂移
	assert.deepEqual(Object.keys(mod.DISCLOSURE_CLASSES).sort(), [
		"body", "chevron", "content", "head", "icon", "meta", "note", "root", "time", "title"
	].sort());
	for (const [key, cls] of Object.entries(mod.DISCLOSURE_CLASSES)) {
		assert.ok(source.includes("." + cls), `类名映射漂移：${key}=${cls} 不在样式基座中`);
	}
});

// ---- 切片 7：既有 UI 复用（零视觉回归） ----
test("既有 UI 复用：DiscussionGroup 折叠组行为、类名与子节点形状零变化", () => {
	assert.equal(typeof mod.DiscussionGroup, "function", "导出面缺 DiscussionGroup");
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
	assert.equal(root.type, "div");
	assert.equal(root.props.className, "pod-disc", "折叠根类名不得变");
	const head = buttonOf(root);
	assert.equal(head.props.className, "pod-disc-head");
	assert.equal(head.props.type, "button");
	assert.equal(head.props["aria-expanded"], false);
	assert.equal(head.props.title, "discussion.expand");
	assert.equal(typeof head.props.onClick, "function");
	const directChildren = head.children.filter((node) => node && typeof node === "object");
	assert.deepEqual(directChildren.map((node) => (node.props.className || "").split(/\s+/)[0]), [
		"pod-avatar", "pod-disc-label", "pod-disc-count", "pod-disc-time", "pod-disc-chevron"
	], "折叠头子节点顺序／类名零变化");
	assert.equal(directChildren[0].props.style.height, 14, "头像尺寸 14 不变");
	assert.equal(textOf(directChildren[1]), "discussion.title");
	assert.equal(textOf(directChildren[2]), "discussion.exchanges");
	assert.ok(textOf(directChildren[3]).length > 0, "末条时间须保留");
	assert.equal(findOne(directChildren[4], (node) => node.type === "IconChevronDownOutlineRegular").props.size, 12);
	assert.equal(byClass(root, "pod-disc-body"), null, "默认折叠不渲染展开体");

	head.props.onClick();
	const openedRoot = view.tree;
	assert.equal(openedRoot.props.className, "pod-disc pod-disc-open", "展开态根类名不得变");
	const openedHead = buttonOf(openedRoot);
	assert.equal(openedHead.props["aria-expanded"], true);
	assert.equal(openedHead.props.title, "discussion.collapse");
	const body = byClass(openedRoot, "pod-disc-body");
	assert.ok(body, "展开后渲染既有展开体");
	assert.equal(body.props.id, openedHead.props["aria-controls"], "既有折叠组补齐 aria-controls 连线（非视觉增量）");
	assert.equal(findAll(body, (node) => hasClass(node, "pod-disc-item")).length, 2, "组内每条往来一个条目");
	assert.equal(findAll(body, (node) => node.type === "MarkdownText").length, 2, "正文仍走官方 MarkdownText");
	assert.ok(hasClass(byClass(openedHead, "pod-disc-chevron"), "pod-disc-chevron-open"), "展开态 chevron 类名不得变");

	openedHead.props.onClick();
	assert.equal(view.tree.props.className, "pod-disc");
	assert.equal(byClass(view.tree, "pod-disc-body"), null);
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
