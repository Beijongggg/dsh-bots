# 27: 复核帽的台账腿不验帽

**What to build:** 复核报告的落账面只认字符串，不认帽。

现状：`lib/org/task-ledger.js::recordReviewReport` 校验三件事（报告形状、提交者＝被指定的复核者、
提交者≠产出方），但**不要求提交者当时真持复核帽信封**。帽信封的验签只在 HTTP 面
（`lib/org/ledger-host.js` 的 `POST /api/bots/_ledger/reviews` 走 `createReviewFaceGate`）。
所以换一条通道（进程内直接调台账门面）就能交一份「复核报告」而全程没有帽。

**要定的事（开工时先定并写进 Comments）**：

1. 权威门放哪。两种都说得通：把帽验签接进台账复核面（那么进程内直调也须持帽），或者把
   「台账腿为权威、通道门只做入口把关」写成显式口径并给出理由。选一种，另一种写明为什么不选。
2. 帽是**单次消费**（`consumeNonce`）。台账腿若也验签，就会与 HTTP 门重复消费同一个信封而互相
   打断。设计上要让「一次提交恰好消费一次」成立：入口验签的结论要不要随命令传下去（像
   capability 走命令面那样），或让台账腿成为唯一消费点。
3. 读面与写面口径不同：读移交件（`GET /review-handoff`）不消费 nonce，是既有约定，别改。

**负例要求**：无帽提交即拒；他人帽即拒；帽不属本任务指明者即拒；被拒不消耗帽（或按第 2 条
定死的口径写明消耗规则）。既有 HTTP 面的负例不得回退。

规格出处：`.scratch/org-v2/spec.md` §C（复核件套：复核者是另一实例、复核帽当次佩戴）与 §A
（复核者按需召集，注册表无常驻复核席位）。

来源：14 号票 recon 发现 G4，14 号票 Comments「recon 余项」。

**Blocked by:** 无

**Status:** resolved（2026-09-24 原票返修完成；实施、验证与复审见 Comments 末条）

- [x] 权威门与通道门的口径写死（并把不选的那条写明理由）
- [x] 无帽／他人帽／非指定复核者三条负例在**台账腿**成立
- [x] 单次消费不被打断：一次提交恰好消费一次，有测试
- [x] HTTP 面既有负例不回退
- [x] 全量回归与 preflight 四道门 PASS

## Comments

### 开工前定死（2026-09-24 `/implement 27`，要定的三件事）

**① 权威门放台账腿（选 A）；不选「台账腿为权威、通道门只做入口把关」（B）。**

- A＝把帽验签接进台账复核面：`recordReviewReport` 是**写路径**，报告是事实源里的事件
  一条；帽是唯一的写授权凭据（op-set：复核帽只持读类＋`review.report`，无台账写 op）。
  权威门必须坐在**唯一写者**门口——任何通道（HTTP、进程内直调、将来别的面）都得持帽。
- B 不选的理由：B 承认「进程内直调可无帽入账」，即**事实源可被无凭据写入**——与 §D L2
  「事件只能经命令面写」＋「复核帽＝契约帽子」直接冲突，也与本仓「未落档即未发生」的
  记账纪律冲突；入口把关挡不住进程内调用，挡得住也只是一条通道的自觉。**通道门据此
  降级为「预筛」**（HTTP 提前给 403、不消耗帽、不做事实判定），权威判定只此一处。

**② 唯一消费点＝台账腿；消费规则写死为三段式（与命令面同口径）。**

1. **预验（不消费）**：`verify({consumeNonce:false})`——签名／TTL／代际／活态／身份。
2. **帽腿（纯判定，不消费）**：`post=verifier` 且 `op ∈ payload.ops`。**放在消费之前**：
   非帽信封（如误投的任务能力）**不被烧**——越权尝试不消耗任何人的帽。
3. **消费（唯一消费点）**：`verify({consumeNonce:true})`＝复验＋`consumeNonceOnce` 独占
   消费——**帽腿之后的第一个动作**（两者之间无状态改动）。一次提交恰好消费一次（单次
   消费语义不变：信封即一次尝试）。**消费与复核报告落账之间只剩确定性校验**（形状／
   任务态／指定关系），校验不过即落 `command-rejected` 拒绝事件、**消费不回滚**——与
   命令面同构；故「消费与落账紧邻」的准确表述＝**消费紧邻帽腿**，不是「与落账之间无
   任何写入」（初稿此句已按实测更正）。

**消耗规则（写死）**：**过了帽腿（第 2 段）即消费**——其后的确定性拒绝（报告形状／
任务终态／产出方自任／未请求 subject／非指定复核者）**照旧消费**，与命令面「授权通过
而命令被拒同样消费信封＋续签」完全同构（21 号票①）；**未过帽腿的拒绝（无帽／他人帽／
非复核帽／帽缺 op）与预验失败（过期／重放／代际）不消费**，与命令面「鉴权门之前的
拒绝不续签」同构。故「被拒不消耗帽」的准确表述＝**被帽腿拒即不消耗帽**；帽腿之后的
实体拒绝照旧消费，代价由续签补回（下条）。

**③ 读面（`GET /review-handoff`）不消费 nonce：既有约定不变**（读重放无害）；且通道门
现在**整体不消费**，读／写两面的差别只剩「写面额外经台账腿做权威判定与消费」。

**续签口径（ledger-host；初稿写「续签条件＝通道门通过」，复审实测后更正为命令面同口径）**：
续签条件＝**入账成功 ∪ 拒绝发生在帽腿之后**（台账回执带 `authorized: true`＝授权有效且
信封已被本次提交消费）。**初稿的「通道门通过即续签」有洞**：预筛不查 nonce，故一张
**已消费**的旧帽照样通过预筛、被台账拒（`capability-replayed`）却仍换到一张新帽＝
无限续杯，违反「越权尝试不换新信封」。更正的机制＝把续签判据挪到能看见消费事实的地方
（台账回执的 `authorized` 标记，照 21 号票①命令面口径）。据此：台账腿的实体拒绝
（review-not-requested／reviewer-is-producer 等常态拒绝）照旧续签、连报不断链；
**帽腿之前的拒绝（含已消费重放）与预筛 403 都不续签**。HTTP 面既有负例（未携帽 403
`capability-malformed`、他人帽 403 `capability-bot-mismatch`）状态码与结论码**逐字不变**。

**接线与 fail closed**：台账新增注入缝 `reviewHat`（＝capability 签发/验签门面；本面只调
`verify`，从不签发——签发权仍在 host）。**未接线即拒**（`review-hat-unwired`，照
`acceptance-check-unwired` 先例）——不做「未接线就跳过验帽」的 fail-open 降级。宿主接线
＝`lib/index.js` 把同一个 `capabilityIssuer` 同时给 `reviewGate` 与台账。

**负例（台账腿，全部落常驻测试）**：无帽→`capability-malformed`；他人帽→
`capability-bot-mismatch`；非复核帽（post≠verifier）→`review-hat-required`；帽缺
`review.report`→`review-hat-op-missing`；帽有效但非本任务指明者→`not-designated-reviewer`；
已消费帽重放→`capability-replayed`；未接线→`review-hat-unwired`。**反驳面**（帽被消费／
未被消费的机械证据）：同一信封二次提交必 `capability-replayed`；被帽腿拒后同一信封仍可
正常提交（证明未烧）；非复核帽信封在复核面被拒后，同一张信封在命令面照常可用（证明
「帽腿在消费之前」不是纸面条款）；续签判据的机械面＝帽腿之前的拒绝回执不带
`authorized`、帽腿之后的带（host 据此续签）。

**规格坐标**：本票落地为常驻测试，按 14 号票「坐标齐备度」回写 `V-A3.2`（L2 组织命令经
认证 host 通道）执行坐标。

### 实施与验证（2026-09-24 `/implement 27` 收口）

- **实现**（4 改件）：
  - `lib/org/review-kit.js`：抽出**单一源** `verifyReviewHat({issuer, envelope, botId, taskId, op, consumeNonce})`
    （验签腿＋帽腿；`issuer` 缺＝`review-hat-unwired` fail closed）；`createReviewFaceGate` 改用它并
    **整体不消费** nonce（降级为入口预筛）。
  - `lib/org/task-ledger.js`：`recordReviewReport({…, capability})` 三段式（预验→帽腿→唯一消费点）；
    帽腿之后的 reject 回执带 `authorized: true`（只入回执／幂等预留，不进事件）；`createTaskLedger`
    新增注入缝 `reviewHat`（畸形注入＝构造期抛；显式留空＝运行时 `review-hat-unwired`）。
  - `lib/org/ledger-host.js`：信封随命令传给台账；**续签判据＝入账成功 ∪ 帽腿之后**（见上「更正」）；
    `lib/org/post-channel.js` 注释同步。
  - `lib/index.js`：同一 `capabilityIssuer` 同时给 `reviewGate`（预筛）与台账（`reviewHat`）。
- **测试**（5 件）：`tests/task-ledger.test.mjs` 新增 3 条（帽腿负例＋未接线 fail closed＋单次消费／
  不烧帽的机械证据），既有 5 条复核用例改为**持帽**（产出方自任＝持帽亦拒）＋`walkToSettled` 缺帽响亮抛；
  `tests/ledger-host.test.mjs` 新增「消费点在台账腿」一条（预筛不消费／重放不续签）；
  `tests/org-ledger-authz.test.mjs` 新增「非复核帽信封不被烧（复核面拒后命令面照常可用）」一条；
  `tests/org-review-kit.test.mjs` gate 用例改为断言**两条面都不消费**；
  `tests/helpers/capability-fixture.mjs` 新增 `wireReviewHat`（issuer→台账(reviewHat)→bindLedger 的单一源装具）。
- **规格坐标**：`V-A3.2` 执行坐标扩 `tests/task-ledger.test.mjs::复核报告入账验帽`，经
  `node scripts/acceptance-coordinates-sync.mjs --write` 回写（60/60 同拍；判据文本／证据／级别零改动，
  语义摘要基线不受影响）。
- **验证**：TDD 三条新用例先红（`naked.ok === true` 即本票的洞）后绿；`task-ledger` 57/57、
  `org-review-kit` 18/18、`ledger-host` 17/17、`org-ledger-authz` 19/19、`org-closed-loop-smoke` 6/6；
  全量回归 **63/63**；preflight 四道门 PASS。冻结面零改动、运行面零写入。
- **复审处置**（`/code-review` 双轴，固定点 `230784d`，双席并行）：
  - **Spec 轴 高（已修）**：「预筛通过即续签」＝**已消费旧帽可无限换新帽**（预筛不查 nonce，
    实测 409 仍带新帽）。处置＝续签判据改为「入账成功 ∪ 帽腿之后（`authorized` 标记）」，命令面同口径；
    并以测试钉死（重放 409 **不带** capability；实体拒绝仍带`authorized` 且续签，21 号票①链不断）。
  - **Spec 轴 部分（已修措辞）**：初稿「消费与落账紧邻」与实测不符（消费与 `review-reported` 之间
    尚有确定性校验，校验不过落 `command-rejected`）——已在开工前定死段更正为「消费紧邻帽腿；
    消费不回滚」。
  - **两轴 跨子系统（已注解，不扩面）**：新拒绝落 `command-rejected`（op=review.report），按 20 号票
    既有词形规则分别落 count／ignore／reset；`lib/org/human-inbox.js` 词表注释加 27 号票注记，
    **不扩** `UNAUTHORIZED_CODES`（那是 §D 计数面的语义，另票再议；命令面同型向量已存在）。
  - **Standards 轴 硬违例 1（已履行）**：缺 CHANGELOG 顶部条目＋票面未收口——本条与
    `Status: resolved`／勾选即该步（落档见本票条目）。
  - **Standards 轴 判断项（处置）**：①指定关系两处两码（gate 请求级 `review-not-designated`／台账
    逐 subject `not-designated-reviewer`）＝**留**：读面（移交件）无 subject，请求级腿是读面唯一的
    把守点，两码均为既有断言面，权威在台账腿；两处职责已在代码注写明。②测试装配重复＝**修**：
    抽 `wireReviewHat` 单一源（`org-ledger-authz` 的 mkRig 例外：鉴权器须夹在 issuer 与台账之间，
    为该一处扩成回调形态属投机一般化，故保留其显式装配并注明）。③`issueHat` 缺省静默＝**修**：
    有复核点却缺 `issueHat` 即响亮抛。④测试断言 gate↔issuer 调用参数（`consumeNonce`）＝**留**：
    该断言钉的正是「通道门不消费」的契约，属预筛与签发面的接口证据（既有模式）。
- **并发写者隔离**：实施期间主工作树有另一会话在改 `lib/org/task-ledger.js`（28 号票行为保持抽取），
  经用户裁定本票在独立分支 `ticket-27-review-hat-ledger-leg`（worktree `.worktrees/ticket-27`）实施，
  未触碰主工作树；合并由用户执行（合并点：`task-ledger.js` 与 `CHANGELOG.md` 顶部）。

### 2026-09-24 复审返修启动

用户在任务量评估后指令「启动」，授权原票返修。已消费帽配原幂等键会返回缓存
结论，HTTP 面却再次签发新帽。本次沿用复核 HTTP 接缝，恢复与命令通道一致的
「幂等重放不重签」规则，覆盖成功／已授权拒绝的缓存结论及旧帽／新帽两种重放。
首次消费后的正常续签与读面不消费语义保持。

### 2026-09-24 复审返修完成

- **根因与修复**：缓存回执中的 `ok`／`authorized` 描述首次结论，不能证明本次发生了
  消费。复核 HTTP 续签条件增加 `result.replayed !== true`，与命令通道一致。
- **回归**：扩展既有成功入账与已授权拒绝用例，分别用已消费旧帽、新签帽携原幂等键
  重放；断言不发新帽、不追加事件，新签帽仍可携新键使用并正常续签。
  先复现重复签帽再修至绿；`node --test tests/ledger-host.test.mjs` **19/19**。
  原独立重放脚本复跑：首次返回新帽，两次缓存重放均不返回新帽，报告事件仍仅一条。
- **坐标与复审**：`V-A3.5` 补两条 HTTP 回归坐标，规格与登记面同步；判据语义不改。
  固定点 `a04707c` 的本批两轴复审在本票均无发现。全批 Spec 的 28 号票 P2 已修并复核。
- **收口**：最终 `npm run preflight` 四门 PASS：①67/67 测试文件；②0010 冻结面
  10/10；③0 违例（97 md）；④11 PASS／0 FAIL／0 SKIP。授权沿用上条用户「启动」；
  只改仓库工作树，真实运行面、旧包／raw／ledger 零写入。首次消费的续签、预筛与读面
  不消费的规则保持。
