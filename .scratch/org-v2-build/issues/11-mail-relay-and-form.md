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

**Status:** ready-for-agent

- [ ] mail 收口 host 中继：bot 侧无 inbox/outbox 直写路径，host 是唯一写者（`V-A4.4`）
- [ ] 保 at-least-once（receipts／cursor／responses）＋幂等回复＋`nextSeq` 锁三件不变量
- [ ] 废 `kind` 枚举与「`replyTo`⟺`kind`」约束
- [ ] 关联键改为 `taskId`
- [ ] mail 退为投递通道：内容不承载任务状态（`V-A2.13`）
- [ ] 工具失效三分支各按其道，无文件直写降级路径（`V-A4.7`）
- [ ] v2 词表无 skill、无运行时 skill 装载机制（`V-A4.8`）
- [ ] 全量回归 PASS
