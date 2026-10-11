"use strict";
/**
 * 数据面路径族**单源模块**（pod 改名批 14 号票；规格 §F2 C 组／§F6／附录 A V-P8.5）。
 *
 * 先例：`lib/session-log-names.cjs`（retro R2）——ESM（lib/*.js）与 CJS（scripts/*.cjs）
 * 共用的 .cjs 底座。此前 `$DSH_HOME/bots` 族路径散落各模块各自 join（探索笔记
 * t14-dataplane §1：无单一常量模块），改名＝逐函数改字面量；收敛后根名只活在
 * 本文件的**名常量**，切名批只翻常量。
 *
 * 消费方式：ESM 侧按默认导出整体引入（或 createRequire），CJS 侧 require 本件。
 * 各面既有导出名（inboxDirFor 等）保持不变、函数体改为委托本件——公共 API 形状
 * 零变化（tests/pod-data-roots.test.mjs 单源等值把守）。注意：本文件注释不得出现
 * 「import … from "相对说明符"」示例形——provenance 静态解析不剥注释，会被当成
 * 真实依赖（sentinel-provenance.js resolveSourceManifest）。
 */
const path = require("node:path");

/** 数据面根名（`$DSH_HOME/<root>`：registry/inbox/outbox/knowledge/ledger/capabilities/started 共住；
 *  14 号票切名：旧 `bots` 搬迁为 `bots.retired-<ts>` 只读窗口，见 .scratch/pod/rename-migration-plan.md）。 */
const DATA_ROOT_NAME = "pod";
/** bot 工作区根名（bot 子进程 cwd；session 分片目录名由其派生；14 号票切名，旧根同上）。 */
const WORKSPACE_ROOT_NAME = "pod-workspaces";
/** 旧数据根名（14 号票搬迁源；`bots.retired-<ts>` 只读窗口与迁移脚本前置校验消费，清理另点名）。 */
const LEGACY_DATA_ROOT_NAME = "bots";
/** 旧工作区根名（同上；bot-health 分片双认经 WORKSPACE_SHARD_MARKERS 消费）。 */
const LEGACY_WORKSPACE_ROOT_NAME = "bot-workspaces";
/** profile 家族根名（与宿主 web profile 共享，不随改名批变根名）。 */
const PROFILE_ROOT_NAME = "profiles";
/** 损坏会话归档根名（会话域面，不随改名批变根名）。 */
const SESSION_BACKUPS_ROOT_NAME = "session-backups";

/**
 * session 分片目录的**工作区前缀标记**（`<前缀><botId>--` 形；宿主按 bot cwd 派生
 * 分片名）。`scripts/bot-health.cjs` 作用域目录匹配消费：切名后新旧前缀都认
 * （新前缀在前＝现役优先）。
 */
const WORKSPACE_SHARD_MARKERS = Object.freeze(["pod-workspaces-", "bot-workspaces-"]);

/** 数据面根：`<dshHome>/<DATA_ROOT_NAME>`。 */
function dataRoot(dshHome) {
  return path.join(dshHome, DATA_ROOT_NAME);
}

/** 注册表文件（席位表 `{id:bot}` 对象，原子写）。 */
function registryPath(dshHome) {
  return path.join(dataRoot(dshHome), "bots.json");
}

/** bot 工作区目录（spawn cwd；与 create-bot.cjs 缺省一致）。 */
function workspaceDirFor(dshHome, botId) {
  return path.join(dshHome, WORKSPACE_ROOT_NAME, botId);
}

/** profile 家族根：`<dshHome>/profiles`。 */
function profileRoot(dshHome) {
  return path.join(dshHome, PROFILE_ROOT_NAME);
}

/** bot profile 目录（settings.yaml／cordis.patch.yml／node_modules）。 */
function profileDirFor(dshHome, botId) {
  return path.join(profileRoot(dshHome), botId);
}

/** 收件箱目录（messages.jsonl＋.seq.lock＋receipts/）。 */
function inboxDirFor(dshHome, botId) {
  return path.join(dataRoot(dshHome), "inbox", botId);
}

/** 发件箱目录（<ts>.jsonl 回复件）。 */
function outboxDirFor(dshHome, botId) {
  return path.join(dataRoot(dshHome), "outbox", botId);
}

/** 知识库根（index.jsonl＋reports/＋REPORT_TEMPLATE.md）。 */
function knowledgeRoot(dshHome) {
  return path.join(dataRoot(dshHome), "knowledge");
}

/** 台账域根（events.jsonl＋epoch.json＋lock/；与评审单 store 锁域互不嵌套）。 */
function ledgerRoot(dshHome) {
  return path.join(dataRoot(dshHome), "ledger");
}

/** 台账事件日志（唯一事实源，append-only）。 */
function ledgerEventsFile(dshHome) {
  return path.join(ledgerRoot(dshHome), "events.jsonl");
}

/** capability 数据域根（secret／issued.jsonl／nonces/）。 */
function capabilityRoot(dshHome) {
  return path.join(dataRoot(dshHome), "capabilities");
}

/** 实例登记目录（instances.jsonl 所在；host 与 bot 实例都写行）。 */
function startedDir(dshHome) {
  return path.join(dataRoot(dshHome), "started");
}

/** 实例登记文件（五字段行 {botId,pid,startedAt,hostInstanceId,at}）。 */
function startedRegistryFile(dshHome) {
  return path.join(startedDir(dshHome), "instances.jsonl");
}

/** 损坏会话归档根（<sessionId>-corrupt-<ts>/）。 */
function sessionBackupsDir(dshHome) {
  return path.join(dshHome, SESSION_BACKUPS_ROOT_NAME);
}

module.exports = {
  DATA_ROOT_NAME, WORKSPACE_ROOT_NAME, PROFILE_ROOT_NAME, SESSION_BACKUPS_ROOT_NAME,
  LEGACY_DATA_ROOT_NAME, LEGACY_WORKSPACE_ROOT_NAME,
  WORKSPACE_SHARD_MARKERS,
  dataRoot, registryPath, workspaceDirFor, profileRoot, profileDirFor,
  inboxDirFor, outboxDirFor, knowledgeRoot, ledgerRoot, ledgerEventsFile,
  capabilityRoot, startedDir, startedRegistryFile, sessionBackupsDir
};
