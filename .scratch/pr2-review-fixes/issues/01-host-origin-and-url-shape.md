# 01：修复宿主 origin 传参与空 query／fragment 判定

Status: ready-for-agent
Blocked by: 无

## What to build

实施 [规格 R1、R2](../spec.md#验收要求)。修正 `lib/index.js` 的 `spawnBot` 和
bot `apply` 两处参数，使 `normalizeSeamOrigin` 收到环境变量字符串。
修正 `lib/org/host-env-seam.js` 对空 query／fragment 分隔符的漏检。

来源：[org-v2-build/39](../../org-v2-build/issues/39-host-env-seam-startup-self-check.md)
第四项裁定与 query／fragment 拒绝口径。PR #2 基线 `34f4de9` 上的两项评审发现
分别为 P1、P2。

## Acceptance criteria

- [ ] 宿主带合法 URL 启动席位时，真实假 bin 子进程收到归一化后的 URL。
- [ ] bot 分支带合法 URL 运行真实 `apply()`，邮箱 watcher 与组织工具接线可用，
      不再输出缺 origin 的休眠告警。
- [ ] 裸 `?`、裸 `#`、既有非空 query／fragment 均返回 `malformed`；正常 origin
      与合法路径前缀保持有效。
- [ ] 按 TDD 逐项留下先红后绿的行为证据，不断言源码拼写或 mock 内部归一化函数。
- [ ] 改动文件 `node --check` 与 scoped 测试通过；集成阶段全量回归与 preflight
      按真实 PASS／SKIP 口径落档。
- [ ] 原 39 号票 Comments 追加返修来源与验证指针；本票 Comments 与 CHANGELOG
      记录实施和授权。

## 工作面

独占 `lib/index.js`、`lib/org/host-env-seam.js`、相关既有测试，以及原 39 号票
Comments。不改 CHANGELOG 或本 feature 的 spec.md，由集成阶段统一落档。
测试边界在规格“测试边界”节，沿用用户已确认原票与既有测试入口。

## Comments

- 2026-10-07：用户在上述评审后点名 `$implement-spec`。实施前确认分支基于
  `integration/pr2-review-fixes`；交付前合入其最新提交。
