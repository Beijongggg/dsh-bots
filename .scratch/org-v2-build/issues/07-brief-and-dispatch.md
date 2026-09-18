# 07: 四要素简报与派单租约

**What to build:** 派单的固定工件形状成形并**派出即冻结**。简报字段＝任务 id／类别（`duty|project`）／
目标／交付物（输出格式＋存放坐标）／来源（工具面＋坐标，ID-only）／边界／**可执行验收判据**／
复核点／归属与租约／父任务。不变量：四要素与判据**非空**；判据**必须可执行**，不可执行即判
**判据缺口**，须先分解为可观测项、分解不出来标 `needs-user` 上浮；**不预置产出方语义决定**；
给坐标不给转述、全轨迹由台账持有；**修改只走`amend`追加事件并显式通知承接方**，不得静默改写。
简报与 capability 信封**经接单响应携带、不进系统提示段**（简报是任务动态对象，注入提示段会在多任务
并行时串台）。可执行检查的判据来源改为**简报的验收预登记**（不再取任务工件正文），白名单机制必须
存在且 **fail closed**、含逐字一致校验。

规格出处：`.scratch/org-v2/spec.md` §B（简报）、§E（简报装载、探针接线）与附录 A `V-A2.4`、
`V-A4.3`、`V-A4.6`。

**Blocked by:** 05（台账）、06（接单响应须携带 capability 信封）

**Status:** resolved（2026-09-18 实施批收口，凭据见 Comments）

- [x] 简报四非空，验收判据非空且可执行；不可执行判据即判缺口并先分解或上浮（`V-A2.4`）
- [x] 简报派出即冻结，改动只经 amend 事件并显式通知承接方（`V-A2.4`）
- [x] 简报与 capability 信封经接单响应携带，不进系统提示段（`V-A4.3`）
- [x] 派单不预置产出方语义决定；只给坐标不给转述（方法论 #16／#17）
- [x] 可执行检查的判据取简报验收预登记；白名单存在且 fail closed、逐字一致校验（`V-A4.6`）
- [x] 接单／带理由拒收／逾期释放全链可核，均落台账事件（拒收理由按规格 §B「可带」＝可选、给出即须非空）
- [x] 全量回归 PASS（47/47＋preflight 四门绿）

## Comments

- 2026-09-18 领票（用户 `/implement` 调用＝授权依据）：领票时工作树净（仅无关
  未跟踪 `.video_agent/`），01–06＋15 已入库、18 代码面已入库，无并行在制品；
  本票 blockers（05/06）均已 resolved。按 /implement＋/tdd 执行本票。测试接缝
  预核（/tdd 纪律；接缝源＝规格 Testing Decisions「只用既有接缝」＋附录 A 执行
  坐标，非本会话新立）：简报校验模块＝`tests/org-brief.test.mjs`（`V-A2.4`）；
  探针测试模块＝`tests/org-probe.test.mjs`（`V-A4.6`）；台账测试模块扩展＝
  `tests/task-ledger.test.mjs`；工具面测试模块扩展＝`tests/org-op-set.test.mjs`
  （`V-A4.3` 提示段扫描）；bot 通道＝`tests/org-post-channel.test.mjs`（注入
  fetch）。
- 2026-09-18 实施与验证证据（Status→resolved）：
  - **新件**：`lib/org/brief.js`（四要素简报契约校验器：四非空＋顶层键封闭＋
    交付物 `{format,location}`／来源 `{tool,ref}` 条目键封闭＝「给坐标不给转述」
    的结构形态；判据冻结期按执行侧同口径校验白名单名＋argKeys，不可执行＝
    `gap {kind:"criteria-gap"}` 缺口分类）；`lib/org/probe.js`（探针白名单封闭
    枚举三命令 fs.contains／node.tests／ledger.no-anomalies＋canonical 逐字一致
    口径 `criterionMatches`＋`runCriterion` fail closed 执行体——node.tests 走
    隔离子进程）；`lib/org/dispatch-config.js`（值守例程声明式登记表——两类
    投递面异常处置例程的简报模板在册，`expandRoutine` 展开＋构建期校验；收单
    规则表 `INTAKE_RULES`＋`matchIntakeRule` 纯匹配器）；`lib/org/post-channel.js`
    （bot→host 组织命令通道：ledger.read 读投影／evidence.probe 执行面——判据
    真源＝台账投影＋本地持有件逐字比对后才跑白名单、模型只交 `{taskId,index}`／
    台账命令 POST＋CSRF 会话＋链式能力持有侧＋接单响应简报捕获）。
  - **改件**：task-ledger（intake/plan/amend 简报校验＋assign 冻结前置
    `brief-missing`＋accept 结论携带简报＋新 `task.decline` 带理由拒收五表＋
    新 `task.return` 退回分诊五表＋sweep 队列滞留三条（QUEUE_STALL_ACTIONS＋
    `stallMs` 缝）＋assign 默认记录 dispatcher）；op-set（`task.decline`/
    `evidence.probe` 升入承接岗可执行表＋EXECUTE_OPS 执行面分类＋保留集检查改
    按岗位＋TOOL_KIND 描述表）；ledger-host（异常汇入简报换登记表模板＋tick
    stalled 桶）；index（bot 分支 registerOrgTools 岗位工具面注册＋spawn 透传
    `DSH_BOTS_HOST_URL` 运维缝——未设则通道休眠并告警）；host-contract-probe
    （两台账探针夹具随简报契约换合法件）。
  - **测试**：4 新模块 34 条（org-brief 8／org-probe 7／org-dispatch-config 6／
    org-post-channel 6）＋task-ledger 新 7 条（30 条总量）＋op-set 扩展 4 条
    （17 条总量）；夹具归一 `tests/helpers/brief-fixture.mjs`（VALID_BRIEF 单一
    事实源，5 测试文件共用）。
  - **验证**：`TMPDIR=/dev/shm npm test` 47/47；preflight ①47/47 ②0009 包 7/7
    ③0 违例 ④11 PASS/0 FAIL/0 SKIP（P-V2-LEDGER-FORMAT／P-LEDGER-COMMANDS 夹具
    随契约更新后复验 PASS）。
- 2026-09-18 `/code-review` 双轴复审处置（Standards 9 条／Spec 6 条）：
  - **修**：①判据冻结期校验弱于执行侧（Spec）——validateBrief 补 argKeys 逐字
    一致校验，错形判据不得冻结成「永不满足」的死判据；②decline 理由强制加严于
    规格 §B「**可**带理由拒收」（Spec）——改可选、给出即须非空；③fs.contains
    绝对路径判定误用 resolve 比较（Standards，cwd=dshHome 时误拒）——改
    `isAbsolute` 前置；④队列滞留超时未落地（Spec，05 留界 #7 明文归本票）——
    **补做**：新 `task.return` 事件（triaged→intake 退回分诊，通知值班统筹）＋
    `escalated` 来态扩 planned＋sweep 三队列态确定性处置＋`stallMs` 用户域缝；
    ⑤Standards 杂项：VALID_BRIEF 七份雷同归一共用件、isNonEmptyString/routineId/
    CSRF 重试三处去重、PLUGIN_DIR 复用、TOOL_KIND 描述表化、dispatch-config 测试
    头注补判据落点、恒真断言删除、task-ledger 模块头注随 07 扩写。
  - **留界（未改，理由在案）**：⑥**读面 gate（`authorizeLedgerRead`）接线归
    08**——今日 `GET /api/bots/_ledger` 是 localhost 公开读面（api-security 头注
    在案的同级信任边界，GET 只读不受 CSRF 门），bot 的 ledger.read 工具走公开读
    与人同权、不产生额外授权面；鉴权读的真消费方是 08 复核件套的 fresh-context
    读路径（届时 capability 门才有语义）。⑦**收单规则表条目随 11 号票增补**——
    05 留界 #8 的 07 侧交付物＝机制（声明表＋纯匹配器＋构建期校验＋语义测试），
    生产调用方（外部事件收单流）随 11 mail 形态改造存在，空表＝「一切收单上浮
    值班统筹」的现状如实表达，不造虚条目。⑧**`artifact.*`／`evidence.read` 落
    命令面归 08**（06 票面注记原写「归 07」，本票实施裁定改挂 08 并在此留凭据）：
    工件提交/读取的消费方是复核件套与跨实例移交（08 的复核者读路径、14 闭环的
    提交链），本票 checklist 不含 artifact——06 注记属规划展望，以本条为准。
    ⑨扫描测试白盒测源码（Standards judgement）——「扫描类测试模块」是 A 组
    成文坐标形态（规格 Testing Decisions），`V-A4.3` 不进提示段以此把守，留。
- 凭据义务：本条＋CHANGELOG 顶部条目（AGENTS.md §1）。本票零部署动作（spawn
  env 透传与 bot 分支注册随下次部署生效，部署同步受 AGENTS §2 逐项点名约束；
  v2 部署清单在切换批 16 号票重对账）。
