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

**Status:** ready-for-agent

- [ ] 回信锚／幂等键分域口径写死（复合键或 replyToMessageId，理由在案）
- [ ] 投递方自带 `replyTo` 口径写死（禁自带或分域收编）
- [ ] 历史裸锚判定口径写死并测试
- [ ] 跨发信人双投递＋同发信人真重放去重两类用例锁定
- [ ] 全量回归与 preflight 四道门 PASS

注：与 35 号票同改 mail 面（本票改 `send` 去重腿，35 改 `cursor` 读面腿，同文件
不同函数）：实施时两票串行或由同一会话认领，免同文件并发冲突。
