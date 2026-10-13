# 动态对照、拒判与校准补核

引用动态组织收益、预算匹配或陌生任务回退时，按 D1-D5 读取对应证据。
采集于 2026-10-13，Asia/Shanghai；输入基线为 `a8967ce118c9becfad132159ae50f9a86ba11397`。
范围限 AdaptOrch、MasRouter、DyLAN 正文、附录及论文链接的官方代码。数字均为作者报告或标明的算术复算，未运行论文代码、基准或模型。
本件补原研究票的动态对照、强基线、成本、拒判与回退字段；S2、整票关闭和 Pod 适用性由主会话验收。

## 来源与快照

三篇 HTML 全文均可访问，实读了本包涉及的机制、实验和附录，并在全文检索缺失字段。AdaptOrch Table 6 另核 PDF 第 20 页。
快照根目录为 `/tmp/org-v3-dynamic-controls.ZfBwty/`。下表 SHA256 对应由 HTML 提取的文本，保留原章节、表格和段落 ID。

| ID | 一手来源、版本、日期 | 文本快照 | SHA256 |
|---|---|---|---|
| A | Geunbin Yu，[AdaptOrch](https://arxiv.org/html/2602.16873v1)，v1，2026-02-18 | `adaptorch.txt` | `5ef016f66de695db6ea432a756056e35462a8930d7dd97a90cb0734b8dba2ffd` |
| M | Yanwei Yue 等，[MasRouter](https://arxiv.org/html/2502.11133v1)，v1，2025-02-16 | `masrouter.txt` | `6754e2243af8a8d4c9b0db21b5bcf1fe44d47abb25a4280b9452116ccf06b0fd` |
| Y | Zijun Liu 等，[DyLAN](https://arxiv.org/html/2310.02170v2)，v2，2024-11-15 | `dylan.txt` | `7330067787d606380260af99f7ea952b8f20f324f246a884db763ca221fb37c5` |

原始 HTML、arXiv 版本页、PDF、官方源码及失败响应的 URL、绝对路径、SHA256 均列在 `snapshot-index.json`。
该清单 SHA256 为 `19c5aec302796c3448bd56251983cb50be386ba215ff3b811a27d9873711fb55`。
MasRouter 代码固定于 [`e005f7696fe0c0412563f6cd67f4cd3712fa2822`](https://github.com/yanweiyue/masrouter/tree/e005f7696fe0c0412563f6cd67f4cd3712fa2822)，提交日期 2025-10-29；DyLAN 固定于 [`006e440a519f7cf21e2826f3b8033d84ae9bf07c`](https://github.com/SALT-NLP/DyLAN/tree/006e440a519f7cf21e2826f3b8033d84ae9bf07c)，提交日期 2024-05-16。代码日期与论文版本不同，代码默认值不自动成为论文运行凭据。

## D1. AdaptOrch 的分母冲突与完整开销仍未澄清

用途为原关闭项 S2 和成本经济，供 06/07/08 使用。已有动态、固定和预算匹配 Self-MoA 数字沿用[关键引用纠正 §1](../evidence-corrections-2026-10-13.md#1-adaptorch-存在可定位的动态与固定形态对照)，本件不重复。

- A 的当前 arXiv 版本仍为 v1。§5.1/Table 4 与 §5.5 的分母冲突保留；后者原句为 "exclusively on the remaining 85% test split"。本轮未取得作者对该冲突的澄清。
- 官方代码链接的 [GitHub API](https://api.github.com/repos/adaptorch/adaptorch) 与[网页](https://github.com/adaptorch/adaptorch) 均返回 404，两入口后停止。实例 ID、原始账和代码属于本轮不可访问，不能据此断言材料不存在。
- [§5.5](https://arxiv.org/html/2602.16873v1#S5.SS5) 的离线搜索针对一个耦合阈值的六个候选值 `0.3,0.4,...,0.8`，不是六个独立阈值；开发样本为 SWE 75、GPQA 30、HotpotQA 75，seed 42，选定后冻结。Figure 9 另写每设置 30 trials，但未给逐次运行账，搜索总调用量、费用及摊销仍未报告。
- [附录 B.2](https://arxiv.org/html/2602.16873v1#A2.SS2) 还给出 "Estimated costs"：五种方法合计，SWE 500 实例约 $1,200，GPQA 198 实例约 $180，HotpotQA 500 实例约 $350。这是跨方法估计总额，未拆到搜索、失败重试、候选筛选或单一实验臂；不能拆摊成已核实切换账。
- [§4.5/Algorithm 2](https://arxiv.org/html/2602.16873v1#S4.SS5) 描述合成失败后调高耦合值重路由。已有路由 CPU 时间和合成费见纠正件；失败重路由的独立 token、延迟、美元增量未报告，状态迁移账也未报告。
- [§7.1](https://arxiv.org/html/2602.16873v1#S7.SS1) 把 "topology changes mid-execution" 列为未来工作。因此当前任务前选形、合成失败后的再执行，与根据未完成的中间结果即时迁移组织状态分别记录。

结论为部分支持、冲突未决。现有正文支持动态机制及效果消融，完整净成本与分母不可由这些材料补齐。

## D2. MasRouter 有强基线，但不是预算匹配的纯拓扑比较

用途为强单代理、多采样、强固定拓扑及成本关闭项。以下数字只取 [附录 D.1/Table 10](https://arxiv.org/html/2502.11133v1#A4.T10) 同表，任务为 MBPP，质量单位为 pass@1 百分数；成本列仅标 "Cost($)"。

| 实验臂 | 模型分配 | pass@1 | 作者成本列 |
|---|---|---:|---:|
| IO，表内最佳单次模型 | Claude 3.5 Haiku | 73.40 | $0.146 |
| SC(ComplexCoT)，表内较强多采样 | GPT-4o-mini | 75.60 | $0.487 |
| MacNet Complete Graph，固定形态 | GPT-4o-mini | 75.20 | $2.932 |
| AFlow，学习工作流基线 | GPT-4o-mini | 82.20 | $1.723 |
| MasRouter | 四模型池，逐 agent 分配 | 84.00 | $1.039 |

- [§5.1](https://arxiv.org/html/2502.11133v1#S5.SS1) 的池为 `gpt-4o-mini-0718`、`claude-3.5-haiku`、`gemini-1.5-flash`、`llama-3.1-70b`；其余精确模型快照未列，温度均为 1。MAS 基线固定六个 agent，MasRouter 上限六个；多采样的采样次数、逐臂 token 上限及等预算重跑未报告。角色池允许编译器、Wikipedia，但逐臂工具权限等价未证。
- 这些是论文所测池内的强基线，不是当前最强模型的结论。MacNet 的固定形态对比同时改变模型分配、角色和计算量。[§5.5/Table 3](https://arxiv.org/html/2502.11133v1#S5.SS5) 去掉拓扑模块时采用 "random selection"，不是固定最佳形态控制。
- 独立复算：MasRouter 对 SC(ComplexCoT) 为 `84.00-75.60=8.40` 个百分点，但成本列比为 `1.039/0.487=2.1335`；对固定 Complete Graph 为 +8.80 个百分点，成本列下降 `1-1.039/2.932=64.56%`。后者不能独立归因于动态拓扑。
- 对 AFlow 的同表差为 +1.80 个百分点、成本列下降 `1-1.039/1.723=39.70%`。§5.2 另写 `40.22%-43.78%`，本件保留同表复算，不替作者统一差异。
- 论文未明确 Table 10 美元数是整集累计还是另一种聚合，未给逐行成功数、重复次数、置信区间或成本账。这里按公布列比较，不转写为每题或全年费用。正文 Table 1 与附录也有质量数差异，例如该 SC 行为 75.80 而 Table 10 为 75.60，不能拼接一表质量与另一表成本。
- 分片证据另分层。官方 `Experiments/run_mbpp.py` 的主函数分别建立 train/test；`Datasets/mbpp_dataset.py::MbppDataset` 指向 HF 的 `full/train`、`full/test`，没有把实际运行 ID 和 Table 10 绑定。`run_math.py` 读取 train/test 目录，正文只说分层选 519 题；`run_humaneval.py` 使用 `split_list(dataset, 0.2)` 并向下取整批数，故不能自动以完整 HumanEval 数量作论文分母。文件及 SHA 见快照清单。
- 搜索/训练单独列在 [D.2/Table 12](https://arxiv.org/html/2502.11133v1#A4.T12)：MATH 上 MasRouter 为 3,235,288 prompt tokens、2,499,530 completion tokens、$3.56；AFlow 为 321,813,314、28,083,445、$21.75。美元比 `21.75/3.56=6.1096`，prompt token 比 `321813314/3235288=99.4698`，后者不是全部 token 比或美元比。
- Table 12 不是 Table 10 的推理费，也没有给跨任务摊销、失败重跑完整性或硬件费用。`MAR/MasRouter/mas_router.py::MasRouter.forward` 用运行图前后 `Cost.instance().value` 差计调用费，未计本地 encoder/controller 的硬件和墙钟成本。

结论为支持存在基线与独立训练账，预算匹配、逐臂相同模型/工具和完整总成本未证。

## D3. DyLAN 的选队收益与任务内改组收益可以分开定位

用途为动态/固定消融与搜索成本关闭项。下表质量与调用数均为作者报告；CG 为 HumanEval 164 题的 pass@1，GR 为 MMLU 测试题五分之一、57 学科的 accuracy，GR 精确样本量未列。

| 定位与比较对象 | 质量变化，百分数 | 平均 API calls 变化 | 比较限制 |
|---|---|---|---|
| [Table 5](https://arxiv.org/html/2310.02170v2#S4.T5.fig2)，CG 选队前 12 个到选队后 8 个 | 76.2 到 82.9 | 23.04 到 16.85 | 两臂仍可做任务内改组，不是静态拓扑单因素控制 |
| [Table 6](https://arxiv.org/html/2310.02170v2#S4.T6)，CG 无改组到完整 DyLAN | 76.2 到 82.9 | 17.98 到 16.85 | 去掉 agent team reformation，仍保留 early stopping |
| 同表，GR 无改组到完整 DyLAN | 69.9 到 70.5 | 7.05 到 4.39 | 同样不是去掉全部动态机制 |

- 第一行复算为 +6.7 个百分点、调用数下降 `1-16.85/23.04=26.87%`；第二行为 +6.7 个百分点、下降 `1-16.85/17.98=6.28%`。两个 76.2 的对照对象不同，不能交换成本分母。
- [附录 B.1](https://arxiv.org/html/2310.02170v2#A2.SS1) 默认模型原文拼作 `gpt-35-tubo-0301`。非零温度实验重复三次，报中位数，原始成功数与这些消融的区间未给。CG 的 DyLAN 温度 0.8、max tokens 1024、最多六层；选队包括四名写代码者和四名审查者，其中 Syntax Checker 为纯工具，Unit Tester 有解释器。GR/AR 的 max tokens 为 2048、最多四层，各方法调过温度，不能概括为全部采样设置相同。
- [§4.2](https://arxiv.org/html/2310.02170v2#S4.SS2) 明说 "we mainly report the cost from the second stage"。表内主要统计 Task Solving，前置 Team Optimization 不在这笔运行费中。未单列选队账、搜索温度账、工具运行费或美元/墙钟开销，调用数只是代理指标。
- 任务内 ranker 不是一概被排除：所读 `code/MMLU/LLMLP.py::forward` 将 `self.activation_cost` 加入 `resp_cnt`。这证明该实现统计了改组 ranker 调用，不证明所有论文实验和工具费都有完整账。
- [附录 C.1/Table 9](https://arxiv.org/html/2310.02170v2#A3.SS1) 原句为 "the selected team is tested on the whole dataset"，选队子集为原数据的 1%、10% 或 100%。这是部分或全部选队数据被测试集合包含的方案，不是严格不相交的选队/测试划分。GR 选队按学科、WebShop 按页面类别，不能统称为每题重新搜索全部组织。

结论为支持分阶段收益与任务内改组消融，全部选队成本、纯固定强基线的预算匹配及独立留出验证仍缺。

## D4. 三篇的验证范围与回退对象不同

用途为原新增的拒判/回退关闭项，供 06 的证据表消费。ID 指分布内；OOD 指陌生任务分布，而不是任何配置变化。

| 来源与定位 | ID、OOD 与真实时间漂移 | 信号与回退对象 | 已测边界 |
|---|---|---|---|
| A，§4.5、§5.5、§6.4 | 同一三基准内划开发/测试，分母冲突见 D1；未报告陌生任务或按真实时间切分的漂移验证 | 合成的语义余弦一致性低时交 arbiter，再增耦合值重路由到 hierarchical；作者 Proposition 2 声称最多五次终止 | 定义原文 "semantic similarity rather than logical consistency"；终止不是正确性或成本保证，未给 OOD 检测/拒判误差 |
| M，§5.4；`MasRouter.forward` | 报告加入未见 DeepSeek-v3 的模型池变化；原句 "generalize to unseen LLMs"。这不是陌生任务或真实时间漂移测试 | 正文未报告 OOD 拒判阈值或安全回退臂；所读 forward 选择模型/角色后直接构图运行；实验还传入已知任务类别 | 有新模型选择率和聚合质量，未给拒判率、低置信路由损失或回退的实际收益/费用 |
| Y，§3.3.2、附录 B.1、C.6、A | 静态任务集及角色匹配/不匹配比较；未报告真实时间漂移。C.6 的 Off-Domain 定义见 D5 | 低排名 agent 被裁掉；超过 2/3 一致则早停，达到层数上限则按末层多数及任务后处理输出；CG 从测试通过较多的前五候选中随机选最终代码 | 一致或 BLEU 相似不是 OOD 拒判。附录 A 的 "introduce agents from more capable LLMs with validation" 是建议，未报告该回退的实验 |

三篇均未报告覆盖失败、拒判与回退费用的真实时间漂移净收益。该空结果限本轮三篇全文及所列源码，不推断全领域没有研究。

## D5. 路由准确率和贡献排序不能替代净收益校准

用途为原新增的收益预测/实际结果校准关闭项。需要的对象是预测的成本调整收益与实际收益的偏差；下列三种观测均不是该对象。

- A 的 [附录 B.5/Table 6](https://arxiv.org/html/2602.16873v1#A2.T6) 比较路由选择与穷举四拓扑的 oracle；原文为 "Overall router accuracy: 81.2% (567/698)"。HTML 与 PDF 第 20 页一致。表内数据如下，最后一列是本轮复算。

| Router / Oracle | Parallel | Sequential | Hierarchical | Hybrid | 行和 |
|---|---:|---:|---:|---:|---:|
| Parallel | 248 | 12 | 8 | 18 | 286 |
| Sequential | 6 | 152 | 9 | 4 | 171 |
| Hierarchical | 14 | 7 | 89 | 11 | 121 |
| Hybrid | 9 | 5 | 7 | 78 | 99 |

正文标 `n=698`；表注的作者准确率为 `81.2%=567/698` 的舍入值。表内总和却为 `286+171+121+99=677`，主对角为 `248+152+89+78=567`，以表内总和计算为 `567/677=83.7518%`。两分母冲突未决，本件不选一个替作者修表；两者也都只是类别匹配率。
PDF 快照为 `adaptorch.pdf`，SHA256 `cf3f8ed008fa78497e07b634120b04add68fb4e2ad8c01f9801e72b7b0e26925`；oracle 穷举筛选费没有独立列账。

- M 的 [§4.4/式 13](https://arxiv.org/html/2502.11133v1#S4.SS4) 优化效用减成本；`run_mbpp.py` 原句为 `utility = is_solved - cost * args.cost_rate`。优化目标存在不等于已经校准，正文未报告预测净收益分桶、可靠性曲线或逐题预测/实际残差。
- Y 的 [附录 C.6/Table 15](https://arxiv.org/html/2310.02170v2#A3.SS6) 用简化 Shapley 贡献对照 Agent Importance。三组随机的三人团队取自七候选；按学科平均 KL/ListMLE。In-Domain 指至少一角色匹配学科，Off-Domain 指没有匹配角色，并非训练/测试分布留出。
- 该表 Importance 在 In-Domain 的 KL 为 `0.229e-3`，uniform 为 `0.359e-3`；Off-Domain 为 `0.347e-3`，uniform 为 `0.327e-3`，两者 ListMLE 均为 `0.693`。该局部条件下排序代理没有优于 uniform 的这些指标，且表中没有成本调整收益、拒判率或回退质量。

结论为有界未发现净收益校准。A 有 oracle 类别对照，M 有收益优化目标，Y 有贡献分布比较；它们各自的实证保留，但不升级成完整净收益预测可靠性。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 仍交回主会话的缺口 |
|---|---|---|
| 来源、机制可追溯和盲区 | D1-D5 有原文、定位、快照与版本 | 原报告其他来源、各形态三栏和不可能三角均不在本包 |
| S2 动态与固定形态 | D1 续核；D2/D3 增补固定基线和消融 | AdaptOrch 分母/代码、任务内切换与状态迁移全账；S2 判定未代行 |
| 强单代理、多采样、强固定拓扑的预算匹配 | D2 列出实测臂；D1 保留原已核 Self-MoA | MasRouter 与 DyLAN 的同模型、同工具、同预算证明及运行清单不足 |
| 成本经济可复算 | D2 美元/prompt token 比；D3 调用数比 | 候选搜索、挑选、验证、失败重跑及摊销不能视为零 |
| 拒判、回退、校准 | D4/D5 分清 ID、角色失配、新模型与时间漂移 | 真实陌生任务/时间漂移下的拒判曲线、回退实效和净收益校准未报告 |

剩余缺口按成因保留：AdaptOrch 仓库为访问失败；论文内表格/分母为冲突未决；完整账与净收益校准为所读范围未报告；未抽取的全部官方源码及其他论文为本包未读。
有界空结果的入口为三篇版本固定全文和上述官方仓库；日期为 2026-10-13，检索词包括 `cost`、`budget`、`split`、`calibrat`、`out-of-domain`、`distribution shift`、`drift`、`uncert`、`reject`、`abstai`、`fallback`，并回读机制、实验、限制与对应附录。访问失败路径见 D1 和快照清单。
