# 03 控制论四来源: 原文提取（有界包）

[组织理论、复杂系统与控制论（纯理念面）](../../issues/03-research-organization-theory-and-concepts.md)
工作包的续包, 范围只含原报告 §3 除 Ashby 外的四个来源: Wiener 1948, Beer 1972
（允许以 1979 或 1985 替代）, Varela/Maturana/Uribe 1974, von Foerster 1974
（允许以 1981 选集替代）。只做原文提取, 不含理论迁移、跨理论关系与设计裁定;
作者结论与后人转述分栏, 未取得原文的条目记未核, 不写成不存在。
基线 commit `a8967ce118c9becfad132159ae50f9a86ba11397`。采集 2026-10-13。

## 来源与缓存

| 来源 | 入口与版本 | 实读层级 | 缓存与 SHA-256 |
|---|---|---|---|
| Wiener, Cybernetics 2nd ed. | 公开扫描 `http://www.uberty.org/wp-content/uploads/2015/07/Norbert_Wiener_Cybernetics.pdf`; 版权页: 1948 与 1961, Fourth Printing 1985, First MIT Press paperback 1965 | 页图直读: 版权页, 第二版序 vii-viii, 第 IV 章书页 95-97 | `/tmp/cyb-03-20261013/wiener.pdf` `f733dde90a70fe090b5209ac7ca391e86f3ed4477b0a2ebd7054747d8ed0d857`; 页图 `wp-003.png` `0786ce7d...a2973f`, `wp-006.png` `b7f46bc3...6de9e7b`, `wp-007.png` `3e993bed...6720446`, `wch4-114.png` `8fcc8095...c405d3473f`, `wch4-115.png` `f30735db...a461d6ae`, `wch4-116.png` `de17a683...4c4e011d` |
| Beer | 未取得可读副本 | 未取得（见 B1） | `heart.txt` 为 401 响应体 `93711768...50254ef2`; 逐条尝试记录 `attempts-log.txt` `03c72579...ebfe9a8` |
| Varela/Maturana/Uribe 1974 | DOI 10.1016/0303-2647(74)90031-8; OpenAlex 记 green OA 于 Universidad de Chile 库 `https://repositorio.uchile.cl/handle/2250/160309` | 未取得正文（见 V1） | 挑战页 `varela-uchile.html` `cee85f6c...1d3e007cdc` |
| von Foerster | 未取得可读副本 | 未取得（见 F1） | 检索记录 `b1.json` `753c59c0...5ffd309da`, `v1.json` `f7894040...cfb8bb42` 等 |

## W1 Wiener: 负反馈反对受控量偏离, 稳定性取决于回路设计

机制主张 W1（原报告 §3.2 反馈与稳态条; 消费面: 主会话对切换控制器的裁定）:
回送到控制端的信号趋向于反对受控量离开控制量, 即负反馈; 作者以恒温器、蒸汽机
调速器等例说明负反馈稳定温度、速度与位置。回路含期望设定与实测比较的环节;
作者未把它写成一般定理。直读层级为 1961 第二版书页 95-97 页图核读。

定位与最短原句（书页=PDF 页号-19）:

- 第 IV 章开篇, 书页 95: 脊髓痨与脑损伤病例演示反馈受损的后果;
  "Their muscles are strong and healthy enough, but they are unable to organize
  their actions."
- 书页 96: "Notice that in this system there is a human link in the chain of the
  transmission and return of information: in what we shall from now on call the
  chain of feedback."
- 书页 96 恒温器: "There is a setting for the desired room temperature; and if the
  actual temperature of the house is below this, an apparatus ..."（句跨页）;
  书页 97 续: "... brings the temperature of the house up to the desired level."
- 书页 97: "Notice that the feedback tends to oppose what the system is already
  doing, and is thus negative." 与 "The information fed back to the control
  center tends to oppose the departure of the controlled quantity from the
  controlling quantity ..."
- 书页 97: "We have thus examples of negative feedbacks to stabilize temperature
  and negative feedbacks to stabilize velocity."（同页另列位置与船舶操舵例）
- 作者自述边界, 书页 97: "Note that the constancy of this level depends on the
  good design of the thermostat, and that a badly designed thermostat may send
  the temperature of the house into violent oscillations not unlike the motions
  of the man suffering from cerebellar tremor."
- 作者自述边界, 第二版序书页 viii: "The simple linear feedbacks, the study of
  which was so important in awakening scientists to the role of cybernetic study,
  now are seen to be far less simple and far less linear than they appeared at
  first view." 书页 97 末仍在做线性化说明 "The simplest control systems are
  linear ...", 两者并存, 不可只引一边。

版本声明: 1948 首版本体未取; 本包所读为第二版（1961 版权, 1985 印刷）, 页码为
第二版书页 95-97。原报告 §3.2 引 Wiener 1948 处由"未经一手来源核验"升级为
"第二版第 IV 章 3 页页图核读"; 1948 首版页次仍未核。书页 96 只给恒温器带
"期望室温"设定一例, 不支持原报告"没有设定点就没有稳态, 只有漂移或振荡"的
全称断言。该断言撤回, 不保留为设计前提。

适用条件与未报告: 已读页对象为机械与生理反馈回路; 95-97 页无设定点数学定义、
稳定性量化条件或"漂移"命题。量化附项: 不适用（概念章, 无数据集与分母）。
结论: 支持"负反馈反对偏离、稳定温度/速度/位置"与"稳定性依赖回路设计";
反驳"第二版仍把反馈一律线性处理"的读法; 漂移命题未核。

## B1 Beer: 未取得原文, Book 层未核

尝试与失败证据（2026-10-13）:

- archive.org 题名检索 `title:("brain of the firm") AND mediatype:texts` 返回
  `numFound 0`; 仅存有声书与阅读小组音频。
- archive.org 持有 `heartofenterpris0000beer`（Beer, The Heart of Enterprise,
  1994 刷次记录）。其 `_djvu.txt` 下载返回 401 Authorization Required
  （借阅限制）, 正文不可得; 缓存见上表。
- 内页检索 `fulltext/inside.php`（viable system / variety）返回 404;
  `api.archivelab.org` searchinside 空响应; Google Books API 同日不可用。
  逐条记录见 `attempts-log.txt`。

最短原句: 无。实际读取层级: 未取得正文; 仅确认 1994 刷次目录记录存在。
适用条件/未报告: 未适用。结论: 未核, 不改动原报告对 VSM 的二手引述强度。
量化附项: 不适用。

## V1 Varela/Maturana/Uribe 1974: 副本定位成功, 正文未取得

- DOI 10.1016/0303-2647(74)90031-8; OpenAlex 记 OA green, 正文在 Universidad
  de Chile 机构库 `https://repositorio.uchile.cl/handle/2250/160309`。
- Unpaywall 查询同日只给这一个 oa_location（repository）, 无第二副本入口。
- 该库直链 `item_34548860810.pdf` 返回反自动化挑战页（Anubis, 302 至 JS
  挑战）, 本轮无浏览器, 正文未取到; 缓存 `varela-uchile.html`。
- 另查 1980 年 Reidel 合集（Maturana & Varela, Autopoiesis and Cognition）在
  archive.org 的 `autopoiesiscogni0042matu`, `_djvu.txt` 同为 401 借阅限制;
  仅核到 1980 合集书目（题名/作者/年/出版社来自 archive.org 元数据）。

最短原句: 无。实际读取层级: 未取得正文; 机构库为作者所属大学副本入口。
适用条件/未报告: 未适用。结论: 未核; 原报告 §3.4 的"组织闭合、结构耦合"
转述与本轮未核的"不能照搬软件"边界均保持原状态, 不升级。
量化附项: 不适用。

## F1 von Foerster 1974/1981: 未取得可读副本

- archive.org 题名检索 `title:("cybernetics of cybernetics")` 0 命中;
  检索 `creator:("von Foerster") AND mediatype:texts` 得 `kybernethik00foer`
  （1993）一条, 非本条目。
- Monoskop `Heinz_von_Foerster` 页仅列出无关 PDF（1991 西语集、2003 两篇）。
- archive.org `title:("observing systems") AND mediatype:texts` 检索无
  von Foerster 条目; Google Books API 同日不可用。

最短原句: 无。实际读取层级: 未取得正文。结论: 未核; 原报告 §3.5 的
"观察者纳入系统"转述不作改动, 也不写成"原文不存在"。量化附项: 不适用。

## 原关闭项覆盖表

| 原关闭项 | 本包覆盖 | 状态 |
|---|---|---|
| ①控制论路经典出处内容核验 | Wiener 增补为第二版开篇章页图核读; Beer/Varela/von Foerster 未取得正文 | 部分; 控制论路仍未达五条 |
| ②边界条件与设计警告 | 已核 Wiener 自述边界两处（第二版序线性化收回; 书页 97 恒温器设计要求） | 部分 |
| ③借用与修辞区分 | 未覆盖 | 未核, 0 进展 |
| ④交付物含来源表与盲区 | 本件含来源表与缺口 | 部分 |

## 剩余缺口

- Beer: 本轮未取得 Brain of the Firm 1972 全文; Heart of Enterprise 借阅受限;
  需借阅账号或馆藏副本, 或改派 1985 Diagnosing the System for Organizations。
- Varela 1974: 本轮机构库入口有反自动化门; [续包](03-control-gaps-20261013.md)另取 REST 文件, 但仅为题录摘要占位, 正文仍未取得。
- von Foerster 1974/1981: 本轮入口未见可读副本; 不据此判断书目不存在。
- Wiener: 首版 1948 页次、第 IV 章后续页与稳定性数学表述未读;
  书页 97 以后的振荡形式分析未读; "漂移"命题未核。

## 会话记录

- agent 路径 `/root/theory_control_sources`; 模型按主会话登记
  `opencode-go/deepseek-v4.1-flash/max`; 原生协作子代理, 非 DSH Delegate;
  session_id 与 token 用量未知; 工具记录: exec/curl/pdftotext/pdftoppm/页图直读。
- 起止: 2026-10-13 21:19 至 21:31; 草稿 21:26 落盘（10 分钟保全线内）,
  20 分钟硬界内交回。引文核验方式: uberty 扫描无文本层, 全部原句经 pdfimages
  转出的页图逐页直读; 本件英文引文与所用页图绑定, 页图 SHA 见来源表。
- 最终仓库交付为本件。下载时漏切临时目录, 曾在仓库根生成 `sa1.html`; 创建归因已确认, 后移至 `/tmp/cyb-03-20261013/sa1.html`。这次偏离不是工具隔离成功, 详见[委派验收记录](../../research-handoff.md)。未动 `.tmp/`、`~/.dsh`、部署目录、真实配置与票面/地图/原报告; 未安装依赖, 未跑实验。
