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

| 任务 | 会话／工具 | 工作面 | 领取时间 | 备注 |
|---|---|---|---|---|
| pod 01–12（功能批＋改名·标识符扫） | DSH implement-spec（session-dc33ac81） | `integration/pod`；工作树 `.worktrees/pod-*` | 2026-10-09 14:20 | 01–10 已并入且四门全绿；部署同步已按授权执行（2026-10-10，记录 `artifacts/cutover-execution/pod-feature-batch-20261010T1816Z-sync-16d4fa06.json`）；待宿主重启后真机走查＋11 收口；12 待做；13／14／15 待逐项点名 |
