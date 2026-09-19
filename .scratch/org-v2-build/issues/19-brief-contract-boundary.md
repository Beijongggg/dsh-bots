# 19: 简报契约边界完整性

**What to build:** 四要素简报在台账边界的机械面收口——修改路径与判据缺口两条缝。
`task.amend` 是规格认可的简报修改路径（§B「派出即冻结，改动只走 amend 追加事件并
显式通知承接方」），但当前实现留有三道缝：置换简报可删减复核冻结点（「可加审不可
免审」只在 review.request 通道把守）；承接方持有简报只在 accept 响应时写入、
accepted/running 态 amend 后探针即永久 fail closed（合法修改路径被打成死路）；
amend 无显式通知承接方投影。判据缺口侧：criteria-gap 与结构违规共用同一拒绝码、
无 needs-user 上浮路径（§B「分解不出来标 needs-user 上浮」）。附带裁定
reviewPoints 整体省略＝零必审交付的口径（必填化 or 注记留派单方自觉）。

规格出处：`.scratch/org-v2/spec.md` §B（290–293 行）＋§C（318–320 行「可加审不可
免审」）；07/08 号票复审 Spec 轴发现（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** resolved

- [x] amend 置换简报删减已冻结 reviewPoints 被拒且回执可归因（免审禁在 amend 通道兑现）
- [x] accepted/running 态 amend 后承接方持有简报可刷新、evidence.probe 恢复可用
- [x] amend 显式通知承接方的投影在案（经查 05 号票复审②已在：NOTIFY_TO.amend→owner「通知任务在手者」；本票落 19① 回归断言为凭据）
- [x] 台账边界区分 criteria-gap 与结构违规（分拒绝码）
- [x] 判据缺口分解不出时标 needs-user 上浮 waiting-user 的路径在位
- [x] reviewPoints 省略口径有用户裁定并落档（2026-09-19 用户裁定＝注记留派单方自觉，见下）
- [x] 全量回归 PASS

## Comments

- 2026-09-19 用户裁定（AskUserQuestion，21 号票实施轮 `/implement` 授权内；本票**未实施**
  ——裁定先落档，供其实施批直接引用，清单第 6 条「有用户裁定并落档」据此已在案）：
  - **⑥ reviewPoints 整体省略口径＝注记留派单方自觉**：省略／空数组＝零必审交付**合法**；
    口径写进 `lib/org/brief.js` 头注＋`CONTEXT.md` 词条，**校验与模板不动**（不新增结构
    违规码、不改 dispatch-config 例程模板）。实施批落地时须同步这两处注记。
  - **⑤ 判据缺口的 needs-user 上浮形态＝扩枚举**：`ESCALATION_CAUSES` 新增一条 cause
    `needs-user`（§B 原词），判据缺口独立拒绝码 `criteria-gap`（与结构违规分码）；
    上浮入口照 `recordPreScreen` 同型（host 侧写 `escalated`，通知 user）。
    —— 该裁定系**封闭词表扩条**（09 号票「在案五条＋契约五条」之外的第 11 条），
    实施批须同步 `human-inbox.js` 头注与 `CONTEXT.md` 词条，并在 CHANGELOG 记明
    词表扩条的授权依据＝本条裁定。

- 2026-09-19 实施批凭据（`/implement`「继续修复」，21 号票入库 `3cb332b` 后领票；
  ⑤/⑥ 沿用上轮用户裁定）：①`brief.js` 新 `droppedReviewPoints`＋`task.amend`
  置换件删减/整体省略即拒（`review-exemption-forbidden`，回执逐点可归因）；
  ②`post-channel.js` 新 `brief.refresh` 读面 op（op-set 承接岗升表＋READ_OPS/
  TOOL_KIND 同步；只许当前归属者，刷新后 `probe-stale-brief` 解除、探针恢复）；
  ③通知投影凭据＝19① 回归断言（amend→承接方本人，05 号票复审②口径）；
  ④`briefRejectReason` 结构化为 `briefReject`：gap-only＝`criteria-gap`、结构
  违规＝`invalid-brief`、两类同时在案结构优先缺口仍可见（intake/plan/amend/
  assign 四处同口径）；⑤`ESCALATION_CAUSES` 扩条 `needs-user`（**授权依据＝
  2026-09-19 用户裁定**，21 轮 AskUserQuestion）＋`escalated` 来态扩 `triaged`
  ＋`recordNeedsUser` 门面（recordPreScreen 同型：锚定最近拒绝＝criteria-gap、
  judgement 留痕、escalated 通知 user、已挂起不重复）；⑥省略口径注记落
  brief.js 头注＋CONTEXT.md 两词条，校验与模板零改动。验证 scoped 106/106＋
  全量 50/50＋preflight 四门 exit 0。
- **留界两条**（机械口径已声明，非缺陷）：⑴`recordNeedsUser` 的锚定规则
  「最近一次拒绝须为 criteria-gap」对后续任何 command-rejected 覆盖
  `lastRejection` 脆弱——锚丢失时须重新触发一次缺口拒绝再上浮（fail closed
  方向，防通用挂起旁路）；⑵`recordNeedsUser` 生产触发面（谁代表承接流程调用）
  随 13/14 召集接线，同 `recordPreScreen` 留界口径。另注：`droppedReviewPoints`
  按 subject 集合语义判定（重复条目折叠＝collectReviewState 同口径，重复条目
  增减不改变必审集、不构成删减）。
