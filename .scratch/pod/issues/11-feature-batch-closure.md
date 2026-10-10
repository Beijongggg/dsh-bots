# 11: 功能批收口

**What to build:** 功能两改动点（①切换微交互与保活、②工具轨迹与形制统一）的批次收口：
跑门、留证、落档。**core 批口径**：07／08／09 三票已由用户 2026-10-10 裁定搁置、不并入主树
（见各票 Comments「搁置（2026-10-10 用户裁定）」节），本票按 **core 范围**收口
（01–06／10／11＋04／05 返修）。

**Blocked by:** 05, 08, 09, 10

**Status:** resolved

**复核点:** 命中必审清单（对外可见：交付用户界面行为）→ 收口前独立复核 gaps。

- [x] 全量 preflight 四门 PASS（回归／冻结面／status-lint／宿主契约探针），记录实际计数（§1）；
- [x] 新建 `tests/pod-spec-face.test.mjs` 并执行 §G-G4 四项机械检查（附录 A 四字段可解析——含
      人工坐标必须带白名单类别、判据 id 连续、级别词在封闭三档词表内、票面引用坐标存在）；
      坐标无空缺；core 适配＝**搁置清单＋core 未补记白名单**（§2）；
- [x] 真机验收清单逐项留证（§6）：进出 Pod 的状态保活、焦点键盘隔离、过渡无白屏、无工具回合零回归
      ——core 范围四项；「工具行与专用行显示」「`turn-trigger` 形制」属搁置件，**core 不主张**；
- [x] 验收判据逐条复核（坐标→证据落点）（§4），人工判据仅限白名单两类并署名
      （**核验人署名待用户确认**，§6）；
- [x] 当月 CHANGELOG 事件**建议文本**留本票 Comments（§7）——core 批**不写** `docs/changelog/`，
      由 Lead 落档；
- [x] 未闭合项写票面 Comments「移交备注：当前假设＋下一步＋关键证据指针」（§8）。

## Comments

### 收口记录（2026-10-10，core 批）

#### 0. 口径与分支（core 批＝功能批减去搁置件）

- **用户裁定原话**（2026-10-10）：「工具调用那块的前端形态有问题不是我满意的显示样式，把这部分先搁置了，不并入主树，」；
  追问中选定搁置 **07（通用工具行＋回合折叠头）／08（bash／diff／read／search 专用行）／
  09（turn-trigger 形制统一）**，其余（01–06、10、11 与 04／05 返修）另立分支待并。
- **本批分支**：`integration/pod-core`（新建；起点 `fb9a4d5`＝04 已并入、07 尚未并入的切口）。
- **带入 core 的提交**（cherry-pick，逐条保留原提交）：`652be63`（05 过渡动效 feat）→
  `e7fe514`（05 票面实施记录）→ `6425e74`（04 复核返修）→ `cc9c1ea`（04 真机走查返修）；收口提交＝本票。
  - 冲突三处（均在 `lib/client.js`，`git cherry-pick` 逐个解）：① 覆盖层样式基座注释段、
    ② 过渡令牌段、③ `__podControl.reset`。解法＝**保留双方语义、只留 core 范围**：注释取
    「04 的脱流定位 B1 段＋05 的过渡段」并集；样式段取 integration 口径（过渡令牌单一注册表
    `podTokenVar()` 消费＋通知抬档 z-index）；`reset` 取「`podDrafts.clear()`＋
    `resetPodTransitions()`＋store 复位」合并体。07／08／09 的工具行／触发行代码一律不带入（§5 自查）。
  - 另有 4 处「合并期决议」在单条 cherry-pick 里带不到，按 integration 终态补齐（均 core 范围）：
    过渡令牌行式视图 `podTransitionTokenRows()`（integration 的 `083be09` 合并决议）、
    `podSetTimeout` 的 `globalThis` 回退、`tests/pod-transition.test.mjs` 的 M9 断言组、
    以及一行跨票依赖 `exports.getBotState`（见 §8-8）。
- **搁置件保留地**：`integration/pod`（收口提交 `b5021b6`）——**不要动**。
- **不并入 core**：`371717c`／`b6979ab`／`317161c`（07）、`db31833`／`41b8f8f`（08）、
  `985ff0c`／`26bd2bb`／`eee1e0c`（09），以及部署记录 `357c152`／`a4f9ccd`（对应**含搁置件**的
  部署面）。core 的部署面回到不含工具行的形态，**另出**、由 Lead 执行；本批**未跑 deploy-sync**、
  未写 `docs/changelog/`、未动 `~/.dsh`、未 push。

#### 1. 四门实际计数（本工作树 `.worktrees/pod-core`，`TMPDIR=/tmp`）

| 门 | 计数 | 与基线比 |
|---|---|---|
| ① 全量回归 `node tests/run.mjs` | **91/91 个测试文件通过**（0 SKIP） | ≥ 基线 90；比 `integration/pod`（94/94）少 3 件＝搁置件测试文件 |
| ② 冻结面 `scripts/preflight.mjs` ②（0010 包 `sourceManifest`） | **10/10** | ＝基线；本批未触碰包内 10 件 |
| ③ status-lint＋地图覆盖 | **0 违例**（扫 114 个 md；命名扫描 212 个活文件；知识库扫描 70 个脚本；地图覆盖 45 个 `lib/org` 件） | ＝基线 0 |
| ④ 宿主契约探针（face=dev） | **15 PASS / 0 FAIL / 0 SKIP** | ≥ 基线 12/0/0（票 02 三新面：`P-SHELL-OVERLAY-GEOMETRY`／`P-HOST-TRANSITION-TOKENS`／`P-SHELL-FOCUS-LAYER`） |
| 总判 | `preflight: PASS`（退出码 0） | 四门 AND 成立 |

- 完整日志（临时件，不进提交）：`.tmp/core-gates/before-closure.log`（票面与 `spec.md` Status 改写前复跑）
  与 `.tmp/core-gates/final.log`（收口改写后复跑）；spec-face 红绿自查日志
  `.tmp/core-gates/spec-face-red.log`。core 工作树与 integration 的 `11-preflight-*.log` 不是同一批
  （那边含搁置件，94/94）。
- 单件复核（core 相关件，全部退出码 0）：`pod-overlay` 20 例、`pod-transition` 6 例、
  `pod-trace` 19 例、`pod-spec-face` 15 例、`client-disclosure` 7 例、`pod-harness-base` 7 例。
- 与 `b5021b6`（integration 收口）的四门对照：94/94、10/10、0 违例、15/0/0；core 差异**只在门①**
  （−3 件搁置测试文件），其余三门逐字齐平。

#### 2. `tests/pod-spec-face.test.mjs`（§G-G4 四项机械检查＋搁置态适配）

- **用例面**：15 例——§G-G4 四项机械检查；现状锁定同拍；人工坐标白名单；句子型引注白名单双向锁定；
  **搁置清单双向锁定**；「常驻但坐标无测试落点」集合；V-P1.1／1.2／1.3／1.4／1.5／1.5b／P8.2
  登记与扫描检查。
- **core 适配（相对 `b5021b6` 版；四项机械检查本身不变）**：
  1. **搁置清单** `PARKED_LANDINGS`（4 条，**双向锁定**）：`tests/pod-tool-rows.test.mjs`（票 07）、
     `tests/pod-tool-rows-specialized.test.mjs`（票 08）、`tests/pod-turn-trigger.test.mjs`（票 09）、
     `tests/pod-assembly.test.mjs`（票 07 定稿期计划名，附录 A `V-P6.1…P6.5` 原坐标所指，实际落点＝
     07 的测试件）。被搁置票的判据坐标指向 core 中不存在的测试件时**在册才放过**；未在册的缺失落点仍按
     「测试文件不存在」报红（`resolveToken` fail-closed 不变）；在册条目若已能在 core 落地或不再被任何
     坐标引用同样报红（`V-P9.3 搁置清单双向锁定` 用例把守）。
  2. **core 附录 A 未补记白名单** `UNBACKFILLED_ROWS`（2 条）：`V-P8.1`（命令＋票面引注）与
     `V-P8.3`（指改名批票 13 待实现的 `tests/pod-rename-env.test.mjs`）。core 批**只改** `spec.md` 的
     `Status:` 行、正文与附录 A 不动，故 `b5021b6` 那轮「执行坐标补记」（27 条）在 core 不存在；
     这 2 条在 core 解析不到落点，显式登记在册（双向锁定：一旦解析成立即须移出）。
  3. **坐标文法两处加固**（不放松判定）：① `coordinateTokens` 改为**先刨括注、再按 `＋` 分词**
     （core 附录 A 的 `V-P1.5`／`V-P7.1` 嵌套括注内含 `＋`，先分后刨会留半个括注而解析不到落点）；
     ② 片段命中允许「整名恰等」与「片段接全角 `（`」（core 的 `V-P7.4` 片段以 `（` 接续标题）。
  4. **现状锁定表** `CANONICAL_COORDINATES`（28 条）＝core 附录 A 执行坐标列快照（与 `b5021b6` 版
     同机制、不同数据：那版记的是补记后的写法）。core 未改附录 A，故本表即现状。
- **机械结论**：64 条逐条四字段可解析；id 连续（5/11/6/7/11/6/7/7/4）；级别词全在封闭三档词表内；
  **55 条坐标机械解析到真实落点**；**9 条为句子型引注**（治理面 7＋core 未补记 2），两表双向锁定；
  **搁置清单 4 条**在册且双向锁定；**坐标零空缺**（64 条执行坐标列全非空）。
- **红绿自查（证明断言真能红）**：在 core 的 `spec.md` 上做三处临时破坏（`V-P2.2` 级别词改
  `常驻＋验收期两次`、`V-P4.7` 坐标改不存在的 `::V-P4.99`、`V-P7.1` 坐标改未在册的
  `tests/pod-nowhere.test.mjs::V-P7.1`）后复跑：③红、④红、现状锁定红、句子型引注白名单红、
  搁置清单红、落点集合红——**6 例变红（9/15）**；还原（SHA-256 逐字回）后 **15/15 全绿**。
  证据：`.tmp/core-gates/spec-face-red.log`。

#### 3. 搁置处置（07／08／09）

| 票 | core 状态 | 实现保留地（`integration/pod`，勿动） | core 分支处置 |
|---|---|---|---|
| 07 通用工具行＋回合折叠头 | `ready-for-human` | `371717c`（feat）／`b6979ab`（票面记录）／`d3b0d86`（并入）＋`tests/pod-tool-rows.test.mjs` | 不含实现；判据 `V-P5.1`–`V-P5.5`／`V-P6.1`–`V-P6.5` 在搁置清单与 §4 表中标「搁置」 |
| 08 bash／diff／read／search 专用行 | `ready-for-human` | `db31833`（feat）／`41b8f8f`（票面记录）／`03a741d`（并入）＋`tests/pod-tool-rows-specialized.test.mjs` | 同上；`V-P5.6`／`V-P5.7` 标「搁置」 |
| 09 turn-trigger 形制统一 | `ready-for-human` | `985ff0c`（feat）／`26bd2bb`（07 并入＋`MsgList` 名收敛）／`eee1e0c`（并入）＋`tests/pod-turn-trigger.test.mjs` | 同上；`V-P5.8`／`V-P5.9` 标「搁置」；core 的讨论组折叠组仍是 03 基座件的既有形制 |

- 三票 Comments 已各补「搁置（2026-10-10 用户裁定）节」：用户原话、搁置范围、实现保留地（列关键
  提交 sha）、core 不含该件、**恢复条件＝用户定形后另批**。
- 规格 `spec.md` 正文与附录 A **未动**（只改 `Status:` 行）；搁置票的判据留在附录 A，坐标不改写。

#### 4. 判据逐条复核（64 条：坐标→证据；搁置票判据标「搁置」）

判定口径：**通过**＝坐标落点真实存在且语义对得上（可执行面看断言与退出码；人工面引
`WALKTHROUGH.md`）；**搁置**＝判据所属票由用户裁定搁置，core 无实现与测试落点（登记在搁置清单）；
**不可执行**＝执行窗口在后续批次或运行时点；**署名待确认**＝机器半边通过、人工半边待用户署名。

| 判据 | 判定 | 证据（core 工作树） |
|---|---|---|
| `V-P1.1` | 通过 | `GLOSSARY.md` Pod 词条（视觉 `Pod`／标识符小写 `pod`／「宿主包名校验只收小写」）；`pod-spec-face::V-P1.1` 绿 |
| `V-P1.2` | 通过 | 词条显式「不是席位的称呼」＋「不外借、不并列、不互为同义词」；活文档「Pod 席位」式用法零命中；`::V-P1.2` 绿 |
| `V-P1.3` | 通过 | 词条 `_Avoid_:` 行含 `` `Bot 模式` ``＋「历史别名」；`lib/client.js` `entry.label` zh/en 均 `Pod`；`::V-P1.3` 绿 |
| `V-P1.4` | 通过 | 冻结件旧名命中⊆白名单、活面「应改未改」空集；`::V-P1.4/V-P1.5/V-P8.2` 绿 |
| `V-P1.5` | 通过 | 代码内部名保留（`dsh-bots-pod-layer`／`-seat-list`／`-seat-view` 逐名断言）＋入口标签无旧名；`::V-P1.5`／`::V-P1.5b` 绿 |
| `V-P2.1` | 通过 | `pod-overlay::V-P2.1`（官方条目账本不变）＋探针 `P-CLIENT-SLOTS`（`sidebar`／`main` 两相 `phase:"never"`） |
| `V-P2.2` | 通过＋**署名待确认** | 机器半边 `::V-P2.2` 绿；人工半边＝`WALKTHROUGH.md` 条目 2（官方页仍挂载、滚动 3000→3000） |
| `V-P2.3` | 通过 | `::V-P2.3` 负例（不得 `hidden`／`display:none`）绿 |
| `V-P2.4` | 通过 | `::V-P2.4`（`shell.overlay`＋portal＋`role=dialog`／`aria-modal`）绿；走查条目 1 实测 |
| `V-P2.5` | 通过 | 探针 `P-SHELL-OVERLAY-GEOMETRY` PASS；`::V-P2.5`（≥20 且 <900、不复用 1001）绿；`POD_LAYER.zIndexBase=21` |
| `V-P2.6` | 通过 | `::V-P2.6`（主层注册不带 `order`）绿 |
| `V-P2.7` | 通过＋**署名待确认** | `::V-P2.7`／`::V-P2.7b` 绿；走查条目 4（Tab 囚笼＋背景 3 件 `inert`） |
| `V-P2.8` | 通过 | 探针 `P-SHELL-FOCUS-LAYER` PASS；`pod-overlay::V-P2.8` 族（含 `V-P2.8b`／`V-P2.8c`）绿 |
| `V-P2.9` | 通过＋**署名待确认** | 探针断言被盖元素让键；走查条目 5（`Ctrl+B` 后侧栏 280→280，**弱证据**） |
| `V-P2.10` | 通过 | `::V-P2.10` 负例（无 `closeDetails`、`layout` 面零触达）绿 |
| `V-P2.11` | 通过＋**署名待确认** | `::V-P2.11`（草稿／选中保留、视图不卸载重挂）绿；走查条目 11（主区换代过渡标记、切回内容保留） |
| `V-P3.1` | 通过 | `pod-transition::V-P3.1` 绿；走查条目 6（`0.2s`／`cubic-bezier(0.4,0,0.2,1)`／`opacity 0→1`＋`translateY(4px)→0`） |
| `V-P3.2` | 通过 | 探针 `P-HOST-TRANSITION-TOKENS` PASS；`::V-P3.2` 与探针导出逐名逐 kind 双向绑定（`podTransitionTokenRows()`） |
| `V-P3.3` | 通过 | `::V-P3.3` 范围差分（进出＝层整体／内切席位＝只主区）绿 |
| `V-P3.4` | 通过（真机未实测） | `::V-P3.4`（媒体查询桩 → 瞬时）绿；真机项见「不可执行」栏 b |
| `V-P3.5` | 通过＋**署名待确认** | `::V-P3.5` 首帧断言绿；走查条目 6（t=120ms 中间帧平滑、无白屏帧） |
| `V-P3.6` | 通过 | `::V-P3.6` 负例（不依赖 `hidden`／`display:none`、无宿主私有样式钩子）绿 |
| `V-P4.1` | 通过 | `pod-trace` `V-P4.1` 族（路由＋`since`＋405/404／注册表 404／无会话空轨迹／离线盘投影＋mtime-size 缓存＋增量／v4 代际／在线 RPC 优先）绿 |
| `V-P4.2` | 通过 | `V-P4.2` 族（字段与缺省语义／键集封闭）绿 |
| `V-P4.3` | 通过 | `V-P4.3` 族（PTC 信封、内层真实名不别名化）＋`V-P4.7` 族绿 |
| `V-P4.4` | 通过 | `org-mail-shared-face::内容键封闭` 绿＋`mail-at-least-once` 整件绿＋`pod-trace::V-P4.4` 负例绿 |
| `V-P4.5` | 通过 | `pod-trace::V-P4.5` 负例（`session-driver` 回合返回形状仍为 `{text, sessionId}`）＋`session-driver` 整件绿 |
| `V-P4.6` | 通过 | 损坏日志 fail-closed（空轨迹、不抛到 HTTP 面外）绿 |
| `V-P4.7` | 通过 | `V-P4.7` 族（并发子调用／中断／crash-orphaned／未闭合／缺名孤儿／坏报文）绿，缺口计数可见 |
| `V-P5.1`–`V-P5.5` | **搁置（票 07）** | 判据落点＝`tests/pod-tool-rows.test.mjs`（在搁置清单内，core 无此件）；实现保留 `integration/pod 371717c` |
| `V-P5.6`／`V-P5.7` | **搁置（票 08）** | 落点＝`tests/pod-tool-rows-specialized.test.mjs`（搁置清单）；实现保留 `db31833` |
| `V-P5.8`／`V-P5.9` | **搁置（票 09）** | 落点＝`tests/pod-turn-trigger.test.mjs`（搁置清单）；实现保留 `985ff0c` |
| `V-P5.10` | 通过 | `client-disclosure` 7 例绿（骨架／aria／受控／槽位／键盘／样式基座／`DiscussionGroup` 复用）＋`tests/run.mjs` 91/91 |
| `V-P5.11` | 通过＋**署名待确认** | 人工目视（并入 11 号票真机清单：走查条目 1／2／3／12 的截图与 DOM 数字） |
| `V-P6.1`–`V-P6.5` | **搁置（票 07）** | 附录 A 原坐标指 `tests/pod-assembly.test.mjs`（07 定稿期计划名，在搁置清单内）；实际落点随 07 搁置 |
| `V-P6.6` | 通过（治理面） | 上浮口径＝`lib/org/acceptance-coordinates.js::HUMAN_CRITERION_CATEGORIES` fail-closed；本批无 `needs-user` 上浮项 |
| `V-P7.1` | 通过 | 规格写明「基底＝官方默认 preset `standard`（27 工具）＋呈现面 ptc」＋`pod-harness-base::V-P7.1` 绿 |
| `V-P7.2` | 通过 | `::V-P7.2`（27 工具与官方 preset 逐项一致）绿（本次未 SKIP） |
| `V-P7.3` | 通过 | `::V-P7.3`＋`bot-faces-ready`（`DSH_TOOLS_MODE` 无条件注入、不按 provider 分叉）绿 |
| `V-P7.4` | 通过 | `::V-P7.4 死配置清理：生成器同步`＋`bot-profile::生成器不写出死键` 绿 |
| `V-P7.5` | 通过 | `::V-P7.5`（`dsh --dump-config` 不再出现 `agent-presets`／`settings` 死重定向）绿 |
| `V-P7.6` | 通过 | `org-op-set` 整件绿＋`::V-P7.6` 负例（改名 op 即被拒）绿 |
| `V-P7.7` | 通过 | `docs/PROJECT_UNDERSTANDING.md`「仍可选题」登记（死目录＋13 条断链软链）；`::V-P7.7` 文档面绿 |
| `V-P8.1` | 通过（票面实况）＋**坐标未补记** | 11 号票 `Blocked by: 05, 08, 09, 10`；12→13→14→15 串行；core 附录 A 坐标为命令＋票面引注（`UNBACKFILLED_ROWS` 在册；落点核见 `tests/project-context.test.mjs`） |
| `V-P8.2` | 通过（清单扫全；改名批做减法） | 九类在活面各有真实落点；「应改未改」清单归票 12／13；`::V-P8.2` 绿 |
| `V-P8.3` | **不可执行（票 13）** | 附录 A 坐标指 `tests/pod-rename-env.test.mjs`（票 13 交付，core 未创建、未补记）；`POD_*` 双读与仓库外两脚本更新在票 13 窗口 |
| `V-P8.4` | **不可执行（票 13）** | 四同名核验需改包名／目录／module id／patch 行 |
| `V-P8.5` | **不可执行（票 14）** | 数据面迁移方案与逐件校验属票 14；执行另需逐项点名 |
| `V-P8.6` | **不可执行（票 15）** | 「改名触发新 `runId` 增量包」在票 15；门②现在 10/10（本批未触包内件） |
| `V-P8.7` | **不可执行（票 13／14／15）** | 授权点各一次点名属后续批次 |
| `V-P9.1` | 通过（**哈希已复算**） | 规格冻结事件 `EV-20261009-pod-spec-freeze`（`docs/changelog/2026-10-04.md`，原文 SHA-256 `d9370bcc…`）；core 只改 `Status:` 行，收口后 SHA-256＝`295fd5307df529175e78b2d88ed54655cf9a734eba3e6de3854c48f34372deaa`（与冻结件的关系随 CHANGELOG 事件落档，Lead） |
| `V-P9.2` | 通过 | 附录 A 人工记号全部 `人工:human-visual-checklist`（9 条判据），白名单外零命中；`::V-P9.2`（同件用例）绿 |
| `V-P9.3` | 通过 | `tests/pod-spec-face.test.mjs` **15/15**（四项机械检查＋现状锁定＋两表双向锁定＋搁置清单双向锁定）；红绿自查 6 例变红见 §2 |
| `V-P9.4` | 通过（收口计数达标）＋**署名待确认** | `preflight` 总判 PASS（91/91、10/10、0 违例、15/0/0）；真机目视由 Lead 走查、证据引 `WALKTHROUGH.md`；核验人署名待用户确认 |

**不可执行与需关注（单列）**

| # | 条目 | 性质 |
|---|---|---|
| a | `V-P8.3` 仓库外脚本更新（`~/.dsh/dsh-web.sh`／`restart-split.sh`） | 不可执行：运行面写入，属票 13 授权窗口 |
| b | `V-P3.4` 真机 `prefers-reduced-motion` 观感 | 不可执行（本次窗口）：headless 未模拟；由单测 `V-P3.4` 把守，真机项留后续窗口 |
| c | `V-P2.7`／`V-P2.9` 官方高层浮层「盖在 Pod 之上且可用」 | 未实测：走查期无官方设置面板打开场景（探针已证几何层叠，人工半边留后续窗口） |
| d | 通知抬档（走查条目 13：Pod 期 `z-index 23`） | 未实测：窗口内无通知事件，仅单测把守 |
| e | 票 02 Comments 实施记录 | **缺**：三新面与三态探针的交付物在仓内可核（`lib/host-faces.js` 17 条 `probeId`＋探针门 15 PASS），但票面无实施记录；本批在票 02 补了收口指针（§0 不改他人实施记录正文口径） |
| f | 票 02／03 验收框 | 未勾——本票按「Comments 实施与验证证据＋当月日志卷事件」口径将其 `Status` 置 `resolved`（交付物在仓内可核），勾选框留原文不改 |
| g | `V-P9.4` 基线数字 | 规格「执行编排」节写「宿主契约 12 PASS」为前置基线；票 02 加三面后实测 15，**判定按 ≥ 基线放行**，基线口径更新归 Lead |
| h | 人工判据署名 | 走查条目 1–12 由 Lead 走查（真实宿主＋真实 GUI＋截图／DOM 实测）；**核验人署名待用户确认**，代签＝落档作假（§G-G7） |
| i | 搁置件判据无 core 机器落点 | 07／08／09 的 14 条判据（`V-P5.1`–`V-P5.9`、`V-P6.1`–`V-P6.5` 共 14 条）在 core 无实现与测试——由**搁置清单**（4 条，双向锁定）显式登记，非坐标空缺；恢复搁置件时同批清表 |
| j | core 附录 A 未补记 2 条 | `V-P8.1`／`V-P8.3`：core 批不改附录 A（用户口径＝只改 Status 行），故 `b5021b6` 的坐标补记未落 core；`UNBACKFILLED_ROWS` 在册＋双向锁定。**Lead 若要 core 也补记坐标，须授权改附录 A**（见 §8-7） |
| k | 部署面未同步 | core 的部署面（不含工具行的形态）**本批未同步**——由 Lead 另出部署计划／执行记录（`357c152`／`a4f9ccd` 对应的是含搁置件的部署面，不入 core） |

#### 5. 与 `integration/pod` 的差异证据（确认只差搁置件）

（命令按收口提交实测；方向＝core → integration：`+` ＝仅 integration 侧有、`−` ＝仅 core 侧有。）

```
$ git diff --stat integration/pod-core integration/pod -- lib/client.js
 lib/client.js | 1398 ++++++++++++++++++++++++++++++++++++++++++++++++++++++---
 1 file changed, 1341 insertions(+), 57 deletions(-)
```

```
$ git diff --stat integration/pod-core integration/pod | tail -20
 .scratch/pod/issues/05-pod-transition-motion.md    |    4 +-
 .scratch/pod/issues/06-trace-read-face.md          |    6 +-
 .scratch/pod/issues/07-tool-rows-generic.md        |  132 +-
 .scratch/pod/issues/08-tool-rows-specialized.md    |  137 +-
 .scratch/pod/issues/09-turn-trigger-form.md        |  135 +-
 .scratch/pod/issues/10-harness-base-explicit.md    |    4 +-
 .scratch/pod/issues/11-feature-batch-closure.md    |  486 +++----
 .scratch/pod/spec.md                               |   56 +-
 ...feature-batch-20261010T1816Z-sync-16d4fa06.json |  431 ++++++
 ...re-batch-fix1-20261010T1832Z-sync-22eadaea.json |   46 +
 ...feature-batch-20261010T1816Z-plan-9a4bb756.json |  472 +++++++
 ...re-batch-fix1-20261010T1832Z-plan-d91658b2.json |   32 +
 lib/client.js                                      | 1398 ++++++++++++++++++++
 tests/client-disclosure.test.mjs                   |  114 +-
 tests/locale.test.mjs                              |    4 +-
 tests/pod-spec-face.test.mjs                       |  254 +---
 tests/pod-tool-rows-specialized.test.mjs           |  686 ++++++++
 tests/pod-tool-rows.test.mjs                       |  706 ++++++++
 tests/pod-turn-trigger.test.mjs                    |  406 ++++++
 23 files changed, 4820 insertions(+), 705 deletions(-)
```

**逐类核对**（差异**只**是搁置件与 core 口径改写，无其它漂移）：

> 数字说明：`lib/client.js`（1341／57）、三件搁置测试件、`spec.md`（56）为收口提交实测且稳定；
> 票面 `.md` 的行数（含 `11-feature-batch-closure.md` 自身那行与末行总计）随本记录维护抖动
> ±1–2 行（差异集合与逐类结论不变）。


1. `lib/client.js`：integration 侧独有 1341 行＝07／08／09 的客户端实现与文案：工具行拼装／渲染
   （`ToolRow`／`ToolCallGroup`／`assemble`／`assembleDiagnostics`／`toolRowCss`／`dsh-bots-tool-*`）、
   专用行形态、`turn-trigger` 形制（`ExternalTriggerRow`／`externalTriggersOf`／
   `dsh-bots-turn-trigger`／`TRIGGER_KIND_KEYS`）、09 的会话流导出名收敛（`MsgList` 导出与注释）与
   讨论组改走披露行、locale 字典的 `tool.call`／`trigger.*` 键、07 的轨迹状态
   （`traceByBot`／`traceGapByBot`）、09 的测试兜底路径（`localeDictsForTest`）。
   core 侧独有 57 行＝上述改造替换掉的 core 现状（旧讨论组手工折叠形制与 `.dsh-bots-disc-*` 胶囊样式、
   旧 `tr()` 兜底、旧 `MsgList` 用法等），**均不含搁置符号**。
2. 测试件：integration 侧独有 `pod-tool-rows.test.mjs`（706）／`pod-tool-rows-specialized.test.mjs`（686）／
   `pod-turn-trigger.test.mjs`（406）＝搁置件测试，不入 core；`client-disclosure.test.mjs`（114 行差）
   与 `locale.test.mjs`（4 行差）的改动源自 09（搁置），不入 core；`pod-spec-face.test.mjs`（254 行差）
   ＝本票新增件的 **core 适配版**（§2：搁置清单／未补记白名单／现状锁定表／文法加固）。
3. 文档：07／08／09 票＝「搁置」节＋`Status: ready-for-human`（core 新写；132／137／135 行差）；
   05／06／10 等票＝`Status: resolved`＋收口指针（core 口径改写）；11 票＝本记录（482 行差）；
   `spec.md` ＝只改 `Status` 行（56 行差＝integration 侧另有 27 条坐标补记与 `Status` 文案，core 未落）。
4. 4 个 `docs/changelog/*.json`＝`357c152`／`a4f9ccd` 的部署计划与执行记录（对应**含搁置件**的部署面），
   core 不带；core 部署面另出（Lead）。
5. **搁置符号自查（应为 0 命中）**：

```
$ grep -rnE 'ToolRow|ToolCallGroup|assembleDiagnostics|ExternalTriggerRow|externalTriggersOf|toolRowCss|dsh-bots-tool-|dsh-bots-turn-trigger' lib/ tests/ scripts/
（唯一命中＝tests/pod-harness-base.test.mjs:191-192 的局部变量 enabledToolRows——票 10 既有件，
  指官方 preset 工具表行名，非 07 的行组件；该两行在 fb9a4d5 基线即存在，非搁置件带入）
```

其余为零：`ToolCallGroup`／`assemble`／`assembleDiagnostics`／`ExternalTriggerRow`／
`externalTriggersOf`／`toolRowCss`／`dsh-bots-tool-*`／`dsh-bots-turn-trigger` 命中数＝**0**；
`traceByBot`／`traceGapByBot`／`localeDictsForTest`／`TRIGGER_KIND_KEYS`／`MsgList` 导出＝**0**。

#### 6. 真机走查（引 `.tmp/pod-ctx/evidence/WALKTHROUGH.md`）

- 走查事实：2026-10-10 在真实宿主 `dsh web`@127.0.0.1:3080 ＋ 容器内 headless Chrome（CDP 9222）上完成，
  部署面是 `integration/pod` `083be09`＋走查返修 `92678b5`（217/217 same，记录见
  `artifacts/cutover-execution/`），证据 17 件在 `.tmp/pod-ctx/evidence/`。
- **core 范围适用条目**（不涉工具行）：1（整屏层／`role=dialog`／`aria-modal`）、1a（席位列自持宽度
  280／主区 1160，返修 `cc9c1ea`）、2（官方页保活）、3（退出＝撤层）、4（Tab 囚笼）、5（宿主快捷键，
  弱证据）、6（过渡动效：`entering→shown`、`0.2s`＋`cubic-bezier(0.4,0,0.2,1)`、`opacity 0→1`＋
  `translateY(4px)→0`、t=120ms 中间帧平滑）、11（Pod 内切席位：只主区换代过渡标记、切回保留）、
  12（无工具回合零回归）——**共 9 项通过**。
- **搁置件条目**（core 不主张，随票 07／08／09 搁置）：7（通用工具行折叠头）、8（PTC 信封子调用行）、
  9（四类专用行分布与终端块）、10（`turn-trigger` 形制行）。
- **未实测 2 项**：13（通知抬档，窗口内无通知事件）、14（reduced-motion，headless 未模拟）；
  由单测 `pod-overlay::I1` 与 `pod-transition::V-P3.4` 把守，见「不可执行」栏 b／d。
- **人工判据署名：待用户确认**（`WALKTHROUGH.md` 末节；Lead 走查不能替代用户署名）。

#### 7. CHANGELOG 事件（建议文本，由 Lead 落档——core 批不写卷）

- `--id EV-20261010-pod-core-batch-close`
- 标题：pod 功能批 **core 范围**收口（覆盖式常驻＋过渡动效；07／08／09 按用户裁定搁置；四门 PASS）
- 范围：`.scratch/pod/issues/01…11-*.md`（01–06／10／11 ＋ 07／08／09 的搁置节）、
  `.scratch/pod/spec.md`（**只改 `Status:` 行**）、`tests/pod-spec-face.test.mjs`（新增，搁置态适配）、
  `tests/pod-transition.test.mjs`（M9 口径）、`lib/client.js`、`lib/host-faces.js`、
  `scripts/host-contract-probe.mjs`、`tests/host-contract-gate.test.mjs`、`tests/pod-overlay.test.mjs`；
  本事件。**不含** `docs/changelog/` 部署记录（core 部署面另出）。
- 变化：① 覆盖式常驻（`shell.overlay` 增删覆盖层条目＋整屏 portal 到 body；官方会话页与侧栏全程保活，
  退出＝撤层；背景 `inert` 采集与 LIFO 还原；`useModalLayer` 契约；通知抬档）；
  ② 克制的过渡语言（进出＝层整体淡入＋约 4px 上浮、约 200ms；切席位＝只主区；取宿主 `--ds-*` 令牌＋
  常量回退；`prefers-reduced-motion` 退化）；③ 形式件基座（票 03 的 `DisclosureRow`／令牌化样式基座）
  与 L1／L2 面（票 10 基底显式化、票 06 只读轨迹投影）**不动**；④ **工具行／专用行／turn-trigger
  形制不并入**（用户 2026-10-10 裁定搁置；实现保留在 `integration/pod`）。
- 验证：`TMPDIR=/tmp node scripts/preflight.mjs` → **PASS**：①回归 **91/91**（0 SKIP）②冻结面（0010 包）
  **10/10** ③status-lint **0 违例** ④宿主契约 **15 PASS／0 FAIL／0 SKIP**；
  `tests/pod-spec-face.test.mjs` **15/15**（§G-G4 四项机械检查；55 条机械可解析＋9 条句子型引注双向锁定；
  搁置清单 4 条双向锁定；红绿自查 6 例变红后还原全绿）；真机走查 core 适用 9 项通过＋搁置 4 项不主张＋
  未实测 2 项（`.tmp/pod-ctx/evidence/WALKTHROUGH.md`，人工判据署名待用户确认）；关键哈希：
  `.scratch/pod/spec.md` 收口后 SHA-256＝`295fd5307df529175e78b2d88ed54655cf9a734eba3e6de3854c48f34372deaa`
  （冻结时 `d9370bccfd4da74fac9ae6c8b9799d7658d4d823cab59b9954ea373b22436c86`；本批只改 `Status:` 行，
  判据语义与附录 A 未动）。
- 授权：用户 2026-10-10 裁定（原话见 §0）＝07／08／09 搁置、其余另立分支待并；Q27「4保留ptc，
  其他我没有建议」＋Q25a「其余无异议」接受本批范围（共识 §3.2）；部署同步、bot/host 重启、
  新 `runId` 证据包按运行面三件**逐项点名**（本批不含）。

#### 8. 未闭合项（移交备注：当前假设＋下一步＋关键证据指针）

1. **人工判据署名**：当前假设＝Lead 走查记录（core 适用 9 项）可作为人工目视事实证据；
   下一步＝请用户在 `WALKTHROUGH.md` 末节署名（代签＝落档作假）；证据指针＝
   `.tmp/pod-ctx/evidence/WALKTHROUGH.md`。
2. **搁置件恢复**：当前假设＝07／08／09 待用户定形后另批；下一步＝另批立项时从 `integration/pod`
   取回（`371717c`／`db31833`／`985ff0c` ＋各自票面记录与测试件），并同批清空 core 的搁置清单
   （`tests/pod-spec-face.test.mjs::PARKED_LANDINGS`）与 §4 的「搁置」标记；证据指针＝三票 Comments
   「搁置（2026-10-10 用户裁定）」节。
3. **core 与 `integration/pod` 的并轨策略**：当前假设＝core 是**待并**形态、`integration/pod` 是搁置件
   保留地，两者不互相 cherry-pick；下一步＝Lead 决定 core 并入 `main` 的时点与是否需要 rebase；
   证据指针＝§5 差异证据（差异只差搁置件）。
4. **core 的部署面**：当前假设＝core 回到不含工具行的形态，部署由 Lead 另出计划／执行记录；
   下一步＝Lead 逐项点名授权后执行（`357c152`／`a4f9ccd` 对应含搁置件的部署面，不可复用其结论）；
   证据指针＝`artifacts/cutover-preparation/`、`artifacts/cutover-execution/`（现存记录均为 integration 面）。
5. **票 02 Comments 缺记录**：当前假设＝交付物（三新面＋三态探针，15 PASS／0 FAIL／0 SKIP）可核即可；
   下一步＝若要补记录，由 Lead 决定是否在票 02 追加跨票指针（本批只补收口指针，不代写实施记录）；
   证据指针＝`lib/host-faces.js`（17 条 `probeId`）、`scripts/host-contract-probe.mjs`、preflight ④ 输出。
6. **通知抬档／reduced-motion／官方浮层压 Pod** 三项未实测：当前假设＝分别由单测（`pod-overlay::I1`、
   `pod-transition::V-P3.4`、探针 `P-SHELL-OVERLAY-GEOMETRY`）把守；下一步＝后续窗口补真机目视；
   证据指针＝`WALKTHROUGH.md` 条目 13／14＋「不可执行」栏 b／c／d。
7. **core 附录 A 未补记 2 条**（`V-P8.1`／`V-P8.3`）：当前假设＝core 批只改 `Status:` 行、附录 A 不动，
   两条以 `UNBACKFILLED_ROWS` 显式登记＋双向锁定；下一步＝**若 Lead 要求 core 与 integration 的坐标
   口径齐平，须授权改附录 A（或改坐标列）**，届时同批更新 `CANONICAL_COORDINATES` 与
   `UNBACKFILLED_ROWS`；证据指针＝§2 适配说明＋`tests/pod-spec-face.test.mjs` 头部注释。
8. **一行跨票依赖 `exports.getBotState`**：当前假设＝票 04 复核返修的用例直读 store 只读缝
   （`mod.getBotState()`，9 处），而 integration 侧该导出由票 07 的提交带入（`371717c`）；core 为让
   core 范围用例可跑，**只带这一行导出**（`lib/client.js` 的 `exports.getBotState = getBotState;`，
   非工具行代码，§5 搁置符号自查零命中）；下一步＝搁置件恢复时该行仍在两边，无需处置；
   证据指针＝`tests/pod-overlay.test.mjs`（`V-P2.11`／`I4＋M7`／`I1` 三组用例）＋`lib/client.js` 导出面。
9. **规格 SHA-256 复算**：当前假设＝只改 `Status:` 行属收口标记，判据语义未动；下一步＝Lead 落档事件时
   填入 `295fd53…` 并记与冻结件 `d9370bcc…` 的关系；证据指针＝`docs/changelog/2026-10-04.md`
   （`EV-20261009-pod-spec-freeze`）。
10. **12–15 改名批**：当前假设＝功能先行已完成（core 批不做改名）；下一步＝按用户点名先做票 12；
    证据指针＝`.scratch/pod/issues/12-…15-rename-*.md`＋§4 的 `V-P8.3`–`V-P8.7` 四条不可执行行。
