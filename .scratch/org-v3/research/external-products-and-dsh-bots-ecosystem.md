# 外部产品组织原始语与本地 DSH 生态清单 —— 研究报告

- 日期：**2026-10-13**
- 票据：`TBD (wayfinder research ticket)`
- 性质：**建图前侦察（pre-chart reconnaissance）**。本文件不是终稿、不是决议；它是
  `org-v3` wayfinder 建图轮的预研产物，正式建图时该 effort 的 wayfinder map 会把它
  **收编为一张 research 票的交付物**（届时票号替换本行 `TBD`，结论按票面口径复核后方可引用）。
- 快照语义：只证明 **2026-10-13 采集时点**。外部产品迭代快，引用前回读 §14 来源。
- 标注：`[未经一手来源核验]`＝本轮未落到一手来源；`INFERENCE:`＝推断。事实与推断严格分开，
  推断集中在 §13。正文方括号编号指向 §14 来源表。
- 路径约定：`$DSH`＝`/usr/lib/node_modules/@deepseek-ai/dsh`（已安装宿主 **0.2.1-alpha.2**）；
  `$DSH_HOME`＝`~/.dsh`。
- 采集边界：**全程只读**。`~/.dsh` 与安装树零写入；未抄录任何会话、消息或凭据内容。
- 篇幅说明：**超出任务给定 300–500 行的目标（正文 §0–§13 约 810 行，§14 附录 89 行，合计 899 行）**。
  原因是本轮实采到的一手组织原语数量远超预期（Claude Code agent teams 落盘路径与限制清单、
  宿主 Agent Teams 的 CAS／log-only 语义、ADK 状态作用域前缀、Agent Framework checkpoint 与
  HITL 机制、Cognition 与 OpenAI SDK 的原文口径等）。已做过两轮压缩（删冗余引注、表格化、
  删重述），继续压缩将开始丢可核验事实。**建议由 wayfinder 票裁定**：或接受现篇幅，
  或把 §7 框架横向与 §14 附录拆成独立 artifact。

---

## 0. TL;DR

1. **OpenAI「dots」是厂商云上的常驻 agent，不是用户自有的进程团队**：每 dot 一台「云电脑」
   （沙箱 workspace，维护中的 Linux ＋ Chrome），不等 prompt 继续干活；协调与安全强制的系统
   **在 dot 够不到的地方**运行 `[未经一手来源核验]` [S7][S7t][S7d]。**落地形态与本项目正相反。**
2. **dots 唯一沾「组织」的是试点 specialist dots**：给 dot 公司身份、凭据、IT 配发硬件与公司
   系统访问权，由 **OpenAI 工程师与客户共同定义**职责、工具与审批流程 `[未经一手来源核验]` [S7]。
   →「岗」是厂商交付的定制服务，不是用户可版本化、可审计的编制。
3. **dots 的组织原语是权限分层**：Custom Rules 三态（allow／require approval／block）
   ＋ auto-review ＋ Activity View ＋ 内建安全监控 `[未经一手来源核验]` [S7]。授权者是**人**；
   隐患是 **Pause 只暂停主任务、不自动停所有后台任务**，删 dot 不撤回已发消息、不回滚外部改动
   `[未经一手来源核验]` [S7d]。
4. **OpenAI 的多 agent 立场是「去脚手架」**（Noam Brown，Dwarkesh 播客 ≈2026-09-17）：重 scaffold
   的「协调者分派、sub-agent 交回」有硬伤——**两个拿到相似任务的 sub-agent 通常不能互相通信，
   这就非常低效**；OpenAI 只给「给另一个 agent 发消息」这一件原始工具，让协调方式涌现，「很像
   人类在 Slack 上的工作方式」[S6][S6b]。
5. **同一访谈给出反向证词并自认证据薄**：「**我甚至不会把其中 10% 的功劳记在多智能体头上**」；
   主因是模型本身够强；规模化只测到 ~16 agent，1 万 agent 是**单个数据点、无消融**，「眼下
   1 万个人的协调能力强于 1 万个 Agent，完全有可能」[S6][S6b]。
6. **最强一手反面论证来自 Cognition**（自家博客 2026-04-22）：「multi-agent systems work best today
   when **writes stay single-threaded** and the additional agents **contribute intelligence rather
   than actions**」；「the unstructured-swarm approach … **is mostly a distraction**. The practical
   shape is **map-reduce-and-manage**」；并给出负面结果（跨 agent 通信「doesn't happen by
   default」、小模型当 primary 时 Smart Friend 方案失败）[S9b]。**《Don't Build Multi-Agents》
   日期是 ≈2025-06，不是 2025-10**（其后续文自述「10 months ago」）[S9b]。
7. **本轮最强同构外部产品是 Claude Code `agent teams`**（实验性、默认关闭）：team lead ＋ 各自
   独立上下文窗的 teammates ＋ 共享 task list（lead 指派或自领、文件锁防抢）＋ mailbox 点对点
   消息 ＋ 人类可直接找任一 teammate 说话 [S2]。
8. **但它三条硬限制恰好都在 Pod 的差异化象限里**：① **不做工作区隔离**——「Agent teams don't
   isolate teammates in worktrees, so partition the work so each teammate owns a different set of
   files」[S3]；②「**No nested teams**」「**Lead is fixed**… can't transfer leadership」「**One team
   per session**」[S2]；③ **生成时不能按 teammate 设权限模式** [S2]。反讽的是 **OpenAI 自家 SDK
   文档把「每个 sub-agent 一个独立 workspace」列为正当用法** [S10]。
9. **本地已有两条「团队」实现，都不是本项目**：宿主自带实验包族
   `@deepseek-ai/dsh-experimental-agent-team*`（0.2.1-alpha.2）[L2][L3][L11][L12]，与个人插件
   `$DSH_HOME/plugins/dsh-team`（0.1.0，「团队模式」preset）[L4][L8]。Pod 是第三条：
   `$DSH_HOME/plugins/pod`（部署面）／本仓库（开发面），以 `bots` 为 id 接入现役 web profile [L7]。
10. **宿主团队 vs Pod 一句话**：宿主团队是**会话内的隐式团队**（「每个普通运行时根就是它自己 Team
    的隐式 Lead」，TeamId＝SessionId，同工作目录协作，明确不支持独立工作目录与跨进程协调）[L3]；
    Pod 是**跨进程的编制团队**（每 bot 一个 DSH profile 与一个端口，编制落在 `bots.json`）[L5][L10]。
11. **成本治理是外部同类的共识挂点**（Pod 采集面上最薄）：Anthropic 给 15× 标价＋按复杂度写死的
    scaling rules [S1]；Claude Code 给「3–5 人起、每人 5–6 任务」＋**约 7× token**（plan 模式
    teammates）＋ SDK 的 `maxBudgetUsd` [S2][S2c]；宿主 Agent Teams 给四个 fail-loud 上限 [L3][L12]；
    CrewAI 把 **delegation 默认关闭**、`max_rpm` 写进概念层 [S7c2]；LangGraph 给 `recursion_limit`
    （默认 **1000** 超步）[S7f2]。

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

**采集状态（先声明）**：openai.com 与 help.openai.com 文章页一律 **403**（Cloudflare，含浏览器 UA
与多语言路径的 curl 与 web_fetch）；`developers.openai.com/api/docs/guides/agents/orchestration` 403；
`platform.openai.com` 403；`learn.chatgpt.com/docs/dots*` **DNS 可解析但连接永不完成**（直连与第三方
代理均败，代理返回 522）；archive.org／archive.ph／r.jina.ai 全为 **502**；本机无 CDP 浏览器
（`127.0.0.1:9222` 无监听）；`cdn.openai.com` 可达但不镜像文章正文。**因此本节全部功能断言为二手**，
逐条带 `[未经一手来源核验]`。

| 维度 | 采集到的内容（[S7] MediaNama 2026-10-01 逐条转述官方公告与 FAQ；[S7b] GIGAZINE；[S7t] Tech Bytes，细节最深；[S7d] 七牛云，引官方 doc URL） |
|---|---|
| 功能 | 常驻 agent，**不需要 prompt 就继续任务**；底座 **GPT-6 Astra**；示例：发现 Slack 里的 bug 报告 → 调查 → 写并测试修复 → 开 PR（OpenAI 称自家工程师的 dots 每天修数十个 bug）`[未经一手来源核验]` |
| always-on 机制 | **「Proactive research」**：空闲时扫描已连接应用、把发现写成**只给自己的私人笔记**；此状态可用工具**只读**（不能发消息、不能改已连接应用、不能驱动浏览器）`[未经一手来源核验]` [S7t] |
| 云运行时 | 每 dot **自己的「云电脑」**（沙箱 workspace，维护中的 Linux ＋ Chrome），可进去实时看它干活；**代码与工具被限制在 workspace 内、每个用户环境互相隔离、协调与安全强制系统在 dot 够不到的地方**（dot 关不掉自己的检查）`[未经一手来源核验]` [S7t]。**容器 vs VM 未定**：仅二手单源（4sysops，Cloudflare 403 未取正文）称 9 vCPU AMD EPYC VM `[未经一手来源核验]` → 按「OS 级隔离的每用户云 workspace」建模 |
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

### 3.1 「贡献不到 10%」的原始出处（已定位，载体本轮不可达）[S6][S6b]

- **一手载体**：Dwarkesh Patel 播客 **《Noam Brown – Agent swarms, alignment, & recursive
  self-improvement》**，受访者 **Noam Brown**（OpenAI 研究员，o1 线奠基者之一，当前方向为多智能体）；
  形态＝**视频＋音频＋已发布文字稿**（Substack 帖），日期 **≈2026-09-17**（Techmeme `260917/p43`；
  36kr 英文版 2026-09-18）[S6]。
- **可达性**：`dwarkesh.com/p/noam-brown` 本轮 curl `code=000`、web_fetch fetch failed。引语经
  **两处独立中文逐字转载交叉核验**（[S6] 量子位 2026-09-30／[S6b] BAAI hub 镜像，正文一致）。
  → **原始出处已定位、原始载体未读，无逐字英文**。
- 逐字要点：① 「解出千禧年大奖难题，靠的不是多智能体。**我甚至不会把其中 10% 的功劳记在多智能体
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

- **官方命名「orchestrator–worker pattern」**：`LeadResearcher` 先**把计划存进 Memory**（因「if the
  context window exceeds 200,000 tokens it will be truncated」）→ 并行创建 subagent → 综合 →
  按需再起 → 末尾 `CitationAgent` 做引用归属。
- 效能与代价：多 agent（Opus 4 lead ＋ Sonnet 4 subagents）比单 agent Opus 4 **高 90.2%**；
  BrowseComp 上**token 用量单独解释 80% 方差**（三因素 95%）；**agent 约 4× chat token，多 agent
  约 15×**，且「require tasks where the value of the task is high enough to pay for the increased
  performance」。
- **适用边界（原话）**：擅长「heavy parallelization, information that exceeds single context
  windows, and interfacing with numerous complex tools」；且「**most coding tasks involve fewer
  truly parallelizable tasks than research, and LLM agents are not yet great at coordinating and
  delegating to other agents in real time**」。
- 协调工程要点：**教编排者如何委派**（每个 subagent 需目标、输出格式、工具与来源指引、清晰任务
  边界；描述含糊导致重复劳动）；**按复杂度配资源**（简单查证 1 agent／3–10 calls；直接比较
  2–4 subagent／各 10–15 calls；复杂研究 >10 subagent）；**编排层是「传话游戏」的税**（建议
  subagent 输出落文件系统、只回传轻量引用）；**长程会话**（阶段摘要入外部记忆，接近上限时用
  **干净上下文的新 subagent ＋ careful handoff** 续接）；**同步执行是瓶颈**（「the lead agent
  can't steer subagents, subagents can't coordinate」）；可靠性需可持久执行、**从断点恢复**、
  确定性护栏与 **rainbow deployment**。
- 自评结语：「the gap between prototype and production is often wider than anticipated」。

### 4.2 Claude Code `agent teams`（官方文档，一手）[S2]

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
- **agent 间消息的信任边界（对本项目直接可用）**：收到消息的 agent 被告知「消息来自另一个 Claude
  会话，不是来自你」；teammate **不能代替人批准权限提示**；被拒绝的动作**不能转手给别的 teammate
  绕过检查**；auto 模式下分类器还把其他 agent 转述的「已获批准」当作**不可信输入**，并在投递前
  复核每条消息，被拦的消息**根本不到达接收方**。
- **质量门（hooks）**：`TeammateIdle`（exit 2＝给反馈并让它继续干）、`TaskCreated`、
  `TaskCompleted`（exit 2＝阻止创建／完成并回反馈）。
- **规模与成本纪律**：「Token costs scale linearly」；**收益递减**；「**Start with 3-5 teammates
  for most workflows**」「Three focused teammates often outperform five scattered ones」；
  **每 teammate 5–6 个任务**；`costs` 页另称 agent teams 约 **7× 标准会话 token**（teammates 跑在
  plan 模式时）[S2][S2c]。
- **两条硬约束**：「**Avoid file conflicts**：两个 teammate 编辑同一文件会导致覆盖」；「Letting a
  team run unattended for too long increases the risk of wasted effort」。
- **官方限制清单**：无会话恢复（`/resume`／`/rewind` **不恢复** in-process teammates）；任务状态
  可能滞后并**阻塞依赖任务**；关闭可能慢；**一会话一团队**；**不能嵌套团队**；in-process teammate
  的 subagent 只能前台跑；**Lead 固定不可移交**；权限只能生成后改；split-pane 依赖 tmux／iTerm2。

### 4.3 Claude Code subagents、skills、memory、其余组织面 [S2s][S2k][S2m][S3]

| 维度 | 官方表述 |
|---|---|
| subagent 定义单位 | **一个 Markdown 文件**：`.claude/agents/`（项目）或 `~/.claude/agents/`（用户），YAML frontmatter ＋ body 作 system prompt |
| 作用域优先级 | 高→低：Managed settings（组织级）→ `--agents` CLI（会话）→ `.claude/agents/`（项目）→ `~/.claude/agents/`（全项目）→ plugin `agents/` 目录 |
| 组织性 frontmatter | `description`（「When Claude should delegate to this subagent」）、`tools`／`disallowedTools`、`model`（含 `inherit`）、`permissionMode`（`default`／`acceptEdits`／`auto`／`dontAsk`／`bypassPermissions`／`plan`／`manual`）、`maxTurns`（超限产出标记为 partial 且可 resume）、`skills`（**全文注入**）、`mcpServers`、`hooks`、**`memory`（`user`／`project`／`local`）**、`background`、`effort`、**`isolation: worktree`** |
| 每 subagent 持久记忆 | `user`→`~/.claude/agent-memory/<agent>/`；`project`→`.claude/agent-memory/<agent>/`；`local`→`.claude/agent-memory-local/<agent>/` |
| 上下文隔离（逐字） | 「Each subagent runs in its own context window with a custom system prompt, specific tool access, and independent permissions. It also sends its own requests, which count toward the same usage limits as your main conversation.」父会话历史**不继承** |
| 嵌套与并发硬上限 | 深度默认 **3 层**（`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`，设 `1` 关闭嵌套）、并发默认 **20**（`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`）、**花费上限** `maxBudgetUsd`（超限拒绝 spawn，报 `error_max_budget_usd`）；极高扇出时官方改推 `Workflow` 工具（脚本化编排、在会话上下文之外执行） |
| skills | `SKILL.md` ＋ frontmatter（`name`／`description`／`when_to_use`／`allowed-tools`／`model`／`effort`／`context: fork`／`hooks`／`paths`…），遵循 **agentskills.io** 的 Agent Skills 规范；**渐进披露**明确到数字：「the combined `description` and `when_to_use` text is truncated at **1,536 characters** in the skill listing」；`context: fork` 让技能在自己的 subagent 上下文里跑 |
| memory／CLAUDE.md | 四层作用域 **Managed policy**（`/etc/claude-code/CLAUDE.md` 等）／**User** `~/.claude/CLAUDE.md`／**Project** `./CLAUDE.md`／**Local** `./CLAUDE.local.md`；加载是**拼接而非覆盖**（「All discovered files are concatenated into context rather than overriding each other」，从文件系统根向下到工作目录）；子目录 CLAUDE.md 惰性加载；`AGENTS.md` **仅当** cwd 及其上层无 `CLAUDE.md`／`CLAUDE.local.md` 时才读 |
| 五种并行方式 | **Subagents**（单会话内受委派工人）／**Agent view**（`claude agents` 一屏派发与监控后台会话；research preview）／**Agent teams**／**Projects**（持续对话，Claude 起并行 **threads**，云端或按需经 Remote Control 在你机器上跑）／**Dynamic workflows**（脚本跑多 subagent 并交叉核验） |
| 三个支撑件 | **Worktrees**（每会话独立 git checkout；**你生成的 subagent 也可各得一个**）／**Cross-session messaging**（给本机／另一台机器／云端的其他会话发消息）／**`/batch`**（切成 5–30 个 worktree 隔离 subagent 的技能） |
| 关键原话 | 「**Agent teams don't isolate teammates in worktrees**, so partition the work so each teammate owns a different set of files」；多会话／多 subagent **成倍放大 token** |
| hooks 与权限模式 | hooks 30+ 事件（含 `SubagentStart`／`SubagentStop`／`TaskCreated`／`TaskCompleted`／`TeammateIdle`／`PreCompact`／`SessionEnd`）；六种 permission mode 的层级语义 [S2h][S2p] |

仅采到索引级描述（正文未逐页读，见 §12）：cross-session messaging、agent-view、scheduled tasks
（`/loop`＋cron）、routines、channels、goal、analytics [S5]。

---

## 5. Google

### 5.1 A2A（官方协议站与官方博客，一手）[S4][S4a]

- **治理**：2026-08-27 官方公告称 A2A 被接受为 **Agentic AI Foundation（AAIF）Growth Stage
  项目**，运行在 **Linux Foundation 指导的 AAIF** 之下，与 **MCP、goose、AGENTS.md** 并列，
  「protected from single-vendor constraints」；站点版权行 **Copyright 2026 The Linux
  Foundation**（Apache-2.0）。
- **成熟度（官方原话）**：自 **v1.0** 稳定规范以来「currently backed by **over 150
  organizations**」，生产上跑在供应链、金融服务、移动平台；**Google Cloud、AWS Bedrock
  AgentCore Runtime、Microsoft Azure AI Foundry** 均已有原生 A2A 支持；点名的框架有 LangGraph、
  CrewAI、Pydantic AI、AG2、IBM BeeAI。规范页标注 **「Latest Released Version 1.0.0」**，
  线上字段 `protocolVersion: "1.0"`。
- **核心对象**：`AgentCard`（name／description／**supportedInterfaces**
  `[{protocolBinding: JSONRPC|GRPC|HTTP+JSON, protocolVersion, url}]`／provider／version／
  capabilities／securitySchemes／**skills**（`AgentSkill`）／**JWS signatures**）；`Task` 状态机
  `TASK_STATE_*`（SUBMITTED／WORKING／COMPLETED(terminal)／FAILED…）；**`contextId`**＝「an
  identifier that logically groups multiple related Task and Message objects, providing
  continuity across a series of interactions」，服务端生成的 contextId 对客户端**不透明**；
  agent 可据它保存「internal state, conversational history, or LLM context」；**mid-task 追加
  输入**：把任务转为 `input-required` 状态。
- **发现**：规范 well-known URI ＝ **`https://{agent-server-domain}/.well-known/agent-card.json`**
  （遵循 RFC 8615 原则），另有策展注册表与直接/私有配置；Agent Card 可受保护、可签名、可缓存。
- **设计原则（逐字）**含「**Opaque Execution**: Agents collaborate based on declared capabilities
  and exchanged information, without needing to share their internal thoughts, plans, or tool
  implementations」；MCP 关系被官方表述为「**MCP 是纵向集成层**，**A2A 是横向协议**」。
- **组织含义（事实层面）**：A2A 把「组织」外置为**能力声明＋任务生命周期＋认证边界＋分组
  contextId**；**不定义角色、汇报线、编制或审批岗**——没有 supervisor、没有 team、没有内部权威层。

### 5.2 ADK（官方文档，一手；宿主已迁 `adk.dev`）[S5a]

| 维度 | 官方表述 |
|---|---|
| 工作流 taxonomy | **Graph-based**（2.0+）、**Dynamic**（2.0+）、**Collaborative**（2.0+，「a single agent to act in a dynamic **coordinator** role to accomplish tasks with a set of specified sub-agents」）、**Template**＝`SequentialAgent`／`ParallelAgent`／`LoopAgent`；**Agent Routing**（`RoutedAgent`）**experimental**。官方动因含「**limiting data contexts for given tasks**」；站点横幅称「ADK TypeScript 2.0 GA … with **graph workflows** support」 |
| sub-agents／handoff | 在 coordinator 上声明 `sub_agents=[...]` → **「Auto-inject delegation tools named after each subagent」**；subagent 带 `mode`：**`chat`**（默认，完整用户交互，**manual** 经 `transfer_to_agent` 交回）、**`task`**（澄清型 HITL，**automatic** 经 `finish_task` 交回）、**`single_turn`**（无用户交互，自动交回，**可并行**） |
| 上下文隔离（逐字） | 「Each `task` or `single-turn` mode agent operates in its own **isolated session branch** … each agent only sees events from its own branch when building context for AI model calls, **and cannot see what its peer agents are doing**. Once all parallel branches complete, the parent agent receives the collected results」；已知限制含「`Task` mode agents must be leaf agents and cannot have subagents」 |
| Session／State／Memory | `Session`＝「a single, ongoing interaction」持 `Events`；`State`＝会话内草稿板；`Memory`＝「searchable, cross-session information」；服务为 **`SessionService`** 与 **`MemoryService`**；实现有 `InMemorySessionService`（重启即失）、`DatabaseSessionService`、`VertexAiSessionService` |
| 状态作用域前缀 | 无前缀＝当前 session；**`user:`**＝该 `user_id` 跨全部 session；**`app:`**＝该应用**全部用户与 session** 共享；**`temp:`**＝仅当次调用。且「When a parent agent calls a sub-agent… it passes its `InvocationContext` … the entire chain of agent calls **shares the same invocation ID and, therefore, the same `temp:` state**」 |
| HITL 是图节点 | `yield RequestInput(...)` 暂停工作流；官方称「These nodes do not require artificial intelligence (AI) models to run, which can make the input process **more predictable and reliable**」；默认 `rerunOnResume: false` |
| Callbacks | 六个钩子——Before/After **Agent**、Before/After **Model**、Before/After **Tool**；官方把 `before_model`／`before_tool` 描述为实现「safety, validation, **policy enforcement**」的钩子 |
| managed 面 | `ManagedAgent`（**Preview**）「connects to a managed agent … that runs in a **specialized, server-side execution environment**」；部署到 **Google Cloud Agent Runtime** 即把 sessions／state 交给托管基础设施（「Agent Runtime is a paid service」）。**Vertex AI「Agent Engine」现以 Agent Runtime／Agent Platform 出现**；**「Agent Garden」在现行 adk.dev 导航中不存在** `[未经一手来源核验]` |
| Google 自己的「别用 A2A」准则 | 「**When NOT to use A2A** … prefer local sub-agents」用于内部代码组织、性能关键的内部操作、以及「**Shared Memory/Context**」；并称本地 sub-agent「are like internal modules or libraries … Communication … is very fast because it happens directly in memory, without network overhead」 |

---

## 6. Microsoft

### 6.1 AutoGen（官方渲染文档，一手）[S6a]

| 维度 | 官方表述 |
|---|---|
| 分层 | `autogen-core`＝「An event-driven programming framework for building scalable multi-agent AI systems」；`autogen-agentchat`＝高层 API，提供「Agents with preset behaviors and **Teams** with predefined multi-agent design patterns」 |
| Team 目录（逐字） | `RoundRobinGroupChat`／`SelectorGroupChat`（用模型选下一个发言者）／`MagenticOneGroupChat`／**`Swarm`**（用 `HandoffMessage` 表示 agent 间转移）；导航另有 **GraphFlow（Workflows）** |
| 默认是共享黑板 | 「`RoundRobinGroupChat` … **all agents share the same context** and take turns responding… Each agent, during its turn, broadcasts its response to all other agents」 |
| 控制流原语 | termination condition：`TextMentionTermination`、`TextMessageTermination`、`ExternalTermination`、`HandoffTermination`，可用 `|`／`&` 组合（教程另有 max-message／token 两类条件） |
| 持久单位 | 「Teams are stateful and maintains the conversation history and context after each run, unless you reset the team. You can resume a team … by calling the `run()` or `run_stream()` method again without a new task」；`team.reset()` 清空 |
| Swarm 的 handoff（逐字，含风险） | 「The `AssistantAgent` uses the **tool calling** capability of the model to generate handoffs… If the model does parallel tool calling, **multiple handoffs may be generated at the same time. This can lead to unexpected behavior.**」（修法：`parallel_tool_calls=False`） |
| 人怎么进拓扑 | 把 `"user"` 当 handoff 目标——用户回复以 `HandoffMessage` 送回团队并**定向到原本请求人工输入的那个 agent**（`HandoffTermination`） |
| Magentic-One（逐字） | 「Magentic-One's Orchestrator agent creates a plan, delegates tasks to other agents, and tracks progress towards the goal, dynamically revising the plan as needed」；可派给 `FileSurfer`／`WebSurfer`／`Coder`／`Computer Terminal`；风险提示含「**Human Oversight**: Run the examples with a human in the loop」「Limit Access」 |
| 从简准则（逐字） | 「**start with a single agent for simpler tasks, and transition to a multi-agent team when a single agent proves inadequate.**」 |

### 6.2 Microsoft 是否把用户引离 AutoGen、以及 Agent Framework 的组织原语 [S6m][S6m2][S6m3][S6m4]

- **是，转向 Microsoft Agent Framework。**迁移指南逐字：「It represents a significant evolution of
  the ideas pioneered in AutoGen … developed by **the core AutoGen and Semantic Kernel teams** …
  designed to be a **new foundation**」；架构差异「AutoGen pairs an **event-driven core** with a
  high-level **Team**. Agent Framework centers on a **typed, graph-based Workflow**」；「AutoGen
  offers embedded and **experimental distributed runtimes**. Agent Framework focuses on
  **single-process composition today; distributed execution is planned.**」；概览页称
  「**Agent Framework is the next generation of both Semantic Kernel and AutoGen**」。
  **「AutoGen 处于维护模式」的明文表述未在渲染文档中找到**（`microsoft/autogen` README 因 GitHub
  不可达未取）→ `[未经一手来源核验]`；**Agent Framework 的 GA 日期亦未核验**。
- **Agent Framework 组织原语**：

| 维度 | 官方表述 |
|---|---|
| 五种编排模式 | **Sequential**／**Concurrent**／**Handoff**（按上下文互相转移控制）／**Group Chat**（共享会话协作）／**Magentic**（「A manager agent dynamically coordinates specialized agents」） |
| handoff vs agent-as-tool | 「In handoff orchestration, the conversation is handed off to another agent entirely. **The receiving agent has full context of what has been done so far.** In agent-as-tools, the primary agent manages the overall context…」默认交互式（把控制权交回你），`WithAutonomousMode()` 才自动跑，**默认每 agent 上限 50 个自主回合**；**持久 handoff 需要 checkpointing ＋ 稳定 agent id** |
| Group Chat | `GroupChatBuilder(participants=…, termination_condition=…, selection_func=…)`，也可换成**用完整 agent 当编排者**（`orchestrator_agent`，「a full Agent with access to tools, context, and observability」） |
| Magentic | `MagenticWorkflowBuilder(managerAgent).AddParticipants([...])`，暴露内环上限（`WithMaxRounds`／`WithMaxStalls`／`WithMaxResets`）与 **HITL 计划签核**（`RequirePlanSignoff`）；自定义 `progress_ledger_prompt` **必须保留内建 JSON schema** → **progress ledger 就是编排者的共享状态产物**；该类型标记为实验性 |
| Checkpoint ＝耐久单位 | 「workflows are executed in **supersteps**… Checkpoints are created at the end of each superstep」；checkpoint 捕获「current state of all executors… all pending messages… pending requests and responses… **shared states**」；provider：`InMemoryCheckpointStorage`／`FileCheckpointStorage`／`CosmosCheckpointStorage`；Python ≥1.13.0 起 entry checkpoint 使运行**可回放** |
| HITL 两条机制 | ① **tool approval**（「Agents can use **approval-required tools** that pause the workflow for human review before execution」；Harness Agent 另有 don't-ask-again tool approval）；② **`RequestPort`**——executor 向外发请求并等响应，`RequestPort` 发 **`RequestInfoEvent`**，框架**按原始请求把响应自动路由回对应 executor** |
| 组织也住服务端 | Foundry Agent Service **Hosted agents** 跑「containerized agentic AI applications」（可用 Agent Framework／LangGraph／Semantic Kernel／自研），「Hosted agents run in **per-session VM-isolated sandboxes**. Each session gets a dedicated sandbox with a persistent filesystem (`$HOME` and `/files`)… **The platform handles scaling, session state persistence, observability, and lifecycle management**」 |

### 6.3 Copilot Studio 与复杂度治理（官方文档，一手）[S6c][S6g]

- **何时拆（逐字）**：当 agent 区分工具的能力开始退化时考虑拆成多个 connected agents——「As a rule
  of thumb, this degradation in performance can happen when your main agent has **more than 30-40
  choices of action**」；其他理由含多团队独立维护、**各自专属设置（如模型）**、独立 ALM、可复用。
  拓扑＝父「main agent」编排，子级分 **child agents**（内部）与 **connected agents**（单独发布）。
  **组织的代价（逐字）**：「Increase latency due to the extra orchestration hops… Increase the
  testing, management, and governance surface area for a solution」。
- **最优复杂度准则（逐字）**：「Before you adopt a multiagent orchestration pattern, evaluate whether
  your scenario requires one… **Use the lowest level of complexity that reliably meets your
  requirements.**」阶梯＝Direct model call → Single agent with tools（「Often the right default for
  enterprise use cases… To guard against infinite tool-call loops, set iteration limits」）→
  Multiagent orchestration（「Adds coordination overhead, latency, and failure modes…」）；每个模式
  另有 "When to avoid"。

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

### 8.4 `$DSH_HOME/plugins/`（个人插件面，9 项）[L4]

| 目录 | name | version | 结构要点 |
|---|---|---|---|
| `pod` | `pod` | 0.1.0 | 部署面 Pod：`lib/`（含 `lib/org/`）、`scripts/`、`tests/`、`.scratch/` |
| `dsh-bots` | `dsh-bots` | 0.1.0 | 旧名留存（含 CHANGELOG／PROJECT_UNDERSTANDING／PLAN／PROPOSAL） |
| `dsh-bots-backup-20260829` | `dsh-bots` | 0.1.0 | 2026-08-29 备份件 |
| `dsh-team` | `dsh-team` | 0.1.0 | **带 `presets/team/`（`preset.yml`＋`agent.cordis.yml`）**；peer `dsh-commands`／`dsh-llm`／`cordis` |
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

> 「权威建模」「成本治理」只填**采集到的官方表述**；无一手依据写 `未采集到`，不臆测。

| 产品／方案 | 组织住在哪 | 状态归谁 | 角色／权威建模 | 成本治理 | 持久单位 |
|---|---|---|---|---|---|
| **OpenAI dots** | **厂商侧云服务**（每 dot 一台「云电脑」；协调与安全强制在 dot 够不到的地方）`[未经一手来源核验]` [S7t] | 厂商（云电脑、dot 的 notes）；用户只控连接与规则 [S7t] | 无组织内权威层；人是唯一授权者（Custom Rules 三态＋auto-review）；specialist dots 有公司身份/凭据但职责与审批由 OpenAI 工程师与客户共同定义 `[未经一手来源核验]` [S7] | 首 dot 含在套餐、对话不计 ChatGPT 上限、Codex/Work 任务计入；按 speed 或月度 workload 扩容（未上线）`[未经一手来源核验]` [S7][S7d]；**无公开的 token 预算/终止条件机制** | 未采集到（dot 的 notes 不可逐条审计，只能 Reset）[S7t] |
| **OpenAI Agents SDK** | **应用侧**；沙箱底座可选本地／Docker／7 家托管 provider [S10] | 应用侧（sessions 持久层，含 Encrypted 实现）；或 OpenAI 托管会话状态 [S10] | 两形态：**agents-as-tools**（manager 拥有最终答案）与 **handoffs**（专家直接接管，默认继承全历史）；handoffs **限制在单次 run**，guardrails 只覆盖链首/链尾 [S10] | `max_turns`＋`MaxTurnsExceeded`＋`error_handlers` 回退；官方给「orchestrate via code」作可预测的成本/速度手段 [S10] | **Session**（SQLite／Redis／Mongo／Encrypted／Conversations API 等）＋**文件式记忆**（`memories/MEMORY.md`、`memory_summary.md`、`rollout_summaries/`，遗忘阈值默认 256）＋ sandbox 快照 [S10] |
| **Anthropic 多 agent 研究系统** | 应用内编排（官方名 **orchestrator–worker pattern**）[S1] | 未采集到（提到可恢复执行与 checkpoint）[S1] | LeadResearcher＋并行 subagent＋CitationAgent；**lead 不能 steer subagent、subagent 之间不能协调**；计划存 Memory 防 200k 截断 [S1] | 官标价：agent 4×、多 agent **15×** chat token；写死 scaling rules（1 agent/3–10 calls ↔ >10 subagent）；必须「任务价值足够高」[S1] | 未采集到具体单位；强调「外部记忆＋干净上下文 handoff＋artifact 落文件系统」[S1] |
| **Claude Code subagents** | 用户本机 `.claude/agents/`／`~/.claude/agents/`（**Markdown 文件即定义**，另有 Managed settings 组织级层）[S2s] | 用户本地（`~/.claude`），可用 `memory` 字段给每 agent 一份持久记忆目录 [S2s] | 父会话管全部工作；subagent 只回报结果；**嵌套深度默认 3、并发默认 20**[S2s] | 每 subagent 的 `model`／`effort`／`maxTurns`；SDK **`maxBudgetUsd` 花费上限**；请求计入你的用量额度 [S2s] | 会话记录＋`.claude/agent-memory/<agent>/`（user／project／local 三档）[S2s] |
| **Claude Code agent teams** | **用户本机**：`~/.claude/teams/{team-name}/`＋`~/.claude/tasks/{team-name}/`（**无项目级团队配置**）[S2] | 用户本地；**任务清单从不上传**；团队配置目录会话结束即删 [S2] | Team lead 固定、不可移交；**不能嵌套团队**；**一会话一团队**；teammate 不能代替人批准权限、不能转手绕过拒绝 [S2] | **约 7× token**（plan 模式 teammates）；官方建议 **3–5 人**、每 teammate 5–6 任务；按角色选模型＋组织 `availableModels` 白名单 [S2][S2c] | **team-name＝session-ID 前 8 位**；团队配置随会话亡，任务清单本地长存 [S2] |
| **Cognition（Devin）** | 应用侧；**manager Devin ＋ child Devins 经内部 MCP 协调**[S9b] | 应用侧 [S9b] | **map-reduce-and-manage**：manager 拆活、子级执行、manager 汇总；非结构化 swarm「mostly a distraction」[S9b] | 未采集到预算机制；有跨模型**能力路由**与 generator–verifier 的成本/质量数据 [S9b] | 未采集到（核心约束是「writes stay single-threaded」）[S9b] |
| **A2A（Linux Foundation／AAIF）** | **协议层**：跨厂商/跨组织通信标准，组织本身不建模；AAIF Growth Stage 项目，与 MCP／goose／AGENTS.md 并列 [S4][S4a] | 各方自持；靠**不透明执行**互不干涉；连续性靠**不透明 `contextId`** 分组 [S4] | **无 supervisor／无 team／无权威层**；只有 Agent Card（能力＋JWS 签名）、任务状态机、认证边界 [S4] | 未采集到（协议不管成本）[S4] | **Task ＋ Artifact ＋ contextId**；长任务用 LRO／SSE／push notification [S4] |
| **Google ADK** | 用户代码里的 agent 树＋session service（`DatabaseSessionService`／`VertexAiSessionService`），可部署到 **Agent Runtime**（付费托管）[S5a] | 可本地可托管；状态按 `session:`／`user:`／`app:`／`temp:` 前缀分域 [S5a] | coordinator ＋ `sub_agents`；**自动注入以 subagent 命名的 delegation 工具**；`chat`/`task`/`single_turn` 三模式决定交回方式与可否并行；`temp:` 状态**全调用链共享**，各分支 session **互相不可见** [S5a] | 未采集到预算机制；HITL 用**无模型图节点** `RequestInput` 保证可预测；回调被官方定位为 **policy enforcement** 挂点 [S5a] | **Session／State／Events／Memory**（＋Artifacts、Rewind sessions）；`Memory` 为跨会话可检索层 [S5a] |
| **Microsoft AutoGen（AgentChat）** | **代码里的 Team 对象**；有嵌入与**实验性分布式 runtime**[S6a][S6m2] | 应用侧；**Team 对象本身有状态**，`run()` 续跑、`reset()` 清空 [S6a] | Team 即编排：`RoundRobinGroupChat`／`SelectorGroupChat`／`Swarm`／`MagenticOneGroupChat`；**默认所有 agent 共享同一上下文（共享黑板）** [S6a] | 控制流原语＝termination condition 组合（text／handoff／external／max-message／token）；官方要求「start with a single agent」[S6a] | **Team 的会话历史与上下文**（`run()` 续、`reset()` 清）[S6a] |
| **Microsoft Agent Framework** | 代码＋你自己的容器；**Foundry Hosted agents** 可跑在**每会话 VM 隔离沙箱**（平台管扩缩、会话状态持久化、可观测）[S6m][S6m4] | 应用侧；handoff 持久化需 checkpoint＋稳定 agent id [S6m3] | 五种编排枚举：Sequential／Concurrent／**Handoff**（接收方拿全部上下文）／**Group Chat**／**Magentic**（manager 动态协调，暴露 maxRounds／maxStalls／maxResets 与计划签核）；progress ledger 即共享状态产物 [S6m][S6m3] | Magentic 内环上限；handoff 自主模式**默认 50 回合**；HITL 用 **approval-required tools** 与 `RequestPort`／`RequestInfoEvent` [S6m][S6m3] | **Checkpoint**（每个 superstep 末写入，含所有 executor 状态、待处理消息与请求、**shared states**）；provider：InMemory／File／Cosmos；≥1.13.0 起可回放 [S6m3] |
| **LangGraph／LangChain** | 自定位 **orchestration runtime**；**你的 repo ＋ 你的数据库**（Agent Server 才由平台管持久化）[S7f][S7f2] | 应用侧：checkpointer（线程）＋ store（跨线程）[S7f2] | 官方把 **subagents 放在 Deep Agents 这一层**；**supervisor 已降级为模式**（官方建议直接用工具而非 `langgraph-supervisor` 库）；subagent 默认**无状态、干净上下文**[S7f2] | **`recursion_limit` 默认 1000 超步**（v1.0.6+）→ `GraphRecursionError`；`RemainingSteps` 做优雅降级 [S7f2] | **Checkpointer（线程级）＋ Store（跨线程）**；`MemorySaver` 重启即失，生产用 Postgres／SQLite [S7f2] |
| **CrewAI** | 应用侧 Crew／Flow 对象 [S7c] | 应用侧；Flow 状态用 `@persist`（**默认 SQLiteFlowPersistence**）[S7c] | **Process.hierarchical** ＋ `manager_llm`／`manager_agent`（manager 做 planning／delegation／validation，**任务不预先分配**）；委派是自动加的两个工具；另有一体化 `Memory` [S7c][S7c2] | 罕见地把治理写进概念层：**delegation 默认关闭**、**Max Requests Per Minute**、**Max Iterations**、Context Window Respect、`guardrail_max_retries`(3) [S7c2] | **Checkpoint**（全量 state＋memory/knowledge＋任务进度＋事件历史＋**lineage ID**，可 resume 或 fork）；记忆落**本地 LanceDB** `./.crewai/memory` [S7c2][S7c3] |
| **OpenAI Swarm** | 已废弃：README 自述「replaced by the OpenAI Agents SDK… for all production use cases」[S10] | 无（库已停更）[S10] | 它普及的原语：**handoff ＝一个返回 agent 的函数**（工具调用返回值）[S10] | 未采集到 [S10] | 未采集到 [S10] |
| **宿主 DSH Agent Teams** | **同一 DSH 进程内的会话**：TeamId＝Lead 的 SessionId，无项目级配置 [L3] | 用户本地：Lead 会话日志（`team/member`、`team/task`）＋各目标 Agent 自己的 inbox [L3] | **隐式 Lead（每个普通运行时根）**＋teammate；**只有 Lead 能生成/中断/改派**；roster 四态；名字永久不复用 [L3][L11] | fail-loud 上限：`maxMembers` 16（bundle 收窄为 8）、`maxTasks` 256、`maxMessageBytes` 64 KiB、`disposalTimeoutMs` 5 s；任务 CAS 防覆盖 [L3][L12] | Lead **会话日志**（log-only 协调事件，不进对话面）＋任务板 tombstone 保 id 稳定 [L3] |
| **dsh-team「团队模式」预设** | 用户机器上的一个 agent preset（`$DSH_HOME/plugins/dsh-team/presets/team/`）[L8] | 无独立状态面（复用 DSH 会话／subagent）[L8] | **靠 persona 文本约束**「你只协调、绝不写代码」＋7 步流程；无账本、无权限面、无编制 [L8] | 只有 persona 文本里的软约束（讨论上限 2–3 轮）[L8] | 无（preset 是配置，不是状态）[L8] |
| **Pod（dsh-bots）** | **用户机器**：编制＝`$DSH_HOME/pod/bots.json`；每 bot 一个 DSH profile＋一个监听端口＋一个 `pod-workspaces/<bot>/` [L5][L10] | 用户本地：`ledger/`（events＋audit＋epoch＋idempotency＋lock）、`inbox/<bot>/`、`outbox/<bot>/`、`knowledge/`、`capabilities/`（issued＋nonces＋secret）[L10] | 编制字段含 **`post`／`role`／`permission`／`readOnly`／`group`**；权限以 profile patch **按 id 停用工具行**落地；另有 `role-cards`／`permissions`／`op-set`／`capability-*` 与 `org-ledger-authz` 测试面 [L9][L10][L14] | 本轮采集面**未定位到编制级预算/上限的落点**；有 `experiment-cost.js` 与 per-bot 模型配档 [L9][L14] | **台账事件**（`ledger/events.jsonl`＋`audit.jsonl`＋`epoch.json`）＋每 bot 工作目录＋知识索引 `knowledge/index.jsonl` [L10] |

**四条「组织原始语」路线与三条坐标轴（事实归纳）**：① **托管服务侧组织**（OpenAI dots、Foundry
Hosted agents）——运行时、凭据、会话状态在厂商云，「岗」由厂商与客户共同定义并试点交付，或由平台
托管沙箱承担 [S7][S7t][S6m4]；② **协议侧组织**（A2A）——只标准化 agent 之间的消息、任务与分组，
**刻意不建模组织内部**（Opaque Execution）[S4]；③ **会话内／图内组织**（Claude Code agent teams、
宿主 DSH Agent Teams、ADK、Agent Framework、LangGraph、CrewAI、AutoGen）——组织是**一个会话树
或一张图的运行期结构**，随会话／run 生灭，且都不做工作区隔离（Claude Code 明说不隔离 teammate
[S3]，宿主明说不支持独立工作目录与跨进程协调 [L3]，ADK 的隔离是 **session branch 级** [S5a]，
CrewAI 是 run 级 checkpoint [S7c3]，AutoGen 默认还是**共享黑板** [S6a]）；④ **编制侧组织**（Pod）
——组织是**用户机器上跨进程的编制**，编制与权限有独立于任何单个会话的落盘形态 [L9][L10]。
**跨全部样本，真正的分野只有三条轴**：① **上下文是共享还是分区**；② **handoff 是工具调用、图边，
还是返回值**；③ **耐久状态归谁**（你的 DB／你的机器 vs 平台托管）[S4][S6a][S7f2][S10]。
**交叉印证**：OpenAI 自家 SDK 文档把「**separate workspaces**」列为多 agent 的正当用法 [S10]，
Cognition 把「**writes stay single-threaded**」立为今天的成败线 [S9b]，两者合起来正好指向「每
agent 一个工作区 ＋ 单线写入」——即 Pod 的每 bot 一 workspace 形态；而 Claude Code agent teams
恰好两条都不满足 [S2][S3]。

---

## 12. 盲区清单

1. **OpenAI 一手来源全线不可达（最大盲区）**：openai.com 与 help.openai.com 文章页一律 403
   （Cloudflare）；`developers.openai.com` 403；`learn.chatgpt.com` 连接永不完成；archive.org／
   archive.ph／r.jina.ai 代理 502；本机无 CDP 浏览器。**后果**：§2 全部功能断言为二手，dots 的
   运行时实现细节（容器/VM、文件系统是持久卷还是可恢复快照、记忆存储格式、dot 间是否可能有协议）
   **无一手依据**。
2. **dots 价格数字冲突**：二手源分别出现「$100 起」与「$200/月」，均非一手；官方 Pro 500 价位未
   采集到。**本报告不采用任何具体价位。**
3. **Dwarkesh 播客一手页面不可达**（curl `code=000`）。§3.1／§3.2 经两处独立中文逐字转载交叉核验，
   但**未读到英文原文**，逐字英文措辞与时间戳未核验。
4. **AgentKit／Agent Builder 零可用材料**：cookbook 路径不可达、notebook 超时、
   `platform.openai.com/docs/guides/agent-builder` 403 → **任何 AgentKit 能力断言都不应从本报告
   得出**；OpenAI 官方「何时该用多 agent」独立指南页亦未找到（只有 SDK 的 orchestration 取舍
   文档 [S10]）。
5. **LangGraph 的 durability 模式名未核验**：官方 `/langgraph/durability` 页 **404**，只有
   `#durability-modes` 锚点存在 → `exit`／`async`／`sync` 语义无一手依据 [S7f2]。
6. **Google「Agent Garden」在现行 adk.dev 导航中不存在**；Vertex AI「Agent Engine」现以 Agent
   Runtime／Agent Platform 出现（部署页仍链 `agent-engine` URL）→ 命名与存活状态
   `[未经一手来源核验]` [S5a]。
7. **Microsoft 侧两处未核验**：① 「AutoGen 处于维护模式」的明文表述（`microsoft/autogen` README
   因 GitHub 不可达未取）；② Agent Framework 的 **GA 日期**（官方 what's-new 页 404）→ 均
   `[未经一手来源核验]` [S6m2][S6a]。
8. **Claude Code 若干相关页只读到索引级描述**（llms.txt 一句话摘要），正文未逐页读：
   cross-session messaging、agent-view、workflows、costs（细节）、routines、channels、goal、
   analytics [S5]。其中 costs 页与 cross-session-messaging 的跨机器/云端能力对本项目价值最高。
9. **Anthropic 平台文档域被区域拦截**：`platform.claude.com/docs/...` 经 curl 落到
   `claude.com/app-unavailable-in-region`，故 Claude Agent SDK 部分页与 API 侧 memory／tool 权限
   文档未采。
10. **GitHub 全域不可达（HTTP 000）**：无法克隆任何源码仓库、读 issue／discussion 历史，也无法
    核验 `langgraph-swarm` 等库的维护状态；`openai/swarm` README 只能经 CDN 镜像取得 [S10]。
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
    追查（如 dots 安全白皮书是否存在）未做。

---

## 13. 对 Pod 的差异化定位（推断）

> 以下 6 条**全部是推断**，不是采集到的事实；括号内注明依据的采集事实。

- `INFERENCE:` 1. **外部同类的「团队」都随会话或 run 生灭，Pod 的「编制」跨会话、跨进程长存**。
  Claude Code agent teams 的 team-name 由 session ID 派生、团队配置目录会话结束即删、且**无项目级
  团队配置** [S2]；宿主 DSH Agent Teams 的 TeamId 等于 Lead 的 SessionId、明确不支持跨进程协调
  [L3]；ADK 的隔离只到 session branch，CrewAI 的持久单位是一次 run 的 checkpoint，AutoGen 的持久
  单位是 Team 对象 [S5a][S7c3][S6a]。而 Pod 的编制落在 `$DSH_HOME/pod/bots.json`，每 bot 一个
  profile／端口／工作目录 [L10]。→ 差异化不在「有没有团队」，而在**组织本身是不是一等持久对象**。
- `INFERENCE:` 2. **Pod 是「编制＋权限分层」，不是「人格＋工具遮蔽」「编排模式枚举」「Markdown
  文件」或「进程开关」**。同类实现都走后者：宿主 Agent Teams 靠上限与 Lead 独占权威 [L3]；
  `dsh-team` 靠 persona 文本 [L8]；Microsoft 做成五种编排模式之一 [S6m]；CrewAI 做成
  `Process.hierarchical` 开关 [S7c]；Claude Code 把角色做成 `.claude/agents/*.md` ＋ frontmatter
  [S2s]。只有 Pod 把 `post`／`role`／`permission`／`readOnly` 写成编制字段，并把只读落到「按 id
  停用工具行」的 profile patch [L9][L10]。→ 可主张的差异是**权限是编制的属性，而非生成时或文件级
  的一次性参数**（对照 Claude Code 官方限制「生成时无法按 teammate 设权限模式」[S2]）。
- `INFERENCE:` 3. **「跨进程 ＋ 每 bot 一工作区」是 Pod 相对所有同类本地方案的硬差异，且与两条
  最强外部证据同向**。宿主官方列明不支持独立工作目录与跨进程协调 [L3]；Claude Code agent teams
  明确不做 worktree 隔离并要求人工切分文件归属 [S2][S3]；而 **OpenAI 自家 SDK 文档**把「每个
  reviewer／coding sub-agent 一个 workspace」列为正当用法 [S10]，**Cognition** 把「writes stay
  single-threaded」立为成败线 [S9b]。Pod 的每 bot 一 workspace ＋ 一端口 [L10] 正落在这两条的
  交叉点上。
- `INFERENCE:` 4. **成本治理是 Pod 目前最薄的一环，也是最好补的一环**。外部同类都给了明确挂点：
  Anthropic 的 15× 标价＋按复杂度写死的 scaling rules [S1]；Claude Code 的「3–5 人起、每人 5–6
  任务」＋约 7× token＋SDK `maxBudgetUsd`＋嵌套/并发硬上限 [S2][S2s][S2c]；宿主 Agent Teams 的四
  个 fail-loud 上限 [L3][L12]；CrewAI 的 **delegation 默认关闭**＋`max_rpm`＋`max_iter` [S7c2]；
  LangGraph 的 `recursion_limit`（默认 1000）[S7f2]；AutoGen 的 termination 组合 [S6a]。Pod 采集
  面上只有 per-bot 模型配档与 `experiment-cost.js` [L9][L14]，**未定位到编制级预算/上限的落点**。
- `INFERENCE:` 5. **「审查点」必须能拦住动作，而不只是触发提示**。Claude Code 的 hooks 给出可拦
  可退的语义（`TaskCreated`／`TaskCompleted` exit 2 阻止创建/完成并回反馈，`TeammateIdle` 让它继续
  干）[S2]；Microsoft 给出 **approval-required tools**（执行前暂停等人工复核）与 `RequestPort`
  [S6m]；OpenAI Agents SDK 的 `needs_approval`＋`RunResult.interruptions`＋**fail closed** [S10]；
  dots 给出 Custom Rules 三态与 auto-review `[未经一手来源核验]` [S7]。Pod 侧对应面是
  `brief-gate.js`、`review-kit.js`、`review-artifacts.js` 与 `org-ledger-authz` 测试 [L14]。
  → 若要走「组织级质量门」定位，需要在**台账写入口**具备与 hooks 同级的「拒绝并回反馈」语义。
- `INFERENCE:` 6. **最强同构件是 Claude Code agent teams，而它也是「本地、用户自有」——Pod 的
  时间窗不宽**。它已具备 lead／teammate／共享任务板／mailbox／人类直连 teammate／agent 间消息的
  信任边界（不能代替人批准、不能转手绕过拒绝）[S2]，同族的 cross-session messaging 已能做跨机器与
  云端的会话间消息 [S3]，且**尚无成本上限与文件隔离两处短板**——这两处正是 Pod 的强项 [L10][L14]。
  Pod 若只做「同一台机器上的多 agent 协作」会与之正面重叠；可守的差异是**编制与权限的持久化落盘
  形态**、**跨进程（含跨 profile／跨模型供应商）**、以及**可审计的授权与证据链**
  （`capabilities/issued.jsonl`＋`ledger/audit.jsonl`＋证据包机制）[L10][L14]。

---

## 14. 来源列表（URL／类型／日期）

类型口径：**一手**＝厂商自己的文档／公告／工程博客／源码／官方协议站；**二手**＝新闻报道、地区
转载、聚合站。**协作代理采集**＝由并行调研代理取回、本会话未直读。

**外部一手（厂商自有面）**

| 编号 | 来源（URL） | 日期 | 可达性 |
|---|---|---|---|
| S1 | anthropic.com/engineering/multi-agent-research-system | 2025-06-13（页面标注） | 200，正文已读 |
| S2 | code.claude.com/docs/en/agent-teams | 未标；引用 v2.1.281 等版本 | 200，正文已读 |
| S2s／S2k／S2m／S2h／S2p／S2c | code.claude.com/docs/en/{sub-agents,agent-sdk/subagents,skills,memory,hooks,permission-modes,costs} | 未标 | 协作代理直读（**约 7× token** 数字出自 costs） |
| S3 | code.claude.com/docs/en/agents | 未标 | 200，正文已读 |
| S5 | code.claude.com/docs/llms.txt（官方文档索引） | 采集时点 2026-10-13 | 200，566 行，仅作索引 |
| S4／S4a | a2a-protocol.org/latest/{topics/what-is-a2a,specification,topics/agent-discovery}；/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/（S4a，**2026-08-27**） | 规范标注 Latest Released Version 1.0.0 | S4 正文已读（渲染 HTML）；S4a 协作代理直读 |
| S5a | adk.dev/{workflows,workflows/collaboration,agents/routing,sessions,sessions/state,graphs/human-input,callbacks/types-of-callbacks,a2a/intro,agents/managed-agents,deploy/agent-runtime,tutorials/agent-team,sitemap.xml} | ADK 2.0.0／2.4.0 preview | 本会话读 workflows／collaboration／tutorial／sitemap；其余协作代理直读 |
| S6a | microsoft.github.io/autogen/stable/…（tutorial/teams、swarm、magentic-one）＋ pypi.org/pypi/autogen-agentchat/json | 未标 | 协作代理直读 |
| S6m | learn.microsoft.com/en-us/agent-framework/{overview,workflows,workflows/orchestrations,workflows/human-in-the-loop} | Last updated 2026-08-25 | 200，正文已读 |
| S6m2／S6m3／S6m4 | learn.microsoft.com/en-us/agent-framework/{migration-guide/from-autogen,user-guide/workflows/orchestrations/*,user-guide/workflows/checkpoints}；azure/foundry/agents/concepts/hosted-agents | 未标 | 协作代理直读 |
| S6c／S6g | learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-add-other-agents；azure/architecture/ai-ml/guide/ai-agent-design-patterns | 未标 | 协作代理直读 |
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
| S6／S6b | qbitai.com/2026/09/499654.html（量子位：Noam Brown 访谈中文逐字转载，原出处 dwarkesh.com/p/noam-brown）；hub.baai.ac.cn/view/58369（独立镜像，交叉核验） | 2026-09-30 | 200，正文已读，两处一致 |
| S9 | subscriptioninsider.com/blog/openai-starts-dots-at-100-… | 未标 | **未取正文**，仅标题（价格口径与 S7 冲突，不采用） |

**OpenAI 一手但本轮不可达（引用其存在性）**

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

### 14.1 本轮已尝试但失败的采集路径（供后续轮次复用）

- **OpenAI**：`openai.com/index/*` 与本地化变体、`help.openai.com` 各语言路径、
  `developers.openai.com/api/docs/guides/agents/orchestration`（含 `.md`）、
  `platform.openai.com/docs/guides/agent-builder` → **403**；`learn.chatgpt.com/docs/dots*` →
  **连接永不完成**（`--resolve` 与第三方代理亦败，代理 522）；`cdn.openai.com/index/devday-2026-recap/`
  → **404 BlobNotFound**（根路径 404 而非 403，说明该域可达）。
- **镜像通路**：`r.jina.ai/...` 502；`archive.org/wayback/available?...` **502**；
  `web.archive.org/web/2026/...` **unsupported content type "unknown"**；`archive.ph` 502。
- **代码托管**：`github.com` 与 `raw.githubusercontent.com` **全域 HTTP 000**；`openai/swarm`
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
- **浏览器通路**：`http://127.0.0.1:9222/json/version` → 连接失败（无监听），故无法用带真实登录态
  的浏览器绕开 Cloudflare。
