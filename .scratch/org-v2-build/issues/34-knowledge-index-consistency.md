# 34: 知识索引一致性双题（A7a 损坏行 id 复用＋A7b 废弃／取代叠加语义）

**What to build:** 知识索引两处一致性缺陷：损坏行导致 id 复用覆盖报告全文；
`deprecate` 与 `supersede` 双写者无共同守卫，叠加语义未定义。

现状（HEAD `d4c24e5` 现行坐标，29 号票独立复核确认，两题均活体复现）：
(a) `lib/knowledge.js:116-135`（`readIndexDetailed` 损坏／非对象行 `{ok:false, raw}`
原样保留）＋205-215（`maxSeqOfYear` 只遍历解析成功条目）＋269
（`seq = max + 1`）＋280（`writeFileAtomic(reports/<id>.md)` 覆盖写）＋314-316
（索引重写保留 raw 行）。实测：索引仅一行截断损坏行＋既有 `R-2026-001.md`
（ORIGINAL）→ 新登记复用 `R-2026-001`，正文被 NEW 覆盖，索引保留损坏行——
索引保线索、正文被吞（头注 23-24 自称 K-2 保留线索，但未处理序号后果）。
(b) `registerReport:301-305`（supersedes 副作用无条件 `prev.status="updated"`＋
`supersededBy`，不清 `deprecatedReason/At`）vs `deprecateReport:354`
（只拦已 `deprecated`）。实测：废弃（带 reason）→ 再被取代 → 终态 `updated`
且残留 `deprecatedReason＋deprecatedAt`；反向（取代后再废弃）同样放行。
规格未定义叠加语义。

**要定的事（开工时先定并写进 Comments）**：

1. (a) 修法（推荐二选一）：损坏行同样占序号位（`maxSeqOfYear` 计入可解析序号形
   式的损坏行，或序号分配跳过“索引行数”水位——以后者为稳），或登记前损坏即拒
   并指修复例程（与 K-2“保留线索”口径的取舍写明）。
2. (b) 状态机封闭（推荐）：`deprecated` 为终态——`supersede` 已废弃条目即拒；
   `deprecate` 已 `updated`（有后继）条目即拒或显式允许并定义残留字段清理规则
   （`deprecatedReason/At` vs `supersededBy` 互斥）。
3. 存量：现网索引若已有损坏行／叠加残留字段，修复脚本口径（一次性核验＋留痕，
   不在本票外另起）。

规格出处：`.scratch/org-v2/spec.md` §G（知识／记忆层）与 10 号票 `V-A7.8`
（显式取代／废弃登记）。

来源：29 号票 A7(a)(b)（2026-09-20 只读审计交接，HEAD `d4c24e5` 独立复核确认；
B7 `reusedBy` 无上限／全量重写 O(n²) 属设计内 append-only，记本票观察不单列——
归档路径缺失信号见 29 号票不立票清单）。

**Blocked by:** 无

**Status:** resolved

## Comments

### 开工前定死（2026-09-28 `/implement 34`，四问全按推荐通过）

- **缝（TDD 预约定）**：缝 A 单缝＝`lib/knowledge.js` 公开面
 （`registerReport`／`deprecateReport`／`nextReportId`＋新增只读
  `auditKnowledgeIndex`，经 `tests/knowledge.test.mjs`）；host 腿
  （`knowledge.register`／`knowledge.deprecate`）调同一函数自动继承，
  不另开缝、不新增 host 用例。
- ① **(a) 序号水位**：`next ＝ max(已解析最大序号，当年好行数＋不可解析行数) ＋ 1`，
  由 `registerReport` 与 `nextReportId` 共用同一 helper；损坏／非对象行仍原样保留
  （K-2 不变）；跳号留空位可接受（安全＞连续）。不选 fail-closed（一条损坏行堵死
  全部登记，可用性代价大）。
- ② **(b) 两终态**：`valid` 以外一律拒——`supersede` 只接受 `status=valid`
 （已 `deprecated` 即拒）；`deprecate` 只接受 `status=valid`（已 `updated`／
  `deprecated` 即拒，各给区分性错误串）；拒绝路径不动任何文件。链式取代走后继
  条目（历史不断链）。不选「允许废弃已取代条目」（须发明残留字段并存语义）。
- ③ **存量**：新增只读 `auditKnowledgeIndex(dshHome)`（报损坏行号＋混合态条目＋
  残留字段，不写盘）＋用例锁定＋修复手顺写本票面，不自动迁移。

### 实施与验证（2026-09-28，`/implement 34`，TDD 三切片红→绿）

- **改件**：`lib/knowledge.js`（`nextSeqForYear` 水位 helper＋`registerReport`／
  `nextReportId` 共用；`supersede`／`deprecate` 两终态守卫＋未知状态 catch-all；
  只读 `auditKnowledgeIndex`；件头不变量注记同步）、`tests/knowledge.test.mjs`
  （8 新增：A7a×2、A7b×4、audit×2）。host 腿零改（调同一函数自动继承）。
- **验证**：`tests/knowledge` **32/32**；全量回归 **68/68**（第 68 件＝并行会话
  未跟踪新件 `tests/project-context.test.mjs`，非本票面）；
  `npm run preflight` 四门 PASS（①68/68 ②0010 包 10/10 ③0 违例 ④11 PASS／
  0 FAIL／0 SKIP）。运行面零写入（全程临时目录＋隔离子进程）。
- **中途纠正一例**：开工曾置 `Status: claimed`，preflight ③即红
  （`claimed` 仅限 wayfinder 票，实现票不得使用，见 `docs/agents/triage-labels.md`
  Terminal states）——已改回 `ready-for-agent`，完工转 `resolved`。

### 存量修复手顺（现网索引已有损坏行／混合态时，人执行＋留痕）

1. 备份：`cp bots/knowledge/index.jsonl index.jsonl.bak-<日期>`（先备份再动手）。
2. 核验：`node --input-type=module -e "import('./lib/knowledge.js').then(m=>console.log(JSON.stringify(m.auditKnowledgeIndex('<dshHome>'),null,2)))"`
   得 `corrupt[]`（行号＋原文）与 `mixed[]`（id＋行号＋problems）。
3. 损坏行：若原文可辨认出正确条目 → 补回好行；否则删该行（序号水位保证后续
   登记不复用其序号，被删序号永空缺）。**删行禁区**：若删后索引将无剩余好行
   （`entries=0`）而 `reports/` 下仍有报告文件 → 不得直接删行（水位随行数消失，
   下一号会回退复用旧 id 并覆盖正文）。此时按“补回好行”处理（从报告文件反推
   id／title 补一条好行），或保留原行。损坏行对应的 `reports/<id>.md` 若仍在，
   正文保留不动（归档不删档）。
4. 混合态：`deprecated+supersededBy` → 删 `supersededBy`（废弃为终态）；
   `updated+deprecatedReason` → 删 `deprecatedReason`／`deprecatedAt`（以后继链为准）；
   `valid+residual` → 删三残留字段任一存在者；`unknown-status` → 按实际应处
   核实后改回三态之一。每改一条记操作留痕（时间＋改因）。
5. 复验：重跑核验，`corrupt` 与 `mixed` 归零 **＋** `nextReportId` 大于 `reports/`
   下既有最大序号（`node -e` 直算，两项齐备才算归零）。

### `/code-review` 双轴处置（2026-09-28，固定点 `32e035a`，本票 4 件 diff，双席并行）

- **Standards**：硬违例 **0**；stale 断言消息 1 **已修**（K-2 既有用例消息
  “损坏/非对象行不计入序号”与新水位矛盾，改记水位公式）；judgement **留 3**：
  ①取代／废弃两处三分支守卫形状重复——留：错误名词须区分（各自点名状态与后继），
  合并损可归因性；②`auditKnowledgeIndex` 自实现解析未复用 `readIndexDetailed`——
  留：需物理行号＋原文，属刻意分叉；③8 新用例样板重复——留：与既有文件体例一致。
- **Spec**：缺失 0／部分 0／creep 0；“看似实现错”3 项**全修**：①audit 行号跳空行
  与手顺“按行号删行”对不上——改物理行号＋空行用例锁定；②手顺“删行即永不复用”
  在仅剩损坏行边角下不成立——补删行禁区＋复验 `nextReportId` 不回退；③残留检查
  只认字符串值（`null` 等漏网）与“任一存在即报”不符——改键存在检查＋非串用例锁定。
- 两轴未处置项均 **0**。复验：知识 32/32、全量 68/68、preflight 四门 PASS。

- [x] 损坏行 id 复用封死（复现用例先红后绿：损坏行＋既有报告 → 新 id 不复用）
- [x] 废弃／取代叠加状态机封闭（双向用例：废弃→取代拒／取代→废弃口径＋残留字段规则）
- [x] 存量核验口径（如有）在案
- [x] 全量回归与 preflight 四道门 PASS
