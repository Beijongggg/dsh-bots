# 37: 最近 24h 变更风险审计交接（讨论票）

**票源：** 2026-09-29 的只读风险审计（用户指令）。范围＝快照 HEAD `b4a1ca5` 上
近 24 小时（2026-09-28 18:55 → 2026-09-29 00:30）的 15 个提交：`0658c94`…
`b4a1ca5`，覆盖 #33／#34／#35／#36 四条修复线与日志分卷迁移。本票为**讨论性质**
——4 项发现＋5 个待答问题交接受方独立评估确认；不预设修法，发现≠已确认缺陷。
**2026-09-29 第三轮独立复核已并入本票**（原 38 号票缩并为指针票；用户裁定，
动机＝两票内容重复度高）：F1–F4 全部复核确认、3 处勘误、增量观察 R1–R3、
新增 Q6——见文末「独立复核」节。

**审计方法：** 逐提交 diff 阅读＋跨文件接线核验（权限 op、原型链、锁语义、watcher
时序）＋干净副本（`git archive HEAD` 至临时目录）跑全量回归与 preflight＋临时目录
活体复现三类。未启动宿主、未做 HTTP/UI 端到端、真实运行面零写入。

**快照与环境注意：** 审计期间主工作树存在**并行会话的在制未提交改动**
（16 号票、`lib/index.js`、`lib/org/ledger-host.js`、新增 `lib/org/cutover.js` 等）。
本审计未触碰其任何文件；下文全部行号以下列 HEAD 干净副本为准，工作树行号可能漂移。

**Status:** ready-for-human
**Blocked by:** 无

## 摘要

| 发现 | 类别 | 置信度 | 窗口关联 |
|---|---|---|---|
| F1 零 receipt 实例的首批消息被「迁移基线」静默吞没 | 数据丢失 | 高（活体复现＋代码直读） | #35 复核时明示保留，并以新用例固化 |
| F2 cursor 腿 HTTP 协议 GET→POST 无版本协商，混部互 405 停摆 | 跨端兼容 | 协议事实高；部署影响待接收方确认 | `654a094` 引入 |
| F3 原型链在册旁路残面：邮件面已修，管理面同类形态仍在 | 身份判定一致性 | 守卫语义已复现；HTTP 端到端未跑 | `39adf0b` 确立判定标准，仅修邮件面 |
| F4 `_mail` 面身份为自报 `actor.id`＋在册校验，无进程绑定 | 权限边界确认 | 事实高；定级依赖威胁模型裁定 | #35 将 cursor 并入同口径 |

## F1 零 receipt 实例的首批消息被迁移基线静默吞没（数据丢失）

**事实（活体复现，临时目录，直接调用 HEAD 的实际函数）：**

- 场景：实例目录已存在且已有消息、但从未产生任何 receipt（从未消费过），
  此时调用起始游标——得到 `{"lastSeq":1,"replay":false,"baseline":1}` 并落盘
  `.baseline.json`；按 watcher 的消费规则（`lastSeq=1`＋`offset=文件大小`），
  已存在的消息**永不进入 agent 回合**。
- 对照场景（存在 receipt 水位时）实测返回 `replay:true`，停机积压正常回放。
- 复现输出（节选）：

```
== 新 bot，启动前已有首封邮件（目录存在、无任何 receipt）
initialMailCursor #1 = {"lastSeq":1,"replay":false,"baseline":1}
baseline 落盘 = true {"seq":1,...}
=> watcher 依据：lastSeq=1, replay=false → offset=文件大小 → 首封邮件不再消费
== 曾消费过（水位 1）→ 停机积压 seq2 → 重启
停机后 seq2 到达、重启 = {"lastSeq":1,"replay":true} （正常回放）
```

**代码证据（HEAD 坐标）：**

- `lib/mail-plane.js:362-369`：`initialMailCursor` 的判据
  `if (receiptMax === 0 && fileMax > 0) { writeBaselineReceipt(...); return {lastSeq: fileMax, replay: false, baseline: fileMax}; }`
  ——「零 receipt ＋ 有存量」被一律按**旧数据迁移**处置，存量不回放。
- `lib/mail-relay.js:215-221`：`cursor()` 调 `pruneReceipts` ＋ `initialMailCursor` 后原样返回。
- `lib/index.js:2371`（`started = existsSync(inboxDir)`）、`:2386-2406`（`ensureCursor`：
  `started` 为真即 `lastSeq=result.lastSeq`、`offset=statSync(file).size`）、
  `:2495-2502`（`tick` 先 `ensureCursor` 再 `scan`；`scan` 只处理 `seq > lastSeq`）。
- 与承诺的冲突：`lib/index.js:2349-2350` 注明「bot 停机期间到达的邮件在重启后回放，
  不再丢失」；`:2384` 注明「fresh bot 的首封邮件不会被基线吞掉」。两处承诺都只覆盖
  「目录不存在时问游标」的分支；**目录已存在＋零 receipt** 的分支实测吞没，且日志
  以 `（旧数据迁移基线 N）` 记因（`lib/index.js:2404-2406`），对本场景属误归因。
- 窗口关联：`initialMailCursor` 本体自 11 号票引入、本窗口未改；但 #35 复核时明确定调
  「存量基线认／继续有效」并在 `tests/org-mail-relay.test.mjs` 新增「迁移写一次／二次
  纯读不覆写」用例固化（`654a094`、`3e8950a` 记录）。

**可达路径（代码直读）：**

1. 创建实例后未自动启动（`lib/index.js:883-949` 的 `create` 只写注册表），
   用户投递面 `BotsApi.send`（`lib/index.js:1321-1341`）**无在线判定**——向未启动
   实例投递首封即命中；启动 watcher 时 `started=true` → 吞没。
2. 零 receipt 实例在首封处理中途崩溃（claim 后 finalize 前，receipt 未落），
   重启时该封同样进基线、不再重放。
3. 与 F2 复合：混部停摆期间积压的消息，对零 receipt 实例在升级后仍走本基线路径。

**影响：** 用户已送达的消息永久不触发回合（UI 收件箱可见、但无回复）；仅 info 级
日志留痕，且归因文案误导。对已消费过的实例无此问题（`receiptMax>0` 走回放）。

## F2 cursor 腿协议 GET→POST，无版本协商；新旧混部互 405、watcher 停摆（跨端兼容）

**事实（双向代码直读）：**

- 旧 host（`654a094^`，`lib/org/mail-relay.js:313-319`）：cursor 腿仅认 GET，
  非 GET 即 405；新 bot 客户端发 POST（`lib/org/mail-client.js` 的 `cursor()`，
  `654a094` 改）→ 405。
- 新 host（HEAD `lib/org/mail-relay.js:318-319`）：`send／consume／cursor` 合并块
  `if (req.method !== "POST") return methodNotAllowed();`；旧 bot 客户端发 GET
  → 405。
- 客户端对 405 的分支：`lib/org/mail-client.js:37-52`（非 5xx 不重试）→
  `interpret` 折 `mail-http-405`；watcher `lib/index.js:2388-2393`「起始游标未达：
  本拍不消费」→ 每拍重试、**fail closed 停摆**直到实例升级重启。

**窗口关联：** `654a094`（#35）改了线上协议；#35 票面记录了口径
（「cursor 改 POST…旧接入无 GET」）但未见升级顺序/版本协商条款。

**影响：** 滚动升级或部署同步期间，未重启的旧实例游标腿停摆（消息不丢、不处理）；
若属零 receipt 实例，停摆期积压升级后叠加 F1 吞没。16 号票 cutover 批次若在途，
请对照确认顺序要求。

## F3 原型链在册旁路残面：窗口只修邮件面，管理面同类形态仍在（身份判定一致性）

**事实：**

- `39adf0b`（#35 返修）在 `lib/org/mail-relay.js:38-40` 新增
  `hasRegisteredBot = Object.hasOwn(registry, botId) && registry[botId] !== undefined`，
  修掉「原型链名字冒充在册实例」的旁路（拒 `toString`／`constructor`／`__proto__`），
  4 处判定统一；这是本仓库为「在册」判定确立的现行标准。
- 同形态 `registry[id] === undefined`／`const bot = registry[id]` 守卫在**管理面**
  `lib/index.js` 仍存在（HEAD 行号）：`871`(get)、`958`(patch)、`1138`(remove)、
  `1162`(start)、`1273`(stop)、`1323`(send)、`1353`(inbox)、`1360`(messages)、
  `1373`(stats)；另 `1711`(detectBotInstance 的 `registry[profileId] !== undefined`；
  原文记 1712，第三轮复核勘误，已改)。
- 语义复现（Node 实测）：`JSON.parse("{}")` 上
  `toString／constructor／hasOwnProperty／valueOf`（function）、`__proto__`（object）
  的 `!== undefined` 均为真、`Object.hasOwn` 均为假 → 以这些名字作为 id 时守卫**不会**
  走 404 分支。
- 由代码路径推算的后果（**未做 HTTP 端到端，待复核**）：`get` 不会 404 而进入
  `computeStatus`／`serializeBot`（对函数值取属性）；`remove` 的
  `delete fresh[id]` 为无操作、却返回 `{deleted:true}` 的伪成功；`patch` 在严格模式下
  对函数固有属性赋值可能抛错。PS：`uniqueId`（`lib/index.js:513-520`）经 slug 小写化，
  实际不会创建与原型链同名的实例（`constructor` 会被去重为 `constructor-2`），
  故这些 id 恒为「不存在」。

**定级参考：** 同机威胁模型内（`lib/api-security.js:8-9` 自述同机不设防），
更接近健壮性/一致性缺陷（伪 404 缺失、伪成功、可能 500），而非跨边界越权；
但窗口已确立标准，建议核对是否同步收口。

## F4 `_mail` 面身份自报、无进程绑定（权限边界确认项）

**事实：**

- `_mail` 面（`lib/org/mail-relay.js:285-382`，`createMailHttpApi`）对 `send／consume／
  cursor` 的身份检查＝`actor.kind==="post"`＋`actor.id` 非空（`:338-343`），在册性由
  中继内 `hasRegisteredBot` 复核；**不校验** `x-dsh-bots-bot-id` 头与调用进程的任何绑定
  （HEAD 全仓 `BOT_ID_HEADER` 消费面仅 `lib/org/ledger-host.js:429` 复核读面）。
- 因此任一在册实例（或持 CSRF 令牌的同机调用者）可**以他实例身份**调用 `_mail`：
  `send`（冒充发信者）、`consume`（为他实例推进/报告水位）、`cursor`（触达其
  prune／基线写）。
- CSRF 为全局会话令牌（`lib/api-security.js` 注释：同机进程可自由读令牌端点，
  令牌层对同机不设防）；对比：台账复核读面用能力信封鉴权
  （`ledger-host.js:427-431` 的 `authorizeHandoff`），邮件面刻意零 capability 门槛
  （`lib/org/op-set.js:71-75` 规格 §E）。
- 窗口关联：`654a094` 把 cursor 从「自声明头 `x-dsh-bots-bot-id`」改为「自报
  `actor.id`＋在册」——两者同为自报，强度等价；`39adf0b` 只收紧「在册」判定。

**待确认：** 该边界是否维持现状（同机信任）；是否需要与台账面不同强度的绑定。
本次审计未将其列为「新增越权」（未越出既有威胁模型），但 #35 让 cursor 也进入该
口径后，「触发他实例基线写、影响其消费水位」第一次成为可经 `_mail` 面直达的动作。

## 已评估、不构成本窗口新增风险（在案取舍/已修复，抽样）

- #36 锁线：活 pid 不因目录陈旧被接管（`b4a1ca5`）、接管删除持续失败不再紧循环
  （`4b23b84`，含隔离子进程回归）、留痕出口抛错不顶替取锁结论；超时 fail closed 可重试。
  本机实测：Windows 下 `process.kill(pid,0)` 对不存在/已回收 pid 归一 `ESRCH`（死主
  快路跨端成立）；接管双观测用的 `ino` 在 NTFS 非零、重建即变化。
- 33 号票探针面：快照 GC／SKIP 判定（stdout/stderr 分流）／参数守卫／Windows tmpdir
  链——处置均在案（`32e035a`、`b7ea4a4`）。
- 34 号票知识面：水位含 `reports/` 既有报告、正文 `wx` 独占创建、`supersedes/deprecate`
  双向终态守卫——处置均在案（`73e8d33`、`b7ea4a4`）。
- 28 号票复验器：默认只做包内复算、`--check-binding` 显式核附件（裁定在案）；
  CLI 缺值吞开关的假绿已修（`scripts/ledger-evidence-verify.mjs:37-39`）。
- 日志分卷迁移：`checkChangelog` 并入 preflight ③，入门／分卷／归档哈希全绿。

## 低优先观察（无当前实例或未跨端验证，仅登记）

- 探针 SKIP 检测依赖套件自定标记 `⤼ SKIP:`（`lib/org/probe.js:57`＋`tests/run.mjs:22-28`
  同口径）；`node:test` 原生 `# SKIP` 形态不在检测内——现仓无 `t.skip` 实例，无实际缺口。
- 接管双观测的 `ino` 相等检查在 `ino` 恒 0 的平台退化为恒真（本机 NTFS 非 0；其它
  平台未验证）——窗口内该检查为新增收窄项，退化只回到旧语义，无新增风险。

## 交接问题（请接受方评估确认）

- **Q1（F1）** 零 receipt 实例在「目录已存在＋有消息」时被按旧数据迁移吞没，是否属
  有意口径？若是，watcher/文档的「不再丢失／首封不被吞」承诺是否需修订；若否，
  口径如何区分「迁移存量」与「新生未消费」？
- **Q2（F2）** cursor 腿协议断层是否要求升级顺序（host 与实例的重启先后）？16 号票
  cutover 批次是否已覆盖该顺序要求，或需在切换步骤中点名？
- **Q3（F3）** 是否把 `39adf0b` 的 `hasRegisteredBot` 口径铺到 `lib/index.js` 管理面
  9＋1 处守卫（伪成功/伪 404 面收口）？或明确接受现状并登记为已知边界？
- **Q4（F4）** `_mail` 面自报身份（同机信任边界）是否维持？cursor 进入该口径后，
  「触发他实例基线写」是否需要单独约束？
- **Q5（F1＋F2 复合）** 若 cutover 在途，零 receipt 实例在停摆期积压的升级后吞没，
  是否需要在切换清单中加一条「逐实例确认首封消费水位/重启顺序」的核对项？
- **Q6（R1，第三轮复核新增）** `uniqueId`（`lib/index.js:513-520`）同用 truthy
  判重——用户以原型链名建实例（如「Constructor」经 slug 小写化）会得
  `constructor-2` 后缀。若 Q3 决定铺 `hasRegisteredBot` 口径，是否连同
  `uniqueId` 一并收口（一处工具函数，守卫面/判重面/命名面三处受益）？

## 验证记录（本次实际执行）

- 干净副本：`git archive HEAD | tar -x` → `node tests/run.mjs` **70/70**；
  `node scripts/preflight.mjs` exit 0（①70/70 ②0010 冻结面 10/10 ③0 违例扫 77 md
  ④宿主契约 11 PASS/0 FAIL/0 SKIP）。
- `node --test tests/lock-dir.test.mjs`（工作树，无关并行改动）**18/18**。
- 活体复现 1（F1）：临时目录调用 `initialMailCursor`／`appendMessage`／`writeReceipt`，
  三场景输出如上，临时目录已清理。
- 活体复现 2（F3）：Node 实测原型链键的存在性语义与 `Object.hasOwn` 对照；
  按代码路径枚举 `lib/index.js` 守卫行。
- 跨端核验：Windows Node v24 下 `process.kill(pid,0)` 三例（不存在 pid／越界 pid／
  已死真实 pid）均 `ESRCH`；`statSync().ino` 非零、两目录相异、重建后变化；
  `Atomics.wait` 计时正常。
- **未执行**：宿主启动、HTTP/UI 端到端、混部部署实测、真实运行面（全程零写入）。

## 边界与落档状态

- 本票为审计交接：只读分析输出＋本票据一条；**未提交 git、未改 CHANGELOG 卷**
  （该卷当前由并行会话持有未提交改动；按仓库纪律，落档动作随本票 triage 处置一并完成）。
- 票据行号基准＝HEAD `b4a1ca5` 干净副本；与工作树漂移时以 commit 坐标为准。

## 独立复核（第三轮，2026-09-29；原 38 号票并入本节）

第三轮 24h 审计与本票同窗口（复核期间 HEAD `b4a1ca5` 无新提交），定位＝对
上述发现的独立对抗性复核＋补查（资源泄漏专项等本票未覆盖类别）。取证独立
重做：干净副本逐文件直读＋逐提交 diff＋活体复现（F1 三场景重跑／F3 语义
实测）＋全仓 grep；未参考本票取证过程，仅以其结论为对照面。

**复核结论：F1–F4 全部确认。**

| 发现 | 复核方法 | 增量 |
|---|---|---|
| F1 | 活体复现三场景独立重跑＋watcher 接线直读 | 勘误×2（见下） |
| F2 | 双向 diff 四环证据链逐环独立取证 | 无出入 |
| F3 | 守卫全量重定位（宽模式 grep `registry[` 18 处逐个过滤）＋Node v22 语义实测 | 勘误×1＋交叉观察 R1 |
| F4 | 规格面（§E／同机不设防）＋`BOT_ID_HEADER` 全仓三面定位 | 补生产者坐标 |

**勘误（3 处）：**

1. detectBotInstance 守卫实为快照 **1711** 行（上文 F3 已改）。
2. **F1 复现签名陷阱**：`writeReceipt` 第 3 参为对象
   `(dshHome, botId, {messageId, seq, outcome})`（`lib/mail-plane.js:291`）——
   传裸值水位不生效，会得到「场景 B（有水位回放）假阴性」。复核方重跑请用
   对象参数。
3. baseline 实际落盘路径补坐标：`bots/inbox/<botId>/receipts/.baseline.json`。

**增量观察：**

- **R1（F3 同源，新）**：`uniqueId`（`lib/index.js:513-520`）的判重同用
  `registry[base] === undefined`——以原型链名建实例（如「Constructor」经 slug
  小写化）时 base 被继承属性判「已占用」而得 `constructor-2`。同一 truthy
  判定在 uniqueId 是**意外的防护**（撞名创建不出）、在管理面守卫是**意外的
  放行**（伪 404 缺失）——F3 残面不止影响不存在 id 的查询，也影响正常创建
  路径的命名（用户可见症状：实例名莫名带 -2 后缀）。已立 Q6。
- **R2 资源泄漏专项（本票初版未列类别；无新增高置信风险，登记证据备查）**：
  probe 子进程（`lib/org/probe.js:299-366`）spawn 同步抛有 try＋副本 GC＋
  resolve 拒绝结论、超时 `SIGKILL`＋`timedOut` 单列、`error`／`close` 双出口
  cleanup 幂等（孙进程占管道为 33 号票在案取舍）；inbox watcher
  （`lib/index.js:2515-2521`）disposer 置 stopped＋clearInterval＋`unref`＋
  busy 门；锁目录（`lib/lock-dir.js`）无句柄长持、owner.json 写失败残锁
  ≤1000ms 自愈；其余窗口写路径（mail-plane／knowledge）同步 IO＋原子写。
- **R3 `89d2721`（#25/#27/#28）正面确认＋补查收尾**：台账关闭命令异步检查后
  幂等重放优先（`lib/org/task-ledger.js:1255`）＋CAS 重读＋登记面纯同步重验
  （`:1287`）；复核面重放不续签新帽（`lib/org/ledger-host.js:468`，
  `result.replayed !== true`）——并发收窄，非风险引入。运行错误／数据丢失类
  补查：窗口内 `lib/index.js` 仅 6 行锁留痕 logger 透传（`4e4bbfd`）；
  knowledge.js 锁外变更均为 34 号票守卫收紧（处置在案）——未发现本票之外
  的新增高置信风险。

**复核验证记录：** 干净副本（`git archive HEAD`→临时目录）`node tests/run.mjs`
**70/70**、`node scripts/preflight.mjs` **exit 0**；F1 三场景活体复现（含签名
修正一次，输出与上文一致）；F3 原型链五名语义实测（空注册表上
`toString／constructor／hasOwnProperty／valueOf／__proto__` 的
`!== undefined` 全真、`Object.hasOwn` 全假）；`BOT_ID_HEADER` 定义
（`host-channel.js:17`）／生产者（`post-channel.js:146` readHandoff）／消费者
（`ledger-host.js:429`）三面定位。未执行：宿主启动、HTTP/UI 端到端、混部
部署实测（同本票边界）。

## Comments

- **处置（2026-09-29，用户 `$implement 37`）**：F1／F3／R1 已修复（本批实施，
  与审计方/复核方不同会话）；F2／F4 属用户裁定项，登记如下待裁；Q5 随 F1
  消解。票面 Status 置 `ready-for-human`＝剩余 Q2/Q4 两项人工裁定。
- **Q1（F1）裁定与修法**：迁移基线机制保留（#35 在案「存量基线认」不受动）；
  「目录已存在＋零 receipt」的吞没判定收窄——修复兑现 `lib/index.js` 既有承诺
  （「停机期间到达的邮件在重启后回放，不再丢失」「fresh bot 的首封邮件不会被
  基线吞掉」），不是新口径。区分信号＝**新消费机制痕迹**：`receipts/` 目录
  存在（`create` 预建＝「实例诞生于新语义」）或 `responses/` 有已落盘标记
  （claim 后 finalize 前中断＝崩溃残留）→ `{lastSeq:0, replay:true}` 全量回放、
  不落基线；痕迹全无 → 维持旧数据迁移基线（B3 上线存量不重触发）。审计的
  可达路径 1（未启动即收首封）与路径 2（首封处理中崩溃）均被覆盖；路径 3
  （F2 复合）见 Q5。**保存量取舍**：修复上线前已存在的「无痕迹零 receipt 存量」
  仍走迁移（无法与 B3 前旧数据区分；保存量稳定优先，运维如有个案可参照
  「预建 receipts 目录后重启实例」手动转回放——未自动迁移，留人工判断）。
- **Q2（F2）待裁定（不修）**：#35 在案裁定单腿 POST（票面明确「非 POST 一律
  405，连中继都不进，零写」），加 GET 兼容＝推翻在案裁定。接受方评估：维持
  协议；混部窗口期旧实例游标腿 405 停摆（fail closed、消息不丢），恢复＝
  实例升级重启。**请裁定**：是否需要在 16 号票 cutover 步骤中点名「先升 host、
  逐实例确认重启后游标腿恢复」（16 号票成品在制未提交，本批未触碰其文件；
  建议随 16 号票人工验收一并核对）。
- **Q3（F3）已修**：`39adf0b` 的 `hasRegisteredBot` 口径铺到管理面——`get／
  patch／remove／start／stop／send／inbox／messages／stats` 9 处守卫＋
  `detectBotInstance`＋`create` 的 409 占用判定，判定自 `lib/org/mail-relay.js`
  导出单源复用。原型链名（toString/constructor/hasOwnProperty/valueOf/
  __proto__）一律 404；remove 的伪 `deleted:true` 消除。
- **Q6（R1）已修**：`uniqueId` 判重同口径（`isIdAvailable`＝自身字段即占用，
  判重从紧于读面并已注明白）；原型链名不再莫名带 `-2` 后缀。`__proto__` 经
  slug 清洗（`[a-z0-9-]`）恒不可能成为 id，无需保留字防护（评审确认赋值/
  序列化/加载 roundtrip 无残留坑）。
- **Q4（F4）待裁定（不修）**：同机信任边界在案（`lib/api-security.js` 自述
  同机不设防）；接受方评估＝维持现状不属「新增越权」。**请裁定**：①该边界
  是否维持；②F1 修复后 cursor 触发的基线写只剩真迁移场景，但「代他实例推进
  水位/触发回放」仍可经 `_mail` 直达——是否需要与台账面不同强度的绑定。
  （F4 若裁定收紧，因 `hasResponseMarks` 判据，冒充他实例 cursor 的攻击面还
  含「人为制造回放」——修复不扩大原风险，登记备裁。）
- **Q5 已消解**：F1 修复后，停摆期积压对「预建痕迹实例」升级后回放（不再
  吞没）；对修复前 create 的存量实例维持迁移语义（同 Q1 保存量取舍）。16 号
  票切换清单是否加「逐实例确认首封消费水位」核对项，并入 Q2 裁定。
- **实施与验证凭据**：改动＝`lib/mail-plane.js`（`initialMailCursor` 判据＋
  `hasResponseMarks`）、`lib/index.js`（守卫 9+1 处＋create 占用判定＋预建
  receipts＋`uniqueId`/`isIdAvailable`＋watcher 注释）、`lib/org/mail-relay.js`
  （`hasRegisteredBot` 导出＋cursor 注释）、`tests/mail-at-least-once.test.mjs`
  （F1 三用例）、`tests/registry.test.mjs`（F3/R1 三用例＋跑批器支持 await）。
  TDD 先红后绿；全量 **72/72**（工作树含 16 号票在制品，合并态验证）、
  preflight **PASS**（①72/72 ②0010 冻结面 10/10 ③0 违例 ④宿主契约
  12 PASS／0 FAIL／0 SKIP）。/code-review 双轴：Spec 缺失 0／越权 0／实现
  错误 1（create 的 mkdir 顺序，已处置：前移至写注册表前）；Standards 硬违规
  0（落档随 `EV-20260929-risk-audit-37-fixes` 完成）。未启动宿主、未做 HTTP/UI
  端到端、真实运行面零写入。
- **并行批次边界**：16 号票成品在制（工作树 staged＋未跟踪新文件），本批
  未触碰其任何文件；`lib/index.js`／changelog 卷为两批共改文件，提交经
  patch 拆分隔离归属（见提交说明）。本票票据与 CHANGELOG 事件随本批提交。
