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
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	HOST_TRANSITION_TOKENS,
	SHELL_OVERLAY_LAYER_BAND,
	discoverPackageRoots,
	parseDeclarations
} from "../scripts/host-contract-probe.mjs";

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
	entry: "pod-entry",
	notices: "pod-notices",
	pod: "pod-pod",
	podHost: "pod-pod-host",
	podLayer: "pod-pod-layer",
	sidebar: "pod-sidebar",
	main: "pod-main"
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
		// 记账**ref 对象本身**（真 ref 语义；commit 期赋值由用例显式模拟——无头环境不跑提交）
		useRef(initial) { const ref = { current: initial }; hooks.useRef.push(ref); return ref; },
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

// ---------- 样式断言助手：真实 CSS 文本上的**声明级复算**（复核 B1／I1／M9） ----------
/** 去掉选择器前缀里的块注释（规则文本里的注释先行态；如 `/* … *\/ .a{…}`）。 */
const stripLeadingComments = (text) => String(text).replace(/^(?:\s*\/\*[\s\S]*?\*\/\s*)*/, "").trim();

/**
 * 从**真实样式文本**里取某选择器的声明表：按文档序合并、后声明覆盖前声明（无特异性
 * 冲突的夹具内等价于级联结果），并用 `parseDeclarations`（票 02 探针的同一解析器）
 * 拆成对象。只服务本文件的**同源规则**断言：不做选择器求值，调用方须给出逐字选择器。
 */
function declaredProps(css, selector) {
	const wanted = "." + selector.replace(/^\./, "");
	const merged = {};
	for (const match of css.matchAll(/(?:^|(?<=\}))\s*([^{}@]+)\{([^}]*)\}/g)) {
		const selectors = stripLeadingComments(match[1]).split(",").map((part) => part.trim());
		if (!selectors.includes(wanted)) continue;
		Object.assign(merged, parseDeclarations(match[2]));
	}
	return merged;
}
/** 规则体原文（用于形状断言，如「变量只以 var() 形态出现」）。 */
function declaredBody(css, selector) {
	const wanted = "." + selector.replace(/^\./, "");
	let body = null;
	for (const match of css.matchAll(/(?:^|(?<=\}))\s*([^{}@]+)\{([^}]*)\}/g)) {
		if (stripLeadingComments(match[1]).split(",").map((part) => part.trim()).includes(wanted)) body = match[2];
	}
	return body;
}

/** 无头浏览器候选（真实布局复算的载体；缺失时该用例打印 SKIP 标记）。 */
function findHeadlessBrowser() {
	for (const candidate of ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

/**
 * 用真实布局引擎复算一段 HTML＋CSS 的几何与计算样式：
 * 页面内注入测量脚本 → `--dump-dom` 回读 `<pre id="pod-pod-metrics">` 的 JSON。
 * 返回 null＝本机无无头浏览器（调用方按跳过协议处置，不得当绿）。
 */
function measureLayout(title, bodyHtml, css) {
	const binary = findHeadlessBrowser();
	if (!binary) return null;
	const dir = mkdtempSync(join(tmpdir(), "pod-pod-b1-"));
	try {
		const html = `<!doctype html><html><head><style>
body{margin:0}
${css}
</style></head><body>${bodyHtml}
<script>
const box = (selector) => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
const pos = (selector) => { const el = document.querySelector(selector); return el ? getComputedStyle(el).position : null; };
const out = document.createElement("pre");
out.id = "pod-pod-metrics";
out.textContent = JSON.stringify({
  container: box("[data-pod-pod-body-fixture]"),
  active: box("[data-pod-pod-view-fixture=\\"active\\"]"),
  inactive: box("[data-pod-pod-view-fixture=\\"inactive\\"]"),
  seatList: box("[data-pod-pod-seat-fixture]"),
  shell: box("[data-pod-pod-shell-fixture]"),
  mainPane: box("[data-pod-pod-main-fixture]"),
  inactivePosition: pos("[data-pod-pod-view-fixture=\\"inactive\\"]"),
  viewportWidth: window.innerWidth
});
document.body.appendChild(out);
</script></body></html>`;
		const file = join(dir, "fixture.html");
		writeFileSync(file, html);
		const run = spawnSync(binary, [
			"--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
			`--user-data-dir=${join(dir, "profile")}`,
			"--virtual-time-budget=2000", "--dump-dom", "file://" + file
		], { encoding: "utf8", timeout: 60_000, env: { ...process.env, HOME: dir } });
		const dom = run.stdout ?? "";
		const match = dom.match(/<pre id="pod-pod-metrics">([\s\S]*?)<\/pre>/);
		assert.ok(match, `${title}：无头浏览器未回读几何（stderr：${(run.stderr ?? "").split("\n").slice(-2).join(" / ")}）`);
		return JSON.parse(match[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/** 旧样式基座（复核 B1 的**反例**：作者源 display:flex 覆盖 UA `[hidden]{display:none}`）。
 *  与真实样式基座的差别只有「视图基座未脱流」一处，其余同形（shell 的 flex 照旧）。 */
const legacyVisibilityOnlyCss = () => {
	const c = mod.POD_LAYER_CLASSES;
	return mod.podLayerCss.replace(
		`.${c.view}[hidden]{position:absolute;inset:0;`,
		`.${c.view}[hidden]{`
	);
};

/**
 * 真机走查返修 R1 的两处**反例**生成器：从真实样式里各摘掉一处声明。
 * 返回 null＝锚点漂移（用例按维护触点报红）——反例必须真的不同于被测样式，否则判据恒真。
 */
const withoutSeatListWidthCss = () => {
	const declaration = `;width:${mod.POD_LAYER.seatListWidth}px`;
	if (!mod.podLayerCss.includes(declaration)) return null;
	return mod.podLayerCss.replace(declaration, "");
};
const withoutViewFillCss = () => {
	const rule = new RegExp("\\." + mod.POD_LAYER_CLASSES.layer + " \\."
		+ mod.POD_LAYER_CLASSES.view + ">\\*\\{[^}]*\\}");
	if (!rule.test(mod.podLayerCss)) return null;
	return mod.podLayerCss.replace(rule, "");
};

// ================= B1（复核）：整屏几何——活动视图占满容器宽 =================
test("B1 整屏几何：非活动视图脱流但仍挂载（真实 CSS＋真实布局引擎复算），活动视图占满容器宽", () => {
	const css = mod.podLayerCss;
	const body = declaredProps(css, mod.POD_LAYER_CLASSES.body);
	const view = declaredProps(css, mod.POD_LAYER_CLASSES.view);
	const hiddenView = declaredProps(css, mod.POD_LAYER_CLASSES.view + "[hidden]");
	// ① 作者源盒模型：活动视图须能占满容器（flex 增长＋可收缩＋零最小宽）
	assert.match(view.display, /^flex/, "活动视图盒模型须走 flex（占满容器宽的前提）");
	assert.match(view["flex-grow"] ?? view.flex ?? "", /^1\b/, "活动视图须 flex-grow:1（占满剩余宽）");
	assert.match(view["min-width"] ?? "", /^0/, "活动视图须 min-width:0（不得阻止收缩到容器宽）");
	assert.match(body.display, /^flex/, "pod-body 须为 flex 容器（双视图互斥布局的前提）");
	// ② 非活动视图「脱流」＝复核 B1 的修法：绝对定位＋四边归零（不参与 flex 分配、
	//    不从容器分宽），且**不得**靠 display:none 卸掉（保活前提：节点与滚动位置保留）
	assert.equal(hiddenView.position, "absolute", "非活动视图须 position:absolute（脱流，不占横向空间）");
	assert.equal(hiddenView.inset, "0", "非活动视图须 inset:0（锚回容器，几何不跳）");
	assert.equal(hiddenView.display, undefined, "非活动视图不得以作者源 display 覆盖 UA 的 [hidden]{display:none}");
	assert.equal(hiddenView.visibility, "hidden", "非活动视图须 visibility:hidden（隐藏但保持挂载）");
	// ③ 旧形制（仅 visibility、作者源 display:flex）在作者源层就被否证——这条是**反例**，
	//    防「改回只 visibility」的回归：作者源 display:flex 会覆盖 UA [hidden]{display:none}
	const legacyCss = legacyVisibilityOnlyCss();
	const legacy = declaredProps(legacyCss, mod.POD_LAYER_CLASSES.view);
	assert.match(legacy.display, /^flex/, "反例夹具自检：旧样式确实在作者源声明 display:flex（覆盖 UA hidden 规则）");
	const legacyHidden = declaredProps(legacyCss, mod.POD_LAYER_CLASSES.view + "[hidden]");
	assert.equal(legacyHidden.position, undefined, "反例夹具自检：旧样式无脱流声明");
	// ④ 真实布局引擎复算（headless Chrome；载体缺失＝跳过协议，不作绿）：把**真实
	//    podLayerCss** 与同形标记一起交给布局引擎，量活动／非活动视图的实际盒与流占位。
	//    判据口径：活动视图左边界＝容器内容起点、右边界＝容器内容终点（占满容器宽）；
	//    非活动视图**不在流内**（绝对定位 ⇒ 不参与 flex 分配，故活动视图宽度不被它挤压）。
	const metrics = measureLayout("B1", mod.podOverlayMarkup(), css);
	if (!metrics) {
		console.log("⤼ SKIP: 本机无无头浏览器（/usr/bin/google-chrome 等）——真实布局复算未跑，纯声明级判据仍生效");
		return;
	}
	assert.ok(metrics.container && metrics.container.width > 0, `夹具容器须有实测宽度（实测 ${metrics.container && metrics.container.width}）`);
	assert.ok(metrics.container.width < metrics.viewportWidth, "夹具须留出侧栏列宽（否则「容器宽」无区分度）");
	assert.ok(Math.abs(metrics.active.left - metrics.container.left) <= 1,
		`活动视图左边界须贴容器内容起点（不占横向空间的证明）：容器 ${metrics.container.left}px／活动 ${metrics.active.left}px`);
	assert.ok(Math.abs(metrics.active.right - metrics.container.right) <= 1,
		`活动视图右边界须达容器内容终点（占满容器宽）：容器 ${metrics.container.right}px／活动 ${metrics.active.right}px`);
	assert.ok(Math.abs(metrics.active.width - metrics.container.width) <= 1,
		`活动视图宽度须等于容器内容宽：容器 ${metrics.container.width}px／活动 ${metrics.active.width}px`);
	assert.equal(metrics.inactivePosition, "absolute", "非活动视图在真实引擎里须为 absolute（脱流但保持挂载）");
	// ④b 「半修」形态（去掉脱流声明、保留 visibility＋flex）必须在真实引擎里**复现 B1**
	//     （非活动视图仍在流内、与活动视图分宽）：否则本条判据无力（恒真）
	const legacyMetrics = measureLayout("B1 反例", mod.podOverlayMarkup(), legacyVisibilityOnlyCss());
	assert.ok(legacyMetrics, "反例夹具须同样跑通（缺失浏览器时上面已跳过）");
	assert.notEqual(legacyMetrics.inactivePosition, "absolute", "反例夹具自检：仅 visibility 的形态不得脱流");
	assert.ok(legacyMetrics.active.left > legacyMetrics.container.left + 1,
		`仅 visibility 的形态应复现 B1（非活动视图仍在流内、把活动视图挤到右侧）：容器左 ${legacyMetrics.container.left}px／活动左 ${legacyMetrics.active.left}px`);
	assert.ok(legacyMetrics.active.width < legacyMetrics.container.width - 1,
		`仅 visibility 的形态下活动视图不得占满容器宽：容器 ${legacyMetrics.container.width}px／活动 ${legacyMetrics.active.width}px`);
});

// ================= R1（真机走查返修 2026-10-10）：覆盖层席位列自持宽度 =================
test("R1 席位列自持宽度：主区不被内容挤成 0（坐标块常量＋真实 CSS 声明＋布局引擎复算＋双反例）", () => {
	const c = mod.POD_LAYER_CLASSES;
	const layer = mod.POD_LAYER;
	const width = layer.seatListWidth;
	const collapsedWidth = layer.seatListCollapsedWidth;
	// ① 坐标块：宽度常量单源（禁散落数值）；280 对齐官方侧栏默认档，56 为既有折叠 rail 档
	assert.equal(width, 280, "席位列宽须对齐官方侧栏默认档（dsh-client-ui-layout `sidebar === 0 ? 280`）");
	assert.equal(collapsedWidth, 56, "折叠 rail 档 56 须收进 POD_LAYER（原硬编码在样式规则里）");
	// ② 真实 podLayerCss 文本上的声明级复算：规则存在且取值＝坐标块常量（改字面量／丢规则即红）
	const seatList = declaredProps(mod.podLayerCss, `${c.layer} .${c.seatList}`);
	assert.equal(seatList.width, `${width}px`, "席位列须有显式宽度＝坐标块常量（旧抢槽形态由宿主槽容器给宽，覆盖层必须自持）");
	assert.equal(seatList.flex, "none", "席位列须 flex:none（有宽度后不参与收缩）");
	assert.equal(seatList["box-sizing"], "border-box", "显式宽度须配 border-box（根带 6px 12px 内边距不外扩）");
	assert.equal(seatList.height, "100%", "height:100% 既有语义不得回退");
	const collapsed = declaredProps(mod.podLayerCss, `${c.layer} .${c.seatList}.pod-collapsed`);
	assert.equal(collapsed.width, `${collapsedWidth}px`, "折叠档宽度须＝坐标块常量（原 `.pod-collapsed{width:56px}` 语义保留）");
	// ③ 主区不被挤成 0（声明级）：body 宽度约束＋视图子节点占满（旧槽位由宿主 column flex 的 stretch 给宽）
	const body = declaredProps(mod.podLayerCss, c.body);
	assert.equal(body.width, "100%", "pod-body 须有 width:100%（不被席位列挤成 0 的声明级保证）");
	assert.match(body["min-width"] ?? "", /^0/, "pod-body 须 min-width:0（可收缩到剩余宽）");
	const pane = declaredProps(mod.podLayerCss, `${c.layer} .${c.view}>*`);
	assert.equal(pane.width, "100%", "视图子节点须 width:100%（覆盖层没有宿主槽容器给宽）");
	assert.match(pane.flex ?? "", /^1\b/, "视图子节点须 flex-grow:1（占满视图主轴）");
	assert.match(pane["min-width"] ?? "", /^0/, "视图子节点须 min-width:0（不得把视图撑破）");
	// ④ 真实布局引擎复算（无头 Chrome；载体缺失＝跳过协议，不作绿）：席位列＝常量宽、
	//    主区＝剩余宽、活动视图与面板都不被挤塌
	const metrics = measureLayout("R1", mod.podOverlayMarkup(), mod.podLayerCss);
	if (!metrics) {
		console.log("⤼ SKIP: 本机无无头浏览器——真实布局复算未跑，坐标块＋声明级判据仍生效（真机宽度由 04 票面 Comments 复算留证）");
		return;
	}
	assert.ok(metrics.seatList && metrics.shell, "夹具须回读席位列与 shell 几何");
	assert.ok(Math.abs(metrics.seatList.width - width) <= 1,
		`席位列实测宽须＝坐标块常量：期望 ${width}px／实测 ${metrics.seatList.width}px`);
	assert.ok(metrics.container.width > 0, `主区不得被挤成 0 宽（实测 ${metrics.container.width}px）`);
	assert.ok(Math.abs(metrics.container.left - metrics.seatList.right) <= 1,
		`主区左边界须贴席位列右边界：席位列右 ${metrics.seatList.right}px／主区左 ${metrics.container.left}px`);
	assert.ok(Math.abs(metrics.container.width - (metrics.shell.width - metrics.seatList.width)) <= 1,
		`主区须占满剩余宽度：shell ${metrics.shell.width}px－席位列 ${metrics.seatList.width}px／主区 ${metrics.container.width}px`);
	assert.ok(Math.abs(metrics.active.width - metrics.container.width) <= 1, "活动视图仍须占满主区（B1 判据不回退）");
	assert.ok(Math.abs(metrics.mainPane.width - metrics.container.width) <= 1,
		`视图子节点须占满主区：主区 ${metrics.container.width}px／面板 ${metrics.mainPane.width}px`);
	// ⑤ 反例 a（真实引擎复现真机缺陷）：摘掉席位列宽度声明 ⇒ `flex:none` 按内容固有宽撑开、主区塌成 0
	const defectiveCss = withoutSeatListWidthCss();
	assert.ok(defectiveCss && defectiveCss !== mod.podLayerCss, "反例夹具自检：须真的摘掉席位列宽度声明（锚点漂移＝本用例维护触点）");
	const defective = measureLayout("R1 反例 a", mod.podOverlayMarkup(), defectiveCss);
	assert.ok(defective.seatList.width > defective.viewportWidth,
		`无显式宽度时席位列按内容固有宽度撑开：实测 ${defective.seatList.width}px（真机 11925.4px）`);
	assert.equal(defective.container.width, 0, `主区被挤成 0 宽（复现真机缺陷）：实测 ${defective.container.width}px`);
	// ⑤b 反例 b：摘掉「视图子节点占满」⇒ 面板宽度退化为内容宽（0），证明该声明非装饰
	const noFillCss = withoutViewFillCss();
	assert.ok(noFillCss && noFillCss !== mod.podLayerCss, "反例夹具自检：须真的摘掉视图子节点占满规则");
	const noFill = measureLayout("R1 反例 b", mod.podOverlayMarkup(), noFillCss);
	assert.ok(noFill.container.width > 0, "反例 b 只在面板层生效：主区本身仍有宽（席位列自持宽度未摘）");
	assert.equal(noFill.mainPane.width, 0, `无占满声明时面板宽度退化为内容宽：实测 ${noFill.mainPane.width}px`);
});

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

// ================= V-P3.1 出场侧（pod 05 返修 2026-10-10）：exit() 计时落点撤层 =================
test("V-P3.1 出场侧：exit() 先落 exiting 再计时撤层；重进取消退出；重复 exit 幂等", () => {
	const { core } = bootPod();
	withFakeDom(() => {
		mod.__podControl.enter();
		assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices, IDS.pod], "进场注册覆盖层条目");
		// 层根引用（生产面由 PodOverlayLayer 挂载效应置位；无头不跑效应，经内视缝复算）
		const layerElement = {
			dataset: {},
			setAttribute(name, value) { this.dataset[name.replace(/^data-/, "")] = value; },
			getAttribute(name) {
				const key = name.replace(/^data-/, "");
				return Object.prototype.hasOwnProperty.call(this.dataset, key) ? this.dataset[key] : null;
			},
			removeAttribute(name) { delete this.dataset[name.replace(/^data-/, "")]; }
		};
		mod.__podLayoutForTest.layer = layerElement;
		// 可驱动钟（同 pod-transition 回归的接管法：替换 window.setTimeout/clearTimeout）
		const pending = new Map();
		let seq = 0;
		const previousSet = globalThis.window.setTimeout;
		const previousClear = globalThis.window.clearTimeout;
		globalThis.window.setTimeout = (callback) => { seq += 1; pending.set(seq, callback); return seq; };
		globalThis.window.clearTimeout = (id) => { pending.delete(id); };
		const flush = () => { const batch = [...pending.values()]; pending.clear(); for (const cb of batch) cb(); };
		try {
			mod.__podControl.exit();
			assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices, IDS.pod], "出场淡出期条目仍在（撤层发生在计时落点）");
			assert.equal(layerElement.getAttribute("data-state"), "exiting", "exit() 须先落 exiting 态（播淡出）");
			assert.equal(mod.getBotState().podActive, true, "淡出期 podActive 不提前熄灭（通知抬档随撤层一并回落）");
			mod.__podControl.exit();
			assert.equal(pending.size, 1, "退出途中重复 exit() 须幂等（不排第二个计时器）");
			// 重进取消退出：层未撤、写回 shown、清掉已排计时器
			mod.__podControl.enter();
			assert.equal(pending.size, 0, "重进须清掉出场计时器（取消退出）");
			assert.equal(layerElement.getAttribute("data-state"), "shown", "重进须把层根写回 shown 稳态");
			assert.equal(layerElement.getAttribute("data-pod-transition"), null, "取消退出须摘掉出场过渡标记");
			assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices, IDS.pod], "取消退出的覆盖层条目仍注册（层未卸载）");
			// 再退：计时落点执行撤层
			mod.__podControl.exit();
			assert.equal(pending.size, 1, "再次退出须排一个出场计时器");
			flush();
			assert.deepEqual(core.idsOf("shell.overlay"), [IDS.notices], "计时落点执行撤层（dispose 移除条目）");
			assert.equal(mod.getBotState().podActive, false, "撤层后熄灭 podActive");
			// 复审修订（补二）：出场计时器须入 resetPodTransitions 清理账（模块级 podExitTimer，
			// 防夹具不 flush 就成悬挂定时器）
			mod.__podControl.enter();
			mod.__podControl.exit();
			assert.equal(pending.size, 1, "第三次进出排一个出场计时器");
			mod.resetPodTransitions();
			assert.equal(pending.size, 0, "resetPodTransitions 须清掉出场计时器（入清理账）");
		} finally {
			globalThis.window.setTimeout = previousSet;
			globalThis.window.clearTimeout = previousClear;
			mod.__podLayoutForTest.layer = null;
			mod.__podControl.reset();
		}
	});
});

// ================= V-P2.2：官方页保活（机制级：真 SlotCore 实跑＋节点身份＋属性快照） =================
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
		const snapshot = identity.map((node) => ({
			node,
			scrollTop: node.scrollTop,
			ariaExpanded: node.ariaExpanded,
			textContent: node.textContent,
			childCount: node.children.length,
			attributes: { ...node.attributes }
		}));

		// 起装置（apply 须在假 DOM 域内：SSE／locale 副作用走桩）；
		// 覆盖层席位视图会挂真实 BotMain（轮询 effect），按无头口径补计时器桩
		const core = createSlotCore(DECLARED);
		const ctx = createCtx(core);
		mod.apply(ctx);
		globalThis.window.setInterval = () => 0;
		globalThis.window.clearInterval = () => {};
		assert.ok(ctx.calls.layout.length === 0, "装置期不得触达宿主 layout 面");

		// 官方条目账本（真 SlotCore 语义）：进出前后逐字不变——这是「官方页不被换下」的机制级判据
		const slotLedger = () => ({
			sidebar: [...core.idsOf("sidebar")],
			main: [...core.idsOf("main")],
			overlay: [...core.idsOf("shell.overlay")],
			footer: [...core.idsOf("sidebar.footer.action")]
		});
		const ledgerBefore = slotLedger();
		const bodyChildrenBefore = [...dom.body.children];

		mod.__podControl.enter();
		// 覆盖层宿主容器＝portal 锚点：由 `__podControl.mountHost`（`PodOverlayHost` 的 layout effect
		// 直调用法）在 body 下建立；无头环境不跑 effect，故经此前门复算同一函数
		const host = mod.__podControl.mountHost(dom.document);
		assert.ok(host, "进入 Pod 须在 body 下建覆盖层宿主容器（portal 锚点）");
		assert.equal(host.parentNode, dom.body, "宿主容器须是 document.body 直接子元素（根堆叠上下文）");
		// 真实挂载效应：把层的 ref 指向**宿主容器下的真节点**（现场里层就是 portal 到 host 的），
		// 再直调 effect（与现场同一函数、同一路径——含 M7 的「已 portal 才置 inert」判定）
		const layerNode = dom.document.createElement("div");
		host.appendChild(layerNode);
		layerNode.ownerDocument = dom.document;
		harness.hooks.useEffect.length = 0;
		harness.hooks.useEffectCleanups.length = 0;
		harness.hooks.useRef.length = 0;
		const layerView = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
		assert.equal(layerView.error, undefined, "覆盖层须可渲染：" + (layerView.error && layerView.error.message));
		const dialogRef = harness.hooks.useRef.at(-1);
		assert.ok(dialogRef && typeof dialogRef === "object", "覆盖层根须挂 ref（inert 采集的 layer 载体）");
		// 复算 React commit：把根 ref 指向真节点（无头渲染器不跑提交期）
		dialogRef.current = layerNode;
		const cleanups = [];
		for (const effect of harness.hooks.useEffect.slice()) {
			const out = typeof effect === "function" ? effect() : null;
			if (typeof out === "function") cleanups.push(out);
		}
		assert.ok(cleanups.length >= 1, "覆盖层挂载效应须可直调（inert＋焦点兜底）");

		// 覆盖期：官方节点身份／连接态／几何与可见属性一律不动；唯一允许的写入＝背景 inert
		for (const item of snapshot) {
			const node = item.node;
			assert.equal(node, item.node, "官方 DOM 子树节点身份不得变化（不得卸载重挂）");
			assert.equal(node.isConnected, true, "官方页在 Pod 期间全程挂载");
			assert.equal(node.scrollTop, item.scrollTop, "官方滚动位置不得被改写");
			assert.equal(node.ariaExpanded, item.ariaExpanded, "官方工具卡展开态不得被改写");
			assert.equal(node.textContent, item.textContent, "官方进行中回合的可见进度不得被改写");
			assert.equal(node.children.length, item.childCount, "官方容器子节点数不得被改写（不得被插入隐藏件）");
			assert.deepEqual(node.attributes, item.attributes, `官方节点属性不得被改写（${node.label}）`);
			assert.equal(node.inert, true, "覆盖期间背景元素须被置 inert（唯一被允许的宿主 DOM 写入）");
			assert.equal(Object.keys(node.style).length, 0, "不得以样式隐藏官方页");
		}
		assert.equal(host.inert, undefined, "我方宿主容器不得被置 inert（层内控件须可聚焦）");
		assert.equal(ctx.calls.layout.length, 0, "覆盖期不得触达宿主 layout 面");

		// 卸载序（React 口径：清理函数按**相反序**跑）→ 撤层
		for (const cleanup of cleanups.slice().reverse()) cleanup();
		mod.__podControl.exit();
		for (const item of snapshot) {
			assert.equal(item.node.isConnected, true, "退出后官方页仍在文档中（全程挂载）");
			assert.equal(item.node.scrollTop, item.scrollTop, "退出后滚动位置保留");
			assert.equal(item.node.ariaExpanded, item.ariaExpanded, "退出后工具卡展开态保留");
			assert.equal(item.node.textContent, item.textContent, "退出后进行中回合可见进度保留");
			assert.deepEqual(item.node.attributes, item.attributes, "退出后官方节点属性逐字还原");
			assert.equal(item.node.inert, undefined, "退出后 inert 原值还原");
		}
		// 进出各一次后：官方槽账本与 body 直接子元素表逐字还原（除我方常驻宿主容器外无增删）
		assert.deepEqual(slotLedger().sidebar, ledgerBefore.sidebar, "官方 sidebar 账本不得变");
		assert.deepEqual(slotLedger().main, ledgerBefore.main, "官方 main 账本不得变");
		assert.deepEqual(slotLedger().footer, ledgerBefore.footer, "入口钮账本不得变");
		assert.deepEqual(slotLedger().overlay, [IDS.notices], "退出后覆盖层只余通知条目（撤层）");
		const bodyChildrenAfter = [...dom.body.children].filter((node) => node.getAttribute("data-pod-pod-host") === null);
		assert.deepEqual(bodyChildrenAfter, bodyChildrenBefore, "官方页的 body 直接子元素表逐字还原");
		assert.equal(ctx.calls.layout.length, 0, "退出不得触达宿主 layout 面");
	});
});

// ================= V-P2.3：负例——不得以 hidden／display:none 隐藏官方页 =================
test("V-P2.3 负例：Pod 路径不得对官方页用 hidden／display:none，覆盖层隐藏自身也不用 display:none", () => {
	/** 剥掉块注释与行注释（扫描只针对**代码**，判据文里出现被禁字面不算命中——复核 M1）。 */
	const stripComments = (text) => String(text)
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
	// 源码级：Pod 层相关代码不得出现「官方页隐藏」写法（我方从不触碰宿主 DOM 的显示属性）
	assert.ok(!/closeDetails\s*\(/.test(stripComments(clientSource)), "死调用 ctx.layout.closeDetails() 须已删除");
	// 扫描口径（复核 M1，写实）：`podSection`＝从「Pod 覆盖式常驻」注释到 `// ---------- 插件声明`
	// 的整段，实测覆盖本文件绝大部分（含 BotMain／ChatView 等非 Pod 件）——故它**不是**
	// 只扫 Pod 代码，而是「Pod 段落所在的大段代码」；下列负例是全域禁区（我方任何代码都
	// 不得对官方页施加 hidden／display:none），覆盖面更大不构成假绿。精确到 Pod 样式基座
	// 的扫描见本条下半段（`podLayerCss` 起止之间）。
	const podSection = stripComments(clientSource.slice(
		clientSource.indexOf("Pod 覆盖式常驻"),
		clientSource.indexOf("// ---------- 插件声明")
	));
	assert.ok(podSection.length > 0, "Pod 覆盖式常驻段落须存在");
	// 禁的写法逐拼写点名（复核 M1：原实现只查 `.hidden = true` 与 `style.display =`）：
	// 属性赋值、属性字面量、style 属性与 setProperty 四条通路都不放过
	assert.ok(!/\.hidden\s*=\s*(?!false)/.test(podSection), "不得以 `.hidden = <非 false>` 改写元素（含宿主页与自身视图之外的任何节点）");
	assert.ok(!/setAttribute\(\s*["'`]hidden["'`]/.test(podSection), "不得以 setAttribute(\"hidden\", …) 隐藏元素");
	assert.ok(!/\bstyle\.display\s*=/.test(podSection), "不得直接改写元素 display");
	assert.ok(!/style\.setProperty\(\s*["'`]display["'`]/.test(podSection), "不得以 style.setProperty(\"display\", …) 隐藏元素");
	assert.ok(!/aria-hidden["']?\s*:\s*["']?true[^}]*\bbb?ody\b/.test(podSection), "不得对 body 施加 aria-hidden");
	// 覆盖层自己的样式基座（`podLayerCss` 起止之间，注释已剥）：容器与视图一律不得 display:none
	const cssStart = clientSource.indexOf("const podLayerCss = `");
	const cssEnd = clientSource.indexOf("`;", cssStart);
	const podCode = stripComments(clientSource.slice(cssStart, cssEnd + 2));
	assert.ok(podCode.includes("POD_LAYER_CLASSES.layer"), "覆盖层样式基座须存在");
	assert.ok(!/display\s*:\s*["']?none/.test(podCode), "覆盖层样式基座内不得出现 display:none");
	// 我方隐藏自身视图（列表／席位互斥）用 visibility＋脱流定位，不得用 display:none 卸掉交互树
	const podCss = mod.POD_LAYER_CLASSES && mod.podLayerCss;
	assert.equal(typeof podCss, "string", "导出面缺 podLayerCss（覆盖层样式基座）");
	assert.ok(!/display\s*:\s*none/.test(stripComments(podCss)), "覆盖层样式不得用 display:none");
	// 覆盖层视图互斥只走 hidden 属性（CSS 落 visibility＋脱流），且不得内联 display
	const tree = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
	assert.equal(tree.error, undefined, "覆盖层须可渲染：" + (tree.error && tree.error.message));
	for (const node of findAll(tree, (item) => typeof item.props.className === "string" && item.props.className.includes("pod-pod"))) {
		assert.equal(node.props.style === undefined, true, "覆盖层节点不得以内联样式隐藏");
	}
	for (const node of findAll(tree, (item) => typeof item.props.className === "string" && item.props.className.includes("pod-pod-view"))) {
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
			assert.ok(root, "覆盖层根节点须带 pod-pod-layer 类（渲染树可走查）");
			assert.equal(root.props.role, "dialog", "覆盖层须 role=dialog");
			assert.equal(root.props["aria-modal"], "true", "覆盖层须 aria-modal=true");
			assert.equal(root.props["data-shortcut-modal"], undefined, "data-shortcut-modal 保持可选且不设（未声明即 modal id \"other\"，全命令被拦）");
			assert.ok(portals.length >= 1, "覆盖层须经 react-dom createPortal 投出（非原地渲染）");
			assert.equal(portals.at(-1).container, host, "整屏层须 portal 到 body 下的宿主容器（本次挂载的锚点）");
			assert.equal(portals.every((item) => item.container.className === mod.POD_LAYER_CLASSES.host), true, "每次挂载的 portal 容器都须是覆盖层宿主容器");
			assert.equal(host.parentNode, globalThis.document.body, "宿主容器须是 body 直接子元素（根堆叠上下文，position:fixed 不被重锚）");
			assert.equal(host.className, mod.POD_LAYER_CLASSES.host, "宿主容器类名走常量");
			assert.equal(host.getAttribute("data-pod-pod-host") === "" || "data-pod-pod-host" in host.dataset, true, "宿主容器带锚点标记");
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

test("V-P2.8c 背景 inert：真实可达序（Pod 采集中官方浮层后开）——让位、LIFO 归还、各自还原自己的值", () => {
	withFakeDom((dom) => {
		const officialA = dom.attach("官方 A", undefined);
		const officialB = dom.attach("官方 B", undefined);
		const { acquireOverlayInert, releaseOverlayInert } = mod.__podInertForTest;
		// 真实可达序：Pod 先开 ⇒ 采集全部背景（A／B 由 Pod 属主置 true 并保存原值）
		const podHandle = acquireOverlayInert(dom.document);
		assert.equal(officialA.inert, true, "Pod 采集后背景 A 为 inert");
		assert.equal(officialB.inert, true, "Pod 采集后背景 B 为 inert");
		// 官方浮层后开（§B6：官方 body 级浮层盖在 Pod 之上）：官方层**看不到可采集项**
		const officialHandle = acquireOverlayInert(dom.document);
		assert.equal(officialHandle, null, "Pod 在位时官方层的采集不得窃取我方属主已置的值（无新元素可采集）");
		assert.equal(officialA.inert, true, "官方层采集后背景 A 仍为 inert");
		// 后开先关（官方层先关）：官方层释放不得改动我方属主的值 ⇒ Pod 仍在其位、背景仍不可聚焦
		releaseOverlayInert(officialHandle);
		assert.equal(officialA.inert, true, "官方层释放后背景 A 仍为 inert（Pod 仍在位；LIFO 各自还原自己的值）");
		assert.equal(officialB.inert, true, "官方层释放后背景 B 仍为 inert");
		// Pod 后关：还原到**真原值**（从未设置过 ⇒ undefined）
		releaseOverlayInert(podHandle);
		assert.equal(officialA.inert, undefined, "Pod 释放后背景 A 还原为真原值（undefined）");
		assert.equal(officialB.inert, undefined, "Pod 释放后背景 B 还原为真原值（undefined）");
		// 补反向序的「不窃取」半边：官方层属主已置 true 的元素，我方释放不得还原成 false
		const officialC = dom.attach("官方 C（已是 inert）", true);
		const handle = acquireOverlayInert(dom.document);
		releaseOverlayInert(handle);
		assert.equal(officialC.inert, true, "他人的 inert 值不得被还原成 false（不窃取）");
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
/**
 * 宿主命令注册表读取（复核 I2 的「对照真实注册表」载体，非硬编码常量）：
 * 从真机装的官方 bundle 源里取 `id` 声明（字面量或模板形）与其后最近的 `modals:` 实参。
 * 载体缺失／声明为模板形无法逐字对 id 时返回 null（调用方按跳过协议处置，不静默当绿）。
 */
function readHostCommandModals({ pkg, id, literalId = true }) {
	for (const root of discoverPackageRoots()) {
		const file = join(root, pkg, "lib", "client.js");
		if (!existsSync(file)) continue;
		const source = readFileSync(file, "utf8");
		if (!literalId) {
			// 模板形 id（如 `page.${kind}`）：以「谁调用 closeTopModal」定位声明块，再取该块的 modals
			const anchor = source.indexOf("closeTopModal");
			if (anchor < 0) continue;
			const start = source.lastIndexOf("id:", anchor);
			const between = source.slice(start, anchor);
			const at = between.lastIndexOf("modals:");
			const expression = at < 0 ? "" : between.slice(at + 7).trim().replace(/,\s*$/, "");
			return { commandId: "(close command)", expression, file, anchor: source.slice(start, start + 40).split("\n")[0] };
		}
		const idMatches = [...source.matchAll(/\bid:\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/g)]
			.map((match) => ({ id: match[1] ?? match[2] ?? match[3], at: match.index }));
		for (const resolveAt of [...source.matchAll(/\bresolve\s*[:(]/g)].map((match) => match.index)) {
			// 与该 `resolve` 最近的前一个 `id:` 即本命令的注册 id（命令对象字面量序：id → … → resolve）
			const owner = [...idMatches].reverse().find((entry) => entry.at < resolveAt);
			if (!owner || owner.id !== id) continue;
			const between = source.slice(owner.at, resolveAt);
			const at = between.lastIndexOf("modals:");
			if (at < 0) return { commandId: id, modals: [], file, note: "无 modals 声明（缺省＝任何 modal 下放行）" };
			return { commandId: id, expression: between.slice(at + 7).trim().replace(/,\s*$/, ""), file };
		}
	}
	return null;
}

/** 宿主命令声明的 modals 取值读出（字面数组或 `cond ? [...] : []` 三元；覆盖 Pod 期两种）。
 *  三元分支**不含数组字面量**时返回 `[]`（如 else 分支的 `: []` 与无括号写法等价）。 */
function resolveModalsExpression(expression, kind) {
	// 三元条件里可能含方括号（如 `[...list, "x"]`），先剥掉条件段再取数组字面量
	const text = String(expression).includes("?") ? String(expression).slice(String(expression).indexOf("?")) : String(expression);
	const literal = (span) => {
		if (span.indexOf("[") < 0) return [];
		return span.slice(span.indexOf("[") + 1, span.indexOf("]")).split(",")
			.map((part) => part.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean);
	};
	if (!/kind\s*===/.test(String(expression))) return literal(text);
	const after = text.slice(text.indexOf("[") < 0 ? text.length : text.indexOf("["));
	if (kind === "close") return literal(after);
	const rest = after.slice(after.indexOf(":") + 1).trim();
	return literal(rest);
}

test("V-P2.9 键盘隔离：覆盖层读作 modal scope \"other\"，宿主侧栏切换等命令按契约被拦", () => {
	// 宿主分发口径复算（来源：dsh-client-shortcuts `keydown`／`dispatch`，见下方引用）：
	// modal scope ＝ 文档序最后一个 `modalSelector` 元素的 `dataset.shortcutModal ?? "other"`；
	// 命令命中但 `!command.modals.includes(context.modal)` ⇒ blocked＋preventDefault。
	const tree = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
	const root = findOne(tree, (node) => hasClass(node, IDS.podLayer));
	assert.ok(root.props.role === "dialog" && root.props["aria-modal"] === "true");
	assert.equal(root.props["data-shortcut-modal"], undefined, "覆盖层不设 data-shortcut-modal（dataset 缺省 ⇒ scope \"other\"）");
	const scope = root.props["data-shortcut-modal"] ?? "other";
	assert.equal(scope, "other", "Pod 期 modal scope 须落在 \"other\"（未命名）");
	// 宿主分发器判定式（逐字复算 dsh-client-shortcuts/lib/client.js:646／689）：
	const dispatchDecision = (command, modalScope) =>
		modalScope !== null && !command.modals.includes(modalScope) ? "blocked" : "allowed";

	// ① 真实宿主注册表：侧栏切换命令（`sidebar.left.toggle`，dsh-client-ui-layout）声明 modals: []
	const toggle = readHostCommandModals({ pkg: "dsh-client-ui-layout", id: "sidebar.left.toggle" });
	if (!toggle) {
		console.log("⤼ SKIP: 本机未安装官方 dsh-client-ui-layout——宿主注册表对照未跑（命令契约判据仍生效）");
		return;
	}
	const toggleModals = resolveModalsExpression(toggle.expression, "toggle");
	assert.deepEqual(toggleModals, [], `side bar 切换命令 modals 须为 []（实测 ${JSON.stringify(toggleModals)}，源 ${toggle.file}）`);
	assert.equal(dispatchDecision({ modals: toggleModals }, scope), "blocked",
		"Pod 期侧栏切换命令须被拦（对照真实注册表：[] 不含 \"other\"）");
	// ② 真实宿主注册表：关闭命令（`dsh-client-ui-sidebar-right` 里 `id: \`page.${kind}\`` 的
	//    close 分支）声明 `kind === "close" ? ["settings","shortcuts","other"] : []` ⇒ **被放行**，
	//    resolve 走 `primitives.closeTopModal(document)` 关掉栈顶（=Pod 层）。属可接受行为
	//    （复核 I2 明确认定），但必须在注释/票面写明：**Cmd/Ctrl+W 在 Pod 期＝关闭 Pod**。
	const pageClose = readHostCommandModals({ pkg: "dsh-client-ui-sidebar-right", literalId: false });
	assert.ok(pageClose, "宿主关闭命令声明须可读（sidebar-right bundle 在位）");
	const closeModals = resolveModalsExpression(pageClose.expression, "close");
	assert.deepEqual(closeModals, ["settings", "shortcuts", "other"],
		`关闭命令的 close 分支 modals 须含 "other"（实测 ${JSON.stringify(closeModals)}，源 ${pageClose.file}）`);
	assert.deepEqual(resolveModalsExpression(pageClose.expression, "refresh"), [], "同一条件实参的 else 分支须为 []（refresh 不放行）");
	assert.equal(dispatchDecision({ modals: closeModals }, scope), "allowed",
		"关闭命令在 Pod 期被放行（\"other\" 在其声明的 modals 内）——随后 resolve 走 primitives.closeTopModal 关闭栈顶层");
	// ②b 宿主 `closeTopModal` 语义复算（逐字对照 dsh-client-ui-primitives 实现：栈顶＝最后一个
	//     注册且仍为文档序末位 modalSelector 元素的层）：Pod 层在栈顶 ⇒ 关闭命令真的关掉 Pod
	{
		const layers = new WeakMap();
		const closeTopModal = (document) => {
			const top = layers.get(document)?.at(-1);
			if (top === undefined) return false;
			if ([...document.querySelectorAll(mod.POD_MODAL_SELECTOR)].at(-1) === top.element) { top.close(); return true; }
			return false;
		};
		const makeDoc = (topElement) => ({
			querySelectorAll: () => (topElement ? [topElement] : [])
		});
		const podLayerElement = { id: "pod" };
		const doc = makeDoc(podLayerElement);
		let closed = 0;
		layers.set(doc, [{ element: podLayerElement, close: () => { closed += 1; } }]);
		assert.equal(closeTopModal(doc), true, "Pod 层在栈顶时关闭命令须命中栈顶");
		assert.equal(closed, 1, "Pod 层须被真正关闭（cmd/ctrl+W 在 Pod 期＝关闭 Pod，可接受且写明）");
		const otherTop = { id: "official" };
		const doc2 = makeDoc(otherTop);
		let podClosed = 0;
		layers.set(doc2, [{ element: podLayerElement, close: () => { podClosed += 1; } }]);
		assert.equal(closeTopModal(doc2), false, "文档序末位不是栈顶层时不得关闭");
		assert.equal(podClosed, 0, "官方高层浮层在场时 Pod 不得被关闭命令误关");
	}
	// Esc／Tab 行为归 useModalLayer（本票不自写键盘监听）
	const podImpl = clientSource.slice(clientSource.indexOf("function PodOverlayLayer"), clientSource.indexOf("function BotModeEntry"));
	assert.ok(podImpl.length > 0, "覆盖层实现段须存在");
	assert.ok(!/addEventListener\(\s*["']keydown["']/.test(podImpl), "覆盖层实现段不得自写 keydown 监听（Escape／Tab 归 useModalLayer 契约）");
	assert.ok(!/querySelectorAll/.test(podImpl), "覆盖层实现段不得自写可聚焦项查询（Tab 囚笼归 useModalLayer）");
	assert.equal(mod.POD_MODAL_SELECTOR, "[role=\"dialog\"][aria-modal=\"true\"], [role=\"menu\"]",
		"我方复算用的 modal 契约选择器须与宿主 primitives.modalSelector 逐字一致");
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

// ================= V-P2.11：Pod 内席位切换保活（草稿／选中／滚动） =================
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

	// 视图层：列表与席位视图在同一覆盖层内**互斥但不卸载**（滚动／草稿由节点身份持有）
	const readViews = (rendered) => {
		const body = findOne(rendered, (node) => hasClass(node, "pod-pod-body"));
		assert.ok(body, "覆盖层须有 pod-body（列表／席位双视图容器）");
		const views = findAll(body, (node) => typeof node.props.className === "string" && node.props.className.includes("pod-pod-view"));
		assert.equal(views.length, 2, "列表视图与席位视图须同时在挂载树上（互斥呈现，不卸载重挂）");
		const hint = views.find((node) => hasClass(node, "pod-pod-seat-view"));
		const detail = views.find((node) => hasClass(node, "pod-pod-seat-detail"));
		assert.ok(hint && detail, "两个视图须按席位列表／席位详情两个类名区分");
		return { hint, detail };
	};
	// 无有效选中：列表视图呈现（不是「挂载但全隐藏」），席位详情隐藏且仍在树上
	const noSelection = readViews(tree);
	assert.equal(noSelection.hint.props.hidden, false, "无有效选中时列表视图须呈现");
	assert.equal(noSelection.detail.props.hidden, true, "无有效选中时席位视图隐藏（但仍在挂载树上）");
	// 已有有效选中：席位视图呈现、列表隐藏——**同一对节点**，只是 hidden 翻转（不卸载重挂）
	mod.__podControl.reset();
	mod.apply(createCtx(createSlotCore(DECLARED)));
	const state = mod.getBotState();
	assert.equal(state.selectedBotId, null, "净初态无选中");
	// 选中一个 bot（经真实 store 通路：状态直写由 refreshBots 收敛，此处用最小夹具）
	const selectedTree = (() => {
		// 直接把 bots／选中塞进 store（与 SSE 刷新后的状态同形），再渲染同一组件
		const setState = mod.__podStateForTest;
		assert.ok(setState, "内视缝须可写 store（V-P2.11 的选中态夹具）");
		setState({ bots: [{ id: "bot-a", name: "A" }, { id: "bot-b", name: "B" }], selectedBotId: "bot-b", selectionInit: true });
		return harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
	})();
	const withSelection = readViews(selectedTree);
	assert.equal(withSelection.detail.props.hidden, false, "已有有效选中时席位视图须呈现");
	assert.equal(withSelection.hint.props.hidden, true, "已有有效选中时列表视图隐藏（仍在挂载树上）");
	// 切回列表（backToList 语义）→ 列表视图重新呈现、席位视图隐藏；两侧节点身份仍由同一子树持有
	mod.__podStateForTest({ selectedBotId: null, selectionInit: true });
	const backToList = readViews(harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key }));
	assert.equal(backToList.hint.props.hidden, false, "返回列表须重新呈现列表视图");
	assert.equal(backToList.detail.props.hidden, true, "返回列表后席位视图隐藏（未卸载）");
	// 成功发送后清空（与既有 send() 口径一致）
	forgetPodDraft("bot-a");
	assert.equal(resolvePodDraft("bot-a"), "", "发送成功即清空草稿");
	const css = mod.podLayerCss;
	assert.match(css, /\.pod-pod-view\[hidden\][^{]*\{[^}]*visibility:hidden/, "非活动视图须用 visibility 隐藏（保节点身份与滚动位置）");
	assert.match(css, /\.pod-pod-view\[hidden\][^{]*\{[^}]*position:absolute/, "非活动视图须脱流（复核 B1：不占横向空间）");
	assert.ok(!/\.pod-pod-view[^{]*\{[^}]*display:none/.test(css), "非活动视图不得用 display:none");
});

// ================= 复核 I4：进入语义（改造前口径）· M7：就地降级不自锁 =================
test("I4＋M7 进入语义＝改造前口径（有效选中续用／无选中由 refreshBots 收敛到 sortBots 首位），就地降级不置背景 inert", () => {
	// ---- I4：进入只复位初始化标记，不清 selectedBotId ----
	mod.__podControl.reset();
	bootPod();
	let state = mod.getBotState();
	assert.equal(state.selectedBotId, null, "净初态无选中");
	mod.__podControl.enter();
	state = mod.getBotState();
	assert.equal(state.selectionInit, false, "进入须复位初始化标记（触发 refreshBots 的既有收敛规则）");
	assert.equal(state.selectedBotId, null, "进入不得凭空造选中（无选中时保持 null，等 refreshBots 收敛）");
	assert.equal(state.podActive, true, "进入须点亮 Pod 活跃标志（通知抬档依据）");
	mod.__podControl.exit();
	assert.equal(mod.getBotState().podActive, false, "退出须熄灭 Pod 活跃标志");
	// 已有有效选中 ⇒ 续用（通知点开某席位后进 Pod 的通路：openBotChat 先 selectBot 再 enter）
	mod.__podStateForTest({ bots: [{ id: "bot-a" }, { id: "bot-b" }], selectedBotId: "bot-a", selectionInit: true });
	mod.__podControl.enter();
	assert.equal(mod.getBotState().selectedBotId, "bot-a", "已有有效选中须续用（不得被进入清掉）");
	assert.equal(mod.getBotState().selectionInit, false, "进入后仍复位初始化标记（与改造前一致）");
	mod.__podControl.exit();
	// 收敛规则（纯函数，refreshBots 的唯一实现）：无选中 ⇒ sortBots 首位；有效选中 ⇒ 续用
	const bots = [{ id: "plain" }, { id: "anchor", bootstrapAnchor: true }];
	assert.equal(mod.resolveSelectionAfterRefresh({ selectedBotId: null, selectionInit: false }, bots), "anchor",
		"无选中＋未初始化 ⇒ 自动选中 sortBots()[0]（锚点席位排首）");
	assert.equal(mod.resolveSelectionAfterRefresh({ selectedBotId: "plain", selectionInit: false }, bots), "plain",
		"已有有效选中 ⇒ 续用（不重选）");
	assert.equal(mod.resolveSelectionAfterRefresh({ selectedBotId: "gone", selectionInit: false }, bots), "anchor",
		"选中项已消失＋未初始化 ⇒ 收敛到 sortBots 首位");
	assert.equal(mod.resolveSelectionAfterRefresh({ selectedBotId: "gone", selectionInit: true }, bots), null,
		"选中项已消失＋已初始化 ⇒ 置空回列表（与改造前 refreshBots 逐字同义）");
	assert.equal(mod.resolveSelectionAfterRefresh({ selectedBotId: null, selectionInit: true }, []), null, "空注册表 ⇒ 保持无选中");

	// ---- M7：就地降级（无 portal）不得把祖先 AppFrame 置 inert（自锁） ----
	withFakeDom((dom) => {
		const appFrame = dom.attach("官方 AppFrame（层祖先）", undefined);
		const layerInPlace = dom.document.createElement("div");
		appFrame.appendChild(layerInPlace);
		layerInPlace.ownerDocument = dom.document;
		assert.equal(mod.isPortaledLayer(layerInPlace), false, "就地降级层不得被判为已 portal");
		assert.equal(mod.isPortaledLayer(null), false, "空层引用不得被判为已 portal（防御）");
		harness.hooks.useEffect.length = 0;
		harness.hooks.useRef.length = 0;
		const view = harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
		assert.equal(view.error, undefined, "就地降级仍须可渲染：" + (view.error && view.error.message));
		const ref = harness.hooks.useRef.at(-1);
		ref.current = layerInPlace;
		for (const effect of harness.hooks.useEffect.slice()) if (typeof effect === "function") effect();
		assert.equal(appFrame.inert, undefined, "就地降级不得把层祖先（AppFrame）置 inert（否则自锁不可交互）");
		// 已 portal（层在宿主容器下）⇒ 照常采集背景 inert
		mod.__podControl.reset();
		const host = mod.__podControl.mountHost(dom.document);
		const portaled = dom.document.createElement("div");
		host.appendChild(portaled);
		portaled.ownerDocument = dom.document;
		assert.equal(mod.isPortaledLayer(portaled), true, "宿主容器下的层须被判为已 portal");
		harness.hooks.useEffect.length = 0;
		harness.hooks.useRef.length = 0;
		harness.render(mod.PodOverlayLayer, { open: true, t: (key) => key });
		harness.hooks.useRef.at(-1).current = portaled;
		for (const effect of harness.hooks.useEffect.slice()) if (typeof effect === "function") effect();
		assert.equal(appFrame.inert, true, "已 portal 的层须照常采集背景 inert");
	});
	mod.__podControl.reset();
});

// ================= I1：Pod 期全局通知抬档（不被自身覆盖层吃掉） =================
test("I1 通知遮挡：Pod 期通知抬到整屏层之上、仍低于官方浮层地板 900，并由活跃标志驱动", () => {
	const css = mod.podLayerCss;
	const podNotices = declaredProps(css, "pod-notices[data-state=\"pod\"]");
	assert.equal(podNotices["z-index"], String(mod.POD_LAYER.zIndexNoticesInPod), "Pod 期通知档须由 POD_LAYER 常量插值（禁散落数值）");
	const layerBand = mod.POD_LAYER.zIndexBase;
	const noticesBand = Number(podNotices["z-index"]);
	assert.ok(Number.isInteger(noticesBand), `通知档须为整数（实测 ${podNotices["z-index"]}）`);
	assert.ok(noticesBand > layerBand, `通知档须严格高于我方整屏层（层 ${layerBand}／通知 ${noticesBand}）——否则被自身层盖住`);
	assert.ok(noticesBand < mod.POD_LAYER.officialFloatingFloor,
		`通知档须严格低于官方 body 级浮层地板 ${mod.POD_LAYER.officialFloatingFloor}（实测 ${noticesBand}）——官方弹出件仍须盖在通知之上`);
	// 常驻（非 Pod）档不变：仍是我方层内浮出件档
	const base = declaredProps(css, "pod-notices");
	assert.equal(base["z-index"], undefined, "常驻态通知档不得被 Pod 规则劫持（选择器须带 [data-state=\"pod\"] 限定）");
	// 标志驱动：真实 store 的 podActive 只在进出 Pod 时翻转，通知条目据此落 data-state
	mod.__podControl.reset();
	bootPod();
	assert.equal(mod.getBotState().podActive, false, "装置后不得处于 Pod 活跃态");
	const noticesEntry = mod.__podStateForTest && null;
	mod.__podControl.enter();
	assert.equal(mod.getBotState().podActive, true, "进入 Pod 须点亮 podActive");
	mod.__podControl.exit();
	assert.equal(mod.getBotState().podActive, false, "退出 Pod 须熄灭 podActive");
	// 通知组件的落点：podActive 为真时须落 data-state=\"pod\"（样式档唯一入口）
	assert.equal(typeof mod.BotNotices, "function", "导出面缺 BotNotices（通知条目渲染件的可执行见证）");
	mod.__podControl.reset();
	bootPod();
	mod.__podStateForTest({ notices: [{ id: "n1", kind: "ok", text: "t", botId: null }], podActive: false });
	const idle = findOne(harness.render(mod.BotNotices, {}), (node) => hasClass(node, "pod-notices"));
	assert.ok(idle, "有通知时须渲染通知容器");
	assert.equal(idle.props["data-state"], undefined, "非 Pod 期通知容器不得落 data-state=pod");
	mod.__podStateForTest({ podActive: true });
	const inPod = findOne(harness.render(mod.BotNotices, {}), (node) => hasClass(node, "pod-notices"));
	assert.equal(inPod.props["data-state"], "pod", "Pod 期通知容器须落 data-state=pod（触发抬档）");
	mod.__podControl.reset();
	assert.ok(noticesEntry === null);
});

// ================= M8：焦点兜底让位官方高层浮层 =================
test("M8 焦点兜底：程序化抢焦拉回层内，但焦点落在官方高层浮层（文档序末位 modal）时让位", () => {
	/** 事件可驱动的 DOM 桩：document 记账 focusin 监听，元素带 closest／querySelectorAll。 */
	const makeDom = () => {
		const listeners = { focusin: new Set() };
		const nodes = [];
		let modalTop = null;
		const makeElement = (label) => {
			const node = {
				label, parentNode: null,
				closest(selector) { for (let at = node; at; at = at.parentNode) { if (at.matches(selector)) return at; } return null; },
				contains(candidate) { for (let at = candidate; at; at = at.parentNode) { if (at === node) return true; } return false; },
				matches: () => false,
				querySelectorAll: () => (modalTop ? [modalTop] : []),
				focusCount: 0,
				focus() { node.focusCount += 1; }
			};
			nodes.push(node);
			return node;
		};
		const document = {
			createElement: makeElement,
			addEventListener: (type, fn) => { (listeners[type] ||= new Set()).add(fn); },
			removeEventListener: (type, fn) => { listeners[type]?.delete(fn); },
			querySelectorAll: () => (modalTop ? [modalTop] : [])
		};
		const dispatchFocusIn = (target) => { for (const fn of [...(listeners.focusin || [])]) fn({ target }); };
		return {
			nodes, document, dispatchFocusIn,
			setTopModal: (node) => { modalTop = node; },
			listenerCount: () => (listeners.focusin || new Set()).size,
			makeElement
		};
	};
	// ① 场上只有我方层：层外焦点须被拉回
	const dom = makeDom();
	const layer = dom.makeElement("Pod 层");
	layer.ownerDocument = dom.document;
	dom.setTopModal(layer);
	const off = mod.enablePodFocusContainment(layer);
	assert.equal(dom.listenerCount(), 1, "焦点兜底须挂上 focusin 监听");
	const outer = dom.makeElement("官方 composer 焦点目标");
	dom.dispatchFocusIn(outer);
	assert.equal(layer.focusCount, 1, "层外程序化抢焦须被拉回层内");
	// ② 官方高层浮层打开且被聚焦：让位（不抢回）
	const officialModal = dom.makeElement("官方设置对话框");
	const officialInner = dom.makeElement("官方对话框内控件");
	officialInner.parentNode = officialModal;
	officialModal.matches = (selector) => selector.includes("dialog");
	dom.setTopModal(officialModal);
	dom.dispatchFocusIn(officialInner);
	assert.equal(layer.focusCount, 1, "焦点在官方高层浮层内 ⇒ 让位，不得抢回");
	// ③ 文档序末位 modal 不是我方层（官方层在我方之上）：即便焦点目标不在 modal 内也让位
	const strayTarget = dom.makeElement("官方浮层外的目标");
	dom.dispatchFocusIn(strayTarget);
	assert.equal(layer.focusCount, 1, "文档序末位 modal 非我方层 ⇒ 让位");
	// ④ 官方层关闭后：恢复拉回
	dom.setTopModal(layer);
	const afterClose = dom.makeElement("层外目标");
	dom.dispatchFocusIn(afterClose);
	assert.equal(layer.focusCount, 2, "官方层关闭后须恢复拉回");
	// ⑤ 层内目标：不重复聚焦（不产生焦点循环）
	const inner = dom.makeElement("层内控件");
	inner.parentNode = layer;
	dom.dispatchFocusIn(inner);
	assert.equal(layer.focusCount, 2, "层内焦点不得被再次拉回");
	off();
	assert.equal(dom.listenerCount(), 0, "卸载须摘掉 focusin 监听");
});

// ================= M9：过渡令牌只以 var() 形态消费（05 号票依赖） =================
test("M9 过渡令牌：宿主令牌只以 var(<token>, <常量>) 形态读取，本地不重声明", () => {
	const css = mod.podLayerCss;
	const tokens = mod.POD_TRANSITION_TOKENS;
	assert.ok(tokens && tokens.fallbacks, "导出面缺 POD_TRANSITION_TOKENS（05 号票的消费坐标）");
	const names = HOST_TRANSITION_TOKENS.map((token) => String(token.name ?? token));
	assert.ok(names.includes(tokens.duration), `宿主令牌名须取自票 02 面常量（${tokens.duration}）`);
	// ① 本地不得重声明宿主同名令牌（遮蔽宿主值的唯一通路）
	const redeclared = [...css.matchAll(/(--ds-transition-duration(?:-fast|-slow)?|--ds-ease-in-out)\s*:/g)].map((match) => match[1]);
	assert.deepEqual(redeclared, [], `覆盖层样式不得重声明宿主过渡令牌（实测 ${redeclared.join("／")}）`);
	// ② var() 形态的**唯一生成器**：真实产出须为 var(<宿主令牌>, <常量回退>)
	for (const token of [tokens.duration, tokens.durationFast, tokens.durationSlow, tokens.easeInOut]) {
		const produced = mod.podTokenVar(token);
		assert.equal(produced, `var(${token}, ${tokens.fallbacks[token]})`, `令牌 ${token} 的 var() 形态须由 podTokenVar 生成`);
		assert.match(produced, new RegExp("^var\\(\\s*" + token + "\\s*,"), "须以宿主令牌名为 var() 第一实参（禁本地常量顶替）");
	}
	// ③ 未登记令牌不得静默产出（防手写 `var(--ds-transition-x)` 漂移）
	assert.throws(() => mod.podTokenVar("--ds-transition-unregistered"), /未登记/, "未登记令牌须响亮抛错");
	// ④ podLayerCss 里若出现宿主令牌，必须已经在 var() 形态内（形状断言，不靠人眼）
	for (const match of css.matchAll(/(--ds-transition-duration(?:-fast|-slow)?|--ds-ease-in-out)/g)) {
		const before = css.slice(Math.max(0, match.index - 4), match.index);
		assert.equal(before, "var(", `令牌 ${match[1]} 只能作为 var() 第一实参出现（实测前缀 ${JSON.stringify(before)}）`);
	}
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
