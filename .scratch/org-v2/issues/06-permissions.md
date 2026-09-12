# 权限模型

Type: grilling
Status: resolved
Blocked by: 03

## Question

每岗能碰什么：文件面（「真实运行面零写入」纪律的 bot 版映射）、工具面、
数据面（mail/knowledge/review）；最小权限与 capability 边界；与 host 侧
既有边界（CSRF/代际绑定/env 白名单）的关系——组织层权限是复用、加严还是
另起。

## 来自 04 号票的输入（2026-09-10 裁定）

- capability 机制（`lib/review-capability.js`：HMAC 单次、绑定实例的通用权限
  原语，覆盖面含 `job.*`／`evidence.*`／`artifact.*`）**保留为 v2 通用权限原语**；
  其岗位化封装归本票定。
- 复核者权限面＝**只读**（只看 diff＋判据、报 gaps，不得改工件）——本票须给出该
  只读面的机制，并说明与既有 read-only 模式／工具面禁用清单的关系。

## 来自 05 号票的输入（2026-09-11 裁定）

- **台账写入权威**：任务台账＝host 侧 append-only 事件日志、**单一写者**；bot
  不直写台账文件，经 host 命令提交（05 Answer §9b）。本票须给出该命令面的最小
  权限模型：哪类岗位可提交哪些命令、CAS／幂等键、越权拒绝语义。
- **复核者只读面**：「当次空闲实例」＝台账中无进行中租约的实例（05 §12），排除
  本任务产出方；复核者可跑可执行检查（runProbe）但不得改工件／放宽判据／改口径
  （04 Q3）——只读面须与此衔接。
- **投递层与台账分界**：mail 不再是任务语义承载面（05 §1／§9b②）；权限模型里
  mail 写入与台账命令写入须分开定界。

## Comments

### 2026-09-12 前置事实（只读代码调查，供 round 1 与 Answer 引用）

1. **capability 原语现状**（`lib/review-capability.js`）：HMAC-SHA256 envelope
   `{payload,sig}`；op 白名单 9 项（`review.execute`／`artifact.read|submit`／
   `evidence.read|probe`／`results.read`／`job.claim|heartbeat|report`）；单次
   消费 nonce（`wx` 独占文件、30 天保留清理）；TTL 默认 1h；实例绑定＝
   instances.jsonl 该 bot 最新行五字段（botId/pid/startedAt/hostInstanceId/at）
   全等＋pid 存活；job 级独立槽位＋bot-wide 兼容镜像；issue/revoke 共用
   capability-state 锁、ledger O_APPEND 追加为线性化点、崩溃由 reconcile 以
   ledger 自愈；损坏/旧格式一律 fail closed。**binding 严格 schema 已含
   `taskId`**（必填 invocationId/taskId/sourceSnapshotId、可选
   taskSpecArtifactId，F-RV-25）——任务域绑定面已存在，不必新造。
2. **实例基底**（`lib/shared.cjs:17-35`）：`PERMISSION_MODES`＝read-only／
   workspace-write／danger-full-access（与官方 preset 对齐）；read-only＝
   禁 6 条 shell/写工具＋sandbox mode＋approval=ask；每实例独立
   workspaceRoot。权限模式是注册表实例字段（用户域旋钮）。
3. **共享数据面写入路径（无 writer ownership，GROK §7.2 点名）**：
   `send_mail`＝bot 实例进程内注册的 agent 工具（`lib/index.js:2049-2152`），
   实现直接 `appendMessage` 写**目标 bot 的 inbox**（跨进程 `.seq.lock` 互斥）；
   `knowledge_search`/`knowledge_register` 同为进程内工具（`lib/index.js:2180-2280`）
   直写共享知识索引。即：插件工具代码＝受信进程内直写，不经沙箱、无
   capability 门槛；「谁能写哪个共享面」目前只由代码路径约定，无授权模型。
4. **host 既有边界**：变更面 CSRF 令牌门控（`GET /api/bots/_csrf`＋头
   `x-dsh-bots-token`，B1；`lib/index.js:1486-1512`）；持有有效令牌的请求＝
   本机部署唯一用户（role=user，`lib/index.js:3368`）；spawn env 白名单＋
   逃生阀＋凭据形态绝对拒绝（B4-01，`lib/spawn-env.js`）；进程代际绑定
   （`lib/pid-bind.js`＋实例注册表，CONTEXT.md「代际绑定」）。
5. **数据面授权现状总表**：review 面＝capability 门控（最强国）；台账＝v2
   新面（05 已决 host 单写者）；mail/knowledge 面＝进程内直写（无授权模型）；
   web 客户端＝CSRF→user principal；注册表/进程控制＝host 专属。

## Answer

2026-09-12 用户 /wayfinder 逐票工作批收口：round 1 八问、round 2 两问均经
用户裁定（「无异议」＝按推荐方向；授权依据见 CHANGELOG 当日条目）。前置事实
见上方 Comments（只读代码调查，生产面零写入）。

### 1. 权限分层总轴（Q1＝四层模型；复用＋加严，不另起）

| 层 | 面 | 内容 | 与既有边界关系 |
|---|---|---|---|
| L0 | 实例基底 | DSH sandbox 权限模式（read-only／workspace-write／danger-full-access）＋workspaceRoot | 用户域实例旋钮，照旧，组织层不接管 |
| L1 | 文件面 | bot agent 直写仅限自身 workspace；一切共享面零直写，读写经 host 命令 | 加严（§2） |
| L2 | 组织命令面 | capability（单次消费＋实例绑定＋op 白名单＋taskId 绑定）岗位化封装＋台账命令三元组鉴权 | 新增（§4–§6） |
| L3 | 人间面 | CSRF 令牌＝唯一 user principal（role=user）＝台账全权 | 复用（§7①、§10） |

否决项：岗位级 ACL 覆盖文件系统路径（把组织规格绑死在文件布局上，违背 11 号
票宿主面更迭义务）；「只给台账加 capability、其余不动」（mail/knowledge 无
授权模型的现状被带进 v2，GROK §7.2 点名的共享面 writer ownership 缺口不闭）。

### 2. 文件面（Q2＝两硬线）

1. **bot agent 直写面＝自身 workspace**（sandbox 模式硬约束，现状即是）；
2. **`~/.dsh` 全域对 bot agent 零直写**——注册表、profiles、其他实例
   workspace、mailbox／knowledge／review／台账数据目录；共享面读写一律经
   host 命令。

配套线：冻结面（证据包链）零写、只读，沿用既有纪律；跨实例工件移交不经
文件系统、走 artifact 提交；读边界本票只锁凭据形态不透传（env 白名单已做）；
GROK §4.5 式敏感路径 denylist＝实现轨道可选项，不入组织规格决议。

### 3. 数据面写入权三分界（Q3）

- **mail（零权威线）**：邮件内容**永不构成权限、状态或事实依据**——authority
  只认 capability 与台账事件；投递保持低摩擦（任何实例可向任何实例投递，
  consult 语义），写入不设 capability 门槛；是否物理收口为 host 中继（writer
  ownership）归 07（装载）／12（存废）接线。零权威使「冒写邮件」最坏造成
  困惑、改不了任何状态——无权威通道不加授权。
- **台账**：bot 零直写、只经 host 命令（05 已决单写者），鉴权见 §6。
- **knowledge**：登记权**全员**保留（「谁产出谁登记」纪律），读取全员＋直读面
  （W-1a）沿用；**登记不构成任务完成依据**（完成＝台账 delivered）；物理命令
  化归 07、晋升与记忆边界归 10。

### 4. capability 岗位化封装（Q4＋Q9＝op-set 表＋签发/续签/吊销）

**op-set 岗位表**（命名空间草案，规格阶段与 07 命令清单一并微调）：

| 岗位/帽 | 可持有 op |
|---|---|
| duty-coordinator（值班统筹） | `task.intake`／`task.triage`／`routine.*`（duty 线派单语域并入）／`ledger.read` |
| project-lead（项目经理） | `task.create`／`task.assign`／`brief.amend`／`task.settle`／`review.request`／`ledger.read` |
| researcher·implementer（承接岗） | `task.claim`／`task.accept`／`task.report`／`task.escalate`／`artifact.read|submit`／`evidence.read|probe`／`ledger.read`（Q9：全员组织事实读） |
| verifier（复核帽） | `artifact.read`／`evidence.read|probe`／`results.read`／`review.report`——**无 `artifact.submit`、无 task 状态写、无 `ledger.read`**（Q9：独立性机械成立） |
| 人间面（user principal） | 台账**全权**（§10），不经岗位 op 表 |
| 运维（实例启停/注册表 CRUD/模型指派） | 人间面专属，**不设岗位 op**（与 03「实例管理不设岗」一致） |

三条结构主干（表可微调、主干不重开）：**岗位只决定「可持有哪些 op」**；
**签发权在 host、由台账转移点驱动**（assigned→给承接者签 task 能力；复核点
命中→给戴帽实例签只读能力；bot 不能自请自签）；**吊销与生命周期联动**
（租约回收／取消／关闭／delivered→host 自动吊销对应能力，现 job 槽模式扩展
为 task 槽）。

机制参数：单次消费语义不变；长任务＝**短 TTL＋心跳续签**（`job.heartbeat`
模式已有）；任务域绑定＝现有 `binding.taskId` 严格 schema 字段（复用，前置
事实 §1）。

### 5. 复核者只读面（Q5＝op-set 否定式）

复核帽的只读＝**op 集里没有写操作**（无 `artifact.submit`、无 task 状态写），
工件面本就零直写（§2）——「读不到写通道」即只读。复核实例自身 workspace
可写（本地草稿），不触及工件面。runProbe 走 `evidence.probe`（受控执行、
产物只进报告），已在 op 表内。

与既有 read-only 模式／READ_ONLY_TOOLS 的关系＝**正交且叠加取严**：实例基底
（sandbox＋工具禁用表）管 agent 工具面（用户域），任务域（capability op-set）
管 host 命令面，各自独立生效、不得互替。否决「切实例 sandbox 为 read-only」：
帽子是任务域契约不该动实例基底（并行任务误伤），且 READ_ONLY_TOOLS 管不住
host 命令面（机械缺口）。规格须写明叠加语义，防实现混用两套口径。

### 6. 台账命令面鉴权（Q6＝三元组＋CAS＋幂等＋fail closed）

- **三元组鉴权**：①实例活态（capability strictCheck 家族：验签＋nonce 单次＋
  代际绑定＋活态槽比对）；②op ∈ 岗位白名单（§4 表）；③任务域匹配
  （binding.taskId 全等；`task.report` 类命令要求当前租约持有者）。
- **CAS**＝命令携带期望状态（expectedStatus/expectedSeq），不符即拒（乐观
  并发，防两命令竞争推进同一任务）。
- **幂等**＝命令自带 idempotencyKey（`routineId+window` 为特例，05 已决）。
- **拒绝语义**＝fail closed 不执行；拒绝本身记为**台账事件**（05 Q7「不静默
  丢失」家族）＋错误回执给发送方；连续越权→通知派单方并计入上浮（阈值数值
  属用户域）。

### 7. host 既有边界归位（Q7，复用＋加严的落地清单）

1. CSRF／user principal＝人间面专用（09 细化投递面），岗位实例**不持有**
   user principal；
2. 实例身份注册表（五字段代际绑定）＝capability 唯一绑定源，冻结语义照用
   不重开（F-RV-17 家族）；
3. env 白名单＝spawn 基底照旧，组织层**不**加每岗位 env 集（无场景）；
4. GROK §4.4 的 per-bot loopback token、认证升级、typed RPC frame 等＝实现
   轨道（PLAN），不入组织规格；规格只锁一条语义线——**组织命令必须经认证
   的 host 通道**。

### 8. danger-full-access 与岗位契约（Q8＝岗位-权限解耦＋恒久判据加严）

权限模式＝用户域实例旋钮（与 03「岗位-模型解耦」同构）；岗位卡不硬编码权限
模式。组织侧约束两条：恒久判据（08 号票）加「**无岗位契约以
danger-full-access 为履约前提**」（全部岗位 workspace-write 可履约）——若某岗
依赖无边界即履约，放大器叙事崩塌为单机裸跑；岗位卡第 8 字段（依赖面·更迭
敏感性）记载本岗权限依赖面（所需 sandbox 模式）。

### 9. `ledger.read` 授予范围（Q9）

四个常设岗**全员 `ledger.read`**（台账＝append-only 组织事实，扁平对等协调
需要透明；事件行含 actor/at/reason，属组织事实非推理轨迹；免去按任务过滤的
读投影工程）。复核帽**无 `ledger.read`**——事件行 `reason` 承载产出方行动
理由，全量读＝窥见中间过程的通道，与 04「读不到产出方推理轨迹」（fresh
context 硬要求）相抵；复核输入只经派单方递送（diff＋判据＋工件本体），
「读不到即独立」成为机械事实。

### 10. user principal 的台账命令权（Q10＝全权）

L3 与 L2 的衔接线：user principal 可发**一切台账命令**（建任务、取消、结算、
关闭、复核请求……），不经岗位 op 表——岗位是用户意志的代理层，代理层授权表
反向约束委托人于理不通；且 09 人间终裁原语本就要求 user 对关键转移有直接
命令权，受限方案会在 06 op 表与 09 终裁两处重复定义 user 能做什么。审计线：
user 命令与 bot 命令同走台账事件（actor=user），可见性不降。

### 11. capability 递送通道（Q3 推导线，无需裁定）

capability 信封的递送**不经 mail**——若经 mail 递送则 mail 实质成为权威递送
面，与「邮件零权威」（§3）矛盾；递送面＝认证的 host 命令通道（如
`task.claim` 成功响应携带）。泄漏无害性由实例绑定保证（botId＋代际绑定，
他实例不可用）。

### 归位（交由下游票）

| 事项 | 归位 |
|---|---|
| 命令工具装载、capability 递送实现、mail host 中继接线位、knowledge 命令化 | 07 |
| 恒久判据加「无岗位以 danger-full-access 为履约前提」 | 08 |
| user principal 全权与终裁界面、越权/拒绝通知到人形式 | 09 |
| knowledge 登记权全员＋「登记≠完成依据」的晋升侧表述 | 10 |
| capability 存续细化、实例基底×任务域叠加取严的实现口径、mail 零权威纳入存废判定 | 12 |
| 权限面验收候选（四层各层可检验、复核帽无写通道、认证通道线） | 13 |

### 证据与限制

- 依据＝只读代码调查（Comments §1–§5，坐标内嵌）＋上游票 03/04/05 裁定＋
  本地 GROK 对比报告 §4.4/§4.5/§7.2/§10，**不依赖网络**，无待补充轮标注。
- 本票只产决策、不产代码；实现与迁移由规格 → /to-spec → /to-tickets →
  /implement 承接（并存策略归 12 号票）。


