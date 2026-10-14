# 补核：AFlow、GPTSwarm 与 MASS 的对照和成本

所属票：[组织形态谱系、动态架构与成本经济](../../issues/01-research-org-patterns-and-phase-transition.md)。
基线 `b4fa51da2c2f316e0513382276d286669aa8a25e`；2026-10-14 交件并经主会话回读修正。
本包只核以下五项主张，供原关闭项与形态、成本决策使用；未运行论文代码或独立复现实验。

## C1 AFlow 的平均增益、采样与划分

来源为 [AFlow v4](https://arxiv.org/html/2410.10762v4) 的摘要、§4、§5.1–5.2、Table 1。
已读上述正文和表格，不以取得 HTML 全文代替全篇核验。

- Table 1 六任务为 HotpotQA、DROP、HumanEval、MBPP、GSM8K、MATH，统一 GPT-4o-mini 执行。
  Avg 列 AFlow 80.3、CoT SC 76.0、ADAS 67.2；各任务使用自身分数，Avg 是表中汇总，不是总成功率。
- 作者称比人工方法高 5.7%、比自动优化方法高 19.5%。复算 80.3/76.0−1=5.66%、
  80.3/67.2−1=19.49%，均为相对增益；前者差值是 4.3pp，不是 5.7pp，也不是对所有基线取均值。
- validation:test=1:4；GSM8K/HumanEval/MBPP 使用原集再分，HotpotQA/DROP 各抽 1000，
  MATH 取 617 道 level-5。候选验证 5 次，测试 3 次取均值。
- SC 生成 5 个答案，Self-Refine 最多 3 轮，MedPrompt 3 个答案／5 次投票；AFlow 搜索 20 轮、ADAS 30 轮。
  原稿「采样与划分未知」拒收。已报这些设置仍不是严格等预算对照，组织因素与采样量未完全隔离。
- 优化器 Claude-3.5-sonnet，执行器可与之不同。模型与任务配置限定这些结果的外推范围。

结论：支持原表的相对增益；「同模型执行」与「同预算」分开。数字为作者报告及算术复算。

## C2 AFlow 的 4.55% 执行费

已读同版 Appendix D 表及相邻正文、Figure 4 题注。原文把费用定义为分片 HumanEval 测试集的
总执行费，不是单 query，也不是六基准或完整搜索账。

| 执行臂 | 打印分数 | Cost ($) |
|---|---:|---:|
| DeepSeek-V2.5 执行 AFlow(gpt-4o-mini) | 0.9390 | 0.0291 |
| GPT-4o IO | 0.9389 | 0.6371 |

Appendix D 写 `achieves parity`，摘要却写 `outperform ... at 4.55%`，两种措辞保留。
按打印金额复算 0.0291/0.6371=4.5676%，与作者 4.55% 有差异，原因未知，不能断言由舍入造成。
这是异模型工作流执行对照，不是同模型组织双臂；费用为公布值，未由逐调用账单复原。

## C3 AFlow 确有逐轮美元费用

已读同版 Appendix F.2、Table A1/A2 与相邻评分说明。两表题注均含 `Total Costs per Iteration`，
列名明确为 `Cost ($)`：小说生成逐轮 $0.005–$0.863，idea 生成逐轮 $0.004–$0.253。
原稿「原文无搜索／优化费用」及「逐轮费用单位未标」拒收。六基准完整搜索账及这些费用的
优化器、执行器、评分组件覆盖仍未知，不能将两表并入 Appendix D 的执行费。
人工评分 $10/hour 是另一费用对象，独立记录。

$21.75／321,813,314 prompt tokens 来自前批已核 MasRouter Table 12，不是 AFlow 原表，
定位见[动态对照补核](01-dynamic-controls-and-fallback-20261013.md)的 MasRouter 条目。
本包按所读实验将 AFlow 归为搜索工作流后执行；未定位任务内拓扑切换实测，部署／切换摊销仍缺。

## C4 MASS 阶段增益与训练／推理费用

来源为 [MASS v2](https://arxiv.org/html/2502.02533v2)，已读 §4 消融、Table 6/7、Figure 5 题注及 C.3。
Table 6 的 Gemini-1.5-pro-002 Avg：+APO 67.44 → +1PO 74.56 → +2TO 77.55 → +3PO 78.40。
独立复算增量为 7.12pp、2.99pp、0.85pp。正文分别说 6%、约 3%、约 2%，不与该列完全吻合；
并列保留，不能选一个代替另一个。正文指 Fig. 6、图题为 Figure 5 left 的编号差异也保留。

- 机制为 block prompt、topology、workflow prompt 三阶段，信号为验证表现；搜索后保存工作流。
- 八任务：MATH、DROP、HotpotQA、MuSiQue、2WikiMQA、MBPP、HumanEval、LCB。
  主要模型 Gemini 1.5 Pro/Flash；实验结果为 3 次评测均值与标准差。
- 10 个 topology 候选、每候选验证 3 次、MIPRO 10 轮；`controlled comparably` 和最多 10 agents
  不能替代严格等预算声明。阶段消融限定增量归因，不证明所有形态收益都能直接相加。
- Table 7 明确区分 Training 与 Inference per query：MASS 训练 24M input／11M output／$5.09；
  每 query 6645 input／3263 output／$0.0014，Acc 81.0。任务、模型与聚合分母尚未对齐，
  不把该表费用与主表任意分数拼成一组。费用是作者公布值，不是本包账单复算。

结论：阶段消融与费用字段可用；正文近似值、表格差值、费用对象保持各自边界。

## C5 GPTSwarm 的在线声明与实测对象

来源为 [GPTSwarm v3](https://arxiv.org/html/2402.16823v3)，已读 §1、§3.1–3.3 及对应实验说明。
§1 的 `graph connectivity ... can self-improve online` 是设计声明，不能单独当作在线边拓扑迁移实测。

- MMLU 对抗设定的边优化恢复到单 IO 基线，正文不声称超过；REINFORCE 200 迭代、每轮 4 个图样本。
  协作设定 7 个异构角色 IO，作者报比基线高 2.1%±1.1%，5 个 training seeds；百分比口径照原文。
- Mini Crosswords：学习分布 0.575±0.0275、初始分布 0.465±0.0509、同边数分布 0.510±0.0552，
  GPT-3.5-Turbo，3 次运行；换 GPT-4-Turbo 为 0.800±0.0616，对 ToT 0.675／0.668。
  两个 ToT 值分别使用 GPT-4／GPT-4-Turbo，不能合并为完全同配置。
- §3.3 HumanEval 确有 `continuously optimizing and evaluating without restarting` 的在线实测，
  但优化对象是节点 prompt：无优化 0.76 到 0.88±0.007，均值与标准误，3 次重复。
- 报告原引「GSM8K 89.7%」未在 v3 定位，检索 `GSM8K`／`GSM`／`89.7`／`0.897` 并回读上述实验后，
  撤出肯定证据。边在线实测未定位只限所读范围，不推断全领域不存在。
- 所读范围未给完整美元账单，作者说明因 API 成本只评一个图分布。$7.63／$4.70 属 MasRouter Table 12；
  5.5e6 tokens／2.1h 属 G-Designer Table 2，后者本包未回核，两个转引来源不混写。

## 三候选四栏与原关闭项覆盖

| 候选 | 原则／切换信号 | 适用条件 | 成本与强基线边界 |
|---|---|---|---|
| AFlow | MCTS 搜索 DAG、prompt 与 operators，执行反馈驱动 | 六基准及附录生成任务，需可执行反馈或评分 | C1 含强 SC 等基线，非等预算；C2 执行费与 C3 逐轮费用分开 |
| MASS | 三阶段优化，验证表现驱动，工作流离线保存 | 八任务、已报模型与候选搜索空间 | C4 阶段消融与训练／每 query 费用均已定位，费用分母仍缺 |
| GPTSwarm | 节点 prompt 与边分布分别优化 | 已读 MMLU、Mini Crosswords、HumanEval，需可重复得分 | C5 有固定／同边数／无优化对照；在线实测限节点，完整美元账未核 |

三候选的本包主张已核，不等于原清单所有形态已核。S2 沿前批已判满足的对照，
本包不以离线阶段消融或节点优化冒充任务内边拓扑迁移。成本关闭项增加可定位数值，完整成本仍缺。
拒判、回退对象与漂移净收益校准在本包已读实验未定位；「不可能三角」与「1 万 agent <10%」不在本包范围。

## 来源快照与工作记录

2026-10-14 验收缓存 `/tmp/org-v3-w3-accept-20261014/sources/`，不随件提交，旧临时目录已不存在。
所有快照为对应链接的 HTML；SHA-256 如下。主张实读范围以上述章节为限。

| 文件 | SHA-256 |
|---|---|
| `aflow-v4.html` | `c7fe2d7de57d20da95b9f1728b6714d3847b042ec9035d23b19832fc947ccfc0` |
| `mass-v2.html` | `efbbf37e64f9c10aa0db9865d2b71fd61774a8b8102fb9977440a3cc4d58f9f4` |
| `gptswarm-v3.html` | `722b80fb2c3e197a0790e8d236a99c160b8bccde4a529954b21bf5708802d835` |

采集模型 `opencode-go/deepseek-v4.1-flash`，effort `max`，原生子代理，非本机 DSH。
原交件用时陈述与返回消息不一致，精确用时、session_id、token、主会话核验工时未知。
本包未再次派 ds 返工；主会话完成一轮回读修正，不记为零返修或净节省。S1–S5 与 HITL 边界保持。
