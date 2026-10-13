# BudgetMLAgent 与 Optima：同集同模型双数字补核

- 基线 `a8967ce118c9becfad132159ae50f9a86ba11397`；采集 2026-10-13 11:32–11:38 UTC（19:32–19:38 +08:00），本件首版 19:46 +08:00，返工修订 19:52 +08:00。
- 范围：只回读原报告 §2.4 的 BudgetMLAgent、Optima 两个候选；返工轮增查论文外链官方 project page 与仓库一次（仅指标口径与 split 配置，见「官方代码核对」节）；未跑实验、未装依赖、未访问 DSH、未改票面、报告、地图或 Git。
- 快照：`/tmp/org-v3-budget-optima.1jcZFo/`（临时目录，可能不保留）。PDF SHA-256：BudgetMLAgent `99b711c8f5ef321292eb8bb3da5108fe7946125dffccdaf9643bf300c9b3214b`；Optima `e5fdcfafa4696a5dae14f636a2799e16a5293476830839f2bf052d66597f8021`。主会话另行下载至 `/tmp/org-v3-pilot-acceptance.uJNR6r/`，两篇哈希一致。
- 官方链接采集（返工轮一次）：project page HTML `/tmp/optima-project-page.html`（21862 B）；官方仓库 `https://github.com/thunlp/Optima` 浅克隆 `/tmp/optima-repo-1jcZFo/`，HEAD `4017740390b73f98ae94559ad5c703482f27ffe3`（2024-11-14 20:09:19 +0800）。
- 结论：BudgetMLAgent 的多臂对纯 GPT-4 对照跨模型、对照成本为作者估算；Optima 训练后变体对提示式基线属训练混杂，但同表另有未训练的 MAD（multi）对 CoT／SC（single）候选，同为 Llama 3 8B 提示式。判据未限定成本单位为美元，token 是允许候选，故不以「无金额」单独判负。本包不裁定整票关闭性；已核事实、未知项与冲突并列如下，评判留给主会话。
- 主会话验收校正：原表数字和列均值已独立复算；两代理设置、token 单位措辞、SC 汇总分支与比值舍入按原文／代码修正。此处记录原文提取，不宣称原论文实验已复现；关闭结论以所属票为准。

## 主张 B1：BudgetMLAgent 的双数字对照

**主张与用途**：原报告 §2.4 行（`benchmarks-and-cost-accounting.md:204`）引用「32.95% 对 GPT-4 单代理」「$0.054 对 $0.931，94.2% 降幅」；用于核关闭判据第 2 条（[02 号票](../../issues/02-research-benchmarks-with-cost.md) 关闭判据第 2 条）。

**来源定位**：[arXiv:2411.07464v2](https://arxiv.org/abs/2411.07464v2)，PDF 页眉日期 2025-01-08（v1 为 2024-11-12），AIMLSystems 2024，DOI 10.1145/3703412.3703416；摘要、§4.1.2、§4.2、§4.3、§4.4.2、§4.4.3、Table 2（PDF 第 6 页）；脚注 4（`gpt-4-0125-preview`）、脚注 5（价格截点 2024-03）。快照同上。

**实读层级**：全文，PDF 与 ar5iv HTML 双读；Table 2 用 `pdftotext -layout` 与 bbox 坐标复核单元格。

**证据结论**：支持「同任务集存在分数＋成本双数字」，不支持「同模型」。

- 同集 [作者报告]：两臂同为 MLAgentBench 的 11 任务子集（cifar10、imdb、ogbn-arxiv、house-price、spaceship-titanic、parkinsons-disease、feedback、llama-inference、vectorization、CLRS、babylm）；剔除 fathomnet、identify-contrails（数据体量）与 LLM Tools（无可比结果）。
- 跨模型 [作者报告]：多臂 Ge+G＝Gemini-Pro 1.0 基础 + GPT-4（cascade 与 ask-the-expert）；对照 G＝纯 GPT-4 单代理，数字引自 Huang et al.。两臂模型不同，判据第 2 条的同模型条件不成立。
- 头条数字 [作者报告]：摘要与 §4.4.3 给出 32.95%（$0.054）对 22.72%（$0.931）；Table 2 Average 行 Ge+G 为 32.95%/$0.054（no-cost）/ $0.120（low-cost），G 为 22.72%/$0.931。
- 成本为估算 [作者报告]：正文原句为 Huang et al. 未提供 GPT-4/Claude 精确成本，作者用 Gemini-Pro 与 CodeLlama 单代理的平均 token 用量乘系数 0.809 近似；成本公式只含 input 与 output 两类 token，无缓存分量；Claude 用 Claude-Instant 价目替代（原版下线）。
- 降幅复算 [独立复算]：94.2%＝(0.931−0.054)/0.931；87.1%＝(0.931−0.120)/0.931；96.43%、63.85%、41.3% 亦可用 Table 2 Average 相应单元格复算一致。
- Table 2 均值不符 [独立复算]：对 11 个印刷单元格求列均值，C 列为 212/11=19.27（印刷 20），Ge+Ch 列为 262.5/11=23.86（印刷 22.72），两处明确不符；其余八列可复算。cost 序列 Ge+G low-cost 印刷 $0.120、按单元格复算 $0.114（差 $0.006）；Ge+Ch low-cost 印刷 $0.032、复算 $0.035（差 $0.003）。原表行不能整体照搬。
- 运行次数 [未核验]：作者自身每次任务运行次数未直述；正文仅对 Huang et al. 写「8 runs per task for 15+ tasks」。作者列成功率均为 12.5% 的整数倍，与运行次数为 8 的倍数相容，但不足以定值 [项目推断]。

**量化附项**（Table 2 两臂）：

| 项 | 多臂 Ge+G | 对照 G（单代理） | 来源 |
|---|---|---|---|
| 模型 | Gemini-Pro 1.0 + GPT-4（cascade + expert） | 纯 GPT-4（Huang et al.） | §4.3、Table 2 |
| 平均成功率 | 32.95% | 22.72% | Table 2 Average |
| 平均成本/run | $0.054（no-cost）；$0.120（low-cost） | $0.931（估算） | Table 2 Average、摘要 |
| 任务分片 | 11 任务 MLAgentBench 子集（同上） | 同集 | §2、Table 2 行 |
| 预算/上限 | 30 actions；GPT-4 调用（含 cascade）≤5；重试 Gemini/ChatGPT/GPT-4 为 3/3/1；temperature 0.2（规划）与 0.01（动作） | 论文仅称沿用 Huang et al.，未复述其预算与设置；未在本包独立核验，逐项未知 [未核验] | §4.2 |
| 计量与分母 | 美元/run/任务，任务内平均；成功率＝成功 run 占比，作者 run 数未知 | 同 | §4.1、Table 2 |

**作者与项目边界**：数字为作者报告；$0.931 为作者估算而非账单；均值与成本序列复算为本件独立算术检查；未联系作者、未复现实验、未取得原始运行账。

## 主张 O1：训练后 Optima 对提示式基线的双数字对照

**主张与用途**：原报告 §2.4 与 §3.5 的 Optima 行引用「up to 2.8×」「<10% tokens」；用于核关闭判据第 2 条。

**来源定位**：[arXiv:2410.08115v2](https://arxiv.org/abs/2410.08115v2)，版本日期 2025-02-18（v1 为 2024-10-10），abs 页标注 Under review；摘要、§3 数据集与 Table 1（PDF 第 6 页）、Training Setups、附录 F（Llama 3.2 3B）。快照同上。

**实读层级**：全文，PDF 与 HTML 双读，重点核 Table 1 单元格、训练段落与成本词面。

**证据结论**：同任务集、同基础模型名成立（论文自称）；双数字为「分数＋#Tok（token）」。判据未限定成本单位为美元，token 是票中允许的成本候选，因此「无美元金额」不构成否定项；本包把「指标单位与分母未核清」与「不存在成本数字」分开记录。

- 模型 [作者报告]：实验节声明 base model 为 Llama 3 8B / 3.2 3B（附录 F 用 3.2 3B）；训练后变体（iSFT／iDPO／iSFT-DPO）逐任务迭代训练，8×A100，多数任务 ≤12 小时、MATH 约 24 小时；提示式基线为 CoT、SC(n=8)、MAD、AutoForm，0-shot。训练后变体含训练、提示式基线不含，推理 token 对照不覆盖训练算力；逐方法 checkpoint 未在正文列出 [未核验]。
- 任务集 [作者报告]：IE（HotpotQA、2WMHQA、TriviaQA、CBT）与 debate（GSM8K、MATH、ARC-C、MMLU），Table 1 同行并列。测试样本数与分片未在正文给出 → 未知；官方仓库代码默认 split 见「官方代码核对」节，仅作代码默认值。
- 双数字示例 [作者报告]（Table 1，2WMHQA）：iSFT-DPO 74.2 F1／54.9 #Tok；MAD 25.9／543.7；SC(n=8) 28.7／1052.8；CoT 20.5／139.8。
- 正文与表格冲突 [并列，不裁定]：§3.1 正文写「iSFT-DPO improves F1 by 38.3% (2.8x) while using only 10% of MAD's tokens」；Table 1 同对差值 74.2−25.9=48.3 F1 点、比值约 2.865×、token 份额 54.9/543.7=10.10%。38.3% 既不是该表差值，也不是该比值对应的相对增幅；约 10% 可作舍入描述，该对并非严格小于 10%。iSFT 行 72.4/25.9=2.80× 与「2.8x」数值相近但正文点名 iSFT-DPO。本包不代作者选择更正值。
- 无美元金额 [事实记录，非否定项]：已读范围（Table 1、Figure 1/3、附录 H/I、全文检索 price/pricing/dollar/$ 无命中）未见美元、价格表或账单；成本维度为推理 token。
- #Tok 口径 [部分核到，整体未核验]：Table 1 称 inference token number，Figure 1 称 average inference token；单位是 token，已读材料没有千 token 标记。官方仓库代码按实例汇总对话 token（见下节），但该代码是否用于 v2 表格、prompt 与重试是否全计、有效样本分母均未核清。表内 SC(n=8) 的 #Tok 约为 CoT 的 8 倍，与「逐实例合并全部采样」口径相容 [项目推断]。

**量化附项**（Table 1，2WMHQA 行）：

| 项 | Optima iSFT-DPO | MAD | SC(n=8) | CoT |
|---|---:|---:|---:|---:|
| F1 | 74.2 | 25.9 | 28.7 | 20.5 |
| #Tok | 54.9 | 543.7 | 1052.8 | 139.8 |
| #Tok 对 iSFT-DPO 的倍数 [独立复算] | 1× | 9.9× | 19.2× | 2.5× |

基础模型 [作者报告]：Llama 3 8B（实验节声明；附录 F 用 3.2 3B）。任务 2WMHQA；0-shot。训练预算 [作者报告]：8×A100，多数任务 ≤12 小时、MATH 约 24 小时，未计入 token 对照。未核字段：测试分片与样本数；逐方法 checkpoint；#Tok 是否仅含生成；平均分母（仅代码默认口径见下节，未证 v2 实跑）；统计不确定性。

**作者与项目边界**：数字为作者报告；比值与差值复算为独立算术检查；训练后变体对提示式基线非同推理配置；未复现、未审计。

## 主张 O2：MAD 对 CoT／SC 的候选对照（未训练、同表）

**主张与用途**：Table 1 同表内 MAD（multi）与 CoT、SC(n=8)（single）并列，且均为提示式；用于判据第 2 条「任一 multi-vs-single 双数字」候选，不限于训练后 Optima 对基线。

**证据结论**：同任务列、同表、双数字成立；base model 同为 Llama 3 8B（论文实验节统一声明）；信息与预算对等条件未核清，保留未知；本包不判该对是否满足第 2 条。

- 数字 [作者报告]（Table 1；F1 或 Acc／#Tok）：
  - 2WMHQA：MAD 25.9／543.7；CoT 20.5／139.8；SC(n=8) 28.7／1052.8。
  - ARC-C：MAD 71.4／478.0；CoT 65.2／138.9；SC(n=8) 75.6／1116.7。
  - GSM8K：MAD 72.5／514.7；CoT 71.5／230.9；SC(n=8) 80.3／1828.7。
- 条件 [作者报告/未核验]：0-shot；MAD 采用自然语言辩论，§3 说明两代理、无外部工具，debate 为 solver/critic；轮次与 turn limit 未给限值，MAD 对 SC(n=8) 的预算对等未声明。IE 中上下文被拆分，两臂信息条件仍需核清，不能把其差值直接解释为协调收益。逐基线 checkpoint 未列出。
- 附录交叉核对 [主会话回读]：Table 7 明标「MAD(2-agent)」，2WMHQA 的 25.9／543.7 与 Table 1 相同；结合正文两代理设置，可识别代理数，不再列为未知。返工件曾漏用这项已有证据。

## 官方代码核对（返工轮一次，2026-10-13）

- 入口：arXiv abs 页外链 project page `https://chenweize1998.github.io/optima-project-page`，页面再外链官方仓库 `https://github.com/thunlp/Optima`；本轮只读 #Tok 口径与 split 相关文件。
- 仓库 HEAD `4017740390b73f98ae94559ad5c703482f27ffe3`（2024-11-14），早于 v2 论文（2025-02-18）。以下均为该 commit 的代码默认值，不证明 v2 论文实际运行配置 [未核验]。
- `dataloader/dataloader.py:24-43` split_map 与 `inference_script.py:45-66`：mwh_qa→dev、gsm8k→test、arc→test、mmlu→test、hotpot_qa→validation、trival_qa→validation、cbt→test、math→test；样本数不在此仓库（数据集文件未随附）。`inference_script.py:106-107` 传 `sample_count=1000, explore_count=1`，本轮未追踪其确切语义 [未核验]。
- `utils/utils_token.py:4-9` `cal_token`：对会话逐条消息做 `len(tokenizer.tokenize(sentence))` 求和；`inference_script.py:104-105` 两次传入同一 tokenizer 路径。
- `train/monte_carlo_deploy.py:434-436`：`conversation = [speech["content"] for ...][1:]`（丢弃首个元素）后计算并写入 `token_count`。
- `reward/reward.py:492-597` `result_stats`：普通分支先对每条记录的 runs 求均值，SC 分支 `is_consistence=True` 求和，再对记录求均值；`tmp_count += 1`（:522）在跳过 "large"/"error" 结果之前计数，普通分支分母仍含这些 run。此处是代码事实，不代表表格存在已证实的相同偏差。
- 未核验：v2 表格是否用该代码和数据记录；是否只计生成 token（函数计入保留消息的全部文本，不等于完整 API 输入／输出计费量）。

## 原关闭项覆盖表

| 原关闭项 | 本包对象 | 证据状态 | 结论 |
|---|---|---|---|
| 判据第 2 条：已发表 multi vs single 双数字（同集同模型） | BudgetMLAgent | 同集成立；该对照跨模型（Gemini+GPT-4 对纯 GPT-4）；成本为作者估算，Table 2 两处列均值不符 | 该对照同模型不成立（事实陈述） |
| 判据第 2 条（同上） | Optima 训练后变体对提示式基线 | 同基础模型名；对照为训练后对提示式，非同一推理配置；双数字为分数＋token（token 属允许候选） | 训练混杂；不单独据此判负 |
| 判据第 2 条（同上） | Optima MAD 对 CoT／SC | 同表同列、提示式、base model 同为 Llama 3 8B（论文自称）；MAD 两代理；双数字成立；轮次／turn limit／样本数与完整 #Tok 口径未知 | 原表可作带限制的描述性引用；完整关闭检查留所属票 |
| 报告 §2.4 两行引用强度 | 两篇 | 印刷数字属实，须附跨模型／估算／token 口径／正文与表格冲突（38.3% 对 48.3 点）限制 | 引用须收窄 |
| 整票关闭 | 02 号票 | 本包不裁定可关闭性；未知项见「剩余缺口」 | 评判留给主会话 |

## 剩余缺口

- Optima 未核验项：#Tok 是否仅生成或含 prompt、重试等完整成本；测试分片与样本数；逐方法 checkpoint；MAD 轮次／turn limit 与 SC(n=8) 的预算对等；IE 信息切分一致性；统计不确定性。已核字段：推理 token、MAD 两代理、同表质量与 token 数。无美元金额不作为否定项；官方代码默认值不代替实跑配置。
- BudgetMLAgent 未核验项：作者自身 runs/task；原始运行账；Table 2 均值不符的作者说明；未联系作者。GPT-4 对照的预算与设置：论文仅称沿用 Huang et al.，未在本包独立核验。
- 两篇均未复现实验、未审计账单；未访问 DSH、未安装依赖；工作树其他文件未改动。
- 记录：模型 `opencode-go/deepseek-v4.1-flash`、effort max；session_id 与 token 用量未知。首版被拒收，返工 1 次，原因是擅自以「无金额」否定 O1 且漏核 MAD 对 CoT／SC。19:47 发返工，修订件标记 19:52；主会话随后继续回读并校正残余字段。时间为工作记录，不是独立性能测量，无同任务本地基线，不计算净节省。
