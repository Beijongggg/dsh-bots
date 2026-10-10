/**
 * Pod（pod）—— DeepSeek Harness 的「机器人模式」(Bot Mode) host 端插件。
 *
 * 【分层架构图与增长约束（冻结 2026-09-04，终版质量评审处置项③）】
 * 本文件是宿主集成层（cordis apply/HTTP/SSE/子进程/工具注册的接线面），内部以
 * #region 分为 14 个区域；领域逻辑一律下沉独立模块（org/*／sentinel-*／
 * knowledge／mail／spawn-env／fs-hygiene／pid-bind 等 lib 模块，不含本文件与
 * shared.cjs）。已抽取先例：
 *   - 邮局区域（含路径助手/会话合并）→ lib/mail-plane.js（2026-09-04 bot 自
 *     启动批连带抽取）。
 * v1 评审业务面（review-*／双审建制／评审主机泵）已随 org-v2 03 号票整体退役。
 * 约束：新增功能优先落独立模块（如 bot-autostart 先例），本文件
 * 只做接线；本文件行数上限冻结为 4,300 行（现约 2,861）——增长触限即触发新一轮区域抽取。
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
 *     逐条调用本实例 DSH 的 session RPC 跑真实 agent 回合。**回复与消费记账
 *     全部经 host 中继落盘**（11 号票 `V-A4.4`：bot 侧无 inbox/outbox 直写路径，
 *     host 是唯一写者）——回合文本经 `_mail` 认证命令投回本实例 outbox，消费
 *     水位（receipts）／响应标记（responses）也由 host 落。来自其他 bot 的邮件
 *     自动回信到发件 bot 的 inbox；**自带 `replyTo` 锚的邮件＝回信，不再自动回
 *     路由**（防 ping-pong；`kind` 枚举与「`replyTo` ⟺ kind」约束已废止，关联键
 *     改 `taskId`）。主 web 不启动 watcher。
 *   - 邮件到达通知：主 web 实例内的监视器（startMailNotifyMonitor）以 1s 轮询
 *     所有注册 bot 的 inbox/outbox 目录，新邮件经 SSE `mail` 事件推送（仅主
 *     web 启动；bot 实例是邮件写入方，不监听自己的写入）。语义：outbox 新增
 *     回复与 inbox 新增任务邮件（bot→bot）通知；带 `replyTo` 锚的自动回信
 *     （协议流量）与 host 自身 POST /send 的写入（ownSends：botId→Set<seq>，
 *     精确 seq 匹配抑制）静默；瞬态读失败不重置基线（恢复后只报增量，不整史重放）。
 *   - mail.send 工具：bot 实例内注册的 agent 工具（ctx.tools.register，手工
 *     构造原始形状、零依赖），把邮件投到任意已注册 bot 的 inbox 或本实例
 *     outbox——bot→bot／bot→user 通信的发信侧；收信侧即上面的 inbox watcher。
 *     投递本身经 `_mail` 认证 host 命令（零 capability 门槛），bot 侧不落盘。
 *   - 团队知识库（v1 MVP，见 PROPOSAL-knowledge-base.md）：bot 实例注册
 *     knowledge_search 读取工具（读取面照旧；登记已随 org-v2 10 号票命令化为
 *     op-set 的 knowledge.register，写者只在 host 进程），读写
 *     $DSH_HOME/bots/knowledge/（index.jsonl 共享索引 + reports/<id>.md
 *     报告全文 + REPORT_TEMPLATE.md 标准模板）。收编 8-22（v1 内置席位
 *     `lead` ↔ 研究员）讨论收敛：「标准化报告模板 + 团队共享索引清单」为地基；明确不做
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
 *   GET    /api/bots/:id/trace       → {trace:[record], counters:{gap}}（?since=<seq>
 *                                     严格增量：只回 seq > since 的顶层记录）。
 *                                     会话事件里的工具调用投影（票 06 冻结形状：
 *                                     seq/time/callId/parentCallId?/name/argsRaw/
 *                                     state/outputText?/isError/errorText?/turn/step/
 *                                     subCalls[]）；PTC 内层归入信封 subCalls。
 *                                     双路同 stats（在线 session.history 优先 →
 *                                     离线读盘）；缺会话/损坏日志 → 空轨迹。
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
import { runHostContractProbe } from "./org/host-contract.js";
import {
  BOT_ERROR_PREFIX, DEFAULT_INBOX_LIMIT, USER_RECIPIENT,
  appendMessage, appendOutbox,
  inboxDirFor, maxSeqInFile, messageIdFor, messagesPathFor, nextSeq, outboxDirFor,
  parseJsonlLines, parseTimestamp, readAllInboxLines,
  readConversation, readConversationCached, readInbox, readLastMessage,
  readOutbox, receiptsDirFor, responseState
} from "./mail-plane.js";
import { autoStartBots, selectBotsToAutoStart } from "./bot-autostart.js";
import { createApiSecurity, isMutatingMethod, TOKEN_HEADER } from "./api-security.js";
import { createBotSupervisor } from "./bot-supervisor.js";
import { createSessionDriver } from "./session-driver.js";
import { createNativeSessionRpc } from "./native-session-rpc.js";
import { buildSpawnEnv } from "./spawn-env.js";
import { tightenPath, tightenBotTree } from "./fs-hygiene.js";
import { HOST_SERVICE_NAMES, profileIdFromBaseUrl } from "./host-services.js";
import { readStartTicks, pidIsSameGeneration, parseStartTicks } from "./pid-bind.js";
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
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// 会话统计推导层（官方移植件，独立模块便于跟随上游同步，见 lib/stats.js）。
import { deriveStats, offlineStats } from "./stats.js";
// L2 工具轨迹只读投影（pod 06 号票；形状冻结，消费者票 07 逐字依赖）。
import { projectTrace, offlineTrace } from "./trace-projection.js";
import {
  BOOTSTRAP_ANCHOR_POST,
  isBootstrapAnchorSeat,
  minimalRosterState,
  normalizePostField,
  ON_DEMAND_POSTS,
  renderPostPromptSegment,
  roleCardBySlug
} from "./org/role-cards.js";
import { planModelUpgradeEval } from "./org/durability.js";
// 任务台账面（org-v2 05 号票）：host 侧 append-only 事件日志＋单一写者；状态＝事件投影。
import { createTaskLedger } from "./org/task-ledger.js";
import { createCapabilityIssuer } from "./org/capability-issue.js";
// 验收判据执行面（org-v2 25 号票）：关闭前置现跑判据的注入件——台账本体不 import
// 探针／数据根，接线只此一处（与烟测同一工厂，免两份漂移）。
import { criterionRunnerInjection } from "./org/criterion-runner.js";
import { createLedgerAccessKit } from "./org/permissions.js";
import { createReviewFaceGate } from "./org/review-kit.js";
import { createLedgerHost, createLedgerHttpApi, startLedgerTicker } from "./org/ledger-host.js";
import { createCapabilityDelivery, listenForOrgCredential } from "./org/capability-delivery.js";
import { runFreshReview } from "./org/review-session.js";
import { sourceCodeDigest } from "./org/deployment-inventory.js";
import { createCutoverReadiness } from "./org/cutover-readiness.js";
// 宿主环境缝自检（39 号票）：`DSH_BOTS_HOST_URL` 缺失即响亮——归一化与
// spawn 段同源（`normalizeSeamOrigin`），判定产物随就绪面暴露为诊断字段。
import { checkHostEnvSeam, logHostEnvSeam, normalizeSeamOrigin } from "./org/host-env-seam.js";
// 邮件中继面（org-v2 11 号票 `V-A4.4`）：host 是投递面唯一写者——bot 侧经
// `_mail` 认证命令投递／汇报消费，mail-plane 写原语只在 host 进程内被调用。
import {
  createMailHttpApi, createMailRelay, createMailRejectionRecorder, hasRegisteredBot
} from "./org/mail-relay.js";
// bot 侧邮件通道腿（同上：投递／消费汇报经认证 host 命令；本模块不触文件系统）
import { createMailClient, MAIL_CHANNEL_UNAVAILABLE } from "./org/mail-client.js";
// 简报与派单面（org-v2 07 号票）：bot→host 组织命令通道＋岗位工具面注册。
import { createPostChannel } from "./org/post-channel.js";
import { registerPostTools } from "./org/op-set.js";

// 团队调研知识底座（v1 MVP：标准化报告模板 + 共享索引清单，见
// lib/knowledge.js 与 PROPOSAL-knowledge-base.md）。
import {
  deprecateReport,
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
  BOT_SETTINGS_HEADER,
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
const LOADED_SOURCE_DIGEST = sourceCodeDigest(join(PLUGIN_DIR, ".."));
/** HTTP 路由前缀（ws.register 的 prefix 路由）。 */
const API_PREFIX = "/api/bots";

/** 端口分配起点（bootstrap 锚点席位固定占此端口；13 号票锚点泛化）。 */
const BASE_PORT = 3101;

/** stop() 的 SIGTERM 宽限期，超时后 SIGKILL 兜底。 */
const STOP_GRACE_MS = 5000;
/** SIGKILL 后等待进程真正消失的时间。 */
const KILL_SETTLE_MS = 1000;
/** 调用 create-bot.cjs 的超时（防脚本挂起阻塞 apply/start）。 */
const SCAFFOLD_TIMEOUT_MS = 60000;
/** 子进程 stderr 滚动尾巴的最大字符数（排障用）。 */
const STDERR_TAIL_CHARS = 4096;
/** inbox watcher、原生 DSH turn 状态轮询间隔、邮件到达监视器轮询间隔。 */
const WATCH_POLL_MS = 1000;
/** B5：SSE 重放窗口 ledger 条数上限（有界内存环形淘汰；不做每客户端持久 ack）。 */
const SSE_LEDGER_LIMIT = 256;

/** 单次真实 agent turn 的最长等待时间。`DSH_BOTS_TURN_TIMEOUT_MS` 缝：正整数
 *  覆盖缺省 600s，经宿主 spawnOverrides 透传给实例（17 号票实验发现：长任务
 *  裸席被 600s 截断，回合口径与预登记预算口径错位——v2 code 臂在 2.9M token
 *  处被杀而预算尚余）。非正整数／非整数一律回落缺省（fail closed）。 */
export function resolveTurnTimeoutMs(env) {
  const raw = Number(env?.DSH_BOTS_TURN_TIMEOUT_MS);
  return Number.isInteger(raw) && raw > 0 ? raw : 10 * 60 * 1000;
}
const AGENT_TURN_TIMEOUT_MS = resolveTurnTimeoutMs(process.env);
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
  // B4-02：注册表含端口/pid/模型配置，写后幂等收紧 0600（顺带覆盖存量旧权限）。
  tightenPath(registryPath(dshHome));
}

/** 按创建时间稳定排序（次要键 id）。 */
function sortedBots(registry) {
  return Object.values(registry).sort(
    (a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || String(a.id).localeCompare(String(b.id))
  );
}

/**
 * bootstrap 锚点席位记录（org-v2 13 号票锚点泛化；`GLOSSARY.md`「bootstrap 锚点
 * 席位」词条）。v1 的内置席位（id `lead`）随形态退役——本函数建的是 **v2 锚点**：
 * 实例 id＝锚点岗位 slug（`duty-coordinator`），显示名与一句话职责取自岗位卡
 * （卡是唯一源，注册表 `role` 只是显示用快照），**home 岗位绑定落表**（`post` 字段，
 * 岗位段与工具面据此派生）。`bootstrapAnchor` 标记＝席位身份：不可删保护按标记判定，
 * **不按席位名字符串**（用户自建的同岗席位不享保护——锚点是席位不是岗位特权）。
 * 权限档保持 v1 内置席位的 `read-only`（统筹岗不实施工件；实例基底档属用户域，
 * 2026-09-20 用户裁定）。
 */
function createBootstrapAnchor(dshHome, now) {
  const card = roleCardBySlug(BOOTSTRAP_ANCHOR_POST);
  if (card === null) throw new Error(`bootstrap 锚点岗位「${BOOTSTRAP_ANCHOR_POST}」不在岗位卡契约面`);
  return {
    id: BOOTSTRAP_ANCHOR_POST,
    name: card.displayName,
    role: card.responsibility,
    post: BOOTSTRAP_ANCHOR_POST,
    bootstrapAnchor: true,
    modelProvider: "",
    model: "",
    permission: "read-only",
    readOnly: true,
    avatar: "",
    group: "",
    port: BASE_PORT,
    workspace: workspaceDirFor(dshHome, BOOTSTRAP_ANCHOR_POST),
    enabled: true,
    createdAt: now,
    lastActiveAt: now
  };
}

/**
 * 注册表自举（apply 装配面调用）：损坏表**重命名备份分支保留原样**（移开为
 * `<bots.json>.corrupt-<ts>`，移开失败不致命）；**空表**（含文件不存在、空文件）
 * → 写入 bootstrap 锚点席位；**非空表零触碰**（锚点只在整表空时自动出现，不注入
 * 也不改写）。返回当次注册表快照。
 */
function bootstrapRegistry(dshHome, logger) {
  const registryFile = registryPath(dshHome);
  let registry;
  try {
    registry = readRegistry(dshHome);
  } catch (error) {
    const aside = `${registryFile}.corrupt-${Date.now()}`;
    logger?.error?.(`[pod] bots.json 损坏，已移开为 ${aside}：${error.message}`);
    try {
      renameSync(registryFile, aside);
    } catch {
      // 移开失败不致命
    }
    registry = {};
  }
  if (Object.keys(registry).length === 0) {
    registry[BOOTSTRAP_ANCHOR_POST] = createBootstrapAnchor(dshHome, new Date().toISOString());
    writeRegistryAtomic(dshHome, registry);
    logger?.info?.(
      `[pod] 注册表为空，已初始化 bootstrap 锚点席位（id=${BOOTSTRAP_ANCHOR_POST}，值班统筹，port=${BASE_PORT}）`
    );
  }
  return registry;
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
 * 判重口径（37 号票 R1）：在册只认注册表自身字段——原型链继承名
 * （constructor/toString 等）不算占用，不再产生莫名的 `-2` 后缀。判重比读面
 * 的 hasRegisteredBot（hasOwn 且值非 undefined）**从紧**：自身字段即算占用
 * （含值恰为 undefined 的异形态，不覆写）。
 */
function uniqueId(registry, rawName) {
  const slug = slugify(rawName);
  const base = slug === "" ? `bot-${Date.now().toString(36)}` : slug;
  if (isIdAvailable(registry, base)) return base;
  let n = 2;
  while (!isIdAvailable(registry, `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** id 是否可分配：自身字段即占用（判重从紧，见 uniqueId 注释）。slug 字符集为
 *  [a-z0-9-]（回退 id 带 `bot-` 前缀），产物恒不可能为 `__proto__`——不会以
 *  赋值改原型的方式损坏注册表对象，无需额外保留字防护。 */
function isIdAvailable(registry, id) {
  return !Object.hasOwn(registry, id);
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
function computeStatus(bot, { pidIsSameGeneration: sameGeneration = pidIsSameGeneration } = {}) {
  const pid = bot.pid;
  if (!Number.isInteger(pid) || pid <= 0) {
    return { online: false, pid: undefined, startedAt: bot.startedAt, stale: false };
  }
  if (isProcessAlive(pid)) {
    // B4-03：signal-0 存在 ≠ 还是"我们 spawn 的那一个"——startTicks 不匹配
    // （pid 被复用）按陈旧处理；旧记录无绑定字段/读取失败退化为仅存在性判定。
    if (sameGeneration(pid, bot.pidStartTicks)) {
      return { online: true, pid, startedAt: bot.startedAt, stale: false };
    }
    return { online: false, pid, startedAt: bot.startedAt, stale: true };
  }
  return { online: false, pid, startedAt: bot.startedAt, stale: true };
}

function botUrl(bot) {
  return `http://127.0.0.1:${String(bot.port)}/`;
}

/** 清空注册表记录上的进程三联（pid/pidStartTicks/startedAt）——停止与陈旧清理共用。 */
function clearProcessRecord(record) {
  delete record.pid;
  delete record.pidStartTicks;
  delete record.startedAt;
}

//#endregion

// #region 邮局 → 整体抽取至 lib/mail-plane.js（2026-09-04；行为不变，同名导入）

//#region 脚手架

/**
 * 生成 cordis.patch.yml（persona / 模型 pin / provider 配置 / 权限裁剪 /
 * 插件自加载）。构建逻辑在 lib/shared.cjs（与脚本共用的单一事实源）；这里只负责
 * 把注册表 bot 记录映射成共享函数的参数。基底口径（官方默认 preset `standard`
 * 27 工具 ＋ `DSH_TOOLS_MODE=ptc` 呈现面；人物设定不裁）与死键清理说明见
 * lib/shared.cjs buildPatchYaml 注释。
 */
function buildPatchYamlBuiltin(dshHome, bot) {
  const settingsPath = join(dshHome, "profiles", bot.id, "settings.yaml");
  const patchPath = join(dshHome, "profiles", bot.id, "cordis.patch.yml");
  return buildPatchYamlShared({
    botId: bot.id,
    role: bot.role,
    provider: bot.modelProvider,
    model: bot.model,
    reasoningEffort: bot.reasoningEffort,
    permission: permissionOf(bot),
    workspace: bot.workspace ?? workspaceDirFor(dshHome, bot.id),
    settingsText: existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "",
    previousPatch: existsSync(patchPath) ? readFileSync(patchPath, "utf8") : ""
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
  const workspaceDir = bot.workspace ?? workspaceDirFor(dshHome, bot.id);
  // B4-02：目录新件显式 0700；无 mode 参数的文件（0644 落盘）与存量旧权限
  // 由本函数末尾的 tightenBotTree 幂等收回（脚本路径产物则由 scaffoldBot
  // 末尾的同款调用收回）。
  mkdirSync(profileDir, { recursive: true, mode: 0o700 });
  const manifestPath = join(profileDir, "package.json");
  writeFileSync(manifestPath, JSON.stringify({
    name: `dsh-profile-${bot.id}`,
    private: true,
    dependencies: {},
    // 与内置 web profile 模板一致：`dsh --profile <id> web` 需要 web-app bundle
    dsh: { profile: { bundles: BUNDLES } }
  }, null, 2) + "\n", "utf8");
  // 确保 per-bot settings.yaml 存在（幂等；绝不覆盖用户编辑）：它是全局
  // llm-pi-ai 段的同步落点（syncPiAiSection）与旧宿主的模型 pin 迁移源；当前宿主
  // 的配置一律以同目录 cordis.patch.yml 为准。初始内容只有说明注释（单一事实源
  // BOT_SETTINGS_HEADER），不写 `agent-presets:` 死段——0.2.0-rc.1 无 per-profile
  // settings.yaml 读者，bot 基底＝官方默认 preset `standard`（27 工具），人物设定
  // 不裁（见 lib/shared.cjs buildPatchYaml 注释）。
  const botSettingsPath = join(profileDir, "settings.yaml");
  if (!existsSync(botSettingsPath)) {
    writeFileSync(botSettingsPath, BOT_SETTINGS_HEADER, "utf8");
  }
  // 幂等同步全局 llm-pi-ai 段到 bot settings（bot 已有该段时跳过，绝不覆盖用户编辑）。
  if (syncPiAiSection(dshHome, bot.id)) {
    ctx?.logger?.info?.(`[pod] bot "${bot.id}" settings.yaml 已同步全局 llm-pi-ai 段`);
  }
  writeFileSync(join(profileDir, "cordis.patch.yml"), buildPatchYamlBuiltin(dshHome, bot), "utf8");
  const workspaceYamlPath = join(profileDir, "pnpm-workspace.yaml");
  if (!existsSync(workspaceYamlPath)) {
    writeFileSync(workspaceYamlPath, "packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n", "utf8");
  }
  mkdirSync(workspaceDir, { recursive: true, mode: 0o700 });
  // B4-02：builtin 新件（0644 落盘）与存量旧权限在此一并幂等收紧。
  tightenBotTree(profileDir, workspaceDir);
}

/** 同步执行 node <script>，收集输出，超时强杀；退出码非 0 抛错。 */
function runScript(ctx, args, { dshHome, timeoutMs = SCAFFOLD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const script = createBotScriptPath();
    let child;
    try {
      child = spawn(process.execPath, [script, ...args], {
        env: buildSpawnEnv(process.env, { DSH_HOME: dshHome }),
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
 *   bootstrap 锚点席位加载 → 仅告警）。
 * - 否则（脚本缺失 ENOENT，或必填字段有空值——锚点席位没有模型 pin 即属此类）→
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
        `[pod] bot "${bot.id}" 的 name/role/modelProvider/model 存在空值，跳过 create-bot.cjs，使用内置脚手架`
      );
    } else {
      ctx.logger?.warn?.(`[pod] create-bot.cjs 不存在（${script}），使用内置脚手架初始化 "${bot.id}"`);
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
      ctx.logger?.warn?.(`[pod] 无法运行 create-bot.cjs（ENOENT），使用内置脚手架初始化 "${bot.id}"`);
      scaffoldProfileBuiltin(dshHome, bot, ctx);
      return;
    }
    throw error;
  }
  // 脚本成功（主生产路径）：create-bot.cjs 以默认 umask 落盘（0755/0644），
  // 与 builtin 回退共用同一幂等收紧；ENOENT 回退的收紧在 scaffoldProfileBuiltin 内。
  tightenBotTree(profileDirFor(dshHome, bot.id), bot.workspace ?? workspaceDirFor(dshHome, bot.id));
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
        `[pod] 实时事件广播失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** 清理注册表里进程已不在但仍记录的 pid（上次 host 运行遗留）。 */
  reconcileStalePids() {
    const registry = this.readRegistry();
    let dirty = false;
    for (const bot of Object.values(registry)) {
      if (Number.isInteger(bot.pid) && bot.pid > 0 && computeStatus(bot).stale) {
        this.ctx.logger?.warn?.(`[pod] 清理遗留 pid ${bot.pid}（bot "${bot.id}"）`);
        clearProcessRecord(bot);
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
        clearProcessRecord(bot);
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
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    let status = computeStatus(bot);
    if (status.stale) {
      clearProcessRecord(bot);
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
    // home 岗位（org-v2 04 号票）：留空＝未绑岗位；非空必须是在册岗位 slug，否则 400
    //（fail closed——未知岗位落表会让岗位提示段静默缺失）。
    const postField = normalizePostField(body.post);
    if (!postField.ok) throw httpError(400, postField.error);
    const bot = {
      id,
      name: rawName,
      role: typeof body.role === "string" ? body.role : "",
      post: postField.post,
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
      this.ctx.logger?.info?.(`[pod] bot "${bot.id}" settings.yaml 已同步 agent-default-model`);
    }
    const fresh = this.readRegistry();
    if (hasRegisteredBot(fresh, id)) {
      // 罕见：await 间隙另一个请求占用了该 id（原型链名不算占用——只认自身字段）
      throw httpError(409, `bot "${id}" 已存在，请重试`);
    }
    // 端口竞争防护：脚手架 await 间隙（最长 60s）里其他并发 create 可能占用了
    // 同端口；端口不写进 profile（只进启动命令），事后重分配无副作用
    if (Object.values(fresh).some((other) => other.port === bot.port)) {
      bot.port = allocatePort(fresh);
    }
    // 37 号票 F1：预建 receipts 目录＝「实例诞生于新消费语义」的痕迹——未启动即
    // 收到首封邮件时，起始游标按零水位回放处置，不再被旧数据迁移基线吞没
    // （判定见 mail-plane initialMailCursor）。放在写注册表**之前**：mkdir 幂等、
    // 失败＝本次 create 500 且注册表未写（id 保留给重试），不得出现「在册但无
    // 痕迹」的实例（那会让首封重新暴露给迁移基线吞没）。
    mkdirSync(receiptsDirFor(this.dshHome, id), { recursive: true });
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
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    const portChanged = body.port !== undefined && Number(body.port) !== bot.port;
    // 改动前快照：changed 判定与「原在线」判定都用改动前的值（patch 不改 pid，
    // computeStatus 前后一致，但按设计在改动前判定）。
    const before = {
      modelProvider: bot.modelProvider,
      model: bot.model,
      reasoningEffort: bot.reasoningEffort ?? "",
      role: bot.role,
      post: bot.post ?? "",
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
    // home 岗位变更（org-v2 04 号票）：与 role 同走注册表写路径；未绑岗位用空串表达。
    if (body.post !== undefined) {
      const postField = normalizePostField(body.post);
      if (!postField.ok) throw httpError(400, postField.error);
      // bootstrap 锚点席位（13 号票）：home 岗位＝锚点岗位**不可改绑**（含清空）——
      // 改绑即等于拿掉锚点席位，与「锚点不可删」是同一不变量的两条路径。
      if (isBootstrapAnchorSeat(bot) && postField.post !== BOOTSTRAP_ANCHOR_POST) {
        throw httpError(400, `bootstrap 锚点席位的 home 岗位不可改绑（须保持 ${BOOTSTRAP_ANCHOR_POST}）`);
      }
      bot.post = postField.post;
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
    // home 岗位变了只需重启（岗位提示段在 bot 启动时注册），不需重脚手架。
    const postChanged = (bot.post ?? "") !== before.post;
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
        this.ctx.logger?.info?.(`[pod] bot "${bot.id}" settings.yaml 已同步 agent-default-model`);
      }
    }
    this.writeRegistry(registry);
    const result = { bot: serializeBot(this.dshHome, bot) };
    if (modelChanged) {
      // 升级例程①触发（org-v2 12 号票 `V-A7.4`）：指派落表后**自动登记**岗位评测
      // 任务——不依赖用户记得手动跑。未接线／未绑岗位等实况随结论件可见（不静默）。
      result.modelUpgradeEval = await this.registerModelUpgradeEval(bot, before);
    }
    if (portChanged) result.note = "端口已更新到注册表；请重启该 bot 使新端口生效";
    if (bot.enabled === false && wasOnline) {
      // B2：停用即停进程（此前 enabled=false 只拒新启动；wasOnline 用改动前判定）
      try {
        await this.stop(id);
        result.stopped = true;
        delete result.note;
      } catch (error) {
        this.ctx.logger?.warn?.(
          `[pod] 停用 "${id}" 后停止进程失败：${error instanceof Error ? error.message : String(error)}`
        );
        result.note = "已停用；但停止进程失败，请手动停止该 Bot";
      }
    }
    if ((changed || postChanged) && wasOnline && bot.enabled !== false) {
      // 原在线：重启进程让新模型/角色/岗位生效（stop 幂等；spawn 失败仅告警 + note）。
      let restarted = false;
      try {
        await this.stop(id);
        await this.spawnBot(bot);
        restarted = true;
      } catch (error) {
        this.ctx.logger?.warn?.(
          `[pod] bot "${id}" 更新后自动重启失败：${error instanceof Error ? error.message : String(error)}`
        );
        result.note = "模型/角色/岗位已更新；自动重启失败，请手动启动该 Bot";
      }
      if (restarted && portChanged) {
        // 端口随本次重启一并生效，去掉「请重启」提示避免矛盾。
        delete result.note;
      }
    }
    return result;
  }

  /**
   * 模型指派变更 → 台账自动登记 `class=duty` 岗位评测任务（org-v2 12 号票
   * `V-A7.4` ①触发）。登记面＝台账 host 的 `registerModelUpgradeEval`
   * （`lib/org/ledger-host.js`）；本方法只做「接线判定＋实况回报」：
   *   - 台账未接线（bot 实例进程、未装台账的测试环境）→ 显式告警，结论件标
   *     `wired: false`（**不假装登记成功**）；
   *   - 未绑 home 岗位／目标指派为空等跳过情形 → 结论件带 `reason` 并告警；
   *   - 登记失败不改写 patch 结论（注册表已写入＝指派已生效），实况随响应可见。
   */
  async registerModelUpgradeEval(bot, before) {
    const input = {
      botId: bot.id,
      post: bot.post ?? "",
      before,
      after: {
        provider: bot.modelProvider,
        model: bot.model,
        reasoningEffort: bot.reasoningEffort
      }
    };
    const host = this.ledgerHost;
    if (!host || typeof host.registerModelUpgradeEval !== "function") {
      const plan = planModelUpgradeEval(input);
      this.ctx.logger?.warn?.(
        plan.action === "register"
          ? `[pod] bot "${bot.id}" 模型指派已变更，但台账未接线：评测任务未登记（V-A7.4 ①触发落空）`
          : `[pod] bot "${bot.id}" 模型指派已变更：不登记评测任务（${plan.reason}）`
      );
      return { ...plan, registered: [], wired: false };
    }
    return { ...(await host.registerModelUpgradeEval(input)), wired: true };
  }

  /** DELETE /api/bots/:id：先尽力 stop，再从注册表删除；保留 profile/workspace/邮局目录。 */
  async remove(id) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    // bootstrap 锚点席位（org-v2 13 号票）不可删：保护按**席位标记**判定（不按席位名
    // 字符串）——「非空注册表必有锚点在场」由这条保证（岗位改绑的等价路径在 patch 里堵）。
    if (isBootstrapAnchorSeat(bot)) {
      throw httpError(400, "bootstrap 锚点席位（值班统筹）不可删除");
    }
    try {
      await this.stop(id);
    } catch (error) {
      this.ctx.logger?.warn?.(
        `[pod] 删除 "${id}" 时停止进程失败：${error instanceof Error ? error.message : String(error)}`
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
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    if (bot.enabled === false) throw httpError(400, `bot "${id}" 已禁用（enabled=false），无法启动`);
    const status = computeStatus(bot);
    if (status.online) {
      return { online: true, url: botUrl(bot), pid: bot.pid, startedAt: bot.startedAt, alreadyRunning: true };
    }
    await scaffoldBot(this.ctx, this.dshHome, bot);
    return this.spawnBot(bot);
  }

  /** 实际 spawn `dsh --profile <id> --port <port> --no-open`（不带 web 子命令：CLI 的 web 不接受父级 --profile，flags 直接透传）。 */
  spawnBot(bot) {
    return new Promise((resolve, reject) => {
      const bin = process.env.DSH_BOTS_DSH_BIN ?? "dsh";
      const url = botUrl(bot);
      // DSH_BOTS_HOST_URL 透传（07 号票 bot→host 组织命令通道的运维缝）：宿主
      // 进程若设了该变量即向下传给 bot 实例——bot 侧岗位工具面靠它定位 host
      // origin；未设＝通道休眠（bot 分支跳过注册并告警，fail loud 不静默降级）。
      // DSH_TOOLS_MODE=ptc（官方 web patch 的 tools.mode 环境缝）：组织工具的
      // 带点 op 名（task.intake 等）不符合供应商 ^[a-zA-Z0-9_-]+$ 名称模式
      // （2026-09-29 TK-20260929 HTTP 400）。PTC 呈现下模型只见 run_code 传输，
      // 原名工具保留在生成的 SDK 内；工具命名合同、岗位与任务权限面不变。
      // 【bot 基底显式口径（pod 10 号票，2026-10-09）】基底＝官方默认 preset
      // `standard`（27 工具）——patch 不写 agent-preset-registry 的 selectedDefault，
      // 无覆写即回落官方默认；呈现面＝本处无条件注入的 ptc 缝（含未绑岗位实例，
      // 见 tests/spawn-env.test.mjs 集成用例），不再靠 per-bot settings.yaml 的
      // `agent-presets:` 死段偶然对上。人物设定不裁：persona 经 system-prompt 原样
      // 注入，bot-nopersona 式「去 persona」从未生效。实测证据（仅对当前网关注效，
      // 不可外推 DeepSeek 官方直连）：opencode-go 带点名 200 接受／niko 400 拒绝。
      const spawnOverrides = { DSH_HOME: this.dshHome, DSH_WEB_URL: url, DSH_TOOLS_MODE: "ptc" };
      // 归一化经 `normalizeSeamOrigin`（39 号票）＝与宿主启动自检同一口径：纯空白
      // ／仅尾斜杠的值不当作「已设」，下传的是归一化后的 origin（宿主缺缝时此处
      // 不透传，席位侧照旧响亮）。此前此处自持一条 `typeof…!== ""` 规则，与自检
      // 对 `"   "` 的判定分叉——同一缝两处解析即两处漂移（11 号票复审 A2 同型）。
      const seamOrigin = normalizeSeamOrigin(process.env.DSH_BOTS_HOST_URL);
      if (seamOrigin !== "") spawnOverrides.DSH_BOTS_HOST_URL = seamOrigin;
      // DSH_BOTS_TURN_TIMEOUT_MS 透传（17 号票实验缝）：宿主设了即向下传——
      // 实例侧 AGENT_TURN_TIMEOUT_MS 靠它放长回合预算（resolveTurnTimeoutMs
      // 解析；非正整数回落 600s 缺省）。
      if (typeof process.env.DSH_BOTS_TURN_TIMEOUT_MS === "string" && process.env.DSH_BOTS_TURN_TIMEOUT_MS !== "") {
        spawnOverrides.DSH_BOTS_TURN_TIMEOUT_MS = process.env.DSH_BOTS_TURN_TIMEOUT_MS;
      }
      let child;
      try {
        child = spawn(bin, ["--profile", bot.id, "--port", String(bot.port), "--no-open"], {
          env: buildSpawnEnv(process.env, spawnOverrides),
          detached: false,
          stdio: ["ignore", "pipe", "pipe", "ipc"]
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
      const gen = this.supervisor?.begin(bot.id) ?? 0;
      const entry = { child, pid: undefined, startedAt: Date.now(), gen, stderrTail: () => stderrTailText };
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
            // B4-03：代际绑定（null＝此刻读不到 stat，回退存在性判定）。
            record.pidStartTicks = readStartTicks(child.pid);
            record.startedAt = entry.startedAt;
            record.lastActiveAt = new Date().toISOString();
            this.writeRegistry(registry);
          }
        } catch (error) {
          // 事件回调里同步抛错会变成 uncaughtException；注册表暂时不可读/写只降级为丢一次记录
          this.ctx.logger?.warn?.(
            `[pod] bot "${bot.id}" spawn 后写注册表失败：${error instanceof Error ? error.message : String(error)}`
          );
        }
        resolve({ online: true, url, pid: child.pid, startedAt: entry.startedAt });
        this.ledgerHost?.delivery?.attach(bot.id, child);
        // B2：readiness 观测链（spawn→identity→port→ready；不阻塞返回，代数栅栏防迟到探针）
        this.supervisor?.trackReadiness(bot.id, gen, bot.port);
      });

      child.once("exit", (code, signal) => {
        if (!spawned) return; // 从未成功 spawn（ENOENT 等），error 处理器已拒绝
        const current = this.processes.get(bot.id);
        if (current === entry) this.processes.delete(bot.id);
        try {
          const registry = this.readRegistry();
          const record = registry[bot.id];
          if (record !== undefined && record.pid === entry.pid) {
            clearProcessRecord(record);
            this.writeRegistry(registry);
          }
        } catch (error) {
          // 同上：exit 回调里抛错会变成 uncaughtException
          this.ctx.logger?.warn?.(
            `[pod] bot "${bot.id}" 退出后清理注册表失败：${error instanceof Error ? error.message : String(error)}`
          );
        }
        if (code === 0) {
          this.ctx.logger?.info?.(`[pod] bot "${bot.id}" 正常退出`);
        } else {
          this.ctx.logger?.warn?.(
            `[pod] bot "${bot.id}" 退出（code=${String(code)} signal=${String(signal)}）：${tail(entry.stderrTail(), 400)}`
          );
        }
        // B2：supervisor 退出事件（generation fencing／崩溃退避自愈；见 bot-supervisor.js）
        this.supervisor?.onExit(bot.id, entry.gen ?? 0, { code, signal });
      });
    });
  }

  /** POST /api/bots/:id/stop。 */
  async stop(id) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    // 三条陈旧路径共用收尾：清进程三联→落盘→回报 stale（各分支只负责守卫与告警）。
    const clearStale = () => {
      clearProcessRecord(bot);
      this.writeRegistry(registry);
      return { online: false, stale: true };
    };
    if (Number.isInteger(bot.pid) && bot.pid > 0 && !pidIsSameGeneration(bot.pid, bot.pidStartTicks)) {
      // B4-03：startTicks 不匹配＝pid 已被复用（即使复用者也是 dsh 进程）——绝不发信号。
      this.ctx.logger?.warn?.(`[pod] bot "${id}" 的 pid ${bot.pid} startTicks 不匹配（代际不符），按遗留清理`);
      return clearStale();
    }
    if (Number.isInteger(bot.pid) && bot.pid > 0 && !pidMatchesBot(bot.pid, id)) {
      // pid 已被无关进程复用：按 stale 处理，绝不向其发送信号
      this.ctx.logger?.warn?.(`[pod] bot "${id}" 的 pid ${bot.pid} 已不指向 dsh 进程，按遗留清理`);
      return clearStale();
    }
    const status = computeStatus(bot);
    if (status.stale) {
      return clearStale();
    }
    if (!status.online) return { online: false };
    // B2：标记有意退出（不触发崩溃自愈）＋预快照后裔树（主进程终止后清理）
    this.supervisor?.onStop(id);
    const descendants = this.supervisor?.snapshotDescendants(bot.pid) ?? [];
    const entry = this.processes.get(id);
    const graceful = await terminateProcess(entry?.child, bot.pid);
    this.processes.delete(id);
    await this.supervisor?.killDescendants(descendants);
    const fresh = this.readRegistry();
    const record = fresh[id];
    if (record !== undefined) {
      clearProcessRecord(record);
      record.lastActiveAt = new Date().toISOString();
      this.writeRegistry(fresh);
    }
    return { online: false, ...(graceful ? {} : { killed: true }) };
  }

  /**
   * POST /api/bots/:id/send（用户→bot 投递）。
   *
   * 11 号票 `V-A4.4`：**host 中继面是投递面唯一写入口**——用户面投递同样经
   * `mailRelay.send`（用户 principal 作投递者），本方法自身不再调 mail-plane 写
   * 原语。bot 实例不持有中继（`api.mailRelay` 只在 host 装配），故 bot 进程内
   * 即便命中本路由也 **fail closed**：bot 侧没有 mail 写面。
   */
  send(id, body) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    const text = typeof body.text === "string" ? body.text : "";
    if (text.trim() === "") throw httpError(400, "text 不能为空");
    // 投递者词表＝用户 principal ∪ 在册实例（host 无投递者身份，它只是写者）
    const from = typeof body.from === "string" && body.from.trim() !== "" ? body.from.trim() : USER_RECIPIENT;
    const relay = this.mailRelay;
    if (relay === undefined) {
      throw httpError(503, "邮件中继未接线（本实例不持投递写面：投递由 host 落盘）");
    }
    const receipt = relay.send({ from, to: id, text, at: body.at });
    if (receipt.ok !== true) {
      throw httpError(receipt.code === "mail-unknown-recipient" ? 404 : 400,
        `${receipt.code}：${receipt.reason ?? ""}`);
    }
    // 邮件到达监视器据此抑制本次自发写入的通知（精确 seq，见 ownSends 注释）。
    let owns = this.ownSends.get(id);
    if (owns === undefined) {
      owns = new Set();
      this.ownSends.set(id, owns);
    }
    owns.add(receipt.seq);
    bot.lastActiveAt = new Date().toISOString();
    this.writeRegistry(registry);
    return { delivered: true, seq: receipt.seq };
  }

  /** GET /api/bots/:id/inbox。 */
  inbox(id, limit) {
    const registry = this.readRegistry();
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    return { messages: readInbox(this.dshHome, id, limit) };
  }

  /** GET /api/bots/:id/messages：inbox + outbox 合并的完整会话历史（?since= 增量过滤）。 */
  messages(id, since) {
    const registry = this.readRegistry();
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
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
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
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
          `[pod] stats("${id}") 在线 RPC 失败，回退读盘：${error instanceof Error ? error.message : String(error)}`
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

  /**
   * GET /api/bots/:id/trace：把 bot 会话事件里的工具调用投影成**官方形状的记录**
   * （票 06 冻结形状，消费者票 07 逐字依赖），供 Pod 前端按回合渲染工具行。
   * 与 `stats` 同款双路：在线 RPC（`session.history`）优先 → 离线读盘
   * （lib/trace-projection.js::offlineTrace，复用多帧 zstd 解码与 mtime/size
   * 结果缓存）回落；`since` 为**严格增量水位**（只回 `seq > since` 的顶层记录，
   * 子调用随信封整体返回——信封序即其子调用的可见序）。
   * fail-closed：缺会话／损坏日志 → 空轨迹（不是 500）；无会话 → 空轨迹。
   * 投影与形状实现见 lib/trace-projection.js。
   */
  async trace(id, since = null) {
    const registry = this.readRegistry();
    const bot = registry[id];
    if (!hasRegisteredBot(registry, id)) throw httpError(404, `bot "${id}" 不存在`);
    const sessionId = readBotSessionId(this.dshHome, id);
    if (sessionId === null) return { trace: [], counters: { gap: 0 } }; // 尚无会话
    let projected = null;
    if (computeStatus(bot).online) {
      try {
        const history = await dshRpc(bot.port, "session.history",
          { sessionId, maxMessages: 2000 }, { rpcPrefix: `dsh-bots-${id}-trace` });
        const events = Array.isArray(history?.events)
          ? history.events.map((entry) => entry?.event ?? entry)
          : [];
        projected = projectTrace(events);
      } catch (error) {
        // 在线但 RPC 失败（webserver 未就绪 / 进程僵住）：降级走离线读盘，而不是 500
        this.ctx.logger?.warn?.(
          `[pod] trace("${id}") 在线 RPC 失败，回退读盘：${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    if (projected === null) {
      // 离线：读落盘日志（trace-projection.js 内含 mtime/size 结果缓存，轮询不重复解压）
      projected = offlineTrace(this.dshHome, workspaceDirFor(this.dshHome, id), sessionId);
    }
    return {
      trace: since === null ? projected.records : projected.records.filter((record) => record.seq > since),
      counters: projected.counters
    };
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
 * 解析 `?since=`（轨迹面的**严格增量水位**：非负整数 seq；缺省/非法 → null = 不过滤）。
 * 与 `querySince`（邮件/时间戳口径）分开：轨迹按 `seq` 增量，不是时间戳。
 */
function querySinceSeq(req) {
  try {
    const raw = new URL(req.url ?? "/", "http://dsh.local").searchParams.get("since");
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * 实时事件 hub：SSE 订阅者集合 + 命名事件广播。写失败的订阅者被移除（防坏连接
 * 拖垮后续广播）。subscribe 返回退订函数；close 清空所有连接。
 * B5 可重放：每次广播分配单调递增 eventId（SSE `id:` 行）并记入有界窗口 ledger
 * （SSE_LEDGER_LIMIT 条，超出淘汰最旧）；replayAfter 供重连补发判定——窗口内
 * 返回按序错过事件（可空＝无错过），非法/未知/超窗返回 null＝调用方发兜底
 * 全量刷新事件。不做每客户端持久 ack；落盘/跨重启重放不在本批。
 */
function createSseHub() {
  const subs = new Set();
  const ledger = []; // 重放窗口：{id, type, data} 按 id 升序，最旧在前
  let seq = 0; // 已分配的最大 eventId（心跳注释帧不走广播，不推进）
  const formatEvent = (evt) =>
    `id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt.data ?? {})}\n\n`;
  return {
    subscribe(res) {
      subs.add(res);
      return () => {
        subs.delete(res);
        try { res.end(); } catch (error) { /* 连接可能已断开 */ }
      };
    },
    broadcast(type, data) {
      const evt = { id: seq + 1, type, data };
      seq = evt.id;
      ledger.push(evt);
      if (ledger.length > SSE_LEDGER_LIMIT) ledger.shift();
      const frame = formatEvent(evt);
      for (const res of [...subs]) {
        try { res.write(frame); } catch (error) { subs.delete(res); }
      }
    },
    /**
     * 重放判定：last-event-id 落在窗口内（最旧保留 id−1 ≤ lastId ≤ seq）→ 按序
     * 补发列表（空数组＝什么都没错过，无感接实时）；非整数/未知未来 id（如服务
     * 重启序号重置）/淘汰断层 → null＝兜底 reload。
     */
    replayAfter(rawId) {
      const last = Number(rawId);
      if (!Number.isInteger(last) || last < 1 || last > seq) return null;
      const oldest = ledger.length > 0 ? ledger[0].id : seq + 1;
      if (last < oldest - 1) return null;
      return ledger.filter((evt) => evt.id > last);
    },
    formatEvent,
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
 * B5 重连重放：读浏览器 EventSource 原生回传的 Last-Event-ID——窗口内先按序补发
 * 错过事件再订阅接实时；超窗/未知/缺省（首连）发约定 reload 事件兜底，首连统一
 * 走全量刷新初始化（客户端现有刷新逻辑即初始化逻辑，不设第二套）。补发与订阅之间
 * 是同步代码，无广播间隙，不漏帧。
 */
function sseEndpoint(req, res, hub) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive"
  });
  res.write("retry: 3000\n\n");
  const missed = hub ? hub.replayAfter(req.headers["last-event-id"]) : null;
  if (missed === null) {
    res.write("event: reload\ndata: {}\n\n");
  } else {
    for (const evt of missed) res.write(hub.formatEvent(evt));
  }
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
  // B1：CSRF 令牌引导端点（GET 只读；跨站读取受 SOP 阻断）。置于门控之前——
  // 它是令牌来源，自身不得被门拦。未接线 apiSecurity（库直测）→ 404，与门控
  // 接线对称。下划线前缀同 _events 约定（不在 bot id 字符集）。
  const security = api.apiSecurity;
  if (segs.length === 3 && segs[2] === "_csrf") {
    if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
    if (!security) return json(res, 404, { error: "not found" });
    const issued = security.issue();
    return json(res, 200, { token: issued.token, expiresAt: issued.expiresAt });
  }
  // B1（2026-09-05）变更面 CSRF 令牌门控：apiSecurity 由宿主 apply 恒接线；未接线
  // （库直测）沿用旧行为。门位于一切副作用之前——403 时请求体未被消费、状态未变，
  // 客户端可安全「重取令牌重试一次」。错误码随 code 字段返回（统一错误码）。
  if (security && isMutatingMethod(req.method)) {
    const verdict = security.verify(req.headers[TOKEN_HEADER]);
    if (!verdict.ok) {
      return json(res, 403, {
        error: verdict.code === "csrf-token-required"
          ? "变更请求缺少 CSRF 令牌（GET /api/bots/_csrf 获取，头 x-dsh-bots-token 携带）"
          : "CSRF 令牌无效或已过期（GET /api/bots/_csrf 重取）",
        code: verdict.code
      });
    }
  }
  // SSE 实时事件流：独占协议（text/event-stream，长连接），不走 JSON 分发。
  // 路径用 `_events`（下划线不在 bot id 字符集内）：若用 `events` 会与 id="events"
  // 的 bot 详情（3 段 GET /api/bots/:id）冲突。
  if (segs.length === 3 && segs[2] === "_events") {
    if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
    return sseEndpoint(req, res, api.sseHub);
  }
  // 任务台账面：`_ledger` 下划线前缀（bot id 字符集不含 `_`，不与 id="ledger" 冲突）。
  if (segs.length >= 3 && segs[2] === "_ledger") {
    return handleLedgerApi(req, res, api);
  }
  // 邮件中继面（org-v2 11 号票）：`_mail` 下划线前缀（同 `_ledger` 约定）。
  if (segs.length >= 3 && segs[2] === "_mail") {
    return handleMailApi(req, res, api);
  }
  try {
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
      if (action === "trace") {
        if (req.method !== "GET") return json(res, 405, { error: `method ${req.method} not allowed` });
        return json(res, 200, await api.trace(id, querySinceSeq(req)));
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
      api.ctx.logger?.error?.(`[pod] ${req.method} ${req.url} 失败：`, error);
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
  // HF-CTX-SERVICES 适配层：baseUrl → profile id 的形状收敛在 lib/host-services.js
  const fromBaseUrl = profileIdFromBaseUrl(ctx);
  if (fromBaseUrl !== null && fromBaseUrl !== "") return fromBaseUrl;
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
    return hasRegisteredBot(registry, profileId) ? profileId : null;
  } catch (error) {
    ctx.logger?.warn?.(
      `[pod] 检测 bot 实例失败（profile=${profileId}）：${error instanceof Error ? error.message : String(error)}`
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
 * 调用当前 bot 实例自己的公开会话服务，创建持久 session 并提交真实 prompt。
 * 旧宿主无 sessionController 时保留 HTTP RPC；新服务失配不降回匿名 HTTP。
 * session id 保存到 bot workspace，重启实例后继续使用同一段上下文。
 * 协议本体（create→selectModel→prompt→轮询→提取）自 2026-09-07 起归
 * lib/session-driver.js；本函数＝持久会话政策 adapter（建会话即落盘——回合
 * 失败也续上下文，自愈流依赖此序）＋连续超时计数监督 adapter（包 rpc）。
 */
async function runNativeAgentTurn(ctx, dshHome, botId, text) {
  const workspace = workspaceDirFor(dshHome, botId);
  const statePath = join(workspace, ".dsh-bot-session.json");
  mkdirSync(workspace, { recursive: true });
  const sessionId = readBotSessionId(dshHome, botId); // null → 首次消息或损坏状态会创建新 session

  const bot = readRegistry(dshHome)[botId];
  if (!Number.isInteger(bot?.port)) throw new Error(`bot "${botId}" has no valid port`);
  const nativeRpc = createNativeSessionRpc(ctx, { timeoutMs: RPC_TIMEOUT_MS });
  // RPC 连续无响应计数：对 session.create/selectModel/prompt/history 统一生效；
  // 轮询循环里 history 连续超时达到上限会提前退出，而不是死等 AGENT_TURN_TIMEOUT_MS。
  let consecutiveRpcTimeouts = 0;
  const rpc = async (method, payload) => {
    let value;
    try {
      value = nativeRpc
        ? await nativeRpc(method, payload)
        : await dshRpc(bot.port, method, payload, { rpcPrefix: `dsh-bots-${botId}` });
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

  const driver = createSessionDriver({ rpc });
  const result = await driver.runPrompt({
    sessionId,
    cwd: workspace,
    model: { provider: bot.modelProvider, model: bot.model },
    text,
    timeoutMs: AGENT_TURN_TIMEOUT_MS,
    pollMs: WATCH_POLL_MS,
    errorLabel: "bot agent turn",
    onSessionCreated: (session) => writeFileAtomic(statePath, JSON.stringify({ sessionId: session }, null, 2) + "\n")
  });
  return result.text;
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
      `[pod] bot "${botId}" 会话自愈归档失败（seq=${String(message?.seq)}）：${error instanceof Error ? error.message : String(error)}`
    );
    return { healed: false, error };
  }
  ctx.logger?.warn?.(
    `[pod] bot "${botId}" 检测到会话损坏，已归档并重置（seq=${String(message?.seq)}）：${backupDir}`
  );
  try {
    // 状态文件已移走 → sessionId 为 null → runNativeAgentTurn 自动 session.create 新会话
    const retried = await runNativeAgentTurn(ctx, dshHome, botId, text);
    bumpHealCount(dshHome, botId);
    return { healed: true, text: `（检测到会话损坏，已自动归档并重置，本回复来自新会话）\n\n${retried}` };
  } catch (error) {
    bumpHealCount(dshHome, botId);
    ctx.logger?.warn?.(
      `[pod] bot "${botId}" 会话自愈重试失败（seq=${String(message?.seq)}）：${error instanceof Error ? error.message : String(error)}`
    );
    return { healed: false, error };
  }
}

//#endregion

//#region 自动回复与邮件协作（bot 实例侧）

/**
 * 把回复经 **host 中继**投回发件 bot 的 inbox（11 号票：bot 侧零直写，投递由 host
 * 落盘）。守卫：本封自带 `replyTo` ⇒ 它自己就是回信，**不再自动回路由**（防
 * ping-pong，v1 行为不变）；发件人未注册静默跳过；投递去重（同 replyTo 锚）由中继
 * 面判定，崩溃重放窗口不重复投递。投递失败只告警——不影响已落盘的 outbox 回复。
 */
async function routeReplyToSender(ctx, dshHome, botId, message, fromBot, replyText, mail) {
  if (!fromBot || Number.isInteger(message.replyTo)) return;
  try {
    if (readRegistry(dshHome)[message.from] === undefined) return;
    const receipt = await mail.send({
      to: message.from, text: replyText, replyTo: message.seq, taskId: message.taskId
    });
    if (receipt?.ok !== true) {
      ctx.logger?.warn?.(
        `[pod] bot "${botId}" 自动回信给 "${message.from}" 未达/被拒（${receipt?.code ?? "unknown"}）：本封已留 outbox，不降级直写`
      );
      return;
    }
    ctx.logger?.info?.(
      `[pod] bot "${botId}" 自动回信 → "${message.from}"（seq=${String(receipt.seq)}）`
    );
  } catch (error) {
    ctx.logger?.warn?.(
      `[pod] bot "${botId}" 自动回信给 "${message.from}" 失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 处理一条新到的 inbox 消息：真实调用 bot agent，回复与消费记账**全部经 host 中继**
 * 落盘（11 号票：bot 侧无 inbox/outbox 直写路径，host 是唯一写者）。回路由分流见
 * routeReplyToSender（带 `replyTo` 的回信不再回路由防 ping-pong）。
 *
 * at-least-once 顺序：`claim`（认领，host 落响应标记）→ 回合 → `send`（outbox 回复，
 * 按 `replyToMessageId` 幂等）→ `finalize`（终结标记＋receipt 水位）。通道任一步未达
 * 即返回 false：**不推进水位＝重启后重放**（最坏重复一次回合），回复幂等锚兜底不落
 * 重复；没有「本地直写」这条降级路（`V-A4.7`）。
 *
 * 返回值：`true`＝已到终态（含「已终结」跳过与自投递）；`false`＝通道未达，本拍止步。
 */
async function handleIncoming(ctx, dshHome, botId, message, mail) {
  if (message.from === botId) return true;
  // B3 幂等消费：已终结的响应直接跳过（重复投递/崩溃重放场景）；未认领则先
  // 向 host 落 claim（崩溃中断的重放允许继续——回复出口有幂等锚兜底）。
  const mid = messageIdFor(botId, message);
  const prior = responseState(dshHome, botId, mid);
  if (prior.state === "finalized") return true;
  if (prior.state === "none") {
    const claimed = await mail.claim({ messageId: mid, seq: message.seq });
    if (claimed?.ok !== true) {
      ctx.logger?.warn?.(
        `[pod] bot "${botId}" 认领 seq=${String(message.seq)} 未达（${claimed?.code ?? "unknown"}）：本拍不处理（无本地降级直写路径）`
      );
      return false;
    }
  }
  const fromBot = typeof message.from === "string" && message.from !== "" && message.from !== "user";
  // bot→bot 邮件带寄件人上下文前缀，让 agent 知道该面向谁处理/答复（回信锚在场＝回信）。
  const promptText = fromBot
    ? (Number.isInteger(message.replyTo)
      ? `[mail reply from bot "${message.from}"]\n\n${message.text}`
      : `[mail from bot "${message.from}"]\n\n${message.text}`)
    : message.text;

  /** 回复出口（成功／自愈成功／错误三态共用）：send → finalize；send 未达即不终结。 */
  const deliverReply = async (replyText, outcome) => {
    const sent = await mail.send({
      to: USER_RECIPIENT, text: replyText, replyToMessageId: mid, taskId: message.taskId
    });
    if (sent?.ok !== true) {
      ctx.logger?.warn?.(
        `[pod] bot "${botId}" 回复投递未达（${sent?.code ?? "unknown"}）：本拍不终结，留待重放`
      );
      return false;
    }
    const finalized = await mail.finalize({ messageId: mid, seq: message.seq, outcome });
    if (finalized?.ok !== true) {
      ctx.logger?.warn?.(
        `[pod] bot "${botId}" 消费终结未达（${finalized?.code ?? "unknown"}）：重启后按水位重放（回复幂等锚兜底）`
      );
    }
    return true;
  };
  try {
    const text = await runNativeAgentTurn(ctx, dshHome, botId, promptText);
    // 成功回合未触发自愈 → 会话健康，自愈计数清零
    resetHealCount(dshHome, botId);
    const replyText = text || "（bot 未返回文本）";
    if (await deliverReply(replyText, "replied") !== true) return false;
    ctx.logger?.info?.(
      `[pod] bot "${botId}" 完成真实回复（seq=${String(message.seq)}）：${tail(replyText, 80)}`
    );
    await routeReplyToSender(ctx, dshHome, botId, message, fromBot, replyText, mail);
    return true;
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
        const replyText = healed.text || "（bot 未返回文本）";
        if (await deliverReply(replyText, "replied") !== true) return false;
        ctx.logger?.info?.(
          `[pod] bot "${botId}" 会话自愈成功（seq=${String(message.seq)}）：${tail(replyText, 80)}`
        );
        await routeReplyToSender(ctx, dshHome, botId, message, fromBot, replyText, mail);
      } else {
        // 归档失败或重试失败：写 [bot error] 原文（不吞错）；计数已由自愈流程 +1
        if (await deliverReply(`${BOT_ERROR_PREFIX} ${detail}`, "error-replied") !== true) return false;
        ctx.logger?.warn?.(
          `[pod] bot "${botId}" 会话自愈失败（seq=${String(message.seq)}）：${detail}`
        );
      }
    } else {
      // 自愈未触发：原样错误回复；达到上限时在原文后附加人工处理提示（追加而非替换）
      const outboxText = healCapReached
        ? `${BOT_ERROR_PREFIX} ${detail}\n（自愈已达上限，需人工处理）`
        : `${BOT_ERROR_PREFIX} ${detail}`;
      if (await deliverReply(outboxText, "error-replied") !== true) return false;
      ctx.logger?.warn?.(`[pod] bot "${botId}" 回复失败（seq=${String(message.seq)}）：${detail}`);
    }
  }
  return true;
}

/**
 * `knowledge.register` 工具描述的基础句 + 现读 REPORT_TEMPLATE.md 嵌入其结构。
 * F-R4-1：第四轮「为拿模板而全盘 find」实测烧 5m05s 的根治——模型无需下文件
 * 系统找模板，注册时描述即带结构。**动态现读、每 apply/重启刷新一次、零漂移
 * 禁止静态内联**（模板是用户主权文件，ensureKnowledgeBase 幂等不覆盖；静态
 * 内联会制造「描述谎报模板」新账）。读不到/空模板 → 降级为纯基础描述，不阻塞
 * 注册（模板可能被用户临时移动，非死局）。
 *
 * 10 号票命令化后本函数仍活着：描述挂到 op-set 派生的 `knowledge.register` 工具上
 * （经 `registerPostTools` 的 `describeOp` 钩子织入），工具名变了、描述内容不许缩水。
 */
function buildRegisterDescription(dshHome) {
  const base = "把一份产出登记进团队共享知识库（命令化：登记由 host 进程执行，bot 无共享面直写通道）。必填 title（标题）、summary（3~5 句摘要）、body（报告全文 Markdown，建议按知识库模板 REPORT_TEMPLATE.md 的结构撰写：摘要/核心结论/引用来源/适合任务类型/复用来源）。可选 tags（2~5 个标签）、conclusions（可引用的条列结论）、sources（来源清单）、appliesTo（适合的任务类型）、task（任务溯源）、supersedes（本报告取代的旧报告 id，旧条目标记为已更新）、reused（本报告引用/复用了哪些历史报告 id）。同一份报告不要重复登记；新版本取代旧版时用 supersedes 而非另立两份；引用历史结论时务必填 reused（这是知识库复用率的观测点）。新报告若同时取代旧报告又沿用其部分结论（「取代且沿用」），supersedes 与 reused 可对同一旧 id 同时填——两者职责不同、互不排斥。入参置于 payload（如 {payload: {title, summary, body}}）。登记不构成任务完成依据；派单方在简报输出格式里以 promotion 预声明强制性时，本单产出须在任务关闭或归档流程内登记。";
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
 * 给 bot 实例注册团队知识库**读取**工具（knowledge_search；v1 MVP 见
 * PROPOSAL-knowledge-base.md）：「标准化报告模板 + 团队共享索引清单」的 bot 侧
 * 读口。写口（登记）已随 10 号票命令化为 op-set 的 `knowledge.register`
 * （`V-A4.5`：bot 无共享面直写通道，登记由 host 进程执行）——读取面照旧，
 * 故本函数仍在，且对**全部** bot 实例注册（含未绑岗位的 v1 形态实例）。
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
 *   - 与 mail.send 同一约束：经 ctx.get("tools") 在**注入了 tools 服务的子 ctx**
 *     上取用（服务名单一坐标＝host-services.js；装配面经 registerBotFacesOnReady
 *     的 inject 等待就绪后进入本函数），纯 web 宿主无工具服务时不注册。
 */
function registerKnowledgeTools(ctx, api, botId) {
  const tools = ctx.get(HOST_SERVICE_NAMES.tools);
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
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/**
 * 给 bot 实例注册岗位工具面（org-v2 07 号票；`V-A4.1` 派生注册的实例侧接线）：
 * 按 registry 的 home 岗位（`post` 字段）从 op-set 表派生注册，dispatch＝
 * bot→host 组织命令通道（`createPostChannel`）。三重休眠门（各自 fail loud）：
 * 无 tools 服务不注册（A 类静默降级面既有口径）；实例未绑 home 岗位不注册
 * （v1 形态实例照旧）；`DSH_BOTS_HOST_URL` 未设不注册（通道无 host origin
 * 可用——运维缝，13 号票自举 post 位实例时随部署配置点名）。简报不进系统
 * 提示段（`V-A4.3`）：契约经接单响应到达，提示段组装面无简报引用（扫描在
 * tests/org-op-set.test.mjs 把守）。
 */
function registerOrgTools(ctx, api, botId, mail, hostOrigin) {
  const tools = ctx.get(HOST_SERVICE_NAMES.tools);
  if (tools === undefined) return; // 无 agent 工具服务（如纯 web 宿主）→ 不注册
  const normalized = normalizePostField(api.readRegistry()[botId]?.post);
  const post = normalized.ok ? normalized.post : "";
  if (post === "") {
    ctx.logger?.debug?.(`[pod] bot "${botId}" 未绑定 home 岗位，跳过岗位工具面注册`);
    return;
  }
  // host origin 由装配面**解析一次**后传入（apply 同一处决定邮件通道是否接线）：
  // 两处各读 env 会让「通道休眠」的判定分叉（11 号票复审 A2）。
  const origin = typeof hostOrigin === "string" ? hostOrigin : "";
  if (origin === "") {
    ctx.logger?.warn?.(`[pod] bot "${botId}"（${post}）已绑岗位但 DSH_BOTS_HOST_URL 未设——组织命令通道休眠，岗位工具面未注册`);
    return;
  }
  const identity = listenForOrgCredential({ botId, sourceDigest: LOADED_SOURCE_DIGEST, logger: ctx.logger,
    onReady: () => dispatch.ready(), onReview: async (review, signal) => {
    const bot = api.readRegistry()[botId];
    return runFreshReview({ ctx, bot, cwd: bot.workspace ?? workspaceDirFor(api.dshHome, botId), review, signal,
      dispatch: createPostChannel({ origin, botId, credential: identity.get, review,
        probeCtx: { dshHome: api.dshHome, cwd: join(PLUGIN_DIR, "..") }, logger: ctx.logger }) });
  } });
  const dispatch = createPostChannel({
    origin,
    botId,
    credential: identity.get,
    probeCtx: { dshHome: api.dshHome, cwd: join(PLUGIN_DIR, "..") },
    logger: ctx.logger
  });
  // 邮件腿（11 号票 §E「全员基础工具＝mail.send＋…」）：投递**不经**组织命令面，
  // 走单独的 `_mail` 认证通道（零 capability 门槛、host 是投递面唯一写者）。
  const routed = (op, args) => (op === "mail.send"
    // 库级 fail closed 回执：装配路径不可达（origin 为空则整体不注册），供直调/
    // 回归使用；投递腿本身不经组织命令面（另走 `_mail` 面）。
    ? (mail === null
      ? Promise.resolve({ ok: false, code: MAIL_CHANNEL_UNAVAILABLE, reason: "邮件通道未接线（DSH_BOTS_HOST_URL 未设，fail closed）" })
      : mail.send(args))
    : dispatch(op, args));
  const disposers = registerPostTools({
    tools, post, dispatch: routed, logger: ctx.logger,
    // 知识登记工具的描述＝基础句＋现读模板（F-R4-1 在命令化后的延续形态）
    describeOp: ({ op, description }) =>
      (op === "knowledge.register" ? buildRegisterDescription(api.dshHome) : description)
  });
  return () => {
    identity.close();
    for (const dispose of disposers) dispose();
  };
}

/**
 * bot 实例三面（团队提示段／知识库工具／岗位工具面）的**服务等待注册**
 * （16 号票 ptc-r2，2026-09-29 真实面实证）：DSH_TOOLS_MODE=ptc 下官方 web
 * patch 的 tools 行等待 ptcRuntime 就绪，ctx.get("tools") 在 apply 时点可能
 * 取空——立即执行的 ctx.effect 会静默跳过注册，岗位工具面与 org-ready 引导
 * 随 PTC 切换整体丢失（audit 零签发行、通道行缺失）。改经官方 ctx.inject
 * 等待服务就绪后注册（回调收到注入该服务的子 ctx，ic.get(HOST_SERVICE_NAMES.tools)
 * 依 cordis 语义可取到服务）；**无该服务的宿主**（纯 web 无 agent 工具面）
 * 回调永不执行＝与原静默跳过语义等价。注册产生的 disposer 挂**子 ctx 的
 * effect**：服务提供方重启会使 inject 纤程卸载重跑回调，旧 disposer 须随
 * 子纤程释放，避免重复注册（挂父 ctx.effect 只覆盖插件整体卸载一维）。
 */
function registerBotFacesOnReady(ctx, api, botInstanceId, mail, hostOrigin) {
  ctx.inject([HOST_SERVICE_NAMES.systemPrompt], (ic) => {
    const dispose = registerTeamPromptSection(ic, api, botInstanceId);
    if (typeof dispose === "function") {
      ic.effect(() => dispose, "pod: 团队提示段（等待服务就绪）");
    }
  });
  ctx.inject([HOST_SERVICE_NAMES.tools], (ic) => {
    const disposers = [
      registerKnowledgeTools(ic, api, botInstanceId),
      registerOrgTools(ic, api, botInstanceId, mail, hostOrigin)
    ].filter((dispose) => typeof dispose === "function");
    if (disposers.length > 0) {
      ic.effect(() => () => { for (const dispose of disposers) dispose(); },
        "pod: 知识库＋岗位工具面（等待服务就绪）");
    }
  });
}

/**
 * 给 bot 实例注册「团队名单 + 协作协议 + 知识库」系统提示段，让自然语言
 * 委派与知识沉淀成为内置能力：agent 每个回合的系统上下文里都知道自己是谁、
 * 队友是谁（含角色与在线状态）、mail.send 协议怎么用——用户描述需求即可，
 * 无需声明工具与方式。
 *
 * 实现走官方 systemPrompt 服务：variable 提供器在**每次 prompt 组装时现读
 * 注册表**（名单永远新鲜：新建/删除/改名队友从下一回合自动生效，无需重启
 * 本 bot），section 文本经 {{变量}} 插值注入。与 tools 一样用 ctx.get
 * 响应式获取服务。注册表读失败时降级为占位文案，绝不拖垮 prompt 组装。
 */
function registerTeamPromptSection(ctx, api, botId) {
  const systemPrompt = ctx.get(HOST_SERVICE_NAMES.systemPrompt);
  if (systemPrompt === undefined) return; // 无 systemPrompt 服务（如纯 web 宿主）→ 不注册
  const rosterText = () => {
    try {
      const registry = api.readRegistry();
      const self = registry[botId];
      const mates = sortedBots(registry).filter((bot) => bot.id !== botId);
      const lines = [];
      lines.push(`你是「${self?.name ?? botId}」（id: ${botId}）${String(self?.role ?? "").trim() !== "" ? `，职责：${String(self.role).slice(0, 200)}` : ""}。`);
      if (mates.length === 0) {
        lines.push("当前没有其他队友；队友加入后你可以用 mail.send 与他们协作。");
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
      return "（队友名单暂时不可用；可用 mail.send 传 to: \"\" 查询收件人）";
    }
  };
  const disposers = [];
  // 岗位段（org-v2 04 号票）：本实例 home 岗位的岗位卡渲染派生——卡是唯一源，
  // 此处不硬编码任何岗位文本。注册表无 post 字段＝未绑岗位（v1 形态的实例），
  // 不注册也不臆造；post 非空但不在册＝响亮失败（记 warn 且不注册），不留静默降级。
  let homePost = "";
  try {
    homePost = String(api.readRegistry()[botId]?.post ?? "");
  } catch (error) {
    ctx.logger?.warn?.(
      `[pod] bot "${botId}" 读取注册表失败，home 岗位未知（岗位段不注册）：${error instanceof Error ? error.message : String(error)}`
    );
    homePost = "";
  }
  if (homePost !== "") {
    const card = roleCardBySlug(homePost);
    if (card === null) {
      ctx.logger?.warn?.(`[pod] bot "${botId}" 的 home 岗位 slug「${homePost}」不在岗位卡契约面（岗位段不注册）`);
    } else {
      disposers.push(systemPrompt.section({
        name: "dsh-bots:post",
        order: 19,
        text: renderPostPromptSegment(card)
      }));
    }
  }
  disposers.push(systemPrompt.variable("dsh_bots_team", rosterText));
  disposers.push(systemPrompt.section({
    name: "dsh-bots:team",
    order: 20,
    text: [
      "## 团队协作（内置邮局）",
      "{{dsh_bots_team}}",
      "",
      "协作协议：",
      "- 需要队友出力时用 mail.send（入参 {to, text, taskId?}）发邮件：to 填队友的 id 或名字（传空串只列名单不发送），text 写完整的任务、必要上下文与期望产出（对方只能看到这段正文）；taskId 填这张任务的 id 作关联键（邮件只是投递通道，不承载任务状态）。",
      "- 发完不必等待：队友处理后会自动回信，回信会自动开启你的下一个回合，届时再汇总、验收或继续分派。",
      "- 判断标准：适合队友专长的果断转交并在收到回信后向用户汇报结果；适合你亲自做的不要转交。",
      "- 委派必须自包含：对方只能看到你的正文，请把任务、必要背景、期望产出和验收标准一次写全，不要指望对方追问。",
      "- 转手不预填：转交任务时只给任务本身（主题/边界/口径/验收标准），不得预置对方的语义决定——不预填 reused/supersedes 具体 id 数组（是否复用/取代/双填由产出方按常驻规则自决）、不给 tags 建议、不写「本任务预期以 X 为主」「默认应沿用」类倾向句、不以「按常驻规则…除非…」句式软化常驻禁令；收到带预置的任务文本时，还原为任务本身派发，不沿用预置。",
      "- 回信只交结论：完成委托后，回复写清「做了什么 / 如何验证的 / 已知边界或残留风险」，不要复述中间过程。",
      "- 升级是一等动作：同一任务与队友往返三轮仍未收敛，或你判断事情超出自己的角色边界与权限，立即显式升级——以 [ESCALATE] 开头发邮件给值班统筹（bootstrap 锚点席位），正文用中文写明卡在哪里、已经试过什么、需要谁拍板。不要把升级混在正常进度汇报里。（你就是锚点席位时：直接在与用户的对话中说明，不用此前缀。）",
      "- 团队知识库：完成后用 knowledge.register 把产出登记进共享索引（入参置于 payload：{payload: {title, summary, body, ...}}；按模板结构：摘要/核心结论/引用来源/适合任务类型/复用来源；引用了历史结论必须填 reused，新报告取代旧报告填 supersedes；「取代且沿用」——新报告同时取代旧报告又沿用其部分结论——时 supersedes 与 reused 可对同一旧 id 同时填，两者职责不同、互不排斥）。谁产出谁登记，值班统筹验收。检索引导（开工前先查历史结论）只写在调研承载岗的岗位段里，不在此全员重复。",
      "- 冲突可见性：当一条指示与常驻协作/登记规则冲突时，无论按哪条执行，双方都须让冲突可见——执行方在回信或报告中显式注明冲突点与所循依据；派单方在下发覆盖指示时直接标注冲突点与依据。不静默覆盖任何一方，现场裁决留痕可复盘。"
    ].join("\n")
  }));
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/** B3 未消费积压回放上限（超出部分记 skipped-stale，防长期停机后 agent 风暴）。 */
const MAIL_BACKLOG_LIMIT = 100;

/**
 * 启动 bot 实例内的 inbox watcher：轮询 inbox/<botId>/messages.jsonl 的新增行，
 * 逐条触发自动回复（写入 outbox/<botId>/<timestamp>.jsonl）。
 *
 * - 只处理 seq 严格大于 lastSeq 的消息；**消费完成（host 已终结论）后才推进
 *   lastSeq**，通道未达则本拍止步、下拍重试（at-least-once）。
 * - B3 崩溃安全游标（11 号票后由 host 持有）：lastSeq 初值＝**host 侧 receipt 水位**
 *   （`mail.cursor()` → `mail-plane.initialMailCursor`，旧数据迁移基线也由 host 落
 *   inbox/<bot>/receipts/，保留 500 条按 mtime 淘汰）——bot 停机期间到达的邮件在
 *   重启后回放，不再丢失；回放时 offset 归零重读全文件按 seq 过滤。**bot 侧不再
 *   写 receipts／responses**：消费汇报经 `_mail` 认证命令回到 host 落盘（`V-A4.4`）。
 *   零 receipt 存量按新消费机制痕迹区分（37 号票 F1）：create 预建的 receipts
 *   目录／崩溃残留的 responses 标记在 → 回放（未启动即收到的首封、处理中断的
 *   首封都不被迁移基线吞没）；痕迹全无 → 旧数据迁移，存量不回放。
 *   积压超 MAIL_BACKLOG_LIMIT 条时仅回放最近一批，更旧的请 host 记
 *   `skipped-stale`（只记水位，不触发 agent）。
 * - 注册时 inbox 目录已存在（如 bot 重启）→ 上述 B3 游标语义；目录尚不存在 →
 *   保持探测，出现后才开始监听；此时文件里的都是本次进程从未见过的新消息
 *   （首条消息由 host 的 send() 创建目录），全量处理。
 * - 增量读取：维护「已消费字节 offset + 尾部未换行的原始字节 pending」游标，
 *   每 tick 只读新增字节，不重复解析整个文件；写一半的行留在 pending 里与
 *   下次读到的字节拼接（原始字节缓冲，多字节 UTF-8 字符跨读也不会损坏）；
 *   文件被截断/替换（size < offset）时重置游标并按初始化语义重新跳过存量。
 * - 返回 disposer（ctx.effect 使用；停止时清理定时器）。
 */

function startInboxWatcher(ctx, api, botId, mail) {
  const dshHome = api.dshHome;
  const inboxDir = inboxDirFor(dshHome, botId);
  const file = messagesPathFor(dshHome, botId);
  const logger = ctx.logger;

  let stopped = false;
  let started = existsSync(inboxDir);
  let cursorReady = false;
  let lastSeq = 0;
  let busy = false;
  let timer = null;
  // 增量读取游标（见函数头注释）；replay 时从 0 重读以回放未消费积压。
  let offset = 0;
  let pending = Buffer.alloc(0);

  /**
   * B3 游标（host 侧）：注册后首次扫描前问 host 要水位与回放判定——**取不到就不
   * 消费**（fail closed，无本地降级直写路径），下拍重试。决策时点与 v1 的
   * `initialMailCursor` 对齐：目录尚不存在时问，host 侧无文件即回 {lastSeq:0}，
   * 于是「目录出现后的首批消息」全量处理（fresh bot 的首封邮件不会被基线吞掉）。
   * 目录已存在且零 receipt 时同样不吞（37 号票 F1）：host 侧按 receipts 目录
   * （create 预建痕迹）与 responses 标记（崩溃残留）区分新旧——新语义痕迹在
   * 即回 {lastSeq:0, replay:true}，首封照常进入回合。
   */
  const ensureCursor = async () => {
    if (cursorReady) return true;
    const result = await mail.cursor();
    if (result?.ok !== true) {
      logger?.warn?.(
        `[pod] "${botId}" 起始游标未达（${result?.code ?? "unknown"}）：本拍不消费（无本地降级直写路径）`
      );
      return false;
    }
    cursorReady = true;
    if (!started) {
      lastSeq = 0;
      offset = 0;
      return true;
    }
    lastSeq = result.lastSeq;
    offset = existsSync(file) ? (result.replay ? 0 : statSync(file).size) : 0;
    logger?.info?.(
      `[pod] "${botId}" 起始游标（host 侧 receipt 水位）：lastSeq=${String(lastSeq)}` +
      `${result.replay ? "（回放停机积压）" : ""}` +
      `${result.baseline !== undefined ? `（旧数据迁移基线 ${String(result.baseline)}）` : ""}`
    );
    return true;
  };

  const scan = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      if (!existsSync(file)) return;
      const size = statSync(file).size;
      if (size < offset) {
        // 文件被截断/替换（异常场景）：重置游标，回到「跳过存量」的初始化语义
        logger?.warn?.(`[pod] "${botId}" inbox 文件变短（截断/替换），重新初始化读取游标`);
        offset = size;
        pending = Buffer.alloc(0);
        lastSeq = maxSeqInFile(file);
        return;
      }
      if (size === offset && pending.length === 0) return; // 无新字节
      // 消费中止时要回滚的字节游标：不回滚的话，中止后下一拍会因上面的
      // 「size === offset 早退」把未消费邮件**卡到进程重启**（通道恢复也不重读）
      const offsetBeforeRead = offset;
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
      let fresh = parseJsonlLines(data.subarray(0, lastNl + 1).toString("utf8"))
        .filter((msg) => Number.isInteger(msg.seq) && msg.seq > lastSeq);
      // B3 积压上限：超限的旧件记 skipped-stale 不触发 agent（receipt 水位越过）
      if (fresh.length > MAIL_BACKLOG_LIMIT) {
        const overflow = fresh.length - MAIL_BACKLOG_LIMIT;
        for (const stale of fresh.slice(0, overflow)) {
          // 只记水位：经 host 落 receipt（bot 侧零直写）；未达则下拍/重启再判
          const skipped = await mail.skip({ messageId: messageIdFor(botId, stale), seq: stale.seq });
          if (skipped?.ok !== true) {
            logger?.warn?.(
              `[pod] "${botId}" 积压跳过未达（seq=${String(stale.seq)}／${skipped?.code ?? "unknown"}）：水位未推进，留待重放`
            );
          }
        }
        fresh = fresh.slice(-MAIL_BACKLOG_LIMIT);
        logger?.warn?.(
          `[pod] "${botId}" 未消费积压超上限，仅回放最近 ${MAIL_BACKLOG_LIMIT} 条（${overflow} 条记 skipped-stale）`
        );
      }
      for (const msg of fresh) {
        if (stopped) return;
        // 消费完成（host 已结论＝水位已前进）才推进内存游标；通道未达则本拍止步
        if (await handleIncoming(ctx, dshHome, botId, msg, mail) === false) {
          // 本封不消费：字节游标回滚到本拍读前位置，邮件留在投递面等下拍重读
          // （已消费行由内存 lastSeq 过滤，重读不产生重复回合）；不继续扫本批
          // ——不按序越过未消费件。
          offset = offsetBeforeRead;
          pending = Buffer.alloc(0);
          logger?.warn?.(
            `[pod] "${botId}" seq=${String(msg.seq)} 未消费完成（通道未达）：本拍止步，字节游标已回滚、留待下拍重读`
          );
          return;
        }
        if (Number.isInteger(msg.seq) && msg.seq > lastSeq) lastSeq = msg.seq;
      }
    } catch (error) {
      logger?.warn?.(
        `[pod] "${botId}" inbox 扫描异常：${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      busy = false;
    }
  };

  const tick = async () => {
    if (stopped) return;
    if (!started && existsSync(inboxDir)) {
      started = true;
      logger?.info?.(`[pod] bot 实例 "${botId}" 开始监听 inbox（${inboxDir}）`);
    }
    if (await ensureCursor() !== true) return;
    await scan();
  };

  timer = setInterval(() => {
    void tick();
  }, WATCH_POLL_MS);
  timer.unref?.();
  void tick();

  logger?.info?.(
    `[pod] bot 实例 "${botId}"：inbox watcher 已注册（轮询间隔 ${WATCH_POLL_MS}ms）`
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
 *     带 `replyTo` 锚的自动回信（协议流量）静默；host 自身
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
        if (Number.isInteger(msg.replyTo)) continue;             // 自动回信（自带回信锚）：协议流量静默
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
        ctx.logger?.warn?.(`[pod] 邮件监视器读失败：${error}`);
      }
      if (events.length > 0) {
        api.sseHub?.broadcast?.("mail", { events });
      }
    } catch (error) {
      ctx.logger?.warn?.(
        `[pod] 邮件到达监视器扫描异常：${error instanceof Error ? error.message : String(error)}`
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

// 台账 HTTP 面（org-v2 05 号票）：读投影／通知投影／命令面（变更方法已被 CSRF 门控）。
const handleLedgerApi = createLedgerHttpApi({ json, readBody, routeSegments });
// 邮件中继 HTTP 面（org-v2 11 号票）：投递／消费汇报／起始游标（零 capability
// 门槛、actor 仍须认证；未接线＝404 fail closed，无 bot 侧降级直写通道）。
// `recordRejection`＝鉴权拒绝的台账留痕（`V-A4.7` 分支二）：台账从当次请求的 api
// 取（host 侧持有），不在模块级闭包 apply 状态。
const handleMailApi = createMailHttpApi({
  json, readBody, routeSegments,
  recordRejection: createMailRejectionRecorder() // 日志取 api.ctx.logger（回退注入 logger）
});

//#region 插件入口

/**
 * Cordis apply：保证注册表存在（损坏则移开重建；空则初始化 bootstrap 锚点席位
 * 并顺手脚手架），清理遗留 stale pid，注册 /api/bots prefix 路由；
 * 若当前实例是某个已注册 bot（profile 名 == botId），额外启动 inbox 自动回复
 * watcher（主 web 不启动）。
 */
async function apply(ctx) {
  const dshHome = resolveDshHome();
  // 投递面目录不在此预建（11 号票 `V-A4.4`）：mail-plane 的写路径按需 `mkdir -p`
  // 自己的目录，host 中继面写第一封邮件时自会建出 `bots/inbox/<botId>`——装配面
  // 预建容器目录会让 bot 进程也去动投递面路径（收口面不该有这条边）。
  // 团队知识库（v1 MVP）：目录 + 默认模板就位（幂等、不覆盖用户模板）。
  ensureKnowledgeBase(dshHome);

  // 注册表：损坏则移开重建；空则写入 bootstrap 锚点席位（v2 锚点＝值班统筹，
  // org-v2 13 号票锚点泛化——v1 内置席位 `lead` 随形态退役）。
  const registry = bootstrapRegistry(dshHome, ctx.logger);
  // 编制回报（13 号票 checklist「双席就绪自举」）：起步编制＝值班统筹＋实施者双席，
  // 其余岗位按需拉起。此行只报**编制实况**——切换批（16 号票）的编制就绪探针由此取
  // 可核输入；「就绪」本身＝门绿＋探针＋最小闭环 smoke，不止编制（规格 §I:524）。
  const roster = minimalRosterState(registry);
  ctx.logger?.info?.(
    `[pod] 编制：锚点席位（值班统筹）${roster.anchorPresent ? "在场" : "缺位"}；`
    + `起步双席${roster.minimalComplete ? "齐备" : `缺 ${roster.missing.join("／")}`}；`
    + `按需岗在场 ${roster.onDemandPresent.length}／${ON_DEMAND_POSTS.length}（${ON_DEMAND_POSTS.join("／")}）`
  );

  // 实时事件 hub：任何注册表/状态变更经 writeRegistry 广播 bots 事件给 SSE 连接。
  const sseHub = createSseHub();
  const api = new BotsApi(ctx, dshHome, sseHub);
  // B1（2026-09-05）：变更面 CSRF 令牌会话（apiSecurity 由宿主 apply 恒接线；
  // 未接线（库直测）沿用旧行为）。令牌会话见 lib/api-security.js。
  api.apiSecurity = createApiSecurity();
  // B2（2026-09-05）：bot 生命周期监督（崩溃退避自愈/readiness 观测/generation
  // fencing/后裔清理；语义见 lib/bot-supervisor.js）。宿主与 bot 实例都创建——
  // bot 实例不 spawn bot，监督体自然惰性。
  api.supervisor = createBotSupervisor({ api, logger: ctx.logger });

  // 自动回复 watcher + mail.send 邮件工具：仅当当前实例是某个已注册 bot
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
    // 邮件通道腿（11 号票 `V-A4.4`）：bot 侧投递与消费记账全部经 `_mail` 认证命令
    // 回到 host 落盘——**没有**「本地直写 inbox/outbox」这条降级路。通道未接线
    // （DSH_BOTS_HOST_URL 未设）即休眠：watcher 不启动（响亮 warn），不接受静默降级。
    // 归一化经 `normalizeSeamOrigin`（39 号票）＝与宿主侧启动自检**同一条口径**：
    // 同一缝两处各写一份解析会让「缝是否在位」的判定分叉（11 号票复审 A2 同型）。
    const hostOrigin = normalizeSeamOrigin(process.env.DSH_BOTS_HOST_URL);
    const mail = hostOrigin === ""
      ? null
      : createMailClient({ origin: hostOrigin, botId: botInstanceId, logger: ctx.logger });
    if (mail === null) {
      ctx.logger?.warn?.(
        `[pod] bot "${botInstanceId}" DSH_BOTS_HOST_URL 未设：邮件通道休眠——inbox watcher 不启动、mail.send 工具休眠（bot 侧零直写，无本地降级路径）`
      );
    } else {
      ctx.effect(
        () => startInboxWatcher(ctx, api, botInstanceId, mail),
        "pod: 自动回复 watcher（host 中继）"
      );
    }
    registerBotFacesOnReady(ctx, api, botInstanceId, mail, hostOrigin);
  } else {
    // 宿主环境缝启动自检（39 号票；观察项 2026-10-07「手工启动宿主 ⇒ 组织通道
    // 静默休眠」）：宿主是席位的**唯一** spawn 者，本进程 env 缺
    // `DSH_BOTS_HOST_URL` 即意味着**全部**席位拿不到 host origin。席位侧照旧
    // 各自响亮（registerOrgTools 早退 warn／邮件通道 warn），但那两条 warn 落在
    // 子进程 logger 上，而宿主丢弃子进程 stdout、stderr 只留尾部缓冲——台面上
    // 只看得见「席位在线、组织面全静默」。此处是该静默上宿主台面的唯一缝。
    // 判定是**诊断字段**（V-A6.4 同口径：不作门、不进 readiness.ok），产物喂给
    // 下面的就绪面，不在第二处重读 env。
    const hostEnv = logHostEnvSeam(ctx.logger, process.env);
    // 邮件到达通知监视器：仅主 web 实例启动。bot 实例是邮件的写入方（inbox
    // watcher 与 mail.send 的投递都由 host 落盘），向客户端报自己的写入没有意义，
    // 且多实例会产生重复广播；监视器轮询磁盘即可看见所有写入者。
    ctx.effect(
      () => startMailNotifyMonitor(ctx, api),
      "pod: 邮件到达通知监视器"
    );
    // 任务台账（org-v2 05 号票；鉴权与签发联动＝06 号票）：**仅主 web 实例构造**
    // ——台账是 host 侧 append-only 事件日志、单一写者（写锁＋epoch fencing 在台账
    // 模块内）；bot 实例不构造台账、无台账文件直写通道，读投影走 /api/bots/_ledger
    // （GET）。命令面装 06 号票鉴权三元组（post 须持 host 签发 capability 信封；
    // user＝CSRF 通道认证的台账全权），assign 转移点签发＋每个授权有效且信封已
    // 消费的 post 命令续签联动经 dispatchCommand（返回件携带下一张能力，不经 mail；
    // 含「授权通过而命令被拒」的常态拒绝——21 号票 ①）。
    const postForBot = (botId) => api.readRegistry()[botId]?.post ?? null;
    const capabilityIssuer = createCapabilityIssuer({ dshHome });
    // 权限装配件（23 号票③）：{issuer, postForBot, logger} 在鉴权器/dispatcher/
    // 宿主接线三处结伴——一处装配、成套取出，不再逐处重列
    const access = createLedgerAccessKit({ issuer: capabilityIssuer, postForBot, logger: ctx.logger });
    const v2Ledger = createTaskLedger({
      dshHome,
      authorize: access.authorize,
      // 复核报告的帽验签（27 号票）：台账腿＝**权威门**（报告是事实源事件一条，
      // 唯一写者门口必须验凭据）＋复核面**唯一消费点**。同一签发面同时给
      // reviewGate（入口预筛，不消费帽）——两处共用一条「什么算持帽」的口径。
      reviewHat: capabilityIssuer,
      // 关闭前置的验收判据现跑（25 号票）：执行面注入件——`dshHome` 由台账本体补
      // （与产出登记面同一数据根），`cwd` 指向插件根以便 `node.tests` 类判据在
      // 真仓内跑（沙箱快照仍由探针模块自理：整树副本＋隔离子进程）。
      ...criterionRunnerInjection({ cwd: join(PLUGIN_DIR, "..") })
    });
    capabilityIssuer.bindLedger(v2Ledger); // 吊销投影腿绑定同门面（构造顺序解耦）
    // 复核面 gate（08 号票）：移交件读／报告提交的**入口预筛**（不消费帽；
    // 消费点与权威判定在台账腿）。issuer 一并挂 host——路由侧续签帽签发用。
    api.ledgerHost = createLedgerHost({
      ledger: v2Ledger,
      probeHostContract: () => runHostContractProbe({ repoRoot: join(PLUGIN_DIR, ".."), dshHome }),
      reviewGate: createReviewFaceGate({ issuer: capabilityIssuer, ledger: v2Ledger }),
      issuer: capabilityIssuer,
      dispatchCommand: access.createDispatcher(v2Ledger),
      // 知识登记命令化（10 号票 `V-A4.5`）：宿主侧执行面——与台账同一张能力鉴权门
      // （op∈availableOps(home, 信封)），执行体在 **host 进程内**调 registerReport。
      // bot 侧因此没有共享面写通道；未授权＝403、未接线＝503，两条路都 fail closed。
      // 索引锁争用留痕（36 号票 A9）：等待超阈／接管／超时经 ctx.logger 单行落账
      // （不落新文件面——知识库根顶层级是封闭枚举，禁第三面）。
      authorizeCommand: access.authorize,
      knowledgeRegister: ({ op, payload, botId: submitter }) =>
        (op === "knowledge.deprecate"
          ? deprecateReport({ dshHome, id: payload.id, reason: payload.reason, logger: ctx.logger })
          : registerReport({ dshHome, botId: submitter, input: payload, logger: ctx.logger })),
      readBotIds: () => Object.keys(api.readRegistry()),
      isAlive: (botId) => {
        const bot = api.readRegistry()[botId];
        return bot === undefined ? false : computeStatus(bot).online === true;
      },
      broadcast: (type, data) => sseHub.broadcast(type, data),
      logger: ctx.logger
    });
    api.ledgerHost.delivery = createCapabilityDelivery({
      host: api.ledgerHost, readRegistry: () => api.readRegistry(), logger: ctx.logger
    });
    api.ledgerHost.readiness = createCutoverReadiness({
      host: api.ledgerHost, readRegistry: () => api.readRegistry(), sourceDigest: LOADED_SOURCE_DIGEST,
      // 宿主环境缝判定（39 号票）：同一次判定的产物，供 org-cutover-check 一次读
      // 读得到通道静默的根因（诊断位，不是门）。
      hostEnv
    });
    ctx.effect(() => () => api.ledgerHost.delivery.close(), "pod: 组织通道代际释放");
    // 邮件中继（11 号票 `V-A4.4`／`V-A2.13`）：**host 是投递面唯一写者**——bot 侧
    // 无 inbox/outbox（含 receipts/responses 消费记账）直写路径，投递与消费汇报
    // 都经 `_mail` 认证命令回到本进程落盘（seq 锁只剩 host 一侧的并发保护）。
    // 记录读面（inbox／outbox／会话）不在此收口：读不收窄。
    api.mailRelay = createMailRelay({
      dshHome,
      readRegistry: () => api.readRegistry(),
      logger: ctx.logger
    });
    ctx.effect(
      // ticker 的 disposer 同时释放台账写锁（宿主停机/热重载不留悬空写锁）
      () => startLedgerTicker({ host: api.ledgerHost, logger: ctx.logger }),
      "pod: 台账值守（租约回收＋异常汇入＋写锁释放）"
    );
    // bot 自启动（2026-09-04 用户需求）：宿主启动时未在线的注册 bot 跟随启动。
    // void 后台执行——不阻塞 apply/HTTP 就绪；语义与开关见 lib/bot-autostart.js
    //（enabled:false＝停用；autoStart:false＝仅退出跟随启动；DSH_BOTS_AUTOSTART=0 应急闸）。
    void autoStartBots(ctx, api);
  }

  // 锚点席位脚手架：失败仅告警，且不阻塞 apply/路由注册——脚本路径最长 60s
  //（只有锚点席位被编辑弹窗配了 name/role/model 字段后才走脚本；默认空字段走
  // 内置同步路径）。start() 每次都会重新脚手架，这里慢一点没有后果。
  const anchor = api.readRegistry()[BOOTSTRAP_ANCHOR_POST];
  if (anchor !== undefined) {
    void scaffoldBot(ctx, dshHome, anchor).catch((error) => {
      ctx.logger?.warn?.(
        `[pod] 锚点席位脚手架失败（仅告警）：${error instanceof Error ? error.message : String(error)}`
      );
    });
  }

  // 清理上次 host 运行遗留的 stale pid（进程已不在但注册表仍记录 pid）。
  api.reconcileStalePids();

  ctx.effect(() => {
    const ws = ctx.get("webServer");
    if (ws === undefined) {
      ctx.logger?.warn?.("[pod] webServer 服务不可用，跳过 /api/bots 路由注册");
      return;
    }
    return ws.register({
      kind: "prefix",
      path: API_PREFIX,
      // 返回 promise：webserver 会 await route.handler(req, res)，保证响应写完才返回
      handler: (req, res) => handleApi(req, res, api).catch((error) => {
        // 兜底：handleApi 内部已捕获绝大多数异常
        ctx.logger?.error?.("[pod] 未捕获的路由异常：", error);
        try {
          if (!res.headersSent) json(res, 500, { error: "internal error" });
          else res.end();
        } catch {
          // 连接可能已断开
        }
      })
    });
  }, "pod: /api/bots 路由");
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
  buildSpawnEnv,
  bumpHealCount,
  // 宿主环境缝自检（39 号票）：导出的是**模块本体**，不是 index.js 内第二份实现
  // ——tests/host-env-seam.test.mjs 以引用相等锁「apply 走的就这一条判定」。
  checkHostEnvSeam,
  logHostEnvSeam,
  normalizeSeamOrigin,
  computeStatus,
  parseStartTicks,
  pidIsSameGeneration,
  tightenBotTree,
  tightenPath,
  bootstrapRegistry,
  createBootstrapAnchor,
  isBootstrapAnchorSeat,
  minimalRosterState,
  createMailMonitor,
  createSseHub,
  scaffoldBot,
  readStartTicks,
  currentProfileId,
  detectBotInstance,
  resolveTurnTimeoutMs,
  emptyMailState,
  findSessionDirFor,
  handleIncoming,
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
  buildRegisterDescription,
  registerKnowledgeTools,
  registerOrgTools,
  registerTeamPromptSection,
  registerBotFacesOnReady,
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
  readBotSessionId,
  alignContextWindowForBot,
  resolveDshHome,
  runNativeAgentTurn,
  scaffoldProfileBuiltin,
  scanMailState,
  serializeBot,
  slugify,
  sseEndpoint,
  // L2 工具轨迹投影件透出（票 06：直测纯投影与离线读盘，不经 HTTP）
  projectTrace,
  offlineTrace,
  startInboxWatcher,
  startMailNotifyMonitor,
  startLedgerTicker,
  createTaskLedger,
  createLedgerHost,
  handleLedgerApi,
  uniqueId,
  writeRegistryAtomic,
  yamlQuote
};
