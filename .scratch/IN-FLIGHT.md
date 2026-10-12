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
| pod/14 运行面窗口执行（进行中，18:22 起） | zcode（/implement 13 后续会话；执行方未自登，本行由 14 会话代记） | 运行面 `~/.dsh`（含停链） | `.scratch/pod/issues/13-rename-identity-switch.md`／14 号票 Comments；spec＝`artifacts/cutover-preparation/pod13-window-20261012T102118Z-batch.json` | 2026-10-12 18:2x | 用户 18:21 裁定「本会话执行窗口」且排除 14 会话再执行；14 会话修门 A/B（`8d0911c`）已交付并让行收尾（无窗口执行面）。其他会话勿动运行面 |
