# 11: mail 收口与形态改造

**What to build:** mail **保数据不保形态**。收口：bot 侧底层改走认证 host 命令 `mail.send`（对 bot
仍**零 capability 门槛**、consult 语义不变），**bot 直写 inbox/outbox 取消**，host 成为唯一写者
（消灭多写者与序号锁竞争，闭共享面 writer ownership 缺口；L1「共享面读写经 host 命令」不豁免 mail）。
形态改造：**保**三件不变量——at-least-once（receipts／cursor／responses）＋幂等回复＋`nextSeq` 锁；
**废** `kind` 枚举与「`replyTo`⟺`kind`」约束；**关联键改 `taskId`**。mail 退为**投递通道**：内容
**不承载任务状态**，也不构成权限或事实依据（零权威线）。工具失效走三分支（通道不可用／鉴权拒绝／
语义失败），**无文件直写降级路径**；v2 词表**无 skill**、无运行时 skill 装载机制。

规格出处：`.scratch/org-v2/spec.md` §E 与附录 A `V-A4.4`、`V-A2.13`、`V-A4.7`、`V-A4.8`。

**Blocked by:** 06（认证命令通道与 capability 面）、07（关联键＝任务 id）

**Status:** resolved

- [x] mail 收口 host 中继：bot 侧无 inbox/outbox 直写路径，host 是唯一写者（`V-A4.4`）
- [x] 保 at-least-once（receipts／cursor／responses）＋幂等回复＋`nextSeq` 锁三件不变量
- [x] 废 `kind` 枚举与「`replyTo`⟺`kind`」约束
- [x] 关联键改为 `taskId`
- [x] mail 退为投递通道：内容不承载任务状态（`V-A2.13`）
- [x] 工具失效三分支各按其道，无文件直写降级路径（`V-A4.7`）
- [x] v2 词表无 skill、无运行时 skill 装载机制（`V-A4.8`）
- [x] 全量回归 PASS


## Comments

### 2026-09-20 `/implement 11` 实现＋双轴复审处置

**领票与授权（四项口径均经 AskUserQuestion 裁定，2026-09-20）**：
①领 11 号票（org-v2-build 前沿：编号最小、未阻塞、未认领）；②**严格收口**——消费记账
（receipts／responses／游标基线）一并迁 host 命令面，bot 进程对 mail 面零写；③**保留自动回信、
回信锚＝`replyTo`**（删 `kind` 字段与「`replyTo`⟺kind」约束，收到带 `replyTo` 的邮件不再自动
回信以止 ping-pong，幂等回复锚仍按被回复消息 id，关联键＝`taskId`）；④TDD 三缝（host 中继命令面
／bot 侧零直写接线／机械检查）。

**领票事实**：开工侦察确认 01–10、15、18、19–24 已 `resolved`，14／16／17 仍被 11／12／13 阻塞，
故前沿＝11。

**机械面（缝①→缝③，TDD 各缝各自红→绿）**：
- **缝① host 中继命令面**——新件 `lib/org/mail-relay.js`：`createMailRelay`（`send`／`consume`／
  `cursor`：host 唯一写者；投递者词表＝在册实例∪用户 principal；键封闭拒夹带；幂等回复按
  `replyToMessageId`／`replyTo`／`idempotencyKey` 三锚去重）+`createMailHttpApi`（`_mail` 面
  `send`／`consume`／`cursor`；actor 认证、零 capability 门槛、未接线 404 fail closed）+
  `createMailRejectionRecorder`（鉴权拒绝的台账留痕）。`lib/index.js` 接 `_mail` 路由与 host 侧
  中继实例化。
- **缝② bot 侧零直写接线**——新件 `lib/org/mail-client.js`（通道腿：`send`／`claim`／`finalize`／
  `skip`／`cursor`，**不触文件系统**）＋`lib/org/host-channel.js`（CSRF 会话与变更面投递口径
  抽件，与 `post-channel` 单源）；`startInboxWatcher`／`handleIncoming`／`routeReplyToSender` 三处
  改写为经 host 命令（消费水位、响应标记、基线全在 host 落盘；取不到游标即不消费）；`send_mail`
  手写工具退役，`mail.send` 升入 op-set 四常设岗（执行面＋变异集、复核帽不持、描述带
  `{to, text, taskId?}` 与「空 to 列名单」），`routed` 腿直连中继；通知监视器协议回信静默改按
  `replyTo` 锚；`BotsApi.send`（用户→bot）改走中继——bot 实例无中继即 fail closed。
- **缝③ 机械检查**——新件 `lib/org/mail-shared-face.js`（`scanMailWriteFace`：写者名单闭合＝只剩
  `org/mail-relay.js`、bot 侧面零直写、bot 侧面零「触达＋文件写」临界区、通道腿零文件面；
  `scanMailContentKeys`：写函数造键与调用点传键都在封闭枚举内）＋`lib/org/vocabulary-face.js`
  （`scanVocabularyFace`：`skill`／`技能` 记号零命中、无非字面说明符动态 import）＋
  `lib/org/face-scan.js`（扫描管路抽件：walk／注释判别／函数体提取／写操作名单单源，三张扫描件共用）；
  L1 负例补投递面**真实面**路径（从 `mail-plane` 路径助手单源派生）；`MAIL_INBOX_KEYS`／
  `MAIL_OUTBOX_KEYS` 与台账状态／事件／命令词表断言不相交。

**形态改造落地**：`kind` 字段写侧不再产生、读侧（通知静默、prompt 前缀、回路由守卫）改按
`replyTo` 锚；历史行（v1 `kind="mail-response"`）按锚同样静默（升级窗口不炸旧协议流量）；
`taskId` 落盘并随回信延续；`at`／`replyTo`／`idempotencyKey` 入封闭键表。

**验证结果**：全量 `TMPDIR=/dev/shm npm test` **57/57** ✅（基线 53/53 ＋ 新增 4 件：
`org-mail-relay` 7／`org-mail-client` 6／`org-mail-shared-face` 8／`org-vocabulary-face` 4）；
preflight 四门 **exit 0**（①57/57 ②冻结面 0009 包 7/7 ③0 违例扫 68 md ④11 PASS / 0 FAIL / 0 SKIP）；
既有回归按新形态改写：`watcher`（游标语义不变，投递与水位经 host 中继）、`reply-route`
（新增「通道不可用止步、零写入、水位不前进」腿）、`jsonl`／`mail-notify`／`mail-at-least-once`
（`kind` 废止同步）；不动 `mail-notice`（客户端文案面未涉形态）。**真实运行面零写入**（`~/.dsh`
未触碰，全部夹具临时目录；部署同步未做——属 16 号票）。

**/code-review 双轴并行（Standards 硬违例 2／judgement 6；Spec 缺失 1／越权 1／不符 3）全处置**：
- **Standards 硬违例**：①未落档——本条及 CHANGELOG 条目即处置；②单源破损——`HOST_CHANNEL_FORBIDDEN`
  抽入 `permissions.js` 由台账面与邮件面共用，`MAIL_CHANNEL_UNAVAILABLE` 改用 `mail-client` 导出常量，
  host origin 解析一次后传入 `registerOrgTools`（去两处各读 env）。
- **Standards judgement**：扫描管路三份复制→抽 `face-scan.js` 单源；两个新扫描件的豁免名单改名
  （`MAIL_`／`VOCABULARY_` 前缀）消同名异义；`writers` 语义改「名单内**确含**写调用」（真证据）；
  投递调用名单 `MAIL_DELIVERY_CALLS` 抽常量（去两处内联字面）；`host-channel` 两态返回归一为
  `{status, body}`（消调用侧 `GET/POST` 分叉与 `payload` 实为 headers 的名实不符）；删无生产调用方
  的 `inboxHasResponseTo`；`apply` 顶层冗余 `mkdirSync(bots/inbox|outbox)` 删除（mail-plane 写路径
  已按需建目录）；陈旧注释（「bot 实例是邮件写入方」）更正。
- **Spec 侧**：① V-A4.4 进程粒度缺口——`BotsApi.send`（`/api/bots/:id/send` 路由逐实例注册）是
  bot 进程内仅存的 mail 写路径，改走中继后 bot 实例 fail closed；写者名单随之收窄为**中继面一件**
  （扫描测试断言 `writers === ["lib/org/mail-relay.js"]`）。② §E 分支二「鉴权拒绝→错误回执＋**台账
  拒绝事件**」原先缺台账腿——由 `createMailRejectionRecorder` 补齐：有任务锚（邮件自带 `taskId`
  且台账认账）落 `command-rejected`，无锚只留 host 日志（邮件零 capability 门槛 ⇒ 不存在带任务锚的
  「授权拒绝」，只有身份认证失败，其锚点只能来自邮件自带的 `taskId`；无锚时落事件会凭空造事实）。
  ③ `consume` 补归属校验（汇报的 `(messageId, seq)` 须确在该实例 inbox 内）——伪造 `skipped-stale`
  receipt 不再能经异常汇入在台账里凭空长出一条异常（`V-A3.7` 零权威线加固）。④ 名实不符回归件
  （`mail-at-least-once` 仍以 `kind` 为前提）改按 `replyTo` 锚断言。
- **复审判定保留（在案）**：agent 面 `mail.send` 开放 `to:"user"`（写自身 outbox）——bot→user 回复
  在收口后**必须**有命令通道，故随 `mail.send` 一体落地（v1 由 host 代写 outbox 的形态收进命令面）；
  规格未点名此用法，属形态改造的必然延伸，非新增能力（邮件零权威、只写自身 outbox）。

**留界（在案、待后续票）**：①**部署面未切换**——`~/.dsh/plugins/dsh-bots` 仍是 org-v2 之前快照，
本轮的 `_mail` 面与 bot 侧通道腿在部署面尚未生效（部署同步与重启链属 16 号票点名段）；②`internals`
仍导出 mail-plane 写原语（`appendMessage`／`appendOutbox` 等）——这是**测试槽位**（供 `jsonl`
与 `reply-route` 夹具当 host 侧播种用），非 bot 侧通道；扫描的写者名单已按「确含写调用」取证，
`lib/index.js` 生产路径零写；③未绑 `post` 的 v1 形态实例随本票起无 `mail.send` 工具（工具面＝岗位
派生），与其知识登记能力同口径随 16 号票切换批收敛。
