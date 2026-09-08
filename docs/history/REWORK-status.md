# R-3 返修执行状态（2026-08-28 +0800）

## 当前门态（2026-08-29 阶段收口）

- **P6-5 / P6-4 / P7-5 已关闭**：第八轮双席会签＋用户确认（依据 PLAN 门态收口段、
  CHANGELOG 收尾条目、收尾证据包）；P7-5 四文件 repo↔deploy 平价 4/4＋部署版黑盒
  复放通过。
- **R-3 仍 NOT READY / BLOCKED**：独立验收未发生，编码方不自判 PASS/READY；门态
  判定权在双席与用户。
- **P9 仅点名指令启动**；F-RV-24/25 通过、F-RV-26 关闭（编号 1～26 冻结）。
- 下方「R-3 执行完毕后」一节及其「继续挂门/待双席复核」表述为**历史快照**，
  不代表当前状态。

## 历史快照：门态（R-3 执行完毕后时点，2026-08-28/29）

- **R-2 已获授权并已执行，独立验收不通过**：两席 2026-08-28 统一返回
  F-RV-1～F-RV-17 + W-RV-1（固定编号与验收顺序见 PLAN 10.6）。
- **R-3 返修已获用户授权并全部执行完毕**（R3-01～R3-10，按两席固定顺序；
  依赖 F-RV-17→2→1→13→3→14→15→4/5/6→7~12→16）。
- **R-3 独立验收未发生**：编码方不自判 PASS/READY；门态判定权在双席（P9）与用户。
- **继续挂门**：P6-4（真实实例四源注册）、P6-5（真实 sentinel）、P7-5
  （真实登记/部署/重启）、P9（双席独立复审）。
- **门态更新（2026-08-29，编码方执行）**：P7-5 已执行（R-2026-009 登记+指针迁移+
  全量部署+五进程重启）；P6-4 验收 PASS（5 bot 五字段+双席真实签发消费）；P6-5 已
  执行（real-sentinel 守卫负测试 2/2 fail-closed + 授权探针 8 格 ALLOWED 观测 +
  非破坏性证明，artifacts/p6-5-sentinel-evidence.json）。三项均**待双席复核**；
  P9 未启动；门态判定权在双席与用户。

## R-3 交付摘要（详见 PLAN 10.7 执行记录）

1. **F-RV-17**：实例身份五字段冻结（host 写入管理身份；签发/校验同一身份源；
   旧格式/损坏 fail closed 不回退；重启轮换）。
2. **F-RV-2**：job.heartbeat capability 闭环（白名单 + heartbeatJob 全链自校验 +
   去 fallback；七矩阵）。
3. **F-RV-1**：runner 周期 heartbeat（20s<60s）+ watcher in-flight 守卫 +
   completed 持久 handled 标记（新模块 tests/review-heartbeat.test.mjs）。
4. **F-RV-13**：createInvocation 可信创建边界（stage/作者/target/transition/snapshot
   机械校验）+ snapshot 全链同源传播。
5. **F-RV-3**：fix-report 生产提交通道（工具 body 直提→reportFix→自动复检；
   job 绑定 sourceSnapshotId；生产链七段测试）。
6. **F-RV-14**：十字段 schema 生产校验（正文=唯一事实源，与 job.scope/参数逐项绑定）。
7. **F-RV-15**：final/recheck-final route committed 不可绕过发布门；
   writeUserDecision 复核 user-facing route。
8. **F-RV-4/5/6**：flow/lease 损坏 fail-closed（不重建不覆盖）；requeue 默认拒绝。
9. **F-RV-7~12**：dead-letter 转移收紧、copy 瞬时失败可重试、appendJsonl 原子追加、
   崩溃恢复测试、evidence capability 主副审对称、受控边界文档冻结。
10. **F-RV-16**：五文档镜像 + 证据包重出（结论=提交独立验收）。

## 验证（编码方自测，非验收）

- 全量回归 **35/35** 全绿（TMPDIR=/dev/shm）；并发压力 5/5；18 个 lib 模块
  node --check 0 失败；反例覆盖 F-RV-17×5/2×7/1×6/13/3/14×6/15/4/5/6/7/8/10/11。
- 证据包 `artifacts/review-evidence-package.json`（无结论；账实核对，SHA-256 见包内）。

## 边界声明（R-3 阶段历史快照，如实；当前门态见本文顶部门态更新段）

未创建真实 engineering 实例；未执行 P6-4/P6-5；未登记/部署/重启（P7-5）；
未修改真实配置；未写真实 instances.jsonl；R-3 独立验收待双席。

> **文档状态声明（2026-08-29 归一）**：本段为 R-3 阶段边界的历史快照。
> 其后 P6-4/P6-5/P7-5 已相继执行（见顶部门态更新段与 CHANGELOG）；本段保留
> 仅为历史留痕，不代表当前状态。