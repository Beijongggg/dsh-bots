# 03 组织路径余项: Simon 1962 与 Ostrom 2009 原文提取（有界包）

[组织理论、复杂系统与控制论（纯理念面）](../../issues/03-research-organization-theory-and-concepts.md) 工作包的续包, 范围只含原清单分路续派的组织路径两来源: Simon 1962 "The Architecture of Complexity" 与 Ostrom 2009 诺贝尔演讲 "Beyond Markets and States"。只做原文提取, 不含理论迁移与设计裁定; 未取得来源记未核, 不写成不存在。 基线 commit `a8967ce118c9becfad132159ae50f9a86ba11397`。采集 2026-10-13。
## 来源与缓存
| 来源 | 入口与版本 | 实读层级 | 缓存与 SHA-256 |
|---|---|---|---|
| Simon 1962 | Proc. APS 106(6):467-482; Iowa State 课程镜像 `faculty.sites.iastate.edu/tesfatsi/archive/tesfatsi/ArchitectureOfComplexity.HSimon1962.pdf` | 150dpi 页图直读: 书页 468, 470, 471, 473, 474, 475（=PDF 3, 5, 6, 8, 9, 10）; 477/478 已渲染未读; 482 未渲染 | `/tmp/ds-org-03-20261013/simon1962.pdf` `cad628f8f6773fb46efdf782838c68e23923e174210b332e77d21f273cb8c70d`; `simon.txt` `fc3eea714597abe2d8ce13435cb7adfd0b7041910a7882a0eced525839929633`; 页图 `s-468-03.png` `aa0774f1...f49a3a1`, `s-470-05.png` `a1b9bc0b...bf1deb4`, `s-471-06.png` `8f69c3d5...91ac0e7`, `s-473-08.png` `1627a3b6...9763609`, `s-474-09.png` `5aa83717...789447`, `s-475-10.png` `c46458da...8241747d`, `s-477-12.png` `865ab5a3...367d102`, `s-478-13.png` `9005be0c...ea6536` |
| Ostrom 2009 | Nobel lecture, 2009-12-08 讲座; `nobelprize.org/uploads/2018/06/ostrom_lecture.pdf`; 书页=PDF 页+407 | 全文文本层精读（born-digital InDesign, 文本精确） | `/tmp/ds-org-03-20261013/ostrom2010.pdf` `5d11eb59b78e94bef479e66216078231dc803aa9bedd907314a96aba0e53c5f1`; `ostrom.txt` `0ad22f6e666de6bb747deffe3d93fc66941ec8f027cbaaf6da233d485cf70c14` |

版本注: 诺奖讲座正文书页 408-435, 含参考文献的 PDF 为 408-444, 共 37 页; 同文另刊 AER 2010 100(3):641-672, DOI 10.1257/aer.100.3.641, 分页不同（AEA 官方 PDF 本窗口未取得, 返回 HTML）。本包 页码均为诺奖讲座版。Simon 页图全部位于 `/tmp/ds-org-03-20261013/pgs/`, 表内列的是文件名。
## S1 Simon: 层级定义与中心命题
主张 S1（原报告层级/层级系统条; 消费面: 主会话对"层级"的裁定）。定位: 书页 468 页图核读。
- "By a hierarchic system, or hierarchy, I mean a system that is composed of interrelated subsystems, each of the latter being, in turn, hierarchic in structure until we reach some lowest level of elementary subsystem."
- "Thus, the central theme that runs through my remarks is that complexity frequently takes the form of hierarchy, and that hierarchic systems have some common properties that are independent of their specific content."
- 同页边界句: "In fact, even in human organizations, the formal hierarchy exists only on paper; the real flesh-and-blood organization has many inter-part relations other than the lines of formal authority."

量化附项: 不适用。结论: "frequently takes the form" 是频率观察, 不是层级必然性 定理; 边界句对"正式层级=真实结构"的等式是作者本人否证。
## S2 Simon: 制表匠寓言与约 4,000 倍演示数字
主张 S2（原报告"模块化加速组装"引用点）。定位: 书页 470 与 471 页图核读。
- 1,000 部件; 单件组装中断概率 p, 演示取 p=.01; 整体一次装成概率 `(1-p)^1000`, 每 10 件一组 `(1-p)^10`;
- "it will take Tempus, on the average, about four thousand times as long to assemble a watch as Hora";
- 比值链条: `1/111 × 100/5 × .99^10/.99^1000 = 1/111 × 20 × 20,000 ~ 4,000`。

作者自限（书页 471）:
- "These assumptions are not particularly realistic."
- "Although we cannot, therefore, take the numerical estimate seriously the lesson for biological evolution is quite clear and direct."
- "The time required for the evolution of a complex form from simple elements depends critically on the numbers and distribution of potential intermediate stable forms."
- "with more illustrative than literal intent"。

量化附项: 约 4,000 倍为作者自述演示模型的输出, 非测量值; 引用须附自限句。 结论: 数字可作方向示意, 不得当证据强度、工程常数或实测比值。
## S3 Simon: 稳定中间形态与演化速度
主张 S3。定位: 书页 473 页图核读。
- "complex systems will evolve from simple systems much more rapidly if there are stable intermediate forms than if there are not. The resulting complex forms in the former case will be hierarchic."

量化附项: 不适用。结论: 与 S2 同源（演化论证, 无量化）; 陈述为比较级倾向规律。
## S4 Simon: 近可分解系统与 epsilon 边界
主张 S4（原报告"近可分解/模块独立性"引用点）。定位: 书页 474, 475 页图核读。
- 书页 474: "(a) in a nearly decomposable system, the short-run behavior of each of the component subsystems is approximately independent of the short-run behavior of the other components; (b) in the long run, the behavior of any one of the components depends in only an aggregate way on the behavior of the other components."
- 书页 475 epsilon 边界: "the matrices that have this property will describe very special dynamic systems-vanishingly few systems out of all those that are thinkable... If we demand that epsilon be very small, correspondingly few dynamic systems will fit the definition." 紧随反面补句: 自然中此类系统 "far from rare"。

量化附项: 不适用（epsilon 为定义参数, 非测量）。结论: short-run/long-run 二分 是定义性陈述; epsilon 严格度与现实频率存在张力, 引用时两边并存。
## S5 Simon: 仅文本层条目（未页图核, 记未核）
位置: 书页 477, 478（已渲染未读）与 482（未渲染）。状态: 仅 PDF 文本层, OCR 有错（"olvn"/"cominents"/"reinarks"/"decon~posed"/"\vork"/"IVe" 等）, 引用前须页图核。
- 书页 477: "Intra-component linkages are generally stronger than intercomponent linkages."
- 书页 478: "empty world hypothesis"。
- 书页 482: "one path to the construction of a nontrivial theory of complex systems is by way of a theory of hierarchy."

结论: 记未核, 不作为已核内容消费; 对照 `simon.txt` 的包含性检查会在上述 OCR 错字处失败, 属文本层工件, 不属页图差异。
## O1 Ostrom: 多中心与配置式分析
主张 O1（原报告多中心/治理引用点）。定位: 书页 409 文本层精读。
- "Due to the complexity of broader field settings, one needs to develop more configural approaches to the study of factors that enhance or detract from the emergence and robustness of self-organized efforts within multilevel, polycentric systems."
- "'One-size-fits-all' policies are not effective."

量化附项: 不适用。结论: 配置式（configural）分析是方法论主张, 非量化结果。
## O2 Ostrom: "polycentric" 定义（转引 1961）
立场 O2。定位: 书页 411; Ostrom 转引 V. Ostrom, Tiebout, Warren 1961: 831-32:
- "'Polycentric' connotes many centers of decision making that are formally independent of each other. Whether they actually function independently, or instead constitute an interdependent system of relations, is an empirical question in particular cases."

结论: 独立性 vs 相互依赖是经验问题, 定义不预设结果; 引用须标注转引来源 （1961 原文本窗口未取）。
## O3 Ostrom: design principles 的定位与措辞修正
主张 O3。定位: 书页 422。
- "I used the term 'design principle' to characterize these regularities. I did not mean that the fishers, irrigators, pastoralists, and others overtly had these principles in their minds..."
- 脚注 5: "The term 'design principle' has confused many readers. Perhaps I should have used the term 'best practices'..."
- "The design principles appear to synthesize core factors that affect the probability of long-term survival of an institution developed by the users of a resource."
- 8 条更新清单（1A User Boundaries ... 8 Nested Enterprises）由 Ostrom 归属 Cox/Arnold/Villamayor-Tomás (2009)。

结论: principles 不是行动者的心智内容; 所载 8 条清单是 2009 年他人评审的版本, 由 Ostrom 转述。
## O4 Ostrom: 二级统计与后续评审边界
主张 O4。定位: 书页 422-423。
- "Cox, Arnold, and Villamayor-Tomás (2009) analyzed over 100 studies..."
- "Two-thirds of these studies confirm that robust resource systems are characterized by most of the design principles and that failures are not."
- 书页 423: 部分研究把原则解释 "very rigidly"; 三条原则初始表述 "too general"。

量化附项: 100 余项研究的二次评审统计（约三分之二确认）, 为 Ostrom 对他人评审 的转述, 不是她的原始数据集。结论: 引用须标"二级转述"; 原则的严格适用性与初始 表述由 Ostrom 本人打了限制。
## 原关闭项覆盖表
| 原报告相关引用点 | 本包结论 |
|---|---|
| 制表匠约 4,000 倍 | 作者自述演示数字, 附书页 471 自限句; 不得作测量值 |
| "complexity is not the same as chaos"（早前交接候选引语） | 本窗口未在 Ostrom 全文与 Simon 已读页检出, 记未确认, 不采用 |
| design principles 8 条清单 | 归属 Cox/Arnold/Villamayor-Tomás 2009（Ostrom 转述）; Ostrom 自荐 "best practices" 措辞 |
| 近可分解定义 | 书页 474 定义 + 475 epsilon 边界与 "far from rare" 反面补句, 两边并存 |
| 其余组织路径来源（Baldwin & Clark, Langlois, Tushman & Romanelli, Williamson, Marschak & Radner, Burns & Stalker, Lawrence & Lorsch, Thompson, matrix 病理源, Wegner 1987 章节, TMS） | 本窗口未采集, 未核; 无搜索运行, 不作有界空结论 |
## 剩余缺口
- 上表末行所列来源本窗口未取得: 记未核验, 不写"不存在"。
- S5 三处仅文本层; 书页 477/478 页图未读, 482 未渲染。
- 西蒙 1962 引文以页图为准（文本层 OCR 错字已录）; 所有引文为直引, 未改写。
## 会话记录
- 起止: 2026-10-13 21:30:37 -> 21:46（本文件落盘时刻）; 硬界约 21:50:37。
- 模型: opencode-go/deepseek-v4.1-flash/max（原生协作子代理, 非 DSH Delegate）。
- 工具: curl, pdftotext, pdftoppm, 页图直读; 缓存 `/tmp/ds-org-03-20261013/`。
- 最终仓库交付为本文件; 另将已确认归因的 `sa1.html` 移回临时目录。初稿 150 行超出派发 110 行上限, 主会话整合时压缩换行并修正页图路径与讲座总页数; 无 commit/staging, 无运行面写入。
- 归因: 仓库根 `sa1.html`（4428B, mtime 21:21:52）为本批控制路径检索所留: curl 相对 `-o sa1.html` 未先 cd /tmp, 落在仓库根 cwd; 内容为 scholar.archive.org 查询返回的 Archive-It 会话校验挑战页, 无可用内容。已移至 `/tmp/cyb-03-20261013/sa1.html`（ctime 21:40:18; SHA-256 `22fb6ac7a6b8e526bac09b36d42eeda61dc703a63e533181765f45b580120bda`）; 仓库根已清净, 非用户文件。
