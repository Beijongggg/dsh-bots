# 25: 关闭前置第三项——验收判据的通过记录

**What to build:** 补齐规格 §B 关闭前置的第三条：「验收判据均有可执行检查的通过记录」。
14 号票实现了前两条（命中复核点已闭合、产出已按「谁产出谁登记」登记），第三条当时留界，
理由是「承载面未定义机械形态」。本票把它落地。

**选定做法（2026-09-21 由代理裁定，用户授权「第一条你自选」）**：**关闸时现跑**，不新增台账
事件类型。

- `task.close` 由确定性层按简报里**冻结的验收判据**逐条现跑一遍（复用 `lib/org/probe.js`
  的 `runCriterion`，白名单命令、沙箱快照、逐字一致校验照旧）。全部通过才准关闭。
- 任一条不过即拒（沿用 `command-rejected` 事件落账，拒绝理由点名**哪一条 index／哪个命令／
  什么原因**，并带该次快照的 sha256 以便复验）。不新增事件类型。
- 与 `evidence.probe` 的分工：那条是承接方**干活时的自检**（谁跑谁看）；本票是确定性层在
  边界上的**复核**，不采信承接方自报（「模型不得自报判据」同一口径）。
- 为什么不用「把探针结论存起来」：探针结论现在只回调用方，要存就得新造一种记录；而现跑得到
  的是关闸那一刻的真实结论，且不需要信任任何一方的自报。少一个事实源，少一处可漂移的面。

**实现要点（开工前先定，写进票面 Comments）**：

1. 探针执行面是**注入缝**（照 `createTaskLedger({ artifactsFor })` 的先例）：台账本体不直接
   依赖 repo 路径与 mail 面。执行面未接线时的缺省行为必须定死并测试（建议 fail closed：
   `acceptance-check-unwired`，因为「跑不了」不等于「过了」）。
2. 适用范围与 14 号票的第二条对齐：`class=project` 适用；`class=duty` 例程任务是否豁免需按
   §B 值守例程段复核（例程判据可由健康探针或回归结果自动生成）。
3. 判据执行可能很重（`node.tests` 会派生子进程），要定超时与失败口径（超时＝不过，不是跳过）。
4. 落地面复核：`tests/org-closed-loop-smoke.test.mjs` 现在的简报判据指向 `docs/x.md`，现跑会
   失败；本票须让烟测的判据真能跑过（夹具改成任务自己产出的坐标），否则烟测会从「假绿」变成
   「假红」。
5. 负例：判据不过即拒且状态不变；判据通过即放行；执行面未接线即拒；duty 任务按第 2 条口径。

规格出处：`.scratch/org-v2/spec.md` §B「结算与关闭」段与 Testing Decisions（「可执行判据的
通过记录进台账」）。

来源：14 号票 recon 发现 G3（`task.close` 此前无任何前置门），14 号票 Comments「留界 1」。

**Blocked by:** 无（14 号票已 resolved）

**Status:** resolved

- [x] 关闸现跑：`task.close` 逐条执行简报冻结判据，全过才准关
- [x] 执行面为注入缝；未接线时行为定死并测试（fail closed）
- [x] 拒绝回执点名判据 index／命令／原因，并带快照 sha256
- [x] 不新增台账事件类型（`EVENT_TYPES` 封闭词表零扩条，有断言）
- [x] 适用范围（project／duty）按 §B 复核后定死并测试
- [x] 烟测夹具的判据改成真能跑过的坐标
- [x] 全量回归与 preflight 四道门 PASS

## Comments

### 开工前定死（票面「实现要点」1–3 的落地口径）

1. **注入缝形态**：`createTaskLedger({ criterionRunnerFor, criterionRunCtx })`。
   - `criterionRunnerFor(taskId)` → `async (criterion) => result`，缺省 `null`。
     任务级工厂（不是单一执行体）的好处：将来 duty 例程的判据自动生成、或按任务
     域换执行面（不同 cwd／沙箱档）都不必再改台账签名。
   - `criterionRunCtx` 只补「非 dshHome」的上下文（`cwd`／`timeoutMs`／`tmpdir`／
     `listMailAnomalies`）；`dshHome` 由台账本体补（与 `readArtifacts` 用同一个
     `dshHome`）——调用方不必两处各传一次可能漂移的数据根。
   - 与 `artifactsFor` 同一先例：**唯一读取点在闭包内**，未接线即 `null`。
2. **未接线＝fail closed**：项目类任务（或其 `class` 为空/未知）在探针执行面未接线时
   一律拒，拒绝码 `acceptance-check-unwired`，理由明说「跑不了不等于过了」。
   台账本体**不**缺省内联 `lib/org/probe.js`——测试夹具大量构门面，若缺省就真跑，
   等于把「重活」塞进每个构造点；显式接线这件事本身就是「确定性层不直接依赖 repo 路径
   与 mail 面」的机械保证。接线件另起 `lib/org/criterion-runner.js`（探测面 adapter），
   宿主与烟测共用同一个装配工厂，不停两份。
3. **遍历顺序＝「便宜的先判」**：复核点闭合 → 判据现跑 → 产出登记。判据可能很重
   （`node.tests` 要派生整树副本＋子进程），排在两道纯投影判定之后，免得每次
   关闭都先把几十秒花在一个注定被拒的门上。三道门都在，「第二次关闭才放行」的
   负例语义不变。
4. **通过口径**：`ok === true` 才算过；其余一律拒。快照摘要取执行结论的
   `snapshotSha256`（`node.tests` 的树级摘要或坐标级 sha256；采集未生的拒绝＝null）。
   拒绝回执点名 `acceptance-check-failed` ＋ index／命令／原因，额外键
   `snapshotSha256`、`failedIndex` 只入回执与幂等预留记录（事件 schema 键封闭，照
   21 号票①的 `extraResult` 先例）。落账仍是既有的 `command-rejected`，理由串本身
   也带 index／命令／原因，故账上可读、回执可复验。
5. **超时口径**：超时＝不过（不是跳过）。`node.tests` 的 SIGKILL 超时在探针层单列
   `code: "probe-timeout"`（与「测试真跑红」区分开，理由串可归因）；`runCriterion`
   结论一律携带顶层 `snapshotSha256`（缺省 null）供上层复验，不改既有的顶层两态
   与 `snapshot` 形状。
6. **适用范围**：`class=duty` **且无验收判据**（简报缺省或 `acceptance` 空集）＝豁免
   ——§B 例程判据「可由健康探针或回归结果自动生成」，生成机制本票不做，故对无判据的
   例程任务适用判据门会发明「凭空的判据」；例程任务**自己登记了判据**（如 `regression`
   探针）时照跑——判据存在即须有通过记录（规格 §B 关闭前置的字面要求），对
   「自产判据」豁免等于放行一条无通过记录的关闭路径。`class=project` 与新造任务的
   空 `class` 一律适用（空 class 会被判据执行面未接线/无简报两条 fail closed 拦住）。

### 落地记录

- 改动件：`lib/org/probe.js`（超时单列＋顶层 `snapshotSha256`）、
  `lib/org/task-ledger.js`（`closePrecondition` 第三条＋注入缝＋`await` 命令面）、
  `lib/org/criterion-runner.js`（新件：探测面 adapter 装配）、`lib/index.js`（宿主接线）。
- 测试夹具：`tests/helpers/criterion-fixture.mjs`（共用假执行面，免各文件各写一份）；
  既有夹具注入假执行面（不改变各自断言物），烟测与验收记录模块用真接线件。

### 收口（实施完成；验证证据）

- **关闸现跑**：`task-ledger.js::acceptanceReadiness`（`closePrecondition` 第三条）逐条执行任务投影里
  的冻结简报判据（白名单／逐字一致／沙箱快照照旧），全过才准关；判据真源＝简报（`task.acceptance`
  投影字段），调用方 payload 自带判据被命令面拒（负载键封闭）。
- **注入缝**：`createTaskLedger({ criterionRunnerFor, criterionRunCtx })`；`dshHome` 由台账本体补；
  未接线＝`acceptance-check-unwired`（fail closed）。装配件 `lib/org/criterion-runner.js`，宿主
  （`lib/index.js`）与烟测同一工厂。
- **拒绝回执**：`acceptance-check-failed` + 理由串「验收判据 #<index> 未通过（<命令> <args>）：<原因>」
  ＋ `failedIndex`／`snapshotSha256`（只入回执与幂等预留，事件 schema 键封闭；账上＝`command-rejected`，
  `EVENT_TYPES` 30 条零扩条有断言）。
- **超时**：`probe-timeout` 单列（超时＝不过，不是跳过）；`runCriterion` 顶层补 `snapshotSha256`。
- **适用范围**：`project` 适用；无判据的 `duty` 豁免；自带判据的 `duty` 照跑；无判据的非例程任务在
  收单门即拒（两道 fail closed 同口径的两端）。
- **烟测夹具**：判据改为任务自己产出的坐标（知识登记落盘的报告全文），ledger 接真执行面；
  `closeBlocked` 步断言改 `acceptance-check-failed` + `failedIndex` + 坐标点名。
- **验证**：新 `tests/acceptance-records.test.mjs` 9 条全绿；`tests/org-probe.test.mjs` 2 条新例全绿；
  全量回归 **62/62**；**preflight 四门 PASS**（①62/62 ②0009 包 7/7 ③0 违例 ④11 PASS/0 FAIL/0 SKIP）；
  冻结面零改动（②门实测）；运行面零写入。
- **随带改动（非本票新增范围，属既有义务）**：命令面 `command` 由同步改 async，逐处补齐 await／async
  （`lib/org/{ledger-host,permissions,human-inbox}.js`、`lib/index.js`、`scripts/host-contract-probe.mjs`
  与 6 个测试件的夹具）；未发现漏 await 的调用点（`startLedgerTicker` 对 async tick 已加显式 catch）。
- **独立复核（`verifier-25`，只读，六项）**：发现并已就地修复 **3 条硬违例**——①
  `tests/org-durability.test.mjs` 被本次机械改造误加 `async` 回调致 `some(...)` 恒真（假绿断言，
  已回退并全仓扫同类形态：零残留）；② 判据执行面**抛错逃逸**（工厂抛错／执行体抛错会 500 且
  **拒绝不落账**）：现两处各包 fail closed 折算（工厂错＝`acceptance-check-unwired`、执行体错＝
  `acceptance-check-failed`＋`failedIndex`），回执形状与留账义务恢复，新增 2 条用例锁住；
  ③ `rejectHere` 第 4 参顶掉 `authorized` 标记（21 号票①的续签机械证据面被静默削弱）：改**合并**
  语义并新增 1 条用例（A/B 实测：旧行为红、新行为绿）。另修 **1 条存疑项**：`dshHome` 展开顺序
  让调用方 ctx 可覆盖台账根（与「单源」声明不符）→ 改为台账根最后展开，并新增单源不变量用例。
  另按复核建议：异步 `tick` 加 **in-flight 守卫**（防每拍重叠）、`acceptanceReadiness` 的
  「无判据」两条分支**如实标注今日不可达且无覆盖**、CHANGELOG 件数校正、用例 6 标题与断言对齐。
- **如实登记的存疑项（复核提出，未改实现，留待口径修订）**：Testing Decisions「可执行判据的
  通过记录**进台账**」的**字面未满足**——通过路径下 `close` 事件负载为空（账只证「关过」，不证
  「关闸那一刻哪几条判据跑过并通过」），只有拒绝才留 `command-rejected`。这是票面「选定做法」与
  用户授权「第一条你自选」下的**已授权口径偏离**（不新增事件类型、不存第二份事实源）；若要贴合
  字面，须点名授权扩 `close` 事件负载（`EVENT_EXTRA_KEYS.close`）或改规格 Testing Decisions 措辞。
  本票不做，登记于此。
