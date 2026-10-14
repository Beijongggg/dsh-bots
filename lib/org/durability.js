/**
 * 组织恒久性与模型更迭面（org-v2 12 号票；规格 §J 与附录 A `V-A7.1`–`V-A7.4`）。
 *
 * 本模块把「哪些文本不许含模型假设」做成**可判定的封闭集合**，并把模型更迭
 * 例程的四步落到可执行面：
 *
 *   1. **组织层件白名单封闭枚举**（`ORG_LAYER_WHITELIST`，七类：协作协议／任务
 *      台账／复核件套／权限四层／岗位卡第 1–6/8 字段／知识库容器协议／宿主适配面
 *      登记表容器协议）。每类记**换模型试金石**问答（「换一个更强模型，这条会变成
 *      废话或障碍吗」）与存活理由；条目坐标＝规格锚串（在 `.scratch/org-v2/spec.md`
 *      §J 内解析）＋容器模块（在仓内解析）。白名单外任何文本默认＝**岗位细节**。
 *   2. **扫描**（`scanModelAssumptions`）：组织层件内的**非注释**行不得出现模型
 *      特定假设记号（模型族名／上下文窗口与预算数值／模型档位类旋钮）。注释行
 *      豁免——说明里解释「为什么不绑模型」不是假设。宿主适配面只扫**容器协议**
 *      区（字段集与登记纪律）：条目内容＝运行时资产，里面的宿主包名与模型 pin
 *      不属组织层假设。
 *   3. **岗位细节只住三处**（`ROLE_DETAIL_HOMES`）：岗位卡第 7 字段（模型档位，
 *      用户域留空）／提示段（岗位卡派生物）／实例配置（注册表的模型指派）。
 *      `validateRoleDetailHomes` 机械把守前两处与第三条的坐标。
 *   4. **升级例程**（`planModelUpgradeEval`）：改实例模型指派落注册表 → 按岗位取
 *      `ROLE_EVAL_SET` 样本，逐样本开 `class=duty` 评测任务（例程登记项见
 *      `./dispatch-config.js`，幂等键＝例程 id＋时间窗）。四步中的③做减法只许动
 *      岗位细节三处、④用户终裁走人间收件箱——两步是流程纪律（`UPGRADE_ROUTINE_STEPS`
 *      逐条记其落点），本模块不新造命令面。
 *
 * **原语单源（02 纪律）**：注释判别取 `./face-scan.js`（本模块只逐行只读扫描**白名单点名的件**，
 * 不 walk 目录——覆盖面由白名单封闭枚举给出，而非扫全树）；
 * 「非空字符串」取 `./is-non-empty-string.js`；岗位卡字段集取 `./role-cards.js`
 * （第 7 字段名与留空纪律不在此另立一份）。本模块纯只读：不改被扫面、不落盘。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isCommentLine } from "./face-scan.js";
import { isNonEmptyString } from "./is-non-empty-string.js";
// 数据面路径单源（14 号票收敛）：eval 样本坐标的根名只活在 lib/data-roots.cjs。
import { WORKSPACE_ROOT_NAME as rootsWorkspaceRootName } from "../data-roots.cjs";
import { ROLE_CARD_FIELDS, ROLE_CARDS, renderPostPromptSegment } from "./role-cards.js";
import { BRIEF_KEYS, validateBrief } from "./brief.js";
import { PACKET_PIECES } from "./human-inbox.js";
import { REPORT_KEYS } from "./review-kit.js";

/** 换模型试金石（规格 §J 原文那一问；白名单每条都要过它）。 */
export const TOUCHSTONE_QUESTION = "换一个更强模型，这条会变成废话或障碍吗";

/** 仓库根（默认由模块位置解析——真源锚解析不依赖调用方 cwd）。 */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * 规格文件（白名单锚串与 D1–D11 表述的解析面；只读）。路径**显式点名**而非按
 * README §2 文档地图推断：地图只列 `docs/` 面，`.scratch/` 是工单工作区，而
 * org-v2 的语义权威恰在 `.scratch/org-v2/spec.md`（CHANGELOG 指路口径）——
 * 本扫描面因此把该坐标写在代码里，改规格路径即改这里（漂移可判）。
 */
export const SPEC_PATH = join(".scratch", "org-v2", "spec.md");

/** 规格 §J 小节标题（锚串与判据表述的解析界）。 */
export const SPEC_SECTION_J = "### J. 恒久性与模型更迭";

/**
 * 组织层件白名单（封闭枚举）。字段纪律：
 *   - `id`＝机器键（`REQUIRED_WHITELIST_IDS` 冻结顺序）；
 *   - `specAnchor`＝规格 §J 白名单条目原字串（改措辞即漂移，扫描报违例）；
 *   - `modules`＝该件的容器模块坐标（组织层件的机械承载面）；
 *   - `region`＝可选扫描区（`{file, untilMarker, resumeAtMarker}`：跳过条目内容区，
 *     只扫容器协议区——宿主适配面登记表的条目内容属运行时资产）；
 *   - `touchstone`＝试金石问答记录（`survivesBecause` 必填：换模型后为何不是废话）。
 */
export const ORG_LAYER_WHITELIST = Object.freeze([
  Object.freeze({
    id: "protocol",
    label: "协作协议",
    specAnchor: "协作协议",
    container: "四要素简报契约＋任务生命周期（收单→分诊→派单→接单→交付→结算→关闭）",
    modules: Object.freeze(["lib/org/brief.js", "lib/org/brief-gate.js", "lib/org/task-ledger.js"]),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "协议规定的是人与岗位之间的交接形状（谁在何时交什么），换更强模型不会让它变废话——模型越强，交接形状越值钱（它决定并发与隔离能力）"
    })
  }),
  Object.freeze({
    id: "task-ledger",
    label: "任务台账",
    specAnchor: "任务台账",
    container: "append-only 事件日志、单一写者、状态＝事件投影、例程幂等键＝例程 id＋时间窗",
    modules: Object.freeze(["lib/org/task-ledger.js", "lib/org/ledger-host.js"]),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "台账是「谁在办、办到哪」的事实面，与模型智能无关——没有它，换任何模型都无从恢复中断的任务"
    })
  }),
  Object.freeze({
    id: "review-kit",
    label: "复核件套",
    specAnchor: "复核件套",
    container: "必审清单边界枚举＋复核报告形状（verdict／gaps／criteriaGaps／模型身份）＋两轮上浮",
    modules: Object.freeze(["lib/org/review-kit.js"]),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "复核是「产出方不得自任」的结构约束，模型越强越需要外部检查——更强模型的自信失败更难被自己发现"
    })
  }),
  Object.freeze({
    id: "permission-layers",
    label: "权限四层",
    specAnchor: "权限四层",
    container: "L0 实例基底／L1 文件面／L2 组织命令 capability／L3 人间面 user principal",
    modules: Object.freeze([
      "lib/org/permissions.js", "lib/org/op-set.js", "lib/org/capability-base.js", "lib/org/capability-issue.js"
    ]),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "权限是「谁可以动什么」的边界，与模型能力正交——更强的模型不会让越权变合法，只会让越权更危险"
    })
  }),
  Object.freeze({
    id: "role-card-fields",
    label: "岗位卡第 1–6/8 字段",
    specAnchor: "岗位卡第 1–6/8 字段",
    container: "职责／触发／输入输出契约／边界／存在理由／放大机制／依赖面·更迭敏感性（第 7 字段模型档位属用户域，不在白名单内）",
    modules: Object.freeze(["lib/org/role-cards.js"]),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "岗位契约写的是职责与交接面，不写「谁来干」——档位与指派留在第 7 字段与实例配置，换模型不动卡面前六与第八字段"
    })
  }),
  Object.freeze({
    id: "knowledge-container",
    label: "知识库容器协议",
    specAnchor: "知识库容器协议",
    container: "register／search／supersedes（取代）语义与索引协议；失效唯一机制＝显式取代/废弃",
    modules: Object.freeze(["lib/knowledge.js", "lib/org/knowledge-shared-face.js"]),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "容器协议规定结论如何落账与如何被取代，不论结论由哪个模型产出——换模型不动协议，只动条目"
    })
  }),
  Object.freeze({
    id: "host-face-registry-container",
    label: "宿主适配面登记表容器协议",
    specAnchor: "宿主适配面登记表容器协议",
    container: "字段集（面 id／宿主坐标／读取方式／类别／适配层模块／探针 id／失效表现／失效分级／末次结果指针）与登记纪律",
    modules: Object.freeze(["lib/host-faces.js"]),
    region: Object.freeze({
      file: "lib/host-faces.js",
      untilMarker: "export const HOST_FACES",
      resumeAtMarker: "\n];"
    }),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "容器协议（字段集与登记纪律）跨宿主版本与跨模型稳定；条目内容（宿主坐标、模型 pin）是运行时资产，宿主更迭改条目不改协议"
    })
  })
]);

/**
 * 冻结类别清单（**字面量**，不从 `ORG_LAYER_WHITELIST` 自我派生——否则「白名单是否
 * 封闭」会变成拿白名单验证白名单的空断言）。顺序即白名单顺序；少一条或多一条都即
 * 枚举破口，由 `validateOrgLayerWhitelist` 的集合等值判定报违例。
 */
export const REQUIRED_WHITELIST_IDS = Object.freeze([
  "protocol",
  "task-ledger",
  "review-kit",
  "permission-layers",
  "role-card-fields",
  "knowledge-container",
  "host-face-registry-container"
]);

/**
 * 模型特定假设禁记号（封闭枚举；扫**非注释**行）。分两类：
 *   - 模型族／产品名：把具体模型写进组织层件＝假设了「这个模型在」；
 *   - 能力与旋钮假设：上下文窗口与预算数值、上限参数、推理等级、
 *     采样温度——这些是模型档位旋钮，只许住岗位细节三处。
 * `128k`／`200k`／`1m context` 这类具体窗口数值单列：写作「上下文预算分层」
 * （D1）是结构判据，写作「128k」则是假设了具体模型。
 */
export const MODEL_ASSUMPTION_TOKENS = Object.freeze([
  Object.freeze({ id: "family-gpt", label: "模型族名 gpt", pattern: /\bgpt\b|\bgpt-?[0-9]/i }),
  Object.freeze({ id: "family-claude", label: "模型族名 claude", pattern: /claude/i }),
  Object.freeze({ id: "family-anthropic-openai", label: "厂商名（anthropic／openai）", pattern: /anthropic|openai/i }),
  Object.freeze({ id: "family-gemini", label: "模型族名 gemini", pattern: /gemini/i }),
  Object.freeze({ id: "family-llama-qwen", label: "模型族名 llama／qwen", pattern: /llama|qwen/i }),
  Object.freeze({ id: "family-deepseek", label: "模型族名 deepseek", pattern: /deepseek[-_ ]?(v|r|chat|coder)[0-9._-]*/i }),
  Object.freeze({ id: "family-mistral-kimi-glm", label: "模型族名 mistral／kimi／glm", pattern: /mistral|kimi|\bglm\b/i }),
  Object.freeze({ id: "family-grok", label: "模型族名 grok", pattern: /\bgrok\b/i }),
  Object.freeze({
    id: "family-domestic",
    label: "国产模型族名（doubao／ernie／hunyuan／minimax 及中文通称）",
    pattern: /\b(?:doubao|ernie|hunyuan|minimax)\b|文心|通义|千问|混元|豆包|深度求索/i
  }),
  Object.freeze({ id: "family-tier-names", label: "模型档位名（opus／sonnet／haiku）", pattern: /\b(opus|sonnet|haiku)\b/i }),
  Object.freeze({ id: "context-window", label: "上下文窗口（具体窗口形态）", pattern: /上下文窗口|context window|contextwindow/i }),
  Object.freeze({ id: "window-size", label: "具体窗口数值（128k／200k／1m context）", pattern: /\b(128k|200k|256k|1m context|1000k)\b/i }),
  Object.freeze({ id: "token-budget", label: "token 预算数值口径", pattern: /token 预算|token budget|max_tokens|max output tokens/i }),
  Object.freeze({ id: "reasoning-effort", label: "推理等级旋钮", pattern: /reasoning[-_ ]?effort|推理等级/i }),
  Object.freeze({ id: "sampling-knob", label: "采样旋钮（temperature／top_p）", pattern: /\btemperature\b|\btop_p\b|\btop-p\b/i })
]);

/** 读文件文本；不可读＝空串（**唯一的读回落面**：白名单/扫描区内所有读取都走它）。 */
function readTextOrEmpty(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/** 扫一行：返回首个命中的禁记号（无命中返回 null）。 */
function firstTokenHit(line) {
  for (const token of MODEL_ASSUMPTION_TOKENS) {
    const matched = line.match(token.pattern);
    if (matched !== null) return { token, matched: matched[0] };
  }
  return null;
}

/**
 * 模型假设扫描（纯函数，源可注入——负例测试注入一行即转红）。`sources`＝
 * `[{path, text}]`（path＝仓相对路径，用于报错定位）。注释行（`//`／`*`／`/*`）
 * 豁免：说明里解释「为什么不绑模型」不是假设。
 */
export function scanModelAssumptions(sources = []) {
  const violations = [];
  const hits = [];
  let scanned = 0;
  for (const source of sources) {
    const path = String(source?.path ?? "(未知件)");
    scanned += 1;
    let flagged = false;
    String(source?.text ?? "").split("\n").forEach((line, index) => {
      if (isCommentLine(line.trim())) return;
      const hit = firstTokenHit(line);
      if (hit === null) return;
      flagged = true;
      violations.push(
        `${path}: line ${String(index + 1)} 出现模型特定假设「${hit.matched}」（${hit.token.label}）` +
        `→ 组织层件不得含模型假设（V-A7.2）：模型相关文本只许住三处（岗位卡第 7 字段／提示段／实例配置）`
      );
    });
    if (flagged) hits.push(path);
  }
  return { ok: violations.length === 0, scanned, violations, hits: [...new Set(hits)].sort() };
}

/**
 * 采集组织层件源（仓相对路径 → 文本）。同一条目重复点名的模块只取一次；
 * `region` 声明的件按**容器协议区**取（`untilMarker` 之后到 `resumeAtMarker`
 * 的条目内容区被剔除——那段是运行时资产，不是容器协议）。
 */
export function collectOrgLayerSources(repoRoot, whitelist = ORG_LAYER_WHITELIST) {
  const byPath = new Map();
  for (const entry of whitelist) {
    for (const module of entry.modules ?? []) {
      if (byPath.has(module)) continue;
      const region = entry.region?.file === module ? entry.region : null;
      const absolute = join(repoRoot, module);
      const raw = existsSync(absolute) ? readTextOrEmpty(absolute) : null;
      // 缺件由 validateOrgLayerWhitelist 报违例（此处留空文本，不吞结论）
      const cut = raw !== null && region !== null ? cutRegion(raw, region) : raw;
      byPath.set(module, { path: module, text: cut ?? "" });
    }
  }
  return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * 容器协议区裁剪：剔除 `untilMarker` 起至其后首个 `resumeAtMarker` 的条目内容区。
 * **fail closed**：任一标记缺失即返回 `null`（收集面取空文本，`validateOrgLayerWhitelist`
 * 逐条核标记在册——标记消失＝协议区形状变了，绝不静默按「原样全扫」或「截断尾巴」放行：
 * 前者会把运行时资产（宿主包名/模型 pin）当成组织层假设误报，后者会漏扫协议校验面）。
 */
function cutRegion(text, region) {
  const from = text.indexOf(region.untilMarker);
  if (from === -1) return null;
  const to = text.indexOf(region.resumeAtMarker, from);
  if (to === -1) return null;
  return text.slice(0, from) + text.slice(to + region.resumeAtMarker.length);
}

/**
 * 取规格小节文本（标题起至下一个二级标题前）；找不到返回 ""。
 * **空白无关口径**：返回件剔除全部空白（换行／缩进／行内空格）——判据表述与
 * 要件短语的逐字命中不因正文排版换行而失配（换行是排版，不是语义）。比对双方
 * 都用本归一（`normalizeSpecText`），故口径一致、不制造假阳性。
 */
export function specSection(specText, heading) {
  const start = specText.indexOf(heading);
  if (start === -1) return "";
  const rest = specText.slice(start + heading.length);
  const nextHeading = rest.indexOf("\n## ");
  const sliced = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return normalizeSpecText(sliced);
}

/** 规格文本归一（空白无关口径；比对双方共用——见 `specSection` 头注）。 */
export function normalizeSpecText(text) {
  return String(text ?? "").replace(/\s+/g, "");
}

/**
 * 白名单条目校验（坐标可解析：规格锚串在该件所在小节内、容器模块在仓内、
 * 试金石记录齐备）。`specText`／`repoRoot`／`whitelist` 皆可注入（负例用）。
 */
export function validateOrgLayerWhitelist({
  specText = "",
  repoRoot = ".",
  whitelist = ORG_LAYER_WHITELIST,
  requiredIds = REQUIRED_WHITELIST_IDS
} = {}) {
  const violations = [];
  const section = specSection(specText, SPEC_SECTION_J);
  if (section === "") violations.push(`规格 §J 小节缺失（${SPEC_SECTION_J}）——白名单锚串无处解析`);
  // 封闭性＝与**冻结字面量清单**集合等值（少一类＝枚举破口，多一类＝未登记类别）
  const actualIds = whitelist.map((entry) => entry?.id);
  for (const id of requiredIds) {
    if (!actualIds.includes(id)) violations.push(`白名单缺类别 ${id}（封闭枚举破口：类别清单是冻结字面量，删类即违例）`);
  }
  for (const id of actualIds) {
    if (!requiredIds.includes(id)) violations.push(`白名单含未登记类别 ${String(id)}（新增类别须走规格修订并登记冻结清单）`);
  }
  const seen = new Set();
  for (const entry of whitelist) {
    const id = isNonEmptyString(entry?.id) ? entry.id : "(缺 id)";
    if (id === "(缺 id)") violations.push("白名单条目缺 id");
    if (seen.has(id)) violations.push(`${id}: 白名单 id 重复`);
    seen.add(id);
    if (!isNonEmptyString(entry?.label)) violations.push(`${id}: 缺人读名`);
    if (!isNonEmptyString(entry?.specAnchor)) violations.push(`${id}: 缺规格锚串（白名单条目须锚定规格正文）`);
    else if (section !== "" && !section.includes(normalizeSpecText(entry.specAnchor))) {
      violations.push(`${id}: 规格锚「${entry.specAnchor}」不在规格 §J 内（白名单类别漂移）`);
    }
    if (entry?.touchstone?.verdict !== "pass") violations.push(`${id}: 未过换模型试金石即不得留在组织层白名单`);
    if (!isNonEmptyString(entry?.touchstone?.survivesBecause)) violations.push(`${id}: 缺试金石存活理由`);
    if (!Array.isArray(entry?.modules) || entry.modules.length === 0) {
      violations.push(`${id}: 缺容器模块坐标`);
      continue;
    }
    for (const module of entry.modules) {
      if (!existsSync(join(repoRoot, module))) violations.push(`${id}: 容器模块不在仓内：${module}`);
    }
    if (entry?.region !== undefined) {
      if (!entry.modules.includes(entry.region.file)) {
        violations.push(`${id}: 扫描区声明的件不在其容器模块内：${String(entry.region.file)}`);
      } else {
        // 扫描区标记必须真能解析（fail closed）：标记消失即协议区形状变了——
        // 不许静默退回「全文件扫」或「截断尾巴」（见 cutRegion 头注）
        const regionText = readTextOrEmpty(join(repoRoot, entry.region.file));
        if (regionText === "") {
          violations.push(`${id}: 扫描区文件不可读：${String(entry.region.file)}`);
        } else {
          if (!regionText.includes(entry.region.untilMarker)) {
            violations.push(`${id}: 扫描区上界标记不在册（${String(entry.region.untilMarker)}）——协议区形状漂移，fail closed`);
          }
          if (!regionText.includes(entry.region.resumeAtMarker)) {
            violations.push(`${id}: 扫描区下界标记不在册（${JSON.stringify(entry.region.resumeAtMarker)}）——协议区形状漂移，fail closed`);
          }
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * 岗位细节三处（封闭枚举）：模型相关文本只许住这三处——组织层件里写不下、
 * 提示段里只能由卡面派生、指派只由实例配置（注册表）持有。
 */
export const ROLE_DETAIL_HOMES = Object.freeze([
  Object.freeze({
    id: "role-card-tier-field",
    label: "岗位卡第 7 字段（模型档位，用户域留空）",
    module: "lib/org/role-cards.js",
    fieldKey: "modelTier"
  }),
  Object.freeze({
    id: "prompt-segment",
    label: "提示段（岗位卡派生物）",
    module: "lib/org/role-cards.js",
    exportName: "renderPostPromptSegment"
  }),
  Object.freeze({
    id: "instance-config",
    label: "实例配置（模型指派）",
    module: "lib/index.js",
    fields: Object.freeze(["modelProvider", "model", "reasoningEffort"])
  })
]);

/**
 * 三处坐标校验（机械面）：第 7 字段是岗位卡字段集成员且**契约面留空**；
 * 提示段有渲染导出（派生物，无第二份提示文本）；实例配置字段落在注册表写面
 * （`lib/index.js` 的模型指派写点）。返回 `{ok, violations, cardsWithTier}`。
 */
export function validateRoleDetailHomes({ repoRoot = ".", cards = ROLE_CARDS, homes = ROLE_DETAIL_HOMES } = {}) {
  const violations = [];
  const tierHome = homes.find((home) => home.id === "role-card-tier-field");
  const segmentHome = homes.find((home) => home.id === "prompt-segment");
  const configHome = homes.find((home) => home.id === "instance-config");
  if (tierHome === undefined || segmentHome === undefined || configHome === undefined) {
    violations.push("岗位细节三处不齐（岗位卡第 7 字段／提示段／实例配置）——分界面破口");
    return { ok: false, violations, cardsWithTier: [] };
  }
  if (!ROLE_CARD_FIELDS.includes(tierHome.fieldKey)) {
    violations.push(`第 7 字段 ${String(tierHome.fieldKey)} 不是岗位卡字段集成员`);
  }
  if (typeof renderPostPromptSegment !== "function") violations.push("提示段渲染器缺失（提示段不再是派生物）");
  for (const home of homes) {
    if (!existsSync(join(repoRoot, home.module))) violations.push(`${home.id}: 坐标模块不在仓内：${home.module}`);
  }
  // 实例配置＝注册表写面：模型指派字段须落在 lib/index.js（bot 记录写点）
  const indexText = readTextOrEmpty(join(repoRoot, configHome.module));
  for (const field of configHome.fields ?? []) {
    if (!indexText.includes(field)) {
      violations.push(`${configHome.id}: 模型指派字段 ${field} 不在实例配置写面（${configHome.module}）`);
    }
  }
  const cardsWithTier = cards.filter((card) => card?.modelTier !== "");
  for (const card of cardsWithTier) {
    violations.push(`${String(card?.slug)}: 模型档位属用户域，契约面必须留空（档位只经实例配置注入）`);
  }
  return { ok: violations.length === 0, violations, cardsWithTier };
}

/**
 * 恒久性面总扫描（白名单齐备＋组织层件零模型假设＋岗位细节三处坐标）。
 * 返回 `{ok, scanned, violations, hits, whitelist, homes}`——形状与
 * `scripts/preflight.mjs` 的 `namingLint` 同源（违例清单＋覆盖面计数）。
 */
export function scanDurabilityFace(repoRoot = REPO_ROOT, { specText = null } = {}) {
  const resolvedSpec = specText ?? readTextOrEmpty(join(repoRoot, SPEC_PATH));
  const whitelist = validateOrgLayerWhitelist({ specText: resolvedSpec, repoRoot });
  const sources = collectOrgLayerSources(repoRoot);
  const modelScan = scanModelAssumptions(sources);
  const homes = validateRoleDetailHomes({ repoRoot });
  const coordinates = validateCriteriaCoordinates({ repoRoot });
  const provenance = validateOverrideProvenance({ repoRoot });
  const violations = [
    ...whitelist.violations, ...modelScan.violations, ...homes.violations,
    ...coordinates.violations, ...provenance.violations
  ];
  return {
    ok: violations.length === 0,
    scanned: sources.length,
    violations,
    hits: modelScan.hits,
    whitelist,
    homes,
    coordinates,
    provenance
  };
}

// ---------------- 恒久判据 D1–D11（V-A7.3） ----------------

/**
 * 恒久判据清单（D1–D11）。`statement` ＝判据的**权威表述**，规格 §J 须逐字
 * 携带（文档扫描按 `section.includes(statement)` 判）——表述只此一份真源，
 * 规格与模块任一侧漂移即报违例，不靠「人记得两边一起改」。
 *
 * 被覆写的 **D5／D8** 在表述内注明**覆写出处**（07 号票＝岗位工具配置裁定）：
 *   - D5 原「可执行技能库」→「可执行规程资产」（两形态＝知识库与探针白名单）；
 *   - D8 原「工具接入走 MCP 类标准协议」→「工具面是岗位卡派生物、跨模型稳定、
 *     工具名与 op 名模型无关」（MCP 字样移出规格判据）。
 * `coordinates` ＝该判据的落地坐标（模块／判据号；切换批前必须无空缺）。
 */
export const DURABILITY_CRITERIA = Object.freeze([
  Object.freeze({
    id: "D1",
    statement: "D1＝上下文预算分层：每岗位显式定义预算与分层（常驻最小集＋按需检索标识符＋外置记忆），预算按有效上下文计。",
    coordinates: Object.freeze([
      "lib/org/role-cards.js（放大机制字段：分解／并行＝上下文隔离）",
      "lib/org/task-ledger.js（简报与工件坐标：转述不进上下文）"
    ])
  }),
  Object.freeze({
    id: "D2",
    statement: "D2＝稳定前缀：提示段与工具表用稳定前缀＋append-only 演进，改岗位细节不改结构。",
    coordinates: Object.freeze([
      "lib/org/role-cards.js renderPostPromptSegment（段＝卡面派生）",
      "scripts/role-card-drift-check.mjs（构建期漂移校验）"
    ])
  }),
  Object.freeze({
    id: "D3",
    statement: "D3＝移交契约：跨岗位移交走四要素契约（目标／输出格式／来源约束／边界），裁剪须显式声明。",
    coordinates: Object.freeze([
      "lib/org/brief.js（四要素简报契约）",
      "lib/org/review-kit.js reviewHandoff／lib/org/memory-layer.js buildHandoff（指针移交）"
    ])
  }),
  Object.freeze({
    id: "D4",
    statement: "D4＝并行条件：默认单线程线性；仅当子任务上下文真正独立时并行，且并行方只产信息、不可逆动作收归单线程。",
    coordinates: Object.freeze([
      "lib/org/task-ledger.js（单一时刻单一归属＋CAS）",
      "lib/org/review-kit.js selectReviewer（fresh context 复核）"
    ])
  }),
  Object.freeze({
    id: "D5",
    overridden: true,
    // 覆写出处的旧词原文（原「可执行技能库」）只出现在规格 §J 的注记行里：
    // lib 词表无该旧词（V-A4.8 扫描），故本模块的表述不带它，出处按 `overrideSource` 核。
    statement: "D5＝可执行规程资产：规程落知识库与探针白名单两形态，文本化、可执行、不进提示咒语。",
    coordinates: Object.freeze([
      "lib/knowledge.js（知识库形态）",
      "lib/org/probe.js PROBE_COMMANDS（探针白名单形态）"
    ]),
    // 裁定锚取 07 号票正文原句（探针白名单那一条）：在案可回核，且 lib 词表无该旧词
    overrideSource: Object.freeze({
      ticket: "07",
      phrase: "覆写出处＝07 号票",
      rulingAnchor: "白名单机制必须存在且 fail closed"
    })
  }),
  Object.freeze({
    id: "D6",
    statement: "D6＝团队共享上下文：共享走台账与知识库两面，不设第三面、不进模型私有通道。",
    coordinates: Object.freeze([
      "lib/org/memory-layer.js（三面分流＋冲突裁决）",
      "lib/org/knowledge-shared-face.js（共享面写者审计）"
    ])
  }),
  Object.freeze({
    id: "D7",
    statement: "D7＝验证外置：每岗位产出配可执行检查，复核用 fresh context 只看 diff＋判据、报 gaps 不报 style。",
    coordinates: Object.freeze([
      "lib/org/review-kit.js（复核件套）",
      "lib/org/op-set.js（复核帽注册集不含写工具）"
    ])
  }),
  Object.freeze({
    id: "D8",
    overridden: true,
    statement: "D8＝工具面是岗位卡派生物、跨模型稳定、工具名与 op 名模型无关。",
    coordinates: Object.freeze([
      "lib/org/op-set.js（一 op 一工具、工具名即 op 名）",
      "lib/org/role-cards.js（卡＝唯一源）"
    ]),
    overrideSource: Object.freeze({ ticket: "07", phrase: "覆写出处＝07 号票", rulingAnchor: "否决 MCP" })
  }),
  Object.freeze({
    id: "D9",
    statement: "D9＝升级做减法：模型更迭触发岗位评测，预期动作是删指令；删不掉的约束才沉淀，沉淀物须模型无关。",
    coordinates: Object.freeze([
      "lib/org/durability.js UPGRADE_ROUTINE_STEPS（③做减法：只许动岗位细节三处）",
      "lib/org/memory-layer.js evaluatePromotion（沉淀物过试金石）"
    ])
  }),
  Object.freeze({
    id: "D10",
    statement: "D10＝复杂度递增：单岗位能解就不加协调层；加层唯一理由是上下文隔离或并行收益，token 成本为显式代价。",
    coordinates: Object.freeze([
      "lib/org/role-cards.js（放大机制必填：填不出即不设该岗）",
      "lib/org/dispatch-config.js（动员规模＝组织常量，不加隐藏层）"
    ])
  }),
  Object.freeze({
    id: "D11",
    statement: "D11＝无岗位以 danger-full-access 为履约前提（06 号票追加）：全部岗位在 workspace-write 下可履约。",
    coordinates: Object.freeze([
      "lib/org/role-cards.js（边界字段声明）",
      "lib/org/permissions.js（L0 基底与任务域正交叠加取严）"
    ])
  })
]);

/** 被覆写判据 id（须注明覆写出处；清单变化即规格修订）。 */
export const OVERRIDDEN_CRITERIA_IDS = Object.freeze(
  DURABILITY_CRITERIA.filter((criterion) => criterion.overridden === true).map((criterion) => criterion.id)
);

/** 价值表述要件（§J「脱离模型智能提供价值」的可验证表述：裸实例三要件）。 */
export const VALUE_STATEMENT_REQUIRED_PHRASES = Object.freeze(["裸实例", "同基础工具面", "无组织命令"]);

/** 放大验证实验设计要件（§J：任务集按机制各取一、裸对照、不做消融、一次性）。 */
export const AMPLIFICATION_DESIGN_REQUIRED_PHRASES = Object.freeze([
  "3–5", "对照＝上述裸实例", "不做对照组消融", "一次性规格验收实验"
]);

/** 判据坐标解析：坐标串首个记号若是仓内路径，则该件须在仓内（防坐标漂移成空指针）。 */
export function validateCriteriaCoordinates({ repoRoot = REPO_ROOT, criteria = DURABILITY_CRITERIA } = {}) {
  const violations = [];
  for (const criterion of criteria) {
    const coordinates = criterion?.coordinates ?? [];
    if (coordinates.length === 0) {
      violations.push(`${String(criterion?.id)}: 判据缺落地坐标`);
      continue;
    }
    for (const coordinate of coordinates) {
      const path = String(coordinate).split(/[\s（(]/)[0];
      if (!/\.[mc]?js$/.test(path)) {
        violations.push(`${String(criterion?.id)}: 坐标「${coordinate}」须以仓内模块路径打头（现为 ${path}）`);
        continue;
      }
      if (!existsSync(join(repoRoot, path))) {
        violations.push(`${String(criterion?.id)}: 坐标模块不在仓内：${path}`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * 覆写出处解析（真源可回核）：`overrideSource.ticket` 须能解析到
 * `.scratch/org-v2/issues/<ticket>-*.md` 裁定件，且该件含
 * `overrideSource.rulingAnchor`（「07 号票确实这样裁过」由裁定件正文兑现，
 * 不是只在规格里自述一句）。
 */
export function validateOverrideProvenance({ repoRoot = REPO_ROOT, criteria = DURABILITY_CRITERIA } = {}) {
  const violations = [];
  const issuesDir = join(repoRoot, ".scratch", "org-v2", "issues");
  for (const criterion of criteria.filter((entry) => entry?.overridden === true)) {
    const source = criterion.overrideSource;
    if (source === undefined) {
      violations.push(`${criterion.id}: 被覆写判据缺覆写出处登记`);
      continue;
    }
    let file = null;
    try {
      file = readdirSync(issuesDir).find((name) => name.startsWith(`${source.ticket}-`) && name.endsWith(".md")) ?? null;
    } catch {
      file = null;
    }
    if (file === null) {
      violations.push(`${criterion.id}: 覆写出处 ${source.ticket} 号票的裁定件不在册（${issuesDir}）`);
      continue;
    }
    const text = readTextOrEmpty(join(issuesDir, file));
    if (!text.includes(source.rulingAnchor)) {
      violations.push(`${criterion.id}: ${file} 未含覆写裁定锚「${source.rulingAnchor}」（出处须可回核到裁定正文）`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * 规格恒久性段扫描（`V-A7.3` 的「文档扫描模块」）：对 `.scratch/org-v2/spec.md`
 * §J 逐条核 —
 *   1. 每条判据的**表述逐字在册**（`statement` 全文命中；id 号只在表述内出现即算）；
 *   2. 被覆写的 D5／D8 **紧随表述之后**注记覆写出处（`overrideSource.phrase` 打头：
 *      规格体例＝表述行下接一行「覆写出处＝…」；紧邻口径使「注记挂在别的判据下」
 *      不可蒙混过关）；
 *   3. **无表外判据号**（§J 出现的判据号集合 ⊆ D1–D11——D12 之类即清单破口）；
 *   4. 价值表述与放大验证设计要件在册（不许把「价值」退化成口号）。
 * 返回 `{ok, violations, section, checked, criteriaIds}`。
 */
export function scanDurabilitySpec(specText = "") {
  const violations = [];
  const section = specSection(specText, SPEC_SECTION_J);
  if (section === "") {
    return {
      ok: false,
      violations: [`规格缺 §J 小节（${SPEC_SECTION_J}）——D1–D11 表述与白名单锚串无处解析`],
      section: "",
      checked: 0,
      criteriaIds: []
    };
  }
  for (const criterion of DURABILITY_CRITERIA) {
    const statement = normalizeSpecText(criterion.statement);
    const at = section.indexOf(statement);
    if (at === -1) {
      violations.push(
        `${criterion.id}: 规格 §J 未逐字含其表述（判据表述漂移）——「${criterion.statement}」` +
        (criterion.overridden === true ? `（被覆写判据须注明覆写出处：${criterion.overrideSource.phrase}）` : "")
      );
      continue;
    }
    if (criterion.overridden === true) {
      // 紧邻口径：注记须**紧接着**本判据的表述（空白无关；换行后紧跟「覆写出处＝…」）
      const note = normalizeSpecText(criterion.overrideSource.phrase);
      const after = section.slice(at + statement.length);
      if (!after.startsWith(note)) {
        violations.push(
          `${criterion.id}: 被覆写判据未紧随其表述注明覆写出处（须以「${criterion.overrideSource.phrase}」打头）` +
          `——覆写出处须可归因到票号，不许只留旧词不改写`
        );
      }
    }
  }
  const found = [...section.matchAll(/\bD(\d{1,2})\b/g)].map((match) => Number(match[1]));
  const criteriaIds = [...new Set(found)].sort((a, b) => a - b).map((n) => `D${String(n)}`);
  const allowed = new Set(DURABILITY_CRITERIA.map((criterion) => Number(criterion.id.slice(1))));
  for (const n of [...new Set(found)].sort((a, b) => a - b)) {
    if (!allowed.has(n)) {
      violations.push(`D${String(n)}: 表外判据号出现在规格 §J（清单⊆D1–D11，新增判据须走规格修订）`);
    }
  }
  for (const phrase of VALUE_STATEMENT_REQUIRED_PHRASES) {
    if (!section.includes(phrase)) {
      violations.push(`价值表述要件缺失：规格 §J 须含「${phrase}」（裸实例＝同模型同权限同基础工具面、无组织命令）`);
    }
  }
  for (const phrase of AMPLIFICATION_DESIGN_REQUIRED_PHRASES) {
    if (!section.includes(phrase)) {
      violations.push(`放大验证设计要件缺失：规格 §J 须含「${phrase}」`);
    }
  }
  return { ok: violations.length === 0, violations, section, checked: DURABILITY_CRITERIA.length, criteriaIds };
}

// ---------------- 岗位评测集（V-A7.4） ----------------

/** 评测集版本（冻结件：换形即换号；样本内容变更须同批重出）。 */
export const EVAL_SET_VERSION = "org-v2/role-eval-set@1";

/** 四要素简报的必需键（记号派生自 `BRIEF_KEYS` 真源；见 `validateRoleEvalSet` 的子集断言）。 */
export const FOUR_ELEMENT_KEYS = Object.freeze(["goal", "deliverables", "sources", "boundaries", "acceptance"]);

/** 判据记账号的长度上限（超过即视为散文式期望，不再是无风格依赖的结构记号）。 */
export const MARKER_MAX_LENGTH = 40;

/**
 * 记号真源枚举登记表（`derivation.equals`／`subsetOf` 的解析面）：名字 → 真源数组。
 * 记号只此一份来源，格式表只许**引用**它，不许另抄一份（抄了会静默漂移）。
 */
export const DERIVATION_ENUMS = Object.freeze({
  PACKET_PIECES,
  REPORT_KEYS,
  BRIEF_KEYS
});

/**
 * 评测样本的输出格式登记表（**封闭枚举**）。`markers`＝该格式规定的**结构记号**
 * ——判据只许核这些记号在不在（不核措辞、不核文风），故换模型不会让判据失效。
 *
 * `derivation`＝该格式的**真源**（可解析、不靠字符串自称）：
 *   - `{kind:"card-ioContract", post, anchor}`：记号派生于该岗**输入输出契约**的
 *     产出类型——解析＝在该卡 `ioContract` 文本里找到 `anchor`；
 *   - `{kind:"module-export", module, anchor, equals|subsetOf}`：记号派生于某模块的
 *     真源枚举——解析＝该模块文本含 `anchor`，且记号与 `DERIVATION_ENUMS[equals]`
 *     等值（或悉数属于 `subsetOf`）。
 * 解析结果由 `validateRoleEvalSet` 机械核验（锚不在册／枚举漂移即违例），
 * `prescribedBy` 只作人读说明，不承担证据作用。
 */
export const EVAL_OUTPUT_FORMATS = Object.freeze([
  Object.freeze({
    id: "triage-decision",
    prescribedBy: "分诊判定件（结构记号由本格式件规定；派生于值班统筹岗契约的「上浮判定」产出）",
    derivation: Object.freeze({ kind: "card-ioContract", post: "duty-coordinator", anchor: "上浮判定" }),
    markers: Object.freeze(["\"verdict\"", "\"reasons\""])
  }),
  Object.freeze({
    id: "decision-packet",
    prescribedBy: "裁定包五件（V-A5.6 封闭清单）",
    derivation: Object.freeze({ kind: "card-ioContract", post: "duty-coordinator", anchor: "裁定请求件" }),
    markers: PACKET_PIECES
  }),
  Object.freeze({
    id: "four-element-brief",
    prescribedBy: "四要素简报契约（lib/org/brief.js BRIEF_KEYS 的四要素与验收判据）",
    derivation: Object.freeze({
      kind: "module-export",
      module: "lib/org/brief.js",
      anchor: "export const BRIEF_KEYS",
      subsetOf: "BRIEF_KEYS"
    }),
    markers: FOUR_ELEMENT_KEYS
  }),
  Object.freeze({
    id: "markdown-report",
    prescribedBy: "带来源引用的报告（含盲区清单）——记号由本格式件规定的小节标题",
    derivation: Object.freeze({ kind: "card-ioContract", post: "researcher", anchor: "盲区清单" }),
    markers: Object.freeze(["## 来源", "## 盲区"])
  }),
  Object.freeze({
    id: "patch-note",
    prescribedBy: "工件改动清单＋可执行检查结果——记号由本格式件规定",
    derivation: Object.freeze({ kind: "card-ioContract", post: "implementer", anchor: "可执行检查结果" }),
    markers: Object.freeze(["files", "checks"])
  }),
  Object.freeze({
    id: "review-report",
    prescribedBy: "复核报告封闭键集（lib/org/review-kit.js REPORT_KEYS）",
    derivation: Object.freeze({
      kind: "module-export",
      module: "lib/org/review-kit.js",
      anchor: "export const REPORT_KEYS",
      equals: "REPORT_KEYS"
    }),
    markers: REPORT_KEYS
  })
]);

/** 按 id 取格式记号（**记号单一源**：样本判据一律经本读面取，不各抄一份）。 */
export function formatMarkers(formatId) {
  const format = EVAL_OUTPUT_FORMATS.find((entry) => entry.id === formatId);
  if (format === undefined) throw new Error(`未知评测输出格式（fail closed）：${String(formatId)}`);
  return format.markers;
}

/** 样本坐标槽（冻结样本里只许出现这些占位符；实例身份在登记时代入）。 */
export const EVAL_SAMPLE_SLOTS = Object.freeze(["botId"]);

/** 样本坐标模板：受影响实例自己的 workspace（`<工作区根>/<botId>`，L1 可写面内；根名单源 lib/data-roots.cjs）。 */
function evalArtifact(botIdlessName) {
  return `${rootsWorkspaceRootName}/{{botId}}/eval/${botIdlessName}`;
}

/** 记号核验判据助手：把一组结构记号铺成 `fs.contains` 判据。 */
function markerCriteria(location, markers) {
  return markers.map((text) => ({ probe: "fs.contains", args: { location, text } }));
}

const EVAL_LEDGER_SOURCE = Object.freeze({ tool: "ledger.read", ref: "bots/ledger/events.jsonl" });

/**
 * 岗位评测集（组织常量，值班统筹维护；`V-A7.4`）。每岗位 **1–3 个冻结样本**＝
 * 契约回放：样本简报按岗位卡「输入输出契约＋验收判据」派生，判据可执行（探针
 * 白名单内）、样本本身过换模型试金石（不含模型记号、判据只核结构记号）。
 * 规模与频次数值属用户域——本表只保证「每岗至少一个可执行评测项」这一形状。
 */
export const ROLE_EVAL_SET = Object.freeze([
  Object.freeze({
    id: "duty-triage",
    post: "duty-coordinator",
    format: "triage-decision",
    derivedFrom: "role-card:duty-coordinator#ioContract",
    frozenAt: "2026-09-20",
    slots: EVAL_SAMPLE_SLOTS,
    brief: Object.freeze({
      goal: "对样本目标做收单分诊：判定为直办／立项／澄清／拒收四值之一，并写明判定理由。",
      deliverables: Object.freeze([
        Object.freeze({ format: "triage-decision", location: evalArtifact("duty-triage/decision.json") })
      ]),
      sources: Object.freeze([EVAL_LEDGER_SOURCE]),
      boundaries: "只出分诊判定件；不派单、不编组、不实施、不自行裁决两线冲突。",
      acceptance: Object.freeze(markerCriteria(evalArtifact("duty-triage/decision.json"), formatMarkers("triage-decision"))),
      reviewPoints: Object.freeze(["before-external-visibility"])
    }),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "判据只核判定件的两个结构键在不在，不核措辞——换模型后仍可判，样本不依赖特定模型输出风格"
    })
  }),
  Object.freeze({
    id: "duty-prescreen",
    post: "duty-coordinator",
    format: "decision-packet",
    derivedFrom: "role-card:duty-coordinator#ioContract",
    frozenAt: "2026-09-20",
    slots: EVAL_SAMPLE_SLOTS,
    brief: Object.freeze({
      goal: "对样本产出按必审清单做验收初审，整理裁定包：五件齐备后写入工件坐标。",
      deliverables: Object.freeze([
        Object.freeze({ format: "decision-packet", location: evalArtifact("duty-prescreen/packet.json") })
      ]),
      sources: Object.freeze([EVAL_LEDGER_SOURCE]),
      boundaries: "初审只整理裁定包；不可代的三类（模型指派／越权处置／冲突仲裁）一律上浮，不自行处置。",
      acceptance: Object.freeze(markerCriteria(evalArtifact("duty-prescreen/packet.json"), formatMarkers("decision-packet"))),
      reviewPoints: Object.freeze(["before-external-visibility"])
    }),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "裁定包五件是规格冻结的结构清单（V-A5.6），与模型无关；判据核件数不核文风"
    })
  }),
  Object.freeze({
    id: "lead-decompose",
    post: "project-lead",
    format: "four-element-brief",
    derivedFrom: "role-card:project-lead#ioContract",
    frozenAt: "2026-09-20",
    slots: EVAL_SAMPLE_SLOTS,
    brief: Object.freeze({
      goal: "把样本目标分解为一份四要素简报件：四要素与可执行验收判据齐备。",
      deliverables: Object.freeze([
        Object.freeze({ format: "four-element-brief", location: evalArtifact("lead-decompose/brief.json") })
      ]),
      sources: Object.freeze([EVAL_LEDGER_SOURCE]),
      boundaries: "只出简报件；不实施、不自任复核者、不预置承接方的语义决定。",
      acceptance: Object.freeze(markerCriteria(evalArtifact("lead-decompose/brief.json"), formatMarkers("four-element-brief"))),
      reviewPoints: Object.freeze(["before-external-visibility"])
    }),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "判据核的是简报契约键（真源 BRIEF_KEYS 的子集），键与模型无关；措辞不进判据"
    })
  }),
  Object.freeze({
    id: "researcher-report",
    post: "researcher",
    format: "markdown-report",
    derivedFrom: "role-card:researcher#ioContract",
    frozenAt: "2026-09-20",
    slots: EVAL_SAMPLE_SLOTS,
    brief: Object.freeze({
      goal: "对样本问题做事实调查并产出报告：结论带来源引用，并单列盲区清单。",
      deliverables: Object.freeze([
        Object.freeze({ format: "markdown-report", location: evalArtifact("researcher-report/report.md") })
      ]),
      sources: Object.freeze([Object.freeze({ tool: "knowledge.search", ref: "bots/knowledge/index.jsonl" })]),
      boundaries: "不改代码／文档／配置等工件；不自行改判据；不在简报范围外扩查。",
      acceptance: Object.freeze(markerCriteria(evalArtifact("researcher-report/report.md"), formatMarkers("markdown-report"))),
      reviewPoints: Object.freeze(["before-external-visibility"])
    }),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "判据核的是输出格式规定的两个小节标题（格式由本样本预先规定），不核报告措辞与详略"
    })
  }),
  Object.freeze({
    id: "implementer-change",
    post: "implementer",
    format: "patch-note",
    derivedFrom: "role-card:implementer#ioContract",
    frozenAt: "2026-09-20",
    slots: EVAL_SAMPLE_SLOTS,
    brief: Object.freeze({
      goal: "按样本要求在仓库内做一次有界改动，跑指定回归件使其通过，并写明改动清单与检查结果。",
      deliverables: Object.freeze([
        Object.freeze({ format: "patch-note", location: evalArtifact("implementer-change/change.json") })
      ]),
      sources: Object.freeze([EVAL_LEDGER_SOURCE]),
      boundaries: "不越出简报范围改工件、不自行改判据、不自行验收自己的产出、不以 danger-full-access 为履约前提。",
      acceptance: Object.freeze([
        Object.freeze({ probe: "node.tests", args: Object.freeze({ file: "org-durability.test.mjs" }) })
      ]),
      reviewPoints: Object.freeze(["before-external-visibility"])
    }),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "判据是可执行回归件（退出码即结论），与模型输出风格无关——改动是否保住契约由测试判，不由文风判"
    })
  }),
  Object.freeze({
    id: "verifier-report",
    post: "verifier",
    format: "review-report",
    derivedFrom: "role-card:verifier#ioContract",
    frozenAt: "2026-09-20",
    slots: EVAL_SAMPLE_SLOTS,
    brief: Object.freeze({
      goal: "对样本移交件做独立复核：出具复核报告并按复核报告键结构写入工件坐标。",
      deliverables: Object.freeze([
        Object.freeze({ format: "review-report", location: evalArtifact("verifier-report/report.json") })
      ]),
      sources: Object.freeze([EVAL_LEDGER_SOURCE]),
      boundaries: "只报 gaps 不评 style；不改工件、不代产出方修复；无写通道、不持台账全量读。",
      acceptance: Object.freeze(markerCriteria(evalArtifact("verifier-report/report.json"), formatMarkers("review-report"))),
      reviewPoints: Object.freeze(["before-external-visibility"])
    }),
    touchstone: Object.freeze({
      verdict: "pass",
      survivesBecause: "判据核复核报告契约键（真源 REPORT_KEYS），键集与模型无关；报告内容质量由用户终裁，不由判据代替"
    })
  })
]);

/** 该岗位的评测样本（顺序即冻结顺序；未知岗位返回空数组）。 */
export function evalSamplesForPost(post) {
  return ROLE_EVAL_SET.filter((sample) => sample.post === post);
}

/** 样本的例程 id（评测集＝例程登记项；一岗多样本时逐样本一例程）。 */
export function evalRoutineIdFor(sample) {
  return `eval-${String(sample?.id ?? "(缺样本)")}`;
}

/** 取样本序列化文本（词法扫描面：样本本身须过试金石——不得含模型记号）。 */
function sampleText(sample) {
  return JSON.stringify(sample?.brief ?? {});
}

/**
 * 样本过试金石判定（`V-A7.4`「样本本身过换模型试金石（不得依赖特定模型输出
 * 风格）」的机械形态）：
 *   1. 样本简报文本**零模型记号**（模型记号表与组织层件扫描同一份）；
 *   2. `fs.contains` 判据的文本必须是**结构记号**：短（≤`MARKER_MAX_LENGTH`）、
 *      不含句末标点（散文式期望＝依赖特定输出风格），且属声明格式登记的记号；
 *   3. 试金石问答记录齐备（verdict=pass＋理由非空）。
 * 返回 `{ok, violations}`。
 */
export function sampleTouchstone(sample, { formats = EVAL_OUTPUT_FORMATS } = {}) {
  const violations = [];
  const id = isNonEmptyString(sample?.id) ? sample.id : "(缺样本 id)";
  const text = sampleText(sample);
  const scan = scanModelAssumptions([{ path: `${id}（样本简报）`, text }]);
  for (const violation of scan.violations) {
    violations.push(`${violation.split("→")[0].trim()}→ 样本不得依赖特定模型（模型记号即出格）`);
  }
  const format = (formats ?? []).find((entry) => entry.id === sample?.format) ?? null;
  if (format === null) {
    violations.push(`${id}: 输出格式「${String(sample?.format)}」不在格式登记表（判据记号无处解析）`);
  }
  for (const criterion of sample?.brief?.acceptance ?? []) {
    if (criterion?.probe !== "fs.contains") continue;
    const value = criterion?.args?.text;
    if (!isNonEmptyString(value)) {
      violations.push(`${id}: fs.contains 判据缺 text（结构记号必填）`);
      continue;
    }
    if (value.length > MARKER_MAX_LENGTH || /[。！？；]/.test(value)) {
      violations.push(
        `${id}: 判据文本「${value}」是散文式期望（含句末标点或超出 ${String(MARKER_MAX_LENGTH)} 字）` +
        `→ 依赖特定模型输出风格，未过换模型试金石`
      );
    }
    if (format !== null && !format.markers.includes(value)) {
      violations.push(`${id}: 判据文本「${value}」不是声明格式 ${format.id} 的结构记号（格式之外不得自定判据）`);
    }
  }
  for (const location of sampleLocations(sample)) {
    for (const slot of location.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) {
      if (!(sample?.slots ?? []).includes(slot[1])) {
        violations.push(`${id}: 坐标占位符 {{${slot[1]}}} 不在样本申报的槽位集内（${(sample?.slots ?? []).join("、")}）`);
      }
    }
  }
  if (sample?.touchstone?.verdict !== "pass" || !isNonEmptyString(sample?.touchstone?.survivesBecause)) {
    violations.push(`${id}: 缺试金石问答记录（verdict=pass＋存活理由，不得空壳声明）`);
  }
  return { ok: violations.length === 0, violations };
}

/** 样本内全部坐标（交付物与判据坐标；占位符槽位校验用）。 */
function sampleLocations(sample) {
  const out = [];
  for (const entry of sample?.brief?.deliverables ?? []) {
    if (isNonEmptyString(entry?.location)) out.push(entry.location);
  }
  for (const criterion of sample?.brief?.acceptance ?? []) {
    if (isNonEmptyString(criterion?.args?.location)) out.push(criterion.args.location);
  }
  return out;
}

/**
 * 评测集形状校验（`V-A7.4`）：五类角色类别各有 1–3 个样本、样本过试金石、
 * 简报合法（判据可执行）、格式记号真源一致（四要素记号⊆`BRIEF_KEYS`）。
 * 返回 `{ok, violations, coverage}`——`coverage` 逐岗列样本数与可执行项数。
 */
export function validateRoleEvalSet({
  evalSet = ROLE_EVAL_SET,
  cards = ROLE_CARDS,
  formats = EVAL_OUTPUT_FORMATS,
  repoRoot = REPO_ROOT
} = {}) {
  const violations = [];
  const coverage = [];
  for (const key of FOUR_ELEMENT_KEYS) {
    if (!BRIEF_KEYS.includes(key)) violations.push(`四要素记号 ${key} 不是简报契约键（记号表与契约漂移）`);
  }
  // 格式真源可解析（不靠自称）：卡面契约锚／模块导出锚＋记号与真源枚举等值（子集）
  for (const format of formats) {
    const id = String(format?.id ?? "(缺格式 id)");
    const derivation = format?.derivation;
    if (derivation === undefined) {
      violations.push(`${id}: 缺派生来源（真源须可解析，不许自称）`);
    } else if (derivation.kind === "card-ioContract") {
      const card = cards.find((entry) => entry.slug === derivation.post);
      if (card === undefined) {
        violations.push(`${id}: 派生来源岗位不在册：${String(derivation.post)}`);
      } else if (!String(card.ioContract ?? "").includes(derivation.anchor)) {
        violations.push(`${id}: 派生锚「${String(derivation.anchor)}」不在 ${String(derivation.post)} 的输入输出契约内`);
      }
    } else if (derivation.kind === "module-export") {
      const text = readTextOrEmpty(join(repoRoot, derivation.module));
      if (text === "") violations.push(`${id}: 派生来源模块不可读：${String(derivation.module)}`);
      else if (!text.includes(derivation.anchor)) {
        violations.push(`${id}: 派生锚「${String(derivation.anchor)}」不在 ${String(derivation.module)} 内`);
      }
    } else {
      violations.push(`${id}: 未知派生种类 ${String(derivation.kind)}`);
    }
    if (derivation?.equals !== undefined) {
      const source = DERIVATION_ENUMS[derivation.equals];
      if (!Array.isArray(source)) {
        violations.push(`${id}: 真源枚举 ${String(derivation.equals)} 未登记`);
      } else if (source.length !== format.markers.length
        || source.some((marker, index) => marker !== format.markers[index])) {
        violations.push(`${id}: 记号与真源枚举 ${derivation.equals} 不等（单一源破口：记号被另抄一份）`);
      }
    }
    if (derivation?.subsetOf !== undefined) {
      const source = DERIVATION_ENUMS[derivation.subsetOf];
      if (!Array.isArray(source)) {
        violations.push(`${id}: 真源枚举 ${String(derivation.subsetOf)} 未登记`);
      } else {
        for (const marker of format.markers) {
          if (!source.includes(marker)) violations.push(`${id}: 记号「${marker}」不是 ${derivation.subsetOf} 成员（超出契约键集）`);
        }
      }
    }
  }
  const ids = new Set();
  for (const sample of evalSet) {
    const id = isNonEmptyString(sample?.id) ? sample.id : "(缺样本 id)";
    if (ids.has(id)) violations.push(`${id}: 样本 id 重复`);
    ids.add(id);
    if (!cards.some((card) => card.slug === sample?.post)) {
      violations.push(`${id}: 岗位 ${String(sample?.post)} 不在岗位卡契约面`);
    }
    if (Number.isNaN(Date.parse(sample?.frozenAt ?? ""))) violations.push(`${id}: frozenAt 须为可解析的冻结时点`);
    const brief = validateBrief(sample?.brief);
    if (!brief.ok) {
      violations.push(`${id}: 样本简报非法（判据须可执行）——${brief.violations.join("；")}${brief.gap ? `；${brief.gap.reason}` : ""}`);
    }
    // 派生声明须落到**真在册的卡面**（原来只正则查形状，等于不解析）
    const derivedFrom = String(sample?.derivedFrom ?? "");
    const derivedSlug = derivedFrom.match(/^role-card:([a-z-]+)#ioContract$/)?.[1] ?? null;
    if (derivedSlug === null) {
      violations.push(`${id}: 派生声明形状非法（应形如 role-card:<slug>#ioContract）：${derivedFrom}`);
    } else if (!cards.some((card) => card.slug === derivedSlug)) {
      violations.push(`${id}: 派生来源岗位不在册：${derivedSlug}`);
    } else if (derivedSlug !== sample?.post) {
      violations.push(`${id}: 派生来源 ${derivedSlug} 与其 home 岗 ${String(sample?.post)} 不一致`);
    }
    const verdict = sampleTouchstone(sample, { formats });
    violations.push(...verdict.violations);
  }
  for (const card of cards) {
    const samples = evalSet.filter((sample) => sample?.post === card.slug);
    if (samples.length < 1) {
      violations.push(`${card.slug}: 缺岗位评测样本（每岗至少一个可执行评测项）`);
      continue;
    }
    if (samples.length > 3) {
      violations.push(`${card.slug}: 样本数 ${String(samples.length)} 超出 1–3（规模属用户域，形状锁 1–3）`);
    }
    coverage.push({
      post: card.slug,
      samples: samples.length,
      executableItems: samples.filter((sample) => (sample?.brief?.acceptance ?? []).length > 0).length
    });
  }
  return { ok: violations.length === 0, violations, coverage, version: EVAL_SET_VERSION };
}

/**
 * 评测例程登记项的**触发器核验**（纯函数，登记腿的前置门）：例程登记项声明的
 * `trigger.source` 必须正是 `MODEL_UPGRADE_TRIGGER_SOURCE`——宿主登记腿只在这一
 * 声明成立时才落任务。声明与实现因此互相绑定：登记表里把触发源改坏、或有人把
 * 别的例程塞进评测登记腿，都在登记前响亮失败（fail closed），而不是照单执行。
 */
export function checkEvalRoutineTrigger(entry) {
  const source = entry?.trigger?.source;
  if (entry?.trigger?.kind !== "event") {
    return { ok: false, code: "eval-routine-trigger-kind", reason: "评测例程触发条件须为事件型（kind=event）" };
  }
  if (source !== MODEL_UPGRADE_TRIGGER_SOURCE) {
    return {
      ok: false,
      code: "eval-routine-trigger-mismatch",
      reason: `评测例程触发源须为 ${MODEL_UPGRADE_TRIGGER_SOURCE}：${String(source)}`
    };
  }
  return { ok: true };
}

/**
 * 评测例程登记项（由评测集派生——样本改一处，例程模板同批跟着改，不手抄第二份）。
 * 例程 id＝`eval-<样本 id>`；触发源＝注册表模型指派变更；简报＝样本简报＋
 * 「在 {{model}} 下回放」前缀与做减法边界（③做减法只许动岗位细节三处）。
 */
export function evalRoutineEntries() {
  return ROLE_EVAL_SET.map((sample) => ({
    routineId: evalRoutineIdFor(sample),
    trigger: { kind: "event", source: MODEL_UPGRADE_TRIGGER_SOURCE },
    briefTemplate: {
      ...sample.brief,
      goal: `【模型更迭评测·{{model}}】${sample.brief.goal}`,
      boundaries: `${sample.brief.boundaries}（升级例程③做减法只许动岗位细节三处：岗位卡第 7 字段／提示段／实例配置）`
    },
    budget: null
  }));
}

// ---------------- 模型更迭升级例程（V-A7.4 四步） ----------------

/** 评测例程的触发源（注册表模型指派变更；`ROUTINE_REGISTRY` 的评测段与宿主登记腿共用）。 */
export const MODEL_UPGRADE_TRIGGER_SOURCE = "registry:model-assignment-changed";

/** 指派身份串（幂等窗的目标指派分量）：`provider/model[@effort]`；空指派＝`unassigned`。 */
export function assignmentKeyOf(assignment) {
  const provider = String(assignment?.provider ?? "").trim();
  const model = String(assignment?.model ?? "").trim();
  if (provider === "" && model === "") return "unassigned";
  const effort = String(assignment?.reasoningEffort ?? "").trim();
  return `${provider}/${model}${effort === "" ? "" : `@${effort}`}`;
}

/** 指派的人读串（展开进评测任务目标；不是判据，措辞不进任何判据）。 */
function assignmentLabel(assignment) {
  const key = assignmentKeyOf(assignment);
  return key === "unassigned" ? "未指派" : key;
}

/**
 * 升级例程四步（`V-A7.4`）：①触发登记 ②新模型跑评测集 ③做减法 ④用户终裁。
 * ③④ 是流程纪律（做减法只许动岗位细节三处；结论按复核件套投递、用户终裁，
 * 评测不过则回滚为默认建议）——本表把它们的落地坐标点名在案，不新造命令面：
 * 终裁仍走人间收件箱的台账命令特化视图。
 */
export const UPGRADE_ROUTINE_STEPS = Object.freeze([
  Object.freeze({
    id: "trigger",
    statement: "①触发：用户改实例模型指派落注册表 → 台账自动登记 class=duty 评测任务（不依赖用户记得手动跑）。",
    coordinates: Object.freeze([
      "lib/index.js（BotsApi.patch 的 modelChanged 腿）",
      "lib/org/ledger-host.js registerModelUpgradeEval（登记腿）",
      "lib/org/dispatch-config.js ROUTINE_REGISTRY（eval-* 评测例程登记项）"
    ])
  }),
  Object.freeze({
    id: "execute",
    statement: "②执行：受影响岗位实例在同一目标指派下跑岗位评测集（每岗 1–3 个契约回放样本，判据可执行）。",
    coordinates: Object.freeze(["lib/org/durability.js ROLE_EVAL_SET", "台账评测任务的简报（样本判据）"])
  }),
  Object.freeze({
    id: "subtract",
    statement: "③做减法：评测通过且质量不降即删提示段规定性指令；删不掉的约束沉淀进知识库（沉淀物过试金石）——只许动岗位细节三处。",
    coordinates: Object.freeze([
      "lib/org/durability.js ROLE_DETAIL_HOMES（三处边界）",
      "lib/org/memory-layer.js evaluatePromotion（沉淀物过试金石）"
    ])
  }),
  Object.freeze({
    id: "final-ruling",
    statement: "④验证与终裁：评测结论按复核件套投递用户，用户终裁是否收编新指派；评测不过则回滚指派为默认建议。",
    coordinates: Object.freeze([
      "lib/org/review-kit.js（复核件套：结论件形状）",
      "lib/org/human-inbox.js（人间收件箱：用户终裁＝台账命令特化视图）"
    ])
  })
]);

/**
 * 升级例程①触发的登记计划（纯函数）。输入＝受影响实例 id、其 home 岗位、改动
 * 前后的模型指派。返回 `{action, reason?, assignments[], ...}`：
 *   - `action: "register"`＋`assignments`：该岗位的**每个评测样本**一张例程任务
 *     （例程 id＝`eval-<样本 id>`），幂等窗＝`<实例 id>:<样本 id>:<目标指派>`——
 *     目标指派分量使「换到另一个模型」是新窗（另开一张），同一指派重复落地＝
 *     同一窗（`triggerRoutine` 幂等，不产生第二张任务）；
 *   - `action: "skip"`＋`reasons[]`（`reason`＝首条，日志摘要兼容面）：未绑 home
 *     岗位（v1 形态／过渡期，无岗位评测集）、目标指派为空（解绑不是升级）、缺
 *     实例 id、岗位无评测样本——四种缺席**逐前提列名、多前提同缺不合并**，
 *     绝不静默登记空评测。
 */
export function planModelUpgradeEval({ botId, post, before, after } = {}) {
  const from = assignmentKeyOf(before);
  const to = assignmentKeyOf(after);
  const base = { action: "skip", botId: botId ?? "", post: post ?? "", from, to, assignments: [] };
  const reasons = [];
  if (!isNonEmptyString(botId)) {
    reasons.push("缺实例 id：无法锚定受影响实例，评测任务不登记");
  }
  if (to === "unassigned") {
    reasons.push("目标指派为空（解绑模型不属升级）：评测任务不登记");
  }
  if (!isNonEmptyString(post)) {
    reasons.push("实例未绑 home 岗位（v1 形态／过渡期）：无岗位评测集可跑，评测任务不登记");
  } else if (evalSamplesForPost(post).length === 0) {
    reasons.push(`岗位「${post}」无评测样本（fail closed，不静默登记空评测）`);
  }
  if (reasons.length > 0) {
    return { ...base, reasons, reason: reasons[0] };
  }
  const samples = evalSamplesForPost(post);
  const vars = { botId: botId, model: assignmentLabel(after) };
  return {
    action: "register",
    botId,
    post,
    from,
    to,
    samples: samples.length,
    assignments: samples.map((sample) => ({
      sampleId: sample.id,
      routineId: evalRoutineIdFor(sample),
      window: `${botId}:${sample.id}:${to}`,
      vars
    }))
  };
}
