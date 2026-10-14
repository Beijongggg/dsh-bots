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

## Terminal states（本仓库扩展）

上表五个角色均为**排程态**（球在谁的场上），不含终态-成功位——工单完成
之时五词无一适用，此即历史批次的 `resolved` 漂移之根因。2026-09-08 经用户
裁定收编 `resolved` 为终态-成功（**本仓库扩展，非上游 mattpocock/skills
词表内容——重跑 /setup-matt-pocock-skills 时勿覆盖本节**）：

| Label                            | Applies to             | Meaning      | Evidence obligation（凭据义务）                                                    |
| -------------------------------- | ---------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `resolved`                       | implementation issue   | 已实施完成   | Issue 评论中的实施与验证证据；项目落档按 README §6.2 |
| `resolved`                       | wayfinder ticket       | 决议完成     | 答案评论＋父 Issue 的 Decisions so far 索引（见 issue-tracker.md Wayfinding 段） |
| `claimed`                        | wayfinder ticket **only** | 已认领执行中 | 实现票不得使用（2026-09-08 同步批评审曾纠正一例）                                  |

- 未迁移本地票与 spec.md 的 `Status:` 行同用本文件词表（五排程词＋`resolved`）。历史件中
  出现的 `done`／`implemented` 为已观测同义词，按 `resolved` 解读，**不回改
  历史件**。
- `wontfix` 仍是唯一终态-拒绝（不做／已另行消化，不实施）。

## GitHub representation

| 词表语义 | GitHub 表示 |
|---|---|
| 五个默认 triage 角色 | 同名 Issue label |
| `resolved` | Issue 已关闭，关闭原因为 completed |
| wayfinder 的 `claimed` | 开放子 Issue 已有 assignee |
| `wontfix` | 同名 label，关闭原因为 not planned |

未迁移本地票以 Comments 保存实施证据，wayfinder 以 Answer 节与 map.md 索引保存决议。
迁移入口与后续读取见 issue-tracker.md。
