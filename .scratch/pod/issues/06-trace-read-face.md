# 06: L2 工具轨迹只读投影

**What to build:** 宿主新增只读面，把 bot 会话事件里的工具调用投影成**官方形状的记录**，
供前端按回合渲染——不新增落盘面、不动冻结的邮件键封闭。

**Blocked by:** 01

**Status:** ready-for-agent

**接口契约:** 07 将逐字依赖本票的记录形状与读面符号；形状变更须走票面 amend，不得静默漂移。

- [ ] 读面符号＝`BotsApi.trace(id, since)`，挂 `GET /api/bots/:id/trace`，与既有 `BotsApi.stats`
      同款双路：在线 RPC（`session.history`）优先、离线读盘（`readSessionEventsFromFile`）回落，
      复用其 mtime／size 结果缓存与增量语义；
- [ ] 记录形状冻结：`{ seq, time, callId, parentCallId?, name, argsRaw, state, outputText?,
      isError, errorText?, turn, step, subCalls[] }`；`state ∈ preparing|running|ok|error|stopped`；
- [ ] **PTC 语义**：外层 `tool/call`（`run_code`）作信封，`tool/ptc-dispatch*` 的内层工具名与
      其结果归入该信封的 `subCalls`——内层名**不得被别名化、不得丢失**；
- [ ] 边界：邮件面行键（inbox／outbox）与 `session-driver` 回合返回形状均不变；
- [ ] 测试：合成事件流的投影单测（含错误、中断、未闭合回合、并发子调用、缺工具名）＋读面契约测试；
- [ ] 缺会话／损坏日志走 fail-closed（返回空或显式错误），不得抛到 HTTP 面外。

## Comments

### 实施记录（2026-10-09）

#### 1. 读面符号与路由（判据 V-P4.1／V-P4.6）

- **`BotsApi.trace(id, since = null)`**（`lib/index.js`，`BotsApi` 类内、紧跟 `stats` 之后）：
  ① `hasRegisteredBot` 注册表校验 → 未注册抛 `httpError(404, 'bot "<id>" 不存在')`；
  ② `readBotSessionId` 解析持久会话 id，`null` → `{ trace: [], counters: { gap: 0 } }`（尚无会话）；
  ③ 在线（`computeStatus(bot).online`）先走
  `dshRpc(bot.port, "session.history", { sessionId, maxMessages: 2000 }, { rpcPrefix: 'dsh-bots-<id>-trace' })`，
  entries 按 `entry.event ?? entry` 展开后投影（与 `stats` 同一展开口径）；
  ④ RPC 失败 → `logger.warn` 留痕（含 `trace("<id>") 在线 RPC 失败，回退读盘`）后回落
  `offlineTrace(this.dshHome, workspaceDirFor(...), sessionId)`；不是 500。
- **路由 `GET /api/bots/:id/trace`**（`handleApi` 的 4 段分发，`stats` 分支之后）：
  前缀路由 `/api/bots` 下注册；非 GET → 405；任何抛错 → 统一 `{error: message}`（HTTP 层既有 catch）。
- **`?since=` 是严格的 seq 增量水位**（不是 `messages` 的时间戳口径）：新解析器
  `querySinceSeq(req)` 只收非负整数，缺省/非法 → `null`（不过滤，宽容口径与 `messages` 一致）；
  过滤为 `record.seq > since` 的**顶层记录**——子调用随信封整体返回（信封序即其可见序），
  避免「父记录被过滤掉而子调用孤儿化」。
- **离线读盘**（`lib/trace-projection.js::offlineTrace`）：复用 `stats.js` 的
  `findSessionLogFile`（分片定位）与 `readSessionEventsFromFile`（多帧 zstd 解码、撕裂尾帧容错），
  外加同款 **mtime／size 结果缓存**（`diskTraceCache`，上限 64，与 `diskStatsCache` 各自成表）；
  日志缺失/损坏/读盘异常一律空轨迹（fail-closed，绝不抛到 HTTP 面外）。

#### 2. 记录形状最终字段表（13 字段；消费者票 07 逐字依赖）

| 字段 | 类型 | 来源事件字段 | 缺省语义 |
|---|---|---|---|
| `seq` | int | `event.seq`（顶层取 `tool/call`；子调用取 `tool/ptc-dispatch-start`；结果先行时取 `tool/result`） | 缺失 → `Number.MAX_SAFE_INTEGER`（排末尾，不臆造小序） |
| `time` | int | 同源事件的 `event.time` | 缺失 → `0`；同一子调用的 start／settle 取更早者 |
| `callId` | string | `tool/call.data.callId`；子调用＝`tool/ptc-dispatch*.data.subCallId` | 无 `callId` 的事件不成记录，计一次缺口 |
| `parentCallId?` | string | 子记录：`tool/ptc-dispatch*.data.parentCallId`（缺 → `rootCallId`） | 顶层记录**无此键**；孤儿被提升为顶层时也删键 |
| `name` | string | `tool/call.data.name`；子调用＝`tool/ptc-dispatch*.data.name`（逐字，不别名化） | 缺失 → `""`（07 层回落通用行），计一次缺口 |
| `argsRaw` | string | `tool/call.data.arguments` 或 `tool/ptc-dispatch*.data.arguments` | 源为字符串 → 逐字；对象 → `JSON.stringify`；缺失 → `""`；序列化失败 → `String()`，绝不抛 |
| `state` | enum | 三态推导（见下） | 必填；枚举仅 `preparing｜running｜ok｜error｜stopped` |
| `outputText?` | string | `tool/result.data.message.content` 或 `tool/ptc-dispatch.data.content` 的文本块拼接 | 无可取文本 → **无此键**（不是空串） |
| `isError` | bool | `message.isError === true` 或存在 `data.error` | 缺省 `false`；与 `state` 同步（`error` ⇔ `true`） |
| `errorText?` | string | `data.error` 的标量（`reason` → `message` → `code` → `name`），无结构化 error 时回落 `outputText` | 非错误或无可取文本 → **无此键** |
| `turn` | int | 顶层 `tool/call.data.turn`／`tool/result.data.turn`；子调用继承信封 | 缺失 → `0`（与真实回合号不撞） |
| `step` | int | 同上（`data.step`；子调用继承信封） | 缺失 → `0` |
| `subCalls[]` | record[] | 见 §3；同形状递归 | 无内层 → `[]`（非缺省） |

**`state` 判定**（形态冻结，映射即实现口径）：

- `preparing` ＝ 已见 `tool/call`，未见派发、未见结果，且回合未闭合；
- `running` ＝ 已见 `tool/ptc-dispatch-start`（子调用），或**信封有已派发的子调用**
  （PTC 信封的「执行中」由内层推出——内层事件不改写信封自身的等待态）；事件乱序时
  按 `runningCalls` 标记保持，不得回退 `preparing`；
- `ok`／`error` ＝ 结果到达（`isError` 与 `state` 同步，错误文本见上表）；
- `stopped` ＝ 回合以 `turn/end.reason.kind ∈ {aborted, interrupted}` 收尾却仍未落定；
  回合已闭合（正常 `completed`）但调用无结果者同样取 `stopped` 并**计一次缺口**；
  **回合未闭合（无 `turn/end`）不改判**：保持 `preparing`／`running`（增量轮询期间不臆断中断）。

响应形状：`{ trace: [record...], counters: { gap: number } }`（空轨迹同样是这个形状）。
`counters.gap` ＝ 投影缺口计数（缺工具名、孤儿结果、信封缺失的孤儿子调用、非事件项），
供票 07 的 §E2-R5「投影缺口」上浮口径直接取用。**新增响应字段**（`counters`）属本票
读面自定面，不属消费者冻结的**记录形状**；记录键集封闭由形状测试把守。

#### 3. PTC 归并规则（判据 V-P4.3）

- 外层 `tool/call`（`run_code`）成**一个顶层记录**，`tool/ptc-dispatch-start`／
  `tool/ptc-dispatch` 按 `subCallId` 归入其 `subCalls`（`parentCallId` 回指信封 `callId`）；
  信封不重复计入顶层记录数（07 的「N ＝顶层记录数」口径前提）。
- 内层 `name` **逐字保留**（含 `ledger.read`／`mail.send` 这类带点组织 op 名），
  结果文本/错误各归各的子调用（`outputText`／`isError`／`errorText`），
  子调用状态不污染信封状态（实测：内层 `error` 时信封仍 `ok`）。
- 子调用排序＝**日志序**（`tool/ptc-dispatch-start` 的 `seq`），即提交/开始序，
  与 settle 顺序、并行度无关；同 `subCallId` 的 start／settle 两事件复用同一记录。
- **孤儿子调用**（信封缺失，例如日志截断）→ 提升为顶层记录（删 `parentCallId`）
  并计一次缺口：内层名与结果**不丢失**。
- 信封晚于子调用事件到达时，子记录的 `turn`／`step` 由信封回填（内层事件不带这两个字段）。

#### 4. 验证命令与实际计数（本工作树实跑）

| 命令 | 结果 |
|---|---|
| `TMPDIR=/tmp node tests/pod-trace.test.mjs` | **18/18 用例通过**（投影单测 10＋读面契约 5＋形状/负例 3） |
| `TMPDIR=/tmp node tests/export-face.test.mjs` | 2/2 通过（见 §5 偏离①） |
| `TMPDIR=/tmp node tests/run.mjs` | **87/87 个测试文件通过**（main 基线 84/84 ＋ 本票 `pod-trace.test.mjs` ＋ 集成分支已并入的 `pod-harness-base`／`client-disclosure`） |
| `TMPDIR=/tmp node scripts/preflight.mjs` | ① 回归 87/87 ✅ ② 冻结面（0010 包）10/10 ✅ ③ status-lint 0 违例 ✅ ④ 宿主契约 12 PASS / 0 FAIL / 0 SKIP ✅（`preflight: PASS`） |

计数口径：上表 `run.mjs`／preflight 的 87/87 是 `git merge integration/pod`（并入 10 号票
`be95fbb`）**之后**的终态；本票单件 `pod-trace.test.mjs` 为 18/18，`export-face.test.mjs` 2/2。

**真实数据只读实跑**（仓内已落档的会话事件样本，非合成夹具；只读，不写运行面）：

| 载体 | 结果 |
|---|---|
| `artifacts/cutover-preparation/`… 之外仓内 PTC 会话样本：`.scratch/org-v2-build/experiments/run-20261005-v2/assembly-partial.json` 内嵌的一份**真实 PTC 会话**（365 事件，含 `tool/call`／`tool/ptc-dispatch-start`／`tool/ptc-dispatch`／`tool/result`） | 顶层记录 38、子调用记录 75、`gap=0`；样例信封 `seq=18 name=run_code state=ok turn=1 step=1 subCalls=3`；内层名集合 `bash knowledge_search read skill todo_write write`（**全部非空、不别名化**）；子调用 `parentCallId` 全部回指信封 `callId` |
| 本机真实会话日志 `~/.dsh/sessions/**/session.jsonl.zstd` 抽样 12 份（只读；最大 22 MB／87619 事件） | 形状校验（13 字段必填＋枚举＋`subCalls[]`）与 `seq` 严格递增**零异常**；`gap` 全为 0——真实完整日志上投影无缺口 |

（`~/.dsh` 只读打开、零写入；该抽样不进仓、不复现为测试——仓内可复现证据仍是上表的
`pod-trace.test.mjs` 合成流与临时 `DSH_HOME` 夹具。）

判据→测试映射：V-P4.1＝读面/路由/since/缓存 4 例；V-P4.2＝正常回合字段＋形状键集封闭 2 例；
V-P4.3＝PTC 信封 1 例（内层名/结果/父指/子状态）；V-P4.4＝邮件行键负例；V-P4.5＝session-driver
返回形状负例；V-P4.6＝损坏日志 fail-closed（经 HTTP 面）；V-P4.7＝并发子调用/中断/未闭合/
缺名/孤儿/坏报文 6 例。文件内每个用例名带判据号（`V-P4.x`），断言可执行（非 grep）。

#### 5. 偏离、边界与未闭合项

- **偏离①（必要性说明）**：`tests/export-face.test.mjs` 的零引用导出棘轮基线移除了
  `lib/stats.js:findSessionLogFile` 一项（68 → 67）。原因：本票按「复用 stats 的读盘实现」
  要求让 `lib/trace-projection.js` 真实 import 了该符号，棘轮门要求**同步移除已获消费者
  的存量项**（否则门红）。已在基线文件头与该行组注释留因。
- **偏离②（登记件）**：`lib/host-faces.js` 的 `HF-SESSION-LOG` 面（session 日志读取面）
  `readAccess`／`adapterModule` 补记新读者 `lib/trace-projection.js`——不补则该面登记表
  与实际读者不符（该文件不在冻结清单内）。
- **边界不动（实测负例把守）**：邮件面行键仍为 `{id,text,from,timestamp}`；
  `session-driver.runPrompt` 返回仍为 `{text, sessionId}`（键集精确断言）；
  **不新增落盘面**（只读 `~/.dsh/sessions` 既有日志，零写入）。
- **未闭合项（留给 07／10）**：① 真机目视（Pod 前端渲染工具行）不属本票，按 PLAYBOOK §5
  留待真机授权窗口后端到端复核；② `?since=` 对**截断日志**（RPC `maxMessages` 截尾）
  的边界语义未定义——本票口径是「严格 seq 水位＋封套整体返回」，若 07 发现首屏需要
  「已知水位但从头补齐」，须走票面 amend 而不是让读面静默改口径；③ `counters.gap`
  只是计数（不区分缺口类型），若 07 要把缺口分解为可观测项需在本票 amend 里点名细分键。
- **未证声明**：真机运行面（`~/.dsh` 真实会话日志）上的投影表现未在本批取证——
  全部验证基于合成事件流与临时 `DSH_HOME` 夹具（事件形状取自官方
  `dsh-tools/lib/types/types.d.ts` 的 `PtcDispatch*EventData` 与
  `dsh-session/lib/types/types.d.ts` 的 `TurnEndReason`）。

#### 6. 给 07 的接口契约（一句话）

`GET /api/bots/:id/trace?since=<seq>` 返回 `{trace: record[], counters: {gap}}`，
`record` 键集封闭为 `{seq, time, callId, parentCallId?, name, argsRaw, state,
outputText?, isError, errorText?, turn, step, subCalls[]}`、`state ∈
preparing|running|ok|error|stopped`，`since` 只过滤顶层信封（子调用随信封整体到达），
PTC 内层真实名挂在信封 `subCalls[].name` 且不别名化；`turn` 是拼装锚定键、`seq` 是排序键。

### 返修记录（2026-10-09）：会话日志文件名代际盲区

#### 1. 缺陷与证据

- **缺陷**：`lib/stats.js::findSessionLogFile` 只拼旧名 `session.jsonl.zstd`；现役宿主
  `dsh-session-format/lib/index.js::sessionFormatLogFilename` 在 v≥1 写版本化名
  `session.v<N>.jsonl.zstd`（现役 bot 会话＝`session.v4.jsonl.zstd`）。后果：`offlineStats`
  与 06 号票新增的 `offlineTrace`（`BotsApi.trace` 的离线回落）对 v4-only 会话**静默全零／空轨迹**；
  探针 `scripts/host-contract-probe.mjs::findNewestSessionLog` 同病（只认旧名）。
- **Lead 实测（返修前 HEAD `fdc587f`）**：`~/.dsh/sessions/--home-beijong-.dsh-bot-workspaces-implementer--/session-e56304de-63bb-4644-a32b-51bcfcd10d52/`
  仅 `session.v4.jsonl.zstd`（2,451,039 B）；`findSessionLogFile(...)` → `null`；`offlineStats(...)` 全零；
  `offlineTrace(...)` → `{records: 0, gap: 0}`。
- **本次现状复算（只读）**：扫 `~/.dsh/sessions/--…-bot-workspaces-*--` 下有日志的会话目录 34 个
  → 旧名-only 8、版本化-only 26（全 v4）、两者并存 0 ⇒ **26/34 目录在旧 discovery 下不可达**。
  前序 §4「本机真实会话日志 `session.jsonl.zstd` 抽样 12 份」的口径本身即代际盲选（只挑到旧名件），
  故当时未暴露此缺陷——该行结论不撤销，但覆盖不到 v4 代际。

#### 2. 修法（符号级）

1. `lib/stats.js`
   - 新增 `SESSION_LOG_LEGACY_NAME = "session.jsonl.zstd"` 与
     `SESSION_LOG_VERSIONED_RE = /^session\.v(\d+)\.jsonl\.zstd$/`；
   - 新增 `sessionLogCandidates(dir)`（**导出**，供单测与宿主探针复用）：readdir 一次，收全部版本化名按
     **N 降序**（同 N 按文件名升序兜底确定性），旧名**垫底**（仅当目录内存在该名）；目录缺失／不可读 → `[]`；
   - `findSessionLogFile(dshHome, workspace, sessionId)`：**签名与返回语义（绝对路径／null）不变**；分片目录
     候选集构造不变；每个候选目录内按 `sessionLogCandidates` 序**先命中者胜**；
   - `offlineStats` 的 mtime/size 缓存（`diskStatsCache`）、`readSessionEventsFromFile`、`scanZstdFrames`
     **零改动**（解码行为不动；仅 discovery 换代）。
2. `lib/trace-projection.js`：**零改动**——第 30 行 import 的就是 `findSessionLogFile`，`offlineTrace` 随
   discovery 修复直接受益（下方新增 v4-only 读面用例把守）。
3. `scripts/host-contract-probe.mjs::findNewestSessionLog`：同病同修，逐 session 目录用 `sessionLogCandidates`
   枚举（多代并存时逐个按 mtime 比较），保留「最新者胜」语义。
4. `lib/host-faces.js` HF-SESSION-LOG `hostCoordinate` 文案补记版本化名（登记表与实际读面同拍；
   `adapterModule`／`probeId`／`failureMode` 不动）。

#### 3. 测试改动与实际计数

| 件 | 改动 | 计数 |
|---|---|---|
| `tests/stats.test.mjs` | 旧名多帧／撕裂尾帧／缓存稳定用例**原样保留**；新增：仅旧名时候选序、目录不存在 → `[]`、v4-only 发现并解出 2 回合（outputTokens 80）、多代并存（旧名 1／v3 2／v10 3 回合）候选序＋**v10 胜出**（turns=3／outputTokens=120） | 原 2 组断言 ＋ 新增 1 组，全绿 |
| `tests/host-contract-gate.test.mjs` P-SESSION-LOG | 旧名 PASS／空根 SKIP／坏 magic FAIL／异形行 FAIL **四例原样保留**；新增 v4-only 夹具 → `PASS` 且 coordinate 含 `sess-v4` | `node:test` 38/38 subtests |
| `tests/pod-trace.test.mjs` | 新增 `V-P4.1 读面：v4 版本化日志（代际盲区）→ BotsApi.trace 返回非空记录`：`findSessionLogFile` 命中 v4 件、`api.trace` 非空 `run_code`＋PTC 子调用 `read`、`GET /api/bots/worker/trace` 同值 | 18 → **19/19** 用例 |

未放宽任何既有断言；旧名（向后兼容）用例全部保留。

#### 4. 真实 v4 会话修复前后数字（只读，零写入）

对象：`~/.dsh/sessions/--home-beijong-.dsh-bot-workspaces-implementer--/session-e56304de-63bb-4644-a32b-51bcfcd10d52/session.v4.jsonl.zstd`
（2,451,039 B，mtime 2026-10-06 17:42:34 +08:00）

| 读面 | 修复前（`fdc587f`） | 修复后 |
|---|---|---|
| `findSessionLogFile` | `null` | `…/session.v4.jsonl.zstd` |
| `offlineStats.tokenUsage` | 全 0 | `{uncachedInputTokens: 1674417, outputTokens: 346618, cacheReadTokens: 37695023, cacheWriteTokens: 171587}` |
| `offlineStats.sessionStats` | `{turns: 0, steps: 0, llmMs: 0, toolMs: 0, …}` | `{turns: 65, steps: 349, llmMs: 4963803, toolMs: 6611185, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0}` |
| `offlineStats.contextPressure` | `{}` | `{pressureTokens: 156518, contextWindow: 262144, provider: "opencode-go", model: "deepseek-v4.1-flash"}` |
| `offlineTrace` | `records: 0, gap: 0` | `records: 284, gap: 0`；顶层名全为 `run_code`（PTC 信封）；`state` 分布 `{ok: 273, error: 11}`；`subCalls` 合计 388（最长信封 9 个）；46 个不同 `turn`；`seq` 严格递增 ✅ |
| `offlineTrace` 内层真实名（不别名化、不丢失） | —（不可达） | `bash×143, ledger.read×55, mail.send×30, evidence.probe×28, read×21, task.accept×17, task.heartbeat×15, grep×14, job_output×14, task.start×10, task.report×9, task.deliver×9, brief.refresh×5, glob×5, knowledge_search×3, knowledge.register×2, write×2, present×2, edit×2, job_list×1, job_kill×1` |

另只读抽 3 个 v4-only bot 会话：`traceRecords 0/9/5`（0 的那件仅 328 B，解出 4 条非工具事件
`session/permission/preset/sandbox/approval`，空轨迹正确，非解码失败）。

#### 5. 验证命令（本工作树实跑；`git merge integration/pod` 为 Already up to date，HEAD＝`fdc587f`）

| 命令 | 结果 |
|---|---|
| `TMPDIR=/tmp node tests/run.mjs` | **87/87 个测试文件通过** |
| `TMPDIR=/tmp node scripts/preflight.mjs` | ①回归 87/87 ✅ ②冻结面（0010 包）10/10 ✅ ③status-lint 0 违例 ✅ ④宿主契约 **15 PASS／0 FAIL／0 SKIP** ✅（`preflight: PASS`，exit 0） |
| `TMPDIR=/tmp node tests/stats.test.mjs` | 3 组断言全绿 |
| `TMPDIR=/tmp node tests/pod-trace.test.mjs` | 19/19 |
| `TMPDIR=/tmp node tests/host-contract-gate.test.mjs` | 38/38 subtests、0 fail |

#### 6. 未闭合项

- `scripts/bot-health.cjs`（`:472` 拼 `session.jsonl.zstd`、`:727` 疑似进行中判据）仍是同一代际盲区，
  v4-only 会话的健康读数失真；该件不在本返修点名面（交付 1–3 未列），且为 CJS（消费 ESM `lib/stats.js`
  需动态 import 或自带候选），留作后续票／观察项登记。
- 真机 HTTP 面（真实注册表＋现役 bot 进程）未端到端实跑；本批证据＝临时 `DSH_HOME` 夹具的读面契约测试
  ＋ 真实日志只读投影复算（与票面既有「未证声明」口径一致）。
- `?since=` 对截断日志的边界语义仍为票面已登记未闭合项（本次未动）。

### 附属修复（2026-10-09）：`scripts/bot-health.cjs` 会话日志文件名代际盲区

#### 1. 缺陷与证据

- **缺陷**：上节 §6 未闭合项点名的同一代际盲区落在本件两处：
  ① `checkBot` 会话日志项硬编码旧名 `path.join(sdir, "session.jsonl.zstd")`（返修前 `:472`）——
  v4-only 会话判「会话文件缺失」FAIL（action `a`），并连带 `repair` 的 `needReset` 误判
  （会把完好会话当缺失 → 归档）；② `isInProgress`（返修前 `:727`）同拼旧名——v4-only 会话的
  mtime 判据永不命中，「疑似进行中」保护对现役 bot 会话失效（`repair` 可归档进行中的会话）。
  `:208` docblock 也写着旧名。
- **真实面只读复验（修复前后同一命令，零写入 `~/.dsh`）**：对象 `duty-coordinator`
  （`~/.dsh/bots/bots.json` 两个注册 bot 之一，其会话目录**仅**有 `session.v4.jsonl.zstd`，
  1,710,074 B）；命令 `node scripts/bot-health.cjs check duty-coordinator --root ~/.dsh`
  （修复前用 `git show eb19fcd:scripts/bot-health.cjs` 落 `/tmp` 的 HEAD 版脚本跑）：

| 行项 | 修复前（HEAD 版脚本） | 修复后（本工作树） |
|---|---|---|
| 会话日志 | `FAIL  会话文件缺失: …/session-e21b956a-…/session.jsonl.zstd` | `OK    session.v4.jsonl.zstd：1728 条记录（614 帧），seq 单调递增` |
| 会话状态／邮局／配置 | OK（不变） | OK（不变） |
| 进程注册 | `FAIL  pid 1293 不存在（stale）` | `FAIL  pid 1293 不存在（stale）`（独立缺陷，未修） |
| 汇总 | 有 FAIL（退出码 2） | 有 FAIL（退出码 2，仅剩 stale pid） |

#### 2. 修法（脚本内同步 FS／零依赖风格，不动 `lib/stats.js`）

1. 新增常量 `SESSION_LOG_LEGACY_NAME = "session.jsonl.zstd"` 与
   `SESSION_LOG_VERSIONED_RE = /^session\.v(\d+)\.jsonl\.zstd$/`；
2. 新增 `sessionLogCandidates(dir)`：readdir 一次，全部版本化名按 **N 降序**（同 N 按文件名升序
   兜底确定性），旧名**垫底**（仅当目录内存在），目录缺失／不可读 → `[]`——**与
   `lib/stats.js::sessionLogCandidates` 同口径**，注释写明「两处实现必须同步演进」；
3. 新增 `findSessionLogInDir(dir)`：候选序**先命中者胜**，均不存在 → `null`（调用方报缺失）；
4. 两处使用点改走该 helper：`checkBot` 会话日志项（命中后证据打印**实际文件名**，如
   `session.v4.jsonl.zstd：N 条记录…`；未命中仍报「会话文件缺失」并注明候选口径）、
   `isInProgress`（mtime 取命中件）；
5. 入口改 `if (require.main === module) main();` 并
   `module.exports = { sessionLogCandidates, findSessionLogInDir, isInProgress }`——仅供测试断言
   （三符号全部只读，不触发任何 repair 动作），CLI 行为与退出码不变。

#### 3. 测试改动与实际计数

新增 `tests/bot-health-session-log.test.mjs`（临时夹具，不跑任何 repair 动作）：

| 断言组 | 内容 |
|---|---|
| ① 候选序纯逻辑 | 多代并存（旧名／v3／v10）→ N 降序＋旧名垫底；目录不存在 → `[]`／`null`；仅旧名 → 旧名；**与 `lib/stats.js::sessionLogCandidates` 逐字对拍**（防两处实现漂移） |
| ② 疑似进行中保护 | v4-only 且 mtime < 60s → `isInProgress` true；`utimesSync` 拨到 2 小时前 → false |
| ③ CLI check（v4-only） | 临时 root 真跑 `check`：退出码 0、`OK 会话日志`、**不含**「会话文件缺失」、证据含 `session.v4.jsonl.zstd：2 条记录（1 帧）` |
| ④ CLI check（多代并存） | 同目录旧名 1 帧／v3 2 帧／v10 3 帧 → 读 v10：`session.v10.jsonl.zstd：6 条记录（3 帧）` |
| ⑤ check 零写入 | 前后目录快照（相对路径＋字节数）逐项一致 |

| 命令（本工作树实跑；`git merge integration/pod` 为 fast-forward `eb19fcd`→`90adfa8`，树内容相同） | 结果 |
|---|---|
| `TMPDIR=/tmp node tests/bot-health-session-log.test.mjs` | 5 组断言全绿 |
| `TMPDIR=/tmp node tests/run.mjs` | **88/88 个测试文件通过**（87 ＋ 本新增件） |
| `TMPDIR=/tmp node scripts/preflight.mjs` | ①回归 88/88 ✅ ②冻结面（0010 包）10/10 ✅ ③status-lint 0 违例 ✅ ④宿主契约 15 PASS／0 FAIL／0 SKIP ✅（`preflight: PASS`，exit 0） |

#### 4. 未闭合项

- 真实面 `duty-coordinator` 的 **stale pid 1293** FAIL 是独立缺陷（与日志代际无关），本次未修：
  `repair` 清除 pid 属写运行面动作，按工作边界须出仓授权；复验表中原样保留。
- 候选枚举在仓内仍是**两份实现**（`lib/stats.js` 为 ESM，`bot-health.cjs` 为 CJS；后者动态 import
  会破坏「零第三方依赖全同步 FS」风格）——已由断言组①的逐字对拍把守，同步演进仍靠纪律。
- `repair` 未在真实面实跑（会写盘）：其两条判据所调用的 `checkBot` 与 `isInProgress` 均有覆盖，
  但归档动作本身无新增测试。


