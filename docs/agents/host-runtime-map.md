# 已安装宿主运行时地图（@deepseek-ai/dsh）

何时读：要探官方宿主的行为、找某个机制住在安装包哪里、或宿主升级后核对缝
是否还在。安装包是全局只读件：`/usr/lib/node_modules/@deepseek-ai/dsh`。

## 先查登记表，再逆向

- `lib/host-faces.js`（HF-* 登记表）记录已知的宿主坐标（`hostCoordinate` 与
  `readAccess` 字段）——逆向任何宿主机制前先查它，大概率已有坐标与探针。
- 行为断言走 `scripts/host-contract-probe.mjs`（探针 id 见登记表
  `probeId`）；真实宿主三态探针在 preflight ④门跑。发现新缝后回登记表加行
  并补探针断言，防宿主升级静默失效。

## 安装包布局（实证于 2026-10-03）

- 根：`/usr/lib/node_modules/@deepseek-ai/dsh`。`lib/bin.js` 是编译产物，
  cordis 核心语义（`ctx.inject`/`ctx.effect`/disposer）读不到源码——用探针或
  隔离副本实证，别找源码。
- 子包在 `node_modules/@deepseek-ai/` 下，常用的：
  - `dsh-agent-loop`：回合循环；`turn/end` 事件发射在
    `lib/index.js:1027`（reason 形状：`{ turn, reason }`，error 终止
    `reason.kind === "error"` 带 error 对象）。
  - `dsh-api-session-controller`：`sessionController.create`（入参形状见
    `lib/types/` 的 `SessionCreateRequest`）。
  - `dsh-tools`：ToolRuntime、呈现模式（`native`/`ptc`/`both`）、
    `presentAs`、preset 注册。
  - `dsh-agent-tool-presentation`：preset 的工具呈现行。
  - `dsh-web-app`：**工具呈现环境缝**在 `cordis.patch.yml:34–38`——
    `mode: !!js process.env.DSH_TOOLS_MODE`（官方 TEMPORARY workaround，
    unset＝native）。presets 目录含 `ptc.patch.yml`、`standard.patch.yml`、
    `minimal.patch.yml`。
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

## 常用实证手法

- 读类型：`rg -n -A25 '<TypeName>' .../dsh-api-session-controller/lib/types/*.d.ts`。
- 探装配：复制 `~/.dsh`（排除 sessions/backups）到 /tmp 做隔离副本，spawn
  带 `DSH_HOME=<副本>` 的 `dsh --profile <p> --port <专用端口>` 观察 IPC。
  隔离副本用专用端口段（如 319x），清理按记录的 pid 杀，**禁用**
  `pkill -f 'dsh --profile'` 这类宽匹配——会误杀真实双席（2026-09-29 事故）。
