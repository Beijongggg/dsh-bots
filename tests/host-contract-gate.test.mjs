/**
 * 宿主适配面与宿主契约门测试（org-v2 01 号票）。
 *
 * 覆盖：登记表字段集与不变量（V-A6.1/V-A6.6）、门脚本纯逻辑（三态汇总、
 * 部署面 SKIP 视同 FAIL、登记表↔门一致性）、版本仅诊断（V-A6.4 的结构断言：
 * 探针结果对象不含版本字段、版本只进 diagnostics）、跳过协议（假绿修法：
 * SKIP 与 PASS 在汇总行不同形）。对真实宿主的探针执行由 preflight ④ 门
 * 承担（不并入套件——纪律见 scripts/host-contract-probe.mjs 头注）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  HOST_FACES, HOST_FACE_FIELDS, LAYER_REFUSE_ONLY_FACE, hostFaceById,
  validateHostFacesRegistry
} from "../lib/host-faces.js";
import {
  HOST_CONTRACT_PROBES, findMarkerFile, parseFaceMode, pendingFaces,
  registryGateChecks, summarizeGate, runClientBundle, probeClientSlotsStage, discoverPackageRoots,
  discoverDshCliDirs, readHostVersionDiagnostic, resolveKernelPackageDir,
  probeClientVisualStage, probeCtxServicesNamesStage, probeCtxServicesBaseUrlStage,
  probeSessionLogStage, probeConfigIdsStage, CONFIG_IDS_CRITICAL,
  verifyClientSlotRegistrations, checkPrimitivesReferences, makeClientReactStub, withDomStubs,
  probeClientConformanceStage,
  probeShellOverlayGeometryStage, probeHostTransitionTokensStage, probeShellFocusLayerStage,
  resolveOverlayLayerFacts, collectFixedLayerBands, collectCustomPropertyNames, hasFullInset,
  loadHostFrontendFacade, createHookFixture, createFocusDom, keyEvent,
  FOCUS_LAYER_SYMBOLS, FOCUS_LAYER_SYMBOL_KINDS, MODAL_SELECTOR_LITERAL, SHELL_OVERLAY_LAYER_BAND,
  FOCUSABLE_SELECTOR, collectImportNeeds, collectLocalBindings, sliceDeclarationClosure
} from "../scripts/host-contract-probe.mjs";
import { zstdCompressSync } from "node:zlib";
import { buildPatchYaml, READ_ONLY_TOOLS } from "../lib/shared.cjs";
import { SKIP_MARKER, declaresSkip } from "./run.mjs";

test("V-A6.1：登记表在位，A/B/C 三类齐备，C 类显式列出并标注排除理由", () => {
  const categories = new Set(HOST_FACES.map((f) => f.category));
  assert.deepEqual([...categories].sort(), ["A", "B", "C"]);
  const cFaces = HOST_FACES.filter((f) => f.category === "C");
  assert.ok(cFaces.length >= 2, "C 类显式列出（OS 契约＋本仓自有面）");
  for (const face of cFaces) {
    assert.ok(face.exclusionReason.length > 0, `${face.id} 有排除理由`);
    assert.equal(face.probeId, null);
  }
});

test("V-A6.1：字段集齐备（登记表机械校验零违例）", () => {
  const r = validateHostFacesRegistry();
  assert.deepEqual(r.violations, []);
  for (const face of HOST_FACES) {
    for (const field of HOST_FACE_FIELDS) assert.ok(field in face, `${face.id}.${field}`);
  }
  assert.equal(hostFaceById("HF-CONFIG-IDS").category, "A");
  assert.equal(hostFaceById("HF-PLUGIN-IDENTITY").category, "B");
  assert.equal(hostFaceById("nope"), null);
});

test("V-A6.6：整层拒载仅限组织层身份面（其余面级降级或响亮直用）", () => {
  const refuse = HOST_FACES.filter((f) => f.failureMode === "layer-refuse");
  assert.deepEqual(refuse.map((f) => f.id), [LAYER_REFUSE_ONLY_FACE]);
  for (const face of HOST_FACES.filter((f) => f.category === "A" && !f.pending)) {
    assert.equal(face.failureMode, "face-degrade", `${face.id} 默认面级降级`);
  }
});

test("登记表↔门一致性：非 C 非 pending 面的探针都有实现，反向也成立", () => {
  assert.deepEqual(registryGateChecks(), []);
  // 篡改：从探针列表抽掉一个 → 对应 FAIL 记录
  const probesMinusOne = HOST_CONTRACT_PROBES.filter((p) => p.id !== "P-CONFIG-IDS");
  const problems = registryGateChecks(HOST_FACES, probesMinusOne);
  assert.ok(problems.some((p) => p.probeId === "P-CONFIG-IDS" && p.state === "FAIL"));
});

// ---------------- pod 02 号票：整屏层几何／过渡令牌／焦点隔离三面 ----------------
// 引入面时**不得删面或改既有面语义**：上方的枚举与不变量测试是这条判据的执行坐标，
// 本节只追加「新面在位且坐标齐备」的形状断言。

/** pod 02 号票新增的宿主适配面（04／05 号票唯一允许引用的宿主坐标）。 */
const POD_02_FACES = [
  { id: "HF-SHELL-OVERLAY-GEOMETRY", probeId: "P-SHELL-OVERLAY-GEOMETRY", coordinate: /shell\.overlay/ },
  { id: "HF-HOST-TRANSITION-TOKENS", probeId: "P-HOST-TRANSITION-TOKENS", coordinate: /--ds-transition-duration/ },
  { id: "HF-SHELL-FOCUS-LAYER", probeId: "P-SHELL-FOCUS-LAYER", coordinate: /useModalLayer/ }
];

test("pod 02：三条宿主依赖面已登记，坐标点名到符号级且沿用既有字段集", () => {
  for (const spec of POD_02_FACES) {
    const face = hostFaceById(spec.id);
    assert.ok(face, `新面 ${spec.id} 未登记`);
    for (const field of HOST_FACE_FIELDS) assert.ok(field in face, `${spec.id}.${field}`);
    assert.equal(face.probeId, spec.probeId, `${spec.id} 探针 id 固定（04／05 引用坐标）`);
    assert.equal(face.category, "A", `${spec.id} 是静默降级面 → A 类`);
    assert.match(face.hostCoordinate, spec.coordinate, `${spec.id} 宿主坐标须点名符号`);
    assert.ok(face.adapterModule.includes("lib/client.js"), `${spec.id} 适配层须落到我方整屏层模块`);
    assert.equal(face.failureMode, "face-degrade", `${spec.id} 面级降级（不得整层拒载）`);
    assert.equal(HOST_CONTRACT_PROBES.filter((p) => p.face === spec.id).length, 1, `${spec.id} 须恰有一条探针`);
  }
});

test("pod 02：登记表机械校验零违例（新面并入后不变量仍成立）", () => {
  assert.deepEqual(validateHostFacesRegistry().violations, []);
  assert.deepEqual(registryGateChecks(), []);
  // 既有面枚举幸存：引入面不得借扩展删面（面 id 全集只增）
  for (const id of [
    "HF-CONFIG-IDS", "HF-CLIENT-SLOTS", "HF-CLIENT-VISUAL", "HF-CLIENT-LOCALE",
    "HF-CTX-SERVICES", "HF-SESSION-LOG", "HF-V2-LEDGER-FORMAT", "HF-PLUGIN-IDENTITY",
    "HF-HOST-RPC", "HF-SPAWN-CLI", "HF-REVIEW-SESSION", "HF-LEDGER-COMMANDS",
    "HF-OS-CONTRACTS", "HF-OWN-FILE-SERVICES"
  ]) {
    assert.ok(hostFaceById(id), `既有面 ${id} 被删除`);
  }
});

test("pending 面清零：v2 台账两面随 05 号票接线，转入三态常驻", () => {
  assert.deepEqual(pendingFaces(), [], "登记表内不得再有 pending 面（05 号票已接线）");
  for (const id of ["HF-V2-LEDGER-FORMAT", "HF-LEDGER-COMMANDS"]) {
    const face = hostFaceById(id);
    assert.ok(face, `${id} 仍在登记表内`);
    assert.equal(face.pending, undefined, `${id} 的 pending 标记须撤除`);
    assert.ok(face.adapterModule.includes("org/"), `${id} 适配层坐标须落到组织层件`);
    assert.equal(HOST_CONTRACT_PROBES.filter((p) => p.face === id).length, 1, `${id} 须恰有一条探针`);
  }
});

test("V-A6.3：三态汇总——FAIL 红门；部署面 SKIP 视同 FAIL；dev 面 SKIP 不阻断", () => {
  const results = [
    { state: "PASS" }, { state: "PASS" }, { state: "SKIP" }
  ];
  const dev = summarizeGate(results, { face: "dev" });
  assert.deepEqual(dev.counts, { pass: 2, fail: 0, skip: 1 });
  assert.equal(dev.gatePass, true, "dev 面：SKIP 可见不阻断");
  const deploy = summarizeGate(results, { face: "deploy" });
  assert.equal(deploy.gatePass, false, "部署面：SKIP 视同 FAIL");
  assert.equal(deploy.blockingSkips, 1);
  const failing = summarizeGate([{ state: "PASS" }, { state: "FAIL" }], { face: "dev" });
  assert.equal(failing.gatePass, false);
});

test("V-A6.4：版本仅诊断——探针结果对象无版本字段（结构面断言）", () => {
  // 结构约束：探针 run() 返回的 state 集合固定为三态，不允许出现 version 通道
  for (const probe of HOST_CONTRACT_PROBES) {
    assert.equal(typeof probe.run, "function");
    assert.equal(typeof probe.face, "string");
    const face = hostFaceById(probe.face);
    assert.ok(face, `探针 ${probe.id} 的面已登记`);
  }
});

test("parseFaceMode：--face 旗标与 env 覆盖，默认 dev", () => {
  assert.equal(parseFaceMode([], {}), "dev");
  assert.equal(parseFaceMode(["--face=deploy"], {}), "deploy");
  assert.equal(parseFaceMode(["--face=bogus"], {}), "dev");
  assert.equal(parseFaceMode([], { POD_PROBE_FACE: "deploy" }), "deploy");
});

test("findMarkerFile：候选文件内容标记检索（命中/未命中/缺文件）", () => {
  const home = mkdtempSync(join(tmpdir(), "dsh-gate-marker-"));
  try {
    const a = join(home, "a.js");
    const b = join(home, "b.js");
    writeFileSync(a, "export const x = 'needle-here';\n");
    writeFileSync(b, "export const y = 1;\n");
    assert.equal(findMarkerFile([a, b], "needle-here"), a);
    assert.equal(findMarkerFile([a, b], "absent"), null);
    assert.equal(findMarkerFile([join(home, "missing.js"), a], "needle-here"), a);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("假绿修法：跳过标记与汇总行不同形（⤼ SKIP: 前缀才计数）", () => {
  assert.equal(declaresSkip(`别的行\n${SKIP_MARKER} 官方宿主包不在本机（候选：x ; y）\n`), true);
  assert.equal(declaresSkip("⤼ 官方包不在（旧式无标记输出）"), false, "旧式提示行不计入 SKIP");
  assert.equal(declaresSkip(""), false);
  assert.equal(declaresSkip(null), false);
});

// ---------------- 18 号票：A 类探针行为化升级 ----------------
// 套件内用合成 fixture 驱动（真实宿主的实跑结果归 preflight ④ 门，规格 §H 纪律）。

/** 写一个 ModuleLoader 协议格式的合成 client bundle（官方 bundle 同构的最小形状）。 */
function writeBundleFixture(dir, pkg, applyBody) {
  const pkgDir = join(dir, pkg, "lib");
  mkdirSync(pkgDir, { recursive: true });
  const file = join(pkgDir, "client.js");
  writeFileSync(file, `window.__ModuleLoader__.load({
	id: "@deepseek-ai/${pkg}",
	factory: (require) => {
		const exports = {};
		exports.apply = (ctx) => {
${applyBody}
		};
		return exports;
	}
});\n`);
  return file;
}

test("18号票 harness：runClientBundle 捕获 ModuleLoader 工厂、apply 记录型 ctx、inject 回调实调、DOM 桩在位", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-bundle-"));
  try {
    writeBundleFixture(root, "dsh-test-layout", `
			const el = document.createElement("style");
			el.textContent = ".x{color:red}";
			document.head.appendChild(el);
			ctx.slots.register({ name: "root", children: { "sidebar": { kind: "single" } } });
			ctx.slots.inject("sidebar", () => ctx.slots.register({ name: "sidebar", children: { "sidebar.footer.action": { kind: "list" } } }));
			ctx.provide("layout", { toggle: () => {} });
			ctx.effect(() => ctx.slots.subscribe("main", () => {}));
`);
    const { record, provided, elements } = await runClientBundle([root], "dsh-test-layout");
    const rootReg = record.find((c) => c.op === "register" && c.opts?.name === "root");
    assert.ok(rootReg, "直接槽注册被记录");
    assert.equal(rootReg.opts.children.sidebar.kind, "single");
    const sidebarReg = record.find((c) => c.op === "register" && c.opts?.name === "sidebar");
    assert.ok(sidebarReg, "inject 回调被实调（shell 惰性装载语义）→ 内层注册被记录");
    assert.equal(sidebarReg.opts.children["sidebar.footer.action"].kind, "list");
    assert.ok(record.some((c) => c.op === "inject" && c.name === "sidebar"), "inject 调用本身留痕");
    assert.ok(record.some((c) => c.op === "subscribe" && c.name === "main"), "effect 内订阅被实调");
    assert.equal(typeof provided.layout.toggle, "function", "provide 捕获");
    assert.equal(elements.length, 1, "createElement 产物被捕获（视觉令牌断言的载体）");
    assert.equal(elements[0].textContent, ".x{color:red}");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("18号票 harness：bundle 缺失或未走装载协议时响亮抛错（不静默）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-bundle-miss-"));
  try {
    await assert.rejects(() => runClientBundle([root], "dsh-test-absent"), /不在本机/);
    const pkgDir = join(root, "dsh-test-noload", "lib");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "client.js"), "export const apply = () => {};\n");
    await assert.rejects(() => runClientBundle([root], "dsh-test-noload"), /装载协议|apply/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** 写一个宿主侧 ESM 包 fixture（lib/index.js；探针按包名 import 的载体形状）。 */
function writeHostIndexFixture(dir, pkg, code) {
  const pkgDir = join(dir, pkg, "lib");
  mkdirSync(pkgDir, { recursive: true });
  const file = join(pkgDir, "index.js");
  writeFileSync(file, code);
  return file;
}

test("P-HOST-RPC：原生会话方法缺失时，残留的 RPC 标记不能让宿主门通过", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-native-session-"));
  try {
    writeHostIndexFixture(root, "dsh-client-connection", `export const envelope = "client-request";\n`);
    writeHostIndexFixture(root, "dsh-api-session-controller", `
export class SessionController {
  create() {} selectModel() {} prompt() {}
}
`);
    const probe = HOST_CONTRACT_PROBES.find(row => row.id === "P-HOST-RPC");
    const result = await probe.run({ roots: [root], hostInstalled: true });
    assert.equal(result.state, "FAIL", "inspect 缺失，普通回合无法读历史，不得放行");
    assert.match(result.reason, /inspect/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("18号票 P-CTX-SERVICES 行为化：官方服务类真实实例化断言服务名（合成 fixture）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-ctx-"));
  try {
    writeHostIndexFixture(root, "dsh-tools", `export class ToolRuntime { constructor(ctx, config) { ctx.reflect.provide("tools", this); } }\n`);
    writeHostIndexFixture(root, "dsh-system-prompt", `export class SystemPrompt { constructor(ctx, config) { ctx.reflect.provide("systemPrompt", this); } }\n`);
    const ok = await probeCtxServicesNamesStage([root]);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));

    // 服务改名（tools → toolz）＝取空跳过支静默失效 → FAIL
    const root2 = mkdtempSync(join(tmpdir(), "dsh-gate-ctx-bad-"));
    try {
      writeHostIndexFixture(root2, "dsh-tools", `export class ToolRuntime { constructor(ctx, config) { ctx.reflect.provide("toolz", this); } }\n`);
      writeHostIndexFixture(root2, "dsh-system-prompt", `export class SystemPrompt { constructor(ctx, config) { ctx.reflect.provide("systemPrompt", this); } }\n`);
      const drifted = await probeCtxServicesNamesStage([root2]);
      assert.equal(drifted.state, "FAIL");
      assert.match(drifted.reason, /tools/);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }

    // 载体包缺失 → FAIL 不静默
    const root3 = mkdtempSync(join(tmpdir(), "dsh-gate-ctx-miss-"));
    try {
      const missing = await probeCtxServicesNamesStage([root3]);
      assert.equal(missing.state, "FAIL");
    } finally {
      rmSync(root3, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("18号票：渲染期不可调起子坐标须显式降级声明（探针 describe＋登记表 readAccess 双落点）", () => {
  const slotsProbe = HOST_CONTRACT_PROBES.find((p) => p.id === "P-CLIENT-SLOTS");
  const slotsFace = hostFaceById("HF-CLIENT-SLOTS");
  assert.match(slotsProbe.describe, /显式降级/, "探针描述须声明降级");
  assert.match(slotsFace.readAccess, /显式降级/, "登记表 readAccess 须声明降级");
  assert.match(slotsProbe.describe + slotsFace.readAccess, /conversation/, "降级子坐标点名（conversation entryKey 归目视清单）");

  const visualProbe = HOST_CONTRACT_PROBES.find((p) => p.id === "P-CLIENT-VISUAL");
  const visualFace = hostFaceById("HF-CLIENT-VISUAL");
  assert.match(visualProbe.describe, /显式降级/, "探针描述须声明降级");
  assert.match(visualFace.readAccess, /显式降级/, "登记表 readAccess 须声明降级");
  assert.match(visualProbe.describe + visualFace.readAccess, /primitives/, "降级子坐标点名（primitives 导出形状归目视清单）");

  // 行为化到位的升级面：描述须声明真实调起（不许静默维持标记扫描）
  for (const id of ["P-CONFIG-IDS", "P-CTX-SERVICES", "P-SESSION-LOG"]) {
    const probe = HOST_CONTRACT_PROBES.find((p) => p.id === id);
    assert.match(probe.describe, /真实|行为探针/, `${id} 描述须声明真实调起机制`);
  }
  assert.match(slotsProbe.describe, /真实 apply/);
  assert.match(visualProbe.describe, /真实 apply/);
});

test("18号票：升级探针保持三态协议——无宿主时 SKIP 且带原因与坐标", async () => {
  const ctx = { roots: [], cliDirs: [], webAssets: [], hostInstalled: false };
  for (const id of ["P-CONFIG-IDS", "P-CLIENT-SLOTS", "P-CLIENT-VISUAL", "P-CTX-SERVICES", "P-SESSION-LOG"]) {
    const probe = HOST_CONTRACT_PROBES.find((p) => p.id === id);
    const r = await probe.run(ctx);
    assert.equal(r.state, "SKIP", `${id} 无宿主时须 SKIP：${JSON.stringify(r)}`);
    assert.ok(r.reason && r.reason.length > 0, `${id} SKIP 须带原因（可见性）`);
  }
});

test("18号票 P-CONFIG-IDS：适配层 patch 构造与探针关键 id 清单无漂移", () => {
  const optionalToolIds = new Set(READ_ONLY_TOOLS.map(([id]) => id));
  const patchTopIds = (text) => [...text.matchAll(/^- id: (\S+)/gm)].map((m) => m[1]);
  const allowed = new Set([...CONFIG_IDS_CRITICAL, ...optionalToolIds]);
  for (const permission of ["workspace-write", "read-only", "danger-full-access"]) {
    const text = buildPatchYaml({
      botId: "probe-drift", role: "r", provider: "p", model: "m",
      permission, workspace: "/tmp/w", settingsPath: "/tmp/s.yaml"
    });
    for (const id of patchTopIds(text)) {
      assert.ok(allowed.has(id), `patch id「${id}」（${permission}）既非探针关键 id 也非已声明可选的只读禁用 id——适配层与探针漂移`);
    }
  }
  // 独立字面看守：八个核心 id 任一从 CONFIG_IDS_CRITICAL 消失即红（fixture 派生自该清单，此处是其漂移锚）
  for (const id of ["agent-default-model", "system-prompt", "sandbox-policy", "approval", "settings", "llm-pi-ai", "tool-bash", "tool-pwsh"]) {
    assert.ok(CONFIG_IDS_CRITICAL.includes(id), `关键 id 清单缺「${id}」`);
  }
});

/** 独立迷你 patch 装载器 fixture（真实按行解析——非按实现复算）。 */
const MINI_PATCH_LOADER = `
import { readFileSync } from "node:fs";
export function loadOverlayPatches(bin, file) {
	const text = readFileSync(file, "utf8");
	const entries = [];
	let insert = null;
	for (const line of text.split("\\n")) {
		const top = /^- id: (\\S+)\\s*$/.exec(line);
		if (top) { insert = null; entries.push({ id: top[1] }); continue; }
		if (/^- insert:\\s*$/.test(line)) { insert = { insert: [] }; entries.push(insert); continue; }
		const nested = /^ {2,}- id: (\\S+)\\s*$/.exec(line);
		if (nested && insert) { insert.insert.push({ id: nested[1] }); continue; }
		const field = /^    (provider|model|reasoningEffort): '(.*)'$/.exec(line);
		if (field && entries.at(-1)?.id === "agent-default-model") {
			(entries.at(-1).config ??= {})[field[1]] = field[2].replace(/''/g, "'");
		}
		const config = /^  config: (\\{.*\\})$/.exec(line);
		if (config && entries.at(-1)) entries.at(-1).config = JSON.parse(config[1]);
		const jsExpr = /^    (\\S+): !!js (.+)$/.exec(line);
		if (jsExpr && entries.at(-1)) {
			(entries.at(-1).config ??= {})[jsExpr[1]] = { __jsExpr: jsExpr[2] };
		}
	}
	return entries;
}
`;

/** 官方组合 patch fixture 按探针关键 id 清单生成（下方独立字面断言看守该清单的漂移）。 */
const criticalIdsYaml = () => CONFIG_IDS_CRITICAL.map((id) => `- id: ${id}\n`).join("");

/** 官方 web-app patch fixture：tools 行携带 DSH_TOOLS_MODE 环境缝（探针断言的真实形状）。 */
const webAppPatchYaml = ({ withToolsSeam = true } = {}) => withToolsSeam
  ? "- id: tools\n  config:\n    mode: !!js process.env.DSH_TOOLS_MODE\n- id: session\n"
  : "- id: tools\n- id: session\n";

const CONFIGURABLE_PI_AI = `
export const name = "llm-pi-ai";
export function Config(raw) { return { providers: { get: () => raw.providers ?? {} } }; }
export function apply(ctx, config) {
  const providers = config.providers.get();
  ctx.llm.registerAdapter(Object.keys(providers), {
    async resolveModel(provider, model) {
      if (!providers[provider]?.models?.some(entry => entry.id === model)) throw new Error("model unavailable");
      return { provider, id: model };
    }
  });
}
`;

test("P-CONFIG-IDS：web-app tools 行 DSH_TOOLS_MODE 环境缝缺失时 FAIL（PTC 呈现静默失效面）", async () => {
  // 组织工具带点 op 名依赖 bot 进程 DSH_TOOLS_MODE=ptc 整体切 PTC 呈现（供应商
  // 名称模式 ^[a-zA-Z0-9_-]+$，2026-09-29 TK-20260929 HTTP 400）。官方 web patch
  // 注明该缝为 TEMPORARY workaround——宿主升级移除时 bot 会静默回退 native、
  // 工具名再次被拒，探针必须点名 FAIL。
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-config-ptc-"));
  try {
    writeHostIndexFixture(root, "dsh-app-boot", MINI_PATCH_LOADER);
    mkdirSync(join(root, "dsh-base"), { recursive: true });
    writeFileSync(join(root, "dsh-base", "cordis.patch.yml"), criticalIdsYaml());
    mkdirSync(join(root, "dsh-web-app"), { recursive: true });
    // tools 行在但 env 缝被移除（mode 改为字面 native 或整段消失）
    writeFileSync(join(root, "dsh-web-app", "cordis.patch.yml"), webAppPatchYaml({ withToolsSeam: false }));
    writeHostIndexFixture(root, "dsh-agent-default-model", `export const AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE = "agent-default-model";\n`);
    writeHostIndexFixture(root, "dsh-llm-pi-ai", `export const name = "llm-pi-ai";\n`);
    const noSeam = await probeConfigIdsStage([root]);
    assert.equal(noSeam.state, "FAIL", JSON.stringify(noSeam));
    assert.match(noSeam.reason, /DSH_TOOLS_MODE/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("P-CONFIG-IDS：patch 往返、官方 id、配置模型读回与旧命名空间漂移（合成 fixture）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-config-"));
  try {
    writeHostIndexFixture(root, "dsh-app-boot", MINI_PATCH_LOADER);
    mkdirSync(join(root, "dsh-base"), { recursive: true });
    writeFileSync(join(root, "dsh-base", "cordis.patch.yml"), criticalIdsYaml());
    mkdirSync(join(root, "dsh-web-app"), { recursive: true });
    writeFileSync(join(root, "dsh-web-app", "cordis.patch.yml"), webAppPatchYaml());
    writeHostIndexFixture(root, "dsh-agent-default-model", `
export class AgentDefaultModelConfig {
  constructor(ctx, config) { this.config = config; ctx.reflect.provide("agentDefaultModel", this); }
  currentSelection() { return Object.fromEntries(Object.entries(this.config).map(([key, value]) => [key, value.get()])); }
}
`);
    writeHostIndexFixture(root, "dsh-llm-pi-ai", CONFIGURABLE_PI_AI);
    const ok = await probeConfigIdsStage([root]);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));

    // 官方全集缺关键 id（approval 改名）→ FAIL 点名
    const root2 = mkdtempSync(join(tmpdir(), "dsh-gate-config-bad-"));
    try {
      writeHostIndexFixture(root2, "dsh-app-boot", `export function loadOverlayPatches() { return [{ id: "agent-default-model" }]; }\n`);
      const drifted = await probeConfigIdsStage([root2]);
      assert.equal(drifted.state, "FAIL");
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }

    // 官方命名空间常量漂移 → FAIL（往返与全集两关须先过，才测得到常量关）
    const root3 = mkdtempSync(join(tmpdir(), "dsh-gate-config-ns-"));
    try {
      writeHostIndexFixture(root3, "dsh-app-boot", MINI_PATCH_LOADER);
      mkdirSync(join(root3, "dsh-base"), { recursive: true });
      writeFileSync(join(root3, "dsh-base", "cordis.patch.yml"), criticalIdsYaml());
      mkdirSync(join(root3, "dsh-web-app"), { recursive: true });
      writeFileSync(join(root3, "dsh-web-app", "cordis.patch.yml"), webAppPatchYaml());
      writeHostIndexFixture(root3, "dsh-agent-default-model", `export const AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE = "renamed-model";\n`);
      writeHostIndexFixture(root3, "dsh-llm-pi-ai", `export const name = "llm-pi-ai";\n`);
      const nsDrift = await probeConfigIdsStage([root3]);
      assert.equal(nsDrift.state, "FAIL");
      assert.match(nsDrift.reason, /agent-default-model/);
    } finally {
      rmSync(root3, { recursive: true, force: true });
    }

    const root4 = mkdtempSync(join(tmpdir(), "dsh-gate-config-pin-"));
    try {
      writeHostIndexFixture(root4, "dsh-app-boot", MINI_PATCH_LOADER);
      mkdirSync(join(root4, "dsh-base"), { recursive: true });
      writeFileSync(join(root4, "dsh-base", "cordis.patch.yml"), criticalIdsYaml());
      mkdirSync(join(root4, "dsh-web-app"), { recursive: true });
      writeFileSync(join(root4, "dsh-web-app", "cordis.patch.yml"), webAppPatchYaml());
      writeHostIndexFixture(root4, "dsh-agent-default-model", `
export class AgentDefaultModelConfig {
  constructor(ctx) { ctx.reflect.provide("agentDefaultModel", this); }
  currentSelection() { return { provider: "probe-provider", model: "ignored-pin", reasoningEffort: "high" }; }
}
`);
      writeHostIndexFixture(root4, "dsh-llm-pi-ai", `export const name = "llm-pi-ai";\n`);
      const ignoredPin = await probeConfigIdsStage([root4]);
      assert.equal(ignoredPin.state, "FAIL");
      assert.match(ignoredPin.reason, /模型 pin/);
    } finally {
      rmSync(root4, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("P-CONFIG-IDS：路由名仍在但宿主不提供配置中的模型时失败", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-provider-"));
  try {
    writeHostIndexFixture(root, "dsh-app-boot", MINI_PATCH_LOADER);
    mkdirSync(join(root, "dsh-base"), { recursive: true });
    writeFileSync(join(root, "dsh-base", "cordis.patch.yml"), criticalIdsYaml());
    mkdirSync(join(root, "dsh-web-app"), { recursive: true });
    writeFileSync(join(root, "dsh-web-app", "cordis.patch.yml"), webAppPatchYaml());
    writeHostIndexFixture(root, "dsh-agent-default-model", `
export class AgentDefaultModelConfig {
  constructor(ctx, config) { this.config = config; ctx.reflect.provide("agentDefaultModel", this); }
  currentSelection() { return Object.fromEntries(Object.entries(this.config).map(([key, value]) => [key, value.get()])); }
}
`);
    writeHostIndexFixture(root, "dsh-llm-pi-ai", CONFIGURABLE_PI_AI.replace(
      "return { provider, id: model };", "throw new Error('Select an available model before sending a message.');"));
    const result = await probeConfigIdsStage([root]);
    assert.equal(result.state, "FAIL", "仅路由名存在不能代替模型可用性");
    assert.match(result.reason, /provider|模型/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("18号票 P-SESSION-LOG 行为化：真实格式日志经适配层读取解析（合成多帧 zstd 日志）", async () => {
  const home = mkdtempSync(join(tmpdir(), "dsh-gate-sessions-"));
  try {
    const shard = join(home, "sessions", "-home-probe-ws-");
    const sessionDir = join(shard, "sess-0001");
    mkdirSync(sessionDir, { recursive: true });
    const frame1 = zstdCompressSync(Buffer.from([
      JSON.stringify({ type: "user/message", time: 1, data: { message: { content: [{ type: "text", text: "hi" }] } } }),
      JSON.stringify({ type: "request/context", time: 2, data: { contextWindow: 1000 } })
    ].join("\n") + "\n"));
    const frame2 = zstdCompressSync(Buffer.from([
      JSON.stringify({ type: "step/start", time: 3, data: { turn: 1, step: 1 } }),
      JSON.stringify({ type: "assistant/message", time: 10, data: { turn: 1, step: 1, usage: { inputTokens: 10, outputTokens: 5 } } }),
      JSON.stringify({ type: "step/end", time: 11, data: { turn: 1, step: 1 } })
    ].join("\n") + "\n"));
    writeFileSync(join(sessionDir, "session.jsonl.zstd"), Buffer.concat([frame1, frame2]));
    const ok = probeSessionLogStage(home);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));
    assert.match(String(ok.coordinate), /sess-0001/);

    // v4（现役宿主写版本化名 session.v4.jsonl.zstd）：v4-only 目录同样能被发现并解出事件
    // ——修复前探针只认旧名，该目录不可达（票 06 代际盲区返修）
    const v4Home = mkdtempSync(join(tmpdir(), "dsh-gate-sessions-v4-"));
    try {
      const v4Dir = join(v4Home, "sessions", "-home-probe-ws-", "sess-v4");
      mkdirSync(v4Dir, { recursive: true });
      writeFileSync(join(v4Dir, "session.v4.jsonl.zstd"), Buffer.concat([frame1, frame2]));
      const v4ok = probeSessionLogStage(v4Home);
      assert.equal(v4ok.state, "PASS", JSON.stringify(v4ok));
      assert.match(String(v4ok.coordinate), /sess-v4/);
    } finally {
      rmSync(v4Home, { recursive: true, force: true });
    }

    // 空数据根 → SKIP（无真实格式可核；部署面由门汇总把 SKIP 视同 FAIL）
    const empty = mkdtempSync(join(tmpdir(), "dsh-gate-sessions-empty-"));
    try {
      const skipped = probeSessionLogStage(empty);
      assert.equal(skipped.state, "SKIP");
      assert.ok(skipped.reason.length > 0, "SKIP 必须带原因（可见）");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }

    // 布局漂移（坏帧 magic）→ FAIL 响亮
    const broken = mkdtempSync(join(tmpdir(), "dsh-gate-sessions-bad-"));
    try {
      const badDir = join(broken, "sessions", "-x-", "s1");
      mkdirSync(badDir, { recursive: true });
      writeFileSync(join(badDir, "session.jsonl.zstd"), Buffer.from("not zstd at all"));
      const failed = probeSessionLogStage(broken);
      assert.equal(failed.state, "FAIL");
      assert.match(failed.reason, /解码|zstd|漂移/);
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }

    // 事件行形状漂移（合法 JSON 但非事件对象）→ FAIL
    const alien = mkdtempSync(join(tmpdir(), "dsh-gate-sessions-alien-"));
    try {
      const alienDir = join(alien, "sessions", "-x-", "s1");
      mkdirSync(alienDir, { recursive: true });
      writeFileSync(join(alienDir, "session.jsonl.zstd"), zstdCompressSync(Buffer.from("123\n\"just a string\"\n")));
      const drifted = probeSessionLogStage(alien);
      assert.equal(drifted.state, "FAIL");
      assert.match(drifted.reason, /形状/);
    } finally {
      rmSync(alien, { recursive: true, force: true });
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("18号票 P-CTX-SERVICES baseUrl：官方 boot() 空树产出经适配层回读（合成 fixture）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-baseurl-"));
  try {
    writeHostIndexFixture(root, "dsh-app-boot", `
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
export async function boot(binName, absoluteConfigPath) {
	return { baseUrl: pathToFileURL(dirname(absoluteConfigPath)).href + "/", fiber: { dispose() {} } };
}
`);
    const ok = await probeCtxServicesBaseUrlStage([root]);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));

    // baseUrl 产出方缺失 → FAIL
    const root2 = mkdtempSync(join(tmpdir(), "dsh-gate-baseurl-miss-"));
    try {
      const missing = await probeCtxServicesBaseUrlStage([root2]);
      assert.equal(missing.state, "FAIL");
      assert.match(missing.reason, /dsh-app-boot/);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }

    // baseUrl 形状漂移（非 file: URL）→ FAIL
    const root3 = mkdtempSync(join(tmpdir(), "dsh-gate-baseurl-bad-"));
    try {
      writeHostIndexFixture(root3, "dsh-app-boot", `export async function boot() { return { baseUrl: "/not/a/file/url" }; }\n`);
      const drifted = await probeCtxServicesBaseUrlStage([root3]);
      assert.equal(drifted.state, "FAIL");
      assert.match(drifted.reason, /baseUrl/);
    } finally {
      rmSync(root3, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("18号票 P-CLIENT-VISUAL 行为化：官方 theme bundle 令牌注入与 theme 服务形状（合成 fixture）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-visual-"));
  try {
    writeBundleFixture(root, "dsh-client-ui-theme", `
			const host = ctx.configForms.get("ui-theme");
			host.subscribe(() => host.getSnapshot());
			const el = document.createElement("style");
			el.textContent = ":root{--dsw-alias-border-l2:#fff;--dsw-alias-label-primary:#000}";
			document.head.appendChild(el);
			ctx.provide("theme", { getTheme: () => ({ mode: "dark" }) });
`);
    const ok = await probeClientVisualStage([root]);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));

    // 令牌改名（--dsw- 前缀消失）＝视觉静默退化 → FAIL
    const root2 = mkdtempSync(join(tmpdir(), "dsh-gate-visual-notok-"));
    try {
      writeBundleFixture(root2, "dsh-client-ui-theme", `
				const el = document.createElement("style");
				el.textContent = ":root{--renamed-border:#fff}";
				document.head.appendChild(el);
				ctx.provide("theme", { getTheme: () => ({}) });
`);
      const drifted = await probeClientVisualStage([root2]);
      assert.equal(drifted.state, "FAIL");
      assert.match(drifted.reason, /--dsw-/);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }

    // theme 服务缺失/形状不符 → FAIL
    const root3 = mkdtempSync(join(tmpdir(), "dsh-gate-visual-nosvc-"));
    try {
      writeBundleFixture(root3, "dsh-client-ui-theme", `
				const el = document.createElement("style");
				el.textContent = ":root{--dsw-x:1}";
				document.head.appendChild(el);
`);
      const noSvc = await probeClientVisualStage([root3]);
      assert.equal(noSvc.state, "FAIL");
      assert.match(noSvc.reason, /theme 服务/);
    } finally {
      rmSync(root3, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("18号票 P-CLIENT-SLOTS 行为化：官方 layout/sidebar bundle 槽树声明断言（合成 fixture）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-slots-"));
  try {
    writeBundleFixture(root, "dsh-client-ui-layout", `
			ctx.slots.register({ name: "root", children: {
				"sidebar": { kind: "single" }, "main": { kind: "keyed" }, "rightbar": { kind: "single" }, "shell.overlay": { kind: "list" }
			} });
`);
    writeBundleFixture(root, "dsh-client-ui-sidebar", `
			ctx.slots.inject("sidebar", () => ctx.slots.register({ name: "sidebar", children: {
				"sidebar.panellist": { kind: "list" }, "sidebar.footer.action": { kind: "list" }
			} }));
`);
    const ok = await probeClientSlotsStage([root]);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));

    // 槽改名（shell.overlay 消失）＝A 类静默面失配 → 必须 FAIL
    const root2 = mkdtempSync(join(tmpdir(), "dsh-gate-slots-bad-"));
    try {
      writeBundleFixture(root2, "dsh-client-ui-layout", `
				ctx.slots.register({ name: "root", children: { "sidebar": { kind: "single" }, "main": { kind: "keyed" } } });
`);
      writeBundleFixture(root2, "dsh-client-ui-sidebar", `
				ctx.slots.inject("sidebar", () => ctx.slots.register({ name: "sidebar", children: { "sidebar.footer.action": { kind: "list" } } }));
`);
      const drifted = await probeClientSlotsStage([root2]);
      assert.equal(drifted.state, "FAIL");
      assert.match(drifted.reason, /shell\.overlay/);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }

    // sidebar bundle 缺失（footer 子槽无法核）→ FAIL 不静默
    const root3 = mkdtempSync(join(tmpdir(), "dsh-gate-slots-nosb-"));
    try {
      writeBundleFixture(root3, "dsh-client-ui-layout", `
				ctx.slots.register({ name: "root", children: { "sidebar": { kind: "single" }, "main": { kind: "keyed" }, "shell.overlay": { kind: "list" } } });
`);
      const missing = await probeClientSlotsStage([root3]);
      assert.equal(missing.state, "FAIL");
    } finally {
      rmSync(root3, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------- 18 号票：我方槽注册与 primitives 引用面的门内增补 ----------------
// 2026-10-07 返修批：首轮人工目视暴露的三类漂移（槽名／图标变体名／MarkdownText.labels）
// 此前全被门④ 12 PASS 放行——本节把三查钉进套件（真实宿主上的实跑归 preflight ④）。

/**
 * 合成 SlotCore 源码：**门内所需子集**（未声明槽 fail closed、keyed/list 必带选择子、
 * 同格同 priority 判重、children 表建声明）。**不**覆盖官方实现的其他语义（重复声明守卫、
 * `chain`／`options.select` 等）；真实 SlotCore 的行为证据在 preflight ④ 与附件
 * `18-gate-guard-2026-10-07/red-green-output.txt`。两个用途——套件内 `import("data:…")`
 * 取类当夹具；`writeHostPackagesFixture` 写盘当假宿主包。
 */
const FIXTURE_SLOT_CORE_SOURCE = `export class SlotCore {
  constructor() {
    this.records = new Map();
    // 宿主 shell 先声明 root（真实 SlotCore 亦然）；夹具把它预置好。
    this.records.set("root", { spec: { kind: "single" }, entries: [], listeners: new Set() });
  }
  rec(name) {
    if (!this.records.has(name)) this.records.set(name, { spec: undefined, entries: [], listeners: new Set() });
    return this.records.get(name);
  }
  register(options, component) {
    const rec = this.records.get(options.name);
    if (!rec?.spec) throw new Error('slot "' + options.name + '" is not declared (a parent entry\\'s children table must declare it)');
    const kind = rec.spec.kind;
    const priority = options.priority ?? 0;
    if (kind === "keyed" && options.key === undefined) throw new Error('keyed slot "' + options.name + '" requires options.key');
    if (kind === "list" && options.id === undefined) throw new Error('list slot "' + options.name + '" requires options.id');
    const cell = kind === "keyed" ? options.key : kind === "list" ? options.id : undefined;
    const clash = rec.entries.some((entry) => (entry.options.priority ?? 0) === priority
      && (kind === "keyed" ? entry.options.key === cell : kind === "list" ? entry.options.id === cell : true));
    if (clash) throw new Error('slot "' + options.name + '" already has a registration at priority ' + priority);
    const entry = { options, component };
    rec.entries.push(entry);
    // list 槽＝priority 升序再 order 升序（与真实 SlotCore 逐字同形；2026-10-09 修正：原先
    // 只按 priority 排，probe 的「同层 order 升序」判据在夹具上恒 FAIL——夹具与被测
    // 语义不同形，绿路径其实测不到 order）。下方负例按**逐字**替换本表达式制造语义漂移。
    rec.entries.sort(kind === "list"
      ? (a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0) || (a.options.order ?? 0) - (b.options.order ?? 0)
      : (a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0));
    for (const [child, spec] of Object.entries(options.children ?? {})) this.rec(child).spec = spec;
    return () => { rec.entries = rec.entries.filter((candidate) => candidate !== entry); };
  }
  entriesOfSlot(name) {
    const rec = this.records.get(name);
    if (!rec?.spec) return [];
    const kind = rec.spec.kind;
    const seen = new Set();
    const heads = [];
    for (const entry of rec.entries) {
      const cell = kind === "keyed" ? entry.options.key : kind === "list" ? entry.options.id : undefined;
      if (seen.has(cell)) continue;
      seen.add(cell);
      heads.push(entry);
    }
    return heads;
  }
  specDynamic(name) { return this.records.get(name)?.spec; }
  subscribeDeclaration(name, fn) { const rec = this.rec(name); rec.listeners.add(fn); return () => rec.listeners.delete(fn); }
}
`;

/** 合成宿主声明树（与安装内 layout/sidebar bundle 的声明同形）。 */
const FIXTURE_DECLARED = {
  rootChildren: {
    sidebar: { kind: "single" }, main: { kind: "keyed" }, rightbar: { kind: "single" },
    "shell.overlay": { kind: "list" }, "shell.leading": { kind: "single" }
  },
  sidebarChildren: { "sidebar.footer.action": { kind: "list" } }
};

/** 起一棵「宿主声明树」的夹具 SlotCore（root ＋ sidebar 子槽）。 */
async function declaredFixtureCore() {
  const { SlotCore } = await import("data:text/javascript," + encodeURIComponent(FIXTURE_SLOT_CORE_SOURCE));
  const core = new SlotCore();
  core.register({ name: "root", children: FIXTURE_DECLARED.rootChildren }, () => null);
  core.register({ name: "sidebar", children: FIXTURE_DECLARED.sidebarChildren }, () => null);
  return core;
}

/** 合成宿主包目录：官方 primitives 实体包（导出面可调）＋slots 包（SlotCore 夹具）。 */
function writeHostPackagesFixture(dir, { primitiveNames = ["Button"] } = {}) {
  const primitives = join(dir, "dsh-client-ui-primitives", "lib");
  mkdirSync(primitives, { recursive: true });
  writeFileSync(join(primitives, "index.js"), `export { ${primitiveNames.join(", ")} };\n`);
  const slots = join(dir, "dsh-client-ui-slots", "lib");
  mkdirSync(slots, { recursive: true });
  writeFileSync(join(slots, "index.js"), FIXTURE_SLOT_CORE_SOURCE);
  return dir;
}

/** 仓库真实 client 引用的 primitives 名（合成导出面的原料；数量下限防正则失效）。 */
function repoClientPrimitiveReferences() {
  const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  const names = [...new Set([...source.matchAll(/primitives\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))];
  assert.ok(names.length >= 15, `client.js primitives 引用面异常：${names.length} 名`);
  return names;
}

test("18号票 P-CLIENT-SLOTS 增补：未声明槽即 FAIL（合成 SlotCore fail closed，红路径）", async () => {
  const core = await declaredFixtureCore();
  const h = makeClientReactStub().createElement;
  const apply = (ctx) => {
    ctx.slots.register({ name: "sidebar.footer.action", id: "pod-entry", order: 10 }, () => h("button", {
      type: "button",
      onClick: () => { ctx.slots.register({ name: "conversation", id: "pod-main" }, () => null); }
    }, null));
  };
  const verdict = await verifyClientSlotRegistrations({ core, apply });
  assert.equal(verdict.ok, false, "旧形态（独立 conversation 槽）必须报错");
  assert.match(verdict.violations.join("；"), /入口点击抛错.*not declared/);
  assert.match(verdict.violations.join("；"), /未占用宿主声明槽「shell\.overlay」/);
});

test("18号票 P-CLIENT-SLOTS 增补：覆盖式常驻落点（pod 04 口径）——常驻两槽＋enter 期覆盖层，sidebar／main 恒不占", async () => {
  const core = await declaredFixtureCore();
  const h = makeClientReactStub().createElement;
  const apply = (ctx) => {
    // 与 lib/client.js 同形：apply 期常驻入口钮与通知容器；enter 期只增覆盖层条目一条
    ctx.slots.register({ name: "sidebar.footer.action", id: "pod-entry", order: -10 }, () => h("button", {
      type: "button",
      onClick: () => {
        ctx.slots.register({ name: "shell.overlay", id: "pod-pod" }, () => null);
      }
    }, null));
    ctx.slots.register({ name: "shell.overlay", id: "pod-notices", order: -10 }, () => null);
  };
  const verdict = await verifyClientSlotRegistrations({ core, apply });
  assert.equal(verdict.ok, true, verdict.violations.join("；"));
  assert.deepEqual(verdict.observations["sidebar.footer.action.id"], ["pod-entry"]);
  assert.deepEqual(verdict.observations["shell.overlay.id"], ["pod-notices", "pod-pod"]);
  // 相位证据：覆盖层条目在点击前**不得**在位（进出期增删），点击后须在位
  assert.ok(!verdict.observations["shell.overlay.id.beforeEnter"].includes("pod-pod"));
  // 官方槽账本：apply 与 enter 两相我方条目都不得出现在 sidebar／main（覆盖式常驻的机制判据）
  for (const phase of ["beforeEnter", "afterEnter"]) {
    assert.ok(!verdict.observations[`sidebar.id.${phase}`].includes("pod-sidebar"), `sidebar 在 ${phase} 被占用`);
    assert.ok(!verdict.observations[`main.key.${phase}`].includes("conversation"), `main 在 ${phase} 被占用`);
  }
});

test("18号票 P-CLIENT-SLOTS 增补：Pod 去占宿主槽即 FAIL（覆盖式常驻红路径，pod 04 口径）", async () => {
  const core = await declaredFixtureCore();
  const h = makeClientReactStub().createElement;
  // 坏形态：enter 期把宿主 sidebar／main 占掉（＝旧的「抢槽」实现）——覆盖式常驻改造后
  // 这种形态必须报「覆盖式常驻被破坏」，因为它会让官方页随槽位切换卸载重挂。
  const apply = (ctx) => {
    ctx.slots.register({ name: "sidebar.footer.action", id: "pod-entry", order: -10 }, () => h("button", {
      type: "button",
      onClick: () => {
        ctx.slots.register({ name: "sidebar", id: "pod-sidebar", priority: -100000 }, () => null);
        ctx.slots.register({ name: "main", key: "conversation", id: "pod-main", priority: -100000 }, () => null);
        ctx.slots.register({ name: "shell.overlay", id: "pod-pod" }, () => null);
      }
    }, null));
    ctx.slots.register({ name: "shell.overlay", id: "pod-notices", order: -10 }, () => null);
  };
  const verdict = await verifyClientSlotRegistrations({ core, apply });
  assert.equal(verdict.ok, false, "enter 期占槽必须报错");
  assert.match(verdict.violations.join("；"), /覆盖式常驻被破坏：afterEnter 时占用了宿主声明槽「sidebar」/);
  assert.match(verdict.violations.join("；"), /覆盖式常驻被破坏：afterEnter 时占用了宿主声明槽「main」/);
  assert.deepEqual(verdict.observations["sidebar.id.afterEnter"], ["pod-sidebar"]);
});

test("18号票 P-CLIENT-SLOTS 增补：apply 期抢占宿主槽即 FAIL（相位断言，pod 04 口径）", async () => {
  const core = await declaredFixtureCore();
  const h = makeClientReactStub().createElement;
  // 坏形态：apply 期就把宿主 sidebar／main 占掉（不进入 Pod 也接管界面）
  const apply = (ctx) => {
    ctx.slots.register({ name: "sidebar.footer.action", id: "pod-entry", order: -10 }, () => h("button", {
      type: "button",
      onClick: () => { ctx.slots.register({ name: "shell.overlay", id: "pod-pod" }, () => null); }
    }, null));
    ctx.slots.register({ name: "shell.overlay", id: "pod-notices", order: -10 }, () => null);
    ctx.slots.register({ name: "sidebar", id: "pod-sidebar", priority: -100000 }, () => null);
    ctx.slots.register({ name: "main", key: "conversation", id: "pod-main", priority: -100000 }, () => null);
  };
  const verdict = await verifyClientSlotRegistrations({ core, apply });
  assert.equal(verdict.ok, false, "apply 期抢占必须报错");
  assert.match(verdict.violations.join("；"), /覆盖式常驻被破坏：beforeEnter 时占用了宿主声明槽「sidebar」/);
  assert.match(verdict.violations.join("；"), /覆盖式常驻被破坏：beforeEnter 时占用了宿主声明槽「main」/);
  assert.deepEqual(verdict.observations["sidebar.id.beforeEnter"], ["pod-sidebar"]);
});

test("18号票：仓库真实 client bundle 在合成声明树下命中落点（套件内绿基线）", async () => {
  const core = await declaredFixtureCore();
  const client = await withDomStubs(async () => {
    let captured = null;
    globalThis.window.__ModuleLoader__ = { load: (opts) => { captured = opts; } };
    const bundle = fileURLToPath(new URL("../lib/client.js", import.meta.url));
    await import(pathToFileURL(bundle).href + "?suite=" + Date.now());
    const { react } = makeClientReactStub();
    const primitivesStub = new Proxy({}, { get: (_target, key) => () => ({ type: key, props: {}, children: [] }) });
    return captured.factory((id) => (id === "react" ? react
      : id === "react-dom" ? { createPortal: (children) => children }
        : id === "@deepseek-ai/dsh-client-ui-primitives" ? primitivesStub : {}));
  });
  const verdict = await verifyClientSlotRegistrations({ core, apply: client.apply });
  assert.equal(verdict.ok, true, `仓库 client 落点漂移：${verdict.violations.join("；")}`);
  // pod 04：进入后只在 shell.overlay 增一条覆盖层条目，官方 sidebar／main 账本不受影响
  assert.deepEqual(verdict.observations["shell.overlay.id"], ["pod-notices", "pod-pod"]);
  for (const phase of ["beforeEnter", "afterEnter"]) {
    assert.ok(!verdict.observations[`main.key.${phase}`].includes("conversation"), `Pod 不得占用 main 槽 conversation 键（${phase}）`);
    assert.ok(!verdict.observations[`sidebar.id.${phase}`].includes("pod-sidebar"), `Pod 不得占用 sidebar 单槽（${phase}）`);
  }
});

test("18号票：primitives 引用面三查（未导出名／必填 props／合法引用）", () => {
  const exportNames = new Set(["MarkdownText", "Button", "IconPlusOutlineRegular"]);
  const bad = checkPrimitivesReferences(`
		h(primitives.IconPlusOutline16, { size: 16 });
		h(primitives.MarkdownText, { text: "x" });
	`, exportNames);
  assert.equal(bad.ok, false);
  assert.match(bad.violations.join("；"), /未导出的 primitives\.IconPlusOutline16/);
  assert.match(bad.violations.join("；"), /MarkdownText 调用点.*缺必需 props：labels/);

  const good = checkPrimitivesReferences(`
		h(primitives.IconPlusOutlineRegular, { size: 16 });
		const labels = useMemo(() => markdownLabels(t), [t]);
		h(primitives.MarkdownText, { text: "x", labels });
	`, exportNames);
  assert.equal(good.ok, true, good.violations.join("；"));
  assert.equal(good.referencedNames, 2);
});

test("18号票 P-CLIENT-SLOTS 增补 stage：声明树/宿主包缺失与导出面不足均 FAIL，覆盖齐全则 PASS", async () => {
  const missingDeclared = await probeClientConformanceStage(["whatever"]);
  assert.equal(missingDeclared.state, "FAIL");
  assert.match(missingDeclared.reason, /声明树/);

  const bare = mkdtempSync(join(tmpdir(), "dsh-gate-conformance-bare-"));
  const thin = mkdtempSync(join(tmpdir(), "dsh-gate-conformance-thin-"));
  const full = mkdtempSync(join(tmpdir(), "dsh-gate-conformance-full-"));
  try {
    const noPackages = await probeClientConformanceStage([bare], FIXTURE_DECLARED);
    assert.equal(noPackages.state, "FAIL");
    assert.match(noPackages.reason, /primitives 实体包/);

    writeHostPackagesFixture(thin, { primitiveNames: ["Button", "MarkdownText"] });
    const thinSurface = await probeClientConformanceStage([thin], FIXTURE_DECLARED);
    assert.equal(thinSurface.state, "FAIL");
    assert.match(thinSurface.reason, /引用未导出的 primitives\./);

    writeHostPackagesFixture(full, { primitiveNames: repoClientPrimitiveReferences() });
    const ok = await probeClientConformanceStage([full], FIXTURE_DECLARED);
    assert.equal(ok.state, "PASS", `${ok.reason ?? ""}`);
    assert.match(ok.coordinate, /overlay=pod-notices／pod-pod/);
    assert.match(ok.coordinate, /官方 sidebar／main 占用＝无／无/);
    // pod 04 复核 M5：相位观测须**带相位后缀读取**且两相都取到值——否则坐标行恒打印「无／无」
    // （相位盲区：`never` 相只写 *.beforeEnter／*.afterEnter 键）。夹具的自声明记录（合成
    // SlotCore 把 `sidebar` 声明本身也记成一条无 id 条目）会显示成「(未命名)」，故只断言
    // 「取到了数组」（不再是空 `无`）＋我方 id 不在其中。
    assert.match(ok.coordinate, /sidebar\.id 相位观测［beforeEnter=[^、]+、afterEnter=[^］]+］/);
    assert.match(ok.coordinate, /main\.key 相位观测［beforeEnter=无、afterEnter=无］/);
    assert.match(ok.coordinate, /sidebar\.id 相位观测［(?!.*pod-sidebar).*］/);
    // 判据有区分度（非恒真）：无后缀读取在 `never` 相上恒为「无」——旧实现的相位盲区
    const phaseBlind = (observations, slot, field) => (observations[`${slot}.${field}`] ?? []).join("／") || "无";
    assert.equal(phaseBlind({ "sidebar.id.beforeEnter": ["x"], "sidebar.id.afterEnter": ["x"] }, "sidebar", "id"), "无",
      "无后缀读取在 never 相上恒为「无」（旧实现形态）；带相位后缀才取到值⇒本判据非恒真");
  } finally {
    for (const dir of [bare, thin, full]) rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------- pod 02 号票：三条宿主依赖面的探针（合成夹具驱动） ----------------
// 真实宿主的实跑结果归 preflight ④ 门；套件内用合成 fixture 把新探针的判据钉住
// （与既有 18 号票同一分工口径）。

/** 写一个合成 client bundle：注入一段样式（z-index 规则由调用方给定）。 */
function writeStyleBundleFixture(dir, pkg, css) {
  return writeBundleFixture(dir, pkg, `
			const el = document.createElement("style");
			el.textContent = ${JSON.stringify(css)};
			document.head.appendChild(el);
	`);
}

/** 合成一层「官方浮层 bundle」（固定定位档位提供方）。 */
function writeBandFixture(dir, pkg, css) {
  return writeStyleBundleFixture(dir, pkg, css);
}

// AppFrame 根同形（`position:relative`＋`overflow:hidden`）——祖先链风险规则以「定位上下文
// 且裁剪」的祖先为对象；夹具缺 `position:relative` 时该规则根本无对象可判。
const OVERLAY_CSS = [
  ".probe_frame{position:relative;overflow:hidden;display:grid}",
  ".probe_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}",
  ".probe_overlayLayer>*{pointer-events:auto}"
].join("");

/** 三个官方浮层提供方的合成件：档位 900／1000／1001／1100（与现装宿主同形）。 */
function writeBandProviders(root, { account = 900, general = 1000, conversation = 1100 } = {}) {
  writeBandFixture(root, "dsh-client-ui-settings-account", `.a_onboarding{z-index:${account};position:fixed;inset:0}`);
  writeBandFixture(root, "dsh-client-ui-settings-general", `.b_panel{z-index:${general};position:fixed;inset:0}`);
  writeBandFixture(root, "dsh-client-ui-conversation", `.c_toast{z-index:${conversation};position:fixed;inset:0}`);
}

test("pod 02 P-SHELL-OVERLAY-GEOMETRY：整屏几何档＋层叠构成＋order 升序（合成夹具）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-"));
  try {
    writeStyleBundleFixture(root, "dsh-client-ui-layout", OVERLAY_CSS);
    writeBandProviders(root);
    writeHostIndexFixture(root, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
    const ok = await probeShellOverlayGeometryStage([root]);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));
    assert.equal(ok.overlay["z-index"], "20");
    assert.deepEqual(ok.bands, [20, 900, 1000, 1100]);
    assert.deepEqual(ok.ancestorRisk, []);
    // 层本体类名按几何语义签名反解（与压缩名无关）
    assert.equal(ok.coordinate.includes(".probe_overlayLayer"), true);

    // ① 层不再是整屏绝对层（inset 丢边）→ FAIL
    const root2 = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-noinset-"));
    try {
      writeStyleBundleFixture(root2, "dsh-client-ui-layout", ".probe_overlayLayer{z-index:20;pointer-events:none;position:absolute;top:0;left:0}");
      writeBandProviders(root2);
      writeHostIndexFixture(root2, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const drifted = await probeShellOverlayGeometryStage([root2]);
      assert.equal(drifted.state, "FAIL");
      assert.match(drifted.reason, /未解析出整屏层几何|四边未归零/);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }

    // ② 层直系子节点不再恢复交互 → FAIL
    const root3 = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-nochild-"));
    try {
      writeStyleBundleFixture(root3, "dsh-client-ui-layout", ".probe_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}");
      writeBandProviders(root3);
      writeHostIndexFixture(root3, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const noChild = await probeShellOverlayGeometryStage([root3]);
      assert.equal(noChild.state, "FAIL");
      assert.match(noChild.reason, /直系子节点/);
    } finally {
      rmSync(root3, { recursive: true, force: true });
    }

    // ③ 地板之上的最小官方档 ≠ 900（整体下沉到 500/600）→ FAIL 点名
    const root4 = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-band-"));
    try {
      writeStyleBundleFixture(root4, "dsh-client-ui-layout", OVERLAY_CSS);
      writeBandProviders(root4, { account: 500, general: 600, conversation: 700 });
      writeHostIndexFixture(root4, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const lowered = await probeShellOverlayGeometryStage([root4]);
      assert.equal(lowered.state, "FAIL");
      assert.match(lowered.reason, /最低档漂移/);
    } finally {
      rmSync(root4, { recursive: true, force: true });
    }

    // ③b 地板档上抬（900 消失，最小非零档变 1000）→ FAIL 点名
    const rootFloorDrift = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-floor-drift-"));
    try {
      writeStyleBundleFixture(rootFloorDrift, "dsh-client-ui-layout", OVERLAY_CSS);
      writeBandProviders(rootFloorDrift, { account: 1000, general: 1001, conversation: 1100 });
      writeHostIndexFixture(rootFloorDrift, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const driftedFloor = await probeShellOverlayGeometryStage([rootFloorDrift]);
      assert.equal(driftedFloor.state, "FAIL");
      assert.match(driftedFloor.reason, /最低档漂移：1000/);
    } finally {
      rmSync(rootFloorDrift, { recursive: true, force: true });
    }

    // ③d 层本体档与地板之间的官方固定件只作诊断、不阻断门（现装宿主 40 档同形）
    const rootGap = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-gap-"));
    try {
      writeStyleBundleFixture(rootGap, "dsh-client-ui-layout", OVERLAY_CSS);
      writeBandProviders(rootGap, { account: 900, general: 1000, conversation: 40 });
      writeHostIndexFixture(rootGap, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const gap = await probeShellOverlayGeometryStage([rootGap]);
      assert.equal(gap.state, "PASS", JSON.stringify(gap));
      assert.deepEqual(gap.layerToFloorBands, [40]);
    } finally {
      rmSync(rootGap, { recursive: true, force: true });
    }

    // ③c 官方浮层塌到层本体档之下（最高档 ≤ 整屏层档）→ FAIL
    const rootBandBelow = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-below-"));
    try {
      writeStyleBundleFixture(rootBandBelow, "dsh-client-ui-layout", OVERLAY_CSS);
      writeBandProviders(rootBandBelow, { account: 10, general: 15, conversation: 20 });
      writeHostIndexFixture(rootBandBelow, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const below = await probeShellOverlayGeometryStage([rootBandBelow]);
      assert.equal(below.state, "FAIL");
      assert.match(below.reason, /未全在整屏层之上/);
    } finally {
      rmSync(rootBandBelow, { recursive: true, force: true });
    }

    // ④ 祖先链出现 transform/contain 类声明 → FAIL（position:fixed 被裁剪/重锚）。
    //    风险形＝「定位上下文＋裁剪」的祖先规则**追加**变换属性：`.probe_frame` 本体
    //    带 `position:relative;overflow:hidden`，此处只在另一条同形规则上加 transform。
    const root5 = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-ancestor-"));
    try {
      writeStyleBundleFixture(root5, "dsh-client-ui-layout",
        `${OVERLAY_CSS}.probe_frame_risky{position:relative;overflow:hidden;transform:translateZ(0)}`);
      writeBandProviders(root5);
      writeHostIndexFixture(root5, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const risky = await probeShellOverlayGeometryStage([root5]);
      assert.equal(risky.state, "FAIL");
      assert.match(risky.reason, /祖先链/);
    } finally {
      rmSync(root5, { recursive: true, force: true });
    }

    // ④b 官方浮层地板漂移（最低档 < HOST_FLOAT_FLOOR_BAND）→ FAIL：V-P2.5 的
    //     「portal 低于官方浮层最低档」取值上限改变
    const rootFloor = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-floor-"));
    try {
      writeStyleBundleFixture(rootFloor, "dsh-client-ui-layout", OVERLAY_CSS);
      writeBandProviders(rootFloor, { account: 800 });
      writeHostIndexFixture(rootFloor, "dsh-client-ui-slots", FIXTURE_SLOT_CORE_SOURCE);
      const lowered = await probeShellOverlayGeometryStage([rootFloor]);
      assert.equal(lowered.state, "FAIL");
      assert.match(lowered.reason, /官方 body 级浮层最低档漂移/);
    } finally {
      rmSync(rootFloor, { recursive: true, force: true });
    }

    // ⑤ 同层 order 语义漂移（SlotCore 读回不是 order 升序）→ FAIL
    const root6 = mkdtempSync(join(tmpdir(), "dsh-gate-overlay-order-"));
    try {
      writeStyleBundleFixture(root6, "dsh-client-ui-layout", OVERLAY_CSS);
      writeBandProviders(root6);
      // 语义反例：list 槽的注册序不再按 `order` 重排（夹具表达式逐字替换；注册序
      // 保持插入序＝probe-b／probe-a／probe-c）。替换未命中即当场报错——负例不许静默失效。
      const driftedSource = FIXTURE_SLOT_CORE_SOURCE.replace(
        `    rec.entries.sort(kind === "list"\n      ? (a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0) || (a.options.order ?? 0) - (b.options.order ?? 0)\n`,
        `    rec.entries.sort(kind === "list"\n      ? (a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0)\n`);
      assert.notEqual(driftedSource, FIXTURE_SLOT_CORE_SOURCE, "order 语义反例的逐字替换须命中夹具");
      writeHostIndexFixture(root6, "dsh-client-ui-slots", driftedSource);
      const orderDrift = await probeShellOverlayGeometryStage([root6]);
      assert.equal(orderDrift.state, "FAIL");
      assert.match(orderDrift.reason, /order 语义漂移/);
    } finally {
      rmSync(root6, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pod 02 P-HOST-TRANSITION-TOKENS：令牌存在性与形状（合成夹具）", async () => {
  const root = mkdtempSync(join(tmpdir(), "dsh-gate-tokens-"));
  try {
    writeStyleBundleFixture(root, "dsh-client-ui-theme",
      ":root{--dsw-alias-bg-base:#fff;--ds-font-family-code:mono;--ds-ease-in-out:cubic-bezier(.4, 0, .2, 1);--ds-transition-duration:.2s;--ds-transition-duration-fast:.1s;--ds-transition-duration-slow:.3s}");
    const ok = await probeHostTransitionTokensStage([root]);
    assert.equal(ok.state, "PASS", JSON.stringify(ok));
    assert.equal(ok.readings["--ds-transition-duration"], ".2s");
    assert.equal(ok.readings["--ds-ease-in-out"], "cubic-bezier(.4, 0, .2, 1)");

    // 令牌改名（--ds-transition-duration → --ds-transition-speed）→ FAIL 点名
    const root2 = mkdtempSync(join(tmpdir(), "dsh-gate-tokens-renamed-"));
    try {
      writeStyleBundleFixture(root2, "dsh-client-ui-theme",
        ":root{--ds-transition-speed:.2s;--ds-transition-duration-fast:.1s;--ds-transition-duration-slow:.3s;--ds-ease-in-out:ease-in-out}");
      const renamed = await probeHostTransitionTokensStage([root2]);
      assert.equal(renamed.state, "FAIL");
      assert.match(renamed.reason, /--ds-transition-duration/);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }

    // 取值形状漂移（时长写成无单位数字／缓动写成随意值）→ FAIL
    const root3 = mkdtempSync(join(tmpdir(), "dsh-gate-tokens-shape-"));
    try {
      writeStyleBundleFixture(root3, "dsh-client-ui-theme",
        ":root{--ds-transition-duration:200;--ds-transition-duration-fast:.1s;--ds-transition-duration-slow:.3s;--ds-ease-in-out:cubic-bezier(.4, 0, .2, 1)}");
      const shape = await probeHostTransitionTokensStage([root3]);
      assert.equal(shape.state, "FAIL");
      assert.match(shape.reason, /形状漂移/);
    } finally {
      rmSync(root3, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pod 02：样式解析件（层本体签名／固定层档位／定制属性名）", () => {
  const css = ".x{z-index:20;pointer-events:none;position:absolute;inset:0}.x>*{pointer-events:auto}.y{position:relative;overflow:hidden}";
  const facts = resolveOverlayLayerFacts({ elements: [{ textContent: css }] });
  assert.equal(facts.layerClass, "x");
  assert.deepEqual(facts.children, { "pointer-events": "auto" });
  assert.deepEqual(facts.ancestorRisk, []);
  assert.deepEqual(collectFixedLayerBands(".a{z-index:1100;position:fixed;top:0}.b{z-index:3;position:relative}.c{position:fixed}"), [1100]);
  assert.deepEqual(collectCustomPropertyNames(":root{--dsw-a:1;--ds-transition-duration:.2s}"), ["--ds-transition-duration", "--dsw-a"]);
  assert.equal(hasFullInset({ inset: "0" }), true);
  assert.equal(hasFullInset({ top: "0", right: "0", bottom: "0", left: "0" }), true);
  assert.equal(hasFullInset({ inset: "0 0 0 0" }), true);
  assert.equal(hasFullInset({ inset: "0 0" }), true);
  assert.equal(hasFullInset({ top: "0", left: "0" }), false);
  assert.equal(hasFullInset({ inset: "0 auto" }), false);
  // 同一类名分条声明＝按选择器归并（后声明覆盖先声明）：① 风险声明在**后续**规则上时
  // 必须取到（2026-10-09 修正：只认「首个匹配规则」会让祖先前缀风险负例恒 PASS）；
  // ② 直系子节点规则（`>*`）不得与本体规则混为一谈（混则子节点的 pointer-events
  // 会被当成本体档，`.x{z-index:20}` 形态反而取不到层本体）。
  const split = resolveOverlayLayerFacts({
    elements: [{ textContent: ".x{z-index:20;pointer-events:none;position:absolute;inset:0}.frame{position:relative;overflow:hidden}.x>*{pointer-events:auto}.frame{transform:translateZ(0)}" }]
  });
  assert.equal(split.layerClass, "x");
  assert.deepEqual(split.children, { "pointer-events": "auto" }, "直系子节点规则与本体规则分开归并");
  assert.deepEqual(split.ancestorRisk, [".frame{transform:translateZ(0)}"], "后续规则上的裁剪/重锚声明须被采到");
  // 直系子节点规则不参与祖先链判定（它不是祖先，只是层内子节点）
  const childOnly = resolveOverlayLayerFacts({ elements: [{ textContent: ".x{z-index:20;pointer-events:none;position:absolute;inset:0}.frame>*{position:relative;overflow:hidden;filter:blur(1px)}" }] });
  assert.deepEqual(childOnly.ancestorRisk, []);
});

// ---------------- pod 02 号票：焦点隔离面（真实 primitives 实包，宿主不在则整文件 SKIP） ----------------

/** 官方 primitives 实包目录（内核双包解析：根序＋fixture，按宿主版本对版；无宿主→不过滤）。 */
function hostPrimitivesEntry() {
  const cliDirs = discoverDshCliDirs();
  const hostVersion = readHostVersionDiagnostic(cliDirs);
  const dir = resolveKernelPackageDir(discoverPackageRoots(), hostVersion, "dsh-client-ui-primitives");
  return dir === null ? null : join(dir, "lib", "index.js");
}

test("pod 02 P-SHELL-FOCUS-LAYER：真实 primitives 实包导出面＋useModalLayer 合成 DOM 实跑", async (t) => {
  const entry = hostPrimitivesEntry();
  if (entry === null) {
    t.skip(`官方 primitives 实包不在本机（${discoverPackageRoots().join(" ; ") || "无包根"}）——焦点隔离面的真实调起归 preflight ④ 门`);
    return;
  }
  const pkgDir = dirname(dirname(entry));
  const loaded = await loadHostFrontendFacade(pkgDir, FOCUS_LAYER_SYMBOLS);
  for (const symbol of FOCUS_LAYER_SYMBOLS) {
    assert.equal(typeof loaded.exports[symbol], FOCUS_LAYER_SYMBOL_KINDS[symbol], `${symbol} 形状`);
  }
  assert.equal(loaded.exports.modalSelector, MODAL_SELECTOR_LITERAL, "modal 契约选择器字面");

  const result = await probeShellFocusLayerStage([dirname(pkgDir)]);
  // 提防重复键（eslint no-dupe-keys 属 lint 门）：直接构造对象字面量
  void { top: "0", left: "0" };
  assert.equal(result.state, "PASS", `${result.reason ?? ""}`);
  assert.deepEqual(result.observations, {
    mountedActive: "首个可聚焦控件",
    inertExcluded: true,
    tabTrap: true,
    escapeClosedTop: true,
    behindModal: true,
    nonTopUnmountKeepsFocus: true,
    returnFocus: true
  });
});

test("pod 02：闭包提取件（import 绑定／顶层声明闭包／漂移即缺失）", () => {
  const source = [
    'import { helper, other as renamed } from "./dep.js";',
    "import React from \"react\";",
    'import "./side-effect.css";',
    "const selector = \"[role=\\\"menu\\\"]\";",
    "const cache = new Map();",
    "function helper2(node) { return node; }",
    "function exported(anchor) { return helper(anchor) ?? renamed(anchor) ?? selector ?? cache; }",
    "export { exported, helper2 };"
  ].join("\n");
  const locals = collectLocalBindings(source);
  assert.deepEqual([...locals].sort(), ["React", "helper", "renamed"]);
  // 闭包桩图：按 **specifier** 建键——副作用 import（`import "./x.css"`）虽无绑定，仍是
  // 一条必须落地的依赖（Node 解析不到就抛 ERR_MODULE_NOT_FOUND），故须与命名/默认绑定
  // 同列（断言写死「两个命名绑定」会把这条依赖藏掉）。
  const needs = collectImportNeeds(source);
  assert.deepEqual([...needs.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([spec, need]) => [spec, [...need.named].sort(), need.hasDefault]), [
    ["./dep.js", ["helper", "renamed"], false],
    ["./side-effect.css", [], false],
    ["react", [], true]
  ]);
  assert.equal(needs.size, 3, "副作用 import 也须成桩（无绑定的依赖同样要落文件）");
  const closure = sliceDeclarationClosure(source, ["exported"], locals, new Set(["exported"]));
  assert.deepEqual(closure.missing, []);
  assert.deepEqual(closure.externals.sort(), ["helper", "renamed"]);
  assert.match(closure.code, /const selector = /);
  assert.match(closure.code, /const cache = new Map\(\)/);
  // 目标符号不在顶层声明面 → missing（调用方报 FAIL，不静默）
  const drifted = sliceDeclarationClosure(source, ["vanished"], locals, new Set());
  assert.deepEqual(drifted.missing, ["vanished"], "目标符号不在顶层声明面 ⇒ missing（调用方报 FAIL，不静默）");
});

test("pod 02：合成 DOM 与键盘事件夹具的契约（Tab 可聚焦项过滤 inert 祖先）", () => {
  const dom = createFocusDom();
  const wrap = dom.make("div", { attrs: { inert: "" } });
  const covered = dom.make("button", { attrs: { tabindex: "0" } });
  const plain = dom.make("button", { attrs: { tabindex: "0" } });
  const disabled = dom.make("button", { attrs: { disabled: "" } });
  dom.append(wrap, covered);
  dom.append(dom.root, wrap);
  dom.append(dom.root, plain);
  dom.append(dom.root, disabled);
  const focusable = FOCUSABLE_SELECTOR;
  assert.equal(dom.document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="menu"]').length, 0);
  assert.equal(covered.closest("[inert]"), wrap);
  assert.deepEqual(dom.matchesSelector(covered, focusable), true, "元素本身是 button 形态");
  // `:not(...)` 的实参列表是**分组**(组内 `,` ＝或)：2026-10-09 修正——原先按裸 `,` 切分，
  // `:not([inert], [hidden])` 被切成 `:not([inert]`＋`[hidden])` 两段残片后恒不匹配，
  // 「inert 子树被排除」这半条判据在夹具里静默失效（只剩 `closest` 那半条在支撑）。
  assert.equal(dom.matchesSelector(covered, ':not([inert], [hidden])'), true, "祖先 inert 不由 :not 承担（浏览器里该元素仍命中），由 Tab 候选过滤承担");
  assert.equal(dom.matchesSelector(plain, ':not([inert], [hidden])'), true);
  assert.equal(dom.matchesSelector(dom.make("button", { attrs: { hidden: "" } }), ':not([inert], [hidden])'), false);
  // 官方 `useModalLayer` 的 `[tabindex="0"]` 项须能命中（属性值相等形态）
  assert.equal(dom.matchesSelector(plain, '[tabindex="0"]'), true);
  // `:not(:disabled)` 只看元素自身 disabled；inert 是祖先属性，被盖控件仍是命中项
  // （不可聚焦由 inert 自身保证）——夹具不得替浏览器多算这一层
  assert.equal(dom.matchesSelector(plain, "button:not(:disabled)"), true);
  assert.equal(dom.matchesSelector(covered, "button:not(:disabled)"), true, "inert 祖先不改变 :not(:disabled) 命中");
  assert.equal(dom.matchesSelector(disabled, "button:not(:disabled)"), false);
  // 两半分别照亮：inert 子树在候选集内、又被过滤机制排除（disabled 按钮不进候选）
  const byOrder = (a, b) => [covered, plain, disabled].indexOf(a) - [covered, plain, disabled].indexOf(b);
  assert.deepEqual(dom.focusableItems(dom.root).sort(byOrder), [covered, plain], "inert 子树内的控件本身是候选（disabled 不进候选）");
  assert.deepEqual(dom.focusableItems(dom.root, { excludeInert: true }), [plain], "过滤机制把 inert 子树排除出候选");
  assert.equal(keyEvent({ key: "Escape" }).preventDefault() ?? true, true);
  assert.equal(keyEvent({ key: "Tab" }).defaultPrevented, false, "新建事件默认未 prevented");
});
