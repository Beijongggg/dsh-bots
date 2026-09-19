# 09: 人间接口与人间收件箱

**What to build:** 只有**三类**裁定进 `waiting-user`：不可逆写入的放行／上浮终裁（冲突、复核两轮
未闭合、越权处置）／用户域裁定请求（模型指派、预算等）；其余到人事件（交付回笼、取消失败、越权
计数）＝**纯告知、不挂起**。投递面＝**人间收件箱**（台账 `waiting-user` 与通知事件的直接投影，
内嵌终裁操作）；mail＝可选出仓库只读转发，**回文永不构成裁定**。等待语义：**无超时自动动作**，
挂起无限期、**不占租约、不烧 token**；唯一例外类是简报边界声明的业务截止时间到期→投影「已过期」
供用户清理，**仍不自动取消**。**终裁＝普通台账命令的特化视图**（`actor=user` 的接单/驳回/推迟/
授权修复，继承幂等键、CAS 与事件审计），**不另起第四套命令面**。**裁定包五件**＝冻结版简报／触发
上浮的判据事实／双方立场各一句＋全轨迹指针／可选动作清单及后果／模型身份，不自动附全文工件。
**验收初审代理**：可处置未命中必审清单的产出；命中清单的只可整理裁定包；初审拒绝或判据两轮未
闭合强制上浮；**模型指派、越权处置、冲突仲裁三项永不可代**。

规格出处：`.scratch/org-v2/spec.md` §F 与附录 A `V-A5.1`–`V-A5.6`。

**Blocked by:** 06（终裁即台账命令，需 user principal 与鉴权面）、07（裁定包的冻结简报）

**Status:** resolved

- [x] 只有三类裁定进 `waiting-user`，其余到人事件纯告知不挂起（`V-A5.1`）
- [x] 投递面＝台账事件投影的人间收件箱、内嵌裁定操作；mail 回文永不构成裁定（`V-A5.2`）
- [x] `waiting-user` 无超时自动动作；业务截止时间到期只投影「已过期」，不自动取消（`V-A5.3`）
- [x] 初审代理边界成立；三项（模型指派／越权处置／冲突仲裁）永不可代（`V-A5.4`）
- [x] 终裁＝台账命令特化视图，继承幂等键、CAS 与事件审计，不另起命令面（`V-A5.5`）
- [x] 裁定包五件齐备（`V-A5.6`）
- [x] `waiting-user` 不占租约、不烧 token，且可恢复
- [x] 全量回归 PASS

**交接**：前端实现形态归 Out of scope（UI polish），本票只定「投递面＝事件投影＋可裁定」的契约。

## Comments

- 2026-09-19 领票（用户 `/implement` 调用＝授权依据）：领票时工作树净（仅无关未跟踪
  `.video_agent/`），01–08＋15＋18 已入库、本票为 frontier 首票（`Blocked by` 06／07
  均已 resolved），无并行在制品。按 /implement＋/tdd 执行。
- 测试接缝预核（/tdd 纪律；2026-09-19 用户 AskUserQuestion 确认「按预核清单执行」；
  接缝源＝规格 Testing Decisions「人间接口」模块清单＋附录 A `V-A5.1`–`V-A5.6` 执行
  坐标，非本会话新立）：
  - 新建 `tests/org-human-inbox.test.mjs`＝人间接口／初审边界／裁定包三块判据；
  - 扩展 `tests/task-ledger.test.mjs`＝台账侧闸门与语义（wait-user 裁定类必填、
    escalated 原因封闭、非委代项归属门、挂起不占租约且无超时自动动作、结算/关闭
    超时上浮）；
  - 扩展 `tests/org-brief.test.mjs`＝简报 `dueAt` 可选键；
  - 扩展 `tests/ledger-host.test.mjs`＝收件箱 HTTP 投递面。
- 范围裁定（同日用户逐项确认，四项均取推荐项）：
  ①「业务截止时间」落简报**可选键 `dueAt`**（ISO；缺省＝无到期投影，顶层键仍封闭）；
  ②「推迟」＝投递面节律、**零台账事件**（照规格 §F 原文；测试断言事件数与状态不变）；
  ③**并入结算/关闭超时上浮**（`STATE_RESPONSIBILITY` delivered／settled 两条 onTimeout
  的执行面；task-ledger.js 头注「结算/关闭超时＝09 人间接口」）；
  ④其余照预核清单执行。
- 实施（2026-09-19，`/tdd` 红绿逐片）：
  - **新件** `lib/org/human-inbox.js`＝人间接口件套（与 review-kit 同型的判定／投影
    层）：三类裁定封闭枚举 `RULING_CLASSES`、上浮原因封闭枚举 `ESCALATION_CAUSES`
    （前五条＝在案两路，后五条＝契约词表：初审拒绝／结算关闭超时／冲突／越权）、
    到人告知三类 `NOTICE_KINDS`、永不可代三项 `NON_DELEGABLE`＋
    `userRulingRequirement`（用户域挂起与冲突／越权上浮的终裁只许 user）、
    初审边界 `preScreenBoundary`（必审未闭合＝package-only／否则可处置）＋
    `preScreenEscalation`（初审拒绝或两轮未闭合强制上浮；未知裁决 fail closed）、
    到期投影 `isExpired`、告知投影 `noticesFrom`（交付回笼／取消失败／**连续**越权
    计数）、裁定包 `buildRulingPackage`（五件齐备才交付）、终裁视图
    `RULING_ACTIONS`／`applyRuling`（四式映射既有 op，`defer` 零事件）、收件箱
    `buildInbox`（待裁项＋告知并列）。
  - `lib/org/task-ledger.js`：`wait-user` 必填 `class`∈三枚举（`invalid-ruling-class`）；
    `escalated.cause`∈原因枚举与 `wait-user.class` 同受 `validateEventRecord` 把守；
    非委代项挂起点状态改写只许 `actor.kind=user`（`ruling-not-delegable`，含取消）；
    投影增 `waitingClass`／`escalationCause`（随事件重建）；`escalated` 来态扩
    `delivered`／`settled`；`QUEUE_STALL_ACTIONS` 增两态（先登记 `task-stalled`
    异常再上浮，绝不自动结算/自动关闭）；队列滞留 intake 分支补 class。
  - `lib/org/brief.js`：边界要素可选键 `dueAt`（ISO；缺省＝无到期投影）。
  - `lib/org/ledger-host.js`：`GET /api/bots/_ledger/inbox?cursor=`（只读投递面，
    POST 405）；`createLedgerHost` 透传 `now`（到期投影取宿主时钟）。
- **验证**：`TMPDIR=/dev/shm npm test` **49/49**（新模块 `org-human-inbox` 16 条；
  task-ledger 扩 6 条＝裁定类闸门与 schema、非委代归属门、挂起语义、结算/关闭超时、
  终裁特化视图；org-brief 扩 1 条；ledger-host 扩 1 条）；preflight 四门见 CHANGELOG。
- **留界／交接（在案）**：
  ①**「其余挂起点的终裁由 user 行使」是投递面约定而非机械门**——机械硬门只覆盖
  永不可代三项（用户域挂起、冲突／越权上浮）；其余挂起点（不可逆写入放行、复核
  两轮未闭合、队列/租约链上浮）维持既有恢复语义，以免越出本票判据收紧冻结的
  状态机；
  ②**blocked 超时上浮**在 `STATE_RESPONSIBILITY` 记为「阻塞超时→上浮用户并通知
  派单方」，05 起头注挂 08 号票名下、08 已 resolved 未实施——本票未越权改动，
  留待用户裁量立票；
  ③**越权计数与 20 号票的口径互指**：本票落「投递面告知投影」的连续计数
  （trailing，被非越权事件打断即重置，与 20 号票第 4 条同口径）；§D 的阈值注入、
  达阈通知派单方与计入上浮通道仍归 20 号票——已在 20 号票 Comments 留互指注记，
  升表/落地时应提取共用原语（02 纪律：同一原语不得两处各留一份）；
  ④**承接方命令面契约变化**：`task.wait-user` 现须带 `class`（三值封闭）——岗位
  工具面参数为透传式（`additionalProperties`），未加 schema 硬约束，缺省即以
  `invalid-ruling-class` 拒绝（拒绝理由点名枚举，可自纠）；
  ⑤**mail 只读转发**（出仓库副本）仍归 11 号票；本票只把「回文永不构成裁定」机械
  守住（裁定路径只认 user principal，`applyRuling` 对 post／host 在触达台账前拒绝）。
- **`/code-review` 双轴复审与处置（2026-09-19；技能显式载入照文执行，两轴并行
  子代理，固定点 `f283864`）**：
  - **Standards 轴**：硬违例 2——①CHANGELOG 缺条目（复审时点尚未落档，本条目收口
    时已补）②越权码表不完备＝能力面拒绝静默降级（已改按能力码词形单源判定）；
    judgement 4——`latestEvent` 提取、`RULING_ACTIONS` 负载构造入表＋`requires`
    强制、两轮阈值单源、旧格式事件不可读的迁移归因（已在 `validateEventRecord`
    注记：fail closed、不静默补值、日后迁移须显式补字段重放）。
  - **Spec 轴**：高 1——`applyRuling` 幂等键洞（缺键假键＋同键跨任务重放＝**漏裁
    报成功**；已改为缺键即拒＋键带 taskId 分量＋两条负例）；中 2——裁定包立场只到
    「至少一方」（已改为补齐至双方各一句、缺两句即缺件）、V-A5.4 初审强制上浮无
    执行面（已新增台账侧 `recordPreScreen`：必审门→判断事实→`escalated` 通道，
    并测试；**结论提交面**（工具/op 接线）随 13／14 召集与自举补齐）；低 2——判据
    事实字段名实不符（改 `criteria`＋结果原文随 `gaps.evidence`／`criteriaGaps`）、
    `host-channel-forbidden` 死词表项出表＋`sweep` 异常登记返回值经
    `exceptionFailures` 响亮回报。
  - V-A5 逐条复核结论：`V-A5.1`／`V-A5.2`／`V-A5.3`／`V-A5.5` 达标；`V-A5.4`／
    `V-A5.6` 经上列修复后达标（修复项均有回归测试在场）。
  - **保留未改（理由在案）**：初审代理自身的结论提交面（属 13／14 召集与自举）；
    `blocked` 超时上浮（已登记 `PROJECT_UNDERSTANDING`「仍可选题」，待用户裁量）。
