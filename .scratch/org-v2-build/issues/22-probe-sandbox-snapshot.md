# 22: 探针沙箱快照形态

**What to build:** §E「沙箱快照与逐字一致校验形态照用」补全另一半。当前探针件只
实现了逐字一致校验；fs.contains/node.tests 均对活树直接执行——检查时刻与结论使用
时刻之间坐标内容可变（TOCTOU 缝），规格点名的快照形态缺失。本票补：探针执行前的
坐标快照采集步（形态照用逐字一致的快照纪律）、校验对快照执行而非活树直查、快照
与结论绑定可核验（结论报告引用其所核验的快照）。

规格出处：`.scratch/org-v2/spec.md` §E（401 行）；07 号票复审 Spec 轴 (a)2
（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** resolved

- [x] 探针执行有快照采集步（沙箱快照形态照用）
- [x] 校验对快照执行、非活树直查（node.tests 留界①：执行落活树，漂移守卫＋摘要绑定兜底）
- [x] 快照与结论绑定可核验
- [x] 隔离子进程纪律保持（AGENTS.md §2）
- [x] 全量回归 PASS

## Comments

- **实施（2026-09-19，`/implement` 领修复批）**：lib/org/probe.js 快照纪律三步——
  ①快照采集步先于执行：坐标内容一次读定＋字节级 sha256（fs.contains／node.tests
  跑前采集、ledger.no-anomalies 单次读面捕获）；②校验对快照执行：fs.contains 对
  采集内容判定不再回查活树、ledger 对捕获清单过滤（TOCTOU 缝＝检查时刻与结论
  使用时刻坐标内容可变）；③结论绑定可核验：执行过的结论携带键封闭 `snapshot`
  字段（fs.contains={location,sha256,bytes}、node.tests={file,sha256,bytes}、
  ledger.no-anomalies={botId,source,open,sha256}，冻结防改写；采集未发生的拒绝
  （白名单／参数／坐标形状／ctx）不带，采集已成而执行未成（probe-spawn／
  probe-snapshot-drift）同样携带采集快照）。node.tests 新增跑前采集＋跑后重读
  比对＝执行窗口内文件变化即新拒绝码 probe-snapshot-drift fail closed（即使退出
  码 0）；缺文件在采集步 fail closed（probe-read，先于子进程）。测试五新增
  （正例负例绑定、采集步缺文件、漂移守卫、ledger 绑定）＋物化形 helper；
  post-channel 透传断言随结论契约更新。
- **留界①（解释口径待用户确认）**：验收第 2 条「校验对快照执行、非活树直查」
  对 node.tests 未按字面「对副本执行」实现——回归判据的结论主体是仓库树本身，
  对副本执行验证的是副本而非仓库（且测试文件相对 import 使副本执行无法忠实
  物化），故执行仍落活树、以漂移守卫＋摘要绑定兜底；ABA 窗口机械不可证（头注
  留界）。/code-review Spec 轴同判并建议上抛——如需字面副本执行形态请用户明示，
  另出票改造。
- **注记**：ledger.no-anomalies 快照化为票面未点名的一致推广（结论绑定统一），
  /code-review Spec 轴判「量小不否决」。
- **验证**：scoped 19/19（org-probe 11＋org-post-channel 8）；全量
  `TMPDIR=/dev/shm npm test` 49/49；preflight 四门 exit 0（①49/49 ②0009 包
  7/7 ③0 违例 ④11 PASS/0 FAIL/0 SKIP）。
- **复审**：/code-review 双轴并行（Standards 硬违例 0／judgement call 3；Spec
  缺失 2／越权 0／不符 1）全处置——快照装配同形抽 bytesSnapshot 共用件、测试
  物化形抽 materializeTestFile、头注「带/不带 snapshot」二分补 probe-spawn/
  drift 态、总述「校验只对快照执行」收窄为按命令分型、ABA 留界措辞收紧（修）；
  留界①与 ledger 推广注记落本 Comments。
- **修复批其余四票未领归因（同日）**：19／20／23 主体在 09 号票并行会话当时
  在制施工面（task-ledger.js／brief.js 同文件冲突），21 ①②落 ledger-host.js
  同面且④需用户裁定——按并行对话纪律让净工作树。09 号票已随后入库
  （`84a8485`），四票的文件冲突解除、待下批领用。
- 2026-09-19 用户额外模型 `/code-review` 复审（09＋19–23 六票批）发现注记：
  留界①的 node.tests「跑前采集＋跑后漂移比对」守卫经复审确认与 spec.md §E
  「对快照执行」字面形态仍有距离（ABA 窗口机械不可证）。→ **24 号票②收口**
  （裁定：字面达成或漂移守卫等价落档；本票面「待用户确认」挂起项随其销账）。
- **销账（2026-09-19，随 24 号票②）**：用户裁定＝**字面达成**（真·对快照执行）。
  node.tests 改执行前整树物化快照副本（排除 `.git`）、隔离子进程以副本根为
  cwd 执行，执行字节＝快照字节由构造保证、ABA 窗口消除；结论 snapshot 扩展
  `{file, sha256, bytes, tree}`（文件级＋树级绑定都采自副本本体，可独立重算）；
  `probe-snapshot-drift` 漂移守卫退役。本票「留界①（解释口径待用户确认）」
  随此销账——字面形态已在案，机械面与测试锁定见 24 号票 Comments。
