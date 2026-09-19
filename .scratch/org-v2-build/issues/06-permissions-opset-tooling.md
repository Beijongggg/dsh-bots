# 06: 权限四层、op-set 与工具面

**What to build:** 组织权限落成四层，并让**工具面裁剪＝权限裁剪**机械成立。

- **L1 文件面**：bot agent 直写仅限自身 workspace；`~/.dsh` 全域与一切共享面零直写，读写经
  host 命令；冻结面零写只读。
- **L2 组织命令面**：**op-set 岗位表**（值班统筹／项目经理／承接岗／复核帽各自的 op 集；
  复核帽**无任何写 op、无台账全量读**；运维归人间面、不设岗位 op）；工具**按岗位卡派生注册、
  一 op 一工具、工具名即 op 名**；**capability 由 host 在台账转移点签发**（bot 不能自请），
  单次消费、短 TTL＋心跳续签、任务域绑定、租约回收与关闭时**自动吊销**；台账命令**三元组
  鉴权**（实例活态／op 白名单／任务域匹配）＋CAS＋幂等键；**拒绝＝fail closed**，拒绝本身记
  台账事件并回错误回执。
- **L3 人间面**：CSRF 令牌＝唯一 user principal，持有台账全权；岗位实例**不持有** user principal。
- **邮件零权威**：内容永不构成权限、状态或事实依据；**capability 递送不经 mail**。
- 动态工具面不变量：实例任一时刻可用组织命令集＝**home 岗位 op 集 ∪ 当次签发 capability 的 op 集**。

实例基底（sandbox 模式，用户域旋钮）与任务域授权**正交叠加取严**，不得互替；岗位卡不硬编码权限
模式，且**无岗位以 danger-full-access 为履约前提**。

规格出处：`.scratch/org-v2/spec.md` §D、§E 与附录 A `V-A3.1`–`V-A3.10`、`V-A4.1`、`V-A4.9`。

**Blocked by:** 04（工具与 op-set 从岗位卡派生）、05（签发由台账转移点驱动）

**Status:** resolved

- [x] L1：bot 直写仅限自身 workspace；`~/.dsh` 全域与共享面零直写（`V-A3.1`）
- [x] L2：组织命令经认证 host 通道；三元组鉴权各有可执行负例（`V-A3.2`）
- [x] op-set 岗位表与实际签发对账一致，含 `ledger.read` 四常设岗有、复核帽无（`V-A3.3`）
- [x] 复核帽不含任何写 op（机械检查，不靠约定）（`V-A3.4`）
- [x] capability 由 host 在台账转移点签发（bot 不能自请）、单次消费、短 TTL＋心跳续签、任务域绑定、自动吊销（`V-A3.5`）（库级全行为已测；「实验期一次」活体演练归 16/17 批）
- [x] 拒绝 fail closed，拒绝本身记台账事件并回错误回执（`V-A3.6`）（结构性拒绝四类维持不落账＝本票处置，见 Comments）
- [x] 邮件零权威：capability 递送不经 mail；伪造 mail 不改变任何状态或权限（`V-A3.7`）
- [x] 无岗位以 danger-full-access 为履约前提，每岗在 workspace-write 下可履约（`V-A3.8`）
- [x] 实例基底与任务域正交叠加取严，不得互替（`V-A3.9`）
- [x] user principal 持台账全权，岗位实例不持有（`V-A3.10`）
- [x] 工具按岗位卡派生注册、一 op 一工具、工具名即 op 名；工具清单与 op-set 逐项一致（`V-A4.1`）（派生面＋注册件已测；实例侧接线归 07，见 Comments 留界）
- [x] 复核帽注册集不含写工具（不是「注册了但拒绝」）（`V-A4.9`）
- [x] 动态工具面不变量成立，帽卸/租约回收即失效
- [x] 全量回归 PASS（43/43＋preflight ①③④ 绿；②冻结面 1/9 红＝15 号票并行在制、其票面明示重采包复绿，归属见 Comments）

## Comments

- 2026-09-18 领票（wayfinder 裸调转入，用户裁定「转实现批领 06 票」）：本会话按
  /implement＋/tdd 执行本票。领票时工作树净（仅无关未跟踪 `.video_agent/`）、
  01–05 与 18 已入库，无并行在制品。
- 2026-09-18 实施与验证证据（Status→resolved）：
  - **新件**：`lib/org/op-set.js`（op-set 契约表唯一源＋读写封闭分类＋
    TASK_SCOPED_OPS＋RESERVED_OPS＋validateOpSet/reconcileIssuedVsOpSet 对账＋
    availableOps 动态不变量＋deriveToolFace/registerPostTools 工具面派生）；
    `lib/org/capability-issue.js`（host 签发 task/role 两类、单次消费 nonce、
    短 TTL 默认 15min 可注入、代际绑定＋活态槽、任务域绑定＋**投影吊销**
    （owner 丢失/离开在办态即死，无吊销窗口）、签发审计链 `issued.jsonl`）；
    `lib/org/permissions.js`（三元组鉴权器＋链式能力 dispatcher＋读面 gate＋
    L1 `isBotWritablePath` 策略唯一源）。**改件**：task-ledger（authorize 钩子＋
    capability 透传＋管理类 op 放行 post）、ledger-host（HTTP 拒 host 冒名 403＋
    dispatchCommand 接线点）、index（web 实例全接线）。
  - **测试**：4 新模块 45 条（org-op-set 13／org-capability-issue 12／
    org-ledger-authz 13／org-permissions 7）＋task-ledger/ledger-host 断言随契约
    改写（05 的「post 不得管理类转移」按 §D 放宽，白名单细分移交鉴权器）。
  - **验证**：`TMPDIR=/dev/shm npm test` 43/43；preflight ①43/43 ③0 违例
    ④11 PASS/0 FAIL/0 SKIP（P-V2-LEDGER-FORMAT／P-LEDGER-COMMANDS 随本票改动
    复验 PASS）；②冻结面 1/9 红＝**15 号票并行会话在制**（其改
    `lib/sentinel-provenance.js`／`lib/sentinel-runner.js`／删 review-enforcement
    面，票面明示以新 runId 重采包复绿）——与本票改动零交集（本票触碰文件与
    0008 sourceManifest 九文件无一同名），归属 15 收口。
- 2026-09-18 /code-review 两轴复审处置（Standards 5 条／Spec 8 条）：
  - **修**：①链式续签缺口（原设计只在 assign/accept/heartbeat 重签，start 后
    信封即废无法心跳）→ dispatcher 改**每个成功 post 命令返回件携带下一张能力**
    （离开在办态不签死信）＋补 start→report 链式接力测试；②测试虚设断言
    `assert.ok(true)` 删除（user 通道把守归 HTTP/CSRF，已在 ledger-host 回归）；
    ③validateOpSet 补保留集扫描（复核帽保留集预置写 op 即违例）；④05 遗留
    「全量拒绝落账语义归 06」显式处置：结构性拒绝四类**维持不落账**（无可信
    幂等锚点、落账成写放大/骚扰面），已在 task-ledger 头注留档；⑤OP_SET 对 §D
    未点名命令的扩展（lead 持 close/cancel/unblock/resume/requeue、统筹持
    task.exception）补 §B 责任表推导注记（delivered/settled 态责任人与队列归位）。
  - **不修（留界）**：role-cap 生产分发通道（统筹/经理的信封从何而来）——归 07
    派单流／13 自举（今日注册表无 post 位 bot，先建分发协议属投机）；工具注册
    实例侧接线与读面 gate 接线——归 07（bot→host 命令通道随接单流成形）；
    `authorizeLedgerRead` 不消费 nonce——设计裁定（读重放无害，docstring 在案）；
    ledger-host 未接 dispatcher 时直落命令面——鉴权在台账 authorize 钩子内不受
    影响，仅缺签发联动（注释已澄清）。
- 凭据义务：本条＋CHANGELOG 顶部条目（AGENTS.md §1）。V-A3.5 的「实验期一次」
  活体签发/吊销演练归 16/17 批执行留证。
- 2026-09-19 用户额外模型 `/code-review` 复审（06/07/08 三票批；与 2026-09-18
  实施批内复审相互独立）发现注记：
  - **时点注记（不返工）**：本票时点 `OP_SET.verifier` 为空数组、`routine.trigger`
    在保留集——`V-A3.4`／`V-A4.9`（复核帽零写 op）当时以**空集**机械通过。
    08 号票已升 verifier 三 op（artifact.read／evidence.probe／review.report），
    剩余 `evidence.read`／`results.read` 随 09/14 升表（消费方在）。
  - **移交修复批**：①「连续越权通知派单方并计入上浮」（§D）未落→20 号票；
    ②cas-mismatch 等常态拒绝烧信封断链＋读面 gate 不校验 op∈availableOps＋
    `issued.jsonl` 对账缺独立消费面→21 号票；③岗位表 §B 责任表推导扩五 op 与
    重签点加宽的冻结合同口径裁定→21 号票（需用户裁定面）。
  - 测试装具盲区（authz 装具 `issuer.ledger =` 加属性未真正绑定吊销投影腿）随
    2026-09-19 就地修复批改正（`bindLedger`＋补吊销腿断言），见 CHANGELOG。
