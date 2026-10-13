# 在办登记（并行会话协调）

领票或占用一个工作面前，先在下面表格登记一行；提交入库或放弃后删掉该行，
并拆除本批的隔离 worktree 与已并入分支（`git worktree remove`／`git branch -d`）
——预置 worktree 是领座信号，收口后滞留即幻影座位（retro3 先例：40–46 批
合流后 10 个 worktree 与 9 条分支滞留，`EV-20261009-retro3-40-46`）。
各工具（zcode、codex 等）共用这一份表。本表只答「谁正在做什么」，进度与
状态仍以票面 `Status` 与 CHANGELOG 为准。

预置 worktree＝已领座位：工作树干净、无独有提交，不代表无主——动手前先读
本表，再看 `git worktree list` 与 `git status`。同票撞面时以本表先登记者为先，
后来者换隔离工作面并在备注注明。

| 任务 | 会话／工具 | 工作面 | spec／票面 | 领取时间 | 备注 |
|---|---|---|---|---|---|
| org-v3 票01 第二批补核（在线动态候选） | codex 主会话＋ds4.1 子代理 | main（只增 supplements 新件） | [01 研究票](org-v3/issues/01-research-org-patterns-and-phase-transition.md) | 2026-10-13 23:33 | 输出 `01-online-successors-20261013.md`；验收后清除 |
| org-v3 票02 第二批补核（三套件四栏） | codex 主会话＋ds4.1 子代理 | main（只增 supplements 新件） | [02 研究票](org-v3/issues/02-research-benchmarks-with-cost.md) | 2026-10-13 23:33 | 输出 `02-suite-fields-remainder-20261013.md`；验收后清除 |
| org-v3 票03 第二批补核（控制论三缺口） | codex 主会话＋ds4.1 子代理 | main（只增 supplements 新件） | [03 研究票](org-v3/issues/03-research-organization-theory-and-concepts.md) | 2026-10-13 23:33 | 输出 `03-control-authoritative-sources-20261013.md`；验收后清除 |
