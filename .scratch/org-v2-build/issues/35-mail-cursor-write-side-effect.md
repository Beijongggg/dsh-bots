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

**Status:** ready-for-agent

- [ ] 读面／写面拆分或方法语义修正（二选一，理由在案）
- [ ] cursor 身份腿口径写死（匿名 GET 不再能触发写）
- [ ] 条件触发三路径用例锁定（prune 超限／零水位迁移／纯读）
- [ ] 全量回归与 preflight 四道门 PASS

注：与 31 号票同改 mail 面（本票改 `cursor` 读面腿，31 改 `send` 去重腿，同文件
不同函数）：实施时两票串行或由同一会话认领，免同文件并发冲突。
