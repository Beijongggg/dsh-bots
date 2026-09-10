# CONTEXT.md —— 领域词汇表

> 惰性创建约定（docs/agents/domain.md）：本文件只收**已定形**的领域词，一事一词，
> 不追写全领域。首个词条来自 2026-09-07 session-driver 批（架构评审候选 1，
> grilling 定形）。项目总览见 docs/PROJECT_UNDERSTANDING.md（第一阅读面不变）。

## 会话回合（agent turn）

一条 prompt 从提交（session.prompt）到该回合的 `turn/end` 事件被观测、assistant
文本被提取的完整周期。是普通数据面（邮件协作）与评审数据面（reviewer 执行）共同
的最小执行单元；两平面的差异只在**政策**（会话复用方式、监督强度），协议本身同构。

## session driver

DSH 会话回合**协议的单一归属模块**（`lib/session-driver.js`）：create →（条件）
selectModel → prompt → 轮询 history → 提取 assistant 文本。interface 为
`createSessionDriver({rpc, sleep, now}) → runPrompt(opts) → {text, sessionId}`；
监督策略（连续超时计数／deadline＋heartbeat 三重约束）由调用方以 rpc adapter
形式注入，session 政策（持久落盘 vs 一次性）留调用方。两个在盘 adapter：
runNativeAgentTurn（普通回合）、buildReviewRunner（评审回合）。

## turn baseline

prompt 提交前既有 `turn/end` 事件的最大回合号。回合提取**只认 baseline 之后的新
回合**——防止持久 session 中旧回合的 assistant 消息污染本次提取。fresh session
的 baseline 由构造为 0（评审一次性会话可声明跳过 pre-prompt history）。

## 监督 adapter（supervision adapter）

包在 rpc 之上、为回合提供失败监督的策略层：普通平面＝连续超时计数（达
RPC_MAX_TIMEOUTS 抛错）；评审平面＝总 deadline＋单次 RPC 超时＋heartbeat 竞速
（F-RV-18 三重约束）。监督语义住在 adapter 而 protocol 住在 session driver——
两者正交，接口经 checkAlive 钩子与竞速 sleep 衔接。

## 代际绑定（pid generation binding）

注册表判定"pid 仍是当初 spawn 的那个进程"的依据：spawn 时把 `/proc/<pid>/stat`
第 22 字段（starttime，时钟滴答）记为 `pidStartTicks`，判活/停止/遗留清理在
signal-0 存在性之外校验该值仍相等——host 重启或 pid 被系统复用后不等，按陈旧
处理。归属模块 `lib/pid-bind.js`；三态语义：旧记录无绑定字段或读取失败退化为
仅存在性判定（零迁移），不等＝复用。cmdline 归属检查（pidMatchesBot）保留为
第二道防线。

## 组织形式（organizational form）

岗位、协作协议与工件构成的一层结构，其设计不以任何具体模型组合为前提。
模型组合是运行时的旋钮：可高智配判断、低智配吞吐以省钱，也可全顶配以进
一步增效——形式不变。组织形式是**能力放大器**而不只是成本分摊器：经
任务分解、岗位互检、流程脚手架与工件外置，低配组合应能完成裸模型完不
成的任务；这是形式价值的验收面之一。模型更迭时的改动落在岗位细节
（提示词、工具配置），不推倒形式。

## 模型指派（model assignment）

哪个岗位用哪个 LLM 的运行时配置决定，属用户裁定域：外接多来源 LLM，由
用户拍定各岗位用何模型（如让便宜模型做最简工作——接受完成票据类）。架
构义务＝岗位与模型解耦、指派可配置可更换，不在架构内硬编码任何「岗位＝
模型」的绑定。

## 逃生阀（env allowlist escape hatch）

spawn env 白名单（`lib/spawn-env.js`）的显式放行通道：宿主设置
`DSH_BOTS_ENV_EXTRA`（逗号分隔变量名）把基集与 DSH 显式集之外的变量附加进
bot 子进程环境，缺名安全忽略。附加名同受 KEY/TOKEN/SECRET/PASSWORD 形态与
NODE_OPTIONS 的绝对拒绝约束——逃生阀不解锁凭据形态。命名与
`DSH_BOTS_AUTORESTART` 开关族一致；运维用例＝放行 http_proxy/https_proxy/
no_proxy（dsh 引用 NO_PROXY，代理变量不在基集）。

## 岗位（role class）与岗位实例（role instance）

岗位＝一类职能的**契约单位**：职责、触发条件、移交契约、档位建议（用户域）
的集合。岗位实例（席位）是其运行时载体，今天＝注册表里的一个 bot 进程。编制
不是岗位：实例数按需增减，一个实例有一个 home 岗位、可被项目线短期借用；
模型指派挂在实例上——「岗位-模型解耦」由此成立（org-v2 03 号票 Q1 裁定）。

## 值守线／项目线（duty line / project line）

同一批 bot 实例的两条组织线：值守线＝常态值守职责（常驻可用，接单/分诊/
维持组织常量）；项目线＝目标态临时编组（按需拉起、结算后解散）。「谁此刻
归属哪条线」必须显式，冲突按「单一时刻单一任务归属＋上抛用户」处理（03 号
票 Q3 裁定）。两条线共享实例这一映射属推理（矩阵模式直接文献缺失），标注
**待补充轮复核**。

## 判断上浮（judgment escalation）

确定性组件判不了时才把动作交给 LLM 岗位，且每次上浮必须可归因（为什么确定性
判不了）。值守动作默认走确定性路径（触发/分流/状态机），LLM 岗只在语义判断
场景出场——「常态值守岗」因此首先是常驻**职责**，不是常驻推理（03 号票 Q2
裁定）。

## 独立复核（independent verification）

验证是每个产出岗位的义务（配可执行检查）；关键产出的独立复核以 **fresh-context
实例**按需召集，只看 diff＋判据、只报 gaps 不报 style。复核是契约关系而非
编制：v2 不设常驻评审岗（03 号票 Q5 裁定）。

## 岗位卡（role card）

岗位契约的固定文本形状（八字段）：一句话职责／触发条件／输入输出契约／边界
（不做什么）／存在理由（哪个终景需求）／**放大机制**（分解·互检·外置·并行）／
模型档位（用户域，留空）／**依赖面·更迭敏感性**（本岗依赖哪些会被宿主更新
代换的内部面，必须经可替换适配层）。放大机制为必填：填不出＝只摊成本，不设
该岗（03 号票 Q6 裁定，对应「组织形式＝能力放大器」；第 8 字段为同票 Q3 裁定
的宿主面更迭义务）。
