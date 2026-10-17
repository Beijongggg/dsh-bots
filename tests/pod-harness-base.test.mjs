/**
 * pod 10 号票判据（规格 §V-P7.1–V-P7.7；基线＝官方宿主 0.2.0-rc.1；
 * 工具面冻结值随 host-alpha2-adapt/01 在 0.2.1-alpha.2 重测：27→31 工具）。
 *
 * 口径：bot 基底＝官方默认 preset `standard`（31 工具）＋呈现面 ptc；per-bot
 * settings.yaml 的 `agent-presets:` 段与 profile patch 的 `- id: settings` 重定向行
 * 属死键（0.2.0-rc.1 无读者，0.2.1-alpha.2 复核同判——agent-presets 引用仅是
 * 设置面板 UI 槽 id），生成器不再写出；人物设定不裁；`.agent-presets/`
 * 死目录＋13 条断链软链登记长期观察项。
 *
 * 外部载体（官方 standard preset／dsh CLI）缺失时打印 `⤼ SKIP:` 标记
 * （tests/run.mjs 分列计数），文档面与代码面断言照常执行。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { internals } from "../lib/index.js";
import { OP_SET, validateOpSet } from "../lib/org/op-set.js";
import { discoverDshCliDirs, discoverPackageRoots } from "../scripts/host-contract-probe.mjs";
import { SKIP_MARKER } from "./run.mjs";

const require = createRequire(import.meta.url);
const { buildPatchYaml, BOT_SETTINGS_HEADER } = require("../lib/shared.cjs");

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const SPEC_PATH = join(repoRoot, ".scratch/pod/spec.md");
const UNDERSTANDING_PATH = join(repoRoot, "docs/PROJECT_UNDERSTANDING.md");
const ISSUE_PATH = join(repoRoot, ".scratch/pod/issues/10-harness-base-explicit.md");

/** 规格「31 工具清单（实测）」冻结值（0.2.0-rc.1 真实会话实测 27 工具转写规格 §3；
 *  0.2.1-alpha.2 重测（host-alpha2-adapt/01）：preset 移除 3 行字面 disabled 行
 *  （ralph／subagent-codex／subagent-claude-code，本就 0 模型可见工具）＋新增
 *  tool-schedule（4 工具）→ 31。名称来源＝官方工具包 ctx.tools.register 注册名，
 *  其余 15 个工具贡献包新旧版名称面逐包对拍一致。
 *  0.2.1-alpha.5 复核（host-alpha5-adapt/01）：preset 新增字面 disabled 行
 *  tool-plugin-market（0 模型可见工具），顶层清单仍 31；subagent 行内 config 的
 *  schedule_* toolFilter.deny 被官方移除（子代理内部过滤，不动顶层清单）。 */
const FROZEN_31 = Object.freeze([
  "bash", "read", "write", "edit", "read_image", "glob", "grep", "job_output", "job_list",
  "job_kill", "schedule_create", "schedule_list", "schedule_delete", "schedule_update",
  "skill", "get_goal", "create_goal", "update_goal", "exit_plan_mode",
  "send_message", "interrupt_agent", "list_agents", "subagent", "subagent_fork",
  "list_subagent_models", "workflow", "ask_user_question", "todo_write", "web_search",
  "web_fetch", "present"
]);

/** 官方 standard preset 的全量插件行（32 行，0.2.1-alpha.5 实测；行 id 含 group 子项；
 *  alpha.2→alpha.5 增量＝末尾新增 tool-plugin-market）。 */
const STANDARD_ROWS = Object.freeze([
  "persona", "agent-instructions", "time-context", "tool-bash", "tool-pwsh", "tool-fs",
  "tool-fs-search", "tool-jobs", "tool-schedule", "skill-filesystem", "tool-skill",
  "command-goal", "tool-goal", "planning", "plan-mode", "compaction", "compaction-basic",
  "command-compact", "tool-result-pruner", "delegation", "tool-subagent-control",
  "tool-subagent-list-agents", "tool-subagent", "tool-subagent-fork", "workflow-ptc",
  "tool-workflow", "tool-ask-user", "tool-todo", "tool-web", "present",
  "tool-plugin-manager", "tool-plugin-market"
]);

/** 官方 preset 里字面 `disabled: true` 的行（平台无关；0.2.1-alpha.5 起为
 *  tool-plugin-manager＋tool-plugin-market——plugin-market 为 alpha.5 新增行且
 *  出厂即 disabled，0 模型可见工具）。 */
const STANDARD_DISABLED_LITERAL = Object.freeze([
  "tool-plugin-manager", "tool-plugin-market"
]);

/** 工具行 → 模型可见工具名（名称来源＝官方工具包注册名；`tool-subagent` 行随附
 *  `modelSelectionSettings: true` 的 `list_subagent_models`）。 */
const TOOL_ROW_NAMES = Object.freeze({
  "tool-bash": ["bash"],
  "tool-pwsh": ["pwsh"],
  "tool-fs": ["read", "write", "edit", "read_image"],
  "tool-fs-search": ["glob", "grep"],
  "tool-jobs": ["job_output", "job_list", "job_kill"],
  "tool-skill": ["skill"],
  "tool-goal": ["get_goal", "create_goal", "update_goal"],
  "plan-mode": ["exit_plan_mode"],
  "tool-subagent-control": ["send_message", "interrupt_agent"],
  "tool-subagent-list-agents": ["list_agents"],
  "tool-subagent": ["subagent", "list_subagent_models"],
  "tool-subagent-fork": ["subagent_fork"],
  "tool-workflow": ["workflow"],
  "tool-ask-user": ["ask_user_question"],
  "tool-todo": ["todo_write"],
  "tool-web": ["web_search", "web_fetch"],
  "tool-schedule": ["schedule_create", "schedule_list", "schedule_delete", "schedule_update"],
  "present": ["present"]
});

/** 平台化启用判定：bash／pwsh 二选一（官方 preset 的 !!js 表达式）。 */
function platformEnabled(row) {
  if (STANDARD_DISABLED_LITERAL.includes(row)) return false;
  if (row === "tool-bash") return process.platform !== "win32";
  if (row === "tool-pwsh") return process.platform === "win32";
  return true;
}

let skipAnnounced = false;
function announceSkip(reason, t) {
  if (!skipAnnounced) {
    console.log(`${SKIP_MARKER} ${reason}`);
    skipAnnounced = true;
  }
  t?.skip?.(reason);
}

/** 定位官方 standard preset（真实宿主载体；缺失→null）。 */
function findStandardPreset() {
  for (const root of discoverPackageRoots()) {
    const file = join(root, "dsh-web-app", "presets", "standard.patch.yml");
    if (existsSync(file)) return file;
  }
  return null;
}

/** 定位可运行的 dsh 入口（lib/bin.js；缺失→null）。 */
function findDshBin() {
  const dirs = discoverDshCliDirs();
  const dir = dirs.at(-1) ?? dirs[0];
  if (dir === undefined) return null;
  const bin = join(dir, "lib", "bin.js");
  return existsSync(bin) ? bin : null;
}

/** 解析官方 preset 的插件行（缩进 ≥10 的 `- id:` 行）与字面 disabled 标记。 */
function parseStandardRows(text) {
  const rows = [];
  let current = null;
  for (const line of text.split("\n")) {
    const match = /^( {10,})- id: (\S+)\s*$/.exec(line);
    if (match) {
      current = { id: match[2], disabledLiteral: false };
      rows.push(current);
      continue;
    }
    if (current !== null && /^\s+disabled: true\s*$/.test(line)) current.disabledLiteral = true;
  }
  return rows;
}

/** 规格「31 工具清单（实测）」行里的反引号清单。 */
function specToolNames() {
  const line = readFileSync(SPEC_PATH, "utf8").split("\n").find((entry) => entry.includes("31 工具清单（实测）"));
  assert.ok(line, "规格缺「31 工具清单（实测）」行");
  const list = line.match(/`([^`]+)`/);
  assert.ok(list, "规格工具清单行缺反引号清单");
  return list[1].trim().split(/\s+/);
}

/** 生成器单一坐标：workspace-write patch（provider/model 均非空 → llm-pi-ai 段参与迁移）。 */
function probePatch() {
  return buildPatchYaml({
    botId: "pod10-probe", role: "probe", provider: "probe-route", model: "probe-model",
    reasoningEffort: "high", permission: "workspace-write", workspace: "/tmp/pod10-probe-ws",
    settingsText: "llm-pi-ai:\n  providers:\n    probe-route:\n      models:\n        - id: probe-model\n"
  });
}

// ---------------------------------------------------------------- V-P7.1

test("V-P7.1 规格写明「基底＝官方默认 preset standard（31 工具）＋呈现面 ptc」、人物设定不裁，并附实测证据", () => {
  const spec = readFileSync(SPEC_PATH, "utf8");
  for (const needle of [
    "基底＝官方默认 preset `standard`（31 工具）",
    "＋呈现面 ptc",
    "人物设定不裁",
    "`opencode-go` 带点名 **200 接受**",
    "`niko` **400 拒绝**",
    "pattern '^[a-zA-Z0-9_-]+$'"
  ]) {
    assert.ok(spec.includes(needle), `规格缺口径/证据文字：${needle}`);
  }
  // 配置扫描：生成 patch 不覆写 preset 注册表、不写 settings 死重定向行；
  // settings 模板只含说明注释（无配置键）。
  const patch = probePatch();
  assert.ok(!/agent-preset/.test(patch), "patch 不得覆写 agent-preset*（无覆写 → 回落官方默认 standard）");
  assert.ok(!/^- id: settings$/m.test(patch), "patch 不得再写 settings 死重定向行");
  for (const line of BOT_SETTINGS_HEADER.split("\n")) {
    const trimmed = line.trim();
    assert.ok(trimmed === "" || trimmed.startsWith("#"), `settings 模板不得含配置键：${JSON.stringify(line)}`);
  }
});

// ---------------------------------------------------------------- V-P7.2

test("V-P7.2 31 工具清单与官方默认 preset 逐项一致（防静默漂移）", (t) => {
  if (process.platform === "win32") return announceSkip("规格 31 工具清单为 Linux 实测（bash）；win32 变体不在本判据", t);
  const names = specToolNames();
  assert.deepEqual(names, [...FROZEN_31], "规格工具清单与冻结值逐项一致（含顺序）");
  assert.equal(names.length, 31, "工具数须为 31");

  const presetFile = findStandardPreset();
  if (presetFile === null) return announceSkip("官方 dsh-web-app/presets/standard.patch.yml 不在本机载体（SKIP）", t);
  const rows = parseStandardRows(readFileSync(presetFile, "utf8"));
  assert.deepEqual([...rows.map((row) => row.id)].sort(), [...STANDARD_ROWS].sort(),
    "官方 standard preset 插件行全集漂移（增/删/改名）——须重测 31 工具清单");
  assert.equal(rows.length, STANDARD_ROWS.length);
  assert.deepEqual(rows.filter((row) => row.disabledLiteral).map((row) => row.id).sort(),
    [...STANDARD_DISABLED_LITERAL].sort(), "官方 preset 字面 disabled 行集合漂移");

  const enabledToolRows = Object.keys(TOOL_ROW_NAMES).filter((row) => platformEnabled(row));
  const expanded = enabledToolRows.flatMap((row) => TOOL_ROW_NAMES[row]);
  assert.equal(expanded.length, 31, "启用工具行展开须恰为 31 个工具名");
  assert.deepEqual([...expanded].sort(), [...names].sort(),
    "官方 preset 启用工具行展开 ≠ 规格 31 工具清单（静默漂移）");
});

// ---------------------------------------------------------------- V-P7.3

test("V-P7.3 DSH_TOOLS_MODE 无条件注入不动（不得改为按 provider 分叉）", () => {
  const source = readFileSync(join(repoRoot, "lib/index.js"), "utf8");
  const statement = source.match(/const spawnOverrides = \{[^}]*\};/);
  assert.ok(statement, "spawnBot 缺 spawnOverrides 字面量");
  assert.match(statement[0], /DSH_TOOLS_MODE: "ptc"/, "spawnOverrides 须含 DSH_TOOLS_MODE: \"ptc\"");
  assert.ok(!/modelProvider|provider/.test(statement[0]), "spawnOverrides 不得按 provider 分叉");
  const values = [...source.matchAll(/DSH_TOOLS_MODE\s*:\s*"([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(values, ["ptc"], "DSH_TOOLS_MODE 只允许一处无条件字面量赋值 ptc");
  assert.ok(!/DSH_TOOLS_MODE\s*:(?!\s*")/.test(source), "DSH_TOOLS_MODE 不得按变量/条件赋值");
  // 行为锚点：tests/spawn-env.test.mjs 集成用例对未绑岗位、无模型 pin 实例实跑断言 ptc 在位。
  assert.ok(readFileSync(join(repoRoot, "tests/spawn-env.test.mjs"), "utf8")
    .includes('assert.equal(dump.DSH_TOOLS_MODE, "ptc"'), "spawn-env 集成用例的行为锚缺失");
});

// ---------------------------------------------------------------- V-P7.4

test("V-P7.4 死配置清理：生成器同步（patch 无 settings 重定向、settings 模板无 agent-presets）", () => {
  const patch = probePatch();
  assert.ok(!/^- id: settings$/m.test(patch), "patch 不得含 settings 重定向行");
  assert.ok(!/agent-presets/.test(patch), "patch 不得含 agent-presets");
  // 生成器同步：两个生成路径共用 shared.cjs 单一事实源，代码面（去注释）无死键字面量。
  const stripComments = (src) => src.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");
  const indexSource = readFileSync(join(repoRoot, "lib/index.js"), "utf8");
  const scriptSource = readFileSync(join(repoRoot, "scripts/create-bot.cjs"), "utf8");
  for (const [name, source] of [["lib/index.js", indexSource], ["create-bot.cjs", scriptSource]]) {
    assert.match(source, /BOT_SETTINGS_HEADER/, `${name}: 须用单一事实源 BOT_SETTINGS_HEADER 初始化 settings.yaml`);
    assert.ok(!/["'`]agent-presets:/.test(stripComments(source)), `${name}: 仍在写 agent-presets 死键`);
  }
  // 行为面双路径由 tests/bot-profile.test.mjs::「生成器不写出死键」覆盖（script＋builtin）。
  assert.ok(readFileSync(join(repoRoot, "tests/bot-profile.test.mjs"), "utf8")
    .includes("生成器不写出死键"), "bot-profile 双路径行为用例缺失");
});

// ---------------------------------------------------------------- V-P7.5

test("V-P7.5 反向验证：dsh --dump-config 不再出现 agent-presets／settings 死重定向", async (t) => {
  const bin = findDshBin();
  if (bin === null) return announceSkip("dsh CLI（lib/bin.js）不在本机载体（SKIP）", t);
  if (!existsSync(join(repoRoot, "scripts/create-bot.cjs"))) return announceSkip("生成器脚本缺失（SKIP）", t);
  const home = mkdtempSync(join(tmpdir(), "pod10-dump-config-"));
  const previousScript = process.env.POD_CREATE_BOT_SCRIPT;
  try {
    writeFileSync(join(home, "settings.yaml"),
      "llm-pi-ai:\n  providers:\n    local-route:\n      api: openai-completions\n"
      + "      baseURL: https://example.invalid/v1\n      models:\n        - id: model-a\n");
    process.env.POD_CREATE_BOT_SCRIPT = join(home, "missing-create-bot.cjs"); // 内置脚手架路径
    const bot = { id: "worker", name: "Worker", role: "implementation", port: 3291,
      modelProvider: "local-route", model: "model-a", permission: "workspace-write" };
    mkdirSync(join(home, "profiles", bot.id), { recursive: true });
    await internals.scaffoldBot({ logger: { info() {}, warn() {}, error() {} } }, home, bot);
    // 既有 bot 同型：settings.yaml 盘上仍带 legacy `agent-presets:` 死段（生成器已不写）
    const settingsPath = join(home, "profiles", bot.id, "settings.yaml");
    writeFileSync(settingsPath, "agent-presets:\n  default: bot-nopersona\n" + readFileSync(settingsPath, "utf8"));

    const out = execFileSync(process.execPath, [bin, "--profile", bot.id, "--dump-config"], {
      cwd: home, env: { ...process.env, DSH_HOME: home }, encoding: "utf8", timeout: 120000
    });
    assert.ok(!out.includes("agent-presets"), "dump 输出不得出现 agent-presets（该段不进入解析）");
    const layers = [];
    for (const line of out.split("\n")) {
      if (line.startsWith("# ==")) { layers.push({ header: line, body: [] }); continue; }
      if (layers.length > 0) layers.at(-1).body.push(line);
    }
    const ours = layers.filter((layer) => layer.header.includes(`profiles/${bot.id}/cordis.patch.yml`));
    assert.ok(ours.length > 0, "dump 中须有我方 profile patch 层（定位有效）");
    const ourText = ours.map((layer) => layer.body.join("\n")).join("\n");
    assert.ok(ourText.includes("- id: llm-pi-ai"), "我方 patch 层须含迁移后的 llm-pi-ai（定位有效性锚）");
    assert.ok(!/^- id: settings$/m.test(ourText), "我方 patch 层不得含 settings 死重定向行");
  } finally {
    if (previousScript === undefined) delete process.env.POD_CREATE_BOT_SCRIPT;
    else process.env.POD_CREATE_BOT_SCRIPT = previousScript;
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- V-P7.6

test("V-P7.6 不碰岗位 op 集与 op 命名合同（负例：改名 op 即被拒）", () => {
  const verdict = validateOpSet();
  assert.equal(verdict.ok, true, `op-set 表须通过机械校验：${verdict.violations.join("；")}`);
  const allOps = Object.values(OP_SET).flat();
  for (const op of allOps) {
    assert.match(op, /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/, `op 命名合同（点分小写）被破坏：${op}`);
  }
  for (const anchor of ["task.intake", "task.triage", "mail.send", "knowledge.register", "ledger.read"]) {
    assert.ok(allOps.includes(anchor), `岗位 op 集锚点缺失（改名？）：${anchor}`);
  }
  // 负例：把 duty-coordinator 的 task.intake 改名为 taskIntake → 词表外违例（命名合同看守有效）
  const tampered = {
    ...OP_SET,
    "duty-coordinator": OP_SET["duty-coordinator"].map((op) => op === "task.intake" ? "taskIntake" : op)
  };
  const bad = validateOpSet(tampered);
  assert.equal(bad.ok, false, "改名后的 op 必须被判违例（负例）");
  assert.ok(bad.violations.some((line) => line.includes("taskIntake")), `违例清单须点名 taskIntake：${bad.violations.join("；")}`);
});

// ---------------------------------------------------------------- V-P7.7

test("V-P7.7 观察项登记：.agent-presets 死目录＋13 条断链软链入「仍可选题」", () => {
  const doc = readFileSync(UNDERSTANDING_PATH, "utf8");
  const start = doc.lastIndexOf("仍可选题");
  assert.ok(start > -1, "文档缺「仍可选题」节");
  const end = doc.indexOf("\n## ", start);
  const section = doc.slice(start, end === -1 ? undefined : end);
  for (const needle of [".agent-presets/", "13 条断链软链", "触发＝", "运行面写入"]) {
    assert.ok(section.includes(needle), `「仍可选题」缺观察项要素：${needle}`);
  }
  // CHANGELOG 留界由 Lead 统一落档：建议事件文本须已在票面 Comments 就位（含四要件与授权依据）。
  const issue = readFileSync(ISSUE_PATH, "utf8");
  assert.ok(issue.includes("EV-20261009-pod10-harness-base-explicit"), "票面 Comments 缺建议 CHANGELOG 事件 id");
  for (const needle of ["范围：", "变化：", "验证：", "授权："]) {
    assert.ok(issue.includes(needle), `建议事件文本缺四要件：${needle}`);
  }
});
