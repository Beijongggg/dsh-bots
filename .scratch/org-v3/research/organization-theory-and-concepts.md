# 组织理论、复杂系统与多智能体协调的概念谱系 —— 纯概念侧研究报告

- 日期：**2026-10-13**
- 票据：[组织理论、复杂系统与控制论（纯理念面）](../issues/03-research-organization-theory-and-concepts.md)。
- 采集性质：建图前侦察的阶段性结果，已收编为该研究票交付物。研究票仍开放；经典侧只有书目与
  少量摘要，LLM 侧只读到题名／摘要，不能据此完成原文边界与实际借用方式的核验。
- 引用前先读票面 `Answer` 的关闭核对表。2026-10-13 修正撤销了对切换节奏、理论迁移及文献覆盖的
  过强推断；本次未补读经典全文，也未完成 LLM 正文与引用核验。
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
- 权威性分级（贯穿全文）：**一手**（原著／期刊页／arXiv 原文）＞**二手核验**（百科、课程页、
  综述的转述）＞`[未经一手来源核验]`（模型知识）。三者不混写。
- 阅读路由：核对概念与出处读 §1–§4；检查 LLM 借用线索读 §5；讨论设计假设读 §6；补核前读 §7。

---

## 0. TL;DR（先给结论，细节在后）

1. **任务匹配有可追查的理论线索**：权变理论、信息处理观、互依类型学与判别性对齐可用于提出
   "形态应与任务匹配"的假设。除 Galbraith 1974 的部分摘要外，相关原文论证和迁移条件尚待核验。
2. **切换节奏仍是设计假设**：间断平衡、团队中点转变与结构惯性值得补读，但 Gersick 1988 连摘要
   都未取得。当前不能从这些书目推出"形态只能在里程碑切换"，也不能把人类组织观察直接移作
   agent 组织的频率限制（§1.7、§6.3）。
3. **物理意义的相变主张需要形式证据**：序参量、控制参数、尺度标度与零模型是候选核验项。
   本项目沿用"相变"作为设计用词，还是改称"形态切换"，留给形态决议；研究不代替术语裁定。
4. **摘要提供了形式化候选，不等于已核验达标**：arXiv:2609.38327 与 2609.17419 可继续查正文。
   MacNet（arXiv:2406.07155）已读摘要使用 logistic growth 与 collaborative emergence；这只说明
   摘要措辞，不能代替对全文是否建立相变模型的判断。
5. **SOC 的边界**：幂律不可辨识、临界≠最优；借用必须连**机制**（慢驱动／阈值／时间尺度分离）
   与**检验**一起借用，否则是贴标签（§2.2）。
6. **阿什比定律可启发元层问题**：限制任务入口、提供默认形态、增强探测是候选方案。哪条更便宜
   需要成本数据；定律原文与向选择器的映射仍待核验（§3.1、§6.5）。
7. **团队理论值得补读**：信息结构与延迟和本项目问题相近，但同一目标配置不证明成员行为目标一致。
   未做引用图或正文核验，不能称它"最少被借用"或"最可迁移"（§1.10、§4.3）。
8. **没有免费午餐的迁移条件待核**：Wolpert & Macready 1997 的书目不构成对组织路由器的定理证明。
   声明评测的任务分布是可取的方法建议，不由此推出必须冻结现实任务分布（§6.7）。
9. **承诺机制是候选风险面**：BDI／联合意图在当前题名与摘要样本中缺少明确借用，正文仍待查。
   应区分任务间独立选形与任务内反复迁移，前者本身不等于抖动（§4.7、§6.11）。
10. **LLM 摘要中的警告线索**：收益可能很小（MAST 2503.13657），协调可能放大错误传播风险
    （2605.14892），选择器指标不保证部署收益（RouteGuard 2608.07583）。具体实验与适用条件待核。
11. **本轮检索空白（标题＋摘要面）**：矩阵组织、双元性、间断平衡、TMS、DCOP、交易成本、actor
    模型、BDI 在 LLM 多智能体文献中未见明确借用；相邻替代物是拓扑搜索／路由、层级记忆、状态机
    ＋动态雇佣（§5.2）。**"检索不到"受 §7 的方法限制，不等于不存在。**
12. **证据上限**：经典侧**只有书目与少量摘要**，无全文；LLM 侧**全部为摘要级作者自述**。本文件
    是问题清单与判据来源，不是"已确证"依据（§7）。

---

## 1. 组织理论：从权变到多中心

本节核验状态：Crossref／OpenLibrary 多数只核验到篇名、年份与刊社。除明确标出已读摘要引文外，
各条"核心主张"与"边界"均是待回原文的概念整理。这些条目暂只提供检索线索，原文依据补齐后
才能支撑下游决议。

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

### 1.2 Lawrence & Lorsch：分化与整合

- **核心主张**：组织须**同时**做到分化（differentiation：各子单元在结构、时间视野、目标取向、
  人际导向上产生差异）与整合（integration：跨单元协作的质量）；绩效取决于二者与**各子环境不确定性**
  的匹配，而非某一维度的极值。
- **一手**：Lawrence, P. R. & Lorsch, J. W. (1967). *Organization and Environment: Managing
  Differentiation and Integration*. Boston: Harvard University（本轮**仅二手核验**：Wikipedia
  "Contingency theory" 参考文献行）。
- **边界整理，原文待核**：分化越高，整合成本越高——理论**同时**给出「必须分化」与「分化的
  代价」，并不承诺"整合越多越好"；成功企业的整合装置与所需分化程度**相称**，且整合者靠专业能力
  而非正式职权获得影响力（细节 `[未经一手来源核验]`）。它所断言的是**拟合（fit）**，不是最优点。

### 1.3 Galbraith：信息处理观

- **核心主张**：组织形式的差异可由**信息处理**解释——任务不确定性越高，决策所需信息量越大，而
  认知能力有限（直接承接 Simon 的有限理性），因此设计问题等于把信息处理需求与信息处理能力对齐。
  四种设计策略：① 冗余资源（slack resources）② 自足任务（self-contained tasks）③ 纵向信息
  系统投入 ④ 横向关系（lateral relations）。
- **一手**：Galbraith, J. R. (1974). "Organization Design: An Information Processing View",
  *Interfaces* 4(3):28–36，DOI 10.1287/inte.4.3.28（本轮 Crossref **核验，且摘要原文**：
  "The purpose of this paper is to explain why task uncertainty is related to organizational form. In so
  doing the cognitive limits theory of Herbert Simon was the guiding influence."）。另见 Galbraith
  (1973)《Designing Complex Organizations》`[书目未经一手来源核验]`。
- **边界整理，原文待核**：四种策略**都有成本**，选择是"在成本约束下最小化信息处理负担"，不存在免费
  形式；模型以**不确定性可被刻画**、信息处理负担可估为前提；它解释形式差异，不预测哪种形式绝对
  更优。**这是本设计"按任务选形态"最直接的理论祖先。**

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

### 1.5 矩阵组织及其已知病理

- **核心主张**：当**两个维度同时真实且持续竞争资源**（如职能效率 × 项目／产品响应）时，用双重
  汇报线（solid + dotted line）同时满足两者。理论定位是"用结构承载无法归约的双重压力"。
- **一手**：Davis, S. M. & Lawrence, P. R. (1977). *Matrix*. Reading, MA: Addison-Wesley
  `[书目未经一手来源核验]`；Bartlett, C. A. & Ghoshal, S. "Matrix Management: Not a Structure, a
  Frame of Mind", *Harvard Business Review*，1990 年 7–8 月号 `[年份未经一手核验；Crossref 仅匹配
  到 1988 年他刊条目]`；Sy, T. & Côté, S. (2004). "Emotional intelligence: A key ability to succeed
  in the matrix organization", *Journal of Management Development* 23(5)，DOI
  10.1108/02621710410537056（本轮 **Crossref 核验，摘要原文**："Despite its strengths, the matrix
  has inherent problems."）。
- **病理（文献一致口径）**：双上司导致的**权限冲突与决策瘫痪**、问责归属模糊、会议与协调开销高、
  资源争夺与权力失衡、**"矩阵失败多因管理能力而非结构"**（故有"不是结构而是心态"之说）。Sy &
  Côté 摘要明确把早期研究归为"集中在结构性解释"，并转向个体能力（情商）解释（原文口径）。
- **边界整理，原文待核**：矩阵**仅**在两个维度都真实、都需长期存在、且不确定性高、信息处理
  需求大时才成立；当某一维度占主导、成本压力大、或管理者缺乏协商能力时**禁忌**。矩阵不是"更多
  协调"，而是**用冲突换响应速度**——它把冲突制度化，而不是消除冲突。

### 1.6 模块化：Baldwin & Clark（与 Simon 的近可分解性）

- **核心主张**：把复杂系统分解为**可独立设计**的模块，模块间仅由**可见设计规则（design rules /
  architecture）**耦合，从而把"一个难的全局设计问题"变成"多个可并行的局部设计问题 + 一套接口"，
  并因此获得**选择权价值**（大量并行实验、低耦合、可替换）。
- **一手**：Baldwin, C. Y. & Clark, K. B. (2000). *Design Rules, Volume 1: The Power of Modularity*.
  Cambridge, MA: MIT Press（本轮 OpenLibrary **书目记录核验**：MIT Press，记录年 1999/2000）；
  Simon, H. A. (1962). "The Architecture of Complexity", *Proceedings of the American Philosophical
  Society* 106(6):467–482（近可分解性、稳定中间形态加速演化）`[书目未经一手来源核验]`；
  Langlois, R. N. "Modularity in technology and organization"（Crossref 命中其 2000 年 SSRN 版
  "Modularity in Technology, Organization, and Society"；期刊版 `[未经核验]`）。
- **边界整理，原文待核**：① 模块化**以一套稳定且被共同遵守的可见设计规则为前提**，规则本身
  的设计与维护是集中成本；② **模块必须可测**——没有模块级测试，就没有模块化的收益（测试成本可能
  吃掉全部收益）；③ 模块化是**要行使的期权**，不行使则不产生价值；④ 分界一旦定错会锁死系统级
  创新（整体式架构在系统级创新上可能更优，Langlois 论点）`[具体论证未经一手核验]`。

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
- **内容核验缺口**：Gersick 1988 只核到书目，未取得摘要或全文。"中点转变"的样本、时间定义、
  因果解释和边界均 `[未经一手来源核验]`；上列其他文献也未完成全文核验。
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

- **核心主张**：治理结构（市场／混合／层级）应与交易属性**判别性对齐**（discriminating alignment），
  以节约交易成本。关键属性是**资产专用性**（asset specificity）、不确定性、频率；行为假设是
  **有限理性 + 机会主义**。资产专用性高 → 市场治理易被套牢 → 层级（内部化）更省。
- **一手**：Williamson, O. E. (1975). *Markets and Hierarchies: Analysis and Antitrust Implications*.
  New York: Free Press（OpenLibrary **书目记录核验**：1975，The Free Press）；(1985)《The Economic
  Institutions of Capitalism》`[未经一手来源核验]`；(1971) "The Vertical Integration of Production:
  Market Failure Considerations", *AER* 61(2) `[未经核验]`。
- **边界整理，原文待核**：① 理论自身**承认市场与层级并非穷尽**——混合形态与关系型契约是其
  一部分，"二元对立"是对该理论的常见简化；② 分析单位是可分离的交易，对不可分离、长期、高频互动的
  情形，理论给出的恰恰是内部化／关系治理；③ 该理论是**比较成本**论证，不是"层级更高级"的目的论。
  批评（本轮**核验标题与出处**）：Ghoshal, S. & Moran, P. (1996). "Bad for Practice: A Critique of
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

- **核心主张**：**多中心（polycentric）**＝许多相互独立、但彼此纳入考量的决策中心，辖区重叠、
  规则嵌套；长期存续的公共池塘资源制度既非纯市场也非纯国家，而是多中心的。经验上提炼出边界清晰、
  规则与本地条件相符、集体选择安排、监督、分级制裁、冲突解决机制、权利被承认、嵌套企业等设计原则。
- **一手**：Ostrom, E. (1990). *Governing the Commons: The Evolution of Institutions for Collective
  Action*. Cambridge University Press（OpenLibrary 命中其德译本与 CUP 记录，**书目记录核验**但
  未逐条核验）；Ostrom, E. (2010). "Beyond Markets and States: Polycentric Governance of Complex
  Economic Systems", *American Economic Review* 100(3):641–672，DOI 10.1257/aer.100.3.641（Crossref
  **核验**）；设计原则条款 `[未经一手来源核验]`。
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

本节核验状态：物理与网络科学条目（Bak 1987、Bettencourt 2007、West 1997、Beggs & Plenz 2003、
Anderson 1972、Grassé 1959、Dorigo 1996）本轮经 Crossref DOI 记录核验到**篇名／年份／期刊**
（部分含摘要原文）；其**内容陈述**除标注处外属通行教科书知识，未逐条回一手全文。
书籍（Bak 1996、Holland 1975/1995/1998、Nicolis & Prigogine 1977、Prigogine & Stengers 1984）
书目本轮**未能**经一手书目源确认，按 `[未经一手来源核验]` 处理。

### 2.1 相变与序参量：形式含义（本节是全篇类比纪律的基准）

- **形式定义（事实）**：相变指系统宏观态随**控制参数**（温度、密度、阈值、耦合强度）越过
  **临界值**时发生定性改变；其严格标志是某个**序参量**（order parameter，一个在某一相中为
  零、另一相中非零的宏观量）在临界点**非解析**——不连续，或其导数发散。临界点上**关联长度
  发散**，系统无特征尺度，涨落呈幂律；**普适类**（universality class）意味着临界指数只依赖
  对称性与空间维度，不依赖微观细节 `[教科书知识，本轮未逐条回一手文献]`。
- **形式定义的推论（事实）**：真正的相变只在**热力学极限**（系统尺寸→∞）严格成立。**有限系统
  没有真正的非解析性**，观测到的是被"抹圆"的 crossover。要在有限数据上主张相变，标准做法是
  **有限尺度标度**（finite-size scaling）：看转变点的位置/陡度如何随 N 移动，并与**零模型**
  （独立、随机、无耦合基线）对照。因此"我们观察到相变"这句话，缺少序参量、控制参数、尺度标度
  与零模型四件套时，只是**隐喻**。
- **对组织的直接含义（事实层面的约束）**：把"组织形态"当作相，需要回答"序参量是什么"——可测、
  可复现、在"扁平相"与"层级相"取值不同。§5.4 的 arXiv:2609.38327 是本轮唯一给出形式处理的
  例子（吸收态相变），而它处理的是**搜索任务的成败**，不是"组织形式"。
- **边界整理，原文待核**：吸收态相变要求存在**吸收态**（进入即不可离开）。多 agent 组织一般没有
  吸收态（形态可逆、可再切换），借用该框架需先构造出等价物，否则是**范畴错误**（INFERENCE）。

### 2.2 自组织临界性（SOC）

- **核心主张**：Bak, Tang & Wiesenfeld 1987, "Self-Organized Criticality: An Explanation of 1/f
  Noise", *Physical Review Letters* 59(4):381–384（DOI 10.1103/PhysRevLett.59.381，本轮 Crossref
  核验篇名／年／刊）。沙堆模型：**慢驱动 + 局部阈值 + 时间尺度分离**，系统自行演化到临界点，
  **无需调参**，雪崩尺度分布呈幂律。
- **边界整理，原文待核**：SOC 的关键不是幂律本身，而是**机制**（慢驱动、阈值、分离时间尺度）；
  幂律分布**不可辨识**——大量非临界机制也能产生近幂律，故幂律不是 SOC 的证据。更重要的边界：
  **临界 ≠ 最优**；临界态意味着最大雪崩风险，不是最大效率 `[教科书知识；实证批评见 Jensen 1998
  《Self-Organized Criticality》一书，本轮未核验其书目]`。
- **LLM 侧的正面使用**：arXiv:2609.17419（*World Model Science*，2026-07-12）把 SOC、弱混沌、
  亚稳信念动力学**同时**用于长时程 LLM agent 轨迹，并明确使用 "null models"、"finite-size
  scaling"、"error avalanches"——即带零模型与尺度标度的用法，是本轮看到的**最规范**的临界语言
  借用。

### 2.3 涌现（emergence）

- **核心主张**：Anderson 1972, "More Is Different", *Science* 177(4047):393–396（Crossref 核验
  篇名／年／刊）：宏观性质不能简单由组分性质推出。
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
  artifact"，并提出耦合增益 γ 作为**可测控制量**与效度诊断。这是本轮最好的"理论被装饰性使用"
  的一手证词（原文口径）。

### 2.4 Stigmergy（媒介协调）

- **核心主张**：Grassé 1959, "La reconstruction du nid et les coordinations interindividuelles
  chez *Bellicositermes natalensis* et *Cubitermes* sp. la théorie de la stigmergie", *Insectes
  Sociaux* 6(1):41–80（Crossref 核验篇名／年／刊）：个体通过**改造环境**留下痕迹，痕迹刺激后续
  行动，协调不经直接通信。
- **算法化**：Dorigo, Maniezzo & Colorni 1996, "Ant system: optimization by a colony of cooperating
  agents", *IEEE Trans. SMC-B* 26(1):29–41（Crossref 核验）：信息素 + 正反馈 + 挥发。
- **边界整理，原文待核**：stigmergy 依赖**环境可持久修改、局部可读、读写成本低**；ACO 的已知失效
  是**停滞与信息素饱和**——正反馈若压过挥发，搜索多样性坍塌。故"共享环境即可自组织"不成立；
  需要**遗忘机制**（挥发）与**多样性注入**配对。
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

- **核心主张**：Holland 1975《Adaptation in Natural and Artificial Systems》、1992 "Complex
  Adaptive Systems"（*Daedalus* 121(1):17–30）、1995《Hidden Order》（**书目本轮未经一手来源
  核验**）：由大量适应性主体构成、通过**聚集、标识、非线性、流、多样性、内部模型、积木块**
  七个基本要素产生整体适应行为。
- **边界**：CAS 是**描述性框架**而非可反驳理论：它事后解释力强、预测力弱；"适应"预设了适应度
  或选择压力，在 agent 组织里这个量往往由设计者临时指定（任务奖励），因此"自组织出更适应的
  形态"容易被循环论证。**CAS 语言不构成对"组织形态会自己变好"的证据。**

### 2.7 标度律

- **核心主张**：West, Brown & Enquist 1997, "A General Model for the Origin of Allometric
  Scaling Laws in Biology", *Science* 276(5309):122–126（Crossref 核验，摘要原文确认"3/4 power
  law"与"space-filling fractal networks"假设）：从**空间填充分形输运网络 + 末端单元不随体型
  变化 + 能量耗散最小**推出 3/4 幂律。
- **城市标度**：Bettencourt, Lobo, Helbing, Kühnert & West 2007, "Growth, innovation, scaling,
  and the pace of life in cities", *PNAS* 104(17):7301–7306（Crossref 核验）：创新／财富等**超
  线性**（β≈1.15），基础设施**亚线性**（β≈0.85），并给出"pace of life"随规模加速的表述
  `[指数数值为学界通行转述，本轮摘要片段未逐字给数]`。
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

Pod 若要用"相变"这个词，唯一站得住的做法是把**序参量**（例如"层级深度／通道数／评审点数"或
"协调轮次占比"）与**控制参数**（任务不确定性、并行度）显式化，并给出零模型与尺度标度检验；
否则应在文档里改称"形态切换"（switching），不称相变。SOC 与临界语言只在**同时**报告机制
（慢驱动／阈值／时间尺度分离）与**检验**（幂律＋雪崩＋零模型）时才可借用；"临界＝高效"是理论
本身不支持的推断。涌现一词在本设计中应当限用于"弱涌现"，并附带度量敏感性检验。

---

## 3. 控制论、控制与自主

本节核验状态：Aulin-Ahmavaara 1979 与 Varela et al. 1974 经 Crossref **核验**（含摘要原文）；
Ashby 1956／1958 与 Beer 1972 为**二手／书目记录核验**（Wikipedia "Variety (cybernetics)" 的
参考文献行、OpenLibrary 记录）；Beer 1979／1985、von Foerster、Wiener、Cannon、Maturana & Varela
1980、Luhmann 1984 均 `[未经一手来源核验]`。

### 3.1 必要多样性（Ashby）及其对控制器的推论

- **核心主张**：**只有多样性才能吸收多样性**（only variety can absorb variety）。若扰动集合的
  多样性为 V(D)、调节器可资利用的多样性为 V(C)，则要保证本质变量（essential variables）停留在
  生存/可行域内，需 V(C) ≥ V(D)；不足的部分必须由**扰动衰减（attenuation）**或**调节器多样性的
  放大（amplification）**补偿。
- **一手**：Ashby, W. R. (1956). *An Introduction to Cybernetics*. London: Chapman & Hall；
  Ashby, W. R. (1958). "Requisite Variety and Its Implications for the Control of Complex Systems",
  *Cybernetica* 1(2):83–99（两条本轮均**仅二手核验**：Wikipedia "Variety (cybernetics)" 正文与
  参考文献行；定律的精确表述 `[未经一手来源核验]`）。
- **对控制器的三条推论（通行解释，`[未经一手来源核验]`）**：① 控制器必须**内建关于扰动的模型**，
  否则无法预置足够多样性；② 提高控制能力的两个方向是"堵住扰动"（缓冲／衰减）与"扩张控制器"
  （放大），后者有成本；③ 定律约束的是**实际需要被调节的多样性**，不是环境总多样性——**改变目标
  或改变边界，使某些多样性不再需要被调节，是候选方案**。其成本排序未在本报告测量。
- **边界**：定律不保证"更多多样性更好"；它不谈成本最优，只谈可行性（viability）。把"V(C) ≥ V(D)"
  读成"控制器越复杂越好"是超出其许可的推断（INFERENCE）。同时注意：对"**每任务切换组织形态**"这一
  元控制问题，Ashby 定律的适用对象是**形态选择器所面对的扰动**（任务分布 + 执行噪声），而不是
  单一任务的多样性——这一区分是 §6 的关键。

### 3.2 反馈、调节与稳态

- **核心主张**：调节＝通过负反馈把本质变量维持在目标区间（homeostasis）；反馈控制需要**可测偏差**、
  **可比对的设定点（setpoint）**与**可施加的作用量**。
- **一手**：Cannon, W. B. (1932). *The Wisdom of the Body*（稳态概念来源）；Wiener, N. (1948).
  *Cybernetics: Or Control and Communication in the Animal and the Machine*；Ashby 1948 年的
  homeostat（自适应稳态装置）`[三条均未经一手来源核验]`。
- **边界（对设计的直接约束）**：**没有设定点就没有稳态，只有漂移或振荡**。若本设计要用反馈机制
  自动调整组织形态，必须先定义"偏差"的测量与容许带（deadband）；否则控制器会追逐噪声，产生
  形态抖动（§6 详述）。

### 3.3 可生存系统模型（Beer）

- **核心主张**：任何可生存（viable）系统须具备五个子系统：S1 执行单元、S2 协调（抑制 S1 之间振荡）、
  S3 内部运行控制与资源分配、S3* 审计／ sporadically 稽核、S4 环境与未来（适应）、S5 政策与身份
  （系统整体方向）；并主张**递归（recursion）**：每个 S1 自身又是一个完整的可生存系统。核心工程
  手段是"**多样性工程**"（variety engineering）——用 S2/S3/S3*/S4 的设计平衡各层多样性。
- **一手**：Beer, S. (1972). *Brain of the Firm*. London: Allen Lane / Herder and Herder（OpenLibrary
  **书目记录核验**：1972）；(1979)《The Heart of Enterprise》；(1985)《Diagnosing the System for
  Organizations》`[两册未经一手来源核验]`。
- **边界／须注意**：VSM 常被表述为**诊断语言/分类法**而非可检验的预测模型；其"递归"与"多样性工程"
  概念清晰，但对"五子系统是否齐备即充分"缺少经验证伪路径 `[评估性判断，属 INFERENCE]`。
  **⇢ 本设计的"评审点"与"权限"几乎是 S3*/S5 的直译**——但 VSM 同时要求 S2 抑制单元间振荡，
  这一点在"形态频繁切换"的设计里通常缺席（INFERENCE）。

### 3.4 自创生（autopoiesis）

- **核心主张**：生命系统是**自我生产**的网络：系统自身的组分持续生产出构成该网络的组分，从而维持
  其**组织闭合（organizational closure）**；与环境的关系是"结构耦合"，环境只触发、不指定系统变化。
- **一手**：Maturana, H. & Varela, F. (1972／1980). *Autopoiesis and Cognition: The Realization of
  the Living*（Dordrecht: Reidel；Wikipedia "Autopoiesis" 二手核验其 1972 年首版）；
  Varela, F., Maturana, H. & Uribe, R. (1974). "Autopoiesis: The organization of living systems, its
  characterization and a model", *BioSystems* 5(4):187–196，DOI 10.1016/0303-2647(74)90031-8
  （Crossref **核验**，该记录无摘要）。
- **边界整理，原文待核**：自创生定义在**分子／生物**层面（组分由系统自身生产）；作者们反对把
  它直接照搬到社会系统。Luhmann 用自创生重构社会系统理论（1984《Soziale Systeme》`[未经核验]`）
  属**独立理论建构**，不等同于原作者的生物学主张。对软件/agent 组织：系统不能"生产自己的组分"
  到生物学意义，故自创生在此**几乎只能作隐喻**；可借用的只是"闭合"与"结构耦合"两个弱概念。

### 3.5 二阶控制论

- **核心主张**：把观察者纳入被描述系统——控制论应用于自身；观察者所做的**区分**决定了"什么是
  系统的状态"，因此描述总相对于观察者。
- **一手**：von Foerster, H. (1974). *Cybernetics of Cybernetics*；(1981)《Observing Systems》
  `[两条均未经一手来源核验]`；Wikipedia "Second-order cybernetics"（本轮二手核验）：其要义即
  "the role of the observer is appreciated and acknowledged rather than disguised"。
- **边界**：二阶控制论不提供控制律，它是**认识论立场**；其价值是防止把"我选定的状态变量"当作
  客观事实。**⇢ 对本设计最有用的一条：形态分类法本身是观察者的产物**——"扁平/层级/矩阵"的划分
  取决于切分方式，切换控制器所优化的目标函数同样是设计者选定的（INFERENCE）。

### 3.6 层级控制与"必要层级律"（law of requisite hierarchy）

- **核心主张**：Aulin-Ahmavaara 从 Ashby 的一般调节理论出发，扩展到**放大式调节（amplifying
  regulation）**，讨论社会层级的**存在条件**：在每层调节能力有界的前提下，调节一个给定规模的
  系统需要**最小数量的层级**（因此层级不是可随意去除的冗余，而是熵/能力约束下的一种必然）
  ——该文摘要原文（Crossref **核验**）："A cybernetic theory of hierarchical social systems is
  given, starting from an extension of Ashby's general theory of regulation and control to
  amplifying regulation. Regulation and control in human society are then discussed and the
  conditions for the existence of social classes and social hierarchy examined."
- **一手**：Aulin-Ahmavaara, A. (1979). "The Law of Requisite Hierarchy", *Kybernetes* 8(4)，
  DOI 10.1108/eb005528（Crossref **核验**；**该律的精确数学表述本轮未获一手**，故只引其问题域）。
- **边界**：该律的假设是"每层调节能力有界"，结论是**层级数量的下界**，而非"层级越多越好"；对
  agent 组织的具体含义（上下文窗口／注意力即"每层能力有界"）属**类比推理**（INFERENCE）。可与
  §1.10 的团队理论（延迟与信息成本决定层级深度）并列读作同一约束的两种表述。

### 对本设计的取舍含义（INFERENCE）

必要多样性律把"形态选择器"也纳入被约束对象：选择器的多样性需求来自**任务分布**，而它本身的实现
成本（评估、探测、通信）是真实的；因此合法的降负路径有三条——**衰减**（限制任务类型/入口）、
**放大**（更强的分类与探测）、**改目标**（让部分多样性不必被调节，例如允许某些任务不塌缩到最优
形态而是走默认形态）。稳态/设定点这一条则给出硬要求：没有"偏差"的定义与容许带，自动切换必然抖动。
"必要层级律"与团队理论共同说明：**层级深度是信息成本约束下的产物，不能仅凭偏好宣布取消**。

---

## 4. 前 LLM 的多智能体计算理论

本节核验状态：Smith 1980、Erman et al. 1980、Modi et al. 2005、Scerri et al. 2002、Wellman 1993、
Cohen & Levesque 1991、Grosz & Kraus 1996、Horvitz 1999、Wooldridge & Jennings 1995 均经 Crossref
**核验到篇名／年／刊／DOI**（部分含摘要）。Hewitt et al. 1973、Agha 1986、Bratman 1987、Rao &
Georgeff 1995、Lesser & Corkill 1981、Vickrey／Groves／Myerson 均 `[未经一手来源核验]`——注意
Rao & Georgeff 1995 本轮 Crossref 只匹配到同作者 1998 年 *Agent Technology* 章
（DOI 10.1007/978-3-662-03678-5_8），故 1995 ICMAS 版书目未核验。

统一判据：每条给"**它解决了什么问题**"与"**LLM-agent 组织是否面对同一问题**"。后者是本报告的
推断（INFERENCE），依据是 §5 的一手证据加机制分析，不是文献主张。

### 4.1 合同网协议（Contract Net Protocol, Smith 1980）

- **解决的问题**：在**没有中央调度器知道所有节点能力**的分布式问题求解器里分配任务。机制：
  任务通告（announcement）→ 投标（bidding，节点自估胜任度与成本）→ 授标（award）→ 执行与结果
  回报。把"分配"从全局知识问题转成**局部报价聚合**问题。
- **一手**：Smith, R. G. (1980). "The Contract Net Protocol: High-Level Communication and Control in
  a Distributed Problem Solver", *IEEE Transactions on Computers* C-29(12):1104–1113，DOI
  10.1109/TC.1980.1675516（Crossref **核验**；Wikipedia "Contract Net Protocol" 二手核验其"任务
  共享协议、近似密封拍卖"的定位）。
- **同一问题？是。** 但**投标可信度**是新的失效点：LLM 对自身胜任度的估计普遍校准差。本轮一手
  证据：arXiv:2608.12371（*MAS-DecStream / LLM-MR-CNP*，2026-07-19）明确把经典 CNP 扩展为
  "semantic CFP formulation, progressive context disclosure, multi-round proposal revision,
  negotiation memory, and deterministic validation"（摘要原文）——**"deterministic validation"正是
  为补投标不可信而加的外部校验**。
- **边界**：CNP 假设投标可比较且自估偏差有界，且通信成本低于集中调度的收益；投标轮次增加会推高
  通信与延迟（多轮修订尤其如此）。

### 4.2 分布式约束优化（DCOP）

- **解决的问题**：多个自治节点各自持有变量、约束跨节点，需要在不共享全部信息的前提下选一组赋值，
  并给出**质量保证**（最优性或误差界）。ADOPT 用异步搜索 + 界传播，在有限内存下保证最优。
- **一手**：Modi, P. J., Shen, W.-M., Tambe, M., Yokoo, M. (2005). "ADOPT: Asynchronous distributed
  constraint optimization with quality guarantees", *Artificial Intelligence* 161(1–2):149–180，DOI
  10.1016/j.artint.2004.09.003（Crossref **核验**）。
- **同一问题？部分同一，但条件缺失。** LLM-agent 团队确实产生跨 agent 约束（文件归属、接口一致、
  谁等谁的结果），但：① 约束结构通常是**运行中发现**的，不是事前声明的；② LLM 的成本/收益估计
  不是可加效用；③ LLM 无法给出 DCOP 意义上的最优性保证。可迁移的是**"带界/随时可停"的协调**
  与**不对称信息下的分布式搜索**这一形式框架，而非算法本身。**本轮检索未发现 LLM 多智能体文献
  明确使用 DCOP 框架**（§5 记为空白）。

### 4.3 团队理论（与 §1.10 同源，此处只记其"计算"面）

- **解决的问题**：目标一致但信息分散时，**决策架构本身**（谁观测、谁上报、谁决策、允许多大延迟）
  的最优化；Radner 1993 进一步把它做成带延迟与差错的并行信息处理模型。
- **同一问题？是，且几乎未被借用。** LLM-agent 系统的真实预算约束就是**延迟与 token**，而"哪个
  agent 该看什么、该向谁汇报"正是团队理论的变量。本轮检索（§5）**未发现**明确采用 team theory
  的 LLM MAS 论文；最接近的是把编排成本显式记账的工程论文（arXiv:2610.00954、2609.15079）。
  INFERENCE：这是本清单中**性价比最高的未开采理论**——它的假设（共同目标）恰恰是 agent 团队比
  人类企业更容易满足的。

### 4.4 机制设计与拍卖式协调

- **解决的问题**：当参与者有**私人效用**且可能策略性行为时，如何设计规则使个体理性行为收敛到
  合意的集体结果（激励相容、配置效率、收入）。拍卖是其在资源分配上的经典实例。
- **一手**：Vickrey (1961)、Groves (1973)、Myerson (1981) `[三条均未经一手来源核验]`；
  Wellman, M. P. (1993). "A Market-Oriented Programming Environment and its Application to
  Distributed Multicommodity Flow Problems", *JAIR* 1:1–23，DOI 10.1613/jair.2（Crossref **核验**：
  把市场均衡当作分布式协调的计算机制）；Clearwater 编 (1996)《Market-Based Control》`[未经核验]`。
- **同一问题？目前多数还不是。** LLM agent 通常**没有私人效用**（目标由外部配置），因此机制设计
  的核心难题（激励相容、策略性谎报）暂时不成立；被借用的主要是**市场/竞争的隐喻与预算分配**：
  本轮一手例子 arXiv:2609.02580（"Competitive Market Behavior of LLMs"）、2606.29113（"LLM Semantic
  Signaling Game and Mechanism Design"）、2608.14613（"Do LLM Agents Negotiate Rationally? A
  Mechanism-Design Framework for Verifiable Multi-Agent Interaction"）。**边界**：一旦给 agent 配置
  预算、声誉或相互评分，私人效用就出现，此时机制设计的假设（拟线性效用、无合谋、共同先验）会
  立刻变成必须检验的条件，而不是可以忽略的背景。

### 4.5 黑板系统（Hearsay-II）

- **解决的问题**：多个异构知识源（knowledge sources）在**不确定、部分证据**条件下协作，控制流不
  固定——由当前黑板状态**机会主义地**决定下一步激活哪个知识源；黑板持 hypothesis 结构，知识源
  彼此不直接通信。解决的正是"没有单一算法能解、需要多种专长交替上场"的问题。
- **一手**：Erman, L. D., Hayes-Roth, F., Lesser, V. R., Reddy, D. R. (1980). "The Hearsay-II
  Speech-Understanding System: Integrating Knowledge to Resolve Uncertainty", *ACM Computing
  Surveys* 12(2):213–253，DOI 10.1145/356810.356816（Crossref **核验**；Wikipedia "Blackboard
  (design pattern)" 二手核验其"整合多样专门模块 + 非确定性控制策略"的定位）。
- **同一问题？是，而且正被重新发现。** arXiv:2510.01285（2025-09-30，v2 2026-01-31）明确以黑板
  替代 master-slave：其摘要原文指出主从式"rely on a rigid central controller that requires
  precise knowledge of each sub-agent's capabilities, which is not possible in large-scale
  settings where the main agent lacks full observability over sub-agents' knowledge and
  competencies"；另有 arXiv:2507.01701 直接以黑板架构组织 LLM 多智能体。
- **边界（须强调）**：黑板成立的前提是**共享状态有明确定义的结构**（Hearsay-II 是语音假设格）
  与**可判定的控制启发式**；缺少这两者，黑板退化为不断膨胀的共享文本，反而成为上下文与一致性
  成本的中心。LLM agent 的"黑板"通常是自然语言记录，**结构弱、可判定性差**，这是该类比在本领域
  的主要风险（INFERENCE）。

### 4.6 Actor 模型

- **解决的问题**：并发计算中共享可变状态导致的竞态与锁问题。模型规定：一切皆 actor；actor 只通过
  异步消息通信、不共享状态；收到消息后可①局部决策②创建新 actor③发消息④决定如何处理下一条。
- **一手**：Hewitt, C., Bishop, P., Steiger, R. (1973). "A Universal Modular ACTOR Formalism for
  Artificial Intelligence", *IJCAI-73* `[书目未经一手来源核验；Crossref 只匹配到 Hewitt 1973 年
  POPL 的另一篇]`；Agha, G. (1986)《Actors: A Model of Concurrent Computation in Distributed
  Systems》`[未经核验]`。
- **同一问题？结构上同一。** 每个 agent 进程持有独立上下文（≈独立堆）、只能通过消息传递协作，
  这正是 actor 模型设定；因此 actor 世界的经典风险会原样重现：**消息丢失/乱序、死锁（互相等待）、
  孤儿 actor（发起者退出后无人回收）、无界创建（spawn 爆炸）**。这些在 Pod 语境中是运维级风险而
  非理论趣闻（INFERENCE，基于 §4.6 的模型性质与 Pod 的多进程形态）。
- **边界**：actor 模型给出的是**并发正确性**的语言，不给出协调效率或组织形态的判据；它不解决
  "谁该做什么"，只解决"如何在不共享内存下安全并行"。

### 4.7 BDI 架构

- **解决的问题**：资源受限下的实践推理：若每轮都从零重算最优行动，agent 会**抖动、丢承诺、被
  短期机会牵着走**。BDI 用**意图（intention）**作为承诺：意图一旦形成就约束后续推理（过滤掉与
  意图冲突的选项），并区分"盲目承诺／单心承诺／开放承诺"等不同承诺策略。
- **一手**：Bratman, M. E. (1987). *Intention, Plans, and Practical Reason*. Cambridge, MA: Harvard
  University Press `[未经核验]`；Rao, A. S. & Georgeff, M. P. (1995). "BDI Agents: From Theory to
  Practice", *ICMAS-95* `[书目未经一手来源核验]`；同作者 (1998) "Rational Software Agents: From
  Theory to Practice"，收于 *Agent Technology*，DOI 10.1007/978-3-662-03678-5_8（Crossref **核验**）。
- **同一问题？是，且是该领域最大的理论缺口。** LLM agent 每轮重新推理，天然缺少承诺机制：
  表现即"目标漂移、重复推翻已定方案、在无关分支上耗预算"。**BDI 的承诺策略直接对应到审查点与
  任务账本的设计**（何时允许推翻前案、谁来解封）。本轮检索未发现 LLM MAS 文献以 BDI 为框架
  （§5 空白）。INFERENCE：**没有承诺机制的"按任务切换形态"会把抖动制度化**。

### 4.8 联合意图与共享计划

- **解决的问题**：一群各自有理性的个体，何时才算**像团队一样行动**？Cohen & Levesque 给出形式
  条件：共同目标要成为**联合意图**，需要相互信念、对计划的共同承诺，以及**在他人子计划受阻时
  提供帮助的承诺（commitment to support）**；"我意图我们做 X"不等于"我们联合意图做 X"。
  Grosz & Kraus 进一步给出共享计划（shared plan）的递归构造与**意图形成时的"达成协议"过程**。
- **一手**：Cohen, P. R. & Levesque, H. J. (1991). "Teamwork", *Noûs* 25(4):487–512，DOI
  10.2307/2216075（Crossref **核验**）；Grosz, B. J. & Kraus, S. (1996). "Collaborative plans for
  complex group action", *Artificial Intelligence* 86(2):269–357，DOI
  10.1016/0004-3702(95)00103-4（Crossref **核验**）；Bratman, M. (1992) "Shared Cooperative
  Activity" *Philosophical Review* `[未经核验]`。
- **同一问题？是，且被**隐式**借用。** 本轮一手证据：arXiv:2411.04468（*Magentic-One*）的
  Orchestrator "plans, tracks progress"（摘要原文）——任务账本在功能上就是共享计划的外部载体；
  但**"帮助承诺"与"子计划受阻时的修复义务"在 LLM 团队里通常没有对应物**，这正好解释了 §5 中
  反复出现的交接失败（MAST 类失败）——INFERENCE，机制解释而非文献结论。

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
- **同一问题？几乎是同构的**：LLM agent 的上下文天生是部分且不一致的视图，任何"全局一致状态"都
  是幻觉。INFERENCE：FA/C 的路线（放弃全局一致性，靠冗余与迭代逼近）比"共享单一真相源"的路线
  更贴近 LLM 团队的现实——但代价是结果只能"功能上够用"，不能保证一致。

### 对本设计的取舍含义（INFERENCE）

前 LLM 理论给出的不是"更聪明的编排"，而是**把编排问题形式化**的四种坐标：CNP 管**任务分配与
投标可信度**，DCOP/团队理论管**信息结构与延迟**，BDI/联合意图管**承诺与修复义务**，可调自主性
管**权限转移**。四者在本轮 LLM 文献中的被借用程度差异很大（CNP 已复活并被加外部校验；黑板已
复活但失去形式结构；BDI 与团队理论基本缺席）。对本设计最要紧的一条：**围栏住"形态切换"的应当是
承诺机制（何时允许改形态、谁来解封），而不是更频繁的重新优化**。

---

## 5. 接口：LLM 多智能体研究实际借用了什么

本节全部为**本轮实采**。检索方式：arXiv 站内检索（HTML 界面）＋逐篇抓取 abs 摘要原文；
**未使用**引用图（Semantic Scholar 本轮 429 不可达，见 §7），因此"借用"的判据是**标题／摘要
明文**，不是被引关系。标注：**(A)**＝本轮已核验摘要原文；**(T)**＝仅题录（标题＋编号），未读摘要。
日期为 arXiv 提交日期。

### 5.1 确实被借用的（按理论与用法并列）

| 理论概念 | 论文（一手） | 怎么用的（摘要级证据） |
|---|---|---|
| 组织理论成为可执行配置 | **2607.25446** (A)，2026-07-28 *Toward an Organizational Science of Multi-Agent LLM Systems* | 把 Belbin 角色、Mintzberg 协调机制、RACI 问责"变成可执行、可校验的配置"；把"谁在队里(organization)／如何对齐(coordination)／用何算法融合(protocol)"拆成三层可独立替换 |
| 权威与层级（组织理论的直接检验） | **2609.14767** (A)，2026-09-13 *Loop-Back Authority in LLM Agent Teams* | 摘要明写"Organizational theory asserts that authority facilitates decision making"与"some nascent AI research suggests that revision under authority makes LLM output worse"；43 对产品、86 次运行的配对实验检验 manager 的退回权 |
| 任务自适应拓扑 | **2410.11782** (A) G-Designer；**2310.02170** (T) DyLAN | G-Designer 用 GNN 按任务生成通信拓扑，动机原文即"Which topology is the best choice for my task, avoiding unnecessary communication token overhead"；DyLAN 做动态 agent 网络与团队优化 |
| 形态/路由的显式选择（=本设计的元层） | **2502.11133** (A) MasRouter；**2608.07583** (A) RouteGuard | MasRouter 提出 MASR："integrates all components of MAS into a unified routing framework"（协作模式＋角色＋模型选择一起路由）；RouteGuard 证明**路由收益不可由 AUC 决定**，需条件 regret Φ 与认证区间 |
| 自组织团队（动态雇佣/自演化） | **2603.25928** (A) TheBotCompany；**2609.33768** (A) DEALS | TheBotCompany：三阶段状态机（Strategy→Execution→Verification）＋ manager agent 动态雇佣；DEALS：批评集中控制器与固定协调模式，要求 agent"self-organize and self-evolve"以适配任务流 |
| 规模与"协作涌现" | **2406.07155** (A) MacNet，ICLR-2025 | **用词是 "collaborative scaling law"：性能随 agent 数呈 logistic growth，且 "collaborative emergence" 早于传统神经涌现——摘要中并未出现 "phase transition" 一词**（本轮逐字核验，纠正二手转述） |
| 统计力学式相变（形式化最好的一篇） | **2609.38327** (A)，2026-09-29 *Absorbing State Phase Transitions in Multi-Agent Search* | 明确以吸收态相变形式化预测多智能体搜索成败：先按组合搜索经典结论把任务分四类，再"theoretically derive a critical c..."；同时点明动机是"designing multi-agent communication topology" |
| 临界/混沌/亚稳（含零模型与尺度标度） | **2609.17419** (A)，2026-07-12 *World Model Science* | 用 SOC、weak chaos、metastable belief dynamics 三视角研究长时程 agent，报告 "error avalanches"、"finite-size scaling"、"explicit null models"、"belief-basin transitions" |
| 自组织的可测化 | **2609.33871** (A)，2026-09-27 *Population Physics, Population Problems* | 提出"safety and emergence in LLM societies"的测量框架，用于 Schelling grid、Moltbook、Twitter 式信息污染模拟三个系统 |
| Stigmergy | **2608.26081** (A) SwarmWorld，2026-08-26 | 同质 LLM agent 在共享环境中无预设角色、无配方地留下痕迹并演化出"技术"；摘要明确对照"direct conversation, predefined roles, or centralized workflows" |
| 黑板架构 | **2510.01285** (A)；**2507.01701** (T) | 前者以黑板替代 master-slave，理由原文：主从式需要"precise knowledge of each sub-agent's capabilities"，而大规模下"the main agent lacks full observability" |
| 合同网协议 | **2608.12371** (A) LLM-MR-CNP，2026-07-19 | 在经典 CNP 上加"semantic CFP、progressive context disclosure、多轮提案修订、negotiation memory、deterministic validation" |
| 机制设计／市场 | **2608.14613** (A)；**2609.02580** (T)；**2606.29113** (T) | 前者以机制设计框架做"可验证的多智能体交互"与谈判理性检验；后两者分别研究 LLM 的市场竞争行为与语义信号博弈 |
| 控制论／CAS 的分工 | **2608.10153** (A) CASE，2026-08-10 | 明确"agentic AI governance is four problems, not one"：个体给控制论（intent=setpoint，guardrails=feedback，evaluation=observation）、集体给复杂适应系统理论（"emergence makes single-agent assurance non-compositional"）、人机给 supervisory cybernetics |
| 记忆与组织记忆 | **2506.07398** (A) G-Memory；**2609.36739** (T) Frontier Autolab；**2606.03083** (T) DELTAMEM | G-Memory：为 MAS 引入跨试验、按 agent 定制的层级记忆，批评既有 MAS 记忆"overly simplistic"；Frontier Autolab 标题即含"Organizational Memory, Adversarial Dissent"（**未核验摘要**） |
| 失败与可靠性 | **2503.13657** (A) MAST；**2602.19843** (T) MAS-FIRE；**2605.14892** (A) 综述 | MAST 建 1600+ 标注轨迹、跨 7 框架的失败分类；综述指出"tighter coordination also amplifies a less explored risk: errors can propagate across agents and interaction rounds" |
| 效度诊断（对该领域自身的批评） | **2606.22203** (A)，2026-06-20 | 原文批评："LLM 'agent societies' are studied via demonstrations of emergent consensus or polarization — with no measurable control parameter, no theory of when each regime appears, and no test of whether an outcome is a genuine social dynamic or a model artifact"；给出耦合增益 γ |
| 网络结构视角 | **2512.18094** (T)；**2608.05956** (T) | 小世界网络视角重述多智能体智能；Koopman 谱分析认证集体推理 |
| 成本记账 | **2610.00954** (A)；**2609.15079** (T)；**2603.12465** (T) | 把 agent 编排从"排行榜精度"推进到 token/能耗/延迟记账（"beyond leaderboard evaluation"） |

### 5.2 装饰性使用、误用与本轮**检索不到**的借用

1. **相变用词与形式化线索**：2609.38327 与 2609.17419 的摘要声称有形式化机制与检验；本轮未
   核验正文是否足以支撑。MacNet 已读摘要使用 logistic 增长与 collaborative emergence，不能单凭
   这些词确认相变，也不能因摘要未出现该词就断言全文没有相关论证。
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

| 论文 | 用语 | 形式化程度（本轮摘要级判断） |
|---|---|---|
| 2609.38327 | absorbing state phase transitions；critical condition | 摘要声称任务分类与临界条件推导，正文与适用前提待核 |
| 2609.17419 | self-organized criticality、weak chaos、metastable belief dynamics、finite-size scaling、null models | 摘要声称零模型与尺度标度，实际检验待核 |
| 2609.33871 | self-organisation 的统计测量 | 中：有测量框架与三系统对照，摘要未称"相变" |
| 2406.07155 | collaborative scaling law、logistic growth、collaborative emergence | 已读摘要是曲线拟合式表述，全文是否建立相变论证待核 |
| 2606.22203 | 批评"无控制参数"的伪涌现主张 | —（元层面批评） |

### 对本设计的取舍含义（INFERENCE）

当前样本给出自适应拓扑、选形与路由的研究线索，也提示计量元层收益与成本。间断平衡、BDI、团队
理论和 TMS 的实际借用情况尚待正文与引用核验；不能从题名／摘要未命中推导"没有同行经验"。
本节先提供待读样本，不据此作领域空白或方案优劣判断。

---

## 6. 设计警示与反论证

本节列设计假设、待核出处与可检查条件。经典文献的内容证据受 §7 限制，LLM 侧除另有标记外只是
摘要中的作者主张。它们不直接构成 Pod 的判据，切换节奏和取舍仍由下游决议确定。

### 6.1 选择形态本身的信息成本（不是免费的元层）

- **论证**：要"为任务选最省形态"，先要**知道任务是什么类型、各形态在该类型上的预期成本**。
  这是团队理论的核心变量：信息结构（谁观测什么）与其成本，决定了决策架构的优劣（Marschak &
  Radner 1972；Radner 1993，DOI 10.2307/2951495 核验）。Galbraith 1974 亦把"不确定性→信息处理
  负担→设计策略"写成成本问题（摘要原文已核验）。
- **一手证据（LLM 侧）**：MasRouter 2502.11133（A）把协作模式＋角色＋模型纳入统一路由，等于承认
  路由决策本身是一个要学的组件；RouteGuard 2608.07583（A）证明**路由收益不可由 gate 的 AUC 决定**，
  需要条件 regret 与认证区间——即"选形态"的好坏**不能靠选择器自评**。
- **咬人条件**：任务类型可廉价可靠地观测时，这一成本可忽略；不可观测时，选择器退化为猜测器，
  且其错误会直接变成形态错配。

### 6.2 切换与迁移成本

- **论证**：切换组织形态要重建接口、迁移上下文、重排权限与信任。TCE 的资产专用性说明：为特定
  形态投入的关系性资产（共享词汇、记忆、工具链）在切换时贬值（Williamson 1975 书目核验；1985
  未核验）。组织生态学给出更硬的版本：Hannan, M. T. & Freeman, J. (1984). "Structural Inertia and
  Organizational Change", *ASR* 49(2):149–164，DOI 10.2307/2095567（**Crossref 核验**）——结构惯性
  随规模、年限、正式化上升，变革能力下降。
- **迁移假设（INFERENCE）**：模块化理论条目尚未回核原文，不是 LLM 实验证据。对应到 agent，
  切换后原先的测试、账本与评审记录是否仍有效，需要逐项验证。
- **咬人条件**：切换成本随**状态量**（上下文、账本、记忆）与**耦合度**上升；只读任务与短任务
  成本低，长时程、强互依任务成本高。

### 6.3 振荡与迟滞

- **假设（INFERENCE）**：同一执行状态因带噪估计而反复迁移时，可能产生无收益的切换。任务间
  独立选形不自动构成抖动。迟滞、死区与最小驻留时间是可比较的控制策略，不是未经实验的默认答案。
- **证据边界**：Gersick 1988（DOI 10.2307/256496）只核到书目，不能支撑"每里程碑一次"。
  2606.22203 的已读摘要批评缺少可测控制参数与 regime 理论，也没有给出 Pod 的切换频率。
- **检查条件**：记录切换次数、状态是否反复迁移、切换耗时／成本与净收益，再判定是否需要防抖。

### 6.4 路径依赖与锁定

- **论证**：Arthur, W. B. (1989). "Competing Technologies, Increasing Returns, and Lock-In by
  Historical Events", *The Economic Journal* 99(394):116–131，DOI 10.2307/2234208（Crossref **核验**）：
  收益递增会使早期偶然选择锁定为长期均衡，且**锁定未必是有效率的那个**。David 1985 "Clio and the
  Economics of QWERTY" `[未经一手来源核验]` 是同一论点的著名案例。
- **对本设计的读法（INFERENCE）**：形态选择器一旦用**历史成功率**做先验（很自然的实现），就会
  形成自我强化：某形态被选中→积累更多适配它的记忆与工具→下次更可能被选中，即使另一形态在
  新任务分布上更好。缓解手段是**保留探索配额**与**定期在固定任务集上重测所有形态**。

### 6.5 阿什比定律用于"切换控制器"（元层的多样性缺口）

- **论证**：切换控制器要吸收的多样性来自**任务分布的多样性**，不是单任务的多样性。若 V(选择器)
  < V(任务分布)，选择器必然在未覆盖的区域系统性失准（§3.1）。提升选择器多样性的三条路都真实
  有成本：类目更细（观测成本、样本稀疏）、特征更多（探测成本）、权限更大（风险与误切代价）。
- **候选方案（INFERENCE）**：限制任务入口、给不可判定任务默认形态，或增强选择器的探测能力。
  成本需包含误判损失、探测及维护，当前没有证据给这些方案排序。

### 6.6 元层成为新瓶颈

- **论证**：VSM 的 S5/S3* 与二阶控制论都指出：负责"整体方向"与"稽核"的层级会自己变成需要被
  治理的对象（Beer 1972 书目核验；von Foerster `[未经核验]`）。若每次任务都要经过形态判定，
  判定环节就成为**串行瓶颈**：所有任务排队等一个判定器，且判定器需要全局视图——恰恰是黑板论文
  （2510.01285，A）批评主从式时说的"lacks full observability"。
- **一手证据**：Magentic-One 2411.04468（A）采取的是**单 Orchestrator 计划与跟踪进度**的结构——
  有效，但它把编排负载集中到一点；MasRouter/RouteGuard 则说明围绕这个点的决策质量与计量本身是
  研究问题。
- **咬人条件**：任务到达率高、形态需要全局信息（跨任务资源共享）时，元层瓶颈先于执行层饱和。

### 6.7 "没有免费午餐"式论证

- **待核出处**：Wolpert, D. H. & Macready, W. G. (1997). "No free lunch theorems for optimization",
  *IEEE Trans. Evolutionary Computation* 1(1):67–82，DOI 10.1109/4235.585893。当前只核到书目，
  定理的搜索空间、平均方式、算法条件及其向组织路由问题的映射均未复核。
- **方法建议（INFERENCE）**：报告形态比较适用的任务分布与基线。这个建议不等于现实任务必须
  稳定、分布必须预先完全已知，或必须冻结现实工作负载；不能把上述要求归给未经核验的定理。

### 6.8 矩阵／动态组织在管理实践中的已知失败

- **一手证据**：Sy & Côté 2004（DOI 10.1108/02621710410537056，摘要核验）"Despite its strengths,
  the matrix has inherent problems"，并把早期解释归为结构主义、转向个体能力（情商）；Bartlett &
  Ghoshal 的"不是结构而是心态"（HBR，1990，年份 `[未经核验]`）说明矩阵的成败取决于**管理者的
  协商与冲突处理能力**而非结构图。
- **证据边界**：Ostrom 2007（DOI 10.1073/pnas.0702288104）的已读摘要反对普遍解。间断平衡与
  Gersick 中点转变的原文仍待核验，不能用这些书目证明动态 agent 组织应按某一节奏切换。
- **咬人条件**：动态/双重结构在没有（a）冲突协商机制、（b）明确问责归属、（c）能容纳两套逻辑的
  高层整合时，会退化为**决策瘫痪 + 开销膨胀**——这正是矩阵的经典病理。

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

本节区分三类盲区：**工具不可达**（导致覆盖缺口）、**一手不可读**（导致内容只能标未核验）、
**方法限制**（导致结论强度上限）。

### 7.1 工具不可达与由此产生的覆盖缺口（事实）

1. **web_search 全轮不可用**（任务书给出：HTTP 402）。已按要求弃用；改用 arXiv 站内检索（HTML）、
   Crossref REST、OpenLibrary、Google Books、Wikipedia REST。**后果**：面向**实践**的文献
   （HBR 档案、咨询报告、企业矩阵制失败复盘、管理学期刊的实务评论）本轮基本没覆盖；§1.5 与
   §6.8 的"已知失败"因此主要来自学术摘要与教科书式共识。
2. **Semantic Scholar API 全轮 429**（"Too Many Requests"），即使 sleep 后仍 429。**后果**：
   没有引用图与引用计数，"哪些概念被借用／被装饰性使用"的判据只能是**标题与摘要明文**；无法
   回答"某论文是否在正文引用了 Wegner／Cohen & Levesque／Smith 1980"。因此 §5.2 第 4 条的
   "检索不到"**只**在标题/摘要面成立。
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

本轮**没有**任何经典原著的全文或付费墙访问。可核验到的是**书目与摘要**（Crossref／OpenLibrary／
Wikipedia 参考文献行）。因此以下内容属于模型知识，已在正文就地标注，**引用前必须回一手**：
Burns & Stalker 1961 的机械式/有机式条目细节；Lawrence & Lorsch 1967 的行业样本与整合装置结论；
Thompson 1967 的互依—协调方式映射原文；Galbraith 1973 的四策略清单（1974 论文摘要只核验了
"任务不确定性→组织形式"与 Simon 认知极限这一主旨）；Davis & Lawrence 1977 的矩阵病理清单与
失败率；Baldwin & Clark 2000 的"模块化期权"与"测试成本"论证；Simon 1962 的近可分解性陈述；
Tushman & Romanelli 1985 的收敛/再定向表述；Williamson 1971／1985 的原文措辞；
Marschak & Radner 1972 的定义与定理；Wegner 1985／1987 的 TMS 机制细节；Ostrom 1990 的八项设计
原则条款原文；Ashby 1956／1958 的定律精确形式；Beer 1979／1985 的 VSM 子系统定义细节；
Maturana & Varela 1980 的自创生判据；Prigogine 系列与 Holland 系列的原文主张；Bak 1996 的 SOC
机制表述。
**另需单独标出（本轮想核验但未成功）**：*Gersick 1988 的"中点转变"具体结论*——本轮只经 Crossref
核验到篇名／年／刊／DOI（10.2307/256496），**未取得摘要或原文**，其"约在一半时限发生集中转变、
由时间里程碑触发"的表述 `[未经一手来源核验]`。§6.3／§6.8 已停止以它支撑切换节奏限制。
同理，Aulin-Ahmavaara 1979 的"必要层级律"**精确数学表述**未获一手（只核验了摘要中"从 Ashby 理论
扩展到放大式调节、并考察层级存在条件"的问题域）。

### 7.3 书目核验失败的条目（引用须补核）

Simon 1962（Crossref 命中无关条目）；Rao & Georgeff 1995 ICMAS（Crossref 只匹配到同作者 1998 章）；
Hewitt, Bishop & Steiger 1973 IJCAI（Crossref 只匹配到 Hewitt 1973 POPL 另一篇）；Tushman &
Romanelli 1985（ROB 第 7 卷，无 DOI 命中）；Davis & Lawrence 1977《Matrix》；Bartlett & Ghoshal
1990 HBR 的年份；Duncan 1976 章节；Langlois 2002 期刊版；Lesser & Corkill 1981；Bratman 1987／
1992；Clearwater 1996；Vickrey 1961／Groves 1973／Myerson 1981；Nicolis & Prigogine 1977；
Bak 1996；Holland 1975／1992／1995／1998；Prigogine & Stengers 1984；Maturana & Varela 1980；
von Foerster 1974／1981；Wiener 1948；Cannon 1932；David 1985；Beer 1979／1985；Galbraith 1973。

### 7.4 方法限制（结论强度上限）

1. **LLM 侧证据全部是摘要级作者自述**，未复现任何实验、未读正文、未核验代码。§5 中 (T) 标记的
   条目**只核验了标题**。作者摘要是**主张**，不是独立验证过的事实。
2. **未核验同行评审状态**（除摘要 comment 字段自述者：MacNet=ICLR-2025、TheBotCompany=ASE 2026、
   Wei et al.=TMLR 2022）；2026 年 10 月前后的 2610.* 条目多为 v1 预印本。
3. **"借用强度"是本报告的构造**，不是文献计量指标；它由"标题/摘要是否明文使用该概念"定义，
   分级含判断成分，已在 §5 标注依据。
4. **本文件不含对 Pod 代码库的任何事实主张**（任务范围为纯概念侧）；§1–§6 中所有"对本设计的
   含义"均为 INFERENCE，未经仓库事实核验，也未考虑 Pod 现有实现约束。
5. **单一采集时点**：2026-10-13。arXiv 列表与 API 状态此后可能变化；引用前回读 §8 端点。

### 对本设计的取舍含义（INFERENCE）

本文件可提供问题与检索线索，不能替代原文核验。经典理论的原文边界、借用与修辞的区分以及 LLM
正文引用都归现有[组织理论、复杂系统与控制论](../issues/03-research-organization-theory-and-concepts.md)逐项补核。
这些缺口覆盖原票核心问题，故研究票保持开放；不以另开票或移入雾面绕过当前关闭门。

---

## 8. 来源表

正文引用一律**就地**给 DOI 或 arXiv 编号；本节是索引与核验方式说明，不重复正文论证。

### 8.1 经典一手：期刊／章节（Crossref 核验到篇名／年／刊／DOI）

- Galbraith 1974, *Interfaces* 4(3):28–36 — `10.1287/inte.4.3.28`（**含摘要原文**）
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
- Anderson 1972, *Science* 177(4047):393–396 — `10.1126/science.177.4047.393`
- Georgeff & Rao 1998, in *Agent Technology* — `10.1007/978-3-662-03678-5_8`
- Langlois 2000, "Modularity in Technology, Organization, and Society"（工作论文版） — `10.2139/ssrn.204089`
- Ostrom 2010, *AER* 100(3):641–672 — `10.1257/aer.100.3.641`

### 8.2 经典一手：书籍（核验方式受限，见 §7.2）

- **书目记录核验**：Burns & Stalker 1961 *The Management of Innovation*（Tavistock；Wikipedia 参考
  文献行＋Crossref 1994 OUP 版）；Thompson 1967 *Organizations in Action*（McGraw-Hill，OpenLibrary）；
  Beer 1972 *Brain of the Firm*（OpenLibrary）；Williamson 1975 *Markets and Hierarchies*（Free Press，
  OpenLibrary）；Baldwin & Clark 2000 *Design Rules Vol. 1*（MIT Press，OpenLibrary 记 1999/2000）；
  Ostrom 1990 *Governing the Commons*（CUP，OpenLibrary 仅命中德译本与 CUP 记录）。
- **未核验（模型知识）**：Lawrence & Lorsch 1967；Simon 1962；Galbraith 1973；Davis & Lawrence 1977；
  Tushman & Romanelli 1985；Williamson 1971／1985；Marschak & Radner 1972；Ashby 1956／1958；
  Beer 1979／1985；von Foerster 1974／1981；Wiener 1948；Cannon 1932；Maturana & Varela 1980；
  Prigogine 1967／Prigogine & Stengers 1984／Nicolis & Prigogine 1977；Bak 1996；Holland 1975／1992／
  1995／1998；Bratman 1987／1992；Rao & Georgeff 1995；Hewitt, Bishop & Steiger 1973；Agha 1986；
  Lesser & Corkill 1981；Clearwater 1996；Duncan 1976；David 1985；Bartlett & Ghoshal 1990；Vickrey
  1961；Groves 1973；Myerson 1981；Luhmann 1984；Mingers 1995；Jensen 1998。

### 8.3 LLM／agent 侧（arXiv；**(A)**＝摘要原文已核验，**(T)**＝仅题录）

- **(A)** 2607.25446 · 2609.14767 · 2608.07583 · 2609.38327 · 2609.33871 · 2608.26081 · 2608.10153 ·
  2609.17419 · 2609.33768 · 2603.25928 · 2503.13657 · 2502.11133 · 2410.11782 · 2411.04468 ·
  2510.01285 · 2608.12371 · 2606.22203 · 2610.00954 · 2605.14892 · 2406.07155 · 2206.07682 ·
  2304.15004 · 2506.07398
- **(T)** 2310.02170 · 2507.01701 · 2602.19843 · 2609.36739 · 2606.03083 · 2609.02580 · 2606.29113 ·
  2608.14613 · 2512.18094 · 2608.05956 · 2609.15079 · 2603.12465 · 2605.03986 · 2608.03524 · 2607.13272
- 说明：以上均为 **2026-10-13 采集时点**的 arXiv 元数据；2610.* 多为 v1 预印本，评审状态未核验
  （摘要 comment 字段自述者除外：2406.07155=ICLR-2025、2603.25928=ASE 2026、2206.07682=TMLR 2022）。

### 8.4 检索与核验端点（含本轮状态）

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

### 8.5 二手来源（仅用于方向性定位，不承载理论主张）

Wikipedia 条目：Contingency theory · Matrix management · Transaction cost · Transactive memory ·
Variety (cybernetics) · Viable system model · Second-order cybernetics · Autopoiesis · Self-organized
criticality · Dissipative system · Complex adaptive system · Stigmergy · Contract Net Protocol ·
Blackboard (design pattern) · Actor model · Belief–desire–intention model · Percolation theory ·
No free lunch in search and optimization · Emergence · Power law。
