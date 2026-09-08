# Grok Bot 0.18 与 dsh-bots 架构/代码对比报告

> 分析范围：
> - 官方运行时归档：`ChHsiching/grok-bot-0.18-original`
> - 证据驱动重组版：`b-nnett/grok-bot-0.18-reconstructed`
> - 当前工作区：`/home/beijong/project/dsh-bots`
>
> 重要边界：`original` 证明的是官方发布包中的字节和运行时 bundle，不是官方原始 monorepo；`reconstructed` 的 `source/` 是可读化重组与扩展，不应视为 Anysphere 原始源码。本文把 Grok 的官方发布事实、重组版实现和 dsh-bots 自有代码分开讨论。

## 1. 结论摘要

### 1.1 两者的根本差异

Grok Bot 0.18 的核心是一个**分层桌面运行时**：

```text
Renderer
  -> preload/contextBridge
  -> Electron main
  -> coordinator 子进程
  -> host/gateway
  -> box/local-exec/remote services
```

它通过显式的进程、RPC、MessagePort、gateway、discovery、lock 和生命周期边界，把 UI、桌面权限、Agent 协调、宿主沙箱和本地执行隔离开。

`dsh-bots` 的核心是一个**DSH host 插件 + 多个独立 DSH profile 子进程**：

```text
DSH host plugin
  -> /api/bots 管理 API
  -> spawn dsh --profile <botId>
  -> 每个 bot 进程加载同一个 lib/index.js
  -> inbox/outbox 文件邮局
  -> bot 实例内 DSH session RPC
```

它的优点是实现简单、贴近 DSH、无需额外第三方依赖；代价是 host、bot runtime、邮件协议、评审系统和文件存储之间耦合较重，且普通 Bot 数据面没有完全继承 review 数据面的强一致/安全机制。

### 1.2 dsh-bots 最值得优化的不是 UI，而是“边界一致性”

当前 dsh-bots 已经拥有相当强的评审数据平面：

- immutable artifact；
- manifest hash/byteLength；
- event hash/连续 seq/transition；
- writer epoch/fencing；
- invocation lease/heartbeat/dead-letter；
- route intent/prepare/commit/quarantine；
- HMAC capability；
- authenticated user decision；
- snapshot 和 evidence binding。

但普通 Bot 平面仍然是另一套较弱的语义：

- registry 主要是原子文件写，没有统一 lock/CAS；
- inbox `max(seq)+1` + append 存在并发竞态；
- watcher 消费位点只在内存中；
- SSE 没有 replay ledger；
- `/api/bots` 没有真正的 principal/token 认证；
- process start/stop/reconcile 不是完整 supervisor；
- profile 配置存在 registry、patch、settings、运行进程多个活源。

所以第一优先级应是：**把普通 Bot 平面提升到与 review 平面同等级的对象、锁、幂等、恢复和认证语义**，而不是继续增加更多协作功能。

### 1.3 Grok 最值得学习的是“显式边界”，不是照搬 Electron 规模

建议学习：

1. capability-oriented bridge；
2. versioned RPC frame；
3. coordinator/worker 与 host 生命周期分离；
4. generation fencing + backoff + stale-event rejection；
5. 独立 local-exec daemon 和 authenticated gateway；
6. discovery/lock/readiness/shutdown watchdog；
7. renderer baseline、reconstructed source、provenance 的分离。

不建议直接复制：

- Electron 三 MessagePort 体系到所有 dsh-bots 路径；
- Grok 的整个桌面服务组合；
- 重组版的推断性源码边界作为“官方事实”；
- 在未定义产品边界前把 read-only 扩大成全系统只读。

---

## 2. 证据等级与仓库定位

### 2.1 Grok 官方归档

仓库：[grok-bot-0.18-original](https://github.com/ChHsiching/grok-bot-0.18-original)

根据 README、`VERIFICATION.md` 和 `BN-NETT-ADDITIONS.md`：

- 官方运行时来自 Grok Bot 0.18.0 发布包；
- 13 个 runtime bundle；
- 6561 个模块切片；
- 约 2357 个 first-party modules、4204 个 third-party modules；
- runtime bundle 未压缩，保留函数名、类名、注释和 module-path 标记；
- `tools/split-bundles.mjs` 机械切分，`split-manifest.json` 记录 offset/length/declaredPath；
- 重组可 byte-for-byte 还原 bundle；
- renderer minified、没有 source map，因此官方 renderer 源码不可恢复；
- 没有 `package.json`、workspace、Electron Builder/Forge 等可直接构建原始工程所需文件。

证据强度：

| 结论 | 强度 |
|---|---|
| 官方发布包中存在这些 bundle/字节 | 高：归档和 hash 链支持 |
| runtime 的模块路径/字符串/IPC 形状 | 高到中：bundle 直接可读 |
| 原始 monorepo 的真实目录和源码边界 | 低到中：没有原始源码 |
| 作者对产品意图的解释 | 低：需与代码行为分开 |

相关文件：

- [README](https://github.com/ChHsiching/grok-bot-0.18-original/blob/main/README.md)
- [VERIFICATION.md](https://github.com/ChHsiching/grok-bot-0.18-original/blob/main/VERIFICATION.md)
- [BN-NETT-ADDITIONS.md](https://github.com/ChHsiching/grok-bot-0.18-original/blob/main/BN-NETT-ADDITIONS.md)

### 2.2 Grok 重组版

仓库：[grok-bot-0.18-reconstructed](https://github.com/b-nnett/grok-bot-0.18-reconstructed)

它增加了：

- `source/` TypeScript runtime 重排；
- `frontend/` 部分 renderer reconstruction；
- inference router；
- Claude Code/Codex/OpenRouter 等 provider 接入；
- local usage tracking；
- local Docker sandbox；
- Router UI patch；
- bootstrap/build/package/test/provenance 工具链。

`docs/ARCHITECTURE.md` 将 `source/` 定义为 editable source roots，将 upstream 0.18.0 application 定义为 external checksum-pinned build input。`PROVENANCE.md` 则要求恢复行为必须绑定到 emitted code、module marker、UI signature、RPC contract 或可重复观察。

关键边界：

> 重组版的 TypeScript 文件是“证据驱动的可读重建”，不是 Anysphere 官方源码；新增 inference router、Docker sandbox、usage tracking 和 Router renderer patch 是重组版工作。

---

## 3. 总体架构对比

### 3.1 进程拓扑

#### Grok

```text
Electron renderer
       │ contextBridge / named desktop API
       ▼
Electron main
       │ three MessageChannel legs
       ▼
node-agent-coordinator child
       │ authenticated gateway / SSE
       ▼
host process
       ├─ SandHost / agent runtime
       ├─ MCP / tools / transcript
       ├─ remote box or local Docker box
       └─ local-exec daemon / WebAuthn bridge
```

证据文件：

- `source/electron-main/main.ts`
- `source/electron-main/coordinator/coordinator-launcher.ts`
- `source/electron-main/coordinator/coordinator-runtime.ts`
- `source/electron-preload/preload.ts`
- `source/node-agent-coordinator/main.ts`
- `source/host/main.ts`
- `source/host/gateway-server.ts`

#### dsh-bots

```text
DSH web host process
  ├─ Cordis plugin apply()
  ├─ BotsApi + /api/bots
  ├─ in-memory SSE hub
  ├─ mail notification monitor
  ├─ review host pump
  └─ child process map
          │
          ├─ dsh --profile lead
          ├─ dsh --profile researcher-1
          └─ dsh --profile engineer-1
                 │
                 └─ 每个实例再次加载 dsh-bots/lib/index.js
                    ├─ inbox watcher
                    ├─ send_mail
                    ├─ knowledge tools
                    └─ review tools（按 group）
```

证据：`lib/index.js:4-41`、`:1008-1019`、`:4219-4365`。

### 3.2 关键架构差异

| 维度 | Grok Bot 0.18 | dsh-bots | 评价 |
|---|---|---|---|
| UI/桌面边界 | renderer → preload → main，窄桥 | DSH client slot + host API | dsh-bots UI 集成轻，但 API 认证必须补强 |
| Agent 协调 | 独立 coordinator 子进程 | 由 bot DSH 实例直接承担 | dsh-bots 更简单；并发、恢复和状态归属更弱 |
| Host/worker | host 与 coordinator/box/local-exec 分离 | host 与 bot 共享同一插件代码 | 共享代码降低成本，但 `lib/index.js` 条件分支耦合高 |
| RPC | versioned frame、MessagePort、cancel、typed failure | HTTP JSON `client-request` | dsh-bots 适合先加 schema/version/idempotency，不必立即换 MessagePort |
| 沙箱/执行 | local-exec daemon + gateway + path containment | DSH profile patch/permission | dsh-bots 的权限更多依赖 DSH 配置和环境，需做实际验证 |
| 状态存储 | discovery、lock、lease、event、manifest 等分工 | registry、JSONL 邮局、review store 并存 | review 强，普通面不一致 |
| 事件流 | gateway SSE、transport family、生命周期事件 | 内存 SSE + 文件轮询 | dsh-bots 缺 event id/replay |
| 部署 | bootstrap、clean graph、artifact provenance、package verify | `npm test`，手工/历史部署证据较多 | dsh-bots 缺默认部署 smoke/parity gate |

### 3.3 不要混淆 Grok、官方 DSH 与本地 dsh-bots

本次对照还参考了官方 DSH 的公开契约。官方 DSH 本身提供的是可组合的 profile/CLI/Cordis 宿主能力，而不是本地 `dsh-bots` 这套多 Bot 产品：

- profile 与插件组合属于 DSH 基础能力；
- `webServer` 是 Node HTTP route/upgrade registry，按最长前缀匹配；
- subagent 同时存在 in-process continuation 与 out-of-process seam；
- sandbox/permission preset 具有 fail-closed 语义，workspace root、per-call policy 和 OS sandbox 是不同层次；
- `dsh-bot-mode` 是独立作者的参考插件，展示了 per-bot child、continuable child、promise lock、HTTP chat 和可移除插件 wiring，但不是官方 DSH，也不是当前 `dsh-bots` 的 canonical upstream。

因此本报告中的归属口径是：

| 内容 | 归属/可信度 |
|---|---|
| Grok 官方 installer 中的 compiled bundle 字节 | original 归档可证明；高 |
| Grok 的 readable `source/` 边界 | reconstructed 推断；中 |
| Grok inference router / Docker sandbox / usage tracking | reconstructed 新增；非官方 0.18 事实 |
| DSH profile/Cordis/webServer/sandbox 契约 | 官方 DSH 公开代码/文档；高 |
| `dsh-bot-mode` 的 child/chat 设计 | 独立插件实现；可作参考，不作官方契约 |
| 当前工作区的 child profiles、JSONL、SSE、review/evidence、页面级 slots | `/home/beijong/project/dsh-bots` 本地 reconstructed/extended additions |

官方 DSH 参考：

- [DSH release tree](https://github.com/deepseek-ai/DeepSeek-Harness/tree/dsh-v0.1.1-rc.2)
- [continuation](https://github.com/deepseek-ai/DeepSeek-Harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28/packages/subagent/subagent/src/continuation.ts)
- [out-of-process subagent](https://github.com/deepseek-ai/DeepSeek-Harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28/packages/subagent/subagent/src/out-of-process.ts)
- [webServer](https://github.com/deepseek-ai/DeepSeek-Harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28/packages/host/webserver/src/index.ts)
- [permission presets](https://github.com/deepseek-ai/DeepSeek-Harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28/packages/interaction/permission-presets/src/index.ts)
- [sandbox policy](https://github.com/deepseek-ai/DeepSeek-Harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28/packages/sandbox/sandbox-policy/src/index.ts)
- [sandbox subsystem](https://github.com/deepseek-ai/DeepSeek-Harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28/docs/subsystems/sandbox.md)

独立 `dsh-bot-mode` 参考：

- [README](https://github.com/zenghaili0901/dsh-bot-mode/blob/f29ef471a84e6d6b4df43c9dae29184340e4d289/README.md)
- [implementation](https://github.com/zenghaili0901/dsh-bot-mode/blob/f29ef471a84e6d6b4df43c9dae29184340e4d289/lib/index.js)
- [package manifest](https://github.com/zenghaili0901/dsh-bot-mode/blob/f29ef471a84e6d6b4df43c9dae29184340e4d289/package.json)

---

## 4. Grok 代码中最值得学习的机制

### 4.1 capability-oriented preload bridge

Grok `source/electron-preload/preload.ts:24-41, 68-72, 220-260` 不把原始 `ipcRenderer` 暴露给 renderer，而是暴露按能力划分的对象：

- settings；
- secrets；
- attachments；
- MCP；
- window controls；
- agent/model；
- updater；
- coordinator port。

`main-edge-wiring` 还校验 IPC sender 是否为受信 BrowserWindow、是否为 main frame。

**dsh-bots 的对应问题：**

`lib/index.js:1641-1722` 直接把 `/api/bots` 的 CRUD、start/stop/send、messages/stats 和 review API 作为 prefix 路由暴露；`1647-1653` 只对明确的 `Sec-Fetch-Site: cross-site` 做 CSRF 拒绝，缺 header 时放行。

**建议迁移：**

```text
Browser client
  -> named API client methods
  -> host principal/auth middleware
  -> domain command handlers
  -> storage/process services
```

不要让 client 直接依赖任意 URL + 任意 JSON。至少建立：

- `BotReadApi`；
- `BotMutationApi`；
- `ReviewReadApi`；
- `ReviewDecisionApi`；
- 每个 mutation 的 schema、principal、request id、error code。

### 4.2 versioned RPC frame 和 cancel

Grok coordinator 使用协议版本、hello/ready/shutdown、request/cancel/reply/event，并拒绝：

- 非对象 frame；
- 缺 ID/method/args；
- 重复 in-flight request ID；
- 错误方向 frame；
- 非法 failure 字段；
- 未识别 lifecycle phase。

renderer 侧连接断开时会 reject pending promise，并请求 replacement port。

**dsh-bots 当前对应：**

`lib/index.js:1775-1791` 的 `dshRpc()` 是固定 HTTP JSON envelope：

```js
{
  type: "client-request",
  rpcId,
  method,
  payload
}
```

它没有统一的 protocol version、request deduplication、cancel、typed failure code 或 trace context。

**建议：**先保留 HTTP，增加：

```js
{
  protocol: "dsh-bots-rpc/1",
  requestId,
  clientInstanceId,
  method,
  payload,
  deadlineAt,
  idempotencyKey
}
```

响应统一为：

```js
{ ok: true, value, requestId }
{ ok: false, error: { code, message, retryable, requestId } }
```

### 4.3 generation fencing、backoff 和 stale event rejection

Grok coordinator runtime 会：

- 为每次 coordinator child 启动分配 generation；
- 拒绝旧 child 的 transport-connected/down 事件污染新 child；
- 根据退出原因和 uptime 进行 relaunch backoff；
- 新 renderer 请求到来时取消无意义的 backoff；
- dispose 旧 child 后再完成新 child 的切换。

**dsh-bots 当前对应：**

`lib/index.js:1346-1393` 用 `this.processes` Map 和 `pid` 对齐做了基础保护：退出处理器只有在 `current === entry` 或 `record.pid === entry.pid` 时才清理。这是正确方向，但还不是完整 generation：

- registry 没有 start generation；
- pending start/stop 没有持久 intent；
- spawn 后 registry 写失败只 warn，子进程继续运行，可能产生孤儿；
- host 重启只清理 stale pid，不是 supervisor 自动恢复；
- 没有按退出类型退避和 crash loop 限制。

**建议：**把 Bot runtime 状态升级为：

```text
desired: enabled/running/stopped
observed: starting/online/stopping/offline/failed
instance: generation/pid/startTicks/startedAt/port
intent: startId/stopId/createdAt
failure: code/retryAt/attempt
```

所有 child 事件必须带 generation，所有状态变更必须比较当前 generation。

### 4.4 authenticated gateway / local-exec daemon

Grok 的 `host/gateway-server.ts`、`host/main.ts`、`local-exec-daemon/*` 展现了清晰的“执行边界”：

- loopback gateway；
- bearer token；
- timing-safe token 比较；
- Host/Origin 防护；
- body/file size limit；
- readiness ping；
- process identity；
- generation token；
- path containment；
- local-exec 独立 daemon；
- SIGTERM → deadline → SIGKILL；
- discovery record 原子写入。

**dsh-bots 当前风险：**

- `lib/index.js:1313-1323` spawn 继承 `{...process.env}`；
- `lib/index.js:1775-1791` bot RPC 依赖固定 localhost 端口，但没有额外 token；
- `lib/index.js:501-522` 的 PID 识别存在读取失败放行/命令行匹配过宽问题；
- `scripts/create-bot.cjs:18-29,200-229` 和 `lib/index.js:812-900` 维护 profile 写入，但没有统一文件 mode/secret allowlist；
- review enforcement 对 workspace triple 的机械边界仍有明确“待实测”格子。

**建议迁移：**

1. 先实现 host-side per-bot loopback token，写入受保护 runtime descriptor；
2. spawn 时只传 allowlist 环境变量；
3. Bot RPC 必须提交 botId + generation + token；
4. PID 绑定 `/proc/<pid>/stat` start ticks、可执行文件 realpath 和 argv 解析；
5. full-access bot 不应自动获得 host API key、代理密钥或其他 profile secret；
6. 后续再考虑独立 `dsh-bot-runtime` supervisor/daemon。

### 4.5 local-exec 的纵深安全模型

Grok 的 local-exec 不是“允许 Agent 调 shell”这么简单，而是多层策略链：

```text
命令解析
  → admin denylist / invariant permission gate
  → effective sandbox policy
  → cwd/env/askpass/path containment
  → bounded output / spill file
  → timeout + AbortController
  → process group termination
```

从官方 bundle 机制和 reconstructed 对应源码可以归纳出几项值得学习的原则：

- `insecure_none` 是显式 bypass，其他 native isolation 不支持时 fail closed，不隐式降级；
- helper 通过 read/trusted-read/additional-root/readonly/write/network policy 构造沙箱；
- Linux socket 环境会被 scrub；policy 目录约束为 0700、文件 0600，并清理过期内容；
- 对 `.cursor`、MCP、`.claude`、`.vscode`、`.idea`、`.ssh`、Git hooks/config/worktree 等敏感路径有额外保护；
- shell 使用 abort-aware spawn，超时或取消时按进程组终止，通常 SIGTERM 后再 SIGKILL；
- read 操作有 bounded/magic/range/typed error，shell 输出有限流，大输出转移到受控的 `agent-tools/*.txt`；
- Exec RPC 采用 typed protobuf oneof + server-streaming Connect，而不是模糊的任意 JSON。

但必须保留一个部署边界：某些 reconstructed 层可见明文 `http://host:port + bearer`，TLS/暴露面取决于部署；因此“代码中有 token”不等于网络层已经安全。

**dsh-bots 当前对应：**权限主要通过 `lib/shared.cjs:17-35,72-123` 生成 DSH patch，read-only 禁用六类工具；Bot RPC 在 `lib/index.js:1775-1791` 使用 loopback HTTP JSON。当前缺少 Grok 风格的：

- 每次执行的 effective policy 计算；
- 显式 bypass 语义；
- shell 进程组取消与 descendant 清理；
- 统一 output budget / spill；
- policy helper 的敏感路径 denylist；
- authenticated runtime gateway；
- typed streaming execution protocol。

迁移建议：先不引入完整 Docker/Seatbelt，而是为 dsh-bots 增加 `ExecutionPolicy` 纯函数、每 Bot runtime token、path containment、命令/输出/时间预算和 fail-closed capability gate。只有用户显式选择危险模式时，才允许 bypass，并写入审计。

### 4.6 crash-safe shutdown 和 readiness

Grok `source/host/main.ts:298-347` 有 shutdown watchdog；host 会依次关闭 gateway、host、box daemon、discovery，超时则报告并退出。

dsh-bots 的 `stop()` 有 SIGTERM/SIGKILL 宽限（`lib/index.js:1397-1429`），但 host 级生命周期、子进程 descendant cleanup、startup readiness 和 shutdown 状态没有统一协议。

建议所有 Bot 启动必须经过：

```text
spawned
 -> identity recorded
 -> port listening
 -> DSH RPC health check
 -> ready
```

不能以 `child.once("spawn")` 直接等同于 online。

---

## 5. dsh-bots 当前代码的优势

### 5.1 profile 隔离模型简单而实用

`lib/index.js:4-20`、`scripts/create-bot.cjs:18-29` 把每个 Bot 建模为独立 DSH profile + workspace：

- 每个 Bot 可有独立模型；
- 独立角色/persona；
- 独立权限；
- 独立 session；
- 独立进程；
- 可单独启停。

这是比“一个 Agent session 里模拟多个角色”更可靠的产品边界。

### 5.2 shared.cjs 消除了配置双副本

`lib/shared.cjs:17-50,72-123,249-355` 集中维护：

- permission modes；
- read-only tool list；
- YAML quote；
- patch builder；
- llm-pi-ai section sync；
- context window resolution。

`lib/index.js` 和 `scripts/create-bot.cjs` 共同使用它，避免历史上 host/CLI 两份实现漂移。这是应该继续扩展的“单一事实源”模式。

### 5.3 邮局协议已经有基本的防回路语义

`lib/index.js:2044-2199,2216-2310` 将普通任务、`mail-response` 和 `mail-discuss` 分开：

- 普通任务可自动回信；
- `mail-response` 不再回路由，避免 ping-pong；
- `mail-discuss` 有 `DISCUSSION_MAX_ROUNDS=2`；
- review 流程误投普通邮局会先拒绝，不触发 Agent。

这说明 dsh-bots 已经具备“协议消息”和“普通业务消息”分离的意识。

### 5.4 mail monitor 的边界处理比普通 mailbox 写入更成熟

`lib/index.js:2723-2842` 和对应测试覆盖：

- 首见静默基线；
- inbox seq 增量；
- outbox 文件/行数 diff；
- own send 精确 seq 抑制；
- 瞬态读失败不重置基线；
- 文件截断/删除重置；
- 删除后同 id 重建重新首见。

`lib/index.js:2589-2682` 的 inbox watcher 还处理了 offset、pending 半行、UTF-8 多字节和 busy guard。

但要注意：**读取/通知侧处理得好，不等于写入/消费侧已经具备 crash-safe at-least-once。**

### 5.5 review store 是可复用的强一致基座

`lib/review-store.js:94-136,205-340,368-485,678-703,855-1022` 展示了当前最成熟的本地实现：

- tmp + fsync + rename + directory fsync；
- `O_APPEND` 行级追加；
- manifest/body hash；
- event seq/hash/合法 transition；
- lock owner + PID/start identity；
- epoch fencing；
- reservation/recovery/quarantine。

普通 registry、mailbox、knowledge、review flow 应该从这里抽象共享能力，而不是继续各自复制一套文件语义。

---

## 6. dsh-bots 当前的关键问题

以下按优先级排序。这里的“问题”分为确定性代码缺陷、结构性风险和待实测边界，不能混为一谈。

### P0：必须先处理

#### P0-1 普通 Bot API 没有真正认证

证据：`lib/index.js:1641-1653,1666-1710`。

当前：

- `/api/bots` 直接提供 list/create/patch/delete/start/stop/send/messages/stats；
- CSRF 只看 `Sec-Fetch-Site: cross-site`；
- 缺 header 时放行；
- 没有 token/session/principal；
- localhost 只限制网络位置，不限制同机其他进程/用户态脚本。

影响：如果服务被反代、监听边界变化、浏览器 header 缺失或同机存在恶意进程，攻击面包括：

- 删除 Bot；
- 启动任意 profile；
- 修改模型/persona/权限；
- 向 Bot 注入任务；
- 读取对话、stats、review 内容。

建议：

- 写 API 强制 host principal + 短期 CSRF token；
- GET 也按敏感数据权限处理；
- Origin/Host/Sec-Fetch-* 作为辅助信号，不能作为唯一认证；
- 统一错误码，避免把原始内部错误返回 HTTP body。

#### P0-2 `advanceFixFlow` 的用户授权边界需要重新闭合

审查发现：`lib/review-flow.js:314-364` 的复检推进逻辑需要机械绑定：

```text
已发布 final result
 + user-facing route committed
 + authenticated user decision(choice=authorize-repair)
 + decision revision
 + finding subset
 + sourceSnapshot/task/cycle
 + fix-report
 -> recheck invocation
```

如果只凭 fix-report 或调用方参数推进复检，就会把“编码方报告已提交”误当成“用户授权了修复”。

建议把 admission、decision、repairCycle、fix-report 和 snapshot 的核验放在同一 lock/CAS 窗口，并为非法路径留下 audit。

#### P0-3 job capability 必须绑定 claim generation/lease nonce

当前 capability 虽有 HMAC、bot identity 和 operation，但审查发现 job heartbeat/report 主要按 jobId/host/bot 校验，未始终绑定当前 claim generation。

风险：旧 worker 的 token 可能在新一轮 claim 后继续 heartbeat/report，污染新 attempt。

建议 capability payload 强制包含：

```text
task/job id
claim generation
lease nonce
hostInstanceId
botId
operation
expiry
```

在锁内精确比较 lease 三元组，并补 generation replay、跨代提交、旧 token heartbeat 测试。

#### P0-4 普通 inbox 写入存在 seq 竞态

证据：`lib/index.js:550-594`。

当前语义是：

```text
nextSeq = read max(seq) + 1
append message
```

多个 host/bot/测试进程同时写同一 inbox 时可能：

- 分配相同 seq；
- 同 seq 多条消息；
- watcher 以 `seq > lastSeq` 过滤时永久跳过后写消息。

建议：

- 短期：per-inbox lock + `O_APPEND` + 单次 write/fsync；
- 消息使用不可猜测 `messageId`，seq 只用于排序；
- watcher 消费按 messageId/receipt，而不是只按 seq；
- 补 4~8 进程真并发测试。

#### P0-5 当前部署证据存在盘面冲突，不能以历史关闭文档替代

`artifacts/c2-sync-preparation.json:1-17,19-160` 记录：

```text
status = prepared-not-executed
checked = 8
identical = 0
hashDiff = 2
missingInDeploy = 6
postSync = null
deploySideNodeCheck = null
```

这与 `CHANGELOG.md`、`PLAN-expanded-engineering.md` 中关于 P7-5/部署平价已关闭的历史叙述不能自动等同。`artifacts/review-evidence-package.json:10-18` 的 `deploymentOrRestartNeeded=false` 也不能替代当前盘面 hash 和部署侧语法/进程检查。

上线前必须：

1. 只读 parity；
2. 明确授权后再同步；
3. 逐文件 hash/byteLength；
4. deploy-side `node --check`；
5. 真实进程 PID/start time；
6. 重启后的行为和路径验证。

#### P0-6 修复确定性协议缺陷

审查发现两个高影响问题，且第一项应拆成两个故障面：

1. **reviewCycle/cycle 传递缺失导致主链 delta 永久阻断。** `createLeadInvocation` 接收 `cycle`，但内部创建 invocation 时没有继续传递 `reviewCycle/cycle`（`lib/review-flow.js:159-171`）；因此 `advanceMainFlow(reviewCycle=4)` 产生的 delta/final invocation 仍默认 `reviewCycle=1`（`lib/review-flow.js:204-212,254-265`）。完成处理按 `manifest.reviewCycle` 推进时触发 `review-cycle-mismatch`（`lib/index.js:3180-3187`），而该 outcome 不在 `COMPLETED_FAILURE_STEPS`（`lib/index.js:3313-3318`），随后 `completeOnce` 仍可能写入 `handled.json`（`:3321-3333`），造成流程永久停滞且不再重试。
2. **discussion invocation 丢失 cycle 导致 bridge 断链。** `openDiscussion()` 创建 discussion invocation 时没有显式传递 `reviewCycle/cycle`（`lib/review-discussion.js:182-198`），`createInvocation()` 默认为 1（`lib/review-orchestrator.js:306-327`）。host bridge 又把数字 `manifest.reviewCycle` 当作 thread `cycleId`（`lib/index.js:3191-3204`）；主链实际 thread 可能位于 `4-thread`，复检 thread 可能位于 `repair-2-*`，最终却按错误 cycle 查找。现有 `tests/review-main-flow.test.mjs:111-140,169-227` 主要绕过真实 host handler/pump，未钉住该路径。
3. **review body 的前后端 content-type 不匹配。** body endpoint 返回 Markdown/text（`lib/index.js:3484-3497`），而 `lib/client.js:655-685` 的通用 helper 按 JSON 解析，合法正文会失败。应增加 `apiText()`，并增加真实 response 测试。

修复要求：

- 不再用无类型的 `cycleId` 同时表达数字 review cycle、repair cycle 和字符串 thread id；
- 显式传递并保存 `reviewCycle`、`repairCycle`、`threadId`；
- completed 失败时不得写永久 handled marker，handled 需区分 retryable/terminal；
- 增加 `initial(cycle=4) → delta → discussion → final` 和 `repairCycle=2` 的真实 host pump 集成测试。

### P1：生产可靠性和架构债务

#### P1-1 普通 watcher 不是持久 at-least-once

证据：`lib/index.js:2575-2682`。

- 启动时把 `lastSeq` 初始化为当前最大值，故存量不回放；
- `lastSeq` 只在内存；
- agent 回合、outbox 写入、消费位点推进不是一个可恢复事务；
- 崩溃窗口可能重复或漏处理。

建议建立：

```text
inbox/<bot>/messages.jsonl
inbox/<bot>/receipts/<messageId>.json
inbox/<bot>/responses/<messageId>.json
```

状态：`pending → processing → completed/failed/dead-letter`。回复以 messageId 幂等。

#### P1-2 registry/process lifecycle 不是完整 supervisor

证据：`lib/index.js:1038-1051,1291-1429`。

问题包括：

- spawn 成功后 registry 写失败只 warn，child 不停止；
- stale PID 清理与真实 instance identity 不完全统一；
- host 重启不自动恢复 enabled bot；
- 无 restart backoff/crash-loop guard；
- `child spawn` 不是 DSH port ready。

建议引入 `BotSupervisor`，将 registry 的 desired state 与运行时 observed state 分离，并采用 generation + readiness + backoff。

#### P1-3 flow/discussion/results 多处没有统一 CAS/事务

证据：

- `lib/review-flow.js:72-75,136-149,204-215,331-364,371-475`；
- `lib/review-discussion.js:150-223,244-330`；
- `lib/review-results.js:100-104,108-182,335-393`。

风险：

- 并发创建双 thread；
- invocation 已落盘但 flow 指针未更新；
- body 已复制但 result index 未登记；
- decision 检查后 route 被隔离/改变；
- JSONL read-modify-write 丢行。

建议统一为 per-task/cycle lock + revision/CAS + intent/prepare/commit marker + reconcile/quarantine。

#### P1-4 SSE 事件不可重放

证据：`lib/index.js:1591-1638`、`lib/client.js:3005-3107`。

当前：

- 内存 subscriber；
- heartbeat 和浏览器自动重连；
- 无 event id；
- 无 Last-Event-ID；
- 无持久 event ledger。

bots 状态可通过重新拉列表恢复，但 mail/review 通知在断线期间会丢。

建议：

- 每帧增加单调 eventId；
- host 持久化轻量通知 ledger；
- 支持 `Last-Event-ID`；
- 对 mail/review 采用 cursor/ack；
- 只保留有限窗口，避免把 SSE 变成无限日志。

#### P1-5 环境变量和路径边界不足

证据：`lib/index.js:1313-1323`、`lib/index.js:1938-2017`、`scripts/create-bot.cjs:182-205`。

问题：

- Bot spawn 继承完整 `process.env`；
- sessionId 用于路径定位/移动时需要更严格 safe ID/realpath；
- PID 读取失败时不能当作安全通过；
- profile/settings/workspace 文件 mode 未统一固定；
- HTTP/JSONL/审计/error 文本预算不完整。

建议：

- env allowlist；
- secret broker，不把 API key 复制到 Bot profile；
- 所有 logical ID 在最低层统一校验；
- `resolve/isInside/lstat/O_NOFOLLOW` 或可用时 fd-relative 访问；
- 明确 `0600/0700` 文件目录策略；
- 读失败区分 missing/corrupt/transient，并审计关键损坏。

#### P1-6 knowledge register 的 orphan recovery

`lib/knowledge.js:239-312` 先写报告，再写 index。若报告写成功、索引写失败，可能留下 orphan report。

建议：

```text
report.tmp
 + index reservation
 -> report durable
 -> index commit
 -> rename/marker
```

启动或显式 reconcile 时扫描 orphan，保留、重连或隔离，不静默删除。

#### P1-7 engineering workspaceRoot 接线必须闭包

审查发现 engineering job 注册/调用链没有始终把真实 bot workspaceRoot 传到 report/preflight，部分路径可能落到宿主 `process.cwd()`。

必须验证并固定：

```text
registry.workspace
 = bot profile session cwd
 = job workspaceRoot
 = scope validation root
 = actual spawn cwd
```

任何缺失都应拒绝，而不是隐式回退。

### P2：可维护性与产品质量

#### P2-1 拆分 `lib/index.js`

当前约 4450 行，承载：

- registry；
- HTTP；
- process lifecycle；
- DSH RPC；
- agent turn；
- mail watcher；
- mail notification；
- knowledge tools；
- team prompt；
- review host pump；
- review API wiring。

建议目标：

```text
lib/domain/registry.js
lib/domain/process-supervisor.js
lib/domain/mailbox.js
lib/domain/mail-worker.js
lib/domain/events.js
lib/domain/http-api.js
lib/domain/review-host.js
lib/domain/knowledge-tools.js
lib/runtime/dsh-rpc.js
lib/storage/file-store.js
```

`lib/index.js` 只保留 Cordis apply 和组合根。

#### P2-2 统一 storage abstraction

现在 review-store、knowledge、registry、mailbox 各有自己的写入/损坏/锁语义。应抽象：

- `safeLogicalId`；
- `writeDurable`；
- `appendLine`；
- `acquireLock`；
- `readStrict/readTolerant`；
- `quarantine`；
- `revision/CAS`；
- `reconcile`。

然后按数据面声明策略，而不是复制实现。

#### P2-3 共享 HTTP contract，修复 client/server 漂移

`lib/client.js` 是 `window.__ModuleLoader__` bundle，无法直接共享普通 TypeScript 类型；review body bug 就是典型结果。

短期至少维护一份纯 JSON schema/contract：

- endpoint；
- method；
- request body；
- response content type；
- error shape；
- retryability。

中期生成 client helper 和 server validator。

#### P2-4 stats projection 版本化

`lib/stats.js:1-18,200-345` 是从官方 DSH event/persistence 行为移植的 projection，并支持 zstd 多帧和 mtime/size cache。这是好实现，但上游 event schema 改变时有维护债。

建议：

- event schema version adapter；
- golden session fixtures；
- official projection 可用时优先复用；
- cache key 加 schema/provider/model version。

#### P2-5 明确 read-only 的语义

`lib/shared.cjs:17-35,92-109` 的 read-only 主要禁止 workspace 写/执行工具；但 Bot 仍可使用 `send_mail`、`knowledge_register` 等插件工具写共享邮局/知识库。

必须在 UI、文档和 API 中明确是：

- workspace read-only；还是
- 全系统副作用 read-only。

如果是后者，需要工具注册层 capability gating；如果是前者，名称应改为更准确的 workspace permission。

---

## 6.4 Review / evidence / sentinel 深度审计增补

本节整合后续复核发现的 F-01～F-20。性质分为：**确定性代码缺陷**（可由代码路径直接推导，应立即修复并加回归）、**结构性风险**（当前缺少机械约束，需 E2E/故障注入确认利用条件）、**待实测边界**（不能把源码声明当成 OS/部署级保证）。

### P0：当前最高优先级门禁

1. **Provenance 回归当前为红态。** 最新直接复跑是 `npm test` exit 1、42/44；失败集中在 `tests/evidence-packager.test.mjs` 与 `tests/sentinel-provenance.test.mjs`，实现已进入 `p6-5-probe-raw/2` 与完整 source/raw/capture hash contract，而部分测试仍按 `/1` 和旧 claim contract 断言。证据：`lib/sentinel-provenance.js:21-25,269-365,377-427`、`tests/sentinel-provenance.test.mjs:88-116,171-181,185-289,298-337`、`tests/evidence-packager.test.mjs:199-208`。此前 44/44 只能标为早先/不同环境观测；在实现/测试契约统一前，不能称全绿。
2. **completed 失败可能被 `handled.json` 永久吞掉。** `lib/index.js:3211-3232,3254-3273,3313-3333` 的失败集合未完整覆盖 `final-register-rejected`、`final-publish-failed`、`recheck-final-register-rejected`、`recheck-final-publish-failed` 等可恢复失败；失败后仍可能写 handled marker，下一 tick 跳过，破坏 route/publish retry。handled 应只有在全部必要副作用完成后提交，并持久记录 `attempt/errorCode/nextRetryAt`。
3. **handled 旁路不能防多 host 重复处理。** `lib/index.js:3298-3300,3319-3329,3349-3355` 的 `inflight` 仅进程内，handled 缺 schema/hash/invocation event 绑定；`apply` 可在多个 host 中启动 watcher（`:3416-3437,4321-4327`）。应改为 completed event → host claim(epoch+lease) → side effects → durable handled event，并加 host-instance fencing。
4. **主链非默认 reviewCycle 会在 delta 首步阻断。** `createLeadInvocation` 在 `lib/review-flow.js:159-171` 接收 `cycle` 但未传给 `createInvocation`；`advanceMainFlow` 的 cycle=4 因而创建 reviewCycle=1（`:204-212,254-265`），完成处理按 manifest 推进时触发 `review-cycle-mismatch`（`lib/index.js:3180-3187`）。该 outcome 未完整纳入 failure steps，随后 handled 可能落盘，流程永久停滞。
5. **discussion invocation 丢 cycle 会造成 bridge 断链。** `openDiscussion` 的 invocation 创建（`lib/review-discussion.js:182-198`）漏传 reviewCycle/cycle，`createInvocation` 默认为 1；host bridge 又以数字 `manifest.reviewCycle` 作为 thread `cycleId`（`lib/index.js:3189-3204`）。真实 thread 可能在 `4-thread` 或 `repair-2-*`，却按错误 cycle 查找。必须显式区分 `reviewCycle`、`repairCycle`、`threadId`，并用 cycle=4/repairCycle=2 的真实 host pump 测试覆盖。
6. **job capability 未始终绑定 claim generation/lease nonce。** 旧 worker token 可能在同一 job 新一轮 claim 后继续 heartbeat/report。payload 应强制包含 `jobId + claimGeneration + leaseNonce + botId + hostInstanceId + operation + expiry`，在锁内精确比较当前 lease，并增加跨代 replay 测试。
7. **flow 入口和产物关联存在 provenance 绕过。** `createInvocation` 强制 snapshot（`lib/review-orchestrator.js:334-350`），但 `registerInitial` 可传 `sourceSnapshotId=null`（`lib/review-flow.js:124-149`）；`registerFinal/registerRecheckFinal` 只确认 final invocation 存在，不确认 `artifactId === invocation.outputArtifactId`（`:283-307,452-475`）。普通 completed artifact 和 discussion R1/R2 也未始终传/校验 `sourceSnapshotId`（`lib/index.js:3141-3147`、`lib/review-discussion.js:168-174,281-287`）。应让 task/cycle/snapshot/parent artifact hash/actor/stage 形成闭合 provenance graph。
8. **completed output handler 必须二次验证。** `lib/index.js:3117-3139` 不能把 completed event 的 `outputArtifactId` 当作正文可信来源；需重新核验 manifest、task/stage/author/snapshot、body hash/byteLength 和 outputHash。
9. **engineering workspaceRoot 未形成端到端闭包。** `lib/index.js:3772-3783,3901-3904,3926-3929`、`lib/review-jobs.js:499-516,525-527,572-580` 的 report/preflight 可能落到宿主 `process.cwd()`。必须机械保证 `registry.workspace = session cwd = job.workspaceRoot = scope root = spawn cwd`，缺一即拒绝。
10. **任意 hanging runner 可能永久占用 invocation。** `lib/review-orchestrator.js:615-637` 缺编排器级 watchdog，配合 `lib/index.js:3290-3333,3349-3355` 的 inflight 标记可能永久卡住。runner 必须有硬 deadline、lease expiry、host reclaim 和 dead-letter。

### P1：数据一致性、权限与证据边界

11. **flow JSON 浅校验且无 CAS。** `lib/review-flow.js:55-75,124-149,178-280,314-476` 只检查 JSON/object/taskId；`lib/review-protocol.js:150-183` 直接解引用关键字段。应加入 exact schema、schemaVersion、revision、writer epoch 和 per-task lock/CAS。
12. **job metadata/events 可信性不足。** `lib/review-jobs.js:103-157` 直接读 JSON，事件部分采用 read-whole/rewrite，缺 event hash/writer epoch/O_APPEND；同一 OS 用户可篡改 scope/findings/status，或并发丢事件。应改 immutable creation manifest + append-only event ledger，状态仅由合法事件 fold 派生。
13. **flow/discussion/results 多对象部分提交。** `lib/review-flow.js:282-307`、`lib/review-discussion.js:168-225`、`lib/review-results.js:100-182` 存在 invocation 已建但 flow 指针未写、body 已复制但 index 未登记、thread 已写但 route 未提交等窗口。`publishResult` 自身也未强制 user-facing route committed（`lib/review-results.js:108-182`），虽正常 production flow/API 读面已有上层/二次 gate；建议同锁 admission、intent/prepare/commit、CAS、reconcile。
14. **publishResult 的调用边界缺纵深防御。** 它应直接读取并验证 user-facing route 的 `committed` 状态，并在同锁域内避免 route check 后被 quarantine 的 TOCTOU。这里是调用边界缺口，不应夸大为正常 flow 必然绕过。
15. **writeUserDecision 需绑定当前 flow 的 final artifact。** `lib/review-results.js:335-357`、`lib/index.js:3648-3687` 应确认 decision 的 artifact 是当前 `finalArtifactId/recheckFinalArtifactId`，否则多 cycle 历史 final 可能被用于授权当前 snapshot；现有 `tests/review-results-api.test.mjs:158-167` 未覆盖该反例。
16. **普通 mailbox 仍有 seq 和消费竞态。** `lib/index.js:550-594` 是 max(seq)+1 后 append，无跨进程锁；watcher `:2641-2647` 按 seq 过滤，撞 seq 会永久跳过。`lastSeq` 只在内存、启动还主动跳过存量（`:2575-2602`），不具 crash-safe at-least-once。建议 per-inbox lock/O_APPEND/fsync、messageId、durable receipt、幂等 response。
17. **sourceRoot intake 权限过宽（候选高风险）。** `lib/index.js:3544-3594`、`lib/review-intake.js:28-59` 只验证 realpath/目录，`lib/review-evidence.js:259-299` 递归复制可读文件；已认证 user 可指定任意本地目录，把敏感文件固化到 DSH_HOME。应限制授权项目根、文件模式和总字节数，并明确 symlink 策略。该项需结合部署权限实测。
18. **evidence capability 存在窄 TOCTOU（候选）。** 签发/anchor 扫描/nonce check 非同一受保护快照：`lib/index.js:4015-4050,4092-4103`、`lib/review-capability.js:615-638`。建议锁内二次核验当前 claim/generation；应标为候选而非已确认利用链。
19. **snapshot/shadow 仍缺完整文件边界证明（候选）。** `lib/review-evidence.js:312-322` 应读时重核 tree hash；`lib/review-enforcement.js:210-260,358-362` 依赖调用方传入 shadowRoot，尚无 fd-relative/openat/O_NOFOLLOW 或 inode/realpath 二次确认。
20. **revoke crash resurrection。** `lib/review-capability.js:493-520` 先删 active 再写 revoked ledger，崩溃时 reconcile（`:299-353`）可能按 last issued 复活已吊销 token；应 revoked durable first，reconcile 以 revoked 优先。
21. **quarantined route 缺审计恢复路径。** `lib/review-relay.js:423-432` 的 reset 不能处理 quarantine。应提供显式 reopen/supersede，新 generation 建新 intent，旧对象保持不可变。
22. **sentinel/evidence 校验还有边界风险。** `lib/sentinel-runner.js:280-292` 主要按 synthetic 顶层 prefix 判断，可能放过批准目录内 `dsh-home/evil`、`project/extra`；应按完整相对路径匹配并加 nested additions 负测。`lib/evidence-packager.js:112-193`、`lib/sentinel-provenance.js:131-199,339-404` 还应补 rawBinding 实际路径/hash、registry claim/终态、relative containment、NaN/invalid timing、rawPath/rawBytes 盘面复核。部分属于需实测的候选风险。
23. **migration 不是 durable transaction。** `lib/review-migration.js:112-191` 仍使用普通 `writeFileSync`；应备份、durable write、commit marker、rollback/reconcile。
24. **资源、路径和错误处理债务。** 多个 store/relay/invocation path helper 未统一 safe-ID/resolve/isInside/symlink 检查；HTTP、envelope、snapshot、JSONL、scoped search 缺总预算；stderr、HTTP 500、agent error 可能泄漏内部信息；profile/settings/workspace 未统一 0600/0700。
25. **普通进程生命周期仍不是 supervisor。** `lib/index.js:1038-1051,1291-1429` 缺 readiness、generation、backoff、crash-loop guard；spawn 后 registry 持久化失败可能留下孤儿（`:1346-1365`）；`enabled=false` 只阻止新 start，不自动停止已有 child（`:1214-1216,1291-1297`）。
26. **SSE 无 replay/backpressure。** `lib/index.js:1594-1638` 没有 event id/Last-Event-ID/replay ledger，`res.write=false` 也不处理慢连接；mail/review 断线会丢通知。建议有限事件窗口、cursor、ack、drain 和队列上限。
27. **knowledge register 有 orphan 风险。** `lib/knowledge.js:239-312` 先写报告再写 index，index 失败会留下无索引正文；应 reservation/commit marker/reconcile。stale lock 只有 mtime、无 heartbeat，需明确暂停/接管边界。
28. **stats 与上游 schema 有维护债。** `lib/stats.js:1-18,200-345` 手工移植 projection，需 schema adapter/golden fixtures/cache version；`lib/index.js:1481-1503` 在线 history 仅取有限窗口。

### 测试与验证补充

应增加并纳入默认门禁的场景：

- `cycle=4`/`repairCycle=2` 的真实 intake→pump→discussion→final；
- completed 失败后不写 completed handled、下一 tick 可重试；多 host claim/fencing；
- final artifact 与 invocation output 绑定、当前 flow snapshot 绑定、decision artifact 绑定；
- 4/8 进程 mailbox seq 并发、崩溃后 receipt/response 幂等；
- job metadata tamper、event ledger 并发、generation replay、revoke crash；
- nested sentinel additions、evidence-runner 全链 layout digest、raw/capture/registry provenance；
- API auth、Markdown text response、真实 SSE socket/backpressure/replay；
- create-bot、bot-health、真实 profile/端口/RPC/mail watcher/descendant cleanup；
- session traversal、symlink/hardlink、sourceRoot allowlist、超大输入和脱敏；
- repo/deploy parity、deploy-side `node --check`、真实 PID/start time、重启行为。

注意：`review_probe timeoutMs` **不是缺陷**；`lib/review-evidence.js:414-424,438-440` 已提供默认值和上限校验。

---

## 7. 建议的目标架构

### 7.1 保留当前 profile 模型，但拆出控制面和数据面

```text
DSH host / Bot Control Plane
  ├─ authenticated HTTP API
  ├─ BotSupervisor
  ├─ RegistryStore
  ├─ EventLedger/SSE replay
  ├─ MailboxStore
  └─ ReviewHostPump

Per-bot DSH process
  ├─ BotRuntime identity
  ├─ DSH session RPC client
  ├─ Mail worker
  ├─ capability-scoped tools
  └─ heartbeat/readiness endpoint

Shared durable store
  ├─ bots registry
  ├─ mailbox messages + receipts
  ├─ review objects
  ├─ knowledge index
  └─ audit/quarantine
```

### 7.2 控制面与 Bot 工具的写入原则

最稳妥的长期方案不是让每个 bot 进程随意直接写所有共享文件，而是：

```text
Bot tool
  -> authenticated host command
  -> host-side serialized store mutation
  -> durable event/receipt
  -> event notification
```

如果为了低依赖暂时保留 bot 直接写文件，也必须：

- 每个数据面有明确 writer ownership；
- 所有消息有 UUID；
- 所有写入 O_APPEND/锁/单次 fsync；
- 所有消费有 durable receipt；
- 所有跨文件流程有 reconcile。

### 7.3 评审对象统一 provenance graph

建议把下列边都作为可验证引用保存：

```text
task-spec
  -> sourceSnapshot
  -> initial invocation
  -> reviewer artifact
  -> flow
  -> user-facing route
  -> final result
  -> authenticated decision
  -> engineering job
  -> fix-report
  -> recheck invocation
```

每条边至少绑定：

```text
taskId
reviewCycle/repairCycle
sourceSnapshotId
parent artifact hash
actor/botId
writer epoch or capability
```

当前 review-store 已经拥有大量基础能力，主要工作是补齐普通 flow/results/job 边界的统一 admission 和 CAS。

---

## 8. 分阶段实施路线图

### 阶段 0：事实和部署基线

目标：不引入新功能，先消除“代码/测试/部署盘面”歧义。

1. 固定 Node/npm/TMPDIR/工作树；保存完整 `npm test` 原始日志；
2. 当前最新直接复跑为 `42/44`、exit 1，失败集中在 `evidence-packager.test.mjs` 与 `sentinel-provenance.test.mjs`；早先曾观测 `44/44`、exit 0，应记录为环境/工作树时序不一致信号，不能作为当前稳定基线；
3. 修复 sentinel/evidence 测试与实现的 schema drift；
4. 修复 `--out-root` 到 registry 的完整隔离传递；
5. 对部署目录做只读 parity 和 deploy-side node check；
6. 将当前状态拆为机器可读的 `repoStatus/deployStatus/testStatus`，减少历史文档互相覆盖。

验收：测试结果稳定可复现，repo/deploy 每个受管文件有 hash/byteLength/node-check 结果。

### 阶段 1：P0 安全和确定性

1. `/api/bots` principal/token/CSRF；
2. `advanceFixFlow` authenticated decision admission；
3. job capability 绑定 generation/lease nonce；
4. 修复 discussion cycle 传参；
5. 增加 markdown/text API client；
6. 普通 mailbox per-inbox lock、messageId、receipt、幂等回复；
7. env allowlist、PID start identity、文件 mode。

验收：攻击/重放/并发/崩溃 fixture 全部进入回归套件。

### 阶段 2：Supervisor 和 durable event

1. `BotSupervisor`；
2. readiness probe；
3. generation fencing；
4. start/stop pending intent；
5. crash loop/backoff；
6. descendant cleanup；
7. SSE event id/replay/cursor。

验收：host 重启、Bot crash、端口冲突、PID reuse、stop/start race 可重复恢复。

### 阶段 3：存储统一和模块拆分

1. `file-store` 公共 durable/lock/CAS/quarantine；
2. registry/mail/knowledge/review 迁移；
3. `lib/index.js` 拆为组合根；
4. HTTP schema 生成/验证；
5. review provenance graph 闭包。

验收：普通数据面与 review 数据面共享同一组存储语义，跨模块变更有明确接口。

### 阶段 4：Grok 风格的可观测和执行隔离

1. per-bot authenticated runtime descriptor；
2. Bot RPC trace/request id；
3. health/readiness/liveness；
4. local-exec capability boundary；
5. structured lifecycle audit；
6. usage/stats golden fixtures。

验收：一次用户操作可以从 UI request 追踪到 host、bot process、session turn、mail/review artifact 和最终事件。

### 阶段 5：产品增强

在前述基础稳定后再考虑：

- 更丰富的 provider router；
- Bot 资源配额；
- knowledge 全文索引；
- 任务依赖图；
- 多层通知策略；
- reviewer/engineering 自动调度。

---

## 9. 测试矩阵建议

当前 `package.json:8` 只有 `npm test`，`tests/run.mjs:7-25` 顺序 spawn 测试文件。现有 44 个测试文件覆盖面很广，但不能替代生产 E2E。

建议新增以下矩阵：

| 类别 | 必测场景 |
|---|---|
| API auth | 缺 token、错误 token、跨站、同机脚本、GET 敏感数据 |
| mailbox write | 4/8 进程同 inbox 并发、seq collision、messageId 去重 |
| mailbox consume | agent 完成前崩溃、outbox 已写后崩溃、重启重放、dead-letter |
| process | spawn readiness、port occupied、PID reuse、child exit race、descendant kill |
| supervisor | host restart、enabled recovery、backoff、crash loop、stale generation event |
| review | cycle != 1 discussion、flow CAS、results race、route TOCTOU、decision replay |
| capability | generation replay、expired token、revoke crash resurrection |
| filesystem | symlink、hardlink、session traversal、权限 mode、超大输入 |
| SSE | disconnect/reconnect、Last-Event-ID、mail/review replay、duplicate suppression |
| frontend | markdown response、slot mount/dispose、locale switch、SSE state transition |
| deployment | repo/deploy hash、deploy-side syntax、real process identity、restart behavior |
| provenance | source snapshot mutation、artifact mismatch、evidence output isolation |

---

## 10. 最终判断

### dsh-bots 应保持的方向

- 独立 profile/独立进程；
- Bot 角色、模型、权限和 workspace 显式配置；
- DSH 原生 UI slot/design token/locale 集成；
- 邮件协作和 review 流程分离；
- review artifact 的不可变、可审计、可隔离设计；
- knowledge MVP 的克制边界。

### dsh-bots 应立即改变的方向

- 普通 API 从“本机 + CSRF hint”升级到真正认证；
- 普通 mailbox 从“文件追加 + 内存游标”升级到 messageId/receipt/lock/reconcile；
- Bot process 从“spawn + pid”升级到 generation/readiness/supervisor；
- review flow/results/jobs 从分散检查升级到同锁/CAS/provenance 闭包；
- client/server 从字符串约定升级到共享 contract；
- 代码从单体 `lib/index.js` 组合根演进为 domain modules。

### 一句话总结

> Grok Bot 0.18 最强的地方是把“桌面 UI、Agent 协调、宿主、沙箱、执行和升级”做成显式可验证的边界；dsh-bots 最强的地方是用很少的代码把 DSH profile 变成可通信的 Bot 团队。下一阶段的关键，不是让 dsh-bots 变得像 Grok 一样庞大，而是把 Grok 的边界、协议、生命周期和恢复思想，迁移到 dsh-bots 当前已经存在的 registry/mail/review 数据面中。

---

## 11. 本报告的使用边界与下一步决策

### 11.1 当前不能宣称的事项

1. 不能把 Grok reconstructed 的 `source/` 当成官方原始源码；
2. 不能把 `dsh-bots` 本地 reconstructed additions 当成官方 DSH 或 Grok 的既有能力；
3. 不能把 review-store 的底层 durable/hash/lock 能力外推为整个 review 高层流程已经具备事务性；
4. 不能把 `P6-5` 的限定式 real-sentinel 关闭外推为完整 TOCTOU、raw provenance 或 evidence package 安全证明；
5. 不能把测试 fixture 全绿等同真实 DSH profile、端口、RPC、SSE、浏览器 UI 和部署运行面全绿；
6. 不能用历史 CHANGELOG/PLAN 的“平价关闭”覆盖当前 `c2-sync-preparation` 的 `prepared-not-executed` 与 `2 hashDiff + 6 missing` 盘面。

### 11.2 推荐立即执行的前三个工作包

**工作包 A：恢复可验证基线**

- 统一 `/1` 与 `/2` provenance/claim/ledger schema；
- 使 `npm test` 在固定 Node/npm/TMPDIR/工作树下稳定可复现；
- 修复 evidence-runner 的 `layoutManifest` / `layoutManifestDigest` 接线并增加全链 E2E；
- 对 repo/deploy 做只读 parity，授权后再同步，逐文件 hash、`node --check`、PID/start-time 和重启核验。

**工作包 B：修复评审生产接线**

- 先修非默认 cycle 的 delta 和 discussion 传递；
- 修复 completed failure 的 handled 状态机和 hanging runner watchdog；
- 补 final artifact↔invocation output、snapshot provenance、decision↔current flow 绑定；
- 将 flow/job/results/handled 迁移到统一 per-task/cycle lock + revision/CAS + reconcile。

**工作包 C：建立普通 Bot 生产边界**

- `/api/bots` principal/token/CSRF；
- mailbox messageId + writer lock + durable receipt；
- BotSupervisor 的 readiness/generation/backoff/descendant cleanup；
- env allowlist、PID start identity、workspaceRoot 闭包、0600/0700；
- SSE event cursor/replay/backpressure；
- client/server JSON/text contract。

### 11.3 推荐暂缓事项

在 A/B/C 完成前，暂缓：

- 更多 provider router；
- knowledge 全文检索；
- 更复杂的自动评审/自动派单；
- 进一步 UI polish；
- 将 Electron MessagePort 体系完整移植到 dsh-bots。

原因很简单：当前最大风险是**错误、丢失、重复或越权**，不是功能数量不足。
