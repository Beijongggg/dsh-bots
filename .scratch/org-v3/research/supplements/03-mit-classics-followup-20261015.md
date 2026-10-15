# 补核：MIT Curhan 目录复核与 §1.8 双元性条文（第六批修订）

所属票：[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)。
派发与验收规则见[研究补核与委派](../../research-handoff.md)；基线 `85c0894119d8ea511609395e78910d382a309b99`。
范围：父会话取得的两个 MIT 目录清单与两份扫描 PDF；只核 Tushman & O'Reilly 1996 的双元性机制与作者限定，
Astley & Van de Ven 1983 仅在出现原三位（Burns & Stalker、Lawrence & Lorsch、Thompson）可定位转述时收录。
本件为原 42 行交件的修订，不另开文件；总主张 1 条（上限 3 条）。
原始缓存根为 `/tmp/wayfinder-03-systems-20261015/`；下表文件名对应其中副本。

## 新增材料（父会话抓取，真实时刻见 `official-pdf-followup-log.json`）

| 材料 | URL | SHA-256 | 本包实读层级 |
|---|---|---|---|
| `mit-tushman-oreilly-1996.pdf` | `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Organizational_Learning_and_Change/Tushman_&_OReilly_1996_Ambidextrous_Organizations.pdf`（HTTP 200，2026-10-15T11:02:40Z） | `95ba17ed692f164dc37d1a803b37b532da36f300a9a86aadc29269cdad19fd1a`（本地复核一致） | 23 页扫描件；子代理读刊页 8-19，主会话另读 24-28；物理页为刊页减 7 |
| `mit-astley-vandeven-1983.pdf` | `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/OB_Introduction_Overview/Astley_&_VandeVen_1983_Central_perspectives.pdf`（HTTP 200，同上） | `f850922742ce962736e9cb588b1ec2c14259a6b936bf3acc490ffe5aa56bdefb`（本地复核一致） | 仅封面页（PDF p.1）视读；其余 28 页未读 |
| `mit-OB_Introduction_Overview.html` | `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/OB_Introduction_Overview/` | `9873788c1b096b6bea0a4a1e1cb0971148d922059286fa6d69e0798a86668e50` | 目录列表全文读 |
| `mit-Organizational_Learning_and_Change.html` | `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Organizational_Learning_and_Change/` | `0c968e7fad53ec3c35befd180d14dd508d6e573d8534aaa2036f677ab8794b62` | 目录列表全文读 |

## 目录复核结论

- OB 目录可见 8 项：Astley & VandeVen 1983、Hackman、Heath & Sitkin、O'Reilly 1991、O'Reilly（OB 去向）、Porter 1996、Staw 1984、Staw（outcome variables）。
- OC 目录可见 16 项，含 Tushman & O'Reilly 1996；其余为 Argyris、Beer、Carroll 等、Edmondson 1999、Edmondson 等、Hackman & Oldham 1980、Kotter 1995、Levitt & March、Lewin、OrganizationalLearningChp6、Orlikowski 1996、Robertson 等 1993、Senge、Ven de Ven & Poole、Weick & Quinn 1999。
- 两目录均无 Burns & Stalker、Lawrence & Lorsch、Thompson 的直接文件；原三位在本包无新入口。

## 主张 1：Tushman & O'Reilly 1996 的双元性命题与作者限定

| 字段 | 内容 |
|---|---|
| 主张与用途 | 报告 §1.8 双元性核心命题取得扫描原文支持；子代理仅读 pp.8-19，主会话续核 pp.24-28 的组织机制与作者限定，不能称全篇逐页读完 |
| 来源定位 | 上表 Tushman & O'Reilly 1996（*California Management Review* 38(4):8-30）；子代理页图在 `/tmp/wayfinder-03-mit-classics-20261015/pages-t/`，主会话页图在原始缓存的 `acceptance-pages/mit-tushman-oreilly-1996-17.png` 至 `-21.png` |
| 最短摘录 | p.8：`must be ambidextrous`、`both incremental and revolutionary change`；p.11：`simultaneously preparing for the inevitable revolutions`；结构机制见下节主会话验收 |
| 证据结论 | 支持同时实行增量与革命式变革的命题，并取得自治单元、共同文化与高层整合的案例论述。子代理首交未核结构机制，主会话随后补核；案例论述不作普遍收益或必要充分条件证明。本包不引实验数字 |
| 作者边界 | 条件依赖，p.15：`If an environment is stable and changes only gradually ... it is possible for an organization to evolve slowly through continuous incremental change.`；成功综合征，p.17：`firms that have been successful may suffer from life-threatening inertia`；结构／文化惯性分节（pp.18-19）；例证为 RCA、Seiko、Apple、GenRad、IBM 等叙述性案例，非系统样本 |

## Astley & Van de Ven 1983：未收集（不填）

| 字段 | 内容 |
|---|---|
| 主张与用途 | 需原三位（Burns & Stalker／Lawrence & Lorsch／Thompson）的可定位转述才收录；本包未取得，不填 |
| 来源定位 | 仅封面页视读（*Administrative Science Quarterly* 28(1983):245-273）；摘要只述四种视角（system-structural、strategic choice、natural selection、collective-action）与六大争论，未见三位姓名或具体转述 |
| 证据结论 | 实读页内未见具体转述；其余 28 页为扫描图像，本进程无 OCR（Linux 无 tesseract；Windows tesseract 经 WSL interop 被沙箱拒绝），未在子阶段时限内读完；不作全覆盖否定，只记未收集 |
| 作者边界 | 不适用（未形成内容主张） |

## 失败路径与限制（续录）

- 打包进程网络仍被沙箱拒绝（代理与直连 socket `Operation not permitted`、DNS 拒绝）；目录与 PDF 均由父会话网络侧取得；本包未自行联网、未提供 `sandbox_permissions`。
- 两份 PDF 均无文本层；本包以 150 dpi PNG 图像视读取证，引文页码为刊页；未安装依赖、未绕访问限制。
- Windows tesseract 尝试记录：`UtilBindVsockAnyPort:309: socket failed 1`（interop 需 socket，被沙箱拒绝）。
- 未完成：Tushman & O'Reilly 1996 pp.20-23、29-30；Astley 其余 28 页。渲染出页图不等于已读。

## 主会话验收与扩展读取

- 两份 PDF 的 SHA 已独立复算。主会话回读刊页 8、12、15、17，以及 24-28；其余已读范围沿用子代理记录，不报全篇验收。
- p.24 将同时创新的组织方式写为在同一企业容纳 `multiple contradictory structures, processes, and cultures`；p.25 的案例保留小型自治单元和规模／范围收益，不把总部等同于逐项集中控制。
- pp.26-27 用责任、信息共享、财务控制和共同文化维持整合，同时容许不同亚文化；共同愿景、领导与高管团队强化共同价值，管理不同策略和结构间的张力。
- p.26 也记 J&J 部分医院供应业务因服务协调而收回一些自治，不能归纳成越分权越好。p.28 明列主动变革的风险、内部争执及不确定利润。
- 验收只支持上述机制和条件，不支持未定位的「冗余资源是双元性必要条件」，也不代证 Duncan 1976、1985 原作或 2013 综述。没有 agent 选形或切换实验。
- 本轮由主会话代取、子代理读图，之后另作主会话回读与语义限定；验收工时和 token 未计量，不报零返修或净节省。

## 原关闭项覆盖

| 原关闭项 | 本件范围 |
|---|---|
| 每条机制与作者边界 | 双元性指定原页的组织机制与条件已核；Astley 只读首页，不填原三位的内容缺口 |
| 四路计数、至少三条警告与借用 | 既有最低计数及警告不变，未新增 LLM 借用样本；企业案例的 agent 迁移只作推断，整票按 S4 验收 |

## 工作记录

- 子阶段起止：2026-10-15 19:02:40 +0800（材料落地）至 19:11 +0800（本修订落盘）；实读 19:03-19:10 +0800。
- 模型标识未知；session_id `01a13ecc-ac44-7323-97a0-a92f877ab9d1`；原生协作子代理，非 DSH Delegate；未调用本机 DSH；无嵌套委派。
- token 用量未计量；不报净节省；无实验、无依赖安装、无论文代码。
- 写面：仅本件与 `/tmp/wayfinder-03-mit-classics-20261015/`（渲染页、文本抽取、目录清单引用）；未改报告、旧补件、handoff、票、地图、Git 或运行面。
