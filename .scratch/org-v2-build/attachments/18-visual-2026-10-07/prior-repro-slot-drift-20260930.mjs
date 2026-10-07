/**
 * 复现（诊断用，非正式测试）：dsh-bots「Bot 模式」入口点击后主区不切换。
 *
 * 机制假设：宿主 0.2.0-rc.1 的 layout root 槽树已无 `conversation` 槽
 * （原生会话改为 keyed 槽 `main` 的保留键 `conversation`），而插件 client
 * 仍按 `{name:"conversation"}` 注册 → 真实 SlotCore 抛「未声明」，
 * enter() 在 sidebar 已占用后才失败。
 *
 * 本脚本用运行中宿主安装的真实 SlotCore（非 mock）驱动真实插件 client
 * bundle，声明与宿主一致的槽树，然后模拟点击入口。
 */
import { pathToFileURL } from "node:url";
import { SlotCore } from "/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/index.js";

const CLIENT_BUNDLE = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "/home/beijong/.dsh/plugins/dsh-bots/lib/client.js";

// ---------- DOM / window 桩（client.js 顶层走 __ModuleLoader__ 协议） ----------
const el = () => ({ style: { setProperty() {} }, dataset: {}, setAttribute() {}, remove() {}, appendChild() {}, textContent: "" });
globalThis.window = { innerWidth: 1400, innerHeight: 900, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.EventSource = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} close() {} };
globalThis.EventSource.CLOSED = 2;
globalThis.document = {
  createElement: el, documentElement: { style: { setProperty() {} }, dataset: {} },
  body: { style: el().style, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, removeChild() {} },
  head: { appendChild() {} }, addEventListener() {}, removeEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, title: ""
};

// ---------- react / primitives 桩 ----------
const h = (type, props, ...children) => ({ type, props: props ?? {}, children });
const reactStub = new Proxy({
  createElement: h,
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useEffect: () => {}, useMemo: (fn) => fn(), useRef: (v) => ({ current: v }),
  useCallback: (fn) => fn,
  useLayoutEffect: () => {}, useSyncExternalStore: (_s, get) => get(), useId: () => "id",
  memo: (component) => component, forwardRef: (component) => component,
  Fragment: Symbol("Fragment")
}, { get: (target, key) => (key in target ? target[key] : () => null) });
const primitivesStub = new Proxy({}, { get: (_t, key) => (props) => h("icon:" + String(key), props) });
const requireShim = (id) => {
  if (id === "react") return reactStub;
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitivesStub;
  return {};
};

// ---------- 真实 SlotCore：按宿主 layout/sidebar/conversation 的真实声明建树 ----------
const core = new SlotCore();
const LEGACY_HOST = process.argv.includes("--legacy-host");
// 旧宿主（dsh-client-ui-layout 0.1.0-rc.6，已从 npm 缓存取证）root 槽树：
// sidebar single／conversation single(session-maybe)／details single／shell.overlay list。
// 新宿主（0.2.0-rc.1，本机运行版）把 conversation 单槽改为 keyed 槽 main 的保留键。
const ROOT_CHILDREN = LEGACY_HOST
  ? {
      sidebar: { kind: "single", scope: "root" },
      conversation: { kind: "single", scope: "session-maybe" },
      details: { kind: "single", scope: "session" },
      "shell.overlay": { kind: "list", scope: "root" }
    }
  : {
      sidebar: { kind: "single", scope: "root" },
      main: { kind: "keyed", scope: "root" },
      rightbar: { kind: "single", scope: "root" },
      "shell.overlay": { kind: "list", scope: "root" },
      "shell.leading": { kind: "single", scope: "root" }
    };
core.register({ name: "root", children: ROOT_CHILDREN }, () => h("root"));
core.register({ name: "sidebar", children: { "sidebar.footer.action": { kind: "list", scope: "root" } } }, () => h("native-sidebar"));
if (LEGACY_HOST) {
  core.register({ name: "conversation", children: {} }, () => h("native-conversation"));
} else {
  core.register({ name: "main", key: "conversation", children: { "main.conversation": { kind: "single", scope: "session-maybe" } } }, () => h("native-conversation"));
}

// ---------- 真实插件 bundle：捕获 __ModuleLoader__.load ----------
let captured = null;
globalThis.window.__ModuleLoader__ = { load: (opts) => { captured = opts; } };
await import(pathToFileURL(CLIENT_BUNDLE).href + "?v=" + Date.now());
if (!captured) throw new Error("bundle 未走 __ModuleLoader__ 装载协议");

const exportsOfPlugin = captured.factory(requireShim);

// ---------- ctx（slots 走真实 SlotCore；inject 语义按宿主 SlotsService 简化） ----------
const NOOP = () => {};
function makeCtx() {
  return {
    effect: (fn) => { const d = fn(); return typeof d === "function" ? d : NOOP; },
    locale: {
      register: () => NOOP,
      bind: () => (key) => key,
      setLocale: () => {}, getLocale: () => ({ active: "zh" })
    },
    layout: { closeDetails: () => {}, toggleSidebar: () => {} },
    slots: {
      register: (opts, component) => core.register(opts, component),
      inject: (key, callback) => {
        let active = null;
        const reconcile = () => {
          if (active !== null) { active(); active = null; }
          if (core.specDynamic(key) === undefined) return;
          active = callback() ?? null;
        };
        const unsub = core.subscribeDeclaration(key, reconcile);
        reconcile();
        return () => { unsub(); if (active) active(); };
      },
      entriesOfSlot: (key) => core.entriesOfSlot(key)
    }
  };
}

exportsOfPlugin.apply(makeCtx());

// ---------- 模拟点击入口：从真实注册表取入口组件、渲染、取其 onClick ----------
const entry = core.entriesOfSlot("sidebar.footer.action")[0];
if (!entry) throw new Error("入口未注册（sidebar.footer.action 无占用者）");
const tree = entry.component({ wide: true, t: (k) => k });
const walk = (node) => {
  if (!node || typeof node !== "object") return null;
  if (node.props && typeof node.props.onClick === "function") return node;
  for (const child of [].concat(node.children ?? [])) {
    const found = walk(child);
    if (found) return found;
  }
  return null;
};
const button = walk(tree);
if (!button) throw new Error("入口组件树里找不到可点击按钮");

console.log("入口按钮 aria-label =", JSON.stringify(button.props["aria-label"]));
let thrown = null;
try { button.props.onClick(); } catch (error) { thrown = error; }

const sidebarOccupant = core.entriesOfSlot("sidebar").map((e) => e.options.id ?? e.options.key ?? "(无 id)");
const mainOccupants = core.entriesOfSlot(LEGACY_HOST ? "conversation" : "main").map((e) => e.options.key ?? e.options.id);
console.log("宿主形态 =", LEGACY_HOST ? "旧（conversation 单槽，0.1.0-rc.6）" : "新（main keyed＋保留键 conversation，0.2.0-rc.1）");
console.log("点击后 sidebar 占用者 =", JSON.stringify(sidebarOccupant));
console.log("点击后会话槽占用者 =", JSON.stringify(mainOccupants));
console.log("点击是否抛错 =", thrown ? `是：${thrown.message}` : "否");
process.exitCode = thrown ? 0 : 1;
