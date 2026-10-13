# 03 复杂系统路：原报告五项来源的原文提取（补核件）

[组织理论、复杂系统与控制论（纯理念面）](../../issues/03-research-organization-theory-and-concepts.md)工作包「经典内容核验」的复杂系统分包。按[研究补核与委派](../../research-handoff.md)只交原文提取与作者边界，不做理论综述、不裁定迁移、不关票；理论迁移与关票由主会话处理。基线 commit `a8967ce118c9becfad132159ae50f9a86ba11397`。范围固定为原报告 §2 内五项，均取出版社／作者／大学公开副本全文；副本缓存于 `/tmp/complex-sys-03-20261013/`（非冻结件，集成前主会话应复核）。本分包未写入 `~/.dsh`、部署目录或真实注册表。

## 稳定 ID 与覆盖

| ID | 来源 | 核心提取 | 实读层级 |
|---|---|---|---|
| C1 | Bak/Tang/Wiesenfeld 1987, PRL 59(4):381-384 | 自组织临界（SOC）与 1/f 噪声 | 全文（出版社扫描＋OCR 文本层） |
| C2 | Anderson 1972, Science 177(4047):393-396 | 还原≠构造；层展性质 | 全文（出版社 PDF，含 EMBL 水印） |
| C3 | Dorigo/Maniezzo/Colorni 1996, IEEE T-SMC-B 26(1):29-41; 所读副本自编 1-13 | 蚂蚁系统：正反馈＋分布式＋贪心构造 | 全文载体（大学镜像的作者式副本） |
| C4 | Holland 1992, Daedalus 121(1):17-30 | CAS 三特征；内部模型、积木 | 全文（JSTOR 扫描镜像） |
| C5 | Bettencourt et al. 2007, PNAS 104(17):7301-7306 | 城市标度 β≈1.2／≈0.8 | 全文（PMC HTML） |

## C1-C5 详情

### C1 Bak/Tang/Wiesenfeld 1987 — Self-Organized Criticality: An Explanation of 1/f Noise

- 主张与用途：扩展自由度耗散系统自发演化到临界态，解释 1/f 噪声与分形结构的普遍出现；供「自组织／临界」条目与组织类比引用。
- 来源定位：Phys. Rev. Lett. 59(4):381-384, 27 July 1987（收稿 1987-03-13）。取得副本：`https://courses.physics.ucsd.edu/2016/Spring/physics235/BTW-PRL.pdf`（UCSD 课程站镜像，非作者自存），采集 2026-10-13 21:30 → `/tmp/complex-sys-03-20261013/btw-prl1987.pdf`，SHA-256 `f4a2238d3da88c28409ff9a9c7532b5ece00a59ece619bcb1dc59f5daa18965e`；文本层 `btw-prl1987.txt`。页眉 "VOLUME 59, NUMBER 4" 与 DOI `10.1103/PhysRevLett.59.381` 已核。
- 实读层级：全文（4 页 APS 扫描＋OCR 文本层；摘要、机理段与 sandpile 段逐条核对，第 2-4 页细节仅抽查）。
- 证据结论：
  - 摘要（btw-prl1987.txt:26-30）："We show that dynamical systems with spatial degrees of freedom naturally evolve into a self-organized critical point. Flicker noise, or 1/f noise, can be identified with the dynamics of the critical state. This picture also yields insight into the origin of fractal objects."
  - 机理段（同文件第 1 页）："The combination of dynamical minimal stability and spatial scaling leads to a power law for temporal fluctuations. The noise propagates through the scaling clusters by means of a 'domino' effect upsetting the minimally stable states."
  - 与平衡相变区分："The criticality in our theory is fundamentally different from the critical point at phase transitions in equilibrium statistical mechanics which can be reached only by tuning of a parameter … The critical point in the dynamical systems studied here is an attractor reached by starting far from equilibrium: The scaling properties of the attractor are insensitive to the parameters of the model. This robustness is essential in our explaining that no fine tuning is necessary to generate 1/f noise (and fractal structures) in nature."
  - sandpile 为本篇内容（非仅 1988 版）："dynamical response of the sandpile to small random perturbations"（:183）、"self-organized critical state of minimally stable clusters of all [sizes]"（:861）。
- 作者与项目边界：本篇为机理主张＋数值演示（"we argue and demonstrate numerically"，pendula 阵列与 sandpile 细胞自动机），非一般 SOC 理论；作者自陈 robustness 免去 fine tuning 是解释自然 1/f 噪声的关键。版本注意：同组 1988 Phys. Rev. A 38, 364 是更长姊妹篇，本地另存 `btw-scan.pdf`（SHA `a85eead9369d3fdb708e841d73c4263a181718f2017ef2f684b115082e7c00e5`），引用时不得与 1987 PRL 混淆。
- 量化附项：PRL 内无拟合指数表；如迁移稿引用具体指数（如 τ≈1），须回 1988 PRA 或后续文献另核。

### C2 Anderson 1972 — More Is Different

- 主张与用途：还原论成立不等于构造论成立；每层次出现全新性质；供「层展／还原边界」条目引用。
- 来源定位：Science 177(4047):393-396, 4 August 1972。取得副本：`http://www.rpgroup.caltech.edu/embl_pboc_2023/assets/pdfs/anderson1972.pdf`（Caltech RPGroup 课程站镜像；PDF 本体为 science.org 下载件，带 EMBL 水印，非作者自存），采集 2026-10-13 21:25 → `/tmp/complex-sys-03-20261013/anderson-caltech.pdf`，SHA-256 `39a61c405542ce4817e0e4c4f05eb4f9651f2e1f118c6c1d28d782db2af535b0`；文本 `anderson-caltech.txt`（324 行，双栏 OCR）。
- 实读层级：全文。
- 证据结论：
  - 摘要开篇（anderson-caltech.txt:6-26）："The constructionist hypothesis breaks down when confronted with the twin difficulties of scale and complexity. The behavior of large and complex aggregates of elementary particles, it turns out, is not to be understood in terms of a simple extrapolation of the properties of a few particles. Instead, at each level of complexity entirely new properties appear, and the understanding of the new behaviors requires research which I think is as fundamental in its nature as any other."
  - 核心句式："The main fallacy in this kind of thinking is that the reductionist hypothesis does not by any means imply a 'constructionist' one: The ability to reduce everything to simple fundamental laws does not imply the ability to start from those laws and reconstruct the universe."（:63-67 区段）
  - 层级不可外推："Psychology is not applied biology, nor is biology applied chemistry."（正文后段，未记行号）。
- 作者与项目边界：1967 年 Regents' Lecture 扩写；随笔／演讲体裁，非形式化理论。作者自我设限："when I speak of scale change causing fundamental change I do not mean … phenomena at a new scale may obey actually different fundamental laws … all ordinary matter obeys simple electrodynamics and quantum theory"；破缺对称仅作为 "may be of help" 的示例，且作者自陈解释 "elementary and incomplete"。
- 量化附项：无。

### C3 Dorigo/Maniezzo/Colorni 1996 — Ant System

- 主张与用途：以蚁群觅食类比提出蚂蚁系统算法；供「正反馈／分布式／涌现搜索」条目引用。
- 来源定位：IEEE Trans. SMC-B 26(1):29-41, DOI `10.1109/3477.484436`（Crossref 最终刊页）。所读作者式副本共 13 页, 自写 pp.1-13, 不冒充最终刊页。入口 `http://staff.washington.edu/paymana/swarm/dorigo96-itsmc.pdf` 为华盛顿大学个人主页镜像, 非作者自存页; 采集 2026-10-13 21:24, 缓存 `/tmp/complex-sys-03-20261013/dorigo-wash.pdf`, SHA-256 `2bc5a12060fa03be772f9dbfa466e1ae4bccc5ddd22f05f53b58322193847394`; 文本 `dorigo.txt`。
- 实读层级：全文。
- 证据结论：
  - 摘要：三条主特征 "positive feedback, distributed computation" 与 "the use of a constructive greedy heuristic"（:25-29 区段）。
  - 正反馈回路（:81-111 区段）：路径选择→留信息素→后续概率提高的自催化结构；信息素蒸发以 `(1-ρ)` 表示，"ρ: trail persistence, 0≤ρ<1（1-ρ can be interpreted as trail evaporation）"（参数节 :410-418）。
  - 停滞："stagnation behavior … stops searching for alternative solutions"（:324 区段）。
  - 结论（:1218-1244）："Were an agent alone, the autocatalytic process and the greedy force would tend to make the agent converge to a suboptimal tour with exponential speed. When agents interact it appears that the greedy force can give the right suggestions to the autocatalytic process and facilitate quick convergence to very good, often optimal, solutions without getting stuck in local optima." 贡献自陈三项：(i) 正反馈作搜索工具 (ii) 分布式系统中 synergy (iii) 应用于 TSP/ATSP/QAP/JSP。
- 作者与项目边界：方法论文（含三变体实验），作者自陈 "Since we have not yet developed a mathematical analysis of the models, which would yield the optimal parameter setting in each situation, we ran simulations"（:406-408）；生物蚁研究只作 "source of inspiration and a useful metaphor"，非生物学机制主张。作者承认部分应用可能输给专用算法, 本文也未考察并行实现; 分布式设计不等于已测得并行加速。
- 量化附项（IV 节＋Table I，已回原文核清）：α=1, β=1, ρ=0.5, Q=100 仅为参数扫描节的默认值，非全篇推荐；扫描中每次只改一个参数（α、β 例外，按取值组合测试：α∈{0,0.5,1,2,5}、β∈{0,1,2,5}、ρ∈{0.3,0.5,0.7,0.9,0.999}、Q∈{1,100,10000}），每组设置 10 次模拟。Table I 最终三算法对比改用各自 best parameter set、各跑 10 次：ant-cycle α=1, β=5, ρ=0.5；ant-density／ant-quantity α=1, β=5, ρ=0.99；作者注明 Q 影响可忽略故未列入表。

### C4 Holland 1992 — Complex Adaptive Systems

- 主张与用途：CAS 一般性描述：演化—聚集行为—预期三特征，内部模型与积木机制；供「自适应性／涌现组织」条目引用。
- 来源定位：Daedalus 121(1):17-30。取得副本：`https://pzs.dstu.dp.ua/DataMining/genetic/bibl/Holland%201992.pdf`（第三方镜像站，内含 JSTOR 扫描件；非 JSTOR 官方下载、非作者自存），采集 2026-10-13 21:25（同一 URL 首下副本 21:23 误落仓库根，21:27 移入 `/tmp/complex-sys-03-20261013/incoming/holland-dstu.pdf`）→ `/tmp/complex-sys-03-20261013/holland.pdf`，SHA-256 `c463208e10ba8815e9beb7736820dea19e2592277394607474b6a458dc14fd01`；文本 `holland.txt`（776 行）。副本页脚保留 JSTOR 下载条，属镜像件。
- 实读层级：全文。
- 证据结论：
  - 三特征（holland.txt:168-170）："All of them involve a great number of parts undergoing a kaleidoscopic array of simultaneous interactions. They all seem to share three characteristics: evolution, aggregate behavior, and anticipation."
  - 移动靶（:85-100）："…they constitute a 'moving target.'"
  - 建模难度（:155-168）："Models of this complex adaptive system are hard to formulate. It is particularly difficult to provide experts in the area with models that allow 'thought experiments,' models that enable the expert to develop intuition about different mechanisms and organizations."
  - 内部模型（:440-470 区段）："Complex adaptive systems form and use internal models to anticipate the future, basing current actions on expected outcomes … It is this attribute that distinguishes complex adaptive systems from other kinds of complex systems."
  - 积木（:320-420 区段）："10^8 = 100,000,000 faces can be described by combining these components … at the cost of storing only 8 x 10 = 80 'building block' components … Building blocks thus give the system a capacity for transferring previous experience to new situations."
  - 结语（:625-660 区段）："experiments unguided by an appropriate theoretical framework usually amount to little more than 'watching the pot boil.' … We need experiments to inform theory, but without theory all is lost."；并把 "weld these disparate pieces into a theory" 列为挑战。
- 作者与项目边界：Daedalus 立场／综述文（"A New Era in Computation" 期），无新形式化结果；机理清单以行文散述，未给成块列表——七机制清单式表述（aggregation/tagging/nonlinearity/flows/diversity/internal models/building blocks）未在本篇文本定位到整段，逐字引用前需另核。
- 量化附项：8 部件 ×10 变体 → 10^8 张脸、存 80 积木（示例性说明，非实验数据）。

### C5 Bettencourt et al. 2007 — Growth, innovation, scaling, and the pace of life in cities

- 主张与用途：城市标度分类：财富／创新 β≈1.2 超线性、基础设施 β≈0.8 次线性；供「规模效应／超线性增长」条目引用。
- 来源定位：PNAS 104(17):7301-7306。取得副本：`https://pmc.ncbi.nlm.nih.gov/articles/PMC1852329/`（PMC/NLM 官方全文，页内 canonical 链接一致），采集 2026-10-13 21:27 → `/tmp/complex-sys-03-20261013/pmc.html`，SHA-256 `8e6fac664329b21c93995ae5361c654d6c18c0428135ce76ffd872d941003852`（pnas.html 为 blocked stub，未用）。
- 实读层级：全文（PMC HTML，含摘要、Table 1 讨论与结语；模型节为正文转载）。
- 证据结论：
  - 摘要："Quantities reflecting wealth creation and innovation have β ≈1.2 >1 (increasing returns), whereas those accounting for infrastructure display β ≈0.8 <1 (economies of scale). We predict that the pace of social life in the city increases with population size, in quantitative agreement with data …"
  - 三类分类正文："Table 1 reveals a taxonomic universality whereby exponents fall into three categories defined by β = 1 (linear), β<1 (sublinear), and β>1 (superlinear) … (i) β ≈1 … individual human needs … (ii) β ≈0.8 <1 … infrastructure … (iii) β ≈1.1–1.2 …"
  - 增长推论："for β <1 it leads to a sigmoidal growth curve, in which growth ceases at large times (dN/dt = 0), as the population approaches a finite carrying capacity … Thus, cities and, more generally, social organizations that are driven by economies of scale are destined to eventually stop growing."
  - 结语："much more remains to be explored in generalizing the empirical observations made here to other quantities, especially those connected to environmental impacts, as well as to other urban systems and in clarifying the detailed social organizational structures that give rise to observed scaling exponents."
- 作者与项目边界：经验标度分析＋模型推论；数据以大美国城市系统为主，欧洲与中国仅个别案例（"we have obtained datasets at this level of detail mostly for the U.S."）。
- 量化附项（Table 1 示例）：GDP 1.15 [1.06, 1.23]（China 2002）、"Supercreative" employment 1.15 [1.11, 1.18]。摘要级 ≈1.2／≈0.8 为类别概括；具体数只可按 Table 1 逐量引用。注意：手头文本中未发现 "0.85" 这一具体值，若他处引用 0.85 需另找出处。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| 原报告 §2 五项一手出处 | C1-C5 均获全文副本＋本地 SHA-256 | 完成（提取层） |
| 数值条款（β≈1.2／≈0.8、α/β/ρ、Table 1 CI） | 已核；更正：未见 0.85 具体值 | 完成（含更正标记） |
| BTW 1987 与 1988 版本区分 | PRL 59(4) 全文已获；1988 PRA 另存仅作旁证 | 完成 |

## 剩余缺口

- Holland 七机制清单未在 1992 本篇定位到成块列表；逐字引用前需另核（aggregate behavior、building blocks、internal models 已逐条核到）。
- Bak 1987 PRL 第 2-4 页细节（sandpile 标度塌缩、指数）未逐行核对，仅抽查（:183、:861）；深引指数请回 PDF 或 1988 PRA。
- Bettencourt "0.85" 未见于原文；如迁移稿已写 0.85，应改引 ≈0.8 或 Table 1 具体量。
- C2／C3／C4 载体分别为课程站、个人主页、第三方镜像站（非出版社直供）；集成引用时以期刊卷页定位，C5 为 PMC 官方全文可比对。
- 本分包只覆盖原报告 §2 五项；报告若另引其他文献，不在本包范围。
- 全部副本存于 `/tmp`（非冻结件、未持久化到仓库）。引用由稳定 URL、版本、定位与 SHA 绑定; 临时缓存失效时按这些字段重取, 不能把取得全文等同于每页已核。

## 执行记录

- 开始／完成：2026-10-13 21:18:17 +08:00 ／ 2026-10-13 21:32 +08:00（约 14 分钟；含 1987 PRL 补获返工）
- agent 路径：/root/theory_complex_sources
- 模型：opencode-go/deepseek-v4.1-flash/max（原生子代理，按用户授权）
- 工具：原生 shell 网络读取、pdftotext、pdftoppm、sha256sum、python3（HTML 抽取）；session_id：未知
- 返工：首轮只取到 BTW 1988 PRA 扫描；1987 PRL 经 UCSD 课程页补获。Anderson 镜像受阻改用出版社 PDF；Bettencourt 由 PMC HTML 取代受阻 PDF。
- 验收：主会话回读五项关键段, 接受所列机制与边界; 修正 Dorigo 副本/刊页区分。未逐读页与七机制清单等缺口保留, 本件不关整票。
