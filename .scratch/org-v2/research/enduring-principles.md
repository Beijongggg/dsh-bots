# 研究报告：agent 工程恒久原则——哪些组织设计被证明模型更迭不腐

- 票据：`issues/02-research-enduring-principles.md`
- 日期：2026-09-08
- 状态：**暂定稿（网络受限）**。本次会话外网可达性不稳定：多数一手来源已核验原文，
  少数不可达来源按约定未重试、记入 §6 盲区清单，留待补充调研轮复核。
- 标记约定：✅＝原文已核验（引文直接取自抓取到的页面/论文/PDF）；
  ⚠️＝模型自带知识补位，**未经一手来源核验**。

---

## 1. 核心结论（TL;DR）

把「组织形式脱离模型智能」拆成一个可操作的试金石：

> **一个设计编码的是「任务、环境与组织的事实」，还是「对某一代模型行为的假设」？
> 前者模型更迭不腐，后者必然随升级腐烂。**

由此导出八条经一手证据支撑的判据（§5 可直接进 v2 规格）：

1. **上下文恒稀缺**（context rot 是架构性的，预算与分层是结构而非权宜）；
2. **契约外置**（协议、文件、工具 schema 是跨模型的接口层：MCP / A2A / AGENTS.md）；
3. **最小充分指令，随模型升级做减法**（Anthropic 官方：格式重要性在下降、更强模型需更少规定）;
4. **移交＝显式契约**（objective＋输出格式＋工具/来源约束＋边界；共享完整轨迹而非单条消息）；
5. **单线程为默认，并行仅当上下文真正独立**（Cognition 两原则）；
6. **记忆分三层**：岗位记忆（结构化笔记＋可执行技能库）／团队共享（仓库文件）／知识库（按需检索）；
7. **验证外置于模型**（可执行检查＋fresh-context 独立复核，不信任口头断言）；
8. **组织形式的增益来自算力放大与专业化隔离，不来自「集体智能」**
   （Anthropic 实测：token 用量解释 80% 方差——多 agent 的收益本质是 token 放大）。

反面（§4）：edit-apply 模型、咒语式提示、按标称窗口设计、框架抽象层、指令文件膨胀、
滥用并行、摘要式移交、embeddings-RAG 长期记忆——都被实践或实验证明随模型更迭过时或本就低效。

---

## 2. 试金石的两大理论支柱

**Bitter Lesson（Sutton, 2019）✅**
「The biggest lesson that can be read from 70 years of AI research is that general methods
that leverage computation are ultimately the most effective, and by a large margin.」
且「the human-knowledge approach tends to complicate methods in ways that make them
less suited to taking advantage of general methods leveraging computation」。
对 v2 的转译：不要把「当前模型不会 X」的权宜补丁固化进组织形式；组织形式应设计成
**吃算力红利**的结构（分层检索、并行、按需加载都是多算力多受益的形状），
而不是绕过模型缺陷的形状。

**模型升级方向的官方证据（Anthropic 工程博客, 2025-09）✅**
「the exact formatting of prompts is likely becoming less important as models become
more capable」「smarter models require less prescriptive engineering, allowing agents
to operate with more autonomy」——即：依赖格式戏法与过度规定的设计正在被模型进步侵蚀；
依赖清晰目标、预算与工具的设计不会。

---

## 3. 分主题证据

### 3.1 Context engineering：预算与分层

| 判据 | 证据（均 ✅） | 来源 |
|---|---|---|
| 注意力是有限资源，预算化是结构必需 | 「LLMs have an 'attention budget'…」「Context…must be treated as a finite resource with diminishing marginal returns」 | Anthropic context engineering (2025-09-29) |
| 上下文腐烂（context rot）是架构性的 | 「performance is often highest when relevant information occurs at the beginning or end of the input context」且中段显著退化，长上下文专用模型亦然 | Lost in the Middle (arXiv:2307.03172) |
| 标称窗口 ≠ 有效窗口 | 「only half of them can maintain satisfactory performance at the length of 32K」；NIAH 检索近满分也照样崩 | RULER (arXiv:2404.06654, COLM 2024) |
| 分层＝主上下文/外存两级 | OS 式虚拟上下文管理：快内存（窗口）/慢内存（外置存储）间搬运；文档分析可「far exceed the underlying LLM's context window」 | MemGPT (arXiv:2310.08560) |
| 按需检索优于预加载 | 维持「lightweight identifiers (file paths, stored queries, web links)」，运行时再取数；子代理用「clean context windows」干活、「returns only a condensed, distilled summary (often 1,000-2,000 tokens)」 | Anthropic context engineering |
| 压缩是有损艺术 | compaction 的难点「lies in the selection of what to keep versus what to discard」；保留失败痕迹（keep the false in the context）有助复现与修正 | 同上；Manus (2025-07-17) |
| 稳定前缀有结构性收益 | prompt 前缀稳定、append-only，让 KV-cache 复用；「When tuning prompts for a new model, the previous version's KV cache is invalidated」→ 高频改词组是反模式 | Manus blog |
| TODO 列表即上下文重组 | 完成项在上下文中遮蔽（mask）为极简行，保持任务结构常新 | Manus blog |

**不腐点**：预算稀缺（attention 架构 + 训练分布偏向短序列）在可见模型代次没有消失迹象
（Anthropic 2025-09 仍在引用 context rot 做设计依据）；分层、压缩、按需检索
全部随模型变强而**更便宜**而非失效。

### 3.2 Handoff／移交契约

**Anthropic 多 agent 研究系统（2025-06-13）✅**——移交契约四要素的原句：
「Each subagent needs an objective, an output format, guidance on the tools and sources
to use, and clear task boundaries」。且模糊委托直接导致生产事故：
代理「duplicate work, leave gaps, or fail to find necessary information」。

**Cognition《Don't Build Multi-Agents》（2025-06-12, Walden Yan）✅**——两原则：
1. 「Share context, and share full agent traces, not just individual messages」
   （只转发单条消息/摘要＝各持分叉信念）；
2. 「Actions carry implicit decisions, and conflicting decisions carry bad results」
   （不可逆动作是决策的载体，并行决策互相冲突即翻车）。
默认形态＝单线程线性 agent；确需子代理时，只让其**回答问题**、不让其**执行动作**
（并引用 Claude Code 子代理 2025-06 的实际形态佐证）。

**OpenAI Agents SDK handoffs ✅**——handoff 对模型呈现为工具
（`transfer_to_<agent_name>`）；默认「gets to see the entire previous conversation history」，
需要裁剪时用显式 `input_filter`（`HandoffInputData`），即**默认全量、裁剪显式声明**。

**MAST 失败分类学（arXiv:2503.13657, v3 2025-10）✅（摘要）**——
150 条轨迹、14 种失败模式归 3 类，第 2 类即 **inter-agent misalignment**；
且多 agent 系统在流行基准上的收益「often minimal」。
（正文关于「信念分叉」机制与特定框架表现的细节未核验，见 §6。）

**协议层的移交契约：A2A（Google, 2025-04-09）✅**——
Agent Card（JSON：身份/描述/鉴权）做发现；task 生命周期以 **Artifacts** 交付而非裸消息；
长任务允许「hours or even days」；执行对调用方不透明（opaque execution），
即契约只约定**输入/输出/状态**，不约定对端内部实现（框架/厂商/模型无关）。
与 MCP 的分工：A2A 管 agent↔agent 互操作，MCP 管 agent↔工具/资源接入。

**不腐点**：契约四要素、全轨迹共享（或显式裁剪）、以产物而非对话状态移交——
这些约定的是**组织事实**，与模型能力无关；模型越强，执行契约的可靠性越高。

### 3.3 组织记忆：岗位记忆 vs 团队共享上下文 vs 知识库

| 层 | 不腐形态 | 证据（✅ 除标注外） |
|---|---|---|
| 岗位记忆（role memory） | 结构化笔记：代理把要点写到窗口外的持久文件，「agent regularly writes notes persisted to memory outside of the context window」「persistent memory with minimal overhead」 | Anthropic context engineering |
| 岗位技能（role skills） | 可执行技能库：代码即知识，「ever-growing skill library of executable code for storing and retrieving complex behaviors」，技能「interpret­able, and compositional」；技能库可零样本迁移到新环境复用 | Voyager (arXiv:2305.16291) |
| 团队共享上下文 | 仓库根目录的开放文件标准（AGENTS.md）：无必填 schema、就近文件优先、明确「README for agents」定位；被 Codex/Gemini CLI/Cursor/Devin/Factory 等 20+ 工具采纳、6 万+ 仓库使用，归 Linux 基金会下 Agentic AI Foundation 治理 | agents.md |
| 团队共享上下文的纪律 | CLAUDE.md 逐行试金石：「Would removing this cause Claude to make mistakes?」；「Bloated CLAUDE.md files cause Claude to ignore your actual instructions!」；该文件「compounds in value over time」 | Claude Code best practices（现居 code.claude.com/docs） |
| 知识库（KB） | 记忆流＋检索＋反思三件套：「store a complete record of the agent's experiences」、动态检索做规划、「synthesize those memories over time into higher-level reflections」，消融实验三件都关键 | Generative Agents (arXiv:2304.03442) |
| 知识库反模式 | embeddings-RAG 长期记忆在 agent 实战中「nearly useless」（Manus 主张，单家经验，采用时标注）；替代＝replay＋LLM 摘要（folding），无需微调 | Manus ⚠️（单家主张，非共识） |

**分层依据（MemGPT ✅）**：主上下文＝寄存器/主存，外置记忆＝磁盘；
分层的存在理由是窗口稀缺，而非模型不会记忆——所以模型变强只会放宽层间搬运的频率，
不会取消分层。

**不腐点**：文件落盘＋版本库管理（AGENTS.md 类）的团队记忆已跨 20+ 异构 agent 生态存活；
可执行技能库（代码/命令）天然与模型解耦（换模型＝换解释器用户，不动技能资产本身）。

### 3.4 组织形式脱离模型智能

- **多 agent 的增益来源是算力/token 放大，不是「集体智能」**✅：
  Anthropic 实测「token usage by itself explains 80% of the variance」，
  多 agent 系统「use about 15× more tokens than chats」；
  单 agent→多 agent 提升 90.2% 主要来自并行 token 预算。
  → 组织形式的价值＝隔离上下文＋并行放大小径＋专业化契约，这些都不依赖模型智商。
- **复杂度递增原则**✅：Anthropic「the most successful implementations use simple,
  composable patterns rather than complex frameworks」；OpenAI 指南收尾：
  「starting with a single agent and evolving to multi-agent systems only when needed」。
- **模型选型是岗位细节而非组织结构**✅：OpenAI「build your agent prototype with the
  most capable model for every task to establish a performance baseline. From there,
  try swapping in smaller models to see if they still achieve acceptable results」
  ——岗位可换模型，契约与流程不动。
- **工具面是跨模型的稳定接口**✅：MCP 自述为「an open-source standard for connecting
  AI applications to external systems」，被 Claude、ChatGPT、VS Code、Cursor 等共同支持
  （"build once and integrate everywhere"）。Anthropic 工具设计文（2025-09-11）：
  「More tools don't always lead to better outcomes」、工具过多/重叠会「distract agents」，
  且「We expect the effective context length of agents to grow over time, but the need
  for context-efficient tools to remain」——**显式预测：上下文效率要求在模型变强后仍然成立**。
- **组织知识入指令优于入模型**✅（OpenAI 指南）：「use existing operating procedures,
  support scripts, or policy documents to create LLM-friendly routines」——SOP 外置为可审计文本。
  MetaGPT 的立论同向（✅ 摘要）：「encodes Standardized Operating Procedures (SOPs) into
  prompt sequences」，对抗「cascading hallucinations caused by naively chaining LLMs」，
  关键机制是「verify intermediate results and reduce errors」。
- **验证外置**✅：Claude Code 最佳实践「Give Claude a check it can run: tests, a build,
  a screenshot to compare」；复核用 fresh-context 子代理「sees only the diff and the
  criteria you give it」——门控是环境事实，与被检模型无关。

---

## 4. 反例清单：被证明随模型过时（或本就低效）的做法

| # | 做法 | 为什么腐 | 证据 |
|---|---|---|---|
| R1 | **edit-apply 修复模型**（为旧模型设计的上下文修补流程） | 2025 代模型原生能力覆盖后，整套流程变冗余——作者自述亲手淘汰 | Cognition ✅（作者亲述其 2024 实践被 2025 模型淘汰） |
| R2 | **咒语式提示优化**（OPRO 在 PaLM 2L 上发现 "Take a deep breath and work on this problem step-by-step"，GSM8K 80.2 vs 71.8） | 绑定特定模型代次；Anthropic 官方确认格式戏法重要性随能力提升而下降 | OPRO (arXiv:2309.03409) ✅；Anthropic ✅ |
| R3 | **按标称窗口设计预算** | NIAH 近满分也只代表检索；聚合/多跳任务 32K 即崩（半数模型） | RULER ✅ |
| R4 | **框架抽象层/自动编排** | 「extra layers of abstraction that can obscure the underlying prompts and responses」；MAST：多 agent 系统收益 often minimal（正文框架对比细节未核验） | Anthropic ✅；MAST 摘要 ✅ |
| R5 | **指令文件膨胀**（复制人类文档进 agent 记忆） | 指令稀释：膨胀文件导致模型忽略真实指令 | Claude Code best practices ✅ |
| R6 | **滥用并行多 agent**（“协作越多人越聪明”） | 50 个子代理答简单查询、无休止搜索；模糊委托→重复/遗漏；无独立上下文的并行＝冲突决策 | Anthropic ✅；Cognition ✅ |
| R7 | **摘要式移交**（只传结论不传轨迹） | 接收方持有分叉信念，冲突决策不可见 | Cognition ✅；MAST inter-agent misalignment ✅ |
| R8 | **embeddings-RAG 作长期记忆** | 单家实战判定近无用，改为 replay/压缩；至少说明该形态未被证明不腐 | Manus ⚠️（单家主张） |
| R9 | OpenAI Swarm 类实验框架被产品化 SDK 取代 | 生命周期短；handoff 概念被保留（不腐的是概念，不是实现） | ⚠️ 未经核验（Swarm README 未抓取） |
| R10 | **微调承载岗位行为/知识** | Bitter Lesson 推论：把人类知识烧进参数使其难以吃后续算力红利、且绑定基模快照；此为推论而非论文直证 | Sutton ✅＋推论 ⚠️ |

共同病理：以上做法都在编码「当前模型的行为假设」（它的注意力偏置、它的格式敏感、
它缺的能力），而不是「组织与任务的事实」。模型一升级，假设失效，设计随之作废。

---

## 5. 可进 v2 规格的判据清单（条款式）

> 供 03–08 号票直接引用。每条后括注证据锚点（详见 §3/§4）。

- **D1 预算分层**：每岗位显式定义上下文预算与分层——常驻最小集＋按需检索标识符
  （file paths / queries / links）＋外置记忆；预算按**有效**上下文而非标称窗口计。
  （Lost in the Middle、RULER、MemGPT、Anthropic CE）
- **D2 稳定前缀**：岗位提示词与工具表采用稳定前缀＋append-only 演进；改岗位细节不改结构
  （缓存经济性＋防漂移）。（Manus）
- **D3 移交契约**：一切跨岗位移交走四要素契约——objective、output format、
  工具与来源约束、task boundaries；默认共享完整轨迹，任何裁剪必须显式声明。
  （Anthropic MA 系统、Cognition、Agents SDK）
- **D4 并行条件**：默认单线程线性；仅当子任务上下文真正独立时并行，且并行方只产信息
  （回答问题/产出摘要），不可逆动作收归单线程。（Cognition、Anthropic 故障模式）
- **D5 岗位记忆**：结构化笔记＋可执行技能库（代码/命令/探针），文件落盘、入版本库；
  技能资产与模型解耦，模型更迭只换执行者。（Anthropic CE、Voyager）
- **D6 团队共享上下文**：走仓库文件与开放格式（AGENTS.md 类），逐行过
  「删掉会不会出错」试金石；禁止进任何模型私有通道。（agents.md、Claude Code BP）
- **D7 验证外置**：每岗位产出配可执行检查（测试/构建/截图比对）；复核用 fresh context
  只看 diff＋标准，报告 gaps not style。（Claude Code BP、MAST、MetaGPT）
- **D8 模型无关接口**：工具接入走标准协议（MCP 类），少量正交工具＋前缀命名空间；
  岗位描述不携带模型特定咒语或格式依赖。（MCP、Anthropic 工具设计文）
- **D9 升级例程**：模型更迭触发岗位评测；预期动作是**删指令**（做减法），
  删不掉的约束才沉淀进岗位记忆/技能库；沉淀物须模型无关。（Anthropic CE、
  OpenAI 指南「先用最强模型建基线」）
- **D10 复杂度递增**：单岗位能解就不加协调层；加层的唯一理由是上下文隔离或并行收益，
  且接受 token 成本（15×量级）为显式代价。（Building effective agents、OpenAI 指南、
  Anthropic 80% 方差）

---

## 6. 盲区清单（暂定稿遗留，待补充调研轮复核）

1. **Anthropic「Claude 4 best practices」**（platform.claude.com：区域封锁＋JS 渲染，
   两次通道均未取到正文）。应核验：①"empowerment vs control" 的原文表述；
   ②XML 标签、多示例、否定式指令（"do not"）在新模型上的官方退役指引；
   ③对 v2 岗位提示词基线的直接影响。
2. **MAST 论文正文**（arXiv:2503.13657，仅核验摘要）：inter-agent misalignment
   的「信念分叉」机制描述；「框架（AutoGen 等）搭建系统性能不及单 agent」的实验数据
   与适用边界。
3. **OpenAI Swarm→Agents SDK 演进史实**（R9 的 ⚠️）：Swarm README 的 experimental
   定位声明原文。
4. **Claude Code memory tool / context editing 平台特性**（platform.claude.com 不可达）：
   与 D5/D6 的边界划分（平台私有记忆 vs 仓库记忆）。
5. **Letta（MemGPT 后继）**的 memory blocks / sleep-time compute 产品文档：
   岗位记忆自动整理的工业实现参照。
6. **Anthropic 多 agent 系统的记忆附录**：本次抓取未见 mem0 共享/专属记忆架构描述，
   该印象疑为记忆混淆——需查证是否存在及其原始出处。
7. **横向时效面**：WebSearch 本次限流，未做 2026 年增量证据 survey
   （Cursor/Windsurf 规则系统演进、A2A 最新版本、MCP 注册表治理现状）。
8. **OpenAI 指南「hidden predicate」表述**：在该 PDF 全文中未检出，疑出自另一 OpenAI
   文档——已弃用该说法，如需引用须先找到真实出处。

---

## 7. 参考来源

（✅＝本次已抓取原文并引用；日期为来源发表/提交时间）

1. ✅ Anthropic Engineering, *Effective context engineering for AI agents*, 2025-09-29.
   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
2. ✅ Anthropic Engineering, *Building effective agents*, 2024-12-19.
   https://www.anthropic.com/engineering/building-effective-agents
3. ✅ Anthropic Engineering, *How we built our multi-agent research system*, 2025-06-13.
   https://www.anthropic.com/engineering/built-multi-agent-research-system
4. ✅ Anthropic Engineering, *Writing effective tools for agents—using AI agents*, 2025-09-11.
   https://www.anthropic.com/engineering/writing-tools-for-agents
5. ✅ Claude Code docs, *Best practices*（含 CLAUDE.md 纪律、子代理、验证）.
   https://code.claude.com/docs/en/best-practices
6. ✅ Walden Yan (Cognition), *Don't Build Multi-Agents*, 2025-06-12.
   https://cognition.com/blog/dont-build-multi-agents
7. ✅ Yichao "Peak" Ji (Manus), *Context Engineering for AI Agents: Lessons from Building
   Manus*, 2025-07-17. https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
8. ✅ OpenAI, *A Practical Guide to Building Agents*（PDF，本地 pdftotext 提取）, 2025-03.
   https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
9. ✅ OpenAI Agents SDK docs, *Handoffs*.
   https://openai.github.io/openai-agents-python/handoffs/
10. ✅ Google Developers Blog, *Announcing the Agent2Agent Protocol (A2A)*, 2025-04-09.
    https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/
11. ✅ MCP 文档, *What is the Model Context Protocol?*
    https://modelcontextprotocol.io/introduction
12. ✅ AGENTS.md 开放标准. https://agents.md
13. ✅ Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*, 2023-07.
    https://arxiv.org/abs/2307.03172
14. ✅ Hsieh et al., *RULER: What's the Real Context Size of Your Long-Context Language
    Models?* COLM 2024. https://arxiv.org/abs/2404.06654
15. ✅ Packer et al., *MemGPT: Towards LLMs as Operating Systems*, 2023-10.
    https://arxiv.org/abs/2310.08560
16. ✅ Park et al., *Generative Agents: Interactive Simulacra of Human Behavior*, 2023-04.
    https://arxiv.org/abs/2304.03442
17. ✅ Hong et al., *MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework*,
    2023-08. https://arxiv.org/abs/2308.00352
18. ✅ Wang et al., *Voyager: An Open-Ended Embodied Agent with Large Language Models*,
    2023-05. https://arxiv.org/abs/2305.16291
19. ✅ Yang et al., *Large Language Models as Optimizers*（OPRO）, ICLR 2024.
    https://arxiv.org/abs/2309.03409
20. ✅ Cemri et al., *Why Do Multi-Agent LLM Systems Fail?*（MAST）, 2025-03（v3 2025-10）.
    https://arxiv.org/abs/2503.13657
21. ✅ Rich Sutton, *The Bitter Lesson*, 2019-03-13.
    http://www.incompleteideas.net/IncIdeas/BitterLesson.html
