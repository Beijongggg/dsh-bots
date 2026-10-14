# 02 带成本公开基准：AgentBench／MAEBE／CoffeeBench 三套件四栏补核（补核件）

[带成本的公开基准与成本口径](../../issues/02-research-benchmarks-with-cost.md)「原套件逐项覆盖」第四批。只交一手字段提取与缺口；不裁定、不整合、不关票。基线 commit `3afaa1676ed89bf848af725adf83b0c3a7a5289b`。派发配置（主会话确认）：`opencode-go/deepseek-v4.1-flash`、effort `max`、`fork_turns=none` 的原生协作子代理；不按模型继承主会话处理，也非 DSH Delegate；本包不再嵌套委派。可证时间共三处：首次 `date` 2026-10-14 18:31:17（+08:00）、末个缓存文件落盘 18:34:10、本件首版落盘 18:36:24；逐文件时刻见缓存清单，其余步骤分钟未记录。缓存目录 `/tmp/org-v3-w4-02-20261014/`（非冻结件）。未运行论文代码、基准或模型，未装依赖，未调用本机 DSH，未读写 `~/.dsh` 与部署目录。session_id 与 token 用量未知；无同任务本地基线，不报净节省。
主会话回读原表后校正总分权重、MAEBE 同质／异质臂、CoffeeBench reasoning 设置与配置读取范围；定向返工1次，不记零返修。

## 来源表

| # | 来源 | 层级 | 版本／定位 | 缓存落盘（+08:00） | 缓存文件（完整 SHA-256 见缓存清单） |
|---|---|---|---|---|---|
| S1 | `arxiv.org/abs/2308.03688` | 一手（书目） | 标题 `AgentBench: Evaluating LLMs as Agents`；第一作者 Xiao Liu；v1 2023-08-07、v2 2023-10-25、v3 2025-10-04 | 18:31:35 | `arxiv-2308.03688-abs.html` |
| S2 | `arxiv.org/html/2308.03688v3` | 一手（全文） | v3 全文 HTML，含 Appendix A-J | 18:32:26 | `agentbench-arxiv-v3.html` |
| S3 | `api.github.com/repos/THUDM/AgentBench`＋`raw.githubusercontent.com` README | 一手（仓库快照） | main@`d1e4a10db08c87075c78972e48ecc182be03e2d5`（2026-02-08，AgentBench FC） | 18:31:43-18:32:21 | `gh-agentbench-repo.json`、`gh-agentbench-commits.json`、`agentbench-README-d1e4a10.md` |
| S4 | `arxiv.org/abs/2506.03053` | 一手（书目） | 标题 `MAEBE: Multi-Agent Emergent Behavior Framework`；作者 Sinem Erisken、Timothy Gothard、Martin Leitgab、Ram Potham；v1 2025-06-03、v2 2025-07-10 | 18:31:37 | `arxiv-2506.03053-abs.html` |
| S5 | `arxiv.org/html/2506.03053v2` | 一手（全文） | v2 全文 HTML，含 Appendix A-H | 18:32:28 | `maebe-arxiv-v2.html` |
| S6 | `api.github.com/repos/SakanaAI/CoffeeBench`＋raw 文件 | 一手（仓库快照） | main@`9e2f3950b5812c8753de81ede9c68babc024b5c8`（2026-08-11）；含 `experiments/roaster_focal_*.toml`、`coffeebench/models/types.py` 等 | 18:31:45-18:34:10 | `gh-coffeebench-repo.json`、`gh-coffeebench-commits.json`、`coffeebench-repo-tree.json`、`cb-cfg-sonnet.toml`、`cb-cfg-passive.toml`、`cb-config.py`、`cb-coffeebench_agent.py`、`cb-coffeebench_experiment.py`、`cb-coffeebench_event_logger.py`、`cb-coffeebench_models_types.py` |
| S7 | `arxiv.org/abs/2606.16613`＋`arxiv.org/html/2606.16613` | 一手（书目＋全文） | 标题 `CoffeeBench: Benchmarking Long-Horizon LLM Agents in Heterogeneous Multi-Agent Economies`；作者 Sugiura、Hattori、Araragi、Ogawa、Onose、Makino、Usuki、Ishida；v1 2026-06-15 | 18:32:40-18:32:42 | `arxiv-2606.16613-abs.html`、`coffeebench-arxiv.html` |
| S8 | `raw.githubusercontent.com/SakanaAI/CoffeeBench/…/README.md` | 一手（仓库文档） | 同 S6 commit；运行成本与实验矩阵说明 | 18:32:23 | `coffeebench-README-9e2f395.md` |
| S9 | `pub.sakana.ai/coffeebench/index.html` | 一手（项目博客） | 发布 2026-06-26；实验设置与结果叙述 | 18:33:53 | `cb-blog-index.html` |
| S10 | AgentBench FC 榜单 `docs.google.com/spreadsheets/…/pubhtml` | 一手（榜单，访问失败） | 仓库 README 所列新榜单入口 | 2026-10-14，分钟未记录 | 未获取，无文件、无哈希：`curl` 返回 `CONNECT tunnel failed, response 502`，按未核验记录，不当有界空结果 |

## 缓存清单（`/tmp/org-v3-w4-02-20261014/`，21 个文件，完整 SHA-256）

| 来源 | 文件（同目录相对名） | 落盘（+08:00） | SHA-256 |
|---|---|---|---|
| S1 | arxiv-2308.03688-abs.html | 18:31:35 | `22e40fdd7063a73e52408054c0a3b3930d1bbfb428a23ad602f7acbe265ade8d` |
| S2 | agentbench-arxiv-v3.html | 18:32:26 | `62547d01f668b47067715d349f0a089213a2c76653f807fe5d6a9063d9de2f9e` |
| S3 | gh-agentbench-repo.json | 18:31:43 | `889e77a732aa7952e9dc3df29b75027a9d2adc87f7e1a13148528f5b16130a53` |
| S3 | gh-agentbench-commits.json | 18:31:46 | `e9207de279fcd34a3babe866982b62e391ef3f68d8f8d3d1d1b1803574c6dc41` |
| S3 | agentbench-README-d1e4a10.md | 18:32:21 | `1b7d1f1cd7a74ac9497c639324ec342dd3f8769e9c0c4cd2cd92a4eb6740ac98` |
| S4 | arxiv-2506.03053-abs.html | 18:31:37 | `9056d9b5fda38b7214a9d6349f1cb11369c9d148ce1ef5b88953c6fca0af6185` |
| S5 | maebe-arxiv-v2.html | 18:32:28 | `1cea7f4fccfa2e9da03f70aa83f77d8b10ff745ed28e4f62c09496946abd81d7` |
| S6 | gh-coffeebench-repo.json | 18:31:45 | `e1d15a8e3d57a39e9ba3f8307e421e24ccbba4ca1b2bed4c2641dfc7021c695d` |
| S6 | gh-coffeebench-commits.json | 18:31:48 | `3ad4dd3c2810d9b8f7adcd6ce65f477d6e6cde2eaacc7d7b8410cb78fcc2099f` |
| S6 | coffeebench-repo-tree.json | 18:32:44 | `4d9bfebf8884bff647ae3b06dccc5c6476018fe300cee31d3543bc99239797f8` |
| S6 | cb-cfg-sonnet.toml | 18:33:48 | `df80d0181d5eb0a6d5431070a143524c5620a2a281b4fdd430771c5a991f6850` |
| S6 | cb-cfg-passive.toml | 18:33:49 | `92ffe82f90c7bff23aed2f2609b8b3b0c10e50e4c8e8da2a491fbfe9263fd78f` |
| S6 | cb-config.py | 18:33:51 | `dc7a5484fd103964f9a0e5828fe99fb91376ee2a1303e8449e97a036e7c6c1bd` |
| S6 | cb-coffeebench_agent.py | 18:34:06 | `f5b1f7d541769e6d761077a16c6ccd37102e0c13a4c3c2a0bcc82d1377629c32` |
| S6 | cb-coffeebench_experiment.py | 18:34:07 | `9a18a27dce9d668fc14f6efdff10d35cebceb0860cd24f6574e0f94e6f16fd6f` |
| S6 | cb-coffeebench_event_logger.py | 18:34:09 | `d2db4a54fc020d7b6e16f53d4f946cb5807eec184745337938c453e377f4a805` |
| S6 | cb-coffeebench_models_types.py | 18:34:10 | `5f826b50492ef31f164bb507dcd27439df5a8cb41cd9b192ef5fc47ba34fecad` |
| S7 | arxiv-2606.16613-abs.html | 18:32:40 | `83d1174892ff6da1b451339c078c5978910fa3e97db02c1c15890b3b1ad4c80a` |
| S7 | coffeebench-arxiv.html | 18:32:42 | `be9807367d4f424e0410ffa6ef9210db8a38b6fd92937b7ac0553f0c8f5161ac` |
| S8 | coffeebench-README-9e2f395.md | 18:32:23 | `8c927573c4890c131a211adf5dfcfea30e7f91fbf74def7c40f9ad343696db83` |
| S9 | cb-blog-index.html | 18:33:53 | `9e20441f87a8c5defcc783ed20dd86ca8ec2d844eb241231f765a7fc2de614e4` |

上表 SHA-256 于 2026-10-14 对实际落盘文件用 `sha256sum` 直接计算（采集会话内，分钟未记录）；S10 无缓存文件，不补哈希。

## B1 AgentBench（S1＋S2＋S3）

- ①测量对象：单个 LLM 作为 agent 在 8 个交互环境（OS、DB、KG、DCG、LTP、HH、WS、WB）中的推理与决策；指标按环境分列：SR／SR／F1／Reward／Game Progress／SR／Reward／Step SR，#Dev 与 #Test 逐环境给数（如 DCG dev 12/360、test 20/600；WB dev 31/400，本包未核 WB test 分母）（S2 §3、Table 2）。温度固定 0。
- ②分数入口：论文 Table 3 给测试集分数，Table 2 给环境统计与权重倒数；总分先把每个任务在被测模型中的平均分归一到1，再跨任务平均。后续沿用各任务「被测模型平均分的倒数」作固定权重，不是「倒数的平均」（S2 §4.1）。仓库 README 另给图片榜单 `assets/fc_leaderboard.png`、`assets/leaderboard.png` 与 S10 表格入口（S3）；PNG 未 OCR，S10 未核验。
- ③成本字段：已读 v3 全文（含 Appendix J）未出现美元或 token 账单字段（有界未发现，不等于该套件无成本字段）；`cost` 唯一命中为致谢「Zhipu AI for covering all GPU and API cost consumed in this study」（S2）。仓库 README 给每个 task worker 的启动时长与内存占用表（如 webshop ~15G／~3min），属机器资源，不是 API 实耗（S3）。FC 榜单是否含成本列未核（S10 失败）。
- ④已发表 multi-agent vs single-agent 对照：v3 全文未找到组织双臂；`multi-agent` 三处命中均为引用他作（AutoGen／MetaGPT 等）、`multiagent` 与 `Avalon` 零命中（有界未发现，S2）。DCG 有对手队伍，但正文把它作为「Battle Generation」的难度轴（E.4），未作 LLM-vs-LLM 组织对照。现行 main README 的 References 记「Avalon task is merged from AvalonBench, which implements a multi-agent framework」，即旧版仓库并入过多 agent 任务，v3 正文未评估（S3）。跨模型榜单不受控，不作组织收益证据。

## B2 MAEBE（S4＋S5）

- 书目先核：简称不作已核——论文标题为 `MAEBE: Multi-Agent Emergent Behavior Framework`，摘要写法为「Multi-Agent Emergent Behavior Evaluation (MAEBE) framework」，作者 4 人，固定版本取 v2（2025-07-10）。本包所指「MAEBE 套件」＝该框架＋其选用的 GGB 基准（S4、S5 §2）。
- ①测量对象：单 LLM 与多 agent 系统（MAS）在道德偏好上的行为差异与涌现现象（从众压力、框架效应）；例子基准为 Greatest Good Benchmark（GGB，Marraffini et al. 2025，arXiv 2503.19598），90 道题、7 点 Likert，含作者新增的「双反向」题；读出 IB／IH 两个维度（S5 §2.1）。
- ②分数入口：论文 Figure 2 与 Appendix A 的逐题图给单臂、round-robin、star 的结果，按题平均再跨题平均得基准分；单臂 vs 多臂显著性用 Mann-Whitney U 检验（Appendix H.1）。框架源码按作者自述在 `github.com/rapturt9/wisdom_agents`（S5 §1.1），该入口本包未访问核验。
- ③成本字段：已读全文（含附录）中美元、token、延迟字段零命中（有界未发现；缺字段记未知，不记为零成本）；`cost` 两处命中均为哲学语义（个人代价、cost-benefit）（S5）。相关资源陈述只有两条：「Due to resource limitations, we study only 2 models (GPT and Qwen) in the supervisor role」；「Including all iterations and questions, more than 237,000 model responses are created and analyzed」（S5 §2.3、§2.4）。
- ④已发表 multi-agent vs single-agent 对照：有。同模型对照限每个模型的单次独立作答与6个同模型 agent 的同质 round-robin。模型为 GPT-4o-mini、Claude 3.5 Haiku、Gemini 2.0 Flash-Lite-001、Qwen 2.5 7b-instruct、Llama-3.1 8b-instruct、Deepseek Chat-V3-0324，temperature 1.0；每题重复12次。MAS运行4轮，末轮取均值，每次重建并随机打乱顺序；异质 round-robin 与 star 不算同模型臂，star 在6个成员之外再加 GPT 或 Qwen 监督者（S5 §2.2-§2.4）。作者 §3.2 表述为多数模型的单臂结果未能统计显著预测多臂结果，不能由此推成质量提升。只有偏好／行为分数，没有成本列。

## B3 CoffeeBench（S6＋S7＋S8＋S9）

- ①测量对象：一个 LLM 在 6 家企业（2 咖啡农＋2 烘焙商＋2 零售商）的异构多 agent 经济中经营 roaster_A 90 个模拟日所赚净利；NetIncome＝Revenue−COGS−OpEx−利息（S7 §3.6 式 1）。环境含净 30 天信用、逾期罚息、库存损耗 0.5%/日、日固定营业成本（$25/$30/$50）与第 40-53 天需求高峰（S7 §3.6、§4 Environment settings）。
- ②分数入口：论文 Table 2 给各模型净利（主指标）、Revenue、Calls、Idle days、DMs sent、API cost；仓库 tree 列出 `experiments/roaster_focal_*.toml` 矩阵，实读 sonnet/passive 两份配置，均含 `seeds=[0,1,2]`、`max_days=90`，其余配置内容未读（S6）。博客已读，trajectories 查看器未访问。配置注释的「leaderboard score」不是在线榜单证据，当前分数入口为论文表；现仓配置未绑定论文逐run记录。
- ③成本字段：有。（a）Table 2「API cost ($)」每 run 均值±标准差：GPT-5.5 79.3±14.4、Opus 4.7 85.7±10.9、Sonnet 4.6 64.2±5.8、Gemini 3.1 Pro 31.4±1.5、GLM-5.1 67.4±6.6、Kimi K2.6 26.9±3.2、Haiku 4.5 9.6±2.9；规则基线该列为占位符「—」，不是 $0（S7）。（b）§4 Compute：平均约8小时/run，约1,000工具调用、约90k输入token/步，六企业合计约$250/run。（c）README报单run超过$200、5小时；passive配置的$0只指focal规则代理，不含仍用Sonnet的背景公司。Table 2与六企业总费的覆盖关系未绑定，不硬判矛盾或相加；任务净利也不是API费。（d）`ModelResponse.cost`默认0.0是字段默认值，不证明模型账单或汇总为零，费用累加语义未核。
- ④已发表 multi-agent vs single-agent 对照：未找到。全部被测臂都是「roaster_A 一个 focal 模型＋其余 5 家固定 Claude Sonnet 4.6」的同一多 agent 经济，对照轴是 focal 模型身份与两条规则基线（passive=wait_for_next_day、heuristic=固定库存/定价），不是单 agent 环境；`single-agent` 连字符零命中（有界未发现），唯一 `single agent` 出现在摘要中描述同类既有基准的局限（S7）。附录 G 的对称双头垄断上限约 $23,800 是解析头寸估计，不是单臂实测（S7 §6、Appendix G）。

## B4 双数字逐列核对（CoffeeBench Table 2，S6＋S7）

两臂取值为 Table 2 的 GPT-5.5 与 Gemini 3.1 Pro 两行（均值±std，3 runs）。

| 列 | 数值与单位 | 两臂配置对照 |
|---|---|---|
| 分数 | Net income：+3,109±1,123 ／ +1,695±508（模拟经济中的USD） | 同 benchmark、90日上限、5家Sonnet背景，处理变量为focal模型；现仓两配置seeds 0/1/2不冒充论文逐run绑定 |
| 成本 | API cost：79.3±14.4 ／ 31.4±1.5（USD/run，公布值非账单） | 每 run 口径；两臂不同模型价目表，未做等预算匹配 |
| 分片 | 90 模拟日×6 企业，5 家固定背景臂 | 非「单 agent 环境 vs 多 agent 环境」分片，两臂同为多 agent 经济 |
| 重复 | 3 runs/臂（原文归因：Due to high API costs） | 样本小，原文自述小差异可能不显著 |
| 预算单位 | USD；另给 Calls、DMs、Idle days 作行为代理 | 无 token 账单、无预算上限列 |
| 控制 | 背景模型固定Sonnet，reasoning被关闭或最小化，不是温度字段；ReAct统一，超160k后同模型摘要 | 强单代理／多采样／固定拓扑消融在本表未见；跨模型差异不可归因为组织收益 |

同表另 5 个 LLM 行与 2 条规则基线行同构，可作同一矩阵的其余双臂，但同样只有跨模型差异。MAEBE 的单臂 vs 多臂对照有质量数、无成本列，按定义不构成「分数＋成本」双数字（S5）。

## B5 三套件已读来源的非美元字段

- AgentBench（S2 Appendix J）：Completed轨迹的token中位1850、均值2220.1、中间50%为761-2709；轮数中位6.0、均值7.95、中间50%为4-9（Figure 8）。§2.4用启发式token计数及3500-token历史截断，Figure 8是否同一计法未声明。Table 6中商用/开源Completed为61.5%/39.1%，TLE为24.9%/36.9%。Completed不等于答对，TLE是轮数或重复生成上限，不是墙钟超时；该分布也不覆盖全部失败账。p95与人工工时未知。
- MAEBE（S5）：单臂与 MAS 各条件均重复 12 次/题；样本量「>237,000 model responses」；监督者角色受资源限制只用 2 个模型；已读全文未见延迟、超时、人工介入字段（`latency|hour|token` 零命中，有界未发现），记未知。
- CoffeeBench（S6-S9）：墙钟约 8 小时/run（API 延迟主导，S7 §4）；行为计数 Calls／Idle days／DMs 已在上表；失败判定为现金为负即破产退出、提前终止（S7 §4）；重复数被成本限制为 3（S7 §7 自述）；已读范围内未见 p95 与人工主动工时或复核去重字段，记未知。
- 三套件均未见尾延迟分位或人工主动工时；本项按未知保留，不补零。

## 原关闭项覆盖表与剩余缺口

| 原关闭项 | 本包证据状态 | 剩余 |
|---|---|---|
| 套件四栏（测什么／分数在哪／成本／双数字） | AgentBench、MAEBE、CoffeeBench 三套件四栏已补（B1-B3），来源与实读范围见来源表 | 原清单仍余 MedAgentBoard、alem-env、DebateLLM、elimination_game、step_game、pgg_bench 未核 |
| 同集同模型 multi vs single 双数字 | 未新增：MAEBE 有同模型单臂 vs 多臂质量对照但无成本列；CoffeeBench 有分数＋成本同表但两臂为不同模型且同为多 agent 经济 | 原项继续由 Optima 论文报告层支撑（本包未复核）；三套件均无同模型分数＋成本双数字 |
| 可比性 C1-C9 | 未改动、未新增编号 | 仍由主会话维护 |
| S3 分数＋成本同表可得 | CoffeeBench Table 2 新增一例（公布值，非账单复算；分母关系未明示） | AgentBench 无成本列；MAEBE 无成本列 |
| 强基线与预算消融 | CoffeeBench 无强单代理臂、无预算匹配；MAEBE 单臂为独立单次作答（12 次重复取均值），非等预算 | 跨模型与跨拓扑差异不得归因组织收益 |
| 非美元代价 | 见 B5：AgentBench token／轮数分布与失败类目、CoffeeBench 墙钟与破产终止、MAEBE 重复次数与资源限制 | 三套件已读范围内均未报告 p95、人工介入与复核去重字段，记未知 |

检索词与范围（全文正则、HTML 去标签后）：AgentBench v3 `cost|dollar|USD|\$|price|pricing|token|multi-agent|multiagent|Avalon|leaderboard|budget`，另读 §2.2-§2.4、§3、§4.1、Appendix E.4、J.1.3-J.2.4；MAEBE v2 `cost|dollar|USD|token|price|latency|wall-clock|hour|single agent|ensemble|supervisor|Marraffini|github`，另读 §1.1、§2.1-§2.4、§3.1-§3.2、§5.1；CoffeeBench v1＋仓库 `cost|\$|USD|API|token|latency|wall|hour|income|leaderboard|single agent|baseline`，另读 §3.6、§4、§5、§6、§7、Appendix G，仓库 README、tree、2 个实验 toml、config.py 与 models/types.py。有界未发现只限上述已读范围：AgentBench 正文 `Avalon`／`multiagent` 零命中；MAEBE 全文美元与 token 零命中；CoffeeBench 仓库与正文 `single-agent` 零命中；三者均不等于来源不存在该字段。未核验项：S10 榜单表（502）、MAEBE 源码仓库、AgentBench 榜单图与 FC 榜、CoffeeBench trajectories 查看器；访问失败不作有界空结果。本件首版落盘 2026-10-14 18:36:24；第四批定向修正落盘 2026-10-14 18:39（+08:00，`date` 实测），仓内写入仅本件。
