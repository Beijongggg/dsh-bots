# 36: 宿主同步自旋锁可用性（A9 host 事件循环冻结 3–6s）

**What to build:** 知识登记与邮件投递的跨进程锁是宿主事件循环内的同步自旋，锁争用
或陈旧锁时 DSH web 主进程的 HTTP、SSE、台账 ticker 被同一线程占住，最长数秒冻结。

现状（HEAD `d4c24e5` 现行坐标，29 号票独立复核确认；交接件两处细节已订正）：
调用链 `lib/org/ledger-host.js:508`（`await host.knowledgeRegister(…)`——有 await
但被 await 的是同步函数返回值，不缓解阻塞）→ `lib/index.js:2889-2892`
（同步箭头函数直调）→ `lib/knowledge.js:164`
（`acquireIndexLock`，`spinMs=6000, staleMs=3000, tickMs=20`）→ 199
（`Atomics.wait` 自旋）；`registerReport:261` 整段（读索引→分配 ID→写回）全同步
持有。邮件同型锁：定义 `lib/mail-seq-lock.js:23`（`spinMs=6000, staleMs=3000,
tickMs=5`，57 行 `Atomics.wait`），经 `lib/mail-plane.js:14／101`
（`appendMessage` 内同步调用），调用方 `lib/org/mail-relay.js:152`（host 进程内
执行；11 号票后每次投递都在 host 内执行）。单次争用最长约 6s（陈旧锁 3s 后接管）；
锁超时后转 `ok:false` 只处理“超时后”，不消除等待期的事件循环冻结。

**要定的事（开工时先定并写进 Comments，用户裁定先行）**：

1. 容忍度裁定：host 卡顿 3–6s 是否可接受（值守／SSE 场景）——不可接受才做 2，
   可接受则本票转观察（留界＋触发信号：锁等待超阈告警）。
2. 缓解形态（推荐渐进）：锁等待可观测先行（等待超阈 warn 留痕＋指标）→ 缩短
   `spinMs`／快进陈旧接管 → 长期 worker 化或异步锁（另票，不在本票预支）。
3. 邮件锁与索引锁是否同批（同型不同文件，可同口径）。

规格出处：10 号票 K-1（读改写互斥）与 11 号票（host 投递面唯一写者）。

来源：29 号票 A9（2026-09-20 只读审计交接，HEAD `d4c24e5` 独立复核确认）。

**Blocked by:** 无（但开工前需用户容忍度裁定，见上第 1 条）

**Status:** ready-for-agent

- [ ] 容忍度裁定完成（用户点名），结论落 Comments
- [ ] 可观测先行（锁等待超阈留痕，有用例或探针）
- [ ] 缓解参数／形态落地（按裁定），回退路径写明
- [ ] 全量回归与 preflight 四道门 PASS
