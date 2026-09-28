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

**Status:** resolved

- [x] 容忍度裁定完成（用户点名），结论落 Comments
- [x] 可观测先行（锁等待超阈留痕，有用例或探针）
- [x] 缓解参数／形态落地（按裁定），回退路径写明
- [x] 全量回归与 preflight 四道门 PASS

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

### 2026-09-28 实施与验证

- `lib/lock-dir.js`（新，共享核心）：lockdir 互斥协议**单源**——`mkdir` 原子获取
  ＋`owner.json`；短自旋（`tickMs`）；接管两条判据（①`owner.json` 的 pid 已死
  〔`kill(pid,0)` 报 `ESRCH`〕→ **立即可接管**＝死主快路；②目录 mtime 超
  `staleMs` → 兜底 pid 存活／归属不可读）；rm 前二次观测同一 `ino` 复核；释放
  只认本进程 pid；超时抛 `LOCK_TIMEOUT`。缺省参数
  `LOCK_DEFAULTS = { spinMs: 1500, staleMs: 1000, tickMs: 10 }`（两个锁同一常量
  ＝回退单点；保持 `spinMs > staleMs`）。
- `lib/lock-trace.js`（新，留痕策略）：`LOCK_WAIT_WARN_MS=100`；`formatLockWait`
  单行 `lockId/waitMs/outcome/takeover/holderPid/dir`（即指标）；`lockWaitSink(logger)`
  ——超阈／接管／超时留痕、亚阈与无 logger 静默。**不新增文件面**（知识库根顶层
  级是封闭枚举，`V-A7.5` 禁第三面）。
- 接线：`lib/knowledge.js` 的 `acquireIndexLock` 改薄委托、`registerReport`／
  `deprecateReport` 接 `logger`；`lib/mail-seq-lock.js` 同型薄委托；
  `lib/mail-plane.js` 的 `appendMessage` 第 4 参 `{logger}`（消息键封闭不变）；
  `lib/org/mail-relay.js`（投递面）与 `lib/index.js`（知识命令执行面）接宿主
  `ctx.logger`。
- **口径订正**（开工口径记「既有「锁超时」文案不变」）：超时文案统一为
  `<锁名>超时（<spinMs>ms 内未获得）`——索引锁与旧版**逐字一致**；邮件锁去掉
  尾部 `：<锁目录>`，宿主绝对路径不再进消息（锁目录随留痕行 `dir=` 落账，而
  超时无条件留痕，信息不丢）。两锁句柄新增 `{waitMs, tookOver}` 指标（加性）。
- 用例（先红后绿）：`tests/lock-dir.test.mjs` 新 14 条（参数单源；快路径零等待
  零回调；死主快路〔`staleMs: 60_000` 关掉慢路，取得锁本身即证快路〕；活主与
  归属不明都不抢；mtime 慢路保留；保守释放；超时文案与句柄字段；留痕字段与
  阈值策略；**接管删除持续失败不得紧循环**〔隔离子进程＋`EACCES` 夹具〕；
  **留痕出口抛错不得成新失败点**）；`tests/knowledge.test.mjs` 4 条（模块面死主
  快路、登记／废弃留痕、默认冻结上限 1.5s 实测）；`tests/jsonl.test.mjs` 锁块补
  死主快路＋`appendMessage` 留痕；`tests/org-mail-relay.test.mjs`（`POST /_mail/send`）
  与 `tests/ledger-host.test.mjs`（`op=knowledge.register`）各 1 条 HTTP 面留痕，
  夹具与生产装配同形。夹具 `tests/helpers/dead-pid-fixture.mjs` **共用一份**
  （消四份手抄）。
- 验证：专项 lock-dir 14/14、knowledge 38/38、jsonl 全通过、mail-relay 18/18、
  ledger-host 20/20；全量 `npm test` **70/70**；`npm run preflight` **四门 PASS**
  （①70/70 ②0010 包冻结面 10/10 ③0 违例 ④宿主契约 11 PASS／0 FAIL／0 SKIP）。
  计数口径：本票树直接 `npm test` 3 次（实现后／快照前／处置后）全绿；preflight
  2 次（处置前、处置后各一）均 PASS，**末次即本提交终树**；无未复现抖动。
- 复审（`/code-review` 双轴，固定点 `842b136`，评审快照 `4e4bbfd`，仅审本票差异）：
  - **Spec**：越权 0、不符 0；实现错误 **1 已处置**——`takeOverAbandoned` 曾把
    `rmSync` 失败与「已被他人删除」同路返回 `gone:true`，而 `continue` 跳过
    deadline 与 sleep，删除持续失败（EACCES／EBUSY）时成**无 sleep、无超时的
    紧循环**（比本票要消除的数秒冻结更糟）。修法：删除失败一律 `gone:false`
    落回自旋＋deadline，并令 deadline 判定**先于任何 `continue`**（任何循环路径
    都受 `spinMs` 封顶）；补隔离子进程回归用例（先红：子进程被 20s 超时强杀；
    后绿）。另处置「留痕可成新失败点」：`report()` 吞留痕出口异常（取锁结论与
    `LOCK_TIMEOUT` 不被顶替），补用例。
  - **Standards**：硬违例 0（原报两条落档项在本提交前成立，已由本节与当月日志卷
    事件闭合）；判断项 4——`deadPid` 四份拷贝→已抽共享夹具；`lock`／`label`
    命名歧义→已改名 `lockId`／`label`（留痕字段同步 `lockId=`）；六字段抱团
    （Data Clumps）→保留（该记录型本身即留痕字段契约）；托管薄委托（Middle Man）
    →保留（票面裁定「导出面不变」）。
- **边界（未纳入）**：台账 store 写锁 `lib/org/store-base.js` 同型（`Atomics.wait`
  自旋、缺省 6000／3000），但它在 **0010 冻结面**内（改动须新 runId 重采集＋新
  序号增量包），且已有 pid+startedAt 死亡证明——本轮不动，留界登记见
  `docs/PROJECT_UNDERSTANDING.md`「仍可选题」；触发＝实测仍出现超阈等待／超时
  留痕时立票并一并裁定是否并轨。
- 真实运行面零写入（夹具全走 `mkdtempSync` 临时目录）；冻结件与 sourceManifest
  文件未触碰（门② 10/10 为凭）；未新增正式文档，无需改 README §2。
