# 成本乘数与单代理基线：三源有界补核

- **采集性质／快照语义**：仅核原清单的 Kim、Tran & Kiela、OneFlow 五项主张；作者报告与独立算术复算分开，无实验复现。
- **所属票**：[组织形态谱系、动态架构（相变）与成本经济](https://github.com/Beijongggg/dsh-bots/issues/4)；基线 `85c0894119d8ea511609395e78910d382a309b99`。
- **来源缓存根**：`/tmp/org-v3-baselines-20261015-ad4da07c/`，下表文件名均相对此绝对路径；PDF 与派生文本保留原字节。
- **核验记录根**：`/tmp/org-v3-baselines-accept-20261015.36jKxQ/`；`recompute.py` 与 `recomputed.json` 保存主会话复算。
- **时间边界**：来源提取发生于 2026-10-15；逐请求采集时刻未记录。采集方 `09:41:03Z` 为下载后哈希核验时刻，不作请求时间。
  主会话原文／哈希复核时间锚为 `2026-10-15T09:57:02Z`，随后另取版本元数据；这些时间不代表实验运行时间。

## 来源与实读范围

| ID | 一手来源与身份 | 版本／日期 | 缓存／真实页数／SHA-256 | 实读范围 |
|---|---|---|---|---|
| K1/K2 | [Towards a Science of Scaling Agent Systems](https://arxiv.org/abs/2512.08296v3)，Yubin Kim 等 20 作者 | v3；首发 2025-12-09，更新 2026-04-08 | `k1-kim-scaling-v3.pdf`，44 页；`028f329010d95143915db8db6ce1ad26a4e844b66e4abd6b36fdb39651aff7fd` | 元数据、正文指定段、Tables 4/5/14/15；未全核配置与 CI |
| E1 | [Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets](https://arxiv.org/abs/2604.02460v2)，Dat Tran、Douwe Kiela | v2；首发 2026-04-02，更新 2026-04-11 | `e1-tran-kiela-v2.pdf`，27 页；`75753e5c9cbbd0f35a805d7aa998c3712525ee72d64d6c64da3ba5dcf288e993` | 正文指定段、Tables 1/3/5/13；附录 F/G 未全核 |
| O1/O2 | [Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline](https://arxiv.org/abs/2601.12307v1)，Jiawei Xu 等 11 作者 | v1；2026-01-18 | `o1-xu-oneflow-v1.pdf`，22 页；`2db56bb8470509962591f3a2fd077e074de5108b812d229f9b7f727eba1bbf23` | §4.1、§4.2、Tables 1–4/7/10；优化 prompt 未全核 |

元数据由主会话 `opencli arxiv paper <版本ID> -f json` 回核，PDF 首页版本水印／作者与其一致；缓存于核验记录根：
- `k1-metadata.json`：`7f29a681074a085d3a999b561b319b978ff7b441088a7548b4d4f3dfa51af58f`。
- `e1-metadata.json`：`039b876faf9dbd18df5cba3bbbbe8dad45dc5d63a52c9048848fe7f3ab8d1d1c`。
- `o1-metadata.json`：`bd7686a5829b265b1dac8c3438c05b68dc66b03774dbecce7fc55be831d45cd1`。
- Kim HTML `k1-kim-scaling-v3.html`：`e19cfd16776f06ca693fc99e1ad4ef30335c5e063a3025acd0b62c8e8c09a39e`，仅辅助身份／文字定位。
三份 `.txt` 为同名 PDF 的 `pdftotext -layout` 派生件；关键表格另回读 PDF 页图。下载 URL 为各版本的 `https://arxiv.org/pdf/<版本ID>`。

## K1：开销百分比是回合数比值，不是独立 token 账

- **原文定位**：Kim §4.1，PDF p.13；Table 5，p.20；§4.4，pp.20–21。读取层级＝上述原文／页图。
  公式 `O=(T_MAS−T_SAS)/T_SAS×100%`；`T` 是 reasoning turns。表列 260 配置、六基准、五架构、三模型族。
- **两臂／单位／复算**：Table 5 的 SAS 7.2 回合为共同分母：

| 架构 | 原回合数 | 原 O% | 从已舍入回合数复算 |
|---|---:|---:|---:|
| Independent | 11.4 | 58 | `(11.4/7.2−1)×100=58.3333%` |
| Decentralized | 26.1 | 263 | `262.5%` |
| Centralized | 27.7 | 285 | `284.7222%` |
| Hybrid | 44.3 | 515 | `515.2778%` |

- **结论＝支持回合开销，限制 token 解释**：作者 §4.3 同时称其“representing 1.6–6.2× token budgets … at matched performance”；
  Table 5 又称“matched for total reasoning tokens (mean μ=4,800 per trial)”。本包未取得逐 run token 账来调和这两种说法。
  4,800 是作者声明的匹配口径，O% 是回合度量；不能把后者升级为独立实测 token 倍数或等质量账单。
- **作者边界**：前四基准各 9 模型×5 架构、后两基准正文各 8×5，共 260；Table 16 后两基准还列 Gemini-3-Flash，各有九行。
  本包未对账新增模型行与主实验／额外验证的归属，不据表行数推翻260，也未逐 run 重建配置。Figure 3 仅四基准180配置有完整 cost tracking。

## K2：效率、约 45% 与错误放大是同源条件结果

- **原文定位**：Kim Tables 4/5，p.20；§4.2–§4.4；Tables 14/15，p.43；Limitations。模型／工具／分片按作者实验，不作 Pod 配置。
- **可定位原值**：Table 5 `Success/1K tokens`＝SAS 67.7、Independent 42.4、Decentralized 23.9、Centralized 21.5、Hybrid 13.6。
  `67.7/21.5=3.1488`、`67.7/23.9=2.8326`；只是所报列的比值。原文未在所读范围给出该列完整 token 分母，不能反建实际账。
- **能力／任务差异**：作者给约 45% 单代理准确率边界、Finance Agent `0.631 vs 0.349`（称 +80.8%）、PlanCraft Independent `0.170 vs 0.568`（称 −70%）。
  按舍入单元格复算分别 +80.8023%／−70.0704%；都是相对比例，不是百分点。`R²_CV=0.373`，属于已知任务域拟合／预测，不是普遍定律。
- **统计口径纠正**：Table 4 `baseline_x_agents` 的 β=−0.236、naive p=0.004；Table 14 其 robust p=0.105，Table 15 Holm p=0.084。
  robust p=0.004／Holm p=0.018 属 `single_agent_baseline`，不能串到 β=−0.236 上。作者结论仍把“能力饱和”概括为较稳健结果。
- **工具交互不同**：`overhead_x_tools` 六基准 naive p=0.211；`efficiency_x_tools` naive p=0.002、robust p=0.205、Holm p=0.026。
  “六基准失去显著性”须点名哪条交互／哪种推断，不能一概归到所有工具效应。
- **错误放大**：Table 5 trace-level＝Independent 17.2、Centralized 4.4、Decentralized 7.8、Hybrid 5.1（SAS=1）。
  主效应控制后 β̂=0.014、p=0.658；与工具数交互 p=0.332；task-level 约 1.1–1.3。**支持描述关联，不支持因果必然性或权威复核层的充分证明**。
- **结论＝限定采纳**：数字可定位；“扁平是全部已发表形态中最差”“45% 可直接作 Pod 阈值”“17.2× 证明必须加某层”均超出这份证据。

## E1：同请求思考预算下有单代理强基线，实际花费并不相等

- **原文定位**：Tran & Kiela §4.2–§4.3，pp.5–6；Table 1，p.7；§5.3，pp.8–9；Tables 3/5/13，pp.21/22/27。
- **配置**：FRAMES、MuSiQue 4-hop；Qwen3-30B-A3B、DeepSeek-R1-Distill-Llama-70B、Gemini-2.5-Flash/Pro；
  SAS／SAS-L 与 Sequential、Subtask-parallel、Parallel-roles、Debate、Ensemble。思考 token 不含输入与最终答案，非全成本。
- **原表与复算**：Table 1 请求 B=1,000 的八模型×任务格均值：SAS .418、SAS-L .397、最强 MAS Debate .388。
  SAS−Debate＝3.0pp，SAS-L−Debate＝0.9pp；并非逐格都胜，也不是本包重新作显著性检验。
- **预算限制**：B 是请求上限／分配，不是相同实际消耗。Table 3 同请求 B=1,000、FRAMES/Qwen3：SAS 800、SAS-L 935、Debate 1,000 实际思考 token；
  Table 5 FRAMES/DeepSeek：SAS 550、SAS-L 567、Debate 1,000。不能写成同实际 token 或同美元；完整费用未核，未知不补零。
- **DPI 条件**：§3.1 只保证 `I(Y;C)≥I(Y;Mα)`，不保证退化上下文 `C̃α` 的同一不等式；信息量也不直接证明有限模型的任务成功率。
- **退化对照**：Table 13、Qwen3/MuSiQue、请求 B=1,000，masking α=.7：SAS .220、Seq .231（+1.1pp）；substitution α=.7：.200 vs .225（+2.5pp）。
  删除／干扰词并非同样结果，不外推“只有／恰好上下文退化才有组织收益”。23 Gemini extraction cases 与约 2× entities 属 Table 2 的不同错误桶。
- **结论＝条件支持**：强单代理及其更长思考变体是应保留的对照；此证据不替项目选形，也不验证任务内状态迁移。

## O1：同质工作流可单代理执行；闭源缓存费是理想估算

- **原文定位**：OneFlow §4.1，pp.6–7；Tables 1/2/3，pp.7–8；Table 7，p.16。单位含 UT Austin、Amazon、Emory、Northeastern、Georgia Tech。
- **机制／配置**：同 base model 工作流，多轮共享 KV cache 对比多次无状态调用；主执行 GPT-4o-mini、temperature 0；
  优化器 Claude-4.0-Sonnet、20 轮，另测 Claude-3.5-Haiku 与 Qwen-3 8B。同质限制不能扩成全部组织均可无损替代。
- **费用读取层级**：§4.1 明写“we simulate ideal KV-cache costs”；GPT-4o-mini 单代理执行按最终消息列表估算理论输入／输出费，非实际 API 缓存账单。
  Table 2＝三 runs mean±std USD inference；20 轮设计／筛选／失败总账未提供，价格日期及完整单价未在所读范围固定。
- **效果不能只读摘要**：AFlow HotpotQA Table 2 `$1.438→$0.530`（估算降 63.1433%），但 Table 1 F1 `72.1→68.4`（−3.7pp）；
  HumanEval `$0.198→$0.198` 持平。同工作流各任务不都保质或省费，不以头条代替原表。
- **异质／Shopping**：Table 3 DROP 异质 AFlow `85.5±.5`、同质 Haiku OneFlow `87.5±0.0`；仅此自动设计 pilot。
  Table 7 Product `.638→.678`、Sentiment `.752→.777`、Multilingual `.521→.569`＝+4.0/+2.5/+4.8pp，不是相对百分比；9/10 最优可定位。
- **计数冲突**：摘要称 seven benchmarks；§4.1 枚举六公共基准＋Shopping-MMLU＋TravelPlanner，共八名称。并列保留，不擅改作者摘要。
- **结论＝限定支持**：同质工作流的单代理执行是强对照候选，缓存理想成本、搜索费用与质量取舍须显式说明。

## O2：输入累积与真实执行性能不是同一成本量

- **原文定位**：OneFlow Table 4、§4.2.4，p.9；HumanEval/Qwen-3 8B、vLLM、context 16k，三独立 runs。
- **原表复算**：AFlow input `2302→3269`＝+967；OneFlow `920→1288`＝+368；均为平均输入 token，不是省费百分比。
- **实际性能**：AFlow latency `54.98→53.53s`、throughput `.17→.18 samples/s`；OneFlow `4.31→4.83s`（+12.065%）、`2.47→1.70 samples/s`（−31.174%）。
  pass@1 分别 `86.8→90.5%`、`87.0→87.4%`。作者称效率 stable；本包只接受表格值，不据此承诺每模型／任务加速。
- **结论＝支持原增量与有界限制**：开源 vLLM 测量和闭源理想美元估算分开，输入、输出、延迟、吞吐各保留单位与对象。

## 原关闭项覆盖与剩余缺口

| 原关闭项 | 本包验收结果／边界 |
|---|---|
| 来源与核心盲区（S1/S4） | 三源身份／上述定位已核；页数、预算和显著性串引已纠正。其余来源仍未验，不据局部包关票 |
| 十形态三栏 | 单代理优先的指定来源、supervisor／flat 的 Kim 开销得到有界补核；CAMEL／稀疏辩论及其他形态不因此通过 |
| 可复算成本与强基线 | 回合 O%、所报效率列比值、请求预算、OneFlow 费／分数取舍及输入增量可复算；实际完整 token／美元／优化账仍缺 |
| S2 动态／固定与拒判回退 | 沿原判定，不新增状态迁移、陌生任务拒判或净收益校准实证；本包不替 HITL 选策略 |
| 不可能三角及其余反证 | 未重查；保留原有界结果。研究票其余核心缺口仍触及 S4 |

未核：逐 run token／价格账、Kim `Success/1K tokens` 完整分母及 Table 16 新增模型行归属、三源全部 CI／prompt／代码与跨源独立复现。
报告 §2.8 原 OneFlow“54% fewer tokens”在本包所读范围未定位，退出已核正面主张，不变成全领域否定。

## 委派与验收记录

- 采集方一个隔离子代理，直接调用 research；公开资料 GET，工具 opencli／curl／pdftotext，无论文执行、安装、DSH 或真实运行面写入。
- 采集声明模型 `opencode-go/deepseek-v4.1-flash` 来自子代理系统提示，未独立核验实际路由；不沿历史包认定。数值 session_id／账单 token／主动工时未知。
- 工具宿主计首轮历时 `1,446,171ms`（24分6.171秒），55 次工具调用；超过20分钟停止点，采集方说明串行往返累积且未及时计时。
  元信息澄清续轮 `40,009ms`，零工具调用；不是新采集。超时不以完成五项抵销，也不报告净节省。
- 主会话回读指定原段及 PDF 页图、复核四份来源 SHA、另存三份版本元数据并独立复算；不接受采集稿的页数、统一采集时刻、显著性串引与“全部支持”措辞。
  无重新派发采集包；一次元信息澄清及主会话语义纠正，不记零返修。整票关闭以原判据为准。
