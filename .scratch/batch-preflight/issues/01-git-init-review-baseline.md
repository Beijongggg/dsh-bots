# 01: git init 本地评审仓（基线 commit＝评审固定点）

**What to build:** 仓库从「无 git」转为本地 git 仓（无 remote）。全树做一次
基线 commit，此后每批工作收尾一 commit，/code-review 的固定点从「手工
/tmp 批前快照」（有被 tmpfs 清空吞件前科，CHANGELOG:1273）改为直接吃
`git diff <基线>`。

**Blocked by:** None（can start immediately；但必须先于本批 02~04 执行，
否则基线混入本批改动）。

**Status:** resolved

- [x] `git init`（无 remote、不配置 push 目标）— 分支 main，无 remote
- [x] `.gitignore` 最小集 — 仅 node_modules/＋.DS_Store，在役文档与 artifacts 证据链全跟踪
- [x] 全树基线 commit — ba1856d，259 文件
- [x] 基线 commit 后 `git status` 干净（0 条）；冻结面 9/9 sha 复验一致（2026-09-08 跑通）

## Comments
