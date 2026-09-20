/**
 * op-set 岗位表与工具面派生（org-v2 06 号票；规格 §D/§E 与附录 A `V-A3.3`／
 * `V-A3.4`／`V-A4.1`／`V-A4.9`）。
 *
 * op-set 表＝组织命令面的**岗位白名单唯一源**：每岗位可持有哪些 op 由本表封闭
 * 枚举，工具面由本表派生（一 op 一工具、工具名即 op 名——工具面裁剪＝权限裁剪）。
 * 规格域词到台账命令词的映射（§D op-set → lib/org/task-ledger.js OPS）：
 *   - `task.create`（立项）＝`task.plan`；`task.claim`＝`task.accept`；
 *     `brief.amend`＝`task.amend`；承接岗 `task.escalate`＝`task.wait-user`／
 *     `task.fail`（上浮由台账 `escalated` 事件承载，宿主 sweep 驱动）。
 *   - §D 岗位表未点名、而由 §B 责任表（STATE_RESPONSIBILITY「每态下一步谁负责」）
 *     推导给岗位的台账命令：项目经理持 `task.close`／`task.cancel`／`task.unblock`／
 *     `task.resume`／`task.requeue`（delivered/settled 态责任人与队列归位人）、
 *     值班统筹持 `task.exception`（值守维护职责）——§D 列举的是域级能力面，
 *     台账命令面更细，细化映射以本表为唯一源（对账以本表为准）。
 *     **2026-09-19 用户裁定（21 号票 ④）**：上列推导**升格为裁定口径**——岗位 op
 *     集以本表为唯一源，§D 列举的域级能力面不构成台账命令面的封闭枚举；同轮
 *     裁定续签点＝**每个授权有效的 post 命令**（§D「转移点」列举之外，实现口径
 *     以 `permissions.createLedgerCommandDispatcher` 头注为准）。
 *   - 复核帽的域 op（`artifact.read`／`evidence.read|probe`／`results.read`／
 *     `review.report`）与 `review.request`／`artifact.submit`／`evidence.read`／
 *     `routine.trigger` 尚无命令面实体——列 **RESERVED_OPS 保留集**（随归属票
 *     08/12 落地时升入可执行表），不得预混进 OP_SET（对账会把「登记了不可执行
 *     的 op」报为违例）；`evidence.probe` 已随 07 号票升入承接岗可执行表（执行
 *     面分类 EXECUTE_OPS）。
 * 读写分类（READ_OPS／WRITE_OPS）覆盖「命令面全词表 ∪ ledger.read ∪ 读面扩展
 * op」（读面扩展现＝brief.refresh，19 号票②），是 V-A3.4「复核帽不含任何写 op」
 * 机械检查的完备性前提：两类不交、并集封闭，新 op 进命令面时漏分类即被对账抓出。
 *
 * 动态工具面不变量（§E；`V-A1.4` 借用不变量）：实例任一时刻可用组织命令集＝
 * `availableOps(home, capability)`＝home 岗位 op 集 ∪ 当次签发 capability 的
 * op 集；帽卸或租约回收即失效（失效判定在 capability-issue 的验签面，与吊销
 * 联动同拍）。
 */
import { OPS } from "./task-ledger.js";
import { ROLE_CARDS } from "./role-cards.js";

/** 台账命令面全词表（task-ledger OPS 的键，冻结快照）。 */
export const LEDGER_COMMAND_OPS = Object.freeze([...Object.keys(OPS)]);

/** 读 op（读面，不落事件）。台账投影读＋复核移交件读（08 号票，复核帽专用面）
 *  ＋持有件刷新（19 号票②：brief.refresh——实例侧读台账投影重同步本地持有简报）。 */
export const READ_OPS = Object.freeze(["ledger.read", "artifact.read", "brief.refresh"]);

/**
 * 写 op（追加台账事件的一切命令——含 judgement/heartbeat/exception 这类非状态
 * 事实）。当前命令面每个 op 都落事件，故写集＝命令面全词表。
 */
export const WRITE_OPS = Object.freeze([...LEDGER_COMMAND_OPS]);

/**
 * 任务域 op：须持绑定 `binding.taskId` 的任务能力方可执行（承接执行集）。
 * 组织运营 op（intake/triage/plan/assign/settle 等）由 home 岗位 op 集（角色
 * 能力）覆盖，不在此列。`evidence.probe` 是执行面 op（非台账命令），但同样是
 * 任务域授权——探针针对某张任务的预登记判据执行，随任务吊销同拍。
 */
export const TASK_SCOPED_OPS = Object.freeze([
  "task.accept", "task.decline", "task.start", "task.report", "task.deliver", "task.heartbeat",
  "task.judge", "task.block", "task.wait-user", "task.fail", "evidence.probe"
]);

/**
 * 执行面 op（07 号票升表 evidence.probe；08 号票升表 review.report；10 号票升表
 * knowledge.register；11 号票升表 mail.send）：**非台账命令**——经 host 侧对应面
 * 执行（探针白名单 `lib/org/probe.js`；复核报告经台账 `recordReviewReport` 落盘；
 * 知识登记经 `lib/knowledge.js registerReport` 在 **host 进程内**执行；邮件投递经
 * `lib/org/mail-relay.js` 在 **host 进程内**落盘——bot 侧零直写，`V-A4.4`），
 * 不作为台账命令落事件。与读写两类互斥：WRITE_OPS＝「追加台账事件的一切命令」，
 * 执行面 op 本体不落事件故不属写集。
 *
 * `mail.send` 是本表唯一的**零门槛**执行面 op：规格 §E「全员基础工具＝mail.send＋
 * …」——它对 bot 无 capability 门槛（`V-A3.7` 邮件零权威、投递保持低摩擦），因此
 * 不进 TASK_SCOPED_OPS，四个常设岗各持一份；复核帽按 `V-A3.4` 不持（它是共享面
 * 写者，见 MUTATING_OPS）。「全员」＝全员**岗位**（复核是帽不是岗），与
 * `knowledge.register` 的读-写划分同口径。
 */
export const EXECUTE_OPS = Object.freeze([
  "evidence.probe", "review.report", "knowledge.register", "knowledge.deprecate", "mail.send"
]);

/**
 * 变异 op 集＝**改共享面或台账的一切 op**：WRITE_OPS（落台账事件）∪ 执行面里的
 * 共享面写者（`knowledge.register`／`mail.send`——后者写的是各实例邮箱目录）。
 * 这是 `V-A3.4`「复核帽不含任何写 op」的本义——台账事件写者与共享面写者都是
 * 变异，复核帽两类都不得持（只看 WRITE_OPS 会漏掉「不落事件但改共享面」的通道）。
 */
export const MUTATING_OPS = Object.freeze([
  ...WRITE_OPS, "knowledge.register", "knowledge.deprecate", "mail.send"
]);
/**
 * `review.report` **不在**变异集（看似违反上句的「一切 op」）：它是复核帽**本职**
 * 的读后写动作（复核者的产出就是报告），把它计入变异集等于让复核帽无法履责
 * （`V-A3.3` 要求复核帽持 `review.report`）。本集的判定用途是「复核帽不得持」，
 * 故口径＝**复核帽不该持有的共享面/台账写者**，而非字面的「所有会写盘的 op」。
 */

/**
 * op-set 岗位表（可执行面）。复核帽可执行集（08 号票升表）：`artifact.read`
 * （移交件读）＋`evidence.probe`（判据探针）＋`review.report`（报告提交）——
 * 读面∪执行面、**零写 op、无 ledger.read**（`V-A3.3`／`V-A3.4` 由 validateOpSet
 * 与保留集双向机械把守，不靠约定）。`review.request`（复核请求）随 08 升入
 * project-lead 行（台账命令、落事件，属管理类写集）。
 */
/**
 * 承接岗共享表：researcher/implementer 同为承接执行岗（执行集＋台账读；保留集
 * 同口径），共享同一冻结件——升表时一处改、两岗同步。
 */
const DELIVERY_POST_OPS = Object.freeze([
  "task.accept", "task.decline", "task.start", "task.report", "task.deliver", "task.heartbeat",
  "task.judge", "task.block", "task.wait-user", "task.fail", "evidence.probe", "brief.refresh",
  "knowledge.register", "knowledge.deprecate", "mail.send", "ledger.read"
]);
const DELIVERY_RESERVED_OPS = Object.freeze(["artifact.submit", "artifact.read", "evidence.read"]);

export const OP_SET = Object.freeze({
  "duty-coordinator": Object.freeze([
    "task.intake", "task.triage", "task.exception",
    "knowledge.register", "knowledge.deprecate", "mail.send", "ledger.read"
  ]),
  "project-lead": Object.freeze([
    "task.plan", "task.assign", "task.amend", "task.settle",
    "task.close", "task.cancel", "task.unblock", "task.resume", "task.requeue",
    "review.request", "knowledge.register", "knowledge.deprecate", "mail.send", "ledger.read"
  ]),
  "researcher": DELIVERY_POST_OPS,
  "implementer": DELIVERY_POST_OPS,
  "verifier": Object.freeze(["artifact.read", "evidence.probe", "review.report"])
});

/**
 * 岗位 op 集按能力类型切分（`kind="task"`＝该岗的任务域 op，其余 op 归角色能力）：
 * 签发面（capability-issue）与审计链对账面（scripts/capability-issued-audit）
 * 共用**单一源**——角色能力不得充当任务域授权、任务能力不装运营 op，两处判定
 * 同口径。
 */
export function tableOpsForKind(post, kind, table = OP_SET) {
  const ops = table[post];
  if (ops === undefined) return [];
  return kind === "task"
    ? ops.filter((op) => TASK_SCOPED_OPS.includes(op))
    : ops.filter((op) => !TASK_SCOPED_OPS.includes(op));
}

/**
 * 保留 op 集（按角色；随归属票落地时升入 OP_SET）：
 *   - `evidence.read`／`results.read` ＝ 裁定包/移交读面（消费方落 09 裁定包／
 *     14 闭环移交时升表；07 号票留界⑧同口径——升表跟着消费方走）
 *   - `artifact.submit` ＝ 工件提交链（消费方＝14 闭环的跨实例提交链）
 *   - `routine.trigger` ＝ 12 号票（升级例程）；宿主 ticker 今日内部直调
 * 复核帽保留集**只收读 op**——保留集预置写 op 即违例（validateOpSet 检查）。
 */
export const RESERVED_OPS = Object.freeze({
  "duty-coordinator": Object.freeze(["routine.trigger"]),
  "project-lead": Object.freeze([]),
  "researcher": DELIVERY_RESERVED_OPS,
  "implementer": DELIVERY_RESERVED_OPS,
  "verifier": Object.freeze(["evidence.read", "results.read"])
});

const KNOWN_OPS = new Set([...LEDGER_COMMAND_OPS, ...READ_OPS, ...EXECUTE_OPS]);

/** 复核帽变异 op 判定（表校验与签发对账共用原语）：复核帽不得持任何变异 op
 *  （含不落台账事件但改共享面的 knowledge.register）。 */
function isVerifierWriteOp(slug, op) {
  return slug === "verifier" && MUTATING_OPS.includes(op);
}
/** 常设岗（可作 home 岗位；与 role-cards 的 STANDING_POST_SLUGS 同源口径，复核帽除外）。 */
export const STANDING_POST_SLUGS = Object.freeze(
  ROLE_CARDS.map((card) => card.slug).filter((slug) => slug !== "verifier")
);
const STANDING = STANDING_POST_SLUGS;

/**
 * op-set 表校验（机械检查，`V-A3.3`／`V-A3.4` 的执行坐标）：slug 须在岗位卡
 * 契约面；op 须在命令面词表 ∪ ledger.read 且不在保留集；岗位内无重复；复核帽
 * 无写 op、无 ledger.read（可执行表与保留集双向）；四常设岗必须有 ledger.read。
 * 表被改坏即报违例清单。
 */
export function validateOpSet(table = OP_SET) {
  const violations = [];
  // 保留集机械检查：复核帽保留集只收读 op（预置变异 op 即违例——防 08 号票升表时夹带）
  // 口径＝MUTATING_OPS（写集∪共享面写者），与复核帽可执行表的检查同源：只看
  // WRITE_OPS 会漏掉「不落台账事件但改共享面」的 knowledge.* 通道
  for (const op of RESERVED_OPS.verifier ?? []) {
    if (MUTATING_OPS.includes(op)) violations.push(`verifier(保留集): 复核帽不得预置变异 op（${op}）`);
  }
  for (const [slug, ops] of Object.entries(table)) {
    const card = ROLE_CARDS.find((entry) => entry.slug === slug);
    if (card === undefined) {
      violations.push(`${slug}: 不在岗位卡契约面（无卡之岗不得进 op-set 表）`);
      continue;
    }
    // 保留集按岗位判：本岗保留的 op 不得同时在本岗可执行表（他岗已升表不受影响）
    const ownReserved = RESERVED_OPS[slug] ?? [];
    const seen = new Set();
    for (const op of ops) {
      if (!KNOWN_OPS.has(op)) violations.push(`${slug}: op ${op} 不在命令面词表`);
      if (ownReserved.includes(op)) violations.push(`${slug}: op ${op} 属本岗保留集，不得混入可执行表`);
      if (seen.has(op)) violations.push(`${slug}: op ${op} 重复登记`);
      seen.add(op);
      if (isVerifierWriteOp(slug, op)) {
        violations.push(`verifier: 复核帽不得持写 op（${op}）`);
      }
    }
    if (slug === "verifier" && ops.includes("ledger.read")) {
      violations.push("verifier: 复核帽不得持 ledger.read");
    }
    if (STANDING.includes(slug) && !ops.includes("ledger.read")) {
      violations.push(`${slug}: 常设岗必须持 ledger.read`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * 签发对账（`V-A3.3`「op-set 岗位表与实际签发对账一致」）：每笔签发的 op 集
 * ⊆ 持有岗位的 op-set 表。给复核帽签发写 op／任何越表签发都报违例——签发面
 * （capability-issue）在出信封前先过本对账口径，fail closed。
 */
export function reconcileIssuedVsOpSet(issuances, table = OP_SET) {
  const violations = [];
  for (const issuance of issuances ?? []) {
    const post = issuance?.post;
    const ops = Array.isArray(issuance?.ops) ? issuance.ops : [];
    if (table[post] === undefined) {
      violations.push(`${issuance?.botId ?? "(缺 botId)"}: 岗位 ${String(post)} 不在 op-set 表`);
      continue;
    }
    for (const op of ops) {
      if (!table[post].includes(op)) {
        violations.push(`${issuance?.botId ?? "(缺 botId)"}（${post}）: 签发 op ${op} 越出岗位表`);
      }
      if (isVerifierWriteOp(post, op)) {
        violations.push(`${issuance?.botId ?? "(缺 botId)"}（verifier）: 给复核帽签发写 op ${op}`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/** 动态工具面不变量：可用组织命令集＝home op 集 ∪ 当次签发 op 集（去重保序）。 */
export function availableOps(home, capability, table = OP_SET) {
  if (table[home] === undefined) throw new Error(`availableOps：home 岗位 ${String(home)} 不在 op-set 表`);
  const merged = [...table[home]];
  for (const op of capability?.ops ?? []) {
    if (!merged.includes(op)) merged.push(op);
  }
  return merged;
}

/** 工具元数据表（23 号票④自 TOOL_KIND 名实相称改名：表持 {kind, description}
 *  工具元数据而非 kind 词表本身——TOOL_META 更诚实）。表外 op 缺省
 *  kind＝"ledger-command"。 */
const TOOL_META = Object.freeze({
  "ledger.read": { kind: "ledger-read", description: (slug) => `读取任务台账投影（组织事实只读面；op=ledger.read）` },
  "evidence.probe": {
    kind: "probe-execute",
    description: (slug) => `按台账简报预登记判据执行探针检查（白名单封闭、fail closed；op=evidence.probe）`
  },
  "artifact.read": {
    kind: "review-handoff",
    description: (slug) => `读取复核移交件（冻结简报＋复核请求/报告史，不含产出方推理轨迹；op=artifact.read）`
  },
  "review.report": {
    kind: "review-report",
    description: (slug) => `提交复核报告（形状固定＝gaps＋严重度＋证据坐标＋模型身份；追加式事实，不得改工件／改判据；op=review.report）`
  },
  "brief.refresh": {
    kind: "brief-refresh",
    description: (slug) => `同步本地持有简报为台账真源（amend 通知到达后重同步，探针逐字比对恢复可用；只许当前归属者；op=brief.refresh）`
  },
  "knowledge.deprecate": {
    kind: "knowledge-deprecate",
    description: (slug) => `废弃一条知识条目（显式废弃登记：append 语义翻状态＋理由留痕，不物理删除、旧痕迹保留；op=knowledge.deprecate）。入参置于 payload：{payload: {id, reason?}}。这是知识库唯一的失效机制之一（另一为取代）——不做自动失效、不做访问热字段。`
  },
  "mail.send": {
    kind: "mail-relay",
    description: (slug) => `给团队里的 bot 或用户发一封邮件（投递通道，零 capability 门槛；投递由 host 落盘，bot 侧不直写；op=mail.send）。入参：{to, text, taskId?}——to 填收件 bot 的 id 或名字（传空串则只返回可投递名单、不发送），text 写完整的任务/问题与期望产出（对方只能看到这段正文），taskId 填关联的任务 id（关联键；邮件内容不承载任务状态）。发完不必等待：对方处理后会回信，回信作为新消息触发你的下一个回合。`
  },
  "knowledge.register": {
    kind: "knowledge-register",
    description: (slug) => `把产出登记进团队共享知识库（命令化：bot 无共享面直写通道，登记由 host 进程执行；op=knowledge.register）。正文与摘要为入参，索引 id 由 host 侧生成。登记不构成任务完成依据；派单方在简报输出格式里以 promotion 预声明强制性时，产出方须在任务关闭或归档流程内登记。`
  }
});

/**
 * 工具面派生（`V-A4.1`）：按岗位表逐 op 生成工具描述件——一 op 一工具、工具名
 * 即 op 名；`execute` 薄封装注入的 dispatch（`async (op, args) => 结论`），未
 * 接线时调用即抛（fail closed，不静默降级）。派生是纯函数：同一岗位表换
 * dispatch 可重复注册。
 *
 * `describeOp`（可选）＝描述覆写钩子 `({slug, op, description}) => string`：调用
 * 面可把**运行时现读**的内容织进描述（10 号票：`knowledge.register` 的描述须
 * 带现读的报告模板结构——F-R4-1「为拿模板而全盘 find 烧 5m05s」的根治形态，
 * 命令化后仍须保持，不得退化成静态内联）。钩子返回非字符串即回退缺省描述。
 */
export function deriveToolFace(slug, { dispatch, describeOp } = {}) {
  const ops = OP_SET[slug];
  if (ops === undefined) throw new Error(`deriveToolFace：岗位 ${String(slug)} 不在 op-set 表`);
  return ops.map((op) => {
    const meta = TOOL_META[op];
    const fallbackDescription = meta !== undefined
      ? meta.description(slug)
      : `执行组织命令 ${op}（op-set 岗位表：${slug}）`;
    const overridden = typeof describeOp === "function"
      ? describeOp({ slug, op, description: fallbackDescription })
      : undefined;
    return {
      name: op,
      op,
      kind: meta?.kind ?? "ledger-command",
      writes: WRITE_OPS.includes(op),
      description: typeof overridden === "string" && overridden !== "" ? overridden : fallbackDescription,
      async execute(args) {
        if (typeof dispatch !== "function") throw new Error(`工具 ${op} 未接线 dispatch（fail closed）`);
        return dispatch(op, args);
      }
    };
  });
}

/**
 * 按岗位注册工具面到宿主 tools 服务（`V-A4.1`「工具按岗位卡派生注册」的登记件；
 * 通道 dispatch＝bot→host 认证命令通道，随 07 号票接单流接线）。返回逐工具
 * disposer 数组；注册集＝派生面本身——复核帽的注册集因此天然不含写工具
 * （`V-A4.9`：不是「注册了但拒绝」）。
 */
export function registerPostTools({ tools, post, dispatch, describeOp, logger } = {}) {
  if (tools === undefined || typeof tools.register !== "function") {
    throw new Error("registerPostTools 需要宿主 tools 服务");
  }
  const disposers = [];
  for (const tool of deriveToolFace(post, { dispatch, describeOp })) {
    disposers.push(tools.register({
      name: tool.name,
      description: tool.description,
      parameters: { type: "object", additionalProperties: true },
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
      },
      execute: tool.execute
    }));
  }
  logger?.info?.(`[dsh-bots] op-set 工具面注册：${post}（${String(disposers.length)} 件）`);
  return disposers;
}
