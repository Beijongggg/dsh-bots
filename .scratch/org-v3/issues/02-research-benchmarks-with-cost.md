# Research: 带成本的公开基准与成本口径

Type: research
Status: resolved
Deliverable: `../research/benchmarks-and-cost-accounting.md`

## Question

用哪些公开基准可以把「额外消耗的 token 是否划算」量化？需要：①**分数与成本同时可得**（或
每任务成本可推导）的公开评测套件与榜单——候选族：GAIA、SWE-bench Verified、tau-bench／tau2-bench、
BrowseComp、HLE、Terminal-Bench、OSWorld、WebArena、MLE-bench、PaperBench、RE-Bench，以及
多 agent 专用套件；②每个套件测什么、分数住在哪、是否报成本、有无已发表的 **multi-agent vs
single-agent 双数字（分数＋成本）** 对照；③成本口径可复算性：token 四分量（uncached input／
output／cache read／cache write）是否可得，币值换算是否可比；④把组织自建任务集挂上公开基准的
**可比性判据**（同口径可直接比／口径不同只能分列，两种情形都要写清）。
明确排除：不设计新基准、不跑实验（那是实现批与验收实验的事）。

## 关闭判据

- 交付物落盘，含来源表与盲区清单；每条基准给「测什么／分数在哪／成本是否可得／已发表双数字有无」四栏。
- 至少一个已发表的 multi vs single 双数字对照（同集同模型），并注明其口径。
- 给出 Pod 自建卷与公开卷的**可比性判据**（可比／不可比分列），供 09／10 号票直接引用。
- `S3`：若查无任何「分数＋成本同时可得」的套件，明写该结论并给出退路口径（自建口径＋不可比声明）。

## 输入与依赖

- 与 01 号票第 5 节可能有重叠：01 交付物若已落盘，本票引用并**独立复核数字**，不重复采集。
- 子代理执行中（交付物直接落 `../research/`）；建图会话只派不判。

## Answer

**结论（2026-10-13；子代理采集 ＋ 建图会话抽验）**

1. **同时公开「分数＋成本」的公开套件只有两个**：`Terminal-Bench 4.0` 榜（RESOLUTION RATE／COST／TOKENS，
   n=330，榜 `updated_at` 2026-10-06）与 `HAL`（arXiv 2510.11977；必需字段含 `total_cost_usd`／`total_tokens`／
   cache 分量／`n_trials`／`pass@k`／`avg_trial_duration_sec`；21,730 rollouts／9 模型／9 套件／约 $40,000／
   2.5B tokens 日志）。其余候选（GAIA／SWE-bench Verified／τ²-bench／BrowseComp／HLE／OSWorld／WebArena／
   MLE-bench／PaperBench／RE-Bench）以分数为主，成本多不可得或另口径。
2. **成本由配置决定、不由任务决定**：Terminal-Bench 同分不同价——`Codex+GPT-6 Astra` 与 `Codex+GPT-6.1 Sol`
   同为 58.18%，成本 $3,267.18 vs $634.24（**5.15×**）；HAL 同分对照更极端——Scicode 9.2% @ $111.11 vs
   9.2% @ $1.74（**63.9×**）。HAL 论文：**36 次运行中 21 次**提高推理力度未提升准确率。
3. **token 不是成本的代理**（arXiv 2607.12161）：工具输出 token −38.4% 反使账单 **+6.8%**，相关系数 **r=0.15**；
   prompt cache 的创建与读取主导输入侧成本；该文给出口径＝**cost per successful task**。旁证：CLEAR
   （arXiv 2511.14136）相似精度成本差 50×、只优化准确率会贵 4.4–10.8×；AI Agents That Matter（arXiv 2407.01502）
   同精度成本差近两个数量级、LATS >50×。
4. **没有任何公开套件评测「组织」**：Terminal-Bench／HAL 评的是单进程 scaffold。省成本的工作
   （BAMAS −86%／AgentPrune $43.7→$5.6／BudgetMLAgent −94.2%／MasRouter −52.07%／AgentDropout −21.6%）
   都是**减、重排或路由工作**，不是加 agent；唯一直接测「朴素多 agent 扩编」的工作给出 MAD 优势「limited」
   （arXiv 2505.22960）。Anthropic 的 15× 是**相对 chats**、+90.2% 是**内部评测**（vendor，未独立复现）。
5. **可比性判据（`C1`–`C5`）**：同模型快照／同工具面／同 scaffold／同预算记账／同任务子集——五项全同才可直接比；
   **「组织 vs 单代理」必然违反 C3–C5**，唯一站得住的写法是**并排 Pareto 对**（同分比成本、同成本比分），
   不得写成单一倍数结论。无成本列时的退路见交付物 §5：只报组织自建口径并声明不可比。

**抽验记录（建图会话一手直取）**

- 逐字复核：arXiv `2607.12161` 摘要（−38.4% → +6.8%、r=0.15、"cost per successful task"）✔
- 逐字复核：arXiv `2510.11977` 摘要（21,730 rollouts／9 模型／9 套件／约 $40,000／2.5B tokens；
  "higher reasoning effort reducing accuracy in the majority of runs"）✔
- **未复核**（子代理采集）：Terminal-Bench 榜行值、HAL 站点同分对（Mind2Web／Scicode）、CLEAR、BAMAS、
  AgentPrune／BudgetMLAgent／MasRouter／AgentDropout 各数字、Anthropic vendor 数字——引用时按需回读交付物 §7 来源表。

**`S3` 判定：满足**（存在「分数与成本同时可得」的公开对照，且给出可比性判据）。

**判据 #2 以空结果关闭**：关闭判据第 2 条要求的「已发表的同集同模型 multi vs single 双数字对照」**查无**
（唯一接近者＝Anthropic 内部评测：+90.2%、15× **相对 chats**，vendor 且非受控对照）——按「空结果也是
结论」记录，不算未完成。

**对下游的影响**

- 09／10 解阻。`10` 的主判据应写 **cost per successful task ＋ 并排 Pareto**，并强制声明「组织 vs 单代理」
  为非同口径并排；倍数门槛只作**内部一致性检查**，不得当跨系统结论。
- `08` 的成本口径须含 **cache 分量**（Terminal-Bench 行内 96–98% 为 cached input）与失败重跑，
  否则「相变开销」会被系统性低估。
- `S2` 不受本票影响：相变的实测对照仍由 01 号票承担。

**偏离注记**：交付物 584 行，超题目 350–550 行目标；理由是表格（22 行套件清单／12 行榜行／18 行 HAL 对／
12 行预算论文／9 行可比性／15 行来源表）＋10 条盲区不可压缩而不丢已引证据——接受该偏离，由本票记录。
头部字段名由 `Status` 改为 `Document state`（③门 status-lint 口径），正文内容未动。
