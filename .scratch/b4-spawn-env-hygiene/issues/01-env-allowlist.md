# 01: spawn env allowlist

**What to build:** bot 子进程不再继承宿主全量环境——白名单构造纯函数供两处 spawn（create-bot 脚本 spawn 与 dsh bin spawn）共用，宿主 shell 里的 API key／token／secret 类变量进不了任何 bot 进程；显式逃生阀（附加变量名列表）供网络/包管理器问题排查按需放行。

**Blocked by:** None（与 02／03 同改 spawn 区域，建议串行执行——执行纪律非依赖边）。

**Status:** resolved（2026-09-07 实施完成，见 Comments）

**Parent spec:** `../spec.md`

- [x] 白名单纯函数直测：产物恰为白名单并集；`*KEY*`/`*TOKEN*`/`*SECRET*`/`*PASSWORD*` 形态与 NODE_OPTIONS 恒不在；DSH 显式集（DSH_HOME/DSH_WEB_URL 等）在位；逃生阀按需附加且缺名安全忽略
- [x] 两处 spawn 共用同一构造函数，无第二份枚举
- [x] 全量回归保持基线（51/51×2，含新增 tests/spawn-env.test.mjs 5 用例——含经 DSH_BOTS_DSH_BIN 假 bin 的真 spawn 集成断言）

## Comments

- 2026-09-07 实施完成（`/implement` frontier 顺序执行）：lib/spawn-env.js（50
  行）＋index.js 两处 spawn 接线＋internals 导出；冻结面 9/9。**部署风险
  注记**：dsh 全包普查确认不从环境读凭据形态变量；但 dsh 引用 NO_PROXY——
  宿主经代理出网时部署前须 `DSH_BOTS_ENV_EXTRA=http_proxy,https_proxy,no_proxy`
  （大小写按宿主实际变量名）放行，否则 bot 无法出网调 API。详见 CHANGELOG
  对应条目。
