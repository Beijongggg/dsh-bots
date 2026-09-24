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

**Status:** ready-for-agent

- [ ] 损坏行 id 复用封死（复现用例先红后绿：损坏行＋既有报告 → 新 id 不复用）
- [ ] 废弃／取代叠加状态机封闭（双向用例：废弃→取代拒／取代→废弃口径＋残留字段规则）
- [ ] 存量核验口径（如有）在案
- [ ] 全量回归与 preflight 四道门 PASS
