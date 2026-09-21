# 14: 最小闭环烟测与验收坐标补齐

**What to build:** v2 组织层在仓库侧真正**跑通一次完整任务**，并把冻结的验收判据落成可核坐标。
**最小闭环**：收单→派单→实施→复核帽→结算，走完全链且**台账事件投影可核**（这是切换批的野外样本，
也是「规格被完整实现」的第一道实证）。**A 组 60 条执行坐标补齐**：规格附录 A 里标「坐标待实现批
补齐」的条目逐条落到测试模块名／门号／台账查询语句／探针脚本，**A 组坐标无空缺**（缺一条即不满足
切换点判据）。**只补坐标、不改判据语义**——判据语义在规格定稿时已冻结；挂标条目（`V-A1.4`）的
单列计数维持 1。

规格出处：`.scratch/org-v2/spec.md` §I（切换点判据第 4 条）、Testing Decisions（坐标齐备度）、附录 A。

**Blocked by:** 06、07、08、09、10、11、13

**Status:** resolved（2026-09-21 实施批收口，凭据见 Comments）

- [x] 最小闭环真跑通：收单→派单→实施→复核帽→结算，台账事件投影可核
      （新 `tests/org-closed-loop-smoke.test.mjs`：一条任务**真跑**全链，走真 HTTP 命令面／复核面、
      真 capability 签发与鉴权三元组、真台账落盘；断言＝主干十态逐事件重放投影按序走完＋终态
      `closed`＋换只读门面重投影同结论＋通知＝事件投影＋复核帽当次空闲实例佩戴。
      **范围注（复审后如实标注）**：这是**仓内确定形** smoke（确定性骨架＋投影可核），不等同 §I 切换段
      在真运行面上的一次 smoke——那需部署面在场与逐项点名授权，归 16 号票「就绪探针 PASS，且一次最小
      闭环 smoke 通过」段执行）——2026-09-21
- [x] A 组 60 条执行坐标无空缺（逐条落到测试模块名／门号／台账查询语句／探针脚本）
      （新 `lib/org/acceptance-coordinates.js` 60 条封闭坐标表＋坐标文法解析（测试名／脚本／模块／
      门号／查询／探针 id／演练 id 逐记号解析到真实落点，测试名须唯一命中）＋规格附录 A **双向锁定**；
      实测 60/60 解析成立、零空缺——原唯一硬空缺 `V-A6.7` 由下方第 6 项补上）——2026-09-21
- [x] 判据语义未被改动（只补坐标）；挂标条目单列计数维持 1（`V-A1.4`）
      （规格附录 A **仅第三列坐标＋级别列**回写，判据文本与证据列零改动；spec.md 哈希
      `28979de6…` → `47033ad1…`；`V-A1.4` 挂标标注与「挂标条目（1 条）」计数由测试双向把守）——2026-09-21
- [x] preflight 四道门 PASS；全量回归 PASS
      （①61/61 ②冻结面 0009 包 7/7 ③0 违例扫 73 md ④11 PASS / 0 FAIL / 0 SKIP；`preflight: PASS` exit 0）——2026-09-21
- [x] 常驻判据已落成测试模块（随每批回归执行）；实验期一次的条目已登记执行窗口
      （常驻＝两个新测试模块（闭环烟测 6 条／坐标与锁定 8 条）＋加固 `tests/preflight.test.mjs` 门序断言；
      实验期一次＝`DRILL_WINDOWS` 7 条演练登记「窗口·承载代码路径·证据落点」——**登记≠已执行**）——2026-09-21
- [x] 探针失效以 class=duty 例程任务落台账承载、不新增台账事件类型（`V-A6.7`）
      （新例程 `duty-probe-failure`＋host 侧腿 `ledger-host.registerProbeFailure`：失效本体作既有
      `exception`（`waiting-external`）事件登记在处置任务上，台账事件词表零扩条；幂等两段＋投影广播；
      触发源声明由 `checkProbeFailureRoutineTrigger` 前置核验（登记表被改坏即在落台账前响亮拒）。
      **范围注（复审后如实标注）**：本票交付**腿＋声明核验＋回归**；§H「可见可归因」链的**触发接线**
       （谁在探针 FAIL／运行面 SKIP 时调用本腿——宿主巡检编排）归 16 号票切换批接线，本票不宣称
       全链已通）——2026-09-21
- [x] 人工判据仅限白名单两类（前端目视功能清单、知识复用率核对）且已列明核验人
      （机械面＝`HUMAN_CRITERION_CATEGORIES` **恰两类**＋核验人字段与署名状态自洽校验＋各自执行窗口与落档面；
      **核验人署名留界**——署名归人、代签＝落档作假，人工件归 18 号票同件承载，执行时点仍在 16 号票切换批
      之后，2026-09-21 用户裁定）——2026-09-21

## Comments

### 实施批（2026-09-21 `/implement 14`，用户点名授权）

**交付面**：3 lib（`lib/org/acceptance-coordinates.js` 新、`task-ledger.js`、`ledger-host.js`、
`dispatch-config.js`）×1 脚本（`scripts/acceptance-coordinates-sync.mjs` 新）×3 测试
（`tests/org-closed-loop-smoke.test.mjs` 新、`tests/org-acceptance-coordinates.test.mjs` 新、
`task-ledger.test.mjs`、`ledger-host.test.mjs`、`preflight.test.mjs`）＋规格附录 A 60 行坐标回写＋
`CONTEXT.md` 坐标机械面＋CHANGELOG 条目。

**两处范围裁定（用户两问，2026-09-21）**：
1. **关闭前置（§B）**：recon 发现 `task.close` 此前**无任何前置门**——未验证的任务能被关掉，smoke 会假绿。
   裁定＝**实现两项可机械判定的**（命中复核点已闭合＋产出已按「谁产出谁登记」登记），
   **第三项「验收判据均有可执行检查的通过记录」留界**（探针结果只回调用方、事实源无承载面；
   不凭空发明一种记录）。范围＝`class=project` 任务（duty 例程任务承载面＝台账本身，不适用登记门）。
2. **recon 余项发现**（G2／G4／G5／G9）：裁定＝票面记发现、另立票与否按任务量评估直接操作
   （本轮判定＝均为**增面**而非本票 checklist 项，**不就地扩票**，登记见 CHANGELOG 与下方）。

**判据落点（逐条）**：

| 票面部件 | 机械落点 |
| --- | --- |
| 最小闭环真跑通 | `tests/org-closed-loop-smoke.test.mjs`（6 条：全链贯通／投影可核／通知投影／复核帽与必审拦截／真能力链与交付吊销／关闭前置与终态只读） |
| A 组坐标无空缺 | `lib/org/acceptance-coordinates.js`（`A_GROUP_COORDINATES` 60 条＋`resolveCoordinateToken` 文法解析＋`scanAcceptanceSpec` 双向锁定＋`rewriteAppendixA` 回写器）；回写脚本 `scripts/acceptance-coordinates-sync.mjs` |
| 判据语义未改／挂标计数 1 | `tests/org-acceptance-coordinates.test.mjs`（规格锁定正负例；`V-A1.4` 挂标与「挂标条目（1 条）」断言） |
| 探针失效承载（`V-A6.7`） | `tests/ledger-host.test.mjs`（`registerProbeFailure` 正负例：class=duty／既有 exception（`waiting-external`）／事件词表零扩条／幂等两段／投影告知） |
| 实验期一次窗口登记 | `DRILL_WINDOWS`（7 条：台账重建／租约回收／挂起／签发吊销／收件箱／模型更迭／探针失效——窗口·承载·证据落点四件齐备，由测试把守） |
| 人工判据白名单 | `HUMAN_CRITERION_CATEGORIES`（恰两类；核验人＝`null`＋`pending-signature`，署名与状态同拍校验） |
| `V-A6.5` 加固（门序） | `tests/preflight.test.mjs`（四门结论行压入顺序＋④ 独立子进程＋四门 AND 单出口） |

**留界（在案，非本轮范围）**：

1. **验收判据的「通过记录」**无承载面（规格 §B 关闭前置第三项）——实现前须先定义记录落点
   （非状态事件类型或复用既有事件），属语义决策。
2. **人工目视功能清单**（`V-A6.8`）执行与署名归 18 号票同件，执行时点＝16 号票切换批「部署同步→重启链」
   点名段之后（部署面携带 HEAD 契约时）。
3. **recon 余项**：G2 派单决策无可复用确定性缝／G4 复核帽只在 HTTP 帽门把守（台账腿不验帽）／
   G9 台账证据未接证据包／G5 缺共用装具 `tests/helpers/ledger-rig.mjs`——均未立票，登记于 CHANGELOG。
4. **§H 触发接线**：`duty-probe-failure` 的调用方（探针 FAIL／运行面 SKIP → 登记腿）归 16 号票切换批的宿主
   巡检编排——本票只交付腿、声明核验与回归。
5. **真运行面一次 smoke**：§I 切换段的 smoke 须在部署面执行（16 号票），本票交付的是仓内确定形。
6. **关闭前置第三项的落账形态**：Testing Decisions 点名「通过记录进台账」，但落账形态（新事件类型或复用既有
   事件）属语义决策——待用户裁定后另票实现。

**工作件**（按既有约定不入提交）：recon 两件在 `.scratch/org-v2-build/attachments/14-recon/`
（`coordinates-survey.md` 60 条逐行坐标勘察、`smoke-surface.md` 五段接线与缺口 G1–G9）。

### 双轴复审（`/code-review` 双轴并行子代理，固定点 HEAD `bf7ee22`，各只读）

**Standards 轴**：硬违例 2（全修）＋judgement 8（就地处置 7、在案 1）。
1. **硬违例①**：`scripts/acceptance-coordinates-sync.mjs` 头注写「测试以子进程调用本脚本取退出码」而当时
   **全仓无一处 spawn**（假判据落点；`runAcceptanceSync`／`--write`／`--only` 无消费方无测试）→
   **修**：补 `tests/org-acceptance-coordinates.test.mjs` 子进程腿（真规格干跑退出码 0／漂移副本 1／
   副本 `--write` 回写到位／缺参 1）＋`--spec <副本>` 参数；无消费方的 `--only` 删；头注改用例如实。
2. **硬违例②**：CHANGELOG 条目「范围」行文件计数（7 文件＝3 lib／1 脚本／3 测试）与自列清单矛盾 →
   **修**：校正为 10 代码件＝4 lib／1 脚本／5 测试。
3. judgement 就地处置：查询记号由「非空即过」收紧为**三类真实读面**（台账 HTTP 路由字面量须在
   `ledger-host.js` 内／台房门面读方法须在 `task-ledger.js` 门面定义处／`lib/<模块>.js <符号>` 须在件内）；
   `parseCriteriaTable` 与 `rewriteAppendixA` 的判据行识别收敛单一原语 `criteriaRowCells`，且解析面由
   「扫全文」改**只在 A 组小节内**（删掉 fail-open 作用域，doc 与实现同拍）；`closePrecondition` 的**锚定
   判定由读侧移入谓词**（注入面不再静默少一道校验）＋直接单测注入面三例；产出登记面读取收敛
   `resolveArtifacts` 单点（读面与门共用）；探针失效腿触发源核验抽 `checkProbeFailureRoutineTrigger`
   （承重声明可判、三分支有测试）＋诊断简报公共段单一源（`LEDGER_DIAGNOSIS_BRIEF_BASE`）；
   `registerProbeFailure` 两分支返回**同形**；回写脚本返回带 `scanned`／`violations`；`V-A6.7` 坐标改点
   **真实覆盖新例程**的测试（`org-dispatch-config.test.mjs::探针失效例程的触发源核验`）；件头补判据号与
   机械面边界；测试名补判据号；中部 import 归位。
4. 在案 judgement：`closePrecondition` 被 export 的正当性＝本轮补直接单测（注入面判定），非预留钩子。

**Spec 轴**：缺失或偏弱 5 ＋越界 2 ＋夸大 3（逐条处置如下）。
- ① **§H 链未接**（腿无生产调用方、声明触发源无人发）→ **如实标注**票面第 6 项＋CHANGELOG：本票交付腿＋
  **触发源声明核验**＋回归；**触发接线归 16 号票切换批**（宿主巡检编排；探针脚本写真实运行面须点名授权）。
- ② **票面第 1 项**「最小闭环真跑通」与 §I 切换段口径 → **如实标注**：本票＝仓内确定形 smoke；真运行面
  一次 smoke 归 16 号票（须点名授权）。
- ③ **留界理由校正**：第三项关闭前置原写「无承载面」不确——Testing Decisions 点名「可执行判据的通过记录
  **进台账**」，故校正为「**承载面未定义机械形态**」（探针结论当前不落账，落账形态＝新事件类型或复用既有
  事件，属语义决策待用户裁定）。留界本身在用户裁定范围内。
- ④ **处置任务验收判据未锚**：`duty-probe-failure` 的判据锚「宿主契约门自洽回归」，「该面恢复 PASS」不在
  射程（须真实宿主在场＝部署面人工/巡检编排）——**留界在案**（件头已注明射程）。
- ⑤ **`artifact-registry-unreadable` 分支无测试** → **修**：补注入抛错读面的回归（fail closed、状态不变）。
- ⑥ **越界①**：`V-A6.5` 门序断言不在七条票面项内 → **保留并如实标注**（理由＝该条坐标否则仍指向空气，
  与「A 组坐标逐条落到真实落点」口径冲突），属**小增面**，判断在案。
- ⑦ **越界②**：坐标机械表为「清单之外的第二处」 → **口径澄清**：判据清单仍**唯一住规格**（本件只装坐标，
  且回写器单源＋双向锁定，任一侧单边改动即红），由用户裁定 ii 授权。
- ⑧⑨⑩ **夸大三项**：坐标只证**存在性与唯一性**、不证语义覆盖（天然边界，件头已写明；语义核对由 recon
  逐行实读承接）／复核帽「当次空闲实例佩戴」在 smoke 中由测试注入候选集（选择器为纯判定，生产召集接线归
  13／16 留界链）／duty 免登记门是按 §B 值守例程段的**用户裁定推论**（非 §B 字面）——三项均**在案**，
  不作「已完整达成」表述。

**复审后复验**：全量 `TMPDIR=/dev/shm npm test` **61/61** ✅（坐标与锁定模块 9 条）；preflight 四门
**exit 0**（①61/61 ②冻结面 0009 包 7/7 ③0 违例扫 73 md ④11 PASS / 0 FAIL / 0 SKIP）。


