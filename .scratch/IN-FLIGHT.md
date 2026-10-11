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
| retro pod 批候选落地 R1②/R2/R6（用户点名） | zcode retro 会话 | main 工作树（恒真断言门＋观察项）＋ `integration/pod-core` 追加提交（sessionLog 单源＋字面量门＋布局探针共享；在制品在 `.worktrees/pod-core`，未提交） | —（登记者补） | 2026-10-11 | 不动 pod 批票面 Status；pod-core 上只叠加 lint/重构件，不改判据面。**更正（同日，zcode 收口会话）**：pod-core 已并回 main（`63c8d37`）但**分支与工作树保留**——本座在制品在座（含未跟踪 `lib/session-log-names.cjs`／`tests/helpers/headless-layout.mjs`），追加提交照旧落 pod-core 后再并；此前「删支、改落 main」的更正作废（EV-20261011-pod-core-teardown-correction） |
