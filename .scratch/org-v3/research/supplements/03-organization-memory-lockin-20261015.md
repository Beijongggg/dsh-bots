# 补核：组织记忆与路径锁定五个经典理论源的入口与内容核验

所属票：[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)。
派发与验收规则见[研究补核与委派](../../research-handoff.md)；基线 `85c0894119d8ea511609395e78910d382a309b99`。
本包为原生子代理单会话执行，按 handoff「由该工作会话完成，不再嵌套委派」未派生子代理，未调用本机 DSH。
范围限五个既定条目（T1 至 T5），不扩理论清单、不追版本变体、不做实验、不装依赖、不写真实运行面。

结果：五条的书目与访问层级已核；五条的正文字句一条也没有取得，本包不含经典原文摘录，报告中原有
`[未经一手来源核验]` 标注全部保持。时间盒到界，按停止条件交「已核验子集 + 缺口」。

## 五条目：书目、访问层级与结论

| 条目与报告位置 | 来源与版本（作者/年/出处/DOI） | 本轮实读层级 | 证据结论 |
|---|---|---|---|
| T1 §1.7 间断平衡 | Tushman & Romanelli (1985), "Organizational Evolution: A Metamorphosis Model of Convergence and Reorientation", *Research in Organizational Behavior* 7:171-222；相邻版本 Tushman, Newman & Romanelli (1986), "Convergence and Upheaval", *California Management Review* 29(1):29-44, DOI 10.2307/41165225 | 1986 篇为元数据（OpenAlex 200）：closed、无 OA 位置；1985 章节无 DOI，搜索入口全失败（见失败表）。两文正文均未读 | 未核验；支持或反驳均无从判定。报告 §1.7 中 Gersick 1988 的已核范围不变 |
| T2 §1.8 双元性 | Tushman & O'Reilly (1996), "Ambidextrous Organizations: Managing Evolutionary and Revolutionary Change", *California Management Review* 38(4):8-30, DOI 10.2307/41165852 | 元数据（OpenAlex 200）：closed、无 OA 位置。正文未读 | 未核验；作者条件（冗余资源、高层整合等）字句仍未取得，报告 §1.8 的边界整理保持 |
| T3 §1.10 团队理论 | Radner (1962), "Team Decision Problems", *The Annals of Mathematical Statistics* 33(3):857-881, DOI 10.1214/aoms/1177704455；通行引用版 Marschak & Radner (1972) 书本轮未动 | 访问层级已核：出版商页（Wayback 快照）标注 `Full-text: Open access PDF File (2461 KB)`，引文行 `Ann. Math. Statist. 33 (1962), no. 3, 857--881`；OpenAlex 记 bronze OA。PDF 两次直取均被 Incapsula 挑战页拦截（未绕）；Wayback 只存 302，无 PDF 字节 | 未核验（正文）；新增两条可复核事实：该文确为开放获取、页码 857-881。信息结构、共同支付假设的字句仍未读 |
| T4 §1.11 TMS | Wegner (1987), "Transactive Memory: A Contemporary Analysis of the Group Mind", in Mullen & Goethals (eds.), *Theories of Group Behavior*, Springer, 185-208, DOI 10.1007/978-1-4612-4634-3_9 | 元数据（OpenAlex 200，S2 同判）：closed、无 OA。探路的两条权威二手也 closed：Ren & Argote (2011) DOI 10.5465/19416520.2011.590300；Lewis et al. (2007) DOI 10.1016/j.obhdp.2007.01.005 | 未核验；「共享历史是否必需」「流动是否必然摧毁」两条边界仍无正文或二手内容可引，§1.11 现标注不变 |
| T5 §6.4 路径依赖 | Arthur (1989), "Competing Technologies, Increasing Returns, and Lock-In by Historical Events", *The Economic Journal* 99(394):116-131, DOI 10.2307/2234208 | 元数据（OpenAlex 200）：closed、无 OA 位置；S2 `openAccessPdf.status = CLOSED`。正文未读 | 未核验；假设与边界（收益递增、非凸性等）字句未取得，§6.4 现标注不变 |

## 原关闭项覆盖表

| 原关闭项 | 本轮前缺口 | 本轮新增证据 | 结论 |
|---|---|---|---|
| §1.7 间断平衡（1985/1986 正文） | 正文未读 | 1986 篇 closed、无 OA | 缺口保留 |
| §1.8 双元性（1996 正文） | 正文未读 | 1996 篇 closed、无 OA | 缺口保留 |
| §1.10 团队理论（1972 书目与内容） | 书目未核、内容未核 | Radner 1962 的 OA 状态与页码已核；1972 书未动 | 内容缺口保留 |
| §1.11 TMS（共享历史与流动边界） | 边界未核 | 1987 章与两条权威二手均 closed | 缺口保留 |
| §6.4 路径依赖（1989 内容） | 内容未核 | 1989 篇 closed、无 OA | 缺口保留 |

## 失败入口记录（未登录、未绕挑战；时间为 2026-10-15 +0800，文件时间戳口径）

| 入口 | 请求 | 结果与缓存 |
|---|---|---|
| Project Euclid PDF | `.../1177704455.pdf`，默认 UA 18:29、Chrome UA 18:31 | 均为 200 的 Incapsula 挑战 HTML（1160/1165 B）；`radner-1962-team-decision-problems.pdf`、`radner-1962-ua.pdf` |
| Project Euclid 旧路径 | `/download/pdf_1/euclid.aoms/1177704455` 18:40 | 1050 B 挑战页；`euclid-legacy.html` |
| Wayback CDX | 上条 URL 18:42 | 3 条快照全为 302，无 PDF 字节；`cdx-radner.txt` |
| scholar.archive.org | 四标题检索 18:29 | ALTCHA「Verify - IA Scholar」人机验证页；`sch-*.html` 4 份 |
| html.duckduckgo.com | 四查询 18:34 | 连接失败（curl 000），无缓存 |
| eudml.org | Radner 检索 18:35 | 403；`eudml-radner.html` |
| mojeek.com | 四查询 18:35 | 2 次 403；2 次 200 但零结果链接；`mojeek-*.html` 4 份 |
| bing.com RSS | Arthur `filetype:pdf` 18:35 | 200，返回词典与知乎等无关结果；`bing-arthur.xml` |
| search.marginalia.nu | 三查询 18:39 至 18:40 | 200，页面无结果链接；`marg-*.html` 3 份 |
| santafe.edu（猜测号） | `media/workingpapers/88-05-044.pdf` 18:41 | 404 SPA 页面，Wayback 无快照；`sfi-88-05-044.pdf`、`wb-sfi-88-05-044.pdf` |
| unpaywall API | 五 DOI 18:31 | 422（example.com 邮箱被拒），未换邮箱重试；`up-*.json` 5 份 |
| dougb.com | 疑为 Arthur 个人站 18:35 | 实为 Douglas Beeferman 的页面，误入口，未用作来源；`dougb.html` |
| timvanzandt.net | 团队理论材料候选 18:39 | 连接失败（curl 000），未重试 |

## 缓存与 SHA-256

关键读取件均在 `/tmp/wayfinder-03-org-rest-20261015/`；完整文件清单见 `sha256-manifest.txt`，
其自身 SHA-256 为 `d6261acf0a08f76cda599644438431f039470c5f4a6a68af4e8ebc812215c70d`。

| 文件 | SHA-256 |
|---|---|
| `oa-arthur.json` | `fcedbd58f529265e96d54941be1b5a016dc1d37fba27c347f27e18d54165a728` |
| `oa-tushman96.json` | `d232eceb64c6b8cf08e88efb06d0c67906cc7c0ca3c08765c7bed6db1e1c250b` |
| `oa-tushman86.json` | `3595bb4ddaba26c08c33cb0bac80b96bbd437d2250ccecaba6f7a5853294d605` |
| `oa-wegner87.json` | `4f762fd6b91d022a451a4e4c3b055c59693b505806429ef8d0385c900a2c9abd` |
| `oa-radner62.json` | `7c7c6dfafeea140e1221997d283ad11d78bdd756b2aad6355f65c571ece000c5` |
| `s2-arthur.json` | `2cd52fe7aa3adfed29799c0af0b447c40d896104727130cb8b2da26708e7ee09` |
| `s2-wegner.json` | `3d940ea6b0d7a4e806979f8c3fcc7b2441d7a154aa454b3858477f7d97b68ae5` |
| `wb-radner.pdf`（Euclid 落地页快照，XHTML） | `8d4b70188cdfe48106b22807db8c2ce78284ad8818f4f995d8c3706452c30052` |
| `cdx-radner.txt` | `6e57982ac55a23110dbfdc7dd448c2355bbfd4bb4ffaf83811bb9169858ed0ff` |
| `sha256-manifest.txt` | `d6261acf0a08f76cda599644438431f039470c5f4a6a68af4e8ebc812215c70d` |

另有三条 TMS 相关元数据在本清单同表中：`oa-ren.json`、`oa-lewis07.json`、`oa-moreland.json`。
其中 `oa-moreland.json` 是按猜测 DOI 查询，返回的是另一篇 2000 年论文（Stasser 等），未用作 TMS 来源。

## 剩余缺口与失败归因

- 五条正文与可用二手内容都没有取得；本包对原决策问题的净新增是访问状态、书目与失败路径，不含可引正文字句。
- 硬堵点：Project Euclid 的 Incapsula、scholar.archive.org 的 ALTCHA。两者都在本轮被明确观测，换入口才有下一步。
- 未尝试入口：JSTOR、INFORMS、SAGE、Springer 的登录页（本轮未登录、未绕墙）；Wegner 章在 Springer 页面上是否只有摘要未验；1985 ROB 章节、1972 书、Arthur 个人站均无可读入口记录。
- 下一包建议只取一条：T3 Radner 1962（OA 已确认，只差可读通道），或 T4 的共享历史与流动两条边界问题。派发与否由主会话裁定。

## 工作记录

- 起止：18:21:10 至 18:42:47 +0800（文件时间戳口径）；此前 17:14:43 的一次沙箱时钟读数与后读数不一致，差因未查明。超出 20 分钟硬界后按停止条件交缺口。
- 工具：curl（提升权限，批准前缀 `curl -sL`）、jq、python3、sha256sum、file、rg。未用 pdftotext（无 PDF 正文可得）。
- 无后台下载、无依赖安装、无论文代码、无基准或模型试验；未调用本机 DSH；未读写 `~/.dsh`、部署目录或真实配置。
- 仓库写面仅本新件；未改报告、旧补件、handoff、README、CHANGELOG、票、地图与 Git。缓存全部位于 `/tmp/wayfinder-03-org-rest-20261015/`。
- session_id、token 用量、主会话核验工时未计量，保持未知；不报节省或收益。

## 后续入口说明

本件保留首轮五项零正文的历史结果。主会话随后经新入口取得 Tushman & O'Reilly 1996、Radner 1962 与 Liang 等 1995，所引内容已在[MIT 续核](03-mit-classics-followup-20261015.md)和[TMS／Radner 续核](03-tms-radner-followup-20261015.md)验收，不再把本件首轮失败当作当前仍无内容。1985/1986、Wegner 1987 与 Arthur 1989 的原缺口未因此消除。
