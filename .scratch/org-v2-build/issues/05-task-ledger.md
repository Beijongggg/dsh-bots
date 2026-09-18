# 05: 任务台账面

**What to build:** 任务升格为一等对象。host 侧 **append-only 事件日志、单一写者**；**状态是事件
序列的投影**，清空内存态重启后可从事件重建未闭合队列；任务 id 为 provenance 根（v2 用新前缀，
旧评审前缀随形态退役）。主干十态（`intake → triaged → planned → assigned → accepted → running →
produced → delivered → settled → closed`）＋四旁路（`blocked`／`waiting-user`／`failed`／
`cancelled`），**每个状态必须能回答「下一步谁负责、超时怎么办」**，答不出即删。合法转移由确定性
层校验（含 CAS 期望状态不符即拒），LLM 岗位只提交判断输入、**不得直接写状态**；命令自带幂等键。
归属＝`owner + lease + heartbeat`：派单以 CAS 写归属，逾期未接自动释放回队列并通知派单方，
租约到期或实例死亡自动回收、**重派封顶后上浮用户**；一实例同时只持一个进行中任务，第二次归属
机械拒绝。**通知＝台账事件投影，无事件不通知**。异常四类（实例死亡／任务停滞／等待用户／等待
外部依赖）统一走台账、**不静默丢失**，并修掉 v1 两处静默丢失（收单队列超限截断、回合失败不重试）。
值守例程＝声明式登记项，触发幂等键＝「例程 id＋时间窗」。SSE 新增 `ledger` 事件承载台账投影。
bot 侧**无台账文件直写通道**。

时限 T 与重派封顶 N 的**数值属用户域**，规格只要求「必须有这两项与可配置的缝」。

规格出处：`.scratch/org-v2/spec.md` §B 与附录 A `V-A2.1`–`V-A2.3`、`V-A2.5`、`V-A2.6`、
`V-A2.9`–`V-A2.12`。

**Blocked by:** 02（台账长在拆出的 store 底座与 capability 原语上）

**Status:** resolved

- [x] 台账＝host 侧 append-only 事件日志、单一写者；bot 无文件直写通道（`V-A2.1`）
- [x] 状态为事件投影：清空内存态重启后可从未闭合队列的事件重建（`V-A2.2`）
- [x] 主干十态＋四旁路齐备，每态可回答「下一步谁负责、超时怎么办」（`V-A2.3`）
- [x] 非法转移由确定性层拒绝；CAS 期望状态不符即拒（`V-A2.3`）
- [x] 派单租约：逾期未接自动释放回队列并通知派单方；租约到期回收；重派封顶后上浮（`V-A2.5`）
- [x] 一实例同时只持一个进行中任务，第二次归属被机械拒绝（`V-A2.6`）
- [x] 关闭不可重开、归档不删档；改动用 `supersedesTaskId` 开新任务（`V-A2.9`）
- [x] 值守例程按「例程 id＋时间窗」幂等，重复触发不产生第二任务（`V-A2.10`）
- [x] 异常四类统一走台账、无静默丢失；v1 两处静默丢失在 v2 不再存在（`V-A2.11`）
- [x] 通知＝台账事件投影，无事件不通知（`V-A2.12`）
- [x] `ledger` SSE 事件承载台账投影（人间收件箱的数据源）
- [x] 全量回归 PASS

## Comments

### 落地件与坐标（2026-09-16 实施批）

- **台账本体** `lib/org/task-ledger.js`（组织层件，长在 02 号票拆出的
  `lib/org/store-base.js` 上：写锁／epoch fencing／原子追加／幂等预留索引／hash 链）：
  `MAIN_FLOW`／`BYPASS_STATES`／`STATE_RESPONSIBILITY`（每态两问）／`TRANSITIONS`
  （目标状态只由事件类型决定）／命令面 `command()`（合法性＋CAS＋幂等＋角色与归属约束）／
  `judgement()`（LLM 只提交判断输入）／`raiseException()`（异常四类）／`triggerRoutine()`
  （例程 id＋时间窗幂等）／`sweep()`（回收与上浮）／`openQueue()`（重启重建）／
  `notificationsAfter()`（通知投影）／`view()`（SSE 载荷）。
- **宿主接线** `lib/org/ledger-host.js`：`createLedgerHost`（值守轮询＋异常汇入＋广播）、
  `createLedgerHttpApi`（`GET /api/bots/_ledger[/tasks|/notifications?cursor=]`、
  `POST /api/bots/_ledger/commands`）；`lib/index.js` 仅在**主 web 分支**构造台账并注册
  `ctx.effect` 值守（bot 实例不构造、无写入面）。
- **投递面读取** `lib/mail-plane.js`：新增 `readReceipts`／`listMailAnomalies`（只报本时间窗
  新增项，避免旧条目反复告警）。
- **测试坐标**：`tests/task-ledger.test.mjs`（18 条：状态表/责任表、主干转移、非法转移、CAS、
  幂等、重启重建、单写者锁、终态不可重开与 `supersedesTaskId`、一实例一任务、租约三条回收路径、
  重派封顶上浮、心跳续签、例程幂等、judgement 不改状态、异常四类、通知投影、篡改 fail closed）；
  `tests/ledger-host.test.mjs`（6 条：异常汇入与幂等、只报本窗、值守轮询与广播、HTTP 面、
  只读不写、宿主/bot 分支 effect 归属）。
- **宿主契约面**（01 号票留给本票的接线项）：`HF-V2-LEDGER-FORMAT`／`HF-LEDGER-COMMANDS`
  **由 pending 转常驻**，探针 `P-V2-LEDGER-FORMAT`／`P-LEDGER-COMMANDS` 落地——
  preflight ④ 宿主契约门 9 → **11 PASS / 0 FAIL / 0 SKIP**，**pending 清零**。

### 留界（逐条，归他票）

1. **命令面的身份三元组鉴权与 capability 签发归 06**：本票只交付确定性层的合法性／CAS／
   幂等，以及「状态不由调用方直写」的形状。在此之前命令面的 `actor` 由请求声明（变更方法受
   既有 CSRF 令牌门控），沿用本机部署假设（F-RV-28 同一口径）；06 落地三元组后该声明面收敛。
2. **四要素简报的字段校验归 07**：本票 `brief` 原样存储（只作为任务对象字段），判据可执行性与
   字段非空校验属 07。
3. **v1 两处静默丢失的处置边界**：本票完成「**不再静默**」——收单积压超限截断（receipt
   `skipped-stale`）与回合失败（`[bot error]` 回复，前缀常量化后两侧共用）由 host 值守汇入台账：
   每类异常开一张常设处置任务（`duty-anomaly-<source>`，窗＝异常源身份即 botId＋来源），异常本体
   作 `exception` 事件（条目级幂等键＝内容哈希），通知投影随之推给用户。**未做的两半**：①截断点
   本身仍受 `MAIL_BACKLOG_LIMIT` 约束（本票只保证被截断的条目**入账可见**，队列→台账任务化＝
   11 号票 mail 形态改造，关联键改 `taskId`）；②**bot 回合内重试**留 11（涉及 bot 执行路径与
   receipt 语义，本票不动 bot 回合执行路径）。
4. **`V-A1.4` 类全量不变量与 op-set 岗位表归 06**（本票只提供 `post`／任务域绑定的缝）。
5. **`V-A2.4`／`V-A2.7`／`V-A2.8`（四要素简报形状、结算关闭前置、投递层要求）**：分属
   07（简报与派单）与 11（mail 形态）——本票的 `close` 转移只保证「关闭不可重开、归档不删档」。
6. **值守例程的声明式登记项归 07**：规格 §B 的「例程 id／触发条件或周期／简报模板／预算缝」
   组织常量登记表本票未建——本票只交付**触发面与幂等**（`triggerRoutine`：幂等键＝例程 id＋
   时间窗，重复触发不产生第二任务）；登记表与模板／预算缝随 07（四要素简报与派单）落地。
7. **超时执行面分票**：`STATE_RESPONSIBILITY` 每态的 onTimeout 是**处置的确定性表述**，本票
   已执行在手状态（assigned/accepted/running/produced）三条（`sweep`）；队列滞留超时（intake／
   triaged／planned）归 07、结算/关闭超时归 07／09、blocked 超时上浮归 07／08。
8. **收单确定性规则表与「直办」的执行形态归 07**：本票只做分诊四值的合法性与确定性状态映射
   （直办／立项 → `triaged`，澄清 → `waiting-user`，拒收 → `cancelled`）；「命中规则表／例程即
   直办」的匹配逻辑不在台账状态机内。
9. **amend 的简报冻结语义归 07**：本票提供 `amend` 事件与「通知承接方」的通知路由，`brief`
   原样存储（不做字段校验）。
6. **部署**：本批新增组织层两件并改 `lib/index.js`／`lib/mail-plane.js`／`lib/host-faces.js`／
   `scripts/host-contract-probe.mjs`——部署同步与重启链受 `AGENTS.md` §2 逐项点名约束，
   **本票零部署动作**；v2 部署清单须在切换批（16 号票）重对账。

### 评审与修复（2026-09-16 `/code-review` 双轴并行）

- **Spec 轴**发现（均已在票内修复）：①**P0**：命令面缺 `actor` 时会把不合规事件写进事实源，
  读侧随即永久判损坏（经 HTTP 面可达）→ 修为写前 schema 校验＋`judgement`/`raiseException`
  收敛为命令面薄包装＋命令体形状校验；②`amend` 通知收件人解析错误（通知了改动发起人而非承接方）
  → 改为任务在手者；③CAS 序号由可选改**必填**（§D 期望状态与序号两件）；④§B 分诊四值落地并校验。
- **Standards 轴**发现（均已在批内修复）：⑤事件 schema/hash 校验复用共用件 `createEventSourcing`
  （02 号票纪律），只保留台账域附加校验；⑥值守轮询体迁出 `lib/index.js` 以守「本文件只做接线」；
  ⑦删去与读路径重复且无生产调用方的 `readLedgerView`；⑧幂等前置三处去重；⑨回合失败前缀常量化
  共用；⑩值守 disposer 释放写锁。
- **评审留界（未改，理由在案）**：`STATE_EVENT_TARGET`／`ALLOWED_FROM`／`EVENT_EXTRA_KEYS`／
  `NOTIFY_TO`／`OPS` 五张表按事件类型分别维护（新增一个事件类型需动五处）——这是「确定性层
  表驱动」的显式代价，换取机械可校验；接受。

### 评审补修（2026-09-18 `/code-review` 全批重审，固定点 `326f4d8...HEAD`）

- **Spec 轴发现（已修）**：`task.wait-user` 缺归属约束——原任意 post 实例可把他人任务挂成
  `waiting-user`（该态无超时自动动作＝可被无限期冻结），与 `task.block`（`ownerOnly`）及票面
  自述「承接类转移只许当前归属者」不一致 → OPS 表补 `postOwnerOnly`：post 触发须归属者本人，
  host／user（上浮终裁／用户域裁定，规格 §F）照旧放行；新增回归用例（非归属 post 拒且留痕、
  归属者 post／host／user 三类触发放行）。
- **边界如实化（不改行为）**：「拒绝 fail closed 并落 `command-rejected` 事件」不含结构性拒绝
  四类（unknown-op／invalid-task-id／invalid-actor／缺幂等键）——只回执不落账：前两类无法归
  到任务流、后两类无可信幂等锚点，落账反成写放大面；模块头注已明示，全量拒绝落账语义归
  06 号票（`V-A3.6`）。
- **Standards 轴发现（已修）**：`loadTask`／`ledger.task()`／`command()` 三处「存在性＋投影＋
  抛损坏」重复收敛为 `findTask(events, taskId)`，并修 `command()` 投影损坏时 `existing` 为
  `undefined`（非 `null`）的隐性不一致（`supersedes` 查旧任务与 `foldAll` 同收——损坏现统一为
  `ledger-corrupt` 回执或读侧抛）；`buildEvent` 内「来态留痕」注释漂移修正（实际注入点在
  `appendStateEvent`）。
- **留观（不修）**：`reject()` 前四参（taskId／actor／idempotencyKey／op）Data Clump——单文件
  私有 helper、约 18 个调用点纯机械改动，回归风险大于收益。
- 验证：`TMPDIR=/dev/shm npm test` 62/62（task-ledger 23 条）；preflight 四道门 ①62/62 ②9/9
  ③0 违例 ④11 PASS / 0 FAIL / 0 SKIP ＝ PASS。

### 授权依据

2026-09-16 用户 `/implement` 调用（并明示「另有并行对话在工作不要误领」——本票与并行对话在
制品（岗位卡面文件）错开领取；01／02／04 已由他批入库）。
