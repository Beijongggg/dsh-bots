# PR #2 评审返修

Status: ready-for-agent

## 来源与授权

用户在 `$code-review pr2` 的三项发现后点名 `$implement-spec`，本轮实施该评审结果。
基线为 PR #2 头部 `34f4de9c75ab2951297a620c7fe0b5ea2e658aef`。原 PR 分支仍由
并行会话登记占用，本轮集成分支为 `integration/pr2-review-fixes`，从该基线另建。

原规格与规则：

- [org-v2-build/39](../org-v2-build/issues/39-host-env-seam-startup-self-check.md)
  第四项裁定要求启动自检与 `spawnBot`／`apply` 共用 origin 归一化；实施记录明确
  拒绝 query／fragment，诊断不参与就绪判定，也不自动补齐 origin。
- [org-v2-build/41](../org-v2-build/issues/41-ledger-resident-projection.md)
  与 `EV-20261007-ledger-review-fixup` 记录 `at(latest)`／常驻读分叉的观察边界。
- `AGENTS.md` §5 要求长期观察项登记到 `docs/PROJECT_UNDERSTANDING.md` 的
  “仍可选题”，并在 CHANGELOG 留界。

## 验收要求

- R1：合法 `DSH_BOTS_HOST_URL` 经 trim、去尾斜杠后下传到宿主拉起的席位。
  席位带合法配置启动时，邮箱 watcher 与组织工具接线使用该 origin，不再误报缺失。
  修改两处调用方的传参，不改变诊断字段和缺配置时的休眠行为。
- R2：结尾为裸 `?` 或 `#` 的 origin 与已有非空 query／fragment 一样判为
  `malformed`，不得输出“缝在位”的诊断。普通 http(s) origin、反代路径前缀、
  百分号编码的路径字符仍按既有合同处理。
- R3：将已留界的投影读数分叉观察项登记到“仍可选题”，注明尚未观测到真实分叉、
  触发条件、41 号票与原事件来源，不将理论风险写成已发生故障。
- R4：代码修复保留行为回归证据；两票在同一集成分支完成、落档，按
  `implement-spec` 流程执行一次两轴 `code-review` 并处理其发现。

## 测试边界

沿用原票和仓库已有边界，不新增测试接口：

- `tests/spawn-env.test.mjs` 已有的 `BotsApi.spawnBot` 真子进程出口，以临时假 bin
  观察子进程实得环境。该入口经仓库规定的 `internals` 测试插槽取得。
- `tests/host-env-seam.test.mjs` 已有的真实 `apply(ctx)` 启动接线，以及公开的
  `checkHostEnvSeam` 诊断输出。只在外部宿主服务／网络边界使用夹具。
- 文档票只核登记位置、事实措辞与链接，不为可逆文字修改新增测试。

## 任务图与收口

| 票 | 交付 | Blocked by |
|---|---|---|
| [01](issues/01-host-origin-and-url-shape.md) | R1、R2，宿主环境缝行为返修 | 无 |
| [02](issues/02-ledger-observation-registration.md) | R3，长期观察项归位 | 无 |

两票可以并行。集成测试、两轴复审与统一 CHANGELOG 事件完成后，按各票 Comments
中的实施提交与验证凭据关闭两票及本规格。真实运行面、冻结包及其 sourceManifest
文件不在本轮写入范围；不涉及部署同步、重启或新的产品需求。

## Comments

- 2026-10-07：三项评审发现转为两张实施票。R1 已在隔离真实 `apply()` 复现，
  合法 URL 下自检 `ok:true` 而 watcher 未启动；R2 已用无网络 `Request` 探针复现
  API 路径进入 query／fragment；R3 已核原日志与正式观察入口不一致。
