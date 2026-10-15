# 03 FA/C 作者入口跟进：Lesser/Corkill（2026-10-15）

所属票：[组织理论、复杂系统与控制论](../../issues/03-research-organization-theory-and-concepts.md)；派发与验收规则见[研究补核与委派](../../research-handoff.md)。本件先登记入口，再补一条 FA/C 机制及作者边界，不改已交的[协调续核](03-coordination-commitment-autonomy-20261015.md)或报告。

- 角色与工具：父会话原生子代理，无嵌套；按派单本轮**未尝试任何联网、授权或绕路**（子代理 socket 不可用），只读父会话已落的本地索引缓存。
- 起止：2026-10-15 19:02:53 至 19:05:30，加第二轮 19:06:14 至 19:11（+08:00）；提取阶段合计约 8 分钟，10 分钟硬界（19:12:53）内；索引 URL 曾经一次定向纠正，正文另有主会话返修，见末节。
- 基线 commit `85c0894119d8ea511609395e78910d382a309b99`；仓库唯一写面为本件；缓存只读 `/tmp/wayfinder-03-systems-20261015/`；未触其他文件、Git、票、DSH 或运行面。

## 本地来源与快照

| 来源 | 原页与状态 | 实读层级 | 快照与 SHA-256 |
|---|---|---|---|
| UMass MAS 官方根 | `https://mas.cs.umass.edu/`；父会话记录 HTTP 200 | 仅定位出版物入口；正文未读 | `/tmp/wayfinder-03-systems-20261015/umass-mas-root.html`，15080 B；`41f1e768ba548d4cab2a6395d7a3eb39be41f32ef14f93b8d6dcb8eb19df4ee9` |
| UMass MASL 出版物索引 | `https://mas.cs.umass.edu/pub`；父会话已取，本子代理回读缓存 | 官方索引页（检索表单）读取，条目正文零覆盖 | `/tmp/wayfinder-03-systems-20261015/umass-mas-pub.html`，12774 B；`70c1d28105b3de369dd1a44fa312ef7e53fc73a289b1282eb2c5f12d0e2bbc52` |
| MASL 1981 年列表 | `https://mas.cs.umass.edu/pub/year.html/1981`；HTTP 200（父会话 `radner-umass-target-fetch-log.json`，11:06:03Z） | 该年列表读取；Lesser/Corkill 条目行与其链接已核，目标页未取 | `umass-1981.html`，8428 B；`b5e3535dd70f874db3992804d1761d062242e6ae30fa6988355fb978b6de340d` |
| MASL 1991 年列表 | `https://mas.cs.umass.edu/pub/year.html/1991`；HTTP 200（同上日志） | 该年列表读取；1991 回顾条目行、链接与扩展版 .ps 链接已核 | `umass-1991.html`，12034 B；`717d1ab58eaf571f146eeb495e03f5fd14781ecf499ac82abe908cf555dad7d4` |
| 作者出版物列表 | `https://mas.cs.umass.edu/pub/lesserpubs.html`；HTTP 200（同上日志） | 1981（第 1246-1252 行）与 1991（第 740-742 行）两条书目已核；无正文 | `umass-lesserpubs.html`，66693 B；`b8f51cb1087e54e41e16d68f19d732f46ff043c2ad856cdd154854ebe0daab89` |
| Lesser/Corkill 1981 正文 | `https://mas.cs.umass.edu/Documents/smc-fac.pdf`；HTTP 200，父会话代取（`fac-pdf-fetch-log.json`，11:09:04Z） | 题名/出处页、摘要、§II 的自分页 5 及范式边界自分页 12 已读；实际 41 页重排副本，非全篇逐句核验 | `lesser-corkill-fac-1981.pdf`，165304 B；`05305eb80d0bd27552ed68363d33a9e415d24b5bba0b01ab54ce8edfe845933e` |
| Lesser 1991 回顾 | `https://mas.cs.umass.edu/Documents/lesser/IEEE91_retro.pdf`；HTTP 200，父会话代取（同上日志） | 16 页扫描件无文本层（`pdftotext` 仅得 16 B），本包未从中取任何内容 | `lesser-fac-retro-1991.pdf`，1771413 B；`74008e61a42febc009b36c715973cdc46e71930c05ac46e98c159fcbdebb01e8` |

## F1（入口条目，内容未核）：官方索引是 Lesser/Corkill 1981 正文与 1991 回顾的新一手入口

- 来源定位：`https://mas.cs.umass.edu/pub`，UMass MASL 组出版物索引；根页正文行 "Publications" 指向 `/pub`（root 缓存第 215 行）。
- 索引页原句（最短摘录）："Some older publications may not be available online, but references to those documents may be found here."（指 `lesserpubs.html`）；"Search terms are ANDed together, and you may click on the publication's name in the search results to obtain further information about the document."
- 相对链接基准更正：`/pub` 无 `base` 标签且实际重定向到 `https://mas.cs.umass.edu/pub/`，相对路径的基准是该目录，不是站点根。父会话取回日志确证的 URL 为 `/pub/year.html/1981`、`/pub/year.html/1991`、`/pub/lesserpubs.html`；本件上一轮按根推导的四个链接作废，正确形式见下。
- 新官方索引中核到的直链（初次登记仅核链接，随后主会话已取目标及 PDF，正文范围见 F2）：
  1. `http://mas.cs.umass.edu/paper/219`：1981 年列表第 233 行的 Lesser/Corkill "Functionally Accurate, Cooperative Distributed Systems" 条目链接。
  2. `http://mas.cs.umass.edu/paper/258`：1991 年列表第 232 行的 "A Retrospective View of FA/C Distributed Problem Solving" 条目链接。
  3. `http://mas.cs.umass.edu/Documents/Lesser-retro91.ps`：同行的扩展版 PostScript 直链（"An extended version of this paper is available here."）。
- 更正后的检索入口（供主会话取回）：`https://mas.cs.umass.edu/pub/search.html?search=true&author=Lesser&year=1981`、`.../year=1991`；表单字段 author、title、year、keywords[]，关键词选项含 `FA/C` 与 `Distributed Problem Solving`。
- 书目行（原页短句，1981 年列表）："Lesser, Victor; Corkill, Daniel.. Functionally Accurate, Cooperative Distributed Systems. IEEE Trans. on Systems, Man, and Cybernetics, Volume SMC-11, Number 1, pp. 81-96. 1981."
- 书目行（1991 年列表）："Lesser, Victor. A Retrospective View of FA/C Distributed Problem Solving. IEEE Transactions on Systems, Man, and Cybernetics, Volume 21, Number 6, pp. 1347-1363. 1991."
- 作者列表补充（`lesserpubs.html` 第 1246-1252 行）：1981 文为该刊特刊版本，且是 1979 年 Denver 会议同名论文的扩展版（pp. 346-353），另收于 Bond & Gasser 编 *Readings in Distributed Artificial Intelligence*。1991 行在作者列表中记 `21(6):1347-1362`，与年列表的 `1347-1363` 不一致，两个原始页面并列保留，未裁决。
- 已知失败入口：`https://mas.cs.umass.edu/publications` 返回 404（父会话 `author-index-fetch-log.json`，time_utc 2026-10-15T10:53:56Z），不要再走该路径。
- 初次入口阶段未核任何机制；主会话随后取回 `paper/219`、`paper/258`、两份 PDF 及扩展版 PS。1981 已核范围见 F2，1991 PDF 和 PS 不贡献本包内容证据；不再把旧“尚未取件”描述为当前状态。
- 量化附项：不适用。

## F2（1981 原文，1 条主张）：FA/C 放宽中间结果正确性，但迭代细化不保证全局一致

- 主张（机制）：FA/C 允许节点先产出不完整、错误或互相矛盾的暂定结果，再交换与修正。自分页 5 的短句为 "a node produces tentative results that may be incomplete, incorrect, or inconsistent"；functionally accurate 指可接受的系统输入/输出行为，不要求所有中间结果正确一致。原文只说这种通信量更低是一种希望，不是普遍成本保证。
- 作者边界（同一副本自分页 12）：作者评述所借用的迭代细化范式，"iterative refinement does not guarantee a consistent global solution, only a set of consistent local solutions"；该段说同步或显式排序用于加速，且只在受限情形保证收敛。这不是对所有 FA/C 算法都不可能全局一致的定理。
- 读取层级与限制：41 页重排副本的指定段落已核；未逐句通读全篇，未核对刊本 SMC-11(1):81-96 的分页，未运行或复现任何实验。1991 回顾为扫描件，本件不引用其内容，也不以它代证 1981。

## 原关闭项覆盖

| 原关闭项 | 本件覆盖 | 核验层级 |
|---|---|---|
| 协调路 Lesser & Corkill 1981 正文缺口 | 官方来源取得 1981 正文副本，覆盖 FA/C 机制 1 条与作者边界 1 处；1991 回顾未读 | 1981 指定段落已读（非全篇） |
| ②边界条件 | 自分页 12 对所借迭代细化范式的全局一致性和收敛限定；1991 回顾未覆盖 | 已核（指定段落） |

## 执行记录

- 三轮均未尝试联网或授权；PDF 由主会话代取，本子代理只读本地件；无依赖、无测试、无模型实验；session_id、token 未知；主会话代取与验收工时不计入本件。
- 第三轮起止 19:10:58 → 19:12（+08:00）。
- 主会话复算两份 PDF 的 SHA 并回读 1981 自分页 1/5/12，纠正“6 页”“p.2/p.13”误记，限定该一致性结论属于所评述范式。主动验收工时与 token 未计量，无重新派发；索引相对 URL 另经过一次定向纠正。
