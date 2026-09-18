# 03: 退役评审业务面

**What to build:** v1 评审形态从**业务代码面**消失：16 个非冻结 `review-*` 模块及其测试删除；
插件入口的评审段（约 710 行）与前端 bundle 的评审子面（含 i18n 键）摘除。双席席位、13 stage
协议、提示层双审注入、enforcement 矩阵的业务引用一并消失。

本票**只动非冻结文件**——冻结面（0008 包 sourceManifest 的 9 个文件）零触碰，故 preflight 门②
全程保持绿；冻结面上的评审残余（enforcement 矩阵模块与探针脚本）归 15 号票处置，两者不可混做。

规格出处：`.scratch/org-v2/spec.md` §I（迁移工作清单第 3 项）、§C（形态废弃）。

**Blocked by:** 02（需先有共用件可消费，否则拆不出就删会连带删掉要保留的原语）

**Status:** resolved

- [x] 16 个非冻结 `review-*` 模块删除（40 文件 -13,324 行：16 模块＋21 个 review 测试＋
      discuss-mail 测试＋p6-4-verify 脚本与测试，见 Comments）
- [x] 其对应测试文件删除，回归入口文件数相应下降且全绿（62→39 个测试文件，39/39 PASS）
- [x] 插件入口评审段摘除，无残留引用、无孤立导入（lib/index.js 3,657→2,861 行）
- [x] 前端 bundle 评审子面与 i18n 键摘除（lib/client.js：`review.entry` zh/en、`reviewApi`、
      评审通知三件套、SSE `review` 监听与导出）
- [x] v1 形态痕迹清零：13 stage／双席席位／提示层双审注入／enforcement 矩阵无业务引用
      （双审两段提示注入、mail-discuss 续环、P3-1 误投守卫、P6-1 启动校验一并摘除）
- [x] 未触碰冻结面（0008 包 9 文件），preflight 门② 保持绿（9/9）
- [x] 全量回归 PASS（39/39；preflight 四道门全绿：①39/39 ②9/9 ③0 违例 ④11 PASS/0 FAIL/0 SKIP）

## Comments

### 实施注记（2026-09-18）

- **p6-4-verify 对随票删除**（票面删除清单外，依赖连带）：`scripts/p6-4-verify.mjs` 与
  `tests/p6-4-verify.test.mjs` 依赖已退役的 `lib/review-capability.js` 高层门面
  （issueCapability/checkCapability 等，02 号票只迁了原语层）；实例行五字段断言已由
  `tests/org-capability-base.test.mjs` 覆盖。org-v2 的 capability 验收归 06 号票重建。
- **P6-1 三路径启动校验随链退役**：`BotsApi.start()` 对 engineering 组的三路径校验件来自
  R2-11 宿主受信链（`createReviewJobTools` → 冻结 enforcement 面），属 v1 评审 job 形态；
  L1 文件权限面由 06 号票重建（`V-A3.8`）。03→06 之间为已知空窗。
- **冻结面悬空引用（归 15 号票）**：`scripts/evidence-runner.mjs`（冻结）Phase 3 spawn
  `tests/review-concurrency.test.mjs`（本票已删）。冻结面零触碰未改；15 号票处置前，
  真实全量证据采集须 `--skip-tests` 口径（preflight 门①②不走该路径，不受影响）。
- **mail-discuss 读侧容忍**：`lib/mail-plane.js` `inboxHasResponseTo` 保留对历史
  `kind:"mail-discuss"` 行的识别（防升级窗口重复回信）；写侧已无产出。
- 证据包命名（`review-evidence-package-*`，冻结证据链约定）与 `tests/review-enforcement-matrix.test.mjs`
  （测冻结件）不在退役范围，保持原样。
