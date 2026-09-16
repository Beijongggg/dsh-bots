# 多 agent 组织模式谱系与成本结构 —— 研究报告

- 票据：`.scratch/org-v2/issues/01-research-org-patterns.md`（Type: research）
- 性质：**暂定稿**。本轮网络受限，全部结论基于本轮实际可达的一手来源（文末引用列表）；
  不可达来源与未核验点集中列于末节「盲区清单」。凡靠模型自带知识补位的内容，
  正文均就地标注 **[未经一手来源核验]**。
- 优先级：组织原则、协议设计、成本结构（恒久）＞ 框架 API 细节（速朽，仅作证据）。
- **定稿注记（2026-09-16，org-v2 16 号票裁定）**：补充调研轮已完成——盲区
  1–8 的一手复核与终态方向见同目录 `org-patterns-supplement.md`；本文件与
  supplement **共同构成终稿**，正文保持 09-08 采集原貌不改写。终态方向：
  盲区 3/4/5/6/7 **升级**、盲区 1 **维持降级**、盲区 2 **下调**、盲区 8
  dual-role 升级＋成本数字下调。以下段落以 supplement 为准（原文保留、
  引用须按终态口径）：§0 第 5 条与 §2 P7 矩阵节——矩阵直接文献不存在
  （OrgAgent §3.1 限定只研究 flat vs hierarchical），维持推理，相邻证据仅
  支撑同池复用；§4 第 3 条——MetaGPT「按岗配档」句与「$2.0→$0.2」无一手
  支撑、应删，按岗配档改挂 Anthropic＋OpenAI 指南 PDF p8；§4 第 1 条 MAST
  相关——「可预防」口径收窄到 FC1/FC3、占比图更正为 Figure 1；§8 盲区 8
  ——ChatDev 论文无每软件成本数字。

---

## 0. TL;DR

1. **单代理优先是跨厂共识**：Anthropic 与 OpenAI 官方指南都要求先把一个 agent 的能力
   推到上限，多 agent 只在可证明改善产出时引入 [1][3]。多 agent 不是默认架构，是一种
   用 token 换并行的**溢价架构**：官方实测约 15 倍于单聊的 token 消耗 [2]。
2. **模式选择由三个变量决定**：子任务可并行度、上下文总量（是否超单窗）、协调失真
   容忍度（supervisor 转述有「传话游戏」税 [7]）。
3. **成本结构恒久律**：上下文隔离是最大的省钱机制（官方基准：子代理模式省约 67%
   token [6]）；编排层是最大的花钱机制（token 乘数 + 转述税 [2][7]）；按岗配档
   （协调/评审岗高档、执行岗低档）是官方系统里反复出现的实践 [2][3]。
4. **失败模式有分类学**：MAST 把失败聚为系统设计、代理间错位、任务验证三类共 14
   种 [14]；其中「忽略他代理输入」「无产出空转对话」直接指向组织协议缺陷而非模型
   能力缺陷 [14]。
5. **对 dsh-bots 的初判**：常态值守＝扁平对等（每 bot 独立岗位、无编排层）；目标→
   团队自治＝supervisor/编排者-工人（按需拉起、带 scaling rules 防过度 spawn）；
   双形态叠加正好构成矩阵组织（职能线值守 + 项目线目标），但矩阵的 agent 领域直接
   学术证据本轮不可达（盲区 1），该判断属推理。

---

## 1. 基线共识：先问「要不要多 agent」

这一节不是模式，而是所有模式的入场条件——两份官方指南在此完全一致。

- Anthropic：多 agent 系统「trade latency and cost for better task performance」，
  应「finding the simplest solution possible, and only increasing complexity when
  needed」（寻找尽可能简单的方案，仅在需要时增加复杂度）[1]。
- OpenAI：「Our general recommendation is to maximize a single agent's capabilities
  first.」（先把单 agent 能力推到上限）；「More agents can provide intuitive
  separation of concepts, but can introduce additional complexity and overhead」
  [3]。编排复杂度要匹配任务复杂度，从单 agent 起步、按需演进 [3]。
- LangChain 概念页同样告诫：「not every complex task requires this approach—a
  single agent with the right (sometimes dynamic) tools and prompt can often
  achieve similar results」[6]。
- MAST 论文提供反面数据：主流基准上多 agent 系统相对单代理的收益「often minimal」，
  有时甚至不如 best-of-N 采样；被测 ChatDev 配置正确率可低至 25% [14]。

**适用规模判断**：多 agent 的正收益场景被 Anthropic 明确圈定为三条——重并行、信息量
超单上下文窗、需对接大量复杂工具 [2]。不满足这三条时，单 agent + 好工具面是更优解。

---

## 2. 模式菜单

每模式四要素：结构 / 优劣 / 成本形态 / 恒久度评估（该模式的**原则**在模型更迭后
是否仍成立）。

### P1 Supervisor / 编排者—工人（orchestrator–workers；manager pattern）

- **结构**：一个中央协调者动态分解任务、委派给工人代理、合成最终结果；子任务不
  预定义，由编排者现场决定 [1]。实现上有两个变体，语义不同：
  - **agents-as-tools**（OpenAI manager pattern / Anthropic orchestrator-workers）：
    工人像工具一样被调用，「edges represent tool calls」[3][4]；协调者保留最终
    答案的所有权，适合「specialist should help with a bounded subtask」（专家只帮
    有界子任务）的场景 [4]。
  - **转交回流**（langgraph-supervisor 式）：工人完成后交还 supervisor，由其决定
    下一步 [8]。
- **优劣**：优——任务分解自适应、可控性强（守门人统一把关、统一执行 guardrails
  [4]）、对工人代理几乎无假设（最灵活 [7]）；劣——「传话游戏」失真：只有
  supervisor 面向用户时，子代理答案被转述而非直通，LangChain 官方基准把 supervisor
  的分数损失明确归因于这种 translation [7]；且 supervisor 的 token 消耗持续高于
  swarm [7]。
- **成本形态**：编排税（每次委派/回流都是一轮 LLM 调用）+ 转述税。可用的恒久减税
  手段（来自 langgraph-supervisor 一手文档）：`output_mode="last_message"` 只把工人
  最后一条消息而非全历史回传 supervisor；`forward_message` 工具让工人直接转发用户
  消息，「saves tokens for the supervisor and avoids potential misrepresentation」
  （省 supervisor token 且避免转述失真）[8]。LangChain 官方基准用这三个减税手段把
  supervisor 架构性能提升近 50% [7]。
- **恒久度评估**：**高**。「分解—委派—合成」是任务组织的通用原则，与模型无关；
  OpenAI（manager [3]）、Anthropic（orchestrator-workers [1]）、LangChain
  （subagents-as-tools [6][8]）、CrewAI（hierarchical process + manager_llm [9]）
  四家在 API 层面收敛到同构实现，说明该原则已跨框架稳定。具体库（如
  langgraph-supervisor）官方已建议直接用工具调用自建 [8]——API 速朽、原则恒存。

### P2 层级（hierarchical teams；SOP 流水线）

- **结构**：supervisor 之上再叠 supervisor，形成两级以上树；或按 MetaGPT 的做法，
  把人类标准化作业程序（SOP）编码进 prompt 序列，用「装配线范式」给不同 agent 分派
  不同角色 [12]；ChatDev 用「chat chain」把瀑布模型的各阶段改造成由双角色对话完成
  的单元 [19]；Magentic-One 由一个 Orchestrator 负责「plans, tracks progress, and
  re-plans to recover from errors」，指挥各专职代理 [20]。
- **优劣**：优——中间产物结构化、可验证：MetaGPT 的设计让「agents with human-like
  domain expertise to verify intermediate results and reduce errors」，以抑制朴素
  LLM 链式拼接导致的级联幻觉 [12]；职责边界清晰，适合工序固定的产出流水线。
  劣——层级每加一级，延迟、token、传话失真同步放大；Magentic-One 式的「计划—
  追踪—再计划」循环在错误恢复时要多付重规划成本 [20]。
- **成本形态**：线性叠加每级的编排税；但 SOP 流水线的工序是**预定义的**（代码路径
  固定），比运行时动态分解便宜且可预算——这正对应 Anthropic 分类里「workflow（预
  定义路径）」与「agent（动态决策）」的成本分界 [1]。
- **恒久度评估**：**高**。「把 SOP 编码为显式工序 + 每道工序的产物有 schema、可
  验证」是恒久的组织原则 [12][19]；Magentic-One 声称其模块化设计允许「agents to be
  added or removed from the team without additional prompt tuning or training」
  [20]，这种即插即用的岗位制是耐模型更迭的设计。两级以上的深树在大模型上下文
  时代罕见正面证据——主流官方实现都停在「一个协调者 + 一层工人」。

### P3 扁平 / 对等（swarm；decentralized；handoffs）

- **结构**：代理互为对等节点，按专长直接互转控制权：「Multiple agents operate as
  peers, handing off tasks to one another based on their specializations」，
  「edges represent handoffs」[3]。OpenAI Swarm（教学框架，已被 Agents SDK 取代
  [5]）把它 minimal 到两个原语——Agents 与 handoffs；handoff 是「one way transfer
  that allow an agent to delegate to another agent」（单向转交）[3]，且任一时刻
  **只有当前活跃 agent 的指令在上下文里**——转交即换 system prompt，聊天历史保留
  [5]。CAMEL 的双 agent 角色扮演（AI user 给指令 / AI assistant 执行，用 inception
  prompting 对齐人类意图）是对等协作的最小学术原型 [13]。
- **优劣**：优——专家直达用户，没有转述失真（LangChain 基准中 swarm 分数与 token
  双优于 supervisor 的直接原因）[7]；架构最简，适合「a large number of independent
  capabilities and instructions that are difficult to encode into a single
  prompt」的大量独立能力场景 [5]；状态化转交在重复请求上省 40–50% 调用 [6]。
  劣——无守门人：质量控制、guardrails 无法集中执行 [4]；全局视角缺失，任务需要
  「整体规划 + 回溯」时不如 supervisor；转交链过长同样会丢上下文（转交只换指令、
  历史全量携带，长对话下上下文膨胀 [5]）。
- **成本形态**：每 agent 维护自己的上下文，无中央编排轮次；但串行转交无法并行
  [6]，多域任务上不如 subagents 模式（后者的上下文隔离省约 67% token）[6]。
- **恒久度评估**：**高**。「handoff = 单向转交 + 指令切换 + 历史继承」是协议级
  原语，从 OpenAI Swarm 实验框架平移进了 Agents SDK 正式文档 [4][5]，也被
  LangGraph swarm 官方库复用（搜索结果指向 langchain-ai/langgraph-swarm-py，
  本轮未抓其 README——见盲区 6）。CAMEL 的 inception prompting（角色+任务双向
  锁定）是 prompting 协议的恒久参考 [13]。

### P4 广播群聊（group chat）——作为「规模受限」的证据

- **结构**：AutoGen 早期形态：任意「conversable agents」进入同一个群聊，用自然
  语言+代码混编编程对话模式 [10]。
- **优劣**：优——表达力最强，任何对话图都能写出来 [10]。劣——**广播式通信把
  复杂度推给每个参与者**：每个 agent 都要读全部历史；发言权仲裁成为瓶颈。最有力
  的证据是 AutoGen 自己：v0.4 从零重写为异步、事件驱动、actor 式消息传递，官方
  理由正是旧版「architectural constraints」「limited debugging and intervention
  functionality」，社区要求「more flexible multi-agent collaboration patterns」
  [11]——即把「群聊总线」换成「点对点异步消息 + 显式运行时」。
- **成本形态**：随人数超线性（全员全历史）；重写后的异步消息模型支持
  「proactive and long-running agents」与分布式部署 [11]，把通信从「大家都在场」
  变成「按订阅收发」。
- **恒久度评估**：**原则恒久、形态速朽**。「通信拓扑决定扩展上限」是分布式系统
  老定律在 agent 领域的复现；广播群聊作为产品形态已被其作者放弃 [11]。小团队
  （≤5）群聊可用（表达力红利），团队规模增长后必须换成定向消息/订阅制。

### P5 动态编组（dynamic team formation）

- **结构**：团队组成不再固定，按任务/按阶段现场招募与裁撤：
  - DyLAN 两阶段——先「Team Optimization」（用无监督的 Agent Importance Score
    按预跑贡献挑人），后「Task Solving」（选中者按 query 动态协作）[16]。
  - AgentVerse——团队「dynamically adjust its composition as a
    greater-than-the-sum-of-its-parts system」，并研究代理间社会行为的涌现与
    治理（扬正抑负）[17]。
  - Magentic-One——Orchestrator 按需调遣专职代理并再计划，团队可增删成员而无需
    重调 prompt [20]。
  - Anthropic 研究系统——lead agent 在计划阶段决定拉多少子代理，并把**缩放规则**
    写进 prompt：简单查证 1 个代理 3–10 次工具调用；对比类 2–4 个子代理各 10–15
    次；复杂研究 10+ 子代理 [2]。
- **优劣**：优——人力随任务难度匹配（DyLAN 在 MMLU 学科上选队最高提 25.0% 精度
  [16]）；避免常备大团队的空转成本。劣——招募/评分本身要花预跑成本 [16]；涌现
  行为不可控（AgentVerse 需显式治理策略 [17]）；早期系统会犯「简单问题 spawn
  50 个子代理」的过度动员病，Anthropic 靠 prompt 内 scaling rules 治愈 [2]。
- **成本形态**：成本随任务难度伸缩（目标对齐的弹性成本）；上限须用显式规则
  约束（人数 × 每人工具次数）[2]。
- **恒久度评估**：**中高**。「按难度配置人数、给动员规模立规则」是恒久纪律；
  具体评分算法（如 Agent Importance Score）会随研究迭代。dsh-bots 的「目标→团队
  自治」终景本质上就是这个模式：目标是输入，团队组成是输出。

### P6 并行采样 / 投票（sectioning & voting）

- **结构**：Anthropic 的 parallelization 工作流含两个变体——sectioning（独立子任务
  同时跑）与 voting（同一任务多路跑再表决，如多路代码审查）[1]；学术对应「More
  Agents Is All You Need」：「simply via a sampling-and-voting method, the
  performance of large language models (LLMs) scales with the number of agents」，
  且增强度与任务难度相关 [18]。
- **优劣**：优——实现极简、可预测、无协调协议；对难题有免费精度。劣——纯算力
  换精度，不做任务分解；同质冗余（n 份相同角色）而非异质分工。
- **成本形态**：严格线性 n 倍；只适合「单次调用便宜 + 高价值判定」的场景。
- **恒久度评估**：**高**。采样表决是统计学常青结构；但它其实是「单 agent + 重复」，
  严格说不算组织形态——列在这里是为了给「多 agent」划出下界：**同质冗余不是组织**。

### P7 矩阵（matrix：职能线 + 项目线双汇报）

- **结构**：人类管理学形态——员工同时向职能经理（专业线）和项目经理（任务线）
  汇报。agent 领域直接对应物：常驻职能岗位（按专业分 Home）+ 按目标临时编组的任务
  团队（从各职能岗拉人）。
- **一手证据**：**本轮不可达**。搜索定位到 OrgAgent（arXiv 2604.01020，
  「Organize Your Multi-Agent System like a Company」，摘要提及 Galbraith 矩阵
  组织「combine functional and project forms」），但两次抓取均超时——无法核验
  其方法与数据（盲区 1）。以下判断属**结构推理 + 管理学通则**，[未经一手来源
  核验]。
- **优劣（推理）**：优——与 dsh-bots 双形态（常态值守＝职能线；目标自治＝项目线）
  天然同构：岗位常驻保证值守连续性与专业上下文沉淀，项目线按需动员不新增编制；
  两线共享同一批 agent，避免「常驻团队」与「任务团队」两套人马。劣——双汇报的
  经典病：优先级冲突（值守中被告警拉走 vs 项目线任务）与指令冲突（两个「上级」
  给出不一致目标，对应 MAST 的 inter-agent misalignment 类失败 [14]），管理学
  解法（单一时刻单一任务归属 + 冲突上报给人）在 agent 场景同样必要。
- **成本形态（推理）**：矩阵不新增模型成本，新增的是**协调状态成本**（谁此刻属于
  哪条线、冲突时听谁的）；这类状态必须显式化，否则就是 MAST 里的信息不对称失败。
- **恒久度评估**：**高（原则）/ 待证（证据）**——双形态组织是管理学几十年验证的
  结构，但 LLM-MAS 语境下的系统对比数据缺失，待补调研。

---

## 3. 失败模式汇总（跨来源）

MAST（Why Do Multi-Agent LLM Systems Fail?）——从 7 个主流框架的 1600+ 条轨迹中
人工标注出 **14 种失败模式、3 大类**：(i) 系统设计问题、(ii) 代理间错位
（inter-agent misalignment）、(iii) 任务验证缺失；标注一致性 kappa=0.88 [14]。
三大类与组织形态直接相关：

| 失败类别 | 代表模式 | 组织层对策（来源） |
|---|---|---|
| 系统设计 | 角色定义含糊、无验证环节 | SOP 显式化 + 中间产物 schema 化 [12]；编排行加专门验证岗（Anthropic 系统里独立 CitationAgent 负责引用核验 [2]） |
| 代理间错位 | 「Ignored other agent's input」、信息扣留（information withholding）、无产出空转对话（「unproductive exchanges, consuming computational resources without meaningful progress」）[14] | 任务简报四要素硬约束；共享台账让状态可见 [2][14] |
| 任务验证 | 无人检查产出、错误晚发现 | evaluator–optimizer 式独立评审环 [1]；验证角色配高档模型（见 §4） |

其他高频实证失败（Anthropic 生产系统）与修法 [2]：
- **过度动员**：早期版本对简单问题「spawning 50 subagents for simple queries」→
  prompt 内置 scaling rules；
- **重复劳动**：模糊简报导致两个子代理查同一件事 → 每个子任务给定「objective、
  output format、tools and sources、task boundaries」四要素；
- **传话失真**（LangChain 基准）：supervisor 转述子代理答案 → 直通转发
  （forward_message）[7][8]；
- **无限搜索**：不存在的来源搜个不停 → 停止条件与起点放宽策略 [2]；
- **计划丢失**：长任务上下文超窗被截断 → 计划落盘 Memory [2]。

---

## 4. Token / 成本实践（恒久成本结构）

1. **多 agent 是溢价架构，且有实测乘数**：「agents typically use about 4× more
   tokens than chat interactions」而「multi-agent systems use about 15× more
   tokens than chats」[2]。同时 token 用量本身解释了 BrowseComp 上 80% 的性能方差
   （token、工具调用数、模型选择合计解释 95%）[2]——多花的 token 确实买性能，
   但要按价值回本（「the value of the task is high enough to pay for the increased
   performance」[2]）。
2. **上下文隔离是第一省钱机制**：LangChain 概念页量化——多域任务中 subagents
   （上下文隔离）模式比整上下文模式「processing 67% fewer tokens overall due to
   context isolation」；有状态模式（handoffs/skills）在重复请求上「save 40–50%
   of calls」[6]。Swarm 的「任一时刻只有活跃 agent 的指令在上下文」是同一原则的
   协议化 [5]。
3. **按岗配档（per-role model tiering）**：官方系统反复出现「协调/评审高档、执行
   低档」的混搭——Anthropic 研究系统用 Opus 4 做 lead + Sonnet 4 做子代理，胜过
   单代理 Opus 4 达 90.2%（内部研究评测）[2]；OpenAI 指南明言「Not every task
   requires the smartest model」，先用强模型原型、再逐岗换小模型找「仍能胜任」
   的下限 [3]。MetaGPT 论文亦有「GPT-4 配管理/评审岗、GPT-3.5 配执行岗」的
   著名做法，但该句在本轮可达的 v7 摘要中不存在、全文抓取超时——**[未经一手
   来源核验]**，见盲区 2。
4. **模型升级 vs 预算翻倍**：Anthropic 实测「Upgrading to Sonnet 4 yielded a
   bigger performance gain than doubling the token budget on Sonnet 3.7」[2]——
   预算该优先花在关键岗位的模型档位上，而不是全域加量。这一条同时是「全顶配」
   选项的注脚：顶配要花在刀刃岗。
5. **级联降级链（cascade）**：FrugalGPT——「LLM cascade」按 query 逐级尝试便宜
   模型、必要时升级，「can match the performance of the best individual LLM
   (e.g. GPT-4) with up to 98% cost reduction」[15]。与 routing（先分类后分流）
   互补：Anthropic 的 routing 工作流即「send easy queries to smaller models
   (Haiku) and hard ones to more capable models (Sonnet)」[1]。
6. **编排层的减税手段**：`last_message` 回传模式、消息直通转发、更好的 handoff
   工具命名——三项合计在 LangChain 基准上带来近 50% 性能提升 [7][8]；原则是
   「协调者读摘要，不读全史；用户读原文，不读转述」。
7. **并行省钱**：lead 一次 spawn 3–5 个子代理、子代理并发用 3+ 工具，复杂查询
   研究时间最多降 90% [2]——省的是墙钟时间与往返轮次，不省 token 总量。

---

## 5. 恒久度总评：什么不随模型更迭过时

**恒久（可作设计地基）：**
- 入场纪律：单 agent 优先，多 agent 是溢价选项 [1][3][14]；
- 分解—委派—合成（P1）、SOP 显式化与中间产物验证（P2）、单向 handoff + 指令切换
  （P3）、按难度动态动员 + scaling rules（P5）[1][2][12][3][5]；
- 任务简报四要素：objective / output format / tools and sources / task boundaries
  [2]；
- 成本结构：上下文隔离省钱、编排层花钱、按岗配档、级联降级 [2][3][5][6][15]；
- 失败分类学（MAST 三类 14 式）与对策映射 [14]；
- 通信拓扑决定扩展上限（广播 → 定向异步消息）[11]。

**速朽（只作证据，不作设计依赖）：**
- 具体框架 API 与库名：Swarm 已被 OpenAI Agents SDK 替代 [5]、AutoGen 0.2→0.4
  整体重写 [11]、LangGraph 文档站迁移 + langgraph-supervisor 官方建议弃库自建
  [8]；
- 具体模型名与配对（Opus/Sonnet/GPT-4 等只证明「分档」有效，不固化档位）；
- 具体评分算法与基准数字（随研究迭代）。

---

## 6. 对 dsh-bots 的适用性初判

背景锚点：DeepSeek Harness 上的 cordis 插件；小规模常驻 bot 团队（现 4 实例）；
终景＝「目标→团队自治」主轴 + 常态值守双形态；用户按岗指派不同档位 LLM。

1. **常态值守 → P3 扁平对等，不上编排层**。值守是低干扰域场景，LangChain 基准
   明示此时单代理/简单结构反而更优、token 更省 [7]；每 bot 即一个专职单 agent，
   bot 间用 handoff 式转交（换指令、传历史、单向）[3][5]。4 实例规模下广播群聊
   （P4）虽可用，但按 AutoGen 的教训不宜作为增长路径 [11]。
2. **目标→团队自治 → P1 supervisor / 编排者—工人，按需拉起**。目标形态的触发
   条件应对照 Anthropic 三要件（重并行 / 超单窗信息 / 多工具面）[2]；拉起时从
   常驻岗里选人（项目经理 = 高档模型岗），子任务简报强制四要素，动员规模写死
   scaling rules（防 50 子代理病）[2]。产出回笼常驻岗沉淀（职能线的记忆就是这
   样积累的）。
3. **双形态叠加 = P7 矩阵**：常驻职能线（值守 Home）+ 目标项目线（临时编组），
   共享同一批 bot。**该映射本轮缺直接文献支撑**（盲区 1），初判性质：可行性来自
   其组件模式（P1/P3/P5）各自有硬证据，风险点是双线的优先级冲突——需「单一时刻
   单一任务归属 + 冲突上抛用户」的显式规则，否则落入 MAST 的代理间错位类失败
   [14]。
4. **按岗配档直接落地**：协调/计划/评审岗配高档（Anthropic：lead 用最强、工人
   用次强，+90.2% [2]；升级档位优于预算翻倍 [2]），值守/执行岗配低档；省钱模式
   加 FrugalGPT 式级联（简单值守事件低档自理、不确定再升级）[15]；「全顶配」
   选项的理性形态＝只把协调与评审岗拉满 [3]。
5. **协议设计优先于框架选型**：dsh-bots 作为 harness 插件应固化的是 handoff 语义、
   任务简报 schema、共享台账、scaling rules、last_message 式回传减税 [2][3][5][8]
   ——这些全部不绑定具体框架；任何框架（含 DeepSeek 生态内的）都只是这些协议的
   实现载体。
6. **规模红线**：两级层级（P2 深树）在 4 实例团队无必要；supervisor 的传话税在
   用户直连场景要用直通转发规避 [7][8]；若未来常驻团队增长，先把广播式 bot 间
   通信改为定向消息（AutoGen v0.4 的教训）[11]。

---

## 7. 引用来源（本轮实际核验的一手来源）

1. Anthropic — *Building Effective Agents*（工作流/代理模式谱系、routing、简单性纪律）：
   https://www.anthropic.com/engineering/building-effective-agents
2. Anthropic — *How we built our multi-agent research system*（orchestrator-worker、15×/4× token、scaling rules、失败与修法、Opus+Sonnet 配对）：
   https://www.anthropic.com/engineering/built-multi-agent-research-system
3. OpenAI — *A practical guide to building agents*（单 agent 优先、manager vs decentralized、模型降档）：
   https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
4. OpenAI Agents SDK 文档 — *Orchestration*（agents-as-tools vs handoffs 语义）：
   https://openai.github.io/openai-agents-python/multi_agent/
5. OpenAI Swarm（教学框架 README；两原语、活跃指令切换）：
   https://github.com/openai/swarm
6. LangChain 文档 — *Multi-agent systems*（subagents 模式、上下文隔离 67%、状态化省 40–50%）：
   https://docs.langchain.com/oss/python/langchain/multi-agent
7. LangChain 官方博客 — *Benchmarking multi-agent architectures*（supervisor vs swarm vs 单代理；token 对比；传话效应）：
   https://www.langchain.com/blog/benchmarking-multi-agent-architectures
8. langgraph-supervisor 官方 README（建议弃库自建、output_mode、forward_message）：
   https://github.com/langchain-ai/langgraph-supervisor-py
9. CrewAI 文档 — *Crews*（hierarchical process、manager_llm/manager_agent）：
   https://docs.crewai.com/concepts/crews
10. Wu et al. — *AutoGen*（conversable agents，arXiv:2308.08155）：
    https://arxiv.org/abs/2308.08155
11. Microsoft Research — *AutoGen v0.4* 重写公告（异步事件驱动、可观测性动机）：
    https://www.microsoft.com/en-us/research/blog/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/
12. Hong et al. — *MetaGPT*（SOP→prompt 序列、装配线、中间结果验证，arXiv:2308.00352）：
    https://arxiv.org/abs/2308.00352
13. Li et al. — *CAMEL*（role-playing、inception prompting，arXiv:2303.17760）：
    https://arxiv.org/abs/2303.17760
14. Cemri et al. — *Why Do Multi-Agent LLM Systems Fail?*（MAST 分类学，arXiv:2503.13657；摘要+HTML 全文）：
    https://arxiv.org/abs/2503.13657 （全文：https://arxiv.org/html/2503.13657v1）
15. Chen et al. — *FrugalGPT*（级联、98% 降本，arXiv:2305.05176）：
    https://arxiv.org/abs/2305.05176
16. Liu et al. — *DyLAN*（动态选队、Agent Importance Score，arXiv:2310.02170）：
    https://arxiv.org/abs/2310.02170
17. Chen et al. — *AgentVerse*（动态组队、涌现行为治理，arXiv:2308.10848）：
    https://arxiv.org/abs/2308.10848
18. Li et al. — *More Agents Is All You Need*（采样-投票随人数扩展，arXiv:2402.05120）：
    https://arxiv.org/abs/2402.05120
19. Qian et al. — *ChatDev*（chat chain、communicative dehallucination，arXiv:2307.07924）：
    https://arxiv.org/abs/2307.07924
20. Talaei et al. — *Magentic-One*（Orchestrator 计划-追踪-再计划、模块化增删成员，arXiv:2411.04468）：
    https://arxiv.org/abs/2411.04468

（注：正文方括号编号 [n] 对应本表序号；正文引号内英文均为来源原文摘录。）

---

## 8. 盲区清单（暂定稿遗留，待网络可用时补充调研）

以下来源本轮不可达或未核验，对应结论已就地降级标注；后续调研轮按此清单补：

1. **OrgAgent（arXiv:2604.01020，Organize Your Multi-Agent System like a Company）**
   ——两次抓取超时。缺：矩阵/公司制组织在 LLM-MAS 的直接方法与实验数据。
   影响：§2 P7 矩阵模式整节降为「推理 + 管理学通则」。补研动作：抓摘要+方法节，
   核验其对 functional/project/matrix 的系统对比。
2. **MetaGPT 全文（arXiv:2308.00352 HTML，v7）**——抓取超时；当前摘要无配档/成本
   句。缺：按岗配档（GPT-4→管理/评审、GPT-3.5→员工）与「每软件 $2.0→$0.2」成本
   数字的一手核验。影响：§4 第 3 条相应部分标注 [未经一手来源核验]。
3. **Anthropic — Effective Context Engineering 博客**——404/超时。缺：compaction、
   子代理上下文管理的官方细节数据（对「上下文隔离」一章可加深）。
4. **MAST 全文图 2 的各失败模式百分比**——HTML 版图片未渲染。缺：14 种模式的
   占比分布（正文只保留了「no single error category disproportionately
   dominates」的定性结论 [14]）。
5. **OpenAI 实操指南 PDF 原件**——WebFetch 不支持 application/pdf。已用官方 HTML
   版替代核验；缺：PDF 页码级引用与 HTML 版未包含的图示。
6. **langgraph-swarm README、LangGraph 旧概念页**——旧站 JS 重定向不可抓，swarm
   库 README 本轮未取。P3 的 swarm 证据目前依赖 LangChain 基准博客与 OpenAI
   Swarm README。
7. **GPTSwarm（arXiv:2402.16823）、MacNet 可扩展多代理协作（arXiv:2406.07155）**
   ——未调研。缺：图结构/可优化拓扑的规模化证据（对「通信拓扑决定扩展上限」
   可再加硬数据）。
8. **ChatDev 全文**——摘要已核验，全文未取。缺：dual-role prompting 细节与每软件
   成本数字的一手核验。
