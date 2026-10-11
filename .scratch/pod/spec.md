# Pod（pod）规格：切换微交互与工具面／形制对齐

Status: resolved（2026-10-10 core 批实施完成；07／08／09 由用户裁定搁置，见各票 Comments。
改名批 12–15：12 resolved；13–15 仓库内面完成并经评审返修（2026-10-11），运行面件
（部署同步／重启链／数据迁移／新 runId 包）待授权窗口，见各票 Comments 与
`.scratch/pod/rename-migration-plan.md`）

- **来源**：本轮 grilling 会话（转写 `.tmp/pod-ctx/1257a68e.txt`，5551 行）的裁定；共识蒸馏
  见 `.tmp/pod-ctx/consensus.md`（只读入口）。15 票切分经用户批准（转写 L5284
  `4保留ptc，其他我没有建议`；Q19–Q25 由 L4238 `abc都做，其余无异议` 确认；Q26 另见
  L4470）。
- **性质**：终点＝规格。只定**契约与判据**，不含实现代码；工单与执行由
  `.scratch/pod/issues/01…15` 承接（01 号票即本文件的交付票据）。
- **判据冻结**：本文件正文与**附录 A 判据清单同批冻结**。此后：①实现批**只能补执行坐标**，
  不得改判据语义；②判据增删改走显式修订（规格改版或 amend ＋ CHANGELOG 授权依据 ＋ 注明
  触发者与理由）；③**验收执行开始后不得新增判据**（org-v2 方法论 #2 同源）。
- **词表纪律**：领域词依 `GLOSSARY.md`（01 号票收「Pod」词条）；**不另造同义词**。
- **官方基准锚点**（Q4a，L1149）：以**本机现役安装的 `@deepseek-ai/dsh`** 为准；版本号
  只作诊断字段、**不作门**，门只由行为断言把守（转写 L728-730）。
- **权威与冲突**：冲突时以转写原文的用户裁定为准；助手单方建议而用户未拍板者**不作裁定
  引用**，一律进 §G 缺口补写清单。票面刻意不含行号与代码片段，只点名符号／挂载面。

---

## Problem Statement

用户的原始诉求见转写 L52（全文引用）：

> 我有两个改动点1.增加点击pod切换页面的微交互细节，也就是切换不是卡顿式强切换，
> 2.agent本身工具面与官方保持一致，这里语义会有一些偏移，不是规定某个席位的工具面，
> 是所有的基础，有点难表达，就是LLM工作的harness与官方保持一致，就像我提要求，
> 然后他在页面上显示调用什么工具，如果已经做的就是一样的，那就是前端显示上的修改，
> 与官方保持一致

落在今天的实现上有七条具体问题：

1. **进出 Pod 是抢槽式强切**。宿主 `main`／`sidebar` 槽切换＝卸载旧组件树、挂载新组件树
   （`ui-renderer` 的 `entryKeyOf` 自增 key）；Pod 进出会注册／注销官方槽位条目。结果：
   官方会话滚动位置与工具卡展开态必丢（composer 草稿因官方 store `persist:"dsh.conversation"`
   不丢）（转写 L1695-1697）。
2. **宿主不提供 keep-alive，也没有面板切换动效**；官方只有列宽过渡（`--ds-transition-*`
   由 `[data-animating]` 门控），设计令牌里**没有** `--dsw-*` 动效令牌（转写 L1695）。
3. **进入 Pod 的旁带跳变**：强展／强收官方侧栏；`ctx.layout.closeDetails()` 在现装宿主
   **不存在**，现在靠 `try/catch` 吞掉——是死调用，官方右栏根本不被关（转写 L1696、L1710）。
4. **工具调用不可见**：邮件面只有扁平文本消息 `{id, text, from, timestamp}`，无工具调用、
   无推理；工具事件只存在于会话日志，前端从未消费（转写 L754、L946）。
5. **呈现面分叉**：bot 子进程无条件注入 `DSH_TOOLS_MODE=ptc`，模型只见 `run_code` 信封；
   而基底 preset 是**死键**（`bot-nopersona`）偶然回落官方默认 `standard`——「基底＝官方默认」
   这件事没有显式口径，只有巧合（转写 L4023、L4037）。
6. **形制两套**：Pod 自有信息（外部触发行、讨论组／relay 折叠组）与官方 `turn-trigger`
   形制不一致；右下角通知面是另一套官方形态（转写 L2447-2452、L2545）。
7. **命名三分裂**：插件名 `dsh-bots`、入口标签已是 `Pod`、历史别名「Bot 模式」并存；
   且「Pod 是否指席位」没有定形（转写 L639、L1327、L1732-1734）。

---

## Solution

以「**过程面沿官方、组织面留自有、以回合为界拼装**」为总口径，分三块落地：

- **改动点①（切换）＝覆盖式常驻**：Pod 不再抢宿主槽位，而是 `shell.overlay` 注册宿主组件＋
  整屏层 portal 到 body；官方会话页与侧栏在 Pod 期间**全程挂载**，退出＝撤层。配一套过渡
  语言（淡入＋约 4px 上浮、约 200ms，令牌取宿主 `--ds-*`），并做焦点／键盘隔离
  （modal 契约＋`useModalLayer`＋背景 `inert`）与旁带跳变清理。
- **改动点②（工具面）＝L1／L2／L3 全对齐**：L1 基底＝**官方默认 preset `standard`（27 工具）
  ＋呈现面 ptc**（保留 PTC；显式写明并附实测证据）；L2 新增宿主只读投影
  `BotsApi.trace(id, since)`（与 `api.stats` 同款双路，PTC 内层工具名不别名化、不丢失）；
  L3 在 Pod 会话流里按官方形制渲染工具调用（通用行＋四类专用行＋回合折叠头）。
- **回合级拼装规则冻结**（票 07 的唯一前提）：邮件面消息与会话事件按「回合」拼装，
  规则见 §E（可执行形式；细则属缺口补写，已在文内显式标注）。
- **命名定形**：`Pod` 为唯一视觉形态、标识符一律小写 `pod`；「席位／岗位」词不外借；
  改名 A／B／C 三组全做、**功能先行、改名独立批**，C 组先出方案再执行。

---

## User Stories

### 切换与保活（改动点①）

1. 作为用户，我希望进出 Pod 是「盖层／撤层」而不是抢槽强切，以便回到官方页时滚动位置、
   工具卡展开态与进行中回合可见进度都在。
2. 作为用户，我希望进出 Pod 有克制的过渡（淡入＋极轻上浮），且在 `prefers-reduced-motion:
   reduce` 下退化为瞬时，以便系统级偏好被尊重。
3. 作为用户，我希望 Pod 期间 Tab 不跑到被盖页控件、宿主快捷键（含侧栏切换类命令）被拦、
   Esc／Tab／焦点归还符合官方 `useModalLayer` 契约，以便键盘操作不迷路。
4. 作为用户，我希望官方弹窗（设置、确认）仍能盖在 Pod 之上，以便危险确认不被遮挡。
5. 作为用户，我希望进入 Pod 不再擅自展开／收起官方侧栏，以便宿主布局按我离开时的样子。
6. 作为用户，我希望 Pod 内切席位再切回时草稿／选中／滚动保留，以便来回对照不丢上下文。
7. 作为用户，我希望 Pod 被关闭时官方页原样回来（含 `inert` 原值还原），以便宿主状态不被
   我的插件改坏。
8. 作为用户，我希望 Pod 覆盖期间官方会话仍在正常推进（流式跟随继续写 `scrollTop`），
   以便我撤层时看到的是最新进度而不是冻结画面。

### 工具面与呈现（改动点②）

9. 作为用户，我希望 bot 的**基底**工具面就是官方默认会话的那一套（同集合、同名、同语义），
   以便 LLM 工作的 harness 与官方一致；按岗位追加的 org／knowledge 工具算叠加、不算偏离。
10. 作为用户，我希望 Pod 会话流里看得到「这一步调用了什么工具」，含名称、参数、状态、
    输出与错误，以便不需要去翻会话日志。
11. 作为用户，我希望保留 PTC 也不挡真实工具名（外层 `run_code` 信封＋内层工具子调用行），
    以便既跨 provider 一致又能看到 `read`／`bash`／`task.triage`。
12. 作为用户，我希望回合结束后工具行收成「N 次工具调用」折叠头，刷新或隔天回看与当场一致。
13. 作为用户，我希望 `bash`／文件改动／`read`／`search` 有专用行（终端输出、diff、路径、
    命中摘要）；未识别工具回落通用行、不出现空白行或裸 JSON。
14. 作为用户，我希望 Pod 自有的「外部触发」「讨论组」信息改用官方 `turn-trigger` 形制，
    以便整个会话流只有一套读法；右下角通知保持轻量。
15. 作为用户，我希望无工具调用的回合呈现与今日完全一致，以便功能批零回归。

### 命名与改名

16. 作为用户，我希望插件正式叫 `Pod`（视觉 `Pod`、标识符小写 `pod`），且「席位／岗位」
    继续用既有词、不被 Pod 取代。
17. 作为用户，我希望改名是**独立批、功能先行**，一次做完 A／B／C 三组（数据面先方案后执行），
    以便不留「代码叫 dsh-bots、界面叫 Pod」的错位；运行面动作逐项点名授权。
18. 作为用户，我希望冻结件与历史件保留旧名不回改，以便证据链与既有裁定不被重写。

---

## Implementation Decisions

### A. 命名与术语

- **A1 规范名与大小写**：视觉形态 `Pod`，**标识符一律小写 `pod`**。依据：宿主包名校验只收
  小写，大写 `Pod` 装不上（转写 L3168、L3181）；Q20 推荐经 L4238 确认；票 01 验收项。
- **A2 指代范围**（Q11a，L2268）：**Pod ＝本插件与整页形态的规范名**，**不是**席位的称呼。
  席位继续用既有词（岗位／岗位实例／席位）；若用 Pod 兼指席位会与「岗位实例（席位）」词条
  重叠、使 GLOSSARY 出现同义词（转写 L1734）。
- **A3 不外借（负向约束）**：「席位／岗位」词**不得**被 Pod 取代或并列使用；GLOSSARY 词条须
  显式写明（票 01 L12；共识清单 L4441）。
- **A4 旧别名与冻结件**：`Bot 模式` 收作 `_Avoid_`（历史别名）；代码内部名（槽位、组件名）
  不必随之改名（转写 L639、L742）。入口标签**已经是 `Pod`**（`entry.label`，zh/en 同源），
  该档无剩余工作（转写 L1327、L3228）。冻结／历史件（`docs/TEMP-guidance-*`、
  `docs/CLOSURE-*`、历史 CHANGELOG、`artifacts/packages/`）旧名残留**不回改**（转写 L4443；
  票 12 L12-13）。
- **A5 定形落点**：`GLOSSARY.md` 收「Pod」词条（含 `_Avoid_: Bot 模式`）；本规格与票面一律
  用该词。

### B. 改动点①：覆盖式常驻与进出契约

- **B1 范围**（Q1 `1.AB`，L1149）：A｜进出切换（官方会话页 ⇄ Pod 整页）＋ B｜席位切换
  （列表开席位／返回列表／换席位）**都做**，统一一套过渡语言。Q1 未逐项点名 C（详情面板
  开合）与 D（窄屏强展／强收侧栏）；与「进入 Pod 不再主动改变宿主布局状态」冲突者按 §G-G5
  处置。
- **B2「不卡顿」口径四条全要**（Q2 `2.都做`，L1149）：① 视觉过渡；② **状态延续
  （keep-alive／不卸载官方页）**；③ 首帧不空（不空白、不跳版）；④ 进出旁带跳变不突兀。
  用户选「都做」＝明确接受把 Pod 从「抢槽」改成「覆盖式常驻」的结构改动（转写 L712）。
- **B3 覆盖式常驻的动作契约**（Q7 `7.都做`，L2268 ＋ Q23a，L4238）：
  1. **不再抢占宿主槽位**：进／出 Pod 不再 `slots.register`／注销官方 `sidebar`／`main`
     条目——官方条目账本不受影响（票 04 L12）。
  2. **覆盖层照官方范式**：`shell.overlay` 注册宿主组件，把真正整屏层 **portal 到 body**
     （`position:fixed; inset:0`）（转写 L3540、L3605）。
  3. **模态语义**：`role="dialog"` ＋ `aria-modal="true"`（`data-shortcut-modal` **可选**，
     未裁定——保留为可选，见 §G-G2）。
  4. **焦点契约**：`primitives.useModalLayer`（Tab 囚笼／Escape／焦点归还；primitives 公开
     导出）（转写 L3419、L3605）。
  5. **背景 `inert`**（Q23a）：见 B5。
  6. **退出＝撤层**；官方页与侧栏在 Pod 期间**全程挂载**（票 04 L4）。
  7. **旁带清理**：进入不再强展／强收官方侧栏；`ctx.layout.closeDetails()` 死调用替换为
     现役 API（如 `closeRightbar()`）或删除（转写 L1710、L5363）。
- **B4 保活判据**（Q7 L3，转写 L4446）：进出各一次后，**官方会话滚动位置、工具卡展开态、
  进行中回合的可见进度**保留；Pod 内切席位再切回，草稿／选中／滚动保留。**不得**以
  `hidden`／`display:none` 实现隐藏——会丢滚动位置并重置展开态，恰好毁掉要保活的东西
  （转写 L3591、L4449；票 04 L23）。事实依据：宿主不提供 keep-alive（转写 L1695-1697）。
- **B5 焦点／键盘隔离与 `inert` 红线偏离**（Q23a，L4238）：键盘阻断＝**DOM 模态契约**——宿主快捷键分发器每次 keydown 现场读 `[role="dialog"][aria-modal="true"], [role="menu"]` 的最后一个元素，未声明该 modal scope 的命令一律 `blocked`＋`preventDefault`（含侧栏切换类命令）（转写 L3419、L3606）。焦点隔离＝给**背景 body 子元素设 `inert`**（引用计数＋卸载还原；官方设置页原样做法）——**不写宿主 DOM 时，被盖页面的程序化聚焦（官方 composer 的 `focusDraftEditor`）仍可能抢焦点**，故 `inert` 是唯一可靠解（转写 L3419、L3607、L3544、L3615）。**红线偏离**：本仓前端红线＝只依赖宿主显式注册面（slots/layout/locale/primitives/inject）、禁读私有 DOM 与样式钩子；写宿主 DOM 的 `inert` 属**授权偏离**，须**登记为新 `HF-CLIENT-*` 面＋挂行为探针**并立 ADR（ADR-0001）。**LIFO 还原**：官方层后开先关、各自还原「自己看到的值」→ LIFO 成立；极端序（官方 modal 开着时退 Pod）不可达（官方层盖在 Pod 之上）（转写 L3574、L3618）；该语义**目前是纸面推演**（未实测），由票 02 探针＋票 04 单测把守（票号映射见票表：探针归票 02、单测归票 04）。
- **B6 已知边界（接受）**（转写 L3407、L3587、L3591、L3604、L3454、L3592、L3609）：① **层叠**：`shell.overlay` 容器自身即 `z-index:20` 层叠上下文，官方 body 级浮层在其上（onboarding `900`、primitives Modal／设置面板 `1000`、平台页 `1001`、Toast／Menu portal／排程弹层 `1100`）——**接受**官方弹窗盖在 Pod 之上（通常正是想要的）；② **同层 `order`**：同层按 `order` 升序，现用 `order:-10` 会排在官方 overlay 条目之下，处置＝**不依赖 `order`**，用 portal 的 z-index；③ **几何**：`shell.overlay` 挂 AppFrame 最外层、覆盖侧栏＋主区＋右栏整屏，锚点 `display:contents` 无盒子、祖先链无 `transform/filter/contain/container-type` → `position:fixed;inset:0` 不被裁剪／重锚；④ **覆盖期间官方页持续活着**：流式跟随在「已在底部」时继续写 `scrollTop`——属要保活的状态本身，不是缺陷；⑤ **运行时待确认**：3080 是 web 还是 desktop（desktop 走原生桥、DOM 阻断失效 `if (native) return;`），列入真机走查项。
- **B7 先决条件与失败形态**（Q18 `18c`，L3243）：**先代码级论证，再真机走查**（用户所见选项 L3025-3027「先(a)再(b)」）；静态论证已过（转写 L3602-3609）。真机走查（进/出 Pod、Tab/Esc、常用快捷键、焦点不被抢）安排在**实现之后**（票 04 验收末项），结论回写票面 Comments。覆盖层路线若有**关键不可解项**，按 Q7 先决条件退到「L1＋L2＋过渡动画」并把结论写进决议记录（转写 L1710）；不得静默降级。

### C. 过渡动效（票 05）

- **C1 形态**（Q8 `8.接受`，L2268）：淡入＋约 **4px 上浮**、约 **200ms**，**不做方向位移**（更贴官方克制风格）（转写 L1716、L4448）。
- **C2 令牌口径**：时长／缓动取宿主 `--ds-transition-duration`（含 `-fast`／`-slow`）＋`--ds-ease-in-out`，**带常量回退**，并**扩 `HF-CLIENT-VISUAL` 登记一条**（经适配层收敛、不硬编码）（转写 L1716、L5260）；宿主设计令牌**没有** `--dsw-*` 动效令牌，官方只有列宽过渡（`[data-animating]` 门控）（转写 L1695）。
- **C3 范围与退化**：进／出时**侧栏与主区同一过渡**，**Pod 内切席位只过渡主区**；`prefers-reduced-motion: reduce` 下**退化为瞬时切换**（宿主既有处理即此口径）（转写 L1716、L4448）。
- **C4 约束**：过渡期间无白屏帧、无布局跳动；动效**不得**依赖 `hidden`／`display:none`（保活前提），也不得引入宿主私有样式钩子（转写 L4449；票 05 L15）。

### D. 改动点②：L1／L2／L3 分层

- **D1 分层定义与边界**（Q3 `3.c`，L1149；转写 L718-724）：**L1 运行层**＝bot 会话实际能调用的**基础**工具集合，与官方默认会话同集合／同名／同语义（org／knowledge 工具算**叠加**）；**L2 数据层**＝Pod 前端拿到的回合事件含工具调用（名称、参数、状态、输出），与官方前端消费的事件同源同形；**L3 显示层**＝渲染成官方同款（组件、信息量、展开/折叠与状态表现）。**边界**：只对齐**基础面**，**不触碰**「按岗位裁剪工具面」的既有设计——`lib/org/op-set.js` 岗位 op 集是组织层契约，不是 harness 一致性的一部分（转写 L722-724、L5411；用户原话 L52）。

#### D2. L1：基底显式化与呈现面（票 10）

- **终局口径**（Q27 `4保留ptc`，L5284）：**保留 PTC**（`DSH_TOOLS_MODE` 无条件注入不动）；显式写明「**基底＝官方默认 preset `standard`（27 工具）＋呈现面 ptc**」，不再靠死键偶然对上（转写 L4803；票 10 L10-11）。**为何不切 native**：会把「模型指派」这一用户域旋钮与呈现面绑死（GLOSSARY 明写「岗位-模型解耦」是架构义务），且组织 op 名带点是裁定级合同、`niko` 类 provider 直接 400（转写 L4759-4763、L4800-4803）。
- **27 工具清单（实测）**：`bash read write edit read_image glob grep job_output job_list job_kill skill get_goal create_goal update_goal exit_plan_mode send_message interrupt_agent list_agents subagent subagent_fork list_subagent_models workflow ask_user_question todo_write web_search web_fetch present`（转写 L4024）。
- **关键事实**：① per-bot `settings.yaml` 的 `agent-presets:` 段在 0.2.0-rc.1 **完全不进入解析**（无 per-profile 读者），现行命名空间＝profile entry `agent-preset-registry` 的 `selectedDefault`；无覆写 → 回落官方默认 `standard`（转写 L4023、L4061）；② 官方侧**没有任何工具名校验／清洗／别名映射**（native 原样发、PTC 加引号生成进 SDK）（转写 L4025、L3952）；③ **PTC 不挡真实工具名**：一份 PTC 会话（1728 事件）同时含 `tool/call`（137，外层 `run_code`）与 `tool/ptc-dispatch-start`／`tool/ptc-dispatch`（各 212），内层真实名可见；官方对 PTC 的渲染本来就是「`run_code` 行＋子调用树」（1728 事件数与计数转写 L4790、L4792；内层真实名 L4734、L4793；官方事件白名单与 `subCalls` L4742、L4794）。
- **取证证据**（Q24a／Q26a）：`opencode-go` 带点名 **200 接受**；`niko` **400 拒绝**（错误模式 `pattern '^[a-zA-Z0-9_-]+$'`）——结论**只对当前网关注效、不可外推**（转写 L4798、L5409、L4035）；留档用途＞决策用途（Q27 已改判保留 PTC）。
- **死配置清理范围**（Q25a，L4238「其余无异议」）：清除 per-bot `settings.yaml` 的 `agent-presets` 段与 profile patch 的 `settings` 死重定向行（`dsh-settings` 不声明 Config schema）；**生成器同步** `lib/shared.cjs`、`lib/index.js`、`scripts/create-bot.cjs`；**反向验证** `dsh --dump-config` 不再出现该段；既有 bot 的 profile 清理属运行面写入，等点名后执行（转写 L4037、L5410；票 10 L15）。
- **静默降级收口**：写明「bot 基底＝官方默认 preset `standard`，**人物设定不裁**」，收掉 `bot-nopersona`「去 persona」从未生效这条静默降级（转写 L4228、L4037）。**边界**：不碰 `lib/org/op-set.js` 岗位 op 集与 op 命名合同（票 10 L16）。
- **观察项（非本批工单面）**：`~/.dsh/.agent-presets/` 死目录＋13 断链软链 → 按 AGENTS §5 登记 `docs/PROJECT_UNDERSTANDING.md`「仍可选题」＋当月 CHANGELOG 留界（转写 L4233、L5412）。

#### D3. L2：数据面契约（票 06）

- **路线与读面**（Q15 `q15.a就可以`）：服务端读 bot 会话日志投影（复用 `lib/stats.js` 现成的多帧 zstd 解码／分片定位／mtime+size 缓存）→ 只读接口给 Pod；**不新增落盘面、不动冻结的邮件键封闭**；「事后可回看」天然成立，代价＝「当场看」有秒级延迟（跟文件写入节奏）（转写 L2998、L4453）。读面符号（消费者逐字依赖）＝`BotsApi.trace(id, since)`，挂 `GET /api/pod/:id/trace`；与 `api.stats` **同款双路**：在线 RPC（`session.history`）优先 → 离线读盘（`readSessionEventsFromFile`）回落；复用其 mtime／size 结果缓存与增量语义（转写 L5137-5140、L5378）。
- **记录形状（冻结，消费者票 07 逐字依赖）**：

  | 字段 | 类型 | 语义 |
  |---|---|---|
  | `seq` | int | 同一会话内严格递增的事件序（排序键） |
  | `time` | int | 事件时间（ms，与会话日志 `event.time` 同源） |
  | `callId` | string | 工具调用 id（外层信封与内层子调用各自的 id） |
  | `parentCallId?` | string | 子调用指向所属信封的 `callId`；顶层记录缺省 |
  | `name` | string | 工具名（**内层真实名，不别名化**） |
  | `argsRaw` | string | 参数原样文本（展开体显示，不做结构重写） |
  | `state` | enum | `preparing｜running｜ok｜error｜stopped` |
  | `outputText?` | string | 输出文本（有则原样，pre-wrap 呈现） |
  | `isError` | bool | 结果是否错误 |
  | `errorText?` | string | 错误文本（`isError` 为真时） |
  | `turn` | int | 回合号（拼装锚定键，见 §E） |
  | `step` | int | 步号（同一回合内递增） |
  | `subCalls[]` | record[] | PTC 内层子调用（同形状递归；`parentCallId` 回指信封） |

- **`state` 判定（形态冻结、映射以票 06 实现为准）**：`preparing`＝已见 `tool/call` 尚未见
  派发／结果；`running`＝派发已开始（`tool/ptc-dispatch-start`）或步内在执行；`ok`＝
  `tool/result` 正常返回；`error`＝结果带错（`isError`＋`errorText`）；`stopped`＝回合中断／
  未闭合而进程停止。
- **PTC 语义**：外层 `tool/call`（`run_code`）作**信封**，`tool/ptc-dispatch*` 的内层工具名与
  其结果归入该信封的 `subCalls`——**内层名不得被别名化、不得丢失**（转写 L5380；票 06
  L17-18）。
- **边界**：邮件面行键（inbox／outbox）与 `session-driver` 回合返回形状（`{text, sessionId}`）
  **均不变**（转写 L5381；票 06 L19）。
- **fail-closed**：缺会话／损坏日志返回空或显式错误，不得抛到 HTTP 面外（票 06 L21）。
- **形状漂移纪律**：票 07 逐字依赖本记录形状，形状变更须走票面 amend（票 06 L10）。

#### D4. L3：显示范围与实现手段（票 07／08）

- **做**（Q16 `16 b`，L3243；转写 L2946-2950）：**通用行**（图标＋工具名＋参数摘要＋状态（preparing／running／ok／error／stopped）＋时间＋chevron；展开看参数体与输出体，pre-wrap、限高、可滚动）＋**回合折叠头**「N 次工具调用」（可展开；N 口径见 §E2-R3）＋**四类专用行**（`bash` 命令摘要＋输出体、文件改动 diff 视图、`read`、`search` 路径／命中摘要＋展开明细）。
- **PTC 信封与回落**：外层 `run_code` 行下挂内层工具子调用行（官方同形）（票 07 L14；转写 L4740）；未识别工具一律回落通用行，不得出现空白行或裸 JSON（票 08 L13）。
- **不做（增量项，等真实用例）**：todo 面板、问答卡、子调用树的全量复刻（转写 L2950）；独立「轨迹」页签（官方 `dsh-client-ui-trajectory`，developerTools 开启）**不在范围**（转写 L2989）。
- **实现手段**：官方组件**不可复用**（无 `exports.ToolCallTree` 之类导出；TS 子路径不在 package exports；全树 71 个 `dsh.client` 包里 `external` 只出现过 `["@deepseek-ai/dsh-api-gateway/client"]` 一种取值）→ **按形制用 primitives＋令牌复刻**（转写 L2597、L2784、L3011）。
- **形状纪律与零回归**：不自造第二套视觉语言（图标走官方 primitives 变体后缀名 `IconXxxOutlineRegular`、字号与令牌口径一致）（票 08 L14；票 03 L17）；无工具调用的回合呈现与今日一致（票 07 L16）。

#### D5. 分区口径与形制统一（Q9 `9.接受`；Q14 `q14按推荐`）

- **分区口径**：**过程面以官方为准；组织面（relay／席位／通知）保留 Pod 自有；两者以「回合」
  为界拼装**（转写 L1722、L4455）。固化判据：「**Pod 不得自建与官方形状不同的工具显示**」
  （转写 L1722）。
- **形制来源**：官方组件 `TurnTriggerNodeView`（`dsh-client-ui-chat`），注册在 keyed 槽
  `conversation.chat.node`、key `turn-trigger`；语义＝「解释非人类 Turn 触发的可展开告示」
  （转写 L2447-2452、L2526）。
- **逐项参数（票 09 验收，唯一形制源）**：

  | 项 | 值 |
  |---|---|
  | 边框 | `0.5px`，`--dsw-alias-border-l1` |
  | 圆角 | `--dsw-radius-xl` |
  | 底色 | `--dsw-alias-markdown-code-block` |
  | hover 底色 | `--dsw-alias-interactive-bg-hover` |
  | 头部 `<button>` | `padding:12px 16px`；`gap:10px`；flex |
  | 图标 | `14px`，`--dsw-alias-label-tertiary`；按 kind 取（`agent` 源＝`IconPaperPlaneOutlineRegular`） |
  | 标题 | `13px`（`--dsw-font-xs-13`），`--dsw-alias-label-primary` |
  | 时间 | 右对齐 `<time>`（`margin-left:auto`，`--dsw-alias-label-caption`，`--dsw-font-xxs-12`） |
  | chevron | `12px`，展开时旋转 `180°` |
  | 展开体 | `padding:0 16px 12px 40px`；说明句（`--dsw-alias-label-secondary`，`--dsw-font-xxs-12`）＋ pre-wrap 正文（限高 `240px`，`--dsw-font-xxs-12`） |
  | 过渡 | `background-color .1s`（reduced-motion → none） |
  | aria | `aria-expanded`、`aria-controls`、`data-turn-trigger` |

- **覆盖范围**（Q14）：套用＝会话流内的「**外部触发**」行（bot 因收到邮件／任务／协作消息而
  开回合的那一条）＋**讨论组／relay 折叠组**（`DiscussionGroup`）（转写 L2545、L4456）。
  **不动**＝右下角堆叠通知（`BotNotices`，走 `shell.overlay`）**保持轻量形制**——官方通知是
  另一套形态，套用会让提示变重（转写 L2545、L4456；票 09 L16）。
- **文案**：走官方 locale 词典，zh／en 齐备，无 fallback 缺口（票 09 L17）。
- **键盘可达**：头部按钮可 Enter／Space 展开，Esc 不误关（票 09 L18）。

---

### E. 回合级拼装规则（票 07 的唯一前提；细则＝§G-G1 缺口补写，本版已写成确定口径，无「二者择一」）

#### E1 两侧数据与定义（可执行形式）

- **邮件面**：`GET /api/pod/:id/messages?since=`，扁平文本消息 `{id, text, from, timestamp}`，前端 2s 增量轮询（页面隐藏暂停）；现渲染没有工具调用、没有推理（转写 L754、L946）。
- **会话事件面**：`session.history` 全事件（含 `tool/call`、`tool/ptc-dispatch*`）只落盘在 session 日志；turn 驱动（`session-driver`）只提取 assistant 文本（转写 L764、L768-770）。推论：L2 与 L3 之间的**拼装层是新逻辑**，不是既有渲染的改造（转写 L5233）。
- **两侧游标 `since`（不可互相代入）**：① **邮件面**：`GET /api/pod/:id/messages?since=` 的
  `since` ＝ **ISO 时间字符串或 epoch 毫秒**，过滤口径＝**严格晚于**（`timestamp > since`，
  **左开**区间），缺省／非法值＝不过滤，时间戳不可解析的消息在带 `since` 时不入流——冻结口径见
  `lib/mail-plane.js::readConversation` 与 `tests/jsonl.test.mjs`；② **轨迹面**：
  `BotsApi.trace(id, since)` 的 `since` ＝ **`seq` 整数**（事件序号），返回 **`seq > since`**
  的记录（同为**左开**区间）。两侧游标**不可互相代入**（时间戳当 `seq` 用、或 `seq` 当时间戳用
  均无意义）。
- **定义**：**消息流 `M`**＝`messages(since)` 拼接后的消息数组，顺序＝服务端合并序
  （`compareConversationMessages`：`timestamp` 升序、同拍按 `id` 稳定序、无时间戳者排最前）；
  **合并序下标**＝该消息在 `M` 数组中的位置（从 0 起计）；**轨迹流 `R`**＝
  `BotsApi.trace(id, since)` 拼接后的记录数组（`seq` 严格递增，`turn` 为回合号）；
  **回合 `t`**＝`R` 中 `turn === t` 的全部记录（含各级 `subCalls`），`t0(t) = min(r.time)`；
  **锚点 `A(t)`**＝**当前已知的 `M` 数据全集**中满足 `timestamp <= t0(t)` 的
  **合并序下标最大**者（不存在则为 `null`）；**工具行组 `G(t)`**＝回合 `t` 的渲染单元
  （未闭合＝逐行实时；闭合＝计数头）。

#### E2 规则（冻结；票 07 验收逐条映射）

- **R1 锚定与排序**：`G(t)` 渲染在 `A(t)` **之后**。同拍消息（`timestamp` 相同）取其中
  **合并序下标最大**者作锚点；多条回合锚到同一消息时按 `turn` 升序依次排列；`A(t) === null`
  （回合早于任何消息）时 `G(t)` 置于流首，并计一次「无锚点」诊断。
- **R2 未闭合回合（增量追加＋锚点重算）**：闭合判定（取先发生者）＝① 会话事件含该 `turn` 的
  `turn/end`；或 ② 邮件面出现该回合的 assistant 回复消息（`from` 为该 bot、`timestamp >=
  该回合最后一条记录 time`）。未闭合时：`G(t)` 按 `since` **增量实时追加**（每次只追加新
  `seq` 与新增消息），**不显示计数头**；容器状态按记录 `state` 显示。**锚点重算（冲突裁决，
  唯一解）**：`A(t)` **恒按当前已知的 `M` 数据全集计算**——晚到消息（`timestamp <= t0(t)`）
  进入 `M` 后**允许并应当重锚**（`G(t)` 随 `A(t)` 更新位移）；「只追加」约束的是**工具行集合**
  的增量呈现，**不豁免锚点重算**。**重锚优先**：数据全集未变（追加不改变 `A(t)`）时增量与
  全量一致；数据全集变化时以重锚后的全量为准。
- **R3 闭合与计数头**：闭合后 `G(t)` 收为「N 次工具调用」折叠头（可展开）。**N ＝该回合
  顶层记录数**（外层 `run_code` 信封计 1；`subCalls` 随展开呈现，**不重复计入 N**）——
  与官方「`run_code` 行＋子调用树」读法一致（此计数口径属缺口补写，见 §G-G3）。
- **R4 一致性（幂等／可重放）**：拼装必须是纯函数 `assemble(M, R)`，满足：**对同一数据全集，
  增量调用（多次 `since`）与一次性全量调用产出同一序列**（数据全集变化时先按 R2 重锚再比较）。
  **分侧稳定排序键**：消息侧＝`(timestamp, 合并序下标, id)`；记录侧＝`(turn, seq)`；
  **工具行组随其锚点消息排序**，同锚点多回合按 `turn` 升序。工具行与邮件消息**零重复、零丢序**。
- **R5 边界与 fail-closed**：① 无工具调用的回合不渲染 `G(t)`、不渲染计数头（零回归）；
  ② 记录缺失／投影失败按「无工具调用」呈现并计「投影缺口」次数，**不得造空白行或裸 JSON**；
  ③ 诊断计数的**唯一可见落点＝纯函数输出** `assembleDiagnostics(M, R) → { anchorless,
  projectionGaps }`（`anchorless`＝R1 的无锚点次数、`projectionGaps`＝本条第 ② 款的缺口次数），
  由票 07 的测试断言；UI 是否呈现**可选**——**不得**改票 06 已冻结的 trace 记录形状与响应形状
  （诊断只在拼装层产出，不新增轨迹字段）；
  ④ 拼装只在渲染层消费既有消息字段，**不新增消息字段、不改 inbox／outbox 行形状**；
  ⑤ 「外部触发行」等 Pod 自有信息的形制统一（§D5）**不改变拼装锚点**。
- **R6 不可执行时的上浮口径（不得留白）**：若实现期证明 R1–R5 不可执行（无法锚定、时间戳
  不可解析、消息字段缺失导致无法排序），不得留白：先按 R1／R5 的确定性回落渲染，并把缺口
  **分解为可观测项**；分解不出即标 `needs-user` **上浮**（依据
  `lib/org/acceptance-coordinates.js::HUMAN_CRITERION_CATEGORIES` 白名单 fail-closed 口径）；
  复核两轮未闭合上浮用户终裁（`GLOSSARY.md:119`「复核点」）。

---

### F. 改名三组、批次边界与授权点

- **F1 意图与档位**（Q6，L1149；Q12，L2268）：`6。是的，这是一次重命名，本插件将正式改名为Pod`；`12.全改，保持代码层和文字层保持一致`→ 意图＝**代码里的名字与文案上的名字同名**，不留「代码叫 dsh-bots、界面叫 Pod」的错位（转写 L3119）。
- **F2 三组范围**（Q19 `abc都做`，L4238；转写 L4203-4205）：**A 组｜代码与显示标识符**＝模块 id／包名 `pod`、CSS 前缀 `pod-*`、locale ns、host 插件名、`x-dsh-bots-*` 头、`/api/bots` 前缀、日志前缀、测试与脚本字面量；**B 组｜env**＝`DSH_BOTS_*` 12 名 → `POD_*`，含仓库外现役脚本（`~/.dsh/dsh-web.sh`、`~/.dsh/restart-split.sh`）；**C 组｜运行面数据路径**＝`$DSH_HOME/bots/**`、`bot-workspaces/`（644MB）、`api/bots`、`profiles/<id>` → `pod`（含存量搬迁与 bootstrap 锚点重建风险）。**注意**：助手原推荐是「A＋B 做、C 不做」；用户答「都做」＝**推翻推荐、纳入 C 组**（转写 L5106）。**A 组分票口径**：A 组＝**票 12**（非身份标识符：CSS 类名前缀／locale ns／日志前缀／effect 标签／文案键／`data-*`／表单 id／测试与脚本字面量）＋**票 13**（身份／wire 段：模块 id／包名／插件目录／`x-dsh-bots-*` 头／`/api/*` 前缀／env 双读）；**票 12 票面明确排除包名／模块 id／env／数据路径／wire**——实施者不得按「A 组」一把梭。
- **F3 批次边界**（Q21）：**独立批、功能先行**——功能（票 01–11）先收口，改名（票 12–15）另起；改名会淹没功能 diff 并触发证据重采集与运行面迁移（转写 L3134、L4212）；**C 组先出迁移方案再动**（含双读过渡与回退面）（转写 L3197、L4442）。
- **F4 四同名绑定**：**patch 行 `name` ＝ `<profileDir>/node_modules/<name>` ＝ `package.json.name` ＝ 前端模块 id（`lib/client.js`）**，四者同名（大小写敏感）；bundle 注册 id 必须等于图行 id，否则抛 `loaded without registering`（转写 L3059、L3168、L3181）。**不存在「只改包名、模块 id／路径不动」的中间档**：改包名必连带插件目录、2 个手工软链、16 份 profile patch、部署脚本字面量（转写 L3181）。
- **F5 wire 契约与 env 双读**（票 13）：同一窗口切换身份头（`x-dsh-bots-*`）、HTTP 路由前缀（`/api/*`）、env；**env 走双读过渡**：`POD_*` 优先、兼容 `DSH_BOTS_*` **一个窗口**；仓库外现役脚本同步更新（转写 L5419）。**不改仓库外脚本的后果**：邮件通道 **fail-closed 休眠**、回合超时**回落 600s**（转写 L4204、L3076）。部署同步走既有单一实现 `scripts/deploy-sync.mjs`（`--dry-run` 先行）＋就绪核验 `scripts/org-cutover-check.mjs`（转写 L5420）。
- **F6 数据面迁移两个已知风险**（票 14）：① **注册表 bootstrap 锚点**——空注册表会触发锚点**自动重建**，改名后若不搬数据会自动重建席位；**不得以「先清空再重建」充当迁移**（转写 L3170、L3184、L5422）；② **session 分片按工作区路径派生**——分片目录名形如 `--home-beijong-.dsh-bot-workspaces-<id>--`（由 cwd 生成），改工作区根名会使**旧分片失配**（`findSessionLogFile` 按工作区路径取分片名）→ 须迁移或显式兼容，否则 stats／trace 对旧会话失效（转写 L5102、L5422）。**存量体量**：`$DSH_HOME/bots/**`（注册表 2 席、inbox 297 文件、outbox 142、knowledge、ledger 180 行、capabilities 86、started 261 行）＋`bot-workspaces/` 13 目录 **644MB** ＋`profiles/` 19 ＋`sessions/` 47 ＋`backups/` 13 批（转写 L3184）；迁移前后逐件校验（席位表、台账事件序列、信箱与回滚点数量）并留证，旧路径保留只读一个窗口（票 14 L15-16）。
- **F7 冻结件与证据链**：冻结／历史件旧名残留不回改（转写 L4443、L1740）。**冻结路径白名单（改名批扫描口径）**＝`docs/TEMP-guidance-*`、`docs/CLOSURE-*`、历史 CHANGELOG、`artifacts/packages/`——旧名命中**必须全部落在白名单内**（「应改未改」为空集；白名单外命中即红，见 V-P1.4／V-P1.5／V-P8.2）。**改名必触发重采集**：当前终版包 0010 的 `sourceManifest` 含 `lib/sentinel-safety.js`、`scripts/evidence-runner.mjs` 与 `lib/sentinel-shadow.js`（部署目录／数据路径字样）→ 须以**新 `runId`** 重采集并生成新序号增量包，旧包只读（转写 L3230）。
- **F8 授权点清单**（Q5a，L1149；Q22，L4238）：基线口径＝**仓库内实现＋测试＋本地验证；部署同步与重启等看过 diff 后再逐项点名**，**不预授权**。需逐项点名的运行面三件＝① 部署同步；② 全 bot 重启链；③ 新 `runId` 增量证据包（转写 L4442、L5268）；**C 组若做另加一次数据迁移点名**（转写 L4215）。票面须记授权依据原文（票 13 L17）。
- **F9 回退面**：库外部署件备份目录＋git 提交点；回滚决定权在用户（**不演练**）（票 13 L18；票 14 同口径）。

### G. 缺口补写清单（显式标注；无用户原话出处）

以下各条**不是**用户逐字裁定，而是为「判据不得留白」而补写的可执行口径；触发条件满足时
**回问用户**并由显式修订承接。

- **G1｜回合拼装细则**：共识只有助手提案（转写 L5235：「工具行按 `turn`／`step` 挂在触发该
  回合的消息之后，回合未闭合时实时追加」）。本规格把它落成 §E2 的 **R1–R6 确定口径**——
  锚点＝**合并序下标最大**者；**锚点重算优先**（晚到消息允许并应当重锚）；两侧 `since` **左开**
  且不可互代（邮件面＝严格晚于的时间戳；轨迹面＝`seq > since`）；诊断走
  `assembleDiagnostics(M, R)` **纯函数输出**；排序键**分侧定义**。**无「二者择一」留白**。
  **触发回问**：R1–R6 在实现期被证明不可执行，或真机走查显示呈现与预期不符。
- **G2｜portal 层 z-index 取值**：共识只裁定「用 portal 的 z-index 处理、不依赖 `order`」
  （L3550、L3591），具体取值未裁定。本规格定**约束**：高于 AppFrame 根层、**低于官方 body 级
  浮层最低档 `900`**；**不得照抄官方平台页的 `1001`**（否则会盖住官方设置面板，偏离 B6 已接受
  的边界）。取值由票 02 探针实测后登记进新覆盖层适配面——**面 id 与探针名以票 02 Comments
  的登记为准，本规格不预设 id 名**（坐标一律指向该登记）；`data-shortcut-modal` 保持**可选**。
- **G3｜回合计数头 N 的口径**：共识未定义 N（转写 L5387 只说「N 次工具调用」）。本规格取
  **顶层记录数**（外层信封计 1，子调用不重复计入）；**触发回问**：真机目视中用户认为应数
  内层真实工具调用时，按显式修订改口径。
- **G4｜判据坐标的机械落点**：org-v2 有 `lib/org/acceptance-coordinates.js` 双向锁定 60 条；
  本轮转写未讨论是否复用到 pod（转写 §9(13)）。本规格决定：**不另立第二份坐标数据件**（避免
  第二事实源），由票 11 新建 `tests/pod-spec-face.test.mjs`，做四项机械检查：① 附录 A 条目
  四字段可解析（含**人工坐标必须带白名单类别** `人工:human-visual-checklist`／
  `人工:human-knowledge-reuse`）；② 判据 id 连续；③ 级别词在**封闭三档词表**内（逐个 `＋`
  分词都在词表内）；④ 票面引用坐标存在。若 Lead／用户要求双向锁定，另开修订。
- **G5｜C／D 配套范围**：Q1 只答 `AB`；C（详情面板开合）与 D（窄屏强展／强收侧栏）未逐项点名
  （转写 L701、§9(9)）。本规格按「进入 Pod 不再主动改变宿主布局状态」处理 B3-7（含侧栏），
  窄屏行为**维持现状**；**触发回问**：实现期发现「不打磨即明显跳变」或需要改动窄屏行为。
- **G6｜观察项纳入**：`.agent-presets/` 死目录＋13 断链软链由助手表述为「除非你要它进来」，
  用户以「其余无异议」默认（转写 L4233、§9(10)）。按**纳入观察项**（登记 `PROJECT_UNDERSTANDING`
  「仍可选题」＋CHANGELOG 留界）、**不进本批工单面**处理。
- **G7｜人工判据署名与窗口**：真机目视的核验人、窗口与落点：核验人**须署名**（代签＝落档
  作假）；窗口＝票 11 收口批（部署同步＋重启链点名段之后）；落点＝票 04／11 Comments＋增量包。
  署名本身在收口期由用户给出（现阶段 `pending-signature`）。

---

## Testing Decisions

### 什么算好测试

- **只测外部行为**：判据看可观测产出、DOM／投影快照与探针三态，不看实现细节。每条判据四字段＝判据文本／**执行坐标**（测试模块名::测试名、脚本、探针 id、门号或待实现票）／**证据落点**（回归记录、探针报告、票面 Comments、增量包、人工件）／**覆盖级别**。
- **「过」只三类**：可执行判据看断言与退出码；投影／探针判据看快照与三态；**人工判据只允许两类白名单**——`human-visual-checklist` 与 `human-knowledge-reuse`，且须列明核验人（`HUMAN_CRITERION_CATEGORIES`，fail-closed：多一类即违例、缺核验人即违例）。本批只用第一类。白名单外的「人工确认」按**判据缺口**处理：分解为可观测项，分解不出标 `needs-user` 上浮（`lib/org/acceptance-coordinates.js:151-156`；票 01 L21）。
- **判定两态、fail closed**：附录 A 任一条红即不通过，无「部分通过」；不通过不自动回滚，修复再复跑，连续两轮未闭合上浮用户终裁。**数值门槛属用户域**：本批无实验数值门槛；真机走查判定项必须逐条可观测（不做主观打分）。

### 测哪些模块

- **宿主适配面与探针**（票 02）：新面登记齐备、三态可辨、既有面枚举不缩水。
- **覆盖式常驻**（票 04）：槽位账本不变、官方页未卸载、`inert` 引用计数与 LIFO 还原、
  modal 契约拦截、旁带清理负例。
- **过渡动效**（票 05）：令牌取值与回退、范围差分、reduced-motion 退化、首帧断言、
  `hidden`／私有钩子负例。
- **L2 投影**（票 06）：PTC 信封与 `subCalls`、`state` 枚举、错误／中断／未闭合回合、
  缺工具名、fail-closed、读面契约。
- **L3 显示**（票 07／08）：通用行字段、折叠头、四类专用行、回落、零回归、投影快照。
- **形制统一**（票 09）：逐项参数、覆盖范围、通知面不动、locale zh/en、键盘可达。
- **形制件抽取**（票 03）：纯重构零行为变化（既有回归全绿）＋抽取件被既有 UI 复用、
  `tests/client-disclosure.test.mjs` 的骨架／aria／受控／令牌断言；视觉零差异并入票 11 收口目视。
- **L1 基底**（票 10）：27 工具对照、死配置清理与反向验证、`--dump-config`、op 集不碰。
- **拼装**（票 07）：R1–R6 的 fixture 测试（含负例与幂等）；`assembleDiagnostics` 诊断计数可见。
- **命名**（票 12–15）：四同名、env 双读、剩余命中清单分类、迁移校验、新 runId 包链。

### 测试接缝

只用既有接缝，不新起平行体系。最高接缝＝`scripts/preflight.mjs` 的单一 fail-closed 出口
（四门 AND 成一个布尔、退出码即结论）：

1. **回归套件接缝**（既有）：`tests/run.mjs` 逐文件派生子进程，任一失败即非零退出；测试名
   本身即执行坐标。新增 pod 测试文件即抬升计数（不得低于基线 84/84）。
2. **门接缝**（既有四道）：全量回归／冻结面／三组 lint＋地图覆盖／宿主契约探针；
   宿主契约门由 `scripts/host-contract-probe.mjs` 三态把守（SKIP 分列计数可见）。
3. **宿主探针接缝**：票 02 新面以 PASS／FAIL／SKIP 断言；运行面 SKIP 视同 FAIL 的口径照旧。
4. **DOM／投影快照接缝**：前端判据以装载真实 SlotCore＋DOM 断言／投影快照为证据（本批在
   授权窗口前用仓内可执行证据，真机目视转票 11 收口复核）。
5. **人工目视接缝**（白名单内）：`human-visual-checklist` 一次，列明核验人。

**覆盖级别＝封闭三档枚举**（附录 A 末列取值**只能是**下三位词之一，或用 `＋` 连接其中多个；
`＋` 为分记号，逐个分记号都须在词表内）：

1. **常驻**＝进测试套件或门、随每批回归执行；
2. **验收期一次**（＝票面所称「实验期一次」）＝需要真实宿主／GUI／运行面或授权窗口的验收期
   执行，在票 11 收口批与票 04 真机走查中执行并留证；
3. **运行面点名**＝只能在用户逐项授权的运行面窗口执行的动作（部署同步／全 bot 重启链／
   数据迁移／新 `runId` 证据重采集）。

组合示例（本附录在用）：`常驻＋验收期一次`、`常驻＋运行面点名`、`运行面点名`。默认常驻；
词表外取值＝V-P9.3 机械检查红。

### 执行编排

- 票 02／03／06／10 在 01 冻结后并行；04 ← 02＋03；05 ← 04；07 ← 06＋03；08 ← 07；
  09 ← 03＋04；11 ← 05＋08＋09＋10 汇总四门与真机验收；12→13→14→15 为改名批串行。
- 票 11 收口：全量 preflight 四门 PASS 并记录实际计数（≥ 基线 84/84、10/10、lint 0 违例、
  宿主契约 12 PASS／0 FAIL／0 SKIP）；判据逐条复核（坐标→证据落点）；`human-visual-checklist`
  署名；当月 CHANGELOG 事件由 Lead 落档。
- 证据落点：仓内测试输出、探针报告、票面 Comments、增量包；必要时
  `.tmp/pod-ctx/evidence/<票号>.log`（临时件，不进提交）。

---

## Out of Scope

- **独立「轨迹」页签**：官方 `dsh-client-ui-trajectory`（developerTools 开启）不在范围；「工具调用轨迹」在本批＝会话流内按回合渲染的工具行（转写 L2989）。
- **todo 面板、问答卡、子调用树的全量复刻**：增量项，等真实用例（转写 L2950）。
- **通知面形制不动**：右下角 `BotNotices` 保持轻量（转写 L4456）。
- **岗位 op 集与 op 命名合同**：`lib/org/op-set.js` 不动（转写 L5411）。
- **模型指派与数值门槛**：属用户裁定域，本规格只保证「基底与呈现面显式、模型指派不被呈现面绑死」的缝。
- **部署同步、重启链与数据迁移的执行**：出仓库动作，受逐项点名约束，由票 13／14 在授权窗口执行；本规格只定范围、风险处置与回退面。
- **冻结／历史件回改**：`docs/TEMP-guidance-*`、`docs/CLOSURE-*`、历史 CHANGELOG、`artifacts/packages/` 保持原文；**不设视觉回归基线**（形制判据走「逐项参数＋投影快照＋一次人工目视」）。

---

## Further Notes

### 裁定出处索引（转写行号）

| 议题 | 用户裁定/确认 | 行号 |
|---|---|---|
| 切换范围 A＋B；四条全要；目标层 L1＋L2＋L3；基准锚点；交付授权；改名意向 | `1.AB 2.都做 3.c 4。a 5.a 6。…改名为Pod` | L1149 |
| 状态延续深度 L1＋L2＋L3；过渡参数接受；分区口径＋补形制条；`Pod` 指代 (a)；改名全改 | `7.都做 8.接受 9.接受，同时补一条… 10.… 11.a 12.全改…` | L2268 |
| 工具轨迹「要做」（推翻上一轮的字面撤销） | `q13.这里我出现了理解问题，工具调用轨迹还是要做的…` | L2694 |
| L3 复刻到哪一层 (b)；L2 路线 (a)；L1 取证 (c)；覆盖层先代码论证 (c) | `q15.a就可以 16 b 17c 18c` | L3243 |
| 改名三组都做；其余推荐全接受（含大小写、批次、授权节奏、`inert` 授权、native 取证、死配置清理） | `abc都做，其余无异议` | L4238 |
| 取证凭据方式 (a) | `a 后无` | L4470 |
| L1 终局：保留 PTC；其余无建议 | `4保留ptc，其他我没有建议` | L5284 |
| 出票约束 | `/to-tickets 单票预算200k上下文，注意颗粒度` | L4810 |

### 与既有文档的关系

- 本规格是 `.scratch/pod/` 工作区产出（工单工作区，非 README 文档地图成员，不触发 §2 同步）；
  其冻结按落档规范由 Lead 记 CHANGELOG 事件并记本文件 SHA-256。
- `GLOSSARY.md` 收「Pod」词条（01 号票）；`docs/adr/0001-*` 记覆盖式常驻＋背景 `inert` 的
  红线偏离（01 号票）。
- 与 org-v2 规格的关系：本规格**不并入** org-v2 的 A 组判据；org-v2 的权限四层、台账、宿主
  适配面登记纪律继续适用（新面色经 `lib/host-faces.js` 登记）。

### 未决与待验证（实施者不得当既成结论引用）

1. **真机走查三项**（覆盖层几何／焦点键盘是否穿透／宿主快捷键）：静态论证已过（转写 L3602-3609），真机未做，安排在实现之后（票 04 验收末项）。
2. **`inert` 嵌套还原**：纸面推演成立（转写 L3574、L3618），**未实测**；由票 02 探针＋票 04 单测把守。
3. **native／PTC 取证作用域**：只对当前网关注效，不可外推（转写 L4035）；用途已由 Q27 转为留档。
4. **primitives 可用符号与 require 面**：以探针与实现期实测为准（转写 L2559-2576）。
5. **C 组迁移方案未定稿**：双读过渡 vs 停机搬迁、旧路径保留窗口、`bot-workspaces` 是否改名未拍板（转写 L4260）；票 14 先冻结方案并经用户过目。
6. **层叠取值与计数口径**：见 §G-G2／G3；实施期实测后按显式修订承接。

---

## 附录 A：验收判据清单（唯一权威）

判据**随本规格定稿同批冻结**。每条四字段＝判据文本／执行坐标／证据落点／覆盖级别；
覆盖级别＝**封闭三档枚举**（`常驻`／`验收期一次`／`运行面点名`）中的一位词，或用 `＋`
连接其中多位（定义见 Testing Decisions「覆盖级别＝封闭三档枚举」；`验收期一次` 与票面所称
「实验期一次」同义）。执行坐标可标「待实现批补齐（票 NN）」；
**票 11 收口前置判据含「坐标无空缺」**。下游票裁定为判据语义的最终依据；条目与裁定不符时
以裁定为准并回改本条。

### V-P1 命名与术语（5 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P1.1` | `GLOSSARY.md` 收「Pod」词条：视觉形态 `Pod`／标识符一律小写 `pod`，并写明宿主包名校验只收小写 | tests/pod-spec-face.test.mjs::V-P1.1（待票 11 新建；文档扫描） | GLOSSARY.md 词条＋回归记录 | 常驻 |
| `V-P1.2` | 「席位／岗位」词不外借：词条显式声明 Pod 不指席位；活文档无「Pod 席位」式用法 | tests/pod-spec-face.test.mjs::V-P1.2 | 回归记录 | 常驻 |
| `V-P1.3` | 旧别名收作 `_Avoid_`：`Bot 模式` 标注为历史别名；入口标签已是 `Pod` 不回改 | tests/pod-spec-face.test.mjs::V-P1.3 | GLOSSARY.md＋回归记录 | 常驻 |
| `V-P1.4` | 冻结／历史件旧名残留不回改，且与「应改未改」两类不混淆 | tests/pod-spec-face.test.mjs::V-P1.4（冻结路径白名单扫描：旧名命中 ⊆ 白名单，「应改未改」为空集；待票 11 新建）＋票 12 剩余命中清单 | 回归记录＋票 12 Comments | 常驻 |
| `V-P1.5` | 代码内部名（槽位名／组件名）不随命名批改名 | tests/pod-spec-face.test.mjs::V-P1.5（旧名命中 ⊆ 白名单（冻结路径＋代码内部名），「应改未改」为空集；待票 11 新建）＋票 12 剩余命中清单 | 回归记录＋票 12 Comments | 常驻 |

### V-P2 覆盖式常驻与保活（11 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P2.1` | 进／出 Pod 不再注册／注销官方槽位；官方条目账本不变 | tests/pod-overlay.test.mjs::V-P2.1（待票 04） | 回归记录 | 常驻 |
| `V-P2.2` | 官方页保活：进出各一次后滚动位置、工具卡展开态、进行中回合可见进度保留 | tests/pod-overlay.test.mjs::V-P2.2＋人工:human-visual-checklist | 回归记录＋票 04 Comments | 常驻＋验收期一次 |
| `V-P2.3` | 负例：不得以 `hidden`／`display:none` 隐藏官方页（代码与样式扫描） | tests/pod-overlay.test.mjs::V-P2.3 | 回归记录 | 常驻 |
| `V-P2.4` | 覆盖层形制：`shell.overlay` 注册＋整屏层 portal（`position:fixed;inset:0`）＋`role="dialog"`／`aria-modal="true"` | tests/pod-overlay.test.mjs::V-P2.4 | 回归记录 | 常驻 |
| `V-P2.5` | 层叠约束：portal 层高于 AppFrame、低于官方 body 级浮层最低档 `900`；不复用平台页 `1001`；取值登记进票 02 新建的覆盖层适配面 | 探针＝票 02 新覆盖层的面 id 与探针名（以票 02 Comments 登记为准，本规格不预设 id 名）＋tests/pod-overlay.test.mjs::V-P2.5 | 探针报告＋回归记录 | 常驻 |
| `V-P2.6` | 不依赖同层 `order`（Pod 主层不复用通知条目的 `order:-10` 语义） | tests/pod-overlay.test.mjs::V-P2.6 | 回归记录 | 常驻 |
| `V-P2.7` | 焦点契约：`primitives.useModalLayer`（Tab 囚笼／Escape／焦点归还）成立 | tests/pod-overlay.test.mjs::V-P2.7＋人工:human-visual-checklist | 回归记录＋票 04 Comments | 常驻＋验收期一次 |
| `V-P2.8` | 背景 `inert`：覆盖期间背景不可聚焦；退出后原值 LIFO 还原；与官方浮层嵌套还原正确 | 待票 02 行为探针＋tests/pod-overlay.test.mjs::V-P2.8 | 回归记录＋探针报告 | 常驻 |
| `V-P2.9` | 宿主快捷键按 modal 契约被拦（含侧栏切换类命令）；Esc／Tab 行为符合契约 | tests/pod-overlay.test.mjs::V-P2.9＋人工:human-visual-checklist | 回归记录＋票 04 Comments | 常驻＋验收期一次 |
| `V-P2.10` | 旁带清理：不再强展／强收官方侧栏；`ctx.layout.closeDetails()` 死调用替换为现役 API 或删除 | tests/pod-overlay.test.mjs::V-P2.10（负例：无 `closeDetails` 调用） | 回归记录 | 常驻 |
| `V-P2.11` | Pod 内切席位再切回：草稿／选中／滚动保留 | tests/pod-overlay.test.mjs::V-P2.11＋人工:human-visual-checklist | 回归记录＋人工件 | 常驻＋验收期一次 |

### V-P3 过渡动效（6 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P3.1` | 进出：淡入＋约 4px 上浮、约 200ms；无方向位移 | tests/pod-transition.test.mjs::V-P3.1（待票 05） | 回归记录 | 常驻 |
| `V-P3.2` | 时长／缓动取 `--ds-transition-duration(-fast/-slow)`＋`--ds-ease-in-out` 并带常量回退 | 探针 P-HOST-TRANSITION-TOKENS（面 HF-HOST-TRANSITION-TOKENS，见票 02 Comments）＋tests/pod-transition.test.mjs::V-P3.2 | 探针报告＋回归记录 | 常驻 |
| `V-P3.3` | 范围差分：进出时侧栏与主区同一过渡；Pod 内切席位只过渡主区 | tests/pod-transition.test.mjs::V-P3.3 | 回归记录 | 常驻 |
| `V-P3.4` | `prefers-reduced-motion: reduce` 退化为瞬时切换 | tests/pod-transition.test.mjs::V-P3.4（媒体查询桩） | 回归记录 | 常驻 |
| `V-P3.5` | 过渡期间无白屏帧、无布局跳动 | tests/pod-transition.test.mjs::V-P3.5（首帧断言）＋人工:human-visual-checklist | 回归记录＋人工件 | 常驻＋验收期一次 |
| `V-P3.6` | 动效不依赖 `hidden`／`display:none`，不引入宿主私有样式钩子 | tests/pod-transition.test.mjs::V-P3.6（负例扫描） | 回归记录 | 常驻 |

### V-P4 L2 数据面（7 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P4.1` | 读面符号 `BotsApi.trace(id, since)` 挂 `GET /api/pod/:id/trace`；双路（在线 `session.history` 优先→离线 `readSessionEventsFromFile` 回落）＋ mtime／size 缓存与增量语义 | tests/pod-trace.test.mjs::V-P4.1（待票 06） | 回归记录 | 常驻 |
| `V-P4.2` | 记录形状冻结（13 字段）与 `state∈preparing｜running｜ok｜error｜stopped` | tests/pod-trace.test.mjs::V-P4.2（形状测试） | 回归记录 | 常驻 |
| `V-P4.3` | PTC 信封：外层 `tool/call`（`run_code`）作信封；`tool/ptc-dispatch*` 内层名与结果归入 `subCalls`；内层名不别名化、不丢失 | tests/pod-trace.test.mjs::V-P4.3（合成事件流） | 回归记录 | 常驻 |
| `V-P4.4` | 邮件面行键（inbox／outbox）不变 | tests/org-mail-shared-face.test.mjs::内容键封闭＋tests/mail-at-least-once.test.mjs＋tests/pod-trace.test.mjs::V-P4.4（负例） | 回归记录 | 常驻 |
| `V-P4.5` | `session-driver` 回合返回形状 `{text, sessionId}` 不变 | tests/session-driver.test.mjs（既有回合返回形状断言）＋待票 06 补形状负例 | 回归记录 | 常驻 |
| `V-P4.6` | fail-closed：缺会话／损坏日志返回空或显式错误，不抛到 HTTP 面外 | tests/pod-trace.test.mjs::V-P4.6 | 回归记录 | 常驻 |
| `V-P4.7` | 未闭合回合／中断／并发子调用／缺工具名的投影行为可判，缺口计数可见 | tests/pod-trace.test.mjs::V-P4.7 | 回归记录 | 常驻 |

### V-P5 L3 显示与形制统一（11 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P5.1` | 通用行字段齐备（图标／工具名／参数摘要／状态／时间／chevron；展开参数体与输出体 pre-wrap、限高、可滚） | tests/pod-tool-rows.test.mjs::V-P5.1（待票 07） | 回归记录 | 常驻 |
| `V-P5.2` | 回合折叠头「N 次工具调用」可展开，计数口径＝顶层记录数 | tests/pod-tool-rows.test.mjs::V-P5.2＋人工:human-visual-checklist | 回归记录＋人工件 | 常驻＋验收期一次 |
| `V-P5.3` | PTC 信封呈现＝外层 `run_code` 行下挂内层子调用行（官方同形） | tests/pod-tool-rows.test.mjs::V-P5.3（投影快照） | 回归记录 | 常驻 |
| `V-P5.4` | 同流不打架：零重复、零丢序；刷新与事后回看呈现一致 | tests/pod-tool-rows.test.mjs::V-P5.4（增量 vs 全量幂等） | 回归记录 | 常驻 |
| `V-P5.5` | 零回归：无工具调用的回合呈现与今日一致 | tests/pod-tool-rows.test.mjs::V-P5.5 | 回归记录 | 常驻 |
| `V-P5.6` | 四类专用行（`bash`／文件改动 diff／`read`／`search`）齐备；未识别工具回落通用行、无空白行或裸 JSON | tests/pod-tool-rows-specialized.test.mjs::V-P5.6（待票 08） | 回归记录 | 常驻 |
| `V-P5.7` | 形状与官方同源：图标走官方 primitives 变体名、字号与令牌口径一致，无第二套视觉语言；四类专用行（票 08）各留一条真机目视记录 | tests/pod-tool-rows-specialized.test.mjs::V-P5.7（样式扫描）＋人工:human-visual-checklist | 回归记录＋人工件 | 常驻＋验收期一次 |
| `V-P5.8` | `turn-trigger` 形制逐项参数对齐（12 项表） | tests/pod-turn-trigger.test.mjs::V-P5.8（待票 09）＋人工:human-visual-checklist | 回归记录＋人工件 | 常驻＋验收期一次 |
| `V-P5.9` | 覆盖范围＝外部触发行＋讨论组／relay 折叠组；通知面保持轻量不动；文案 zh／en 齐备；键盘可达（Enter／Space 展开、Esc 不误关、aria 齐备） | tests/pod-turn-trigger.test.mjs::V-P5.9 | 回归记录 | 常驻 |
| `V-P5.10` | 形制件抽取（票 03）：纯重构零行为变化——既有回归全绿＋抽取件被至少一处既有 UI 复用；官方骨架／展开折叠＋aria 连线／受控口径有断言 | tests/client-disclosure.test.mjs（已实施，7 例）＋`tests/run.mjs` 回归 | 回归记录＋票 03 Comments | 常驻 |
| `V-P5.11` | 形制件抽取视觉零差异（票 03）：抽取前后既有 UI 视觉一致 | 人工:human-visual-checklist（并入票 11 收口真机清单） | 票 11 Comments＋人工件 | 验收期一次 |

### V-P6 回合级拼装（6 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P6.1` | 锚定规则 R1：工具行组挂在 `A(t)`（当前已知 `M` 中 `timestamp <= t0` 的合并序下标最大者）之后；同拍取合并序下标最大者；多回合同锚按 `turn` 升序 | tests/pod-assembly.test.mjs::V-P6.1（fixture，待票 07） | 回归记录 | 常驻 |
| `V-P6.2` | 无锚点／时间戳不可解析时按确定性回落渲染（流首／跳过）并计缺口（`assembleDiagnostics(M,R).anchorless` 可断言） | tests/pod-assembly.test.mjs::V-P6.2（负例＋诊断计数） | 回归记录 | 常驻 |
| `V-P6.3` | 未闭合回合：按 `since` 增量实时追加、不显示计数头；闭合判定（`turn/end` 或回合回复消息落盘）可判；晚到消息进入时按 R2 重锚（重锚优先）；`since` 两侧语义按 §E1（左开、不可互代） | tests/pod-assembly.test.mjs::V-P6.3（含晚到消息重锚负例） | 回归记录 | 常驻 |
| `V-P6.4` | 闭合后收为计数头；N＝顶层记录数、子调用不重复计入 | tests/pod-assembly.test.mjs::V-P6.4 | 回归记录 | 常驻 |
| `V-P6.5` | 幂等／可重放：同一数据全集内增量拼接与全量重放产出同一序列（跨全集按 R2 重锚后比较）；零重复、零丢序 | tests/pod-assembly.test.mjs::V-P6.5 | 回归记录 | 常驻 |
| `V-P6.6` | 不可执行时上浮口径成立：分解为可观测项→标 `needs-user` 上浮→两轮未闭合用户终裁 | `lib/org/acceptance-coordinates.js::HUMAN_CRITERION_CATEGORIES` fail-closed 口径＋票 11 复核记录 | 票 11 Comments | 常驻 |

### V-P7 L1 基底与呈现面（7 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P7.1` | 规格显式写明「基底＝官方默认 preset `standard`（27 工具）＋呈现面 ptc」，人物设定不裁；附实测证据 | tests/pod-harness-base.test.mjs::V-P7.1（待票 10；文档＋配置扫描） | 回归记录＋票 10 Comments | 常驻 |
| `V-P7.2` | 27 工具清单与官方默认 preset 逐项一致（防静默漂移） | tests/pod-harness-base.test.mjs::V-P7.2（preset／`--dump-config` 对照） | 回归记录 | 常驻 |
| `V-P7.3` | `DSH_TOOLS_MODE` 无条件注入不动，不得改为按 provider 分叉 | tests/pod-harness-base.test.mjs::V-P7.3＋tests/bot-faces-ready.test.mjs | 回归记录 | 常驻 |
| `V-P7.4` | 死配置清理：per-bot `settings.yaml` 的 `agent-presets` 段＋profile patch 的 `settings` 死重定向行清除，生成器同步 | tests/pod-harness-base.test.mjs::V-P7.4 死配置清理：生成器同步（patch 无 settings 重定向、settings 模板无 agent-presets）＋tests/bot-profile.test.mjs::生成器不写出死键：patch 无 settings 重定向行、settings.yaml 无 agent-presets 段（票 10 落点） | 回归记录 | 常驻 |
| `V-P7.5` | 反向验证：`dsh --dump-config` 不再出现该段 | tests/pod-harness-base.test.mjs::V-P7.5（`--dump-config` 输出） | 回归记录＋票 10 Comments | 常驻 |
| `V-P7.6` | 不碰岗位 op 集与 op 命名合同 | tests/org-op-set.test.mjs 全绿＋tests/pod-harness-base.test.mjs::V-P7.6（负例） | 回归记录 | 常驻 |
| `V-P7.7` | 观察项登记：`.agent-presets/` 死目录＋13 断链软链入 `docs/PROJECT_UNDERSTANDING.md`「仍可选题」＋ CHANGELOG 留界 | tests/pod-harness-base.test.mjs::V-P7.7（文档面） | 文档＋回归记录 | 常驻 |

### V-P8 改名范围与批次边界（7 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P8.1` | 功能先行：12–15 票 `Blocked by` 串在 11 之后，改名批不夹带功能改动 | `node scripts/project-context.mjs pod` 依赖列＋票 12–15 票面 | 终端输出＋票面 | 常驻 |
| `V-P8.2` | A 组范围齐备（模块 id／包名／CSS 前缀／locale ns／host 插件名／wire 头／路由前缀／日志前缀／测试与脚本字面量） | tests/pod-spec-face.test.mjs::V-P8.2（A 组九类清单扫全：身份类留旧名／非身份类已换新名，旧名命中 ⊆ 白名单，「应改未改」为空集；票 12 落）＋票 12／13「剩余命中清单」 | 回归记录＋票 12／13 Comments | 常驻 |
| `V-P8.3` | B 组 env 双读：`POD_*` 优先、兼容 `DSH_BOTS_*` 一个窗口；仓库外两脚本同步更新 | tests/pod-rename-env.test.mjs::V-P8.3（待票 13）＋仓库外脚本更新记录 | 回归记录＋票 13 Comments | 常驻＋运行面点名 |
| `V-P8.4` | 四同名一致：patch 行 `name`＝插件目录名＝`package.json.name`＝前端模块 id | 票 13 核验（测试／`scripts/org-cutover-check.mjs`） | 回归记录＋票 13 Comments | 常驻 |
| `V-P8.5` | C 组数据面：范围（注册表／信箱／知识库／台账／能力／workspace／session 分片／备份）先方案后执行；两风险各有处置 | 票 14 方案件＋迁移前后逐件校验 | 票 14 Comments＋增量包 | 常驻＋运行面点名 |
| `V-P8.6` | 冻结件不回改；改名触发**新 `runId`** 增量证据包；冻结面门在新清单下 PASS | 票 15 包链核验＋`TMPDIR=/tmp node scripts/preflight.mjs` ②门 | 增量包＋票 15 Comments | 常驻＋运行面点名 |
| `V-P8.7` | 授权点各一次点名（部署同步／全 bot 重启链／新 runId 包／数据迁移），票面记授权依据原文；回退面写明（不演练） | 票 13／14／15 票面授权段 | 票面 Comments | 运行面点名 |

### V-P9 治理与验收（4 条）

| # | 判据 | 执行坐标 | 证据落点 | 级别 |
|---|---|---|---|---|
| `V-P9.1` | 判据冻结：正文＋附录 A 同批冻结；此后只补执行坐标、不改语义 | CHANGELOG 事件＋本文件 SHA-256（Lead 落档） | CHANGELOG | 常驻 |
| `V-P9.2` | 人工判据仅限白名单两类，须列明核验人；白名单外按判据缺口上浮 | `lib/org/acceptance-coordinates.js::HUMAN_CRITERION_CATEGORIES`＋票 11 复核 | 回归记录＋票 11 Comments | 常驻 |
| `V-P9.3` | 每条判据四字段齐备；票 11 机械检查坐标无空缺（四字段可解析（**含人工坐标必须带白名单类别** `人工:human-visual-checklist`／`人工:human-knowledge-reuse`）、id 连续、级别词在**封闭三档词表**内（逐个 `＋` 分词都在词表内）、票面引用坐标存在） | tests/pod-spec-face.test.mjs::V-P9.3（待票 11 新建） | 回归记录 | 常驻 |
| `V-P9.4` | 四门收口：preflight 四门 PASS 且计数 ≥ 基线（84/84、10/10、lint 0 违例、宿主契约 12 PASS／0 FAIL／0 SKIP）；真机目视一次并署名 | `TMPDIR=/tmp node scripts/preflight.mjs`＋人工:human-visual-checklist | 终端输出＋票 11 Comments＋增量包 | 验收期一次 |

### 不在判据内（out of scope）

逐条引既有裁定：独立「轨迹」页签；todo／问答卡／子调用树全量复刻；通知面形制；岗位 op 集与
命名合同；模型指派与数值门槛；部署与迁移**执行**（属授权窗口内的票 13／14）；冻结件回改；
视觉回归基线。另：**观察项登记**（`.agent-presets/`）只判「已登记」，不判死目录清理。

---

## 修订记录（2026-10-09）

**触发**：交付前独立复核（复核结论＝需修订：1 阻断＋5 重要＋8 次要）。本版修订**只补确定性
口径与坐标**——**由交付前独立复核触发，未改任何用户裁定**（Q2／Q7／Q13／Q19／Q23／Q27
六处裁定与四处易错点全部成立、保留不动）。

| 条目 | 一句话处置 |
|---|---|
| B-1 | 覆盖级别定为**封闭三档枚举**（`常驻`／`验收期一次`／`运行面点名`，允许 `＋` 连接）；V-P9.3 检查项改为引用该词表 |
| I-1(a) | R1 同拍锚点改为取 `M` 的**合并序下标最大**者（`M` 顺序＝`compareConversationMessages`：时间戳升序、同拍按 `id` 稳定序） |
| I-1(b) | 锚点按**当前已知 `M` 数据全集**计算；晚到消息**允许并应当重锚**，**重锚优先**；R4 幂等限定在同一数据全集内 |
| I-1(c) | 两侧 `since` 游标定为**左开**：邮件面＝严格晚于的时间戳（ISO／epoch ms），轨迹面＝`seq > since`；**不可互相代入** |
| I-1(d) | 「无锚点／投影缺口」定为纯函数输出 `assembleDiagnostics(M,R) → {anchorless, projectionGaps}`，由票 07 测试断言、UI 可选；**不得改票 06 冻结的 trace 记录形状／响应形状** |
| I-1(e) | R4 排序键分侧定义：消息侧 `(timestamp, 合并序下标, id)`、记录侧 `(turn, seq)`；工具行组随其锚点消息排序 |
| I-2 | 全部人工坐标统一为 `人工:human-visual-checklist`；V-P1.4／P1.5／P8.2 改为白名单扫描断言（机器可判，「应改未改」为空集）；V-P9.3 增「人工坐标必须带白名单类别」；§F7 增冻结路径白名单 |
| I-3 | V-P2.5／§G-G2 去掉自造探针 id `HF-CLIENT-OVERLAY`，坐标改为票 02 登记的面 id 与探针名（本规格不预设） |
| I-4 | 票 11 承接项：新建 `tests/pod-spec-face.test.mjs` 并执行 §G-G4 四项机械检查 |
| I-5 | 补票 03 判据 V-P5.10／V-P5.11（复用＋aria 断言／视觉零差异），「测哪些模块」补条目 |
| M-1 | 转写／仓内出处行号 8 处改正（Q19–Q25、`GLOSSARY.md:119`、`acceptance-coordinates.js:151-156`、L3170、L3230、票表映射、L4790、L3025-3027） |
| M-2 | 票 15 补「新 `runId` 增量证据包」逐项授权点名（对齐 V-P8.7） |
| M-3 | 票 08「每类一条真机目视记录」并入 V-P5.7 判据文本 |
| M-4 | 票 09 注明「以 §D5 表为唯一形制源」＋6 项子细节指针 |
| M-5 | V-P7.4 坐标改为票 10 实际落点用例名（`tests/pod-harness-base.test.mjs::V-P7.4 死配置清理：…`＋`tests/bot-profile.test.mjs::生成器不写出死键…`） |
| M-6 | 票 01 Comments 的悬空指涉改为指向本修订记录实测计数 |
| M-7 | `GLOSSARY.md`「Pod」词条格式对齐既有风格（`_Avoid_` 紧接正文、去文末空行、溯源写「01 号票裁定」） |
| M-8 | §F2 注明 A 组分票口径（票 12＝非身份标识符／票 13＝身份与 wire 段） |

**补执行坐标（实施期，2026-10-09 票 05 施工）**：V-P3.2 的执行坐标原写「扩 `HF-CLIENT-VISUAL` 登记」——票 02 因「面↔探针一一对应」不变量（`HF-CLIENT-VISUAL` 的 `probeId` 已被占用，扩面会迫使两面共用探针 id）**新建**了 `HF-HOST-TRANSITION-TOKENS`。本表该条坐标据此改为**票 02 登记的面与探针**（`HF-HOST-TRANSITION-TOKENS`／`P-HOST-TRANSITION-TOKENS`，登记见票 02 Comments）；**判据语义（令牌取值＋常量回退）不变**。同批 §C2 的「扩 `HF-CLIENT-VISUAL` 登记一条」按同一口径读作该面（不另改判据文本）。

**判据计数**：附录 A 由 62 条增至 **64 条**（V-P5 由 9 增至 11；其余组不变）。

**坐标修订（2026-10-11 改名批，Lead）**：票 13 身份切换（Q19 批准 A 组含 `/api/bots` 前缀）把 HTTP
路由前缀切至 `/api/pod`——目标名规格未钉死，Lead 按身份段单数收敛规律（模块 id／包名／头名／
env 全为单数 `pod`）裁定，**用户可否决**；响应体领域词 `bots`（席位）与代码内部名（`BotsApi` 等，
V-P1.5）不随批改。§D3／§E1／V-P4.1 四处路由串随之 `/api/bots/:id/…` → `/api/pod/:id/…`，
**判据语义（读面挂点、左开游标、形状冻结）不变**；§F2 的 A 组清单为裁定历史记录，不改。
Status 行补记改名批现状（票 12 resolved；13–15 仓库内面完成，运行面件待授权窗口）。
