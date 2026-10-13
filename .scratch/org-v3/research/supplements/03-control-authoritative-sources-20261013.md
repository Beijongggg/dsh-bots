# 03 控制路三缺口: 权威来源补核（第二批, 有界包）

[组织理论、复杂系统与控制论（纯理念面）](../../issues/03-research-organization-theory-and-concepts.md)
工作包的续包, 只补 `03-control-sources`／`03-control-gaps` 未核三项: Beer（VSM）、
Varela/Maturana/Uribe 1974、von Foerster（二阶控制论）。只提取证据与缺口: 不裁定设计、
不关票、不改状态。原作与权威二手分层; 二手只记转述方自己的文字与其书页定位, 不冒充
直读经典; 未取得正文不写成不存在。旧包失败入口（archive.org 借阅 401、UChile UI Anubis、
Google Books、EPFL 178660、CEPA 登录壳、Bing/DDG/Google/Mojeek）无新条件不重复。
基线 commit `41e59b5`。采集 2026-10-13 23:34:11 起; 20 分钟界 23:54, 初稿 23:40:50 落盘。

## 来源与缓存（均在 `/tmp/org-v3-w2-03-20261013/`, SHA-256）

| 来源 | 入口与版本 | 实读层级 | 缓存 |
|---|---|---|---|
| Puche Regaliza, Jiménez, Arranz Val, "Diagnosis of software projects based on the Viable System Model" | *Systemic Practice and Action Research*（Springer, DOI 10.1007/s11213-019-09491-y）; 机构库副本 `riubu.ubu.es/bitstream/10259/10022/1/puche-spaar_2020.pdf`; 40 页 PDF, 取得 2026-10-13 | 同行评议期刊论文全文（权威二手） | `dl2-d55b94.pdf` `d47b0fbacfe31aed49959a27d4aa9edc0cd81d16099a1eea9ff414654450f9d9`; `burgos.txt` |
| Hutchinson & Warren, "Information warfare: using the VSM as a framework to attack organisations" | *Australasian Journal of Information Systems* 9(2), May 2002; `journal.acs.org.au/index.php/ajis/article/download/193/167`; 8 页 | 同行评议期刊论文全文（权威二手） | `dl2-db294f.pdf` `d59dee0fc17043b6ffd46e70c01d4501541396a054332b2b27655bd58a9ed6d3`; `ajis.txt` `0878eb7479c08a540d7de2a892dd57cd1246d877c18ec82caecc0fe2dfe6ec5e` |
| Brailas, "Replication Crisis in Psychology, Second-Order Cybernetics, and Transactional Causality" | *Integrative Psychological and Behavioral Science*（Springer, DOI 10.1007/s12124-024-09867-3）; PMC11711560 全文 XML via Europe PMC | 同行评议期刊论文全文（权威二手） | `epmc-11711560.xml` `b7c33b4337254a289555844f6aaa40dff1ee1e529903918491324e1a1c133a69` |
| Martínez（Síntesis）, "Vida y organismo: autopoiesis, teleología y posicionalidad plessneriana" | *Síntesis. Revista de Filosofía* 7(1), DOI 10.15691/0718-5448Vol7Iss1a446; `sintesis.uai.cl` PDF | 同行评议期刊论文全文（权威二手, 但定位对象为西语专著版本） | `au-d746a9.pdf` `e4b7b47187ed87521d0a496422e73d483a8aecf328c65194e9130cfe7b9930e7` |
| Rodríguez & Torres, "Autopoiesis, la unidad de una diferencia: Luhmann y Maturana" | *Sociologias* 5(9), 2003, pp.106-140; SciELO PDF | 同行评议期刊论文, 本轮仅题名页与零散行（未形成可定位转述） | `au-8bb6c0.pdf` `9761df5903bbb850584f15e3e9bd55d3291ecfea60998c97e795159b3a9db948` |
| OpenAlex 元数据 | `api.openalex.org`（本包三项 OA 位置与引用图; 新入口） | 接口元数据, 非内容 | `oa-475e7dae.json` `bb5fb15fde769f22bde3b13cc1ce41dee2ebcf5e57f0f1cd9531456cae3f78d9`; `oa-c8f939fa.json` `8b1014335c6c0961a294493cd863832cf882426fe4bc0df7b6b85e79c2ae7b63`; `loc-*.json` |
| OpenAIRE / Europe PMC 元数据 | `api.openaire.eu`; `ebi.ac.uk/europepmc`（EXT_ID:4407425） | 接口元数据（含摘要, 摘要不计内容） | `px-ff67e60f.out`; `px-bcd1d41e.out` |

## 新增失败入口（本批实测, 未绕过挑战）

| 入口 | 结果 | 判定 |
|---|---|---|
| sciencedirect.com 文章页（Varela 1974, PII 0303264774900318） | HTTP 403 机器人挑战页 | 访问失败, 未核验 |
| tandfonline.com/doi/abs/10.1057/jors.1984.2（Beer 1984 JORS） | HTTP 403 | 访问失败, 未核验 |
| onlinelibrary.wiley.com（VSM/二阶控制论相关） | HTTP 403 | 访问失败, 未核验 |
| mdpi.com 全文页 / figshare.com / core.ac.uk 检索 / philpapers.org | 403 | 访问失败, 未核验 |
| api.semanticscholar.org、api.crossref.org、api.fatcat.wiki、scholar.archive.org | 出口代理 CONNECT 502 | 网络出口不可用, 未核验 |
| hull-repository.worktribe.com（VSM 论文副本） | HTTP 403 | 访问失败, 未核验 |
| repository.upenn.edu 位流与 HAL `/document`、`/file/...` 下载 | 返回 HTML 壳（827 B–12.5 KB）, 非论文 PDF | 访问失败, 未核验 |

## B3 Beer VSM: 权威二手达标（两条, 原作仍未直读）

**B3-1 主张**（转述方: Springer 期刊论文, §2 "Viable System Model (VSM)"）:
"Beer (1979, 1981, 1985) presented the VSM (Figure 1) as a management tool that helps us
to understand the complexity of organizations..."; 该文称 VSM "indicates the necessary and
sufficient conditions for an organization to be viable in a scientific manner";
"he identified as essential in every organization, the presence and proper functioning of
a series of functions or subsystems (System One, System Two, System Three, System Four and
System Five) and a series of communication relations"。

定位: `burgos.txt` 第 245 行起（PDF §2）; 递归: "Another essential aspect of the VSM is
its recursive character (Beer, 1984; Schwaninger, 2009). In a recursive organizational
structure, each viable system contains viable systems and, in turn, forms part of systems
that are also viable."（同文后部）; 图注: "Figure 1: Viable System Model. Beer (1985)
p. 136."（转述方给出的 Beer 原书页定位, 二手）; 参考文献列 Beer 1979 *The Heart of
Enterprise*、Beer 1981 *Brain of the firm* (2nd ed.)、Beer 1985 *Diagnosing the System for
Organizations*、Beer 1984（Espejo & Harnden 编集）。

**B3-2 主张**（转述方: AJIS 2002, "THE VIABLE SYSTEM MODEL (VSM)" 节, 译文级别摘录）:
"The Viable System Model (VSM) developed by Stafford Beer (1985), using the principles of
cybernetics has been successfully used to diagnose existing organisational structures and
design new ones."; 五子系统功能分列 SI 执行/局部管理、S2 协调、S3 内部控制（含 S3* 稽核）、
S4 情报与开发、S5 战略与政策; "The VSM has a recursive element, and each SI has another
VSM embedded in it."; "Beer (ibid.) contends that all the above functions must be
adequately performed in an organisation to keep it viable."。定位: `ajis.txt` 第 163-204 行
（期刊页 69-70）, 图 1 "after Beer, 1985"; 参考文献 Beer 1984（Espejo & Harnden 编,
pp.211-270）与 Beer 1985。

作者与项目边界: 两文均为转述方自述, 非 Beer 原文; "necessary and sufficient"、
"metaphor" 一类措辞属转述方概括（AJIS 另称 VSM "is a metaphor for a robust
organisation" 并自标 "functionalist mode"）, 不能回写成 Beer 原话; Beer 原书页只经
B3-1 图注间接定位（1985, p.136）。量化附项: 不适用（概念文, 无数据集/分母）。结论:
Beer 项取得**可定位权威二手两条**; *Brain of the Firm*／*Heart of Enterprise*／
*Diagnosing the System* 三书原作仍未直读, 五子系统与递归的原文措辞与边界留待原作核验。

## V3 Varela 1974: 仍缺口（二手不落在 BioSystems 正文）

新入口结果: OpenAlex（W2093020640）复核 *Biosystems* 5(4) 记录, `oa_status=green`,
唯一 OA 位置仍为 `repositorio.uchile.cl/handle/2250/160309`（前包已证 1 页题录占位）;
Europe PMC（PMID 4407425）与 OpenAIRE 记录未给第二条全文位置, 后者另列 Springer 章节
DOI 10.1007/978-1-4899-0718-9_40（1980 合集转载线索, 未取得正文）。

权威二手候选与实测边界:

- Martínez（*Síntesis* 2024, DOI 10.15691/0718-5448Vol7Iss1a446）讨论 "la teoría
  autopoiética... en su versión original (Maturana & Varela, 1974)", 引其页码 74/75/76/77
  与句 "las nociones de finalidad y función no tienen ningún valor explicativo..."。
  **但**该文参考文献列的是 "Maturana & Varela. 1994. De máquinas y seres vivos.
  Santiago: Editorial Universitaria"（西语专著版本）; 其页定位能否对应 BioSystems
  5(4):187-196 未证实, 本轮不据此认领该 DOI 正文。
- Rodríguez & Torres（*Sociologias* 2003）引用 "Maturana y Varela (1973; 1984)" 与
  *De máquinas y seres vivos*（同属专著版本）; 本轮只读到题名页与零散行, 未形成可定位
  转述, 不计内容达标。

作者与项目边界: 上述两句均属转述方行文; "1974 年原作" 在其行文中指向西语专著概念史,
不等于 *BioSystems* 论文正文（组织闭合、结构耦合、计算机模拟极小案例等前包摘要级主张
仍只到摘要/二手层）。量化附项: 不适用。结论: **V3 未核验**（有界检索空结果: 允许入口
内无 *BioSystems* pp.187-196 可读全文; 未处理 sciencedirect 挑战页）; 不以二手替代
DOI 正文, 是否接受 "概念史二手" 计项由主会话裁定。

## F3 von Foerster: 权威二手达标（概念级）, 1974/1981 本体仍缺口

**F3-1 主张**（转述方: Brailas, Springer 期刊, 摘要与 "Second-Order Cybernetics" 节）:
"Second-order cybernetics, as introduced by Heinz von Foerster, challenges traditional
scientific methodologies that assume a strict separation between the observer and the
observed. The core idea is that the observer, through the very act of observing,
inevitably becomes part of the system they study..."; "Heinz von Foerster was a key figure
in the development of second-order cybernetics, which he briefly defined as the cybernetics
of cybernetics (Scott, 2004; Von Foerster, 2003)."; "Second-order cybernetics introduced
the concept of observing circularity, where the observer is no longer detached or isolated
from the system but is instead considered a participating actor in the loop."; 另引
von Foerster 伦理律令 "act always so as to increase the number of choices" 与美学律令
"If you desire to see, learn how to act"。定位: `epmc-11711560.xml`, 摘要段与
"Second-Order Cybernetics" 节（XML 节标题可检）。

作者与项目边界: 该文参考文献中的 von Foerster 条目为 1984 *On Constructing a Reality*
（Watzlawick 编, Norton, pp.41-61）与 2003 *Understanding Understanding*（Springer,
pp.287-304）——**不是** 1974 *Cybernetics of Cybernetics* 或 1981 *Observing Systems*;
"略述" 与 "cybernetics of cybernetics" 标签是转述方行文, 1974/1981 本体措辞与边界未核。
结论: F3 取得**可定位权威二手一条（概念层）**; 两本原书（含 1974 本体）仍为缺口,
刊本转载线索（OpenAlex W4201387 "Cybernetics of Cybernetics" 2003 book-chapter）未取得正文。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| 控制路第 3-5 项（Beer/Varela/von Foerster） | Beer: 权威二手×2（含 Beer 1985 p.136 书页定位, 二手）; von Foerster: 权威二手×1（概念层, 引 1984/2003 版本）; Varela: 仍缺口 | 2 项可定位权威二手, 1 项缺口; 原作全部未直读 |
| 每条给原文定位与作者边界 | 三条均给出转述定位; Beer/von Foerster 已列转述方自述与推断分界 | 部分（无原作页直读） |
| 经典原文与转述分层 | 三条均标 "权威二手/未核", 未升级为原作 | 达标（分层） |
| ③借用与修辞区分 | 未覆盖 | 范围外 |

## 剩余缺口

- Beer: 三书原作未直读; B3-1 的 1985 p.136 定位为二手转引; 五子系统原文完整措辞与
  Beer 自述边界待原作（*Diagnosing the System* 或 *Heart of Enterprise*）核验。
- Varela: *BioSystems* 5(4):187-196 正文仍未取得; 现有二手均落到西语专著版本; 若需
  该 DOI 正文须出版商开放版本或馆藏/纸本, 本轮允许入口内未发现。
- von Foerster: 1974 *Cybernetics of Cybernetics* 与 1981 *Observing Systems* 本体未读;
  现有权威二手引用的是 1984/2003 转载版本, 不能替两书原文背书。
- 无软件/Pod 迁移结论, 无理论裁定, 未扩题; 未处理人机验证; 不据本包判 "来源不存在"。

## 会话记录

- 起止: 2026-10-13 23:34:11 起, 23:40:50 落盘（失败入口、元数据与已核项一并写入）;
  20 分钟硬界（23:54）内交已核项与缺口。
- 模型: opencode-go/deepseek-v4.1-flash/max（原生协作子代理, 非 DSH Delegate）;
  session_id 与 token 用量未知 —— 模型标识以主会话记录为准。
- 工具: curl/python3/pdftotext（OpenAlex、OpenAIRE、Europe PMC、机构库/期刊直链）;
  缓存 `/tmp/org-v3-w2-03-20261013/`, 每条先 cd 本包 tmp, 输出绝对路径, 无后台下载。
- 仓库写面仅本文件; 无 git 写操作; 未动票/报告/地图/research-handoff/其他 supplements/
  `~/.dsh`/部署/真实配置; 未装依赖, 未跑实验, 未调用本机 DSH。
