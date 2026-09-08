/**
 * dsh-bots —— DeepSeek Harness 的「机器人模式」(Bot Mode) host 端插件。
 *
 * 【分层架构图与增长约束（冻结 2026-09-04，终版质量评审处置项③）】
 * 本文件是宿主集成层（cordis apply/HTTP/SSE/子进程/工具注册的接线面），内部以
 * #region 分为 19 个区域；领域逻辑一律下沉独立模块（review-*／evidence-*／
 * sentinel-*／knowledge／mail 等 23 个 lib 模块）。已抽取先例：
 *   - 评审只读/决策 API 区域 → lib/review-http-api.js（HTTP 三助手注入式）。
 *   - 邮局区域（含路径助手/会话合并）→ lib/mail-plane.js（2026-09-04 bot 自
 *     启动批连带抽取）。
 * 约束：新增功能优先落独立模块（如 review-intake/bot-autostart 先例），本文件
 * 只做接线；本文件行数上限冻结为 4,300 行（现约 4,025）——增长触限即触发新一轮区域抽取。
 * 后续候选区域（按体量）：自动回复与邮件协作 / 评审 job 受信链 / 评审主机泵。
 *
 * 概念：每个 bot 是一个独立的 DSH profile（`$DSH_HOME/profiles/<botId>/`），
 * 通过 `dsh --profile <botId> --port <port> --no-open` 启动为独立的 Web
 * 进程。本插件在 host 进程内提供：
 *
 *   - 注册表 CRUD：`$DSH_HOME/bots/bots.json`（`{id: bot}` 对象；原子写 =
 *     写临时文件再 rename）。
 *   - 子进程管理：start / stop / status。pid 持久化在注册表（runtime 字段
 *     `pid`/`startedAt`），同时内存 Map 持有 ChildProcess 引用以便优雅停止。
 *   - 邮局：`$DSH_HOME/bots/inbox/<botId>/messages.jsonl`（一行一个 JSON：
 *     {seq, from, text, at}）。
 *   - 回信：`$DSH_HOME/bots/outbox/<botId>/<timestamp>.jsonl`（一行一个 JSON：
 *     {id, text, from:"bot", timestamp}）。bot 实例内的自动回复 watcher 把回复
 *     写到这里；host 通过 GET /api/bots/:id/messages 读取并合并 inbox 得到完整会话。
 *   - 自动回复：同一份 index.js 也加载在 bot 自己的 DSH 实例里（profile 名 ==
 *     注册表 botId 时）。此时不重复做 host 的事，而是监听自己的 inbox 新消息，
 *     逐条调用本实例 DSH 的 session RPC 跑真实 agent 回合，回复写入 outbox；
 *     来自其他 bot 的任务邮件会自动回信到发件 bot 的 inbox（kind:
 *     "mail-response"，回信不再触发回路由，防 ping-pong）。双审建制（第六轮
 *     派发单 B②）新增 "mail-discuss" 讨论邮件：携带 discussRound 轮次（开环
 *     1），自动续环到机械上限 DISCUSSION_MAX_ROUNDS=2 后不再回路由——讨论环
 *     与 ping-pong 同一守卫防线，且有界。主 web 不启动 watcher。
 *   - 邮件到达通知：主 web 实例内的监视器（startMailNotifyMonitor）以 1s 轮询
 *     所有注册 bot 的 inbox/outbox 目录，新邮件经 SSE `mail` 事件推送（仅主
 *     web 启动；bot 实例是邮件写入方，不监听自己的写入）。语义：outbox 新增
 *     回复与 inbox 新增任务邮件（bot→bot）通知；kind="mail-response" 协议
 *     回信与 host 自身 POST /send 的写入（ownSends：botId→Set<seq>，精确
 *     seq 匹配抑制）静默；瞬态读失败不重置基线（恢复后只报增量，不整史重放）。
 *   - send_mail 工具：bot 实例内注册的 agent 工具（ctx.tools.register，手工
 *     构造原始形状、零依赖），把邮件投到任意已注册 bot 的 inbox——bot→bot
 *     通信的发信侧；收信侧即上面的 inbox watcher。
 *   - 团队知识库（v1 MVP，见 PROPOSAL-knowledge-base.md）：bot 实例注册
 *     knowledge_search / knowledge_register 两个工具，读写
 *     $DSH_HOME/bots/knowledge/（index.jsonl 共享索引 + reports/<id>.md
 *     报告全文 + REPORT_TEMPLATE.md 标准模板）。收编 8-22 领队↔研究员
 *     讨论收敛：「标准化报告模板 + 团队共享索引清单」为地基；明确不做
 *     全文检索/自动入库/自动打标签；KPI=复用率（开工先查索引 + 产出引用
 *     历史报告），保留旧版痕迹（supersedes → 旧条目标 updated）。
 *   - HTTP API：前缀路由 `/api/bots`（见下方路由表）。
 *
 * 数据根目录解析：`process.env.DSH_HOME || ~/.dsh`。
 * profile/workspace 脚手架：优先调用 `scripts/create-bot.cjs`（单一事实源，
 * 脚本由独立交付物提供）；脚本缺失（ENOENT）或 bot 的必填字符串字段
 * （name/role/modelProvider/model）为空时，回退到内置的等价初始化逻辑（等价于
 * dsh-app-boot 的 initProfile：package.json 清单 + cordis.patch.yml +
 * pnpm-workspace.yaml + workspace 目录）。每次 start 都会重新脚手架：脚本幂等，
 * 把注册表里最新的 role/model/permission 同步进 profile 的 patch（端口只影响
 * 启动命令参数，不写进 profile）。
 *
 * 关键决策：
 *   - 路由：只注册一个 `kind:"prefix", path:"/api/bots"`。webserver 的 match
 *     是「最长前缀优先」（dsh-host-webserver L194-203），`/api/bots`(12 字符)
 *     比 client-connection 占用的 `/api`(4 字符) 长，所以 `/api/bots*` 全部
 *     落到本插件，而 apiproxy 的 `/api/respond`、`/api/events.*` 等精确路径
 *     不受影响。
 *   - pid 管理：注册表持久化 pid/startedAt（host 重启后仍能 status/stop），
 *     内存 Map 只存本次生命周期 spawn 的 ChildProcess 引用；二者以
 *     `bot.pid === entry.pid` 对齐，exit 处理器只在匹配时清理。
 *   - 端口：从 3101 起取第一个未被注册表占用的端口；不主动 bind 探测（规格
 *     约定，端口被外部进程占用时启动会失败，用户用 PATCH 改端口）。
 *
 * 环境变量覆盖（可选，便于测试/部署）：
 *   - DSH_BOTS_DSH_BIN：dsh 可执行文件路径（默认 "dsh"，即 PATH 查找）。
 *   - DSH_BOTS_CREATE_BOT_SCRIPT：create-bot.cjs 路径（默认本文件 ../scripts/）。
 *
 * HTTP 路由表（前缀 /api/bots，全部 JSON；错误统一 {error: message}）：
 *   GET    /api/bots                 → {bots:[{...bot, online, preview}]}
 *   POST   /api/bots                 → 201 {bot}（body: name/role/modelProvider/
 *                                      model/permission/avatar/group）
 *   GET    /api/bots/:id             → {bot, online, inbox:[...]}（?limit=）
 *   PATCH  /api/bots/:id             → {bot[, note]}（合并更新；端口变更提示重启）
 *   DELETE /api/bots/:id             → {deleted:true, id}（lead 拒绝，400）
 *   POST   /api/bots/:id/start       → {online:true, url}
 *   POST   /api/bots/:id/stop        → {online:false}
 *   POST   /api/bots/:id/send        → {delivered:true, seq}（body: {from, text}）
 *   GET    /api/bots/:id/inbox       → {messages:[...]}（?limit=，默认 50）
 *   GET    /api/bots/:id/messages    → {messages:[{id,text,from,timestamp}]}
 *                                     inbox(user→bot) + outbox(bot→user) 按时间戳
 *                                     合并的完整会话历史（?since=<ISO|epochMs> 增量过滤）
 *   GET    /api/bots/_events         → SSE 实时事件流（text/event-stream）。
 *                                     事件：`bots`（注册表/状态变更，载荷 {}——
 *                                     客户端重拉 /api/bots 即可）；
 *                                     `mail`（新邮件到达，载荷 {events:
 *                                     [{botId,dir:"inbox"|"outbox",from,text,at,
 *                                     seq|id}]}，一帧一批）。注意下划线前缀：
 *                                     bot id 字符集不含 `_`，不会与 id="events"
 *                                     的 bot 详情（GET /api/bots/:id）冲突。
 *
 * 无第三方依赖，仅 node:fs / node:path / node:os / node:child_process。
 */

import { spawn } from "node:child_process";
import {
  DEFAULT_INBOX_LIMIT, appendMessage, appendOutbox,
  inboxDirFor, maxSeqInFile, messagesPathFor, nextSeq, outboxDirFor, parseJsonlLines,
  parseTimestamp, readAllInboxLines, readConversation, readConversationCached,
  readInbox, readLastMessage, readOutbox
} from "./mail-plane.js";
import { autoStartBots, selectBotsToAutoStart } from "./bot-autostart.js";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// 会话统计推导层（官方移植件，独立模块便于跟随上游同步，见 lib/stats.js）。
import { deriveStats, offlineStats } from "./stats.js";
// 评审数据平面（v3 计划 P1/P3）：单写锁/事件审计等纯函数核心。
import {
  appendAudit,
  artifactStatus,
  bodyFileFor,
  readManifest,
  submitReviewArtifact,
  verifyArtifactIntegrity,
  writeFileDurable,
  quarantineArtifact
} from "./review-store.js";
// 评审主机泵（R2-09 生产接线）：invocation 执行/一次性 reviewer session/输出落工件/流程推进。
import {
  expireStaleLeases,
  botHoldsInvocationLease,
  currentClaimedInvocation,
  heartbeatInvocation,
  invocationEventsFile,
  readInvocationManifest,
  readInvocationState,
  reviewInboxFor,
  runInvocation
} from "./review-orchestrator.js";
import { intakeTaskSpec } from "./review-intake.js";
import { readSnapshot, runProbe, scopedRead, scopedSearch } from "./review-evidence.js";
import { validateReviewEnvelope } from "./review-envelopes.js";
import {
  advanceFixFlow,
  advanceMainFlow,
  readFlow,
  registerFinal,
  registerInitial,
  registerRecheckFinal
} from "./review-flow.js";
import { bridgeDiscussionEnvelope } from "./review-discussion.js";
import { publishResult, readDecisions, resultBodyFile } from "./review-results.js";
import { createReviewHttpApi } from "./review-http-api.js";
import { readRoute } from "./review-relay.js";
import { botHoldsActiveLease, claimJob, createEngineeringJob, heartbeatJob, jobsDir, readJob, reportFix, validateFixReportSubmission } from "./review-jobs.js";
import { checkCapability, cleanupExpiredNonces, isCapabilityCurrent, issueCapability, nonceFileFor } from "./review-capability.js";
import { validateWorkspaceTriple } from "./review-enforcement.js";
// 团队调研知识底座（v1 MVP：标准化报告模板 + 共享索引清单，见
// lib/knowledge.js 与 PROPOSAL-knowledge-base.md）。
import {
  ensureKnowledgeBase,
  readIndex,
  registerReport,
  searchIndex,
  templateFileFor
} from "./knowledge.js";

// CJS 共享层：本文件与 scripts/create-bot.cjs 共用的纯函数（单一事实源，见 lib/shared.cjs）。
const requireCjs = createRequire(import.meta.url);
const {
  yamlQuote,
  PERMISSION_MODES,
  DEFAULT_PERMISSION,
  BUNDLES,
  buildPatchYaml: buildPatchYamlShared,
  syncPiAiSection,
  upsertAgentDefaultModelSection,
  writeFileAtomic,
  explicitContextWindowFromSettings,
  resolveModelContextWindow
} = requireCjs("./shared.cjs");

//#region 常量

/** Cordis 插件名（host 端身份标识）。 */
const name = "bots";
/** apply() 运行前必须已就绪的服务。 */
const inject = ["webServer"];

/** 本插件 lib/ 目录（用于解析 scripts/create-bot.cjs 的相对路径）。 */
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));
/** HTTP 路由前缀（ws.register 的 prefix 路由）。 */
const API_PREFIX = "/api/bots";

/** 端口分配起点（lead bot 固定占 3101）。 */
const BASE_PORT = 3101;
const LEAD_BOT_ID = "lead";
const LEAD_PORT = 3101;

/** stop() 的 SIGTERM 宽限期，超时后 SIGKILL 兜底。 */
const STOP_GRACE_MS = 5000;
/** SIGKILL 后等待进程真正消失的时间。 */
const KILL_SETTLE_MS = 1000;
/** 调用 create-bot.cjs 的超时（防脚本挂起阻塞 apply/start）。 */
const SCAFFOLD_TIMEOUT_MS = 60000;
/** preview 尾部读取的最大字节数。 */
const PREVIEW_TAIL_BYTES = 8192;
/** 子进程 stderr 滚动尾巴的最大字符数（排障用）。 */
const STDERR_TAIL_CHARS = 4096;
/** inbox watcher、原生 DSH turn 状态轮询间隔、邮件到达监视器轮询间隔。 */
const WATCH_POLL_MS = 1000;

/** 讨论邮件自动续环的机械轮次上限（双审建制派发单决策点②：讨论环 ≤2 轮，
 *  达上限后不再回路由——讨论有界与 ping-pong 守卫同一防线）。 */
const DISCUSSION_MAX_ROUNDS = 2;
/** 单次真实 agent turn 的最长等待时间。 */
const AGENT_TURN_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * F-RV-1：review runner 执行期 heartbeat 周期。与 lease 的关系（冻结，不得只放大
 * lease 常量而不证明该关系）：
 *   - lease 默认 60s（LEASE_DEFAULTS.leaseMs）；heartbeat 周期 20s < lease，
 *     保留调度与 I/O 余量（≥2 轮 1s 轮询）；
 *   - 每次 heartbeat 把 leaseUntil 推到 now+leaseMs；
 *   - runner 真实上限 = AGENT_TURN_TIMEOUT_MS（10min），由持续 heartbeat 维持 claim；
 *   - heartbeat 失败在下一轮询间隔（≤1s）内中止 runner，绝不携带失效 lease
 *     继续等待输出或提交结果。
 */
const REVIEW_HEARTBEAT_MS = 20_000;
/** 单次 session RPC（fetch）调用超时：超过按一次「无响应」计。 */
const RPC_TIMEOUT_MS = 30000;
/** runNativeAgentTurn 内 RPC 连续无响应上限：达到即放弃本轮（防轮询死等兜底超时）。 */
const RPC_MAX_TIMEOUTS = 3;
/** 会话自愈总开关环境变量名：值为 "0" 时关闭（默认开启）。 */
const SESSION_AUTO_HEAL_ENV = "DSH_BOTS_SESSION_AUTO_HEAL";
/** 会话自愈连续次数上限：达到后不再自愈，改为在错误回复后附加人工处理提示。 */
const SESSION_HEAL_MAX_COUNT = 3;

//#endregion

//#region 路径与基础工具

/** 数据根目录：DSH_HOME 环境变量优先，否则 ~/.dsh。 */
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  return join(homedir(), ".dsh");
}

function registryPath(dshHome) {
  return join(dshHome, "bots", "bots.json");
}


/** 插件约定的 bot workspace 目录（与 create-bot.cjs 的默认一致：<root>/bot-workspaces/<botId>）。 */
function workspaceDirFor(dshHome, botId) {
  return join(dshHome, "bot-workspaces", botId);
}

/**
 * 读 bot workspace 的持久 sessionId（.dsh-bot-session.json）；此前在 stats /
 * runNativeAgentTurn / healSessionAndRetry 三处各写了一份解析。缺失/损坏/
 * 无有效字段 → null。
 */
function readBotSessionId(dshHome, botId) {
  try {
    const state = JSON.parse(readFileSync(join(workspaceDirFor(dshHome, botId), ".dsh-bot-session.json"), "utf8"));
    if (typeof state?.sessionId === "string" && state.sessionId !== "") return state.sessionId;
  } catch {
    // 首次消息或损坏状态 → null
  }
  return null;
}

/**
 * 上下文窗口与当前模型对齐：stats 里 request/context 事件可能残留历史模型的
 * contextWindow（旧 provider/model、旧会话），而 Bot 模式需要展示当前选中模型
 * 的上下文容量。优先级（从高到低）：
 *   1. 当前模型在 settings.yaml（llm-pi-ai 段）的显式 contextWindow —— 始终
 *   2. 日志 request/context 的 provider/model 与当前模型一致 → 保留上报值
 *   3. DSH provider 默认（deepseek-official 1M，其余 llm-pi-ai provider 262144）
 * readOnly/离线等不影响。
 */
function alignContextWindowForBot(stats, bot, dshHome) {
  if (!stats || !bot) return stats;
  const cp = stats.contextPressure;
  if (!cp) return stats;
  let settingsText = null;
  try {
    settingsText = readFileSync(join(dshHome, "profiles", bot.id, "settings.yaml"), "utf8");
  } catch {
    settingsText = null;
  }
  // 1. 显式 settings 配置始终优先（含同模型日志旧值场景）
  const explicit = explicitContextWindowFromSettings(settingsText, bot.modelProvider, bot.model);
  if (explicit !== null) {
    return {
      ...stats,
      contextPressure: {
        ...cp,
        ...(cp.pressureTokens === undefined ? {} : { pressureTokens: cp.pressureTokens }),
        contextWindow: explicit
      }
    };
  }
  // 2. 日志已带与当前模型一致的窗口 → 直接用（真实上报值）
  if (cp.model === bot.model && cp.provider === bot.modelProvider && typeof cp.contextWindow === "number") {
    return stats;
  }
  // 3. 无显式、日志不匹配 → DSH provider 默认
  const resolved = resolveModelContextWindow(bot.modelProvider, bot.model, settingsText);
  return {
    ...stats,
    contextPressure: {
      ...cp,
      ...(cp.pressureTokens === undefined ? {} : { pressureTokens: cp.pressureTokens }),
      contextWindow: resolved
    }
  };
}

/**
 * 从注册表记录解析权限模式：优先使用新字段 `permission`，兼容旧字段
 * `readOnly`（true → read-only，否则 workspace-write）。
 */
function permissionOf(bot) {
  if (typeof bot?.permission === "string" && PERMISSION_MODES.includes(bot.permission)) {
    return bot.permission;
  }
  return bot?.readOnly === true ? "read-only" : DEFAULT_PERMISSION;
}

/** readOnly 布尔值由 permission 推导，保持旧接口/旧字段兼容。 */
function readOnlyOf(permission) {
  return permission === "read-only";
}

/** 把权限模式写入 bot 记录，同时同步旧 `readOnly` 字段，避免历史代码读到不一致状态。 */
function applyPermission(bot, permission) {
  bot.permission = permission;
  bot.readOnly = readOnlyOf(permission);
}

/**
 * 序列化输出一个 bot 对象：注册表里只存 `workspace`，输出时补 `workspacePath`
 * 别名（client 插件的说明卡读取 `bot.workspacePath ?? group ?? "—"`）。两者值
 * 相同；历史记录缺 workspace 时按 <root>/bot-workspaces/<id> 推导。同时补
 * `permission`/`readOnly` 兼容字段，让前端可以统一按官方权限模式展示。
 */
function serializeBot(dshHome, bot) {
  const workspace = bot.workspace ?? workspaceDirFor(dshHome, bot.id);
  const permission = permissionOf(bot);
  return { ...bot, permission, readOnly: readOnlyOf(permission), workspace, workspacePath: workspace };
}

/** DSH profile 目录（`dsh --profile <botId>` 的解析规则，见 dsh-app-boot resolveProfileDir）。 */
function profileDirFor(dshHome, botId) {
  return join(dshHome, "profiles", botId);
}

/** create-bot.cjs 脚本路径：环境变量覆盖 → 本文件同级 ../scripts/create-bot.cjs（.cjs：CommonJS 在 "type":"module" 包下的修复）。 */
function createBotScriptPath() {
  const override = process.env.DSH_BOTS_CREATE_BOT_SCRIPT;
  if (typeof override === "string" && override.length > 0) return override;
  return join(PLUGIN_DIR, "..", "scripts", "create-bot.cjs");
}

/** 取文本末尾 n 个字符（排障日志用）。 */
function tail(text, n) {
  return text.length > n ? `…${text.slice(-n)}` : text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 带 status 字段的错误：路由层据此映射 HTTP 状态码。 */
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

//#endregion

//#region 注册表

/**
 * 读取注册表。文件不存在或为空 → {}。
 * 文件存在但 JSON 损坏 / 顶层不是对象 → 抛错（apply 里会移开重建；
 * 请求路径里则映射为 500）。
 */
function readRegistry(dshHome) {
  const file = registryPath(dshHome);
  if (!existsSync(file)) return {};
  const raw = readFileSync(file, "utf8");
  if (raw.trim() === "") return {};
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("bots.json 顶层必须是对象（{id: bot}）");
  }
  return parsed;
}

/** 原子写注册表（writeFileAtomic 的 tmp+rename 模式，见 lib/shared.cjs）。 */
function writeRegistryAtomic(dshHome, registry) {
  writeFileAtomic(registryPath(dshHome), JSON.stringify(registry, null, 2) + "\n");
}

/** 按创建时间稳定排序（次要键 id）。 */
function sortedBots(registry) {
  return Object.values(registry).sort(
    (a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || String(a.id).localeCompare(String(b.id))
  );
}

/** 领队 bot 记录（注册表初始化时使用）。 */
function createLeadBot(dshHome, now) {
  return {
    id: LEAD_BOT_ID,
    name: "领队",
    role: "统筹者：不写代码，只负责拆解任务、分配给其他 bot、跟进进度、验收并汇总最终成果",
    modelProvider: "",
    model: "",
    permission: "read-only",
    readOnly: true,
    avatar: "",
    group: "leadership",
    port: LEAD_PORT,
    workspace: workspaceDirFor(dshHome, LEAD_BOT_ID),
    enabled: true,
    createdAt: now,
    lastActiveAt: now
  };
}

//#endregion

//#region 端口 / id / 进程存活

/** 从 BASE_PORT 起找第一个未被任何已注册 bot 占用的端口（不主动 bind 探测）。 */
function allocatePort(registry) {
  const used = new Set();
  for (const bot of Object.values(registry)) {
    if (Number.isInteger(bot.port) && bot.port > 0) used.add(bot.port);
  }
  let port = BASE_PORT;
  while (used.has(port)) port += 1;
  return port;
}

/** name → slug：小写、非 [a-z0-9] 连续段转连字符、去首尾连字符；无可转字符（如纯中文名）返回 ""。 */
function slugify(rawName) {
  return String(rawName ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 生成注册表内唯一的 id：slug 冲突时追加 -2、-3…；
 * slug 为空（纯中文/符号名）时回退 `bot-<Date.now().toString(36)>`，
 * 保证每个 bot 有唯一可读 id（极端同毫秒冲突由序号去重兜底）。
 */
function uniqueId(registry, rawName) {
  const slug = slugify(rawName);
  const base = slug === "" ? `bot-${Date.now().toString(36)}` : slug;
  if (registry[base] === undefined) return base;
  let n = 2;
  while (registry[`${base}-${n}`] !== undefined) n += 1;
  return `${base}-${n}`;
}

/** process.kill(pid, 0) 探测进程存活；EPERM 视为存活（存在但无权限）。 */
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/**
 * 校验 pid 确属该 bot 的 dsh 子进程，防 host 重启后 pid 被系统复用、stop() 误杀无关进程。
 * 仅 Linux 可判定（读 /proc/<pid>/cmdline，需同时含 "--profile" 与 botId）；
 * 非 Linux 或读取失败（进程刚好退出等）放行，交由后续 ESRCH 逻辑兜底。
 */
function pidMatchesBot(pid, botId) {
  if (process.platform !== "linux") return true;
  try {
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return cmdline.includes("--profile") && cmdline.includes(botId);
  } catch {
    return true;
  }
}

/** 依据注册表记录计算状态：online / pid / startedAt / stale（pid 记录但进程已不在）。 */
function computeStatus(bot) {
  const pid = bot.pid;
  if (!Number.isInteger(pid) || pid <= 0) {
    return { online: false, pid: undefined, startedAt: bot.startedAt, stale: false };
  }
  if (isProcessAlive(pid)) {
    return { online: true, pid, startedAt: bot.startedAt, stale: false };
  }
  return { online: false, pid, startedAt: bot.startedAt, stale: true };
}

function botUrl(bot) {
  return `http://127.0.0.1:${String(bot.port)}/`;
}

//#endregion

// #region 邮局 → 整体抽取至 lib/mail-plane.js（2026-09-04；行为不变，同名导入）

//#region 脚手架

/**
 * 生成 cordis.patch.yml（persona / 模型 pin / 权限裁剪 / 插件自加载 / settings
 * 重定向）。构建逻辑在 lib/shared.cjs（与 scripts/create-bot.cjs 共用的单一
 * 事实源）；这里只负责把注册表 bot 记录映射成共享函数的参数。
 */
function buildPatchYamlBuiltin(dshHome, bot) {
  return buildPatchYamlShared({
    botId: bot.id,
    role: bot.role,
    provider: bot.modelProvider,
    model: bot.model,
    reasoningEffort: bot.reasoningEffort,
    permission: permissionOf(bot),
    workspace: bot.workspace ?? workspaceDirFor(dshHome, bot.id),
    settingsPath: join(dshHome, "profiles", bot.id, "settings.yaml")
  });
}

/**
 * 内置的 profile 初始化（create-bot.cjs 缺失时的回退），输出与脚本等价：
 * package.json 清单 + cordis.patch.yml（persona/model pin/权限裁剪，每次
 * 都覆盖，与 create-bot.cjs 的 overwrite 语义一致，保证旧 lead profile 在下次
 * start 重脚手架时被修复）+ pnpm-workspace.yaml + workspace 目录。
 */
function scaffoldProfileBuiltin(dshHome, bot, ctx) {
  const profileDir = profileDirFor(dshHome, bot.id);
  mkdirSync(profileDir, { recursive: true });
  const manifestPath = join(profileDir, "package.json");
  writeFileSync(manifestPath, JSON.stringify({
    name: `dsh-profile-${bot.id}`,
    private: true,
    dependencies: {},
    // 与内置 web profile 模板一致：`dsh --profile <id> web` 需要 web-app bundle
    dsh: { profile: { bundles: BUNDLES } }
  }, null, 2) + "\n", "utf8");
  const patchPath = join(profileDir, "cordis.patch.yml");
  writeFileSync(patchPath, buildPatchYamlBuiltin(dshHome, bot), "utf8");
  // Ensure the per-bot settings file exists (idempotent; never overwrite user edits).
  // The patch's `- id: settings` entry above redirects the bot's settings doc here.
  const botSettingsPath = join(profileDir, "settings.yaml");
  if (!existsSync(botSettingsPath)) {
    writeFileSync(botSettingsPath, "agent-presets:\n  default: bot-nopersona\n", "utf8");
  }
  // 幂等同步全局 llm-pi-ai 段到 bot settings（bot 已有该段时跳过，绝不覆盖用户编辑）。
  if (syncPiAiSection(dshHome, bot.id)) {
    ctx?.logger?.info?.(`[dsh-bots] bot "${bot.id}" settings.yaml 已同步全局 llm-pi-ai 段`);
  }
  const workspaceYamlPath = join(profileDir, "pnpm-workspace.yaml");
  if (!existsSync(workspaceYamlPath)) {
    writeFileSync(workspaceYamlPath, "packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n", "utf8");
  }
  mkdirSync(bot.workspace ?? workspaceDirFor(dshHome, bot.id), { recursive: true });
}

/** 同步执行 node <script>，收集输出，超时强杀；退出码非 0 抛错。 */
function runScript(ctx, args, { dshHome, timeoutMs = SCAFFOLD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const script = createBotScriptPath();
    let child;
    try {
      child = spawn(process.execPath, [script, ...args], {
        env: { ...process.env, DSH_HOME: dshHome },
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      reject(error);
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGTERM"); } catch { /* 忽略 */ }
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* 忽略 */ }
      }, 1000).unref();
    }, timeoutMs);
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    child.once("error", (error) => finish(reject, error));
    child.once("close", (code, signal) => {
      if (timedOut) {
        finish(reject, new Error(`create-bot.cjs 执行超时（${timeoutMs}ms）`));
        return;
      }
      if (code === 0) finish(resolve, { stdout, stderr });
      else {
        finish(reject, new Error(
          `create-bot.cjs 退出码 ${String(code)}${signal ? `（signal ${signal}）` : ""}：${tail(stderr, 500)}`
        ));
      }
    });
  });
}

/**
 * 为 bot 创建 profile/workspace。
 * - create-bot.cjs 可用（存在 且 name/role/modelProvider/model 均非空）→ spawn
 *   node create-bot.cjs（--root/--id/--name/--role/--model-provider/--model/
 *   --permission/--port/--workspace），非零退出抛错（调用方：POST 创建 → 500；
 *   领队加载 → 仅告警）。
 * - 否则（脚本缺失 ENOENT，或必填字段有空值——领队没有模型 pin 即属此类）→
 *   告警并回退到内置等价脚手架，保证 bot 至少可启动。
 */
async function scaffoldBot(ctx, dshHome, bot) {
  const script = createBotScriptPath();
  const scriptUsable = existsSync(script)
    && bot.name !== ""
    && bot.role !== ""
    && bot.modelProvider !== ""
    && bot.model !== "";
  if (!scriptUsable) {
    if (existsSync(script)) {
      ctx.logger?.warn?.(
        `[dsh-bots] bot "${bot.id}" 的 name/role/modelProvider/model 存在空值，跳过 create-bot.cjs，使用内置脚手架`
      );
    } else {
      ctx.logger?.warn?.(`[dsh-bots] create-bot.cjs 不存在（${script}），使用内置脚手架初始化 "${bot.id}"`);
    }
    scaffoldProfileBuiltin(dshHome, bot, ctx);
    return;
  }
  const args = [
    "--root", dshHome,
    "--id", bot.id,
    "--name", bot.name,
    "--role", bot.role,
    "--model-provider", bot.modelProvider,
    "--model", bot.model,
    "--permission", permissionOf(bot),
    "--port", String(bot.port),
    "--workspace", workspaceDirFor(dshHome, bot.id)
  ];
  if (typeof bot.reasoningEffort === "string" && bot.reasoningEffort !== "") {
    args.push("--reasoning-effort", bot.reasoningEffort);
  }
  try {
    await runScript(ctx, args, { dshHome });
  } catch (error) {
    if (error.code === "ENOENT") {
      ctx.logger?.warn?.(`[dsh-bots] 无法运行 create-bot.cjs（ENOENT），使用内置脚手架初始化 "${bot.id}"`);
      scaffoldProfileBuiltin(dshHome, bot, ctx);
      return;
    }
    throw error;
  }
}

//#endregion

//#region 进程管理

/** 停止进程：SIGTERM → 宽限期 → SIGKILL 兜底。返回是否优雅退出（false = 动用了 SIGKILL）。 */
function terminateProcess(child, pid) {
  if (!isProcessAlive(pid)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const exited = (graceful) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(graceful);
    };
    const timer = setTimeout(() => {
      // 宽限期结束仍未退出：SIGKILL 兜底
      try {
        if (child !== undefined) child.kill("SIGKILL");
        else process.kill(pid, "SIGKILL");
      } catch {
        // 进程刚好消失
      }
      setTimeout(() => exited(false), KILL_SETTLE_MS).unref();
    }, STOP_GRACE_MS);
    if (child !== undefined) {
      child.once("exit", () => exited(true));
      try {
        child.kill("SIGTERM");
      } catch {
        exited(true);
      }
    } else {
      // 只有 pid（host 重启前遗留的进程）：轮询探测，无法挂 exit 监听
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        exited(true);
        return;
      }
      const deadline = Date.now() + STOP_GRACE_MS;
      const poll = () => {
        if (!isProcessAlive(pid)) {
          exited(true);
          return;
        }
        if (Date.now() >= deadline) return; // 交给 timer 的 SIGKILL
        setTimeout(poll, 100);
      };
      poll();
    }
  });
}

//#endregion

//#region BotsApi —— host 侧领域操作（HTTP handler 与 apply 共用）

class BotsApi {
  constructor(ctx, dshHome, sseHub) {
    this.ctx = ctx;
    this.dshHome = dshHome;
    /** 实时事件推送 hub（可选）：任一注册表/状态变更经 writeRegistry 广播 bots 事件。 */
    this.sseHub = sseHub;
    /** botId → Set<自发 send seq>（邮件到达通知的自身写入抑制：精确 seq 匹配，
     *  不用单值 max——同一 1s tick 内夹层外来邮件 seq 更小，max 会误吞，见 F-4）。 */
    this.ownSends = new Map();
    /** botId → {child, pid, startedAt, stderrTail}；只含本次 host 生命周期 spawn 的进程。 */
    this.processes = new Map();
  }

  readRegistry() {
    return readRegistry(this.dshHome);
  }

  writeRegistry(registry) {
    writeRegistryAtomic(this.dshHome, registry);
    // 实时推送：任何注册表/状态变更（start/stop/child-exit/reconcile/create/patch/remove）
    // 都经过这里——单一 choke point，客户端收到 bots 事件后重拉状态即可。
    try {
      this.sseHub?.broadcast?.("bots", {});
    } catch (error) {
      this.ctx.logger?.warn?.(
        `[dsh-bots] 实时事件广播失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** 清理注册表里进程已不在但仍记录的 pid（上次 host 运行遗留）。 */
  reconcileStalePids() {
    const registry = this.readRegistry();
    let dirty = false;
    for (const bot of Object.values(registry)) {
      if (Number.isInteger(bot.pid) && bot.pid > 0 && !isProcessAlive(bot.pid)) {
        this.ctx.logger?.warn?.(`[dsh-bots] 清理遗留 pid ${bot.pid}（bot "${bot.id}"）`);
        delete bot.pid;
        delete bot.startedAt;
        dirty = true;
      }
    }
    if (dirty) this.writeRegistry(registry);
  }

  /** GET /api/bots。 */
  list() {
    const registry = this.readRegistry();
    let dirty = false;
    const bots = sortedBots(registry).map((bot) => {
      const status = computeStatus(bot);
      if (status.stale) {
        delete bot.pid;
        delete bot.startedAt;
        dirty = true;
      }
      return {
        ...serializeBot(this.dshHome, bot),
        online: status.online,
        preview: readLastMessage(messagesPathFor(this.dshHome, bot.id))
      };
    });
    if (dirty) this.writeRegistry(registry);
    return { bots };
  }

  /** GET /api/bots/:id。 */
  get(id, limit) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (bot === undefined) throw httpError(404, `bot "${id}" 不存在`);
    let status = computeStatus(bot);
    if (status.stale) {
      delete bot.pid;
      delete bot.startedAt;
      this.writeRegistry(registry);
      status = computeStatus(bot);
    }
    return { bot: serializeBot(this.dshHome, bot), online: status.online, inbox: readInbox(this.dshHome, id, limit) };
  }

  /** POST /api/bots：slug id + 分配端口 + 脚手架 + 写注册表。 */
  async create(body) {
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    if (rawName === "") throw httpError(400, "name 不能为空");
    const registry = this.readRegistry();
    const id = uniqueId(registry, rawName);
    const now = new Date().toISOString();
    const permission = typeof body.permission === "string" && PERMISSION_MODES.includes(body.permission)
      ? body.permission
      : body.readOnly === true
        ? "read-only"
        : DEFAULT_PERMISSION;
    const bot = {
      id,
      name: rawName,
      role: typeof body.role === "string" ? body.role : "",
      modelProvider: typeof body.modelProvider === "string" ? body.modelProvider : "",
      model: typeof body.model === "string" ? body.model : "",
      reasoningEffort: typeof body.reasoningEffort === "string" ? body.reasoningEffort.trim() : "",
      permission,
      readOnly: readOnlyOf(permission),
      avatar: typeof body.avatar === "string" ? body.avatar : "",
      group: typeof body.group === "string" ? body.group : "",
      port: allocatePort(registry),
      workspace: workspaceDirFor(this.dshHome, id),
      // P6-1（R2-11）：sandbox 写边界显式登记，无隐式回退；三路径在 start 时校验。
      workspaceRoot: typeof body.workspaceRoot === "string" && body.workspaceRoot !== ""
        ? body.workspaceRoot
        : workspaceDirFor(this.dshHome, id),
      enabled: true,
      createdAt: now,
      lastActiveAt: now
    };
    // 脚手架失败 → 抛错（500），不写注册表（id 保留给重试，profile 初始化幂等）
    await scaffoldBot(this.ctx, this.dshHome, bot);
    // 第四源同步：把 agent-default-model 写进 bot 的 settings.yaml（运行中 bot
    // 以 settings 段为活源，见 shared.cjs upsertAgentDefaultModelSection 注释）。
    if (upsertAgentDefaultModelSection(this.dshHome, bot.id, {
      provider: bot.modelProvider,
      model: bot.model,
      reasoningEffort: bot.reasoningEffort
    })) {
      this.ctx.logger?.info?.(`[dsh-bots] bot "${bot.id}" settings.yaml 已同步 agent-default-model`);
    }
    const fresh = this.readRegistry();
    if (fresh[id] !== undefined) {
      // 罕见：await 间隙另一个请求占用了该 id
      throw httpError(409, `bot "${id}" 已存在，请重试`);
    }
    // 端口竞争防护：脚手架 await 间隙（最长 60s）里其他并发 create 可能占用了
    // 同端口；端口不写进 profile（只进启动命令），事后重分配无副作用
    if (Object.values(fresh).some((other) => other.port === bot.port)) {
      bot.port = allocatePort(fresh);
    }
    fresh[id] = bot;
    this.writeRegistry(fresh);
    return { bot: serializeBot(this.dshHome, bot) };
  }

  /**
   * PATCH /api/bots/:id：部分字段合并更新。
   * - 端口变更：既有行为不变（只更新注册表 + note 提示重启）。
   * - 模型/角色/权限 任一变化：先重脚手架（cordis.patch.yml + create-bot.cjs
   *   + llm-pi-ai 段同步），再写注册表；模型相关变化额外同步 settings.yaml
   *   的 agent-default-model 段（第四源，运行中 bot 的活源）；原在线则
   *   stop + spawn 自动重启让新配置生效（重启失败不算 patch 失败，记 warn
   *   并在 note 里提示手动启动）。
   * - 脚手架抛错 → 直接 throw：注册表未写，patch 整体回滚（HTTP 500）。
   */
  async patch(id, body) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (bot === undefined) throw httpError(404, `bot "${id}" 不存在`);
    const portChanged = body.port !== undefined && Number(body.port) !== bot.port;
    // 改动前快照：changed 判定与「原在线」判定都用改动前的值（patch 不改 pid，
    // computeStatus 前后一致，但按设计在改动前判定）。
    const before = {
      modelProvider: bot.modelProvider,
      model: bot.model,
      reasoningEffort: bot.reasoningEffort ?? "",
      role: bot.role,
      permission: permissionOf(bot)
    };
    const wasOnline = computeStatus(bot).online;
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") throw httpError(400, "name 不能为空字符串");
      bot.name = body.name.trim();
    }
    if (body.role !== undefined) {
      if (typeof body.role !== "string") throw httpError(400, "role 必须是字符串");
      bot.role = body.role;
    }
    if (body.modelProvider !== undefined) {
      if (typeof body.modelProvider !== "string") throw httpError(400, "modelProvider 必须是字符串");
      bot.modelProvider = body.modelProvider;
    }
    if (body.model !== undefined) {
      if (typeof body.model !== "string") throw httpError(400, "model 必须是字符串");
      bot.model = body.model;
    }
    if (body.reasoningEffort !== undefined) {
      if (typeof body.reasoningEffort !== "string") throw httpError(400, "reasoningEffort 必须是字符串");
      bot.reasoningEffort = body.reasoningEffort.trim();
    }
    if (body.permission !== undefined) {
      if (typeof body.permission !== "string" || !PERMISSION_MODES.includes(body.permission)) {
        throw httpError(400, "permission 必须是 read-only / workspace-write / danger-full-access");
      }
      applyPermission(bot, body.permission);
    }
    if (body.readOnly !== undefined) {
      if (typeof body.readOnly !== "boolean") throw httpError(400, "readOnly 必须是布尔值");
      // 兼容旧前端：只传 readOnly 时映射到 permission；如果同时传了 permission，以 permission 为准。
      if (body.permission === undefined) {
        applyPermission(bot, body.readOnly ? "read-only" : "workspace-write");
      }
    }
    if (body.avatar !== undefined) {
      if (typeof body.avatar !== "string") throw httpError(400, "avatar 必须是字符串");
      bot.avatar = body.avatar;
    }
    if (body.group !== undefined) {
      if (typeof body.group !== "string") throw httpError(400, "group 必须是字符串");
      bot.group = body.group;
    }
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") throw httpError(400, "enabled 必须是布尔值");
      bot.enabled = body.enabled;
    }
    if (body.port !== undefined) {
      const port = Number(body.port);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw httpError(400, "port 必须是 1024-65535 的整数");
      }
      const clash = Object.values(registry).find((other) => other.id !== id && other.port === port);
      if (clash !== undefined) throw httpError(400, `端口 ${port} 已被 bot "${clash.id}" 占用`);
      bot.port = port;
    }
    const modelChanged = bot.modelProvider !== before.modelProvider
      || bot.model !== before.model
      || (bot.reasoningEffort ?? "") !== before.reasoningEffort;
    const changed = modelChanged
      || bot.role !== before.role
      || bot.permission !== before.permission;
    if (changed) {
      // 模型/角色/权限已改：先重脚手架，失败即回滚（注册表未写）。
      await scaffoldBot(this.ctx, this.dshHome, bot);
    }
    if (modelChanged) {
      // 模型相关变更：第四源同步（settings.yaml agent-default-model），保证
      // 运行中的 bot 读到新选择（upsert 幂等；provider/model 为空时删除该段）。
      if (upsertAgentDefaultModelSection(this.dshHome, bot.id, {
        provider: bot.modelProvider,
        model: bot.model,
        reasoningEffort: bot.reasoningEffort
      })) {
        this.ctx.logger?.info?.(`[dsh-bots] bot "${bot.id}" settings.yaml 已同步 agent-default-model`);
      }
    }
    this.writeRegistry(registry);
    const result = { bot: serializeBot(this.dshHome, bot) };
    if (portChanged) result.note = "端口已更新到注册表；请重启该 bot 使新端口生效";
    if (changed && wasOnline) {
      // 原在线：重启进程让新模型/角色生效（stop 幂等；spawn 失败仅告警 + note）。
      let restarted = false;
      try {
        await this.stop(id);
        await this.spawnBot(bot);
        restarted = true;
      } catch (error) {
        this.ctx.logger?.warn?.(
          `[dsh-bots] bot "${id}" 更新后自动重启失败：${error instanceof Error ? error.message : String(error)}`
        );
        result.note = "模型/角色已更新；自动重启失败，请手动启动该 Bot";
      }
      if (restarted && portChanged) {
        // 端口随本次重启一并生效，去掉「请重启」提示避免矛盾。
        delete result.note;
      }
    }
    return result;
  }

  /** DELETE /api/bots/:id：先尽力 stop，再从注册表删除；保留 profile/workspace/邮局目录。 */
  async remove(id) {
    if (id === LEAD_BOT_ID) throw httpError(400, "领队 bot（lead）不可删除");
    const registry = this.readRegistry();
    if (registry[id] === undefined) throw httpError(404, `bot "${id}" 不存在`);
    try {
      await this.stop(id);
    } catch (error) {
      this.ctx.logger?.warn?.(
        `[dsh-bots] 删除 "${id}" 时停止进程失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
    const fresh = this.readRegistry();
    delete fresh[id];
    this.ownSends.delete(id); // 抑制账本随 bot 移除清理（同 id 重建不误用旧 seq）
    this.writeRegistry(fresh);
    return { deleted: true, id };
  }

  /** POST /api/bots/:id/start。 */
  async start(id) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (bot === undefined) throw httpError(404, `bot "${id}" 不存在`);
    if (bot.enabled === false) throw httpError(400, `bot "${id}" 已禁用（enabled=false），无法启动`);
    const status = computeStatus(bot);
    if (status.online) {
      return { online: true, url: botUrl(bot), pid: bot.pid, startedAt: bot.startedAt, alreadyRunning: true };
    }
    // P6-1（R2-11）：engineering 组 bot 启动前强制三路径校验（sessionWorkspace /
    // workspaceRoot / registry.workspace 一致且无隐式回退）；校验失败拒绝启动。
    if (bot.group === "engineering") {
      const triple = validateBotWorkspaceTriple(this.dshHome, bot);
      if (!triple.ok) {
        throw httpError(400, `engineering bot 三路径校验失败（P6-1，无隐式回退）：${triple.reason}`);
      }
    }
    await scaffoldBot(this.ctx, this.dshHome, bot);
    return this.spawnBot(bot);
  }

  /** 实际 spawn `dsh --profile <id> --port <port> --no-open`（不带 web 子命令：CLI 的 web 不接受父级 --profile，flags 直接透传）。 */
  spawnBot(bot) {
    return new Promise((resolve, reject) => {
      const bin = process.env.DSH_BOTS_DSH_BIN ?? "dsh";
      const url = botUrl(bot);
      let child;
      try {
        child = spawn(bin, ["--profile", bot.id, "--port", String(bot.port), "--no-open"], {
          env: { ...process.env, DSH_HOME: this.dshHome, DSH_WEB_URL: url },
          detached: false,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        reject(httpError(500, `启动 bot "${bot.id}" 失败：${error.message}`));
        return;
      }
      let stderrTailText = "";
      // 立即消费 stdout/stderr，防止管道缓冲阻塞子进程
      child.stdout?.on("data", () => { /* 丢弃 */ });
      child.stderr?.on("data", (chunk) => {
        stderrTailText = (stderrTailText + chunk).slice(-STDERR_TAIL_CHARS);
      });
      const entry = { child, pid: undefined, startedAt: Date.now(), stderrTail: () => stderrTailText };
      let spawned = false;

      child.once("error", (error) => {
        if (spawned) return; // spawn 成功后的 error 不接管（exit 处理器负责清理）
        const hint = error.code === "ENOENT"
          ? "（找不到 dsh 可执行文件；请确认 dsh 在 PATH 中，或设置 DSH_BOTS_DSH_BIN）"
          : "";
        reject(httpError(500, `启动 bot "${bot.id}" 失败：${error.message}${hint}`));
      });

      child.once("spawn", () => {
        spawned = true;
        entry.pid = child.pid;
        this.processes.set(bot.id, entry);
        try {
          const registry = this.readRegistry();
          const record = registry[bot.id];
          if (record !== undefined) {
            record.pid = child.pid;
            record.startedAt = entry.startedAt;
            record.lastActiveAt = new Date().toISOString();
            this.writeRegistry(registry);
          }
        } catch (error) {
          // 事件回调里同步抛错会变成 uncaughtException；注册表暂时不可读/写只降级为丢一次记录
          this.ctx.logger?.warn?.(
            `[dsh-bots] bot "${bot.id}" spawn 后写注册表失败：${error instanceof Error ? error.message : String(error)}`
          );
        }
        resolve({ online: true, url, pid: child.pid, startedAt: entry.startedAt });
      });

      child.once("exit", (code, signal) => {
        if (!spawned) return; // 从未成功 spawn（ENOENT 等），error 处理器已拒绝
        const current = this.processes.get(bot.id);
        if (current === entry) this.processes.delete(bot.id);
        try {
          const registry = this.readRegistry();
          const record = registry[bot.id];
          if (record !== undefined && record.pid === entry.pid) {
            delete record.pid;
            delete record.startedAt;
            this.writeRegistry(registry);
          }
        } catch (error) {
          // 同上：exit 回调里抛错会变成 uncaughtException
          this.ctx.logger?.warn?.(
            `[dsh-bots] bot "${bot.id}" 退出后清理注册表失败：${error instanceof Error ? error.message : String(error)}`
          );
        }
        if (code === 0) {
          this.ctx.logger?.info?.(`[dsh-bots] bot "${bot.id}" 正常退出`);
        } else {
          this.ctx.logger?.warn?.(
            `[dsh-bots] bot "${bot.id}" 退出（code=${String(code)} signal=${String(signal)}）：${tail(entry.stderrTail(), 400)}`
          );
        }
      });
    });
  }

  /** POST /api/bots/:id/stop。 */
  async stop(id) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (bot === undefined) throw httpError(404, `bot "${id}" 不存在`);
    if (Number.isInteger(bot.pid) && bot.pid > 0 && !pidMatchesBot(bot.pid, id)) {
      // pid 已被无关进程复用：按 stale 处理，绝不向其发送信号
      this.ctx.logger?.warn?.(`[dsh-bots] bot "${id}" 的 pid ${bot.pid} 已不指向 dsh 进程，按遗留清理`);
      delete bot.pid;
      delete bot.startedAt;
      this.writeRegistry(registry);
      return { online: false, stale: true };
    }
    const status = computeStatus(bot);
    if (status.stale) {
      delete bot.pid;
      delete bot.startedAt;
      this.writeRegistry(registry);
      return { online: false, stale: true };
    }
    if (!status.online) return { online: false };
    const entry = this.processes.get(id);
    const graceful = await terminateProcess(entry?.child, bot.pid);
    this.processes.delete(id);
    const fresh = this.readRegistry();
    const record = fresh[id];
    if (record !== undefined) {
      delete record.pid;
      delete record.startedAt;
      record.lastActiveAt = new Date().toISOString();
      this.writeRegistry(fresh);
    }
    return { online: false, ...(graceful ? {} : { killed: true }) };
  }

  /** POST /api/bots/:id/send。 */
  send(id, body) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (bot === undefined) throw httpError(404, `bot "${id}" 不存在`);
    const text = typeof body.text === "string" ? body.text : "";
    if (text.trim() === "") throw httpError(400, "text 不能为空");
    const from = typeof body.from === "string" && body.from.trim() !== "" ? body.from.trim() : "host";
    const message = appendMessage(this.dshHome, id, { from, text, at: body.at });
    // 邮件到达监视器据此抑制本次自发写入的通知（精确 seq，见 ownSends 注释）。
    let owns = this.ownSends.get(id);
    if (owns === undefined) {
      owns = new Set();
      this.ownSends.set(id, owns);
    }
    owns.add(message.seq);
    bot.lastActiveAt = new Date().toISOString();
    this.writeRegistry(registry);
    return { delivered: true, seq: message.seq };
  }

  /** GET /api/bots/:id/inbox。 */
  inbox(id, limit) {
    const registry = this.readRegistry();
    if (registry[id] === undefined) throw httpError(404, `bot "${id}" 不存在`);
    return { messages: readInbox(this.dshHome, id, limit) };
  }

  /** GET /api/bots/:id/messages：inbox + outbox 合并的完整会话历史（?since= 增量过滤）。 */
  messages(id, since) {
    const registry = this.readRegistry();
    if (registry[id] === undefined) throw httpError(404, `bot "${id}" 不存在`);
    return { messages: readConversationCached(this.dshHome, id, since) };
  }

  /**
   * GET /api/bots/:id/stats：从 bot 会话事件日志推导原生同源统计
   * （tokenUsage / sessionStats / contextPressure / contextBreakdown），
   * 供前端 StatsLine 与 ContextMeter 使用。在线走 RPC；离线回退直接读
   * ~/.dsh/sessions 下的落盘日志（多帧 zstd）。完全无会话 → { stats: null }。
   * 推导与读盘实现见 lib/stats.js。
   */
  async stats(id) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (bot === undefined) throw httpError(404, `bot "${id}" 不存在`);
    const sessionId = readBotSessionId(this.dshHome, id);
    if (sessionId === null) return { stats: null }; // 尚无会话
    let stats = null;
    if (computeStatus(bot).online) {
      try {
        const history = await dshRpc(bot.port, "session.history",
          { sessionId, maxMessages: 2000 }, { rpcPrefix: `dsh-bots-${id}-stats` });
        const events = Array.isArray(history?.events)
          ? history.events.map((entry) => entry?.event ?? entry)
          : [];
        stats = deriveStats(events);
      } catch (error) {
        // 在线但 RPC 失败（webserver 未就绪 / 进程僵住）：降级走离线读盘，而不是 500
        this.ctx.logger?.warn?.(
          `[dsh-bots] stats("${id}") 在线 RPC 失败，回退读盘：${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    if (stats === null) {
      // 离线：读落盘日志（stats.js 内含 mtime/size 结果缓存，前端轮询不重复解压）
      stats = offlineStats(this.dshHome, workspaceDirFor(this.dshHome, id), sessionId);
    }
    // 上下文窗口对齐：日志 request/context 可能来自历史模型（旧 provider/model 或旧值），
    // 而 Bot 模式要展示当前选中模型的上下文容量——按当前模型的 DSH 解析值覆盖，
    // 避免「会话旧事件 1M、实际模型 262K」这类错位。
    return { stats: alignContextWindowForBot(stats, bot, this.dshHome) };
  }
}

//#endregion

//#region HTTP 层

/** 统一 JSON 响应。 */
function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(text);
}

/** 收集请求体并 JSON.parse（try/catch → 400）；空 body → {}。 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 1_000_000) {
        reject(httpError(413, "request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.trim() === "") {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(httpError(400, `invalid JSON body: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
    req.on("error", (error) => {
      reject(httpError(400, `failed to read request body: ${error instanceof Error ? error.message : String(error)}`));
    });
  });
}

/** 解析 pathname 为段数组（decodeURIComponent，失败保留原文）。 */
function routeSegments(req) {
  let pathname;
  try {
    pathname = new URL(req.url ?? "/", "http://dsh.local").pathname;
  } catch {
    pathname = String(req.url ?? "/");
  }
  return pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
}

/** 解析 ?limit=（1..1000，非法回退默认值）。 */
function queryLimit(req) {
  try {
    const raw = new URL(req.url ?? "/", "http://dsh.local").searchParams.get("limit");
    if (raw === null) return DEFAULT_INBOX_LIMIT;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= 1000) return n;
  } catch {
    // 回退默认值
  }
  return DEFAULT_INBOX_LIMIT;
}

/** 解析 ?since=（ISO 字符串或 epoch 毫秒；缺省/非法 → null = 不过滤）。 */
function querySince(req) {
  try {
    const raw = new URL(req.url ?? "/", "http://dsh.local").searchParams.get("since");
    if (raw === null || raw.trim() === "") return null;
    return parseTimestamp(raw);
  } catch {
    return null;
  }
}

/**
 * 实时事件 hub：SSE 订阅者集合 + 命名事件广播。写失败的订阅者被移除（防坏连接
 * 拖垮后续广播）。subscribe 返回退订函数；close 清空所有连接。
 */
function createSseHub() {
  const subs = new Set();
  return {
    subscribe(res) {
      subs.add(res);
      return () => {
        subs.delete(res);
        try { res.end(); } catch (error) { /* 连接可能已断开 */ }
      };
    },
    broadcast(type, data) {
      const frame = `event: ${type}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
      for (const res of [...subs]) {
        try { res.write(frame); } catch (error) { subs.delete(res); }
      }
    },
    close() {
      for (const res of [...subs]) {
        try { res.end(); } catch (error) { /* 忽略 */ }
      }
      subs.clear();
    }
  };
}

/**
 * SSE 端点：把 req/res 接入 hub，输出 text/event-stream。订阅非空 hub 后，任何
 * mutation 广播都会推给连接；连接 close 时退订并停掉心跳。心跳 unref 防泄漏阻塞退出。
 */
function sseEndpoint(req, res, hub) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive"
  });
  res.write("retry: 3000\n\n");
  const unsubscribe = hub ? hub.subscribe(res) : () => {};
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch (error) { /* 忽略 */ }
  }, 15000);
  heartbeat.unref?.();
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

/** 路由分发：/api/bots[/:id[/:action]]，方法路由，错误统一 {error}；`_events` 例外（SSE）。 */
async function handleApi(req, res, api) {
  const segs = routeSegments(req);
  if (segs.length < 2 || segs[0] !== "api" || segs[1] !== "bots") {
    return json(res, 404, { error: "not found" });
  }
  // 跨站请求防护（CSRF）：浏览器发起的跨站请求携带 Sec-Fetch-Site: cross-site。
  // 本 API 仅限本机页面/工具调用；非浏览器客户端与老浏览器不带该头，不受影响（fail-open）。
  const fetchSite = req.headers["sec-fetch-site"];
  if (typeof fetchSite === "string"
    && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    return json(res, 403, { error: "cross-site request rejected" });
  }
  // SSE 实时事件流：独占协议（text/event-stream，长连接），不走 JSON 分发。
  // 路径用 `_events`（下划线不在 bot id 字符集内）：若用 `events` 会与 id="events"
  // 的 bot 详情（3 段 GET /api/bots/:id）冲突。
  if (segs.length === 3 && segs[2] === "_events") {
    if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
    return sseEndpoint(req, res, api.sseHub);
  }
  try {
    if (segs.length >= 4 && segs[2] === "review") {
      // 评审只读/决策 API（R2-10）：/api/bots/review/results[/:id][/body] + /api/bots/review/decisions
      return handleReviewApi(req, res, api);
    }
    if (segs.length === 2) {
      if (req.method === "GET") return json(res, 200, api.list());
      if (req.method === "POST") {
        const body = await readBody(req);
        return json(res, 201, await api.create(body));
      }
      return json(res, 405, { error: `method ${req.method} not allowed` });
    }
    if (segs.length === 3) {
      const id = segs[2];
      if (req.method === "GET") return json(res, 200, api.get(id, queryLimit(req)));
      if (req.method === "PATCH") {
        const body = await readBody(req);
        return json(res, 200, await api.patch(id, body));
      }
      if (req.method === "DELETE") return json(res, 200, await api.remove(id));
      return json(res, 405, { error: `method ${req.method} not allowed` });
    }
    if (segs.length === 4) {
      const id = segs[2];
      const action = segs[3];
      if (action === "inbox") {
        if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
        return json(res, 200, api.inbox(id, queryLimit(req)));
      }
      if (action === "messages") {
        if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
        return json(res, 200, api.messages(id, querySince(req)));
      }
      if (action === "stats") {
        if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
        return json(res, 200, await api.stats(id));
      }
      if (action === "start") {
        if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
        return json(res, 200, await api.start(id));
      }
      if (action === "stop") {
        if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
        return json(res, 200, await api.stop(id));
      }
      if (action === "send") {
        if (req.method !== "POST") return json(res, 405, { error: `method ${req.method} not allowed` });
        const body = await readBody(req);
        return json(res, 200, api.send(id, body));
      }
      return json(res, 404, { error: `unknown action "${action}"` });
    }
    return json(res, 404, { error: "not found" });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status >= 500) {
      api.ctx.logger?.error?.(`[dsh-bots] ${req.method} ${req.url} 失败：`, error);
    }
    return json(res, status, { error: message });
  }
}

//#endregion

//#region bot 实例身份检测与 RPC 工具

/**
 * 当前进程的 profile id，依次尝试：
 * 1. `ctx.baseUrl`（boot 时设为 profile 根目录 URL，见 dsh-app-boot boot()）的
 *    目录名 —— 即 `dsh --profile <name>` 的 <name>；
 * 2. 环境变量 DSH_BOTS_BOT_ID（测试/部署兜底，显式 opt-in）。
 * 都无法确定 → null。
 */
function currentProfileId(ctx) {
  if (typeof ctx?.baseUrl === "string" && ctx.baseUrl.startsWith("file:")) {
    try {
      return basename(fileURLToPath(new URL(ctx.baseUrl)));
    } catch {
      // 继续尝试下一个来源
    }
  }
  const forced = process.env.DSH_BOTS_BOT_ID;
  if (typeof forced === "string" && forced.trim() !== "") return forced.trim();
  return null;
}

/** 判断当前实例是否为某个已注册 bot 的实例：profile 名 == 注册表 botId。主 web（profile=web 等）返回 null。 */
function detectBotInstance(ctx, api) {
  const profileId = currentProfileId(ctx);
  if (profileId === null || profileId === "") return null;
  try {
    const registry = api.readRegistry();
    return registry[profileId] !== undefined ? profileId : null;
  } catch (error) {
    ctx.logger?.warn?.(
      `[dsh-bots] 检测 bot 实例失败（profile=${profileId}）：${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/** RPC 超时/网络类错误判定：AbortSignal.timeout 的 TimeoutError/AbortError，或 undici fetch 的 "fetch failed" TypeError。 */
function isRpcTimeoutError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return true;
  return error instanceof TypeError && typeof error.message === "string" && /fetch failed/i.test(error.message);
}

/**
 * 单发 client-request RPC：统一信封与结果解包（此前 botRpc 与
 * runNativeAgentTurn 的 rpc 闭包各写一份）。网络/超时错误原样抛出，
 * 连续超时计数等重试语义由调用方叠加。
 */
async function dshRpc(port, method, payload, { rpcPrefix = "dsh-bots", timeoutMs = RPC_TIMEOUT_MS } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      type: "client-request",
      rpcId: `${rpcPrefix}-${Date.now().toString(36)}`,
      method,
      payload
    })
  });
  if (!response.ok) throw new Error(`DSH ${method} HTTP ${response.status}`);
  const body = await response.json();
  if (!body?.result?.ok) throw new Error(body?.result?.error?.message ?? `DSH ${method} failed`);
  return body.result.value;
}

//#endregion

//#region agent 回合（runNativeAgentTurn）

/**
 * 调用当前 bot 实例自己的 DSH RPC，创建一个持久 session 并提交真实 prompt。
 * session id 保存到 bot workspace，重启实例后继续使用同一段上下文。
 */
async function runNativeAgentTurn(ctx, dshHome, botId, text) {
  const workspace = workspaceDirFor(dshHome, botId);
  const statePath = join(workspace, ".dsh-bot-session.json");
  mkdirSync(workspace, { recursive: true });
  const sessionId = readBotSessionId(dshHome, botId); // null → 首次消息或损坏状态会创建新 session

  const bot = readRegistry(dshHome)[botId];
  if (!Number.isInteger(bot?.port)) throw new Error(`bot "${botId}" has no valid port`);
  // RPC 连续无响应计数：对 session.create/selectModel/prompt/history 统一生效；
  // 轮询循环里 history 连续超时达到上限会提前退出，而不是死等 AGENT_TURN_TIMEOUT_MS。
  let consecutiveRpcTimeouts = 0;
  const rpc = async (method, payload) => {
    let value;
    try {
      value = await dshRpc(bot.port, method, payload, { rpcPrefix: `dsh-bots-${botId}` });
    } catch (error) {
      // 超时/网络类错误（bot 进程挂了、端口无响应等）→ 连续计数，达到上限抛错；
      // 未达上限的单次超时也原样抛出，交给现有「错误回复写 outbox、下次重试」路径。
      // 其余错误（NO_ADAPTER、HTTP 非 2xx、result.ok=false 等）不计数，立即原样抛出。
      if (isRpcTimeoutError(error)) {
        consecutiveRpcTimeouts += 1;
        if (consecutiveRpcTimeouts >= RPC_MAX_TIMEOUTS) {
          throw new Error(`bot RPC 无响应（连续 ${RPC_MAX_TIMEOUTS} 次超时）`);
        }
      }
      throw error;
    }
    consecutiveRpcTimeouts = 0; // 一次成功 RPC（含正常结果）清零连续计数
    return value;
  };

  let session = sessionId;
  if (session === null) {
    const created = await rpc("session.create", { cwd: workspace });
    session = created.sessionId;
    writeFileAtomic(statePath, JSON.stringify({ sessionId: session }, null, 2) + "\n");
  }
  if (typeof bot.modelProvider === "string" && bot.modelProvider !== "" &&
      typeof bot.model === "string" && bot.model !== "") {
    await rpc("session.selectModel", {
      sessionId: session,
      provider: bot.modelProvider,
      model: bot.model
    });
  }
  const before = await rpc("session.history", { sessionId: session, maxMessages: 100 });
  const beforeEvents = Array.isArray(before?.events) ? before.events.map((entry) => entry?.event ?? entry) : [];
  const baselineTurn = beforeEvents.reduce((max, event) =>
    event?.type === "turn/end" && Number.isInteger(event?.data?.turn) ? Math.max(max, event.data.turn) : max
  , 0);
  await rpc("session.prompt", {
    sessionId: session,
    mode: "queue",
    content: [{ type: "text", text: String(text) }]
  });

  const started = Date.now();
  while (Date.now() - started < AGENT_TURN_TIMEOUT_MS) {
    await sleep(WATCH_POLL_MS);
    const history = await rpc("session.history", { sessionId: session, maxMessages: 100 });
    const events = Array.isArray(history?.events) ? history.events.map((entry) => entry?.event ?? entry) : [];
    const ended = [...events].reverse().find((event) =>
      event?.type === "turn/end" && Number.isInteger(event?.data?.turn) && event.data.turn > baselineTurn
    );
    const assistant = ended === undefined ? undefined : [...events].reverse().find((event) =>
      event?.type === "assistant/message" && event?.data?.turn === ended.data.turn &&
      Array.isArray(event?.data?.message?.content)
    );
    if (assistant !== undefined) {
      return assistant.data.message.content
        .filter((part) => part?.type === "text")
        .map((part) => part.text)
        .join("\n");
    }
  }
  throw new Error(`bot agent turn timed out after ${AGENT_TURN_TIMEOUT_MS}ms`);
}

//#endregion

//#region 会话自愈

/** 会话自愈计数文件路径：<workspace>/.dsh-bot-heal.json（与 .dsh-bot-session.json 同目录）。 */
function healCountPathFor(dshHome, botId) {
  return join(workspaceDirFor(dshHome, botId), ".dsh-bot-heal.json");
}

/** 读取自愈计数（{count, lastAt}）；文件缺失/损坏 → {count: 0, lastAt: null}。 */
function readHealCount(dshHome, botId) {
  const file = healCountPathFor(dshHome, botId);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return {
      count: Number.isInteger(parsed?.count) ? parsed.count : 0,
      lastAt: typeof parsed?.lastAt === "string" ? parsed.lastAt : null
    };
  } catch {
    return { count: 0, lastAt: null };
  }
}

/** 原子写自愈计数（writeFileAtomic 的 tmp+rename 模式）。 */
function writeHealCount(dshHome, botId, count, lastAt) {
  writeFileAtomic(healCountPathFor(dshHome, botId), JSON.stringify({ count, lastAt }, null, 2) + "\n");
}

/** 会话健康：清零自愈计数（count 已为 0 时不重复写盘）。 */
function resetHealCount(dshHome, botId) {
  const current = readHealCount(dshHome, botId);
  if (current.count === 0) return;
  writeHealCount(dshHome, botId, 0, current.lastAt ?? new Date().toISOString());
}

/** 自愈计数 +1 并持久化（成功自愈与重试失败都消耗上限，防反复自愈）。 */
function bumpHealCount(dshHome, botId) {
  const current = readHealCount(dshHome, botId);
  writeHealCount(dshHome, botId, current.count + 1, new Date().toISOString());
}

/** 会话自愈总开关：默认开启；环境变量 DSH_BOTS_SESSION_AUTO_HEAL="0" 时关闭。 */
function sessionAutoHealEnabled() {
  return process.env[SESSION_AUTO_HEAL_ENV] !== "0";
}

/** 会话损坏类错误判定：resume failed / corrupt session log / session log 等会话日志相关错误。 */
function isSessionCorruptError(error) {
  return error instanceof Error && typeof error.message === "string" &&
    /resume failed|corrupt session log|session log/i.test(error.message);
}

/**
 * 在 ~/.dsh/sessions 下定位该 bot 作用域会话目录：
 * 1. 按 sessionId 精确定位 ~/.dsh/sessions/<sessionId>；
 * 2. 否则扫描：目录名含 <botId>（作用域目录形如 --home-...-bot-workspaces-<botId>--），
 *    且目录名或目录内条目名/文件内容含该 sessionId。
 * 找不到 → null。
 */
function findSessionDirFor(dshHome, botId, sessionId) {
  const sessionsRoot = join(dshHome, "sessions");
  if (!existsSync(sessionsRoot)) return null;
  if (typeof sessionId === "string" && sessionId !== "") {
    const exact = join(sessionsRoot, sessionId);
    if (existsSync(exact)) return exact;
  }
  let entries;
  try {
    entries = readdirSync(sessionsRoot);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const candidate = join(sessionsRoot, entry);
    try {
      if (!statSync(candidate).isDirectory()) continue;
    } catch {
      continue;
    }
    if (!entry.includes(botId)) continue;
    if (typeof sessionId === "string" && sessionId !== "" && entry.includes(sessionId)) return candidate;
    if (dirContainsSessionId(candidate, sessionId)) return candidate;
  }
  return null;
}

/** 目录内是否含 sessionId：条目名匹配，或文件头 8KB 内容匹配（避免读大日志）。 */
function dirContainsSessionId(dir, sessionId) {
  if (typeof sessionId !== "string" || sessionId === "") return false;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.includes(sessionId)) return true;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let fd;
    try {
      if (!statSync(full).isFile()) continue;
      fd = openSync(full, "r");
      const buf = Buffer.alloc(8192);
      const n = readSync(fd, buf, 0, buf.length, 0);
      if (buf.subarray(0, n).toString("utf8").includes(sessionId)) return true;
    } catch {
      // 单个文件读取失败忽略
    } finally {
      if (fd !== undefined) {
        try { closeSync(fd); } catch { /* 忽略 */ }
      }
    }
  }
  return false;
}

/**
 * 会话自愈：归档损坏会话 + 用同一 text 重试一次。
 * - 归档：~/.dsh/sessions 下该 bot 作用域目录 + <workspace>/.dsh-bot-session.json
 *   mv 到 ~/.dsh/session-backups/<sessionId>-corrupt-<时间戳>/（mkdir -p 后 mv，只归档不删除）。
 * - 归档任一步失败（fs 异常）→ {healed:false, error}，不重试。
 * - 归档成功 → logger.warn 记录归档路径；状态文件缺失 → 重试时自动 session.create 新会话。
 * - 重试成功 → {healed:true, text: 带「已自动归档并重置」前置说明的回复文本}，count+1。
 * - 重试失败 → {healed:false, error}（不吞错），count+1 消耗上限。
 */
async function healSessionAndRetry(ctx, dshHome, botId, text, message) {
  const workspace = workspaceDirFor(dshHome, botId);
  const statePath = join(workspace, ".dsh-bot-session.json");
  // 状态文件缺失/损坏（null）时仍尝试按 botId 归档会话目录
  const sessionId = readBotSessionId(dshHome, botId);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(dshHome, "session-backups", `${sessionId ?? "session"}-corrupt-${stamp}`);
  try {
    mkdirSync(backupDir, { recursive: true });
    const sessionDir = findSessionDirFor(dshHome, botId, sessionId);
    if (sessionDir !== null) renameSync(sessionDir, join(backupDir, basename(sessionDir)));
    if (existsSync(statePath)) renameSync(statePath, join(backupDir, ".dsh-bot-session.json"));
  } catch (error) {
    // 归档任一步失败：不重试，原样交给错误回复
    ctx.logger?.warn?.(
      `[dsh-bots] bot "${botId}" 会话自愈归档失败（seq=${String(message?.seq)}）：${error instanceof Error ? error.message : String(error)}`
    );
    return { healed: false, error };
  }
  ctx.logger?.warn?.(
    `[dsh-bots] bot "${botId}" 检测到会话损坏，已归档并重置（seq=${String(message?.seq)}）：${backupDir}`
  );
  try {
    // 状态文件已移走 → sessionId 为 null → runNativeAgentTurn 自动 session.create 新会话
    const retried = await runNativeAgentTurn(ctx, dshHome, botId, text);
    bumpHealCount(dshHome, botId);
    return { healed: true, text: `（检测到会话损坏，已自动归档并重置，本回复来自新会话）\n\n${retried}` };
  } catch (error) {
    bumpHealCount(dshHome, botId);
    ctx.logger?.warn?.(
      `[dsh-bots] bot "${botId}" 会话自愈重试失败（seq=${String(message?.seq)}）：${error instanceof Error ? error.message : String(error)}`
    );
    return { healed: false, error };
  }
}

//#endregion

//#region 自动回复与邮件协作（bot 实例侧）

/**
 * 把回复投回发件 bot 的 inbox。按触发消息的 kind 分流（双审建制 B② 核实：
 * 原守卫只识别 kind="mail-response"，讨论续环无计量/无上限——现补独立通道）：
 *   - kind="mail-response"：不再回路由（防 ping-pong，历史行为不变）；
 *   - kind="mail-discuss"：讨论续环——回复以 kind="mail-discuss" 投回发件
 *     bot，轮次 discussRound = 触发轮次 + 1；触发轮次 ≥ DISCUSSION_MAX_ROUNDS
 *     时不再回路由（讨论环机械有界），回复仅留在本 bot outbox 供人读；
 *   - 其余（普通任务邮件）：回信以 kind="mail-response" 投回（历史行为不变）。
 * 发件人未注册静默跳过，投递失败只告警——不影响已写入的 outbox 回复。
 */
function routeReplyToSender(ctx, dshHome, botId, message, fromBot, replyText) {
  if (!fromBot || message.kind === "mail-response") return;
  if (message.kind === "mail-discuss") {
    const round = Number.isInteger(message.discussRound) ? message.discussRound : 1;
    if (round >= DISCUSSION_MAX_ROUNDS) {
      ctx.logger?.info?.(
        `[dsh-bots] bot "${botId}" 讨论环已达机械上限（R${String(round)}/${DISCUSSION_MAX_ROUNDS}），本回复不再续环（回复仍在 outbox）`
      );
      return;
    }
    try {
      if (readRegistry(dshHome)[message.from] === undefined) return;
      const returned = appendMessage(dshHome, message.from, {
        from: botId, text: replyText, kind: "mail-discuss", discussRound: round + 1, replyTo: message.seq
      });
      ctx.logger?.info?.(
        `[dsh-bots] bot "${botId}" 讨论续环 → "${message.from}"（R${String(round + 1)}，seq=${String(returned.seq)}）`
      );
    } catch (error) {
      ctx.logger?.warn?.(
        `[dsh-bots] bot "${botId}" 讨论续环投递 "${message.from}" 失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
    return;
  }
  try {
    if (readRegistry(dshHome)[message.from] === undefined) return;
    const returned = appendMessage(dshHome, message.from, { from: botId, text: replyText, kind: "mail-response", replyTo: message.seq });
    ctx.logger?.info?.(
      `[dsh-bots] bot "${botId}" 自动回信 → "${message.from}"（seq=${String(returned.seq)}）`
    );
  } catch (error) {
    ctx.logger?.warn?.(
      `[dsh-bots] bot "${botId}" 自动回信给 "${message.from}" 失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 评审流程件误投识别（P3-1 机械兜底）：普通邮局消息若携带评审流程件标记
 * （review-artifact / review-invocation / review-flow / discussion 信封头），
 * 一律判定为误投/冒充 → fail closed。识别不依赖正文语义，只看机械标记。
 */
function isReviewFlowMisdelivery(message) {
  const kind = typeof message.kind === "string" ? message.kind : "";
  // 明确 kind 标记（独立 review 管道不用 kind 表示，若出现即误投）
  const KIND_MARKERS = ["review-artifact", "review-invocation", "review-flow"];
  if (KIND_MARKERS.includes(kind)) {
    return { flow: true, marker: `kind=${kind}` };
  }
  // 正文信封头标记（评审管道各环节的固定前缀）
  const text = typeof message.text === "string" ? message.text : "";
  const TEXT_MARKERS = [
    "[review-artifact]", "[review-invocation]", "[review-flow]",
    "[discussion R1", "[discussion R2", "[final from",
    "x-dsh-review-flow:"
  ];
  for (const m of TEXT_MARKERS) {
    if (text.includes(m)) return { flow: true, marker: `text:${m}` };
  }
  return { flow: false, marker: null };
}

/**
 * 处理一条新到的 inbox 消息：真实调用 bot agent 并写入 outbox；
 * 回路由分流见 routeReplyToSender（kind="mail-discuss" 讨论续环有界、
 * "mail-response" 不再回路由防 ping-pong、普通任务邮件自动回信）。
 * 回信类消息不再自动回路由；后续往来由任一方显式调用 send_mail 发起
 * （讨论续环除外——mail-discuss 在轮次上限内自动续环，见 routeReplyToSender）。
 */
async function handleIncoming(ctx, dshHome, botId, message) {
  if (message.from === botId) return;
  // 评审流程件误投普通邮局 → fail closed：任何 runNativeAgentTurn 之前拒绝，
  // 零副作用（不写 outbox、不生成 mail-response、不回路由），只落审计。
  // 正常评审流程绝不写入普通 messages.jsonl（独立 review inbox，见
  // review-orchestrator.js）；此守卫是防误投/防冒充的机械兜底（P3-1）。
  const flowCheck = isReviewFlowMisdelivery(message);
  if (flowCheck.flow) {
    try {
      appendAudit(dshHome, {
        type: "review-misdelivery-rejected",
        botId, seq: message.seq ?? null, from: message.from ?? null,
        marker: flowCheck.marker, reason: "评审流程件误投普通邮局（fail closed）"
      });
    } catch {
      // 审计失败不阻断拒绝本身
    }
    ctx.logger?.warn?.(
      `[dsh-bots] 拒绝评审流程件误投普通邮局（bot "${botId}" seq=${String(message.seq)} marker=${flowCheck.marker}）：不触发 agent 回合`
    );
    return;
  }
  const fromBot = typeof message.from === "string" && message.from !== "" && message.from !== "user";
  // bot→bot 邮件带寄件人上下文前缀，让 agent 知道该面向谁处理/答复；
  // 讨论邮件（mail-discuss）额外带机械轮次（R{n}），让 agent 感知环进度。
  const promptText = fromBot
    ? (message.kind === "mail-discuss"
      ? `[mail discuss from bot "${message.from}" (R${Number.isInteger(message.discussRound) ? message.discussRound : 1})]\n\n${message.text}`
      : (message.kind === "mail-response"
        ? `[mail reply from bot "${message.from}"]\n\n${message.text}`
        : `[mail from bot "${message.from}"]\n\n${message.text}`))
    : message.text;
  try {
    const text = await runNativeAgentTurn(ctx, dshHome, botId, promptText);
    // 成功回合未触发自愈 → 会话健康，自愈计数清零
    resetHealCount(dshHome, botId);
    const reply = appendOutbox(dshHome, botId, text || "（bot 未返回文本）");
    ctx.logger?.info?.(
      `[dsh-bots] bot "${botId}" 完成真实回复（seq=${String(message.seq)}）：${tail(reply.text, 80)}`
    );
    routeReplyToSender(ctx, dshHome, botId, message, fromBot, reply.text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const corrupt = isSessionCorruptError(error);
    const healEnabled = sessionAutoHealEnabled();
    // 自愈上限：仅会话损坏类错误且开关开启时计数生效
    const healCapReached = corrupt && healEnabled && readHealCount(dshHome, botId).count >= SESSION_HEAL_MAX_COUNT;
    if (corrupt && healEnabled && !healCapReached) {
      // 触发自愈：归档损坏会话 + 用同一 promptText（含寄件人前缀）重试一次
      const healed = await healSessionAndRetry(ctx, dshHome, botId, promptText, message);
      if (healed.healed) {
        // 重试成功：回复带「已自动归档并重置」前置说明；与正常成功路径同样回路由
        const reply = appendOutbox(dshHome, botId, healed.text || "（bot 未返回文本）");
        ctx.logger?.info?.(
          `[dsh-bots] bot "${botId}" 会话自愈成功（seq=${String(message.seq)}）：${tail(reply.text, 80)}`
        );
        routeReplyToSender(ctx, dshHome, botId, message, fromBot, reply.text);
      } else {
        // 归档失败或重试失败：写 [bot error] 原文（不吞错）；计数已由自愈流程 +1
        appendOutbox(dshHome, botId, `[bot error] ${detail}`);
        ctx.logger?.warn?.(
          `[dsh-bots] bot "${botId}" 会话自愈失败（seq=${String(message.seq)}）：${detail}`
        );
      }
    } else {
      // 自愈未触发：原样错误回复；达到上限时在原文后附加人工处理提示（追加而非替换）
      const outboxText = healCapReached
        ? `[bot error] ${detail}\n（自愈已达上限，需人工处理）`
        : `[bot error] ${detail}`;
      appendOutbox(dshHome, botId, outboxText);
      ctx.logger?.warn?.(`[dsh-bots] bot "${botId}" 回复失败（seq=${String(message.seq)}）：${detail}`);
    }
  }
}

/**
 * 给 bot 实例注册 send_mail 工具：把一封邮件投递到另一个已注册 bot 的
 * inbox（from = 本 bot id），由对方实例的 inbox watcher 触发真实 agent
 * 回合并自动回信（见 handleIncoming 的回路由与 ping-pong 防护）。
 *
 * 工具对象按 ctx.tools.register 接受的原始形状手工构造（name/description/
 * parameters(JSON Schema)/output{schema,render}/execute）——defineTool 只是
 * 该形状之上的参数校验编译器，手工构造使本插件保持零依赖。schema 只用
 * dsh-tools 强制子集支持的关键字（type/properties/required/items/enum/
 * additionalProperties/description）。
 *
 * 用 ctx.get("tools") 响应式获取服务（不进静态 inject）：官方 dsh-tools
 * 自己也是这个习惯（requireCodeRuntime 注释），且宿主 web 实例即使没有
 * agent 工具服务也不影响本插件其余功能加载。返回 register 的 disposer。
 */
function registerBotMailTool(ctx, api, botId) {
  const tools = ctx.get("tools");
  if (tools === undefined) return; // 无 agent 工具服务（如纯 web 宿主）→ 不注册
  const dshHome = api.dshHome;
  /** 当前可投递的收件人名单（排除自己；每次调用现读注册表，天然新鲜）。 */
  const roster = () => {
    const registry = api.readRegistry();
    return sortedBots(registry)
      .filter((bot) => bot.id !== botId)
      .map((bot) => `${bot.id}（${bot.name}）：${String(bot.role ?? "").slice(0, 120)}`);
  };
  return tools.register({
    name: "send_mail",
    description: "给团队里另一个 bot 发一封邮件（任务、问题或资料）。对方会基于它自己的角色与模型处理这封邮件，并自动回信给你；回信会作为新消息在稍后到达并触发你的下一个回合，所以发完不必等待，可以继续本轮的其他工作或直接结束回合。收件人只能看到 text 正文，看不到你的会话上下文，请把任务、必要背景和期望产出写完整。要查看可用收件人，传 to: \"\" 即可（只列名单不发送）。",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "收件 bot 的 id 或名字（见可用名单）；传空字符串则不发送、只返回全部可用收件人"
        },
        text: {
          type: "string",
          description: "邮件正文：完整的任务说明、必要上下文与期望产出"
        },
        kind: {
          type: "string",
          enum: ["mail-discuss"],
          description: "可选。双审讨论邮件专用标记：填 \"mail-discuss\" 表示这是评审讨论的开环一轮（机械轮次自 1 起、续环上限 2，达上限自动不再续环，见现行规程 R-2026-009（扩大工程修订版））。普通任务/回复不要填此字段。"
        }
      },
      required: ["to", "text"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["delivered", "rejected"] },
          to: { type: "string" },
          seq: { type: "integer" },
          note: { type: "string" },
          available_bots: { type: "array", items: { type: "string" } }
        },
        required: ["status"],
        additionalProperties: false
      },
      render: (_args, value) => [{
        type: "text",
        text: value.status === "delivered"
          ? `mail delivered to ${String(value.to)} (seq ${String(value.seq)})`
          : `mail not sent: ${String(value.note ?? "unknown reason")}`
      }]
    },
    async execute(args) {
      // 手工构造不走 defineTool 的参数校验，这里自行防御式校验
      const to = typeof args.to === "string" ? args.to.trim() : "";
      const text = typeof args.text === "string" ? args.text.trim() : "";
      // kind 仅接受 "mail-discuss"（讨论开环）；其余值一律忽略（防御式校验，
      // 绝不透传 "mail-response"——协议不变量 replyTo ⟺ kind 由本工具守护）
      const kind = args.kind === "mail-discuss" ? "mail-discuss" : undefined;
      if (to === "") {
        return { status: "rejected", note: "未指定收件人；以下是可用收件人名单", available_bots: roster() };
      }
      let registry;
      try {
        registry = api.readRegistry();
      } catch (error) {
        return { status: "rejected", to, note: `注册表读取失败：${error instanceof Error ? error.message : String(error)}` };
      }
      // 寻址：先按 id 精确命中；否则按名字（大小写不敏感）唯一匹配
      let target = registry[to] !== undefined && to !== botId ? registry[to] : undefined;
      if (target === undefined) {
        const lowered = to.toLowerCase();
        const byName = sortedBots(registry).filter((b) =>
          b.id !== botId && String(b.name ?? "").trim().toLowerCase() === lowered);
        if (byName.length === 1) target = byName[0];
        else if (byName.length > 1) {
          return { status: "rejected", to, note: `名字 "${to}" 匹配到多个 bot，请用 id 指明`, available_bots: roster() };
        }
      }
      if (target === undefined) {
        return { status: "rejected", to, note: `不存在 id 或名字为 "${to}" 的 bot`, available_bots: roster() };
      }
      if (text === "") {
        return { status: "rejected", to: target.id, note: "正文不能为空", available_bots: roster() };
      }
      const message = kind === "mail-discuss"
        ? appendMessage(dshHome, target.id, { from: botId, text, kind: "mail-discuss", discussRound: 1 })
        : appendMessage(dshHome, target.id, { from: botId, text });
      ctx.logger?.info?.(`[dsh-bots] bot "${botId}" send_mail → "${target.id}"（seq ${String(message.seq)}）`);
      // 返回规范 id，让模型在后续往来中直接使用
      return { status: "delivered", to: target.id, seq: message.seq };
    }
  });
}

/**
 * knowledge_register 的工具描述基础句 + 现读 REPORT_TEMPLATE.md 嵌入其结构。
 * F-R4-1：第四轮「为拿模板而全盘 find」实测烧 5m05s 的根治——模型无需下文件
 * 系统找模板，注册时描述即带结构。**动态现读、每 apply/重启刷新一次、零漂移
 * 禁止静态内联**（模板是用户主权文件，ensureKnowledgeBase 幂等不覆盖；静态
 * 内联会制造「描述谎报模板」新账）。读不到/空模板 → 降级为纯基础描述，不阻塞
 * 注册（模板可能被用户临时移动，非死局）。
 */
function buildRegisterDescription(dshHome) {
  const base = "把一份调研报告登记进团队共享知识库：报告全文落盘 knowledge/reports/<id>.md，索引清单 index.jsonl 追加一条（id 自动生成 R-<年>-<序号>）。必填 title（标题）、summary（3~5 句摘要）、body（报告全文 Markdown，建议按知识库模板 REPORT_TEMPLATE.md 的结构撰写：摘要/核心结论/引用来源/适合任务类型/复用来源）。可选 tags（2~5 个标签）、conclusions（可引用的条列结论）、sources（来源清单）、appliesTo（适合的任务类型）、task（任务溯源）、supersedes（本报告取代的旧报告 id，旧条目标记为已更新）、reused（本报告引用/复用了哪些历史报告 id）。同一份报告不要重复登记；新版本取代旧版时用 supersedes 而非另立两份；引用历史结论时务必填 reused（这是知识库复用率的观测点）。新报告若同时取代旧报告又沿用其部分结论（「取代且沿用」），supersedes 与 reused 可对同一旧 id 同时填——两者职责不同、互不排斥。";
  let template = null;
  try {
    template = readFileSync(templateFileFor(dshHome), "utf8");
  } catch {
    // 模板缺失/不可读 → 不带模板引用段（降级），不阻塞注册
  }
  if (template === null || template.trim() === "") return base;
  return `${base}\n\n报告模板结构（REPORT_TEMPLATE.md 现读，供撰写正文参考）：\n${template.trim()}`;
}

/**
 * 给 bot 实例注册团队知识库工具（knowledge_search / knowledge_register，
 * v1 MVP 见 PROPOSAL-knowledge-base.md）：「标准化报告模板 + 团队共享索引
 * 清单」的 bot 侧读写口。
 *
 * 语义要点（与 lib/knowledge.js 核心一致，此处只做工具层形状与防御）：
 *   - 检索是**索引级**（标题/标签/摘要/核心结论/适合任务类型子串），不做全文检索；
 *     报告全文落盘于 knowledge/reports/<id>.md；报告全文不在 bot workspace
 *     内，但对工具面含宿主读取能力（如 bash）的 agent 可直读（第四轮实证）。
 *     W-1(a) 已裁决（用户选 a：合法化磁盘直读）：检索通道之外的内容获取
 *     属设计内合法路径，不构成越权；knowledge_search 仍是知识库主通道，
 *     复用率 KPI 靠团队协议（开工先 search）维持而非强制；
 *   - 登记：自动生成 R-<年>-<序号>，产出者 botId 由工具自动填充（防冒名）；
 *     supersedes 指向旧报告 id 时旧条目标 updated（保留旧版痕迹）；
 *     reused 引用历史 id 时旧条目追加复用记录（去重）；
 *   - 工具描述动态嵌入 REPORT_TEMPLATE.md 结构（F-R4-1：现读+刷新，零静态内联）。
 *   - 与 send_mail 同一约束：ctx.get("tools") 响应式获取（不进静态 inject），
 *     纯 web 宿主无工具服务时不注册。
 */
function registerKnowledgeTools(ctx, api, botId) {
  const tools = ctx.get("tools");
  if (tools === undefined) return; // 无 agent 工具服务（如纯 web 宿主）→ 不注册
  const dshHome = api.dshHome;
  const disposers = [];
  disposers.push(tools.register({
    name: "knowledge_search",
    description: "查询团队调研知识库的共享索引（id/标题/标签/摘要/核心结论/适合任务类型做子串匹配，不检索报告全文）。派活或开工前先查历史结论，避免重复调研；结果含每条索引的 id、标题、标签、摘要、核心结论、来源、状态与日期——可直接引用其中的结论与来源（引用时把本报告 id 记入新报告的 reused 字段）。可按报告 id 检索（如 R-2026-001）定位特定报告。query 传空字符串则列出全部（最近登记在前，最多 10 条；命中超过 10 条时 truncated=true，可细化 query 缩小范围）。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "检索词（id/标题/标签/摘要/核心结论/适合任务类型子串匹配，大小写不敏感；可按报告 id 如 R-2026-001 检索）；空字符串列出全部" },
        status: { type: "string", enum: ["valid", "updated", "deprecated"], description: "可选：按状态过滤（默认不过滤）" }
      },
      required: ["query"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          results: { type: "array", items: { type: "object" } },
          total: { type: "integer" },
          truncated: { type: "boolean" },
          note: { type: "string" }
        },
        required: ["results"],
        additionalProperties: false
      },
      render: (_args, value) => [{
        type: "text",
        text: `knowledge_search 命中 ${String(value.total ?? value.results.length)} 条`
      }]
    },
    async execute(args) {
      const query = typeof args.query === "string" ? args.query : "";
      const status = typeof args.status === "string" && args.status !== "" ? args.status : null;
      try {
        // +1 哨兵探截断（F-C）：多取一条即可区分「恰 10 条」与「≥10 条被截」，
        // total 语义不变（＝返回条数），模型据 truncated 自行细化 query。
        const got = searchIndex(readIndex(dshHome), query, status, 11);
        const truncated = got.length > 10;
        const results = truncated ? got.slice(0, 10) : got;
        return { results, total: results.length, truncated };
      } catch (error) {
        return { results: [], total: 0, truncated: false, note: `索引读取失败：${error instanceof Error ? error.message : String(error)}` };
      }
    }
  }));
  disposers.push(tools.register({
    name: "knowledge_register",
    description: buildRegisterDescription(dshHome),
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string", description: "报告全文 Markdown（按模板结构）" },
        summary: { type: "string", description: "3~5 句结论速览" },
        tags: { type: "array", items: { type: "string" } },
        conclusions: { type: "array", items: { type: "string" } },
        sources: { type: "array", items: { type: "string" } },
        appliesTo: { type: "string" },
        task: { type: "string", description: "任务溯源（委托方/任务标识）" },
        supersedes: { type: "string", description: "被本报告取代的旧报告 id" },
        reused: { type: "array", items: { type: "string" }, description: "本报告引用/复用的历史报告 id" }
      },
      required: ["title", "body", "summary"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["created", "rejected"] },
          id: { type: "string" },
          note: { type: "string" }
        },
        required: ["status"],
        additionalProperties: false
      },
      render: (_args, value) => [{
        type: "text",
        text: value.status === "created"
          ? `knowledge_register 已登记报告 ${String(value.id)}`
          : `knowledge_register 未登记：${String(value.note ?? "unknown reason")}`
      }]
    },
    async execute(args) {
      const title = typeof args.title === "string" ? args.title.trim() : "";
      const body = typeof args.body === "string" ? args.body.trim() : "";
      const summary = typeof args.summary === "string" ? args.summary.trim() : "";
      if (title === "" || body === "" || summary === "") {
        ctx.logger?.debug?.(`[dsh-bots] bot "${botId}" 登记被拒（必填缺失，模型可修正重试）`);
        return { status: "rejected", note: "title / body / summary 均必填且不能为空" };
      }
      const result = registerReport({
        dshHome,
        botId,
        input: {
          title,
          body,
          summary,
          tags: args.tags,
          conclusions: args.conclusions,
          sources: args.sources,
          appliesTo: args.appliesTo,
          task: args.task,
          supersedes: args.supersedes,
          reused: args.reused
        }
      });
      if (!result.ok) {
        // 拒绝路径留痕（F-B：第三十一轮 readErrors 同款教训——锁超时/存储
        // 失败/悬空指针若零日志，排查时只剩模型转述）。均属罕见事件，warn 级。
        ctx.logger?.warn?.(`[dsh-bots] bot "${botId}" 登记失败：${result.error}`);
        return { status: "rejected", note: result.error };
      }
      ctx.logger?.info?.(`[dsh-bots] bot "${botId}" 登记知识库报告 ${result.id}`);
      return { status: "created", id: result.id };
    }
  }));
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/**
 * 给 bot 实例注册「团队名单 + 协作协议 + 知识库」系统提示段，让自然语言
 * 委派与知识沉淀成为内置能力：agent 每个回合的系统上下文里都知道自己是谁、
 * 队友是谁（含角色与在线状态）、send_mail 协议怎么用——用户描述需求即可，
 * 无需声明工具与方式。
 *
 * 实现走官方 systemPrompt 服务：variable 提供器在**每次 prompt 组装时现读
 * 注册表**（名单永远新鲜：新建/删除/改名队友从下一回合自动生效，无需重启
 * 本 bot），section 文本经 {{变量}} 插值注入。与 tools 一样用 ctx.get
 * 响应式获取服务。注册表读失败时降级为占位文案，绝不拖垮 prompt 组装。
 *
 * 双审建制（第六轮派发单 B①/D/C）：dsh 无原生 workspace 指令文件机制
 * （B① 实测：运行时打包产物与 README 均无 AGENTS.md 类加载），评审军规走
 * 插件侧 per-botId 注入——group="review" 的 bot 追加「双审评审军规」段
 * （D 压缩版六条 + 现行规程指针 R-2026-009）；lead 追加「双审试点门控」段
 * （C 的承诺顺序物理化：双初判处 lead 存放、核双齐后逐字转副审件予主审）。
 */
function registerTeamPromptSection(ctx, api, botId) {
  const systemPrompt = ctx.get("systemPrompt");
  if (systemPrompt === undefined) return; // 无 systemPrompt 服务（如纯 web 宿主）→ 不注册
  const rosterText = () => {
    try {
      const registry = api.readRegistry();
      const self = registry[botId];
      const mates = sortedBots(registry).filter((bot) => bot.id !== botId);
      const lines = [];
      lines.push(`你是「${self?.name ?? botId}」（id: ${botId}）${String(self?.role ?? "").trim() !== "" ? `，职责：${String(self.role).slice(0, 200)}` : ""}。`);
      if (mates.length === 0) {
        lines.push("当前没有其他队友；队友加入后你可以用 send_mail 与他们协作。");
        return lines.join("\n");
      }
      lines.push("你的队友（实时名单）：");
      for (const mate of mates) {
        const online = computeStatus(mate).online ? "在线" : "离线（发出的邮件会排队，待其上线后处理）";
        const role = String(mate.role ?? "").trim();
        lines.push(`- ${mate.name}（id: ${mate.id}）：${role === "" ? "（无角色描述）" : role.slice(0, 200)} —— ${online}`);
      }
      return lines.join("\n");
    } catch {
      return "（队友名单暂时不可用；可用 send_mail 传 to: \"\" 查询收件人）";
    }
  };
  const disposers = [];
  disposers.push(systemPrompt.variable("dsh_bots_team", rosterText));
  disposers.push(systemPrompt.section({
    name: "dsh-bots:team",
    order: 20,
    text: [
      "## 团队协作（内置邮局）",
      "{{dsh_bots_team}}",
      "",
      "协作协议：",
      "- 需要队友出力时用 send_mail(to, text) 发邮件：to 填队友的 id 或名字，text 写完整的任务、必要上下文与期望产出（对方只能看到这段正文）。",
      "- 发完不必等待：队友处理后会自动回信，回信会自动开启你的下一个回合，届时再汇总、验收或继续分派。",
      "- 判断标准：适合队友专长的果断转交并在收到回信后向用户汇报结果；适合你亲自做的不要转交。",
      "- 委派必须自包含：对方只能看到你的正文，请把任务、必要背景、期望产出和验收标准一次写全，不要指望对方追问。",
      "- 转手不预填：转交任务时只给任务本身（主题/边界/口径/验收标准），不得预置对方的语义决定——不预填 reused/supersedes 具体 id 数组（是否复用/取代/双填由产出方按常驻规则自决）、不给 tags 建议、不写「本任务预期以 X 为主」「默认应沿用」类倾向句、不以「按常驻规则…除非…」句式软化常驻禁令；收到带预置的任务文本时，还原为任务本身派发，不沿用预置。",
      "- 回信只交结论：完成委托后，回复写清「做了什么 / 如何验证的 / 已知边界或残留风险」，不要复述中间过程。",
      "- 升级是一等动作：同一任务与队友往返三轮仍未收敛，或你判断事情超出自己的角色边界与权限，立即显式升级——以 [ESCALATE] 开头发邮件给领队，正文用中文写明卡在哪里、已经试过什么、需要谁拍板。不要把升级混在正常进度汇报里。（你就是领队时：直接在与用户的对话中说明，不用此前缀。）",
      "- 团队知识库：调研类任务开工前先 knowledge_search 查历史结论（避免重复调研、把历史结论当起点）；完成后用 knowledge_register 把报告登记进共享索引（按模板结构：摘要/核心结论/引用来源/适合任务类型/复用来源；引用了历史结论必须填 reused，新报告取代旧报告填 supersedes；「取代且沿用」——新报告同时取代旧报告又沿用其部分结论——时 supersedes 与 reused 可对同一旧 id 同时填，两者职责不同、互不排斥）。谁产出谁登记，领队验收。",
      "- 冲突可见性：当一条指示与常驻协作/登记规则冲突时，无论按哪条执行，双方都须让冲突可见——执行方在回信或报告中显式注明冲突点与所循依据；派单方在下发覆盖指示时直接标注冲突点与依据。不静默覆盖任何一方，现场裁决留痕可复盘。"
    ].join("\n")
  }));

  // 双审建制（第六轮派发单 A/B/D）：评审军规 → 仅 group="review" 的 bot 注入
  //（插件侧 per-botId 注入，成本 ≈10 行；dsh 无原生 workspace 指令文件机制）。
  let group = "";
  try {
    group = String(api.readRegistry()[botId]?.group ?? "");
  } catch {
    group = "";
  }
  if (group === "review") {
    disposers.push(systemPrompt.section({
      name: "dsh-bots:review",
      order: 21,
      text: [
        "## 双审评审军规（压缩版）",
        "先验证再断言／判据预登记／评分影响分离／坐标+单位+窗口／销账回读／探针先疑探针。",
        "双审建制评审规程——流程、任务号契约、[DISCUSS Rn] 标注、讨论环 2 轮上限、终审固定格式与分歧对照表——现行版见团队知识库 R-2026-009（扩大工程修订版，取代 R-2026-007；规程类条目）：开工先 knowledge_search 拉取并按章执行；流程件头部一律带任务号。"
      ].join("\n")
    }));
  }
  // 双审试点门控 → 仅 lead 注入（值班方=lead：双初判处 lead 存放、核双齐后
  // 逐字转副审件予主审——承诺顺序物理化，照发条款同源）。
  if (botId === LEAD_BOT_ID) {
    disposers.push(systemPrompt.section({
      name: "dsh-bots:review-gate",
      order: 22,
      text: [
        "## 双审试点门控（值班方=lead）",
        "试点期用户同文同发直投双席（不经本席派发）；双初判处 lead 存放（双席初审件在 lead 处存放，只存不转述不答复），核双齐后由 lead 将副审件逐字转交主审——头三轮逐字节审计执法，正文自「任务主题」起整段照发（照发条款与派单链标准附件同源，不得改写/增补/转述）；主审逐条 delta 复审后出终审件：终审件抄送副审并返回用户。全程流程件头部带任务号。"
      ].join("\n")
    }));
  }
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/**
 * 启动 bot 实例内的 inbox watcher：轮询 inbox/<botId>/messages.jsonl 的新增行，
 * 逐条触发自动回复（写入 outbox/<botId>/<timestamp>.jsonl）。
 *
 * - 只处理 seq 严格大于 lastSeq 的消息；回复成功后才推进 lastSeq，失败下次重试。
 * - 注册时 inbox 目录已存在（如 bot 重启）→ lastSeq 初始化为文件现有最大 seq，
 *   已有消息不回放。目录尚不存在 → 保持探测，出现后才开始监听；此时文件里的
 *   都是本次进程从未见过的新消息（首条消息由 host 的 send() 创建目录），全量处理。
 * - 增量读取：维护「已消费字节 offset + 尾部未换行的原始字节 pending」游标，
 *   每 tick 只读新增字节，不重复解析整个文件；写一半的行留在 pending 里与
 *   下次读到的字节拼接（原始字节缓冲，多字节 UTF-8 字符跨读也不会损坏）；
 *   文件被截断/替换（size < offset）时重置游标并按初始化语义重新跳过存量。
 * - 返回 disposer（ctx.effect 使用；停止时清理定时器）。
 */
function startInboxWatcher(ctx, api, botId) {
  const dshHome = api.dshHome;
  const inboxDir = inboxDirFor(dshHome, botId);
  const file = messagesPathFor(dshHome, botId);
  const logger = ctx.logger;

  let stopped = false;
  let started = existsSync(inboxDir);
  let lastSeq = started ? maxSeqInFile(file) : 0;
  let busy = false;
  let timer = null;
  // 增量读取游标（见函数头注释）。
  let offset = started && existsSync(file) ? statSync(file).size : 0;
  let pending = Buffer.alloc(0);

  const scan = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      if (!existsSync(file)) return;
      const size = statSync(file).size;
      if (size < offset) {
        // 文件被截断/替换（异常场景）：重置游标，回到「跳过存量」的初始化语义
        logger?.warn?.(`[dsh-bots] "${botId}" inbox 文件变短（截断/替换），重新初始化读取游标`);
        offset = size;
        pending = Buffer.alloc(0);
        lastSeq = maxSeqInFile(file);
        return;
      }
      if (size === offset && pending.length === 0) return; // 无新字节
      let chunk = Buffer.alloc(0);
      if (size > offset) {
        const fd = openSync(file, "r");
        try {
          const buffer = Buffer.alloc(size - offset);
          const { bytesRead } = readSync(fd, buffer, 0, buffer.length, offset);
          chunk = buffer.subarray(0, bytesRead);
        } finally {
          closeSync(fd);
        }
      }
      const data = Buffer.concat([pending, chunk]);
      const lastNl = data.lastIndexOf(10);
      if (lastNl === -1) {
        // 整段都尚未见换行（一行写一半）：全部留待下轮
        pending = data;
        offset = size;
        return;
      }
      // 尾部未换行字节由内存 pending 承接，磁盘游标推进到 EOF，不重读
      pending = data.subarray(lastNl + 1);
      offset = size;
      const fresh = parseJsonlLines(data.subarray(0, lastNl + 1).toString("utf8"))
        .filter((msg) => Number.isInteger(msg.seq) && msg.seq > lastSeq);
      for (const msg of fresh) {
        if (stopped) return;
        await handleIncoming(ctx, dshHome, botId, msg);
        if (Number.isInteger(msg.seq) && msg.seq > lastSeq) lastSeq = msg.seq;
      }
    } catch (error) {
      logger?.warn?.(
        `[dsh-bots] "${botId}" inbox 扫描异常：${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      busy = false;
    }
  };

  const tick = async () => {
    if (stopped) return;
    if (!started && existsSync(inboxDir)) {
      started = true;
      logger?.info?.(`[dsh-bots] bot 实例 "${botId}" 开始监听 inbox（${inboxDir}）`);
    }
    await scan();
  };

  timer = setInterval(() => {
    void tick();
  }, WATCH_POLL_MS);
  timer.unref?.();
  void tick();

  logger?.info?.(
    `[dsh-bots] bot 实例 "${botId}"：inbox watcher 已注册（轮询间隔 ${WATCH_POLL_MS}ms）`
  );

  return () => {
    stopped = true;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

//#endregion

//#region 邮件到达通知 —— host 侧文件监听（v2）

/** 邮件到达通知的正文预览最大字符数（再长客户端通知条放不下）。 */
const MAIL_PREVIEW_CHARS = 80;

/**
 * 通知预览：压缩连续空白（多行回复压成一行）+ 截断到 maxChars（末尾加省略号）。
 * 空值/非字符串按空串处理（防御：损坏行没有 text 字段）。
 */
function mailPreview(text, maxChars = MAIL_PREVIEW_CHARS) {
  const s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  return s.length > maxChars ? s.slice(0, maxChars) + "…" : s;
}

/** 空监视器状态：inboxSeq={botId:maxSeq}，outbox={botId:{fileName:行数}}。 */
function emptyMailState() {
  return { inboxSeq: {}, outbox: {} };
}

/** outbox 事件（正文预览 + 原始字段；dir 恒 "outbox"）。 */
function outboxEvent(botId, msg) {
  return {
    botId,
    dir: "outbox",
    from: typeof msg.from === "string" && msg.from !== "" ? msg.from : "bot",
    text: mailPreview(msg.text),
    at: typeof msg.timestamp === "string" ? msg.timestamp : null,
    id: typeof msg.id === "string" ? msg.id : null
  };
}

/**
 * 邮件到达扫描的纯函数核心（真实文件驱动，零副作用）：对比 state 与磁盘现状，
 * 返回新邮件事件、下一份 state 与读错误诊断（供监视器记日志——纯函数不自行
 * 打印，诊断随返回值向上传递）。
 *
 * 语义不变量：
 *   - 每 (bot,dir) 首见即静默基线（host 重启后存量不回放；注册表里新出现的
 *     bot 同样首见静默——创建后 1s 内到的首封邮件可能被并入基线，可接受）；
 *   - inbox 按 seq 增量 diff（seq 单调递增，损坏行被跳过、不重不丢）：
 *     kind="mail-response"（bot→bot 自动回信，协议流量）静默；host 自身
 *     POST /send 的写入经 ownSends（botId → Set<自发送 seq>，**精确匹配**
 *     而非单值 max——同一 1s tick 内夹层外来邮件 seq 更小，max 会误吞，
 *     见 F-4 回归测试）抑制——用户自己发的邮件他看到的就是全部，再弹通知
 *     是重复报幕；文件重写（maxSeq 回退，外部重建/清空）静默重置基线；
 *     瞬态读失败（EACCES/EMFILE）**不重置基线**：已首见保持旧基线（恢复后
 *     只报增量），首见中保持未首见（恢复后重新静默基线）——否则恢复后
 *     全量重放（F-2 回归测试）；
 *   - outbox 按文件名（=ISO 时间戳变体，字典序==时间序）逐文件行数 diff
 *     （追加写：行数只增不减；解析行数=干净行数，追加语义下与行索引等价）：
 *     新文件全量事件、同文件追加仅新行、截断/删除静默并重置基线；单文件
 *     瞬态读失败**携带旧计数**（已首见）或忽略该文件保持首见（首见中）——
 *     否则恢复后整文件重放（F-3 回归测试）；
 *   - bot 从注册表移除 → 状态清理；同 id 重建 → 重新首见静默基线。
 *
 * ownSeq 为 Map（BotsApi.ownSends：botId → Set<seq>）或省略；botIds 为本次
 * 注册表全部 id。返回 {state, events, readErrors}；readErrors 为
 * "<dir> <botId>[/<file>]: <error message>" 字符串数组。
 */
function scanMailState({ dshHome, state, botIds, ownSeq }) {
  const next = { inboxSeq: { ...state.inboxSeq }, outbox: { ...state.outbox } };
  const events = [];
  const readErrors = [];
  const seen = new Set(botIds);
  for (const botId of botIds) {
    // --- inbox：seq 增量 diff ---
    const file = messagesPathFor(dshHome, botId);
    let lines = [];
    let maxSeq = 0;
    let inboxReadFailed = false;
    try {
      if (existsSync(file)) {
        lines = parseJsonlLines(readFileSync(file, "utf8"));
        for (const msg of lines) {
          if (Number.isInteger(msg.seq) && msg.seq > maxSeq) maxSeq = msg.seq;
        }
      }
    } catch (error) {
      lines = [];
      inboxReadFailed = true;
      readErrors.push(`inbox ${botId}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const prevSeq = state.inboxSeq[botId];
    if (!inboxReadFailed && prevSeq !== undefined && maxSeq > prevSeq) {
      const own = ownSeq instanceof Map ? ownSeq.get(botId) : undefined;
      for (const msg of lines) {
        if (!Number.isInteger(msg.seq) || msg.seq <= prevSeq) continue;
        if (own instanceof Set && own.has(msg.seq)) continue;    // host 自身 send：精确 seq 静默
        if (msg.kind === "mail-response") continue;              // 协议回信：静默
        events.push({
          botId,
          dir: "inbox",
          from: typeof msg.from === "string" && msg.from !== "" ? msg.from : "user",
          text: mailPreview(msg.text),
          at: typeof msg.at === "string" ? msg.at : null,
          seq: msg.seq
        });
      }
    }
    // 基线：读失败不重置（已首见保持旧值；首见中保持未首见，下拍重新首见）；
    // 其余按 prevSeq 未定义（首见）/ maxSeq < prevSeq（文件重写）→ 静默更新/重置。
    if (inboxReadFailed) {
      if (prevSeq !== undefined) next.inboxSeq[botId] = prevSeq;
    } else {
      next.inboxSeq[botId] = maxSeq;
    }

    // --- outbox：逐文件行数 diff ---
    const dir = outboxDirFor(dshHome, botId);
    const prevFiles = state.outbox[botId];
    const current = {};
    const fileEvents = [];
    let dirExists = false;
    try {
      if (existsSync(dir)) {
        dirExists = true;
        for (const name of readdirSync(dir).sort()) {
          if (!name.endsWith(".jsonl")) continue;
          const full = join(dir, name);
          let msgs;
          try {
            msgs = parseJsonlLines(readFileSync(full, "utf8"));
          } catch (error) {
            // 读失败（可能正被写入/删除）：已首见则携带旧计数防基线丢失，
            // 首见中则忽略该文件保持未首见——恢复后不整文件重放（F-3）。
            if (prevFiles !== undefined) current[name] = prevFiles[name] ?? 0;
            readErrors.push(`outbox ${botId}/${name}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }
          current[name] = msgs.length;
          if (prevFiles === undefined) continue; // 首见 outbox：只记基线
          const prevCount = prevFiles[name];
          if (prevCount === undefined) {
            for (const msg of msgs) fileEvents.push(outboxEvent(botId, msg));
          } else if (msgs.length > prevCount) {
            for (const msg of msgs.slice(prevCount)) fileEvents.push(outboxEvent(botId, msg));
          }
          // msgs.length < prevCount → 截断/重写：静默，基线随 current 重置（下 tick 起恢复 diff）
        }
      }
    } catch (error) {
      dirExists = false; // 目录读失败：下 tick 重试（已首见则清基线 → 恢复后重新首见静默）
      readErrors.push(`outbox ${botId}/: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (prevFiles !== undefined) events.push(...fileEvents);
    if (prevFiles === undefined || dirExists) next.outbox[botId] = current;
    else delete next.outbox[botId];
  }
  // 已删除 bot 的状态清理（同一 id 重建后重新首见静默基线）
  for (const id of Object.keys(next.inboxSeq)) {
    if (!seen.has(id)) delete next.inboxSeq[id];
  }
  for (const id of Object.keys(next.outbox)) {
    if (!seen.has(id)) delete next.outbox[id];
  }
  return { state: next, events, readErrors };
}

/**
 * 邮件到达监视器（poll 状态机，无定时器）：持有 scanMailState 的增量状态，
 * 每次 poll() 返回 {events, readErrors}（读错误诊断供上层记日志——扫描核心
 * 纯函数不自行打印）。定时器/广播由 startMailNotifyMonitor 负责。
 */
function createMailMonitor({ dshHome, readRegistry, ownSends }) {
  let state = emptyMailState();
  return {
    poll() {
      const result = scanMailState({
        dshHome,
        state,
        botIds: Object.keys(readRegistry()),
        ownSeq: ownSends
      });
      state = result.state;
      return { events: result.events, readErrors: result.readErrors };
    }
  };
}

/**
 * apply 的 effect 体（仅主 web 实例）：WATCH_POLL_MS 轮询所有注册 bot 的邮局
 * 目录，新邮件经 SSE `mail` 事件广播（一帧一批）。启动即扫描一次建立首见
 * 基线（存量邮件静默），收窄启动窗口。bot 实例不启动监视器——它是邮件的
 * 写入方，向客户端报自己的写入没有意义，且多实例会重复广播。
 */
function startMailNotifyMonitor(ctx, api) {
  const monitor = createMailMonitor({
    dshHome: api.dshHome,
    readRegistry: () => api.readRegistry(),
    ownSends: api.ownSends
  });
  const tick = () => {
    try {
      const { events, readErrors } = monitor.poll();
      for (const error of readErrors) {
        ctx.logger?.warn?.(`[dsh-bots] 邮件监视器读失败：${error}`);
      }
      if (events.length > 0) {
        api.sseHub?.broadcast?.("mail", { events });
      }
    } catch (error) {
      ctx.logger?.warn?.(
        `[dsh-bots] 邮件到达监视器扫描异常：${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
  tick(); // 启动即基线
  const timer = setInterval(tick, WATCH_POLL_MS);
  timer.unref?.();
  return () => {
    clearInterval(timer);
  };
}

//#endregion

//#region 插件入口

//#region 评审主机泵（R2-09：host 生产接线——invocation 执行/一次性 reviewer session/
// 输出落工件/流程推进；R2-10 的 SSE review 广播在此挂接）

/**
 * 七字段 review 通知（R2-10）：仅 final/recheck-final user-facing 落盘后广播。
 * payload 键必须恰为 NOTIFY_KEYS 七字段（taskId/artifactId/stage/status/createdAt/sha256/byteLength）。
 */
function emitReviewNotify(ctx, api, dshHome, taskId, artifactId, stage) {
  let manifest;
  try { manifest = readManifest(dshHome, artifactId); }
  catch (error) { throw error; }
  if (!manifest) throw new Error("通知工件 manifest 缺失");
  const payload = {
    taskId, artifactId, stage,
    status: "completed",
    createdAt: manifest.createdAt,
    sha256: manifest.sha256,
    byteLength: manifest.byteLength
  };
  const keys = Object.keys(payload).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["artifactId", "byteLength", "createdAt", "sha256", "stage", "status", "taskId"].sort())) {
    throw new Error("review 通知字段必须恰为 NOTIFY_KEYS 七字段");
  }
  api.sseHub?.broadcast?.("review", { events: [payload] });
}

/**
 * 本 host 实例的评审单写者标识（与 store 锁的 hostInstanceId 语义一致）。
 */
function reviewHostInstanceId() {
  return `host-${process.pid}`;
}

/** 列出全部评审 invocation 目录（review/invocations/<id>；无目录 → []）。 */
function listReviewInvocations(dshHome) {
  const root = reviewInboxFor(dshHome);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * 一次性 reviewer RPC runner 工厂（P0.2）：每 invocation 全新专用 session，只执行一次
 * prompt；create/selectModel/prompt/history 任一步失败原样抛出（不得回退其他 session）；
 * 不写 .dsh-bot-session.json（一次性会话不与 bot 持久上下文混用）。测试注入 rpcStub
 * （(method, payload) => value）时不做真实 RPC。返回 async (text) => {text, sessionId, pid}。
 */
function buildReviewRunner(ctx, api, manifest, {
  rpcStub = null,
  timeoutMs = AGENT_TURN_TIMEOUT_MS,
  rpcTimeoutMs = RPC_TIMEOUT_MS + 5_000,
  heartbeatMs = null,
  invokeHeartbeat = null
} = {}) {
  const dshHome = api.dshHome;
  const bot = api.readRegistry()[manifest.targetReviewer];
  return async (text) => {
    if (!bot || !Number.isInteger(bot?.port)) {
      throw new Error(`reviewer bot 未注册或无端口：${manifest.targetReviewer}`);
    }
    const rpc = rpcStub ?? ((method, payload) => dshRpc(bot.port, method, payload, { rpcPrefix: `dsh-bots-${manifest.targetReviewer}` }));
    const started = Date.now();
    let heartbeatTimer = null;
    let heartbeatFailure = null;
    let rejectHeartbeat;
    const heartbeatFailurePromise = new Promise((_, reject) => { rejectHeartbeat = reject; });
    // The supervisor may fail before the next RPC starts. Keep the rejection
    // observed even when the runner is between calls; callRpc still races it
    // when active, while Node must not treat an early failure as unhandled.
    void heartbeatFailurePromise.catch(() => {});
    const pulse = () => {
      if (heartbeatFailure || heartbeatMs === null || invokeHeartbeat === null) return;
      try {
        const beat = invokeHeartbeat();
        if (!beat?.ok) throw new Error(beat?.reason ?? "unknown heartbeat failure");
      } catch (error) {
        heartbeatFailure = new Error(`review invocation heartbeat 失败，终止 runner（${manifest.invocationId}）：${error instanceof Error ? error.message : String(error)}`);
        rejectHeartbeat(heartbeatFailure);
      }
    };
    if (heartbeatMs !== null && invokeHeartbeat !== null) {
      if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0) throw new Error("heartbeatMs 必须为正数");
      pulse();
      heartbeatTimer = setInterval(pulse, heartbeatMs);
    }
    // F-RV-18：每次 RPC 都受 runner 总 deadline、单次 timeout 和独立 heartbeat
    // supervisor 三重约束。heartbeat supervisor 在 history pending 时仍运行，失败时
    // 直接打断当前 Promise.race；timer 不 unref，且在 runner 结束时必清除。
    const callRpc = async (method, payload) => {
      if (heartbeatFailure) throw heartbeatFailure;
      const remaining = timeoutMs - (Date.now() - started);
      if (remaining <= 0) throw new Error(`reviewer agent turn timed out after ${timeoutMs}ms（${manifest.targetReviewer}）`);
      const effectiveTimeout = Math.min(rpcTimeoutMs, remaining);
      let timer;
      try {
        return await Promise.race([
          Promise.resolve().then(() => rpc(method, payload)),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`reviewer RPC ${method} runner 级超时（${effectiveTimeout}ms）`)), effectiveTimeout);
          }),
          heartbeatFailurePromise
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      const created = await callRpc("session.create", { cwd: workspaceDirFor(dshHome, manifest.targetReviewer) });
      const sessionId = typeof created?.sessionId === "string" ? created.sessionId : null;
      if (sessionId === null) throw new Error(`reviewer session.create 未返回 sessionId（${manifest.targetReviewer}）`);
      if (typeof bot.modelProvider === "string" && bot.modelProvider !== "" &&
          typeof bot.model === "string" && bot.model !== "") {
        await callRpc("session.selectModel", { sessionId, provider: bot.modelProvider, model: bot.model });
      }
      await callRpc("session.prompt", {
        sessionId,
        mode: "queue",
        content: [{ type: "text", text: String(text) }]
      });
      let lastHeartbeat = 0;
      while (Date.now() - started < timeoutMs) {
        if (heartbeatFailure) throw heartbeatFailure;
        // 兼容 heartbeatMs 未启用的注入调用；启用 supervisor 时由独立 timer 负责，
        // 这里再做一次即时检查以减少 timer 调度边界带来的延迟。
        if (heartbeatMs !== null && invokeHeartbeat !== null && Date.now() - lastHeartbeat >= heartbeatMs) {
          pulse();
          lastHeartbeat = Date.now();
          if (heartbeatFailure) throw heartbeatFailure;
        }
        const remaining = timeoutMs - (Date.now() - started);
        await Promise.race([
          sleep(Math.min(WATCH_POLL_MS, Math.max(1, remaining))),
          heartbeatFailurePromise
        ]);
        if (heartbeatFailure) throw heartbeatFailure;
        const history = await callRpc("session.history", { sessionId, maxMessages: 100 });
        const events = Array.isArray(history?.events) ? history.events.map((entry) => entry?.event ?? entry) : [];
        const ended = [...events].reverse().find((event) =>
          event?.type === "turn/end" && Number.isInteger(event?.data?.turn));
        const assistant = ended === undefined ? undefined : [...events].reverse().find((event) =>
          event?.type === "assistant/message" && event?.data?.turn === ended.data.turn &&
          Array.isArray(event?.data?.message?.content));
        if (heartbeatFailure) throw heartbeatFailure;
        if (assistant !== undefined) {
          return {
            text: assistant.data.message.content
              .filter((part) => part?.type === "text")
              .map((part) => part.text)
              .join("\n"),
            sessionId,
            pid: bot.pid ?? null
          };
        }
      }
      throw new Error(`reviewer agent turn timed out after ${timeoutMs}ms（${manifest.targetReviewer}）`);
    } finally {
      if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
    }
  };
}
/** 解析 invocation parts（key=value 行）为绑定对象。 */
function parseInvocationBinding(parts) {
  const binding = {};
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (typeof part !== "string") continue;
      const idx = part.indexOf("=");
      if (idx > 0 && !binding[part.slice(0, idx)]) binding[part.slice(0, idx)] = part.slice(idx + 1);
    }
  }
  return binding;
}

/**
 * user-facing 投递默认实现（R2-01 relay 的 copyToUserFacing 钩子）：把已 committed 的
 * final-lead/recheck-final-lead 工件发布到 review/results 索引（P5-1 publishResult）。
 * body 副本由 relay 目标写入负责；本函数落 result 索引条目。
 */
function defaultCopyToUserFacing(ctx, api, artifactId, meta) {
  const dshHome = api.dshHome;
  let manifest;
  try { manifest = readManifest(dshHome, artifactId); }
  catch (error) {
    appendAudit(dshHome, { type: "user-facing-publish-failed", artifactId, reason: error.message });
    throw error;
  }
  if (!manifest || !["final-lead", "recheck-final-lead"].includes(manifest.stage)) {
    appendAudit(dshHome, { type: "user-facing-publish-rejected", artifactId, reason: `stage=${manifest?.stage} 不可 user-facing` });
    throw new Error(`stage=${manifest?.stage} 不可发布 user-facing`);
  }
  // 只物化不可变正文副本（relay 校验 hash）；索引发布由 handleCompletedInvocation
  // 在携带 envelope 元数据（decision/findingIds）后统一执行，避免双重发布语义冲突。
  const target = resultBodyFile(dshHome, manifest.taskId, artifactId);
  mkdirSync(dirname(target), { recursive: true });
  writeFileDurable(target, readFileSync(manifest.bodyPath));
  return target;
}

/**
 * 处理一个 completed invocation（P0.2/P0.3 生产闭环）：
 *   1) 读取唯一 output artifact 原始文本（R2-04 已持久化）；
 *   2) 按 stage 校验 envelope（additionalProperties=false，字段缺失/额外/枚举外 → fail
 *      closed：审计 + 不 relay、不推进流程）；
 *   3) body = envelope.body（原字节）提交为 stage 工件（幂等键 = outputArtifactId）；
 *   4) 按 stage 推进流程（initial-* → registerInitial；delta-lead → advanceMainFlow；
 *      discussion-second → bridgeDiscussionEnvelope（R2 落 thread、closed、建 final）；
 *      final-lead → registerFinal；fix-report → advanceFixFlow；
 *      recheck-* → registerInitial/advanceFixFlow/recheck-final → registerRecheckFinal）。
 * 返回 {step, ...}；任何失败不抛未捕获异常（审计留痕）。
 */
async function handleCompletedInvocation(ctx, api, manifest, state, opts = {}) {
  const dshHome = api.dshHome;
  const outputArtifactId = state.outputArtifactId;
  if (typeof outputArtifactId !== "string" || outputArtifactId === "") {
    appendAudit(dshHome, { type: "invocation-completed-no-output", invocationId: manifest.invocationId, reason: "completed 事件缺 outputArtifactId" });
    return { step: "completed-no-output-artifact" };
  }
  let raw;
  try { raw = readFileSync(bodyFileFor(dshHome, outputArtifactId), "utf8"); }
  catch (error) {
    appendAudit(dshHome, { type: "invocation-output-unreadable", invocationId: manifest.invocationId, outputArtifactId, reason: error.message });
    return { step: "output-unreadable" };
  }
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch (error) {
    appendAudit(dshHome, { type: "invocation-envelope-invalid", invocationId: manifest.invocationId, outputArtifactId, stage: manifest.stage, reason: `JSON 解析失败：${error.message}` });
    return { step: "envelope-invalid", reason: "输出非 JSON envelope（fail closed，不 relay）" };
  }
  const check = validateReviewEnvelope({ stage: manifest.stage, envelope });
  if (!check.ok) {
    appendAudit(dshHome, { type: "invocation-envelope-invalid", invocationId: manifest.invocationId, outputArtifactId, stage: manifest.stage, reason: check.reason });
    return { step: "envelope-invalid", reason: check.reason };
  }
  const submitted = submitReviewArtifact(dshHome, {
    taskId: manifest.taskId,
    stage: manifest.stage,
    authorBotId: manifest.targetReviewer,
    body: envelope.body,
    idempotencyKey: `output:${outputArtifactId}`
  });
  if (!submitted || submitted.status === "quarantined") {
    appendAudit(dshHome, { type: "invocation-output-submit-failed", invocationId: manifest.invocationId, outputArtifactId, reason: submitted?.status ?? "submit 未返回" });
    return { step: "output-submit-failed", status: submitted?.status };
  }
  const artifactId = submitted.artifactId;
  const taskId = manifest.taskId;
  const copyToUserFacing = opts.copyToUserFacing ?? ((a, meta) => defaultCopyToUserFacing(ctx, api, a, meta));

  switch (manifest.stage) {
    case "initial-lead":
    case "initial-second": {
      registerInitial(dshHome, { taskId, stage: manifest.stage, artifactId, envelope, sourceSnapshotId: manifest.sourceSnapshotId });
      const advanced = await advanceMainFlow(dshHome, { taskId, reviewCycle: manifest.reviewCycle });
      return { step: `${manifest.stage}-registered:${advanced?.step}`, artifactId };
    }
    case "recheck-lead":
    case "recheck-second": {
      registerInitial(dshHome, { taskId, stage: manifest.stage, artifactId, envelope, sourceSnapshotId: manifest.sourceSnapshotId });
      const flow = readFlow(dshHome, taskId);
      const fixReportArtifactId = opts.fixReportArtifactId ?? flow?.fixReportArtifactId;
      let engineeringBotId = opts.engineeringBotId ?? null;
      if (fixReportArtifactId) {
        try {
          const fixManifest = readManifest(dshHome, fixReportArtifactId);
          engineeringBotId = fixManifest?.authorBotId ?? engineeringBotId;
        } catch { /* 保留 opts 值 */ }
      }
      const advanced = fixReportArtifactId && engineeringBotId
        ? advanceFixFlow(dshHome, { taskId, fixReportArtifactId, engineeringBotId })
        : { step: "awaiting-fix-report-context" };
      return { step: `${manifest.stage}-registered:${advanced?.step}`, artifactId };
    }
    case "delta-lead": {
      const advanced = await advanceMainFlow(dshHome, {
        taskId,
        reviewCycle: manifest.reviewCycle,
        deltaArtifactId: artifactId,
        deltaEnvelope: envelope
      });
      return { step: advanced?.step ?? "delta-advanced", artifactId };
    }
    case "discussion-second":
    case "recheck-discussion-second": {
      const binding = parseInvocationBinding(readInvocationPartsForBinding(dshHome, manifest));
      const threadId = binding.discussionThreadId;
      const cycleId = manifest.reviewCycle;
      const result = bridgeDiscussionEnvelope(dshHome, {
        taskId,
        cycleId,
        threadId,
        round: 2,
        replyTo: binding.replyTo ?? null,
        authorBotId: manifest.targetReviewer,
        stage: manifest.stage,
        invocationId: manifest.invocationId,
        envelope
      });
      if (!result.accepted) {
        appendAudit(dshHome, { type: "invocation-r2-rejected", invocationId: manifest.invocationId, reason: result.reason });
        return { step: "r2-rejected", reason: result.reason };
      }
      return { step: "discussion-closed", artifactId: result.artifactId, finalInvocationId: result.invocationId };
    }
    case "final-lead": {
      // F-RV-15：registerFinal 是 final 的不可绕过发布门——user-facing copy 失败/
      // 隔离/未完成 → ok=false：禁 publishResult、禁完成通知、保持 pending/failed/
      // quarantined 语义（不返回 final-registered 成功步骤）。
      const registered = registerFinal(dshHome, { taskId, artifactId, envelope, copyToUserFacing });
      if (!registered.ok) {
        appendAudit(dshHome, { type: "final-register-rejected", artifactId, taskId, reason: registered.reason });
        return { step: "final-register-rejected", reason: registered.reason, artifactId };
      }
      try {
        publishResult(dshHome, {
          taskId, artifactId, stage: "final-lead", authorBotId: "reviewer-lead",
          sourceArtifactId: artifactId,
          decision: envelope.decision ?? null,
          findingIds: Array.isArray(envelope.findingIds) ? envelope.findingIds : []
        });
        appendAudit(dshHome, { type: "user-facing-published", artifactId, taskId, stage: "final-lead" });
      } catch (error) {
        appendAudit(dshHome, { type: "user-facing-publish-failed", artifactId, taskId, reason: error.message });
        return { step: "final-publish-failed", reason: error.message, artifactId };
      }
      return { step: "final-registered", artifactId };
    }
    case "fix-report": {
      const advanced = advanceFixFlow(dshHome, {
        taskId,
        fixReportArtifactId: artifactId,
        engineeringBotId: opts.engineeringBotId ?? manifest.targetReviewer
      });
      return { step: advanced?.step ?? "fix-flow-advanced", artifactId };
    }
    case "recheck-delta-lead": {
      const flow = readFlow(dshHome, taskId);
      const fixReportArtifactId = opts.fixReportArtifactId ?? flow?.fixReportArtifactId;
      const advanced = advanceFixFlow(dshHome, {
        taskId,
        fixReportArtifactId,
        engineeringBotId: opts.engineeringBotId ?? manifest.targetReviewer,
        recheckDeltaArtifactId: artifactId,
        recheckDeltaEnvelope: envelope
      });
      return { step: advanced?.step ?? "recheck-delta-advanced", artifactId };
    }
    case "recheck-final-lead": {
      // F-RV-15：recheck-final 采用同样的 route committed gate
      const registered = registerRecheckFinal(dshHome, { taskId, artifactId, envelope, copyToUserFacing });
      if (!registered.ok) {
        appendAudit(dshHome, { type: "recheck-final-register-rejected", artifactId, taskId, reason: registered.reason });
        return { step: "recheck-final-register-rejected", reason: registered.reason, artifactId };
      }
      try {
        publishResult(dshHome, {
          taskId, artifactId, stage: "recheck-final-lead", authorBotId: "reviewer-lead",
          sourceArtifactId: artifactId,
          decision: envelope.decision ?? null,
          findingIds: Array.isArray(envelope.findingIds) ? envelope.findingIds : []
        });
        appendAudit(dshHome, { type: "user-facing-published", artifactId, taskId, stage: "recheck-final-lead" });
      } catch (error) {
        appendAudit(dshHome, { type: "user-facing-publish-failed", artifactId, taskId, reason: error.message });
        return { step: "recheck-final-publish-failed", reason: error.message, artifactId };
      }
      return { step: "recheck-final-registered", artifactId };
    }
    default:
      appendAudit(dshHome, { type: "invocation-stage-unhandled", invocationId: manifest.invocationId, stage: manifest.stage });
      return { step: "stage-unhandled", artifactId };
  }
}

/** 读取 invocation parts（兼容 readInvocationParts 未导出时的产物路径）。 */
function readInvocationPartsForBinding(dshHome, manifest) {
  try {
    return JSON.parse(readFileSync(join(dshHome, "bots", "review", "invocations", manifest.invocationId, "parts.json"), "utf8"));
  } catch {
    return [];
  }
}

/**
 * 单次泵（tick）：过期回收 → 逐 invocation 执行 claim→runner→终态落盘；completed 走
 * 输出落工件/流程推进；recheck 与 R2 桥按 stage 分发。opts 可注入 runnerFactory 与
 * copyToUserFacing（测试隔离）。返回 {ran:[invocationId], errors:[]}。
 */
async function pumpReviewInvocations(ctx, api, opts = {}) {
  const dshHome = api.dshHome;
  const hostInstanceId = opts.hostInstanceId ?? reviewHostInstanceId();
  // F-RV-1：跨 tick in-flight 守卫（宿主任一时刻同一 invocation 只有一个有效 runner）。
  const inflight = opts.inflight ?? null;
  const ran = [];
  const errors = [];
  try {
    await expireStaleLeases(dshHome, { hostInstanceId, lockOpts: opts.lockOpts });
  } catch (error) {
    errors.push(`expireStaleLeases: ${error.message}`);
  }
  // F-RV-19：每 tick 补发缺失的 job dispatch（bot 实例上线后自动补齐签名 claim capability）
  try {
    backfillJobDispatches(dshHome);
  } catch (error) {
    errors.push(`backfillJobDispatches: ${error.message}`);
  }
  // F-RV-1：completed 成功处理打持久标记，防止跨 tick 重复推进/重复发布；
  // 显式失败步骤（envelope 无效等）不标记、确定性重试（fail closed）。
  const COMPLETED_FAILURE_STEPS = new Set([
    "completed-no-output-artifact", "output-unreadable", "envelope-invalid",
    "output-submit-failed", "r2-rejected"
  ]);
  const handledFileFor = (invocationId) =>
    join(dirname(invocationEventsFile(dshHome, null, invocationId)), "handled.json");
  const completeOnce = async (manifest, state) => {
    const handledFile = handledFileFor(manifest.invocationId);
    if (existsSync(handledFile)) return { already: true };
    const outcome = await handleCompletedInvocation(ctx, api, manifest, state, opts);
    if (outcome?.step && !COMPLETED_FAILURE_STEPS.has(outcome.step)) {
      try {
        mkdirSync(dirname(handledFile), { recursive: true });
        writeFileDurable(handledFile, `${JSON.stringify({ invocationId: manifest.invocationId, step: outcome.step, at: new Date().toISOString() })}\n`);
      } catch (error) {
        errors.push(`${manifest.invocationId} handled-marker: ${error.message}`);
      }
    }
    return { outcome };
  };
  for (const invocationId of listReviewInvocations(dshHome)) {
    let manifest;
    let state;
    try {
      manifest = readInvocationManifest(dshHome, null, invocationId);
      state = readInvocationState(dshHome, null, invocationId);
    } catch (error) {
      errors.push(`${invocationId}: ${error.message}`);
      continue;
    }
    if (!manifest || !state || !state.ok) {
      errors.push(`${invocationId}: manifest/state 不可用`);
      continue;
    }
    if (typeof inflight?.has === "function") {
      if (inflight.has(invocationId)) {
        ran.push(`${invocationId}:inflight-skip`);
        continue;
      }
      inflight.add(invocationId);
    }
    try {
      if (["completed", "dead-letter", "quarantined"].includes(state.status)) {
        if (state.status === "completed") {
          const handled = await completeOnce(manifest, state);
          if (handled.already) ran.push(`${invocationId}:already-handled`);
          else if (handled.outcome?.step) ran.push(`${invocationId}:${handled.outcome.step}`);
          else errors.push(`${invocationId}: 完成处理无步骤`);
        }
        continue;
      }
      try {
        const runnerFactory = opts.runnerFactory ?? ((m) => buildReviewRunner(ctx, api, m, {
          ...opts,
          invocationId: m.invocationId,
          hostInstanceId,
          heartbeatMs: opts.heartbeatMs ?? REVIEW_HEARTBEAT_MS,
          invokeHeartbeat: () => heartbeatInvocation(dshHome, {
            botId: m.targetReviewer,
            invocationId: m.invocationId,
            hostInstanceId,
            leaseMs: opts.leaseMs,
            lockOpts: opts.lockOpts
          })
        }));
        const result = await runInvocation(dshHome, {
          botId: manifest.targetReviewer,
          invocationId,
          hostInstanceId,
          runner: runnerFactory(manifest),
          leaseMs: opts.leaseMs,
          lockOpts: opts.lockOpts
        });
        ran.push(`${invocationId}:${result.status ?? "run"}`);
        // 同一 tick 内闭环：completed 输出立即落工件并推进流程（不等下一轮询）
        if (result.status === "completed") {
          const handled = await completeOnce(manifest, readInvocationState(dshHome, null, invocationId));
          if (handled.outcome?.step) {
            ran.push(`${invocationId}:${handled.outcome.step}`);
            // R2-10：final/recheck-final 落 user-facing 后广播七字段 review 通知（NOTIFY_KEYS）
            if (handled.outcome.step.startsWith("final-registered") || handled.outcome.step.startsWith("recheck-final-registered")) {
              try { emitReviewNotify(ctx, api, dshHome, manifest.taskId, handled.outcome.artifactId, manifest.stage); }
              catch (error) { errors.push(`${invocationId} notify: ${error.message}`); }
            }
          } else errors.push(`${invocationId}: 完成处理无步骤`);
        }
      } catch (error) {
        errors.push(`${invocationId}: ${error.message}`);
      }
    } finally {
      if (typeof inflight?.delete === "function") inflight.delete(invocationId);
    }
  }
  return { ran, errors };
}

/**
 * 评审主机监视器（仅主 web 实例启动，与 startMailNotifyMonitor 并列）：
 * WATCH_POLL_MS 轮询评审 invocation 并执行；completed 输出经 handleCompletedInvocation
 * 落工件/推进流程；可选 sseHub 广播 review 事件（七字段 NOTIFY_KEYS，R2-10）。
 */
function startReviewHostWatcher(ctx, api, opts = {}) {
  // F-RV-1：watcher 级 in-flight 守卫（跨 tick 共享；防止长 runner 与下一 tick 重叠）。
  const inflight = new Set();
  const tick = async () => {
    try {
      const outcome = await pumpReviewInvocations(ctx, api, { ...opts, inflight });
      if (outcome.errors.length > 0) {
        ctx.logger?.warn?.(`[dsh-bots] 评审泵错误：${outcome.errors.join(" | ")}`);
      }
    } catch (error) {
      ctx.logger?.warn?.(
        `[dsh-bots] 评审泵异常：${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
  void tick(); // 启动即泵一次（含过期回收）
  const timer = setInterval(() => void tick(), opts.pollMs ?? WATCH_POLL_MS);
  timer.unref?.();
  return () => {
    clearInterval(timer);
  };
}

//#endregion

// #region 评审只读/决策 API（R2-09/R2-10/R2-11 只读面）→ 机械抽取至 lib/review-http-api.js
// （2026-09-04 终版质量评审处置项③；行为不变）。HTTP 三助手注入式构造：
const reviewHttpApi = createReviewHttpApi({ json, routeSegments, readBody, createJobFromDecision });
const { queryValue, handleReviewApi, guessEngineeringBotId, getResultMetaFor } = reviewHttpApi;

//#region 评审 job 受信链（R2-11：decision→job 机械创建 + engineering 工具；三路径接线）

/**
 * host 侧受信链：authenticated user decision（choice=authorize-repair）机械创建
 * engineering job（P0.3 行 154-172）：参数全部取自 decision 记录（findingIds/scope/
 * acceptanceCriteria），调用方不得自由填参。repairCycle 缺省 = 该 task 既有 job 最大
 * repairCycle + 1。
 */
function createJobFromDecision(dshHome, { taskId, decisionRevision, engineeringBotId, repairCycle = null, lockOpts }) {
  let decision;
  try {
    const decisions = readDecisions(dshHome, taskId);
    decision = decisions.find((row) => row.revision === decisionRevision);
  } catch (error) {
    return { ok: false, reason: `decision store 不可读：${error instanceof Error ? error.message : String(error)}` };
  }
  if (!decision) return { ok: false, reason: `decision revision=${decisionRevision} 不存在（task ${taskId}）` };
  if (decision.choice !== "authorize-repair") return { ok: false, reason: `decision choice=${decision.choice} 未授权修复` };
  if (typeof engineeringBotId !== "string" || engineeringBotId === "") return { ok: false, reason: "engineeringBotId 必填" };
  // F-RV-3：job 的快照绑定只能来自 flow（host 解析，调用方不得自由填参）
  let sourceSnapshotId = null;
  try {
    const flow = readFlow(dshHome, taskId);
    sourceSnapshotId = flow?.sourceSnapshotId ?? null;
  } catch (error) {
    return { ok: false, reason: `flow 不可读（fail closed）：${error instanceof Error ? error.message : String(error)}` };
  }
  if (!sourceSnapshotId) {
    return { ok: false, reason: `flow 未锚定 sourceSnapshotId，无法创建 job（F-RV-3）：task ${taskId}` };
  }
  let cycle = repairCycle;
  if (cycle === null) {
    cycle = 1;
    try {
      const dir = jobsDir(dshHome);
      if (existsSync(dir)) {
        for (const name of readdirSync(dir)) {
          if (!name.endsWith(".json")) continue;
          try {
            const job = JSON.parse(readFileSync(join(dir, name), "utf8"));
            if (job?.taskId === taskId && Number.isInteger(job.repairCycle) && job.repairCycle >= cycle) {
              cycle = job.repairCycle + 1;
            }
          } catch { /* 单条坏记录不阻断；job 读取路径自有 fail-closed 校验 */ }
        }
      }
    } catch { /* 目录不可读按 cycle=1 处理并交由 createEngineeringJob 的锁内校验兜底 */ }
  }
  const created = createEngineeringJob(dshHome, {
    taskId,
    decisionRevision,
    authorizedFindingIds: [...decision.findingIds],
    scope: [...decision.scope],
    acceptanceCriteria: decision.acceptanceCriteria,
    engineeringBotId,
    repairCycle: cycle,
    sourceSnapshotId,
    lockOpts
  });
  if (created.ok) issueJobDispatch(dshHome, created.jobId, engineeringBotId);
  return created;
}

/**
 * F-RV-19 生产受信链·派发面：宿主（web host）为可领取 job 写入签名 claim capability
 * （jobs/<jobId>.dispatch.json）。bot 实例未注册/离线时签发失败 → 转 pending 留痕，
 * 由泵每 tick 的 backfillJobDispatches 在实例上线后补发。
 */
function issueJobDispatch(dshHome, jobId, engineeringBotId) {
  const file = join(jobsDir(dshHome), `${jobId}.dispatch.json`);
  try {
    const job = readJob(dshHome, jobId);
    if (!job) throw new Error("job 不存在或损坏");
    if (job.engineeringBotId !== engineeringBotId) throw new Error("dispatch bot 与 job.engineeringBotId 不一致");
    if (existsSync(file)) {
      let existing = null;
      try { existing = JSON.parse(readFileSync(file, "utf8")); } catch { /* replace only in a retryable job state */ }
      const claim = existing?.claim;
      const usable = existing?.jobId === jobId && existing?.botId === engineeringBotId && claim
        && isCapabilityCurrent(dshHome, claim)
        && !existsSync(nonceFileFor(dshHome, claim.payload.nonce));
      if (usable) return { ok: true, idempotent: true };
      appendAudit(dshHome, { type: "job-dispatch-replaced", jobId, botId: engineeringBotId, reason: "既有 dispatch 已消费、过期或无效" });
    }
    const claim = issueCapability(dshHome, { botId: engineeringBotId, operations: ["job.claim"], jobId });
    writeFileDurable(file, `${JSON.stringify({ jobId, botId: engineeringBotId, issuedAt: new Date().toISOString(), claim })}\n`);
    appendAudit(dshHome, { type: "job-dispatch-issued", jobId, botId: engineeringBotId });
    return { ok: true, idempotent: false };
  } catch (error) {
    appendAudit(dshHome, {
      type: "job-dispatch-pending", jobId, botId: engineeringBotId,
      reason: error instanceof Error ? error.message : String(error)
    });
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** 泵每 tick：为 created/requeued 且尚无 dispatch 件的 job 补发（bot 实例上线后自动补齐）。 */
function backfillJobDispatches(dshHome) {
  if (!existsSync(jobsDir(dshHome))) return;
  for (const name of readdirSync(jobsDir(dshHome))) {
    if (!name.endsWith(".json") || name.endsWith(".lease.json") || name.endsWith(".dispatch.json")) continue;
    const jobId = name.slice(0, -".json".length);
    let job;
    try { job = readJob(dshHome, jobId); } catch { continue; }
    if (!job || !["created", "requeued"].includes(job.status)) continue;
    issueJobDispatch(dshHome, jobId, job.engineeringBotId);
  }
}

/**
 * F-RV-19 生产 capability provider（在编码方 bot 进程内执行）：
 * - job.claim ← 宿主派发时写入的签名 dispatch capability（验签＋bot/job/operation/有效期绑定）；
 * - job.heartbeat / job.report ← 链式签发，仅当本 bot 持有效 lease（该 lease 只能经
 *   签名 claim 建立）；无有效前置一律返回 null → 工具如实拒绝。
 * secret 同 OS 用户可读为已登记残留风险（P6-4 前）。
 */
function productionJobCapabilityProvider(dshHome, botId, operation, jobId) {
  try {
    if (typeof jobId !== "string" || jobId === "") return null;
    if (operation === "job.claim") {
      const dispatch = JSON.parse(readFileSync(join(jobsDir(dshHome), `${jobId}.dispatch.json`), "utf8"));
      const claim = dispatch?.claim;
      if (dispatch?.jobId === jobId && dispatch?.botId === botId && claim
        && isCapabilityCurrent(dshHome, claim)
        && claim.payload?.botId === botId && claim.payload?.jobId === jobId
        && Array.isArray(claim.payload?.operations) && claim.payload.operations.includes("job.claim")
        && claim.payload?.expiresAt > Date.now()
        && !existsSync(nonceFileFor(dshHome, claim.payload.nonce))) {
        return claim;
      }
      return null;
    }
    if (operation === "job.heartbeat" || operation === "job.report") {
      if (!botHoldsActiveLease(dshHome, jobId, botId)) return null;
      return issueCapability(dshHome, { botId, operations: [operation], jobId });
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 三路径接线（P6-1，R2-11）：sessionWorkspace（bot 工作区）/workspaceRoot（sandbox 写
 * 边界，bot 显式登记）/registry.workspace（展示别名，只允许等于 workspaceRoot）。
 * 任一缺失 → 校验失败（无隐式回退）。
 */
function validateBotWorkspaceTriple(dshHome, bot) {
  return validateWorkspaceTriple({
    sessionWorkspace: workspaceDirFor(dshHome, bot?.id),
    workspaceRoot: bot?.workspaceRoot,
    registryWorkspace: bot?.workspace
  });
}

/**
 * engineering bot 实例的评审 job 工具（R2-11）：claim/heartbeat/report 只能经宿主受信
 * 调用链——工具闭包持有宿主签发的短期 HMAC capability（opts.capabilityProvider 注入，
 * 见 P0.2 行 94-98）；模型只见 token 不见 secret。默认无提供者 → 工具如实拒绝
 * （P6-4 实例派发授权后由宿主注入），绝不绕过 claimJob/reportFix 的签名校验。
 */
function registerReviewJobTools(ctx, api, botId, opts = {}) {
  const tools = ctx.get("tools");
  if (tools === undefined) return;
  const dshHome = api.dshHome;
  const capabilityProvider = opts.capabilityProvider ?? null;
  const held = async (operation, jobId) => {
    if (typeof capabilityProvider !== "function") {
      return { ok: false, reason: "宿主未注入 job capability（P6-4 派发授权后可用）" };
    }
    try {
      const capability = await capabilityProvider(operation, jobId);
      return capability ? { ok: true, capability } : { ok: false, reason: "宿主未签发 job capability" };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  };
  /** capability 绑定的 hostInstanceId（签发时注册表身份）。无 capability → null，绝不回落本进程 id（F-RV-2）。 */
  const boundHostInstanceId = (h) => (h.ok ? h.capability?.payload?.hostInstanceId ?? null : null);
  const toolBase = {
    parameters: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"] },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["claimed", "reported", "ok", "rejected"] },
          jobId: { type: "string" },
          note: { type: "string" }
        },
        required: ["status", "jobId"],
        additionalProperties: false
      },
      render: (_args, value) => [{ type: "text", text: `${value.status} ${value.jobId}${value.note ? `：${value.note}` : ""}` }]
    }
  };
  const registrations = [];
  registrations.push(tools.register({
    ...toolBase,
    name: "engineering_job.claim",
    description: "编码方认领分配给你的工程修复 job（jobId 由宿主派发通知提供）。claim 需要宿主签发的短期 capability；未签发/过期/伪造一律拒绝。同一 job 同一时间只有一个有效 claim。",
    async execute(args) {
      const jobId = String(args.jobId ?? "");
      const h = await held("job.claim", jobId);
      if (!h.ok) return { status: "rejected", jobId, note: h.reason };
      const result = claimJob(dshHome, { jobId, botId, hostInstanceId: boundHostInstanceId(h), capability: h.capability, lockOpts: opts.lockOpts });
      return result.ok
        ? { status: "claimed", jobId, note: `leaseUntil=${result.lease?.leaseUntil ?? "?"}` }
        : { status: "rejected", jobId, note: result.reason };
    }
  }));
  registrations.push(tools.register({
    ...toolBase,
    name: "engineering_job.heartbeat",
    description: "续期当前 job claim 的 lease（claim 后周期性调用，防止宿主回收）。每次续期必须持宿主新签发的 job.heartbeat capability；未持有/过期/伪造一律拒绝，不使用任何 hostInstanceId fallback（F-RV-2）。",
    async execute(args) {
      const jobId = String(args.jobId ?? "");
      const h = await held("job.heartbeat", jobId);
      if (!h.ok) return { status: "rejected", jobId, note: h.reason };
      const result = heartbeatJob(dshHome, {
        jobId, botId, claimOwner: botId, leaseMs: opts.jobLeaseMs,
        capability: h.capability, lockOpts: opts.lockOpts
      });
      return result.ok
        ? { status: "ok", jobId, note: `leaseUntil=${result.leaseUntil}` }
        : { status: "rejected", jobId, note: result.reason };
    }
  }));
  registrations.push(tools.register({
    ...toolBase,
    name: "engineering_job.report",
    description: "提交返修报告（生产提交通道，F-RV-3/F-RV-14）：body 为十字段 schema 的严格 JSON（FIX_REPORT_SCHEMA，10 必填字段，无结论类字段）；宿主受信链内落 fix-report 工件（authorBotId 恒为当前 bot，不能伪造 reviewer）并经 reportFix 关闭 job 后自动触发复检。findingIds/changedPaths 必须与正文逐项一致且落在 job 授权范围（job.scope/task/快照）内；越权拒绝。",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        body: { type: "string", description: "十字段 fix-report JSON（严格 JSON 文本）" },
        findingIds: { type: "array", items: { type: "string" }, description: "本报告覆盖的授权 F-编号（须与正文 inputFindingIds 一致）" },
        changedPaths: { type: "array", items: { type: "string" }, description: "实际修改路径（须与正文 changedFiles 一致且在 job.scope 内）" }
      },
      required: ["jobId", "body", "findingIds", "changedPaths"]
    },
    output: toolBase.output,
    async execute(args) {
      const jobId = String(args.jobId ?? "");
      const body = String(args.body ?? "");
      const findingIds = Array.isArray(args.findingIds) ? args.findingIds.map(String) : [];
      const changedPaths = Array.isArray(args.changedPaths) ? args.changedPaths.map(String) : [];
      // F-RV-22：同一已完成报告的重放不应先索取新 capability；先读 job，
      // 仅在非终态路径要求 job.report capability。
      const job = readJob(dshHome, jobId);
      if (!job) return { status: "rejected", jobId, note: "job 不存在或损坏" };
      const previousReport = job.status === "fix-reported"
        ? [...(job.events ?? [])].reverse().find((event) => event.type === "fix-reported")
        : null;
      if (previousReport) {
        let previousBody = null;
        try { previousBody = readFileSync(bodyFileFor(dshHome, previousReport.reportArtifactId), "utf8"); } catch { /* reportFix will fail closed */ }
        if (previousBody !== body) {
          return { status: "rejected", jobId, note: "fix-reported 已有不同正文，终态拒绝且不落新工件" };
        }
        const replay = reportFix(dshHome, {
          jobId, botId, fixReportArtifactId: previousReport.reportArtifactId,
          findingIds, changedPaths, capability: null,
          workspaceRoot: opts.jobWorkspaceRoot, lockOpts: opts.lockOpts
        });
        if (!replay.ok) return { status: "rejected", jobId, note: replay.reason };
        return {
          status: "reported", jobId,
          note: "fix-report 已接受（幂等重放）；复检推进：idempotent-replay（既有工件，不重复触发复检）"
        };
      }
      const preflight = validateFixReportSubmission(dshHome, {
        jobId, botId, body, findingIds, changedPaths,
        workspaceRoot: opts.jobWorkspaceRoot
      });
      if (!preflight.ok) return { status: "rejected", jobId, note: preflight.reason };
      const h = await held("job.report", jobId);
      if (!h.ok) return { status: "rejected", jobId, note: h.reason };
      let submitted;
      try {
        submitted = submitReviewArtifact(dshHome, {
          taskId: job.taskId,
          stage: "fix-report",
          authorBotId: botId,
          body,
          // F-RV-22：幂等键＝jobId＋正文哈希——同正文重试幂等返回既有工件；
          // 正文修正后为新键新工件，旧件成无害孤立件（终态防重不受影响）。
          sourceSnapshotId: job.sourceSnapshotId,
          idempotencyKey: `fix-report:${jobId}:${createHash("sha256").update(body, "utf8").digest("hex")}`
        });
      } catch (error) {
        return { status: "rejected", jobId, note: error instanceof Error ? error.message : String(error) };
      }
      if (!submitted || submitted.status === "quarantined") {
        return { status: "rejected", jobId, note: `fix-report 提交失败：${submitted?.status ?? "?"}` };
      }
      const result = reportFix(dshHome, {
        jobId, botId, fixReportArtifactId: submitted.artifactId, findingIds, changedPaths,
        capability: h.capability, workspaceRoot: opts.jobWorkspaceRoot, lockOpts: opts.lockOpts
      });
      if (!result.ok) {
        // The immutable artifact was written before the final lease/state gate;
        // quarantine it on rejection so failed attempts are never silent orphan
        // reports that look submit-able on a later retry.
        try { quarantineArtifact(dshHome, submitted.artifactId, `engineering_job.report rejected after artifact submit: ${result.reason}`, { jobId, botId }); } catch { /* preserve original rejection */ }
        return { status: "rejected", jobId, note: result.reason };
      }
      // F-RV-3/F-RV-22：首次接受后触发复检推进；幂等重放不重复触发
      let recheckStep = null;
      if (result.idempotent) {
        recheckStep = "idempotent-replay（既有工件，不重复触发复检）";
      } else {
        try {
          const advanced = advanceFixFlow(dshHome, {
            taskId: job.taskId, fixReportArtifactId: submitted.artifactId, engineeringBotId: botId
          });
          recheckStep = advanced?.step ?? null;
        } catch (error) {
          recheckStep = `advanceFixFlow:${error instanceof Error ? error.message : String(error)}`;
        }
      }
      return {
        status: "reported",
        jobId,
        note: `fix-report 已接受${result.idempotent ? "（幂等重放）" : ""}${recheckStep ? `；复检推进：${recheckStep}` : ""}`
      };
    }
  }));
  return registrations;
}

/** task-spec 工件在 invocation 输入集中必须唯一可定；否则返回 null（fail closed）。 */
function taskSpecArtifactIdFor(dshHome, manifest) {
  const specIds = (manifest?.artifactIds ?? []).filter((id) => {
    try { return readManifest(dshHome, id)?.stage === "task-spec"; } catch { return false; }
  });
  return specIds.length === 1 ? specIds[0] : null;
}

/**
 * F-RV-25 补修（payload binding 切片·provider 面）：弃用布尔包装——单次扫描取得
 * bound（currentClaimedInvocation），binding 全部取自同一对象（单源，含 probe 的
 * taskSpecArtifactId 从 bound.manifest.artifactIds 确定，不接受调用参数扩展授权
 * 范围）；binding 进入 canonical payload，HMAC 覆盖。无活态 claimed invocation →
 * null。lease 来源为宿主身份认证级信任，非密码学证明（L2 登记 P6-4）。
 */
function productionReviewerCapabilityProvider(dshHome, botId, operation) {
  try {
    if (!["evidence.read", "artifact.read", "evidence.probe"].includes(operation)) return null;
    const bound = currentClaimedInvocation(dshHome, botId);
    if (!bound) return null;
    const binding = {
      invocationId: bound.invocationId,
      taskId: bound.manifest.taskId,
      sourceSnapshotId: bound.manifest.sourceSnapshotId
    };
    if (operation === "evidence.probe") {
      const specId = taskSpecArtifactIdFor(dshHome, bound.manifest);
      if (!specId) return null;
      binding.taskSpecArtifactId = specId;
    }
    return issueCapability(dshHome, { botId, operations: [operation], binding });
  } catch {
    return null;
  }
}

/**
 * reviewer bot 实例的评审证据工具（F-RV-25）：review_read / review_search /
 * review_probe 只能经宿主受信调用链——工具闭包每次调用现取宿主链式签发的短期
 * HMAC capability（opts.capabilityProvider 注入，默认生产 provider）；模型只见
 * token 不见 secret。限额全数沿用 review-evidence 的 EVIDENCE_LIMITS，零旁路。
 * review_probe 的 registeredCommands 取自 task-spec 工件正文（工具侧验 manifest
 * stage/taskId/完整性后解析），模型不得自报——否则逐字登记白名单形同虚设。
 * 返修要点 7（方案 A 绑定，三工具统一）：以当前 claimed invocation 为锚——
 * manifest.targetReviewer == botId（扫描固有）、taskId == invocation.taskId、
 * cycleId == invocation.sourceSnapshotId、taskSpecArtifactId ∈ invocation.artifactIds；
 * 跨 task/cycle 访问一律拒绝。
 */
function registerReviewerEvidenceTools(ctx, api, botId, opts = {}) {
  const tools = ctx.get("tools");
  if (tools === undefined) return;
  const dshHome = api.dshHome;
  const capabilityProvider = opts.capabilityProvider
    ?? ((operation) => productionReviewerCapabilityProvider(dshHome, botId, operation));
  const held = async (operation) => {
    try {
      const capability = await capabilityProvider(operation);
      return capability ? { ok: true, capability } : { ok: false, reason: "宿主未签发 evidence capability（无活态 claimed invocation 或实例未注册）" };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  };
  // 返修（token 自身 binding 强制校验，副审条件二）：binding 缺失的 evidence
  // capability 一律拒绝（含历史/旧 token）；binding 与本次调用解析的 bound 全等
  // （两次扫描必须比较 invocationId——TOCTOU 收敛语义：token 与当前 claimed
  // invocation 不同源 → fail closed，下次调用重取新 token）。参数级检查保留第二层。
  const anchorFromToken = (capability, operation) => {
    const payload = capability?.payload;
    if (!payload || typeof payload !== "object" || !payload.binding) {
      return { ok: false, reason: "evidence capability 缺 payload binding（旧 token 或非受信签发），拒绝" };
    }
    const b = payload.binding;
    const bound = currentClaimedInvocation(dshHome, botId);
    if (!bound) return { ok: false, reason: "无活态 claimed invocation（token 与当前上下文不同源，fail closed）" };
    const expected = {
      invocationId: bound.invocationId,
      taskId: bound.manifest.taskId,
      sourceSnapshotId: bound.manifest.sourceSnapshotId
    };
    if (operation === "evidence.probe") {
      const specId = taskSpecArtifactIdFor(dshHome, bound.manifest);
      if (!specId) return { ok: false, reason: "task-spec 工件无法唯一确定（fail closed）" };
      expected.taskSpecArtifactId = specId;
    }
    for (const key of Object.keys(expected)) {
      if (b[key] !== expected[key]) {
        return { ok: false, reason: `capability binding.${key} 与当前 claimed invocation 不符（token=${b[key]}，当前=${expected[key]}）——fail closed，重取新 token` };
      }
    }
    return { ok: true, bound, binding: b };
  };
  const registrations = [];
  // 注意 output 必须包在 output: { schema, render } 键下——cordis loader 对工具
  // 声明做严格 schema 校验（真实 loader 拒绝平铺形状：本次 P7-5 首次拉起实证）。
  const outputBase = {
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["read", "searched", "probed", "rejected"] },
          cycleId: { type: "string" },
          note: { type: "string" },
          relPath: { type: "string" },
          byteLength: { type: "number" },
          content: { type: "string" }
        },
        required: ["status"],
        additionalProperties: false
      },
      render: (_args, value) => [{
        type: "text",
        text: value.content !== undefined
          ? `${value.status} ${value.cycleId}${value.relPath ? ` ${value.relPath}` : ""}\n${value.content}`
          : `${value.status} ${value.cycleId ?? ""}${value.note ? `：${value.note}` : ""}`.trim()
      }]
    }
  };

  registrations.push(tools.register({
    ...outputBase,
    name: "review_read",
    description: "读取评审证据快照中的单个文件（仅限本任务 cycle 的物化 source snapshot，路径必须在快照清单内；宿主受信 capability 校验，越权/伪造一律拒绝）。",
    parameters: {
      type: "object",
      properties: { cycleId: { type: "string" }, relPath: { type: "string" } },
      required: ["cycleId", "relPath"],
      additionalProperties: false
    },
    async execute(args) {
      const cycleId = String(args.cycleId ?? "");
      const relPath = String(args.relPath ?? "");
      const h = await held("evidence.read");
      if (!h.ok) return { status: "rejected", cycleId, note: h.reason };
      const anchor = anchorFromToken(h.capability, "evidence.read");
      if (!anchor.ok) return { status: "rejected", cycleId, note: anchor.reason };
      // 三工具对称（返修）：capability 本体消费型校验（HMAC/operation/expiry/slot/
      // 注册表身份/nonce 单次消费）——token 由 provider 每次现取，消费即弃。
      const checked = checkCapability(dshHome, { botId, operation: "evidence.read", capability: h.capability });
      if (!checked.ok) return { status: "rejected", cycleId, note: `capability 校验失败：${checked.reason}` };
      if (cycleId !== anchor.binding.sourceSnapshotId) {
        return { status: "rejected", cycleId, note: `cycleId 与 capability binding 不符（期望 ${anchor.binding.sourceSnapshotId}）` };
      }
      const result = scopedRead(dshHome, { cycleId, relPath });
      if (!result.ok) return { status: "rejected", cycleId, note: result.reason };
      return { status: "read", cycleId, relPath, byteLength: result.byteLength, content: result.content };
    }
  }));

  registrations.push(tools.register({
    ...outputBase,
    name: "review_search",
    description: "在评审证据快照内做大小写不敏感子串检索（文件名与内容；单文件超限跳过并计数）。仅限本任务 cycle 的物化快照；宿主受信 capability 校验。",
    parameters: {
      type: "object",
      properties: { cycleId: { type: "string" }, query: { type: "string" } },
      required: ["cycleId", "query"],
      additionalProperties: false
    },
    async execute(args) {
      const cycleId = String(args.cycleId ?? "");
      const query = String(args.query ?? "");
      const h = await held("evidence.read");
      if (!h.ok) return { status: "rejected", cycleId, note: h.reason };
      const anchor = anchorFromToken(h.capability, "evidence.read");
      if (!anchor.ok) return { status: "rejected", cycleId, note: anchor.reason };
      // 三工具对称（返修）：capability 本体消费型校验——与 read 同款。
      const checked = checkCapability(dshHome, { botId, operation: "evidence.read", capability: h.capability });
      if (!checked.ok) return { status: "rejected", cycleId, note: `capability 校验失败：${checked.reason}` };
      if (cycleId !== anchor.binding.sourceSnapshotId) {
        return { status: "rejected", cycleId, note: `cycleId 与 capability binding 不符（期望 ${anchor.binding.sourceSnapshotId}）` };
      }
      const result = scopedSearch(dshHome, { cycleId, query });
      if (!result.ok) return { status: "rejected", cycleId, note: result.reason };
      return { status: "searched", cycleId, note: `hits=${result.hits.length} skipped=${result.skipped} ${JSON.stringify(result.hits.slice(0, 20))}` };
    }
  }));

  registrations.push(tools.register({
    ...outputBase,
    name: "review_probe",
    description: "在评审证据快照的一次性副本内运行与任务登记逐字一致的探针命令（bwrap 沙箱、超时/输出限额）。命令必须已在 task-spec 工件正文的 registeredCommands 中逐字登记（工具自行读取并校验该工件，模型不得自报）；宿主受信 capability 校验。",
    parameters: {
      type: "object",
      properties: {
        cycleId: { type: "string" },
        taskId: { type: "string" },
        taskSpecArtifactId: { type: "string", description: "本任务 task-spec 工件 ID（invocation parts 已提供）" },
        command: { type: "string" },
        args: { type: "array", items: { type: "string" } },
        timeoutMs: { type: "number" }
      },
      required: ["cycleId", "taskId", "taskSpecArtifactId", "command", "args"],
      additionalProperties: false
    },
    async execute(args) {
      const cycleId = String(args.cycleId ?? "");
      const h = await held("evidence.probe");
      if (!h.ok) return { status: "rejected", cycleId, note: h.reason };
      const anchor = anchorFromToken(h.capability, "evidence.probe");
      if (!anchor.ok) return { status: "rejected", cycleId, note: anchor.reason };
      // 授权范围由 binding 单源确定（taskSpecArtifactId 取自 invocation 输入集，
      // 不接受调用参数扩展授权范围）；参数仅作一致性第二层校验。
      const taskId = String(args.taskId ?? "");
      if (taskId !== anchor.binding.taskId) {
        return { status: "rejected", cycleId, note: `taskId 与 capability binding 不符（期望 ${anchor.binding.taskId}，收到 ${taskId}）` };
      }
      const taskSpecArtifactId = anchor.binding.taskSpecArtifactId;
      if (args.taskSpecArtifactId !== undefined && String(args.taskSpecArtifactId) !== taskSpecArtifactId) {
        return { status: "rejected", cycleId, note: `taskSpecArtifactId 与 capability binding 不符（期望 ${taskSpecArtifactId}，不接受参数扩展授权范围）` };
      }
      // registeredCommands 单一事实源 = task-spec 工件正文（不得由调用方自报）
      let manifest;
      try { manifest = readManifest(dshHome, taskSpecArtifactId); }
      catch (error) { return { status: "rejected", cycleId, note: `task-spec 工件 manifest 不可读：${error.message}` }; }
      if (!manifest || manifest.stage !== "task-spec" || manifest.taskId !== taskId
          || !verifyArtifactIntegrity(dshHome, taskSpecArtifactId, manifest).ok) {
        return { status: "rejected", cycleId, note: "task-spec 工件绑定失败（stage/taskId/完整性）" };
      }
      let registeredCommands = null;
      try {
        const parsed = JSON.parse(readFileSync(manifest.bodyPath, "utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
            && Array.isArray(parsed.registeredCommands)) {
          registeredCommands = parsed.registeredCommands;
        }
      } catch { /* 非 JSON 正文 → 视为未登记 */ }
      if (!registeredCommands) {
        return { status: "rejected", cycleId, note: "任务未登记探针命令（task-spec 正文需含 registeredCommands）" };
      }
      const probe = runProbe(dshHome, {
        cycleId,
        registeredCommands,
        command: String(args.command ?? ""),
        args: Array.isArray(args.args) ? args.args.map(String) : [],
        timeoutMs: args.timeoutMs,
        capability: h.capability,
        botId
      });
      return {
        status: "probed",
        cycleId,
        note: `ok=${probe.ok} exit=${probe.exitCode} stdout=${probe.stdoutBytes}B stderr=${probe.stderrBytes}B elapsed=${probe.window?.elapsedMs ?? "?"}ms${probe.ok ? "" : ` reason=${probe.reason ?? "?"}`}`
      };
    }
  }));
  return registrations;
}

//#endregion

//#region 插件入口

/**
 * Cordis apply：保证注册表存在（空则初始化领队 bot 并顺手脚手架），
 * 清理遗留 stale pid，注册 /api/bots prefix 路由；
 * 若当前实例是某个已注册 bot（profile 名 == botId），额外启动 inbox 自动回复
 * watcher（主 web 不启动）。
 */
async function apply(ctx) {
  const dshHome = resolveDshHome();
  mkdirSync(join(dshHome, "bots", "inbox"), { recursive: true });
  mkdirSync(join(dshHome, "bots", "outbox"), { recursive: true });
  // 团队知识库（v1 MVP）：目录 + 默认模板就位（幂等、不覆盖用户模板）。
  ensureKnowledgeBase(dshHome);

  // F-RV-11 规划项落地：nonce 消费记录过期清理（30 天保留期；仅主进程启动时
  // 清扫一次，尽力而为——失败不致命，见 lib/review-capability.js 注释）。
  try {
    const swept = cleanupExpiredNonces(dshHome);
    if (!swept.ok) ctx.logger?.warn?.("[dsh-bots] nonce 过期清理扫描失败（不致命）");
    else if (swept.removed > 0) ctx.logger?.info?.(`[dsh-bots] nonce 过期清理：移除 ${swept.removed} 条`);
  } catch (error) {
    ctx.logger?.warn?.(`[dsh-bots] nonce 过期清理异常（不致命）：${error?.message ?? error}`);
  }

  // 注册表：损坏则移开重建；空则写入领队 bot。
  const registryFile = registryPath(dshHome);
  let registry;
  try {
    registry = readRegistry(dshHome);
  } catch (error) {
    const aside = `${registryFile}.corrupt-${Date.now()}`;
    ctx.logger?.error?.(`[dsh-bots] bots.json 损坏，已移开为 ${aside}：${error.message}`);
    try {
      renameSync(registryFile, aside);
    } catch {
      // 移开失败不致命
    }
    registry = {};
  }
  if (Object.keys(registry).length === 0) {
    registry[LEAD_BOT_ID] = createLeadBot(dshHome, new Date().toISOString());
    writeRegistryAtomic(dshHome, registry);
    ctx.logger?.info?.("[dsh-bots] 注册表为空，已初始化领队 bot（id=lead, port=3101）");
  }

  // 实时事件 hub：任何注册表/状态变更经 writeRegistry 广播 bots 事件给 SSE 连接。
  const sseHub = createSseHub();
  const api = new BotsApi(ctx, dshHome, sseHub);
  // P5-4：authenticated user principal 提供者（宿主无浏览器会话绑定 → 保持 null，
  // decision POST 因此恒 403 fail closed；测试/未来适配层可注入）。
  api.reviewPrincipalProvider = null;

  // 自动回复 watcher + send_mail 邮件工具：仅当当前实例是某个已注册 bot
  // （profile 名 == botId）时启动；主 web（profile=web）等非 bot 实例不启动。
  const botInstanceId = detectBotInstance(ctx, api);
  // 卫生②：实例启动 pid/时刻落盘——审计交叉验证（进程归属/重启/加载时刻），与 pid
  // 归属校验、部署时间线核对共用此工件；写失败不致命（只读宿主例外）。
  // F-RV-17/F-RV-19：实例行统一五字段 {botId,pid,startedAt,hostInstanceId,at}——每个
  // dsh 进程（web host 与 bot 实例）在 apply 自写一行自身身份，值均本进程自算、不接受
  // 外部传入；startedAt=进程启动时刻（重启必变）；hostInstanceId=`host-<本进程pid>`。
  try {
    mkdirSync(join(dshHome, "bots", "started"), { recursive: true });
    appendFileSync(
      join(dshHome, "bots", "started", "instances.jsonl"),
      JSON.stringify({
        botId: botInstanceId ?? "host",
        pid: process.pid,
        startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
        hostInstanceId: `host-${process.pid}`,
        at: new Date().toISOString()
      }) + "\n",
      "utf8"
    );
  } catch {
    // 启动工件写失败不致命
  }
  if (botInstanceId !== null) {
    ctx.effect(
      () => startInboxWatcher(ctx, api, botInstanceId),
      "dsh-bots: 自动回复 watcher"
    );
    ctx.effect(
      () => registerBotMailTool(ctx, api, botInstanceId),
      "dsh-bots: send_mail 工具"
    );
    ctx.effect(
      () => registerTeamPromptSection(ctx, api, botInstanceId),
      "dsh-bots: 团队提示段"
    );
    ctx.effect(
      () => registerKnowledgeTools(ctx, api, botInstanceId),
      "dsh-bots: 知识库工具"
    );
    const botEntry = api.readRegistry()[botInstanceId];
    if (botEntry?.group === "engineering") {
      // R2-11：编码方 job 工具（claim/heartbeat/report）——宿主受信调用链。
      ctx.effect(
        () => registerReviewJobTools(ctx, api, botInstanceId, {
          capabilityProvider: async (operation, jobId) =>
            productionJobCapabilityProvider(api.dshHome, botInstanceId, operation, jobId)
        }),
        "dsh-bots: 评审 job 工具"
      );
    }
    if (botEntry?.group === "review") {
      // F-RV-25：评审方证据工具（review_read/search/probe）——宿主受信调用链。
      ctx.effect(
        () => registerReviewerEvidenceTools(ctx, api, botInstanceId),
        "dsh-bots: reviewer evidence 工具"
      );
    }
  } else {
    // 邮件到达通知监视器：仅主 web 实例启动。bot 实例是邮件的写入方（inbox
    // watcher / send_mail / appendOutbox），向客户端报自己的写入没有意义，
    // 且多实例会产生重复广播；监视器轮询磁盘即可看见所有写入者。
    ctx.effect(
      () => startMailNotifyMonitor(ctx, api),
      "dsh-bots: 邮件到达通知监视器"
    );
    // 评审主机泵（R2-09）：仅主 web 实例执行 invocation（host 是 invocation/事件/
    // relay 的唯一写者；P0.1 明文：普通 handleIncoming 不是评审生产路径）。
    ctx.effect(
      () => startReviewHostWatcher(ctx, api, {}),
      "dsh-bots: 评审主机泵"
    );
    // bot 自启动（2026-09-04 用户需求）：宿主启动时未在线的注册 bot 跟随启动。
    // void 后台执行——不阻塞 apply/HTTP 就绪；语义与开关见 lib/bot-autostart.js
    //（enabled:false＝停用；autoStart:false＝仅退出跟随启动；DSH_BOTS_AUTOSTART=0 应急闸）。
    void autoStartBots(ctx, api);
  }

  // 领队脚手架：失败仅告警，且不阻塞 apply/路由注册——脚本路径最长 60s
  //（只有 lead 被编辑弹窗配了 name/role/model 字段后才走脚本；默认空字段走
  // 内置同步路径）。start() 每次都会重新脚手架，这里慢一点没有后果。
  const lead = api.readRegistry()[LEAD_BOT_ID];
  if (lead !== undefined) {
    void scaffoldBot(ctx, dshHome, lead).catch((error) => {
      ctx.logger?.warn?.(
        `[dsh-bots] 领队 bot 脚手架失败（仅告警）：${error instanceof Error ? error.message : String(error)}`
      );
    });
  }

  // 清理上次 host 运行遗留的 stale pid（进程已不在但注册表仍记录 pid）。
  api.reconcileStalePids();

  ctx.effect(() => {
    const ws = ctx.get("webServer");
    if (ws === undefined) {
      ctx.logger?.warn?.("[dsh-bots] webServer 服务不可用，跳过 /api/bots 路由注册");
      return;
    }
    return ws.register({
      kind: "prefix",
      path: API_PREFIX,
      // 返回 promise：webserver 会 await route.handler(req, res)，保证响应写完才返回
      handler: (req, res) => handleApi(req, res, api).catch((error) => {
        // 兜底：handleApi 内部已捕获绝大多数异常
        ctx.logger?.error?.("[dsh-bots] 未捕获的路由异常：", error);
        try {
          if (!res.headersSent) json(res, 500, { error: "internal error" });
          else res.end();
        } catch {
          // 连接可能已断开
        }
      })
    });
  }, "dsh-bots: /api/bots 路由");
}

//#endregion

export { apply, inject, name };

// 供测试 / 其他交付物使用的纯函数（不改变行为）。
export const internals = {
  allocatePort,
  appendMessage,
  BotsApi,
  appendOutbox,
  autoStartBots,
  selectBotsToAutoStart,
  buildPatchYamlBuiltin,
  bumpHealCount,
  computeStatus,
  createLeadBot,
  createMailMonitor,
  createSseHub,
  currentProfileId,
  detectBotInstance,
  emptyMailState,
  findSessionDirFor,
  handleIncoming,
  isReviewFlowMisdelivery,
  healSessionAndRetry,
  handleApi,
  isProcessAlive,
  isSessionCorruptError,
  pidMatchesBot,
  mailPreview,
  maxSeqInFile,
  nextSeq,
  outboxDirFor,
  parseTimestamp,
  permissionOf,
  registerBotMailTool,
  registerKnowledgeTools,
  registerTeamPromptSection,
  issueJobDispatch,
  backfillJobDispatches,
  productionJobCapabilityProvider,
  registerReviewerEvidenceTools,
  productionReviewerCapabilityProvider,
  botHoldsInvocationLease,
  intakeTaskSpec,
  readAllInboxLines,
  readOnlyOf,
  applyPermission,
  readConversation,
  readHealCount,
  readInbox,
  readLastMessage,
  readOutbox,
  readRegistry,
  resetHealCount,
  alignContextWindowForBot,
  resolveDshHome,
  runNativeAgentTurn,
  scaffoldProfileBuiltin,
  scanMailState,
  serializeBot,
  slugify,
  sseEndpoint,
  startInboxWatcher,
  startMailNotifyMonitor,
  // 评审主机泵（R2-09 生产接线）：
  buildReviewRunner,
  createJobFromDecision,
  emitReviewNotify,
  getResultMetaFor,
  handleCompletedInvocation,
  handleReviewApi,
  guessEngineeringBotId,
  listReviewInvocations,
  pumpReviewInvocations,
  registerReviewJobTools,
  validateFixReportSubmission,
  reviewHostInstanceId,
  startReviewHostWatcher,
  validateBotWorkspaceTriple,
  parseInvocationBinding,
  uniqueId,
  writeRegistryAtomic,
  yamlQuote
};
