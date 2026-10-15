# 补核：Wegner TMS 与 Radner 1962 新入口包（本地续采与缺口）

所属票：[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)。
规则见[研究补核与委派](../../research-handoff.md)；基线 `85c0894119d8ea511609395e78910d382a309b99`。
本会话第二轮只读本地缓存，未联网；无嵌套委派、未调用 DSH、无实验与依赖安装。
两目录 URL 的共同前缀为 `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/`，其后分别为 `Group_Dynamics/` 与 `Group_Performance/`。

两条待证主张与结论：

- W1（§1.11 TMS 同源后续）：MIT 两目录内可读的 TMS 研究。结论：无 Wegner 1987；唯一命中是 Liang 等 1995，
  其机制与作者局限已按原文 PDF 核验，见下节。
- W2（§1.10 团队理论）：Radner CV 是否通到 1962 正文。结论：CV 第 5 页第 9 条链接有效，
  正文已取回；子代理实读 p.857，主会话另核 p.858 的给定信息结构与数学范围。

## W1：MIT 两目录复核（父会话 19:00 取件，本会话本地实读）

| 文件 | 条目数 | Wegner 或 transactive 命中 | SHA-256 |
|---|---|---|---|
| `mit-Group_Dynamics.html` | 13（含 `required_reading/` 子目录，未展开） | 0 | `a2f70a240d7f7301af32c8a9215a7404f28163f1b568032576c278c4c9a0f672` |
| `mit-Group_Performance.html` | 19 | 0 | `f411de2b74eba7f8f76dba0dac9fc0e8281dc84e5231d56d4c31e6ffbffe4fa9` |

- 唯一 TMS 相关条目在 Group_Performance：`Liang_et_al_Group_vs_Individ_(1995)_%20PersnltySocialPsychBulltn.pdf`。
  直链 `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Group_Performance/Liang_et_al_Group_vs_Individ_(1995)_%20PersnltySocialPsychBulltn.pdf`。
- 该文为 Liang、Moreland、Argote (1995), "Group Versus Individual Training and Group Performance:
  The Mediating Role of Transactive Memory", *PSPB* 21(4):384-393，DOI `10.1177/0146167295214009`。
  主会话已按封面与 p.384 页图核对作者、题名、卷期及年份；缓存名 `mit-liang-moreland-argote-1995.pdf`。
- 机制（该文自陈，非 Wegner 1987 直读）：摘要 p.384 `group training improved group performance primarily by fostering the development of transactive memory systems`；讨论 p.391 把共同训练、TMS 强化与任务表现相连。作者并称 TMS 直接效应在控制训练差异后仍在，可用"先个体训练、后补专长分布信息"等程序强化 TMS；均为作者主张，未经本会话复算。
- 作者边界：p.391 `a group may or may not develop an effective system of transactive memory as time passes`，群体发展与 TMS 相关但不同；
  p.392 明说共同训练组并非总比个体训练后组队表现好，效果依群体、任务与环境特征。
- 流动与共享史处置：p.392 先引他人关于成员流动影响共同训练实用性的论点，再给作者推测，`This suggests that turnover may actually have more harmful effects`；这不是本研究操纵成员流动所得的实验结论。
  同页还记事先相识成员未带来更好表现，不能将既往相识当作充分条件。
- 对 §1.11 的用法：已读范围支持共同训练与 TMS 的作者报告及所列局限；不支持「长期共处才形成」
  或「流动必然摧毁」。成员流动的比较损害是作者推测，不提升为本文实验结果。

## W2：Radner CV 链接抽取（本地实读）

| 字段 | 内容 |
|---|---|
| 来源 | `https://pages.stern.nyu.edu/~rradner/RoyRadnerCVwithLinks.pdf`；`radner-cv.pdf`，215691 B，SHA-256 `b756e91cfa67f5a57a2e7026724d2980cb27918fd7f89990d237521c1a494391`；PDF 元数据生成 2015-05-29（Word 2010） |
| 位置 | CV 第 5 页，出版物列表第 9 条 |
| 最短原文 | `"Team Decision Problems," Annals of Mathematical Statistics, Vol. 33, 1962, pp. 857-81.` |
| 该条链接 | `http://pages.stern.nyu.edu/~rradner/publishedpapers/9TeamDecisionProblems.pdf`（整条 3 个锚段同 URL） |
| 实读层级 | CV 链接层，加正文 p.857 页图；主会话另核 p.858。数学未逐项核 |
| 取回件 | 父会话 19:06:03 取回 `radner-team-1962.pdf`，1250627 B，SHA-256 `0b14b44c3c9e52dfbfbcbdd698f9b78f14558b439f61e45b0bf2ee29918bf53b`；Cowles Foundation Paper 184 重印（AoMS 33(3), 1962-09），记录见 `radner-umass-target-fetch-log.json`，以该 log 为准 |
| 正文假设（p.857 实读） | 各决策可依不同信息变量，`participating in a common payoff as a result of their joint decision`；`no conflicts of interest between the members of the group` |
| 作者边界（p.857） | 不同先验等意见分歧 `cannot be handled in this context`，会带来与利益冲突相同的形式困难；共同目标不是正文已经解决的结论 |
| 作者边界（p.858，主会话续读） | 本文研究给定信息结构的最佳使用，即 `the best decision functions`；不是直接解决给各成员分配何种信息的整个组织设计问题。大部分分析二次支付，部分结论另加正态分布等条件；未验数学证明，不作一般通信成本最优定理 |

抽取中间物 `radner-cv.xml`（pdftohtml -xml）SHA-256 `4815ba676eeaf7de32aaa0071d0f870effc7c6993c7ef23a361d874d2e062b2f`。

## 失败与取件记录（+0800）

| 时刻 | 动作 | 结果 |
|---|---|---|
| 18:58 | 首轮 curl 三入口（默认沙箱） | 全部 000；`curl -v` 报 `failed to open socket: Operation not permitted`；未绕路、未请授权 |
| 19:00 | 父会话取件（见 `official-followup-fetch-log.json`） | 两目录 200、CV 200；无失败项 |
| 19:02 起 | 本轮只读缓存 | 两目录、CV 与两份正文缓存全读；无联网尝试 |
| 19:06 | 父会话取回 Radner 1962 正文（见 `radner-umass-target-fetch-log.json`） | 200；尺寸 1250627 B 与 SHA 以该 log 为准 |

## 缓存与哈希（`/tmp/wayfinder-03-tms-radner-20261015/`）

| 文件 | SHA-256 |
|---|---|
| `mit-curhan-readings.html`（首批） | `652555b954d190c81e6846b7c6a21a130c1a645b7a8328f60dd47bd14e5fb9ef` |
| `radner-index.html`（首批） | `f10eea17b0058bb7d0d06639bf7b5f8e60e0261773f301d52c62c56cf5e0e253` |
| `mit-Group_Dynamics.html` | `a2f70a240d7f7301af32c8a9215a7404f28163f1b568032576c278c4c9a0f672` |
| `mit-Group_Performance.html` | `f411de2b74eba7f8f76dba0dac9fc0e8281dc84e5231d56d4c31e6ffbffe4fa9` |
| `radner-cv.pdf` | `b756e91cfa67f5a57a2e7026724d2980cb27918fd7f89990d237521c1a494391` |
| `official-followup-fetch-log.json` | `6611278eee1667d7dac709178ed2075349599cd2f9958b80e9dedd18281ece72` |
| `mit-liang-moreland-argote-1995.pdf`（父会话取件） | `ca05ba85f28c3b63e4553dc68c918d5fd5350df3956996e29325abcc7481d50b` |
| `official-pdf-followup-log.json` | `bd4b7c62784bac7ddf7912263a5525628e68de27e45c3da49df61b892eb6e480` |
| `radner-team-1962.pdf`（父会话取件） | `0b14b44c3c9e52dfbfbcbdd698f9b78f14558b439f61e45b0bf2ee29918bf53b` |
| `radner-umass-target-fetch-log.json` | `f7568f08ed5073c6e59af8507a6c8a21026897f118d34b2202e2507692fbf1b5` |

## 剩余缺口

- W1：`required_reading/` 子目录未展开，其中内容未知；1995 文仅读摘要与讨论页（p.384、391、392），方法与结果表未逐项核。
- W2：只核 p.857-858 的问题、假设与范围；其余页和数学证明未核。
- 经典直读仍缺：Wegner 1987 不在本轮入口内；Radner 1962 已到假设层直读，未及全文。

## 工作记录

- 本轮核对：19:02:58 至 19:10（首轮 18:58:11 起算，整体在 20 分钟硬界内）。两份正文均为扫描件，
  本会话按 150 dpi 页图实读（Liang p.384、391、392；Radner p.857）；未提取实验数字或统计值。
- 工具：rg、od、pdftohtml、pdftoppm、pdfinfo、python3、sha256sum、cp、date；本子阶段无网络、无额外模型试验、无 DSH、无依赖安装。
- 仓库写面仅本件（重写自首版，未新增别件）；未改报告、旧补件、handoff、票与 Git；未触 `~/.dsh`、部署与配置。
- 会话模型路由、session_id、token 用量未计量，保持未知；不报节省。

## 主会话验收

- 两份正文 SHA 独立复算一致；回读 Liang p.384/391/392 与 Radner p.857-858 页图，纠正 Liang 题录及 Radner 尺寸／SHA 的早前误记。
- Liang 的实验结果只作作者报告，未复算统计；流动损害保留为转引与推测。Radner 只支持列明假设和给定信息结构的问题范围，不代证 1972 全书或 1993 论文。
- 无重新派发；原文回读与语义纠正为实际验收工作，主动工时和 token 未计量。

## 原关闭项覆盖

| 原关闭项 | 本件范围 |
|---|---|
| 每条机制与边界 | W1 为后续作者的实验报告及局限，W2 为原作假设与问题范围；不代证旧书、原章或全篇定理 |
| 四路计数、借用与整票关闭 | 不改既有计数，未新增 LLM 借用样本；所列缺口保持，整票按 S4 验收 |
