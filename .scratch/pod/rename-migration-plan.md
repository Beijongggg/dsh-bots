# Pod 改名·数据面迁移方案（票 14 冻结候选）

状态：**冻结候选，待用户过目**（spec §G 未决 5：「票 14 先冻结方案并经用户过目」；
过目通过后本件即为窗口内执行依据，执行另须 F8 数据迁移点名）。
选型框架三项（停机搬迁／新根名／只读窗口）为 **Lead 裁定**（2026-10-11 票 14 开工指令），
本文档把裁定落成可执行口径；**用户过目可整体或逐项否决**。
规格锚：§F2 C 组、§F6（两风险＋存量体量）、§F8（授权点）、§F9（回退面）、
§G 未决 5、附录 A V-P8.5／V-P8.7。

---

## 1. 选型：停机搬迁（stop → migrate → start），不走双读

**Lead 裁定＋本文据理展开；用户过目待定。**

双读过渡（新根优先、旧根回落）在数据面**只造两套真相**，且以下三面本质不可双读
（探索笔记 t14-dataplane §6）：

1. **session 分片目录名**由官方宿主按 bot 子进程 cwd 派生（`-` + cwd 全 `/` 换 `-` + `-`），
   本仓代码不控制其命名——双读下新旧分片并存，读面只能靠全目录兜底扫描；
2. **bot 子进程 cwd** 是 spawn 单值，不存在「新旧并读」；
3. **`bots.json` 注册表**双读＝双注册表漂移（端口分配、席位增删各写一面），
   必须原子切换。

补第 4 面：**profile patch 内嵌 `workspaceRoot:`** 是存量数据值（绝对路径写死在
16 份 yml 里），不是代码缝，双读无法表达。

双读唯一收益是不停机；本系统为单人本地仓，bot 链停一个收口窗口无可用性代价。
故选**停机搬迁**：注册表整表字节级搬运＋校验，其余面整树搬迁，旧路径改名只读保留。

## 2. 新根名（Lead 裁定，未决 5 推荐项；用户过目待定）

| 面 | 旧 | 新 | 备注 |
|---|---|---|---|
| 数据根 | `$DSH_HOME/bots/` | `$DSH_HOME/pod/` | 与身份段单数小写 `pod` 一致 |
| 工作区根 | `$DSH_HOME/bot-workspaces/` | `$DSH_HOME/pod-workspaces/` | **未决 5 的推荐项**（与 `plugins/pod`＋`pod` 身份段同形；用户可否决） |
| 备份父目录 | `backups/dsh-bots/`（既有 13 批） | **新批写 `backups/pod/`** | 既有 `backups/dsh-bots/` **不动**——历史回滚证据，角色冻结 |
| session 分片 | `$DSH_HOME/sessions/` | **完全不碰** | 宿主官方面；失配处置见 §4 风险② |
| profile 家族根 | `$DSH_HOME/profiles/<botId>/` | 根名不变 | 与宿主共享（host web profile 同住）；只动 profile **内容**（patch 行＋node_modules 链接，见 §5 --profiles） |
| 损坏会话归档 | `$DSH_HOME/session-backups/` | 根名不变 | 名内无旧身份记号，归档面静止 |

代码内收敛：新建 `lib/data-roots.cjs` 单源模块（`lib/session-log-names.cjs` 先例：
ESM/CJS 共用 .cjs 底座），笔记 §1 表各路径定义函数的 join 字面量全部改经该模块；
文件名旧新根名只活在单源件。分两提交：先收敛（保持旧名、全绿），再切名。

## 3. 迁移范围表（逐面：旧→新→方式→校验口径）

存量体量基线（规格 §F6 转写 L3184，窗口内执行时以 --report 实测为准）：
注册表 2 席、inbox 297 文件、outbox 142、ledger 180 行、capabilities 86、
started 261 行、bot-workspaces 13 目录 644MB、profiles 19、sessions 47、backups 13 批。

| # | 面 | 旧路径 | 新路径 | 搬迁方式 | 校验口径 |
|---|---|---|---|---|---|
| 1 | 注册表 | `bots/bots.json`（＋`bots.json.corrupt-*` 移开件随树） | `pod/bots.json` | 整树字节级拷贝（**fs.cp recursive**，不用硬链——jsonl 追加写会穿透硬链）＋sha256 逐件复验；**拷贝复验绿后**按 #8b 重写路径字段（键集与新旧同值判定以重写后为准） | 拷贝相位 sha 相等＋条目数相等＋逐 id 键集相等；重写相位逐字段断言指新根、非路径字段原样 |
| 2 | 收件箱 | `bots/inbox/<id>/`（messages.jsonl＋.seq.lock＋receipts/） | `pod/inbox/<id>/` | 同上 | 逐文件 sha 相等＋文件数相等 |
| 3 | 发件箱 | `bots/outbox/<id>/<ts>.jsonl` | `pod/outbox/<id>/` | 同上 | 同上 |
| 4 | 知识库 | `bots/knowledge/`（index.jsonl＋reports/＋REPORT_TEMPLATE.md） | `pod/knowledge/` | 同上 | index 行数＋reports 文件数＋逐件 sha |
| 5 | 台账 | `bots/ledger/`（events.jsonl＋epoch.json＋lock/＋audit.jsonl 等） | `pod/ledger/` | 同上 | events lastSeq＋事件数相等（逐行 sha） |
| 6 | 能力/nonce | `bots/capabilities/`（＋`nonces/` 单次消费文件） | `pod/capabilities/` | 同上 | 文件计数（secret／issued.jsonl／nonces）＋sha |
| 7 | 实例登记 | `bots/started/instances.jsonl` | `pod/started/instances.jsonl` | 同上 | 行数相等＋逐行 sha |
| 8 | 工作区 | `bot-workspaces/<botId>/`（13 目录 644MB） | `pod-workspaces/<botId>/` | 同上（整树含 `.dsh-bot-session.json`／`.dsh-bot-heal.json`／eval 件） | 目录数＋逐文件 sha/byteLength |
| 8b | 注册表路径字段 | `bots/bots.json` 各席 `workspace`／`workspaceRoot` 指旧工作区根 | 同表字段重写指 `pod-workspaces` | **execute 步骤 ②′**（拷贝复验后、retire 前）：`bot.workspace` 被宿主序列化输出（`serializeBot`）与权限判定（`isBotWritablePath`）消费——整表搬运保留的存量值不重写则重启后仍指已迁走的旧根；厂外自定义 workspace 不误改 | 重写后逐字段断言指新根、非路径字段原样；报告 `registryRewrite.changes` 列清单 |
| 9 | profile patch | `profiles/<id>/cordis.patch.yml`（`name: 'dsh-bots'` 行＋`workspaceRoot:` 旧绝对路径） | 同路径内容重写 | **`--profiles` 步骤**（非拷贝）：patch 行 name→`pod`、workspaceRoot→`pod-workspaces` 新路径 | 重写后逐份断言无 `dsh-bots` 名行、workspaceRoot 指新根 |
| 10 | profile 链接 | `profiles/<id>/node_modules/dsh-bots`（2 处手工软链） | `profiles/<id>/node_modules/pod` | 链接改名＋**重指部署目录**（`→ <dshHome>/plugins/pod`）：存量链接目标是旧部署目录 `plugins/dsh-bots`——保目标改名会让 patch 行 `name: 'pod'` 解析到旧代码（四同名绑定：patch name＝条目名＝package.json.name）。部署同步为窗口内先行步，目标可暂缺（lstat 判存不跟随悬空链） | 链接存在且 target＝`<dshHome>/plugins/pod` |
| 11 | session 分片 | `sessions/<shard>/<sessionId>/` | **不动** | 旧分片静止只读；新分片由重启后的宿主按新 cwd 自建 | 失配处置＝既有兜底扫描＋bot-health 双认（§4 风险②） |
| 12 | 部署备份 | `backups/dsh-bots/<runId>-backup-<sha8>/` ×13 | **不动** | 历史回滚证据，角色冻结 | 只读计数（迁移报告记数） |
| 13 | 新批备份 | — | `backups/pod/` | 票 13 部署同步面（`deploy-sync.mjs` 已改写 `backups/pod`） | 票 13 面自校验 |
| 14 | 部署目录 | — | `plugins/pod` | 票 13 授权件（`deploy-sync.mjs`） | 票 13 面自校验＋org-cutover-check deployment 路 |

## 4. 两个已知风险的处置（V-P8.5）

### 风险①：注册表空表触发 bootstrap 锚点自动重建

机理（`lib/index.js::bootstrapRegistry`）：新代码首次启动读注册表，文件不存在／空表
→ 自动写锚点席位（id=`duty-coordinator`，port=3101），自建席位全丢；损坏表移开为
`bots.json.corrupt-<ts>` 后按空表处理，同样重建。**「先清空再重建」不是迁移。**

处置（三条缺一不可）：
1. **整表搬 `bots.json` 本体**——字节级 copy＋sha 复验（§3 面 #1），不清空、不重建；
   路径字段重写（#8b／②′）为**定点字符串替换**（只换目标路径串，格式与其余字段
   字节原样），不做全表反序列化重落盘的有损路径；
2. **运行手册排序**：「新代码首次启动」排在「数据就位」**之后**——停机窗口内
   旧代码先停，数据搬迁＋校验全绿后才允许新代码起链；
3. **半迁移态禁止**：脚本步骤幂等＋前置校验失败即拒（§6 失败中止语义）——
   任何一步失败不落新根、不改旧根。

### 风险②：session 分片目录名由工作区路径派生，改工作区根名失配

分片名 = `-` + workspace 全 `/` 换 `-` + `-`，旧 cwd `/…/.dsh/bot-workspaces/<id>`
→ 分片 `--home-…-bot-workspaces-<id>--`；改 `pod-workspaces` 后主派生路径必失配。
**显式兼容处置**（不搬分片——宿主官方面，本仓不控制其命名；旧分片静止只读）：

1. **既有兜底扫描保留**：`lib/stats.js::findSessionLogFile` 与
   `lib/index.js::findSessionDirFor` 本就对 sessions 根全目录按 sessionId 扫描
   （分片名失配时退化到兜底，功能不丢）；
2. **`scripts/bot-health.cjs` 匹配逻辑更新为「新旧前缀都认」**：作用域目录匹配从字面
   `bot-workspaces-<id>--` 扩为 `pod-workspaces-<id>--` ∪ `bot-workspaces-<id>--`
   （字面双认，常量收进 `lib/data-roots.cjs` 单源）——bot-health 无兜底扫描，不双认即全盲；
3. **新会话落新分片**：重启后 bot cwd＝`pod-workspaces/<id>`，宿主按新 cwd 建新分片；
   旧分片随旧路径只读窗口一并静止。

## 5. 搬迁步骤（一个收口窗口；每步标注授权件）

窗口排序（**新代码首次启动必须在数据就位之后**，风险①）：

| 步 | 动作 | 授权件 |
|---|---|---|
| 0 | `node scripts/migrate-pod-data.mjs --dsh-home ~/.dsh`（默认 dry-run，只打计划零写入）＋`--verify-only` 采集迁移前基线报告 | F8 数据迁移点名（步骤 2-3 同件） |
| 1 | 停 bot 链（全 bot 重启链的停段） | F8 授权②「全 bot 重启链」 |
| 2 | 部署同步：`scripts/deploy-sync.mjs --spec …`（`deploySubdir: plugins/pod`，备份落 `backups/pod`） | F8 授权①「部署同步」 |
| 3 | 数据迁移：`node scripts/migrate-pod-data.mjs --dsh-home ~/.dsh --execute --profiles --report <path>` | **F8 授权④「数据迁移」**（--profiles 面票 13 授权件覆盖：patch 行与软链属 F4 四同名同步） |
| 4 | 起链（重启链起段；新代码首次启动，读到的已是搬好的 `pod/` 注册表） | F8 授权②（同窗） |
| 5 | 就绪核验：`node scripts/org-cutover-check.mjs --dsh-home ~/.dsh` ＋ `migrate-pod-data.mjs --verify-only` 对比迁移前后报告 | 只读，无授权件；红→按 §7 回退 |

仓库外现役脚本同步（`~/.dsh/dsh-web.sh`／`~/.dsh/restart-split.sh`）属票 13 授权项 3，不在本脚本面。

### 脚本契约（`scripts/migrate-pod-data.mjs`）

- 参数：`--dsh-home <dir>`（缺省＝`readEnvValue(env,"DSH_HOME")` 回落 `~/.dsh`）、
  `--execute`（显式门，缺省 dry-run 零写入）、`--profiles`（patch 重写＋软链改名步骤）、
  `--verify-only`（只跑 §3 校验器，不搬迁）、`--report <path>`（JSON 校验报告落盘）。
- 步骤序（--execute）：**前置校验 → 真实拷贝 → 逐件 sha/计数复验 → 注册表路径字段
  重写（②′）→ --profiles（若旗标）→ 旧根改名 `*.retired-<ts>` → 就绪输出**。
- 注册表路径字段重写（②′；2026-10-12 窗口修门）：workspace／workspaceRoot 指新工作区根。
  事由：整表搬运保留存量字段值，而 `bot.workspace` 被宿主序列化输出与权限判定消费
  （`lib/index.js::serializeBot`／`lib/org/permissions.js::isBotWritablePath`）——不重写则
  重启后仍指已迁走的旧根。厂外自定义值（不落在旧工作区根下）不误改；失败语义同数据根
  搬迁段（在 retire 前，失败则新根清理、旧根原样）。
- **前置校验（失败即拒，exit 1，零写入）**：
  1. 旧布局在位：`<home>/bots/bots.json` 存在且为对象表、`<home>/bot-workspaces/` 存在；
  2. 新根不在位：`<home>/pod` 或 `<home>/pod-workspaces` 已存在 → 拒
     （「已迁移或布局冲突」——二次 execute 天然拒绝，幂等语义＝拒绝而非重搬；
     复验走 `--verify-only`）；
  3. 无在跑进程：读 `bots/started/instances.jsonl` **每个 botId 最新行**＋注册表内 `pid`
     字段，逐 pid 存活探测（`process.kill(pid,0)`；EPERM 视同存活）——发现任何存活 pid 即拒
     （host 行含内，窗口内 host 也必须停）。
     *修门口径（2026-10-12）：原「instances.jsonl 全部行」在真实运行面假阳性——271 行历史里
     pid 940（cupsd）／968（cups-browsed）／987（snapfuse）被复用，逐行探测会把已停机窗口
     误判为在跑；**该件收窄为每 botId 最新行**（与 capability 面 `currentInstanceRow`
     「每 botId 现行行」读法同口径）；**注册表面无需过滤**（`bots.json` 按 botId 单条＝每席
     一条现役行，无历史行）。反例锁＝最新行活仍拒（tests/pod-data-migration.test.mjs）。
     原始观测（ps／grep 输出）与放宽取舍见票 14「修门与授权留档」节＋修门提交 `edef328`。*
- **失败中止语义**：拷贝与复验任一步失败 → 已落新根删除（rm 已建新目录树）、旧根不动、
  exit 非 0——不留半迁移态；旧根改名是**最后一步**，之前任何失败均不影响旧布局。
  注记（评审返修）：`--profiles` 步不在新根清理面——已重写 patch／已改名软链不自动
  回滚（旧布局仍现役可继续服务），重写幂等，重跑 `--execute --profiles` 即续完未竟改动。
  **软链重指（2026-10-12 窗口修门）**：软链改名同时**重指部署目录** `plugins/pod`
  ——存量链接目标是旧部署目录 `plugins/dsh-bots`，保目标改名会让 patch 行 `name: 'pod'`
  解析到旧代码（四同名绑定；`host-runtime-map` 解析锚节同口径）。新名链接已在位且
  已指部署目录＝幂等零改动；新名已在位但指他处＝不动待人工确认（不悄然改写），
  旧名项非软链＝fail closed 不动（人工处置点）；反例用例锁两侧。
- **报告**（`--report` JSON）：迁移前后路径清单、逐面计数（席位表条目/逐 id、台账
  lastSeq/事件数、inbox/outbox 文件数与行数、capabilities/nonce 计数、started 行数、
  knowledge index 行数/reports 数、workspaces 目录与文件数、backups 计数）、逐件 sha
  对账结果、`registryRewrite`（注册表路径字段重写清单）、profiles 步骤逐份改动清单。

## 6. 旧路径只读窗口与清理

- 旧根 `bots/`、`bot-workspaces/` 改名 `bots.retired-<ts>`、`bot-workspaces.retired-<ts>`
  **不删除**，只读保留一个窗口（代码零引用 retired 名，窗口内无读者；确认无读者后清理）。
- **清理另点名**：`bots.retired-*`／`bot-workspaces.retired-*`（644MB）的删除属运行面
  写入，届时逐项点名，不在本票、不在本脚本面。
- `backups/dsh-bots/` 13 批**永久保留**（历史回滚证据，角色冻结）。

## 7. 回退面（不演练）

- **回退件**：① `backups/pod|dsh-bots/` 部署备份（票 13 面，回退部署目录）；
  ② git 提交点（本票 roots 切名提交与票 13 身份切换提交，回退代码）；
  ③ 旧根 retired 改名件（数据回退＝把 `<root>.retired-<ts>` 改名回 `<root>`，
  并删除新根——数据未受任何原位改写，改名回滚即完整恢复）。
- **回滚判据**：就绪核验（步骤 5）红，**或**席位表 sha 与迁移报告不符 → 按本节执行。
- **执行人**＝用户授权窗口内的实施会话（回滚决定权在用户，spec §F9；不演练）。

## 8. 授权点清单（F8 四件；票面须记授权依据原文）

| 授权件 | 依据原文位 | 本票动作 |
|---|---|---|
| ① 部署同步 | spec §F8「需逐项点名的运行面三件＝① 部署同步…」（转写 L4442、L5268） | 只写手册步骤 2，**不执行** |
| ② 全 bot 重启链 | 同上② | 只写手册步骤 1／4，**不执行** |
| ③ 新 runId 增量证据包 | 同上③；§F7 改名触发重采集 | 归票 15 |
| ④ 数据迁移（C 组另加一次点名） | spec §F8「C 组若做另加一次数据迁移点名」（转写 L4215） | 只写手册步骤 0／3，**不执行** |

本票仓库内交付＝方案文档（本件）＋`lib/data-roots.cjs` 收敛与切名＋迁移脚本与校验器
＋bot-health 双认＋测试＋地图；**真实运行面（`~/.dsh`）零读零写**，一切验证走临时目录夹具。
