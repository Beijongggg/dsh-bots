# 补核：autopoiesis 定义与组织条目边界（第四批）

所属票：[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)。
派发与验收规则见[研究补核与委派](../../research-handoff.md)；基线 `3afaa1676ed89bf848af725adf83b0c3a7a5289b`。
派发配置为 `opencode-go/deepseek-v4.1-flash`、effort `max`、`fork_turns=none` 的原生子代理，非 DSH Delegate。
范围限原清单三条目的新学术入口：T1/T2 autopoiesis、T3 Langlois 模块化、T4 Lawrence & Lorsch 分化与整合。
本包四条内容主张加一条记录项，共五条，不扩理论清单。量化附项全部不适用：所读均为概念文本，
无数据集、两臂、分母或不确定性报告。英文摘录为最短原文句；中文概括与 Pod 迁移推断另行标注。

## 来源与缓存

| 编号 | 来源与版本（URL、日期） | 实读层级 | 缓存（`/tmp/org-v3-w4-03-20261014/`，2026-10-14 采集） |
|---|---|---|---|
| S1 | Di Paolo, E. A. (2005). "Autopoiesis, adaptivity, teleology, agency", *Phenomenology and the Cognitive Sciences* 4:429-452, DOI 10.1007/s11097-005-9002-y；作者自存已刊版 PDF，`https://ezequieldipaolo.net/wp-content/uploads/2011/10/autopoiesis_teleology_2005.pdf` | 全文，刊出版本（首页含卷期、DOI、Springer 标记） | `dipaolo-2005.pdf` SHA-256 `576e825142860f3b0fe2585cf43fa5baceab593bf78e08cf79d5c69c733a833b`；文本抽取 `dipaolo.txt` |
| S2 | Langlois, R. N. (1999). "Modularity in Technology, Organization, and Society", University of Connecticut, Department of Economics Working Paper 1999-05, August 1999；`https://media.economics.uconn.edu/working/1999-05.pdf` | 全文，作者机构公开稿 | `langlois-1999-05.pdf` SHA-256 `8a46889ae13e57330e6aa4fca393233a1c701f1979b145b2b77656a5a94d16ff`；文本抽取 `langlois.txt` |
| S3 | 版本链元数据：SSRN 2000 `10.2139/ssrn.204089`；JEBO 2002 "Modularity in technology and organization", DOI `10.1016/S0167-2681(02)00056-2`（OpenAlex，前者标 OA、后者非 OA，均未读正文） | 元数据，非内容 | `oa-langlois-jebo.json` SHA-256 `b1c4dfbfc56e480ce453baa355acacbb6234d428ebc9e643f61dd06bfc2fe8ca` |
| S4 | Lawrence & Lorsch 1967 文章元数据（DOI `10.2307/2391211`）；同年书仅沿用原报告书目，未新增核实 | 元数据与待核书目，非内容 | `oa-ll2.json` SHA-256 `8ce79e1292357dde4e7739071821ac67c7bee405284d337f3e522935e4b8338f`；书书目见报告 §1.2 |
| S5 | Di Paolo 2005 OpenAlex 记录（DOI 核实） | 元数据 | `oa-dipaolo.json` SHA-256 `87f31590407546be23dbfb3b5d7162ebe8f79522e88d8e4acb039edb24d9f3fb`；figshare 记录 `figshare-api.json` SHA-256 `444e3d9a527105c2daa617c32d9e1ce620fd5a194575cd3ffca853392c1ca55c` |

## T1 autopoiesis 定义及其转述链（S1）

| 字段 | 内容 |
|---|---|
| 主张与用途 | Di Paolo 2005 把 autopoiesis 表述为 Maturana 与 Varela 1970 年代提出的极简生命组织理论；其定义句在文中引自 Weber & Varela 2002 p.115，不是 1974 *BioSystems* 原文；1974 文以 `BioSystems 5: 187-196` 列入参考文献 |
| 来源定位 | `dipaolo.txt` 第 47-49、245-271 行（429、434-435 页区）；参考文献第 1078-1079 行；采集 2026-10-14 |
| 最短摘录 | 定义：`A network of processes of production (synthesis and destruction) of components such that these components: 1. continuously regenerate and realize the network that produces them, and 2. constitute the system as a distinguishable unity in the domain in which they exist`（文内注 Weber and Varela 2002, p. 115）。同文：`a theory of minimal living organization proposed by Maturana and Varela in the 1970s` |
| 证据结论 | 支持：可定位的同行评议文本对 autopoiesis 定义与谱系的转述，定义句出处已定位到 Weber & Varela 2002，可作概念支持入口。限制：该句不是 1974 文措辞；1974 原文仍未直读 |
| 作者与项目边界 | 定义归属为 Di Paolo 对二手来源的引用与前文概括；对 Pod 的迁移是项目推断，本文未讨论软件或 agent 组织 |

## T2 Di Paolo 自述的 autopoiesis 边界（S1，作者评估而非 Maturana/Varela 原话）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 原文定义被作者评为无程度、只含守恒不含主动稳态、结构耦合不改善：`autopoiesis, a concept allowing no degrees, can only entail the more general case of conservation ... and not the special case of active homeostasis`；`structural coupling is a conservative, not an improving process; it admits no possible gradation`；`improving the conditions of self-production is not part of the definition of autopoiesis` |
| 来源定位 | `dipaolo.txt` 第 325-345、369-392、988-989 行（约 436-437、449 页区）；采集 2026-10-14 |
| 最短摘录 | 脚注 8：`As adaptivity is generally not implied by autopoiesis - there may be autopoietic systems that survive without it - so agency is not implied by autopoiesis and adaptivity combined.` 摘要：`its original formulation needs to be elaborated further in order to explain sense-making` |
| 证据结论 | 支持：作者自述的边界是定义外扩展（adaptivity、agency 非定义蕴含）。限制：这是 Di Paolo 对原理论的评注，不是 Maturana/Varela 原话；不可写成作者们自认的全部边界 |
| 原作转述定位 | 脚注 6（约 449-450 页区）：极简模型 `(Varela et al. 1974; ...)` `There is no explicit or emergent monitoring function in such models ... The system tolerates such perturbations, it does not adapt to them.` 这是 Di Paolo 对 1974 文一项主张的转述位置（极简模型无显式监测、容忍而非适应），仍非 1974 原文 |
| 作者与项目边界 | 上述均为 2005 评注；"1974 文只讲容忍不讲适应"按转述方行文记录，不能替 1974 原文背书 |

## T3a Langlois：模块分界与耦合（S2）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 模块化是把系统拆为离散件、经标准接口与架构通信；`I will refer to a set of architecture, interfaces, and standards as a modularization`；完整模块化要求可见设计规则事先固定；缺陷在集成时显现；`loosely coupled means modular but not fully decomposable` |
| 来源定位 | `langlois.txt`（抽取文本行号）第 21-27、366、384-389、512-519、600-601 行；S2 全文，采集 2026-10-14 |
| 最短摘录 | `By breaking up a complex system into discrete pieces - which can then communicate with one another only through standardized interfaces within a standardized architecture...`；`problems with incomplete or imperfect modularization tend to appear only when the modules come together and work poorly as an integrated whole`（句末引 Baldwin and Clark 1997）；`The goal is clearly to find the modularization that minimizes interdependencies and most cleanly decomposes the system.` |
| 证据结论 | 支持：分界由架构、接口、标准与规则定义，模块间依赖最小化是目标；松耦合等于模块化但不完全可分解。限制：动态项目中任务不能预先划分（同文第 531-539 行：`the tasks in an innovative development project cannot be partitioned in advance... the modularization... has to change continually`），分界句不构成一次划分永久有效 |
| 作者与项目边界 | 上述为作者 1999 年工作稿行文；期刊版 2002 未读，版本差异未核；Pod 职责划分仍为应用推断 |

## T3b Langlois：系统级创新与协调成本边界（S2）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 模块化有固定成本，收益依环境：`A well-decomposed modular system must pay a kind of fixed cost that an intertwined system need not pay... a system whose environment never changes may not have to worry much about modularization`；`In a world of change, modularity is generally worth the costs.`；重模块化使既有模块库存不兼容：`systemic innovation comes at a cost`；能否锁定在劣质模块化 `will no doubt depend on the context`；规则流动与过早冻结各有损失；协调需要价格接口之外的信息 |
| 来源定位 | `langlois.txt` 第 388-396、512-515、614-634、665-666、1342-1346 行；S2 全文，采集 2026-10-14 |
| 最短摘录 | `Since a remodularization will render the existing stock of modules incompatible or irrelevant, systemic innovation comes at a cost.`；`If the design rules are in flux, the possibilities for modular innovation and mix-and-match recombination will be limited. On the other hand, freezing the design rules too early may result in an inferior modularization.`；`coordination requires the transmission of information beyond what can be sent through the interface of the price system` |
| 证据结论 | 支持：模块化收益有条件、系统级创新与重划分有成本、协调不完全经价格接口完成。限制：这些都是概念论证与二手案例（个人电脑等），无实验或数据集；`just-embedded`（第 665-666 行）是作者转述 Garud & Jain 建议，非作者实证 |
| 作者与项目边界 | 版本同上（1999 工作稿）；JEBO 2002 与 SSRN 2000 版本差异未核；以任何成本数字或阈值支持 Pod 选形均属推断 |

## T4 Lawrence & Lorsch：两记录分列，正文未取得（S4）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 文章与同年书必须分开记录：文章 Lawrence & Lorsch (1967), "Differentiation and Integration in Complex Organizations", *Administrative Science Quarterly*, DOI 10.2307/2391211；书 Lawrence & Lorsch (1967), *Organization and Environment: Managing Differentiation and Integration*, Boston: Harvard University（报告 §1.2 书目） |
| 来源定位 | OpenAlex 标题检索 `oa-ll2.json`（文章记录 `is_oa` 为 false，无 OA 位置）；采集 2026-10-14 |
| 最短摘录 | 不适用：未取得正文，只有元数据与报告书目 |
| 证据结论 | 未核验：正文不可达，分化/整合、样本、不确定性、整合条件均不得据此写成普遍定律 |
| 作者与项目边界 | 本包不提出该条目的内容主张；文章或书任一正文本轮都未直读 |

## 原关闭项覆盖

| 原关闭项 | 本包结果 |
|---|---|
| 控制路第 5 项（autopoiesis，原判据允许权威二手） | 主会话按 T1/T2 的可定位学术转述计入，控制路达 5/5；1974 原文仍未直读。定义引 Weber & Varela 2002 p.115，脚注 6 另转述 1974 极简模型；两者不冒充同一原句 |
| 组织路 Langlois 边界 | 1999 UConn 作者公开稿全文已读，模块分界/耦合/系统级创新/协调成本边界取得原文句；JEBO 2002 出版版为元数据，差异未核 |
| 组织路 Lawrence & Lorsch 边界 | 文章与书分列；文章 DOI 与期刊元数据核实；正文未取得，原有条件、样本与不确定性缺口不变 |
| 至少三条带出处的设计警告 | 不增删原清单；T2/T3 新增可引用句，设计迁移含义仍留主会话 |
| LLM 借用与修辞区分 | 范围外，未处理 |

## 剩余缺口与访问记录

- 1974 *BioSystems* 5(4):187-196 原文仍未直读；本包取得的是 2005 二手定位，不冒充原文。
- JEBO 2002 出版版正文未读（付费墙未处理、未绕挑战）；1999 工作稿与 2000 SSRN、2002 版之间的差异未核。
- Lawrence & Lorsch 文章与书正文均未取得；SAGE/JSTOR 类入口本轮未尝试绕过。
- 本轮实测失败或不可用入口（未绕挑战）：link.springer.com DOI 页返回 JS 客户端挑战页（`doi-dipaolo.html`，3038 B）；`sussex.figshare.com` 的 OpenAlex green OA 指针实为 metadata-only（API `is_metadata_record=true`、`files=[]`、`size=0`，页面 202 空体），不载全文；`richard-langlois.media.uconn.edu` HTTPS 证书链错误、`-k` 后 HTTP 504；`lite.duckduckgo.com` 202 空壳，`bing.com` RSS 跳 `cn.bing.com` 返回无关结果，均未作来源；`addi.ehu.es/simple-search` 404 未再追。
- 旧失败入口（ScienceDirect、UChile 单页题录、西语专著二手）本轮未重复抓取。

## 工作记录

- 起止：2026-10-14 18:31:39 +0800（开始读取）至 18:36:44 +0800（落盘核对），20 分钟硬界内。
  工具：curl、python3、pdftotext、sha256sum；
  无后台下载、无依赖安装、无论文代码或基准、无模型试验；未调用本机 DSH，未读写 `~/.dsh` 或部署。
- session_id、token 用量、主会话主动核验工时未知；无重新派发，主会话校正来源层级与计项口径；不报净节省；无量化复算对象。
- 采集方仓库写面仅本新件；未改旧补件、票、报告、handoff、地图、Git、index 或配置；`.tmp/` 未读改；
  缓存全部位于 `/tmp/org-v3-w4-03-20261014/`（上述 SHA-256 对应原件）。
