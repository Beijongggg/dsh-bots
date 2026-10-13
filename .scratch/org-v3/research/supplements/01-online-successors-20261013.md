# 在线动态候选补核：MANTA、AgentConductor、MACA

引用三篇在线/动态候选的机制、切换信号、固定形态对照、已报成本与作者边界时，按 N1/N2/N3 读取对应证据。
采集于 2026-10-13，Asia/Shanghai；输入基线 `41e59b5`；实际模型标识以主会话记录为准。
范围为三篇 arXiv 全文（PDF 逐页核读；MANTA 另核 ar5iv HTML）。所有数字为作者报告或标明的算术复算，未运行论文代码、基准或模型。
本件只补原研究票的动态候选证据与缺口；S2 判定、任务内/迁移归属裁定、整票关闭与 Pod 适用性由主会话执行。

## 来源与快照

快照根目录 `/tmp/org-v3-w2-01-20261013/`；三篇均为一手来源（作者原文，v1）。访问日期 2026-10-13。
数字的原文位置按快照内 `[p…]` 页标记，对应该版本 PDF 页码。

| ID | 来源、版本、日期、作者 | 快照 | SHA256 |
|---|---|---|---|
| N1 | [MANTA](https://arxiv.org/abs/2607.28527)，v1，2026-07-30，MaoXun Huang 等 | PDF `alt-pdf-2607.28527.out`；页文本 `manta-pages.txt` | pdf `bfda0a03df4f37a3aad90dc18ab5d4f0bd20fa41cfd4d03d9218742db1d8b8cc`；txt `255a1f288cf6aaa007c8d3da1a9af672f3587f2a0f63f8029ed498e61ba4e4da` |
| N2 | [AgentConductor](https://arxiv.org/abs/2602.17100)，v1，2026-02-19，Siyu Wang 等 | PDF `pdf2-2602.17100.pdf`；页文本 `pages-2602.17100.txt` | pdf `ec81f81ab9e975ac6f81fcfa08e288b9bfa368acf4579ca88517aeb3ac5dff13`；txt `89af6d016d4f4e381a703155aac50642f193506f1dc1a121e9ac104b5cb792c8` |
| N3 | [MACA / Multi-Agent Coordination Adaptation via Structure-Guided Orchestration](https://arxiv.org/abs/2605.25746)，v1，2026-05-25，Haoran Li 等 | PDF `alt-pdf-2605.25746.out`；页文本 `pages-2605.25746.txt` | pdf `330488b12eb1dbf73df48babba7dddfbf191981b610d5ea9fe8cfc03aecc874e`；txt `1537fd35865a873ade0fa32c104867c679c7dfe4618877ab0f135d7a60676664` |

采集过程注记：N2 首个 PDF 响应为截断件（无 xref/EOF，`pdftotext` 拒读），弃用并重取 `pdf2-2602.17100.pdf`；只有重取件用于核验。
三篇编号与标题相符；N3 的 abs 页标题不含 "MACA" 字样，缩写来自摘要自述 "We introduce MACA"。

## N1 MANTA

- ①机制（p1 摘要；p4 正文 "Trace auditing and repair"；p13 附录 ops 表）：任务前由 Planner 从长期 playbook 生成任务条件化拓扑；运行中每 turn 结束后由 LLM Auditor 扫描 artifacts、工具记录、relay packet、confidence、未决问题与证据可见性，给出至多 3 个操作的 mutation（加/扩 agent、改 group pattern、增删 communication edge、改信息可见性），确定性代码校验角色/引用/嵌套/agent 预算后应用；两层记忆（单 run 短程 playbook＋跨 run 长程 playbook，Skill Reflector 每 N run 重写），学习回路从不接触 benchmark 答案（p4）。
- ②切换信号（p4）：修复门＝初始审计给出至少一条可修的中/高严重度 flag；无 flag 的 run 不触发。审计只判协作过程，不判答案对错；作者报 450 run 中未 flag 的正确率 83.2% vs 被 flag 的 62.5%，Auditor 识别 117 个错误中的 75 个，WorkBench F1 0.78（p11）。
- ③固定形态对照（原单元格）：Table 1（p5）5 benchmark×30 题×3 run，Gemma 4 31B medium effort——MANTA avg 74.0±1.8；最强静态臂 Orchestrator w/ Discussion 66.2；全表次优为自适应臂 ADAS 68.2；Single Agent 59.3。复算：74.0−68.2=5.8pp，即摘要 "strongest baseline" 指次优全表臂 ADAS，而非静态臂；对最强静态臂为 +7.8pp。Table 2（p5）4 基准消融：完整 71.7；把任务条件化初始拓扑换成固定 coordinator–worker 57.5；禁用 audit 触发 mutation 60.8。
- ④已报成本（原单元格与复算）：Table 4（p6）四基准每 run 平均 token——MANTA 推理 63,724 in＋13,928 out＝77,652，其中 9,416 meta-level＋68,236 inner-agent；静态臂 Single Agent 21,811、Voting 80,781、Orch(Discussion) 184,207；AFlow offline 132,517＋推理 18,553＝151,070；ADAS 247,675＋27,728＝275,403。meta 占比复算 9,416/77,652=12.13%，对应 p6 原句 "approximately 12%"；审计与修复未分开单列，无美元账。Table 2 另列完整 MANTA 94,811＋5,504＝100,315，表注 "include the amortized cost of batched long-term playbook updates"，与 Table 4 的 77,652 口径不同且文中未对账，两值并列记录。
- ⑤作者明确边界（原文）| 本包推断：作者未设 "Limitations" 节；p12 自认修复前后比较仅基于 audit 输出而非 benchmark 反事实（"not benchmark counterfactuals"），并提出两项补强（人工标注、等预算 paired replay）作为未来工作；干净 trace 只是可靠性信号，不是正确性保证（p11：严格条件下 85.8% vs corpus 74.0%）。｜[推断] 该包成本主张止于 token 口径，未给切换/审计的金额与延迟账。
- 分类（本包判断，附依据）：**任务前选形**（p1 "Before execution, MANTA initializes a task-conditioned topology from prior structural experience"）＋**任务内重路由**（p1 "During deployment… applies bounded structural updates"；p4 每 turn 后触发）。**状态迁移**：所读范围未见以状态迁移名义报告的机制；修复在轮间保留同一任务界面与 trace，是否计为迁移留主会话按定义裁定。剩余缺口：无作者 Limitations 节；Table 2/4 token 口径差未解释；旧任务→新任务的 playbook 迁移仅 30 题级、mutation budget=0（Table 3，p6）。

## N2 AgentConductor

- ①机制（p3 §2；p4 §2.1.3；p5 Table 1）：Qwen2.5-3B-Instruct 编排器先推断难度与角色，再生成 YAML 分层 DAG（step=层、ref=边）；用 Scomplex 密度奖励按难度设节点上限 Nmax=4/7/10（easy/medium/hard，Eq.12）；两阶段训练：SFT（p4 §2.2 原文：3 个竞赛数据集×3 难度档×每档 50 题＝450 题，逐题经首轮＋错误感知次轮生成共 2,700 个竞赛级交互图；另两个基础数据集出 300 个初始样本并重复同一管线；合 4,500 样本，p11 A.2 同述）＋GRPO（group 8，Verl/vLLM），奖励＝YAML/执行错误分（Table 1）＋密度项；推理期编排器冻结。
- ②切换信号（p3 §2.1.2；p17 Algorithm 1；p11 A.2）：以执行反馈 zk=(zkroles, zkcode) 为信号；首次尝试失败时把反馈与交互历史并入 Hk、下一轮重新生成拓扑；PASSED 即早停；实现中轮数上限 K=2。错误类型含 WRONG ANSWER/TIME/MEMORY/RUNTIME/COMPILATION（Table 1，p5）。
- ③固定形态对照（原单元格与复算）：Table 2（p6）3 run 均值——AgentConductor(3B) 五集 pass@1＝APPS 58.8/LiveCodeBench 46.3/CodeContests 38.8/HumanEval 97.5/MBPP 95.1、avg 72.1；对照 GPT-4o-mini 51.1、MetaGPT 68.7、FlowReasoner 67.5、Chain-of-Agents 67.9、GPTSwarm 64.8、G-Designer 63.7。Table 4（p7）消融：w/o RL 29.8（APPS）；w/o SFT 基本不产有效拓扑（valid 15%）。p7 原句称 "absolute margins of 14.6%, 3.1%, and 1.1% percentage points"；按 Table 2 复算：APPS 对最强基线 MetaGPT(51.3) 为 +14.6% 相对/+7.5pp 绝对，LiveCodeBench 对 Chain-of-Agents(44.9) 为 +3.1% 相对/+1.4pp，CodeContests 对 FlowReasoner(37.7) 为 +1.1pp 绝对——原句相对与绝对混写，冲突并列记录，不替作者修数。
- ④已报成本（原单元格）：Table 3（p6）APPS——AgentConductor prompt 277,600＋completion 79,800；AFlow 531,450/184,800；FlowReasoner 437,250/148,050；Chain-of-Agents 334,650/134,250；GPTSwarm 381,450/155,400；AgentPrune(L) 364,950/141,150；MacNet(L) 472,950/200,100；G-Designer 320,550/139,200。表内未注明单位口径（整集或平均）与重复次数，按原单元格记录。摘要报 "up to 14.6% pass@1, 13% density reduction, 68% token cost reduction"，全文检索未定位 13%/68% 的计算单元格；按 Table 3 复算 APPS 总 token 相对减少范围为 22.3%（vs G-Designer）至 50.1%（vs AFlow）——口径缺口的两种候选读数并列。训练为 4-GPU A800（p11 A.2），未报美元或时长账；第二轮切换的独立成本未单列。
- ⑤作者明确边界（原文）| 本包推断：无独立 Limitations 节（p8 Impact Statement 称无特别事项）；p15 B.5 自称竞赛级聚焦是 "a deliberate choice rather than a limitation"；零样本迁移为 50 条 GAIA 子样本的小规模研究，成功率 15.8%；重训练后的跨域表（Table 5，p18）GAIA avg 53.8 vs CoA 50.8、HLE 22.6 vs 18.0、PopQA 50.3 vs 46.5，属改奖励函数后的另一配置，不与代码域主表混读。｜[推断] 该包"在线"上限为两轮内的一次重整，不能外推为长程任务内重路由。
- 分类（本包判断）：**任务前选形**（每 query 推断难度/角色并生成初始拓扑）＋**任务内重路由**（失败后第二轮重生成，上限 2 轮）。**状态迁移**：第二轮把 Hk（含 agent 输出与执行结果）带给重生成，且 p14 B.3 自述第一轮 agent 在第二轮 "evolve according to their prior outputs"；是否构成状态迁移取决于定义（它重跑而非搬运运行中状态），记录为待主会话裁定的边界情形。剩余缺口：13%/68% 口径未定位；Table 3 单位/分母未注；两轮以上行为未训练也未测。

## N3 MACA

- ①机制（p3-p5 §2）：把 coordination 建模为对 (G, τ) 的联合后验（Eq.1），GraphSpec 结构先验＝agent relevance（σ(q/β(b))、阈值 γ，Eq.4）＋interaction plausibility（Bernoulli 边 + MLP，Eq.5-7）；策略 πθ 在动作空间 A=O∪{STOP} 上做逐步编排（选 agent 子集、路由、终止），MDP＋GRPO，外部奖励 rt=Racc−βCttoken，策略奖励 rt′=rt−λ·DKL(πθ∥πmix)（Eq.12），πmix=½πref+½πprior。
- ②切换信号（p3 §2.1a；p5 §2.3）：无失败触发式切换；每步状态 st 含任务输入、历史 ht 与预算 bt，策略按 (x,b) 条件的 GraphSpec 动作掩码逐步决策；γ 由敏感性实验定为 0.4（p8 §3.6）。未见漂移检测或拒判信号。
- ③固定形态对照（原单元格与复算）：Table 1（p6，Llama-3.1-8B，6 基准）MACA 平均精度 68.62%（作者）；代表单元格——HumanEval 75.76 vs DyLAN 72.73、MacNet 68.18、AgentPrune 62.50；MMLU-Pro 52.67 vs Puppeteer 51.25；ARC-C 87.75 vs AgentPrune 86.09。消融 Table 3（p6-7）：w/o GraphSpec ARC-C 72.35（−14.45% 精度，作者口径）、w/o πθ（退化为 structure-centric）+19.40% 成本、w/o Zprior 82.64、w/o Pprior 81.31。作者报对 adaptive 基线平均 +8.42%、token −36.2%~−51.9%（p6）；表内无对应平均列、聚合方式未示，作为缺口保留；复算示例 HumanEval 对 MaAS 为 75.76−65.15=+10.61pp。
- ④已报成本（原单元格）：Avg Cost 定义为每题 token 成本（含 prompt 与 completion，§3.1，p5）；Table 1 MACA HumanEval 2,100.1 vs DyLAN 15,256.7、MaAS 4,796.9、Puppeteer 2,798.3。Table 8（p20）：MACA 需一次性额外训练 12–24 h/数据集（含结构先验 15–30 h），8×A800；HumanEval Cost/Acc 2,848.9/86.89 vs MaAS 3,625.7/85.98、DyLAN 12,784.6/84.37。摘要 "43.19% fewer tokens" 与正文 "36.2% to 51.9%" 的对照臂与聚合未定位；训练费为摊销项，任务内编排开销未单列，无美元账。
- ⑤作者明确边界（原文，p9 Limitations）：①评估限较结构化基准，开放/交互/领域特定设置的泛化未证；②依赖预定义 agent 池（能力与角色描述人工给定），部分效果可能来自初始化而非协调本身；③GraphSpec 用筛选后的高质量轨迹＋最终结果监督训练，可能偏向易验证的协作模式，在信用分配噪声大或不以最终答案反映协作时稳健性下降。｜[推断] 上述②③直接限制"纯组织收益"归因，但不否定已发表的对照数字。
- 分类（本包判断）：**任务前选形**（按 (x,b) 构造 GraphSpec）＋**任务内重路由**（逐步 policy 动作：调用子集/路由/终止）。**状态迁移**：所读范围未见任务内重绘结构的证据（结构按 (x,b) 构造、轨迹步进），暂不归入迁移。剩余缺口：8.42%/43.19% 聚合口径；Avg Cost 未注价格日期与换算；γ、λ 单点敏感性（λ 0.4→0.7 精度 55.4%→75.1%，p8）提示超参强依赖，等预算重跑未报告。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 仍缺/交回 |
|---|---|---|
| S2 动态与固定对照 | 三篇均定位固定/静态对照臂与消融单元格（N1 Table 1/2；N2 Table 2/4；N3 Table 1/3） | 归属裁定（选形/重路由/迁移）、跨篇可比预算匹配与 S2 判定由主会话执行 |
| 成本经济可复算 | 三篇 token 账原单元格与部分复算（N1 12% 复核一致；N2 相对/绝对混写；N3 聚合缺口径） | 美元账、切换/审计/编排的独立成本、训练摊销口径均未报告或未定位 |
| 强基线与预算消融 | 三篇各含静态或强基线行与去组件消融 | 等预算重跑、同预算证明均未见；N2/N3 替换奖励或重训练配置不并入主表 |

## 剩余缺口与检索记录

- 有界空结果：N2 的 13%/68%、N3 的 8.42%/43.19% 计算单元格在各自全文（含附录）检索未定位；检索词 `cost`、`token`、`density`、`reduction`、`budget`、`saving`、`baseline`、`limitation`，范围＝上述快照全文，日期 2026-10-13。按原判据留缺口，不写为不存在。
- 访问失败（未绕过挑战）：arXiv `/html/{id}v1` 与 API 入口经本机代理返回 502/000；Semantic Scholar API 返回 000；ar5iv、`arxiv.org/pdf`、`arxiv.org/abs` 在重试窗口内可用，三篇 PDF 以此为全文依据。GitHub 代码仓未访问（无核验需求条目）。
- 本包未运行论文代码/基准/模型实验，未做独立复现；所有跨篇数字比较仅作原始单元格并列，不作组织收益归因。
