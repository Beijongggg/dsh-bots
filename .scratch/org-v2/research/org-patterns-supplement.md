# 组织模式报告盲区补充调研（盲区 1–8 逐项一手核验）—— 研究报告

- 票据：`.scratch/org-v2/issues/14-supplement-org-patterns.md`（Type: research）
- 上游：`research/org-patterns.md`（01 号票产物，2026-09-08 网络受限下的**暂定稿**，§8 盲区清单 8 项）
- 本轮采集日：**2026-09-16**（用户声明网络可用后的补充轮）
- 性质：补充调研。本文件只做两件事——给盲区清单 8 项配一手来源与原文摘录、给每项对应正文结论判方向（升级／维持／下调）。**不修改上游报告正文**（合并与定稿属 16 号票）。
- 判定口径：`升级`＝上游的降级标注可撤，结论改挂一手来源；`维持`＝降级标注保留；`下调`＝连原来的表述都应弱化或删除（一手来源不但没支撑，反而反证）。

---

## 0. 头部结论（下游三票压在其中的三处，先读这里）

**头部问题 1 —— OrgAgent 有没有系统对比 functional / project / matrix？有没有「一个 agent 池服务两条线」的实验数据？**
**都没有。** 该文的一手全文（arXiv:2604.01020v1，HTML 全文已取）在 §3.1 明确限定只研究两种形态：

> "In this paper, we focus on two common forms in management: **flat organization and a hierarchical organization**, because they represent two contrasting ways of organizing collective work."（§3.1 Organizational Structures in Management）

全文实验是 **flat vs hierarchical（三层公司制：governance / execution / compliance）**，不是 functional / project / matrix。「matrix」在全文只出现一次，位于 §2 Related Work 的文献罗列句（引 Galbraith 1971），且紧接着声明这类文献解决不了 MAS 的问题。因此 **03 号票的「值守线／项目线共享同一批实例」映射仍无直接文献**，该映射性质仍是 `[推理]`。
唯一可局部升级的相邻证据：同一批 agent 可复用于不同组织形式、且存在技能池（§3.2、§3.3，见下文），但这是**同一池子在不同时段被配置成不同单线结构**，不是「一个池子同时服务两条汇报线」。

**头部问题 2 —— MetaGPT 的「GPT-4 管理/评审、GPT-3.5 员工」与「每软件 $2.0→$0.2」能否一手核验？**
**不能，且应下调。** v7 全文（arXiv:2308.00352v7，2024-11-01）中 `GPT-3.5` 只出现在两处：附录「不同 LLM 作 backend」的对比实验（Table 5）与 HumanEval 的 prompt 敏感性实验；**没有任何按岗配档句**。全文也没有 $2.0 / $0.2 这组数字；一手成本数字是别的量级（Table 3 expense `$0.915 / $1.059 / $1.204 / $1.251 / $1.385`；附录 Table 9 的 Avg. 行 **`$1.12`**）。v1、v2 摘要（均已取）亦无该数字或配档句；仓库 README 只有配置片段 `model: "gpt-4-turbo"  # or gpt-3.5-turbo`。
→ §4 第 3 条里挂在 MetaGPT 名下的那两个具体事实应删除；「按岗配档」论点只能落在 Anthropic [2] 与 OpenAI 指南（PDF p8，本轮已页码级核验）。

**头部问题 3 —— MAST 各失败模式占比拿到了吗？**
**拿到了，是正文可引的一手数据**（不是只能读图）。arXiv:2503.13657v3（2025-10-26）§4 正文逐条给出 14 种模式的百分比（见 §2 盲区 4）：最大单项 FM-1.3 step repetitions **15.7%**，无任何模式超过 16%；FC1/FC2/FC3 三类合计 **44.2% / 32.35% / 23.5%**（三类合计为本轮按正文 14 个数字相加所得，属 `[推理]` 计算）。
→ 上游「no single error category disproportionately dominates」的定性结论**成立且可加强**；「多数失败可由协议预防」另有 §5.3 + 干预实验支撑（同节引用）。

### 方向总表

| 盲区 | 对应上游正文结论 | 方向 |
|---|---|---|
| 1 · OrgAgent | §2 P7 矩阵节、§0 TL;DR 第 5 条、§6 第 3 条 | **维持降级**（子论点「同一池复用＋技能池」局部升级为有相邻一手证据） |
| 2 · MetaGPT 全文 | §4 第 3 条（部分 `[未经一手来源核验]`） | **下调**（配档句与两个成本数字均无一手支撑） |
| 3 · Anthropic 上下文工程博客 | §3 失败表、§4 第 2 条（上下文隔离） | **升级** |
| 4 · MAST 占比分布 | §3 失败分类学、§4 第 1 条 | **升级** |
| 5 · OpenAI 指南 PDF | §1、§2 P1/P3、§4 第 3 条 | **升级**（页码级引用到手；PDF 图示确为 HTML 版所缺） |
| 6 · langgraph-swarm README / LangGraph 旧概念页 | §2 P3、§4 第 6 条 | **升级**（旧概念页改为引新站，属站点迁移非网络限制） |
| 7 · GPTSwarm / MacNet | §2 P4 恒久度、§5「通信拓扑决定扩展上限」 | **升级** |
| 8 · ChatDev 全文 | §2 P2（chat chain / 双角色）、§8 第 8 条的成本数字 | 双结论：**dual-role 细节升级；每软件成本数字下调** |

---

## 1. 本轮网络条件（实测，供后续轮复用）

**可达且本轮实际取到原文**：`arxiv.org`（`/abs/` 与 `/html/` 全文均通，未再遇到 404/超时）、`cdn.openai.com`（PDF，HTTP 200，7,335,065 B）、`anthropic.com`、`docs.langchain.com`、`api.github.com`（`Accept: application/vnd.github.raw` 取任意仓库文件全文）、`www.bing.com`（搜索页 HTTP 200，但为国内版、结果经本地化过滤，只用来定位来源线索，未用于任何事实断言）。

**不可达（本轮实测原始报错）**：
- `https://github.com/openai/swarm` → `curl exit=28`（超时，`http=000`）；
- `https://raw.githubusercontent.com/openai/swarm/main/README.md` → `curl exit=28`；
- `https://html.duckduckgo.com/html/?q=test` → `curl exit=28`（无可用通用搜索退路）。
- 说明：本轮执行体**没有 WebSearch 工具**（工具面只有 WebFetch + shell），故「WebSearch 是否限流」无从测得；替代搜索路径为 Bing 网页（可用但受限），事实核验一律回一手来源。

**WebFetch 的表现**：对 `openai.com` 指南 HTML 页抽取正常（用于回答「图示是否缺失」）；对 arXiv 无水问题本轮未复现（全程改用 `curl` + 本地抽取，PDF 走本地 `pdftotext -layout`，图示文本因此可读）。

**版本漂移提示**：上游报告引的是 `https://arxiv.org/html/2503.13657v1`，本轮 arXiv 提供的是 **v3**（2025-10-26）；MetaGPT 为 **v7**、ChatDev 为 **v5**、GPTSwarm 为 **v3**、MacNet 为 **v3**、OrgAgent 为 **v1**。正文引用的百分比/页码均标明版本。

---

## 2. 逐项复核

### 盲区 1 · OrgAgent（arXiv:2604.01020）——矩阵/公司制组织在 LLM-MAS 的方法与实验数据

**原降级标注（逐字）**
- §2 P7「一手证据」（报告 189–193 行）："**本轮不可达**。搜索定位到 OrgAgent（arXiv 2604.01020，「Organize Your Multi-Agent System like a Company」，摘要提及 Galbraith 矩阵组织「combine functional and project forms」），但两次抓取均超时——无法核验其方法与数据（盲区 1）。以下判断属**结构推理 + 管理学通则**，[未经一手来源核验]。"
- §2 P7「恒久度评估」："**高（原则）/ 待证（证据）**——双形态组织是管理学几十年验证的结构，但 LLM-MAS 语境下的系统对比数据缺失，待补调研。"
- §0 TL;DR 第 5 条："双形态叠加正好构成矩阵组织（职能线值守 + 项目线目标），但矩阵的 agent 领域直接学术证据本轮不可达（盲区 1），该判断属推理。"
- §6 第 3 条："**该映射本轮缺直接文献支撑**（盲区 1）……"
- §8 第 1 条："缺：矩阵/公司制组织在 LLM-MAS 的直接方法与实验数据。"

**本轮一手证据**（`https://arxiv.org/html/2604.01020`，v1，2026-04-01；作者 Wang, Yiru; Shen, Xinyue; Han, Yaohui; Backes, Michael; Chen, Pin-Yu; Ho, Tsung-Yi；CUHK / IBM Research / CISPA）

1）**该文不研究矩阵，只对比 flat vs hierarchical**（§3.1，决定性句）：
> "In management research, different structures shape how decisions are made and how work is controlled (Mintzberg, 1979). In this paper, we focus on **two common forms in management: flat organization and a hierarchical organization**, because they represent two contrasting ways of organizing collective work."

2）**「matrix」全文只出现在 §2 Related Work 的文献罗列**（非研究对象，且作者明确说这段文献帮不上 MAS）：
> "Classic and contemporary work studies how different structural forms distribute authority, coordination, and specialization, including functional, hierarchical, and **matrix arrangements** (Duncan, 1979; Galbraith, 1971; Kates and Galbraith, 2010; Anand and Daft, 2007). ... However, this literature primarily concerns human organizations and **does not explain how structure should be instantiated for within-task governance in LLM-based multi-agent systems**."

（附注：上游报告称「摘要提及 Galbraith 矩阵组织」——**位置有误**。摘要无此句；参考文献条目为 Galbraith, J. R. (1971) *"Matrix organization designs how to combine functional and project forms."*，位于 §2 引文处。属表述位置修正，不改变判定。）

3）**有一处「同一批 agent / 技能池」的相邻证据，但只是单线复用**（§3.2、§3.3）：
> "**The same set of agents can be reused under different organizational settings**, while their interaction patterns may vary across frameworks."（§3.2 Agents）
> "Our framework maintains **a pool of six skill-based workers, which can serve as either the Drafter or the Specialist** during execution."（§3.3 Skill-Based Worker Pool：Technical / Quantitative / Reasoning / Domain / Communications / Data）

4）**实验体量与结论方向**（§5.1、摘要）：flat vs hierarchical 的对比，证据是「层级制更好且更省 token」：
> "On SQuAD 2.0, the gains are even larger, reaching **120.47%, 102.73%, and 58.96% over flat MAS** for GPT-5mini, GPT-OSS-120B, and LLaMA-3.1-8B, respectively."（§5.1）
> "token usage decreases consistently across all three benchmarks and all three models, with **reductions ranging from 46.38% to 79.31%**."（§5.1；摘要中 SQuAD 2.0 单条为 "improves performance over flat multi-agent system by 102.73% while reducing token usage by 74.52%"）
> 反向证据亦存：MuSR 上 "hierarchical coordination is **not uniformly dominant** across all reasoning tasks"（§5.1）。

**结论方向：维持降级（矩阵整体）／局部升级（同池复用子论点）**
一句话理由：OrgAgent 提供了「组织形式本身影响效果与成本」的一手实验数据，但其对比轴是 flat ↔ hierarchical，**不构成矩阵证据**；可升级的只有「同一批 agent 复用于不同组织形式 + 技能池」这一子论点，双汇报映射仍须按 `[推理]` 处理。

---

### 盲区 2 · MetaGPT 全文（arXiv:2308.00352）——按岗配档与每软件成本

**原降级标注（逐字）**
- §4 第 3 条（报告 249–251 行）："MetaGPT 论文亦有「GPT-4 配管理/评审岗、GPT-3.5 配执行岗」的著名做法，但该句在本轮可达的 v7 摘要中不存在、全文抓取超时——**[未经一手来源核验]**，见盲区 2。"
- §8 第 2 条："缺：按岗配档（GPT-4→管理/评审、GPT-3.5→员工）与「每软件 $2.0→$0.2」成本数字的一手核验。影响：§4 第 3 条相应部分标注 [未经一手来源核验]。"

**本轮一手证据**
- 全文：`https://arxiv.org/html/2308.00352`（**v7**，2024-11-01）✅ 完整取到；
- 早期版本摘要：`https://arxiv.org/abs/2308.00352v1`、`...v2` ✅（仅有摘要）；
- 仓库 README：`https://api.github.com/repos/geekan/MetaGPT/contents/README.md` ✅。

1）**没有按岗配档句**。全文对 `GPT-3.5` 的提及只有两类，均非「按岗配档」：
> "To verify the performance of MetaGPT on different LLMs, we randomly selected 5 SoftwareDev tasks and conducted experiments using **GPT-3.5 and Deepseek Coder 33B as backends**. As shown in Table 5, the results indicate that although MetaGPT can complete tasks with these LLMs, **using GPT-4 as the backend yields superior performance**."（附录 C/Table 5；Table 5 行为 MetaGPT (w/ GPT-3.5) / (w/ GPT-4) / (w/ Deepseek Coder 33B)）
> 另一处是 HumanEval 的 prompt/解析敏感性实验（"It is difficult for GPT-3.5-Turbo to return the correct completion code without prompt words"）。
> README 中 `gpt-3.5-turbo` 只作为配置注释出现：`model: "gpt-4-turbo"  # or gpt-3.5-turbo`。

2）**没有 $2.0 / $0.2 这组数字**，一手成本数字是：
- Table 3（角色消融，SoftwareDev 子集）Expense 列：`$0.915 / $1.059 / $1.204 / $1.251 / $1.385`；
- 附录 Table 9（纯 MetaGPT w/o feedback，SoftwareDev 抽样任务）money costs：`$1.09, $1.35, $1.04, $1.01, $1.30, $1.51, $0.90, $0.92, $1.27, $1.27, $0.92`；**Avg.（70 任务平均）行 = `$1.12`**；
- 与 ChatDev 的对比走的是 Token/时间/人工返修次数，不是单价：Table 1 中 ChatDev token 19,292、MetaGPT 31,255，但 Productivity（每行代码 token）126.5/124.3 vs 248.9，Human Revision Cost 0.83 vs 2.5。
- v1/v2 摘要均无成本数字与配档句。

3）附带核查：该组数字在本轮也未在 ChatDev 侧找到一手出处（见盲区 8），即 **$2.0→$0.2 既非 MetaGPT 论文口径也非 ChatDev 论文口径**，疑为二次转述或其它文献数字，本轮未找到一手来源。

**结论方向：下调**
一句话理由：一手全文（含 v1/v2 摘要与 README）同时否证了「按岗配档句」与「$2.0→$0.2」两个具体事实，§4 第 3 条应删除 MetaGPT 归因，仅保留 Anthropic [2] 与 OpenAI [3]（后者本轮已得页码级证据，见盲区 5）。

---

### 盲区 4 · MAST 全文各失败模式占比（arXiv:2503.13657）

**原降级标注（逐字）**
- §8 第 4 条："**MAST 全文图 2 的各失败模式百分比**——HTML 版图片未渲染。缺：14 种模式的占比分布（正文只保留了「no single error category disproportionately dominates」的定性结论 [14]）。"
- §3（报告 209–211 行）现只写："从 7 个主流框架的 1600+ 条轨迹中人工标注出 **14 种失败模式、3 大类**……标注一致性 kappa=0.88 [14]。"

**本轮一手证据**（`https://arxiv.org/html/2503.13657`，**v3**，2025-10-26）

1）**占比是正文文字，不只是图**（§4 The Multi-Agent System Failure Taxonomy，逐类列出）：
- FC1（System Design Issues）："failing to follow task requirements (**FM-1.1, 11.8%**) or agent roles (FM-1.2, 1.5%), step repetitions (**FM-1.3, 15.7%**), context loss (FM-1.4, 2.80%), or not recognizing task completion (FM-1.5, 12.4%)"；
- FC2（Inter-Agent Misalignment）："unexpected conversation resets (FM-2.1, 2.20%), proceeding with wrong assumptions instead of seeking clarification (FM-2.2, 6.80%), task derailment (FM-2.3, 7.40%), withholding crucial information (FM-2.4, 0.85%), ignoring other agents' input (FM-2.5, 1.90%), or mismatches between reasoning and action (**FM-2.6, 13.2%**)"；
- FC3（Task Verification）："premature termination (FM-3.1, 6.20%), no or incomplete verification (FM-3.2, 8.20%), or incorrect verification (FM-3.3, 9.10%)"。

2）**图的编号需修正**：v3 的 **Figure 2 是「方法学流程」（"Methodological workflow for constructing the MAST-Data dataset..."）**；带占比的失败模式图是 **Figure 1**，其题注即为数据口径：
> "Figure 1: MAST: A Taxonomy of MAS Failure Modes. ... **The percentages shown represent the prevalence of each failure mode and category as observed in our analysis of 1642 MAS execution traces.**"

3）**类别合计（本轮按上述 14 个数字相加，`[推理]`）**：FC1 **44.2%**、FC2 **32.35%**、FC3 **23.5%**（合计 100.05%，为原文各自四舍五入所致）。单项最大为 FM-1.3 = 15.7%。

4）**与 04/05 号票「多数可由协议预防」直接相关的一手句**（§5.3、§4）：
> "Consistent with organization theories, our findings indicate that **many MAS failures arise from the challenges in organizational design and agent coordination rather than the limitations of individual agents**. In our intervention case studies (Appendix H) ... we achieve **max improvements of 15.6%**."（§5.3）
> "Systems with **explicit verifiers** like MetaGPT and ChatDev generally show fewer total failures (Figure 4), indicating explicit checks help. However, the presence of a verifier is **not a silver bullet**..."（§4 FC3 段）
> 角色规格干预：ChatDev 同 prompt 同模型下角色规格改进 "yields a **+9.4%** success rate increase"（§4 FC1 段）；增加高层目标验证步 "yields a **+15.6%** improvement in task success on ProgramDev"（§4 FC3 段）。

**结论方向：升级**
一句话理由：14 种模式占比是 v3 正文（及 Figure 1 题注）的一手文字数据，上游「无单一类别占绝对多数」的定性判断成立且可补数字；只需记住占比图是 **Figure 1**（上游误记为图 2），图 2 是方法学流程图。

---

### 盲区 3 · Anthropic《Effective Context Engineering for AI Agents》

**原降级标注（逐字）**
- §8 第 3 条："**Anthropic — Effective Context Engineering 博客**——404/超时。缺：compaction、子代理上下文管理的官方细节数据（对「上下文隔离」一章可加深）。"
- 相关正文：§4 第 2 条「上下文隔离是第一省钱机制」现仅挂 [6]（LangChain 67%）与 [5]（Swarm 指令切换）。

**本轮一手证据**（`https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`，页面标注 **Published Sep 29, 2025**；HTTP 200，全文取到）

1）**compaction（压缩）——上游要的官方细节全在**：
> "**Compaction is the practice of taking a conversation nearing the context window limit, summarizing its contents, and reinitiating a new context window with the summary.** Compaction typically serves as the first lever in context engineering to drive better long-term coherence."
> "In Claude Code, for example, we implement this by passing the message history to the model to summarize and compress the most critical details. **The model preserves architectural decisions, unresolved bugs, and implementation details while discarding redundant tool outputs or messages.** The agent can then continue with **this compressed context plus the five most recently accessed files**."
> "The art of compaction lies in the selection of what to keep versus what to discard, as **overly aggressive compaction can result in the loss of subtle but critical context** whose importance only becomes apparent later. ... Start by **maximizing recall** ... then iterate to improve precision..."
> "One of the safest lightest touch forms of compaction is **tool result clearing**, most recently launched as a feature on the Claude Developer Platform."

2）**子代理上下文管理（与 §4「上下文隔离」直接对应，含 token 量级）**：
> "**Sub-agent architectures** ... Rather than one agent attempting to maintain state across an entire project, specialized sub-agents can handle focused tasks with **clean context windows**. The main agent coordinates with a high-level plan while subagents perform deep technical work ... Each subagent might explore extensively, using tens of thousands of tokens or more, but **returns only a condensed, distilled summary of its work (often 1,000-2,000 tokens)**."
> "This approach achieves a clear **separation of concerns**—the detailed search context remains isolated within sub-agents, while the lead agent focuses on synthesizing and analyzing the results. This pattern, discussed in *How we built our multi-agent research system*, **showed a substantial improvement over single-agent systems on complex research tasks**."

3）**第三根杠杆：结构化笔记（agentic memory）**："the agent regularly writes notes persisted to memory outside of the context window ... Like Claude Code creating a to-do list, or your custom agent maintaining a **NOTES.md** file"；并有 Sonnet 4.5 起公测的 memory tool。

4）**三选一的判据（可直接用于 dsh-bots 的形态选择）**：
> "Compaction maintains conversational flow for tasks requiring extensive back-and-forth; Note-taking excels for iterative development with clear milestones; **Multi-agent architectures handle complex research and analysis where parallel exploration pays dividends.**"

5）机制侧论据（对「上下文是有限预算」的官方表述）："context rot: as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases"；"LLMs have an 'attention budget' that they draw on when parsing large volumes of context"。

**结论方向：升级**
一句话理由：本轮取到全文，「上下文隔离」一章现在可以引 Anthropic 官方一手细节（compaction 保留/丢弃清单、五个最近文件、1,000–2,000 token 子代理摘要），不再只靠 LangChain 的 67% 二手量化。

---

### 盲区 5 · OpenAI《A Practical Guide to Building Agents》PDF 原件

**原降级标注（逐字）**
- §8 第 5 条："**OpenAI 实操指南 PDF 原件**——WebFetch 不支持 application/pdf。已用官方 HTML 版替代核验；缺：**PDF 页码级引用与 HTML 版未包含的图示**。"

**本轮一手证据**（`https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf`，HTTP 200，7,335,065 B，32 页；本地 `pdftotext -layout` 抽取）

- **p16（单 agent 优先，[3] 的核心句）**："When to consider creating multiple agents: **Our general recommendation is to maximize a single agent's capabilities first.** More agents can provide intuitive separation of concepts, but can introduce additional complexity and overhead, so often a single agent with tools is sufficient."
- **p8（按岗配档 / 模型降档，§4 第 3 条 [3] 的落点）**："Selecting your models ... **Not every task requires the smartest model**—a simple retrieval or intent classification task may be handled by a smaller, faster model, while harder tasks like deciding whether to approve a refund may benefit from a more capable model."；同页三步法："01 Set up evals to establish a performance baseline 02 Focus on meeting your accuracy target with the best models available **03 Optimize for cost and latency by replacing larger models with smaller ones where possible**"。
- **p17（P3 结构句，含「edges represent handoffs」）**："Decentralized (agents handing off to agents) **Multiple agents operate as peers, handing off to one another based on their specializations.** Multi-agent systems can be modeled as graphs, with agents represented as nodes. In the manager pattern, **edges represent tool calls** whereas in the decentralized pattern, **edges represent handoffs that transfer execution between agents**."
- **p21（handoff 语义，P3 的一手定义）**："In a decentralized pattern, agents can 'handoff' workflow execution to one another. **Handoffs are a one way transfer that allow an agent to delegate to another agent.** In the Agents SDK, a handoff is a type of tool, or function. ... while also **transferring the latest conversation state**. This pattern involves using **many agents on equal footing**..."
- **p23（分流场景与「专家接管」）**："This pattern is especially effective for scenarios like **conversation triage**, or whenever you prefer **specialized agents to fully take over certain tasks without the original agent needing to remain involved**."
- **p20（对显式图编排的反面意见，可用于 §6 第 5 条）**："...explicitly define every branch, loop, and conditional in the workflow upfront through graphs consisting of nodes (agents) and edges ... While beneficial for visual clarity, this approach can quickly become **cumbersome and challenging as workflows grow more dynamic and complex**."
- **图示核查（对应盲区 5 的后半句）**：本轮另取官方 HTML 版（`https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/`，经 WebFetch 抽取）——该页是 HTML 全文，但**不含实际图**，"It references one with 'In the diagram below,' but no image is present"。而 PDF 在 **p25** 有对应的「guardrails 分层防御」示意图（LLM 护栏 / 规则护栏 regex / Moderation API 三层合流后进入 agent 与 handoff），p17–p23 亦有 manager / decentralized 的模式示意。**「HTML 版缺图示」的判断成立**。

**结论方向：升级**
一句话理由：页码级引用到手（p8 / p16 / p17 / p21 / p23 / p25），且证实 PDF 里的分层护栏图与模式图正是官方 HTML 版引用而未渲染的部分。

---

### 盲区 6 · langgraph-swarm README 与 LangGraph 旧概念页

**原降级标注（逐字）**
- §8 第 6 条："**langgraph-swarm README、LangGraph 旧概念页**——旧站 JS 重定向不可抓，swarm 库 README 本轮未取。P3 的 swarm 证据目前依赖 LangChain 基准博客与 OpenAI Swarm README。"
- §2 P3 恒久度："也被 LangGraph swarm 官方库复用（搜索结果指向 langchain-ai/langgraph-swarm-py，**本轮未抓其 README**——见盲区 6）。"

**本轮一手证据**

1）**swarm 库 README 全文到手**（`https://api.github.com/repos/langchain-ai/langgraph-swarm-py/contents/README.md`，`Accept: application/vnd.github.raw`；仓库未归档，`pushed_at` 2026-07-15）：
> "A swarm is a type of multi-agent architecture where **agents dynamically hand off control to one another based on their specializations**. **The system remembers which agent was last active**, ensuring that on subsequent interactions, the conversation resumes with that agent."
> "by default `create_handoff_tool` passes **full** message history (all of the messages generated in the swarm up to this point)"
> "By default, individual agents are expected to communicate over a **single `messages` key that is shared by all agents** and the overall multi-agent swarm graph."
- 附：`langchain-ai/langgraph` 主仓的递归树（832 条路径）**没有 swarm 目录**，该库独立成 repo；这与上游报告 [8] 的 URL（langgraph-supervisor-py 的姊妹库）一致。

2）**旧概念页：不是网络限制，是站点迁移**。`https://langchain-ai.github.io/langgraph/concepts/multi_agent/` 返回 HTTP 200 但只有 549 B 的跳转壳：
> `<link rel="canonical" href="https://docs.langchain.com/oss/python/langgraph/graph-api">` + `<script>location.href="https://docs.langchain.com/oss/python/langgraph/graph-api"...</script>`
即旧 multi_agent 概念页已不存在，被重定向到 graph-api；`https://docs.langchain.com/oss/python/langgraph/multi-agent` 与 `.../langgraph/swarm` 均 404。

3）**新站现状（对 P3 命名的影响）**：`https://docs.langchain.com/oss/python/langchain/multi-agent`（HTTP 200，即上游 [6]）可用，但**全文已无 "swarm"、"supervisor" 二词**，模式表改为 Subagents / **Handoffs** / Skills / Router；上游 [6] 的两个量化结论仍在，措辞变为：
> "**Subagents processes 67% fewer tokens overall due to context isolation.**"
> "Key insight: **Stateful patterns (Handoffs, Skills) save 40-50% of calls on repeat requests.**"
另 `.scratch` 侧同源的 handoffs / subagents 子页（`/oss/python/langchain/multi-agent/handoffs`）亦 **0 次**出现 "swarm"。

4）**顺带复核上游 [8] 与 [5]（均为一手，本轮续证）**：
- langgraph-supervisor-py README（`api.github.com/.../langgraph-supervisor-py/contents/README.md`）："**We now recommend using the supervisor pattern directly via tools rather than this library for most use cases.** The tool-calling approach gives you more control over context engineering..."；`output_mode="full_history" / "last_message"` 仍在；`create_forward_message_tool`："**It saves tokens for the supervisor and avoids potential misrepresentation of the worker's response through paraphrasing.**"——上游 P1 的「弃库自建」与两个减税手段均属实。
- openai/swarm README（`api.github.com/repos/openai/swarm/contents/README.md`）："Swarm is now **replaced by** the OpenAI Agents SDK"；"**Only the `instructions` of the active `Agent` will be present at any given time** (e.g. if there is an `Agent` handoff, the `system` prompt will change, but the chat history will not.)"——上游 P3 的活跃指令切换说法属实。

**结论方向：升级（并改引新站）**
一句话理由：swarm 库 README 的一手证据到手且与 P3 描述一致（含「记住最后活跃者」与「默认传全量历史」两个新细节）；旧概念页的不可达是**永久性站点迁移**（多 agent 概念页现属 `langchain` 路径），应改引 `docs.langchain.com/oss/python/langchain/multi-agent`。命名从 swarm/supervisor 退场、只剩 handoffs/subagents，反过来强化了上游「API 速朽、原则恒存」的判断。

---

### 盲区 7 · GPTSwarm（arXiv:2402.16823）与 MacNet 可扩展多代理协作（arXiv:2406.07155）

**原降级标注（逐字）**
- §8 第 7 条："**GPTSwarm（arXiv:2402.16823）、MacNet 可扩展多代理协作（arXiv:2406.07155）**——未调研。缺：**图结构/可优化拓扑的规模化证据**（对「通信拓扑决定扩展上限」可再加硬数据）。"
- 对应正文：§2 P4 恒久度「**通信拓扑决定扩展上限**」与 §5「恒久（可作设计地基）」清单最后一条，现仅挂 [11]（AutoGen v0.4 重写公告）。

**本轮一手证据**

1）**GPTSwarm（v3，2024-08-22，HTML 全文）**——拓扑是**可优化的对象**：
> 摘要："We unify these approaches by describing LLM-based agents as **computational graphs**. ... Our novel automatic graph optimizers (1) refine node-level LLM prompts (node optimization) and (2) **improve agent orchestration by changing graph connectivity (edge optimization)**."
> Figure 1 题注："When connected, multiple agents form a composite graph with **a certain orchestration topology**."
> §3.1.1（对抗设置）："we demonstrate that **edge optimization effectively filters adversarial agents from a swarm**, mirroring a scenario in multi-agent systems where some agents are detrimental rather than beneficial."
> §3.1（MMLU 协作设置）："The optimized swarm improves over the baseline ... **by 2.1% ± 1.1%** averaged over 5 training seeds."（原文数学符号在 HTML 抽取中丢失，此处按正文句式还原）
> §3.2（Mini Crosswords）："Our hypothesis is that **edge connections can meaningfully determine the algorithmic structure**. Through edge optimization, we anticipate the automatic discovery and implementation of high-performance algorithms."
> §3.4（GAIA 表）：GPTSwarm 平均 **18.45** vs GPT-4-Turbo **9.70**，表内 "Improvement ... **90.2%**"；同节量化了规模代价："the time requirement of a swarm **grows approximately linearly with the number of agents**. **Despite the increased computational time, incorporating more agents notably improves the overall performance of the system.**"

2）**MacNet（v3，2025-03-17，HTML 全文）**——**>1000 agent 的拓扑化协作与「抑制广播」的机制解释**：
> 摘要："we utilize **directed acyclic graphs** to organize agents into a multi-agent collaboration network (MacNet), upon which their interactive reasoning is **topologically orchestrated** ... it effectively supports **collaboration among over a thousand agents, with irregular topologies outperforming regular ones**. We also identify **a collaborative scaling law**—the overall performance follows a **logistic growth pattern** as agents scale..."
> §2（机制，正对「拓扑决定上限」）："each round involves two adjacent agents refining a previous artifact, and **only the refined artifact, rather than the entire dialogue, is propagated to the next rounds**. This **prevents global broadcasting and suppresses context explosion, thereby enhancing collaboration scalability for much larger networks**."
> §3.2（拓扑对比，密度/形状/方向三视角）："**no single topology consistently excels across all tasks.** For instance, a **chain topology is more suitable for software development, while a tree topology is ideal for creative writing**."；"higher interaction density ... correlates with improved average performance"；"**random topologies consume approximately 51.92% less time than mesh topologies**"；"star-shaped topologies that are 'wider' tend to perform better than 'deeper' tree-shaped ones ... may cause deeper topologies to **lose track of distant agents**"；"merely **reversing the directions** of specific topologies can lead to significant performance degradation"（方向视角）。

**结论方向：升级**
一句话理由：上游「通信拓扑决定扩展上限」现在有两条硬数据与一条机制解释——MacNet 的 DAG 拓扑化 +「只传精炼产物、不做全局广播」使 >1000 agent 可行（irregular > regular，logistic scaling law），GPTSwarm 的拓扑可被显式优化（edge optimization 可剔除对抗性 agent）且 agent 数与时间近似线性。

---

### 盲区 8 · ChatDev 全文（arXiv:2307.07924）——dual-role prompting 与每软件成本

**原降级标注（逐字）**
- §8 第 8 条："**ChatDev 全文**——摘要已核验，全文未取。缺：**dual-role prompting 细节与每软件成本数字**的一手核验。"
- 对应正文：§2 P2「ChatDev 用「chat chain」把瀑布模型的各阶段改造成由双角色对话完成的单元 [19]」。

**本轮一手证据**（`https://arxiv.org/html/2307.07924`，**v5**，2024-06-05，HTML 全文）

1）**dual-role prompting 细节（§3 / §3.1 / §3.2）**：
> "In every subtask, **two agents**, each with their own specialized roles ..., perform the functions of an **instructor** and an **assistant**. The instructor agent initiates instructions ... while the assistant agent adheres to these instructions and responds with appropriate solutions."
> "**The dual-agent communication design simplifies communications by avoiding complex multi-agent topologies**, effectively streamlining the consensus-reaching process."
> "ChatDev implements prompt engineering that **only takes place at the start of each subtask round**. As soon as the communication phase begins, the instructor and the assistant will communicate with each other in an automated loop, continuing this exchange until the task concludes."
> §3.1 Chat Chain："ChatDev thus adopts the core principles of **the waterfall model**, using a chat chain with sequential phases, each comprising sequential subtasks ... segments the software development process into **three sequential phases: design, coding, and testing**."
> §3.2 角色反转（communicative dehallucination）："our communicative dehallucination mechanism features a deliberate **'role reversal'**, where the **assistant takes on an instructor-like role**, proactively seeking more specific information (e.g., the precise name of an external dependency and its related class) before delivering a conclusive response."

2）**实现参数（§4 Implementation Details）**："We divided software development into **5 subtasks within 3 phases** ... A subtask would terminate and get a conclusion either after **two unchanged code modifications or after 10 rounds of communication**. ... We used **ChatGPT-3.5** with a **temperature of 0.2** and integrated Python-3.11.4 for feedback."

3）**每软件成本数字：全文不存在**。`cost` 在全文只出现两处，其中一处正是作者**主动弱化「成本」这一评价维度**的表述（§4.1，紧接 Table 3 之后）：
> "Taking all these factors together, we posit that **the fundamental characteristics of multi-agent software development take on greater significance, surpassing short-term concerns like time and economic costs in the current landscape**."
> （另一处为 §6 Limitations，讨论「Human Revision Cost Hong et al. (2023)」类指标的评测困难。）
- 仓库 README（`api.github.com/repos/OpenBMB/ChatDev/contents/README.md`）亦无每软件成本，只有 2023-11-15 的定性表述："build software efficiently at a **very low cost** and remove the barrier to entry"。

**结论方向：dual-role 细节升级 ／ 每软件成本数字下调**
一句话理由：chat chain + 双角色（instructor/assistant）+ 角色反转的机制细节已一手到手，可替代上游的摘要级引用；而「每软件成本」在 ChatDev 论文中**根本不以数字形式存在**（作者明示其评价重心不在成本），故该期望项应从盲区清单移除而非继续等待。

---

## 3. 正文其余就地降级标注的复核（非 §8 独有）

对上游报告全文检索 `未经一手来源核验` / `推理` / `缺直接文献支撑` / `待证`，命中 6 处，全部落在盲区 1、2 上，无孤儿项：

| 位置 | 标注 | 本轮处置 |
|---|---|---|
| §0 TL;DR 第 5 条（27 行） | 「矩阵的 agent 领域直接学术证据本轮不可达（盲区 1），该判断属推理」 | 见盲区 1：**维持** `[推理]`，且已确认 OrgAgent 不是矩阵证据 |
| §2 P7 一手证据段（189–193 行） | 「本轮不可达…[未经一手来源核验]」 | 见盲区 1：**维持降级**（可补 OrgAgent v1 全文坐标与「不研究矩阵」的一手反证） |
| §2 P7 恒久度（202 行） | 「高（原则）/ 待证（证据）」 | **维持**：「待证」仍准确，且本轮证伪了最接近的候选来源 |
| §4 第 3 条（249–251 行） | 「MetaGPT…**[未经一手来源核验]**，见盲区 2」 | **下调**（见盲区 2）：该句应删除归因，而非撤降级 |
| §6 第 3 条（305 行） | 「该映射本轮缺直接文献支撑（盲区 1）」 | **维持**（同 §2 P7） |
| 开头「性质」段（5–6 行） | 暂定稿声明与 `[未经一手来源核验]` 约定 | **保留机制**：本补充轮虽补齐 6/8 处，报告整体仍需 16 号票做合并与降级标注清理 |

**结论**：其余降级标注与盲区 1、2 完全重叠，无额外隐藏项；也就是说本轮 8 处复核即是全部降级面的复核。

---

## 4. 新增一手来源清单（本轮实际抓取；✅＝取到原文，⚠️＝仅部分/降级获取）

1. ✅ OrgAgent 全文（arXiv:2604.01020v1，2026-04-01）：https://arxiv.org/html/2604.01020
2. ✅ MetaGPT v7 全文（2024-11-01）：https://arxiv.org/html/2308.00352
3. ⚠️ MetaGPT v1/v2 摘要（仅摘要，用于确认早期版本亦无成本/配档句）：https://arxiv.org/abs/2308.00352v1 ；https://arxiv.org/abs/2308.00352v2
4. ✅ MetaGPT 官方 README：https://api.github.com/repos/geekan/MetaGPT/contents/README.md
5. ✅ Anthropic《Effective context engineering for AI agents》（Published Sep 29, 2025）：https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
6. ✅ MAST v3 全文（2025-10-26）：https://arxiv.org/html/2503.13657
7. ✅ OpenAI《A practical guide to building agents》PDF 原件（32 页，本地 pdftotext 页码级引用）：https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
8. ⚠️ 同指南官方 HTML 版（经 WebFetch 抽取，用于比对图示缺失）：https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
9. ✅ langgraph-swarm-py README 全文：https://api.github.com/repos/langchain-ai/langgraph-swarm-py/contents/README.md
10. ✅ langgraph-supervisor-py README 全文（复核上游 [8]）：https://api.github.com/repos/langchain-ai/langgraph-supervisor-py/contents/README.md
11. ✅ openai/swarm README 全文（复核上游 [5]）：https://api.github.com/repos/openai/swarm/contents/README.md
12. ✅ langchain-ai/langgraph 仓库递归树（用于确认 swarm 不在主仓）：https://api.github.com/repos/langchain-ai/langgraph/git/trees/main?recursive=1
13. ✅ LangChain 现站多 agent 概念页（上游 [6] 的现址）：https://docs.langchain.com/oss/python/langchain/multi-agent （另取 /handoffs 、/subagents 、/router 、/skills 子页）
14. ✅ LangGraph 旧概念页跳转壳（内容为 549 B 的 JS/meta 跳转）：https://langchain-ai.github.io/langgraph/concepts/multi_agent/
15. ✅ GPTSwarm v3 全文（2024-08-22）：https://arxiv.org/html/2402.16823
16. ✅ MacNet v3 全文（2025-03-17）：https://arxiv.org/html/2406.07155
17. ✅ ChatDev v5 全文（2024-06-05）：https://arxiv.org/html/2307.07924
18. ✅ ChatDev 官方 README：https://api.github.com/repos/OpenBMB/ChatDev/contents/README.md
19. ⚠️ Bing 网页搜索（HTTP 200，国内版且结果过滤；仅用于定位来源线索，**未用于任何事实断言**）：https://www.bing.com/search?q=...

---

## 5. 仍不可达项

| 目标 | 原始报错/现象 | 尝试过的路径 | 判定 |
|---|---|---|---|
| `github.com` 网页 | `curl exit=28`（超时，http=000） | 直连 `https://github.com/openai/swarm` | 结构性不可达；GitHub 内容一律改走 `api.github.com`（本轮 6 处全部成功） |
| `raw.githubusercontent.com` | `curl exit=28` | 直连 `openai/swarm/main/README.md` | 同上，用 contents API + `Accept: application/vnd.github.raw` 替代 |
| 通用搜索（DuckDuckGo HTML 端点） | `curl exit=28` | `https://html.duckduckgo.com/html/?q=...` | 不可达；本轮执行体亦**没有 WebSearch 工具**（故「WebSearch 是否限流」无法实测）。Bing 可用但为过滤版，只作线索定位 |
| LangGraph 旧概念页（原 URL） | HTTP 200 但仅 549 B 跳转壳，canonical 指向 `docs.langchain.com/oss/python/langgraph/graph-api` | 试 `/concepts/multi_agent/`、`/concepts/multi_agent`、旧站根；并试新站 `/oss/python/langgraph/multi-agent`、`/oss/python/langgraph/swarm`（均 404） | **永久性不可达**（站点迁移，非网络限制）：该页已不存在，引用应改指 `docs.langchain.com/oss/python/langchain/multi-agent` |
| MetaGPT「GPT-4 管理/评审、GPT-3.5 员工」句与「$2.0→$0.2 每软件」 | 非报错，而是**一手全文检索无命中** | v7 HTML 全文（含附录）、v1/v2 abs、仓库 README、ChatDev v5 全文与 README | 判定为**不存在于一手来源**，非「尚未取到」；见盲区 2、8 |
| MAST Figure 1 的图形本体 | 未做：题注与 §4 正文已含全部百分比数字 | 未渲染图形（HTML 内 SVG/图片未解析） | 不阻断结论：数字来源为题注 + 正文文字 |
| arXiv 数学排版 | 若干公式/±值在 HTML→文本抽取中丢失（如 GPTSwarm 的 2.1%±1.1%、Mini Crosswords 的绝对分数） | `curl` + 本地正则抽取；未改抓 PDF | 已用可读句法与表格数字替代；受影响处已在文中标注 |
