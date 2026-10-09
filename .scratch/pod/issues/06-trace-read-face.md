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

