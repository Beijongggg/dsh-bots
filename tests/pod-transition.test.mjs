/**
 * 回归：Pod 过渡动效（pod 05 号票 [[05-pod-transition-motion]]，规格附录 A `V-P3.1…V-P3.6`）。
 *
 * 被测面＝`lib/client.js` 的**过渡语言**：进出 Pod 的淡入＋约 4px 上浮、范围差分
 * （进出＝层整体：侧栏＋主区同一过渡；Pod 内切席位＝只过渡主区）、`prefers-reduced-motion`
 * 退化、过渡期首帧不空、令牌化与常量回退。四类坐标：
 *   - 过渡令牌面＝票 02 登记面 `HF-HOST-TRANSITION-TOKENS`（探针 `P-HOST-TRANSITION-TOKENS`，
 *     常量 `HOST_TRANSITION_TOKENS`）——令牌名与探针清单**双向绑定**，漂移即红；
 *   - 整屏层几何／层叠面＝票 02 登记面 `HF-SHELL-OVERLAY-GEOMETRY`（`P-SHELL-OVERLAY-GEOMETRY`）；
 *   - 保活前提＝票 04 的覆盖式常驻结构（`PodOverlayLayer`／`POD_LAYER_CLASSES`／`podLayerCss`，
 *     官方页全程挂载、双视图互斥不卸载）——本票只在其上追加动效，不改结构；
 *   - 负例面＝不得 `display:none`／`hidden` 隐藏、不得引入宿主私有样式钩子（宿主**没有**
 *     `--dsw-*` 动效令牌，见票 02 面登记）。
 *
 * 无 React 运行时／无 jsdom：组件树经**迷你渲染器**（与 tests/pod-overlay.test.mjs 同口径）
 * 渲成 `createElement` 同形普通对象；计时器由**可驱动钟**（`withTimers`）接管，故
 * 「过渡开始 → 结束」是可执行序列而不是时序赌博。真机目视（无白屏帧、无布局跳动、
 * 真浏览器里的 `inert` 与 portal 几何）归 11 号票人工清单。
 */
import assert from "node:assert/strict";

import { HOST_TRANSITION_TOKENS } from "../scripts/host-contract-probe.mjs";

// ---------- 装载：捕获型 loader（官方 client bundle 装载协议同形） ----------
let captured = null;
globalThis.window = {
	innerWidth: 1400,
	// 覆盖层内真件（`BotSidebar`／`BotMain`）的挂载效应会排轮询计时器——无头域里给形状桩
	setInterval: () => 0,
	clearInterval: () => {},
	__ModuleLoader__: {
		load: (opts) => { captured = opts; }
	}
};
globalThis.EventSource = class { constructor() {} addEventListener() {} removeEventListener() {} close() {} };

await import("../lib/client.js");

assert.ok(captured && typeof captured.factory === "function", "lib/client.js 须走 __ModuleLoader__.load 装载协议");

/** 仓库真实 client 源文本（负例扫描的载体，与装载无关）。 */
const clientSource = await (await import("node:fs/promises"))
	.readFile(new URL("../lib/client.js", import.meta.url), "utf8");

const LAYER = "pod-pod-layer";
const SHELL = "pod-pod-shell";
const SEAT_LIST = "pod-pod-seat-list";
const SEAT_DETAIL = "pod-pod-seat-detail";

// ---------- 迷你 React：hooks 桩（可注入 spy）＋组件树展开 ----------
function createHarness() {
	const hooks = {
		useState: [], useStateCursor: 0, useRef: [], useRefCursor: 0, useMemo: [], useId: [], useSyncExternalStore: [],
		useLayoutEffect: [], useEffect: [], effectDeps: [], useModalLayer: null, createPortal: null
	};
	const sameDeps = (previous, next) =>
		previous !== undefined && Array.isArray(previous) && Array.isArray(next)
		&& previous.length === next.length
		&& previous.every((value, index) => Object.is(value, next[index]));
	const h = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) });
	const react = {
		createElement: h,
		memo: (component) => component,
		Fragment: Symbol("Fragment"),
		// 有状态迷你渲染器：`useState` 按调用序读回「上一轮渲染留下的值」，组件内 setState
		// 因此像真 React 一样驱动一次重渲——「过渡标记出现在下一帧」这类时序可复算，不被夹具抹平。
		useState(initial) {
			const slot = hooks.useStateCursor;
			if (hooks.useState.length <= slot) {
				hooks.useState.push(typeof initial === "function" ? initial() : initial);
			}
			const current = hooks.useState[slot];
			hooks.useStateCursor += 1;
			return [current, (next) => { hooks.useState[slot] = typeof next === "function" ? next(current) : next; }];
		},
		// `useRef` 在真 React 里跨渲染保持**同一对象**；桩若每轮新建，"已过首帧" 一类
		// 渲染期可读的实例态就会被抹平（本票的视图标记 gate 正靠它）。
		useRef(initial) {
			const slot = hooks.useRefCursor;
			if (hooks.useRef.length <= slot) hooks.useRef.push({ current: initial });
			hooks.useRefCursor += 1;
			return hooks.useRef[slot];
		},
		useMemo(fn) { hooks.useMemo.push(fn); return fn(); },
		// 效应按**依赖数组**判重（与真 React 同口径：依赖不变则重渲不重跑），
		// 否则「依赖 key 才重放」的过渡状态机会在夹具里变成每轮重跑的假循环。
		useEffect(fn, deps) {
			const slot = hooks.useEffect.length;
			const previous = hooks.effectDeps[slot];
			hooks.useEffect.push({ fn, deps, stale: !sameDeps(previous, deps) });
			hooks.effectDeps[slot] = deps;
		},
		useLayoutEffect(fn) { hooks.useLayoutEffect.push(fn); },
		useId() { hooks.useId.push(null); return "pod-transition-test-" + hooks.useId.length; },
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
	/** `loadModule(extra)`：extra 里的**函数**按组件替身注入（`BotMain` 等重件）。 */
	const loadModule = (extra = {}) => captured.factory((id) => {
		if (id === "react") return react;
		if (id === "react-dom") return { createPortal: (children) => children };
		if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		if (id in extra) return extra[id];
		throw new Error("unexpected require: " + id);
	});
	const expand = (node) => {
		if (node === null || node === undefined || typeof node === "boolean") return null;
		if (Array.isArray(node)) return node.map(expand).filter((child) => child !== null);
		if (typeof node !== "object") return node;
		if (typeof node.type === "function") return expand(node.type(node.props ?? {}));
		return { type: node.type, props: node.props ?? {}, children: (node.children ?? []).map(expand).filter((child) => child !== null) };
	};
	/** 提交期把宿主节点挂上 `ref.current`（真 React 的 ref 赋值语义；过渡状态机经此前门取元素）。 */
	const assignRefs = (node) => {
		if (node === null || typeof node !== "object") return;
		if (node.props && node.props.ref && typeof node.props.ref === "object") node.props.ref.current = node;
		for (const child of node.children || []) assignRefs(child);
	};
	/** 挂载重置：状态槽与依赖账清空（新实例）。 */
	const resetMount = () => {
		hooks.useState.length = 0;
		hooks.useRef.length = 0;
		hooks.effectDeps.length = 0;
	};
	/** 一趟渲染＋提交＋收敛（调用方决定是否先 resetMount）。 */
	const runRender = (component, props, maxIterations) => {
		let tree = null;
		for (let iteration = 0; iteration < maxIterations; iteration += 1) {
			hooks.useStateCursor = 0;
			hooks.useRefCursor = 0;
			hooks.useEffect.length = 0;
			try { tree = expand(h(component, props)); } catch (error) { return { error }; }
			// 提交期先赋 ref 再跑效应（真 React 顺序）——过渡状态机在效应里读 `ref.current`
			assignRefs(tree);
			if (hooks.refTarget) {
				for (const node of findAll(tree, (item) => item.props && item.props.ref && typeof item.props.ref === "object")) {
					node.props.ref.current = hooks.refTarget;
				}
			}
			let dirtied = false;
			const effects = hooks.useEffect.slice();
			for (const effect of effects) {
				if (!effect.stale) continue;
				const before = hooks.useState.slice();
				effect.fn();
				if (hooks.useState.some((value, index) => value !== before[index])) dirtied = true;
			}
			if (!dirtied) {
				if (iteration === maxIterations - 1) throw new Error("迷你渲染器未收敛（setState 循环）");
				break;
			}
		}
		return tree;
	};
	return {
		hooks, react, primitives, loadModule,
		/** 让 ref.current 指向跨渲染稳定的宿主对象（真 React 语义：ref 指向存活的 DOM 节点）。 */
		setRefTarget(target) { hooks.refTarget = target; },
		/**
		 * 渲染＋提交（真 React 的最小心智模型）：
		 * 1. 渲成树；2. 跑本轮「依赖变了」的效应（提交）；3. 效应若 setState（本票的过渡
		 *    状态机就会）则重渲一轮——直到收敛（默认 10 轮，不收敛即抛，避免夹具掩盖真死循环）。
		 */
		render(component, props, { maxIterations = 10 } = {}) {
			// 每次 render() 调用＝一次新挂载：状态与依赖账清空（否则上一个夹具的 deps 会让
			// 本夹具的效应恒判为「不 stale」而永不运行）。
			resetMount();
			return runRender(component, props, maxIterations);
		},
		/** 同一实例内的重渲（不重置状态／依赖账）——席位切换、计时器推进后的下一帧。 */
		rerender(component, props, { maxIterations = 10 } = {}) {
			return runRender(component, props, maxIterations);
		},
	};
}

const harness = createHarness();
const mod = harness.loadModule();

// ---------- 可驱动钟（接管 window.setTimeout/clearTimeout；短暂替换后恢复） ----------
function withTimers(fn) {
	const previousSet = globalThis.window.setTimeout;
	const previousClear = globalThis.window.clearTimeout;
	const pending = new Map();
	let seq = 0;
	globalThis.window.setTimeout = (callback) => { seq += 1; pending.set(seq, callback); return seq; };
	globalThis.window.clearTimeout = (id) => { pending.delete(id); };
	try {
		return fn({
			pending,
			/** 跑掉当前全部待办（快照语义：回调内新排的下一轮留给下次调用）。 */
			flush() {
				const batch = [...pending.entries()];
				pending.clear();
				for (const [, callback] of batch) callback();
			}
		});
	} finally {
		globalThis.window.setTimeout = previousSet;
		globalThis.window.clearTimeout = previousClear;
		mod.resetPodTransitions();
	}
}

/**
 * 用给定的 media 判定临时替换 `window.matchMedia`（**只换这一个属性**——整体替换 `window`
 * 会连计时器桩一起丢掉，本票的过渡状态机正是走 `window.setTimeout`）。
 */
function withMatchMedia(matches, fn) {
	const previous = globalThis.window.matchMedia;
	const hadPrevious = "matchMedia" in globalThis.window;
	globalThis.window.matchMedia = () => ({ matches, addEventListener() {}, removeEventListener() {} });
	try { return fn(); } finally {
		if (hadPrevious) globalThis.window.matchMedia = previous;
		else delete globalThis.window.matchMedia;
	}
}

// ---------- 最小假 DOM（真 04 回归夹具的过渡子集：真实节点身份＋inert 可观测） ----------
function withFakeDom(fn) {
	const previousDocument = globalThis.document;
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
	globalThis.document = document;
	try { return fn({ document, body }); } finally { globalThis.document = previousDocument; mod.resetPodTransitions(); }
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
/** 切席位标记是「前缀 + 换代序号」，故按前缀判在场。 */
const hasClassPrefix = (node, prefix) =>
	!!node && typeof node.props.className === "string"
	&& node.props.className.split(/\s+/).some((name) => name.startsWith(prefix + "-"));
const byClass = (tree, cls) => findOne(tree, (node) => hasClass(node, cls));

/** 覆盖层根（`pod-pod-layer`）上的 `data-state`。 */
const layerStateOf = (tree) => {
	const root = byClass(tree, LAYER);
	return root && root.props["data-state"];
};

/**
 * 覆盖层夹具：把 `PodOverlayLayer` 渲成树并提供 `select(botId)`（改选席位重渲）。
 * `BotMain` 走替身（本票断言的是**视图容器**的过渡标记，不是席位内容行），
 * 其余结构件（`BotSidebar` 等）走真件。
 */
function createLayerFixture() {
	const overrides = { BotMain: () => harness.h("div", { className: "pod-main-root" }, null) };
	const isolated = harness.loadModule(overrides);
	const state = {
		bots: [], messages: {}, selectedBotId: null, selectionInit: true,
		toast: null, editing: null, deleting: null, riskPending: false, busy: null,
		status: "open", error: null, showDetails: false, loadError: null
	};
	// 宿主元素（portal 层根）跨渲染**同一个节点**：真 React 里 ref 指向的就是这样的 DOM 节点，
	// 而迷你渲染器的树节点每轮重建——故把 ref 钉在这个稳定元素上，过渡状态机写的就是它。
	const layerElement = createTransitionElement();
	const renderTree = (mount) => {
		// 每次重渲给出**新的 props 对象**（React 语义）；`props.s` 是本票的状态测试缝
		// （真宿主里该件走模块级 store），故夹具能直接驱动「切席位」而不必假造 fetch／SSE。
		const props = { t: (key) => key, open: true, s: { ...state } };
		harness.setRefTarget(layerElement);
		const tree = mount
			? harness.render(isolated.PodOverlayLayer, props)
			: harness.rerender(isolated.PodOverlayLayer, props);
		assert.equal(tree.error, undefined, "覆盖层须可渲染：" + (tree.error && tree.error.message));
		return tree;
	};
	return {
		state,
		layerElement,
		/** 隔离模块的 Pod 旁带（渲染派生 `podLayout.exiting` 的驱动面；pod 05 返修）。 */
		podLayout: isolated.__podLayoutForTest,
		/** 挂载（新实例：状态与依赖账清空）。 */
		render: () => renderTree(true),
		/** 同一实例内重渲一帧（计时器推进后观察 React 下一帧；不重渲则读到上一帧渲染结果）。 */
		rerender: () => renderTree(false),
		select(botId) { state.selectedBotId = botId; return renderTree(false); }
	};
}

/** 过渡样式块（`podLayerCss` 里 BEGIN/END 标记之间；可寻址、可扫描）。 */
function transitionCss() {
	assert.equal(typeof mod.podLayerCss, "string", "导出面缺 podLayerCss");
	const begin = mod.podLayerCss.indexOf(mod.POD_TRANSITION_STYLE_BEGIN);
	const end = mod.podLayerCss.indexOf(mod.POD_TRANSITION_STYLE_END);
	assert.ok(begin >= 0 && end > begin, "过渡样式块须由 BEGIN/END 标记围出（可寻址、可扫描）");
	return mod.podLayerCss.slice(begin, end);
}

/** 假元素（过渡状态机只经 dataset 与元素身份对话）。 */
function createTransitionElement() {
	return {
		dataset: {},
		setAttribute(name, value) { this.dataset[name.replace(/^data-/, "")] = value; },
		getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.dataset, name.replace(/^data-/, "")) ? this.dataset[name.replace(/^data-/, "")] : null; },
		removeAttribute(name) { delete this.dataset[name.replace(/^data-/, "")]; }
	};
}

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ================= V-P3.1：进出形态 =================
test("V-P3.1 进出：淡入＋约 4px 上浮、约 200ms、无方向位移", () => {
	const TRANSITION = mod.POD_TRANSITION;
	assert.equal(typeof TRANSITION, "object", "导出面缺 POD_TRANSITION（过渡参数单一坐标块）");
	assert.equal(Object.isFrozen(TRANSITION), true, "POD_TRANSITION 须冻结（禁就地改写）");
	assert.equal(TRANSITION.distancePx, 4, "上浮距离须为约 4px");
	assert.equal(TRANSITION.fallbackDurationMs, 200, "回退时长须为约 200ms");
	assert.equal(TRANSITION.fallbackDuration, "0.2s", "时长常量回退须与毫秒常量同源（200ms → 0.2s）");

	const TRANSITION_CSS = mod.POD_TRANSITION_CSS;
	assert.equal(typeof TRANSITION_CSS.enterKeyframes, "string", "缺进出关键帧名（坐标块）");
	assert.equal(typeof TRANSITION_CSS.viewKeyframes, "string", "缺切席位关键帧名（坐标块）");
	assert.equal(typeof TRANSITION_CSS.exitKeyframes, "string", "缺出场关键帧名（坐标块；pod 05 返修 2026-10-10 补「进出」的出半边）");
	const css = transitionCss();
	const enterBlock = css.match(/\.pod-pod-layer\[data-state="?entering"?\][^{]*\{[^}]*\}/);
	assert.ok(enterBlock, "进出过渡须由 [data-state=entering] 钩子承载（层整体＝侧栏＋主区同一过渡）");
	assert.match(enterBlock[0], /var\(--ds-transition-duration\s*,/, "动画时长须取宿主令牌 --ds-transition-duration（宿主令牌＋常量回退，不硬编码孤立数值）");
	assert.match(enterBlock[0], /var\(--ds-ease-in-out\s*,/, "缓动须取宿主令牌 --ds-ease-in-out（宿主令牌＋常量回退）");
	for (const name of [TRANSITION_CSS.enterKeyframes, TRANSITION_CSS.viewKeyframes]) {
		const at = css.indexOf("@keyframes " + name);
		assert.ok(at >= 0, "缺关键帧 " + name);
		const block = css.slice(at + ("@keyframes " + name).length);
		assert.match(block, /^\{from\s*\{[^}]*opacity:0/, name + " 须从 opacity:0 淡入");
		assert.match(block, /^\{from\s*\{[^}]*translateY\(4px\)/, name + " 须从 +4px 上浮到原位（距离由坐标块插值）");
		assert.match(block, /to\s*\{[^}]*opacity:1/, name + " 须收到 opacity:1");
		assert.match(block, /to\s*\{[^}]*translateY\(0\)/, name + " 须收到原位（translateY(0)）");
	}
	// 出场侧（pod 05 返修 2026-10-10）：exiting 态＝进场同参数的镜像淡出（0 → +4px 回落）
	const exitBlock = css.match(/\.pod-pod-layer\[data-state="?exiting"?\][^{]*\{[^}]*\}/);
	assert.ok(exitBlock, "出场过渡须由 [data-state=exiting] 钩子承载（层整体＝侧栏＋主区同一过渡）");
	assert.match(exitBlock[0], new RegExp("animation:[^;]*" + TRANSITION_CSS.exitKeyframes), "出场动画须走出场关键帧");
	assert.match(exitBlock[0], /var\(--ds-transition-duration\s*,/, "出场时长同取宿主令牌（进出同参数）");
	assert.match(exitBlock[0], /var\(--ds-ease-in-out\s*,/, "出场缓动同取宿主令牌");
	const exitAt = css.indexOf("@keyframes " + TRANSITION_CSS.exitKeyframes);
	assert.ok(exitAt >= 0, "缺出场关键帧 " + TRANSITION_CSS.exitKeyframes);
	const exitFrames = css.slice(exitAt + ("@keyframes " + TRANSITION_CSS.exitKeyframes).length);
	assert.match(exitFrames, /^\{from\s*\{[^}]*opacity:1/, "出场须自不透明起（衔接 shown 稳态，不闪）");
	assert.match(exitFrames, /^\{from\s*\{[^}]*translateY\(0\)/, "出场须自原位起");
	assert.match(exitFrames, /to\s*\{[^}]*opacity:0/, "出场须收到 opacity:0（淡出）");
	assert.match(exitFrames, /to\s*\{[^}]*translateY\(4px\)/, "出场须落 +4px（进场镜像回落；位移仍只允许 0 与 +4px）");
	const reduceMedia = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
	assert.match(reduceMedia[1], /\[data-state="?exiting"?\][^{]*\{[^}]*animation:\s*none/, "reduce 下出场动画须关掉（瞬时撤层）");
	// 无方向位移：水平位移／缩放一律不得出现，且上浮只走正 Y 位移
	assert.ok(!/translateX|scale\(|scale3d|rotate\(/.test(css), "不得出现方向位移或缩放（规格 §C1「不做方向位移」）");
	const translateYs = [...css.matchAll(/translateY\((-?[\d.]+)(?:px)?\)/g)].map((match) => Number(match[1]));
	assert.ok(translateYs.length >= 2, "须有 translateY 关键帧");
	assert.deepEqual([...new Set(translateYs)].sort((a, b) => a - b), [0, 4], "位移只允许 0 与 +4px（上浮），符号不得反");
	// 200ms 的落地：回退时长即令牌基准档（宿主实测 .2s ≈ 规格的「约 200ms」）
	assert.equal(TRANSITION.durationToken, "--ds-transition-duration");
	assert.equal(TRANSITION.easingToken, "--ds-ease-in-out");
	assert.equal(mod.podTransitionTokenRows()[0].name, TRANSITION.durationToken);
	assert.equal(mod.podTransitionTokenRows()[0].fallback, TRANSITION.fallbackDuration, "基准档回退＝坐标块时长（单一数值来源）");
});

// ================= V-P3.2：令牌与常量回退 =================
test("V-P3.2 时长／缓动取 --ds-transition-duration(-fast/-slow)＋--ds-ease-in-out 并带常量回退（面 HF-HOST-TRANSITION-TOKENS）", () => {
	const TRANSITION = mod.POD_TRANSITION;
	assert.equal(Object.isFrozen(TRANSITION), true, "POD_TRANSITION 须冻结（禁就地改写）");
	const tokenTrees = mod.POD_TRANSITION_TOKENS;
	assert.equal(Object.isFrozen(tokenTrees), true, "令牌注册表须冻结（禁就地改写）");
	const tokenRows = mod.podTransitionTokenRows();
	assert.deepEqual(
		tokenRows.map((token) => token.name),
		HOST_TRANSITION_TOKENS.map((token) => token.name),
		"令牌名须与票 02 探针 P-HOST-TRANSITION-TOKENS 的清单逐名一致（面 HF-HOST-TRANSITION-TOKENS）"
	);
	assert.deepEqual(
		tokenRows.map((token) => token.kind),
		HOST_TRANSITION_TOKENS.map((token) => token.kind),
		"令牌种类（时长／缓动）须与探针登记一致"
	);
	// 令牌消费形态（复核 M9 统一口径）：宿主同名令牌**只以 var(<宿主令牌>, <常量回退>) 读取**，
	// 本层任何作用域都不得重声明它们（本地重声明会遮蔽宿主值、使宿主令牌替换失效）。
	assert.deepEqual(
		[...mod.podLayerCss.matchAll(/(--ds-transition-duration(?:-fast|-slow)?|--ds-ease-in-out)\s*:/g)].map((match) => match[1]),
		[],
		"覆盖层样式不得重声明宿主过渡令牌（常量只作 var() 第二参数）"
	);
	for (const row of tokenRows) {
		assert.equal(
			mod.podTokenVar(row.name),
			`var(${row.name}, ${row.fallback})`,
			"var() 形态须由 podTokenVar 唯一生成（宿主令牌＋常量回退）：" + row.name
		);
	}
	const css = transitionCss();
	assert.match(css, /var\(--ds-transition-duration-fast\s*,/, "fast 档须被真实消费（可寻址）");
	assert.match(css, /var\(--ds-transition-duration\s*,/, "基准档须被真实消费");
	assert.match(css, /var\(--ds-transition-duration-slow\s*,/, "slow 档须被真实消费（进出结束→shown 的收口）");
	assert.match(css, /var\(--ds-ease-in-out\s*,/, "缓动令牌须被真实消费");
	// 状态机三态（层根 data-state 的取值面）
	assert.equal(mod.POD_TRANSITION_STATES.entering, "entering");
	assert.equal(mod.POD_TRANSITION_STATES.shown, "shown");
	assert.equal(mod.POD_TRANSITION_STATES.exiting, "exiting");
});

// ================= V-P3.3：范围差分 =================
test("V-P3.3 范围差分：进出时侧栏与主区同一过渡；Pod 内切席位只过渡主区", () => {
	const css = transitionCss();
	const layerRule = css.match(/\.pod-pod-layer\[data-state="?entering"?\][^{]*\{[^}]*\}/);
	assert.ok(layerRule, "进出过渡须声明在**层根**上（侧栏＋主区同一过渡：一次声明、同一时长）");
	assert.match(layerRule[0], /animation:[^;]*pod-pod-enter/, "层根走进出关键帧");
	for (const cls of [SHELL, SEAT_LIST]) {
		assert.ok(
			!new RegExp("\\." + cls + "[ \\t]*\\{[^}]*animation").test(css),
			"进出过渡不得按列各自声明（" + cls + " 不得自带 animation）"
		);
		assert.ok(
			!new RegExp("\\." + cls + "[ \\t]*\\{[^}]*transition").test(css),
			"进出过渡不得按列各自声明 transition（同一过渡的唯一声明处＝层根）"
		);
	}

	withTimers(() => {
		withFakeDom(() => {
			const fixture = createLayerFixture();
			const first = fixture.render();
			assert.equal(layerStateOf(first), mod.POD_TRANSITION_STATES.entering, "进出过渡＝层整体（层根带 entering 态）");
			assert.equal(hasClass(byClass(first, LAYER), mod.POD_TRANSITION.enterMarker), true, "进出态须带层过渡标记（侧栏与主区共用）");
			const listAtEnter = byClass(first, SEAT_LIST);
			assert.ok(listAtEnter, "覆盖层须有席位列表列（进出过渡的作用域＝层整体）");
			assert.equal(hasClass(listAtEnter, mod.POD_TRANSITION.enterMarker), false, "侧栏列不得各自打标记（同一过渡，不差分）");
			assert.equal(hasClassPrefix(listAtEnter, mod.POD_TRANSITION.viewMarker), false, "切席位过渡不得落到侧栏列上");
			const detailAtEnter = byClass(first, SEAT_DETAIL).props.className;
			assert.equal(
				byClass(fixture.render(), SEAT_DETAIL).props.className,
				detailAtEnter,
				"同一状态重渲不得换代（标记只在席位换代时换代，进出过渡不重放切席位动画）"
			);
			assert.equal(
				hasClassPrefix(byClass(fixture.render(), SEAT_LIST), mod.POD_TRANSITION.viewMarker),
				false,
				"任何一帧都不得给侧栏列打切席位标记（范围差分的另一半）"
			);
			// Pod 内切席位：只主区（席位视图）打标记，侧栏列不动（进出过渡的一次性已由
			// V-P3.5 用同一状态机复算：计时推进后层根落 shown）
			const second = fixture.select("bot-a");
			const detail = byClass(second, SEAT_DETAIL);
			const list = byClass(second, SEAT_LIST);
			assert.equal(hasClassPrefix(detail, mod.POD_TRANSITION.viewMarker), true, "切席位须给主区（席位视图）打过渡标记");
			assert.match(String(detail.props.className), new RegExp("pod-pod-view-in-[0-9]+"), "切席位标记须带换代序号（同一动画可重放）");
			assert.equal(hasClassPrefix(list, mod.POD_TRANSITION.viewMarker), false, "切席位不得给侧栏列打标记（范围差分）");
			assert.equal(hasClass(byClass(second, LAYER), mod.POD_TRANSITION.enterMarker), true, "层根标记是进出期常驻钩子，不随切席位移除");
			const third = fixture.select("bot-b");
			assert.notEqual(
				byClass(third, SEAT_DETAIL).props.className,
				detail.props.className,
				"再次切席位须换代（标记变化才会重放动画）"
			);
			assert.equal(hasClassPrefix(byClass(third, SEAT_LIST), mod.POD_TRANSITION.viewMarker), false, "多次切席位仍不得触碰侧栏列");
			// 切席位过渡的动效声明只挂主区标记类（侧栏列不是该类的成员）
			assert.ok(
				!new RegExp("\\." + SEAT_LIST + "[ \\t]*\\{[^}]*animation").test(css),
				"切席位动画不得声明在侧栏列上"
			);
			assert.ok(
				css.includes("." + mod.POD_TRANSITION.viewMarker + "-"),
				"切席位动画须由换代标记类前缀承载（实例名可寻址）"
			);
		});
	});
});

// ================= V-P3.4：reduced-motion 退化 =================
test("V-P3.4 prefers-reduced-motion: reduce 退化为瞬时切换", () => {
	const css = transitionCss();
	const media = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
	assert.ok(media, "过渡样式块须有 prefers-reduced-motion: reduce 分支");
	assert.match(media[1], /animation:\s*none/, "退化须关掉动画");
	assert.match(media[1], /transition:\s*none/, "退化须关掉过渡");

	withMatchMedia(true, () => {
		assert.equal(mod.resolvePodTransitionDuration(), 0, "reduce 下过渡时长须为 0（瞬时切换）");
		assert.equal(mod.podViewTransitionClass(3, true), mod.POD_TRANSITION.instantMarker, "reduce 下切席位改走瞬时档（无动画标记）");
		const element = createTransitionElement();
		const seen = [];
		withTimers((timers) => {
			mod.applyPodTransition(element, { kind: "layer", onState: (state) => seen.push(state) });
			assert.deepEqual(seen, [mod.POD_TRANSITION_STATES.shown], "reduce 下须同帧落到 shown（不进 entering 状态机）");
			assert.equal(element.dataset.state, mod.POD_TRANSITION_STATES.shown, "reduce 下 data-state 须即时为 shown");
			assert.equal(timers.pending.size, 0, "reduce 下不得排任何过渡计时器（瞬时切换）");
		});
	});
	withMatchMedia(false, () => {
		assert.equal(mod.resolvePodTransitionDuration(), mod.POD_TRANSITION.fallbackDurationMs, "非 reduce 下时长＝坐标块时长（回退合成，不炸）");
		assert.equal(mod.podReducedMotionQuery(), false, "非 reduce 判定为 false");
		assert.equal(mod.podViewTransitionClass(3, true), mod.POD_TRANSITION.viewMarker + "-3", "非 reduce 下切席位标记须带换代序号");
		const element = createTransitionElement();
		withTimers((timers) => {
			mod.applyPodTransition(element, { kind: "layer" });
			assert.equal(element.dataset.state, mod.POD_TRANSITION_STATES.entering, "非 reduce 下进 entering 状态机");
			assert.equal(timers.pending.size, 1, "非 reduce 下须排一个结束计时");
			timers.flush();
			assert.equal(element.dataset.state, mod.POD_TRANSITION_STATES.shown, "计时结束落到 shown");
		});
	});
	{
		const saved = globalThis.window.matchMedia;
		delete globalThis.window.matchMedia;
		try {
			assert.equal(mod.podReducedMotionQuery(), false, "宿主缺 matchMedia 时按「非常规」退化（不炸）");
			assert.equal(mod.resolvePodTransitionDuration(), mod.POD_TRANSITION.fallbackDurationMs, "缺 matchMedia 时时长＝坐标块时长（不炸）");
		} finally {
			globalThis.window.matchMedia = saved;
		}
	}
});

// ================= V-P3.1 出场侧（pod 05 返修 2026-10-10）：状态机与渲染派生 =================
test("V-P3.1 出场侧：beginPodExitTransition 落 exiting 态并返回推进时长（reduce／无层元素→0）；渲染派生 podLayout.exiting", () => {
	assert.equal(typeof mod.beginPodExitTransition, "function", "导出面缺 beginPodExitTransition（出场状态机）");
	withMatchMedia(false, () => {
		const element = createTransitionElement();
		assert.equal(mod.beginPodExitTransition(element), mod.POD_TRANSITION.fallbackDurationMs, "非 reduce 下出场时长＝坐标块时长");
		assert.equal(element.dataset.state, mod.POD_TRANSITION_STATES.exiting, "出场须把层根落 exiting 态");
		assert.equal(element.dataset["pod-transition"], "layer-exit", "出场过渡标记须可寻址（data-pod-transition=layer-exit）");
	});
	withMatchMedia(true, () => {
		const reduceElement = createTransitionElement();
		assert.equal(mod.beginPodExitTransition(reduceElement), 0, "reduce 下出场时长须为 0（调用方同步撤层）");
	});
	assert.equal(mod.beginPodExitTransition(null), 0, "无层元素（无头／就地降级）须返回 0（同步撤层＝旧语义）");
	mod.resetPodTransitions();

	// 渲染派生：模块旁带 exiting 置位时，层根渲染态须派生为 exiting——出场期重渲不把态写回 shown
	withTimers(() => {
		withFakeDom(() => {
			const fixture = createLayerFixture();
			assert.ok(fixture.podLayout, "夹具须暴露隔离模块的 podLayout（渲染派生的驱动面）");
			fixture.podLayout.exiting = true;
			const tree = fixture.render();
			assert.equal(layerStateOf(tree), mod.POD_TRANSITION_STATES.exiting, "出场期渲染派生须为 exiting（防重渲盖回 shown）");
			const again = fixture.rerender();
			assert.equal(layerStateOf(again), mod.POD_TRANSITION_STATES.exiting, "出场期多帧重渲仍保持 exiting");
			fixture.podLayout.exiting = false;
			mod.resetPodTransitions();
		});
	});
});

// ================= V-P3.5：首帧不空、过渡期始终挂载 =================
test("V-P3.5 首帧断言：过渡开始到结束期间覆盖层始终挂载且非 display:none（无白屏帧、无布局跳动）", () => {
	const css = transitionCss();
	// 关键帧「向前填充」＝首帧即处 from 态（不闪全亮），结束停在 to 态（不回跳）
	assert.match(css, /animation-fill-mode:\s*both/, "关键帧须 both 填充：首帧即 from 态、结束不回跳");
	assert.match(css, /from\{[^}]*opacity:0/, "首帧由关键帧 from 定义（淡入自透明起）");
	assert.match(mod.podLayerCss, /\.pod-pod-layer\{[^}]*background:var\(--dsw-alias-bg-base\)/, "整屏层须自带底色（过渡期不透视官方页＝无白屏帧）");
	assert.ok(!/\bvisibility\b/.test(css), "过渡不得以 visibility 门控（首帧／保活前提）");

	withTimers((timers) => {
		withFakeDom(() => {
			const fixture = createLayerFixture();
			const tree = fixture.render();
			/** 一帧的现场快照（本票关心：层是否挂载、是否被 display:none 类写法隐藏、层内是否有内容）。 */
			const frame = (label) => {
				const root = byClass(tree, LAYER);
				const seatList = byClass(tree, SEAT_LIST);
				const detail = byClass(tree, SEAT_DETAIL);
				const views = [seatList, detail].filter(Boolean);
				return {
					label,
					mounted: !!root,
					state: root && root.props["data-state"],
					inlineStyle: root && root.props.style,
					officialPageMounted: true,
					contentBearing: views.length > 0 && views.some((view) => (view.children || []).length > 0)
				};
			};
			const start = frame("过渡开始");
			assert.equal(start.mounted, true, "过渡开始：覆盖层须已在挂载树上（不存在「层未挂而官方页已隐藏」的帧）");
			assert.equal(start.state, mod.POD_TRANSITION_STATES.entering, "过渡开始：层根态＝entering");
			assert.equal(start.inlineStyle, undefined, "过渡开始：不得以内联样式隐藏或布态（动效全在样式基座）");
			assert.equal(start.contentBearing, true, "过渡开始：层内须已有内容（两层皆空的反面）");
			assert.equal(start.officialPageMounted, true, "过渡开始：官方页仍挂载（保活前提）");
			const during = frame("过渡进行中");
			for (const key of ["mounted", "officialPageMounted", "contentBearing"]) {
				assert.equal(during[key], true, `过渡进行中：${key} 须保持真`);
			}
			// 推进计时：过渡结束（宿主元素上的 data-state 落 shown——状态机的推进写面）
			const detailBefore = byClass(tree, SEAT_DETAIL);
			timers.flush();
			assert.equal(
				fixture.layerElement.getAttribute("data-state"),
				mod.POD_TRANSITION_STATES.shown,
				"过渡结束：宿主层根 data-state 切到 shown"
			);
			// 重渲一帧：结构照旧（层仍挂载、层内有内容、未换席位则标记不换代）
			const next = fixture.rerender();
			const after = {
				mounted: !!byClass(next, LAYER),
				state: layerStateOf(next),
				contentBearing: (byClass(next, SEAT_LIST)?.children || []).length > 0
			};
			assert.equal(after.mounted, true, "过渡结束：层仍在场（撤层只发生在 exit() 的同步撤层）");
			assert.equal(after.state, mod.POD_TRANSITION_STATES.shown, "过渡结束：层根渲染态＝shown");
			assert.equal(after.contentBearing, true, "过渡结束：层内仍有内容");
			assert.equal(
				byClass(next, SEAT_DETAIL).props.className,
				detailBefore.props.className,
				"过渡结束（未换席位）：主区标记不得换代（不重放切席位动画）"
			);
			assert.equal(
				fixture.layerElement.isConnected === undefined || fixture.layerElement.isConnected !== false,
				true,
				"过渡结束：层仍是挂载中的宿主元素（不卸载重挂）"
			);
		});
	});
	// 状态机的可执行形式：entering →（时长后）→ shown；撤层清干净不悬挂
	const element = createTransitionElement();
	const seen = [];
	withTimers((timers) => {
		const dispose = mod.applyPodTransition(element, { kind: "layer", onState: (state) => seen.push(state) });
		assert.equal(element.dataset.state, mod.POD_TRANSITION_STATES.entering, "登记即进 entering（首帧约束由 CSS 承载）");
		assert.equal(timers.pending.size, 1, "须恰排一个结束计时（时长取自坐标块／宿主令牌）");
		timers.flush();
		assert.deepEqual(seen, [mod.POD_TRANSITION_STATES.shown], "结束时落到 shown（不存在任何中间空态）");
		assert.equal(timers.pending.size, 0, "结束计时跑完后不留待办（无悬挂定时器）");
		const disposeSecond = mod.applyPodTransition(element, { kind: "view" });
		assert.equal(timers.pending.size, 1, "重新登记须排新的结束计时");
		disposeSecond();
		disposeSecond();
		assert.equal(timers.pending.size, 0, "撤层须清掉待执行计时器（幂等）");
		dispose();
		assert.equal(timers.pending.size, 0, "已撤层后再撤仍不抛（幂等）");
	});
});

// ================= V-P3.6：负例 =================
test("V-P3.6 负例：动效不依赖 hidden／display:none，不引入宿主私有样式钩子", () => {
	const css = transitionCss();
	assert.ok(!/display\s*:\s*none/.test(css), "过渡样式不得出现 display:none（保活前提）");
	assert.ok(!/\bvisibility\s*:/.test(css), "过渡样式不得以 visibility 门控（视图互斥的 visibility 规则归票 04 既有段）");
	// 实现段落＝过渡坐标块的源文本（BEGIN...END 之间）；宿主 DOM 写面仍只属票 04 的 inert 段
	const begin = clientSource.indexOf(mod.POD_TRANSITION_STYLE_BEGIN);
	const end = clientSource.indexOf(mod.POD_TRANSITION_STYLE_END);
	assert.ok(begin >= 0 && end > begin, "客户端过渡坐标块须存在（BEGIN/END 标记）");
	const podSection = clientSource.slice(begin, end);
	// 宿主私有样式钩子：过渡段不得引用宿主不存在的 --dsw-* 动效令牌
	assert.ok(!/--dsw-[a-z-]*(?:duration|ease|transition)/.test(css), "过渡参数不得引宿主不存在的 --dsw-* 动效令牌");
	assert.ok(!/\bstyle\s*:\s*\{/.test(css), "动效不得走内联样式（令牌与关键帧落在样式基座）");
	// 客户端过渡段落不得写宿主 DOM 的显示属性
	assert.ok(!/\.hidden\s*=\s*true/.test(podSection), "过渡实现不得置宿主元素 hidden");
	assert.ok(!/style\.display\s*=/.test(podSection), "过渡实现不得改写元素 display");
	assert.ok(!/document\.(?:body|querySelector|getElementById)/.test(podSection), "过渡实现不得触碰宿主 DOM（写面仍限票 04 的 inert 段）");
	// 负例反证：过渡段**只**含自有前缀的标记类，不带任何宿主私有钩子
	assert.ok(!/--dsw-/.test(css), "过渡样式段内不得出现任何 --dsw-* 令牌");
	assert.ok(
		[mod.POD_TRANSITION.enterMarker, mod.POD_TRANSITION.viewMarker, mod.POD_TRANSITION.instantMarker]
			.every((marker) => marker.startsWith("pod-")),
		"过渡标记类须走本仓自有前缀（不冒用宿主钩子／票 04 结构类名）"
	);
	assert.notEqual(mod.POD_TRANSITION.instantMarker, mod.POD_TRANSITION.viewMarker, "瞬时档与动画档须是两个不同标记");
});

// ---------- 运行（与 tests/pod-overlay.test.mjs 同口径的轻量 runner） ----------
let failed = 0;
for (const [name, fn] of results) {
	try {
		fn();
		console.log("✓", name);
	} catch (error) {
		failed += 1;
		console.error("✗", name, "—", error.stack ? error.stack.split("\n").slice(0, 4).join(" / ") : error.message);
	}
}
process.exit(failed > 0 ? 1 : 0);
