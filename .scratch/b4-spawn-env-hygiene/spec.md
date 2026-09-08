# B4：环境与文件边界（spawn env allowlist／权限收紧／PID 绑定 startTicks）

Status: resolved（2026-09-07 全三票实施完成，见 Comments）

- **来源**：PLAN §十一 B4 行（2026-09-05 用户确认的 B1~B5 路线图）；
  差距分析锚点＝docs/GROK-DSH-BOTS-COMPARISON.md C 系列＋P0-6.3。
- **排程**：待用户点名启动（roadmap 纪律：每批逐项点名授权＋落档）。

## Problem Statement

普通 Bot 生产边界有三个已确认缺口：
1. **环境全量继承**——两处 spawn 点把宿主整个 `process.env` 传给 bot 子进程，
   宿主 shell 里的任何敏感变量（API key、token、代理凭据）都进入每个 bot。
2. **默认权限落盘**——profile 目录与 settings.yaml（含模型凭据）、workspace、
   注册表均按默认 umask 创建（典型 0755/0644），同机其他用户可读。
3. **PID 判活无身份绑定**——注册表驱动的在线判定只做 signal-0 存在性检查；
   host 重启后陈旧 PID 被系统复用时，bot 被误标 online；stop 路径虽有
   cmdline 归属检查，但同 profile 换代场景区分不了"这一次 spawn 的那个进程"。

## Solution

三件事一批落地：spawn 环境改为显式 allowlist（纯函数构造，两处 spawn 共用）；
敏感目录/文件权限收紧（目录 0700、文件 0600，含存量幂等收紧）；spawn 时
记录 `/proc/<pid>/stat` 的 starttime（startTicks）入注册表，判活/清理/停止
路径校验进程仍是"我们 spawn 的那一个"。

## User Stories

1. 作为 bot 运维者，我希望宿主环境里的 API key 等敏感变量不进入 bot 子进程，以免任一 bot 回显/泄露环境时带出宿主凭据。
2. 作为 bot 运维者，我希望 dsh 传给 bot 的必要变量（DSH_HOME、DSH_WEB_URL）照常可用，以免 bot 启动即坏。
3. 作为 bot 运维者，我希望有显式逃生阀按需附加个别变量，以便排查网络/包管理器问题时不必改代码。
4. 作为同机其他用户，我希望 bot 的 profile settings（模型凭据）、workspace 与注册表对我不可读，以免横向读到凭据与拓扑。
5. 作为 bot 运维者，我希望存量旧文件（已经 0644 落盘的 settings 等）也被收紧，而不只是新文件，以免批处理只保护增量。
6. 作为 bot 运维者，我希望 host 重启后注册表里的陈旧 pid 不再把 bot 标成 online，以免状态面撒谎、UI 显示假在线。
7. 作为 bot 运维者，我希望 pid 复用（即使复用者恰好也是同 profile 的 dsh 进程）不会让 stop/清理作用到错代进程，以免误杀活回合。
8. 作为评审流程使用者，我希望 reviewer bot 的 spawn 同样走 allowlist，以免评审数据面成为豁免口。
9. 作为审计者，我希望 env 产物、权限落点、pid 判定三者的语义有回归断言，以免后续抽取时漂移。

## Implementation Decisions

- **env 构造收敛为单一纯函数**：输入＝进程环境快照＋本 bot 的 DSH 显式集
  （DSH_HOME、DSH_WEB_URL、DSH_BOTS_BOT_ID 一类），输出＝allowlist 并集。
  基集只含进程基础设施变量（PATH、HOME、LANG/LC_*、TZ、TERM 一档），
  一律不含 `*KEY*`/`*TOKEN*`/`*SECRET*`/`*PASSWORD*` 形态与 NODE_OPTIONS
  （可注入）。两处 spawn（create-bot 脚本 spawn 与 dsh bin spawn）共用同一
  函数，杜绝第二份枚举。
- **逃生阀**：环境变量 `DSH_BOTS_ENV_EXTRA`（逗号分隔变量名）附加进白名单，
  只在显式设置时生效；命名与现有 `DSH_BOTS_AUTORESTART` 开关族一致。
- **权限**：profile/workspace 目录 mkdir 显式 0700；settings.yaml、
  package.json、cordis.patch.yml、pnpm-workspace.yaml、注册表 bots.json
  的原子写显式 mode 0600（统一收紧，不逐文件辩论敏感度）。存量收紧走
  spawn/启动路径的幂等 chmod（lstat 常规文件/目录才动，链接跳过）。
- **PID 绑定**：spawn 成功后读 `/proc/<pid>/stat` 第 22 字段（starttime，
  clock ticks）记入注册表（如 `pidStartTicks`）；Linux 上
  computeStatus/stop/遗留清理在 signal-0 存在之外加校验 stat starttime
  仍等于记录值——不等即视同陈旧（PID 被复用）。非 Linux 或读取失败退化为
  现行判定；cmdline 归属检查保留为第二道防线。注册表无 `pidStartTicks`
  的旧记录回退现行判定（零迁移成本）。
- **边界不变量**：supervisor 的 readiness/exit 路径经 child 对象与 generation
  fencing（B2 已落），不受本批影响；stat 绑定只强化注册表驱动的判定
  （host 重启后、跨进程观测场景）。
- **冻结面**：本批只动 lib/index.js spawn/状态区域＋可能的共享 util；
  9 文件 sourceManifest 零触碰，不触发 0009。
- **验收口径**（沿 roadmap 统一口径）：攻击/重放/负例入回归套件、
  全量基线保持（现 50/50）、部署走 C2 既有流程。

## Testing Decisions

- 好测试只断言外部行为，不锁内部结构：
  - **env 纯函数直测**：给定含敏感名的环境快照，断言产物恰为白名单并集、
    DSH 显式集在位、`*_KEY_*` 形态恒不在、逃生阀按需附加且缺名安全忽略。
  - **权限落点**：临时 dshHome 走真实 spawn（经既有 create-bot 脚本注入缝），
    statSync 断言目录 0700/文件 0600；预置 0644 存量文件后重跑收紧，
    断言幂等（第二遍不再改 mtime 类可观测面）。
  - **pid 判定**：注入 fake 的 stat 读取器——旧记录（无 startTicks）放行、
    startTicks 不匹配判陈旧、匹配判在役；不依赖真实杀进程的时序。
- **seam 选择**：三者（env 构造/权限收紧/pid 判定）沿 review-http-api.js
  与 mail-plane.js 先例提为 index.js `internals` 同名导出；不新增 HTTP 缝，
  生命周期行为经 BotsApi 既有测试面（events.test.mjs / bot-supervisor.test.mjs
  的注入风格）覆盖。
- **先例**：api-security.test.mjs（纯函数协议直测）、bot-supervisor.test.mjs
  （全注入假时钟/探针）。

## Out of Scope

- seccomp/容器级隔离、网络出站限制（未立项，观察项留在既有台账）。
- 跨启动的 PID 持久审计日志。
- B5 SSE 可重放（另立 spec）；0009 证据包重采集（不触冻结面）。

## Further Notes

- 部署沿 C2 流程，与本仓库待部署的 deploy-b3-session-driver 批独立排程
  （可顺位同链，点名时定）。
- 完成后：CHANGELOG 顶部条目＋PLAN §十一 B4 行收口＋本 spec Comments 记结。

## Comments

- 2026-09-07：01（spawn env allowlist）实施完成——lib/spawn-env.js＋两处
  spawn 共用构造，真 spawn 集成测试；见 issues/01。
- 2026-09-07（同日收尾）：02（权限收紧）＋03（PID 代际绑定）实施完成——
  lib/fs-hygiene.js＋lib/pid-bind.js＋index.js 接线；全量 53/53×2、冻结面
  9/9 零漂移；两票 Comments 载证据与过程修正。B4 全三票收口，PLAN §十一
  B4 行同步；部署随 `.scratch/deploy-b3-session-driver/spec.md` 7 文件批
  （待点名）。
- 2026-09-07（评审修复）：双席 code-review（Standards/Spec）发现 P1~P4
  修复完成——①**P1/a1**：scaffoldBot 脚本成功路径补 tightenBotTree（主
  生产路径此前漏收紧，User Story 5 兑现；builtin 分支重复收紧删一）；
  ②**P3/a3**：tightenPath 同 mode 短路（0o7777 全位比较，特殊位不短路），
  幂等断言升级为 mtime/ctime 零改动（单测＋两处集成）；③**P2/a2**：新增
  假 create-bot 脚本集成测试（真 spawn 经 DSH_BOTS_CREATE_BOT_SCRIPT 缝，
  显式 0755/0644 模拟默认 umask 落盘）——原测试指向不存在脚本强制 builtin
  回退、掩盖 P1；④**P4/c1**：buildSpawnEnv overrides 同受名称形状拒绝
  （只过滤名称形状，不查 source 存在性）。红测先行各确认变红再转绿；
  全量 53/53×2、冻结面 9/9 零漂移（runs/24781c8f sourceManifest 逐一
  sha256＋byteLength）。记录性两项（TMPDIR 基集偏差、注册表写后 chmod
  瞬态窗口）维持原授权理由不动。**P5（internals 导出补齐 vs spec 措辞
  修订）与 P6（重构/词汇表）留用户裁定，未动。**
- 2026-09-07（主审复核）：修复返回件 `/tmp/handoff-b4-fix-verification.md`
  转主审席独立核验——**通过**。逐项核实：P1 三出口收紧齐（script 成功
  :719＋builtin 内部 :614 双回退，`bot.workspace ??` 语义三处一致）；
  P2 假脚本测试含「确已执行」防误判断言；P3 三处 mtime/ctime 断言在位
  （fs-hygiene.test.mjs:36-41/:123-128/:180-192）；P4 overrides 形状过滤
  ＋优先级保留＋无 undefined 不变量（spawn-env.js:36-56）。负例推演三则
  （workspace 非默认路径三出口一致／短路对 writeRegistryAtomic 无影响——
  每次原子写新 inode 默认 mode 仍触发 chmod／两调用方零行为变化）均无
  问题。机械复核亲测：全量 53/53×2（node tests/run.mjs）、冻结面 9/9
  （runs/24781c8f 逐一 sha256）、node --check 三文件、收紧调用面清点＝
  tightenPath×1＋tightenBotTree×2。**裁量裁定：①P3 同 mode 短路成立**
  ——spec Testing Decisions 明文要求「第二遍不再改 mtime 类可观测面」、
  模块 docblock 已承诺「重复执行无副作用」，短路是使断言为真的最小实现
  变化，且 0o7777 全位比较保 setuid/sticky 归零行为；**②P4 undefined
  跳过成立**——与 pick 语义一致、有测试锁定，属预防性收紧。红态未独立
  复现（无 git 可快照，接受断言精确性＋代码通读＋绿套替代）。**新发现
  1 项注释级小项**：scaffoldProfileBuiltin 内「存量由 scaffoldBot 末尾的
  tightenBotTree 幂等收回」（index.js:585-586）对 builtin 分支不成立
  （该分支早于 :719 即 return，存量收回实靠 builtin 自身 :614）——注释
  准确性问题、零行为影响，留 P6 或下批顺手修。
- 2026-09-07（残余项原地修复＝P5/P6 收口）：用户裁定「评估复杂度，无需
  返回票据则原地修复」——路由评估**无需新票**（全部为本次工单线程内
  行为保持清理＋文档项，无新能力/新模块），主审席执行：①**P5 选「补齐
  internals 导出」**（parseStartTicks/pidIsSameGeneration/tightenBotTree/
  tightenPath），两测试函数消费面统一切 internals，导出即有消费者；②
  **P6 clearProcessRecord**——8 处 pid/pidStartTicks/startedAt 三连收敛为
  单一助手；**stop() 三分支收拢**为 clearStale 闭包（warn 文案逐字不变）；
  ③ENV_EXTRA_VAR 死导出转模块私有（测试字面名锁定对外合同）；④上条注释
  小项已修（scaffoldProfileBuiltin 两处注释按实际路径改写）；⑤CONTEXT.md
  ＋「代际绑定」「逃生阀」两词条；⑥pidIsSameGeneration 命名维持（docblock
  已载语义）。验证：全量 53/53×2、冻结面 9/9、node --check 五文件；过程
  修正 1 枚（parseStartTicks 漏 import 被 31/53 抓出即改）。**B4 评审→
  修复→复核→残余收口全链闭合**；spec 本体 Testing Decisions 的 internals
  口径经补齐后与实现一致，无需措辞修订。CHANGELOG 顶部条目同步。