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

## Not yet specified

- 补充调研轮（网络可用后：按各报告盲区清单重查一手来源、暂定结论升降
  级、撤「待补充轮复核」标注）——等用户声明网络可用＋本轮 research
  盲区清单落地。
- 最小起步编制与 bootstrap（v2 落地先建几个实例、谁生成、如何验证就绪）——
  06 已定权限面（岗位 op-set／运维归人间面）、07 已定工具装载形态（cordis
  tools＋岗位卡派生）；剩余问题可与 12 号票迁移重建顺序合流判。
- 与基建债（阶段 3/4）的合流指针挂法——岗位已定（03）、生命周期已定（05），
  等判据定（08）。

## Out of scope

- 阶段 3（存储统一/模块拆分）与阶段 4（可观测/执行隔离）基建债——留既有
  轨道（Q2 裁定①）。
- 具体模型选型与 token 预算数值——用户裁定域。
- 8 文件部署批执行——既有 deploy-b3-session-driver 票，仅时间上与本图交错。
- UI polish——对比报告 §11.3 口径维持。
