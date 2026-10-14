# Research: 带成本的公开基准与成本口径

GitHub: https://github.com/Beijongggg/dsh-bots/issues/5
Type: research
Status: ready-for-agent
Deliverable: `../research/benchmarks-and-cost-accounting.md`

## Question

用哪些公开基准可以把「额外消耗的 token 是否划算」量化？需要：①**分数与成本同时可得**（或
每任务成本可推导）的公开评测套件与榜单——候选族：GAIA、SWE-bench Verified、tau-bench／tau2-bench、
BrowseComp、HLE、Terminal-Bench、OSWorld、WebArena、MLE-bench、PaperBench、RE-Bench，以及
多 agent 专用套件；②每个套件测什么、分数住在哪、是否报成本、有无已发表的 **multi-agent vs
single-agent 双数字（分数＋成本）** 对照；③成本口径可复算性：token 四分量（uncached input／
output／cache read／cache write）是否可得，币值换算是否可比；④把组织自建任务集挂上公开基准的
**可比性判据**（同口径可直接比／口径不同只能分列，两种情形都要写清）。
另查两类增补：强单代理、多采样与固定拓扑对照的预算消融，以及美元之外的尾延迟、
人工介入和复核代价。候选口径须区分机器用量、人的主动工时和等待时间。
明确排除：不设计新基准、不跑实验（那是实现批与验收实验的事）。

## 关闭判据

- 交付物落盘，含来源表与盲区清单；每条基准给「测什么／分数在哪／成本是否可得／已发表双数字有无」四栏。
- 至少一个已发表的 multi vs single 双数字对照（同集同模型），并注明其口径。
- 给出 Pod 自建卷与公开卷的**可比性判据**（可比／不可比分列），供 09／10 号票直接引用。
- `S3`：若查无任何「分数＋成本同时可得」的套件，明写该结论并给出退路口径（自建口径＋不可比声明）。
- 对照资料标明强单代理、多采样、强固定拓扑及其预算控制，报告搜索、筛选与验证的成本边界。
  缺少强基线时限制可归因结论，不用裸实例失败直接证明组织收益。
- 交付「非美元代价」口径表，含尾延迟的样本与分位定义、超时／失败计入方式、人工介入次数与
  主动工时、机器／人工复核的去重关系。公开字段不足则标未知，候选采集方法标为推断。
  [「划算」判据与门槛口径](10-decision-cost-worthiness-criterion.md)消费本票 Answer 的同名小节，
  是否作为主指标、约束或分列观察由其裁定，不在研究票预定美元折价。

## 输入与依赖

- 与 01 号票第 5 节可能有重叠：01 交付物若已落盘，本票引用并**独立复核数字**，不重复采集。
- 原采集已交付；榜单字段与成本争议的补核见
  [关键引用纠正](../research/evidence-corrections-2026-10-13.md)。

## 可委派工作包

派发前读[研究补核与委派](../research-handoff.md)。已交补核件及验收见 Answer 与 Comments；
下表保留工作包边界，下一包只补覆盖表里的缺口，已核项不重派。

| 工作包 | 有界范围与交付 | 验收与停止条件 |
|---|---|---|
| 同模型双数字 | 只回读原报告 §2.4 的 BudgetMLAgent、Optima 两个候选，提取两臂质量、成本、模型、任务分片及预算，逐篇给是否满足原关闭项第 2 条的证据 | 原表行与分母齐全才可采纳；不同模型、不同集或成本缺失逐项列出。两篇都不满足或不可达时交回缺口，本包结束而整票保持开放 |
| 套件与争议字段 | 先解 PaperBench／RE-Bench 两报告冲突、Terminal-Bench token 包含关系和 HAL 受影响行问题，再按原清单分包核四栏 | 已核公布值引用纠正件，不重复广扫；修复提交与榜单行重算分开，HAL 缺恢复依据则继续隔离。最终原套件清单逐项有覆盖记录 |
| 非美元代价 | 在前两包已取得的论文、数据字典中查墙钟分布、人工介入与复核口径，输出字段、单位、聚合、重叠项与缺失项 | 均值不能替代尾延迟；模型调用费不等于人工成本；机器复核标签不能在调用账上重复相加。仍缺来源则登记缺口，另定补核范围 |

可比性 C1–C9、因果解释和主指标推荐由主会话核对，ds 不改编号或原关闭判据。

## Answer

### 阶段性结果，尚待补核

截至 2026-10-14 第三批补核，本票提供指标候选和可比条件，不替「划算」票裁定主指标。

1. 公开分数与成本同时可得。Terminal-Bench 4.0 官方嵌入数据确认两种不同模型配置
   `Codex + GPT-6 Astra`、`Codex + GPT-6.1 Sol` 均为 58.18%，各 330 trials，公布成本为
   $3,267.18 与 $634.24，算术比约 5.15。它是描述性榜单对照，不是同模型组织收益或等效质量证明。
   续包已核4.0为66任务、35行均报330 trials；34行满足 uncached+output=total，
   Grok 4.7行则加cached才相等。字段恒等式不是计费语义，美元仍为公布值而非账单复算。
2. 「只有两个套件报成本」撤回。SWE-bench 官方 Verified 数据也有 `cost`、`instance_cost`
   和逐实例成本；2026-10-14 的 180 行中 45 行成本非空，全部在 47 行 bash-only 中，非空包含零。
   整轨有 11 个 mini 版本和不同 effort，不能写成只换模型的受控对照。逐行标明来源与缺失。
3. HAL 的 63.9 倍继续隔离。九个服务端表和2026-10-05公告已读：嵌套span导致受影响模型
   恰好高估2倍，单span不受影响，尚未重算。SciCode两行已核为9.23%/$1.74与9.23%/$111.11，
   模型和scaffold不同；受影响行集合仍未知。不是全表统一污染，也没有恢复效率引用的依据。
   上述三项的对象版本、行 ID 与一手定位见[关键引用纠正](../research/evidence-corrections-2026-10-13.md)。
4. 可比性统一为交付物 §4 的 C1–C9。先登记比较问题，再区分处理变量和控制变量。
   组织角色、提示与控制流可作为待测处理；同模型、任务、基础工具能力和记账规则可以固定。
   组织对裸臂并不必然破坏可比性。控制条件满足时可报告差值或比值及不确定性；
   外部榜单的未控差异只能描述，不能归因为组织收益。
5. 成本核算候选见交付物 §3.4。计价按唯一调用和互斥计费分量归账，缓存、失败重跑、编排与
   搜索摊销分别说明。cost per solved task、质量约束下的成本比、固定预算得分与 Pareto 均是候选，
   主判据和门槛由[「划算」判据与门槛口径](10-decision-cost-worthiness-criterion.md)的人机讨论决定。
6. [同模型双数字补核](../research/supplements/02-same-model-dual-metrics-20261013.md)与
   [配置续核](../research/supplements/02-optima-config-and-denominators-20261013.md)支持原关闭项第2条，
   证据层级为论文报告。Optima Table 6明示Llama 3.2 3B：ARC-C的MAD为37.4/872.4 #Tok，
   CoT为51.5/256.1，SC(n=8)为57.6/2068.6；GSM8K的MAD为81.2/763.8、CoT为78.7/288.9。
   同集同模型的未训练multi-vs-single双数字成立，不要求其同时胜出。无美元、无逐run日志，
   或未训练臂无训练checkpoint，都不是原判据外的否决门。样本数、解码设置、完整token记账
   和不确定性仍限制复现与归因；非等预算，不宣称C1–C9全核或组织经济增益。
   训练后Optima另列；BudgetMLAgent头条跨模型且基线成本为估算，不充当同模型证据。
7. [PaperBench／RE-Bench 成本补核](../research/supplements/02-paperbench-rebench-costs-20261013.md)
   已消解两报告的成本覆盖冲突。PaperBench 估算 o1 IterativeAgent 单次12h rollout 每篇 $400，
   20篇各一次 $8,000，另有约 $66/篇的 o3-mini 判分费。PBCD $4,000 是缩短时长的预期，
   不是实付账单。RE-Bench 报每次8h agent运行约 $123 和平均专家支付额 $1,855，后者分母
   未明示，不能硬换算成同质量效率比或时薪。计价脚注、重复统计与GPU排除项见交付物 §2.5。
8. [套件字段续核](../research/supplements/02-suite-fields-20261013.md)已把GAIA、τ组、HLE与OSWorld
   的已读面分开。τ论文给单臂agent/user simulator费用，不是组织对照；HLE有completion token，
   OSWorld有观测token分位数和步数预算，均不能写作全无成本字段。
   [字段缺口补核](../research/supplements/02-gap-rechecks-20261013.md)另确认WebArena为812题，
   MLE-bench的127.5M input+15.0M output为每个含75竞赛seed总量的均值；1800 GPU小时是预算
   上限，非实测用量。版本、分母与仍未覆盖的原套件逐项见交付物§1.3、§6。
9. [三套件四栏续核](../research/supplements/02-suite-fields-remainder-20261013.md)已把
   BrowseComp、SWE-Lancer、TheAgentCompany 补到 12/12 栏：BrowseComp 无官方榜单、
   全文无成本字段（有界检索）、无组织对照；SWE-Lancer §3.6 报 API 费 GPT-4o
   $194.31±$17.31、o1 $1,623.76±$56.68（237 题×5 runs），全部单 agent scaffold，
   任务价值 $1M／Diamond $500.8K 与 API 费分列；TheAgentCompany Table 1 报每任务成本
   （OpenHands+GPT-4o $1.3、Gemini-2.5-Pro $4.2），有部分双臂
   （OpenHands 单 8.6%／16.7%／$1.3 对 OWL RolePlay 多 4.0%／11.3%／N/A），
   多臂含 o3-mini 且正文「Both using GPT-4o」与表列冲突，原样并记，不构成同模型分＋成本
   双数字。三套件均未新增满足原关闭项第 2 条的双数字（仍由 Optima 支撑）。
10. [多 agent 套件补核](../research/supplements/02-multiagent-suites-and-swebench-20261014.md)
    已核 MultiAgentBench 与 MasBench 四栏。MultiAgentBench §5/Fig. 8 有 1/3/5/7-agent 臂，
    但 Fig. 5 token 归一化不能反推绝对成本。MAS-Orchestra v5 Table 3 五列及 D.2 原值已核，
    D.4 给出 prompt+completion 与写作时 Together AI 价目；质量 Avg@8 与资源表重复聚合
    尚未绑定。AFlow/Mas 的 146 倍美元比只由已舍入打印值相除，不是精确账单比。
11. 同包对 SWE-bench Verified 前 15 行按固定提交 README 与 mini v2.0.0 源码分类，得到
    单 agent 结构 7、明确子 agent 1、生成选择／test-time scaling 管线 2、未定 5。
    EPAM 的单结构可重试，TRAE Doubao 的 30 候选和 Rovo 双模型补丁不凭多调用直接归多 agent。
    Warp 的 README 379/500=75.8 与榜单 75.6 冲突并记。分类不是受控双臂；余 165 行在本包
    范围外，不追加全榜分类为关票门。该包未新增同模型双数字或非美元代价观测。

### 非美元代价

候选口径单源为[交付物 §3.8](../research/benchmarks-and-cost-accounting.md#38-non-dollar-cost-candidates)，
分列 token、尾延迟、超时／失败、人工介入、主动工时与等待、机器及人工复核。
公开字段不足处标未知，后续采集方法标为项目推断。本轮没有采集 Pod 的新观测。
均值或时间预算不能替代尾延迟，PaperBench 的总工时包含无人值守实验，不能当主动人工时。
复核用同一调用／活动记录加标签，汇总时去重。主指标、分位、门槛及是否折美元仍由
[「划算」判据与门槛口径](10-decision-cost-worthiness-criterion.md)裁定。

### 关闭检查与移交

| 原关闭项 | 当前证据状态 | 补核完成条件 |
|---|---|---|
| 套件四栏、来源与盲区 | 原表与覆盖见 §1.3；本批补 MultiAgentBench、MasBench 四栏及 SWE-bench 前 15 行有界结构分类 | AgentBench、MAEBE、CoffeeBench、MedAgentBoard 等余项仍待四栏核验；SWE 未定结构、Warp 冲突和各源未知字段继续保留，不另加全榜分类门 |
| 同集同模型 multi-vs-single 双数字 | 通过，论文报告层：Optima Table 6的未训练MAD对CoT／SC，同为Llama 3.2 3B、同行任务列 | 保留#Tok而非美元账单、非等预算、未复现和未核运行配置限制；不追加原判据没有的硬门 |
| 可比性判据 | C1–C9 已纠正，处理与控制变量分开 | 下游沿用该编号和边界，不再写「组织对裸臂必不可比」 |
| S3 公开分数与成本及核算口径 | 公开字段已核，复算候选式见 §3.4 | 保留公布值与独立账单复算的区别，源字段未知不补零 |
| 强基线与预算消融 | Optima 的单次 CoT、八次采样 SC 和固定 MAD 对照已核，但预算并不匹配 | 分列有无强单代理、多采样、固定拓扑和搜索／验证预算，不从未控差值推断组织收益 |
| 非美元代价 | §3.8 已给口径表、样本与分位定义候选、失败／超时和人工／复核去重边界 | 公布值和采集推断分开，无实际 Pod 新数据；分位、主指标及美元折价仍待 HITL |

S3与原关闭项第2条已有证据，不等于整票关闭。原套件逐项覆盖仍缺，触及S4核心盲区；
本票保持开放，下游依赖继续阻塞。未知字段按其影响限制结论，不擅自增加全票硬门。

## Comments

### 2026-10-13 关闭撤销与口径校正

- 失败门：关闭判据第 2 条及 S4。观测值：`240c4b0` 的 Answer 以「查无」代替要求的同集同模型
  双数字对照，且把报告 C1–C9 改写成不一致的 C1–C5；报告 §2.4 的候选尚未核清两臂。
- 处置：撤销 resolved 与地图决议索引；主判据裁定退回 HITL 票，纠正报告中的全称断言、
  HAL 引用强度和控制条件。原关闭文本保留在 `240c4b0`，本次补核记录按上方纠正件定位。
- 移交备注：当前可确认公开分数与成本存在，但还不能据此宣称已得到同模型组织经济增益。
  下一步完成上表第二项和套件成本冲突复核；HAL 继续隔离，除非取得受影响行的明确重算依据。
  建图会话已抽验 `2607.12161` 与 `2510.11977` 摘要；本轮没有重现实验或审计供应商账单。

### 2026-10-13 接受增补与派发准备

补入强基线、预算消融、尾延迟与人工／复核代价；向「划算」票只输出候选口径，
保留其唯一成本定义生产权。第一包用于校准 ds 的数字提取质量，本轮尚未启动。

### 2026-10-13 原生子代理首包开工

用户授权使用子代理，可选 ds4.1。19:32 +08:00 已派 `/root/cost_pair_sources`，
调用模型 `opencode-go/deepseek-v4.1-flash`、effort `max`、`fork_turns=none`，
基线 `a8967ce118c9becfad132159ae50f9a86ba11397`。只核 BudgetMLAgent／Optima，
产物为 `research/supplements/02-same-model-dual-metrics-20261013.md`。
主会话逐条回读首包原文并复算，通过后才扩大派发。此次使用原生子代理，
不启动本机 DSH；票状态、报告整合、因果判断与关票仍由主会话处理。

### 2026-10-13 首包返工与限量续派

首交曾以「没有美元金额」否定 Optima，并漏核未训练 MAD 对 CoT／SC 的对照。
19:47 发出一次定向返工，19:52 收到修订。主会话独立下载同版本 PDF，逐条回读候选
和官方代码，复算表格比值及 BudgetMLAgent 的四处列均值差异。原表数字和跨模型、
训练成本边界可采纳；论文表格的实际样本分母、checkpoint 与完整 token 包含关系
仍未核清，不据此关票。MAD 的两代理设置可由正文及 Table 7 识别，补核件把它继续
列为未知过于保守，整合时纠正；不把工作包验收写成全部结论无误。

本次继续限定 ds 做原文提取，不扩大为整票委派。下一包只核 PaperBench／RE-Bench
的分数、agent 成本、judge 成本和人工成本，输出
`research/supplements/02-paperbench-rebench-costs-20261013.md`。
同一 agent 的实际派发与验收结果随后追加；未知字段保持未知，HAL 等对象不在本包。

约 19:56 +08:00 已向 `/root/cost_pair_sources` 续派上述两论文成本包，沿用同一
`opencode-go/deepseek-v4.1-flash`、effort `max`。仅限该独立输出件与公开原文缓存。

### 2026-10-13 两包验收与接手点

第二包20:09交回。主会话独立取得两个同版 PDF，哈希与采集件一致，回读成本正文、
JudgeEval及复制分数表、RE-Bench图11题注，并复算金额比值。两篇确有成本公布值，
原报告的未核等待位已解除；这不是账单复原，也不是同模型 multi-vs-single 证据。

第二包没有重新派发。提交前澄清了计价对象和「未设字段」的来源范围，并纠正提前填写
的完成时间；验收时主会话再修了「四项齐备」及强加的人工分母。另回读 PaperBench
Table 12，确认20篇三次run；Table 9 的该配置标准误却注明两 seeds，保留表间聚合差异。
人工判分的假设价与人工复制任务实付分开，不用前者填补后者。补核件头部标明主会话校正。

| 工作包 | 执行记录 | 返工与验收 |
|---|---|---|
| 同模型双数字 | `/root/cost_pair_sources`；19:32派发，19:52返工交回，墙钟约20分钟 | 定向返工1次；原表和预算边界采纳，主会话纠正两代理设置、token聚合和复算；实际checkpoint／分母仍缺 |
| PaperBench／RE-Bench | 同一agent续派；19:56至20:09，墙钟约13分钟 | 无重新派发；提交前澄清及主会话语义纠正不计作零返修；金额及成本对象在限定下采纳 |

两包实际模型均为 `opencode-go/deepseek-v4.1-flash`、effort `max`；使用原生协作工具的
shell／网络能力，不是 DSH Delegate 的 `read-only`。原生工具未提供数值 session_id 或
token用量，均记未知。主会话做了交接、独立下载、原表回读、算术复算和消费者整合；
主动核验工时与交接token未单独计量，没有同任务本地基线，不报告净节省。

非美元代价表由主会话用本批已核材料补齐，采集方法均标推断。整票继续开放，接手先查
Optima实际配置和token分母，再补原套件四栏及强基线预算边界；不重复本批已核成本数字。

### 2026-10-13 并发配置补核

用户要求先并发推进可由ds完成的研究票。本票续派 Optima 的实际配置与统计口径包，
只追已有同模型候选的 checkpoint、样本分母、token构成与公开代码对应关系，输出
`research/supplements/02-optima-config-and-denominators-20261013.md`。
已核原表不重抄；公开材料不足时保留缺口，不把代码默认值当成论文运行记录。

### 2026-10-13 原套件四栏续核

继续只派有界资料提取。本包限原清单中的 GAIA、tau-bench／tau2-bench、HLE、OSWorld，
逐项核测量对象、分数入口、成本字段与已发表组织对照的读取范围，输出
`research/supplements/02-suite-fields-20261013.md`。最多20分钟，10分钟先落已核项；
未知和来源不可达分别记录，不把榜单同模型的不同effort行视为multi-vs-single对照。
主会话独立验收后整合，不重跑基准、不降关闭判据。

### 2026-10-13 移交备注：当前假设＋下一步＋关键证据指针

- 当前结果：五份补核已验收并整合。Optima Table 6 的同集同模型未训练 MAD 对 CoT／SC
  已满足原关闭项第2条，S3也有公开字段支持；非等预算、未复现，不推出组织经济增益。
  先前 Comments 中 checkpoint、分母等未知项按当前 Answer 限制引用，不另立关票硬门。
- 未过门：S4 的原套件逐项覆盖。BrowseComp、SWE-Lancer、TheAgentCompany与多agent套件
  尚未补齐成本及组织对照；SWE-bench组织双臂未分类。HAL受影响行仍未知，效率引用继续隔离。
- 下一步：ds先补上述前三套件的四栏，另包处理多agent套件；明确读取范围、成本对象和分母，
  不重派已核数字，不把任务价值、奖金或预算上限当实耗，不改主指标和C1–C9。
- 关键证据：[同模型双数字](../research/supplements/02-same-model-dual-metrics-20261013.md)、
  [配置续核](../research/supplements/02-optima-config-and-denominators-20261013.md)及
  [报告](../research/benchmarks-and-cost-accounting.md)的§1.3覆盖表、§3.8非美元代价与§6盲区。
  本批无在途采集，释放认领，整票保持开放，下游依赖继续阻塞。

### 2026-10-13 第二批并发补核派发——三套件四栏

用户「继续」，沿「只推进 ds 可完成的任务」的授权。主会话认领并委派原清单未覆盖套件：
BrowseComp（arXiv 2504.12516，simple-evals）、SWE-Lancer（arXiv 2502.12115）、
TheAgentCompany（arXiv 2412.14161），逐套件核「测量对象／分数入口／成本字段／已发表组织对照」
四栏及版本分母。独立输出 `research/supplements/02-suite-fields-remainder-20261013.md`，
基线 `41e59b5`。未读面写未核验、不写不存在；不重派已核四套件，不改本票与报告，关票验收仍由主会话执行。

### 2026-10-14 第二批补核验收与移交备注

- 验收：`research/supplements/02-suite-fields-remainder-20261013.md` 已回读抽核
  （SWE-Lancer §3.6 金额与分母、TheAgentCompany Table 1 行与正文/表模型列冲突、
  BrowseComp 全文零成本字段的有界检索范围与 simple-evals 入口）。
- 当前结果：三套件 12/12 栏有提取记录，0 项来源不可达；均未新增满足原关闭项第 2 条的
  同模型分＋成本双数字（该条仍由 Optima 补核支撑）；TheAgentCompany 的同集多／单仅质量
  数字且多臂异构，列为有界发现。
- 未过门：S4——余下多 agent 专用套件与 SWE-bench 组织双臂未核；三套件未知字段
  （Table 3 分母、金额单位、模型版本日期）按其影响保留。
- 下一步：另包处理多 agent 套件与 SWE-bench 双臂分类；不重派已核数字，不把任务价值、
  奖金或预算上限当实耗，不改主指标与 C1–C9。
- 关键证据：[三套件四栏续核](../research/supplements/02-suite-fields-remainder-20261013.md)
  与报告 §1.3／§6。本批无在途采集，释放认领，整票保持开放，下游依赖按当前 Answer 的限制引用。

### 2026-10-14 第三批验收与移交备注

- 派发范围：沿用户的 ds 可处理任务授权，基线 `b4fa51da2c2f316e0513382276d286669aa8a25e`，
  只核 MultiAgentBench、MasBench 和 SWE-bench 字段／有界组织分类。交件已结束，未重新派返工。
- 验收：主会话回读论文表图、官网 180 行数据、11 份固定提交 README、mini v2.0.0 代码与
  成本图字段。拒收 MultiAgentBench「无单 agent 臂」；纠正 MAS-Orchestra 五列映射、
  AFlow 调用倍数与 CoT 比值方向；SWE 多尝试、选择管线和明确子 agent 分开，不凭名称分类。
- 当前结果：两套件四栏与前 15 行分组进入报告 §1.3/§1.4；45 个非空成本不等于正价格。
  Warp 的 75.8/75.6 冲突、5 个未定结构、资源／质量聚合绑定与训练账缺口保留。
  S3 和同模型双数字仍按当前 Answer，未由本包建立新的受控组织经济结论。
- 未过门：S4，原套件清单 AgentBench、MAEBE、CoffeeBench、MedAgentBoard 等仍未核。
  下一包优先从此表选至多三套件，逐项核四栏；SWE 未定项仅在取得新架构证据时定向补，
  不重采已核榜单、不把全榜结构分类加成关票门。C1–C9、主指标和 HITL 选择不变。
- 关键证据：[多 agent 套件与 SWE-bench 补核](../research/supplements/02-multiagent-suites-and-swebench-20261014.md)。
  该包无在途采集，释放本票认领；其他会话以在办登记为准。实际模型为
  `opencode-go/deepseek-v4.1-flash`、effort `max`；精确工时、session_id、token 未计量，
  主会话一轮回读、分类补证与语义修正不记零返修或净节省。
