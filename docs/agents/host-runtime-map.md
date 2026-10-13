# 已安装宿主运行时地图（@deepseek-ai/dsh）

何时读：要探官方宿主的行为、找某个机制住在安装包哪里、或宿主升级后核对缝
是否还在。安装包是全局只读件：`/usr/lib/node_modules/@deepseek-ai/dsh`。

## 先查登记表，再逆向

- `lib/host-faces.js`（HF-* 登记表）记录已知的宿主坐标（`hostCoordinate` 与
  `readAccess` 字段）——逆向任何宿主机制前先查它，大概率已有坐标与探针。
- 行为断言走 `scripts/host-contract-probe.mjs`（探针 id 见登记表
  `probeId`）；真实宿主三态探针在 preflight ④门跑。发现新缝后回登记表加行
  并补探针断言，防宿主升级静默失效。

## 安装包布局（实证于 2026-10-03；2026-10-13 对 0.2.1-alpha.2 复核——坐标漂移按条目内注记；实测包差：新增 tool-schedule／tool-session-query／tool-terminal／tool-working-directory／working-directory／session-title-all-prompts-llm＋experimental-* 系，移除 hooks 双包／webhook 双包／invariants／subagent-in-process-driver／schedule-bundle——两向都与 HF 登记面引用的包零交集〔逐名对拍新旧安装树〕）

- 根：`/usr/lib/node_modules/@deepseek-ai/dsh`。`lib/bin.js` 是编译产物，
  cordis 核心语义（`ctx.inject`/`ctx.effect`/disposer）读不到源码——用探针或
  隔离副本实证，别找源码。
- 子包在 `node_modules/@deepseek-ai/` 下，常用的：
  - `dsh-agent-loop`：回合循环；`turn/end` 事件发射在
    `lib/index.js:1029`（0.2.1-alpha.2 实测；0.2.0-rc.1 为 1027。reason 形状：`{ turn, reason }`，error 终止
    `reason.kind === "error"` 带 error 对象）。
  - `dsh-api-session-controller`：`sessionController.create`（入参形状见
    `lib/types/` 的 `SessionCreateRequest`）。
  - `dsh-tools`：ToolRuntime、呈现模式（`native`/`ptc`/`both`）、
    `presentAs`、preset 注册。
  - `dsh-agent-tool-presentation`：preset 的工具呈现行。
  - `dsh-web-app`：**工具呈现环境缝**在 `cordis.patch.yml:34–38`——
    `mode: !!js process.env.DSH_TOOLS_MODE`（官方 TEMPORARY workaround，
    unset＝native；0.2.1-alpha.2 复核仍在原行位）。presets 目录含
    `ptc.patch.yml`、`standard.patch.yml`、`minimal.patch.yml`
    （standard 插件行集随版本漂移——32 行／4 字面 disabled
    （0.2.0-rc.1）→ 31 行／1 字面 disabled（0.2.1-alpha.2，移除 ralph＋
    codex 双行、新增 time-context＋tool-schedule），模型可见工具 27→31，
    冻结值见 tests/pod-harness-base.test.mjs::V-P7.2）。
  - `dsh-app-boot`：`loadOverlayPatches`（我方探针用它实调官方装载器；
    装载器不求值 `!!js` 表达式，保留 `__jsExpr` 标记）。
  - `cordis*`：插件框架本体（编译，不可读源码）。

## 已知环境缝与生效口径

- `DSH_TOOLS_MODE=ptc`：bot 子进程经 `spawnBot` overrides 注入（见
  `lib/spawn-env.js` 与 `lib/index.js` spawnOverrides 段）。PTC 下模型只见
  `run_code`，带点原名工具保留在生成的 SDK 内按 scope 权限执行。
  缝形状由探针 P-CONFIG-IDS 把守。
- 服务等待：PTC 下官方 tools 行等 ptcRuntime 就绪，apply 时点
  `ctx.get("tools")` 可能取空——bot 面注册必须走 `registerBotFacesOnReady`
  的 `ctx.inject` 等待形态（16 号票 ptc-r2 实证）。

## 插件装载与回合错误（实证于 2026-09-30，16 号票诊断批）

- **插件目录钉在真实 HOME**：宿主读 `~/.dsh/plugins`，`DSH_HOME` 不重定向
  它——隔离镜像必须同时覆盖 HOME 才会加载镜像插件（镜像打点失效 90+ 步
  诊断的根因）。
- **插件解析锚＝profile 的 `node_modules/pod` 符号链接**（指向真实部署目录；
  13 号票改名批由 `node_modules/dsh-bots` 更名，运行面改名已随窗口执行完成——
  换打点版要改这条链接，改 `DSH_HOME` 无效）。
- **官方 agent loop 的 `kick()` 静默吞回合错误**：followup 后 `whenIdle`
  立即 resolve（polls=0）≠ 成功——须监听 `agent/error` 事件才能拿到被吞
  的错误。
- **v4 会话格式只收 producer-owned source kind**：手写
  `source:{kind:"plugin"}` 被拒（报错 `format v4 message requires a
  producer-owned source kind`），与 PTC 呈现模式无关。

## 实例 /api 鉴权链与启动竞态（实证于 2026-10-05，17 号票 v1）

- 实例（`dsh --profile <bot> --port <n>`）的 `/api` 面由 `dsh-client-connection`
  的 `requestRejection` 把守：非信任 host → 403；`browserAuth` 未过 → 401。
  `dsh web --trusted-host <authority>` 可追加信任 authority（403 栅栏）。
- 鉴权＝**进程启动令牌换签名 cookie**：`processLaunchToken(owner)` 按进程 owner
  生成，启动 banner 打印 `http://127.0.0.1:<port>/?token=<T>`；GET `/?token=<T>`
  → 303 `set-cookie`（带 maxAge 的签名 cookie）。实测只有 cookie 能过 401——
  同一令牌以 query 参数或 header 携带均 401。
- 插件侧 `spawnBot` 把实例 stdout **直接丢弃**（`child.stdout` 的 data 回调为空），
  banner 令牌无人接收——所以从宿主进程 HTTP 打实例 `/api` 不是可用通道。回合
  必须走进程内 native RPC（`lib/native-session-rpc.js` 直调
  `dsh-api-session-controller`，无需令牌）。
- **启动竞态（`session.create` 401 的实际根因）**：积压邮件在实例启动几秒内被
  watcher 消费，回合触发时 `dsh-web-app` 插件栈尚未装配完 → nativeRpc 取不到 →
  HTTP 兜底 → 401（该 HTTP 路由本就不存在）。实例装配完成后再投邮件（新 seq
  新回合）即愈；切换烟测不暴露，是因为当时实例先起、邮件几小时后才到。
- 实例回信的错误形状是 `[bot error] DSH session.create HTTP 401`——见到它先查
  启动时序与实例装配态，不要先怀疑宿主版本（同版本下时序不同结论不同，
  2026-10-05 实证：9-29/30 同版本回合是通的）。

## bot profile 配置分层（实证于 2026-10-05，17 号票 v2）

- `~/.dsh/profiles/<name>/` 成员：`package.json`（bundles＝`@deepseek-ai/dsh-base`
  ＋`@deepseek-ai/dsh-web-app`）、`cordis.yml`、`cordis.patch.yml`、
  `settings.yaml`、`node_modules`（`pod` 解析锚符号链接，见上节）。
- **插件活动面是 `cordis.patch.yml`**：provider 配置挂 `- id: llm-pi-ai` 补丁块
  的 `config.providers`（键：displayName／apiKeyEnv／api／baseURL／models／
  headers）。`settings.yaml` 的同名键是旧面——provider 基本解析仍可被读到，
  但 `headers` 等字段只在 patch 面生效（实证：headers 写 settings.yaml 无效）。
- 写入侧构造走 `lib/shared.cjs` 单一坐标（见 HF-CONFIG-IDS 登记行）；手工改
  配置优先改 patch 面，两处并存时以 patch 面为准。
- 密钥经 `apiKeyEnv` 引用进程环境变量（如 `OPENCODE_GO_API_KEY`），不落
  profile 文件。
- opencode zen 网关（`baseURL: https://opencode.ai/zen/go/v1`）要求路由头
  `x-opencode-session`（缺则 400 `MissingSessionID`）；模型 id 从网关
  `GET /models` 取；headers 挂在 provider 块（patch 面）。
- 脚手架（`scaffoldBot`）不写 provider 定义：裸席 profile 只指
  `agent-default-model` 会报 `Select an available model`，须补 providers 块
  并重启实例才可用。

## 常用实证手法

- 读类型：`rg -n -A25 '<TypeName>' .../dsh-api-session-controller/lib/types/*.d.ts`。
- 探装配：复制 `~/.dsh`（排除 sessions/backups）到 /tmp 做隔离副本，spawn
  带 `DSH_HOME=<副本>` 的 `dsh --profile <p> --port <专用端口>` 观察 IPC。
  隔离副本用专用端口段（如 319x），清理按记录的 pid 杀，**禁用**
  `pkill -f 'dsh --profile'` 这类宽匹配——会误杀真实双席（2026-09-29 事故）。
- 新版宿主预验不动真实面（host-alpha2-adapt/01 实证）：`npm install --prefix
  /dev/shm/<stage> @deepseek-ai/dsh@<ver>` 暂存新版，再造
  `<isohome>/.dsh/profiles/node_modules/@deepseek-ai → <stage>/node_modules/@deepseek-ai`
  符号链接，之后 `HOME=<isohome>` 前缀跑 `scripts/host-contract-probe.mjs` 与
  `tests/run.mjs`——发现面与测试都以 `~/.dsh/profiles/node_modules` 为第一优先，
  整体解析到新版（P-SESSION-LOG 在隔离 HOME 无日志，属合法 SKIP 分列）。
