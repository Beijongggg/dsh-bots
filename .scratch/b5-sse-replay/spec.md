# B5：SSE 可重放（单调 eventId＋Last-Event-ID＋有限窗口 ledger＋兜底刷新）

Status: done（2026-09-07 实施＋副审复核通过，见 Comments）

- **来源**：PLAN §十一 B5 行（2026-09-05 用户确认的 B1~B5 路线图）。
- **排程**：待用户点名启动（B4 之后顺位）。

## Problem Statement

`GET /api/bots/_events` 的 SSE 事件流没有事件标识，也没有重放：浏览器断线
重连（EventSource retry 3000ms）后，断线窗口内广播的事件永久丢失，UI 停在
旧状态直到下一次任意变更。夜间挂机、网络抖动、host 重启等场景下，界面可能
长时间陈旧，用户看到的是撒谎的状态面（例如显示 bot 在线而实际早已退出）。

## Solution

事件 hub 给每个广播帧分配单调递增 eventId（SSE `id:` 行）并维护有界内存
ledger（环形缓冲）；重连时读浏览器原生回传的 `Last-Event-ID` 请求头，窗口
内先补发错过的事件再接实时流；超窗/未知 id 发一个约定的全量刷新事件兜底，
客户端沿现有刷新路径自愈。客户端零协议改动（EventSource 原生携带
Last-Event-ID）。

## User Stories

1. 作为 web 使用者，我希望短暂断网/切后台后回来 UI 能补上错过的事件，以免基于陈旧状态做操作。
2. 作为 web 使用者，我希望错过窗口超出 ledger 上限时收到明确兜底（全量刷新），以免半新半旧的混合状态。
3. 作为 web 使用者，我希望重连后若什么都没错过就无感继续，以免无谓的全量闪烁。
4. 作为 API 消费者，我希望每个事件带单调 id，以便自定义客户端做精确去重与游标记录。
5. 作为 bot 运维者，我希望事件 ledger 有界（条数上限），以免 host 长跑内存无界增长。
6. 作为 bot 运维者，我希望心跳/超时/坏连接清理行为不变，以免重放改动拖累现有连接生命周期。
7. 作为 mail 用户，我希望 `mail` 事件推送与重放兼容（错过的新邮件通知也能补上），以免通知面成为重放盲区。
8. 作为审计者，我希望重放语义有回归断言（补发/兜底/单调/上限），以免后续改动漂移。

## Implementation Decisions

- **hub 层实现**：createSseHub 分配单调序号、每帧附 `id:` 行、维护有界环形
  缓冲（条数上限量级 256，"有限窗口 ledger"）。广播 choke point 不变
  （writeRegistry 单点广播先例），只加帧格式与缓冲。
- **重连协议**：sseEndpoint 读 `Last-Event-ID` 头——值在窗口内：先按序补发
  其后事件再接实时；值超窗/未知/缺省（首连）：发约定的全量刷新事件
  （如 `event: reload`，data 空）后接实时流。首连也发 reload 可作为统一
  初始化路径（客户端现有全量刷新逻辑即初始化逻辑，避免两套）。
- **cursor/ack 口径**：服务端只维护有界内存窗口，不做每客户端持久 ack；
  落盘 ledger/跨重启重放不在本批（内存版先行，接口形状留出升级余地）。
- **客户端**：client.js 改动最小化——EventSource 原生带 Last-Event-ID，
  仅需把 `reload` 事件接到现有全量刷新函数（若 UI 已有对应处理则零改动）。
- **GET 只读面不经 CSRF 门**（与现状一致）；`_events` 仍走独占协议分支，
  不进 JSON 分发。
- **冻结面**：只动 lib/index.js（hub/端点）＋client.js 最小接线；
  9 文件 sourceManifest 零触碰。

## Testing Decisions

- 好测试只断言帧级外部行为（wire format），不断言内部缓冲结构：
  - 订阅→收到带 `id:` 的帧且 id 单调；
  - 断开→广播 N 条→携 Last-Event-ID 重连→先收到那 N 条补发再接实时；
  - 重连 id 超窗→收到兜底刷新事件且不含已淘汰旧事件；
  - 广播超过上限后旧事件被淘汰（补发不越过窗口起点）；
  - 心跳帧（`: ping`）不带 id、不推进序号（注释帧不参与重放语义）。
- **seam**：零新缝——createSseHub/sseEndpoint 已在 index.js `internals`
  导出面，tests/events.test.mjs 既有 hub 单元＋handleApi 端点直测两层先例
  照用；mail-notify.test.mjs 回归确认 `mail` 事件消费方不受帧格式增量影响。
- **客户端半边**：若 client.js 需接 `reload`，则借架构候选 4 的导出面
  （needs-triage 另立）或以最小 DOM 层验证——本批不强制，实施时按实际
  改动面定。

## Out of Scope

- 跨重启事件持久化（落盘 ledger）、多 host 扇出。
- WebSocket/其他推送协议替代。
- 事件按类型分级订阅（type filter）。

## Further Notes

- 完成后：CHANGELOG 顶部条目＋PLAN §十一 B5 行收口＋本 spec Comments 记结；
  部署沿 C2 流程。
- 依赖序：无硬依赖，可与 B4 并行实施，但部署建议同链点名。

## Comments

- **2026-09-07 实施记结（编码方＋主审，副审独立复核通过）**：
  - **hub（lib/index.js createSseHub）**：广播帧前置 `id: N` 行（seq 自 1
    单调）；有界 ledger＝数组环形淘汰（`SSE_LEDGER_LIMIT = 256`）；新增
    `replayAfter(rawId)`（窗口内＝最旧保留 id−1 ≤ lastId ≤ seq → 按序错过
    事件列表，空数组＝无错过无感接实时；非整数/`<1`/未来 id（服务重启重置）/
    淘汰断层 → null＝兜底）＋`formatEvent` 导出。心跳注释帧不走广播，
    结构上不占序号。
  - **端点（sseEndpoint）**：读 `last-event-id` 头（EventSource 原生回传，
    零客户端协议改动）→ `replayAfter` 判定；null 发 `event: reload\ndata:
    {}\n\n`（首连统一初始化路径）；窗口内先按序补发再订阅接实时（补发与
    订阅间同步代码无广播间隙，不漏不重）。
  - **客户端（lib/client.js 最小接线）**：`es.addEventListener("reload",
    onBots)` 复用现有全量刷新（含成对 removeEventListener）。
  - **测试**：tests/events.test.mjs ＋7 用例（14/14）——帧格式跨类型单调／
    首连 reload 兜底帧无 id／断线补发先序后实时／无错过零帧无 reload／
    非法与未来 id 兜底／窗口上限（260 广播后 id=3 断层→reload、id=4=起点
    −1→恰补 256 条不含已淘汰）／心跳帧（桩 setInterval 立即触发）原文
    `: ping` 不带 id 且序号不推进。全量 53/53×2；冻结面 9/9 零触碰
    （0008 sourceManifest 逐一 sha256）。
  - **边界（测试过程修正）**：窗口边界用例初版把 lastId=窗口起点−1 误判为
    断层——该点错过集恰为整窗、应完整补发；实现正确，改断言（id=3 才是
    断层）。
  - **副审独立复核（2026-09-07）**：A~G 七项审查全通过，无必改项；两条
    非阻断建议——①心跳直接断言（已本批带走，桩 setInterval 实现）；
    ②首连 open＋reload 双 refreshBots 可优化（留界登记
    PROJECT_UNDERSTANDING「仍可选题」，本批保留：兼容旧服务器无 reload
    的基线语义）。
  - **连带**：index.js 头部行数计数 3,552→3,589（模块数仍 34）；改动面
    仅 lib/index.js／lib/client.js／tests/events.test.mjs 三文件。
    PLAN §十一 B5 行已收口；部署沿 C2 流程待点名（建议与 B3/B4 部署批
    同链）。
