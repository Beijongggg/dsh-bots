# 03 coordination gaps：ADOPT 2005 正文补核（2026-10-13）

- 范围：仅补 org-v3 理论票协调路的 Modi / Shen / Tambe / Yokoo 2005（ADOPT）正文缺口；Hearsay 及其他论文见 03-coordination-sources-20261013.md，本件不重复。
- 基线 a8967ce118c9becfad132159ae50f9a86ba11397；本件为独立新增，未改原报告、旧补核件、票或 map，未 git stage/commit。

## 入口、来源与读取层级

- 入口 1（大学侧，失败）：USC Teamcore（Tambe 实验室）http://teamcore.usc.edu/papers/2005/adopt.pdf。经本机代理出现 TLS EOF 与 HTTP 502，直连 20 秒超时；未处理挑战、未绕访问限制。
- 入口 2（作者自存，成功）：https://arxiv.org/pdf/1602.06347（arXiv:1602.06347v4，2018-01-11），Fioretto / Pontelli / Yeoh，《Distributed Constraint Optimization Problems and Applications: A Survey》；刊于 JAIR 61:623-698，DOI 10.1613/jair.5565（Crossref 核验）。
- 读取层级：入口 2 为权威二手全文加 Table 4 视觉核对；AIJ 161(1-2):149-180 原作正文仍未读（经典未读）。综述 p.73 著录原作："ADOPT: Asynchronous distributed constraint optimization with quality guarantees. Artificial Intelligence, 161(1-2), 149-180."
- 元数据旁证：OpenAlex 与 Semantic Scholar 对该 DOI 只给出 ScienceDirect bronze PDF，any_repository_has_fulltext=false；ScienceDirect、CiteSeerX doi10.1.1.135.7450、Wayback CDX 未重试。

## 待核主张（层级＝权威二手，页码为 arXiv v4 PDF 页）

| 主张 | 转述原句与定位 | 边界 |
| --- | --- | --- |
| 核心机制 | "ADOPT ... is a complete, asynchronous, search-based algorithm. It can be considered as a distributed version of a memory-bounded best-first search algorithm. It makes use of a DFS pseudo-tree ordering of the agents."（p.16, §4.3.4） | 综述 characterization；原作定义与伪码未读 |
| 搜索与消息 | "They use COST messages (propagated upwards in the DFS pseudo-tree) and THRESHOLD and VALUE messages (propagated downwards in the pseudo-tree) to iteratively tighten the lower and upper bounds, until the lower bound of the minimum cost solution is equal to its upper bound."（p.16, §4.3.4） | 同上 |
| 质量保证对象 | Table 4 将 ADOPT 标为 Optimal ✓ 与 Error Bound ✓；"ADOPT agents store lower bounds as thresholds, which can be used to prune partial assignments that are provably sub-optimal."（p.16）；p.23, §4.4 以 "If the solution quality guarantee is not required" 与 Max-Sum/MGM/DSA 相对 | 转述者与定位已明；原作定理、误差界定义与条件未读，不改成 Pod 常量 |
| 图与目标前提 | DCOP agents "control variables and constraints, and need to coordinate the value assignment for the variables they control so as to optimize a global objective function"（p.7, §2.4）；异步性 "agents ... update the assignment ... based solely on their local view of the problem"（p.13, §4.3.2，引用含 Modi et al., 2005） | DCOP 通用模型，非 ADOPT 独有 |
| 通信前提 | "ADOPT agents communicate exclusively with their neighboring agents."（p.16）；"if the application does not permit agents to communicate directly to non-neighbors ... one is restricted to use ADOPT or one of its variants."（p.22, §4.4） | 综述表述；原作通信模型假设未读 |
| 作者保证的限制 | "It is also not an anytime algorithm as it is a best-first search algorithm."；O(d^n) 复杂度、每 agent 内存 O(n+ld)、消息数 O(d^n)、消息大小 O(n)（p.16 与 Table 4, p.13）；p.22 记搜索式算法有冗余通信，Gershman et al. 2009 中 AFB 优于 ADOPT 和 SyncBB，BnB-ADOPT / NCBB 显著优于 ADOPT | AFB 比较为综述二次转述；AIJ 原文的完成时间界与实际成本未报告，不写零 |

## 原关闭项覆盖

| 原关闭项 | 本件状态 |
| --- | --- |
| 协调路清单 C4：ADOPT 正文未核 | 仍非直读；核验方式推进到权威二手，给出转述者、原句、页码与原作引用 |
| 关闭判据①四路各至少五条一手出处 | ADOPT 条未新增直读一手；按判据允许的权威二手可标注核验方式，关票仍由主会话 |
| 关闭判据②边界条件 | 给出综述所述边界（非 anytime、仅邻居通信、规模代价）；原作自述边界未核 |

## 剩余缺口

- AIJ 161(1-2):149-180 原文未读：定理编号与形式、精确假设、完成时间与消息量上界的原始表述均未核。
- 综述数字（O(d^n)、O(n+ld) 等）为二手转述，未与原作逐条对照，不算已复核。
- 未运行算法或实验，未独立复现；"完成时间界/实际成本未报告"不是 0。

## 缓存（均位于新建 /tmp/org-v3-adopt-20261013/）

- /tmp/org-v3-adopt-20261013/fioretto-survey.pdf，717328 B，sha256 57c6177a921ba14dafce9263cf01231afc74bc9628315188f2b3617a0169c198
- /tmp/org-v3-adopt-20261013/survey.txt，282159 B，sha256 217d94b7c23bba3a2429b31aff67a152d192eb93907d5a2ef1015c7c1d691a83
- /tmp/org-v3-adopt-20261013/table4-p13-13.png，306172 B，sha256 4ab0b1d71e1f0c1fd82500d69b02342b0ca2c356b2a13186aef9a3971debad84
- /tmp/org-v3-adopt-20261013/survey-p1.txt，2511 B，sha256 6f5ca2c7b21b247fb414b66d998f9b2f154612781f6e1386952493b3e2a5bafc
- /tmp/org-v3-adopt-20261013/oa-adopt.json sha256 ed19932cdcf559c8af1050ce8933eadd5218699964f6ea5f89b5553b5948e73b；s2-adopt.json sha256 d92ed98b99effe38e45ab9fdf8c00d87e4d51d0d0f077e9eca076f08343e2cab；xref-survey.json sha256 03c001f9019b088ef60512660e2d0125902f1e13aa43b17667bc6ba36b9db777；xref-direct.json 与 xref-proxy.json 内容一致，sha256 1a1c573c35e61e429dcf8b1b550c4059ec958362391c1baa8a550123a9932478
- 失败空件：tc-adopt.pdf、tc-pubs.html（各 0 B，502 或超时）；DuckDuckGo HTML 检索经代理 CONNECT 502，未落文件

## 执行记录

- 实际起止：2026-10-13 21:54:35 至 22:01（+08:00）；首次落盘 22:00。
- 模型：原生子代理 `opencode-go/deepseek-v4.1-flash/max`；session / token 与主会话主动验收工时：未知。
- 未调用本机 DSH，未安装依赖，未后台下载，未写 ~/.dsh、部署或配置，仓库内只写本文件。
