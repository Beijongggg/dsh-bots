# 03 经典设计警告: 五篇一手原文补核（首包）

[组织理论、复杂系统与控制论（纯理念面）](../../issues/03-research-organization-theory-and-concepts.md)工作包「经典内容补核」的首包, 按[研究补核与委派](../../research-handoff.md)只交原文提取与作者边界, 不替代四路各五条的全票要求; 理论迁移、引用强度与关票由主会话处理。采集性质为公开副本全文提取, 快照语义见下表; 采集基线 commit `a8967ce118c9becfad132159ae50f9a86ba11397`。

## 来源与快照

| 来源 | 入口与版本 | 实读层级 | 快照与 SHA-256 |
|---|---|---|---|
| Gersick 1988 | AMJ 31(1):9-41, doi 10.2307/256496; MIT 公开 PDF `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Group_Dynamics/Gersick_1988_Time_and_transition.pdf` | 全文 33 页（1-up） | `/tmp/classic-03-20261013/gersick1988.pdf`（抽取 `gersick.txt`, `gersick1988.raw.txt`）; `1f574c07231a34b0090ac53df7025eb21b106b90fa1ed8283d950660fd93e253` |
| Galbraith 1974 | Interfaces 4(3):28-36, doi 10.1287/inte.4.3.28; SJSU 公开 PDF `http://strategy.sjsu.edu/www.stable/pdf/Galbraith,%20J%20R,%201974,%20Interfaces.%204%20pp%2028-36.pdf` | 全文, 实物 10 页 | `/tmp/classic-03-20261013/galbraith1974.pdf`（抽取 `galbraith.txt`, `galbraith1974.raw.txt`）; `8be8c47e203811f6df03d4791c89ceec99092c9be099bf00a8f13c921874d7fd` |
| Hannan & Freeman 1984 | ASR 49(2):149-164, doi 10.2307/2095567; NTNU 课程镜像（JSTOR 扫描）`http://www.iot.ntnu.no/innovation/norsi-pims-courses/harrison/Hannan%20&%20Freeman%20(1984).PDF` | 全文 21 页（两栏） | `/tmp/classic-03-20261013/hf1984.pdf`（抽取 `hf1984.txt`, `hf1984.raw.txt`）; `38a1ebfacc86e1b671a27759f53539cbe48eb57c3a5e179199798f3b66f71c83` |
| Ashby 1956 | An Introduction to Cybernetics, Chapman & Hall; Wayback 快照 `https://web.archive.org/web/2020id_/http://pcp.vub.ac.be/books/IntroCyb.pdf`（原站超时, 快照时间戳不可定） | 全文 156 页（2-up 扫描） | `/tmp/classic-03-20261013/ashby-wayback.pdf`（抽取 `ashby.txt`, `ashby-wayback.raw.txt`）; `26bd434d9b5d8e430c9b6aea107983249a7196b438502d4624847ab7b8c15da6` |
| Wolpert & Macready 1997 | IEEE TEC 1(1):67-82, doi 10.1109/4235.585893; UBC 课程公开 PDF `https://www.cs.ubc.ca/~hutter/earg/papers07/00585893.pdf` | 全文 16 页＋封面 | `/tmp/classic-03-20261013/nfl-ubc.pdf`（抽取 `nfl.txt`, `nfl-ubc.raw.txt`）; `7bf3552a29bcbdfa60e70156a7ab6072174586fb596ae29fb4b1509cff0b6266` |

版本注记: 五篇均经公开副本全文读取; 出版方正本未取（Galbraith INFORMS 与 Hannan & Freeman SSRN 均 403, Ashby 原站超时）。Ashby 为 2-up 扫描, 版式文本常按两栏交错, 关键句另经页图核读; NFL 的定理式含数学记号, 抽取文本有丢字, 本包只按页图与散文陈述引用。
页码口径: Gersick 按刊页（PDF 页号 +8）; Galbraith 按刊页（PDF 页号 +27）; Hannan & Freeman 按刊页（原始抽取第 2 页起为 p.149）; Ashby 按书页码（页图核对）; Wolpert & Macready 按刊页（PDF 页号 +66）。

## A1 Gersick 1988: 中点转变是样本模式且作者自设边界

主张ID A1(关闭项①②, 消费票 06/11; 支撑报告 §6.3, 下游 08 防抖闸门经 06 传递): 「中点转变」是作者从有截止期的观察样本中得到的模式, 不是可外推为通用节奏的阶段律。
定位: Gersick 1988, 摘要 p.9; 方法 p.13; 发现 p.16 与模式陈述 p.17; 局限 p.36。
原文摘录: 摘要 "did not accomplish their work by progressing gradually through a universal series of stages" 与 "teams progressed in a pattern of 'punctuated equilibrium,' through alternating inertia and revolution" ; p.13 "The eight groups in the study (see Table 1) came from six different organizations in the Northeast; the three student groups came from the same university." 与 "Their life-spans varied in duration from seven days to six months." 与 "I did not select groups randomly but did choose them carefully" ; p.16 "each group experienced its transition at the same point in its calendar-precisely halfway between its first meeting and its official deadline" ; p.17 "At the midpoint of their allotted calendar time, groups undergo a transition" ; p.36 "It was hypothesis-generating, not hypothesis-testing; the model is expressly provisional. One person conducted the analysis." 与 "results should apply only to groups that have some leeway to modify their work processes and must orient themselves to a time limit."
量化附项: 观察样本 8 组（来自 6 个组织, 含 3 个同校学生组）, 任期 7 天至 6 个月; 无实验臂、分母与单位换算, 其余不适用。
结论/局限/未核: 原文支持「中点转变是该样本中的模式」, 不支持「按里程碑一次切换」或任何固定频率; 假设生成、单一分析者、非随机抽样与作者自限适用范围均为作者自述。向 Pod 切换节奏的迁移是推断, 不由本包裁定。

## A2 Galbraith 1974: 不确定性—信息处理的成本框架是假设框架

主张ID A2(关闭项①②, 消费票 06/11; 支撑报告 §6.1): 任务不确定性与信息处理量挂钩, 四种设计策略各有成本, 「选最小成本」是待验的假设命题而非定理。
定位: Galbraith 1974, p.28（命题与选择准则）; p.30（slack 资源的成本）; p.31（self-containment 及其成本）; p.35（案例数字）; p.36（结论与第五策略）。
原文摘录: p.28 "A basic proposition is that the greater the uncertainty of the task, the greater the amount of information that has to be processed between decision makers during the execution of the task." 与 "Which strategy is chosen depends on the relative costs of the strategies." ; p.30 "The strategy of using slack resources has its costs." ; p.31 "The cost of the self-containment strategy is the loss of resource specialization."（页 31 页图核对; 公开文本 OCR 作 tbe）与 "The greater the degree of uncertainty, other things equal, the greater the degree of self-containment." ; p.35 "22% of its managers in integration roles" ; p.36 "the four strategies are hypothesized to be an exhaustive set of alternatives" 与 "It will choose that strategy which has the least cost in its environmental context." 与 "If it does not consciously choose one of the four, then the first, reduced performance standards, will happen automatically." 与 "Not to decide is to decide" 与 "There is probably a fifth strategy which is not articulated here." 与 "But these maneuvers have costs also."
量化附项: 唯一可复算数字为案例组织 "22% of its managers in integration roles"; 无对照实验、两臂配置与分母, 其余成本项为定性清单, 不适用。
结论/局限/未核: 最少成本选择与四策略穷尽性在原文均为 hypothesized; 作者自认存在未展开的第五策略（作用于环境而非改造组织）, 且其成本应与其他策略比较; 原文不给可复算成本数字。向 Pod 选形成本、选择频率与元层开销的迁移是推断; 报告 §6.1 的摘要命题本轮补到正文原句。

## A3 Hannan & Freeman 1984: 结构惯性的定义、来源与理论边界

主张ID A3(关闭项①②, 消费票 06/11; 支撑报告 §6.2): 高结构惯性是选择过程的后果而非前提; 惯性是按环境变化速率比较的相对量; 规模—惯性—重组—死亡率的链条是理论假设与定理, 不是已测规律。
定位: Hannan & Freeman 1984, 摘要 p.149; 惯性定义 p.151; Assumption 1 p.153; Assumption 3 与 Theorem 1 p.154; Assumption 5 p.158; Assumption 6 与 Theorem 4 p.159; 规模—变化率关系 p.159。
原文摘录: p.149 "consequence of a selection process rather than as a precondition for selection" 与 "It also considers how the strength of inertial forces varies with age, size, and complexity." ; p.151 "is not the same as claiming that organizations never change" 与 "defined in relative and dynamic terms" 与 "structures of organizations have high inertia when the speed of reorganization is much lower than the rate at which environmental conditions change" ; p.153 "favors forms with high reliability of performance and high levels of accountability" ; p.154 "High levels of reproducibility of structure generate strong inertial pressures." 与 "Selection within populations of organizations in modern societies favors organizations whose structures have high inertia." 与 generalists "are no less inert than specialists in the manner in which they adapt to environmental change in the sense that they still use a limited number of routines" ; p.158 "Whether there is a threshold as we have suggested or a continuous relationship as Downs suggested, it seems clear to us that size does affect inertia." 与 "The level of structural inertia increases with size for each class of organization." ; p.159 "The process of attempting reorganization lowers reliability of performance." 与 "Attempts at reorganization increase death rates." 与 "The relationship between size and the rate of structural change is indeterminate in our theory for two reasons."
量化附项: 不适用（理论假设与定理, 无数据集、实验臂或分母）。
结论/局限/未核: 原文摘要列出的变量是 age、size 与 complexity, 报告 §6.2 括注的「正式化」本包未逐词核到（「规模」「年限」有对应表述）; 规模—变化率关系由作者自标 indeterminate; 通用者并不更不惰性。原文无实测数字, 向 agent 组织的迁移是推断。

## A4 Ashby 1956: 必要多样性是组合命题及其容量上限

主张ID A4(关闭项①②, 消费票 06/11; 支撑报告 §6.5): 必要多样性给出调控所需多样性的表条件与容量上限, 它不声明哪条策略成本最低。
定位: Ashby 1956, §7/7 p.126（variety 定义）; §11/5 p.204; §11/6 p.206; §11/7-8 p.207; §11/9 p.208; §11/10 p.209; §11/11 p.210。
原文摘录: p.126 "will be used to mean either (i) the number of distinct elements, or (ii) the logarithm to the base 2 of the number" ; p.204 "no column contains a repeated outcome" ; p.206 "the variety in the selected set of outcomes cannot be fewer than r/c" 与 "the variety of the outcomes can be reduced to a half (but not lower)" 与 "Only variety in R's moves can force down the variety in the outcomes." ; p.207 "only variety in R can force down the variety due to D; variety can destroy variety" ; p.208 定理式 `VO ≥ VD − log k − log VR`（页图核读）; p.209 "The theorem is primarily a statement about possible arrangements in a rectangular table." 与 "The law therefore owes nothing to experiment." ; p.210 "R's capacity as a regulator cannot exceed R's capacity as a channel of communication."
量化附项: 计数单位为可区分结果／状态数或其 log₂。§11/5-6 的矩形表要求同列结果不重复; §11/9 另放宽为每个元素在一列中最多出现 k 次, 不能把前一条件套给扩展式。上行公式保留原书记号, 不换写为 Pod 的任务数或策略数; 无实验分母, 成本与频率数字不适用。
结论/局限/未核: 该定律是组合与计数陈述, 作者明说不依赖实验; 原文不给策略成本排序。报告 §6.5 的三条增强路径（类目更细、特征更多、权限更大）及其成本排序不在原文, 属项目推断; 限制任务入口与默认形态只是候选, 本包不排序。

## A5 Wolpert & Macready 1997: NFL 的平均口径与不覆盖范围

主张ID A5(关闭项①②, 消费票 06/11; 支撑报告 §6.7): 在全部代价函数上均匀平均时任意两算法表现相同, 一类问题上的抬升由另一类抵消; 定理不直接给 minimax 结论, 也不要求冻结现实任务分布。
定位: Wolpert & Macready 1997, 摘要 p.67; 引言 p.67; §II p.68; §III 与 Theorem 1 p.69（定理式丢字, 按页图与散文陈述）; 抵消句与 Theorem 2 p.70; flat prior 句 p.71; §VI p.74。
原文摘录: 摘要 "any elevated performance over one class of problems is offset by performance over another class" ; 引言 "the average performance of any pair of algorithms across all possible problems is identical" 与 "then the reverse must be true over the set of all other optimization problems" ; p.68 "no a priori justification for using a search algorithm's observed behavior to date on a particular cost function to predict its future behavior" ; p.69 "if an algorithm performs well on a certain class of problems then it necessarily pays for that with degraded performance on the set of all remaining problems" ; p.70 "offset by its performance on the remaining problems" 与 "A result analogous to Theorem 1 holds for a class of time-dependent cost functions." ; p.71 "any class of problems faced by a practitioner will not have a flat prior" ; §VI p.74 "The NFL theorems do not directly address minimax properties of search."
量化附项: 无实验臂、分母与单位。原模型采用有限搜索空间、有限 cost 值域, m 次观测按不同搜索点的 oracle calls 计; 重访不增加新样本。平均口径为全部代价函数集合 f 上的均匀平均（flat prior）, 不是任意现实任务分布。
结论/局限/未核: 定理式含数学记号, 抽取文本丢字符, 本包不逐符号转录, 只按页图与散文、文字化陈述引用; 否定面限于该均匀平均口径, 不直接给 minimax 结论; 原文没有「现实任务分布必须冻结或预先完全已知」的结论, 「报告适用分布与基线」是方法建议（报告 §6.7 已标为推断）。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| ①四路各至少五条经典出处（内容核验） | 组织路 3 条（Gersick/Galbraith/Hannan & Freeman）、控制论路 1 条（Ashby）; NFL 供 §6.7 警告, 不计四路 | 内容与边界已核; 四路各五条未达标 |
| ②每条给边界条件, 至少三条带出处的设计警告 | 五篇边界见各节; 直接补 §6.1/§6.2/§6.3/§6.5/§6.7 原文条件 | 原文条件已核; Pod 适用性复算留主会话 |
| ③借用与修辞区分 | 未覆盖（本包不含 LLM 文献正文核验） | 未核, 0 进展 |
| ④交付物落盘含来源表与盲区 | 本补核件含来源表与自身缺口; 主报告盲区清单合并归主会话 | 部分 |

## 剩余缺口

- 本件只覆盖表中五篇; 后续补核与四路合计以[主报告](../organization-theory-and-concepts.md)为准。本件不替其他条目的内容与作者边界背书。
- Gersick: 非随机抽样、单一分析者与假设生成自限已核; 「每组独立同质」不可定论, 中点转变不可外推为通用切换节奏。
- Hannan & Freeman: 「正式化」未逐词核到; 规模—惯性—死亡率链条为理论假设与定理, 原文无实测数字; 惯性为相对定义, 不可读成「永不改变」。
- Ashby: Wayback 快照时间戳不可定、原站超时; 2-up 扫描的版式文本列交错。所引 §11/9 公式与关键条件已按页图核读, 全章推导未逐符号重建, 不据此证明项目中的控制器性质。
- NFL: 公式与定理完整形式未逐符号转录; 「定理不覆盖何种现实分布」的分界只按原文散文与页图记录。
- 关闭项③（借用 vs 修辞）完全未覆盖; 06/11 的引用与迁移、08 经 06 的间接消费留主会话裁定。

## 会话记录

- 模型为原生协作子代理 `opencode-go/deepseek-v4.1-flash/max`, 不是 DSH Delegate; session_id、token、精确墙钟与主会话主动验收工时未知。日期按实测只记 2026-10-13, 主会话在交付前指出首包超出原 25 分钟预算。
- 返工: 本轮未见重新派发; 交付前有主会话的范围提醒与时间提醒, 不记零返工通过。
- 引文核验: 本件英文直引经去空白标点归一化后对每篇 layout＋raw 两路抽取文本做包含匹配（脚本 `/tmp/classic-03-20261013/verify-03.py`, 实测 54 条命中、0 未解; 含重复出现的同一句）; Galbraith p.31 一处公开文本 OCR 作 tbe, 经 PDF 第 4 页页图核为 the; Ashby §11/9 公式与 NFL 定理式不在自动匹配范围, 按页图与散文陈述核读。
- 工具边界: 只写本补核件; 工作件、抽取文本与页图在 `/tmp/classic-03-20261013/`; 未动 `.tmp/`、`~/.dsh`、部署目录与真实配置; 未跑论文代码、模型实验或安装依赖; 未提交、未暂存; 票面、地图、research-handoff、其它 research 件与既有 supplement 未触碰。
- 已读原件缓存（供主会话复用）: 五份 PDF `gersick1988.pdf`/`galbraith1974.pdf`/`hf1984.pdf`/`ashby-wayback.pdf`/`nfl-ubc.pdf`, 两路抽取 `*.txt` 与 `*.raw.txt`, 页图 `ashby-pg-109.png`/`ashby-pg-110.png`/`ashby-pg-111-111.png`/`ashby-pg-112-112.png`/`ashby-pg-069-069.png`/`galbraith-pg-04-04.png`/`nfl-pg-02-02.png`, 及 `probe.py`/`ctx.py`/`verify-03.py`。
