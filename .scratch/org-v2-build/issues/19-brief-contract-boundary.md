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

**Status:** ready-for-agent

- [ ] amend 置换简报删减已冻结 reviewPoints 被拒且回执可归因（免审禁在 amend 通道兑现）
- [ ] accepted/running 态 amend 后承接方持有简报可刷新、evidence.probe 恢复可用
- [ ] amend 显式通知承接方的投影在案
- [ ] 台账边界区分 criteria-gap 与结构违规（分拒绝码）
- [ ] 判据缺口分解不出时标 needs-user 上浮 waiting-user 的路径在位
- [ ] reviewPoints 省略口径有用户裁定并落档
- [ ] 全量回归 PASS

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
