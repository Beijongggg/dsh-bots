# 14: 改名·数据面迁移

**What to build:** 把运行面数据路径族改到新名，并搬走存量数据——**方案先冻结、再执行**。

**Blocked by:** 13

**Status:** ready-for-agent

**复核点:** 命中必审清单（不可逆写入真实运行面，涉及存量数据）→ 方案与执行各独立复核一次。

- [ ] 迁移方案先定稿并经用户过目：范围（注册表、信箱、知识库、台账、能力/nonce、workspace、
      session 分片、备份目录）、搬迁步骤、**双读过渡**、回退面、授权点；
- [ ] 明确并处置两个已知风险：① 注册表为空会触发 bootstrap 锚点自动重建——不得以「先清空
      再重建」充当迁移；② session 分片目录名由工作区路径派生，改工作区根名会使旧分片失配，
      须迁移或显式兼容；
- [ ] 迁移前后逐件校验：席位表、台账事件序列、信箱与回滚点数量，留证据；
- [ ] 旧路径保留只读一个窗口，确认无读者后再清理（清理另点名）；
- [ ] 不演练回滚，但写明回滚判据与执行人。

## Comments

### 实施记录（2026-10-11，worktree pod/14-rename-data-plane-migration）

**结论**：票 14 仓库内实现面完成——方案文档 `.scratch/pod/rename-migration-plan.md`
（**冻结候选，待用户过目**；选型＝停机搬迁，双读被否）；数据面路径族经
`lib/data-roots.cjs` 单源两提交收敛并切名（先收敛保持旧名全绿、再翻常量）；
迁移脚本 `scripts/migrate-pod-data.mjs`（dry-run 缺省零写入／--execute 显式门／
--profiles／--verify-only）10 用例全绿。实施提交三个：`2979419`（收敛重构，
93/93）／`663fa03`（切名＋脚本＋测试＋地图，94/94）／本提交（方案文档＋票面记录）。
回归 **94/94**；③门 **0 违例**；②门 **3 红预期中间态**（0010 包内：sentinel-safety＋
evidence-runner 沿票 13 携带红，sentinel-shadow 本票触达；F7 设计性红，新 runId 包归票 15）。
**运行面执行不在本票**：部署同步／重启链／迁移 execute／新 runId 包四件待授权（下）。

**机械把守**：

- 许可面增第三类 **`migration-face`**（跨文件形＋文件级许可双登记：
  `scripts/migrate-pod-data.mjs`／`tests/pod-data-migration.test.mjs`；V-P1.4 新增
  落点反向锁——bare 形记号只许落这两件）。事由：存量 patch 的 `name:` 行与
  profile `node_modules` 旧名软链是**数据**，迁移脚本必须认识旧插件名才能改写它
  （票 13 env 前缀「不带尾段不入记号」的写法在此不可复用——链接名本身就是要改的
  全串）。收缩：与旧根 retired 清理窗口关闭，票 15 同批。
- `knowledge-shared-face`／`mail-shared-face` 触达正则认新形状
  （`join(home, "pod", "knowledge"|"inbox"|"outbox")`），旧形兼容窗口内保留。
- 闭包基线同步：evidence-runner 执行闭包 8→9／runner∪packager 10→11
  （ledger 事件坐标收敛 `lib/data-roots.cjs` 进闭包）；org-task-projection
  投影闭包＋data-roots（capability-base 实例登记坐标收敛）。
- shadow 布局 manifest 镜像路径随单源（`dsh-home/bots`→`dsh-home/pod`；digest
  对拍测试无钉死值）。

**改动面**（按票面交付清单，符号为锚）：

| 交付 | 落点 |
|---|---|
| ① 方案文档 | `.scratch/pod/rename-migration-plan.md`：范围表 14 面（旧→新→方式→校验口径）、两风险处置、收口窗口步骤（四件授权逐项标注）、双读被否理由（笔记 §6 四面不可双读）、只读窗口与清理、回退面（判据＝就绪核验红或席位表 sha 不符；执行人＝授权窗口内实施会话；不演练）、授权点清单 |
| ② roots 单源（两提交） | 新件 `lib/data-roots.cjs`（名常量＋15 路径函数＋`WORKSPACE_SHARD_MARKERS`＋`LEGACY_*`）。委托面：`lib/index.js`（本地 registryPath/workspaceDirFor/profileDirFor 删除；settings 三处、started 写点、session-backups 归档点）、`lib/mail-plane.js`（inboxDirFor/outboxDirFor）、`lib/knowledge.js`（knowledgeDir）、`lib/org/task-ledger.js`（ledgerDir）、`lib/org/capability-issue.js`（capabilityDir）、`lib/org/capability-base.js`（instanceRegistryFile）、`lib/org/permissions.js`（botWorkspaceDir）、`lib/org/cutover.js`（注册表读）、`lib/shared.cjs`（profiles settings 两处）、`scripts/create-bot.cjs`（缺省 workspace）、`scripts/bot-health.cjs`（registry/inbox/outbox/profile/workspace/session-backups 全收敛＋分片双认）、`scripts/evidence-runner.mjs`（台账坐标）、`lib/sentinel-shadow.js`（shadowTargetsOf）、`lib/org/review-artifacts.js`（期望坐标改由 reportsDirFor 派生，字面数组消灭）、`lib/org/durability.js`（eval 样本模板根名常量化） |
| ③ 迁移脚本 | `scripts/migrate-pod-data.mjs`：`--dsh-home`（缺省 readEnvValue 读 DSH_HOME 回落 ~/.dsh）；步骤＝前置校验（旧布局在位＋旧注册表为对象表＋新根不在位——二次 execute 幂等拒绝）→ 在跑检测（旧根 instances.jsonl 全部行＋注册表 pid 字段，kill(pid,0) 探测、EPERM 视同存活，host 行含内）→ fs.cpSync recursive（不用硬链）→ 逐件 sha/byteLength/mode/linkTarget 两树对账＋八面计数前后等值 → --profiles（patch name/workspaceRoot 重写＋node_modules 旧名软链 lstat 判存保目标改名，幂等）→ 旧根改名 `*.retired-<ts>`（半 retire 防护：失败回滚已改名件）。失败中止＝新根整树清理、旧根原样、exit 1；报告 JSON 0600 |
| ④ 校验器 | `snapshotFaces`／`compareFaces`／`verifyCopiedTree` 导出纯函数＋`--verify-only` 模式（新根优先基面；前后各跑一次对比）——席位表 sha/条目/逐 id、台账 events/lastSeq、inbox/outbox 文件数/行数、knowledge index 行/reports 数、capabilities/nonce 计数、started 行数、workspaces 目录/文件数；backups（回滚点）与 sessions/session-backups 记录不对账（不搬面） |
| ⑤ bot-health 分片匹配 | `findScopeDirs` 经 `WORKSPACE_SHARD_MARKERS` 双认（`pod-workspaces-<id>--` 现役 ∪ `bot-workspaces-<id>--` retired 窗口兼容）——风险②显式兼容；stats/findSessionDirFor 既有兜底扫描保留 |
| ⑥ 测试 | 新 `tests/pod-data-roots.test.mjs`（8 例：名常量钉根＋七面单源等值＋锚点 workspace 落点＋分片标记）＋`tests/pod-data-migration.test.mjs`（10 例：dry-run 零写入整树快照、execute 全流程逐件绿＋retired 存在、--profiles 幂等、二次 execute 拒绝、在跑 pid 拒、前置校验拒、失败中止清理、verify-only、verifyCopiedTree 抓篡改/缺件、rewritePatchText 幂等）；既有硬编码夹具同步 **27 件**（grep 清点逐件改；events.test 的 SSE 频道名 `"bots"` 与 sentinel 探针夹具 `other-bot-workspaces` 非数据路径，保留） |
| ⑦ 地图 | `docs/agents/codebase-map.md` lib 根表新增 `data-roots.cjs` 行 |

**验证命令与实际计数**（均在 worktree 内跑）：

- `TMPDIR=/tmp node tests/run.mjs` → **94/94**（基线 92＋新增 roots/migration 两件）；
- `node scripts/ci-gates.mjs` → ① 94/94 ✅　② **7/10**（0010 包三件 sha 不符：
  sentinel-safety＋evidence-runner 沿票 13，sentinel-shadow 本票触达；F7 预期中间态）
  ③ **0 违例**（扫 116 md；命名扫描 221 活文件）✅；
- `node --test tests/pod-data-migration.test.mjs` → 10/10（含零写入整树快照与
  失败中止清理断言；夹具全为临时目录——**真实运行面零读零写**，本票红线）；
- 红绿序留痕：roots 测试先红（模块不存在）后绿；切名批 roots 名钉先翻红
  （4 fail）再翻常量绿；迁移测试先红（脚本缺失 10 fail）后绿。

**待用户过目项**：

1. 方案文档 `.scratch/pod/rename-migration-plan.md`（冻结候选）：选型（停机搬迁、
   双读否决）、新根名（`pod`／`pod-workspaces`——未决 5 推荐项）、旧路径只读窗口、
   回退面与判据、授权点清单。过目通过后即为窗口内执行依据。
2. 两处实施裁量（Lead 请过目）：① 许可面 `migration-face` 第三类（上）；②
   evidence-runner `PROTECTED_SNAPSHOT_EXCLUSIONS` 四条 `bots/review` 豁免正则改
   `(?:bots|pod)` 双形（窗口内新旧根都认；v1 评审 store 遗留面，lib 无写点）。

**待授权项**（逐项点名后执行，本票均未做；手册＝方案文档 §5）：

1. 部署同步（票 13 授权件①；`scripts/deploy-sync.mjs`，备份落 `backups/pod`）；
2. 全 bot 重启链（票 13 授权件②；手册步骤 1 停／4 起——**新代码首次启动必须在
   数据就位之后**，风险①）；
3. **数据迁移 execute**（spec §F8 第四件点名；手册步骤 0/3：
   `node scripts/migrate-pod-data.mjs --dsh-home ~/.dsh --execute --profiles --report <path>`；
   --profiles 面由票 13 授权件覆盖）；
4. 新 runId 增量证据包（票 15）；
5. 旧根 `bots.retired-*`／`bot-workspaces.retired-*` 清理（确认无读者后另点名；
   不在本脚本面）。

**偏离与未闭合项**：

1. pre-commit `--no-verify` 三笔（②门按 F7 设计性红；③ lint 三笔均 0 违例，
   四门全量结果提交前实跑留档）——沿票 13 先例，票 15 出新包后复核钩子恢复常态。
2. 过程偏离：方案文档初稿曾误写主工作树 `.scratch/pod/`（未跟踪新文件，零写入
   任何已跟踪面）；发现后即移入 worktree、主树还原（主树既有 `IN-FLIGHT.md` 改动与
   `.video_agent/` 非本票所留，未触碰）。
3. 未闭合（沿票 12/13 移交＋本票新登记）：仓库外两脚本、新 runId 包、全窗关闭
   （env 回落许可与形、migration-face 形与两件登记）——均归票 15；
   session 分片不搬（宿主官方面）＝风险②按「兜底扫描＋bot-health 双认」显式兼容，
   其跨根等效性按票面验收项在执行窗口以 --verify-only 前后对比留证。

### 评审返修补记（F2/F3，2026-10-11，worktree pod-review-fix）

- F2（Standards 轴）：迁移脚本 docstring「retire 前任何一步失败……不留半迁移态」过宽
  （--profiles 段的 patch 重写＋软链改名不在 `cleanupNewRoots` 清理面）→「不留半迁移态」
  限定**数据根搬迁段**（前置校验／拷贝／复验／retire）；--profiles 段失败语义单列＝
  **幂等可续跑**（不自动回滚已重写 patch——旧布局仍现役可继续服务，重跑
  `--execute --profiles` 续完未竟改动）；方案文档 §5 脚本契约节同步补一句注记
  （判据语义未动，只补失败语义注记）。
- F3（Standards 轴）：`tests/pod-data-roots.test.mjs` 单源锁只有等值断言、抓不到各面
  重新内联 join 字面量 → 增**窄口径机械门**（lib/ 除 `data-roots.cjs`：工作区根名
  引号贴名字面量＋数据根 join 第二参段位，扫前剥注释）；全 lib 74 件先校准**零命中**
  再钉死（哨兵 `other-bot-workspaces`、`plugins/pod` 部署段、shared-face 自证注释均不
  误伤；合成违例自测可捕），无豁免条目。
- 验证：全量 94/94 绿；preflight ①94/94 ✅、③0 违例 ✅、④15 PASS ✅、②7/10 预期红
  （仅既有 3 件，返修零新增）；pre-commit 以 `--no-verify` 通过（②按 F7 设计性红；
  ③ lint 0 违例）（EV-20261011-pod-rename-review-rework）。

### 收口状态（Lead 补记，2026-10-11）

仓库内面收口：三笔（`2979419`／`663fa03`／`2a1aede`）＋评审返修 F2/F3（`cc2820a`）已并入
integration/pod-rename。方案文档 `.scratch/pod/rename-migration-plan.md` 为**冻结候选，待用户
过目**（通过后即为窗口执行依据；停机搬迁／新根名 `pod`＋`pod-workspaces`／sessions 不走搬迁
三项均为 Lead 裁定推荐，用户可逐项否决）。**Status 维持 `ready-for-agent`**：数据迁移
execute、旧根 `*.retired-*` 清理（另点名）待授权；窗口手册见方案文档 §5（停 bot → 部署同步 →
迁移 → 起链 → 就绪核验，四件授权逐步标注）。

### 修门与授权留档（2026-10-12，票 13 窗口续会话）

- **方案过目＋迁移授权（用户原文）**：「继续2 3 4」→ AskUserQuestion 选定「授权 execute＋
  方案三项按推荐（停机搬迁／新根名 `pod`＋`pod-workspaces`／sessions 不搬）」——方案文档
  `.scratch/pod/rename-migration-plan.md`（冻结候选）据此**过目通过**，为窗口执行依据；
  **数据迁移 execute（F8 点名）已授权、未执行**（同轮裁定「暂不跑窗口」）。勾选框按仓库
  惯例收口时才勾，维持未勾。
- **修门（TDD；本票脚本面，阻塞票 13 窗口）**：`scripts/migrate-pod-data.mjs`
  `findLiveInstancePids` 口径「instances.jsonl **全部行**」→「**每 botId 最新行**」。
  事由（失败门名＋观测值＋证据指针）：真实运行面 271 行历史里 pid **940**（`cupsd`）／
  **968**（`cups-browsed`）／**987**（`snapfuse`）被系统进程复用（`ps -o pid,args` 实证），
  链停净后逐行探测仍判「在跑」而拒迁（`[migrate] 拒绝：检测到在跑进程 pid=…`）——pid 复用
  假阳性；口径与 capability 面「实例注册表最新行 pid」（`lib/org/capability-issue.js`）一致。
- **红→绿留痕**：`tests/pod-data-migration.test.mjs` 新用例先红（`not ok 7`，拒因原文
  `pid=26996（botId=host，来源 instances.jsonl）`），修后该件 **12/12**；反例用例锁
  「最新行活 pid（同 botId）仍拒」，防口径过宽放行真在跑实例。
- **真实数据只读复算**：`findLiveInstancePids("~/.dsh")` → 候选中存活项＝
  `host 2295`／`duty-coordinator 2327`／`implementer 2351`（＋注册表重复两行），
  cups*／snapfuse 假阳性 **0**。
- **方案文档同步**：§5 前置校验 3 改新口径＋修门注记（含事由与反例锁坐标），保证窗口
  执行方不按旧口径误解。
- **验证**：`TMPDIR=/dev/shm node --test tests/pod-data-migration.test.mjs` **12/12**；
  `TMPDIR=/dev/shm node tests/run.mjs` **94/94**；`node scripts/ci-gates.mjs` ③ **0 违例** ✅
  （② 7/10 既有预期红，归票 15 新序号包）。
- **窗口未执行项**（待点名）：停链（含 host）→`--execute --profiles`→起链→就绪核验；
  停链会终止实施会话所在宿主进程（host pid 2295），故先落档后执行。

#### 证据块（原始观测，2026-10-12 17:38–17:5x 实测）

修门事由的**可复核原始件**（评审返修：原记录只有叙述复述，指针自指；本块为持久证据）：

```
# 1) 复用者真身（kill(pid,0) 报活的三个历史 pid 现被谁占用）
$ for p in 940 968 987; do printf 'pid %s: ' "$p"; tr '\0' ' ' < /proc/$p/cmdline; echo; done
pid 940: cupsd -f -s /var/snap/cups/common/etc/cups/cups-files.conf -c /var/snap/cups/common/etc/cups/cupsd.conf
pid 968: cups-browsed -c /var/snap/cups/common/etc/cups/cups-browsed.conf
pid 987: snapfuse /var/lib/snapd/snaps/cups_1262.snap /snap/cups/1262 -o ro,nodev,allow_other,suid

# 2) 这三 pid 的出处＝旧根实例登记的历史行（文件共 271 行；行号可 grep 复算）
$ grep -nE '"pid":(940|968|987),' ~/.dsh/bots/started/instances.jsonl
105:{"botId":"host","pid":940,"startedAt":"2026-09-07T03:22:07.287Z",...}
106:{"botId":"lead","pid":968,"startedAt":"2026-09-07T03:22:09.578Z",...}
115:{"botId":"host","pid":987,"startedAt":"2026-09-07T08:10:57.450Z",...}

# 3) 旧口径红态（TDD 先红时脚本自陈的拒因，pid 为测试夹具活 pid）
[migrate] 拒绝：检测到在跑进程 pid=26996（botId=host，来源 instances.jsonl）——先执行停机窗口（方案 §5）

# 4) 修后真实数据只读复算（本仓 cwd 下）
$ node --input-type=module -e 'import { findLiveInstancePids } from "./scripts/migrate-pod-data.mjs"; console.log(findLiveInstancePids("/home/beijong/.dsh"))'
→ 5 项：host 2295／duty-coordinator 2327／implementer 2351（instances.jsonl 最新行）
        ＋ duty-coordinator 2327／implementer 2351（registry pid 字段）；cups*／snapfuse 假阳性 0
```

上述 1) 的观测是**时点性**的（pid 复用者随 snap 生命周期变化；940 曾一度消失），故此处
存原始输出为持久件；2) 的历史行在窗口迁移后随旧根 retired 仍可读（只读窗口保留）。
证据指针：本文件本节（含原始输出）＋修门实现提交 `edef328`＋`lib/org/capability-base.js:275`
（capability 面最新行口径对照件）。

- **放宽取舍（显式记录）**：新口径为**有限 fail-open**——当某 bot 最新行 pid 已死、更早行
  pid 仍活时放行（新用例 1 即此形）。理由：同 bot 的历史行 pid 只可能因**复用**而报活，
  该 bot 的现役实例只可能是最新行；capability 面另有代际＋nonce 兜底，迁移面没有，故以
  「同 bot 只认最新行」为唯一依据属有意取舍，非疏漏。反例用例锁反向（最新行活必拒）。
- **留界（不追改）**：①「每 botId 最新行」读法现为**第三份同形实现**
  （`lib/sentinel-runner.js:177`、`lib/org/capability-base.js:278`、本脚本）：若出现第四份
  或该读法需改口径，按 `lib/data-roots.cjs` 单源先例收敛（不在本批做，避免跨 lib/scripts
  收敛面在窗口前扩大）。②`tests/pod-data-migration.test.mjs` 自带本地 `deadPid()`
  （`tests/helpers/dead-pid-fixture.mjs` 有同名助手，违 tests/README.md「夹具复用」）——
  **前位提交遗产，本 diff 未加剧**，不追改。

### 共享锚链接修门 d（2026-10-12，/implement 13 后续会话）

**窗口前阻塞面**：修门 A（`8d0911c`）把软链处置落在 `<id>/node_modules/dsh-bots` 单形
枚举，而真实运行面的两处手工软链是——

1. `~/.dsh/profiles/node_modules/dsh-bots`（**根级共享锚**）；
2. `~/.dsh/profiles/web/node_modules/dsh-bots`（profile 自有）。

根级 `node_modules` 被枚举循环 `continue` 跳过（`entry.name === "node_modules"`）。
bot profile 目录（`duty-coordinator`／`implementer`）**无自有 `node_modules`**：宿主按
patch 行 `name` 自 profile 目录逐级上溯解析，**根级链接即各 bot 的解析落点**——漏改则
重启后各席位 `pod` 解析失败、插件缺席（邮件／组织面全休眠）；且 §5 步骤 5 就绪核验
（roster／deployment／coordinates／runtime）不查解析锚，属**静默失败面**，故按窗口前
阻塞件处置（TDD）。

**实测（隔离夹具，`~/.dsh` 零写）**：`createRequire(<tmp>/profiles/duty-coordinator/index.js)`
→ `resolve('dsh-bots/package.json')` 命中 `<tmp>/profiles/node_modules/dsh-bots`；
同名 `resolve('pod/package.json')` → `MODULE_NOT_FOUND`。

**处置**：`scripts/migrate-pod-data.mjs` 链接处置抽为
`relinkLegacyPluginLink(nmDir, { label, deployTarget, dryRun })`；per-profile 链接与
根级共享锚**同口径**调用（改名＋重指 `<dshHome>/plugins/pod`；非软链旧名项 fail closed
不动）。测试夹具增根级链接；`--profiles` 用例增三条断言（共享锚在位／重指部署目录／
旧名移除）；边界用例增共享锚非软链 fail-closed 断言（修前该形必红——根级链接零动作）。

**真实运行面只读复算**（`node scripts/migrate-pod-data.mjs --dsh-home ~/.dsh --profiles`，
dry-run 零写入）：链接动作现为两条（此前仅 web 一条）＋18 份 patch 重写，逐条原文：

```
- web | node_modules/dsh-bots → pod | ['软链改名保形（dsh-bots → pod）', '重指部署目录（/home/beijong/.dsh/plugins/dsh-bots → /home/beijong/.dsh/plugins/pod）'] | wrote False
- profiles/node_modules（共享锚） | node_modules/dsh-bots → pod | ['软链改名保形（dsh-bots → pod）', '重指部署目录（/home/beijong/.dsh/plugins/dsh-bots → /home/beijong/.dsh/plugins/pod）'] | wrote False
```

**验证**：`TMPDIR=/dev/shm node --test tests/pod-data-migration.test.mjs` **13/13**；
全量回归与 ③ 门见本批提交（EV-20261012-pod14-window-fixgate-d）。**与并行会话**：本修门
（票 13「13 后续」会话）与票 14 窗口会话（修门 A/B）同工作树并行；A/B 语义未动，仅补
未覆盖的第二个链接位置，窗口执行口径以本节为准。
