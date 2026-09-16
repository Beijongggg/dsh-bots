# 补充调研：组织模式报告盲区 1–8

Type: research
Status: resolved（2026-09-16 认领并决议：子代理 research 技能执行，主会话逐条抽验）

## Question

`research/org-patterns.md`（01 号票产物）是**网络受限下的暂定稿**：§8 盲区清单 8 项
未取到一手来源，对应正文结论已就地降级标注（如 §2 P7 矩阵模式整节降为「结构推理＋
管理学通则」、§4 第 3 条部分标 `[未经一手来源核验]`）。2026-09-16 用户声明网络
可用，开本轮补充调研。

**网络可用的当下，逐项重查这份清单的 8 处来源，给出每一处对应的正文结论该
升级、维持还是下调**——依据只能是一手来源（论文原文／官方文档／原始 README），
每条附可核验坐标与原文摘录。

重点三处（下游票直接压在其上，须最先给出结论）：

1. **盲区 1 · OrgAgent（arXiv:2604.01020）**——矩阵/公司制组织在 LLM-MAS 的
   直接方法与实验数据。03 号票的「值守线／项目线共享同一批实例」映射、CONTEXT.md
   的对应词条，均标「推理，缺直接文献」；本轮须判该映射现在是否拿到直接文献支撑。
2. **盲区 2 · MetaGPT 全文（arXiv:2308.00352）**——按岗配档（GPT-4 管理/评审、
   GPT-3.5 员工）与「每软件 $2.0→$0.2」成本数字的一手核验（§4 第 3 条现为降级态）。
3. **盲区 4 · MAST 全文图 2 各失败模式占比**——现正文只有「无单一类别占绝对多数」的
   定性结论；04/05 号票的「多数可由协议预防」压在 MAST 分类学上。

其余五处：盲区 3 Anthropic *Effective Context Engineering* 博客（compaction／子代理
上下文管理细节）、盲区 5 OpenAI 实操指南 PDF 原件（页码级引用）、盲区 6 langgraph-swarm
README 与 LangGraph 旧概念页、盲区 7 GPTSwarm（arXiv:2402.16823）与 MacNet
（arXiv:2406.07155）拓扑规模化证据、盲区 8 ChatDev 全文（dual-role prompting 与成本）。

## 环境事实（本轮采集，供执行者直接用）

- 直连可达：arxiv.org（含 abs 与 HTML 全文）、anthropic.com、cdn.openai.com PDF、
  platform.claude.com、docs.letta.com、modelcontextprotocol.io、api.github.com。
- **不可达**：`github.com` 与 `raw.githubusercontent.com` 直连超时（`curl` 28）；
  GitHub 托管内容改走 `https://api.github.com/repos/<owner>/<repo>/contents/<path>`
  （`Accept: application/vnd.github.raw`）——实测可取 openai/swarm README 全文。
- `WebFetch` 对部分 arXiv abs 页抽取可能返回空文本（实测 2604.01020）；退路是
  `curl` 抓 HTML 后本地提取。
- 本地 `127.0.0.1:7898`（Steam++ 助手）对 github.com 返回 `CONNECT tunnel failed, 502`，
  不构成可用通道。

## Output

研究报告落 `.scratch/org-v2/research/org-patterns-supplement.md`（本仓 research 产物
落盘的既成约定，即上游 throwaway branch 的本地化）：逐条「原降级标注 → 本轮一手证据
（URL＋原文摘录）→ 结论方向（升级／维持／下调）」＋新增来源清单＋仍不可达项与原因。

## Answer

补充调研完成：§8 盲区 8 项逐项取到一手来源（19 份首次到手材料），每项判方向。
全文报告：[../research/org-patterns-supplement.md](../research/org-patterns-supplement.md)。

**方向总表**：盲区 1 矩阵节 **维持降级**（相邻子论点局部升级）／盲区 2 MetaGPT
**下调**（两个具体事实无一手支撑，应删）／盲区 3 Anthropic 上下文工程 **升级**／
盲区 4 MAST 占比 **升级**／盲区 5 OpenAI PDF **升级**（页码级）／盲区 6
langgraph-swarm **升级**（旧概念页属站点迁移性消失，非网络限制）／盲区 7
GPTSwarm＋MacNet **升级**／盲区 8 ChatDev **双结论**（dual-role 细节升级、
每软件成本数字下调）。

**压在 03 号票上的（头部 1）**：**OrgAgent 不研究矩阵**——§3.1 限定句
"In this paper, we focus on two common forms in management: **flat organization
and a hierarchical organization**"；全文实验是 flat vs hierarchical 三层公司制，
「matrix」全文仅 1 次、在 §2 Related Work 文献罗列句（引 Galbraith 1971）且紧接
声明该文献"does not explain how structure should be instantiated … in LLM-based
multi-agent systems"。可局部升级的是 §3.2"The same set of agents can be reused
under different organizational settings"＋§3.3 六人技能池——那是**单线复用**，
不是「一个池子同时服务两条汇报线」。**⇒ 「值守线／项目线共享同一批实例」映射
仍无直接文献，性质仍是 `[推理]`**；上游记「摘要提及 Galbraith」的坐标亦误（在 §2）。

**压在 04/05 号票上的（头部 3）**：MAST 各模式占比**拿到且是正文文字**（非只能读图）：
v3 §4 逐条给出 14 项百分比，最大单项 FM-1.3 step repetitions **15.7%**、无一项超 16%；
FC1/2/3 三类合计 44.2 / 32.35 / 23.5%（三类合计为 14 个正文数字相加所得，属 `[推理]`
计算）。**图号须修正**：占比图是 **Figure 1**，v3 的 Figure 2 是方法学流程。
另取到直供 04/05 的 §5.3 一手句："many MAS failures arise from the challenges in
**organizational design and agent coordination** rather than the limitations of
individual agents" ＋ 干预实验 +9.4% / +15.6%。

**须下单的事实更正（头部 2）**：MetaGPT v7 全文**没有按岗配档句**（`GPT-3.5` 只出现在
backend 对比实验与 HumanEval 敏感性实验），**没有 $2.0→$0.2 这组数字**——一手成本数字是
Table 3 expense `$0.915 / $1.059 / $1.204 / $1.251 / $1.385`、附录 Table 9 Avg. `$1.12`。
⇒ §4 第 3 条挂在 MetaGPT 名下的配档句与成本数字**应删**；「按岗配档」论点改挂
Anthropic [2] 与 OpenAI 指南 PDF **p8**（本轮页码级核验）。

**版本漂移**：上游引 MAST v1，本轮 arXiv 提供 **v3**（2025-10-26）——正文引用均按版本落款。
ChatDev v5、MetaGPT v7、GPTSwarm v3、MacNet v3、OrgAgent v1。

**方向裁决（升级/维持/下调）与正文改写**：本票只出证据与建议，**合并定稿与撤标注归
16 号票**（`.scratch/org-v2/issues/16-report-finalization.md`）。

## Comments

- **授权依据**：用户 2026-09-16 声明网络可用（"网络代理已经提供，测试。可用则启动
  补全"）——即 map.md Notes 所悬置的「补全轮」。本票由 /wayfinder 认领，按 map 技能
  约定由子代理 call the Skill tool with "research" 执行。
- **执行**：子代理（research 技能）全程 `curl`＋`WebFetch` 取一手源，PDF 走本地
  `pdftotext`；产出 `research/org-patterns-supplement.md`（338 行）。
- **主会话独立抽验（先验证再断言，逐条实跑）**：
  - OrgAgent：`curl https://arxiv.org/html/2604.01020v1`（212,834 B）→ §3.1
    「flat organization and a hierarchical organization」限定句与 §2 矩阵文献句均在，
    **矩阵无实验数据成立**。
  - MetaGPT：`curl https://arxiv.org/html/2308.00352v7`（535,020 B）→ `GPT-3.5`
    仅命中实验语境、全文唯一美元数字 `$1.12`、无 `$2.0`／`$0.2`，**配档句与成本数字
    无一手支撑成立**。
  - MAST：`curl https://arxiv.org/html/2503.13657v3`（1,780,024 B）→ FM-1.3 15.7%
    等 12 项百分比逐条在正文；`belief`／`diverg` 命中 **0 / 0**；`organizational design
    and agent coordination` 句逐字在 §5.3；Figure 1＝占比、Figure 2＝方法学流程，
    **图号更正成立**。
- **环境更正**：本票 §「环境事实」记 `github.com` 与 `raw.githubusercontent.com`
  直连超时——执行体实测复现（`curl exit=28`），改走 `api.github.com` contents API
  全部成功；`langgraph-swarm` README 在 `libs/swarm` 路径已 404（路径已迁移）。
