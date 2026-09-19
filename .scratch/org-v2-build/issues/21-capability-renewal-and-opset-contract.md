# 21: capability 续签、读面 gate 与岗位 op 集合同口径

**What to build:** 权限面三收口＋一裁定。
①续签断链修正：授权通过但命令被拒（cas-mismatch 等常态拒绝，§D「不符即拒」）
当前即烧掉信封且不续签，授权链需 host 干预才能恢复——续签条件从「命令成功」修正
为「授权有效且信封已消费」或等价口径，短 TTL＋链式续签意图（§D 359–361）自洽。
②读面 gate 补第二腿：authorizeLedgerRead 只验信封有效性、不校验
ledger.read ∈ availableOps——补齐后 §E「工具面裁剪＝权限裁剪」在读面成立。
③对账独立消费面：issued.jsonl 审计链当前仅测试内对账（V-A3.3 证据列＝「对账
脚本｜回归记录」两项，前者缺）——补巡检脚本或接线。
④合同口径裁定（需用户明示，冻结纪律）：实现按 §B 责任表推导扩了 §D 封闭列举外
的五 op（task.close/cancel/unblock/resume/requeue＋task.exception）；续签点从
「转移点」加宽到「每成功 post 命令」。修订冻结合同 or 推导注记升格，二选一落档。

规格出处：`.scratch/org-v2/spec.md` §D（350–366 行）＋§E（386 行）；06 号票复审
Spec 轴 (a)3/(b)1/(b)2/(c)1/(c)2（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** resolved

- [x] cas-mismatch 后授权链可续（不依赖 host 干预重签），行为有测试锁定
- [x] 读面 gate 套腿二（ledger.read ∈ availableOps）
- [x] issued.jsonl 对账有独立消费面（脚本/巡检接线）
- [x] 岗位 op 集与续签点的合同口径经用户裁定并落档（修合同 or 注记升格）
- [x] 全量回归 PASS

## Comments

- 2026-09-19 用户裁定（AskUserQuestion，本轮 `/implement` 授权内）：④＝**推导注记
  升格**（spec §D 文本不动；岗位 op 集以 op-set 表为唯一源、续签点＝每个授权有效的
  post 命令）。同轮范围裁定：本轮只领本票（19/20/23 待下批）。TDD 接缝预核经确认：
  三缝＝①命令面 `createLedgerCommandDispatcher` 返回值、②读面 `authorizeLedgerRead`
  返回的 readGate、③对账脚本 CLI＋子进程退出码；并批准 ① 的修正面**两面一并收口**
  （复核面同缺陷同口径）。
- 2026-09-19 实施批（本票落地）：
  - **①续签条件修正**：`lib/org/task-ledger.js` 命令面拒绝出口统一为 `rejectHere`
    （37 处收束；鉴权门之前的拒绝与之后同走一口，标记按第 4 条规则加），拒绝回执新增
    `authorized: true`——**只加在鉴权门之后的拒绝**上（授权有效且岗位信封已被本命令
    单次消费），只入回执、不进事件负载（事件 schema 键封闭）；`lib/org/permissions.js`
    dispatch 续签判据从「命令成功」改为「成功 ∪ 授权通过而被拒」，鉴权门之前的拒绝
    （角色不符／鉴权失败／结构校验）不续签。复核面 `lib/org/ledger-host.js` 同口径：
    帽续签条件改为「帽 gate 已通过」——报告被台账拒绝（`review-not-requested` 等）也
    续签帽，gate 自身拒绝（未携帽／非本人／未被指定）不续签。
  - **②读面腿二**：命令面与读面共用新原语 `postCapabilityVerdict`（信封在场→形状→
    验签→home 岗位解析→`op ∈ availableOps(home, 信封)`），读面 `consumeNonce:false`
    且不绑任务域；口径＝**并集**（home 岗位表 ∪ 当次信封）。
  - **③对账面**：新件 `scripts/capability-issued-audit.mjs`（`--dsh-home`，退出码即
    结论）＋新测试 `tests/capability-issued-audit.test.mjs`（子进程取退出码；不新起
    第五道门，随全量回归门执行）。两层＝结构层（缺字段／空 op 集／重复 jti／kind 枚举／
    kind↔taskId↔op 集切分，`tableOpsForKind` 与签发面同一源）＋表对账
    （`reconcileIssuedVsOpSet`）。`op-set.js` 新导出 `tableOpsForKind`（`capability-issue.js`
    内部重复实现删除）、`capability-issue.js` 导出 `issuedAuditFile`（审计链落点单一源）。
  - **④口径升格**：`op-set.js` 头注升格为裁定口径、续签点口径落 `CONTEXT.md`
    「能力（capability）」词条＋`permissions.js` 头注；spec §D 未动（历次验收凭据不失效）。
  - **验证**：`tests/org-ledger-authz.test.mjs` 17/17（两新测试：cas-mismatch 后链可续
    ＋续签件独立可用；越权拒绝不续签且旧件已消费——该边界测试经临时放宽续签条件验证
    敏感度＝转红）；`tests/ledger-host.test.mjs` 12/12（报告被拒也续签帽＋续签帽可连报
    ＋无帽不续签）；`tests/capability-issued-audit.test.mjs` 4/4；全量
    `TMPDIR=/dev/shm npm test` 50/50；preflight 四门 exit 0。
  - **复审**：`/code-review` 双轴并行（Standards 硬违例 2／judgement call 3；Spec 缺失
    2／越权 0／不符 1）全处置——四文件续签措辞同步、两出口合一 `rejectHere`＋
    `authzCleared` 更名 `authorized`、命令面/读面腿二抽取共用原语、对账面补
    kind↔taskId↔op 集切分（复审给出的 `taskId:"not-a-task-id"` 假绿例已入测试锁定）＋
    审计链落点单一源、读面注释不再过度断言（见留界 b）。
- **留界（登记在案，不属本票范围）**：
  a) 岗位表内**无任务域 op** 者（值班统筹／项目经理）不在续签链上（`reissueFor` 无任务
     能力可签）——其角色能力分发通道按 06 票面留界「role-cap 分发通道归 07/13」在案
     （07 已入库；13 号票 checklist 未见该面点名，本票不追改归属，只如实指留界链）；
     `CONTEXT.md` 词条已同口径注明。
  b) 读面腿二今日的**拒绝面**只在「home 岗位表不含 `ledger.read`」的形状下成立（常设
     四岗表皆含该 op；装具以 verifier 为 home 构造；并集口径的另一面＝承接岗持复核面
     信封仍放行，已有断言）。**路由接线不在本票**：通用 `GET /api/bots/_ledger` 按设计
     是 localhost 公开读投影（06 票面留界「工具与读面 gate 实例侧接线归 07」，07 留界⑥
     转 08——08 已以复核移交路由兑现其「真消费方」，本票只补 gate 的 op 白名单腿）。
  c) 续签闸门＝任务存在且 `∈ ACTIVE_CAP_STATES`：离开在办态者签了也是死信（照既有
     「不签死信」口径）；`ledger-corrupt` 罕见路径在鉴权门后却不成 reject 事件（不可读
     台账上无法落账），且闸门经 `taskStatusOf` 读面 fail closed＝不续签，实际行为自洽。
  d) 幂等重放（`replayed`）不重签——既有口径不动（被拒命令的重放同样不重签，重放件不
     携带新信封）。
