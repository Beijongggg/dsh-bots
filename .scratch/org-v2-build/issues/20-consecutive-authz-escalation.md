# 20: 连续越权计数与上浮

**What to build:** 权限拒绝 fail closed 之上的 §D 完整语义落地：「拒绝＝fail closed
不执行……连续越权通知派单方并计入上浮」。当前实现拒绝回执在案但无连续越权计数、
无派单方通知、无上浮联动。本票补：同一岗位实例连续越权的计数落点（拒绝回执链可
数、阈值注入缝）、达阈通知派单方投影、计入 waiting-user 上浮通道。

规格出处：`.scratch/org-v2/spec.md` §D（366 行）；06 号票复审 Spec 轴 (a)1
（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** resolved

- [x] 连续越权计数落点在位（按岗位实例、拒绝回执链可数、阈值可注入）
- [x] 达阈通知派单方投影在案
- [x] 与 waiting-user 上浮通道联动
- [x] 间歇合法操作后计数口径明确（连续＝trailing 连续，照复核两轮上浮同型纪律）
- [x] 全量回归 PASS

## Comments

- 2026-09-19 互指注记（09 号票实施批留痕）：09 号票（人间接口，已 resolved）已在
  **投递面告知投影**落一份连续越权计数原语——`lib/org/human-inbox.js` 的
  `noticesFrom`（口径＝trailing 连续、被角色类拒绝或异常打断即重置，与本票第 4 条
  同型）；`UNAUTHORIZED_CODES` 词表（能力面五个拒绝码）同处。本票落 §D 侧
  （阈值注入缝、达阈通知派单方投影、计入 `waiting-user` 上浮通道）时，**先提取
  共用原语再接线**（02 纪律：同一原语不得两处各留一份）；若口径需分叉，须在本票
  写明分叉理由并同步 09 号票的告知投影。
- 2026-09-19 实施批凭据（本票 resolved；CHANGELOG 对应条目）：
  - **共用原语提取**＝`lib/org/run-count.js` `trailingRunSteps`（单遍折叠，count/
    ignore/reset 三动作）；09 告知面 `noticesFrom` 已改接同源，行为保持由既有
    17 条测试原样锁定。能力码归类核心亦提取共用（`classifyCapabilityFaceRejection`，
    双分类器同一份）。
  - **键维分叉注记**：09 告知面按**任务链**（用户收件箱对单任务越权链的可见性）、
    本票按**岗位实例链**（§D 处置语义锚定行为者，跨任务串可数）——同一折叠原语的
    两种键维配置，折叠语义与归类词表单源，**非语义分叉、09 侧投影零改动**，无需
    同步改 09。
  - **上浮联动**＝台账 sweep 落 `escalated` cause=out-of-bounds（09 号票预冻词表
    兑现；`userRulingRequirement` 随投影判永不可代＝out-of-bounds-handling）；
    来态限在手四态＝`ALLOWED_FROM.escalated` 白名单内合法转移。每越权串至多一次
    **双锚点**＝串内本面上浮事件（模块守卫）＋通知幂等预留（sweep 侧守卫，覆盖
    无在手任务的零事件路径）。
  - **通知派单方投影裁定**：投影随 sweep 结果由值守日志回报＋SSE `ledger` 广播；
    **不造 mail 投递面**——票面措辞「投影在案」照办，mail 属投递面节律（§F），
    本票不扩投递面。
  - **阈值**＝`LEASE_DEFAULTS.unauthorizedThreshold`（缺省 3，`lease.
    unauthorizedThreshold` 注入；口径同 `redispatchCap` 用户域缝）。
  - **/code-review 双轴**（Standards 硬违例 0/judgement 6；Spec 缺失 1/不符 1）
    全处置：修＝分类器核心提取共用件、sweep 腿读面一次读定透传、sweep docstring
    补越权腿、无在手串通知锚点（Spec 轴隔离探针实证每拍重发洞）；留＝run-count
    `runs` 返回值（契约面，串界 firstSeq/lastSeq 载体）、`swept.unauthorized?.
    length` 防御（与 ticker 既有 `?? []` 风格一致）、run-count 动作词表行内字面量
    （回调内契约）——理由在案。
  - **验证**：TDD 四缝（原语／计数投影／sweep 腿／tick 接线，经用户确认）scoped
    15/15＋全量 51/51＋preflight 四门 exit 0（①51/51 ②0009 包 7/7 ③0 违例扫
    64 md ④11 PASS/0 FAIL/0 SKIP）。
- 2026-09-19 用户额外模型 `/code-review` 复审（09＋19–23 六票批）发现注记：
  本票「达阈**通知派单方**」落地＝sweep 返回值＋值守日志 warn＋SSE 广播，
  `NOTIFY_TO.escalated→"user"`——派单方无台账事件投影收件通道；无在手任务
  路径连台账事件都没有（仅日志行＋幂等预留）。与 spec.md §B「通知＝台账事件
  投影，无事件不通知」口径相悖。→ **24 号票①收口**（补事件投影通道或显式
  修订 §B 口径，经用户裁定）。
