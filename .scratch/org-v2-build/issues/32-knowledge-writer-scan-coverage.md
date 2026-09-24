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

**Status:** ready-for-agent

- [ ] `deprecateReport` 调用者名单闭合（新模块直调即违例，有测试）
- [ ] bot 侧注册面零直写检查覆盖 deprecate 路径
- [ ] `walkJs` 扩展名／symlink／`.git` 三盲区逐项定死（修或留界＋理由）
- [ ] preflight 违例扫（第 3 道门）同步跟进
- [ ] 全量回归与 preflight 四道门 PASS
