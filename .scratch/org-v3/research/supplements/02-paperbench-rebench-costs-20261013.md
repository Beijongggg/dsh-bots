# PaperBench 与 RE-Bench：分数、agent 成本、judge 成本与人工成本核验

- 基线 `a8967ce118c9becfad132159ae50f9a86ba11397`；采集 2026-10-13 19:56–20:05 +08:00（19:56–19:57 抓两个 PDF 与 abs 页，20:03–20:05 追补 METR 全文报告与官方仓库检查）；本件 20:09 +08:00（初稿提前填的 20:15 已按 `date` 实测改正）。
- 范围：只核 [02 号票](../../issues/02-research-benchmarks-with-cost.md) 工作包「套件与争议字段」中 PaperBench、RE-Bench 的分数、agent 成本、judge 成本、人工成本四项，并消解 `benchmarks-and-cost-accounting.md` 与 `multi-agent-organization-landscape.md` 的成本覆盖冲突；Terminal-Bench token 包含关系、HAL 受影响行与整票关闭性不在本包。未跑实验、未装依赖、未访问 DSH、未改票面、报告、地图或 Git。
- 快照：`/tmp/org-v3-pbrb.urgRRE/`（临时目录，可能不保留；含 `collection-log.txt` 与 `sha256.txt`）。PDF SHA-256：PaperBench `2f58f1a6581af9d99432422dccf3cf61f5c263377c1e4550e7333c4a22d7184d`（[2504.01848v3](https://arxiv.org/pdf/2504.01848v3)，2025-04-07）；RE-Bench `9d25c5ea6abfeeb40b5c8fa7a8e637cd8785d2a0f022f2798c33769af8d66992`（[2411.15114v2](https://arxiv.org/pdf/2411.15114v2)，2025-05-27）；[METR 全文报告](https://metr.org/AI_R_D_Evaluation_Report.pdf) `d748e856dc4f3f7835b85dda52a1c7a61463c52061d17b2cbf2c2a9eb07f4fbc`，其 $123/$1,855 段与 arXiv v2 同文。
- 结论：PaperBench 有分数、agent 与 judge 成本估算，另有人工判分假设价，人工复制任务的实付成本仍未知；RE-Bench 有分数、agent 成本与平均专家支付额，所读来源用程序化评分，未报独立 judge 费用。两报告的成本覆盖冲突可解除，不代表完整成本四栏已齐。$8,000、12.6×、$123、$1,855、15.1× 的原文或算术可核；估算属性、分母、H100 排除项及脚注计价对象限制见各主张。
- 主会话验收校正：独立 PDF 哈希吻合，回读成本正文、相关原表和图题注；纠正「四项齐备」、人工支付分母及重复次数推断。未提取曲线点值、复现实验或审计账单。各消费者的行号是整合前定位，现行结论按章节读取。
- 行号指快照内 `paperbench.txt`／`rebench.txt`（`pdftotext -layout` 派生文本）行号，页码为各自 PDF 页码。

## 主张 P1：PaperBench agent 成本分列，口径为 o1 IterativeAgent 的 API 信用估算

**主张与用途**：成本报告 `benchmarks-and-cost-accounting.md:50` 把 PaperBench 标为「unverified: did not read cost appendices」并要求「judge cost 与 agent-run cost 分开」；形态报告 `multi-agent-organization-landscape.md:1327–1329`、`:1440` 引用 $400/$8,000/$66/$4,000/$10。本主张核「成本是否可得」栏。

**来源定位**：§7 Limitations「Cost」（PDF 第 9 页，`paperbench.txt` L628–637）；§4.1（第 6 页，L405–411）；§5.1（第 6 页，L437）。

**实读层级**：全文；成本句与相关表格逐格回读，页码用 `pdftotext -f/-l` 复核。

**证据结论**：四个金额均可复述，但分别是「估算」与「预期」口径，且只覆盖论文点名的配置。
- agent [作者报告，估算]：`We estimate that on average it costs $400 in API credits to run an o1 IterativeAgent 12-hour rollout on a single paper`；20 篇合计 `$8000 USD per eval run`。口径是 o1 IterativeAgent 单篇、单次 12 小时 rollout 的均值与 20 篇各一次的合计；不是「任意 agent」的通用成本，也不是论文全部重复实验的总账。原文未把这项估算绑定到逐篇、逐次成本记录，不按分数表的重复次数补算实付总额。
- PBCD [作者报告，预期非实测]：因无执行、时长可减半，`would lead to a cost of $4000 USD per eval run`。
- 计价依据 [存疑，保留原文]：$400 未附价格表；判分侧脚注 7 写 `Based on public OpenAI o1 API pricing as of 2025/03/21`（第 6 页），本件不把它改读为 o3-mini 价格，也不用任何当前价目复建原账单。
- 环境额度 [事实记录]：运行时给 agent 的 OpenAI API key 预载 $1,000（§5.1）；是可用额度，不是已花金额，论文未报实际消耗。
- 分臂空白 [未核验]：$400 只给 o1 IterativeAgent；其他模型与 BasicAgent 的 rollout 成本未报。

**量化附项**：

| 项 | 数值 | 口径／定位 |
|---|---|---|
| agent rollout（12h） | $400／篇（均值） | 仅 o1 IterativeAgent，单次 rollout，API 信用估算；§7 p9 |
| 单次评测（20 篇） | $8,000 | 20 篇各一次；未含重复倍数声明；§7 p9 |
| PBCD 单次评测 | ≈$4,000（预期） | 时长减半外推；§7 p9 |
| 判分（主集） | $66／篇（均值） | o3-mini SimpleJudge；§4.1 p6、§7 p9 |
| 判分（PBCD） | ≈$10／篇 | §4.1 p6、§7 p9 |

**作者与项目边界**：全部为作者报告或估算；未审计账单；GPU／基础设施成本未计；$400 与 $8,000 的重复分母与逐篇离散度未给。

## 主张 P2：PaperBench judge 成本有逐模型表、token 量与降本实验，计价对象存疑保留

**主张与用途**：解成本报告 :50 的分离要求，并核形态报告 :1327–1329 的 JudgeEval 数字与 12.6×。

**来源定位**：§4.1–4.2 与 Table 3（PDF 第 6 页，L400–453）；图 5（第 17 页，L1085–1103）；附录 H（第 18 页，L1126–1133）。

**实读层级**：Table 3 全格回读；图 5 为 F1-vs-$/paper 图，只核题注与正文，不提取点值；表 3 与附录表 8 的 overall 列已对照。

**证据结论**：
- Table 3 [作者报告]（JudgeEval 宏观平均 F1／平均 $/篇）：见下表。
- 选型 [作者报告]：论文称 o3-mini 最 cost-effective 并用作主结果 judge（§4.2）。
- 计价对象疑问 [存疑，保留原文，不修正]：脚注 7 附在 o3-mini／$66 句上，却写 `Based on public OpenAI o1 API pricing as of 2025/03/21`；图 5 题注与正文重复同一短语作为全部 model backend 的成本轴依据。论文未给逐 token 单价，$8/$66/$72/$120/$830 只能按印刷值引用；本件不把该短语自动修正为 o3-mini 价格，也不拿当前或历史价目补算原账单。
- 比率 [独立复算]：o1 对 o3-mini 为 830/66≈12.6× 判分费换 +0.01 F1（0.84−0.83），与形态报告一致；论文自身表述为「one-tenth of the cost」于可比 F1，两者相容。该比率继承上面的计价对象疑问。
- 印刷不一致 [并列，不裁定]：o1-mini overall F1 在 Table 3 为 0.78、Table 8 为 0.77；其余行一致。
- 降本实验 [作者报告，初步]：附录 H 在 depth 3 剪枝把判分成本降 10×，性能小幅下降；作者自注为实验版 Judge。
- 人工判分对照 [作者报告，假设价]：图 5 以「12 hours of work at an hourly rate of $100 USD/hr」= $1,200／篇定价；正文另称初步实验中人工判分需 `tens of hours per paper`（§4，p6）。前者为假设价格点，后者为实验量级描述，不能互作实付工时，也不足以判为同一统计量的印刷冲突。
- 判分 token 量 [作者报告]：平均每篇约 50,000,000 input + 2,000,000 output token（脚注，p6）。
- JudgeEval 口径 [作者报告]：4 篇 PaperBench 论文的部分复制 + 1 篇开发集，宏观平均；故 $/篇为 JudgeEval 判分成本，主集的 $66 来自 §4.1/§7。

**量化附项**（Table 3，JudgeEval）：

| judge backend | F1 | $／篇 |
|---|---:|---:|
| Random | 0.49 | 0 |
| GPT-4o-mini | 0.59 | 8 |
| GPT-4o | 0.73 | 120 |
| o1-mini-high | 0.78 | 72 |
| o3-mini-high | 0.83 | 66 |
| o1-high | 0.84 | 830 |

**作者与项目边界**：数字为作者报告；判分模型成本按论文所写价格依据估算（对象存疑）；未审计供应商账单。

## 主张 P3：PaperBench 分数与人工基线；$400 与 Table 5 的配对须注明位置与分母

**来源定位**：Table 4/5/6（第 7 页，L440–486）；§5.4 与图 3（第 8 页，L527–560）；Table 9（第 19 页）；Table 12/14/16（第 21–23 页）。

**实读层级**：各表单元格回读；图 3 为曲线图，只核题注与正文。

**证据结论**：
- 主结果 [作者报告]：BasicAgent（Table 4，§5.2 称20篇×3 runs/paper，12h 上限）：o3-mini 2.6±0.2、GPT-4o 4.1±0.1、Gemini-2.0-Flash 3.2±0.2、DeepSeek-R1 6.0±0.3、o1 13.2±0.3、Claude 3.5 Sonnet 21.0±0.8；IterativeAgent（Table 5）：o3-mini 8.5±0.8、Claude 16.1±0.1、o1 24.4±0.7，36h o1 26.0±0.3；PaperBench Code-Dev（Table 6）：o1 43.4±0.8。
- $400 与 24.4 的配对 [位置与分母分列]：24.4±0.7 在 Table 5；Table 12 列出20篇的三次 o1 IterativeAgent run，印刷单元格均值复算为24.405%。但 Table 9 题注又称该配置的分类型标准误用两 seeds；原文不同表的聚合不统一，本件不替其确定全部误差分母。$400 在 §7，是单篇单次12h rollout 均值估算，无逐次成本表。二者可按同配置并列，不能当成同分母账表或组合统计结论。
- 分需求类型 [作者报告]（Table 9）：o1 36h 为 42.4/7.4/1.4（Code Dev／Execution／Results Analysis）；Best@3 Human［3 篇子集］为 72.4/20.4/8.9。
- 人工基线条件 [作者报告]（§5.4）：8 名 ML 博士、4 篇子集、每篇 3 次独立尝试、best@3 记为 expert；兼职 4 周窗口，第 1 周后只延长最好者；工时表计主动时间并含机器无人值守时间；允许 AI 助手，禁访黑名单网站。
- 人机曲线 [作者报告，图]：o1 36h 前段领先，24h 后被人类反超；test-time-model-adaptation 的人类尝试止于 24h，被排除出「3 篇子集」。图内逐小时点值未提取 [未核验]。
- 人工实付 [未核验]：所读来源未给参与者报酬或时薪；唯一金额是 P2 的假设 $100/hr 判分费率。复制基线的人工成本字段在所读来源中未设。

**作者与项目边界**：分数与条件均为作者报告；未联系参与者、未复现实验。

## 主张 P4：RE-Bench 四项字段核对（judge 字段在所读来源未设）

**主张与用途**：核成本报告 `benchmarks-and-cost-accounting.md:51` 的「unverified beyond time budgets」与 :302–305 的 run-time proxy 归类；核形态报告 :1319–1320 的数字。

**来源定位**：摘要（PDF 第 1 页）与 §3.4＋Table 5（第 11 页，L575–601）；§4（第 13 页，L670–690）；§4.2（第 13 页，L700–715）；§5.1（第 16–17 页，L783–803）；§6.2（第 19 页，L927–938）；图 11（第 20 页，L945–951）；附录 A（第 25 页，L1193–1237）。官方仓库 `METR/RE-Bench`（原 `ai-rd-tasks`）主干树只含环境与评分函数，无账单文件。

**实读层级**：上述段落全文回读；图 11 只核标题、题注与正文，不提取点值；官方仓库做只读树与 README 检查各一次；METR 全文报告作同文交叉核对。

**证据结论**：
- 分数 [作者报告]：7 环境；71 次 8 小时人工尝试／61 位专家；82% 尝试非零、24% 达到或超过参考解；人类总均值 0.64（Table 5），分来源 0.48／0.98／0.83（45／17／9 次）。头条：2 小时预算下最好 agent 为人类 4×；8 小时人类略超最好 agent；32 小时人类为 2×。最好 agent 匹配人类第 36/37 百分位（§4.2）；内核优化中 o1-preview 的解胜过全部 9 位人类专家（§5.1）。
- 印刷不一致 [并列，不裁定]：§3.4 正文写专业网络 0.96、招聘通道 0.46；Table 5 同行印 0.98、0.48。
- agent 成本 [作者报告]（§6.2）：每次 8 小时运行平均约 29M input + 499K output token、约 $123；未给计价依据，未按模型／脚手架分列；作者称 prompt caching 可进一步降本。图 11 题注：该图不含环境所用 H100 成本；同等成本预算下 agent 的算力是人类专家的 10 倍以上。
- 人工成本 [作者报告]：`approximately $1,855 that we paid our human experts on average`（§6.2）。分母未在原文写明，不替作者补成每次8h尝试或推算时薪；15.1×＝1,855/123≈15.08 [独立复算]，只是印刷金额之比，不是同质量、同算力成本比。
- judge 成本 [事实记录，限所读来源]：所读来源以每环境自带评分函数给分（图 1、§3），未见 LLM judge 或其费用；故 judge 成本字段仅就所读来源未设，非全称断言，也不等于「未核到值」。$1,855 是专家劳动，不是判分费。
- 追踪空白 [未核验]：图 11 点值未提取；论文脚注 1 称分析代码与匿名化人工数据「coming soon」；transcripts.metr.org 未访问。

**量化附项**：

| 项 | 数值 | 口径／定位 |
|---|---|---|
| agent 每次 8h 运行 | ≈$123；≈29M input＋499K output token | §6.2 p19；未分臂 |
| 作者报告平均专家支付额 | ≈$1,855 | §6.2 p19；分母未明示 |
| 比值 | 15.1×（复算 15.08） | 形态报告 :1320；本件复算 |
| judge | 未设（限所读来源） | 程序化评分函数，无 LLM judge |
| 排除项 | H100 成本不计；同预算下 agent 算力＞10× | 图 11 题注 p20 |

**作者与项目边界**：数字为作者报告；未审计账单；$123 未给计价依据；未复现、未提取图数据。

## 冲突消解

| 冲突件 | 原陈述 | 一手核验 | 处置 |
|---|---|---|---|
| 成本报告 :50 | PaperBench「unverified: did not read cost appendices」 | 成本在正文 §4.1／§7、表 3 与附录 H，已回读 | 可改「已核」，保留估算属性 |
| 成本报告 :51、:302–305 | RE-Bench「unverified beyond time budgets」；归 run-time proxy | §6.2 报 token＋USD；图 11 为成本图 | 撤回 time-budget-only，改归 token／美元报告 |
| 形态报告 :1319–1320 | ~29M／~499K、~$123、~$1,855、「per 8-hour human attempt」、15.1× | 数字属实；人工分母未明示；15.1× 仅为算术比 | 保留公布值，撤回强加的人工分母及同质量效率含义 |
| 形态报告 :1327–1329 | JudgeEval 0.59@$8…0.84@$830；12.6× 换 +0.01 F1 | Table 3 属实；830/66≈12.58；脚注 7 计价对象存疑 | 可继续引用；注明 JudgeEval 口径、0.77/0.78 印刷差与计价对象疑问 |
| 形态报告 :1356–1357 | 两套件「conflict awaits primary-table reconciliation」 | 本件已回一手 | 等待位可解除 |
| 形态报告 :1440 | $8,000/run（PBCD ~$4,000） | §7 属实；限 o1 IterativeAgent 单次口径；PBCD 为预期 | 保留，加「配置＋预期」限定 |
| 成本报告 :50 | 「judge cost 与 agent-run cost 分开」 | $400 与 $66 分列；RE-Bench 所读来源为程序化评分，无 judge 费用 | 要求已满足 |

## 剩余缺口

- PaperBench：未审计账单；$400 未给逐篇离散度与重复分母；Table 3 为 JudgeEval 判分口径，非20篇主集 rollout；PBCD $4,000 为外推预期；$1,000 额度实际消耗未报；人工复制任务报酬未知；Table 9 两 seeds 与 Table 12 三 runs 的聚合差异、脚注7计价对象未解；未联系作者。
- RE-Bench：$1,855 分母与补偿标准未写；$123 的计价依据、日期与分臂构成未写；H100 成本不计；图 11 点值与 transcripts.metr.org 数据未提取；Table 5 与 §3.4 的均值印刷差异未解。
- 两篇均未复现实验、未审计供应商账单；本件不裁定整票关闭性，评判留主会话。

## 原关闭项覆盖

| 原关闭项 | 本包覆盖与限制 |
|---|---|
| 套件四栏、来源及盲区 | 两套件的分数与成本来源已核，人工与judge按对象分列；全清单及multi-vs-single配对不在本包 |
| S3公开分数与成本 | 增加两篇可定位的公布值，完整账单和价格复算未得 |
| 非美元代价 | 提供工时／时间预算与专家支付额线索；尾延迟、介入和复核去重表尚未完成 |

## 执行记录（2026-10-13，+08:00）

- 抓取与哈希：见 `/tmp/org-v3-pbrb.urgRRE/collection-log.txt` 与 `sha256.txt`；PDF 与 abs 页 19:56–19:57，METR 报告与仓库检查 20:03–20:05。
- 全部访问只读：arxiv.org、metr.org、api.github.com、raw.githubusercontent.com；未登录、未安装、未访问 DSH、未改票面、报告、地图与 Git。
- 独立复算：1,855/123≈15.08→15.1；830/66≈12.58→12.6；400×20=8,000；100×12=1,200。复算只验算术，不验数据来源，也不重建账单。
- 模型 `opencode-go/deepseek-v4.1-flash`、effort max；session_id 与 token 用量未知。主会话验收在本件之外；本件不代表原论文实验已复现。
