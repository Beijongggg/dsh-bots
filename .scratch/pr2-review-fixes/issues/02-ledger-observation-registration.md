# 02：补登记台账投影读数分叉观察项

Status: resolved
Delivery: 53bb3bd62bc25103e937ca6134c9be1c981a992b / integration/pr2-review-fixes
Blocked by: 无

## What to build

实施 [规格 R3](../spec.md#验收要求)。将
`docs/changelog/2026-10-03.md` 的 `EV-20261007-ledger-review-fixup` 第三项
“转长期观察口”登记到 `docs/PROJECT_UNDERSTANDING.md` 的“仍可选题”。

依据为 `AGENTS.md` §5；行为边界来源于
[org-v2-build/41](../../org-v2-build/issues/41-ledger-resident-projection.md)
已记录的 `at(taskId, "latest")` 磁盘读与常驻投影读法。

## Acceptance criteria

- [x] 正式观察入口包含该项，注明两种读法、当前尚未观测到分叉，以及出现真实
      分叉时按 41 号票失效规则立票的触发条件。
- [x] 条目链接原 41 号票与原 CHANGELOG 事件，链接相对路径正确。
- [x] 原 41 号票 Comments 追加登记位置指针；原判据和历史事件原文保留。
- [x] 本票 Comments 留实施与文档核验凭据；集成阶段按 README §6.2 留事件。

## 工作面

独占 `docs/PROJECT_UNDERSTANDING.md`、原 41 号票 Comments 与本票。
不改 CHANGELOG 或本 feature 的 spec.md，由集成阶段统一落档。
本票是已有观察事项的归位，不新增产品或代码工作；只做链接与文档检查。

## Comments

- 2026-10-07：用户在 PR #2 的 P3 规范发现后点名 `$implement-spec`。实施前确认
  分支基于 `integration/pr2-review-fixes`；交付前合入其最新提交。
- 2026-10-07 实施：开工时本分支、集成分支与 merge-base 均为 `d83321c`。已在
  `docs/PROJECT_UNDERSTANDING.md` 的“仍可选题”补登记两种读法、尚未观测到真实
  分叉的事实及立票触发条件，并在原 41 号票 Comments 追加正式登记位置指针。
- 文档核验：登记位于“仍可选题”内；逐条对照原事件和 41 号票，事实措辞与失效
  规则一致。新增的 5 条相对链接均指向现存文件，原 41 号票已有内容及历史事件
  原文逐字保留，`git diff --check` 通过。纯文档归位未新增或运行行为测试。
- 移交备注：本票无待证假设。下一步由集成者合入提交、按 README §6.2 统一留
  事件并关闭本票；登记内容与原 41 号票的新增 Comments 为实施凭据，来源为
  `docs/changelog/2026-10-03.md` 的 `EV-20261007-ledger-review-fixup` 第三项。
- 2026-10-07 集成收口：实施提交 `53bb3bd62bc25103e937ca6134c9be1c981a992b`
  已并入集成分支。固定提交 `42b2bec` 的文档检查 0 违例、Standards 与 Spec
  两轴复审均为 0 项；整批全量 83/83 文件通过。观察项归位完成，Status 置
  `resolved`，不将观察本身误标为已发生故障或已修复故障。
- 统一落档为 `docs/changelog/2026-10-03.md` 的
  `EV-20261007-pr2-review-fixes-implementation` 与 `EV-20261007-pr2-review-fixes-close`。
  移交备注：本票无剩余步骤；后续只在正式观察条目所述触发条件满足时另立票。
