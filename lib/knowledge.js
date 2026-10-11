/**
 * 团队调研知识底座（v1 MVP）—— 纯函数核心，与 index.js 的工具注册层分离
 * （同 lib/stats.js 先例：独立模块便于测试与演进）。设计见
 * PROPOSAL-knowledge-base.md（团队 8-22 讨论收敛：标准化报告模板 + 共享
 * 索引清单；明确不做全文检索/自动入库/自动打标签）。
 *
 * 存储布局（$DSH_HOME/bots/knowledge/，与 inbox/outbox 平级）：
 *   index.jsonl         索引清单：一行一条索引记录（JSON）
 *   reports/<id>.md     报告全文（R-2026-001.md）
 *   REPORT_TEMPLATE.md  标准报告模板（ensureKnowledgeBase 缺省创建；
 *                       用户可改，重装/重启不覆盖）
 *
 * 语义不变量（tests/knowledge.test.mjs 钉住）：
 *   - ID = R-<年>-<三位序号>（跨年重置；索引水位与当年既有报告共同占号，
 *     损坏／非对象行保留占位；报告独占创建，已有正文不被覆盖写）；
 *   - registerReport：title/body/summary 必填；id/botId/date 自动填充；
 *     supersedes → 旧条目须为 valid（已 deprecated／已有后继／未知状态
 *     一律拒，且在写任何文件之前），旧条目标 status="updated" + 写
 *     supersededBy（保留旧版痕迹，防误引用已被否定的结论）；supersedes
 *     指向不存在的 id 报错（防悬空指针）；reused 引用 → 旧条目 reusedBy
 *     追加并去重，未知 id 静默忽略（引用过往是宽松语义）；
 *   - deprecateReport：只接受 valid（已 updated／deprecated／未知状态
 *     一律拒）；`deprecatedReason/At` 与 `supersededBy` 互斥——新守卫下
 *     混合态不再产生，存量混合态由只读 `auditKnowledgeIndex` 核验＋人工清；
 *   - searchIndex：id/标题/标签/摘要/核心结论/适合任务类型子串命中（大小写
 *     不敏感），status 可选过滤，空 query 全列、按登记倒序截 10——索引级
 *     检索，不做全文检索；
 *   - 索引损坏行读侧跳过（不因单行损坏拖垮整个清单），**登记重写时
 *     原样保留**（不吞信息：损坏/非对象行随重写存活，仅读侧不可见）；
 *   - 失效唯一机制（org-v2 10 号票 `V-A7.8`）＝**显式取代／废弃登记**：
 *     supersedes 走 registerReport 的副作用，废弃走 deprecateReport——两者都是
 *     append 语义（翻状态＋留痕，不物理删除），**不做**自动失效、自动打分或
 *     访问热字段。补丁形状由 `lib/org/memory-layer.js planInvalidation` 单源产出，
 *     本模块只负责在锁内把它落到索引上（协议形状不在两处各写一份）；
 *   - 跨进程互斥：每个 bot 实例是独立进程、各自持插件副本并发触达同一
 *     索引，registerReport 的「读索引 → 分配 ID → 副作用变异 → 原子写回」
 *     整段持 lockdir 写锁（acquireIndexLock → lib/lock-dir.js，36 号票 A9 起与
 *     邮局 seq 锁同一份实现），读侧不持锁（rename
 *     原子性保证读到完整旧版或完整新版）。
 */

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { acquireLockDir } from "./lock-dir.js";
import { lockWaitSink } from "./lock-trace.js";
import { planInvalidation } from "./org/memory-layer.js";
// 数据面路径单源（14 号票收敛）：知识库根只活在 lib/data-roots.cjs。
import { knowledgeRoot as rootsKnowledgeRoot } from "./data-roots.cjs";

const requireCjs = createRequire(import.meta.url);
const { writeFileAtomic } = requireCjs("./shared.cjs");

/** 知识库根目录：`<dshHome>/<dataRoot>/knowledge/`。 */
export function knowledgeDir(dshHome) {
  return rootsKnowledgeRoot(dshHome);
}
/** 索引清单文件（一行一条 JSON）。 */
export function indexFile(dshHome) {
  return join(knowledgeDir(dshHome), "index.jsonl");
}
/** 报告全文目录（<id>.md）。 */
export function reportsDirFor(dshHome) {
  return join(knowledgeDir(dshHome), "reports");
}
/** 标准报告模板路径。 */
export function templateFileFor(dshHome) {
  return join(knowledgeDir(dshHome), "REPORT_TEMPLATE.md");
}

/** 默认报告模板（ensureKnowledgeBase 缺省写入；用户可编辑，不覆盖）。 */
const DEFAULT_TEMPLATE = `# 报告标题

> 报告 ID：（登记时自动生成）
> 交付日期：（登记时自动填充）
> 产出者：（登记时自动填充）
> 任务溯源：（可选：委托方 / 任务标识）
> 状态：valid（有效 / updated 已更新 / deprecated 已废弃）

## 摘要

（3~5 句结论速览，供索引检索与快速判断）

## 核心结论

1. （可被引用的条列，每条尽量带来源）

## 引用来源

- 名称 / 机构 / 日期 / 链接

## 适合任务类型

（后续哪些任务可复用本报告）

## 复用/引用来源

（本次复用/引用了哪些历史报告 ID，如 R-2026-001；无则写「无」）
`;

/**
 * 安装幂等：创建知识库目录（根 + reports）与缺省模板。**不覆盖**已存在的
 * 模板（用户可能已自定义——模板是团队协作规范，重启/升级不得回滚它）。
 */
export function ensureKnowledgeBase(dshHome) {
  const dir = knowledgeDir(dshHome);
  mkdirSync(dir, { recursive: true });
  mkdirSync(reportsDirFor(dshHome), { recursive: true });
  const templatePath = templateFileFor(dshHome);
  if (!existsSync(templatePath)) {
    writeFileSync(templatePath, DEFAULT_TEMPLATE, "utf8");
  }
}

/** 索引写锁目录：knowledge/.lock/（跨进程互斥，见 acquireIndexLock）。 */
function lockDirFor(dshHome) {
  return join(knowledgeDir(dshHome), ".lock");
}

/**
 * 读取索引原始行（内部）：JSON 对象行 → {ok:true, entry}；损坏行/非对象行
 * → {ok:false, raw: 原文}。registerReport 重写索引时据此**原样保留**未解析行，
 * 避免「登记操作静默吞掉损坏行」（K-2）；readIndex 只在读侧跳过它们。
 */
function readIndexDetailed(dshHome) {
  const file = indexFile(dshHome);
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of String(readFileSync(file, "utf8")).split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      const value = JSON.parse(trimmed);
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        out.push({ ok: true, entry: value, raw: line });
      } else {
        out.push({ ok: false, entry: null, raw: line }); // 合法 JSON 但非对象行也保留
      }
    } catch {
      out.push({ ok: false, entry: null, raw: line });
    }
  }
  return out;
}

/** 读取索引全部条目（非法/非对象行跳过；文件缺失 → []）。 */
export function readIndex(dshHome) {
  const entries = [];
  for (const item of readIndexDetailed(dshHome)) {
    if (item.ok) entries.push(item.entry);
  }
  return entries;
}

/**
 * 知识库索引写锁（跨进程 lockdir 互斥）。每个 bot 实例是独立进程、各自持插件
 * 副本并发触达同一索引；registerReport 的「读索引 → 分配 ID → 副作用变异 →
 * 原子写回」整段在锁内，否则并发登记会撞 ID / 丢更新（K-1 实证）。
 *
 * 协议实现＝`lib/lock-dir.js`（36 号票 A9 起，与邮局 seq 锁同一份实现、同一
 * 缺省参数 `LOCK_DEFAULTS`）：mkdir 原子获取＋owner.json；短自旋等待，
 * **`spinMs`（缺省 1500ms）即单次宿主事件循环冻结的上限**；接管两条判据——
 * 持有者 pid 已死立即接管（死主快路，最常见的一次性长等待就此消失），
 * 无有效 pid 的锁沿用 mtime 超 `staleMs`（缺省 1000ms）的恢复方式。已知 pid
 * 存活或无权探测时只等待、超时，不按目录年龄抢锁；rm 前复核同一锁实例。
 * 释放只认锁内 owner.json 的本进程 pid，无法证明归属不删。超时抛错后，
 * registerReport 转 ok:false 返回给模型，可重试。
 *
 * `onWait(info)`＝本次获取发生争用／接管／超时的留痕回调（字段见
 * `lib/lock-trace.js`）；无争用的快路径不回调。
 *
 * 导出仅为测试（超时／接管／留痕路径）；registerReport 内部使用，默认参数即生产参数。
 */
export function acquireIndexLock(dshHome, options = {}) {
  return acquireLockDir(lockDirFor(dshHome), {
    lockId: "knowledge-index",
    label: "知识库索引锁",
    ...options
  });
}

/** 本轮年份内现有报告的最大序号；无 → 0。 */
function maxSeqOfYear(ids, year) {
  let max = 0;
  const prefix = `R-${year}-`;
  for (const value of ids) {
    const id = typeof value === "string" ? value : "";
    if (!id.startsWith(prefix)) continue;
    const seq = Number(id.slice(prefix.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return max;
}

/** 报告 ID 的唯一格式化点：`R-<年>-<三位序号>`（改格式只动这里）。 */
function formatReportId(year, seq) {
  return `R-${year}-${String(seq).padStart(3, "0")}`;
}

/**
 * 下一序号同时高于索引水位和 reports/ 当年既有报告的最大序号。
 * 行数无法恢复稀疏索引中的空号，已有正文必须独立占号，包括索引缺失时的
 * 孤儿报告。不可解析行仍保守计入当年水位。目录不存在按空目录处理，其它
 * 读取错误向上传递，不能在无法核对旧报告时继续登记。
 * `registerReport` 在锁内调用，`nextReportId` 只读预览，共用本函数。
 */
function nextSeqForYear(dshHome, items, year) {
  const entries = items.filter((it) => it.ok).map((it) => it.entry);
  const parsedMax = maxSeqOfYear(entries.map((entry) => entry.id), year);
  let reportNames;
  try {
    reportNames = readdirSync(reportsDirFor(dshHome));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    reportNames = [];
  }
  const reportMax = maxSeqOfYear(
    reportNames.filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)), year
  );
  const prefix = `R-${year}-`;
  let goodOfYear = 0;
  let unparseable = 0;
  for (const it of items) {
    if (!it.ok) {
      unparseable += 1;
    } else if (typeof it.entry.id === "string" && it.entry.id.startsWith(prefix)) {
      goodOfYear += 1;
    }
  }
  return Math.max(parsedMax, reportMax, goodOfYear + unparseable) + 1;
}

/** 下一条报告 ID：`R-<年>-<三位序号>`（跨年重新编号）。 */
export function nextReportId(dshHome, now = new Date()) {
  const year = now.getUTCFullYear();
  const seq = nextSeqForYear(dshHome, readIndexDetailed(dshHome), year);
  return formatReportId(year, seq);
}

/**
 * 登记一份报告：写 reports/<id>.md + 更新 index.jsonl（含 supersedes /
 * reused 副作用），返回 {ok:true, id, entry} 或 {ok:false, error}。
 *
 * - 校验失败（title/body/summary 必填）返回 ok:false，不动任何文件；
 * - 先独占创建报告，成功后才写索引。正文或索引写失败时可能留下未登记报告，
 *   后续登记将其视为已占号，不覆盖、不自动回收；重试使用新 id。
 * - supersedes：指向的旧条目不存在 → ok:false（防悬空指针）；存在 →
 *   旧条目标 status="updated" + supersededBy=新 id（保留旧版痕迹）；
 * - reused：追加到旧条目 reusedBy（去重）；未知 id 静默忽略。
 *
 * **并发安全**（多进程共享存储，K-1 修复）：读改写整段持
 * acquireIndexLock 的 lockdir 写锁（协议＝lib/lock-dir.js）；ID 从锁内读到的
 * 索引与报告文件名分配。锁超时（超过 spinMs）返回
 * ok:false（与存储失败同路，模型可重试）。
 * `logger`（可缺省）＝锁争用留痕出口：等待超阈、接管、超时经其 `warn` 单行
 * 落账（口径见 lib/lock-trace.js）；宿主装配面传 ctx.logger，测试夹具可省。
 */
export function registerReport({ dshHome, botId, input, now = new Date(), logger = null }) {
  try {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const body = typeof input.body === "string" ? input.body.trim() : "";
    const summary = typeof input.summary === "string" ? input.summary.trim() : "";
    if (title === "") return { ok: false, error: "title 不能为空" };
    if (body === "") return { ok: false, error: "body（报告正文）不能为空" };
    if (summary === "") return { ok: false, error: "summary（摘要）不能为空" };

    // 跨进程互斥：读索引 → 分配 ID → 副作用校验/变异 → 原子写回，整段持锁。
    // 每个 bot 实例是独立进程、各自持插件副本并发触达同一索引；无互斥时
    // 的读改写会撞 ID / 丢登记（K-1 实证）。读侧（knowledge_search）不持锁：
    // writeFileAtomic 的 rename 原子性保证读到的总是完整旧版或完整新版。
    // 锁获取失败（超时）与存储失败同路：ok:false 返回给模型，可重试。
    mkdirSync(knowledgeDir(dshHome), { recursive: true });
    const lock = acquireIndexLock(dshHome, { onWait: lockWaitSink(logger) });
    try {
      const items = readIndexDetailed(dshHome);
      const entries = items.filter((it) => it.ok).map((it) => it.entry);

      // 索引不二次读取；报告目录独立占号，水位口径见 nextSeqForYear。
      const year = now.getUTCFullYear();
      const seq = nextSeqForYear(dshHome, items, year);
      const id = formatReportId(year, seq);

      // 副作用校验：supersedes 悬空 → 报错（在写任何文件之前）
      const supersedesTarget = typeof input.supersedes === "string" && input.supersedes.trim() !== ""
        ? input.supersedes.trim() : null;
      if (supersedesTarget !== null) {
        const prevEntry = entries.find((e) => e.id === supersedesTarget);
        if (prevEntry === undefined) {
          return { ok: false, error: `supersedes 指向的报告 "${supersedesTarget}" 不存在` };
        }
        // 34 号票 A7b：取代只接受 valid——已废弃／已有后继的条目不可再被取代
        // （两终态，拒绝路径在写任何文件之前，不动报告与索引）。
        if (prevEntry.status === "deprecated") {
          return { ok: false, error: `"${supersedesTarget}" 已是 deprecated（已废弃条目不可再被取代）` };
        }
        if (prevEntry.status === "updated") {
          const succ = typeof prevEntry.supersededBy === "string" ? prevEntry.supersededBy : "";
          return { ok: false, error: `"${supersedesTarget}" 已被${succ === "" ? "取代" : ` "${succ}" 取代`}（有后继条目不可再被取代；链式取代请指后继条目）` };
        }
        // valid 以外一律拒（未知状态亦 fail closed，不假设可取代）。
        if (prevEntry.status !== "valid") {
          return { ok: false, error: `"${supersedesTarget}" 状态 "${String(prevEntry.status)}" 不可取代（取代只接受 valid 条目）` };
        }
      }

      // 1) 先独占创建正文，再发布索引；扫描后即便目标被外部写者占用也不覆盖。
      mkdirSync(reportsDirFor(dshHome), { recursive: true });
      writeFileSync(join(reportsDirFor(dshHome), `${id}.md`), body, { encoding: "utf8", flag: "wx" });

      // 2) 组装新条目（botId/date/id 机器侧填充；status 默认 valid）
      const entry = {
        id,
        title,
        tags: Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === "string" && t.trim() !== "") : [],
        summary,
        conclusions: Array.isArray(input.conclusions) ? input.conclusions.filter((c) => typeof c === "string" && c.trim() !== "") : [],
        sources: Array.isArray(input.sources) ? input.sources.filter((s) => typeof s === "string" && s.trim() !== "") : [],
        appliesTo: typeof input.appliesTo === "string" ? input.appliesTo.trim() : "",
        task: typeof input.task === "string" ? input.task.trim() : "",
        botId: String(botId ?? ""),
        date: now.toISOString(),
        status: "valid"
      };

      // 3) 副作用：supersedes（旧条目保留痕迹）+ reused（旧条目复用记录，去重）
      const reusedIds = Array.isArray(input.reused)
        ? input.reused.filter((v) => typeof v === "string" && v.trim() !== "").map((v) => v.trim())
        : [];
      for (const prev of entries) {
        if (supersedesTarget !== null && prev.id === supersedesTarget) {
          prev.status = "updated";
          prev.supersededBy = id;
        }
        if (reusedIds.includes(prev.id)) {
          if (!Array.isArray(prev.reusedBy)) prev.reusedBy = [];
          if (!prev.reusedBy.includes(id)) prev.reusedBy.push(id);
        }
      }

      // 4) 索引清单落盘（原子写）：已解析行重排为 JSON；损坏/非对象行原样
      //    保留在原文位置（K-2：登记不得静默吞掉修复线索）
      const lines = items.map((it) => (it.ok ? JSON.stringify(it.entry) : it.raw));
      lines.push(JSON.stringify(entry));
      writeFileAtomic(indexFile(dshHome), lines.join("\n") + "\n");
      return { ok: true, id, entry };
    } finally {
      lock.release();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 废弃登记（org-v2 10 号票 `V-A7.8`「显式取代/废弃登记」的**废弃腿**）。
 * 与 supersedes 的区别：取代有后继条目（`supersededBy` 指针），废弃没有——
 * 结论被否定而无替代品时的收口形态。
 *
 * 补丁形状**不经本模块发明**：取 `lib/org/memory-layer.js planInvalidation`
 * 的产出（`{id, status:"deprecated", ...}`，键封闭、时间无关、无热字段位），
 * 本模块只把它按 append 语义落到索引上——旧条目连同 `deprecatedReason` 留在
 * `index.jsonl` 里，`reports/<id>.md` 不删（归档不删档）。
 *
 * 幂等之外的状态守卫（34 号票 A7b 两终态）：只接受 `valid`——已 `updated`
 * （有后继）／已 `deprecated`／未知状态一律拒（非法转移，不叠加残留字段）。
 * 返回 `{ok:true, id, entry}` 或 `{ok:false, error}`。
 */
export function deprecateReport({ dshHome, id, reason = "", now = new Date(), logger = null }) {
  try {
    if (typeof id !== "string" || id.trim() === "") return { ok: false, error: "id 不能为空" };
    if (typeof reason !== "string") return { ok: false, error: "reason 须为字符串（废弃理由留痕；可留空）" };
    const patchVerdict = planInvalidation({ action: "deprecate", targetId: id.trim() });
    if (!patchVerdict.ok) return { ok: false, error: patchVerdict.violations.join("；") };
    const patch = patchVerdict.patch;

    mkdirSync(knowledgeDir(dshHome), { recursive: true });
    const lock = acquireIndexLock(dshHome, { onWait: lockWaitSink(logger) });
    try {
      const items = readIndexDetailed(dshHome);
      const entries = items.filter((it) => it.ok).map((it) => it.entry);
      const target = entries.find((entry) => entry.id === patch.id);
      if (target === undefined) return { ok: false, error: `废弃目标 "${patch.id}" 不存在` };
      if (target.status === "deprecated") return { ok: false, error: `"${patch.id}" 已是 deprecated（不重复废弃）` };
      // 34 号票 A7b：废弃只接受 valid——已有后继（updated）的条目不可再废弃
      // （两终态；`deprecatedReason/At` 与 `supersededBy` 互斥，不叠加残留字段）。
      if (target.status === "updated") {
        const succ = typeof target.supersededBy === "string" ? target.supersededBy : "";
        return { ok: false, error: `"${patch.id}" 已被${succ === "" ? "取代" : ` "${succ}" 取代`}（有后继条目不可再废弃；废弃请指后继条目）` };
      }
      // valid 以外一律拒（未知状态亦 fail closed，不假设可废弃）。
      if (target.status !== "valid") {
        return { ok: false, error: `"${patch.id}" 状态 "${String(target.status)}" 不可废弃（废弃只接受 valid 条目）` };
      }

      target.status = patch.status;
      if (reason.trim() !== "") target.deprecatedReason = reason.trim();
      target.deprecatedAt = now.toISOString();

      const lines = items.map((it) => (it.ok ? JSON.stringify(it.entry) : it.raw));
      writeFileAtomic(indexFile(dshHome), lines.join("\n") + "\n");
      return { ok: true, id: patch.id, entry: target };
    } finally {
      lock.release();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 存量核验（34 号票口径，一次性核验＋留痕，不自动迁移）。
 *
 * 只读扫描 `index.jsonl`，不持锁、不写任何文件，返回
 * `{ok:true, lines, entries, corrupt[], mixed[]}`：
 *   - `corrupt[]`＝不可解析／非对象行 `{line（文件物理行号，1 基；空行
 *     跳过但占号，按此号删行／补行才对得上）, raw（原文）}`——
 *     逐行修（按行号在备份后删行或补回好行）或留待重建；
 *   - `mixed[]`＝残留字段混合态 `{id, line, status, problems[]}`，`problems`
 *     取封闭词表：`deprecated+supersededBy`（废弃 entries 不应有后继指针）、
 *     `updated+deprecatedReason`（有后继 entries 不应有废弃理由／时间，
 *     `deprecatedReason` 与 `deprecatedAt` 键存在即报，不论值类型）、
 *     `valid+residual`（有效 entries 不应带 `supersededBy`／`deprecatedReason`／
 *     `deprecatedAt` 任一键）、`unknown-status`（三态之外）。新守卫（A7b）下
 *     此类混合态不再产生，存量按票面手顺人工清（删互斥侧字段并留痕），
 *     清完复跑本函数归零。
 */
export function auditKnowledgeIndex(dshHome) {
  const file = indexFile(dshHome);
  if (!existsSync(file)) return { ok: true, lines: 0, entries: 0, corrupt: [], mixed: [] };
  const corrupt = [];
  const mixed = [];
  let lines = 0;
  let entries = 0;
  const raws = String(readFileSync(file, "utf8")).split("\n");
  for (let idx = 0; idx < raws.length; idx += 1) {
    const line = raws[idx];
    if (line.trim() === "") continue;
    const lineNo = idx + 1; // 文件物理行号（空行占号，删行／补行按此号）
    lines += 1;
    let value = null;
    let isObject = false;
    try {
      value = JSON.parse(line.trim());
      isObject = value !== null && typeof value === "object" && !Array.isArray(value);
    } catch {
      isObject = false;
    }
    if (!isObject) {
      corrupt.push({ line: lineNo, raw: line });
      continue;
    }
    entries += 1;
    const problems = [];
    const hasSupersededBy = "supersededBy" in value;
    const hasDeprecatedTrace = "deprecatedReason" in value || "deprecatedAt" in value;
    if (value.status === "deprecated") {
      if (hasSupersededBy) problems.push("deprecated+supersededBy");
    } else if (value.status === "updated") {
      if (hasDeprecatedTrace) problems.push("updated+deprecatedReason");
    } else if (value.status === "valid") {
      if (hasSupersededBy || hasDeprecatedTrace) problems.push("valid+residual");
    } else {
      problems.push("unknown-status");
    }
    if (problems.length > 0) {
      mixed.push({ id: typeof value.id === "string" ? value.id : "", line: lineNo, status: value.status, problems });
    }
  }
  return { ok: true, lines, entries, corrupt, mixed };
}
/** 索引级检索（不做全文检索）：query 为空 → 全部；否则 id/标题/标签/摘要/
 *  核心结论/适合任务类型任一子串命中（大小写不敏感）；status 可选过滤。
 *  结果按登记序倒序（最近登记在前）截取最多 max（默认 10）条。 */
export function searchIndex(entries, query, status = null, max = 10) {
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  const out = [];
  for (const entry of entries) {
    if (status !== null && status !== undefined && entry.status !== status) continue;
    if (q !== "") {
      const hay = [
        entry.id, entry.title, entry.summary, entry.appliesTo,
        ...(Array.isArray(entry.tags) ? entry.tags : []),
        ...(Array.isArray(entry.conclusions) ? entry.conclusions : [])
      ].filter((v) => typeof v === "string").join("\n").toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(entry);
  }
  return out.slice(-max).reverse();
}
