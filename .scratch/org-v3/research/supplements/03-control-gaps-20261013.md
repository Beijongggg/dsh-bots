# 03 控制路三缺口: Beer VSM, Varela 1974, von Foerster 二阶控制论（有界包）

[组织理论、复杂系统与控制论（纯理念面）](../../issues/03-research-organization-theory-and-concepts.md)
工作包的续包, 只补 `03-control-sources` 未核三项: Beer VSM、Varela/Maturana/
Uribe 1974、von Foerster 二阶控制论。只提主张与来源适用条件, 不含迁移与裁定;
本体/转述/摘要级分层标注, 原文未读不冒充核读。旧包失败入口不重复（archive.org
借阅 401、UChile UI Anubis 挑战、Google Books 不可用）。基线 commit
`a8967ce118c9becfad132159ae50f9a86ba11397`。采集 2026-10-13 21:50 起。

## 来源与缓存

| 来源 | 入口与版本 | 实读层级 | 缓存与 SHA-256 |
|---|---|---|---|
| Beer VSM 转述 | 英文维基百科条目 "Viable system model"; 条目引用 Beer 1972 Brain of the Firm、1979 Heart of Enterprise、1985 Diagnosing the System for Organizations（书目未核）; 取得 2026-10-13 | 百科转述（非同行评议）, 条目首段/System 5 节/小节标题级 | `/tmp/ctl-gaps-03-20261013/wiki-vsm.html` `f77f3ee5234404e1cc9f81ce23f12b33e0e50312d921fd763f10984f691e0698` |
| Varela 1974 题录与摘要 | Universidad de Chile 机构库机器接口 `repositorio.uchile.cl/rest/handle/2250/160309`（DSpace REST, 未触发反自动化门）; 条目 lastModified 2023-01-18; 库内 PDF 为 2019-01-24 FPDF 生成的 1 页题录占位（1620 B） | 摘要级（库载摘要）; 正文 pp.187-196 未取得 | `uchile-rest.json` `bf54a85999d6baddb52629f9eb10725dd95e8deca2df536219a762692a75effd`; `uchile-bitstreams.json` `1deac27b9e5f7515ffafd42321d00be5f9d0b18c028b1db2a98bf58ed819bc9a`; `varela-uchile-rest.pdf` `e7d8b6eca75a9b4ba40302b9138826c01383adf9b6bdd7827dd59c523aefd5c0`; `varela-uchile-rest.txt` `ae88490b4b07497fdee1fded98fd1552a4bf929d2d7af67d7bc11ddb30786ed2`; `varela-s2.json` `75a6e75cab0f3248199c788fbae0174b3240187313d2f4ea592eec260f5a1e79` |
| von Foerster 转述 | 英文维基百科条目 "Second-order cybernetics"; 取得 2026-10-13 | 百科转述（非同行评议） | `/tmp/ctl-gaps-03-20261013/wiki-soc.html` `ec207e9576ed2c05cb17e7d16388842c298ef5579356bb949b2439892c98c30b` |

失败入口（每条 ≤2, 记录留痕）: EPFL infoscience 记录 178660 被 Human
Verification 墙挡（`epfl-vsm.html` `c05d9a87ababf474b6979f2ce13b600fe99b11b3f6ac76becf9ddf148803e473`）;
CEPA 建构主义电子论文库作者区三个探测 URL 均为登录/导航空壳（`cepa-authors.html`
`5372d72c84b1a558c13fab449b90c5ae774bb8e93ef094d8205116afb45a65a5`, `cepa-probe.html`
`2b529d609628a6bbe04798e668af2ad40fc66887a44e794fc3966cb31cf63099`）;
Bing/DDG/Google/Mojeek 检索端点无可用结果（工具性失败, 缓存 `bing-*.xml`,
`ddg-beer.html`, `google-vf.html`, `mojeek-vf.html`）。

## B2 Beer VSM: 百科转述级最小主张

主张 B2（消费面: 主会话对 VSM 的最小事实引用）。转述方: 英文维基百科条目,
经典引用为 Beer 三书（上表; 书页均未核; 原文未读）。

- "The viable system model (VSM) is a model of the organizational structure of
  any autonomous system capable of producing itself. It is an implementation
  of viable system theory."（条目首段）
- "System 5 is concerned with balancing the 'here and now' and the 'there and
  then' to give policy directives which maintain the organization as a viable
  entity."（System 5 节）
- 条目另载 "Recursive system theorem" 小节与 System 1-5 分节（标题级, 未逐条摘录）。
- 条目自注边界: "At the biological level, this model is correspondent to
  autopoiesis."（类比关系, 非等同, 不得引申）。

量化附项: 不适用。结论: 最小主张 = VSM 为组织控制模型、含五子系统与递归结构,
证据层级为百科转述; 不升级为原文核读, 不含软件/Pod 迁移。

## V2 Varela/Maturana/Uribe 1974: 摘要级最小主张

主张 V2。新入口为机构库机器接口（REST）, 与旧包失败的 UI 路径不同, 未被
Anubis 门挡住; 但库内 ORIGINAL bitstream 实为 1 页题录占位（含全文提取文本
414 B 同内容）, 论文正文未取得。DOI 10.1016/0303-2647(74)90031-8; Semantic
Scholar 记唯一 green OA 位置即该库。

- 库载摘要（题录页, © 1974）: "We formulate the organization of living
  organisms through the characterization of the class of autopoietic systems to
  which living things belong. This general characterization is seen at work in
  a computer simulated model of a minimal case satisfying the conditions for
  autopoietic organization."

量化附项: 不适用。结论: 摘要级最小主张 = 论文以自创生系统类的刻画表述生命
组织观, 并以计算机模拟极小案例演示; 组织闭合、结构耦合等正文表述仍未核,
不得升级。

## F2 von Foerster: 百科转述级最小主张

主张 F2。转述方: 英文维基百科条目 "Second-order cybernetics"; 经典引用语境
为 von Foerster 编 Purposive Systems (1968) 与 Cybernetics of Cybernetics
（书目未核; 原文未读）。

- "Foerster referred to it as 'the control of control and the communication of
  communication' and differentiated first-order cybernetics as 'the
  cybernetics of observed systems' and second-order cybernetics as 'the
  cybernetics of observing systems'."（条目正文, 第 4 注）
- "The concept of second-order cybernetics is closely allied to radical
  constructivism, which was developed around the same time by Ernst von
  Glasersfeld."（条目正文）

量化附项: 不适用。结论: 最小主张 = 二阶控制论概念经 von Foerster 表述为
"观察系统的控制论", 与一阶"被观察系统的控制论"相对; 证据层级为百科转述;
1974/1981 本体书页未核。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| Beer VSM 未核 | 百科转述级最小主张; EPFL 新入口失败记录 | 部分, 原文未读 |
| Varela 1974 未核 | 摘要级最小主张; REST 入口成功, 占位 PDF 证据在案 | 部分, 正文未读 |
| von Foerster 未核 | 百科转述级最小主张; CEPA 入口失败 | 部分, 本体未读 |
| ③借用与修辞区分 | 未覆盖 | 0 进展, 范围外 |

## 剩余缺口

- Beer 三书、Varela pp.187-196、von Foerster 1974/1981 正文均未读; 百科与
  摘要不得当原文引用; 后续若获纸本/馆藏可升级。
- 失败入口: EPFL Human Verification; CEPA 作者区空壳; archive.org 与检索端点
  旧况见 `03-control-sources` 与其 attempts-log, 本包未重复。
- 无软件/Pod 迁移结论, 无理论架构裁定, 未扩题。

## 会话记录

- 起止: 2026-10-13 21:50:36 -> 21:55（本文件落盘; 20 分钟硬界 22:10:36）。
- 模型: opencode-go/deepseek-v4.1-flash/max（原生协作子代理, 非 DSH Delegate）;
  session_id 与 token 用量未知。
- 工具: curl/python（OpenAlex、Semantic Scholar、DSpace REST/OAI）; 缓存
  `/tmp/ctl-gaps-03-20261013/`; 每条先 cd 本包 tmp, 输出绝对路径, 无后台下载。
- 仓库写面仅本文件; 无 commit/staging; 未动旧核件/票/地图/原报告/`~/.dsh`/
  部署/真实配置; 未装依赖, 未跑模型。
