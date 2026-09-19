/**
 * 记忆与知识层策略（org-v2 10 号票；规格 §G 与附录 A `V-A7.6`–`V-A7.10`）。
 *
 * 本模块＝记忆侧的**策略纯函数面**：不写盘、不触 `~/.dsh`，只回答「这条内容
 * 该进哪一面」「这份产出够不够格晋升」「两个源冲突听谁的」「移交件该长什么样」。
 * 落盘与既有知识库容器协议归 `lib/knowledge.js`（v1 MVP 核心，本票不动其
 * 形状）；「共享面零直写」的物理守卫归 `lib/org/knowledge-shared-face.js`。
 *
 * 三层定形（§G）：岗位私有＝实例 workspace 自由笔记（唯一合法直写区，无
 * schema、无专用工具；L1 面见 `lib/org/permissions.js` `isBotWritablePath`）；
 * **团队共享不设独立第三面**——任务事实走台账、可复用结论走知识库；组织常量
 * （岗位卡／评测集／例程登记项）＝配置面，不算运行时记忆。
 *
 * 分流三问（`V-A7.6`）：
 *   ① 本任务历史事实 → 台账事件；
 *   ② 换一个不同任务仍成立 → 知识库；
 *   ③ 中间产物 → taskId 键工件存档。
 * **推理过程任何面都不进**——优先级高于三条（推理轨迹既不是任务历史、
 * 也不能算可复用结论；把推理过程当结论沉淀＝污染知识库的换模型试金石）。
 * 优先级为 Q①→Q② 的固定顺序：同一条内容既属本任务历史又看似可复用时，
 * 事实面归台账，可复用结论另走晋升（§G「谁产出谁登记」），不靠一条内容
 * 兼两职来绕过留痕。
 *
 * 晋升门槛三条（`V-A7.7`）：过换模型试金石／可独立成立（不读原任务轨迹即可
 * 用）／留痕（复用、取代登记照用）。**门槛缺省＝不过**（未评估不得静默放行）；
 * 强制性**全局不设**，由派单方在简报输出格式里预声明——预声明的结构形态是
 * 简报可选键 `promotion`（见 `./brief.js` 的 `promotion` 键校验）。
 *
 * **原语单源（02 纪律）**：形状判定取 `./capability-base.js` 的 `isPlainObject`
 * （带原型校验，较手写 `typeof === "object"` 收紧——本模块输入皆具名布尔量对象，
 * 等价域内）与 `./is-non-empty-string.js` 的 `isNonEmptyString`，本模块不自留副本。
 *
 * **生产消费者留界**：本模块五个导出均为**策略纯函数**（规格 §G 的「三问可判／
 * 门槛可查／裁决有据／移交有形」），消费面随召集体落地——`routeContent`／
 * `evaluatePromotion` 的调用点在任务关闭与归档流程（16 号票切换批之后的常驻
 * 编制），`buildHandoff` 的取件面随 14 号票闭环移交接线。在此之前验收依靠
 * `tests/org-memory-layer.test.mjs` 的机械断言（与 `task-ledger.recordPreScreen`
 * 「生产触发面随 13/14 召集接线」同口径留界）。
 */
import { isPlainObject } from "./capability-base.js";
import { isNonEmptyString } from "./is-non-empty-string.js";

/** 三面值域（封闭枚举；共享侧无第三面——新面即规格修订）。 */
export const MEMORY_ROUTES = Object.freeze(["ledger", "knowledge", "artifact"]);

/** 晋升门槛 id（封闭枚举，与 §G 三条一一对应）。 */
export const PROMOTION_GATES = Object.freeze(["model-swap-test", "self-contained", "traced"]);

/** 门槛 id → 判定输入键（单源映射，避免两处各写一份字段名）。 */
const GATE_INPUT_KEYS = Object.freeze({
  "model-swap-test": "modelSwapTest",
  "self-contained": "selfContained",
  "traced": "traced"
});

/** 门槛 id → 人读名（理由文案单源）。 */
const GATE_LABELS = Object.freeze({
  "model-swap-test": "过换模型试金石",
  "self-contained": "可独立成立（不读原任务轨迹即可用）",
  "traced": "留痕（复用/取代登记照用）"
});

/** 分流/门槛输入的形状守卫：非对象一律抛（fail closed，不静默路由）。
 *  判定取 capability-base 的 isPlainObject（原型校验口径与简报契约同源）。 */
function assertPlainInput(value, label) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${label}须为对象（记忆层策略输入为具名布尔量，不接受 ${String(value)}）`);
  }
}

/**
 * 写入分流三问（`V-A7.6`）。输入＝内容性质判定的布尔量（由产出方按三问自答，
 * 本函数只做**确定性路由**与优先级收口）：
 *   - `isReasoning`：是否推理过程（**最高优先级**：命中即 route=null）；
 *   - `isTaskHistory`：是否本任务历史事实 → `ledger`；
 *   - `holdsAcrossTasks`：换一个不同任务是否仍成立 → `knowledge`；
 *   - `isIntermediateArtifact`：是否中间产物 → `artifact`（须带 `taskId` 键）。
 *
 * 返回 `{route, reason, taskId?, needs?}`。`route === null` 有两种合法形态：
 * 推理过程（任何面都不进）与「无承载面」（内容不属三面之一）。二者以 `reason`
 * 区分，不以 route 区分——调用方不得把 null 一律当「丢弃」。
 */
export function routeContent(input) {
  assertPlainInput(input, "分流输入");
  const { isReasoning, isTaskHistory, holdsAcrossTasks, isIntermediateArtifact, taskId } = input;

  if (isReasoning === true) {
    return { route: null, reason: "推理过程不进任何面（推理轨迹不属三面之一，沉淀必污染知识库试金石）" };
  }
  if (isTaskHistory === true) {
    return { route: "ledger", reason: "本任务历史事实 → 台账事件（Q①：任务身份与过程的唯一权威面）" };
  }
  if (holdsAcrossTasks === true) {
    return { route: "knowledge", reason: "换一个不同任务仍成立 → 知识库（Q②：可复用结论）" };
  }
  if (isIntermediateArtifact === true) {
    if (typeof taskId !== "string" || taskId.trim() === "") {
      return { route: null, needs: "taskId", reason: "中间产物以 taskId 为键存档（Q③）；未给 taskId 无法路由" };
    }
    return { route: "artifact", taskId, reason: "中间产物 → taskId 键工件存档（Q③：归档不删档）" };
  }
  return { route: null, reason: "不属三问任一承载面：不进任何持久面" };
}

/**
 * 晋升门槛三条（`V-A7.7`）。输入＝三条门槛的评估结论（布尔量）；
 * **缺省＝不过**（未评估不得静默放行）。返回 `{ok, failed[], reason}`——
 * `failed` 为未过门槛 id 列表（可查、可归因）。
 */
export function evaluatePromotion(input) {
  assertPlainInput(input, "晋升门槛输入");
  const failed = PROMOTION_GATES.filter((gate) => input[GATE_INPUT_KEYS[gate]] !== true);
  if (failed.length === 0) {
    return { ok: true, failed: [], reason: "晋升门槛三条齐备（过换模型试金石／可独立成立／留痕）" };
  }
  return {
    ok: false,
    failed,
    // 理由同时点名门槛 id（机读）与人读名——「可查」须让两种读者都能归因
    reason: `晋升门槛未过（${String(failed.length)} 条）：` +
      failed.map((gate) => `${gate}（${GATE_LABELS[gate]}）`).join("；")
  };
}

/**
 * 读简报的晋升强制性预声明（`V-A7.7`「强制性由派单方在简报输出格式里预声明」）。
 * 返回 `{required, declared}`——**区分「未声明」与「明示不强制」**：
 *   - 缺 `promotion` 键／畸形预声明 → `{required:false, declared:false}`（保守取
 *     未声明；畸形件本应在冻结期被 `validateBrief` 拦下，此处不抛以免读面把
 *     校验责任揽到自己身上）；
 *   - `{required:true}` → `{required:true, declared:true}`；
 *   - `{required:false}` → `{required:false, declared:true}`。
 * 强制性**不代偿门槛**：`required:true` 只表达派单方要求，内容质量仍由
 * `evaluatePromotion` 独立判定（「登记不构成任务完成依据」）。
 */
export function promotionRequired(brief) {
  const declared = isPlainObject(brief) && isPlainObject(brief.promotion)
    && typeof brief.promotion.required === "boolean";
  if (!declared) return { required: false, declared: false };
  return { required: brief.promotion.required === true, declared: true };
}

/**
 * 知识失效动作值域（**封闭枚举，恰两项**；`V-A7.8`「唯一机制＝显式取代/废弃
 * 登记」）。值域之外一律拒——`expire`／`ttl`／`delete`／`purge`／`score`／
 * `hot` 这类自动失效与访问热字段形态**不是「暂未实现」而是被规格否决**，
 * 故走拒而非缺省。
 */
export const INVALIDATION_ACTIONS = Object.freeze(["supersede", "deprecate"]);

/** 失效补丁允许的键（封闭；`V-A7.8` 无访问热字段——计数字段在形状上就进不来）。 */
const INVALIDATION_PATCH_KEYS = Object.freeze(["id", "status", "supersededBy"]);

/**
 * 失效登记（`V-A7.8`）。产出**append 语义**的索引补丁：只翻状态与写指针，
 * 不物理删除、旧痕迹保留（旧条目连同 `supersededBy` 一并留在 `index.jsonl`，
 * 由 `lib/knowledge.js registerReport` 落到旧条目上）。
 *
 * 三条反机制保证（测试逐条锁定）：
 *   1. **时间无关**——函数不看当前时刻，也不接受 `now`／`expiresAt`／`ttlDays`
 *      类输入（夹带也不改变输出）：无 TTL、无到期自动动作；
 *   2. **无热字段**——补丁键封闭在 `INVALIDATION_PATCH_KEYS` 内，`accessCount`／
 *      `hitCount`／`lastAccessedAt`／`score` 等一律不进补丁；
 *   3. **不删档**——补丁里没有删除语义，调用方无法经本函数表达「抹掉旧条目」。
 *
 * 返回 `{ok, patch?, violations[]}`（形状与 `validateBrief` 同源：违例列表＋
 * 成败标志，不抛业务错误）。
 */
export function planInvalidation(input) {
  assertPlainInput(input, "失效登记输入");
  const violations = [];
  const action = input.action;
  if (!INVALIDATION_ACTIONS.includes(action)) {
    violations.push(
      `动作「${String(action)}」不在失效值域（${INVALIDATION_ACTIONS.join("｜")}）` +
      `——台账 append-only 永不失效；知识库唯一机制＝显式取代/废弃登记` +
      `（不做自动失效、不做自动打分、不做访问热字段）`
    );
    return { ok: false, violations };
  }
  const targetId = input.targetId;
  if (!isNonEmptyString(targetId)) violations.push("targetId（被失效条目 id）须为非空字符串");

  let successorId = null;
  if (action === "supersede") {
    successorId = input.successorId;
    if (!isNonEmptyString(successorId)) violations.push("action=supersede 须给 successorId（后继条目 id；取代必有收口对象）");
  }
  if (violations.length > 0) return { ok: false, violations };

  // 补丁按封闭键序构造——输入里的任何额外字段（含热字段/到期字段）在此被丢弃，
  // 不是「忽略」而是形状上不可达
  const patch = { id: targetId.trim(), status: action === "supersede" ? "updated" : "deprecated" };
  if (successorId !== null) patch.supersededBy = successorId.trim();
  const keys = Object.keys(patch);
  for (const key of keys) {
    if (!INVALIDATION_PATCH_KEYS.includes(key)) violations.push(`补丁含未定义键 ${key}`);
    if (key.startsWith("__")) violations.push(`补丁含保留键 ${key}`);
  }
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, patch, violations: [] };
}

/**
 * 裁决面词表（封闭枚举；`V-A7.9`）：**只有三个面**，其两两冲突中规格只定义了
 * **两对**——知识与台账（台账胜）、知识与岗位卡（岗位卡胜）。
 *
 * **不发明规格**（复审 2026-09-19）：`{ledger, role-card}` 这一对§G 未定义优先级
 * （台账是运行时事实面、岗位卡是配置面，谁胜属组织设计决定），故本模块**不做
 * 传递闭包、不自定序**——遇到未定义对即 `spec-undefined-conflict` fail closed，
 * 由用户裁定或规格修订收口。三面同冲因含该对，同样落此判（不静默择一）。
 */
export const CONFLICT_FACES = Object.freeze(["role-card", "ledger", "knowledge"]);

/** 规格已定义的冲突对（无序对，键为排序后拼接）：败方 → 胜方。 */
const DEFINED_CONFLICTS = Object.freeze([
  { pair: ["knowledge", "ledger"], winner: "ledger", ground: "§G「知识与台账冲突台账胜」" },
  { pair: ["knowledge", "role-card"], winner: "role-card", ground: "§G「知识与岗位卡冲突岗位卡胜」" }
]);

/**
 * 冲突裁决（`V-A7.9`）。输入＝冲突面名集合（≥2 个互异面，取自 `CONFLICT_FACES`）。
 * 返回 `{ok, winner, losers[], requiresInvalidation, reason, violations[]}`。
 *
 * **只裁规格定义过的两对**（`DEFINED_CONFLICTS`）：集合里出现未定义对
 * （`{ledger, role-card}`，含三面同冲）即判违例 `spec-undefined-conflict`——
 * 不发明优先级，交用户裁定／规格修订。
 *
 * **须取代收口**：败方含知识面（`knowledge`）时 `requiresInvalidation: true`
 * ——§G「冲突条目须取代收口」，知识条目是唯一有失效机制可走的条目面（走
 * `planInvalidation` 的 `supersede`／`deprecate`；台账 append-only 无失效概念，
 * 岗位卡属配置面、改卡即改配置不属运行时失效）。
 *
 * 不是冲突的输入（单面／空集／同面重复）一律判违例而非返回胜方——「自比」
 * 不是冲突，把它当冲突会凭空制造收口动作。
 */
export function resolveConflict(input) {
  assertPlainInput(input, "裁决输入");
  const faces = input.faces;
  if (!Array.isArray(faces)) throw new TypeError("裁决输入的 faces 须为数组（冲突面名集合）");
  const violations = [];
  const unknown = faces.filter((face) => !CONFLICT_FACES.includes(face));
  for (const face of unknown) {
    violations.push(`面名「${String(face)}」不在裁决面词表（${CONFLICT_FACES.join("、")}）`);
  }
  if (unknown.length === 0) {
    const unique = [...new Set(faces)];
    if (unique.length < 2) {
      violations.push(`冲突面须为 ≥2 个互异面（收到 ${String(faces.length)} 项／去重后 ${String(unique.length)} 项；自比不是冲突）`);
    } else {
      // 逐对检查：集合里的**每一对**都须落在规格定义内。三面同冲含
      // ledger×role-card，故同落此判（不静默择一）。
      const undefinedPairs = [];
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const pair = [unique[i], unique[j]].sort();
          const defined = DEFINED_CONFLICTS.some(
            (entry) => [...entry.pair].sort().join("|") === pair.join("|")
          );
          if (!defined) undefinedPairs.push(pair.join("×"));
        }
      }
      if (undefinedPairs.length > 0) {
        violations.push(
          `spec-undefined-conflict：冲突对 ${undefinedPairs.join("、")} 的优先级§G 未定义` +
          `（规格只定义知识与台账、知识与岗位卡两对）——须用户裁定或规格修订，本模块不发明序`
        );
      }
    }
  }
  if (violations.length > 0) {
    return { ok: false, winner: null, losers: [], requiresInvalidation: false, violations };
  }

  // 全对已定义 ⇒ 集合必为 {knowledge, X} 之一；胜方即该对定义的胜者
  const winner = DEFINED_CONFLICTS
    .find((entry) => entry.pair.every((face) => faces.includes(face)));
  const losers = [...new Set(faces)].filter((face) => face !== winner.winner);
  const winnerLabel = winner.winner === "role-card" ? "岗位卡胜" : "台账胜";
  return {
    ok: true,
    winner: winner.winner,
    losers,
    requiresInvalidation: losers.includes("knowledge"),
    reason: `冲突裁决：${winnerLabel}（${winner.ground}）` +
      `；败方 ${losers.join("、")}` +
      (losers.includes("knowledge") ? "——知识条目须取代收口（走显式取代/废弃登记）" : "——败方非知识面，无知识侧收口动作"),
    violations: []
  };
}

/**
 * 移交件（`V-A7.10`）：**只传指针、不复制内容**，接手方**拉取式自取**。
 *
 * 三件指针（§G「只传指针（任务 id＋工件坐标＋知识条目 id）」）：
 *   - `taskId`＝指针根（无根不成移交）；
 *   - `artifacts[]`＝工件坐标条目，**键封闭为 `{location}`**——与四要素简报的
 *     坐标条目同纪律（`lib/org/brief.js`：只给坐标不给转述），夹带
 *     `body`／`content`／`excerpt`／`summary`／`text` 即拒；
 *   - `knowledgeIds[]`＝知识条目 id 字符串数组（内联摘要对象即拒）。
 *
 * 两条反机制保证：
 *   1. **不复制内容**——坐标条目不得携带正文（正文由接手方按坐标自取）；
 *   2. **归档不删档、无保留期上限**——`retention`／`retentionDays`／
 *      `expiresAt`／`ttlDays`／`deleteAfter` 类字段一律拒（保留期上限在形状上
 *      不可表达，不是「默认无限」的软约定）。
 *
 * `mode` 恒为 `"pull"`：移交件是**取件凭据**而非内容包裹。返回
 * `{ok, mode, pointers?, violations[]}`。
 *
 * **取件面留界**：本函数产出凭据形状；接手方的实际取件（按坐标拉工件、按
 * knowledge 读面拉条目）走既有读面（`lib/org/review-kit.js reviewHandoff` 为
 * 复核专用移交件，与本函数分工不同：那是 §C 复核独立件）。跨实例提交链的
 * 接线随 14 号票闭环移交落地。
 */
export function buildHandoff(input) {
  assertPlainInput(input, "移交件输入");
  const violations = [];
  const taskId = input.taskId;
  if (!isNonEmptyString(taskId)) violations.push("taskId（指针根）须为非空字符串");

  const artifacts = input.artifacts === undefined ? [] : input.artifacts;
  const artifactLocations = [];
  if (!Array.isArray(artifacts)) {
    violations.push("artifacts 须为坐标条目数组（可为空数组）");
  } else {
    artifacts.forEach((entry, index) => {
      const at = `artifacts[${String(index)}]`;
      if (!isPlainObject(entry)) {
        violations.push(`${at} 须为对象`);
        return;
      }
      for (const key of Object.keys(entry)) {
        if (key !== "location") {
          violations.push(`${at} 含未定义键 ${key}（坐标条目键封闭为 location：只给坐标不给转述，且无保留期字段位）`);
        }
      }
      if (!isNonEmptyString(entry.location)) violations.push(`${at}.location 须为非空字符串`);
      else artifactLocations.push(entry.location.trim());
    });
  }

  const knowledgeIds = input.knowledgeIds === undefined ? [] : input.knowledgeIds;
  const ids = [];
  if (!Array.isArray(knowledgeIds)) {
    violations.push("knowledgeIds 须为知识条目 id 数组（可为空数组）");
  } else {
    knowledgeIds.forEach((value, index) => {
      if (!isNonEmptyString(value)) {
        violations.push(`knowledgeIds[${String(index)}] 须为非空字符串 id（只给 id，不内联摘要/结论）`);
      } else {
        ids.push(value.trim());
      }
    });
  }

  if (violations.length > 0) return { ok: false, mode: "pull", violations };
  return {
    ok: true,
    mode: "pull",
    pointers: { taskId: taskId.trim(), artifacts: artifactLocations, knowledgeIds: ids },
    violations: []
  };
}

/**
 * 组织常量面坐标（`V-A7.5` 第三分句「组织常量＝配置面，不算运行时记忆」的机械
 * 落点）。每条＝一类组织常量 → 其**配置面**归属模块与点名导出（测试逐个解析，
 * 防坐标漂移成空指针）。
 *
 * 未落地者进 `pending`（**不虚构坐标**）：岗位评测集属 §H 升级例程的评测面，
 * 归 12 号票（`V-A7.4` 每岗至少一可执行评测项），在其落地前本表不预留空槽。
 *
 * 运行时记忆面（知识库根／台账）**不得**出现在本表——「配置面 vs 运行时面」的
 * 边界由 `lib/org/knowledge-shared-face.js knowledgeFaceShape` 与台账读侧分别把守。
 */
export const ORG_CONSTANT_FACE = Object.freeze({
  entries: Object.freeze([
    Object.freeze({ kind: "岗位卡", face: "config", module: "lib/org/role-cards.js", exports: Object.freeze(["ROLE_CARDS", "ROLE_CARD_FIELDS"]) }),
    Object.freeze({ kind: "例程登记项", face: "config", module: "lib/org/dispatch-config.js", exports: Object.freeze(["ROUTINE_REGISTRY", "INTAKE_RULES"]) })
  ]),
  pending: Object.freeze([
    Object.freeze({ kind: "评测集", ticket: "12", note: "岗位评测集＝组织常量（§H／V-A7.4：每岗至少一可执行评测项），随 12 号票落地" })
  ])
});

/** 组织常量面坐标（只读副本，防调用方就地改写常量表）。 */
export function orgConstantFace() {
  return {
    entries: ORG_CONSTANT_FACE.entries.map((entry) => ({ ...entry, exports: [...entry.exports] })),
    pending: ORG_CONSTANT_FACE.pending.map((entry) => ({ ...entry }))
  };
}

// ---------- 运行 ----------
