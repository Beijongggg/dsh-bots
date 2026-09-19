# 20: 连续越权计数与上浮

**What to build:** 权限拒绝 fail closed 之上的 §D 完整语义落地：「拒绝＝fail closed
不执行……连续越权通知派单方并计入上浮」。当前实现拒绝回执在案但无连续越权计数、
无派单方通知、无上浮联动。本票补：同一岗位实例连续越权的计数落点（拒绝回执链可
数、阈值注入缝）、达阈通知派单方投影、计入 waiting-user 上浮通道。

规格出处：`.scratch/org-v2/spec.md` §D（366 行）；06 号票复审 Spec 轴 (a)1
（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** ready-for-agent

- [ ] 连续越权计数落点在位（按岗位实例、拒绝回执链可数、阈值可注入）
- [ ] 达阈通知派单方投影在案
- [ ] 与 waiting-user 上浮通道联动
- [ ] 间歇合法操作后计数口径明确（连续＝trailing 连续，照复核两轮上浮同型纪律）
- [ ] 全量回归 PASS

## Comments

- 2026-09-19 互指注记（09 号票实施批留痕）：09 号票（人间接口，已 resolved）已在
  **投递面告知投影**落一份连续越权计数原语——`lib/org/human-inbox.js` 的
  `noticesFrom`（口径＝trailing 连续、被角色类拒绝或异常打断即重置，与本票第 4 条
  同型）；`UNAUTHORIZED_CODES` 词表（能力面五个拒绝码）同处。本票落 §D 侧
  （阈值注入缝、达阈通知派单方投影、计入 `waiting-user` 上浮通道）时，**先提取
  共用原语再接线**（02 纪律：同一原语不得两处各留一份）；若口径需分叉，须在本票
  写明分叉理由并同步 09 号票的告知投影。
