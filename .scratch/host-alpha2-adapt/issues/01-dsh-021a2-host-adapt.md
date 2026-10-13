# 01 dsh 宿主升级 0.2.1-alpha.2＋插件适配

Status: resolved

## 任务

用户点名（2026-10-13）：「更新 dsh 至最新版本 alpha2，同时对本插件进行版本适配」。

- 目标版本＝npm dist-tag `alpha` 实测值 **0.2.1-alpha.2**（非 latest 0.2.0-rc.2）。
- 当前安装＝0.2.0-rc.1（全局 `/usr/lib/node_modules/@deepseek-ai/dsh`；共享解析池
  `~/.dsh/profiles/node_modules` 全为指向该安装的符号链接——升级全局即整体切换）。

## 约束与授权边界

- 全局升级系出仓库动作，用户本轮指令已点名；**部署同步（deploy-sync）与 bot/host
  重启未点名，不在本票范围**（AGENTS §3）。
- npm prefix=/usr 且 root 属主、无免密 sudo：全局安装动作需用户执行或授权；本票
  先以隔离台（/dev/shm 暂存新宿主＋覆写 HOME 的探针子进程）完成适配与验证，
  真实面终验待全局升级后复跑 preflight ④。
- 0011 证据包 sourceManifest 11 件（evidence/sentinel/ledger 存储面）与本票预期
  不相交；若触碰须按 AGENTS §3 以新 runId 出增量包。

## 判据

1. 新宿主 0.2.1-alpha.2 下宿主契约门 15 探针全 PASS（隔离台实测；真实面终验待
   全局升级后复跑，票面留移交指针）。
2. 漂移面逐条处置：适配 lib/ 或更新 HF 登记（`lib/host-faces.js` hostCoordinate）
   与 `docs/agents/host-runtime-map.md` 坐标（行号/包名/缝形状）。
3. 全量回归绿（基线 93/93，2026-10-13 于 0.2.0-rc.1 实测）＋preflight 四门绿。
4. CHANGELOG 事件落档（含授权依据与验证结果）。

## 基线（2026-10-13，0.2.0-rc.1）

- 全量 93/93；preflight ①93/93 ②11/11 ③0 违例 ④15 PASS/0 FAIL/0 SKIP
  （日志 /tmp/pf-baseline.log）。

## Comments

### 实施（2026-10-13，GLM 会话）

**隔离台**（不触真实面）：`npm install --prefix /dev/shm/dsh-alpha2-stage
@deepseek-ai/dsh@0.2.1-alpha.2`（563 包）＋ `/dev/shm/dsh-alpha2-home/.dsh/
profiles/node_modules/@deepseek-ai → stage` 符号链接；`HOME=<isohome>` 前缀跑
探针与测试（发现面第一优先＝`~/.dsh/profiles/node_modules`）。手法已回写
`docs/agents/host-runtime-map.md` 常用实证手法节。

**漂移实测**（对拍 /usr 旧树 vs 暂存新树）：

- 官方 standard preset 插件行 32→31：移除 `tool-ralph`／`tool-subagent-codex`
  ／`tool-subagent-claude-code`（三行旧版即字面 disabled，0 模型可见工具）；
  新增 `time-context`（无 `ctx.tools.register`，不贡献工具）＋`tool-schedule`
  （`schedule_create`/`schedule_list`/`schedule_delete`/`schedule_update`，
  dsh-tool-schedule/lib/index.js:507/547/569/603）。字面 `disabled: true` 4→1
  （仅 `tool-plugin-manager`）。模型可见工具 27→**31**。其余 15 个工具贡献包
  注册名新旧逐包对拍一致（`dsh-plan-mode` 等 15 包 name 面同）。
- HF 登记面：15 探针新版全 PASS（见下）→ `lib/host-faces.js` 零改动。
- 坐标：dsh-agent-loop `turn/end` 1027→**1029**；dsh-web-app DSH_TOOLS_MODE 缝
  `cordis.patch.yml:34–38` 原位；presets 三件在；app-boot `loadOverlayPatches`
  ＋`__jsExpr` 在；`SessionCreateRequest`（types.d.ts:284）在。
- 包差（逐名对拍安装树）：新增 tool-schedule／tool-session-query／tool-terminal
  ／tool-working-directory／working-directory／session-title-all-prompts-llm
  ＋experimental-* 系；移除 hooks 双包／webhook 双包／invariants
  ／subagent-in-process-driver／schedule-bundle。两向与 HF 登记面引用包零交集
  （仓内对被移除 8 包零引用，grep 实证）。
- `agent-presets` 死键裁定复核：新版宿主内该串引用仅设置面板 UI 槽 id
  （client-ui-agent-preset 等 3 处，两版同位同义），无 per-profile settings.yaml
  读者——裁定维持。

**改动**：tests/pod-harness-base.test.mjs（FROZEN_31／STANDARD_ROWS 31 行
／DISABLED 1 行／TOOL_ROW_NAMES＋tool-schedule／判据文案 27→31）；
.scratch/pod/spec.md（§3/§V-P7 基底口径与判据表，保留转写出处并注重测来源）；
lib/shared.cjs、lib/index.js、tests/spawn-env.test.mjs（注释口径同步）；
docs/agents/host-runtime-map.md（坐标＋包差＋实证手法）。

**验证**（判据 1–3）：

- 隔离台（0.2.1-alpha.2）：全量 **93/93**；宿主契约门 **14 PASS／0 FAIL／
  1 SKIP**（P-SESSION-LOG 隔离 HOME 无日志，合法 SKIP 分列）。
- 真实面（0.2.0-rc.1 仍装）：preflight ①**92/93**（唯一红＝V-P7.2 对旧
  preset，预期过渡态）＋②11/11＋③0 违例＋④15 PASS——登记面新旧双宿主兼容。
- 0011 包 sourceManifest 11 件与本批改动零交集（逐名比对）。
- 评审：code-review 两轴（标准轴＋规格轴）——冻结值逐项对拍正确；处置其
  抓出的宿主地图包差注记事实错误（原误写 goal/skill 等为新增，已按安装树
  实名差改正）。

### 全局升级执行与终验（2026-10-13 同会话续，用户「直接操作」点名）

- **提权路径**：本机 sudo 组成员但会话 shell 无交互终端；实测 WSL 默认发行版为
  docker-desktop（`wsl.exe -u root` 首三跑全落在 docker-desktop 文件系——
  `/usr/bin/node: not found` 之假象由此来），改 `wsl.exe -d Ubuntu -u root --
  /usr/bin/node /usr/lib/node_modules/npm/bin/npm-cli.js install -g
  @deepseek-ai/dsh@0.2.1-alpha.2` 完成全局安装。执行前 `ps` 复核零 dsh 实例
  （无活进程脚下换文件）。授权依据＝用户 2026-10-13「更新 dsh 至最新版本
  alpha2」＋「直接操作」两句点名。
- **池同步（`~/.dsh/profiles/node_modules/@deepseek-ai`）**：现存链接随 /usr
  换树自动切新版（抽查 dsh／dsh-base／dsh-web-app／dsh-tools／
  dsh-client-ui-layout＝0.2.1-alpha.2，cordis＝4.0.5-alpha.1）；清 20 条断链
  （指向新版已移除包：hooks 双包／webhook 双包／invariants／
  subagent-in-process-driver／schedule-bundle／旧 client/code-runtime 系等）。
  74 个「新树有池缺」为升级前即有的既有形态（bundle 解析走宿主自身树，
  运行面历史即如此）——不做投机补链。
- **终验（真实面，/tmp/pf-final.log）**：`dsh --version`＝0.2.1-alpha.2；
  preflight 四门 **①93/93（V-P7.2 对新 preset 绿）②冻结面 11/11 ③lint 0
  违例 ④宿主契约 15 PASS／0 FAIL／0 SKIP**（P-SESSION-LOG 于真实会话日志
  完整通过，隔离台时为合法 SKIP）——**preflight: PASS**。
- **留界（未点名，非本票面）**：部署面 `~/.dsh/plugins/pod` 仍为适配批前
  HEAD（80cf52d 的 lib 改动仅注释级、行为等价，运行兼容无虞；对账红待下次
  部署同步窗口随行）；bot/host 重启未执行（当前零实例，下次起链自然载入
  新宿主）。

### 历程存档（升级执行前的移交备注，已被上节执行结果取代）

- 执行前状态：仓内适配已提交（80cf52d）；全局宿主未升级，真实面过渡态
  ①92/93（V-P7.2 已知红）②③④绿。
- 证据指针：基线（旧宿主四门绿）`/tmp/pf-baseline.log`；过渡态
  `/tmp/pf-interim.log`；终验 `/tmp/pf-final.log`（本机 /tmp 临时件，核心
  结论已固化于本票与 CHANGELOG 事件）。隔离台复现命令一行：
  `npm install --prefix /dev/shm/s @deepseek-ai/dsh@0.2.1-alpha.2 && mkdir -p
  /dev/shm/h/.dsh/profiles/node_modules && ln -sfn /dev/shm/s/node_modules/@deepseek-ai
  /dev/shm/h/.dsh/profiles/node_modules/@deepseek-ai && HOME=/dev/shm/h npm test`。