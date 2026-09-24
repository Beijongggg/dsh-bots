# 26: 派单决策缝——「派给谁」没有确定性依据

**What to build:** 现树里没有一条可复用的确定性派单决策。`task.assign` 的 `assignee` 由调用方
（现在是人或测试）直接给字符串；唯一的岗位选择器是 `lib/org/review-kit.js::selectReviewer`，
它只服务复核者（当次空闲＋排除产出方），而且只被测试调用，没接进宿主。

后果：一张项目任务「派给谁」在机械面上没有依据——派单这个组织动作在验收时只能证明命令面连通，
证明不了它有确定性规则。14 号票的烟测因此只能在测试里手写 `assignee: "implementer"`。

**形态建议（开工时先定并写进 Comments）**：

1. 派单决策做成**纯函数**（照 `selectReviewer` 的先例）：输入候选实例表（注册表行）、在手查询
   （`ledger.holdingsFor`）、岗位缺口（13 号票 `role-cards.js::minimalRosterState`），输出选中者
   **加一条可核的理由**（为什么是它）。没有可派对象就返回 null，调用方 fail closed，不静默指派。
2. 承接能力按岗位判：岗位卡与 op-set 表已经是单一源（`DELIVERY_POST_OPS` 一类），候选筛选要
   与它同源，不另抄一份名单。
3. 收单规则表 `lib/org/dispatch-config.js::INTAKE_RULES` 仍是空集。空集是**如实**的现状，不是
   缺陷；本票只做派单决策缝，不为了填表而编规则条目（机制先行、无虚条目）。
4. 接线：宿主在 assign 前调用决策面；未接线时保持现状（调用方给 assignee），并在票面写明哪些
   路径已接线、哪些没有。

**与既有判据的关系**：`V-A2.6`（一实例同时只持一个进行中任务）、`V-A1.4`（一实例一 home 岗位、
可被借用）、13 号票编制契约（双席起步）。落点应落成常驻测试模块，并回写附录 A 相应条目的执行
坐标（走 `scripts/acceptance-coordinates-sync.mjs`）。

规格出处：`.scratch/org-v2/spec.md` §B（归属与租约、收单命中规则表即直办）与 §A（岗位集与分工）。

来源：14 号票 recon 发现 G2（`.scratch/org-v2-build/attachments/14-recon/smoke-surface.md`），
14 号票 Comments「recon 余项」。

**Blocked by:** 无

**Status:** resolved

## Comments

### 开工前定死（2026-09-24 `/implement 26`，形态建议 1–4 落地口径）

1. **纯函数形态**：`lib/org/dispatch-decision.js::selectAssignee({ candidates, holdingsFor, rosterState, table })`
   → `{ botId, post, reason } | null`。`candidates`＝注册表行数组（`{ botId|id, post }` 双兼容：
   注册表现实 `id`、既有选择器先例 `botId`，两者任一在场即认）；`holdingsFor` 必填（缺即抛，
   照 `selectReviewer` 先例）；`rosterState` 可选（`minimalRosterState` 产物，仅进理由陈述编制缺口，
   **不参与排序**——不发明优先级规则，机制先行）；`table` 可选注入（缺省 `OP_SET`）。
   输入序即优先级（注册表序确定性首中，照 `selectReviewer` 先例）；无可派返回 bare `null`
   （调用方 fail closed，不静默指派）。
2. **承接能力同源**：可承接＝`table[post]` 含 `task.accept`（派单→接单握手的最小代表；
   今日即 researcher／implementer，两岗 `DELIVERY_POST_OPS` 同源）。不另抄名单、不硬编码岗名；
   岗表增减承接岗时本面同拍（对账以 `OP_SET` 为准，口径与 `tableOpsForKind`／签发对账同源）。
3. **不编规则条目**：`INTAKE_RULES` 保持空集（现状如实），本票加锁定测试防误填。
4. **接线**：本票**不接宿主**——保持现状（调用方给 `assignee`，台账 `assignee-holding` 权威门不变）；
   本面只提供可复用决策供宿主在 `assign` 前调用。已接线路径：无。未接线路径：全部现存 `task.assign`
   调用（含烟测手写 `assignee: "implementer"`）。将来接线时宿主读注册表＋`holdingsFor`＋
   `minimalRosterState` 调本函数即可，届时另票写明。
5. **复审处置补记（2026-09-24 `/code-review` 双轴，见本票 Comments 下节）**：
   - 辅助导出 `ASSIGN_ELIGIBLE_OP`／`isDispatchEligible` 为本缝授权实现面（op 名单一源＋共享谓词，
     非票外行为；Standards 轴已确认非 Middle Man）。
   - `botId`／`id` 并存冲突口径：`botId` 胜出（选择器先例口径；已落代码注）。
   - `V-A1.4` 不动理由：本面读 home `post`（即 `V-A1.4` 契约主键），借用不变量（`availableOps`）
     属 op-set／capability 域，不在派单选择内；故坐标只挂 `V-A2.6`。
   - `V-A2.6` 挂载理由：决策时敬让（选空闲）与台账门权威（`assignee-holding` 拒绝）是同一不变量
     的两道 enforcement；纯选择器＋注入 `holdingsFor` 作坐标有 `V-A1.3` 先例
     （`帽选择：台账查询腿`同型），生产接线时 `holdingsFor` 即 `ledger.holdingsFor` 同源。
   - 同源链：`ROLE_CARDS`→`OP_SET`→本面（`OP_SET` 已由 `validateOpSet` 以岗位卡为源校验；
     本面直引 `ROLE_CARDS` 属重复派生）。默认表下未知 slug 即不可派（有测试锁定）。

- [x] 派单决策纯函数：候选＋在手＋编制缺口 → 选中者＋可核理由；无可派对象返回 null
- [x] 承接能力与岗位卡／op-set 同源，不另抄名单
- [x] 不编规则条目：`INTAKE_RULES` 保持现状或在票面说明增补依据
- [x] 宿主接线（若做）与未接线路径都在票面写清
- [x] 常驻测试模块＋附录 A 坐标回写
- [x] 全量回归与 preflight 四道门 PASS

### 实施与验证（2026-09-24 `/implement 26` 收口）

- **实现**：`lib/org/dispatch-decision.js`（`selectAssignee`＋`ASSIGN_ELIGIBLE_OP`／
  `isDispatchEligible`）＋`tests/org-dispatch-decision.test.mjs`（5 条）；
  `V-A2.6` 坐标扩一项并经 `scripts/acceptance-coordinates-sync.mjs --write` 回写规格附录 A
  （60/60 同拍；判据文本／证据／级别零改动，语义摘要基线不受影响）。
- **验证**：TDD 首用例先红（`ERR_MODULE_NOT_FOUND`）后绿；单文件 5/5；全量 63/63；
  preflight 四门 PASS（①63/63 ②0009 包 7/7 ③0 违例 ④11 PASS/0 FAIL/0 SKIP）。
  冻结面零改动；运行面零写入（隔离子进程执行：`tests/run.mjs` 逐文件 spawn＋preflight 内 spawn）。
- **复审**：`/code-review` 双轴（固定点 `4b57d3e`）——Standards 无硬违例／judgement 2
  （1 修 1 留）；Spec 缺失 1／越权 1／不符 3（2 修 4 留，理由见本票 Comments ⑤）。
  凭据见 CHANGELOG 顶部 26 号票条目。
