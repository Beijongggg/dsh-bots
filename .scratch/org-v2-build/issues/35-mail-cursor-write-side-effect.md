# 35: 邮件 cursor 读面写副作用（A8 GET 可触发基线落盘）

**What to build:** `GET /_mail/cursor` 有写副作用，可被任意调用者在任意时点触发，
与“GET 只读面”自述矛盾。

现状（HEAD `d4c24e5` 现行坐标，29 号票独立复核确认，活体复现）：
`lib/org/mail-relay.js:212-219`（`cursor()` 内 217 `pruneReceipts`＋218
`initialMailCursor`）；路由 313-319（仅 GET，无 actor 校验——对比 send／consume
339-350 须 `actor.kind=post`，`botId` 取自声明头 315，中继内仅做在册检查）；
`lib/mail-plane.js:323-344`（`pruneReceipts` 删文件）、356-366
（`initialMailCursor`：`receiptMax==0 && fileMax>0` 即 `writeBaselineReceipt`）、
294-298（`writeBaselineReceipt`）；CSRF 门 `lib/api-security.js:24-27` 只覆盖变更
方法（GET 恒过）。实测：`cursor()` 落 `.baseline.json`，回 `baseline:1＋replay:false`
（存量永不再消费）。修正交接件表述：写副作用是**条件触发**（prune 须超 500 件、
基线须零水位＋有存量），非每次 GET 必写；但“任意调用者任意时点经 GET 触发”为真。
身份仅靠可自声明的 `x-dsh-bots-bot-id` 头（同机边界内可利用；浏览器跨站被
`sec-fetch-site` 拦；`api-security.js:8-9` 自述同机不设防，故定级中低）。

**要定的事（开工时先定并写进 Comments）**：

1. 修法（推荐二选一）：`cursor` 改 POST（变更语义诚实化，GET 只读面恢复），或
   读写拆分（GET 纯读游标＋迁移基线写经显式 POST，由 watcher  lifecycle 调用）。
2. 身份：声明头是否升级为认证（11 号票 send／consume 已有 `mail-actor-forbidden`
   403 先例可照；cursor 今日无此腿）。
3. 存量基线：已落的基线文件在修法后的效力口径（认或重建，写明）。

规格出处：`.scratch/org-v2/spec.md` §E（mail 收口）与 11 号票 `V-A4.7`
（失效三分支）。

来源：29 号票 A8（2026-09-20 只读审计交接，HEAD `d4c24e5` 独立复核确认）。

**Blocked by:** 31（同改 mail 面：31 改 `send` 去重腿，本票改 `cursor` 读面腿；
串行实施，免同文件并发冲突）

**Status:** resolved

- [x] 读面／写面拆分或方法语义修正（二选一，理由在案）
- [x] cursor 身份腿口径写死（匿名 GET 不再能触发写）
- [x] 条件触发三路径用例锁定（prune 超限／零水位迁移／纯读）
- [x] 全量回归与 preflight 四道门 PASS

注：与 31 号票同改 mail 面（本票改 `cursor` 读面腿，31 改 `send` 去重腿，同文件
不同函数）：实施时两票串行或由同一会话认领，免同文件并发冲突。

## Comments

### 2026-09-28 开工口径

授权依据为用户指令 `/implement 35` 及开工前 AskUserQuestion 四项裁定
（修法＝cursor 改 POST；身份＝与 send／consume 同口径；基线＝认／继续有效；
接缝＝确认三缝开工）。Blocked by 31 已 `resolved`（31 改 `send` 去重腿，
本票改 `cursor` 读面腿，同文件不同函数，串行无冲突），可开工。

1. 修法：`cursor` 改 POST（不选读写拆分）。GET 只读面恢复——`GET /_mail/cursor`
   下线（405 `method not allowed`，零写）；写副作用整体搬入
   `POST /_mail/cursor`。理由：语义诚实化一步到位；复用 send／consume 现成
   的 actor 认证＋CSRF 变更门＋留痕腿，不新增端点；唯一生产调用方是 watcher
   经 `mail-client.cursor()`，迁移收敛在通道腿一处。
2. 身份：与 send／consume 同口径。`POST body.actor` 须
   `{kind:"post", id}` 且在册；`host` 冒名／缺身份→403（`host-channel-forbidden`／
   `mail-actor-forbidden`），负载夹带 `from`／`botId`→409 `mail-actor-spoof`，
   中继判定的不在册（`mail-bot-unknown` 等）→403 并进同一留痕腿
   （`op="mail.cursor"`）。`x-dsh-bots-bot-id` 自声明头在 cursor 腿退役；
   匿名 GET 不再能触发任何写（GET 直接 405，连中继都不进）。
3. 存量基线：认／继续有效，不重建不改写。用户附带条件是“重建若更有效则重建，
   只看效果不计工作量”；判定认更有效：基线是迁移时点的水位事实，重建会把基线
   推高到当前 `fileMax`，吞掉迁移后到达、尚未消费的存量（例：迁移基线 2 后到
   达 seq 3 待消费→重建基线 3 则 seq 3 永不再消费）。故已落 `.baseline.json`
   继续按 `readMaxReceiptSeq` 参与水位，不迁移不覆写；`initialMailCursor` 语义不变。

TDD 三缝（vertical slice，行为经公开接口断言，不测 mail-plane 内部）：
缝① HTTP `_mail/cursor` 面（方法＋认证＋留痕）；缝② `mail-client.cursor()`
通道腿（POST＋actor＋CSRF＋三分支回执）；缝③条件触发三路径锁定（prune 超限／
零水位迁移／纯读：prune 口径沿用 `mail-at-least-once` 既有回归，本票在中继面
锁定迁移写一次＋二次纯读不覆写＋匿名 GET 零写）。评审固定点采用开工 HEAD
`73e8d3334ca164c48ba0f1a6c83c464b6fe6efc5`，仅审本票差异。

### 2026-09-28 实施与验证

- `lib/org/mail-relay.js`：`GET /_mail/cursor` 下线（非 POST 一律 405，连中继
  都不进，零写）；`POST /_mail/cursor` 并入 send／consume 同一认证块——body 须
  对象（否则 400）、`actor.kind=post＋id`（host 冒名／缺身份→403，负载夹带
  `from`／`botId`→409），中继调用改 `relay.cursor({botId: actor.id})`（其余键
  忽略，与 consume 同口径）；身份类拒绝（`mail-bot-unknown` 等）→403 并进同一
  留痕腿（`op="mail.cursor"`，原 `op` 三元改按 `tail[0]` 派生）；退役
  `BOT_ID_HEADER` 引用（常量仍由 ledger／post 通道使用，不删登记源）。
  `relay.cursor()` 本体与 `initialMailCursor` 语义不变（存量基线认／继续有效）。
- `lib/org/mail-client.js`：`cursor()` 改 `post("/api/bots/_mail/cursor",
  {actor})`（CSRF＋有限重试＋三分支回执全复用）；`attempt()` 坍缩为 POST 专用
  （GET 分支死码删除）；`BOT_ID_HEADER` 导入删除。watcher 调用形状不变
  （`mail.cursor()` 无参），`lib/index.js` 与 `host-channel.getJson` 不动
  （post-channel 仍用 GET 读 ledger 面）。
- `tests/org-mail-relay.test.mjs`：新增“POST 认证落基线＋GET 405 零写”（先红后
  绿）与“三路径锁定”（prune 只经认证 POST：505 件→GET 不动→POST 剩 500 且水
  位 505；迁移写一次；二次纯读无 `baseline` 键且水位不变——首跑即绿，属
  characterization 锁定，中继逻辑未改故无码可写）；既有“actor 认证”补 cursor
  四腿（ghost→403＋留痕 `op=mail.cursor`／host→403／spoof→409／GET→405）。
- `tests/org-mail-client.test.mjs`：“游标腿”改 POST＋actor＋CSRF 断言（先红后绿）。
- 结果：两文件合跑 **20/20**（relay 14＋client 6）；四个改动文件 `node --check`
  通过；全量 `npm test` **69/69**×2；`npm run preflight` **PASS**×2（①69/69
  ②0010 包冻结面 10/10 ③status-lint 0 违例扫 77md ④宿主契约 11/0/0）。
  中间另有一次 preflight 报 68/69（FAIL），未复现：其日志写在会话外 ephemeral
  `/tmp` 致失败文件名未捕获（后改写工作区内临时日志并阅后即删），随后两次全量
  与两次 preflight 全绿；若复现则按失败文件名追查，不归因本票改动（本票新增
  用例无计时器／并发／网络，505 件 prune 断言 mtime 全显式设定、确定性）。
- 真实运行面零写入（夹具全走 `mkdtempSync` 临时目录；部署同步未做——属 16 号票）；
  不触 sourceManifest 文件、冻结包（门② 10/10 为凭）；未新增正式文档，无地图变更。

### 2026-09-28 code-review 收口

两只读隔离上下文子代理并行评审（身份未披露，不作推断），固定点 `73e8d33`，
评审快照提交 `654a094`，以 `git diff 73e8d33...HEAD` 仅比较本票五件差异
（作用域干净，无票外 hunk）。

- **Standards**：硬性规范违例 **0**，判断性建议 **3**。`tail[0]` 双重级联
  （possible Repeated Switches／Duplicated Code）→ 已处置：`op` 命名与中继调用
  并入单源分派表（`{mail.send, mail.consume, mail.cursor}`），调用点
  `relayCall(dispatch)`；`rejectAuthz` 的 `opOverride` 形参改名 `recordOp`
  （possible Mysterious Name 消解）。`post()` 薄委托（possible Middle Man，弱项）
  评估后保留：失败／回执映射是 `post` 的职责，`attempt` 只做重试传输，分层与
  `V-A4.7` 三分支叙述一致。另两项依覆盖规则压制（`actor{kind,id}` 重复＝规格
  钦定身份口径；跨文件铺展＝立项三缝 vertical slice）。
- **Spec**：越权 **0**，不符 **0**，缺失／部分 **2**，全处置。①门证据：直接全量
  **69/69**×3，preflight 共 6 次——首次 68/69 未复现记单文件抖动（失败文件名因
  日志写会话外 ephemeral `/tmp` 而丢失，过程教训：验证日志一律写工作区内临时
  文件、阅后即删），不归因本票改动（新增用例无计时器／并发／网络，prune 断言
  mtime 全显式设定）；其后 **PASS**×5，末次即落档终树
  （①69/69 ②10/10 ③0 违例 ④11/0/0）；若复现则按失败文件名追查。②cursor 身份
  负例：补 `from` 夹带→409 与缺 `actor`→403 两锁（此前仅锁 `botId` 夹带／host
  冒名／ghost，依赖共享块隐式覆盖；现六腿齐全：POST 200／ghost 403＋留痕／
  host 403／botId 409／from 409／缺身份 403／GET 405）。
- 处置后复验：两文件合跑 **20/20**，改动文件 `node --check` 通过；直接全量累计
  **69/69**×3，preflight 累计 6 次（首次 68/69 未复现＋其后 PASS×5，末次即落档
  终树四门全绿）。

两轴无阻断项，本票转 `resolved`。落档事件见当月日志卷
（`docs/changelog/2026-09-01.md` `EV-20260928-mail-cursor-post`）。

### 2026-09-28 在册校验返修口径

授权依据：用户指令“改善并提交”，补齐在册校验与相关回归。

- 在册校验只认注册表自身字段，拒绝继承的 `toString`／`constructor`／`__proto__`。
  同一邮件中继内的 cursor、send、consume 与按 ID 查收件人共用该判定，保持
  普通在册实例与 user principal 的既有语义。
- 沿用已确认的 HTTP／通道公开接口测试缝，补拒绝零写与 `mail.cursor` 留痕，
  并补无头 GET、客户端无旧身份头／无 GET、旧基线保留的行为断言。

### 2026-09-28 返修实施与收口

- 根因：原来的 `registry[id] !== undefined` 会读到原型链属性，把未登记的
  `toString`、`constructor`、`__proto__` 当成在册实例。邮件中继新增私有
  `hasRegisteredBot`，以 `Object.hasOwn` 加原有非 undefined 条件统一四处判断。
- 回归：HTTP cursor 与发送／消费／收件人负例分别先红后绿，拒绝后基线、水位
  和正文保持不变，身份拒绝操作名正确；自身登记的同名实例正例通过。补齐无头
  GET、五类 cursor 身份拒绝零写、客户端不发旧身份头／GET，以及基线 2 后到达
  消息 3 仍回放且基线字节不变的断言。专项 **23/23**，relay 17＋client 6。
- Standards：固定点 `3e8950a`，仅审本轮工作树差异，硬违例 **0**，需处置的
  判断性建议 **0**。共享在册判断与公开接口测试符合仓库规范。
- Spec：同固定点独立并行复审，缺失／部分 **0**、范围扩张 **0**、实现错误
  **0**。在册、user principal、存量基线语义均保持。
- 完整验证：当前工作树 `npm run preflight` **PASS**，回归 **69/69**、0010 包
  冻结面 **10/10**、lint **0** 违例、宿主契约 **11 PASS／0 FAIL／0 SKIP**。
  首次管道日志缺最终汇总，不计有效门证据；改为工作区临时文件直接接收输出，
  复跑得到上述完整结果。测试与探针均经隔离子进程，夹具使用临时数据根。

本票保持 `resolved`。真实运行面及冻结件零写入。返修摘要见
`docs/changelog/2026-09-01.md` 的 `EV-20260928-mail-registry-own-keys`。
