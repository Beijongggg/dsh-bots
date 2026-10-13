# Optima 实际配置与统计口径补核（02 号票续派）

- 基线 `a8967ce118c9becfad132159ae50f9a86ba11397`；采集 2026-10-13（+08:00），约20:35续派、20:50交回，复用既有缓存。主会话接管后校正了采集时间、回复中的答案标记计数与论文/代码的证据边界。
- 范围：只补 ①逐方法 checkpoint、②样本分母、③token 构成、④公开代码对应关系。F1/#Tok 表内数字与比值已在[同集同模型双数字包](02-same-model-dual-metrics-20261013.md)，本件不重抄；不裁定整票关闭性，评判留给主会话（[02 号票](../../issues/02-research-benchmarks-with-cost.md)）。
- 边界：只读回读论文缓存与官方仓库；未跑实验、未装依赖、未访问 DSH、未改票面/地图/其他研究件、未提交 Git。
- 记号：「[作者报告]」论文自述；「[代码默认]」HEAD 代码字面默认值，**不证明**论文实跑；「[并列]」论文与代码不一致，保留两侧；「[未知]」现有材料未给。

## ① 逐方法 checkpoint

- 论文未写明 Table 1 各行数字取自哪一轮 checkpoint [未知]。可核到的是迭代起点规则与轮数：
  - H.3：iSFT 在 IE 任务每轮从上一轮模型开始；debate 任务每轮从初始 Llama 3 8B 开始（训练集小，防过拟合）。iDPO 循 iterative RPO 从上一轮继续。
  - H.3：iSFT-DPO 的 SFT 起点规则同上方 iSFT；DPO 阶段从上一 SFT 模型（初始或上轮产物）继续。
  - H.4：每任务训练六轮（"six iterations"）；Table 8 只给 iSFT/iDPO/iSFT-DPO 的 LR、epoch、batch、λtoken、λloss、β、α、θ 阈值，**不含**轮次对应的 checkpoint 选择，也不含样本数。
- 因此引用 Table 1 时，checkpoint 轮次只能注「论文未注明」；下列代码默认值仅作旁证 [代码默认]：
  - `train/sft.py` `sft_train_v2`：每轮产出 `checkpoints/<x>/iteration_{i}`（i 从 0）；数据采集始终用当前 `model_path`（首轮=初始模型，此后链式取上轮产物，与 `from_initial` 无关）；训练起点由 `from_initial` 决定（True=初始模型，False=`iteration_{i-1}`）。
  - `train/dpo.py` `dpo_train_v2`：每轮产出 `dpo_iteration_{i}`；训练起点 `from_initial=True` 用初始、False 用上轮 `dpo_iteration`；每轮先跑 100 条抽样取 85 分位 token 作 MCTS `max_token`。
  - `train/sft_dpo.py`：每轮先 `sft_iteration_{i}` 再 `dpo_iteration_{i}`；DPO 起点固定为当轮 SFT 产物；SFT 起点由 `from_initial` 决定；上一轮结束后的 `model_path`=`dpo_iteration_{i}`（即下轮数据采集模型）；100 条取 80 分位。
  - 评测入口 `inference_script.py` 对 `--model_root_path` 下每个子目录逐一代评（`os.listdir`），README 示例传 `./checkpoints/arc_sft`、SC 示例传 `.../iteration_0`；示例不等于论文实评轮次。
- 未训练的 CoT/SC/MAD/AutoForm：论文 §3「Training Setups」统一声明 base model 为 Llama 3 8B / 3.2 3B，「A single model is trained for both agents」（指 OPTIMA 两代理同权重）[作者报告]；baselines 未单列各自权重快照、采样参数或推理框架 → **同模型名声明成立；逐 baseline 权重快照与解码参数未给 [未知]**。缺作者 seed/逐 run 日志只限制复现强度，不推翻论文报告。
- [主会话回读] 附录 F/Table 6 题注明写 base model 为 Llama 3.2 3B。ARC-C 的 CoT 为 `51.5 / 256.1 #Tok`，SC(n=8) 为 `57.6 / 2068.6`，MAD 为 `37.4 / 872.4`；GSM8K 的 CoT 为 `78.7 / 288.9`，MAD 为 `81.2 / 763.8`。这些是同集同模型的论文声明层对照，不含 Optima 训练后权重；仍没有逐 arm 快照及样本数，不能声称 C1–C9 全部控制已核。训练轮次缺失不适用于未训练的基线臂。

## ② 样本分母

- 论文未给各任务测试 split、样本数与失败样本处理 [未知]；只给聚合规则：SC n=8；IE 采用「两两 F1 ≥0.9 分组、对最大组报告均分」[作者报告]，与代码聚类实现相容。
- [代码默认] 主评测 `inference_script.py`：`sample_count=1000, explore_count=1, temperature=0`；split：hotpot/mwh/trival 取 validation/dev，cbt/gsm8k/math/arc/mmlu 取 test（`dataloader.py` `split_map` 同）。
- [代码默认] 全量覆盖 `train/datagenerate.py`：非 `qa`/`mix` 且 `split=="test"` 时 `sample_count=dataloader.total`。故 math/gsm8k/arc/mmlu 在 test 下=整个 split；IE 四任务 data_type 为 `qa`，不受覆盖，按 1000 次抽样；`sample_once` 环形推进（触底归零），split 不足 1000 时重复抽样。数据集文件不随仓库分发，各 split `total` [未知]。
- [代码默认] SC 链：`multi_sc_data_generate_script.py` 传 `sample_count=1000, explore_count=50`（每题 50 条独立对话），temperature 取参数（默认 0.5）；`multi_sc_analysis_main.py --max_rounds` → `analysis/analysis.py` `multi_sc_analysis` 逐 n 对每题 `results[:i+1]` 截断统计，n 由调用方给出；README 未文档化该分析命令。
- [代码默认] 统计入口 `reward/reward.py` `result_stats`（`stats_main.py` 调用）：每题 `count+=1`；`tmp_count` 先计数、后跳过含 "large"/"error" 的 run → 普通分支分母含被跳过 run、分子不含；SC 分支（`is_consistence=True`）对 run 求和，普通分支取均值；两者最后对任务平均；math 类型在计入第一个未被跳过的 run 后即 break。SC 调用点在 `analysis.py`：acc 取 best-division 文件（普通分支），#Tok 取原始文件（求和分支）。
- 以上均为代码默认值；论文 Table 1 的实际分母口径是否同此 [未知]。

## ③ token 构成

- [代码默认] `utils/utils_token.py` `cal_token`：逐条消息 `len(tokenizer.tokenize(sentence))` 相加，两 tokenizer 按奇偶交替。
- [代码默认] 调用处 `train/datagenerate.py`：`token_count=cal_token(response_list, ...)`，`response_list` 只含两代理**回复文本**，可能含代码补写的 "Name:" 前缀。回复里的 `<A>...</A>` 标记也参与 tokenize；独立注入的系统提示、题面、上下文没有作为输入再次累计，若回复复述其文字则仍计入。无 input/output/cache 分量，非 API 账单口径。论文 H.3 排除 prompt 的表述针对训练 loss，不能用它单独证明 Table 1 的 token 核算规则。
- [代码默认] 单条回复 tokenize 后 ≥2000 时记 `"large"` 并终止该对话；`conversation()` 终止条件为两代理先后给出同一非空答案，或到 `max_round=10`（论文只说 "reach a turn limit"，限值未写 [未知]）；`agent/agent.py` 请求 `max_tokens=2000`。
- [代码默认] DPO/MCTS 侧 `train/monte_carlo_deploy.py`：`conversation=[speech["content"] ...][1:]`（去掉首条 system）再算 token。
- 论文未写 #Tok 是否含失败重试或 prompt 变体等额外分量 [未知]。

## ④ 公开代码对应关系

- 仓库 HEAD `4017740`（2024-11-14）早于 v2 论文（2025-02-18）：代码快照与论文 rev 非同期，不能把代码默认值合并为实跑配置。
- recipes 与论文对照 [并列，不裁定]：
  - 起点分流一致：H.3 的 IE 链式/debate 初始，对应 `sft_recipes`、`sft_dpo_recipes` 的 `from_initial`（IE=False、debate=True）；`dpo_recipes` 全 False 与 H.3 一致。
  - 迭代次数冲突：H.4 说每任务六轮；`sft_recipes` 全 6 轮，`dpo_recipes` 5 轮（arc 2），`sft_dpo_recipes` 3 轮（arc 2）。
  - prompt pool：H.3 说 GSM8K/MATH 首轮不用 pool；`train/sft.py` 中对应开关被注释（`# no_use_prompt_pool =True`），字面默认仍会用 pool（温度仍按 `is_math` 分支为 0.7）。
  - 底座写法：recipes `initial_model_path`=`.../Meta-Llama-3-8B-Instruct`（指令变体路径），论文写 Llama 3 8B（Meta 2024）。
  - 入口：`sft_script.py`/`dpo_script.py`/`sft_dpo_script.py` 读 recipe 调 v2 训练函数；`scrips/*` 为旧变体（无 `--vllm_env`，`inference_all.py` 线程默认 1024）。
- 权重发布：project page 外链仅 arXiv abs/pdf、官方仓库、supplementary PDF，无 HuggingFace/checkpoint 链接；仓库无权重说明 → 未核得公开 checkpoint [记录]；「同权重快照」只能在论文声明层面认定。
- 图表旁证：Figure 5 以 "Base Model (prompted with being concise)" 对比 iSFT iteration 0/2/4 的 2WMHQA 通信演化 [作者报告]；Table 7 对照行标 "MAD(2-agent)"。

## ⑤ 剩余缺口

- 论文未给：Table 1 所用 checkpoint 轮次；各任务测试样本数/split；失败样本处理；SC 采样温度；turn limit 值；seed/逐 run 日志（仅限制复现强度）。
- 未证：v2 表格由该 HEAD 代码与数据产出；SC #Tok 求和口径与论文数字对应；IE 1000 次抽样与论文分母一致。
- 已核到可引用层面：同集同表双数字（前包）；baselines 与 OPTIMA 共用 base model 名的论文声明；IE 聚合 ε=0.9 最大组规则的论文原文与代码实现对应。

## 原关闭项覆盖表

| 原关闭项 | 本包支持的范围 | 保留缺口 |
|---|---|---|
| 同集同模型 multi-vs-single 双数字 | 未训练 MAD/CoT/SC 的作者公布值；Table 6 明示同为 Llama 3.2 3B | 精确样本数、逐臂推理配置和代码到论文运行的绑定未给 |
| 可复算成本与 S3 | 可复算已公布列的比值；官方代码的回复 token 计数可定位 | 不能从该代码推出论文的完整输入、缓存、失败和重试账 |
| 强基线与预算控制 | 单次 CoT、八次单模型采样 SC、两代理 MAD 分开，训练后 Optima 不混入未训练对照 | 非等预算对照；未证明多代理收益独立于采样和提示差异 |
| 套件四栏、非美元代价 | 不在本包 | 沿所属票其他工作包处理 |

## 采集记录

- 一手入口：[论文 v2](https://arxiv.org/abs/2410.08115v2)、[同版 PDF](https://arxiv.org/pdf/2410.08115v2)、[官方仓库固定提交](https://github.com/thunlp/Optima/tree/4017740390b73f98ae94559ad5c703482f27ffe3)。代码读取不等于执行，未知运行配置未补写。
- 论文文本 `/tmp/org-v3-budget-optima.1jcZFo/optima.txt`（arXiv:2410.08115v2）SHA-256 `e1212070e6642de25f5f5e3bba62b419f7c75c7a55735fca125dd32e0236b21b`；PDF `pdf-2410.08115v2.pdf` SHA-256 `e5fdcfafa4696a5dae14f636a2799e16a5293476830839f2bf052d66597f8021`；project page `/tmp/optima-project-page.html` SHA-256 `b097f6c8ea501d6fe736604096ccf2baa6fba6e889366dabdd9617e105dbab70`。
- 仓库 `/tmp/optima-repo-1jcZFo/`（thunlp/Optima）HEAD `4017740390b73f98ae94559ad5c703482f27ffe3`；引用符号与 SHA-256：
  - `train/sft.py` `sft_train_v2` `b34cacb05f02337334b2d97beb8afa800355d7c440cc9ce438a5230c37beb770`；`train/dpo.py` `dpo_train_v2` `4cae3c3fde6b5b620548e498e45224a3607d8f94b8067277106fc71c43fe7b9d`；`train/sft_dpo.py` `0e68935fea5ef6cb0bcd4a07ca4d23bb236940de9205480e25546c6f3e23fa7f`；`train/datagenerate.py` `conversation`/`vllm_data_generate` `ed1038d2dba52035b42887c0a7b65f299570b1f4055086acf68b4ca47f6deaf1`；`train/monte_carlo_deploy.py` `dc4e37842f8ec4402f8120cb83da8ada11762c18f24eb9bc52117b39c607f6fe`。
  - `utils/utils_token.py` `cal_token` `d46000999c5fccdd2c5bd072c8a1bd517e18d706ea5f1852de0cc92c782cc488`；`reward/reward.py` `result_stats` `3c73aca7f4500d3d475f72c677d66d62f3a52536e3cfd200a8db10c7f913b776`；`inference_script.py` `cf75f83a8ab970825cfe74206fe42e2c9da4f07ce5f380b8dca068c5527b7831`；`multi_sc_data_generate_script.py` `c7ffc72dbc1cba885fee03e62c2caba5616483aa76e272153236e3da62129327`；`multi_sc_analysis_main.py` `ab74f4e4da5301816651f338af3660c66356c9d08cf14d16c003bff5b8ef07d1`；`analysis/analysis.py` `multi_sc_analysis`/`get_best_division` `9e3cf93d8b982d914881a479c68bcb50aa3415c5f1791fcec91928abfd430c4f`。
  - `agent/agent.py` `VllmAgent.step` `3662df5a83d22e715f5fd6d21174bb9a63d1da5e3080f327cd6409b891da7872`；`dataloader/dataloader.py` `c905e47847b3c4e4e8adb4ad543b385ed9f8f2af6e675fb1661f96c17176368c`；`stats_main.py` `2b322def49e327da8b09f9b1a5390eb2ab1ad3cff68ee7ea510a9bfb1b2d37dd`；`sft_script.py` `79426e2c0a2c1835af77fbde85e1d034fd52a1c6d9aa599a1ac5a8bcde45b92d`；`train/sft_recipes/math.yaml` `5c3dfe2fdcd49aa1063c78c8ba27b63a05436ed60acf39965dbc58695b9ceea5`；`train/dpo_recipes/arc.yaml` `49d870b68f523429ac249f327799df848fcbfeaf7128cd6dbb34dd64cbcecf52`；`train/sft_dpo_recipes/arc.yaml` `4d69fd216df186fe2e518de80f086c170ce028e339a5eaed014ce1a8c1df18b5`；`README.md` `c8bea1f37006116f964b6e99369de2258708a2f9aa9c5d31454703e5ed840eb1`。
- 执行：模型 `opencode-go/deepseek-v4.1-flash`、effort max；session_id 与 token 用量未知。只读访问上述对象；未复现、未访问 DSH、未改票面/Git/其他研究件。
