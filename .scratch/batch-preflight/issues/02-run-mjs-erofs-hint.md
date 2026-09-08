# 02: tests/run.mjs 启动时 EROFS 定向提示

**What to build:** 在只读 tmpdir 环境下跑 `npm test` 时，测试运行器在启动
阶段即探测 tmpdir 不可写，打一行定向提示（指向 `TMPDIR=/dev/shm npm
test` 与文档复现条件），然后照常执行测试、失败仍非零退出。消除「探针先
疑探针」类误诊（该注记在 CHANGELOG 已手写 6+ 次）。

**Blocked by:** 01（基线 commit 须先落）。

**Status:** resolved

- [x] run.mjs 启动探测 os.tmpdir() 可写性；不可写（EROFS 等）即输出一行定向提示（tmpdirHint 导出函数＋主流程接线，入口守护防 import 递归）
- [x] 提示后照常跑测试，退出码语义不变
- [x] 带测试：tests/run-erofs-hint.test.mjs 3 用例（只读目录 chmod 0555 验证提示文案＋隔离子进程调用；root 环境自动跳过只读用例防假绿）
- [x] 全量回归通过（2026-09-08：TMPDIR=/dev/shm 55/55）

## Comments
