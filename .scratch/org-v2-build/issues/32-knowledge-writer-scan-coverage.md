# 32: 登记写者扫描覆盖 deprecate 路径与扫描面盲区（A3＋B8 扫描项）

**What to build:** “写者名单闭合”扫描未覆盖新写者 `deprecateReport`，且扫描器自身
有三处潜伏盲区：扩展名严格相等、跟随符号链接无环检测、快照 `.GIT` 精确匹配。

现状（HEAD `d4c24e5` 现行坐标，29 号票独立复核确认，只读实跑扫描器）：
`lib/org/knowledge-shared-face.js` 全文件 `deprecateReport` **0 命中**
（`scanKnowledgeRegisterWriters:186-221` 只找 `registerReport(`，调用者名单
`KNOWLEDGE_REGISTER_WRITER_MODULES=["index.js"]`）；新写者本体
`lib/knowledge.js:339`（`export function deprecateReport`），实际调用方仅
`lib/index.js:2891`（host 装配面三元分发）→ 属覆盖缺口（`V-A4.5` 机械不变式被新
写者单边绕过），不是已利用的越权（实跑 `scanKnowledgeRegisterWriters`＝
`{callers:["lib/index.js"], violations:[]}`，新增 deprecate 调用者不会告警）。
扫描面盲区（`lib/org/face-scan.js:36-49`，`walkJs`）：44 行
`extname(entry) === ".js"`（`.cjs/.mjs` 天然在外，大小写敏感，本仓 `lib/shared.cjs`
即实例）；36-49 `statSync` 跟随符号链接、无 visited 集（本仓 lib 内零 symlink，
不可达潜伏）；`lib/org/probe.js:147` 与 `treeDigestOf:70` 的 `.git` 精确匹配
（`.GIT` 会被拷入快照，潜伏无实例）。

**要定的事（开工时先定并写进 Comments）**：

1. `deprecateReport` 登记写者名单：与 `registerReport` 同名单（推荐，同为命令面
   落点）或单列，bot 侧注册面零直写检查同步覆盖。
2. `walkJs` 扩展名口径：`{.js,.mjs,.cjs}`＋大小写不敏感（推荐；Windows `.JS` 漏扫
   同除），或显式声明只扫 `.js` 并把 `.cjs` 写者纳入白名单论证。
3. symlink 环检测：加 visited 集（小修，防将来犯）或记潜伏不修（须理由）。
4. `.git` 大小写：过滤与摘要统一不敏感比对（小修）或记潜伏不修。

规格出处：10 号票 `V-A4.5`（登记命令化）与 `V-A7.5`（共享侧无第三面）。

来源：29 号票 A3＋B8 扫描三项（2026-09-20 只读审计交接，HEAD `d4c24e5` 独立复核
确认；B8 的 `authorizeLedgerRead` 未接线项不在本票——那是 06/07 留界已知事项，
见 29 号票不立票清单）。

**Blocked by:** 无

**Status:** resolved

- [x] `deprecateReport` 调用者名单闭合（新模块直调即违例，有测试）
- [x] bot 侧注册面零直写检查覆盖 deprecate 路径
- [x] `walkJs` 扩展名／symlink／`.git` 三盲区逐项定死（修或留界＋理由）
- [x] preflight 违例扫（第 3 道门）同步跟进
- [x] 全量回归与 preflight 四道门 PASS

## Comments

### 2026-09-24 开工口径

授权依据为用户 `$implement 32`，按票面推荐方案实施：

1. `registerReport` 与 `deprecateReport` 共用登记写者名单，仅允许 host 装配面
   `lib/index.js` 调用；两种操作都检查 bot 侧注册函数的直写。
2. 共用 `walkJs` 扫描 `.js`、`.mjs`、`.cjs`，扩展名按大小写不敏感比较。
3. 跟随目录符号链接时用真实路径记录已访问目录，截断环路，保留稳定排序。
4. 探针快照拷贝过滤与树摘要都按大小写不敏感规则排除 `.git` 条目。
5. preflight 第③门接入知识库直写与登记写者扫描，任一违例都使总门失败；保留
   原有 Status 词表检查与四门顺序。

测试沿用规格 §测试接缝和 10 号票已确认的公共接口：
`scanKnowledgeLayerFace`、`scanKnowledgeRegisterWriters`、preflight 门出口及
`runCriterion(node.tests)`。每个切片先写负例、确认失败，再实现并跑单文件。
项目没有 TypeScript 配置或 typecheck 脚本，修改的 JS/MJS 用 `node --check`
做语法检查，最终用一次 `npm run preflight` 同时执行全量回归和四道门。

评审固定点为开工 HEAD `f4a8224a3f773c29068c5c98183607791d242282`，只审本票
差异。轮前其他票的未提交修改保留，提交时排除。拟改文件均不在 0010 包的
sourceManifest 内，冻结件与真实运行面不写入。

### 2026-09-24 实施与验证

- `knowledge-shared-face.js` 用同一命令表检查两种写操作，函数定义不算调用；
  `registerKnowledgeTools` 与 `registerOrgTools` 两个 bot 注册函数均检查登记
  与废弃调用。合法调用者仍仅为 `lib/index.js`，没有扩张豁免名单。
- `face-scan.js` 的扩展名改为大小写不敏感的 JS/MJS/CJS；跟随目录链接时按
  realpath 去重并排序。测试覆盖链接到外部目录、重复链接和返回祖先的环。
  邮件与词表扫描共用此函数，两件相关回归也通过。
- `probe.js` 的拷贝过滤与树摘要共用 `isGitEntry`，各层级 `.git` 大小写变体
  均排除。公共 `runCriterion(node.tests)` 用例确认执行副本没有元数据，返回
  树摘要只绑定保留的测试文件。
- preflight 第③门由 `repositoryLint` 聚合 Status、知识文件直写与登记／废弃
  写者违例；其中任何一项失败均进入原来的总门拒绝分支。一次性临时仓库验证
  确认第①门通过时，违规 `.CJS` 写者仍令总门退出 1。常驻测试在第③门接口
  校验聚合行为，不拉入第④宿主契约门，保持套件与宿主探针分离。

六个新增用例按切片先红后绿，分别复现漏扫废弃调用、bot 注册面直写、MJS
漏扫、目录链接 `ELOOP`、`.GIT` 被拷入及第③门未纳入知识违例。单文件结果为
知识扫描 19/19、探针 15/15、preflight 子件 9/9；七件 JS/MJS 的 `node --check`
通过。全量回归首次发现新增测试名与既有 V-A4.5 标题片段重复，已只改新增
标题，坐标回归 14/14 通过，未改判据或坐标表。

最终 `npm run preflight` 退出 0：①67/67 测试文件；②0010 包冻结面 10/10；
③97 个 md、52 个脚本、1 个登记／废弃调用者，零违例；④宿主契约
11 PASS／0 FAIL／0 SKIP。沙箱内子进程与本机监听遇到 EPERM 后，经授权在
沙箱外执行隔离测试；写入仅测试临时目录，真实运行面零写入。

### 2026-09-24 两轴评审与收口

按 implement 流程调用 code-review，两名独立上下文子代理分别审 Standards 与
Spec。固定点 `f4a8224`，隔离副本评审提交 `5ea095a`，仅含本票九件差异。
评审模型沿用主代理 Codex GPT-6，执行工具未返回更细的型号标识。

- Standards：规范违例 0，基线异味建议 0。共用扫描函数、写者名单与 Git 过滤
  符合单源纪律；测试落在已确认的公共接缝；落档、冻结面与隔离边界符合约定。
- Spec：缺失或部分实现 0、范围扩张 0、实现错误 0。覆盖两种写操作、bot
  注册函数、扩展名与链接环、Git 元数据过滤和第③门拒绝；评审方在隔离副本
  独立复跑三个相关测试文件，43/43 通过。

两轴均无阻断项。全量回归及四门验证通过，票面转 `resolved`。本票只提交本轮
代码、测试、票面与 CHANGELOG 新条目；开工时其他票的修改逐文件核对保持。
