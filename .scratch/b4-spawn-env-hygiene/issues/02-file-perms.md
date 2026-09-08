# 02: 敏感目录与文件权限收紧

**What to build:** bot 的 profile settings（含模型凭据）、workspace 与注册表对同机其他用户不可读——新件显式 0700（目录）/0600（文件）落盘；已存在的旧权限存量经启动/spawn 路径幂等收紧，而非只保护增量。

**Blocked by:** None（与 01／03 同改 spawn 区域，建议串行执行——执行纪律非依赖边）。

**Status:** resolved（2026-09-07 实施批，主审席转执行）

**Parent spec:** `../spec.md`

- [x] 真实 spawn（经既有 create-bot 脚本注入缝）后 statSync 断言：profile/workspace 目录 0700、settings.yaml 等文件与注册表 0600
- [x] 预置 0644 存量文件后重跑收紧 → 0600；再跑一遍不再变化（幂等）
- [x] 符号链接跳过（lstat 判别，不追改链接目标）
- [x] 全量回归保持基线

**Comments:**

- 2026-09-07 实施：新增 `lib/fs-hygiene.js`（tightenPath 三态：文件 0600/目录 0700/符号链接与缺路径不动；tightenBotTree 收顶层两目录＋四具名文件，不递归——node_modules/.bin 执行位保护）。接线：scaffoldProfileBuiltin 两个 mkdir 显式 `mode: 0o700`；scaffoldBot builtin 分支与 script-path 分支出口均调 tightenBotTree；writeRegistryAtomic 写后 tightenPath（存量旧权限随写收回）。
- 测试 `tests/fs-hygiene.test.mjs` 4 例全绿（幂等/链接 lstat 不穿透/不递归/注册表存量回收/scaffoldBot 集成含 0644→0600 收回）。实施中发现并修正测试自身两处假设错误：①「链接本身不改」原用 statSync 会穿透符号链接，改 lstatSync；②注册表断言路径原写 `$DSH_HOME/bots.json`，实际 registryPath 为 `$DSH_HOME/bots/bots.json`。实现无改动。
- 全量 53/53 ×2，冻结面 9/9（0008 包 sourceManifest 逐一 sha256 比对）。chmod 走写后收紧而非改 writeFileAtomic 默认（shared.cjs 无 mode 参数，避免波及全部调用面）。
