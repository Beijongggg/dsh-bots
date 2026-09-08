# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Terminal states（本仓库本地扩展）

上表五个角色均为**排程态**（球在谁的场上），不含终态-成功位——工单完成
之时五词无一适用，此即历史批次的 `resolved` 漂移之根因。2026-09-08 经用户
裁定收编 `resolved` 为终态-成功（**本地扩展，非上游 mattpocock/skills
词表内容——重跑 /setup-matt-pocock-skills 时勿覆盖本节**）：

| Label                            | Applies to             | Meaning      | Evidence obligation（凭据义务）                                                    |
| -------------------------------- | ---------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `resolved`                       | implementation issue   | 已实施完成   | `## Comments` 实施与验证证据＋CHANGELOG 顶部条目（AGENTS.md §1 落档纪律）           |
| `resolved`                       | wayfinder ticket       | 决议完成     | `## Answer` 节＋map.md Decisions-so-far 回写（见 issue-tracker.md Wayfinding 段）   |
| `claimed`                        | wayfinder ticket **only** | 已认领执行中 | 实现票不得使用（2026-09-08 同步批评审曾纠正一例）                                  |

- spec.md 的 `Status:` 行同用本文件词表（五排程词＋`resolved`）。历史件中
  出现的 `done`／`implemented` 为已观测同义词，按 `resolved` 解读，**不回改
  历史件**。
- `wontfix` 仍是唯一终态-拒绝（不做／已另行消化，不实施）。
