# Terminal-Bench 4.0、MLE-bench 论文账与 HAL 行级可达性补核（02 号票续派）

- 基线 `a8967ce118c9becfad132159ae50f9a86ba11397`；采集 2026-10-13 20:51–21:06（+08:00）：TB 20:51–20:55，MLE-bench 20:56–21:01，HAL 20:56–20:59，§6 可选复触 21:03–21:06；定向返工补核 21:12–21:16（+08:00，date 实测，含 GAIA 榜单配置直读）；快照在 `/tmp/org-v3-gaps-20261013/`（临时目录，可能不保留）；数字均按快照复核。
- 范围：补 `benchmarks-and-cost-accounting.md` §6 第 3/4/5/7 条遗留——①TB 4.0 版本、任务数、n_trials 与 token 字段；②MLE-bench 论文侧资源账；③HAL 行级可达性与 2026-10-05 公告；④按票关闭判据①补五对象四栏（TB/SciCode/MLE-bench/GAIA/WebArena）。F1/#Tok/配置数字见[Optima 包](02-optima-config-and-denominators-20261013.md)，PaperBench/RE-Bench 成本见[成本前包](02-paperbench-rebench-costs-20261013.md)，本件不重抄；不裁定整票关闭性（[02 号票](../../issues/02-research-benchmarks-with-cost.md)）。
- 边界：只读访问公开网页与 API；未跑实验、未装依赖、未访问 DSH、未改票面/地图/其他研究件、未提交 Git。
- 主会话回读校正：MLE 的 token 分母是每个含75竞赛的 seed 总量的均值；1,800 GPU小时是预算上限，非实测利用时数；TB 有同模型不同effort行，组织对照另核。
- 记号：「[作者报告]」对象方自述；「[榜单数据]」官方页内嵌数据或 API；「[并列]」口径不同或未统一，保留两侧；「[未知]」现有材料未给；「[记录]」只证本次观测；「[独立复算]」本件算术。

## ① Terminal-Bench 4.0：66 任务、330 trials、token 包含关系

- 版本归属 [榜单数据/记录]：现行 4.0 在 Harbor Hub（`hub.harborframework.com/datasets/terminal-bench/terminal-bench`）；旧仓 `laude-institute/terminal-bench` 现 301 至 `harbor-framework/terminal-bench-1`，其 README（本件复核与 `raw.githubusercontent.com/laude-institute/terminal-bench/main/README.md` 逐字节一致）仍写「beta with ~100 tasks」「run Terminal-Bench 2.0」「Core v0.1.1」——旧仓陈述，非现行来源 [并列，不裁]。
- 任务数 66 [榜单数据/独立复算]：Hub tasks API `.../latest/tasks` → `total=66, page_size=100, total_pages=1, missing_task_count=0`（tag `4`/`3`/`4.0.0*` 同值）；release 链 v3.0.0（2026-07-23）"Added initial 74 Tasks"，v4.0.0（2026-08-26）移除 8（饱和 2、拒答 2、公开解 2、质量或平台 2），74−8=66。
- n_trials=330 [榜单数据/独立复算]：榜单 35 行逐行均为 330，66×5=330；文档句「Terminal-Bench requires 5 runs per task for official results」与新闻「饱和＝最新代全家族全类别 5/5 解决」相容；docs 该句处版本化文本、标注版本 2.1/2.0，4.0 同名句未直接核到 [并列]。
- token 字段（[纠正件](../evidence-corrections-2026-10-13.md) §3 遗留）[榜单数据/独立复算]：34/35 行存在字段数值恒等式 `total_tokens = uncached_input + output_tokens`（cached 另列）；唯一例外 rank 21 `Grok 4.7`（标 "partial: 324/330"）按 `cached+uncached+output` 相加成立（5,207,370,880+255,514,442+22,977,067=5,485,862,389）。[边界] 恒等式只证字段值关系，不足以确定 `cached`／`uncached` 语义（原始 uncached 可能为标签或核算差异）；不作账单定义，只作逐行自检规则。
- 榜首行（rank 1）复核 [榜单数据/独立复算]：Claude Code / Opus 5.5 / max，64.85%±3.11，$4,718.65；total 8,034,082,467=7,945,267,860+88,814,607；cached 7,699,681,320；successes 214/330=64.85%；avg 4,790.4 s/trial。美元计价过程（价格表、缓存折扣、失败/重试计费）[未知]；公布值≠审计账单。
- HF 访问失败（非空结果）[记录]：数据集页 404、dataset API 401（"Invalid username or password"）、`dataset_info`/`size` API 报 private/gated → 第二来源未取得；搜索面 = HF、GitHub API、Harbor Hub、tbench.ai，2026-10-13。

## ② MLE-bench 论文侧资源账（v6，2025-02-26；v1 2024-10-09）

- [作者报告] 时限与资源：每竞赛最长24 h、单A10，75竞赛的单seed预算上限换算为1,800 GPU小时，不是实际GPU利用时数；每竞赛一台36 vCPU/440 GB/4095 GiB。§3 Setup默认重复3 seeds（mean ± SE），Table 2例外：o1-preview AIDE为16 seeds、GPT-4o AIDE为36 seeds；Any Medal 16.9%±1.1与8.7%±0.5分别是这两组seed的均值。
- [作者报告] tokens：§6 Limitations原句为o1-preview+AIDE "used 127.5M input tokens and 15.0M output tokens on average for one seed of 75 competitions"。分母明确为每个含75竞赛的seed，127.5M input与15.0M output是其总量的均值，不是每竞赛均值。pass@1 16.9%到pass@8 34.1%为§3.2同一16 seeds的attempts抽样估计（Figure 3）；同节GPT-4o pass@6 17.0%约等于o1-preview pass@1 16.9%。GPT-4o 8.7%@24 h到11.8%@100 h是延长预算实验；评测75竞赛（22 Low/38 Medium/15 High），另有7个dev竞赛，不能加为82的主表分母。已读全文未给美元成本。
- [并列] README（2026-04-24起暂停收新）的"Running Time (hours)"列是每任务时限（24为主，另有12/36），不是实测总工时。README All的AIDE/o1-preview 17.12±0.61、AIDE/gpt-4o 8.63±0.54，行内未标种子数；与论文Table 2的16.9/8.7并列，不自行统一。
- [记录] Lite=Low 22 竞赛；数据体积 158 GB（Low）vs 3.3 TB（全量）；README 无 USD/GPU 小时列。
- [未知] 资源预算未提供实际GPU利用率，token是作者报告而非本轮审计；100 h实验无美元换算；README各行预算与论文主实验的对应未逐行核。

## ③ HAL：行级可达性与 2026-10-05 Known issue（一手原文）

- 可达性改写 [记录]：直连成功（本件复核 https://hal.cs.princeton.edu/scicode 200）；9 个子页均 200 且服务端渲染完整表格（tr 计数：GAIA 34、AssistantBench 17、CORE-Bench Hard 51、SciCode 35、Online Mind2Web 24、SWE-bench Verified Mini 35、TAU-bench Airline 28、USACO 15、ScienceAgentBench 25）。→ 报告 §6.3「全榜 client-rendered、行级不可读」作废；此前超时按瞬时网络处理。
- 公告原文（2026-10-05，各子页同 banner）[作者报告]："Reported costs and token counts are overstated. Nested trace spans counted the same API response twice, so affected models are inflated by exactly 2×. Models logged as a single span are unaffected, so the overstatement is not uniform across rows. Not yet re-derived." 同页注：成本未计缓存折扣；更新暂停、转向可靠性。
- SciCode 两行公布值直读 [榜单数据/独立复算]：`o4-mini Low` Zero Shot **9.23% / $1.74**（标 Pareto optimal）；`o3 Medium` Tool Calling **9.23% / $111.11**。$111.11/$1.74≈63.9；两行模型+scaffold 不同且均处未重算窗口 → 仍不得作效率结论（补齐纠正件 §2 的行级原文）。
- 修复边界 [记录]：`princeton-pli/hal-harness` archived、pushed_at 2026-07-01；递归 tree 479 项、truncated=false、无站点/榜单数据目录（机读数据＝官网 HTML＋加密 traces）。PR #114（merged 2025-09-22，`713013160c…`）只修 cached token 解析，与嵌套 span 问题不同；不能推断榜单行已重算。

## ④ 五对象四栏（票关闭判据①；附一手 URL／版本／章节）

| 对象（一手来源） | 测什么 | 分数在哪 | 成本可得性 | 同集同模型 multi-vs-single 双数字核验 |
|---|---|---|---|---|
| Terminal-Bench 4.0｜https://www.tbench.ai/（榜单内嵌数据；Hub https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/latest，版本4.0.0） | 终端工程任务，66任务；官方行330 trials=66×5 | 首页内嵌35行，`/leaderboard`重定向至首页；旧仓约100任务不是本版 | 行内token与美元公布值，计价过程未知；HF第二来源不可达 | 同模型不同effort行确实存在，如GPT-6 Astra的max/xhigh/high/medium/low；未核其为multi-vs-single组织对照，不用同模型重复行代替实验设计 |
| HAL SciCode｜https://hal.cs.princeton.edu/scicode（同父站 9 子页；2026-10-05 公告为同页 banner；harness https://github.com/princeton-pli/hal-harness archived） | 研究级科学计算代码生成（Zero Shot／Tool Calling） | 子页服务端渲染表格 35 行（含 Pareto 标记） | 行内含 cost USD（$1.74／$111.11），但公告：成本与 token 高估（嵌套 span×2、非均匀）＋未计缓存折扣、未重算 → 现不可作效率结论引用 | [未核]：行级未见同模型 multi/single 双臂；受影响行未重算，即使有亦需等重算 |
| MLE-bench｜https://arxiv.org/abs/2410.07095v6（2025-02-26，Tables 2/3、§3.2、§6）与https://github.com/openai/mle-bench | 75个Kaggle竞赛，medal率 | 论文16.9%±1.1等；README 17.12±0.61等另列，种子数未标 | 单seed GPU时间预算上限1,800 h；每个75竞赛seed平均127.5M input＋15.0M output；已读全文无美元值 | pass@1 16.9%到pass@8 34.1%属多attempt对单attempt，非multi-agent对single-agent；未给对应第二项成本 |
| GAIA｜https://huggingface.co/spaces/gaia-benchmark/leaderboard（canonical；gradio 5.49.1 config 直读）＋数据 https://huggingface.co/datasets/gaia-benchmark/GAIA | >450 题三级工具/自主性评测（dev 公开、test 私有） | Space test-set 榜单（validation 已关；score=正确率）；表头 8 列（Agent name/Model family/organisation/Average·L1·L2·L3 score/Submission date） | 表头无成本/token 列（config 直读 2026-10-13）；提交说明未列成本[有界读取所见] | [未核]：未展开行数据；8 列表头无 multi/single 维度；不据提交格式推「不存在」 |
| WebArena｜https://arxiv.org/abs/2307.13854v4（全文 78,872 B 有界读取）＋站点 https://webarena.dev（仍落地页 4,288 B） | 真实网站长程网页任务（812 examples；241 templates/812 intents） | 论文正文：GPT-4 端到端 14.41% vs 人类 78.24% | 全文无 token 计数、无作者报告美元成本；`$` 仅任务示例（$49.99/$279.49）；"cost" 仅 "inference time cost"（A.2 重置语境） | [有界检索未发现]：全文 0 处 multi-agent/single-agent；不推出其他文献不存在 |

## 原 §6 盲区覆盖

| §6 条目 | 本件处置 |
|---|---|
| 3 HAL 全榜不可读/公告未核 | 前半作废（行级可读）；公告一手核到；受影响行未重算 → 继续隔离；四栏见④ |
| 4 TB 版本/任务数冲突 | 解除：现行 4.0=66 任务（74−8）；~100 任务 README 属旧仓（terminal-bench-1）；四栏见④ |
| 5 GAIA 榜未读 / WebArena 812 未核 | GAIA：Space 可达、test set 提交计分且 validation 已关（Space markdown 直读）；config 表头 8 列无成本列；行数据未展开 [部分未核]；WebArena 812 一手确认（2307.13854v4「812 test examples」「241 templates and 812 instantiated intents」）[作者报告]，成本有界读取见④；webarena.dev 仍为 4,288 B 落地页 |
| 6 openai.com 403 | 不在本件范围 |
| 7 OSWorld 404 / MLE 论文侧未读 | OSWorld：根域 301→osworld-v1.xlang.ai，`/leaderboard/` 仍 404；站点含 Verified/Self-reported 榜，self-reported xlsx 表头（Model/Institution/PaperLink/PaperAuthors/Details/TrajectoryLink/Score/Date）无成本/token 列；MLE 论文侧已核（见②，四栏见④） |

## 剩余缺口

- TB：美元计价过程；HF gated（访问失败）无第二来源；docs「5 runs」版本归属未定；cached/uncached 语义未定（数值恒等式≠账单定义）。
- MLE-bench：作者用量未审计；GPU实际利用时数及100 h实验美元成本未知；README种子数与论文16/36口径未统一，token单seed分母已明确。
- HAL：受影响行集合与重算时间表未给；63.9 不得引用；官网加密 traces 未解密。
- GAIA 榜行数据未展开（表头已读）；WebArena 其他版本未展开。
- 本件未跑实验、未审计账单，不裁定整票关闭性。

## 采集记录（SHA-256）

- 目录 `/tmp/org-v3-gaps-20261013/`（临时，可能不保留）；TB：`tbench-leaderboard.html`（145,339 B，20:51，`3da2207ac6531568cef58b4ee89ec53ab57a3fddcb07ea484334ac38921af70f`；同目录 `tb-home.html` 为 20:54 同数据重复抓取、仅 `dehydratedAt` 不同）、`hub-tasks.json`（`1c04b1dc0ddf680b3af17032c8c21ae29935991af28951590684d4f034c8f2d5`）、`tb-releases-api.json`（`cd0445f2c396d1e5e01866e2e57c1fc50a2f4ed692aef072ca40833a852bda03`）、`tb-news-4-0.html`（`5bb66a421a314d126b2adc0a9c71bd1f7873be1061613b19a8ed21e2fe84b3c1`）、`tb-docs.html`（`c1daaf2b678b935da51c2940d856176c943400d7d86b08e4cffa73453a582915`）、`harbor-hub-latest.html`（`ce72d98ba18cf0583609f44bd9056772e77f7627678141dbe84f3ac70fa5e7b2`）、`tb-harbor-readme.md`（`19cd7542ab806fc5732503f2fe2d6ee7e342de549ab1acfba184060f1290b03b`）、`tb-github-readme.md`（`c4b77ef934ae210f3c712e7bab30f460ff35e125aa83affc30c9e7dd6317cdf1`）、`repo918420677.json`（`32e42240e221cbb7b8bf789a9a8885fc7807d09a9849cff1cb43ac28ae7cb7a2`）、`laude-repo.json`（`e3a82f99ca80f3306ba73889a50e07520b201796579b182bab95a061c565860f`）。
- MLE-bench：`mlebench-arxiv-v6.html`（974,201 B，21:00，`d6aa28f679c2d75eb0872c3b862f1bc4f27d3ef5efe6859f000f3b41ca98ad02`）、`mlebench-arxiv-abs.html`（`42819fcae1726e4f9a3cc8402d9aa5e179b1e2e802d770150b8905ca9fb9c08f`）、`mlebench-readme.md`（`586bbc19cb2a3e11be61021866ef6436cf4b4d935bb1db088984b567b76595bb`）。
- HAL：`hal-home.html`（122,944 B，20:57，`3846d6ab680ab4b8664169b0cbd83421344a6b6286205f86380b0a1f4b349d2a`）、`hal-gaia.html`（`916379d9022e7a8fd4abd8615c81c2fc958305e98f7764c913f63bf787e4138b`）、`hal-scicode.html`（`50d72f921462a52888d012144c2a88e300720e1100ab6611bf7e146593d62a10`）、`hal-assistantbench.html`（`be14ddb7055803de81f1ca8d41a42583a6582014ce4b687806145f7162bf8a73`）、`hal-corebench_hard.html`（`f46a6d73ead02529444c35c3f1d67898d4c88e799f8d8f6d9a47c99cfe527997`）、`hal-online_mind2web.html`（`3c689a054d9d4d538ae0bde48d546a68223f3083fc6b210a4143b3c3e1e8cc0f`）、`hal-swebench_verified_mini.html`（`c01f3a7167bf8885c6e72ae94d2560a57059a7a21f3af7e97d090a7535cea798`）、`hal-taubench_airline.html`（`83631f306f1fd6c85a6c0f7dcb53f9dec3915f6b6a323fc1dd46a9887209cc41`）、`hal-usaco.html`（`737a4b7eb3af489b925f3cf629756f3dd451181004f95ce3afad634671774346`）、`hal-scienceagentbench.html`（`f576d5df56b23cf57da42bf848d55d8da5cbab1ba52e973aed033f646b6f26f9`）、`hal-tree.json`（`c5e0ee6b24480c4eb6c70382caa04d31e1c8d0d69ca5c3e5d81e9f156058f868`）、`hal-pr114.json`（`d50f9d7102d9b41af3e8760ea7f77e8a22c8a2779f014fdf5e87c34a3fe2b38d`）、`hal-repo.json`（`51d83a86578c6aeb90a17aec53143bcb9c545eb7d1064f0bcf940f0afb49706d`）。
- 可选复触：`osworld-home.html`（301 stub，`9e17cb15dd75bbbd5dbb984eda674863c3b10ab72613cf8a39a00c3e11a8492a`）、`osworld-home2.html`（`bf37e00ce23e8c5472d485a6eb3b291ffa2de220b44040402516e41cbc48c516`）、`osworld-selfreported.xlsx`（`3016a0665f7c4527f235cd72f2217d759461253c488ba03991f36ea44968f731`）、`gaia-space.html`（`5f680eef36361c25daa5c3b518bcdfe5c7de81c30492f3fc36d6394c633ba4c7`）、`gaia-space-runtime.html`（`d47cb25e78064cd60a1f1907c42964d45981aeff3b79230984288819418df799`）、`webarena-abs.html`（`0b4da71dfd2bee8c145a946e171e2774d3fbb8de5fc07dbe83dae0a3ba7691ea`）、`webarena.pdf`（`f9731b92bc3d29a2ea7b5f9cb46b48540c76bc3f84a57e0c48fc37ea73107f95`）、`webarena.txt`（`5a3cb650700041d4e72eb45131ae00a9503b63c7f55ec2e6bd08deb52063e1b4`）。
- 返工补核（21:12–21:16，date 实测）：GAIA 榜单配置 `gaia-space-config.json`（50,920 B，21:14，`4109342e643d042d861a9ed3ed3bf3df6520ced0c241143140b1449ebdb87122`，源 https://gaia-benchmark-leaderboard.hf.space/config）；redirect 实测：https://www.tbench.ai/leaderboard 302→https://www.tbench.ai/（榜单数据在首页内嵌）、https://hal.cs.princeton.edu/scicode 200。
- 执行：模型 `opencode-go/deepseek-v4.1-flash`、effort max；session_id 与 token 未知。只读；未访问 DSH；未改票面/其他研究件；未提交 Git；定向返工只改本件，输出名按主会话保留 02-gap-rechecks-20261013.md（不另造 02-suite-accounting-gaps）。
