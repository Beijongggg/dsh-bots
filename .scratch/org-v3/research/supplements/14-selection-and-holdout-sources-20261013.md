# 14 选择偏差与保留集复用: 三组一手来源补核

「持续演进中的评测过拟合与反复选择偏差」的原文提取包, 经主会话验收校正。统计解释、Pod 迁移和整票验收见[研究票](../../issues/14-research-adaptive-evaluation-and-selection-bias.md)。采集基线 commit `a8967ce118c9becfad132159ae50f9a86ba11397`; 快照目录 `/tmp/adaptive-evidence-14-20261013/{pdf,txt,html}/`。

## 来源与快照

| 来源 | 入口与版本 | 读级 | SHA-256 |
|---|---|---|---|
| Cawley & Talbot 2010 | 题录 https://www.jmlr.org/papers/v11/cawley10a.html , 11(70):2079-2107; PDF https://www.jmlr.org/papers/volume11/cawley10a/cawley10a.pdf | 全文 29 页 | `db01ac8fabef3064a0297bfcf64fb9791bf35c4d03be7a51f5862260adfca206` |
| Dwork 等 Science 2015 | Science 349(6248):636-638, 2015-08-07, doi 10.1126/science.aaa9375, 题录经 NLM PubMed 26250683 核对; 正文取镜像 http://homes.gersteinlab.org/people/jrb97/Science-2015-Dwork-636-8.pdf , 含 sciencemag 水印 | 全文 4 页, 入口为镜像 | `f182b0eaf77d6a80eb1069781eeba76ee102b8ded647a3ddb1217f93604d5647` |
| Dwork 等同作者 arXiv 篇 | "Generalization in Adaptive Data Analysis and Holdout Reuse", arXiv:1506.02629v2, 2015-09-25, NeurIPS 2015 | 全文 34 页 | `dcfbb9aa401c62949123be2d74787c4f9cca48597f18860760ef1580ddb4bc71` |
| Blum & Hardt 2015 | PMLR 37:1006-1014, ICML 2015, https://proceedings.mlr.press/v37/blum15.html 与 .../blum15.pdf ; arXiv:1502.04585v1 备查 | 全文 | `196fd444c506199c321e973ca101f4715055972a42ba77fd0de43324f9b974d7` |

版本核对: 本次 arXiv 标题检索 "reusable holdout" 0 命中, 未核得 Science 同篇 arXiv 版(单次标题检索不足以断言不存在); MSR 出版页 403, 出版 PDF 未取。arXiv:1506.02629 是另一篇同作者论文, 含 SparseValidate 与 description-length 方法; Science 篇只给 Thresholdout 主机制并指向 supplementary。阈值常数与定理号必须挂具体篇目, 不得混引。STOC 2015 `[DFH+14]`(arXiv:1411.2664)属同家族, 未读, 不转引。

## A1 反复选最优为什么产生选择偏差

主张ID A1(关闭项①, 消费票 09/11): 有限样本、有噪声的选择分数被反复选优时偏差从何而来。
定位: Cawley & Talbot 2010, 摘要; §4 p.2085 Fig.2; §4.1 p.2086; §4.3 pp.2090-2091; §5 p.2094。

原文摘录: 摘要 "a low variance is at least as important, as a non-negligible variance introduces the potential for over-fitting in model selection as well as in training the model." ; p.2085 Fig.2(a) "the expected value of the true test MSE initially shows a decrease ... but after a relatively short time (approximately 30-40 iterations), the test error begins to climb slowly once more as the hyper-parameters are tuned in ways that exploit the meaningless statistical peculiarities of the sample." ; p.2091 "the majority of ARD models display a lower value for the PRESS statistic than the corresponding RBF model, while exhibiting a higher test error rate."

量化附项: 合成基准 1000 个独立 realisation, 每 realisation 64 样本, 4 折 CV 准则对生成模型真值, 曲线按 1000 次平均, 单位 MSE, 30-40 次迭代后真值回升; 13 个基准的 RBF 对 ARD 两臂共用同一 PRESS 准则与真值口径, 见 Table 2。"偏差量级与算法间真实差异相当"是作者结论, 非独立复算。

结论/局限/未核: 作者结论为 over-fitting in model selection 在合成与真实基准均存在, 主因是准则估计量方差。局限: 针对超参数与模型选择准则, 不覆盖提示词或阈值调优; 本包不指定显著性阈值。

## A2 Thresholdout 的反馈形式与保证条件

主张ID A2(关闭项①, 消费票 09/11): 允许何种自适应反馈、依赖什么条件、何时失去保证。
定位: Science 2015 pp.636-637; arXiv:1506.02629v2 §1.1.1 p.2, §4.1 pp.15-17 (Lemma 23 p.15, Fig.1 p.16, Lemma 24 与 Theorem 25 均在 p.17)。

原文摘录: Science p.636 "The analyst is given unfettered access to the training data set but can only access the holdout set via an algorithm ... that allows the analyst to validate statistics on the holdout set." ; p.637 "Thresholdout can continue validating the estimates ... until either the total number of functions asked becomes exponentially large in the size of Sh or the number of functions that fail the validation ... becomes quadratically large in the size of Sh." ; arXiv p.2 "The analyst can perform any analysis on the training dataset, but can only access the holdout set via an algorithm", 查询按先前回答自适应生成时保证仍成立。

机制(arXiv 记号; Science 正文同处记 `T+h`/`E_Sh[f]+x`): `E_St[f]` 与 `E_Sh[f]` 之差低于带噪阈值 `T+eta` 时只返回 `E_St[f]`; 超过时返回 `E_Sh[f]+xi` 并消耗预算 B; 预算耗尽返回 `⊥`。形式条件(arXiv Theorem 25, p.17): `phi_i: X->[0,1]`; holdout S 大小 n 为 i.i.d. 取自 P, `St` 任意, `m>=B>0`; 记 `Z_i = |{j<=i : |P[phi_j]-E_St[phi_j]| > tau/2}|`, 则 `P[存在 i in [m], Z_i < B 且 |a_i-P[phi_i]| >= tau] <= beta`, 且 n 需满足 `min{n0,n1}` 下界。Science 正文只给非形式保证, 精确条件指向 supplementary §2, 本包未取, 标未核验。

何时失去保证: 预算耗尽后不再回答; 超阈值查询数超过 B 的查询在定理条件外; 只覆盖 `[0,1]` 值查询; 保证针对抽样分布 P, 原文无分布变化条款。Science 实验 `T=0.04`, `t=0.01`(arXiv 记号 `tau`), 并注明当两均值差小于 0.04 时报告精度可差到 0.04。

量化附项: Science Fig.1 无相关合成数据, `n=10000`, `d=10000`, 100 次独立执行, `k=500` 时标准 holdout 报出 >63 ± 0.4% 分类精度而真实精度上界 50%; 两臂配置相同, 分母=100 次执行, 单位=精度百分点。节省比例等项不适用, 不估。

## A3 Ladder 的限制公布机制与误差界

主张ID A3(关闭项①③, 消费票 09/11): 机制限制什么信息、真正支持什么界与假设、为何仅隐藏标签不够。
定位: PMLR 37:1006-1014, §2 Definition 2.1, §3 固定步长版 Algorithm 1 与 Theorem 3.1(上界), §3.1 下界 Theorem 3.3, §4 parameter-free 版 Algorithm 2 与 §4.1(启发式), §5 Corollary 5.2, §6-§7。

原文摘录: §3 "If the estimate is below the previous best by some margin, it releases the estimate and updates the best estimate. Importantly, if the estimate is not smaller by a margin, the algorithm releases the previous best loss (rather than the new estimate)." ; Theorem 3.1 `Pr{ abs(min_{i<=t} RD(fi) - Rt) > epsilon + eta } <= exp(-2 epsilon^2 n + (1/eta + 2) log(4t/eta) + 1)` ; §3.1 "Omega(sqrt(log(k)/n)) is a lower bound on the best possible leaderboard accuracy ... true even if the functions are not adaptively chosen but fixed ahead of time."

假设与界: §1.3 中 S 为 n 个 i.i.d. 抽自 D 的样本, 损失在 [0,1]; 提交序列可自适应。固定步长版 Theorem 3.1 对各 `t<=k` 给概率界, 并给 `eta = O(n^{-1/3} log^{1/3}(kn))` 时最大绝对 leaderboard error 的高概率界 `O(log^{1/3}(kn)/n^{1/3})`。Algorithm 1 发布 `[RS(ft)]_eta` 的舍入值。主会话查看PDF第4页确认公式有绝对值, 原采集因文本提取漏竖线而写成单侧界, 已纠正。上下界 `Omega(sqrt(log k/n))` 之间作者自认有 gap, 见 §7。parameter-free 版 Algorithm 2 的 §4.1 自述检验 "primarily heuristic", 自适应使 Student 近似不成立且未控制多重比较, 本文未给该版定理级保证, 不能继承 Theorem 3.1。

隐藏标签不足: §5 Algorithm 3 的 Kaggle 式机制只公布取整到最近的 `alpha=10^{-5}` 整数倍的分数, Corollary 5.2 给出自适应序列使其 leaderboard error `>= Omega(sqrt(k/n))`(概率 2/3); 攻击实验用 12000 个标签中的 4000 个构造公开榜单。真实比赛实验: Photo Quality, holdout 12000 样本, 8400 私有/3600 公开, 200 队 1830 次提交, 解析 1785 次; Ladder 公开分数与 Kaggle 几乎一致。成本或节省数字不适用。

## A4 正常隔离解决什么, 同一 holdout 被调优怎样失效

主张ID A4(关闭项①②, 含一类"反复使用同一保留集"失效)。定位: Cawley §5 p.2094, §5.2.1 p.2098, §5.3 p.2102; Science p.636。

原文摘录: Cawley p.2094 "The key is to treat both training and model selection together, as integral parts of the model fitting procedure and ensure they are never performed separately at any point of the evaluation process." ; §5.3 p.2102 "the test data are no longer statistically pure, as they have been 'seen' by the models in tuning the hyper-parameters" 与 "the hyper-parameter settings retain a partial 'memory' of the data that now form the test partition." ; Science p.636 "If the analyst uses the outcome of the validation to select an additional data statistic, that statistic is no longer independent of the holdout data, and further use of the holdout set for validation can lead to incorrect statistical inference."

失效情形一(不同评估协议, 不是同一保留集复用): Cawley §5.2.1 pp.2097-2098, 每个 realisation 生成100个各64样本的训练集与4096样本测试集, 全部互不相交, 100 次 replication; "median" 协议对内部协议仍有乐观偏差, Wilcoxon `p<0.001`, 原文强调 "even though there is absolutely no inadvertent re-use of test data"。数据路径完全隔离也不能消除两协议因模型选择方差处理不同而出现的比较偏差。

失效情形二(反馈曝光后保留集不再独立): 同一分数先用于筛选再用于评估时, 评估对象不再是"与 holdout 独立的固定过程"(Science p.636); Cawley §5.1 p.2095 的内部协议把模型选择放进每次重采样内部作为无偏做法。

结论/局限/未核: 原文支持"隔离 + 过程独立性"用于单次选择与评估, 不支持"只要切分数据就安全"。三篇均未给开发集/验证集/最终确认集的命名分区规范, 也未给允许查看次数。

## A5 独立确认、新样本与分布变化

主张ID A5(关闭项②④, 消费票 09/11)。

已核原文: Cawley 结论 p.2103 "model selection should be viewed as an integral part of the model fitting procedure, and should be conducted independently in each trial in order to prevent selection bias", 并要求多次随机划分; §4.4 p.2094 "over-fitting in model selection is likely to be most severe when the sample of data is small and the number of hyper-parameters to be tuned is relatively large"。Science p.636 "Because the holdout was drawn from the same data distribution independently of the statistic, standard statistical inference procedures can safely be used."; 保证针对 true distribution P。Ladder §1.3 原文 "we assume that S consists of n i.i.d. draws from D and ℓ is a loss function with bounded range"(ℓ 为损失函数符号); 私有 leaderboard 使用该次分割的剩余标签。

主会话补核: Science p.636明确写 "collect new data for a fresh holdout set", p.638再次说明在后续函数依赖既往验证时使用 fresh holdout 的原则。arXiv §1 p.2还列出仅报告大量候选中的最佳者、停止条件和人工选择带来的依赖。不能据没有Pod术语就认定新样本与候选确认全无原文依据。Pod换题流程、失败日志格式、多次模型重试与长周期任务仍未直接研究, 迁移须由主会话标为项目推断。

## 本包的核心问题覆盖

| 票面核心问题 | 本包覆盖 | 状态 |
|---|---|---|
| ①反复比较与反馈曝光的选择偏差 | A1 全文证据; A2/A3 自适应反馈机制 | 原文已核, 限三组四篇 |
| ②开发/保留/确认集各支持什么, 保留集何时已被调优 | A4过程独立性与A5 fresh holdout原则; 无Pod三分区规范 | 原理可用, 迁移由主会话完成 |
| ③晋级、失败候选留痕、限制查看、引入新任务 | A3限制分数公布; A5多候选/停止依赖与新样本原则 | 不直接给Pod晋级、日志或换题流程 |
| ④小样本、多次重试、长周期、分布变化 | A5小样本、i.i.d.固定分布及适应性前提 | 未直接研究后三种Pod场景, 前提适用性由主会话判断 |
| 风险与防护对照表四项 | 下节只给可抄机制, 终表由主会话做 | 未完成, 非本包 |

## 可抄的已核防护机制

| 风险 | 已核机制 | 生效前提 | 不能保证 |
|---|---|---|---|
| 反复选优 | 每次 trial 内独立做模型选择, 多次随机划分(Cawley §5.1 与结论) | 可重复执行选择过程 | 不消除协议级方差平滑偏差(§5.2.1) |
| 反馈曝光 | 只经带预算与阈值的机制访问 holdout, 超阈值才返回 holdout 值(Science 636-637) | 查询值域 [0,1], holdout i.i.d. 自 P, 预算未耗尽 | 预算耗尽停答; 分布变化未覆盖 |
| 晋级确认 | Ladder §3仅在改善超过固定步长时公布新值; fresh holdout作独立确认的依据见A5 | 固定Ladder的样本/步长条件; 独立确认另须新数据与该候选独立 | 分数发布不等于晋级批准; 参数无关版不继承定理 |
| 题集更新 | Science p.636/p.638的fresh holdout原则 | 新样本来自同一目标分布且与待估对象独立 | 不给Pod换题周期或漂移保证 |

## 缺口与未核字段

- Science supplementary §2 未取; A2的形式条件来自另篇arXiv v2 Theorem 25, 不冒充Science补充材料。
- Science 本次未核得作者版 arXiv; 出版 PDF 与 MSR 页不可达, 正文经镜像取得, 镜像非作者入口。
- STOC 2015 `[DFH+14]` 未读; 与 Thresholdout/SparseValidate 的保证边界不得合并。
- 已读章节未直接研究Pod的分布变化、多次模型重试或长周期任务, 也不给Pod分区比例、查看次数或置信阈值。

## 会话记录

- 模型按主会话实际调用登记为 `opencode-go/deepseek-v4.1-flash`, effort `max`, agent `/root/adaptive_evidence`; 原生协作工具, 不是DSH Delegate。
- 数值session_id、token与主动工时未提供, 记未知; 派发约19:56, 20:25终交, 墙钟约29分钟。初稿自记19:54起点未采用。无重新派发, 有提交前条件澄清、篇幅重排及主会话语义纠正, 不能记作零返修通过。
- 代理报告21条英文直引去空白标点匹配均命中; 这不验证数学记号。主会话查看PMLR PDF第4页, 纠正漏绝对值后的单侧界误读, 并补核A5 fresh holdout原句、修正A4的失效类型。原始返回声明留在会话记录, 本件为验收校正版。
- 工具边界: 只写本文件与 `/tmp/` 下工作件(证据目录、抽取文本与复核/重排脚本); 未动 `.tmp/`、`~/.dsh`、部署与真实配置; 未跑论文代码、模型实验或安装依赖; 未提交或暂存; 并行改动(票面、地图、成本补核件)未触碰。
- Pod 迁移与票状态不由本包裁定。
