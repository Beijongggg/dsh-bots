"use strict";
/**
 * dsh-bots 的 CJS 共享层 —— host 插件（lib/index.js，ESM）与脚手架 CLI
 * （scripts/create-bot.cjs）共用的纯函数，单一事实源。
 *
 * 历史上 yamlQuote / READ_ONLY_TOOLS / PERMISSION_MODES / buildPatchYaml /
 * syncPiAiSection 在两个文件里各有一份"刻意保持同步"的副本，现收敛到这里；
 * 两端都改为引用本模块。.cjs 后缀使其能同时被 "type":"module" 包内的 ESM
 * （createRequire）与 CJS 脚本（require "../lib/shared.cjs"）加载。
 *
 * 纯 Node 内置模块，无第三方依赖；全部同步 IO、无副作用状态。
 */

const fs = require("node:fs");
const path = require("node:path");

/** 与参考 web profile 一致的 profile bundles。 */
const BUNDLES = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"];

/** 可选的权限模式（与官方 DSH permission presets 对齐）。 */
const PERMISSION_MODES = ["read-only", "workspace-write", "danger-full-access"];
/** 新建 Bot 的默认权限模式（与官方 workspace-write 默认一致）。 */
const DEFAULT_PERMISSION = "workspace-write";

/**
 * readOnly 时禁用的 shell/文件写工具（id + 带 scope 的包名）。条目 id 在某个
 * deployment 里不存在时，patch loader 会无害地忽略（no-op）。
 */
const READ_ONLY_TOOLS = [
  ["tool-bash", "@deepseek-ai/dsh-tool-bash"],
  ["tool-bash-persistent", "@deepseek-ai/dsh-tool-bash-persistent"],
  ["tool-str-replace-editor", "@deepseek-ai/dsh-tool-str-replace-editor"],
  ["tool-edit", "@deepseek-ai/dsh-tool-str-replace-editor"], // 别名；不存在时无害
  ["tool-pwsh", "@deepseek-ai/dsh-tool-pwsh"],
  ["tool-pwsh-persistent", "@deepseek-ai/dsh-tool-pwsh-persistent"]
];

/**
 * YAML 单引号标量转义：' 双写为 ''、换行/控制空白折叠为单空格，保证
 * role/provider/model 等值里的特殊字符不破坏文档且保持单行。
 */
function yamlQuote(value) {
  const normalized = String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[\t\f\v\u0000-\u0008\u000b\u000e-\u001f\u007f]/g, " ")
    .replace(/\n+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return `'${normalized.replace(/'/g, "''")}'`;
}

/**
 * 构建 <root>/profiles/<botId>/cordis.patch.yml 文档：
 * （provider/model 均非空时）agent-default-model pin + persona（通过
 * `- id: system-prompt` 的 `config.persona` 设置；不用 `- insert: dsh-persona`——
 * dsh-persona 是 scope-only，全局挂载会崩 "prompt section deployment:persona
 * is already registered"）+ read-only 时 6 条 disabled 工具行 + sandbox-policy
 * 与 approval 配置（与官方 read-only / workspace-write / danger-full-access
 * presets 对齐）+ 自加载 dsh-bots 插件 + settings 文档重定向。
 *
 * @param {object} args
 * @param {string} args.botId          注册表 bot id（同时是 profile 目录名）
 * @param {string} args.role           persona 文本（bot 角色描述）
 * @param {string} args.provider       模型提供商（空串则不写模型 pin）
 * @param {string} args.model          模型 id（空串则不写模型 pin）
 * @param {string} args.reasoningEffort 推理等级 id（可选；空串/undefined 不写推理等级行）
 * @param {string} args.permission     权限模式（PERMISSION_MODES 之一）
 * @param {string} args.workspace      bot workspace 绝对路径（sandbox workspaceRoot）
 * @param {string} args.settingsPath   per-bot settings.yaml 绝对路径
 * @param {string} args.settingsText   per-bot 旧配置，原样迁移 provider 参数
 * @param {string} args.previousPatch  当前 patch，保留已迁移的 provider 配置
 */
function buildPatchYaml({ botId, role, provider, model, reasoningEffort, permission, workspace, settingsPath, settingsText = "", previousPatch = "" }) {
  const readOnly = permission === "read-only";
  const lines = [];
  lines.push(`# Bot profile: ${botId}${readOnly ? " (read-only: write/exec tools disabled)" : ""}`);
  if (provider !== "" && model !== "") {
    lines.push("");
    lines.push("# Pin the default agent model for this bot (id-targeted config override).");
    lines.push("- id: agent-default-model");
    lines.push("  config:");
    lines.push(`    provider: ${yamlQuote(provider)}`);
    lines.push(`    model: ${yamlQuote(model)}`);
    if (typeof reasoningEffort === "string" && reasoningEffort !== "") {
      lines.push(`    reasoningEffort: ${yamlQuote(reasoningEffort)}`);
    }
  }
  // Preserve the active provider blocks, including user edits and optional fields.
  // Legacy settings are a migration source only when the current patch has none.
  const providerBlocks = previousPatch.split(/(?=^- )/m)
    .filter((block) => /^- id: *(['"]?)llm-pi-ai\1[ \t]*(?:#.*)?(?:\r?\n|$)/.test(block));
  const section = piAiSection(settingsText);
  if (providerBlocks.length > 0 || section !== null) {
    lines.push("", "# Provider configuration for hosts that read plugin Config directly.");
  }
  if (providerBlocks.length > 0) {
    for (const block of providerBlocks) {
      const content = block.split(/\r?\n/);
      // Comments at column zero after the entry describe the next managed block.
      while (content.length > 0 && /^(?:\s*|#.*)$/.test(content.at(-1))) content.pop();
      lines.push(...content);
    }
  } else if (section !== null) {
    const [header, ...body] = section.trimEnd().split("\n");
    lines.push("- id: llm-pi-ai");
    lines.push(`  config:${header.replace(/^llm-pi-ai\s*:/, "")}`);
    lines.push(...body.map((line) => line === "" ? "" : `  ${line}`));
  }
  lines.push("");
  lines.push("# Set this bot's persona (deployment persona text).");
  lines.push("- id: system-prompt");
  lines.push("  config:");
  lines.push(`    persona: ${yamlQuote(role ?? "")}`);
  if (readOnly) {
    lines.push("");
    lines.push("# Read-only bot: disable shell execution and file-write tools.");
    for (const [toolId, pkgName] of READ_ONLY_TOOLS) {
      lines.push(`- id: ${toolId}`);
      lines.push(`  name: '${pkgName}'`);
      lines.push("  disabled: true");
    }
  }
  lines.push("");
  lines.push("# Pin this bot's sandbox mode and approval policy (aligned with DSH permission presets).");
  lines.push("- id: sandbox-policy");
  lines.push("  config:");
  lines.push(`    mode: ${yamlQuote(permission)}`);
  lines.push(`    workspaceRoot: ${yamlQuote(workspace)}`);
  lines.push("- id: approval");
  lines.push("  config:");
  lines.push(`    policy: ${yamlQuote(permission === "danger-full-access" ? "never" : "ask")}`);
  lines.push("");
  lines.push("# Load dsh-bots plugin (inbox watcher + bot-to-bot messaging).");
  lines.push("- insert:");
  lines.push("    - id: bots");
  lines.push("      name: 'dsh-bots'");
  lines.push("");
  lines.push("# Redirect this bot's settings doc to a per-bot settings.yaml that selects");
  lines.push("# the bot-nopersona preset (a minimal copy with the persona entry removed),");
  lines.push("# so the deployment persona (bot role) reaches the model unmasked.");
  lines.push("- id: settings");
  lines.push("  config:");
  lines.push(`    path: ${yamlQuote(settingsPath)}`);
  lines.push("");
  return lines.join("\n");
}

/**
 * 与官方 DEFAULT_CONTEXT_WINDOW 一致的默认上下文窗口：
 * - deepseek-official（dsh-llm-deepseek）：1000000
 * - 其余 llm-pi-ai provider 无显式配置时：262144（DEFAULT_CONTEXT_WINDOW）
 */
const DSH_DEFAULT_CONTEXT_WINDOW = 262144;
const DEEPSEEK_OFFICIAL_CONTEXT_WINDOW = 1000000;

/** 从 bot settings.yaml 的 llm-pi-ai 段解析某 provider/model 条目的显式 contextWindow；无 → null。 */
function explicitContextWindowFromSettings(settingsText, provider, model) {
  if (typeof settingsText !== "string") return null;
  const SECTION_RE = /^llm-pi-ai\s*:/;
  const KEY_RE = /^[A-Za-z0-9_-]+\s*:/;
  const lines = settingsText.split(/\r?\n/);
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i])) { sectionStart = i; break; }
  }
  if (sectionStart === -1) return null;
  // 找到 providers: 行（llm-pi-ai 段内、缩进 2）
  let providersIdx = -1;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (KEY_RE.test(lines[i])) break; // 下一个顶层键 → 段结束
    if (/^ {2}providers\s*:/.test(lines[i])) { providersIdx = i; break; }
  }
  if (providersIdx === -1) return null;
  // 在 providers 下找目标 provider 块（缩进 4）
  let providerStart = -1;
  for (let i = providersIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^ {2,3}[A-Za-z0-9_-]+\s*:/.test(line) && !/^ {4}/.test(line)) {
      // 下一个同层 provider 键（缩进 0-3 顶层键会先被 KEY_RE 打断，这里兜底）
    }
    if (/^ {4}[A-Za-z0-9_.-]+\s*:/.test(line)) {
      const name = line.trim().replace(/:.*$/, "");
      if (name === provider) { providerStart = i; break; }
    }
  }
  if (providerStart === -1) return null;
  // provider 块内找 models:（缩进 6）下的 - id: <model> 条目（缩进 8），其后行（缩进 10+）取 contextWindow
  let inModel = false;
  let sawModels = false;
  for (let i = providerStart + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^ {4}[A-Za-z0-9_.-]+\s*:/.test(line) && !/^ {6}/.test(line)) break; // 离开 provider 块
    if (/^ {6}models\s*:/.test(line)) { sawModels = true; continue; }
    if (!sawModels) continue;
    if (/^ {8}- id:\s*/.test(line)) {
      const id = line.replace(/^ {8}- id:\s*/, "").trim().replace(/^['"]|['"]$/g, "");
      inModel = id === model;
      continue;
    }
    if (inModel && /^ {10,}contextWindow:\s*(\d+)\s*$/.test(line)) {
      const v = Number(line.match(/^ {10,}contextWindow:\s*(\d+)/)[1]);
      if (Number.isInteger(v) && v > 0) return v;
    }
  }
  return null;
}

/** 解析模型在 DSH 中的上下文窗口：显式配置 > provider 默认（deepseek-official 1M / 其余 262144）。 */
function resolveModelContextWindow(provider, model, settingsText) {
  const explicit = explicitContextWindowFromSettings(settingsText, provider, model);
  if (explicit !== null) return explicit;
  return provider === "deepseek-official" ? DEEPSEEK_OFFICIAL_CONTEXT_WINDOW : DSH_DEFAULT_CONTEXT_WINDOW;
}

/**
 * 原子写文件：先写临时文件（tmp 名带 pid+时间戳防并发碰撞）再 rename 覆盖，
 * 避免半写状态。注册表 / 自愈计数 / llm-pi-ai 段同步三处共用的写模式。
 */
function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, file);
}

/** 提取旧 settings 的 provider 配置段，保留各 provider 的全部字段。 */
function piAiSection(raw) {
  const SECTION_RE = /^llm-pi-ai\s*:/;
  const KEY_RE = /^[A-Za-z0-9_-]+\s*:/;
  const lines = raw.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    // 下一个列 0 的键行（或文档分隔符 "---"）结束本段；EOF 也结束。
    if (KEY_RE.test(lines[i]) || lines[i].startsWith("---")) { end = i; break; }
  }
  // 段内容原样保留（含注释/空行），末尾空行收敛为最多一个（无空行时也保证结尾一个换行）。
  return lines.slice(start, end).join("\n").replace(/\n*$/, "\n");
}

/**
 * 把全局 settings.yaml 的 `llm-pi-ai:` 段同步进 bot 的 settings.yaml（幂等）。
 * - 全局文件缺失/读取失败 → 静默 no-op（return false）。
 * - 全局无列 0 的 `llm-pi-ai:` 键行 → no-op。
 * - bot 文件已有该段 → no-op，绝不覆盖用户编辑。
 * - 否则把提取段原样追加并原子写入。返回是否写入了内容。
 */
function syncPiAiSection(root, botId) {
  let globalRaw;
  try {
    globalRaw = fs.readFileSync(path.join(root, "settings.yaml"), "utf8");
  } catch {
    return false; // 全局 settings.yaml 缺失/不可读 → 静默 no-op
  }
  const section = piAiSection(globalRaw);
  if (section === null) return false;
  const botSettingsPath = path.join(root, "profiles", botId, "settings.yaml");
  let botRaw;
  try {
    botRaw = fs.readFileSync(botSettingsPath, "utf8");
  } catch {
    return false; // bot settings.yaml 缺失/不可读 → 跳过（调用方的确保块负责创建）
  }
  if (piAiSection(botRaw) !== null) return false; // 幂等：已有该段，绝不覆盖
  const sep = botRaw.endsWith("\n") ? "" : "\n"; // 保证以换行结尾后追加
  writeFileAtomic(botSettingsPath, botRaw + sep + "\n" + section);
  return true;
}

const AGENT_DEFAULT_MODEL_RE = /^agent-default-model\s*:/;
const AGENT_DEFAULT_MODEL_KEY_RE = /^(\s+)(provider|model|reasoningEffort)\s*:/;

/**
 * 把注册表的 agent-default-model（provider/model/reasoningEffort）同步进 bot 的
 * settings.yaml（幂等，文本级手术，只动本段，绝不覆盖其他内容）：
 * - provider/model 均非空 → 段缺失则整段追加；已存在则只重写段内 provider/
 *   model/reasoningEffort 三个键值（其余行原样保留），缺失的键值行补写。
 * - provider/model 任一为空 → 删除整段（bot 不再有模型 pin）。
 * 返回是否写入了内容（供调用方日志）。
 *
 * 兼容旧宿主：其 agent-default-model 挂载 settings 后会覆盖 compose 默认值，
 * 因此 settings 与 patch 的 pin 必须同拍。当前宿主从插件 Config 读取模型，
 * 并把旧 settings.yaml 一次导入 profile 后改名为 settings.yaml.imported；这里
 * 保留旧格式供迁移入口消费，模型配置本体仍由 buildPatchYaml 写入。
 */
function upsertAgentDefaultModelSection(root, botId, { provider, model, reasoningEffort }) {
  const botSettingsPath = path.join(root, "profiles", botId, "settings.yaml");
  let raw;
  try {
    raw = fs.readFileSync(botSettingsPath, "utf8");
  } catch {
    return false; // bot settings.yaml 缺失/不可读 → 跳过
  }
  const pr = typeof provider === "string" ? provider : "";
  const mo = typeof model === "string" ? model : "";
  const ef = typeof reasoningEffort === "string" ? reasoningEffort : "";
  const lines = raw.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (AGENT_DEFAULT_MODEL_RE.test(lines[i])) { start = i; break; }
  }
  // 段边界：下一个列 0 键行 / "---" / EOF。
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z0-9_-]+\s*:/.test(lines[i]) || lines[i].startsWith("---")) { end = i; break; }
  }
  const block = start === -1 ? null : lines.slice(start, end);
  const wantSection = pr !== "" && mo !== "";
  if (!wantSection) {
    if (block === null) return false; // 已是无段状态
    // 删除整段；段前若留有分隔空行一并去掉，文件以单个换行结尾。
    let out = lines.slice(0, start).concat(lines.slice(end));
    if (out[start - 1] !== undefined && out[start - 1].trim() === "") {
      out = out.slice(0, start - 1).concat(out.slice(start));
    }
    while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
    out.push("");
    writeFileAtomic(botSettingsPath, out.join("\n"));
    return true;
  }
  // 期望键值（空值不写）。
  const wanted = {};
  if (pr !== "") wanted.provider = pr;
  if (mo !== "") wanted.model = mo;
  if (ef !== "") wanted.reasoningEffort = ef;
  // 缩进：沿用段内首行缩进（默认两空格）。
  let indent = "  ";
  if (block !== null) {
    for (const line of block) {
      const m = /^\s+/.exec(line);
      if (m) { indent = m[0]; break; }
    }
  }
  if (block === null) {
    // 整段追加到文件末尾（保证末尾换行）。
    const sep = raw.endsWith("\n") ? "" : "\n";
    const body = ["agent-default-model:"]
      .concat(Object.keys(wanted).map((key) => `${indent}${key}: ${yamlQuote(wanted[key])}`))
      .join("\n") + "\n";
    writeFileAtomic(botSettingsPath, raw + sep + "\n" + body);
    return true;
  }
  // 段已存在：重写三键值行，其余行原样保留；缺失键补写；空键值行删除。
  const seen = new Set();
  const out = [];
  for (const line of block) {
    const m = AGENT_DEFAULT_MODEL_KEY_RE.exec(line);
    if (m === null) { out.push(line); continue; }
    const key = m[2];
    seen.add(key);
    if (wanted[key] !== undefined) out.push(`${m[1]}${key}: ${yamlQuote(wanted[key])}`);
    // 键在 wanted 中缺失（空值）→ 删除该行。
  }
  for (const key of Object.keys(wanted)) {
    if (!seen.has(key)) out.push(`${indent}${key}: ${yamlQuote(wanted[key])}`);
  }
  const next = lines.slice(0, start).concat(out, lines.slice(end));
  writeFileAtomic(botSettingsPath, next.join("\n").replace(/\n*$/, "\n"));
  return true;
}

module.exports = {
  BUNDLES,
  PERMISSION_MODES,
  DEFAULT_PERMISSION,
  READ_ONLY_TOOLS,
  yamlQuote,
  buildPatchYaml,
  syncPiAiSection,
  upsertAgentDefaultModelSection,
  writeFileAtomic,
  DSH_DEFAULT_CONTEXT_WINDOW,
  DEEPSEEK_OFFICIAL_CONTEXT_WINDOW,
  explicitContextWindowFromSettings,
  resolveModelContextWindow
};
