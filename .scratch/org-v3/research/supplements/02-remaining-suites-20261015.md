# 02 带成本公开基准：MedAgentBoard／DebateLLM／lechmazur 游戏套件 四栏补核（补核件）

[带成本的公开基准与成本口径](../../issues/02-research-benchmarks-with-cost.md)「原套件逐项覆盖」第五批。只交一手字段提取与缺口；不裁定、不整合、不关票。基线 commit `85c0894119d8ea511609395e78910d382a309b99`。派发配置（主会话指定）：本包为原生协作子代理、单一有界资料提取；不改 C1–C9、原关闭判据或主指标，不运行基准/论文代码，不嵌套委派。

- **采集性质：** 一手字段提取（论文 HTML/abs、仓库 README 原文），未复现、未运行；成本数字一律照原文抄录并标对象与分母。
- **快照语义：** arXiv 按版本号定位（可复现）；GitHub README 经 `raw.githubusercontent.com` 的 `main` 分支取回，属**滚动快照**，未绑定 commit（见盲区）。本件时间：首/末命令 2026-10-15 17:09:49／17:2x（+08:00，仅首次记录到分钟）。

## 来源表

| # | 来源 | 层级 | 版本／定位 |
|---|---|---|---|
| S1 | `arxiv.org/abs/2505.12371` ＋ `arxiv.org/html/2505.12371v2` | 一手（书目＋全文） | `MedAgentBoard: Benchmarking Multi-Agent Collaboration with Conventional Methods for Diverse Medical Tasks`；Yinghao Zhu 等 9 人；v1 2025-05-18、**v2 2025-10-30**；NeurIPS 2025 Datasets & Benchmarks Track（README 声明） |
| S2 | `raw.githubusercontent.com/yhzhu99/MedAgentBoard/main/README.md` | 一手（仓库文档） | 滚动 main，2026-10-15 取回；指向 arXiv 2505.12371、项目站 `medagentboard.netlify.app`、Zenodo 记录 `22299495` |
| S3 | `arxiv.org/abs/2311.17371` ＋ `arxiv.org/html/2311.17371` | 一手（书目＋全文） | `Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs`；Smit、Duckworth、Grinsztajn、Barrett、Pretorius；提交 2023-11-29，本包取最新版（README 引用为 v3 / 2024） |
| S4 | `raw.githubusercontent.com/instadeepai/DebateLLM/main/README.md` | 一手（仓库文档） | 滚动 main，2026-10-15 取回；基准图在 `imgs/results/`，论文链接 arXiv 2311.17371 |
| S5 | `raw.githubusercontent.com/lechmazur/elimination_game/main/README.md` | 一手（仓库文档） | 滚动 main，2026-10-15 取回；无 arXiv／论文入口 |
| S6 | `raw.githubusercontent.com/lechmazur/step_game/main/README.md` | 一手（仓库文档） | 滚动 main，2026-10-15 取回；无 arXiv／论文入口 |
| S7 | `raw.githubusercontent.com/lechmazur/pgg_bench/main/README.md` | 一手（仓库文档） | 滚动 main，2026-10-15 取回；无 arXiv／论文入口 |
| S8 | `api.github.com/repos/{…}/commits?per_page=1` | 一手（API，访问失败） | 2026-10-15 对 S2、S4、S5、S6、S7 五个仓库均返回 **HTTP 403**，无 commit SHA；按不可达记录，不当空结果 |

缓存目录 `/tmp/org-v3-w5-02-20261015/`（非冻结件）。完整 SHA-256 见缓存清单。

## 缓存清单（`/tmp/org-v3-w5-02-20261015/`，节选关键文件，SHA-256）

| 来源 | 文件 | SHA-256 |
|---|---|---|
| S1 | medagentboard-html.html | `d3eb78b85e924cd26ba2e6e9bf69ae24b93ef45743c8ec7c328ef14df545dac3` |
| S1 | medagentboard-abs.html | `cb63beb704532486dabad1e48d33131540124d08cbad1794ee75941f78dd01a2` |
| S2 | medagentboard-README.md | `0fcd5587f44cb12a2bc46049ffa532e14ab8c24394b4a918e0eed548af1ed546` |
| S3 | debatellm-html.html | `fb72807a9dd08ec514b43042c29dcfea3a1ce588d26452ef8bccc3ee8070d562` |
| S3 | debatellm-abs.html | `36128d5cd59facc8298cae929e554fdfc8816b296e30cc9ab98347d4316f5fcd` |
| S4 | raw-instadeepai-DebateLLM-main.md | `4cae6beaf4877bc8813dcea3af20c14fc16d1cb18b01c6c72af62bf7689711be` |
| S5 | raw-lechmazur-elimination_game-main.md | `788ec3eb6fa034a82b22760f95eb04a514aa0c15e1c15d134fc350a59d1696f0` |
| S6 | raw-lechmazur-step_game-main.md | `efe1dc70dc72af21de23eac10ce8f113902fb54453b871bf4aa2706ed72e0f29` |
| S7 | raw-lechmazur-pgg_bench-main.md | `865184383e0ea5bd2cc1c4b640427043a728f855421a3f1047b7bfa5c2b48f7f` |

（另落盘去标签纯文本 medagentboard-text.txt `1ed72569…`、debatellm-text.txt `24260358…`，供回读复算；未列的 arXiv 查询 XML 为空结果，见盲区。）

## B1 MedAgentBoard（S1＋S2）

- ①测量对象：四大医疗任务——(1) 医学（视觉）问答 MedQA/PubMedQA/PathVQA/VQA-RAD；(2) 通俗摘要生成；(3) 结构化 EHR 预测；(4) 临床工作流自动化。对比轴为 multi-agent 协作 vs 单 LLM vs 传统（非 LLM）模型。**成本表仅出现在 Task 1**（S1 Appendix D）。
- ②分数住处：论文 Task 1 分数为 **Table 3**（各类方法 × 6 个数据集-设置列的准确率／评分±std），其余任务各有专表；仓库＋项目站＋Zenodo 记录 `22299495` 存全量日志/数据/结果（S1、S2；Zenodo 未访问核验）。
- ③成本字段：**有（论文）**。Appendix D **Table 13「Estimated cost (USD) on the selected test set for Task 1, based on the DeepSeek API pricing strategy」**，另 Table 12 给「平均讨论轮数/问题」。口径：**估算的 API 费用**（非账单），对象＝Task 1 选定测试集，计价基准＝DeepSeek 价目表；**分母＝选定测试集约 200 题/数据集**（Table 7「Sampled Test」列，MedQA/PubMedQA/PathVQA 各 200，VQA-RAD MC 200、FF 179）。方法代理模型：多 agent 框架（MedAgents/MDAgents/ColaCare）各 agent 用 **DeepSeek-V3-0324**，ReConcile 因鼓励多样性用异构模型（DeepSeek-V3-0324＋Qwen-Max-Latest＋Qwen-VL-Max 等）。
- ④已发表 multi-vs-single 对照：**有**（同任务、多数同模型）。Task 1 MedQA 多选题，分数（Table 3）与费用（Table 13，USD）同列可对照：单 LLM Zero-shot 77.50 / $0.39；CoT 87.30 / $1.84；CoT-SC 89.90 / $7.99。多 agent：MedAgents 85.25 / $2.71、MDAgents 78.80 / $2.13、ColaCare 84.65 / $2.64、ReConcile 78.00 / $3.05。原文结论：多 agent 普遍贵于 Zero-shot/CoT，且不持续超过最佳单 LLM；文本 QA 上单 LLM 的 CoT-SC 反而最贵。ReConcile 为异构模型臂，非纯同模型对照。

## B2 DebateLLM（S3＋S4）

- ①测量对象：多选题 QA 上「multi-agent debate（MAD）协议 vs 单 agent 提示策略」的准确率、时间与成本权衡。数据集：MedQA（1273，4 选项版）、PubMedQA（500）、MMLU 临床子集（123）、CosmosQA（7000）、CIAR、GPQA（448）。全实验默认模型 **GPT-3.5**（GPT-4 仅 MedQA 补充）。
- ②分数住处：论文 **Table 2**（各系统跨数据集最佳分）与 **Table 3**（完整实验配置表），以及 Figure 1/2 散点与箱线图；仓库 `imgs/results/` 存对应图（README 亦展示）。协议含 ChatEval、Ensemble Refinement、Self-Consistency、Multi-Persona、Society of Mind、Medprompt。
- ③成本字段：**有（论文）**。**Table 3 每数据集列出「Score」与「Cost $」两列**；Figure 1 标题为「Accuracy vs average cost ($) per question」。口径：**论文报的成本列**，对象＝每问题平均 API 成本（依据图题，非账单）；分母＝各数据集题数（MedQA 1273 等）。另报平均耗时与每问题 token 数。
- ④已发表 multi-vs-single 对照：**有**（同模型 GPT-3.5）。MedQA 列示例：Single Agent SIMPLE 0.76 / $0.43；ChatEval（2 rounds, one by one）0.71 / $1.81；Society of Mind（2 agents, 2 rounds）0.70 / $1.73；Multi-Persona（ANGEL+DEVIL 4 rounds）0.72 / $1.57；Medprompt（非 debate）0.72–0.74 / $2.16。原文结论：医学数据集上各系统多超过单 agent（Multi-Persona 除外），但**非 debate 的 Medprompt 总体最佳且成本更低**；非医学数据集上单 agent 反超所有 debate 方法。

## B3 lechmazur 游戏套件（S5＋S6＋S7）

三仓各自独立、**均无 arXiv／论文入口**（README 内 `paper` 命中仅指 TrueSkill 官方链接），按实际结构分列。

- ①测量对象：LLM 之间的博弈。
  - **elimination_game**：8 名玩家淘汰赛，公开＋私下对话、结盟、逐轮投票淘汰，淘汰者组成评审团定冠军；测社会推理、策略与欺骗。
  - **step_game**：3 人「步数赛」，公开对话后秘密选 1/3/5 步，撞车者不前进，先到 16–24 步者胜；测协作与欺骗。
  - **pgg_bench**：公共品博弈＋惩罚，18 个 LLM，每局 5 个 LLM 起 20 tokens、打 10 轮，贡献→乘 1.6 均分→惩罚；测合作/自利，另有「关闭公开消息」对照版本。
- ②分数住处：各仓 **README** 给 TrueSkill 榜单（μ±σ）、名次分布、背叛率/撞车率/用词量等图（`images/`）；无在线榜单、无论文表。分数以图呈现，未在文本给逐模型数值。
- ③成本字段：**未发现（有界未发现）**。已读三份 README 无 LLM API 成本/美元/token 账单字段；`$` 命中（pgg_bench）与 `token` 命中（pgg_bench 39 处）**均为博弈内货币**，不是推理成本。elimination_game/step_game 的 `cost` 命中均为策略叙述用语。**不等于**该套件在他处无成本字段。
- ④已发表 multi-vs-single 对照：**未找到**。三套件的全部被测臂都是 **LLM 对 LLM 的对局**（按构造即多智能体），不存在「单 agent vs 组织」臂；`single-agent`／`single agent`／`vs single` 在三份 README 均**零命中**（有界未发现）。跨模型排名属描述性差异，不构成组织收益证据。

## 原关闭项覆盖表与剩余缺口

| 原关闭项 | 本包证据状态 | 剩余 |
|---|---|---|
| 套件四栏（测什么／分数在哪／成本／双数字） | MedAgentBoard、DebateLLM、elimination_game、step_game、pgg_bench 五套件四栏已补（B1–B3） | 原清单仅余 alem-env 未核 |
| 同集同模型 multi vs single 双数字 | **新增两例论文报告层**：MedAgentBoard Task 1（DeepSeek-V3-0324，Table 3 分＋Table 13 费）、DebateLLM（GPT-3.5，Table 3 Score＋Cost $）；均为估算/公布值，非账单复算 | 原项仍由 Optima 支撑（本包未复核）；ReConcile 臂为异构模型 |
| 可比性 C1–C9 | 未改动、未新增编号 | 仍由主会话维护 |
| 分数＋成本同表可得 | MedAgentBoard Table 13、DebateLLM Table 3 各新增一例（公布值，分母口径见 B1/B2） | lechmazur 三套件无成本列 |
| 强基线与预算消融 | MedAgentBoard、DebateLLM 有单 LLM 基线；均**未见等预算匹配** | 跨模型/跨协议差异不得归因组织收益 |
| 非美元代价 | MedAgentBoard 报平均讨论轮数；DebateLLM 报每问题耗时与 token | lechmazur 仅有博弈内行为计数（撞车率、用词量、名次），非推理成本 |

**盲区清单**（均为真实限制，不补零、不编造）：(1) `api.github.com` 对五个仓库均 403，**未取到 commit SHA**，S2/S4/S5/S6/S7 均为滚动 main 快照。(2) MedAgentBoard Table 3 分数分母未在已读文本重述，与 Table 13 的「selected test set（约 200）」是否同分母为**推断，未绑定**；Table 13 为 DeepSeek 价目表**估算**，非实耗账单。(3) DebateLLM Table 3「Cost $」的每问题口径取自图题，**未逐格绑定**；GPT-3.5 价目表与计价日期未在已读文本给出。(4) lechmazur 三仓无论文，分数以图呈现，**未 OCR 取数**；成本字段为**有界未发现**。(5) 本包未运行任何基准/论文代码，未访问 MedAgentBoard Zenodo 记录与项目站。(6) 首次 arXiv API 查询（`http://`）因 301 未跟随得到 0 字节空文件，**已弃用，非空结果**；改用 `-L` 后正常。

检索与范围（HTML 去标签后全文正则）：MedAgentBoard v2 `cost|USD|\$|pricing|token|latency|budget|single agent|conventional`，另读 §3.1、§4.1、Appendix B.1/B.4、D（Table 12/13）；DebateLLM `cost|\$|USD|price|token|latency|single-agent|single agent|MedQA|PubMedQA|MMLU`，另读 Table 1/2/3、Figure 1/2 图题、数据集与模型段；lechmazur 三 README `cost|\$|USD|price|token|latency|budget|API|multi-agent|single-agent|single agent`。有界未发现仅限上述已读范围，不等于来源不存在该字段。仓内写入仅本件。
