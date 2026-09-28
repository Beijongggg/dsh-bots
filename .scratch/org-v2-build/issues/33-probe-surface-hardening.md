# 33: 探针面一轮收口（A4 快照 GC＋A5 SKIP 假绿＋A6 非法参数＋B4 TMPDIR）

**What to build:** 探针 `node.tests` 腿四题同面收口：快照副本无 GC、退出码 0 的
SKIP 被判通过、非法参数抛错而非 fail-closed、`TMPDIR` 缝 Windows 静默无效。

现状（HEAD `d4c24e5` 现行坐标，29 号票独立复核确认，A6 纯内存实测）：
`lib/org/probe.js:144-202`——146 `mkdtempSync(join(materializeBase, "dsh-probe-snapshot-"))`、
147 整树 `cpSync`（仅排除 `.git`）；清理点仅三处（150／160／179-182 `cleanup`，
仅 `error`／`close` 调用）；163-166 `treeDigestOf` 无 try（抛错即泄漏整树副本）；
`spawn` 在 Promise executor 内同步调（同步抛即泄漏）；计时器 178 行只覆盖子进程
执行段，不覆盖 147 整树拷贝＋165 整树哈希（两步全同步阻塞事件循环）；全仓
`dsh-probe-snapshot` 仅 146 一处命中，无陈旧目录清扫器（SIGKILL 宿主／163-171
抛错／孙进程继承管道致 `close` 不触发 → 副本永久残留 `os.tmpdir()`）。
A5：189-200 `code === 0` 即 `{ok:true}`，文件内 SKIP 零检测；对照
`tests/run.mjs:22-28`（`SKIP_MARKER`＋分列计数）、
`tests/host-contract-gate.test.mjs:125-130`、`tests/locale-runtime.test.mjs:25-30`
（存在性守卫 exit 0）——被登记为判据的跳过测试会被判通过并附 tree 摘要
（24 号票②后后果放大；25 号票只加了超时单列，未加 SKIP 单列）。
A6：`fs.contains` 96-100（`isAbsolute(args.location)` 前无类型守卫）；
`brief.js:167-170` 注释“参数值合法性在执行期判”（冻结期只验键集）；
`runCriterion:264-288` 无 try/catch——实测 `isAbsolute(123)` 与
`runCriterion({location:123})` 均抛 `ERR_INVALID_ARG_TYPE`（Node v22.23.2），
异常穿透而非 `{ok:false}`。
B4：`TMPDIR` 全仓仅 `probe.js:170`（`ctx.tmpdir ?? process.env.TMPDIR`），POSIX
专名（Windows 子进程认 `TEMP`／`TMP`），当前无生产接线传入 `ctx.tmpdir`
（`runCriterion` ctx 文档 256 行仅声明可选）→ 潜伏。

**要定的事（开工时先定并写进 Comments）**：

1. GC 形态：同步段＋executor 加 try/finally（必做）＋启动陈旧清扫器／TTL／体积
   条目上限（选做，写明取舍）。
2. SKIP 语义（口径裁定）：输出含 `SKIP_MARKER` 且 exit 0 → “不过”（推荐，与关闭
   前置“跳过≠通过”同口径）还是第三态（须同步改 `runCriterion` 两态与 25 号票
   `acceptanceReadiness` 通过口径——改动大，须论证）。
3. `runCriterion` fail-closed 化范围：参数值非法一律 `{ok:false}`（推荐，与白名单
   同码系），执行体同步抛的兜底口径。
4. `TMPDIR` Windows 口径：`TMPDIR ?? TEMP ?? TMP`（小修）或声明 POSIX-only
  （须理由；生产接线是否传 `ctx.tmpdir` 一并定）。

规格出处：`.scratch/org-v2/spec.md` §E（探针接线）与 22／24 号票（沙箱快照纪律）。

来源：29 号票 A4＋A5＋A6＋B4（2026-09-20 只读审计交接，HEAD `d4c24e5` 独立复核
确认；四条同面，并为一票——同文件 `probe.js`、单会话可完成，分票反增合并冲突；
`/code-review` Standards 轴 Divergent Change judgement 已论证保留）。

**Blocked by:** 无

**Status:** resolved

## Comments

### 开工前定死（2026-09-28 `/implement 33`，AskUserQuestion 五问全按推荐通过）

- **缝（TDD 预约定）**：缝 A＝`lib/org/probe.js` 公开面（`runCriterion`／`PROBE_COMMANDS`，
  经 `tests/org-probe.test.mjs`）；缝 B＝关闭前置 `acceptanceReadiness` 口径
  （经 `tests/acceptance-records.test.mjs`，只验 SKIP／抛错到关闭门的传导，不另开缝）。
- ① **GC**：同步段＋executor 加 `try/finally` 全覆盖（必做）＋启动陈旧清扫器
  （选做中采纳：`tmpdir` 下 `dsh-probe-snapshot-*` TTL 1h best-effort 清扫，失败不 fail closed；
  体积条目上限不做——并发探针数小，TTL 已 bound 残留，取舍在案）。
- ② **SKIP**：输出含 `SKIP_MARKER` 且 exit 0 → **判不过**（新码 `probe-skip`，
  理由点名跳过≠通过；与关闭前置“跳过≠通过”同口径）。第三态不选——须同步改
  `runCriterion` 两态与 25 号票 `acceptanceReadiness` 通过口径，改动大无收益。
  检测对**全量 stdout**（非 `slice(-4000)` 尾）做，免长输出截断 marker 假绿；
  `timedOut` 优先于 SKIP（超时归因不变）。
- ③ **fail-closed**：参数值非法一律 `{ok:false}`（`probe-args`，与白名单同码系；
  `fs.contains location/text`、`node.tests file`、`ledger.no-anomalies botId/source`
  加类型守卫）＋`runCriterion` 外层 `try/catch` 兜底执行体同步抛
  （折 `probe-error`，不再穿透抛错）。
- ④ **TMPDIR**：`ctx.tmpdir ?? TMPDIR ?? TEMP ?? TMP` 链式解析（小修），解析值同时
  写入子进程 `TMPDIR／TEMP／TMP` 三键（Windows 子进程认后两者，只写 TMPDIR 仍静默无效）；
  空串／非串视为未设；生产接线**不传** `ctx.tmpdir`（`lib/index.js` 仍只传 `cwd`，
  缝已留，用环境变量，少一处可漂移面）。

- [x] 快照副本泄漏三路径封死（try/finally＋回归用例），清扫器／上限取舍在案
- [x] SKIP 语义写死（不过或第三态，25 号票关闭前置口径同步）
- [x] 非法参数 fail-closed（`runCriterion` 不再穿透抛错，有用例）
- [x] `TMPDIR` Windows 口径写死
- [x] 全量回归与 preflight 四道门 PASS

### 实施与复审处置（2026-09-28，`/implement 33`，TDD 缝 A＋B 红→绿）

- **改件**：`lib/org/probe.js`（A4 try 全覆盖＋`sweepStaleProbeSnapshots`／`PROBE_SNAPSHOT_*`；
  A5 `probe-skip`＋`PROBE_SKIP_MARKER`；A6 类型守卫＋外层兜底 `probe-error`；
  B4 `resolveProbeTmpEnv` 链＋三键同写＋物化基座同链）、`tests/org-probe.test.mjs`
  （9 新增）、`tests/acceptance-records.test.mjs`（SKIP 传导 1 新增）。
- **验证**：`tests/org-probe` **23/23**、`acceptance-records` **24/24**、
  `task-ledger` **57/57**、烟测 **6/6**；`npm test` **67/67**；
  `npm run preflight` exit 0——①67/67 ②0010 包 10/10 ③0 违例（77md／52 脚本）
  ④11 PASS／0 FAIL／0 SKIP。`git diff --check` 通过；快照残留零（`dsh-probe-snapshot-*`
  无残留）；运行面零写入（全程临时目录＋隔离子进程）。
- **`/code-review` 双轴**（固定点 `89d2721`，工作树 diff，双席并行）：
  Standards 硬违例 **0**／judgement 3（GC 三处清理抽 `removeSnapshotRoot` 共用件——已修；
  测试动态 import 改顶层——已修；`resolveProbeTmpEnv` 命名——留：返回的是 env 源的
  临时目录取值（三键同写之源），名实相符，改名牵三件无收益）。
- **Spec 轴 7 项处置（修 4／驳回 4，驳回均有理由在案）**：
  - 修① 清扫器加 `isDirectory` 守卫（同前缀陈旧文件不动）＋用例锁定。
  - 修② 理由串 `safeArgsText` 安全串化（BigInt／循环引用仍落 `probe-args`）＋用例锁定。
  - 修③ 物化基座服从同一解析链（`resolve(tmpEnv ?? tmpdir())`，清扫基座同源）＋用例锁定。
  - 修④ 超时优先 SKIP 用例锁定（代码本就 `timedOut` 先行）。
  - 驳① “5 新导出 scope creep”——新导出是回归用例的可观测缝（无导出即无缝可测），
    非行为扩张；判据两态与快照形状未动。
  - 驳② “`probe-spawn` 系发明”——该码 25 号票已存在（启动失败路径），executor 内
    catch 只是复用同码，不新增码。
  - 驳③ “stderr 并入 stdout 违背全量 stdout”——合流是 25 号票既有行为；
    “全量”指全量 vs `slice(-4000)` 截断尾，合流只增灵敏度（stderr 的 SKIP 同样捕获）。
  - 驳④ “缩进 SKIP 漏检”——与套件 `declaresSkip`（行首匹配）严格同口径是刻意 parity：
    用 `includes` 会让探针判跳过而套件判通过（门与套件分叉，更坏）；等值断言锁定。
  - 另补记触发点：清扫器触发＝每次 `node.tests` 执行首 best-effort（票面原只定 TTL，
    触发点现写死于此）。计时器仅覆盖子进程段（同步拷贝＋哈希不可中断，抛错走
    probe-snapshot GC 路径）——取舍不变。强制抛错（treeDigest／spawn 同步抛）无专用
    回归：可达触发需 mock／故障注入（本仓 TDD 禁内部 mock），executor 守卫属纵深防御；
    可达路径（成功／超时／跳过／失败）残留零已实测。
