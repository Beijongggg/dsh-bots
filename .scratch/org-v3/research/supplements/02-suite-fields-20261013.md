# 02 带成本公开基准：GAIA／τ-bench·τ²-bench／HLE／OSWorld 四组分栏补核（补核件）

[带成本的公开基准与成本口径](../../issues/02-research-benchmarks-with-cost.md)「套件与争议字段」工作包的四组字段补核。按[研究补核与委派](../../research-handoff.md)只交一手字段提取与缺口，不裁定口径、不关票；验收与整合由主会话处理。基线 commit `a8967ce118c9becfad132159ae50f9a86ba11397`。只查原清单四组，不扩大套件；同模型不同 effort／配置的榜行不构成 multi-vs-single 对照（派发规则）；无成本／无对照的结论只限已读版本与章节，访问失败与未读一律标未核。缓存目录 `/tmp/suite-fields-02-20261013/`（非冻结件，采集集中在 2026-10-13 21:49-21:51 +08:00）。

## GAIA

- 测什么：真实世界助手任务，需推理＋浏览＋多模态＋工具；466 题，官方保留其中 300 题答案，另发布 166 题的 dev set（gaia-paper.txt:22、:121、:183）。
- 分数住哪：HF Space 榜单（`gaia-benchmark/leaderboard`）。列由 app.py 的重命名链固定为 Agent name／Model family／Average score (%)／Level i score (%)／Submission date（gaia-app.py:45-51）；提交物为答案 JSONL，由官方计分。
- 成本字段（已读范围）：榜单无成本／token／运行时间列；论文只有人工标注成本讨论（"On the cost of designing unambiguous questions…"，:672-677），并自陈评测环境拿不到调用日志："OpenAI's API does not provide the detailed log of tool calls yet"（:669-670）。分母：Average score 的题分母未在榜单字段层声明（未核）。
- 同集同模型 multi-vs-single 双数字：未核到。已读榜单无成本列; 论文 human 92% vs GPT-4+plugins 15%（:15-17）为人类与模型对照, 不是多代理与单代理对照。
- 定位：α arXiv:2311.12983v1 → `https://arxiv.org/pdf/2311.12983v1`（2023-11-21, Meta/FAIR 等）；β Space 源码 `https://huggingface.co/spaces/gaia-benchmark/leaderboard/raw/main/app.py` 与 `…/content.py`（HF 官方组织，main 未固定 commit）。缓存：`/tmp/suite-fields-02-20261013/gaia-paper.pdf` SHA-256 `5bf6f968d4f5cd20acdfca6e81e3c9f5277bb66061fad7a02e35442dff812ba0`（21:49:40）；`gaia-app.py` SHA-256 `3b5ae007d232951c3ed2505b862048f98b3b912314365256c3b0c106ae8cc579`（21:50:09）；`gaia-content.py` SHA-256 `ff884de979b31c79f49ae060ee353f01893fa5f50d2b2c1a6d1b80265b6dadc8`。

## τ-bench／τ²-bench

- 测什么：工具—代理—用户交互 benchmark。v1 域为 airline／retail（pass^k 一致性）；τ² 为 dual-control（用户也行动），域 airline／retail／telecom（tau2-paper Figure 3 文段），repo 另含 mock／banking_knowledge。
- 分数住哪：repo `github.com/sierra-research/tau2-bench`（main@`fc0055dc4e0a316c3f83133267fbd6faaa770992`，2026-07-16，README 已进入 τ³ 时代）与 `taubench.com`；评估输出为逐任务 reward，reward 是 `reward_basis` 各组件的乘积，默认 `[DB, COMMUNICATE]`（tau2-evaluation.md:10-12、58-59）。版本注意：repo 声明 v1.0.1 评分更新后旧分不与新分可比（原报告已核，本包未复测）。
- 成本字段（已读范围，均为论文报告值，非账单复算）：v1 论文 §5.1 Cost analysis："gpt-4o FC agent with gpt-4 user simulation on τ-retail, the agent / user simulation costs are $0.38 / $0.23 per task"；"running one trial per task costs around 200 dollars"（该句分母原文未给算式，不按题数推算）；agent 费用里 input/completion 占 95.9%／4.1%（tau-paper.txt:580-583）。τ² 论文 §4.1：gpt-4.1-2025-04-14 代理配同版本用户模拟，"agent/user simulation costs are $0.086/$0.059 per task"；"all domains for 1 trial per task is approximately $40"（tau2-paper.txt:653-656）。币=USD；token 无直接计数（v1 仅价格占比）；运行时间未见。
- 同集同模型 multi-vs-single 双数字：未核到。两处成本都是「单代理＋用户模拟器」两角色的费用拆分，不是组织形态对照。
- 定位：α `https://arxiv.org/pdf/2406.12045v1`（2024-06-17, Sierra 等）；β `https://arxiv.org/pdf/2506.07982v1`（2025-06-09）；γ `https://raw.githubusercontent.com/sierra-research/tau2-bench/main/README.md` 与 `…/docs/evaluation.md`。缓存：`tau-paper.pdf` SHA-256 `0ce66a1763d698c61bb311c3c874bf593d1e9a5bfff11bb35f6f72b981f6da56`（21:49:46）；`tau2-paper.pdf` SHA-256 `0817e3fd33915326180d548caa900dcc5cba42ded27688105d8ce2f7e73aad84`（21:50:09）；`tau2-readme.md` SHA-256 `ed39688aa5d40bd73007355df65f4e41a6c250960642e56764c3ad44da1df8d2`（21:49:44）；`tau2-evaluation.md` SHA-256 `017e992b8e8b57c227523c63c4a2597b69a328c0108bd94b1c9028fed6a26ac4`。

## HLE（Humanity's Last Exam）

- 测什么：2,500 道闭卷专家学术题，多为不可快速检索；评估模型是否同时给出答案与置信度（论文另报校准误差）。
- 分数住哪：官方站 `lastexam.ai` 榜单；论文 Table 1 报准确率与 RMS calibration error（"RMS calibration errors above 70% across all models"，hle-paper.txt:222、:596-601）。
- 成本字段（已读范围）：论文 Figure 5／6 报「各模型平均 completion tokens」（reasoning 含推理与输出 token；Section C.4 为无推理模型），定位 hle-paper.txt:669-697（"Models with reasoning require substantially more inference time compute… be compute-optimal"）。无币字段；$500,000 为题目奖金池（:478-479），不是评测成本；运行时间字段未见。
- 同集同模型 multi-vs-single 双数字：未核到。论文为模型级准确率＋token，无 scaffold 或组织形态对照。
- 定位：α arXiv:2501.14249v11 → `https://arxiv.org/pdf/2501.14249v11`（2026-07-28, CAIS/Scale AI 等）；β `https://lastexam.ai/`（此页 "Cost" 命中实为作者姓氏；无成本字段）；γ `https://lastexam.ai/leaderboard`（HTTP 200 但为 Next.js 客户端渲染，未执行 JS，未取到表格文本层=未核）。缓存：`hle-paper.pdf` SHA-256 `a032e5bc3d2f40e474d4f17748c999d54eb2de121eadbcdc1709f4e4bd6bba1f`（21:49:40）；`hle-lastexam.html` SHA-256 `a44ed026c7e56ebb1b240b19a9d312accf99afdc391b753944160553d22a9219`（21:49:45）；`hle-leaderboard.html` SHA-256 `e60e6038628ce887819cee91556287e1bb9a7d9152adeb4fb662faceb5f24dd6`（21:50:31）。

## OSWorld

- 测什么：真实操作系统与网页／桌面应用中的开放式 computer-use 任务；369 题，排除 8 个需手工 Google Drive 配置的题后为 361 题（分母差异原报告已记，本包不重推导）。
- 分数住哪：官网榜单（`os-world.github.io`）表头＝Model & Date／Approach & Details／Success Rate (Avg±Std)（osworld-site.html:1534-1537，HTML 文本层已核）；repo 评测输出报 per-domain success rates 与 overall success rate and total score（osworld-readme.md:218-220）。
- 成本字段（已读范围）：无币列；token 仅环境侧观测长度分布——a11y 树单观测 90th percentile 6343.60 tokens、6000 上下文覆盖约 90% 情形（论文 Figure 6 与正文，osworld-paper.txt:1470-1520）。步骤为受控参数：`--max_steps 15`（正文 "e.g., 15 in our experiments"，:176；README:173、:186）。附录 B.2 的 "high cost of … annotation data" 是数据制作成本，不是评测成本（:2259）。
- 同集同模型 multi-vs-single 双数字：未核到。论文与榜单基线均为单体代理，无组织形态成本对照。
- 定位：α arXiv:2404.07972v2 → `https://arxiv.org/pdf/2404.07972v2`（2024-05-30, xlang-ai 等）；β `https://os-world.github.io/` 快照；γ `https://raw.githubusercontent.com/xlang-ai/OSWorld/main/README.md`（main@`c01adb60ae76b8a996116aab5d6ada7ee8103c38`，2026-07-27）。缓存：`osworld-paper.pdf` SHA-256 `d4c6e20dd59467f005561b1e97199f9842fd3b0e9fdd93e66e06ba0ec09edfdb`（21:49:51）；`osworld-site.html` SHA-256 `bf37e00ce23e8c5472d485a6eb3b291ffa2de220b44040402516e41cbc48c516`（21:49:53）；`osworld-readme.md` SHA-256 `83b8684c2f4ac4f31996b8b4752195fcb6cc5429f89d92398177b9b721d787fc`（21:50:34）。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| 套件四栏（测什么／分数住哪／成本是否可得／双数字有无） | 四组四栏全部给出；成本字段按已读范围核实 | 完成（提取层） |
| 至少一个同集同模型 multi-vs-single 双数字 | 四组官方材料内 0/4 核到（各栏已列已核范围） | 有界未发现；不关票 |
| 分数与成本同时可得 | GAIA 已读榜单无成本列; HLE 有 completion token; OSWorld 有单观测 token 分位数与步数预算; τ 组有单臂美元估算 | 已区分实际用量、预算与代理指标, 不混成同一口径 |
| 双数字/成本结论限定版本 | 每条均附 URL、机构、版本/commit 与 SHA；过时版本已标注（τ² v1.0.1、τ³ README） | 完成 |

## 剩余缺口

- GAIA 榜单 Average score 的题分母未在字段层声明；HF Space main 分支未固定 commit，引用时以本地 SHA 为准。
- HLE 官方榜单为客户端渲染，未执行 JS（未核，不作「不存在成本字段」的全称断言）；论文只有 token 无币。
- τ-bench v1 "around 200 dollars" 一句原文未给分母算式；τ² 论文成本行未附 token 计数；repo 与论文的版本严格映射（v1.0.1 前后）未逐项核。
- OSWorld 369／361 分母差异、max_steps=15 与榜单 Avg±Std 的统计口径未逐项核；榜单无成本列（表头已核）。
- 主会话回读缓存首页固定版本：GAIA `2311.12983v1`（2023-11-21）, τ `2406.12045v1`（2024-06-17）, τ² `2506.07982v1`（2025-06-09）, HLE `2501.14249v11`（2026-07-28）, OSWorld `2404.07972v2`（2024-05-30）。按这些版本与上列 SHA 引用; 跨论文的 GAIA 多代理成本对照不在本件范围。

## 执行记录

- 开始／完成：2026-10-13 21:49:12 +08:00 ／ 2026-10-13 21:51:54 +08:00（约 3 分钟；完成时刻取正文末次落盘 mtime；本行于 21:54 回填）
- agent 路径：/root/theory_complex_sources；模型：opencode-go/deepseek-v4.1-flash/max（原生子代理，按用户授权）
- 工具：curl、pdftotext、python3（无浏览器、不执行 JS）；session_id 未知；token 用量未知
- 边界：本窗口只写本件＋`/tmp/suite-fields-02-20261013/`; 未装依赖、未跑基准、未调用本机 DSH、未写 `~/.dsh`／部署／配置。无子代理重派, 主会话整合时补固定版本并纠正 HLE 成本代理的覆盖表; 不记零返工验收。
