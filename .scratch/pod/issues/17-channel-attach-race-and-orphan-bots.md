# 17: [fix] 组织通道条目被值守拍回收后无重挂路径＋宿主重启遗留孤儿 bot

**What to build:** 组织面（org 通道）两处现役短板，同批处置。

- **① 挂载竞态**：交付条目（delivery entry）在 `spawn` 之后、bot 自注册行落盘之前被台账值守拍
  回收；挂载只在 spawn 时发生一次 ⇒ 该 bot 的组织通道**永久缺失**，须人工重启才恢复。
  实测窗口 ≈1.8s（spawn→自注册行落盘），值守拍 5s ⇒ 命中率 ≈36%。
- **② 重启链遗留孤儿**：宿主重启（`restart-split.sh`）只换宿主进程，bot 子进程成孤儿；新宿主自启动
  按 pid 判活跳过它（`lib/bot-autostart.js:24`），`start()` 对在线 bot 直接 `alreadyRunning`
  （`lib/index.js:1217`），而条目只在 spawn 时挂（`lib/index.js:1309`）⇒ `channels=[]`、组织面静默，
  同时席位 UI 与 `GET /api/pod` 仍报 `online=true`。

**票源:** 2026-10-13 会话——用户点名「顺手做」宿主就绪核验 runtime 腿；第一次 `stop→start` 失败、
第二次成功，撞出缺陷①；宿主重启后的红态撞出缺陷②。用户裁定「立票（竞态＋重启链缺口）」。

**Blocked by:** —（独立小批。0011 包 `sourceManifest` 11 件与本票预计改动面
〔`lib/org/capability-delivery.js`／`lib/bot-autostart.js`／`lib/index.js`〕零交集，实现时复核）

**Status:** ready-for-agent（路线已裁定；仓库内实现＋测试完成，运行面复验进行中——见 Comments「实施记录」）

**验收判据:**

- [x] 竞态回归用例（非恒真，当前实现下先红）：构造「子进程刚起、自注册行尚未落盘」的一拍，
      断言交付条目在该拍**不被回收**，或回收后经 `pod:org-ready` **可重挂**——两条路线至少实现一条
      并由该用例把守；
- [ ] 宿主重启后零人工干预即恢复：两席（duty-coordinator／implementer）自动挂回本代际，
      `channels` 两条且 `gen` 非空、connected／delivered／roleReady 全真；
- [ ] `node scripts/org-cutover-check.mjs --dsh-home ~/.dsh --host-url http://127.0.0.1:3080`
      四腿全绿（`ready:true`，退出码 0）；
- [x] 四门 PASS 且计数 ≥ 基线（93/93・11/11・0 违例・15-0-0）；
- [x] 冻结面复核：不触碰 0011 包 `sourceManifest` 11 件；若触碰 ⇒ 新 `runId` 重采集＋新序号
      增量包（逐项授权点）；
- [x] 留界登记：`~/.dsh/restart-split.sh` 侧是否同批收缩＝出仓库动作，须点名；未点名时在票面
      记归属与触发句。

## Comments

### 观测与证据（2026-10-13，runtime 腿核验窗口）

**① 挂载竞态**

- 现象：`POST /api/pod/<id>/stop` → `start` 后，就绪面 `channels` 由 2 条变 0 条；两席进程存活、
  实例行已自注册、端口在听，但组织通道不再恢复。
- 观测值：第一批 spawn（pid 45992／46006，@06:22:03.70Z）后条目出现、<5s 即空；第二批 spawn
  （pid 46344／46358）0.77s 挂条目 → 3.59s `gen` 非空且 connected／delivered／roleReady 全真 →
  稳定 ≥6s。
- 证据指针：`~/.dsh/pod/started/instances.jsonl`（行 `host-45345`／`45992`／`46006`／`46344`／`46358`）；
  代码坐标按**符号锚**（行号为当时观测坐标，随本票实施已位移）：`lib/org/capability-delivery.js`
  的 `live()`（当时 `:14`）与 `tick()` 回收分支（当时 `:162`）、`lib/org/ledger-host.js` 的
  `LEDGER_TICK_MS`（当时 `:341`）、`lib/index.js` `spawnBot` 里 `delivery.attach` 的唯一调用点
  （当时 `:1309`）与 apply 的 bot 自注册行 append（当时 `:2988-2999`，现由 `startedRegistryFile` 段内
  `appendFileSync` 承载）。
- 归因：spawn 时该 bot 的最新实例行仍是**上一代 pid** ⇒ `live()` 的 `row.row.pid === entry.child.pid`
  判假 ⇒ `tick()` 回收；条目回收后无重建路径。

**② 重启链遗留孤儿**

- 现象：宿主重启后 `org-cutover-check` 报 `hostEnv.ok=true`、探针 15-0-0，但 `runtime.ok=false`、
  `channels=[]`。
- 观测值：`GET /api/pod` 两席 `online=true`，pid 仍为旧宿主代际的 37084／37118；端口 3101／3102
  有监听并回 401（进程存活）；新宿主 pid 45345。
- 证据指针：`~/.dsh/restart-split.sh` 的 kill／重启段（当时 `:21-27`：只换 `dsh web`，不触 bot
  子进程）；`lib/bot-autostart.js` 旧 `selectBotsToAutoStart`（当时 `:18-28`，按 pid 判活；本票改为
  `planAutoStart`）；`lib/index.js` `BotsApi.start` 的 `alreadyRunning` 短路（当时 `:1216-1219`，
  本票未改其语义）。

### 建议方向（待裁定）

- **路线 A（修因，推荐）**：`pod:org-ready` 到达而当前无有效条目时，用宿主已持有的子进程句柄重建
  条目（`spawnBot` 已把 `{child,pid,startedAt,gen}` 存进 `api.processes`）——回收不再等于永久缺失。
- **路线 B（回收门宽限）**：`live()` 对「子进程在＋注册表 pid 匹配＋自注册行尚未更新」的过渡态不判死，
  宽限期取实测上界以上（实测 ≈1.8s）。
- **路线 C（宿主补写实例行）**：与 F-RV-17/19「实例行本进程自算、不接受外部传入」冲突，不取。
- 两条路线不互斥：A 治「已回收」，B 降低触发率。②的仓库内半边（自启动只认 pid）与①同批处置；
  ②的运行面半边（重启脚本）＝留界项。

### 关联（不在本票范围）

- 手工启动宿主缺 `POD_HOST_URL` ⇒ 组织面休眠：已登记 `docs/PROJECT_UNDERSTANDING.md`「仍可选题」
  （宿主自检按设计只报不修）。

### 裁定与实施记录（2026-10-13，用户 AskUserQuestion 后）

**裁定**：①走 **A＋B**（A＝`pod:org-ready` 到达而条目不有效时按宿主仍持有的子进程句柄重挂；
B 以**结构性判据**落地，非计时宽限——见下「口径偏离」）；②处置面＝自启动接管上一代遗留进程
（先停后起）；运行面半边（`restart-split.sh`）仍为留界项。本轮逐项授权：**C2 部署同步＋重启
宿主＋四腿复验**。

**口径偏离（B）——计时宽限改为判据分离。** 票面 B 写作「过渡态给宽限期（取实测上界以上）」；
实现取等价但无魔数的口径：回收判据与代际判据拆成两条。

- 回收判据 `attached(botId, child, post)`＝「子进程相连＋注册表仍登记该 pid 与 home 岗位」，
  **不读** bot 自写实例行——行未落盘不再等于死亡，触发窗口被消除而非被宽限；
- 代际判据 `live(entry)`（实例行 pid／活态／hostInstanceId 同代）**原样保留**，仍是签发、领取
  （`read`）、续签与 `keep` 的门——放宽只发生在「进程还归不归我们」，不发生在能力面；
- 副作用（正向）：实例行始终不落盘的 bot 从「条目静默消失（channels 空）」变为「条目在册、
  `connected:false`」——就绪面看得见根因，不再要人工从空 channels 反推。

**①`lib/org/capability-delivery.js`**

- `attached()`／`entryFor()`／`drop()`／`bind()`／`unbind()`／`ensureEntry()`／`answerReady()`／
  `handleMessage()` 取代原 `attach()` 内联闭包；IPC 监听（message／exit／disconnect）改为**随子进程
  寿命**存活，条目回收不再摘监听——原实现在 `dispose()` 里 `off("message")`，ready 这一**一次性**
  宣告随之永久丢失，是①的直接根因；
- ready 宣告持久化在条目 `pending` 上：实例行未落盘时不签发、不丢弃，落盘后第一拍（`tick`）补发；
- `ensureEntry()`＝路线 A：条目已被回收而宿主仍持有该句柄（相连＋注册表仍登记）时按 ready 重建；
- 重发语义保留：已引导的条目再次收到 ready 仍重发同一凭据（bot 侧重载后重新领到，幂等）——此点由
  既有 `tests/org-bootstrap-channel.test.mjs` 第 3 例把守（首版实现漏掉即被该例打红，已修）；
- `close()` 摘监听并清条目，且**不**登记复核失败（原 `dispose(false)` 语义）。

**②`lib/bot-autostart.js`＋`lib/index.js`**

- `selectBotsToAutoStart(registry, isAlive)` → `planAutoStart(registry, { isAlive, isOwned })`：返回
  `[{id, restart}]`；「在线」＝pid 活**且** `isOwned(id)`；在线但不属本宿主 ⇒ `restart:true` 单列，
  编排面先 `api.stop(id)` 再 `api.start(id)`，结果计入新成员 `restarted`（不再记 `already`）；
- `BotsApi.ownsProcess(id)`＝`processes.get(id)?.child?.connected === true`——宿主重启后 `processes`
  为空、登记 pid 全成遗留；遗留进程的 IPC 通道随上一代宿主退出已断、端口仍被它占着，故只有先停后起
  才可能重建组织通道；
- **不动** `BotsApi.start()` 的 `alreadyRunning` 语义（接管归自启动面）：手动 `POST /start` 对遗留
  进程仍返回 `alreadyRunning`——`POD_AUTOSTART=0` 时该路径不自愈，属既有语义，不在本票放宽。

**测试**

- 新增 `tests/org-channel-reattach.test.mjs` 6 例（夹具＝EventEmitter 假子进程＋真实五字段实例行；
  3 例正案在旧实现下先红：竞态拍不回收＋行落盘后挂通道、ready 先于行到达的补发、路线 A 重挂；
  3 例反例防恒真：子进程断开即回收且事后 ready 不重建、注册表换人后旧句柄不抢回、常驻岗位之外的
  条目照旧不引导）；
- `tests/bot-autostart.test.mjs` 扩到 9 例（plan 过滤与遗留单列、先停后起、接管失败隔离、
  `internals` 自启动成员枚举（形状：旧 `selectBotsToAutoStart` 不得残留）、`ownsProcess` 接线面、
  应急闸不变）。

**验证（仓库内）**：`npm test` 94/94（基线 93/93＋新件）；`npm run preflight` 四门全绿——①94/94
②0011 包 11/11（冻结面零触碰）③status-lint 0 违例 ④宿主契约 15 PASS／0 FAIL／0 SKIP。
运行面复验（判据②③）见末节「运行面复验」。

**评审处置（code-review 两轴，2026-10-13）**

- Standards 轴：①「观测与证据」裸行号→改符号锚（历史坐标标注保留）；②悬空指针「见下节」→已补末节；
  ③Status 词表——本仓库无「实施中」词，取 `ready-for-agent`＋括注（先例：`ready-for-human（…）`），
  运行面复验后转 `resolved`；④删面缺形状测试→补 `internals` 自启动成员枚举例；⑤测试触
  `BotsApi.processes`（lib/index.js 内部面）——该字段在构造器注释中即为公开登记面，且本测试文件的
  既定立场是「不 spawn 真实进程」（真 spawn 链路由宿主重启实测覆盖），保留并在本例注明；
  ⑥落档事件随本批提交补齐。
- Spec 轴：①`status()` 对「已挂载但 `live()` 不成立」的条目改为留行（`connected:false`），
  `readyChannels` 的 `channels.length === 2` 在**双席名册下**不可能被撑破（条目按 botId 唯一，
  至多两条）；旧口径下同一处境是「缺行」、同样不绿——失败形态由「缺行」换为「可见的僵尸行」，
  无绿→红路径（评审复核后亦自行更正此前过判）；②路线 A 在结构性回收口径下不常触发（回收只发生在
  「已不是我们的进程」），其真实触发面＝调用面显式摘除（`attach` 返回的句柄）与 IPC 发送失败后重建，
  属纵深防御并有用例把守——**口径记录于此**；③`bindings` 监听保留到子进程退出／断开或 `close()`：
  `bindings` 按 botId 唯一（至多与席位数同阶），非无界增长，且保留监听正是路线 A 的前提，故不改。

### 留界登记（判据 6，2026-10-13）

`~/.dsh/restart-split.sh` 只 kill／重启 `dsh web`、不触 bot 子进程，本轮**点名范围内不动它**
（本轮点名仅 C2 部署同步＋重启宿主＋复验）。归属：出仓库运行面运维件，非本仓版本化面。
触发句（择一才动）：①将来要把脚本改成「同批收掉 bot 子进程」；②宿主侧接管被判不可接受、
要求脚本侧收口。仓库内半边（自启动接管遗留进程）已在本票落地，脚本不动不再构成缺口。

### 运行面复验（判据②③，2026-10-13）

**进行中**：C2 部署同步（`scripts/deploy-sync.mjs`＋批规格件）→ 宿主重启（`restart-safe.sh`，
systemd 单元隔离；旧宿主即本会话所在进程，故重启后由留驻脚本续跑复验）→ `org-cutover-check`
四腿核验。结果（就绪 JSON 记录件、两席 `gen` 与三态、接管日志行）在本节随批补记。
