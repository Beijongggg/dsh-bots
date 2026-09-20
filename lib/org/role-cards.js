/**
 * 岗位卡契约面（org-v2 04 号票；规格 §A 与附录 A V-A1.1／V-A1.2／V-A4.2）。
 *
 * 五类角色类别的岗位卡＝**契约唯一源**：常设四岗（`duty-coordinator` 值班统筹／
 * `project-lead` 项目经理／`researcher` 研究员／`implementer` 实施者）＋按需
 * `verifier` 复核帽。英文 slug 是契约主键，中文名是显示名——改显示名不动工具与
 * 权限命名空间（`toolNamespace`／`permissionNamespace` 均由 slug 派生）。
 *
 * 八字段中第 1–6 与第 8 字段属**组织层件**（受换模型试金石约束：换一更强模型后
 * 这条会不会变成废话或障碍）；第 7 字段「模型档位」属用户域，契约面留空。字段 8
 * 「依赖面·更迭敏感性」只引用宿主适配面登记的**面 id**（`lib/host-faces.js`），
 * 不重复坐标——宿主改名/改形状时改登记表条目，不改岗位卡。
 *
 * 提示段是派生物：`renderPostPromptSegment` 按卡渲染每岗系统提示段，插件按注册表的
 * home 岗位（`post` 字段）取用——岗位提示文本不再写在 `lib` 里；构建期漂移校验见
 * `scripts/role-card-drift-check.mjs`（卡哈希与渲染产物不一致即 fail）。v1 的双审
 * 两段注入（`dsh-bots:review`／`dsh-bots:review-gate`）已随 03 号票退役摘除。
 */
import { createHash } from "node:crypto";

import { HOST_FACES } from "../host-faces.js";

/** 岗位卡字段集（八字段，顺序即渲染顺序；V-A1.1 冻结字段）。 */
export const ROLE_CARD_FIELDS = [
  "responsibility",  // 1 一句话职责
  "trigger",         // 2 触发条件
  "ioContract",      // 3 输入输出契约
  "boundaries",      // 4 边界（不做什么）
  "rationale",       // 5 存在理由（哪个终景需求）
  "amplification",   // 6 放大机制（分解·互检·外置·并行；必填——填不出即不设该岗）
  "modelTier",       // 7 模型档位（用户域，留空）
  "hostDependency"   // 8 依赖面·更迭敏感性（宿主适配面 id 引用，不重复坐标）
];

/** 字段中文名（渲染与报错用语；字段名即契约键，不改）。 */
export const ROLE_CARD_FIELD_LABELS = {
  responsibility: "一句话职责",
  trigger: "触发条件",
  ioContract: "输入输出契约",
  boundaries: "边界（不做什么）",
  rationale: "存在理由",
  amplification: "放大机制",
  modelTier: "模型档位",
  hostDependency: "依赖面·更迭敏感性"
};

/**
 * 五张岗位卡。文本取自 org-v2 03 号票裁定表与规格 §A（「不单设岗」裁定见
 * NOT_STANDALONE_ASSIGNMENTS），不在此发明新政策。
 */
export const ROLE_CARDS = [
  {
    slug: "duty-coordinator",
    displayName: "值班统筹",
    responsibility: "接单、分诊与验收初审：接收用户目标与外部事件，判定走确定性路径还是上浮给 LLM 岗（初审作为流程步骤由本岗或复核者实例承载），并维护组织常量（知识索引／规程文本／席位健康，遵循「谁产出谁登记」），代表组织投递裁定请求，承担模型升级评测例程。",
    trigger: "常驻可用；LLM 部分按上浮唤醒（机械动作归确定性组件，每次上浮须可归因）。",
    ioContract: "输入＝用户目标、外部事件、他岗上浮请求；输出＝确定性路径的放行或带归因的上浮判定、组织常量（知识索引／规程／席位健康）、经单入口投递的裁定请求件、升级评测结论。",
    boundaries: "不编组、不派单、不实施、不自行裁决两线冲突（冲突上抛用户）；不承担任务验收终裁（终裁归用户）；调度常态归本岗、目标态归项目经理；运维（实例启停／注册表 CRUD／模型指派）属人间面，不设本岗 op。",
    rationale: "常态值守＋人间接口归一＋组织常量维护——v1 无常驻值守岗位，本岗是新增角色类别（非迁移）。",
    amplification: "外置（规程与知识工件化）＋流程脚手架",
    modelTier: "",
    hostDependency: ["HF-CTX-SERVICES", "HF-LEDGER-COMMANDS", "HF-V2-LEDGER-FORMAT", "HF-SESSION-LOG"]
  },
  {
    slug: "project-lead",
    displayName: "项目经理",
    responsibility: "目标态统筹：做立项判定、分解任务、出四要素简报（含验收预登记）、按 scaling rules 控动员规模、跟踪与结算、产出回笼。",
    trigger: "目标到达且分诊判定需要编组（两顶帽子与常驻值守岗显式区分）。",
    ioContract: "输入＝值班统筹移交的目标与分诊结论；输出＝立项结论、分解后的四要素简报（目标／输出格式／工具与来源约束／边界＋可执行验收判据）、派单、结算结论与回笼产出。",
    boundaries: "不实施（不动工件）；无常驻值守职责（不接单、不替值班统筹维护组织常量）；调度目标态归本岗（常态归值班统筹）；不自任复核者；不预置承接方的语义决定。",
    rationale: "目标→团队自治：把用户目标变成可执行编组、可验收产出与结算。",
    amplification: "分解＋并行（上下文隔离）",
    modelTier: "",
    hostDependency: ["HF-CTX-SERVICES", "HF-LEDGER-COMMANDS", "HF-V2-LEDGER-FORMAT"]
  },
  {
    slug: "researcher",
    displayName: "研究员",
    responsibility: "事实调查：对指定问题取得可引用的事实与来源，产出报告（含盲区清单）。",
    trigger: "项目经理派单（承接任务，按简报边界开工）。",
    ioContract: "输入＝派单简报（四要素＋验收预登记）与当次签发的 capability；输出＝带来源引用的报告（含盲区清单）与工件提交。开工前先 knowledge_search 查历史结论作起点（避免重复调研）。",
    boundaries: "不改代码/文档/配置等工件；不自行改判据；不替派单方做取舍决定；不在简报范围外扩查。",
    rationale: "超单窗信息与外部知识面——需要独立上下文的隔离调查（v1 实施面成员空缺，属新建）。",
    amplification: "外置（工件）＋隔离（独立上下文）",
    modelTier: "",
    hostDependency: ["HF-CTX-SERVICES", "HF-LEDGER-COMMANDS", "HF-V2-LEDGER-FORMAT"]
  },
  {
    slug: "implementer",
    displayName: "实施者",
    responsibility: "实施：按简报改工件（代码／文档／配置）、跑可执行检查、出证据；含宿主适配层维护（设计并入本岗——同一上下文预算内的设计-实现闭环）。",
    trigger: "项目经理派单（承接任务，按简报边界开工）。",
    ioContract: "输入＝派单简报与当次签发的 capability；输出＝工件改动、可执行检查结果（evidence.probe）、证据产物与完成报告。",
    boundaries: "不自行改判据、不自行验收自己的产出；不越出简报范围改工件；不持有 user principal；不得以 danger-full-access 为履约前提。",
    rationale: "需要动工件的执行面——v1 实施面成员空缺（PLAN「编码方实例：未创建」），属新建。",
    amplification: "互检（验证外置）＋外置（证据）",
    modelTier: "",
    hostDependency: [
      "HF-CTX-SERVICES", "HF-LEDGER-COMMANDS", "HF-V2-LEDGER-FORMAT",
      "HF-CONFIG-IDS", "HF-CLIENT-SLOTS", "HF-CLIENT-VISUAL", "HF-CLIENT-LOCALE",
      "HF-HOST-RPC", "HF-SPAWN-CLI"
    ]
  },
  {
    slug: "verifier",
    displayName: "复核者",
    responsibility: "独立复核：只看 diff＋判据，报 gaps 不报 style。",
    trigger: "关键产出的复核点命中（复核点是边界事件，不是流程阶段；形式归复核件套）。",
    ioContract: "输入＝diff、台账简报里预登记的验收判据、只读 capability；输出＝gaps 报告（复核件），两轮未闭合即上浮。",
    boundaries: "无任何写 op、无台账全量读（只读是结构性的，不靠约定）；不改工件、不代产出方修复；不评 style；不入常驻编制（按需召集，注册表无常驻复核席位）。",
    rationale: "MAST「任务验证缺失」类失败——以 fresh-context 实例做独立复核。",
    amplification: "互检（fresh context）",
    modelTier: "",
    hostDependency: ["HF-CTX-SERVICES", "HF-LEDGER-COMMANDS", "HF-V2-LEDGER-FORMAT"]
  }
];

/** 在册岗位 slug 集（契约主键顺序）。 */
export function roleSlugs(cards = ROLE_CARDS) {
  return cards.map((card) => card.slug);
}

function assertSlug(slug) {
  if (typeof slug !== "string" || !/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(`岗位 slug 非法（须为英文契约主键）：${JSON.stringify(slug)}`);
  }
  return slug;
}

/**
 * 工具命名空间（按 slug 派生，改显示名不动此串）。工具名仍＝op 名（§E
 * 「一 op 一工具、工具名即 op 名」），故本串是**注册域**标识而非工具名前缀：
 * 工具面按岗位注册时用它划域（消费方＝06 号票工具面／权限面），改显示名只改
 * 提示段的称呼。V-A1.2 的负例即锁「改显示名不动此串」。
 */
export function toolNamespace(slug) {
  return `tool:${assertSlug(slug)}`;
}

/** 权限命名空间（按 slug 派生，改显示名不动此串）：capability 的岗位作用域标识。 */
export function permissionNamespace(slug) {
  return `perm:${assertSlug(slug)}`;
}

/** 卡级派生面（工具面与权限面消费）：命名空间只读 slug，与显示名无关。 */
export function deriveNamespaces(card) {
  const slug = assertSlug(card?.slug);
  return { tool: toolNamespace(slug), permission: permissionNamespace(slug) };
}

/**
 * 按卡渲染岗位系统提示段（提示段＝派生物，卡＝唯一源）。
 *
 * 第 1–6 与第 8 字段逐条入段（第 8 字段只列面 id，不抄宿主坐标）；第 7 字段
 * 「模型档位」属用户域——留空即不入段（避免把空占位写进提示），实例若在配置面
 * 填了档位则一并入段。
 */
export function renderPostPromptSegment(card) {
  const slug = assertSlug(card?.slug);
  const lines = [`## 岗位契约：${card?.displayName ?? slug}（${slug}）`, ""];
  for (const field of ROLE_CARD_FIELDS) {
    const value = card?.[field];
    if (field === "modelTier" && value === "") continue;
    if (field === "hostDependency") {
      lines.push(`- ${ROLE_CARD_FIELD_LABELS[field]}：${value.join("、")}（宿主适配面 id 引用；面形状更迭时改登记表条目与适配层，不改本卡）`);
      continue;
    }
    lines.push(`- ${ROLE_CARD_FIELD_LABELS[field]}：${value}`);
  }
  return lines.join("\n");
}

/** 全岗位提示段（slug → 段文本；启动时按实例 home 岗位取用，构建期校验用全量）。 */
export function renderAllPostSegments(cards = ROLE_CARDS) {
  const out = {};
  for (const card of cards) out[assertSlug(card?.slug)] = renderPostPromptSegment(card);
  return out;
}

/**
 * 「不单设岗」裁定的编码（规格 §A 与 org-v2 03 号票 Answer）：这些职责不单独立岗，
 * 而是并进既有岗位。`mention` 是必须出现在归属岗位卡渲染段里的口径串——卡面丢掉
 * 该职责口径即校验报违例，防「裁定只活在决议文本里、卡面另说一套」。
 */
export const NOT_STANDALONE_ASSIGNMENTS = [
  {
    duty: "分诊与验收初审",
    posts: ["duty-coordinator"],
    mention: "验收初审",
    note: "判断部分归值班统筹、机械部分归确定性组件；初审作为流程步骤的承载者可为本岗或复核者实例（形式归复核件套票）。"
  },
  {
    duty: "知识维护与规程维护",
    posts: ["duty-coordinator"],
    mention: "谁产出谁登记",
    note: "本岗职责＋每岗「谁产出谁登记」；不单列的理由是共享同一上下文与工具面，单列会变成自己维护的规程审自己。"
  },
  {
    duty: "调度与派单",
    posts: ["duty-coordinator", "project-lead"],
    mention: "调度",
    note: "常态归值班统筹、目标态归项目经理（两顶帽子显式区分）。"
  },
  {
    duty: "模型升级评测",
    posts: ["duty-coordinator"],
    mention: "模型升级评测",
    note: "本岗组织的例行职责（升级例程细节归恒久性票）。"
  },
  {
    duty: "设计",
    posts: ["implementer"],
    mention: "设计并入本岗",
    note: "同一上下文预算内的设计-实现闭环，不单设设计岗。"
  }
];

/** 校验卡面与「不单设岗」裁定一致（归属岗位在册 ＋ 口径串出现在该岗渲染段内）。 */
export function validateNotStandalone(cards = ROLE_CARDS) {
  const violations = [];
  for (const entry of NOT_STANDALONE_ASSIGNMENTS) {
    const duty = entry?.duty ?? "(缺 duty)";
    if (typeof entry?.duty !== "string" || entry.duty.trim() === "") violations.push("不单设岗条目缺 duty");
    if (typeof entry?.note !== "string" || entry.note.trim() === "") violations.push(`${duty}: 缺裁定依据（note）`);
    if (!Array.isArray(entry?.posts) || entry.posts.length === 0) {
      violations.push(`${duty}: 缺归属岗位`);
      continue;
    }
    for (const slug of entry.posts) {
      const card = roleCardBySlug(slug, cards);
      if (card === null) {
        violations.push(`${duty}: 归属岗位 ${slug} 不在册`);
        continue;
      }
      if (!renderPostPromptSegment(card).includes(entry.mention)) {
        violations.push(`${duty}: 归属岗位 ${slug} 的卡面未含口径串「${entry.mention}」`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/** 校验第 8 字段的面 id 引用（「不重复坐标」⇒ 引 id 而不抄坐标，但 id 必须真的在册）：
 * 面 id 须能在宿主适配面登记表解析到、不得引 C 类非宿主面（本仓自有面形状由本仓版本
 * 控制，不属宿主更迭敏感性）、同一卡内不得重复。
 */
export function validateHostFaceRefs(cards = ROLE_CARDS, faces = HOST_FACES) {
  const violations = [];
  const byId = new Map(faces.map((face) => [face.id, face]));
  for (const card of cards) {
    const deps = Array.isArray(card?.hostDependency) ? card.hostDependency : [];
    const seen = new Set();
    for (const id of deps) {
      const face = byId.get(id);
      if (face === undefined) {
        violations.push(`${card?.slug}: 面 id ${id} 不在宿主适配面登记表`);
        continue;
      }
      if (face.category === "C") {
        violations.push(`${card?.slug}: ${id} 是 C 类非宿主面——本仓自有面不属更迭敏感性，不得引用`);
      }
      if (seen.has(id)) violations.push(`${card?.slug}: 面 id ${id} 重复引用`);
      seen.add(id);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * 注册表 `post` 字段（实例的 home 岗位）的规范化与校验——写入口（create／patch）共用。
 * 字段名取 `post` 而非 `role`：注册表的 `role` 是 v1 的自由文本职责描述（运行时资产、
 * 显示用），`post` 才是契约主键（slug）。
 *
 * 缺省或空串＝未绑岗位（合法：v1 形态实例与过渡期席位）；非空必须是**常设岗**的
 * 英文 slug，否则 fail closed——未知岗位落表会让岗位段静默缺失，而复核帽（V-A1.3：
 * 按需召集、注册表无常驻复核席位）也不得被绑成 home 岗位。
 */
export function normalizePostField(value) {
  if (value === undefined || value === null) return { ok: true, post: "" };
  if (typeof value !== "string") return { ok: false, post: "", error: "post 必须是字符串" };
  const post = value.trim();
  if (post === "") return { ok: true, post: "" };
  if (!isRoleSlug(post)) {
    return {
      ok: false,
      post: "",
      error: `post「${post}」不在岗位卡契约面（在册岗位：${roleSlugs().join("／")}）`
    };
  }
  if (!isStandingPost(post)) {
    return {
      ok: false,
      post: "",
      error: `post「${post}」不是常设岗，不得作为实例 home 岗位（V-A1.3：复核帽按需召集、注册表无常驻复核席位；常设岗：${STANDING_POST_SLUGS.join("／")}）`
    };
  }
  return { ok: true, post };
}

// ---------------- 构建期漂移校验的派生件（V-A4.2） ----------------
/** 渲染基准的 schema 标识（参考件换形即换号，防旧件被误读）。 */
export const ROLE_RENDER_REFERENCE_SCHEMA = "org-v2/role-card-render@1";

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** 卡哈希：slug／显示名／八字段的规范化 JSON（键序固定，数组保序）。 */
function cardDigest(card) {
  const payload = { slug: card?.slug, displayName: card?.displayName };
  for (const field of ROLE_CARD_FIELDS) payload[field] = card?.[field] ?? null;
  return sha256(JSON.stringify(payload));
}

/** 渲染产物哈希（与卡哈希分列：卡改而渲染未变、或渲染器改而卡未变，都各报各的）。 */
function renderDigest(card) {
  return sha256(renderPostPromptSegment(card));
}

/**
 * 一张卡的渲染基准条目（参考件的比对单位）。命名空间一并入基准：V-A1.2 的
 * 「改显示名不动命名空间」由此获得构建期把守（改派生规则或改 slug 即漂移），
 * 不只靠单元测试。
 */
export function renderReferenceEntry(card) {
  const rendered = renderPostPromptSegment(card);
  return {
    slug: assertSlug(card?.slug),
    cardDigest: cardDigest(card),
    renderDigest: renderDigest(card),
    renderBytes: Buffer.byteLength(rendered, "utf8"),
    toolNamespace: toolNamespace(card?.slug),
    permissionNamespace: permissionNamespace(card?.slug),
    rendered
  };
}

/**
 * 全量渲染基准（`--update` 时写入参考件）：逐卡条目＋汇总哈希。
 * 汇总哈希覆盖 schema、条目顺序、各卡的卡哈希／渲染哈希与两个命名空间，防
 * 「参考件被手改而不自知」。
 */
export function buildRenderReference(cards = ROLE_CARDS) {
  const entries = cards.map(renderReferenceEntry);
  const aggregate = sha256(
    `${ROLE_RENDER_REFERENCE_SCHEMA}\n` +
    entries.map((e) => `${e.slug}:${e.cardDigest}:${e.renderDigest}:${e.toolNamespace}:${e.permissionNamespace}`).join("\n")
  );
  return { schema: ROLE_RENDER_REFERENCE_SCHEMA, cards: entries, aggregate };
}

/** 按 slug 取卡；未知 slug 返回 null（调用方决定响亮还是降级）。 */
export function roleCardBySlug(slug, cards = ROLE_CARDS) {
  return cards.find((card) => card.slug === slug) ?? null;
}

/** slug 是否在册岗位（注册表 post 字段与命令面入口的机械判据）。 */
export function isRoleSlug(value, cards = ROLE_CARDS) {
  return typeof value === "string" && roleCardBySlug(value, cards) !== null;
}

/**
 * 可作实例 **home 岗位** 的常设岗（＝四类常设角色类别；V-A1.3：复核者按需召集、
 * 注册表无常驻复核席位，故 `verifier` 有卡面但不入常驻编制）。注册表 `post` 字段
 * 以此为准 fail closed。
 */
export const STANDING_POST_SLUGS = ["duty-coordinator", "project-lead", "researcher", "implementer"];

/** 该 slug 是否可作 home 岗位（常设岗）。 */
export function isStandingPost(slug) {
  return STANDING_POST_SLUGS.includes(slug);
}

// ---------------- 起步编制（bootstrap 锚点席位与双席，13 号票） ----------------

/**
 * bootstrap 锚点席位＝注册表**整表空**时由 host 代码自动建立、且**不可删除**的
 * 那个席位（组织的自举起点，词条见 `CONTEXT.md`）。它的身份＝`bootstrapAnchor`
 * 标记（**席位标记，不是岗位特权**：用户自建的同岗席位不获不可删保护），
 * 保护判定见 `lib/index.js` 的 `remove`／`patch`；home 岗位＝本常量（值班统筹）。
 */
export const BOOTSTRAP_ANCHOR_POST = "duty-coordinator";

/**
 * 最小起步编制＝**双席**（规格 §I：值班统筹＋实施者）。就绪与否只看这两席是否
 * 在场（判「编制齐备」，不含门／探针／smoke 的验收语义）；其余岗位按需拉起，
 * **不抬升起步编制门槛**（验收实验按需扩编同此）。
 */
export const MINIMAL_ROSTER_POSTS = Object.freeze([BOOTSTRAP_ANCHOR_POST, "implementer"]);

/** 按需拉起岗（不进起步编制）：目标到达需编组时拉项目经理，调研时拉研究员。 */
export const ON_DEMAND_POSTS = Object.freeze(["project-lead", "researcher"]);

/** 注册表记录是否＝bootstrap 锚点席位（按席位标记判定，不按席位名／实例 id 字符串）。 */
export function isBootstrapAnchorSeat(bot) {
  return bot?.bootstrapAnchor === true;
}

/**
 * 编制状态（纯函数，读注册表快照）——两个可判定位＋两列实况：
 *   - `anchorPresent`＝**bootstrap 锚点席位**在场，按**席位标记**判定（与
 *     `remove`／`patch` 的保护判据同一口径：用户自建的同岗席位不是锚点席位）；
 *   - `minimalComplete`＝锚点席位在场 **且** 起步岗位无缺口（双席起步编制的齐备位）；
 *   - `missing`＝起步岗位缺口（**只有岗位绑定**——用户自建席位绑上锚点岗位也算补位，
 *     它不因此取得不可删保护）；
 *   - `onDemandPresent`＝按需岗实况（**不参与**齐备判定）。
 * 岗位按 `normalizePostField` 归一（trim；未绑/非法＝不计入）。
 */
export function minimalRosterState(registry) {
  const seats = Object.values(registry ?? {});
  const posts = new Set(seats.map((bot) => normalizePostField(bot?.post).post));
  const missing = MINIMAL_ROSTER_POSTS.filter((post) => !posts.has(post));
  const anchorPresent = seats.some(isBootstrapAnchorSeat);
  return {
    anchorPresent,
    minimalComplete: anchorPresent && missing.length === 0,
    missing,
    onDemandPresent: ON_DEMAND_POSTS.filter((post) => posts.has(post))
  };
}

/**
 * 岗位卡机械校验（V-A1.1 的执行坐标）：八字段齐备、字符串字段非空、
 * 「放大机制」非空、slug 形状合法且唯一、显示名非空、第 7 字段留空（用户域）、
 * 第 8 字段为面 id 数组。
 */
export function validateRoleCards(cards = ROLE_CARDS) {
  const violations = [];
  const slugs = new Set();
  for (const card of cards) {
    const at = typeof card?.slug === "string" && card.slug.trim() !== "" ? card.slug : "(缺 slug)";
    if (typeof card?.slug !== "string" || !/^[a-z][a-z0-9-]*$/.test(card.slug)) {
      violations.push(`${at}: slug 必须是英文契约主键（^[a-z][a-z0-9-]*$）`);
    }
    if (slugs.has(card?.slug)) violations.push(`${at}: slug 重复`);
    slugs.add(card?.slug);
    if (typeof card?.displayName !== "string" || card.displayName.trim() === "") {
      violations.push(`${at}: 缺显示名`);
    }
    for (const field of ROLE_CARD_FIELDS) {
      if (!(field in (card ?? {}))) {
        violations.push(`${at}: 缺字段 ${field}（${ROLE_CARD_FIELD_LABELS[field]}）`);
        continue;
      }
      const value = card[field];
      if (field === "modelTier") {
        if (value !== "") violations.push(`${at}: 模型档位属用户域，契约面必须留空`);
        continue;
      }
      if (field === "hostDependency") {
        if (!Array.isArray(value) || value.length === 0) {
          violations.push(`${at}: hostDependency 必须是非空面 id 数组`);
        }
        continue;
      }
      if (typeof value !== "string" || value.trim() === "") {
        violations.push(`${at}: ${field}（${ROLE_CARD_FIELD_LABELS[field]}）不得为空`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}
