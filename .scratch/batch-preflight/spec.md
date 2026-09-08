# 批前门自动化与文档去缓存（retro 改进第一批）

Status: ready-for-agent（2026-09-08 用户逐项裁定获选，待实施）

## 来源

「本项目现阶段整体架构」retro 会话候选清单 5 项（交接件
`/tmp/dsh-bots-retro-handoff-2026-09-08.md`，证据坐标已核验属实），
2026-09-08 经 AskUserQuestion 逐项裁定全部获选立项。

## 决策记录（用户裁定）

| 候选 | 裁定 |
| ---- | ---- |
| C1 批前门一键 preflight | 获选；冻结面清单**动态跟随** `artifacts/packages/` 最新序号包的 `executionEvidence.provenance.sourceManifest`（新包 0009+ 出现后自动跟随，不硬编码 0008） |
| C2 /code-review 固定点 | 获选；方向＝**本地 `git init`**（无 remote、批尾一 commit，评审直接吃 diff）——retro 会话推荐项，用户明示批准改变工作面性质 |
| C3 README §2 计数漂移 | 获选；方向＝**删全部手工计数**（「删缓存」哲学，目录列表本身是事实源） |
| C4 run.mjs EROFS 提示 | 获选；形式＝**启动时定向提示**（探测 tmpdir 不可写即打一行指向 `TMPDIR=/dev/shm`，照常失败，不自动回退） |
| C5 .scratch Status 词表 lint | 获选；**并入 preflight**，不单出 npm script；两个历史异词件（b5-sse-replay `done`、arch-client-fetch-exports `implemented`）显式豁免、按约定不回改 |

## 工单（4 票）

- issues/01-git-init-review-baseline.md —— C2
- issues/02-run-mjs-erofs-hint.md —— C4
- issues/03-readme-drop-manual-counts.md —— C3
- issues/04-preflight-gate.md —— C1＋C5

01 必须最先执行：git init 须发生在任何文件改动之前，否则基线 commit
混入本批改动、评审固定点失效。

## 红线（AGENTS.md 已载，实施时易踩）

- 冻结面（最新序号包 sourceManifest 所列文件）零触碰；preflight 只**读**
  包做复验，不写。
- 真实运行面零写入。
- 批尾落档：CHANGELOG 顶部条目＋README §2 地图同步。

## Comments
