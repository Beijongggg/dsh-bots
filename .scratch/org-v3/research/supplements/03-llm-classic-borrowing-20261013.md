# 补核 03：LLM 借用核对（三样本：MacNet / Absorbing State / LLM-MR-CNP）

- 所属票：`.scratch/org-v3/issues/03-research-organization-theory-and-concepts.md`「LLM 借用核对」包；本件只覆盖该包声明的三篇样本，不等于整票。
- 基线：`a8967ce118c9becfad132159ae50f9a86ba11397`；约定重读 `research-handoff.md`（每条证据字段、派发前、验收）与原报告 §5。本件为独立新增件，未改票、原报告、地图与 Git。
- 实时：起 `2026-10-13T21:09:26+08:00`；止 `2026-10-13T21:13+08:00`。
- 检索面：只读三篇样本的 arXiv 官方页，未扩展检索面；未用引用图。全文＝arXiv HTML 全文（含参考文献）＋同版本 PDF 目视核对页码与公式。
- 缓存：`/tmp/org-v3-llm-borrowing.Qz7Kt/`；abs 按 arXiv 编号命名, 正文为 `macnet`、`absorbing`、`cnp` 的 `.html`、`.pdf`、`.txt`、`.pdftxt` 文件。三篇 abs／HTML／PDF 下载全部 HTTP 200，无访问失败项。
- 执行模型为原生子代理 `opencode-go/deepseek-v4.1-flash/max`; session_id、token 与主会话主动验收工时未知。

## 0. 分类口径

- 「仅提词」＝正文只出现术语或类比、不引经典；「有经典引用」＝参考文献或正文点名经典著作；「机制对应」＝实际采用其机制（公式／协议／实验设计）并给短引定位。
- 全文没提不等于全领域没借用；本件结论只限三样本与其下载版本。

## 1. MacNet

事实（题名／版本）：arXiv:2406.07155v3（2025-03-17；v1 2024-06-11），*Scaling Large Language Model-based Multi-Agent Collaboration*，Chen Qian 等 12 作者；abs `comments` 自述 "Accepted to ICLR-2025"（缓存 `2406.07155.abs.html`）。全文核读 HTML v3＋19 页 PDF。

- 借用的经典＝神经标度律线：正文点名 Kaplan et al., 2020（参考条目 *Scaling Laws for Neural Language Models*，PDF p13）；灵感句 "Inspired by the neural scaling law"（PDF pp1–2）；把「参数量—性能」关系移植成「agent 数—性能」曲线（§3.3 "Recall the neural scaling law"，PDF p8）。
- 对应层级为标度关系：拟合 logistic 增长曲线，自述 "We also identify a collaborative scaling law—the overall performance follows a logistic growth pattern as agents scale, with collaborative emergence occurring earlier than traditional neural emergence"（摘要，PDF p1；§3.3 复述 p10）。这不是把经典控制机制实现为组件。
- 相变语言：本版本全文（HTML→文本，含参考文献）"phase transition" 检索 0 命中；"critical" 1 命中，为普通用语 "the most critical aspects for artifact refinement"（PDF p9）。此为定位事实，不作领域不存在判断。
- 作者自述限制／不确定：机制解释是推测——"We speculate this may be because scaling agents catalyzes their multidimensional considerations"（PDF p1）；并引 Schaeffer et al. 2024（*Are Emergent Abilities of LLMs a Mirage?*，参考 p16）作涌现规模门对照（p8）。

分类：有经典引用, 有标度关系对应; 不计相变或控制机制的实现。

## 2. Absorbing State Phase Transitions in Multi-Agent Search

事实：arXiv:2609.38327v2（2026-10-07；v1 2026-09-29），Wenwen Zheng、Yuzhe Yang、Helen Qu、Xin Eric Wang、Haewon Jeong；abs `comments` 仅 "Code:"。全文核读 HTML v2＋23 页 PDF。

- 经典引用（正文点名）："Our work directly builds off foundational work on absorbing state phase transitions [Hinrichsen, 2000] and its applications to search problems [Semerjian and Monasson, 2003, Lee et al., 2010]"（§6 Related Works，PDF p9）；任务分类引 Dechter 1986／2007 与并行分支定界 Lai & Sahni 1984（同页）。
- 机制对应：§3 用 mean-field 推导临界通信度 `dc`。`r_t(d) = b(1 − m q_t)^d`、`A_{t+1} ≃ r_t(d)(A_t − mN)`（Eq. 3，PDF p5）假设每轮用满 `Nm` 次随机独立实验。Eq. 5 的 `dc = −(T−1)·ln b / Σ ln(1 − m q_t) ≃ (T−1)·ln b / (m Σ q_t)`另要求 `A_t ≫ mN`, 后一近似要求 `m q_t ≪ 1`。Eq. 6 的 `P_succ(d) ≃ 1/(1 + A_T(d))`假设最终均匀选择且一个正确候选仍被保留。阈值预测集中在 pp4-5; 有限 horizon 表现为 smooth crossover, 不能直接称无限系统的奇点。
- 实验：toy／TCAS／物理机制发现三域（16 项符号库，SINDy 式支撑恢复，引 Brunton et al. 2016）；确定性规则 agent 实测 `dc` 与理论 Lin's CCC = 0.93／0.97／0.94，机制发现域超出理论平均 17%（§5，PDF p7）。
- 作者自述限制：mean-field 近似假设每轮用满预算、实验随机选取等（PDF p5）；LLM agent 与理论「mixed」，偏差归因 "incomplete reporting and redundant exploration"（§7 结论，PDF p10）。

分类：**机制对应**（公式＋参数＋三域实验对照）。

## 3. LLM-MR-CNP

事实：arXiv:2608.12371v1（2026-07-19，单版本），Sabeur Lajili、Zaki Brahmi。实际题名 *Multi-Agent Scheduling with LLM-Assisted Contract Net Negotiation for Stream Processing in Mobile Edge Computing*（PDF p1）。报告 §5 表内标签「LLM-MR-CNP」是本文系统 MAS-DecStream 的贡献名而非题名（摘要原文："whose main contribution is LLM-MR-CNP"）——此为标签与题名差异的事实记录。全文核读 HTML v1＋9 页 PDF。

- 经典引用：R. G. Smith, "The contract net protocol: high-level communication and control in a distributed problem solver," *IEEE Transactions on Computers* C-29(12):1104–1113, 1980（参考文献 [9]，PDF p8）；正文以 [7]–[9] 引 auction 与 CNP 为经典去中心化机制（§I，PDF p1）。
- 机制对应（协议层）：保留 CNP 为交互骨架（announcement／proposal／award／rejection，§II，PDF p2），在其上做五项扩展：semantic CFP formulation、progressive context disclosure、multi-round proposal revision、negotiation memory、deterministic validation（摘要，PDF p1）。
- 实验：Alibaba ASI Trace 派生场景。Scenarios 1/2 同时改变定性上下文与 LLM 解释, 不是组件匹配消融。Table VI 为 25 cases; Table VII 为 30 个 model-prompt 配置各运行一次再选优。摘要报告 3% 延迟违规、消除资源超配、20 agents 冲突解决率 0.91、utility 最多 +22%; 固定模型单轮到多轮 token 从 19,100 增至 53,452。不同表的分母和选择程序不能混算。
- 作者自述限制："The incremental causal contribution of the LLM still requires component-matched ablations and repeated trials"；自述为 initial empirical assessment，"rather than proof of general superiority"（§VI，PDF p8）。

分类：**机制对应**（经典协议＋扩展机制＋对照实验）。

## 跨样本事实归纳（≤2 条）

- X1（事实，限三样本）：MacNet 借用标度关系, Absorbing 建立搜索过程的相变近似模型, CNP 扩展 Smith 1980 协议。三者不是同一种「经典机制加 LLM 组件」; 本样本只有 Absorbing 给出临界条件公式与三域对照。
- X2（事实，限三样本）：CNP 论文参考文献 [10] 即 MacNet（Qian et al.）；该条只证两条样本间的引用关系存在，不推论影响或领域程度。

## 作者结论 / 本件推断分栏

作者结论（各自原文）：MacNet＝logistic 增长＋推测式解释；Absorbing＝理论预测与实测 close agreement（机制发现域例外），建议"designing communication protocols jointly with agents' search strategies"；CNP＝多轮 refinement 为主增益、LLM 增益较小且依配置。

本件推断（标注，供主会话裁决，不写项目结论、不裁定理论迁移）：

- I1：在声明的三样本内，「相变理论借用」仅 Absorbing 一处达机制级；MacNet 属标度律借用、CNP 属协议借用。不可外推为领域分布。
- I2：三篇均自带程度声明（speculate／mixed／needs ablations），报告 §5 由摘要级表述升级为结论时需附这些限制。

## 未核验与缺口

- 版本差异未核：MacNet v1→v3、Absorbing v1→v2 的变更内容；ICLR 评审文本与录用版差异。
- MacNet 相变／临界零命中只限该 v3 HTML 全文与 19 页 PDF 抽文本；不代表其他版本或领域。
- 未查三样本之外引用图，「领域借用程度」未核；Alibaba ASI Trace 的取得条件和复现细节未核, 无证据称其付费。
- Absorbing 公式页以 PDF 目视核对（Eq. 3，p5）；HTML 数学抽文本有歧义处已回退 PDF，无剩余歧义项。

## 原关闭项覆盖表

| 原关闭项 | 本件覆盖 | 证据 |
|---|---|---|
| 「仅提词／有引用／机制对应」分列（声明样本） | 覆盖 3/3 | §1–§3 分类行 |
| 每篇题名／作者／版本／参考文献 | 覆盖 | 各节事实行＋SHA |
| 实际机制对应（公式／参数／实验／限制） | 覆盖 | §2 Eq.3＋CCC；§3 协议＋实验；§1 logistic |
| 不可达记未核验 | 无不可达 | 头部 |
| 四路各五条经典出处、设计警告复算、整票关闭 | 不覆盖 | 留主会话 |

## URL / 版本 / 缓存 SHA-256

- 2406.07155v3：`https://arxiv.org/abs/2406.07155`；HTML `https://arxiv.org/html/2406.07155v3`＝`0b0bb8564727647d023d1f1e47ab346783c53a6deacb075b949e3c0f10530a0b`；PDF＝`218988f7944195a66d57383f4089b01151a3babf86e5e13a3d65b146baddda4f`。
- 2609.38327v2：`https://arxiv.org/abs/2609.38327`；HTML＝`e7fc38ebd5f94480b64a7ddaca4463f35a47d8891f3f487e49d777aff78eb67b`；PDF＝`ff63d6cb38642ffcc914d24cf672657f46ce6f55a25db9b42f3742c2dc648627`。
- 2608.12371v1：`https://arxiv.org/abs/2608.12371`；HTML＝`afe0c265092b4ed365599903f004fc97048d6fb89b535d9f8db2852f49f404a8`；PDF＝`5c940e6335b9a079ab41238d4fc36ee56c711d7a8e4aa3cd3ceb722c3d48b722`。
