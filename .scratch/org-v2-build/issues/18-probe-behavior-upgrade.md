# 18: 宿主契约门 A 类探针行为化升级＋V-A6.8 人工目视清单

**What to build:** 规格 §H 要求 A 类面（静默降级面）「经可替换适配层＋**行为探针**（真实调用
一次、断言结果形状）」、`V-A6.4` 要求「门只由行为断言把守」。当前 11 个探针中仅
`P-CLIENT-LOCALE`（真实调起官方 LocaleRuntime）与两个台账探针（`P-V2-LEDGER-FORMAT` 落盘
schema 复算与投影重建、`P-LEDGER-COMMANDS` 命令信封与拒绝形状）为真实行为调用，A 类其余
5 面为宿主安装产物的标记扫描：

- `P-CONFIG-IDS`（HF-CONFIG-IDS）：配置 id 段标记核验
- `P-CLIENT-SLOTS`（HF-CLIENT-SLOTS）：槽名在 layout/sidebar bundle 在位
- `P-CLIENT-VISUAL`（HF-CLIENT-VISUAL）：主题令牌在 bundle 在位＋primitives 可解析
- `P-CTX-SERVICES`（HF-CTX-SERVICES）：服务名在宿主插件包内在位
- `P-SESSION-LOG`（HF-SESSION-LOG）：日志布局标记在位

本票把这 5 个探针升级为真实调用＋结果形状断言（参照 `P-CLIENT-LOCALE` 先例：装载真实
bundle／官方运行时、执行一次调用、断言返回形状）；每面自行论证无头环境下的真实调起机制，
确实无法真实调起的面须在探针描述与登记表 `readAccess` 中显式降级声明并说明理由（不允许
静默维持标记扫描）。B 类面（`P-HOST-RPC`／`P-SPAWN-CLI`／`P-PLUGIN-IDENTITY`）按规格 §H
「存在性/形状探针即可直用」维持现状不动。同时收口 `V-A6.8` 的「一次人工目视功能清单
（实验期一次、列明核验人）」——执行一次前端功能目视清单并把核验人落档。

规格出处：`.scratch/org-v2/spec.md` §H（Implementation Decisions）与附录 A `V-A6.4`／`V-A6.8`。

来源：2026-09-18 `/code-review` 全批重审（固定点 `326f4d8...HEAD`）Spec 轴发现——01 号票
「挂行为探针（真实调用一次、断言结果形状）」勾选超出实际（01 票面已补如实注记）。

**Blocked by:** None（可立即开始）

**Status:** ready-for-human（代码面完成：五探针行为化＋显式降级声明＋四道门 PASS；余项
`V-A6.8` 属人工目视——待核验人执行下方清单并署名后翻 `resolved`）

- [x] `P-CONFIG-IDS` 升级为真实调用＋形状断言（三段真实调用：我方 patch 经官方
      dsh-app-boot `loadOverlayPatches` 往返复验＋官方 dsh-base/dsh-web-app 组合 patch
      全集对照关键 id＋官方命名空间常量核对；`CONFIG_IDS_CRITICAL` 与 shared.cjs 无漂移有测试把守）
- [x] `P-CLIENT-SLOTS` 同上（真实 apply 官方 layout/sidebar bundle 记录声明槽树：sidebar
      single／main keyed／shell.overlay list／sidebar.footer.action list；渲染期
      priority/abdicate 与 conversation entryKey 无头不可调起——已在探针 describe 与登记表
      readAccess 双落点显式降级声明，归目视清单）
- [x] `P-CLIENT-VISUAL` 同上（真实 apply 官方 theme bundle：运行期注入样式含 `--dsw-*`
      令牌与 `:root` 定义＋theme 服务 getTheme 形状；primitives 导出形状与 ownerProps
      无头不可调起（primitives 仅存于 shell 种子表、安装内符号链接悬空可证）——已双落点
      显式降级声明：存在性归 P-PLUGIN-IDENTITY（B 类）、形状归目视清单）
- [x] `P-CTX-SERVICES` 同上（真实实例化官方 ToolRuntime/SystemPrompt 断言服务名
      tools/systemPrompt——cordis Service 构造即 reflect.provide，名字漂移必 FAIL；
      baseUrl＝官方 boot() 空树最小调用断言 ctx.baseUrl 产出并喂回
      lib/host-services.js 适配层回读 profile id，产出端→消费端闭环）
- [x] `P-SESSION-LOG` 同上（本机最新真实会话日志喂入 lib/stats.js 真实解码路径：多帧
      zstd→事件形状→四大投影；无已落盘会话→SKIP 带原因，部署面视同 FAIL 语义不变）
- [x] 汇总行三态分列不变；`--face=deploy` SKIP 视同 FAIL 语义不回退（`V-A6.3`）（探针数
      不变仍 11，01 号票表述无需改数）
- [ ] `V-A6.8` 人工目视功能清单执行一次、列明核验人并落档（清单见下节——**待核验人执行
      并署名**，代签＝落档作假）
- [x] 全量回归与 preflight 四道门 PASS（2026-09-18 实跑：回归 39/39 个测试文件
      （host-contract-gate 21 条，较上轮新增 11 条）；冻结面 9/9；status-lint 0 违例；门④
      **11 PASS / 0 FAIL / 0 SKIP**＝`preflight: PASS`）

实施附注（2026-09-18）：五面真实调起机制均经真实宿主 scratch 验证后才落码——① 配置面：
官方 dsh-app-boot 导出的 loadOverlayPatches 即 cordis.patch.yml 的真实装载器，官方组合
patch（dsh-base/dsh-web-app）即权威 id 全集源；② 槽位：官方 layout/sidebar bundle 同走
`window.__ModuleLoader__.load` 协议（P-CLIENT-LOCALE 先例可推广），apply 时真实声明槽树、
sidebar 的注册藏在 inject 回调内（记录型 ctx 须实调回调）；③ 视觉：theme bundle 无头
apply 即注入 31KB 令牌样式；④ 服务名：官方 ToolRuntime/SystemPrompt 可携 mock reflect
ctx 真实实例化（cordis Service 构造即注册）；⑤ baseUrl：boot("probe", 空树配置) 可无头
完成。测试面（合成 fixture 驱动，真实宿主实跑归 preflight ④ 不并入套件）：
tests/host-contract-gate.test.mjs 新增 11 条（harness 装载协议/记录 ctx/DOM 桩、各 stage
PASS/FAIL/SKIP 负例、登记表双落点降级声明、适配层↔探针 id 无漂移、三态协议保持）。

## V-A6.8 人工目视功能清单（实验期一次；执行后核验人署名并勾选上框）

> 目的：行为探针只能把守「声明面」（槽树/令牌/服务名），渲染期语义（priority/abdicate、
> conversation entryKey、primitives 组件外观、ownerProps 折叠信号）须人眼核一次。此为
> 实验期**一次**件，不设视觉回归（规格 §H）。执行环境：`dsh web` 正常运行面，打开 bots
> 前端即可，逐项勾选。

- [ ] 1. 侧栏入口：原生侧栏 footer 的「Bots」入口按钮可见可点（`sidebar.footer.action` 槽装载）
- [ ] 2. Bot 模式整页：点击入口后 bot 列表/新建按钮接管侧栏（`sidebar` 槽占用），会话区切换为 bot 界面（`conversation` 槽 entryKey）
- [ ] 3. abdicate 还原：退出 Bot 模式后原生侧栏/会话界面无损还原（single 槽「priority 低者渲染」语义）
- [ ] 4. 通知可见：bot 上线/邮件通知以底部右侧堆叠卡片出现（`shell.overlay` list 槽）
- [ ] 5. 本地化：bots 相关文案全部为字典文案、无裸键（LOCALE_NS 注册生效）
- [ ] 6. 视觉一致：按钮/菜单/弹窗等 primitives 组件与宿主原生外观一致；注入样式令牌生效（无错色/裸样式）
- [ ] 7. 窄屏行为：窗口收窄后侧栏折叠为轨、bot 头像在轨上可见（ownerProps collapsed 信号）
- [ ] 8. 异常无残留：以上操作全程控制台无宿主插件报错

**核验人：** ＿＿＿＿＿＿（署名）　**日期：** ＿＿＿＿-＿＿-＿＿　**环境/宿主版本：** ＿＿＿＿
