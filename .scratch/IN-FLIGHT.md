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
| pod core 批（01–06/10/11）＋12 号票改名扫 | DSH implement-spec（session-dc33ac81）；2026-10-10 起评审返修由 zcode 会话接手（用户点名） | `integration/pod-core`（待并）；搁置件留 `integration/pod`；工作树 `.worktrees/pod-*` | 2026-10-09 14:20 | 2026-10-10 用户裁定 07／08／09（工具行/专用行/turn-trigger）搁置、不并入主树；12 号票已收口（`ed6033a`）；用户点名 zcode 会话完成两轴评审＋返修两轮（`0efc9e8`＋`99dc3c0`）＋真机部署（r1 暴露 46 件漂移、r2 补齐 all-same 215/215 @ `99dc3c0`，`EV-20261011-pod-core-rework-deploy`；client 面刷新即生效，host 未重启）；分支待并（`31b1879`）；六条人工判据走查与署名待用户（清单已付）；13／14／15 待逐项点名 |
