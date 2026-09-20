# dsh-bots 变更日志（CHANGELOG）

逐轮演进记录，自 docs/PROJECT_UNDERSTANDING.md 迁出（第一轮＝整页 Bot 模式架构落地，
见 docs/PROJECT_UNDERSTANDING.md「当前状态」节；此处从第二轮起，新条目往后追加）。

**落档强制规范（2026-09-04 用户裁定）**：任何编码审查一旦实施、或方案一旦确认，
必须在对应文件中编辑落档（六类事件的落档位置表见 README §6.2）——未落档的
会话结论不构成项目事实。

- ✅ 本轮（org-v2 **12 号票：恒久性判据与模型升级例程**——用户点名 `/implement 12` ＝授权；
  「哪些文本不许含模型假设」落成可判定的封闭集合，模型更迭例程①触发真正接线；TDD 四缝
  先红后绿；**13 文件 +2190/-31（2 新件：lib 1＋测试 1）**）：
  - **范围**：`.scratch/org-v2-build/issues/12-durability-and-upgrade-routine.md`（七条验收全勾＋
    Status→resolved＋Comments 凭据）＋`.scratch/org-v2/spec.md` §J（D1–D11 由名称列表升为逐条
    表述）＋`CONTEXT.md`（「岗位评测集」词条补落地坐标）＋本条目；机械面＝新件
    `lib/org/durability.js`（新）／`tests/org-durability.test.mjs`（新）＋
    `lib/index.js`、`lib/org/{brief,review-kit,dispatch-config,ledger-host,memory-layer}.js`、
    `tests/org-memory-layer.test.mjs`。
  - **变化（四缝）**：
    **① 白名单封闭枚举＋换模型试金石＋模型假设扫描（`V-A7.1`／`V-A7.2`）**——新件
    `durability.js`：七类组织层件（协作协议／任务台账／复核件套／权限四层／岗位卡 1–6·8 字段／
    知识库容器协议／宿主适配面登记表**容器协议**）逐条记试金石问答（「换一个更强模型，这条会
    变成废话或障碍吗」）与存活理由；条目坐标＝规格 §J 锚串（**改措辞即漂移**）＋容器模块（仓内
    逐个解析），负例注入即转红。扫描＝组织层件**非注释行**禁模型特定假设（模型族名／上下文窗口
    与预算数值／推理等级与采样旋钮；注释豁免——说明「为什么不绑模型」不是假设）；宿主适配面只扫
    **容器协议区**（字段集与登记纪律），条目内容＝运行时资产（宿主包名与模型 pin 不属组织层假设，
    `region.untilMarker` 裁剪，扫描件可自证不含条目内容）。岗位细节三处（岗位卡第 7 字段留空／提示段
    派生物／实例配置）坐标机械把守——第 7 字段非空、渲染器缺位、指派字段离注册表写面即红。
    **② D1–D11 表述与覆写出处（`V-A7.3`）**——判据注册表 `DURABILITY_CRITERIA` 持**权威表述**
    （规格 §J 须逐字在册，两处任一侧漂移即报违例）；被覆写的 **D5／D8 覆写出处＝07 号票工具面裁定**
    （注记须**紧随各自表述**，挂在别的判据下蒙混不过关）；清单封闭性由「§J 出现的判据号⊆D1–D11」
    把守（D12 之类即清单破口）；价值表述（裸实例＝同权限面、**同基础工具面、无组织命令**）与放大
    验证设计要件（3–5 按机制各取一／对照＝上述裸实例／不做对照组消融／一次性规格验收实验）同扫描面。
    规格 §J 由名称列表升为 **D1–D11 逐条表述**（与模块逐字一致；覆写出处各作独立注记行——lib 词表
    无该旧词，`V-A4.8` 扫描照旧零命中）。
    **③ 岗位评测集（`V-A7.4` 形状）**——6 个冻结样本覆盖**五类角色类别**（值班统筹 2＋项目经理／
    研究员／实施者／复核者各 1，1–3 个/岗）；样本＝**契约回放简报**（`validateBrief` 合法＝判据
    可执行），输出格式登记表 `EVAL_OUTPUT_FORMATS` 记**结构记号**（裁定包五件／四要素键／复核报告键
    从 `human-inbox PACKET_PIECES`／`brief BRIEF_KEYS`／`review-kit REPORT_KEYS` **真源枚举派生**，
    为此导出 `BRIEF_KEYS`／`REPORT_KEYS`）；`sampleTouchstone` 三判——样本零模型记号、`fs.contains`
    判据须为声明格式的短结构记号（散文式期望＝依赖特定输出风格即红）、试金石理由非空；
    评测产物落**受影响实例自己的 workspace**（`bot-workspaces/<botId>/eval/...`，L1 可写面内）。
    `memory-layer` 的 `ORG_CONSTANT_FACE` 评测集由 `pending` **落位**（坐标＝`durability.js`，
    待办集清空）。
    **④ 升级例程①触发接线（`V-A7.4`）**——`BotsApi.patch` 的 modelChanged 腿在注册表写入后调
    `registerModelUpgradeEval`：按岗位取评测样本逐样本登记 `class=duty` 评测任务（例程登记项由评测集
    **派生**，id＝`eval-<样本 id>`，触发源＝`registry:model-assignment-changed`，模板展开过 `validateBrief`），
    幂等窗＝`实例:样本:目标指派`（换目标指派＝新窗另开一张；同一指派重复落地＝同窗重放，不产生第二张）；
    登记只入队列（`owner: null`，**不代派单**）。四类跳过**显式点名理由**（未绑 home 岗位／目标指派
    为空／岗位无样本／缺实例 id），台账未接线＝告警＋结论件 `wired:false`（不假装登记成功）；
    ③做减法／④用户终裁是流程纪律，坐标在 `UPGRADE_ROUTINE_STEPS` 点名、终裁仍走人间收件箱（不新造
    命令面）。新件 `ledger-host.registerModelUpgradeEval` 只落台账命令面（单一写者不变）。
  - **验证结果**：TDD 四缝各自先红后绿；`tests/org-durability.test.mjs` **33 项**（白名单齐备与负例／
    扫描负例与注释豁免／容器协议区裁剪与标记 fail-closed 负例／三处坐标／D1–D11 在册与三种负例／
    判据坐标解析与覆写出处回核（各带负例）／价值表述要件／评测集形状与记号单源（真源解析负例）／
    例程登记项展开与触发源前置门／host 登记腿幂等与台账绑定／`BotsApi.patch` 端到端）；全量
    `TMPDIR=/dev/shm npm test` **58/58** ✅；preflight 四门 **exit 0**（①58/58 ②冻结面 0009 包 7/7
    ③0 违例扫 69 md ④11 PASS / 0 FAIL / 0 SKIP）；冻结面零改动；真实运行面零写入（夹具全在临时
    DSH_HOME，`patch` 腿走内置脚手架回退路径）。
  - **复审（`/code-review` 双轴并行，HEAD 冻结后重放）**：Standards 硬违例 1／judgement 6；Spec 缺失 3／
    越权 3／偏弱 3，**逐条处置**——硬违例＝「记号真源自称」：格式表改 `derivation`（卡面契约锚在
    `ioContract` 正文解析、模块导出锚在模块正文解析且记号须与真源枚举**等值/子集**），`prescribedBy`
    降为人读说明；偏弱项＝封闭枚举改**冻结字面量＋集合等值判定**（原来拿白名单验证白名单）、判据坐标
    逐条解析仓内模块、覆写出处回核 07 号票裁定件正文、触发源声明改**登记腿前置门**（fail closed）、
    样本派生解析到真在册卡面、容器协议区标记缺失改 fail closed（原来静默退回全文件扫）、记号副本三处
    收敛为 `formatMarkers()` 单源读、读回落三份收敛 `readTextOrEmpty`、`EVAL_SET_VERSION` 进校验结论件、
    测试改引 `SPEC_PATH`、头注「walk 取 face-scan」订正；②步绑定补强＝绑定写进台账事件
    （`routineId`＋含实例 id 与目标指派的幂等窗，回归锁在案）。**越权面三项经复核保留**：`BRIEF_KEYS`／
    `REPORT_KEYS` 导出（记号从真源枚举派生，正是单源纪律要求的）、`PATCH` 响应新增 `modelUpgradeEval`
    字段（实况可见：未接线/跳过/登记结果不静默）、`ROUTINE_REGISTRY` 增评测例程段（08 号票
    「评测集＝值班统筹维护的例程登记项」的正解，由评测集派生不手抄）。
  - **留界（在案）**：①**`V-A7.4` 级别面**——该条在附录 A 的级别＝实验期一次（升级演练／增量包证据），
    本票交的是常驻面（登记腿＋形状锁＋坐标解析随每批回归），**演练与增量包证据未做**（依赖 16 号票切换批
    后的活台账与真实实例；部署同步/重启链属用户点名段）；§J ③「质量不降则删指令」与 08 §4「新旧模型各跑
    一遍比对」属评测方法面（执行实例内做、结论经复核件套投递用户终裁），不为其造机械替身。
    ②`create()`（新建实例带初始模型指派）**不触发**评测登记——触发面是「改指派」（有变更前值可对照）；
    出带外注册表编辑（绕过写面 API 直改 `bots.json`）同样不触发（登记腿挂写面，不设文件监视）；如需
    覆盖，走显式规格修订。③评测任务的实际执行（②步）与结论投递由常驻编制承担，与 `memory-layer`
    五策略函数的消费面同口径留界（16 号票切换批之后）。④README §2 地图零改动（本次无新增/移动文档，
    `.scratch/` 不属地图成员；规格扫描面显式点名 `.scratch/org-v2/spec.md` 并写明理由——地图只管
    `docs/` 面，org-v2 语义权威在工单轨）。⑤**纪律补正（用户点名）**：本会话首轮未显式调用 `/tdd`
    即按理解做「先红后绿」，违反 `AGENTS.md` §5；经点名后显式载入 `/tdd` 全文并按条文复核——四缝与用户
    确认，红→绿按缝留痕，并修掉技能点名的同义反复断言（用被测助手回推期望窗 → 改字面量期望）。
  - **授权依据**：2026-09-20 用户点名 `/implement 12`。

- ✅ 本轮（org-v2 **11 号票就地优化批**——用户点名「结合并行实现中的较优部件就地优化入库件」＝授权；四项缺陷修复＋一项单源收敛，TDD 各缝先红后绿；**9 文件（6 lib＋3 测试）**）：
  - **范围**：本条目＋票面 Comments 优化批注记；机械面＝`lib/index.js`／`lib/org/{mail-relay,mail-client,host-channel,post-channel,ledger-host}.js`＋`tests/{watcher,org-mail-relay,org-mail-shared-face}.test.mjs`。
  - **变化（四缝＋单源）**：
    **① watcher 通道中断游标回滚（行为缺陷修复，最重一项）**——`scan()` 此前在读盘后、消费循环**前**就把字节游标推进到 EOF（`offset = size`），消费中止（通道未达 `handleIncoming === false`）只 `return` 不回滚：下一拍因 `size === offset` 早退，**未消费邮件滞留到进程重启**（通道恢复也不重读），且中止日志「下拍重试」名实不符——`V-A4.7` 分支一「通道不可用→有限重试」在消费路径上打折。修法＝记 `offsetBeforeRead`，中止分支回滚 `offset`＋清 `pending`（已消费行由内存 `lastSeq` 过滤，重读不产生重复回合；不按序越过未消费件）。回归锁＝`watcher` 场景 4（测试闸门：断→不消费→恢复→下拍重读恰一次）。
    **② 未接线 503＋中继异常 503（fail-closed 语义修正）**——`_mail` 面中继未接线此前回 **404**（客户端把它归为不可重试的语义失败，与三分支口径相悖）改 **503 `mail-channel-unwired`**（通道不可用分支：客户端按分支一有限重试）；中继调用统一 `relayCall` 包装——内部异常＝**503 `mail-relay-failed`**（投递面故障可重试），不再裸 500（`send`／`consume`／`cursor` 三腿同口径）。
    **③ 身份类拒绝留痕收全（`V-A4.7` 分支二）**——relay 核验出的身份拒绝（`mail-sender-unknown`＝发信者不在册等）此前 403 透传**既无事件也无日志**；改与通道层身份检查同走 `rejectAuthz` 留痕腿（op 按动作分 `mail.send`／`mail.consume`）。
    **④ 留痕锚点自洽加固（零权威线）**——`createMailRejectionRecorder` 此前「负载自报 `taskId` 且台账认账即落 `command-rejected`」：身份认证失败时 actor 不可信，**未认证方可向任意在册任务植入拒绝事件**。收紧＝自报 `taskId` 须台账认账**且** actor 在该任务承担链（`owner`／`dispatcher`）上才落事件（冒名面收窄为「冒充任务承担者」，事件与台账事实自洽）；无自洽锚只留 host 日志（原「actor 缺失回落 host 身份落事件」删除——非认证身份不进台账）。
    **⑤ 身份头单源（02 纪律）**——`x-dsh-bots-bot-id` 字面量四处（`mail-client`／`mail-relay` 新增＋`post-channel`／`ledger-host` 既有）收敛为 `host-channel.BOT_ID_HEADER` 单一登记源，`org-mail-shared-face` 加扫描锁（消费面内联字面量即红）；`host-channel` 的 `TOKEN_HEADER` 同步接 `api-security.js` 真源。
  - **验证结果**：TDD 四缝各自先红后绿（watcher 场景 4／relay 未接线 503＋ghost 留痕＋中继异常／recorder 关联负例／身份头扫描锁）；scoped 6 件全绿（relay 8／shared-face 9／client 6／post-channel 11／ledger-host 15／watcher 含新场景）；全量 `TMPDIR=/dev/shm npm test` **57/57** ✅；preflight 四门 **exit 0**（①57/57 ②冻结面 0009 包 7/7 ③0 违例扫 69 md ④11 PASS / 0 FAIL / 0 SKIP）；冻结面零改动。
  - **授权依据**：2026-09-20 用户点名「结合并行实现中的较优部件对 11 号票入库面就地优化」。

- ✅ 本轮（org-v2 **11 号票：mail 收口与形态改造**——四项口径经 AskUserQuestion 裁定＝授权
  （领 11 号票／严格收口／保自动回信且回信锚＝`replyTo`／TDD 三缝）；票面 8 条验收全勾；TDD 红→绿
  按缝①→缝③推进；**19 文件 +682/-374 ＋ 10 新件（6 lib ＋ 4 测试）**）：
  - **范围**：`.scratch/org-v2-build/issues/11-mail-relay-and-form.md`（验收勾选＋Status＋Comments
    凭据）＋`CONTEXT.md`（新词条「投递面与 mail 中继」）＋本条目；机械面＝新件
    `lib/org/{mail-relay,mail-client,host-channel,mail-shared-face,vocabulary-face,face-scan}.js`、
    `lib/{index,mail-plane,client}.js`、`lib/org/{op-set,post-channel,permissions,ledger-host}.js`
    ＋测试 13 件（4 件新：`org-mail-relay`／`org-mail-client`／`org-mail-shared-face`／
    `org-vocabulary-face`）；新件合计 10（lib 6 ＝ `mail-relay`／`mail-client`／`host-channel`／
    `mail-shared-face`／`vocabulary-face`／`face-scan`，测试 4）。
  - **变化**：
    **①host 中继命令面（缝①）**——新件 `mail-relay.js`：`createMailRelay`（`send`／`consume`／
    `cursor`＝**投递面唯一写入口**；投递者词表＝在册实例∪用户 principal；负载键封闭，夹带状态类
    键即拒；幂等回复三锚去重＝`replyToMessageId`（outbox）／`replyTo`（inbox 自动回信）／
    `idempotencyKey`（通道重试）；`consume` 带**归属校验**——汇报的 `(messageId, seq)` 须确在该
    实例 inbox 内，伪造 receipt 不再能经异常汇入凭空造出台账异常）＋`createMailHttpApi`（`_mail`
    面 `send`／`consume`／`cursor`：actor 认证、**零 capability 门槛**、host 身份不得声明、
    未接线 404 fail closed）＋`createMailRejectionRecorder`（鉴权拒绝的**台账留痕**：有任务锚落
    `command-rejected`，无锚只留日志——分支二的 mail 侧形态）。`lib/index.js` 接 `_mail` 路由、
    实例化中继，`BotsApi.send`（用户→bot）改走中继。
    **②bot 侧零直写接线（缝②）**——新件 `mail-client.js`（通道腿 `send`／`claim`／`finalize`／
    `skip`／`cursor`，**零文件面**）＋`host-channel.js`（CSRF 会话与变更面投递口径抽件，与
    `post-channel` 单源，403 `csrf-*` 轮换重试一次）。`startInboxWatcher` 起始游标改问 host
    （取不到即不消费，fail closed）、积压跳过经 `mail.skip`、消费完成才推进内存游标；
    `handleIncoming` 的 claim／回复／终结三步全经命令（回复幂等锚不变，send 未达即不终结＝水位
    不前进、重启重放）；`routeReplyToSender` 经中继投回并带 `taskId`；`send_mail` 手写工具**退役**，
    `mail.send` 升入 op-set 四常设岗（执行面＋**变异集**、复核帽不持、描述带 `{to, text, taskId?}`
    与「空 `to` 列名单」），工具腿直连中继不经组织命令面；通知监视器协议回信静默改按 `replyTo`
    锚（v1 遗留行同静默）；`apply` 顶层冗余 `mkdirSync(bots/inbox|outbox)` 删除（mail-plane 写路径
    本就按需建目录）。
    **③机械检查（缝③）**——新件 `mail-shared-face.js`（`scanMailWriteFace`：写者名单闭合＝**只剩
    中继面一件**、bot 侧面六函数零直写、零「触达＋文件写」临界区、通道腿零文件面；
    `scanMailContentKeys`：写函数造键与调用点传键都在封闭枚举内）＋`vocabulary-face.js`
    （`scanVocabularyFace`：`skill`／`技能` 零命中＋无非字面说明符动态 import＝无运行时装载机制）＋
    `face-scan.js`（扫描管路单源：walk／注释判别／函数体提取／写操作名单）；L1 负例补投递面
    **真实面**路径（inbox／outbox／receipts／responses／seq 锁，从 mail-plane 路径助手单源派生）；
    `MAIL_INBOX_KEYS`／`MAIL_OUTBOX_KEYS` 与台账状态／事件／命令词表断言不相交。
    **④形态改造**——`kind` 写侧不再产生、读侧（通知静默／prompt 前缀／回路由守卫）改按 `replyTo`
    锚；`taskId` 落盘并随回信延续；客户端 `pick.intro` 双语文案去「技能／skills」（v2 词表无 skill，
    对应物＝岗位＋工具）。
  - **验证结果**：全量 `TMPDIR=/dev/shm npm test` **57/57** ✅（基线 53/53＋新增 4 件：
    `org-mail-relay` 7／`org-mail-client` 6／`org-mail-shared-face` 8／`org-vocabulary-face` 4）；
    preflight 四门 **exit 0**（①57/57 ②冻结面 0009 包 7/7 ③0 违例扫 68 md ④11 PASS / 0 FAIL /
    0 SKIP）；既有回归按新形态改写：`watcher`（游标语义不变，投递与水位经 host 中继）、
    `reply-route`（新增「通道不可用止步／零写入／水位不前进」腿）、`jsonl`／`mail-notify`／
    `mail-at-least-once`（`kind` 废止同步）；扫描件负例各自可辨（注入违规即转红）。**真实运行面
    零写入**（`~/.dsh` 未触碰，夹具全在临时目录；部署同步未做＝16 号票）。
  - **复审（/code-review 双轴并行）**：Standards 硬违例 2／judgement 6；Spec 缺失 1／越权 1／不符 3，
    **全处置**——硬违例：落档补齐（本条＋票面）；单源破损（`HOST_CHANNEL_FORBIDDEN` 抽入
    `permissions.js` 两面共用、`MAIL_CHANNEL_UNAVAILABLE` 用导出常量、host origin 解析一次后传入）。
    Standards judgement：扫描管路三份复制抽 `face-scan.js` 单源；两新扫描件豁免名单改名消同名异义；
    `writers` 语义改「名单内确含写调用」；投递调用名单抽常量；`host-channel` 两态返回归一
    `{status, body}`；删无生产调用方的 `inboxHasResponseTo`；去冗余 `mkdirSync`；陈旧注释更正。
    Spec：① V-A4.4 进程粒度缺口＝`BotsApi.send` 改走中继（bot 实例无中继即 fail closed），写者名单
    收窄为中继面一件；② §E 分支二台账腿＝`createMailRejectionRecorder`（有无任务锚分道）；③
    `consume` 归属校验加固零权威线；④ `mail-at-least-once` 名实不符改按 `replyTo` 锚。
  - **留界（在案、待后续票）**：①**部署面未切换**（`~/.dsh/plugins/dsh-bots` 仍旧快照，本轮
    `_mail` 面与通道腿在部署面未生效；部署同步与重启链＝16 号票点名段）；②`internals` 仍导出
    mail-plane 写原语＝**测试槽位**（`jsonl`／`reply-route` 夹具当 host 侧播种用），生产路径零写；
    ③未绑 `post` 的 v1 形态实例随本票起无 `mail.send` 工具（工具面＝岗位派生），与知识登记同口径
    随 16 号票收敛。
  - **授权依据**：2026-09-20 用户点名 `/implement` → AskUserQuestion 四问四答（领 11 号票；严格
    收口；保留自动回信、回信锚＝`replyTo`；按 TDD 三缝执行）。

- ✅ 本轮（org-v2 **10 号票：记忆与知识层**——用户裁定「全量一次干完，拆三个有顺序的子批」＝授权；票面 9 条验收 ＝ `V-A7.5`～`V-A7.10` + `V-A4.5` + 检索级子串 + 「开工先 search」只进调研承载岗；TDD 红→绿按子批推进；**17 文件 +616/-142 ＋ 4 新件**）：
  - **范围**：`.scratch/org-v2-build/issues/10-memory-and-knowledge.md`（验收勾选＋Status＋Comments 凭据）＋`CONTEXT.md`（「知识库」词条补命令化口径）＋本条目；机械面 = `lib/org/memory-layer.js`（新）／`lib/org/knowledge-shared-face.js`（新）／`lib/knowledge.js`／`lib/org/{brief,op-set,post-channel,ledger-host,role-cards}.js`／`lib/index.js`＋对应测试 9 件（2 件新）。
  - **变化（按子批）**：
    **①分层边界＋直写扫描**——新件 `knowledge-shared-face.js`：`scanKnowledgeLayerFace`（共享面写者审计：写者调用名单含增改与**破坏型** `rm/unlink/rename`；豁免单＝`knowledge.js` 冻结具名常量，按 lib 相对路径认不免 basename）＋`knowledgeFaceShape`（知识库根**顶层级条目封闭枚举**＝「共享侧无第三面」的机械形态；四件名字从 `lib/knowledge.js` 路径助手**派生**，非另抄一份）＋`scanKnowledgeRegisterWriters`（登记写者名单闭合：`registerReport` 调用者只有 host 装配面 `lib/index.js`，且 bot 侧注册面 `registerKnowledgeTools`/`registerOrgTools` 函数体内零 `registerReport`）。L1 面补钉：知识库**真实面**路径（`<dshHome>/bots/knowledge/**`，此前负例表里的 `~/.dsh/knowledge/` 是历史形态）从 `lib/knowledge.js` 单源派生后逐个断言界外。
    **②写入分流＋晋升门槛＋简报预声明**——新件 `memory-layer.js`：`routeContent` 三问分流（Q①台账→Q②知识库→Q③taskId 键工件；**推理过程任何面都不进**且优先级最高；中间产物缺 taskId 判 needs）＋`evaluatePromotion` 门槛三条（`model-swap-test`/`self-contained`/`traced`；**缺省＝不过**，未评估不得静默放行）＋`promotionRequired` 读面（区分「未声明」与「明示不强制」，不代偿门槛）。简报新可选键 `promotion: {required: boolean}`（`lib/org/brief.js` 键封闭校验，夹带其它字段即拒）＝`V-A7.7`「强制性由派单方在简报输出格式里预声明，全局不设强制」的结构形态。
    **③失效／裁决／移交**——`planInvalidation`（失效动作值域**恰两值**取代/废弃；**时间无关**——不看时刻、夹带 `now`/`expiresAt`/`ttlDays` 不改变输出；补丁键封闭 `id/status/supersededBy`，热字段形状上不可达）＋`lib/knowledge.js` 新 `deprecateReport`（**废弃腿落地面**——补丁形状取 `planInvalidation` 单源、锁内 append 语义翻状态＋理由留痕、不物理删除、已废弃不二次废弃；此前「废弃」只有策略无执行面＝死码）＋`resolveConflict`（**只裁规格定义过的两对**：知识与台账→台账胜、知识与岗位卡→岗位卡胜；`{ledger, role-card}` 及含它的三面同冲判 `spec-undefined-conflict` **不发明优先级**）＋`buildHandoff`（指针三件＝taskId＋工件坐标＋知识条目 id，`mode:"pull"`；坐标条目键封闭为 `location`、夹带正文/保留期字段即拒）。
    **④命令化（`V-A4.5`）**——`knowledge.register`／`knowledge.deprecate` 升入 op-set **宿主侧执行面**（非台账命令、不落事件；四常设岗持之、复核帽不持）+新分类 `MUTATING_OPS`＝写集∪共享面写者（`V-A3.4` 本义；`review.report` 因其为复核帽**本职**产出明确排除并在案）+`validateOpSet` 保留集检查同口径改「变异 op」；host 侧 `/commands` 拦截腿（鉴权面与执行面**皆为硬前置**，缺一即 503；只有显式 `ok:true` 放行——堵 fail-open 跳过鉴权直落盘）；bot 侧 `post-channel` 探针腿收窄为 `evidence.probe` 单点（此前 `EXECUTE_OPS` 整集撒网会把知识登记误截到探针腿）；`knowledge_register` 工具**退役**（bot 侧不再引用 `registerReport`）、`knowledge_search` 读取面照旧且对全部实例注册；F-R4-1 的「描述现读模板」经新 `describeOp` 钩子织进 op-set 派生工具（命令化后描述不缩水、仍零静态内联）。
    **⑤检索引导分岗**——「开工先 search」从全员团队提示段移入 **researcher 岗位卡**（`ioContract`）由其派生提示段承载；注册协议留在团队段但改指 `knowledge.register`。role-card 渲染参考件随之重生成（5 卡，aggregate `5477e875c711`）。
  - **范围外就地修（测试定时炸弹，2026-09-19 实测根因）**：`tests/org-unauthorized-count.test.mjs` 夹具 `clockAt` 写死 `2026-09-19T10:00:00Z`，而该文件多处 `ledger.sweep({ at: Date.now() })` 传**真实**时刻——真实时刻漂过租约窗口后 `sweep` 先做租约回收（accept-timeout）释放任务，越权上浮腿因「任务不在手」不再触发，**7 条断言随真实时间流逝自动转红**（本会话基线 50/51 的成因；两轴复审已在 HEAD 干净树独立复现同数）。修法＝锚定 `Date.now()`（run 内仍单一时刻，确定性保持）；实测 18/18、全量回 53/53。**非本票范围**，如判定应走独立票，可单点回退本行。→ **2026-09-20 收口复核判定＝保留（不回退、不立独立票）**：`clockAt` 唯一消费点＝`withLedger` 建账，锚定后台账事件时刻与 `sweep`／`createLedgerHost` 的真实时刻同步漂移（毫秒级差≪`acceptMs` 10min，accept-timeout 不再误触发）；run 内时钟仍冻结＝单次运行确定性保持；断言零改动、夹具为文件内局部函数；理论边界（单用例超 10min）实测 ~300ms 不可达。同日独立复验全量 53/53＋preflight 四门 exit 0。
  - **验证结果**：全量 `TMPDIR=/dev/shm npm test` **53/53** ✅；preflight 四门 **exit 0**（①53/53 ②冻结面 0009 包 7/7 ③0 违例扫 67 md ④11 PASS / 0 FAIL / 0 SKIP）；scoped 9 件 162/162（org-memory-layer 40／knowledge 24／knowledge-shared-face 15／org-op-set 22／ledger-host 15／org-brief 12／org-post-channel 11／role-cards 14／org-permissions 9）；TDD 各缝各自红→绿。**/code-review 双轴并行**（Standards 硬违例 3／judgement 4；Spec 缺失 3／越权 2／存疑 1）全处置——硬违例：fail-open 鉴权改硬前置拒、原语单源（`isPlainObject`/`isNonEmptyString` 收敛，去手写副本）、落档补齐；judgement：容器枚举改派生态、破坏型写手段入扫（修测试头注与实现不符）、`validateOpSet` 保留集口径与测试对齐、`MUTATING_OPS` 注释纠偏（`review.report` 排除理由在案）；Spec 侧：废弃腿落地面（去死码）、`resolveConflict` 去自创传递序（不发明规格）、组织常量在配置面的机械落点（`ORG_CONSTANT_FACE`＋逐导出解析，评测集未落地列 pending 不虚构坐标）、v1 形态实例随命令化失去登记能力的**留界**（见下）。
  - **留界（在案、待后续票）**：①未绑 `post` 的 v1 形态实例本次起无知识登记工具（工具面＝岗位派生，登记属岗位能力）——过渡期边界，随 16 号票切换批收敛；②`memory-layer` 五策略函数生产消费面随召集体落地（`routeContent`/`evaluatePromotion` 归任务关闭与归档流程、`buildHandoff` 取件面归 14 号票闭环移交），当前验收＝机械断言（与 `task-ledger.recordPreScreen`「生产触发面随 13/14 接线」同口径）；③评测集＝组织常量但归 12 号票（`V-A7.4`），`ORG_CONSTANT_FACE` 只登记待办坐标不装成已存在。
  - **收口洁面（2026-09-20，用户指令「忽略并行版本（项目外测试用例），按你的版本对票 10 收口」）**：①`lib/org/memory-layer.js` 尾部残留测试运行器标记 `// ---------- 运行 ----------` 删除（该标记属测试件体例，堕入 lib 模块系复制粘贴残留）；②`lib/index.js` internals 内的 `buildRegisterDescriptionForTest: buildRegisterDescription` 别名改为直列 `buildRegisterDescription,`——internals 既有体例是「纯函数名直列」（块注：供测试／其他交付物使用的纯函数），`…ForTest` 后缀把测试性写进了生产导出名，且冒号别名与体例不符（测试侧同步改引用）。两处纯命名/注释面，行为零变化；票板核对：10 已 `resolved`，14 号票的 `Blocked by` 仍含未 resolved 的 11／13，无需改板；PLAN 门态收口段与 org-v2 工单轨无涉（org-v2 语义面在 `.scratch/org-v2/spec.md`），故 PLAN 零改动；README §2 地图只列文档面，本次新增为代码件（`lib/org/*.js`／`tests/*.mjs`），不触发地图同步。同票并行独立版（`.scratch/org-v2-build/attachments/`，用户明示＝项目外测试用例）按裁定忽略：**不并入正式文件、不引用其内容、不进提交**（保持未跟踪）。
  - **授权依据**：2026-09-19 用户点名 `/implement` → 选定领票「10 号票」＋「全量一次干完（拆三个有顺序的子批）」；2026-09-20 用户裁定「忽略并行版本，按你的版本收口」；2026-09-20 用户点名时钟修复评估收口（判定＝保留）。

- ✅ 本轮（org-v2 **18 号票：`/implement 18` 复验轮——代码面零改动，`V-A6.8` 执行前提落定**）：
  - **范围**：`.scratch/org-v2-build/issues/18-probe-behavior-upgrade.md`（Comments 新增复验轮注记）＋本条目；
  - **变化**：机械面零改动。18 号票五探针行为化代码面在 HEAD（34bdb78）复验成立；唯一余项 `V-A6.8` 人工目视清单经只读核实**暂不具备执行条件**——①部署面 `~/.dsh/plugins/dsh-bots` 为 org-v2 之前旧快照（缺 `lib/org/` 与 `lib/host-faces.js`/`lib/host-services.js`、残留已退役 review-* 件、client inject 契约旧版），在其上目视＝目视旧代码、结果无效；②宿主未运行；③清单执行与签名按票面归核验人（代签＝落档作假）。执行时点落定＝16 号票切换批「部署同步→重启链」点名段之后（部署同步受 AGENTS.md §2 逐项点名授权约束、16 号票 Blocked by 12/14 未完成）；事实与前提已注记票面；
  - **验证结果**：`TMPDIR=/dev/shm npm test` 51/51；preflight 四道门 exit 0（①51/51 ②冻结面 0009 包 7/7 ③0 违例扫 65 md ④11 PASS / 0 FAIL / 0 SKIP）；部署面比对为只读 diff，运行面零写入；
  - **授权依据**：2026-09-19 用户点名 `/implement 18`。

- ✅ 本轮（org-v2 **24 号票：复审后规格口径收口**——09＋19–23 六票复审 Spec 轴
  三项「实现与冻结合同字面语义偏差」，三项均先用户裁定再动机械面）：
  - **范围**：`.scratch/org-v2-build/issues/24-post-review-spec-alignment.md`
    三项收口＋22 号票面挂起项随②销账；8 文件 +293/-79（未含本条与票面落档）。
  - **授权依据**：三项口径 2026-09-19 用户裁定（AskUserQuestion 三问三答）——
    ①越权通知＝**实现向合同靠**、②快照形态＝**字面达成**、③立场句＝**补齐句
    合规＋显式标注**；TDD 缝清单经提问确认未获回答、按最佳判断执行（三缝均落
    裁定已锁定的公开接口，凭据在案）。
  - **变化**：①越权达阈「通知派单方」落**台账事件投影**（§B「通知＝台账事件
    投影，无事件不通知」字面达成）——新非状态事件类型 `unauthorized-notified`
    （键封闭 `instanceId/count`）＋NOTIFY_TO 路由派单方，sweep 对每被越权任务
    落一条事件、**含无在手任务路径**（事件锚在被越权 taskId 上）；每串每任务
    至多一次＝事件本体锚点（`pendingNoticeTaskIds`，取代幂等预留锚）；sweep 腿
    **通知先行、上浮后行**（防上浮成功后通知写失败失去重试窗口）。②node.tests
    **字面快照执行**（§E「对快照执行」字面达成，22 票面留界①销账）——执行前
    整树物化快照副本（排除 `.git`、物化点落源树内 fail closed），隔离子进程以
    副本根为 cwd，执行字节＝快照字节由构造保证、ABA 窗口消除、
    `probe-snapshot-drift` 退役；结论 snapshot 扩展 `{file, sha256, bytes, tree}`
    （文件级＋树级绑定都采自副本本体、可独立重算）。③裁定包立场补齐句带
    〔机械事实〕前缀（不冒名立场），positionsFor 头注＋CONTEXT.md「裁定包」
    词条落裁定口径。
  - **复审**：/code-review 双轴并行（Standards 硬违例 0/judgement 4；Spec 缺失
    1/越权 0/不符 0）全处置——sweep 腿通知先行收口、taskById 缺位改
    exceptionFailures 响亮回报（去幻影锚）、两守卫抽 faceWroteWithinStreak
    共享帧（02 纪律）、腿注释去重、node.tests 文件级绑定改采自副本（修）；
    落档面属复审后统一流程项。
  - **验证**：全量 `TMPDIR=/dev/shm npm test` 51/51；preflight 四门 exit 0
    （①51/51 ②0009 包 7/7 ③0 违例扫 65 md ④11 PASS/0 FAIL/0 SKIP）；scoped
    触面 110/110；TDD 三缝各自红→绿。

- ✅ 本轮（org-v2 **09＋19–23 六票用户额外模型 `/code-review` 复审处置**——立票
  24＋四项就地修复，2026-09-19 用户裁定「延续前两轮口径（简单就地修、较多立票）」
  ＝授权）：
  - **范围**：固定点 `f283864...HEAD`（09 号票人间接口＋修复批 19–23，36 文件
    +4418/-327）两轴复审——至此 org-v2 已入库面（01–09＋15＋18＋19–23）全部
    经过用户额外发起的独立复审。
  - **复审结论**：Standards 0 硬违例＋6 项 judgement call；Spec 7 项（缺 2 均
    有留界归属〔初审代理接线随 13/14、mail 转发随 11〕／越权 2 均票面自报在案
    ／存疑 3）。处置：立票 24「复审后规格口径收口」打包三项存疑（①20 号票
    「通知派单方」无台账事件投影通道 vs §B「无事件不通知」②22 号票 node.tests
    漂移守卫 vs §E「对快照执行」字面形态〔22 票面待确认挂起项随其销账〕
    ③09 号票裁定包 positionsFor 缺位机械补齐句 vs「双方立场」口径——三项均
    先用户裁定口径再动机械面）；20/22 票面 Comments 复审注记落档。
  - **就地修复（4 项，行为保持，测试锁定）**：task-ledger `recordPreScreen`/
    `recordNeedsUser` 同型 55 行双份收敛为 `judgementEscalationLeg` 共享腿
    （event 主结论口径参数化保持两函数原返回件形状）；`validateEventRecord`
    wait-user/escalated 平行词表 if 表化（`STATE_ENUM_KEYS` 与命令面共用同一
    词表源，报错文案逐字不变）；human-inbox `RULING_ACTIONS` 负载构造由闭包
    `payloadFor` 改表声明 `commands[].keys`＋`payloadFromInputs` 通用取值
    （undefined 键不入负载——可选输入 attribution 语义保持；表断言随形状
    更新）；`dueAt` 可解析判定收敛 `brief.js isParseableDueAt`（冻结期校验与
    投递面 `isExpired` 共口径，单向引用无环）。
  - **验证**：`TMPDIR=/dev/shm npm test` **51/51** ✅；preflight 四门
    exit 0（①51/51 ②0009 包 7/7 ③0 违例扫 65 md ④11 PASS/0 FAIL/0 SKIP）。
  - **授权依据**：2026-09-19 用户「进行一次复审」＋同日「延续前两轮口径」裁定；
    立票 breakdown 经用户 AskUserQuestion 批准（一票＋四项就地）。
  - **未落档面**：无（本条目＋24 号票面＋20/22 票面注记齐）。

- ✅ 本轮（org-v2 实现批 **23 号票「复审后续行为保持重构批」**，2026-09-19 用户
  `/implement` 调用＝授权；领票核查在案——修复批 19/20/21/22 已入库
  （`8488bce`／`48911a6`／`3cb332b`／`f74e175`），工作树仅余未跟踪
  `.video_agent/`（插件产物，不入本批），23 票 `ready-for-agent` 无阻塞即领；
  行为保持批无新行为缝——TDD 以既有回归为红线，③装配件工厂这一新组合面补
  1 条锁定测试）：
  - **范围**：06/07/08 号票复审 Standards 轴剩余 judgement call 的行为保持收口
    （探针与断言面不动，修复批票 23；含自 09 号票并行在制移交的简报侧同口径
    收尾与通知收件人 map 化两项）。
  - **变化**：①review-kit 事件遍历分派共享——`REVIEW_EVENT_DISPATCH` 分派表＋
    `eachReviewEvent` 共享单遍（taskId 过滤→类型分派→subject 守卫单一源），
    `collectReviewState`／`reviewHandoff` 同型 if 级联收敛（移交件＝单次折叠＋
    单次遍历产出，报告行按 seq 自折叠结果取）；②复核状态查询域捆装——
    review-kit 新导出 `reviewScope`（`{brief, events, taskId}` 三件套具名捆装）
    ＋`taskReviewScope`（任务投影→域），task-ledger 五处＋human-inbox
    `criteriaFactsFor` 散拼点改捆装，各查询函数签名与断言面不动；③权限装配件
    工厂——permissions.js 新 `createLedgerAccessKit({issuer, postForBot, logger})`
    （authorize 即取、`createDispatcher(ledger)` 后置——台账先以 authorize 建出
    的构造顺序解耦），lib/index.js 鉴权器／dispatcher／接线三处结伴改一处装配
    成套取出，org-permissions 补锁定测试；④op-set `TOOL_KIND`→`TOOL_META`
    名实相称改名（表持 {kind, description} 工具元数据；模块内部常量，输出
    零变化）；⑤台账简报前置门拆件——新件 `lib/org/brief-gate.js`（briefReject
    ＋briefGate：plan/amend/assign 三命令统一入口，intake 保留 creates 分支内
    briefReject 直查、序位原位），判定序位与四拒绝码（invalid-brief／
    criteria-gap／review-exemption-forbidden／brief-missing）及理由逐字保持，
    task-ledger 对 brief.js 的 import 随之清零；⑥简报侧同口径收尾——新件
    `lib/org/is-non-empty-string.js`（brief↔review-kit 循环 import 解环，双方
    单向依赖）、brief.js 判据 args 校验接 probe.js `argsMatchArgKeys`（执行侧
    同口径单源）、isPlainObject 去重取 capability-base 版（带原型校验，真实
    路径等价域内，头注点明）、org-brief.test.mjs 的 VALID_BRIEF 改自
    tests/helpers/brief-fixture.mjs 派生（单一事实源）；⑦通知收件人解析 map 化
    ——`NOTIFY_RECIPIENT` 解析表（与 NOTIFY_TO 角色词表同源：assignee/
    dispatcher/reviewer 事件负载优先投影兜底、owner＝在手者、表外角色名直发），
    四层嵌套三元退役。
  - **复审**：`/code-review` 双轴并行（Standards 硬违例 1/judgement 5；Spec
    缺失 0/越权 0/不符 0）全处置——brief.js 死转出口删除、reviewScope 无消费
    缺省值删除、NOTIFY_RECIPIENT 表外 fallback 闭包改条件式、reviewHandoff 同
    模块收口捆装、CHANGELOG 落档随提交闭合（修）；isPlainObject 原型校验
    收紧头注点明＋票面 Comments 留界；eachReviewEvent 对 reviewHandoff 的
    subject 守卫微漂移（合法事件流不可达——写路径把守 point/topic 二选一非空）
    留，理由在案。
  - **验证**：scoped 8 文件 152/152＋全量 51/51＋preflight 四门 exit 0
    （①51/51 ②0009 包 7/7 ③0 违例扫 64 md ④11 PASS/0 FAIL/0 SKIP）。
  - **授权依据**：2026-09-19 用户 `/implement` 调用；票面七项 breakdown 经用户
    AskUserQuestion 批准在案（同日立票轮）。
  - **未落档面**：无（本条目＋票面翻 resolved＋Comments 凭据齐）。

- ✅ 本轮（org-v2 实现批 **20 号票「连续越权计数与上浮」**，2026-09-19 用户
  `/implement` 调用＝授权；领票核查在案——修复批 19/21 已入库（`8488bce`／
  `3cb332b`）、工作树仅余本票在制；施工中 19/21 先后入库、`lib/org/human-inbox.js`
  同文件混存两轮均由对方按 hunk 归属部分暂存解决，本票 hunks 留工作树至本轮提交；
  TDD 四缝经用户 AskUserQuestion 确认在案）：
  - **范围**：规格 §D「拒绝＝fail closed 不执行……连续越权通知派单方并计入上浮」
    的机械面收口（06 号票复审 Spec 轴 (a)1；修复批票 20）。
  - **变化**：新件 `lib/org/run-count.js`（trailing 连续计数共用原语——02 纪律：
    09 号票 `noticesFrom` 改接同源、行为保持由既有测试锁定）＋
    `lib/org/unauthorized-count.js`（拒绝回执链按**岗位实例**折叠计数、达阈通知
    派单方投影、每串至多一次守卫）；台账 sweep 增连续越权上浮腿（达阈且在手 →
    `escalated` cause=out-of-bounds〔09 号票预冻词表兑现，越权处置永不可代、
    `userRulingRequirement` 随投影生效〕；每串至多一次**双锚点**＝串内本面上浮
    事件＋通知幂等预留〔覆盖无在手任务的零事件路径；/code-review 探针实证每拍
    重发洞后修、回归锁定〕；上浮失败 exceptionFailures 响亮回报、下拍带通知重试；
    来态限在手四态＝`ALLOWED_FROM.escalated` 合法转移）＋
    `LEASE_DEFAULTS.unauthorizedThreshold` 阈值缝（缺省 3＝用户域数值的缝，可
    注入）；ledger-host tick 计入 changed／swept 载荷＋值守日志达阈回报；human-inbox
    导出 `isCapabilityFaceCode`／`classifyCapabilityFaceRejection`（任务链与实例链
    两分类器共用核心）。
  - **复审**：`/code-review` 双轴并行（Standards 硬违例 0/judgement 6；Spec
    缺失 1/不符 1）全处置——分类器核心提取共用件、sweep 腿读面一次读定透传、
    sweep docstring 补越权腿、无在手串通知幂等锚点（修）；runs 返回值契约面、
    `swept.unauthorized?.length` 防御风格、动作词表回调内字面量（留，理由在案）；
    分叉口径与投影裁定落票面 Comments。
  - **验证**：scoped 15/15＋全量 51/51＋preflight 四门 exit 0（①51/51 ②0009 包
    7/7 ③0 违例扫 64 md ④11 PASS/0 FAIL/0 SKIP）。

- ✅ 本轮（org-v2 实现批 **19 号票「简报契约边界完整性」**，2026-09-19 用户
  `/implement`「继续修复」调用＝授权；领票核查在案——21 号票先由并行会话在制，
  本会话按避让纪律挂后台监视器待其入库（`3cb332b`）后领票；⑤/⑥ 口径沿用 21 轮
  用户裁定〔票面 Comments 在案〕；施工落档期间 20 号票又由并行会话开工、
  `lib/org/human-inbox.js` 同文件混存——提交按 hunk 归属部分暂存，本票只入
  needs-user 枚举两 hunk，20 号票 hunks 及其新件留工作树未动）：
  - **范围**：规格 §B「派出即冻结，改动只走 amend 追加事件并显式通知承接方」＋
    「判据必须可执行…分解不出来标 needs-user 上浮」＋§C「可加审不可免审」在
    台账边界的机械面收口（07/08 号票复审 Spec 轴发现；修复批票 19）。
  - **变化**：①`task.amend` 冻结复核点不可降级——置换件删减/整体省略已冻结
    `reviewPoints` 即拒（回执 `review-exemption-forbidden` 逐点可归因；判定
    原语 `droppedReviewPoints` 落 `lib/org/brief.js`，subject 集合语义与
    collectReviewState 同口径）；②承接方持有件刷新缝——`lib/org/post-channel.js`
    新 `brief.refresh` 读面 op（只许当前归属者；amend 通知后把本地持有简报
    重同步为台账真源，探针 `probe-stale-brief` tripwire 恢复可用，合法修改
    路径不再是死路），op-set 承接岗升表＋READ_OPS/TOOL_KIND 同步；③amend
    显式通知承接方投影凭据（05 号票复审②口径）落 19① 回归断言；④简报校验
    分码——判据缺口＝`criteria-gap`、结构违规＝`invalid-brief`
    （briefRejectReason 结构化为 briefReject，intake/plan/amend/assign 四处
    同口径；两类同时在案结构优先、缺口原因仍可见）；⑤needs-user 上浮路径——
    `ESCALATION_CAUSES` 扩条 `needs-user`（**词表扩条授权依据＝2026-09-19 用户
    裁定**，21 轮 AskUserQuestion、19 号票 Comments 在案）＋`escalated` 来态
    扩 `triaged`（立项期缺口在简报未冻结前上浮）＋台账门面 `recordNeedsUser`
    （照 `recordPreScreen` 同型：锚定最近拒绝＝criteria-gap、judgement 事实
    留痕、escalated 通知 user、已挂起不重复；生产触发面随 13/14 召集接线，
    同 recordPreScreen 留界）；⑥reviewPoints 省略口径注记（**2026-09-19 用户
    裁定＝注记留派单方自觉**）：省略/空数组＝零必审交付合法，brief.js 头注＋
    CONTEXT.md 两词条落档，校验与模板零改动。
  - **复审**：`/code-review` 双轴并行（Standards 硬违例 0/judgement 5；Spec
    缺失 1/越权 0/不符 2）全处置——fetchLedgerTask 共用件提取、op-set 头注
    覆盖句、human-inbox 枚举头注改按类目陈述、recordNeedsUser 已挂起分支
    口径、droppedReviewPoints 集合语义头注、19① 补 amend 通知断言（修）；
    留界两条凭据落票面 Comments（needs-user 锚定对后续拒绝覆盖脆弱＝机械
    规则已声明；生产触发面归 13/14）。
  - **验证**：scoped 106/106＋全量 50/50＋preflight 四门 exit 0（①50/50
    ②0009 包 7/7 ③0 违例扫 64 md ④11 PASS/0 FAIL/0 SKIP）。

- ✅ 本轮（org-v2 实现批 **21 号票「capability 续签、读面 gate 与岗位 op 集合同口径」**，
  2026-09-19 用户 `/implement` 调用＝授权；领票核查在案——修复批余票 19/20/23 与 21
  均未阻塞，本轮经用户裁定**只领 21 号票**（范围裁定在案；19 号票 ⑤/⑥ 口径同轮裁定、
  已落 19 票面 Comments 待其实施批引用））：
  - **范围**：§D 权限面三收口＋一裁定——①续签断链修正（续签条件从「命令成功」改为
    「授权有效且信封已消费」，覆盖命令面与复核面两侧）、②读面 gate 补 op 白名单腿
    （§E「工具面裁剪＝权限裁剪」在读面成立）、③`issued.jsonl` 对账补独立消费面
    （§附录 A `V-A3.3` 证据列「对账脚本」半边）、④岗位 op 集与续签点的合同口径裁定
    （06 号票复审 Spec 轴 (a)3/(b)1/(b)2/(c)1/(c)2）。
  - **TDD 接缝预核**：三缝经用户确认在案（①命令面 `createLedgerCommandDispatcher` 返回值；
    ②读面 `authorizeLedgerRead` 返回的 readGate；③对账脚本 CLI＋子进程退出码），并
    经用户批准把①的修正面**两面一并收口**（复核面同缺陷同口径）。
  - **变化**：
    - ①**续签条件修正**：`lib/org/task-ledger.js` 命令面拒绝统一出口 `rejectHere`
      （37 处收束）＋拒绝回执新增 `authorized: true`——只加在**鉴权门之后**的拒绝上
      （授权有效且岗位信封已被本命令单次消费），只入回执、不进事件负载（事件 schema
      键封闭）；`lib/org/permissions.js` 的 dispatch 续签判据改为「成功 ∪ 授权通过而
      被拒」，鉴权门之前的拒绝（角色不符／鉴权失败／结构校验）不续签（越权不换新
      信封），续签闸门＝任务存在且在办态（照既有「不签死信」口径）。复核面
      `lib/org/ledger-host.js` 同口径：帽续签条件改为「帽 gate 已通过」——报告被台账
      拒绝（`review-not-requested` 等常态拒绝）也续签帽，gate 自身拒绝不续签。
    - ②**读面腿二**：命令面与读面共用新原语 `postCapabilityVerdict`（信封在场→形状→
      验签→home 岗位解析→`op ∈ availableOps(home, 信封)`），读面 `consumeNonce:false`
      且不绑任务域；`authorizeLedgerRead({issuer, postForBot})` 语义＝并集口径
      （home 岗位表 ∪ 当次信封）。
    - ③**对账面**：新件 `scripts/capability-issued-audit.mjs`（`--dsh-home`，退出码即
      结论；结构层＋`reconcileIssuedVsOpSet` 表对账）＋新测试
      `tests/capability-issued-audit.test.mjs`（子进程取退出码，不新起第五道门）。
      `op-set.js` 新导出 `tableOpsForKind`（kind 切分单一源，`capability-issue.js`
      内部重复实现删除）、`capability-issue.js` 导出 `issuedAuditFile`（审计链落点
      单一源）。
    - ④**口径升格（用户裁定）**：`op-set.js` 头注升格为裁定口径（岗位 op 集以本表为
      唯一源、§D 域级列举不构成台账命令面封闭枚举）、续签点＝每个授权有效的 post 命令
      口径落 `CONTEXT.md`「能力（capability）」词条＋`permissions.js` 头注，spec §D
      文本未动（历次验收凭据不失效）。
  - **验证**：scoped——`tests/org-ledger-authz.test.mjs` 17/17（两新测试；越权不续签
    的边界测试经临时放宽续签条件验证敏感度＝转红）、`tests/ledger-host.test.mjs` 12/12
    （一新测试：报告被拒也续签帽＋续签帽可连报＋无帽不续签）、
    `tests/capability-issued-audit.test.mjs` 4/4（绿例／越表／形状与切分／链不可信＋
    空链）；全量 `TMPDIR=/dev/shm npm test` 50/50；preflight 四门 exit 0
    （①50/50 ②0009 包 7/7 ③0 违例 ④11 PASS/0 FAIL/0 SKIP）。
  - **复审**：`/code-review` 双轴并行（Standards 硬违例 2／judgement call 3；
    Spec 缺失 2／越权 0／不符 1）全处置：落档＝本条目（H1 消）；四文件续签措辞同步
    （`permissions.js` 头注／`lib/index.js` 接线注／`capability-issue.js` 头注＋
    `issuedAuditFile`／`org-ledger-authz.test.mjs` 头注，H2 消）；命令面两出口合一
    `rejectHere`＋`authzCleared` 更名 `authorized`（一名一义）；命令面/读面腿二抽取
    `postCapabilityVerdict` 单一源；对账面补 kind↔taskId↔op 集切分（复审给出的
    `taskId:"not-a-task-id"` 假绿例已入测试锁定）＋审计链落点单一源。留界四项
    （见票面 Comments）：角色能力不在续签链（06 票面留界「role-cap 分发通道归
    07/13」在案——07 已入库、13 checklist 未点名该面，本票如实指留界链、不追改
    归属）／读面路由接线不在本票（通用 `GET /_ledger` 按设计为 localhost 公开读
    投影，06→07→08 留界链在案，本票只补 gate 的 op 白名单腿）／续签闸门＝在办态／
    `ledger-corrupt` 罕见路径自洽＋幂等重放不重签（既有口径不动）。
  - **授权依据**：2026-09-19 用户 `/implement` 调用；同轮 AskUserQuestion 裁定——
    领票范围＝只领 21 号票；④＝推导注记升格；TDD 三缝确认；①修正面＝两面一并收口；
    另裁定 19 号票 ⑤＝扩 `needs-user` 上浮原因枚举、⑥＝reviewPoints 省略口径注记留
    派单方自觉（落 19 票面 Comments）。
  - **未落档面**：无（本条目＋21 票面 Comments＋19 票面裁定 Comments 齐）。

- ✅ 本轮（org-v2 实现批 **22 号票「探针沙箱快照形态」**，2026-09-19 用户
  `/implement`「领修复批」调用＝授权；领票核查在案——修复批五票中 19/20/23
  主体在 09 号票并行会话当时在制施工面（task-ledger.js/brief.js 同文件冲突）、
  21 ①②落 ledger-host.js 同面且④需用户裁定，本票为唯一可领项。本票施工与
  落档期间 09 号票已由并行会话入库＝`84a8485`，19/20/21/23 的文件冲突随之
  解除、待下批领用）：
  - **范围**：§E「沙箱快照与逐字一致校验形态照用」补全另一半（07 号票复审
    Spec 轴 (a)2；逐字一致半边 07 号票已在，本票补快照半边）。
  - **变化**：`lib/org/probe.js` 快照纪律三步——①快照采集步先于执行：坐标
    内容一次读定＋字节级 sha256（fs.contains/node.tests 跑前采集、
    ledger.no-anomalies 单次读面捕获）；②校验对快照执行：fs.contains 对采集
    内容判定不再回查活树、ledger 对捕获清单过滤（TOCTOU 缝＝检查时刻与结论
    使用时刻坐标内容可变）；③结论绑定可核验：执行过的结论携带键封闭
    `snapshot` 字段（{location,sha256,bytes}／{file,sha256,bytes}／
    {botId,source,open,sha256}，冻结；ledger 失败结论 output 即捕获清单本体、
    摘要可就地复验）。node.tests 留界：回归判据的结论主体是仓库树本身（对
    副本执行验证的是副本而非仓库），执行仍落活树，以跑前采集＋跑后重读比对
    的漂移守卫兜底——执行窗口内文件变化即新拒绝码 probe-snapshot-drift
    fail closed（即使退出码 0）；ABA 窗口机械不可证，解释口径已在票面
    Comments 上抛待用户确认；缺文件在采集步 fail closed（probe-read，先于
    子进程）。tests/org-probe.test.mjs 五新测试＋物化形 helper；
    tests/org-post-channel.test.mjs 透传断言随结论契约更新。
  - **验证**：scoped 19/19（org-probe 11＋org-post-channel 8）；全量
    `TMPDIR=/dev/shm npm test` 49/49（含 09 号票在制件当刻形态，后原样入库）；
    preflight 四门 exit 0（①49/49 ②0009 包 7/7 ③0 违例 ④11 PASS/0 FAIL/
    0 SKIP）。
  - **复审**：`/code-review` 双轴并行（Standards 硬违例 0／judgement call 3；
    Spec 缺失 2／越权 0／不符 1）全处置：bytesSnapshot／materializeTestFile
    抽取、头注「带/不带 snapshot」二分补 probe-spawn/drift 态、总述收窄为
    按命令分型、ABA 措辞收紧（修）；node.tests 副本执行形态与 ledger 快照化
    推广落票面 Comments（留界①／注记）。
  - **授权依据**：2026-09-19 用户 `/implement`「领修复批」调用；修复批五票
    （19–23）系同日 06/07/08 复审处置经用户 `/to-tickets` 批准立票。
  - **未落档面**：无（本条目＋22 票面 Comments 齐）。

- ✅ 本轮（org-v2 实现批 **09 号票「人间接口与人间收件箱」**，2026-09-19 用户
  `/implement` 调用＝授权；领票时工作树净（仅无关未跟踪 `.video_agent/`）、
  01–08＋15＋18 已入库、blocker 06／07 均 resolved，票面 Comments 在案）：
  - **范围**：人间接口一件套——三类裁定进 `waiting-user`、到人告知三类、
    收件箱投递面（只读＋内嵌终裁操作）、挂起语义（不占租约／无超时自动动作／
    到期只投影「已过期」）、终裁＝台账命令特化视图、裁定包五件、初审代理边界
    （规格 §F、附录 A `V-A5.1`–`V-A5.6`；含 `STATE_RESPONSIBILITY` 结算/关闭
    两条超时处置＝本票份额）。
  - **变化**：
    - `lib/org/human-inbox.js`（新）：人间接口件套（与 review-kit 同型的判定／
      投影层）——三类裁定封闭枚举 `RULING_CLASSES`（`irreversible-write`／
      `escalation`／`user-domain`）＋上浮原因封闭枚举 `ESCALATION_CAUSES`
      （在案五条＋契约五条：初审拒绝／结算关闭超时／冲突／越权）＋告知三类
      `NOTICE_KINDS`＋永不可代三项 `NON_DELEGABLE` 与 `userRulingRequirement`
      （用户域挂起与冲突／越权上浮的终裁只许 user，含取消）＋初审边界
      `preScreenBoundary`（必审未闭合＝package-only）与 `preScreenEscalation`
      （初审拒绝／两轮未闭合强制上浮；未知裁决 fail closed）＋到期投影
      `isExpired`＋告知投影 `noticesFrom`（交付回笼／取消失败／连续越权计数，
      越权面按能力码词形单源判定 `isUnauthorizedCode`，运维性码不洗链）＋裁定包
      `buildRulingPackage`（五件齐备才交付）＋终裁视图 `RULING_ACTIONS`（表内自带
      负载构造与必填输入）／`applyRuling`（幂等键＝`<裁定键>:<taskId>:<op>`，缺键
      即拒；CAS 续取当刻投影；`defer` 零事件）＋收件箱 `buildInbox`。
    - `lib/org/task-ledger.js`：`task.wait-user` 必填 `class`∈三枚举；`escalated.cause`
      与 `wait-user.class` 同受 `validateEventRecord` 词表把守（含旧格式事件的
      fail-closed 迁移归因）；非委代项挂起点状态改写只许 user（`ruling-not-delegable`）；
      投影增 `waitingClass`／`escalationCause`（随事件重建）；`escalated` 来态扩
      `delivered`／`settled`；队列滞留表增两态（先登记 `task-stalled` 异常再上浮，
      登记失败经 `exceptionFailures` 响亮回报，绝不自动结算/自动关闭）；新增
      **初审裁决入账面** `recordPreScreen`（必审命中即拒处置、结论落 `judgement`
      事实、初审拒绝或两轮未闭合追加 `escalated`）；两轮阈值读 review-kit 单一源。
    - `lib/org/review-kit.js`：导出 `UNCLOSED_ROUNDS_TO_ESCALATE`（阈值为单一源，
      台账 claim 侧与初审判定同读）。
    - `lib/org/brief.js`：边界要素可选键 `dueAt`（ISO；缺省＝无到期投影）。
    - `lib/org/ledger-host.js`：`GET /api/bots/_ledger/inbox?cursor=`（只读投递面，
      非 GET 405；终裁仍走 `POST /commands`，不新增写路径）；`createLedgerHost`
      透传 `now`；值守日志回报 `exceptionFailures`。
    - `CONTEXT.md`：「人间收件箱」词条补机械口径（三类裁定 id／告知三类／终裁四式
      ／推迟零事件）；`docs/PROJECT_UNDERSTANDING.md`：留界登记「阻塞超时上浮落地」。
  - **测试**：新模块 `tests/org-human-inbox.test.mjs` 17 条（枚举封闭／告知投影＋
    越权连续口径与洗链负例／初审边界正负例／裁定包五件与缺件拒／终裁四式与
    mail 回文负例／缺键与跨任务串键负例／收件箱投影）；`tests/task-ledger.test.mjs`
    扩 8 条（裁定类闸门、上浮原因 schema、非委代归属门、挂起语义、结算/关闭超时、
    终裁特化视图、初审裁决执行面、异常登记失败回报）；`tests/org-brief.test.mjs`
    扩 1 条（`dueAt`）；`tests/ledger-host.test.mjs` 扩 1 条（收件箱 HTTP 面）。
  - **验证**：`TMPDIR=/dev/shm npm test` **49/49**；preflight ①49/49
    ②0009 包 7/7 零触碰 ③0 违例 ④11 PASS/0 FAIL/0 SKIP，四门全绿。
  - **`/code-review` 双轴处置（Standards 硬违例 2／judgement 4；Spec 高 1／中 2／
    低 2）**：
    - **修**：①`applyRuling` 幂等键洞（缺键拼出 `undefined:<op>` 假键、同键跨任务
      重放＝**漏裁报成功**）——缺键即拒＋键带 taskId 分量＋补两条负例；
      ②越权码表不完备＝能力面拒绝静默降级为角色类拒绝并洗掉连续链——改按能力码
      词形单源判定（`capability-*` 全族入类、运维性四码不计数不洗链、门码显式在表），
      并以 `isUnauthorizedCode` 导出与 20 号票互指；③裁定包立场只到「至少一方」——
      改以机械可得事实补齐至双方各一句，缺两句即判缺件；④V-A5.4 初审强制上浮无
      执行面——新增 `recordPreScreen`（必审门＋判断事实＋escalated 通道）并测试；
      ⑤判据事实字段名实不符（附判据定义而非结果原文）——改 `criteria`＋结果原文
      随 `gaps.evidence`／`criteriaGaps`；⑥`sweep` 异常登记返回值未校验——经
      `exceptionFailures` 响亮回报＋值守日志（两处分支同口径）；⑦死词表项
      `host-channel-forbidden` 出表（HTTP 403 不进 `command-rejected`）；⑧`latestEvent`
      提取（末次语义一处）；⑨`requires` 由摆设改为强制校验、负载构造入表（去
      switch）；⑩两轮阈值单源（`UNCLOSED_ROUNDS_TO_ESCALATE`）。
    - **留界（未改，理由在案）**：⑪「其余挂起点的终裁由 user 行使」是投递面约定，
      机械硬门只覆盖永不可代三项（其余挂起点维持既有恢复语义，不越出本票判据收紧
      冻结状态机）；⑫`blocked` 超时上浮（05 起头注挂 08 名下、08 未实施）——
      在 `PROJECT_UNDERSTANDING` 留界登记，待用户裁量立票；⑬初审代理的**结论提交面**
      （工具/op 接线）随 13／14 召集与自举补齐，本票只落台账侧执行面与见证测试。
  - **授权依据**：2026-09-19 用户 `/implement` 调用；`/tdd` 接缝预核与四处范围裁定
    经用户 AskUserQuestion 批准（票面 Comments 在案）；`/code-review` 技能显式载入
    照文执行（两轴并行子代理复审）。
  - **未落档面**：无（本条目＋票面 Comments 实施与复审记录＋CONTEXT.md 词条＋
    PROJECT_UNDERSTANDING 留界齐）。

- ✅ 本轮（org-v2 **06/07/08 三票用户额外模型 `/code-review` 复审处置**——修复
  批立票 19–23＋简单项就地修复，2026-09-19 用户裁定「简单任务就地修复、内容
  较多的按 `/to-tickets` 发布为新 issue」＝授权；与各票实施批内自带的复审环节
  相互独立——15 号票同型的后补复审）：
  - **范围**：固定点 `32792a3...HEAD`（07＋08 两票）＋ `e5c8aee...328071d`
    （06 号票）三段两轴复审的发现处置；01–05＋18 已有全批/就地复审凭据
    （2026-09-18），15 号票后补审在案，至此 org-v2 已入库实现票全部经过用户
    额外发起的独立复审。
  - **修复批立票（5 张，均无阻塞，`ready-for-agent`）**：19 简报契约边界完整性
    （amend 冻结点不可降级＋承接方持有件刷新缝＋criteria-gap 分码＋needs-user
    上浮——07/08 同族发现）；20 连续越权计数与上浮（§D）；21 capability 续签
    断链修正＋读面 gate 腿二＋对账独立消费面＋岗位 op 集合同口径裁定（§D/§E，
    含需用户裁定面）；22 探针沙箱快照形态（§E）；23 复审后续行为保持重构批
    （含自 09 号票并行在制移交的简报侧同口径收尾、通知收件人 map 化、
    dispatchCommand 回退分支回收等项）。
  - **就地修复（行为保持＋测试盲区，12 项）**：authz 测试装具改真绑定
    `bindLedger`（原 `issuer.ledger =` 加属性未触闭包 ledgerRef——投影吊销腿
    在鉴权面测试静默失效）＋补吊销腿断言 1 条；post-channel CSRF 重试提取
    `postWithCsrfRetry`（命令/复核两处同型）；probe 导出 `argsMatchArgKeys`
    同口径谓词（runCriterion 消费，brief 侧接线归 23）；op-set 复核帽写 op
    判定提取 `isVerifierWriteOp`（三站点）＋承接岗 researcher/implementer
    共享常量（可执行表＋保留集）；测试装具归一 `tests/helpers/capability-fixture.mjs`
    （clockAt/writeInstanceRow 两文件近逐字复制收敛）；org-permissions HOME
    硬编码改 mkdtemp；review-kit selectReviewer holdingsFor 单调；CONTEXT.md
    「四要素简报」词条补 reviewPoints；06/08 票面 Comments 复审注记（06：复核
    帽 op 空集时点＋移交 20/21；08：验收第 2 项实况＝三判据收敛 deliver 单点
    强制＋移交 19）。
  - **验证**：我方份额 11 文件逐项测试全绿（authz 14/14 含新吊销腿断言）；
    `TMPDIR=/dev/shm npm test` 47/49（唯一红＝**09 号票并行会话在制**的新增
    V-A5.x 条目，失败项两次跑间滚动变化＝对方 TDD 施工态；本批在
    task-ledger.js/task-ledger.test.mjs/brief.js/org-brief.test.mjs 的三处
    微项因同文件并行施工撤销或移交 23 号票，工作树让净）；preflight ①48/49
    ❌（同前归因）②0009 包 7/7 ③0 违例（扫 64 个 md）④11 PASS/0 FAIL/0 SKIP。
  - **授权依据**：2026-09-19 用户 `/code-review` 调用（三票后补复审）＋同日
    裁定「简单任务就地修复，内容较多的按照/to ticket 发布为新 issue」；`/to-tickets`
    技能显式载入照文执行，票面 breakdown 经用户 AskUserQuestion 批准（七张并
    五张）。
  - **未落档面**：无（本条目＋19–23 五票面＋06/08 票面注记齐）。

- ✅ 本轮（org-v2 实现批 **08 号票「复核件套」**，2026-09-18 用户 `/implement`
  调用＝授权；领票时工作树净、01–07＋15＋18 已入库无并行在制品，票面 Comments
  在案；blocker 07 已 resolved）：
  - **范围**：「必审清单＋判据＋gaps 报告＋修复回合＋上浮」一件套，无 stage 机
    （规格 §C、附录 A `V-A2.7`／`V-A1.3`；07 号票留界⑥鉴权读落点与⑧复核者读
    路径的本票份额）。
  - **变化**：
    - `lib/org/review-kit.js`（新）：三判据封闭枚举（before-irreversible-write／
      before-external-visibility／before-cross-instance-handoff）＋报告形状校验
      （gaps＋严重度封闭枚举＋证据坐标＋modelIdentity 必填＋顶层键封闭＝复核者
      唯一可写产物、不携带改工件／改判据字段）＋复核状态折叠（逐 subject 记
      rounds／连续未闭合数／closed，必审集＝简报冻结点∪强制请求）＋复核帽选择
      原语（holdingsFor 空闲判定＋排除产出方＋确定性首中，13/16 召集接线复用）
      ＋fresh-context 移交件（冻结简报＋复核请求/报告史，judgement 判断输入机械
      不可达）＋复核面 gate（帽信封 post=verifier＋op 在帽内＋指定关系；读不消费
      nonce、报告单次消费）。
    - `lib/org/brief.js`：reviewPoints 收紧为必审枚举封闭——枚举外字符串不得
      冻结进简报（命中即强制的冻结期把守）。
    - `lib/org/task-ledger.js`：新非状态事件 review-requested／review-reported
      （负载键封闭）＋新命令 review.request（点∈枚举或咨询主题二选一、简报冻结
      点**不可降级**＝可加审不可免审、强制加审须留归因、reviewer 必填且非产出方
      且台账在手为空＝当次空闲）＋`task.deliver` 装必审拦截（必审点未闭合即
      review-gaps-open 拒绝，不在结算处另设）＋host 侧 recordReviewReport 门面
      （形状／指定关系／产出方不得自任机械校验；强制点连续两轮未闭合自动
      escalated 上浮 waiting-user、通知投影达 user、已挂起不重复上浮）＋通知
      投影两落点（review-requested→指定复核者、review-reported→产出方）。
    - `lib/org/op-set.js`：08 升表——verifier 可执行集＝artifact.read＋
      evidence.probe＋review.report（读面∪执行面、零写 op、无 ledger.read），
      project-lead 升 review.request（命令面写集）；保留集收缩为 evidence.read／
      results.read（裁定包/移交读面，消费方落 09/14 时升表）与 artifact.submit
      （14 提交链）；TOOL_KIND 两新描述。
    - `lib/org/ledger-host.js`：HTTP 面两新路由——GET _ledger/review-handoff
      （帽信封门、读不消费 nonce；07 留界⑥「鉴权读真消费方」的落点）、POST
      _ledger/reviews（帽单次消费、成功响应携带续签帽＝06 链式纪律在复核面的
      兑现，签发权仍在 host）；createLedgerHost 透传 reviewGate/issuer。
    - `lib/org/post-channel.js`：review.report／artifact.read 两 op 路由（复核帽
      与命令链信封**分槽持有**互不覆盖；报告响应续签帽捕获回持；帽初次分发＝
      13 号票自举，本通道不伪造）。
    - `lib/index.js`：createReviewFaceGate 接线进 ledgerHost（issuer＋v2Ledger）。
  - **测试**：新模块 tests/org-review-kit.test.mjs 18 条（枚举封闭／报告形状
    正负例／状态折叠与必审开启集／帽选择台账腿／移交件独立性／复核面 gate）；
    task-ledger 扩 7 条（review.request 校验五类拒绝＋V-A2.7 拦截与闭合放行＋
    咨询性不阻断＋recordReviewReport 四类拒绝＋两轮上浮全流＋事件入事实源可
    重建）＋org-brief 1 条改（reviewPoints 枚举）＋org-op-set 扩 2 条改 3 断言
    （07 快照随 08 升表更新：verifier 可执行集、封闭分类覆盖语义、帽签发形状）
    ＋org-capability-issue 扩 2 条（帽 role 信封携复核面 op、越表签发随升表
    更新）＋org-post-channel 扩 2 条（复核面路由与帽分槽）＋ledger-host 扩 1 条
    （HTTP 复核面全真接线：未携帽 403／移交件读／报告提交与续签帽/冒用拒）。
  - **验证**：`TMPDIR=/dev/shm npm test` 48/48；preflight ①48/48 ②0009 包 7/7
    ③status-lint 0 违例（扫 59 md）④11 PASS/0 FAIL/0 SKIP，四门全绿。
  - **`/code-review` 双轴处置（Standards 硬违例 1／judgement 9；Spec (a)3
    (b)2 (c)1）**：
    - **修**：①review-kit 共用原语去重（isNonEmptyString 自 brief、
      isPlainObject 自 capability-base——02 纪律「同一原语不得两处各留一份」）；
      ②gate 头注 op 名笔误 review.review→review.report；③ledger-host 路由侧
      issuer 防御链噪声消除（构造侧注入为准）；④测试行文（中段 import 归并
      头部、无谓字面量解包删除、模块头注「只测外部行为」与被测面对齐）；
      ⑤op-set 写集断言由 task.* 前缀改按 LEDGER_COMMAND_OPS 词表（08 起命令面
      含管理类 op，词表断言才是本意）；⑥票面 Comments 接缝预核与实物错位更正
      （V-A2.7 拦截等三条实测落 task-ledger.test.mjs）。
    - **留界（未改，理由在案）**：⑦**边界三处宿主侧拦截面**——今日台账唯一
      确定性咽喉＝task.deliver（对外可见边界）；「不可逆写入之前」与「跨实例
      移交之前」的越界动作发生在产出实例工具面（L1 限自身 workspace、部署动作
      用户逐项点名）与 14 提交链，宿主侧无附着点，三判据枚举＋冻结简报
      reviewPoints＋deliver 回兜已把语义守住，附着面随 14/16 补齐；⑧**移交件
      不附工件本体**——按 §F 裁定包同口径「不自动附全文工件，按指针取用」，
      工件本体的机械核验路径＝evidence.probe（fs.contains 开文件对照判据），
      实体读取面随 14 定形；⑨**selectReviewer 生产零调用**——V-A1.3 台账查询腿
      的机械口径原语，13/16 召集接线的复用件，台账侧 reviewer-not-idle 为同
      口径权威门（互指注记在案）；⑩**报告响应续签帽**——06 链式纪律（成功
      认证动作必携下一张）在复核面的兑现，两轮连报（票面第 9 条）的前提，
      签发权仍在 host；⑪REVIEW_BOUNDARIES 判据措辞照规格 §C 原文（含「外部
      API 写入」），较 CONTEXT.md 摘要词更全，不改。
  - **凭据义务**：本条＋票面 Comments（AGENTS.md §1）。零部署动作；零冻结面
    触碰（门② 0009 包 7/7 零触碰）。

- ✅ 本轮（org-v2 实现批 **07 号票「四要素简报与派单租约」**，2026-09-18
  用户 `/implement` 调用＝授权；领票时工作树净、01–06＋15 已入库无并行在制品，
  票面 Comments 在案）：
  - **范围**：四要素简报契约成形并派出即冻结＋派单租约全链（接单／带理由拒收／
    逾期释放均落台账事件）＋接单响应携带简报与能力信封＋探针白名单与判据预登记
    接线（`V-A2.4`／`V-A4.3`／`V-A4.6`）＋05 号票留界 #2/#6/#7/#8/#9 与 06 号票
    留界实例侧接线的本票份额。
  - **变化**：
    - `lib/org/brief.js`（新）：四要素简报校验器——四非空＋顶层键封闭＋交付物
      `{format,location}`／来源 `{tool,ref}` 条目键封闭（「给坐标不给转述、不预置
      产出方语义决定」的结构形态，方法论 #16/#17）；判据冻结期按执行侧同口径
      校验（白名单名＋argKeys 逐字一致）；不可执行＝`criteria-gap` 缺口分类。
    - `lib/org/probe.js`（新）：探针白名单封闭枚举（fs.contains／node.tests／
      ledger.no-anomalies）＋canonical 逐字一致口径＋fail closed 执行体；
      node.tests 经隔离子进程。`V-A4.6` 的「白名单存在且 fail closed」由此成立。
    - `lib/org/dispatch-config.js`（新）：值守例程声明式登记表（两类投递面异常
      处置例程模板在册，ledger-host 异常汇入改从登记表出简报）＋收单规则表纯
      匹配器（条目随 11 号票收单流增补，票面留界在案）。
    - `lib/org/post-channel.js`（新）：bot→host 组织命令通道——台账命令 POST
      （CSRF 会话＋链式能力持有侧）、ledger.read 公开读投影、evidence.probe 执行
      面（判据真源＝台账投影、本地持有件逐字比对后才执行、模型只交
      `{taskId,index}`——「模型不得自报判据」机械化）。
    - `lib/org/task-ledger.js`：intake/plan/amend 简报校验（在场即须合法、amend
      须完整合法件）＋**派出即冻结**（assign 前置 brief-missing）＋accept 成功
      结论携带冻结简报（`V-A4.3` 接单即得契约）＋新 `task.decline`（assigned→
      planned 归队、通知派单方；理由按 §B「可带」＝可选给出须非空）＋新
      `task.return`（triaged→intake 退回分诊）＋sweep 队列滞留三条确定性处置
      （intake→上浮／triaged→退回分诊／planned→上浮，`stallMs` 用户域缝——05
      STATE_RESPONSIBILITY 执行面补齐）＋assign 默认记录 dispatcher。
    - `lib/org/op-set.js`：`task.decline`/`evidence.probe` 升入承接岗可执行表；
      新 EXECUTE_OPS 执行面分类（非台账命令不落事件）；保留集检查改按岗位；
      复核帽可执行集与保留集不变（其 evidence.probe 仍留 08 号票）。
    - `lib/index.js`：bot 分支 registerOrgTools（按 home 岗位派生注册岗位工具
      面，dispatch＝post-channel）＋spawn 透传 `DSH_BOTS_HOST_URL`（运维缝；
      未设则通道休眠并告警）。**简报零进入系统提示段**（提示段组装面无简报
      引用，扫描测试把守）。
    - `scripts/host-contract-probe.mjs`：两台账探针夹具随简报契约换合法件
      （探针行为断言面不变）。
  - **测试**：4 新模块 34 条（org-brief 8／org-probe 7／org-dispatch-config 6／
    org-post-channel 6）＋task-ledger +7（30）＋org-op-set +4（17）；夹具归一
    `tests/helpers/brief-fixture.mjs`；既有台账/宿主/鉴权/签发四模块夹具随契约
    改写（旧「原样存储」简报形状退役）。
  - **验证结果**：`TMPDIR=/dev/shm npm test` **47/47**；preflight 四门绿（①47/47
    ②0009 包 7/7 ③0 违例 ④11 PASS/0 FAIL/0 SKIP）。/code-review 双轴复审
    （Standards 9／Spec 6）全部处置：判据 argKeys 冻结期校验、decline 理由改
    可选、fs.contains 绝对路径判定、队列滞留超时补做（return 事件＋sweep）等
    修复入批；读面 gate 归 08、收单规则表条目归 11、artifact.* 归 08 三项留界
    凭据落票面 Comments。
  - **授权依据**：2026-09-18 用户 `/implement` 调用（/implement 技能流程内
    /tdd、/code-review 引用按 AGENTS §5 显式调用执行）。

- ✅ 本轮（org-v2 实现批 **15 号票「退役冻结评审残余与证据包再生」**，2026-09-18
  用户 `/implement` 调用＝授权；06 号票由并行会话在制，本票按文件面不相交原则
  错开领取——票面 Comments 在案）：
  - **范围**：两件冻结面退役（`lib/review-enforcement.js` enforcement 矩阵＋
    `scripts/review-enforcement-probe.cjs` 探针薄 CLI）＋sentinel 在用原语迁 sentinel
    侧＋证据链修复与 schema 诚实版本化（raw `p6-5-probe-raw/3`、包
    `evidence-package/3`）＋PLAN P0.3 废止标注＋新 runId 再生 **0009** 增量包、
    preflight 门②复绿。
  - **变化**：
    - `lib/sentinel-shadow.js`（新）：自 enforcement 模块**原样迁移** sentinel 系在用
      面——O-3 布局单源（`SHADOW_LAYOUT_MANIFEST`＋`validateLayoutManifest`）、
      canonical JSON 口径（`canonicalJsonString`/`shadowLayoutManifestDigest`）、§5
      不变量（I1–I4/E1–E5）、shadow 执行件（`shadowLayout`/`prepareShadowTargets`/
      `probeDenyPath`/`shadowTargetsOf`/`runShadowProbeCells`/`runShadowProbeSuite`/
      `assertShadowClean`/`saveProbeResults`）——语义零变化；
      `lib/sentinel-runner.js`/`lib/sentinel-provenance.js` 导入重指向。
    - 退役三件：上两件＋`tests/review-enforcement-matrix.test.mjs`；
      `lib/parity-manifest.js` 摘两条退役路径、换入 sentinel-shadow；
      `tests/review-enforcement-retired.test.mjs`（新）＝退役完整性扫描（活面零
      review-enforcement 引用，TEMP-guidance/archive 冻结史不在扫描面）。
    - 证据链修复（必要连锁，票面裁定在案）：runner Phase 3 引用的并发压测测试已随
      03 号票删除（链路自 03 起即断）、Phase 4 spawn 的正是本票退役的探针 CLI，且
      `buildProbeRaw` 硬绑定探针 CLI 在执行闭包内——raw /3 去探针 CLI 绑定字段
      （probeCliHash/probeRuntimeClosure/probeScriptHash）、包 /3 必填面收窄为
      fullRegression/deploymentImpact/provenance，probe/concurrencyStress/treeDiff
      三退役段缺省合法、若在仍验形状（/2 旧 raw 兼容读取；七项绑定核验不动）；
      runner 阶段链＝全量回归→parity→真实面快照；packager CLI 映射条件化。
      旧包只读保留、不覆盖。
    - sentinel 三测试（output-contract／p6-5-guards／layout-manifest）改打**库接缝**
      （进程内 `executeShadow`/`executeRealSentinel`，`ProbeError.exitCode` 即原退出
      码，断言面保持）；provenance/packager 契约测试随 /3 更新；runner-contract 增
      /3 阶段链静态断言（复审 Spec 轴发现补齐）。
    - PLAN P0.3 表节首加废止标注（正文不动，历史可追溯件，规格 §I）。
  - **验证**：`TMPDIR=/dev/shm npm test` **43/43** ✅；preflight 四道门 ①回归 43/43
    ②冻结面（0009 包）7/7 ③status-lint 0 违例 ④宿主契约 11 PASS/0 FAIL/0 SKIP ＝
    `preflight: PASS`（冻结面按新序号包滚动，旧 0008 包零触碰）；`/code-review`
    两轴复审完成（Standards：1 硬项＝落档、即本条目；4 judgement call 采纳改名
    `runRealSentinel`；Spec：2 采纳＝接缝④补断言＋treeDiff 并入 /3 退役段，1 观察
    项记票面）。
  - **授权依据**：2026-09-18 用户 `/implement` 调用；票面接缝预约定与连锁裁定
    （schema /2→/3）在案。
  - **未落档面**：无。

- ✅ 本轮（org-v2 **06 号票：权限四层、op-set 与工具面**——2026-09-18 用户裁定
  wayfinder 裸调转入实现批领本票；/implement＋/tdd 红绿五片＋HTTP/接线一片）：
  - **范围**：规格 §D/§E 全部落库，验收 `V-A3.1`–`V-A3.10`、`V-A4.1`、`V-A4.9`
    ＋动态工具面不变量；冻结面零触碰。
  - **变化**（7 文件改＋7 新）：
    - 新 `lib/org/op-set.js`：op-set 岗位表**唯一源**——§D 域词→台账命令词映射
      （create→plan／claim→accept／brief.amend→amend／escalate→wait-user|fail）＋
      §B 责任表推导扩展（lead 持 close/cancel/unblock/resume/requeue、统筹持
      task.exception，注记在案）；READ/WRITE 封闭分类；TASK_SCOPED_OPS；
      RESERVED_OPS（07/08/12 票保留集，复核帽可执行面现为空）；validateOpSet
      （可执行表＋保留集双向机械检查）与 reconcileIssuedVsOpSet（`V-A3.3` 对账）；
      availableOps 动态不变量；deriveToolFace/registerPostTools（一 op 一工具、
      工具名即 op 名，复核帽注册集天然无写工具＝`V-A4.9`）。
    - 新 `lib/org/capability-issue.js`：capability 签发/验签面——host 签发
      task/role 两类（越表/保留/空集 fail closed＝对账签发侧）、单次消费 nonce、
      短 TTL（默认 15min，注入缝）、代际绑定＋活态槽比对、任务域绑定＋**投影
      吊销**（owner 丢失/离开在办态即 capability-revoked，无吊销窗口）、签发
      审计链 `issued.jsonl`；读面验签不消费 nonce（读重放无害，裁定在案）。
    - 新 `lib/org/permissions.js`：三元组鉴权器（信封活态／op∈home∪当次签发／
      任务域含租约持有；user＝CSRF 通道认证的台账全权、host＝进程内）；**链式
      能力 dispatcher**（每个成功 post 命令返回件携带下一张，assign 签发首张、
      离开在办态不签死信——单次消费下不断链）；读面 gate；L1 `isBotWritablePath`
      策略唯一源（共享面零直写，`V-A3.1`）。
    - `lib/org/task-ledger.js`：命令面装 authorize 钩子（权限拒绝沿 reject() 落账
      回执＝`V-A3.6`）＋capability 透传＋管理类 op 放行 kind=post（细分白名单
      移交鉴权器）；结构性拒绝四类维持不落账（05 遗留「归 06」事项，本票处置
      留档：无可信幂等锚点、落账成写放大面）。
    - `lib/org/ledger-host.js`：HTTP 通道策略——拒收 `actor.kind=host`（403
      host-channel-forbidden，进程内身份不得从通道冒名）；命令经 dispatchCommand
      出手（签发联动接线点）。
    - `lib/index.js`：主 web 实例全接线（鉴权器＋签发面＋dispatcher，postForBot
      读注册表 `post` 字段）。
    - 测试 4 新 45 条（org-op-set 13／org-capability-issue 12／org-ledger-authz 13
      含链式 start→report 接力／org-permissions 7）＋task-ledger/ledger-host 断言
      随契约改写（05 的「post 拒管理类」断言按 §D 放宽）。
  - **验证**：`TMPDIR=/dev/shm npm test` **43/43** ✅；preflight ①回归 43/43
    ③status-lint 0 违例 ④宿主契约 **11 PASS / 0 FAIL / 0 SKIP**（P-V2-LEDGER-
    FORMAT／P-LEDGER-COMMANDS 随本票改动复验 PASS）✅；②冻结面 1/9 ❌＝**15 号票
    并行会话在制**（其改 sentinel 两冻结件并删 review-enforcement 面，票面明示
    以新 runId 重采包复绿）——本票触碰文件与 0008 sourceManifest 九文件零交集。
    /code-review 两轴复审处置完毕：链式续签缺口修复（原设计 start 后断链）、
    虚设断言删除、validateOpSet 补保留集、结构性拒绝处置显式化、OP_SET 扩展补
    §B 推导注记；留界三项（role-cap 分发通道归 07/13、工具与读面 gate 实例侧
    接线归 07、活体演练归 16/17）记于票面 Comments。
  - **授权依据**：用户裁定（wayfinder 裸调 AskUserQuestion 答复「转实现批领
    06 票」）＋票面 13 条验收全勾、Status→resolved。

- ✅ 本轮（org-v2 `/code-review` 复审后续**就地改善**——两轴复审 Standards 轴 5 条
  judgement call smell 全部收口，2026-09-18 用户 `/code-review`（固定点
  `e2f1e58...HEAD`＝03/18 号票＋两文档提交）评审后「就地改善」指令＝授权）：
  - **范围**：行为保持型重构——探针 describe/断言/SKIP 形状不动，Spec 轴上轮零发现。
  - **变化**（3 文件）：
    - `scripts/host-contract-probe.mjs`：「装载→null 检→typeof 检→FAIL」级联收敛
      为 `requireHostExport()`（4 处）；候选文件解析收敛为 `resolveCandidates()`
      （5 处）；「本机未安装宿主」SKIP 前奏收敛为 `noHostSkip()`（8 处，坐标仍按
      发现面区分）；装载捕获抽 `importViaModuleLoader()`；P-CLIENT-LOCALE 迁
      `withDomStubs`/捕获通用件但**保留**其严格 require shim（未知依赖即抛）与
      最小 apply ctx——整体迁记录型通用件会放宽断言，不做；六 id 往返必含集命名
      `OUR_PATCH_MUST_RETAIN`（与 `CONFIG_IDS_CRITICAL` 刻意不同集，差异注记在案）。
    - `tests/host-contract-gate.test.mjs`：root3 迷你装载器 fixture 改复用
      `MINI_PATCH_LOADER` 常量（原逐字重内联）；官方组合 patch fixture 改
      `criticalIdsYaml()` 自 `CONFIG_IDS_CRITICAL` 派生（八 id 字面 3 处→1 处
      独立断言看守漂移）。
    - `CONTEXT.md`：session driver 词条修正失效 adapter 指针——buildReviewRunner
      已随 03 号票退役，在盘 adapter 仅剩 runNativeAgentTurn。
  - **验证**：`TMPDIR=/dev/shm npm test` **39/39** ✅（host-contract-gate 21 条含
    在内）；preflight 四道门 ①回归 39/39 ②冻结面（0008 包）9/9 ③status-lint
    0 违例 ④宿主契约 **11 PASS / 0 FAIL / 0 SKIP**（真实执行重构后全部探针，
    含迁通用件的 P-CLIENT-LOCALE）＝ `preflight: PASS`（冻结面全程零触碰）。
  - **授权依据**：2026-09-18 用户 `/code-review` 调用（固定点 `e2f1e58`）＋同日
    「就地改善」指令。
  - **未落档面**：无（本条目＋18/03 号票 Comments 注记齐）。

- ✅ 本轮（**AGENTS.md §5 技能纪律强化：`/技能名` 形式即调用声明、出现即必须显式
  调用**，2026-09-18 用户指令「在agent.md里强调一下，当出现声明技能调用时
  （强调/xxx的这种形式）必须显式调用」＝授权；AGENTS.md 修订须用户明示——本条
  指令即明示）：
  - **范围**：AGENTS.md §5 增补一句成文纪律——凡以 `/技能名` 形式出现的技能调用
    （无论出自用户指令还是技能流程内引用），出现即必须显式调用、载入全文后照文
    执行，不得以「知道该技能内容」「凭理解做等价事」替代。
  - **事由**：同日 18 号票批中，`/implement` 技能内引用 `/tdd`（"Use /tdd where
    possible"）未显式调用即自行开工 TDD，被用户「我需要你显示调用阅读技能/tdd」
    纠正——既有「引用即显式调用」表述未把 `/xxx` 形式点透，按用户指令强化成文。
  - **验证**：纯纪律文档增补（§5 一处），代码/测试零改动；复跑 preflight 四道门
    ①回归 39/39 ②冻结面（0008 包）9/9 ③status-lint 0 违例（扫 59 个 md）④宿主
    契约 **11 PASS / 0 FAIL / 0 SKIP** ✅。
  - **授权依据**：2026-09-18 用户指令（AGENTS.md 头部「修订须用户明示」由此满足）。
  - **未落档面**：无（AGENTS.md §5＋本条目齐）。

- ✅ 本轮（org-v2 实现批 **18 号票「宿主契约门 A 类探针行为化升级＋V-A6.8 人工目视
  清单」**，2026-09-18 用户 `/implement` 调用「新发布的修复票据」＝授权；上承同日
  `/code-review` 全批重审立票）：
  - **范围**：A 类 5 探针（P-CONFIG-IDS／P-CLIENT-SLOTS／P-CLIENT-VISUAL／
    P-CTX-SERVICES／P-SESSION-LOG）由宿主安装产物标记扫描升级为真实调用＋结果形状
    断言（规格 §H「行为探针」、`V-A6.4`「门只由行为断言把守」）；B 类三探针按规格
    §H 维持形状/存在性探针不动；`V-A6.8` 目视清单备件落票面（执行待核验人）。
  - **五面真实调起机制**（均先经真实宿主 scratch 验证再落码）：
    - `P-CONFIG-IDS`：三段真实调用——我方 patch 构造（lib/shared.cjs）经官方
      dsh-app-boot `loadOverlayPatches` 往返复验；官方组合 patch（dsh-base＋
      dsh-web-app）解析官方 id 全集对照 `CONFIG_IDS_CRITICAL` 八项（patch loader
      对未知 id 无害忽略＝标记扫描抓不到的静默，此处对照必抓）；官方命名空间常量
      （AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE／llm-pi-ai name）核对。只读禁用的
      其余 tool-* id 维持 shared.cjs 已声明可选口径（只核往返不核全集）。
    - `P-CLIENT-SLOTS`：真实 apply 官方 layout/sidebar bundle（ModuleLoader 捕获
      →factory(shim)→apply 记录型 ctx，inject 回调实调——官方 sidebar 把注册藏在
      inject 回调内），断言声明槽树 sidebar single／main keyed／shell.overlay list／
      sidebar.footer.action list。渲染期 priority/abdicate 语义与 conversation
      entryKey 无头不可调起——**显式降级声明**落探针 describe＋登记表 readAccess
      双落点，归 V-A6.8 目视清单。
    - `P-CLIENT-VISUAL`：真实 apply 官方 theme bundle（--dsw-* 官方提供方），断言
      运行期注入样式含 `--dsw-*` 令牌与 `:root` 定义＋theme 服务 getTheme 形状。
      primitives 导出形状与 ownerProps 无头不可调起（primitives 仅存于 shell 产物
      种子表、安装内符号链接悬空可证）——**显式降级声明**双落点：存在性归
      P-PLUGIN-IDENTITY（B 类）、形状归目视清单。
    - `P-CTX-SERVICES`：真实实例化官方 ToolRuntime/SystemPrompt（cordis Service
      构造即 reflect.provide 服务名，tools/systemPrompt 改名必 FAIL）；baseUrl＝
      官方 boot() 空插件树最小调用，断言 ctx.baseUrl 产出形状并喂回
      lib/host-services.js 适配层回读 profile id（产出端→消费端闭环，无降级）。
    - `P-SESSION-LOG`：本机最新真实会话日志喂入 lib/stats.js 真实解码路径（多帧
      zstd→JSONL 事件形状→四大投影）；无已落盘会话→SKIP 带原因（dev 面可见不阻断，
      部署面视同 FAIL 语义不变，`V-A6.3`）。
  - **测试**（四处接缝经用户确认；合成 fixture 驱动，真实宿主实跑归 preflight ④
    不并入套件）：tests/host-contract-gate.test.mjs 新增 11 条、21 条全绿——harness
    装载协议/记录 ctx/DOM 桩正负例、各 stage PASS/FAIL/SKIP、登记表双落点降级声明、
    适配层↔探针 id 无漂移（buildPatchYaml 输出 id ⊆ CRITICAL∪READ_ONLY_TOOLS∪insert）、
    升级探针无宿主 SKIP 三态协议保持。
  - **票面**：18 号票勾选至「代码面完成」（V-A6.8 清单备件落票面，核验人待执行
    署名后代签＝落档作假）；01 号票 V-A6.4/V-A6.8 注记同步收口表述。
  - **验证**：`TMPDIR=/dev/shm npm test` **39/39 个测试文件** ✅；preflight 四道门
    ①回归 39/39 ②冻结面（0008 包）9/9 ③status-lint 0 违例 ④宿主契约 **11 PASS /
    0 FAIL / 0 SKIP**＝`preflight: PASS`（当次实跑输出；六 stage 真实宿主 scratch
    全 PASS 合计 341ms；冻结面全程零触碰）。
  - **授权依据**：2026-09-18 用户 `/implement` 调用（「新发布的修复票据」＝18 号票）；
    接缝清单经用户 AskUserQuestion 确认四处。
  - **未落档面**：无（18/01 票面＋本条目齐）。

- ✅ 本轮（org-v2 `/code-review` 全批重审**小件原地修复＋修复批立票 18**，2026-09-18
  用户 `/code-review` 调用（固定点 `326f4d8` 全批重审）＋同日裁定「任务量较小原地修复、
  较大发布为修复批 issue」＝授权）：
  - **范围**：固定点 `326f4d8...HEAD`（02/04/01/05 号票＋e2f1e58 修复补录）两轴重审。
    上轮「已修复」四项核验全部真实落位、无回归；成文规范未发现新硬违反。
  - **修复（4 件，代码 2 文件＋测试 1 文件）**：
    - **权限缺口（Spec 轴最重项）**：`lib/org/task-ledger.js` `task.wait-user` 补
      `postOwnerOnly`——原任意 post 实例可把他人任务挂成 `waiting-user`（该态无超时
      自动动作＝可被无限期冻结），与 `task.block`（`ownerOnly`）不一致；现 post 触发须
      归属者本人，host／user 上浮终裁／用户域裁定照旧放行（规格 §F）。新增回归用例
      1 条（非归属 post 拒且留痕＋三类触发放行）。
    - `task-ledger.js` 三处「存在性＋投影＋抛损坏」重复收敛为 `findTask(events, taskId)`
      （`loadTask`／`ledger.task()`／`command()`），并修 `command()` 投影损坏时
      `existing` 为 `undefined`（非 `null`）的隐性不一致（`supersedes` 查旧任务与
      `foldAll` 同收——损坏统一为 `ledger-corrupt` 回执或读侧抛）。
    - `lib/host-faces.js` `HOST_FACE_FIELDS` 冻结集补 `failureMode`（校验器无条件消费
      却未入冻结集）；`exclusionReason`／`pending` 以条件键注记（按类别由校验器把守）。
    - `buildEvent` 内「来态留痕」注释漂移修正（实际注入点在 `appendStateEvent`）。
  - **票面如实注记（不改行为）**：01 号票 `V-A6.4`（11 探针中 3 个为真实调用，A 类另
    5 面现为标记扫描、行为化升级立 18 号票；B 类形状探针按规格 §H 合规）与 `V-A6.8`
    （人工目视清单未执行、归 18 号票）；05 号票 Comments 补「评审补修」段（wait-user
    修复＋结构性拒绝四类只回执不落账的边界——unknown-op／invalid-task-id 无法归流、
    invalid-actor／缺幂等键无可信锚点，防写放大；全量语义归 06 号票 `V-A3.6`）。
  - **立票**：`.scratch/org-v2-build/issues/18-probe-behavior-upgrade.md`（A 类 5 探针
    行为化升级＋`V-A6.8` 人工目视清单）——任务量裁定：每面需无头环境真实调起机制设计，
    非原地小件。
  - **留观（不修）**：`reject()` 前四参（taskId／actor／idempotencyKey／op）Data Clump
    ——单文件私有 helper、约 18 调用点纯机械改动，回归风险大于收益。
  - **验证**：`TMPDIR=/dev/shm npm test` **62/62** ✅（task-ledger 23 条）；preflight
    四道门 ①回归 62/62 ②冻结面（0008 包）9/9 ③status-lint 0 违例（扫 59 个 md）④宿主
    契约 **11 PASS / 0 FAIL / 0 SKIP** ＝ `preflight: PASS`（当次实跑输出；冻结面全程
    零触碰）。
  - **授权依据**：2026-09-18 用户 `/code-review` 调用（固定点 326f4d8）＋同日用户裁定
    「任务量较小原地修复，若较大发布为修复批 issue」。
  - **未落档面**：无（01/05 票面注记＋18 号票＋本条目齐）。

- ✅ 本轮（org-v2 **03 号票「退役评审业务面」**，2026-09-18 用户 `/implement` 调用＝
  授权，票面 `.scratch/org-v2-build/issues/03-retire-review-surface.md`；Blocked by
  02 已 resolved；规格出处 spec §I 迁移清单第 3 项、§C 形态废弃）：
  - **范围**：v1 评审形态从业务代码面整体退役——16 个非冻结 `review-*` 模块、插件
    入口评审段、前端评审子面、双席席位／13 stage 协议／提示层双审注入／enforcement
    矩阵业务引用一并消失；冻结面（0008 包 9 文件）零触碰。
  - **删除（40 文件，-13,324 行）**：16 个 `lib/review-*` 模块（capability／
    discussion／envelopes／evidence／flow／http-api／intake／job-tools／jobs／
    migration／orchestrator／protocol／relay／report／results／store）＋21 个
    `tests/review-*.test.mjs`＋`tests/discuss-mail.test.mjs`（专测双审讨论续环）＋
    `scripts/p6-4-verify.mjs`＋`tests/p6-4-verify.test.mjs`（v1 capability 验收
    工具，依赖已退役门面；实例行五字段断言已由 org-capability-base 测试覆盖，
    org-v2 capability 验收归 06 号票）。冻结件 `lib/review-enforcement.js`／
    `scripts/review-enforcement-probe.cjs`／`tests/review-enforcement-matrix.test.mjs`
    留置归 15 号票。
  - **插件入口（lib/index.js 3,657→2,861 行）**：评审 imports、评审主机泵 region
    （emitReviewNotify／buildReviewRunner／handleCompletedInvocation／
    pumpReviewInvocations／startReviewHostWatcher 等）、job 受信链与 reviewHttpApi
    接线、`/api/bots/review/*` 路由分支、apply 内 nonce 清扫／
    reviewPrincipalProvider／engineering+review 组工具注册／评审泵 effect、双审
    两段提示注入（`dsh-bots:review`／`dsh-bots:review-gate`）、send_mail 的
    `kind=mail-discuss` 形参、P3-1 误投守卫、mail-discuss 续环（DISCUSSION_MAX_
    ROUNDS 路径）、P6-1 三路径启动校验（R2-11 宿主受信链件，随链退役；L1 权限面
    重建归 06 号票）、internals 24 项评审导出。
  - **前端（lib/client.js）**：i18n 键 `review.entry`（zh/en）、`reviewApi`、
    `REVIEW_NOTIFY_KEYS`／`reviewNoticeText`／`pushReviewNotices`、SSE `review`
    监听与四个评审导出摘除；`apiText` 通用原语保留。
  - **连带**：`lib/mail-plane.js` mail-discuss 写侧退役（读侧 `inboxHasResponseTo`
    保留历史行容忍，防升级窗口重复回信）；`lib/api-security.js` 摘 `principalFor`
    （P5-4 评审写面适配；CSRF 会话不变）；`lib/org/*` 头注与 org 测试头注残留表述
    清理；`tests/api-security.test.mjs` 改纯 CSRF 门控两层覆盖；`tests/
    client-fetch.test.mjs` 示例路径换中性。
  - **边界注记（归 15 号票）**：冻结件 `scripts/evidence-runner.mjs` Phase 3 spawn
    `tests/review-concurrency.test.mjs`（本轮已删）的悬空引用——冻结面零触碰未改，
    15 号票处置前真实全量证据采集须 `--skip-tests` 口径。
  - **验证**：`TMPDIR=/dev/shm node tests/run.mjs` **39/39** ✅（原 62 文件，本票
    删 23 个评审面测试）；preflight 四道门 ①回归 39/39 ②冻结面（0008 包）9/9
    ③status-lint 0 违例（扫 59 个 md）④宿主契约 **11 PASS / 0 FAIL / 0 SKIP** ＝
    `preflight: PASS`（当次实跑输出；工作树含 18 号票并行在制品，一并过门）。
- ✅ 本轮（org-v2 实现批 **01 号票「宿主适配面与宿主契约门」＋02 号票「通用基座
  拆出」**（与并行会话的 04/05 号票同批），2026-09-16 用户 `/implement` 调用＝
  授权；上承同日 `/to-tickets` 切票与规格冻结；本条目为两票实施的补录落档，
  含 `/code-review` 两轴评审结论与修复）：
  - **02 号票（ba54853）**：capability 原语与 store 底座拆入组织层共用件——新增
    `lib/org/store-base.js`（参数化锁域自旋写锁＋epoch fencing／durable 原子写＋
    O_APPEND 行级追加／audit fail-closed／事件溯源 `createEventSourcing` 类型表
    参数化／one-file-per-key 幂等索引）与 `lib/org/capability-base.js`（HMAC
    canonical 签名验签／nonce 生成与 wx 单次消费／capability 账追加与损坏
    fail-closed／secret 0600／实例身份注册表五字段代际绑定，冻结语义照用）；
    `lib/review-store.js`／`lib/review-capability.js` 改为门面转发（导出面与外部
    行为不变）；新增两共用件契约测试（自定义事件表验证通用性，为 05 台账预演）。
    语义零变化；评审域标签 `review-host-`→`store-host-` 仅出现在锁 takeover
    audit 留痕（无测试/消费断言依赖，CHANGELOG 记录在案）。
  - **01 号票（2140848）**：`lib/host-faces.js` 13 面登记表（A7/B4/C2，字段集冻结、
    C 类显式排除理由、整层拒载仅限 `HF-PLUGIN-IDENTITY`、机械校验）；`lib/host-services.js`
    A 类适配层（服务名与 baseUrl 身份判定单一坐标，`lib/index.js` 三处改走）；
    `lib/client.js` `HOST_SLOTS` 单一坐标＋已知越界 1 处改造（弃读宿主私有 DOM
    `data-sidebar-collapsed`，改槽位 `ownerProps.collapsed` 首挂收敛，幂等标志位）；
    `scripts/host-contract-probe.mjs` 宿主契约探针（preflight 第 4 道门，独立脚本
    不并入套件；9 探针三态、SKIP 分列计数可见、`--face=deploy` 时 SKIP 视同
    FAIL、宿主版本仅诊断、登记表↔门双向一致性）；`tests/run.mjs` 跳过协议（假绿
    修法：`⤼ SKIP:` 标记行分列计数，SKIP 不再与真 PASS 同形；退出码语义不变）。
    实查处置：宿主 0.1.5-rc.1 已无 `dsh-client-runtime` 包且 boot 图对未知 inject
    静默跳过——`package.json` inject 清单剪掉死边（行为不变）；`ui-primitives`
    经 Vite shell 种子表解析（探针按此断言）。v2 台账两面（`HF-V2-LEDGER-FORMAT`／
    `HF-LEDGER-COMMANDS`）登记为 pending，已由 05 号票（3cd8a77）接线转常驻
    （门④ 现 11 探针）。
  - **验证**：`TMPDIR=/dev/shm npm test` **62/62** ✅；preflight 四道门 ①回归
    62/62 ②冻结面（0008 包）9/9 ③status-lint 0 违例 ④宿主契约 **11 PASS / 0
    FAIL / 0 SKIP** ＝ `preflight: PASS`（当次实跑输出；冻结面全程零触碰）。
  - **/code-review 两轴评审结论与处置**（固定点 326f4d8...HEAD，含并行会话
    04/05 票）：Standards 轴——(硬违反，已修复) 01/02 票实施未落 CHANGELOG
    （本条目即补录）；(已修复) 共用件三处残存重复：`appendLedgerRecord` 改
    `appendJsonlLine` 转发、`fsyncDirectory`／`pidAlive` 单实现导出共用、
    `safeBotId`＝`safeObjectId` 域别名；(judgement call，留观) `foldEvents`
    评审域兼容字段已加注、门面文案与 store-base 差异化复写（漂移风险低）、
    门④「无第二写通道」为词法扫描（raw fs 写入检不出，弱探测留界）。Spec 轴——
    (留界) 规格字面「`lib` 内硬编码提示段全部消灭」含 v1 双审两段，票面已声明
    归 03/13 号票；「运行面与部署面 SKIP 视同 FAIL」由显式 deploy 面把守、运行面
    自动探测留界（切换批点名段以 `--face=deploy` 执行）；05 票 `V-A2.11` 勾选
    超出实际（「不再静默」已完成、「回合失败不重试」留 11 号票）——留并行会话
    复核；02 票 `review-results.js` 私有 `appendJsonl` 为评审面内部副本、随 03
    号票退役，不属共用件重复。抽查通过项：capability 白名单/单次消费/短 TTL/
    代际绑定原样；整层拒载唯一面机械把守；台账 bot 零直写、LLM 不写状态。
  - **授权依据**：2026-09-16 用户 `/implement` 调用（含 `/implement` 技能内引用
    的 `/tdd`、`/code-review`）；上承同日 `/to-tickets`（17 张实现票）与规格冻结。
  - **未落档面**：无（本条目补录 01/02 两票；04/05 落档见其各自条目）。

- ✅ 本轮（org-v2 实现批 **05 号票「任务台账面」**，2026-09-16 用户 `/implement`
  调用＝授权；上承同日 `/to-tickets` 切票与规格冻结）：
  - **范围**：任务升格为一等对象——host 侧 append-only 事件日志＋单一写者、**状态＝事件
    投影**（重启可从事件重建未闭合队列）；主干十态＋四旁路且每态答「下一步谁负责、超时
    怎么办」；合法转移由确定性层校验（CAS＋幂等键），LLM 岗位只提交判断输入；归属租约
    与重派封顶；值守例程幂等；异常四类入账；`ledger` SSE 事件；并收掉 01 号票留给本票的
    两条宿主契约面（pending 清零）。规格 §B＋附录 A `V-A2.1`–`V-A2.3`／`V-A2.5`／`V-A2.6`／
    `V-A2.9`–`V-A2.12`。
  - **变化**（新件 4＋改件 5）：
    - 新 `lib/org/task-ledger.js`：状态集与责任表（`STATE_RESPONSIBILITY`）＋转移表
      （**目标状态只由事件类型决定，调用方不得直写**，`unblock`/`resume` 的归位点在白名单内）＋
      命令面（合法性／CAS／幂等键／角色与归属约束：管理类转移只许 host／user，承接类只许当前
      归属者；拒绝 fail closed 并落 `command-rejected` 事件）＋事件 schema 与 hash 链（读侧
      fail closed）＋投影与重启重建（`openQueue`）＋派单租约（`accept` 时限、`heartbeat` 续签、
      `sweep` 回收、重派封顶 `escalated` 上浮用户）＋例程幂等（例程 id＋时间窗）＋异常四类
      （`raiseException`）＋通知投影（`notificationsAfter`）＋LLM 判断输入（`judgement`，从不改状态）。
    - 新 `lib/org/ledger-host.js`：值守轮询（租约回收＋异常汇入＋SSE `ledger` 广播——载荷＝台账投影）、
      异常汇入（v1 两处静默丢失→常设处置任务＋`exception` 事件＋用户通知）、HTTP 面
      （`GET /api/bots/_ledger[/tasks|/notifications?cursor=]`＋`POST /api/bots/_ledger/commands`；下划线前缀不与 bot id 冲突）。
    - 新 `tests/task-ledger.test.mjs`（22 条）＋新 `tests/ledger-host.test.mjs`（8 条）：状态表与
      责任表、主干转移、非法转移／CAS（期望状态＋序号两件必填）／幂等拒绝、**写入前校验**
      （缺 actor／未定义负载键即拒，且台账保持可读）、分诊四值映射与未知取值拒绝、重启重建、
      **单写者锁拒绝**（第二写者 fail closed）、关闭不可重开与 `supersedesTaskId`、一实例一进行中
      任务、租约三条回收路径、重派封顶上浮、心跳续签、例程幂等、judgement 不改状态、amend 通知
      承接方、异常四类、通知投影、篡改 fail closed；接线面：异常汇入与条目级幂等、只报本窗新增、
      值守轮询与广播、**值守 disposer 释放写锁**、HTTP 面（含缺 actor 拒绝后台账仍可读、未接线
      404／方法 405／非法命令体 400）、只读请求零写入、宿主与 bot 分支的 effect 归属。
    - 改 `lib/mail-plane.js`：新增 `readReceipts`／`listMailAnomalies`（投递面异常读取，只报
      本时间窗新增项，旧条目不重复告警）。
    - 改 `lib/index.js`：**仅主 web 实例**构造台账并注册值守 effect（bot 实例不构造、无台账
      写入面）；`_ledger` 路由接线；`internals` 补导三件。
    - 改 `lib/host-faces.js`＋`scripts/host-contract-probe.mjs`＋`tests/host-contract-gate.test.mjs`：
      **`HF-V2-LEDGER-FORMAT`／`HF-LEDGER-COMMANDS` 由 pending 转常驻**，探针
      `P-V2-LEDGER-FORMAT`（落盘一事件一行＋schema/hash 复算＋投影重建＋改动检出）与
      `P-LEDGER-COMMANDS`（路由在位＋命令信封与拒绝形状＋「无第二写通道」扫描）落地，
      **宿主契约门 9 → 11 PASS、pending 清零**。
  - **边界与留界**（逐条已记于票面 Comments）：①命令面的身份三元组鉴权与 capability 签发归
    **06**（本票只交付确定性层的合法性／CAS／幂等与「状态不由调用方直写」的形状；在此之前
    actor 由请求声明，沿用本机部署假设 F-RV-28 口径）；②四要素简报字段校验归 **07**（本票
    `brief` 原样存储）；③v1 两处静默丢失本票完成「**不再静默**」（投递面异常入账＋用户通知），
    **bot 回合内重试的形态改造留 11**（mail 形态改造票）；④`V-A1.4` 类全量不变量与 op-set 归 06；
    ⑤`V-A2.4`／`V-A2.7`／`V-A2.8` 分属 07／11；⑥**本批零部署动作**（受 `AGENTS.md` §2 逐项
    点名约束），v2 部署清单须在切换批（16 号票）重对账——本批新增组织层两件，部署面文件数已变。
  - **评审**：`/code-review` 双轴并行（Standards／Spec），发现并**全部就地修复**：①**P0**——
    命令面缺 `actor` 时会把不合规事件写进事实源，读侧随即永久判损坏（HTTP 面可达）；修为
    **写前 schema 校验**（`writeEvent` 校验失败即拒写）＋`judgement`/`raiseException` 收敛为
    命令面薄包装（校验与写只在一处）＋命令体形状校验。②amend 通知收件人解析错误（通知了
    改动发起人而非承接方）——改为任务在手者。③CAS 序号由可选改**必填**（规格 §D 期望状态与
    序号两件），拒绝事件补记期望状态/序号。④事件 schema/hash 校验**改用共用件
    `createEventSourcing`**（02 号票纪律：同一原语不得两处各留一份），只保留台账域附加校验。
    ⑤负载未定义键由「静默丢弃」改**拒绝**（fail closed）。⑥值守轮询体由 `lib/index.js` 移入
    `lib/org/ledger-host.js`（接线层只留 `ctx.effect`），并补 `index.js` 头部行数现值。⑦删去与
    读路径重复且无生产调用方的 `readLedgerView`（探针改用门面 `view()`）。⑧幂等前置三条路径
    去重为单一助手；`readMaxReceiptSeq` 复用 `readReceipts`。⑨回合失败前缀
    `BOT_ERROR_PREFIX` 由生产者（`lib/index.js`）与检测方（`lib/mail-plane.js`）共用同一常量
    （字面量各写一份时改词会静默失效检测）。⑩分诊四值（直办／立项／澄清／拒收）落地并校验。
    评审留界（已记票面）：五张事件类型表分别维护（新增事件类型需动五处）＝「确定性层表驱动」的
    显式代价，接受。
  - **验证**：`TMPDIR=/dev/shm npm run preflight` ＝ ①回归 **62/62** ✅（较上批 +2 文件）
    ②冻结面（0008 包）**9/9** ✅ ③status-lint **0 违例**（扫 58 个 md）✅
    ④宿主契约 **11 PASS / 0 FAIL / 0 SKIP**（pending 清零）✅ ＝ `preflight: PASS`（当次实跑输出）。
  - **未落档面**：无。

- ✅ 本轮（org-v2 实现批 **04 号票「岗位卡契约面」**，2026-09-16 用户 `/implement`
  调用＝授权；上承同日 `/to-tickets` 切票与规格冻结）：
  - **范围**：把岗位从散落的提示词与硬编码升格为**唯一源的契约件**——五类角色类别
    （值班统筹／项目经理／研究员／实施者／复核者）各一张八字段岗位卡；每岗系统提示段由卡
    渲染派生；仓库加构建期漂移校验（卡哈希与渲染产物不一致即 fail）。规格 §A＋附录 A
    `V-A1.1`／`V-A1.2`／`V-A4.2`。
  - **变化**（新件 4＋改件 2）：
    - 新 `lib/org/role-cards.js`：五张岗位卡（卡文本取自 03 号票裁定表，不新发明政策）＋
      机械校验（八字段齐备／放大机制非空／slug 唯一／第 7 字段留空／第 8 字段为面 id 数组）＋
      渲染派生 `renderPostPromptSegment`＋命名空间派生（`tool:<slug>`／`perm:<slug>`，只由 slug
      派生）＋「不单设岗」裁定编码与卡面一致性校验＋第 8 字段面 id 对宿主适配面登记表的可解析校验
      （引 C 类非宿主面即违例）。
    - 新 `scripts/role-card-drift-check.mjs`＋`lib/org/role-card-digests.generated.json`：
      卡哈希／渲染哈希／渲染文本／两个命名空间＋汇总哈希的构建期基准；`--update` 重生成，
      卡面静态校验不合规时**连 `--update` 一并拒绝**（违规卡面不得被冻成基准）。
    - 新 `tests/role-cards.test.mjs`（13 条）：判据 `V-A1.1`／`V-A1.2`（含改显示名负例与命名空间
      漂移把守）／`V-A4.2`（含「不合规不得生成基准」负例）／不单设岗一致性／`V-A1.3`（复核帽不得
      作 home 岗位）；漂移脚本由本模块以子进程调用并取退出码，即**在全量回归门内**执行
      （规格定门接缝为四道门，故不新起第五道门）。
    - 改 `lib/index.js`：岗位段 `dsh-bots:post`（order 19，在团队段之前）由实例 home 岗位的卡渲染
      派生；注册表 `post` 字段进 create／patch 写入口（非在册／非常设岗一律 400，fail closed）；
      岗位变更触发重启（提示段在 bot 启动时注册）；未知 slug 记 warn 且不注册（不静默降级）。
    - 改 `CONTEXT.md`：新增「home 岗位＝注册表 `post` 字段」词条，区分 v1 遗留的自由文本 `role`
      （显示用、非契约）与 `post` 契约主键。
  - **边界（归他票，已逐条列于票面 Comments）**：v1 遗留硬编码提示段（`dsh-bots:review`／
    `dsh-bots:review-gate` 两段、团队段内「你就是领队时…」席位名硬编码）**不在本票删除范围**——
    03 号票摘评审段、13 号票删 v1 专有注入；`V-A1.4` 全量不变量（一实例一 home 岗位／借用期 op 集
    并集）归 06／13，本票只提供 `post` 字段的读写与校验缝（无此缝则渲染派生不可达＝死代码）；
    锚点席位（`createLeadBot`）的岗位绑定归 13 号票。
  - **验证**：`TMPDIR=/dev/shm npm test` ＝ **59/59** 个测试文件通过 ✅；
    `node scripts/role-card-drift-check.mjs` ＝ `role-card-drift: OK（5/5 卡）` ✅；
    `TMPDIR=/dev/shm npm run preflight` ＝ ①回归 59/59 ✅ ②冻结面（0008 包）9/9 ✅
    ③status-lint 0 违例（扫 58 个 md）✅ ＝ `preflight: PASS`（当次实跑输出）。
  - **评审**：`/code-review` 双轴并行（Standards／Spec）。已处置：`--update` 在卡面违规时改为拒绝写、
    `renderDigest` 重复实现合并、校验器重复违例去重、`post` 写入口补 `V-A1.3` 约束、命名空间前缀
    对称化并写入构建期基准、patch 重启失败提示补「岗位」、两条同名前缀测试改名。
    未采纳但已说明理由：`post` 写入口与重启属「让派生面可达」的缝（全量语义仍归 06／13）。
  - **随附提交（非本票产出）**：`lib/host-faces.js`（01 号票工作树内已落盘未提交的登记表模块——本票
    第 8 字段校验与回归模块引用它，不随附提交会让本批提交的树 `npm test` 变红）；
    `.scratch/org-v2/spec.md` 与 `.scratch/org-v2-build/`（前序 `/to-spec`、`/to-tickets` 的已落盘件）
    以及 `CHANGELOG.md` 中同批未提交的 `/to-tickets` 条目——均为工作树内既有、已落档但未入库的产物，
    本批一并入库防丢；01 号票的**实施**未由本批提交、未领。
  - **授权依据**：2026-09-16 用户 `/implement` 调用（并明示「另有并行对话在工作不要误领」——
    本票与并行对话的 01 号票错开领取）。
  - **未落档面**：无。

- ✅ 本轮（org-v2 实现工单切分 `/to-tickets`：17 张垂直切片发布，2026-09-16 用户
  `/to-tickets` 调用＝授权；上承同日 `/to-spec` 规格冻结）：
  - **产出**：`.scratch/org-v2-build/issues/01`–`17`（新 effort 目录，17 张实现
    票）——规格 `.scratch/org-v2/spec.md` 的垂直切片，编号按依赖序（阻塞者在前，
    已核：所有 `Blocked by` 编号均小于本票）。
  - **落位裁定**：新建 `.scratch/org-v2-build/` 而非续用 `.scratch/org-v2/issues/`
    ——后者住 wayfinder 的 16 张决策票，而 wayfinder 认「`issues/` 里 open ＋
    unblocked ＋ unclaimed 即 frontier」，实现票写进同目录会让已宣告「15/15 全闭、
    frontier 收空」的图看起来又有 frontier。规格本身留在原路径（CHANGELOG 已记的
    冻结位置不动）。
  - **排程态例外两张**：16（重建切换批）与 17（能力放大实验）标
    `ready-for-human` 而非技能默认的 `ready-for-agent`——前者受 `AGENTS.md` §2
    逐项点名约束（部署同步／重启链），后者数值门槛属用户域且实验编制需扩编点名；
    标 ready-for-agent 会让这两张看起来可自动跑完。其余 15 张＝`ready-for-agent`。
  - **关键切分依据（冻结面实查）**：0008 包 `sourceManifest` 的 9 文件＝sentinel
    与证据链（含 `lib/review-enforcement.js`、`scripts/review-enforcement-probe.cjs`），
    **不含**业务评审模块 ⇒「退役评审面」拆两票：**03** 删 16 个非冻结 `review-*`
    模块＋接线（门②不红）＋**15** 退冻结两件并**新 runId 再生增量包**（门②必红→
    复绿）。两票不可混做，否则门②在整个删除期间是红的。
  - **前沿（可立即并行开工）**：**01** 宿主适配面与宿主契约门、**02** 通用基座拆出、
    **04** 岗位卡契约面——三张无阻塞边。
  - **验证**：本轮零代码改动（改动面＝`.scratch/org-v2-build/` 新目录＋
    `CHANGELOG.md`）；`TMPDIR=/dev/shm npm run preflight` ＝ ①回归 **56/56** ✅
    ②冻结面（0008 包）**9/9** ✅ ③status-lint **0 违例**（扫 **58** 个 md，含新
    目录 17 件）✅ ＝ `preflight: PASS`（当次实跑输出）。
  - **未决项**（技能第 4 步的确认问答未获作答，按推荐默认发布，**四项均留可回退**）：
    粒度（17 张垂直切片）／落位（新建 `org-v2-build` 目录）／切批标签
    （`ready-for-human`）／B 组实验单列一票——改落位＝移动目录并同步各票
    `Blocked by`，改标签＝改 `Status:` 行。
  - **授权依据**：2026-09-16 用户 `/to-tickets` 调用；上承同日 `/to-spec`（规格
    冻结）与 org-v2 图 16 票用户裁定。
  - **未落档面**：无。


  2026-09-16 用户 `/to-spec` 调用＝授权；上承 16 号票「15/15 全闭、frontier
  收空、交棒 /to-spec」）：
  - **产出**：`.scratch/org-v2/spec.md`（新件，76,297 字节，SHA-256
    `e69cf380c62157065151771fb6c063d2303d4d473e93212d33dd5f322cb396`，
    短前缀 `e69cf380`）——16 票决议的合成规格，`Status: ready-for-agent`。
    **正文与附录 A 判据清单同批冻结**（13 号票 Q3：成文即冻、记 SHA）。
  - **冻结与记账**：本条目即规格冻结的落档凭据。此后①实现批**只能补执行
    坐标**、不得改判据语义；②判据增删改走显式修订（规格改版或 amend ＋
    本文件授权依据 ＋ 注明触发者与理由）；③**验收执行开始后不得新增判据**
    （方法论 #2）。
  - **正文结构**：Problem Statement（七个具体问题）／Solution（十项形式）／
    **User Stories 130 条**（11 组：接单分诊立项／台账与生命周期／简报派单
    纪律／复核／权限与能力／工具面／人间接口／记忆与知识／恒久性与模型更迭／
    宿主更迭／切换验收回退）／Implementation Decisions（A–J 十节：组织层件与
    岗位契约／任务台账／复核件套／权限四层与 capability／工具面／人间接口／
    记忆与知识层／宿主适配面与探针／重建迁移与切换／恒久性与模型更迭）／
    Testing Decisions／Out of Scope／Further Notes／附录 A。
  - **附录 A 判据清单（唯一权威）**：A 组实现完备性七域 **60 条**——`V-A1`
    岗位集 4／`V-A2` 协议与台账 13／`V-A3` 权限四层 10／`V-A4` 工具面 9／
    `V-A5` 人间接口 6／`V-A6` 宿主适配面 8／`V-A7` 恒久性与记忆知识层 10；
    B 组能力放大 **6 条**（`V-B1`–`V-B6`）。每条三字段（判据文本／执行坐标／
    证据落点）＋覆盖级别（**常驻**／**实验期一次**）。挂标条目**单列计数
    基线＝1**（`V-A1.4`，矩阵前提＝「设计推理（无直接文献）」，16 号票裁定
    口径：MAST 类转正常条目、矩阵类挂标并保留单列计数）；`V-A2.6` 等组织级
    不变量由 03 号票独立裁定、不依赖矩阵推理，故不挂标。
  - **测试接缝（`/to-spec` 第 2 步）**：**全用既有接缝**——①测试套件（逐文件
    派生子进程、任一失败即非零，测试名即执行坐标）②preflight 门（三道既有＋
    **宿主契约门为 11 号票已定的新增第 4 道**）③受控执行探针（沙箱＋白名单＋
    逐字一致校验）④台账投影查询（新建面，语义已由台账决议定型）⑤人工目视
    （白名单内两类）。**不新起平行体系**；A 组常驻判据落成测试模块，
    **不另立机器可读清单文件**（防第三份事实源漂移）。
  - **Out of Scope 与边界**：UI polish／阶段 3-4 基建债／模型选型与 token 预算
    数值／切换部署执行（另起部署批、受 §2 逐项点名）／历史件改写／研究前提
    成立性（验收只核「按设计实现」）。**单向边界指针**指向
    `docs/GROK-DSH-BOTS-COMPARISON.md`「阶段 3：存储统一和模块拆分」「阶段 4：
    可观测和执行隔离」两节，反向不引。
  - **落档范围说明**：`README.md` §2 **不做同步**——该节明文「`.scratch/` 是
    工单工作区（to-tickets/triage/wayfinder 读写面），非文档地图成员」，把本件
    登记进地图反而违其自述约定；规格存在与冻结由本条目承载（12 号票 §8「按
    落档规范登记」的落点）。实现批产出在役文档（如验收报告）时再按
    `docs/<主题>.md` 命名并同步地图。
  - **验证**：本轮零代码改动（改动面＝`.scratch/org-v2/spec.md`＋
    `CHANGELOG.md`）；`TMPDIR=/dev/shm npm run preflight` ＝ ①回归 **56/56** ✅
    ②冻结面（0008 包）**9/9** ✅ ③status-lint **0 违例**（扫 **41** 个 md）✅
    ＝ `preflight: PASS`（当次实跑输出）。规格结构化自检：A 组条目实计
    **60**（4+13+10+9+6+8+10）、B 组 **6**、用户故事 **130** 条／11 组。
  - **授权依据**：2026-09-16 用户 `/wayfinder` → `/to-spec` 调用；上承同图
    各票用户裁定（03–13 号票设计裁定、14/15 号票补充调研、16 号票定稿收口）。
  - **未落档面**：无。

- ✅ 本轮（org-v2 wayfinder 16 号票「研究报告定稿与暂定标注升降级」决议（补充
  调研轮收口票），2026-09-16 用户 /wayfinder 调用＋round 1 七问整批「按推荐」
  ＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/16-report-finalization.md` claimed→
    resolved（Comments 载前置事实与七问、Answer＝七节裁定）；map
    Decisions-so-far 回写 16 行、雾区注释更新终态。**15/15 全闭、frontier
    收空，本图交棒 `/to-spec`**（规格→/to-tickets→/implement）；不预留第二
    轮补充调研。
  - **裁定（七问整批按推荐）**：Q1 定稿形态＝**四件分立＋原报告头部定稿注记**
    ——两份原报告正文保持 09-08 采集原貌不改写、与 supplement 共同构成终稿
    （两轮采集 provenance 不同不混编），被推翻/收窄段（MetaGPT 配档句与
    $2.0→$0.2、ChatDev 每软件成本、矩阵节、MAST「可预防」、信念分叉）由
    注记点名并指向 supplement 对应节；Q2 14/15 号票 16 项升降级方向照单
    全收；Q3 矩阵前提终态＝**设计推理**（复核轮已尽一手检索、直接文献不
    存在——OrgAgent §3.1 限定 flat vs hierarchical；03 号票证据段＋
    `CONTEXT.md` 值守线／项目线词条尾句改写，撤「待补充轮复核」）；Q4
    MAST 终态＝撤标＋收窄就地改写（04 号票触发权依据改挂 v3 一手：FC3
    23.5%、显式 verifier 总失败更少、干预 +15.6%；05 号票「可预防」**收窄
    到 FC1/FC3**——协议类对策对 FC2 不充分〔Insight 2〕、FC2 机制改引
    "collapse of theory of mind"、「框架不如单 agent」标注为转引＋边界）；
    Q5 13 号票「挂标＋单列计数」机制撤销、分类落地（MAST 条目转正常条目、
    矩阵条目改挂「设计推理（无直接文献）」＋保留单列计数），13 号票三处
    改写（「来自 05 的输入」研究依赖行／Answer §2(ii)／证据与限制）；
    Q6 仍不可达六项**全结案不留观察项**（github/raw 直连、platform 文档页、
    web.archive.org、platform.openai.com、WebSearch 缺失、MAST Figure 1
    图形本体——每项已被兜底通道或弃用决定消化）；Q7 不预留第二轮补充调研。
  - **改动面**：16 号票；`CONTEXT.md`（词条尾句，词条数不变 33）；03/04/05/13
    号票标注段；两份原报告（`research/org-patterns.md`、
    `enduring-principles.md`）头部定稿注记；`map.md`；本条目。**不改**：
    01/02 号票与两报告正文（09-08 历史采集记录，「多数可预防」原生表述由
    定稿注记点名收窄）、11 号票（:266 已明确不标＝无实际标注）、map 历史
    梗概行、13 号票 Comments 区 grilling 过程记录。
  - **验证**：本票零代码改动（改动面＝`.scratch/org-v2/`＋`CONTEXT.md`＋
    `CHANGELOG.md`）；`TMPDIR=/dev/shm npm run preflight` ＝ ①回归 **56/56** ✅
    ②冻结面（0008 包）**9/9** ✅ ③status-lint **0 违例**（扫 40 md）✅
    （当次实跑输出）。

- ✅ 本轮（org-v2 wayfinder 补充调研轮——14/15 号票「研究报告盲区一手补全」（map 雾条
  「补充调研轮」于此毕业），2026-09-16 用户 /wayfinder 调用＋网络可用声明
  「网络代理已经提供，测试。可用则启动补全」＝授权）：
  - **票务**：雾条经用户声明毕业为三票——`14-supplement-org-patterns`／
    `15-supplement-enduring-principles`（Type: research，子代理 call the Skill tool
    with "research" 执行，主会话逐条抽验后 claimed→resolved）＋
    `16-report-finalization`（Type: grilling，`Blocked by: 14, 15`，未认领
    ＝**本图唯一 frontier**，交下一会话）。`map.md` 回写 14/15 两行、Notes 补
    2026-09-16 网络可用声明、雾区置空并记「无新雾（本轮发现全部落在 16 裁定域内）」。
  - **补全方向**：14——盲区 1 矩阵节**维持降级**（相邻子论点局部升级）／2 MetaGPT
    **下调**／3 上下文工程、5 OpenAI PDF、6 langgraph-swarm、7 GPTSwarm+MacNet
    **升级**／8 ChatDev 双结论；15——盲区 1 提示词基线、3 Swarm、4 memory tool、
    5 Letta、7 时效面**升级**／2 MAST **维持＋一处下调**／6 记忆附录**维持
    （原怀疑成立、正面结案）**／8 hidden predicate **维持弃用**。
    **两票均不改正文**：报告合并定稿与撤「待补充轮复核」标注全归 16。
  - **压在既有裁定上的三条（须 16 收口）**：①**OrgAgent 不研究矩阵**（v1 §3.1
    限定句 "we focus on two common forms … **flat organization and a hierarchical
    organization**"；「matrix」全文仅 1 次、在 §2 文献罗列句）⇒ 03 号票「值守线／
    项目线共享同一批实例」**仍属 `[推理]`**，与之绑定的 `CONTEXT.md` 词条标注仍在原位；
    ②**MetaGPT 的按岗配档句与「每软件 $2.0→$0.2」无一手支撑**（v7 全文 `GPT-3.5` 只在
    backend 对比与 HumanEval 实验，唯一美元数字＝附录 Table 9 Avg. `$1.12`）⇒ 该两事实
    应删、「按岗配档」改挂 Anthropic＋OpenAI 指南 PDF **p8**；③**MAST 一增一减**——
    占比拿到且是正文文字（FM-1.3 **15.7%** 为最大项、无一项超 16%；**图号更正＝占比图是
    Figure 1**，v3 的 Figure 2 是方法学流程）＋§5.3 "challenges in **organizational
    design and agent coordination**" 句直供 04/05；但 MAST 明说**协议类对策不足解决
    FC2**（05 号票「多数可由协议预防」须收窄到 FC1/FC3），且「信念分叉」**不属 MAST**
    （v3 `belief`/`diverg` 命中 **0/0**，该词归 Cognition）、「框架系统不如单 agent」
    在 MAST 里是**转引**（Agentless／AI Agents That Matter）非其自证。
  - **关键新事实（本轮一手采集）**：Anthropic《Claude 4 best practices》**已改名**
    《Prompting best practices》（308）且**「empowerment vs control」查无此表述**
    （platform 全站 34.6 MB 语料／code.claude.com／2026 版博客 `empower` 命中
    **0／0／0**；官方最接近句是相反方向的「别过度约束角色」）⇒ 该说法不引入规格；
    **D3 反获更强一手依据**（Fable 5 "Refactor existing prompts and skills … often
    too prescriptive"／Opus 5 "remove these instructions rather than rewriting
    them"／"dial back any **aggressive language**"／"Prefer general instructions
    over prescriptive steps"）；**真正被宣告退役的是 prefill 与 `budget_tokens`**，
    XML 标签与多示例只是**降级保留**、否定式指令口径＝「讲清为什么」；
    **mem0 记忆架构＝跨厂商记忆混淆**（Anthropic 多 agent 文全文仅 2 处 `memory`、
    无附录无 mem0）⇒ 10 号票三层记忆不得写成 Anthropic 做法；时效面＝A2A 规范
    **1.0.0**（前 0.3.0）、MCP registry **in preview**（治理 LF Projects, LLC）、
    `agents.md` 归 Agentic AI Foundation；langgraph 现站已无 swarm/supervisor 二词
    （改 Subagents/Handoffs/Skills/Router）而 67% 与 40–50% 数字仍在＝反向强化
    「API 速朽、原则恒存」。**环境**：`platform.claude.com` 文档页**仍区域封锁**
    （307→`app-unavailable-in-region`），兜底通道 `platform.claude.com/llms-full.txt`
    **不受封锁**（本轮 platform 侧引文全由此出）；`github.com`／
    `raw.githubusercontent.com` 直连超时（改走 `api.github.com` contents API）；
    `web.archive.org` 超时、`platform.openai.com` 403；会话工具面**无 WebSearch**
    （Bing 为过滤版、不遵守引号短语）⇒ 时效面取不到带日期的 changelog 条目。
  - **同步**：`map.md`（Notes／Decisions-so-far／雾区）；两份补充研究报告落
    `.scratch/org-v2/research/org-patterns-supplement.md`（338 行）与
    `enduring-principles-supplement.md`（588 行）＝上游 throwaway branch 约定的本地化。
    `.scratch/` 非文档地图成员（README §2），无地图同步项；`CONTEXT.md` **本票不动**
    （词条标注的撤留属 16 裁定域）。
  - **验证**：本票零代码改动（改动面＝`.scratch/org-v2/`＋`CHANGELOG.md`）；
    `TMPDIR=/dev/shm npm run preflight` ＝ ①回归 **56/56** ✅ ②冻结面（0008 包）
    **9/9** ✅ ③status-lint **0 违例**（扫 40 md＝含新票三份＋补充报告两份）✅
    （当次实跑输出）。主会话抽验实跑：OrgAgent HTML §3.1 限定句／MetaGPT 全文唯一美元
    数字 `$1.12`／MAST 12 项百分比＋`belief`·`diverg` 0/0＋Figure 1 图号／platform
    `empower` 0 命中＋`llms-full.txt` 行号锚点（137023／137509／137797／138310）
    ——**先验证再断言**。更正一条自记事实：本批初查 `platform.claude.com` 记「可达」
    系 `curl -L` 吞掉 307 所致（实为区域封锁页），已在 15 号票 Comments 诚实记账。

- ✅ 本轮（org-v2 wayfinder 逐票工作批——13 号票「v2 规格验收标准」决议（本图末票），
  2026-09-16 用户 /wayfinder 调用＋round 1 八问「无异议」＋round 2 三问「按推荐」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/13-spec-acceptance.md` claimed→resolved
    （`## Comments` 载 round 1 前置事实 F1–F4＋八问、round 2 七域判据清单全文＋三问；
    `## Answer`＝十节裁定）；map Decisions-so-far 回写 13 一行、12 号票 map 行补
    「＋A 组验收坐标无空缺（13 号票补）」、12 号票正文补「来自 13 号票的输入」节；
    **13/13 全闭、frontier 收空，本图交棒 `/to-spec`**；雾区无毕业无新增（补充调研轮
    仍待用户声明网络可用）。
  - **裁定（八问＋三问）**：Q1 判据清单＝**规格附录节**为唯一权威（不新建清单文件），
    每条带判据文本／执行坐标／证据落点，「过」分可执行·台账投影·人工三类（人工白名单
    ＝前端目视＋知识复用率核对）；Q2 依赖暂定结论的条目只核「按设计实现」、挂
    `待补充轮复核` 并单列计数，out of scope 面单列排除，岗位评测集只判「每岗至少一
    可执行评测项存在且可跑」；Q3 判据**随规格定稿同批冻结**、实现批只补坐标、增删改走
    显式修订、**验收开跑后不得新增判据**（方法论 #2）；Q4 任务基准＝现场构造 3–5 个按
    放大机制各取一、不用历史回放、**裸对照先跑定基准集**；Q5 **裸实例＝同基础工具面＋
    无组织命令**（按命令面切，覆写 08 §5「同工具面」口径并记出处）；Q6 成本三口径复用
    `lib/stats.js`、**token 为主口径**、B 与倍数数值属用户域（实验前预登记），实现面
    唯一硬新增＝任务域用量聚合；Q7 **归因不进判定**、判定两态 fail closed、不通过走修复
    复跑两轮未闭合上浮、不做事后判据调整；Q8 A 组随实现批（实施者执行＋复核帽独立核验）、
    B 组＝切换批最小闭环 smoke 后一次性实验（值班统筹编排、产出方≠复核者、按 09 口径
    投递用户终裁），证据进增量包、摘要进 CHANGELOG、通过记录进台账；RQ1 **A 组七域
    60 条**（增设第七域「组织恒久性与记忆/知识层」承载 08/10）；RQ2 B 组六条；RQ3
    判据分**常驻／实验期一次**两级，规格底稿允许 `坐标待实现批补齐` 但**切换批前置加
    「A 组坐标无空缺」**（12 号票切换点判据的第四条）。
  - **关键新事实（只读调查，坐标回源核验）**：`preflight` 三道门**无 SKIP 通道**、
    第 4 道 `host-contract` 尚不存在；包链 0008＝终版（`sourceManifest` 9 文件，
    记 `fullRegression 45/45`＝当批口径，今日 `tests/` 56 文件，验收须取当次实测值）；
    代码中 "ledger" 两名两义（SSE 重放环形窗口 `lib/index.js:240`；评审 capability
    job 账 `lib/review-capability.js:280-302`）——**任务台账与任务域用量聚合均零实现**；
    SSE 服务端事件实为 `bots`/`mail`/`review` 三类（`lib/index.js:810/2768/2811`），
    客户端另听 `reload`，**`ledger` 通道待实现**；`artifacts/` 无 `ledger/` 目录、
    `artifacts/archive/org-v1-runtime-<date>/` 尚未存在。
  - **同步**：`CONTEXT.md` 新增词条「验收判据清单」「能力放大验收」（词条数 31→33）＋
    「重建切换批」补第四条切换点判据；`map.md` 的 12 行与 13 行按裁定同步。
  - **验证**：本票零代码改动（改动面仅 `.scratch/org-v2/`、`CONTEXT.md`、`CHANGELOG.md`）；
    `TMPDIR=/dev/shm npm run preflight` ＝ ①回归 56/56 ✅ ②冻结面（0008 包）9/9 ✅
    ③status-lint 0 违例（扫 35 md）✅（当次实跑输出）。

- ✅ 本轮（org-v2 wayfinder 逐票工作批——12 号票「v2 重建的迁移与并存策略」决议，
  2026-09-16 用户 /wayfinder 调用＋round 1 六问＋round 2 三问全裁「按推荐」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/12-migration-coexistence.md` claimed→resolved
    （`## Comments` 载 round 1 八问＋round 2 三问＋F1–F8 事实表；`## Answer`＝十节
    裁定）；map Decisions-so-far 回写 12 一行、**雾区「最小起步编制与 bootstrap」
    毕业消解**（Out of scope 的「8 文件部署批」行同步改为「已收口」）；13 号票补
    「来自 12 号票的输入」；12 无下游阻塞票，**frontier 收为「13」，首号＝13**。
  - **裁定（九问）**：Q1 **一批式切换、不设双轨**（前置段＝组织层件＋11 号票四项
    ＋迁移工作清单／点名段＝部署同步→重启链各一次点名／切换段＝单窗口内撤旧四席→
    建双席→探针→最小闭环 smoke；切换点判据三条并行全绿：preflight 四道门／就绪
    探针／用户点名）｜Q2 **旧四席 id 不用**——新建语义 id（锚点 `duty-coordinator`、
    `implementer` 等），`createLeadBot` 改为建 v2 锚点、`lib/index.js:1064` 删除保护
    改「bootstrap 锚点席位不可删」、空表重建（`3358-3362`）改锚点、v1 注入与硬编码
    （`2386-2416`／`3080`／`3121`）随形态删｜Q3 **双席起步**（就绪＝门绿＋探针＋
    最小闭环 smoke，验收实验按需扩编不抬升起步），雾条由此消解｜Q4 mail **保数据
    不保形态**（保 at-least-once／幂等回复／nextSeq 锁；废 `kind` 与 `replyTo⟺kind`
    ——在产反例：`reviewer-second` 一条 `mail-discuss` 无 replyTo；关联键改 taskId）
    ｜Q5/Q5' 评审面 **16 个非冻结 `review-*` 模块删净**（7114 行＝`lib/` 39%）＋
    capability HMAC/nonce/ledger 原语与 store 锁/原子写/audit/幂等键**拆出为组织层
    共用件**＋**冻结面 9 文件零单独触碰**——`lib/review-enforcement.js` 的 enforcement
    矩阵删除**并入 v2 实现批的证据包**（不单开 0009；其 `canonicalJsonString`／
    `SHADOW_LAYOUT_MANIFEST` 仍被 sentinel 系使用）＋PLAN P0.3 表**加废止标注不删表**
    ｜Q9 **证据包链与 preflight 门② 存续**（AGENTS.md §2 是长期纪律而非 v1 评审形态
    附属；v2 实现批照旧出包、冻结面随每批增量包滚动）｜Q6 SSE 保形态、事件集改
    `bots`/`mail`/`ledger`/`reload`（新增 `ledger` 承载台账投影＝人间收件箱数据源；
    11 Q3「不新增台账事件类型」约束的是台账事件类型、不含 SSE 通道类型）＋知识库
    `R-2026-*` 9 条原样保留、双审规程链**新登记一条显式废止 R-2026-009**（不改写
    其正文）、008 与 001–005 保留｜Q7' 旧席数据 **归档后清运行面**——`profiles`
    配置件（去 node_modules）＋`bot-workspaces`（每席仅 1 个 66B 会话指针）＋mail／
    review 存量 → `artifacts/archive/org-v1-runtime-<date>/`（先例
    `profiles-pre-resync`），需点名授权；回退面＝`deploy-pre-org-v2-<date>` 备份＋git
    提交点、回滚权在用户不演练｜Q8 阶段 3/4 债以**单向边界指针**（规格→PLAN）挂接、
    反向不引。
  - **关键新事实（本批采集）**：四席进程**当前全部不在运行**（唯一存活＝宿主
    `node /usr/bin/dsh web` pid 946；注册表 pid 965/1007/1028 已消失、939 已被 snapd
    复用＝代际绑定用例），故撤销无停机窗口问题；`bot-workspaces` 记忆面为零（每席
    1 个 66B `.dsh-bot-session.json`）；评审 store 数据面仅 12 文件（audit 1 行＋
    过期 capability＋migration 5 件）；`scripts/preflight.mjs:38-57` 门②按最大序号包
    逐文件核 sha256＋byteLength ⇒ 触碰冻结面必然红、必须配新包 run。
  - **同步**：`CONTEXT.md` 新增词条「bootstrap 锚点席位」「重建切换批」（词条数
    29→31）；`map.md` 雾区／Out of scope 同步；13 号票输入补充。
  - **验证**：本票零代码改动（改动面仅 `.scratch/org-v2/`、`CONTEXT.md`、
    `CHANGELOG.md`）；`TMPDIR=/dev/shm npm run preflight` ＝ ①回归 56/56 ✅
    ②冻结面（0008 包）9/9 ✅ ③status-lint 0 违例（扫 35 md）✅（当次实跑输出）。

- ✅ 本轮（org-v2 wayfinder 逐票工作批——11 号票「宿主/插件面更迭的隔离与升级」
  决议，2026-09-16 用户 /wayfinder 调用＋round 1 七问全裁「按推荐」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/11-host-surface-churn.md` claimed→resolved
    （`## Answer`＝七节裁定；`## Comments` 载 round 1 七问＋宿主耦合面／漂移
    检测现状两张事实表）；map Decisions-so-far 回写 11 一行、雾区无毕业无新增
    （补充调研轮/bootstrap 两雾条不受本票影响）；12 号票补「来自 11 号票的输入」
    （适配层/探针/守卫修法/越界改造四类代码落地清单）；11 无下游阻塞票，
    **frontier 由「11＋12＋13」收为「12＋13」，首号＝12**。
  - **裁定（七问）**：Q1 判定规则＝按**失配后果**分类而非按层（A 静默降级面→
    可替换适配层＋行为探针／B 响亮面→登记＋存在性探针、可直用／C 非宿主面
    显式排除），**版本探测仅诊断字段不作门**（宿主今日实测 `0.1.5-rc.1`，rc
    语义不构成兼容承诺；本仓零版本约束）｜Q2 **宿主适配面登记表补进组织层件
    白名单第 6 类**，切分照 10 号票（容器协议进白名单、条目内容＝运行时资产
    ——宿主更迭改条目不改规格正文），岗位卡第 8 字段＝引用面 id 不重复坐标｜
    Q3 探针三态 PASS/FAIL/SKIP：SKIP 必须分列计数可见（修掉
    `tests/locale-runtime.test.mjs:24-28` 守卫 `exit 0` 与真 PASS 同形的假绿）、
    **运行面与部署面 SKIP 视同 FAIL**、FAIL 默认**面级降级**（照 07 三分支
    口径）、**整层拒载仅限组织层身份面**（插件名与 inject／bundle 协议／
    inject 清单），失效以 class=duty 例程任务落台账＋按 09 告知（**不新增台账
    事件类型**）｜Q4 挂载＝独立 `scripts/host-contract.mjs` ＋ preflight **第 4
    道门**（不并入 tests/：只报 N/N 无 SKIP 通道、且其纪律为不耦合宿主安装
    状态），与 `locale-runtime` 行为断言互补｜Q5 发现靠值班统筹 duty 巡检例程、
    处置链同 08 升级例程四步同构、组织层自足回退＝「已探明面」降级形态、
    **宿主版本处置归人间面**（06 口径）、红线＝不得回退为「取消适配层直读宿主
    私有面」｜Q6 前端红线＝只依赖宿主**显式注册面**、**禁读私有 DOM/CSS 钩子**
    （`lib/client.js:3064` `[data-sidebar-collapsed]` 越界 1 处登记在案），验收
    ＝槽装载探针＋一次人工目视功能清单、**不设视觉回归**、宿主 UI 大改不构成
    「重做前端」义务｜Q7 本票出**规程＋登记表初版（逐面坐标）**，代码面全归 12。
  - **同步**：`CONTEXT.md` 新增「宿主适配面」「静默降级」两词条；「组织层件」
    词条白名单枚举补「宿主适配面登记表容器协议」（标注 11 号票扩展）。
  - **验证**：本票只产决策不产代码（终点＝规格）；`TMPDIR=/dev/shm npm run
    preflight` ＝ ①回归 56/56 ✅ ②冻结面（0008 包）9/9 ✅ ③status-lint 0 违例
    （扫 35 md）✅（本票改动仅 `.scratch/` 与 `CONTEXT.md`/`CHANGELOG.md` 文档面，
    无 `lib/`、`tests/`、`scripts/` 改动）；与 03（岗位卡第 8 字段引用化）、05
    （台账命令面纳入组⑦、不新增台账事件类型）、06（运维归人间面）、07（降级
    三分支、不另起装载面）、08（D8 移交本票的「cordis 槽位隔离为适配层」由本票
    收口、白名单扩展方式）、09（告知面）、10（容器/条目切分）已决事项调和核对
    无冲突。

- ✅ 本轮（org-v2 wayfinder 逐票工作批——10 号票「团队记忆与知识层」决议，
  2026-09-16 用户 /wayfinder 调用＋round 1 八问全裁「无异议」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/10-memory-knowledge.md` claimed→
    resolved（`## Answer`＝八节裁定）；map Decisions-so-far 回写 10 一行、
    雾区无毕业无新增（补充调研轮/bootstrap 两雾条不受本票影响）；13 号票
    补「来自 10 号票的输入」（复用率 KPI 人工核对、非自动化验收判据）；
    10 无下游阻塞票，**frontier 由「10＋11＋12＋13」收为「11＋12＋13」**，
    首号＝11。
  - **裁定（八问）**：Q1 记忆三层定形＝岗位私有（workspace 自由笔记、L1
    唯一直写区）＋团队共享**不设独立第三面**（任务事实→台账、可复用结论→
    知识库）＋组织常量＝配置面不算运行时记忆｜Q2 岗位私有记忆不建结构化
    技能库（07 规程两形态收编 02「技能库」表述）、文件即记忆（session
    残留不作依据）、实例消亡无备份迁移义务（刻意低承诺）｜Q3 写入三问
    分流：任务历史事实→台账事件、跨任务有效→knowledge、两者皆否→taskId
    工件存档；模型推理过程不进任何面（fresh-context 隔离）｜Q4 晋升＝关闭
    流程内产出方登记、强制由四要素简报 output format 预声明（全局不强制，
    06「登记不构成完成依据」）、门槛三条（换模型试金石/可独立成立/reused-
    supersedes 留痕）、不设强制复核点（不命中必审三判据，保留可加审）｜
    Q5 失效＝显式 supersedes/deprecated 唯一机制（不物理删除、不做自动
    失效/热字段）、升级例程沉淀同案登记；冲突处理台账胜＋岗位卡胜（条目
    须 supersede 收口）｜Q6 **知识库容器协议补进组织层件白名单**（08 张力
    收口）、条目内容＝运行时产出资产逐条自负试金石、不属岗位细节三处｜
    Q7 移交只传指针（taskId＋工件坐标＋知识 id）拉取式自取、工件归档不
    删档无保留期上限｜Q8 检索维持索引级子串（否决 embeddings/全文——02
    反例）、「开工先 search」引导只写调研承载岗卡片（岗位卡唯一源）、
    复用率 KPI 人工核对进 13 号票输入。
  - **同步**：`CONTEXT.md` 新增「记忆分层」「知识库」两词条；「组织层件」
    词条白名单枚举补知识库容器协议（标注 10 号票扩展）。
  - **验证**：本票只产决策不产代码（终点＝规格）；与 02（记忆三层、
    embeddings-RAG 反例）、05（关闭归档、台账权威、taskId provenance 根）、
    06（登记权全员、登记不构成完成依据）、07（规程两形态、knowledge 命令
    化、岗位卡唯一源）、08（组织层件白名单、升级例程沉淀）已决事项调和
    核对无冲突——02「团队共享＝仓库文件」「可执行技能库」两表述与 06/07
    裁定的张力已在 Answer §1/§2 显式收编记录。
- ✅ 本轮（org-v2 wayfinder 逐票工作批——09 号票「人间接口规格」决议，
  2026-09-12 用户 /wayfinder 调用＋round 1 六问全裁「无异议」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/09-human-interface.md` claimed→
    resolved（`## Answer`＝六节裁定）；map Decisions-so-far 回写 09 一行、
    雾区无毕业无新增（补充调研轮／bootstrap 两雾条不受本票影响）；09 无
    下游阻塞票，**frontier 由「09＋10＋11＋12＋13」收为「10＋11＋12＋13」**，
    首号＝10。
  - **裁定（六问）**：Q1 到人裁定仅三类进 `waiting-user`（不可逆放行／上浮
    终裁／用户域裁定请求），其余到人事件纯告知不挂起、验收终裁不默认等人｜
    Q2 投递面＝**DSH 前端人间收件箱**（台账事件投影＋终裁操作；mail 仅出
    仓库只读转发、回文永不构成裁定；前端实现形态仍 out of scope）｜Q3 挂起
    **无超时自动动作**（无限期、提醒仅投递面节律不生台账事件；业务 deadline
    仅投影「已过期」不自动取消）｜Q4 验收初审代理＝「B 收窄版」（清单外产出
    可处置、必审产出只整理裁定包、初审拒绝/两轮未闭合强制上浮；模型指派/
    越权处置/冲突仲裁永不可代）｜Q5 终裁＝`actor=user` 台账命令特化视图、
    不另起第四命令面（authorize-repair＝允许进入修复回合）｜Q6 裁定包五件
    （冻结简报/判据事实/双方立场＋taskId 轨迹指针/动作清单/模型身份）。
  - **同步**：`CONTEXT.md` 新增「人间收件箱」「验收初审」「裁定包」三词条。
  - **验证**：本票只产决策不产代码（终点＝规格）；与 04（user-decision
    升格终裁原语）、05（waiting-user/通知事件投影）、06（user principal
    台账全权、零权威通道）已决事项调和核对无冲突。
- ✅ 本轮（org-v2 wayfinder 逐票工作批——08 号票「组织恒久性判据」决议，
  2026-09-12 用户 /wayfinder 调用＋round 1 六问全裁「无异议」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/08-durability-criteria.md` claimed→
    resolved（`## Answer`＝六节裁定）；map Decisions-so-far 回写 08 一行、
    雾区「基建债合流指针」毕业为 12 号票输入；**下游接线**：11、13 因 08
    resolved 解锁，frontier 由「08＋09＋10＋12」扩为「09＋10＋11＋12＋13」，
    首号＝09。
  - **裁定（六问）**：Q1 分界规则＝组织层件**白名单封闭枚举**（协议/台账/
    复核件套/权限四层/岗位卡 1–6/8 字段）逐条过「换模型试金石」，岗位细节
    只住三处（岗位卡第 7 字段/提示段/实例配置）、升级只动三处｜Q2 判据终清单
    **D1–D11**（02 号 D1–D10 三分调和：D5 改写「可执行规程资产」两形态、
    D8 MCP 字样移出改「工具面岗位卡派生跨模型稳定」——覆写出处 07；＋06
    号 D11）｜Q3 升级例程四步＝指派变更→台账自动登记 duty 评测任务→新模型
    跑评测集→做减法→用户终裁｜Q4 评测集＝**契约回放**每岗 1–3 冻结样本
    （样本过试金石），存量抽验不进规格｜Q5 价值表述＝「裸实例（同模型同权限
    **同工具面**、去组织层）预算 B 内完不成而组织形式同量级完成」｜Q6 放大
    验证＝3–5 任务按机制各取一＋裸对照＋台账事件投影归因（不做消融）、
    一次性验收实验执行与数值门槛归 13 号票。
  - **同步**：`CONTEXT.md` 新增「组织层件与岗位细节」「岗位评测集」两词条。
  - **验证**：本票只产决策不产代码（终点＝规格）；依据＝02 号研究报告
    D1–D10 判据清单＋03–07 已决事项调和核对（D5/D8 与 07 号裁定张力已在
    票面显式报告并经用户裁定收口）。
- ✅ 本轮（org-v2 wayfinder 逐票工作批——07 号票「岗位工具配置（MCP/skill）」
  决议，2026-09-12 用户 /wayfinder 调用＋round 1 八问/round 2 两问均裁定
  「无异议」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/07-tooling.md` claimed→resolved
    （`## Comments`＝前置事实六条只读代码调查；`## Answer`＝10 节裁定＋
    归位表）；map Decisions-so-far 回写 07 一行、雾区两清除（bot 侧执行
    承载、岗位卡↔提示层同步——均由本票裁定收口）、bootstrap 条目收窄为
    可与 12 合流；**下游接线**：12（mail 存废与旧直写删除时点）、13（工具
    面验收候选）、10（knowledge 晋升/失效仍归彼）。**frontier 由「07＋08＋
    09＋10」收为「08＋09＋10」，首号＝08**（11 待 08、13 待 08；12 的
    前置 03–07 已全 resolved）。
  - **裁定（round 1 八问）**：Q1 装载架构＝**复用 cordis tools 服务**按
    岗位卡派生注册（否决 MCP／自建 bot 侧装载面；规格只锁「组织命令经
    认证 host 通道」）｜Q2 **一 op 一工具**、工具名即 op 名（06 op-set
    一一映射；复核帽注册集本身不含写工具）｜Q3 岗位卡＝**唯一源**、提示段
    为派生物（cordis systemPrompt 渲染）＋构建期哈希漂移校验 fail、lib 内
    硬编码提示段消灭｜Q4 简报＝**claim 响应携带**（＋amend 事件投影推送、
    capability 信封同响应），不进 systemPrompt｜Q5 mail **收口 host 中继**
    （send_mail→认证命令 mail.send、bot 直写 inbox/outbox 取消、host 唯一
    writer；零权威线不动；存废/删除时点归 12）｜Q6 knowledge register
    **命令化**（knowledge.register 全员 op）、search 与磁盘直读照旧｜Q7
    runProbe 判据改接**台账 acceptance 预登记**（模型不自报保留；白名单
    机制 fail closed 入规格、命令清单实现轨道可扩）｜Q8 失效语义＝**无
    文件直写降级**（通道不可用→回执＋重试＋escalate；鉴权拒→台账事件；
    语义失败→进流程；阈值用户域）。
  - **裁定（round 2 两问）**：Q9 **v2 词表无 skill**（规程性知识＝岗位卡＋
    knowledge 两形态，不设运行时 skill 装载）｜Q10 戴帽/借用不变量＝
    **实例可用工具集＝home 岗位 op ∪ 当次签发 capability 的 op**（帽卸/
    租约回收即失效、与 06 吊销同拍；动态注册 vs 门控属实现轨道，门控路线
    须双层排除写 op）。
  - **验证**：本票只产决策不产代码（终点＝规格）；依据＝只读代码调查＋
    上游票 03–06 裁定，不依赖网络。上游 06 号票落档先行单独提交（77d73bd）。
- ✅ 本轮（org-v2 wayfinder 逐票工作批——06 号票「权限模型」决议，2026-09-12
  用户 /wayfinder 调用＋round 1 八问/round 2 两问均裁定「无异议」＝按推荐授权）：
  - **票务**：`.scratch/org-v2/issues/06-permissions.md` claimed→resolved
    （`## Comments`＝前置事实五条只读代码调查；`## Answer`＝11 节裁定＋归位表）；
    map Decisions-so-far 回写 06 一行、雾区三条更新阻塞面（执行承载/编制
    bootstrap 收窄为等 07；岗位卡同步面补权限依赖面注）；**下游接线**：07
    （命令装载面＋capability 递送不经 mail＋mail host 中继接线位＋knowledge
    命令化授予＋岗位卡第 8 字段记权限依赖）、08（恒久判据加「无岗位以
    danger-full-access 为履约前提」）、09（user principal 台账全权＋越权通知
    到人）、10（knowledge 登记权全员＋登记≠完成依据）、12（capability 存续
    细化＋实例基底×任务域正交叠加取严＋mail 零权威入存废判定＋ledger.read
    范围）、13（权限面验收候选）；`CONTEXT.md` 新增「权限分层」「能力
    （capability）」「零权威通道」词条。**frontier 由「06＋08＋09＋10」收为
    「07＋08＋09＋10」，首号＝07**（11 待 08、12 待 07、13 待 08）。
  - **裁定（round 1 八问）**：Q1 **权限四层**（L0 实例基底＝sandbox 权限模式
    用户域旋钮照旧／L1 文件面／L2 组织命令面／L3 人间面），复用底座**加严不
    另起**（否决岗位级文件 ACL 与「只给台账加 capability」）｜Q2 文件面两硬线
    （bot agent 直写＝自身 workspace；`~/.dsh` 全域与一切共享面**零直写**、读写
    经 host 命令；冻结面只读沿用）｜Q3 **邮件零权威**（内容永不构成权限/状态/
    事实依据、投递不设 capability、物理收口归 07/12）、台账零直写、knowledge
    登记权全员＋登记≠完成依据｜Q4 **op-set 岗位表**（值班统筹=收单分诊例程／
    项目经理=派单结算／承接岗=领取报告工件／复核帽=纯读／运维归人间面不设
    op）＋**签发权在 host、台账转移驱动**（bot 不能自请）＋短 TTL 心跳续签＋
    生命周期自动吊销 task 槽（binding.taskId 复用现 schema）｜Q5 复核只读面＝
    **op-set 否定式**（无 artifact.submit/状态写；自身 workspace 可写不触工件
    面）、与实例基底**正交叠加取严**、runProbe=evidence.probe｜Q6 命令**三元组
    鉴权**（实例活态 strictCheck 家族＋op 白名单＋任务域租约匹配）＋CAS（期望
    状态乐观并发）＋idempotencyKey＋fail closed 拒绝留台账事件＋连续越权上浮
    （数值用户域）｜Q7 既有边界归位（CSRF=人间面专用、岗位不持 user
    principal；实例注册表=capability 唯一绑定源；env 白名单不加岗位集；
    loopback token/typed RPC=实现轨道，规格只锁「组织命令经认证 host 通道」）｜
    Q8 岗位-权限解耦＋岗位卡不硬编码权限模式＋第 8 字段记权限依赖面。
  - **裁定（round 2 两问）**：Q9 `ledger.read` 四常设岗**全员**（台账=append-only
    组织事实，透明协调）、**复核帽无**（事件行 reason=产出方中间过程通道，
    「读不到即独立」机械成立）｜Q10 user principal＝**台账全权**（不经岗位
    op 表；审计同走台账事件 actor=user）。
  - **事实底稿（只读调查，2026-09-12）**：capability 原语全貌（HMAC envelope、
    9 op 白名单、nonce 单次消费＋30 天清理、实例五字段代际绑定全等＋pid 活、
    job 槽＋state 锁＋崩溃 reconcile、损坏 fail closed——`lib/review-capability.js`）；
    binding 严格 schema **已含 taskId**（复用不新造，F-RV-25）；关键缺口证据：
    **send_mail/knowledge_register＝bot 进程内工具直写共享数据面**（直写目标
    inbox／知识索引，`lib/index.js:2049-2152`、`lib/index.js:2180-2280`）——
    共享面无 writer ownership、无授权模型（GROK §7.2 点名），为 L2 收口依据。
  - **归位（引用不重审）**：04 已定 capability 保留为通用原语与复核者只读
    **权利**，本票定**机制与岗位封装**；05 已定台账单写者与命令面存在，本票
    定**鉴权**；user-decision 升格（04）与本票 user principal 全权（Q10）由
    09 收口衔接。
  - **验证**：`TMPDIR=/dev/shm npm run preflight` → ①回归 **56/56 ✅**、②冻结面
    （0008 包）**9/9 ✅**、③status-lint **0 违例（扫 35 个 md）✅**、
    preflight: PASS。
  - **授权依据**：用户 2026-09-12 /wayfinder 调用（未点名票，按 frontier 首号
    自动选取 06）＋round 1/round 2 两轮「无异议」逐项裁定＝按推荐方向执行。

- ✅ 本轮（AGENTS.md 技能纪律改写——移出落档条目＋去特例，2026-09-12
  用户指示＝授权）：
  - **变化**：原 §1 末段「技能流程优先（2026-09-08 用户裁定废除双席
    纪律）」整段移出落档条目，改写为新增 §5「技能——引用即显式调用，
    照文执行」：被引用或点名的技能（含技能内引用的技能）一律显式调用
    载入全文后按其步骤执行，不凭自己的理解替代或跳过；技能流程之外的
    额外评审由用户逐项点名。特例强调删除（/implement→/code-review
    例、双席废除史注），语义收束为一般纪律。
  - **验证**：AGENTS.md 不在 0008 冻结面 sourceManifest（9 文件均
    lib/scripts 代码面）——查证后编辑；纯纪律文本批，零代码零票面，
    README 文档地图无同步义务（AGENTS.md 不在 docs/ 表管辖）。
  - **授权依据**：用户 2026-09-12 指示（不特意强调特例；不应位于落档
    大条目下；对 agent 强调技能需显式调用、不能不读技能按理解进行）。

- ✅ 本轮（org-v2 wayfinder 逐票工作批——05 号票「协作协议与任务生命周期」决议，
  2026-09-11 用户 /wayfinder 调用＋round 1/2 逐项裁定「按推荐方向」＝授权）：
  - **票务**：`.scratch/org-v2/issues/05-protocol-lifecycle.md` claimed→resolved
    （`## Comments`＝前置事实＋研究依据回读；`## Answer`＝13 项裁定与归位表）；
    **新票 13**「v2 规格验收标准」（`Blocked by: 05, 08`）由雾区毕业；map
    Decisions-so-far 回写 05 一行、雾区收两条（自动派单引擎形态→Q4 已决；
    规格验收标准→毕业成票）＋其余四条更新阻塞面；**下游接线**：06（台账命令面
    最小权限＋复核只读面）、07（台账/复核工具化＋简报装载）、09（waiting-user
    挂起＋通知事件面）、10（关闭归档与知识晋升）、11（台账命令面入依赖清单）、
    12（台账与 mail 分工＋不得削 at-least-once＋幂等＋TK- 前缀）；`CONTEXT.md`
    新增「任务台账」「四要素简报」「值守例程」词条＋「复核点」补边界事件位置。
    **frontier 由「05＋06＋08」扩为「06＋08＋09＋10」，首号＝06**（09/10 解 05
    阻塞转可执行；07 待 06、11 待 08、12 待 06~07、13 待 08）。
  - **裁定（round 1 七问）**：Q1 任务＝**一等台账对象**（host 侧 append-only、
    单一写者、状态为事件投影；taskId＝provenance 根；mail 退为投递通道）｜Q2
    来源三分（用户目标/外部事件/常态触发）＋**同一对象分 duty|project**、确定性
    规则表优先、triage 四值 `routine-direct|project|clarify|reject`、立项归
    project-lead｜Q3 **显式最小 FSM**（只留有义务的节点）、LLM 只发命令不改状态｜
    Q4 归属＝台账持有 owner+lease，**显式接单**、逾期自动回收、可 decline 须归因、
    一实例一任务机械拒绝（T/N 数值属用户域）｜Q5 **复核点＝边界事件**（不可逆写入
    前／对外可见前／跨实例关键移交前；不在结算处另设）＋必审清单枚举＋加审权归
    project-lead｜Q6 结算归 project-lead/值班统筹、关闭三前置、**不可重开**、取消
    权用户｜Q7 异常四类统一走台账、**不静默丢失**、waiting-user 不占租约不烧 token。
  - **裁定（round 2 七问）**：Q8 四要素简报字段表＋五不变量（acceptance 必须可
    执行、裸主观＝判据缺口；派出即冻结、amend 追加）｜Q9 状态主干十态＋四旁路、
    转移＝append-only 事件、`TK-` 前缀避开评审面 `T-`/`J-`｜Q9b 台账＝host 单写者、
    mail 退投递层、重启从台账重建、投递层须 at-least-once＋幂等｜Q10 通知＝台账事件
    投影（到用户/派单方/承接岗三面）｜Q11 例程声明式登记＋routineId+window 幂等｜
    Q12 复核点机械落点（清单载体、空闲＝无租约、确定性选帽、gaps 回填挡 delivered）｜
    Q13 雾区毕业建票 13。
  - **事实底稿（只读调查，2026-09-11）**：现行普通协作面**无任务对象**（完整路由表
    `lib/index.js:83-105`；`appendMessage` 字段集 `lib/mail-plane.js:79-105` 无
    to/role/assignee/status/deadline；唯一机器可读产出标记＝responses 的
    `replied|error-replied`）；投递层已有 durable receipt／逐消息响应标记／回复
    幂等／`.seq.lock`（`mail-plane.js:222-365`），但 **backlog>100 静默截断**
    （`index.js:2504-2517`）与**回合失败不重试**（`index.js:2011-2044`）为已证缺口；
    评审面工作项 id 与 job 状态机在册（`review-intake.js:20-26`、
    `review-jobs.js:91-101`）但与普通面不连通。
  - **归位（引用不重审）**：04 已定评审形式与权利，本票只定位置与顺序（04 Q8 边界）；
    复核/证据/权限/工具原语的归位沿用 04 Q7 表。
  - **验证**：`TMPDIR=/dev/shm npm run preflight` → ①回归 **56/56 ✅**、②冻结面
    （0008 包）**9/9 ✅**、③status-lint **0 违例（扫 35 个 md）✅**、preflight: PASS。
  - **研究依赖标注**：四要素/D1–D10 与 MAST 可预防性出自 01/02 号**暂定稿**（网络
    受限）→ 按 04 口径标**待补充轮复核**；MAST 全表式为报告外来源（论文 v3 附录 A），
    仅作映射参考，不入事实断言。

- ✅ 本轮（org-v2 wayfinder 逐票工作批——04 号票「评审的存在形式」决议，2026-09-10
  用户 /wayfinder 调用＋round 1 八问逐项裁定＝授权）：
  - **票务**：`.scratch/org-v2/issues/04-review-form.md` claimed→resolved
    （`## Comments`＝round 1 八问＋前置事实坐标；`## Answer`＝裁定全文与归位表）；
    map Decisions-so-far 回写一行；雾区微调（岗位卡↔提示层项注明双审注入段已判
    废弃；最小起步编制改「等 05~07」）；**下游票接线**：05（复核点位置与顺序）、
    06（capability 归位＋复核者只读面）、07（runProbe 共同底座＋提示装载面）、
    09（user-decision 升格人间终裁原语）、12（13 stage/capability/store 三项
    「引用不重审」）；`CONTEXT.md` 更新「独立复核」＋新增「复核点」词条。
    **frontier 由「04＋05＋06＋08」收为「05＋06＋08」，首号＝05**（07 待 06／
    09 待 05／10 待 05／11 待 08／12 待 04~07 中余 05~07 仍阻塞）。
  - **裁定八问**：Q1 触发权＝**双轨**（不可逆／对外可见／跨实例关键产出三类客观
    判据命中即强制复核，可加审不可免审；清单外走产出岗自证的可执行检查）｜
    Q2 处置权＝**分级**（必审产出阻断性、gaps 未闭合不得交付；其余咨询性）＋
    一次性修复回合、连续两轮未闭合**上浮用户终裁**｜Q3 判据＝派单方在四要素简报
    **预登记且须可执行**，复核者只对照＋报判据缺口、可自跑可执行检查（runProbe）
    但**只读**（不得改工件／放宽判据／改口径）｜Q4 独立＝**读不到产出方推理轨迹**
    与中间过程（fresh context 硬要求；模型同异留用户域，但报告须记模型身份以度量
    趋同率）｜Q5 复核者＝**契约帽子**（任意当次空闲实例佩戴，同一任务内产出方
    不得自任，不设 verifier 专席位、不新起常驻编制）｜Q6 旧流程件**形态废弃**
    （13 stage 与 stage 机／双席席位／提示层双审注入／enforcement 矩阵／试水轮
    待触发项／R-2026-007；代码层与冻结表处置归 12）｜Q7 可复用原语**保留并归位**
    （review store 保数据；capability→06；user-decision→09；runProbe→07）｜
    Q8 边界（04 形式与权利／05 位置与顺序／09 投递）。
  - **事实底稿（只读调查）**：现役评审流程对系统其余部分**零约束力**（无外部
    gate；权威动作＝用户裁决，repair 仅在用户 `authorize-repair` 后启动，
    `lib/review-http-api.js:96-110`）；13 stage 转换权威在确定性 host 代码
    （`lib/review-protocol.js:7-21`／`PLAN-expanded-engineering.md:170-260`）；
    双席／提示层双审注入／enforcement 矩阵**全在册**（`lib/index.js:2394-2416`、
    `lib/review-enforcement.js:56-59` 全 pending），2026-09-08 废的仅是纪律。
  - **验证**：`TMPDIR=/dev/shm npm run preflight` → **①回归 56/56 ✅、②冻结面
    （0008 包）9/9 ✅、③status-lint 0 违例（扫 34 个 md）✅、preflight: PASS**。
  - **研究依赖标注**：触发权与阻断力的研究性依据（MAST「任务验证缺失」为主要
    可预防失败类别）出自 01 号报告**暂定稿** → 该点标注**待补充轮复核**。

- ✅ 本轮（回归修复批——locale-runtime 测试桩适配宿主提供方迁移，2026-09-10
  用户「修复」指令＝授权）：
  - **范围**：`tests/locale-runtime.test.mjs` 单文件（loader 桩层＋文件头注释），
    产品代码零改动。
  - **缺陷**：宿主安装件更新后，官方 `@deepseek-ai/dsh-client-locale`
    （0.1.5-rc.1；`lib/client.js` mtime 2026-09-10 18:49:10）factory 改从
    `require("@deepseek-ai/dsh-client-store")` 取 `defineStore`（原提供方
    `@deepseek-ai/dsh-client-runtime/client`）→ 测试桩白名单未含新 id，官方
    bundle 实例化即抛 `unexpected official require` 并使整个文件中断：回归
    55/56。
  - **修复**：桩同时接受两个提供方 id（同形 `({init, actions}) => 存储句柄`），
    未知 id 保持响亮失败；文件头补宿主版本兼容注释与观测时点，防后续被当
    死代码清理。
  - **归因边界（重要）**：**产品运行面未受影响**——`@deepseek-ai/dsh-client-store`
    是浏览器 boot 图的**种子模块**：证据＝`dsh-web-frontend/dist/assets/
    index-DuF6ti6g.js` 种子表 `"@deepseek-ai/dsh-client-store":H9`（与
    `react/jsx-runtime`／`@deepseek-ai/cordis`／`@deepseek-ai/dsh-client-ui-slots`
    并列），且多份官方 client bundle（model-selection／message-feedback／
    workflow-run）以同 id 取值；断的只是 Node 侧测试桩。
  - **验证**：单文件 4/4 断言 ✅；全量 `TMPDIR=/dev/shm npm run preflight`
    → **①回归 56/56 ✅、②冻结面（0008 包）9/9 ✅、③status-lint 0 违例
    （扫 34 个 md）✅、preflight: PASS**。
  - **授权依据**：用户 2026-09-10「修复」（承接同日前一批 03 号票批前门
    ①回归红与 11 号票 `## Comments` 现场证据条目）。

- ✅ 本轮（org-v2 wayfinder 逐票工作批——03 号票「岗位集与分工结构」决议，
  2026-09-10 用户 /wayfinder 调用＋两轮 grilling 逐项裁定＝授权）：
  - **票务**：`.scratch/org-v2/issues/03-role-set.md` claimed→resolved
    （`## Comments`＝裁定与事实底稿要点；`## Answer`＝岗位集契约全文）；
    map Decisions-so-far 回写一行；雾区毕业与新增（见下）；**frontier 由
    「03＋08」扩为「04＋05＋06＋08」**——03 总闸一解，04（评审存在形式）／
    05（协议与生命周期）／06（权限模型）同时解锁，frontier 首号＝04；
    07（待 06）／09（待 05）／10（待 05）／11（待 08）／12（待 04~07）仍阻塞。
  - **Round 1 裁定**（结构六问）：Q1 角色类别论（岗位＝职能契约单位，实例
    按需、bot 为载体，一实例一 home 岗位可被项目线借用）｜Q2 值守分流
    （机械动作归确定性组件、判断上浮须可归因）｜Q3 双线并存（常驻值班统筹
    ＋目标态项目经理，两顶帽子显式区分）｜Q4 单入口收单＋结论直通｜Q5 评审
    不成岗（验证＝每岗义务、独立复核＝按需 fresh-context 实例）｜Q6 按推荐
    （拆并判据＋岗位卡字段含放大机制必填、不设常驻岗数数字红线）。
  - **Round 2 裁定**：Q1 岗位清单按推荐＝值班统筹 `duty-coordinator`／项目
    经理 `project-lead`／研究员 `researcher`／实施者 `implementer`＋按需
    复核者 `verifier`（第 5 类角色类别、不入常驻编制）；Q2 现役四席**无保留
    义务、直接重建**（lead/研究员/双审席不构成编制基线；提示层
    lib/index.js:2394-2416 与 13 stage 协议随重建收口，协议存废归 04/05；
    lead 条目不可删除 lib/index.js:1064 属宿主实现约束、须在重建时处置）；
    Q3(c) 宿主面约束落 Notes＋岗位卡第 8 字段＋专票 11；Q4(b) 前端「原生
    像素级统一」降级为「原生一致优先、功能可用兜底」；Q5 按推荐（英文 slug
    为契约主键、组织不变量入票）。
  - **产物**：map Notes 新增「宿主面更迭声明」常设裁定（用户本轮追加约束）；
    map 修正「本仓库非 git」失真（本地 git 仓 2026-09-08 12:37 先于建图
    15:08 建立，该陈述自始与事实不符；2026-09-10 按方法论 #6 文档真实性
    镜像修正）＋map 首行 `Status: charted` 触发 status-lint 违例（本批首跑
    抓出），改记 `Charted:` 使词表合规；map 雾区「迁移与并存策略」毕业为
    12 号票、新增两条雾区（岗位卡↔提示层同步机制、最小起步编制与
    bootstrap）；CONTEXT.md ＋5 词条（岗位/岗位实例、值守线/项目线、判断
    上浮、独立复核、岗位卡八字段）。
  - **新票**（create-then-wire）：11「宿主/插件面更迭的隔离与升级」
    （Blocked by: 03, 08）、12「v2 重建的迁移与并存策略」（Blocked by:
    03, 04, 05, 06, 07）。
  - **事实底稿（只读调查×2，未写盘）**：① 01/02 research 结论压缩——含编号
    纠偏（D3 移交契约／D4 并行条件／D9 升级例程；「最小充分指令·做减法」
    在 D9）与新发现内部冲突（MAST 样本量 org-patterns §3 记 1600+ 轨迹 vs
    enduring-principles §3.2 记 150 条，待复核）；② 现役四席与协作接口
    盘点——今天无任何常驻值守岗位（分诊/验收初审/知识维护/调度检索零命中）、
    实施面成员空缺（PLAN:84「编码方实例：未创建」）、「双席废除」仅废纪律
    （席位、13 stage 协议与 capability 机制原样在册）、提示层仍按双审试点
    口径注入、reviewer-lead 真实权限 danger-full-access 与登记 read-only
    漂移（W-RV-1 用户归因）。
  - **验证**：纯文档批（`.scratch/org-v2/`＋`CONTEXT.md`＋本条目）；代码与
    冻结面零改动；真实运行面（`~/.dsh`）零读写。批前门
    `TMPDIR=/dev/shm npm run preflight` 两次运行（2026-09-10 20:5x CST）：
    **①回归 55/56 ❌**——唯一失败件 `tests/locale-runtime.test.mjs`
    （宿主 `dsh-client-locale` 安装件 2026-09-10 18:49:10 被改写后新增
    `require("@deepseek-ai/dsh-client-store")`，测试桩白名单未含该 id，
    且该包在宿主 `node_modules/@deepseek-ai/` 下不存在；本批无 `lib/`、
    `tests/` 改动，失败**先于且独立于**本批；产品运行面影响**未验证、
    不声称**）；**②冻结面（0008 包）9/9 ✅**；**③status-lint 0 违例
    （扫 34 个 md）✅**——首跑抓出 `org-v2/map.md` 首行 `Status: charted`
    不在词表（建图会话遗留，早于本批），本批改记 `Charted:` 使词表合规。
    总判 **FAIL＝①一条**，归因与处置记入 11 号票 `## Comments`——
    **本批不宣称全绿**。
  - **授权依据**：用户 2026-09-10 /wayfinder 调用；本轮两轮逐项裁定原文
    （Round 1：q1 b／q2 c／q3 c／q4 c／q5 b／q6 按推荐；Round 2：q1 按推荐／
    q2「从我角度来看完全无所谓没有留的必要，直接重建」／q3 c／q4 b／q5 按
    推荐）＋追加约束（DSH 持续更新：插件兼容会被更新代换、前端与 DSH 统一
    会不断出问题）。

- ✅ 本轮（org-v2 wayfinder 建图批，2026-09-08 用户 /wayfinder 授权＋三轮
  grilling 裁定 Q1~Q9）：
  - **建图**：`.scratch/org-v2/`——map.md（Labels: wayfinder:map）＋10 张
    子票（01/02 research、03~10 grilling；blocking 已编：03 待 01/02，
    04~07/10 待 03 及下游，08 待 02，09 待 05）。destination＝《团队组织
    形式 v2》规格（岗位集/协作协议与任务生命周期/人间接口/权限/工具
    MCP-skill/模型指派配置面/组织恒久性判据），完成后交 /to-spec→
    /to-tickets→/implement；既有基建＝参照非底座（Q8 裁定②可推倒）；
    阶段 3/4 基建债 out of scope（Q2 裁定①）。
  - **CONTEXT.md ＋2 词条**：组织形式（organizational form）、模型指派
    （model assignment）——Q3/Q4 定形当场落表。
  - **research 子代理×2 后台在飞**：01 组织模式谱系＋成本结构→
    research/org-patterns.md、02 恒久原则→research/enduring-principles.md
    （本仓库非 git，上游 throwaway branch 约定本地化为 .scratch/org-v2/
    research/）；各自按 tracker 约定认领/resolve 票据，map Decisions-so-far
    由本协调会话在完成通知后补行。
  - **验证**：纯文档批（.scratch/org-v2/＋CONTEXT.md＋本条目）；代码与
    冻结面零改动；.scratch/ 既有他 session 工单未触碰。
  - **授权依据**：用户 2026-09-08 /wayfinder 调用原文＋Q1~Q9 逐项裁定
    （Q1①规格终点、Q2①范围、Q5③岗位不预设、Q6①②③按推荐、Q7③双形态、
    Q8②可推倒、Q9③混合人间接口）。
  - **同日追加（用户补述价值面＝授权）**：「组织形式＝能力放大器」——
    全低配组合也应完成裸低配模型完不成的任务。落四处：CONTEXT.md
    「组织形式」词条升格（能力放大器而非仅成本分摊器）、map Notes 常设
    裁定（各票设计须问「放大能力还是只摊成本」）、map 雾区验收行（候选
    含全低配压力测试）、08 号票问句（能力放大的验证设计：基准/对照/
    机制归因）。
  - **同日追加二（用户网络环境声明＝授权）**：外网多站可能不可达——本
    轮 research 产物降为**暂定稿非终稿**（报告含盲区清单、模型补位须标
    「未经一手来源核验」、grilling 研究性裁定标「待补充轮复核」）；已在
    飞子代理×2 已捎话调整；map Notes 常设裁定＋雾区「补充调研轮」条目
    落位（触发＝用户声明网络可用）。
  - **同日追加三（02 号票回流）**：恒久原则 research 完成 resolve（暂定
    稿：判据 D1–D10＋反例 R1–R10＋8 盲区，21 来源多数一手核验）；map
    Decisions-so-far 首行已补；**08 号票（组织恒久性判据）随之解锁入
    frontier**；01 号（组织模式谱系）仍在飞，03 仍阻塞。
  - **同日追加四（01 号票回流，研究票全清）**：组织模式 research 完成
    resolve（暂定稿：七式模式菜单＋MAST 失败分类学＋dsh-bots 双形态→
    矩阵组织初判，20 一手来源＋8 盲区）；map Decisions-so-far 第二行已
    补；**03 号票（岗位集与分工，总闸）解锁**——frontier 现为 03＋08
    两张 grilling 票，图进入逐票工作模式。

- ✅ 本轮（批前门自动化与评审固定点基建——retro 改进第一批 batch-preflight，
  2026-09-08 用户经 AskUserQuestion 逐项裁定 C1~C5 全获选并定方向＝授权）：
  - **范围**：
    - **git init 本地评审仓**（C2）：main 分支、无 remote、.gitignore 最小
      集（node_modules/.DS_Store）、全树基线 commit `ba1856d`（259 文件）；
      此后每批收尾一 commit，/code-review 固定点＝对基线 diff，**废除手工
      /tmp 批前快照**（tmpfs 清空吞件前科，本文件 135/171/1273 行沿先例
      终结）。
    - **`npm run preflight` 一键批前门**（C1＋C5，scripts/preflight.mjs）：
      ①全量回归（自设 TMPDIR=/dev/shm）；②冻结面复验——动态取
      artifacts/packages/ **最新序号包** `executionEvidence.provenance.
      sourceManifest` 逐文件 sha256＋byteLength 只读复验（0009+ 自动跟随）；
      ③status-lint——扫 .scratch 全部 `Status:` 行对词表（五排程词＋
      resolved）校验，claimed 仅限 wayfinder 票（effort 根有 map.md），
      b5-sse-replay（done）/arch-client-fetch-exports（implemented）两
      历史异词显式豁免不回改；单一 pass/fail、输出固定格式可直引条目。
    - **tests/run.mjs EROFS 定向提示**（C4）：启动探测 tmpdir 不可写即打
      一行指向 `TMPDIR=/dev/shm npm test`（照常失败不自动回退）；
      tmpdirHint 导出＋入口守护（防测试 import 递归）。
    - **README §2 删全部手工计数**（C3）：「19 个 md 全集」「根目录（7）」
      「docs/（11）」「docs/agents/（3，…）」「docs/history/（4，…）」
      共 5 处，目录列表为唯一事实源（F-RV-27 类漂移源清零）。
    - **伴生修正**：arch-bot-mail-agent/issues/01 `Status: claimed→
      ready-for-human`（preflight 首跑即抓出的词表违例——非 wayfinder
      票不得 claimed；grilling＝human 侧语义贴切）。
    - **/code-review 两轴返修**（固定点=基线 ba1856d，并行子代理）：
      claimed 判定由「有 Type: 行」代理改为 map.md 结构判定（`Type: task`
      亦放行的失真）；Status 正则补列表形态（`- `/`> `）；shmWritable
      与 tmpdirHint 重复形状合并（preflight 复用后者）；死旗标删除。
  - **验证**：`npm run preflight` PASS（回归 56/56、冻结面 0008 包 9/9、
    status-lint 0 违例扫 19 md，exit 0）；tests/preflight.test.mjs 7 个
    test 块＋tests/run-erofs-hint.test.mjs 3 用例全绿（fixture 全隔离）。
  - **冻结面**：9/9 零触碰（preflight ②只读复验口径）；证据包链零写入。
  - **README §2 地图同步**：md 零增删（scripts/tests 新增件非 md、
    .scratch 非地图成员）；§2 计数 5 处删除已含在本批范围。
  - **工单**：.scratch/batch-preflight/（spec＋4 票，全 resolved）。

- ✅ 本轮（动图 GIF 转换——WebM→GIF 批，2026-09-08 用户「能转换成
  gif的格式吗」＝授权）：
  - **范围**：新增 docs/dsh-bots-architecture.trace.gif（1,913,015 B，
    sha256 `3498aaa8…`）——由 09-08 trace.webm 转换：Chrome（DevTools
    管道，--allow-file-access-from-files）逐帧 seek 解码取 72 帧 →
    纯 JS 编码器 gifenc（npm 临时装于 /tmp/gifwork，页面内 blob
    import，全局 256 色调板 rgb444）→ 800×448 @12.5fps 无限循环。
  - **验证（结构级，容器逐块走查）**：GIF89a 魔数、逻辑屏 800×448、
    72 帧、NETSCAPE2.0 循环标志＝0（无限）、逐帧 80ms、trailer 完整；
    过程中两轮验证器自 bug（delay 单位按 ms 误读、应用标识切片少一
    位致 NETSCAPE 漏检）已修正后复跑通过——GIF 本体自始正确。
  - **冻结面**：trace.json/.html/.webm 与原冻结件零改动；GIF 为沟通
    资产派生件，不作验证声明。
  - **README §2 地图同步**：docs/ 表 10→11（＋trace.gif）。

- ✅ 本轮（架构图数据传输动效导出——trace 变体＋WebM，2026-09-08 用户
  「帮我导出一张数据传输的动图」＝授权）：
  - **范围**：新增 docs/dsh-bots-architecture.trace.json（冻结规格复制，
    仅＋`meta.animation: "trace"`、output 改名）→ 交付
    docs/dsh-bots-architecture.trace.html；经 Chrome DevTools 管道调
    页面自带 `Archify.motion.recordWebm()` 录制 6 秒 30fps VP9 →
    docs/dsh-bots-architecture.trace.webm（452,012 B，sha256
    `401c9070…`；内容＝信号沿 10 条关系线的传输动画）。
  - **验收链**：validate 9 检查全过零警告；deliver spec `94fdc247…`
    （6,809 B）→ artifact `b89c7c12…`（718,582 B）；visual-check
    pass（trace 工件四视口 containment）。**动图内容验证**＝Chrome
    解码取帧三时点（0.2s/2.0s/4.5s）像素哈希互异＋帧尺寸 1280×716
    与 viewBox 1360×760 按 1280 上限缩放吻合——「动画在动」的机械
    证明；感知级目检未做（视频输入未向评审席回放帧）。
  - **冻结面**：原 dsh-bots-architecture.json/.html（`face1ba4…`/
    `afc4ebc1…`）零改动——trace 为新版本旁路件，不覆盖冻结原件。
  - **过程事实**：会话浏览器后端不可用（browsers.list() 空）→ 改
    零依赖 Node＋Chrome DevTools 管道直连（临时 /tmp profile，不触
    真实 Chrome 配置）；过渡用回环 HTTP 服务（:8791）已停。GIF 转换
    未做：环境无 ffmpeg/ImageMagick，WebM 即交付件原生动效格式。
  - **README §2 地图同步**：docs/ 表 7→10（＋trace.json/.html/.webm）。

- ✅ 本轮（总体架构图首版——archify showcase 交付，2026-09-08 用户
  `/archify` 选主题「dsh-bots 总体架构」）：
  - **新增 docs/dsh-bots-architecture.json（规格源）＋.html（交付件）**：
    9 节点/2 边界/10 边——主链路 用户→dsh web 宿主→宿主集成层 index.js
    →进程监督→bot 子进程×4；模块按域聚组（评审面 review-* 17 模块〔含
    证据链冻结面 tag〕／邮局面·会话回合 mail-plane+seq-lock+session-driver
    ／边界模块 spawn-env·fs-hygiene·pid-bind〔api-security 入卡片〕）；
    边界＝region「dsh-bots 插件（lib/）」＋security-group「真实运行面」；
    4 个 guided views＋3 张结论卡。
  - **验收链（archify 纪律）**：validate 9 检查全过零警告（含
    desktop-readability）；deliver 冻结快照 spec sha256 `face1ba4…`
    （6,777 B）→ artifact `afc4ebc1…`（717,856 B）；visual-check 浏览器
    证据 pass（1440×900/1600×1000/1920×1080 视口无溢出）。**感知级视觉
    复核未做**（自动化证据≠人工目检，用户可开 HTML 复核）。
  - **过程修正（均在技能诊断环内）**：①guard→supervisor 边结构性删除
    （左走廊必穿 host→integration 水平带——按「先删低价值边」纪律，
    B4 语义由 tag/卡片/视图承载）；②driver/evidence 并入邻近节点控
    节点数；③desktop-readability 两轮（缩短 guard 文案＋viewBox
    1440→1360 提缩放）；④首版 HTML 纵向溢出 1440×900 → 卡片 4×3 砍到
    3×2＋Y 轴压缩 820→760 后复检通过。
  - **README §2 地图同步**：docs/ 表 5→7。快照性质：代码演进后重出新
    版本，不在线维护。

- ✅ 本轮（triage 词表收编——`resolved` 终态收编批，2026-09-08 用户裁定
  「收编」＝授权）：
  - **范围**：docs/agents/triage-labels.md 增补「Terminal states（本仓库
    本地扩展）」节——`resolved`＝终态-成功收编（实现票凭据义务＝
    Comments 证据＋CHANGELOG 条目；wayfinder 票沿用 `## Answer`＋map
    回写；`claimed` 限定 wayfinder 专属；spec `Status:` 同表，历史件
    `done`／`implemented` 为已观测同义词按 resolved 解读、不回改；
    本地扩展注记防 setup 重跑覆写）；docs/agents/issue-tracker.md
    Conventions 增一条完成态约定指向该节。
  - **起因**：五词表为排程词表（球在谁的场上）无终态-成功位，完成票
    被迫表外自造词——普查 9 票：7 张完成票已事实归一 `resolved` 零
    例外，spec 面则分裂 resolved×4/done×1/implemented×1；09-08 两批
    /code-review（部署同步批、收口批）先后报「表外用词」，逐批重复
    裁定。收编语义非新造——wayfinder 机制既有文档（issue-tracker.md
    Wayfinding 段）。
  - **影响面核清**：Status 无任何工具解析（无 git/CI、无 bot 读
    .scratch），消费者为后续会话路由与评审流程，纯解释性。
  - **验证**：纯文档批（两件＋本条目）；代码、冻结面、.scratch/ 票面
    零改动（历史件 done/implemented 不回改）；无新增/移动文档，README
    §2 地图无同步义务。
  - **授权依据**：用户 2026-09-08「收编」（先问询「为什么要收编以及
    收编会造成什么影响」，获影响面说明后裁定）。

- ✅ 本轮（部署批整批收口——重启链＋live smoke，2026-09-08 用户经
  AskUserQuestion 点名「重启链＋live smoke，整批收口」＝授权；选项含
  仅重启链／暂不执行，未选）：
  - **范围**：生产面行为收口（零仓内代码改动）——host 拉起＋在线 bot
    自启动跟随＋重启后核对＋经 lead 真实邮件 live smoke＋instances 归因；
    仓内产物＝报告 `artifacts/deploy-b3-sd-report-2026-09-08.json`（wx
    独占写，沿 b1/b2 格式）＋PLAN §十一 B3/B4/B5/结构债 四行「部署待
    点名」注记收口＋工单 `.scratch/deploy-b3-session-driver/` 勾选/
    Comment/spec 状态 resolved＋本条目。
  - **前置门（当次重跑）**：全量回归 54/54（`node tests/run.mjs`）＋
    冻结面 9/9 sha 一致（0008 sourceManifest 逐文件复验）。
  - **重启链**：发现 host 离线（09-07 08:11 后未拉起、本日 08:09 宿主机
    重启零进程残留）——实际执行＝拉起 `dsh web --host 127.0.0.1 --port
    3080 --no-open`（pid 11739，沿 restart-split.sh 惯例）；DSH_BOTS_
    ENV_EXTRA 未设＝无需（宿主无代理变量，steam-proxy 仅包裹 gh CLI；
    LLM 端点直连可达，未鉴权探测 401）；4/4 bot 自启动跟随（pids
    11765/11791/11819/11845，~1.5s 错峰，零手动 start）。
  - **重启后核对**：CSRF 面 200（token 43 字符）；supervisor 零自愈事件
    （instances.jsonl 全程 124 行不增，符合「不向真实面注入故障」边界，
    B2 生产实证仍在案）；**B4 行为随首次重启生产实证**——bots.json
    644→0600、profiles/lead 755→0700、目标 workspace 首触收紧 0700、
    4 bot pidStartTicks 全部落。instances 119→124 逐条归因＝1 host
    （本批授权）＋4 自启动跟随（预期），零 `dsh web` 手动行、零意外行。
  - **live smoke（Q7 口径全链）**：POST /api/bots/lead/send（CSRF 头，
    from=user）→ lead seq15（01:25:04Z）→ lead 复用 08-26 持久会话
    session-a992f19d 跨重启续上下文（session-driver 持久政策 adapter）
    → send_mail → 研究员 inbox seq1（01:25:37Z）→ 消费 receipt
    {seq:1, processed} 落盘＋responses finalized 恰 1 条＋游标水位推进
    → 回合经 session-driver 执行（新会话 session-6e96376b 建会话即
    落盘＋转录目录新建）→ 回信写 outbox（01:25:45.728Z）并送达 lead
    inbox（seq17 自动回信 replyTo=1 恰一次；研究员另发 seq16 显式
    send_mail＝独立 agent 动作非重复回信）→ 无重复：同触发消息恰 1
    responses 标记＋恰 1 封自动回信；防环守卫生效（seq16 触发 lead
    回信→研究员 seq2 mail-response 后两跳有界收敛）。观测注记：web
    profile host info 级日志不落盘——本批向 stdout 仅追加启动横幅一行
    （字节记账：web-split-server.log 批前 4294 B／mtime 08-26 12:51 →
    批后 4325 B，增量恰 31 B＝横幅行；档案内 EADDRINUSE 崩溃栈系批前
    旧痕非本次产生）；沿 b1/b2 以 API＋文件面工件为证据口径。
  - **验证结果**：前置门两道（回归 54/54、冻结面 9/9）＋重启后核对
    三项＋smoke 全链工件（receipt/responses/outbox/session 落盘）＋
    instances 归因 5/5，全部通过；冻结面 9/9 零触碰（无需 0009）。
  - **评审收尾**：/implement 规定收尾 /code-review 已按技能流程执行
    （两轴并行子代理；无 git 仓库沿先例，固定点＝批前快照
    /tmp/deploy-b3-sd-closure-pre/ 四文件＋新增报告 json）。Standards
    轴：落档四要素/收口对口/冻结面零触碰/Comments 追加式均合规；一条
    字面违规判定为既成惯例不回改——工单/spec Status 用「resolved」
    不在 triage-labels 五词表，但 b4/b5/受信链/client-fetch 四先例票
    同用（词表漂移既成，是否收编扩展词表/落 ADR 留用户裁定）；两条
    判断性 smell 压下不判改（五处事实复述沿 b1/b2 先例＝报告 json 为
    准、其余指针；「(改)/(新)」后缀沿 b1/b2 报告格式）；一处微瑕已修
    （PLAN B5 行粗体闭合括号错位）。Spec 轴：真实面抽查逐项吻合
    （sha/instances 时序/seq 与幂等标记/权限位/会话工件）；一条表述
    已澄清（「stdout 仅启动横幅」补字节记账防误读，见上）；「日志
    可见」以 session 落盘工件替代口径已在工单注记；PLAN 收口四行
    （工单要求 B3 行）＝同链部署的已注记扩张。
  - **授权依据**：用户 2026-09-08 AskUserQuestion 应答勾选「重启链＋
    live smoke，整批收口」。

- ✅ 本轮（部署批同步——B3＋session-driver 等 8 文件进部署面，2026-09-08
  用户经 AskUserQuestion 逐项点名「部署同步」＝授权；重启链与 live smoke
  未授权未执行）：
  - **范围**：`~/.dsh/plugins/dsh-bots/lib/` 8 文件同步（index.js／
    mail-plane.js／session-driver.js／review-job-tools.js／spawn-env.js／
    fs-hygiene.js／pid-bind.js／client.js）；仓内产物
    `artifacts/archive/deploy-pre-b3-sd-20260908/lib/`（3 旧件备份）＋
    工单 `.scratch/deploy-b3-session-driver/issues/01` 勾选与 Comment。
  - **前置门（当次重跑）**：全量回归 54/54（client-fetch 测试入套件后
    口径）；冻结面 9/9 sha 一致（0008 sourceManifest 逐文件复验）。
  - **执行与验证**：3 旧件（index.js/mail-plane.js/client.js）带权限备份，
    5 新模块记「新增」；同步后 repo↔deploy sha256 对账 8/8 IDENTICAL
    （index `2b02c2a1…`／mail-plane `3e5730c1…`／client `03351334…`），
    `node --check` 8/8，mode 沿部署面旧例（client.js 0600、其余 0644）。
    本次零重启零 spawn，instances.jsonl 无待归因新行；生产进程仍在旧代码
    （B2 时点）上运行，**新代码待重启链点名后生效**，行为验收（重启链
    核对＋live smoke）与报告 json／PLAN §十一 B3 行收口随整批收口。
  - **验证结果**：前置门两道（回归 54/54、冻结面 9/9）＋同步对账
    repo↔deploy 8/8 IDENTICAL＋`node --check` 8/8，全部通过。
  - **评审收尾**：/implement 规定收尾 /code-review 已按技能流程执行
    （两轴并行子代理，固定点＝/tmp 重建批前件；无 git 仓库沿 client-fetch
    批先例）。Standards 轴：备份保真、sha 对账、mode、冻结面零触碰、
    README §6.2 落档要件均复现属实；两条已修复（①工单 Status 用词
    「claimed」不在 triage-labels 五词表内——回退为「ready-for-agent」＋
    状态注记；②本条目「验证结果」原为「见上」弱自指——改为重述）。
    一条判断性不动（勾选框 1 门态口径 53/53→54/54 原地改写带引用可溯）。
    Spec 轴：干净——授权范围（仅「部署同步」）内无缺失、无超权写入
    （find 全 .dsh 当日新写面＝恰 8 个声明文件）、无错实现。
  - **授权依据**：用户 2026-09-08 AskUserQuestion 应答勾选「部署同步」
    （选项逐项列出部署同步／重启链／live smoke，仅前者被勾选）。

- ✅ 本轮（技能调用措辞全量排查修正批，2026-09-08 用户「检查所有指导性文件
  包括项目记忆，修正会造成技能声明调用被忽略的地方的措辞，避免在接收技能
  后的思考中自行忽略了技能中的显式描述」＝授权）：
  - **过程修正**：本会话初稿曾按上一条指令新增 AGENTS.md §5「指令性
    /name 必须显式调用」特例条款并落档；用户改裁为全量措辞修正而非特例
    声明，§5 已回退，纪律文件不再含该条款。
  - **排查面**：AGENTS.md／README／CONTEXT.md／docs/agents/ 三件／
    PROJECT_UNDERSTANDING／项目记忆（MEMORY.md＋review-seat、phase-state
    两文件）／.scratch/ 工单面。技能文件（~/.agents/skills/）按用户指令
    零触碰；问询（implement:9/13 两行弱措辞交叉引用，对照 wayfinder/tdd
    的机械式 "call the Skill tool with" 措辞）后用户裁定先搁置不动。
  - **修正 1 处＋核实 1 处**：①docs/agents/domain.md 词汇示例「门态」
    「留痕」「双席」——已废除纪律不应作为新产出（工单名/测试名）用词
    示例，「双席」换「落档」。②MEMORY.md 索引行会话初读时仍残留「本
    会话为主审席（第一评审）」（与已修订的 review-seat 本体矛盾，且该
    行每会话载入、会令后续会话以评审席身份顶掉技能规定流程）——排查
    中核实该行已随本体同步为废除口径，未再改动。
  - **核验不动项**：PU:92 与 README:91/109 双席记载＝演进梗概/已关闭状态
    行（历史 append-only 保留）；.scratch/ 内全部主审/副审/复核字样均在
    Comments/Evidence/Status 注记行（带日期历史记载，无面向后续会话的
    流程指令）；AGENTS.md §1「技能流程优先」＝正向措辞保留；
    issue-tracker/triage-labels/CONTEXT.md 无冲突措辞。
  - **验证**：纯文档批（仓外 MEMORY.md＋domain.md＋本条目），代码与冻结
    面零改动；修正后复扫 grep 无残留。
  - **授权依据**：用户 2026-09-08 上引原文＋「不要动技能文件，如果你觉得
    技能文件有问题先来问我」。

- ✅ 本轮（双席纪律废除＋技能流程优先——纪律修订批，2026-09-08 用户裁定
  「改一下，不要让双审覆盖调用/code review，甚至删掉双审也可以」＝授权）：
  - **AGENTS.md 修订**：§1 有效工作内容删去「双席（主审/副审）统一意见与
    复核结论」一项；§1 新增「技能流程优先（2026-09-08 用户裁定废除双席
    纪律）：技能规定的步骤（如 /implement 收尾的 /code-review）按技能指令
    直接执行，不得以双席/子代理复核替代或吸收；需要额外评审时由用户逐项
    点名」；「双席往来文本」措辞改「评审往来文本」。§2 证据纪律链删去
    「（双席复核）」可选步。README §2 两处活规则「修订须双席」改「重大
    修订须用户点名」（§2 地图表 PLAN 行＋§5 命名约定）；README §3 历史状态
    行（P9/R-3 记录）与 domain.md 词汇举例不动，CHANGELOG 历史条目
    append-only 不动。
  - **起因与补跑**：09-08 client-fetch 批实施时，主审以双席复核（副审子
    代理 A~G）替代了 /implement 技能规定的收尾 /code-review 步骤——本条
    裁定后该替代不再成立，并对该批**补跑正式 /code-review**（两轴并行子
    代理；无 git 适配：固定点＝批前重建件 /tmp/cf-fixed-point/
    lib-client.js，diff 校验恰为导出 5 行＋新测试文件全量）。结论：
    Standards 轴无硬违规（两条判断性 smell：测试引导序文跨三文件同形
    〔仓库先例认可，压下不判改〕、预热两行在测试内现 5 次〔可并入
    resetToken，未动〕；其「CHANGELOG 顶部缺本批条目」指控经核不实——
    条目在档，仅位置问题，见下）；Spec 轴无缺失、无错实现、一条良性超
    枚举（引导失败裸发用例属「全分支」字面所含，未触产品码）。
  - **CHANGELOG 排序修正**：client-fetch 批条目（09-08）此前落至「B4 残余
    项原地修复」（09-07，并行会话于本会话初读后写入）之下，违反「新条目
    在顶部」；已归位至其上。
  - **验证**：纯文档批（AGENTS.md/README/CHANGELOG），代码零改动；冻结面
    不在改动面；两轴报告全文经主审核读。
  - **授权依据**：用户 2026-09-08 上引裁定原文。

- ✅ 本轮（client fetch 层导出＋CSRF 客户端协议断言——架构候选 4 单票，2026-09-08
  用户 `/implement` 续 frontier，票 ready-for-agent 顺位）：
  - **导出面（lib/client.js 末段＋5 行）**：`api`/`apiText`/`refreshCsrfToken`
    挂上 bundle factory 导出面（`csrfToken` 本体是 let 状态不导出，经
    refreshCsrfToken 返回值观测）；不拆 bundle 文件——单文件 factory 是宿主
    加载 interface（spec 明文）。实现零改动，纯导出增补。
  - **测试（新 tests/client-fetch.test.mjs，8 用例）**：桩 globalThis.fetch
    逐调用记账（捕获型 loader 同 mail-notice 先例，全程内存桩、零 DOM 零
    文件系统），钉住 B1 客户端协议全分支——惰性引导（首变更请求前 GET
    /api/bots/_csrf，令牌只引导一次后续复用）／GET 与 apiText 文本端点不带
    令牌不引导／403 单次重试（重取到新令牌换令牌重发恰好一次，重试再 403
    即失败无第三发）／仅令牌变化才重发（同值或跨站置空均不重发，403 原样
    抛出）／引导失败裸发不重试（fail closed）。协议两半（服务端 13 断言＋
    客户端 0）自此补齐客户端半边。模块级 csrfToken 归零经导出面自身完成
    （200 无 token 字段 → 置 null），测试不窥内部状态。
  - **验证**：红测先行（导出面缺三函数先确认变红再转绿）；全量 54/54×2
    （入口 `node tests/run.mjs`；53＋新文件）；冻结面 9/9 零漂移（0008
    sourceManifest 逐一 sha256＋byteLength）；node --check 通过；真实运行面
    零写入。**边界（测试用例两处修正，实现零改动）**：①桩 Response 的
    text() 初版对对象体原样返回，GET 路径 `text()+JSON.parse` 即炸——改
    统一 JSON.stringify（两读法一致）；②三处 403 用例预热初版误用 GET——
    GET 不引导令牌，令牌实未进缓存致脚本错位（其一恰好空转通过），改一律
    POST 变更请求预热。
  - **副审独立复核（2026-09-08）**：A~G 七项（票逐项/实现一致性/测试有效
    性防同义反复/改动面最小性/回归口径/纪律核验/spec 偏差）全通过，无必改
    项；推演核红确认删重试或删引导必有断言变红。
  - **连带落档**：票 `.scratch/arch-client-fetch-exports/issues/01` resolve＋
    勾选＋证据 Comments；父 spec Status 升 implemented；部署批 spec
    （deploy-b3-session-driver）Comments 追记——改动面仅 lib/client.js（已在
    8 文件清单内）＋新测试文件，**部署清单不变**；client.js 两面 sha 再分叉
    （仓库面新增导出），部署对账按当次重跑口径。
  - **授权依据**：用户 2026-09-08 `/implement`（无参，按记忆顺位取
    client-fetch ready-for-agent 票）；spec 来源 2026-09-07 架构评审报告
    候选 4（Strong），triage 已升 ready-for-agent。

- ✅ 本轮（B4 残余项原地修复——评审修复复核后的 P5/P6＋注释小项，2026-09-07
  用户「评估修补任务的复杂程度是否需要返回票据重新进行，如果无需则原地修复」＝
  授权。**路由评估：无需新票**——残余项全部为 B4 已关工单
  `.scratch/b4-spawn-env-hygiene/` 线程内的行为保持清理＋文档项，无新能力/
  新模块/新风险面，落档沿该工单 Comments；主审席执行，先例＝O-6 原地修复批）：
  - **clearProcessRecord 助手（P6）**：`delete pid/pidStartTicks/startedAt`
    三连原散布 8 处（reconcileStalePids/list/get/stop×3/stop 收尾/spawn exit），
    收敛为 index.js 模块级助手，8 处改调；**stop() 三分支收拢**——三条陈旧
    路径共用 `clearStale` 闭包（三联→落盘→`{online:false,stale:true}`），分支
    只留守卫与告警，warn 文案逐字不变（行为保持）。
  - **internals 补齐四导出（P5，选「补齐」而非修 spec 措辞）**：parseStartTicks/
    pidIsSameGeneration/tightenBotTree/tightenPath 入 internals——spec Testing
    Decisions「三领域同名导出」兑现；tests/pid-bind.test.mjs 与 fs-hygiene.
    test.mjs 的函数消费面统一切到 internals（三兄弟测试与 spawn-env.test.mjs
    同一模式），新导出即有消费者，不留 speculative 缝。
  - **ENV_EXTRA_VAR 死导出转模块私有**：全仓无消费者（测试以字面名锁定该
    对外运维合同——改名即红，故保留字面断言而非 import 常量）。
  - **注释修正（复核发现项）**：scaffoldProfileBuiltin 内两处注释漂移——
    「存量由 scaffoldBot 末尾收回」对 builtin 分支不成立（该分支早 return，
    收回实靠 builtin 自身末尾调用），按实际路径改写。
  - **CONTEXT.md ＋2 词条（P6 词汇表，domain.md 规则兑现）**：代际绑定
    （pid generation binding）／逃生阀（env allowlist escape hatch）。
  - **维持不动**：pidIsSameGeneration 命名（fail-open 语义 docblock 已载，
    改名＝纯 churn）。
  - **验证**：全量 53/53×2（node tests/run.mjs）；冻结面 9/9 零漂移
    （runs/24781c8f sourceManifest 逐一 sha256＋byteLength）；node --check
    五改动文件。**过程修正 1 枚**：internals 引用 parseStartTicks 漏加
    import，node --check 不辨运行期 ReferenceError、首轮 31/53 抓出，补
    导入后双绿（先 --check 后全量的分层验证顺序价值实证）。index.js
    3,592→3,588 行（净 −4）。


- ✅ 本轮（B4 评审修复 P1~P4——双席 code-review 发现项收口，2026-09-07 用户以
  handoff `/tmp/handoff-b4-review-fixes.md` 启动本修复会话＝授权实施 P1-P4）：
  - **P1（Spec a1，主修复）**：`scaffoldBot` 脚本成功路径从未收紧——
    `runScript` 成功返回后函数直接结束，主生产路径产物 profile/workspace
    停留默认 0755/0644（此前仅 builtin/ENOENT 两回退分支收紧）。修复＝成功
    路径补 `tightenBotTree`。CHANGELOG 前批「scaffoldBot 两出口调
    tightenBotTree」的失实陈述自此消解（实为三出口）。连带清理：builtin
    分支与 `scaffoldProfileBuiltin` 内部的重复收紧删一；`profileDirFor`/
    `workspaceDirFor` 表达式三现收敛为局部量。
  - **P3（Spec a3）**：`tightenPath` 同 mode 短路——Linux 同 mode chmod 仍推
    ctime，「幂等＝重复执行无副作用」此前在 ctime 面不成立；现比较 0o7777
    全位（setuid 等特殊位在位时不短路、仍由 chmod 归零），已达标即不
    chmod。测试补 mtime/ctime 不变断言（tightenPath 单测＋builtin 再
    scaffold＋script 路径第二遍，共三处）。
  - **P2（Spec a2）**：权限测试原用不存在的脚本路径强制 builtin 回退，掩盖
    P1。新增假 create-bot 脚本集成测试（仿 spawn-env 假 bin 先例：显式
    0755/0644 模拟默认 umask 落盘、已存在文件不重写），走真 spawn（经
    DSH_BOTS_CREATE_BOT_SCRIPT 注入缝）断言 script 路径收紧生效——spec
    Testing Decisions 明文要求。
  - **P4（Spec c1）**：`buildSpawnEnv` 的 overrides 原经 `Object.assign`
    末位叠加、绕过 ENV_NAME_DENY 形状检查；现 overrides 同受名称形状拒绝
    （只过滤名称、不查 source 存在性，undefined 值跳过以维持「无 undefined
    项」不变量），「一律不含 KEY/TOKEN/SECRET/PASSWORD 形态与 NODE_OPTIONS」
    覆盖全部三个来源。补测试（overrides 显式给值仍拒绝）。当前生产调用方
    只传 DSH_HOME/DSH_WEB_URL，无实际泄露，属预防性收紧。
  - **验证**：红测先行（P1/P3/P4 各自缺口先确认变红再转绿）；全量 53/53×2
    （入口 `node tests/run.mjs`）；冻结面 9/9 零漂移（0008 sourceManifest
    ＝runs/24781c8f raw.json，逐一 sha256＋byteLength）；node --check 三
    改动文件通过；真实运行面零写入（全部测试隔离 tmpdir/假脚本）。index.js
    3,589→3,592 行（模块数 34 不变）。**P5/P6 未动**（internals 导出补齐、
    重构与词汇表项），留用户逐项裁定。
  - **落档连带**：b4-spawn-env-hygiene spec Comments 追记修复记录；部署批
    spec（deploy-b3-session-driver）Comments 追记行为注记——部署清单 8 文件
    不变（index.js/fs-hygiene.js/spawn-env.js 均已在列），「scaffold 路径
    幂等收紧」注记口径自此含脚本成功路径。

- ✅ 本轮（B5 SSE 可重放——PLAN §十一 B5 全一票，2026-09-07 用户 `/implement`
  续 frontier，票 ready-for-agent 顺位）：
  - **hub（lib/index.js createSseHub）**：每次广播分配单调 eventId（帧前置
    `id: N` 行，seq 自 1 起）并记入有界窗口 ledger（新常量
    `SSE_LEDGER_LIMIT = 256`，超出淘汰最旧）；新增 `replayAfter(rawId)`——
    窗口内（最旧保留 id−1 ≤ lastId ≤ seq）返回按序错过事件列表（空数组＝
    无错过，无感接实时），非整数/`<1`/未来 id（服务重启序号重置场景）/淘汰
    断层返回 null＝调用方兜底；`formatEvent` 随 hub 导出。心跳注释帧不走
    广播，结构上不占序号。不做每客户端持久 ack；落盘/跨重启重放不在本批
    （spec cursor/ack 口径）。
  - **端点（sseEndpoint）**：读浏览器 EventSource 原生回传的 `last-event-id`
    头（客户端零协议改动）——null 判定发 `event: reload\ndata: {}\n\n`
    兜底（首连统一初始化路径），窗口内先按序补发再订阅接实时（补发与订阅
    间同步代码无广播间隙，不漏不重）。
  - **客户端（lib/client.js 最小接线）**：`es.addEventListener("reload",
    onBots)` 复用现有全量刷新函数（含成对 removeEventListener）。
  - **测试＋7 用例（tests/events.test.mjs 14/14）**：帧格式跨类型单调（mail
    帧仍同 chunk 可过滤，mail-notify 消费方回归不受影响）／首连 reload 兜底
    帧不带 id／断线补发先序后实时且序号衔接／无错过重连零帧零 reload／非法
    与未来 id 兜底／窗口上限（260 广播后 id=3 断层→reload 不补半窗、边界
    id=4＝起点−1 恰补 256 条不含已淘汰）／心跳帧直断（桩 setInterval 立即
    触发：原文 `: ping` 不带 id、以 head id 重连无补发无 reload＝序号未
    推进）。**全量 53/53×2；冻结面 9/9 零触碰**（0008 sourceManifest 逐一
    sha256＋byteLength）。
  - **边界（测试用例修正，实现零改动）**：窗口边界用例初版把 lastId=窗口
    起点−1 误判为断层——该点错过集恰为整窗应完整补发（实现
    `last < oldest - 1 → null` 正确），改断言 id=3 才是断层。
  - **副审独立复核（2026-09-07）**：A~G 七项（协议/时序/回归/内存/测试/
    改动面/spec 偏差）全通过，无必改项；非阻断建议两条——①心跳直接断言
    （已本批带走）；②首连 open＋reload 双 refreshBots 可优化（**留界**登记
    PROJECT_UNDERSTANDING「仍可选题」：本批保留 onOpen 基线拉取，兼容旧
    服务器无 reload 语义；触发＝建连流量实测成为问题时）。
  - **连带**：index.js 头部行数计数 3,552→3,589（模块数仍 34，上限 4,300
    余量 711）；改动面仅 lib/index.js／lib/client.js／tests/events.test.mjs
    三文件；票 `.scratch/b5-sse-replay/issues/01` resolve＋证据 Comments、
    spec Status→done、PLAN §十一 B5 行收口。**部署待点名**（建议与 B3/B4
    部署批同链，部署清单新增 lib/index.js＋lib/client.js）。

- ✅ 本轮（B4-02/03 收尾——权限收紧＋PID 代际绑定，PLAN §十一 B4 全三票
  完成，2026-09-07 用户 `/implement 继续B4的全部项目`）：
  - **新模块 lib/fs-hygiene.js（B4-02）**：tightenPath 三态（文件→0600/
    目录→0700/符号链接与缺路径不动，幂等）＋tightenBotTree（profile＋
    workspace 顶层两目录＋package.json/cordis.patch.yml/settings.yaml/
    pnpm-workspace.yaml 四具名文件；**不递归**——node_modules/.bin 执行位
    保护）。接线：scaffoldProfileBuiltin 两 mkdir 显式 mode 0700；
    scaffoldBot 两出口（builtin/script-path）调 tightenBotTree；
    writeRegistryAtomic 写后 tightenPath（存量旧权限随写收回；不改
    writeFileAtomic 默认——shared.cjs 无 mode 参数，避免波及全部调用面）。
  - **新模块 lib/pid-bind.js（B4-03）**：parseStartTicks（`lastIndexOf(")")`
    后 fields[19]＝整体第 22 字段，comm 含空格/括号不偏移）＋readStartTicks
    （仅 Linux 实读）＋pidIsSameGeneration 三态（非整数绑定不调 reader 即
    true＝旧记录零迁移；读失败/非 Linux 退化 true；不等＝pid 被复用→false）。
    接线：spawn 事件记录 pidStartTicks；computeStatus 过 isProcessAlive 后
    加代际门（不符→stale，注入式依赖）；stop() 代际不符先行分支（成对清理
    pid/pidStartTicks/startedAt，不误伤错代进程）；reconcileStalePids 改走
    computeStatus（死＋错代都收）；全仓 6 处 `delete bot.pid`＋2 处
    `delete record.pid` 成对补删 pidStartTicks；cmdline 归属检查
    （pidMatchesBot）保留为二道防线未动。
  - **测试＋2 文件 9 用例**：fs-hygiene 4 例（幂等/lstat 不穿透链接/不递归/
    注册表存量回收/scaffoldBot 集成含 0644→0600 收回）；pid-bind 5 例
    （parse 纯测含 comm 带括号/0 合法/畸形 null、本进程实读、三态注入、
    computeStatus 接线、真 spawn 集成——假 dsh bin 起真子进程，绑定值与
    实读一致＋stop 成对清理）。**全量 53/53×2；冻结面 9/9 零漂移**（0008
    sourceManifest 逐一 sha256）。
  - **过程修正（均测试自身 bug，实现零改动）**：①fs-hygiene「链接本身不改」
    原用 statSync 穿透符号链接读目标（改 lstatSync）；②注册表断言路径原写
    `$DSH_HOME/bots.json`，实际 registryPath＝`$DSH_HOME/bots/bots.json`；
    ③pid-bind statLine 合成助手垫片多填 1 个致 starttime 落 fields[20]
    （fields[0]＝第 3 字段，state 后应填 18 垫片）；④computeStatus 接线
    案例硬编码 pid 过不了 isProcessAlive 前置门（改 process.pid；旧记录
    案例撤假注入走真实现三态）。
  - **连带**：两票（b4-spawn-env-hygiene/issues/02、03）resolve＋证据
    Comments；部署清单 5→**7 文件**（＋fs-hygiene.js＋pid-bind.js），部署
    spec/票面/回归门 53/53 同步，新增部署后注记（权限收紧生效时点＋
    pidStartTicks 写入节奏）；index.js 头部行数与模块计数刷新
    （3,552 行；34 个 lib 模块——抽取批曾漏刷的「23」一并纠正）。PLAN §十一
    B4 行收口＝全三票已实施。

- ✅ 本轮（B4-01 spawn env allowlist——PLAN §十一 B4 首票，2026-09-07 用户
  `/implement` 续 frontier）：
  - **新模块 lib/spawn-env.js（50 行）**：buildSpawnEnv 纯函数——基集
    （PATH/HOME/LANG/LC_ 前缀/TZ/TERM/TMPDIR）∪ 逃生阀
    DSH_BOTS_ENV_EXTRA（逗号分隔附加名，缺名安全忽略）∪ overrides（DSH
    显式集最高优先）；KEY/TOKEN/SECRET/PASSWORD 形态与 NODE_OPTIONS
    **一律拒绝**（逃生阀附加同受约束）。
  - **index.js 3,517 行**：两处 spawn（create-bot 脚本 spawnBot 脚手架／
    dsh bin spawnBot）全量继承 → buildSpawnEnv 共用构造（单一枚举）；
    internals 增补导出。
  - **生产风险预防归因**：dsh 全包 grep 普查——dsh **不从环境读任何凭据
    形态变量**（模型凭据走 profile 配置，allowlist 不会打断 bot LLM 调用）；
    但 dsh 引用 NO_PROXY（代理支持），代理变量不在基集——**宿主经代理
    出网时部署前须设 DSH_BOTS_ENV_EXTRA 放行 http_proxy/https_proxy/
    no_proxy**（已注记部署面）。
  - **测试**：tests/spawn-env.test.mjs 5 用例——基集并集精确断言／拒绝形状
    绝对性／overrides 优先级／逃生阀正常＋缺名／**真 spawn 集成**（经
    DSH_BOTS_DSH_BIN 假 bin 落盘子进程实环境：DSH 集在位、canary 与
    NODE_OPTIONS 与宿主侧开关不透传、逃生阀生效）。全量 51/51×2；冻结面
    9/9 零漂移。
  - **过程修正（均当场抓出）**：①spawn-env.js docblock 内「LC_*/TZ」的
    `*/` 提前终止块注释（node --check 抓出改「LC_ 系」）；②集成测试假
    bin 缺执行位（EACCES→chmod 0755）＋botUrl 不在 internals（改内联
    URL 契约断言）。
  - **部署清单连带扩为 5 文件**（index.js/mail-plane.js/session-driver.js/
    review-job-tools.js/spawn-env.js），部署 spec 与票面已同步。

- ✅ 本轮（评审 job 受信链机械抽取——架构评审候选 6 实施，2026-09-07 用户
  `/implement` 点名 frontier 首张代码票）：
  - **新模块 lib/review-job-tools.js（610 行）**：自 index.js 受信链区域
    （576 行：createJobFromDecision／issueJobDispatch／backfillJobDispatches／
    productionJobCapabilityProvider／validateBotWorkspaceTriple／
    registerReviewJobTools／taskSpecArtifactIdFor（私有）／
    productionReviewerCapabilityProvider／registerReviewerEvidenceTools 九函数）
    逐字迁移（diff 复核仅缩进）；注入式工厂（workspaceDirFor 唯一宿主注入，
    其余 33 具名依赖直连 review-* 模块 import）＋internals 同名回填，测试面
    零改动。
  - **index.js 4,079→3,515 行**：冻结上限余量 221→785（B4/B5 接线空间就位）；
    头部分层架构图同步（新增先例行＋候选区清单收窄＋行数刷新）。
  - **过程修正 ①（套件当场抓出）**：工厂返回初版漏列三个区域内函数
    （issueJobDispatch／backfillJobDispatches／validateBotWorkspaceTriple——
    internals 与 apply/BotsApi 仍引用）→ 31/50，补齐返回与解构后恢复。
  - **过程修正 ②（B3 观察项归因升格）**：mail-at-least-once「合成 id」测试
    间歇红——原 B3 批判「环境抖动」**归因错误**，实为概率性测试缺陷：同毫秒
    双写时排序 tiebreak 按字典序比 id，真实 base64url id 与合成 in-w-N 相对
    序随机 → `conv2[1]` 位置断言 ~47% 翻转。改按内容定位断言（顺序无关）；
    修复后全量三连 50/50。
  - **验证**：全量 50/50×3；冻结面 0008 sourceManifest 9/9 零漂移
    （机械校验）；node --check 双文件过；部署面未触碰（部署票仍待点名）。

- ✅ 本轮（待办队列切票——to-tickets 流程，2026-09-07 用户 `/to-tickets`
  后经三问「确认」）：
  - **发布 8 张 tracer-bullet 票**（各特性目录 `issues/NN-*.md`，本地模板
    ＋Parent spec 指针）：deploy 批＋live smoke（1）；受信链机械抽取
    prefactor（1，B4/B5 先做建议非依赖边）；B4 垂直切三张（env allowlist／
    权限收紧／PID startTicks——互无依赖边，同改 spawn 区域记串行执行纪律）；
    B5 SSE 可重放（1，服务端＋客户端兜底＋测试单窗口）；client fetch 导出
    （1）；bot-mail-agent grilling 定形（1，**ready-for-human**——设计取舍
    需用户参与，grilling 后再切实施票）。
  - **队列结构**：全队列零硬阻塞边＝frontier 全开；执行序建议＝部署批→
    受信链抽取（prefactor，4,079→约 3,500 买回上限余量）→B4×3→B5／
    其余。票面避免文件路径（防漂移），部署票因属运维 runbook 例外保留
    文件清单。
  - **验证**：8 文件落位核验；父 spec 六件按技能纪律未动。

- ✅ 技能环境清理（2026-09-07，用户点名审计 → A′ 方案批复执行）：
  - **审计发现**：技能双安装位并存——用户级 `~/.agents/skills`（09-05 旧版
    快照、CRLF 行尾污染、2 个 Codex 改名适配）与项目级 `.agents/skills`
    （09-07 新版快照、LF）35 对同名不同文双注册；office-docx/pdf/pptx/xlsx
    用户级四件套与官方 `document-skills:` 插件撞名。定性：非功能冲突，
    为同源上游两代快照 + 行尾污染；低效点＝每会话技能注入 70+ 条。
  - **处置**（office 四件与 35 对双版分两次批复）：① 删用户级 office
    四件套（官方插件版单一入口）；② 35 个新版上移覆盖用户级（LF 统一，
    顺带修复 `global-biblio-base`/`find-skills` 两处 CRLF）；③ Codex 改名
    （`Codex-handoff`/`git-guardrails-Codex`）在新内容 frontmatter 上保留；
    ④ 项目独有 `implement-spec`/`retro` 上移；⑤ 删项目级 `.agents/skills`。
  - **净效果**：用户级 41 技能单一事实源（全局最新、LF、无撞名），本仓库
    会话回落用户级零损失；每会话技能注入量近乎减半。注册下次会话生效。
  - **备案**：删除未先备份——旧版可从上游 mattpocock/skills 仓库随时恢复，
    新版已全量存于用户级；项目根遗留空壳 `.agents/` 目录待 rmdir（纯
    cosmetic）；README §2 的 18 个 md 计数不含技能文件，无需更正。
  - 无代码/测试影响，无需重启。

- ✅ 本轮（agent 面 md 全量五杠杆诊断＋瘦身——writing-for-agents 续批，
  2026-09-07 用户点名「对有必要瘦身的给 agents 看的 md 都进行」）：
  - **处置表**：PROJECT_UNDERSTANDING 489→232 行（瘦身）；README 172 行
    五处沉淀修正；docs/agents/domain.md 过期句修正（CONTEXT.md 已建）、
    triage-labels.md 模板残句删除；CONTEXT.md（33 行新件）核验免修；
    issue-tracker.md 核验免修。**不动件及理由**：CHANGELOG（append-only
    台账）、TEMP-guidance/CLOSURE（冻结 SHA）、docs/history/ 四件
    （只读归档）、PLAN（头部门态地层系有意审计链且修订须双席，单席删层
    ＝破坏审计）、GROK 对比/CODE-QUALITY 评审（自述时点的参考快照）、
    PROPOSAL-knowledge-base/PLAN-p6-4（代码按名引用永久原位）。
  - **PU 瘦身要点**：头部加时效声明（领域总览＋方法论权威；状态让位
    CHANGELOG/PLAN）；删「下一步实现方向」（实现已成史）；关键文件测试
    清单 15 文件→现口径（50 文件＋TMPDIR 复现条件）；演进里程碑 45 行
    →梗概一段；「仍可选题」内 60 行评审门态叙事（停在 08-28：R-3 待验收/
    P9 挂门——实际 09-04 全关 READY）收口为一行闭环声明＋PLAN §十一
    指针；已落地八项每项压至 1~4 行（细节指回 CHANGELOG）；删已完成
    「模型终选四源重建」待触发项（09-04 四源复证 PASS 销账）与「溯源
    隔离实验」轮次史；删「待用户动作」（能力已入功能清单）。保留不动：
    用户方向原文、协议要点、前端架构备忘全部实证 gotchas、方法论 17 条
    及照发条款、双审试水轮待触发项、仍可选题活观察四项。
  - **README 修正**：§1 门态行去五门列举缓存、TEMP 合同行改「已冻结
    （O 批已执行完毕）」定性、PU 两行描述更新；§3 O 批「顶部条目」→
    「对应条目」、C2-1~C2-4「未授权未执行」→「已被统一 C2 批消化」。
  - **验证**：PU/README 节名引用面核验（「仍可选题」「方法论」被
    AGENTS/issue-tracker/README 按名引用，均保留）；代码零引用 PU
    （grep lib/scripts/tests/package.json）。纯文档批，冻结面零触碰。

- ✅ 本轮（AGENTS.md 诊断重写——writing-for-agents 框架，2026-09-07 用户
  点名）：
  - **诊断**（五杠杆）：①沉淀——§2「P9 启动」项已死（P9 2026-09-04 关闭）、
    §3 门态五项列举与「执行中合同」定性过期；②缓存——§1 三行落档小表＝
    README §6.2 权威表部分复写（且自相矛盾地边指边复述）、§4 triage 五
    标签枚举＝triage-labels.md 全文复写、议题库约定细节＝issue-tracker.md
    复写、instances 归因规则三处出现；③指针措辞——§3/§4「详见 X」只说
    在哪不说何时触发；④否定式——§2 禁令缺正面配对（默认工作面未说）；
    ⑤no-op——「必读」（harness 自动加载）、逐节日期标注×3（裁定出处
    CHANGELOG/README §6.2 已载）。
  - **重写**（61→43 行，四节分支结构保留）：全部活规则语义不变——落档
    定义/CHANGELOG 底线/README §6.2 委托；真实运行面零写入＋点名纪律
    （P9 死项剔除、instances 归因压缩为一句＋指针）；冻结件/冻结面/证据
    纪律原样；事实源四指针去缓存；§4 改触发词前置（写工单→issue-tracker、
    定形领域词→domain、标签语义→triage-labels）。新增全局护栏一句：
    所载纪律均有用户裁定或冻结合同背书、修订须用户明示。
  - **同步**：README §2 AGENTS.md 行角色描述更新。纯文档批：冻结面零
    触碰、无代码变化。

- ✅ 本轮（鲸形品牌精修整体废弃——用户裁决失败设计，2026-09-07）：
  - **授权**：用户点名「这个部分内容删除，包括其原文件，这是个失败的
    设计所以没有部署」。
  - **代码回退**：lib/client.js 逐字节回退至部署面版本（sha `c01c08ff…`
    两面一致，即 B1 批时点——CSRF 客户端/apiText 等 B1 功能完整保留，
    仅剥离品牌改动）；node --check 通过；BotBrand 系引用清零。
  - **产物删除**：artifacts/branding-2026-09-05 全系 12 个目录（基础版＋
    v2~v7 及各 final/refined 变体——设计稿/预览/检查脚本/截图/评审记录）
    全部删除。README/PLAN 无 branding 引用；B1 部署备份
    artifacts/archive/deploy-pre-b1/ 属 B1 批非品牌产物，保留。
  - **连带修正**：部署清单回归 3 文件（.scratch/deploy-b3-session-driver/
    spec.md 六处修正＋Comments 留痕；PLAN §十一 B3 行同步）；历史品牌
    批次条目按 append-only 台账纪律保留不动，废弃以本条为准。
  - **验证**：全量回归 50/50（隔离子进程）；冻结面未触碰（client.js/
    branding 均不在 9 文件 sourceManifest）。

- ✅ 本轮（后续任务规格化——`.scratch/` 议题库首批入位：2026-09-07 用户点名
  `/to-spec 对接下来的任务`；主审席执行）：
  - **范围**：把排队中的后续任务写成可执行规格/工单，共 6 件——
    ① `deploy-b3-session-driver`（合并部署批 spec，ready-for-agent）；
    ② `b4-spawn-env-hygiene`（B4 spec：env allowlist／权限 0700/0600／
    PID 绑定 /proc stat startTicks）；③ `b5-sse-replay`（B5 spec：单调
    eventId＋Last-Event-ID＋有限窗口 ledger＋兜底刷新）；④~⑥ 架构评审
    候选 2/4/6 三份 needs-triage 工单（bot-mail-agent／client fetch 导出／
    review-job-tools 机械抽取）。规格引用的代码事实均经主审复核（两处
    spawn 全量继承、SSE hub 无 id/重放、computeStatus signal-0 判活、
    events.test.mjs 先例、/tmp 架构报告候选卡原文）。
  - **部署清单修正**：对账发现第 4 个待同步文件——`lib/client.js`（2026-09-05
    「鲸形品牌精修」批落档后无部署批跟随，滞留仓库；api-security.js/
    bot-supervisor.js 两面 sha 一致不动）。部署 spec 按实记 4 文件。
  - **边界**：spec 存在不构成部署/启动授权（AGENTS.md §2 点名纪律在
    spec 内显式重申）；`.scratch/` 非文档地图成员（README §2 不动）；
    B4/B5/候选工单均未动 9 文件冻结面。
  - **验证**：落笔前盘面核实（session-driver 批在盘 9 项证据、CHANGELOG
    第 55 条在顶、README 19/根7、CONTEXT.md 在役）；本批零代码改动、
    全量回归不受影响。

- ✅ 本轮（session-driver 批——DSH 会话回合协议单一归属：2026-09-07 用户经
  /improve-codebase-architecture 选定候选 1 并 grilling「按推荐」定形七项
  决策（PLAN §十一 结构债首件）；主审席执行）：
  - **新模块 lib/session-driver.js（138 行）**：回合协议 create→（条件）
    selectModel→prompt→轮询→提取的单一归属；interface＝
    createSessionDriver({rpc,sleep,now})→runPrompt→{text,sessionId}。
    分工定形：协议/baseline 不变量归 driver（提取只认 prompt 后新回合；复用
    session 必拉 pre-prompt history，fresh 缺省也拉〔普通原序〕，评审 adapter
    声明 skipBaselineHistoryWhenFresh〔构造即 0，与原评审 RPC 序列逐调用
    等价〕）；监督（连续超时计数/F-RV-18 三重约束）留调用方 rpc adapter，
    driver 只加 checkAlive 三锚点钩子＋按剩余预算截断的 sleep；session 政策
    留 adapter（持久侧经 onSessionCreated 建会话即落盘——保真「回合失败也
    续上下文」的自愈前置序）。
  - **index.js（4,133→4,079 行）**：runNativeAgentTurn＝持久会话政策 adapter
    ＋超时计数监督 adapter；buildReviewRunner＝一次性会话 adapter＋三重监督
    adapter（监督体原位未动；简化：原循环内节流 pulse 收敛为 interval timer
    独立负责＋竞速 sleep/checkAlive 覆盖，语义由 review-heartbeat 9 用例
    验证）。两函数保名保形，internals 键与 5 个既有引用测试零改动通过。
  - **测试**：新增 tests/session-driver.test.mjs 11 用例（假时钟全注入零
    等待：三路径 RPC 序列逐调用断言/baseline 防污染/条件选模型/提取规则/
    超时文案/checkAlive 环头与取史后中止/onSessionCreated 时序/sleep 预算
    截断/参数校验）；全量 **50/50**。
  - **过程修正 2 枚（等价性测试环内暴露）**：①原评审循环 sleep 按剩余预算
    截断——初版睡满 pollMs 撞 runner 级超时墙（review-heartbeat/host-wiring
    抓出）；②原普通路径序为 create→selectModel→history(baseline)→prompt
    ——初版把 baseline 放在 selectModel 前（session-driver 直测序列断言
    抓出）。
  - **落档连带**：新建根 `CONTEXT.md`（惰性创建首件，收 4 词：会话回合/
    session driver/turn baseline/监督 adapter）；README §2 地图同步
    （19 全集，根 7）。
  - **验证**：冻结面 **9/9 零触碰**（本批不触 sourceManifest 面）；5 个协议
    引用测试单跑全过＋全量 50/50。
  - **授权依据**：用户 2026-09-07 /improve-codebase-architecture→选候选 1→
    grilling「按推荐」（含 Q6 单独成批/Q7 验收口径）；**部署批（2 文件）待
    另行点名**，部署后按 Q7 口径经 lead 走一封真实邮件回合 live smoke。

- ✅ 工程技能脚手架（2026-09-07，setup-matt-pocock-skills 落地）：
  - **授权**：用户点名执行该技能；两处分叉经选择确认——议题库＝
    `.scratch/` 本地 markdown（无 git remote，GitHub/GitLab 不可用）、
    triage 标签＝默认五角色同名；领域文档走 single-context（无 monorepo
    信号，未问）。
  - **新增**：`docs/agents/issue-tracker.md`（本地工单约定 + 与既有观察项
    约定的边界——长期观察项仍在 PU「仍可选题」+ CHANGELOG 留界，`.scratch/`
    只承接可执行工单/规格/路标）；`docs/agents/triage-labels.md`（五角色
    默认映射）；`docs/agents/domain.md`（消费规则——PU 为第一阅读面，
    CONTEXT.md 与 docs/adr 惰性创建）。
  - **修订**：AGENTS.md 增补 §4「Agent skills」（指向三份新文档）；
    README §2 地图同步（15 → 18 个 md，新增 docs/agents/ 小节 +
    `.scratch/` 非成员注记）。
  - **未做**（技能按惰性约定不预创建）：根 `CONTEXT.md`、`docs/adr/`——
    由 `/domain-modeling` 在术语/决策实际落定时创建；`AGENTS.md` 未动
    §1~§3 既有纪律。
  - 纯文档/脚手架变更，无代码、无测试影响，无需重启。

- 本轮（角色方向确认与鲸形 Bot 品牌精修，2026-09-05）：
  - **授权/共识**：用户要求“迭代出一个成熟专业的图标”，继续工作，并在
    方向选择中明确“更有生命感、接近官方的角色标志”。保持鲸鱼元素、
    比官方更小、品牌与导航图标不同及字标对齐要求；沿用 frontend-design。
  - **设计/实现**：lib/client.js 重建横向游动轮廓：紧凑尾柄、非对称双尾鳍、
    短腹鳍与沿鲸腹展开的曲面负形，Bot 双眼融入该负形。移除上一版独立
    水平胶囊面罩。68 x 60 画布内设计，展开/折叠同为 22px 显示；单色
    currentColor、透明负形、统一字标及独立导航线框 Bot 沿用。
  - **探索/复审**：制作封闭曲面、开口负形、终端符号三个方向；按用户
    角色偏好采用封闭曲面。独立视觉评审 brand_direction 指出眼部留白不足、
    双眼高差偏大、腹鳍过长、尾叶过于对称；主编复核后逐项修订。缩短
    眼线、双眼高差从 3 减为 2 单位，扩大前部负形；腹鳍尖回收约 3.5
    单位并圆滑根部，缩短左尾叶并圆化尾叉。二次评审未发现需继续返工的
    视觉问题；主编复看最终侧栏、放大与 1x 图后采用。完整意见及局限见
    design-review.json；此为设计协作记录，不是 P9 双席验收或用户验收。
  - **验证**：实际轮廓约 19 x 12.5px，官方参考约 24 x 17.75px（4 倍
    栅格测量）；着色面积约 100.05 / 212.33 平方像素。深浅主题、280/240px
    侧栏、字体对齐/回退宽度、预览折叠/悬停/展开/退出/进入检查通过。
    SVG DPR 1/2 多尺寸 12 项非空/边界检查通过；另做 22/32/48px 的 6 项
    连通分量检查，在 alpha=128 阈值下双眼与主体均独立，保留 1x 截图。
    locale 8 项、hygiene、源码/预览脚本语法通过；后加细节检查脚本单独
    node --check 通过。冻结 sourceManifest 9 文件 hash 一致。
  - **材料**：artifacts/branding-2026-09-05-v7/ 保存探索及返修前后对比；
    artifacts/branding-2026-09-05-v7-final/ 保存实际组件预览、最终 SVG、
    官方参考、设计对照图、深浅/折叠截图、检查脚本与结果、设计评审及
    manifest 哈希记录。历史材料未覆盖；显示检查不证明审美水准，静态
    预览交互接线不等同于部署后活体验收。
  - **边界**：只改品牌源码及本轮材料/台账，未改变工程行为或冻结合同；
    未部署、未重启、未写真实 ~/.dsh/注册表/配置，未新增正式证据包。

- 本轮（鲸形 Bot 轮廓与面罩重绘，2026-09-05）：
  - **授权/范围**：用户指出上一版细节及专业性不足，继续对品牌 SVG 自修
    自审；维持鲸鱼元素、比官方更小、品牌与导航图形独立、字标对齐的要求。
  - **设计/实现**：lib/client.js 从圆身体与孤立眼孔改为连续壳体、非对称
    双尾鳍、圆角传感器面罩及等距双眼。以 68 x 64 坐标设计，22px 画布
    实际显示；尾柄两侧增加过渡段，避免尾鳍与身体直接拼接的折点。面罩
    采用 evenodd 透明负形，眼线为 currentColor，深浅主题均无需覆盖底色。
    字标与独立导航图标未改。
  - **自审/返工记录**：先渲染斜面罩、水平面罩、流线面罩三个方向的放大、
    22/32/48px 及深浅对照，选择水平面罩以保持小尺寸识别。第一实现调整
    尾部过渡；二次查看发现面罩左壳偏薄，将面罩左边界从 x=7 内收至 x=9，
    双眼同步右移 1 单位居中，眼线从 2.8 加粗到 3.2 单位，再看最终截图。
    本轮自审为设计判断，不把像素/布局检查通过等同于用户认可设计。
  - **验证**：最终实际轮廓约 19 x 15px，着色面积 126.12 平方像素，小于
    官方约 24 x 17.75px（4 倍栅格测量）及 212.33 平方像素。深浅主题、
    280/240px 侧栏、字体对齐与回退宽度、预览折叠/悬停/展开/退出/进入
    均通过；12 项多尺寸 DPR 1/2 像素检查、locale 8 项、hygiene 与 7 文件
    语法检查通过。冻结 sourceManifest 9 文件 hash 一致。
  - **材料**：artifacts/branding-2026-09-05-v6/ 保存三方向探索；
    artifacts/branding-2026-09-05-v6-final/ 为面罩内收前的中间实现，目录名
    不代表当前采用版；最终采用 artifacts/branding-2026-09-05-v6-refined/，
    含实际组件静态预览、官方对照、深浅截图、SVG、检查脚本/结果及 manifest。
    历史文件未覆盖，静态预览事件不等同于生产活体验收。
  - **边界**：只涉及仓库品牌代码与材料/台账，未改变工程行为或冻结合同；
    未部署、未重启、未写真实 ~/.dsh/配置/注册表，未新增正式证据包。

- 本轮（融入鲸形元素并缩小 Bot 品牌，2026-09-05）：
  - **授权/范围**：用户要求品牌融入 DSH 官方鲸鱼元素，且 Bot 图标在观感上
    比官方规格小。沿用原生单色主题及此前品牌/导航图标独立的约束。
  - **实现**：lib/client.js 将 H 形品牌重绘为低矮流线鲸身、上扬双尾鳍与
    两个圆角传感器负形；采用独立贝塞尔轮廓，官方 FishLogo 仅作只读对照。
    草稿调整了尾部连接及眼孔的透明负形，最终收敛为单条 evenodd 路径。
    BotBrandMark 默认画布从 24px 改为 22px，折叠栏取消 24px 显式覆盖，
    与展开品牌同尺寸。统一 dsh bots 字体/基线及独立导航 Bot 图标保持不变。
  - **自审/验证**：查看同尺度官方/新版对照、放大图及深浅侧栏截图；官方
    FishLogo 原生规格 24 x 17.66px，新版实际轮廓约 20 x 13.5px。4 倍
    栅格测量官方着色面积 212.33 平方像素、新版 148.89（约 70%），宽高
    均更小；展开/折叠均为 22px 画布。深浅主题、280/240px 侧栏、字体
    对齐/回退宽度、预览折叠/悬停/展开/退出/进入均通过；12 项多尺寸
    DPR 1/2 像素检查通过，locale 8 项、hygiene、7 文件语法通过，冻结
    sourceManifest 9 文件 hash 一致。
  - **材料/边界**：artifacts/branding-2026-09-05-v5/ 保存实际组件静态预览、
    独立 SVG、官方只读参考 SVG、尺寸对照图、截图、隔离检查脚本与结果、
    manifest。对照图的官方文字是参考标签，不是官方字标复刻；静态交互
    使用预览接线。历史材料未覆盖；未改变工程行为/冻结合同，未部署或
    重启，真实 ~/.dsh/配置/注册表零写入，未新增正式证据包。

- 本轮（Harness/Bots 品牌与字标对齐精修，2026-09-05）：
  - **授权/范围**：用户要求进一步提升 SVG 的专业性、美感及 DSH Bots 语义，
    并纠正字标不平、不居中的观感；沿用 frontend-design 的实尺寸复审流程。
  - **实现**：lib/client.js 将相向对话标记替换为独立的 H 形品牌轮廓；圆润
    对称的两侧以连接桥相连，H 对应 Harness，成对负形眼孔提供 Bots 特征。
    28 单位画布、24px 显示，透明孔洞与 currentColor 适配原生深浅主题。
    移除手绘 dsh SVG 与 BOTS 徽标，改为同一文本节点的 dsh bots；继承原生
    字体，统一 18px/600 字重、24px 行高、零字距，与图形保持 8px 间距。
    独立的 16px 线框 Bot 导航图标保持不变；折叠栏使用品牌标记。
  - **自审/返工**：先将 H 连接、双面罩、字母连字三个方向渲染对比，采用
    H 连接方案。初稿字标上移 1px，实际浏览器字体测量发现中心偏差 1.5px，
    未通过对齐检查；最终删除位移，采用自然基线，已测默认字体中心偏差
    0.5px。检查最终放大图及侧栏实尺寸截图，确认左右轮廓/负形对称，
    字标无分段高低差，未复刻原生鲸形图案。
  - **验证**：隔离 Playwright 深色 1440px/浅色 390px、侧栏 280/240px
    检查通过：品牌无遮挡、与按钮间距足够、字形光学中心偏差 <=1px、
    页面无横向溢出；三种 sans 字体回退在 240px 侧栏均未截断。预览的
    折叠/悬停/展开/退出/进入通过，pageerror 为零；SVG 多尺寸 DPR 1/2
    共 12 项像素检查非空、无边缘着色。locale 8 项、hygiene、6 文件语法
    通过；冻结 sourceManifest 9 文件 hash 一致。
  - **材料**：artifacts/branding-2026-09-05-v4/ 保存三个方向及带位移初稿；
    artifacts/branding-2026-09-05-v4-final/ 保存最终实际组件静态预览、SVG、
    深浅截图、设计展示图、生成/检查脚本及 verification/manifest 哈希记录。
    历史截图/证据未覆盖。字体中心检查使用当前浏览器字体度量，三种回退
    检查限定为宽度适配；静态预览交互使用隔离接线，不等同于生产活体验收。
  - **边界**：未改工程行为/冻结合同，未部署、未重启、未写真实 ~/.dsh、
    注册表或配置；未新增正式证据包。

- 本轮（品牌与导航图标分离返工，2026-09-05）：
  - **授权/设计约束**：用户明确品牌与切换入口不可同图；原生仅作风格参照，
    品牌需独立设计；入口保留 Bot 语义并重绘为原生侧栏按钮风格，须自行查看返工。
  - **实现**：lib/client.js 移除鲸形品牌与入口共用图形。BotBrandMark 改为两枚
    相向对话形体，180 度旋转共用几何，表达 Bot 协作/交接，透明负形与实心
    字标组合。BotOutlineIcon 独立使用 16px 网格机器人头部、1.25px 主线宽、
    圆角头框/天线/短眼线，入口与品牌无图形调用依赖。
  - **自检返工**：第一轮实尺寸发现对话尾部间距偏紧，调整中央留白；栅格检查
    发现入口耳侧笔画侵入边缘像素，将 x=1.25/14.75 内收至 1.75/14.25。
    再看放大图、24px 品牌和 16/20/24px 入口，最终像素检查 DPR 1/2 共 12 项
    非空且无外缘着色；深浅主题、240px 窄侧栏与折叠/展开/退出/进入检查通过。
  - **验证/材料**：locale 8 项通过；最终源码/脚本语法、冻结 9 文件 hash 见
    artifacts/branding-2026-09-05-v3-final/manifest.json。该目录含最终组件
    静态预览、独立 SVG、设计展示图、截图、Playwright/像素检查与生成脚本。
    artifacts/branding-2026-09-05-v3/ 保存本轮中间稿（非最终采用），前两版
    历史产物未改。预览操作使用隔离接线，不冒充生产 DSH 活体验收。
  - **边界**：只改仓库 client、评估材料及 CHANGELOG；冻结源码未改，无新
    正式证据包；未部署、未重启、真实 ~/.dsh/配置/注册表零写入。

- 本轮（Bot 品牌 SVG 第二版精修，2026-09-05）：
  - **授权/范围**：用户“继续，这图标太简陋了，有图标参照，优化效果”，继续
    优化入口与左上角 DSH Bots 标识。只读提取已安装官方前端 FishLogo 的矢量
    轮廓作参照，沿用 frontend-design 技能与原生侧栏尺寸/主题规则。
  - **变化**：lib/client.js 重画流线鲸身、上扬尾鳍、腹部负形和连接节点细节，
    去掉上一版天线/双眼/笑脸；字标改为实心 SVG 轮廓、调整徽标比例。入口改为
    同形的小尺寸简化剪影（不再使用第一版线框），24px 品牌保留连接细节。
  - **验证**：隔离 Playwright 检查深色 1440px、浅色 390px，侧栏 280/240px
    无截断/重叠，折叠/悬停/展开/退出/重进入通过、pageerror 零；locale 8 项
    通过。源码/预览脚本语法和冻结 sourceManifest 9 文件哈希核验见 manifest。
  - **材料**：新增 artifacts/branding-2026-09-05-v2/，保留实际组件静态预览、
    深浅色截图、原生图形/上一版/新版对照与检查脚本、哈希清单；前版产物未改。
    对照页原生图形来自官方 SVG，DeepSeek 文字仅作参照标签，不声称原生字标复刻。
  - **边界**：未部署、未重启、未写真实 ~/.dsh、注册表/配置；冻结执行闭包
    未修改，不新增正式证据包。静态预览验证不等于生产页面已生效。

- 本轮（Bot 模式原生风格 SVG 标识，2026-09-05）：
  - **范围/授权**：用户点名重新设计官方侧栏 Bot 模式入口 SVG，并参照原生
    DeepSeek Harness 的鲸形标识，在 Bot 模式侧栏左上方替换原文字标题。
  - **实现**：lib/client.js 新增共用鲸形 Bot 图形（天线/面部负形）、圆润 SVG
    dsh 字标与 BOTS 小徽标；入口使用同形线框版。沿用原生 60px logo 行、
    24px 品牌高度与 --dsw-* 前景/反色令牌，固定 SVG 比例、零字距，深浅主题
    自动适配。折叠栏保留品牌图形，悬停/键盘聚焦显示展开图标，沿用原展开/退出动作。
  - **验证**：隔离子进程 node --check、locale 8 项、hygiene 检查通过。
    Playwright 隔离静态预览采用实际 client 组件/CSS、原生操作图标占位和
    预览事件接线，1440px 深色/390px 浅色（侧栏 280/240px）均无品牌截断或
    按钮重叠；折叠/悬停/展开/退出/重进入检查通过，浏览器 pageerror 为零。
    这是预览验证，不等同于已部署 DSH 内的活体验收。
  - **材料**：artifacts/branding-2026-09-05/ 内保存生成器、静态 preview.html、
    Playwright 检查脚本、深浅色页面/字标/入口截图、visual-checks.json 与
    manifest.json 哈希/冻结源复核；未覆盖前次评估材料或旧预览图。
  - **边界**：仅仓库 client 与本条留痕、预览材料变化；冻结 sourceManifest
    9 文件未改，不生成新证据包；未写真实 ~/.dsh 或部署，未重启 bot/host。
    当前运行页面仍使用原部署版本，本轮不包含部署同步。

- 本轮（全图代码质量与架构评估，2026-09-05）：
  - **范围**：用户要求“读取本项目全部文件做一个全图代码质量评估以及架构评估”。
    原始 184 文件全量读取与哈希清单；源码/测试审阅、权威合同对照、历史证据结构
    核验、13 张预览图查看。盘面无 .git，以 inventory SHA 快照定位。
  - **结论落档**：新增 docs/CODE-QUALITY-ARCHITECTURE-REVIEW-2026-09-05.md，
    记录 19 项代码发现（12 P1/6 P2/1 P3）、全部模块地图、测试盲点、架构风险与
    分阶段建议。重点为评审讨论/复检/发布重试/lease/spec/第二修复周期接线，
    消息交付与水位、registry 并发更新和启停意图。缺陷未实施修复。
  - **双轴归并**：Standards（Laplace）与 Spec（Pauli）返回件及主评交叉复核
    在报告 §5.3 归并落档；共同判断为“组件防护较强，跨模块恢复与生产接线不足”。
    此协作评估不是冻结规程下的 P9 正式双席验收，不重开或覆盖现有门态。
  - **验证**：89 源码/测试文件 node --check 通过；bwrap 隔离完整测试最终
    49/49，locale-runtime 实际执行；17 个额外输出场景保留脚本与日志。
    早期隔离前置条件/harness 失败与最终通过日志分别保存，不改写失败记录。
    包链 0001→0008 自身短哈希 8/8、前包引用 7/7、终版 sourceManifest 9/9 一致。
  - **材料/导航**：新增 artifacts/quality-review-2026-09-05/，含 inventory、
    反例探针、隔离入口、测试日志与 verification 哈希清单；它不是正式增量证据包。
    README §2 地图 14→15、docs 4→5，§1 过期终版导航 0006→0008。
  - **授权与边界**：用户本次全图评估请求＋AGENTS/README 留痕规则。仅修改评估
    材料与导航/日志；源码、PLAN/TEMP/CLOSURE、旧证据包/raw/ledger 未改。
    真实 ~/.dsh、部署、注册表/配置零写入；未执行 C2、真实 bot/host 重启或 P9。

- ✅ 本轮（B3 实施批——mailbox 消费面 at-least-once：2026-09-05 用户「继续」
  点名（PLAN §十一路线图第三批）；主审席执行）：
  - **mail-plane.js（296→511 行）**：①不可猜测 messageId（base64url 22 字符，
    appendMessage 生成；历史行 messageIdFor 回退合成 in-<botId>-<seq>）；
    ②durable receipt（inbox/<bot>/receipts/，原子写；水位＝max 基线/最大
    receipt；保留 500 按 mtime 淘汰）；③崩溃安全游标 initialMailCursor——
    水位落后文件 → replay 回放停机积压（bot 停机期间邮件不再丢）；旧数据
    无 receipt → 迁移基线跳过存量（不重触发历史）；目录未建不触碰；④幂等
    响应（responses/ 标记 none→claimed→finalized；appendOutbox 带
    replyToMessageId 时内置去重——崩溃重放窗口不产生重复回复）；⑤回路由
    去重 inboxHasResponseTo（关掉 outbox 已写、路由重发的重复投递窗口）。
  - **index.js（4,083→4,133 行，守上限）**：watcher 启动游标改水位制＋replay
    时 offset 归零重读；每条消费完成写 receipt（失败降级内存游标）；积压超
    100 条仅回放最近批、其余记 skipped-stale（防停机后 agent 风暴）；
    handleIncoming 四个回复出口全部接幂等链（claim/跳过 finalized/outbox
    去重/finalize）；routeReplyToSender 两处投递前去重。
  - **连带修复 09-04 抽取遗留缺陷 3 枚**（B3 触及面复查发现，均「异常被
    宽容 catch 吞掉」型静默失效，测试因一次性临时 home 冷缓存而漏检）：
    ①mail-plane 抽取时漏导入 statSync/openSync/readSync/closeSync——会话
    缓存签名恒为常量 "@"（**所有 bot 会话缓存自 09-04 起永不失效返旧值**）；
    ②同因 readLastMessage 恒 null（**bot 列表预览自 09-04 起恒空**）；
    ③PREVIEW_TAIL_BYTES 常量留在 index.js 未随迁。三枚均已修＋回归测试
    钉住（缓存按真实签名失效/readLastMessage 返末条正文）。
  - **测试**：新增 tests/mail-at-least-once.test.mjs 14 用例（messageId 形状
    与唯一性/回退稳定；receipt 水位与淘汰；游标三分支；响应生命周期；
    outbox 幂等；崩溃窗口端到端重放无重复回复；路由去重；三枚回归）。
  - **验证**：全量 **49/49**（两次连跑；期间一次串行 48/49 无 ✗ 痕迹、逐文件
    隔离复跑与两次全量均全过，判环境抖动留观察）；冻结面 **9/9 零触碰**。
  - **授权依据**：用户 2026-09-05「继续」＝B3 点名；**B3 部署批（2 文件）待
    另行点名**。已知留限（诚实登记）：跨 bot 回路由在「outbox 写后、路由
    前」的极窄崩溃窗内理论上仍可重复投递一次（单消费者模型下概率极低；
    inboxHasResponseTo 已覆盖常态重放路径）。

- ✅ 本轮（B2 部署批＋崩溃自愈生产实测：2026-09-05 用户「继续」点名；主审席
  执行；授权写面＝plugins/＋进程重启链）：
  - **前置与同步**：漂移恰 2 件（index.js 改＋bot-supervisor.js 新）；旧件备份
    artifacts/archive/deploy-pre-b2/；post-hash 2/2、部署侧 node --check 2/2。
  - **重启链（B1 运维口径实战）**：令牌化停四 bot（200×4）→停宿主 30636→
    新宿主 **34312**（HTTP 200）→四 bot 零手动自动跟随
    （34340/34359/34385/34411）；五字段注册 5/5。
  - **B2 生产实测三项全过**：①**崩溃自愈**——SIGKILL 注入研究员
    （bot-mt0x6r0y，pid 34359）→ 约 5s 自动重生 pid 34499 在线，退避节奏
    与首档 2s 一致，instances.jsonl 新行留痕（重启即新实例身份，审计链
    完整）；②**有意停止不自愈**——API stop reviewer-second 后 8s（超首档
    退避）仍离线；③**手动复活**——令牌化 start 200→34608 在线。
  - **核验**：repo↔deploy 代码面全树 IDENTICAL；冻结面 9/9 零触碰。
  - **报告**：artifacts/deploy-b2-report-2026-09-05.json（sha256=481e4c7d…，
    wx 独占落盘）。
  - **授权依据**：用户 2026-09-05「继续」＝B2 部署批点名（上一轮回报所列
    待点名事项）；下一批 B3 mailbox 消费面 at-least-once 待点名。

- ✅ 本轮（B2 实施批——BotSupervisor 生命周期监督：2026-09-05 用户「继续」
  点名（PLAN §十一路线图第二批）；主审席执行）：
  - **新模块 lib/bot-supervisor.js（241 行）**：①generation fencing——每次
    spawn 递增代数，退出事件/就绪探针携带代数，不符即弃（旧实例迟到事件不
    污染新实例）；②崩溃退避自愈——code≠0 意外退出按退避表（2s/5s/15s/60s/
    5min 封顶）自动重启，三层开关（enabled／autoRestart／DSH_BOTS_AUTORESTART=0
    应急闸）；③crash-loop 熔断——10min 窗口内第 5 次意外退出停止自动重启，
    手动 start 清零重来（autoIntent 协议：自动重启发起的 begin 保留退出史，
    手动/跟随启动清零——修复过程见验证段）；④readiness 观测链——spawn→
    identity→port（TCP 探测 500ms 间隔/20s 截止）→ready，不阻塞 start()
    返回（HTTP 契约不变），degraded 仅告警不干预，RPC health 为预留注入缝；
    ⑤descendant 清理——stop 前快照 /proc children 递归树，主进程终止后
    SIGTERM→候→SIGKILL（崩溃路径无预快照＝已知留限；进程组方案需改 spawn
    语义未采）。
  - **index.js（4,056→4,083 行，守上限）接线六处**：spawnBot begin＋entry.gen
    ＋spawn 后 trackReadiness＋exit 处理器尾部 onExit；stop 头部 onStop＋
    预快照后裔、终止后 killDescendants；patch 新增「enabled=false 且在线 →
    自动 stop」（此前停用只拒新启动）且停用变更不再走「更新后自动重启」；
    apply 恒接线 api.supervisor（库直测未接线可选链跳过沿用旧行为）。
  - **测试**：新增 tests/bot-supervisor.test.mjs 10 用例（纯策略 5＋编排体
    假时钟全注入 5：自愈闭环含跨重启熔断累计与手动清零／代数栅栏／onStop
    取消／触发时开关拦截／应急闸／readiness 三态）。
  - **验证**：全量 **48/48**；语法 2/3 件＋冻结面 **9/9 哈希一致**（B2 不触
    sourceManifest 面）。过程缺陷 2 枚均在测试环暴露并当轮修复未出海：①
    crashLooped 过滤表达式误把时钟函数做算术（NaN→全剪枝，熔断永不触发；
    根因＝单元测试曾传数字时钟侥幸通过，已统一为函数契约）；②autoIntent
    语义初版在 begin 无差别清退出史（自愈闭环测试抓出：熔断永远积累不起
    来），改为自动重启路径保留史、手动路径清零。
  - **授权依据**：用户 2026-09-05「继续」＝B2 点名（上一轮回报所列待点名
    事项②）；**B2 部署批（3 文件）待另行点名**。

- ✅ 本轮（B1 部署批＋门控生产实测：2026-09-05 用户「继续」点名（B1 部署
  待点名事项①）；主审席执行；授权写面＝plugins/＋进程拉起）：
  - **前置对账**：运行面离线（晨间宿主重启后未拉起，零停机需求）；漂移恰为
    3 文件（index.js/client.js 改＋api-security.js 新）；旧件备份
    artifacts/archive/deploy-pre-b1/；同步 post-hash 3/3、部署侧
    node --check 3/3。
  - **拉起链＋自启动复证**：新宿主 **30636**（HTTP 200）→**零手动**四 bot
    自动跟随（30707/30733/30759/30796，1.5s 交错）——自启动功能**冷启动
    复证通过**（宿主重启后首次真实场景）；五字段注册 5/5。
  - **B1 门控生产实测五项全过**：①GET /_csrf 签发 43 字符令牌；②无令牌
    变更 → 403 code=csrf-token-required（门先于 404）；③持令牌 → 过门
    到达处理器（404，零副作用探针）；④GET 只读面无令牌 200；⑤decision
    持令牌空载荷 → 400 信封校验（**principal 解封生产实证**，此前恒 403；
    audit 留 user-decision-rejected 探针行＝诚实留痕）。
  - **核验**：repo↔deploy 代码面全树 IDENTICAL（lib/scripts/package.json）；
    评审读面 200；冻结面 9/9 哈希一致（B1 零触碰）。
  - **报告**：artifacts/deploy-b1-report-2026-09-05.json（sha256=660b4284…，
    wx 独占落盘）。**运维口径自此生效**：变更面 HTTP（POST/PATCH/DELETE）
    须先 GET /api/bots/_csrf 携头 x-dsh-bots-token；GET/SSE 不变；web
    客户端自动。
  - **授权依据**：用户 2026-09-05「继续」（对上一轮回报所列待点名事项①的
    顺序点名）；B2 BotSupervisor 待另行点名。

- ✅ 本轮（B1 实施批——principal 与 API 认证层：2026-09-05 用户「确认方案，
  落档并开始着手修改」点名启动（PLAN §十一路线图首批）；主审席执行）：
  - **新模块 lib/api-security.js（85 行）**：变更面 CSRF 令牌会话（惰性首铸/
    30min TTL/15min 轮换/60s 宽限窗受认旧令牌/timing-safe 比较/三类统一错误码
    required|invalid|expired）＋本机单用户 principal 适配（有效令牌 ⇒
    {role:"user",source:"local-csrf-token"}）；威胁模型边界入模块头（浏览器面
    弥补 Sec-Fetch 缺头放行空窗；同机同用户不设防＝B4 范围；GET 只读面按
    F-RV-28 重评触发预留）。
  - **index.js（4,027→4,056 行，守 4,300 上限）**：①GET /api/bots/_csrf 令牌
    引导端点（置于门控前；未接线 apiSecurity 对称 404）；②变更面门控
    （POST/PUT/PATCH/DELETE 先于一切副作用，403 随 code 字段——客户端可安全
    重取重试；未接线沿用旧行为兼容库直测）；③apply 接线 api.apiSecurity＋
    reviewPrincipalProvider（P5-4 缝：decision/intake 由恒 403 fail-closed
    转为令牌认证可用，principal 缺席语义保持）。
  - **client.js（3,133→3,174 行）**：api() 中心化令牌（惰性引导/变更请求自动
    携带/403 重取且仅新令牌时重试一次）；apiText() 落地并修复评审 body 端点
    解析错配（text/markdown 误按 JSON.parse——对比报告 P0-6.3 活缺陷销账）。
  - **测试**：新增 tests/api-security.test.mjs 12 用例（签发/校验矩阵/轮换宽限
    过期/空白会话；principalFor↔assertDecisionWriter 集成；handleApi 端到端
    门控＋_csrf 端点＋decision 写面解封＋provider 缺席仍 fail-closed）。
  - **验证**：全量 **47/47**（46 原有＋新模块）；语法 3/3；冻结面复验
    **9/9 哈希一致**（B1 不触 sourceManifest 面，无需 0009）；hygiene 孤立
    注释检测随套件绿。
  - **运维口径变化（部署批生效后）**：变更面 HTTP 操作（POST/PATCH/DELETE）
    须先 GET /api/bots/_csrf 取令牌并以头 `x-dsh-bots-token` 携带；GET/SSE
    不变；web 客户端自动完成。**部署批待用户点名**。
  - **授权依据**：用户 2026-09-05「确认方案，落档并开始着手修改」＝方案确认
    ＋B1 点名（CHANGELOG 上一条）；部署同步/restart 链按纪律另行点名。

- ✅ 本轮（后续方向路线图确认落档：2026-09-05 用户「确认方案，落档并开始
  着手修改」；主审席基于 docs/GROK-DSH-BOTS-COMPARISON.md 差距分析×盘面
  复核后提出，用户确认）：
  - **差距分析结论**：报告三工作包中 A（可验证基线）已由 O-6＋C2 批消化、
    B（评审生产接线）已由 R-2/R-3 闭环（F-RV-1~26 全结，今日抽查实证
    lease/epoch/nonce 语义在盘）、C（普通 Bot 生产边界）余量大半——API 无
    真认证（F-RV-28 在册）、无 supervisor/readiness（F-RV-29 在册）、spawn
    全量 env 继承（index.js:599/1065）、SSE 无重放、消费侧无 messageId；
    另确认报告 P0-6.3（body 端点文本响应×client JSON.parse）**仍为活缺陷**
    （review-http-api.js:31×client.js api()），列入 B1。
  - **变化**：PLAN 新增「§十一 后续方向路线图」——B1 认证层（点名启动）→
    B2 BotSupervisor → B3 mailbox at-least-once → B4 环境与文件边界 →
    B5 SSE 可重放＋结构债穿插＋暂缓项维持；每批点名授权、负例入回归、
    触冻结面则新 runId 出 0009。
  - **验证**：差距分析各项均经代码盘面逐项核验（含换术语复查 lease/claim/
    epoch/nonce 与 client 取正文路径），非文档时点断言直接采信。
  - **授权依据**：用户 2026-09-05「确认方案，落档并开始着手修改」＝方案
    确认＋B1 点名；B1 部署批另行点名。

- ✅ 本轮（外部评审回报核验＋F-RV-27~29 处置登记：2026-09-05 用户转达
  回报并「继续」授权处置；主审席逐项独立核验后执行；纯文档批零代码改动）：
  - **核验结论**：五项断言全部属实——①README §2 标题计数过期（表体无缺行，
    盘面实清点 14 件）；②`/api/bots` 仅 CSRF 守卫（index.js:1391）＋本机
    部署假设、评审写面恒 403 fail-closed；③自启动无 supervisor 崩溃自愈；
    ④index.js 4,027／client.js 3,133 行实测；⑤0008（09:39）早于 F-S15/
    自启动批且两批均在 9 文件冻结面外。
  - **变化**：README §2 标题 12→14＋§3 F-RV 行更新（下一空号 F-RV-30）；
    PLAN §三新增「外部评审回报登记」段——F-RV-27（计数漂移·当轮修复销账）、
    F-RV-28（管理API鉴权边界观察·宿主暴露策略变化时重评）、F-RV-29（生命
    周期无supervisor观察·已知非阻断）。
  - **验证**：md 全集清点 14/14 与 §2 表逐行对齐；测试面零引用三文档
    （review-intake.test.mjs 命中系 fixture 同名文件）；本批不触冻结面
    （sourceManifest 9 文件零触碰）、不触部署面（三文档不在 C2 同步合同）。
  - **授权依据**：用户 2026-09-05「继续」＝对主审处置建议的点名执行；
    回报来源＝用户转达外部评审（副审补进归属由用户安排，新发现自此走
    F-RV-27+ 正常流程）。

- ✅ 本轮（bot 自启动批部署＋重启链——兼功能生产实测：2026-09-04 用户
  「继续」点名；主审席执行；授权写面＝plugins/＋进程重启）：
  - **前置对账**：漂移恰为 3 文件（index.js 改＋mail-plane/bot-autostart
    新）；旧 index.js 备份 artifacts/archive/deploy-pre-autostart/；同步
    post-hash 3/3、部署侧 node --check 3/3。
  - **重启链＋实测**：API 停四 bot→停宿主 159906→新宿主 **164506**
    （HTTP 200）→**零手动启动**，等待 18s 后四 bot 全部自动跟随
    （164532/164558/164584/164612，均为新宿主子进程，pid 间隔与 1.5s
    交错一致）——**自启动功能生产实测通过**。
  - **核验**：新五行五字段 5/5；review API 200；repo↔deploy 全树一致。
    附注：插件 ctx.logger 输出走 dsh 内部日志通道（非 stdout），与此前
    各批一致，非缺陷。
  - **报告**：artifacts/deploy-autostart-report-2026-09-04.json
    （sha256=62c70b4d…）。sourceManifest 面零触碰。

- ✅ 本轮（bot 自启动功能批：2026-09-04 用户需求「增加 bot 自启动，当我
  启动 dsh web 时，bot 跟随启动」；主审席执行；全量 **46/46**（含新测试
  模块）；触及 4,300 行冻结上限 → 按既定规则连带抽取邮局区域）：
  - **新功能（lib/bot-autostart.js）**：宿主 apply 的 host 分支（仅主 web
    实例）后台触发 `autoStartBots`——顺序＋1.5s 间隔启动注册表中未在线的
    bot（防启动风暴）；不阻塞宿主 HTTP 就绪。开关三层：注册表行
    `enabled:false`＝停用（BotsApi.start 现成语义）；`autoStart:false`＝仅
    退出跟随启动（手动启动不受影响）；环境变量 `DSH_BOTS_AUTOSTART=0`＝
    应急闸。复用 api.start 幂等（在线即 alreadyRunning；engineering 组自动
    过 P6-1 三路径校验）；单个失败只告警不中断。
  - **测试（tests/bot-autostart.test.mjs，4 用例）**：选择过滤（停用/退出/
    在线跳过＋注册表序）；编排（顺序/alreadyRunning 分类/失败隔离/结果
    三元组）；无待启动零调用；应急闸开闭往返（含环境恢复）。mock 注入，
    不 spawn 真进程——真启动链由部署重启实测覆盖。
  - **连带抽取（守 4,300 行上限）**：邮局区域（含 inbox/outbox 路径助手、
    parseJsonlLines/seq/appendMessage/会话合并三助手，共 271 行）整体迁至
    **lib/mail-plane.js**（296 行，行为不变，index.js 同名导入）；index.js
    4,297→**4,025 行**；头部架构图同步。抽取过程两处遗漏（readLastMessage/
    readConversationCached 漏导出＋DEFAULT_INBOX_LIMIT 孤儿 docblock）均被
    测试护栏当场拦下修正——hygiene 孤儿 docblock 检测器如期发挥作用。
  - **验证**：35 源文件 node --check 全过；全量 46/46。
  - **未执行**：部署＋重启（repo≠deploy：index.js 改＋mail-plane/bot-
    autostart 新建——**待点名授权**）；sourceManifest 面零触碰。

- ✅ 本轮（F-S15 修复批部署＋重启链：2026-09-04 用户「继续」＝对上批待点名
  项的点名授权；主审席执行；授权写面＝plugins/＋进程重启）：
  - **前置对账**：漂移恰为 2 文件（lib/index.js 改＋lib/mail-seq-lock.js 新），
    与修复批登记一致；五进程存活、宿主 200。
  - **备份＋同步**：旧 index.js → artifacts/archive/deploy-pre-fs15/；2 件
    同步 post-hash 2/2、部署侧 node --check 2/2。
  - **重启链**：API 停四 bot（95802/95831/95860/95889 全退）→ 停宿主 95753
    → 新宿主 **159906**（`dsh web --no-open`，HTTP 200）→ 四 bot 拉起
    （159958/159986/160014/160042，均为新宿主子进程）。
  - **核验**：新五行五字段 5/5；review API 200；宿主日志零异常；
    **repo↔deploy 全树一致**——生产代码即含跨进程 seq 写锁。
  - **报告**：artifacts/deploy-fs15-report-2026-09-04.json（sha256=77d62de3…）。
    sourceManifest 面零触碰。

- ✅ 本轮（F-S15 修复批——普通邮局 nextSeq 竞态修复销账：2026-09-04 用户指令
  「解决并发小竞态」＝**裁定升级**：原「保留观察不消账」由本指令取代为修复
  销账；主审席执行；代码批，触及 lib 2 文件＋tests 1 文件，均不在 sourceManifest
  冻结面内；全量 **45/45** 全绿）：
  - **竞态本体**：appendMessage 的「读最大 seq→+1→追加」无互斥——宿主与各
    bot 为不同进程（bot→bot 路由使他 bot 进程写同一 inbox），并发读到同一
    最大值 → seq 撞号（游标与 replyTo 依赖 seq 唯一单调）。
  - **修复**：新建 **lib/mail-seq-lock.js**（跨进程 lockdir 写锁，语义与
    knowledge acquireIndexLock 同型——K-1 修复既证模式：mkdir 原子获取＋
    owner.json＋短自旋＋超时抛错＋陈旧接管＋保守释放防删他者新锁）；锁路径
    ＝inbox 内 `.seq.lock/`（点前缀目录，不与 *.jsonl 扫描面冲突）。
    appendMessage 的 seq 分配与追加整段入锁（index.js 净 +8 行，总量 4,297
    ＝守住 4,300 行冻结上限）。
  - **测试**（jsonl.test.mjs 新增三段）：锁单测（唯一获取/持锁超时/释放清理；
    陈旧接管；owner 属他进程保守不删）＋**跨进程真并发实测**：4 子进程
    spawn＋Promise.all 各追加 25 条到同一 inbox → **100 条全在、seq 恰为
    1..100，0 丢失 0 撞号**（修复前该场景必然撞号）。
  - **验证**：33 源文件 node --check 全过；全量 45/45。
  - **落档**：PLAN §三 F-S6/F-S15 行（观察项不消账→修复销账，注明裁定升级
    依据）；README §3 F-S15 行同步。
  - **未执行**：部署＋重启（本批改 lib/index.js＋新增 mail-seq-lock.js，
    repo≠deploy——**待点名授权后执行同步与重启链**）；sourceManifest 面
    零触碰（无需重打包）。

- ✅ 本轮（P3 处置批部署＋重启链：2026-09-04 用户授权「授权后续任务」；
  主审席执行；真实面授权写面＝plugins/＋进程重启）：
  - **前置对账**：漂移全树计算＝**6 文件**（3 改：index.js/review-capability/
    review-store；3 缺：review-http-api/parity-manifest/c2-preparation）。
    **附带发现（C2 批遗留缺口，本批补齐）**：部署侧 scripts/evidence-runner.mjs
    依赖 lib/parity-manifest.js，C2 同步了前者却未同步后者（潜在 import
    断链；因部署侧 runner 从不执行而未暴露）。宿主现役 pid 20897＝15:56
    用户手动启动形态（`dsh web` 无 --no-open，五字段行在册——按既定归因
    口径不追查）；四 bot 为 09:42 拉起的 12252 宿主孤儿子进程（PPID=init）。
  - **备份**：3 改写件 → artifacts/archive/deploy-pre-p3disposal/（wx＋
    逐文件 sha256＋manifest）。
  - **同步 6/6**（3 覆盖＋3 新建）：post-hash 逐文件一致；部署侧
    node --check 6/6 通过。
  - **重启链**（P7-5 手动完整链同款）：宿主 API 顺序停四 bot（12307/
    12336/12365/12394 全退）→ SIGTERM 停宿主 20897 → nohup 拉起新宿主
    **95753**（`dsh web --no-open`，HTTP 200）→ API 顺序拉起四 bot
    （lead 95802/研究员 95831/reviewer-lead 95860/reviewer-second 95889，
    父进程均为 95753）。
  - **部署后核验**：五字段注册 **5/5**；**新代码 review API 生产实活**
    （GET /api/bots/review/results → 200 结构化＝lib/review-http-api.js
    抽取件首次生产路径验证）；宿主日志零 error/fail/warn；**repo↔deploy
    全树一致**（lib+scripts 逐文件 cmp）；nonce 启动清扫执行（现存 1 条
    08-29 记录未及 30 天保留期，零删除＝正确）。
  - **真实面变更清点（全部可归因）**：plugins/（授权写面）＋bots.json
    pid/startedAt 更新（API stop/start）＋DSH 各 profile 引导工件
    （cordis.yml/patch/package.json＝DSH 自身插件装载）＋instances.jsonl
    5 新行；无未归因写入。
  - **报告**：artifacts/deploy-p3batch-report-2026-09-04.json（wx，
    sha256=1ebb0d77…）。sourceManifest 9 文件零触碰（无需重打包）。

- ✅ 本轮（质量评审三项 P3「全部处置」批：2026-09-04 用户指令「全部处置」；
  主审席执行；代码批——触及 lib 5 文件＋tests 1 文件，**均不在证据包
  sourceManifest 9 文件冻结面内**，不触发重采集；全量 **45/45** 全绿）：
  - **① bot-health.cjs 14 处容错捕获（处置＝审计确认，零改动）**：逐处研判
    全部适当——诊断脚本对损坏输入要么继续扫描、要么转为 FAIL 项上报（如
    L342/346/479 均为「记录失败继续报告」而非吞错），不适用评审面
    fail-closed 标准；改之反而属无价值搅动。
  - **② 增长面处置（F-RV-11 规划项落地）**：新增
    `cleanupExpiredNonces(dshHome,{now,retentionMs})`（review-capability.js；
    30 天保留期＝NONCE_RETENTION_MS，远超签发侧全部调用点实际 TTL 60s~1h）；
    仅删 nonces/ 下可解析且 consumedAt 过期的 *.json，不可解析/非 JSON/无
    字段一律保留；**安全性依据**＝strictCheck 过期校验先于 nonce 查验，过期
    capability 无论记录在否恒拒（新增复现测试实证）。宿主接线＝apply 启动时
    清扫一次（尽力而为，失败仅告警）。**审计/事件只增不删策略冻结**：
    review-store.js 头部入档（证据完整性优先于体积；归档属人工/授权批次；
    nonce 记录是唯一自动清理例外）。新增测试 2 项（清理矩阵＋过期重放拒）。
  - **③ index.js 单体分层处置**：评审只读/决策 API 区域（186 行，R2-10 面）
    机械抽取至 **lib/review-http-api.js**（202 行；HTTP 三助手＋
    createJobFromDecision 注入式，避免循环依赖；区域文本与原版逐字一致——
    与部署侧原版 diff 实证）；index.js 4,468→**4,287 行**，internals 键与
    handleApi 分发零变化（wiring E2E 全绿佐证）。**分层架构图与增长约束
    冻结**入 index.js 头部：新功能优先独立模块、本文件上限 4,300 行、后续
    候选区域按体量列名。抽取过程一处自误自纠：新模块漏导入 readFileSync
    致 body 端点 500（被 try 转成 fail-closed 响应），首轮测试捕获、补导入
    后 45/45。
  - **验证**：32 源文件 node --check 全过；全量 45/45（两轮：抽取修复前
    44/45→修复后 45/45）。
  - **部署漂移（如实登记）**：lib/index.js repo≠deploy（部署侧为抽取前
    版本）；lib/review-http-api.js 部署侧不存在。**部署＋重启属逐项点名
    授权面**，本批未执行——运行中宿主仍为旧代码（行为等价，无影响）；
    PARITY_MANIFEST 8 文件零漂移（index.js 不在清单内）。
  - **未执行**：部署/重启（待点名）；sourceManifest 面零触碰（无需重打包）。

- ✅ 本轮（最终全量代码质量评审批：2026-09-04 用户指令「进行一次最终的全量
  代码质量评审」；主审席执行；纯评审零改动，只读源码/真实面，冻结件零变化）：
  - **范围与方法**：全部 lib 23 模块（16,554 行）＋scripts 8 件（2,351 行）＋
    tests 45 件（11,201 行/432 用例）。结构盘点→全库缺陷模式扫描→高风险模块
    精读→横切面量化→31 文件 node --check＋全量 45/45 复跑（双绿）。
  - **扫描结论**：零 eval/new Function/child_process 注入面（exec 命中全为
    RegExp.exec）；零 TODO/FIXME/HACK；144 处空捕获逐类研判**全部合理**——
    安全路径一律 fail-closed（capability 校验失败→拒；store 损坏→抛），
    读路径容错均有注释与兜底（pidMatchesBot 放行默认有 ESRCH 兜底论证），
    清理路径尽力而为；ID→路径拼接全链有 safeLogicalId/validId/safeObjectId
    防护（jobs/discussion/results/store 逐一核实）。
  - **精读结论**：store 单写锁＝竞争者选举式接管（takeover 原子 mkdir＋原主
    再核验＋身份不明 fail-closed 拒接管）＋writerEpoch fencing；claimInvocation
    ＝generation/claimEpoch/fenceEpoch 三重绑定＋dead-letter 仅经 retry 路径；
    relay reconcile＝committed 复核/隔离/补投幂等；定时器 8 处全部有清理或
    unref；client.js 纯 createElement 构建（零 innerHTML，无 XSS 注入面）；
    knowledge 索引 lockdir 写锁＋writeFileAtomic；持久写统一 Durable/Atomic/
    O_APPEND+fsync 三助手。
  - **横切面**：依赖面**为零**（deps/devDeps 皆空，宿主注入——零供应链暴露）；
    真实面增长量化 64K（nonces 现 1 文件，增长性观察项已在 F-RV-11 规划内）。
  - **分级结论**：P1＝0、P2＝0；P3/观察 3 项——①bot-health.cjs 14 处容错
    捕获（运维脚本，不适用评审面 fail-closed 标准，可接受）；②audit/events/
    nonces 无轮转机制（当前体量微小，F-RV-11 已留规划项）；③index.js 4,450
    行为最大单体（宿主集成层；分层重构选项 O-5 曾立项未授权，维护性观察）。
    已留档观察项不重述（F-S15 已裁定、raw 85KB 外观项、restartNeeded 前瞻
    死规则）。
  - **总评**：在其风险类别（崩溃一致性＋防篡改评审面）上为**生产级质量**；
    fail-closed 纪律、防护链完整度与负例测试密度（432 用例中约 249 处拒绝
    断言）为本代码库的突出优点。
  - **未执行**：任何代码改动（用户指令为评审；如需处置 P3 项另行点名授权）。

- ✅ 本轮（P3 索引 supersede 补记批：2026-09-04 用户点名「授权」；主审席执行；
  真实面单点授权写入，仅动一行数据，零代码/零重启/冻结件零变化）：
  - **写入内容**：~/.dsh/bots/knowledge/index.jsonl 中 R-2026-007 行补记
    status: valid→**updated**＋**supersededBy: "R-2026-009"**（键序按 006 行
    既有约定：supersededBy 紧随 status；reusedBy 原样保留）。
  - **执行方式**：先备份（artifacts/archive/knowledge-index-pre-supersede/
    index.jsonl，sha256=36eddb1c…）→ 临时文件＋rename 原子改写（属主/权限
    保持 beijong:beijong 644）。
  - **后验**：逐行 diff 仅第 7 行（R-2026-007）变化、其余行逐字节一致；
    全行合法 JSON、行数不变；007 现态 status=updated＋supersededBy=R-2026-009
    ＋reusedBy=["R-2026-008"] 保留。运行时无需重启——knowledge.js 逐次读盘
    （readFileSync 于每次操作路径），host/bot 下次访问即见新态。
  - **状态变化**：P9 批遗留的唯一 P3 就此销账；全部门（P6-4/P6-5/P7-5/
    R-3/P9）关闭、门态 READY，项目工程面零待办。

- ✅ 本轮（P9 执行批＋最终门态判定：2026-09-04 用户指令「**忽略副审进行后续
  任务**」＝豁免副审门态前置、点名推进 R-3 收口与 P9；主审席执行；纯验收/
  复核＋落档，零代码改动、零真实面写入、冻结件零变化）：
  - **R-3 收口**：依据＝主审席验收 17/17（前条目）＋本指令豁免副审门态前置
    → **R-3 关闭**；副审补进转为事后跟进（新发现走新编号正常流程，不追溯
    推翻已生效推进决定，除非用户裁定）。
  - **P9-4 源码证据独立复跑**：0008 终版包 sourceManifest **9/9** 与当前文件
    哈希/字节一致（冻结后零漂移）；包链 0001→0008 **自哈希（文件名内嵌）＋
    basePackage 基链全过**；历史 mail 面七模块（discuss-mail/mail-notice/
    mail-notify/notify-diff/reply-route/events/watcher）今日隔离复跑全绿。
  - **P9-5 上线前专项**：三处现行指针（send_mail 工具描述/团队军规段/
    review-prompt 断言）repo＋部署侧全部 R-2026-009（备份目录保留 007＝
    正常痕迹）；R-2026-009 知识库登记 valid；权限矩阵四 bot 符冻结预期
    （lead RO／研究员 RO／reviewer-lead danger-full-access＝W-RV-1 已归因/
    reviewer-second RO）；user-facing：host 200＋GET /api/bots/review/results
    200 结构化返回；无 migration-pending 残留。
  - **P9-5 发现（P3，待点名授权修复）**：知识库索引 **R-2026-007 未标
    updated/supersededBy=R-2026-009**（007/009 同存 valid）——R-2026-009
    登记时未传 supersedes 字段、registerReport 的机械标记未触发（006→007
    先例有标记）。影响＝索引元数据歧义；无功能误解析（现行指针全部显式
    指向 009）。修复＝真实面 ~/.dsh/bots/knowledge/index.jsonl 单行补记
    （status: valid→updated＋supersededBy），**属真实运行面写入，待用户
    点名授权后执行**。附带观察（低）：迁移目录留 3 审计文件，
    procedure-draft.md/patches.json 系 P7-5 重生成时消费，非缺失。
  - **P9-6**：授权对象 P7-5 系 08-29 用户点名授权（「授权启动」）执行并
    关闭——本切片历史消费，无新动作。
  - **P9-7 机械复核**：parity **8/8 identical**（repo↔deploy 重算）＋部署侧
    node --check **8/8**（逐文件实跑）＋ledger **8 行全 completed** 且账实
    8/8 落位（5 在 artifacts/runs＋3 在 dev-shm-salvage 抢救归档承接）＋
    0007/0008 runId 在册对齐＋五进程存活（host 12252＋四 bot）。
  - **最终门态判定：READY／放行**——P6-4/P6-5/P7-5/R-3/P9 全关；落档：
    PLAN 顶部当前门态行＋新增「门态收口（2026-09-04 P9 执行批＋最终门态
    判定）」段；README §3 两处硬编码状态行同步。
  - **未执行**：索引 supersede 补记（待点名授权）；P9-2/P9-3 副审半边
    （用户豁免，转事后补进）；证据包链零变化（本批无 sourceManifest 面
    改动，不触发重采集）。

- ✅ 本轮（R-3 主审席独立验收批：2026-09-04 用户授权「授权处理」＝处理 R-3
  独立验收（主审席部分）；纯验收核验＋落档，零代码/零部署面/冻结件零变化；
  P9 未触碰）：
  - **验收范围**：10.6 固定清单 F-RV-1～F-RV-17（W-RV-1 系已归因环境项，
    非代码验收面；F-RV-18～26 为后续轮次新开发现、各有独立处置记录，不属
    R-3 原始清单）。
  - **逐项核验结论（17/17 闭合）**：F-RV-17 五字段身份同源签发校验＋迁移
    四例（review-capability.js:193/231/435；测试①~⑤）；F-RV-2 job.heartbeat
    全链自校验（:60；review-jobs.js:422-427；七矩阵）；F-RV-1 心跳 20s<租期
    60s＋失败中止＋跨 tick 守卫＋handled 标记（index.js:227/3319-3372；专项
    测试①~⑤）；F-RV-13 创建边界五重拒绝＋expectedNextStages＋快照全链传播
    （orchestrator.js:334-384；protocol.js:150；admission 矩阵＋四段十环节
    断言）；F-RV-3 生产七段链端到端（wiring:228-302：决策→机械建 job→签发
    →claim→heartbeat→提交→reportFix→复检双席＋快照同源）；F-RV-14 严格
    JSON→十字段 schema→scope 逐项绑定（六矩阵；**坐标登记**：validateFixReport
    现居 lib/review-report.js:45，R3-06 计划坐标为 review-enforcement.js，
    后续受监督轮次模块拆分所致、语义未变）；F-RV-15 registerFinal 发布门＋
    decision 复核 route committed（复现链测试）；F-RV-4/5/6 三处 fail-closed
    与 requeue 默认拒绝（负例三处在列）；F-RV-7 dead-letter 转移矩阵；F-RV-8
    副本瞬时失败可重试不隔离；F-RV-9 appendJsonl O_APPEND 单写 fsync
    （store.js:124-135）；F-RV-10 reconcile 补投自愈×2；F-RV-11 主副审
    evidence capability 对称（evidence.js:422/509）；F-RV-12 relay 模块头
    受控边界冻结文档；F-RV-16 五文档镜像＋无结论证据包（冻结包 a21b6f0d
    conclusion=提交独立验收，09:09 取证已证内容零变化）。
  - **机械复现**：全量 **45/45** 测试文件全绿（隔离子进程、全新 TMPDIR、
    exit 0）。
  - **独立性声明**：R-3 返修本体系编码方 2026-08-28 交付；主审席本会话
    工程批次（O-6 修复面=evidence-plane；C2=repo→deploy 同步）未触碰 R-3
    范围模块——验收对象与验收人分离成立。
  - **门态落档**：PLAN 顶部门态行＋新增「门态更新（2026-09-04 R-3 主审席
    独立验收）」段＋§一 两处快照行加注。**R-3 由「双席验收未发生」更新为
    「主审席通过、待副审补进复核＋用户终判」——按 10.6.2 第 11 步，双方
    交叉复核完成前不收口 R-3；P9 门控不变。**
  - **未执行**：副审补进（用户既定安排）；P9/R-2 历史结论零触碰；证据包
    链零变化（本批无 sourceManifest 面改动，不触发重采集）。

- ✅ 本轮（F-S15 处置裁定落档：2026-09-04 用户裁定「**保留观察不消账**」，
  采纳主审建议；纯登记批，零代码/零部署面）：
  - **裁定内容**：普通邮局 nextSeq 竞态（F-S15）＝普通面已知限制，维持
    PLAN §三既定映射「保留独立观察、不消账」；评审面强一致需求已由独立
    review store 承载；普通面硬化如未来需要另行立项，不并入当前任何批次。
  - **状态变化**：该「用户决策项」就此**裁定闭合**（决策已作出＝维持现
    状）；观察本体按 PLAN 既定口径长期保留，不设销账预期。
  - PLAN 无需修订（裁定与 PLAN §三现行文字一致，无语义变化）。

- ✅ 本轮（09:09 主包「外部恢复归属」挂账取证销账批：2026-09-04 用户指令
  「处理」，主审席执行；纯取证＋登记，零代码/零部署面/冻结件零变化）：
  - **取证结论（决定性）**：artifacts/review-evidence-package.json 的
    mtime＝ctime＝2026-08-30 09:09:25.442，与其内容自带 generatedAt＝
    2026-08-30T01:09:25.447Z（+0800＝09:09:25.447）**毫秒级吻合**（差
    4ms，时钟粒度噪声）；btime＝08-27 22:23（**原地覆写**，非删除重建）；
    同窗口 09:08:24 PLAN-expanded-engineering.md 重建（btime＝mtime）——
    「先定稿文档、再重出终版包」的收官序列；窗口内 repo／~/.dsh／/tmp
    零其它写入；bash_history 无相关命令（程序化写入）；generatedBy＝
    coding-side (encoder)。**判定：该写入＝08-30 晨收官批自身的冻结写
    （编码方按授权流重出终版包 a21b6f0d），不存在冻结后外部改写。原
    「外部恢复」挂账系 3ca8990d 异常叙事纠缠下的误挂账，本轮销账。**
  - **依据链**：内容哈希＝冻结基线 a21b6f0d…（08-30 至今零变化，今日
    再证）；0001 号包为其逐字节冻结副本（双保险）。
  - **附带发现（登记）**：宿主机于 2026-09-04 08:51:42 经历重启（boot
    实证；亦解释 /dev/shm 中 08-30 运行原件已随 tmpfs 清空消失——
    artifacts/archive/dev-shm-salvage/ 归档【0007 archiveBinding 绑定】
    成为唯一存本，抢救性归档价值自此实证）；主包 atime＝09-03 12:16
    （当日用户会话读取痕迹，与 dsh web 手动操作时段吻合）。

- ✅ 本轮（系统拉起＋四源复证批：2026-09-04 用户授权「继续剩余事项」，主审席
  执行；运行运维＋只读复证，零代码改动）：
  - **系统拉起**：`dsh web --no-open` 宿主（pid 12252，http://127.0.0.1:3080，
    五字段行 09:42:26 自写）＋经 host API 顺序拉起四 bot（lead 12307／
    bot-mt0x6r0y 12336／reviewer-lead 12365／reviewer-second 12394，各自
    五字段行 09:42:40~46）；终态五进程全存活、host HTTP 200。
  - **四源复证（bots.json／host API／profile settings.yaml agent-default-model
    ／运行时 spawn）＝ 4/4 一致 PASS**：lead＝niko/gpt-5.6-sol；研究员＝
    deepseek-official/deepseek-v4-flash-vision-exp（effort high）；
    reviewer-lead＝niko/gpt-5.6-sol（effort high）；reviewer-second＝
    opencode-go/deepseek-v4-flash（effort max）。**更正登记**：主审初判
    「reviewer profiles 缺 agent-default-model」系 grep 输出被 head -8 截断
    的误读——两文件自 2026-08-29 14:25 历史手工同步起即含该块（mtime 实证），
    「今日运行时回写」推断不成立；本席今日未修改任何 profile（执行脚本
    检测到块已存在即跳过）。复证前快照备份：
    artifacts/archive/profiles-pre-resync/（两文件，捕获即当时态）。
  - **F-S15 处置建议（待用户裁定）**：普通邮局 nextSeq 竞态＝普通面已知
    限制，评审面已有独立强 store；建议维持 PLAN 既定「保留独立观察、
    不消账」，普通面硬化另行立项，不在本轮扩工程。
  - **未执行**：副审补进（用户指示后续跟进）；09:09 主包外部恢复归属
    确认（用户）；P9/R-3 零触碰。

- ✅ 本轮（C2 统一部署同步批：2026-09-04 用户授权「进行清单任务，授权所有
  方案请求」执行主审既定方案**口径 A**（parity 单源 8 文件）；副审按用户
  指示今日搁置、后续补进；主审席执行）：
  - **前置对账**：8 文件仓库哈希与 c2-prep 预备件逐项一致；/proc 扫描零
    dsh 进程；部署根链逐组件真实目录（防 symlink 别名）。
  - **旧部署件抢救备份**：lib/review-enforcement.js（旧版 12481B）、
    scripts/review-enforcement-probe.cjs（旧版 29325B）→
    artifacts/archive/deploy-pre-c2/（wx 排他＋逐文件指纹＋复制后哈希核验）。
  - **同步 8/8**（2 覆盖＋6 新建：sentinel-provenance／sentinel-safety／
    sentinel-runner／evidence-packager／evidence-runner.mjs／
    evidence-packager.mjs）：逐文件 post-SHA256＝repo、byteLength 一致、
    部署侧 node --check 全过。
  - **真实面核验**：~/.dsh（排除 plugins/＝本批唯一授权写面）前后快照零
    差异（modified/removed/added/addedIrregular 全零）；同步前后零 dsh
    进程；lib/index.js 零触碰（9e044041… 前后一致）→ restartNeeded=false。
  - **报告落盘**：artifacts/c2-sync-report-2026-09-04.json（wx 排他）；
    c2-sync-preparation.json 重出（**parity 漂移归零：identical 8/8**）。
  - **证据闭环**：新 runId 采集（deploymentImpact 机械派生 driftCount=0／
    deploySyncNeeded=false）＋**0008 增量包**（basePackage=0007）。
  - **未执行**：bot/host 重启（用户运行运维裁定，代码面已就绪）；文档
    材料未同步（非 runtime，deploy 侧旧文档保留）；P9/R-3 零触碰。

- ✅ 本轮（AGENTS.md 代理默认指令入档：2026-09-04 用户裁定「agent.md 也增加
  默认信息：有效工作内容留痕——有效内容即对前面工作的总结，含各类编辑变化、
  双席统一意见与共识后的方案」；项目内原无 agent 指令文件（用户级
  ~/.claude/CLAUDE.md 为跨项目通用风格指令，不含项目纪律），故按跨工具标准
  命名**新建根 AGENTS.md**；主审席执行；纯文档批，零代码/零部署面/冻结件
  零变化）：
  - **§1 有效工作内容留痕（强制）**：定义「有效内容＝各类编辑变化＋双席
    统一意见与复核结论＋共识后确认的方案」，实施/确认即须在对应文件编辑
    落档（指针 README §6.2 六类事件位置表；CHANGELOG 条目为底线，合同/
    设计语义变更同步修订对应权威文档）；会话结论不构成项目事实，未落档
    即未发生。
  - **§2 长期边界**：真实面零写入＋dsh web 手动 host 行归因裁定；C2/重启/
    P9 逐项点名授权；冻结件与 sourceManifest 冻结面纪律；证据纪律链。
  - **§3 事实源导航**：CHANGELOG/PLAN 门态段/README/最新序号证据包。
  - README §2 根目录地图同步（5→6，新增 AGENTS.md 行）。

- ✅ 本轮（规范新增批：2026-09-04 用户裁定「dsh web 手动启动直接忽略」＋
  「增加项目规范：任何编码审查一旦实施或方案确认都要在对应文件中编辑落档」，
  主审席执行；纯文档批，零代码改动、零部署面、冻结件零变化）：
  - **README §6.2 落档强制规范入档**：审查实施／合同语义变更／新方案冻结／
    文档增删／证据链产物／用户口头裁定六类事件的强制落档位置表；核心原则＝
    会话结论不构成项目事实，未落档即未发生。本 CHANGELOG 导言同步加注规则
    指针一行。
  - **真实面对账归因裁定入档**：dsh web 手动启动的 instances.jsonl host
    自注册行（五字段合规）＝用户常规操作，评审对账归因「用户手动操作」后
    不再逐次追查；来源未获用户确认的其它真实面差异仍逐项追查，不得援引
    本条作整体豁免。
  - **对账闭合**：2026-09-03 12:07／12:18 两次宿主启动（pid 916／829，
    instances.jsonl 现 a637b9b2…）经用户确认为其手动操作——事件闭合，
    无需追查。

- ✅ 本轮（O-6 代码质量独立审查＋原地修复批：2026-09-04 用户指令「独立审查新
  代码质量和隐患，并进行原地修复」，主审席执行；全量 **45/45** 全绿；触及
  0006 sourceManifest 冻结面 → 按纪律新 runId 重采集＋0007 增量包）：
  - **审查范围**：O-6 批新增/重写代码逐文件精读（evidence-runner/sentinel-
    provenance/evidence-packager 库＋CLI/parity-manifest/c2-preparation/三个
    专项测试），并对 0006 实际产物交叉核验。
  - **P1 修复①（布局绑定断链，0006 实证）**：runner 计算了
    shadowLayoutManifestDigest() 仅打 stdout，payload 从未携带；
    buildProbeRaw 只读无人设置的嵌套键 payload.layoutManifest.digest →
    **0006 raw 的 probe.layoutManifestSha256 恒为 null**（单测用嵌套形状
    全绿、集成面断链）。修复：runner 赋值 opts.layoutManifestDigest；
    buildProbeRaw 平铺键优先、嵌套键兼容；新增平铺键绑定回归测试。
  - **P1 修复②（越界阶段号）**：runner timing 违约路径构造
    ProbeError(…, "6", …)，而 PROBE_PHASES＝["0".."4"]——构造器对越界
    phase 直接抛错，该失败路径会被兜进「未捕获」分支、结构化错误码失真。
    修复：改 phase "4"（证据输出段，语义正确）＋注释说明合法域。
  - **P2 修复③**：snapshotProtectedSurface 的 excluded 字段恒报默认豁免
    清单（自定义 exclusions 时失真）→ 改报实际生效清单＋回归测试。
  - **P3 修复④~⑦**：packager 死旗标 --skip-legacy-check（解析后无任何
    消费点，误导「可跳过核验」）删除；--run/--human/--base-package 等
    必填缺参改 usage 报错（原 undefined 流入 resolve 直接 TypeError）；
    c2-preparation 的 deployDir 改与 runner/探针同口径（DSH_HOME 显式
    覆盖优先）；runDir 创建权限收紧 0o700。
  - **观察项（不改动，如实登记）**：①restartNeeded 派生规则引用
    lib/index.js 而 PARITY_MANIFEST 八文件不含——规则当前为前瞻死规则
    （basis 机械如实输出 false；激活＝扩清单＝C2 范围裁定，属用户决策）；
    ②豁免正则 ^web-.*\.log\.（无 $ 锚）可覆盖 web-* 轮转日志，bot-*.log.N
    若出现将走 fail-closed 误报（可接受方向，不放宽以免污染盲区）；③专项
    测试标题滞后（写「8 文件」、断言实为 9 文件）已顺手修正。
  - **冻结纪律闭环**：修复触及 0006 sourceManifest 9 文件冻结面 → 新
    runId 重采集（evidence profile，artifacts/runs/）＋**0007 增量包**
    （basePackage=0006；archiveBinding 绑定 dev-shm-salvage 归档）；
    c2-sync-preparation.json 按修复后哈希重出（仅预备数据）。C2/部署/
    重启/真实面：未授权、未触碰。

- ✅ 本轮（文档体系整理批：2026-09-04 用户指令「对所有规范方案 md 文件进行整理
  （命名/任务项/记录可读性与导航）」，主审席执行；零代码改动、零部署面影响、
  冻结件哈希零变化）：
  - **新建根 README.md＝文档导航唯一入口**：12 个 md 全集地图（角色/时效）、
    「现在怎么样了」按问题路由表、任务编号解码表（P0/P 切片/F-S/F-P9/F-RV/
    W-RV/R-2·R-3/D 系列/D′-R8/M+C/O 系列/C2/方案 A·B）、新人阅读顺序、
    前向命名约定、README 维护规则（状态细节不入 README，防第三事实源）。
  - **历史文档归位（纯 mv，内容零改动）**：PROJECT_UNDERSTANDING.md、
    GROK-DSH-BOTS-COMPARISON.md → docs/；PROPOSAL-threads-and-clauses.md、
    docs/REWORK-status.md、docs/REWORK-wiring-design.md、docs/REWORK-batch2-
    prompts.md → docs/history/（历史归档只读；门态权威仍在 PLAN 收口段＋
    本台账）。
  - **原位保留（引用冻结，永久勿迁）**：CHANGELOG.md、PLAN-expanded-
    engineering.md（根目录）；docs/TEMP-guidance-optimization-v3.2.1.md
    （SHA fba63f5f…）、docs/CLOSURE-p6-5-qualified-scope.md（SHA 76881a1a…）
    ——路径＋哈希被 c2-prep/证据包绑定；PROPOSAL-knowledge-base.md、
    PLAN-p6-4-real-instance-migration.md——被 lib/index.js、lib/knowledge.js、
    scripts/p6-4-verify.mjs、tests/knowledge.test.mjs、tests/p6-4-verify.test.mjs
    代码注释按名引用，迁移将迫使改注释→变动代码哈希（0006 sourceManifest
    冻结后的最小扰动原则）。
  - **导言路径指针同步**：本文件导言两处指向更新为 docs/ 路径（历史条目
    原文一律不改）。
  - **验证**：全量回归 **45/45** 通过（TMPDIR=/dev/shm node tests/run.mjs）；
    冻结三件复核一致（TEMP=fba63f5f…/CLOSURE=76881a1a…/主包=a21b6f0d…）；
    被移动六文件 byteLength 与移动前逐一相符（纯 mv）；artifacts/ 零触碰。

- ✅ 本轮（O-6 证据收口批：2026-08-30 用户授权「全部执行」按 O-6 v1.0 需求基线
  实施 O-6.1～O-6.13；全量 **45/45** 全绿；node --check 7/7）：
  - **O-6.1 runner 输出根合同**：evidence（默认，仅 <repoRoot>/artifacts/runs）
    /ephemeral（显式根：仓库/DSH_HOME/部署目录外、逐组件 lstat）；负例五项
    （DSH_HOME/部署目录/仓库代码区/symlink 路径/受保护别名）全部拒绝；结构化
    错误 {code,phase,details,exitCode,scenePolicy}（exit 2）；失败先于一切
    产物写入（registry 零 claim、零 probe 执行、既有文件零改动——spawn 级测试）。
  - **O-6.2 registry 初始化责任**：runner 普通路径零建根（requireExistingRealDir
    逐组件 lstat）；唯一建根路径＝独立命令 --init-registry（幂等、禁混用）；
    ledger 独立合同保持（O_APPEND 单写 fsync、拒绝 symlink/目录/危险 hardlink、
    既有可追加），并修复并发创建竞态（wx EEXIST → 复核后回退 O_APPEND）。
  - **O-6.3 真实运行面污染核验**：运行前后对真实 DSH_HOME＋部署目录只读
    SHA-256 快照（PROTECTED_SNAPSHOT_EXCLUSIONS 文档化豁免：epoch/nonces/
    leases/日志/会话面）；新增/删除/修改/新增异常条目全记录；任何失败路径仍
    尽力后置核验；无法核验→INCONCLUSIVE 不宣称 clean；污染→终态 failed。
  - **O-6.4 三方强绑定**：claim 拒绝 null/省略号/截断/大写/非 hex（9 负例）；
    ledger schema /2 终态强制完整绑定（runId/sourceManifestSha256/rawSha256/
    captureManifestSha256/status/completedAt）；packager 七项绑定核验
    （raw↔claim↔ledger↔package，盘面 ledger 直读，零自填）。
  - **O-6.5 执行闭包**：buildExecutionSourceManifest＝runner import 闭包 ∪
    probe CLI 运行时闭包 ∪ packager CLI 闭包＝9 文件（含 lib/parity-manifest.js，
    合同"至少 8、更多须纳入"）；evidenceRunnerHash/probeCliHash/probeRuntime-
    Closure 语义分离；probeScriptHash 降级为历史兼容字段（恒等于 probeCliHash，
    schema 注记）；raw schema /2。
  - **O-6.6 deploymentImpact 取消人工旁路**：结构化事实唯一来源 raw.payload.
    parity（deriveDeploymentImpactFromParity 机械派生 deploySyncNeeded/
    restartNeeded[host 入口规则]/driftCount/checked/identical/hashDiff/
    missingInDeploy/files/diffs）；外部文件仅附加材料（crossVerifyLegacy-
    DeploymentImpact 全字段交叉，不一致拒绝打包）。
  - **O-6.7 正式 provenance 重采集**：raw/capture 持久落盘
    artifacts/runs/<runId>/（evidence profile，非 /dev/shm）；绑定新 runId/
    当前闭包 hash/8 文件 parity/真实面前后核验。
  - **O-6.8 0005 历史快照注记**：0005 为历史冻结快照——其 deploymentImpact
    basis 使用"五处"旧口径、raw.parity 当时为 3 文件检查（2 hash-diff＋1
    missing-3文件口径）；runner parity 清单随后扩展（现为 lib/parity-manifest.js
    单源 8 文件）；0005 不代表当前最终 runner/parity 状态；当前终版由 0006
    表达。未写"0005 已含 8 文件 parity/部署已同步/C2 已执行"。
  - **O-6.9 0006**：新 runId＋持久 raw/capture＋archiveBinding（绑定
    dev-shm-salvage 归档 manifest d6c532d7… 与 8 文件逐项核验）＋8 文件完整
    parity＋basePackage=0005（293c6783…）＋wx 版本化写出（文件名内嵌自身 SHA）。
  - **O-6.10 parity 清单单源化**：lib/parity-manifest.js（冻结/路径安全校验/
    hash 可核验）；runner 与 c2-preparation 同源派生；c2-preparation loadMethod
    三分类修正（host 静态／CLI 按次／文档证据材料——docs/CHANGELOG/package.json
    不再误标 runtime）。
  - **O-6.11 测试**：新增 tests/evidence-runner-contract.test.mjs（17 项）；
    扩展 sentinel-provenance（22 项：claim 负例 9/闭包 9 文件/ledger /2 绑定）
    与 evidence-packager（14 项：派生/交叉核验/七项绑定/篡改归档检出）。
  - **O-6.12/6.13 边界**：C2/部署/重启未执行（部署状态如实记录：2 hash-diff＋
    6 missing＝8 处漂移，identical=0）；0006 生成后其 sourceManifest 9 文件冻结，
    再改须新 runId 重采集重打包。

- ✅ 本轮（O-5 可选架构分层批：2026-08-30 编码方按 v3.2.1 合同 §8 执行，
  payload 合同先行冻结、重构前后行为不变验收通过；全量 **44/44** 全绿）：
  - **分层落地（§8 建议层次）**：
    `lib/sentinel-safety.js`（路径、输出与安全 helper：ProbeError/错误码/phase/
    scenePolicy、canonicalize/双口径重叠/逐组件 lstat、validateOutputDestination、
    emitEvidence）；
    `lib/sentinel-runner.js`（Phase 0～4 管线＋结构化错误＋模式化 scenePolicy：
    executeRealSentinel 守卫链①-⑨/executeShadow 顺序冻结；失败以 ProbeError
    抛出、退出与渲染交 CLI；emit 以回调注入，shadow emit 先于删场由本层保证）；
    `lib/review-enforcement.js`（布局 manifest＋纯 probe API；安全面改为对
    sentinel-safety 再导出＋内部 import 绑定，既有导入面零破坏）；
    `scripts/review-enforcement-probe.cjs`（薄 CLI：parse→dispatch→emit→exit）。
  - **payload 合同冻结（§8 前置）**：两模式 payload 字段名/类型/失败码/phase/
    invariants/treeDiff/clean/cleanSemantics/scenePolicy 全部冻结；重构前后
    before/after payload 对拍——shadow 与 real-sentinel 双模式归一化后逐字节
    一致（允许差异仅：时间/临时路径/pid/ns/ino 运行时刻量；一处描述字符串
    措辞漂移在自审中抓出并回滚为原文）。
  - **调用图静态检查升级**：扫描面从脚本单文件扩展至 runner 库
    executeRealSentinel 函数体（不得触达覆盖型 prepare；执行面恒
    runShadowProbeCells）＋薄 CLI（不直接触达 suite）。
  - **自审修复**：`export {} from` 不产生本地绑定导致 prepareShadowTargets 的
    ProbeError 引用悬空（矩阵/契约测试当场拦截）——补 import 绑定；`.cjs` 误用
    import.meta.url——回改 `__dirname`；runner Phase 3 失败分支 emit 未包裹
    try（auto-clean 下会泄漏现场）——补包裹＋scenePolicy 清理。
  - **测试适配**：manifest 静态断言迁移至 runner 库层；provenance 源清单随
    分层演进为四文件闭包（CLI→runner/safety/enforcement 的静态/动态 import
    闭包，策略 A 自动解析）。
  - **包链**：0005 由 evidence-runner＋evidence-packager 全链产出
    （basePackage=0004，4f496e6d…）。
  - **勘误（如实标注）**：0005 包 deploymentImpact.basis 写"漂移扩大至 5 处"
    系 runner parity 清单当时仅覆盖 3 文件所致的**低估**——全量实证为 **8 处**
    （2 hash-diff：review-enforcement.js/probe.cjs；6 missing-in-deploy：
    sentinel-provenance/sentinel-safety/sentinel-runner/evidence-packager/
    evidence-runner.mjs/evidence-packager.mjs）。runner parity 清单已扩至
    全部 8 文件；包 wx 不可改，以本勘误为准。

- ✅ 本轮（O-4a＋O-4b provenance/证据包 v2 批：2026-08-30 编码方按 v3.2.1 合同
  §6/§6.1/§7 执行；全量 **44/44** 全绿）：
  - **O-4a provenance（lib/sentinel-provenance.js，策略 A）**：静态解析
    import/require＋字符串字面量动态 import（相对路径按 Node 规则；node:/与
    node_modules 排除；非字面量动态 import 或不可解析本地依赖→provenance
    validation failure）。raw schema p6-5-probe-raw/1：runId(UUID)/probe.
    sourceManifest[]（逐文件 sha256+byteLength）/sourceManifestSha256/兼容摘要
    probeScriptHash+libSha256/layoutManifestSha256/argv/nodeVersion/timing
    （runStartedAt≤probeObservedAt≤payloadGeneratedAt≤artifactWriteStartedAt；
    artifactWriteCompletedAt 由 capture manifest 持有，raw 不自记）。三层绑定
    raw→capture-manifest→package；篡改检出五例（raw/manifest/script/lib 各改
    一字节＋runId 重复）全部检出。
  - **O-4a run-registry（§6.1）**：artifacts/run-registry/ 独立
    approvedEvidenceControlRoot；claim=<runId>.claim（O_CREAT|O_EXCL，成功即
    永久占用，不删不放不复用；部分写入→invalid tombstone 保留）；ledger
    run-registry.jsonl（既有可追加，拒绝 symlink/目录/危险 hardlink nlink>1，
    O_APPEND 单写＋fsync）；校验器（claim↔ledger 交叉：无终态→running/
    abandoned 不得判成功；损坏尾行恰一显式 incomplete；中间损坏校验失败；
    runId 重复/无 claim 记录→失败）。真并发验收：同 runId×6 恰一成功；
    不同 runId×6 并发追加记录数正确零撕裂。
  - **O-4b evidence-runner（scripts/evidence-runner.mjs）**：隔离执行全量回归
    ＋并发模块＋shadow probe＋repo↔deploy parity（只读比对，如实呈现 3 处
    漂移＝C2-1 同步需求）→ raw（策略 A 源清单绑定 runner+lib 依赖）＋capture
    manifest（wx 落盘）＋registry 终态追加；ledger 失败→registry-incomplete
    不虚报（exit 1）。runner 不打包。
  - **O-4b evidence-packager v2（lib/evidence-packager.js＋scripts/
    evidence-packager.mjs）**：只读消费产物、校验 hash/格式/来源；四禁机械
    强制（不改 raw＝输入零写入；不修补缺失字段；provenance 不完整即失败；
    humanReviewNotes 不入 executionEvidence）；人工字段白名单四项；结构化必填
    fullRegression/concurrencyStress/deploymentImpact/probe verdict/treeDiff；
    deploymentImpact{deploySyncNeeded,restartNeeded,basis[],manualOverride?}
    （override 须 value/reason/authorizedBy/timestamp）；E4 摘要只引用已存在
    产物（逐文件 hash 账实核验）；版本化写出 wx（旧包不得被覆盖）＋basePackage
    完整 64hex＋可读取路径＋hash 核对（省略号/截断/缺文件拒绝）。
  - **测试**：新增 tests/sentinel-provenance.test.mjs（18 项）＋
    tests/evidence-packager.test.mjs（10 项）。
  - **包链**：0004 由 runner+packager 全链产出（basePackage=0003，07992681…）。

- ✅ 本轮（O-3 manifest＋职责收敛批：2026-08-30 编码方按 v3.2.1 合同 §5 执行；
  C2/重启/正式 provenance 重采集未动；全量 **42/42** 全绿）：
  - **SHADOW_LAYOUT_MANIFEST 唯一布局来源**（lib/review-enforcement.js）：19 条目
    （10 目录＋9 文件）数组和逐元素双层 freeze；path 安全校验器
    validateLayoutManifest（唯一/相对 POSIX/非绝对/无 .. /非空段/file 必带
    content＋fileMode/directory 不得带 content）——派生侧同样调用，不因来源
    内部而豁免（脚本 Phase 0 先于一切写入校验，非法即 fail closed）。
  - **三方同源派生**：lib prepareShadowTargets（overwrite-shadow/none 两模式）
    与 real-sentinel 脚本（layoutDirNames/syntheticPrefixes/layoutFiles）全部
    由 manifest 派生，脚本**零第二份布局字面量**（静态扫描测试固定）；manifest
    digest（稳定 canonical JSON：键递归排序＋undefined 值键省略）入 payload。
  - **兼容字段（§5）**：clean 保留但 cleanSemantics="legacy probe-residue check
    only"；强断言移至 treeIntegrity——real-sentinel {value, source=
    "snapshotTree/treeDiff/layoutIntegrity"}，shadow 如实标注无全树快照
    （value=null，不虚增强断言）。
  - **I1～I4/E1～E5**：SENTINEL_WRITE_INVARIANTS（I1 写入不可逃逸/I2 既有不可
    覆盖/I3 输出不入真实面/I4 终树仅批准新增，映射 guardChain 条目）入
    real-sentinel payload；EVIDENCE_INVARIANTS（E1～E5）独立导出供 O-4 消费，
    静态测试断言不混入 guardChain。
  - **测试**：新增 tests/sentinel-layout-manifest.test.mjs（10 项，含 digest 与
    测试内独立 canonical 实现对拍/JSON 往返稳定/键序稳定/变更敏感）。
  - **包链**：0003（basePackage=0002，09feb530…）。

- ✅ 本轮（O-1＋O-2 收敛合同批：2026-08-30 用户指令「自行逐项进行」按
  docs/TEMP-guidance-optimization-v3.2.1.md（SHA fba63f5f…699a 核验一致）固定顺序
  执行；由**编码方**执行；C2 部署同步/重启/正式 provenance 重采集**未动**（另授权）；
  全量 **41/41** 全绿）：
  - **O-1（纯文档收口注记）**：docs/CLOSURE-p6-5-qualified-scope.md——P6-5 关闭
    限定为 real-sentinel 狭义七项＋五项排除＋证据包定位（声明包/手工字段如实
    标注）＋时间顺序不变量＋版本化包链策略。基线核验：合同冻结基线
    a21b6f0d… **在盘**且即当前 artifacts/review-evidence-package.json（lead 席
    收官终版，外部演进按 W-RV-1 记录）；归档 0001-a21b6f0d（逐字节一致）。
  - **O-2a（输出 profile）**：--out-profile evidence（默认，仅 <repoRoot>/artifacts）
    /ephemeral（显式根：保护区/仓库外、逐组件 lstat、根内落 out）；/tmp 不自动
    合法；无 --out 走 stdout 零目录零文件。
  - **O-2b（shadow 完整输出合同）**：shadow 与 real-sentinel 同一 --out 合同
    （lib validateOutputDestination 单源）——父目录不自动创建（缺失→
    PRECONDITION_FAILED；symlink/普通文件/不可读→OUTPUT_CONTRACT_VIOLATION）、
    逐组件 lstat、最终组件排他（wx，拒绝 hardlink/覆盖写）、保护区/shadowRoot
    拒绝（canonical＋lexical 双口径）；shadow --out 位于 shadowRoot 内三种情形
    （直接/已有子目录/别名）均 exit 2。
  - **O-2c（错误对象/Phase/scenePolicy）**：ProbeError 五字段 {code,phase,
    details,exitCode,scenePolicy}；六错误码二值 exit（2＝合同违规/前置失败，
    1＝INCONCLUSIVE）；Phase 0～4 语义落地；real-sentinel 恒 preserve-for-caller、
    shadow 默认 auto-clean＋显式 --preserve-failure-scene；shadow 顺序冻结
    （创建→校验 out→探针→payload→emit→删场；失败现场保留即证明 emit 先于删场）。
  - **O-2c（prepare API）**：prepareShadowTargets/runShadowProbeSuite 增
    prepare:"overwrite-shadow"|"none"（默认兼容不变；none 零创建/覆盖/删除，
    缺失/类型错误→PRECONDITION_FAILED）；real-sentinel 只接受
    runShadowProbeCells——调用图静态检查（新测试源码扫描）＋专项测试双重保证。
  - **测试**：新增 tests/sentinel-output-contract.test.mjs（25 项）；适配
    tests/p6-5-sentinel-guards.test.mjs（26 项，ephemeral 语义＋结构化错误断言；
    并修复其既有嵌套结构缺陷——hardlink 用例曾嵌套于 symlink 用例回调内未独立
    注册）。
  - **部署判定**：lib/review-enforcement.js 在 host 静态导入图内
    （lib/index.js 只用 validateWorkspaceTriple，行为零变化、新增顶层代码纯常量
    无副作用）→ restartNeeded=false；repo↔deploy 平价破坏 → deploySyncNeeded=
    true（C2-1 范围，另授权）。
  - **包链**：0002 版本化包（basePackage=a21b6f0d… 完整 SHA＋路径 0001 归档）。

- ✅ 本轮（阶段性收尾·三门关闭宣告：2026-08-29 用户确认「可以进行阶段性收尾」；
  依据第八轮双席会签回执——主审/副审对 M＋C 收口均无技术异议，P6-5/P6-4 同意
  关闭会签、P7-5 同意随本轮收口；本条目为纯台账落档，零代码变更）：
  - **P6-5 正式关闭**：第三～七轮共七处缺口（子路径 symlink 逃逸／既有文件事后
    覆盖／执行面二次覆盖／保护根别名／--out 快照后写入／dangling 与父目录
    symlink／hardlink 输出覆盖）全部闭合，均具翻转实证与常驻负例（p6-5 模块
    26 例＋matrix lib 面 1 例）；十重守卫链＋方案 A 判定满足（4665 文件唯一
    epoch.json 白名单差异、白名单外 0）；如实留档限定：8 格 ALLOWED＝「未受阻」
    观测（矩阵格 pending）、用户态 TOCTOU 残余风险（无 openat2 不可绝对消除）、
    --out 排他合同下重跑须先清旧输出。
  - **P6-4 正式关闭**：聚合器 ok 硬编码修复（spawn 全链负/正例）＋结构化只读
    证据（issueTestExecuted=false 口径如实，不冒充 issue-test 全链）；部署版
    负例黑盒复放通过。
  - **P7-5 正式关闭**：第八轮 C 项点名同步后四文件 repo↔deploy 平价 4/4
    （sha256＋byteLength）＋部署侧 node --check＋部署版 real-sentinel 正例/
    hardlink 负例/p6-4 聚合器负例黑盒复放通过；无需重启（代码加载语义成立）；
    历史登记/迁移/重启执行事实以既有证据链为据。
  - **冻结基线**：收口前 `b3bd65d0…`（M＋C 批次）；本收尾条目＋PLAN 门态收口
    段落档后按冻结纪律重出收尾包（见包内 generationCommand）。
  - **D′-R8-03 文档归一补全（副审终验意见）**：PLAN 第一节现行块「新规程：未登记
    （P7-5 挂门）」→「已按 P7-5 既有证据链登记（R-2026-009）；四文件平价已恢复，
    P7-5 已关闭」；同块逐行复核——「编码方实例：未创建」经 bots.json 核验为当前真
    （无编码方实例）保留；「35/35」为 R-3 时代自测事实（现行全量 40/40，见证据包）。
    **方法更正**：前轮「零残留」结论基于过窄字面检索（仅查被点名短语）——本轮起
    残留检查按词元级全表（挂门/未登记/未部署/待双席/均未执行/等待独立验收）扫全块。
  - **D′-R8-02 文档归一补全（副审终验意见，方案 B）**：PLAN 第一节「准确状态与
    范围」现行状态块两行旧门态更新——「继续挂门」→「P6-4/P6-5/P7-5 已关闭＋P9
    门控」；「部署/重启/真实迁移均未执行」→「P7-5 已执行并恢复四文件平价＋收尾
    批次零代码/零配置/零重启（宿主机重启为环境事件）」；收尾包再次重出。
  - **D′-R8-01 文档归一补全（副审终验意见，方案 B）**：PLAN 顶部「当前门态」行
    更新为收口态（三门关闭＋R-3 待验收＋P9 点名启动）；PLAN「门态更新」段标注
    历史快照（「三项待双席复核」已被门态收口段取代）；docs/REWORK-status.md 顶部
    新增收口当前门态段，旧「继续挂门/待双席复核」节降为历史快照；收尾包重出并
    纳入该文件（保持包列文件零改动纪律）。
  - **挂账移交（下一阶段）**：四源重建、F-S15 处置（用户决策项）；部署平价
    结构化字段入证据包 schema（改进项，副审第八轮建议）；P9 仅点名指令启动；
    R-3 NOT READY / BLOCKED 维持；F-RV 编号 1～26 冻结、下一号 F-RV-27 备用。

- ✅ 本轮（第八轮·批次 M＋C 收口：2026-08-29 用户授权「全部授权」（M＝证据元数据
  归一；C＝四文件部署同步，**已点名执行**）；由**主审席**执行）：
  - **M｜证据元数据归一（双席确认的三项瑕疵＋历史快照标注）**：
    artifacts/p6-5-sentinel-evidence.json——slice/generatedBy 更正为「第七轮正例
    数据＋第八轮元数据归一」并如实标注执行方（第七轮技术修补由用户转达交付，
    主审席该轮独立核验通过、非执行方）；C 项 residualRisk 由「两脚本」更正为
    **四文件**实况；「五代基线五处缺口」条目标注**历史快照**（留痕不删，现态见
    首条「截至第七轮七处缺口均已闭合」）；新增 operationalNotes（--out 排他合同
    下重跑须先清理旧证据输出——不得回退覆盖写）；PLAN P6-5 小注同步该操作注意；
    CHANGELOG 第七轮条目补执行方/授权依据注。
  - **C｜四文件部署同步（点名授权）**：scripts/review-enforcement-probe.cjs、
    scripts/p6-4-verify.mjs、scripts/generate-evidence-package.mjs、
    lib/review-enforcement.js → ~/.dsh/plugins/dsh-bots/。**平价复验：sha256＋
    byteLength 4/4 一致；部署侧 node --check 全过**。无需重启：运行中五进程持有
    内存态模块，四个文件为 CLI 按次加载；runShadowProbeCells 为纯新增 API、
    runShadowProbeSuite 语义不变（向后兼容）。同步前部署旧版 sha 在案可回滚
    （6b015ce2…/558b7bb5…/6827d7d3…/37050fbd…）。
  - **收口态**：repo↔deploy 平价恢复（四文件零差）；证据包重出后
    deploymentOrRestartNeeded=false；P6-5/P6-4 技术面双席均已正向复核，待会签
    关闭；P9 未启动；R-3 维持。

- ✅ 本轮（第七轮原地修补：2026-08-29，针对副审复现的 dangling `--out` symlink 越界；仅修复仓库代码/测试/证据，C 项部署同步未点名不执行。
  **补注（第八轮）**：本条目由用户转达的第七轮交付执行——主审席该轮仅独立核验、
  非执行方；双席独立复核均通过；授权依据以用户转达件为准；元数据归一见第八轮条目）：
  - **evidence-out-boundary 补强**：real-sentinel 对 `--out` 从 lexical/canonical 重叠检查扩展为逐组件 `lstat` 检查；任何已存在的 symlink（含最终 dangling symlink、父目录 symlink）或不可读/非目录祖先均在布局写入和证据落盘前 fail closed；最终组件还必须不存在并以 `wx` 排他落盘，防 hardlink/竞争创建覆盖真实 inode。
  - **负例常驻化**：新增 dangling final-component symlink、symlink parent、hardlink-to-protected-inode 三个 spawn 全链负例；断言 exit 2、目标零创建/零覆盖、sentinel synthetic 布局零新增；最终 output 组件既存时统一排他拒绝。
  - **口径**：既有第六轮保护根 canonical 双轨、sentinel 根内 `--out`、普通真实 DSH_HOME `--out` 负例保持；输出路径逐组件无 symlink、最终组件不存在并采用 `wx`，输出检查与写入间的用户态 TOCTOU 仍不作绝对消除保证并继续由 residual risk 记录。
  - **边界**：未部署、未重启、未登记、未修改真实运行面；C 项继续挂起。

- ✅ 本轮（第六轮返修·原地修正：2026-08-29 用户授权「授权」（副审第六轮两项边界
  阻断：保护根 canonical 口径不一致＋--out 写面未入契约；C 项＝部署同步未点名，
  **不执行**）；由**主审席**执行（审查角色临时切换执行角色，仅限本批））：
  - **阻断①｜保护根 canonical 双口径（DSH_HOME symlink 别名不可绕过）**：副审
    复现——DSH_HOME 经 symlink 别名指向 sentinel 所在子树父目录时，守卫 ④ 比较
    canonical sentinelRoot vs lexical dshHome，包含关系漏判 → exit 0 且布局九文件
    写入真实（别名）子树（主审独立复现一致）。修复：新增 canonicalize 助手
    （realpath 既有祖先＋lexical 尾段逐级回退），DSH_HOME/部署目录/仓库根与
    sentinel 根**同一 canonical 口径**比较，且 canonical＋lexical 双口径任一重叠
    即拒（第五轮 canonical 化只做了一半——sentinel 根做了、保护根没做，本轮补齐）。
    **翻转实证**：同场景修复前 exit 0＋布局写入 → 修复后 exit 2（canonical 识破
    别名）＋子树零新增。
  - **阻断②｜--out 证据输出边界（脚本自身写路径入契约）**：副审复现——--out
    指向 sentinel 根内时，结果文件在 treeAfter/treeDiff 完成后写入，payload 却
    报 addedUnexpected=[]（自己绕过自己的全树证明；主审独立复现一致）；且 emit()
    对 out 目标零校验。修复：新增守卫 evidence-out-boundary（先于一切写入）——
    out 不得位于 sentinel 根内（防快照后写入绕过 treeDiff、避免污染 probe-caused
    diff=0 语义），不得落入真实运行面（canonical DSH_HOME/部署目录）；合法目的
    地＝副本外证据路径（本仓 artifacts/ 等）。**翻转实证**：同场景修复前 exit 0＋
    根内多出未记账文件 → 修复后 exit 2＋零写入＋无结果文件。
  - **守卫链增至十重**：guardChain 增 evidence-out-boundary；writeContract 增
    protectedRootComparison/evidenceOutputBoundary；头注/note 同步。
  - **测试**：tests/p6-5-sentinel-guards.test.mjs 增三负例（模块 23 例全绿）：
    DSH_HOME 别名＋sentinel 位于真实子树 → exit 2＋子树零新增；--out 在 sentinel
    根内 → exit 2＋根内零新增；--out 指向真实 DSH_HOME → exit 2＋零写入。正例
    守卫链断言更新为十项。
  - **制度化**：保护性比较两侧必须同一 canonical 口径；写面清单必须枚举脚本全部
    写路径（探针写＋脚本自写：--out/回滚清理），任何一条无边界校验即缺陷。
  - **P6-5 重跑（十重守卫下正例）**：方案 A 全部满足（4665/4665、唯一 epoch.json、
    白名单外 0、五进程全等、8 格、layoutAllUnchanged=true）。
  - **边界**：未部署、未重启、未登记、未改真实配置；deploy 四文件 sha 不变
    （C 挂起）；P9 未启动；R-3 维持。

- ✅ 本轮（第五轮返修·原地修正：2026-08-29 用户授权「授权」（副审第五轮决定性阻断
  「确定性二次覆盖」+ 最低返修七条；C 项＝脚本部署同步未点名，**不执行**）；由**主审席**
  执行（审查角色临时切换执行角色，仅限本批））：
  - **A2′｜执行面拆分（结构性消灭二次覆盖）**：副审第五轮复现——real-sentinel 的
    guarded wx 创建九个布局文件后，runShadowProbeSuite 内部仍无条件调覆盖型
    prepareShadowTargets 把九文件重写一遍（同内容亦构成二次覆盖，treeDiff 不可见；
    主审独立复现：植入 SENTINEL-KEEP → suite 后变 {}；bigint mtimeNs 实测移动）。
    修复＝**lib API 拆分**：新增 `runShadowProbeCells`（纯执行面——shadowTargetsOf
    逐 key probeDenyPath，零 prepare 零覆盖写）；`runShadowProbeSuite` 语义不变
    （prepare+cells，**仅限 shadow 模式**，JSDoc 标注禁用于 real-sentinel）。脚本
    real-sentinel 执行面改调 cells——排他创建后**不存在任何覆盖型写路径**（结构保证）。
  - **A2″｜布局完整性复核（同内容二次覆盖检测层）**：guardedCreateFile 每次 wx 创建后
    记 bigint ino+mtimeNs 基线；执行面跑完后逐文件复核——任何移动（含同内容覆盖，
    hash 不可见）→ exit 2；payload 新增 `layoutIntegrity`（九文件基线/复核/allUnchanged
    与 method 说明），writeContract 新增 `suiteExecution`/`layoutIntegrityRecheck`。
  - **测试**：tests/review-enforcement-matrix.test.mjs 新增 lib 面单例——预置布局＋
    哨兵内容 SENTINEL-KEEP → runShadowProbeCells 后内容保持且 bigint mtimeNs/ino
    不动；对照旧 API runShadowProbeSuite 会替换（文档化拆分理由）。
    tests/p6-5-sentinel-guards.test.mjs 正例强化——断言 layoutIntegrity.allUnchanged=
    true、九文件、mtimeNsAtCreation===mtimeNsAfterExecution、suiteExecution 含
    「零覆盖写」（21 例全绿）。
  - **上批口径更正**：第四轮交付中「runShadowProbeSuite 内部第二次 prepare 仅 probe
    自有文件、不违契约」的豁免**作废**——该豁免系自行发明、未写入契约文本；「覆盖从未
    发生」在旧代码正例路径上不成立（同内容重写）。制度化：契约文本不得含未声明豁免；
    任何「X 不会被 Y」断言必须有能检出 Y 的测试或结构保证。
  - **P6-5 重跑（新执行面正例）**：方案 A 全部满足——4665/4665、唯一差异 epoch.json
    （白名单）、白名单外 0；五进程前后全等；8 格 ALLOWED；layoutIntegrity 九文件
    allUnchanged=true 入证。
  - **边界**：未部署、未重启、未登记、未改真实配置；instances.jsonl/bots.json 与基线
    一致；deploy 三脚本 sha 不变（C 挂起）；P9 未启动；R-3 维持。

- ✅ 本轮（第四轮返修·原地修正：2026-08-29 用户授权「授权」（副审第四轮两项阻断
  A1/A2 + 测试 A3 + 文档 D'；C 项＝脚本部署同步未点名，**不执行**）；由**主审席**
  执行（审查角色临时切换执行角色，仅限本批））：
  - **A1｜布局空前置（既有文件「覆盖从未发生」，修副审复现项）**：副审第四轮
    复现——预置 dsh-home/bots/bots.json=PROTECTED-CONTENT，prepareShadowTargets
    的 writeFileSync 无条件覆盖为 {}（sha 44136fa3…，主审独立复现哈希逐位一致），
    treeDiff 只是事后报告。新增守卫 ⑦ layout-empty-precondition：五个 synthetic
    布局目录必须不存在或为空（存在但非真实目录同样拒）；非空 → 任何写入之前
    exit 2。**行为翻转实证**：同场景修复前 exit 2 且内容被覆盖 → 修复后 exit 2
    且内容逐字节不变（e04c5f36…）+ 无 result 文件 + 副本零新增。
  - **A2｜排他创建契约（逐写边界 + TOCTOU 收敛 + 表述降级）**：real-sentinel
    初始布局不再调用 lib prepareShadowTargets（其覆盖语义留在 shadow 模式，lib
    零改动），改为守卫 ⑧ guarded-exclusive-create：逐级 lstat 校验祖先链（每级
    真实目录非 symlink）→ 目标必须 lstat ENOENT → writeFileSync flag:"wx" 排他
    创建（最终组件为 symlink 时 O_CREAT|O_EXCL 同样 EEXIST 拒）→ 任何失败回滚
    本轮已创建路径 + exit 2；创建后立即全树重走（检出创建期间祖先换链）。
    runShadowProbeSuite 内部第二次 prepareShadowTargets 的写面经空前置保证仅含
    本轮 probe 自有文件，不违「既有文件不可覆盖」契约。**表述如实降级**：脚本
    note/证据/PLAN 删除「机械保证只在副本内运行」绝对声明，改为「空前置＋排他
    创建＋前后全树校验；残余窗口＝单次同步写入期间祖先换链（Node 用户态无
    openat2 不可绝对消除），发生后由后置校验 fail-closed 检出」。
  - **A3｜常驻测试扩至 20 例**（tests/p6-5-sentinel-guards.test.mjs 全绿）：五个
    布局目录逐一预置特征文件（bots.json/allowed.txt/index.js/settings.yaml/
    probe.txt）→ exit 2 + 内容逐字节不变 + hash 不变 + 无 result 文件 + 布局未
    建；深层杂散文件 → 拒且不变；布局路径为普通文件 → 拒；正例强化——marker 与
    real-copy 逐字节比对 + 九重守卫链全录 + writeContract 字段断言。竞态注入
    （祖先换链）黑盒不可稳定注入（副审亦未注入），以预置负例＋排他创建＋创建
    后重走覆盖并如实声明。
  - **D'｜文档**：PLAN 方案 A 小注更新（九重守卫链：第三轮第六重＋本轮第七/八
    重 + 残余窗口如实表述）；PLAN 顶部第 13 行补「历史快照」小注（2026-08-28
    时点表述，现态以门态更新段 + CHANGELOG 最新条目为唯一事实源）——副审第五
    节降级项一并收口。
  - **P6-5 重跑（新守卫下正例）**：方案 A 全部满足——真实面 4665/4665、唯一差异
    epoch.json（白名单归因）、白名单外 0；五进程前后全等；8 格 ALLOWED；
    guardChain 九项 + writeContract 全录（见 artifacts/p6-5-sentinel-evidence.json）。
  - **边界**：未部署、未重启、未登记、未改真实配置、未写 instances.jsonl/bots.json
    /capability secret（P6-4 只读证据未动）；deploy 三脚本 sha 不变（C 项挂起）；
    P9 未启动；R-3 NOT READY / BLOCKED 维持。

- ✅ 本轮（第三轮返修·原地修正：2026-08-29 用户授权「授权」（副审第三轮三项阻断的
  补修批次 A/B/D + PLAN 小注；C 项＝两脚本部署同步未点名，**不执行**）；由**主审席**
  执行（审查角色临时切换执行角色，仅限本批））：
  - **A｜子路径 symlink 逃逸修复（scripts/review-enforcement-probe.cjs）**：原守卫只
    覆盖根路径自身，五个 synthetic 布局目录可为 symlink 指向副本外（副审实测 9 外部
    文件写入）。补三层：①守卫 ⑤＝全树递归 lstat 预检（readdir+Dirent 不跟随链接；
    marker 自身、五目录、任意深层 symlink/特殊条目一律 fail-closed exit 2，且发生在
    prepareShadowTargets 之前→零写入）②快照层 fail-closed（snapshotTree 遇非常规
    条目由「记为 non-regular 放行」改为直接 exit 2，双份快照同口径）③守卫链与文档
    同步（guardChain 增 no-subpath-symlink，链内计数六重前置+快照；PLAN 方案 A 小注
    更新为七重链）。**新增常驻测试 tests/p6-5-sentinel-guards.test.mjs（12 例）**：
    五子路径负例逐一断言 exit 2 + 外部目标零新增 + 无 result 文件 + 副本零写入；
    marker-symlink / 深层嵌套 symlink / 根 symlink / 缺 env / 缺 marker / 真实
    DSH_HOME 拒绝；正例（五目录全真实）exit 0 + clean + 全部新增落 synthetic 前缀。
  - **B｜p6-4-verify 聚合器修复（scripts/p6-4-verify.mjs）**：--issue-test 循环曾
    硬编码 `ok:true`，签发明细 ok:false 被总体 PASS 吞掉（副审实测 0644 secret →
    明细失败但 exit 0）。改为聚合取断言自身 `check.ok`；tests/p6-4-verify.test.mjs
    增 spawn 全链负/正例：0644 secret → exit 1 + 结论 FAIL + 明细入结构化证据；
    0600 secret → exit 0 + PASS（只读面 + 签发断言）（正例不回退）。真实 home
    --issue-test 重跑恢复可信结论（见结构化证据重出）。
  - **D｜证据包如实申报**：生成器新增 `--deployment-needed true|false`（修复仅入库
    未同步部署副本时必须报 true，不得恒 false）；本批报 **true**（两脚本修复后
    deploy 副本 sha 仍为旧版——C 项挂起待用户点名，包内记录两侧 sha 实测值）。
  - **前条目口径更正**：上批「修复涉及的 scripts 两文件不进测试面」不再成立——本批
    起两脚本进入测试面（spawn 全链常驻测试），全量回归模块数 39→40。
  - **边界**：未部署、未重启、未登记、未改真实配置、未写真实 instances.jsonl/
    bots.json/capability secret（P6-4 --issue-test 台账/槽写＝已授权验收工件，同前批
    口径）；P9 未启动；R-3 NOT READY / BLOCKED 维持。

- ✅ 本轮（P6-5 返修·原地修正：2026-08-29 用户授权「任务量不大原地修正」（双席归一
  五项授权边界一次性裁定：规格方案 A / 守卫补修 / 结构化证据 / 文档归一 / 包重出）；
  由**主审席**执行（审查角色临时切换执行角色，仅限本批））：
  - **real-sentinel 守卫强化（六重链，修副审阻断项「symlink 边界」）**：③根路径
    realpath 一致性（resolve≠realpath 即拒——symlink 根 fail closed）④真实运行面
    双向包含拒绝（DSH_HOME/部署目录/仓库根）⑤专用标记 sentinel.marker.json
    （purpose=p6-5-sentinel，证明调用方自建专用副本）⑥sentinel 全树前后快照断言
    （原文件逐 hash 不变、零删除；新增仅限 synthetic 允许目录——dsh-home/project/
    deploy-copy/other-bot-workspaces/system-config；白名单外新增/修改/删除 exit 2）。
    **行为翻转实证**：symlink 根修复前 exit 0 且目标目录写入 9 文件 → 修复后 exit 2
    且零写入；五负例（无 env/缺目录/symlink/无 marker/真实 DSH_HOME）全部 exit 2
    且无结果落盘。
  - **P6-5 重跑（方案 A 规格，重写证据 artifacts/p6-5-sentinel-evidence.json）**：
    三分 schema（allDiffs/expectedRuntimeDiffs/unexplainedDiffs——修复 hashDiffs 与
    detail 矛盾）；前/后基线 **~/.dsh 全树 4665 文件**（排除 plugins/ 部署目录）逐
    hash 落盘附件（p6-5-hashes-before/after.json）；唯一差异 bots/review/epoch.json
    入白名单归因（运行中 host pid 90344 持锁必刷锁纪元——机制为既审代码），白名单外
    差异 **0**；五进程 PID+startedAt 前后逐一全等；八格原始结果全量落盘
    （p6-5-probe-raw.json，8×ALLOWED 为「未受阻」观测、矩阵格保持 pending 待双席
    人工验收）；执行环境结构化（PID ns + 宿主进程样本可见性）。
  - **P6-4 结构化证据（scripts/p6-4-verify.mjs 新增 --out）**：
    artifacts/p6-4-verification-evidence.json——执行环境（pidNamespace +
    hostProcessVisibleBySample=**true**，注册实例 PID /proc 可见——对副审 PID
    namespace 争议的实证区分）、逐进程明细（5/5 存活）、11 项断言逐条、结论
    PASS（只读面）。
  - **规格与文档归一**：PLAN P6-5 规格修订为方案 A（判定标准：探针差异=0 + 运行时
    漂移穷举白名单归因 + 白名单外 fail closed；不停机下原「前后 hash 相同」不可满足
    的依据入档）；PLAN 与 docs/REWORK-status.md 增「历史快照」文档状态声明（当前
    门态以门态更新段 + CHANGELOG 最新条目为唯一事实源，消除同文档自相矛盾）。
  - **P7-5 口径补录**：部署时刻基线＝代码面平价（lib 20 + scripts 5 + package.json
    逐文件哈希零差，副审已独立证实）；CHANGELOG/PLAN 为部署后文档增量（部署 15:36
    先于 P6-5/返修条目落笔），非部署内容不一致。
  - **ledger 直签标注**：真实 capabilities/reviewer-lead.jsonl 的无 binding
    evidence.read token 为 **p6-4-verify --issue-test 直签验收记录**（该脚本
    issueCapability 不传 binding），非 productionReviewerCapabilityProvider 产物
    （provider 路径必带 binding）——既不否定也不证明 provider binding，标注防误读。
  - **边界**：未部署、未重启、未改真实配置、未写真实 instances.jsonl/bots.json/
    ~/.dsh/bots/review（写面＝工作区文档/脚本 + /tmp 一次性副本）；五进程全程存活。
    修复涉及的 scripts 两文件不进测试面（全量回归不变）。

- ✅ 本轮（P6-5 真实 sentinel 验证：2026-08-29 用户指令「继续任务切片」授权启动；
  由**编码方**执行；**零代码变更、零真实数据写入**；全量 **39/39** 全绿；证据包于
  本条目定稿后重出，此后包列文件冻结）：
  - **执行链（scripts/review-enforcement-probe.cjs --real-sentinel 守卫壳）**：
    前基线（5 进程 PID+启动时间 + 真实 home 52 文件 SHA-256）→ 自建 sentinel 副本
    （/tmp/p6-5/sentinel，内含真实 bots.json/instances.jsonl/settings.yaml 只读拷贝）
    → 守卫负测试 2/2 fail-closed（无 DSH_BOTS_PROBE_REAL_AUTHORIZED=1 → exit 2
    拒绝执行；环境变量在但目录缺失 → exit 2；两者均无结果文件落盘）→ 授权执行
    （exit 0，assertShadowClean=true，8 矩阵格）→ 后基线比对 → 清理（sentinel 目录
    删除；真实 home/仓库/tmp 三处 `.probe-` 残留全零）。
  - **探针结果（如实记录）**：8 个矩阵格全部 ALLOWED＝「写入未受阻」的真实观测
    （副本环境无 sandbox 层），**不得据此改写为「已实现默认拒绝」**；矩阵格按纪律
    在 P6-5 人工（双席）验收前保持 pending。
  - **非破坏性证明**：PID+启动时间前后逐一全等（5/5 存活）；真实 52 文件 51 全等，
    唯一差异 `bots/review/epoch.json`（53→53 字节，writerEpoch/at 时间戳刷新，mtime
    落在窗口内，写入方为运行中 host pid 90344 的锁纪元刷新——活进程行为非探针所致：
    探针写面仅限 sentinel 副本，real-copy 三文件前后 hash 全等可证）；真实文件集
    零新增。
  - **证据**：artifacts/p6-5-sentinel-evidence.json（授权依据/窗口/守卫测试/探针
    结果/非破坏性证明/残留风险，conclusion=提交独立验收）。
  - **边界**：P6-5 执行完毕待双席复核；P9 未启动；未修改任何实现/测试代码。

- ✅ 本轮（P7-5 运行时批 + P6-4 验收：2026-08-29 用户授权「授权启动」；由**编码方**
  执行；全量 **39/39** 全绿；证据包于本条目定稿后重出，此后包列文件冻结）：
  - **规程登记（真实知识库）**：迁移包重生成（9 存活条款/3 指针位/历史分类）+ 隔离
    dry-run dr-ok 后，经 registerReport 真实登记 **R-2026-009**（双审建制评审规程
    扩大工程修订版，取代 R-2026-007；分配 ID 与索引推算一致无竞态）。指针迁移
    三处（send_mail 工具描述/团队军规段/review-prompt 断言）+ 二次清点补齐三处
    残留（index 注释、review-report 分级注释、discuss-mail 守卫断言——该守卫
    当场拦下半转换，正是其设计目的）；R-2026-006/007 历史引用按纪律保留。
  - **部署**：旧部署先归档（~/.dsh/plugins/dsh-bots-backup-20260829/）后全量同步
    （lib 20 文件含全部 review-* 模块/scripts/根文档/package.json；index.js 哈希
    双侧一致）。
  - **重启（无守护进程，手动完整链）**：host kill→nohup 拉起（3080）+ 四 bot
    按 profile 拉起（lead 3101 / bot-mt0x6r0y 3102 / reviewer-lead 3103 /
    reviewer-second 3104；CLI 语法勘误：自定义 profile 不带 web 子命令——
    `dsh --profile <id> --port <p> --no-open`）。
  - **真实环境捕获并修复一处缺陷（穿透实测价值实证）**：reviewer 双席首次拉起
    即被 cordis loader fail-closed 拒绝——evidence 三工具 output 声明缺 `output:`
    键包装（schema/render 平铺），且 output schema 缺 render 引用的
    relPath/byteLength/content 字段（additionalProperties=false 会拒）。测试假
    ctx 不做 loader 级校验故漏检；修复（output 键包装 + schema 补字段）→ 重部署
    → 双席重启成功。
  - **P6-4 验收 PASS**：scripts/p6-4-verify.mjs——5 bot（host/lead/bot-mt0x6r0y/
    reviewer-lead/reviewer-second）最新行全部五字段且 pid 存活；双席真实默认
    注册表路径 issueCapability 签发 + checkCapability 消费通过（capability 台账
    留痕：issued evidence.read）；身份轮换判定就绪。**P6-4 关闭待双席复核。**
  - **边界**：真实运行时变更全部在授权范围内（部署/重启/知识库登记/capability
    验收工件）；未写真实 bots.json；P6-5（真实 sentinel）继续挂门未动；P9 未启动。

- ✅ 本轮（P6-4 设计冻结批：2026-08-29 用户指令「按优先级进行下一项任务」→ P6-4
  设计冻结稿获用户批准；由**编码方**执行；**零运行时写入**；全量 **39/39** 全绿；
  证据包于本条目定稿后重出，此后包列文件冻结）：
  - **设计冻结定稿（PLAN-p6-4-real-instance-migration.md，用户批准）**：
    迁移方案 A＝零数据迁移——instances.jsonl 保持 append-only，P7-5 授权后部署新
    代码并重启，各进程 apply 自写五字段行（值全进程自算），currentInstanceRow 取
    最新行即新格式、签发面自动解锁；方案 B（host 从 /proc 反推身份代写）否决
    （违反"不接受外部传入"冻结语义）。四项裁定随稿冻结：L2 host-authenticated
    proof（与 F-RV-19 dispatch 同构）；bot-wide 镜像共存采方案 Ⅰ（P6-4 后 job
    capability 不再写镜像，镜像降级纯诊断视图）；capability 锁分片采纳
    （capability/lock/<botId>/，store 锁已参数化）；housekeeping 族登记规划。
  - **验收断言脚本化（scripts/p6-4-verify.mjs）**：①③④只读（最新行五字段格式/
    pid 存活/active slot 身份与最新行比对→重启失效判定）；②签发消费断言显式
    --issue-test 开启（真实默认注册表路径 issue+consume，写 capability 验收工件，
    **绝不写 instances.jsonl/bots.json**）。真实环境只读实测：正确给出迁移前 FAIL
    基线（全部 bot 最新行 legacy，含双席 reviewer——诊断"未重启到新代码"）。
  - **测试**：tests/p6-4-verify.test.mjs 5 用例（legacy 判定/五字段+存活/missing
    如实报告/slot 身份轮换/真实路径签发消费/latestRowByBot append-only 语义），
    全部 fixture 隔离；全量 **39/39**。
  - **边界**：未部署、未重启、未改真实配置、**未写真实 instances.jsonl/bots.json**
    （脚本对真实环境仅只读）、未登记规程、未创建实例；P6-5/P7-5/P9 挂门不动；
    运行时部分待 P7-5 授权批。bots.json 用户侧外部变更（24455378）维持留档待归因。

- ✅ 本轮（F-RV-25 三工具对称返修：2026-08-29 副审指控 read/search capability
  本体校验旁路（仅验 binding 不验签名/operation/时效/nonce），主审独立复现成立，
  用户授权「编码方按方案 A 返修」；由**编码方**执行；修后全量 **38/38** 全绿、
  并发压力 ok、lib 全量 node --check 过；证据包于本条目定稿后重出，措辞保持
  「待双席复核」，此后包列文件冻结）：
  - **指控认账（代码层对质即证）**：read/search execute 在 anchorFromToken 后直入
    scoped 执行——binding 正确但签名/operation/时效/slot/nonce 任一层失效的 token
    均可穿透；probe 因 runProbe→requireEvidenceCapability 独享消费型校验，三工具
    不对称。主审复现三例（含 operation 旁路+签名旁路同时成立）与代码面一致。
  - **方案 A 修复**：read/search 在 anchor 通过后追加
    `checkCapability(dshHome, { botId, operation: "evidence.read", capability })`
    （HMAC/operation/expiry/slot/注册表身份/nonce 单次消费全链）——token 由
    provider 每次现取、消费即弃，无双重消费；probe 结构不变（anchor 非消费 +
    runProbe 唯一消费点，未在 held() 预消费）；顺序 anchor（快速拒）→
    checkCapability（密码学校验）→ scoped 执行。
  - **分层负例矩阵（主审制度化要求落实）**：承诺的每个校验层独立失效至少一例，
    伪造 token 的 binding 一律抄自真实 invocation token（非测试常量，排除假阴性）；
    operation/时效层负例 payload 变更后**重签**注入（否则撞签名层而非目标层）。
    ⑦read/search ×4 层（错签名/错 operation/过期/binding 不符）+ 正例对照；
    ⑧revoke-rotate（slot 轮换旧 token 拒）+ nonce 已消费重放拒（read）+
    probe 首次成功证明 held/anchor 未预消费、重放 nonce 已消费拒（消费点唯一）；
    ⑨三工具一致性（同一错签名+真实 binding capability 三向同拒）。
  - **边界观察（不归因本批）**：真实 `bots.json` 于本批测试窗口内被外部修改
    （0bc5679e→24455378，14:25，新增 reviewer-lead/reviewer-second 注册）——
    本批所有写入限于工作区与临时目录（38 测试全部 mkdtemp 隔离），按 W-RV-1
    先例留档待用户归因；该变化不免除 P6-4 门禁（真实 instances.jsonl 仍为
    legacy 格式，未迁移）。
  - **边界**：未部署、未重启、未改真实配置、未写真实 instances.jsonl/bots.json、
    未登记规程、未创建实例；P6-4/P6-5/P7-5/P9 挂门不动；F-RV-26 关闭不变；
    F-RV-24 前轮修复保持随批复核。

- ✅ 本轮（F-RV-25 payload binding 补修切片：2026-08-29 双席归一退回（TOCTOU/
  token 授权语境分叉）后用户授权「编码方返修」；由**编码方**执行；修后全量
  **38/38** 全绿、并发压力 ok、lib 全量 node --check 过；证据包于本条目定稿后
  重出，措辞保持「待双席复核」，此后包列文件冻结）：
  - **指控认账（代码层对质）**：工具 `held()`（扫描①签发 token）与锚点解析
    （扫描②）间隔 await 边界，而 payload 不含 invocation 身份——token 授权语境
    与绑定语境可分叉；我方原实现"两次扫描不比较 invocationId"正中副审伪修复
    排除清单第 4 条。
  - **签发面（要点 1/2/3）**：`issueCapability` 增可选 `binding`
    {invocationId, taskId, sourceSnapshotId, taskSpecArtifactId?}（probe 含第四
    字段）；缺省不写入 payload——job capability 形状零变化（测试直读断言）；
    `validateBinding` 严格 schema（必填三键 + 可选第四键、逐字段非空安全 ID、
    额外键拒绝）；binding 进入 canonical payload，HMAC 天然覆盖（篡改即签名失效）。
  - **provider 面（要点 4）**：弃用布尔包装——`currentClaimedInvocation` 单次
    扫描取 bound，binding 全部取自同一对象（单源）；probe 的 taskSpecArtifactId
    由 `bound.manifest.artifactIds` 经 manifest stage 唯一确定
    （`taskSpecArtifactIdFor`，不唯一 → fail closed），不接受调用参数扩展授权范围。
  - **工具面（要点 5/6/7）**：`held()` 后强制校验 token 自身 binding——缺失一律
    拒绝（含历史/旧 token）+ 与本次调用解析的 bound 逐字段全等（**比较
    invocationId**——TOCTOU 收敛语义：token 与当前 claimed invocation 不同源 →
    fail closed，下次调用重取新 token）；参数级检查（cycleId==binding.
    sourceSnapshotId、taskId==binding.taskId）保留为第二层。
  - **多 invocation fail closed**：`currentClaimedInvocation` 对同一 bot 命中
    多个一致 claimed invocation → 返回 null（授权锚点不唯一，拒绝签发/绑定）。
  - **伪修复排除自证**：binding 进签名 payload（非仅日志）✓；工具强制校验
    binding ✓；工具不自行附加 binding（binding 仅由 provider 签发面写入）✓；
    两次扫描比较 invocationId ✓——四条排除形态均不在本实现中，测试矩阵直读
    payload 断言背书。
  - **测试矩阵（双席十二条 + 我方整合为 6 用例）**：payload 直接三断言（read
    三字段/probe 四字段/job 形状零变化/严格 schema 拒）、旧无 binding token 拒、
    篡改未重签 strictCheck 签名拒、TOCTOU 两向（token(task1) vs task2 与
    token(task2) vs 重claim后 task1 双向拒）、多 invocation 不一致 fail closed、
    probe binding.taskId 矛盾拒 + 参数 artifactId 扩展授权范围拒；既有 lease
    过期/状态推进拒绝用例保持。
  - **证据包措辞**：scope 分别写明"工具层方案 A 绑定（前批完成）/ capability
    payload binding（本批完成）"；L2 措辞保留（lease 来源为宿主身份认证级信任，
    非密码学证明）；包列文件经双席逐文件账实核对口径准备。
  - **边界**：未部署、未重启、未改真实配置、未写真实 instances.jsonl/bots.json、
    未登记规程、未创建实例；P6-4/P6-5/P7-5/P9 挂门不动；F-RV-26 保持关闭；
    F-RV-24 前轮四项修复保持，随批双席复核，不单独关闭。

- ✅ 本轮（F-RV-24/25 返修：2026-08-29 双席一致退回（六项缺陷）后用户授权
  「编码方按冻结要点返修」；由**编码方**执行；修后全量 **38/38** 全绿、并发压力
  5 轮全 ok；证据包于本条目定稿后重出，措辞保持「待双席复核」，此后包列文件冻结）：
  - **六项缺陷全部认账并修复**（编码方逐项对质在案：缺陷 1 经 readBody 实测定性
    为全链必挂级——任何合法 intake 请求被二次 JSON.parse 恒打成 400；根因为首轮
    测试只打函数层、未穿透 HTTP 层）：
    ①intake 路由 `readBody` 直接使用（已解析对象；400/413 经 httpError 传播），
    删除二次解析；②principal 判定复用 `assertDecisionWriter`（缺失/异常/role≠user
    恒 403，与 decision 同款）；③sourceRoot 先 realpath 归一，快照 manifest 改记
    canonical realpath（review-evidence），同 taskId 换 sourceRoot → 幂等冲突拒绝；
    ④taskId 存在但非非空安全字符串 → 路由 400（缺失才自动生成）；
    ⑤`botHoldsInvocationLease` 升级为 L1 交叉验证（新导出
    `currentClaimedInvocation`）：state 必须 claimed（completed/retry-wait/
    cancelled/expired 不构成持有）、lease 与最新 claimed 事件身份字段全字段一致
    （generation/claimEpoch/claimOwner/hostInstanceId/pid/startedAt）、leaseUntil
    单调不减（heartbeat 不落事件，同一 generation/claimEpoch 下心跳合法延展，
    回退/换代即失配）、事件或 lease 损坏 → 不构成持有；
    ⑦方案 A 绑定（三工具统一）：以当前 claimed invocation 为锚——
    targetReviewer==botId（扫描固有）、taskId==invocation.taskId（probe）、
    cycleId==invocation.sourceSnapshotId（三工具）、taskSpecArtifactId∈
    invocation.artifactIds（probe）；跨 task/cycle 访问一律拒绝。
  - **要点 6 措辞修正**：lease 来源为宿主身份认证级信任（claimInvocation 受信链），
    **非密码学证明**；host-authenticated proof（L2，与 F-RV-19 dispatch 签名同构）
    与 capability secret 同 OS 用户可读合并登记 P6-4。本条目与 provider docblock
    均不含"lease 来源有密码学证明"类表述；包措辞保持"待双席复核"，无"跨 task
    访问非阻断"类表述。
  - **主审穿透实测要求落实**：新增 HTTP 层穿透用例（`handleReviewApi` + mock
    req/res）：合法请求 201 → 落盘全链（invocation manifest + 快照 manifest 校验）、
    无 principal 403、role≠user 403、taskId 非法 400、多余键 400。
  - **回归矩阵**：tests/review-intake.test.mjs 7 用例（含 root 换源幂等冲突 +
    canonical realpath 断言 + 穿透实测）；tests/review-evidence-tools.test.mjs
    4 用例（含 cycleId 绑定不符拒绝 + lease 过期回收后 state 离开 claimed →
    不构成持有 → 工具拒绝）；全量 **38/38**、并发 5 轮 ok、lib 全量 node --check 过。
  - **边界**：未部署、未重启、未改真实配置、未写真实 instances.jsonl/bots.json、
    未登记规程、未创建实例；P6-4/P6-5/P7-5/P9 挂门不动；F-RV-26 保持关闭。

- ✅ 本轮（F-RV-24/25 未建功能切片：2026-08-29 用户授权「按冻结稿实施」；由
  **编码方**执行；修后全量 **38/38** 全绿（新增 2 测试模块）、并发压力 5 轮全 ok；
  证据包于本条目定稿后重出，此后包列文件冻结）：
  - **F-RV-24（task-spec → snapshot → initial invocation 生产入口）**：新模块
    lib/review-intake.js `intakeTaskSpec`——① task-spec 工件（author=user，幂等键
    `intake:<taskId>`）→ ② `createSourceSnapshot` 物化（cycleId 确定性派生
    `snap-<taskId>`，已物化复用不覆写）→ ③ 盲审双席 initial invocation
    （admission 由 createInvocation 内 expectedNextStages 机械断言，零新增转移边）。
    fail closed：flow 已存在拒绝（不隐式续期）、sourceRoot/body/taskId/createdBy
    逐项校验、失败结果回带 taskId 供确定性重试；同 taskId+body+root 全链幂等。
    生产路由 `POST /api/bots/review/intake`（handler 仅 schema 校验+委托，
    additionalProperties=false；principal 门控与 decision POST 同款 P5-4 语义——
    无浏览器会话 principal 恒 403）。pump 零改动（invocation 落盘后既有状态机接管）。
  - **F-RV-25（reviewer evidence 工具生产注册）**：review_read / review_search /
    review_probe 注册于 `group === "review"` 的 bot 实例；capability 链式签发前置 =
    新增 `botHoldsInvocationLease`（review-orchestrator 导出：该 bot 为
    targetReviewer 的任一 invocation 持活态 lease——lease 只能经宿主 claimInvocation
    受信链建立，与 F-RV-19 受信链同构；损坏 lease 不构成持有）。生产 provider
    `productionReviewerCapabilityProvider`（evidence.read/artifact.read/evidence.probe，
    bot-wide 无 jobId）。**registeredCommands 单一事实源 = task-spec 工件正文**
    （工具侧验 manifest stage/taskId/完整性后解析，模型不得自报——否则
    runProbe 逐字登记白名单形同虚设）；限额全数沿用 EVIDENCE_LIMITS，bwrap 沙箱。
  - **回归**：tests/review-intake.test.mjs（5 用例：正常链/幂等重放/换正文冲突/
    flow 已存在拒绝/fail-closed 逐项）；tests/review-evidence-tools.test.mjs
    （3 用例：无 lease 全拒/claim 后 read 精确+search 命中+跨 bot 拒+快照外路径拒/
    probe 工件绑定+未登记拒+登记命令沙箱成功）；全量 **38/38**、并发 5 轮 ok、
    lib 全量 node --check 过。**冻结面零改动**：协议表/admission/快照语义/探针白名单/
    capability 判定链均未触碰，纯接线。
  - **边界**：未部署、未重启、未改真实配置、未写真实 instances.jsonl/bots.json、
    未登记规程、未创建实例；真实 intake 路由与 reviewer 工具在 P6-4 后的真实实例
    上才生效，P6-4/P6-5/P7-5/P9 挂门不动。R-3 NOT READY / BLOCKED 维持（开放项
    收敛为 P6-4 与 P9 安排）。

- ✅ 本轮（F-RV-26 补修·slot 一致性子项：2026-08-29 用户授权「编码方按冻结稿返修」
  （共享 capability-state lock 方案）；由**编码方**执行；修后全量 **36/36** 全绿、
  并发压力 5 轮全 ok、独立 220 轮同 slot 竞态压力 **0 矛盾**；证据包于本条目定稿后
  重出，此后包列文件冻结）：
  - **判定接受**：副审指控 + 主审独立复现（5/100）+ 编码方独立基线复现（**4/100**，
    特征同型：`seq=issued,revoked`、末事件 revoked、slot 仍在、调用失败 0）——同一
    `botId+jobId` 的 issue/revoke 跨进程竞态产生「ledger 末事件 ⟺ slot 存在性」状态
    矛盾，代码层交错面（issue 追加→槽写→镜像写 ‖ revoke 读槽→删槽→留痕，无共同
    线性化机制）成立。按双席裁定拆分：**O_APPEND 子项通过；slot 一致性子项不通过，
    退回补修、不关闭**。
  - **实现（冻结稿全项）**：① store 锁参数化（`acquireStoreLock` 新增 `lockDir`/
    `epochFile`/`lockAuditType` 选项，零语义改动）——capability 生命周期写操作复用
    同一套已验证锁机器（自旋+死亡证明接管+epoch 基座），独立锁域
    `bots/review/capability/lock/` 与独立 epoch 文件，接管审计独立类型
    `capability-lock-takeover`；② `withCapabilityLock` 包裹 issue 写序列
    （ledger 追加→槽写→镜像写，ledger O_APPEND 在锁内为线性化点）与两种 revoke
    （job-scoped / bot-wide）；③ `reconcileBotCapabilityState`：每次锁获取后按
    ledger 真源重放该 bot 每 jobId 末事件——末=issued 而槽缺失/内容不符 → 重写槽；
    末=revoked（bot-wide 清空全部）或无 issued 而槽在 → 删槽；镜像按末条 issued
    重写；ledger 损坏 → fail closed。
  - **不变式（双方向均禁）**：`ledger 末事件 ⟺ slot 存在性`——末=revoked 而槽在、
    末=issued 而槽缺皆为矛盾态；回归断言器 `assertCapabilityInvariant` 按重放模型
    比对实盘。
  - **锁序与嵌套审计（主审条件 2 闭环）**：锁序不变式=禁止持有 store 锁时获取
    capability 锁；生产调用点逐点审计——`issueJobDispatch`（createEngineeringJob
    锁外、pump backfill 锁外）、`productionJobCapabilityProvider`（`held()` 仅转发
    provider，先于 claim/heartbeat/report 的 store 锁）、`revokeCapability`（生产侧
    无调用点）——**无嵌套**。临界区全同步（无 await），进程内无异步重入。
  - **范围线（冻结稿明示）**：读侧（strictCheck/isCapabilityCurrent/consumeNonce）
    有意不入锁——claim/heartbeat/report 热路径不串行化；nonce 单次消费 + slot 缺失
    fail closed 使读侧竞速最多多放行一次已消费 nonce 的校验。非遗留缺陷。
  - **回归矩阵（冻结稿五节全项）**：①同 slot issue‖revoke 真实子进程 30 轮
    （套件内）+ **220 轮独立压力：contradictions=0、callfailures=0**（基线 4/100）；
    ②bot-wide revoke ‖ job issue 交错不变式；③issue‖revoke‖strictCheck 三方交错
    （check 不崩溃、拒绝原因为合法判定语义、终态不变式）；矛盾判定双方向；
    reconcile 三单测（issued 无槽自愈/revoked 残槽清除/损坏 fail closed）；
    既有 F-P9-04 ⑤ 不回退；全量 36/36；并发套件 5 轮 ok；lib 全量 node --check 过。
  - **边界**：未部署、未重启、未改真实配置、未写真实 instances.jsonl/bots.json、
    未登记规程、未创建实例；P6-4/P6-5/P7-5/P9 挂门不动；F-RV-24/25 维持未建。
  - 在副审复核通过前，F-RV-26 整体不标记关闭、不宣称 capability 生产链收口。

- ✅ 本轮（F-RV-26 修复：2026-08-29 用户裁定「编码方按冻结稿返修」并采纳冻结稿二.4
  镜像修正；由**编码方**执行；修后全量 **36/36** 全绿、并发压力 5 轮全 ok；证据包于
  本条目定稿后重出，此后包列文件冻结）：
  - **F-RV-26 ①（capability ledger 追加竞争，双席一致判定，定级：高）**：
    `appendLedgerRecord`（lib/review-capability.js）原为"读全文件→拼接→
    `writeFileDurable` 整文件替换"，违反 F-RV-9 冻结追加语义——并发签发/吊销互相丢行
    （副审复现症状一），且 `writeFileDurable` 读回比对撞上并发 rename 使
    `issueCapability` 随机干净失败（主审复现症状二）。重写为 O_APPEND 行级原子写
    （`openSync(file,"a",0o600)` + 单次 write + fsync），与 store 侧 `appendJsonl`
    同款；无 separator 预读、无读回比对。
  - **F-RV-26 ②（冻结稿二.4 镜像修正，经用户裁定采纳）**：bot-wide 兼容镜像
    `<botId>.active.json` 改用新增本地助手 `writeFileAtomic`（rename 原子落定、豁免
    读回比对）——N 进程竞争写同一镜像时读回会读到竞争者内容而误报失败；镜像仅为
    兼容视图（不能授权任何 job），落定内容恒为完整合法 envelope。active slot
    （不同 job 不同路径）、secret、dispatch 件维持 `writeFileDurable` 不变。
  - **F-RV-26 ③（读侧 fail closed）**：`readCapabilityLedger` 对 corrupt 行（含崩溃
    撕裂尾行）抛错，与 `readAudit` 同款，不再静默截断（对齐冻结稿二.3）。
  - **回归矩阵（冻结稿三节全项交付）**：跨进程并发 `issueCapability`（同 bot、6 job）
    成功数==6/失败数==0/ledger issued 行数==6/job slot 数==6；跨进程并发
    `revokeCapability`（6 job）留痕零丢失、slot 全清理；issue‖revoke 混合争用
    （12 子进程）ledger 行序完整无丢行；人造撕裂尾行 `readCapabilityLedger` fail
    closed。新增于 tests/review-concurrency.test.mjs（复用真实子进程脚手架，
    F-RV-26 ×3）与 tests/review-capability.test.mjs（撕裂尾行 ×1）；既有
    F-P9-04 ⑤ 吊销拒绝语义未动、零改动授权判定链（HMAC/分槽/nonce/注册表）。
  - **授权判定链零改动面确认**：HMAC 签名/分槽活态/nonce 单次消费/注册表五字段绑定
    均未触碰；`writeFileDurable` 仍用于全部非竞争整文件状态。
  - **边界**：未部署、未重启、未改真实配置、未写真实 instances.jsonl/bots.json、
    未登记规程、未创建实例；P6-4/P6-5/P7-5/P9 挂门不动，F-RV-24/25 维持另行授权切片。
  - 本修复属小体量单点（一个函数写路径 + 一个镜像写助手 + 一组并发回归），
    无连带迁移；在双席复核通过前不宣称 capability 生产链收口（F-RV-26 定级为高、
    非越权类）。

- ✅ 本轮（第二批就地修复：2026-08-28 用户授权「原地修复」，由**主审席执行**（仅限本批
  四项）；修后全量 **36/36** 全绿（新增 tests/review-production-chain.test.mjs）；证据包于
  本条目定稿后重出，此后包列文件冻结）：
  - **F-RV-18（runner 级 RPC 超时守卫，终结定级对质）**：buildReviewRunner 每次 RPC 调用
    竞速兜底（默认 35s＜lease 60s；定时器引活＋落定即清除）——注入路径（rpcStub 无
    dshRpc AbortSignal）挂起也有界拒绝、心跳节拍不断流。新增 ①hanging history 有界拒绝
    ②慢 history 心跳不断流两回归（tests/review-heartbeat.test.mjs）。实现中自捕并修复
    一处竞速定时器 unref 导致拒绝永不发生的缺陷（事件循环空时 Node 直接退出）。
  - **F-RV-19（生产受信链落地）**：宿主派发面——createJobFromDecision 建 job 后签发
    job.claim capability 落 `jobs/<jobId>.dispatch.json`（实例未注册/离线→pending 留痕，
    泵每 tick backfillJobDispatches 自动补发）；bot 侧生产 provider 接入真实注册点——
    claim 凭宿主签名 dispatch（验签＋bot/job/operation/有效期绑定），heartbeat/report
    链式签发（仅当本 bot 持有效 lease，而 lease 只能经签名 claim 建立）；无前置一律
    null→工具如实拒绝。secret 同 OS 用户可读为既有登记残留（P6-4 前）。
  - **F-RV-20（fix-report provenance）**：manifest 增可选键 sourceSnapshotId（存在即
    非空字符串）；report 工具提交时绑定 job.sourceSnapshotId；reportFix 强制
    manifest.sourceSnapshotId === job.sourceSnapshotId，不符拒绝。
  - **F-RV-22（report 幂等闭环）**：reportFix 对同工件重放返回 {ok:true, idempotent:true}
    （验完整性与既有事件绑定，无需新 capability）；工具层幂等重放不重复触发复检；
    修正正文新工件→终态拒绝。回归覆盖副审三场景（无快照拒/成功/幂等重放/异工件拒）。
  - **随修**：review-engineering-job 夹具补 sourceSnapshotId、review-store 冻结常量断言
    更新（可选键）；/tmp/r3-tests.txt 增新模块。
  - **边界**：未部署/未重启/未改配置/未写真实 instances.jsonl/bots.json/未登记/未建实例。
    **F-RV-24/25（task 入口接线、reviewer evidence 工具接线）为未建新功能，不属本批
    「修复」，建议独立切片另行授权设计冻结后实施。**

  - **独立反例加固（本轮原地复核）**：job capability 改为按 `botId/jobId` 分槽，避免同一 bot 多 job 互相轮换；已消费/过期 dispatch 在 requeue 后可重发；report 工具在不可接受正文落件前先做非变更预检，拒绝后的不可避免落件进入 quarantine；reservation request hash 纳入 `sourceSnapshotId`；runner heartbeat supervisor 与 RPC/总 deadline 保持引活、失败可观测且结束清理。新增多 job、requeue、同 key 换快照、工具幂等重放回归；此前 `36/36` 需在本条目定稿后重新复跑、重出证据包。

- ✅ 本轮（就地小修：2026-08-28 用户明确授权「体量不大原地修改」，由**主审席直接执行**
  （审查角色临时切换为执行角色，仅限本批四项，编号对齐后为 F-RV-10/11/22/23）；
  修后全量 35/35 复跑全绿；证据包于本条目定稿后重出）：
  - **F-RV-10 补全（崩溃窗自愈）**：`createRouteIntent` 对「intent 已落盘、pending 事件
    未写」不再抛错——持锁补齐 pending（null→pending 唯一治愈边），死腿消除
    （lib/review-relay.js）；新增回归测试（删除事件目录模拟崩溃窗 → 自愈 → reconcile
    committed）。
  - **F-RV-11 补全（探针对称）**：`runProbe` 增加 `botId` 形参并透传
    `requireEvidenceCapability`（默认主审；调用方按 invocation 的 targetReviewer 传入），
    主副审证据能力对称落到位（lib/review-evidence.js）。
  - **F-RV-22-keyhash（历史子项；幂等键去时间戳；原误记 F-RV-18；不与 F-RV-22 report replay 混用）**：`engineering_job.report` 幂等键改
    `fix-report:<jobId>:<正文 sha256>`——同正文重试幂等返回既有工件，正文修正走新键，
    孤立工件不再随每次重试累积（lib/index.js）。
  - **F-RV-23（文档语义对齐机制；原误记 F-RV-19，编号冲突后改号）**：实例身份 docblock 由「host 管理身份写入、bot 不自写」
    修正为「每个 dsh 进程 apply 自写一行自身身份、值均进程自算不接受外部传入；bot 行
    hostInstanceId 为该 bot 进程派生身份」（lib/review-capability.js、lib/index.js 注释）。
    机制未改（原机制本身安全：单一身份源＋HMAC 真闸门）。
  - **边界**：未部署、未重启、未改配置、未写真实 instances.jsonl/bots.json、未登记规程、
    未创建实例。
  - **勘误（副审返回后本条目修订，编号纪律对齐）**：① 初版条目内嵌证据包 SHA-256 并声称
    「27 文件零漂移」——包生成于本条目写入之前，CHANGELOG 自身构成 1 项漂移（副审
    F-RV-21 指认属实，我方流程错误）。本条目定稿后重出证据包，包哈希以包文件自证，
    此后不再修改包列出的任何文件；② 初版「F-RV-1～19 全部闭环」表述**撤回**：F-RV-18
    （RPC 挂起）/19（capabilityProvider 生产缺失）/20（fix-report manifest 无
    sourceSnapshotId）按副审既有定义登记开放，其中 F-RV-18 我方对定级存异议——生产
    dshRpc 带 AbortSignal.timeout(30s)（lib/index.js:222/1768-1772），心跳最大间隔
    ≈轮询+30s＜60s lease，无生产饥饿路径，副审反例经 hanging rpcStub 绕过该超时，
    建议降为加固项；F-RV-22 端到端幂等证明三测试欠，开放；③ 证据包 S9 表述收窄为
    「engineering 受信链：注入式测试已验证；默认生产 capabilityProvider 接线未验证
    且当前缺失（P6-4 范围）」。

- ✅ 本轮（R-3 返修：2026-08-28 用户授权全部 R3-01～R3-10，按两席固定验收顺序执行完毕；
  全量 35/35 全绿、并发 5/5、无结论证据包已重出；R-3 独立验收待两席，编码方不自判）：
  - **R3-01（F-RV-17）实例身份冻结**：五字段 {botId,pid,startedAt,hostInstanceId,at}，
    host 写入管理身份（apply 卫生路径；startedAt=进程启动时刻、hostInstanceId=`host-<pid>`）；
    签发/校验同一身份源（currentInstanceRow）；旧格式行不隐式兼容不猜测转换、最新行
    损坏不回退、重启必轮换；迁移四例 + 轮换失效测试（F-RV-17 ①~⑤）。
  - **R3-02（F-RV-2）job.heartbeat 闭环**：operation 入白名单；heartbeatJob 全链自校验
    （HMAC/op/botId/jobId/hostInstanceId/活态/expiry/nonce 单次）；工具无 capability 即
    rejected、去 hostInstanceId fallback；七矩阵测试。
  - **R3-03（F-RV-1）runner heartbeat + 并发守卫**：执行期周期续 lease（20s<60s，关系
    冻结注释）；heartbeat 失败立即中止；泵 in-flight 跨 tick 守卫 + completed 持久
    handled 标记；新增 tests/review-heartbeat.test.mjs（六测试）。
  - **R3-04（F-RV-13）创建边界 admission + snapshot 全链**：13-stage 表/作者固定/
    targetReviewer 白名单/flow 状态下一阶段机械断言（expectedNextStages 入
    review-protocol.js）；sourceSnapshotId 必填且必须有效物化快照；flow 损坏创建即拒；
    snapshot 沿 initial→delta→R1/R2→final→recheck 全链同源（flow/thread 锚定 +
    三处先持久化修正）；admission 矩阵与传播断言入测试。
  - **R3-05（F-RV-3）fix-report 生产提交通道**：engineering_job.report 改 body 直提
    （受信链内落 fix-report 工件→reportFix→自动触发复检）；job 绑定 sourceSnapshotId
    （host 从 flow 解析，调用方不可自由填参）；快照链一致性复核；生产链七段测试
    （decision→job→claim→heartbeat→submit→reportFix→recheck，复检快照同源）。
  - **R3-06（F-RV-14）十字段 schema 生产校验**：reportFix 读正文→严格 JSON→
    validateFixReport（additionalProperties=false）→taskId 绑定→正文 finding/changedFiles
    与 job.scope 逐项绑定→与工具参数集相等；六矩阵测试。
  - **R3-07（F-RV-15）final/user-facing committed 门**：registerFinal/registerRecheckFinal
    ok=false → 禁 publishResult/禁完成通知/禁成功步骤；writeUserDecision 复核
    user-facing route committed；复现测试（副本失败→不发布→无通知→decision 拒绝）。
  - **R3-08（F-RV-4/5/6）fail-closed**：readFlow 损坏即抛（不重建不覆盖不登记）；
    job lease 损坏即抛且调用点 wrap 为明确拒绝（原文件不动）；requeueInvocation 默认
    authenticated=false。
  - **R3-09（F-RV-7~12）登记项处置**：dead-letter 仅经 retry-wait（直跳=非法分支，
    转移矩阵测试）；user-facing copy 瞬时失败→failed 可重试不隔离（reconcile 重投）；
    appendJsonl 改 O_APPEND 原子行级追加（防并发丢行）；intent/pending 崩溃恢复测试；
    requireEvidenceCapability 去 reviewer-lead 硬编码（主副审 evidence capability 对称，
    nonce 清理规划入账）；lease/事件折叠受控边界模块头冻结（F-RV-12）。
  - **测试结果（编码方自测，TMPDIR=/dev/shm）**：**35/35 全量测试模块全绿**（新增
    review-heartbeat）；并发压力复测 5/5；18 个 lib 模块 node--check 0 失败；反例覆盖
    F-RV-17×5/2×7/1×6/13 矩阵+传播/3 生产链/14×6/15 复现/4/5/6/7 矩阵/8/10/11。
  - **证据包（P8-3，无结论）**：`artifacts/review-evidence-package.json` 重出——结论固定
    「提交独立验收」，账实核对（byteLength=UTF-8 字节、sha256=64 位小写 hex），
    SHA-256 见包内；包含 35/35、并发 5/5、残留风险与挂门待办。
  - **明确不做（挂门，如实声明）**：P6-4 真实实例注册、P6-5 真实 sentinel、P7-5 真实
    登记/部署/重启、P9 双席独立复审；本轮未部署、未重启、未登记规程、未改真实配置、
    未写真实 instances.jsonl；R-3 独立验收未发生（编码方不自判 PASS/READY）。

- ⛔ 本轮（R-2 独立复审：两席统一返回 2026-08-28，R-2 验收不通过；R-3 返修要求已返回、未授权）：
  - **复审结论**：两席对 R-2 缺陷、严重度、依赖关系与验收标准达成一致并归一；
    R-2 不接受为「完成」；门态 NOT READY / BLOCKED；P9 不得放行；
    P6-4/P6-5/P7-5 继续挂门。
  - **驳回项（编号冻结，不得重编号）**：必须优先 F-RV-1/2/3/13/15/17；随批
    F-RV-4/5/6/14/16；登记不丢 F-RV-7～12（F-RV-11 副审 evidence capability
    不对称属功能缺陷，不能仅以 nonce 清理覆盖）；环境项 W-RV-1。
  - **固定验收顺序与依赖**：F-RV-17→F-RV-2→F-RV-1→F-RV-13→F-RV-3→F-RV-14→
    F-RV-15→F-RV-4～6→F-RV-7～12→F-RV-16→交叉复核→P9（详见 PLAN 10.6）；
    依赖：17→2；3→14；13→主链/讨论链/终审链/复检链；15→user-decision。
  - **W-RV-1 台账补录（本条目即台账）**：变更主体=用户授权；变更对象=reviewer-lead；
    变更内容=danger-full-access；生效位置=部署侧 bots.json / reviewer-lead
    profile patch / spawn 参数（项目仓库无此变更痕迹）；授权时间=用户侧操作
    （2026-08 期间，两席复审归因确认）；用途=主审 evidence plane 外真实测试/调试；
    边界=不扩展至编码方实例、不解除 P6-4/P6-5/P7-5 门禁。补录不扩大权限、
    不触发实例动作。
  - **R-3 未授权**：未获用户明确授权前不修改 lib/、scripts/、tests/、bots.json、
    profiles/、部署副本；不创建实例、不登记规程、不改配置、不部署、不重启。

- ✅ 本轮（R-2 返修：F-P9-01～09 全部阻塞项修复完成，全量回归全绿，无结论证据包已重出；
  用户授权全部 R2-01～R2-12，P6-4/P6-5/P7-5/P9 挂门未动）：
  - **R2-01 协议层**：13 行 stage 表逐字（作者/required recipients 固定/转换）、
    `lib/review-envelopes.js`（stage 专用 envelope，additionalProperties=false，
    canonical/body/discussionBody 两级 hash）、`review-flow.js`/`review-discussion.js`
    按冻结主链重写（双初审门控、delta nextAction 分支、R1 原字节/唯一 R2/final 后拒绝、
    send_mail 旁路拒绝）。
  - **R2-02 证据层**：source-snapshot 只读物化 tree/（总 manifest hash、同 cycle 不可覆写）；
    scopedRead/Search 逐文件 hash 校验整体 fail-closed；runProbe 绑定 snapshot + 任务
    登记命令（command+args 精确匹配）+ 一次性副本 + bwrap 隔离、外部 cwd 忽略。
  - **R2-03 capability**：HMAC-SHA256 {payload,sig}（canonical JSON）；签名/过期/operation/
    注册表 pid+startedAt+hostInstanceId 三绑定/PID 存活/nonce 单次消费（wx 独占文件）/吊销
    活态绑定；checkAuthorBinding 同级严格；CAPABILITY_OPERATIONS 增 job.claim/job.report。
  - **R2-05 存储**：一事件一文件（seq 紧凑、事件含 writerEpoch+eventHash）；所有读路径
    损坏/缺号/hash/转换 fail-closed（杜绝只折叠 parsed）；quarantine 追加引用不移动源件；
    reservations 一 key 一文件；锁含 hostInstanceId/pid/startedAt/writerEpoch；PID+startedAt
    身份接管判定（PID 复用视为旧身份死亡）。
  - **R2-08 relay**：ROUTE_STATUS 增 prepared；投递携带不可变正文副本
    （deliveries/<recipient>/<artifactId>/body.md + meta）；committed 后 reconcile 复核
    目标 hash；route 事件受锁折叠（**修复 per-recipient seq 缺号**：事件按收件人目录拆分）；
    resetFailedRoute 保留历史。
  - **R2-04 orchestrator**：claim 携带 claimEpoch/generation/fenceEpoch；最终提交前证明
    lease 归属 + claim 时 writerEpoch==当前（被接管/过期 → stale 拒绝 + 审计）；completed
    绑定唯一 outputArtifactId（body+manifest 落盘、完整性复核），同 invocation 异 hash →
    quarantine；attempt-failed/retry-wait/dead-letter 状态机 + 显式 requeue 增 generation。
  - **R2-06/R2-07 授权链**：writeUserDecision 强制宿主注入 principal（author 恒 user、
    已发布 final 校验、revision 顺序、同 revision 一致、决策记录冻结契约 {…findingIds,
    scope, acceptanceCriteria}）；createEngineeringJob 机械读取 decision（choice 授权/
    findingIds 子集/scope/acceptanceCriteria 逐字一致）；claimJob/reportFix 走签名 capability
    + nonce；reportFix 按 job.scope 规范化路径判定；fix-reported 终态；三次失败 dead-letter。
  - **R2-09/10/11 主机接线**：评审主机泵（仅主 web 实例；每 invocation 全新一次性
    reviewer session 不留状态文件、同 tick 闭环输出落工件→envelope 校验→流程推进→
    user-facing 发布→SSE review 七字段广播）；GET /api/bots/review/results[/:id][/body]
    （仅 route committed、hash fail-closed 500、路径注入 400）+ POST
    /api/bots/review/decisions（无 principal 恒 403；authorize-repair 自动建 job）；
    engineering_job.claim/heartbeat/report 工具（capability 宿主注入，无 → 如实拒绝）；
    三路径启动校验（engineering bot，无隐式回退）；lib/client.js 通知面（REVIEW_NOTIFY_KEYS
    白名单/reviewNoticeText/pushReviewNotices/reviewApi 助手，双语键）。
  - **反例回归**：F-P9-01×4、02、03×3、04×13、05×2、06×4、07×16、08×4 全部入测试；
    F-P9-09 由 GET/POST/三路径/probe 脚本（shadow 验证 + sentinel 守卫）/client 键测试覆盖。
  - **测试结果（编码方自测，TMPDIR=/dev/shm）**：**34/34 全量测试模块全绿**（17 既有 +
    17 评审模块，聚合器 run.mjs 不计分母）；并发压力复测 5/5；18 个 lib 模块 node--check
    0 失败。
  - **证据包（P8-3，无结论）**：`artifacts/review-evidence-package.json` 重出——结论固定
    「提交独立验收」，含 15 修改文件 + 17 测试模块 byteLength/sha256 账实核对、34/34、
    并发 5/5、10 分区、6 残留风险、4 挂门待办；SHA-256=
    051c7cbb42bd3f11209eff30642194c50758c0ba5b4ba1feeafc9daa55a5e83d。
  - **坐标说明**：三路径接线落在 lib/index.js + lib/review-enforcement.js（shared.cjs
    保持 CJS 助手层，不重复承载 schema），已按计划纪律记录。
  - **明确不做（挂门）**：P6-4 真实实例注册、P6-5 真实 sentinel、P7-5 真实登记/部署/重启、
    P9 双席独立复审；本轮未部署、未改配置、未重启、未写 bots.json/profiles/部署副本。

- ⛔ 本轮（F-P9 独立评审：P1～P8 完成声明被驳回，门态 BLOCKED；返修未授权）：
  - **独立评审已核实**：证据包 31 个 byteLength/sha256 账实一致；33/33 测试模块、
    5/5 并发压力、17 个 lib 语法检查均独立复跑通过；真实 `bots.json`/`instances.jsonl`
    mtime 未变；未发现真实实例/配置/规程/部署/重启痕迹。
  - **驳回项 F-P9-01～F-P9-09（7 CRITICAL + 2 HIGH，均经编码方复核确认）**：
    F-P9-01 host 生产接线缺失（lib/index.js 仅 P3 误投 guard）；
    F-P9-02 stage 表 9 项 ≠ 冻结 13 行表、required recipients 可被调用方缩小、无 stage
    专用 envelope schema；F-P9-03 snapshot 非物化可覆写、probe 不绑定 snapshot 可越界写；
    F-P9-04 capability 可伪造（无签名/nonce/PID/startedAt）；F-P9-05 lease 过期后旧 RPC
    仍 completed（双 completed 无 quarantine）、输出未落 artifact；F-P9-06 损坏事件读侧
    静默跳过、存储模型偏离（一事件一文件/quarantine 不移动/epoch 字段）；
    F-P9-07 user-decision 与 engineering-job 授权链可绕过；F-P9-08 relay 无
    prepare/commit 不变量；F-P9-09 P6-1/P5 UI-API 坐标未落地（client.js/shared.cjs/
    probe 脚本未接线）。
  - **撤回声明（按评审要求）**：「P3 误投 guard 及若干离线核心模块/测试已形成；
    P1/P2/P4/P5/P6 仍存在协议级阻塞项；P8 证据包已提交但未通过独立验收。」
  - **处置**：PLAN-expanded-engineering.md 第十节新增返修计划 R-2（R2-01～R2-12，
    每片约 200k，覆盖评审 15 项处置要求与全部反例回归）；未获用户授权不执行。
  - **挂门不变**：P6-4/P6-5/P7-5/P9 继续挂门；本轮未修改任何实现/测试、未部署、
    未重启、未改配置；证据包文件保持原样（哈希不变），待返修后重出。

- ✅ 本轮（F-R9-1 扩大工程：P1～P8 实现切片落地，编码方自测证据包已生成；
  用户授权启动实施，P6-4/P7-5 挂门未动）：
  - **授权边界**：用户「授权启动」仅覆盖实现切片；P6-4（真实实例注册/四源写）、
    P7-5（真实登记/部署/重启）仍挂门；本轮未部署、未改配置、未重启、
    未创建真实实例、未登记新规程。
  - **新增 13 个库模块 + 既改 1 个（lib/index.js 前置 guard）**（坐标均按
    PLAN-expanded-engineering.md v3 计划命名）：
    - `lib/review-store.js`（P1 数据平面：spool 布局/manifest additionalProperties=
      false/事件折叠 fail-closed/单写锁+writerEpoch fencing/幂等 reservation
      先 durable/崩溃对账与隔离）；
    - `lib/review-orchestrator.js`（P2-1/2/5：invocation schema/状态机/claim-
      lease/heartbeat/runInvocation 唯一入口 parts·body 两级 hash 钉扎/
      3 次失败 dead-letter/requeue/过期回收）；
    - `lib/review-capability.js`（P2-3：签发/吊销/轮换/过期/跨 bot 冒用/
      越权 operation/author 绑定）；
    - `lib/review-discussion.js`（P2-4：host 仲裁 R1/R2 讨论桥、强校验
      taskId/cycle/threadId/round/replyTo、R3/第二 thread/final 后拒绝）；
    - `lib/review-evidence.js`（P2-6：source-snapshot/scopedRead 逃逸+hash
      fail-closed/scopedSearch 上限/runProbe 白名单一次性 TMPDIR）；
    - `lib/review-protocol.js`（P4-1/7：9 stage 常量表/作者契约/收件人矩阵/
      转移表/非法组合拒绝/双齐判定）；
    - `lib/review-relay.js`（P4-2/3/4：route intent/per-recipient 投递/hash
      钉扎/幂等/reconcile completed 门控）；
    - `lib/review-flow.js`（P4-5/6：主流程双初审→delta→final；返修流程
      fix-report→双席互盲复检→recheck final 仅副审+user-facing）；
    - `lib/review-results.js`（P5-1..6：result 索引/只读 API 路径防护/
      七字段通知/principal 门控/user decision revision 幂等）；
    - `lib/review-jobs.js`（P5-7/8：engineering-job 范围门控/claim lease/
      fix-report 越权拒绝）；
    - `lib/review-enforcement.js`（P6-1/2/3：三路径 schema/enforcement 矩阵
      初始全 pending/shadow 探针三态）；
    - `lib/review-report.js`（P7-1/2：fix-report 10 字段 schema 无结论字段/
      六条件复检分级）；
    - `lib/review-migration.js`（P7-3/4：迁移包占位符/存活条款/三处指针
      patch/dry-run 回滚 migration-pending）；
    - `lib/index.js`：P3-1 `handleIncoming` 前置 fail-closed 误投 guard
      （isReviewFlowMisdelivery，六类标记；零 outbox/零回路由/turn 增量 0），
      `appendAudit` 导入，internals 增补导出。
  - **新增 16 个测试模块**（P 级回归网，`tests/review-*.test.mjs`）：
    review-store / review-idem-crash / review-concurrency（真实双进程+锁接管）/
    review-invocation / review-capability / review-discussion-bridge /
    review-evidence / review-ingress-guard（P3 双路径分离）/ review-route-schema /
    review-relay / review-main-flow / review-results-api / review-engineering-job /
    review-enforcement-matrix / review-report / review-procedure-migration。
  - **测试结果（编码方自测，TMPDIR=/dev/shm）**：33/33 测试模块全绿（17 既有 +
    16 新增；汇总器 run.mjs 不计分母）；并发压力复测 5/5 轮零失败。
  - **发现并修复的竞态（P1-5 压力暴露）**：单写锁获取路径 statSync 与竞争
    删除之间未捕获异常（owner 缺失时目录瞬删 → ENOENT 外抛）——修复为
    读 mtime 容错重试；修复后 6/6 连跑零失败。
  - **证据包（P8-3，无结论）**：`artifacts/review-evidence-package.json`
    ——结论固定「提交独立验收」，含 18 个 lib 模块语法检查（0 失败）、
    全量回归 33/33、并发压力 5/5、14 个修改文件与 17 个测试模块的
    byteLength/sha256、观测窗口、5 项残留风险、4 项挂门待办；
    不含部署/重启请求。
  - **明确不做**（挂门待授权）：P6-4 真实实例注册（改 bots.json/profiles 属
    「修改运行时注册表/配置」，需另行授权）；P6-5 真实 sentinel；P7-5 真实
    登记/指针迁移/部署/重启（需 P9-5+P9-6）；P9 系列独立验收未执行。
  - **判定校准**：v2（P1..P8、31 切片）因 F-V3-1..F-V3-9、P2-3 watcher 归属和
    P7-3 存活条款迁移仍未闭合而否决；状态统一为「设计已覆盖，待复审/验收」，不再把
    有切片误写成阻塞已解除。当前 v3 尚未完成双席独立复审，门态继续 NOT READY/BLOCKED。
  - **P0 v3 冻结**：host review orchestrator 为 invocation/event/relay 单写者，唯一采用
    host RPC 直推 reviewer session；普通 handleIncoming 只做误投 fail-closed。固定
    task-spec/双初审/delta/final/fix-report/双复检/recheck-final/user-decision stage、作者、
    可见性和 transition；invocation 固定 claim/lease/heartbeat/3 次 dead-letter 与
    outputArtifactId；每 invocation 使用全新一次性 reviewer session，stage 专用 JSON envelope
    严格 schema，text parts 按固定 join 规则序列化并保存 envelope/parts/body 多级 hash，不复用
    普通会话。讨论由 host 仲裁：delta envelope 同时给出主审 R1，host 落不可变 mail-discuss
    artifact 并只创建一个副审 discussion invocation；副审 envelope 落 R2 后才创建 final，普通
    send_mail、R3 或第二 thread 均不能旁路。实例 capability 使用短期 HMAC，绑定 PID/
    startedAt/job/nonce。
  - **状态与路由**：不可变正文/manifest＋一事件一文件；host lock 单写；缺号/损坏/hash
    冲突 fail closed 进 quarantine。relay 按 artifactId+recipient prepare/commit/reconcile，
    允许可恢复物理中间态，但 required recipients 未全齐不得显示 completed。
  - **用户与权限**：user-facing 补 metadata/body 只读、七字段通知、authenticated-user
    decision 写通道；明确 CSRF 不等于身份，不存在宿主用户 principal 时写接口禁用。
    enforcement 探针仅 shadow DSH_HOME/临时 profile/sentinel，结果三态 DENIED/ALLOWED/
    INCONCLUSIVE；真实破坏性目标未经授权不探测。返修报告 schema 十字段并
    additionalProperties=false。
  - **规程治理**：新规程迁移 R-2026-007 的 E 节三口径、任务号、讨论两轮、终审格式、
    分歧表、亲手复证、用户权和植入保密等存活条款；活动指针覆盖 send_mail schema、
    reviewer prompt、review-prompt 与 discuss-mail 两个行为测试；部分迁移失败维持
    migration-pending，不以全局 grep count 代替行为验收。
  - **重切片 v3**：P1..P9 共 48 切片、9 阶段、每项约 200k（约 9.6M）；P6 将 schema/
    shadow 实现与获授权真实注册/验证分切，避免编码方越权；新增用户授权→
    engineering-job→fix-report 的范围门控；把规程迁移拆为迁移包/dry-run、用户 rollout 授权、
    真实登记部署和部署后双席机械复核，消除登记↔验收依赖环。P8 只负责编码方自测/证据包且
    不得判 PASS，P9 整体换号承载主审/副审独立验收、差异终审、回归/治理门禁、用户授权和
    rollout 后最终门态。另补 D13/D14：每 cycle 绑定 immutable source-snapshot，reviewer 仅用
    scope-bound read/search/probe 亲手复证；host 接管使用 writerEpoch fencing，engineering-job
    另有 claim lease/heartbeat/失败终态。v1/v2 只保留历史摘要，不可执行。
  - **范围**：只修改 PLAN-expanded-engineering.md、PROJECT_UNDERSTANDING.md、CHANGELOG.md；
    未修改 lib/scripts/tests、注册表、profiles 或部署副本，未创建编码方实例、登记新规程、
    启动或重启进程；这些动作仍须用户另行授权。

- 📋 本轮（F-R9-1 扩大工程：P0 契约冻结 + 重切片 v2，纯规划无代码变更）：
  - **门态演进**：初版切片 A-01..A-18（18 项）经评审方否决（NOT READY/BLOCKED）；
    评审方在 PLAN-expanded-engineering.md 冻结 P0 契约（P0.1–P0.11：artifact/
    invocation 对象分离、invocation 创建权机械门控、初审可见性矩阵、持久化与幂等
    契约、邮局决策、workspace 与 enforcement、user-facing 返回、规程治理、责任
    分离）并固定统一问题编号 F-S1～F-S15。
  - **编码方第一阶交付（本条目）**＝决策落库 D1～D8 + F-S1～F-S15 处理映射 +
    P1～P8 重切片（31 切片：P1 数据平面/P2 唤醒平面/P3 分流闸/P4 路由平面/
    P5 返回通道/P6 编码方建制/P7 规程层/P8 验收保全，每项 ≈200k）+ 责任分离
    （编码方自测/主审独立复检/副审独立复检/差异终审）+ 确定性验收命令表 +
    未解决风险清单（7 项）。
  - 关键落库决策：D1 存储选型＝不可变正文+不可变 manifest+追加式状态事件+
    事件折叠（消除 append-only 原地更新矛盾，F-S3）；D2 评审流程件走独立
    review inbox、不复用普通 messages.jsonl（F-S6/F-S15 处置：nextSeq 竞态
    降为观察项）；D5 通知七字段白名单无摘要（F-S10）；D6 返修报告 schema 无
    结论字段类型、非关键词扫描（F-S11）；D7 新规程上线前登记 supersede
    R-2026-007 并同步三处指针（lib/index.js:2131/2441、review-prompt 测试）。
  - 文档结构：新版为现行（二～九节），初版 A-01..A-18 降级附录存档
    （附录 A 裁决摘要/G 初版门控）；旧 P1～P6 阶段标签改名「旧P1..旧P6」防混淆。
  - 明确范围：纯文档/规划修订；未修改 lib/、scripts/、tests/、bots.json、
    profiles/、部署副本，未启动/重启 bot/host；无实现授权、配置修改授权、
    部署授权、重启授权。**当前门态 NOT READY/BLOCKED，重切片 v2 待提交双席
    独立复审，一致通过前不得启动任何实现切片。**

- ✅ 本轮：输入框模型/思考程度选择器改为 DSH 原生交互复刻：模型按钮打开非编辑弹窗，支持模型分组、思考程度子页、权限菜单上弹、原生尺寸/圆角/阴影/动画、键盘导航、Esc 分层返回、点击外部关闭，以及模型和 reasoning effort 持久化更新。
- ✅ 本轮（上下文窗口对齐，用户反馈「Bot 模式显示 1M 上下文而 DSH 原生显示 262k」）：
  - **根因**：Bot 模式 stats 的 `contextWindow` 来自会话日志最后一次 `request/context` 事件；该事件可能残留**历史模型**的上报值（切换模型前留下的，如旧 deepseek 模型的 1000000），导致当前展示与 Bot 实际所选模型的 DSH 解析上下文不一致。
  - **修复**：lib/stats.js 的 `contextPressureOf` 透出 request/context 的 `provider`/`model`；lib/index.js 新增 `alignContextWindowForBot`——优先级：① settings.yaml 的 llm-pi-ai 段显式 `contextWindow` **始终最优先**（F-T9：同模型日志旧值不得绕过显式配置）；② 无显式时日志 provider/model 与当前模型一致 → 保留上报值；③ 否则按 DSH provider 默认（deepseek-official=1000000，其余 llm-pi-ai provider=262144，与官方 `DEFAULT_CONTEXT_WINDOW` 一致）；lib/shared.cjs 新增 `explicitContextWindowFromSettings`/`resolveModelContextWindow` 纯函数。
  - **效果**：niko/gpt-5.6-sol（无显式配置）→ 262144（262k，与 DSH 原生一致）；显式配置 1M 的模型（opencode-go deepseek）→ 保留 1000000；不再把旧会话的 1M 误当当前模型容量。
  - 验证：新增 stats 透传断言 + 5 条 align 路由测试（含 F-T9 显式优先回归）；17/17 测试模块全绿；部署双份逐字节平价（lib/{index,stats,shared} 三文件）；浏览器实测 API 返回 lead/reviewer-second 均为 262144、reviewer-lead 1000000。
  - 口径说明：默认上下文窗口跟随 DSH 解析链（显式配置优先，缺失用官方默认 262144），不采用统一 1M 兜底；deepseek-official 官方默认即 1000000，属 DSH 同源默认而非插件硬编码。

- ✅ 第二轮（2026-08-22）：视觉层整体替换为「官方同源」实现（lib/client.js 全量重写）：
  - **零硬编码颜色/字体**：CSS 只引用官方令牌（`--dsw-specific-sidebar-fill`、`--dsw-alias-*`、
    `--dsw-static-deepseek-*` 等），明暗主题自动适配；删除了旧的双层 fallback 样式。
  - **官方组件直接复用**（`require("@deepseek-ai/dsh-client-ui-primitives")`，宿主 externals 同源单例）：
    - `Menu`：权限快速切换（anchor/portal 模式，与原生 permission 选择器同款浮层）
    - `Modal` + `Button`：新建/编辑 Bot 对话框（原生弹窗视觉与按钮）
    - `MarkdownText`：bot 回复的消息渲染（原生聊天同款 Markdown）
    - `Tooltip`：入口按钮提示；`writeClipboard`：复制 ID
    - 全部图标换官方 `Icon*`（Plus/PanelLeft/ChevronLeft/ChevronDown/Ellipsis/Send/Search/Close）
  - **原生规格复刻**（数值取自官方包 CSS）：
    - 侧栏：`sidebar-fill` 背景、padding 6px 12px、logo 行 60px、新建按钮 38px/圆角 12px、
      Bot 行 48px/圆角 8px（原生搜索结果行解剖：14px 标题 + 12px 预览）、行 hover `interactive-bg-hover`、
      选中 `sidebar-nav-item-active`
    - header：padding 12px 28px 0 20px、titleRow 32px、border-l2 底线（:after 1px）
    - 消息：748px 内容列（`--dsh-chat-content-width`）、用户气泡 `specific-bubble`/圆角 22/10px 16px/16px 24px
    - composer：`specific-input-major` 背景/圆角 22/16px 24px 字号、发送钮 34px `button-info-fill`、
      "+"按钮 28px、回底按钮 34px `button-floating-fill`
    - 详情面板：border-l2、header 14px、body padding 12px 16px（原生 details 列视觉）
  - **rail 折叠支持**：BotSidebar 读取 AppFrame 的 ownerProps `{collapsed}`，折叠时渲染
    56px 图标列（展开/退出按钮、新建图标、每个 bot 一个头像+状态点），与原生侧栏折叠一致；
    折叠开关走 `ctx.layout.toggleSidebar()`。
- 已验证（浏览器实测）：整页进入/退出、rail 折叠/展开、权限 Menu、更多菜单（lead 隐藏删除）、
  详情面板、编辑 Modal、Markdown 消息渲染、Esc 退出，全部正常；截图见
  preview/preview-fullpage-native.png / preview/preview-rail.png / preview/preview-modal.png。
- ✅ 第三轮（2026-08-22，用户反馈 4 项修复）：
  - **rail 图标对齐**：折叠态统一为 36×36 单列居中（退出/新建/Bot 头像/底部展开钮全部
    中心线 x=28，列宽 56px）；折叠开关在宽态位于 logo 行、rail 态移至底部。
  - **composer 完全复刻原生 InputBar**（对照官方 `uV2eYG_*` CSS）：卡片 gap:12 /
    padding-top:10 / 圆角 22；输入区 padding 4px 12px 0 16px、字号 16/24、min-height 52、
    max-height 336；底行 `justify-content:space-between` + padding 2px 8px 6px；"+"按钮
    28px `--dsw-specific-selector` 填充底 + hover `interactive-bg-hover-solid`；发送钮在
    trailing（margin-left:auto）34px `button-info-fill` translateY(-2px)。
  - **离线/错误提示条**：改为 `width:fit-content; margin:0 auto`（实测 209px < 卡片 780px），
    并把错误条移入 composer 容器内，与卡片同轴居中，不再超出对话框宽度。
  - **原生侧栏入口按钮**：复刻官方 footer 项规格（与 Team Monitor 同款）——宽态 49px 全宽行
    （icon 16 + 文案 14px、圆角 12、label-primary、hover `interactive-bg-hover-solid`）、
    rail 态 36px 圆形钮；接收槽位 ownerProps `{wide}`；去掉外层 Tooltip。
  - **footer 多入口布局与校对**（用户反馈：入口与团队监控并排挤压 / 间距不一致 / 图标文字未对齐）：
    - 注入 `[class*="footerActions"]{flex-wrap:wrap;row-gap:4px}` 使 footer 条目垂直堆叠，
      本入口独占一行显示在团队监控上方（原生容器是不换行 flex 行，多全宽项必然并排挤压）。
    - `[class*="footerActions"] .dsh-team-layer{margin-top:0 !important}` 归零团队监控层
      margin（槽位出口把条目包进 display:contents 匿名层，`>*+*` 命不中，需按类名指定）。
    - `[class*="footerActions"] .dsh-team-badge svg{width:16px;height:16px}` 把团队监控
      14px 图标提到 16px，与 Bot 入口、原生 Settings 对齐。
    - 校对结果（实测）：三入口图标均 16×16、图标左缘 18px、文字左缘 42px、垂直居中偏移 0、
      行间距 4px/4px（Bot↔Team↔Settings）——像素级一致；Settings 的负 margin（-2px）+
      8px padding 折算后有效左缘与另两行相同。
    - **行高统一（用户反馈：两个新增按钮 49px 与设置 42px 不一致，视觉间隔不齐）**：
      Bot 入口完全改用原生 Settings 触发器公式（`height:42px; width:calc(100% + 4px);
      margin:4px -2px 0; padding:0 10px 0 8px; line-height:22px; hover
      interactive-bg-hover`；rail 态 36px、`margin:8px 0 10px`）；团队监控徽章同样
      覆盖到 42px 公式（仅尺寸几何，hover 保留其原样式）。margin-bottom 统一 0，
      实测三行均 42px 高、行间距均 4px。
  - **rail 折叠态交互修正**（用户反馈：折叠后顶部是返回钮、无法再点折叠恢复）：顶部固定为
    展开/收起开关（宽态与折叠态同位置同图标，可往返），退出 Bot 模式按钮移到 rail 底部固定。
  - 顺带修复：BotOutlineIcon 增加 size 参数（此前无宽高会按 SVG 默认尺寸渲染）。
- ✅ 第四轮（2026-08-22，用户反馈：编辑弹窗 DSH 风格美化 + 功能检查）：
  - **表单控件完全复刻原生 ui-settings-models 编辑器公式**（对照官方 `zGbnIq_*` CSS）：
    输入框/下拉 32px 高、radius 8、border-l2、`bg-layer-1` 底、字号 14/22、focus 边框
    `brand-primary`（暗色 #f9fafb，变量定义在 body 上不在 :root）、placeholder `label-dimmed`；
    下拉 `appearance:none` + 官方内联 SVG 箭头（right 10px、padding-right 30）+ option 底色
    跟主题；textarea 同皮肤 min-height 76。字段 = 标签(12px/500/18 secondary)上、控件下、
    gap 6px；表单体 `width:min(520px,100%)`、字段间 gap 14px（原生 editor gap）。
  - **弹窗内错误文案**改原生纯文本样式（`state-error-primary` 12/18，无底色药丸——药丸样式
    保留给 composer 通知条）。
  - **Full access 二次确认改官方 `RiskConfirmation`**（与原生权限设置同款：勾选「我已了解
    风险」才解锁启用钮）；编辑弹窗与 header 快捷权限切换（RiskGate 组件，挂 BotMain）两条
    路径都走它，老 primitives 无该组件时回退 window.confirm。
  - **删除确认从 window.confirm 升级为官方 Modal**：标题「删除 Bot「name」？」+ 正文
    （label-secondary 14/24、width:min(480px,100%)）+ 危险按钮复刻原生 deleteConfirm 公式
    （36px 高、radius 18、红描边、hover `interactive-bg-hover-danger`）；流程拆
    askRemoveBot（开门）/confirmRemoveBot（执行）。
  - **Enter 隐式提交修复**：表单内补隐藏 submit 按钮（footer 主按钮在 form 外，多文本框
    表单无 submit 按钮时浏览器不做隐式提交），name 输入框 autoFocus。
  - **i18n 清理**：空名错误、模型目录加载中/失败提示、编辑标题中文引号、「（当前值）」后缀、
    删除失败/lead 不可删提示等硬编码中文全部 tr() 双语化。
  - 功能回归（浏览器实测全通过）：模型目录加载（provider 联动自动选首个模型）、空名校验、
    新建→侧栏出现、编辑预填/改名/保存、Enter（CDP 真实按键）提交、ESC 关弹窗不退出 Bot
    模式、RiskConfirmation 拦截/确认/警示提示、删除弹窗取消/确认（toast）、快捷权限 gate
    往返恢复；截图 preview/bot-modal-create.png / bot-modal-delete.png。
  - 测试环境备忘：browser-harness 的隐藏 tab 里 `document.hasFocus()=false`，所有元素
    `:focus` 伪类不匹配（原生输入框同样），焦点样式验证需 `activate_tab` 后才可信；
    页面挂起 JS 超时通常是 window.confirm 阻塞，用 `drain_events()` + CDP
    `Page.handleJavaScriptDialog` 解。
- ✅ 第五轮（2026-08-22，用户反馈：composer 与原生对比形制一致——大小比例/按钮位置/底部状态栏）：
  - **逐项对齐原生 InputBar（uV2eYG_*）并排实测**：卡片 780px/radius 22/gap 12/padTop 10；
    输入区空态 52px（修复 content-box 4px 偏差，补 `box-sizing:border-box`）/max 336/
    padding 4 12 0 16；底行 padding 2 8 6、space-between；+钮 28、发送 34 translateY(-2)
    hover 改 `button-info-hover`。
  - **按钮位置改原生排布**：底行左 = +钮 + modes 权限 pill（权限选择从 header 迁入
    composer，header 只留 More 菜单，与原生一致）；右 = trailing 模型 pill（显示
    bot.model，点击开编辑弹窗）+ 发送钮。pill 复刻 uV2eYG_select 公式（28px 高、
    radius 8、内联箭头 right 4、padding 0 20 0 8、13/500/20、hover bg-hover、
    max-width 220）。
  - **发送钮双态**：bot 回复进行中 → 停止钮（16×16 方块图标 rect rx3，POST /stop），
    复刻原生 primaryStops 行为；+钮/发送钮包官方 Tooltip（side top、delay 500）。
  - **卡片下方状态行（原生 StatsLine/FJxK0a 公式）**：居中、max-width 748、padding
    4 32 0、label-tertiary 12/20、nowrap 省略、分隔符「|」separator-primary 间距 10；
    内容 = 轮次 | 消息数 | 会话历时。
  - **消息区滚动容器对齐原生 ChatView（Md3f7G_scroll）**：padding 24 20 → 16 32；
    toBottom 按钮对齐基准从卡片宽 780 改为内容宽 748（margin-top -40 → -34），
    与原生 toBottomSlot 公式 1:1。
  - **提示条**：离线条复刻 uV2eYG_notice 公式（全宽限 780、interactive-bg-hover、
    label-secondary、radius 8、mb 6、padding 4 8、12/18；补 border-box 与卡片同宽）；
    发送/轮询错误改官方 Toast 锚定 composer 卡片（无 Toast 组件时回退 danger 条）。
  - 顺带 i18n：附件/发送/停止错误文案、placeholder、notice 全部 tr() 双语化。
  - 实测对比（原生 hero 态 vs bot 模式）：卡片 780=780、输入 52=52、padding 逐项相等、
    +钮 28=28、发送 34=34；截图 preview/bot-composer-online.png / preview/native-composer.png。
- ✅ 第六轮（2026-08-22，用户反馈：状态栏不整齐且未完全复刻 + 缺上下文占比标识）：
  - **后端新增 GET /api/bots/:id/stats**：从 bot 会话事件日志（session.history RPC）
    推导与原生完全同源的四个 projection——移植 dsh-client-connection 的派生层：
    tokenUsage（同 turn+step 增量替换累计）、sessionStats（轮次/步数/LLM/工具/首 token/
    解码吞吐全事件折叠）、contextPressure（最近 usage 样本 + request/context 窗口）、
    contextBreakdown（4字符/token 启发式估算，按实测 pressureTokens 等比缩放对齐）。
    离线/无会话 → {stats:null}。**后端变更需重启 `dsh web` 宿主**（无热重载；
    bot 子进程是独立孤儿进程，宿主重启后按注册表 pid 重新识别在线状态）。
  - **状态栏完全复刻原生 StatsLine**：四组原生格式「{turns} 轮 · {steps} 步 |
    LLM {d} · 工具调用 {d} | 首 token 平均 {d} · {t} tok/s | 缓存命中 {p}% |
    输入 {i} tok · 输出 {o} tok」，格式化函数（fmtTokens K/M、fmtDuration 45.2s/2m42s、
    cacheHitPercent 原生二分取整含 99.9x 极限显示）逐行移植；整齐度由原生
    「sep span margin 0 10px + 文本空格」结构与 12/20 tertiary 居中公式保证。
    实测 lead：3 turns · 52 steps | LLM 2m57s · Tool calls 1m22s | cache hit 98%
    | in 1.3M tok · out 12.7K tok。
  - **ContextMeter 复刻（JObwrW 公式）**：发送键旁 28px 圆钮内 14px 环形 SVG
    （r5.5、stroke 2、rotate -90、dasharray=周长×百分比、track border-l3 / fill
    label-tertiary）；点击弹 264px 面板（menu 底/inverted 边/lv3 影/radius 12）：
    标题行「上下文已用 4% ~39.8K / 1M」+ 4px 三色分段条（系统=bluish-400、
    工具=#a78bfa、消息=blue-450）+ 图例 dl；外部 pointerdown / ESC 关闭；
    无数据时整个组件不渲染（原生行为）。数据 2s 随消息轮询同拉。
  - **权限触发器改原生 PermissionSelect（Sh0Q9G）公式**：radius 24 胶囊、
    盾牌字形（read-only 勾盾 / workspace-write 笔盾 / full-access 感叹盾，原生
    path 数据逐点移植）+ 标签 + 12px 箭头（开时旋转 180°）、hover bg-hover、
    focus-visible 双环；模型 pill 复用同款基座（标签+箭头）。
  - 截图 preview/bot-composer-final.png / bot-ctx-panel.png。
- ✅ 第七轮（2026-08-22，用户反馈：离线 bot 页面状态栏与上下文标识消失）：
  - **根因**：stats 只走在线 RPC，bot 离线 → {stats:null} → 两个元素都不渲染。
  - **离线回退读盘**：会话事件日志落盘在 `~/.dsh/sessions/<cwd 编码分片>/<sessionId>/
    session.jsonl.zstd`——**多帧 zstd**（每事件批次一个独立 flush 帧，尾帧可能未收尾），
    普通 zstdDecompressSync 只解出第一帧（这就是"文件 79KB 却只有 1 行"的假象）。
    移植官方 scanZstdFrames 逐帧扫边界 + 逐帧 zstdDecompressSync + torn 尾帧用
    `finishFlush:ZSTD_e_flush` 解；分片目录名 = cwd 的 / 替换为 - 再首尾加 -，
    另有全目录扫描兜底。stats() 改为：在线 RPC → 离线读盘 → null。
  - **纯 relay bot 降级组**：会话从未跑过 agent 轮次（sessionStats 全零）时，前端
    降级显示消息摘要组（「N 轮对话 | M 条消息」，同款 12/20 tertiary 样式），
    保证状态栏常在；ContextMeter 仍需真实 usage 数据（无 agent 数据 = 无上下文可谈）。
  - 实测三态：领队（在线 RPC）3轮52步+98%缓存；眼睛（离线读盘）9轮9步；
    研究员（离线读盘）15轮15步+92%缓存——三个页面状态栏与上下文环全在。
    截图 preview/bot-offline-stats.png。

- ✅ 第八轮（2026-08-22，清理 + 安全/可靠性加固 + 性能优化）：
  - **清理**：删除 stats() 的 3 处 console.error 调试计时；diskStatsCache 加
    64 条上限淘汰。
  - **安全加固**：/api/bots 入口拒绝 `Sec-Fetch-Site: cross-site`（防浏览器
    CSRF——前缀路由绕过官方 /api 连接层，且 readBody 不校验 Content-Type，
    text/plain 可绕预检；无该头的 curl/老浏览器不受影响，fail-open）。
  - **可靠性加固**：stop() 前用 /proc/<pid>/cmdline 校验 pid 归属（防 host
    重启后 pid 复用误杀无关进程，非 Linux 放行）；spawn/exit 事件回调里注册表
    读写包 try/catch（防 bots.json 损坏时 uncaughtException 拖崩宿主）；
    stats() 在线 RPC 失败自动降级读盘；前端 Esc 守卫补齐 deleting/riskPending/
    ContextMeter 面板（此前删除弹窗按 Esc 会连退 Bot 模式）；删除 bot 时同步
    清理 statsByBot。
  - **性能优化**：① 新增 lib/shared.cjs 收敛双副本（删 ~150 行重复）；
    ② GET /messages 加 inbox+outbox mtime/size 签名缓存（2s 轮询不再全量
    读盘解析）；③ inbox watcher 改字节偏移 + pending 缓冲增量读（撕裂行/
    多字节字符跨读均实测正确）；④ fmtElapsed 双语化；⑤ handleAttach 缩进
    归位。
  - 已知未改：API 无 token 鉴权（靠 localhost + Sec-Fetch-Site）。原
    create-bot.cjs 不写 pnpm-workspace.yaml 的历史差异已对齐（幂等补写，
    与内置回退等价）。

- ✅ 第九轮（2026-08-22，bot→bot 发信能力：send_mail 工具 + 自动回信路由）：
  - **共识**：终局 = bot 团队协作；此前邮局与 relay 展示都在，但 bot 没有任何
    发信手段（lead 是 read-only，连 append inbox 都做不到），团队编排是空转。
    用户选定「邮件工具」方案。
  - **send_mail 工具**（registerBotMailTool，bot 实例内经 `ctx.get("tools")`
    响应式注册，宿主 web 不注册）：把邮件 append 到目标 bot 的 inbox
    （from = 本 bot id）。零依赖——手工按 `ctx.tools.register` 的原始形状构造
    （defineTool 只是该形状的编译器），schema 仅用官方强制子集关键字；
    `to: ""` / 未知 id → 返回可用收件人名单（name + role 摘要），agent 可
    自纠错；不写注册表（避免与宿主跨进程写 bots.json 竞争）。
  - **自动回信路由**（handleIncoming）：消息来自其他已注册 bot 且非回信
    （kind !== "mail-response"）→ 回合完成后除写本 bot outbox 外，自动把
    回复投回发件 bot 的 inbox（kind: "mail-response"）。回信类消息照常触发
    回合（领队消费结果、可再显式 send_mail 追加任务）但不再自动回路由——
    防两个 bot 互回复无限 ping-pong；用户消息行为不变（只回 outbox）。
  - **寄件人上下文**：bot→bot 邮件的 prompt 前缀 `[mail from bot "X"]` /
    `[mail reply from bot "X"]`（收信 agent 只能看到正文，看不到寄件方会话）。
  - 已验证：工具单元 9 项（含全部拒绝分支、seq 连续、render、无 tools 服务
    静默跳过）；假 RPC 服务器端到端 9 项（任务→回合→自动回信、mail-response
    不回路由、用户消息不路由、前缀正确）；官方 dsh-tools 校验器 11 项
    （assertSupportedJsonSchema / args / 各形态返回值 / 非法值拒绝）。

  - **真实 E2E 通过**（活体验证，全链路 10 秒闭环）：user 下发任务 → lead 的
    agent 实际调用 send_mail（研究员 inbox 收到 from=lead 邮件，+5s）→
    研究员 watcher 触发真实回合回复「收到，E2E 通过」→ 自动回信落 lead
    inbox（lead 会话内可见 relay）→ lead 第二回合消费回信并汇报
    「send_mail 端到端链路验证成功」。

- ✅ 第十轮（2026-08-22，自然语言内置委派：团队提示段 + 名字寻址）：
  - **用户要求**：向领队用纯自然语言描述需求，不在消息里声明工具与方式；
    委派必须是 bot 内置能力。此前缺口：agent 上下文里没有队友名单，
    纯自然语言时 lead 不知道有谁可派（E2E 成功靠消息里点名了工具与 id）。
  - **团队提示段**（registerTeamPromptSection，经官方 systemPrompt 服务）：
    variable 提供器每次 prompt 组装现读注册表 + section（order 20）注入
    「自我介绍 + 实时队友名单（id/名字/角色/在线状态）+ 协作协议」。
    名单永远新鲜（新建/删除/改名队友下一回合自动生效，无需重启）；
    注册表损坏降级占位文案，绝不拖垮 prompt 组装。
  - **send_mail 名字寻址**：to 支持 id 或名字（大小写不敏感唯一匹配），
    重名歧义拒绝并提示用 id；成功返回规范 id 供模型后续使用。
  - 单元 13 项（变量/section 形状与官方约束一致、名单实时性、损坏降级、
    名字寻址/自己/重名）；**自然语言 E2E 通过**：消息不含任何工具名/
    队友名/id（"请安排合适的队员做一次链路测试…"），lead 自主选了研究员
    发邮件（+10s）→ 研究员回复（+15s）→ lead 第二回合转告原话（+20s）。
  - **队员间多轮讨论已实测可用**：机制 = 每封信必得一次自动回信，继续谈
    就继续显式发信（防 ping-pong 只拦自动互回，不拦续聊）。实测要求 lead
    与研究员各发言两轮，50 秒完成（抛观点 → 校准概念 → 第二轮 → 确认
    共识 → 输出讨论纪要），零代码改动；任意两个队员可直接讨论
    （所有 bot 同工具 + 同名单）。

- ✅ 第十一轮（2026-08-22，创建 Bot 的角色规范产品化）：
  - **背景**：用户要求把「角色描述决定委派质量」的使用提示合并成创建
    流程内的功能规范（用户只会自然语言提需求，不会手把手写提示词）。
  - **BotModal 角色字段升级**（新建/编辑同规则）：
    - 必填校验：角色描述为空不可提交（错误文案说明它是领队委派依据）；
    - 四要素规范模板一键插入：「职责：/专长：/边界：/产出：」骨架
      （空时填入，非空追加不覆盖），按钮 + placeholder 示例 + 说明 hint
      （告知该描述会实时注入队友系统提示）；
    - 实时质量提示：非空但 <10 字时黄色警示「领队可能无法准确委派」
      （非阻塞）。
  - 后端 API 保持宽容（不做格式强制，UI 是规范执行点）；顺带修复角色
    字段 id 的历史拼写错误（dsh-bols- → dsh-bots-f-role）。
  - 本环境无浏览器后端，GUI 未实测；语法/静态核对通过，待用户刷新页面
    肉眼验收。

- ✅ 第十二轮（2026-08-22，对话页「以我为主」：队友往来折叠为讨论标识）：
  - **用户要求**：与某 bot 对话时只看「我 ↔ 它」的主线；它与其他 bot 的
    讨论不显示完整内容，用标识说明在讨论即可，最后只呈现对用户的回应。
  - **MsgList 重写**：来自其他 bot 的连续同源 relay 消息折叠为一组
    DiscussionGroup——一行胶囊标识（头像 + 「与 X 的讨论」+ N 条往来 +
    最后时间 + 展开箭头），默认收起；点击展开可看原始消息（保留彩色
    边线 + Markdown 渲染）。换发件人另起组；被普通消息打断后另起组。
    from=bot 的叙述/最终回复正常可见（那就是它对用户的回应）。
  - **TurnStatus 细化**：等待回复且最后一条来自其他 bot 时，状态条由
    「工作中…」变为「正在与 X 讨论…」（shimmer 同款）。
  - 纯前端改动（数据层 /messages 仍返回完整会话）；分组算法 6 项规则
    验证通过；本环境无浏览器后端，视觉效果待用户刷新页面验收。
  - **展开区灰色小字（DSH 原版弱化样式，第十三轮）**：展开讨论组后详细
    消息按官方模式渲染——`font:var(--dsw-font-xxs-12)` 官方小字号令牌 +
    `label-tertiary` 灰；关键手法是在容器上**遮蔽令牌**
    （`--dsw-alias-label-primary/secondary/caption` 全部重定向到 tertiary，
    官方 MarkdownFragment 即「包裹层控色」模式），MarkdownText 内部任何
    按令牌取色的元素整体变灰；另用 `:is(p,li,h1-h6,code,…)` 兜底强制
    继承字号/行高/颜色（保字体族）。组内同源消息去掉名字头与彩色边线
    （组胶囊已标识身份），仅保留 11px 时间行；顺带清理 botHue/relay
    边线死代码（含吸收用户手改的 msg-relay 灰字试验样式）。
  - **微调（用户反馈）**：正文再降一档到官方最小字号令牌
    `--dsw-font-xxxs-11`（11px，与主线 14px 明显区分）；恢复按发件人
    着色的左侧竖线条（botHue 稳定色相，2px + padding-left 10px）。

- ✅ 第十四轮（2026-08-22，外部审查共识落地：批次①+②+持久回归）：
  - **背景**：一份外部代码审查 + 双向质询达成共识。关键修正：仓库此前**没有任何
    落盘测试**（历轮"单元 N 项"均一次性脚本），批次③的真实成本须计入重建
    回归脚本；「region 已清楚」不成立（14/13 失衡、自动回复区吞 950 行），
    拆分降温的正当理由是"收益不足以抵偿验证成本"。
  - **批次①（全做完）**：删除 create-bot.cjs 死代码 yamlQuote（第八轮收敛
    遗漏）；悬空 JSDoc 归位 runNativeAgentTurn；region 按实际内容重划为
    顺序六区（身份检测与 RPC 工具 / 会话统计推导 / agent 回合 / 会话自愈 /
    自动回复与邮件协作），16/16 配对；handleIncoming 缩进修正；create()
    端口竞争防护（fresh 重查 + allocatePort，端口不进 profile 故无副作用）；
    脚本端口校验统一 1024-65535；lead 脚手架改 fire-and-forget（不再阻塞
    apply/路由注册，最长 60s 的阻塞只在 lead 被配置模型字段后才会发生）。
  - **批次②**：ChatView 轮询——document.hidden 时完全暂停 + visibilitychange
    回前台立即补拉；stats 从每 2s 降到每 3 tick（≈6s，在线路径每次是
    maxMessages:2000 全量 RPC，非实时敏感数据）。
  - **持久回归（新增 tests/，npm test）**：registry.test（原子写 roundtrip/
    损坏处理/uniqueId/allocatePort/端口竞争语义）、rpc-envelope.test（假
    RPC 服务器验证 client-request 信封形状 + create→prompt→poll→reply
    状态机 + session 复用）、jsonl.test（损坏行容错/会话合并/since/kind）。
    3/3 两次连跑稳定通过——批次③（parseJsonlLines/writeFileAtomic/
    readBotSessionId/双 RPC 合并/stats 拆出）的地基已就位。

- ✅ 第十五轮（2026-08-22，批次③：去重 + stats 拆出，回归网下完成）：
  - **lib/stats.js 新模块**（339 行）：四大 projection（tokenUsage/sessionStats/
    contextPressure/contextBreakdown）+ 多帧 zstd 读取 + diskStatsCache 整体
    从 index.js 迁出，暴露 deriveStats(events) / offlineStats(dshHome,workspace,
    sessionId)。隔离理由＝上游官方移植件的生命周期跟随官方演化。index.js
    回到 2238 行的主线叙事（注册表/进程/邮局/脚手架/BotsApi/HTTP/watcher）。
  - **四项收敛**：dshRpc(port,method,payload,{rpcPrefix}) 合并 botRpc 与
    runNativeAgentTurn 的 rpc 闭包（连续超时计数留在调用方叠加，信封/解包
    单源）；readBotSessionId 收敛三处 .dsh-bot-session.json 解析；
    parseJsonlLines 收敛四处「split→trim→跳损坏行→parse」循环（maxSeq/
    inbox/outbox/watcher scan）；writeFileAtomic（shared.cjs）收敛三处
    tmp+rename 原子写（注册表/自愈计数/llm-pi-ai 段），session 状态写也改用。
  - **tests/stats.test.mjs 新增**：deriveStats 合成事件精确断言（同回合用量
    去重/耗时/首token/解码/工具/压力/构成缩放±2 舍入容差）+ offlineStats
    多帧 zstd（逐帧独立压缩拼接验证 scanZstdFrames 必要性——单帧解压只剩
    第一帧；撕裂尾帧容错；无日志全零；缓存稳定）。
  - 修了测试自身的两处抖动/错误：rpc-envelope 第二轮改新端口+改写注册表
    （undici keep-alive 与同端口重监听竞争偶发 other side closed）；toolMs
    断言算术错。**4/4 × 5 连跑全绿**。部署后宿主+双 bot 已重启，stats
    接口 200，宿主日志零错误。

- ✅ 第十六轮（2026-08-22，批次④：前端三去重 + layout 探路落地）：
  - **useDismiss 共享 hook**：MoreMenu 与 BotContextMeter 各自手写的
    「pointerdown 外点 + Escape 关闭 + 可选归还焦点」document 监听收敛为
    单一 effect（deps=[open]，open 翻转才重挂监听，与原两处行为等价；
    instanceof Node 守卫是两处的安全并集）。
  - **errorToast 辅助函数**：poll/send 两处「官方 Toast 可用→锚定卡片浮动，
    否则回退 notice 条」三元分支合并为单源。
  - **模型输入分支合并**：catalogError 与 modelsByProvider===null（加载中）
    两分支渲染同一手动输入框、仅提示文案不同——合并为一个分支内三元。
  - **layout 服务探路（结论）**：官方 `dsh-client-ui-layout` 的
    LayoutController 只暴露动作（toggleSidebar/openDetails/closeDetails），
    面板 store 私有、无任何读取 API。折叠态只有两个公开信号：frame 元素
    的 `data-sidebar-collapsed` 属性（全局唯一写入点）与 sidebar 槽
    ownerProps.collapsed。据此把窄屏自动展开探测从脆弱的
    `querySelector('[class*="frame"]')`（依赖 CSS module 类名含 "frame"）
    换成 `querySelector("[data-sidebar-collapsed]")`（官方契约本身）。
    SIDEBAR_AUTO_COLLAPSE=1024 与现有 innerWidth<1024 判断一致。
  - 验证：node --check 通过、npm test 4/4 全绿、部署后哈希一致、宿主 200
    零错误。client.js 仅需页面刷新生效。

- ✅ 第十七轮（2026-08-22，测试覆盖补全：watcher 游标 + 回信路由）：
  - **tests/watcher.test.mjs**：真实文件驱动 startInboxWatcher，等
    WATCH_POLL_MS(1s) tick。消费的可观测信号＝outbox 行数（bot 注册到
    bind 后即 close 的必拒端口，每条被消费消息经 handleIncoming 错误
    路径恰写一行 [bot error]；成功回合路径由 reply-route 覆盖）。
    三场景：追加恰消费一次且重复 tick 不重放；撕裂半行不处理、补全
    换行后 pending 承接恰处理一次；截断（size<offset）游标重置后存量
    跳过、新增恢复正常消费。启动存量不回放也有断言。
  - **tests/reply-route.test.mjs**：复用 rpc-envelope 假 RPC 先例，双 bot
    注册表直调 handleIncoming 四场景：任务邮件（from=bot）→ outbox
    回复 + 发件 bot inbox 收到 kind:"mail-response" 且文本一致（另断言
    `[mail from bot "a"]` 寄件前缀）；mail-response → 仍进 outbox 但
    不再路由（防 ping-pong，`[mail reply from bot "a"]` 前缀）；
    from=user → 只进 outbox 不加前缀；from=未注册 id → 不抛错、不路由、
    不创建 inbox。假服务器按 prompts 累积回合 → 依次返回 REPLY-1..4
    精确断言（runNativeAgentTurn 取 baseline 后最新 turn/end 的
    assistant 文本）。
  - **6/6 测试文件 × 5 连跑全绿**（新增两文件共 7 个断言组，覆盖两处
    历史 bug 高发区：撕裂行跨读、mail-response 防乒乓）。
  - LayoutController 完整结论（面板 store 私有、三动作无读取面、两个
    公开信号＝frame 属性 + sidebar 槽 ownerProps.collapsed）回写进
    client.js enter() 处注释并重新部署。
  - 归档口径：refreshBots 简化＝首轮审查原始发现、未立项、随时可顺手。
    CHANGELOG 拆分从「可选」升级为「排进下次迭代」（文档每轮 +1.5KB）。

- ✅ 第十八轮（2026-08-22，文档拆分：CHANGELOG 独立）：
  - 第二~十七轮逐轮记录自 PROJECT_UNDERSTANDING.md 原样迁出至本文件
    （不改写历史）；主文档保留常青内容（目标/方向/关键文件/当前状态
    架构/前端备忘/可选方向），轮次明细由「演进里程碑」摘要 + 链接承接。
  - 主文档 36K → ~7.5K，止住每轮 +1.5KB 的恶化斜率；今后新条目只进
    本文件。顺带补齐关键文件清单（lib/stats.js、tests/、CHANGELOG.md）
    与可选方向归档（refreshBots 未立项、API token 待想清威胁模型）。

- ✅ 第十九轮（2026-08-22，全量审核落地：1 低危 + 3 琐碎 + 1 审查遗漏项）：
  - **L-1 修复（自愈重试丢寄件人前缀）**：handleIncoming 自愈分支改传
    promptText（含 [mail from bot "x"] 前缀）而非裸 message.text——原回合
    与重试回合现在看到同一上下文。
  - **审查遗漏的次生缺口同修**：catch 自愈成功路径此前只写 outbox、
    不回路由发件 bot（路由块只在 try 路径）——bot→bot 任务邮件触发自愈时
    协作闭环断裂。现抽取 routeReplyToSender 共享函数，成功与自愈成功
    两条路径统一回路由；错误路径维持不路由（避免错误邮件骚扰发件方，
    既有语义不变）。
  - **T-3 随重构消去**：`if (reply === undefined) throw error` 不可达
    守卫删除（if/else 均赋值；appendOutbox 抛错则直接传播，由 watcher
    scan 的 try/catch 兜住）。
  - **T-1**：BotModal 的孤儿 docblock（悬挂在 DeleteBotModal 之上）归位
    到 BotModal 定义处并补充角色规范指引；**T-2**：BotModal return 块
    （117 行）与 BotMain Escape effect 块（13 行）从 2-tab 基准归位到
    组件通行的 3-tab，含函数收尾 brace 残留 1-tab 一并修正。
  - **reply-route 场景 8（自愈回归）**：假 RPC 加 corruptNextPrompt 开关
    （session.prompt 首答 result.ok=false 的 corrupt 错误且不计数）——
    断言重试 prompt 文本＝带前缀原文、outbox 回复带「已归档并重置」说明、
    自愈成功同样回路由（文本一致）、session-backups 归档落地。
    6/6 × 4 连跑全绿。
  - **卫生**：12 张开发截图（1.7MB）迁 preview/ 子目录，CHANGELOG 5 处
    引用同步更新。核实修正审核报告一处事实错误：部署链是选择性文件
    拷贝，截图从未进入 ~/.dsh/plugins/dsh-bots（实际清点仅 4 类文件）。
  - 可选方向补观察项：handleApi/BotsApi.patch 回滚语义无直测，动 patch
    前先补。
  - 验收后补：handleIncoming 头注释被 routeReplyToSender 插入架空（T-1
    同款复发，第十九轮验收发现），已归位并补「自愈成功同样回路由」说明；
    纯注释变更，运行中宿主无需重启。

- ✅ 第二十轮（2026-08-22，预览/悬停提示价值审计：删 3 处低价值）：
  - **侧栏 bot 行悬停预览（用户主诉）**：预览行的 title=完整最近消息文本
    删除——原生 tooltip 不换行可横贯全屏，且全文点击一次即得；行内可见
    的截断预览线保留（与 DSH 原生侧栏会话行同构）。
  - **BotAvatar title=bot.name 删除**：5 处使用点（侧栏行/rail 钮/讨论
    胶囊/消息头/header）全部有相邻名字文本，纯冗余。
  - **statsline title 删除**：内容与可见文本完全重复；且核对官方
    FJxK0a StatsLine 源码本就无 title——回归官方同源。
  - 保留项（有价值）：权限 pill（图形唯一文本来源）、在线点（色觉无障碍
    文本确认）、rail 钮（纯图标识别）、ContextMeter 环（精确百分比）、
    全部图标钮（More/展开/附件/退出/折叠/新建/返回/关闭/入口）、模型
    pill（点击编辑交互提示）、权限选择器（交互说明）、侧栏行与 header
    名字（截断时唯一全文来源）。Modal 的 title 是对话框标题非提示，
    不在审计范围。
  - 验证：node --check + npm test 6/6 + 部署哈希一致；刷新页面生效。

- ✅ 第二十一轮（2026-08-22，statsline 悬浮回归官方条件 Tooltip 方案）：
  - 第二十轮验收深挖纠正：官方 StatsLine 并非「无悬浮」，而是 ResizeObserver
    测量截断、disabled:!truncated 的官方 Tooltip 仅在真截断时启用——
    我删 title 后截断内容彻底不可达，旧常驻 title 冗余，两态皆非。
  - **BotStatsLine 组件**（官方 FJxK0a 方案逐条移植）：useLayoutEffect
    deps=[line] 立即测量 + ResizeObserver（undefined 守卫）观察自身，
    未截断零提示、真截断悬浮整行；空组返回 null；react 解构补
    useLayoutEffect。与 ContextMeter/发送钮已用的 primitives.Tooltip 同源。
  - 验证：node --check + npm test 6/6 + 部署哈希一致；刷新页面生效。

- ✅ 第二十二轮（2026-08-22，T-1 第三例修复 + 孤儿 docblock 立械）：
  - **第三例**（第二十一轮验收发现）：BotStatsLine 插入点选在
    `function PickHint` 前，PickHint 的 docblock 被架空——与
    routeReplyToSender（index.js）、BotModal（client.js）两例完全同构。
    已归位。
  - **机械规矩**（三连击后从「一句自查」升级为可执行断言）：
    tests/hygiene.test.mjs 扫全部源码文件——docblock 结束后（中间只允许
    空行）紧跟另一 docblock 即违规，报文件:行号。当前全库零违规；
    用历史案例形状夹具自证检测器会报警（非恒真断言）。
  - 规矩本身：在既有函数前插入新函数时，检查插入点上方是否是别人的
    docblock——是则带着它一起走或改插到别处。
  - 验证：node --check + npm test 7/7（新增 hygiene）+ 部署哈希一致。

- ✅ 第二十三轮（2026-08-22，检测器自测入网：网自身也进回归网）：
  - 第二十二轮验收建议采纳：hygiene.test.mjs 重构为 findOrphanDocblocks
    函数 + 三个内联夹具先行断言（历史相邻双 docblock 形状命中 / 隔空行
    变体命中 / 正常代码零误报）+ 真实五文件清零——检测逻辑被改哑即红，
    不再依赖对话里的临时自证。
  - **自测夹具当场抓到检测器真实缺陷**：旧实现用「任意行尾 *斜杠星」
    启发式，行尾内联块注释后紧跟正常 docblock 会误报（真实文件碰巧
    未踩中）。改为精确两遍扫描：先标记真正的 docblock 收尾行（docblock
    起始到第一个含收尾符的行），内联块注释不参与判定。
  - 如实记录：修注释时又把字面收尾符写进注释文本导致语法错误一次
    （块注释内出现收尾符会提前终结）——已改用文字描述。
  - 已知局限（验收方记录，不处理）：插入不带注释的新函数直接吃掉旧
    docblock 的错误归属无连续 docblock 症状，本网不拦。
  - 验证：npm test 7/7 全绿。纯测试文件变更，无部署需求。

- ✅ 第二十四轮（2026-08-22，协作协议硬化：replyTo 线程关联 + 条款 v2）：
  - 源起：第三方调研（多 Agent 框架功能与代码级对照）→ 三方互审收敛为
    PROPOSAL-threads-and-clauses.md（讨论稿：共识/提案/批注/四题裁决），本
    轮按该文档 §7 原子切片规划执行 A→F。
  - **切片 A（红）**：reply-route 场景 4/8 加 replyTo 断言（routed[0].replyTo === 1、
    healedRouted[1].replyTo === 5），单跑确认红态（断言精确命中，防恒真）。
  - **切片 B（实现）**：appendMessage 加可选 replyTo（Number.isInteger && > 0
    才写入）；routeReplyToSender 投递传 replyTo: message.seq。不变量：
    **replyTo ⟺ kind === "mail-response"**（唯一写入点 routeReplyToSender；
    send_mail 投递与用户消息边永不带）。7/7 转绿。
  - **切片 C（条款 v2）**：registerTeamPromptSection 协作协议从三条增至六条
    ——委派自包含 / 回信只交结论（做了什么·如何验证·已知边界）/ 升级是
    一等动作（以 [ESCALATE] 开头发给领队，正文中文写明卡点、已试、谁拍板）。
    v1 为纯劝导，无检测代码；检测规格（/\[ESCALATE\]|\[升级\]/i，整段匹配、
    不锚定行首、容忍空白与全角变体）为前瞻契约。
  - **切片 D（文档）**：PROJECT_UNDERSTANDING 增协作协议要点（consult 语义、
    模型异构成本玩法、replyTo 不变量）；tests 计数 6→7（hygiene 入网）。
  - **切片 E（部署）**：lib/index.js 与主文档部署 md5 一致；旧宿主 48117 按
    PID 终止，新宿主（21:05 后启动）经软链解析到更新模块；活体验证双 bot
    在线、lead/stats HTTP 200。
  - 对齐记录：send_mail = consult 语义（异步、发起方保留控制权、无 handoff
    对应物——常驻进程邮局模型没有"活跃槽位"可移交）；别名裁决＝文案保持
    单一规范形 [ESCALATE]、检测正则兜底变体（枚举别名会放大模型输出方差）。
  - 验证：npm test 7/7 全绿；node --check 通过；PROPOSAL 标记已实施·归档。

- ✅ 第二十五轮（2026-08-22，F-1 修复：Q3 lead 半边回流）：
  - 复审方第二十四轮审查发现（低severity）：Q3 裁决"都入文"只落了 worker
    半边——条款 6 对所有 bot 统一说"发邮件给领队"，领队自身照做即发给自己；
    缺口根源在提案文档内部一致性（§6 裁决未回流进 §2.2/§7 切片规格），
    实施者忠实执行了 §7。
  - **失败模式定性修正（评审方复核）**：非"自守卫静默死信"——send_mail 的
    目标选择含 `to !== botId`，lead 自寻址在工具层即被拒绝（模型收到 rejected
    提示与名单）。危害略低于审计描述，但升级路径对 lead 确实断裂，F-1 成立。
  - 修复：条款 6 尾部追加"（你就是领队时：直接在与用户的对话中说明，不用
    此前缀。）"；主文档协议块同步该措辞，并补 replyTo 解析规则一行（复审方
    观察项 1）；PROPOSAL §6 Q3 加实施补记标记。
  - 验证：npm test 7/7 全绿；node --check 通过；部署 + 宿主重启 + 活体验证。

- ✅ 第二十五轮审查补记（2026-08-22，supervisor 传闻证伪 + 宿主无守护入档）：
  - 审查方复核第二十五轮：条款 6 lead 半边、replyTo 解析规则入主文档、
    三处文档、7/7、四文件 md5、宿主 51835 时序——全部独立复现属实；
    工具层拒绝的定性修正成立（send_mail id/名字寻址均过滤自己 → rejected
    附名单，第二十四轮「自守卫静默死信」系机制描述错误，当场确认）。
  - **基础设施发现被受控实验证伪**：kill 51835 后 90s 轮询无任何重生；
    PPID 13566 实为登录 shell -bash（stdio 接 pts/2，与宿主同终端），
    「自动拉起」最可能是被中断的 kill 未完成或终端前手动重启，同 PPID
    只是同终端启动的自然结果。据此否决「kill 即可、supervisor 重生」的
    操作建议——照做会直接停机。
  - 审查方已手动重启宿主（新 PID 52237，web/stats 200、双 bot online、
    日志零错），并在主文档部署链写入「宿主无守护进程」备忘（重启完整
    链：部署拷贝 → 按端口找 PID kill → nohup 拉起 → 活体验证）。
  - 后经用户确认：两次「自动拉起」均为其在 pts/2 终端前的手动重启——
    推测落定为事实，证伪结论不变，且「kill 即走」的危险性加倍（重启
    依赖有人正好在看终端）。

- ✅ 第二十六轮（2026-08-22，第一项从预算清单落地：HTTP 路由层 + patch 回滚直测）：
  - 选题裁定（先审计再动）：预算清单第 1 项「Bot 详情挂原生 details 槽」实测为硬
    阻断——AppFrame 在无 current session 时把 details 列宽恒压 0（
    `detailsSession === void 0 ? 0 : panels.details`），Bot 模式无会话 ⇒ slot 不入驻；
    若要实现只能伪造会话或改布局源码，均违背整页独立/不 hack 方向，否决并入档
    主文档 DSH 前端架构要点。第 2 项「composer 模型显示」已有原生视觉 pill
    （dsh-bots-pill），无需再做。故选第 7 项：为最脆的 handleApi 路由层与
    BotsApi.patch 回滚语义补直测。
  - **切片 A（测试，tests/route.test.mjs 8 项）**：全走真实 handleApi/BotsApi（不用 mock，
    直连临时 dshHome 注册表），顺序驱动天然触发 scaffold 失败以测回滚。
    - 分发：list/detail 200、未知路径 404、错误方法 405、未知 action、缺 id 404；
      CSRF（sec-fetch-site: cross-site → 403，缺头 fail-open 放行）。
    - patch 校验：空名/坏权限/坏端口 → 400 且注册表不变；端口冲突 → 400；
      未知 id → 404。
    - patch 成功语义：group 变更（changed=false，不触发脚手架）→ 200 注册表更新；
      permission 变更（changed=true）→ 200 注册表更新 + 断言脚手架产物已生成
      （该测试只证明脚手架**跑了**，单测本身不断言先后顺序）。
    - **回滚不变量（scaffold-before-write 的顺序由本测试建立）**：把 `profiles/<id>`
      预创建成普通文件，内置脚手架 `mkdirSync` 抛 EEXIST → scaffold 失败 → 500
      且注册表保持原值 ⇒ 写发生在脚手架成功之后——与上一条合并构成完整不变量。
  - **切片 B（实现）**：`internals` 增补导出 `BotsApi`、`handleApi`（纯测试槽位，不改
    行为）；顺带修复被测出的路由语义缺陷——未知 action 走 GET 时被「必须 POST」blanket
    分支误判 405，改为按动作判定（已知动作各自 gate 方法，未知动作恒 404）。
  - **切片 C（文档）**：主文档「后续可选方向」重排（第 1/2/7 项分别标记 否决/已实现/
    已完成），DSH 前端架构要点增补 details 槽硬阻断原理；本 CHANGELOG 记录。
  - **切片 D（验证）**：npm test 8/8 全绿；node --check index.js/client.js/route.test.mjs
    通过。纯测试增补 + 路由分支重排，无客户端改动，无部署回环需求（宿主不受影响）。

- ✅ 第二十七轮（2026-08-22，测试临时目录清理系统化 + 审查事实纠错入账）：
  - 第二十六轮审查处置复核：route.test homes 数组清理、CHANGELOG 功劳
    归属修正、主文档乱码修复——全部属实；审查方自身一处事实错误被实测
    纠正（「其他测试文件均有 finally rmSync 惯例」不成立：仅 watcher/
    reply-route/route 三家有，registry/jsonl/rpc-envelope/stats 四文件
    零清理，历史残留 288 个目录）。
  - **微切片补齐（审查方执行）**：四个文件各加 process.on("exit") 钩子
    rmSync（registry 用数组收集两处 mkdtemp）。选 exit 钩子而非 try/finally
    包裹：一行改动不动缩进，且对正常退出/显式 exit/未捕获断言失败三种
    终止路径都生效（行为已验证：throw 后钩子仍运行）。
  - 生效性实测：清 288 个历史残留（含 heal/heal3 一次性脚本遗物与一个
    杂散 PNG）→ npm test 两连跑 8/8 全绿 → /tmp 零新增。
  - 至此 8 个测试文件全部自带清理；「测试残留」类问题关闭。

- ✅ 第二十八轮（2026-08-22，消息轮询换 SSE：bot 状态实时推送）：
  - 选题：审查方选「SSE 实时 bot 状态」。审计后定最小触面——注册表/状态变更
    （start/stop/child-exit/reconcile/create/patch/remove）本来全部经
    `BotsApi.writeRegistry` 单一 choke point，于是只在那一处挂广播，而非逐处 hook。
  - **切片 A（红，tests/events.test.mjs 7 项）**：SseHub 单元（订阅→广播送达/退订不送/
    坏订阅者被移除不阻塞）、writeRegistry 广播、`_events` 端点协议（200 + SSE 头 + 重连
    心跳、广播送达连接、close 退订、405、403）、及一个**路径无冲突**守卫（id="events" 的
    bot 详情不被 SSE 端点吞掉）。
  - **切片 B（实现）**：`createSseHub`（命名事件广播，写失败订阅者移除）+ `sseEndpoint`
    （text/event-stream + unref 心跳 + close 退订）+ `BotsApi` 可选 3 参 `sseHub` +
    `writeRegistry` 尾部广播 + `handleApi` `_events` 分支（在 CSRF 校验之后、JSON 分发之前）
    + `apply()` 创建 hub 传入 api。`internals` 增补导出。
  - **路径冲突修复**：初版用 `/api/bots/events`，grep slugify（字符集 `[a-z0-9-]`）确认
    id="events" 可达 → 与原 3 段详情路径冲突；改用 `_events`（下划线不在 id 字符集，无法
    与任何合法 bot id 冲突），并加守卫测试。
  - **切片 C（client）**：BotMain 挂载时 `EventSource("/api/bots/_events")` 事件驱动
    `refreshBots()`；连接出过错时回退 5s 轮询（EventSource 自动重连，旧服务器 404 → 回退
    仍可用）；卸载清理。stats 2s tick 保留（下轮可复用 hub 推 stats）。
  - **切片 D（文档 + 部署）**：主文档「仍可选题」重排（SSE 标记完成并记录设计，
    shell.overlay 单列为剩余项）；部署 index.js/client.js。
  - **过程中被 hygiene 网逮到**：把「路由分发」注释挪到 createSseHub 前造成孤儿 docblock
    （且我误删了 `function createSseHub() {` 一行）——hygiene.test.mjs 立即红，随后把注释
    挂回 handleApi 正上方、函数声明复原，9/9 转绿。孤儿 docblock 检测网履职。
  - 验证：npm test 9/9 全绿；node --check index.js/client.js 通过。

- ✅ 第二十八轮审查处置（2026-08-22，SSE 轮）：
  - 核实通过：choke-point 主张成立（10 处 mutation 全走 BotsApi.writeRegistry，
    唯一直连 ：2215 是 hub 创建前的启动初始化）；events.test 7 项含路径
    冲突守卫；hygiene 网履职案例（孤儿 docblock 当场红）属实；部署哈希
    与 /tmp 零残留复现。
  - **修复 C-1（客户端致命回退缺口）**：原 onerror 守卫
    `readyState !== CLOSED` 恰好跳过致命失败（旧宿主 404 → CLOSED，规范
    不自动重连）——注释声明的「404 → 回退轮询」路径实际不通，且当前正处
    于「客户端领先宿主」过渡窗口（宿主未重启即刷新页面 → 列表零刷新）。
    改为无条件 startFallback()（幂等；卸载清理 stopFallback 不泄漏）。
  - **事实修正**：plugins 根目录 index.js 非「本轮之前的遗留物」——md5 与
    lib/index.js 完全一致、mtime 23:27 与本轮部署同时刻，即本轮误拷的
    孪生副本（client.js 孪生已删、index.js 被误判保留）。已移除；根目录
    现仅 CHANGELOG/PROJECT_UNDERSTANDING/PROPOSAL/lib/package.json/scripts。
  - 小瑕疵记录：events.test 头注释仍写旧路径 /api/bots/events（正文已用
    _events）；createSseHub.close 无调用方（插件卸载随服务器整体消亡，
    不构成泄漏，留着或删随缘）。

- ✅ 第二十九轮（2026-08-22，shell.overlay 全局 bot 通知：在线状态翻转）：
  - 三项裁定（审查方定案，照此实施）：订阅上移插件根单连接共享；只通知既有 bot 的
    online↔offline 翻转（新建/删除/patch/group 全静默，首快照为静默基线）；本页自发
    start/stop 入内存账本（期望态+10s 窗口），diff 命中即吞。邮件到达通知明确出范围
    （hub 只挂 writeRegistry，邮件落盘在 bot 实例进程内，host 看不见 inbox——属新基建）。
  - **切片 A（红→绿，tests/notify-diff.test.mjs 8 项）**：`deriveBotNotices` 纯函数直测。
    测试基建：client.js 是 window.__ModuleLoader__ 浏览器 bundle（loader 只认种子词/
    物化模块/boot 图行，相对 require 解析不了），node 测试注入「捕获型 loader」→ import
    → 从捕获 factory 以桩 require 调起 → 取导出的纯函数——单一来源、无需重复。首快照
    静默基线/无翻转/双向翻转/新建删除静默/账本命中/过期/不匹配/非法输入，8 项全绿。
  - **切片 B（根订阅）**：EventSource 上移 apply()（ctx.effect，全生命周期单连接）；
    bots 事件 → 根级 refreshBots（事件驱动刷新 + 通知派生，Bot 模式外也跑——全局通知
    由此成立）；botFeed 只留状态跟踪（connecting/open/error/closed）+ statusCallbacks。
    BotMain 只订阅状态做回退轮询（CLOSED=404 致命时轮询是唯一刷新源，C-1 教训延续），
    初始 refreshBots + 卸载清理。`botFeed.subscribe` 弃用后按无死代码原则精简删除。
  - **切片 C（渲染）**：`ctx.slots.inject("shell.overlay", …)` 常驻 BotNotices——复用
    toast 令牌系（`.dsh-bots-notices` 固定底部右侧、堆叠 gap 8、最多 3 条、4s 自动消失、
    无点击动作），Bot 模式外也可见。ledger 记录点在 runBotAction（start/stop）；派生在
    refreshBots（prev=botState.bots 快照，新建/删除/非状态变更天然静默）。
  - **过程中自纠一个设计缺陷**：初版 feed 订阅在 BotMain 内，Bot 模式外不派生通知（全局
    通知的核心场景反而失效）——改为根 feed 直接调 refreshBots，BotMain 只留状态/回退。
  - **切片 D（文档+部署）**：主文档 shell.overlay 从可选题移入已实现（含规则与出范围
    边界），CHANGELOG 本条目；部署 client.js（本轮纯客户端改动，服务端未动）。
  - 验证：npm test 10/10 全绿；node --check client.js 通过。

- ✅ 第二十九轮审查处置（2026-08-23，shell.overlay 全局通知轮）：
  - 核实通过：deriveBotNotices 纯函数与裁定逐条吻合（8 项直测含首快照
    基线/账本吞掉/过期恢复/期望不符照报/非法输入防御）；notify-diff 的
    「捕获型 __ModuleLoader__ + 桩 require」测试基建是正解（单一来源，
    纯函数不经复制即可直测）；根级单连接/BotMain 仅订阅连接状态/账本
    记录点 runBotAction/10s 窗口/shell.overlay 常驻注入——全部对码属实；
    「BotMain 内订阅 → 根直调」的自纠记录诚实。
  - **修复 N-1（首转换静默缺口）**：根级 onOpen 原只设状态不拉首快照，
    初始 refreshBots 仅在 BotMain 挂载（进 Bot 模式）时发生——纯普通
    模式使用的页面 bots 恒为空数组，SSE 首事件（恰可能是队员崩溃）被
    「首快照静默基线」吞掉，功能头条场景在页面生命周期首次转换必然
    失效。onOpen 补一次 refreshBots()（附带断线重连后重同步收益；空
    prev 派生天然零通知，无误报风险）。10/10 全绿，已部署。

- ✅ 第三十轮（2026-08-23，官方 locale 系统替换内置 tr()）：
  - 调研先行（不臆测）：官方 locale 是 `dsh-client-locale` 包——
    `ctx.locale.register(ns, {zh,en})` 注册（effect 卸载自动注销）、
    `ctx.locale.bind(ns)` 绑定（调用时查活动 locale）、槽注册的 `locale`
    字段 → renderer 以 revision 标识重铸 `t` prop（memo 安全）；查询链
    ns 活动 locale → ns en → common（活动→en）→ 键自身；官方组件通用词
    确实用裸键走 common 回退（grep 实证 close/cancel/delete/edit/copy/
    search）。client runner 对 `ctx.serviceName` 按插件 `inject` 声明门控
    （回归前直接 ctx.locale 会抛「service not declared」）——本插件
    inject 增补 `"locale"`。
  - 切片 A（红→绿，tests/locale.test.mjs 9 项）：加载技术复用
    notify-diff 的捕获型 loader（单一来源不复制）；断言 zh/en 键集平衡、
    模板占位符一致、tr/t 源码键全覆盖（含 common 允许集）、无二元形态
    残留、8 组样本快照防措辞漂移。红测试自纠一处误报：初版断言
    「const tr = 不应存在」，但新垫片正是该形态——改为断言旧二元签名
    不存在 + 垫片形态存在。
  - 切片 B（基础设施）：`LOCALE_NS="bots"`（官方未占用），132 键 × 2
    字典；垫片 `tr = (key, params) => …` + `isZhLocale()`（无服务时
    navigator 回退）；apply 内绑定与注册；ROLE_TEMPLATE/ROLE_SPEC_HINT/
    FULL_ACCESS_WARNING 三个模块常量 → 键化函数（模块常量会冻结创建时刻
    的 locale）；模块级处理器（pushNotices/refreshBots/runBotAction/
    askRemove/confirmRemove/applyQuickPermission/copyBotId/saveBot/msg/
    fetchModelCatalog/statsGroupsOf→t 参数化）全部键化；`fmtElapsed`
    isZh→isZhLocale。
  - 切片 C（组件）：15 个渲染组件穿线 `t` prop（槽注册带 locale 字段；
    ChatView 的 statsGroups useMemo 依赖加 t——locale 切换经 t 标识
    重派生，memo 组件新 t 触发重渲染）；名值拼接全改参数模板
    （{name}/{n}/{d}/{i}/{o}/{t}/{p}/{reading}）；Escape 处理器本地
    变量 `t` 改名 target 避 prop 遮蔽。顺带修复 5 处未走 tr() 的硬编码
    中文（回到底部/发送一条消息开始对话/我/未知错误/获取 Bot 列表失败
    /响应缺字段×2），一并入字典——CJK 字符串字面量审计后字典外零残留
    （仅格式化片段 分/秒 与 effect 标签，均属白名单）。
  - 验证：node --check 通过；npm test 11/11×3 连跑全绿（新增 locale
    文件）；CJK 审计脚本全量扫描（134 处命中 = zh 字典 + 白名单）；
    参数化冒烟（zh/en 各 8 例渲染与迁移前逐字一致）。

- ✅ 第三十轮审查处置（2026-08-23，locale 轮）：
  - 核实通过：部署链 89413a7e、服务端零改动（index.js mtime 停在
    08-22 23:27 / 第 28 轮）、11/11 复跑；132=132 键集与占位符逐键一致、
    en 无裸键回退；正交扫描键覆盖（129 字面键 + 恰 8 三元键）与测试
    硬编码清单精确吻合；common 允许集直接读官方字典五词全在
    （close/cancel/delete/edit/save，报告 grep 清单缺 save 由审查方
    补证）；getLocale().active 形状 / bind 先于 register 安全 /
    查询链 ns→common→键自身，逐行对官方源码；槽 locale 字段接线由
    官方 installLocale 与同仓 dsh-team 同款模式双重证实；"bots" ns
    未占用（register 冲突为响亮失败）；CJK 字典外零残留；CHANGELOG
    双份同步；BotNotices 经 tr 推入时固化（shell.overlay 不带 locale
    字段正确——该槽无 t 消费）。
  - 第 28/29 轮修复存活（本轮最大回归风险面）：onOpen 基线
    （client.js:2413）、C-1 无条件兜底接线（:2188-2192 + onError
    广播 :2416-2419）、deriveBotNotices 逐行一致 + 账本 10s 窗口
    （:711-724 / :804-807）；Escape 处理器 t→target 改名逻辑完好；
    statsGroups useMemo 依赖 [stats, messages, t] 正确；roleTemplate
    函数化彻底；inject 增补仅在 web 平台（package.json platform
    声明保证 headless bot 实例零加载 client.js）。
  - **F-1 事实更正（方向保守，无代码后果）**：报告原述「当前若连页面
    EventSource 404 → 轮询兜底」过时——宿主 1416 今日 07:08 启动，
    晚于第 28 轮 index.js 部署（昨晚 23:27），故其加载的即带 `_events`
    的新服务端。三证：`/api/bots/_events` → 200 + text/event-stream；
    宿主 serve 的 `/plugins/dsh-bots/client.js` md5 = 89413a7e（本轮
    新版，按请求从磁盘 serve 非启动缓存）；cache-control: no-cache →
    页面刷新必得新版。**结论：SSE + 全局通知 + 本轮 locale 客户端当下
    一次页面刷新即全部生效，无需宿主重启**（52237 消亡叙述本身属实，
    仅牵连的是「宿主重启生效」这一旧前提）。
  - 微观察记录（均不立项）：根组件 t 无 tr 兜底（生态惯例，注入缺失
    为响亮崩溃）；测试三元键靠硬编码 8 键清单（当前与独立扫描吻合，
    注释已自述维护点）；4s 瞬态通知推入时固化（语言切换不重译已显示
    条目，瞬态 UI 无关紧要）。

- ✅ 第三十轮补测（2026-08-23，审查方缺口关闭 → 立项为回归）：
  - 审查方自认的缺口：第三十轮全部测试走桩 require，真实
    `ctx.locale.apply` 路径（register 不抛错 / t prop 真注入前提 /
    查询链 / 未阻塞）无覆盖。宿主活体在手但本会话浏览器后端不可用，
    审查方改走等效路径：Node 实例化**官方 LocaleRuntime 真实对象**
    （官方 client.js 直接导出该类），对接本插件真实 apply——全链路
    通过（真实注册/冲突必抛/查询链 zh+参数模板+common 回退/setLocale
    后同一闭包即时翻转/revision 递增/卸载真实注销/重挂无残留）。
  - **处置：一次性装置立项为回归测试 `tests/locale-runtime.test.mjs`**
    （4 项：真实注册与查询链 / 冲突检测 / 语言翻转与 revision / 卸载
    注销与重挂），带存在性守卫（官方包缺失时打印跳过说明、exit 0，
    不把测试套件耦合到宿主安装状态）。独立复写装置（非转述审查方实现）
    复核 4/4 全绿后落库；12/12 全量通过。
  - 顺手补证收口：官方全部 client 包命名空间普查（profile 安装面）
    `job / settings.agentPreset / settings.permission / conversation /
    common / settings` 与全局安装面普查（30+ ns）均无 "bots"；
    `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-client-locale`
    为全局安装软链（同一份代码，仅备忘）。
- ✅ 第三十一轮（2026-08-23，邮件到达通知 v2：host 侧文件监听新基建）：
  - **立项背景**：第二十九轮明确将「「研究员 回复了」」通知划出范围——hub 只挂
    writeRegistry，邮件落盘在 bot 实例进程内，host 看不见 inbox/outbox 变化，
    属新基建而非复用。本轮补上这块基建：**host 侧轮询监视器**（bot 实例是
    写入方，看磁盘即可，无需跨进程通知）。
  - **服务端**（lib/index.js）：
    - `scanMailState`（纯函数，真文件驱动）：对比上一份状态快照与磁盘现状，
      输出新邮件事件。语义不变量：每 (bot,dir) **首见即静默基线**（host 重启
      存量不回放）；inbox 按 **seq 增量 diff**（seq 单调、损坏行跳过不重不丢；
      文件重写即 maxSeq 回退 → 静默重置）；outbox 按文件名（=ISO 时间戳变体，
      字典序==时间序）**逐文件行数 diff**（新文件全量事件、追加仅新行、截断/
      删除静默）；bot 从注册表移除 → 状态清理，同 id 重建 → 重新首见静默。
    - 静默面：`kind="mail-response"`（bot→bot **自动回信**＝协议流量，完成信息
      由收件方后续 outbox 承载，逐条报幕只会刷屏）；host 自身 `POST /send`
      的写入（`BotsApi.ownSends`：botId→最大自增 seq，`send()` 时记录、
      监视器按 seq 抑制——用户自己发的结果他看到的就是全部）。
    - `mailPreview`：压缩连续空白 + 80 字符截断（通知条放不下长回复）。
    - `createMailMonitor`（poll 状态机，无定时器）+ `startMailNotifyMonitor`
      （apply effect：WATCH_POLL_MS tick → `sseHub.broadcast("mail", {events})`，
      启动即扫描建立基线；仅主 web 实例启动——`detectBotInstance` 判空分支）。
    - 事件协议：SSE `mail` 事件（与 `bots` 共享单连接），载荷
      `{events:[{botId,dir,from,text,at,seq|id}]}`，一帧一批。
  - **客户端**（lib/client.js）：
    - 根级 SSE 订阅 `mail` 事件 → `pushMailNotices`；`pushNotices` 抽出共享的
      `pushNoticeItems`（最多 3 条、4s 自动消失语义不变）。
    - 新通知样式 `dsh-bots-notice-mail`（`--dsw-alias-state-business-primary`
      描边）+ `dsh-bots-notice-action`（cursor:pointer）；邮件通知**可点击**：
      进入该 bot 会话（Bot 模式未开先开，`openBotChat`；role=button + Enter/
      Space 键盘可达）。状态翻转通知仍无点击动作。
    - 文案纯函数 `mailNoticeText`：botId/from 经 bot 名单映射显示名，未知
      （已删 bot / 外部发件人）回落原始 id；模板 `mail.reply`「「{name}」
      回复：{text}」/ `mail.incoming`「「{name}」来信（{from}）：{text}」+
      英文对（新增字典 2 键，locale.test 键平衡/占位符一致自动纳入）。
  - **测试**：
    - `tests/mail-notify.test.mjs`（13 项）：mailPreview；首见基线（inbox/
      outbox 存量静默且状态记录）；inbox 增量事件形状；mail-response 静默；
      ownSeq 抑制（自身写入静默、后续 bot 邮件照常）；inbox 重写重置；
      outbox 新文件/追加/截断/删除；多文件按时间序；bot 移除状态清理与
      同 id 重建重基线；createMailMonitor 状态机（ownSends Map 生效）；
      ownSeq 缺省不抑制；**startMailNotifyMonitor 端到端**（真实 1s tick +
      真实 hub：启动基线不广播 → 新邮件一帧 mail → dispose 后静默）。
    - `tests/mail-notice.test.mjs`（5 项）：mailNoticeText 中英模板渲染/
      名单映射/未知回落/键与占位符一致性/text 花括号不被误伤。
  - **活体验证（浏览器实测，全链路闭环）**：临时注册表自检 bot
    （`selfcheck`，验证后删除并确认 host API 回净）→ 真实 inbox 邮件落盘 →
    SSE 流捕获 `event: mail` 帧（`{"events":[{"botId":"selfcheck","dir":
    "inbox","from":"lead","text":…,"seq":1}]}`，帧格式与预期一致）→ 页面
    Bot 模式外底部右侧渲染通知「「自检」mail from 领队: …」（新样式
    `dsh-bots-notice-mail` + 可点击 `dsh-bots-notice-action`，botId 经
    名单映射显示名），截图见 preview/preview-notice-mail.png。宿主重启
    走完整链（kill → 由原启动 shell 拉起的进程，启动时刻两次实测分别
    09:57:33 与 18:31:14——后经审查指出为 pid 复用/多轮重启，均晚于
    部署 09:30:46，两种读法下宿主都在跑新 server；served client.js
    md5 `51ab871c` 为新版）。
  - **出范围**（文档同步）：SSE 只推在线连接，页面关闭期间邮件不回放
    （无事件历史；重连拉 /api/bots 的 preview 自会带出最新状态）；浏览器
    系统通知（Notification API）未做；mail-response 逐条报幕未决（当前
    判断：协议流量，静默正确）。
- ✅ 第三十一轮审查处置（2026-08-24，邮件到达通知轮）：审查结论「一次微切片后
  收轮」，三条实证缺陷（复现脚本逐条坐实）+ 一条达性半成品 + 两处叙述更正，
  全部采纳照修：
  - **F-2 · inbox 瞬态读失败 → 基线重置 → 恢复后全量重放**（审查实证：基线
    seq=2 → chmod 000 一拍 → 恢复后重放 seq 1,2,3）。根因：读失败 `lines=[]`
    `maxSeq=0` 无条件写回基线，与注释「下次 tick 重试」意图相悖。修法：
    `inboxReadFailed` 标志——已首见保持旧基线、首见中保持未首见（下拍重新
    首见静默）。独立复现 → 红测 → 修复 → 绿（恢复后仅报新增 seq3）。
  - **F-3 · outbox 单文件读错 → 基线丢失 → 恢复后整文件重放**（复现：2 行
    文件 → chmod 000 一拍 → 恢复后重放 2 条）。修法：读错时已首见则
    `current[name] = prevFiles?.[name] ?? 0` 携带旧计数、首见中忽略该文件
    保持未首见。修复后恢复拍 0 重放、追加仅新行。
  - **F-4 · ownSends 单值 max-seq 抑制 → 同 tick 夹层外来邮件误吞**（复现：
    基线 5 → 外来 seq6 先落盘 → 自发送 seq7 后落盘 → 6 被吞）。根因：
    `seq <= suppressed` 的单值 max 语义——1s 窗口内「外来先、自发后」时
    外来 seq 更小。修法：`ownSends` 改 **botId → Set<精确 seq>**（send()
    add、remove() 清理、scan `own.has(seq)` 精确匹配）。修复后 events=[6]。
  - **附修（同族顺手）**：三类读失败（inbox 文件 / outbox 单文件 / outbox
    目录）现经 `scanMailState.readErrors` 诊断数组上抛，`startMailNotify-
    Monitor` tick 逐条 `logger.warn`——补上审查指出的「完全无日志痕迹」；
    目录读失败场景核为安全（恢复后重新首见静默，不重放），仅加诊断。
  - **M-1 · 通知条键盘可达性半成品**（role=button 但无 tabIndex，Tab 无法
    聚焦）：补 `tabIndex: n.botId ? 0 : undefined` 一行。
  - **叙述更正（审查两处）**：①「回净」成立——`bot-mt0x6r0y` 是研究员本人
    （8-20 创建，id 自动生成），审查初判残留后核查排除，注册表实为
    lead+研究员、selfcheck 零残留；②宿主启动时间——审查实测当前 5154 为
    8-23 **18:31:14** 启动（原记 09:57:33；两观测均真实，为 pid 复用/多轮
    重启，并非时间误读；两者均晚于部署 09:30:46 → 修正表述为「两次实测、
    均晚于部署」）。"locale-runtime.test.mjs 未报告"为审查方撤回（已记档
    CHANGELOG:701 补测条目）。
  - 回归：`tests/mail-notify.test.mjs` 由 13 项增至 **17 项**（F-2 两项含
    首见变体、F-3、F-4 共 4 项 chmod 复现式回归，finally 恢复权限保证
    清理）；全套 **14 文件全绿（连跑 3 次稳定）**。
  - **审查方建议采纳备注**：邮件通知 80 字预览 + 4s TTL 偏紧的观察项
    （mail 类延长 8s）——未立案，暂不随处置改（TTL 改动影响面大于收益，
    等实际使用反馈）。无事件历史、1s 全量读无 stat 缓存两项，审查方
    分别认可出范围与降为纯性能观察项。
  - **复批登记项（审查方复批通过收轮时留下，均未立案）**：
    ① readErrors 诊断逐 tick 逐条 warn——若某文件**永久**不可读（异常
    权限遗留），会以 1 条/秒无限刷日志；未来可选加固：同路径连续相同
    错误去重（恢复清零、再坏重报）。审查方明确不要求现在做；
    ② 4s TTL 维持观察（使用反馈驱动，审查方背书裁量）。
- ✅ 第三十二轮（2026-08-24，团队调研知识底座 v1 MVP）：
  - **立项**：使用侧信号——8-22 领队↔研究员邮件讨论（lead inbox seq 17-19）
    自然收敛「可复用的团队调研知识底座」，MVP = 标准化报告模板 + 团队共享
    索引清单；审查方复批时转述该信号（lead 第二稿提出「以真实任务验证地基、
    试点=下一个正式调研任务」、研究员第二稿画边界与字段草案），用户点题立项。
    讨论原文逐条保留进 PROPOSAL-knowledge-base.md（含「知识坟场」动机、
    三件套、KPI=复用率、科研严谨性=状态留痕）。
  - **存储**：`$DSH_HOME/bots/knowledge/`（index.jsonl 索引 + reports/<id>.md
    报告全文 + REPORT_TEMPLATE.md 模板；ensureKnowledgeBase 幂等创建且
    **不覆盖**用户模板——模板是团队规范，升级不得回滚）。索引字段对齐团队
    草案：id/title/tags/summary/conclusions/sources/appliesTo/task/botId
    （机器填充）/date/status/reusedBy/supersededBy。
  - **工具**（bot 实例注册）：`knowledge_search`（索引级子串检索，不做全文
    检索；空 query 全列倒序截 10；明确不做项=全文检索/自动入库/自动打标签）、
    `knowledge_register`（id 自动 R-<年>-<三位序号> 跨年重置；title/body/
    summary 必填；supersedes→旧条目标 updated+supersededBy 保留旧版痕迹、
    悬空指针报错；reused→旧条目 reusedBy 追加去重、未知 id 忽略；先报告后
    索引，校验失败不动文件）。报告全文不在 bot workspace 内——模型可引用
    内容 = 索引里摘要/结论/来源字段（设计成文，避免"报告写完没人能看"）。
  - **团队提示段扩展**：协作协议加知识库段落（开工先 search、完成 register、
    引用填 reused、取代填 supersedes、谁产出谁登记）。
  - **测试**：`tests/knowledge.test.mjs`（12 项）：安装幂等且不覆盖模板/
    ID 生成（递增+跨年）/登记自动字段/校验失败不动文件/supersedes 留痕与
    悬空报错/reused 去重/存储失败不吞错/检索命中与状态过滤/倒序截 10/
    损坏行跳过/工具集成端到端。15 文件全绿。
  - **试点提醒（实现只是地基）**：下一个正式调研任务由用户在 Bot 模式下达
    时，团队按模板交付（①标准报告 ②索引登记 ③清单更新），领队验收；
    复用率 KPI 两个观测点人工核对。本轮不做自动检测，也不代跑试点。
  - 说明：知识库文件在 bots/ 下但不在 inbox/outbox——第 31 轮邮件监视器
    不受影响（监视器只扫 inbox/outbox 目录）。
- ✅ 第三十二轮审查处置（2026-08-24，知识底座并发修复）：审查方**真并发
  探测**（spawn+Promise.all；4 进程 × 30 次、3000 条底座）确证高严重级缺陷
  K-1——registerReport 无互斥的全索引读改写，真并发下三轮平均 120 次成功
  仅 ~33 条落索引（~73% 丢失/撞号；其初版用 spawnSync 串行误报零异常，方法
  自我修正后为确证）。处置（微切片，两项都修）：
  - **K-1（无互斥读改写 → lockdir 写锁）**：`acquireIndexLock`——`mkdirSync`
    原子获取 + 短自旋（tickMs 步进）+ 按目录 mtime 判死接管（>staleMs=3s
    视为持有者死亡，删除重试）；锁内 owner.json 记录 pid，释放前核对
    「锁还是不是我持有」——已被他人接管的锁绝不删除（防释放误删活锁）。
    registerReport 的「读索引 → 分配 ID → 副作用校验/变异 → 原子写回」整段
    持锁；**ID 只从锁内单次读到的 entries 计算**（消除双重 TOCTOU——原
    连续两次 readIndex 的窗口里另一进程可趁虚登记同号）。锁内为同步亚毫秒
    级临界区；锁超时（>6s spin）与存储失败同路返回 ok:false（模型可重试）。
    读侧（knowledge_search）不持锁——rename 原子性保证读到完整旧版或完整
    新版。
    **复核实证**（与审查方同场景：4×30、3000 底座 ×3 轮）：
    | 轮 | 成功 | 落索引 | 撞号 | 丢失率 |
    |---|---|---|---|---|
    | 修复前（无锁变体） | 120 | 31 | 89 | 74.2% |
    | 修复后 1 | 120 | 120 | 0 | 0% |
    | 修复后 2 | 120 | 120 | 0 | 0% |
    | 修复后 3 | 120 | 120 | 0 | 0% |
    副作用并发完整性探针（4×30 全部命中同一旧条：supersedes×24 /
    reused×60）：底座 reusedBy 60/60 齐全且去重、supersededBy 单一胜者、
    121/121 无丢失。
  - **K-2（重写静默丢弃损坏行）**：`readIndexDetailed` 保留未解析行原文，
    索引重写时按原位原样存活（读侧仍跳过）——登记不吞修复线索；测试钉住
    （损坏行 + 非对象行重写后仍在原文）。
  - **测试**：knowledge.test.mjs 12 → 16 项（锁唯一获取/持锁超时/陈旧锁
    接管/损坏行原样保留/**真并发回归**——4 子进程 spawn+Promise.all，
    完整性断言：全部 ok + ID 全局唯一 + 每返回 ID 都落索引 + 总数 = 底座 +
    登记数）；顺手收紧审查方观察项（search 结果断言 = status 未定义精确
    定形 + total 计数与结果数一致；「模板双写良性」观察项不动）。15 文件
    全绿。
  - 复批登记项：并发回归**必须用真 spawn**（spawnSync 串行会掩盖竞态——
    审查方自证 + 我方无锁变体复证同一教训）。
  - 复批登记项（放行，不阻塞？→ 不阻塞，保留挂起）：**陈旧接管理论残留
    窗口**——持有者在临界区内被冻结 >3s（SIGSTOP/极端换页）→ 锁被他人
    当作陈旧接管 → 冻结者苏醒后按冻结前的陈旧快照写回 → 接管窗口内那次
    登记丢失。临界区为同步亚毫秒级（读→变异→原子写回全同步、无 await 点），
    仅病态暂停才触发；MVP 形态可接受，**现规模无需动**。若索引涨到十万条
    级（临界区接近秒级），升级方案 = 上调 staleMs 或持锁期间定期 touch
    锁目录 mtime。
  - 复批/试点惯例登记（2026-08-24）：**时间口径统一**——bot 进程启动/文件
    时间用本地（如 17:48），工具调用/会话/索引 date 用 UTC ISO（如
    12:38Z）；同一份报告必须双口径并注，避免 F-1 式时序误读（本轮实现方
    混排两种口径，审查方纠正后立规）。

- ✅ 外部架构批判收纳（2026-08-24，异构/P2P 愿景层红队 → 归并为自有）：
  - 收到外部批判（异构专精成本论 / P2P 讨论伪共识 / 决定论验证不可替代 /
    脑裂与仲裁 / 状态机重构建议），独立评审对照本项目 32 轮实证后裁定：
    约六成风险已被现有设计挡住——乒乓 guard（mail-response 不回路由）、
    10min 回合超时 + RPC 超时 + 自愈上限、[ESCALATE] 一等升级条款、
    条款 4 自包含委派（worker 每任务全新上下文，无共享流水可稀释）、
    进程边界 Chat/Event 分离；「脑裂」对 append-only mail 是类别错误
    （无可变共享状态、consult 语义下 lead 是唯一整合点），系统里唯一真
    共享状态处（知识索引）恰发生过 K-1 竞态且已用 lockdir 修复
    （74.2% 丢失 → 0%，批判自己给的处方反而是工作流状态机）；「缺超时
    断路器与升级机制」指控不实（第 24 轮起在案且有测试）；其重构建议 4
    （原子锁 + index.jsonl + reports/）即本项目第 32 轮产出；核心状态机
    建议与 PROPOSAL-threads-and-clauses §5 的明确否决项重合（SOP 活在
    提示词，不焊死工作流）。
  - **收纳两条**（登记为观察项，未立项）：
    ① **代码类委派的确定性证据条款**——代码类任务回信必须附测试/lint/
    编译证据（「决定论验证优先」：确定性计算廉价且 100% 可靠，LLM 文本
    辩论昂贵且概率性；提示层实现——加协作条款或领队角色文本，触发＝
    首个代码类任务立项时）；
    ② **讨论层无决定论锚点的残余风险**（幻觉共振）——现有缓解＝知识库
    模板强制「引用来源」节 + 条款 5 回信必写「如何验证的」；触发＝试点
    后若出现误共识实例，再议加重锚点。
  - 按用户指示删除原批判文档；有价值内容归并为本条 + PROJECT_UNDERSTANDING
    观察项（不留外部署名文档，仓库文档全部自有）。

- ✅ 微切片（2026-08-24，第三十二轮外部复审收纳：F-A~F-E + 顺手项，原地修复）：
  - **F-A** registerReport 注释更正为条件式真相：索引写失败后重试通常得到
    **同一个 id**（索引未变 → 序号不变，孤儿被本次合法登记覆盖）；仅当
    失败与重试之间已有他人登记使序号前移时孤儿才保留。
  - **F-B** 登记拒绝路径补日志（第三十一轮 readErrors 同款教训的补齐）：
    工具层必填预检拒绝 → `debug`（模型可修正重试，防刷屏）；registerReport
    层拒绝（锁超时/存储失败/悬空指针）→ `warn`（罕见事件，留排查痕迹）。
  - **F-C** knowledge_search 截断可感知：+1 哨兵（多取一条）区分「恰 10 条」
    与「≥10 条被截」——命中超 10 时 `truncated:true` 且恰返 10；`total`
    语义不变（＝返回条数）；schema 增补 truncated 字段、工具描述同步告知
    模型可细化 query。
  - **F-D** 卫生网清单补 `lib/knowledge.js`（「网自身也入网」规矩的执行——
    该缺口系两轮审查漏检，外部复审 F-D 照出）。
  - **F-E 变体** release 的 owner 不可读分支改为**保守不删**（原行为在接管者
    rm→mkdir 间隙会误删他人新建锁，制造无互斥临界区）；泄漏的锁目录由 3s
    陈旧接管自愈。锁协议文档同步。**测试钉住**（owner 删除后 release → 锁目录仍在）。
  - 顺手项：**F-G①** ID 格式串收敛为唯一格式化点 `formatReportId`（原
    nextReportId 与 registerReport 各写一份。复批评正：**当时仅收敛了
    nextReportId 一处，registerReport 内联残留**——见下方复批处置条目）；
    **F-G③** 检索描述补「适合任务类型」字段（haystack 实含 appliesTo 的
    文档漂移，模块注释同修。复批评正：query 参数描述与 searchIndex 函数
    docblock 两处漂移当时未闭——同见复批处置条目）。
  - 顺手项（补披露）：**client.js 头部标题图标化**——Bot 模式头部「Bot 模式」
    标题由纯文本 span 改为 BotOutlineIcon + 文字组合（新增
    `.dsh-bots-header-mode`，令牌合规；`t("mode.title")` 不变，locale 安全；
    复用既有 BotOutlineIcon）。该改动最初游离于修复清单与部署之外，审查方
    核验时发现，经用户裁定补披露并部署。
  - 测试 knowledge 16 → **18 项**（F-E 不删锁 / F-C 哨兵截断——含未截断
    对照组）；15 文件全绿；hygiene 扩员后 knowledge.js 零孤儿。
  - 部署：lib/knowledge.js + lib/index.js 拷贝至 plugins（服务端改动，
    随「部署领先运行」惯例——宿主与 bot 实例下次启动生效；当前会话不受
    影响）；lib/client.js 后续补拷（客户端改动，生效条件＝页面刷新）。

- ✅ 复批处置（2026-08-24，R-1/R-2 收口——外部复批照出微切片半程收敛）：
  - **R-1** registerReport 内联 ID 模板（原 :263）改用 `formatReportId(year, seq)`
    ——「唯一格式化点」至此为真（全量 grep：写侧 ID 构造仅 helper 一处；
    `maxSeqOfYear` 的 `R-${year}-` 前缀为**读侧解析匹配**，非格式化点，不计）。
  - **R-2** searchIndex 函数 docblock 与 knowledge_search 的 query 参数描述
    两处补「适合任务类型」——文档漂移全部闭死（haystack 实含 appliesTo 的
    三处描述位：模块头/主描述/参数描述 + 函数 docblock，四处一致）。
  - 方法记录：审查方（本会话）在微切片核验时以「helper 存在 + 一个调用点」
    采信了条目的「两处收敛」声明，未反向 grep 内联残留——**存在性抽查 ≠
    声明完备性核验**；外部复批以全量出现点 grep 照出。与 spawnSync 假并发
    同谱系：核验覆盖面本身须被审视。
  - 处置选 B（现在改）：A 的「避免无谓重启」前提不成立——部署领先运行本身
    不需要重启。改动三行文本，node --check + 15/15 复跑确认，随「部署领先
    运行」入库（下次自然启动生效）。

- ✅ 知识库试点 O-2 收口（2026-08-24，KPI 观测缺口归因 + 提示段明文化落盘）：
  - **O-2 归因（三方对齐）**：第二轮 seq23 委派指令内的临时禁令「不要同时给
    同一 id 填 reused」与提示段两分句（引用了历史结论必须填 reused／新报告
    取代旧报告填 supersedes）的「独立触发、并行满足」语义冲突；研究员遵临时
    令 → reusedBy 零回写 → KPI-b 观测缺口。**根因在派单侧纪律**（临时禁止令
    未经安全性验证即写入派单文本），非提示段语义、非研究员选择——后续派单
    不得以未标注的临时禁止令凌驾常驻规则。
  - **微调 1（冲突可见性去裁决化）采纳**：不把「临时者胜」写成常驻协议；义务
    锁定在可见性——无论按哪条执行，均须显式注明冲突点与所循依据（执行方
    报告 + 派单方标注）。
  - **微调 2（因果链中性措辞）定稿确认**：O-2 = 提示段两分句独立触发、「取代
    且沿用」情形并行满足（与双填兼容）；seq23 委派临时禁令与该并行满足要求
    冲突，研究员遵临时令 → reusedBy 零回写 → KPI-b 观测缺口。修复位置在派单
    侧纪律；提示段明文化为加固项。
  - **#1 落盘**：registerTeamPromptSection 知识库行追加「『取代且沿用』时
    supersedes 与 reused 可对同一旧 id 同时填（职责不同、互不排斥）」；协作
    协议新增「冲突可见性」条款（去裁决化措辞：执行方报告 + 派单方标注，不
    静默覆盖）；knowledge_register 工具描述补双填兼容注（三处一致）。
  - **测试**：knowledge 18 → 19 项（双填兼容回归：同一旧 id 同时 supersedes +
    reused → status=updated + supersededBy + reusedBy 三标记齐备）；node --check
    + 15 文件全绿复跑。
  - **部署**：随「部署领先运行」入库，lib/ + docs 拷贝至 plugins 三方平价；
    **双侧（宿主 + 两个 bot 实例）共重启窗口落盘**。
  - 收口：第二轮试点 PASS 维持不变；第三轮（reused 首考 / 溯源隔离决定性
    实验 / 机械化冲突检查·明文基准字符串比对）待用户下达。

- ✅ 第三轮审查裁决收口（2026-08-24，三条裁决采纳 + 第四轮前置合并清单落档）：
  - **裁决① 并行双查（采纳，实证坐实）**：t25/step1 内**单个 assistant/message**
    （finish reason=tool-call）携带多工具块，两次 knowledge_search 8ms 内
    背靠背并行下发、harness 严格串行执行（call→result→call→result），中间
    零模型推理——「命中1 → 命中2」箭头递进确为**叙事欠账**（审查报告与我方
    交付报告同用该箭头，对称标准各记一笔）；纪律本体不受影响（两查均先于
    任何实质工作，「开工先查」达成）。
  - **裁决② 计数口径（采纳，实测相容）**：29+13=42 次提及分布 ≤34 事件 →
    鸽巢至少 8 事件同提两份；我方独立窗口扫描 both=17 ≥ 8，结论稳健。台账
    警示：**跨窗口计数不得混读**（第二轮审查的「29」是另一窗口口径，与本次
    撞数纯属巧合）。
  - **裁决③ 单位误标（采纳，实证坐实）**：R-2026-003 body JS 字符 **2569** /
    UTF-8 字节 **5569** / 盘面 2569 字符·5569 字节 / 逐字节相等成立——「2569B」
    是字符数冒充字节（CJK 下差逾一倍）。**单位纪律登记**：机器证据必须带度量
    单位（UTF-8 字节数 vs 字符数）。
  - **第四轮前置合并清单（落档待执行）**：
    ① 物理可审计新会话——归档/移走旧 session 文件或新建实例；交付信报
    session id + 起始时刻；
    ② 门禁归属——新会话创建后由审查方解码确认空集，*然后*才投递任务；
    ③ 派单文本送审后发——零禁令 + 零转述双检；简报口径二选一预声明
    （ID-only 全量可判 vs 允许携带已验收前提但溯源结论限定范围）；
    ④ workspace 快照留档。
  - 收口：第三轮记分维持 **reused ✅ / 冲突检查 ✅（O-2 无复发）/ 溯源隔离
    NOT ADMINISTERED**——溯源强证明待第四轮新会话决定性实验补考。

- ✅ 第四轮收官 + F-R4-1（2026-08-25，模板动态内联 + 统一记分落档）：
  - **统一记分**：①②③⑤⑥⑦ PASS / ④ FAIL（预期工具面击穿；旁注：溯源核心主张
    未受损——第四轮以新会话隔离运行，首事件即正式任务，「检索→复用」作为溯源
    唯一可达路径的正面证据成立；规划中的 W-1 三方案留待用户裁决，F-R4-1 独立先行）。
  - **F-R4-1（模板动态内联）**：knowledge_register 描述由 `buildRegisterDescription`
    在注册时**现读 REPORT_TEMPLATE.md** 动态嵌入其结构，每 apply/重启刷新、零漂移；
    **禁止静态内联**（模板是用户主权文件，ensureKnowledgeBase 幂等不覆盖；静态
    内联会制造「描述谎报模板」新账）；模板缺失/不可读 → 降级为纯基础描述、不阻塞
    注册。根治第四轮「为拿模板而全盘 find」实测烧 5m05s 的绕行动机。路径复用
    `templateFileFor(dshHome)`，不新造常量。验收：15 文件全绿（knowledge 19→**20**
    项，新增 F-R4-1 回归：描述含现读模板节 / 无模板降级 / 基础句保留）。
  - **捆窗项 #3 顺带**：registerKnowledgeTools docblock「适合任务类型」补入检索
    字段枚举（:2060 一行，卫生检测重新全绿）。
  - 部署：lib/index.js 拷贝至 plugins 三方平价（服务端改动，随下次自然重启生效；
    当前 3263/3278 在线不必立即重启）。
  - 余项待下次自然窗口：卫生 ×3（测试口径/启动工件落盘/销账回读坐标）、观察项
    ×2（searchIndex haystack 增 id 字段 / 转发纪律常驻化——后者待 W-1 方向定后
    再议）；W-1（含 c 方案的 sourceChannels 前置设计）待用户裁决。

- ✅ 捆窗执行（2026-08-25，下次自然窗口六项一并落账）：
  - **F-R4-2a（:2083 注释如实口径）**：registerKnowledgeTools docblock 改为
    「报告全文不在 bot workspace 内；但对工具面含宿主读取能力（如 bash）的
    agent 可直读（第四轮实证，W-1 在案）。检索通道之外的内容获取治理待 W-1
    裁决」——不再宣称绝对化的「模型不能直接读文件」（文档真实性镜像，方法
    论 #6）。
  - **F-R4-2b（例外披露）**：PROJECT_UNDERSTANDING knowledge_search 段补
    「对具备宿主读取工具面的 agent 可直读全文——第四轮实证，治理待 W-1」；
    同时 knowledge_search 描述同步补 id 字段（口径一致）。
  - **卫生 ×3**：①测试口径——run.mjs 显式 glob 逐个 spawn，注释钉死禁
    `node --test <目录>`（npm test 已指向 run.mjs）；②实例启动 pid/时刻落盘
    ——apply 在 detectBotInstance 后追加 `$DSH_HOME/bots/started/instances.jsonl`
    （{pid,at,botId|host}），供审计/pid 归属/时间线交叉验证；③销账回读坐标
    ——入方法论 #3。
  - **#4 searchIndex haystack 增 id**：lib/knowledge.js 检索 hay 加 entry.id，
    四处描述位同步（模块头/函数 docblock/工具主描述/参数描述）；knowledge_search
    现支持按报告 id 定位（如 `R-2026-001`）——消除「按 ID 检索 0 命中」陷阱的
    代码侧根因（第四轮简报引导句为临时兜底，此能力上线后自然可撤）。既存
    searchIndex 测试补 id 命中断言（大小写不敏感，不增测试项；knowledge 20 项）。
  - **#5 方法论账合并**：散落各轮 + 本批的 **15 条方法论原则**合并为
    PROJECT_UNDERSTANDING「方法论（跨轮持续有效，单一权威）」小节（评分影响
    分离/判据预登记/销账回读坐标/patch 同强度自检/扫描模式声明/文档真实性镜像/
    机器证据三元组/时间口径/探针先疑探针/存在性≠完备性/跨窗口禁混/叙事精度/
    台账凭证化/单位纪律/派单侧纪律）。
  - **#6 W-1 不动手**：等用户对 a/b/c 裁决；c 方案 `sourceChannels` 字段前置
    设计在案，裁决后按需实施。
  - 验证与部署：15 文件全绿（knowledge 20 项）；lib/index.js + lib/knowledge.js
    + run.mjs + docs 拷贝至 plugins 三方平价；服务端改动随下次自然重启生效
    （当前 3263/3278 在线不重启）。

- ✅ 第四轮收官·观察项登记 O-ID（2026-08-25，审查侧登记/实现方落簿复核）：
  - **语义现状**：searchIndex 对 id 检索为「提及即命中」（子串、大小写不敏感），
    目标报告与引用它的后代混在候选集里，仅靠登记序倒序 + `slice(-max)` 截尾兜底。
  - **失效模式**：`slice(-max)` 截尾下，某报告被 ≥ max 个后代引用时，按其 id
    检索将不再返回目标自身（确定性，非概率性）。
  - **机制坐标（实现方复核，修正审查侧差 1）**：`lib/knowledge.js:337`
    `return out.slice(-max).reverse();`（:338 为函数收尾 `}`）。部署副本同 337，
    md5 双方平价 `9853ec4a`。
  - **触发条件**：任一报告 `reusedBy.length ≥ 8`（当前实测最大 **2**：R-2026-001
    与 R-2026-002 各被 003/004 引用；003 长为 1；004 为空 → 距阈值余量 **6**）。
  - **处置流程**：触达后先按判据预登记原则（方法论 #1）定判据，再动手；修复
    形态倾向：id 精确等值匹配，或目标保底不挤出。
  - **绑定条款**：第四轮简报中「检索按主题词」引导句的撤除与本触发监视**绑定**，
    未触达前不得单方面撤除。

- ✅ W-1 用户裁决＝a 合法化磁盘直读（2026-08-25，用户三方案择 a；c 方案
  sourceChannels 前置设计保持存档不实施）：
  - **裁决内容**：检索通道之外的内容获取（宿主读取面直读报告全文）＝设计内合法
    路径，不构成越权；knowledge_search 仍是主通道，复用率 KPI 靠「开工先 search」
    团队协议维持而非强制（用户采纳我方推荐：知识库非安全边界、round-4 本就按
    预期缺口记分）。
  - **实施**：① lib/index.js registerKnowledgeTools docblock 升级为裁决态
    （F-R4-2a 从「治理待 W-1」改「W-1(a) 已裁决：设计内合法路径」）；② PU
    knowledge_search 段例外披露句同步升级；③ **凭据级读取面清单随案登记**
    （具 agent 工具面实例：lead/领队:3101、bot-mt0x6r0y/研究员:3102——同款
    spawn 工具面契约同族，第四轮实证研究员经 bash 直读；宿主 web:3080 无 agent
    工具不在直读面内）；④ 方法论新增 #16 转发/转手纪律（转发纪律常驻化归位：
    转手默认 ID-only 不转述，直读是获得通道、不转述是传递纪律，二者并存）。
  - 部署：lib/index.js 拷 plugins/lib、CHANGELOG/PU 拷 plugins 根，md5 平价复核；
    注释级服务码改动随下次自然重启生效（当前 858/3263/3278 在线不重启）。
  - c 方案 `sourceChannels` 字段与凭据面账目设计：供后续裁决若改道复用，不改不实。

- ✅ F-W1-1 补账·编号 reconciliation（2026-08-25，审查方登记/实现方补账销账）：
  - **错位事实**：W-1 立案方案表编号＝a 工具收权 / b 存储迁移 / c 接受+审计
    （原 c 附挂 sourceChannels 必选；立案原文：第四轮终审审查方消息，
    2026-08-25；前版措辞「工具范围/存储重定位」为 checkpoint 转述错误，
    已按会话原表更正）；裁决来文（实现方呈现选项、用户选「a）合法化
    磁盘直读」）编号作 a，与立案表 a 不同。实施实质＝原方案表 **c**（接受+审计／
    合法化磁盘直读）。
  - **reconciliation 行（以实质为准）**：W-1 裁决实质＝原方案表 c（接受+审计／
    合法化磁盘直读）；裁决来文编号作 a，与原表 a（工具收权）不同。原 c 附挂的
    sourceChannels 字段经裁决明确存档不实施。以实质为准。
  - **处置**：不动代码不改标签（文档/注释维持裁决来文编号 a + 本行说明错位）。
  - **销账（2026-08-26）**：用户确认实质＝合法化磁盘直读；sourceChannels 保持
    存档不实施（与 reconciliation 行一致）→ F-W1-1 销账闭环。回读坐标：本条目
    （同笔账三点对齐：错位事实→reconciliation→用户确认）。以实质为准。

- ✅ 待办 #2 销账·instances.jsonl 首次落地复核（2026-08-26）：
  - **触发**：宿主自然重启（858→876，2026-08-26 07:29:50 CST =
    2026-08-25T23:29:50.481Z UTC）。
  - **复核**：`$DSH_HOME/bots/started/instances.jsonl` 存在，首行
    `{"pid":876,"at":"2026-08-25T23:29:50.481Z","botId":"host"}`——{pid,at,
    botId|host} 格式与设计一致，host 分支正确（876＝`node /usr/bin/dsh web`
    主 web）。
  - **顺带实证**：876 启动时加载的即为新部署插件（卫生②工件＝新代码产物）；
    服务端改动（F-R4-1 动态模板/捆窗/卫生②/W-1(a) 注释）随此重启全部生效。
  - **附记**：lead/bot-mt0x6r0y 注册表 pid 已由 reconcileStalePids 清理
    （pid=None、startedAt=None、enabled=true 未运行）——boot 不自动 spawn
    是设计态；bot 实例行待各自下次启动时追加（本次未重启，预期内）。
    回读坐标：`$DSH_HOME/bots/started/instances.jsonl:1`。

- ✅ 第五轮 pilot·视觉能力接入实施手册（2026-08-26，用户委派/两 bot 闭环）：
  - **任务**：把 R-2026-002/003/004 整合为单一操作文档（选型定版→接入步骤→
    验收执行→降级兜底，「拿到手册即可上线」完整链路；知识口径，时效项标
    「待核实」）。
  - **链路证据**（UTC）：用户→lead seq32 投递（host API，零加工）→
    lead→研究员派单 seq15 @ 02:58:44Z（ID-only 零转述、主题词检索引导、
    默认沿用前序结论）→ 研究员交付回执 @ 03:00:09.881Z → lead 验收回执
    seq16 @ 03:00:49.154Z（含验收对照表）。
  - **产物**：R-2026-005 登记（valid）；reports/R-2026-005.md 落盘（6026B，
    10:59 本地）；reusedBy 链 002=[003,004,005]、003=[004,005]、004=[005]
    （追加去重正确；001 未被引用＝用户点名即 002/003/004）；无 supersedes、
    无前序结论修正（「核实模型名」细化说明自述沿用于 001→002，非新增）。
  - **真实环境验证**：searchIndex id/主题词检索命中三源 ✓；F-R4-1 动态模板
    描述随 register 使用 ✓；W-1(a) 后检索主通道未被绕过 ✓。
  - **O-ID 监视更新**：最大 reusedBy 2→3（R-2026-002），距阈值 8 余量 5，
    未触达；绑定条款引导句仍在派单文本生效（正确未撤）。
  - 状态：两实例在线（lead 3465 / 研究员 3480 / host 876），无挂账。

- ✅ F-R5-1 立案与三条处置（2026-08-26，第五轮判定 #6 FAIL 设计侧全责）：
  - **事实**：seq15（lead 派单模板，与第三轮 seq11 同构）在无照发条款约束下
    重写用户简报，四合一预置——①软化禁令「按常驻规则不要对同一 id 同时双填
    （除非…本任务预期以 reuse 为主）」；②登记实参预填 reused:[002,003,004]；
    ③tags 建议逐字预埋；④「默认应沿用」预期管理。R-2026-005 的纯 reused、
    无 supersedes、tags 五枚全部与预置一致，不能归因于研究员的语义判断。
    根因：#16 只治「不转述内容」，未治「不预填指令」——语义决定权转移未管住。
  - **处置 1（#17 转手不预填）**：方法论 #16 扩款单列 #17——不得预置四类
    （登记实参 reused/supersedes 具体数组、tags 建议、倾向句「预期以 X 为
    主/默认应沿用」、软化句「按常驻规则…除非…」）；判断权独属产出方依常驻
    规则自决。同时注入协作协议提示段（lib/index.js 委派条款后新增「转手不预填」
    一条，含「收到带预置的任务文本时还原为任务本身派发」——机制侧根治）。
  - **处置 2（照发条款模板化）**：v3.2 照发条款（存档 :16）升格为**派单链
    标准附件**固定模板（PU 方法论区权威位），每轮用户→lead 投递文本自带；
    模板句固定防逐轮重造漂移。
  - **处置 3（双填首考顺延）**：双填考题顺延至下一次自然产生「取代且沿用」
    语义的任务；该轮不得受任何派单侧倾向干预（不预设考题、不提示）。
  - 验证：语法 OK、15/15 全绿。

- ✅ refreshBots 简化（2026-08-26，用户立项：PU「仍可选题」区首轮审查候选）：
  - **依据**：首轮审查原始发现未留归档文本（CHANGELOG:350 仅记口径），以现状
    缺陷分析为实施依据——SSE 换代后（writeRegistry 单一 choke point 广播 →
    根级 refreshBots 事件驱动，client.js:2457-2471）操作后 finally 的显式
    refreshBots 与事件驱动形成**同变更双重 /api/bots 拉取**，属冗余残留。
  - **改动（lib/client.js，客户端脚本）**：① 删除 runBotAction/confirmRemoveBot/
    applyQuickPermission 三处操作后显式 refreshBots；② saveBot 的
    `await refreshBots()` **保留**（唯一例外：create 后选中新 bot 依赖列表
    快照，SSE 事件可能晚于选中帧——加注释固化）；③ refreshBots 定义处加
    「单一刷新源纪律」注释（SSE 常规唯一源 + BotMain 5s 轮询断连兜底 +
    saveBot 例外）。
  - **验证**：语法 OK、15/15 全绿；部署平价（027dd308，双份）；**浏览器实测**
    （browser-harness）：stop/start 后**未手动刷新页面**，header 状态
    在线↔离线自动翻转、菜单项「停止↔启动」随状态翻转——SSE 事件驱动验证
    通过。事实更正：实测操作对象为领队（pid 4102→4847 佐证；两 bot 同模型
    同名状态，初判研究员系误读 header-name，以注册表 pid 为准），研究员未动。
  - 部署说明：客户端脚本页面刷新即生效，服务端零改动；无需重启实例。

- ✅ 双审建制立案与实施（2026-08-26，第六轮派发单 T-2026-006 A–G，用户
  「确认通过，执行」；3 决策点确认）：
  - **背景**：第二轮评审方唯一技术主张（roster 通道 role 字段 slice(0,200)
    注入提示）直证坐实且比主张更强——index.js:2238 是**第一人称职责行**
    （「你是「{name}」…职责：{role.slice(0,200)}」），role 声明不只进队友
    名单、更直接以「职责」身份注入该 bot 自身提示；措辞校准「lead 只收
    不读」不可机械化（:2265 回信自动开启下一回合，lead 必然读到）→ 改
    「提示纪律＋逐字节审计执法」；四枚细化全数采信。双审零分歧。
  - **B① 核实（先核实再动手）**：dsh 运行时（lib/ 打包产物与 README）无
    原生 workspace 指令文件（AGENTS.md 类）加载机制 → 处置：插件侧
    per-botId 注入（registerTeamPromptSection：group="review" 追加「双审
    评审军规」段 order=21、lead 追加「双审试点门控」段 order=22）；兜底＝
    role 声明行（≤200 字符经 :2238 职责行生效）＋R-2026-006。
  - **B② 核实**：防乒乓守卫仅识别 kind="mail-response"（routeReplyToSender
    只对该 kind 关闭回路由），讨论续环需显式 send_mail、无计量无上限 →
    处置：新增 kind="mail-discuss"＋discussRound 机械轮次（开环 1）＋
    DISCUSSION_MAX_ROUNDS=2 机械上限（达上限不再续环，回复留 outbox）；
    send_mail 工具加 kind 枚举参数（防御式校验，绝不通透 mail-response）；
    讨论提示前缀 [mail discuss from bot "X" (R{n})]；replyTo 不变量扩为
    ⟺ kind ∈ {mail-response, mail-discuss}。
  - **A 注册表**：reviewer-lead（主审，group=review，read-only，
    deepseek-v4-pro，:3103）/ reviewer-second（副审，:3104）；role 一行
    侧重声明 ≤200 字符；rail/菜单在线。
  - **F-D1 reconciliation（评审立案后补，F-W1-1 同式三段；此为必做项）**：
    - 事实：副审（reviewer-second）模型实况——建席登记
      （2026-08-26T04:45Z）时注册表 model=deepseek-v4-pro 且
      cordis.patch.yml 的 agent-default-model pin 同值（create-bot.cjs
      路径实写，与主审一致）；2026-08-26T07:43:59Z 起出现 patch() 签名
      变更（cordis.patch.yml mtime 15:43:59、bots.json mtime 15:44:00=
      07:44:00Z、instances.jsonl 07:44:01Z 实例重启 pid 6305→7215），
      现注册表与 pin 均为 deepseek-v4-flash。该变更发生在实施交付之后、
      非编码方操作；PATCH 不落盘操作日志，变更者无明文可考，登记为疑点项。
    - 补正：A 段原文本仅标注主审模型，未逐一双席落账——按决策点①
      「先同模型 deepseek-v4-pro」基准补正：建制落账时刻双席同为
      deepseek-v4-pro（双 pin 实证），落账文本的表述不完整属方法论 #6
      （文档真实性镜像）相逆面，以本行补全。
    - 销账：F-D1 依复核事实确认（07:44Z 变更点已复现）；处置按用户裁决
      （选项① PATCH 回归 v4-pro＋重启／选项② 改裁异模型试点＋E 项三口径
      重新预登记）执行，裁决结果追加本行；试水轮裁决前不得启动。
      **裁决结果（2026-08-26）：用户选②——改裁异模型试点**（用户明确希望
      主副审异模型；同模型系原派发单决策点①，经裁决修订为试点第一变量）。
      执行完毕：R-2026-007 登记（supersedes R-2026-006）、E 三口径降级
      （「一致但双漏」→「趋同或模型差不可区分」）＋解读力下降明示、提示层
      指针更新 R-2026-007、review-prompt 测试同步、17/17 全绿、部署双份
      平价、双席重启（主审 v4-pro／副审 flash 实况成为既定设计）；07:44Z
      变更者仍无明文（用户未确认为己方操作），改裁后登记销解为历史事实。
  - **C 规程登记**：R-2026-006（规程类首条目，task 字段注明类型）经真实
    registerReport 路径登记（锁内 ID 分配／先报告后索引）；内容含流程
    S1–S8 全文、任务号契约（T-2026-00N 打头）、讨论协议（[DISCUSS Rn]）、
    终审固定格式〔判定/F-编号发现带坐标三元组/判据引用/处置要求/分歧对照
    表〕、埋缺陷试点机制、用户上诉权。
  - **D 军规落地**：压缩版六条（先验证再断言/判据预登记/评分影响分离/
    坐标+单位+窗口/销账回读/探针先疑探针）注入 review 组提示段＋
    R-2026-006 指针。
  - **E 埋缺陷试点**：植入方＝用户；植入清单仅植入方知晓（不落盘 bot 可读
    路径）；主审/副审面各 ≥1 枚；三口径度量预登记（一致且命中=健康／一致
    但双漏=系统性趋同信号（rubber-stamp 实证）／不一致收敛于正确=按设计
    工作）；试水轮由植入方择机启动、双席不知晓。
  - **F 测试**：新增 discuss-mail.test.mjs（kind 通道/冒用防护/R1 续环/R2
    机械上限/mail-response 回归/discussRound 落盘防御）＋
    review-prompt.test.mjs（军规段→review/门控段→lead/非双审无注入/roster
    含新成员/职责行兜底）；门控转发时序与终审格式属规程/prompt 层，机械化
    测试面＝注入文本存在性断言（已覆盖关键句）。17/17 全绿。
  - **三个决策点（用户确认）**：① 先同模型（deepseek-v4-pro）＋差异化提示；
    ② 讨论环上限 2 轮；③ 过程件不抄送用户、终审件抄送双席相关方。
  - **派发单全文（G 台账要求，落账）**：
    > **任务：审查 Bot 双席建制（reviewer-lead 主审 / reviewer-second 副审）**
    > **A. 注册表**：两 bot 新增，group=`review`、readOnly=true、permission=read-only、model=deepseek-v4-pro、端口自动分配；role 字段写一行侧重声明（≤200 字符，经职责行生效）：主审=核验矩阵/代码语义与并发安全/台账一致性；副审=证据卫生/归因链/叙事精度/文档真实性/测试覆盖。
    > **B.【先核实再动手】** ① dsh 是否原生读取 workspace 指令文件（AGENTS.md 类）：是→规程落 workspace 文件；否→评估插件侧 per-botId 注入成本；两者都不阻塞建制（兜底=role 声明行＋R-2026-006）。② reply-route 防乒乓守卫对多轮讨论邮件的覆盖面：必要时为讨论邮件定义独立 kind／[DISCUSS Rn] 显式标注。
    > **C. 评审规程登记 R-2026-006**（知识库首个规程类条目，task 字段注明类型）：流程＝用户同文同发直投双席（试点期不经 lead 派发）→ 各初审（判据预登记开头）→ **双初判处 lead 存放，核双齐后逐字转副审件予主审**（承诺顺序物理化；lead 头三轮逐字节审计执法）→ 主审逐条 delta 复审（**副审发现未经主审亲手复证不得进终审**）→ 结论级一致即合并／发现级异议进讨论（≤2 轮、盘面直证、各自复跑探针、逾期 disagree-and-commit）→ 终审固定格式〔判定/F- 编号发现带坐标三元组/判据引用/处置要求/分歧对照表〕→ 抄送副审＋返回用户（编码方缺位期）；用户保留上诉权。全程流程件头部带任务号。
    > **D. 提示层审查军规**（压缩版）：先验证再断言／判据预登记／评分影响分离／坐标+单位+窗口／销账回读／探针先疑探针。
    > **E. 埋缺陷试点**：植入清单对双席盲态（仅植入方知晓）；主审面、副审面各 ≥1 枚；度量预登记——一致且命中＝健康／一致但双漏＝趋同信号（rubber-stamp 实证）／不一致收敛于正确＝流程按设计工作。
    > **F. 测试**：门控转发时序、讨论环计数上限、终审格式校验、instances.jsonl/bots.json 新增行、roster 出现新成员。
    > **G. 台账**：CHANGELOG/PU 落账含本单全文；R-2026-006 登记；lead 管道审计结果随试点报告落账。
    > **三个决策点（双审立场一致，用户确认）**：① 先同模型+差异化提示；② 讨论环上限 2 轮；③ 过程件不抄送用户、终审件抄送双席相关方。
  - 部署与验证：见下一条目（双份平价 + 实例重启 + 在线核验）。

- ✅ F-D1 处置（2026-08-26，选项② 改裁异模型试点；用户裁决）：
  - **裁决**：用户明确希望主副审异模型；同模型 deepseek-v4-pro 系原派发单
    决策点①（用户先前确认），F-D1 改裁后修订为「差异化模型＝试点第一变量」。
  - **复核事实（探针复现）**：副审建席（04:45Z）注册表=deepseek-v4-pro 且
    cordis.patch.yml pin 同值（create-bot.cjs 实写）；07:43:59Z 起 patch()
    签名变更（pin yml 15:43:59 / bots.json 15:44:00=07:44:00Z / 实例重启
    07:44:01Z pid 6305→7215）→ deepseek-v4-flash；变更者无日志明文、用户
    未确认为己方操作，登记疑点；改裁后成为既定实况。
  - **处置执行**：① R-2026-007「异模型试点修订版」经真实 registerReport 登记
    （supersedes=R-2026-006，旧条 target updated、痕迹保留）；② E 三口径
    重新预登记：「一致且命中＝健康」不变／「一致但双漏」降级为「趋同或
    模型差不可区分」（rubber-stamp 实证口径取消）／「不一致收敛于正确＝
    按设计工作」不变（归因含模型差变量）；③ 试点解读力下降明示（双漏与
    部分不一致的归因力下降，试水轮按降级口径解读）；④ 提示层军规段指针
    更新为 R-2026-007（lib/index.js），review-prompt.test.mjs 同步
    （R-2026-006→R-2026-007 断言）；⑤ 17/17 全绿；⑥ 部署双份平价；
    ⑦ 双席重启加载新指针（主审 v4-pro／副审 flash）。
  - **销账状态**：F-D1 处置完毕、必做项 reconciliation 已追加裁决结果；
    试水轮启动指令仍待用户下达（植入清单保密纪律维持：清单仅植入方知晓、
    含 /tmp 不落盘）。

- ✅ F-T6-2 一行修复（2026-08-26，双审返件：指针半转换残留，非阻塞）：
  - **定位**：lib/index.js:2040 send_mail 工具 kind 参数的 description 仍引用
    R-2026-006——该描述属模型可见工具 schema（非历史注释），与主提示段
    （order=21 军规段已指向 R-2026-007）形成现行指针半转换。
  - **修复**：kind description 改为「见现行规程 R-2026-007（异模型试点
    修订版）」；历史 CHANGELOG/PU 及 index.js 内说明 R-2026-006 来源的
    注释一律不动（supersedes 追溯链完整）。
  - **测试守卫（验收项 4）**：discuss-mail.test.mjs 增补工具 schema 指针
    断言——kind 参数描述必须含 R-2026-007 且不得把 R-2026-006 当现行，
    防止今后只更新军规段而遗漏工具描述。
  - **验证**：语法 OK、17/17 全绿；部署双份平价；四 bot 重启加载新描述
    （工具描述在 bot 实例 apply 时注册）。
  - 编号说明：主审临时 F-T7 与本条相同，并入 F-T6-2，F-T7 作废。

- 🚀 试水轮 T-2026-008 启动（2026-08-26，用户「启动」指令；目标＝T-2026-006
  最终状态总审）：
  - S1 执行：同文同发直投双席（reviewer-lead seq2 / reviewer-second seq2，
    10:12:23Z），任务号置于文首；派发文本含边界 a)–d)（代码/规程/台账/部署
    四面）、评审口径（R-2026-007、判据预登记、坐标三元组、亲手复证）、产出
    流程（初审→lead 存放→转交→delta 复审→终审 CC 副审并返回用户）与验收
    标准；无试水暗示、无预填，盲态维持。
  - 现场事实登记：两席 inbox 的 seq 1 系先前 T-2026-007 试水轮 host 直投
    （09:37:08Z，产出 F-D1/F-T6-2 的那一轮），历史留存无损。
  - 后续里程碑（S2–S8）以监视日志与终审件落账为准（见 started/ 监视记录）。

- 🎯 试水轮 T-2026-008 终局（2026-08-26，目标＝T-2026-006 最终状态总审）：
  - **管线证据链（S1–S8 全程留痕）**：10:12:23Z 同文双发直投（seq2×2）；主审
    初审 10:15:42Z（FAIL，F-1高/F-2中/F-3中）→ 副审初审 10:21:44Z（FAIL，
    F-1高/F-2中/F-3低/F-4低/F-5低）→ lead 10:22:33Z 转交副审件予主审——
    **逐字节核验 6336==6336 一致（S3 照发合规，承诺顺序物理化实证）** →
    主审 delta 复审 10:24:24Z 出终审定稿（复证后 F-4/F-5 采纳为新增，S4 合规）
    → 副审 10:25:40Z「对终审件无异议，结论级一致即合并」→ 双席四项裁定方向
    收敛 10:26-10:27Z → 冻结待用户授权（选项 A/B/C）。
  - **终审判定：FAIL（F-1 高硬阻断 / F-2 中 / F-3、F-4、F-5 低）**：
    F-1 主审实况模型=niko/gpt-5.6-sol（四源复证：bots.json/API/pin/
    settings，pid 12872），与 R-2026-007 登记的 v4-pro 断裂；F-2 部署侧独有
    scripts/bot-health.cjs 零台账、平价口径无定义（公共运行代码平价成立）；
    F-3 测试套件 TMPDIR 敏感（只读沙箱 /tmp EROFS，/dev/shm 下 17/17）；
    F-4 R-2026-006.md 文件头 status=valid 未随索引 updated（superseded 不
    回写文件头）；F-5 lib/index.js:2285 与 review-prompt.test.mjs:5 两处
    当前指针滞后注释（行为已 R-2026-007）。
  - **试水轮三口径测量（R-2026-007 降级口径）**：一致且命中 3 项（F-1/F-2/
    F-3 双席独立命中，各自探针路径不同——主审 curl+cat+grep、副审四源+instances
    链+全树 grep，无趋同迹象）＝**健康**；无「一致但双漏」样本；F-4/F-5 主审
    初审未报、delta 复证后采纳（S4 亲手复证合规）；F-3 严重度分歧（中vs低）
    在终审收敛为低。结论：双席建制按设计工作。
  - **证伪/边界**：双席分别声明未读植入清单（盲态维持）；讨论环未触发
    （结论级直接一致，无 mail-discuss 流量）。
  - **未登记变更（二次出现）**：reviewer-lead 10:10:23Z pin→gpt-5.6-sol +
    10:10:25/10:19:13/10:19:23Z 三次重启（pid 10965→11514→12828→12872），
    变更者无日志明文——与 07:44Z 副审→flash 同模式；双席均独立发现并记入
    F-1。多处实况确认时点为试水轮直投（10:12:23Z）之前与进行中。
  - **状态**：终审冻结、FAIL 挂账、不执行任何改动（双席一致立场）；四项销账
    方向（恢复主审 v4-pro／平价口径定义+bot-health 入账／R-006 文件头同步／
    注释清理+台账补登）待用户授权（A/B/C）。

- ✅ T-2026-008 四项销账执行（2026-08-26，用户授权 A；变更归属用户确认）：
  - **变更归属销疑**：用户确认 07:44Z（副审→flash）与 10:10Z（主审→gpt-5.6-sol）
    及 10:19Z 两次重启均系其侧 GUI 编辑弹窗操作——两处「变更者未明」疑点
    一并销解，台账按「用户侧操作」登记（F-D1 reconciliation 与 F-1 依据更新）；
    提示：试水轮进行中改配置会扰动双席（本轮流经实证），后续避免。
  - **F-1 销账**：reviewer-lead PATCH 回 deepseek-official/deepseek-v4-pro
    （bots.json/API/pin 三源自动回归）＋第四源 settings.yaml 手工同步（原
    scaffold 未回写,四源不一致残留已补正）＋实例重启（10:34:00Z pid 13464）
    ——四源终态全部 deepseek-official/deepseek-v4-pro；异模型 v4-pro/flash
    方案（用户已确认）保持成立。
  - **F-2 销账（平价口径定义）**：口径＝「公共运行代码平价」——lib/*.js、
    package.json、scripts/*.cjs（含 bot-health）、CHANGELOG/PU 双份逐字节
    一致；tests/、preview/ 为开发/验证产物明确排除；bot-health.cjs（稳定
    框架第 1 层：健康检测/安全修复/验证闭环，先归档后动/幂等/可回滚/lead
    默认保护）自 Aug-21 跑在部署侧，现**纳入项目 scripts/ 与台账**（md5
    bec2ef66 双份平价），源码审计/回滚来源闭合。
  - **F-4 销账**：reports/R-2026-006.md:7 文件头同步为「状态：updated（已被
    R-2026-007 取代；索引为唯一状态权威）」；同索引 status=updated/
    supersededBy=R-2026-007——直读旧报告不再误判现行性。
  - **F-5 销账**：lib/index.js:2285 与 tests/review-prompt.test.mjs:5 两处
    「当前指针」滞后注释清理为 R-2026-007（行为文本为基准，历史来源注释
    豁免规则不变）。
  - **F-3 销账**（复核轮 T-2026-008-R F-R1 补闭环）：CHANGELOG/PU **双处**
    注明「17/17 全绿」复现条件＝可写临时目录（TMPDIR 如 /dev/shm；只读
    /tmp 会 EROFS）；本条目即本子项闭环记录（CHANGELOG 侧），PU:137-140
    同步补注（PU 侧）——验收项 c) 按「并列双处」口径核验；TMPDIR=/dev/shm
    复跑 17/17 全绿（复核轮双席均亲手复证）。
  - **验证**：node --check 通过、17/17 全绿（含 F-T6-2 指针守卫与 F-5 清理
    后断言）；部署双份平价（index.js/CHANGELOG/PU/scripts/bot-health.cjs）；
    四 bot 重启加载（含主审 settings 第四源生效）。
  - **状态**：FAIL 挂账依据（F-1..F-5）全部出具销账证据链，复审权在你
    （可令双席小复核或直接验收销账回读坐标）。

- 🚀 复核轮 T-2026-008-R 启动（2026-08-26，用户「继续任务，自行选择」自主立项）：
  - 目标：T-2026-008 终审五项发现（F-1..F-5）销账证据链的最终状态小复核——
    对 a) 主审四源终态 b) 公共运行代码平价+bot-health 入账 c) TMPDIR 复现
    条件注记 d) R-006 文件头同步 e) 注释清理 f) 台账镜像 六面逐条销账回读。
  - S1 执行：同文双发直投双席（主审 seq10 / 副审 seq5，10:45Z 后），任务号
    置于文首；口径 R-2026-007（判据预登记/坐标三元组/亲手复证/销账回读
    #3）；验收＝五项全成立→PASS，任一不成立→发现+分歧对照表。
  - 前置落账：知识库登记 R-2026-008 试点总结报告（三口径测量/管线实证/
    lead 管道审计/销账闭环，reused=R-2026-007；索引 8 行）。
  - 指针完备性审计（方法论 #10）：lib/tests 无 R-2026-006 现行指针残留
    （唯一命中为 F-T6-2 守卫断言本身）；CHANGELOG/PU 17 处均为历史说明
    （豁免类）——F-5 类残留零存量。
  - 纪律：复核进行中不碰任何配置/不扰流（试水轮教训执行）。

- ✅ 复核轮 T-2026-008-R 终局（2026-08-26，用户自主立项的最终状态小复核）：
  - **过程**：同文双发（主审 seq10/副审 seq5）→ 主审初审 CONDITIONAL（F-R1
    低：F-3 销账半闭环）10:58-11:00Z → 副审初审 PASS（0 发现，未核 PU 侧）
    → lead 核双齐转交 → **发现级异议进讨论环**：主审 [DISCUSS R1] 开环
    （11:03:39Z，mail-discuss dr=1）→ 副审 R2 复跑双探针证实主审（PU
    grep=0 命中、销账条目无 F-3 子项）并自认核验缺口、收敛为 CONDITIONAL
    （11:05:30Z）——**讨论环 R1→R2 一轮收敛，未触发续环**（S6 协议实证，
    mail-discuss 机械轮次/上限机制实测正常）→ 主审终审出件（11:07Z，
    delta 复审+分歧对照表完整）→ 经 lead 抄送副审并返回。
  - **终审判定：CONDITIONAL**——F-1/F-2/F-4/F-5 销账成立（双席一致）；
    F-3 半成立（F-R1 低）＝复核轮唯一发现。
  - **F-R1 处置（可直执行类，已闭环）**：① PU:135 处补注「17/17 全绿」复现
    条件（TMPDIR 如 /dev/shm；只读 /tmp EROFS）+「并列双处」核验口径；
    ② CHANGELOG 销账执行条目补「F-3 销账」子项（双处注明+17/17 复跑）；
    ③ 口径固化（并列要求按双处逐一核验——T-2026-008-R 教训入 PU）。
  - **复核结论**：六面销账回读坐标（四源终态/平价+bot-health/复现条件/
    文件头/注释/台账镜像）双席亲手复证一致；S3 转交 6336B==6336B 独立
    重比对通过；「17/17 全绿」在注明条件下双席各自复跑成立。
  - **状态**：F-R1 处置完成后 CONDITIONAL→PASS 条件满足（台账回读坐标：
    PU:137-140、CHANGELOG F-3 销账子项、grep 命中计数≥1）；试水轮
    T-2026-008 与复核轮 T-2026-008-R 双双闭环。

- 📌 用户指令：模型选择权归用户（2026-08-26）：
  - 用户明确「忽略模型变更带来的变化，后面自行选择合适的主审 LLM 和副审
    LLM」——双席模型由用户后续自定；当前 v4-pro/flash 仅为现状值（过渡）。
  - 口径调整：用户侧模型变更一律不再作为评审发现（F-1 类「台账与实况模型
    断裂」硬阻断判定撤销）；R-2026-007 已追加附注（E 段「模型差变量」以
    用户选定后实况为准）；用户选定后按台账镜像原则补登记。
  - 后续轮次评审若再遇模型配置差异：登记事实、不判硬阻断、不自动改配置，
    交由用户处置。

- ✨ Bot 模式页支持推理等级选择（2026-08-26，用户反馈「bot 页面里的模型没法选思考程度」）：
  - 背景/诊断：各 bot 独立页面（3101-3104 官方模型选择器）本就支持「推理等级」
    子菜单（浏览器实测 Off/Low/High/Max 单选）；缺口在我们插件的整页 Bot 模式
    新建/编辑弹窗——只有 provider/model 两个下拉，且目录拉取丢弃了 reasoning 元数据。
  - 实现（7 文件）：
    - lib/client.js：目录拉取保留 reasoning 元数据（模块级缓存 byProvider/
      reasoning）；弹窗新增「推理等级」下拉——仅当所选 provider/model 带
      reasoning 元数据时出现，选项用目录 effort 名，默认跟随模型 defaultEffort，
      切 provider/model 时前端选择路径按目标模型条目重置合法值（目标模型不支持时清空或采用其合法 defaultEffort，保留仍合法者）；服务端仍仅校验 reasoningEffort 类型，不承担 provider/model 白名单归一化；提交体带
      reasoningEffort；composer 模型 pill / 头部状态 / 详情面板同步展示
      「模型 · 推理等级」。
    - lib/index.js：create/patch 接受 reasoningEffort（patch 非字符串 400）；
      modelChanged 判定纳入；scaffold 透传 --reasoning-effort；模型相关变更后
      自动同步 settings.yaml 的 agent-default-model 段（第四源自动化——运行中
      bot 以 settings 段为活源，此前靠手工 sed 同步的历史缺口闭环）；
      buildPatchYamlBuiltin 透传。
    - lib/shared.cjs：buildPatchYaml 支持 reasoningEffort pin 行；新增
      upsertAgentDefaultModelSection（文本级手术：段缺失追加/段内 provider·
      model·reasoningEffort 三键重写/清空删键/清模型删整段，其余内容绝不覆盖）。
    - scripts/create-bot.cjs：--reasoning-effort 参数透传 pin。
  - 验证：node --check 全过；17/17 测试模块全绿（TMPDIR=/dev/shm；`tests/run.mjs` 汇总器不计入分母，新增 5 个 route 断言：
    PATCH 联动写四源 / 清空删键 / 清模型删段 / 非法类型 400 / create 写活源）；
    浏览器实测宿主 Bot 模式端到端：新建临时 bot（deepseek-official /
    deepseek-v4-pro）→ 推理等级默认 High、选项 off/low/high/max → 选 Max →
    创建后注册表 + settings.yaml + cordis.patch.yml 四源一致 → pill 与头部显示
    「deepseek-v4-pro · Max」→ 删除销账（注册表清除 + profile/workspace 清理）。
  - 部署：lib/*（index/client/shared/knowledge/stats）+ scripts/create-bot.cjs
    七文件双份逐字节平价（md5 双份核对）；宿主已重启运行新码（pid 16494，
    manifest 正常）；四实例未动（本次改动不影响 bot 运行逻辑，下次启动自然
    加载新码）。
  - 模型选择权不变：主审/副审 LLM 与推理等级均由用户在 Bot 模式页自选
    （本功能即选择入口）；选定后按台账镜像原则补登记（R-2026-007 附注口径）。F-T8-R2：模型切换改为按目标 provider/model 解析 reasoning 元数据，避免沿用旧模型的 effort 列表；回归覆盖 A→B 不兼容、A→无 reasoning、以及合法 effort 保留。F-T8-R3：新增 modelSelectionValues 纯函数（目标条目解析 + effort 归一化一次完成），choose() 直接消费其返回值；测试断言完整提交体（modelProvider/model/reasoningEffort），调用链覆盖自此闭环。

- ✅ 阶段收口（2026-08-27，审查方执行 · F-N1 补账与卫生处置）：
  - **F-N1 补账（对话清空操作入台账）**：2026-08-26 12:01（本地）用户指示
    清空 lead + 研究员对话历史，执行方式＝先归档后截断——双会话（lead
    `26b8c1dd` md5 `5d696b3c` / 研究员 `c9235c12` md5 `4a7fe22b`）、双指针、
    双 inbox（34+16 行）、outbox 48 文件全量移入
    `~/.dsh/archived-sessions/bot-conversations-wipe-2026-08-26/`；活态 inbox
    截空、指针删除待自然重建；知识库未动。归档副本 md5 审查方实测吻合
    （研究员副本 `4a7fe22b` 逐位一致）。此前该操作仅记录于归档区
    MANIFEST、CHANGELOG 零落账（F-N1），本条目即单权威台账补账；审查方
    前轮「研究员空区＝天然隔离态」的归因一并更正为「清空操作产物」。
  - **散件处置**：lead 工作区 `eye-settings-fix.yaml`（08-21 眼睛 settings
    修复草案，核验已并入 `~/.dsh/profiles/bot-mt2bqvh2/settings.yaml`——
    siliconlow provider 在位）与 `greeting-for-researcher.txt`（08-20 建队
    欢迎草稿）移入清空归档区 lead/ 留痕，MANIFEST 追记。
  - **卫生**：`bot/` `ui-bot/` `x/` 三个零文件空工作区（scaffold/建删测试
    残留，终验 0 文件）删除。
  - **挂账更新**：双填首考**销账**——R-2026-007 对 R-2026-006 同 id 双填
    实战闭环（索引三标记齐备：status=updated + supersededBy + reusedBy），
    顺延挂账条件已满足；新增待决项「模型终选与四源重建」（PU 待触发区
    登记，用户决策项）。
  - 纯台账/卫生操作，无代码变更，无需重启；CHANGELOG/PU 双份平价随附。
