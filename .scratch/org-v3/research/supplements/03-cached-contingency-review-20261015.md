# 补核：已缓存权变综述的适用范围

所属票：[组织理论、复杂系统与控制论](https://github.com/Beijongggg/dsh-bots/issues/6)。
本轮基线 `568231ea87cc0723d866574cbf9cad1fbe14fdd0`；按
[用户授权修订](https://github.com/Beijongggg/dsh-bots/issues/6#issuecomment-6191455132)限定收口。
本件只读取已取得的扫描，不新增检索，不以补齐旧著原文为完成条件。

## 来源与读取范围

- Astley, W. Graham & Van de Ven, Andrew H. (1983), *Central Perspectives and Debates in Organization
  Theory*, *Administrative Science Quarterly* 28:245-273。题名、作者与卷页按扫描首页核对，DOI 未另核。
- 载体：MIT 课程目录中的已刊扫描副本，非 MIT 作者原作。
  `https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/OB_Introduction_Overview/Astley_&_VandeVen_1983_Central_perspectives.pdf`
- 原件：`/tmp/wayfinder-03-systems-20261015/mit-astley-vandeven-1983.pdf`，SHA-256
  `f850922742ce962736e9cb588b1ec2c14259a6b936bf3acc490ffe5aa56bdefb`，29 物理页。
- 2026-10-15 主会话以 `view_image` 直接读取物理页 1/3/4/5，即刊页 245/247/248/249。
  页图为 `/tmp/wayfinder-03-close-cached-review-20261015/pg-01.png`、`pg-03.png`、`pg-04.png`、`pg-05.png`。
  文本层只有版权行，未用于内容判断；没有安装 OCR。
- 其余 25 页未读；生成全部页图不等于全部阅读。量化附项不适用，无实验、成本或效果复算。
- 本文对其自身的理论分类与比较是作者原文；对 1967 旧著是权威学术二手，不冒充经典直读。

## 可采用内容

| ID、用途 | 原文定位与最短摘录 | 支持范围与边界 |
|---|---|---|
| C1 权变理论的综述层归属，报告 §1.2/1.4 | p.248，The System-Structural View，将 Lawrence & Lorsch 1967、Thompson 1967 与 Woodward 1965 列为 structural contingency theories；同页概括管理者要取得环境变化信息，`gathering correct information about environmental variations` | 支持这篇综述将两部经典置于系统结构／权变视角，并从环境适应解释结构调整。没有提取分化维度、整合者权威或三类互依成本次序，不代证这些细节 |
| C2 权变视角中的分化与整合，报告 §1.2 | p.247 图，system-structural view 的 Change 栏：`Divide and integrate roles to adapt subsystems`，后接环境、技术、规模与资源需求的变化 | 支持作者对这一视角的概括，不是 Lawrence & Lorsch 的逐字原句，不证明分化越高必然成本越高，也不给普遍最优点 |
| C3 视角的限制，报告 §0/§1 的引用边界 | p.245 正文：`any one school of thought invariably offers only a partial account of reality`；p.249 的 strategic choice 段：`choice is available in the design of organizational structure` | 作者并列四种视角，不将系统结构视角当唯一解释。p.249 讨论政治考虑与技术标准的对照；这是综述的解释与批评，不冒充三位经典作者自认的全部边界，也不构成 Pod 效果证据 |

## 未采用内容与停止点

- 所读四页没有用于支撑 Burns & Stalker 机械式／有机式理想型与样本的内容，不升级报告 §1.1。
  未读其余页，因此不作该文全篇没有讨论这两位作者的结论。
- Lawrence & Lorsch 的原书、同年文章与作者自述的全部条件仍未直读；C1/C2 只按综述层使用。
- Thompson 的 pooled／sequential／reciprocal、协调方式、成本次序与分类方法仍未核，不用 C1 代证。
- 不作矩阵病理、锁定定理、必要层级律或 LLM 借用判断；不增加关闭计数，不给架构／切换节奏建议。
- 上述非必要细节按用户授权停止追查；将来若要用来支撑新主张，再另行核验，不作为本票待办。

## 交付记录

- 原生子代理尝试超过 15 分钟上限且未交有效补件，主会话中断并接管；本件由主会话读取四页后写成。
  该尝试不记作界内交付或已验收代理成果。实际模型路由、token 和主动验收工时未计量，不报告净节省。
- 只新增本补件；临时渲染与抽取位于上述 `/tmp` 目录。没有联网取原文，没有调用本机 DSH、安装依赖、
  运行论文代码或模型实验；真实运行面、部署、注册表、配置及冻结件零写入。
