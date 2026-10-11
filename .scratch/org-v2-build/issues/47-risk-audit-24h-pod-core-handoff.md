# 47: 第四轮 24h 风险审计——pod-core 待并分支窗口（讨论票）

**Status:** resolved（2026-10-11 用户裁定「按建议」，处置记录见 Comments）

**票源：** 2026-10-11 用户指令的只读风险审计（五类：运行错误／数据丢失／权限绕过／
资源泄漏／跨端兼容；只取可验证仓库事实，证据不足处明说）。窗口＝2026-10-10 10:00 →
2026-10-11 10:00（+0800）。窗口内 main 4 提交（`182bd1f`／`46fa6e9`／`fa83316`／
`f0cca25`）经 `--stat` 核验均为 `.scratch/IN-FLIGHT.md` 单行板面更新，**无代码变更**；
窗口内代码变更全部在待并分支 `integration/pod-core`（分支头 `31b1879`，与 main 的
merge-base `691c041`）：窗口内 16 提交（`82a06e8`…`31b1879`），代码面累积 diff＝
`fb9a4d5..31b1879`（`82a06e8` 的父＝`fb9a4d5`）。本票为**讨论性质**：1 项发现（F1，
附可复算证据）＋五类专项核验结论＋5 个交接问题；发现≠已确认缺陷，修法不预设，
由接受方评估裁定。

**审计方法：** 逐提交 diff 通读（`lib/client.js` 窗口 diff 全量 2444 行精读；改名扫
285 个变更 hunk 经归一化甄别）＋跨文件接线核验（wire 协议字面量、扫描门许可清单、
F3 守卫单源）＋干净快照（`git archive 31b1879` 至临时目录）独立实跑全量回归＋
F1 专项复算脚本（仓库自带 mini-React 桩装载真实 `lib/client.js`）。本票所有行号
均取自快照 `31b1879`（工作树在 main，避让并行会话）。

## 摘要

- 窗口代码面：`lib/client.js` 集中了 05 过渡动效（`82a06e8`）＋评审返修两轮
  （`0efc9e8`／`99dc3c0`）＋04 覆盖层返修线（`5d0420d`／`88a31b5`，经 `bbb382d`
  收口带入并解冲突）；12 号改名扫（`f557f51`／`6fa9841`，约 50 个代码文件，
  3840+/839−，大头为机械改名）；`lib/host-faces.js`＋探针为文档口径与 M5 观测键
  修复；新增 `tests/pod-transition.test.mjs`（715 行）与 `tests/pod-spec-face.test.mjs`
  （1069 行）。
- **F1（唯一发现，视觉规格偏离级）**：切席位过渡标记在**挂载期即落上**，与票 05
  自述的「只在 botId 换代后打、避免重影」不符；重进保选场景下与层根进场动画叠加；
  回归无对应断言。无崩溃／无数据／无权限／无泄漏影响。
- 其余四类（数据丢失／权限绕过／资源泄漏／跨端兼容）：**未发现高置信新增风险**，
  核验路径与正面结论见下节。
- 独立实跑：快照上 91/91 测试文件全绿（`node tests/run.mjs`，与 `bbb382d` 提交信息
  的四门记录一致）。

## F1 挂载期即打切席位标记，违背票 05「首帧不打标记」判据（视觉规格偏离＋测试断言缺口）

- **代码机制**：`usePodViewTransition(botId)`（`lib/client.js:776`）以两个效应落
  「已过首帧」位与换代序号：

  ```js
  const [sequence, setSequence] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setSequence((value) => value + 1); }, [botId]);
  return podViewTransitionClass(sequence, sequence > 0 && mounted);
  ```

  `[botId]` 依赖效应**挂载期必然运行**（React 依赖效应语义，注释「席位换代才推序号」
  的心智模型与此不符）→ 首次效应 flush 即 sequence=1，与 `mounted` 同拍落地，标记
  `pod-pod-view-in-1` 挂上主区视图容器（消费点 `lib/client.js:3745`）。「已过首帧」
  判定只排除**效应前的首次提交**，挡不住标记在下一拍出现。
- **与票面判据相悖**：票 05 Comments 第 2 点（`.scratch/pod/issues/05-pod-transition-motion.md:53`）
  明言「席位视图容器在**挂载首帧不打标记**，只在 `botId` 换代后打……理由＝同一容器
  叠两层同关键帧动画在视觉上是重影」，并称回归以可执行等价物把守。实际把守的只有
  「同一状态重渲不得换代」＋「侧栏列任何一帧都不得带标记」（V-P3.3，
  `tests/pod-transition.test.mjs:465`–`482`）；**全文件无「挂载收敛后主区无标记」
  断言**（V-P3.1–V-P3.6 逐条核对）。
- **硬证据（本轮复算）**：以仓库自带 mini-React 桩（`tests/pod-transition.test.mjs`
  的 harness；其 `useEffect` 在 deps 账为空时判 stale＝挂载即跑，与真 React 同口径）
  装载真实 `lib/client.js`，渲染 `PodOverlayLayer`（`s.selectedBotId="bot-x"` 预选
  场景＝I4 恢复后重进保选的常态形态），挂载收敛后：

  ```
  seat-detail className = "pod-pod-view pod-pod-seat-detail pod-pod-view-in-1"
  ```

  即标记在层根进场动画（`[data-state="entering"]`，200ms）**同期**已落上。真机时序：
  首帧无标记（效应前提交）→ 效应 flush 落标记 → 切席位淡入上浮（CSS
  `[class^="pod-pod-view-in-"]` 段，`podLayerCss` 过渡块）与层根进场动画**叠加播放**
  ——正是票 05 所称要避免的「重影」。
- **影响场景**：持有有效选中再进 Pod（`enter()` 按 I4 口径不再清 `selectedBotId`，
  `lib/client.js:3918`–`3934`）→ 进场时层根与主区各播一次 200ms 淡入上浮。首次
  进入（无选中、刷新自动选回）属「席位出现」形态，观感是否合意由接受方判定；
  `prefers-reduced-motion` 下退化瞬时标记（`lib/client.js:620`／`633`），无叠加。
- **影响面**：仅视觉层；未发现崩溃、数据、权限、泄漏路径。票 11 六条人工判据走查
  未做（IN-FLIGHT：待用户走查署名），走查时重点看「重进保选」路径即可捕获。
- **候选修法（仅供评估，不预设）**：a) `[botId]` 效应加首跑跳过（useRef 守卫）；
  b)「已过首帧」位改为与序号无关的渲染期可读位；c) 接受现状但订正票 05 第 2 点
  措辞＋补回归断言锁实际行为。三者 diff 均极小。

## 五类专项核验：无高置信新增风险（核验路径留档）

- **运行错误**：浏览器 API 访问全带守卫（`podReducedMotionQuery` 缺 matchMedia 退
  false：`lib/client.js:620`；`podSetTimeout`/`podClearTimeout` 缺 window 退
  globalThis：`663`；焦点兜底里 `closest`/`querySelectorAll` typeof 判定：
  `1531`–`1560`）；`podTokenVar` 仅对未登记令牌抛错（单源自封闭，实际不可达）；
  91/91 独立实跑全绿。除 F1 外无其他运行时偏离。
- **数据丢失**：`enter()` 语义变化（清 `selectedBotId` → 保留＋`selectionInit:false`）
  为 I4 复核有意恢复（票 04 Comments 在案）；草稿表 `podDrafts` 跨进出/切席位保留；
  `resolveSelectionAfterRefresh`（`lib/client.js:1731`）纯函数单源，语义与票面记录
  一致；窗口 diff 无破坏性写入。
- **权限绕过**：`lib/org/permissions.js` 窗口内仅 2 行改名；`api-security`/CSRF 门
  未动（快照 `lib/index.js` `handleApi` 的 Sec-Fetch-Site 门与 `_csrf` 引导端点在位）；
  M7 就地降级判定（`isPortaledLayer`：`lib/client.js:1516`，非 portal 时不对背景置
  inert）只在旧运行时退化路径生效（避免自锁的文档化取舍），快捷键隔离仍由层根
  modal 契约（role=dialog/aria-modal + `POD_MODAL_SELECTOR`）把守。
- **资源泄漏**：过渡计时器闭环——进场实例入 `podTransitions` 注册表，层卸载清理面
  调 `disposePodTransitions()`（`lib/client.js:3705`）、`exit()` 出场分支清进场计时
  （`3952`）、取消退出清 `podExitTimer`、`resetPodTransitions` 测试缝兜底；
  `focusin` 监听 add/remove 成对（`1531`–`1560`）；inert 采集/释放在挂载效应清理面
  成对（`3690`–`3705`）。理论残余：宿主在出场 200ms 窗内整体 teardown 时
  `podExitTimer` 悬挂一拍——单次触发、`finishExit` 幂等、无累积，判非风险。
- **跨端兼容**：混部窗口（部署记录：client 面已刷新、host 未重启）——wire 协议
  字面量全数保留（IPC 型 `dsh-bots:org-*`、头 `x-dsh-bots-*`、`BOT_ID_HEADER`、
  插件名/部署目录 `plugins/dsh-bots`、rpcPrefix），与 12 号票 `codeFaceOldNameScan`
  的显式许可清单（`tests/pod-spec-face.test.mjs:558`–`587`）逐项吻合，新旧混部
  协议兼容成立。`:has()` 选择器为存量形态（非本窗口新增）。mini-React 桩的挂载
  效应语义经逐条核验与真 React 一致，F1 非桩差异所致。

## 已评估、不构成新增风险（在案取舍，抽样）

- 「出场 200ms 窗内取消退出 → 进场 hook 态滞留 entering、动画重放一次」边缘——
  本轮独立复核确认其机制描述准确，票 05 Comments 已登记为**已知微边缘口（接受，
  不修）**，留真机走查后定夺。
- main 的 4 个窗口提交只动 IN-FLIGHT.md，无审计面；`AGENTS.md` 窗口内仅标题改名
  （dsh-bots → Pod），纪律正文未动。
- 12 号改名扫边界核验：快照 `lib|scripts|tests` 内剩余 `dsh-bots` 记号全部落入
  扫描门许可类别（wire 头/部署目录/rpcPrefix/data-*），无漏网未许可项。

## 交接问题（请接受方评估确认）

- **Q1（F1 裁定）**：真机「重进保选」路径主区与层根双 200ms 淡入上浮叠加——按
  票 05 原判据属「重影」应修，还是接受为常态？若修，取 a/b/c 哪个方向？
- **Q2（F1 断言缺口）**：「挂载收敛后主区视图无切席位标记」（或反向锁实际行为）
  是否应补进 V-P3.3 断言集？harness 已具备复算能力（本票 F1 节即为复现步骤）。
- **Q3（走查覆盖）**：票 11 六条人工判据尚未署名——是否补一条「重进保选」专门
  路径？
- **Q4（待并时机与混部收口）**：`integration/pod-core`（`31b1879`）待并——F1 裁定
  先于并入，还是先并后修？host 侧重启（混部窗口收口）由哪批触发，215/215 部署
  口径是否要求 host 重启后同步复验？
- **Q5（已知边缘归属）**：票 05「已知微边缘（取消退出重放）」的真机走查结论落在
  票 05 Comments 增补还是票 11 收口记录？

## 验证记录（本次实际执行）

- `git archive 31b1879` 干净快照；全量回归独立实跑 91/91 文件通过
  （`node tests/run.mjs`）。
- 改名扫 285 个变更 hunk 归一化甄别（dsh-bots→pod 归一后逐对相等）；8 处不相等
  者逐一核验＝注释/`LOCALE_NS`/生成文本注释行，无逻辑夹带。
- F1 复算脚本（mini-React 桩装载真实 `lib/client.js` 渲染 `PodOverlayLayer`）实跑
  出证（输出见 F1 节）；脚本存审计临时目录（易失），复现步骤已嵌入票面。
- 未执行：宿主启动、HTTP/UI 端到端、真机目视走查、混部部署实测（只读审计边界）。

## 边界与落档状态

- 本轮只读：未改代码、未提交 git、未触外部状态。票面文件落票板即发布；**不提交
  git**（主工作树有并行会话在制：`skills-lock.json` 修改、IN-FLIGHT 在办行），
  与 #37 当轮同款处置，建议随待并批收口时补一笔提交。

## Comments

- （空，待接受方。）

## Comments

> *This was generated by AI during triage.*

- 2026-10-11 triage 复核与用户裁定（zcode 收口会话）：
  - **F1 独立复算成立**——mini-React 桩装载真实 `lib/client.js`，预选场景挂载收敛后
    `seat-detail className = "pod-pod-view pod-pod-seat-detail pod-pod-view-in-1"`、层根
    `data-state=entering`，与票面证据逐字一致（复算过程两轮「不成立」均为复算桩自身缺陷：
    状态槽清除／缺每轮游标，修正后成立——侧面验证了票面「桩语义与真 React 一致」的声明）。
  - **Q1＝修，方案 a 变体（挂载门）**：pod/16 落地——`[botId]` 效应以效应创建拍 `mounted`
    为门（与 useRef 首跑守卫语义等价，但不位移 ref 调用序——overlay 回归以 `useRef.at(-1)`
    寻址层根）。
  - **Q2＝补断言**：`tests/pod-transition.test.mjs::V-P3.3 补`（预选挂载收敛后无标记＋首次
    换代仍打标记）。
  - **Q3＝并入修复批**：六条署名判据不重开；修复批部署后用户十秒目视「退出→重进（保选）」
    单次淡入。
  - **Q4＝已被历史解掉**（core 已并已部署）；host 重启维持待点名；F1 修复部署＝小批拉齐
    （含 retro 批九件一并 all-same）。
  - **Q5＝票 05 Comments 增补**（已知微边缘的走查结论归属），票 11 不再动。
  - 五类专项核验结论（除 F1 外无高置信新增风险）经读核与仓库现状吻合，无追加发现。
  本票使命（审计＋裁定）完成，转 resolved；实施与验证证据见 pod/16 Comments。
