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
| wayfinder 建图：组织架构更迭＋持续演进机制 | dsh web 会话（Lead） | `.scratch/org-v3/` | `map.md`（建图＋研究票 01／02 已闭；03 交付物在写） | 2026-10-13 16:05 | 建图轮只写 `.scratch/org-v3/`；三路研究子代理产物落 `research/` |
