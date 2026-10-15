# 补核：Burns & Stalker、Lawrence & Lorsch、Thompson 与矩阵条目的新学术内容入口（第五批）

所属票：[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)。
派发与验收规则见[研究补核与委派](../../research-handoff.md)；基线 `85c0894119d8ea511609395e78910d382a309b99`。
范围限票内五条经典条目的新学术内容入口；不扩研究面、不新增关闭门、不替主会话裁定。
本包量化附项不适用：所读为概念文本、题录与检索结果，无数据集、两臂、分母或不确定性报告。
英文摘录为所读材料的最短原文句；二手转述逐条标注转述方；Pod 迁移与报告推断另标。

## 来源与缓存

| 编号 | 来源与版本（URL、日期） | 实读层级 | 快照（`/tmp/wayfinder-03-classics-20261015/`，2026-10-15） |
|---|---|---|---|
| S1 | Karp, R. (2026). *The Matrix Redux: AI and the Impetus for a Context-Learning Organizational Form*. Harvard Business School Working Paper 26-092，`https://www.hbs.edu/ris/Publication%20Files/26-092_9fffbcdb-a895-4886-8278-2b8bee442a7c.pdf` | 工作稿全文（正文与参考文献，共 455 行抽取文本） | `sources/karp-2026-hbs-wp26092.pdf` SHA-256 `6a23a6d619fa4868333484934ae605f8df6d509fe4c5b3d2364945f0dbaad8d3`；文本抽取 `r7/hbs-matrix.txt` |
| S2 | Bartlett & Ghoshal 1990 摘要，PubMed PMID 10106795（NLM 记录，Harv Bus Rev 1990 Jul-Aug;68(4):138-45），`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=10106795&rettype=abstract&retmode=text` | 出版方摘要全文（非正文） | `sources/pubmed-10106795-bartlett-ghoshal-1990-abstract.txt` SHA-256 `4aaafde8c3b20c47566ae91e0659b24b7fbf36d1e9ac00b3a43fa3506b482307` |
| S3 | Internet Archive 借阅件元数据：`managementofinno0000burn`（1961）、`managementofinno0000burn_m5r1`（1968）、`organizationsina0000thom`、`organizationsina0000jame`（均 1967） | 元数据；正文被撤下（见失败日志） | `sources/ia-metadata-*.json`；`sources/ia-inside-403-managementofinno0000burn.html` SHA-256 `6c274a5ca3bfb685b3f7ea58c76c73db24051d622871bdbcc25c0531779d7758` |
| S4 | PubMed 题名检索 `"Harv Bus Rev"[jour] AND matrix[ti]`（仅 2 命中：11894384、10106795，1978 Davis & Lawrence 未收录） | 题录检索 | `sources/pubmed-esearch-hbr-matrix-title.json` SHA-256 `8635d7f72a4e3861c5141a1114488d1f47371949883c55a982c7bbf118b92efd` |
| S5 | Google Scholar 结果页（五个查询），`scholar.google.com` 2026-10-15 可达 | 检索线索（引用行与二手题名）；直接取件一条成功、三条 429 | `sources/scholar-burns-stalker.html`、`sources/scholar-lawrence-lorsch.html` |
| S6 | Unpaywall API `10.2307/2391211`，2026-10-15 读取 | 无 OA 位置记录 | `sources/unpaywall-10.2307-2391211.json`（`is_oa:false`、`oa_status:closed`、`has_repository_copy:false`） |

## E1 Burns & Stalker：内容未取得（未核验）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 本包未取得合格内容来源；报告 §1.1 的连续谱理想型、样本（英国电子业若干企业）、「匹配而非升级路径」保持未核验 |
| 来源定位 | Internet Archive 1961 初版与 1968 印次借阅件（identifier 见 S3），2026-10-15 采集 |
| 最短摘录 | 不适用。全文与检索接口均被撤下：`_djvu.txt` 403；`fulltext/inside.php` 403，页面文 `Item not available due to issues with the item's content` |
| 证据结论 | 有界检索未取得内容（不是「不存在」）。新入口 IA 借阅件与 Scholar 本轮首试；旧失败入口 Bing/DDG 各复测一次，结果同旧记录后未再追 |
| 作者与项目边界 | 不出内容主张；不得据本包支持或反驳报告 §1.1，也不得把 Pod 连续选形写成两位作者结论 |

## E2 Lawrence & Lorsch：内容未取得（未核验）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 文章与同年书正文均未取得；分化、整合、拟合（fit）与整合者影响力等报告 §1.2 归纳保持未核验 |
| 来源定位 | Unpaywall `10.2307/2391211`（S6）：`oa_status:closed`，无 OA 位置；出版日期 1967-06-01，Administrative Science Quarterly；CrossRef/Scholar 只给题录与引用行 |
| 最短摘录 | 不适用：未取得正文，无最短引文 |
| 证据结论 | 文章无 OA 位置、付费墙未处理（未绕过）；正文未读，保留未知。不据题录升级样本、因果或边界主张 |
| 作者与项目边界 | 不出内容主张；文章与书仍分开记录，书目维持既有批次结论 |

## E3 Thompson：仅二手转述取得一句结构定义（有限支持）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 报告 §1.4 的三类互依（pooled/sequential/reciprocal）、复杂度次序与协调成本主张未取得支撑；仅取得一条对 Thompson (1967) 的定义转述 |
| 来源定位 | S1 正文第 3 页区，抽取文本第 88 行；转述方 Karp (2026)，未给原书页码 |
| 最短摘录 | `Thompson (1967) defines structure as an organization's "internal pattern of relationships, authority, and communication" that directs how value is created and delivered.` |
| 证据结论 | 支持转述层一条结构定义；不覆盖互依类型、协调机制与成本次序。原书 IA 全文同 E1 被撤下（403）；S1 参考文献行确认 `Thompson, J. D. (1967). Organizations in action... McGraw-Hill.` |
| 作者与项目边界 | 引号句按 Karp 转述记录，不得冒充 Thompson 原页码或原文全句；报告的互依层主张维持未核验 |

## E4 Davis & Lawrence 1978：二手页码引句（有限支持）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 取得一条带页码的二手引句与一条病理名；报告 §1.5／§6.8 的具体成立／禁忌条件仍无原件正文页图支持 |
| 来源定位 | S1 正文第 119、156-168 行与参考文献第 415-416 行；转述方 Karp (2026) 引用 `Davis and Lawrence (1978:132)`，其参考文献行记 `Harvard Business Review, 56(3), 131-142` |
| 最短摘录 | `as Davis and Lawrence (1978:132) explain, "some managers report to two bosses rather than the traditional single boss; there is a dual rather than single chain of command."`；另：`Davis and Lawrence (1978) describe this pathology as "decision strangulation."` |
| 证据结论 | 支持转述层：双上司／双链、决策窒息是二手作者归给原作者的语汇。未读原文页图，不得写成已直读或原文全部成立条件；role ambiguity、决策变慢等句为 Karp 的转述与归因 |
| 作者与项目边界 | 转述方评价（含「结构与信息流」归纳）与原作者原话分开；原 HBR 摘要焦点句仍以既有补件为准，本包不覆盖 |

## E5 Bartlett & Ghoshal 1990：摘要全文取得（抽象层，新入口）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 报告 §1.5／§6.8「矩阵作为思维方式、自上而下改结构不足」取得摘要层作者自述支撑 |
| 来源定位 | S2，PubMed PMID 10106795（Harv Bus Rev 1990 Jul-Aug;68(4):138-45），2026-10-15 采集 |
| 最短摘录 | `...adopted elaborate organizational matrices that actually impair their ability to implement sophisticated strategies.`；`Altering formal structure from the top down is a poor way to achieve these goals. It is easier to work from the bottom up, focusing on the attitudes and behavior of individual managers.`；`The goal is to build a matrix of corporate values and priorities in the minds of managers...` |
| 证据结论 | 支持摘要自述立场与技术清单（清晰愿景、培训与职业路径、吸纳个人抱负；企业例 NEC、Philips、Unilever）。限制：摘要级非全文；不能推出完整的成立／禁忌条件 |
| 作者与项目边界 | 摘要为作者／出版方自述，可引但其上限为摘要；PubMed 作者行拼写 `Barlett CA` 与原刊 Bartlett 不一致，按原样记录。报告若写「管理能力比结构更重要」须以摘要为上限 |

## 原关闭项覆盖

| 原关闭项 | 本包结果 |
|---|---|
| 每条的边界条件 | E5 摘要层作者自述；E3/E4 为明确标注的二手转述与二手页码引句；E1/E2 内容未取得，保持未核验 |
| 至少三条带出处的设计警告 | 本包不新增已核警告；「决策窒息」为二手转述，采纳与否留主会话 |
| 四路各至少五条经典出处 | 本包不改变计数；Burns & Stalker、Lawrence & Lorsch、Thompson 原作正文仍缺 |
| LLM 借用与修辞区分 | 范围外，未处理 |

## 剩余缺口与失败入口日志

- IA 两书内容同时撤下：`managementofinno0000burn`、`organizationsina0000thom`、`organizationsina0000jame`；`_djvu.txt` 与 `fulltext/inside.php` 均 403（`Item not available due to issues with the item's content`），2026-10-15 实测，未绕。
- 检索端现状：Bing 返回本土化无关结果；Google `gbv=1` 空结果壳；DuckDuckGo／Yahoo 连接失败；Mojeek 403；Startpage／Brave 连接失败；Open Library search-inside 人工验证；BASE／Scholar Archive Anubis 验证；HathiTrust 403；均未绕。
- 新入口：Google Scholar 本轮可达（五查询），给引用行与二手题名；直接取件三条 429（sun.ac.za、dspace.mit.edu、ecommons.cornell.edu）。OpenAlex 带 `mailto` 可用但突发 429；Semantic Scholar 429。
- 未完成：Burns & Stalker、Lawrence & Lorsch、Thompson 原作正文与全部条件；E4 原文页图；E5 全文。1978 D&L 在 PubMed 题名检索未收录，不能按 PubMed 补摘要。

## 工作记录

- 起止：2026-10-15 17:14:49 +0800 开始（读件与检索）；18:45 +0800 落盘。逐次网络取件经工具授权等待，等待时长未逐项计量。
- 模型标识未知（环境未暴露）；session_id `01a13ecc-ac44-7323-97a0-a92f877ab9d1`；工具模式为原生协作子代理（Codex 子会话），非 DSH Delegate；未调用本机 DSH。
- token 用量未计量；无定向返工；不报净节省。量化复算对象无，本包不做实验复现。
- 工具：curl、python3、pdftotext、sha256sum；无后台下载、无依赖安装、无论文代码或基准、无模型试验。
- 写面仅本新件；下载与快照全部位于 `/tmp/wayfinder-03-classics-20261015/`；未改报告、旧补件、handoff、票、地图、Git 或运行面；未读写 `~/.dsh` 或部署配置。
- 主会话回读 Karp 工作稿封面、定义与病理段及 PubMed 全摘要，复算两份 SHA 一致。Karp 仍属讨论用工作稿，E3 不覆盖互依类型，E4 不作经典直读，E5 不作全文；本包不改变四路最低计数或 S4。主动核验工时与 token 未计量。
