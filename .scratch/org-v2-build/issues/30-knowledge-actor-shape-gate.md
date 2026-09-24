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

**Status:** resolved

- [x] 知识腿 actor 形状门落定（与台账 `isValidActor` 同源，不另抄口径）
- [x] user/host 全权语义边界写死（台账放行口径不动）
- [x] 无 actor／畸形／伪造三类负例在知识腿成立
- [x] 既有 post 信封用例与 10/11 号票回归不回退
- [x] 全量回归与 preflight 四道门 PASS

## Comments

### 开工前定死（2026-09-24 `/implement 30`，要定的三件事）

**① actor 形状门的落点＝腿内自带，口径与台账同源；台账 `authorize` 一行不改。**

- 知识腿（`ledger-host.js` 的 `knowledge.register|deprecate` 拦截腿）**不经台账本体**
  （不入状态机、不落事件——10 号票 `V-A4.5`），而 actor 形状校验住在台账本体的
  `command`（`task-ledger.js` 的 `isValidActor` → `invalid-actor`）。故「与台账同一张门」
  的说法只对**鉴权尺度**成立、对**形状**不成立——本票把缺的那腿补在腿内。
- 形状口径**同源**＝调叶件 `ledger-events.isValidActor`（28 号票抽的事件契约叶件，台账
  同一引用），不另抄一份判定。判定件落 `permissions.js` 的 `knowledgeActorVerdict`
  （通道侧结论码的既有住所，与 `HOST_CHANNEL_FORBIDDEN` 同处），腿只做调用与回执。
- **不改 `authorize`**（票面点名）：user＝台账全权、host＝进程内确定性组件，口径原样
  保留（`tests/org-permissions.test.mjs` 以同一 actor 钉「两门两判」）；本门只管知识腿。
- **门序**＝接线门 → **形状门** → 鉴权门 → 执行面。形状在鉴权之前是**承重的**：形状负例
  随体携带的活信封不得被烧（负例不消耗），也不得走到执行面（零落盘）。接线门（503
  `knowledge-command-unwired`）在前——宿主态缺失与请求形状无关。host 冒名的**通道策略
  位置不变**（更前面的 `HOST_CHANNEL_FORBIDDEN` 拦，码逐字不变），不搬进门内。

**② 伪造归属：user 的 id 是「归属声明」不是「身份声明」，只许声明唯一 user principal。**

- 本部署同机单用户，§D L3「CSRF 令牌＝唯一 user principal」——**通道不携带第二个身份
  可比对**，故「与 CSRF 通道身份绑定」在机制上落为：以仓内已单源的 principal 身份表示
  `human-inbox.RULING_ACTOR`（`{kind:"user", id:"user"}`，09 号票裁定的 user principal
  身份，终裁与人间命令共用）为准。user actor 的 id ≠ 它即**伪造产出方归属**（索引
  `botId` 字段由 `registerReport` 机器侧填充，等于把「谁产出」交给调用方自报）→ 拒。
- **命名与语义照 11 号票 mail 面 `mail-actor-spoof`**（同一类洞：身份／归属由通道注入、
  不由负载自带）；**状态码取本腿既有惯例 403**（不引第二个状态码——本腿拒绝面统一
  403，`knowledge-command-unwired` 是同一形状的 503）。
- **不选**「user 一律拒登记」：与 §D L3「user 台账全权」＋§E「全员基础工具含
  `knowledge.register`」的语境冲突，且误伤人间面登记；也**不选**「post 也查 id∈在册」——
  post 身份已由**信封绑定**（`capability-bot-mismatch`）把守，本门重判即第二份口径。

**③ 负例三口径（全部落常驻测试）**：**不消耗**——形状／归属负例不进鉴权门，机械证据＝
形状负例之后同一张信封照常完成登记；**不落盘**——`readIndex` 零条目、废弃腿旧条目状态
不变；**不落台账**——本腿本就不入台账事件（既有性质，回归照旧）。

### 实施与验证（2026-09-24）

- **范围**：`lib/org/permissions.js`（新增 `knowledgeActorVerdict`＋口径注记；`authorize`
  零改动）、`lib/org/ledger-host.js`（知识腿接形状门＋模块头注记门序）、
  `tests/ledger-host.test.mjs`（抽取夹具 `mkKnowledgeHost`＋2 用例）、
  `tests/org-permissions.test.mjs`（判定表＋台账放行口径边界，1 用例）、`CONTEXT.md`
  （知识库词条补「腿内 actor 门」口径）、本票面＋CHANGELOG。
- **TDD 先红后绿**：切片①（形状门）先红＝「缺 actor」实得 **200**（本票的洞：共享面可被
  无身份写入）；切片②（归属门）先红＝`{kind:"user",id:"bot-researcher"}` 实得 **200** 且索引
  `botId` 记为 `bot-researcher`（伪造归属成立）。两切片各自「一测试→一实现」。
- **负例坐标**：`tests/ledger-host.test.mjs::知识命令腿 actor 形状门：无 actor／畸形 actor
  一律拒（与台账 invalid-actor 同源；零落盘、不消耗信封）`（7 形状负例＋host 通道策略不
  回退＋不消耗正例）；`tests/ledger-host.test.mjs::知识命令腿 actor 归属门：user 只许声明
  user principal 本人，他人 id 即伪造归属（user 正例不回退）`（register／deprecate 两 op
  同门）；`tests/org-permissions.test.mjs::知识命令腿 actor 门（30 号票）：形状／归属判定
  表；台账放行口径不动（同一 actor 两门两判）`。
- **验证结果**：`ledger-host` **19/19**、`org-permissions` **11/11**；全量回归 **67/67**
  测试文件；preflight 四道门 **PASS**（①67/67 ②冻结面 0010 包 10/10 ③status-lint
  0 违例〔97 md〕④宿主契约 11 PASS/0 FAIL/0 SKIP）。既有 post 信封正／负例（无帽 403、
  角色帽 200＋索引产出方＝提交实例、复核帽 403）与本腿未接线 503 **逐字不变**；10 号票
  `V-A4.5` 与 11 号票 mail 面回归不回退。运行面零写入（全程临时 DSH_HOME）。
- **判据坐标**：**不新增判据**——A 组判据集是封闭的 60 条（与规格附录 A 双向锁定），本票只
  **补执行坐标**（规格允许实施批「只能补执行坐标」）：`V-A4.5` 的坐标串追加三条新测试，
  `lib/org/acceptance-coordinates.js` 与 `.scratch/org-v2/spec.md` 附录 A **同拍回写**
  （双向锁定由 `tests/org-acceptance-coordinates.test.mjs` 复核通过：坐标可解析＋两侧逐字
  同拍＋判据语义摘要不因坐标改动而变）。判据文本、级别、挂标计数一律未动。
- **复审**：`/code-review` 双轴（固定点 `e2a9b3b`）——处置记录见下条 Comment。

### `/code-review` 双轴处置（固定点 `e2a9b3b`，双席并行；2026-09-24）

**Standards 轴**：硬违例 3（**修 2 留 1**）／判断项 4（**修 1 留 3**）。

- 硬①「`invalid-actor` 结论码与文案第二份手抄，与 HOST_CHANNEL_FORBIDDEN 单一源纪律冲突」→
  **留（判断项改判，理由具证）**：①**规则**已单源（两处调同一函数引用
  `ledger-events.isValidActor`）；②**文案不可能共用**——台账许 `host`、本腿不许（host 由
  通道策略先拦），共用一句必让一侧报文失实；`HOST_CHANNEL_FORBIDDEN` 之所以共用，正因为
  它的**政策与文案在两处逐字适用**；③同码异文的既有先例＝`capability-malformed`
  （`permissions.js`／`capability-issue.js`／`ledger-host.js` 三处同码、各自文案，历轮评审
  在案）与 `task-not-found`（单模块内四处同码）；④「正确」的单源位置是叶件
  `ledger-events.js`，而它在**冻结面 0010 包 sourceManifest** 内——为一个字符串常量重采集
  出包不成比例。**已处置**：删掉散文里的「同码同口径」overclaim（现写明「同源规则、按本腿
  可达 kind 集给文案」），并把先例写进注记。
- 硬②「`mkKnowledgeHost` 头注称与既有用例同一装配、而既有两用例未改挂；CHANGELOG『抽取共用
  夹具』言过其实」→ **修**：两个既有知识腿用例（`knowledge.register 命令化`／
  `knowledge.deprecate`）改挂同一夹具，注释与实现一致，手抄装配 3 份 → 1 份。
- 硬③「CHANGELOG／票面宣称复审处置『见下条 Comment』而该条不存在（未落档即未发生）」→
  **修**：即本条。
- 判断①「畸形 actor 七例表在两测试文件各一份」→ **留**：两处两条缝各有职责（HTTP 行为面 vs
  纯判定表），合表会把 HTTP 缝与单元缝耦合；重复的是**覆盖面**而非口径（口径单源在
  `isValidActor`）。
- 判断②「`knowledgeActorVerdict` 对 `host` 回 `{ok:true}`：门不自足，未来调用方跳过通道策略
  即 fail-open」→ **修**：门内**同码兜底**（`HOST_CHANNEL_FORBIDDEN` 同一结论对象，403 与
  通道层逐字同形）＋单元用例钉住；leg 侧 host 冒名的通道策略位置与码不变。
- 判断③「mail 面 `mail-actor-spoof` 409 与知识腿 `knowledge-actor-spoof` 403 同形异码」→
  **留**：票面「要定的事」③已定「取本腿既有惯例 403，不引第二个状态码」；语义与命名照 mail
  先例，状态码随各面既有惯例——已在注记与票面写死。
- 判断④「`permissions.js` 新增 → `human-inbox.js` 依赖边（为取 `RULING_ACTOR`）」→ **留**：
  无环（实测 import 图：`task-ledger → human-inbox` 已在；`human-inbox → permissions` 不成立）；
  principal 身份表示的既住地就是 09 号票的 `human-inbox.js`，另立叶件再转出＝多一层中继、
  信息不增。

**Spec 轴**：缺项 3＋疑似 1（**修 3 留 1**）／超范围 0。

- 「无 actor 整体绕过」的洞**已收口；user principal 身份本身仍不需信封（同机持 CSRF 令牌者
  可声明 `{kind:"user",id:"user"}` 登记）」→ **留**：这正是票面「要定的事」②的裁定（user＝
  §D L3 台账全权），前置＝CSRF 令牌（同机进程合法持有，非远程可利用）；本轮把「无身份写入」
  收窄为「唯一 principal 写入」，进一步收紧＝改 §D L3 的 user 全权语义，须用户点名，不在
  本票自授权范围。
- 「A1 的收口在附录 A 无坐标」→ **修**：`V-A4.5` 坐标串追加三条新测试（补执行坐标，不新增
  判据），`acceptance-coordinates.js` 与 `spec.md` 附录 A 同拍回写，双向锁定测试 14/14 通过。
- 「归属门用例标题宣称 user 正例不回退，但 `knowledge.deprecate` 只有伪造负例」→ **修**：
  补 `RULING_ACTOR` 本人废弃正例（200、状态翻 `deprecated`），标题与覆盖相符。
- 「CHANGELOG 复审处置指向的 Comment 不存在」→ **修**：即本条。

**复审后重跑**：`ledger-host` **19/19**、`org-permissions` **11/11**、
`org-acceptance-coordinates` **14/14**、全量回归 **67/67**；preflight 四道门 **PASS**
（①67/67 ②冻结面 0010 包 10/10 ③status-lint 0 违例〔97 md〕④宿主契约 11 PASS/0 FAIL/0 SKIP）。
