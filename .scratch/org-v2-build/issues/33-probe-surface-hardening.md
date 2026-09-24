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

**Status:** ready-for-agent

- [ ] 快照副本泄漏三路径封死（try/finally＋回归用例），清扫器／上限取舍在案
- [ ] SKIP 语义写死（不过或第三态，25 号票关闭前置口径同步）
- [ ] 非法参数 fail-closed（`runCriterion` 不再穿透抛错，有用例）
- [ ] `TMPDIR` Windows 口径写死
- [ ] 全量回归与 preflight 四道门 PASS
