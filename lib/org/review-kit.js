/**
 * 复核件套（org-v2 08 号票；规格 §C、附录 A `V-A2.7`／`V-A1.3`，GLOSSARY.md
 * 「独立复核」「复核点」词条）。
 *
 * 形态＝「**必审清单＋判据＋gaps 报告＋修复回合＋上浮**」一件套，**无 stage
 * 机**。本模块是件套的纯机械面：枚举、形状、状态折叠、帽选择、移交件与复核面
 * gate；事实落盘在台账（`lib/org/task-ledger.js` 的 `review-requested`／
 * `review-reported` 事件与 `task.deliver` 拦截），本模块不持有任何状态。
 *
 * - **必审清单**＝三条客观判据的封闭枚举（`REVIEW_BOUNDARIES`）：命中即强制，
 *   可加审不可免审（加审须留归因；强制点的降级请求在台账命令面直接拒绝）。
 * - **报告形状**固定为「gaps＋严重度＋证据坐标」，另报判据缺口、记录模型身份；
 *   顶层键封闭——报告不得携带改工件／改判据字段（复核者只读的形状层，唯一可写
 *   产物就是这份追加式报告）。
 * - **独立性**：复核者读不到产出方推理轨迹——移交件（`reviewHandoff`）只含冻结
 *   简报＋复核史，judgement 类事件机械排除；帽选择排除产出方，16 号票的
 *   review-session 另建不继承历史的原生会话。报告须记录模型身份。
 * - **复核帽**＝契约帽子：当次空闲实例佩戴（`selectReviewer`——台账无进行中
 *   租约）、排除本任务产出方、无常驻席位（注册表腿：verifier 不在
 *   STANDING_POST_SLUGS，归 role-cards 测试模块把守）。
 */
import { isNonEmptyString } from "./is-non-empty-string.js";
import { isPlainObject } from "./capability-base.js";

/** 必审清单（封闭枚举；三条客观判据＝三个边界事件，复核点在边界跨越之前）。 */
export const REVIEW_BOUNDARIES = Object.freeze([
  {
    id: "before-irreversible-write",
    criterion: "不可逆：写入真实运行面／冻结面、不可回滚的覆盖或删除"
  },
  {
    id: "before-external-visibility",
    criterion: "对外可见：交付用户、跨组织提交、外部 API 写入"
  },
  {
    id: "before-cross-instance-handoff",
    criterion: "跨实例移交的关键产出：下游任务输入工件、判据工件、组织常量变更"
  }
]);

/** 边界 id 集（简报 reviewPoints 与复核请求的取值域）。 */
export const REVIEW_BOUNDARY_IDS = Object.freeze(REVIEW_BOUNDARIES.map((boundary) => boundary.id));

/** gap 严重度取值域（封闭枚举）。 */
export const GAP_SEVERITIES = Object.freeze(["blocker", "major", "minor"]);

/** 报告结论取值域：gaps-open＝有未闭合缺口；closed＝判据全过、无缺口。 */
export const REVIEW_VERDICTS = Object.freeze(["gaps-open", "closed"]);

/**
 * 「连续两轮未闭合即上浮」的轮数阈值（**单一源**：台账 `recordReviewReport` 的
 * claim 侧与人间接口 `preScreenEscalation` 的初审判定都读它——阈值不得两处各写一份）。
 */
export const UNCLOSED_ROUNDS_TO_ESCALATE = 2;

export const REPORT_KEYS = Object.freeze(["subject", "verdict", "gaps", "criteriaGaps", "modelIdentity"]);
const GAP_KEYS = Object.freeze(["severity", "summary", "evidence"]);

/**
 * 复核报告形状校验（纯函数）。报告是复核者唯一可写产物：顶层键封闭（改工件／
 * 改判据类字段无处安放）、gap 条目键封闭、严重度与结论取值封闭、verdict 与
 * gaps 一致（closed 不得带 gaps、gaps-open 不得空列表）、模型身份必填。
 */
export function validateReviewReport(report) {
  const violations = [];
  if (!isPlainObject(report)) {
    return { ok: false, violations: ["复核报告须为对象（固定形状）"] };
  }
  for (const key of Object.keys(report)) {
    if (!REPORT_KEYS.includes(key)) violations.push(`报告含未定义键 ${key}（复核者只读：报告不携带改工件／改判据字段）`);
  }
  if (!isNonEmptyString(report.subject)) violations.push("subject（复核对象：边界 id 或咨询主题）须为非空字符串");
  if (!REVIEW_VERDICTS.includes(report.verdict)) {
    violations.push(`verdict 须为 ${REVIEW_VERDICTS.join("|")} 之一：${String(report.verdict)}`);
  }
  if (!Array.isArray(report.gaps)) {
    violations.push("gaps 须为数组（可为空数组）");
  } else {
    report.gaps.forEach((gap, index) => {
      const at = `gaps[${String(index)}]`;
      if (!isPlainObject(gap)) {
        violations.push(`${at} 须为 {severity, summary, evidence} 对象`);
        return;
      }
      for (const key of Object.keys(gap)) {
        if (!GAP_KEYS.includes(key)) violations.push(`${at} 含未定义键 ${key}（条目键封闭：${GAP_KEYS.join("/")}）`);
      }
      if (!GAP_SEVERITIES.includes(gap.severity)) violations.push(`${at}.severity 须为 ${GAP_SEVERITIES.join("|")} 之一`);
      if (!isNonEmptyString(gap.summary)) violations.push(`${at}.summary 须为非空字符串`);
      if (!isNonEmptyString(gap.evidence)) violations.push(`${at}.evidence（证据坐标）须为非空字符串`);
    });
  }
  if (report.verdict === "closed" && Array.isArray(report.gaps) && report.gaps.length > 0) {
    violations.push("verdict=closed 不得携带 gaps（结论与列表一致）");
  }
  if (report.verdict === "gaps-open" && Array.isArray(report.gaps) && report.gaps.length === 0) {
    violations.push("verdict=gaps-open 须至少携带一条 gap（结论与列表一致）");
  }
  if (report.criteriaGaps !== undefined) {
    if (!Array.isArray(report.criteriaGaps) || report.criteriaGaps.some((entry) => !isNonEmptyString(entry))) {
      violations.push("criteriaGaps（判据缺口）须为非空字符串数组（可为空数组）");
    }
  }
  if (!isNonEmptyString(report.modelIdentity)) violations.push("modelIdentity（模型身份）须为非空字符串");
  return { ok: violations.length === 0, violations };
}

// ---------------- 状态折叠（无 stage 机：复核状态＝事件折叠的投影） ----------------

/**
 * 复核状态查询域（23 号票②）：`{brief, events, taskId}` 三件套在复核状态各查询
 * （collectReviewState／openMandatorySubjects／human-inbox `preScreenBoundary`）的
 * 共同入参形状——事件与简报在调用方一次读定后捆装传递，不再逐处散拼三键。
 * 各查询函数照旧直接接受三键字面量（既有调用与断言面不动）。
 */

/** 复核状态查询域：冻结简报＋本任务事件＋任务 id 的具名捆装（三键透传）。 */
export function reviewScope({ brief, events, taskId } = {}) {
  return { brief, events, taskId };
}

/** 台账任务投影 → 查询域（brief 取投影冻结件、taskId 取投影 id）。 */
export function taskReviewScope(task, events) {
  return { brief: task?.brief ?? null, events: events ?? [], taskId: task?.taskId };
}

/**
 * 复核事实事件分派表（23 号票①：collectReviewState 与 reviewHandoff 对同一事件
 * 类型的 if 级联同型重复——subject 提取收拢为单一源，防两处口径漂移）。事件只经
 * 台账命令面产生（point/topic 二选一、subject 必填在写路径已把守）。
 */
const REVIEW_EVENT_DISPATCH = Object.freeze({
  "review-requested": (event) => event.point ?? event.topic,
  "review-reported": (event) => event.subject
});

/**
 * 本任务复核事实事件的共享单遍遍历：taskId 过滤 → 类型分派 → subject 守卫，然后
 * 访问者按事件类型各自续处理。两种消费（折叠 vs 移交件行）共用同一条遍历。
 */
function eachReviewEvent(events, taskId, visit) {
  for (const event of events ?? []) {
    if (taskId !== undefined && event?.taskId !== taskId) continue;
    const subjectOf = REVIEW_EVENT_DISPATCH[event?.type];
    if (subjectOf === undefined) continue;
    const subject = subjectOf(event);
    if (!isNonEmptyString(subject)) continue;
    visit(event, subject);
  }
}

function emptySubject(key) {
  return {
    subject: key,
    mandatory: false,
    reviewer: null,
    rounds: 0,
    consecutiveUnclosed: 0,
    closed: false,
    reports: [],
    requests: 0
  };
}

/**
 * 复核状态折叠（纯函数）。输入＝冻结简报＋本任务事件序列；输出＝逐 subject
 * （边界 id 或咨询主题）的 `{mandatory, reviewer, rounds, consecutiveUnclosed,
 * closed, reports, requests}` 表。必审集＝`brief.reviewPoints`（派出即冻结，
 * 无需请求事件）∪ 强制请求的 point——**命中即强制**的机械口径；咨询性请求
 * （topic）不入必审集、永不阻断。`consecutiveUnclosed`＝trailing 连续
 * gaps-open 报告数（「连续两轮未闭合」的计数原语）；`closed`＝最近一次报告
 * 为 closed。
 */
export function collectReviewState({ brief, events, taskId } = {}) {
  const subjects = new Map();
  function subjectFor(key) {
    let entry = subjects.get(key);
    if (entry === undefined) {
      entry = emptySubject(key);
      subjects.set(key, entry);
    }
    return entry;
  }
  const briefPoints = Array.isArray(brief?.reviewPoints) ? brief.reviewPoints : [];
  for (const point of briefPoints) {
    subjectFor(point).mandatory = true;
  }
  eachReviewEvent(events, taskId, (event, key) => {
    const entry = subjectFor(key);
    if (event.type === "review-requested") {
      entry.requests += 1;
      if (event.mandatory === true) entry.mandatory = true;
      if (isNonEmptyString(event.reviewer)) entry.reviewer = event.reviewer;
      return;
    }
    // review-reported：报告史追加＋trailing 连续未闭合计数
    entry.reports.push({
      verdict: event.verdict,
      gaps: event.gaps ?? [],
      criteriaGaps: event.criteriaGaps ?? [],
      modelIdentity: event.modelIdentity ?? null,
      reviewer: event.reviewer ?? null,
      seq: event.seq,
      at: event.at
    });
    entry.rounds += 1;
    if (event.verdict === "gaps-open") {
      entry.consecutiveUnclosed += 1;
      entry.closed = false;
    } else {
      entry.consecutiveUnclosed = 0;
      entry.closed = true;
    }
  });
  return { subjects };
}

/**
 * 必审开启集（`task.deliver` 拦截的判定原语，`V-A2.7`）：必审 subject 中
 * 尚未闭合（未复核或最近报告 gaps-open）者。非空即不得交付／回笼。
 */
export function openMandatorySubjects({ brief, events, taskId }) {
  const { subjects } = collectReviewState({ brief, events, taskId });
  return [...subjects.values()]
    .filter((entry) => entry.mandatory && !entry.closed)
    .map((entry) => entry.subject);
}

// ---------------- 复核帽选择（`V-A1.3` 台账查询腿） ----------------

/**
 * 复核帽选择（纯判定；候选由接线层从注册表注入）。机械口径：**当次空闲**＝台账
 * 中无进行中租约（`holdingsFor(botId)` 返回 null）；**排除本任务产出方**；其余
 * 按注册表序确定性首中。无常驻席位——选择只发生在每次召集时。无可召集者返回
 * null（调用方 fail closed，不静默指派）。注册表腿（verifier 不作 home 岗位）
 * 由 role-cards 的 STANDING_POST_SLUGS 把守。本原语供 13/16 号票的召集接线
 * 复用；台账命令面的 `reviewer-not-idle` 拒绝是同口径的**权威门**（请求落账前
 * 机械复验，不信任调用方选择）——两处口径以本文件为准。
 */
export function selectReviewer({ candidates, holdingsFor, excludeBotIds = [] } = {}) {
  if (typeof holdingsFor !== "function") throw new Error("selectReviewer 需要 holdingsFor（台账在手查询）");
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const botId = candidate?.botId;
    if (!isNonEmptyString(botId)) continue;
    if (excludeBotIds.includes(botId)) continue;
    const holding = holdingsFor(botId);
    if (holding !== null && holding !== undefined) continue;
    return { botId };
  }
  return null;
}

// ---------------- fresh-context 移交件（独立性） ----------------

/**
 * 复核移交件：复核者拿到的一切＝冻结简报（判据与坐标）＋本任务的复核请求史＋
 * 报告史。**judgement（判断输入）类事件机械排除**——「读不到产出方推理轨迹与
 * 中间过程」不是约定而是构造：本函数的输出形状里没有它们的容身之处。事件遍历
 * 与 subject 提取与 `collectReviewState` 共用同一条分派（23 号票①）；报告行按
 * seq 从折叠结果取（单次折叠＋单次遍历产出移交件）。
 */
export function reviewHandoff({ task, events, taskId } = {}) {
  const id = task?.taskId ?? taskId;
  const { subjects } = collectReviewState(reviewScope({ brief: task?.brief, events, taskId: id }));
  const requests = [];
  const reportRows = [];
  eachReviewEvent(events, id, (event, subject) => {
    if (event.type === "review-requested") {
      requests.push({
        subject,
        mandatory: event.mandatory === true,
        reviewer: event.reviewer ?? null,
        attribution: event.attribution ?? null,
        at: event.at
      });
      return;
    }
    const entry = subjects.get(subject)?.reports.find((row) => row.seq === event.seq);
    if (entry !== undefined) reportRows.push(entry);
  });
  return {
    taskId: id,
    status: task?.status ?? null,
    brief: task?.brief ?? null,
    requests,
    reports: reportRows
  };
}

// ---------------- 复核帽验签腿（单一源：通道门预筛与台账腿权威判定共用） ----------------

/**
 * 复核帽验签腿（org-v2 27 号票；规格 §C「复核者＝契约帽子」、§D L2）。
 *
 * **单一源**：通道门（预筛）与台账腿（权威门）共用同一条「什么算持帽」的口径
 * ——两处各写一份必然漂移。两段：①`issuer.verify`（信封形状／签名／身份／TTL／
 * 代际／活态／任务域，由签发验签面判定）；②帽腿＝`post` 须为 verifier 且 `op`
 * 在帽内（`V-A3.4` 否定式的正面口径：复核帽只持读类 op＋`review.report`）。
 *
 * **消费点由调用面给**（`consumeNonce`）：**通道门一律不消费**（入口预筛；读面
 * 本就重放无害）；**写面的唯一消费点在台账腿**——台账腿以 `consumeNonce:true`
 * 调用本函数即「复验＋`consumeNonceOnce` 独占消费」的同一原语。顺序纪律：
 * **帽腿判定在消费之前**——非帽信封（如误投的任务能力）不被烧，越权尝试不消耗
 * 任何人的帽。
 */
export function verifyReviewHat({ issuer, envelope, botId, taskId, op, consumeNonce = false } = {}) {
  if (!issuer || typeof issuer.verify !== "function") {
    return { ok: false, code: "review-hat-unwired", reason: "复核帽签发/验签面未接线（fail closed：无帽不得入账）" };
  }
  const verdict = issuer.verify({ envelope, botId, taskId, op, consumeNonce });
  if (!verdict.ok) return verdict;
  const payload = verdict.payload;
  if (payload?.post !== "verifier") {
    return { ok: false, code: "review-hat-required", reason: "复核面只认复核帽信封（post=verifier 的 role 能力）" };
  }
  if (!(Array.isArray(payload?.ops) && payload.ops.includes(op))) {
    return { ok: false, code: "review-hat-op-missing", reason: `帽内无 ${String(op)}` };
  }
  return { ok: true, payload };
}

// ---------------- 复核面 gate（通道入口预筛） ----------------

/**
 * 复核面 gate（07 号票留界⑥的鉴权读落点；27 号票降级为**入口预筛**）。
 *
 * 两条面：`artifact.read`（移交件读）与 `review.report`（报告提交）——三腿：
 * ①验签（签名／活态／TTL／任务域绑定由签发面判定）；②帽腿＝payload.post 须为
 * verifier 且 op 在帽内；③指定腿＝台账中存在指名该实例的复核请求（未被指定者
 * 连移交件都读不到）。
 *
 * **本门不消费 nonce**（27 号票定死的口径）：它在入口把「无帽／他人帽／非复核帽
 * ／未被指定」拒掉（HTTP 403，越权不换新信封），但**事实判定与消费点都在台账腿**
 * ——进程内直调台账门面同样过权威门，通道不是唯一的门。指定腿在此是**请求级
 * 粗腿**（移交件读只到请求粒度即够）；写面的逐 subject 指定关系由台账腿复验。
 */
export function createReviewFaceGate({ issuer, ledger } = {}) {
  if (!issuer || typeof issuer.verify !== "function") throw new Error("createReviewFaceGate 需要 capability 签发/验签门面");
  // 台账门面自检（42 号票）：指定腿走**任务域读法** `taskEvents(taskId)`，故门面齐备的
  // 判据也钉在它身上（钉 `events` 会随 46 号票删整条历史读法成为悬空引用）
  if (!ledger || typeof ledger.taskEvents !== "function") throw new Error("createReviewFaceGate 需要台账门面");
  function hatCheck({ envelope, op, botId, taskId }) {
    const verdict = verifyReviewHat({ issuer, envelope, botId, taskId, op });
    if (!verdict.ok) return verdict;
    // 指定腿只查本任务内是否指名该实例（域＝任务；`taskEvents` 未开档＝空数组，与旧面同口径）
    const designated = (ledger.taskEvents(taskId) ?? []).some(
      (event) => event?.type === "review-requested" && event.reviewer === botId
    );
    if (!designated) {
      return { ok: false, code: "review-not-designated", reason: `实例 ${String(botId)} 未被指定为 ${String(taskId)} 的复核者` };
    }
    return { ok: true, payload: verdict.payload };
  }
  return {
    /** 移交件读（不消费 nonce——与写面共用「通道门不消费」的同一口径）。 */
    authorizeHandoff({ envelope, botId, taskId } = {}) {
      return hatCheck({ envelope, op: "artifact.read", botId, taskId });
    },
    /** 报告提交预筛（不消费 nonce；消费点在台账写路径，提交后由响应携带续签帽）。 */
    authorizeReport({ envelope, botId, taskId } = {}) {
      return hatCheck({ envelope, op: "review.report", botId, taskId });
    }
  };
}
