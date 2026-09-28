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

## Comments

### 2026-09-28 开工口径

授权依据为用户指令 `/implement 36`，以及开工前 AskUserQuestion 四项裁定
（①容忍度＝不可接受、本票做缓解；②缓解形态＝可观测先行＋参数收紧＋死锁快路；
③邮件锁与索引锁同批同口径；④在途遗留批次先分别独立提交）。第二轮
AskUserQuestion 确认 TDD 接缝（①`acquireIndexLock` ②`acquireMailSeqLock`
③`registerReport`／`deprecateReport` ④邮件中继 HTTP 面＋知识命令 HTTP 面）。
`Blocked by` 无；容忍度裁定已落，可开工。

1. **容忍度：不可接受。** host 事件循环 3–6s 冻结期间 HTTP、SSE 与台账 ticker
   同线程被占（值守场景不可用），按第 2 条实施缓解，不转观察。
2. **缓解形态＝渐进落地（不做长期形态预支）：**
   - ①可观测先行：锁等待超阈（默认 `warnMs=100`）经宿主 `logger.warn` 单行留痕，
     字段 `lock= waitMs= outcome= takeover= holderPid= dir=` 可解析（即指标）；
     陈旧／死主接管与超时**无条件留痕**（低频关键信号），亚阈快路径零告警
     （不制造噪声）。**不新增文件面**——知识库根顶层级是封闭枚举
     （`V-A7.5` 禁第三面），故留痕走宿主日志而非新指标文件。
   - ②参数收紧（两锁同一常量）：`spinMs` 6000→**1500**（单次冻结上限≈1.5s）、
     `staleMs` 3000→**1000**（慢路接管快进）、`tickMs` 两锁并轨为 **10**；
     保持 `spinMs > staleMs`——慢路仍能在 spin 窗口内完成一次陈旧接管自愈，
     不因收紧退化为永久待锁。
   - ③死锁快路：接管判定前先看 `owner.json` 的 `pid` 是否存活
     （`process.kill(pid, 0)`；`ESRCH`＝已死）——已死**立即可接管**，把最常见的
     一次性 3s 等待降到毫秒级；pid 存活／缺失／不可读一律维持原保守语义
     （等 `staleMs`，超时则 `ok:false` 可重试）。pid 复用不构成永久死锁——快路
     只是新增触发条件，从不取代慢路。rm 前二次观测同一 `ino` 才删，收窄
     「删掉接管者新锁」窗口（K-1 互斥不因快路退化）。
   - ④worker 化／异步锁属长期形态，**另票**，不在本票预支。
3. **同批范围：两个同型锁一起收口。** 协议抽为单一实现 `lib/lock-dir.js`
   （lockdir 互斥：mkdir 原子获取／owner.json／短自旋／陈旧接管／保守释放），
   `lib/knowledge.js` 与 `lib/mail-seq-lock.js` 薄委托——导出面、锁目录位置与
   既有「锁超时」文案不变，同一协议不再两份拷贝漂移。
4. **回退路径：** 参数与快路都收在 `lib/lock-dir.js` 单文件（默认常量＋接管
   判定分支）；回退＝把 `LOCK_DEFAULTS` 改回 6000／3000 或还原接管判定，
   调用点无需改动。按次覆盖仍可用 `{spinMs, staleMs, tickMs}`（现有测试即用
   此能力），故回退不需要新增配置面。

TDD 四缝（vertical slice，先红后绿；行为经公开接口断言）：

- 缝①／② 锁公开面（`acquireIndexLock`／`acquireMailSeqLock`）：快路径零等待
  且不回调；争用超阈回调恰一次（带 `waitMs`／`takeover` 指标）；超时抛既有
  「锁超时」文案＋回调 `outcome=timeout`；**死主锁在 `staleMs` 未到时即接管**
  （用 `staleMs: 60000` 关掉 mtime 慢路，获取成功本身即证快路）；活主与归属
  不明（owner 缺失）都不抢（同参数下超时且锁目录仍在）。
- 缝③ 登记面（`registerReport`／`deprecateReport` 传 `logger`）：死主接管经
  `logger.warn` 留痕；亚阈快路径零告警。
- 缝④ 邮件中继 HTTP 面（`createMailRelay({logger})` ＋ `POST /_mail/send`）：
  锁留痕经 relay logger 出栈（与 35 票同口径）。
- 缝⑤ 知识命令 HTTP 面（ledger-host 夹具，与生产同形装配）：`op=knowledge.register`
  经 host 执行体留痕。
