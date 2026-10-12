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
 * 坐标文法（记号以 `＋` 分隔；**括注**（…）是说明性注解，不参与解析——**先刨括注、
 * 再按 `＋` 分词**，故括注内的 `＋` 不会把记号切断）：
 *   - `tests/<文件>.test.mjs[::<片段>]`  文件须存在；带片段时**恰有一条**测试名含该片段，
 *                                        或该片段是**判据 id 前缀**且该件内 ≥1 条（多条＝
 *                                        该判据由多例覆盖，不是坐标歧义——见「判据类坐标」）；
 *   - `tests:<文件>.test.mjs`            整份测试件；
 *   - `用例:<文件>.test.mjs#<id>`        该件内 id 段恰等 `<id>` 的唯一用例；
 *   - `判据:<文件>.test.mjs#<id>`        id 段为 `<id>` 或 `<id> 后缀` 的用例**组**
 *                                        （≥1 条；判据 id 前缀即覆盖族，多条合法）；
 *   - `scripts/<文件>.mjs`／`lib/<模块>.js`／`docs/...`  文件须存在；
 *   - `探针 <id>`／`门①②③④`            须在宿主面登记表／四门内；
 *   - `人工:<类别>`                      须在 `HUMAN_CRITERION_CATEGORIES` 白名单内。
 * 其余形状不认（＝坐标不可解析，fail closed）——「坐标指向空气」在本件即红。
 *
 * **core 批适配（2026-10-10 用户裁定：07／08／09 搁置、不并入 core）**：
 * 本件随 `b5021b6` 的功能批收口带入 core，按 core 现状适配两处，四项机械检查本身不变：
 *   1. **搁置清单**（`PARKED_LANDINGS`）：被搁置票的判据坐标允许指向 core 中不存在的
 *      测试件——**在册才放过**（未在册的缺失落点仍红），且**双向锁定**：在册条目若已
 *      能在 core 落地（文件出现）或不再被任何坐标引用，本件同样红（恢复搁置件时须同批
 *      清表）。清单条目逐条注明搁置票与实现保留地（`integration/pod` 提交 sha）。
 *   2. **core 附录 A 未补记白名单**（`UNBACKFILLED_ROWS`）：core 批**只改** `spec.md`
 *      的 `Status:` 行、正文与附录 A 不动，故 integration `b5021b6` 里那轮「执行坐标」
 *      补记在 core 不存在——V-P8.1（命令＋票面引注）在 core 解析不到落点，显式登记在册
 *      （同样双向锁定：一旦解析成立即红；原在册的 V-P8.3 已随改名批 13 落地
 *      `tests/pod-rename-env.test.mjs` 同批移出，2026-10-11）。
 *      其余 26 条补记坐标在 core 现状下**逐条可解析**。
 * 「core 现状锁定表」`CANONICAL_COORDINATES`＝core 附录 A 执行坐标列的快照（逐条与
 * core 附录 A 同拍；integration 那版记的是补记后的写法，两者按同一机制锁定各自现状）。
 * 逐条复核与适配说明见 11 号票 Comments「收口记录（2026-10-10）」。
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

// ---------- 搁置清单与 core 未补记白名单（core 批适配） ----------

/**
 * 搁置清单（2026-10-10 用户裁定：07／08／09 三票搁置、不并入主树；实现保留在
 * `integration/pod`）。被搁置票的判据坐标允许指向 core 中不存在的测试件——**在册才
 * 放过**：未在册的缺失落点仍按「测试文件不存在」报红（`missingLanding`）。
 *
 * **双向锁定**（`parkedDrift`）：在册条目若已能在 core 落地（文件出现）或不再被任何
 * 判据坐标引用，本件同样红——恢复搁置件（另立批次）时须同批清空本表。
 */
export const PARKED_LANDINGS = Object.freeze({
  "tests/pod-tool-rows.test.mjs": "票 07 通用工具行＋回合折叠头（V-P5.1…P5.5 的落点）；实现保留在 integration/pod 371717c",
  "tests/pod-tool-rows-specialized.test.mjs": "票 08 bash／read／search／diff 专用行（V-P5.6／P5.7 的落点）；实现保留在 integration/pod db31833",
  "tests/pod-turn-trigger.test.mjs": "票 09 turn-trigger 形制统一（V-P5.8／P5.9 的落点）；实现保留在 integration/pod 985ff0c",
  "tests/pod-assembly.test.mjs": "票 07 定稿期的计划名（V-P6.1…P6.5 原坐标所指）；实际落点＝ tests/pod-tool-rows.test.mjs，随票 07 一并搁置"
});

/**
 * core 附录 A 未补记白名单：core 批**只改** `spec.md` 的 `Status:` 行（正文与附录 A
 * 不动），故 `b5021b6` 那轮「执行坐标」补记在 core 不存在——以下判据在 core 解析不到
 * 落点，显式登记在册（**双向锁定**：一旦解析成立即须同批移出本表）：
 *   - `V-P8.1`：坐标＝命令引注＋票面引注（integration 补记为 `用例:project-context.test.mjs
 *     #--spec-index`＋`tests:project-context.test.mjs`）。
 *     （`V-P8.3` 原亦在册——改名批 13 落地 `tests/pod-rename-env.test.mjs` 后坐标可解析，
 *     已按锁定规则同批移出，2026-10-11。）
 */
export const UNBACKFILLED_ROWS = Object.freeze({
  "V-P8.1": "命令＋票面引注（core 未补记；落点见票 11 Comments 坐标复核表）"
});

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

/**
 * 坐标串 → 记号数组（**先刨括注、再按 `＋` 分词**；空串＝无记号）。
 * 先刨后分＝括注内的 `＋` 不再把记号切断（core 附录 A 的 V-P1.5／P7.1 等嵌套括注
 * 含 `＋`，先分后刨会留下半个括注，记号解析不到落点）。
 */
export function coordinateTokens(coordinate) {
  return stripAnnotations(coordinate)
    .split("＋")
    .map((token) => token.trim())
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
 * 缺失落点的搁置判定（core 批）：测试件不在 core 但登记在搁置清单 ⇒ 放行
 * （`kind:"parked"`，并回带清单里的相对路径供双向锁定）；未在册的缺失仍 fail closed。
 */
function parkedResolution(testFile) {
  const rel = `tests/${testFile}`;
  return Object.hasOwn(PARKED_LANDINGS, rel) ? { ok: true, kind: "parked", file: rel } : null;
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
    if (titles === null) return parkedResolution(file) ?? { ok: false, reason: `测试文件不存在：tests/${file}` };
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
      : (parkedResolution(fileToken[1]) ?? { ok: false, reason: `测试文件不存在：tests/${fileToken[1]}` });
  }

  // ④ 补记坐标：唯一用例（`#` 后为 id 段或用例名内可辨片段）
  const caseToken = raw.match(/^用例:([A-Za-z0-9._-]+\.test\.mjs)#([^#]+)$/u);
  if (caseToken !== null) {
    const [, file, id] = caseToken;
    const titles = titlesOf(file);
    if (titles === null) return parkedResolution(file) ?? { ok: false, reason: `测试文件不存在：tests/${file}` };
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
    if (titles === null) return parkedResolution(file) ?? { ok: false, reason: `测试文件不存在：tests/${file}` };
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

/**
 * 片段命中：id 段恰等、整名恰等，或标题内含「片段＋界符」（`V-P8.1` 不得被 `V-P8.10`
 * 冒充——界符取空格与全角左括号 `（`：core 附录 A 里 V-P7.4 的片段以 `（` 接续标题）。
 */
export function titleSegmentHit(title, fragment) {
  const text = String(title);
  return titleSegment(text) === fragment || text.trim() === fragment
    || text.includes(`${fragment} `) || text.includes(`${fragment}（`);
}

/** 判据族命中：id 段＝`<id>` 或 `<id> 后缀`／`<id>b`（判据由多例覆盖＝正常，非坐标歧义）。 */
export function criterionFamilyHit(segment, id) {
  return segment === id || segment.startsWith(`${id} `) || segment.startsWith(`${id}（`) || segment.startsWith(`${id}b`);
}

// ---------- 附录 A 机械检查 ----------

/**
 * §G-G4 四项机械检查的单一实现（用例与人工核查共用同一结论）。
 * 返回 `{rows, violations, unresolved, proseOnly, humanTokens, kinds, usedParked}`——
 * `usedParked`＝被坐标实际引用到的搁置清单条目（双向锁定用）。
 */
export function checkSpecFace({ specPath = SPEC_PATH, repoRoot = REPO_ROOT } = {}) {
  const rows = parseCriteriaRows(readTextOrEmpty(specPath));
  const violations = [];
  const unresolved = [];
  const proseOnly = [];
  const humanTokens = [];
  const kinds = new Map();
  const usedParked = new Set();
  const seen = new Set();
  const humans = humanIds();
  /** 句子型引注白名单：治理面 7 条＋core 附录 A 未补记 2 条（均双向锁定）。 */
  const sentenceOnly = new Set([...Object.keys(GOVERNANCE_ONLY), ...Object.keys(UNBACKFILLED_ROWS)]);

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

    // ④ 票面引用坐标存在（每个记号都要解析得到落点；搁置件落点按在册清单放行）
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
      if (resolved.kind === "parked") usedParked.add(resolved.file);
    }
    if (tokens.length > 0 && resolvedKinds.every((kind) => kind === "prose")) {
      proseOnly.push(row.id);
      if (!sentenceOnly.has(row.id)) {
        violations.push(`${row.id}: 坐标只有自由文记、无任何可解析落点（且不在治理面／未补记白名单内）`);
      }
    }
  }

  for (const id of Object.keys(GOVERNANCE_ONLY)) {
    if (!proseOnly.includes(id)) {
      violations.push(`${id}: 治理面白名单在册但坐标已可机械解析（清单与附录 A 漂移——同批更新白名单）`);
    }
  }
  for (const id of Object.keys(UNBACKFILLED_ROWS)) {
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) {
      violations.push(`${id}: core 未补记白名单在册但附录 A 无此判据行`);
      continue;
    }
    const resolvable = coordinateTokens(row.coordinate)
      .some((token) => { const resolved = resolveToken(token, { repoRoot, humans }); return resolved.ok && (resolved.kind === "test" || resolved.kind === "file" || resolved.kind === "parked"); });
    if (resolvable) {
      violations.push(`${id}: core 未补记白名单在册但坐标已可机械解析（同批移出清单）`);
    }
  }

  return { rows, violations, unresolved, proseOnly, humanTokens, kinds, usedParked };
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

/** pod 功能批自有面上的旧名（`dsh-bots`）残留——11 号票扫描面（历史口径；12 号票的全代码面扫描见 `codeFaceOldNameScan`）。 */
const POD_BATCH_SURFACES = Object.freeze([
  "lib/client.js", "lib/host-faces.js", "scripts/host-contract-probe.mjs",
  ".scratch/pod/spec.md", "docs/adr/0001-overlay-persistent-and-inert.md"
]);

/**
 * 11 号票口径：本批自有面上的旧名残留。**记号级**（不是子串级）——`dsh-bots` 后不接
 * `-`／`:`／词字符才算，故身份记号（`x-dsh-bots-*` 头、`DSH_BOTS_*` env、`dsh-bots:org-*`
 * IPC 类型）不计入本扫描面（它们属票 13 的身份／wire 段，见 `codeFaceOldNameScan`）。
 */
export function oldNameHits(files = POD_BATCH_SURFACES) {
  const hits = [];
  for (const rel of files) {
    if (!existsSync(join(REPO_ROOT, rel))) continue;
    const text = readTextOrEmpty(join(REPO_ROOT, rel));
    text.split("\n").forEach((line, index) => {
      if (/dsh-bots(?![-:\w])/.test(line)) hits.push({ file: rel, line: index + 1 });
    });
  }
  return hits;
}

// ---------- 12 号票「仓库内标识符扫」的机械把守面 ----------

/**
 * 代码面旧名残留扫描（12 号票落）：`lib/`／`tests/`／`scripts/` 全文本按**记号**分类，
 * 除下方两类显式许可外**不得再有旧名**——改回旧 CSS 前缀／旧日志前缀／旧 effect 标签／
 * 旧 locale ns／旧元素 id／旧 `data-*` 都会被这条拦下（票 13「剩余命中清单」的机械等价面）。
 *
 * 记号四类（同一批名字，按出现形态分）：
 *   - `bare`   `dsh-bots`（后不接 `-`／`:`／词字符）——模块 id／host 插件名／部署目录段；
 *   - `hyphen` `dsh-bots-…`——`x-dsh-bots-*` 头、部署／备份目录、rpcPrefix／rpcId、`data-*`；
 *   - `colon`  `dsh-bots:…`——`dsh-bots:org-*` IPC 类型与提示段名；
 *   - `env`    `DSH_BOTS_*`（B 组 env，票 13）。
 *
 * 许可两类（**都属票 13 范围**，逐条可复核）：
 *   - `IDENTITY_ALLOW_TOKENS`：`文件 → [完整记号, …]`——按文件逐条登记，且**反向验真**
 *     （许可记号必须真出现过；陈旧项＝白名单腐化，同红）；
 *   - `IDENTITY_ALLOW_SHAPES`：跨文件同形记号（部署目录段、wire 头、IPC 类型、env 名）
 *     ——同样反向验真「形至少命中一次」。
 *
 * 边界（不得扩大扫描面）：**不扫 `docs/`**——冻结件（`docs/TEMP-guidance-*`／
 * `docs/CLOSURE-*`／`docs/changelog/`／`CHANGELOG-legacy-*`／`artifacts/`／历史留档）
 * 与领域文档各有其面，冻结面由门②包内 sha 复验把守；本件自身
 * （`tests/pod-spec-face.test.mjs`）是**许可表的定义处**，不进扫描面（另有专门用例把守）。
 */
export const SCAN_ROOTS = Object.freeze(["lib", "tests", "scripts"]);
export const SCAN_SKIP_FILES = Object.freeze(["tests/pod-spec-face.test.mjs"]);

/** 文件级许可：完整记号，一条一记号（反向验真：必须真出现，防陈旧掩体）。
 *  **15 号票全窗关闭后只余一条**：env 回落夹具（`tests/pod-rename-env.test.mjs` 旧名
 *  离场、夹具改构造形）与迁移工作面两件（随旧根 retired 清理完成退役）均已同批收缩。 */
export const IDENTITY_ALLOW_TOKENS = Object.freeze({
  // 03 号票退役两段的**历史提及**（注释）；活性面已无该段名（retired-section 形）
  "lib/org/role-cards.js": Object.freeze(["dsh-bots:review", "dsh-bots:review-gate"])
});

/**
 * 跨文件同形许可（15 号票全窗关闭后只余一类）：
 *   - `retired-section`：`dsh-bots:review|review-gate`——03 号票退役段名的**历史提及**
 *     （role-cards.js 注释，冻结历史，不随改名回写）。
 * 已删形：`env-name`（env 双读回落兼容窗口的故意残留——窗已关，夹具改构造形）与
 * `migration-face`（数据面迁移工作面的旧插件名裸形——旧根 retired 已清理，脚本与其
 * 夹具退役）随票 15 全窗关闭同批删除；原票 13 身份面三形（`identity-bare`／
 * `hyphen-ns`／`ipc-or-section`）已随 13 号票换新名时删除（再出现即 `hits` 红）。
 * 部署目录（路径片段）不进形许可——一律走文件级许可逐条登记。
 */
export const IDENTITY_ALLOW_SHAPES = Object.freeze([
  // 03 号票退役的提示段名（只应出现在「已退役」历史提及里）
  Object.freeze({ id: "retired-section", re: /^dsh-bots:review(?:-gate)?$/u })
]);

/**
 * 记号 canonical 形：去掉尾随标点空白与**尾随连字符**（`dsh-bots-`、`dsh-bots)` 等
 * 展示形收敛为 `dsh-bots`；模板串整体形 `dsh-bots-${id}` 的收尾 `}` 不在吸收面，
 * canonical 即原样），供许可比对与反向验真共用。
 * 展示形（`token` 原样）仍进 `hits`／`whitelisted`，供票面清单按实际写法引用。
 */
export function normalizeToken(token) {
  return token.trim().replace(/["'`\s),;]+$/u, "").replace(/-+$/u, "");
}

/** 许可比对：canonical 形**精确等值**（各自先 normalizeToken 收敛展示形差异，再等值）。
 *  不用前后缀含括——前缀许可过宽（`DSH_BOTS_HOST_URL` 会连带放行未登记的 `*_EXTRA`
 *  族）；新记号要进许可面须逐条显式登记，不得借既有条目前缀搭车。 */
export function tokenAllowed(allowed, token) {
  const a = normalizeToken(allowed);
  return a !== "" && a === normalizeToken(token);
}

/**
 * 旧**标识符形**（票 12 已扫面）：旧 CSS 类名 `.dsh-bots-*`、旧元素/槽 id `"dsh-bots-*"`、
 * 旧 `data-dsh-bots-*`。身份串（`"dsh-bots"` 本身、`dsh-bots-token` 头名、`dsh-bots/styles`
 * 样式标签 id）不在其中——它们与模块 id／插件名绑定，属票 13。
 */
export const OLD_IDENTIFIER_SHAPE = new RegExp('\\.dsh-bots-|"dsh-bots-(?!token")|data-dsh-bots');

/** 记号四类各一条正则（`dsh-bots` 后不接 `-`／`:`／词字符＝bare）。 */
export const TOKEN_KINDS = Object.freeze([
  Object.freeze({ kind: "bare", re: /dsh-bots(?![-:\w])/gu }),
  // hyphen：先按 `dsh-bots-${…}` 整体吃（模板串），否则吃到词边界即可（TokenKind 只做**命中面**；
  // 许可比对走 `normalizeToken` 的 canonical 形，故带／不带尾随后缀两形等价）
  Object.freeze({ kind: "hyphen", re: /dsh-bots-\$\{[^}]*\}[-\w]*|dsh-bots-[\w./-]*/gu }),
  Object.freeze({ kind: "colon", re: /dsh-bots:[\w-]+/gu }),
  Object.freeze({ kind: "env", re: /DSH_BOTS_[A-Z0-9_]+/gu })
]);

function walkScanFiles(rel, out = []) {
  const dir = rel === "" ? REPO_ROOT : join(REPO_ROOT, rel);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walkScanFiles(next, out);
    } else if (/\.(mjs|cjs|js)$/.test(entry.name) && !SCAN_SKIP_FILES.includes(next)) out.push(next);
  }
  return out;
}

/**
 * 代码面旧名记号扫描。返回 `{hits, whitelisted, scanned, counts, staleAllow, unusedShapes}`：
 *   - `hits`＝许可外记号（应改未改／回归）——空集即 12 号票口径成立；
 *   - `whitelisted`＝票 13 身份面许可残留（逐条可复核，含 `shape` 形名）；
 *   - `staleAllow`＝文件级许可里**没出现过**的记号（白名单腐化，须同批删除）；
 *   - `unusedShapes`＝没有任何命中落到的许可形（同属腐化）。
 * `counts.byKind`／`counts.whitelistedByKind`／`counts.byFile` 供票面「剩余命中清单」直接引用。
 */
export function codeFaceOldNameScan() {
  const files = [];
  for (const root of SCAN_ROOTS) if (existsSync(join(REPO_ROOT, root))) files.push(...walkScanFiles(root));
  const hits = [];
  const whitelisted = [];
  const counts = { byKind: new Map(), whitelistedByKind: new Map(), byFile: new Map() };
  const seen = new Set();
  const usedShapes = new Set();
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const rel of files) {
    const text = readTextOrEmpty(join(REPO_ROOT, rel));
    for (const { kind, re } of TOKEN_KINDS) {
      for (const match of text.matchAll(re)) {
        const token = match[0];
        seen.add(`${rel}\u0000${normalizeToken(token)}`);
        bump(counts.byKind, kind);
        bump(counts.byFile, rel);
        const fileAllow = IDENTITY_ALLOW_TOKENS[rel] ?? [];
        const shape = IDENTITY_ALLOW_SHAPES.find((entry) => entry.re.test(token));
        if (shape !== undefined) usedShapes.add(shape.id); // 形验真：出现即用到（与是否经形放行无关）
        // 判定序：**文件级许可 → 形许可**。登记文件按白名单逐条比对（via=file）；
        // **未登记文件**（`IDENTITY_ALLOW_TOKENS[rel] === undefined`）形匹配即 ok
        // （via=形）——`undefined` 不是「该文件不得留任何旧名」的门。活性门在测试体
        // 三类划分（退役段名／env 回落／迁移工作面）＋bare 落点反向锁（V-P1.4/V-P1.5
        // 用例）；单消费本函数不构成完整门。
        const ok = shape !== undefined
          && (IDENTITY_ALLOW_TOKENS[rel] === undefined || fileAllow.some((allowed) => tokenAllowed(allowed, token)));
        if (ok) {
          whitelisted.push({ file: rel, kind, token, via: IDENTITY_ALLOW_TOKENS[rel] === undefined ? shape.id : "file" });
          bump(counts.whitelistedByKind, kind);
        } else {
          hits.push({ file: rel, kind, token });
        }
      }
    }
  }
  const staleAllow = [];
  for (const [rel, tokens] of Object.entries(IDENTITY_ALLOW_TOKENS)) {
    for (const token of tokens) {
      const hit = [...seen].some((key) => key.startsWith(`${rel}\u0000`) && tokenAllowed(token, key.slice(rel.length + 1)));
      if (!hit) staleAllow.push(`${rel}:${token}`);
    }
  }
  const unusedShapes = IDENTITY_ALLOW_SHAPES.filter((entry) => !usedShapes.has(entry.id)).map((entry) => entry.id);
  return { hits, whitelisted, scanned: files.length, counts, staleAllow, unusedShapes };
}

/** 入口标签：`entry.label` 的 zh／en 两语言取值（`lib/client.js` 的 locale 字典）。 */
export function entryLabelValues() {
  const text = readTextOrEmpty(join(REPO_ROOT, "lib", "client.js"));
  return [...text.matchAll(/"(entry\.label)":\s*"([^"]*)"/g)].map((match) => match[2]);
}

/**
 * core 现状锁定表（唯一实现）：`id → [记号, …]`。规格附录 A 的「执行坐标」列刨掉括注后
 * 须与本表逐条逐字一致（**只许坐标列与表同拍**；判据／证据／级别列改动即本件红）。
 *
 * 与 integration `b5021b6` 那版的关系：那份记的是「执行坐标补记」之后的写法（27 条只动
 * 坐标列）；core 批**不改附录 A**，故本表记的是 core 附录 A 的现状快照——两版按同一机制
 * 锁定各自现状，差异条目＝补记坐标与搁置件落点（详见 11 号票 Comments）。
 */
export const CANONICAL_COORDINATES = Object.freeze({
  "V-P1.5": Object.freeze(["tests/pod-spec-face.test.mjs::V-P1.5", "票 12 剩余命中清单"]),
  "V-P2.8": Object.freeze(["待票 02 行为探针", "tests/pod-overlay.test.mjs::V-P2.8"]),
  "V-P3.2": Object.freeze(["探针 P-HOST-TRANSITION-TOKENS", "tests/pod-transition.test.mjs::V-P3.2"]),
  "V-P3.4": Object.freeze(["tests/pod-transition.test.mjs::V-P3.4"]),
  "V-P4.1": Object.freeze(["tests/pod-trace.test.mjs::V-P4.1"]),
  "V-P4.2": Object.freeze(["tests/pod-trace.test.mjs::V-P4.2"]),
  "V-P4.4": Object.freeze(["tests/org-mail-shared-face.test.mjs::内容键封闭", "tests/mail-at-least-once.test.mjs", "tests/pod-trace.test.mjs::V-P4.4"]),
  "V-P4.5": Object.freeze(["tests/session-driver.test.mjs", "待票 06 补形状负例"]),
  "V-P4.7": Object.freeze(["tests/pod-trace.test.mjs::V-P4.7"]),
  "V-P5.4": Object.freeze(["tests/pod-tool-rows.test.mjs::V-P5.4"]),
  "V-P5.6": Object.freeze(["tests/pod-tool-rows-specialized.test.mjs::V-P5.6"]),
  "V-P5.7": Object.freeze(["tests/pod-tool-rows-specialized.test.mjs::V-P5.7", "人工:human-visual-checklist"]),
  "V-P5.8": Object.freeze(["tests/pod-turn-trigger.test.mjs::V-P5.8", "人工:human-visual-checklist"]),
  "V-P5.9": Object.freeze(["tests/pod-turn-trigger.test.mjs::V-P5.9"]),
  "V-P5.10": Object.freeze(["tests/client-disclosure.test.mjs", "`tests/run.mjs` 回归"]),
  "V-P5.11": Object.freeze(["人工:human-visual-checklist"]),
  "V-P6.1": Object.freeze(["tests/pod-assembly.test.mjs::V-P6.1"]),
  "V-P6.2": Object.freeze(["tests/pod-assembly.test.mjs::V-P6.2"]),
  "V-P6.3": Object.freeze(["tests/pod-assembly.test.mjs::V-P6.3"]),
  "V-P6.4": Object.freeze(["tests/pod-assembly.test.mjs::V-P6.4"]),
  "V-P6.5": Object.freeze(["tests/pod-assembly.test.mjs::V-P6.5"]),
  "V-P7.1": Object.freeze(["tests/pod-harness-base.test.mjs::V-P7.1"]),
  "V-P7.4": Object.freeze(["tests/pod-harness-base.test.mjs::V-P7.4 死配置清理：生成器同步", "tests/bot-profile.test.mjs::生成器不写出死键：patch 无 settings 重定向行、settings.yaml 无 agent-presets 段"]),
  "V-P7.6": Object.freeze(["tests/org-op-set.test.mjs 全绿", "tests/pod-harness-base.test.mjs::V-P7.6"]),
  "V-P8.1": Object.freeze(["`node scripts/project-context.mjs pod` 依赖列", "票 12–15 票面"]),
  "V-P8.3": Object.freeze(["tests/pod-rename-env.test.mjs::V-P8.3", "仓库外脚本更新记录"]),
  "V-P9.3": Object.freeze(["tests/pod-spec-face.test.mjs::V-P9.3"]),
  "V-P9.4": Object.freeze(["`TMPDIR=/tmp node scripts/preflight.mjs`", "人工:human-visual-checklist"])
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

test("V-P9.3 机械检查④：票面引用坐标逐条存在（零空缺、零指向空气、非白名单条目全部机械可解析）", () => {
  const { rows, violations, unresolved, proseOnly } = checkSpecFace();
  const registeredIds = [...Object.keys(GOVERNANCE_ONLY), ...Object.keys(UNBACKFILLED_ROWS)];
  const strayUnresolved = unresolved.filter((line) => !Object.keys(UNBACKFILLED_ROWS).some((id) => line.startsWith(`${id}｜`)));
  assert.deepEqual(strayUnresolved, [], "有坐标记号解析不到落点（core 未补记白名单外的行）");
  const registeredGaps = [...new Set([...unresolved.map((line) => line.split("｜")[0]), ...proseOnly])]
    .filter((id) => Object.hasOwn(UNBACKFILLED_ROWS, id)).sort();
  assert.deepEqual(
    registeredGaps,
    Object.keys(UNBACKFILLED_ROWS).sort(),
    "不可解析／仅自由文记条目集合漂移（core 未补记白名单双向锁定：一旦可解析即须移出清单）"
  );
  assert.deepEqual(
    violations.filter((line) => (line.includes("不可解析") || line.includes("自由文记") || line.includes("无记号"))
      && !Object.keys(UNBACKFILLED_ROWS).some((id) => line.startsWith(`${id}:`))),
    [],
    "坐标解析违例（自由文记须在治理面／未补记白名单内）"
  );
  const machineResolved = rows.length - proseOnly.length;
  const registered = registeredIds.length;
  assert.equal(machineResolved, rows.length - registered, `机械可解析条数＝64 − 已登记句子型引注条数（${String(registered)}）`);
  assert.ok(machineResolved >= 55, `机械可解析 ${String(machineResolved)} 条，预期 ≥ 55（治理面 7＋core 未补记 1）`);
});

test("V-P9.3 现状锁定同拍：附录 A 执行坐标列与 CANONICAL_COORDINATES 逐条一致（指错落点／坐标漂移即红）", () => {
  const { rows } = checkSpecFace();
  assert.deepEqual(canonicalDrift(rows), [], "现状锁定表与规格坐标列漂移");
  assert.equal(Object.keys(CANONICAL_COORDINATES).length, 28, "锁定条目数须为 28（与 integration 同批同 28 条；core 版记现状写法）");
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

test("V-P9.3 登记口径：句子型引注＝治理面 7 条＋core 未补记 1 条（两表均双向锁定，非空缺）", () => {
  const { proseOnly, violations } = checkSpecFace();
  assert.deepEqual(
    proseOnly.sort(),
    [...Object.keys(GOVERNANCE_ONLY), ...Object.keys(UNBACKFILLED_ROWS)].sort(),
    "句子型引注白名单与实况漂移"
  );
  assert.deepEqual(violations.filter((line) => line.includes("治理面白名单") || line.includes("未补记白名单")), [], "白名单双向锁定违例");
  for (const [id, note] of Object.entries(GOVERNANCE_ONLY)) assert.ok(note.length > 8, `${id}: 须写明证据落点`);
  for (const [id, note] of Object.entries(UNBACKFILLED_ROWS)) assert.ok(note.length > 8, `${id}: 须写明原因与落点`);
});

test("V-P9.3 搁置清单双向锁定：07／08／09 三票的落点只在册放过；在册条目落地即红", () => {
  const { usedParked, violations } = checkSpecFace();
  assert.deepEqual([...usedParked].sort(), Object.keys(PARKED_LANDINGS).sort(), "搁置清单与实况漂移（在册未被引用／被引用未在册）");
  // 未在册的缺失落点仍须报红（在册才放过）；例外过滤按 core 未补记白名单键
  // （原在册的 V-P8.3 已随改名批 13 落地测试件同批移出）
  const strayMissing = violations.filter((line) => line.includes("测试文件不存在")
    && !Object.keys(UNBACKFILLED_ROWS).some((id) => line.startsWith(`${id}:`)));
  assert.deepEqual(strayMissing, [], "非在册缺失落点仍须报红——在册才放过");
  for (const rel of Object.keys(PARKED_LANDINGS)) {
    assert.equal(existsSync(join(REPO_ROOT, rel)), false, `搁置清单在册条目已能在 core 落地：${rel}（07／08／09 恢复时须同批清表）`);
  }
  // 清单逐条写明搁置票与实现保留地（用户裁定 2026-10-10；恢复条件＝用户定形后另批）
  for (const [rel, note] of Object.entries(PARKED_LANDINGS)) {
    assert.ok(/票 0[789]/.test(note), `${rel}: 须注明搁置票号`);
    assert.ok(note.length > 20, `${rel}: 须注明实现保留地与搁置依据`);
  }
});

test("V-P9.3 登记口径：core 现状下「常驻但坐标无测试落点」＝待实现批 6 条＋搁置件落点 15 条（非空缺）", () => {
  const { rows } = checkSpecFace();
  const gap = residentWithoutTest(rows);
  assert.deepEqual(
    gap,
    ["V-P5.1", "V-P5.2", "V-P5.3", "V-P5.4", "V-P5.5", "V-P5.6", "V-P5.7", "V-P5.8", "V-P5.9",
      "V-P6.1", "V-P6.2", "V-P6.3", "V-P6.4", "V-P6.5", "V-P6.6",
      "V-P8.1", "V-P8.4", "V-P8.5", "V-P8.6", "V-P9.1", "V-P9.2"],
    "「常驻但坐标无测试落点」集合漂移（新增＝坐标空缺；减少＝坐标已落地，须同批更新本断言）"
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

test("V-P1.5b 内部名不上浮为对外文案：locale 字典入口标签无旧名、代码面旧名清零（13 号票身份切换后）", () => {
  const hits = oldNameHits();
  const client = readTextOrEmpty(join(REPO_ROOT, "lib/client.js"));
  const labelLines = client.split("\n").filter((line) => /"entry\.label":/.test(line));
  assert.equal(labelLines.length, 2, "入口标签 zh／en 两条");
  assert.ok(labelLines.every((line) => !line.includes("dsh-bots")), "入口标签不得带旧名");
  assert.ok(hits.every((hit) => POD_BATCH_SURFACES.includes(hit.file)), "命中面必在声明白名单内（冻结规格引文等冻结件两类都可辨）");
  // 13 号票（身份切换）后：本批自有**代码面**旧名清零——残留命中只许在
  // 冻结规格（`.scratch/pod/spec.md` 历史引文）内；lib／scripts 实现面命中＝空集。
  const implementationFaces = hits.filter((hit) => hit.file.startsWith("lib/") || hit.file.startsWith("scripts/"));
  assert.deepEqual(implementationFaces, [], "代码内部名已随 13 号票切换到新名，实现面不得再有旧名命中");
  for (const name of ['seatView: "pod-pod-seat-view"', 'seatList: "pod-pod-seat-list"', 'layer: "pod-pod-layer"']) {
    assert.ok(client.includes(name), `展示面类名须已换新名：${name}`);
  }
  // 旧名（任意记号形，含身份串／wire 头）在 client 内绝迹；身份串已换新名（四同名见 V-P8.4）
  assert.equal(/dsh-bots|DSH_BOTS/i.test(client), false, "client 内旧名（含身份串／wire 头）须绝迹");
  for (const identity of ['id: "pod"', 'const name = "pod"', 'tag.dataset.plugin = "pod"', 'const tagId = "pod/styles"']) {
    assert.ok(client.includes(identity), `身份串已换新名：${identity}`);
  }
  // 路由前缀随窗切换（V-P8.2「路由前缀」类的 client 侧坐标）
  assert.ok(client.includes('"/api/pod'), "client 调用面已换 /api/pod 前缀");
  assert.equal(client.includes("/api/bots"), false, "client 内不得再留 /api/bots 前缀");
});

test("V-P8.4 四同名一致：patch 行 name＝插件目录段＝package.json.name＝前端模块 id（缺一即加载失败）", () => {
  const pkgText = readTextOrEmpty(join(REPO_ROOT, "package.json"));
  const pkg = JSON.parse(pkgText);
  const client = readTextOrEmpty(join(REPO_ROOT, "lib/client.js"));
  const shared = readTextOrEmpty(join(REPO_ROOT, "lib/shared.cjs"));
  const deploySync = readTextOrEmpty(join(REPO_ROOT, "scripts/deploy-sync.mjs"));
  // 落点逐一提取（提取不到＝该落点形状漂移，fail closed）：
  // 包名／前端模块 id／插件声明 name／样式标签 dataset／patch 行 name／部署目录段默认值。
  const names = new Set([
    pkg.name,
    (client.match(/^\tid: "([^"]+)"/m) ?? [])[1],
    (client.match(/const name = "([^"]+)"/) ?? [])[1],
    (client.match(/tag\.dataset\.plugin = "([^"]+)"/) ?? [])[1],
    (shared.match(/push\("      name: '([^']+)'"\)/) ?? [])[1],
    (deploySync.match(/join\("plugins", "([^"]+)"\)/) ?? [])[1]
  ]);
  assert.equal(names.size, 1, `四同名绑定（＋部署目录段）须逐落点一致：${[...names].join("／")}`);
  assert.equal([...names][0], "pod", "插件身份名＝pod（小写单数，与其余身份段一致）");
  // 同窗反向锁定：旧身份串在四个落点文件中绝迹
  for (const [rel, text] of [["package.json", pkgText], ["lib/client.js", client], ["lib/shared.cjs", shared]]) {
    assert.equal(/dsh-bots/.test(text), false, `${rel} 不得再带旧身份串`);
  }
});

test("V-P1.4/V-P1.5 15 号票全窗关闭：代码面旧名残留只余退役段名历史提及（其余清零）", () => {
  const { hits, whitelisted, scanned, staleAllow, unusedShapes } = codeFaceOldNameScan();
  assert.ok(scanned > 40, `扫描面须覆盖 lib／tests／scripts（实扫 ${String(scanned)} 件）`);
  assert.ok(whitelisted.length > 0, "退役历史提及的许可残留须被识别为一类，不是空集");
  // 全窗关闭（15 号票）后许可面只许一类：
  //   ① role-cards.js 注释里的**退役段名历史提及**（03 号票退役，冻结历史，无关闭窗口）。
  // 已随本批离场：② env 双读回落夹具（窗已关；测试件改构造形后零命中）与
  // ③ 数据面迁移旧插件名工作面（`scripts/migrate-pod-data.mjs` ＋夹具随迁移完成、
  //    旧根 retired 清理执行而整件退役删除）。
  const retired = whitelisted.filter((entry) => entry.file === "lib/org/role-cards.js");
  assert.ok(retired.length > 0 && retired.every((entry) => entry.kind === "colon"),
    "role-cards 退役段名历史提及（retired-section 形许可）");
  assert.equal(whitelisted.length, retired.length,
    "许可面只许退役段名一类（env 回落夹具与迁移工作面已随全窗关闭离场）");
  // 旧名活性形（bare／hyphen／env）在许可面清零——再出现即 hits 红，无借形存活面。
  const activeShapes = whitelisted.filter((entry) => entry.kind === "bare" || entry.kind === "hyphen" || entry.kind === "env");
  assert.deepEqual(activeShapes, [], "bare／hyphen／env 类许可已清零（全窗关闭后旧名记号无许可存活面）");
  const detail = hits.map((h) => `${h.file}:${h.kind}:${h.token}`).join("、");
  assert.deepEqual(hits, [], `白名单外旧名残留＝「应改未改」（全窗关闭后代码面应清零）：${detail}`);
  assert.deepEqual(staleAllow, [], `身份面白名单陈旧（许可记号已不存在，须同批删除）：${staleAllow.join("、")}`);
  assert.deepEqual(unusedShapes, [], `身份面许可形未被命中（陈旧形，须同批删除）：${unusedShapes.join("、")}`);
  // 本票已换新的非身份面：这些文件是「旧类名／旧 id 前缀」的密集落点，须为零命中且不得在册
  for (const rel of ["tests/pod-overlay.test.mjs", "tests/pod-transition.test.mjs", "tests/pod-trace.test.mjs",
    "tests/client-disclosure.test.mjs", "tests/host-contract-gate.test.mjs"]) {
    // 这些件属票 12 已改面：旧标识符形（旧类名／旧 id／旧 data-*）须绝迹
    assert.equal(OLD_IDENTIFIER_SHAPE.test(readTextOrEmpty(join(REPO_ROOT, rel))), false,
      `${rel} 不得再带旧标识符形（旧类名／旧 id／旧 data-*）`);
  }
  // 全窗关闭后：lib／scripts／tests 面旧名记号（bare／hyphen／env 类）全零——
  // 唯一豁免＝role-cards 退役段名（colon 类，历史提及）；迁移工作面两件已整件删除。
  for (const [root, kind] of [["lib/", "env"], ["lib/", "bare"], ["scripts/", "bare"], ["scripts/", "env"], ["tests/", "bare"], ["tests/", "env"]]) {
    const remaining = whitelisted.filter((entry) => entry.file.startsWith(root) && entry.kind === kind);
    assert.equal(remaining.length, 0, `${root} 面不得再留 ${kind} 类旧名记号`);
  }
});

test("V-P8.2 A 组九类清单扫全：模块 id／包名／CSS 前缀／locale ns／host 插件名／wire 头／路由前缀／日志前缀／测试与脚本字面量逐类有落点", () => {
  const { rows } = checkSpecFace();
  const row = rows.find((candidate) => candidate.id === "V-P8.2");
  assert.ok(row !== undefined, "V-P8.2 判据行须在附录 A");
  assert.ok(/A 组范围齐备/.test(row.criterion), "V-P8.2 判据文本须为 A 组九类清单（范围齐备）");
  assert.ok(/模块 id／包名／CSS 前缀／locale ns／host 插件名／wire 头／路由前缀／日志前缀／测试与脚本字面量/.test(row.criterion), "V-P8.2 九类清单须逐类点名");
  assert.ok(/A 组九类清单扫全/.test(row.coordinate), "V-P8.2 补记坐标须保留 A 组九类清单扫全口径");
  // 九类清单逐类在活面上有真实落点（13 号票身份切换后九类全部换新名；
  // 「路由前缀」类的目标名 /api/pod 系 Lead 按「单数 pod 收敛规律」裁定，待用户过目）
  const clientText = readTextOrEmpty(join(REPO_ROOT, "lib/client.js"));
  const indexText = readTextOrEmpty(join(REPO_ROOT, "lib/index.js"));
  const probeText = readTextOrEmpty(join(REPO_ROOT, "scripts/host-contract-probe.mjs"));
  const classes = [
    // 身份／wire 段（13 号票已换新名；四同名一致性另见 V-P8.4）
    { id: "模块 id", stage: "renamed", hit: clientText.includes('id: "pod"') && !clientText.includes('id: "dsh-bots"') },
    { id: "包名", stage: "renamed", hit: JSON.parse(readTextOrEmpty(join(REPO_ROOT, "package.json"))).name === "pod" },
    { id: "host 插件名", stage: "renamed", hit: clientText.includes('const name = "pod"') },
    { id: "wire 头", stage: "renamed", hit: indexText.includes("x-pod-") && !indexText.includes("x-dsh-bots") },
    { id: "路由前缀", stage: "renamed", hit: indexText.includes("/api/pod") && !indexText.includes("/api/bots") },
    // 非身份段（票 12 已换新名）：`pod-*`
    { id: "CSS 前缀", stage: "renamed", hit: /\.pod-[a-z0-9-]+\{/.test(clientText) && !OLD_IDENTIFIER_SHAPE.test(clientText) },
    { id: "locale ns", stage: "renamed", hit: clientText.includes('const LOCALE_NS = "pod";') },
    { id: "日志前缀", stage: "renamed", hit: indexText.includes("[pod]") && !indexText.includes("[dsh-bots]") },
    { id: "测试与脚本字面量", stage: "renamed", hit: probeText.includes('value: "pod-') && !probeText.includes("dsh-bots-") }
  ];
  const missing = classes.filter((entry) => !entry.hit).map((entry) => entry.id);
  assert.deepEqual(missing, [], "A 组九类清单在活面上出现空类（清单扫全即不得有空类）");
  assert.equal(classes.filter((entry) => entry.stage === "identity").length, 0, "身份段已随 13 号票切换（无留旧名类）");
  assert.equal(classes.filter((entry) => entry.stage === "renamed").length, 9, "九类全部已换新名（票 12 四类＋票 13 五类）");
  assert.equal(classes.length, 9, "A 组九类逐类有点名");
});
