# 组织理论、复杂系统与多智能体协调的概念谱系

- 日期：**2026-10-13**
- 票据：[组织理论、复杂系统与控制论（纯理念面）](../issues/03-research-organization-theory-and-concepts.md)。
- 采集性质：建图侦察加 2026-10-13/14 有界补核。研究票仍开放; 已核经典机制与边界、三篇 LLM
  全文样本见下表。其余题录、摘要与未核条目保留原层级, 取得全文不等于逐条内容已核。
- 引用前读票面 `Answer` 及本节覆盖表; 核对具体引文、页码、版本、哈希时进入相应补核件。
  本批纠正过强推断, 不裁定理论迁移、形态用词或切换节奏。
- 主题：为「**按任务相变、塌缩到该任务高效形态**」的 Pod 动态组织设想，检索可借用的理论，
  以及**警示该设想**的理论。本文件只做概念层，不做工程实现选型。
- 标注约定：
  - `[未经一手来源核验]`＝本轮**未**落到一手来源，仅凭模型知识写出，引用前必须回核；
  - `INFERENCE:`＝从事实出发的推断，不是文献主张；
  - 引用方式：正文**就地**给 DOI 或 arXiv 编号（如 `10.1287/inte.4.3.28`、`arXiv:2609.38327`），
    §8 是汇总索引与检索端点状态表；
  - 经典理论一律给「作者＋年份＋一手书名／篇名」；凡本轮只经二手途径（百科、课程页、
    综述转述）确认的，就地注明**仅二手核验**。
- 原采集边界：研究会话只写本交付物；未使用当时不可用的搜索工具（web_search 返回 HTTP 402）。
  §7 的端点状态记录原采集条件，不代表后续补核仍不可达。
- 权威性与读取层级分开：原作正文、权威学术二手、百科线索、题录/摘要、未核概念各自标明。
  大学镜像中的原作仍是原作载体; 百科不冒充权威学术二手。
- 阅读路由：核对概念与出处读 §1–§4；检查 LLM 借用线索读 §5；讨论设计假设读 §6；补核前读 §7。

| 路径/工作包 | 已核范围 | 原始定位与保留缺口 |
|---|---|---|
| 组织路径 | Galbraith、Gersick、Hannan & Freeman、Simon、Ostrom 讲座五项；另核 Williamson、Baldwin & Clark 后期文本及 Langlois 1999 工作稿的指定内容 | [经典警告](supplements/03-classic-design-warnings-20261013.md)、[组织余项](supplements/03-org-path-remainder-20261013.md)、[作者边界](supplements/03-author-boundaries-20261014.md)、[第四批边界](supplements/03-autopoiesis-and-org-boundaries-20261014.md)；后期文本不冒充旧著直读，Langlois 2002 正文未读，Ostrom 转引不冒充她的原始结果 |
| 复杂系统 5 项 | BTW 1987、Anderson、Dorigo、Holland 1992、Bettencourt | [复杂系统](supplements/03-complex-systems-sources-20261013.md); Holland 七机制列表及未读页不随全文取得自动升级 |
| 控制论 5/5 项 | Ashby 1956、Wiener 1961 所引内容；Beer、von Foerster 的权威学术二手；autopoiesis 经 Di Paolo 2005 的定义及原作转述定位 | [经典警告](supplements/03-classic-design-warnings-20261013.md)、[控制原文](supplements/03-control-sources-20261013.md)、[控制权威二手](supplements/03-control-authoritative-sources-20261013.md)、[第四批 T1/T2](supplements/03-autopoiesis-and-org-boundaries-20261014.md)；后三项经典原作未直读，2005 评注与经典作者原话分开 |
| 协调路径 5 项 | Smith、Hearsay-II、Hewitt、Cohen & Levesque 四篇所列机制/边界; ADOPT 由 JAIR 综述核验 | [协调原文](supplements/03-coordination-sources-20261013.md)、[ADOPT 权威二手](supplements/03-coordination-gaps-20261013.md); 原作 ADOPT 的精确定理条件仍未知 |
| LLM 借用 3 个全文样本 | MacNet v3、Absorbing State v2、LLM-MR-CNP v1 | [借用核对](supplements/03-llm-classic-borrowing-20261013.md); 不据三样本估计全领域借用比例 |

---

## 0. 结论与证据上限

1. Galbraith 的信息处理成本、Hannan & Freeman 的重组可靠性、Gersick 的期限样本已核到原文。
   它们支持提出成本与边界问题, 不直接给 Pod 的形态选择或切换频率。
2. 经典四路均达到至少五项的最低内容覆盖。控制论的第五项为 Di Paolo 2005 对 autopoiesis
   的权威学术转述，符合原判据允许二手的条件，不冒充 1974 原作直读。其余原条目边界仍待核，
   四路计数满足不等于整票关闭。
3. 三个 LLM 全文样本呈现不同借用方式：MacNet 借标度关系, Absorbing State 建立带近似条件的
   搜索相变模型, CNP 扩展经典协议。CNP 未完成组件匹配消融, LLM 独立收益仍不能据此认定。
4. Ashby 的表条件、Wiener 的回路设计边界与 NFL 的均匀平均前提已核。它们都不能直接转换为
   "选择器必然失准"、"无 deadband 必然抖动"或"现实任务分布必须冻结"。
5. 序参量、控制参数、零模型、尺度与度量敏感性可作候选核验面。项目是否沿用"相变"一词由
   下游形态决议处理, 本报告不改名、不制定硬门。
6. 未补读的 LLM 文献仍只作题录/摘要线索。原检索的空白受入口和查询范围限制, 不代表全领域没有借用。

---

## 1. 组织理论：从权变到多中心

本节已核 Galbraith、Gersick、Simon、Ostrom 讲座的下列机制与边界, 另在 §6.2 核 Hannan & Freeman。
2026-10-14 补读原列作者 Williamson 2009 讲座与 Baldwin & Clark 2006 章节，核验范围见各条。
第四批另核 Langlois 1999 工作稿；Lawrence & Lorsch 只新增文章元数据，未取得文章或书的正文。
其余条目仍为待回原文的概念整理; 不因邻近条目补核而升级。迁移到 agent 组织一律另标 INFERENCE。

### 1.1 权变理论：Burns & Stalker 的机械式／有机式

- **核心主张**：不存在普遍最优的组织形式；形式须与**环境变化率**匹配。稳定环境适配**机械式**
  （mechanistic：职能高度分化、纵向层级、角色精确界定、知识集中在顶层、纵向交互）；变动环境适配
  **有机式**（organic：任务持续重定义、控制与沟通呈网络、知识散布全网、横向沟通、承诺于整体目标）。
- **一手**：Burns, T. & Stalker, G. M. (1961). *The Management of Innovation*. London: Tavistock
  （本轮**仅二手核验**：Wikipedia "Contingency theory" 参考文献行给出该条；Crossref 命中的是
  1994 年 Oxford University Press 重版，DOI 记录一致）。
- **边界整理，原文待核**：机械式与有机式是**两极连续谱上的理想型**，不是二选一标签；
  原著基于英国电子业若干企业的比较案例，样本小、行业单一（细节 `[未经一手来源核验]`）；有机式
  并非"更好"，其代价是角色模糊、控制力弱、对成员自主性与承诺要求高。**该理论给出的是"匹配"，
  不是"升级路径"。**
- 2026-10-14 续查仍未取得合格内容来源，上述边界保持未核验。访问失败不支持空结果或反证，见
  [作者边界 E1](supplements/03-author-boundaries-20261014.md#e1-burns--stalker)。

### 1.2 Lawrence & Lorsch：分化与整合

- **待核概念整理**：组织须**同时**做到分化（differentiation：各子单元在结构、时间视野、目标取向、
  人际导向上产生差异）与整合（integration：跨单元协作的质量）；绩效取决于二者与**各子环境不确定性**
  的匹配，而非某一维度的极值。
- **一手**：Lawrence, P. R. & Lorsch, J. W. (1967). *Organization and Environment: Managing
  Differentiation and Integration*. Boston: Harvard University（本轮**仅二手核验**：Wikipedia
  "Contingency theory" 参考文献行）。
- **边界整理，原文待核**：分化越高，整合成本越高——理论**同时**给出「必须分化」与「分化的
  代价」，并不承诺"整合越多越好"；成功企业的整合装置与所需分化程度**相称**，且整合者靠专业能力
  而非正式职权获得影响力（细节 `[未经一手来源核验]`）。它所断言的是**拟合（fit）**，不是最优点。
- 第四批仅确认同年文章 "Differentiation and Integration in Complex Organizations"，
  *Administrative Science Quarterly*，DOI `10.2307/2391211`。文章与上列书分开，二者正文均未取得，
  不据元数据升级样本、因果或边界主张。见[第四批 T4](supplements/03-autopoiesis-and-org-boundaries-20261014.md)。

### 1.3 Galbraith：信息处理观

- **核心主张**：组织形式的差异可由**信息处理**解释——任务不确定性越高，决策所需信息量越大，而
  认知能力有限（直接承接 Simon 的有限理性），因此设计问题等于把信息处理需求与信息处理能力对齐。
  四种设计策略：① 冗余资源（slack resources）② 自足任务（self-contained tasks）③ 纵向信息
  系统投入 ④ 横向关系（lateral relations）。
- **一手**：Galbraith, J. R. (1974). "Organization Design: An Information Processing View",
  *Interfaces* 4(3):28-36, DOI 10.1287/inte.4.3.28。全文副本已读, 定位与引文见
  [A2](supplements/03-classic-design-warnings-20261013.md)。1973 年书仍未核。
- **已核边界**：p.28 说选择取决于策略的相对成本; p.31 指自足任务损失资源专业化。
  p.36 把四策略的穷尽性和环境中最低成本选择写为假设框架, 同页承认可能有未展开的第五策略。
  因而不能写成已证明的穷尽菜单或 "最小化信息处理负担" 定理, 也不排序其对 Pod 的适用性。

### 1.4 Thompson：互依类型（pooled / sequential / reciprocal）

- **核心主张**：协调成本由**互依结构**决定。**pooled（汇聚式）**：各单元各贡献于整体、彼此无直接
  依赖，靠**标准化**协调；**sequential（顺序式）**：串行流水，靠**计划与排程**协调；**reciprocal
  （互惠式）**：输出互为输入、来回往复，靠**相互调整（mutual adjustment）**协调，成本最高。
  设计含义：在不确定环境下，组织倾向把互惠式互依**局部化进自足单元**，以降低协调负担。
- **一手**：Thompson, J. D. (1967). *Organizations in Action: Social Science Bases of Administrative
  Theory*. New York: McGraw-Hill（本轮 OpenLibrary **书目记录核验**：1967，McGraw-Hill；正文表述
  `[未经一手来源核验]`）。
- **边界整理，原文待核**：三类互依按复杂度**有序**，互惠式最贵；理论推导的方向是**减少**
  互依（缓冲、解耦、局部化）而非无限加强协调；高不确定性下相互调整不可替代，但需要相应支撑条件。
  该类型学是**分析工具**，原著未提供把真实任务干净归类的方法。
- 2026-10-14 续查只有题录／书评及失败入口，复杂度次序、成本与归类条件仍未核验，见
  [作者边界 E2](supplements/03-author-boundaries-20261014.md#e2-thompson)。

### 1.5 矩阵组织及其已知病理

- **待核概念**：双线汇报如何处理职能与项目等两个维度的压力，以及权限、问责和协调成本。
  具体成立／禁忌条件尚无已读正文支持，不把这些问题写成必要或充分条件。
- **书目与读取范围**：Davis, S. M. & Lawrence, P. R. (1977). *Matrix*. Reading, MA:
  Addison-Wesley，书目仍未核。Bartlett, C. A. & Ghoshal, S. (1990), "Matrix Management:
  Not a Structure, a Frame of Mind"，HBR 官方页已确认 July–August 1990，实读限元数据与
  摘要首段，全文未读。Davis & Lawrence 1978 "Problems of Matrix Organizations" 只读官方摘要。
  定位见[作者边界 E5](supplements/03-author-boundaries-20261014.md#e5-矩阵组织已核书目与未核正文)。
- **摘要支持的范围**：Davis & Lawrence 1978 说一般组织设计可能因设计本身产生问题，不能据此
  把具体矩阵病理全归为结构缺陷或排除执行失误。Sy & Côté 2004，DOI 10.1108/02621710410537056，
  摘要说矩阵有内在问题，并将关注点转向个体情商；这不证明管理能力比结构更重要。
- **仍待核**：双上司与决策瘫痪、资源争夺、问责模糊的具体因果条件，以及协商能力的作用。
  原稿的"文献一致口径"、"仅在……才成立"与"禁忌"不作为已核结论。

### 1.6 模块化：Baldwin & Clark（与 Simon 的近可分解性）

- **已核定义**：Baldwin & Clark 2006 把 architecture、interfaces、tests 纳入模块化设计。
  `modular-in-design` 要求设计可拆分，并由 design rules 而非设计者持续协商来协调；任务拆分
  本身不等于设计模块化。p.189 区分共知规则、相互独立的 hidden modules、集成与测试模块。
- **一手**：Baldwin, C. Y. & Clark, K. B. (2000). *Design Rules, Volume 1: The Power of Modularity*.
  Cambridge, MA: MIT Press（仅书目记录核验，1999/2000，未直读）。内容来源为两位作者 2006 年
  "Modularity in the Design of Complex Engineering Systems"，*Complex Engineered Systems*
  ch.9, pp.175–205，DOI 10.1007/3-540-32834-3_9；实读 pp.180–181、189、199–200，见
  [作者边界 E4](supplements/03-author-boundaries-20261014.md#e4-baldwin--clark-的设计规则与模块化成本)。
  Simon, H. A. (1962). "The Architecture of Complexity", *Proceedings of the American Philosophical
  Society* 106(6):467-482, 已核 p.468/470/471/473/474/475 页图, 见[组织余项 S1-S4](supplements/03-org-path-remainder-20261013.md)；
  Langlois, R. N. (1999), "Modularity in Technology, Organization, and Society"，UConn Working
  Paper 1999-05，August 1999，作者机构公开稿已读。2000 SSRN 与 2002 JEBO 只核元数据，后者
  DOI `10.1016/S0167-2681(02)00056-2`；版本差异未核。定位与哈希见[第四批 T3](supplements/03-autopoiesis-and-org-boundaries-20261014.md)。
- **已核成本边界**：创建／传播规则、实验及测试的费用会抵消模块化价值；重要跨模块依赖须由
  规则处理，依赖密度与可分解性影响成本，接口需处于依赖较稀疏的位置。原文不支持所有系统都
  适合切分，也不支持"没有模块级测试就没有任何收益"或"不行使期权就完全没有价值"。
- **Langlois 已核边界**：模块分界由架构、接口、标准定义，设计规则需事先确定，集成时才可能
  暴露分界缺陷；该段部分转述 Baldwin & Clark 1997。模块化有固定成本，稳定或慢变环境可能
  不值得承担。创新项目的任务可能不能事先划分，重模块化会使旧模块库存不兼容或失效；规则
  流动限制重组创新，过早冻结也可能固化劣质分界，取舍依情境。以上为 1999 工作稿的概念论证，
  不是 agent 实测或切换阈值；价格接口之外的协调需求也不能简化为纯市场与纯层级二选一。
- **Simon 已核部分**：层级指递归子系统, 不等于正式权力树。近可分解指短期近独立、长期只受
  其他部分聚合影响; epsilon 越小符合者越少, 作者同时说自然中此类结构并不少见。制表匠约
  4,000 倍来自 p=.01 的演示假设, 作者明确说数值不可认真采用, 不是实测加速。上述来源均不提供
  LLM 组织模块化的实测收益；Pod 的职责划分、测试责任和重组成本属于应用推断。

### 1.7 间断平衡与组织转型：Tushman & Romanelli、Gersick

- **核心主张**：组织并非连续微调，而是**长收敛期 + 短剧烈重构期**交替：收敛期内惯性累积、框架
  稳定、只做增量；当与环境错位累积到阈值，发生**再定向（reorientation）**—— discontinuous、
  框架破坏式变革。
- **一手**：Tushman, M. L. & Romanelli, E. (1985). "Organizational Evolution: A Metamorphosis Model
  of Convergence and Reorientation", *Research in Organizational Behavior* 7:171–222 `[书目未经一手
  来源核验]`；本轮 Crossref **核验**到同组作者的邻近一手文献：Tushman, Newman & Romanelli (1986).
  "Convergence and Upheaval: Managing the Unsteady Pace of Organizational Evolution", *California
  Management Review*，DOI 10.2307/41165225；Gersick, C. J. G. (1991). "Revolutionary Change Theories:
  A Multilevel Exploration of the Punctuated Equilibrium Paradigm", *Academy of Management Review*
  16(1):10–36，DOI 10.2307/258605（**核验**）；Gersick, C. J. G. (1988). "Time and Transition in Work
  Teams: Toward a New Model of Group Development", *Academy of Management Journal* 31(1):9–41，DOI
  10.2307/256496（**核验**）。
- **Gersick 1988 已核**：8 组来自 6 个组织, 期限 7 天至 6 个月; p.16 观察到首次会面与正式
  截止日之间的日历中点转变。p.36 自限为假设生成、单一分析者、非随机样本, 适用于有过程调整
  余地且受期限约束的组, 模型 expressly provisional。见[经典警告 A1](supplements/03-classic-design-warnings-20261013.md)。
  Tushman/Romanelli 与 Gersick 1991 仍未读正文, 不把 1988 团队观察升级为普遍组织阶段律。
- **迁移假设（INFERENCE）**：可比较事件触发与持续重估的收益和切换成本。人类团队的期限效应即使
  补核成立，也不能直接推出 agent 组织应每里程碑切换一次，更不能把任务间选形等同于任务内变革。

### 1.8 双元性（ambidexterity）

- **核心主张**：组织需同时"把今天的事做对齐、做高效"与"适应明天的变化"，方法是**结构上分离**
  （不同单元、不同文化、不同流程）＋**高层整合**（senior team 同时容纳两套逻辑）。
- **一手**：Duncan, R. B. (1976)（"The Ambidextrous Organization"，收于 Kilmann 等编 *The Management
  of Organization Design*）`[未经一手来源核验]`；Tushman, M. L. & O'Reilly, C. A. (1996).
  "Ambidextrous Organizations: Managing Evolutionary and Revolutionary Change", *California
  Management Review* 38(4):8–30，DOI 10.2307/41165852（Crossref **核验**）；Raisch, S. & Birkinshaw, J.
  (2008). "Organizational Ambidexterity: Antecedents, Outcomes, and Moderators", *Journal of
  Management* 34(4):375–409，DOI 10.1177/0149206308316058（Crossref **核验，摘要原文**：定义
  ambidexterity 为"aligned and efficient in its management of today's business demands while
  simultaneously being adaptive to changes in the environment"，并明确建立"antecedents, moderators,
  and outcomes"模型）；O'Reilly & Tushman (2013) *Academy of Management Perspectives* 27(4):324–338
  `[未经核验]` — 通行结论是双元需要**冗余资源与高层整合能力**、并非普遍有利。
- **边界整理，原文待核**：**调节变量（moderators）**是理论自身的一部分——双元收益依赖环境
  动态性等条件；代价包括资源重复、单元间冲突、身份张力。**"两种形态并存"不是免费的，也不是无条件
  更优的。**

### 1.9 交易成本经济学：市场 vs 层级（Williamson）

- **已核主张**：2009 讲座按交易属性比较可行治理安排，市场与层级并非穷尽清单。资产专用性、
  不完全契约与适应需求影响选择，不是资产专用性越低越好或层级普遍更省的单调结论。
- **一手**：Williamson, O. E. (1975). *Markets and Hierarchies: Analysis and Antitrust Implications*.
  New York: Free Press（OpenLibrary **书目记录核验**：1975，The Free Press）；(1985)《The Economic
  Institutions of Capitalism》`[未经一手来源核验]`；(1971) "The Vertical Integration of Production:
  Market Failure Considerations", *AER* 61(2) `[未经核验]`。
- **内容来源**：Williamson 2009-12-08 Nobel Lecture，"Transaction Cost Economics: The Natural
  Progression"，实读印刷 pp.463–465、468–469，见[作者边界 E3](supplements/03-author-boundaries-20261014.md#e3-williamson-的比较治理边界)。
  作者后期综述不等于 1975/1985 原著直读。
- **已核边界**：p.464 n.11 明说降低资产专用性可能牺牲性能；p.465 明列 hybrid mode。
  pp.468–469 要比较可行、可实施且各有缺陷的治理安排，p.469 把替代安排的实施费用计入预期
  净收益。零交易成本的理想安排不是现实对照。
- **保留缺口**：旧著中"资产专用性／不确定性／频率"三维和具体关系型契约论证未直读。
  2009 讲座未单列 frequency 不构成与旧著矛盾。Pod 按任务选形与阈值仍是应用推断。
  批评仅核标题与出处：Ghoshal, S. & Moran, P. (1996). "Bad for Practice: A Critique of
  the Transaction Cost Theory", *AMR* 21(1)，DOI 10.2307/258627（其论点内容 `[未经一手核验]`）。

### 1.10 团队理论（Marschak & Radner）

- **核心主张**：**团队 = 成员目标函数完全一致、但信息各异**的组织。设计问题因此不是激励问题，而是
  **信息结构问题**：谁观测什么、谁向谁传什么、各自用什么决策规则，使共同收益减去**信息与通信成本**
  最大。
- **一手**：Marschak, J. & Radner, R. (1972). *Economic Theory of Teams*. New Haven: Yale University
  Press `[书目未经一手来源核验]`；Radner, R. (1993). "The Organization of Decentralized Information
  Processing", *Econometrica* 61(5):1109–1146，DOI 10.2307/2951495（Crossref **核验**；内容：把组织
  建模为带延迟与差错的并行信息处理器，推导管理者层级与延迟的取舍 `[内容未经一手核验]`）；
  Bolton, P. & Dewatripont, M. (1994) "The firm as a communication network" *QJE* `[未经核验]`。
- **边界整理，原文待核**：**目标一致（无利益冲突）是核心假设**，也是其最大边界——它不谈机会主义、
  政治与谎报；要求存在定义良好的共同支付函数与已知统计模型；结论是**信息成本与延迟**层面的最优，
  不是动机层面的。INFERENCE：Pod 的共同目标配置使这条线索值得补读，但配置相同不证明实际目标
  或决策规则一致。当前未核验定理前提，也未做正文引用统计，不作可迁移性或引用频度排名（见 §5）。

### 1.11 交互记忆系统（TMS）

- **核心主张**：群体记忆由两部分构成——分散在各成员处的知识 + 关于"**谁知道什么**"的元记忆
  （metamemory）；二者配合使群体可编码、存储、检索超出任何个体的知识。
- **一手**：Wegner, D. M. (1987). "Transactive Memory: A Contemporary Analysis of the Group Mind"，
  收于 Mullen & Goethals 编 *Theories of Group Behavior*，DOI 10.1007/978-1-4612-4634-3_9
  （Crossref **核验**）；Wikipedia "Transactive memory"（本轮二手核验）称该假说**1985 年**首提
  （对应 Wegner 等 1985 年关于亲密关系认知互依的论文），1987 章为系统表述——**两个年份并存，勿混**；
  Lewis, K. (2003). "Measuring transactive memory systems in the field", *Journal of Applied
  Psychology* 88(4):587–604，DOI 10.1037/0021-9010.88.4.587（Crossref **核验**；给出 specialization／
  credibility／coordination 三维量表）。
- **边界整理，原文待核**：TMS 的形成需要**成员长期共处、可观察彼此专长、且有可信的沟通**；
  成员流动会破坏它（该边界为本领域通行表述，`[未经一手来源核验]`）。**⇢ 每任务重组的 agent 团队
  恰恰摧毁 TMS 赖以存在的共享历史**——外部化到任务账本／记忆库的是"记录"，不等于元记忆（INFERENCE）。

### 1.12 Ostrom 的多中心治理

- **核心主张**：多中心指多个形式上独立的决策中心; 是否实际独立或构成互依网络须逐例观察。
  讲座讨论公共资源制度的多中心治理与配置式分析, 不预设所有成功制度都属于同一种形态。
- **一手**：Ostrom, E. (1990). *Governing the Commons: The Evolution of Institutions for Collective
  Action*. Cambridge University Press（OpenLibrary 命中其德译本与 CUP 记录，**书目记录核验**但
  未逐条核验）；Ostrom, E. (2010). "Beyond Markets and States: Polycentric Governance of Complex
  Economic Systems", *American Economic Review* 100(3):641–672，DOI 10.1257/aer.100.3.641（Crossref
  **题录核验**）。本次实际读取 2009-12-08 诺奖讲座版, 正文 pp.408-435、含参考文献 pp.408-444,
  不冒充 AER 分页; 1990 年书仍未核。见[组织余项 O1-O4](supplements/03-org-path-remainder-20261013.md)。
- **讲座已核边界**：p.409 主张配置式分析, 拒绝 one-size-fits-all; p.411 转引 1961 定义,
  多中心之间实际独立还是互依是经验问题。p.422 的八原则更新清单及 pp.422-423 的 100 余研究、
  约三分之二确认均归于 Cox/Arnold/Villamayor-Tomás 2009, 是 Ostrom 转述, 不是她的原始数据。
  她把 design principles 解释为制度存续相关的规律, 并认为 best practices 也许更不易误读。
- **已读摘要的边界**：Ostrom (2007). "A diagnostic approach for going beyond panaceas",
  *PNAS* 104(39)，DOI 10.1073/pnas.0702288104（Crossref **核验，摘要原文**）：该文明确
  "challenge the presumption that scholars can make simple, predictive models of social–ecological
  systems and deduce universal solutions, panaceas"。即：**该理论自身拒绝提供可复制的形态处方**，
  要求对具体系统做诊断；多中心亦有已知失效（跨中心协调失败、搭便车），依赖监督与制裁能力，且
  通常以可界定边界与长期视野为前提。**把"多中心"当作可套用的组织模板，正是该理论明确反对的用法。**

### 对本设计的取舍含义（INFERENCE）

这些理论线索可用于提出问题：任务互依结构是否影响形态收益，协调与迁移需要多少成本，哪些理论
前提在 agent 组织中成立。当前证据不足以把它们写成 Pod 的硬约束，也不能据此否定任务级动态选形。
原文补核与迁移条件留在所属研究票；形态与切换节奏由下游决议选择。

---

## 2. 复杂系统与自组织：相变、临界、涌现

本节已核 BTW 1987、Anderson 1972、Dorigo 1996、Holland 1992、Bettencourt 2007 的下列机制与
作者边界, 见[复杂系统补核](supplements/03-complex-systems-sources-20261013.md)。West、Beggs、Grassé
及其余书籍仍保持题录/摘要或未核状态; 不把五篇的全文载体取得扩展为本节全覆盖。

### 2.1 相变与序参量：形式含义（本节是全篇类比纪律的基准）

- **概念整理，尚未逐条回核**：相变指系统宏观态随**控制参数**（温度、密度、阈值、耦合强度）越过
  **临界值**时发生定性改变；其严格标志是某个**序参量**（order parameter，一个在某一相中为
  零、另一相中非零的宏观量）在临界点**非解析**——不连续，或其导数发散。临界点上**关联长度
  发散**，系统无特征尺度，涨落呈幂律；**普适类**（universality class）意味着临界指数只依赖
  对称性与空间维度，不依赖微观细节 `[教科书知识，本轮未逐条回一手文献]`。
- **样本中的形式边界**：§5.3 的 arXiv:2609.38327v2 对搜索过程作 mean-field 近似, 有限 horizon
  下是 smooth crossover。它处理搜索结果, 不是组织形态本身; 不能把该模型的条件直接当作 Pod 定理。
- **候选核验面（INFERENCE）**：若要提出形式相变主张, 可检查控制参数、可测宏观量、尺度变化与
  零模型。组织形态是否有吸收态需要另建映射, 目前未知。这些是讨论项, 不是本报告新增的命名硬门。

### 2.2 自组织临界性（SOC）

- **核心主张**：Bak, Tang & Wiesenfeld 1987, "Self-Organized Criticality: An Explanation of 1/f
  Noise", *Physical Review Letters* 59(4):381-384, DOI 10.1103/PhysRevLett.59.381。已读 PRL 原作
  副本, 其空间自由度模型通过数值演示达到临界吸引子, 与需调参的平衡临界点区别开; 免 fine tuning
  是该模型的主张, 不是所有耗散系统的定理。1988 PRA 姊妹篇不作为同版分页引用。
- **边界整理，原文待核**：SOC 的关键不是幂律本身，而是**机制**（慢驱动、阈值、分离时间尺度）；
  幂律分布**不可辨识**——大量非临界机制也能产生近幂律，故幂律不是 SOC 的证据。更重要的边界：
  **临界 ≠ 最优**；临界态意味着最大雪崩风险，不是最大效率 `[教科书知识；实证批评见 Jensen 1998
  《Self-Organized Criticality》一书，本轮未核验其书目]`。
- **LLM 侧的正面使用**：arXiv:2609.17419（*World Model Science*，2026-07-12）把 SOC、弱混沌、
  亚稳信念动力学**同时**用于长时程 LLM agent 轨迹，并明确使用 "null models"、"finite-size
  scaling"、"error avalanches"。这些是摘要中的检验线索, 正文尚未核, 不据此评为最规范。

### 2.3 涌现（emergence）

- **已核原文**：Anderson 1972, "More Is Different", *Science* 177(4047):393-396。还原到基本
  定律的能力不等于从它们重建复杂整体的能力。作者明确不主张新尺度服从不同基本定律, 破缺对称
  只是说明性例子, 解释自限为 elementary and incomplete; 不是组织设计的形式定理。
- **形式区分（事实）**：弱涌现＝原则上可由组分＋相互作用**推导**，但只能靠模拟（Bedau 1997
  "Weak Emergence" 提出此区分 `[未经一手来源核验]`）；强涌现＝原则上不可推导，存在哲学争议。
  绝大多数工程语境里的"涌现"是弱涌现，即"我没有预期到"，而不是"原则上不可推出"。
- **误用范式（一手，本轮已由摘要核验其主张方向）**：Schaeffer, Miranda & Koyejo 2023,
  "Are Emergent Abilities of Large Language Models a Mirage?"（arXiv:2304.15004，ID 见 §8 待核）
  论证"涌现能力"可由**度量选择**（不连续／非线性的评分指标）造出，换连续指标即消失。教训：
  **涌现主张必须做度量敏感性检验**，否则它讲的是指标不是系统。
- **LLM 社会的自证式滥用**：arXiv:2606.22203（2026-06-20）直接指出该领域"demonstrations of
  emergent consensus or polarization — with no measurable control parameter, no theory of when
  each regime appears, and no test of whether an outcome is a genuine social dynamic or a model
  artifact"，并提出耦合增益 γ 与效度诊断。这是该摘要对部分演示的作者判断, 正文和覆盖范围未核。

### 2.4 Stigmergy（媒介协调）

- **核心主张**：Grassé 1959, "La reconstruction du nid et les coordinations interindividuelles
  chez *Bellicositermes natalensis* et *Cubitermes* sp. la théorie de la stigmergie", *Insectes
  Sociaux* 6(1):41–80（Crossref 核验篇名／年／刊）：个体通过**改造环境**留下痕迹，痕迹刺激后续
  行动，协调不经直接通信。
- **算法化**：Dorigo, Maniezzo & Colorni 1996, "Ant system: optimization by a colony of cooperating
  agents", *IEEE Trans. SMC-B* 26(1):29-41。所读作者式副本自编 pp.1-13, 已核正反馈、分布式计算、
  贪心构造与停滞描述; 原文用 ρ 表示 persistence, 1-ρ 为 evaporation。
- **已核边界**：作者未推导各情形的最优参数, 而用模拟选择; 部分任务可能输给专用算法, 本篇
  未考察并行实现。扫描默认 β=1 与最终 ant-cycle 的 β=5 分开, 不把参数当通用常量。
  Grassé 原文未读; "共享环境需要哪些读写和遗忘条件"留为迁移问题, 不是由 Dorigo 自动证明。
- **LLM 侧借用**：arXiv:2608.26081（*SwarmWorld*，2026-08-26）让同质 LLM agent 在共享空间中
  无预设角色地留下痕迹并演化出"技术"，明确对照 centralized workflows 与 predefined roles。

### 2.5 耗散结构

- **核心主张**：开放系统在**远离平衡**处，通过持续能量／物质流维持有序结构；非线性与涨落放大
  使新结构在失稳阈值后出现（Prigogine 1967《Introduction to Thermodynamics of Irreversible
  Processes》；Nicolis & Prigogine 1977《Self-Organization in Nonequilibrium Systems》；
  Prigogine & Stengers 1984《Order Out of Chaos》——**三本书目本轮均未经一手来源核验**）。
- **边界（须强调）**：这是**热力学**陈述，前提是开放系统、能量流与可定义的熵产生。将其推广到
  社会／软件系统的是 Prigogine 与 Stengers 的通俗著作，属于**类比推广**而非定理；它**不**蕴含
  "组织必须持续动荡才健康"，也**不**给出任何阈值可测量。用作启发式可以，用作设计律不可以。

### 2.6 复杂适应系统（CAS）

- **已核原文**：Holland 1992, "Complex Adaptive Systems", *Daedalus* 121(1):17-30, 概括
  evolution、aggregate behavior、anticipation 三特征, 讨论内部模型与 building blocks 的组合。
  内部模型可能错误, 预测与结果不符时需要修正; 统一理论仍列为挑战。
- **版本与边界**：七机制列表未在 1992 篇定位, 1975/1995/1998 各书仍未读, 本文不替该列表背书。
  8×10 积木表示 10^8 张脸是示例, 非实验数据。迁移时如何定义适应与评估改进仍是 INFERENCE,
  不能由 CAS 用语推出组织形态会自行变好。

### 2.7 标度律

- **核心主张**：West, Brown & Enquist 1997, "A General Model for the Origin of Allometric
  Scaling Laws in Biology", *Science* 276(5309):122–126（Crossref 核验，摘要原文确认"3/4 power
  law"与"space-filling fractal networks"假设）：从**空间填充分形输运网络 + 末端单元不随体型
  变化 + 能量耗散最小**推出 3/4 幂律。
- **城市标度**：Bettencourt, Lobo, Helbing, Kühnert & West 2007, "Growth, innovation, scaling,
  and the pace of life in cities", *PNAS* 104(17):7301-7306, PMC 正文已核。摘要概括创新/财富
  β≈1.2、基础设施 β≈0.8; Table 1 中国 2002 GDP 为 1.15 [1.06,1.23], 具体量不替代类别概括。
  原稿 0.85 无本篇支持, 已撤回。数据以美国城市系统为主, 作者明说向其他城市与指标推广仍待研究。
- **边界整理，原文待核**：模型假设很强（分形、末端单元不变、耗散最小）；3/4 指数长期有争议
  `[争议文献本轮未核验]`；**外推到组织没有一手支撑**。更要紧的是：标度律描述**规模效应的形状**，
  不回答"何种组织形态更优"；把它读成"越大越省"或"越大越创新"都是超出其许可的推断。

### 2.8 渗流与临界作为协调模型

- **形式（事实）**：渗流理论（Stauffer & Aharony《Introduction to Percolation Theory》
  `[书目未经一手核验]`）研究节点／连边以概率 p 加入时网络的连通行为；存在**临界概率 p_c**，
  越过它出现**巨连通分量**（巨型集群），簇尺寸分布呈幂律。Wikipedia 摘要（本轮核验，二手）
  明确称其为"a geometric type of phase transition"。
- **可作为协调模型的部分**：协调需要**信息可达**，可达性有阈值式的相变结构（连通性阈值）。
- **不可越界的部分**：渗流定理只关于**连通性**，不关于语义、质量、权威与正确性；"图连通"到
  "任务成功"之间**没有定理**。另需注意有限尺度下的 p_c 位移，以及真实协作网络不是独立同分布
  连边（渗流的独立假设常被违反）。
- **实证范式参照**：Beggs & Plenz 2003, "Neuronal Avalanches in Neocortical Circuits",
  *J. Neuroscience* 23(35):11167–11177（Crossref 核验，摘要确认 avalanche 幂律与"critical state"
  表述）给出"用雪崩分布＋尺度标度检验临界"的完整实证样板，可迁移为 agent 轨迹的检验设计
  （INFERENCE，非文献主张）。

### 对本设计的取舍含义（INFERENCE）

可把控制参数、宏观量、零模型、尺度与度量敏感性列为候选核验面。已核经典不支持直接把临界性
等同于任务效率, 但也不代替工程比较。项目用词、具体判据及其是否成为硬门留给 HITL 决议。

---

## 3. 控制论、控制与自主

本节达到原判据的 5 项最低覆盖：Ashby、Wiener 所引原文；Beer、von Foerster 的权威学术二手；
autopoiesis 经 Di Paolo 2005 已刊全文的定义与 1974 原作转述定位。后三项不冒充经典直读。
1974 *BioSystems* pp.187–196 正文仍未取得，旧库载单页题录摘要仍不计内容。新增第五项的依据
是原判据允许的权威学术二手，不是放宽为题录。范围见[第四批 T1/T2](supplements/03-autopoiesis-and-org-boundaries-20261014.md)，
其余条目保持各自层级。

### 3.1 必要多样性（Ashby）及其对控制器的推论

- **已核原文**：Ashby 1956, *An Introduction to Cybernetics*, §7/7 与 §11/5-11。variety
  可指可区分元素数或其 log₂。§11/5-6 的矩形表要求同列结果不重复, 选定结果数不能少于 r/c;
  §11/9 放宽为同列每元素最多 k 次。原公式与页图定位见[经典警告 A4](supplements/03-classic-design-warnings-20261013.md)。
- **已核边界**：作者称该定理首先是矩形表的排列陈述, 不依赖实验, 且调节能力不超过作为通信
  通道的能力。所需调节能力还取决于允许的结果集合, 不能无条件改写为 `V(C) ≥ V(D)`。
- **迁移缺口（INFERENCE）**：把任务分布、执行噪声、选择器动作映射到该表尚未完成。限制入口、
  增强探测、允许默认形态都是候选, 原文不排序其成本。1958 文章仍只作书目线索。

### 3.2 反馈、调节与稳态

- **已核原文**：Wiener, *Cybernetics*, 1961 第二版、1985 刷次, 第二版序 vii-viii 与第 IV 章
  pp.95-97 页图。负反馈反对受控量偏离控制量; 恒温器例有期望室温与实测比较。
- **已核边界**：p.97 明说恒温器设计不佳可能剧烈振荡, 稳定性依赖回路设计。序言承认简单线性
  反馈比起初认识复杂。原稿 "无设定点就无稳态" 撤回; 本页例子不能证明它。
- **迁移问题（INFERENCE）**：可研究观测噪声、延迟与调整规则对切换的影响, 不能先断言没有
  deadband 就必然抖动。1948 首版分页、Cannon 1932 和 Ashby homeostat 仍未核。

### 3.3 可生存系统模型（Beer）

- **核心主张**：任何可生存（viable）系统须具备五个子系统：S1 执行单元、S2 协调（抑制 S1 之间振荡）、
  S3 内部运行控制与资源分配、S3* 审计／ sporadically 稽核、S4 环境与未来（适应）、S5 政策与身份
  （系统整体方向）；并主张**递归（recursion）**：每个 S1 自身又是一个完整的可生存系统。核心工程
  手段是"**多样性工程**"（variety engineering）——用 S2/S3/S3*/S4 的设计平衡各层多样性。
- **一手／权威二手**：Beer, S. (1972). *Brain of the Firm*（OpenLibrary **书目记录核验**：1972）；
  1979《The Heart of Enterprise》与 1985《Diagnosing the System for Organizations》两册书目仍只
  属模型知识。内容层新增两条可定位权威学术二手：
  Puche Regaliza 等, *Systemic Practice and Action Research*,
  DOI 10.1007/s11213-019-09491-y（§2 转述 Beer 1979/1981/1985 提出 VSM、五子系统与递归；
  图 1 注转引 Beer 1985 p.136）；Hutchinson & Warren 2002,
  *Australasian Journal of Information Systems* 9(2)（五子系统功能分列、递归与"S1 内再嵌 VSM"）。
  两文均自述其概括, 不冒充 Beer 原话。
- **边界／须注意**：VSM 常被表述为**诊断语言/分类法**而非可检验的预测模型；
  "necessary and sufficient conditions" 一类措辞属转述方概括, 不写成 Beer 自身的定义级表述。
  其"递归"与"多样性工程"概念清晰，但对"五子系统是否齐备即充分"缺少经验证伪路径
  `[评估性判断，属 INFERENCE]`。
  **⇢ 本设计的"评审点"与"权限"几乎是 S3*/S5 的直译**——但 VSM 同时要求 S2 抑制单元间振荡，
  这一点在"形态频繁切换"的设计里通常缺席（INFERENCE）。

### 3.4 自创生（autopoiesis）

- **已核定义转述**：Di Paolo 2005 pp.434–435 引 Weber & Varela 2002 p.115，将自创生定义为
  组分生产过程的网络，组分持续再生并实现生产它们的网络，同时构成可区分的系统统一体。
  同文说明物理空间中的物质生产与半透膜是额外解释，不全由形式定义直接蕴含。
- **经典书目与读取层级**：Maturana, H. & Varela, F. (1972／1980). *Autopoiesis and Cognition: The Realization of
  the Living*（Dordrecht: Reidel；Wikipedia "Autopoiesis" 二手核验其 1972 年首版）；
  Varela, F., Maturana, H. & Uribe, R. (1974). "Autopoiesis: The organization of living systems, its
  characterization and a model", *BioSystems* 5(4):187–196，DOI 10.1016/0303-2647(74)90031-8
  （Crossref 已核书目，正文仍未直读）。旧单页题录与二手候选的失败记录保留，不冒充正文。
- **权威学术二手**：Di Paolo, E. A. (2005), "Autopoiesis, adaptivity, teleology, agency"，
  *Phenomenology and the Cognitive Sciences* 4:429–452，DOI `10.1007/s11097-005-9002-y`，作者自存
  已刊版已读。定义句引 2002 来源，脚注 6 则明确转述 Varela 等 1974 极简模型无显式监测、
  容忍扰动而非适应；两处可按原判据支持第五项，不假称定义句来自 1974。
- **转述方的评估边界**：Di Paolo pp.436–437 认为定义只蕴含无程度的守恒，不能独自说明主动稳态
  或改善；脚注 8 进一步区分 adaptivity 与 agency。此为 2005 作者对原理论的批评，不是
  Maturana/Varela 自认的全部边界。原稿"原作者反对社会迁移"未由本次来源核实，撤出肯定陈述。
- **项目迁移边界（INFERENCE）**：本文未研究软件或 agent 组织，不能直接证明其自我生产、自治
  或演进能力。Luhmann 1984 的社会理论仍未核；也不据生物定义先断言软件"几乎只能作隐喻"。

### 3.5 二阶控制论

- **核心主张**：把观察者纳入被描述系统——控制论应用于自身；观察者所做的**区分**决定了"什么是
  系统的状态"，因此描述总相对于观察者。
- **一手／权威二手**：von Foerster, H. (1974). *Cybernetics of Cybernetics*；(1981)《Observing
  Systems》`[两本原作均未直读]`。内容层新增一条可定位权威学术二手：Brailas,
  *Integrative Psychological and Behavioral Science*, DOI 10.1007/s12124-024-09867-3
  （PMC11711560 全文）：转述二阶控制论把观察者纳入系统、"cybernetics of cybernetics"
  标签与两条律令；其引用的 von Foerster 条目为 1984/2003 转载版本, 不是 1974/1981 本体。
  Wikipedia "Second-order cybernetics" 仍只作方向线索。
- **边界**：二阶控制论不提供控制律，它是**认识论立场**；其价值是防止把"我选定的状态变量"当作
  客观事实。转述句不写成 von Foerster 原话, 1974/1981 本体措辞仍待原作。
  **⇢ 对本设计最有用的一条：形态分类法本身是观察者的产物**——"扁平/层级/矩阵"的划分
  取决于切分方式，切换控制器所优化的目标函数同样是设计者选定的（INFERENCE）。

### 3.6 层级控制与"必要层级律"（law of requisite hierarchy）

- **摘要线索**：Aulin-Ahmavaara 从 Ashby 的调节理论出发讨论放大式调节与社会层级存在条件。
  已读摘要："A cybernetic theory of hierarchical social systems is
  given, starting from an extension of Ashby's general theory of regulation and control to
  amplifying regulation. Regulation and control in human society are then discussed and the
  conditions for the existence of social classes and social hierarchy examined."
- **一手**：Aulin-Ahmavaara, A. (1979). "The Law of Requisite Hierarchy", *Kybernetes* 8(4)，
  DOI 10.1108/eb005528（Crossref **核验**；**该律的精确数学表述本轮未获一手**，故只引其问题域）。
- **未核边界**：正文与精确定理条件未取得, 不能从摘要认定层级数下界, 更不能把上下文窗口
  直接代入为每层能力或宣布层级不能取消。

### 对本设计的取舍含义（INFERENCE）

可分别测量选择器的观测、探测、通信与调整代价, 再检验默认形态、限制入口或增加调节能力等
候选。Ashby 的条件映射未完成, Wiener 未给本系统稳定性证明, 必要层级律正文未读。
因此这里保留待测问题, 不产生必须防抖、必须设层级或某条方案最便宜的裁定。

---

## 4. 前 LLM 的多智能体计算理论

本节已核 Smith、Hearsay-II、Hewitt、Cohen & Levesque 四篇的所列机制与边界, ADOPT 另取得
Fioretto/Pontelli/Yeoh 2018 JAIR 综述的权威二手核验。各自读取范围见协调补核件。
其余文献保持题录/摘要或未核状态; 特别是 Agha、Bratman、FA/C 与 1995 ICMAS 版 BDI 未读正文。
Rao & Georgeff 的 1998 章节题录不能代证 1995 版本。

统一判据：每条给"**它解决了什么问题**"与"**LLM-agent 组织是否面对同一问题**"。后者是本报告的
推断（INFERENCE），依据是 §5 的一手证据加机制分析，不是文献主张。

### 4.1 合同网协议（Contract Net Protocol, Smith 1980）

- **解决的问题**：在**没有中央调度器知道所有节点能力**的分布式问题求解器里分配任务。机制：
  任务通告（announcement）→ 投标（bidding，节点自估胜任度与成本）→ 授标（award）→ 执行与结果
  回报。把"分配"从全局知识问题转成**局部报价聚合**问题。
- **一手**：Smith, R. G. (1980). "The Contract Net Protocol: High-Level Communication and Control in
  a Distributed Problem Solver", *IEEE Transactions on Computers* C-29(12):1104–1113，DOI
  10.1109/TC.1980.1675516。已读作者网站原文副本, 页码与引文见[协调 C1](supplements/03-coordination-sources-20261013.md)。
- **已核边界**：原文假设全局同步, 同时允许迟到投标造成次优选择; 松耦合要求计算占大部分时间。
  bids are binding, 管理者可终止合同及未结子合同; 额外确认、落选通知、单标未决在通信量与延迟
  之间取舍。原文没有本报告旧写的 "自估偏差有界" 前提或集中调度收益不等式。
- **迁移（INFERENCE）**：LLM 的投标语义与校验需要另测。LLM-MR-CNP 已核协议扩展, 但作者要求
  组件匹配消融与重复试验, 不能把新增 validation 自动解释成已证明的投标校准补救, 见 §5.4。

### 4.2 分布式约束优化（DCOP）

- **解决的问题**：自治节点持有变量、约束跨节点, 通过分布式搜索求联合赋值。权威综述将 ADOPT
  列为 complete、asynchronous、memory-bounded best-first, Table 4 标 Optimal 与 Error Bound。
- **一手**：Modi, P. J., Shen, W.-M., Tambe, M., Yokoo, M. (2005). "ADOPT: Asynchronous distributed
  constraint optimization with quality guarantees", *Artificial Intelligence* 161(1–2):149–180，DOI
  10.1016/j.artint.2004.09.003。原作正文未取; 本次内容来自 Fioretto/Pontelli/Yeoh,
  *JAIR* 61:623-698, DOI 10.1613/jair.5565, arXiv:1602.06347v4, §4.3.4、Table 4。
- **二手已核边界**：DFS 伪树, COST 上行、THRESHOLD/VALUE 下行, 以上下界收敛; 仅邻居通信,
  非 anytime。综述报时间/消息数 O(d^n)、内存 O(n+ld)、消息大小 O(n), 不是本项目运行成本。
  原作精确定理条件与完成时间界未核, 见[ADOPT 补核](supplements/03-coordination-gaps-20261013.md)。
- **迁移（INFERENCE）**：先检查变量、约束、代价是否能固定为该模型, 再谈保证。不能把 "随时可停"
  挂到 ADOPT, 也不能从本轮标题/摘要未命中推论 LLM 领域没有 DCOP 借用。

### 4.3 团队理论（与 §1.10 同源，此处只记其"计算"面）

- **解决的问题**：目标一致但信息分散时，**决策架构本身**（谁观测、谁上报、谁决策、允许多大延迟）
  的最优化；Radner 1993 进一步把它做成带延迟与差错的并行信息处理模型。
- **迁移问题（INFERENCE）**：信息分配、上报与延迟值得比较, 但原作和 LLM 借用关系尚未核。
  同一目标配置不证明成员行为目标一致; 现有检索不足以称其 "几乎未被借用" 或 "性价比最高"。

### 4.4 机制设计与拍卖式协调

- **解决的问题**：当参与者有**私人效用**且可能策略性行为时，如何设计规则使个体理性行为收敛到
  合意的集体结果（激励相容、配置效率、收入）。拍卖是其在资源分配上的经典实例。
- **一手**：Vickrey (1961)、Groves (1973)、Myerson (1981) `[三条均未经一手来源核验]`；
  Wellman, M. P. (1993). "A Market-Oriented Programming Environment and its Application to
  Distributed Multicommodity Flow Problems", *JAIR* 1:1–23，DOI 10.1613/jair.2（Crossref **核验**：
  把市场均衡当作分布式协调的计算机制）；Clearwater 编 (1996)《Market-Based Control》`[未经核验]`。
- **迁移问题（INFERENCE）**：目标由外部配置不足以证明不存在策略行为。可继续检查任务奖励、
  预算与相互评分是否产生可建模的激励。题录/摘要线索有 arXiv:2609.02580（"Competitive Market Behavior of LLMs"）、2606.29113（"LLM Semantic
  Signaling Game and Mechanism Design"）、2608.14613（"Do LLM Agents Negotiate Rationally? A
  Mechanism-Design Framework for Verifiable Multi-Agent Interaction"）。正文未核; 私人效用和
  所需假设均需具体建模, 不能仅凭使用了预算或声誉就认定成立。

### 4.5 黑板系统（Hearsay-II）

- **解决的问题**：多个异构知识源（knowledge sources）在**不确定、部分证据**条件下协作，控制流不
  固定——由当前黑板状态**机会主义地**决定下一步激活哪个知识源；黑板持 hypothesis 结构，知识源
  彼此不直接通信。解决的正是"没有单一算法能解、需要多种专长交替上场"的问题。
- **一手**：Erman, L. D., Hayes-Roth, F., Lesser, V. R., Reddy, D. R. (1980). "The Hearsay-II
  Speech-Understanding System: Integrating Knowledge to Resolve Uncertainty", *ACM Computing
  Surveys* 12(2):213-253, DOI 10.1145/356810.356816。41 页原作副本已取, 机制与边界定向核验,
  未逐句通读。p.217 给外部时间/空间资源限界; pp.231-232、236 明说无最优保证, 需要启发式停止。
  admissible 是对照 HWIM 的性质, 不是 Hearsay-II 的性质。同步/通信/承诺仅定向检索未核到。
- **LLM 摘要线索**：arXiv:2510.01285（2025-09-30，v2 2026-01-31）明确以黑板
  替代 master-slave：其摘要原文指出主从式"rely on a rigid central controller that requires
  precise knowledge of each sub-agent's capabilities, which is not possible in large-scale
  settings where the main agent lacks full observability over sub-agents' knowledge and
  competencies"；另有 arXiv:2507.01701 直接以黑板架构组织 LLM 多智能体。
- **边界（须强调）**：黑板成立的前提是**共享状态有明确定义的结构**（Hearsay-II 是语音假设格）
  与**可判定的控制启发式**；缺少这两者，黑板退化为不断膨胀的共享文本，反而成为上下文与一致性
  成本的中心。LLM agent 的"黑板"通常是自然语言记录，**结构弱、可判定性差**，这是该类比在本领域
  的主要风险（INFERENCE）。

### 4.6 Actor 模型

- **已核原作机制**：Hewitt/Bishop/Steiger 1973 将调用统一为向 actor 发消息, 无论对象表现为
  递归函数、数据结构还是进程。原文不需要传统 goto/interrupt/semaphore 原语, 但仍在模型内表达
  同步语义; p.236 说明可表达至少如多重 semaphore P 一样强的机制, 无 busy waiting。
- **一手**：Hewitt, C., Bishop, P., Steiger, R. (1973). "A Universal Modular ACTOR Formalism for
  Artificial Intelligence", *IJCAI-73*, pp.235-245, 官方 PDF 已核。Agha 1986 书仍未读, 后来的
  actor 描述不全部归于 1973 原作。
- **已核边界**：p.236 明说 intent 与 trust 的重要保护问题仍未解决; 原作未给协调效率或组织
  形态判据。共享工作树与外部工具意味着 agent 上下文独立不等于状态完全隔离, 迁移映射仍待核。

### 4.7 BDI 架构

- **解决的问题**：资源受限下的实践推理：若每轮都从零重算最优行动，agent 会**抖动、丢承诺、被
  短期机会牵着走**。BDI 用**意图（intention）**作为承诺：意图一旦形成就约束后续推理（过滤掉与
  意图冲突的选项），并区分"盲目承诺／单心承诺／开放承诺"等不同承诺策略。
- **一手**：Bratman, M. E. (1987). *Intention, Plans, and Practical Reason*. Cambridge, MA: Harvard
  University Press `[未经核验]`；Rao, A. S. & Georgeff, M. P. (1995). "BDI Agents: From Theory to
  Practice", *ICMAS-95* `[书目未经一手来源核验]`；同作者 (1998) "Rational Software Agents: From
  Theory to Practice"，收于 *Agent Technology*，DOI 10.1007/978-3-662-03678-5_8（Crossref **核验**）。
- **迁移问题（INFERENCE）**：承诺何时持续、何时解除可作为账本与切换讨论的问题。本轮没有
  正文级覆盖证据可称其领域最大缺口, 也不能由任务间选形推出任务内抖动。BDI 原作仍待核。

### 4.8 联合意图与共享计划

- **Cohen & Levesque 已核机制**：联合意图由联合承诺与相互信念刻画, 持续到共同知晓活动成功、
  不可达或已无关。个体承诺从属于联合承诺, 后者解除时前者可解除; 个体分歧带来通信需要。
- **一手**：Cohen, P. R. & Levesque, H. J. (1991). "Teamwork", *Noûs* 25(4):487–512，DOI
  10.2307/2216075。已读 21 页作者 PS 版, 未与刊页逐页对齐; §4-5 与 Notes 1 可定位,
  公式未逐符号核。离散同步建模并允许推广到连续异步, 未给通信成本或调度最优性定理。
  Grosz, B. J. & Kraus, S. (1996). "Collaborative plans for
  complex group action", *Artificial Intelligence* 86(2):269–357，DOI
  10.1016/0004-3702(95)00103-4（Crossref **核验**）；Bratman, M. (1992) "Shared Cooperative
  Activity" *Philosophical Review* `[未经核验]`。
- **迁移问题（INFERENCE）**：Magentic-One 摘要的 plans/tracks progress 可作比较入口, 不能
  因账本功能相似就认定借用了联合意图, 更不能据此解释所有交接失败。Grosz/Kraus 与 Bratman
  正文未核, 帮助承诺和修复义务的具体归属待查。

### 4.9 可调自主性（adjustable autonomy）

- **解决的问题**：人—agent 团队中，决策权不应固定在"全自动"或"全人工"，而应随形势**转移**：
  当 agent 置信度低、风险高、目标变化大时把权限交回人；反之放权。核心贡献是给出**转移模型**
  （何时转移、转移什么、代价如何计入）而不是二元开关。
- **一手**：Scerri, P., Pynadath, D. V., Tambe, M. (2002). "Towards Adjustable Autonomy for the Real
  World", *JAIR* 17:171–228，DOI 10.1613/jair.1037（Crossref **核验**；arXiv:1106.4573 为其预印本，
  本轮经 arXiv 检索命中）；Horvitz, E. (1999). "Principles of Mixed-Initiative User Interfaces",
  *CHI '99*，DOI 10.1145/302979.303030（Crossref **核验**）。
- **同一问题？是**：Pod 的"权限""评审点"本质就是自主性边界；本轮 LLM 侧的对接口径见
  arXiv:2510.01815（Human-AI Teaming 中的可调自主性，摘要层面命中）。
- **边界**：可调自主性要求**可用的性能模型**（agent 何时可靠）与**转移协议**；缺少它们时，权限
  转移会退化成"出事才升级"的事后救火。

### 4.10 附：功能准确的合作式分布式系统（FA/C，用于对照）

- **解决的问题**：节点各自只有**不完整、可能不一致**的视图，无法保证一致性；因此改为交换**部分
  结果**、靠冗余与迭代逐步消解不确定性（"functionally accurate"而非"logically correct"）。
- **一手**：Lesser, V. R. & Corkill, D. D. (1981). "Functionally Accurate, Cooperative Distributed
  Systems", *IEEE Trans. SMC* `[未经一手来源核验]`。
- **迁移问题（INFERENCE）**：局部上下文可能不同, 但外部账本仍可维护一致的记录。
  FA/C 原文未核, 当前不比较它与单一事实源的优劣, 撤回 "任何全局一致状态都是幻觉" 的断言。

### 对本设计的取舍含义（INFERENCE）

已核部分可为任务分配、共享状态、消息调用与承诺解除提供比较对象。哪些条件在 Pod 中成立,
哪些机制值得采用仍待下游判断。有限标题/摘要检索不支持领域缺席、隐式借用或方案优先级结论。

---

## 5. 接口：LLM 多智能体研究实际借用了什么

原侦察使用 arXiv 标题/摘要检索, 未取得引用图。标注 `(A)` 为摘要、`(T)` 为仅题录、`(F)` 为
指定版本正文与参考文献补核。MacNet、Absorbing State、LLM-MR-CNP 三样本新增 F, 详见 §5.4。
其余表项仍只反映作者的题名/摘要声明, 不作为实际机制或全领域借用比例的结论。

### 5.1 借用线索与已核样本

| 理论概念 | 论文（一手，F/A/T 层级） | 借用方式与该读取层级的限制 |
|---|---|---|
| 组织理论成为可执行配置 | **2607.25446** (A)，2026-07-28 *Toward an Organizational Science of Multi-Agent LLM Systems* | 把 Belbin 角色、Mintzberg 协调机制、RACI 问责"变成可执行、可校验的配置"；把"谁在队里(organization)／如何对齐(coordination)／用何算法融合(protocol)"拆成三层可独立替换 |
| 权威与层级（组织理论的直接检验） | **2609.14767** (A)，2026-09-13 *Loop-Back Authority in LLM Agent Teams* | 摘要明写"Organizational theory asserts that authority facilitates decision making"与"some nascent AI research suggests that revision under authority makes LLM output worse"；43 对产品、86 次运行的配对实验检验 manager 的退回权 |
| 任务自适应拓扑 | **2410.11782** (A) G-Designer；**2310.02170** (T) DyLAN | G-Designer 用 GNN 按任务生成通信拓扑，动机原文即"Which topology is the best choice for my task, avoiding unnecessary communication token overhead"；DyLAN 做动态 agent 网络与团队优化 |
| 形态/路由的显式选择（=本设计的元层） | **2502.11133** (A) MasRouter；**2608.07583** (A) RouteGuard | MasRouter 提出 MASR："integrates all components of MAS into a unified routing framework"（协作模式＋角色＋模型选择一起路由）；RouteGuard 证明**路由收益不可由 AUC 决定**，需条件 regret Φ 与认证区间 |
| 自组织团队（动态雇佣/自演化） | **2603.25928** (A) TheBotCompany；**2609.33768** (A) DEALS | TheBotCompany：三阶段状态机（Strategy→Execution→Verification）＋ manager agent 动态雇佣；DEALS：批评集中控制器与固定协调模式，要求 agent"self-organize and self-evolve"以适配任务流 |
| 规模与协作涌现 | **2406.07155v3** (F) MacNet, 2025-03-17 | 神经标度律引用与 logistic 曲线关系已核; 全文 phase transition 零命中, 只限此版本 |
| 搜索过程的吸收态相变 | **2609.38327v2** (F), 2026-10-07 | mean-field 方程、临界条件与三域对照已核, 每轮实验预算/独立性与有限 horizon 限制见 §5.4 |
| 临界/混沌/亚稳（含零模型与尺度标度） | **2609.17419** (A)，2026-07-12 *World Model Science* | 用 SOC、weak chaos、metastable belief dynamics 三视角研究长时程 agent，报告 "error avalanches"、"finite-size scaling"、"explicit null models"、"belief-basin transitions" |
| 自组织的可测化 | **2609.33871** (A)，2026-09-27 *Population Physics, Population Problems* | 提出"safety and emergence in LLM societies"的测量框架，用于 Schelling grid、Moltbook、Twitter 式信息污染模拟三个系统 |
| Stigmergy | **2608.26081** (A) SwarmWorld，2026-08-26 | 同质 LLM agent 在共享环境中无预设角色、无配方地留下痕迹并演化出"技术"；摘要明确对照"direct conversation, predefined roles, or centralized workflows" |
| 黑板架构 | **2510.01285** (A)；**2507.01701** (T) | 前者以黑板替代 master-slave，理由原文：主从式需要"precise knowledge of each sub-agent's capabilities"，而大规模下"the main agent lacks full observability" |
| 合同网协议 | **2608.12371v1** (F) LLM-MR-CNP, 2026-07-19 | 引 Smith 1980 并扩展协议; 组件混变、单次选优与 token 增长使 LLM 独立收益仍未证 |
| 机制设计／市场 | **2608.14613** (A)；**2609.02580** (T)；**2606.29113** (T) | 前者以机制设计框架做"可验证的多智能体交互"与谈判理性检验；后两者分别研究 LLM 的市场竞争行为与语义信号博弈 |
| 控制论／CAS 的分工 | **2608.10153** (A) CASE，2026-08-10 | 明确"agentic AI governance is four problems, not one"：个体给控制论（intent=setpoint，guardrails=feedback，evaluation=observation）、集体给复杂适应系统理论（"emergence makes single-agent assurance non-compositional"）、人机给 supervisory cybernetics |
| 记忆与组织记忆 | **2506.07398** (A) G-Memory；**2609.36739** (T) Frontier Autolab；**2606.03083** (T) DELTAMEM | G-Memory：为 MAS 引入跨试验、按 agent 定制的层级记忆，批评既有 MAS 记忆"overly simplistic"；Frontier Autolab 标题即含"Organizational Memory, Adversarial Dissent"（**未核验摘要**） |
| 失败与可靠性 | **2503.13657** (A) MAST；**2602.19843** (T) MAS-FIRE；**2605.14892** (A) 综述 | MAST 建 1600+ 标注轨迹、跨 7 框架的失败分类；综述指出"tighter coordination also amplifies a less explored risk: errors can propagate across agents and interaction rounds" |
| 效度诊断（对该领域自身的批评） | **2606.22203** (A)，2026-06-20 | 原文批评："LLM 'agent societies' are studied via demonstrations of emergent consensus or polarization — with no measurable control parameter, no theory of when each regime appears, and no test of whether an outcome is a genuine social dynamic or a model artifact"；给出耦合增益 γ |
| 网络结构视角 | **2512.18094** (T)；**2608.05956** (T) | 小世界网络视角重述多智能体智能；Koopman 谱分析认证集体推理 |
| 成本记账 | **2610.00954** (A)；**2609.15079** (T)；**2603.12465** (T) | 把 agent 编排从"排行榜精度"推进到 token/能耗/延迟记账（"beyond leaderboard evaluation"） |

### 5.2 装饰性使用、误用与本轮**检索不到**的借用

1. **相变用词与形式化线索**：Absorbing State v2 已核模型及近似条件; World Model Science
   仍只读摘要。MacNet v3 已核全文标度关系, 该版 phase transition 零命中不扩展到其他版本或领域。
2. **"涌现"的度量依赖被反复重犯（事实）**：Wei et al. 2022（arXiv:2206.07682，摘要核验）定义
   涌现为"not present in smaller models but present in larger models"；Schaeffer et al. 2023
   （arXiv:2304.15004，摘要核验）给出替代解释："emergent abilities appear due to the researcher's
   choice of metric rather than due to fundamental changes in model behavior"。**任何 agent 组织的
  涌现主张都应先做度量敏感性检验**；2606.22203 的批评（上文原文）正是这一点的领域内版本。
3. **组织术语是否连同边界一起借用，尚待核验**：2607.25446 摘要出现 Belbin／Mintzberg／RACI
   配置项。摘要未展开边界，不等于正文丢掉边界；须回读机制与引用后才能分类为借用或修辞。
4. **本轮**检索不到**借用的概念（事实，限定于 arXiv 标题/摘要面）**：Marschak–Radner **团队理论**、
   **DCOP**、**交易成本经济学**、**TMS（transactive memory）**、**autopoiesis**、**双元性
   （ambidexterity）**、**间断平衡／组织转型**、**矩阵组织**、**模块化（Baldwin & Clark 意义）**、
   **actor 模型**、**BDI/联合意图**。检索到的相邻替代物分别是：成本记账论文（代替团队理论）、
   路由/拓扑论文（代替组织形态选择）、层级记忆论文（代替 TMS）、状态机＋动态雇佣（代替间断平衡
   与 BDI 承诺）。**"检索不到"不等于"不存在"**——见 §7 的方法学限制（无引用图、仅 arXiv）。
5. **误用的一种具体形态（INFERENCE）**：把"多中心/自组织"当作**免设计的理由**（"让它自己涌现"），
   与 Ostrom 的反万灵药立场、CAS 的描述性定位直接冲突；这两支理论本身都不支持"不设计"。

### 5.3 明确使用"相变／临界"语言的清单（含形式化程度）

| 论文 | 用语 | 实读层级与形式化边界 |
|---|---|---|
| 2609.38327v2 | absorbing state phase transitions; critical condition | F: 已核 Eq.3/5/6 与近似条件, 有限 horizon 为 smooth crossover |
| 2609.17419 | self-organized criticality、weak chaos、metastable belief dynamics、finite-size scaling、null models | 摘要声称零模型与尺度标度，实际检验待核 |
| 2609.33871 | self-organisation 的统计测量 | 中：有测量框架与三系统对照，摘要未称"相变" |
| 2406.07155v3 | collaborative scaling law、logistic growth、collaborative emergence | F: 标度关系借用, 不计相变机制实现 |
| 2606.22203 | 批评"无控制参数"的伪涌现主张 | —（元层面批评） |

### 5.4 三个全文样本的借用分类

原句、参考文献、公式、版本与 SHA 见[LLM 借用补核](supplements/03-llm-classic-borrowing-20261013.md)。
三个定向选择的样本不能估计领域借用率。

| 样本 | 仅提词/有引用/机制对应 | 已核限制 |
|---|---|---|
| MacNet, Chen Qian 等, v3 | 有 Kaplan 2020 引用; 对应的是 agent 数与表现的 logistic 标度关系, 不是经典控制机制实现 | 解释自称 speculate; 相变词未命中只限此版 |
| Absorbing State, v2 | 引 Hinrichsen 等; 有 mean-field 方程、参数与三域对照, 属机制级 | Eq.3 用满 Nm 次随机独立实验; Eq.5 另需 A_t≫mN、mq_t≪1; Eq.6 需均匀最终选择并保留一个正确候选。LLM 结果 mixed, 不完整报告/重复探索使理论条件失配 |
| LLM-MR-CNP, v1 | 引 Smith 1980; 保留 announcement/proposal/award/rejection 并加多轮机制 | Scenarios 1/2 同时改上下文与 LLM 解释; Table VI 25 cases, Table VII 30 个配置各一次再选优。固定模型单/多轮 token 19,100/53,452; 作者要求匹配消融与重复试验 |

### 对本设计的取舍含义（INFERENCE）

当前样本给出自适应拓扑、选形与路由的研究线索，也提示计量元层收益与成本。间断平衡、BDI、团队
理论和 TMS 的实际借用情况尚待正文与引用核验；不能从题名／摘要未命中推导"没有同行经验"。
本节先提供待读样本，不据此作领域空白或方案优劣判断。

---

## 6. 设计警示与反论证

本节列设计假设、待核出处与可检查条件。经典文献的内容证据受 §7 限制，LLM 侧除另有标记外只是
摘要中的作者主张。它们不直接构成 Pod 的判据，切换节奏和取舍仍由下游决议确定。

### 6.1 选择形态本身的信息成本（不是免费的元层）

- **已核出处**：Galbraith 1974 pp.28/31/36 把信息需求与策略相对成本相连, 自足任务会损失
  专业化, 四策略穷尽性只是框架假设。团队理论的原作仍未核, 不能与该论文合并成已证定理。
- **迁移警告（INFERENCE）**：形态选择所需观测与探测也有成本。比较时需查它是否已包含在收益中,
  而不是假定元层免费。
- **一手证据（LLM 侧）**：MasRouter 2502.11133（A）把协作模式＋角色＋模型纳入统一路由，等于承认
  路由决策本身是一个要学的组件；RouteGuard 2608.07583（A）证明**路由收益不可由 gate 的 AUC 决定**，
  需要条件 regret 与认证区间。此处只是摘要声明, 不扩写成一切自评无效。
- **检查条件（INFERENCE）**：分别测量观测成本、预测误差与错配损失; 当前没有这些项目数据。

### 6.2 切换与迁移成本

- **已核出处**：Hannan & Freeman 1984, "Structural Inertia and Organizational Change",
  *ASR* 49(2):149-164, DOI 10.2307/2095567。惯性相对于环境变化率定义, 不是永不改变; p.159
  提出重组降低可靠性、提高死亡率的理论命题, 同页称规模与变化率关系 indeterminate。
  原文变量为 age/size/complexity, 旧稿 "正式化" 未核到。无实测收益数字, 见经典警告 A3。
- **补核边界**：Williamson 2009 要求把替代治理实施费计入预期净收益；Baldwin & Clark 2006
  明列规则、实验与测试成本，见 §1.9／§1.6。两者不是 LLM 切换实验。
  Langlois 1999 工作稿另说明重模块化会使旧模块库存不兼容或失效，规则流动与过早冻结各有损失，
  取舍依情境；其概念论证不给 Pod 迁移费数值或切换频率。
- **迁移假设（INFERENCE）**：切换后原先的测试、账本与评审记录是否仍有效，需要逐项验证。
- **待测条件（INFERENCE）**：状态量与耦合度是否提高迁移代价, 需按任务测量; 不先规定其单调关系。

### 6.3 振荡与迟滞

- **假设（INFERENCE）**：同一执行状态因带噪估计而反复迁移时，可能产生无收益的切换。任务间
  独立选形不自动构成抖动。迟滞、死区与最小驻留时间是可比较的控制策略，不是未经实验的默认答案。
- **已核出处与边界**：Gersick 1988 的 8 组中点观察属假设生成, 限有期限和过程调整余地的团队;
  Wiener 第二版 p.97 则给设计不佳的反馈可能振荡。两者不推出 Pod "每里程碑一次" 或必须死区。
  2606.22203 仍只有摘要, 不提供本项目的切换频率。
- **检查条件**：记录切换次数、状态是否反复迁移、切换耗时／成本与净收益，再判定是否需要防抖。

### 6.4 路径依赖与锁定

- **内容待核**：Arthur, W. B. (1989). "Competing Technologies, Increasing Returns, and Lock-In by
  Historical Events", *The Economic Journal* 99(394):116–131，DOI 10.2307/2234208（Crossref 仅核书目）：
  收益递增会使早期偶然选择锁定为长期均衡，且**锁定未必是有效率的那个**。David 1985 "Clio and the
  Economics of QWERTY" 是相邻候选。两者核心主张与边界均 `[未经一手来源核验]`，不计本批已核警告。
- **对本设计的读法（INFERENCE）**：形态选择器一旦用**历史成功率**做先验（很自然的实现），就会
  形成自我强化：某形态被选中→积累更多适配它的记忆与工具→下次更可能被选中，即使另一形态在
  新任务分布上更好。探索配额与独立评估只是候选; 反复使用固定留出集也会产生选择偏差, 见
  [14 号研究](adaptive-evaluation-and-selection-bias.md), 不把固定集反复重测当作无代价补救。

### 6.5 阿什比定律用于"切换控制器"（元层的多样性缺口）

- **已核出处与缺口**：Ashby 的矩形表条件与可容许结果集已核, 但选择器、任务分布与表中元素的
  映射未完成。旧稿 `V(选择器)<V(任务分布)` 所以必然系统性失准的推导撤回。
- **候选方案（INFERENCE）**：限制任务入口、给不可判定任务默认形态，或增强选择器的探测能力。
  成本需包含误判损失、探测及维护，当前没有证据给这些方案排序。

### 6.6 元层成为新瓶颈

- **待测假设（INFERENCE）**：若所有任务经过同一个串行判定器, 其服务时间可能造成排队瓶颈。
  是否比执行层先饱和取决于到达率、并发度和服务时间, 目前未测。
- **证据边界**：Beer 与 von Foerster 已取得可定位权威学术二手（VSM 五子系统／递归；
  observer 在环）, 但两份转述均不涉及元层服务时间瓶颈, 不能替本命题背书; 原作未直读。
  Magentic-One、MasRouter、RouteGuard 的摘要只给编排与路由线索, 不证明本项目的吞吐瓶颈。

### 6.7 "没有免费午餐"式论证

- **已核出处**：Wolpert & Macready 1997, "No free lunch theorems for optimization",
  *IEEE Trans. Evolutionary Computation* 1(1):67-82, DOI 10.1109/4235.585893, §II-III/VI。
  有限搜索空间、有限 cost 值域, 按 distinct oracle calls 计观测, 对全部 cost functions 均匀平均;
  重访不增加样本。该平均下性能抵消, 不直接给 minimax 结论; 现实问题不必有 flat prior。
  公式未逐符号重建, 组织路由映射未完成, 见经典警告 A5。
- **方法建议（INFERENCE）**：报告形态比较适用的任务分布与基线。这个建议不等于现实任务必须
  稳定、分布必须预先完全已知，或必须冻结现实工作负载; 原文不支持这些要求。

### 6.8 矩阵／动态组织在管理实践中的已知失败

- **摘要证据**：Sy & Côté 2004 的矩阵内在问题与情商关注点、Davis & Lawrence 1978 的一般
  设计问题表述均只核到摘要。Bartlett & Ghoshal 的 HBR 年份已核为 1990 年 7–8 月，全文未读。
  这些证据不足以认定矩阵失败主要来自管理能力，也不能把具体病理全归为结构，见 §1.5。
- **证据边界**：Ostrom 2007（DOI 10.1073/pnas.0702288104）的已读摘要反对普遍解。间断平衡与
  Gersick 中点观察已核, Tushman/Romanelli 仍待核; 两者都不能直接证明动态 agent 组织的切换节奏。
- **待核假设（INFERENCE）**：冲突协商、问责归属和高层整合不足可能增加决策延迟与开销。
  本批未核清这些因素的必要性或充分性，不写成动态/双重结构必然失败的定理。

### 6.9 直接反面经验证据（LLM 侧，均为摘要级）

- **收益常常很小**：MAST 2503.13657（A）原文："Despite enthusiasm for Multi-Agent LLM Systems (MAS),
  their performance gains on popular benchmarks are often minimal."
- **协调与错误传播风险**：2605.14892（A）原文："tighter coordination also amplifies a less
  explored risk: errors can propagate across agents and interaction rounds"。
- **补足性不足以决定收益**：RouteGuard 2608.07583（A）原文："Prevailing routers optimize a gate's
  AUC and presume that advisor complementarity suffices. We show that neither determines the
  deployable gain."
- **成本是真实的**：2610.00954（A）把评估从排行榜精度推向 token／能耗／延迟记账；这为"更复杂
  形态是否值得"提供了计价口径。
- **权威不是普遍利好**：2609.14767（A）用配对实验检验"权威退回修改"对开放式任务产出的影响，
  其摘要把组织理论断言与 AI 研究的相反暗示并列——**结构主张在 LLM 团队中必须逐案实证**。

### 6.10 反向（支持动态形态）的证据，以及应当如何读它

- 支持方（§5.1）：G-Designer 的按任务拓扑、DyLAN 的动态团队优化、MasRouter 的联合路由、DEALS
  去中心化自组织、TheBotCompany 的动态雇佣——都报告了任务自适应的收益。
- **补核要求**：仅靠题名与摘要不能把这些系统归成"每任务选一次"。需逐篇区分离线搜索、任务前
  选形、任务内重路由与状态迁移，再核质量和完整成本。已补核的 AdaptOrch 对照及其局限见
  [一手证据纠正](evidence-corrections-2026-10-13.md)；它也不直接规定 Pod 的切换粒度。

### 6.11 候选检查项（INFERENCE，供 wayfinder 票裁定）

可检查选择信号的误差与探测成本、完整切换成本、任务分布变化、带噪输入下的反复迁移、未知任务
处理、元层开销与历史选择偏差。死区、最小驻留、默认形态、探索配额、审查点触发均是候选策略，
当前未证明它们是获得正收益的必要条件。采集指标、方案对照和采用门槛由相关决议票确定。

### 对本设计的取舍含义（INFERENCE）

当前不能从已读材料裁定切换权。"每里程碑一次"可作为实验候选，与任务前选形或其他触发策略比较，
不是经典理论已证明的上限。继续补核原文后，将来源支持的范围、适用前提和仍需实验的假设分别交给
形态与切换粒度决议；研究票不预先选择方案。

---

## 7. 盲区：本轮未能到达或未能核验的部分

本节保留原侦察访问失败与当前缺口, 不把旧端点失败当作补核仍不可达。补核已接受的范围见头部表;
控制论已按权威学术二手达 5/5，经典原作直读与其他原条目边界仍有缺口。最低计数满足不消除 S4，
不以新增票或改成非核心绕过。

### 7.1 原侦察的端点失败与覆盖缺口

1. **web_search 全轮不可用**（任务书给出：HTTP 402）。已按要求弃用；改用 arXiv 站内检索（HTML）、
   Crossref REST、OpenLibrary、Google Books、Wikipedia REST。**后果**：面向**实践**的文献
   （HBR 档案、咨询报告、企业矩阵制失败复盘、管理学期刊的实务评论）原侦察基本没覆盖。
   2026-10-14 的两篇 HBR 补核仍限书目与摘要，不建立具体矩阵病理的因果结论。
2. **Semantic Scholar API 全轮 429**（"Too Many Requests"），即使 sleep 后仍 429。**后果**：
   原侦察没有引用图与计数, §5.2 第 4 条的未命中只在标题/摘要面成立。后续三样本已直接读
   正文与参考文献, CNP 引 Smith 1980 已核; 不再把引用 API 不可达等同于无法核任何正文引用。
3. **arXiv export API 全轮 429**（`export.arxiv.org/api/query`），改走 arXiv 站内检索 HTML。
   该界面是**元数据检索**（标题/摘要/作者/comment），不覆盖正文。**后果**：只在正文提到
   "requisite variety""contract net""blackboard""stigmergy"的论文会被漏掉——**这会系统性低估**
   经典概念的借用程度，而不是高估。
4. **Google Books API 对所有查询返回空**（含"Governing the Commons"这类必然存在的条目），判定为
   端点不可用而非无结果。**后果**：书籍书目只能靠 OpenLibrary，而 OpenLibrary 本轮亦间歇性返回
   非 JSON（"Expecting value: line 1 column 1"）且给出错误版本（例如 Ostrom 只命中德译本）。
5. **未做程序化检索的场所**：AAMAS／NeurIPS／ICML／ACL／CHI 会议论文集、期刊（JAIR 之外）、
   学位论文、预印本之外的技术报告。§5 的样本是 **arXiv 中心**的。

### 7.2 一手不可读：内容只能标"未经一手来源核验"

已补核来源不再列为整篇未读。仍未取得原文或未完成内容边界核验的条目包括 Burns & Stalker、
Lawrence & Lorsch、Thompson、Galbraith 1973、矩阵病理正文、Baldwin & Clark 2000 全书、Langlois 2000/2002、
Tushman/Romanelli、Williamson 1971/1975/1985、Marschak/Radner、Wegner/TMS、Ostrom 1990、Ashby 1958、
Beer（原作未直读, 已有两条权威学术二手）、von Foerster（原作未直读, 已有一条概念层权威
学术二手）、Maturana/Varela（*BioSystems* 原作未取得，已有 Di Paolo 2005 转述）、Prigogine 系列、Holland
1975/1995/1998、Bak 1996。各条仍按正文标注引用, 不借用已核邻近来源替代。

已取来源内仍有缺口：Simon pp.477/478/482 未按页图核; Holland 七机制列表未定位;
Wiener 第二版第 IV 章后续数学分析未读; Hearsay 的同步/通信/解除只定向检索未核到;
Teamwork 公式未逐符号核且作者 PS 分页未对齐刊本; ADOPT 只有权威二手, 原作精确定理未核。
Varela 的 *BioSystems* 正文仍未直读；Di Paolo 2005 的可定位转述支持概念计项，不升级为原作全文。
Aulin-Ahmavaara 的必要层级律也只有摘要问题域。
Williamson 2009 与 Baldwin & Clark 2006 已核范围见 §1.9／§1.6，不再全列未读。
Langlois 1999 作者机构工作稿已核模块分界与成本边界，不能写成 2000 SSRN 或 2002 期刊版直读。
Burns & Stalker、Thompson 的本批访问失败归未核验，不计有界空结果。

### 7.3 书目核验失败的条目（引用须补核）

Rao & Georgeff 1995 ICMAS（Crossref 只匹配到同作者 1998 章）；Tushman &
Romanelli 1985（ROB 第 7 卷，无 DOI 命中）；Davis & Lawrence 1977《Matrix》；
Duncan 1976 章节；Lesser & Corkill 1981；Bratman 1987／
1992；Clearwater 1996；Vickrey 1961／Groves 1973／Myerson 1981；Nicolis & Prigogine 1977；
Bak 1996；Holland 1975／1995／1998；Prigogine & Stengers 1984；Maturana & Varela 1980；
von Foerster 1974／1981；Wiener 1948；Cannon 1932；David 1985；Beer 1979／1985；Galbraith 1973。
其中 Beer 与 von Foerster 已另有内容层权威二手（§8.5）, 但各自书目与本体仍待一手核验。
Bartlett & Ghoshal 的年份已由 HBR 官方页核实，不再列为书目缺口；其全文仍未读。
Langlois 2002 JEBO 的题名和 DOI、Lawrence & Lorsch 1967 文章题名与 DOI 本批已核元数据，
不再列为书目失败；二者正文及 Lawrence & Lorsch 同年书仍未核。

### 7.4 方法限制（结论强度上限）

1. LLM 三样本正文与引用已核, 其余仍按 A/T 层级。未运行论文代码或复现任何实验; 作者的实验
   报告不等于本项目独立复现, 主会话原文回读也不增加实验强度。
2. **未核验同行评审状态**（除摘要 comment 字段自述者：MacNet=ICLR-2025、TheBotCompany=ASE 2026、
   Wei et al.=TMLR 2022）；2026 年 10 月前后的 2610.* 条目多为 v1 预印本。
3. 借用分类按仅提词、有经典引用、实际机制对应区分, 三个 F 样本均有定位和限制。原侦察的 A/T
   行不能与 F 行混算, 定向样本也不构成领域代表性统计。
4. **本文件不含对 Pod 代码库的任何事实主张**（任务范围为纯概念侧）；§1–§6 中所有"对本设计的
   含义"均为 INFERENCE，未经仓库事实核验，也未考虑 Pod 现有实现约束。
5. **采集时点**：原侦察为 2026-10-13，作者边界补核为 2026-10-14。列表与可达性可能变化；
   来源版本、实际读取范围和端点失败均按各补核件分开，不把旧失败当作当前不可达。

### 对本设计的取舍含义（INFERENCE）

本文件可提供问题与检索线索，不能替代原文核验。经典理论的原文边界、借用与修辞的区分以及 LLM
正文引用都归现有[组织理论、复杂系统与控制论](../issues/03-research-organization-theory-and-concepts.md)逐项补核。
其他原条目的边界缺口仍覆盖原票核心问题，研究票保持开放。控制论最低计数已满足，已核部分可按版本与原句引用，
不必退回全篇摘要级; 未核部分不以另开票或移入雾面绕过当前关闭门。

---

## 8. 来源表

正文引用一律**就地**给 DOI 或 arXiv 编号；本节是索引与核验方式说明，不重复正文论证。

### 8.1 经典期刊／章节索引

题录与内容状态分开。头部表及补核件列出了已核原文范围; 未注明升级的条目仍只有原侦察的题录/摘要。

- Galbraith 1974, *Interfaces* 4(3):28-36, `10.1287/inte.4.3.28`（原文补核）
- Sy & Côté 2004, *J. Management Development* 23(5) — `10.1108/02621710410537056`（**含摘要原文**）
- Raisch & Birkinshaw 2008, *J. Management* 34(4):375–409 — `10.1177/0149206308316058`（**含摘要原文**）
- Ostrom 2007, *PNAS* 104(39) — `10.1073/pnas.0702288104`（**含摘要原文**）
- Bettencourt, Lobo, Helbing, Kühnert & West 2007, *PNAS* 104(17):7301–7306 — `10.1073/pnas.0610172104`（含摘要）
- West, Brown & Enquist 1997, *Science* 276(5309):122–126 — `10.1126/science.276.5309.122`（含摘要）
- Beggs & Plenz 2003, *J. Neuroscience* 23(35):11167–11177 — `10.1523/JNEUROSCI.23-35-11167.2003`（含摘要）
- Bak, Tang & Wiesenfeld 1987, *PRL* 59(4):381–384 — `10.1103/PhysRevLett.59.381`（含摘要）
- Aulin-Ahmavaara 1979, *Kybernetes* 8(4) — `10.1108/eb005528`（含摘要）
- Tushman & O'Reilly 1996, *CMR* 38(4):8–30 — `10.2307/41165852`
- Tushman, Newman & Romanelli 1986, *CMR* — `10.2307/41165225`
- Gersick 1991, *AMR* 16(1):10–36 — `10.2307/258605`；Gersick 1988, *AMJ* 31(1):9–41 — `10.2307/256496`
- Ghoshal & Moran 1996, *AMR* 21(1) — `10.2307/258627`
- Hannan & Freeman 1984, *ASR* 49(2):149–164 — `10.2307/2095567`
- Arthur 1989, *Economic Journal* 99(394):116–131 — `10.2307/2234208`
- Radner 1993, *Econometrica* 61(5):1109–1146 — `10.2307/2951495`
- Lewis 2003, *JAP* 88(4):587–604 — `10.1037/0021-9010.88.4.587`
- Wegner 1987, in *Theories of Group Behavior* — `10.1007/978-1-4612-4634-3_9`
- Smith 1980, *IEEE Trans. Computers* C-29(12):1104–1113 — `10.1109/TC.1980.1675516`
- Erman, Hayes-Roth, Lesser & Reddy 1980, *ACM Computing Surveys* 12(2):213–253 — `10.1145/356810.356816`
- Cohen & Levesque 1991, *Noûs* 25(4):487–512 — `10.2307/2216075`
- Grosz & Kraus 1996, *Artificial Intelligence* 86(2):269–357 — `10.1016/0004-3702(95)00103-4`
- Modi, Shen, Tambe & Yokoo 2005, *Artificial Intelligence* 161(1–2):149–180 — `10.1016/j.artint.2004.09.003`
- Scerri, Pynadath & Tambe 2002, *JAIR* 17:171–228 — `10.1613/jair.1037`（预印本 arXiv:1106.4573）
- Wellman 1993, *JAIR* 1:1–23 — `10.1613/jair.2`
- Horvitz 1999, *CHI '99* — `10.1145/302979.303030`
- Wooldridge & Jennings 1995, *Knowledge Engineering Review* 10(2) — `10.1017/S0269888900008122`
- Wolpert & Macready 1997, *IEEE Trans. Evolutionary Computation* 1(1):67–82 — `10.1109/4235.585893`
- Grassé 1959, *Insectes Sociaux* 6(1):41–80 — `10.1007/BF02223791`；Dorigo, Maniezzo & Colorni 1996,
  *IEEE Trans. SMC-B* 26(1):29–41 — `10.1109/3477.484436`
- Varela, Maturana & Uribe 1974, *BioSystems* 5(4):187–196 — `10.1016/0303-2647(74)90031-8`
  （书目核验，原作正文未直读；Di Paolo 2005 的定义与原作转述定位见 §3.4）
- Anderson 1972, *Science* 177(4047):393–396 — `10.1126/science.177.4047.393`
- Georgeff & Rao 1998, in *Agent Technology* — `10.1007/978-3-662-03678-5_8`
- Langlois 2000, "Modularity in Technology, Organization, and Society"（工作论文版） — `10.2139/ssrn.204089`
- Langlois 1999，UConn Working Paper 1999-05，[作者机构 PDF](https://media.economics.uconn.edu/working/1999-05.pdf)，
  模块分界及成本边界已核；2002 JEBO `10.1016/S0167-2681(02)00056-2` 仅元数据，版本差异未核。
- Lawrence & Lorsch 1967，"Differentiation and Integration in Complex Organizations"，ASQ，
  `10.2307/2391211`，仅元数据；与同年书分开，二者正文未读。
- Ostrom 2010, *AER* 100(3):641–672 — `10.1257/aer.100.3.641`
- Simon 1962, *Proc. APS* 106(6):467-482（所列页图已核）; Hewitt/Bishop/Steiger 1973,
  *IJCAI-73*, pp.235-245（官方 PDF 已核）; Holland 1992, *Daedalus* 121(1):17-30（所列机制已核）。
- Ostrom 2009-12-08 诺奖讲座, `https://www.nobelprize.org/uploads/2018/06/ostrom_lecture.pdf`,
  pp.408-444（实际读取版, 不与 AER 分页混用）。
- Williamson 2009-12-08 诺奖讲座，[官方 PDF](https://www.nobelprize.org/uploads/2018/06/williamson_lecture.pdf)，
  实读印刷 pp.463–465、468–469；作者后期综述，非旧著直读。
- Baldwin & Clark 2006，*Complex Engineered Systems* ch.9, pp.175–205，
  `10.1007/3-540-32834-3_9`，实读 pp.180–181、189、199–200；非 2000 全书直读。
- Bartlett & Ghoshal 1990，[HBR 官方页](https://hbr.org/1990/07/matrix-management-not-a-structure-a-frame-of-mind)，
  July–August，元数据／摘要首段；Davis & Lawrence 1978，[HBR 官方页](https://hbr.org/1978/05/problems-of-matrix-organizations)，
  元数据／摘要。来源哈希与限制见[作者边界](supplements/03-author-boundaries-20261014.md)。

### 8.2 书籍与其余未核候选

- 原文补核：Ashby 1956 §7/7、§11/5-11; Wiener 1961 第二版、1985 刷次的序 vii-viii 与
  pp.95-97。逐页定位与版本见相应补核件, 不冒充其他版本或全书核验。
- **权威二手转述（本批新增）**：Beer VSM 两文与 von Foerster 概念文见 §8.5; 原著三书
  （Beer 1979/1981/1985）与 von Foerster 1974/1981 本体仍未直读, 不因二手转述升级。

- **书目记录核验**：Burns & Stalker 1961 *The Management of Innovation*（Tavistock；Wikipedia 参考
  文献行＋Crossref 1994 OUP 版）；Thompson 1967 *Organizations in Action*（McGraw-Hill，OpenLibrary）；
  Beer 1972 *Brain of the Firm*（OpenLibrary）；Williamson 1975 *Markets and Hierarchies*（Free Press，
  OpenLibrary）；Baldwin & Clark 2000 *Design Rules Vol. 1*（MIT Press，OpenLibrary 记 1999/2000）；
  Ostrom 1990 *Governing the Commons*（CUP，OpenLibrary 仅命中德译本与 CUP 记录）。
- **未核验（模型知识）**：Lawrence & Lorsch 1967；Galbraith 1973；Davis & Lawrence 1977；
  Tushman & Romanelli 1985；Williamson 1971／1985；Marschak & Radner 1972；Ashby 1958；
  Beer 1979／1985；von Foerster 1974／1981；Wiener 1948；Cannon 1932；Maturana & Varela 1980；
  Prigogine 1967／Prigogine & Stengers 1984／Nicolis & Prigogine 1977；Bak 1996；Holland 1975／
  1995／1998；Bratman 1987／1992；Rao & Georgeff 1995；Agha 1986；
  Lesser & Corkill 1981；Clearwater 1996；Duncan 1976；David 1985；Vickrey
  1961；Groves 1973；Myerson 1981；Luhmann 1984；Mingers 1995；Jensen 1998。

### 8.3 LLM／agent 侧（F 正文补核、A 摘要、T 题录）

- **(F)** 2406.07155v3 · 2609.38327v2 · 2608.12371v1, 版本、作者与读取范围见 §5.4。
- **(A)** 2607.25446 · 2609.14767 · 2608.07583 · 2609.33871 · 2608.26081 · 2608.10153 ·
  2609.17419 · 2609.33768 · 2603.25928 · 2503.13657 · 2502.11133 · 2410.11782 · 2411.04468 ·
  2510.01285 · 2606.22203 · 2610.00954 · 2605.14892 · 2206.07682 ·
  2304.15004 · 2506.07398
- **(T)** 2310.02170 · 2507.01701 · 2602.19843 · 2609.36739 · 2606.03083 · 2609.02580 · 2606.29113 ·
  2608.14613 · 2512.18094 · 2608.05956 · 2609.15079 · 2603.12465 · 2605.03986 · 2608.03524 · 2607.13272
- 说明：以上均为 **2026-10-13 采集时点**的 arXiv 元数据；2610.* 多为 v1 预印本，评审状态未核验
  （摘要 comment 字段自述者除外：2406.07155=ICLR-2025、2603.25928=ASE 2026、2206.07682=TMLR 2022）。

### 8.4 原侦察端点状态

本表记录原侦察窗口, 不覆盖后续各补核件已成功的正文入口。

| 端点 | 用途 | 本轮状态 |
|---|---|---|
| `export.arxiv.org/api/query` | arXiv API | **429**（未使用） |
| `arxiv.org/search/?searchtype=all&query=` | 发现（元数据检索） | 200，作为主发现通道 |
| `arxiv.org/abs/<id>` | 摘要／日期／comment 核验 | 200 |
| `api.crossref.org/works?query.bibliographic=` 与 `/works/<doi>` | 期刊书目＋摘要核验 | 200（主核验通道） |
| `openlibrary.org/search.json` | 书籍书目 | 间歇失败／版本噪声 |
| `googleapis.com/books/v1/volumes` | 书籍书目（备选） | 全查询空返回，判定不可用 |
| `en.wikipedia.org/api/rest_v1/page/summary` 与 `action=parse` | 仅作**方向性**二手核验 | 间歇 502／非 JSON |
| `api.semanticscholar.org/graph/v1/paper/search` | 引用图与计数 | **429** 全轮（未使用） |
| `web_search` 工具 | 通用检索 | **HTTP 402**（按要求弃用） |

### 8.5 二手来源

可承载有限内容引用的权威学术二手：Fioretto/Pontelli/Yeoh 2018, *JAIR* 61:623-698,
DOI 10.1613/jair.5565, arXiv:1602.06347v4 §4.3.4、Table 4。只引用其对 ADOPT 的归纳,
不冒充 ADOPT 原作定理已核。其余以下百科仍只作方向线索。

本批新增可承载有限内容引用的权威学术二手：Puche Regaliza, Jiménez, Arranz Val,
"Diagnosis of software projects based on the Viable System Model", *Systemic Practice and
Action Research*, DOI 10.1007/s11213-019-09491-y（VSM 五子系统与递归转述; 图注转引
Beer 1985 p.136）; Hutchinson & Warren, "Information warfare: using the VSM as a framework
to attack organisations", *Australasian Journal of Information Systems* 9(2), 2002
（五子系统功能分列与递归转述）; Brailas, "Replication Crisis in Psychology, Second-Order
Cybernetics, and Transactional Causality", *Integrative Psychological and Behavioral
Science*, DOI 10.1007/s12124-024-09867-3（PMC11711560; 二阶控制论概念层转述, 引 von Foerster
1984/2003 转载版本）。三者只承载各自转述句, 不冒充经典原作。

第四批新增 Di Paolo 2005，*Phenomenology and the Cognitive Sciences* 4:429–452，
DOI `10.1007/s11097-005-9002-y`，[作者自存已刊版](https://ezequieldipaolo.net/wp-content/uploads/2011/10/autopoiesis_teleology_2005.pdf)。
定义引 Weber & Varela 2002 p.115，脚注 6 转述 1974 极简模型，pp.436–437 与脚注 8 是转述方评估。
来源身份、SHA 与定位见[第四批边界](supplements/03-autopoiesis-and-org-boundaries-20261014.md)，
该范围符合原判据的权威二手条件，不冒充 Maturana/Varela 的原话或全部边界。

Wikipedia 条目：Contingency theory · Matrix management · Transaction cost · Transactive memory ·
Variety (cybernetics) · Viable system model · Second-order cybernetics · Autopoiesis · Self-organized
criticality · Dissipative system · Complex adaptive system · Stigmergy · Contract Net Protocol ·
Blackboard (design pattern) · Actor model · Belief–desire–intention model · Percolation theory ·
No free lunch in search and optimization · Emergence · Power law。
