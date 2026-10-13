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

**Status:** needs-triage（两处缺陷已定位；修复路线待裁定，见 Comments「建议方向」）

**验收判据:**

- [ ] 竞态回归用例（非恒真，当前实现下先红）：构造「子进程刚起、自注册行尚未落盘」的一拍，
      断言交付条目在该拍**不被回收**，或回收后经 `pod:org-ready` **可重挂**——两条路线至少实现一条
      并由该用例把守；
- [ ] 宿主重启后零人工干预即恢复：两席（duty-coordinator／implementer）自动挂回本代际，
      `channels` 两条且 `gen` 非空、connected／delivered／roleReady 全真；
- [ ] `node scripts/org-cutover-check.mjs --dsh-home ~/.dsh --host-url http://127.0.0.1:3080`
      四腿全绿（`ready:true`，退出码 0）；
- [ ] 四门 PASS 且计数 ≥ 基线（93/93・11/11・0 违例・15-0-0）；
- [ ] 冻结面复核：不触碰 0011 包 `sourceManifest` 11 件；若触碰 ⇒ 新 `runId` 重采集＋新序号
      增量包（逐项授权点）；
- [ ] 留界登记：`~/.dsh/restart-split.sh` 侧是否同批收缩＝出仓库动作，须点名；未点名时在票面
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
  代码坐标 `lib/org/capability-delivery.js:14`（`live()` 判据）、`:162`（tick 回收）、
  `lib/org/ledger-host.js:341`（`LEDGER_TICK_MS=5000`）、`lib/index.js:1309`（唯一 attach 点）、
  `lib/index.js:2988-2999`（bot 自注册行 append）。
- 归因：spawn 时该 bot 的最新实例行仍是**上一代 pid** ⇒ `live()` 的 `row.row.pid === entry.child.pid`
  判假 ⇒ `tick()` 回收；条目回收后无重建路径。

**② 重启链遗留孤儿**

- 现象：宿主重启后 `org-cutover-check` 报 `hostEnv.ok=true`、探针 15-0-0，但 `runtime.ok=false`、
  `channels=[]`。
- 观测值：`GET /api/pod` 两席 `online=true`，pid 仍为旧宿主代际的 37084／37118；端口 3101／3102
  有监听并回 401（进程存活）；新宿主 pid 45345。
- 证据指针：`~/.dsh/restart-split.sh:21-27`（只 kill／重启 `dsh web`，不触 bot 子进程）；
  `lib/bot-autostart.js:18-28`（`selectBotsToAutoStart` 按 pid 判活）；`lib/index.js:1216-1219`
  （`alreadyRunning` 短路）。

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
