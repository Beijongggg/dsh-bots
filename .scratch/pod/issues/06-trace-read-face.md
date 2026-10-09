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
