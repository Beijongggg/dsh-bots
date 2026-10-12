#!/usr/bin/env node
/**
 * migrate-pod-data.mjs —— Pod 改名批 14 号票·数据面迁移脚本（选型＝停机搬迁，
 * 方案冻结候选：.scratch/pod/rename-migration-plan.md；规格 §F6 两风险／§F8 授权点、
 * 附录 A V-P8.5）。
 *
 * **本脚本只负责搬迁与校验；执行属授权窗口**（规格 §F8「C 组若做另加一次数据迁移
 * 点名」；--profiles 面的执行由票 13 授权件覆盖）。运行面纪律：真实 `~/.dsh`
 * 只在用户点名窗口内被本脚本触碰；本仓测试全程走 `--dsh-home` 临时目录。
 *
 * 用法：
 *   node scripts/migrate-pod-data.mjs --dsh-home <dir> [options]
 * 选项：
 *   --dsh-home <dir>  运行面根（缺省＝readEnvValue(env,"DSH_HOME") 回落 ~/.dsh）
 *   --execute         显式执行门；**缺省 dry-run**（只打计划，零写入）
 *   --profiles        profile patch 重写（name→pod＋workspaceRoot→pod-workspaces）
 *                     与 node_modules 旧名软链改名并重指部署目录（幂等；可单独跑）
 *   --verify-only     只跑逐面校验器出 JSON（迁移前后各跑一次对比用；零写入）
 *   --report <path>   JSON 校验报告落盘（0600）；报告件按 README §6.2 版本化路径与
 *                     自身哈希**入账**（哈希值随记录写在调用方记录面；禁覆盖旧件）
 *
 * 步骤序（--execute）：前置校验 → 真实拷贝（`copyTreePreservingDirModes`：fs.cpSync
 * recursive，不用硬链——jsonl 追加写会穿透；目录 mode 自补）→ 逐件 sha/计数复验 →
 * 注册表路径字段重写（②′，重写后逐字段复验「实改面＝清单面」）→ --profiles（若旗标）
 * → 旧根改名 `*.retired-<ts>`（只读窗口，不删除，清理另点名）→ 就绪输出。
 * **失败中止语义（数据根搬迁段：前置校验／拷贝／复验／retire）**：任一步失败 →
 * 已建新根整树删除、旧根不动、exit 1——不留半迁移态（风险①：注册表空表会触发
 * bootstrap 锚点重建，故整表字节级搬运 bots.json 本体，绝不「先清空再重建」）。
 * **--profiles 段失败语义（单列；不在新根清理面）**：已重写 patch／已改名软链
 * 不自动回滚（旧布局仍现役可继续服务），重写幂等——重跑 `--execute --profiles`
 * 即续完未竟改动；非软链旧名项 fail closed 不动（人工处置点）。
 *
 * 退出码：0 绿；1 拒绝／校验失败；2 用法错误。
 */
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readEnvValue } from "../lib/env-aliases.js";
import dRoots from "../lib/data-roots.cjs";

const {
  DATA_ROOT_NAME, WORKSPACE_ROOT_NAME, PROFILE_ROOT_NAME,
  LEGACY_DATA_ROOT_NAME, LEGACY_WORKSPACE_ROOT_NAME,
  workspaceDirFor, profileRoot, profileDirFor, registryPath
} = dRoots;

/** 旧插件模块名（profile node_modules 链接改名面；存量链接是数据，本脚本改其名并重指部署目录）。
 *  旧名经 tests/pod-spec-face.test.mjs IDENTITY_ALLOW_TOKENS 逐条登记（迁移窗口残留）。 */
const LEGACY_PLUGIN_MODULE_NAME = "dsh-bots";
const PLUGIN_MODULE_NAME = "pod";

const REPORT_SCHEMA = "pod-data-migration-report/1";

export class MigrationRefusal extends Error {}

// ---------------- 通用件 ----------------

function sha256Of(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256File(file) {
  return sha256Of(readFileSync(file));
}

/** 递归清单（相对路径排序）：{rel,type,sha256?,byteLength?,mode?,linkTarget?}。
 *  symlink 不解引用（记 linkTarget）；读取失败原样上抛（调用方决定中止语义）。 */
export function walkTree(root) {
  const out = [];
  const visit = (abs, rel) => {
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) {
      out.push({ rel, type: "symlink", linkTarget: readlinkSync(abs), mode: st.mode });
      return;
    }
    if (st.isDirectory()) {
      out.push({ rel, type: "directory", mode: st.mode });
      for (const entry of readdirSync(abs).sort()) visit(join(abs, entry), rel === "" ? entry : `${rel}/${entry}`);
      return;
    }
    const buf = readFileSync(abs);
    out.push({ rel, type: "file", sha256: sha256Of(buf), byteLength: buf.length, mode: st.mode });
  };
  visit(root, "");
  return out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/** 整树拷贝（`fs.cpSync` recursive；不用硬链——jsonl 追加写会穿透硬链）。
 *  **目录 mode 需自补**：`fs.cpSync` 保留文件权限但**不保留目录权限**（目录按 umask
 *  建 0755），0700 数据目录会被放宽 ⇒ 复验器逐件 mode 对账红（真实运行面首次 execute
 *  即以 `mismatch-mode` 中止，2026-10-12 窗口）。chmod 自深向浅（窄权限父目录不挡写入），
 *  根目录最后。 */
export function copyTreePreservingDirModes(srcRoot, destRoot) {
  cpSync(srcRoot, destRoot, { recursive: true, verbatimSymlinks: true });
  const dirs = walkTree(srcRoot)
    .filter((e) => e.type === "directory")
    .sort((a, b) => b.rel.length - a.rel.length);
  for (const dir of dirs) {
    chmodSync(dir.rel === "" ? destRoot : join(destRoot, dir.rel), dir.mode & 0o7777);
  }
}

/** 拷贝复验器：两树逐件对账（路径集双向＋类型＋sha/byteLength＋mode＋链接目标）。 */
export function verifyCopiedTree(srcRoot, destRoot) {
  const src = walkTree(srcRoot);
  const dst = walkTree(destRoot);
  const diffs = [];
  const dstByRel = new Map(dst.map((e) => [e.rel, e]));
  const srcByRel = new Map(src.map((e) => [e.rel, e]));
  for (const entry of src) {
    const mirror = dstByRel.get(entry.rel);
    if (mirror === undefined) {
      diffs.push({ kind: "missing-in-dest", rel: entry.rel });
      continue;
    }
    for (const key of ["type", "sha256", "byteLength", "mode", "linkTarget"]) {
      if (entry[key] !== mirror[key]) {
        diffs.push({ kind: `mismatch-${key}`, rel: entry.rel, src: entry[key], dest: mirror[key] });
      }
    }
  }
  for (const entry of dst) {
    if (!srcByRel.has(entry.rel)) diffs.push({ kind: "extra-in-dest", rel: entry.rel });
  }
  return { ok: diffs.length === 0, diffs, srcFiles: src.length, destFiles: dst.length };
}

/** 逐面计数（校验器独立可调；execute 前后各一次对比）。legacy＝旧根基面。 */
export function snapshotFaces(dshHome, { legacy = false } = {}) {
  const rootName = legacy ? LEGACY_DATA_ROOT_NAME : DATA_ROOT_NAME;
  const wsRootName = legacy ? LEGACY_WORKSPACE_ROOT_NAME : WORKSPACE_ROOT_NAME;
  const dataRootDir = join(dshHome, rootName);
  const wsRootDir = join(dshHome, wsRootName);
  const faces = { basis: legacy ? "legacy" : "new", dataRoot: dataRootDir, workspaceRoot: wsRootDir };

  // 席位表（sha＋条目数＋逐 id）
  const regFile = join(dataRootDir, "bots.json");
  let registry = null;
  try {
    registry = JSON.parse(readFileSync(regFile, "utf8"));
  } catch {
    registry = null;
  }
  faces.registry = {
    present: registry !== null && typeof registry === "object" && !Array.isArray(registry),
    sha256: existsSync(regFile) ? sha256File(regFile) : null,
    entries: registry && typeof registry === "object" && !Array.isArray(registry) ? Object.keys(registry).length : 0,
    ids: registry && typeof registry === "object" && !Array.isArray(registry) ? Object.keys(registry).sort() : []
  };

  // 台账事件序列（事件数＋lastSeq）
  const eventsFile = join(dataRootDir, "ledger", "events.jsonl");
  let events = 0;
  let lastSeq = 0;
  let ledgerSha = null;
  try {
    const lines = readFileSync(eventsFile, "utf8").split("\n").filter((l) => l.trim() !== "");
    events = lines.length;
    ledgerSha = sha256File(eventsFile);
    for (const line of lines) {
      try {
        const seq = JSON.parse(line)?.seq;
        if (Number.isInteger(seq) && seq > lastSeq) lastSeq = seq;
      } catch { /* 损坏行不抬 seq */ }
    }
  } catch { /* 缺面保持 0 */ }
  faces.ledger = { present: existsSync(eventsFile), events, lastSeq, eventsSha256: ledgerSha };

  // 信箱（inbox/outbox 文件数＋jsonl 行数）
  const countMailDir = (dir) => {
    let files = 0;
    let jsonlLines = 0;
    const visit = (abs) => {
      let entries = [];
      try {
        entries = readdirSync(abs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const p = join(abs, e.name);
        if (e.isDirectory()) visit(p);
        else {
          files += 1;
          if (e.name.endsWith(".jsonl")) {
            try {
              jsonlLines += readFileSync(p, "utf8").split("\n").filter((l) => l.trim() !== "").length;
            } catch { /* 不可读不计 */ }
          }
        }
      }
    };
    visit(dir);
    return { present: existsSync(dir), files, jsonlLines };
  };
  faces.inbox = countMailDir(join(dataRootDir, "inbox"));
  faces.outbox = countMailDir(join(dataRootDir, "outbox"));

  // 知识库（index 行数＋reports 数＋模板在位）
  const knowledgeDir = join(dataRootDir, "knowledge");
  let indexLines = 0;
  try {
    indexLines = readFileSync(join(knowledgeDir, "index.jsonl"), "utf8").split("\n").filter((l) => l.trim() !== "").length;
  } catch { /* 缺面 */ }
  let reports = 0;
  try {
    reports = readdirSync(join(knowledgeDir, "reports")).filter((n) => n.endsWith(".md")).length;
  } catch { /* 缺面 */ }
  faces.knowledge = {
    present: existsSync(knowledgeDir), indexLines, reports,
    hasTemplate: existsSync(join(knowledgeDir, "REPORT_TEMPLATE.md"))
  };

  // 能力／nonce（secret/issued 在位＋nonces 计数）
  const capDir = join(dataRootDir, "capabilities");
  let nonceFiles = 0;
  try {
    nonceFiles = readdirSync(join(capDir, "nonces")).length;
  } catch { /* 缺面 */ }
  faces.capabilities = {
    present: existsSync(capDir),
    hasSecret: existsSync(join(capDir, "secret")),
    hasIssuedAudit: existsSync(join(capDir, "issued.jsonl")),
    nonceFiles
  };

  // 实例登记行数
  let startedLines = 0;
  try {
    startedLines = readFileSync(join(dataRootDir, "started", "instances.jsonl"), "utf8").split("\n").filter((l) => l.trim() !== "").length;
  } catch { /* 缺面 */ }
  faces.started = { present: existsSync(join(dataRootDir, "started")), lines: startedLines };

  // 工作区（目录数＋文件数）
  let wsDirs = 0;
  let wsFiles = 0;
  try {
    for (const entry of readdirSync(wsRootDir, { withFileTypes: true })) {
      if (entry.isDirectory()) wsDirs += 1;
      else wsFiles += 1;
    }
  } catch { /* 缺面 */ }
  faces.workspaces = { present: existsSync(wsRootDir), dirs: wsDirs, files: wsFiles };

  // 回滚点（既有部署备份批数；只读面不搬）——legacy 批名与现役批名都数
  faces.backups = {
    legacyBatches: countChildren(join(dshHome, "backups", "dsh-bots")),
    podBatches: countChildren(join(dshHome, "backups", "pod"))
  };

  // 不碰面的信息性计数（session 分片／损坏归档）
  faces.sessions = { shards: countChildren(join(dshHome, "sessions")) };
  faces.sessionBackups = { entries: countChildren(join(dshHome, "session-backups")) };
  return faces;
}

/** lstat 判存（不跟随链接；悬空软链也算在位）。 */
function linkEntryExists(dir, name) {
  try {
    lstatSync(join(dir, name));
    return true;
  } catch {
    return false;
  }
}

function countChildren(dir) {
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

/** 前后逐面对账（migrated 面；backups/sessions/sessionBackups 只记录不对账——不搬面）。 */
export function compareFaces(before, after) {
  const migrated = ["registry", "ledger", "inbox", "outbox", "knowledge", "capabilities", "started", "workspaces"];
  const diffs = [];
  for (const face of migrated) {
    const a = JSON.stringify(strip(before[face], ["basis"]));
    const b = JSON.stringify(strip(after[face], ["basis"]));
    if (a !== b) diffs.push({ face, before: a, after: b });
  }
  return diffs;
}

function strip(obj, keys) {
  const out = { ...obj };
  for (const key of keys) delete out[key];
  return out;
}

// ---------------- 前置校验与在跑检测 ----------------

/** pid 存活探测：kill(pid,0)；EPERM（他者进程）视同存活（保守拒）。 */
export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

// 旧根组合路径（执行时点新根不存在；前置校验与在跑检测都读旧布局——
// 根名常量仍单源自 data-roots，legacy 派生只活在本迁移脚本）。
const legacyRegistryFile = (dshHome) => join(dshHome, LEGACY_DATA_ROOT_NAME, "bots.json");
const legacyStartedRegistryFile = (dshHome) => join(dshHome, LEGACY_DATA_ROOT_NAME, "started", "instances.jsonl");

/** 在跑检测（读**旧布局**——执行时点新根尚不存在）：instances.jsonl **每个 botId 最新行**＋
 *  注册表 pid 字段，逐 pid 存活探测（host 行含内——窗口内 host 也必须停）。
 *  修门（2026-10-12）：**instances.jsonl 只认每 botId 最新行**——该件是追加日志，历史行可达
 *  数百，其 pid 会被无关系统进程复用（实测 cupsd 940／cups-browsed 968／snapfuse 987 复用
 *  2026-09-07 历史行），逐行探测即假阳性、把已停机窗口误判为在跑而拒迁。**注册表面无需过滤**：
 *  `bots.json` 是 `{id: bot}` 映射，`Object.entries` 每条即该席唯一现役行、本无历史行；
 *  两面对照件＝capability 面 `currentInstanceRow`（`lib/org/capability-base.js`，同为
 *  「每 botId 现行行」读法）。原始观测（ps／grep 输出）与放宽取舍见
 *  `.scratch/pod/issues/14-rename-data-plane-migration.md`「修门与授权留档（2026-10-12）」节；
 *  本修门提交 `edef328`。 */
export function findLiveInstancePids(dshHome) {
  const candidates = [];
  try {
    /** 文件追加序里的最新一行＝该 botId 的现役实例行。 */
    const latestByBot = new Map();
    for (const line of readFileSync(legacyStartedRegistryFile(dshHome), "utf8").split("\n")) {
      if (line.trim() === "") continue;
      try {
        const row = JSON.parse(line);
        if (Number.isInteger(row?.pid) && row.pid > 0) {
          latestByBot.set(String(row?.botId ?? "?"), row.pid);
        }
      } catch { /* 损坏行不参与判定 */ }
    }
    for (const [botId, pid] of latestByBot) candidates.push({ pid, botId, source: "instances.jsonl" });
  } catch { /* 缺面＝无行 */ }
  try {
    const registry = JSON.parse(readFileSync(legacyRegistryFile(dshHome), "utf8"));
    if (registry && typeof registry === "object" && !Array.isArray(registry)) {
      for (const [id, bot] of Object.entries(registry)) {
        if (Number.isInteger(bot?.pid) && bot.pid > 0) {
          candidates.push({ pid: bot.pid, botId: id, source: "registry" });
        }
      }
    }
  } catch { /* 注册表缺失由前置校验报告 */ }
  return candidates.filter(({ pid }) => pidAlive(pid));
}

/** 前置校验（失败即拒、零写入）：旧布局在位＋新根不在位。 */
export function preflightChecks(dshHome) {
  const violations = [];
  const legacyDataRoot = join(dshHome, LEGACY_DATA_ROOT_NAME);
  const legacyWsRoot = join(dshHome, LEGACY_WORKSPACE_ROOT_NAME);
  const legacyRegistry = join(legacyDataRoot, "bots.json");
  let registry = null;
  try {
    registry = JSON.parse(readFileSync(legacyRegistry, "utf8"));
  } catch (error) {
    violations.push(`旧布局不在位：${relative(dshHome, legacyRegistry)} 缺失或不可解析（${error.message}）——已迁移或从未安装；复验用 --verify-only`);
    registry = null;
  }
  if (registry !== null && (typeof registry !== "object" || Array.isArray(registry))) {
    violations.push("旧注册表不是对象表（{id:bot}）——布局冲突，拒绝迁移（损坏表请先按 bootstrapRegistry 分支人工处置）");
  }
  if (!existsSync(legacyWsRoot)) {
    violations.push(`旧布局不在位：${LEGACY_WORKSPACE_ROOT_NAME}/ 目录缺失`);
  }
  for (const [label, dir] of [
    [`新数据根 ${DATA_ROOT_NAME}/`, join(dshHome, DATA_ROOT_NAME)],
    [`新工作区根 ${WORKSPACE_ROOT_NAME}/`, join(dshHome, WORKSPACE_ROOT_NAME)]
  ]) {
    if (existsSync(dir)) {
      violations.push(`${label}已存在——已迁移或布局冲突；二次 execute 拒绝（安全跳过语义），复验用 --verify-only`);
    }
  }
  return { ok: violations.length === 0, violations };
}

// ---------------- profile patch 重写与软链改名（--profiles） ----------------

/** patch 文本重写（纯函数；幂等）：name 旧插件名→'pod'、workspaceRoot 内
 *  bot-workspaces 路径段→pod-workspaces。其余行零触碰。 */
export function rewritePatchText(text) {
  const changes = [];
  const lines = text.split("\n").map((line) => {
    const nameMatch = line.match(/^(\s*)name:\s*(['"])dsh-bots\2\s*$/);
    if (nameMatch) {
      changes.push("name: 旧插件名 → 'pod'");
      return `${nameMatch[1]}name: 'pod'`;
    }
    if (/^\s*workspaceRoot:/.test(line) && line.includes(LEGACY_WORKSPACE_ROOT_NAME)) {
      changes.push(`workspaceRoot: ${LEGACY_WORKSPACE_ROOT_NAME} → ${WORKSPACE_ROOT_NAME}`);
      return line.split(LEGACY_WORKSPACE_ROOT_NAME).join(WORKSPACE_ROOT_NAME);
    }
    return line;
  });
  return { text: lines.join("\n"), changes };
}

/** 单处旧名软链处置：改名为新名＋**重指部署目录**（四同名绑定：patch 行 name＝条目名＝
 *  package.json.name；存量链接目标是旧部署目录 plugins/dsh-bots——保目标改名会让 'pod'
 *  解析到旧代码，故重指 plugins/pod；部署同步为窗口内先行步，目标可暂缺）。
 *  判存用 lstat（链接可能悬空）；非软链旧名项＝fail closed 不动（人工处置点）；
 *  新名处为**非软链占位**（普通文件／目录）＝同口径 fail closed（防 rename 静默覆盖／EISDIR）。
 *  返回 `{ changed, actions }`。 */
function relinkLegacyPluginLink(nmDir, { label, deployTarget, dryRun }) {
  const actions = [];
  let changed = 0;
  const legacyLink = join(nmDir, LEGACY_PLUGIN_MODULE_NAME);
  const newLink = join(nmDir, PLUGIN_MODULE_NAME);
  let legacyIsLink = false;
  let newIsPresent = false;
  let newTarget = null;
  try {
    legacyIsLink = lstatSync(legacyLink).isSymbolicLink();
  } catch { /* 不存在 */ }
  try {
    newIsPresent = lstatSync(newLink).isSymbolicLink();
    if (newIsPresent) newTarget = readlinkSync(newLink);
  } catch { /* 不存在 */ }
  if (newIsPresent && newTarget !== deployTarget) {
    actions.push({ profile: label, target: `node_modules/${PLUGIN_MODULE_NAME}`, changes: [`新名链接已在他处（${String(newTarget)}）——不动待人工确认`], wrote: false });
    return { changed, actions };
  }
  // 新名处存在但**不是软链**（普通文件／目录占位）：改名会静默覆盖文件或 EISDIR 中止——
  // fail closed 不动（人工处置点；与旧名项非软链同口径）。
  if (!newIsPresent && linkEntryExists(nmDir, PLUGIN_MODULE_NAME)) {
    actions.push({ profile: label, target: `node_modules/${PLUGIN_MODULE_NAME}`, changes: ["新名项非软链（占位）——fail closed 不动，不覆盖，须人工处置"], wrote: false });
    return { changed, actions };
  }
  if (legacyIsLink) {
    const changes = [
      `软链改名保形（${LEGACY_PLUGIN_MODULE_NAME} → ${PLUGIN_MODULE_NAME}）`,
      `重指部署目录（${readlinkSync(legacyLink)} → ${deployTarget}）`
    ];
    changed += 1;
    actions.push({ profile: label, target: `node_modules/${LEGACY_PLUGIN_MODULE_NAME} → ${PLUGIN_MODULE_NAME}`, changes, wrote: !dryRun });
    if (!dryRun) {
      renameSync(legacyLink, newLink);
      if (lstatSync(newLink).isSymbolicLink() && readlinkSync(newLink) !== deployTarget) {
        rmSync(newLink, { force: true });
        symlinkSync(deployTarget, newLink);
      }
    }
  } else if (linkEntryExists(nmDir, LEGACY_PLUGIN_MODULE_NAME)) {
    actions.push({ profile: label, target: `node_modules/${LEGACY_PLUGIN_MODULE_NAME}`, changes: ["旧名项不是软链——fail closed 不动，须人工处置"], wrote: false });
  }
  return { changed, actions };
}

/** --profiles 步骤：逐 profile 重写 cordis.patch.yml＋旧名软链改名为新名并**重指部署目录**。 */
export function rewriteProfiles(dshHome, { dryRun = true } = {}) {
  const actions = [];
  let scanned = 0;
  let changed = 0;
  const deployTarget = join(dshHome, "plugins", PLUGIN_MODULE_NAME);
  let entries = [];
  try {
    entries = readdirSync(profileRoot(dshHome), { withFileTypes: true });
  } catch {
    return { ok: true, scanned: 0, changed: 0, actions: [{ note: "profiles/ 不存在，零 profile 可处理" }] };
  }
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name === "node_modules" || !entry.isDirectory()) continue;
    scanned += 1;
    const dir = profileDirFor(dshHome, entry.name);
    // ① patch 重写
    const patchPath = join(dir, "cordis.patch.yml");
    if (existsSync(patchPath)) {
      const current = readFileSync(patchPath, "utf8");
      const { text, changes } = rewritePatchText(current);
      if (changes.length > 0) {
        changed += 1;
        actions.push({ profile: entry.name, target: "cordis.patch.yml", changes, wrote: !dryRun });
        if (!dryRun) writeFileSync(patchPath, text, { mode: 0o600 });
      }
    }
    // ② profile 自有 node_modules 旧名软链（web 等带独立 node_modules 的 profile）
    const link = relinkLegacyPluginLink(join(dir, "node_modules"), { label: entry.name, deployTarget, dryRun });
    changed += link.changed;
    actions.push(...link.actions);
  }
  // ②′ profiles 根 node_modules——**共享解析锚**：bot profile 目录自身无 node_modules，宿主按
  //    specifier 自 profile 目录逐级上溯解析，本链接即各 bot 的 'pod' 落点；漏改则重启后
  //    席位解析失败、插件缺席（邮件/组织面全休眠）。实测（隔离夹具，2026-10-12）：自 bot
  //    profile 目录 resolve 'dsh-bots' 命中本链接；无 'pod' 链接时 MODULE_NOT_FOUND。
  const shared = relinkLegacyPluginLink(join(profileRoot(dshHome), "node_modules"), { label: "profiles/node_modules（共享锚）", deployTarget, dryRun });
  changed += shared.changed;
  actions.push(...shared.actions);
  return { ok: true, scanned, changed, actions };
}

// ---------------- 注册表路径字段重写（workspace／workspaceRoot） ----------------

/** 注册表 JSON 内的 workspace 字段重写（纯函数；幂等；preserve 格式——只替换路径串）。
 *  事由：整表字节级搬运保留存量字段值，而 `bot.workspace` 被宿主序列化输出
 *  （serializeBot）与权限判定（isBotWritablePath）消费——不重写则重启后仍指旧根
 *  （旧根随迁 retired，路径失效）。厂外自定义 workspace（不落在旧工作区根下）不误改。 */
export function rewriteRegistryWorkspaces(registryText, legacyWsRoot, newWsRoot) {
  const prefix = legacyWsRoot.endsWith("/") ? legacyWsRoot : `${legacyWsRoot}/`;
  const parsed = JSON.parse(registryText);
  const changes = [];
  const replacements = [];
  for (const [botId, bot] of Object.entries(parsed ?? {})) {
    if (bot === null || typeof bot !== "object" || Array.isArray(bot)) continue;
    for (const field of ["workspace", "workspaceRoot"]) {
      const value = bot[field];
      if (typeof value === "string" && (value === legacyWsRoot || value.startsWith(prefix))) {
        const next = `${newWsRoot}${value.slice(legacyWsRoot.length)}`;
        bot[field] = next;
        changes.push(`${botId}.${field}`);
        replacements.push([JSON.stringify(value), JSON.stringify(next)]);
      }
    }
  }
  if (changes.length === 0) return { text: registryText, changes: [] };
  let text = registryText;
  for (const [from, to] of replacements) text = text.split(from).join(to);
  return { text, changes };
}

/** 叶子字段扁平化（`a.b.c` → 值；数组/对象按整体 JSON 串比较）——重写复验的对照面。 */
function flattenFields(value, prefix = "", out = {}) {
  if (value === null || typeof value !== "object") {
    out[prefix] = value;
    return out;
  }
  if (Array.isArray(value)) {
    out[prefix] = JSON.stringify(value);
    return out;
  }
  for (const [key, inner] of Object.entries(value)) flattenFields(inner, prefix === "" ? key : `${prefix}.${key}`, out);
  return out;
}

/** 迁移后注册表重写（新根内）：workspace／workspaceRoot 指新工作区根。
 *  **重写后复验**（2026-10-12 复审处置）：解析写后文本对照写前——① 实改字段集必须
 *  **恰等于**清单面（防整文 split/join 在非路径字段上静默改写）；② 每个改动字段的
 *  新值必落新工作区根。不符即抛（搬迁段失败语义：新根清理、旧根原样、exit 1）。 */
function rewriteRegistryFile(dshHome) {
  const file = registryPath(dshHome);
  const text = readFileSync(file, "utf8");
  const legacyWsRoot = resolve(join(dshHome, LEGACY_WORKSPACE_ROOT_NAME));
  const newWsRoot = resolve(join(dshHome, WORKSPACE_ROOT_NAME));
  const { text: rewritten, changes } = rewriteRegistryWorkspaces(text, legacyWsRoot, newWsRoot);
  if (changes.length === 0) {
    return { file, changes, written: false, verified: true, changedFields: [], sha256Before: sha256Of(Buffer.from(text)), sha256After: sha256Of(Buffer.from(text)) };
  }
  writeFileSync(file, rewritten, { mode: 0o600 });
  const before = flattenFields(JSON.parse(text));
  const after = flattenFields(JSON.parse(rewritten));
  const actualChanged = Object.keys(after).filter((key) => before[key] !== after[key]).sort();
  const expected = [...changes].sort();
  if (JSON.stringify(actualChanged) !== JSON.stringify(expected)) {
    throw new MigrationRefusal(`注册表重写复验不一致（实改面 ≠ 清单面）：实改 ${actualChanged.join("／") || "（无）"}；清单 ${expected.join("／")}`);
  }
  const wsPrefix = `${newWsRoot}/`;
  for (const key of actualChanged) {
    const value = after[key];
    if (typeof value !== "string" || (value !== newWsRoot && !value.startsWith(wsPrefix))) {
      throw new MigrationRefusal(`注册表重写复验不一致（${key} 未落新工作区根）：${String(value)}`);
    }
  }
  return {
    file, changes, written: true, verified: true, changedFields: actualChanged,
    sha256Before: sha256Of(Buffer.from(text)), sha256After: sha256Of(Buffer.from(rewritten))
  };
}

// ---------------- 计划与执行 ----------------

function buildPlan(dshHome) {
  return [
    { step: "copy", from: join(dshHome, LEGACY_DATA_ROOT_NAME), to: join(dshHome, DATA_ROOT_NAME), how: "fs.cpSync recursive（不用硬链）", registry: join(dshHome, LEGACY_DATA_ROOT_NAME, "bots.json"), note: "整表字节级搬运（风险①：空表即触发 bootstrap 锚点重建，绝不先清空再重建）" },
    { step: "copy", from: join(dshHome, LEGACY_WORKSPACE_ROOT_NAME), to: join(dshHome, WORKSPACE_ROOT_NAME), how: "fs.cpSync recursive（不用硬链）" },
    { step: "verify", what: "两树逐件 sha/byteLength/mode/linkTarget 对账＋八面计数前后等值" },
    { step: "registry-rewrite", to: join(dshHome, DATA_ROOT_NAME, "bots.json"), what: "workspace／workspaceRoot 定点重写指新工作区根（②′）＋重写后逐字段复验（实改面＝清单面）" },
    { step: "profiles", what: "patch name/workspaceRoot 重写＋node_modules 旧名软链改名并重指部署目录（--profiles 旗标时）" },
    { step: "retire", from: join(dshHome, LEGACY_DATA_ROOT_NAME), to: `${join(dshHome, LEGACY_DATA_ROOT_NAME)}.retired-<ts>` },
    { step: "retire", from: join(dshHome, LEGACY_WORKSPACE_ROOT_NAME), to: `${join(dshHome, LEGACY_WORKSPACE_ROOT_NAME)}.retired-<ts>` },
    { step: "untouched", what: "sessions/ 分片、backups/ 既有批、session-backups/、profiles/ 家族根不搬" }
  ];
}

function retireOldRoots(dshHome) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const retired = [];
  const moves = [
    [join(dshHome, LEGACY_DATA_ROOT_NAME), join(dshHome, `${LEGACY_DATA_ROOT_NAME}.retired-${ts}`)],
    [join(dshHome, LEGACY_WORKSPACE_ROOT_NAME), join(dshHome, `${LEGACY_WORKSPACE_ROOT_NAME}.retired-${ts}`)]
  ];
  for (const [from, to] of moves) {
    try {
      renameSync(from, to);
      retired.push({ from, to });
    } catch (error) {
      // 半 retire 防护：把已改名的搬回去，不留混合态
      for (const done of retired) {
        try {
          renameSync(done.to, done.from);
        } catch { /* 回滚失败如实上抛（人工处置点） */ }
      }
      throw new MigrationRefusal(`旧根改名失败（已回滚已完成的改名）：${from} → ${to}：${error.message}`);
    }
  }
  return retired;
}

function cleanupNewRoots(dshHome) {
  for (const dir of [join(dshHome, DATA_ROOT_NAME), join(dshHome, WORKSPACE_ROOT_NAME)]) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeReport(reportPath, report) {
  if (typeof reportPath !== "string" || reportPath === "") return;
  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  writeFileSync(resolve(reportPath), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
}

async function main(argv = process.argv.slice(2)) {
  let dshHomeFlag = null;
  let execute = false;
  let profiles = false;
  let verifyOnly = false;
  let reportPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new MigrationRefusal(`--${arg.replace(/^--/, "")} 需要一个值`);
      return argv[++i];
    };
    if (arg === "--dsh-home") dshHomeFlag = value();
    else if (arg === "--execute") execute = true;
    else if (arg === "--profiles") profiles = true;
    else if (arg === "--verify-only") verifyOnly = true;
    else if (arg === "--report") reportPath = value();
    else throw new MigrationRefusal(`未知参数：${arg}`);
  }
  if (execute && verifyOnly) throw new MigrationRefusal("--execute 与 --verify-only 互斥");
  const fromEnv = readEnvValue(process.env, "DSH_HOME");
  const dshHome = resolve(dshHomeFlag ?? (typeof fromEnv === "string" && fromEnv !== "" ? fromEnv : join(homedir(), ".dsh")));
  if (!existsSync(dshHome)) throw new MigrationRefusal(`--dsh-home 不存在：${dshHome}`);

  // --verify-only：只读出逐面计数（基面＝新根优先，否则旧根），零写入
  if (verifyOnly) {
    const hasNew = existsSync(join(dshHome, DATA_ROOT_NAME));
    const hasLegacy = existsSync(join(dshHome, LEGACY_DATA_ROOT_NAME));
    if (!hasNew && !hasLegacy) {
      throw new MigrationRefusal(`两面都不在位（${DATA_ROOT_NAME}/ 与 ${LEGACY_DATA_ROOT_NAME}/ 均缺失）——无面可核`);
    }
    const legacyBasis = !hasNew && hasLegacy;
    const faces = snapshotFaces(dshHome, { legacy: legacyBasis });
    const report = {
      schema: REPORT_SCHEMA, at: new Date().toISOString(), dshHome, mode: "verify-only",
      basis: legacyBasis ? "legacy" : "new", faces, verified: true
    };
    console.log(JSON.stringify(report, null, 2));
    writeReport(reportPath, report);
    return 0;
  }

  // 前置校验：硬门只挡 --execute（dry-run 零写入，任何状态下都出计划并如实记录违例）
  const pre = preflightChecks(dshHome);

  // dry-run（缺省）：只打计划，零写入
  if (!execute) {
    const legacyFacesAvailable = existsSync(join(dshHome, LEGACY_DATA_ROOT_NAME));
    const faces = snapshotFaces(dshHome, { legacy: legacyFacesAvailable });
    const plan = { schema: REPORT_SCHEMA, at: new Date().toISOString(), dshHome, mode: "dry-run",
      verified: false, preflightViolations: pre.violations, plan: buildPlan(dshHome), faces,
      note: "dry-run 零写入；执行须 --execute（授权窗口内逐项点名）" };
    if (profiles) plan.profilesPreview = rewriteProfiles(dshHome, { dryRun: true });
    console.log(JSON.stringify(plan, null, 2));
    writeReport(reportPath, plan);
    return 0;
  }

  if (!pre.ok) {
    for (const v of pre.violations) console.error(`[migrate] 拒绝：${v}`);
    return 1;
  }

  // 在跑检测（前置校验绿后）：任何存活 pid 即拒（host 行含内——窗口内 host 也必须停）
  const live = findLiveInstancePids(dshHome);
  if (live.length > 0) {
    for (const { pid, botId, source } of live) {
      console.error(`[migrate] 拒绝：检测到在跑进程 pid=${pid}（botId=${botId}，来源 ${source}）——先执行停机窗口（方案 §5）`);
    }
    return 1;
  }

  const facesBefore = snapshotFaces(dshHome, { legacy: true });
  let profileResult = { ok: true, scanned: 0, changed: 0, actions: [] };
  let registryResult = { file: null, changes: [], written: false };
  let retired = [];
  try {
    // ① 真实拷贝（目录 mode 由 helper 自补——见 copyTreePreservingDirModes 注释）
    copyTreePreservingDirModes(join(dshHome, LEGACY_DATA_ROOT_NAME), join(dshHome, DATA_ROOT_NAME));
    copyTreePreservingDirModes(join(dshHome, LEGACY_WORKSPACE_ROOT_NAME), join(dshHome, WORKSPACE_ROOT_NAME));

    // ② 逐件 sha/计数复验
    const treeData = verifyCopiedTree(join(dshHome, LEGACY_DATA_ROOT_NAME), join(dshHome, DATA_ROOT_NAME));
    const treeWs = verifyCopiedTree(join(dshHome, LEGACY_WORKSPACE_ROOT_NAME), join(dshHome, WORKSPACE_ROOT_NAME));
    const facesAfter = snapshotFaces(dshHome, { legacy: false });
    const faceDiffs = compareFaces(facesBefore, facesAfter);
    const treeOk = treeData.ok && treeWs.ok;
    if (!treeOk || faceDiffs.length > 0) {
      const detail = [...treeData.diffs, ...treeWs.diffs].slice(0, 10)
        .map((d) => JSON.stringify(d)).concat(faceDiffs.map((d) => JSON.stringify(d)));
      throw new MigrationRefusal(`复验不一致（新根已清理）：${detail.join("；")}`);
    }

    // ②′ 注册表路径字段重写（新根内；workspace／workspaceRoot 指新工作区根——
    //     整表搬运保留的存量值会被宿主序列化输出与权限判定消费，不重写则重启后指旧根）
    registryResult = rewriteRegistryFile(dshHome);

    // ③ --profiles（失败同样不 retire）
    if (profiles) profileResult = rewriteProfiles(dshHome, { dryRun: false });

    // ④ 旧根 retired（最后一步；此前任何失败均不影响旧布局）
    retired = retireOldRoots(dshHome);

    const report = {
      schema: REPORT_SCHEMA, at: new Date().toISOString(), dshHome, mode: "execute",
      verified: true, facesBefore, facesAfter, faceDiffs: [],
      treeVerify: { data: treeData, workspaces: treeWs },
      registryRewrite: registryResult,
      profiles: profileResult, retired,
      note: "旧根只读窗口（retired-<ts>）；确认无读者后清理另点名；就绪核验见方案 §5 步骤 5。facesAfter 为拷贝复验相（注册表重写前）快照——重写后态见 registryRewrite.sha256After／changedFields"
    };
    console.log(JSON.stringify(report, null, 2));
    writeReport(reportPath, report);
    return 0;
  } catch (error) {
    // 失败中止语义：新根整树删除，旧根不动（retire 未执行或已回滚）
    cleanupNewRoots(dshHome);
    console.error(`[migrate] 失败中止（新根已清理、旧根原样，不留半迁移态）：${error.message}`);
    return 1;
  }
}

// 入口守护：被 import（测试消费纯函数面）时不执行主流程
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().then((code) => process.exit(code ?? 0)).catch((error) => {
    const code = error instanceof MigrationRefusal ? 2 : 1;
    console.error(`[migrate] ${error.message}`);
    process.exit(code);
  });
}
