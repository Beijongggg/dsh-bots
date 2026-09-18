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
 *   - 复核帽的域 op（`artifact.read`／`evidence.read|probe`／`results.read`／
 *     `review.report`）与 `review.request`／`artifact.submit`／`evidence.*`／
 *     `routine.*` 尚无命令面实体——列 **RESERVED_OPS 保留集**（随归属票 07/08/12
 *     落地时升入可执行表），不得预混进 OP_SET（对账会把「登记了不可执行的 op」
 *     报为违例）。
 * 读写分类（READ_OPS／WRITE_OPS）覆盖「命令面全词表 ∪ ledger.read」，是 V-A3.4
 * 「复核帽不含任何写 op」机械检查的完备性前提：两类不交、并集封闭，新 op 进
 * 命令面时漏分类即被对账抓出。
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

/** 读 op（读面，不落事件）。当前唯一成员＝台账投影读。 */
export const READ_OPS = Object.freeze(["ledger.read"]);

/**
 * 写 op（追加台账事件的一切命令——含 judgement/heartbeat/exception 这类非状态
 * 事实）。当前命令面每个 op 都落事件，故写集＝命令面全词表。
 */
export const WRITE_OPS = Object.freeze([...LEDGER_COMMAND_OPS]);

/**
 * 任务域 op：须持绑定 `binding.taskId` 的任务能力方可执行（承接执行集）。
 * 组织运营 op（intake/triage/plan/assign/settle 等）由 home 岗位 op 集（角色
 * 能力）覆盖，不在此列。
 */
export const TASK_SCOPED_OPS = Object.freeze([
  "task.accept", "task.start", "task.report", "task.deliver", "task.heartbeat",
  "task.judge", "task.block", "task.wait-user", "task.fail"
]);

/**
 * op-set 岗位表（可执行面）。复核帽的可执行集当前为空——其域 op 全部还在保留集
 * （归 08 号票落命令面）；「复核帽无写 op、无 ledger.read」由 validateOpSet 与
 * RESERVED_OPS 双向机械把守，不靠约定。
 */
export const OP_SET = Object.freeze({
  "duty-coordinator": Object.freeze([
    "task.intake", "task.triage", "task.exception", "ledger.read"
  ]),
  "project-lead": Object.freeze([
    "task.plan", "task.assign", "task.amend", "task.settle",
    "task.close", "task.cancel", "task.unblock", "task.resume", "task.requeue",
    "ledger.read"
  ]),
  "researcher": Object.freeze([
    "task.accept", "task.start", "task.report", "task.deliver", "task.heartbeat",
    "task.judge", "task.block", "task.wait-user", "task.fail", "ledger.read"
  ]),
  "implementer": Object.freeze([
    "task.accept", "task.start", "task.report", "task.deliver", "task.heartbeat",
    "task.judge", "task.block", "task.wait-user", "task.fail", "ledger.read"
  ]),
  "verifier": Object.freeze([])
});

/**
 * 保留 op 集（按角色；随归属票落地时升入 OP_SET）：
 *   - `review.request`／复核帽域 op ＝ 08 号票（复核件套）
 *   - `artifact.*`／`evidence.*` ＝ 07 号票（简报与派单）落命令面
 *   - `routine.trigger` ＝ 12 号票（升级例程）；宿主 ticker 今日内部直调
 * 复核帽保留集**只收读 op**——保留集预置写 op 即违例（validateOpSet 检查）。
 */
export const RESERVED_OPS = Object.freeze({
  "duty-coordinator": Object.freeze(["routine.trigger"]),
  "project-lead": Object.freeze(["review.request"]),
  "researcher": Object.freeze(["artifact.submit", "artifact.read", "evidence.read", "evidence.probe"]),
  "implementer": Object.freeze(["artifact.submit", "artifact.read", "evidence.read", "evidence.probe"]),
  "verifier": Object.freeze(["artifact.read", "evidence.read", "evidence.probe", "results.read", "review.report"])
});

/** 全部保留 op 的去重清单（对账用：可执行表不得混入保留 op）。 */
export function allReservedOps(table = RESERVED_OPS) {
  return [...new Set(Object.values(table).flat())];
}

const KNOWN_OPS = new Set([...LEDGER_COMMAND_OPS, ...READ_OPS]);
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
  const reserved = allReservedOps();
  // 保留集机械检查：复核帽保留集只收读 op（预置写 op 即违例——防 08 号票升表时夹带）
  for (const op of RESERVED_OPS.verifier ?? []) {
    if (WRITE_OPS.includes(op)) violations.push(`verifier(保留集): 复核帽不得预置写 op（${op}）`);
  }
  for (const [slug, ops] of Object.entries(table)) {
    const card = ROLE_CARDS.find((entry) => entry.slug === slug);
    if (card === undefined) {
      violations.push(`${slug}: 不在岗位卡契约面（无卡之岗不得进 op-set 表）`);
      continue;
    }
    const seen = new Set();
    for (const op of ops) {
      if (!KNOWN_OPS.has(op)) violations.push(`${slug}: op ${op} 不在命令面词表`);
      if (reserved.includes(op)) violations.push(`${slug}: op ${op} 属保留集，不得混入可执行表`);
      if (seen.has(op)) violations.push(`${slug}: op ${op} 重复登记`);
      seen.add(op);
      if (slug === "verifier" && WRITE_OPS.includes(op)) {
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
      if (post === "verifier" && WRITE_OPS.includes(op)) {
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

const TOOL_KIND = Object.freeze({
  "ledger.read": "ledger-read"
});

/**
 * 工具面派生（`V-A4.1`）：按岗位表逐 op 生成工具描述件——一 op 一工具、工具名
 * 即 op 名；`execute` 薄封装注入的 dispatch（`async (op, args) => 结论`），未
 * 接线时调用即抛（fail closed，不静默降级）。派生是纯函数：同一岗位表换
 * dispatch 可重复注册。
 */
export function deriveToolFace(slug, { dispatch } = {}) {
  const ops = OP_SET[slug];
  if (ops === undefined) throw new Error(`deriveToolFace：岗位 ${String(slug)} 不在 op-set 表`);
  return ops.map((op) => ({
    name: op,
    op,
    kind: TOOL_KIND[op] ?? "ledger-command",
    writes: WRITE_OPS.includes(op),
    description: TOOL_KIND[op] === "ledger-read"
      ? `读取任务台账投影（组织事实只读面；op=${op}）`
      : `执行组织命令 ${op}（op-set 岗位表：${slug}）`,
    async execute(args) {
      if (typeof dispatch !== "function") throw new Error(`工具 ${op} 未接线 dispatch（fail closed）`);
      return dispatch(op, args);
    }
  }));
}

/**
 * 按岗位注册工具面到宿主 tools 服务（`V-A4.1`「工具按岗位卡派生注册」的登记件；
 * 通道 dispatch＝bot→host 认证命令通道，随 07 号票接单流接线）。返回逐工具
 * disposer 数组；注册集＝派生面本身——复核帽的注册集因此天然不含写工具
 * （`V-A4.9`：不是「注册了但拒绝」）。
 */
export function registerPostTools({ tools, post, dispatch, logger } = {}) {
  if (tools === undefined || typeof tools.register !== "function") {
    throw new Error("registerPostTools 需要宿主 tools 服务");
  }
  const disposers = [];
  for (const tool of deriveToolFace(post, { dispatch })) {
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
