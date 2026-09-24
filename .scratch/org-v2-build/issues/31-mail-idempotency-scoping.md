# 31: 邮件投递幂等按发信人分域（A2 静默丢信＋B1 同键吞信）

**What to build:** 收件方 inbox 的回信去重锚跨发信人必然碰撞：B、C 各自 inbox 序号
均为 1 时，C 给 A 的回信被当成 B 回信的重放吞掉，双方各持 `ok:true`，协作闭环静默
断链。

现状（HEAD `d4c24e5` 现行坐标，29 号票独立复核确认，端到端复现两次一致）：
`lib/org/mail-relay.js:139-144`（`replyTo` 去重）、145-151（`idempotencyKey` 按收件方
inbox 全局 `find`，无 from 分域）；锚判定 `lib/mail-plane.js:412-418`
（`inboxResponseTo` 只认 `replyTo` 在场，11 号票废止 kind 类型学后有意为之）；
锚写入方 `lib/index.js:1978-1984`（`routeReplyToSender` 内 `replyTo: message.seq`，
`message.seq` 是**回信者自己 inbox** 的序号）；`MAIL_SEND_KEYS:34-36` 允许投递方自带
`replyTo`（任意 bot 可预埋锚点压制他人回信）。复现：
`B->A replyTo:1 → {ok, seq:1}`，`C->A replyTo:1 → {ok, seq:1, replayed:true}`，
A inbox 永远只有 B 的。B1 同型：B、C 同键 `k1`，C 被吞（`replayed:true`）。
outbox 腿 `replyToMessageId` 锚（128-132）不受影响。

**要定的事（开工时先定并写进 Comments）**：

1. 锚形态（推荐二选一，写明不选的理由）：回信锚按 `(from, replyTo)` 复合分域，
   或改用 `replyToMessageId` 作唯一锚（已存在，需补投递面写值）。
2. `idempotencyKey` 按 `(from, key)` 分域（B1 并入本票，不另立）。
3. 投递方自带 `replyTo` 是否收紧（预埋锚压制面）：禁自带（路由面自动填）或保留
   并纳入分域。
4. 历史数据：已落盘的裸 `replyTo` 行在分域后的判定口径（旧锚按旧口径认或一次性迁移）。

**负例要求**：B、C 同序号回信各投各（双投递）；同发信人真重放仍去重；跨发信人同
幂等键不互吞；同发信人同键仍去重；既有 `mail-at-least-once` 回归不回退。

规格出处：`.scratch/org-v2/spec.md` §E（mail 收口 host 中继）与 11 号票
`V-A4.4`（幂等回复三锚）。

来源：29 号票 A2＋B1（2026-09-20 只读审计交接，HEAD `d4c24e5` 独立复核确认；
B1 并入本票）。

**Blocked by:** 无

**Status:** resolved

- [x] 回信锚／幂等键分域口径写死（复合键或 replyToMessageId，理由在案）
- [x] 投递方自带 `replyTo` 口径写死（禁自带或分域收编）
- [x] 历史裸锚判定口径写死并测试
- [x] 跨发信人双投递＋同发信人真重放去重两类用例锁定
- [x] 全量回归与 preflight 四道门 PASS

注：与 35 号票同改 mail 面（本票改 `send` 去重腿，35 改 `cursor` 读面腿，同文件
不同函数）：实施时两票串行或由同一会话认领，免同文件并发冲突。

## Comments

### 2026-09-24 开工口径

授权依据为用户指令 `$implement 31票`。以下四项采用本票允许的实现选择。

1. inbox 回信按收件人信箱内的 `(from, replyTo)` 去重。`replyTo` 是回信者
   自己 inbox 的序号，须由发信人限定作用域。不改成 `replyToMessageId` 唯一锚，
   因为现有自动回信与防循环守卫均使用 `replyTo`，复合判定无需改投递格式和路由。
   outbox 的 `replyToMessageId` 仍在各发信人自己的 outbox 内判定。
2. inbox 投递键按 `(from, idempotencyKey)` 去重，同发信人同键返回既有消息。
3. 保留调用方自带 `replyTo`，纳入发信人分域。HTTP 命令仍由 actor 注入 `from`，
   负载不得夹带身份；某发信人预先发送同锚消息不能压制其他发信人的回信。
4. 历史裸锚行直接用已落盘的 `from` 参与复合判定，不改写或迁移旧 inbox。
   历史 `kind` 不参与判定；缺少有效 `from` 的行不匹配新投递，不退回全信箱去重。

TDD 沿用 11 号票已确认的 host 中继命令面，观察发送回执与公开 inbox 读面。
先锁跨发信人同序号回信，再锁同键投递；覆盖各发信人真重放、重新创建中继后的
重放与历史裸锚。既有 `mail-at-least-once`、回信路由及邮件相关回归继续执行。
仓库没有独立 typecheck 配置，开发期执行修改过的 JavaScript 语法检查。
评审固定点采用开工 HEAD `a04707c2127a914f9bad87bb4461aa8040b637ea`，仅审本票差异。

### 2026-09-24 实施与验证

- `inboxResponseTo(dshHome, botId, seq, from)` 要求发信人参数，按复合锚匹配。
  中继传入命令身份，同键投递的查找也限定 `msg.from === from`。
- `tests/org-mail-relay.test.mjs` 新增四项行为回归，分别验证同序号回信、同键投递、
  历史裸锚与 HTTP actor 注入。前两项各先红后绿；全部四项在开工版本的隔离副本上
  均失败，修复后该文件 **12/12** 通过。重新创建中继后仍各自去重，历史行字节不变。
- `tests/mail-at-least-once.test.mjs` 随接口补发信人参数与跨域、缺发信人负例，
  **14/14** 通过；修改的四个 JS／MJS 文件 `node --check` 通过。
- 最终 `npm run preflight` exit 0：①全量 **67/67** 测试文件通过，包含原有
  `reply-route`、`watcher` 与邮件回归；②0010 包冻结面 **10/10**；③status-lint
  **0 违例，97 md**；④宿主契约 **11 PASS／0 FAIL／0 SKIP**。
- 工程行为同步至 `PLAN-expanded-engineering.md` §十一 B3 后的补记。未新增文档，
  无地图变更；本票不触 sourceManifest 文件、冻结包或真实运行面。

### 2026-09-24 code-review 收口

两名独立上下文子代理只读评审，固定点 `a04707c`，评审快照提交 `646ee7c`，
以 `git diff a04707c...HEAD` 仅比较本票七件差异。两者报告身份为 Codex，
上下文声明基于 GPT-6，具体运行型号未暴露，不作推断。

- **Standards**：硬性规范违例 **0**，判断性建议 **1，P3 possible Duplicated Code**。
  两项分域回归的双投递、重建中继、逐发信人重放流程相近。此项评估后保留，
  两个测试分别对应 A2 与 B1 的独立退化点，保留各自的完整输入与失败说明，
  避免测试助手隐藏锚差异；重复仅限两个短测试，无生产代码重复。
- **Spec**：**0 项发现**。四项口径、历史数据、跨发信人与同发信人负例均匹配票面；
  评审代理在隔离副本独立复跑中继与 `mail-at-least-once` 两文件，均 exit 0。

两轴无阻断项，本票转 `resolved`。轮前 25／27／28 返修等未提交内容逐文件保留，
本票提交只含自身七件差异，CHANGELOG 仅追加本票条目。
