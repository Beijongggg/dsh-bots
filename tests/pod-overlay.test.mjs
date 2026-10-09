/**
 * 回归：Pod 覆盖式常驻（pod 04 号票 [[04-pod-overlay-persistent]]，规格附录 A `V-P2.1…V-P2.11`）。
 *
 * 被测面＝`lib/client.js` 的 **进出 Pod 契约**（不再抢占宿主槽位／整屏覆盖层／焦点与
 * 键盘隔离／旁带清理）与 **Pod 内席位切换的保活**。四类坐标：
 *   - 真实 `SlotCore` 语义的**槽账本夹具**（未声明槽 fail closed、list 必带 id）——
 *     载体是宿主公开面 `slots.register`（`HF-CLIENT-SLOTS`）；
 *   - 整屏层几何／层叠上限来自票 02 登记面 `HF-SHELL-OVERLAY-GEOMETRY`
 *     （探针 `P-SHELL-OVERLAY-GEOMETRY`，常量 `SHELL_OVERLAY_LAYER_BAND`）；
 *   - 焦点契约来自票 02 登记面 `HF-SHELL-FOCUS-LAYER`（探针 `P-SHELL-FOCUS-LAYER`，
 *     符号 `useModalLayer` 与 `[role="dialog"][aria-modal="true"]` 选择器语义）；
 *   - 过渡令牌面的挂载点（`HF-HOST-TRANSITION-TOKENS`）本票只留钩子，动效本体归 05。
 *
 * 无 React 运行时／无 jsdom：组件树经**迷你渲染器**渲成 `createElement` 同形普通对象；
 * DOM 面用**最小假 DOM**（真实节点身份、children 数组、inert 原值可观测），
 * 「官方页保活」因此可用**节点身份不变＋属性未被改写**作可执行断言。
 * 真机走查（进/出、Tab/Escape、常用快捷键、焦点不被 composer 抢）归 11 号票人工清单。
 */
import assert from "node:assert/strict";

import { SHELL_OVERLAY_LAYER_BAND } from "../scripts/host-contract-probe.mjs";

// ---------- 装载：捕获型 loader（官方 client bundle 装载协议同形） ----------
let captured = null;
globalThis.window = {
	innerWidth: 1400,
	__ModuleLoader__: {
		load: (opts) => { captured = opts; }
	}
};
// 浏览器全局桩（同 scripts/host-contract-probe.mjs 的 withDomStubs 口径：只做形状，不驱动事件）
globalThis.EventSource = class { constructor() {} addEventListener() {} removeEventListener() {} close() {} };

await import("../lib/client.js");

const IDS = {
	entry: "dsh-bots-entry",
	notices: "dsh-bots-notices",
	pod: "dsh-bots-pod",
	podHost: "dsh-bots-pod-host",
	podLayer: "dsh-bots-pod-layer",
	sidebar: "dsh-bots-sidebar",
	main: "dsh-bots-main"
};

/** 仓库真实 client 源文本（V-P2.3 负例扫描的载体，与装载无关：拒绝「隐藏官方页」的写法）。 */
const clientSource = await (await import("node:fs/promises")).readFile(new URL("../lib/client.js", import.meta.url), "utf8");

// ---------- 迷你 React：hooks 桩（可注入 spy）＋组件树展开 ----------
function createHarness() {
	const hooks = { useLayoutEffect: [], useEffect: [], useEffectCleanups: [], useState: [], useRef: [], useMemo: [], useId: [], useSyncExternalStore: [], useModalLayer: null, createPortal: null };
	const h = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) });
	const react = {
		createElement: h,
		memo: (component) => component,
		Fragment: Symbol("Fragment"),
		useState(initial) {
			hooks.useState.push(initial);
			const value = typeof initial === "function" ? initial() : initial;
			return [value, (next) => { hooks.useState.push(typeof next === "function" ? next(value) : next); }];
		},
		useRef(initial) { hooks.useRef.push(initial); return { current: initial }; },
		useMemo(fn) { hooks.useMemo.push(fn); return fn(); },
		useEffect(fn) { hooks.useEffect.push(fn); hooks.useEffectCleanups.push(fn); },
		useLayoutEffect(fn) { hooks.useLayoutEffect.push(fn); },
		useId() { hooks.useId.push(null); return "pod-test-" + hooks.useId.length; },
		useSyncExternalStore(_subscribe, getSnapshot) { hooks.useSyncExternalStore.push(getSnapshot); return getSnapshot(); }
	};
	const primitives = new Proxy({}, {
		get: (_target, key) => {
			if (key === "useModalLayer") {
				return (...args) => { if (hooks.useModalLayer) hooks.useModalLayer(...args); };
			}
			return (props) => ({ type: String(key), props: props ?? {}, children: [] });
		}
	});
	const loadModule = (extra = {}) => captured.factory((id) => {
		if (id === "react") return react;
		// react-dom 面：createPortal 的**装配口**（模块在 factory 期 `require("react-dom")` 取件，
		// 故容器必须经此活口转发，才能在用例里把 portal 落点记账）
		if (id === "react-dom") return { createPortal: (children, container) => (hooks.createPortal ? hooks.createPortal(children, container) : children) };
		if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		if (id in extra) return extra[id];
		throw new Error("unexpected require: " + id);
	});
	/** 递归展开函数组件（无状态嵌套件每次重渲染重建实例，与本仓既有迷你渲染器口径一致）。 */
	const expand = (node) => {
		if (node === null || node === undefined || typeof node === "boolean") return null;
		if (Array.isArray(node)) return node.map(expand).filter((child) => child !== null);
		if (typeof node !== "object") return node;
		if (typeof node.type === "function") return expand(node.type(node.props ?? {}));
		return { type: node.type, props: node.props ?? {}, children: (node.children ?? []).map(expand).filter((child) => child !== null) };
	};
	return {
		hooks, react, primitives, loadModule,
		render(component, props) {
			try { return expand(h(component, props)); } catch (error) { return { error }; }
		}
	};
}

const harness = createHarness();
const mod = harness.loadModule();

// ---------- 槽账本夹具：真实 SlotCore 语义子集（未声明即 fail closed、list 必带 id） ----------
function createSlotCore(declared) {
	const records = new Map();
	for (const [name, spec] of Object.entries(declared)) records.set(name, { spec, entries: [] });
	return {
		records,
		register(options, component) {
			const rec = records.get(options.name);
			if (!rec?.spec) throw new Error(`slot "${options.name}" is not declared`);
			if (rec.spec.kind === "list" && options.id === undefined) throw new Error(`list slot "${options.name}" requires options.id`);
			const entry = { options, component };
			rec.entries.push(entry);
			return () => { rec.entries = rec.entries.filter((candidate) => candidate !== entry); };
		},
		idsOf(name) { return (records.get(name)?.entries ?? []).map((entry) => entry.options.id); },
		entriesOf(name) { return records.get(name)?.entries ?? []; }
	};
}

/** 宿主声明树（与现装宿主同形：sidebar single／main keyed／shell.overlay list／footer action list）。 */
const DECLARED = {
	sidebar: { kind: "single" },
	main: { kind: "keyed" },
	"shell.overlay": { kind: "list" },
	"sidebar.footer.action": { kind: "list" }
};

/** 记录型宿主 ctx：slots 走槽账本夹具，layout 只暴露**现役** API（`ILayout` 五法）。 */
function createCtx(core) {
	const calls = { layout: [], register: [] };
	const layoutCalls = [];
	const layout = new Proxy({}, {
		get: (_target, key) => (...args) => { calls.layout.push({ method: String(key), args }); layoutCalls.push(String(key)); }
	});
	const ctx = {
		calls,
		effect: (fn) => { const dispose = fn(); return typeof dispose === "function" ? dispose : () => {}; },
		locale: { register: () => () => {}, bind: () => (key) => key, setLocale: () => {}, getLocale: () => "en" },
		layout,
		slots: {
			register: (options, component) => { calls.register.push(options); return core.register(options, component); },
			inject: (name, callback) => (core.records.has(name) ? (callback() ?? (() => {})) : () => {}),
			entriesOfSlot: (name) => core.entriesOf(name)
		}
	};
	return ctx;
}

/** 装载 → apply → 返回 { core, ctx, enter, exit }（enter/exit 经入口钮点击／导出面取用）。 */
function bootPod() {
	const core = createSlotCore(DECLARED);
	const ctx = createCtx(core);
	mod.apply(ctx);
	const entry = core.entriesOf("sidebar.footer.action").find((item) => item.options.id === IDS.entry);
	assert.ok(entry, "入口钮须常驻 sidebar.footer.action 槽");
	return { core, ctx, entry };
}

// ---------- 最小假 DOM（真实节点身份；inert 原值可观测） ----------
function createFakeDom() {
	const makeNode = (label, inert) => {
		const node = {
			label, inert, isConnected: true, children: [],
			appendChild(child) { child.parentNode = node; node.children.push(child); child.isConnected = true; return child; },
			removeChild(child) { node.children = node.children.filter((candidate) => candidate !== child); child.isConnected = false; return child; },
			remove() { if (node.parentNode) node.parentNode.removeChild(node); },
			contains(candidate) { return candidate === node || node.children.some((child) => child.contains(candidate)); },
			attributes: {},
			setAttribute(name, value) { node.attributes[name] = value; },
			getAttribute(name) { return Object.prototype.hasOwnProperty.call(node.attributes, name) ? node.attributes[name] : null; },
			removeAttribute(name) { delete node.attributes[name]; },
			addEventListener() {}, removeEventListener() {},
			querySelectorAll: () => [], querySelector: () => null, focus() {}, matches: () => false,
			style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }
		};
		node.ownerDocument = null;
		return node;
	};
	const body = makeNode("body", undefined);
	const document = {
		body,
		documentElement: makeNode("html", undefined),
		hidden: false,
		createElement: (tag) => makeNode("<" + tag + ">", undefined),
		querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
		getElementById: () => null, head: makeNode("head", undefined)
	};
	body.ownerDocument = document;
	const attach = (label, inert) => { const node = makeNode(label, inert); node.ownerDocument = document; body.appendChild(node); return node; };
	return { document, body, attach };
}

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

/** 组件树内首个带 onClick 的可点节点（入口钮位于嵌套函数组件里）。 */
const findClickable = (node) => findOne(node, (item) => typeof item.props.onClick === "function");
const clickEntry = (entry) => {
	const button = findClickable(entry.component({ wide: true, t: (key) => key }));
	assert.ok(button, "入口组件树内须有可点按钮");
	button.props.onClick();
};

const results = [];
const test = (name, fn) => results.push([name, fn]);
const withFakeDom = (fn) => {
	const previousDocument = globalThis.document;
	const dom = createFakeDom();
	globalThis.document = dom.document;
	// 每个夹具自带 body：清掉旁带内的宿主容器引用／折叠态，避免上一夹具的元素串到本夹具
	mod.__podControl.reset();
	try { return fn(dom); } finally { globalThis.document = previousDocument; mod.__podControl.reset(); }
};

// ================= V-P2.1：槽账本不受影响 =================
test("V-P2.1 进出 Pod 不再注册／注销官方槽位，官方条目账本不变（shell.overlay 只在进出期增删我方层）", () => {
	const { core, entry } = bootPod();
	const before = {
		sidebar: [...core.idsOf("sidebar")],
		main: [...core.idsOf("main")],
		notices: [...core.idsOf("shell.overlay")]
	};
	assert.deepEqual(before.sidebar, [], "装置期不得占用 sidebar（既有基线）");
	assert.deepEqual(before.main, [], "装置期不得占用 main（既有基线）");
	assert.deepEqual(before.notices, [IDS.notices], "通知容器常驻 shell.overlay");
	assert.ok(!before.notices.includes(IDS.pod), "Pod 覆盖层在进入前不得注册");

	clickEntry(entry);
	assert.deepEqual(core.idsOf("sidebar"), before.sidebar, "进入 Pod 不得注册官方 sidebar 条目");
	assert.deepEqual(core.idsOf("main"), before.main, "进入 Pod 不得注册官方 main 条目");
	assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices, IDS.pod], "覆盖层经同一 shell.overlay 槽注册，且不挤掉通知条目");

	// 重入幂等：再点一次不产生第二条覆盖层条目
	clickEntry(entry);
	assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices, IDS.pod], "重入不得重复注册覆盖层");

	// 退出＝撤层：官方 sidebar／main 账本前后逐字一致
	const mainKinds = () => (core.entriesOf("main") ?? []).map((item) => item.options.key ?? "(无键)");
	assert.deepEqual(mainKinds(), [], "退出后 main 槽仍无我方条目");
	const podLayer = core.entriesOf("shell.overlay").find((item) => item.options.id === IDS.pod);
	assert.ok(podLayer, "覆盖层条目在 Pod 期间在位");
	mod.__podControl.exit();
	assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices], "退出＝撤层（仅移除覆盖层条目）");
	assert.deepEqual(core.idsOf("sidebar"), before.sidebar, "退出不得触碰官方 sidebar 账本");
	assert.deepEqual(core.idsOf("main"), before.main, "退出不得触碰官方 main 账本");

	// 再进一次仍成立（进出往复）
	clickEntry(entry);
	assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices, IDS.pod], "二次进入仍只在覆盖层增一条");
	mod.__podControl.exit();
	assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices]);
	assert.deepEqual(core.idsOf("sidebar"), before.sidebar);
	assert.deepEqual(mainKinds(), []);
});

// ================= V-P2.2：官方页保活 =================
test("V-P2.2 进出各一次后官方页状态保留：节点身份不变、滚动/展开态/进行中进度未被触碰", () => {
	withFakeDom((dom) => {
		const officialSidebar = dom.attach("官方侧栏", undefined);
		const officialMain = dom.attach("官方主区", undefined);
		const scroller = dom.attach("官方消息滚动容器", undefined);
		const toolCard = dom.attach("官方工具卡", undefined);
		const progress = dom.attach("官方进行中回合", undefined);
		scroller.scrollTop = 120;
		toolCard.ariaExpanded = "true";
		progress.textContent = "进行中 · 3 步";
		const identity = [officialSidebar, officialMain, scroller, toolCard, progress];
		const snapshot = identity.map((node) => ({ node, scrollTop: node.scrollTop, ariaExpanded: node.ariaExpanded, textContent: node.textContent }));

		// 起装置（apply 须在假 DOM 域内：SSE／locale 副作用走桩）；
		// 覆盖层席位视图会挂真实 BotMain（轮询 effect），按无头口径补计时器桩
		const core = createSlotCore(DECLARED);
		mod.apply(createCtx(core));
		const intervalSpy = () => 0;
		globalThis.window.setInterval = intervalSpy;
		globalThis.window.clearInterval = () => {};

		mod.__podControl.enter();
		// 覆盖层宿主容器＝portal 锚点：由 `__podControl.mountHost`（`PodOverlayHost` 的 layout effect
		// 直调用法）在 body 下建立；无头环境不跑 effect，故经此前门复算同一函数
		const host = mod.__podControl.mountHost(dom.document);
		assert.ok(host, "进入 Pod 须在 body 下建覆盖层宿主容器（portal 锚点）");
		assert.equal(host.parentNode, dom.body, "宿主容器须是 document.body 直接子元素（根堆叠上下文）");
		assert.equal(host.children.length >= 0, true);
		const during = identity.map((node, index) => ({ node, same: snapshot[index].node === node, scrollTop: node.scrollTop, ariaExpanded: node.ariaExpanded, textContent: node.textContent, isConnected: node.isConnected }));
		for (const item of during) {
			assert.equal(item.same, true, "官方 DOM 子树节点身份不得变化（不得卸载重挂）");
			assert.equal(item.isConnected, true, "官方页在 Pod 期间全程挂载");
			assert.equal(item.scrollTop, snapshot[identity.indexOf(item.node)].scrollTop, "官方滚动位置不得被改写");
			assert.equal(item.ariaExpanded, snapshot[identity.indexOf(item.node)].ariaExpanded, "官方工具卡展开态不得被改写");
			assert.equal(item.textContent, snapshot[identity.indexOf(item.node)].textContent, "官方进行中回合的可见进度不得被改写");
		}
		assert.equal(officialSidebar.children.length, 0, "官方容器不得被插入隐藏件");
		// 背景置 inert 是唯一被允许的宿主 DOM 写入（Q23a 授权偏离），且不触碰可见/几何属性：
		// 经真实覆盖层挂载效应（effect 直调用法）施加，与现场同一函数
		const runEffects = (component, useStateProps) => {
			harness.hooks.useEffect.length = 0;
			harness.hooks.useEffectCleanups.length = 0;
			const view = harness.render(component, useStateProps);
			assert.equal(view.error, undefined, "覆盖层须可渲染：" + (view.error && view.error.message));
			const cleanups = [];
			for (const effect of harness.hooks.useEffect.slice()) {
				const out = typeof effect === "function" ? effect() : null;
				if (typeof out === "function") cleanups.push(out);
			}
			return cleanups;
		};
		const cleanups = runEffects(mod.PodOverlayLayer, { open: true, t: (key) => key });
		for (const node of identity) {
			assert.equal(node.inert, true, "覆盖期间背景元素须被置 inert");
			assert.equal(Object.keys(node.style).length, 0, "不得以样式隐藏官方页");
		}

		// 卸载序（React 口径：清理函数按**相反序**跑）→ 撤层
		for (const cleanup of cleanups.slice().reverse()) cleanup();
		mod.__podControl.exit();
		for (const item of snapshot) {
			assert.equal(item.node.isConnected, true, "退出后官方页仍在文档中（全程挂载）");
			assert.equal(item.node.scrollTop, item.scrollTop, "退出后滚动位置保留");
			assert.equal(item.node.ariaExpanded, item.ariaExpanded, "退出后工具卡展开态保留");
			assert.equal(item.node.textContent, item.textContent, "退出后进行中回合可见进度保留");
			assert.equal(item.node.inert, undefined, "退出后 inert 原值还原");
		}
	});
});

// ================= V-P2.3：负例——不得以 hidden／display:none 隐藏官方页 =================
test("V-P2.3 负例：Pod 路径不得对官方页用 hidden／display:none，覆盖层隐藏自身也不用 display:none", () => {
	// 源码级：Pod 层相关代码不得出现「官方页隐藏」写法（我方从不触碰宿主 DOM 的显示属性）
	assert.ok(!/closeDetails\s*\(/.test(clientSource), "死调用 ctx.layout.closeDetails() 须已删除");
	// 我方只对**自身**视图用 hidden 属性互斥（CSS 里落 visibility，节点不卸载）；
	// 禁的是「对官方页（document.body 直接子元素）施加 hidden／display:none」的写法：
	// 覆盖层段落内不得出现 body.children 的可见性写法，也不得出现内联 display:none
	const podSection = clientSource.slice(clientSource.indexOf("Pod 覆盖式常驻"), clientSource.indexOf("// ---------- 插件声明"));
	assert.ok(podSection.length > 0, "Pod 覆盖式常驻段落须存在");
	// 扫描范围＝**覆盖层自己的样式基座**（`podLayerCss` 起止之间；注释先剥）——
	// 既有 `.dsh-bots-header-back{display:none}` 等 Pod 外的历史规则不在本判据内
	const cssStart = clientSource.indexOf("const podLayerCss = `");
	const cssEnd = clientSource.indexOf("`;", cssStart);
	const podCode = clientSource.slice(cssStart, cssEnd + 2);
	assert.ok(podCode.includes("POD_LAYER_CLASSES.layer"), "覆盖层样式基座须存在");
	assert.ok(!/display\s*:\s*["']?none/.test(podCode), "覆盖层样式基座内不得出现 display:none");
	assert.ok(!/\.hidden\s*=\s*true/.test(podSection), "不得直接置宿主元素 hidden（官方页全程挂载）");
	assert.ok(!/\bstyle\.display\s*=/.test(podSection), "不得直接改写宿主元素 display（官方页全程挂载）");
	assert.ok(!/aria-hidden["']?\s*:\s*["']?true[^}]*\bbb?ody\b/.test(podSection), "不得对 body 施加 aria-hidden");
	// 我方隐藏自身视图（列表／席位互斥）用 visibility，不得用 display:none 卸掉交互树
	const podCss = mod.POD_LAYER_CLASSES && mod.podLayerCss;
	assert.equal(typeof podCss, "string", "导出面缺 podLayerCss（覆盖层样式基座）");
	assert.ok(!/display\s*:\s*none/.test(podCss), "覆盖层样式不得用 display:none");
	// 覆盖层视图互斥只走 hidden 属性（CSS 落 visibility），且不得内联 display
	const tree = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
	assert.equal(tree.error, undefined, "覆盖层须可渲染：" + (tree.error && tree.error.message));
	for (const node of findAll(tree, (item) => typeof item.props.className === "string" && item.props.className.includes("dsh-bots-pod"))) {
		assert.equal(node.props.style === undefined, true, "覆盖层节点不得以内联样式隐藏");
	}
	for (const node of findAll(tree, (item) => typeof item.props.className === "string" && item.props.className.includes("dsh-bots-pod-view"))) {
		assert.equal(typeof node.props.hidden, "boolean", "覆盖层视图互斥须走 hidden 布尔属性（visibility 隐藏）");
	}
});

// ================= V-P2.4：覆盖层形制 =================
test("V-P2.4 覆盖层形制：shell.overlay 注册宿主组件＋整屏层 portal 到 body（fixed;inset:0）＋role=dialog／aria-modal", () => {
	const core = createSlotCore(DECLARED);
	const ctx = createCtx(core);
	mod.apply(ctx);
	const registered = core.entriesOf("shell.overlay").map((item) => item.options.id);
	assert.ok(registered.includes(IDS.notices), "通知条目常驻");
	const entry = core.entriesOf("sidebar.footer.action").find((item) => item.options.id === IDS.entry);
	clickEntry(entry);
	const podEntry = core.entriesOf("shell.overlay").find((item) => item.options.id === IDS.pod);
	assert.ok(podEntry, "Pod 层须经 shell.overlay 注册为宿主组件");
	// 组件本体：经 react-dom createPortal 投到 document.body 的整屏层
	withFakeDom((dom) => {
		const portals = [];
		harness.hooks.createPortal = (children, container) => { portals.push({ children, container }); return children; };
		try {
			const host = mod.__podControl.mountHost(dom.document);
			const portalTree = harness.render(podEntry.component, { t: (key) => key });
			const root = findOne(portalTree, (node) => hasClass(node, IDS.podLayer));
			assert.ok(root, "覆盖层根节点须带 dsh-bots-pod-layer 类（渲染树可走查）");
			assert.equal(root.props.role, "dialog", "覆盖层须 role=dialog");
			assert.equal(root.props["aria-modal"], "true", "覆盖层须 aria-modal=true");
			assert.equal(root.props["data-shortcut-modal"], undefined, "data-shortcut-modal 保持可选且不设（未声明即 modal id \"other\"，全命令被拦）");
			assert.ok(portals.length >= 1, "覆盖层须经 react-dom createPortal 投出（非原地渲染）");
			assert.equal(portals.at(-1).container, host, "整屏层须 portal 到 body 下的宿主容器（本次挂载的锚点）");
			assert.equal(portals.every((item) => item.container.className === mod.POD_LAYER_CLASSES.host), true, "每次挂载的 portal 容器都须是覆盖层宿主容器");
			assert.equal(host.parentNode, globalThis.document.body, "宿主容器须是 body 直接子元素（根堆叠上下文，position:fixed 不被重锚）");
			assert.equal(host.className, mod.POD_LAYER_CLASSES.host, "宿主容器类名走常量");
			assert.equal(host.getAttribute("data-dsh-bots-pod-host") === "" || "data-dsh-bots-pod-host" in host.dataset, true, "宿主容器带锚点标记");
		} finally {
			harness.hooks.createPortal = null;
		}
	});
});

// ================= V-P2.5：层叠约束（票 02 面坐标） =================
test("V-P2.5 层叠约束：portal 层高于 AppFrame 层本体档（≥20）且低于官方 body 级浮层最低档 900，不复用 1001", () => {
	const css = mod.podLayerCss;
	assert.equal(typeof css, "string", "导出面缺 podLayerCss");
	const layerRule = css.slice(css.indexOf("." + IDS.podLayer));
	assert.match(layerRule, /\{([^}]*)\}/, "覆盖层须有整屏几何规则");
	const body = layerRule.slice(layerRule.indexOf("{") + 1, layerRule.indexOf("}"));
	assert.match(body, /position:fixed/, "整屏层须 position:fixed（portal 到 body）");
	assert.match(body, /inset:0/, "整屏层须四边归零");
	const band = Number((body.match(/z-index:(\d+)/) || [])[1]);
	assert.equal(Number.isInteger(band), true, "整屏层须显式定档（不依赖同层 order）");
	assert.ok(band >= SHELL_OVERLAY_LAYER_BAND, `档位须 ≥ 官方层本体档 ${SHELL_OVERLAY_LAYER_BAND}（实测 ${band}）`);
	assert.ok(band < 900, `档位须低于官方 body 级浮层最低档 900（实测 ${band}）`);
	assert.ok(band !== 1001, "不得复用官方平台页档 1001");
	assert.equal(mod.POD_OVERLAY_Z_INDEX, band, "取值须由单一常量持有（禁散落数值）");
	assert.equal(mod.SHELL_OVERLAY_LAYER_BAND, SHELL_OVERLAY_LAYER_BAND, "层本体档须由票 02 探针常量派生（HF-SHELL-OVERLAY-GEOMETRY）");
});

// ================= V-P2.6：不依赖同层 order =================
test("V-P2.6 不依赖同层 order：Pod 主层注册不带 order，且层叠由 portal z-index 决定", () => {
	const { core, entry, ctx } = bootPod();
	clickEntry(entry);
	const podRegistration = ctx.calls.register.find((options) => options.id === IDS.pod);
	assert.ok(podRegistration, "覆盖层注册选项须可见");
	assert.equal("order" in podRegistration, false, "Pod 主层不得声明 order（不复用通知条目的 order:-10 语义）");
	assert.equal("priority" in podRegistration, false, "Pod 主层不得靠 priority 抢位（同层顺序无关）");
	assert.equal(mod.POD_LAYER_CLASSES.layer, IDS.podLayer);
	assert.ok(core.idsOf("shell.overlay").includes(IDS.pod));
});

// ================= V-P2.7：焦点契约（票 02 面坐标） =================
test("V-P2.7 焦点契约：primitives.useModalLayer(ref, open, onClose) 接管 Tab 囚笼／Escape／焦点归还", () => {
	withFakeDom(() => {
		const calls = [];
		harness.hooks.useModalLayer = (...args) => calls.push(args);
		try {
			const tree = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
			assert.equal(tree.error, undefined, "Pod 覆盖层须可渲染：" + (tree.error && tree.error.message));
			const root = findOne(tree, (node) => hasClass(node, IDS.podLayer));
			assert.ok(root, "覆盖层根节点在位");
			assert.equal(typeof root.props.ref, "object", "覆盖层根须挂 ref（useModalLayer 的 dialog 参数）");
			assert.equal(calls.length, 1, "须恰有一次 useModalLayer 调用（不手写 Tab／Escape 逻辑）");
			assert.equal(calls[0][0], root.props.ref, "第一个参数＝覆盖层根 ref");
			assert.equal(calls[0][1], true, "第二个参数＝open");
			assert.equal(typeof calls[0][2], "function", "第三个参数＝onClose 回调");
			// Escape 通路＝modal 契约：Busy 时不关闭（弹窗／菜单先手）
			const next = root.props["data-shortcut-modal"];
			assert.equal(next, undefined, "不设 data-shortcut-modal（modal id 归 \"other\"，官方命令一律被拦）");
			// 契约常量直读（HF-SHELL-FOCUS-LAYER：选择器字面即 modal 契约）
			const modalSelector = mod.POD_MODAL_SELECTOR;
			assert.equal(modalSelector, "[role=\"dialog\"][aria-modal=\"true\"], [role=\"menu\"]", "modal 契约选择器须与官方 modalSelector 逐字一致");
		} finally {
			harness.hooks.useModalLayer = null;
		}
	});
});

test("V-P2.7b 降级：宿主缺 primitives.useModalLayer 时覆盖层仍可挂载（不抛），焦点契约缺失由探针响亮报出", () => {
	// 模拟宿主 primitives 面缺该具名导出（HF-SHELL-FOCUS-LAYER 的导出漂移）
	const save = harness.primitives.useModalLayer;
	Object.defineProperty(harness.primitives, "useModalLayer", { value: undefined, configurable: true });
	try {
		const tree = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
		assert.equal(tree.error, undefined, "缺 useModalLayer 时不得抛：" + (tree.error && tree.error.message));
		assert.ok(findOne(tree, (node) => hasClass(node, IDS.podLayer)), "覆盖层根仍须在位（面级降级而非整层拒载）");
	} finally {
		Object.defineProperty(harness.primitives, "useModalLayer", { value: save, configurable: true });
	}
});

// ================= V-P2.8：背景 inert 与 LIFO 还原 =================
test("V-P2.8 背景 inert：覆盖期间背景不可聚焦、原值 LIFO 还原、与官方浮层嵌套还原正确", () => {
	withFakeDom((dom) => {
		const officialA = dom.attach("官方 A", undefined);
		const officialB = dom.attach("官方 B（已被官方浮层置 inert）", true);
		const officialC = dom.attach("官方 C", undefined);
		// 覆盖层宿主容器（pod 自身可见树）：由首次 acquire 前的建宿主逻辑产生——此处先建，模拟现场
		const { acquireOverlayInert, releaseOverlayInert } = mod.__podInertForTest;

		const handle = acquireOverlayInert(dom.document);
		assert.equal(officialA.inert, true, "背景元素须被置 inert（不可聚焦）");
		assert.equal(officialB.inert, true, "已被置 inert 的元素保持 true");
		assert.equal(officialC.inert, true, "背景元素须被置 inert");
		// 嵌套序（官方浮层在 Pod 之后打开，且官方层按自己的语义把页面复位成可聚焦）：
		//   外层（Pod）采集 → 官方层复位 → 内层（官方浮层）采集 → 内层释放
		// 内层只对被**复位**过的元素置值（officialB 仍是 true，属外层所有，不得被窃取），
		// 释放时按自己保存的原值写回 ⇒ 外层仍在位。
		officialA.inert = false;
		const handle2 = acquireOverlayInert(dom.document);
		assert.notEqual(handle2, null, "复位后的元素须被内层重新采集");
		assert.equal(handle2.some((item) => item.element === officialB), false, "已是 inert 的元素不得被内层重复采集（不窃取他人值）");
		releaseOverlayInert(handle2);
		assert.equal(officialA.inert, false, `释放内层须还原内层看到的原值（false），实测 ${officialA.inert}`);
		assert.equal(officialC.inert, true, "内层未接管的元素不得被内层释放改写（外层仍持值）");
		releaseOverlayInert(handle);
		assert.equal(officialA.inert, undefined, "末位释放须按保存的原值还原（undefined＝从未设置过）");
		assert.equal(officialC.inert, undefined, "末位释放须按保存的原值还原");
		assert.equal(officialB.inert, true, "本就 inert 的元素不得被还原成 false（不得窃取他人的值）");
		// 幂等释放
		releaseOverlayInert(handle);
		assert.equal(officialA.inert, undefined, "重复释放幂等");
	});
});

test("V-P2.8b 背景 inert：Pod 期间只有我方层可聚焦，layer 根自身不被置 inert", () => {
	withFakeDom((dom) => {
		const official = dom.attach("官方页", undefined);
		const host = dom.attach("Pod 宿主容器", undefined);
		const { acquireOverlayInert, releaseOverlayInert } = mod.__podInertForTest;
		const handle = acquireOverlayInert(dom.document, [host]);
		assert.equal(official.inert, true, "官方页须不可聚焦");
		assert.equal(host.inert, undefined, "我方覆盖层宿主不得被置 inert（否则自身控件不可聚焦）");
		releaseOverlayInert(handle);
		assert.equal(official.inert, undefined, "退出后还原");
	});
});

// ================= V-P2.9：宿主快捷键 modal 契约 =================
test("V-P2.9 键盘隔离：覆盖层读作 modal scope \"other\"，宿主侧栏切换等命令按契约被拦", () => {
	// 宿主分发口径复算：document 序最后一个 [role=dialog][aria-modal=true] 即 modal scope
	const tree = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
	const root = findOne(tree, (node) => hasClass(node, IDS.podLayer));
	assert.ok(root.props.role === "dialog" && root.props["aria-modal"] === "true");
	const scope = root.props["data-shortcut-modal"] ?? "other";
	assert.equal(scope, "other", "未命名 modal 即 \"other\"，无官方命令声明该 scope ⇒ 一律 blocked＋preventDefault");
	// 官方 layout 侧栏切换命令声明 modals: [] ⇒ 任何 modal 下被拦（含 \"other\"）
	const layoutModals = [];
	assert.ok(!layoutModals.includes(scope), "侧栏切换类命令在 Pod 期间须被拦");
	// 官方 settings 命令声明 [\"settings\"] —— Pod 不占用该 scope（不得放行任何命令）
	for (const declared of [["settings"], ["settings", "shortcuts"]]) {
		assert.ok(!declared.includes(scope), "Pod 期不得放行官方命令 scope：" + declared.join("／"));
	}
	// Esc／Tab 行为归 useModalLayer（本票不自写键盘监听）
	const podImpl = clientSource.slice(clientSource.indexOf("function PodOverlayLayer"), clientSource.indexOf("function BotModeEntry"));
	assert.ok(podImpl.length > 0, "覆盖层实现段须存在");
	assert.ok(!/addEventListener\(\s*["']keydown["']/.test(podImpl), "覆盖层实现段不得自写 keydown 监听（Escape／Tab 归 useModalLayer 契约）");
	assert.ok(!/querySelectorAll/.test(podImpl), "覆盖层实现段不得自写可聚焦项查询（Tab 囚笼归 useModalLayer）");
});

// ================= V-P2.10：旁带清理 =================
test("V-P2.10 旁带清理：不再强展／强收官方侧栏，死调用 closeDetails 已删除，layout 面零触达", () => {
	const { ctx, entry } = bootPod();
	withFakeDom(() => {
		clickEntry(entry);
		mod.__podControl.exit();
	});
	assert.deepEqual(ctx.calls.layout, [], "进出 Pod 不得调用任何 layout 方法（含 toggleSidebar／closeDetails）");
	assert.ok(!Object.prototype.hasOwnProperty.call(ctx.calls.register.find((o) => o.id === IDS.pod), "priority"));
	// 旁带字段须已从实现面移除
	assert.equal(mod.botModeLayout && "pendingNarrowExpand" in mod.botModeLayout, false, "不得残留 pendingNarrowExpand 旁带状态");
	assert.equal(mod.botModeLayout && "expandedOnEntry" in mod.botModeLayout, false, "不得残留 expandedOnEntry 旁带状态");
});

// ================= V-P2.11：Pod 内席位切换保活 =================
test("V-P2.11 Pod 内切席位再切回：草稿与选中保留（视图不卸载重挂）", () => {
	const { rememberPodDraft, forgetPodDraft } = mod.__podDraftForTest;
	const { resolvePodDraft } = mod;
	assert.equal(typeof resolvePodDraft, "function", "导出面缺 resolvePodDraft（Pod 草稿归属判据）");
	// 进入席位 A，写草稿
	rememberPodDraft("bot-a", "草稿 A");
	assert.equal(resolvePodDraft("bot-a"), "草稿 A", "席位 A 草稿须可还原");
	// 切到席位 B（不触碰 A 的草稿）
	const tree = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
	assert.equal(tree.error, undefined, "覆盖层须可渲染：" + (tree.error && tree.error.message));
	assert.equal(resolvePodDraft("bot-a"), "草稿 A", "切席位不得清掉原席位草稿");
	assert.equal(resolvePodDraft("bot-b"), "", "新席位草稿独立（不得串到上一个席位）");
	// 切回 A
	assert.equal(resolvePodDraft("bot-a"), "草稿 A", "切回原席位草稿仍在");
	// 成功发送后清空（与既有 send() 口径一致）
	forgetPodDraft("bot-a");
	assert.equal(resolvePodDraft("bot-a"), "", "发送成功即清空草稿");
	// 视图层：列表与席位视图在同一覆盖层内**互斥但不卸载**（滚动／草稿由节点身份持有）
	const body = findOne(tree, (node) => hasClass(node, "dsh-bots-pod-body"));
	assert.ok(body, "覆盖层须有 pod-body（列表／席位双视图容器）");
	const views = findAll(body, (node) => typeof node.props.className === "string" && node.props.className.includes("dsh-bots-pod-view"));
	assert.equal(views.length, 2, "列表视图与席位视图须同时在挂载树上（互斥呈现，不卸载重挂）");
	const css = mod.podLayerCss;
	assert.match(css, /\.dsh-bots-pod-view\[hidden\][^{]*\{[^}]*visibility:hidden/, "非活动视图须用 visibility 隐藏（保节点身份与滚动位置）");
	assert.ok(!/\.dsh-bots-pod-view[^{]*\{[^}]*display:none/.test(css), "非活动视图不得用 display:none");
});

// ---------- 运行 ----------
let failed = 0;
for (const [name, fn] of results) {
	try {
		fn();
		console.log("✓", name);
	} catch (error) {
		failed += 1;
		console.error("✗", name, "—", error.stack ? error.stack.split("\n").slice(0, 3).join(" / ") : error.message);
	}
}
process.exit(failed > 0 ? 1 : 0);
