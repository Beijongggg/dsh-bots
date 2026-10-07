# 01：修复宿主 origin 传参与空 query／fragment 判定

Status: resolved
Delivery: 995a72f6a3a6224d718da79f82dc20a371df2155 / integration/pr2-review-fixes
Blocked by: 无

## What to build

实施 [规格 R1、R2](../spec.md#验收要求)。修正 `lib/index.js` 的 `spawnBot` 和
bot `apply` 两处参数，使 `normalizeSeamOrigin` 收到环境变量字符串。
修正 `lib/org/host-env-seam.js` 对空 query／fragment 分隔符的漏检。

来源：[org-v2-build/39](../../org-v2-build/issues/39-host-env-seam-startup-self-check.md)
第四项裁定与 query／fragment 拒绝口径。PR #2 基线 `34f4de9` 上的两项评审发现
分别为 P1、P2。

## Acceptance criteria

- [x] 宿主带合法 URL 启动席位时，真实假 bin 子进程收到归一化后的 URL。
- [x] bot 分支带合法 URL 运行真实 `apply()`，邮箱 watcher 与组织工具接线可用，
      不再输出缺 origin 的休眠告警。
- [x] 裸 `?`、裸 `#`、既有非空 query／fragment 均返回 `malformed`；正常 origin
      与合法路径前缀保持有效。
- [x] 按 TDD 逐项留下先红后绿的行为证据，不断言源码拼写或 mock 内部归一化函数。
- [x] 改动文件 `node --check` 与 scoped 测试通过；集成阶段全量回归与 preflight
      按真实 PASS／SKIP 口径落档。
- [x] 原 39 号票 Comments 追加返修来源与验证指针；本票 Comments 与 CHANGELOG
      记录实施和授权。

## 工作面

独占 `lib/index.js`、`lib/org/host-env-seam.js`、相关既有测试，以及原 39 号票
Comments。不改 CHANGELOG 或本 feature 的 spec.md，由集成阶段统一落档。
测试边界在规格“测试边界”节，沿用用户已确认原票与既有测试入口。

## Comments

- 2026-10-07：用户在上述评审后点名 `$implement-spec`。实施前确认分支基于
  `integration/pr2-review-fixes`；交付前合入其最新提交。

### 2026-10-07 实施与逐项红绿证据

授权依据为用户在 PR #2 三项评审发现后点名 `$implement-spec`。独占工作树
`.worktrees/pr2-host-fix` 的初始 `HEAD` 与集成分支均为 `d83321c`，工作树干净。
代码与测试提交为 `995a72f6a3a6224d718da79f82dc20a371df2155`。

`spawnBot` 与 bot `apply` 改传 `process.env.DSH_BOTS_HOST_URL` 字符串。
URL 形状判定直接检查归一化值中的 `?`／`#`，覆盖 `URL.search`／`hash` 返回
空串的裸分隔符。合法反代前缀与编码路径 `%3F`／`%23` 的原有行为保留。

三个切片按表序逐项实施，每次都在红断言出现后才改对应生产代码：

| 切片 | 红时实际观测 | 绿时结果 | 日志 |
|---|---|---|---|
| 真 spawn 的假 bin 出口 | 期望 `https://bots.example/base`，实得 `undefined`；5 过、1 败 | `spawn-env` 6/6 | `host-spawn-red.log`、`host-spawn-green.log` |
| 真 `apply(ctx)` 的 bot 分支 | `合法 origin 下岗位工具须注册` 断言为 false；15 过、1 败 | `host-env-seam` 16/16；邮箱游标请求、`mail.send` 与 `ledger.read` 均接到归一化后的夹具 URL | `host-apply-red.log`、`host-apply-green.log` |
| 裸 query／fragment 分隔符 | 根 origin 与带前缀 origin 的 `?`／`#` 四值均实得 `ok`、期望 `malformed`；16 过、1 败 | `host-env-seam` 17/17，随后 `spawn-env` 6/6 | `host-shape-red.log`、`host-shape-green.log` |

日志目录为 `/tmp/dsh-bots-pr2-implement-7mon70nd/`。该目录的 `host-scoped.py`
为临时运行入口，给子进程单独的临时 `DSH_HOME`，关闭自动启动与自动重启，
清除继承的 origin、假 bin、env 逃生阀及 `NODE_OPTIONS`。每次先对四个变更 JS
文件执行 `node --check`，再执行 `node tests/spawn-env.test.mjs` 或
`node --test tests/host-env-seam.test.mjs`。复跑命令示例：

```sh
python3 /tmp/dsh-bots-pr2-implement-7mon70nd/host-scoped.py verify tests/host-env-seam.test.mjs tests/spawn-env.test.mjs
```

最终 scoped 共 23/23、0 SKIP，四文件语法检查通过。真 `apply` 用例仅在宿主
tools 服务与 `fetch` 网络边界放夹具，所有请求都由夹具应答，不调用原 `fetch`。
提交钩子通过冻结面 10/10 与文档检查 0 违例。未执行全量回归或部署动作。

### 移交备注：当前假设＋下一步＋关键证据指针

两项缺陷均有先红后绿证据，当前没有待验证的故障假设。下一步由集成分支执行
全量回归、preflight、技能内两轴复审及统一 CHANGELOG 落档，再关闭本票。
实施提交与逐项日志见上节；原 39 号票 Comments 已追加本次返修指针。

### 2026-10-07 集成收口

实现与证据经 `6e46e82` 并入集成分支。固定提交
`42b2bec7f0860d270fa568e872a4b72ff4cd3954` 的隔离快照全量 83/83 文件通过，
preflight PASS：冻结面 10/10、文档检查 0 违例、宿主契约 11 PASS／0 FAIL／
1 SKIP。跳过的是隔离数据根无真实会话日志的 `P-SESSION-LOG`，与真 PASS 分列。
同一提交的两轴复审均为 0 项。本票验收项全部完成，Status 置 `resolved`。

统一落档为 `docs/changelog/2026-10-03.md` 的
`EV-20261007-pr2-review-fixes-implementation` 与 `EV-20261007-pr2-review-fixes-close`。
全量日志：`/tmp/dsh-bots-pr2-implement-7mon70nd/integrated/preflight.log`。
移交备注：无待证假设或本票剩余步骤，实施与验证版本见以上提交和事件。
