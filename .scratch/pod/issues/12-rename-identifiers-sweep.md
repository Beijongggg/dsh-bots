# 12: 改名·仓库内标识符扫

**What to build:** 在仓库内把旧名扫成新名，且**独立保持全绿**——不动包名、模块 id、env、
数据路径与跨进程 wire 契约（那些留给下一票）。

**Blocked by:** 11

**Status:** resolved（2026-10-10 实施完成：lib／tests／scripts／活文档扫描完成，剩余命中清单三类齐备，四门 91/91・10/10・0 违例・15-0-0；**预览图与架构快照派生件重出移交票 15**，见「偏离与未闭合项」1／2）

- [ ] 覆盖：CSS 类名前缀、locale 命名空间与其断言、日志前缀、effect 标签、UI 文案键、
      DOM 属性与 `data-*`、表单 id、测试与脚本字面量、README／领域文档／架构快照与预览图重出；
      —— **代码／测试／脚本／活文档／架构快照文本标签已完成**；**预览图与架构派生件（HTML／trace／
      webm／gif）重出**从本票**移交票 15**（理由：预览图重出需先部署改名后版本；派生件仓内无生成器）。
- [x] 产出「剩余命中清单」并显式分类：**应改未改**与**冻结件保留**（`TEMP-*`／`CLOSURE-*`／
      历史 CHANGELOG／`artifacts/packages/`）两类不得混淆；
- [x] 回归全绿＋宿主契约探针全绿；
- [x] 不改包名／模块 id／env 名／数据路径常量／跨进程头名与 HTTP 前缀（下一票范围）；
- [x] 引用将被下一票移动的代码时，票面用符号名而非行号。

## Comments

### 实施记录（2026-10-10）

**结论**：12 号票范围内的仓库内标识符已扫净；`lib/`／`tests/`／`scripts/` 全代码面上
旧名残留**只剩票 13 身份／wire／env 面**（机械把守见下），四门全绿
（①91/91、②10/10、③0 违例、④15 PASS／0 FAIL／0 SKIP）。

> **收口状态（补记）**：本实施记录的三条提交为 `f557f51`（lib）／`6fa9841`（tests/scripts）／
> `dae3b90`（docs＋本记录）；其后 Lead 以 `4422b75` 收口——`Status:` 翻 `resolved`、
> 预览图与架构派生件重出**移交票 15**、清单项勾选。故上段写下的「Status 未动／CHANGELOG 未写」
> 是本实施时点的状态描述（实施者按票面纪律不翻 Status、不写 CHANGELOG），**以 Lead 收口的
> `4422b75` 为准**。

**机械把守（本票新建）**：`tests/pod-spec-face.test.mjs` 的
`codeFaceOldNameScan()`（导出）+ 用例「V-P1.4/V-P1.5 12 号票标识符扫」：
扫 `lib/`／`tests/`／`scripts/` **189 件**，把旧名按四类记号拆开
（`bare` `dsh-bots`／`hyphen` `dsh-bots-*`／`colon` `dsh-bots:*`／`env` `DSH_BOTS_*`），
除**逐条登记**的文件级许可（`IDENTITY_ALLOW_TOKENS`）与形许可（`IDENTITY_ALLOW_SHAPES`）外
一律红；双向锁定——许可陈旧（记号已不存在）或形未被命中同样红。
**不扫 `docs/`**：冻结件与领域文档各有其面（冻结面归门②包内 sha 复验）。

改动面（按票面 10 类逐条）：

| # | 类别 | 落点与计数 |
|---|---|---|
| 1 | CSS 类名前缀 | `lib/client.js`：`dsh-bots-*` → `pod-*` **全量**——不同类名／关键帧名 206 个、选择器字面量 171 处（含 `.dsh-bots-collapsed` 等状态类、`@keyframes dsh-bots-turnstatus-shimmer`）；覆盖层类块 `POD_LAYER_CLASSES` 9 项 + `DISCLOSURE_CLASSES` 10 项 |
| 2 | locale 命名空间 | `lib/client.js:38` `LOCALE_NS "bots"` → `"pod"`；`ctx.locale.bind/register` 2 处；`tests/locale.test.mjs:42` 断言、`tests/locale-runtime.test.mjs` 4 处 `bind/register("bots")` 与注释同步 |
| 3 | 日志前缀 | `lib/` 内 `[dsh-bots]` → `[pod]` **104 处**（`index.js` 58、`bot-autostart` 4、`bot-supervisor` 7、`org/capability-delivery` 5、`org/host-env-seam` 5（`[dsh-bots][seam]`）、`org/ledger-host` 19、`org/mail-relay` 3、`org/op-set` 1、`org/permissions` 2、`org/post-channel` 1、`lock-trace` 1）；组件导语里的产品名（`lib/index.js`／`lib/stats.js`／`lib/shared.cjs` 头部注释、`lib/shared.cjs` 生成行注释）同步改 `Pod` |
| 4 | effect 标签 | **9 处**：`lib/index.js` 7（团队提示段／知识库＋岗位工具面／自动回复 watcher／邮件到达通知监视器／组织通道代际释放／台账值守／`/api/bots` 路由）＋`lib/client.js` 2（字典注册／根级 SSE 订阅）；`tests/ledger-host.test.mjs` 2 处断言同步（该件夹具直写标签串） |
| 5 | UI 文案键 | **零改动**——locale 词典键名（`notice.*`／`error.*`／`stats.*`／`pick.*`／`entry.label`）**不含旧名**；`entry.label` 早已是 `Pod`（zh／en 同源）。域名词 `bots`（`error.botsFetchFailed`、`/api/bots` 响应字段、`bots` 列表变量）属**领域词**（席位／bot 团队），共识 §1.3 明确不外借、不改 |
| 6 | `data-*` 属性 | **20 处**：`data-dsh-bots-pod-*` → `data-pod-pod-*`（`lib/client.js` 9 处属性字面量 + 读属性 1 处 + 渲染 9 处；`tests/pod-overlay.test.mjs` 9 处选择器断言） |
| 7 | 表单／元素 id | `dsh-bots-f-*` 8 个表单 id、`dsh-bots-entry`／`dsh-bots-notices`／`dsh-bots-pod` 三个宿主槽条目 id + DOM 类名、`dsh-bots-*sidebar*`／`main`／`rail` 等**全部槽位与元素 id** → `pod-*`；探针 `scripts/host-contract-probe.mjs` 4 条 in-table 期望值（`value: "pod-"`）与 `tests/host-contract-gate.test.mjs` 25 处夹具／断言、`tests/pod-transition.test.mjs` 12 处断言、`tests/pod-overlay.test.mjs` 36 处断言同步 |
| 8 | 测试与脚本字面量 | `tests/` 32 件、`scripts/` 2 件：类名／id／locale ns／effect 标签／日志前缀／`data-*`／临时目录前缀（`dsh-bots-*`→`pod-*`，30+ 处 `mkdtempSync`）全部换新；探针与 `scripts/bot-health.cjs` 里**部署目录**字面量按票面**不动**（票 13） |
| 9 | 文档 | `README.md` 卷首题名（`# Pod（pod）文档导航`）＋架构快照行注记、`CHANGELOG.md` 题名、`AGENTS.md` 题名、`docs/PROJECT_UNDERSTANDING.md` 4 处（题名／产品名句／`dsh-bots-pill`→`pod-pill`／`[dsh-bots][seam]`→`[pod][seam]`）；`docs/dsh-bots-architecture.json` **文本标签** 2 处（`meta.title`、`boundaries[].label`）→ 派生件登记待重出（见下） |
| 10 | 预览图 | **未重出**（登记「待重出（需授权窗口／现行工具）」，见下） |

**验证命令与实际计数**：
- `TMPDIR=/tmp node tests/run.mjs` → **91/91 个测试文件通过**（基线 91，无 SKIP；本票未新增测试**文件**，新增用例落在既有 `tests/pod-spec-face.test.mjs`，故文件数不增）；
- `TMPDIR=/tmp node scripts/preflight.mjs` → ①**91/91** ✅　②**冻结面（0010 包）10/10** ✅　③**status-lint 0 违例**（扫 114 个 md；命名扫描 212 个活文件）✅　④**宿主契约 15 PASS／0 FAIL／0 SKIP** ✅　`preflight: PASS`；
- `tests/pod-spec-face.test.mjs` 内 16 用例全绿（含新建的 12 号票扫描用例）。

---

### 剩余命中清单（12 号票口径）

扫描基线：`grep -rn "dsh-bots"` 排除 `.git/`、`node_modules/`、`.worktrees/`、`.tmp/`；
代码面另经 `codeFaceOldNameScan()` 按**记号**复核（189 件、许可面 214 记号／52 件）。

#### 一、已改（本票闭环）

- **代码面**：本票共改 `lib/` 15 件、`tests/` 34 件、`scripts/` 1 件（`git diff --name-only`）；
  其中旧名**全清**者 28 件（`lib/lock-trace.js`、`lib/org/{mail-relay,op-set,permissions}.js`、
  `lib/stats.js` ＋ `tests/` 23 件），其余改动件仍留**票 13 身份面**记号（下节逐条）。
  把守口径＝**许可外命中 0**（`hits` 空集）、**许可面 214 条全部反向验真为真**
  （`staleAllow` 空、`unusedShapes` 空）。
- **活文档**：`README.md`／`CHANGELOG.md`／`AGENTS.md`／`docs/PROJECT_UNDERSTANDING.md`
  的**显示名／UI 名**残留已改；`read` 面旧名残留**仅剩**下文第 4 条那 1 行（架构文件名，身份串）。
- 说明：票 11 的旧扫描面白名单 `POD_BATCH_SURFACES` 同步收敛为**记号级**（不再把
  `x-dsh-bots-*` 头名与 `DSH_BOTS_*` env 计入「本批自有面旧名」），并保留 V-P1.4/V-P1.5/V-P1.5b 口径。

#### 二、应改未改（归属票 13：身份／wire／env／数据路径）

> 判断口径：命中属「插件身份」「跨进程契约」「env」「运行面路径」四者之一者，
> **本票一律不碰**；逐条理由如下（机械面见 `IDENTITY_ALLOW_TOKENS`／`IDENTITY_ALLOW_SHAPES`）。

| 记号／面 | 条数 | 落点 | 归属票 13 的理由 |
|---|---|---|---|
| 模块 id／host 插件名 | 3 | `lib/client.js`（`id:"dsh-bots"`、`const name="dsh-bots"`、`tag.dataset.plugin`） | 宿主四同名绑定（patch 行 name ＝ 目录名 ＝ 包名 ＝ 前端模块 id）；单改即 `loaded without registering` |
| 包名 | 1 | `package.json` `"name"` | 同上四同名之一 |
| patch 行 name | 1 | `lib/shared.cjs` 生成 `name: 'dsh-bots'` | 同上四同名之一（生成器随票 13 同窗改） |
| 部署／备份目录字面量 | 17 | `lib/org/cutover.js`、`lib/sentinel-runner.js`、`lib/sentinel-safety.js`、`scripts/{bot-health.cjs,c2-preparation.mjs,deploy-sync.mjs,evidence-runner.mjs,ledger-drill.mjs}`、`tests/{deploy-sync,evidence-packager,evidence-runner-contract,org-cutover-check}.test.mjs` | 插件目录名＝四同名之一；改目录必连带 profile 软链／patch／部署脚本，属票 13 同窗 |
| `x-dsh-bots-*` 头 | 39（+断言） | `lib/api-security.js`（token）、`lib/org/{host-channel,ledger-host,post-channel}.js`、`lib/client.js`、`lib/index.js`、`tests/` 12 件 | 跨进程 wire 契约（身份头）；票 13 同窗切换，仓库外脚本同步 |
| rpcPrefix／rpcId | 3 | `lib/index.js`（`dshRpc` 默认值、`dsh-bots-${id}-stats/trace`、`dsh-bots-${botId}`）、`tests/rpc-envelope.test.mjs`（断言前缀） | RPC 信封 id 前缀属进程间契约面；与包名同批切换更稳（两进程同名时混线） |
| HTTP 路由前缀 | n/a | `lib/index.js`（标签「pod: /api/bots 路由」）、`lib/client.js` 全部 `api("/api/bots…")` | 票 13（路由前缀）；本票只改标签前缀，`/api/bots` 本身不动 |
| IPC 消息类型 | 20 | `lib/org/capability-delivery.js`、`lib/index.js`、`tests/org-bootstrap-channel.test.mjs`、`tests/org-cutover-check.test.mjs` | `dsh-bots:org-*` 是 host↔bot 子进程消息类型（wire） |
| `plugin:dsh-bots`（producer kind） | 3 | `lib/org/review-session.js`、`tests/org-bootstrap-channel.test.mjs` | 官方 producerKind 映射形，**由 host 插件名派生**（四同名链） |
| 提示段名 `dsh-bots:post`／`dsh-bots:team` | 5 | `lib/index.js`、`tests/role-cards.test.mjs` | systemPrompt 段名与插件身份同批（段名入宿主提示注册表，属身份面） |
| 退役段名（历史提及） | 2 | `lib/org/role-cards.js` 注释 | 03 号票已退役；注释里的**历史提及**不属活性面（形许可 `retired-section` 显式登记） |
| env 名 `DSH_BOTS_*` | 118 | `lib/{index,spawn-env,bot-autostart,bot-supervisor,sentinel-runner,org/host-env-seam}.js`＋`tests/` 15 件＋`scripts/host-contract-probe.mjs` | B 组（Q19）**明属票 13**：走 `POD_*` 优先＋兼容一个窗口的双读过渡；仓库外脚本同步 |

**小计**：代码面许可残留 **214 记号／52 件**（件数＝`lib/` 17、`tests/` 29、`scripts/` 6；
记号数＝`lib/` 74、`tests/` 123、`scripts/` 17）；
按类＝`hyphen` 39、`env` 118、`bare` 37、`colon` 20。

活文档面另有 4 处（**不在代码面扫描面内**，均属票 13 身份／数据路径）：

- `README.md:47` 架构快照行的 `docs/dsh-bots-architecture.*` **文件名**——文件名＝身份串
  （票面明令不得改名），故本票只改该文件**内容**的文本标签（`meta.title`、
  `boundaries[].label` 两处已改 `Pod`），文件名留票 13；
- `docs/PROJECT_UNDERSTANDING.md` 部署链（**2 行**）：`project/dsh-bots`（仓库目录名）、
  `~/.dsh/plugins/dsh-bots`、`~/.dsh/profiles/web/node_modules/dsh-bots`（部署目录 ＋
  profile 软链）——数据／部署路径，C 组口径；
- `docs/agents/codebase-map.md:96` 与 `docs/agents/host-runtime-map.md:51`：`x-dsh-bots-bot-id`
  头名单源锁描述与 `node_modules/dsh-bots` 解析锚——wire 头与部署路径，同上。

`docs/dsh-bots-architecture.{html,trace.html,trace.json,trace.visual-check.*,visual-check.*}`
（8 件）的**派生件内容**含旧文件名与标签：派生件待重出（仓内无生成器），
登记为「**待重出**」而非「应改未改」（见下「偏离与未闭合项」2）。

#### 三、冻结件保留（不回改）

| 面 | 计数 | 理由 |
|---|---|---|
| `artifacts/packages/`（终版 0010 等） | 7 件／70 行 | 证据包链冻结件：文件名内嵌自身 SHA；旧名残留不回改。**改名触发重采集**（新 `runId` 增量包）属票 15＋门② |
| `artifacts/` 其余（cutover-preparation/execution、archive、runs、quality-review 等） | 131 件／2070 行 | 历史执行留证与 raw 证据；只读 |
| `docs/changelog/` 历史卷 | 5 卷／25 行 | 冻结日志卷（2026-09 与 2026-10 各卷）；只读 |
| `CHANGELOG-legacy-2026-09-28.md` | 32 行 | 迁移前逐字节归档；只读 |
| `docs/history/` | 3 件／4 行 | 历史设计留档 |
| `docs/TEMP-guidance-optimization-v3.2.1.md`、`docs/CLOSURE-p6-5-qualified-scope.md` | 0 命中 | 冻结合同件；本票未触碰（核对为 0 命中） |
| `PLAN-expanded-engineering.md`／`PLAN-p6-4-*.md`／`PROPOSAL-knowledge-base.md` | 2 行 | 旧 v3 契约与历史设计（`README` §2 声明「原位保留／只读」） |
| `.scratch/` 非 pod 特性面（org-v2、batch-preflight 等） | 2304 行 | 历史票面与实验记录（历史面，非活文档） |

**两类不混淆的核验**：`codeFaceOldNameScan()` 的 `hits` 为空（＝「应改未改」在代码面上为空集），
许可面 214 条**逐条**落在上表「归属票 13」的理由内；冻结面一律在 `docs/`／`artifacts/`／
`PLAN-*`／`PROPOSAL-*`／`.scratch/` 内，明列于第三类。

---

### 偏离与未闭合项

1. **预览图未重出**（`preview/*.png` 13 张）：原图由**部署面**（`~/.dsh/plugins/dsh-bots`）
   无头截图产出；本票工作树内 `lib/client.js` 已换新类名，而部署面仍是 core 形态的
   旧类名版本（只读采样确认），重出需**部署同步授权**（写入 `~/.dsh`）或现行重出工具；
   两者本票均无授权／未寻得，故登记「**待重出（需授权窗口／现行工具）**」。
   注：部署面与本工作树在本票语义**同代**（本票只改类名前缀等非身份段，不改视觉），
   既有图与新版本视觉一致；重出为「按新版本口径重出」的登记项，非视觉回归。
2. **架构快照派生件未重出**：`docs/dsh-bots-architecture.{html,trace.html,trace.json,visual-check.*,trace.webm,trace.gif}` 由
   JSON 规格源生成，**仓内无生成器**（`grep -rln "dsh-bots-architecture" scripts/ tests/ lib/` 无命中）；
   本票只改 JSON 文本标签（2 处），派生件登记「**待重出**」——不手改二进制（webm／gif／png）。
3. **测试口径微调（已复核，非功能漂移）**：
   - `tests/rpc-envelope.test.mjs` 的 rpcId 前缀断言保持 `dsh-bots-`（实现未改，属票 13）；
   - `tests/pod-spec-face.test.mjs` 的 V-P1.5b 原断言「**代码内部名不随命名批改名**」
     与票 12「CSS 类名前缀／元素 id 要扫」直接冲突：已按票 12 判据改为
     「身份串保留（模块 id／插件名／CSRF 头名）＋旧**标识符形**绝迹」，并在用例注释写明依据；
   - `.scratch/pod/spec.md` 的 V-P8.2 **执行坐标列**补记一句（「身份类留旧名／非身份类已换新名」），
     判据／证据／级别三列未动（V-P9.1 允许补执行坐标）；
   - 票 11 的 `oldNameHits` 改**记号级**（原实现按子串匹配，会把 `x-dsh-bots-*`／`DSH_BOTS_*`
     误算作「本批自有面旧名」）；`POD_BATCH_SURFACES` 清单其项的过滤语义不变。
4. **未闭合（需 Lead 裁定）**：
   - `docs/CODE-QUALITY-ARCHITECTURE-REVIEW-2026-09-05.md`（24 行）与
     `docs/GROK-DSH-BOTS-COMPARISON.md`（36 行）是**带日期的评估／对比快照**，非活文档
     （前者标题言明「当前仓库盘面评估」，后者题名含旧名）：按「历史件不回改」还是
     「活文档显示名要改」处置，票面未点名；本票**未改**，请 Lead 在票 13／15 窗口一并裁定。
     → **Lead 裁定（2026-10-10）：按历史快照保留、不回改**（README §2 明确二者为「2026-08-30
     架构对比参考快照」与「2026-09-05 评估与发现索引」，属带日期留档；回改会让历史评估失去
     当时的命名语境）。归入「冻结件保留」类的「历史快照」子类。
   - `AGENTS.md`／`README.md` 卷首题名已改 `Pod（pod）`；若仓库目录名 `dsh-bots`
     后来也随票 13 变更，卷首名与目录名的一致性应同批复核。
- 2026-10-10 评审返修补记（EV-20261010-pod-core-review-rework）：本票 `dae3b90` 在 core 收口
  事件之后改了冻件 `spec.md`（V-P8.2 执行坐标列补句）而未随动补记新哈希（账实脱节）；已由
  返修事件更正并指向 `EV-20261010-pod-core-batch-close`（收口哈希 `295fd530…` → 现行
  `ad127a1b…`）。本轮返修未再触碰 `spec.md`；票 13／14／15 仍待逐项点名。
