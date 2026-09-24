# 30: 知识命令腿 actor 形状校验（A1 fail-open 收口）

**What to build:** `POST /api/bots/_ledger/commands` 的 `knowledge.register`／`knowledge.deprecate`
拦截腿先过与台账同一张能力鉴权门，但门本身对“actor 缺席／畸形”直接放行，导致省
略 actor 即绕过信封三元组。

现状（HEAD `d4c24e5` 现行坐标，29 号票独立复核确认，纯函数＋端到端复现一致）：
`lib/org/permissions.js:121`（`if (!actor || actor.kind !== "post") return { ok: true };`，
读面同型放行在 210 行）；知识腿 `lib/org/ledger-host.js:482-509`（op 分流 482、
`authorizeCommand` 调用 493、`knowledgeRegister` 执行 508，474-476 仅拒 `kind=host`，
491-507 仅判 `verdict?.ok !== true`，无 actor 形状校验）；宿主接线
`lib/index.js:2888`（`authorizeCommand: access.authorize`，与台账同一鉴权器，fail-open
同源传导）；对照腿 `lib/org/task-ledger.js:592`（`isValidActor`）、1110（`invalid-actor`）、
1131（`actor-not-allowed`）——知识腿宣称“同一张门”，实际少两腿。
复现：`actor ∈ {undefined, null, {}, {kind:"user"}}` 一律 `{"ok":true}`，
`{kind:"post"}` 才进 capability 门。影响：共享面写可被“不带 actor”整体绕过；
`actor:{kind:"user",id:"<他人 botId>"}` 可伪造条目归属（`lib/knowledge.js` 的
`botId: String(botId ?? "")`）。前置＝CSRF 令牌（同机进程合法持有），非远程可利用。

**要定的事（开工时先定并写进 Comments）**：

1. user/host 全权语义边界：`permissions.js` 的放行分支本身是对的（user 台账全权、
   host 进程内确定性组件），缺的是知识腿自己的形状校验。推荐：腿内要求 actor 为
   合法形状（`isValidActor` 同源，缺／畸形即 `invalid-actor`），user 须带合法 id；
   **不改台账放行口径**（勿顺手改 `authorize`）。
2. 伪造归属：user 自声明 id 是否须与 CSRF 通道身份绑定（11 号票 mail 面有
   `mail-actor-spoof` 409 先例可照）。
3. 负例不消耗／不落盘口径（拒绝走既有 403＋`knowledge-command-unwired` 对称码）。

**负例要求**：无 actor 即拒；畸形 actor 即拒；`kind:"user"` 无 id 即拒；他人 id
伪造即拒（按第 2 条口径）；既有 post 信封正／负例不回退。

规格出处：`.scratch/org-v2/spec.md` §D（鉴权三元组）与 10 号票 `V-A4.5`（登记命令化）。

来源：29 号票 A1（2026-09-20 只读审计交接，HEAD `d4c24e5` 独立复核确认）。

**Blocked by:** 无

**Status:** ready-for-agent

- [ ] 知识腿 actor 形状门落定（与台账 `isValidActor` 同源，不另抄口径）
- [ ] user/host 全权语义边界写死（台账放行口径不动）
- [ ] 无 actor／畸形／伪造三类负例在知识腿成立
- [ ] 既有 post 信封用例与 10/11 号票回归不回退
- [ ] 全量回归与 preflight 四道门 PASS
