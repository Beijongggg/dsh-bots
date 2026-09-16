# 02: 通用基座拆出

**What to build:** 把埋在评审面里的两块通用能力拆成**组织层共用件**，供任务台账与权限面复用：
capability 的签名/nonce/单次消费/账原语（原住评审 capability 模块）与 store 底座的锁／原子写／
audit／事件溯源／幂等键（原住评审 store 模块）。评审面改为消费新模块——**纯增量重构，行为与
语义不变**（单次消费、短 TTL、代际绑定等语义照旧）。这一步是「先让改动变容易」的前置：台账与
权限面随后直接长在共用件上，不再复制一套。

规格出处：`.scratch/org-v2/spec.md` §I（迁移工作清单第 4 项）、§C（原语保留并归位）、§D。

**Blocked by:** None（可立即开始）

**Status:** resolved

- [x] capability 原语（签名／nonce／单次消费／capability 账）成为独立组织层共用件（`lib/org/capability-base.js`）
- [x] store 底座（锁／原子写／audit／事件溯源／幂等键）成为独立组织层共用件（`lib/org/store-base.js`）
- [x] 既有评审面改为消费新模块，外部行为与语义不变（门面转发，全量回归绿）
- [x] 无重复实现残留（code-review 后三处收口：appendLedgerRecord→appendJsonlLine 转发、fsyncDirectory/pidAlive/safeBotId 单实现；`lib/review-results.js` 私有 appendJsonl 为评审面模块内部副本，随 03 号票退役消灭，不属共用件重复）
- [x] 未触碰冻结面（0008 包 sourceManifest 的 9 个文件），preflight 门② 保持绿（9/9 全程）
- [x] 全量回归 PASS（62/62）
