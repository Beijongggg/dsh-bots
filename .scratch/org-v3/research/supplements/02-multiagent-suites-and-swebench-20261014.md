# 补核：多 agent 套件与 SWE-bench 组织分类

所属票：[带成本的公开基准与成本口径](../../issues/02-research-benchmarks-with-cost.md)。
基线 `b4fa51da2c2f316e0513382276d286669aa8a25e`；2026-10-14 交件并经主会话回读、复算与修正。
本包四项主张为 A1/A2 的套件四栏、B1 的榜单字段、B2 的前 15 行分类；不做独立实验。

## A1 MultiAgentBench 四栏

来源：[MultiAgentBench v1](https://arxiv.org/html/2503.01935v1)，Kunlun Zhu 等。
已读 §3.2、§4、§5 与 Fig. 5/6/8；MARBLE 代码和数据未读。

| 栏 | 已核内容与限制 |
|---|---|
| 测量对象 | 协作／竞争的任务与协调分数、milestone KPI；research、Minecraft、database、coding 四个任务场景各 100 例，另有竞争场景 |
| 分数入口 | 论文表图；代码／数据入口 [MARBLE](https://github.com/MultiagentBench/MARBLE)，不把未读仓库算作已核榜单 |
| 成本字段 | Fig. 5 token usage 按最小 0、最大 100 归一化，不能反推绝对 token／美元。所读实验未定位可复算运行费，商品价格不是运行费 |
| 已发表组织对照 | Fig. 5 的 Star／Chain／Tree／Graph；Fig. 6 规划策略；§5/Fig. 8 的 1、3、5、7 agents，以 20 篇至少 7 位主作者论文为 research 子集 |

原稿「只有拓扑对照、无单 agent 臂」拒收。Fig. 8 确有 1-agent 臂，但未同时给出可复算绝对成本，
不能自动升级为双数字证据。归一化量、max_token_num 上限与实际 token 消耗分开。
费用包含、重试、人工费用与该对照的预算匹配未核；不以关键词零命中宣称全篇无成本。

## A2 MasBench／MAS-Orchestra 四栏

来源：[MAS-Orchestra v5](https://arxiv.org/html/2601.14652v5)，Zixuan Ke 等，Salesforce Research。
已读 §4.1/Table 2、§6/Table 3、Figure 3/C.1、D.4/Table D.2；代码与 HF 数据未读。

| 栏 | 已核内容与限制 |
|---|---|
| 测量对象 | MasBench 的 Depth、Horizon、Breadth、Parallel、Robustness 五轴，用于控制任务结构；另测五个公共基准 |
| 分数入口 | 五轴对照 Figure 3/C.1；公共基准 Table 3，质量为 Avg@8；[数据](https://huggingface.co/datasets/Salesforce/MASBench)与[代码](https://github.com/SalesforceAIResearch/MAS-Orchestra)为未读入口 |
| 成本字段 | D.2 按方法×AIME24/GPQA 报 Calls、Tokens(M)、Cost($)、Time(ks)；D.4 说明 token=prompt+completion，价格为写作时 Together AI 价目；非账单复算 |
| 已发表组织对照 | standalone 与编排系统有质量／成本表；共同候选子 agent/LLM 不等于所有编排器权重与模型相同。Standalone 内含 DebateAgent、SCAgent，不能全称一次调用 |

Table 3 列映射已核：IID/OOD 是分组，实际五列依次为 AIME24、AIME25、HotpotQA、BrowseComp+、GPQA。
CoTAgent 为 50.00／45.00／33.56／1.12／60.54；Mas-Orchestra 为 66.25／61.25／49.00／11.00／65.21。
原稿「5 值对 7 列，映射未核」撤回。D.2 的原始打印值如下，顺序为 Calls／Tokens(M)／Cost($)／Time(ks)。

| 方法 | AIME24 | GPQA |
|---|---|---|
| Mas-Orchestra | 51／0.03／0.01／0.50 | 261／0.22／0.07／0.46 |
| AFlow | 1288／3.47／1.46／19.28 | 7404／12.38／4.52／56.94 |
| ToolOrchestra | 1319／3.77／1.76／31.35 | 7829／15.38／5.79／92.47 |
| CoTAgent | 30／0.05／0.03／0.38 | 198／0.16／0.06／1.18 |

以下复算统一为 baseline/Mas，小于 1 表示 baseline 用量或费用更低，不是 Mas 更低。

| baseline | Calls 倍数 AIME24／GPQA | Tokens 倍数 | USD 倍数 |
|---|---|---|---|
| AFlow | 25.2549／28.3678 | 115.6667／56.2727 | 146／64.5714 |
| ToolOrchestra | 25.8627／29.9962 | 125.6667／69.9091 | 176／82.7143 |
| CoTAgent | 0.5882／0.7586 | 1.6667／0.7273 | 3／0.8571 |

原稿 AFlow GPQA 调用倍数与 CoT 比值方向已纠正。「>10×」不对所有基线、指标成立。
金额已舍入，146× 只是打印单元格比，不是精确账单倍数；wall time 还受异步实现优化影响。
D.2 未明确交代重复聚合如何与 Table 3 Avg@8 绑定，不能把跨表值冒充同一次运行的完整账。
RL 训练账、费用四分量、失败重试与人工费用仍未核；没有严格等预算结论。

## B1 SWE-bench Verified 字段与轨别

来源为 [官网](https://www.swebench.com/) 2026-10-14 内嵌 `leaderboard-data`，全量解析 Verified 180 行。
`trajs` 前缀分布为 verified 121、bash-only 47、空 11、evaluation 1，纠正原稿最后一项 `trajs`。
45 行 `cost` 非空，全部是 bash-only；其余 133 行全空。非空包含零，不等于 45 个正价格。
40 行有非空 `per_instance_details`。44 行可除的 cost/instance_cost 均为 500；
Gemini 2.0 Flash 为零/零，不能相除，也不证明免费。两个空成本 bash-only 行为 Devstral Small (2512)、Devstral (2512)。
已读 [成本图脚本](https://www.swebench.com/js/charts/resolvedVsAvgCostChart.js) 的字段与轴标签
`Average Cost per Instance ($)`；未做图表算法审计或逐调用账单复原。

47 个 bash-only 行均带 `System: Attempts - 1`，11 个 mini 版本从 0.0.0 至 2.0.0，分数 9.0–76.8。
版本与 effort 不同，不能把整轨写成「控制 scaffold，只换模型」。失败重试和人工费包含关系未知。

## B2 Verified 前 15 行分类

按 resolved 降序、同分 date 降序。本表是描述性榜单，不是受控组织双臂。
提交证据来自官方 experiments 仓库固定 commit `40f164d5b8f1d249bf95a6df8b74b577fd8e519d`。
每个 `E:<folder>` 指下方来源表的对应 README；只按实际已读结构归类，多调用不等于多 agent。
mini 的四行共同依据 v2.0.0 commit `ce91a8c6449bc5a686df8f6b7ee8ca9433d893bc` 的 README 与
`DefaultAgent.run/step/query`，一个 model/messages 线性历史及 bash 动作；不外推到未读版本。

| # | 系统／分数 | 分类与已读依据 | 成本总额／每实例 USD |
|---|---|---|---|
| 1 | live-SWE Opus 4.5／79.2 | 未定，runtime self-evolving 描述不足以排除子 agent；E:20251215_livesweagent_claude-opus-4-5 | 未报 |
| 2 | Sonar Opus 4.5／79.2 | 单 agent 结构，tool-calling loop、3 工具；E:20251205_sonar-foundation-agent_claude-opus-4-5 | 未报 |
| 3 | TRAE Doubao／78.8 | 生成选择管线，30 候选、Regression 过滤、Selector Agent、最终选择；单次 70.6；E:20250928_trae_doubao_seed_code | 未报 |
| 4 | live-SWE Gemini 3 Pro／77.4 | 未定，同 #1 的描述限制；E:20251120_livesweagent_gemini-3-pro-preview | 未报 |
| 5 | mini Opus 4.5 high／76.8 | 单 agent 结构，mini v2.0.0 | 376.9539985／0.753907997 |
| 6 | Rovo Dev／76.8 | test-time scaling 管线，同一 core agent 用 Sonnet 4/GPT 5 生成两补丁再 refinement；E:20250902_atlassian-rovo-dev | 未报 |
| 7 | EPAM Claude 4 Sonnet／76.8 | 单 CodeAct 结构，达到迭代上限仍可 retry 最多 3 次，不等于单次尝试；E:20250804_epam-ai-run-claude-4-sonnet | 未报 |
| 8 | ACoder／76.4 | 明确子 agent，独立上下文 Subagent-as-a-Tool；E:20250819_ACoder | 未报 |
| 9 | mini Gemini 3 Flash high／75.8 | 单 agent 结构，mini v2.0.0 | 177.9820654／0.3559641308 |
| 10 | mini MiniMax M2.5 high／75.8 | 单 agent 结构，mini v2.0.0 | 36.644993922／0.073289987844 |
| 11 | mini Opus 4.6／75.6 | 单 agent 结构，mini v2.0.0 | 275.76132225／0.5515226445 |
| 12 | Warp／75.6 | 未定，只读 harness 提交 query，架构报告未读；E:20250901_warp | 未报 |
| 13 | TRAE 多模型／75.2 | 未定，README 无足够提交架构细节；E:20250612_trae | 未报 |
| 14 | Sonar Sonnet 4.5／74.8 | 单 agent 结构，同 #2；E:20251103_sonar-foundation-agent_claude-sonnet-4-5 | 未报 |
| 15 | Harness AI／74.8 | 未定，README 无架构细节；E:20250731_harness_ai | 未报 |

计数为单 agent 结构 7、明确子 agent 1、生成选择／test-time scaling 管线 2、未定 5。
分类为本包按已读原文作的证据分组，不是作者统一分类。README 中 pass@1 checklist 不能覆盖正文多候选事实。
Warp README 报 379/500=75.8，与榜单 75.6 冲突，保留两值，不选择其一改榜。
其余 165 行在本包范围外；前 15 分类未定项仍是缺口，不把全榜分类追加为整票关闭门。

## 原关闭项覆盖与剩余缺口

- MultiAgentBench 与 MasBench 的上述四栏已核；原清单 AgentBench、MAEBE、CoffeeBench、MedAgentBoard 等仍未核。
- SWE-bench 字段和有界分类已交，未新增同模型受控组织双数字；原关闭项 2 与 S3 仍由 Optima 已核对照支撑。
- 未新增尾延迟、人工介入或复核成本数据；A1 绝对量、A2 聚合绑定与训练账、B2 未定架构／Warp 冲突保留。
- 采集方记录 v2/v3 MultiAgentBench HTML、mini 提交 README 与 `bash-only.html` 404；访问失败归未核验。
  404 不能证明没有独立页面。验收用 mini 固定版本源码补分类，未绕访问挑战。

## 固定来源与快照

2026-10-14 验收缓存 `/tmp/org-v3-w3-accept-20261014/sources/`，不随件提交，旧临时目录已不存在。
下表文件均在此目录；E 行的 folder 与 B2 一一对应，URL 固定到提交版本。SHA-256 为完整文件哈希。

| 来源文件／定位 | SHA-256 |
|---|---|
| [`multiagentbench-v1.html`](https://arxiv.org/html/2503.01935v1) | `ec2877358f57513d0872e0d7de5ed280ead67604042b6be1c70bdaa0ff69f3be` |
| [`masorchestra-v5.html`](https://arxiv.org/html/2601.14652v5) | `90467de676065140e7d68616d68fb039b914bffea94ddd27c5ffb333bca53e8b` |
| [`swebench-home.html`](https://www.swebench.com/) | `c862011a4ee1d1a7199fad6ca0905fa5c64f58216f7217ac1eddf37f28788433` |
| [`swe-20251215_livesweagent_claude-opus-4-5.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20251215_livesweagent_claude-opus-4-5/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `de307733b949c6fa47d16660f275c0cec07c6154a5d171ab938dc6ca0a605bb4` |
| [`swe-20251205_sonar-foundation-agent_claude-opus-4-5.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20251205_sonar-foundation-agent_claude-opus-4-5/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `0906aafca3211ed92df5bd1bc86a27e43d392a40576ea4fc2bbbc8f57144e850` |
| [`swe-20250928_trae_doubao_seed_code.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20250928_trae_doubao_seed_code/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `188fbd1e6da3735f15cdf069b1d87c4edb87184e6906d04df52f25fbfbf4ac1e` |
| [`swe-20251120_livesweagent_gemini-3-pro-preview.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20251120_livesweagent_gemini-3-pro-preview/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `333b66f0e4d1e0d74845598a106ccb416af40760e4f046cc218c308187f72419` |
| [`swe-20250902_atlassian-rovo-dev.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20250902_atlassian-rovo-dev/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `2a78be3da9ade7879e4bd54b826b12236f7799a3ac5348241bc97e064db51ba5` |
| [`swe-20250804_epam-ai-run-claude-4-sonnet.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20250804_epam-ai-run-claude-4-sonnet/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `fd69ee901f0dcba18456dce03bd66862013963626f6fcd51f00d97d8c1e02e42` |
| [`swe-20250819_ACoder.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20250819_ACoder/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `59541243a781c0637d847f72726e8cf433708ab677ec6b7b79fb61b8b5e04adb` |
| [`swe-20250901_warp.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20250901_warp/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `3751a479ec31b871da77a68c78f7f1e9b971fcb01a0e009498455e436124d1d7` |
| [`swe-20250612_trae.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20250612_trae/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `a77f902a63a4c627448863602ba4563ecfc8175952ae546e843f4f12c3c59cef` |
| [`swe-20251103_sonar-foundation-agent_claude-sonnet-4-5.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20251103_sonar-foundation-agent_claude-sonnet-4-5/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `b2d05eca680c026c9cbec2afb8bb312eaa925cde9337c3632b055815fa6d56e2` |
| [`swe-20250731_harness_ai.md`](https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified/20250731_harness_ai/README.md?ref=40f164d5b8f1d249bf95a6df8b74b577fd8e519d) | `7d33f9a46846a9bb1ca8dfcbe2c4deff868e8973eac22a5ce199f453e77c6cfc` |
| [`swe-cost-chart.js`](https://www.swebench.com/js/charts/resolvedVsAvgCostChart.js) | `20331005e38e249168c991c11c2f8520bed61f488e970dcd0abb987edee4f9d0` |
| [`mini-v2-default.py`](https://api.github.com/repos/SWE-agent/mini-swe-agent/contents/src/minisweagent/agents/default.py?ref=ce91a8c6449bc5a686df8f6b7ee8ca9433d893bc) | `5bb2ef582aacdb653c9d5104853083c5af289347c73687ce6625587d59ae1d1a` |
| [`mini-v2-readme.md`](https://api.github.com/repos/SWE-agent/mini-swe-agent/contents/README.md?ref=ce91a8c6449bc5a686df8f6b7ee8ca9433d893bc) | `179e52fb8967290610cbb8bb186563d2a90f850e025ec9b8b400d2259a972d47` |

采集模型 `opencode-go/deepseek-v4.1-flash`，effort `max`，原生子代理，非本机 DSH。
精确采集与验收工时、session_id、token 未计量；未再次派 ds 返工，主会话一轮回读修正与分类补证。
不记零返修或净节省；报告、票面及关闭状态由主会话整合，原 S1–S5 与 HITL 选择保持。
