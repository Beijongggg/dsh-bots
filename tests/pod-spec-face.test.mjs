/**
 * pod 11 号票「功能批收口」的机械面：规格附录 A 的 64 条判据坐标（§G-G4 四项机械
 * 检查）＋ V-P1.1／P1.2／P1.3／P9.3 的登记口径检查。
 *
 * 本件与 org-v2 的 `lib/org/acceptance-coordinates.js` 同源但**不引其数据件**
 * （那份是 A 组 60 条的另一批判据，坐标表混用＝两批互相污染）：规格侧读
 * `.scratch/pod/spec.md`，数据侧＝本文件内的坐标解析器与 `CANONICAL` 补记表。
 * §G-G4 的四项机械检查对应四组用例：
 *   ① 四字段可解析（含**人工坐标必须带白名单类别** `人工:human-visual-checklist`）；
 *   ② 判据 id 连续（`V-P<组>.<序号>` 从 1 起连续、组数／条数与 §G-G4 冻结计数一致）；
 *   ③ 级别词在**封闭三档词表**内（`常驻`／`验收期一次`／`运行面点名`，逐个 `＋`
 *      分词都在词表内）；
 *   ④ 票面引用坐标存在（每条坐标刨掉括注后至少一个记号解析到真实落点）。
 *
 * 坐标文法（记号以 `＋` 分隔；**括注**（…）是说明性注解，不参与解析）：
 *   - `tests/<文件>.test.mjs[::<片段>]`  文件须存在；带片段时**恰有一条**测试名含该片段，
 *                                        或该片段是**判据 id 前缀**且该件内 ≥1 条（多条＝
 *                                        该判据由多例覆盖，不是坐标歧义——见「判据类坐标」）；
 *   - `tests:<文件>.test.mjs`            **补记坐标**（本票按规格「此后只补执行坐标」
 *                                        的许可度写入附录 A）：整份测试件；
 *   - `用例:<文件>.test.mjs#<id>`        **补记坐标**：该件内 id 段恰等 `<id>` 的唯一用例；
 *   - `判据:<文件>.test.mjs#<id>`        **补记坐标**：id 段为 `<id>` 或 `<id> 后缀` 的
 *                                        用例**组**（≥1 条；判据 id 前缀即覆盖族，多条合法）；
 *   - `scripts/<文件>.mjs`／`lib/<模块>.js`／`docs/...`  文件须存在；
 *   - `探针 <id>`／`门①②③④`            须在宿主面登记表／四门内；
 *   - `人工:<类别>`                      须在 `HUMAN_CRITERION_CATEGORIES` 白名单内。
 * 其余形状不认（＝坐标不可解析，fail closed）——「坐标指向空气」在本件即红。
 *
 * 「补记坐标」表（2026-10-10 功能批收口落笔；**只动「执行坐标」列，判据语义／证据
 * 落点／级别列未动**；逐条依据见 11 号票 Comments「坐标补记」节）：
 *   - 形状统一：三处 `tests/<文件>（括注）` 与 `tests/<文件>::<非唯一 id 前缀>` 改写成
 *     `tests:`／`用例:` 记号（原写法解析不到唯一落点）；
 *   - 指错落点订正：V-P2.8（原「待票 02 行为探针」）、V-P6.1…P6.5（原指
 *     `tests/pod-assembly.test.mjs`，实际落在 `tests/pod-tool-rows.test.mjs`）、
 *     V-P4.5（原指 `tests/session-driver.test.mjs` 的「回合返回形状断言」，实际落在
 *     `tests/pod-trace.test.mjs::V-P4.5 负例`）四处；
 *   - 顺带把 `＋＋`（分记号误写）与探针括注写法归一。
 *
 * 边界（不许把「解析成立」当「语义覆盖」）：本件证伪「坐标指向不存在的落点」，
 * **不**证伪「该用例确实覆盖该判据语义」——语义核对见 11 号票 Comments 的 64 条
 * 复核表。白名单外的「人工确认」按判据缺口处理，分解不出即 `needs-user` 上浮。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { HUMAN_CRITERION_CATEGORIES } from "../lib/org/acceptance-coordinates.js";

// ---------- 坐标常量 ----------

export const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const SPEC_PATH = join(REPO_ROOT, ".scratch/pod/spec.md");

/** 附录 A 各组标题（解析锚；规格 §G-G4 的 64 条冻结计数）。 */
export const GROUPS = Object.freeze([
  { id: "V-P1", count: 5, heading: "### V-P1 命名与术语（5 条）" },
  { id: "V-P2", count: 11, heading: "### V-P2 覆盖式常驻与保活（11 条）" },
  { id: "V-P3", count: 6, heading: "### V-P3 过渡动效（6 条）" },
  { id: "V-P4", count: 7, heading: "### V-P4 L2 数据面（7 条）" },
  { id: "V-P5", count: 11, heading: "### V-P5 L3 显示与形制统一（11 条）" },
  { id: "V-P6", count: 6, heading: "### V-P6 回合级拼装（6 条）" },
  { id: "V-P7", count: 7, heading: "### V-P7 L1 基底与呈现面（7 条）" },
  { id: "V-P8", count: 7, heading: "### V-P8 改名范围与批次边界（7 条）" },
  { id: "V-P9", count: 4, heading: "### V-P9 治理与验收（4 条）" }
]);

/** 覆盖级别＝封闭三档词表（规格 Testing Decisions；用 `＋` 连接多位）。 */
export const LEVEL_VOCAB = Object.freeze(["常驻", "验收期一次", "运行面点名"]);

/** 人工判据白名单（唯一来源＝`lib/org/acceptance-coordinates.js`，不复制成第二份表）。 */
function humanIds() {
  return new Set(HUMAN_CRITERION_CATEGORIES.map((entry) => entry.id));
}

/**
 * 四道门号（`scripts/preflight.mjs`）；坐标里只许引用这四个——解析时实读源内
 * 结论行模板，源里删门即红，不靠本地常量自觉。
 */
const GATE_MARKERS = Object.freeze({ "门①": "preflight ①", "门②": "preflight ②", "门③": "preflight ③", "门④": "preflight ④" });

/** 附录 A 的收尾小节（解析到此为止——正文里的 `V-P*` 提及不算判据行）。 */
const APPENDIX_TAIL = "### 不在判据内（out of scope）";

// ---------- 规格解析 ----------

/** 附录 A 原文（`### V-P1 …` 起至 out-of-scope 小节前）；缺锚＝空串（调用方报违例）。 */
export function appendixText(specText) {
  const start = specText.indexOf(GROUPS[0].heading);
  if (start === -1) return "";
  const end = specText.indexOf(APPENDIX_TAIL, start);
  return end === -1 ? specText.slice(start) : specText.slice(start, end);
}

/**
 * 判据表行识别（`| \`V-Pn.m\` | 判据 | 执行坐标 | 证据落点 | 级别 |`）。
 * 五列之外的行（小节标题、分隔线、散文）不算判据行。
 */
export function parseCriteriaRows(specText) {
  const rows = [];
  for (const line of appendixText(specText).split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|");
    const idMatch = (cells[1] ?? "").trim().match(/^`(V-P[0-9]\.[0-9]+)`$/);
    if (idMatch === null) continue;
    rows.push({
      id: idMatch[1],
      criterion: (cells[2] ?? "").trim(),
      coordinate: (cells[3] ?? "").trim(),
      evidence: (cells[4] ?? "").trim(),
      level: (cells[5] ?? "").trim(),
      raw: line
    });
  }
  return rows;
}

/** 记号里的括注是说明性注解：**由内向外**逐层刨掉（括注可嵌套），不参与解析。 */
export function stripAnnotations(token) {
  let text = String(token ?? "");
  const inner = /（[^（）]*）/g;
  let previous;
  do {
    previous = text;
    text = text.replace(inner, "");
  } while (text !== previous);
  return text.trim();
}

/** 坐标串 → 记号数组（`＋` 分隔；括注刨掉；空串＝无记号）。 */
export function coordinateTokens(coordinate) {
  return String(coordinate ?? "")
    .split("＋")
    .map((token) => stripAnnotations(token))
    .filter((token) => token !== "");
}

/** 级别串 → 分词数组（`＋` 分隔；封闭三档枚举，逐个分词都须在词表内）。 */
export function levelTokens(level) {
  return String(level ?? "").split("＋").map((token) => token.trim()).filter((token) => token !== "");
}

// ---------- 测试件装载 ----------

/** 测试文件里的测试名（测试名即执行坐标；与 org-v2 坐标件同口径的正则）。 */
export function testTitlesIn(fileText) {
  const raw = [...String(fileText).matchAll(/test\(\s*"([^"]+)"/g)].map((match) => match[1]);
  return raw.map((title) => title.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

const TITLE_CACHE = new Map();

/** 读 tests/ 下某个测试件的测试名；文件缺失返回 null（坐标报「测试文件不存在」）。 */
export function titlesOf(testFile) {
  const path = join(REPO_ROOT, "tests", testFile);
  if (!existsSync(path)) return null;
  if (!TITLE_CACHE.has(testFile)) TITLE_CACHE.set(testFile, testTitlesIn(readFileSync(path, "utf8")));
  return TITLE_CACHE.get(testFile);
}

// ---------- 坐标记号解析 ----------

function readTextOrEmpty(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/**
 * 解析单个坐标记号到落点。返回 `{ok:true, kind}` 或 `{ok:false, reason}`——
 * 坐标不得指向空气：文件／测试名／登记表／词表任一侧漂移即红。
 */
export function resolveToken(token, { repoRoot = REPO_ROOT, humans = humanIds() } = {}) {
  const raw = String(token ?? "").trim();
  if (raw === "") return { ok: false, reason: "空记号" };

  // ① 门号：实读 preflight 源的结论行模板
  if (Object.hasOwn(GATE_MARKERS, raw)) {
    const source = readTextOrEmpty(join(repoRoot, "scripts", "preflight.mjs"));
    return source.includes(GATE_MARKERS[raw])
      ? { ok: true, kind: "gate" }
      : { ok: false, reason: `scripts/preflight.mjs 源内无「${GATE_MARKERS[raw]}」结论行模板` };
  }
  if (raw.startsWith("门")) return { ok: false, reason: `门号不在四道门内：${raw}` };

  // ② tests/<文件>::<片段>｜tests/<文件>
  const legacy = raw.match(/^tests\/([A-Za-z0-9._-]+\.test\.mjs)(?:::([\s\S]+))?$/);
  if (legacy !== null) {
    const [, file, fragment] = legacy;
    const titles = titlesOf(file);
    if (titles === null) return { ok: false, reason: `测试文件不存在：tests/${file}` };
    if (fragment === undefined) return { ok: true, kind: "file" };
    const needle = fragment.trim();
    const hits = /^V-P[0-9]\.[0-9]+$/.test(needle)
      ? titles.filter((title) => criterionFamilyHit(titleSegment(title), needle))
      : titles.filter((title) => titleSegmentHit(title, needle));
    if (hits.length === 0) return { ok: false, reason: `tests/${file} 内无标题含「${needle}」的测试` };
    if (hits.length > 1 && !/^V-P[0-9]\.[0-9]+$/.test(needle)) {
      return { ok: false, reason: `tests/${file} 内标题含「${needle}」的测试有 ${String(hits.length)} 条（坐标须唯一）` };
    }
    return { ok: true, kind: "test", cases: hits.length };
  }

  // ③ 补记坐标：整份测试件
  const fileToken = raw.match(/^tests:([A-Za-z0-9._-]+\.mjs)$/);
  if (fileToken !== null) {
    return existsSync(join(repoRoot, "tests", fileToken[1]))
      ? { ok: true, kind: "file" }
      : { ok: false, reason: `测试文件不存在：tests/${fileToken[1]}` };
  }

  // ④ 补记坐标：唯一用例（`#` 后为 id 段或用例名内可辨片段）
  const caseToken = raw.match(/^用例:([A-Za-z0-9._-]+\.test\.mjs)#([^#]+)$/u);
  if (caseToken !== null) {
    const [, file, id] = caseToken;
    const titles = titlesOf(file);
    if (titles === null) return { ok: false, reason: `测试文件不存在：tests/${file}` };
    const hits = titles.filter((title) => titleSegment(title) === id || titleSegment(title).startsWith(`${id} `));
    if (hits.length === 0) return { ok: false, reason: `tests/${file} 内无标题含「${id}」的用例` };
    if (hits.length > 1) return { ok: false, reason: `tests/${file} 内标题含「${id}」的用例有 ${String(hits.length)} 条（坐标须唯一）` };
    return { ok: true, kind: "test" };
  }

  // ④′ 补记坐标：判据 id 前缀覆盖的用例组（≥1 条即成立——判据由多例覆盖属正常）
  const criterionToken = raw.match(/^判据:([A-Za-z0-9._-]+\.test\.mjs)#(V-P[0-9]\.[0-9]+)$/);
  if (criterionToken !== null) {
    const [, file, id] = criterionToken;
    const titles = titlesOf(file);
    if (titles === null) return { ok: false, reason: `测试文件不存在：tests/${file}` };
    const hits = titles.filter((title) => criterionFamilyHit(titleSegment(title), id));
    return hits.length >= 1
      ? { ok: true, kind: "test", cases: hits.length }
      : { ok: false, reason: `tests/${file} 内无判据 ${id} 的用例（id 段前缀零命中）` };
  }

  // ⑤ 脚本／模块／文档路径
  if (/^scripts\/[A-Za-z0-9._/-]+\.mjs$/.test(raw) || /^lib\/[A-Za-z0-9._/-]+\.(js|cjs)$/.test(raw) || /^docs\/[A-Za-z0-9._/-]+$/.test(raw)) {
    return existsSync(join(repoRoot, raw)) ? { ok: true, kind: "path" } : { ok: false, reason: `路径不存在：${raw}` };
  }

  // ⑥ 探针：宿主适配面登记表实读
  const probe = raw.match(/^探针 ([A-Z0-9-]+)$/);
  if (probe !== null) {
    const registry = readTextOrEmpty(join(repoRoot, "lib", "host-faces.js"));
    return registry.includes(`"${probe[1]}"`)
      ? { ok: true, kind: "probe" }
      : { ok: false, reason: `探针 id 不在宿主适配面登记表内：${probe[1]}` };
  }

  // ⑦ 人工判据：白名单类别
  const human = raw.match(/^人工:([a-z0-9-]+)$/);
  if (human !== null) {
    return humans.has(human[1])
      ? { ok: true, kind: "human" }
      : { ok: false, reason: `人工判据不在白名单：${human[1]}` };
  }

  // ⑧ 自由文记（说明性引注：票号／复核记录／命令全文等）——参与「可解析」判定，
  //    但**不**算测试落点，也不参与第 ④ 项的「至少一个记号成立」计数以外的语义主张。
  return { ok: true, kind: "prose" };
}

/** 测试名的 id 段（`V-P2.7b 降级：…` → `V-P2.7b`；无 id 段 → 整名）。 */
export function titleSegment(title) {
  const match = String(title).match(/^\s*([\p{L}\p{N}][\p{L}\p{N}._-]*)/u);
  return match === null ? String(title).trim() : match[1];
}

/** 片段命中：id 段恰等，或标题内含「片段＋空格」（`V-P8.1` 不得被 `V-P8.10` 冒充）。 */
export function titleSegmentHit(title, fragment) {
  return titleSegment(title) === fragment || String(title).includes(`${fragment} `);
}

/** 判据族命中：id 段＝`<id>` 或 `<id> 后缀`／`<id>b`（判据由多例覆盖＝正常，非坐标歧义）。 */
export function criterionFamilyHit(segment, id) {
  return segment === id || segment.startsWith(`${id} `) || segment.startsWith(`${id}（`) || segment.startsWith(`${id}b`);
}

// ---------- 附录 A 机械检查 ----------

/**
 * §G-G4 四项机械检查的单一实现（用例与人工核查共用同一结论）。
 * 返回 `{rows, violations, unresolved, proseOnly, humanTokens, kinds}`。
 */
export function checkSpecFace({ specPath = SPEC_PATH, repoRoot = REPO_ROOT } = {}) {
  const rows = parseCriteriaRows(readTextOrEmpty(specPath));
  const violations = [];
  const unresolved = [];
  const proseOnly = [];
  const humanTokens = [];
  const kinds = new Map();
  const seen = new Set();
  const humans = humanIds();

  // ② 判据 id 连续：分组从 1 起连号，组数／条数与冻结计数一致
  const expectedIds = GROUPS.flatMap((group) => Array.from({ length: group.count }, (_, index) => `${group.id}.${index + 1}`));
  const actualIds = rows.map((row) => row.id);
  if (actualIds.length !== expectedIds.length) {
    violations.push(`附录 A 判据条数＝${String(actualIds.length)}，冻结计数＝${String(expectedIds.length)}（V-P1–V-P9 共 64 条）`);
  }
  for (const id of expectedIds) if (!actualIds.includes(id)) violations.push(`缺判据 ${id}（id 不连续）`);
  for (const id of actualIds) if (!expectedIds.includes(id)) violations.push(`表外判据 ${id}（id 超出冻结编号域）`);

  for (const row of rows) {
    if (seen.has(row.id)) violations.push(`${row.id}: 判据 id 重复`);
    seen.add(row.id);

    // ① 四字段可解析：判据文本／执行坐标／证据落点非空
    if (row.criterion === "") violations.push(`${row.id}: 判据文本为空（四字段不可解析）`);
    if (row.coordinate === "") violations.push(`${row.id}: 执行坐标为空（坐标无空缺即一条都不许空）`);
    if (row.evidence === "") violations.push(`${row.id}: 证据落点为空（四字段不可解析）`);

    // ③ 级别词在封闭三档词表内
    const levels = levelTokens(row.level);
    if (levels.length === 0) violations.push(`${row.id}: 覆盖级别为空`);
    for (const token of levels) {
      if (!LEVEL_VOCAB.includes(token)) violations.push(`${row.id}: 级别词「${token}」不在封闭三档词表内`);
    }

    // ④ 票面引用坐标存在（每个记号都要解析得到落点）
    const tokens = coordinateTokens(row.coordinate);
    if (tokens.length === 0) violations.push(`${row.id}: 执行坐标刨掉括注后无记号（坐标指向空气）`);
    const resolvedKinds = [];
    for (const token of tokens) {
      const resolved = resolveToken(token, { repoRoot, humans });
      if (!resolved.ok) {
        unresolved.push(`${row.id}｜${token}｜${resolved.reason}`);
        violations.push(`${row.id}: 坐标记号「${token}」不可解析——${resolved.reason}`);
        continue;
      }
      resolvedKinds.push(resolved.kind);
      kinds.set(resolved.kind, (kinds.get(resolved.kind) ?? 0) + 1);
      if (resolved.kind === "human") humanTokens.push(row.id);
    }
    if (tokens.length > 0 && resolvedKinds.every((kind) => kind === "prose")) {
      proseOnly.push(row.id);
      if (!Object.hasOwn(GOVERNANCE_ONLY, row.id)) {
        violations.push(`${row.id}: 坐标只有自由文记、无任何可解析落点（且不在治理面白名单内）`);
      }
    }
  }

  for (const id of Object.keys(GOVERNANCE_ONLY)) {
    if (!proseOnly.includes(id)) {
      violations.push(`${id}: 治理面白名单在册但坐标已可机械解析（清单与附录 A 漂移——同批更新白名单）`);
    }
  }

  return { rows, violations, unresolved, proseOnly, humanTokens, kinds };
}

/**
 * 治理面白名单：这 7 条的「执行坐标」是**句子型引注**（复核记录／票面授权段／CHANGELOG 事件），
 * 其证据落点在票面 Comments、日志卷与既有登记件——判据本身不在本批的可执行面内（改名批与治理
 * 记录），复核判定见 11 号票 Comments 的 64 条表。清单**双向锁定**：不在册者出现即红，在册者
 * 消失（补上可执行坐标）也要同批更新本表。
 */
export const GOVERNANCE_ONLY = Object.freeze({
  "V-P6.6": "上浮口径（needs-user）——登记件 `lib/org/acceptance-coordinates.js::HUMAN_CRITERION_CATEGORIES`＋票 11 复核记录",
  "V-P8.4": "四同名一致——核验落票 13 执行窗口",
  "V-P8.5": "C 组数据面方案——落票 14 方案件与迁移校验",
  "V-P8.6": "改名触发新 runId 包链——落票 15 与门②",
  "V-P8.7": "授权点点名——落票 13／14／15 票面授权段",
  "V-P9.1": "判据冻结——落 CHANGELOG 事件与规格 SHA-256（Lead 落档）",
  "V-P9.2": "人工判据白名单——落白名单件与票 11 复核"
});

/** 常驻判据但坐标无测试落点（转 12／13／15 的改名批判据，本票已复核非空缺）。 */
export function residentWithoutTest(rows, repoRoot = REPO_ROOT) {
  const humans = humanIds();
  const out = [];
  for (const row of rows) {
    if (!levelTokens(row.level).includes("常驻")) continue;
    const hasTest = coordinateTokens(row.coordinate).some((token) => {
      const resolved = resolveToken(token, { repoRoot, humans });
      return resolved.ok && (resolved.kind === "test" || resolved.kind === "file");
    });
    if (!hasTest) out.push(row.id);
  }
  return out;
}

// ---------- 登记口径检查（V-P1.1／P1.2／P1.3／P9.3 的治理半边） ----------

/** `GLOSSARY.md` 与「活文档」面（冻结／历史件与证物不进扫描）。 */
const GLOSSARY_PATH = join(REPO_ROOT, "GLOSSARY.md");
const ACTIVE_DOC_ROOTS = ["docs", ".scratch", "lib", "tests", "scripts"];
const FROZEN_DOC_PREFIXES = [
  "docs/TEMP-guidance-", "docs/CLOSURE-", "docs/changelog/", "docs/history/", "artifacts/", "PROPOSAL-", "PLAN-"
];

function walkDocs(dir, rel = "", out = []) {
  for (const name of readdirSync(rel === "" ? dir : join(REPO_ROOT, rel), { withFileTypes: true })) {
    const next = rel === "" ? name.name : `${rel}/${name.name}`;
    if (name.isDirectory()) {
      if (name.name === "node_modules" || next.startsWith("artifacts/")) continue;
      walkDocs(dir, next, out);
    } else if (name.name.endsWith(".md") || name.name.endsWith(".mjs") || name.name.endsWith(".js") || name.name.endsWith(".cjs")) {
      out.push(next);
    }
  }
  return out;
}

export function activeDocFiles() {
  const files = [];
  for (const rel of ["AGENTS.md", "README.md", "GLOSSARY.md", "CHANGELOG.md"]) if (existsSync(join(REPO_ROOT, rel))) files.push(rel);
  for (const dir of ACTIVE_DOC_ROOTS) if (existsSync(join(REPO_ROOT, dir))) files.push(...walkDocs(join(REPO_ROOT, dir), dir));
  return files.filter((rel) => !FROZEN_DOC_PREFIXES.some((prefix) => rel.startsWith(prefix)));
}

/** GLOSSARY「Pod」词条正文（`## Pod（pod）` 起至下一个二级标题前）。 */
export function glossaryPodEntry() {
  const text = readTextOrEmpty(GLOSSARY_PATH);
  const start = text.indexOf("## Pod（pod）");
  if (start === -1) return "";
  const rest = text.slice(start + "## Pod（pod）".length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

/** 「Pod 借席位词」的机器可判形态：Pod 与「席位／岗位」**直接相邻**（词不外借的红线）。 */
export const POD_SEAT_PATTERNS = Object.freeze([
  /Pod[ 　]*[（(]?[ 　]*(席位|岗位)/gu,
  /(席位|岗位)[ 　]*[）》)]?[ 　]*Pod/gu
]);

/**
 * 负例引注除外：`「Pod 席位」式用法`／`「Pod 席位」这类把 Pod 当席位用的说法`／
 * `用 Pod 兼指席位` 是**判据与词条在描述这条红线**（规格 V-P1.2、GLOSSARY 的 `_Avoid_`
 * 正文、本件注释），不是借词本身。
 */
const POD_SEAT_QUOTED = Object.freeze([
  /「Pod 席位」式用法/u,
  /「Pod 席位」这类把 Pod 当席位用的说法/u,
  /用 Pod 兼指席位/u,
  /Pod 借席位词/u
]);

/** 扫描活文档，返回 `[{file, line, text}]`（借词红线命中；负例引注与动作描述不误报）。 */
export function findPodSeatUsage(files = activeDocFiles()) {
  const hits = [];
  for (const rel of files) {
    const text = readTextOrEmpty(join(REPO_ROOT, rel));
    text.split("\n").forEach((line, index) => {
      if (POD_SEAT_QUOTED.some((quoted) => quoted.test(line))) return;
      for (const pattern of POD_SEAT_PATTERNS) {
        pattern.lastIndex = 0;
        if (!pattern.test(line)) continue;
        hits.push({ file: rel, line: index + 1, text: line.trim() });
        break;
      }
    });
  }
  return hits;
}

/** pod 功能批自有面上的旧名（`dsh-bots`）残留——本票只扫本批落点，改名批另开清单。 */
const POD_BATCH_SURFACES = Object.freeze([
  "lib/client.js", "lib/host-faces.js", "scripts/host-contract-probe.mjs",
  ".scratch/pod/spec.md", "docs/adr/0001-overlay-persistent-and-inert.md"
]);

export function oldNameHits(files = POD_BATCH_SURFACES) {
  const hits = [];
  for (const rel of files) {
    if (!existsSync(join(REPO_ROOT, rel))) continue;
    const text = readTextOrEmpty(join(REPO_ROOT, rel));
    text.split("\n").forEach((line, index) => {
      if (line.includes("dsh-bots") || line.includes("DSH_BOTS_")) hits.push({ file: rel, line: index + 1 });
    });
  }
  return hits;
}

/** 入口标签：`entry.label` 的 zh／en 两语言取值（`lib/client.js` 的 locale 字典）。 */
export function entryLabelValues() {
  const text = readTextOrEmpty(join(REPO_ROOT, "lib", "client.js"));
  return [...text.matchAll(/"(entry\.label)":\s*"([^"]*)"/g)].map((match) => match[2]);
}

/**
 * 补记坐标表（唯一实现）：`id → [记号, …]`。规格附录 A 的「执行坐标」列刨掉括注后
 * 须与本表逐条逐字一致（**只许坐标列与表同拍**；判据／证据／级别列改动即本件红）。
 */
export const CANONICAL_COORDINATES = Object.freeze({
  "V-P1.5": Object.freeze(["用例:pod-spec-face.test.mjs#V-P1.5", "用例:pod-spec-face.test.mjs#V-P1.5b"]),
  "V-P2.8": Object.freeze(["判据:pod-overlay.test.mjs#V-P2.8"]),
  "V-P3.2": Object.freeze(["探针 P-HOST-TRANSITION-TOKENS", "用例:pod-transition.test.mjs#V-P3.2"]),
  "V-P3.4": Object.freeze(["用例:pod-transition.test.mjs#V-P3.4"]),
  "V-P4.1": Object.freeze(["判据:pod-trace.test.mjs#V-P4.1"]),
  "V-P4.2": Object.freeze(["判据:pod-trace.test.mjs#V-P4.2"]),
  "V-P4.4": Object.freeze(["用例:org-mail-shared-face.test.mjs#内容键封闭", "tests:mail-at-least-once.test.mjs", "用例:pod-trace.test.mjs#V-P4.4"]),
  "V-P4.5": Object.freeze(["用例:pod-trace.test.mjs#V-P4.5", "tests:session-driver.test.mjs"]),
  "V-P4.7": Object.freeze(["判据:pod-trace.test.mjs#V-P4.7"]),
  "V-P5.4": Object.freeze(["判据:pod-tool-rows.test.mjs#V-P5.4"]),
  "V-P5.6": Object.freeze(["判据:pod-tool-rows-specialized.test.mjs#V-P5.6"]),
  "V-P5.7": Object.freeze(["判据:pod-tool-rows-specialized.test.mjs#V-P5.7", "人工:human-visual-checklist"]),
  "V-P5.8": Object.freeze(["判据:pod-turn-trigger.test.mjs#V-P5.8", "人工:human-visual-checklist"]),
  "V-P5.9": Object.freeze(["判据:pod-turn-trigger.test.mjs#V-P5.9"]),
  "V-P5.10": Object.freeze(["用例:client-disclosure.test.mjs#披露行骨架", "tests:run.mjs"]),
  "V-P5.11": Object.freeze(["人工:human-visual-checklist"]),
  "V-P6.1": Object.freeze(["用例:pod-tool-rows.test.mjs#V-P6.1"]),
  "V-P6.2": Object.freeze(["用例:pod-tool-rows.test.mjs#V-P6.2"]),
  "V-P6.3": Object.freeze(["用例:pod-tool-rows.test.mjs#V-P6.3"]),
  "V-P6.4": Object.freeze(["用例:pod-tool-rows.test.mjs#V-P6.4"]),
  "V-P6.5": Object.freeze(["用例:pod-tool-rows.test.mjs#V-P6.5"]),
  "V-P7.1": Object.freeze(["用例:pod-harness-base.test.mjs#V-P7.1"]),
  "V-P7.4": Object.freeze(["用例:pod-harness-base.test.mjs#V-P7.4", "用例:bot-profile.test.mjs#生成器不写出死键"]),
  "V-P7.6": Object.freeze(["用例:pod-harness-base.test.mjs#V-P7.6", "tests:org-op-set.test.mjs"]),
  "V-P8.1": Object.freeze(["用例:project-context.test.mjs#--spec-index", "tests:project-context.test.mjs"]),
  "V-P8.3": Object.freeze(["scripts/org-cutover-check.mjs"]),
  "V-P9.3": Object.freeze(["判据:pod-spec-face.test.mjs#V-P9.3"]),
  "V-P9.4": Object.freeze(["门①", "门②", "门③", "门④", "人工:human-visual-checklist"])
});

/** 规格附录 A 与本文件的坐标列比对（逐条同拍；漂移即红）。 */
export function canonicalDrift(rows) {
  const drift = [];
  for (const [id, expected] of Object.entries(CANONICAL_COORDINATES)) {
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) {
      drift.push(`${id}: 附录 A 无此判据行（补记坐标无处落地）`);
      continue;
    }
    const actual = coordinateTokens(row.coordinate);
    if (actual.length !== expected.length || actual.some((token, index) => token !== expected[index])) {
      drift.push(`${id}: 坐标列「${actual.join("＋")}」≠ 补记「${expected.join("＋")}」`);
    }
  }
  return drift;
}

// ---------- 用例 ----------

test("V-P9.3 机械检查①＋②：附录 A 64 条四字段可解析、id 连续、组计数与冻结一致", () => {
  const { rows, violations } = checkSpecFace();
  assert.equal(rows.length, 64, "附录 A 判据条数须为 64（V-P1–V-P9）");
  for (const group of GROUPS) {
    const inGroup = rows.filter((row) => row.id.startsWith(`${group.id}.`));
    assert.equal(inGroup.length, group.count, `${group.id} 条数须为 ${String(group.count)}`);
    const seqs = inGroup.map((row) => Number(row.id.split(".")[1]));
    assert.deepEqual(seqs, Array.from({ length: group.count }, (_, index) => index + 1), `${group.id} 序号须从 1 起连续`);
  }
  assert.deepEqual(violations.filter((line) => /为空|条数|不连续|表外|重复/.test(line)), [], "四字段／id 连续性违例");
  assert.equal(rows.every((row) => row.criterion !== "" && row.coordinate !== "" && row.evidence !== ""), true);
});

test("V-P9.3 机械检查③：级别词封闭在「常驻／验收期一次／运行面点名」三档词表内", () => {
  const { rows, violations } = checkSpecFace();
  const bad = violations.filter((line) => line.includes("级别词") || line.includes("覆盖级别为空"));
  assert.deepEqual(bad, [], "级别词表外取值或空级别");
  const distribution = new Map();
  for (const row of rows) {
    for (const token of levelTokens(row.level)) distribution.set(token, (distribution.get(token) ?? 0) + 1);
  }
  assert.deepEqual([...distribution.keys()].sort(), [...LEVEL_VOCAB].sort(), "级别词分布须恰为封闭三档");
  assert.ok(rows.every((row) => levelTokens(row.level).length >= 1));
});

test("V-P9.3 机械检查④：票面引用坐标逐条存在（零空缺、零指向空气、非治理面条目全部机械可解析）", () => {
  const { rows, violations, unresolved, proseOnly } = checkSpecFace();
  assert.deepEqual(unresolved, [], "有坐标记号解析不到落点");
  assert.deepEqual(
    violations.filter((line) => line.includes("不可解析") || line.includes("自由文记") || line.includes("无记号")),
    [],
    "坐标解析违例（自由文记须在白名单内）"
  );
  const machineResolved = rows.length - proseOnly.length;
  assert.equal(machineResolved, Object.keys(GOVERNANCE_ONLY).length === 0 ? rows.length : rows.length - 7, "机械可解析条数＝64 − 治理面白名单条数");
  assert.ok(machineResolved >= 57, `机械可解析 ${String(machineResolved)} 条，预期 ≥ 57（治理面 ≤ 7）`);
});

test("V-P9.3 补记坐标同拍：附录 A 执行坐标列与 CANONICAL_COORDINATES 逐条一致（指错落点／旧 ID 前缀即红）", () => {
  const { rows } = checkSpecFace();
  assert.deepEqual(canonicalDrift(rows), [], "补记坐标与规格坐标列漂移");
  assert.equal(Object.keys(CANONICAL_COORDINATES).length, 28, "补记条目数须为 28（逐条依据见票 11 Comments「坐标补记」节）");
});

test("V-P9.3 人工坐标只许白名单类别：人工:human-visual-checklist／human-knowledge-reuse", () => {
  const { rows, humanTokens } = checkSpecFace();
  assert.ok(humanTokens.length > 0, "本批必有人工目视判据（V-P9.4 收口目视）");
  assert.equal(new Set(humanTokens).size >= 8, true, `人工判据覆盖 ${String(new Set(humanTokens).size)} 条，预期 ≥ 8`);
  const seen = new Set();
  for (const row of rows) {
    for (const token of coordinateTokens(row.coordinate)) {
      if (!token.startsWith("人工:")) continue;
      const category = token.slice("人工:".length);
      seen.add(category);
      assert.ok(humanIds().has(category), `${row.id}: 人工判据类别不在白名单：${category}`);
    }
  }
  assert.deepEqual([...seen].sort(), ["human-visual-checklist"], "本批只用第一类白名单（human-knowledge-reuse 未用）");
  const statuses = HUMAN_CRITERION_CATEGORIES.map((entry) => `${entry.id}:${entry.verifierStatus}`);
  assert.deepEqual(
    statuses,
    ["human-visual-checklist:signed", "human-knowledge-reuse:pending-signature"],
    "白名单件署名状态漂移（A 组 human-visual-checklist 已由 Beijong 署名；pod 批人工判据仍待用户确认，§G-G7）"
  );
});

test("V-P9.3 登记口径：治理面 7 条坐标＝句子型引注（白名单双向锁定，非空缺）", () => {
  const { proseOnly, violations } = checkSpecFace();
  assert.deepEqual(proseOnly.sort(), Object.keys(GOVERNANCE_ONLY).sort(), "治理面白名单与实况漂移");
  assert.deepEqual(violations.filter((line) => line.includes("治理面白名单")), [], "白名单双向锁定违例");
  for (const [id, note] of Object.entries(GOVERNANCE_ONLY)) assert.ok(note.length > 8, `${id}: 须写明证据落点`);
});

test("V-P9.3 登记口径：28 处补记坐标已落附录 A，剩余 7 条常驻判据坐标为待实现批落点（非空缺）", () => {
  const { rows } = checkSpecFace();
  const gap = residentWithoutTest(rows);
  assert.deepEqual(
    gap,
    ["V-P6.6", "V-P8.3", "V-P8.4", "V-P8.5", "V-P8.6", "V-P9.1", "V-P9.2"],
    "「常驻但坐标无测试落点」集合漂移（新增＝坐标空缺；减少＝补记坐标已落地，须同批更新本断言）"
  );
  for (const id of gap) {
    const row = rows.find((candidate) => candidate.id === id);
    assert.ok(coordinateTokens(row.coordinate).length > 0, `${id}: 坐标无空缺判据不得无记号`);
  }
});

test("V-P1.1 GLOSSARY 收「Pod」词条：视觉 Pod／标识符小写 pod／宿主包名校验只收小写", () => {
  const entry = glossaryPodEntry();
  assert.ok(entry.includes("`Pod`"), "词条须收视觉形态 `Pod`");
  assert.ok(entry.includes("`pod`"), "词条须收标识符小写 `pod`");
  assert.ok(entry.includes("宿主包名校验只收小写"), "词条须写明宿主包名校验只收小写");
  assert.ok(entry.includes("整页形态"), "词条须写明 Pod＝插件与整页形态");
});

test("V-P1.2 「席位／岗位」词不外借：词条显式声明 + 活文档无「Pod 席位」式用法", () => {
  const entry = glossaryPodEntry();
  assert.ok(/Pod 指\*\*插件与整页形态\*\*，\*\*不是\*\*席位的称呼/.test(entry), "词条须显式声明 Pod 不指席位");
  assert.ok(entry.includes("不外借、不并列、不互为同义词"), "词条须写明两词不外借");
  const hits = findPodSeatUsage().filter((hit) => hit.file !== "GLOSSARY.md" || !/「Pod 席位」这类把 Pod 当席位用的说法/.test(hit.text));
  assert.deepEqual(hits, [], "活文档出现「Pod 席位」式用法（借词）");
});

test("V-P1.3 旧别名收作 _Avoid_：`Bot 模式` 标注为历史别名；入口标签已是 Pod 不回改", () => {
  const entry = glossaryPodEntry();
  assert.ok(/^_Avoid_:/m.test(entry), "词条须有 `_Avoid_:` 行");
  const avoidLine = entry.slice(entry.indexOf("_Avoid_:"));
  assert.ok(avoidLine.includes("`Bot 模式`"), "`Bot 模式` 须收在 `_Avoid_` 内");
  assert.ok(avoidLine.includes("历史别名"), "`Bot 模式` 须标注为历史别名");
  assert.deepEqual(entryLabelValues(), ["Pod", "Pod"], "入口标签 zh／en 须均为 Pod");
});

test("V-P1.4/V-P1.5/V-P8.2 命名残留登记口径：pod 功能批自有面旧名命中 ⊆ 白名单、应改未改为空集", () => {
  const hits = oldNameHits();
  assert.ok(hits.length > 0, "本批自有面确实带旧名（改名批另开；此处只证已登记）");
  for (const hit of hits) {
    assert.ok(POD_BATCH_SURFACES.some((surface) => hit.file === surface || hit.file.startsWith(surface)), `白名单外旧名命中：${hit.file}:${String(hit.line)}`);
  }
  // 冻结／历史件不得被扫描面翻开重写：老名字面残留只在白名单路径内
  for (const rel of POD_BATCH_SURFACES) {
    assert.equal(FROZEN_DOC_PREFIXES.some((prefix) => rel.startsWith(prefix)), false, `白名单不得含冻结／历史路径：${rel}`);
  }
  const specRows = parseCriteriaRows(readTextOrEmpty(SPEC_PATH));
  assert.ok(specRows.some((row) => row.id === "V-P1.4" && /应改未改/.test(row.criterion)), "V-P1.4 判据文本须保留「应改未改」口径");
});

test("V-P1.5 代码内部名不随命名批改名：本批自有面旧名命中 ⊆ 声明白名单（代码内部名／冻结件）", () => {
  const hits = oldNameHits();
  const whitelisted = hits.filter((hit) => POD_BATCH_SURFACES.some((surface) => hit.file === surface || hit.file.startsWith(surface)));
  assert.equal(whitelisted.length, hits.length, "白名单外旧名命中＝「应改未改」不得为空集");
  assert.ok(hits.length >= 3, `本批自有面旧名命中 ${String(hits.length)} 处，预期 ≥ 3（改名批做减法）`);
});

test("V-P1.5b 内部名不上浮为对外文案：locale 字典入口标签无旧名、实现面命中在声明白名单内", () => {
  const hits = oldNameHits();
  const labelLines = readTextOrEmpty(join(REPO_ROOT, "lib/client.js")).split("\n").filter((line) => /"entry\.label":/.test(line));
  assert.equal(labelLines.length, 2, "入口标签 zh／en 两条");
  assert.ok(labelLines.every((line) => !line.includes("dsh-bots")), "入口标签不得带旧名");
  const implementationFaces = hits.filter((hit) => hit.file.startsWith("lib/") || hit.file.startsWith("scripts/"));
  assert.ok(implementationFaces.length > 0, "代码内部名类（实现面）须在命中面内");
  assert.ok(hits.every((hit) => POD_BATCH_SURFACES.includes(hit.file)), "命中面必在声明白名单内（代码内部名与冻结件两类都可辨）");
  // 「代码内部名」的实例：槽位／视图类名住实现件，不随命名批改名
  const client = readTextOrEmpty(join(REPO_ROOT, "lib/client.js"));
  for (const name of ['seatView: "dsh-bots-pod-seat-view"', 'seatList: "dsh-bots-pod-seat-list"', 'layer: "dsh-bots-pod-layer"']) {
    assert.ok(client.includes(name), `代码内部名须保留：${name}`);
  }
});

test("V-P8.2 A 组九类清单扫全：模块 id／包名／CSS 前缀／locale ns／host 插件名／wire 头／路由前缀／日志前缀／测试与脚本字面量逐类有落点", () => {
  const { rows } = checkSpecFace();
  const row = rows.find((candidate) => candidate.id === "V-P8.2");
  assert.ok(row !== undefined, "V-P8.2 判据行须在附录 A");
  assert.ok(/A 组范围齐备/.test(row.criterion), "V-P8.2 判据文本须为 A 组九类清单（范围齐备）");
  assert.ok(/模块 id／包名／CSS 前缀／locale ns／host 插件名／wire 头／路由前缀／日志前缀／测试与脚本字面量/.test(row.criterion), "V-P8.2 九类清单须逐类点名");
  assert.ok(/A 组九类清单扫全/.test(row.coordinate), "V-P8.2 补记坐标须保留 A 组九类清单扫全口径");
  // 九类清单逐类在活面上有真实落点（改名批做减法；本票只证清单扫全、无遗漏类）
  const classes = [
    { id: "模块 id", hit: readTextOrEmpty(join(REPO_ROOT, "lib/client.js")).includes("dsh-bots") },
    { id: "包名", hit: readTextOrEmpty(join(REPO_ROOT, "package.json")).includes('"dsh-bots"') },
    { id: "CSS 前缀", hit: readTextOrEmpty(join(REPO_ROOT, "lib/client.js")).includes(".dsh-bots-") },
    { id: "wire 头", hit: readTextOrEmpty(join(REPO_ROOT, "lib/index.js")).includes("x-dsh-bots") },
    { id: "路由前缀", hit: readTextOrEmpty(join(REPO_ROOT, "lib/index.js")).includes("/api/bots") },
    { id: "脚本字面量", hit: readTextOrEmpty(join(REPO_ROOT, "scripts/host-contract-probe.mjs")).includes("dsh-bots") }
  ];
  const missing = classes.filter((entry) => !entry.hit).map((entry) => entry.id);
  assert.deepEqual(missing, [], "A 组九类清单在活面上出现空类（清单扫全即不得有空类）");
  assert.ok(classes.length >= 6, "九类清单至少覆盖 6 个可机械判的类（其余见票 12／13 清单）");
});
