#!/usr/bin/env node
/**
 * 宿主契约探针脚本（org-v2 01 号票；规格 §H「探针挂载点」与附录 A V-A6.3–V-A6.6）。
 *
 * preflight **第 4 道门**（插在冻结面门之后；由 scripts/preflight.mjs 以子进程
 * 拉起），独立脚本、**不并入测试套件**——测试入口无跳过通道、既有纪律是不把
 * 套件耦合到宿主安装状态，而探针必须知道宿主在不在。分工：探针管「宿主面在
 * 不在、形状对不对」（跨版本、可跳过）；既有行为断言（tests/）管「仍在时的
 * 行为对不对」——互补不替代。
 *
 * 三态语义（V-A6.3）：
 *   - PASS：探针真实触达宿主面并断言形状成立；
 *   - FAIL：触达了宿主面但形状不符（或登记表/门自身失配）；
 *   - SKIP：本机探测不到该面的载体（如未安装宿主、无会话日志）——**分列计数
 *     且可见**（打印原因与探测坐标），汇总行形如 `N PASS / M FAIL / K SKIP`。
 *   仅「本机未安装该宿主」的开发机/CI 场景允许 SKIP 且不阻断；**bot 运行面与
 *     部署面上 SKIP 视同 FAIL**（--face=deploy 或 DSH_BOTS_PROBE_FACE=deploy）。
 *
 * 版本探测仅作诊断字段（V-A6.4）：报告头部打印宿主版本号以便归因，**不参与
 * 任何 PASS/FAIL 判定**——门只由行为/形状断言把守。
 *
 * 登记表对账：非 C 类面必须在 lib/host-faces.js 登记；已登记且未标 pending 的
 * 探针必须在本脚本有实现（登记表↔门双向漂移守卫，缺失即 FAIL）。pending 面
 * 单独列出、不计入三态——**当前 pending 已清零**（v2 台账两面随 05 号票接线，
 * 探针 P-V2-LEDGER-FORMAT／P-LEDGER-COMMANDS 落地后即常驻三态）。
 *
 * 用法：node scripts/host-contract-probe.mjs [--face=dev|deploy] [--report <file>]
 * 退出码：0＝门通过；1＝FAIL（或部署面 SKIP）；2＝门自身错误。
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { HOST_FACES } from "../lib/host-faces.js";
import { profileIdFromBaseUrl } from "../lib/host-services.js";
import { createNativeSessionRpc } from "../lib/native-session-rpc.js";
import { createRequire } from "node:module";
import { createTaskLedger, eventsFile, validateEventRecord } from "../lib/org/task-ledger.js";
import { deriveStats, readSessionEventsFromFile } from "../lib/stats.js";

// CJS 共享层（仓库惯例经 createRequire 消费，见 lib/index.js）：patch 构造单一坐标
const requireCjs = createRequire(import.meta.url);
const { buildPatchYaml } = requireCjs("../lib/shared.cjs");

// 台账写探针的简报夹具（07 号票契约：简报入事实源必校验——探针夹具用合法件）
const PROBE_BRIEF = Object.freeze({
  goal: "格式探针",
  deliverables: [{ format: "ledger-events", location: "bots/ledger/events.jsonl" }],
  sources: [{ tool: "ledger.read", ref: "bots/ledger/events.jsonl" }],
  boundaries: "只读探针，不改真实运行面",
  acceptance: [{ probe: "fs.contains", args: { location: "bots/ledger/events.jsonl", text: "intake" } }],
  reviewPoints: []
});

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

// ---------------- 宿主安装发现（只读） ----------------

/** 宿主 @deepseek-ai/* 包解析根（先后＝优先级；profiles 侧含 client 全家）。 */
export function discoverPackageRoots() {
  return [
    join(homedir(), ".dsh", "profiles", "node_modules", "@deepseek-ai"),
    "/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai"
  ].filter((root) => existsSync(root));
}

/** 宿主 web 前端产物（Vite shell——client 种子模块的提供面）。 */
export function discoverWebFrontendAssets() {
  return discoverPackageRoots()
    .map((root) => join(root, "dsh-web-frontend", "dist", "assets"))
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => join(dir, f)));
}

/** dsh CLI 包目录（bin 所在）。 */
export function discoverDshCliDirs() {
  return [
    join(homedir(), ".dsh", "profiles", "node_modules", "@deepseek-ai", "dsh"),
    "/usr/lib/node_modules/@deepseek-ai/dsh"
  ].filter((dir) => existsSync(join(dir, "lib", "bin.js")));
}

/** 宿主版本（仅诊断字段，不作门）。任一安装根的 dsh 包 package.json version。 */
export function readHostVersionDiagnostic(cliDirs) {
  for (const dir of cliDirs) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (typeof pkg.version === "string") return pkg.version;
    } catch { /* 下一个候选 */ }
  }
  return null;
}

/** 在候选文件列表中找首个包含 needle 的文件（返回该文件或 null）。 */
export function findMarkerFile(files, needle) {
  for (const file of files) {
    try {
      if (readFileSync(file, "utf8").includes(needle)) return file;
    } catch { /* 候选缺失/不可读 → 换下一个 */ }
  }
  return null;
}

function libFiles(roots, pkg, subdirs = ["lib"]) {
  const out = [];
  for (const root of roots) {
    for (const sub of subdirs) {
      const dir = join(root, pkg, sub);
      if (!existsSync(dir)) continue;
      try {
        for (const name of readdirSync(dir)) {
          if (name.endsWith(".js") || name.endsWith(".yml") || name.endsWith(".d.ts")) {
            out.push(join(dir, name));
          }
        }
      } catch { /* 不可读 → 跳过 */ }
    }
  }
  return out;
}

/** 候选文件解析：roots 下按相对段映射、只留在盘者（优先级＝roots 序）。 */
function resolveCandidates(roots, ...segments) {
  return roots.map((root) => join(root, ...segments)).filter(existsSync);
}

/** 「本机未安装宿主」SKIP（合法跳过面的唯一形状；坐标按该探针的发现面区分）。 */
const noHostSkip = (coordinate = "discoverPackageRoots") =>
  ({ state: "SKIP", reason: "本机未安装宿主", coordinate });

// ---------------- client bundle 行为化调起 harness（org-v2 18 号票） ----------------

/** 探针失败原因的统一消息化（catch 块复用）。 */
const errMsg = (error) => (error instanceof Error ? error.message : String(error));

/**
 * 无头执行域：保存并替换 globalThis.window/document（官方 client bundle 在
 * import 期注入 CSS、在 apply 期读写 DOM 与视口宽度），fn 结束后恢复。createElement
 * 产物逐个收入 elements（视觉面令牌断言的载体）。
 */
export async function withDomStubs(fn) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousGlobals = new Map();
  const stubGlobal = (name, value) => {
    previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  };
  const elements = [];
  const makeElement = (tag) => ({
    tag, style: { setProperty: () => {}, getPropertyValue: () => "" }, dataset: {},
    setAttribute: () => {}, remove: () => {}, textContent: "", name: "", appendChild: () => {}
  });
  globalThis.window = {
    innerWidth: 1400, innerHeight: 900, addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} })
  };
  globalThis.document = {
    createElement: (tag) => { const el = makeElement(tag); elements.push(el); return el; },
    documentElement: { style: { setProperty: () => {} }, dataset: {} },
    body: { style: makeElement("").style, dataset: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} }, appendChild: () => {}, removeChild: () => {} },
    head: { appendChild: () => {} },
    addEventListener: () => {}, removeEventListener: () => {},
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    title: ""
  };
  // 浏览器全局桩：真实 client bundle（官方与我方）在 apply 期会用到；只做形状，不驱动事件。
  stubGlobal("EventSource", class { constructor() {} addEventListener() {} removeEventListener() {} close() {} });
  stubGlobal("ResizeObserver", class { constructor() {} observe() {} unobserve() {} disconnect() {} });
  try {
    return await fn({ elements });
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    for (const [name, descriptor] of previousGlobals) {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  }
}

/**
 * 记录型 client ctx：P-CLIENT-LOCALE 先例的 mock ctx 升级版。register/inject/
 * subscribe/provide 全留痕；inject 回调立即实调（＝shell 惰性装载语义，官方
 * sidebar 包把 register 藏在 inject 回调里）；effect 实调（异常记入 record
 * 不中断 apply——单条 effect 异常不掩盖已完成的槽树声明）。
 */
export function makeRecordingClientCtx() {
  const record = [];
  const provided = {};
  const NOOP = () => () => {};
  const settingsHost = {
    subscribe: () => () => {},
    getSnapshot: () => ({ value: undefined, preference: "system", revision: 0, fontSize: 0 }),
    set: () => {}
  };
  const guarded = (op, name, fn) => {
    try { fn(); } catch (error) { record.push({ op: "effect-throw", where: op, name, msg: errMsg(error) }); }
  };
  const ctx = {
    record, provided,
    effect: (fn) => { guarded("effect", undefined, fn); return NOOP; },
    provide: (name, svc) => { provided[name] = svc; record.push({ op: "provide", name }); return NOOP; },
    reflect: { provide: (name, svc) => { provided[name] = svc; record.push({ op: "provide", name }); return NOOP; } },
    on: () => NOOP, emit: () => {},
    get: () => ({ getSnapshot: () => ({}), subscribe: () => () => {}, getTheme: () => ({}), panels: { getSnapshot: () => ({}) } }),
    locale: {
      register: () => NOOP, subscribe: () => () => {},
      bind: () => ({ getSnapshot: () => ({ value: undefined }), subscribe: () => () => {} }),
      setLocale: () => {}, getLocale: () => "en"
    },
    slots: {
      register: (opts) => { record.push({ op: "register", opts }); return NOOP; },
      inject: (name, factory) => { record.push({ op: "inject", name }); if (typeof factory === "function") guarded("inject", name, factory); return NOOP; },
      subscribe: (name) => { record.push({ op: "subscribe", name }); return NOOP; },
      entries: () => [], entriesOfSlot: () => [],
      provideRoot: (opts) => { record.push({ op: "provideRoot", opts }); return NOOP; },
      installLocale: () => {}
    },
    configForms: { get: () => settingsHost },
    settingsScope: { bind: () => settingsHost }
  };
  return ctx;
}

/**
 * 官方 client bundle 的 require shim（P-CLIENT-LOCALE 先例）：store 提供方按
 * 宿主版本二选一、响应式行为以最小真形状补齐（官方 layout/theme bundle 的
 * apply 期会真实 create/读写快照）；其余依赖给空实现。
 */
export function makeClientRequireShim(id) {
  if (id === "@deepseek-ai/dsh-client-store" || id === "@deepseek-ai/dsh-client-runtime/client") {
    return {
      defineStore: (def) => ({
        def,
        create() {
          const state = def.init();
          const actions = {};
          for (const [name, fn] of Object.entries(def.actions ?? {})) actions[name] = (...args) => fn(state, ...args);
          return { ...state, actions, getSnapshot: () => state, subscribe: () => () => {} };
        },
        getSnapshot() { return this.def.init(); },
        subscribe: () => () => {}
      }),
      createSnapshotStore: (def) => {
        const state = typeof def === "function" ? def() : (def?.init?.() ?? def ?? {});
        return { getSnapshot: () => state, subscribe: () => () => {}, set: () => {} };
      }
    };
  }
  return {};
}

/** 在 withDomStubs 域内捕获 __ModuleLoader__.load 的工厂注册（装载协议形状由调用方断言）。 */
async function importViaModuleLoader(file) {
  let captured = null;
  const previousLoader = globalThis.window.__ModuleLoader__;
  globalThis.window.__ModuleLoader__ = { load: (opts) => { captured = opts; } };
  try {
    // 带 cache-buster：同一进程内前序探针可能已 import 过同一 bundle，裸路径会命中
    // ESM 缓存而不重跑，捕获到的工厂留痕即变空（表现为假「未走装载协议」）。
    await import(pathToFileURL(file).href + `?dsh-probe=${Date.now()}-${captureNonce++}`);
  } finally {
    globalThis.window.__ModuleLoader__ = previousLoader;
  }
  return captured;
}

/** cache-buster 序号（同毫秒内多次装载仍各自唯一）。 */
let captureNonce = 0;

/**
 * 真实调起一个官方 client bundle：ModuleLoader 捕获 → factory(shim) →
 * apply(记录型 ctx)，返回 { record, provided, elements }。bundle 缺失、未走
 * 装载协议、缺 apply、apply 抛错都响亮抛错（由调用方转 FAIL）。
 */
export async function runClientBundle(roots, pkg) {
  const candidates = resolveCandidates(roots, pkg, "lib", "client.js");
  if (candidates.length === 0) {
    throw new Error(`官方 bundle ${pkg} 不在本机（${roots.join(" ; ") || "无包根"}）`);
  }
  return withDomStubs(async ({ elements }) => {
    const captured = await importViaModuleLoader(candidates[0]);
    if (!captured || typeof captured.factory !== "function") {
      throw new Error(`官方 bundle ${pkg} 未走 __ModuleLoader__.load 装载协议`);
    }
    const official = captured.factory(makeClientRequireShim);
    if (typeof official?.apply !== "function") {
      throw new Error(`官方 bundle ${pkg} 工厂产物未导出 apply`);
    }
    const ctx = makeRecordingClientCtx();
    await official.apply(ctx);
    return { record: ctx.record, provided: ctx.provided, elements };
  });
}

/**
 * Bot 模式必须命中的槽落点（`HF-CLIENT-SLOTS` 的消费面，覆盖「apply 期常驻」与「enter 期占用」两相）：
 *   - `sidebar.footer.action`（list）：入口钮 `dsh-bots-entry`（Bot 模式外可见）；
 *   - `shell.overlay`（list）：全局通知容器 `dsh-bots-notices`（V-A6.8 第 4 项的结构前置）；
 *   - `sidebar`（single）：Bot 模式接管 `dsh-bots-sidebar`；
 *   - `main`（keyed）：Bot 模式接管 `key="conversation"`。
 * 宿主把 `conversation` 改回独立单槽（旧宿主 0.1.0-rc.6 形态）也会在此报出——那是**宿主契约变更**，
 * 须同步改 `lib/client.js` 的 `HOST_SLOTS`，由本门把守，不许静默退回原生界面。
 */
export const BOT_MODE_SLOT_TARGETS = Object.freeze([
  { slot: "sidebar.footer.action", match: { field: "id", value: "dsh-bots-entry" }, phase: "apply" },
  { slot: "shell.overlay", match: { field: "id", value: "dsh-bots-notices" }, phase: "apply" },
  { slot: "sidebar", match: { field: "id", value: "dsh-bots-sidebar" }, phase: "enter" },
  { slot: "main", match: { field: "key", value: "conversation" }, phase: "enter" }
]);

/** 我方 client 调起用的 react 桩：模块级只用到 hooks 与 createElement（产物为可走查的普通对象）。 */
export function makeClientReactStub() {
  const h = (type, props, ...children) => ({ type, props: props ?? {}, children });
  const react = new Proxy({ createElement: h, memo: (component) => component, Fragment: Symbol("Fragment") }, {
    get: (target, key) => (key in target ? target[key] : () => null)
  });
  return { react, createElement: h };
}

/** 组件树走查：取第一个带 onClick 的节点（入口按钮；宿主 renderer 不会在门内渲染）。 */
function findClickable(node) {
  if (!node || typeof node !== "object") return null;
  if (node.props && typeof node.props.onClick === "function") return node;
  for (const child of [].concat(node.children ?? [])) {
    const hit = findClickable(child);
    if (hit) return hit;
  }
  return null;
}

/**
 * 我方 client 的**槽注册落地**复算（V-A6.8 门覆盖缺口收口；2026-10-07 返修批）：
 * 以真实（或夹具）SlotCore 承接 `ctx.slots`，实调我方 bundle 的 `apply`，
 * 再点入口走 `enter()`，**按相位**断言四处落点（2026-10-07 复审修正：此前四处一律在点击后
 * 查，相位盲——apply 期就把宿主 `sidebar`/`main` 占掉的坏形态也能通过）：
 *   - `phase:"apply"`（`sidebar.footer.action` 入口钮、`shell.overlay` 通知容器）：`apply` 后
 *     即须在位，且点击后仍在位；
 *   - `phase:"enter"`（`sidebar` 单槽占位、`main` keyed 槽的 `conversation` 键）：点击**之前
 *     不得占用**（留待 Bot 模式接管＝abdicate 语义），点击之后须在位。
 *
 * 诚实口径：**宿主实体件只有 `SlotCore`**（真实槽注册表，对未声明槽 fail closed）；我方 bundle
 * 是真实装载协议取到的工厂产物，但**整个 `ctx` 是手写桩**——locale／layout／effect 为空桩，
 * `slots.inject` 语义也由本函数复现（`specDynamic`＋`subscribeDeclaration` 声明订阅），
 * **不是**宿主 renderer 的 `declarationEpoch` 语义；react／primitives 亦为桩。
 * 故本函数证明的是「槽注册落点与调用不抛」，不是渲染结果（渲染语义归 V-A6.8 人工目视清单）。
 *
 * @returns `{ ok, violations, observations }`——本函数不抛，三态由调用方定。
 */
export async function verifyClientSlotRegistrations({ core, apply, createElement, targets = BOT_MODE_SLOT_TARGETS, entrySlot = "sidebar.footer.action" }) {
  return withDomStubs(() => runClientSlotChecks({ core, apply, targets, entrySlot }));
}

/** `verifyClientSlotRegistrations` 的同步主体（DOM 桩已就位）。 */
function runClientSlotChecks({ core, apply, targets, entrySlot }) {
  const violations = [];
  const observations = { entrySlot };
  const NOOP = () => {};
  const ctx = {
    effect: (fn) => { const d = fn(); return typeof d === "function" ? d : NOOP; },
    locale: {
      register: () => NOOP, bind: () => (key) => key,
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
        const unsubscribe = core.subscribeDeclaration(key, reconcile);
        reconcile();
        return () => { unsubscribe(); if (active) active(); };
      },
      entriesOfSlot: (key) => core.entriesOfSlot(key)
    }
  };

  try {
    apply(ctx);
  } catch (error) {
    return { ok: false, violations: [`apply 抛错：${errMsg(error)}`], observations };
  }

  const entries = core.entriesOfSlot(entrySlot) ?? [];
  observations.entryCount = entries.length;
  const entry = entries[0];
  if (!entry || typeof entry.component !== "function") {
    violations.push(`入口未注册或组件非法（${entrySlot}）——入口槽坐标漂移`);
    return { ok: false, violations, observations };
  }
  const tree = entry.component({ wide: true, t: (key) => key });
  const button = findClickable(tree);
  if (!button) {
    violations.push("入口组件树内无带 onClick 的按钮（入口渲染形状漂移）");
    return { ok: false, violations, observations };
  }
  const phaseOf = (target) => (target.phase === "apply" ? "apply" : "enter");
  const seenOf = (target) => (core.entriesOfSlot(target.slot) ?? [])
    .map((occupant) => occupant?.options?.[target.match.field] ?? "(未命名)");
  const requirePresent = (target, phase) => {
    const seen = seenOf(target);
    observations[`${target.slot}.${target.match.field}`] = seen;
    if (!seen.includes(target.match.value)) {
      violations.push(`Bot 模式未占用宿主声明槽「${target.slot}」（${phase} 相；${target.match.field}=${target.match.value}；实测占用：${seen.join("／") || "无"}）`);
    }
  };

  for (const target of targets.filter((t) => phaseOf(t) === "apply")) requirePresent(target, "apply");
  for (const target of targets.filter((t) => phaseOf(t) === "enter")) {
    const seen = seenOf(target);
    observations[`${target.slot}.${target.match.field}.beforeEnter`] = seen;
    if (seen.includes(target.match.value)) {
      violations.push(`enter 前已占用宿主声明槽「${target.slot}」（${target.match.field}=${target.match.value}）——Bot 模式接管须发生在进入时，不得在 apply 期抢占`);
    }
  }

  try {
    button.props.onClick();
  } catch (error) {
    violations.push(`Bot 模式入口点击抛错：${errMsg(error)}`);
  }

  for (const target of targets) requirePresent(target, phaseOf(target) === "apply" ? "apply 后仍在位" : "enter");
  return { ok: violations.length === 0, violations, observations };
}

/** 我方 client bundle 的真实调起（ModuleLoader 捕获 → 工厂 + react/primitives 桩）。 */
async function loadOurClientForProbe(primitivesExportNames) {
  const file = fileURLToPath(new URL("../lib/client.js", import.meta.url));
  return withDomStubs(async () => {
    const captured = await importViaModuleLoader(file);
    if (!captured || typeof captured.factory !== "function") {
      throw new Error("我方 client bundle 未走 __ModuleLoader__.load 装载协议");
    }
    const { react } = makeClientReactStub();
    const unknownPrimitives = [];
    const primitivesStub = new Proxy({}, {
      get: (_target, key) => {
        // 行为面：宿主真实导出名集内不存在的引用名一律记账（图标变体漂移＝React #130 类）。
        if (primitivesExportNames && !primitivesExportNames.has(String(key))) unknownPrimitives.push(String(key));
        return (props) => ({ type: `primitives.${String(key)}`, props: props ?? {}, children: [] });
      }
    });
    const moduleExports = captured.factory((id) => {
      if (id === "react") return react;
      if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitivesStub;
      return {};
    });
    if (typeof moduleExports?.apply !== "function") throw new Error("我方 client 工厂产物未导出 apply");
    return { moduleExports, unknownPrimitives };
  });
}

/**
 * 官方 primitives 实体包的导出名集（我方 `primitives.<Name>` 引用名的判据）。
 *
 * 宿主把官方前端按**构建产物**装盘：该包 import 的 react／react-dom／shiki／katex／
 * mdast 等依赖都不在其 node_modules 中（实测 import 实包报 `Cannot find package 'react'`），
 * 故导出面取自**包入口自己的 `export {...}` 声明**（包自述的公开面，280 名），
 * 而非扫描宿主产物推契约；渲染期**实际**使用与否由入口实跑兜底
 * （`loadOurClientForProbe` 的导出名比对＋`verifyClientSlotRegistrations`）。
 */
export function readPrimitivesExportNames(roots) {
  const entry = resolveCandidates(roots, "dsh-client-ui-primitives", "lib", "index.js")[0];
  if (!entry) return null;
  const source = readFileSync(entry, "utf8");
  const names = new Set();
  for (const match of source.matchAll(/^export\s*\{([\s\S]*?)\}\s*;?\s*$/gm)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names.size > 0 ? { names, entry } : null;
}

/**
 * 我方 client 对宿主 primitives 面的**引用合规**（收口 2026-10-07 返修批的 B／C 两类漂移）：
 *   - `primitives.<Name>` 引用名必须落在官方包的**真实导出名集**内（图标变体漂移类）；
 *   - 必需 props 面：`MarkdownText` 自 0.2.0-rc.1 起 `labels` 必填，调用点必须带
 *     （缺件＝渲染期 TypeError，宿主只记 `slot entry crashed`）。
 * 定性（勿读作 A 类面的行为探针）：本函数是**增量形状断言**——判据＝我方源码文本 × 官方包
 * 入口自述的 `export {...}` 面（宿主把前端按构建产物装盘、react/shiki 等依赖未随盘安装，
 * 无法 `import` 实包，见 `readPrimitivesExportNames` 注释）。该 A 类面的行为探针是
 * `probeClientSlotsStage`＋`verifyClientSlotRegistrations`（真实官方 bundle 与真实 SlotCore 实跑）；
 * 本查的渲染期半边只覆盖**入口组件**所触达的名字，computed／spread 形态逃逸。
 * 只做拒绝式断言：误报即 FAIL，漏检留给 V-A6.8 人工目视兜底。
 */
export function checkPrimitivesReferences(sourceText, exportNames, { requiredProps = { MarkdownText: ["labels"] } } = {}) {
  const violations = [];
  const names = [...new Set([...sourceText.matchAll(/primitives\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))];
  for (const name of names) {
    if (!exportNames.has(name)) violations.push(`引用未导出的 primitives.${name}`);
  }
  for (const [component, props] of Object.entries(requiredProps)) {
    const marker = `primitives.${component}`;
    for (let at = sourceText.indexOf(marker); at !== -1; at = sourceText.indexOf(marker, at + 1)) {
      const window = sourceText.slice(at, at + 240);
      const missing = props.filter((prop) => !new RegExp(`\\b${prop}\\b`).test(window));
      if (missing.length > 0) {
        const line = sourceText.slice(0, at).split("\n").length;
        violations.push(`${marker} 调用点（约第 ${line} 行）缺必需 props：${missing.join("／")}`);
      }
    }
  }
  return { ok: violations.length === 0, violations, referencedNames: names.length };
}

/**
 * P-CLIENT-SLOTS 行为化 stage：真实 apply 官方 layout/sidebar bundle，断言其
 * 声明的槽树覆盖组织层依赖的槽坐标（sidebar single／main keyed／shell.overlay
 * list／sidebar.footer.action list）；**再以真实 SlotCore 复算我方 client 的槽注册
 * 落点**（`verifyClientSlotRegistrations`：入口点击 → `sidebar` 占位 + `main` 的
 * `conversation` 键），把「插件槽名 ⊆ 宿主声明树」纳入门内。渲染期 priority/abdicate
 * 语义与渲染结果无头不可调起——显式降级声明见探针 describe 与登记表 readAccess，
 * 归 V-A6.8 人工目视清单覆盖。
 */
export async function probeClientSlotsStage(roots) {
  let layout;
  try { layout = await runClientBundle(roots, "dsh-client-ui-layout"); }
  catch (error) {
    return { state: "FAIL", reason: `官方 layout bundle 无法调起：${errMsg(error)}`, coordinate: "dsh-client-ui-layout/lib/client.js" };
  }
  const rootReg = layout.record.find((c) => c.op === "register" && c.opts?.name === "root");
  if (!rootReg) {
    return { state: "FAIL", reason: "官方 layout bundle apply 未声明 root 槽树（槽装载协议漂移）", coordinate: "dsh-client-ui-layout" };
  }
  const children = rootReg.opts.children ?? {};
  for (const [name, kind] of [["sidebar", "single"], ["main", "keyed"], ["shell.overlay", "list"]]) {
    if (children[name]?.kind !== kind) {
      return { state: "FAIL", reason: `layout 槽树声明漂移：槽「${name}」${children[name] ? `kind=${children[name].kind}（期望 ${kind}）` : "未声明"}（槽改名＝组件静默退回原生）`, coordinate: "dsh-client-ui-layout" };
    }
  }
  let sidebar;
  try { sidebar = await runClientBundle(roots, "dsh-client-ui-sidebar"); }
  catch (error) {
    return { state: "FAIL", reason: `官方 sidebar bundle 无法调起：${errMsg(error)}`, coordinate: "dsh-client-ui-sidebar/lib/client.js" };
  }
  const sidebarReg = sidebar.record.find((c) => c.op === "register" && c.opts?.name === "sidebar");
  if (!sidebarReg) {
    return { state: "FAIL", reason: "官方 sidebar bundle apply 未声明 sidebar 槽（注册在 inject 回调内但回调未被触发——装载协议漂移）", coordinate: "dsh-client-ui-sidebar" };
  }
  const footer = sidebarReg.opts.children?.["sidebar.footer.action"];
  if (footer?.kind !== "list") {
    return { state: "FAIL", reason: `sidebar 子槽声明漂移：「sidebar.footer.action」${footer ? `kind=${footer.kind}` : "未声明"}（入口槽失位＝按钮静默消失）`, coordinate: "dsh-client-ui-sidebar" };
  }
  return {
    state: "PASS",
    coordinate: "layout root 槽树＋sidebar 子槽（真实 apply 断言）",
    declared: { rootChildren: children, sidebarChildren: sidebarReg.opts.children }
  };
}

/**
 * P-CLIENT-SLOTS 增补面：**我方 client ↔ 宿主面**的实跑复算（2026-10-07 返修批，
 * 收口「我方槽名 ⊆ 宿主声明树」这一门覆盖缺口）。
 *
 * 三查：① `primitives.<Name>` 引用名 ⊆ 官方包导出面；② `MarkdownText` 调用点带
 * `labels`（0.2.0-rc.1 起必填）；③ 真实 SlotCore 下实调我方 bundle：入口点击 →
 * `sidebar` 占位 + `main` 槽 `key=conversation`。三类漂移（槽名／图标变体名／
 * labels）在修复前的形态下均判 FAIL（红证据见 18 号票附件 gate-guard 件）。
 *
 * 与 `probeClientSlotsStage` 分开：前者只断言宿主**声明面**（合成 fixture 可测），
 * 本 stage 需要真实宿主包（官方 layout/sidebar/slots/primitives 实体包）。
 */
export async function probeClientConformanceStage(roots, declared) {
  if (!declared?.rootChildren || !declared?.sidebarChildren) {
    return { state: "FAIL", reason: "缺少宿主声明树（须先跑 probeClientSlotsStage 取声明面）", coordinate: "probeClientSlotsStage.declared" };
  }
  const primitives = readPrimitivesExportNames(roots);
  if (!primitives) {
    return { state: "FAIL", reason: "官方 primitives 实体包不在本机或未声明导出面（导出名集无法取得）", coordinate: "dsh-client-ui-primitives/lib/index.js" };
  }
  const primitivesNames = primitives.names;
  const clientSourcePath = fileURLToPath(new URL("../lib/client.js", import.meta.url));
  const references = checkPrimitivesReferences(readFileSync(clientSourcePath, "utf8"), primitivesNames);
  if (!references.ok) {
    return {
      state: "FAIL",
      reason: `我方 client 引用面不合规：${references.violations.join("；")}（官方导出名 ${primitivesNames.size} 个）`,
      coordinate: "lib/client.js ↔ 官方 primitives 导出名集"
    };
  }
  let SlotCore;
  try {
    const slotsApi = await importHostIndex(roots, "dsh-client-ui-slots");
    SlotCore = slotsApi?.SlotCore;
  } catch (error) {
    return { state: "FAIL", reason: `官方 slots 包无法装载：${errMsg(error)}`, coordinate: "dsh-client-ui-slots" };
  }
  if (typeof SlotCore !== "function") {
    return { state: "FAIL", reason: "官方 slots 包未导出 SlotCore（槽装载协议漂移）", coordinate: "dsh-client-ui-slots/lib/index.js" };
  }
  let client;
  try { client = await loadOurClientForProbe(primitivesNames); }
  catch (error) {
    return { state: "FAIL", reason: `我方 client bundle 无法调起：${errMsg(error)}`, coordinate: "lib/client.js" };
  }
  const core = new SlotCore();
  core.register({ name: "root", children: declared.rootChildren }, () => null);
  core.register({ name: "sidebar", children: declared.sidebarChildren }, () => null);
  const verdict = await verifyClientSlotRegistrations({ core, apply: client.moduleExports.apply });
  if (client.unknownPrimitives.length > 0) {
    return {
      state: "FAIL",
      reason: `入口实跑访问了未导出的 primitives：${[...new Set(client.unknownPrimitives)].join("／")}`,
      coordinate: "lib/client.js ↔ 官方 primitives 导出名集（入口渲染期）"
    };
  }
  if (!verdict.ok) {
    return {
      state: "FAIL",
      reason: `我方 client 槽注册不合规：${verdict.violations.join("；")}（实测落点 ${JSON.stringify(verdict.observations)}）`,
      coordinate: "lib/client.js HOST_SLOTS ↔ 宿主声明槽树（真实 SlotCore 实跑）"
    };
  }
  return {
    state: "PASS",
    coordinate: `我方引用面（${references.referencedNames} 个 primitives 引用名 ⊆ 官方导出 ${primitivesNames.size} 名）＋槽落点（apply 期 footer=${verdict.observations["sidebar.footer.action.id"]?.join("／")}、overlay=${verdict.observations["shell.overlay.id"]?.join("／")}；enter 期 sidebar=${verdict.observations["sidebar.id"]?.join("／")}、main.key=${verdict.observations["main.key"]?.join("／")}）`
  };
}

/**
 * P-CLIENT-VISUAL 行为化 stage：真实 apply 官方 theme bundle（--dsw-* 令牌的
 * 官方提供方），断言运行期注入的样式文本确含令牌定义、theme 服务形状完整
 * （getTheme 可调）。primitives 实体包在盘但导出面之外的使用（引用名／必需 props）
 * 已在 P-CLIENT-SLOTS 增补面把守；槽位 ownerProps（collapsed/wide）渲染形状无头
 * 不可调起——显式降级声明见探针 describe 与登记表 readAccess，归 V-A6.8 人工目视清单。
 */
export async function probeClientVisualStage(roots) {
  let theme;
  try { theme = await runClientBundle(roots, "dsh-client-ui-theme"); }
  catch (error) {
    return { state: "FAIL", reason: `官方 theme bundle 无法调起：${errMsg(error)}`, coordinate: "dsh-client-ui-theme/lib/client.js" };
  }
  const themeService = theme.provided.theme;
  if (!themeService || typeof themeService.getTheme !== "function") {
    return { state: "FAIL", reason: "官方 theme bundle apply 未提供形状完整的 theme 服务（getTheme 可调）", coordinate: "dsh-client-ui-theme" };
  }
  let snapshot = null;
  try { snapshot = themeService.getTheme(); } catch (error) {
    return { state: "FAIL", reason: `theme 服务 getTheme 调用失败：${errMsg(error)}`, coordinate: "dsh-client-ui-theme" };
  }
  if (typeof snapshot !== "object" || snapshot === null) {
    return { state: "FAIL", reason: "theme 服务 getTheme 未返回主题快照对象", coordinate: "dsh-client-ui-theme" };
  }
  const css = theme.elements.map((el) => String(el.textContent ?? "")).join("\n");
  if (!css.includes("--dsw-")) {
    return { state: "FAIL", reason: "官方 theme bundle 运行期注入样式不含 --dsw-* 令牌（令牌改名＝视觉静默退化）", coordinate: "dsh-client-ui-theme" };
  }
  if (!css.includes(":root")) {
    return { state: "FAIL", reason: "官方 theme bundle 注入样式缺 :root 级令牌定义（组织层注入样式将解析落空）", coordinate: "dsh-client-ui-theme" };
  }
  return { state: "PASS", coordinate: "theme bundle 运行期样式注入＋theme 服务形状（真实 apply 断言）" };
}

/** 宿主侧 ESM 包的 lib/index.js 装载：缺包 → null；装载失败 → 抛错（调用方转 FAIL）。 */
async function importHostIndex(roots, pkg) {
  const candidates = resolveCandidates(roots, pkg, "lib", "index.js");
  if (candidates.length === 0) return null;
  try {
    return await import(pathToFileURL(candidates[0]).href);
  } catch (error) {
    throw new Error(`官方 ${pkg} 无法装载：${errMsg(error)}`);
  }
}

/**
 * 官方包装载＋导出形状断言（「装载→null 检→typeof 检→FAIL」级联的单一形状）：
 * 装载失败／缺载体包／缺指定导出 → {fail}（完整 FAIL 结果，调用方直接 return）；
 * 全过 → {mod}（调用方继续真实调用导出本体）。
 */
async function requireHostExport(roots, pkg, { exportName, missing, notExported }) {
  let mod;
  try { mod = await importHostIndex(roots, pkg); }
  catch (error) { return { fail: { state: "FAIL", reason: error.message, coordinate: `${pkg}/lib/index.js` } }; }
  if (mod === null) return { fail: { state: "FAIL", reason: missing, coordinate: roots.join(" ; ") } };
  if (typeof mod[exportName] !== "function") {
    return { fail: { state: "FAIL", reason: notExported, coordinate: `${pkg}/lib/index.js` } };
  }
  return { mod };
}

/**
 * P-CTX-SERVICES 行为化 stage（服务名半）：真实实例化官方 ToolRuntime／
 * SystemPrompt（cordis Service 语义下构造即 reflect.provide 服务名），断言
 * 组织层依赖的服务名 "tools"/"systemPrompt" 与官方产出一致——名字漂移时
 * 官方类提供的就是新名，断言必 FAIL（标记扫描抓不到这种漂移）。
 */
export async function probeCtxServicesNamesStage(roots) {
  const toolsGate = await requireHostExport(roots, "dsh-tools", {
    exportName: "ToolRuntime",
    missing: "dsh-tools 载体包不存在（工具服务提供方缺失）",
    notExported: "官方 dsh-tools 未导出 ToolRuntime 服务类"
  });
  if (toolsGate.fail) return toolsGate.fail;
  const toolsProvided = {};
  try {
    new toolsGate.mod.ToolRuntime(
      { reflect: { provide: (name, svc) => { toolsProvided[name] = svc; } }, systemPrompt: { tools: () => {}, section: () => {} } },
      {}
    );
  } catch (error) {
    return { state: "FAIL", reason: `官方 ToolRuntime 真实实例化失败：${errMsg(error)}`, coordinate: "dsh-tools/lib/index.js" };
  }
  if (toolsProvided.tools === undefined || toolsProvided.tools === null) {
    return { state: "FAIL", reason: "官方 ToolRuntime 构造未以服务名 \"tools\" 注册（服务改名→工具面静默不注册）", coordinate: "dsh-tools/lib/index.js" };
  }
  const promptGate = await requireHostExport(roots, "dsh-system-prompt", {
    exportName: "SystemPrompt",
    missing: "dsh-system-prompt 载体包不存在（提示段服务提供方缺失）",
    notExported: "官方 dsh-system-prompt 未导出 SystemPrompt 服务类"
  });
  if (promptGate.fail) return promptGate.fail;
  const promptProvided = {};
  try {
    new promptGate.mod.SystemPrompt(
      { reflect: { provide: (name, svc) => { promptProvided[name] = svc; } }, effect: (fn) => { fn(); }, emit: () => {} },
      {}
    );
  } catch (error) {
    return { state: "FAIL", reason: `官方 SystemPrompt 真实实例化失败：${errMsg(error)}`, coordinate: "dsh-system-prompt/lib/index.js" };
  }
  if (promptProvided.systemPrompt === undefined || promptProvided.systemPrompt === null) {
    return { state: "FAIL", reason: "官方 SystemPrompt 构造未以服务名 \"systemPrompt\" 注册（提示段注册静默失效）", coordinate: "dsh-system-prompt/lib/index.js" };
  }
  return { state: "PASS", coordinate: "ToolRuntime/SystemPrompt 真实实例化（服务名断言）" };
}

/**
 * P-CTX-SERVICES 行为化 stage（baseUrl 半）：以空插件树最小真实调用官方
 * boot()，断言 ctx.baseUrl＝配置目录的 file: URL（宿主产出端语义），并把该
 * 产出喂进本仓适配层 profileIdFromBaseUrl 回读 profile id（消费端闭环）。
 */
export async function probeCtxServicesBaseUrlStage(roots) {
  const bootGate = await requireHostExport(roots, "dsh-app-boot", {
    exportName: "boot",
    missing: "dsh-app-boot 载体包不存在（ctx.baseUrl 产出方缺失）",
    notExported: "官方 dsh-app-boot 未导出 boot()（baseUrl 产出端漂移）"
  });
  if (bootGate.fail) return bootGate.fail;
  const bootMod = bootGate.mod;
  const home = mkdtempSync(join(tmpdir(), "dsh-probe-boot-"));
  let booted;
  try {
    writeFileSync(join(home, "agent.cordis.yml"), "[]\n");
    booted = await bootMod.boot("dsh-contract-probe", join(home, "agent.cordis.yml"), [], undefined, undefined);
    const baseUrl = booted?.baseUrl;
    if (typeof baseUrl !== "string" || !baseUrl.startsWith("file:") || !baseUrl.endsWith("/")) {
      return { state: "FAIL", reason: `官方 boot() 的 ctx.baseUrl 形状漂移（期望配置目录的 file: URL）：${JSON.stringify(baseUrl)}`, coordinate: "dsh-app-boot/lib/index.js" };
    }
    const profileId = profileIdFromBaseUrl({ baseUrl });
    if (profileId !== basename(home)) {
      return { state: "FAIL", reason: `适配层 baseUrl→profile id 解析与官方产出不符（得 ${JSON.stringify(profileId)}，期望 ${basename(home)}）`, coordinate: "lib/host-services.js" };
    }
    return { state: "PASS", coordinate: "boot() 空树最小调用＋适配层回读（baseUrl 语义断言）" };
  } catch (error) {
    return { state: "FAIL", reason: `官方 boot() 空树调用失败：${errMsg(error)}`, coordinate: "dsh-app-boot/lib/index.js" };
  } finally {
    try { booted?.fiber?.dispose?.(); } catch { /* 已 dispose/无 fiber → 忽略 */ }
    rmSync(home, { recursive: true, force: true });
  }
}

/** 定位本机最新的真实会话日志（<DSH_HOME>/sessions/<分片>/<会话>/session.jsonl.zstd）。 */
export function findNewestSessionLog(dshHome) {
  const sessionsRoot = join(dshHome, "sessions");
  let shards;
  try { shards = readdirSync(sessionsRoot, { withFileTypes: true }); }
  catch { return null; }
  let best = null;
  for (const shard of shards) {
    if (!shard.isDirectory()) continue;
    let sessions;
    try { sessions = readdirSync(join(sessionsRoot, shard.name), { withFileTypes: true }); }
    catch { continue; }
    for (const session of sessions) {
      if (!session.isDirectory()) continue;
      const file = join(sessionsRoot, shard.name, session.name, "session.jsonl.zstd");
      if (!existsSync(file)) continue;
      try {
        const mtime = statSync(file).mtimeMs;
        if (best === null || mtime > best.mtime) best = { file, mtime, coordinate: join(shard.name, session.name) };
      } catch { /* 不可读 → 跳过 */ }
    }
  }
  return best;
}

/**
 * P-SESSION-LOG 行为化 stage：把本机最新的真实会话日志喂进适配层
 * lib/stats.js 的真实解码路径（多帧 zstd → JSONL 事件 → 四大投影）——
 * 不再只核文件存在，而是对宿主产出的真实格式做读取解析实调；布局或事件
 * 形状漂移在此响亮 FAIL。无任何已落盘会话 → SKIP（本机无可核格式）。
 */
export function probeSessionLogStage(dshHome) {
  const found = findNewestSessionLog(dshHome);
  if (found === null) {
    return { state: "SKIP", reason: "本机无已落盘会话日志（宿主未产出会话，无真实格式可核）", coordinate: join(dshHome, "sessions") };
  }
  let events;
  try {
    events = readSessionEventsFromFile(found.file);
  } catch (error) {
    return { state: "FAIL", reason: `真实会话日志解码失败（zstd 帧布局/落盘格式漂移）：${errMsg(error)}`, coordinate: found.coordinate };
  }
  if (events.length === 0) {
    return { state: "FAIL", reason: "真实会话日志解出零事件（行格式漂移或空帧）", coordinate: found.coordinate };
  }
  for (const event of events) {
    if (typeof event !== "object" || event === null || typeof event.type !== "string") {
      return { state: "FAIL", reason: `会话事件行形状漂移（期望 {type:string,...} 的 JSONL 事件）：${JSON.stringify(event)?.slice(0, 80)}`, coordinate: found.coordinate };
    }
  }
  let stats;
  try {
    stats = deriveStats(events);
  } catch (error) {
    return { state: "FAIL", reason: `会话日志统计推导失败（投影契约漂移）：${errMsg(error)}`, coordinate: found.coordinate };
  }
  for (const key of ["tokenUsage", "sessionStats", "contextPressure", "contextBreakdown"]) {
    if (typeof stats?.[key] !== "object" || stats[key] === null) {
      return { state: "FAIL", reason: `统计推导缺投影「${key}」（lib/stats.js 四大投影契约漂移）`, coordinate: "lib/stats.js" };
    }
  }
  return { state: "PASS", coordinate: found.coordinate };
}

/**
 * 关键配置 id（静默 no-op 即伤核心配置者：模型 pin／人设／沙箱／审批／settings
 * 重定向／模型路由／只读禁用的两个 shell 工具）。只读禁用的其余 tool-* id 属
 * shared.cjs 已声明可选（条目 id 不存在时 patch loader 无害忽略），只核往返、
 * 不核官方全集在位。
 */
export const CONFIG_IDS_CRITICAL = Object.freeze([
  "agent-default-model", "system-prompt", "sandbox-policy", "approval",
  "settings", "llm-pi-ai", "tool-bash", "tool-pwsh"
]);

/** 我方 workspace-write patch 往返后必须全数保留的 id（含 insert 的 bots；与 CONFIG_IDS_CRITICAL 语义不同集）。 */
const OUR_PATCH_MUST_RETAIN = Object.freeze([
  "agent-default-model", "system-prompt", "sandbox-policy", "approval", "settings", "bots"
]);

/** 从官方装载器的解析产物里收全部 id（含 insert 子项）。 */
function patchIdsOf(parsed) {
  const ids = [];
  for (const entry of parsed ?? []) {
    if (entry && typeof entry.id === "string") ids.push(entry.id);
    if (Array.isArray(entry?.insert)) {
      for (const item of entry.insert) if (item && typeof item.id === "string") ids.push(item.id);
    }
  }
  return ids;
}

/**
 * P-CONFIG-IDS 行为化 stage（三段真实调用）：
 * ① 我方 patch 构造（lib/shared.cjs 单一坐标）经官方 dsh-app-boot 装载器
 *    loadOverlayPatches 往返——id 与 insert bots 全数保留（格式漂移响亮）；
 * ② 官方组合 patch（dsh-base＋dsh-web-app）解析出官方 id 全集，关键 id
 *    逐一对照——宿主侧改名必 FAIL（patch loader 对未知 id 无害忽略，标记
 *    扫描抓不到这种静默）；
 * ③ 当前宿主经 AgentDefaultModelConfig 读回模型 pin，再由 llm-pi-ai 的
 *    Config/apply/resolveModel 验证合成 provider 可用；旧宿主核命名空间。
 *    只用隔离的合成模型，不依赖用户的供应商、型号、参数或网络。
 */
export async function probeConfigIdsStage(roots) {
  const bootGate = await requireHostExport(roots, "dsh-app-boot", {
    exportName: "loadOverlayPatches",
    missing: "dsh-app-boot 载体包不存在（patch 装载器缺失）",
    notExported: "官方 dsh-app-boot 未导出 loadOverlayPatches（装载器形状漂移）"
  });
  if (bootGate.fail) return bootGate.fail;
  const boot = bootGate.mod;
  const home = mkdtempSync(join(tmpdir(), "dsh-probe-config-"));
  try {
    const patchFile = join(home, "cordis.patch.yml");
    const modelPin = { provider: "probe-provider", model: "probe-model", reasoningEffort: "high" };
    const providerConfig = { providers: { [modelPin.provider]: {
      api: "openai-completions", baseURL: "https://example.invalid/v1", models: [{ id: modelPin.model }]
    } } };
    writeFileSync(patchFile, buildPatchYaml({
      botId: "dsh-contract-probe", role: "probe", ...modelPin,
      permission: "workspace-write", workspace: "/tmp/dsh-contract-probe-ws", settingsPath: "/tmp/dsh-contract-probe-settings.yaml",
      settingsText: `llm-pi-ai: ${JSON.stringify(providerConfig)}\n`
    }));
    let ours;
    try { ours = boot.loadOverlayPatches("dsh-contract-probe", patchFile); }
    catch (error) {
      return { state: "FAIL", reason: `我方 patch 构造未被官方装载器接受（格式漂移）：${errMsg(error)}`, coordinate: "lib/shared.cjs" };
    }
    const ourIds = new Set(patchIdsOf(ours));
    // 注意与 CONFIG_IDS_CRITICAL 的刻意差异：本集含 insert 的 bots、不含按权限
    // 条件出现的 llm-pi-ai 与 tool-*（provider 配置在下方真实读回）。
    for (const id of OUR_PATCH_MUST_RETAIN) {
      if (!ourIds.has(id)) {
        return { state: "FAIL", reason: `我方 patch 经官方装载器往返后丢失「${id}」`, coordinate: "lib/shared.cjs" };
      }
    }
    const universe = new Set();
    let webAppParsed = null;
    for (const bundle of ["dsh-base", "dsh-web-app"]) {
      const bundlePatch = resolveCandidates(roots, bundle, "cordis.patch.yml")[0];
      if (!bundlePatch) {
        return { state: "FAIL", reason: `官方组合 patch 缺失：${bundle}/cordis.patch.yml`, coordinate: roots.join(" ; ") };
      }
      let parsed;
      try { parsed = boot.loadOverlayPatches("dsh-contract-probe", bundlePatch); }
      catch (error) {
        return { state: "FAIL", reason: `官方组合 patch ${bundle} 解析失败：${errMsg(error)}`, coordinate: bundlePatch };
      }
      if (bundle === "dsh-web-app") webAppParsed = parsed;
      for (const id of patchIdsOf(parsed)) universe.add(id);
    }
    const misses = CONFIG_IDS_CRITICAL.filter((id) => !universe.has(id));
    if (misses.length > 0) {
      return { state: "FAIL", reason: `关键配置 id 不在官方组合 patch 全集（宿主侧改名＝patch 静默 no-op）：${misses.join("、")}`, coordinate: "dsh-base/cordis.patch.yml＋dsh-web-app/cordis.patch.yml" };
    }
    // web-app tools 行的 DSH_TOOLS_MODE 环境缝形状核验：bot 子进程靠它整体切
    // PTC 呈现（组织工具带点 op 名不符合供应商 ^[a-zA-Z0-9_-]+$，2026-09-29
    // TK-20260929 HTTP 400）。官方注明 TEMPORARY workaround——缝被移除时 bot 静默
    // 回退 native，点名 FAIL 不放行。装载器保留 !!js 表达式为 {__jsExpr} 标记
    // （求值属 Loader 装配阶段），此处按标记形状断言。
    const toolsModeExpr = webAppParsed?.find((entry) => entry?.id === "tools")?.config?.mode;
    if (!toolsModeExpr || typeof toolsModeExpr.__jsExpr !== "string"
      || !toolsModeExpr.__jsExpr.includes("DSH_TOOLS_MODE")) {
      return { state: "FAIL",
        reason: `官方 web patch tools 行缺 DSH_TOOLS_MODE 环境缝（mode=${JSON.stringify(toolsModeExpr)}）——bot 子进程的 PTC 呈现会静默失效，组织工具带点名再次被供应商拒绝`,
        coordinate: "dsh-web-app/cordis.patch.yml" };
    }
    const agentDefaultModel = await importHostIndex(roots, "dsh-agent-default-model").catch((error) => ({ __importError: errMsg(error) }));
    if (agentDefaultModel === null) return { state: "FAIL", reason: "dsh-agent-default-model 载体包不存在", coordinate: roots.join(" ; ") };
    if (agentDefaultModel.__importError) return { state: "FAIL", reason: `dsh-agent-default-model 无法装载：${agentDefaultModel.__importError}`, coordinate: "dsh-agent-default-model/lib/index.js" };
    if (agentDefaultModel.AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE !== undefined) {
      if (agentDefaultModel.AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE !== "agent-default-model") {
        return { state: "FAIL", reason: `官方模型 pin 命名空间漂移：${JSON.stringify(agentDefaultModel.AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE)}（期望 agent-default-model）`, coordinate: "dsh-agent-default-model/lib/index.js" };
      }
    } else {
      // Config 的 volatile 引用只在内存读取，不挂真实 settings 或 configEditor。
      try {
        const parsedPin = ours.find((entry) => entry.id === "agent-default-model")?.config;
        let service;
        new agentDefaultModel.AgentDefaultModelConfig({
          reflect: { provide: (name, value) => { if (name === "agentDefaultModel") service = value; } },
          inject: () => () => {}
        }, Object.fromEntries(Object.keys(modelPin).map((key) => [key, { get: () => parsedPin?.[key] }])));
        const selection = service.currentSelection();
        for (const [key, expected] of Object.entries(modelPin)) {
          if (selection?.[key] !== expected) throw new Error(`${key} 未读回 patch 值`);
        }
      } catch (error) {
        return { state: "FAIL", reason: `官方模型 pin 读回失败：${errMsg(error)}`, coordinate: "dsh-agent-default-model/lib/index.js" };
      }
    }
    const piAiModule = await importHostIndex(roots, "dsh-llm-pi-ai").catch((error) => ({ __importError: errMsg(error) }));
    if (piAiModule === null) return { state: "FAIL", reason: "dsh-llm-pi-ai 载体包不存在", coordinate: roots.join(" ; ") };
    if (piAiModule.__importError) return { state: "FAIL", reason: `dsh-llm-pi-ai 无法装载：${piAiModule.__importError}`, coordinate: "dsh-llm-pi-ai/lib/index.js" };
    if (piAiModule.name !== "llm-pi-ai") {
      return { state: "FAIL", reason: `官方模型路由服务名漂移：${JSON.stringify(piAiModule.name)}（期望 llm-pi-ai）`, coordinate: "dsh-llm-pi-ai/lib/index.js" };
    }
    if (agentDefaultModel.AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE === undefined) {
      try {
        let adapter;
        await piAiModule.apply({
          fiber: { entry: { options: { id: "llm-pi-ai" } } },
          inject: () => () => {}, on: () => () => {}, get: () => undefined,
          llm: {
            registerConfigurableProviders: () => ({ replace() {} }),
            registerModelDiscovery() {},
            registerAdapter(routes, candidate) {
              if (routes.includes(modelPin.provider)) adapter = candidate;
              return { replace() {} };
            }
          }
        }, piAiModule.Config(ours.find((entry) => entry.id === "llm-pi-ai")?.config ?? {}));
        const selected = await adapter?.resolveModel(modelPin.provider, modelPin.model);
        if (selected?.provider !== modelPin.provider || selected?.id !== modelPin.model) {
          throw new Error("配置中的 provider/model 未由宿主提供");
        }
      } catch (error) {
        return { state: "FAIL", reason: `官方 provider 配置读回失败：${errMsg(error)}`, coordinate: "dsh-llm-pi-ai/lib/index.js" };
      }
    }
    return { state: "PASS", coordinate: agentDefaultModel.AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE === undefined
      ? "官方装载器往返＋官方 id 全集对照＋模型 pin 与 provider 配置真实读回"
      : "官方装载器往返＋官方 id 全集对照＋旧宿主模型命名空间与路由名核验" };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

// ---------------- pod 02 号票：整屏层几何／过渡令牌／焦点隔离的探针件 ----------------

/**
 * 官方整屏层的层本体档（宿主 `overlayLayer` 自身即 `z-index:20` 层叠上下文）。
 * 我方整屏层须 portal 到 body 并落在**根堆叠上下文**的该档之上、官方浮层之下。
 */
export const SHELL_OVERLAY_LAYER_BAND = 20;

/**
 * 官方 body 级浮层的档位构成（层本体之上的各档）：每项＝一个官方提供方 bundle。
 * 取值来源两路互证：① 先按**我方通用装载器**真实 apply 官方 bundle 并取其**运行期注入
 * 样式**；② 若该 bundle 的运行期注入面为空（提供方在别处注入 CSS 时可能如此），退回
 * 该 bundle 源里的**内联样式文本**（同样是官方产物，格式固定）。两路都取不到 → FAIL。
 */
export const HOST_OVERLAY_BANDS = Object.freeze([
  { source: "dsh-client-ui-settings-account", note: "onboarding 900；设置/平台页 1001" },
  { source: "dsh-client-ui-settings-general", note: "primitives Modal 设置面板 1000" },
  { source: "dsh-client-ui-conversation", note: "Toast／Menu portal 1100" }
]);

/**
 * 我方 portal 层「低于官方 body 级浮层最低档」的地板（V-P2.5）。
 * 现装宿主实测＝**900**（dsh-client-ui-settings-account 的 `.tQSFJa_onboardingOverlay`
 * `position:fixed;z-index:900` 全屏 onboarding）。该值决定我方 portal 的 z-index 上限，
 * 官方浮层集合里的最小**体量级**档位与它不符即 FAIL。
 * 注：宿主另有低于该地板的官方固定定位件（现装实测 `.zwW4-W_card` `position:fixed;
 * z-index:40`）——那是窄态卡片，不构成 V-P2.5 所指的 body 级浮层档；探针只把
 * 「不低于地板的官方浮层集合」纳入地板判定，层本体档与地板之间的零散固定件仅作诊断。
 */
export const HOST_FLOAT_FLOOR_BAND = 900;

/** 从一个 bundle 源文本里收集内联样式文本（`const css = "…"` 这类构建产物形态）。 */
export function collectInlineStyleText(source) {
  const chunks = [];
  for (const match of String(source).matchAll(/(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*"((?:[^"\\]|\\.){80,})"/g)) {
    const text = match[1];
    if (text.includes("z-index") || text.includes("position:")) chunks.push(text.replace(/\\"/g, '"').replace(/\\n/g, "\n"));
  }
  return chunks.join("\n");
}

/** 取一个 bundle 的样式文本：先运行期注入，再退回源内联样式；都空→null（调用方 FAIL）。 */
async function bandStyleText(roots, entry) {
  const candidates = resolveCandidates(roots, entry.source, "lib", "client.js");
  if (candidates.length === 0) return { text: null, via: "missing" };
  let injected = "";
  try {
    const bundle = await runClientBundle(roots, entry.source);
    injected = injectedStylesOf(bundle);
  } catch { /* 运行期注入面不可用 → 退回源文本路 */ }
  if (injected.trim() !== "" && injected.includes("z-index")) return { text: injected, via: "runtime" };
  try {
    const inline = collectInlineStyleText(readFileSync(candidates[0], "utf8"));
    if (inline.includes("z-index")) return { text: inline, via: `${entry.source} 源内联样式` };
  } catch { /* 不可读 → 下方判 FAIL */ }
  return { text: null, via: "missing" };
}

/** 过渡令牌族（存在性与取值形状；官方 `:root` 级定义，共 3 时长 + 1 缓动）。 */
export const HOST_TRANSITION_TOKENS = Object.freeze([
  { name: "--ds-transition-duration", kind: "time" },
  { name: "--ds-transition-duration-fast", kind: "time" },
  { name: "--ds-transition-duration-slow", kind: "time" },
  { name: "--ds-ease-in-out", kind: "ease" }
]);

/** 时间取值形状（`<number><s|ms>`；不做数值换算，只看形状）。 */
const TIME_VALUE_RE = /^(?:\d+\.?\d*|\.\d+)(?:ms|s)$/;
/** 缓动取值形状（关键字或 `cubic-bezier(...)`／`steps(...)`）。 */
const EASE_VALUE_RE = /^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\([^)]*\)|steps\([^)]*\))$/;

/** 取一个官方 bundle 运行期注入的全部样式文本。 */
function injectedStylesOf(bundle) {
  return (bundle?.elements ?? []).map((el) => String(el.textContent ?? "")).join("\n");
}

/** 在样式文本中取一个声明体（选择器 + `{...}`）的**首个**匹配。 */
export function firstRuleBody(css, selectorPattern) {
  const match = new RegExp(`(?:${selectorPattern.source})\\s*\\{([^{}]*)\\}`, "g").exec(css);
  return match === null ? null : match[1];
}

/** 是否声明了四边归零（简写 `inset:0` 或 `top/right/bottom/left:0` 全写）。 */
export function hasFullInset(declarations) {
  if (declarations.inset !== undefined) {
    const values = declarations.inset.split(/\s+/).filter(Boolean);
    return values.length >= 1 && values.length <= 4 && values.every((value) => value === "0" || value === "0px");
  }
  return ["top", "right", "bottom", "left"].every((side) => declarations[side] === "0" || declarations[side] === "0px");
}

/** 解析声明体为「属性 → 值」（按首个冒号切分；值内冒号保留）。 */
export function parseDeclarations(body) {
  const out = {};
  for (const chunk of String(body ?? "").split(";")) {
    const at = chunk.indexOf(":");
    if (at <= 0) continue;
    out[chunk.slice(0, at).trim()] = chunk.slice(at + 1).trim();
  }
  return out;
}

/** 样式里声明的全部 `--ds-*` 自定义属性名（诊断/否证用）。 */
export function collectCustomPropertyNames(css) {
  return [...new Set([...String(css).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))].sort();
}

/** 样式里声明的全部 z-index 取值（声明序留痕，重复不去重）。 */
export function collectZIndexModes(css) {
  return [...String(css).matchAll(/z-index\s*:\s*(-?\d+)/g)].map((m) => Number(m[1]));
}

/**
 * 样式里**同时声明 `position:fixed` 与 `z-index`** 的规则的档位（去重升序）。
 * 这才是「body 级浮层档」：固定定位的浮层在根堆叠上下文里与整屏层比档，故该档位构成
 * 决定覆盖式呈现是否被官方浮层盖章在下面。规则内其余声明（含同规则里的 margin/border
 * 简写）不参与——只认 `position:fixed` 与 `z-index` 两枚键。
 */
export function collectFixedLayerBands(css) {
  const bands = new Set();
  for (const match of String(css).matchAll(/\{([^{}]*)\}/g)) {
    const body = parseDeclarations(match[1]);
    if (body.position !== "fixed") continue;
    const band = Number(body["z-index"]);
    if (Number.isInteger(band) && body["z-index"] !== undefined) bands.add(band);
  }
  return [...bands].sort((a, b) => a - b);
}

/**
 * 从官方 bundle 的**运行期注入样式**解析整屏层几何语义：
 *   - 层本体规则＝「`position:absolute` ＋ `inset:0` 四边 ＋ 整数 `z-index`（1..99 档）
 *     ＋ `pointer-events:none`」唯一签名（宿主压缩类名会变，这条语义签名不会）；
 *   - 直系子节点规则＝同一类名的 `>*` 规则（`pointer-events:auto`）；
 *   - 祖先链风险项＝同一份样式里对 AppFrame 根（`position:relative` 且 `overflow` 非
 *     `visible`）声明了 `transform`／`filter`／`contain`／`container-type` 的规则——
 *     命中即层内 `position:fixed` 可被裁剪或重锚。
 * 返回 `{ layerClass, layer, children, ancestorRisk, css }`；层本体规则缺失时 `layer=null`
 * （调用方报 FAIL）。
 */
export function resolveOverlayLayerFacts(bundle) {
  const css = injectedStylesOf(bundle);
  // 按**选择器**归并同一条规则的多次声明（后声明覆盖先声明＝CSS 级联口径）：宿主产物里
  // 同一类名分散在多条规则是常态，只取「首个匹配规则」会漏掉后续规则上的风险声明
  // （2026-10-09 修正：`.probe_frame{transform:…}` 追加在既有 `.probe_frame{position:relative;
  // overflow:hidden}` 之后时，祖先前缀风险此前**取不到**，负例恒 PASS）。
  const merged = new Map();
  const selectorOrder = [];
  const record = (className, isChild, body) => {
    const key = isChild ? `${className}>` : className;
    if (!merged.has(key)) {
      merged.set(key, { className, isChild, body: {} });
      selectorOrder.push(key);
    }
    Object.assign(merged.get(key).body, parseDeclarations(body));
  };
  // 两种规则形态分开认：直系子节点规则（`.cls>*{}`，`>` 与 `*` 均须出现——漏掉 `*`
  // 时该规则整条取不到，「直系子节点恢复交互」判据曾在真实宿主上恒 FAIL）与本体规则
  // （`.cls{}`）。先吃子节点形态，本体形态再用否定前瞻排除 `>`/`*` 形态，防重复归并。
  for (const match of css.matchAll(/(?<![\w$#-])\.([A-Za-z0-9_$]+)[\s]*>\s*\*\{([^{}]*)\}/g)) record(match[1], true, match[2]);
  for (const match of css.matchAll(/(?<![\w$#-])\.([A-Za-z0-9_$]+)(?![\s]*>\s*\*)\s*\{([^{}]*)\}/g)) record(match[1], false, match[2]);
  const rules = selectorOrder.map((key) => merged.get(key));
  const layerRule = rules.find((rule) => !rule.isChild && rule.body.position === "absolute" && hasFullInset(rule.body)
    && rule.body["pointer-events"] === "none"
    && Number.isInteger(Number(rule.body["z-index"])) && Number(rule.body["z-index"]) >= 1 && Number(rule.body["z-index"]) <= 99) ?? null;
  const ancestorRisk = [];
  for (const rule of rules) {
    if (rule.isChild || rule.body.position !== "relative" || rule.body.overflow === undefined || rule.body.overflow === "visible") continue;
    for (const property of ["transform", "filter", "contain", "container-type"]) {
      const value = rule.body[property];
      if (value !== undefined && value !== "none" && value !== "normal") ancestorRisk.push(`.${rule.className}{${property}:${value}}`);
    }
  }
  if (layerRule === null) return { layerClass: null, layer: null, children: null, ancestorRisk, css };
  return {
    layerClass: layerRule.className,
    layer: layerRule.body,
    children: merged.get(`${layerRule.className}>`)?.body ?? {},
    ancestorRisk,
    css
  };
}

/**
 * P-SHELL-OVERLAY-GEOMETRY 行为化 stage（整屏层几何与层叠语义）：
 *   ① 官方 layout bundle 真实 apply，从运行期注入样式取层本体规则，断言整屏几何档
 *      （`position:absolute; inset:0; z-index:<层本体档>; pointer-events:none`）与
 *      直系子节点可交互（`>*{pointer-events:auto}`）——层本体自身即定位上下文；
 *   ② 层叠档构成：各官方提供方 bundle 的注入样式里 z-index 实测值去重升序，须含
 *      层本体档且官方浮层全在其上（任一浮层落进层本体之下＝FAIL）；
 *   ③ 同层 `order` 语义：官方 slots 包**真实 SlotCore** 实跑（乱序注册 → 读回渲染序
 *      为 order 升序）。
 * 我方整屏层的 portal 锚点与祖先链「无 transform 类属性」属真实浏览器坐标——
 * **显式降级**：归 V-A6.8 人工目视清单（同 HF-CLIENT-SLOTS 的降级口径）。
 */
export async function probeShellOverlayGeometryStage(roots) {
  let layout;
  try { layout = await runClientBundle(roots, "dsh-client-ui-layout"); }
  catch (error) {
    return { state: "FAIL", reason: `官方 layout bundle 无法调起：${errMsg(error)}`, coordinate: "dsh-client-ui-layout/lib/client.js" };
  }
  const facts = resolveOverlayLayerFacts(layout);
  if (facts.layer === null) {
    return {
      state: "FAIL",
      reason: "layout 运行期注入样式里未解析出整屏层几何（`position:absolute;inset:0;z-index;<档>;pointer-events:none` 唯一签名缺失）——覆盖式整屏层的宿主依据消失",
      coordinate: "dsh-client-ui-layout/lib/client.js（执行期样式注入）"
    };
  }
  const required = { position: "absolute", "pointer-events": "none" };
  for (const [property, expected] of Object.entries(required)) {
    if (facts.layer[property] !== expected) {
      return { state: "FAIL", reason: `整屏层几何漂移：${property}=${JSON.stringify(facts.layer[property] ?? null)}（期望 ${expected}）——覆盖式整屏层落点改变`, coordinate: `dsh-client-ui-layout 注入样式 .${facts.layerClass}` };
    }
  }
  if (!hasFullInset(facts.layer)) {
    return { state: "FAIL", reason: `整屏层四边未归零（inset=${JSON.stringify(facts.layer.inset ?? null)}）——整屏覆盖不再满屏`, coordinate: `dsh-client-ui-layout 注入样式 .${facts.layerClass}` };
  }
  const layerBand = Number(facts.layer["z-index"]);
  if (!Number.isInteger(layerBand)) {
    return { state: "FAIL", reason: `整屏层未声明整数 z-index（${JSON.stringify(facts.layer["z-index"] ?? null)}）——层叠档无从锚定`, coordinate: `dsh-client-ui-layout 注入样式 .${facts.layerClass}` };
  }
  if (layerBand !== SHELL_OVERLAY_LAYER_BAND) {
    return { state: "FAIL", reason: `整屏层层叠档漂移：z-index=${layerBand}（期望宿主范式 ${SHELL_OVERLAY_LAYER_BAND}）——层叠上限档改变，覆盖式呈现的定档依据失效`, coordinate: `dsh-client-ui-layout 注入样式 .${facts.layerClass}` };
  }
  if (facts.children["pointer-events"] !== "auto") {
    return { state: "FAIL", reason: `整屏层直系子节点未恢复交互（>*{pointer-events:${JSON.stringify(facts.children["pointer-events"] ?? null)}}，期望 auto）——层内组件整体不可点`, coordinate: `dsh-client-ui-layout 注入样式 .${facts.layerClass}>*` };
  }
  if (facts.ancestorRisk.length > 0) {
    return {
      state: "FAIL",
      reason: `整屏层祖先链出现裁剪/重锚风险声明：${facts.ancestorRisk.join("、")}（AppFrame 根声明 transform/filter/contain/container-type 后，层内 position:fixed 会被裁剪或重锚）`,
      coordinate: `dsh-client-ui-layout 注入样式（祖先链规则）`
    };
  }
  const bandModes = [];
  for (const entry of HOST_OVERLAY_BANDS) {
    const styles = await bandStyleText(roots, entry);
    bandModes.push({ entry, styles: styles.via, modes: styles.text === null ? [] : collectFixedLayerBands(styles.text) });
  }
  const emptyBands = bandModes.filter((row) => row.modes.length === 0);
  if (emptyBands.length > 0) {
    return { state: "FAIL", reason: `官方浮层档位提供方缺失或样式里无 z-index：${emptyBands.map((row) => `${row.entry.source}（${row.styles}）`).join("、")}——层叠构成无从核验`, coordinate: emptyBands.map((row) => row.entry.source).join(" ; ") };
  }
  const ordered = [...new Set([layerBand, ...bandModes.flatMap((row) => row.modes)])].sort((a, b) => a - b);
  // V-P2.5：我方 portal 层须「高于 AppFrame、低于官方 body 级浮层**最低档**」。
  // 官方 body 级浮层地板＝{900,1000,1001,1100} 的最小档（现装宿主实测 900＝
  // settings-account 的 `.tQSFJa_onboardingOverlay` position:fixed;z-index:900）。
  // 判据：**不低于地板的官方固定定位档里最小者恰等于地板常量**——比地板小 ⇒ 官方
  // 浮层下沉（我方 portal 取值上限被压低）；比地板大 ⇒ 地板本身漂移。
  // 诊断（不作门）：层本体档与地板之间的官方固定定位件——现装实测 40＝
  // settings-account 的 `.zwW4-W_card`（position:fixed;z-index:40 窄态卡片）。它是
  // 官方既有次级层、低于整屏层档，永远盖不到我方 portal，故不参与地板判定。
  // 实现用显式循环（不用谓词过滤）：2026-10-09 实测谓词式过滤在本门进程内对同一
  // 数组会给出与逐元素比较不符的输出，档位选取必须确定。
  let hasAboveLayer = false;
  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i] - layerBand > 0) { hasAboveLayer = true; break; }
  }
  if (!hasAboveLayer) {
    return { state: "FAIL", reason: `官方浮层未全在整屏层之上（实测档位 ${ordered.join("／")}）——层本体档被反超＝官方浮层盖章在整屏层之下`, coordinate: "各官方浮层 bundle 样式（position:fixed 规则档位）", bands: ordered };
  }
  let floatFloor = null;
  for (let i = 0; i < ordered.length; i += 1) {
    const band = ordered[i];
    if (band - HOST_FLOAT_FLOOR_BAND < 0) continue;
    if (floatFloor === null || floatFloor - band > 0) floatFloor = band;
  }
  const aboveLayer = [];
  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i] - HOST_FLOAT_FLOOR_BAND >= 0) aboveLayer.push(ordered[i]);
  }
  const layerToFloorBands = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const band = ordered[i];
    if (band - layerBand > 0 && HOST_FLOAT_FLOOR_BAND - band > 0) layerToFloorBands.push(band);
  }
  const floorProvider = bandModes.find((row) => row.modes.includes(floatFloor));
  if (floatFloor !== HOST_FLOAT_FLOOR_BAND) {
    return {
      state: "FAIL",
      reason: `官方 body 级浮层最低档漂移：${floatFloor}（期望宿主范式 ${HOST_FLOAT_FLOOR_BAND}，来源 ${floorProvider?.entry.source ?? "未知"}）——我方 portal 层的「低于官方浮层」取值上限改变，V-P2.5 的层叠约束失效`,
      coordinate: "各官方浮层 bundle 样式（position:fixed 规则档位）",
      bands: ordered
    };
  }
  const declaredBands = Object.fromEntries(bandModes.map((row) => [row.entry.source, row.modes]));
  // 同层 order 语义：真实 SlotCore 实跑（乱序注册 → list 槽按 order 升序读回）
  let SlotCore;
  try {
    const slotsApi = await importHostIndex(roots, "dsh-client-ui-slots");
    SlotCore = slotsApi?.SlotCore;
  } catch (error) {
    return { state: "FAIL", reason: `官方 slots 包无法装载：${errMsg(error)}`, coordinate: "dsh-client-ui-slots" };
  }
  if (typeof SlotCore !== "function") {
    return { state: "FAIL", reason: "官方 slots 包未导出 SlotCore（槽装载协议漂移）", coordinate: "dsh-client-ui-slots/lib/index.js" };
  }
  const core = new SlotCore();
  core.register({ name: "root", children: { "shell.overlay": { kind: "list" } } }, () => null);
  for (const [id, order] of [["probe-b", 30], ["probe-a", -10], ["probe-c", 0]]) {
    core.register({ name: "shell.overlay", id, order }, () => null);
  }
  const orderedIds = (core.entriesOfSlot("shell.overlay") ?? []).map((entry) => entry.options.id);
  if (orderedIds.join(",") !== "probe-a,probe-c,probe-b") {
    return { state: "FAIL", reason: `同层兄弟 order 语义漂移：乱序注册后读回 ${orderedIds.join("／") || "空"}（期望 order 升序 probe-a／probe-c／probe-b）——同层定序依据失效，覆盖式呈现不得依赖 order`, coordinate: "dsh-client-ui-slots SlotCore.entriesOfSlot" };
  }
  return {
    state: "PASS",
    coordinate: `layout 注入样式 .${facts.layerClass}（整屏几何档 z-index=${layerBand}＋>* pointer-events＋祖先链无裁剪/重锚声明）＋官方浮层档位构成（${ordered.join("／")}；地板 ${floatFloor}）＋SlotCore order 升序实跑；我方整屏层的实际 portal 落点与浏览器裁剪行为属渲染期坐标——显式降级归 V-A6.8 人工目视清单`,
    bands: ordered,
    floatFloor,
    layerToFloorBands,
    overlay: { ...facts.layer },
    ancestorRisk: facts.ancestorRisk,
    declaredBands
  };
}

/**
 * P-HOST-TRANSITION-TOKENS 行为化 stage：真实 apply 官方 theme bundle，从运行期注入
 * 样式取过渡令牌族的存在性与取值形状（3 时长 + 1 缓动）。令牌改名／改单位即 FAIL
 * （宿主对未知令牌静默不报错，我方常量回退也会静默接管——这条静默面只由本探针把守）。
 */
export async function probeHostTransitionTokensStage(roots) {
  let theme;
  try { theme = await runClientBundle(roots, "dsh-client-ui-theme"); }
  catch (error) {
    return { state: "FAIL", reason: `官方 theme bundle 无法调起：${errMsg(error)}`, coordinate: "dsh-client-ui-theme/lib/client.js" };
  }
  const css = injectedStylesOf(theme);
  const declarations = parseDeclarations(firstRuleBody(css, /:root/));
  const readings = {};
  for (const token of HOST_TRANSITION_TOKENS) {
    const value = declarations[token.name];
    if (value === undefined || value === "") {
      const declared = collectCustomPropertyNames(css).filter((name) => name.startsWith("--ds-"));
      return {
        state: "FAIL",
        reason: `宿主过渡令牌缺失：${token.name}（官方 :root 级声明 ${declared.join("／") || "无 --ds-*"}）——过渡参数无从取值，动效退化为硬切`,
        coordinate: "dsh-client-ui-theme 注入样式 :root"
      };
    }
    const shapeOk = token.kind === "time" ? TIME_VALUE_RE.test(value) : EASE_VALUE_RE.test(value);
    if (!shapeOk) {
      return {
        state: "FAIL",
        reason: `宿主过渡令牌取值形状漂移：${token.name}=${JSON.stringify(value)}（期望${token.kind === "time" ? "时间量 <number><s|ms>" : "缓动函数/关键字"}）`,
        coordinate: "dsh-client-ui-theme 注入样式 :root"
      };
    }
    readings[token.name] = value;
  }
  return {
    state: "PASS",
    coordinate: `theme 注入样式 :root 过渡令牌族（${HOST_TRANSITION_TOKENS.map((token) => `${token.name}=${readings[token.name]}`).join("／")}）`,
    readings
  };
}



// ---------------- pod 02 号票：焦点隔离面（真实 primitives 实包装载＋合成 DOM） ----------------

/**
 * 官方 primitives 实包必须导出的焦点隔离符号（04 号票的消费坐标）与其形状：
 * 三个函数＋一枚选择器字面常量（`modalSelector` 本身就是字符串，不是函数）。
 */
export const FOCUS_LAYER_SYMBOLS = Object.freeze(["useModalLayer", "modalSelector", "closeTopModal", "isBehindModal"]);
export const FOCUS_LAYER_SYMBOL_KINDS = Object.freeze({
  useModalLayer: "function",
  modalSelector: "string",
  closeTopModal: "function",
  isBehindModal: "function"
});

/** 官方 modal 契约选择器字面（快捷键分发器按文档序最后一个该类元素取 modal scope）。 */
export const MODAL_SELECTOR_LITERAL = "[role=\"dialog\"][aria-modal=\"true\"], [role=\"menu\"]";

/**
 * 官方 `useModalLayer` 的 Tab 候选选择器字面（焦点囚笼的判定依据；宿主改名＝焦点
 * 泄漏面漂移）。合成 DOM 的 `focusableItems` 与探针判据共用此串，防两边各写一份。
 */
export const FOCUSABLE_SELECTOR = "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex=\"0\"]";

/**
 * 收集一个 ESM 源的 import 需求：specifier → { named:Set, hasDefault:bool }。
 * 用于为「按构建产物装盘、依赖未随盘安装」的官方前端包生成桩依赖图。
 */
export function collectImportNeeds(source) {
  const needs = new Map();
  const record = (spec) => {
    if (!needs.has(spec)) needs.set(spec, { named: new Set(), hasDefault: false });
    return needs.get(spec);
  };
  for (const match of String(source).matchAll(/^import\s*"([^"]+)";$/gm)) record(match[1]);
  for (const match of String(source).matchAll(/^import\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)(?:\s*,\s*(\{[^}]*\}|[A-Za-z_$][\w$]*))?\s+from\s+"([^"]+)";$/gm)) {
    const need = record(match[3]);
    for (const name of namedBindings(match[1], match[2])) need.named.add(name);
    if (defaultBinding(match[1], match[2]) !== null) need.hasDefault = true;
  }
  return needs;
}

/** 从 import 子句两段里取命名绑定（`as` 取别名）；非标识符形态丢弃（防括号跨行吞并）。 */
function namedBindings(...parts) {
  const names = [];
  for (const part of parts) {
    if (typeof part !== "string" || !part.startsWith("{")) continue;
    for (const item of part.slice(1, -1).split(",")) {
      const name = item.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name);
    }
  }
  return names;
}

/** 从 import 子句两段里取默认绑定名（无则 null）。 */
function defaultBinding(...parts) {
  for (const part of parts) {
    if (typeof part === "string" && /^[A-Za-z_$][\w$]*$/.test(part.trim())) return part.trim();
  }
  return null;
}

/** 收集 import 子句里的**本地绑定名**（后续闭包提取用；`as` 取别名）。 */
export function collectLocalBindings(source) {
  const names = new Set();
  for (const match of String(source).matchAll(/^import\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)(?:\s*,\s*(\{[^}]*\}|[A-Za-z_$][\w$]*))?\s+from\s+"[^"]+";$/gm)) {
    for (const name of namedBindings(match[1], match[2])) names.add(name);
    const head = defaultBinding(match[1], match[2]);
    if (head !== null) names.add(head);
  }
  return names;
}

/**
 * 以「顶层声明跳读」实现闭包提取：从目标导出名出发，按需纳入引用到的顶层声明，直到
 * 闭包收敛。覆盖 `function`／`class`（括号配对跳读声明体）与**单行标量常量**
 * （`const X = 字面量|内置构造(...)`，如选择器字符串、`new WeakMap()` 这类模块级缓存
 * ——四枚目标符号的闭包只吃这两类）。返回 `{ code, externals, missing }`：
 * `externals`＝需由桩绑定的 import 名；`missing`＝闭包外仍未声明的根（＝打包形态漂移，
 * 调用方报 FAIL）。
 */
export function sliceDeclarationClosure(source, roots, localBindings = new Set(), declaredNames = new Set()) {
  const text = String(source);
  const declarations = new Map();

  /** 从 `{` 起做括号配对跳读（跳过字符串/模板/行注释），返回声明体结束下标。 */
  const skipBody = (start) => {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = start; index < text.length; index++) {
      const char = text[index];
      if (quote !== null) {
        if (escaped) { escaped = false; continue; }
        if (char === "\\") { escaped = true; continue; }
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
      if (char === "/" && text[index + 1] === "/") { index = text.indexOf("\n", index) - 1; continue; }
      if (char === "{") depth += 1;
      else if (char === "}") { depth -= 1; if (depth === 0) return index + 1; }
    }
    return text.length;
  };

  /**
   * 从 `=` 起取整条声明语句的 `;`：跳过字符串/模板/注释，并按 `()`／`[]`／`{}` 配平
   * （多行构造如 `new Set([...])` 也要吃全），配平归零后的首个 `;` 即语句末。
   */
  const skipStatement = (start) => {
    let quote = null;
    let escaped = false;
    let depth = 0;
    for (let index = start; index < text.length; index++) {
      const char = text[index];
      if (quote !== null) {
        if (escaped) { escaped = false; continue; }
        if (char === "\\") { escaped = true; continue; }
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
      if (char === "/" && text[index + 1] === "/") { index = text.indexOf("\n", index) - 1; continue; }
      if (char === "/" && text[index + 1] === "*") { index = text.indexOf("*/", index) + 1; continue; }
      if (char === "(" || char === "[" || char === "{") depth += 1;
      else if (char === ")" || char === "]" || char === "}") depth -= 1;
      else if (char === ";" && depth <= 0) return index + 1;
    }
    return text.length;
  };

  let at = 0;
  while (at < text.length) {
    const newline = text.indexOf("\n", at);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = text.slice(at, lineEnd);
    const fnClass = /^(?:export\s+)?(function\*?|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
    const constDecl = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
    if (fnClass !== null && line.includes("{", fnClass[0].length)) {
      const end = skipBody(at + line.indexOf("{", fnClass[0].length));
      declarations.set(fnClass[2], text.slice(at, end).replace(/^export\s+/, "").trim());
      at = Math.max(end, lineEnd) + 1;
      continue;
    }
    if (constDecl !== null) {
      const end = skipStatement(at + constDecl[0].length - 1);
      declarations.set(constDecl[1], text.slice(at, end).replace(/^export\s+/, "").trim());
      at = Math.max(end, lineEnd) + 1;
      continue;
    }
    at = lineEnd + 1;
  }

  const inClosure = new Set();
  const externals = new Set();
  const identifiersOf = (code) => new Set([...code.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0]));
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.pop();
    if (inClosure.has(name)) continue;
    const code = declarations.get(name);
    if (code === undefined) continue;
    inClosure.add(name);
    for (const identifier of identifiersOf(code)) {
      if (inClosure.has(identifier)) continue;
      if (declarations.has(identifier)) {
        if (!queue.includes(identifier)) queue.push(identifier);
      } else if (localBindings.has(identifier)) {
        externals.add(identifier);
      }
    }
  }
  const missing = [...roots].filter((name) => !inClosure.has(name) && !declaredNames.has(name));
  return { code: [...inClosure].map((name) => declarations.get(name)).join("\n"), externals: [...externals], missing };
}

/** 官方 primitives 实包的 `export {…}` 自述面（诊断/否证用；真实装载走闭包提取）。 */
export function readPrimitivesExportNamesFromEntry(entry) {
  const source = readFileSync(entry, "utf8");
  const names = new Set();
  for (const match of source.matchAll(/^export\s*\{([\s\S]*?)\}\s*;?\s*$/gm)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/**
 * 官方前端实包的**实体调起**（闭包提取，无 loader 钩子）：
 *   - 官方把前端按**构建产物**装盘，依赖（react／shiki／mdast…）未随盘安装，`import`
 *     实包在本机必然失败；本函数从包入口源里**提取目标符号可达的声明闭包**（顶层
 *     函数/类声明＋标量常量），把 import 绑定与其余外部标识符降级为参数桩（外部标识符
 *     给空函数，闭包外的取值不会执行），在 VM 里以函数体求值，返回目标符号的值。
 *   - 这是**真实执行官方实现体**（不是文本/导出名断言）：依赖解析被桩掉，行为语义
 *     完整。若官方改打包形态（目标符号不再是顶层声明），`missing` 非空即抛错（响亮）。
 */
export async function loadHostFrontendFacade(pkgDir, symbols) {
  const entry = join(pkgDir, "lib", "index.js");
  const source = readFileSync(entry, "utf8");
  const localBindings = collectLocalBindings(source);
  const declared = new Set(symbols.filter((name) => new RegExp(`^export\\s*\\{[^}]*\\b${name}\\b`, "m").test(source)));
  const closure = sliceDeclarationClosure(source, symbols, localBindings, new Set(symbols));
  if (closure.missing.length > 0) {
    throw new Error(`官方 ${basename(pkgDir)} 打包形态漂移：目标符号 ${closure.missing.join("／")} 不在顶层声明面`);
  }
  const { runInThisContext } = await import("node:vm");
  // 外部标识符（import 绑定等）以**形参**注入：闭包体里对这些名字的引用即取注入值，
  // 未注入的标识符（闭包外的模块级名字）在闭包体内为 undefined——只在使用时才抛。
  const injected = [...new Set([...localBindings, ...closure.externals])];
  const factory = runInThisContext(`((${injected.join(", ")}) => {
    ${closure.code}
    return { ${symbols.map((name) => `${JSON.stringify(name)}: ${name}`).join(", ")} };
  })`);
  const arg = (name) => {
    if (name === "useRef" || name === "useLayoutEffect") {
      return (...args) => {
        const fixture = globalThis.__dshHooks;
        if (fixture === undefined) throw new Error(`官方 primitives 调起 ${name} 但 hook 夹具未装载（globalThis.__dshHooks）`);
        return fixture[name](...args);
      };
    }
    if (name === "jsx" || name === "jsxs" || name === "createElement") return (type, props) => ({ type, props });
    if (name === "createPortal") return (node) => node;
    if (name === "useId") return () => "stub-id";
    if (name === "Fragment") return Symbol("Fragment");
    if (name === "useState") return (initial) => [typeof initial === "function" ? initial() : initial, () => {}];
    if (name === "useMemo") return (fn) => fn();
    if (name === "useCallback") return (fn) => fn;
    if (name === "useSyncExternalStore") return (_subscribe, getSnapshot) => getSnapshot();
    return Object.assign(function stub() { return {}; }, new Proxy({}, { get: () => () => ({}) }));
  };
  const exportsObject = factory(...injected.map(arg));
  return { exports: exportsObject, entry, closure, injected };
}

/** 极简 hook 夹具：`useRef` 起记忆、`useLayoutEffect` 按依赖变化重跑（`run` 返回清理器）。 */
export function createHookFixture() {
  const slots = [];
  let cursor = 0;
  const react = {
    useRef(initial) {
      const at = cursor++;
      if (!slots[at] || !("ref" in slots[at])) slots[at] = { ref: { current: initial } };
      return slots[at].ref;
    },
    useLayoutEffect(effect, deps) {
      const at = cursor++;
      const prev = slots[at];
      const changed = !prev || !Array.isArray(prev.deps) || !Array.isArray(deps)
        || deps.length !== prev.deps.length || deps.some((dep, index) => !Object.is(dep, prev.deps[index]));
      if (changed) slots[at] = { deps: [...deps], effect };
      else slots[at].effect = undefined;
    }
  };
  return {
    useRef: (value) => react.useRef(value),
    useLayoutEffect: (effect, deps) => react.useLayoutEffect(effect, deps),
    run(componentCall) {
      cursor = 0;
      componentCall();
      const cleanups = [];
      for (const slot of slots) {
        if (!slot?.effect) continue;
        const cleanup = slot.effect();
        slot.effect = undefined;
        if (typeof cleanup === "function") cleanups.push(cleanup);
      }
      return () => { for (const cleanup of cleanups.reverse()) cleanup(); };
    }
  };
}

/**
 * 合成 DOM（焦点隔离面的执行域，见 `probeShellFocusLayerStage`）：元素继承注入的
 * `HTMLElement`（官方钩子用 `instanceof HTMLElement` 判焦点归还目标），支持官方
 * `useModalLayer` 用到的选择器子集：
 *   - 复合选择器列表＝`分析器在**括号外**按 `,` 切分`（`:not([inert], [hidden])` 里的逗号
 *     属 `:not` 的实参列表，不是选择器分隔符——2026-10-09 修正：原先按裸 `,` 切分，
 *     该形态被切成两段残片后恒不匹配，`[inert]` 子树的排除语义在夹具里**静默失效**）；
 *   - `:not(...)`＝实参再按裸 `,` 折为「排除组」（组内逗号＝或），每组支持标签、属性、
 *     `:disabled`、`:focus` 三类简单形态；
 *   - 裸形态＝标签＋属性选择器（`a[href]`／`[tabindex="0"]`）＋`:focus`。
 * 选择器解析失败（出现本子集不认的形态）**抛错**而非静默不匹配——「夹具不认」必须响亮，
 * 否则探针会在错误的执行域上给出 PASS。
 */
export function createFocusDom() {
  const root = { tag: "#root", children: [], parent: null, attrs: {}, inert: false };
  const listeners = new Map();
  const dom = { root, document: null, activeElement: null };
  class ElementStub {}
  class HTMLElementStub extends ElementStub {}
  dom.Element = ElementStub;
  dom.HTMLElement = HTMLElementStub;

  /** 顶层选择器列表切分：只认括号外的 `,`（`:not(a, b)` 的实参逗号不在此列）。 */
  const splitTopLevel = (selector) => {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const char of String(selector)) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) { parts.push(current); current = ""; continue; }
      current += char;
    }
    parts.push(current);
    return parts.map((part) => part.trim()).filter(Boolean);
  };

  /** `:not(...)` 实参切分（组内 `,` ＝或）。 */
  const splitNotArgs = (args) => args.split(",").map((item) => item.trim()).filter(Boolean);

  /** 取尽一个 `:not(` 的实参（括号配对；本子集内不会嵌套 `:not`）。`at` 指向 `:not(` 的冒号。 */
  const takeNotArg = (rest, at) => {
    let depth = 1; // 起点＝实参开头的 `(` 之后
    for (let index = at + 5; index < rest.length; index++) {
      if (rest[index] === "(") depth += 1;
      else if (rest[index] === ")") {
        depth -= 1;
        if (depth === 0) return rest.slice(at + 5, index);
      }
    }
    throw new Error(`合成 DOM 选择器解析失败：「${rest}」的 :not( 未闭合`);
  };

  /** 一个简单形态（无逗号、无 `:not`）→ {tag, attrs, disabled, focus, leftover}。 */
  const simpleSpec = (part) => {
    const spec = { tag: null, attrs: [], disabled: false, focus: false, leftover: "" };
    let rest = part.trim();
    const tag = /^[a-zA-Z][\w-]*/.exec(rest);
    if (tag) { spec.tag = tag[0].toLowerCase(); rest = rest.slice(tag[0].length); }
    rest = rest.replace(/:focus/g, () => { spec.focus = true; return ""; });
    for (const attr of rest.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) spec.attrs.push({ name: attr[1], value: attr[2] });
    spec.leftover = rest.replace(/\[[\w-]+(?:="[^"]*")?\]/g, "").trim();
    return spec;
  };

  /**
   * 解析一个复合形态 → {tag, attrs, disabled, focus, notGroups[][]}。
   * `:not(:disabled)` 单独识别（`disabled` 是**元素自身**的属性，不是选择器子串）：
   * 关闭态＝元素未标 disabled。`inert` 是**祖先**属性，浏览器里被 inert 盖住的控件
   * 仍是 `:not(:disabled)` 的命中项（不可聚焦由 inert 自身保证）；夹具不得替浏览器
   * 多算这一层，否则「背景 inert 由谁排除」的判据会被夹具自己兜掉。
   */
  const parseCompound = (part) => {
    const spec = { tag: null, attrs: [], disabled: false, focus: false, notGroups: [] };
    let rest = part.trim().replace(/:not\(:disabled\)/g, () => { spec.disabled = true; return ""; });
    const tag = /^[a-zA-Z][\w-]*/.exec(rest);
    if (tag) { spec.tag = tag[0].toLowerCase(); rest = rest.slice(tag[0].length); }
    while (true) {
      const at = rest.indexOf(":not(");
      if (at === -1) break;
      const args = takeNotArg(rest, at);
      spec.notGroups.push(splitNotArgs(args));
      rest = rest.slice(0, at) + rest.slice(at + 5 + args.length + 1);
    }
    const simple = simpleSpec(rest);
    spec.focus = simple.focus;
    spec.attrs = [...spec.attrs, ...simple.attrs];
    if (simple.leftover !== "") throw new Error(`合成 DOM 选择器解析失败：不认识的形态「${simple.leftover}」（片段「${part.trim()}」）`);
    return spec;
  };

  const specMatches = (el, spec) => {
    if (spec.tag !== null && String(el.tag).toLowerCase() !== spec.tag) return false;
    // `:disabled` 只看 disabled 属性：`inert` 是**祖先**属性，浏览器里被 inert 盖住的
    // 控件仍是 `:not(:disabled)` 的命中项（不可聚焦由 inert 自身保证）——夹具不得替
    // 浏览器多算这一层，否则「背景 inert 由谁排除」的判据会被夹具自己兜掉。
    if (spec.disabled && el.attrs.disabled !== undefined) return false;
    if (spec.focus && dom.activeElement !== el) return false;
    for (const attr of spec.attrs) {
      if (attr.value === undefined) { if (el.attrs[attr.name] === undefined) return false; }
      else if (el.attrs[attr.name] !== attr.value) return false;
    }
    for (const group of spec.notGroups) {
      if (group.some((arg) => specMatches(el, parseCompound(arg)))) return false;
    }
    return true;
  };

  const matchesOne = (el, part) => specMatches(el, parseCompound(part));
  dom.matchesSelector = (el, selector) =>
    typeof selector === "string" && splitTopLevel(selector).some((part) => matchesOne(el, part));

  const collect = (scope, selector) => {
    const out = [];
    const walk = (node) => {
      for (const child of node.children ?? []) {
        if (dom.matchesSelector(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(scope);
    return out;
  };

  /**
   * 可聚焦项集合；`excludeInert:true` 时套用官方 `useModalLayer` 的 Tab 候选过滤
   * （`closest("[inert], [hidden]")`）。探针用它把「inert 子树确实进入过候选集、又被
   * 过滤机制排除」两半分别照亮——两者都断言才算真考到过滤机制。
   */
  dom.focusableItems = (scope, { selector = FOCUSABLE_SELECTOR, excludeInert = false } = {}) => {
    const items = collect(scope, selector);
    return excludeInert ? items.filter((el) => el.closest("[inert], [hidden]") === null) : items;
  };

  const documentStub = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, event) { for (const fn of listeners.get(type) ?? []) fn(event); },
    defaultView: { addEventListener: () => {}, removeEventListener: () => {} },
    querySelectorAll: (selector) => collect(root, selector),
    querySelector: (selector) => collect(root, selector)[0] ?? null
  };
  Object.defineProperty(documentStub, "activeElement", { get: () => dom.activeElement, set: (value) => { dom.activeElement = value; } });
  dom.document = documentStub;

  dom.make = (tag = "div", props = {}) => {
    const el = new HTMLElementStub();
    el.tag = tag;
    el.attrs = { ...(props.attrs ?? {}) };
    el.dataset = { ...(props.dataset ?? {}) };
    el.children = [];
    el.parent = null;
    el.inert = props.inert ?? false;
    el.isConnected = true;
    el.ownerDocument = documentStub;
    el.focusCount = 0;
    el.setAttribute = function setAttribute(name, value) { this.attrs[name] = String(value); };
    el.removeAttribute = function removeAttribute(name) { delete this.attrs[name]; };
    el.getAttribute = function getAttribute(name) { return this.attrs[name] ?? null; };
    el.addEventListener = () => {};
    el.removeEventListener = () => {};
    el.dispatchEvent = () => true;
    el.focus = function focus() { this.focusCount += 1; dom.activeElement = this; };
    el.contains = function contains(node) {
      for (let cursor2 = node; cursor2 !== null && cursor2 !== undefined; cursor2 = cursor2.parent) {
        if (cursor2 === this) return true;
      }
      return false;
    };
    el.querySelectorAll = (selector) => collect(el, selector);
    el.querySelector = (selector) => collect(el, selector)[0] ?? null;
    el.matches = (selector) => dom.matchesSelector(el, selector);
    el.closest = function closest(selector) {
      for (let cursor2 = this; cursor2 !== null && cursor2 !== undefined; cursor2 = cursor2.parent) {
        if (cursor2 !== root && dom.matchesSelector(cursor2, selector)) return cursor2;
      }
      return null;
    };
    return el;
  };
  dom.append = (parent, child) => { child.parent = parent; parent.children.push(child); return child; };
  dom.listeners = listeners;
  return dom;
}

/** 键盘事件的默认形状（官方钩子读 `defaultPrevented`／`isComposing`／`repeat`／`shiftKey`）。 */
export function keyEvent(patch = {}) {
  const event = {
    key: "", shiftKey: false, isComposing: false, repeat: false, defaultPrevented: false,
    preventDefault: () => { event.defaultPrevented = true; }, ...patch
  };
  return event;
}

/**
 * P-SHELL-FOCUS-LAYER 行为化 stage：真实装载官方 primitives 实包（构建产物，依赖以
 * loader 桩替换），先断言四个导出在位且 `modalSelector` 字面精确，再以合成 DOM 实调
 * `useModalLayer`：
 *   ① 挂载即焦点入园（自动聚焦首个可聚焦控件）；
 *   ② 背景 `[inert]` 子树被排除出 Tab 链；
 *   ③ Tab 囚笼：末位控件 Tab 回卷首项；
 *   ④ Escape 只关栈顶层；
 *   ⑤ 焦点归还按 LIFO，且非栈顶层卸载时**不抢**焦点；
 *   ⑥ `isBehindModal` 把被盖页面元素判为「应让键」。
 * 真实浏览器里的 `inert`（不可聚焦／不可点）与 portal 渲染属渲染期坐标——**显式降级**：
 * 归 V-A6.8 人工目视清单。
 */
export async function probeShellFocusLayerStage(roots) {
  const pkgDirs = resolveCandidates(roots, "dsh-client-ui-primitives");
  if (pkgDirs.length === 0) {
    return { state: "FAIL", reason: "官方 primitives 实包不在本机（焦点隔离面载体缺失）", coordinate: roots.join(" ; ") || "discoverPackageRoots" };
  }
  let loaded;
  try { loaded = await loadHostFrontendFacade(pkgDirs[0], FOCUS_LAYER_SYMBOLS); }
  catch (error) {
    return { state: "FAIL", reason: `官方 primitives 实包无法调起：${errMsg(error)}`, coordinate: pkgDirs.map((dir) => `${dir}/lib/index.js`).join(" ; ") };
  }
  const primitives = loaded.exports;
  for (const symbol of FOCUS_LAYER_SYMBOLS) {
    if (typeof primitives[symbol] !== FOCUS_LAYER_SYMBOL_KINDS[symbol]) {
      return { state: "FAIL", reason: `官方 primitives 未导出 ${symbol}（期望 ${FOCUS_LAYER_SYMBOL_KINDS[symbol]}，实测 ${typeof primitives[symbol]}）——焦点／键盘隔离的宿主坐标缺失或形状漂移`, coordinate: "dsh-client-ui-primitives 导出面" };
    }
  }
  if (primitives.modalSelector !== MODAL_SELECTOR_LITERAL) {
    return {
      state: "FAIL",
      reason: `modal 契约选择器漂移：${JSON.stringify(primitives.modalSelector ?? null)}（期望 ${JSON.stringify(MODAL_SELECTOR_LITERAL)}）——快捷键分发器对 modal scope 的判定依据改变`,
      coordinate: "dsh-client-ui-primitives lib/types/useModalLayer.js"
    };
  }
  const dom = createFocusDom();
  const fixture = createHookFixture();
  const savedGlobals = new Map();
  const installGlobal = (name, value) => {
    savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  };
  const violations = [];
  const observations = {};
  const cleanups = [];
  try {
    installGlobal("document", dom.document);
    installGlobal("Element", dom.Element);
    installGlobal("HTMLElement", dom.HTMLElement);
    installGlobal("__dshHooks", { useRef: fixture.useRef, useLayoutEffect: fixture.useLayoutEffect });

    const background = dom.make("button", { attrs: { tabindex: "0" } });
    const covered = dom.make("button", { attrs: { tabindex: "0" } });
    dom.append(dom.root, background);
    dom.append(dom.root, covered);
    const first = dom.make("button", { attrs: { tabindex: "0" } });
    const last = dom.make("button", { attrs: { tabindex: "0" } });
    const dialog = dom.make("div", { attrs: { role: "dialog", "aria-modal": "true" } });
    // 背景 inert 的**实证坐标**：inert 子树必须真在 dialog 的查询域内，且位于末位之后
    // ——这样「被 inert 排除」必须由 `closest("[inert], [hidden]")` 过滤机制自己做到，
    // 而不是靠子树不在场（2026-10-09 修正：原先把 inert 子树挂在树外，排除判据恒真、
    // 过滤机制实际未被考到）。
    const inertWrap = dom.make("div", { attrs: { inert: "" } });
    const inertButton = dom.make("button", { attrs: { tabindex: "0" } });
    dom.append(inertWrap, inertButton);
    dom.append(dialog, first);
    dom.append(dialog, last);
    dom.append(dialog, inertWrap);
    dom.append(dom.root, dialog);
    dom.document.activeElement = covered;

    const closed = [];
    const mount = (element, onClose) => {
      const cleanup = fixture.run(() => primitives.useModalLayer({ current: element }, true, onClose));
      cleanups.push(cleanup);
      return cleanup;
    };

    mount(dialog, () => closed.push("dialog"));
    observations.mountedActive = dom.activeElement === first ? "首个可聚焦控件" : (dom.activeElement === dialog ? "dialog 本体" : "未入园");
    if (dom.activeElement !== first) violations.push(`挂载后焦点未进入 modal（实测 ${observations.mountedActive}）——焦点隔离第一步失效`);

    // ② 背景 inert：inert 子树内的控件被排除出 Tab 链（inert 是**祖先**属性，官方
    //    `useModalLayer` 靠 `closest("[inert], [hidden]")` 过滤，夹具须真走到这一步）
    dom.document.activeElement = last;
    const inertEvent = keyEvent({ key: "Tab" });
    dom.document.dispatch("keydown", inertEvent);
    observations.inertExcluded = dom.focusableItems(dialog).includes(inertButton)
      && dom.focusableItems(dialog, { excludeInert: true }).includes(inertButton) === false
      && inertButton.focusCount === 0
      && dom.activeElement === first && inertEvent.defaultPrevented;
    if (!observations.inertExcluded) violations.push("背景 inert 子树内控件仍进入 Tab 链——背景 inert 语义未生效");

    // ③ Tab 囚笼：末位回卷首项
    dom.document.activeElement = last;
    const tabEvent = keyEvent({ key: "Tab" });
    dom.document.dispatch("keydown", tabEvent);
    observations.tabTrap = tabEvent.defaultPrevented && dom.activeElement === first;
    if (!observations.tabTrap) violations.push("Tab 囚笼失效（末位 Tab 未回卷首项）——焦点会泄漏到被盖页面");

    // ④ Escape 只关栈顶
    const escapeEvent = keyEvent({ key: "Escape" });
    dom.document.dispatch("keydown", escapeEvent);
    observations.escapeClosedTop = escapeEvent.defaultPrevented && closed.join(",") === "dialog";
    if (!observations.escapeClosedTop) violations.push(`Escape 处置异常（prevented=${escapeEvent.defaultPrevented}，关闭序 ${closed.join("／") || "无"}）`);

    // ⑥ 被盖页面元素须让键
    observations.behindModal = primitives.isBehindModal(covered) === true && primitives.isBehindModal(first) === false;
    if (primitives.isBehindModal(covered) !== true || primitives.isBehindModal(first) !== false) {
      violations.push("isBehindModal 判定漂移（被盖页面元素未判为「应让键」）");
    }

    // ⑤ LIFO：第二层挂载后卸载**第一层不得抢焦点**（首层已非栈顶）
    const secondFirst = dom.make("button", { attrs: { tabindex: "0" } });
    const secondDialog = dom.make("div", { attrs: { role: "dialog", "aria-modal": "true" } });
    dom.append(secondDialog, secondFirst);
    dom.append(dom.root, secondDialog);
    const firstCleanup = cleanups[0];
    mount(secondDialog, () => closed.push("second"));
    firstCleanup();
    observations.nonTopUnmountKeepsFocus = dom.activeElement === secondFirst;
    if (!observations.nonTopUnmountKeepsFocus) violations.push("非栈顶层卸载时抢走焦点——嵌套还原语义（LIFO）失效");

    cleanups[1]();
    dom.document.activeElement = covered;
    cleanups[0]();
    observations.returnFocus = dom.activeElement === covered;
    if (!observations.returnFocus) violations.push("卸载后焦点未归还挂载前元素");
  } catch (error) {
    return { state: "FAIL", reason: `真实调起官方 useModalLayer 失败：${errMsg(error)}`, coordinate: "dsh-client-ui-primitives useModalLayer（合成 DOM 执行域）" };
  } finally {
    for (const [name, descriptor] of savedGlobals) {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  }
  if (violations.length > 0) {
    return { state: "FAIL", reason: violations.join("；"), coordinate: "dsh-client-ui-primitives useModalLayer／modalSelector（合成 DOM 实跑）" };
  }
  return {
    state: "PASS",
    coordinate: `primitives 实包导出 ${FOCUS_LAYER_SYMBOLS.join("／")}＋modalSelector 字面＋useModalLayer 合成 DOM 实跑（${JSON.stringify(observations)}）；真实浏览器 inert／portal 渲染——显式降级归 V-A6.8 人工目视清单`,
    observations
  };
}

/**
 * 上下文：{ roots, cliDirs, hostInstalled }。hostInstalled=false（两个发现面都
 * 空）时全部探针 SKIP——这是「本机未安装宿主」的合法 SKIP 面。
 */
function makeProbeContext() {
  const roots = discoverPackageRoots();
  const cliDirs = discoverDshCliDirs();
  let webAssets = [];
  try {
    webAssets = discoverWebFrontendAssets();
  } catch { /* 产物不可读 → 空面（种子解析走 FAIL） */ }
  return { roots, cliDirs, webAssets, hostInstalled: roots.length > 0 || cliDirs.length > 0 };
}

const marker = (files, needle) => findMarkerFile(files, needle) !== null;

export const HOST_CONTRACT_PROBES = [
  {
    id: "P-PLUGIN-IDENTITY",
    face: "HF-PLUGIN-IDENTITY",
    describe: "组织层身份面：cordis CLI 在位＋client inject 清单可解析＋ModuleLoader 装载协议标记",
    run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip("discoverPackageRoots/discoverDshCliDirs");
      const binFiles = ctx.cliDirs.map((dir) => join(dir, "lib", "bin.js"));
      if (!marker(binFiles, "--profile")) {
        return { state: "FAIL", reason: "dsh CLI bin 不含 --profile 旗标（启动器 CLI 形状漂移）", coordinate: binFiles.join(" ; ") };
      }
      // 本仓 package.json 的 dsh.client.inject 清单逐项可解析：boot 图行（宿主
      // 包根内 lib/client.js）或 Vite shell 种子（web-frontend 产物内标记）。
      // 注：宿主 boot 图对未知 inject id 静默跳过——死边无害但失真，门必须抓。
      const ownPkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
      const injectIds = ownPkg?.dsh?.client?.inject;
      if (!Array.isArray(injectIds) || injectIds.length === 0) {
        return { state: "FAIL", reason: "本仓 package.json 缺 dsh.client.inject 清单（身份面声明缺失）", coordinate: "package.json" };
      }
      for (const id of injectIds) {
        const asGraphRow = ctx.roots.some((root) => existsSync(join(root, id.replace(/^@deepseek-ai\//, ""), "lib", "client.js")));
        const asShellSeed = marker(ctx.webAssets, id);
        if (!asGraphRow && !asShellSeed) {
          return { state: "FAIL", reason: `client inject 项 ${id} 在宿主安装中不可解析（既非 boot 图行、也非 shell 种子）——boot 图会静默跳过此边`, coordinate: ctx.roots.join(" ; ") };
        }
      }
      const layoutClient = resolveCandidates(ctx.roots, "dsh-client-ui-layout", "lib", "client.js");
      if (!marker(layoutClient, "__ModuleLoader__")) {
        return { state: "FAIL", reason: "宿主 client bundle 不含 __ModuleLoader__ 装载协议标记", coordinate: layoutClient.join(" ; ") || "dsh-client-ui-layout/lib/client.js" };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-CONFIG-IDS",
    face: "HF-CONFIG-IDS",
    describe: "配置面 id/key：行为探针——我方 patch 经官方装载器往返＋官方组合 id 对照＋模型 pin 读回与合成 provider 模型解析（旧宿主核命名空间，不绑定用户模型值）＋web patch tools 行 DSH_TOOLS_MODE 环境缝形状（PTC 呈现静默失效面）",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      return probeConfigIdsStage(ctx.roots);
    }
  },
  {
    id: "P-CLIENT-SLOTS",
    face: "HF-CLIENT-SLOTS",
    describe: "前端槽位：行为探针——真实 apply 官方 layout/sidebar bundle，断言声明槽树（sidebar single／main keyed／shell.overlay list／sidebar.footer.action list），并以真实 SlotCore 实跑我方 client 的槽注册落点（入口点击 → sidebar 占位 + main 槽 conversation 键；注册未声明槽即 FAIL）；渲染期 priority/abdicate 语义与渲染结果无头不可调起——显式降级归 V-A6.8 人工目视清单",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      const declaration = await probeClientSlotsStage(ctx.roots);
      if (declaration.state !== "PASS") return declaration;
      const conformance = await probeClientConformanceStage(ctx.roots, declaration.declared);
      if (conformance.state !== "PASS") return conformance;
      return { state: "PASS", coordinate: `${declaration.coordinate}；${conformance.coordinate}` };
    }
  },
  {
    id: "P-CLIENT-VISUAL",
    face: "HF-CLIENT-VISUAL",
    describe: "视觉件：行为探针——真实 apply 官方 theme bundle，断言运行期 --dsw-* 令牌注入与 theme 服务形状；primitives 导出面**取包入口自述的 `export {…}` 文本**作引用名与必需 props 判据（归 P-CLIENT-SLOTS 增补面）——**显式降级声明**：该包按构建产物装盘、依赖未随盘安装（react／react-dom 解析失败）⇒ `import` 实包在本环境不可行，故为「导出名形状断言」而非真实调起，字面漂移可守、语义漂移不可；待宿主提供可装载实体包时升级为真实导入。槽位 ownerProps 渲染形状无头不可调起——显式降级归 V-A6.8 人工目视清单",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      return probeClientVisualStage(ctx.roots);
    }
  },
  {
    id: "P-CLIENT-LOCALE",
    face: "HF-CLIENT-LOCALE",
    describe: "本地化面：真实调起官方 LocaleRuntime（行为探针——装载 bundle、apply、断言服务形状）",
    async run(ctx) {
      const candidates = resolveCandidates(ctx.roots, "dsh-client-locale", "lib", "client.js");
      if (candidates.length === 0) {
        return { state: "SKIP", reason: "官方 @deepseek-ai/dsh-client-locale 不在本机", coordinate: ctx.roots.map((r) => join(r, "dsh-client-locale")).join(" ; ") };
      }
      // 与 runClientBundle 共用装载捕获/DOM 桩通用件，但保留本探针自己的严格 require
      // shim（未知依赖即抛＝形状断言）与最小 apply ctx——不迁记录型通用件以免放宽断言。
      return withDomStubs(async () => {
        try {
          const captured = await importViaModuleLoader(candidates[0]);
          if (!captured || typeof captured.factory !== "function") {
            return { state: "FAIL", reason: "官方 locale bundle 未走 __ModuleLoader__.load 装载协议", coordinate: candidates[0] };
          }
          const official = captured.factory((id) => {
            if (id === "react/jsx-runtime") return {};
            if (id === "react") return {};
            if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
            // defineStore 提供方按宿主版本二选一（新旧安装/回滚都可跑），调用形状相同。
            if (id === "@deepseek-ai/dsh-client-store") return { defineStore: (o) => o };
            if (id === "@deepseek-ai/dsh-client-runtime/client") return { defineStore: (o) => o };
            throw new Error("unexpected official require: " + id);
          });
          if (typeof official.LocaleRuntime !== "function") {
            return { state: "FAIL", reason: "官方 locale bundle 未导出 LocaleRuntime 类", coordinate: candidates[0] };
          }
          const provided = {};
          const settingsHost = {
            subscribe: () => () => {},
            getSnapshot: () => ({ value: undefined }),
            set: () => {}
          };
          await official.apply({
            effect: (fn) => { fn(); return () => {}; },
            provide: (name, svc) => { provided[name] = svc; },
            on: () => {},
            emit: () => {},
            slots: { installLocale: () => {}, inject: () => () => {}, register: () => () => {} },
            configForms: { get: () => settingsHost },
            settingsScope: { bind: () => settingsHost }
          });
          const locale = provided.locale;
          const shapeOk = locale
            && typeof locale.register === "function"
            && typeof locale.bind === "function"
            && typeof locale.setLocale === "function"
            && typeof locale.getLocale === "function";
          if (!shapeOk) {
            return { state: "FAIL", reason: "官方 apply 未提供形状完整的 locale 服务（register/bind/setLocale/getLocale）", coordinate: candidates[0] };
          }
          return { state: "PASS" };
        } catch (error) {
          return { state: "FAIL", reason: `真实调起官方 locale 运行时失败：${errMsg(error)}`, coordinate: candidates[0] };
        }
      });
    }
  },
  {
    id: "P-CTX-SERVICES",
    face: "HF-CTX-SERVICES",
    describe: "宿主服务容器：行为探针——真实实例化官方 ToolRuntime/SystemPrompt 断言服务名，＋官方 boot() 空树产出 baseUrl 经适配层回读",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      const names = await probeCtxServicesNamesStage(ctx.roots);
      if (names.state !== "PASS") return names;
      return probeCtxServicesBaseUrlStage(ctx.roots);
    }
  },
  {
    id: "P-HOST-RPC",
    face: "HF-HOST-RPC",
    describe: "宿主会话调用：公开 SessionController 经原生 adapter 校验 create/selectModel/prompt/inspect 形状，HTTP client-request 信封在位",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      const connFiles = libFiles(ctx.roots, "dsh-client-connection");
      if (!marker(connFiles, "client-request")) {
        return { state: "FAIL", reason: "dsh-client-connection 不含 client-request 信封标记（RPC 信封漂移）", coordinate: connFiles.slice(0, 3).join(" ; ") };
      }
      const loaded = await requireHostExport(ctx.roots, "dsh-api-session-controller", {
        exportName: "SessionController", missing: "dsh-api-session-controller 缺失",
        notExported: "官方宿主未导出 SessionController"
      });
      if (loaded.fail) return loaded.fail;
      const coordinate = "dsh-api-session-controller/lib/index.js:SessionController";
      try {
        const rpc = createNativeSessionRpc({
          get: name => name === "sessionController" ? loaded.mod.SessionController.prototype : undefined
        }, { timeoutMs: 1000 });
        if (rpc === null) return { state: "FAIL", reason: "SessionController 缺少公开实例方法", coordinate };
      } catch (error) {
        return { state: "FAIL", reason: errMsg(error), coordinate };
      }
      return { state: "PASS", coordinate };
    }
  },
  {
    id: "P-REVIEW-SESSION",
    face: "HF-REVIEW-SESSION",
    describe: "原生独立复核会话：AgentRegistry.create 与 scoped tools.restrict/register 公开形状在位",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      for (const [pkg, name, methods] of [
        ["dsh-agent", "AgentRegistry", ["create"]],
        ["dsh-tools", "ToolRuntime", ["restrict", "register"]]
      ]) {
        const loaded = await requireHostExport(ctx.roots, pkg, {
          exportName: name, missing: `${pkg} 缺失`, notExported: `${pkg} 未导出 ${name}`
        });
        if (loaded.fail) return loaded.fail;
        if (methods.some((method) => typeof loaded.mod[name].prototype[method] !== "function")) {
          return { state: "FAIL", reason: `${name} 的复核会话方法缺失`, coordinate: `${pkg}/lib/index.js` };
        }
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-SPAWN-CLI",
    face: "HF-SPAWN-CLI",
    describe: "spawn CLI：dsh --profile＋web-app --no-open＋DSH_HOME 语义标记在位",
    run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip("discoverDshCliDirs");
      const bins = ctx.cliDirs.map((dir) => join(dir, "lib", "bin.js"));
      if (!marker(bins, "--profile")) {
        return { state: "FAIL", reason: "dsh 启动器不含 --profile 旗标", coordinate: bins.join(" ; ") };
      }
      const webAppFiles = libFiles(ctx.roots, "dsh-web-app");
      if (!marker(webAppFiles, "--no-open")) {
        return { state: "FAIL", reason: "dsh-web-app 不含 --no-open 旗标（spawn CLI 形状漂移）", coordinate: webAppFiles.slice(0, 3).join(" ; ") };
      }
      const homePaths = libFiles(ctx.roots, "dsh-home-paths");
      if (!marker(homePaths, "DSH_HOME")) {
        return { state: "FAIL", reason: "dsh-home-paths 不含 DSH_HOME 语义标记", coordinate: homePaths.slice(0, 3).join(" ; ") };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-V2-LEDGER-FORMAT",
    face: "HF-V2-LEDGER-FORMAT",
    describe: "v2 台账落盘格式：events.jsonl 行级 append-only＋事件 schema/hash 链可复算＋投影可从盘重建",
    async run() {
      const home = mkdtempSync(join(tmpdir(), "dsh-probe-ledger-"));
      try {
        const ledger = createTaskLedger({ dshHome: home });
        const created = await ledger.command({
          op: "task.intake", taskId: "TK-probe0001", actor: { kind: "host", id: "web" },
          idempotencyKey: "probe-intake", payload: { class: "duty", brief: PROBE_BRIEF }
        });
        if (!created.ok) {
          return { state: "FAIL", reason: `台账命令面写入失败（${created.code}）：${created.reason}`, coordinate: "lib/org/task-ledger.js" };
        }
        ledger.close();
        const file = eventsFile(home);
        if (!existsSync(file)) {
          return { state: "FAIL", reason: "事件日志未落在登记坐标 bots/ledger/events.jsonl", coordinate: file };
        }
        const lines = readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "");
        if (lines.length !== 1) {
          return { state: "FAIL", reason: `append-only 落盘不是一事件一行（实读 ${String(lines.length)} 行）`, coordinate: file };
        }
        let event;
        try { event = JSON.parse(lines[0]); }
        catch { return { state: "FAIL", reason: "事件行不是合法 JSON", coordinate: file }; }
        const schema = validateEventRecord(event, 0);
        if (!schema.ok) {
          return { state: "FAIL", reason: `事件 schema/哈希链不符（${schema.reason}）`, coordinate: file };
        }
        // 投影可从盘重建（门面无内存态：新建门面读同一数据根＝重启语义；读侧校验 hash 链）
        const view = createTaskLedger({ dshHome: home, lockSpinMs: 0 }).view();
        if (view.tasks.length !== 1 || view.tasks[0].status !== "intake" || view.lastSeq !== 1) {
          return { state: "FAIL", reason: "从落盘事件重建投影与写入结论不符", coordinate: file };
        }
        // 改动检出：链被改后读侧必须 fail closed（否则格式门形同虚设）
        writeFileSync(file, `${JSON.stringify({ ...event, type: "triage" })}\n`);
        let detected = false;
        try { createTaskLedger({ dshHome: home, lockSpinMs: 0 }).view(); } catch { detected = true; }
        if (!detected) {
          return { state: "FAIL", reason: "事件链被改动后读侧未 fail closed（格式漂移不可检出）", coordinate: file };
        }
        return { state: "PASS", coordinate: "bots/ledger/events.jsonl" };
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    }
  },
  {
    id: "P-LEDGER-COMMANDS",
    face: "HF-LEDGER-COMMANDS",
    describe: "v2 台账命令面：host 路由在位＋命令信封与拒绝形状（fail closed）＋bot 无台账直写通道",
    async run() {
      const repoRoot = new URL("..", import.meta.url);
      const indexPath = new URL("lib/index.js", repoRoot);
      let index = "";
      try { index = readFileSync(indexPath, "utf8"); }
      catch { return { state: "FAIL", reason: "lib/index.js 不可读（宿主接线面缺失）", coordinate: String(indexPath) }; }
      if (!index.includes('"_ledger"')) {
        return { state: "FAIL", reason: "宿主未注册 /api/bots/_ledger 命令面路由", coordinate: String(indexPath) };
      }
      // bot 无台账文件直写通道：写路径只许在台账模块内出现
      const libDir = fileURLToPath(new URL("lib/", repoRoot));
      const offenders = [];
      const scan = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) { scan(full); continue; }
          if (!entry.name.endsWith(".js")) continue;
          const rel = full.slice(libDir.length);
          if (rel === join("org", "task-ledger.js")) continue;
          let text = "";
          try { text = readFileSync(full, "utf8"); } catch { continue; }
          if (text.includes("appendJsonlLine(") && text.includes("eventsFile(")) offenders.push(rel);
        }
      };
      scan(libDir);
      if (offenders.length > 0) {
        return { state: "FAIL", reason: `台账事件日志出现第二写通道（bot 直写风险）：${offenders.join("、")}`, coordinate: "lib/**" };
      }
      // 命令信封与拒绝形状（fail closed：状态不变＋code/reason）
      const home = mkdtempSync(join(tmpdir(), "dsh-probe-ledger-cmd-"));
      try {
        const ledger = createTaskLedger({ dshHome: home });
        const created = await ledger.command({
          op: "task.intake", taskId: "TK-probe0002", actor: { kind: "host", id: "web" },
          idempotencyKey: "probe-cmd-intake", payload: { class: "duty", brief: PROBE_BRIEF }
        });
        if (!created.ok || created.status !== "intake" || !Number.isInteger(created.seq)) {
          return { state: "FAIL", reason: `命令面成功形状不符（{ok,taskId,status,seq}）：${JSON.stringify(created)}`, coordinate: "lib/org/ledger-host.js" };
        }
        const rejected = await ledger.command({
          op: "task.close", taskId: "TK-probe0002", actor: { kind: "host", id: "web" },
          expectedStatus: "intake", expectedSeq: 1, idempotencyKey: "probe-cmd-close", payload: {}
        });
        if (rejected.ok !== false || typeof rejected.code !== "string" || typeof rejected.reason !== "string") {
          return { state: "FAIL", reason: `拒绝形状不符（须 {ok:false,code,reason}）：${JSON.stringify(rejected)}`, coordinate: "lib/org/ledger-host.js" };
        }
        ledger.close();
        if (ledger.task("TK-probe0002").status !== "intake") {
          return { state: "FAIL", reason: "拒绝未 fail closed：状态被改写", coordinate: "lib/org/task-ledger.js" };
        }
        return { state: "PASS", coordinate: "POST /api/bots/_ledger/commands" };
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    }
  },
  {
    id: "P-SESSION-LOG",
    face: "HF-SESSION-LOG",
    describe: "会话日志面：行为探针——本机最新真实会话日志经 lib/stats.js 读取解析实调（多帧 zstd→事件形状→四大投影）",
    run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip("discoverDshCliDirs");
      return probeSessionLogStage(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
    }
  },
  {
    id: "P-SHELL-OVERLAY-GEOMETRY",
    face: "HF-SHELL-OVERLAY-GEOMETRY",
    describe: "整屏层几何与层叠语义：行为探针——真实 apply 官方 layout bundle，从运行期注入样式断言层本体整屏几何档（position:absolute／inset:0／z-index:20／pointer-events:none＋>* auto；类名按几何语义签名反解），再由各官方浮层 bundle 的注入样式实测 z-index 构成（官方浮层须全在整屏层之上），同层 order 升序以真实 SlotCore 实跑；我方 portal 锚点与祖先链「无 transform 类属性」属渲染期坐标——显式降级归 V-A6.8 人工目视清单",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      return probeShellOverlayGeometryStage(ctx.roots);
    }
  },
  {
    id: "P-HOST-TRANSITION-TOKENS",
    face: "HF-HOST-TRANSITION-TOKENS",
    describe: "过渡令牌族：行为探针——真实 apply 官方 theme bundle，从运行期注入样式取 `--ds-transition-duration(-fast/-slow)` 与 `--ds-ease-in-out`，断言存在性与取值形状（时间量／缓动函数）；宿主无 `--dsw-*` 动效令牌",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      return probeHostTransitionTokensStage(ctx.roots);
    }
  },
  {
    id: "P-SHELL-FOCUS-LAYER",
    face: "HF-SHELL-FOCUS-LAYER",
    describe: "焦点／键盘隔离面：行为探针——真实装载官方 primitives 实包（构建产物依赖以 loader 桩替换）断言 `useModalLayer`／`modalSelector`／`closeTopModal`／`isBehindModal` 导出在位且 `modalSelector` 字面精确，再以合成 DOM 实调 `useModalLayer`：焦点入园／`[inert]` 子树排除／Tab 囚笼／Escape 只关栈顶／LIFO 焦点归还／被盖元素让键；真实浏览器 inert 语义——显式降级归 V-A6.8 人工目视清单",
    async run(ctx) {
      if (!ctx.hostInstalled) return noHostSkip();
      return probeShellFocusLayerStage(ctx.roots);
    }
  }
];

// ---------------- 汇总与门判定（纯函数，测试面） ----------------

export function parseFaceMode(argv = process.argv, env = process.env) {
  const flag = argv.find((arg) => arg.startsWith("--face="));
  if (flag) {
    const mode = flag.slice("--face=".length);
    if (mode === "dev" || mode === "deploy") return mode;
  }
  if (env.DSH_BOTS_PROBE_FACE === "deploy") return "deploy";
  return "dev";
}

/**
 * 汇总判定：FAIL>0 → 门红；部署面 SKIP 视同 FAIL。返回
 * { counts: {pass, fail, skip}, gatePass, blockingSkips }。
 */
export function summarizeGate(results, { face = "dev" } = {}) {
  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const r of results) counts[r.state.toLowerCase()] += 1;
  const blockingSkips = face === "deploy" ? counts.skip : 0;
  const gatePass = counts.fail === 0 && blockingSkips === 0;
  return { counts, gatePass, blockingSkips };
}

/** 登记表↔门一致性：非 C、非 pending 面的探针必须有实现；否则记 FAIL。 */
export function registryGateChecks(faces = HOST_FACES, probes = HOST_CONTRACT_PROBES) {
  const problems = [];
  const implemented = new Set(probes.map((p) => p.id));
  for (const face of faces) {
    if (face.category === "C") continue;
    if (face.pending) continue;
    if (!implemented.has(face.probeId)) {
      problems.push({ probeId: face.probeId, face: face.id, state: "FAIL", reason: `登记表探针 ${face.probeId}（面 ${face.id}）在门脚本中无实现（登记表↔门漂移）` });
    }
  }
  for (const probe of probes) {
    const face = faces.find((f) => f.id === probe.face);
    if (!face) {
      problems.push({ probeId: probe.id, face: probe.face, state: "FAIL", reason: `探针 ${probe.id} 引用的面 ${probe.face} 未在登记表登记` });
    }
  }
  return problems;
}

export function pendingFaces(faces = HOST_FACES) {
  return faces.filter((face) => face.pending);
}

// ---------------- 主流程 ----------------

async function runGate({ face, reportFile } = {}) {
  const ctx = makeProbeContext();
  const hostVersion = readHostVersionDiagnostic(ctx.cliDirs);
  const results = [];
  for (const probe of HOST_CONTRACT_PROBES) {
    try {
      const r = await probe.run(ctx);
      results.push({ probeId: probe.id, face: probe.face, describe: probe.describe, ...r });
    } catch (error) {
      results.push({
        probeId: probe.id, face: probe.face, describe: probe.describe,
        state: "FAIL", reason: `探针自身异常：${errMsg(error)}`
      });
    }
  }
  const registryProblems = registryGateChecks().map((p) => ({
    probeId: p.probeId, face: p.face, describe: "登记表↔门一致性", state: p.state, reason: p.reason
  }));
  const all = [...results, ...registryProblems];
  const { counts, gatePass, blockingSkips } = summarizeGate(all, { face });

  const lines = [];
  lines.push(`宿主契约门（face=${face}）：`);
  if (hostVersion !== null) {
    lines.push(`  [诊断] 宿主版本 ${hostVersion}（仅归因用，不参与门判定）`);
  } else {
    lines.push("  [诊断] 宿主版本未知（未发现安装）");
  }
  for (const r of all) {
    const tag = r.state === "PASS" ? "PASS" : r.state === "SKIP" ? "SKIP" : "FAIL";
    const where = r.coordinate ? `（坐标：${r.coordinate}）` : "";
    lines.push(`  ${tag} ${r.probeId} [${r.face}]：${r.describe}${r.state === "PASS" ? "" : `——${r.reason ?? ""}${where}`}`);
  }
  const pending = pendingFaces();
  if (pending.length > 0) {
    lines.push(`  [待接线] ${pending.map((f) => `${f.id}（${f.pending}，探针 ${f.probeId} 未运行）`).join("；")}——不计入三态`);
  }
  lines.push(`宿主契约门: ${counts.pass} PASS / ${counts.fail} FAIL / ${counts.skip} SKIP${face === "deploy" ? "（部署面：SKIP 视同 FAIL）" : ""}`);
  if (!gatePass) {
    lines.push(face === "deploy" && blockingSkips > 0 && counts.fail === 0
      ? "宿主契约门: FAIL（部署面上 SKIP 视同失败）"
      : "宿主契约门: FAIL");
  }

  if (reportFile) {
    const { writeFileDurable } = await import("../lib/org/store-base.js");
    writeFileDurable(reportFile, `${JSON.stringify({
      face, gatePass, counts, diagnostics: { hostVersion }, results: all,
      pending: pending.map((f) => ({ id: f.id, note: f.pending }))
    }, null, 2)}\n`);
  }
  return { lines, gatePass };
}

if (isMain) {
  const face = parseFaceMode();
  const reportFlag = process.argv.find((arg) => arg.startsWith("--report="));
  try {
    const { lines, gatePass } = await runGate({ face, reportFile: reportFlag ? reportFlag.slice("--report=".length) : null });
    console.log(lines.join("\n"));
    process.exit(gatePass ? 0 : 1);
  } catch (error) {
    console.error(`宿主契约门: 门自身错误（${errMsg(error)}）`);
    process.exit(2);
  }
}
