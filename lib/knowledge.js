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
 *   - ID = R-<年>-<三位序号>（按 index 现有今年最大序号 +1，跨年重置）；
 *   - registerReport：title/body/summary 必填；id/botId/date 自动填充；
 *     supersedes → 旧条目标 status="updated" + 写 supersededBy（保留旧版
 *     痕迹，防误引用已被否定的结论）；supersedes 指向不存在的 id 报错
 *     （防悬空指针）；reused 引用 → 旧条目 reusedBy 追加并去重，未知 id
 *     静默忽略（引用过往是宽松语义）；
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
 *     整段持 lockdir 写锁（acquireIndexLock，见下），读侧不持锁（rename
 *     原子性保证读到完整旧版或完整新版）。
 */

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { planInvalidation } from "./org/memory-layer.js";

const requireCjs = createRequire(import.meta.url);
const { writeFileAtomic } = requireCjs("./shared.cjs");

/** 知识库根目录：`<dshHome>/bots/knowledge/`。 */
export function knowledgeDir(dshHome) {
  return join(dshHome, "bots", "knowledge");
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
 * 跨进程索引写锁（lockdir 互斥）。每个 bot 实例是独立进程、各自持插件副本
 * 并发触达同一索引；registerReport 的「读索引 → 分配 ID → 副作用变异 →
 * 原子写回」整段在锁内，否则并发登记会撞 ID / 丢更新（K-1 实证）。
 *
 * 协议：mkdirSync(lockDir) 原子获取（目录创建唯一成功者）；已存在 → 短自旋
 * （tickMs 步进，Atomics.wait 睡眠）；持有者按目录 mtime 判定为死亡
 * （闲置 > staleMs）→ 递归删除接管（陈旧接管）。正常临界区为同步亚毫秒级，
 * 持有者在 tickMs 内释放；spinMs 内未获得 → 抛错（registerReport 转
 * ok:false 返回给模型，可重试）。
 *
 * 释放前核对锁内 owner.json 的 pid：**仅确认仍属本进程才删除**——已被他人
 * 接管、或 owner 不可读（无法证明归属）均不删（防「释放误删活锁」；泄漏的
 * 锁目录由陈旧接管自愈）。进程死亡不释放 → 后续登记者的
 * 陈旧接管兜底：最长停滞 staleMs 后自动恢复，之后登记不再阻塞。
 *
 * 导出仅为测试（超时/接管路径）；registerReport 内部使用，默认参数即生产参数。
 */
export function acquireIndexLock(dshHome, { spinMs = 6000, staleMs = 3000, tickMs = 20 } = {}) {
  const dir = lockDirFor(dshHome);
  const deadline = Date.now() + spinMs;
  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(join(dir, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }));
      return {
        release() {
          let own = false;
          try {
            const owner = JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
            own = owner.pid === process.pid; // 已被他人接管 → false，不动别人的锁
          } catch {
            // owner 缺失/不可读：无法证明锁仍属本进程，保守不删（F-E 变体：
            // 恰逢接管者 rm→mkdir 间隙时强删会删掉他人的新锁，制造无互斥临界
            // 区）；泄漏的锁目录由后续登记者的陈旧接管（>staleMs）自愈。
          }
          if (!own) return;
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* 已被接管删除：无害 */ }
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(dir).mtimeMs > staleMs) {
          rmSync(dir, { recursive: true, force: true }); // 陈旧接管：直接删除重试
          continue;
        }
      } catch {
        // 目录刚好被释放/接管删除：重试获取
      }
      if (Date.now() >= deadline) {
        throw new Error(`知识库索引锁超时（${spinMs}ms 内未获得）`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, tickMs);
    }
  }
}

/** 本轮年份内现有报告的最大序号；无 → 0。 */
function maxSeqOfYear(entries, year) {
  let max = 0;
  const prefix = `R-${year}-`;
  for (const entry of entries) {
    const id = typeof entry.id === "string" ? entry.id : "";
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

/** 下一条报告 ID：`R-<年>-<三位序号>`（跨年重新编号）。 */
export function nextReportId(dshHome, now = new Date()) {
  const year = now.getUTCFullYear();
  const seq = maxSeqOfYear(readIndex(dshHome), year) + 1;
  return formatReportId(year, seq);
}

/**
 * 登记一份报告：写 reports/<id>.md + 更新 index.jsonl（含 supersedes /
 * reused 副作用），返回 {ok:true, id, entry} 或 {ok:false, error}。
 *
 * - 校验失败（title/body/summary 必填）返回 ok:false，不动任何文件；
 * - 先写报告后写索引：索引写失败时报告文件可能残留（孤儿，无害）。重试
 *   会得到**同一个 id**（索引未变 → 序号不变，孤儿被本次合法登记覆盖）；
 *   仅当失败与重试之间已有他人登记使序号前移时，孤儿才保留（MVP 不回收）；
 * - supersedes：指向的旧条目不存在 → ok:false（防悬空指针）；存在 →
 *   旧条目标 status="updated" + supersededBy=新 id（保留旧版痕迹）；
 * - reused：追加到旧条目 reusedBy（去重）；未知 id 静默忽略。
 *
 * **并发安全**（多进程共享存储，K-1 修复）：读改写整段持
 * acquireIndexLock 的 lockdir 写锁；ID 只从锁内一次读到的 entries 计算
 * （无第二读）。锁内亚毫秒级，正常无感知；锁超时（超过 spinMs）返回
 * ok:false（与存储失败同路，模型可重试）。
 */
export function registerReport({ dshHome, botId, input, now = new Date() }) {
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
    const lock = acquireIndexLock(dshHome);
    try {
      const items = readIndexDetailed(dshHome);
      const entries = items.filter((it) => it.ok).map((it) => it.entry);

      // ID 从已读的 entries 计算（不再二次 readIndex——消除双重 TOCTOU；
      // 双读窗口内另一进程可能已登记同号）。
      const year = now.getUTCFullYear();
      const seq = maxSeqOfYear(entries, year) + 1;
      const id = formatReportId(year, seq);

      // 副作用校验：supersedes 悬空 → 报错（在写任何文件之前）
      const supersedesTarget = typeof input.supersedes === "string" && input.supersedes.trim() !== ""
        ? input.supersedes.trim() : null;
      if (supersedesTarget !== null && !entries.some((e) => e.id === supersedesTarget)) {
        return { ok: false, error: `supersedes 指向的报告 "${supersedesTarget}" 不存在` };
      }

      // 1) 报告全文落盘（先报告后索引；失败即错误返回）
      writeFileAtomic(join(reportsDirFor(dshHome), `${id}.md`), body);

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
 * 幂等之外的状态守卫：已 `deprecated` 的条目再废弃即拒（非法转移，不重复翻）。
 * 返回 `{ok:true, id, entry}` 或 `{ok:false, error}`。
 */
export function deprecateReport({ dshHome, id, reason = "", now = new Date() }) {
  try {
    if (typeof id !== "string" || id.trim() === "") return { ok: false, error: "id 不能为空" };
    if (typeof reason !== "string") return { ok: false, error: "reason 须为字符串（废弃理由留痕；可留空）" };
    const patchVerdict = planInvalidation({ action: "deprecate", targetId: id.trim() });
    if (!patchVerdict.ok) return { ok: false, error: patchVerdict.violations.join("；") };
    const patch = patchVerdict.patch;

    mkdirSync(knowledgeDir(dshHome), { recursive: true });
    const lock = acquireIndexLock(dshHome);
    try {
      const items = readIndexDetailed(dshHome);
      const entries = items.filter((it) => it.ok).map((it) => it.entry);
      const target = entries.find((entry) => entry.id === patch.id);
      if (target === undefined) return { ok: false, error: `废弃目标 "${patch.id}" 不存在` };
      if (target.status === "deprecated") return { ok: false, error: `"${patch.id}" 已是 deprecated（不重复废弃）` };

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
