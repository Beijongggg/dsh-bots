# 02：补登记台账投影读数分叉观察项

Status: ready-for-agent
Blocked by: 无

## What to build

实施 [规格 R3](../spec.md#验收要求)。将
`docs/changelog/2026-10-03.md` 的 `EV-20261007-ledger-review-fixup` 第三项
“转长期观察口”登记到 `docs/PROJECT_UNDERSTANDING.md` 的“仍可选题”。

依据为 `AGENTS.md` §5；行为边界来源于
[org-v2-build/41](../../org-v2-build/issues/41-ledger-resident-projection.md)
已记录的 `at(taskId, "latest")` 磁盘读与常驻投影读法。

## Acceptance criteria

- [ ] 正式观察入口包含该项，注明两种读法、当前尚未观测到分叉，以及出现真实
      分叉时按 41 号票失效规则立票的触发条件。
- [ ] 条目链接原 41 号票与原 CHANGELOG 事件，链接相对路径正确。
- [ ] 原 41 号票 Comments 追加登记位置指针；原判据和历史事件原文保留。
- [ ] 本票 Comments 留实施与文档核验凭据；集成阶段按 README §6.2 留事件。

## 工作面

独占 `docs/PROJECT_UNDERSTANDING.md`、原 41 号票 Comments 与本票。
不改 CHANGELOG 或本 feature 的 spec.md，由集成阶段统一落档。
本票是已有观察事项的归位，不新增产品或代码工作；只做链接与文档检查。

## Comments

- 2026-10-07：用户在 PR #2 的 P3 规范发现后点名 `$implement-spec`。实施前确认
  分支基于 `integration/pr2-review-fixes`；交付前合入其最新提交。
