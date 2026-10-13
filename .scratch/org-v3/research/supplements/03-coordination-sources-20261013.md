# 03 协调经典五篇：原文提取（前 LLM 协调路）

本件是[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)工作包「经典内容核验」的协调路续包，按[研究补核与委派](../../research-handoff.md)只交原文提取与作者边界；理论迁移、引用强度与关票由主会话处理。范围限原报告 §4 指定的五个经典来源，不做 Pod 架构建议，不从摘要猜正文。

- agent 与模型：`/root/theory_coordination_sources`；实际模型 `opencode-go/deepseek-v4.1-flash/max`；原生工具（无 DSH 调用、无嵌套代理、无真实运行面写入）；session_id / token 未知。
- 起止：2026-10-13 21:19:31 → 21:37；续窗口 21:49:51 → 21:52（Asia/Shanghai，同 agent，完成 Hearsay-II 定向检索与边界补核）；采集日期同。基线 commit `a8967ce118c9becfad132159ae50f9a86ba11397`；仓库唯一写面为本件。
- 缓存：`/tmp/org-v3-coordination-sources-20261013/`。只读原文提取，不安装依赖、不运行论文代码、实验或真实模型。
- 方法注记：Teamwork 只有作者 PostScript 影本，文本经自写抽取器（仅标准库）取出，dvips 字距把词切成片段（如 `commi tment`），引文按英文正字法合并字距空格并在各处注明；公式符号未逐符号转录，只引散文句。交前自查：C1/C3/C5 引文逐条回对本地抽取文本（Teamwork 按去空格比对），Hewitt 页码经官方扫描 PDF 逐页核对并修正三处；续窗口 Hearsay 边界引文逐条回对 `hearsay3.txt` 分页文本（页码按印刷页脚）。

## 来源与快照

| 来源 | 题录（实际核验） | 实读层级 | 快照与 SHA-256（本地全量） |
|---|---|---|---|
| Smith 1980 | IEEE Trans. Computers C-29(12):1104-1113, Dec 1980, DOI 10.1109/TC.1980.1675516；Crossref 核验题名/作者/卷期页 | 全文 10 页（作者官网副本） | `/tmp/org-v3-coordination-sources-20261013/smith1980.pdf`；`0b098a438af2bfe720c548f810474108c1d95859f9a488190ba49fee837f64cc`；入口 `https://www.reidgsmith.com/The_Contract_Net_Protocol_Dec-1980.pdf` |
| Erman et al. 1980 | ACM Computing Surveys 12(2):213-253, Jun 1980, DOI 10.1145/356810.356816；Crossref 核验 | 全文 41 页（Wayback 快照；机制＋边界初核，见 C2） | `/tmp/org-v3-coordination-sources-20261013/hearsay3.pdf`；`0ae2e93fc785f06ee1736c18cf52a1e5b9d100ef59c30e9277e90e9199096c09`；入口 `https://web.archive.org/web/20240423074548id_/https://dl.acm.org/doi/pdf/10.1145/356810.356816` |
| Hewitt / Bishop / Steiger 1973 | IJCAI-73, pp.235-245；IJCAI 官方公开 PDF（`https://www.ijcai.org/Proceedings/73/Papers/027B.pdf`），题名页核对 | 全文 11 页 | `/tmp/org-v3-coordination-sources-20261013/actor-ijcai.pdf`；`84499709f4e01794f77ba4b623e60a12148c48eba4a86bfc0dc5998ae755bb1a` |
| Modi / Shen / Tambe / Yokoo 2005 | Artificial Intelligence 161(1-2):149-180, 2005；DOI 10.1016/j.artint.2004.09.003 经 Crossref 与 OpenAlex 双向核验，题名与作者一致（派单 DOI 未错）；ScienceDirect PII S0004370204001511 | 仅题录（正文未取，见 C4） | 无快照；题录响应缓存 `/tmp/org-v3-coordination-sources-20261013/oa-adopt.json` |
| Cohen / Levesque 1991 | Noûs 25(4):487-512, Sep 1991, DOI 10.2307/2216075；Crossref 核验（末页字段仅存 487，实为 487-512） | 作者 PS 全文影本，21 页，首页自注「version of a paper that appears in Noûs 25/4, 1991」（字距已合并） | `/tmp/org-v3-coordination-sources-20261013/teamwork-plainrefs.ps`；`16dd463eb879673395aace4d1941ddfb5d65fe60033686bd6ee1bf210207b784`；来源 `http://www.cs.toronto.edu/~hector/Papers/teamwork-plainrefs.ps`（经 Wayback 2006-05-02 快照取回） |

## C1 Smith 1980：合同网的两向局部选择与未量化权衡

核心机制：任务通告 → 投标 → 授标的两向局部选择合同，节点不预先固定为管理者或承包者，合同可再分包成层级（pp.1104-1105）。

作者边界与原文（页码按扫描页脚）：
1. 合作定义：KS「cooperate in the sense that no one of them has sufficient information to solve the entire problem」；「there is neither global control nor global data storage」（p.1104）。共同目标是合作求解本身，不是联合意图形式化。
2. 成本前提：松耦合定义为「individual KS's spend most of their time in computation rather than communication」（p.1104）。
3. 同步性：作者明写「We assume global synchronization among the nodes. However, time is not critical in the negotiation process.」；迟到投标「not catastrophic: at worst, they may result in a suboptimum selection of contractors」（p.1106）。这里的 at worst 只描述迟到投标的后果, 不是全协议的最优性界。
4. 消息与通信成本：「the cost is at least one additional acknowledgment message per transaction」；通知落选者「would likely be a very large increase in message traffic」；单标未决防多授但「the cost would be significant delay」；投标节奏「offers a reasonable compromise between message traffic and delay in allocating tasks」（pp.1108-1109）。全部为定性权衡，无数字。
5. 承诺与解除：投标有约束力（「Because bids are binding」）；管理者可用 termination message 终止合同，承包者「terminates execution of the contract indicated in the message and all of its outstanding subcontracts」（pp.1107-1108）。作者自评谈判取合「only tentative and warrant further detailed analysis」（p.1108）。

结论：机制、边界与通信/延迟权衡均已核到原文；原文没有「投标自估可信度」或校准论述（该问题出现在后续 LLM 借用文献中），也没有完备性或最优性定理。

## C2 Erman et al. 1980（Hearsay-II）：全文已取，机制＋边界初核（五项处置已标，全文未逐句通读）

题录经 Crossref 核验通过（题名、作者、卷期页、1980-06）。ACM DL 直连返回 Cloudflare「Just a moment」挑战页；Wayback CDX 确有 2024-04-23 的 application/pdf 200 快照（CDX digest `7UR4U2L7XHTXGU37TWHP5WIB56CBN6CC`），前两次下载（90s、240s）分别在约 1.40MB 与 24KB 处超时截断；第三次长超时下载取得完整快照：`/tmp/org-v3-coordination-sources-20261013/hearsay3.pdf`（3,826,935 B，41 页，SHA-256 `0ae2e93fc785f06ee1736c18cf52a1e5b9d100ef59c30e9277e90e9199096c09`，`pdftotext` 可解析；入口同来源表）。OCR 误认字母按文义校正（如 `actlwhes`→activities），未改词序。首窗口完成机制层初核、续窗口完成边界与缺项定向检索（页码为印刷页，PDF 第 1 页＝p.213）：

1. 核心机制（摘要，p.213）：「a general framework for coordinating independent processes to achieve cooperative problem-solving behavior」；「reconstructs an intention from hypothetical interpretations formulated at various levels of abstraction」；「allocates limited processing resources first to the most promising incremental actions」；「a focus-of-control mechanism to identify potential actions of greatest value」。
2. 黑板（p.218）：「the blackboard serves in two roles: It represents intermediate states of problem-solving activity, and it communicates messages (hypotheses) from one KS that activate other KSs」；「The blackboard is subdivided into a set of information levels corresponding to the intermediate representation levels...」。
3. 知识源（p.218）：解释由「diverse and independent programs called knowledge sources (KSs)」执行；必要性来自「the diversity of transformations used by the speaker...」。
4. 前提（p.217）：「The accrual of constraints reduces the uncertainty inherent in the data and in the knowledge sources themselves. Three requirements must be met for such a problem solver to be effective...」。
5. 作者边界（续窗口定向检索，印刷页）：无最优保证——p.231「the control and rating strategies do not guarantee that the first such complete spanning hypothesis found will have the highest rating of all possible spanning sentence hypotheses that might be found if the search were allowed to continue, so the system does not just stop with the first one generated」（末句续至 p.232，随后由 STOP KS 按评分函数做启发式剪枝）；p.236 对照 HWIM「shortfall density scoring strategy」时明写「contrasts with the approximate Hearsay-II scheduling strategy, in which there is no guarantee at any point that a better interpretation cannot be found by continued search. Thus Hearsay-II requires a heuristic stopping decision」——可形式保证最优（admissible）属 HWIM 的对照策略，不能挂到 Hearsay-II。资源限界——p.217 三要求之(3)「The cost of problem solving must satisfy some externally specified limit. Usually this limit restricts the time or space available for computing. As a consequence, it leads to restrictions on the number of alternative partial interpretations that can be considered.」
6. 五项逐项处置：机制＝已核（第 1–4 条）；作者边界＝已核（第 5 条）；同步性／通信成本／承诺解除＝定向检索未核到原文展开（`chron` 词根含 `asynchron` 零命中；`overhead / bottleneck / traffic / communication cost` 组合零命中；`cost` 全文 7 处均为计算、编译或运行成本语境；`commit` 命中均为无关语境，如 p.216 judgment mistakes、p.233 study committee）。属检索性缺项，非通读后确认「原文无」；OCR 字母误认风险未排除，未核到即未核到，不据二手转述补写。

## C3 Hewitt / Bishop / Steiger 1973：单一消息原语的统一调用

核心机制：一切都建模为 actor，全部行为统一为「sending messages to actors」；消息发送是唯一的原语（p.235 摘要/引言）。

作者边界与原文：
1. 统一调用：「An actor is always invoked uniformly in exactly the same way regardless of whether it behaves as a recursive function, data structure, or process.」（p.235）
2. 无传统同步原语：「does not have or need goto, interrupt, or semaphore primitives」（p.235 摘要）；摘要续句说明这些构造的目标由「other more structured methods」实现，而非此形式化不需要同步语义。
3. 同步性：这些原语由 actor 与消息表达，「SYNCHRONIZATION: It provides at least as powerful a synchronization mechanism as the multiple semaphore P operation with no busy waiting and guaranteed first in first out discipline on each resource.」（p.236）
4. 目标与意图：论文处理的是 actor 的 intention 而非团队共同目标；ACTOR INDUCTION 的表述面是「the intentions of all actors sent messages by A are satisfied」（p.235），未给出合作协议或多方意图定义。
5. 未写项：作者自陈「The most important issues in privacy and protection that remain unsolved are those involving intent and trust.」（p.236）；未讨论消息成本、完备最优与承诺解除机制。

结论：原文支持「消息传递是唯一原语、调用方式统一、同步语义可在模型内表达」；不支持把它读成协调效率或组织形态理论。页码以 IJCAI 官方扫描 PDF 的印刷页脚逐页核对（PDF 第 1 页＝p.235，共 11 页至 p.245）。

## C4 Modi / Shen / Tambe / Yokoo 2005（ADOPT）：题录已核，正文未核

题录：Artificial Intelligence 161(1-2):149-180（2005），作者 Modi、Shen、Tambe、Yokoo，DOI 10.1016/j.artint.2004.09.003 经 Crossref 与 OpenAlex 一致核验，派单所给 DOI 正确；PII S0004370204001511。
正文未取得：ScienceDirect 直连返回 TDM/Cloudflare 挑战页（非 PDF）；CiteSeerX `document?doi=10.1.1.135.7450` 返回 404；Internet Archive CDX/availability 多次 502/504/429。核心机制、作者边界与五项行为均标**未核**，本件不写 ADOPT 的算法描述或最优性结论。

## C5 Cohen / Levesque 1991：联合意图=联合承诺+相互信念，直至共同知晓结束

核心机制：把意图解释为「commitment to perform an action while in a certain mental state」，承诺是「a goal that persists over time」；团队由 joint commitment 绑定（引言与 §4；引文已合并字距）。

作者边界与原文：
1. 形式化标准：规格「too weak, in that they would fail to guarantee intuitively appropriate outcomes, as well as specifications that are too strong, in that they would place unreasonable demands on agents」；作者随后自我修正被反例推翻的过强版本（相互信念在结束时仍持续的疑难），说明其为提案而非定论。
2. 联合意图定义：「x and y jointly intend to do some action iff it is mutually known between x and y that they each intend that the collective action occur, and also that they each intend to do their share as long as the other does likewise, and this mutual knowledge persists until it is mutually known that the activity is over (successful, unachievable, irrelevant).」（提案 2，§5 附近）
3. 承诺解除：个体承诺从属且可随联合承诺放弃，「the individual commitments are subsidiary to the joint ones and can be abandoned if the joint ones are given up」；相对承诺可因前提失效而放弃「if the agent comes to believe q is false, she can abandon the commitment to p」。
4. 共同目标与通信：作者把「何时必须通信」设为理论要求而非结论：「Any theory of joint action should indicate when communication is necessary.」；通信因个体分歧而必要（「it is this divergence among the agents that makes communication necessary」）。未给通信成本模型。
5. 同步性：事件按离散同步方式刻画，并自注可推广到连续异步：「Currently, we picture these events as occurring in a discrete synchronized way, but there is no reason not to generalize the notion to a continuous asynchronous mode...」（Notes 1）。未核得调度完备性或最优性定理; 文中确有 guarantee 的规范讨论, 不能声称该词或相关讨论不存在。

结论：原文支持「联合意图由共同知识与相互信念定义、承诺持续到共同知晓活动结束（成功/不可达/已无关）、联合承诺解除时个体承诺随之解除」；不支持把它读成调度或最优性理论。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| ①四路各至少五条经典出处（内容核验） | 协调路 4 篇取得正文（Smith、Hewitt、Cohen & Levesque 按五项核完；Erman 机制＋边界已核、同步/成本/承诺为检索性缺项）；Modi 2005 仅题录 | 3 篇内容已核；Erman 机制与边界已核、缺项已标；ADOPT 正文未核；四路各五条未达标 |
| ②每条给边界条件，至少三条带出处的设计警告 | C1/C3/C5 各给作者自述边界；Hearsay 边界已初核（无最优保证＋启发式停止，p.231/236；资源限界，p.217）；ADOPT 无内容 | 四篇边界已核（Hearsay 为定向检索级初核）；ADOPT 无；Pod 适用性复算留主会话 |
| ③借用与修辞区分 | 未覆盖（本包不含 LLM 文献正文核验） | 未核 |
| ④交付物落盘含来源表与盲区 | 本补核件含来源表、实读层级与缺口 | 部分 |

## 剩余缺口

- Erman et al. 1980（Hearsay-II）：机制与边界已核（见 C2）；「同步性/通信成本/承诺解除」仅做到定向检索未核到, OCR 变体风险未排除。未逐句通读, 不能把这些缺项写成原文不存在。
- Modi et al. 2005（ADOPT）：本件未取得原作。后续[权威二手补核](03-coordination-gaps-20261013.md)已核综述 §4.3.4 与 Table 4; 可引用的层级和剩余原作缺口见该件, 不再统称只有摘要线索。
- Teamwork 影本为作者 PS 版，页码未与 Noûs 487-512 逐页对齐；公式与定义符号未逐符号转录，涉及形式语义的引用需主会话回原文或取得出版方正本复核。
- 本包不覆盖合同网以外的机制设计/BDI/团队理论条目，也不覆盖原报告 §5 的借用核验。
