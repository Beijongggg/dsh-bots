# 补核：相变、弱涌现、耗散结构、渗流与机制设计

所属票：[组织理论、复杂系统与控制论](https://github.com/Beijongggg/dsh-bots/issues/6)。
基线 `85c0894119d8ea511609395e78910d382a309b99`；范围限原报告 §2.1/2.3/2.5/2.8/4.4 的五条主张。
采集日期 2026-10-15；原文读取与概念核验，不运行论文代码或实验。量化两臂、预算与分母不适用。
缓存根 `/tmp/wayfinder-03-systems-20261015/`；文件名与完整 SHA-256 如下，`fetch-log.json` 保存请求时刻与结果。

## 来源与读取层级

| ID | 来源、版本与 URL | 实读范围与层级 | 缓存及 SHA-256 |
|---|---|---|---|
| P1 | David Tong, *Statistical Physics*, ch.5, Cambridge 作者教学页；页面未标本版日期；`https://www.damtp.cam.ac.uk/user/tong/statphys/statmechhtml/S5.html` | §5.2.3、§5.4、§5.4.1/2/3、§5.5.1；权威教学二手，不冒充 Landau/Lee-Yang 原作 | `tong-phase.html`；`e6735727eee6f0eaec54e25cef2c10ad078edbc5a30808d20bde83f07f40db9f` |
| P2 | Mark A. Bedau (1997), "Weak Emergence", *Philosophical Perspectives* 11:375-399；作者副本 `https://people.reed.edu/~mab/papers/weak.emergence.pdf` | PDF pp.3-5 的强弱区分、定义与脚注 4；原作作者副本，不冒充刊本分页 | `bedau-weak-emergence.pdf`；`84abc1d09b07537e14923eb1ef2bb81c3348e05d9d35a72a9a9b097edb8bca04` |
| P3 | Ilya Prigogine (1977-12-08), "Time, Structure and Fluctuations", Nobel Lecture；`https://www.nobelprize.org/uploads/2018/06/prigogine-lecture.pdf` | 印刷 pp.265-267、270-273；作者讲座原文，不冒充 1967/1977/1984 三本书直读 | `prigogine-1977.pdf`；`dd356bdf285adabdff7a602b6c14d58b6462e0d40272dc023b12956fc33f97d1` |
| P4 | M. E. J. Newman (2003), "The structure and function of complex networks", arXiv:cond-mat/0303516v1, 2003-03-25；`https://arxiv.org/pdf/cond-mat/0303516` | §VIII.A, 自编 pp.38-39、Fig.13、Eq.77-81；学术综述，所引 Cohen/Callaway 结果为转述 | `newman-networks.pdf`；`0f302e056b6dcee7a8ee4658819912579f8c83e8f478c076954e864a2775af69` |
| P5 | Roger B. Myerson (2007-12-08), "Perspectives on Mechanism Design in Economic Theory", Prize Lecture；`https://www.nobelprize.org/uploads/2018/06/myerson_lecture.pdf` | 印刷 pp.322-324、326，§2、§3.1；作者后期理论讲解，不冒充 Myerson 1981、Groves 1973、Vickrey 1961 原作 | `myerson-lecture.pdf`；`e058ca82b713a4af8f4bd1b69fd3cf683f0fa9eabedb5bb5cc20bf8fdc9c2895` |

## P1 相变的数学定义不能不带模型条件

- 原文短句，§5.2.3：`phase transitions only strictly happen in the thermodynamic limit`；
  §5.4.3 对有限体积配分函数的解析性另作解释。这是在所讲平衡统计模型中的严格相变条件。
- §5.4 的序参量定义放在 Landau 理论中，§5.4.1 与 §5.4.2 区分二阶与一阶转变；
  §5.5.1 的关联长度发散讨论针对临界点，不支持原稿把所有相变都写成关联长度必发散。
- §5.2.3 明说平均场在一维 Ising 模型错误预言相变，二维、三维临界指数也只给近似。
  不能把一个平均场公式、某套指数或序参量定义无条件外推至全部系统。
- 结论：支持按明确模型讨论序参量、非解析性与尺度；反对原稿不分转变类型的概括。
  组织形态是否有对应宏观量与极限仍未知，不能从物理名称取得效率保证。这是应用推断，不改 Pod 用词。

## P2 弱涌现不是观察者感到意外

- PDF p.4 定义：`Macrostate P of S with microdynamic D is weakly emergent iff P can be derived from D and S's external conditions but only by simulation.`
- 同页脚注 4 明确把定义限制于给定宏观态、给定系统和给定微观动力学；p.5 解释初值、开放系统外部输入、
  随机事件均可进入外部条件。范型为只能经有限模拟导出，而不是宣称无法模拟。
- 结论：支持该定义，反对把弱涌现等同于“没有预期到”；一段意外轨迹不证明不存在非模拟推导。
  原文对强涌现的哲学评价与本文工作定义分开，不推出所有工程涌现都属同一类。
- 应用推断：若仅观察到群体新行为，应报告观察及度量，不直接宣称满足 Bedau 的可导出性条件。

## P3 耗散结构与最小熵产生不能混用

- p.267 把 Benard 对流的宏观有序描述为与外界能量交换维持的巨大涨落；远离平衡可能产生有序，
  不是任何开放系统都会产生有序的充分条件。
- pp.266-267 将最小熵产生定理限于足够近平衡、系数可视为常数的严格线性理论，远离平衡可出现相反行为。
- p.271 在所论化学系统中把自催化步骤称为稳定性丧失的 `necessary (but not sufficient)` 条件；
  p.272 明说尺寸、形状、边界条件会决定失稳类型，临界尺寸是反应扩散参数的复杂函数。
- 结论：支持物理机制及作者明示限制，不支持“系统越动荡越健康”或“最小耗散就是组织最高效率”。
  讲座未建立 token、任务质量与热力学熵之间的映射，向 Pod 迁移只能另作推断。

## P4 渗流度量连通性，不自动度量任务正确性

- Fig.13 与 §VIII.A 定义 site/bond occupation，研究占据节点或边形成的簇；网络韧性的一个指标为最大连通分量占比。
- p.38 的配置模型例子要求大节点数极限、给定度分布、均匀随机占据，并明确写 `random and uncorrelated`；
  后一转述允许占据概率随节点度变化，不能把“相同独立概率”当成整个渗流理论唯一许可模型。
- p.39 Eq.80-81 的阈值和巨连通分量表达式属于前述模型与生成函数条件，不是任意协作图的通用阈值。
- 结论：上述内容按 Newman 综述计，不冒充 Stauffer/Aharony 原书直读。应用推断：即使信息路径存在，
  语义正确性、权威与任务成功仍需各自指标；本模型不提供它们的保证。

## P5 机制设计有信息、行为和均衡假设

- pp.322-323 区分私人信息的 adverse selection 与隐藏行动的 moral hazard；
  激励相容要求诚实与服从构成理性均衡，而不是给系统命名为“拍卖”或增加预算就自动成立。
- pp.323-324 的 revelation principle 从一个给定机制及其理性均衡，构造结果等价的可信中介方案。
  这是可实现结果的表示关系，不是有限算力 agent 必能找到或学习该均衡的算法保证。
- p.326 的交易例明确假定风险中性、最大化期望利润。例中直觉公平的拆差方案不满足诚实均衡，
  但不能把这个例子的偏好、概率或风险假设推广为所有机制的定义。
- 结论：支持私有信息、激励约束与均衡条件的区分；不据此升级三篇旧经典的逐项定理核验。
  Pod 是否具有对应私有收益与策略行为仍需具体建模，不由共享目标配置直接判定。

## 原关闭项覆盖与剩余缺口

| 原关闭项 | 本包结果 |
|---|---|
| 每条主张与作者边界 | 五项各给实际文本、读取层级及模型范围；两份综述/教学来源不冒充经典原作 |
| 四路各至少五项 | 保留既有最低计数，不把作者后期文本或教学页强行计为新的经典名额 |
| 至少三条设计警告 | 新增形式模型不可无条件外推、耗散最小化限制与均衡假设的候选，Pod 含义另标推断 |
| LLM 借用与修辞区分 | 未新增 LLM 全文样本，原三样本范围不变 |
| S4 与完整性 | 本包不是整票关闭；原其他作者边界与未读版本仍按主报告/票面留界 |

- 必要层级律另查 Crossref DOI `10.1108/eb005528`，只得题录与摘要；OpenAlex 返回 429。
  这不核验精确定理，亦不是有界空结果。缓存 `aulinhierarchy-crossref.json`，
  SHA-256 `22b13dde361b5093b88709f7799c164b854367c41bbf84c304b9415e117e759d`。
  Crossref 所列出版社 XML/HTML 两入口在 10:39:20Z 均返回 403，未绕过；记录见
  `aulin-followup-log.json`，不把落地失败写成无正文或定理已核。
- Tong 首试 `statphys/statmech.pdf` 返回 404，改取同作者正式 HTML 章节，未重复失败路径或绕挑战。
- 首次采集 10:29:52Z，关键原文核验记录至 10:33:10Z，均为 2026-10-15 UTC；主动工时未计量。
  工具为 urllib、pdftotext、HTMLParser、SHA-256；未调用本机 DSH。模型会话标识与 token 用量未记录，不报告净节省。
