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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { HOST_FACES } from "../lib/host-faces.js";
import { createTaskLedger, eventsFile, validateEventRecord } from "../lib/org/task-ledger.js";

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

function presetFiles(roots) {
  const out = [];
  for (const root of roots) {
    const presets = join(root, "dsh-agent-presets", "presets");
    if (!existsSync(presets)) continue;
    try {
      for (const entry of readdirSync(presets, { withFileTypes: true })) {
        if (entry.isDirectory()) out.push(join(presets, entry.name, "agent.cordis.yml"));
      }
    } catch { /* 跳过 */ }
  }
  return out;
}

// ---------------- 探针实现（每个返回 {state, reason?, coordinate?}） ----------------

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
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主（无 dsh CLI 与包根）", coordinate: "discoverPackageRoots/discoverDshCliDirs" };
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
      const layoutClient = ctx.roots.map((root) => join(root, "dsh-client-ui-layout", "lib", "client.js")).filter(existsSync);
      if (!marker(layoutClient, "__ModuleLoader__")) {
        return { state: "FAIL", reason: "宿主 client bundle 不含 __ModuleLoader__ 装载协议标记", coordinate: layoutClient.join(" ; ") || "dsh-client-ui-layout/lib/client.js" };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-CONFIG-IDS",
    face: "HF-CONFIG-IDS",
    describe: "配置面 id/key：patch 目标 id 在宿主侧存在（presets/插件包内标记）",
    run(ctx) {
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主", coordinate: "discoverPackageRoots" };
      const checks = [
        ["agent-default-model", libFiles(ctx.roots, "dsh-agent-default-model")],
        ["system-prompt", libFiles(ctx.roots, "dsh-system-prompt")],
        ["sandbox-policy", libFiles(ctx.roots, "dsh-sandbox-policy")],
        ["approval", libFiles(ctx.roots, "dsh-user-approval")],
        ["llm-pi-ai", libFiles(ctx.roots, "dsh-llm-pi-ai")],
        ["tool-bash", presetFiles(ctx.roots)]
      ];
      for (const [needle, files] of checks) {
        if (files.length === 0) {
          return { state: "FAIL", reason: `id「${needle}」的宿主载体包不存在`, coordinate: ctx.roots.join(" ; ") };
        }
        if (!marker(files, needle)) {
          return { state: "FAIL", reason: `配置 id「${needle}」在宿主包/presets 内无标记（疑似改名）`, coordinate: files.slice(0, 3).join(" ; ") };
        }
      }
      for (const bundle of ["dsh-base", "dsh-web-app"]) {
        if (!ctx.roots.some((root) => existsSync(join(root, bundle)))) {
          return { state: "FAIL", reason: `profile bundle 包 ${bundle} 不在宿主安装中`, coordinate: ctx.roots.join(" ; ") };
        }
      }
      if (!ctx.roots.some((root) => existsSync(join(root, "dsh-settings")))) {
        return { state: "FAIL", reason: "settings 文档宿主插件包 dsh-settings 不存在", coordinate: ctx.roots.join(" ; ") };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-CLIENT-SLOTS",
    face: "HF-CLIENT-SLOTS",
    describe: "前端槽位：四个槽名在宿主 layout/sidebar bundle 与契约类型中在位（槽装载探针）",
    run(ctx) {
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主", coordinate: "discoverPackageRoots" };
      const layoutFiles = libFiles(ctx.roots, "dsh-client-ui-layout");
      for (const slot of ["sidebar", "conversation", "shell.overlay"]) {
        if (!marker(layoutFiles, slot)) {
          return { state: "FAIL", reason: `槽名「${slot}」在 dsh-client-ui-layout bundle 中无标记（槽位改名/让位＝静默面）`, coordinate: layoutFiles.join(" ; ") };
        }
      }
      const sidebarFiles = libFiles(ctx.roots, "dsh-client-ui-sidebar", ["lib", join("lib", "types", "client", "contract")]);
      if (!marker(sidebarFiles, "sidebar.footer.action")) {
        return { state: "FAIL", reason: "槽名「sidebar.footer.action」在 dsh-client-ui-sidebar（含 slots 契约类型）中无标记", coordinate: sidebarFiles.slice(0, 3).join(" ; ") };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-CLIENT-VISUAL",
    face: "HF-CLIENT-VISUAL",
    describe: "视觉件：--dsw-* 主题令牌在宿主 layout bundle 在位＋primitives 包可解析",
    run(ctx) {
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主", coordinate: "discoverPackageRoots" };
      const layoutFiles = libFiles(ctx.roots, "dsh-client-ui-layout");
      if (!marker(layoutFiles, "--dsw-")) {
        return { state: "FAIL", reason: "宿主 layout bundle 不含 --dsw-* 主题令牌（令牌改名＝视觉静默退化）", coordinate: layoutFiles.join(" ; ") };
      }
      // primitives 经 require 由 Vite shell 种子表提供（web-frontend 产物内标记）
      if (!marker(ctx.webAssets, "@deepseek-ai/dsh-client-ui-primitives")) {
        return { state: "FAIL", reason: "Vite shell 种子表不含 @deepseek-ai/dsh-client-ui-primitives（require 将落空＝渲染静默失败）", coordinate: ctx.webAssets.length > 0 ? ctx.webAssets[0] : "dsh-web-frontend/dist/assets" };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-CLIENT-LOCALE",
    face: "HF-CLIENT-LOCALE",
    describe: "本地化面：真实调起官方 LocaleRuntime（行为探针——装载 bundle、apply、断言服务形状）",
    async run(ctx) {
      const candidates = ctx.roots
        .map((root) => join(root, "dsh-client-locale", "lib", "client.js"))
        .filter(existsSync);
      if (candidates.length === 0) {
        return { state: "SKIP", reason: "官方 @deepseek-ai/dsh-client-locale 不在本机", coordinate: ctx.roots.map((r) => join(r, "dsh-client-locale")).join(" ; ") };
      }
      const previousWindow = globalThis.window;
      const previousLoader = globalThis.window?.__ModuleLoader__;
      globalThis.window = {};
      let captured = null;
      globalThis.window.__ModuleLoader__ = { load: (opts) => { captured = opts; } };
      try {
        await import(pathToFileURL(candidates[0]).href);
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
        official.apply({
          effect: (fn) => { fn(); return () => {}; },
          provide: (name, svc) => { provided[name] = svc; },
          on: () => {},
          emit: () => {},
          slots: { installLocale: () => {}, inject: () => () => {}, register: () => () => {} },
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
        return { state: "FAIL", reason: `真实调起官方 locale 运行时失败：${error instanceof Error ? error.message : String(error)}`, coordinate: candidates[0] };
      } finally {
        if (previousLoader !== undefined && previousWindow !== undefined) {
          globalThis.window.__ModuleLoader__ = previousLoader;
        } else if (previousWindow === undefined) {
          delete globalThis.window;
        } else {
          delete globalThis.window.__ModuleLoader__;
        }
      }
    }
  },
  {
    id: "P-CTX-SERVICES",
    face: "HF-CTX-SERVICES",
    describe: "宿主服务容器：tools/systemPrompt 服务名在宿主插件包内在位",
    run(ctx) {
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主", coordinate: "discoverPackageRoots" };
      const toolsFiles = libFiles(ctx.roots, "dsh-tools");
      if (!marker(toolsFiles, "\"tools\"")) {
        return { state: "FAIL", reason: "dsh-tools 包内无 \"tools\" 服务名标记（服务改名→工具面静默不注册）", coordinate: toolsFiles.slice(0, 3).join(" ; ") };
      }
      const promptFiles = [...libFiles(ctx.roots, "dsh-system-prompt"), ...toolsFiles];
      if (!marker(promptFiles, "\"systemPrompt\"")) {
        return { state: "FAIL", reason: "宿主包内无 \"systemPrompt\" 服务名标记（提示段注册静默失效）", coordinate: promptFiles.slice(0, 3).join(" ; ") };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-HOST-RPC",
    face: "HF-HOST-RPC",
    describe: "宿主 RPC：client-request 信封在 dsh-client-connection、session 方法在 api-session-controller",
    run(ctx) {
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主", coordinate: "discoverPackageRoots" };
      const connFiles = libFiles(ctx.roots, "dsh-client-connection");
      if (!marker(connFiles, "client-request")) {
        return { state: "FAIL", reason: "dsh-client-connection 不含 client-request 信封标记（RPC 信封漂移）", coordinate: connFiles.slice(0, 3).join(" ; ") };
      }
      const sessionFiles = libFiles(ctx.roots, "dsh-api-session-controller");
      if (!marker(sessionFiles, "selectModel")) {
        return { state: "FAIL", reason: "dsh-api-session-controller 不含 selectModel 方法标记（session RPC 方法集漂移）", coordinate: sessionFiles.slice(0, 3).join(" ; ") };
      }
      return { state: "PASS" };
    }
  },
  {
    id: "P-SPAWN-CLI",
    face: "HF-SPAWN-CLI",
    describe: "spawn CLI：dsh --profile＋web-app --no-open＋DSH_HOME 语义标记在位",
    run(ctx) {
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主", coordinate: "discoverDshCliDirs" };
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
    run() {
      const home = mkdtempSync(join(tmpdir(), "dsh-probe-ledger-"));
      try {
        const ledger = createTaskLedger({ dshHome: home });
        const created = ledger.command({
          op: "task.intake", taskId: "TK-probe0001", actor: { kind: "host", id: "web" },
          idempotencyKey: "probe-intake", payload: { class: "duty", brief: { goal: "格式探针" } }
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
    run() {
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
        const created = ledger.command({
          op: "task.intake", taskId: "TK-probe0002", actor: { kind: "host", id: "web" },
          idempotencyKey: "probe-cmd-intake", payload: { class: "duty", brief: {} }
        });
        if (!created.ok || created.status !== "intake" || !Number.isInteger(created.seq)) {
          return { state: "FAIL", reason: `命令面成功形状不符（{ok,taskId,status,seq}）：${JSON.stringify(created)}`, coordinate: "lib/org/ledger-host.js" };
        }
        const rejected = ledger.command({
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
    describe: "会话日志面：DSH_HOME/sessions/<分片>/<会话>/session.jsonl.zstd 布局在位",
    run(ctx) {
      if (!ctx.hostInstalled) return { state: "SKIP", reason: "本机未安装宿主", coordinate: "discoverDshCliDirs" };
      const dshHome = process.env.DSH_HOME ?? join(homedir(), ".dsh");
      const sessionsRoot = join(dshHome, "sessions");
      const coordinate = sessionsRoot;
      let shards;
      try {
        shards = readdirSync(sessionsRoot, { withFileTypes: true });
      } catch {
        return { state: "SKIP", reason: "本机无会话日志目录（宿主未产出会话）", coordinate };
      }
      for (const shard of shards) {
        if (!shard.isDirectory()) continue;
        try {
          for (const session of readdirSync(join(sessionsRoot, shard.name), { withFileTypes: true })) {
            if (session.isDirectory()
              && existsSync(join(sessionsRoot, shard.name, session.name, "session.jsonl.zstd"))) {
              return { state: "PASS", coordinate: join(shard.name, session.name) };
            }
          }
        } catch { /* 分片不可读 → 继续扫 */ }
      }
      return { state: "SKIP", reason: "会话日志根存在但尚无 session.jsonl.zstd（无旧会话可核布局）", coordinate };
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
        state: "FAIL", reason: `探针自身异常：${error instanceof Error ? error.message : String(error)}`
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
    console.error(`宿主契约门: 门自身错误（${error instanceof Error ? error.message : String(error)}）`);
    process.exit(2);
  }
}
