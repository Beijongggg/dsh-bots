# 11: 功能批收口

**What to build:** 功能两改动点（①切换微交互与保活、②工具轨迹与形制统一）的批次收口：
跑门、留证、落档。

**Blocked by:** 05, 08, 09, 10

**Status:** resolved

**复核点:** 命中必审清单（对外可见：交付用户界面行为）→ 收口前独立复核 gaps。

- [x] 全量 preflight 四门 PASS（回归／冻结面／status-lint／宿主契约探针），记录实际计数；
- [x] 新建 `tests/pod-spec-face.test.mjs` 并执行 §G-G4 四项机械检查（附录 A 四字段可解析——含
      人工坐标必须带白名单类别、判据 id 连续、级别词在封闭三档词表内、票面引用坐标存在）；
      坐标无空缺；
- [x] 真机验收清单逐项留证：进出 Pod 的状态保活、焦点键盘隔离、过渡无白屏、
      工具行与专用行显示、`turn-trigger` 形制、无工具回合零回归；
- [x] 验收判据逐条复核（坐标→证据落点），人工判据仅限白名单两类并署名；
- [x] 当月 CHANGELOG 事件落档（范围／变化／验证／授权依据），票面 Status 置 `resolved`
      并附实施与验证证据；
- [x] 未闭合项写票面 Comments「移交备注：当前假设＋下一步＋关键证据指针」。

## Comments

### 收口记录（2026-10-10）

#### 1. 四门实际计数（本工作树 `.worktrees/pod-integration`，`TMPDIR=/tmp`）

| 门 | 计数 | 与基线比 |
|---|---|---|
| ① 全量回归 `node tests/run.mjs` | **94/94 个测试文件通过**（0 SKIP） | ≥ 基线 93/93（本票新增 `tests/pod-spec-face.test.mjs` 一件） |
| ② 冻结面 `scripts/preflight.mjs` ②（0010 包 `sourceManifest`） | **10/10** | ＝基线；本批未触碰包内 10 件（manifest 不含 `.scratch/`／`GLOSSARY.md`） |
| ③ status-lint＋地图覆盖 | **0 违例**（扫 114 个 md；命名扫描 215 个活文件；知识库扫描 70 个脚本；地图覆盖 45 个 `lib/org` 件） | ＝基线 0 |
| ④ 宿主契约探针（face=dev） | **15 PASS / 0 FAIL / 0 SKIP** | ≥ 基线 12/0/0（票 02 三新面：`P-SHELL-OVERLAY-GEOMETRY`／`P-HOST-TRANSITION-TOKENS`／`P-SHELL-FOCUS-LAYER`） |
| 总判 | `preflight: PASS`（退出码 0） | 四门 AND 成立 |

- 完整日志（临时件，不进提交）：`.tmp/pod-ctx/evidence/11-preflight-before-closure.log`（收口前）
  与 `11-preflight-after-closure.log`（票面 Status 改写后复跑）。
- 单件复核：`pod-overlay`／`pod-transition`／`pod-trace`／`pod-tool-rows`／`pod-tool-rows-specialized`／
  `pod-turn-trigger`／`pod-harness-base`／`client-disclosure`／`org-op-set`（23 pass）／`bot-profile` 全部退出码 0。

#### 2. `tests/pod-spec-face.test.mjs`（§G-G4 四项机械检查＋登记口径检查）

- **用例面**：14 例。①＋②四字段可解析＋id 连续（组计数 5/11/6/7/11/6/7/7/4＝64）；③级别词
  封闭词表；④票面引用坐标存在；补记坐标同拍；人工坐标白名单；治理面白名单；登记口径；
  V-P1.1／1.2／1.3／1.4／1.5／1.5b／P8.2 登记与扫描检查（`V-P1.5b` 含「代码内部名实例」断言：
  `dsh-bots-pod-layer`／`-seat-list`／`-seat-view` 三个类名保留在实现件）。
- **坐标文法**：`tests/<件>[::<片段>]`／`tests:<件>`（整件）／`用例:<件>#<id>`（唯一用例）／
  `判据:<件>#<id>`（判据 id 前缀覆盖的用例组，多条合法）／`探针 <id>`／`门①…④`／
  `人工:<类别>`；括注（可嵌套）不参与解析。
- **机械结论**：**64 条逐条四字段可解析**；id 连续；级别词全在封闭三档内；
  **57 条坐标机械解析到真实落点**（测试件／用例名／探针／门号／白名单类别）；
  **7 条为治理面句子型引注**（`V-P6.6`／`V-P8.4`／`V-P8.5`／`V-P8.6`／`V-P8.7`／`V-P9.1`／`V-P9.2`，
  证据落点在票面 Comments／日志卷／既有登记件），以 `GOVERNANCE_ONLY` 白名单**双向锁定**
  （不在册者出现即红、在册者消失亦红）——**坐标零空缺**（64 条执行坐标列全非空）。
- **红绿自查（证明断言真能红）**：把 `V-P2.2` 级别词改成词表外的 `常驻＋验收期两次`，并把
  `V-P6.4` 坐标改成 `用例:pod-tool-rows.test.mjs#V-P6.9` 后复跑——
  ③红（`级别词「验收期两次」不在封闭三档词表内`）、④红（`V-P6.4｜…V-P6.9｜…内无标题含「V-P6.9」的用例`）、
  补记同拍红（`坐标列「…V-P6.9」≠ 补记「…V-P6.4」`）、治理白名单红（实况漂移）、登记口径红，
  共 **5 例变红**；还原后 **14/14 全绿**。证据：`.tmp/pod-ctx/evidence/11-spec-face-red.log`。

#### 3. 坐标补记（附录 A「执行坐标」列，27 条改写——只动坐标列）

依据规格「此后**只补执行坐标**、不得改判据语义」的许可度落笔；**判据文本／证据落点／级别列未动**
（本件用例双向锁定：坐标列须与 `CANONICAL_COORDINATES` 逐条同拍，语义列改动即红）。

- **形状统一（21 条）**：`tests/<件>::<非唯一 id 前缀>` 与三处 `tests/<件>（括注）` 改写成
  `用例:`／`判据:`／`tests:` 记号（原写法解析不到唯一落点）：`V-P2.8`／`V-P3.4`／`V-P4.1`／`V-P4.2`／
  `V-P4.4`／`V-P4.7`／`V-P5.4`（原文有 `＋＋` 误写，合并为两条记号）／`V-P5.6`／`V-P5.7`／`V-P5.8`／
  `V-P5.9`／`V-P5.10`（原 `＋ \`tests/run.mjs\` 回归` 拆成两条）／`V-P7.1`／`V-P7.4`／`V-P7.6`／
  `V-P8.1`／`V-P9.3`／`V-P9.4`（`\`TMPDIR=/tmp node scripts/preflight.mjs\`＋人工:…` → `门①＋门②＋门③＋门④＋人工:…`）。
- **指错落点订正（4 条）**：`V-P2.8`（原「待票 02 行为探针」→ 实落 `tests/pod-overlay.test.mjs::V-P2.8` 族）；
  `V-P6.1…P6.5`（原指 `tests/pod-assembly.test.mjs`，该件从未创建 → 实落 `tests/pod-tool-rows.test.mjs::V-P6.x`）；
  `V-P4.5`（原指 `tests/session-driver.test.mjs` 的「回合返回形状断言」→ 实落 `tests/pod-trace.test.mjs::V-P4.5 负例`
  ＋整件 `tests/session-driver.test.mjs`）。
- **待实现批占位（1 条）**：`V-P8.3`（原 `tests/pod-rename-env.test.mjs::V-P8.3（待票 13）` → 改指既有
  `scripts/org-cutover-check.mjs`，括号注「仓库外两脚本更新记录见票 13 授权窗口」）。
- 改写脚本（一次性、幂等）：`.tmp/pod-ctx/spec-coordinate-sync-11.mjs`；`git diff` 为 **27 行同形替换**。

#### 4. 判据逐条复核（64 条：坐标→证据）

判定口径：**通过**＝坐标落点真实存在且语义对得上（可执行面看断言与退出码；人工面引 `WALKTHROUGH.md`）；
**需关注**＝判据成立但证据链有需要 Lead／用户处置的缝隙；**不可执行**＝执行窗口在后续批次或运行时点。

| 判据 | 判定 | 证据 |
|---|---|---|
| `V-P1.1` | 通过 | `GLOSSARY.md:414` 词条＝视觉 `Pod`／标识符小写 `pod`／「宿主包名校验只收小写」；`pod-spec-face::V-P1.1` 绿 |
| `V-P1.2` | 通过 | 词条显式「Pod 指插件与整页形态，**不是**席位的称呼」＋「不外借、不并列、不互为同义词」；活文档「Pod 席位」式用法零命中（负例引注除外）；`::V-P1.2` 绿 |
| `V-P1.3` | 通过 | 词条 `_Avoid_:` 行含 `` `Bot 模式` ``＋「历史别名」；`lib/client.js` `entry.label` zh/en 均 `Pod`（不回改）；`::V-P1.3` 绿 |
| `V-P1.4` | 通过 | 冻结件实态：`docs/TEMP-guidance-optimization-v3.2.1.md`／`docs/CLOSURE-p6-5-qualified-scope.md`／`docs/changelog/*`／`artifacts/packages/*` 内旧名命中**全部**落白名单；活面扫描「应改未改」为空集；`::V-P1.4` 绿 |
| `V-P1.5` | 通过 | 代码内部名（槽位／组件／CSS 前缀）在实现面保留（`POD_LAYER_CLASSES` 三例逐名断言）；入口标签两条 `entry.label` 无旧名；`::V-P1.5`＋`::V-P1.5b` 绿 |
| `V-P2.1` | 通过 | `tests/pod-overlay.test.mjs::V-P2.1`（官方条目账本不变）退出 0；探针 `P-CLIENT-SLOTS` 断言 `sidebar`／`main` 两相 `phase:"never"`、enter 期只在 `shell.overlay` 增一条 |
| `V-P2.2` | 通过＋**署名待确认** | 机器半边 `::V-P2.2` 绿（节点身份不变、滚动／展开态／进行中进度）；人工半边＝`WALKTHROUGH.md` 条目 2「官方页仍在挂载（`body.contains(scroller)`）＝true；滚动 3000→3000 保持」，**核验人署名待用户确认**（§G-G7） |
| `V-P2.3` | 通过 | `::V-P2.3` 负例（不得 `hidden`／`display:none`）绿 |
| `V-P2.4` | 通过 | `::V-P2.4`（`shell.overlay`＋portal＋`role=dialog`／`aria-modal`）绿；走查条目 1 实测 `role=dialog`／`aria-modal=true` |
| `V-P2.5` | 通过 | 面 `HF-SHELL-OVERLAY-GEOMETRY`／探针 `P-SHELL-OVERLAY-GEOMETRY` 登记在册且 PASS；`::V-P2.5`（≥20 且 <900、不复用 1001）绿；实现档 `POD_LAYER.zIndexBase=21` |
| `V-P2.6` | 通过 | `::V-P2.6`（主层注册不带 `order`、层叠由 portal z-index 决定）绿 |
| `V-P2.7` | 通过＋**署名待确认** | `::V-P2.7`／`::V-P2.7b` 绿（`useModalLayer` 契约、缺面降级仍可挂载）；走查条目 4「连按 3 次 Tab 焦点仍在层内、背景 3 件 `inert`」 |
| `V-P2.8` | 通过 | 面 `HF-SHELL-FOCUS-LAYER`／探针 `P-SHELL-FOCUS-LAYER` PASS（合成 DOM 实调：焦点入园／`[inert]` 子树排除／Tab 囚笼／Escape 只关栈顶／LIFO 归还）；`tests/pod-overlay.test.mjs::V-P2.8` 族（含 `V-P2.8b`／`V-P2.8c` 真实可达序）绿 |
| `V-P2.9` | 通过＋**署名待确认** | 探针 `P-SHELL-FOCUS-LAYER` 断言被盖元素让键；走查条目 5「Ctrl+B 后官方侧栏 280→280 不变」（**弱证据**：仅走查记录，未留独立文件） |
| `V-P2.10` | 通过 | `::V-P2.10` 负例（无 `closeDetails` 调用、`layout` 面零触达）绿 |
| `V-P2.11` | 通过＋**署名待确认** | `::V-P2.11`（草稿／选中保留、视图不卸载重挂）绿；走查条目 11「切席位→主区换代过渡标记 `dsh-bots-pod-view-in-2`（只主区）；切回内容保留」 |
| `V-P3.1` | 通过 | `tests/pod-transition.test.mjs::V-P3.1` 绿；走查条目 6 实测 `0.2s`／`cubic-bezier(0.4,0,0.2,1)`／`opacity 0→1`＋`translateY(4px)→0` |
| `V-P3.2` | 通过 | 探针 `P-HOST-TRANSITION-TOKENS` PASS（令牌存在性与形状；宿主无 `--dsw-*` 动效令牌）；`::V-P3.2` 与探针导出逐名逐 kind 双向绑定 |
| `V-P3.3` | 通过 | `::V-P3.3` 范围差分（进出＝层整体／内切席位＝只主区）绿 |
| `V-P3.4` | 通过 | `::V-P3.4`（媒体查询桩 → 瞬时）绿（**真机未实测**，见下「不可执行」栏 b） |
| `V-P3.5` | 通过＋**署名待确认** | `::V-P3.5` 首帧断言绿；走查条目 6 中间帧 t=120ms `0.96`／`0.16px` 平滑、无白屏帧 |
| `V-P3.6` | 通过 | `::V-P3.6` 负例（不依赖 `hidden`／`display:none`、无宿主私有样式钩子）绿 |
| `V-P4.1` | 通过 | `tests/pod-trace.test.mjs` `V-P4.1` 族（路由＋since＋405/404／注册表 404／无会话空轨迹／离线盘投影＋mtime-size 缓存＋增量／v4 代际／在线 RPC 优先）绿 |
| `V-P4.2` | 通过 | `V-P4.2` 族（字段与缺省语义／键集封闭）绿 |
| `V-P4.3` | 通过 | `V-P4.3` 族（PTC 信封、内层真实名）＋`V-P4.7` 族（内层错误不污染信封等）绿 |
| `V-P4.4` | 通过 | `tests/org-mail-shared-face.test.mjs::内容键封闭` 绿＋`tests/mail-at-least-once.test.mjs` 整件绿＋`pod-trace::V-P4.4 负例` 绿 |
| `V-P4.5` | 通过 | `pod-trace::V-P4.5 负例`（`session-driver` 回合返回形状仍为 `{text, sessionId}`）绿＋`tests/session-driver.test.mjs`（15 例）绿 |
| `V-P4.6` | 通过 | 损坏日志 fail-closed（空轨迹、不抛到 HTTP 面外）绿 |
| `V-P4.7` | 通过 | `V-P4.7` 族 8 例（并发子调用／中断／crash-orphaned／未闭合／缺名孤儿／坏报文）绿，缺口计数可见 |
| `V-P5.1` | 通过 | `tests/pod-tool-rows.test.mjs::V-P5.1`（通用行字段齐备＋展开体 pre-wrap／限高／可滚）绿 |
| `V-P5.2` | 通过＋**署名待确认** | `::V-P5.2` 绿；走查条目 7「折叠头『N 次工具调用』可展开（`aria-expanded` false→true）」 |
| `V-P5.3` | 通过 | `::V-P5.3`（外层 `run_code` 行下挂子调用行、投影快照）绿 |
| `V-P5.4` | 通过 | `V-P5.4` 族（同流零重复零丢序、增量 vs 全量幂等、`since` 左开增量拉取）绿 |
| `V-P5.5` | 通过 | `::V-P5.5`（无工具回合不渲染工具组／未识别工具回落通用行）绿；走查条目 12「无工具回合按原样渲染」 |
| `V-P5.6` | 通过 | `tests/pod-tool-rows-specialized.test.mjs::V-P5.6` 族 11 例（四类分派／bash／文件 diff／read／grep／glob／回落／四类齐备）绿 |
| `V-P5.7` | 通过＋**署名待确认** | `::V-P5.7` 族 5 例（样式令牌化、官方变体名、无硬编码色值）绿；走查条目 9 实测分布 `bash 3／search 3／read 3`＋终端块截图（`diff` 样本未落展开子集，由投影快照把守） |
| `V-P5.8` | 通过＋**署名待确认** | `tests/pod-turn-trigger.test.mjs::V-P5.8` 族 4 例（§D5 表 12 项逐项）绿；走查条目 10（披露行＋右对齐时间＋chevron） |
| `V-P5.9` | 通过 | `::V-P5.9` 族 5 例（覆盖范围／通知面轻量负例／zh-en 齐备／键盘可达）绿 |
| `V-P5.10` | 通过 | `tests/client-disclosure.test.mjs` 7 例绿（骨架／展开折叠＋aria／受控／槽位／键盘／样式基座／`DiscussionGroup` 复用）＋`tests/run.mjs` 94/94 |
| `V-P5.11` | 通过＋**署名待确认** | 并入票 11 真机清单（走查条目 1／10／12 的截图）；**核验人署名待用户确认** |
| `V-P6.1` | 通过 | `tests/pod-tool-rows.test.mjs::V-P6.1 锚定：工具行组挂在 A(t)（timestamp <= t0 的合并序下标最大者）之后；同拍取下标最大者；多回合同锚按 turn 升序` 绿 |
| `V-P6.2` | 通过 | `::V-P6.2 无锚点：回合早于任何消息时置于流首并计 anchorless；时间戳不可解析的消息不参与锚定（确定性回落）` 绿 |
| `V-P6.3` | 通过 | `::V-P6.3 未闭合：增量 since 逐条追加且不闭合（无计数头）；turn 全终态或回合回复消息落盘即闭合；晚到消息按 R2 重锚（重锚优先）` 绿 |
| `V-P6.4` | 通过 | `::V-P6.4 计数头：闭合回合 N＝顶层记录数（run_code 信封计 1、subCalls 不重复计入）` 绿 |
| `V-P6.5` | 通过 | `::V-P6.5 幂等：同一数据全集内增量拼接与全量重放产出同一序列；零重复、零丢序` 绿 |
| `V-P6.6` | 通过（治理面） | 上浮口径＝`lib/org/acceptance-coordinates.js::HUMAN_CRITERION_CATEGORIES` fail-closed（白名单件在册，23 例 `org-op-set`／坐标件全绿）；本批无 `needs-user` 上浮项 |
| `V-P7.1` | 通过 | 规格 §D2 写明「基底＝官方默认 preset `standard`（27 工具）＋呈现面 ptc」＋`tests/pod-harness-base.test.mjs::V-P7.1`（文档＋配置扫描）绿 |
| `V-P7.2` | 通过 | `::V-P7.2`（27 工具与官方 preset 逐项一致）绿（宿主载体缺失时按 `⤼ SKIP:` 分列计数，本次未 SKIP） |
| `V-P7.3` | 通过 | `::V-P7.3`＋`tests/bot-faces-ready.test.mjs`（`DSH_TOOLS_MODE` 无条件注入、不按 provider 分叉）绿 |
| `V-P7.4` | 通过 | `::V-P7.4 死配置清理：生成器同步`＋`tests/bot-profile.test.mjs::生成器不写出死键`（4/4）绿 |
| `V-P7.5` | 通过 | `::V-P7.5`（`dsh --dump-config` 不再出现 `agent-presets`／`settings` 死重定向）绿 |
| `V-P7.6` | 通过 | `tests/org-op-set.test.mjs` 23/23＋`::V-P7.6` 负例（改名 op 即被拒）绿 |
| `V-P7.7` | 通过 | `docs/PROJECT_UNDERSTANDING.md:249-256`「仍可选题」登记（死目录＋13 条断链软链，含复核读数）；`::V-P7.7` 文档面绿 |
| `V-P8.1` | 通过 | 票面实况：11 号票 `Blocked by: 05, 08, 09, 10`；12→13→14→15 串行（12 的 `Blocked by: 11`）；`tests/project-context.test.mjs::--spec-index` 绿 |
| `V-P8.2` | 通过（清单扫全；改名批做减法） | 九类在活面各有真实落点（`lib/client.js` 604 命中／`lib/index.js` 97／`scripts/host-contract-probe.mjs` 9／`package.json` 1）；「应改未改」清单归票 12／13，`::V-P8.2` 绿 |
| `V-P8.3` | **不可执行（票 13）** | `POD_*` 双读与仓库外两脚本更新在票 13 执行窗口；坐标已改指既有 `scripts/org-cutover-check.mjs`，`tests/pod-rename-env.test.mjs` 未创建（属票 13 交付） |
| `V-P8.4` | **不可执行（票 13）** | 四同名核验需改包名／目录／module id／patch 行——票 13 的 wire 身份段 |
| `V-P8.5` | **不可执行（票 14）** | 数据面迁移方案与逐件校验属票 14；迁移执行另需逐项点名 |
| `V-P8.6` | **不可执行（票 15）** | 「改名触发新 `runId` 增量包」在票 15；门②现在 10/10（0010 包，本批未触包内件），点名段后须复跑 |
| `V-P8.7` | **不可执行（票 13／14／15）** | 授权点各一次点名属后续批次；本批已有部署同步授权记录 `.tmp/pod-ctx/deploy-spec-pod-feature-batch.json`＋`artifacts/cutover-execution/`（非本判据窗口） |
| `V-P9.1` | 通过（待复核哈希） | 规格冻结事件 `EV-20261009-pod-spec-freeze` 在 `docs/changelog/2026-10-04.md`，记原文 SHA-256 `d9370bcc…`；本票改写 Status 行＋27 条坐标后该哈希变化，**新哈希随功能批 CHANGELOG 事件落档**（Lead） |
| `V-P9.2` | 通过 | `HUMAN_CRITERION_CATEGORIES` fail-closed 口径＋票 11 复核：附录 A 人工记号全部 `人工:human-visual-checklist`（9 条判据），白名单外零命中 |
| `V-P9.3` | 通过 | `tests/pod-spec-face.test.mjs` 14/14（四项机械检查＋登记口径＋补记同拍＋治理面白名单双向锁定）；红绿自查 5 例变红见 §2 |
| `V-P9.4` | 通过（收口计数达标）＋**署名待确认** | `preflight` 总判 PASS（94/94、10/10、0 违例、15/0/0）；真机目视一次由 Lead 走查、证据引 `WALKTHROUGH.md`；**核验人署名待用户确认** |

**不可执行与需关注（单列）**

| # | 条目 | 性质 |
|---|---|---|
| a | `V-P8.3` 仓库外脚本更新（`~/.dsh/dsh-web.sh`／`restart-split.sh`） | 不可执行：运行面写入，属票 13 授权窗口 |
| b | `V-P3.4` 真机 `prefers-reduced-motion` 观感 | 不可执行（本次窗口）：headless 未模拟；由单测 `V-P3.4` 把守，真机项留后续窗口 |
| c | `V-P2.7`／`V-P2.9` 官方高层浮层「盖在 Pod 之上且可用」 | 未实测：走查期无官方设置面板打开场景（`P-SHELL-OVERLAY-GEOMETRY` 探针已证几何层叠，人工半边留后续窗口） |
| d | 通知抬档（走查条目 13：Pod 期 `z-index 23`） | 未实测：窗口内无通知事件，仅单测把守 |
| e | 票 02 Comments 实施记录 | **缺**：三新面与三态探针的交付物在仓内可核（`lib/host-faces.js` 17 条 `probeId` 含 `P-SHELL-OVERLAY-GEOMETRY`／`P-HOST-TRANSITION-TOKENS`／`P-SHELL-FOCUS-LAYER`；探针门 15 PASS），但**票面无 Comments 记录**（票 04／05／06 Comments 引「票 02 Comments」落空） |
| f | 票 02／03 验收框 | 票 02 五项、票 03 五项未勾——本票按「Comments 实施与验证证据＋当月日志卷事件」口径将其 `Status` 置 `resolved`（交付物在仓内可核），勾选框留原文不改（不改已有实施记录正文） |
| g | `V-P9.4` 基线数字 | 规格「执行编排」节写「宿主契约 12 PASS／0 FAIL／0 SKIP」为票 11 前置基线；票 02 加三面后实测 15，**判定按 ≥ 基线放行**，基线口径更新归 Lead |
| h | 人工判据署名 | 走查条目 1–12 由 Lead 走查（真实宿主＋真实 GUI＋截图／DOM 实测）；**核验人署名待用户确认**，代签＝落档作假（§G-G7） |

#### 5. 真机走查结论（引 `WALKTHROUGH.md`）

- 宿主 `dsh web` @127.0.0.1:3080（用户重启后 pid 3617）＋容器内 headless Chrome CDP 9222；部署面
  `~/.dsh/plugins/dsh-bots` 已同步到 `083be09` 与走查返修 `92678b5`（217/217 same，记录见
  `artifacts/cutover-execution/`）。
- 逐项结果：修复前缺陷 1 件（席位列 `11925.4px`／主区 0）已由 `cc9c1ea` 返修并复验为 **280/1160**；
  保活、撤层、Tab 囚笼、`inert`、过渡、工具行与折叠头、PTC 信封、四类专用行、`turn-trigger` 形制、
  Pod 内切席位、无工具回合零回归——**条目 1–12 全部通过**，证据文件 17 件（截图＋DOM 实测 JSON）。
- 未实测 2 项（条目 13 通知抬档、条目 14 reduced-motion）＋弱证据 1 项（条目 5 快捷键），见上表 b／c／d。
- **人工判据署名：待用户确认**（Lead 走查不能替代用户署名）。

#### 6. CHANGELOG 事件（建议文本，由 Lead 落档——本票不写卷）

- `--id EV-20261010-pod-feature-batch-close`
- 标题：pod 功能批 01–11 收口（覆盖式常驻＋工具轨迹与形制统一；四门 PASS）
- 范围：`.scratch/pod/issues/01…11-*.md`、`.scratch/pod/spec.md`（Status＋附录 A 坐标列 27 条）、
  `tests/pod-spec-face.test.mjs`（新增）＋既有 pod 测试七件＋`lib/client.js`、`lib/index.js`、
  `lib/host-faces.js`、`lib/trace-projection.js`、`scripts/host-contract-probe.mjs`、`GLOSSARY.md`、
  `docs/adr/0001-overlay-persistent-and-inert.md`、`docs/PROJECT_UNDERSTANDING.md`；
  本事件。
- 变化：① 改动点①落地＝覆盖式常驻（`shell.overlay`＋整屏 portal 到 body，官方会话页与侧栏全程保活，
  退出＝撤层）＋克制的过渡语言（淡入＋约 4px 上浮、约 200ms，宿主 `--ds-*` 令牌＋常量回退，
  reduced-motion 退化）＋焦点／键盘隔离（`useModalLayer` 契约＋背景 `inert` 引用采集与 LIFO 还原，
  红线偏离经 ADR-0001 授权）；② 改动点②落地＝L1 基底显式化（基底＝官方默认 preset `standard`
  27 工具＋呈现面 ptc 保留）＋L2 只读投影 `BotsApi.trace(id, since)` 挂 `GET /api/bots/:id/trace`
  （PTC 内层真实名不别名化）＋L3 回合级拼装（`assemble`／`assembleDiagnostics`，通用行＋四类专用行＋
  「N 次工具调用」折叠头）＋`turn-trigger` 形制统一；③ 死配置清理（per-bot `settings.yaml` 的
  `agent-presets` 段与 patch `settings` 重定向行）；④ 观察项登记（`~/.dsh/.agent-presets/` 死目录＋
  13 条断链软链入 `PROJECT_UNDERSTANDING`「仍可选题」）。
- 验证：`TMPDIR=/tmp node scripts/preflight.mjs` → **PASS**：①回归 **94/94**（0 SKIP）②冻结面
  （0010 包）**10/10** ③status-lint **0 违例**（扫 114 md／命名 215 活文件／知识库 70 脚本／地图 45 件）
  ④宿主契约 **15 PASS／0 FAIL／0 SKIP**；`tests/pod-spec-face.test.mjs` 14/14（§G-G4 四项机械检查：
  四字段可解析／id 连续／级别词封闭／坐标存在，57 条机械可解析＋7 条治理面引注白名单双向锁定）；
  真机走查 12/12 项通过（`.tmp/pod-ctx/evidence/WALKTHROUGH.md` 与 17 件证据，人工判据署名待用户确认）；
  关键哈希：`.scratch/pod/spec.md` 收口后 SHA-256＝`f75fedafa1db5587072e2c247274f8e5aa31ab6205027a13d4c7fb7c2883d819`（冻结时 `d9370bccfd4da74fac9ae6c8b9799d7658d4d823cab59b9954ea373b22436c86`；本批只改 Status 行与附录 A 坐标列 27 条，判据语义未动）。
- 授权：用户 Q27「4保留ptc，其他我没有建议」＋Q25a「其余无异议」（共识 §3.2）；部署同步（含走查返修
  二件）经用户 2026-10-10 授权窗口执行（计划／执行记录见 `artifacts/cutover-preparation/`、
  `artifacts/cutover-execution/pod-feature-batch-20261010T1816Z-*`）；`inert` 红线偏离按 Q23a「其余无异议」
  ＋ADR-0001 授权；改名批（12–15）与数据迁移、新 `runId` 包链**未在本批执行**，待逐项点名。

#### 7. 未闭合项（移交备注：当前假设＋下一步＋关键证据指针）

1. **人工判据署名**：当前假设＝Lead 走查记录（条目 1–12）可作为人工目视事实证据；下一步＝请用户在
   `WALKTHROUGH.md` 末节署名（代签＝落档作假）；证据指针＝`.tmp/pod-ctx/evidence/WALKTHROUGH.md`（步骤 1–14
   的逐项结果与 17 件证据文件）。
2. **票 02 Comments 缺记录**：当前假设＝交付物（三新面＋三态探针，15 PASS／0 FAIL／0 SKIP）可核即可；
   下一步＝若要补记录，由 Lead 决定是否在票 02 追加跨票指针（本票不代写）；
   证据指针＝`lib/host-faces.js:126,137,148`、`scripts/host-contract-probe.mjs:2362,2371,2380`、preflight ④ 输出。
3. **`V-P9.4` 基线数字**：当前假设＝「宿主契约 12 PASS」为票 11 前置基线，票 02 加三面后以 15 放行；
   下一步＝Lead 在落档事件时同步基线口径；证据指针＝规格「执行编排」节＋`11-preflight-before-closure.log:5257,5263`。
4. **通知抬档／reduced-motion／官方浮层压 Pod** 三项未实测：当前假设＝分别由单测（`V-P2.x` 通知抬档断言、
   `V-P3.4`、`P-SHELL-OVERLAY-GEOMETRY` 几何）把守；下一步＝后续窗口补真机目视；证据指针＝
   `WALKTHROUGH.md` 条目 13／14＋`tests/pod-overlay.test.mjs::I1`、`tests/pod-transition.test.mjs::V-P3.4`。
5. **`stale pid` 独立缺陷**（票 06 返修记录点名）：当前假设＝与日志代际无关的独立项、`repair` 属写运行面；
   下一步＝另开观察项或点名后处置；证据指针＝票 06 Comments 返修记录表（`duty-coordinator` pid 1293）。
6. **12–15 改名批**：当前假设＝功能先行已完成，改名批独立且串行（12 `Blocked by: 11` 已满足）；
   下一步＝按用户点名先做票 12「仓库内标识符扫」；证据指针＝`.scratch/pod/issues/12-…15-rename-*.md`
   ＋本票 §4 的 `V-P8.3`–`V-P8.7` 四条不可执行行。
7. **规格 SHA-256 复算**：当前假设＝坐标列 27 条改写＋Status 行属「只补坐标／收口标记」，判据语义未动；
   下一步＝Lead 落档事件时填入新哈希并记与冻结件旧哈希 `d9370bcc…` 的关系；
   证据指针＝`docs/changelog/2026-10-04.md`（`EV-20261009-pod-spec-freeze`）。
