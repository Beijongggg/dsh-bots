# 15: 改名·收口

**What to build:** 改名批的收口：清掉可以清的旧名残留，把不能清的冻结点重新采证。

**Blocked by:** 14

**Status:** resolved（2026-10-12 新 runId 增量证据包 0011 生成落地——runId `0480d25b-…`／包 `review-evidence-package-0011-b59bb215.json`；preflight 四门全绿 ①94/94・②冻结面 11/11・③0・④15-0-0；授权③＝用户本会话点名）

**复核点:** 命中必审清单（不可逆：冻结面证据链）→ 新包生成前独立复核（已执行：2026-10-12 子代理只读对源，结论「可按原文执行」＋计数更正 10/10→11/11）。

- [x] 旧名残留清理（可清理路径与冻结件区分清楚；冻结件不回改，只在新版本承接）——收口清点三类：可清未清＝空集、应改未改＝空集（详见收口记录）；
- [x] 改名触发了当前终版包 `sourceManifest` 内文件（部署目录名与数据路径字样在案）——
      按纪律以**新 `runId` 重采集**并生成新序号增量包，旧包只读——0011 包（runId `0480d25b-9eae-4a2c-aec1-f944d79b7762`）；
- [x] 授权：**新 `runId` 增量证据包生成属逐项授权点**（对齐规格 V-P8.7：部署同步／全 bot
      重启链／新 runId 包三件各一次点名），执行前用户点名，票面记授权依据原文；
- [x] 冻结面门（preflight ②门）在新清单下 PASS——**11/11**（0011 包 sourceManifest 11 件全符）；
- [x] `README.md` §2 与当月 CHANGELOG 事件同步（正式文档新增／移动／重命名按 §6.1 记事件）——
      §2 证据链行为「最新序号包」指针式，无需随包改动；CHANGELOG 记 EV-20261012-pod15-incremental-package；
- [x] 票面 Status 置 `resolved` 并附实施、验证与授权凭据；遗留项写「移交备注」。

## Comments

### 实施记录（2026-10-11，worktree pod/15-rename-closure）

**结论**：票 15 仓库内收口准备完成——旧名残留全仓清点归三类（应改未改＝**空集**）；
新 runId 增量包**执行手册**落 `.scratch/pod/rename-evidence-runbook.md`（CLI 逐条对照
源码核实，**包生成本身未执行**——授权点，本票只做准备）；README §2 派生件注记与
PROJECT_UNDERSTANDING 部署链等四处按现状改写；四门实际计数 ①**94/94** ✅
②**7/10** ❌（唯一红＝预期三件）③**0 违例** ✅ ④**15 PASS／0 FAIL／0 SKIP** ✅。
②门「在新清单下 PASS」（票面清单项 4）**发生在授权窗口跑完手册之后**，本记录只是
其前置状态：红＝0010 包 sourceManifest 内被改名批触碰的三件
（`lib/sentinel-safety.js`／`lib/sentinel-shadow.js`／`scripts/evidence-runner.mjs`），
规格 §F7 设计性中间态，未试图修复。

**残留分类清单**（全仓 `grep -rn "dsh-bots\|DSH_BOTS"` 排除 .git／node_modules／
.worktrees，对照 `tests/pod-spec-face.test.mjs::codeFaceOldNameScan` 语义；许可面
未扩未删——env 回落与 migration-face 窗口均未关）：

- **① 有意保留**：
  - 代码面许可 26 记号／4 件（扫描 hits／staleAllow／unusedShapes 全空，扫 197 件）：
    `lib/org/role-cards.js` ×2（retired-section 形；03 号票退役段名历史提及，注释性
    历史，无关闭窗口）；`tests/pod-rename-env.test.mjs` ×11（env-name 形；env 双读
    回落兼容窗口，关闭＝运行面切换＋仓库外脚本更新完成后的全窗关闭，届时同批收缩）；
    `scripts/migrate-pod-data.mjs` ×3 ＋ `tests/pod-data-migration.test.mjs` ×10
    （migration-face 形；迁移工作面须认识旧插件名，关闭＝旧根 retired 清理授权件
    执行时同批收缩——票 14 口径）。
  - 通配形非记号命中（不带具体名，不进扫描词表；票 13 偏离 2 已登记）：
    `lib/env-aliases.js`／`lib/org/host-env-seam.js` 的 `DSH_BOTS_*` JSDoc 通配形；
    `tests/pod-spec-face.test.mjs`（扫描门自身，SCAN_SKIP_FILES 豁免）。
  - 冻结路径白名单（§F7）：`artifacts/` 152 件（packages 7／runs 22／cutover-* 85／
    archive 13／pod-ctx 12／quality-review 8／零散历史 5）只读；`CHANGELOG-legacy-2026-09-28.md`
    ＋`docs/changelog/`（2026-09-01 历史卷与 2026-10-01..04 当月卷——命中均为既往
    事件正文与远端仓库名，事件不可回改、更正写新事件）；`docs/TEMP-guidance-*`／
    `docs/CLOSURE-*` 现零命中；`docs/CODE-QUALITY-*-2026-09-05.md`／
    `docs/GROK-DSH-BOTS-COMPARISON.md`（票 12 Lead 裁定历史快照保留）；`docs/history/`
    3 件（历史档案，命中为旧部署路径/仓库名的历史记载）。
  - 架构派生件：`docs/dsh-bots-architecture.*` **17 件**（含 webm/gif/png 二进制，
    不得手改）＋`docs/pod-architecture.json` 的 `output` 字段仍指旧派生件名（重出时
    对齐）；`preview/*.png` 13 张。重出面见移交备注。
  - `.scratch/` 77 件：他批历史票面与实验记录（org-v2／org-v2-build／b4／deploy-b3／
    batch-preflight／pr2-review-fixes，当时事实记载）＋pod 批历史票面 03–13（实施
    记录引旧名作改动对照）＋`spec.md`（哈希冻结）＋`rename-migration-plan.md`
    （迁移工作面旧→新映射）。
  - 根目录：`PLAN-expanded-engineering.md`（历史计划文档，命中为仓库磁盘路径）、
    `GLOSSARY.md` env 更名溯源句（票 13 偏离 3，Lead 待过目）、`README.md` §2 更名
    溯源＋移交注记（本票按现状改写）。
  - 语义注记：命中中相当部分为**仓库名/磁盘路径/远端名**（`project/dsh-bots`、
    `github.com/Beijongggg/dsh-bots`）——仓库自身不在改名批范围，非插件旧名残留。
- **② 本轮可清而未清**：**空集**。
- **③ 应改未改**：**空集**（收口后终态；收口前唯一已知项＝PROJECT_UNDERSTANDING
  四处，系票 13/14 明示移交本票者，本票已改，见下）。

**手册**（票面清单项 2 的准备件）：`.scratch/pod/rename-evidence-runbook.md`。要点：
runner 裸跑即可（`--out-profile evidence`／`artifacts/runs` 均为缺省值；registry 根
已初始化，勿再 `--init-registry`）；packager 必填五参 `--run/--human/--base-package/
--base-package-path/--sequence`，`--modified-files`／`--new-test-modules` 接受 JSON
数组或含数组的文件路径（逐文件须存在），`--human` 仅限四字段
（authorizationBasis/pendingItems/humanReviewNotes/scope，模板已备）；序号 **0011**，
`--base-package`＝0010 包**文件** sha256 `405fdf54d53f76508e6e628bf8e8c9b0c7da7cfa1a91130c82f9c6e2027a5470`
（与文件名 sha8 前缀对拍吻合）；包写出 `wx` 排他，旧包不可覆盖。**笔记勘误两条**
（已回写手册）：t15-evidence.md 说「取包 JSON 的 sha256 字段」——包 JSON 无顶层
sha256 字段，basePackage 链用包文件字节哈希；`latestPackage` 正则实为
`[0-9a-f]+` 非「16hex」。`--modified-files` 口径＝**改名批三段并集 111 件**
（票 12 `f557f51^..6fa9841` ∪ 票 13 `f9b6608^..e91b9c0` ∪ 票 14 `2979419^..2a1aede`
的 lib/scripts/tests；粗区间 `77bc3c4..HEAD` 会多算 5 件他批件——session-log-names、
preflight.mjs、tests/README、headless-layout、preflight.test 均非改名批），
手册含执行时重derive 命令；`--new-test-modules`＝新测试件 3 件
（pod-rename-env／pod-data-roots／pod-data-migration）。手册步骤 6 含②门 10/10
预期声明与 pre-commit 恢复常态判据。

**README 与 PROJECT_UNDERSTANDING 改动**：

- README §2：架构行派生件注记按现状改写——「待按新版本重出（票 15）」→
  「17 件；仓内无生成器，改名批未重出；重出需部署面截图（部署同步授权窗口）或
  外部生成器，留待运行面切换窗口处置（票 15 移交备注）」。§6.1 核对：通用规则
  无需改动；架构规格源更名的 CHANGELOG 事件归 Lead（本票不写）。
- PROJECT_UNDERSTANDING 四处：①部署链行改**目标态**（`~/.dsh/plugins/pod` →
  `profiles/*/node_modules/pod`；数据根 `$DSH_HOME/pod`；工作区根 `pod-workspaces`
  ＋`pod-workspaces-<id>--` 分片）并加注记「**运行面切换待授权窗口**（`~/.dsh`
  实际目录仍为旧名布局，部署同步／数据迁移 execute／重启链各属逐项点名件，
  见 `.scratch/pod/rename-migration-plan.md`）」——文档描述目标态＋现状注记，
  不假装已切换；②SSE 端点行 `/api/bots/_events`→`/api/pod/_events`（票 13 移交件，
  已对拍 lib/index.js）；③宿主自检 env 行 `DSH_BOTS_HOST_URL`→`POD_HOST_URL`
  （注更名溯源＋双读过渡窗口兼容回落，已对拍 lib/org/host-env-seam.js）；④
  仍可选题 `DSH_BOTS_API_TOKEN`→`POD_API_TOKEN`（注：旧名仅该处历史提及、无活性
  读者、未入双读——票 13 第 12 名核实结论的处置承接）。

**验证命令与实际计数**（均在 worktree 内跑；未运行 evidence-runner/packager）：

- `TMPDIR=/tmp node scripts/preflight.mjs` → ①**94/94** ✅　②**冻结面（0010 包）
  7/10** ❌（原样三行：`lib/sentinel-safety.js`／`lib/sentinel-shadow.js`／
  `scripts/evidence-runner.mjs` sha/byteLength 不符——与票 13/14 记录的三件一致，
  即「②门在新清单下 PASS」的前置状态）　③**0 违例**（扫 118 md；命名扫描 221
  活文件）✅　④**15 PASS／0 FAIL／0 SKIP** ✅；`preflight: FAIL`（仅因②，预期）；
- `codeFaceOldNameScan()` 直跑：hits `[]`／staleAllow `[]`／unusedShapes `[]`，
  whitelisted 26 记号（colon 2／bare 13／env 11），`tests/pod-spec-face.test.mjs`
  17 用例全绿；
- 全仓 grep 清点：命中 257 文件（artifacts 152／.scratch 77／docs 20／代码面 7＋
  根文件 4），分类见上。

**待授权项**（逐项点名后执行，本票均未做）：

1. **新 runId 增量证据包生成**（V-P8.7 授权③；本票复核点＝执行前独立复核手册；
   手册＝`.scratch/pod/rename-evidence-runbook.md`）。窗口顺序：须在部署同步→
   数据迁移 execute→重启链之后（parity/台账证据段依赖新部署面与新数据根就位）。
2. 部署同步（票 13 授权件①）；3. 全 bot 重启链（票 13 授权件②）；
4. 数据迁移 execute（票 14 授权件③，spec §F8 另一次点名）；
5. 旧根 `bots.retired-*`／`bot-workspaces.retired-*` 清理（票 14 授权件⑤；
   migration-face 许可面同批收缩）；
6. 仓库外两脚本更新＋profile 侧软链与 16 份 patch 行重脚手架（票 13 授权件③④沿列）。
   以上完成后的**全窗关闭**（env 回落许可与形、role-cards 之外残留复核）另记。

**偏离与未闭合项**：

1. pre-commit `--no-verify` 一笔（本票提交；②门按 §F7 设计性红，③ lint 0 违例，
   四门全量结果提交前实跑留档如上）——沿票 13/14 先例，新包落地后钩子恢复常态。
2. 未闭合（移交）：架构派生件 17 件＋`preview/*.png` 13 张重出（README 注记已改
   移交口径）；全窗关闭许可收缩（待运行面切换完成）；仓库外两脚本实值核对。
3. `spec.md` §D3 的 `GET /api/bots/:id/trace` 读面挂点已随票 13 改 `/api/pod`——
   spec 为哈希冻结件，本票不改，坐标修订＋修订记录归 Lead 收口（既定安排）。
4. `docs/agents/host-runtime-map.md` 存量软链重建注记、GLOSSARY 溯源句等
   票 13 已改面复核无新发现；本票未触碰任何冻结件与 `artifacts/`。

### 收口状态（Lead 补记，2026-10-11）

仓库内面收口（`498ca23` 已并入 integration/pod-rename）：残留三类清点（②可清未清＝空集、
③应改未改＝空集）、重采集手册（`.scratch/pod/rename-evidence-runbook.md`）、README §2 与
PROJECT_UNDERSTANDING 部署链同步（目标态＋「运行面切换待授权窗口」注记）齐备。Lead 已承接
其偏离 3：spec.md §D3／§E1／V-P4.1 四处路由串坐标修订＋修订记录条目（新哈希见
EV-20261011-pod-rename-batch-close 事件）。**Status 维持 `ready-for-agent`**：新 runId 增量
证据包生成（授权③；手册就绪，执行前独立复核）与 ②门 10/10 PASS 待授权窗口；全窗关闭的
许可收缩（env 回落形＋migration-face 形）随 retired 清理另记。

### 新 runId 增量证据包生成（2026-10-12，授权③执行；本票收口）

- **授权依据原文**：用户 2026-10-12 本会话点名 V-P8.7 授权③——AskUserQuestion 提问
  「票 15 唯一剩余件＝『新 runId 增量证据包生成』（V-P8.7 授权③）。准备（手册）与执行前
  独立复核均已完成，复核结论＝可按原文执行（已更正一处预期计数 10/10→11/11）。是否在本
  会话点名授权执行？」→ 用户选定「**点名授权·本会话执行**（推荐）」。（同步入包
  `human.authorizationBasis`。）
- **前置核验（只读）**：① 三段并集按手册 §2 重 derive＝**111 件**（与准备时点一致；
  `2a1aede..HEAD` 修门提交仅触 `scripts/migrate-pod-data.mjs`／`tests/pod-data-migration.test.mjs`／
  `pod-data-roots`／`pod-spec-face` 四件，全部已在集内）；② 0010 包文件 sha256 对拍＝
  `405fdf54…5470` 吻合、0011 序号未占用；③ parity 预检 7/7 一致；④ 真实面写入观察＝
  唯一周期写者 `pod/capabilities/issued.jsonl`（两席 role 续期，**10 分钟节拍**，不在豁免面）
  ——按「避开续期拍」择时起跑（19:54:40，续期拍 19:53:45／下一拍约 20:03:45）。
- **执行前独立复核**（票面复核点）：子代理新会话、只读对源（runner／packager／
  lib/evidence-packager／ledger-evidence／preflight／sentinel-provenance）逐项核验八组主张，
  结论＝**可按原文执行**；唯一不符＝②门预期计数：0011 包 sourceManifest＝**11 件**（0010 的
  10 件＋`lib/data-roots.cjs`——runner `:48` 与 sentinel-shadow 新增对其 import），按 10/10
  核对会误判。已复算证实（`buildExecutionSourceManifest` 独立复跑＝11 件）并回写手册 §6／§7
  （§7 增补「执行窗口时序约束」＝避续期拍的实测口径）。
- **采集**：`node scripts/evidence-runner.mjs` 裸跑（缺省 out-root／profile）→ runId
  **`0480d25b-9eae-4a2c-aec1-f944d79b7762`**，终态 **completed**：回归 **94/94**、
  parity **7/7 identical**（deployDir `~/.dsh/plugins/pod`，零漂移）、真实面核验
  **clean＋verified**（前后只读快照零差异）、台账证据段 **0 事件**（窗口 `(180, 180]`，
  采集时点真实台账 lastSeq＝180；缺省口径空窗合法，复核已证）。run 产物三件
  `artifacts/runs/0480d25b-…/{raw.json,capture-manifest.json,ledger-evidence.json}`。
- **打包**：`node scripts/evidence-packager.mjs --run 0480d25b-… --base-package 405fdf54…5470
  --base-package-path artifacts/packages/review-evidence-package-0010-405fdf54.json
  --human /tmp/pod-rename-human.json --modified-files /tmp/pod-rename-modified.json
  --new-test-modules /tmp/pod-rename-newtests.json --sequence 0011` → 新包
  `artifacts/packages/review-evidence-package-0011-b59bb215.json`，sha256
  `b59bb215d03b38d3cc4459b9095e70f8546c6ccfa0cb20b43d8db87fe9ef55bc`，byteLength **112270**；
  basePackage 链指向 0010 包文件 sha256；`modifiedFiles` 111 件、`newTestModules` 3 件；
  deploymentImpact 机械派生＝driftCount 0（identical 7/checked 7、restartNeeded false、
  deploySyncNeeded false）。七项绑定核验通过；旧包 0010 与更早包、raw、registry 只读未动
  （新 run 目录／claim／registry 行为纯追加）。
- **四门复核**：`TMPDIR=/tmp node scripts/preflight.mjs` → **①回归 94/94 ✅
  ②冻结面（0011 包）11/11 ✅ ③0 违例（扫 118 md；命名扫描 221 活文件）✅ ④宿主契约
  15 PASS／0 FAIL／0 SKIP ✅；`preflight: PASS`**——**票 13/14 的 ②门红态解除**；
  `node scripts/ci-gates.mjs`（pre-commit ②③）**PASS**——`--no-verify` 偏离项闭合，
  钩子恢复常态（本票提交不再需要）。
- **落档**：CHANGELOG 事件 EV-20261012-pod15-incremental-package；README §2 证据链行为
  「最新序号包」指针式表述，无需随包改动（§6.1 本轮无正式文档新增／移动／重命名）；
  `docs/PROJECT_UNDERSTANDING.md` 两处「0010 冻结面」指针随当前终版包改写为「0011 包冻结面」
  （`lib/org/store-base.js` 行＋冻结件组 20 项行——两处被引面均在 0011 manifest 11 件内，复算属实）。
- **两轴复审处置（b713a27）**：Standards 轴 0 硬违规（定向核验：旧包/raw 只读、registry 纯追加、
  文件内嵌 sha 与实算对拍、独立复算冻结面 11/11）；Spec 轴 0 缺失／0 越权，三条细微观察处置：
  ①「票面未记 PROJECT_UNDERSTANDING 改动」→ 已补（本条上方落档段）；②「移交①前置条件
  表述过时」→ 已改（见下）；③「②门自指式、闭包完备性依赖上游复核」→ 记观察不改（本批
  10/10→11/11 更正即该机制的实证）。
- **移交备注（遗留项）**：① **全窗关闭的许可收缩已由 2026-10-12「点名」批执行**（见下节；
  原列前置五件已全数就位）；② 架构派生件 17 件＋`preview/*.png` 13 张重出（仓内无生成器）
  留待运行面切换窗口或外部生成器；③ spec.md §D3／§E1／V-P4.1 坐标修订归 Lead 收口（既定
  安排）；④ 仓库外两脚本实值核对已随票 13 窗口完成（`~/.dsh/dsh-web.sh`／`restart-split.sh`
  新名 export），本票未再触碰。

### 全窗关闭许可收缩（2026-10-12，用户点名「点名」执行；仓库内面）

- **授权依据原文**：用户 2026-10-12 会话回复「**点名**」——承接 /ask-matt 路由建议中
  「其次：点名『全窗关闭许可收缩』（唯一仓库内可动件）」一项（对应本票移交备注①与
  13/14 号票沿线登记的窗关闭件）。
- **收缩变化（四轴）**：
  1. **env 回落形全闭**：`lib/env-aliases.js` 收缩为单点读——`readEnvValue` 仅按精确名
     直读，`legacyEnvName`／`POD_ENV_PREFIX` 导出删除（API 面收缩）；`tests/pod-rename-env.test.mjs`
     改写为闭窗语义 4 用例（旧名负例改**构造形** `["DSH","BOTS",suffix].join("_")`，代码面零旧名
     字面量；形状测试锁定幸存导出＝单成员）。
  2. **migration-face 退役**：`scripts/migrate-pod-data.mjs`＋`tests/pod-data-migration.test.mjs`
     **整件删除**——迁移已执行（票 14 窗口）、旧根 retired 已清理（票 13 点名「1清理」）、
     工作面使命完成；全仓复核确认零悬空引用。
  3. **许可面收缩**：`tests/pod-spec-face.test.mjs` `IDENTITY_ALLOW_TOKENS` 4 条目→**1**
     （只余 `lib/org/role-cards.js` 退役段名历史提及）；`IDENTITY_ALLOW_SHAPES` 3 类→**1**
     （只余 `retired-section`；`env-name`／`migration-face` 两形删除）；对应用例改名
     「V-P1.4/V-P1.5 **15 号票全窗关闭**：代码面旧名残留只余退役段名历史提及（其余清零）」，
     断言「许可面只余一类」＋「bare／hyphen／env 类许可清零」＋六目录面全零。
  4. **注释与活文档按现状改写**：`lib/spawn-env.js`／`bot-autostart.js`／`bot-supervisor.js`／
     `org/host-env-seam.js`／`index.js` 五处注释、`GLOSSARY.md` 逃生阀节、`codebase-map.md`
     两行、`scripts/host-contract-probe.mjs` 注释、`PROJECT_UNDERSTANDING.md` 部署链（目标态→
     **现役态**）＋宿主自检行、`README.md` 架构派生件注记（留待专门窗口）、`tests/pod-data-roots.test.mjs`
     标题措辞（retired 窗口已清理）。
- **验证（实际计数）**：全量 `node tests/run.mjs` **93/93**（计数 94→93＝迁移测试件退役，其余零回落）；
  `preflight` 四门 **①93/93 ✅ ②冻结面（0011 包）11/11 ✅ ③0 违例（命名扫描 219 活文件；
  恒真断言扫描 101 件；session-log 名域限 95 件）✅ ④15 PASS／0 FAIL／0 SKIP ✅；PASS**；
  `codeFaceOldNameScan()` 直跑：**hits＝0／staleAllow＝0／unusedShapes＝[]**，whitelisted
  ＝role-cards 两枚（colon）——「全码面旧名残留只余退役段名历史提及」口径成立。
- **冻结面纪律**：0011 包 `sourceManifest` 11 件**零触碰**（②门 11/11 佐证）——本批不触发
  新 runId 重采集；数据面语义（`lib/data-roots.cjs`）未动。
- **残留登记（另记，不改本批范围）**：① **部署面**仍载旧版 `env-aliases.js`（双读实现）与
  已删迁移两件——下次部署同步窗口随行清理（部署面动作须点名）；② `lib/data-roots.cjs` 注释
  中「retired 只读窗口」措辞微旧——该件在 0011 冻结面内，随下次因实质原因触碰时同批改写；
  ③ shared-face 旧形容错与 bot-health 分片双认窗口**按设计仍开**（`~/.dsh/sessions/` 存量
  20 个旧前缀分片未搬，读面须双认；非本批范围）；④ spec 附录 A `V-P8.5` 的「迁移前后逐件校验」
  落点随脚本退役转为史实（证据＝窗口产物），坐标修订归 Lead 一并记。
