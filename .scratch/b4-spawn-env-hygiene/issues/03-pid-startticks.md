# 03: PID 绑定 /proc stat startTicks

**What to build:** 注册表记录的 pid 与 spawn 时刻的 /proc stat starttime（startTicks）绑定——host 重启后陈旧 pid 被系统复用时，状态面不再把 bot 误标 online，stop/遗留清理不误伤错代进程（即使复用者恰好也是同 profile 的 dsh 进程）。旧记录（无绑定字段）回退现行判定，零迁移成本。

**Blocked by:** None（与 01／02 同改 spawn 区域，建议串行执行——执行纪律非依赖边）。

**Status:** resolved（2026-09-07 实施批，主审席转执行）

**Parent spec:** `../spec.md`

- [x] spawn 成功即记录 startTicks 入注册表；判活（computeStatus）/停止/遗留清理路径在 Linux 上校验 stat starttime 仍等于记录值
- [x] 注入 fake stat 读取器三态断言：旧记录无字段放行／不匹配判陈旧／匹配判在役（不依赖真实杀进程时序）
- [x] 非 Linux 或读取失败退化为现行判定；cmdline 归属检查保留为二道防线
- [x] 全量回归保持基线

**Comments:**

- 2026-09-07 实施：新增 `lib/pid-bind.js`（parseStartTicks 取 `lastIndexOf(")")` 后 fields[19]＝整体第 22 字段，comm 含空格/括号不偏移；readStartTicks 仅 Linux 实读；pidIsSameGeneration 三态——非整数绑定不调 reader 即 true（旧记录零迁移）、读失败/非 Linux 退化 true、比对不等 false＝pid 被复用）。接线：spawn "spawn" 事件记录 `pidStartTicks`；computeStatus 过 isProcessAlive 后加代际门（不符→stale，注入式依赖）；stop() 新增代际不符先行分支（warn 后成对清理 pid/pidStartTicks/startedAt，不动错代进程）；reconcileStalePids 改用 computeStatus 判 stale（死＋错代都收）；全仓 6 处 `delete bot.pid`＋2 处 `delete record.pid` 均成对补 `delete pidStartTicks`。cmdline 归属检查（pidMatchesBot）保留为二道防线未动。
- 测试 `tests/pid-bind.test.mjs` 5 例全绿（parse 纯测含 comm 带括号/0 合法/畸形 null、本进程实读、三态注入、computeStatus 接线、真 spawn 集成——fake dsh bin 起真子进程，断言绑定值与实读一致且 stop 后成对清理）。实施中修正测试两处：①statLine 合成助手垫片多填 1 个致 starttime 落 fields[20]，按 fields[0]＝第 3 字段改为 state 后 18 垫片；②computeStatus 接线案例原用硬编码 pid 4242 过不了 isProcessAlive 前置门，改用 `process.pid`；「旧记录」案例撤掉 `() => false` 假注入（真实现非整数绑定即回退 true，假注入反而测不出语义）。实现无改动。
- 全量 53/53 ×2，冻结面 9/9。
