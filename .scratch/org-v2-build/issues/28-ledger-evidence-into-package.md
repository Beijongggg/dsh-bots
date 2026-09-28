# 28: 台账证据进增量包

**What to build:** 14 号票要求「追加的台账记录可作为证据」，但工具链这一头是空的。

现状：`scripts/evidence-runner.mjs`、`scripts/evidence-packager.mjs`、`lib/evidence-packager.js`
走的是 sourceManifest 加 runId 采集，没有一处读台账的 `events.jsonl`，也不读
`ledger.notificationsAfter`。`events.jsonl` 只在 `lib/host-faces.js` 里登记成宿主面坐标，以及在
`scripts/host-contract-probe.mjs` 的简报夹具里当坐标用。

后果：附录 A 里标「证据落点＝台账事件／增量包」的那些实验期一次条目（`V-A2.2`、`V-A2.5`、
`V-A2.8`、`V-A3.5`、`V-A5.2`、`V-A5.3`、`V-A7.4`）跑完演练后，结论往哪放没有定形。要跑演练
（`DRILL_WINDOWS` 已登记窗口）之前得先把这条通道定下来。

**要定的事（开工时先定并写进 Comments）**：

1. 形态：把台账事件**复制进**增量包当原始证据，还是在包里存一份**摘要＋指针**（包外引用活台账）。
   复制进包能离线复验但会让包变大且可能带上别人任务的记录；存摘要＋指针复验要靠台账在场。选一种，
   另一种写明理由。
2. 范围：采全量事件还是按 runId 窗口切。切窗要看得出「这段时间里发生了什么」，同时不能把窗口外
   的事实混进来。
3. 复验：复验方拿到证据后怎么独立核对（哈希链？逐条重算 eventHash？`validateEventRecord` 在库
   里已有，能不能直接复用）。
4. 与冻结面的关系：`artifacts/packages/` 里的包是冻结件，只新增不覆盖（AGENTS.md §3）。本票产出的
   新包走新序号。

规格出处：`.scratch/org-v2/spec.md` Testing Decisions（证据落点）与附录 A 各条的「证据落点」列。

来源：14 号票 recon 发现 G9，14 号票 Comments「recon 余项」。

**Blocked by:** 无（但 16 号票切换批与各演练的证据落点依赖本票定形）

**Status:** resolved（2026-09-24 原票返修完成；实施、验证与复审见 Comments 末条）

- [x] 台账证据进包的形态定死（复制或摘要＋指针，写明理由）——**复制进包**，被否方案与理由见 Comments ①
- [x] 采集范围按 runId 窗口切，窗口外事实不混入——`seq ∈ (fromSeq, toSeq]`，窗口内收全；整文件规模入 `source` 不隐藏
- [x] 复验路径可在包外独立重算（复用 `validateEventRecord`）——`scripts/ledger-evidence-verify.mjs`，台账不在场亦可验
- [x] 新包走新序号，冻结件不覆盖——`review-evidence-package-0010-405fdf54.json`（`wx` 排他；0001–0009 零改动）
- [x] 至少一条演练的证据真进包（端到端，不只有单元测试）——run `e81db1d9…` 的 `drill-ledger-rebuild` 演练窗口 8 条事件＋查询结论进 0010 包
- [x] 全量回归与 preflight 四道门 PASS——67/67；①67/67 ②0010 包 10/10 ③0 违例扫 97 md ④11 PASS / 0 FAIL / 0 SKIP

## Comments

### 开工前定死（2026-09-24 `/implement 28`——票面「要定的事」四件）

**① 形态＝复制进包（选 A）；不选「包内摘要＋指针（包外引用活台账）」（B）。**

- A ＝窗口内台账事件**逐条复制进包**（`executionEvidence.ledgerEvidence.events`），
  另在 run 内落一份原始证据件 `artifacts/runs/<runId>/ledger-evidence.json`；包内以
  **完整 64 位 SHA-256＋byteLength** 绑定该件（`raw.payload.ledgerEvidence` 只带 binding，
  不在 raw 里复制第二份）。
- B 不选的理由：包是**冻结件**（只新增不覆盖），台账是**活文件**（append-only、包外、
  随每个 run 增长）——指针指向的活台账在包写出之后必然漂移，「包内摘要只能引用已存在
  产物」的 E4 口径（逐文件 sha256＋byteLength 账实相符）对活台账不成立；且当前真实
  运行面 `~/.dsh/bots/ledger/` 尚不存在（org-v2 台账未接线），指针形态连一次核验都做不了。
- A 的两条已知代价就地接管：**包变大** → 按窗口切，只收本 run 窗口内事件；
  **可能带上别人任务的记录** → 窗口内**收全不挑选**（挑过的窗口 seq 会断，复验直接红），
  且 `source` 里登记整文件规模与首末 seq：窗口外既**不混入**、也**不隐藏**。
- 指针没有丢（只是不许把活台账当事实源）：`source.path`＋整文件 sha256/byteLength/行数/
  首末 seq 与 `window` 一起进包；台账在场时复验器可**再切一次同一窗口**交叉核验。
  整文件在包后继续增长＝append-only 常态，不算证据坏；**窗口内容**对不上才红。

**② 范围＝按 runId 窗口切：`seq ∈ (fromSeq, toSeq]`。**

- 下界缺省＝**本 run 起步时观测到的台账末位 seq**（＝「这个 run 期间新增了什么」）；
  演练 run 显式 `fromSeq=0`（隔离演练根自建台账，窗口＝整段演练）。上界＝落证据时刻的
  末位 seq。窗口内收全；窗口外既有事实不进包。

**③ 复验＝复用台账自己的 `validateEventRecord`（逐条重算 eventHash）＋窗口 seq 连续。**

- 复验方拿**一个包文件**即可复算，不要求台账在场、不要求宿主在跑：
  `scripts/ledger-evidence-verify.mjs`（只读；台账在场时可加 `--ledger-events` 做同窗
  交叉核验）。结论**以复算为准**：自陈绿而实算红、自陈 checked 与复算不符，都算失败。
- 为让证据面的执行闭包只多三件而不是整张组织图，本轮做了一次**行为保持抽取**：
  台账事件类型表／负载键白名单／两张事实表词表（裁定类、上浮原因）＋校验器从
  `lib/org/task-ledger.js` 下沉到叶件 `lib/org/ledger-events.js`（除 `./store-base.js`
  外零依赖；`task-ledger.js`／`human-inbox.js` 原地再导出，既有调用方零改动——抽取后
  两模块导出的是**同一个函数引用**，02 号票「同一原语不得在两处各留一份」不破）。
  **理由**：证据链的执行闭包就是 preflight 门② 的冻结面复验对象，把组织图拉进闭包＝
  此后每次改 `lib/org/*` 都要重出证据包才能过门②。

**④ 冻结面关系＝新序号增量包，只增不覆盖。** 本票产出 `artifacts/packages/` **新序号包**
（包写出恒 `wx` 排他，文件名内嵌自身 SHA）；既有 0001–0009 包、`docs/TEMP-*`、
`docs/CLOSURE-*` 零改动。

### 落地（2026-09-24）

- **契约**：包 schema `/3 → /4`，`executionEvidence.ledgerEvidence` 为**必填段**（缺段即
  失败＝禁二不修补）；台账证据件 schema `ledger-evidence/1`；演练报告 schema
  `ledger-drill-report/1`。
- **采集**：`scripts/evidence-runner.mjs` 新增 `--drill <登记 id>`／`--ledger-events <路径>`
  ／`--ledger-window-from <n>`；Phase 1 观测窗口下界；演练与采集都发生在**后置污染核验
  之前**（演练子进程若碰真实运行面会被同一把只读快照抓成不 clean）；段内失败 fail closed
  ——run 仍落 raw/capture/终态记录（证据全在），但终态 `failed`、不得打包。
- **演练**：`scripts/ledger-drill.mjs` 在**隔离数据根**（run 目录内；真实运行面零写入）
  驱动真实台账命令面跑 `drill-ledger-rebuild`（`V-A2.2`）：intake／planned／assigned 三张
  未闭合任务就位 → 停 host（释放写锁）→ 冷启（同根建新门面）→ `openQueue()` 重建集合并
  与停机前逐行比对。**本票只落这一条演练的端到端**；登记表其余六条在本器上**显式拒绝**
  （不静默空跑），其证据落点仍待各自窗口（16 号票切换批／验收实验期）。
- **登记面不变**：`DRILL_WINDOWS[drill-ledger-rebuild].evidenceLanding` 原文即「增量包
  （runId 采集）＋台账查询结论（openQueue 重建集合）」——本票落地的正是这条通道，故
  `DRILL_WINDOWS` 与规格附录 A「证据落点」列**零改动**（规格语义摘要基线不动）。
- **闭包增量（实测）**：runner∪packager 执行闭包 7 → **10 件**（＋`lib/ledger-evidence.js`、
  `lib/org/ledger-events.js`、`lib/org/store-base.js`；**组织图不进闭包**——
  `tests/sentinel-provenance.test.mjs` 加了反向断言把这条盯死）。
- **测试面**：新增 4 个测试模块（`tests/ledger-events.test.mjs`／`ledger-evidence.test.mjs`／
  `ledger-drill.test.mjs`／`ledger-evidence-verify.test.mjs`）；`evidence-packager`／
  `evidence-runner-contract`／`sentinel-provenance` 三件随契约 /4 与闭包断言同步更新。
- **验证结果**：**全量回归 67/67**（新增 4 个测试模块＋3 个既有模块同步）。
  **preflight 四门 PASS**：①67/67 ②冻结面 **0010 包 10/10** ③0 违例扫 97 md
  ④11 PASS / 0 FAIL / 0 SKIP。
  **端到端证据**：run `e81db1d9-af91-4555-8069-ccb0f8778d61`（回归 67/67；受保护面
  verified+clean；`--drill drill-ledger-rebuild` 在隔离演练根跑出 8 条台账事件、7 项检查
  全绿；窗口 `(0, 8]`）→ 增量包 `artifacts/packages/review-evidence-package-0010-405fdf54.json`
  （SHA-256 `405fdf54d53f76508e6e628bf8e8c9b0c7da7cfa1a91130c82f9c6e2027a5470`，
  schema `evidence-package/4`，basePackage＝0009）；**包外独立复算**
  `node scripts/ledger-evidence-verify.mjs --package artifacts/packages/review-evidence-package-0010-405fdf54.json`
  → exit 0（逐条重算 8 条事件 eventHash、窗口 seq 连续、sliceDigest／计数／绑定件四项
  账实、演练 7 项检查）。首次 e2e run `893ab789-8196-4601-bd0f-9dc2ba69a8a8` 因
  `realSurfaceCheck.clean=false` failed（唯一差异＝宿主自身 `proxy-fallback/forwarder-state.json`
  变动）——据此补登豁免 `/^proxy-fallback\//`（理由见该段注释与 CHANGELOG），该 run 的
  raw/capture 原样留档。
- **`/code-review` 两轴复审（HEAD `230784d` vs 工作树）**：
  - **Standards**：硬违例 3 全处置——①`finish()` 里 run 目录创建被误移进 completed 分支
    （失败 run 会 ENOENT，非行为保持）→ 已改回无条件创建；②usage 头载了代码从不读的
    幽灵开关 `--ledger-artifact-root` → 已删；③CHANGELOG 缺位 → 本条目补。judgement 5：
    kind 封闭枚举＋去 `kind`／`fromSeq` 静默缺省＋「演练 ⇒ 必为隔离演练根」交叉把守
    （已改，含测试）；「逐字节一致」实为键序敏感比较 → 改**规范化 JSON 逐字段一致**
    （复用 `canonicalJsonString`）并纠正措辞；E4 绑定核验三份 → 合为**唯一读取点**
    `loadAndVerifyLedgerEvidence`（packager 写路径／CLI 读路径／包外复验器共用）；
    human-inbox 头注与新 import 关系失真 → 已改；演练取测试夹具简报 → **维持**（同一契约
    唯一一份合法件，抄一份字面量反而违反「同一原语不得在两处各留一份」；依赖随演练报告
    `sourceManifest` 登记，不进证据链冻结闭包）——理由写入 `scripts/ledger-drill.mjs` 件头。
    抽取本身经逐块对照 HEAD 判**干净**（文本逐字一致、单对象身份与叶件 import 面均有测试）。
  - **Spec**：票面 Comments 缺位（L14「开工时先定并写进 Comments」）→ 已补；窗口口径
    与票面「按 runId 窗口」的对应已写明（事件无 runId 字段，窗口＝`seq` 区间＋本 run
    时序，代价与反措施见 ①）；演练 1/7 已实落＋其余六条显式拒绝（登记面 `DRILL_WINDOWS`
    零改动）；范围超出「只定通道」的两处（叶件抽取、schema /4 必填段）理由已写入 Comments
    与件头；`scripts/evidence-runner.mjs` 一处形态注释写反（「包内只放摘要＋指针」）→ 已改
    为「raw 只带绑定／run 内证据件＝原始产物／包内＝复制进事件」三段自述；`source` 整文件
    sha256/byteLength 系**记录性**绑定（台账在场时可交叉核，append-only 增长不算坏），
    已在 Comments ① 写明其定位。两轴均无未处置项。
- **并列会话**：本票实施期间另一会话在同一工作树并行做 27 号票；本次提交只含本票路径，
  27 号票票面改动未并入、未触碰。
- **可复现输入（未跟踪附件，按既有惯例不入 git）**：
  `.scratch/org-v2-build/attachments/28-ledger-evidence/` 下放本轮 `human.json`（包内人工块
  原文）、`modified-files.json`／`new-test-modules.json`（packager 入参）、两个 e2e run 的
  runner stdout／stderr 与 preflight 输出——证据包本身自带完整绑定，附件只是便于复核。

### 2026-09-24 复审返修启动

用户在任务量评估后指令「启动」，授权原票返修。现 CLI 虽能复算包内事件，却因
绑定附件不可访问而整体失败，未兑现本票「一个包文件即可复算」的承诺。
本次在独立复验 CLI 接缝区分默认的包内复算与显式附件交叉核验；后者仍调用既有
严格绑定校验器。补没有原附件／台账的离线正例、包内篡改负例与附件核验正负例。
打包阶段的 E4 校验保持，计划只改非冻结 CLI、测试与文档，不覆盖既有证据件。

### 2026-09-24 复审返修完成

- **根因与修复**：原 CLI 在包内复算后无条件读取 binding 指向的附件。现在
  `--package <包>` 默认只复算嵌入的台账证据段，输出 `artifact:null`；显式加
  `--check-binding` 才调用 `loadAndVerifyLedgerEvidence` 严格核附件路径、哈希、
  字节数与内容一致性。`--artifact` 单件复算及 `--ledger-events` 同窗核验保留，
  `--artifact` 与 `--check-binding` 同给按用法错误拒绝。CLI 不宣称重验整包。
- **回归**：复制包后删除夹具原 run 与台账根，仍可独立验绿；包内事件／digest／窗口／
  自陈篡改、显式附件缺失／篡改仍判红。先复现原附件缺失导致独立复算失败，再修至绿。
- **返修复审**：固定点 `a04707c` 的两轴复审：Standards 0 项；Spec 1 项 P2——
  `--ledger-events` 缺值会吞掉后面的 `--check-binding`，合法空窗包可假绿。已先补
  真实 CLI 失败回归，再令路径参数拒绝缺值、空串及后续开关，报 exit 2 且不输出
  复验结论。Spec 独立复跑 `node tests/ledger-evidence-verify.test.mjs` **6/6**；
  Standards 增量复核通过，两轴未处置项均 0。
- **实包验证**：0010 包在 Node 权限子进程中只放行包文件与仓内执行依赖、禁止读取
  原 run 附件时，独立复算 exit 0、8 条事件通过、`artifact:null`；通常只读环境下
  同包加 `--check-binding` 亦 exit 0、附件检查通过。原包与附件均未修改。
- **收口与边界**：最终 `npm run preflight` 四门 PASS：①67/67 测试文件；②0010
  冻结面 10/10；③0 违例（97 md）；④11 PASS／0 FAIL／0 SKIP。授权沿用上条用户
  「启动」。打包器、台账证据库及事件校验叶件均未改，E4 与 schema 保持；没有重出
  证据包，真实运行面、旧包／raw／ledger 零写入。
