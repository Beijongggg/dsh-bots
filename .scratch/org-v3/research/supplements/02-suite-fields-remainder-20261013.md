# 02 带成本公开基准：BrowseComp／SWE-Lancer／TheAgentCompany 三套件四栏补核（补核件）

[带成本的公开基准与成本口径](../../issues/02-research-benchmarks-with-cost.md)「原套件逐项覆盖」第二批。只交一手字段提取与缺口，不裁定口径、不关票；验收与整合由主会话处理。基线 commit `41e59b5`。采集性质：有界一手材料提取（arXiv 全文＋api.github.com 入口），只补派发点名的三套件；同模型不同 effort／配置行不计组织对照；无字段只限已读版本，未读标未核。快照语义：arXiv 取下载时版本（SHA 见来源表）；GitHub 经 api.github.com 按 2026-10-13 访问日的默认分支，非冻结 commit 的以 commit 记，`browsecomp_eval.py` 等单文件以 blob SHA 记。openai.com 系按派发规则未走（前批 403）。缓存目录 `/tmp/org-v3-w2-02-20261013/`（非冻结件）。

## 来源表

| # | 来源 | 层级 | 版本／定位 | 访问（+08:00） | 本地 SHA-256（16 位） |
|---|---|---|---|---|---|
| S1 | BrowseComp 论文 PDF `arxiv.org/pdf/2504.12516` | 一手（全文） | v1，`arXiv:2504.12516v1 [cs.CL] 16 Apr 2025` | 2026-10-13 23:34 | `8de2e7a024b43ff7`（browsecomp-2504.12516.pdf） |
| S2 | `api.github.com/repos/openai/simple-evals/…`（contents／README.md／browsecomp_eval.py／commits） | 一手（仓库快照） | 默认分支 main@`652c89d0ca9df547706735883097e9537d40dc47`（2026-04-22） | 23:35-23:36 | 见 `/tmp/org-v3-w2-02-20261013/{api-simple-evals.json,se-readme.json,bc-eval.json,se-commit.json}` |
| S3 | SWE-Lancer 论文 PDF `arxiv.org/pdf/2502.12115` | 一手（全文） | v4，`arXiv:2502.12115v4 [cs.LG] 29 May 2025` | 23:34 | `5592089e626e52af`（swelancer-2502.12115.pdf） |
| S4 | `api.github.com/repos/openai/SWELancer-Benchmark/…`（contents／tree／README／commits；经 api 绕开 github.com） | 一手（仓库快照） | main@`4afbde31ba075992ffd96209f6533de8e450becd`（2025-07-18）；仓库树仅 `README.md` 173 B | 23:35-23:36 | `/tmp/org-v3-w2-02-20261013/{api-swelancer.json,sl-readme.json,sl-tree.json,sl-commit.json}` |
| S5 | 入口续链 `openai/preparedness`→`openai/frontier-evals` | 一手（仓库快照） | `frontier-evals` main，`project/swelancer` 存在；repo pushed 2026-10-12 | 23:36 | `/tmp/org-v3-w2-02-20261013/{prep.json,prep2.json,prep3.json,fe-project.json}` |
| S6 | TheAgentCompany 论文 PDF `arxiv.org/pdf/2412.14161` | 一手（全文） | v3，`arXiv:2412.14161v3 [cs.CL] 10 Sep 2025` | 23:34 | `9574c7c5d4f1592d`（tac-2412.14161.pdf） |
| S7 | `the-agent-company.com` HTML；`api.github.com/repos/TheAgentCompany/experiments` | 一手（首页外壳）／一手（仓库元数据） | 站点 HTML 903 B、`<title>The Agent Company</title>`，客户端渲染；experiments 仓库 pushed 2026-08-01 | 23:36 | `5bda53b8046d6f99`（tac-site.html）；`tac-exp.json` |

文本定位一律给 `pdftotext -layout` 抽出的行号（`/tmp/org-v3-w2-02-20261013/{browsecomp,swelancer,tac}.txt`），与引用版本对应。

## BrowseComp（S1＋S2）

- ①测什么：持久网页浏览求解「难找、纠缠」事实题；1,266 题，短答案可核验（browsecomp.txt:19、:68）。分数为准确率＋校准误差两列（Table 3，:283-291）；另有 64 trials/题 的通过率分布分析（§4.5，:403-405）与人类对照：367/1,255 解出、888/1,255 放弃，11 题未尝试（Table 2，:218-226）。
- ②分数入口：无官方榜单。论文两处给数据地址 `github.com/openai/simple-evals`（:28、:104）；仓库清单含 `browsecomp_eval.py`（S2）。该文件读官方题集 `openaipublic.blob.core.windows.net/simple-evals/browse_comp_test_set.csv`，grader 模板打 0-100 置信度、判对错，聚合 `accuracy` 与校准（bc-eval.json 行 67-69、:105-143）。simple-evals README 自述 2025-07 起停止更新新模型结果，但仍保留 BrowseComp 参考实现（S2）。已发表分数住在论文 Table 3。
- ③成本字段：v1 全文检索 `cost|dollar|price` 命中 0——已读范围内无美元、无 token 计数。最接近的是算力轴：§4.3「each point is a full evaluation run with a different browsing effort」「Accuracy scales smoothly with respect to … test-time compute」（Fig 1，:328-331）；§4.4 用 64 输出/题做 majority／weighted voting／best-of-N，Fig 4 横轴为「Number of parallel samples per task」1-64（:345-364）。
  - 原文写法 vs 推断：论文只写「browsing effort」「test-time compute」与并行采样数；把采样数当预算轴是我的读取（Fig 4 轴标签），论文未把 effort 换算成 token 或美元（推断标 `[推断]`）。
- ④组织对照读取范围：无 multi-agent vs single-agent 双臂。全文 `multi` 命中均为 multi-hop／multiple sources／parallel samples（:279、:299、:357）；§4.4 的投票策略是同模型多样本聚合，不是组织形态（不算组织对照）。
- 版本与分母：v1、1,266 题；人类 367/1,255（另 11 题未尝试）。复算：367÷1,255=29.24%→论文 29.2%（一致）；Table 3 各行准确率的分母未在表内声明（推定 1,266，未核）。

## SWE-Lancer（S3＋S4＋S5）

- ①测什么：Upwork／Expensify 真实自由职业付费任务。IC SWE（按端到端测试判对错）＋SWE Manager（从多个提案选最优）；指标 pass@1、Dollars Earned／Total、Earn Rate（Table 1，swelancer.txt:345-373）。1,488 题、真实 payout 共 $1,000,000（:17-21、:90-92）。
- ②分数入口：无榜单。官方入口 `github.com/openai/SWELancer-Benchmark`（:37-39），经 api 可达；其 README 现为合并指针：「The SWE-Lancer codebase has been merged into github.com/openai/preparedness」（S4，main@`4afbde31…`，树内仅 README 173 B）。续链：`preparedness` 现重定向 `openai/frontier-evals`，`project/swelancer` 目录存在（S5）。已发表分数住在论文 Table 1（Diamond 与 Full 两组行）。
- ③成本字段：有，§3.6 Price Analysis（:389-441）。实读单元格：5 runs、GPT-4o 与 o1、SWE-Lancer Diamond IC SWE 237 题（值 $236,300）：API 费用 95% CI「GPT-4o was $194.31 ± $17.31，o1's was $1,623.76 ± $56.68」（:436-440）；模型贡献比 $0.10／$0.16 per $1 总支出；人工兜底节省 pass@1 8.84%／13.26%、pass@5 18.6%／33.5%。单位＝USD，分母＝237 题×5 runs（平均值口径）。限制原文自述：API 价含 retries、不含 batch 折扣；Upwork 为历史赏金；pass@5 节省假设快速验证（可超 24h）。
  - 任务价值 vs 实耗成本（严格分开）：$1,000,000 为全量真实 payout（任务价值）；Diamond 值 $500,800=IC $236,300＋Manager $264,500（:346-347）。API 实耗只有上列 $194.31／$1,623.76（237 题一次运行总量）。
  - 原文写法 vs 推断：CI 语句紧接「nontrivial variance in cost across runs」，金额对象＝该 237 题运行的成本（依 §3.6 上下文）；句子本身未复述单位，标 `[推断]`。论文未印每任务 API 美元；我的复算 `[复算]`：194.31÷237≈$0.82/题、1,623.76÷237≈$6.85/题。
- ④组织对照读取范围：无。所有臂为「basic scaffold」单 agent（:230），A5 定死环境：Azure D2as v4、Docker、max 100 tool calls、最长 3h、temperature 1.0（:859-864）。Table 1 行间差异只有模型、o1 effort（low/medium/high）与 user tool 有/无消融——均非组织对照；`multi` 命中为 multi-file／multiple proposals 等（:158、:211 等）。
- 版本与分母：v4；Full 1,488 题 $1,000k（IC Full $415k＋Manager Full $585k＝$1,000k，`[复算]` 成立）；Diamond 502 题 $500,800（237＋265；236.3k＋264.5k＝500.8k `[复算]`，表印 $501k 为舍入）。Full 集 IC/Manager 各题数未读（缺口）。

## TheAgentCompany（S6＋S7）

- ①测什么：仿真软件公司的 175 个长程职场任务：浏览、写码、跑程序、与 LLM 角色（NPC）同事消息沟通；Success（全完成）与 Score（§4.1 部分完成公式）双指标＋Steps＋Costs（Table 1，tac.txt:394-412；公式 :276-286）。评测者／NPC 固定 Claude-3.5-Sonnet-20241022（:389-393）。
- ②分数入口：官方站 `the-agent-company.com`（数据、环境、实验入口，:42-46；本包取到 HTML 仅 903 B 外壳、title 可读，榜单表为客户端渲染未执行 JS＝未核）；代码 `github.com/TheAgentCompany/TheAgentCompany`；实验 `github.com/TheAgentCompany/experiments`（api 200，pushed 2026-08-01）。已发表分数住在论文 Table 1。
- ③成本字段：有，Table 1 末列 Costs＝平均每任务 USD；正文「an average of almost 27 steps and more than $4 to complete each task」（:410-412）对应 Gemini-2.5-Pro 行 27.2 steps／$4.2。口径§5：`Cost = Prompt token count × Prompt token cost + Completion token count × Completion token cost`，假设无 prompt caching（:291-294）。实读单元格：OpenHands 0.14.2＋GPT-4o $1.3／Gemini-2.5-Pro $4.2（:400-401）。环境侧另计：NPC 单次交互成本 ≤$0.024（假设 3000 in＋1000 out、Claude 3.5 价 $3／$15 per 1M、无缓存，:1015-1018，上限估计非实测）。反例记录：:1290 的 $4,704 是任务内设备采购对话的预算，不是评测成本。
  - 任务价值 vs 实耗成本：本套件无任务奖金池字段；Costs 列只记 agent 调用的 API 费用复算，NPC 费与环境部署费不并入（原文未合账，标 `[推断]`）。
- ④组织对照读取范围：有部分双臂——Table 1 同表：OpenHands 0.14.2（单 agent）＋GPT-4o＝8.6% Success／16.7% Score／14.6 steps／$1.3；OWL RolePlay（多 agent 框架）＝4.0%／11.3%／N/A／N/A（:400、:403）。正文写「Both using GPT-4o, OpenHands (8.6%) and OWL RolePlay (4.0%) show varied performance」（:418-421）；但表内 OWL 模型列为「GPT-4o, o3-mini」，脚注 9 称只测推荐配置（branch camel-ai/owl@`gaia58.18`，:430-432）。判定：同一 175 题上的多／单官宣质量数字存在，但多臂含第二个模型（o3-mini）且成本／步数 N/A——不是同模型「分数＋成本」双数字；正文说「Both using GPT-4o」与表列冲突，原样并记待主会话裁决（`[冲突未决]`）。
- 版本与分母：v3（2025-09-10）；全量 175 题；Table 1 各行 Cost/Steps 为 175 题平均；同一 OWL 行的 N/A 是未给数，非 0。

## 四栏覆盖计数（本包范围）

| 套件 | ①测量对象 | ②分数入口 | ③成本字段 | ④组织对照读取范围 |
|---|---|---|---|---|
| BrowseComp | 已核 | 已核（无榜单，simple-evals＋论文） | 已核：全文零成本字段（有界检索） | 已核：无组织对照 |
| SWE-Lancer | 已核 | 已核（仓库入口＋合并续链） | 已核：API 费用已印，任务价值分列 | 已核：无组织对照 |
| TheAgentCompany | 已核 | 已核（站＋repo；站内榜单表未读） | 已核：每任务 $ 均值＋NPC 估计分列 | 已核：部分双臂，非同模型双数字 |

12/12 栏有提取记录；0 项「来源不可达」。④结论：三套件均未新增满足原关闭项第 2 条的同模型分＋成本双数字（该条仍由 Optima 补核支撑）；TAC 的同集多／单仅质量数字且多臂异构，列为有界发现。

## 剩余缺口与原因

- BrowseComp：Table 3 各行分母未声明（推定 1,266，未核）；Fig 1「browsing effort」无单位；全文无 token 数可对上美元口径；仓库为滚动 main（本包按 commit `652c89d…`＋blob 记），论文与代码版本未绑定。
- SWE-Lancer：CI 金额对象依上下文判为 237 题单次运行的模型 API 费（句子未复述单位，`[推断]`）；每任务 token 四分量、缓存字段、单价日期未公布；Full 集 IC/Manager 题数拆分未读；`SWELancer-Benchmark` 原库已空壳化，具体 split／harness 需经 `frontier-evals/project/swelancer` 续核（未读）。
- TheAgentCompany：OWL 行成本／步数 N/A 未给；多臂异构模型＋正文/表模型列冲突；无 token 四分量、无模型版本日期；NPC $0.024 为假设上限非实测；网站榜单表未读（客户端渲染，不执行 JS）。
- 通用：本包未跑基准、未调用 API 账单，金额均为论文公布值，不是账单复算；GitHub 侧全部经 api.github.com，github.com 页面未直接读；未复核 S3 引用的历史价格表。

## 执行记录

- 开始／完成：2026-10-13 23:34:06 +08:00 ／ 23:37 +08:00（约 3.5 分钟；完成时刻取本件末次落盘）
- agent 路径：/root/suite_remainder；模型：opencode-go/deepseek-v4.1-flash、effort max（派发记录按此；模型标识以主会话记录为准）
- 工具：curl、pdftotext -layout、python3（无浏览器、不执行 JS）；session_id／token 用量未知
- 边界：只写本件与 `/tmp/org-v3-w2-02-20261013/`；无 git 写、未跑基准/测试、未调用本机 DSH、未写 `~/.dsh`／部署／配置；未绕过访问挑战
