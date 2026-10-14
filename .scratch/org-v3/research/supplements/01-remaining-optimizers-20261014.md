# 第四批有界原文采集：AgentSquare／AgentPrune／ScoreFlow

范围：只核本包 O1–O5 指定主张，交付一手定位、观测值与适用边界；不裁定、不整合、不关票，
不选 Pod 路由或阈值。派发与验收约定读[研究补核与委派](../../research-handoff.md)及所属票「可委派工作包」。
主会话按原表校正了 O1 的两模型分母、O3 的端点任务名及 O5 的预算解释；不记作零返修。
派发配置为 `opencode-go/deepseek-v4.1-flash`、effort `max`、`fork_turns=none` 的原生子代理，非 DSH Delegate。
运行：仓库 `/home/beijong/project/dsh-bots`，派发基线 `3afaa1676ed89bf848af725adf83b0c3a7a5289b`；
采集时 `git rev-parse HEAD` 观测为 `d0a019040e9d499607f188f3215a8165f8523bc4`（并行会话活动，
未改动 Git/index）。工作目录 `/tmp/org-v3-w4-01-20261014`，采集日期 2026-10-14；
工具 curl、python3 3.14.4（仅作 HTML 转文本）、grep/sed/sha256sum。未运行论文代码、实验、
真实模型，未调用 DSH，未读写 `~/.dsh` 与部署。实读层级：三篇均为 arXiv 官方 HTML 全文，
页/节引用以该 HTML 版式为准，未逐页核对 PDF。

## 来源与缓存（SHA-256 全文）

| 来源 | 固定版本与日期 | 官方 URL | 缓存路径与 SHA-256 |
|---|---|---|---|
| AgentSquare | 2410.06153v3，v3 更新 2025-02-27（v1 2024-10-08） | https://arxiv.org/html/2410.06153v3 | `/tmp/org-v3-w4-01-20261014/ags.html` SHA-256 `81b611cfa82bdcc8bfedacbcb195bf8fe90cc728d51520067654b3c38c4e90ed`；文本 `ags.txt` `7e6218868da202587399e8203c9b6964206240fcae481f6a596a65a2cc2843e9` |
| AgentPrune | 2410.02506v1，2024-10-03（官方元数据未见 v2+） | https://arxiv.org/html/2410.02506 | `/tmp/org-v3-w4-01-20261014/agp.html` SHA-256 `e1d358b5b0947589a2c56d2c62926c9a7fcf34a1db218876534b988d32abbf83`；文本 `agp.txt` `c25c22d74ee903af52dbac97dd40efd442a3d0176bd7c3864781f64bf7b53288` |
| ScoreFlow | 2502.04306v1，2025-02-06（官方元数据未见 v2+） | https://arxiv.org/html/2502.04306 | `/tmp/org-v3-w4-01-20261014/sf.html` SHA-256 `057fd92e6ae2021ec27d54dcf685b2f766134a75eb2ae76debc651da9054035c`；文本 `sf.txt` `7486cc243b394b0c21b4d461edf39c21485d08e331582aeed2f96d3db5deadae` |

官方元数据（arXiv API `id_list=2410.06153,2410.02506,2502.04306`，2026-10-14 采集）
缓存在 `/tmp/org-v3-w4-01-20261014/arxiv-meta.xml`，SHA-256
`d4151f8e86bfad815784ba75a74d293dbfb311ec73f645b9aecf419f351c8eda`。
标题确认：AgentSquare "Automatic LLM Agent Search in Modular Design Space"；AgentPrune
"Cut the Crap: An Economical Communication Pipeline for LLM-based Multi-Agent Systems"；
ScoreFlow "Mastering LLM Agent Workflows via Score-based Preference Optimization"。

官方 repo（默认分支 HEAD，GitHub API 于 2026-10-14 取，未读代码内容，未安装依赖）：
AgentSquare `https://github.com/tsinghua-fib-lab/AgentSquare` commit `8f5b3fe5d8a32f9b59d20370823bef2a2c86928c`（2025-11-04）；
AgentPrune `https://github.com/yanweiyue/AgentPrune` commit `c544dd6a1858c02c6d5d371d23c6e6ff55e0be21`（2025-03-23）；
ScoreFlow `https://github.com/Gen-Verse/ScoreFlow` commit `2492563838f75d00c6830b6c5373fa3a81b2dbc8`（2025-05-22）。

## O1 AgentSquare：优化对象、离线边界与 17.2%

定位：2410.06153v3，Abstract 与 §3.1 设计空间定义；§4.2 主结果段；Table 1（GPT-4o）与 A.3（GPT-3.5）。
摘录：设计空间把已有 LLM agent 设计抽象为四个模块 "Planning, Reasoning, Tool Use, and
Memory"，搜索机制为 module evolution 与 recombination 加 in-context 性能预测器；
§2 对比句 "These efforts are orthogonal to the optimization of single-agent systems, as
they focus more on the role-playing and interaction patterns among multiple agents,
rather than the design of agentic modules"。优化对象是单代理的模块组合，不是多代理拓扑。
离线边界：搜索结果按任务落成可复用模块；"Since the search cost is a one-time expense and
the searched modules can be reused, it is not included in the above analysis"（§4.2）。
数字与算式：§4.2 合并两模型的六任务平均相对增益为
14.1／26.1／20.5／30.6／6.0／6.0%，均值 (14.1+26.1+20.5+30.6+6.0+6.0)/6 = 103.3/6 =
17.2167 ≈ 17.2%，与摘要 "average performance gain of 17.2%" 一致。独立按两表每模型、每任务的
最佳手工臂计算 12 个相对增益，均值为17.1888%；六个配对均值为14.0634/26.1281/20.4520/
30.5547/5.9815/5.9529%。两种舍入路径均约17.2%，不是 GPT-4o 单臂的17.2pp。
模型为 GPT-3.5-turbo-0125 与 GPT-4o，作者声明各方法使用相同 few-shot 数（§4.1）。
边界：作者实验报告，本项目未复现；无法从所读段落拆出各模块贡献在 17.2% 中的占比。

## O2 AgentSquare Table A.6：每迭代费与搜索／推理费包含关系

定位：2410.06153v3 Appendix A，Table A.6 "Average API cost per search iteration and the
total number of iterations until termination"。表列六任务（Webshop／ALFWorld／SciWorld／
M3Tool／TravelPlanner／PDDL）：
GPT-3.5 avg cost $3.16／$4.25／$1.92／$2.43／$1.84／$2.70，iterations 23／21／8／14／9／17；
GPT-4o avg cost $10.51／$13.96／$42.14／$26.03／$29.75／$26.94，iterations 18／15／9／18／8／12。
算式与更正：GPT-3.5 真实最小值为 $1.84（TravelPlanner），故范围为 $1.84–$4.25，
报告 §4.4 写的 "$3.16–$4.25" 应更正；GPT-4o 范围 $10.51–$42.14 成立；迭代合计范围 8–23 成立。
包含关系：表题只承诺每迭代 API 费与终止迭代数，未印总搜索账单；正文明确搜索费是一次性开支，
不计入上面的 agent API 费对比（Figures A.7–A.12 按最终／对照代理的 API 费作图），另列 Table A.6。
相关句："the evaluation cost of the predictor is only about 0.025% of the cost of a full
evaluation based on GPT-4o in ALFWorld"（§4.3），说明搜索中包含候选评估费，但所读章节未逐项
拆解每迭代费的构成（生成／评估／预测器占比未定位），也不把 $1.84–$4.25 与推理费混算。
边界：作者报告价目，未给 API 定价日期与失败重跑口径；本项目未复算账单。

## O3 AgentPrune：剪枝信号、$5.6／$43.7 与 28.1–72.8%

定位：2410.02506v1 Abstract、§1、§3（Eq. 8、§3.3）、§4.2–4.3、§4.4、Appendix H.1 与 Tables 3/5。
剪枝信号：把 LLM-MA 视为时空消息传递图，训练图掩码，目标含分布近似项 E[φ(·)]（φ 为解质量
效用函数）与低秩稀疏项（rank 以核范数替代，Eq. 8），随后 "one-shot magnitude pruning"，
对 mask 做 TopK 保留（§3.3）；前 K′ 轮含可训练掩码，剪枝后固定用于后续 K−K′ 轮，多查询设置
只用 Q′≪Q 个查询训练（§3.3）。即训练目标含任务表现相关信号，剪枝判决本身在掩码幅度／低秩
结构上；所读章节未把逐边任务表现消融作为判据。使用前提：代理数超过三个且通信结构不是过简
（链或 direct-output 不适用）。
$5.6／$43.7：MMLU 数据集，五 gpt-4-based agents（Table 1 表题；实现为 gpt-3.5-turbo-0301 与
gpt-4-1106-preview，温度 1，K=2 数学／通用、K=4 代码）；单位是 Figures 17–19 的 "overall cost
(USD)" 数据集总费用。Abstract 与 §1 写 $5.6 对 $43.7，Appendix H.1 写 $5.6 对 GPTSwarm
$43.56，另报 GSM8K $65.9 对 DyLAN $357.47；两个 $43.x 并列保留，未裁。所读范围未定位 MMLU
评测查询数与计价依据（token 计费口径未读），不推断为每查询价。
28.1–72.8%：Abstract 与 §1 打印 "28.1%∼72.8%↓ token reduction"（作为插件并入 AutoGen 与
GPTSwarm）。Table 3 的 prompt-token 端点为 AutoGen+MMLU 486,034→349,583，降28.0744%；
GPTSwarm+HumanEval 2,736,136→745,617，降72.7493%。两者任务不同，均非总 token 降幅。§4.3 另报 36%
（492,273→315,105，复算 36.01%↓）与 GSM8K+GPTSwarm 60.6%↓（复算矛盾未决：对齐的 token 对
3,526,035/14,005,945 = 25.2% 留存，但表内括注 39.4%，AutoGen GSM8K 行同样不一致：
3,791,251/4,327,740 = 87.6% 对 59.9%）；保留两套数字，不修理表格。附带 3.5–10.8% 对抗攻击
性能提升为摘要／§1 口径，本次未逐表复算。边界：作者报告，未复现；表格 row/column 对齐冲突
按事实留缺口。

## O4 ScoreFlow：生成时点、8.2% 与训练／生成／推理成本边界

定位：2502.04306v1 Abstract、§3.2、Figure 2、§4.1–4.2、Table 1、Figures 4(a)(b)、Tables 5–6、Appendix A.3.4。
生成时点：推理期为每个给定任务／问题生成工作流（Figure 2 为两道 GSM8K 题生成两个不同工作流）；
生成器先用 3 次迭代、每次每问题 k=8 个工作流并按其评分为准训练（Score-DPO，f(x)=x，
d(x,y)=(x−y)³，不用 judge 降本）；默认生成器 Llama-3.1-8B-Instruct（vLLM），执行器 GPT-4o-mini
温度 0，LoRA 训练用 2×A6000。即离线训练生成器，在线逐题生成，再由固定执行器执行。
8.2%：正文 "our method achieves an average solve rate of 85.3%, surpassing the baseline
methods by a margin of 8.2%"。表 1（六基准，GPT-4o-mini，各测三次取均值）ScoreFlow 平均 85.3
（复算 (86.0+86.2+95.9+84.7+94.6+64.4)/6 = 85.3 成立）；八条基线均值为
76.0／76.7／77.3／76.8／76.5／75.8／76.6／80.6，其中最强单臂 Aflow 80.6，对最强单臂差
85.3−80.6 = 4.7pp；八臂均值 = 616.3/8 = 77.0375，85.3−77.0375 = 8.26pp，与 8.2 接近。
正文未说明 8.2 的分母与聚合；八臂均值差只是接近的算术候选，不据此确定作者实际聚合或把
8.2% 改写为已证的8.2pp。可确定的最强单臂差为4.7pp。边界：作者报告，未复现。
成本边界：Table 5 "optimization process on test data"（美元）Ours 2.2570／1.4124／1.3966，
Aflow 4.6081／2.9160／2.8664（GPT-4o-mini／DeepSeek-V3／DeepSeek-coder）；Table 6 "inference
process on test data" Ours 0.2281／5.1549／0.1336／0.1246，Aflow 0.2021／3.9549／0.1229／0.1253，
IO 0.0483／1.2281／0.0251／0.0301。优化（含逐迭代评估反馈）与推理分开列报；生成器训练 GPU
时数另述（2×A6000），所读表格未单列训练本身的美元费；表内 "on test data" 按原文保留。

## O5 三篇的强基线、多采样、固定形态、预算匹配与拒判／回退／漂移

| 论文 | 强单代理基线 | 多采样 | 固定形态 | 预算匹配 | 拒判／回退／漂移校准 |
|---|---|---|---|---|---|
| AgentSquare v3 | 12 个手工代理含 CoT、CoT-SC、Self-refine、ToT 等（§4.1） | CoT-SC 仅作对照臂 | 固定单代理设计，非多代理拓扑 | §4.2 声称固定 token 预算，执行说明为相同搜索迭代数；等迭代本身不证明等 token 或等美元 | 所读范围未定位拒判／回退／漂移实验 |
| AgentPrune v1 | Vanilla、CoT、ComplexCoT、SC（Table 1） | SC 仅作对照臂 | 链／树／星／完全图／分层／随机等固定拓扑作对照 | 未定位等预算声明；主张为同性能下费用降低（\$5.6 对 \$43.7 等） | 所读范围未定位拒判／回退／漂移实验；防御实验对象是提示与替换攻击，不是漂移 |
| ScoreFlow v1 | IO、CoT（Table 1） | CoT SC（5 响应）、MedPrompt（3 响应 5 票）作对照 | 手工静态工作流作对照 | 未定位等预算声明；优化费与推理费分表对比 Aflow | 所读范围未定位拒判／回退／漂移实验；仅 A.3.2 一句 DPO 倾向未见响应的讨论 |

边界：三篇均为作者报告；检索词为 `out.of.distribution|unfamiliar|refus|fallback|drift|calibrat`。
除 ScoreFlow A.3.2 的 DPO 未见响应讨论外没有相关实验命中；范围仅为三篇已读英文全文，
不等于领域不存在。拒判／漂移栏不并入 §4.9 的既有三候选表，不作全领域外推。

## 原关闭项覆盖、剩余缺口与计量

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| 各形态原则／适用条件／成本三栏 | AgentSquare 模块搜索与一次性搜索费；AgentPrune 图剪枝前提与数据集总费；ScoreFlow 逐题生成与分阶段费 | 三候选有界覆盖，费用口径按原文；完整账缺项保留 |
| S2 动态对固定对照 | AgentPrune 固定拓扑对照＋插件省 token；ScoreFlow 对手工固定工作流；AgentSquare 对人设计与搜索基线 | 三候选均非任务内状态迁移；是否计入 S2 由主会话判 |
| 强基线与预算消融 | 见 O5 表 | 已列,未发现三候选的等预算纯组织归因证据 |
| 拒判与回退证据 | O5 表第 6 列 | 所读范围未定位,按有界空结果记录 |
| 固定基线（版本与 commit） | 版本见来源表；repo commit 见上，未读代码 | 代码级主张未核,不写 |

剩余缺口：① AgentSquare 未印总搜索账单与每迭代构成，且报告 §4.4 的 GPT-3.5 下限需更正为 $1.84；
② AgentPrune GSM8K 表列括注与对齐 token 对冲突，MMLU 评测查询数、计价口径、$43.7 与 $43.56
取一未裁；③ ScoreFlow 8.2 的分母／聚合未注明，训练美元费未单列，Table 5–6 均写 "on test data"；
④ 三 repo 仅固定 commit，未读代码、未跑任何脚本；⑤ 三篇的拒判／漂移只在本件表述范围内未定位。
计量：实际起止 2026-10-14T18:31:29+08:00 至 2026-10-14T18:35（按采集会话时钟，含本件落盘）；
工具为 curl、python3、grep/sed、sha256sum、apply_patch。session_id、token 用量、主会话主动
验收工时均未知；无同任务本地基线，不报净节省。采集方仓内只新增本文件，未动既有补核、票、报告、
handoff、地图与 Git。
