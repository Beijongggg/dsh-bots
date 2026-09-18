# 15: 退役冻结评审残余与证据包再生

**What to build:** 冻结面上的评审残余退役，**并再生证据包让门②复绿**。`lib/review-enforcement.js`
（enforcement 矩阵，形态已随 v2 废弃）与 `scripts/review-enforcement-probe.cjs` 退役；其中 sentinel
系仍在用的原语（`canonicalJsonString`／`SHADOW_LAYOUT_MANIFEST`）先**迁移至 sentinel 侧**，保证
sentinel 系不受影响。两件都在 0008 包的 `sourceManifest` 里，一动门② 必然红，故必须**以新 runId
重采集、出新序号增量包**（**不覆盖 0008**、文件名内嵌自身 SHA），门② 对新序号包复绿。
**证据包链与门② 存续**（`AGENTS.md` §2 长期纪律，非 v1 评审形态附属）。PLAN P0.3 冻结决策表
**加废止标注、不删表**。本票**不单开序号**的意图照规格：矩阵删除并入 v2 实现批的证据包。

规格出处：`.scratch/org-v2/spec.md` §I（迁移工作清单第 4 项、冻结面与证据包链段）。

**Blocked by:** 02（原语已拆出）、03（业务面已退役）

**Status:** resolved

- [ ] `lib/review-enforcement.js` 退役（enforcement 矩阵随形态废弃）
- [ ] `scripts/review-enforcement-probe.cjs` 退役
- [ ] sentinel 在用的原语迁至 sentinel 侧，sentinel 系行为不受影响
- [ ] 以新 runId 再生增量证据包：新序号、**不覆盖 0008**、文件名内嵌自身 SHA
- [ ] preflight 门② 对新序号包复绿（旧包只读保留）
- [ ] 证据包链与门② 存续（`AGENTS.md` §2 长期纪律）
- [ ] PLAN P0.3 表加废止标注、不删表（无需新增量包）
- [ ] 全量回归 PASS

## Comments

- 2026-09-18 领票（用户 `/implement` 调用；06 号票已由并行会话领走在制——本票与其文件面
  完全不相交才领）：本会话按 /implement＋/tdd 执行本票。领票时 01–05 与 18 已入库；
  07/08/09/11/14 压在在制 06 之后不可领；10/12/13 与 06 文件面共写（org/／插件入口），
  为避免撞车不取，故领本票。
- 2026-09-18 接缝预约定（/tdd 纪律：测试只打在预约定接缝；按规格 Testing Decisions 与
  票面验收行选定五处）：① `lib/sentinel-shadow.js` 导出面（迁移原语行为等价）——
  sentinel 系既有行为测试改指向后全绿为凭；② 退役完整性扫描（活面零 review-enforcement
  引用）——新增扫描测试；③ evidence-packager schema `evidence-package/3`（probe／
  concurrencyStress 两段随 v1 阶段退役，绑定核验不动）——evidence-packager.test.mjs；
  ④ evidence-runner 运行契约（回归→parity→真实面快照；raw `p6-5-probe-raw/3` 去探针
  CLI 绑定字段）——evidence-runner-contract.test.mjs；⑤ 门②真跑 preflight 验证
  （新序号包复绿）。连锁裁定（必要非可选）：probe CLI 是 evidence-runner／buildProbeRaw
  的硬绑定（执行闭包清单强制含 probe CLI），退役即 raw／包 schema 强制版本化 /2→/3；
  evidence-runner Phase 3 引用的 review-concurrency.test.mjs 已随 03 号票删除（证据链
  当前已断），一并修复。旧包只读保留、不覆盖。

- 2026-09-18 **resolved（实施与验证证据）**：
  - **实施**：`lib/sentinel-shadow.js`（新）原样承载 sentinel 在用面（O-3 布局单源＋
    canonical JSON 口径＋§5 I1–I4/E1–E5＋shadow 执行件；复审逐函数比对 SAME）；
    sentinel-runner／sentinel-provenance 导入重指向；退役两件＋矩阵测试
    （`git rm`）；parity-manifest 换入新件；`tests/review-enforcement-retired.test.mjs`
    退役扫描（活面零引用）。证据链修复：runner 阶段链＝回归→parity→真实面快照
    （Phase 3 断链随 03 号票在先、Phase 4 探针 CLI 随本票）；raw
    `p6-5-probe-raw/2→3`（去 probeCliHash/probeRuntimeClosure/probeScriptHash）、包
    `evidence-package/2→3`（必填收窄为 fullRegression/deploymentImpact/provenance；
    probe/concurrencyStress/treeDiff 缺省合法、若在仍验形状；七项绑定核验不动）；
    sentinel 三测试改打库接缝（进程内 executeShadow/executeRealSentinel，断言面保持）。
    PLAN P0.3 节首加废止标注、正文零改动。
  - **验证**：`TMPDIR=/dev/shm npm test` **43/43**；preflight 四门 ①回归 43/43
    ②冻结面（**0009 包 `review-evidence-package-0009-053b0565.json`**）**7/7** ③
    status-lint 0 违例（59 md）④宿主契约 11 PASS/0 FAIL/0 SKIP ＝ `preflight: PASS`；
    再生 runId `37067044-e158-45cc-a537-d1082d583c1f`（status completed、真实面
    clean、parity 6 漂移＝部署未同步的诚实记录，部署同步属出仓库动作待用户点名）。
  - **复审**：`/code-review` 两轴（Standards：落档硬项＝CHANGELOG 条目已补；
    judgement call 采纳 `runProbe`→`runRealSentinel` 改名；Spec：采纳接缝④补
    runner-contract /3 阶段链静态断言＋treeDiff 并入 /3 退役段）。
  - **观察项（不修，留档）**：p6-5 守卫测试由 spawn 真 CLI 改进程内库调用后，
    CLI 壳层的进程级故障注入（退出码映射）随之消失——CLI 已退役故无对应物；
    库侧 ProbeError.exitCode 断言等价承接。测试文件跨文件共用 env helper 不采
    （仓库测试文件各自独立惯例）。
