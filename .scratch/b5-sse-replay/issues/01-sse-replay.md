# 01: SSE 可重放（eventId＋Last-Event-ID＋有界 ledger＋兜底刷新）

**What to build:** web 断线重连后补上错过的事件——事件 hub 给每帧分配单调 id 并维护有界内存 ledger；重连读浏览器原生回传的 Last-Event-ID，窗口内先补发错过事件再接实时；超窗/未知 id 发兜底全量刷新事件（首连统一走此路径初始化）。客户端零协议改动（EventSource 原生携带）。

**Blocked by:** None（可即行）。

**Status:** resolved（2026-09-07）

**Parent spec:** `../spec.md`

- [x] 帧级断言：订阅收到带 `id:` 的帧且 id 单调；心跳注释帧不带 id、不推进序号（桩 setInterval 直接触发心跳帧断言原文 `: ping`）
- [x] 断开→广播→携 Last-Event-ID 重连：先按序收补发再接实时
- [x] 超窗/未知 id：收兜底刷新事件，且不含已淘汰旧事件；ledger 条数上限生效（260 广播→断层 id=3 reload、边界 id=4 恰补 256 条）
- [x] mail-notify 消费方回归不受帧格式增量影响（mail-notify.test.mjs 全绿；mail 帧仍同 chunk 含 `event: mail` 可过滤）
- [x] 全量回归保持基线＋冻结面零触碰（53/53×2；0008 sourceManifest 9/9 sha256 一致）

**Evidence（2026-09-07）:** 实施记结见 `../spec.md` Comments；副审独立复核通过（A~G 七项，无必改项）。改动面：lib/index.js（createSseHub 单调 id＋ledger＋replayAfter／sseEndpoint Last-Event-ID＋reload 兜底）、lib/client.js（reload→onBots 接线）、tests/events.test.mjs（＋7 用例）。
