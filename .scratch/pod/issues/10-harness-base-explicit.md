# 10: L1：基底显式化与死配置清理

**What to build:** 把 bot 的「基底工具面与呈现面」从**死键偶然对上**改为显式口径，并清掉
那两条静默降级。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 保留 PTC（`DSH_TOOLS_MODE` 无条件注入不动）＋规格写明「基底＝官方默认 preset
      `standard`（27 工具）＋呈现面 ptc」，附本轮实测证据（一个 provider 接受带点名、
      另一个按 `^[a-zA-Z0-9_-]+$` 拒绝）；
- [ ] 清除 per-bot `settings.yaml` 的 `agent-presets` 段与 profile patch 里的 `settings`
      死重定向行（生成器同步），新建 bot 不再写出死键；
- [ ] 反向验证：`dsh --dump-config` 不再出现该段；既有 bot 的 profile 清理按运行面授权点名执行；
- [ ] 不碰岗位 op 集（`lib/org/op-set.js`）与 op 命名合同；
- [ ] `.agent-presets/` 死目录与断链软链登记为长期观察项（`docs/PROJECT_UNDERSTANDING.md`
      「仍可选题」＋当月 CHANGELOG 留界），不进本轮 `.scratch` 工单面。

## Comments

### 实施记录（2026-10-09）

**改动点（符号级）**

- `lib/shared.cjs`
  - `buildPatchYaml`：删除 `settingsPath` 参数、JSDoc `@param settingsPath` 与 patch 末尾的
    `- id: settings` + `config.path` 死重定向块；docblock 写入基底显式口径（patch 不写
    `agent-preset-registry` 的 `selectedDefault` → 基底＝官方默认 preset `standard`；呈现面＝
    `spawnBot` 无条件注入 `DSH_TOOLS_MODE=ptc`；人物设定不裁，`bot-nopersona` 从未生效）。
  - 新增导出 `BOT_SETTINGS_HEADER`：新建 per-bot `settings.yaml` 的初始内容（仅说明注释、
    不含配置键），宿主内置脚手架与脚本共用，单一事实源。
- `lib/index.js`
  - `buildPatchYamlBuiltin`：不再传 `settingsPath`；docblock 去掉「旧 settings 重定向」。
  - `scaffoldProfileBuiltin`：`settings.yaml` 初始化由 `agent-presets:\n  default: bot-nopersona`
    改为 `BOT_SETTINGS_HEADER`（幂等语义、不覆盖用户编辑均不变）。
  - `spawnBot`：`spawnOverrides` 的 `DSH_TOOLS_MODE: "ptc"` **无条件注入不变**；注释扩写为
    基底显式口径（standard 27 工具＋ptc；含未绑岗位实例；证据指向）。
- `scripts/create-bot.cjs`：`settings.yaml` 初始化同改 `BOT_SETTINGS_HEADER`；
  `buildPatchYaml(...)` 调用不再传 `settingsPath`。
- `scripts/host-contract-probe.mjs`：`OUR_PATCH_MUST_RETAIN` 去掉 `"settings"`（我方 patch
  不再写该行；`CONFIG_IDS_CRITICAL` 保留 `settings` 作官方组合 patch 的宿主改名看守——官方
  `dsh-base/cordis.patch.yml` 仍有该 id）；探针 patch 构造不再传 `settingsPath`。
- `lib/host-faces.js`：`HF-CONFIG-IDS.hostCoordinate` 去掉 `settings(path)`，注明已随本票清除
  （文档真实性镜像；`readAccess` 中 settings.yaml 仍是 llm-pi-ai 同步落点，保持原样）。
- `tests/bot-profile.test.mjs`：新增用例「生成器不写出死键：patch 无 settings 重定向行、
  settings.yaml 无 agent-presets 段」（两条生成路径都断言；先红后绿）。
- `tests/spawn-env.test.mjs`：集成用例注释补基底口径（未绑岗位、无模型 pin 实例仍保 ptc）。
- `tests/pod-harness-base.test.mjs`（新增；规格 V-P7.1–V-P7.7 的执行坐标，01 规格施工中段
  合入后补齐）：文档面（规格口径/证据/人物设定不裁；「仍可选题」登记；建议 CHANGELOG 文本
  就位）＋配置面（patch 不覆写 preset、无 settings 重定向、settings 模板无配置键）＋官方
  `standard.patch.yml` 32 行/27 工具逐项对照（防静默漂移）＋`DSH_TOOLS_MODE` 无条件注入形状
  ＋真跑 `dsh --dump-config` 反向验证＋op 命名合同负例（改名 op 即被拒）。
- `docs/PROJECT_UNDERSTANDING.md`：「仍可选题」登记 `.agent-presets/` 死目录与 13 条断链软链。

**基底口径与实测证据（本轮，未重跑真实 provider）**

- 口径：bot 基底＝官方默认 preset `standard`（27 工具：`bash read write edit read_image glob
  grep job_output job_list job_kill skill get_goal create_goal update_goal exit_plan_mode
  send_message interrupt_agent list_agents subagent subagent_fork list_subagent_models
  workflow ask_user_question todo_write web_search web_fetch present`）＋呈现面 ptc。
  落地为两条可执行判据：①`tests/bot-profile.test.mjs` 断言生成 patch 不覆写
  `agent-preset*`（无覆写 → 回落 `standard`）；②`tests/spawn-env.test.mjs` 集成用例断言
  `DSH_TOOLS_MODE=ptc` 对（未绑岗位、无模型 pin）bot 仍无条件注入。
- 证据（共识 §3.2 落地，来源＝本轮设计会话实测；**只对当前网关注效，不可外推 DeepSeek
  官方直连**）：`opencode-go` 带点名 **200 接受**；`niko` **400 拒绝**，错误模式
  `pattern '^[a-zA-Z0-9_-]+$'`。
- 两条静默降级已收：① per-bot `settings.yaml` 的 `agent-presets:` 段在 0.2.0-rc.1 无读者
  （生成器已停写）；② `bot-nopersona`「去 persona」从未生效——注释/口径写明「人物设定不裁」
  （persona 经 `system-prompt.config.persona` 原样注入）。

**验证命令与实际计数**

- 红→绿：`TMPDIR=/tmp node tests/bot-profile.test.mjs` 先 4 例中 1 红（新的死键用例：
  patch 仍含 `- id: settings`）→ 实现后 `# pass 4 / # fail 0`。
- `TMPDIR=/tmp node tests/pod-harness-base.test.mjs`（V-P7.1–V-P7.7）→ 7/7；受控回退实验
  证红：把 `lib/shared.cjs`／`lib/index.js`／`scripts/create-bot.cjs`／`lib/host-faces.js`／
  `scripts/host-contract-probe.mjs` 临时回退到基线 `691c041` → V-P7.1／V-P7.4／V-P7.5 三红
  （4 pass / 3 fail），恢复后 7/7（判据非自证）。
- `TMPDIR=/tmp node tests/route.test.mjs` → 18 ✓ / 0 ✗（settings.yaml 迁移源与
  agent-default-model pin 语义未变）。
- `TMPDIR=/tmp node tests/host-contract-gate.test.mjs` → `# pass 30 / # fail 0`。
- `TMPDIR=/tmp node tests/spawn-env.test.mjs` → 6 ✓ / 0 ✗。
- `TMPDIR=/tmp node tests/run.mjs` → 85/85 个测试文件通过（新增 `tests/pod-harness-base.test.mjs`
  即 84→85；此前 84/84 口径下曾出现一次与并行命令同跑的 83/84 偶发，独占重跑 84/84、退出码 0）。
- `TMPDIR=/tmp node scripts/preflight.mjs` → PASS：①回归 85/85（新增判据文件即增）；
  ②冻结面（0010 包）10/10；③status-lint 0 违例（扫 114 md／命名 205 活文件／知识库 69 脚本／
  地图覆盖 45 lib/org 件）；④宿主契约 12 PASS / 0 FAIL / 0 SKIP。
- 反向验证（真跑，隔离 `DSH_HOME` 临时树，真实运行面零写入）：`node scripts/create-bot.cjs`
  生成 profile 后 `DSH_HOME=$T dsh --profile worker --dump-config` 退出码 0，输出
  `agent-presets` 命中 **0**；我方 patch 层只出现 `agent-default-model`／`llm-pi-ai`／
  `system-prompt`／`sandbox-policy`／`approval`／`bots`，`- id: settings` 仅存于官方
  `@deepseek-ai/dsh-base` 层（非我方 patch 层）。另以 legacy 同型 settings.yaml（含
  `agent-presets:`）复跑：dump 命中仍 0（该段不进入解析），盘上旧段原样保留（见待授权项）。

**待授权项（本批未执行，运行面写入）**

- 既有 bot 的 profile 清理按 Q5 口径逐项点名后执行：① `~/.dsh/profiles/<id>/settings.yaml`
  删除 `agent-presets:` 段；② `~/.dsh/profiles/<id>/cordis.patch.yml` 删除 `- id: settings`
  重定向块。本批对 `~/.dsh` 零写入。

**偏离与未闭合项**

- `scripts/host-contract-probe.mjs`（`OUR_PATCH_MUST_RETAIN`）与 `lib/host-faces.js`
  （HF-CONFIG-IDS 坐标描述）属本票必要同步：前者不改正门必红，后者为文档真实性镜像。
  02 号票同文件扩面，合入时保留双方语义即可。
- 观察项事实与共识措辞有一处差异（登记时按只读复核读数落笔）：13 条断链软链不在
  `~/.dsh/.agent-presets/` 内，而在 `~/.dsh/profiles/node_modules/@deepseek-ai/`
  （目标＝安装树内已移除的旧包）；`.agent-presets/` 内是 `bot-nopersona/` 两个普通文件。
- 未闭合：CHANGELOG 事件由 Lead 统一落档（建议文本见下）。

**规格并入说明**

- 01 规格（`48af609`）于本票施工中段并入集成分支：口径、27 工具清单（实测）、实测证据、
  「人物设定不裁」均已齐备；V-P7.1–V-P7.7 七条判据的执行坐标＝`tests/pod-harness-base.test.mjs`，
  本票已补全（V-P7.2／V-P7.5 依赖官方宿主载体，缺失时按 `⤼ SKIP:` 协议分列计数）。

**建议 CHANGELOG 事件（Lead 落档；本批不自行写卷）**

- `--id EV-20261009-pod10-harness-base-explicit`
- 标题：pod 10：bot 基底显式化（standard＋ptc）与死配置清理
- 范围：`lib/shared.cjs`、`lib/index.js`、`scripts/create-bot.cjs`、
  `scripts/host-contract-probe.mjs`、`lib/host-faces.js`、`tests/pod-harness-base.test.mjs`
  （规格 V-P7 判据）、`tests/bot-profile.test.mjs`、`tests/spawn-env.test.mjs`、
  `docs/PROJECT_UNDERSTANDING.md`、`.scratch/pod/issues/10-*.md`；本事件。
- 变化：① bot 基底口径显式化——patch 不覆写 `agent-preset-registry.selectedDefault`
  （基底＝官方默认 preset `standard`，27 工具），呈现面＝`spawnBot` 无条件注入
  `DSH_TOOLS_MODE=ptc`（不变），附实测证据（`opencode-go` 带点名 200 接受／`niko` 按
  `^[a-zA-Z0-9_-]+$` 400 拒绝，仅对当前网关注效）；② 死配置清理——生成器（宿主内置脚手架与
  `create-bot.cjs`）不再写 per-bot `settings.yaml` 的 `agent-presets:` 段与 patch 的
  `- id: settings` 重定向行，新建 bot 不再写出死键；③ 收掉「`bot-nopersona` 去 persona」
  静默降级，写明「人物设定不裁」；④ `.agent-presets/` 死目录与 13 条断链软链登记长期观察项。
- 验证：`tests/pod-harness-base.test.mjs` V-P7.1–V-P7.7 7/7（含官方 standard preset 32 行/
  27 工具逐项对照与 `dsh --dump-config` 真跑反向验证；受控回退到基线 `691c041` 时 V-P7.1/4/5
  三红）＋`tests/bot-profile.test.mjs` 新用例（红→绿）＋`tests/spawn-env.test.mjs` 集成用例；
  `tests/run.mjs` 85/85；`scripts/preflight.mjs` 四门同基线口径 PASS（85/85、10/10、0 违例、
  12 PASS/0 FAIL/0 SKIP）。
- 授权：用户 Q27「4保留ptc，其他我没有建议」＋Q25a「其余无异议」接受本清理范围（共识 §3.2）；
  既有 bot 的 profile 清理属运行面写入、按 Q5 口径待逐项点名（本事件不含）；部署同步、
  bot/host 重启、新 runId 证据包按运行面三件逐项点名。
