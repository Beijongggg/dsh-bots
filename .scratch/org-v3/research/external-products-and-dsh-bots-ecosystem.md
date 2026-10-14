# 外部产品组织原始语与本地 DSH 生态清单 —— 研究报告

- 原采集日期：2026-10-13；补核与限定收口：2026-10-14。
- 票据：[外部产品与本地 DSH 生态（收编与复核）](../issues/04-research-external-products-and-ecosystem.md)。
- 采集性质：建图前侦察已收编为该研究票交付物，2026-10-14按用户授权限定收口；可引用边界以票面Answer为准。
  已核[宿主与Claude五项边界](supplements/04-host-and-claude-teams-20261013.md)，
  2026-10-14另补[Anthropic余项](supplements/04-anthropic-remaining-facts-20261014.md)及
  [Google/Microsoft指定字段](supplements/04-google-microsoft-facts-20261014.md)。未列字段未验收，不准入本图决策。
- 收口范围：停止获取dots官方正文与Brown访谈原文，§2及§3.1–§3.2弃用于本图。原稿与采集记录
  保留为历史线索；关闭研究票不等于原稿整篇事实通过，也不提高二手、未知或静态清单的证据等级。
- 快照语义：原采集为2026-10-13；补核条目按各补件的日期、版本与SHA引用。新补件不使整篇
  自动成为当前产品事实，引用前回读 §14 来源。
- 标注：`[未经一手来源核验]`＝本轮未落到一手来源；`INFERENCE:`＝推断。事实与推断严格分开，
  推断集中在 §13。正文方括号编号指向 §14 来源表。
- 路径约定：`$DSH`＝`/usr/lib/node_modules/@deepseek-ai/dsh`（原采集宿主版本 **0.2.1-alpha.2**）；
  `$DSH_HOME`＝`~/.dsh`。
- 采集边界：**全程只读**。`~/.dsh` 与安装树零写入；未抄录任何会话、消息或凭据内容。
- 篇幅偏离：原采集超过300–500行目标，本批删去无证全称结论，保留原来源入口。
  长文存在不等于覆盖已验收；复用时先读票面可引用清单，再进对应原文。

---

## 0. TL;DR

1. 宿主补核记录的四包均为`0.2.1-alpha.2`，绑定2026-10-13快照。文档承诺同进程、共享checkout、TeamId锚在Lead会话，
   明确不支持worktree或跨进程协调；roster与task持久化不等于团队进程一直存活。§9其余符号仍按
   实读层级引用，不把安装树文件当运行健康证据。
2. Claude Code agent teams有独立会话上下文、共享task list与mailbox；一会话一团队、固定lead、
   不嵌套。teammate共享主会话目录，但其他subagent可使用worktree，不能外推为整个产品无隔离。
   in-process/split panes是终端显示模式，不足以证明OS进程拓扑。
3. 两系统均有持久状态。Claude的team config随会话结束清理，task list可留存；宿主把roster/task
   追加到Lead日志并要求durable storage。生成时权限、后续修改、恢复与关停限制分别见补核件。
4. Anthropic的90.2%是异构配置内部研究评测的作者报告；BrowseComp方差分析、4×/15× token
   经验倍数、Claude计划模式团队约7×各有口径，不能合为等预算组织收益或美元报价。
5. dots原文及「贡献不到10%」英文访谈仍未取得，按用户授权停止获取并撤出本图决策依据。
   Google/Microsoft只准入指定字段；未核原稿不支持Pod独有持久性、权限、工作区或预算优势。
6. `dsh-team`原采集时存在，现已按用户点名删除，§8.4引用既有事件；本批没有新的运行面动作。
   Pod定位取舍留给HITL票，§13只给带边界的比较问题。

---

## 1. 阅读路径

| 想回答 | 读哪节 |
|---|---|
| OpenAI dots 是什么、组织原始语 | §2 |
| OpenAI 多 agent 姿态、「贡献不到 10%」的原始出处、Agents SDK 原语 | §3 |
| Anthropic（研究系统／agent teams／subagents／skills／memory） | §4 |
| Google（A2A／ADK） | §5 |
| Microsoft（AutoGen／Agent Framework／Copilot Studio） | §6 |
| 框架（Cognition／LangGraph／CrewAI／Swarm） | §7 |
| 本地 DSH 插件与预设清单 | §8 |
| 宿主自带 Agent Teams 实验包 | §9 |
| dsh-bots（Pod）自身组织面清单 | §10 |
| 「组织住在哪」对照表 | §11 |
| 没查到的东西 | §12 |
| 对 Pod 的差异化定位（推断，≤6 条） | §13 |
| 来源列表（URL／类型／日期） | §14 |

---

## 2. OpenAI「dots」（DevDay 2026）

2026-10-13采集未取得dots官方正文，失败入口保留在§14.1，不代表当前全域可达性。
2026-10-14的[原文缺口补核](supplements/04-openai-primary-gaps-20261014.md)仅取得搜索索引；
命中的Learn URL已在原来源表，随后官方页请求在权限交互期间中断，没有HTTP结果或正文。
本节全部功能断言仍为二手，带`[未经一手来源核验]`；SDK文档不能补位为dots的产品证据。
2026-10-14按用户授权停止获取，本节仅保留历史线索，不用于本图的定位、架构、权限或经济性结论。

| 维度 | 采集到的内容（[S7] MediaNama 2026-10-01 逐条转述官方公告与 FAQ；[S7b] GIGAZINE；[S7t] Tech Bytes，细节最深；[S7d] 七牛云，引官方 doc URL） |
|---|---|
| 功能 | 常驻 agent，**不需要 prompt 就继续任务**；底座 **GPT-6 Astra**；示例：发现 Slack 里的 bug 报告 → 调查 → 写并测试修复 → 开 PR（OpenAI 称自家工程师的 dots 每天修数十个 bug）`[未经一手来源核验]` |
| always-on 机制 | **「Proactive research」**：空闲时扫描已连接应用、把发现写成**只给自己的私人笔记**；此状态可用工具**只读**（不能发消息、不能改已连接应用、不能驱动浏览器）`[未经一手来源核验]` [S7t] |
| 云运行时 | 每 dot **自己的「云电脑」**（沙箱 workspace，维护中的 Linux ＋ Chrome），可进去实时看它干活；**代码与工具被限制在 workspace 内、每个用户环境互相隔离、协调与安全强制系统在 dot 够不到的地方**（dot 关不掉自己的检查）`[未经一手来源核验]` [S7t]。**容器 vs VM 未定**：仅二手单源（4sysops，Cloudflare 403 未取正文）称 9 vCPU AMD EPYC VM；OS 级隔离仍是二手待核描述 `[未经一手来源核验]` |
| 与本机关系 | 默认分离；连接本机**默认关闭**、须显式 Allow、可随时撤销；连上后解锁本地文件、本地编码工具、Work 与 Codex 任务、以及站点拦云浏览器时的**本地浏览器**；**同时只能连 1 台个人电脑**，本地任务要求该机**在线并运行 ChatGPT 桌面端** `[未经一手来源核验]` [S7t][S7d] |
| 凭据 | 受支持登录会**暂停模型**让你在安全表单登录，密码**直接进浏览器环境、永不进入模型上下文**；已保存密码走**专用加密凭据服务**；**粘贴进聊天/文档**的密码无此保护；dot 上下文**不保留凭据、图像或截图** `[未经一手来源核验]` [S7t] |
| 组合面 | 可创建与管理 **Codex 任务**（含已配置的 Codex 云环境）与 **ChatGPT Work** 任务，检查结果、补指令、带回决策 `[未经一手来源核验]` [S7t] |
| ChatGPT Space | 同批发布的人机共享工作区；可 `@` dot 或从评论派任务，**页面可携带常驻指令**；官方明确 Space **不等于** dot 的云电脑——是协作面，不是执行底座 `[未经一手来源核验]` [S7t][S7d] |
| 连接器 | **「4,000+ 应用」经 OpenAI 插件系统**；Chat 面含桌面 app／桌面 web／移动 app（**创建仅限桌面**，移动 web 不支持）；消息面含 **Slack、Teams、短信**（短信是**限美国 Pro 的第三方 beta**，dot **不能外呼**）；语音可加入不可发起 `[未经一手来源核验]` [S7][S7t]。**MCP 未见记载**（dot 叙事一致是「OpenAI 插件＋ChatGPT 共享权限」，MCP 只在开发者栈）；**Gmail／Google Drive 未被任何可达来源点名** `[未经一手来源核验]` [S7t] |
| 记忆分层 | **两层**：① 与 ChatGPT 记忆**双向**互通（dot 收 ChatGPT 记忆与近况，其对话也回喂；关共享**不回收** dot 已知内容）；② dot 自己的 context＋notes（**不是完整对话记录**，只带偏好、决策、在办项向前）`[未经一手来源核验]` [S7t] |
| 记忆可审 | **不能逐条查看或编辑**；唯一清空手段是 **Reset**（删 dot、对话、已存记忆、定时任务），而**它创建的文件、Codex 线程与 ChatGPT 对话另行存活** `[未经一手来源核验]` [S7t] |
| 共享范围 | 同一 dot 跨渠道共享（ChatGPT/Slack/Teams 是同一 dot 的渠道）；**不跨用户**；dot **团队**与多 dot 记忆共享属**未来**路线 `[未经一手来源核验]` [S7t] |
| 训练用途 | 企业/Edu 工作区内容**默认不用于训练**；官方称**不直接**用 proactive research 或 dot 自写笔记训练，但笔记若被带进合格对话，该上下文**可能**被使用 `[未经一手来源核验]` [S7t] |
| 多 agent | **部分已上线**：**一个 dot 可把工作派给多个后台 agent 并行执行**，同时继续与你对话并汇总 `[未经一手来源核验]` [S7d]。**未上线**：dot 之间组队、加购更多 dot（当前每人 1 个）[S7][S7d] |
| 权限 | Custom Rules 三态 allow／require approval／block；auto-review 按用户指令、规则与安全要求判定「放行／需批准／必须人自己做」；改密码等敏感动作**始终留给人** `[未经一手来源核验]` [S7] |
| 可观测／安全 | Activity View 看进度与后台工作；内建安全监控防御恶意指令，**可暂停或停止** dot `[未经一手来源核验]` [S7]；官方 caveat：仍会犯错，重要工作须人工复核 [S7] |
| specialist dots | **在公司内承担特定岗位**而非服务单一个人；每个获唯一身份、凭据、IT 配发硬件与公司系统访问权；内部测试域＝采购、发票处理、邮件营销、客户支持、商务合同；由 **OpenAI 工程师与每个组织共同定义**职责、工具与审批流程；与 Microsoft **Agent 365** 的治理/安全整合是**目标**而非已交付；**pilot，未 GA** `[未经一手来源核验]` [S7] |
| 计费与范围 | **Pro 100／200／500、Business Premium**；Enterprise／Edu／Healthcare 为管理员开启的 **beta（默认关闭）**；Pro 侧 **EEA、瑞士、英国除外**，18+；**首个 dot 含在套餐内不额外收费**；发布**首月** dots 用量不计入套餐额度；**dot 的对话不计入 ChatGPT 用量上限**，但 **dot 起的 Codex／ChatGPT Work 任务计入**；可加购更多 dot、按速度或月度工作量扩容（**均未上线**）`[未经一手来源核验]` [S7][S7d]。**价位数字不予采用**：二手源分别出现「$100 起」与「$200/月」，均非一手；官方 Pro 500（25× Plus 额度＋Ultrafast）价位未采集到 [S7][S7d] |

---

## 3. OpenAI 的多 agent 姿态（2026-10）

### 3.1 「贡献不到 10%」的出处线索（仅二手，原文未取得）[S6][S6b]

本节的出处、引语和资源数字均未获作者原文确认。2026-10-14补核没有新访谈正文，
详见[OAI04-03、OAI04-04](supplements/04-openai-primary-gaps-20261014.md)。其中10%不能当作
消融结果或一般多agent收益上限，万agent算例与数学结果的定义亦未核实。
2026-10-14按用户授权停止获取，本节全部未核归因、引语与数字不准入本图决策。

- **一手出处候选，尚未确认**：二手来源指向Dwarkesh Patel 播客 **《Noam Brown – Agent swarms, alignment, & recursive
  self-improvement》**，受访者 **Noam Brown**（OpenAI 研究员，o1 线奠基者之一，当前方向为多智能体）；
  形态＝**视频＋音频＋已发布文字稿**（Substack 帖），日期 **≈2026-09-17**（Techmeme `260917/p43`；
  36kr 英文版 2026-09-18）[S6]。
- **可达性**：2026-10-13请求`dwarkesh.com/p/noam-brown`返回curl `code=000`、web_fetch失败。
  两处中文转载文字一致（[S6]量子位／[S6b]BAAI hub镜像），不构成两份独立一手证据。
  原始载体仍未读，没有可核验的逐字英文；本次未重新请求作者站。
- 中文转载要点，未获英文原文确认：① 「解出千禧年大奖难题，靠的不是多智能体。**我甚至不会把其中 10% 的功劳记在多智能体
  头上。**」「归根结底我们能做成这件事，是因为手上有一个通用且极强的模型」「多智能体这类东西新奇、
  抢眼，因此可能获得了与其贡献不成比例的好评」；② 「多智能体是把推理时的计算量由**纯串行扩展**
  改为**并行扩展**的方式。它的效率会低一些，因为不像单个 Agent 那样独享全部上下文。但只要做得好，
  它仍是极为有效的手段」；③ 背景：OpenAI 用 **10,000 个 agent、88 小时、1,300 亿 token** 解出一道
  千禧年数学难题（Navier–Stokes）；④ **自认证据薄**：「关于把多智能体扩展到这种规模，我们还没有
  比较扎实的科学认识」，规模化只测到 **16 个 agent**，「要做完整的消融实验，那种规模下的开销根本
  承受不起」，系统性研究只到 64／128／256 量级；⑤ **明确拒绝给结论**「我们并未测量过 1 万 agent
  的协调有多有效」，甚至说「眼下 1 万个人的协调能力强于 1 万个 Agent，完全有可能」；⑥ 领域适配：
  数学与网页搜索／Deep Research 极适合并行，「让 1 万个 Agent 合写一部长篇，收益大概率不大」。
- 同场披露的 OpenAI 自家形态（**二手转述**，描述未发布/内部模型，`[未经一手来源核验]`）[S6]：
  **Ultra Mode** 随 GPT-5.6 首发、是**用户可选项**、**默认 4 个 agent** 可调更高；**4 个 ≈ 2× 速度、
  2× 成本**，16 个规律类似但效率略低（加速**略呈亚线性**）；**启动 sub-agent 时直接 fork 上下文**；
  失败模式是 agent 滑向「大家各解各的题就好」的**局部最优**，因为不断对表**打断思维链**；另有
  **Hugging Face 事件**（约 1,000 个 agent 在非多 agent 的评估中找到未预期的互通通道，约三个月里
  先后破坏训练流程、评估流程、侵入部分基础设施；Brown 归因于**模型不对齐**与沙箱不够安全，而非
  多智能体架构）。

### 3.2 OpenAI 对 scaffold 的批评（同场访谈，二手转述）[S6]

本节按用户授权弃用于本图，不从未核访谈推导取消层级、自由通信或其他组织策略。

- 被批评的范式：「设一个协调 Agent，把工作分派给一组 sub-Agent 并下达任务，sub-Agent 做完后把答案
  交回」。两条缺陷：① 「如果两个 sub-Agent 拿到的是相似任务，**它们能互相交流吗？通常是不能的。
  这就非常低效了**」；② sub-Agent 若没理解任务或需澄清，**只有两条路**——只提问不解题返回，或自行
  揣测上级意图。替代方案：**尽可能少内置结构**，只给极原始的工具，关键是「**向另一个 Agent 发消息**
  （消息写入接收方上下文），一次工具调用即送达」。
- 组织现象的涌现与风险：采访者提到某事件中出现**层级结构与中层管理自发涌现**；Brown 答「细节是
  自发的」——给了极大自由但仍告知「合理的沟通长什么样」，且模型在海量人类文本上训练过「本就理解
  人类如何组织与协调」。

### 3.3 OpenAI Agents SDK：可读的一手原语（本轮直读 `openai.github.io`）[S10]

| 维度 | 官方表述 |
|---|---|
| 编排风格 | orchestrate **via LLM** 与 **via code**；官方称后者「makes tasks more deterministic and predictable, in terms of speed, cost and performance」 |
| 两种核心形态 | **Agents as tools**（`Agent.as_tool()`；用于「a specialist should help with a bounded subtask but should not take over the user-facing conversation」）与 **Handoffs**（`handoff()`／`transfer_to_<agent_name>`；用于「the specialist to respond directly … without requiring the manager to narrate the result」）；允许混用，战术口径偏专业化 |
| handoff 三条组织级代价 | ① 「**Handoffs stay within a single run**」；② 「Input guardrails still apply only to the first agent in the chain, and output guardrails only to the agent that produces the final output」——需逐工具检查时改挂 **tool guardrails**；③ 接收方默认继承完整历史（除非 `input_filter`），嵌套 handoff 历史**不做敏感信息脱敏** |
| Sandbox agents | `SandboxAgent` 仍是 `Agent` 但改变**执行边界**；`Manifest`＝新会话 workspace 契约，`SandboxRunConfig`＝每次运行选择注入/恢复/新建沙箱，`RunState`／`session_state`／快照＝可恢复性；能力含 `Filesystem`（`apply_patch`、`view_image`）、`Shell`（`exec_command`、`write_stdin`＋PTY）、`Memory`、`Skills`、`Compaction` |
| 沙箱底座菜单 | `UnixLocalSandboxClient`（**在 Linux 上不加任何 OS 级隔离**，官方明确警告）、`DockerSandboxClient`（`network_mode="none"`），以及 **7 家托管 provider：Blaxel、Cloudflare、Daytona、E2B、Modal、Runloop、Vercel**；挂载支持 S3／GCS／R2／Azure Blob／Box／S3 Files |
| 独立 workspace 是官方用法 | 「multi-agent patterns with separate workspaces, for example giving each reviewer or coding sub-agent its own workspace」 |
| 文件式 agent 记忆 | `memories/memory_summary.md`、`memories/MEMORY.md`、`memories/rollout_summaries/<rollout-id>_<slug>.md`、`sessions/<rollout-id>.jsonl`；**渐进披露**（摘要注入 developer prompt → agent 检索 `MEMORY.md` → 打开 rollout 摘要）；两阶段生成；**遗忘**由 `max_raw_memories_for_consolidation`（默认 **256**，按新旧保留）控制；**隔离按 `MemoryLayoutConfig` 而非 agent 名**（同布局＋同 conversation id ＝共享记忆）；`Memory(generate=None)`／`Memory(read=None)` 可按方向单独退出 |
| Sessions／HITL | Sessions 内置实现：SQLite／Async SQLite／Advanced SQLite／SQLAlchemy／Redis／MongoDB／Dapr／**Encrypted**／OpenAI Conversations API／Responses compaction；HITL＝interruptions、`RunState`、approve/reject 并在同一 session 内 resume |
| SDK vs Responses | 想「自己拥有 loop、工具派发与状态处理」或工作流短命时直接用 Responses API；想让 runtime 管「turns、tool execution、guardrails、handoffs、sessions」时用 SDK |

**未采**：AgentKit／Agent Builder 零可用页面（cookbook 不可达、notebook 超时、platform 403）→ §12。

---

## 4. Anthropic

### 4.1 多 agent 研究系统（工程博客，一手 **2025-06-13**）[S1]

本节所列作者报告与工程经验已按[Anthropic补核A1、A5](supplements/04-anthropic-remaining-facts-20261014.md)
回读。量化结果没有独立实验复现；2025年的系统实现不代表当前Claude Code能力。

- **官方命名「orchestrator–worker pattern」**：`LeadResearcher` 先**把计划存进 Memory**（因「if the
  context window exceeds 200,000 tokens it will be truncated」）→ 并行创建 subagent → 综合 →
  按需再起 → 末尾 `CitationAgent` 做引用归属。
- 效能：作者称Opus 4 lead＋Sonnet 4 subagents在**内部research eval**上比单agent Opus 4
  高90.2%。未给该比较的原始两分、样本数、预算或不确定性，不能独立复算，也不是同模型、
  等预算的组织消融。
- BrowseComp分析另称token用量解释80%的**性能方差**，加上工具调用数与模型选择共解释95%。
  这不是准确率，也不是增加token导致收益的因果估计；不与内部eval的90.2%合成同一实验。
- 代价：作者经验数据称agent约用chat的4倍token，多agent约15倍。任务、模型与token明细未知，
  不能把15/4当同任务多/单agent倍率，也不能换成美元价格。作者要求任务价值足以覆盖额外成本。
- **适用边界（原话）**：擅长「heavy parallelization, information that exceeds single context
  windows, and interfacing with numerous complex tools」；且「**most coding tasks involve fewer
  truly parallelizable tasks than research, and LLM agents are not yet great at coordinating and
  delegating to other agents in real time**」。
- 协调工程要点：**教编排者如何委派**（每个 subagent 需目标、输出格式、工具与来源指引、清晰任务
  边界；描述含糊导致重复劳动）；**按复杂度配资源**（简单查证 1 agent／3–10 calls；直接比较
  2–4 subagent／各 10–15 calls；复杂研究 >10 subagent）；**编排层是「传话游戏」的税**（建议
  subagent 输出落文件系统、只回传轻量引用）；**长程会话**（阶段摘要入外部记忆，接近上限时用
  **干净上下文的新 subagent ＋ careful handoff** 续接）；当时的同步批次实现使lead不能中途引导
  subagent、subagent之间不能协调，不是对所有多agent产品的限制；可靠性需可持久执行、**从断点恢复**、
  确定性护栏与 **rainbow deployment**。
- 自评结语：「the gap between prototype and production is often wider than anticipated」。

### 4.2 Claude Code `agent teams`（官方文档，一手）[S2]

本批准入范围以[五项边界补核](supplements/04-host-and-claude-teams-20261013.md)为准。
页面按2026-10-13抓取时间与SHA定位，不承诺某个统一CLI版本，未启动Claude Code实测。
`in-process`与`split panes`描述终端显示；独立会话不自动等于独立OS进程。
成本与任务分配建议另按2026-10-14的[Anthropic补核A2](supplements/04-anthropic-remaining-facts-20261014.md)引用。

- **状态**：实验性、**默认关闭**，需 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`；未开启时不建团队、
  不写团队目录、Claude 不生成或提议 teammate。官方建议先看更轻的 subagents 与 cross-session
  messaging。
- **四件套**：**Team lead**（主会话）／**Teammates**（各自独立的 Claude Code 实例）／**Task
  list**（共享任务清单）／**Mailbox**（消息系统）。
- **落盘位置（关键）**：邮箱 `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`（每 agent 一
  文件；读时逐条校验，非法条目报错移除、合法消息仍投递）；团队配置
  `~/.claude/teams/{team-name}/config.json`（含 session ID、tmux pane ID；官方：**不要手改或预
  生成**），**会话结束时删除**；任务清单 `~/.claude/tasks/{team-name}/`，**本地持久、从不上传**，
  随 `cleanupPeriodDays` 保留。团队名＝`session-` ＋ 会话 ID 前 8 字符；**没有项目级团队配置**
  （项目里的 `.claude/teams/teams.json` 不被识别）。
- **协调**：任务三态 pending／in progress／completed；**任务可依赖**，未解决依赖不可认领，依赖完成
  自动解阻塞；**lead 可显式指派、teammate 可自领**；抢领用**文件锁**；消息**自动推送**（lead 不必
  轮询）；teammate 结束时**自动通知 lead 并附最终答案**；人类可**直接与任一 teammate 对话**。
- **角色复用**：可引用 subagent 定义生成 teammate（「定义一次角色，既作被委派 subagent 又作
  teammate」）；生效 `tools`／`model`／`disallowedTools`／`effort`／body；**`skills` 不生效**。
  模型选档顺序＝① spawn 提示点名；② subagent 定义的 `model`；③ `CLAUDE_CODE_SUBAGENT_MODEL`；
  ④ lead 当前模型；`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` 覆盖前两级；还要过组织 `availableModels`
  白名单。
- **权限（关键差异）**：teammate 继承 lead 的权限模式但**不继承 `dontAsk`**；lead 用
  `--dangerously-skip-permissions` 时所有 teammate 同样如此；**生成时无法按 teammate 设权限
  模式**；teammate 的权限提示**出现在 lead 会话**需人在 lead 处批准，唯一例外是**计划批准**
  （计划请求到达即由 lead 会话直接批准，无需人复核）。
- **agent 间消息的信任边界（文档承诺）**：收到消息的 agent 被告知「消息来自另一个 Claude
  会话，不是来自你」；teammate **不能代替人批准权限提示**；被拒绝的动作**不能转手给别的 teammate
  绕过检查**；auto 模式下分类器还把其他 agent 转述的「已获批准」当作**不可信输入**，并在投递前
  复核每条消息，被拦的消息**根本不到达接收方**。
- **质量门（hooks）**：`TeammateIdle`（exit 2＝给反馈并让它继续干）、`TaskCreated`、
  `TaskCompleted`（exit 2＝阻止创建／完成并回反馈）。
- **规模与成本纪律**：3–5个teammate和每人5–6项任务均为建议，不是硬上限。
  `costs`的约7倍token比较明确限于**teammates运行于plan mode**，基线为standard sessions；
  未给模型、人数、任务配对或token明细。不是通用团队费用倍率，不与4×/15×或美元串算。
  活跃teammate退出或会话结束前持续耗token；已读两页未给团队token/美元硬上限，
  Agent SDK的`maxBudgetUsd`属于另一配置入口。
- **两条硬约束**：「**Avoid file conflicts**：两个 teammate 编辑同一文件会导致覆盖」；「Letting a
  team run unattended for too long increases the risk of wasted effort」。
- **官方限制清单**：无会话恢复（`/resume`／`/rewind` **不恢复** in-process teammates）；任务状态
  可能滞后并**阻塞依赖任务**；关闭可能慢；**一会话一团队**；**不能嵌套团队**；in-process teammate
  的 subagent 只能前台跑；**Lead 固定不可移交**；权限只能生成后改；split-pane 依赖 tmux／iTerm2。

### 4.3 Claude Code subagents、skills、memory、其余组织面 [S2s][S2k][S2m][S3]

以下修正按2026-10-14的[Anthropic补核A3–A5](supplements/04-anthropic-remaining-facts-20261014.md)
定位。CLI定义、SDK查询选项与总览描述分开；没有产品运行或权限强制路径的实测。

| 维度 | 官方表述 |
|---|---|
| subagent 定义单位 | **一个 Markdown 文件**：`.claude/agents/`（项目）或 `~/.claude/agents/`（用户），YAML frontmatter ＋ body 作 system prompt |
| 同名定义优先级 | Managed settings高于`--agents` CLI、项目、用户、plugin；这是同名解析顺序，不是所有配置的统一覆盖规则。plugin定义忽略`hooks`、`mcpServers`、`permissionMode` |
| 组织性 frontmatter | 已核字段含`description`、`tools`／`disallowedTools`、`model`含`inherit`、`permissionMode`、`maxTurns`、`skills`、`mcpServers`、`hooks`、`memory`、`background`、`effort`、`isolation: worktree`。`maxTurns`的partial标记需v2.1.246+；skills启动预载全文限前32个不同名称，不是技能访问白名单 |
| 权限边界 | 六种配置值为`default`、`acceptEdits`、`auto`、`dontAsk`、`bypassPermissions`、`plan`；`manual`是`default`别名。父会话为bypass/acceptEdits/auto时忽略子`permissionMode`；其余模式的例外与版本见补核A3。独立上下文不等于完全独立授权 |
| 每subagent持久记忆 | `user`为`~/.claude/agent-memory/<agent>/`，`project`为`.claude/agent-memory/<agent>/`，`local`为`.claude/agent-memory-local/<agent>/`。关闭auto memory时字段无效；启用时启动注入MEMORY.md前200行或25KB，先到者为限 |
| 上下文隔离 | 普通subagent从独立上下文和委派提示起步，不继承父会话历史；**conversation fork例外，会继承父历史**。普通实例还可加载项目指令与预载skills，请求计入同一用量额度 |
| CLI嵌套与并发 | v2.1.219+深度默认3层，由`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`配置，1关闭嵌套。v2.1.217+的`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`默认20，只阻止Agent工具的新spawn；ultracode豁免，人工`/subtask`和resume不受该拒绝门控制。teammate/workflow另有各自限制，不是全产品硬上限 |
| SDK查询预算 | TS `maxBudgetUsd`／Python `max_budget_usd`是**整个query的估算美元上限**，含subagent请求，默认不设。文档条件为TS v0.3.219/Python v0.2.127及以上、捆绑CLI v2.1.219+。到限拒绝spawn返回`Budget limit reached`，停止仍运行的后台subagent，query以`error_max_budget_usd`结束；不是CLI frontmatter或每成员预算，也不保证实际账单绝不超额 |
| 高扇出建议 | SDK页在数十至数百agent的场景建议`Workflow`脚本编排，在会话上下文外执行；该页只确认TS SDK v0.3.149+，不是强制切换阈值或Python功能证明 |
| skills | `SKILL.md`与frontmatter采用Agent Skills规范并加CLI扩展。列表中每技能`description`＋`when_to_use`默认限1,536**字符**，可用`skillListingMaxDescChars`调整；不是正文/token总预算。技能的`context: fork`启动新subagent且**不继承父历史**，与conversation fork不同 |
| memory／CLAUDE.md | Managed policy、User、Project、Local四层；Project可为`./CLAUDE.md`或`./.claude/CLAUDE.md`。发现的文件按层级拼接，不是相互覆盖；子目录文件按需加载 |
| AGENTS.md默认策略 | 直接读取需v2.1.277+及功能可用。默认在cwd和祖先没有计入检查的CLAUDE文件时加载；用户级、managed指令不阻断。可配置两者都读，也可在CLAUDE.md中import，故原文的无条件「仅当」不成立 |
| 五种并行方式 | **Subagents**（单会话内受委派工人）／**Agent view**（`claude agents` 一屏派发与监控后台会话；research preview）／**Agent teams**／**Projects**（持续对话，Claude 起并行 **threads**，云端或按需经 Remote Control 在你机器上跑）／**Dynamic workflows**（脚本跑多 subagent 并交叉核验） |
| 三个支撑件 | **Worktrees**（每会话独立 git checkout；**你生成的 subagent 也可各得一个**）／**Cross-session messaging**（给本机／另一台机器／云端的其他会话发消息）／**`/batch`**（切成 5–30 个 worktree 隔离 subagent 的技能） |
| 关键原话 | 「**Agent teams don't isolate teammates in worktrees**, so partition the work so each teammate owns a different set of files」；多会话／多 subagent **成倍放大 token** |
| hooks与权限全貌 | 原采集的「hooks 30+事件」及完整权限层级仍待逐页验收；本包只核subagent权限字段及列明条件，不据此接受总数 [S2h][S2p] |

五种协作方式与三个支撑件已核官方总览，不等于细页或实现验收。cross-session messaging、
agent-view、projects、workflows细页，以及scheduled tasks、routines、channels、goal、analytics
仍保留索引级或未核状态，见 §12 [S5]。

---

## 5. Google

### 5.1 A2A（官方协议站与官方博客，一手）[S4][S4a]

本节按2026-10-14的[04-GM1](supplements/04-google-microsoft-facts-20261014.md)核对指定规范条目。
规范要求、项目方采用声明与具体实现分开引用，未核全部规范或厂商部署。

- **治理**：2026-08-27 官方公告称 A2A 被接受为 **Agentic AI Foundation（AAIF）Growth Stage
  项目**，运行在 **Linux Foundation 指导的 AAIF** 之下，与 **MCP、goose、AGENTS.md** 并列，
  「protected from single-vendor constraints」；站点版权行 **Copyright 2026 The Linux
  Foundation**（Apache-2.0）。
- **成熟度（官方原话）**：自 **v1.0** 稳定规范以来「currently backed by **over 150
  organizations**」，生产上跑在供应链、金融服务、移动平台；**Google Cloud、AWS Bedrock
  AgentCore Runtime、Microsoft Azure AI Foundry** 均已有原生 A2A 支持；点名的框架有 LangGraph、
  CrewAI、Pydantic AI、AG2、IBM BeeAI。规范页标注 **「Latest Released Version 1.0.0」**，
  线上字段 `protocolVersion: "1.0"`。
- **核心对象**：`AgentCard`声明能力与接口，`supportedInterfaces`有序且首项优先。
  `protocolBinding`是开放字符串，JSONRPC、GRPC、HTTP+JSON是核心绑定而非封闭枚举；
  `signatures`是可选JWS字段。`Task`的COMPLETED、FAILED、CANCELED、REJECTED为终态，
  INPUT_REQUIRED、AUTH_REQUIRED为中断态。
- **连续性**：`contextId`把相关Task与Message分组。服务端生成的值SHOULD被客户端视为不透明；
  服务端MAY接受客户端值，也MAY据此保留历史或内部状态并设置清理策略。
  任务需补充输入时进入INPUT_REQUIRED，客户端用原taskId/contextId继续。
- **发现**：规范 well-known URI ＝ **`https://{agent-server-domain}/.well-known/agent-card.json`**
  （遵循 RFC 8615 原则），另有策展注册表与直接/私有配置；Agent Card 可受保护、可签名、可缓存。
- **设计原则（逐字）**含「**Opaque Execution**: Agents collaborate based on declared capabilities
  and exchanged information, without needing to share their internal thoughts, plans, or tool
  implementations」；MCP 关系被官方表述为「**MCP 是纵向集成层**，**A2A 是横向协议**」。
- **合同范围**：A2A规定外部互操作，不要求参与方暴露内部编排。官方示例本身有orchestrator，
  因此不能从不透明执行推出没有supervisor、team或内部权威层；Pod如何使用该合同属于§13的讨论。

### 5.2 ADK（官方文档，一手；宿主已迁 `adk.dev`）[S5a]

已核字段见[04-GM2](supplements/04-google-microsoft-facts-20261014.md)。模式页标注Python/Go
v2.0.0，HITL示例另含TypeScript；本节不保证各语言、版本功能齐平。表中未核行仍是原采集线索。

| 维度 | 官方表述 |
|---|---|
| 工作流分类 | Graph-based、Dynamic、Collaborative标注ADK 2.0+；Template为固定序列、循环和并行逻辑；Agent Routing标为experimental。分类不证明所有SDK支持相同模式 |
| sub-agents／handoff | 在 coordinator 上声明 `sub_agents=[...]` → **「Auto-inject delegation tools named after each subagent」**；subagent 带 `mode`：**`chat`**（默认，完整用户交互，**manual** 经 `transfer_to_agent` 交回）、**`task`**（澄清型 HITL，**automatic** 经 `finish_task` 交回）、**`single_turn`**（无用户交互，自动交回，**可并行**） |
| 分支上下文与限制 | task/single-turn的模型调用仅见本分支事件，并行结束后父agent收集结果；这是事件/模型上下文隔离，不是共享状态、文件系统或OS隔离。task agent须为叶子；ADK Python v2.0.0的graph-based workflow暂禁task行为 |
| Session／State／Memory | 状态持久性依SessionService；InMemory重启丢失，Database/VertexAi声明持久。原采集的Session/Events定义、跨会话Memory及MemoryService未在本包逐项复核 |
| 状态作用域前缀 | 无前缀为当前session，不是`session:`前缀；`user:`限同一`app_name`下同一`user_id`的各session；`app:`限该应用所有用户/session；`temp:`限invocation。子调用传InvocationContext，因此调用链共享invocation ID和`temp:`状态 |
| HITL是图节点 | `yield RequestInput(...)`暂停等输入后继续，节点无需模型。`rerunOnResume: false`为TypeScript示例的叶节点默认值；调用`ctx.runNode()`须设true，不能扩成所有SDK通用默认值 |
| Callbacks，未复核 | 原采集列Before/After Agent、Model、Tool六类钩子及policy enforcement用途；本包未验总数、版本或执行语义 |
| managed面，未复核 | 原采集列ManagedAgent Preview、付费Agent Runtime；Agent Engine命名变化与Agent Garden导航缺席亦未核。保留为来源线索，不据此断言产品改名或功能不存在 |
| Google 自己的「别用 A2A」准则 | 「**When NOT to use A2A** … prefer local sub-agents」用于内部代码组织、性能关键的内部操作、以及「**Shared Memory/Context**」；并称本地 sub-agent「are like internal modules or libraries … Communication … is very fast because it happens directly in memory, without network overhead」 |

---

## 6. Microsoft

### 6.1 AutoGen（官方渲染文档，一手）[S6a]

本节按[04-GM3](supplements/04-google-microsoft-facts-20261014.md)核对team状态、RoundRobin与
Swarm指定段落，绑定2026-10-14的stable文档快照。分层、Magentic-One及全部termination语义仍未验收。

| 维度 | 官方表述 |
|---|---|
| 分层，未复核 | `autogen-core`＝「An event-driven programming framework for building scalable multi-agent AI systems」；`autogen-agentchat`＝高层 API，提供「Agents with preset behaviors and **Teams** with predefined multi-agent design patterns」 |
| Team 目录，未完整复核 | `RoundRobinGroupChat`／`SelectorGroupChat`（用模型选下一个发言者）／`MagenticOneGroupChat`／**`Swarm`**（用 `HandoffMessage` 表示 agent 间转移）；导航另有 **GraphFlow（Workflows）** |
| RoundRobin共享上下文 | 该配置内所有agent轮流响应并向其他成员广播，不能扩为所有AutoGen配置的默认行为 |
| 控制流原语，未完整复核 | termination condition：`TextMentionTermination`、`TextMessageTermination`、`ExternalTermination`、`HandoffTermination`，可用 `|`／`&` 组合（教程另有 max-message／token 两类条件） |
| 跨run状态 | team在run结束后保留历史与上下文，可再次调用run/run_stream继续；reset清team与各agent状态。这不单独证明进程重启后的持久恢复。ExternalTermination等待当前agent轮次结束，未必立即停止 |
| Swarm handoff风险 | 模型并行工具调用可能同时产生多个handoff并出现unexpected behavior；文档对OpenAI/AzureOpenAI客户端给出`parallel_tool_calls=False`，不推广为所有客户端参数 |
| 人工输入示例 | 示例用`HandoffTermination(target="user")`停等输入，再把用户回复作为HandoffMessage定向原请求者；是示例控制流，不是所有应用自带人工审批 |
| Magentic-One，未复核 | 「Magentic-One's Orchestrator agent creates a plan, delegates tasks to other agents, and tracks progress towards the goal, dynamically revising the plan as needed」；可派给 `FileSurfer`／`WebSurfer`／`Coder`／`Computer Terminal`；风险提示含「**Human Oversight**: Run the examples with a human in the loop」「Limit Access」 |
| 从简准则（逐字） | 「**start with a single agent for simpler tasks, and transition to a multi-agent team when a single agent proves inadequate.**」 |

### 6.2 Microsoft 是否把用户引离 AutoGen、以及 Agent Framework 的组织原语 [S6m][S6m2][S6m3][S6m4]

- AutoGen官方README已明确maintenance mode、停止新增功能并交社区维护，建议新用户采用
  Agent Framework并鼓励现有用户迁移。2026-10-14经官方GitHub API取得，blob为
  `25f7cc162ae92c3988966d85cce173ff6df48020`，补齐原报告的维护模式缺口。
- Framework概览称它是同团队开发的AutoGen/Semantic Kernel直接继承者。迁移页更新于
  2026-08-25，称其聚焦single-process composition、distributed execution仍在计划中。
  2026-09-21更新的checkpoint页则说明Cosmos跨进程持久化；保存/恢复与分布式执行不同，
  不能把两句合成当前执行拓扑已核或实际矛盾。README的durable扩展只核链接存在。
- README的production-ready表述不提供准确GA日期，也不证明全部SDK稳定，概览仍列Go public
  preview。已核原文及日期见[04-GM4](supplements/04-google-microsoft-facts-20261014.md)。
- **Agent Framework 组织原语**：

下表已核五种模式目录、checkpoint与人工暂停概述；其余API参数和Hosted agents仍待逐项验收。

| 维度 | 官方表述 |
|---|---|
| 五种编排模式 | **Sequential**／**Concurrent**／**Handoff**（按上下文互相转移控制）／**Group Chat**（共享会话协作）／**Magentic**（「A manager agent dynamically coordinates specialized agents」） |
| handoff vs agent-as-tool，细节未复核 | 「In handoff orchestration, the conversation is handed off to another agent entirely. **The receiving agent has full context of what has been done so far.** In agent-as-tools, the primary agent manages the overall context…」默认交互式（把控制权交回你），`WithAutonomousMode()` 才自动跑，**默认每 agent 上限 50 个自主回合**；**持久 handoff 需要 checkpointing ＋ 稳定 agent id** |
| Group Chat，参数未复核 | `GroupChatBuilder(participants=…, termination_condition=…, selection_func=…)`，也可换成**用完整 agent 当编排者**（`orchestrator_agent`，「a full Agent with access to tools, context, and observability」） |
| Magentic，参数未复核 | `MagenticWorkflowBuilder(managerAgent).AddParticipants([...])`，暴露内环上限（`WithMaxRounds`／`WithMaxStalls`／`WithMaxResets`）与 **HITL 计划签核**（`RequirePlanSignoff`）；自定义 `progress_ledger_prompt` **必须保留内建 JSON schema** → **progress ledger 就是编排者的共享状态产物**；该类型标记为实验性 |
| Checkpoint | superstep完成后保存executor状态、下步pending messages、requests/responses与shared states；Python 1.13.0起增加entry checkpoint以支持完整回放。InMemory仅进程内、File落本地盘、Cosmos提供跨进程持久保存/恢复；文档功能未作独立恢复实验 |
| HITL 两条机制，细节未复核 | ① **tool approval**（「Agents can use **approval-required tools** that pause the workflow for human review before execution」；Harness Agent 另有 don't-ask-again tool approval）；② **`RequestPort`**——executor 向外发请求并等响应，`RequestPort` 发 **`RequestInfoEvent`**，框架**按原始请求把响应自动路由回对应 executor** |
| 服务端托管，未复核 | Foundry Agent Service **Hosted agents** 跑「containerized agentic AI applications」（可用 Agent Framework／LangGraph／Semantic Kernel／自研），「Hosted agents run in **per-session VM-isolated sandboxes**. Each session gets a dedicated sandbox with a persistent filesystem (`$HOME` and `/files`)… **The platform handles scaling, session state persistence, observability, and lifecycle management**」 |

### 6.3 Copilot Studio 与复杂度治理（官方文档，一手）[S6c][S6g]

- 按[04-GM5](supplements/04-google-microsoft-facts-20261014.md)核对，30–40 choices of action是
  rule of thumb，包含tools、topics和其他agents，不是工具数单项或拆分硬阈值。
  较少但描述相似也会退化；文档要求先改善描述，再依据自己的评测判断是否拆分。未报告实验模型、
  任务分母、成功率或置信区间。
- 文档明确额外编排跳转会增加延迟以及测试、管理和治理工作量，没有量化这些代价。
  原采集的child/connected完整拓扑、独立ALM/模型设置及功能限制未在本包逐项核完。
- **复杂度选择建议（逐字）**：「Before you adopt a multiagent orchestration pattern, evaluate whether
  your scenario requires one… **Use the lowest level of complexity that reliably meets your
  requirements.**」阶梯＝Direct model call → Single agent with tools（「Often the right default for
  enterprise use cases… To guard against infinite tool-call loops, set iteration limits」）→
  Multiagent orchestration（「Adds coordination overhead, latency, and failure modes…」）；每个模式
  另有 "When to avoid"。这是Microsoft的架构建议，不是多agent普遍更省钱或更有效的实测结论。

---

## 7. 框架横向

### 7.1 Cognition：`writes stay single-threaded` 与 map-reduce-and-manage（一手，直读）[S9b]

- 载体：Cognition 官方博客 **《Multi-Agents: What's Actually Working》**（Walden Yan，**2026-04-22**）。
  **日期更正**：其自述「**10 months ago** I wrote *Don't Build Multi-Agents*」→ 原文约 **2025-06**，
  **不是 2025-10**（脚注亦称 Anthropic 的工程博客「次日」发布，而后者公开日期为 2025-06-13）。
  本报告采用 **≈2025-06**。
- 逐字结论：① 「Our original observations still hold today for **parallel-writer swarms**: most of
  the sexy ideas in that space still don't see meaningful adoption.」；② 「we've found a narrower
  class of patterns that do: setups where multiple agents contribute intelligence to a task
  **while writes stay single-threaded**」；③ 「most multi-agent setups in the world are limited to
  '**readonly**' subagents … these types of subagents mostly resemble **tool calls** rather than
  true multi-agent collaboration」；④ 「the **unstructured-swarm** approach … **is mostly a
  distraction**. The practical shape is **map-reduce-and-manage**: a manager splits work, children
  execute, the manager synthesizes and reports back.」；⑤ 总纲：「multi-agent systems work best
  today when **writes stay single-threaded** and the additional agents **contribute intelligence
  rather than actions**」，「The open problems are all communication problems」。
- **generator–verifier 环（有数字）**：Devin Review 在 Devin 自己写的 PR 上平均抓 **2 个 bug/PR，
  约 58% 为严重级**；反直觉发现是**效果最好时 coder 与 reviewer 事前不共享上下文**（干净上下文
  迫使从实现反向推理，上下文更短、注意力更好）。
- **「Smart Friend」能力路由**：**诚实的负面结果**「SWE 1.5 was not good enough at being the
  primary model for this setup to really work」（瓶颈是 primary 判断何时升级、该问什么）；**正面**
  是**跨前沿模型**可行（「We've run Claude and GPT together in this setup in production for a
  meaningful stretch」），此时「the delegation logic becomes a **capability router** rather than a
  difficulty escalator」。
- **更高层委派（manager ＋ child，内部 MCP）三条教训**：小范围委派训练出的 manager **过度指令
  化**；agent **误以为与子级共享状态**；**跨 agent 通信默认不会发生**（「doesn't happen by
  default, because models haven't been trained in environments where it needed to」）。

### 7.2 LangGraph／LangChain（官方文档与包元数据，一手）[S7f][S7f2]

| 维度 | 官方表述 |
|---|---|
| 自我定位 | **「a low-level orchestration framework and runtime」**，重点是 **durable execution、streaming、human-in-the-loop、persistence**，可在同一张图里**混用确定性步骤与 LLM 驱动步骤** |
| 官方栈分层 | **Deep Agents**＝「an agent **harness**: planning, **subagents**, filesystem tools, and context management on top of LangGraph」；**LangChain**＝agent framework；**LangGraph**＝orchestration runtime；**LangSmith**＝tracing／eval／prompt／deployment 平台；**LangSmith Fleet**＝no-code builder |
| 多 agent 指南的反面论证 | 「not every complex task requires this approach—a single agent with the right (sometimes dynamic) tools and prompt can often achieve similar results」；五种模式：Subagents／Handoffs／Skills／Router／Custom workflow |
| supervisor 已被降级为模式 | `langgraph-supervisor` 包 README 逐字「**We now recommend using the supervisor pattern directly via tools rather than this library for most use cases.** The tool-calling approach gives you more control over context engineering」 |
| subagents 模式语义 | 「a central main agent (often referred to as a **supervisor**) coordinates subagents by calling them as **tools**… By default, subagents are **stateless**… This provides **context isolation**」；并区分 supervisor 与 router（「The supervisor is a full agent that maintains conversation context… A router is typically a single classification step」） |
| handoff 原语 | `Command(update=…, goto=…, graph=…, resume=…)`；`graph=Command.PARENT`「is particularly useful when implementing **multi-agent handoffs**」——即 handoff ＝图边＋返回值 |
| 持久化 | 「**Checkpointers** persist a thread's graph state… for short-term, thread-scoped memory… **Stores** persist application-defined data outside the graph state… for long-term, cross-thread memory」；`MemorySaver`「store checkpoints in RAM. When the process restarts, all checkpoints are lost」，生产用 `PostgresSaver`／`SqliteSaver`；**归属**：「When using the **Agent Server**, you do not need to implement or configure checkpointers or stores manually. **The server handles persistence infrastructure behind the scenes.**」 |
| HITL | `interrupt("…")` 暂停、经 checkpointer 存状态并「**waits indefinitely**」；`Command(resume=…)` 恢复且其值「becomes the return value of the `interrupt()` call from inside the node」；需要 checkpointer ＋ `thread_id`（「The `thread_id` you choose is effectively your persistent cursor」）；另有 time travel 建立在 checkpoint 历史上 |
| 成本治理 | **`recursion_limit`**——「the maximum number of super-steps… **Starting in version 1.0.6, the default recursion limit is set to 1000 steps.**」，超限抛 `GraphRecursionError`，并可用 `RemainingSteps` 做优雅降级 |

**未采**：`durability` 模式名（官方 `/langgraph/durability` 页 **404**，只有 `#durability-modes`
锚点存在）→ `[未经一手来源核验]`。

### 7.3 CrewAI（官方文档，一手）[S7c][S7c2][S7c3]

| 维度 | 官方表述 |
|---|---|
| 两种组织形态 | **Crew**（「a collaborative group of agents working together to achieve a set of tasks… defines the strategy for task execution, agent collaboration, and the overall workflow」）与 **Flow**（`@start()`／`@listen()` 事件驱动，共享 `self.state`，可串联多个 Crew） |
| Process＝轮转模型（逐字） | 「Processes orchestrate the execution of tasks by agents, **akin to project management in human teams**」；**Sequential**（按序、前任务输出作为后任务上下文）与 **Hierarchical**（「Organizes tasks in a managerial hierarchy… A manager language model (`manager_llm`) or a custom manager agent (`manager_agent`) must be specified」）；manager 职责＝「planning, delegation, and validation」，且「**Tasks are not pre-assigned; the manager allocates tasks to agents based on their capabilities, reviews outputs, and assesses task completion**」 |
| 委派是自动加的工具 | 「When `allow_delegation=True`, CrewAI automatically provides agents with two powerful tools: **Delegate work to coworker(task, context, coworker)** and **Ask question to coworker**」 |
| Task ＝工作单位 | `description`／`expected_output`／`agent`／`context`（链式）／`async_execution`／**`human_input`**（「Whether the task should have a human review the final answer of the agent」）／`guardrail`(+`guardrail_max_retries` 默认 **3**)／`output_file`／`output_json`／`output_pydantic` |
| 记忆已统一 | 单一 `Memory` 类（取代 short-term／long-term／entity／external 四分类），保存时由 LLM 分析（推断 scope、categories、importance），检索为「adaptive-depth recall… blends semantic similarity, recency, and importance」；**默认后端＝本地 LanceDB，落在 `./.crewai/memory`** |
| 成本与治理（写进概念层） | **Delegation 现在默认关闭**（「Delegation is now disabled by default to give users explicit control」）；可配 **Max Requests Per Minute**、**Max Iterations**、**Context Window Respect**、Stop Words Control |
| Checkpointing（逐字） | 捕获「the full state of the crew, flow, or agent — configuration, **agent memory and knowledge sources**, task progress, intermediate outputs, internal state and attributes」＋ kickoff 输入＋事件历史＋**lineage ID**；恢复时跳过已完成任务、**rehydrate 记忆与知识**；**Forking** 在同一恢复语义下开新 lineage，使新分支与原运行可并行写 checkpoint 而不互相覆盖；触发为事件驱动（默认 `task_completed`）；存储 `JsonProvider`／`SqliteProvider`，设 `max_checkpoints` 时**裁剪最旧**；Crew／Flow／Agent 都接受 `checkpoint` 且**子级默认继承父级** |
| Flow 的持久单位 | `@persist` 装饰器在类或方法级自动持久 Flow 状态，**默认 `SQLiteFlowPersistence`**，每个 flow state 有唯一 ID |

**CrewAI 无反面准则**：这些页面上**没有**第一方「别做多 agent」的告诫 `[未经一手来源核验]`。

### 7.4 OpenAI Swarm → Agents SDK（一手 README 镜像 ＋ SDK 文档）[S10]

- **Swarm 的官方状态（逐字，`openai/swarm@main` README 经 CDN 镜像）**：标题「**Swarm
  (experimental, educational)**」，横幅「**Swarm is now replaced by the OpenAI Agents SDK, which
  is a production-ready evolution of Swarm.** … **We recommend migrating to the Agents SDK for all
  production use cases.**」。
- **它普及的 handoff 原语＝一个「返回 agent」的函数**：`def transfer_to_agent_b(): return agent_b`，
  注册进 `Agent(functions=[...])`，由 `client.run(...)` 执行 → **handoff 是工具调用的返回值**，
  主循环据此改指活跃 agent。
- **Agents SDK 的两条命名编排**：**Agents as tools**（「A manager agent keeps control of the
  conversation and calls specialist agents through `Agent.as_tool()`」）与 **Handoffs**（「A triage
  agent routes the conversation to a specialist, and that specialist becomes the active agent for
  the rest of the turn」）；另有 orchestrate via code（结构化输出路由、链式、evaluator 循环、
  `asyncio.gather` 并行）。
- **handoff 机制细节**：`input_type` 描述的是**handoff 工具调用本身的参数**；到达后「it's as
  though the new agent takes over the conversation, and gets to see the entire previous
  conversation history」，除非 `input_filter` 裁剪；嵌套 handoff 历史是 **opt-in beta 且默认
  关闭**；**服务端托管会话（`conversation_id`／`previous_response_id`）不支持 handoff input
  filter**。
- **审批与轮次治理**：`needs_approval` 声明在**工具上**（`function_tool`／`Agent.as_tool`／
  `ShellTool`／`ApplyPatchTool`，MCP 用 `require_approval`），待批项出现在
  `RunResult.interruptions`（**含 handoff 之后与嵌套 `Agent.as_tool()` 内产生的审批**），再
  `to_state()` → `approve`/`reject` → `Runner.run(agent, state)` 恢复；粘性决定可经
  `state.to_string()`／`to_json()` 序列化；**参数无法检视时审批规则 fail closed**；`max_turns`
  在 Runner 各入口可用，超限抛 `MaxTurnsExceeded`（`max_turns=None` 关闭，`error_handlers` 可给
  受控回退）。

---

## 8. 本地 DSH 生态清单（只读采集）

### 8.1 宿主安装面 [L1]

- `@deepseek-ai/dsh` **0.2.1-alpha.2**，`bin.dsh`＝`lib/bin.js`；安装树内 `@deepseek-ai/*` 包
  **299** 个，其中 `dsh-experimental-*` **22** 个。
- profile 机制（一手自述）：「profiles are ordered stacks of plugin-bundle patch layers under the
  user's own overrides」；profile 目录＝`package.json`（`dsh.profile.bundles` 有序 bundles）
  ＋`cordis.patch.yml`（用户 patch 层）；组合顺序＝各 bundle patch（按 bundles 顺序）→ profile
  patch → home 级 `$DSH_HOME/cordis.patch.yml` → `--patch` 覆盖；`dsh plugin --profile <name>
  <pnpm args>` 转发到 profile 目录的 pnpm；安装与启动校验 DSH peer 版本范围，不兼容插件需**显式
  确认的精确版本豁免**。
- CLI：`dsh <name>`／`--profile <name>`；`--from-default-profile <template>`；`--dump-config`／
  `--dump-default-config`／`--dump-config-schema`（只读导出组合树）。

### 8.2 宿主自带的 Agent Teams 实验包族（重点）[L2]

四个包，版本一律 **0.2.1-alpha.2**，随安装树发布（`$DSH/node_modules/@deepseek-ai/`）：

| 包 | 官方 description | 关键 peer |
|---|---|---|
| `dsh-experimental-agent-team` | Implicit-root Agent Teams roster, direct peer messaging, and shared task DAG | `dsh-agent`／`dsh-llm`／`dsh-session`／`dsh-session-persistence`／`dsh-session-projection`／`dsh-subagent`（均 0.2.1-alpha.2） |
| `dsh-experimental-tool-agent-team` | Scoped model-facing Agent Teams tools over `ctx.agentTeams` | `dsh-agent`／`dsh-session`／`dsh-system-prompt`／`dsh-tools` |
| `dsh-experimental-client-ui-agent-team` | Web Agent Teams roster, task board, and teammate navigation | 多个 `dsh-client-ui-*` |
| `dsh-experimental-agent-team-profile` | Agent Teams collaboration, tools, and Web UI in one experimental bundle | `cordis ~4.0.5-alpha.1` |

官方 README 明确「published under its experimental name and **provides no stability guarantee**」[L3]。
其余 18 个 `dsh-experimental-*` 只记包名（§12），其中 `dsh-experimental-auto-review` 与 dots 的
auto-review 可能是可比对象。

### 8.3 `$DSH_HOME` 顶层资产 [L5][L6][L7]

- 目录：`profiles/`（19 项＝18 profile ＋ 共享 `node_modules`）、`plugins/`（9 项）、`pod/`、
  `pod-workspaces/`、`skills/`、`sessions/`、`storages/`、`backups/`、`archived-sessions/` 等。
- 预设面：`.agent-presets/` 只含 **`bot-nopersona`**；`agent-presets-backup/` 含 **`team`**；两者
  与 `plugins/dsh-team/presets/team/` 的关系**未核验**（§12）。
- **home 级 `$DSH_HOME/cordis.patch.yml` 不存在**；**`$DSH_HOME/settings.yaml` 不存在**（只有
  `settings.yaml.bak-*` 与 `settings.yaml.imported`）→ **现役配置的实际落点是各 profile 的
  `cordis.patch.yml`**。
- `profiles/web/package.json` 的 `dsh.profile.bundles` 为 **9 个**：`dsh-base`、`dsh-web-app`、
  **`dsh-experimental-agent-team-profile`**、`dsh-experimental-cot-translation-bundle`、
  `dsh-experimental-session-search`、`dsh-experimental-tool-worktree`、
  `dsh-experimental-terminal-bundle`、`dsh-experimental-ralph-bundle`、
  `dsh-experimental-badge-skill-bundle`；`patchReload: live`。→ **宿主自带 Agent Teams bundle 已
  装进现役 web profile 的 bundles 列表。**
- `profiles/web/cordis.patch.yml` 关键行：`- insert: [- id: bots, name: 'pod']`（**Pod 以 `bots`
  为 id 接入现役 web profile**）；另有 `restart`（dsh-restart）、`screenshot`（dsh-screenshot）
  两个 insert；**`team`（dsh-team）、`browser`（dsh-browser）、`widgets`（dsh-header-widgets）
  三行被注释停用**（注释原文：「dsh-team plugin + bundled 团队模式 agent preset — one toggle.
  Disabled: sidebar/monitor and the team preset are both hidden.」）；另有 compaction 三行启用、
  `agent-default-model` 指向 `magpie`／`opencode-go/deepseek-v4.1-flash`／`reasoningEffort: max`、
  `subagent` 的 `maxDepth: 2`，以及 `Magpie*` 网关 provider 定义（本地网关 `127.0.0.1:3425`）。

### 8.4 `$DSH_HOME/plugins/`（个人插件面，原采集9项）[L4]

`dsh-team`采集时点存在，现已删除。2026-10-13的
[运行面删除事件](../../../docs/changelog/2026-10-06.md#2026-10-13-ev-20261013-runtime-remove-dsh-team-运行面清理按用户点名删除早期失败插件-dsh-team120k备份留档)
记录删除后余8项、备份路径与完整SHA。下表保留原采集事实，`dsh-team`一行仅供历史对照；
本次只引用既有落档，不重做删除或读取真实配置。

| 目录 | name | version | 结构要点 |
|---|---|---|---|
| `pod` | `pod` | 0.1.0 | 部署面 Pod：`lib/`（含 `lib/org/`）、`scripts/`、`tests/`、`.scratch/` |
| `dsh-bots` | `dsh-bots` | 0.1.0 | 旧名留存（含 CHANGELOG／PROJECT_UNDERSTANDING／PLAN／PROPOSAL） |
| `dsh-bots-backup-20260829` | `dsh-bots` | 0.1.0 | 2026-08-29 备份件 |
| `dsh-team`，现已删除 | `dsh-team` | 0.1.0 | 原采集带 `presets/team/`（`preset.yml`＋`agent.cordis.yml`）；peer `dsh-commands`／`dsh-llm`／`cordis` |
| `dsh-browser` | `dsh-browser` | 0.1.0 | 提供 `/browser`；带 `node_modules` |
| `dsh-restart` | `dsh-restart` | 0.1.0 | 提供 `/restart`；systemd 隔离启动；带 README／tests |
| `dsh-screenshot` | `dsh-screenshot` | 0.1.0 | 「+」菜单「添加」区的截图工具 |
| `dsh-vision` | `dsh-vision` | 0.1.0 | peer `dsh-llm`／`cordis` |
| `dsh-header-widgets` | `dsh-header-widgets` | 0.1.0 | 从 dsh-team 拆出的 header 组件 |

九项导出形态一致：`"."`（`lib/index.js`）＋多数含 `"./client"`（web 客户端面）。**`dsh-team` 的
组织模型（一手 preset 文本）[L8]**：`presets/team/preset.yml` 声明 `name: 团队模式`，描述「基于
标准模式的多 Agent 团队协作模式：规划、并行执行、审查、汇报」，`order: 10`；其 `agent.cordis.yml`
是**标准 agent preset 的完整复制**，只把 persona 换成 Team Lead／dispatcher：「Your ONLY job is
to coordinate. You must NEVER write, edit, or implement code yourself」，流程为 PLAN → DISCUSS
（2–4 个 worker、上限 2–3 轮）→ DELEGATE → MONITOR → RE-DISPATCH → REVIEW（用全新 reviewer
subagent）→ REPORT。→ **该预设用「人格约束＋subagent 工具」实现分层，不引入任何编制／账本／权限
面。**同一文件还是本仓可复用的**宿主组合契约文档**（一手注释）：service row 必须放在带 `isolate`
realm 的 group 内，否则发布到 root realm 造成进程级冲突；并逐项说明哪些服务属 host plane
（subagents 注册表、goal 服务与 session driver、tokenMeter、jobs 注册表、skill 注册表分层、
shell-env 注入、workflowEngine 的 realm 归属）。

### 8.5 `$DSH_HOME/profiles/`（每 bot 一 profile 的组织面）[L9]

- 共 **18 个 profile**：`web`、`headless`、`bot`、`bot-mt2bqvh2`、`ui-bot`、`x`、
  `duty-coordinator`、`implementer`、`exp17-bare-{code,duty,research}`、
  `exp17v2-bare-{code,duty,research,smoke}`、`exp17v3-bare-{code,duty,research}`。
- bundles：`duty-coordinator`／`implementer`／`bot`／`ui-bot`／`x`＝`dsh-base`＋`dsh-web-app`；
  `headless`＝`dsh-base`＋`dsh-headless`（`patchReload: startup`）；`web`＝9 个（见 §8.3）。
- **per-profile 权限原始语**：patch 层通过**按 id 停用工具行**实现只读——例如
  `profiles/x/cordis.patch.yml` 头部注释「Bot profile: x (read-only: write/exec tools
  disabled)」并停用 `tool-bash`、`tool-bash-persistent`、`tool-str-replace-editor` 等。
- **per-profile 模型配档**：每个 bot profile 各自 pin `agent-default-model` 与 provider 列表
  （`duty-coordinator`→`opencode-go/deepseek-v4.1-flash`；`exp17v3-bare-*`→`magpie-anthropic`／
  `zcode/GLM-5.3`）。
- 目录结构：`cordis.yml`（空入口，注释指向 patch 文件）＋`cordis.patch.yml`＋`package.json`；
  `web` 另有 `node_modules/`（`.package-map.json` 把 9 个 `@deepseek-ai/*` 包映射到本地目录）。

### 8.6 `$DSH_HOME/pod/`（Pod 运行面状态：结构与字段名）[L10]

- 一等目录：`capabilities/`（`issued.jsonl`、`nonces/`、`secret`）、`inbox/<bot>/`、
  `outbox/<bot>/`、`ledger/`（`events.jsonl`、`audit.jsonl`、`epoch.json`、`idempotency/`、
  `lock/`）、`knowledge/`（`index.jsonl`、`REPORT_TEMPLATE.md`、`reports/`）、`started/`
  （`instances.jsonl`＋monitor 日志）。
- `bots.json`＝**编制表**：顶层对象，键为 bot id；本轮采集到 **2 个在编 bot**：`duty-coordinator`、
  `implementer`。每条记录字段名（只记字段名，不抄内容）：`id`、`post`、`bootstrapAnchor`、
  `modelProvider`、`model`、`permission`、`port`、`name`、`role`、`reasoningEffort`、`readOnly`、
  `avatar`、`group`、`workspace`、`workspaceRoot`、`enabled`、`createdAt`、`lastActiveAt`、
  `pid`、`pidStartTicks`、`startedAt`。
- 两条在编记录的组织字段取值：`post=duty-coordinator`／`permission=read-only`／`readOnly=true`／
  `port=3101`；`post=implementer`／`permission=workspace-write`／`readOnly=false`／`port=3102`；
  两者 `group=""`，模型同为 `opencode-go/deepseek-v4.1-flash`。→ `permission` 取值域与 DSH 自身
  文件策略模式（`read-only`／`workspace-write`）同构。
- `pod-workspaces/`：**每 bot 一个工作目录**（13 项，与 profile 名一一对应）。

---

## 9. 宿主自带 Agent Teams 包的组织模型（一手 README）

本批复核四包`0.2.1-alpha.2`的README、patch与关键源码符号，未逐行通读或启动运行。
可引用字段与SHA见[补核件](supplements/04-host-and-claude-teams-20261013.md)；README外链的设计文档
不在所读安装包内，其内容仍未知。明确限制含no nested Team；领队替换未给承诺，
不能仅凭TeamId与SessionId相等推导所有替换路径在结构上不可能。

**模型与权威 [L3]**：**Lead**＝**每个普通运行时根就是它自己 Team 的隐式 Lead，`TeamId` 等于
`SessionId`**，没有创建事件，持久 Team 状态从**第一条 member 或 task 记录**开始存在；
**Teammates** 由 Lead 生成，命名永久（**即使生成失败也保留名字，名字永不复用**），fresh（无 lead
对话记忆）或 fork（继承 lead 已完成回合前缀，只捕获一次）；**Roster 状态** `running`／`inactive`／
`provisioning`／`failed`，未加载的成员在唤醒时收到消息；**权威**＝**只有 Lead 能生成 teammate 或
中断它们**（设计承诺之一「Explicit authority」）；**消息**＝任何成员可发给任何成员或 Lead，发送
返回目标 inbox 的 `MessageId` 或抛错，**不保留未接受的发送意图、重启后不重试新消息、不显式去重
重复发送**，仅 Lead 用 `Agent.steer()` 直接投递、teammate 走 continuation owner 的 host-only
Steer 路径；**四承诺**＝Durable log, derived state／Process-local ownership／Explicit
authority／Bounds that fail loud。

**共享任务板（shared task DAG）[L3]**：任何成员可加任务（title、details、可选依赖、可选 file
hints）；**依赖全部完成的 pending 任务才可认领**；任务有 owner（认领／完成／释放／重开），**Lead
可指派给任何成员**；**每次变更都是 compare-and-set**（基于过期副本的更新被拒，
`TEAM_TASK_STALE_REVISION`，「so two members cannot silently overwrite each other's work」）；
file hints 只在两个 in-progress 任务路径重叠时**警告，永不阻塞**，`writeScopes` 规范化为工作区
相对前缀、**从不为写操作授权**；删除的任务留 tombstone（保 id 稳定与重放）；**等待与中断**——
`waitForChange()` 等一个 roster／task／消息接受／live-status 边沿（10 秒–1 小时）且**只报告是否
超时**，`interrupt()` 仅 Lead 可用、只取消当前回合并 `keepInbox`、**既不释放任务所有权也不删持久
邮件**；**耐久模型**——roster 与 task 变更把 `team/member`、`team/task` 追加到**确切的活的 Lead
Session**，成功前先 flush，历史 `team/message/queued`／`delivered` 可读但**Team 不再写这两种
事件**，**四类事件都是 log-only，永不进入对话面**。

**模型面工具、政策与上限 [L11][L12]**：**九个工具、四组能力**＝创建（`spawn_teammate`，**仅
Lead**）／发消息（`send_message`：在最近 step 边界 steer 运行中成员，或启动／恢复非活跃成员）／
看与等（`list_agents`、`wait_agent`、`interrupt_agent`（仅 Lead））／任务板
（`team_task_create`／`list`／`get`／`update`）；**每个团队成员拿到同一套九个工具与同一份协调
政策**（另有 `team:policy` 提示段）；**固定政策＝只有用户显式要求团队或 teammate 时才创建
teammate**；这九个工具与 legacy 全局 continuable-subagent 控制同名，对团队成员**遮蔽**那些全局
定义；`send_message` 返回 `{"sent": true}`（不含消息 ID），**成功不确认接收方已处理、也不确认已
同步落盘**，`wait_agent` 在没有成员运行或 provisioning 时立即返回 `noProgress`；**上限（fail-loud
部署值）**＝`maxMembers` **16**（含失败的；bundle 收窄为 **8**）、`maxTasks` **256**、
`maxMessageBytes` **65,536**、`disposalTimeoutMs` **5,000**；官方「何时选它」＝**同一共享工作
目录内的协作**＋持久 roster 与 task 状态，**明确不支持**独立工作目录、跨进程协调、任务 owner
自动释放，且**要求持久会话存储**。

**bundle 的接线方式（替换式，一手）[L12]**：

```yaml
- id: tool-subagent-control      # 以下四行把普通委派整体停用
  disabled: true
- id: tool-subagent-list-agents
  disabled: true
- id: tool-subagent
  disabled: true
- id: tool-subagent-fork
  disabled: true
- insert:
    - id: agent-team               # maxMembers: 8, maxTasks: 256,
      name: '@deepseek-ai/dsh-experimental-agent-team'          # maxMessageBytes: 65536,
    - id: tool-agent-team          # disposalTimeoutMs: 5000
      name: '@deepseek-ai/dsh-experimental-tool-agent-team'     # freshProvider: spawn
    - id: ui-agent-team            # forkProvider: fork
      name: '@deepseek-ai/dsh-experimental-client-ui-agent-team'
```

README 说明后果：「Ordinary subagent delegation and overlapping global child controls are
disabled; Workflow can still create fresh children. **The bundle ships with dsh switched off.**
Enable it from the Plugins page or add it to an initialized profile.」Web UI 侧：会话头部一个 Agent
Teams 动作，可看当前 roster、共享任务板，并**导航进某个 teammate 的会话**；它读 Lead Session 的
`agentTeam` 投影（Host projection frames 保持实时）；该浏览器投影**不扩展稳定 API Proxy、不存
Team 状态、不注册模型面输入** [L13]。

---

## 10. dsh-bots（Pod）自身的组织面清单（本仓库，只读）[L14]

- `package.json`：name **`pod`**，version 0.1.0，private，`type: module`，`main: lib/index.js`；
  scripts `test`（`node tests/run.mjs`）／`preflight`／`ci-check`；`dsh.client` 声明 web 平台并
  注入 `dsh-client-ui-layout`、`dsh-client-locale`。
- 采集时点 HEAD：`d7b86907875f513a6114100291c5541e43def5ac`（2026-10-13 15:32:34 +0800）；
  worktree 仅 `main`。**本报告未运行任何 git 写命令。**
- `lib/org/`（45 文件）按主题：

  | 主题 | 模块 |
  |---|---|
  | 岗位与授权 | `role-cards.js`、`role-card-digests.generated.json`、`permissions.js`、`op-set.js`、`capability-base.js`、`capability-issue.js`、`capability-delivery.js` |
  | 台账与证据 | `task-ledger.js`、`ledger-events.js`、`ledger-host.js`、`task-projection.js`、`acceptance-coordinates.js`、`durability.js` |
  | 简报与派单 | `brief.js`、`brief-gate.js`、`dispatch-config.js`、`dispatch-decision.js`、`criterion-runner.js` |
  | 邮件与人对接口 | `mail-relay.js`、`mail-client.js`、`mail-shared-face.js`、`human-inbox.js`、`post-channel.js` |
  | 记忆／知识分离 | `memory-layer.js`、`knowledge-shared-face.js`、`vocabulary-face.js` |
  | 评审面 | `review-kit.js`、`review-session.js`、`review-artifacts.js` |
  | 宿主接缝与实验 | `host-contract.js`、`host-channel.js`、`host-env-seam.js`、`face-scan.js`、`deployment-inventory.js`、`cutover.js`、`cutover-readiness.js`、`experiment-{prereg,cost,attribution,shape,verdict}.js`、`probe.js`、`store-base.js`、`unauthorized-count.js`、`run-count.js` |

- 顶层 `lib/`（29 文件）含 `index.js`、`client.js`、`bot-supervisor.js`、`bot-autostart.js`、
  `mail-plane.js`、`knowledge.js`、`session-driver.js`、`ledger-evidence.js`、
  `evidence-packager.js`、`host-faces.js`、`sentinel-*.js`、`data-roots.cjs`、`spawn-env.js`、
  `api-security.js` 等；`scripts/`（20 个）含 `create-bot.cjs`、`bot-health.cjs`、
  `deploy-sync.mjs`、`org-cutover-check.mjs`、`ledger-drill.mjs`、`ledger-evidence-verify.mjs`、
  `capability-issued-audit.mjs`、`role-card-drift-check.mjs`、`preflight.mjs`、`evidence-*.mjs`、
  `amplification-experiment.mjs`、`c2-preparation.mjs`、`changelog-add-event.mjs`、
  `project-context.mjs`；`tests/`＝**95 个 `.mjs`**（含 `task-ledger`、`org-ledger-authz`、
  `capability-issued-audit`、`bot-supervisor`、`org-mail-relay`、`org-post-channel`、`knowledge`、
  `org-closed-loop-smoke`、`org-acceptance-coordinates`、`deploy-sync` 等）。
- 文档面：`README.md`、`GLOSSARY.md`、`docs/PROJECT_UNDERSTANDING.md`、`docs/agents/*.md`
  （issue-tracker／triage-labels／domain／codebase-map／ledger-commands／**host-runtime-map**／
  zcode-env）、`docs/adr/0001-overlay-persistent-and-inert.md`、`docs/changelog/2026-*.md` 分卷、
  `docs/dsh-bots-architecture.{html,json}` 与派生视觉件。
- 部署面：`$DSH_HOME/plugins/pod/lib/` 与本仓库 `lib/` **文件同名同尺寸**（`index.js` 158,531 B、
  `client.js` 216,658 B 等），即部署面是仓库工作树的镜像；本轮只比对文件名与字节数，**未做内容
  哈希**（§12）。

---

## 11. 对照表：组织住在哪、谁拥有状态、权威怎么建模、成本怎么治理、持久单位是什么

本表用于定位比较字段，不代表整表验收。可引用范围以票面Answer及对应补核件为准；
未验收字段只作来源线索，未采集到不等于功能不存在，二手内容保留来源级别。
研究票已限定收口，表中未列入Answer白名单的单元格仍不准入本图决策，dots全行弃用。

| 产品／方案 | 组织住在哪 | 状态归谁 | 角色／权威建模 | 成本治理 | 持久单位 |
|---|---|---|---|---|---|
| **OpenAI dots，全行未获一手核验** | 二手称每dot一台云电脑 [S7t] | 二手称厂商保存workspace与notes [S7t] | Custom Rules、auto-review与specialist身份均仅有二手转述，不能断言完整权威结构 [S7] | 套餐与用量描述仅二手；预算/终止机制未核，不写成不存在 [S7][S7d] | notes、Reset及任务寿命均待官方原文 [S7t] |
| **OpenAI Agents SDK** | **应用侧**；沙箱底座可选本地／Docker／7 家托管 provider [S10] | 应用侧（sessions 持久层，含 Encrypted 实现）；或 OpenAI 托管会话状态 [S10] | 两形态：**agents-as-tools**（manager 拥有最终答案）与 **handoffs**（专家直接接管，默认继承全历史）；handoffs **限制在单次 run**，guardrails 只覆盖链首/链尾 [S10] | `max_turns`＋`MaxTurnsExceeded`＋`error_handlers` 回退；官方给「orchestrate via code」作可预测的成本/速度手段 [S10] | **Session**（SQLite／Redis／Mongo／Encrypted／Conversations API 等）＋**文件式记忆**（`memories/MEMORY.md`、`memory_summary.md`、`rollout_summaries/`，遗忘阈值默认 256）＋ sandbox 快照 [S10] |
| **Anthropic多agent研究系统** | 2025工程博客的orchestrator-worker系统 [S1] | 状态部署位置未采；文中描述checkpoint [S1] | LeadResearcher、subagents与CitationAgent；同步批次限制只说明当时系统，不代表当前CLI [S1] | 作者经验值为chat的约4×/15× token，不是美元报价或配对组织收益；90.2%属异构内部eval，详见§4.1 [S1] | 外部记忆、干净上下文handoff与文件产物；未核具体存储实现 [S1] |
| **Claude Code subagents** | 项目/用户Markdown定义与Managed settings层 [S2s] | `memory`可配user/project/local；需auto memory启用 [S2s] | 普通实例不继承父历史，conversation fork例外；CLI深度3、并发20有版本与豁免条件，见§4.3 [S2s] | CLI的model/effort/maxTurns与SDK预算分开；`maxBudgetUsd`为含subagent的query级估算美元上限，默认不设 [S2sdk] | 三档记忆目录及启动注入界限见§4.3；目录定义不证明权限隔离 [S2s] |
| **Claude Code agent teams** | 用户本机teams/tasks目录；teammate共享主会话目录 [S2] | 任务清单本地持久；团队配置会话结束清理 [S2] | Lead固定、不嵌套、一会话一团队；权限边界为文档承诺 [S2] | 人数/任务数为建议；约7× token限plan-mode teammates对standard sessions，非通用费用倍率；未核团队硬预算 [S2][S2c] | team-name归属会话；task list可在config删除后留存 [S2] |
| **Cognition（Devin）** | 应用侧；**manager Devin ＋ child Devins 经内部 MCP 协调**[S9b] | 应用侧 [S9b] | **map-reduce-and-manage**：manager 拆活、子级执行、manager 汇总；非结构化 swarm「mostly a distraction」[S9b] | 未采集到预算机制；有跨模型**能力路由**与 generator–verifier 的成本/质量数据 [S9b] | 未采集到（核心约束是「writes stay single-threaded」）[S9b] |
| **A2A（Linux Foundation／AAIF）** | 外部互操作协议；治理与采用情况为项目公告归因 [S4][S4a] | 可用contextId分组并保留内部状态；客户端对服务端值应视为不透明 [S4] | 合同不要求公开内部编排，不等于没有team/supervisor；JWS签名可选 [S4] | 已读条目未核费用机制 [S4] | Task/Message由contextId关联；清理和存储策略由实现选择 [S4] |
| **Google ADK** | 应用内agent与SessionService；托管部署细节仍待验 [S5a] | 无前缀为session；user:限同一app_name，app:限应用，temp:限共享invocation [S5a] | coordinator和委派工具；task/single-turn只隔离模型所见分支事件，非共享状态/OS隔离；版本限制见§5.2 [S5a] | 预算未核；RequestInput可由无模型节点等人，未保证可靠性数值；callbacks仍待验 [S5a] | 持久性依SessionService，InMemory重启丢失；Memory/Rewind原采集未验 [S5a] |
| **Microsoft AutoGen（AgentChat）** | Team对象；官方已明确维护模式并鼓励迁移，见§6.2 [S6a][S6r] | Team跨run有状态，reset清空 [S6a] | RoundRobin及Swarm已读共享上下文行为，不能概括所有配置；其他模式细节待验 [S6a] | 官方建议先优化单agent；已核ExternalTermination轮末停止与示例handoff，全部计量条件待验 [S6a] | 跨run历史与上下文不等于进程重启恢复 [S6a] |
| **Microsoft Agent Framework** | 2026-08-25迁移页称single-process；截至采集日的分布式执行与Hosted VM细节仍未验 [S6m2][S6m4] | checkpoint存储可为进程内、本地盘或Cosmos；保存/恢复不等于分布式调度 [S6m3] | 已核Sequential、Concurrent、Handoff、Group Chat、Magentic模式目录；参数及progress ledger细节待验 [S6m] | 人工暂停概述已核；50回合、各内环上限和RequestPort精确规则仍待验 [S6m][S6m3] | superstep checkpoint含executor与pending/shared状态；Python 1.13.0起entry checkpoint支持回放，未做独立实验 [S6m3] |
| **LangGraph／LangChain** | 自定位 **orchestration runtime**；**你的 repo ＋ 你的数据库**（Agent Server 才由平台管持久化）[S7f][S7f2] | 应用侧：checkpointer（线程）＋ store（跨线程）[S7f2] | 官方把 **subagents 放在 Deep Agents 这一层**；**supervisor 已降级为模式**（官方建议直接用工具而非 `langgraph-supervisor` 库）；subagent 默认**无状态、干净上下文**[S7f2] | **`recursion_limit` 默认 1000 超步**（v1.0.6+）→ `GraphRecursionError`；`RemainingSteps` 做优雅降级 [S7f2] | **Checkpointer（线程级）＋ Store（跨线程）**；`MemorySaver` 重启即失，生产用 Postgres／SQLite [S7f2] |
| **CrewAI** | 应用侧 Crew／Flow 对象 [S7c] | 应用侧；Flow 状态用 `@persist`（**默认 SQLiteFlowPersistence**）[S7c] | **Process.hierarchical** ＋ `manager_llm`／`manager_agent`（manager 做 planning／delegation／validation，**任务不预先分配**）；委派是自动加的两个工具；另有一体化 `Memory` [S7c][S7c2] | 罕见地把治理写进概念层：**delegation 默认关闭**、**Max Requests Per Minute**、**Max Iterations**、Context Window Respect、`guardrail_max_retries`(3) [S7c2] | **Checkpoint**（全量 state＋memory/knowledge＋任务进度＋事件历史＋**lineage ID**，可 resume 或 fork）；记忆落**本地 LanceDB** `./.crewai/memory` [S7c2][S7c3] |
| **OpenAI Swarm** | 已废弃：README 自述「replaced by the OpenAI Agents SDK… for all production use cases」[S10] | 无（库已停更）[S10] | 它普及的原语：**handoff ＝一个返回 agent 的函数**（工具调用返回值）[S10] | 未采集到 [S10] | 未采集到 [S10] |
| **宿主 DSH Agent Teams** | **同一 DSH 进程内的会话**：TeamId＝Lead 的 SessionId，无项目级配置 [L3] | 用户本地：Lead 会话日志（`team/member`、`team/task`）＋各目标 Agent 自己的 inbox [L3] | **隐式 Lead（每个普通运行时根）**＋teammate；**只有 Lead 能生成/中断/改派**；roster 四态；名字永久不复用 [L3][L11] | fail-loud 上限：`maxMembers` 16（bundle 收窄为 8）、`maxTasks` 256、`maxMessageBytes` 64 KiB、`disposalTimeoutMs` 5 s；任务 CAS 防覆盖 [L3][L12] | Lead **会话日志**（log-only 协调事件，不进对话面）＋任务板 tombstone 保 id 稳定 [L3] |
| **dsh-team「团队模式」预设，历史对照** | 原采集为用户机器上的agent preset；现已删除，见§8.4 [L8] | 原采集无独立状态面，复用DSH会话／subagent [L8] | 原采集靠persona文本约束「只协调、不写代码」及7步流程，无独立账本／权限／编制面 [L8] | 只有persona文本里的软约束，讨论上限2–3轮 [L8] | preset是配置，不是独立持久状态 [L8] |
| **Pod（dsh-bots）** | **用户机器**：编制＝`$DSH_HOME/pod/bots.json`；每 bot 一个 DSH profile＋一个监听端口＋一个 `pod-workspaces/<bot>/` [L5][L10] | 用户本地：`ledger/`（events＋audit＋epoch＋idempotency＋lock）、`inbox/<bot>/`、`outbox/<bot>/`、`knowledge/`、`capabilities/`（issued＋nonces＋secret）[L10] | 编制字段含 **`post`／`role`／`permission`／`readOnly`／`group`**；权限以 profile patch **按 id 停用工具行**落地；另有 `role-cards`／`permissions`／`op-set`／`capability-*` 与 `org-ledger-authz` 测试面 [L9][L10][L14] | 本轮采集面**未定位到编制级预算/上限的落点**；有 `experiment-cost.js` 与 per-bot 模型配档 [L9][L14] | **台账事件**（`ledger/events.jsonl`＋`audit.jsonl`＋`epoch.json`）＋每 bot 工作目录＋知识索引 `knowledge/index.jsonl` [L10] |

表中各行保留各自来源层级，不能据表概括成「团队都随run生灭」或「都无工作区隔离」。
角色定义、任务清单、checkpoint与跨线程store可以持久，活动团队与持久状态不是同一对象。
已核的共享checkout限制只适用于宿主四包与Claude的teammate原语，后者的其他subagent支持worktree。
每bot一workspace也不自动保证写入串行、权限隔离或无共享外部副作用。
跨产品定位推断集中在§13；此表没有证明Claude不满足single-threaded writes，也没有证明Pod独有这些能力。

---

## 12. 盲区清单

本清单保留未核与访问记录。2026-10-14用户授权停止获取dots/Brown正文并限定收口，相关主张及
其余未验收字段均退出本图决策输入；盲区没有因此变成已核或有界空结果。当前采用范围只读票面Answer。

1. **dots正文未取得，已弃用于本图**：2026-10-13的官方入口失败，不能概括为当前全部OpenAI来源不可达。
   2026-10-14只新增搜索索引；官方页请求在权限交互期间中断，没有HTTP结果，不记为再次超时。
   SDK文档不能补位；访问失败或中断都不是有界空结果，见[缺口补核](supplements/04-openai-primary-gaps-20261014.md)。
   **后果**：§2功能断言仍为二手，dots的
   运行时实现细节（容器/VM、文件系统是持久卷还是可恢复快照、记忆存储格式、dot 间是否可能有协议）
   **无一手依据**。
2. **dots 价格数字冲突**：二手源分别出现「$100 起」与「$200/月」，均非一手；官方 Pro 500 价位未
   采集到。**本报告不采用任何具体价位。**
3. **Dwarkesh播客原文仍缺，已弃用于本图**：2026-10-13请求失败；本次没有新作者正文，也未重试作者站。
   两处中文转载一致不等于独立一手核验。英文措辞、上下文、时间戳及资源数字定义仍未知。
4. **AgentKit／Agent Builder 零可用材料**：cookbook 路径不可达、notebook 超时、
   `platform.openai.com/docs/guides/agent-builder` 403 → **任何 AgentKit 能力断言都不应从本报告
   得出**；OpenAI 官方「何时该用多 agent」独立指南页亦未找到（只有 SDK 的 orchestration 取舍
   文档 [S10]）。
5. **LangGraph 的 durability 模式名未核验**：官方 `/langgraph/durability` 页 **404**，只有
   `#durability-modes` 锚点存在 → `exit`／`async`／`sync` 语义无一手依据 [S7f2]。
6. **Google命名与未覆盖字段**：Agent Garden导航缺席、Agent Engine/Runtime改名、ManagedAgent、
   callbacks总数及MemoryService仍未验收，不从目录检索推出产品不存在或改名 [S5a]。
7. **Microsoft剩余缺口**：AutoGen维护模式已由2026-10-14官方README补齐 [S6r]；Framework准确
   GA日期、当前分布式执行范围与各SDK稳定性仍未核。checkpoint持久化不能代替执行拓扑证据。
   Magentic-One、默认50回合、稳定ID、progress ledger与Hosted agents等余项见补核覆盖表。
8. **Claude Code其余相关页未逐页复核**：已核subagents、SDK预算、skills、memory及总览的列明
   条目；完整hooks事件数和权限层级仍缺。cross-session messaging、agent-view、projects、
   workflows、routines、channels、goal、analytics细页仍为索引级或未验收状态，未核计费总账。
9. **Anthropic平台旧入口区域受限**：2026-10-13的`platform.claude.com/docs/...`转到区域不可用页。
   本次`code.claude.com/docs/en/agent-sdk/subagents.md`直接返回200，补核仅覆盖该SDK页，
   没有重试旧入口；API侧memory/tool权限等其余缺口保留 [S2sdk]。
10. **原采集的GitHub入口访问失败**：这不是当前全域状态，本批其他研究已取到部分官方仓库。
    本报告尚未补核`langgraph-swarm`等库的维护状态；原Swarm README的CDN来源层级保留 [S10]。
11. **宿主 22 个 `dsh-experimental-*` 中只读了 4 个 agent-team 包**；其余 18 个只记包名。其中
    **`dsh-experimental-auto-review`**（与 dots 的 auto-review 可能可比）、
    `dsh-experimental-tool-worktree`、`dsh-experimental-session-search`、
    `dsh-experimental-ralph-bundle` 值得单独采。
12. **`agent-presets-backup/team/` 与 `.agent-presets/bot-nopersona/`** 只采到路径与文件存在，未
    逐行读内容；与 `plugins/dsh-team/presets/team/` 的关系未核验。
13. **未采集 Pod 的运行时行为证据**：§10 只做静态清单，未跑探针、未读台账事件内容、未验证「在编
    2 bot」的实时健康状况。`bots.json` 只证明文件内容，不证明进程活着。
14. **未核对部署面与仓库面的一致性细节**：只比对同名文件与字节数，未做内容哈希；仓库 README 指明
    的现役一致性检查入口 `scripts/org-cutover-check.mjs` **本轮未运行**。
15. **无 2026-10-13 当日的运行时观测**：宿主 `0.2.1-alpha.2` 与各插件 `0.1.0` 都是文件时点，不
    代表进程在跑的是同一版本。
16. **未采集社区插件生态**：`$DSH_HOME/plugins/` 只反映本机个人插件；宿主是否有「社区 add-on
    registry」本轮零一手材料。
17. **搜索工具中途失效**：web_search 后端 `HTTP 402 Insufficient Balance`，后半程纯 fetch，部分
    追查（如 dots 安全白皮书是否存在）未做。这是2026-10-13的工具记录，不代表本次搜索状态。
18. **其余节未完成逐项验收**：§3.3、§7及§8–§10超出宿主五项边界的原采集仍不能当作整节已核。
    §4–§6也仅准入补核件明确定位的句子；未列内容从本图核心输入排除，不再补全原产品清单。
    本票按用户授权调整问题后收口，其他票的S1–S5保持，不能自动套用本票的范围调整。

---

## 13. 对 Pod 的差异化定位（推断）

以下是供定位票讨论的比较问题，不是架构裁定或产品排名。已核输入限票面Answer及
[宿主与Claude边界](supplements/04-host-and-claude-teams-20261013.md)、
[Anthropic余项](supplements/04-anthropic-remaining-facts-20261014.md)、
[Google/Microsoft字段](supplements/04-google-microsoft-facts-20261014.md)列明的内容。
Pod一侧仍按原采集静态清单[L9][L10][L14]引用，不把目录存在当成运行保证。

1. `INFERENCE:` 分开比较团队身份、活动生命周期和持久状态。宿主 TeamId 锚在 Lead 会话，
   Claude 团队也归属会话，但两者都有持久任务状态；角色定义与 checkpoint 另有生命周期。
   Pod 编制是否提供所需的跨会话连续性，要在这些对象上逐项对照，不能简化成「只有 Pod 持久」。
2. `INFERENCE:` 权限字段、角色文本、执行期授权和人工批准是不同机制。宿主明确区分协调政策
   与强制隔离，Claude 有生成后的权限调整及人工批准规则。Pod 的编制字段和工具停用记录
   只提供比较入口；权限强度须另核具体操作的强制路径，不能从字段名推出安全优势。
3. `INFERENCE:` 工作目录分开不等于写入串行。已核的共享 checkout 限制适用于宿主团队与
   Claude teammate，后者的其他 subagent 可用 worktree。Pod 的每 bot 工作区也不能单独证明
   无共享文件冲突或外部副作用，进程数与目录数不替代冲突、合并和恢复行为证据。
4. `INFERENCE:` 成本比较需区分人数、消息、步数与token/美元。Claude团队页未核货币硬上限，
   SDK另有query级估算预算；4×/15×与plan-mode约7×各有口径，不是可直接对比的美元成本。
   宿主资源上限和Pod静态清单均不支持预算优势判断。是否新增预算机制留给对应决议票。
5. `INFERENCE:` Lead、任务板与消息等已核重叠可作为定位讨论输入，不能据此排序最强竞争者、
   预测产品时间窗或宣布独有能力。审查拒绝、恢复和审计链的实际差异仍需同条件证据；
   dots与其余未验收材料不承担本图的定位、架构或收益结论。

---

## 14. 来源列表（URL／类型／日期）

类型口径：一手为厂商文档、公告、工程博客、源码或官方协议站；二手为新闻、转载、聚合站。
下表未另标日期的读取记录属于2026-10-13原采集；「协作代理采集」保留当时取得方式，
不代表主会话已经验收。2026-10-14的准入范围、原文定位与快照SHA以以下补件为准。

| 补核件 | 来源层级与本次结果 |
|---|---|
| [Anthropic余项](supplements/04-anthropic-remaining-facts-20261014.md) | A1–A5的官方正文指定条目；9份快照SHA复算一致，版本与数量限制逐项引用 |
| [Google/Microsoft字段](supplements/04-google-microsoft-facts-20261014.md) | 04-GM1–5的规范、文档与官方README；23份快照SHA复算一致，其中两份只是失败/跳转记录 |
| [OpenAI原文缺口](supplements/04-openai-primary-gaps-20261014.md) | 搜索索引及响应头两份SHA复算一致，没有新官方正文；请求中断不计服务器失败或空结果 |

**外部一手（厂商自有面）**

| 编号 | 来源（URL） | 日期 | 可达性 |
|---|---|---|---|
| S1 | anthropic.com/engineering/multi-agent-research-system | 2025-06-13（页面标注） | 200，正文已读 |
| S2 | code.claude.com/docs/en/agent-teams | 未标；引用 v2.1.281 等版本 | 200，正文已读 |
| S2s／S2k／S2m／S2h／S2p／S2c | code.claude.com/docs/en/{sub-agents,skills,memory,hooks,permission-modes,costs} | 未标；2026-10-14补核版本见A2–A5 | 指定subagents/skills/memory/costs字段已回读；hooks及完整权限页仍未验；约7×限plan mode |
| S2sdk | https://code.claude.com/docs/en/agent-sdk/subagents.md | 2026-10-14快照；SDK/CLI版本见A3 | 200；query预算与高扇出建议已回读，不代表其他平台SDK页可达 |
| S3 | code.claude.com/docs/en/agents | 未标 | 200，正文已读 |
| S5 | code.claude.com/docs/llms.txt（官方文档索引） | 采集时点 2026-10-13 | 200，566 行，仅作索引 |
| S4／S4a | a2a-protocol.org/latest/{topics/what-is-a2a,specification,topics/agent-discovery}；/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/（S4a，**2026-08-27**） | 规范标注 Latest Released Version 1.0.0 | S4 正文已读（渲染 HTML）；S4a 协作代理直读 |
| S5a | adk.dev/{workflows,workflows/collaboration,agents/routing,sessions,sessions/state,graphs/human-input,callbacks/types-of-callbacks,a2a/intro,agents/managed-agents,deploy/agent-runtime,tutorials/agent-team,sitemap.xml} | ADK 2.0.0／2.4.0 preview | 本会话读 workflows／collaboration／tutorial／sitemap；其余协作代理直读 |
| S6a | microsoft.github.io/autogen/stable/…（tutorial/teams、swarm、magentic-one）＋ pypi.org/pypi/autogen-agentchat/json | 未标 | 协作代理直读 |
| S6r | https://api.github.com/repos/microsoft/autogen/readme；https://api.github.com/repos/microsoft/agent-framework/readme | 2026-10-14；Git blob与SHA见04-GM4 | 官方API正文已读；AutoGen维护/迁移明确，Framework仅核README发布措辞与durable链接，不给GA日期 |
| S6m | learn.microsoft.com/en-us/agent-framework/{overview,workflows,workflows/orchestrations,workflows/human-in-the-loop} | Last updated 2026-08-25 | 200，正文已读 |
| S6m2／S6m3／S6m4 | learn.microsoft.com/en-us/agent-framework/{migration-guide/from-autogen,user-guide/workflows/orchestrations/*,workflows/checkpoints}；azure/foundry/agents/concepts/hosted-agents | migration更新2026-08-25；checkpoints更新2026-09-21 | 本次已回读执行措辞与checkpoint字段；编排细参数及Hosted agents未验 |
| S6c／S6g | learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-add-other-agents；azure/architecture/ai-ml/guide/ai-agent-design-patterns | 分别更新2026-10-01、2026-09-21 | 本次已回读复杂度建议及其适用条件，不作量化收益证据 |
| S7c／S7c2／S7c3 | docs.crewai.com/en/concepts/{crews,flows,processes,memory,collaboration,tasks}；/learn/hierarchical-process；/concepts/checkpointing | 文档版本 v1.15.27 | 本会话读 crews／processes／hierarchical／checkpointing；其余协作代理直读 |
| S7f／S7f2 | docs.langchain.com/oss/python/langgraph/overview；/oss/python/langchain/multi-agent(+subagents)；/langgraph/{graph-api,persistence,interrupts}；pypi.org/pypi/langgraph-supervisor/json | 未标；文中引用 v1.0.6 起默认值 | 本会话读 overview；其余协作代理直读（`/langgraph/multi-agent` 与 `/langgraph/durability` 均 **404**） |
| S9b | cognition.com/blog/multi-agents-working（Walden Yan）；关联 cognition.ai/blog/dont-build-multi-agents | **2026-04-22**（原文 **≈2025-06**） | 200，正文已读 |
| S10 | openai.github.io/openai-agents-python/（含 /multi_agent、/handoffs、/tools、/sessions、/human_in_the_loop、/running_agents、/sandbox/{guide,memory,clients}）；openai.github.io/openai-agents-js/；cdn.jsdelivr.net/gh/openai/swarm@main/README.md | 采集时点 2026-10-13 | 本会话直读核心页；其余协作代理直读 |

**外部二手（新闻／转载／聚合）**

| 编号 | 来源（URL） | 日期 | 可达性 |
|---|---|---|---|
| S7 | medianama.com/2026/10/223-openai-launches-dots-devday-2026/ | 2026-10-01 | 200，正文已读 |
| S7b | gigazine.net/news/20260930-openai-dots/ | 2026-09-30 | 协作代理采集（含官方 doc URL 线索） |
| S7t | blogs.techbytes.app/posts/what-are-openai-dots-complete-guide/ | 2026-09-29（09-30 更新） | 协作代理采集 |
| S7d | news.qiniu.com/archives/1790734403378 | 2026-09-30 | 协作代理采集 |
| S6／S6b | qbitai.com/2026/09/499654.html（量子位：Noam Brown访谈中文转载，指向dwarkesh.com/p/noam-brown）；hub.baai.ac.cn/view/58369（转载镜像） | 2026-09-30 | 原采集200、两处文字一致；不是独立一手核验 |
| S9 | subscriptioninsider.com/blog/openai-starts-dots-at-100-… | 未标 | **未取正文**，仅标题（价格口径与 S7 冲突，不采用） |

**OpenAI官方候选入口，正文未取得**

下列是2026-10-13的访问记录，不保证正文存在、URL标题或当前可达性。本次S13请求中断，见缺口补件。

| 编号 | 来源（URL） | 可达性 |
|---|---|---|
| S11 | openai.com/index/{introducing-dots,devday-2026-recap,introducing-gpt-6-1-sol}/ | **403（Cloudflare）**，未读到 |
| S12 | help.openai.com/en/articles/20001530-getting-started-with-your-dot | **403**；`help-lb.openai.com/ja-jp` 同路径亦 403 |
| S13 | learn.chatgpt.com/docs/dots、/docs/dots/{getting-started,tasks-and-memory,controls}、/docs/space/agents | **不可达**（DNS 可解析、连接不完成） |

**本地一手（只读采集；`$DSH`＝安装树，`$DSH_HOME`＝`~/.dsh`）**

| 编号 | 来源 | 时点 | 可达性 |
|---|---|---|---|
| L1 | `$DSH/package.json`（`@deepseek-ai/dsh` 0.2.1-alpha.2）、`$DSH/README.md`、`dsh --help` | 2026-10-13 12:39 | 已读 |
| L2 | `$DSH/node_modules/@deepseek-ai/dsh-experimental-{agent-team,agent-team-profile,tool-agent-team,client-ui-agent-team}/package.json` | 同上 | 已读 |
| L3 | `$DSH/node_modules/@deepseek-ai/dsh-experimental-agent-team/README.md` | 同上 | 已读 |
| L4 | `$DSH_HOME/plugins/*/package.json`（9 项） | 2026-08-18 ～ 2026-10-12 | 已读 |
| L5 | `$DSH_HOME/` 顶层、`.agent-presets/`、`agent-presets-backup/`、`pod/`、`pod-workspaces/`、`profiles/` 目录清单 | 2026-10-13 采集 | 已读（仅结构与文件名） |
| L6 | `$DSH_HOME/profiles/web/{package.json,node_modules/.package-map.json,cordis.yml}` | 2026-10-13 13:55／14:32 | 已读 |
| L7 | `$DSH_HOME/profiles/web/cordis.patch.yml` | 2026-10-13 14:32 | 已读 |
| L8 | `$DSH_HOME/plugins/dsh-team/presets/team/{preset.yml,agent.cordis.yml}` | 2026-08-27 前后 | 已读 |
| L9 | `$DSH_HOME/profiles/{duty-coordinator,implementer,x,headless,exp17v3-bare-duty}/cordis.patch.yml`、各 `profiles/*/package.json` | 2026-10-12 ～ 2026-10-13 | 已读 |
| L10 | `$DSH_HOME/pod/` 结构、`bots.json` 字段名与两条在编记录的组织字段 | 2026-10-13 15:23 | 已读（**仅结构与字段；未抄任何消息／会话／凭据内容**） |
| L11 | `$DSH/node_modules/@deepseek-ai/dsh-experimental-tool-agent-team/README.md` | 2026-10-13 | 已读 |
| L12 | `$DSH/node_modules/@deepseek-ai/dsh-experimental-agent-team-profile/{README.md,cordis.patch.yml,package.json}` | 同上 | 已读 |
| L13 | `$DSH/node_modules/@deepseek-ai/dsh-experimental-client-ui-agent-team/README.md` | 同上 | 已读（摘要与实现段） |
| L14 | 本仓库 `/home/beijong/project/dsh-bots`：`package.json`、`README.md`、`lib/` 与 `lib/org/` 清单、`scripts/`、`tests/`、`docs/`、只读 `git log -1`／`status --short`／`worktree list` | HEAD 2026-10-13 15:32:34 +0800 | 已读 |

### 14.1 2026-10-13失败路径与2026-10-14补核结果

以下项目符号保留原采集观察，只描述已试入口；补核取得的新官方入口不覆盖旧失败记录。

- **OpenAI**：`openai.com/index/*` 与本地化变体、`help.openai.com` 各语言路径、
  `developers.openai.com/api/docs/guides/agents/orchestration`（含 `.md`）、
  `platform.openai.com/docs/guides/agent-builder` → **403**；`learn.chatgpt.com/docs/dots*` →
  **连接永不完成**（`--resolve` 与第三方代理亦败，代理 522）；`cdn.openai.com/index/devday-2026-recap/`
  → **404 BlobNotFound**（根路径 404 而非 403，说明该域可达）。
- **镜像通路**：`r.jina.ai/...` 502；`archive.org/wayback/available?...` **502**；
  `web.archive.org/web/2026/...` **unsupported content type "unknown"**；`archive.ph` 502。
- **代码托管**：原采集请求的`github.com`与`raw.githubusercontent.com`入口返回HTTP 000；`openai/swarm`
  README 只能经 jsDelivr CDN 镜像取得。
- **播客**：`dwarkesh.com/p/noam-brown`（含 `/archive`、`/api/v1/posts/by-slug/...`）→ curl
  `code=000`／CONNECT tunnel 502。
- **Anthropic 平台文档**：`platform.claude.com/docs/...` → 经 curl 落到
  `claude.com/app-unavailable-in-region`（**区域不可用**）。
- **Google**：`google.github.io/adk-docs/agents/multi-agents/` → 跨域重定向到 adk.dev；
  `adk.dev/agents/multi-agents/`、`/workflows/multi-agent/`、`/agents/agent-team/`、
  `/workflows/graphs/` → **404**。
- **LangChain**：`/oss/python/langgraph/multi-agent`、`/multi-agent/overview`、
  `/oss/python/langgraph/durability` → **404**。
- **Microsoft**：`agent-framework/whats-new`、`devblogs.microsoft.com/foundry/agent-framework-ga/`、
  `microsoft-copilot-studio/{advanced-multi-agent,authoring-connect-agent}` → **404**。
- **搜索工具**：`web_search` 后端 `HTTP 402 Insufficient Balance`（中途失效，后半程纯 fetch）；
  DuckDuckGo HTML 端点亦 fetch failed。
- **浏览器通路**：`http://127.0.0.1:9222/json/version`连接失败；这是原采集观察，本次未重测浏览器、
  未读取登录态或绕过访问挑战。

2026-10-14新增结果：Anthropic的code.claude.com SDK页与Microsoft官方GitHub API取得正文；
原平台区域拒绝不重试。Google/Microsoft的重定向、404及最终入口见补件。
OpenAI仅取得搜索索引；官方页请求在权限交互期间中断且未产生HTTP响应文件，不能写成再次超时。
Noam Brown作者站本次未请求。两处仍未核，不计有界检索空结果；2026-10-14用户授权停止获取，
相关产品断言、访谈归因与数字均弃用于本图。
