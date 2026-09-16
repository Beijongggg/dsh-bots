# Map: dsh-bots 团队组织形式 v2

Labels: wayfinder:map
Charted: 2026-09-08（建图会话三轮 grilling 定稿 destination，Q1~Q9 裁定入 Notes）

## Destination

一份可拍板的《团队组织形式 v2》规格：岗位集与分工、协作协议与任务生命周期、
人间接口、权限模型、岗位工具配置（MCP/skill）、模型指派配置面、组织恒久性
判据——设计以 research 吸收的恒久内容为依据；完成后交 /to-spec→/to-tickets
→/implement 建设。既有基建（mail/knowledge/SSE/review）＝参照而非受保护
底座（用户裁定 Q8②）；阶段 3/4 基建债不在此图。

## Notes

- 领域：dsh-bots 多 agent 团队组织层（cordis 插件、DSH host 之上）。
- 每会话先读：`docs/PROJECT_UNDERSTANDING.md`、
  `docs/GROK-DSH-BOTS-COMPARISON.md` §4/§7/§10、`CONTEXT.md`
  （「组织形式」「模型指派」两词已定形）。
- 常设裁定（勿重问）：
  - 终点＝规格，不直接动代码；wayfinder 只产决策。
  - 模型指派＝用户运行时裁定域；架构义务＝岗位-模型解耦（见 CONTEXT.md）。
  - token 预算数值属用户域；架构只留按岗指派＋用量可观测的缝。
  - 终景＝常态值守＋任务编组双形态；主轴＝目标→团队自治，用户只在关键
    裁定点出场。
  - 既有实现可推倒重设计，组织最优为准（Q8 裁定②）。
  - 人间接口正式化：关键裁定投递用户；便宜模型可代验收初审，终裁留用户。
  - 组织形式＝**能力放大器**（用户 09-08 补述价值面）：全低配组合也应
    完成裸低配模型完不成的任务——分解/互检/流程脚手架/工件外置是放大
    机制，设计各票时须问「此决策放大能力还是只摊成本」；规格验收含此
    向检验。
  - **网络环境声明（2026-09-08 用户）**：外网多站可能不可达——本轮
    research 产物＝**暂定稿非终稿**（研究报告含盲区清单）；grilling 票
    可暂基于暂定结论推进，但研究性裁定须标注「待补充轮复核」。待用户
    声明网络可用后开补充调研轮，再行定稿。
  - **网络可用声明（2026-09-16 用户）**：补充调研轮开跑（14/15 号票执行，
    结论升降级与撤标注归 16 号票）。当轮实测可达＝arxiv.org（abs 与 HTML
    全文）／anthropic.com／platform.claude.com／code.claude.com／
    cdn.openai.com（PDF）／docs.letta.com／modelcontextprotocol.io／
    api.github.com；**`github.com` 与 `raw.githubusercontent.com` 直连超时**，
    GitHub 托管件改走 api.github.com contents API（`Accept:
    application/vnd.github.raw`）；`WebFetch` 对个别 arXiv abs 页抽取返回空
    文本，退路＝`curl` 抓 HTML 后本地提取。
  - **宿主面更迭声明（2026-09-10 用户补述）**：DSH 仍处持续更新——插件兼容
    面会被更新代换，且「前端与 DSH 原生统一」的期望会不断受宿主 UI 变更
    冲击。设计义务：组织规格（岗位/协议/工具/权限）不得依赖会被宿主更新
    代换的内部面（cordis 槽名、client bundle 结构、API 形状、模型解析链
    等）；宿主依赖须显式隔离为可替换适配层，并纳入恒久性判据。UI 实现形态
    仍按 Out of scope「UI polish」处理——除非用户另裁。
- 技能约定：grilling 票必须 call the Skill tool twice, for "grilling" and
  "domain-modeling"；research 票由子代理 call the Skill tool with "research"。
- 本地 git 评审仓已建立（2026-09-08 基线 commit `ba1856d`、无 remote）——
  **建图时记「本仓库非 git」自始与事实不符（git 仓 12:37 先于建图 15:08），
  2026-09-10 按文档真实性镜像修正**；research 产物仍落
  `.scratch/org-v2/research/`（上游 throwaway branch 约定的本地化，既成
  事实），票据内链接指向。

## Decisions so far

<!-- 一行一票：[票题](issues/NN-slug.md): 答案梗概 -->

- [组织模式研究](issues/01-research-org-patterns.md): 跨厂共识＝单 agent
  优先，多 agent 是 token 换并行的溢价架构（实测约 15×token，重并行/
  超单窗/多工具三要件才启用）；模式菜单七式（supervisor/层级/扁平对等/
  广播群聊/动态编组/并行投票/矩阵）＋失败分类学 MAST（3 类 14 式，多数
  可由协议预防）；dsh-bots 初判＝常态值守扁平对等＋任务态 supervisor
  按需拉起，双形态叠加即**矩阵组织**（职能线＋项目线共享同一批 bot；
  推理标注，直接文献为盲区）；**暂定稿**（20 一手来源，8 盲区）——全文
  research/org-patterns.md
- [恒久原则研究](issues/02-research-enduring-principles.md): 试金石＝设计编码
  的是「任务/环境/组织的事实」还是「对某代模型行为的假设」；判据 D1–D10
  （上下文预算分层/契约外置/最小充分指令/四要素移交＋全轨迹/单线程默认/
  记忆三层/验证外置/增益本质＝token 放大）＋反例 R1–R10（edit-apply 修复、
  咒语提示、标称窗口、滥用并行、摘要式移交等）；**暂定稿**（网络受限，
  8 项盲区待补充轮）——全文 research/enduring-principles.md
- [岗位集与分工结构](issues/03-role-set.md): 岗位＝角色类别（实例按需、bot 为
  载体、一实例一 home 岗位可被项目线借用）；岗位集＝值班统筹 `duty-coordinator`
  ／项目经理 `project-lead`／研究员 `researcher`／实施者 `implementer`＋按需
  复核者 `verifier`（有岗位卡与独立只读权限面、不入常驻编制）；分诊与验收初审
  挂值班统筹（确定性优先、判断上浮须可归因）；知识/规程维护与调度不单设岗；
  组织不变量＝单一时刻单一任务归属＋冲突上抛用户＋单入口收单结论直通＋验证
  外置复核隔离；**现役四席无保留义务、直接按 v2 重建**；前端「原生像素级统一」
  降级为「原生一致优先、功能可用兜底」；宿主面更迭义务入岗位卡第 8 字段并开
  11 号专票（矩阵前提待补充轮复核）
- [评审的存在形式](issues/04-review-form.md): 复核＝「必审清单＋判据＋gaps 报告＋
  修复回合＋上浮」件套（**无 stage 机**）；触发＝三类客观判据（不可逆／对外可见／
  跨实例关键产出）命中即强制、可加审不可免审；处置＝分级（必审产出阻断、其余
  咨询）＋连续两轮未闭合上浮用户终裁；判据由派单方在四要素简报预登记且须可执行，
  复核者可自跑可执行检查（runProbe）但**只读**、不得改工件/放宽判据；独立＝读不到
  产出方推理轨迹（fresh context 硬要求；模型同异留用户域但报告须记模型身份）；
  复核者＝**契约帽子**（任意当次空闲实例佩戴，同任务产出方不得自任，不设专席位）；
  13 stage/双席/提示层双审注入/enforcement 矩阵/试水轮/R-2026-007 **形态废弃**
  （代码层处置归 12）；review store 保数据、capability 通用权限原语归 06、
  user-decision 升格人间终裁原语归 09、runProbe 归 07（MAST 依据待补充轮复核）
- [协作协议与任务生命周期](issues/05-protocol-lifecycle.md): v2＝**任务台账**
  （一等对象：host 侧 append-only、单一写者、状态为事件投影；taskId＝provenance
  根）＋**四要素简报**（objective/output format/tools-sources/boundaries＋可执行
  acceptance，派出即冻结、改动走 amend）＋**边界事件式复核点**（不可逆写入前／
  对外可见前／跨实例关键移交前各一道，**不在结算处另设**）；同一任务对象分
  `duty|project` 两类（例程声明式登记＋routineId+window 幂等）；确定性 FSM 十主干
  态＋四旁路，LLM 只发命令不改状态；派单＝台账持有归属＋显式接单＋租约回收（T/N
  数值属用户域）；关闭不可重开、归档不删档；异常四类统一走台账、**不静默丢失**；
  mail 退为投递通道（生命周期只要求 at-least-once＋幂等）；通知＝台账事件投影；
  新票 13「规格验收标准」由此毕业
- [权限模型](issues/06-permissions.md): v2＝**权限四层**（L0 实例基底＝sandbox
  权限模式用户域旋钮照旧／L1 文件面＝bot 直写仅限自身 workspace、`~/.dsh`
  全域与一切共享面零直写／L2 组织命令面＝capability 岗位化＋台账命令三元组
  鉴权／L3 人间面＝CSRF user principal 台账全权）——**复用底座加严不另起**；
  **邮件零权威**（内容永不构成权限/状态/事实依据、投递不设 capability、
  capability 递送不经 mail）；capability＝host 在台账转移点签发（bot 不能自请）、
  单次消费＋短 TTL 心跳续签、`binding.taskId` 绑定、生命周期自动吊销 task 槽；
  岗位 op-set 表（四常设岗含 `ledger.read` 组织事实读；**复核帽无任何写 op 且
  无 `ledger.read`**＝独立性机械成立；运维归人间面不设 op）；复核只读面＝
  op-set 否定式、与实例基底**正交叠加取严**；台账命令鉴权三元组（实例活态＋
  op 白名单＋任务域租约匹配）＋CAS＋idempotencyKey＋fail closed 拒绝留台账
  事件；恒久判据加「无岗位以 danger-full-access 为履约前提」
- [岗位工具配置](issues/07-tooling.md): 复用 cordis tools 服务按岗位卡派生注册
  （否决 MCP 与自建装载面）；**一 op 一工具**、工具名即 op 名（工具面裁剪＝
  权限裁剪）；岗位卡＝唯一源、提示段为派生物＋构建期漂移校验 fail；简报＝
  claim 响应携带不进 systemPrompt；mail **收口 host 中继**（send_mail→认证
  命令 mail.send、bot 直写取消；存废与删除时点归 12）；knowledge register
  命令化、search/直读照旧；runProbe 判据改接台账 acceptance 预登记（白名单
  机制 fail closed 入规格、清单可扩）；失效**无文件直写降级**（三分支错误
  回执/台账事件/进流程）；**v2 词表无 skill**（规程＝岗位卡＋knowledge 两
  形态）；戴帽/借用不变量＝home op ∪ 当次签发 op
- [组织恒久性判据](issues/08-durability-criteria.md): 分界规则＝组织层件
  白名单封闭枚举（协议/台账/复核件套/权限四层/岗位卡 1–6/8 字段）逐条过
  「换模型试金石」，岗位细节只住三处（岗位卡第 7 字段/提示段/实例配置）；
  判据终清单 **D1–D11**（D5 改写为「可执行规程资产」两形态、D8 MCP 字样
  移出改「工具面岗位卡派生跨模型稳定」，覆写出处 07）；**升级例程四步**
  （指派变更→台账自动登记 duty 评测任务→新模型跑岗位评测集→做减法→用户
  终裁），评测集＝契约回放 1–3 冻结样本/岗位、形状「每岗至少一可执行评测项」
  数值用户域；价值表述＝「裸实例（同模型同权限**同工具面**、去组织层）预算
  B 内完不成而组织形式同量级完成」；放大验证＝3–5 任务按机制各取一＋裸对照
  ＋台账事件投影归因、不做消融，一次性验收实验执行归 13
- [人间接口规格](issues/09-human-interface.md): 到人裁定仅三类进 `waiting-user`
  （不可逆放行／上浮终裁／用户域裁定请求），其余到人事件纯告知不挂起；投递面＝
  **DSH 前端人间收件箱**（台账事件投影＋终裁操作；mail 仅出仓库只读转发、
  回文永不构成裁定）；挂起**无超时自动动作**（无限期；业务 deadline 仅投影
  「已过期」不自动取消）；验收初审代理＝可处置清单外产出、必审产出只整理
  裁定包、初审拒绝或两轮未闭合强制上浮，模型指派/越权处置/冲突仲裁永不可代；
  终裁＝`actor=user` 台账命令的特化视图（不另起命令面）；裁定包五件（冻结
  简报/判据事实/双方立场＋轨迹指针/动作清单/模型身份）
- [团队记忆与知识层](issues/10-memory-knowledge.md): 记忆三层定形＝岗位私有
  （workspace 自由笔记、实例消亡无迁移义务）＋团队共享不设第三面（任务事实
  →台账、可复用结论→知识库）＋组织常量＝配置面；写入三问分流（任务历史
  事实/跨任务有效/taskId 工件，推理过程不进任何面）；晋升＝关闭流程内产出方
  登记、强制由简报 output format 预声明、门槛三条（换模型试金石/独立成立/
  留痕）、不设强制复核点；失效＝显式 supersedes/deprecated 唯一机制（不做
  自动）、冲突台账胜＋岗位卡胜；**知识库容器协议补进组织层件白名单**（08
  张力收口；条目＝运行时资产逐条过试金石）；移交只传指针拉取式、工件归档
  不删档无保留期上限；检索维持索引级子串、复用率 KPI 人工核对（进 13 号票
  输入）
- [宿主/插件面更迭的隔离与升级](issues/11-host-surface-churn.md): 判定规则＝按
  **失配后果**分类而非按层（A 静默降级面→可替换适配层＋行为探针／B 响亮面→
  登记＋存在性探针、可直用／C 非宿主面显式排除），**版本探测仅诊断字段不作
  门**（门只由行为断言把守）；**宿主适配面登记表**补进组织层件白名单第 6 类
  （切分照 10 号票：容器协议进白名单、条目内容＝运行时资产），岗位卡第 8 字段
  ＝引用面 id 不重复坐标；探针三态 PASS/FAIL/SKIP——SKIP 必须分列计数可见
  （修掉 `locale-runtime` 守卫的假绿）、**运行面/部署面 SKIP 视同 FAIL**、FAIL
  默认**面级降级**（照 07 三分支口径）、**整层拒载仅限组织层身份面**，失效以
  class=duty 例程任务落台账承载处置（**不新增台账事件类型**）＋按 09 告知；
  挂载＝独立 `scripts/host-contract.mjs` ＋ preflight **第 4 道门**（不并入
  tests/：无 SKIP 通道且不耦合宿主安装状态），与 `locale-runtime` 行为断言互补；
  权责＝适配层与探针代码归实施者、巡检与升级评测编排归值班统筹、**宿主版本
  处置归人间面**，红线＝不得回退为「取消适配层直读宿主私有面」；前端红线＝只
  依赖宿主显式注册面、禁读私有 DOM/CSS 钩子（`lib/client.js:3064` 越界 1 处
  登记在案，代码处置归 12），验收＝槽装载探针＋一次人工目视功能清单、**不设
  视觉回归**、宿主 UI 大改不构成「重做前端」义务；**代码面全归 12 号票**（适配
  层／探针脚本／第 4 道门／守卫修法／越界改造，落地时校正登记表坐标）
- [v2 重建的迁移与并存策略](issues/12-migration-coexistence.md): **一批式切换、不设双轨**
  （前置段：v2 组织层件＋11 号票四项＋迁移工作清单；点名段：部署同步→重启链各一次点名；
  切换段：单窗口内撤旧四席→建双席→就绪探针→最小闭环 smoke）；切换点判据三条并行全绿
  （preflight 四道门／就绪探针／用户点名）**＋A 组验收坐标无空缺（13 号票补，2026-09-16）**；**旧四席 id 不用**——新建语义 id，
  bootstrap 锚点泛化（`createLeadBot`→锚点、删除保护改「锚点席位不可删」、空表重建改锚点，
  `lib/index.js:2386-2416`/`3080`/`3121` v1 注入与硬编码随形态删）；**最小起步编制＝
  `duty-coordinator`＋`implementer` 双席**（就绪＝门绿＋探针＋最小闭环 smoke；雾条由此
  消解）；mail **保数据不保形态**（保 at-least-once／幂等／seq 锁，废 kind 与
  `replyTo⟺kind`，关联键改 taskId）；评审面 16 个**非冻结** `review-*` 模块删净（7114 行
  ＝lib 39%）＋capability/store 通用基座拆出保留＋**冻结面 9 文件零单独触碰**（enforcement
  矩阵的删除并入 v2 实现批的证据包，不单开 0009）＋**证据包链与 preflight 门② 存续**
  （§2 长期纪律）＋PLAN P0.3 加废止标注不删表；SSE 保形态、事件集改
  `bots/mail/ledger/reload`（新增 ledger 承载台账投影）、知识库 9 条原样保留＋新条目显式
  废止 R-2026-009；旧席数据（profiles 配置件／workspaces／mail／review 存量）**归档后清
  运行面**（`artifacts/archive/org-v1-runtime-<date>/`，需点名）；回退面＝
  `deploy-pre-org-v2-<date>` 备份＋git 提交点，回滚权在用户、不演练；阶段 3/4 债以
  **单向边界指针**（规格→PLAN）挂接
- [v2 规格验收标准](issues/13-spec-acceptance.md): 验收＝两卷——**A 组七域实现完备性**
  `V-A1`–`V-A7`（岗位集／协议与台账／权限四层／工具面／人间接口／宿主适配面／恒久性与
  记忆知识层，60 条，逐条带执行坐标＋证据落点，标「常驻」或「实验期一次」，规格附录
  唯一权威）＋**B 组能力放大** `V-B1`–`V-B6`（现场构造 3–5 任务按机制各取一、裸对照先
  跑定基准、token 为主口径、归因不进判定）；判据**随规格定稿同批冻结**、执行后不得新增
  （方法论 #2），实现批只补坐标，**切换批前置加「A 组坐标无空缺」**（已回写 12 号票）；
  裸实例＝**同基础工具面＋无组织命令**（08 §5 口径覆写收口）；判定两态 fail closed、
  不通过走修复复跑、两轮未闭合上浮用户；A 组随实现批、B 组切换后一次性实验由值班统筹
  编排，证据进增量包、摘要进 CHANGELOG、通过记录进台账；依赖暂定结论的条目挂
  `待补充轮复核` 标注并单列计数。**本票为全图末票：13 张全闭、frontier 收空，交棒
  `/to-spec`**
- [补充调研：组织模式报告盲区 1–8](issues/14-supplement-org-patterns.md): 网络声明后
  的补全轮（子代理 research 执行＋主会话抽验）。方向：盲区 1 矩阵节**维持降级**／2
  MetaGPT **下调**／3 上下文工程 5 OpenAI PDF 6 langgraph-swarm 7 GPTSwarm+MacNet
  **升级**／8 ChatDev 双结论。三条压下游者——**OrgAgent 不研究矩阵**（§3.1 限定
  "we focus on two common forms … **flat organization and a hierarchical
  organization**"；「matrix」全文仅 1 次在 §2 文献罗列句）⇒ **03 号票「值守线／
  项目线共享同一批实例」仍属 `[推理]`**，可局部升级的只是「同一池不同时段配成不同
  单线结构」；**MAST 占比是正文文字**（FM-1.3 15.7% 为最大项、无一项超 16%；三类
  合计 44.2/32.35/23.5% 属 `[推理]` 计算）且**图号更正＝占比图是 Figure 1**（v3 的
  Figure 2 是方法学流程）＋§5.3 "challenges in **organizational design and agent
  coordination**" 句直供 04/05；**MetaGPT 的按岗配档句与 $2.0→$0.2 无一手支撑**（v7
  全文唯一美元数字＝Avg. `$1.12`）⇒ 该两事实应删、按岗配档改挂 Anthropic＋OpenAI
  PDF p8。版本漂移：MAST v3、MetaGPT v7、ChatDev v5 等—全文
  research/org-patterns-supplement.md
- [补充调研：恒久原则报告盲区 1–8](issues/15-supplement-enduring-principles.md): 方向：
  盲区 1 提示词基线 3 Swarm 4 memory tool 5 Letta 7 时效面 **升级**／2 MAST **维持
  ＋一处下调**／6 记忆附录 **维持（原怀疑成立、正面结案）**／8 hidden predicate
  **维持弃用**。三处头部——**「empowerment vs control」查无此表述**（platform 全站
  34.6 MB 语料 `empower` 命中 0、code.claude.com 0、2026 博客 0；官方最接近句是相反
  方向的「别过度约束角色」）⇒ 不引入规格；**对象文档已改名**《Prompting best
  practices》（`claude-4-best-practices` 308）；**D3 拿到更强一手依据**（"Refactor
  existing prompts and skills … often too prescriptive"／"remove these instructions
  rather than rewriting them"／"dial back any aggressive language"），**真退役的是
  prefill 与 `budget_tokens`**，XML 标签与多示例只是降级保留（否定式指令口径＝讲清
  为什么）。**「信念分叉」不属 MAST**（v3 `belief`/`diverg` 命中 0/0；FC2 机制是
  theory-of-mind collapse，该词归 Cognition）、「框架不如单 agent」是**转引**
  （Agentless／AI Agents That Matter）非 MAST 自证，且 MAST 明说**协议类对策不足
  解决 FC2**（05 号票「多数可由协议预防」须收窄到 FC1/FC3）；**mem0 记忆架构＝跨厂商
  混淆**（Anthropic 多 agent 文全文只 2 处 `memory`、无附录无 mem0）⇒ 10 号票三层
  记忆不得写成 Anthropic 做法；时效面新事实＝A2A **1.0.0**、MCP registry **in
  preview**（治理 LF Projects, LLC）、agents.md 归 Agentic AI Foundation—全文
  research/enduring-principles-supplement.md

## Not yet specified

<!-- 空——2026-09-16 网络可用声明后，原「补充调研轮」雾条毕业为 14/15/16 三票：
     14/15（research）已闭，**frontier＝16「研究报告定稿与暂定标注升降级」**（唯一
     未闭票，由 14/15 解除阻塞）。13 号票决议时记的「全图末票／frontier 收空」指当时
     13 张全闭；该注记所悬置的补充调研轮即本轮，故本图在雾区毕业后再开三票，不属图
     的重绘。本轮无新雾（补充调研未暴露新的未指定面——其发现全部落在 16 的裁定域内）。 -->

（空）

## Out of scope

- 阶段 3（存储统一/模块拆分）与阶段 4（可观测/执行隔离）基建债——留既有
  轨道（Q2 裁定①）。
- 具体模型选型与 token 预算数值——用户裁定域。
- 8 文件部署批执行——既有 deploy-b3-session-driver 票（**已于 2026-09-08
  整批收口**，与 12 号票决议的交错随之消解；v2 切换部署另起一批、同受
  AGENTS.md §2 逐项点名约束）。
- UI polish——对比报告 §11.3 口径维持。
