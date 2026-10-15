# 03 协调续核：BDI 承诺、可调自主性、市场均衡与共享计划（2026-10-15）

本件是[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)工作包「经典内容核验」协调路的独立续包，按[研究补核与委派](../../research-handoff.md)只交原文提取、作者边界与缺口；理论迁移、引用强度与关票由主会话处理。范围限派单五条，不重复已交的 Smith、Erman、Hewitt、Cohen & Levesque 与 ADOPT 二手条目。C5 保留首包未取 FA/C 的阶段结果；后续已取得的正文与验收见[FA/C 续核](03-fac-author-followup-20261015.md)。

- 角色与模型：父会话原生子代理，无 DSH、无嵌套代理、无真实运行面写入；实际模型由父会话继承、标识未记录，不记作 ds4.1；工具模式为联网 `curl`（经用户批准）。session_id 与 token 用量未知。
- 起止：2026-10-15 18:21:10 → 18:43:55（+08:00）。17:15:46 首条命令因沙箱网络拒绝失败，不计入采集窗口。本包约 23 分钟，超 20 分钟界约 3 分钟，用于三次下载重试；超界部分只含重试，无未交完却标完成的条目。
- 基线 commit `85c0894119d8ea511609395e78910d382a309b99`，分支 `research/org-v3-theory-20261015`；仓库唯一写面为本件。下载目录 `/tmp/wayfinder-03-coordination-20261015/`；未安装依赖、未运行论文代码或实验、未写 `~/.dsh`／部署／配置。

## 来源与快照

| 来源 | 题录与入口 | 实读层级 | 本地快照与 SHA-256 |
|---|---|---|---|
| Rao & Georgeff 1995 | "BDI Agents: From Theory to Practice", ICMAS-95 会议论文集（AAAI Press），印刷 pp.312-319；官方副本 `https://cdn.aaai.org/ICMAS/1995/ICMAS95-042.pdf` | 全文 8 页扫描 OCR；承诺策略、原假设、解释器与作者边界段已读，形式语义全篇未逐句通读 | `aaai-icmas95-042.pdf`；`5c9cfa164702034a0a32e58169632947ada2ce967543065ca545a9341d87b60d` |
| Scerri, Pynadath & Tambe 2002 | "Towards Adjustable Autonomy for the Real World", *JAIR* 17:171-228, DOI 10.1613/jair.1037；已刊版 `https://jair.org/index.php/jair/article/download/10312/24625`；预印本 arXiv:1106.4573 | 已刊版全文 58 页读取；转移策略定义、原假设与成本函数已核，实验与实例化未复现 | `scerri-jair.pdf`；`03eb9f7d7fa2fd671222030c07758b5e68af0da4c20b913251bc06163403c458`；另存 `scerri-arxiv-1106.4573.pdf`，`3cf19ba18fcffab8a4356e709977e147b68fca753223fdb255beb1ddb75a58d6`（两版本未逐页比对） |
| Wellman 1993 | "A Market-Oriented Programming Environment and its Application to Distributed Multicommodity Flow Problems", *JAIR* 1:1-23, DOI 10.1613/jair.2；已刊版 `https://www.jair.org/index.php/jair/article/download/10106/23927` | 全文 23 页读取；均衡机制、价格假设、收敛限制与 §5 限制已核，数学未重算 | `wellman-jair.pdf`；`5b6725b2e9ca47fafea18c2a02dbd1c47ee0abebedc988fec8ab43d5e7ca499d` |
| Grosz & Kraus 1996 | "Collaborative plans for complex group action", *Artificial Intelligence* 86(2):269-357, DOI 10.1016/0004-3702(95)00103-4；Harvard DASH 机构存档副本 `http://nrs.harvard.edu/urn-3:HUL.InstRepos:2562070`（下载入口 `https://dash.harvard.edu/bitstreams/7312037c-4ba2-6bd4-e053-0100007fdf3b/download`） | PDF 实为 86 页，首页注明发表于 1996 年该刊，不是刊页 269-357 的逐页复制；图 1、FSP、能力假设与 §7 边界已核，模态公理未逐符号核 | `grosz-harvard.pdf`；`3aa8820aff33e5b70f435129de5e670b7e6923cff0d85cddc185c1a9f3e1ee91` |
| Lesser & Corkill 1981 | "Functionally Accurate, Cooperative Distributed Systems", *IEEE Trans. SMC* 11(1):81-96, DOI 10.1109/TSMC.1981.4308581 | 未取得正文，零内容主张；书目记录经 Crossref 检索修正 | 无快照 |

## C1 Rao & Georgeff 1995：承诺条件与终止条件可分离，策略由使用者选

- 核心机制：BDI 用承诺平衡反应性与目标导向；承诺由**承诺条件**与**终止条件**两部分构成，承诺条件只约束意图（"we restrict the commitment condition to intentions"，p.316）。
- 三类策略（p.316）分别不容许冲突的信念/欲望变化、容许信念变化并放弃承诺、容许信念和欲望变化并放弃承诺。作者明说 "we allow the user to tailor them according to the application"，没有选定普遍最优策略。
- 实现假设（p.316）包括原子事件、事后识别、原子动作与全局事件队列及 BDI 数据结构。解释器循环在该页丢弃成功与不可能的态度（`drop-successful-attitudes()`、`drop-impossible-attitudes()`）。
- 边界与限制：p.315 不要求唯一正确的 BDI 公理化；p.316 承认逻辑闭合的抽象架构涉及不可计算的证明过程，尚未说明如何满足实时需求。扫描 OCR 的字距和字母错误已由主会话按 p.316 页图核对，引用不再依赖文义猜改。
- 量化附项：不适用（无实验数字）。

## C2 Scerri 等 2002：转移策略是带成本的条件动作序列，不是二选一开关

- 核心机制（pp.172-173）：控制转移策略是 `a pre-defined, conditional sequence`，包含转移决策控制权与变更预设团队协调约束两类动作。作者批评先前 AA 工作 `use rigid one-shot transfers of control` 并 `ignore costs`（p.171），用 MDP 计算策略期望效用（pp.173-174）。
- 转移假设（p.175）：接收方的响应时刻、决策质量没有保证，`does not have any guarantee on the exact time of response or exact quality of the decision`；用户还可能不响应或不知道已获得控制权。
- 成本模型（p.183）：等待成本建模团队等待裁决期间的不协调，假设截止时点后不再累积、此前非递减；协调变更动作 D 有固定成本 `Dcost`，并改变后续等待成本的时间参数。无 D 动作时，给定实体在 t 时决策的效用为质量减等待成本；整个策略效用还须按响应时间分布积分。
- 边界与限制：p.182 明列四类输入，分别是决策质量、响应时间概率、等待成本、协调变更的成本与收益。p.175 本文主要关注时间协调约束。原文 p.174 报告 E-Elves 中自主性与成本的关系，非本包独立复现；参数估计和实例化过程未核，不能把只比较质量与等待成本当作完整策略计算。
- 量化附项：实验设置与数字未提取；无独立复算。

## C3 Wellman 1993：计算均衡机制与其证明边界

- 机制：把分布式规划实现为人工经济，用价格机制求竞争均衡；WALRAS 是"decentralized relaxation method, akin to the mechanism of tatonnement"（§2.2，p.5），智能体对价格提交需求对应关系（§2.3）。
- 价格与行为假设（§2.1，pp.3-4）：竞争行为 `takes prices as given, neglecting any impact of its own behavior on prices`；该表述假定完全竞争，价格是各 agent 约束优化问题的参数。
- 均衡性质：在连续性、单调性、凹性等"classical"假设下竞争均衡存在，且两福利定理成立（§2.1，p.4）。收敛限制："It is well known, however, that tatonnement processes do not converge to equilibrium in general (Scarf, 1984)"（p.5）；稳定性条件为 gross substitutability。
- 作者自述限制（§5，p.17）："One serious limitation of walras is the assumption that agents act competitively"；拥有市场力的智能体若忽视自身对价格的影响会损失效用；均衡与效率还"depends critically on the assumption of nonincreasing returns to scale"；策略互动与规模报酬递增会损害市场机制并"inhibit decentralization"。
- 与本报告旧条目的区分：原报告 §4.4 只把市场均衡记为分布式协调的计算机制。本文把机制设计列为框架出处（§1，引用 Hurwicz 1977、Reiter 1986），但**没有证明激励相容**，也没有验证 Vickrey/Groves/Myerson 的原作结论：价格接受假设把策略行为排除在模型之外，均衡是配置计算的性质，不是真实报真话的保证。主会话的 Myerson 2007 条与本条范围分开。
- 量化附项：均衡计算在 multicommodity flow 的运行未复现；无独立数字。

## C4 Grosz & Kraus 1996：共享计划的协作条件与能力假设

- 协作计划四个要件（图 1）：互相相信一份（部分）recipe；每个成员有"组行动被执行"的意图；每个成员有"协作者完成其子动作"的意图；子动作有个人或协作计划。
- FSP 定义（图 18，§6.2）：第 0 条要求全组互相相信所有成员承诺组行动成功；第 1 条要求互相相信 recipe 与约束；每个子动作按核心/外包两类展开，核心情形要求某成员被承诺且有能力、全组知道该承诺与能力，并且"the full group form a commitment to the ability of the agent or subgroup to carry out"该子动作（Clauses 2a4/2b3，DASH 版 p.36）。
- 能力假设的自我修正（§4.3.1）："we adopt the strong position that an agent must believe it can successfully perform any action it intends to do... this stance is too strong... would be better served by a probabilistic approach to the modeling of ability, but we have not identified a suitable computational model."定义尚未达到实践可计算层。
- 边界（§2、§7）：公理系统的可靠性/完备性所需约束"requires further study"；形式化"not intended to be directly implemented"，而是作为设计规格；不引入独立联合意图态度，SharedPlan 归约为个人意图加信念与互相信念；Bratman 的"相互支持承诺"经由 intentions-that 与帮助行为公理实现，对他人行动的持续监控"beyond the scope of this paper"。
- 量化附项：不适用（概念形式化）。

## C5 Lesser & Corkill 1981：正文未核（零内容主张）

- 书目修正：派单与开放平台上曾出现的 DOI `10.1109/TSMC.1981.4308633` 经 Crossref 解析为同刊 11 卷 2 期目录（`[Table of contents]`, p.c1-c1），不是本文；Crossref 检索给出本文 DOI `10.1109/TSMC.1981.4308581`，*IEEE Trans. SMC* 11(1):81-96；另有 1988 *Readings in Distributed Artificial Intelligence* 重印 pp.295-310。
- 取文尝试（2026-10-15）：Unpaywall 对修正后 DOI 返回 `is_oa=false`、0 个 OA 位置；Semantic Scholar 对旧 DOI 返回 404；Bing RSS 命中与主题无关的中文页面。IEEE 付费墙未尝试绕过（遵守访问纪律）。
- 结果：FA/C 的"局部视图、部分结果、功能准确"机制仍无一手或权威二手正文支撑，原报告 §4.10 的未核标记保持；本包不为它写任何机制或边界描述。

## 原关闭项覆盖

| 原关闭项 | 本包覆盖 | 核验层级 |
|---|---|---|
| ①四路各至少五条经典出处（内容核验） | 协调路新增 4 篇正文读取（Rao 1995、Scerri 等 2002、Wellman 1993、Grosz & Kraus 1996）；Lesser & Corkill 1981 未核 | 4 篇全文级（所引段落）；1 篇零内容；协调路总计数与关票由主会话判定 |
| ②每条给边界条件 | C1 无最优性/策略自选；C2 四类输入、转移无响应保证；C3 竞争假设、市场力、报酬递增、收敛不保证；C4 能力假设过强、完备性待研究、监控超范围 | 均为作者自述 |
| ③借用与修辞区分 | 未覆盖（本包不核 LLM 文献） | 未核 |
| ④交付物落盘含来源表与盲区 | 本件含来源表、实读层级、失败入口与缺口 | 部分 |

## 剩余缺口与失败入口

- Lesser & Corkill 1981 正文与任何权威二手均未取得；若要内容层覆盖，需在新条件下选作者回顾（如 Lesser, "A retrospective view of FA/C distributed problem solving", *IEEE Trans. SMC* 1991）或可定位的机构镜像，本包未启动。
- Rao 1995 的 p.316 所引策略与实现假设已由主会话按页图核；KD45/可能性语义的形式细节与其余段落未逐句读。
- Scerri 等 2002 的已刊版与 arXiv 预印本未比对；E-Elves 实验数字与实例化未复现。
- Wellman 1993 的一般均衡数学未重算；WALRAS 在 multicommodity flow 的实际运行未复现；本包不涉及 Vickrey/Groves/Myerson 原作。
- Grosz & Kraus 1996 的 DASH 副本为 86 页，使用自分页，不与期刊 269-357 分页混用；逐字版本一致性与附录 B 完整形式定义未核，1999 年后续文本未读。
- 失败入口：Unpaywall（Lesser 修正 DOI，无 OA）、Semantic Scholar（旧 DOI 404，全程另有 429）、OpenAlex（后续请求持续 429）、Harvard DASH 直链曾 429（改走 `/server/api/core/bitstreams/<uuid>/content` 成功 200）、ScienceDirect pdfft 403（HTML 挑战页，未绕过）、Bing RSS 与 DuckDuckGo lite 检索不可用。

## 执行记录

- 采集窗口 18:21:10 → 18:43:55（+08:00）；定向返工 0 次；session_id、token、主会话验收工时未知；没有同任务本地基线，不报净节省。
- 本包只新增本补核件；未改报告、旧补核件、票面、地图或 Git，未运行测试、探针、依赖安装或模型实验。
- 主会话验收回读四篇所引原页，复算四份 SHA；另看 Rao p.316 与 Scerri p.183 页图。纠正 DASH 页数/版本层级、补回响应概率输入并缩短引文，无重新派发。核验主动工时与 token 未计量。
