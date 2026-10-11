/**
 * A 组验收判据的**执行坐标表**（org-v2 14 号票；规格附录 A「唯一权威」清单的机械面）。
 *
 * 问题（14 号票 recon 发现 G7）：附录 A 的「执行坐标」此前是散文（「台账测试模块」
 * 「复核件套测试模块」…），**没有任何机械把守**——切换批前置判据「A 组坐标无空缺」
 * 因此无判据可查。本模块把 60 条坐标落成封闭数据件，并与规格附录 A **双向锁定**：
 *
 *   - 数据 → 规格：每条判据在规格附录 A 的执行坐标／级别单元格须与本表**逐字一致**
 *     （`scanAcceptanceSpec`；空白无关归一，与 §J 的 `specSection` 同口径）。
 *   - 规格 → 数据：规格附录 A 的判据 id 集须与本表**集合等值**（少一条＝坐标空缺，
 *     多一条＝表外判据）——两向都不许漂移，漂移即红。
 *   - 坐标可解析：每条坐标按 `＋` 拆成记号，逐记号解析到**真实存在的**落点——
 *     测试文件里恰有一个该名字的测试（测试名即坐标，规格 Testing Decisions）、
 *     脚本／模块文件在仓内、门号在四道门内、探针 id 在登记表内、演练／人工判据
 *     在本模块的登记表内。解析不到即违例（防坐标指向空气）。
 *
 * 判据语义不在本模块（语义权威＝规格正文与附录 A，冻结）；本模块只补坐标，
 * 不动判据措辞、不改级别、不碰挂标计数（`V-A1.4` 单列计数维持 1）——故本件**不是
 * 第二份判据清单**，而是规格附录 A「执行坐标」列的机械面（判据清单仍唯一住规格）。
 *
 * 判据落点：规格 Testing Decisions「坐标齐备度」＋附录 A 通则（切换批前置判据含
 * 「A 组坐标无空缺」）。本轮据此补齐两条原本只有散文坐标的判据：`V-A6.5`（门序断言
 * 落在 `tests/preflight.test.mjs`）与 `V-A6.7`（探针失效承载落在 `tests/ledger-host.test.mjs`）。
 *
 * **机械面的边界（不许把「解析成立」当「语义覆盖」）**：本模块证伪的是「坐标指向
 * 不存在的落点」——文件／测试名／门号／读面／探针 id／演练 id 的**存在性与唯一性**；
 * 它**不**（也无法）证伪「该测试确实覆盖该判据的语义」——那是评审轴的人工判断，
 * 60 条的语义核对见 14 号票 recon 件（逐行实读）。坐标的语义可信度由**回写＋双向
 * 锁定**承接：规格侧与数据侧只许同拍，任一侧被改单边即红。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeSpecText } from "./durability.js";
import { sha256Hex } from "./store-base.js";

/** 附录 A 的 A 组小节标题（`parseCriteriaTable` 的锚）。 */
export const APPENDIX_A_HEADING = "### A 组：实现完备性（`V-A1`–`V-A7`，60 条）";

/**
 * A 组判据**语义摘要**（id／判据／证据落点／级别四列，**不含执行坐标列**）：
 * 坐标怎么改都不进摘要，「只补坐标、不改判据语义」由本摘要与冻结基线的比对
 * 保证为**持续不变量**（改判据／证据／级别任一列即红）。
 */
export function acceptanceSemanticsDigest(parsedRows) {
  const lines = [...parsedRows]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((row) => [row.id, row.criterion, row.evidence, row.level].join("\t"));
  return sha256Hex(lines.join("\n"));
}

/**
 * 语义摘要的冻结基线（2026-09-21 记账）。显式修订判据（增删改／动证据或级别列）
 * 须走规格修订流程：更新本基线＋CHANGELOG 记新摘要与授权依据。基线形状非法
 * （非 64 位十六进制）＝fail closed，不留占位符旁路。
 */
export const ACCEPTANCE_SEMANTICS_BASELINE = "5f870a0db48f55f77108563c384ef538ba36882619c00ef2287f1e6433e8bfcd";

/** 四道门号（`scripts/preflight.mjs`）；坐标里只许引用这四个。 */
export const GATE_IDS = Object.freeze(["门①", "门②", "门③", "门④"]);

/**
 * 覆盖级别标签（与规格附录 A 的「级别」单元格逐字一致）。级别是规格冻结值，
 * 本模块只做词表校验，**不得**在此新增或重命名级别。
 */
export const LEVEL_LABELS = Object.freeze({
  resident: "常驻",
  experiment: "实验期一次",
  probeResidentVisualExperiment: "探针常驻、目视实验期一次"
});

/** 判据 id 的**冻结字面量**清单（60 条；封闭枚举，少一条即坐标空缺）。 */
export const REQUIRED_CRITERION_IDS = Object.freeze([
  "V-A1.1", "V-A1.2", "V-A1.3", "V-A1.4",
  "V-A2.1", "V-A2.2", "V-A2.3", "V-A2.4", "V-A2.5", "V-A2.6", "V-A2.7",
  "V-A2.8", "V-A2.9", "V-A2.10", "V-A2.11", "V-A2.12", "V-A2.13",
  "V-A3.1", "V-A3.2", "V-A3.3", "V-A3.4", "V-A3.5", "V-A3.6", "V-A3.7",
  "V-A3.8", "V-A3.9", "V-A3.10",
  "V-A4.1", "V-A4.2", "V-A4.3", "V-A4.4", "V-A4.5", "V-A4.6", "V-A4.7",
  "V-A4.8", "V-A4.9",
  "V-A5.1", "V-A5.2", "V-A5.3", "V-A5.4", "V-A5.5", "V-A5.6",
  "V-A6.1", "V-A6.2", "V-A6.3", "V-A6.4", "V-A6.5", "V-A6.6", "V-A6.7", "V-A6.8",
  "V-A7.1", "V-A7.2", "V-A7.3", "V-A7.4", "V-A7.5", "V-A7.6", "V-A7.7",
  "V-A7.8", "V-A7.9", "V-A7.10"
]);

/**
 * 实验期一次条目的**演练登记**（执行窗口＋承载脚本＋证据落点）。登记 ≠ 已执行：
 * 窗口列写的是该演练**何时**执行（切换批／验收实验期），执行证据落增量包或台账。
 * 承载列＝可驱动该演练的既有代码路径（避免为演练新写工具）。
 */
export const DRILL_WINDOWS = Object.freeze([
  {
    id: "drill-ledger-rebuild",
    criterionIds: Object.freeze(["V-A2.2"]),
    name: "台账重建演练",
    window: "切换批 smoke 段（16 号票：就绪探针 PASS 后、旧席归档前）",
    carrier: "tests/org-closed-loop-smoke.test.mjs::闭环烟测 ②（常驻钉桩）＋实操：停 host → 留 bots/ledger/events.jsonl → 冷启 → 读 openQueue()",
    evidenceLanding: "增量包（runId 采集）＋台账查询结论（openQueue 重建集合）"
  },
  {
    id: "drill-lease-reclaim",
    criterionIds: Object.freeze(["V-A2.5"]),
    name: "租约回收演练",
    window: "验收实验期（切换批之后、A 组收口之前）",
    carrier: "lib/org/task-ledger.js::sweep＋lib/org/ledger-host.js::tick（推进时钟过 acceptMs／leaseMs／stallMs）",
    evidenceLanding: "台账事件（lease-expired／lease-reclaimed／escalated）＋通知投影"
  },
  {
    id: "drill-waiting-user",
    criterionIds: Object.freeze(["V-A2.8", "V-A5.3"]),
    name: "挂起演练",
    window: "验收实验期（切换批之后、A 组收口之前）",
    carrier: "lib/org/human-inbox.js::buildInbox（挂起后推进时钟越 dueAt，看只多一条「已过期」投影）",
    evidenceLanding: "台账事件（零自动动作）＋用量统计（token 零增量）"
  },
  {
    id: "drill-capability-issue-revoke",
    criterionIds: Object.freeze(["V-A3.5"]),
    name: "签发吊销演练",
    window: "验收实验期（切换批之后、A 组收口之前）",
    carrier: "lib/org/capability-issue.js::issueTaskCapability／verify＋tests/org-closed-loop-smoke.test.mjs::闭环烟测 ⑤（常驻钉桩）",
    evidenceLanding: "增量包＋签发审计链（issuedAuditFile）"
  },
  {
    id: "drill-human-inbox",
    criterionIds: Object.freeze(["V-A5.2"]),
    name: "人间收件箱演练",
    window: "验收实验期（切换批之后、A 组收口之前）",
    carrier: "GET /api/pod/_ledger/inbox（真挂起一张任务后读待裁项与裁定包）",
    evidenceLanding: "台账事件＋增量包"
  },
  {
    id: "drill-model-upgrade",
    criterionIds: Object.freeze(["V-A7.4"]),
    name: "模型更迭升级演练",
    window: "验收实验期（切换批之后、B 组实验之前）",
    carrier: "lib/org/ledger-host.js::registerModelUpgradeEval（patch 改指派 → 台账自动登记 duty 评测任务）",
    evidenceLanding: "台账事件（class=duty 评测任务）＋增量包"
  },
  {
    id: "drill-probe-failure",
    criterionIds: Object.freeze(["V-A6.7"]),
    name: "探针失效演练",
    window: "验收实验期（切换批之后；探针失效为偶发事件，按发生即执行）",
    carrier: "lib/org/ledger-host.js::registerProbeFailure（探针 FAIL／运行面 SKIP → class=duty 处置任务＋exception 事件）",
    evidenceLanding: "台账事件（exception；零新增事件类型）＋通知投影"
  }
]);

/**
 * 人工判据白名单（规格 Testing Decisions：「人工判据只允许两类白名单——前端目视
 * 功能清单与知识复用率人工核对，且须列明核验人」）。白名单外的人工确认按**判据
 * 缺口**处理（分解为可观测项，分解不出来标 `needs-user` 上浮）——故本表 fail
 * closed：多一类即违例，缺核验人即违例。
 */
export const HUMAN_CRITERION_CATEGORIES = Object.freeze([
  {
    id: "human-visual-checklist",
    label: "前端目视功能清单",
    criterionId: "V-A6.8",
    checklist: "8 项渲染期语义清单（侧栏入口／整页接管／abdicate 还原／通知可见／本地化／视觉一致／窄屏／控制台无残留）",
    /**
     * 核验人：署名归人——**代签＝落档作假**（18 号票票面既定）。2026-10-07 由核验人
     * 「Beijong」在本会话内明示署名（原话「署名Beijong」），故现态＝有名＋`signed`；
     * 署名与状态须同拍（门内校验 `validateAcceptanceCoordinates` 把守）。
     */
    verifier: "Beijong",
    verifierStatus: "signed",
    window: "16 号票切换批「部署同步→重启链」点名段之后（部署面携带 HEAD 契约时）",
    landing: ".scratch/org-v2-build/issues/18-probe-behavior-upgrade.md（清单勾选＋核验人署名）＋增量包"
  },
  {
    id: "human-knowledge-reuse",
    label: "知识复用率人工核对",
    criterionId: null,
    checklist: "复用率人工观测（无向量／全文检索，复用靠人核）",
    verifier: null,
    verifierStatus: "pending-signature",
    window: "验收实验期（B 组实验跑完后的结论核对）",
    landing: "增量包（复用率记录）＋CHANGELOG 摘要"
  }
]);

/**
 * 60 条判据的执行坐标表。字段：
 *   - `id`＝判据 id（与规格附录 A 首列逐字一致）；
 *   - `level`＝覆盖级别标签（`LEVEL_LABELS` 之一，与规格附录 A 末列逐字一致）；
 *   - `coordinate`＝**执行坐标单元格全文**（与规格附录 A 第三列逐字一致；`＋` 分记号）；
 *   - `evidence`＝证据落点人读摘记（不参与规格锁定；勘察来源见 14 号票 recon 件）。
 */
export const A_GROUP_COORDINATES = Object.freeze([
  {
    id: "V-A1.1", level: LEVEL_LABELS.resident,
    coordinate: "tests/role-cards.test.mjs::V-A1.1a＋tests/role-cards.test.mjs::V-A1.1b",
    evidence: "tests/role-cards.test.mjs:54,220；校验器 lib/org/role-cards.js::validateRoleCards"
  },
  {
    id: "V-A1.2", level: LEVEL_LABELS.resident,
    coordinate: "tests/role-cards.test.mjs::V-A1.2 改显示名后工具与权限命名空间不变＋tests/role-cards.test.mjs::V-A1.2 命名空间漂移即报＋scripts/role-card-drift-check.mjs",
    evidence: "tests/role-cards.test.mjs:83,340；漂移脚本 scripts/role-card-drift-check.mjs"
  },
  {
    id: "V-A1.3", level: LEVEL_LABELS.resident,
    coordinate: "tests/role-cards.test.mjs::home 岗位只许常设岗＋tests/org-review-kit.test.mjs::帽选择：台账查询腿＋tests/anchor-bootstrap.test.mjs::起步编制契约＋查询:ledger.holdingsFor(instanceId)",
    evidence: "role-cards.test.mjs:350；org-review-kit.test.mjs:271；anchor-bootstrap.test.mjs:167,174"
  },
  {
    id: "V-A1.4", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-permissions.test.mjs::权限装配件工厂＋tests/org-op-set.test.mjs::动态工具面不变量＋tests/org-op-set.test.mjs::bootstrap 锚点席位＋tests/org-capability-issue.test.mjs::角色能力：taskId 为空",
    evidence: "org-op-set.test.mjs:189,199；org-capability-issue.test.mjs:199；挂标「设计推理（无直接文献）」条，单列计数维持 1"
  },
  {
    id: "V-A2.1", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::单一写者＋tests/ledger-host.test.mjs::HTTP 命令面是唯一写入口",
    evidence: "task-ledger.test.mjs:264；ledger-host.test.mjs:308,327"
  },
  {
    id: "V-A2.2", level: LEVEL_LABELS.experiment,
    coordinate: "tests/task-ledger.test.mjs::状态是事件投影＋查询:ledger.openQueue()＋演练:drill-ledger-rebuild",
    evidence: "task-ledger.test.mjs:238；实现 lib/org/task-ledger.js::openQueue/projectEvents"
  },
  {
    id: "V-A2.3", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::状态表：主干十态＋tests/task-ledger.test.mjs::主干转移＋tests/task-ledger.test.mjs::非法转移被确定性层拒绝＋tests/task-ledger.test.mjs::CAS：期望状态不符即拒＋tests/acceptance-records.test.mjs::关闭检查期间取消＋tests/acceptance-records.test.mjs::关闭检查期间改简报或强制加审＋tests/acceptance-records.test.mjs::同键并发关闭只记录首次结论＋tests/acceptance-records.test.mjs::不同键并发关闭只有一次成功",
    evidence: "task-ledger.test.mjs:117,148,169,192"
  },
  {
    id: "V-A2.4", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-brief.test.mjs::四要素各非空＋tests/task-ledger.test.mjs::派出即冻结＋tests/task-ledger.test.mjs::amend：追加事件并通知",
    evidence: "org-brief.test.mjs:25；task-ledger.test.mjs:828,754,882；门 lib/org/brief-gate.js"
  },
  {
    id: "V-A2.5", level: LEVEL_LABELS.experiment,
    coordinate: "tests/task-ledger.test.mjs::派单租约＋tests/task-ledger.test.mjs::重派达封顶则上浮用户＋tests/ledger-host.test.mjs::值守轮询＋演练:drill-lease-reclaim",
    evidence: "task-ledger.test.mjs:345,396,431；ledger-host.test.mjs:145；sweep lib/org/task-ledger.js::sweep"
  },
  {
    id: "V-A2.6", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::一实例同时只持一个进行中任务＋tests/org-dispatch-decision.test.mjs::派单决策：空闲且可承接者首中",
    evidence: "task-ledger.test.mjs:323；HOLDING_STATES／holdingsFor"
  },
  {
    id: "V-A2.7", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::必审拦截＋tests/org-review-kit.test.mjs::状态折叠",
    evidence: "task-ledger.test.mjs:1373；org-review-kit.test.mjs:199"
  },
  {
    id: "V-A2.8", level: LEVEL_LABELS.experiment,
    coordinate: "tests/task-ledger.test.mjs::挂起语义＋查询:lib/stats.js tokenUsage＋演练:drill-waiting-user",
    evidence: "task-ledger.test.mjs:1088,1123；状态表 waiting-user 行（onTimeout＝无自动动作）"
  },
  {
    id: "V-A2.9", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::关闭不可重开",
    evidence: "task-ledger.test.mjs:288"
  },
  {
    id: "V-A2.10", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::值守例程幂等键＋tests/org-durability.test.mjs::V-A7.4 端到端",
    evidence: "task-ledger.test.mjs:457；org-durability.test.mjs:480,528；triggerRoutine"
  },
  {
    id: "V-A2.11", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::异常四类统一走台账＋tests/ledger-host.test.mjs::异常汇入：收单积压截断与回合失败不再静默＋tests/task-ledger.test.mjs::轮询处置的异常登记失败响亮可核",
    evidence: "task-ledger.test.mjs:607,1584；ledger-host.test.mjs:89（v1 两处静默丢失的反例坐标）"
  },
  {
    id: "V-A2.12", level: LEVEL_LABELS.resident,
    coordinate: "tests/task-ledger.test.mjs::通知＝台账事件投影＋tests/ledger-host.test.mjs::值守轮询＋查询:ledger.notificationsAfter(cursor)",
    evidence: "task-ledger.test.mjs:633；ledger-host.test.mjs:145"
  },
  {
    id: "V-A2.13", level: LEVEL_LABELS.resident,
    coordinate: "tests/mail-at-least-once.test.mjs::appendOutbox 幂等＋tests/org-mail-shared-face.test.mjs::内容键封闭＋tests/org-mail-shared-face.test.mjs::邮件键与台账状态",
    evidence: "mail-at-least-once.test.mjs:123,135；org-mail-shared-face.test.mjs:71,78"
  },
  {
    id: "V-A3.1", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-permissions.test.mjs::L1：自身 workspace 内可写＋tests/org-permissions.test.mjs::L1 负例：~/.dsh 全域＋tests/org-permissions.test.mjs::L1 负例：知识库容器协议＋tests/org-permissions.test.mjs::L1 负例：投递面",
    evidence: "org-permissions.test.mjs:33,42,58,84,113；实现 lib/org/permissions.js::isBotWritablePath"
  },
  {
    id: "V-A3.2", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-ledger-authz.test.mjs::腿一负例：岗位命令无信封即拒＋tests/org-ledger-authz.test.mjs::腿一负例：伪造签名＋tests/org-ledger-authz.test.mjs::腿二负例＋tests/org-ledger-authz.test.mjs::腿三负例＋tests/task-ledger.test.mjs::复核报告入账验帽",
    evidence: "org-ledger-authz.test.mjs:69,89,113,129；鉴权三元组 lib/org/permissions.js::createLedgerAuthorizer；复核报告面（op=review.report）的帽验签与唯一消费点在台账腿（27 号票）lib/org/task-ledger.js::recordReviewReport"
  },
  {
    id: "V-A3.3", level: LEVEL_LABELS.resident,
    coordinate: "scripts/capability-issued-audit.mjs＋tests/capability-issued-audit.test.mjs::对账脚本：签发笔笔在岗位表内即绿＋tests/org-op-set.test.mjs::ledger.read 四常设岗有",
    evidence: "capability-issued-audit.test.mjs:63；org-op-set.test.mjs:42,211"
  },
  {
    id: "V-A3.4", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-op-set.test.mjs::复核帽不含任何写 op＋tests/org-op-set.test.mjs::共享面写者（V-A3.4 的本义）",
    evidence: "org-op-set.test.mjs:119,277；分类冻结字面量 lib/org/op-set.js"
  },
  {
    id: "V-A3.5", level: LEVEL_LABELS.experiment,
    coordinate: "tests/org-capability-issue.test.mjs::任务能力：assign 转移点签发＋tests/org-ledger-authz.test.mjs::签发联动＋tests/org-ledger-authz.test.mjs::链式能力＋tests/ledger-host.test.mjs::复核面 HTTP＋tests/ledger-host.test.mjs::复核面续签＋演练:drill-capability-issue-revoke",
    evidence: "org-capability-issue.test.mjs:61,84,98,115,159,175,251；org-ledger-authz.test.mjs:224,255"
  },
  {
    id: "V-A3.6", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-ledger-authz.test.mjs::腿一负例：岗位命令无信封即拒＋tests/org-ledger-authz.test.mjs::拒绝幂等",
    evidence: "org-ledger-authz.test.mjs:69,300,319；拒绝落账 lib/org/task-ledger.js::reject"
  },
  {
    id: "V-A3.7", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-ledger-authz.test.mjs::越权投递面负例＋tests/org-capability-issue.test.mjs::递送不经 mail＋tests/org-mail-relay.test.mjs::mail.send：host 唯一写者",
    evidence: "org-ledger-authz.test.mjs:151；org-capability-issue.test.mjs:273；org-mail-relay.test.mjs:44"
  },
  {
    id: "V-A3.8", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-permissions.test.mjs::V-A3.8",
    evidence: "org-permissions.test.mjs:136（逐 ROLE_CARDS × ROLE_CARD_FIELDS 扫全卡）"
  },
  {
    id: "V-A3.9", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-permissions.test.mjs::V-A3.9 正交（基底侧）＋tests/org-permissions.test.mjs::V-A3.9 正交（能力侧）",
    evidence: "org-permissions.test.mjs:151,172"
  },
  {
    id: "V-A3.10", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-ledger-authz.test.mjs::user principal 台账全权＋tests/ledger-host.test.mjs::HTTP 命令面拒绝缺 actor＋tests/org-human-inbox.test.mjs::终裁只能由 user 行使",
    evidence: "org-ledger-authz.test.mjs:165；ledger-host.test.mjs:365；org-human-inbox.test.mjs:182"
  },
  {
    id: "V-A4.1", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-op-set.test.mjs::工具面派生＋tests/org-op-set.test.mjs::执行面工具派生＋tests/org-op-set.test.mjs::registerPostTools＋tests/org-permissions.test.mjs::组织命令面零路径工具",
    evidence: "org-op-set.test.mjs:152,169,288；org-permissions.test.mjs:122"
  },
  {
    id: "V-A4.2", level: LEVEL_LABELS.resident,
    coordinate: "scripts/role-card-drift-check.mjs＋tests/role-cards.test.mjs::V-A4.2 构建期漂移校验＋tests/role-cards.test.mjs::V-A4.2 卡面不合规时拒绝生成基准",
    evidence: "role-cards.test.mjs:185,317；基准件 lib/org/role-card-digests.generated.json"
  },
  {
    id: "V-A4.3", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-op-set.test.mjs::简报不进系统提示段＋tests/org-post-channel.test.mjs::接单即得契约＋tests/org-post-channel.test.mjs::链式能力持有＋tests/task-ledger.test.mjs::接单响应携带简报",
    evidence: "org-op-set.test.mjs:178；org-post-channel.test.mjs:91,81；task-ledger.test.mjs:860"
  },
  {
    id: "V-A4.4", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-mail-shared-face.test.mjs::投递面写者名单闭合＋tests/org-mail-shared-face.test.mjs::负例可辨①＋tests/watcher.test.mjs",
    evidence: "org-mail-shared-face.test.mjs:47,100；watcher.test.mjs（投递与水位经 host 中继）"
  },
  {
    id: "V-A4.5", level: LEVEL_LABELS.resident,
    coordinate: "tests/ledger-host.test.mjs::knowledge.register 命令化＋tests/org-op-set.test.mjs::knowledge.register 升表＋tests/knowledge.test.mjs::registerKnowledgeTools＋tests/knowledge-shared-face.test.mjs::登记写者名单闭合＋tests/ledger-host.test.mjs::知识命令腿 actor 形状门＋tests/ledger-host.test.mjs::知识命令腿 actor 归属门＋tests/org-permissions.test.mjs::知识命令腿 actor 门",
    evidence: "ledger-host.test.mjs:588；org-op-set.test.mjs:255；knowledge.test.mjs:418；knowledge-shared-face.test.mjs:235；30 号票补腿内 actor 形状／归属门：ledger-host.test.mjs::知识命令腿 actor 形状门／归属门＋org-permissions.test.mjs::知识命令腿 actor 门（进命令面 leg 自带门，口径同源 isValidActor）"
  },
  {
    id: "V-A4.6", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-probe.test.mjs::白名单是封闭枚举＋tests/org-probe.test.mjs::runCriterion：参数键逐字一致＋tests/org-probe.test.mjs::criterionMatches＋tests/org-post-channel.test.mjs::探针路由 fail closed",
    evidence: "org-probe.test.mjs:44,51,60,242；org-post-channel.test.mjs:111"
  },
  {
    id: "V-A4.7", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-mail-client.test.mjs::通道不可用＋tests/org-mail-relay.test.mjs::语义失败各按其道＋tests/org-mail-relay.test.mjs::鉴权拒绝留痕＋tests/org-mail-shared-face.test.mjs::负例可辨③",
    evidence: "org-mail-client.test.mjs:53；org-mail-relay.test.mjs:142,165,312；org-mail-shared-face.test.mjs:124"
  },
  {
    id: "V-A4.8", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-vocabulary-face.test.mjs::真实仓库＋tests/org-vocabulary-face.test.mjs::负例可辨①＋tests/org-vocabulary-face.test.mjs::负例可辨②",
    evidence: "org-vocabulary-face.test.mjs:35,47,60"
  },
  {
    id: "V-A4.9", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-op-set.test.mjs::复核帽注册集不含写工具＋tests/org-op-set.test.mjs::registerPostTools＋tests/org-op-set.test.mjs::knowledge.register 升表",
    evidence: "org-op-set.test.mjs:164,288,262"
  },
  {
    id: "V-A5.1", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-human-inbox.test.mjs::只有三类裁定可进 waiting-user＋tests/org-human-inbox.test.mjs::上浮原因＝封闭枚举＋tests/org-human-inbox.test.mjs::告知投影＋tests/task-ledger.test.mjs::只有三类裁定进 waiting-user",
    evidence: "org-human-inbox.test.mjs:50,68,376,463；task-ledger.test.mjs:560,1002"
  },
  {
    id: "V-A5.2", level: LEVEL_LABELS.experiment,
    coordinate: "tests/org-human-inbox.test.mjs::收件箱＝台账事件投影＋tests/ledger-host.test.mjs::人间收件箱投递面＋tests/org-human-inbox.test.mjs::终裁只能由 user 行使＋演练:drill-human-inbox",
    evidence: "org-human-inbox.test.mjs:424,237,182；ledger-host.test.mjs:253"
  },
  {
    id: "V-A5.3", level: LEVEL_LABELS.experiment,
    coordinate: "tests/task-ledger.test.mjs::挂起语义＋tests/task-ledger.test.mjs::结算/关闭超时＋tests/org-human-inbox.test.mjs::业务截止时间到期只投影＋演练:drill-waiting-user",
    evidence: "task-ledger.test.mjs:1088,1139；org-human-inbox.test.mjs:110"
  },
  {
    id: "V-A5.4", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-human-inbox.test.mjs::初审代理边界＋tests/org-human-inbox.test.mjs::初审拒绝或判据两轮未闭合＋tests/task-ledger.test.mjs::永不可代三项＋tests/task-ledger.test.mjs::初审裁决执行面",
    evidence: "org-human-inbox.test.mjs:121,146,60,83；task-ledger.test.mjs:1039,1517,1454"
  },
  {
    id: "V-A5.5", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-human-inbox.test.mjs::终裁四式＋tests/org-human-inbox.test.mjs::终裁缺幂等键＋tests/task-ledger.test.mjs::终裁＝台账命令特化视图",
    evidence: "org-human-inbox.test.mjs:161,199,227；task-ledger.test.mjs:1199"
  },
  {
    id: "V-A5.6", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-human-inbox.test.mjs::裁定包五件齐备＋tests/org-human-inbox.test.mjs::裁定包缺件即拒＋tests/org-human-inbox.test.mjs::立场补齐句带机械事实标注",
    evidence: "org-human-inbox.test.mjs:275,360,335"
  },
  {
    id: "V-A6.1", level: LEVEL_LABELS.resident,
    coordinate: "门④＋tests/host-contract-gate.test.mjs::V-A6.1：登记表在位＋tests/host-contract-gate.test.mjs::V-A6.1：字段集齐备＋lib/host-faces.js",
    evidence: "host-contract-gate.test.mjs:30,41；登记表 lib/host-faces.js::validateHostFacesRegistry"
  },
  {
    id: "V-A6.2", level: LEVEL_LABELS.resident,
    coordinate: "门④＋tests/host-contract-gate.test.mjs::登记表↔门一致性＋tests/host-contract-gate.test.mjs::pending 面清零＋lib/host-faces.js",
    evidence: "host-contract-gate.test.mjs:60,68；A 类面 adapterModule 单一坐标（登记表不变量）"
  },
  {
    id: "V-A6.3", level: LEVEL_LABELS.resident,
    coordinate: "门④＋tests/host-contract-gate.test.mjs::V-A6.3：三态汇总＋tests/host-contract-gate.test.mjs::假绿修法",
    evidence: "host-contract-gate.test.mjs:79,125；三态协议 scripts/host-contract-probe.mjs；①汇总行分列 SKIP"
  },
  {
    id: "V-A6.4", level: LEVEL_LABELS.resident,
    coordinate: "门④＋tests/host-contract-gate.test.mjs::V-A6.4：版本仅诊断＋tests/host-contract-gate.test.mjs::18号票 P-CTX-SERVICES 行为化",
    evidence: "host-contract-gate.test.mjs:93,204；版本仅诊断字段（不作门）"
  },
  {
    id: "V-A6.5", level: LEVEL_LABELS.resident,
    coordinate: "门②＋门④＋scripts/host-contract-probe.mjs＋tests/preflight.test.mjs::门序（V-A6.5）",
    evidence: "scripts/preflight.mjs::statusLint／latestPackage／verifyFrozenFace 四门 AND；门序②→④由本模块测试把守（14 号票加固）"
  },
  {
    id: "V-A6.6", level: LEVEL_LABELS.resident,
    coordinate: "tests/host-contract-gate.test.mjs::V-A6.6：整层拒载仅限组织层身份面＋lib/host-faces.js",
    evidence: "host-contract-gate.test.mjs:52；登记表 LAYER_REFUSE_ONLY_FACE 不变量"
  },
  {
    id: "V-A6.7", level: LEVEL_LABELS.experiment,
    coordinate: "tests/ledger-host.test.mjs::探针失效以 class=duty 例程任务落台账承载＋tests/org-dispatch-config.test.mjs::探针失效例程的触发源核验＋演练:drill-probe-failure",
    evidence: "ledger-host.test.mjs::registerProbeFailure 回归；例程 lib/org/dispatch-config.js::duty-probe-failure"
  },
  {
    id: "V-A6.8", level: LEVEL_LABELS.probeResidentVisualExperiment,
    coordinate: "门④＋探针:P-CLIENT-SLOTS＋tests/host-contract-gate.test.mjs::18号票 P-CLIENT-SLOTS 行为化＋人工:human-visual-checklist",
    evidence: "host-contract-gate.test.mjs:498,237；人工目视清单 18 号票票面（实验期一次，须核验人署名）"
  },
  {
    id: "V-A7.1", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-durability.test.mjs::V-A7.1 白名单封闭枚举齐备＋tests/org-durability.test.mjs::V-A7.1 逐条过换模型试金石＋lib/org/durability.js",
    evidence: "org-durability.test.mjs:50,66,77,88,104；白名单 lib/org/durability.js::ORG_LAYER_WHITELIST"
  },
  {
    id: "V-A7.2", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-durability.test.mjs::V-A7.2 模型假设扫描可判＋tests/org-durability.test.mjs::V-A7.2 岗位细节三处封闭枚举齐备＋lib/org/durability.js",
    evidence: "org-durability.test.mjs:112,136,176,188,193"
  },
  {
    id: "V-A7.3", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-durability.test.mjs::V-A7.3 文档扫描：＋tests/org-durability.test.mjs::V-A7.3 判据坐标可解析带负例＋lib/org/durability.js",
    evidence: "org-durability.test.mjs:225,233,636,646；§J 扫描器 scanDurabilitySpec"
  },
  {
    id: "V-A7.4", level: LEVEL_LABELS.experiment,
    coordinate: "tests/org-durability.test.mjs::升级例程四步在案＋tests/org-durability.test.mjs::V-A7.4 端到端＋tests/org-durability.test.mjs::V-A7.4 触发源声明是承重的＋演练:drill-model-upgrade",
    evidence: "org-durability.test.mjs:284,302,375,413,480,528,663；登记腿 lib/org/ledger-host.js::registerModelUpgradeEval"
  },
  {
    id: "V-A7.5", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-memory-layer.test.mjs::记忆三层＋tests/org-memory-layer.test.mjs::组织常量导出确实存在＋tests/knowledge-shared-face.test.mjs::知识库根：长出第三面＋tests/org-permissions.test.mjs::L1 负例：知识库容器协议",
    evidence: "org-memory-layer.test.mjs:257,276；knowledge-shared-face.test.mjs:195,206,227"
  },
  {
    id: "V-A7.6", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-memory-layer.test.mjs::三问分流：本任务历史事实＋tests/org-memory-layer.test.mjs::推理过程任何面都不进＋tests/org-memory-layer.test.mjs::路由值域封闭",
    evidence: "org-memory-layer.test.mjs:29,35,40,46,53,66,76"
  },
  {
    id: "V-A7.7", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-memory-layer.test.mjs::晋升门槛三条齐备即通过＋tests/org-memory-layer.test.mjs::晋升门槛：任一不过＋tests/org-memory-layer.test.mjs::晋升强制性读面＋tests/org-brief.test.mjs::promotion",
    evidence: "org-memory-layer.test.mjs:88,96,110,122,131；简报契约 org-brief.test.mjs:116"
  },
  {
    id: "V-A7.8", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-memory-layer.test.mjs::失效动作值域封闭＋tests/org-memory-layer.test.mjs::自动失效形态一律拒＋tests/org-memory-layer.test.mjs::无访问热字段＋tests/knowledge.test.mjs::deprecateReport：显式废弃登记",
    evidence: "org-memory-layer.test.mjs:142,164,172,181；knowledge.test.mjs:170,187"
  },
  {
    id: "V-A7.9", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-memory-layer.test.mjs::知识与台账冲突＋tests/org-memory-layer.test.mjs::知识与岗位卡冲突＋tests/org-memory-layer.test.mjs::规格未定义的冲突对",
    evidence: "org-memory-layer.test.mjs:199,203,211,219"
  },
  {
    id: "V-A7.10", level: LEVEL_LABELS.resident,
    coordinate: "tests/org-memory-layer.test.mjs::移交件＝三件指针＋tests/org-memory-layer.test.mjs::移交只传指针：坐标条目夹带正文＋tests/org-memory-layer.test.mjs::工件归档不删档",
    evidence: "org-memory-layer.test.mjs:287,300,312,322,333"
  }
]);

/** 测试文件里的测试名（测试名即执行坐标；`run.mjs` 逐文件派生子进程执行）。
 *  跨行写法（`test(\n  "…"`）同样取到——坐标不许因排版而失配。 */
function testTitlesIn(fileText) {
  return [...fileText.matchAll(/test\(\s*"([^"]+)"/g)].map((match) => match[1]);
}

function readTextOrEmpty(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/**
 * 解析单个坐标记号到落点。返回 `{ok:true, kind}` 或 `{ok:false, reason}`——
 * **每种记号都解析到真实存在的落点**，解析不到即违例（坐标不得指向空气）。
 */
/**
 * 查询记号解析：只认三类**真实读面**（防「查询」二字成为指向空气的挡箭牌）——
 * ① 台账 HTTP 读面 `GET /api/pod/_ledger[/…]`（路由字面量须在 `lib/org/ledger-host.js` 内）；
 * ② 台账门面读方法 `ledger.<name>(…)`（方法须在 `lib/org/task-ledger.js` 门面定义处存在）；
 * ③ 模块＋符号 `lib/<模块>.js <符号>`（模块在仓内且符号在件内）。
 */
function resolveQueryToken(expr, repoRoot) {
  const http = expr.match(/^GET (\/api\/bots\/_ledger(?:\/[\w-]+)*)$/);
  if (http !== null) {
    const tail = http[1].slice("/api/pod/_ledger".length).replace(/^\//, "");
    const source = readTextOrEmpty(join(repoRoot, "lib", "org", "ledger-host.js"));
    if (tail === "") {
      return source.includes("host.ledger.view()")
        ? { ok: true, kind: "query-http" }
        : { ok: false, reason: "台账 HTTP 根读面未接线（ledger.view 不在 ledger-host 内）" };
    }
    return source.includes(`"${tail}"`)
      ? { ok: true, kind: "query-http" }
      : { ok: false, reason: `台账 HTTP 读面无此路由：${http[1]}` };
  }
  const ledgerCall = expr.match(/^ledger\.([A-Za-z][A-Za-z0-9]*)\(/);
  if (ledgerCall !== null) {
    const source = readTextOrEmpty(join(repoRoot, "lib", "org", "task-ledger.js"));
    return new RegExp(`^\\s{2,}${ledgerCall[1]}\\(`, "m").test(source)
      ? { ok: true, kind: "query-ledger" }
      : { ok: false, reason: `台账门面无此读方法：${ledgerCall[1]}` };
  }
  const moduleSymbol = expr.match(/^(lib\/[A-Za-z0-9/._-]+\.js) ([A-Za-z_$][\w$]*)$/);
  if (moduleSymbol !== null) {
    const [, file, symbol] = moduleSymbol;
    if (!existsSync(join(repoRoot, file))) return { ok: false, reason: `模块不存在：${file}` };
    // 词边界匹配：子串命中不算命中（"exis" 不得借 existsSync 假绿）
    const pattern = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return pattern.test(readTextOrEmpty(join(repoRoot, file)))
      ? { ok: true, kind: "query-module" }
      : { ok: false, reason: `${file} 内无符号 ${symbol}` };
  }
  return {
    ok: false,
    reason: `查询记号须为「GET /api/pod/_ledger…」｜「ledger.<读方法>(…)」｜「lib/<模块>.js <符号>」之一：${expr}`
  };
}

export function resolveCoordinateToken(token, { repoRoot = ".", drills = DRILL_WINDOWS, human = HUMAN_CRITERION_CATEGORIES } = {}) {
  const raw = String(token ?? "").trim();
  if (raw === "") return { ok: false, reason: "空记号" };
  if (GATE_IDS.includes(raw)) {
    // 门号实读验证：scripts/preflight.mjs 源内须有对应门的结论行模板——源里删门
    // （或本文件指错仓库）即红，不靠本地常量自觉
    const source = readTextOrEmpty(join(repoRoot, "scripts", "preflight.mjs"));
    const marker = `preflight ${raw.replace(/^门/, "")}`;
    return source.includes(marker)
      ? { ok: true, kind: "gate" }
      : { ok: false, reason: `scripts/preflight.mjs 源内无「${marker}」结论行模板（门号与源漂移或源缺失）` };
  }
  if (raw.startsWith("门")) return { ok: false, reason: `门号不在四道门内：${raw}` };
  const test = raw.match(/^tests\/([A-Za-z0-9._-]+\.test\.mjs)(?:::([\s\S]+))?$/);
  if (test !== null) {
    const [, file, fragment] = test;
    const absolute = join(repoRoot, "tests", file);
    if (!existsSync(absolute)) return { ok: false, reason: `测试文件不存在：tests/${file}` };
    if (fragment === undefined) return { ok: true, kind: "test-file" };
    const titles = testTitlesIn(readTextOrEmpty(absolute)).filter((title) => title.includes(fragment));
    if (titles.length === 0) return { ok: false, reason: `tests/${file} 内无标题含「${fragment}」的测试` };
    if (titles.length > 1) return { ok: false, reason: `tests/${file} 内标题含「${fragment}」的测试有 ${String(titles.length)} 条（坐标须唯一）` };
    return { ok: true, kind: "test" };
  }
  const script = raw.match(/^scripts\/[A-Za-z0-9._-]+\.mjs$/);
  if (script !== null) {
    return existsSync(join(repoRoot, raw))
      ? { ok: true, kind: "script" }
      : { ok: false, reason: `脚本不存在：${raw}` };
  }
  const module = raw.match(/^lib\/[A-Za-z0-9/._-]+\.(?:js|cjs)$/);
  if (module !== null) {
    return existsSync(join(repoRoot, raw))
      ? { ok: true, kind: "module" }
      : { ok: false, reason: `模块不存在：${raw}` };
  }
  const query = raw.match(/^查询:([\s\S]+)$/);
  if (query !== null) return resolveQueryToken(query[1].trim(), repoRoot);
  const probe = raw.match(/^探针:([A-Za-z0-9-]+)$/);
  if (probe !== null) {
    const registry = readTextOrEmpty(join(repoRoot, "lib", "host-faces.js"));
    return registry.includes(`"${probe[1]}"`)
      ? { ok: true, kind: "probe" }
      : { ok: false, reason: `探针 id 不在宿主适配面登记表内：${probe[1]}` };
  }
  const drill = raw.match(/^演练:([a-z0-9-]+)$/);
  if (drill !== null) {
    return drills.some((entry) => entry.id === drill[1])
      ? { ok: true, kind: "drill" }
      : { ok: false, reason: `演练未登记执行窗口：${drill[1]}` };
  }
  const humanToken = raw.match(/^人工:([a-z0-9-]+)$/);
  if (humanToken !== null) {
    return human.some((entry) => entry.id === humanToken[1])
      ? { ok: true, kind: "human" }
      : { ok: false, reason: `人工判据不在白名单：${humanToken[1]}` };
  }
  return { ok: false, reason: `记号形状不认（不在坐标文法内）：${raw}` };
}

/** 坐标串 → 记号数组（`＋` 为分隔符；空串＝无坐标）。 */
export function splitCoordinate(coordinate) {
  return String(coordinate ?? "").split("＋").map((token) => token.trim()).filter((token) => token !== "");
}

/**
 * 坐标表自校验（不依赖规格）：id 封闭枚举齐备、级别在词表内、坐标记号逐条可解析、
 * 实验期一次条目必须登记演练、人工判据只许用白名单 id、演练登记项反向可核。
 */
export function validateAcceptanceCoordinates({
  repoRoot = ".", rows = A_GROUP_COORDINATES, drills = DRILL_WINDOWS, human = HUMAN_CRITERION_CATEGORIES
} = {}) {
  const violations = [];
  const ids = rows.map((row) => row?.id);
  for (const id of REQUIRED_CRITERION_IDS) {
    if (!ids.includes(id)) violations.push(`坐标表缺判据 ${id}（A 组坐标空缺：切换批前置判据不满足）`);
  }
  for (const id of ids) {
    if (!REQUIRED_CRITERION_IDS.includes(id)) violations.push(`坐标表含表外判据 ${String(id)}（新增判据须走规格修订）`);
  }
  const levels = new Set(Object.values(LEVEL_LABELS));
  const seen = new Set();
  for (const row of rows) {
    const id = row?.id ?? "(缺 id)";
    if (seen.has(id)) violations.push(`${id}: 坐标表 id 重复`);
    seen.add(id);
    if (!levels.has(row?.level)) violations.push(`${id}: 级别不在词表内（${String(row?.level)}）`);
    if (typeof row?.evidence !== "string" || row.evidence.trim() === "") violations.push(`${id}: 缺证据落点摘记`);
    const tokens = splitCoordinate(row?.coordinate);
    if (tokens.length === 0) {
      violations.push(`${id}: 执行坐标为空（A 组坐标无空缺即一条都不许空）`);
      continue;
    }
    for (const token of tokens) {
      const resolved = resolveCoordinateToken(token, { repoRoot, drills, human });
      if (!resolved.ok) violations.push(`${id}: 坐标记号「${token}」不可解析——${resolved.reason}`);
    }
    // 判级不变量：常驻判据＝随每批回归执行的测试模块——坐标里没有 tests/ 记号即空缺
    if (row?.level === LEVEL_LABELS.resident && !tokens.some((token) => token.startsWith("tests/"))) {
      violations.push(`${id}: 常驻判据坐标须含测试模块（tests/…）——只有门号或查询不算常驻执行面`);
    }
    if (row?.level === LEVEL_LABELS.experiment && !tokens.some((token) => token.startsWith("演练:"))) {
      violations.push(`${id}: 实验期一次条目的坐标须登记演练执行窗口（缺 演练:<id>）`);
    }
  }
  for (const entry of human) {
    if (typeof entry?.verifier === "string" && entry.verifier.trim() !== "" && entry.verifierStatus !== "signed") {
      violations.push(`人工判据 ${entry.id}: 有核验人署名但状态未翻 signed（署名与状态须同拍）`);
    }
  }
  const drillIds = drills.map((entry) => entry.id);
  for (const entry of drills) {
    if (!Array.isArray(entry?.criterionIds) || entry.criterionIds.length === 0) {
      violations.push(`演练 ${String(entry?.id)}: 未点名所属判据`);
    }
    for (const id of entry?.criterionIds ?? []) {
      if (!REQUIRED_CRITERION_IDS.includes(id)) violations.push(`演练 ${entry.id}: 点名了表外判据 ${String(id)}`);
    }
    for (const field of ["name", "window", "carrier", "evidenceLanding"]) {
      if (typeof entry?.[field] !== "string" || entry[field].trim() === "") {
        violations.push(`演练 ${entry.id}: 缺 ${field}（执行窗口登记须四件齐备）`);
      }
    }
  }
  if (new Set(drillIds).size !== drillIds.length) violations.push("演练 id 重复");
  // 演练登记↔判据行 双向对账：登记在册但无任何判据行引用＝登记表漂移（删登记或补引用）
  const referencedDrillIds = new Set(
    rows.flatMap((row) => splitCoordinate(row?.coordinate)
      .filter((token) => token.startsWith("演练:"))
      .map((token) => token.slice("演练:".length)))
  );
  for (const entry of drills) {
    if (!referencedDrillIds.has(entry.id)) {
      violations.push(`演练 ${entry.id}: 登记在册但无任何判据行引用（登记表漂移——删登记或补引用）`);
    }
  }
  return { ok: violations.length === 0, scanned: rows.length, violations };
}

/**
 * A 组小节原文（标题起至下一个三级标题前）——**不归一空白**（解析要按行），与
 * `specSection` 的空白归一形态用途不同：那边比判据表述，这边切表行。小节缺失＝""。
 */
function appendixARawSection(specText) {
  const text = String(specText ?? "");
  const start = text.indexOf(APPENDIX_A_HEADING);
  if (start === -1) return "";
  const rest = text.slice(start + APPENDIX_A_HEADING.length);
  const next = rest.search(/\n#{2,3} /);
  return next === -1 ? rest : rest.slice(0, next);
}

/** 判据表行识别（解析与回写共用同一形状——两处各写一份必漂移）。 */
function criteriaRowCells(line) {
  if (!line.startsWith("|")) return null;
  const cells = line.split("|");
  const idMatch = (cells[1] ?? "").match(/^\s*`(V-A[1-7]\.[0-9]+)`\s*$/);
  if (idMatch === null) return null;
  return { cells, id: idMatch[1] };
}

/**
 * 解析规格附录 A 的 A 组表 → `{id, criterion, coordinate, evidence, level}` 行数组。
 * **只在 A 组小节内解析**（小节外同名行不吃进来）；小节缺失＝空数组（调用方报违例，
 * 不静默通过）。
 */
export function parseCriteriaTable(specText) {
  const section = appendixARawSection(specText);
  if (section === "") return [];
  const rows = [];
  for (const line of section.split("\n")) {
    const row = criteriaRowCells(line);
    if (row === null) continue;
    rows.push({
      id: row.id,
      criterion: (row.cells[2] ?? "").trim(),
      coordinate: (row.cells[3] ?? "").trim(),
      evidence: (row.cells[4] ?? "").trim(),
      level: (row.cells[5] ?? "").trim()
    });
  }
  return rows;
}

/**
 * 规格附录 A ↔ 坐标表的**双向锁定**（`V-A7.3` 的 §J 锁同型）：
 *   - id 集等值（少一条＝坐标空缺；多一条＝表外判据）；
 *   - 每条的执行坐标单元格与级别单元格与本表逐字一致（空白无关归一）；
 *   - 判据文本非空（判据语义在规格侧冻结，本模块不复制、不改写）。
 */
export function scanAcceptanceSpec(specText, rows = A_GROUP_COORDINATES, baseline = ACCEPTANCE_SEMANTICS_BASELINE) {
  const parsed = parseCriteriaTable(specText);
  const violations = [];
  if (parsed.length === 0) {
    violations.push(`规格附录 A 小节缺失或不可解析（${APPENDIX_A_HEADING}）——坐标回写无处核对`);
    return { ok: false, scanned: 0, violations };
  }
  if (!/^[0-9a-f]{64}$/.test(baseline)) {
    violations.push("判据语义基线形状非法（须 64 位十六进制摘要）——基线被清空或占位即 fail closed");
  } else {
    const digest = acceptanceSemanticsDigest(parsed);
    if (digest !== baseline) {
      violations.push(
        `判据语义摘要不符（现 ${digest} ≠ 基线 ${baseline}）——判据／证据落点／级别列被改动；`
        + "坐标列之外只许走显式修订：更新基线常量＋CHANGELOG 记新摘要与授权依据"
      );
    }
  }
  const specIds = parsed.map((row) => row.id);
  for (const id of REQUIRED_CRITERION_IDS) {
    if (!specIds.includes(id)) violations.push(`规格附录 A 缺判据 ${id}`);
  }
  for (const id of specIds) {
    if (!REQUIRED_CRITERION_IDS.includes(id)) violations.push(`规格附录 A 含表外判据 ${id}`);
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const specRow of parsed) {
    const row = byId.get(specRow.id);
    if (row === undefined) continue;
    if (specRow.criterion === "") violations.push(`${specRow.id}: 规格侧判据文本为空`);
    if (normalizeSpecText(specRow.coordinate) !== normalizeSpecText(row.coordinate)) {
      violations.push(
        `${specRow.id}: 规格执行坐标与坐标表不一致（规格「${specRow.coordinate}」≠ 表「${row.coordinate}」）`
        + "——坐标只许两处同拍，回写走 scripts/acceptance-coordinates-sync.mjs"
      );
    }
    if (normalizeSpecText(specRow.level) !== normalizeSpecText(row.level)) {
      violations.push(`${specRow.id}: 规格级别（${specRow.level}）与坐标表（${row.level}）不一致`);
    }
  }
  return { ok: violations.length === 0, scanned: parsed.length, violations };
}

/**
 * 附录 A 坐标回写：把坐标表的执行坐标／级别单元格**原样**写回规格表（逐行替换第三、
 * 五列），返回新规格文本。判据文本与证据落点列不动（判据语义冻结在规格侧）。
 */
export function rewriteAppendixA(specText, rows = A_GROUP_COORDINATES) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return String(specText ?? "").split("\n").map((line) => {
    const recognized = criteriaRowCells(line);
    const row = recognized === null ? undefined : byId.get(recognized.id);
    if (row === undefined) return line;
    recognized.cells[3] = ` ${row.coordinate} `;
    recognized.cells[5] = ` ${row.level} `;
    return recognized.cells.join("|");
  }).join("\n");
}
