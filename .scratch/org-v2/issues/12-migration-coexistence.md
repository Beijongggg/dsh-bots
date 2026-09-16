# v2 重建的迁移与并存策略

Type: grilling
Status: resolved（2026-09-16 认领并决议：round 1 六问＋round 2 三问全裁「按推荐」）
Blocked by: 03, 04, 05, 06, 07

## Question

03 号票裁定「现役四席无保留义务，直接重建」（2026-09-10 用户裁定），原雾区条目
「迁移与并存策略」由此毕业成本票。要定：

1. **撤销与重建的顺序与切换点**：lead／研究员／reviewer-lead／reviewer-second 四
   席的处置顺序；v2 实例何时创建、旧席何时撤销；切换点判据。
2. **在产协议的存续判定**：mail 不变量（replyTo⟺kind、at-least-once、幂等回复、
   nextSeq 锁）、13 stage 评审协议与 capability 机制、评审 store 数据面、知识库
   R-2026-* 登记、SSE 事件面——逐项定「保数据不保形态／随重建废弃／原样保留」。
3. **与本图 out of scope 的交错**：「8 文件部署批」（deploy-b3-session-driver）的
   时间先后；阶段 3/4 基建债的合流指针（若 08 号票已给出合流规则则引用之）。
4. **双轨期与回退面**：重建失败时旧形态可回退到什么程度；宿主实现约束（lead 条目
   代码内置不可删除，lib/index.js:1064；空注册表自动重建）如何处置。

依赖说明：目标形态由 04（评审存在形式）、05（协议与生命周期）、06（权限）、07
（工具配置）定，本票在其后收口；不产出代码。

## 来自 04 号票的输入（2026-09-10 裁定）

第 2 项中三项已由 04 号票裁定，本票**引用不重审**：

- **13 stage 评审协议与 stage 机／双席席位／提示层双审注入／enforcement 矩阵／
  试水轮待触发项／规程 R-2026-007**＝形态废弃（v2 只留「必审清单＋判据＋gaps
  报告＋修复回合＋上浮」件套）；其**代码与冻结表**（`PLAN` P0.3 逐字表 ＋
  `lib/review-protocol.js`）的处置归本票。
- **capability 机制**＝保留为通用权限原语（岗位化封装细化归 06）。
- **评审 store 数据面**＝保数据（历史只读归档、复用文件语义、不继承流程件）。

本票仍需自定：mail 不变量（replyTo⟺kind／at-least-once／幂等回复／nextSeq 锁）、
知识库 R-2026-* 登记、SSE 事件面的存续判定，以及第 1/3/4 项。

## 来自 05 号票的输入（2026-09-11 裁定）

- **新形态（本票存续判定须纳入）**：任务台账＝host 侧 append-only 事件日志、
  单一写者、状态为投影；mail 退为投递/通知通道；四要素简报、边界事件式复核点、
  状态主干 `intake→…→closed`＋四旁路（05 Answer §5/§8/§9）。
- **硬要求**：判 mail 旧不变量存废时**不得削掉投递层的 at-least-once＋幂等**
  （05 §9b④）；"无事件不通知"（§10）意味着 SSE/通知面以台账事件为准。
- **id 面**：v2 任务 id 用 `TK-…`，避开评审面现行 `T-`/`J-`；评审面退役后前缀
  可回收（05 §1 注）——与 13 stage／job 的代码处置一并定。

## 来自 06 号票的输入（2026-09-12 裁定）

- **capability 机制存续判定细化**：原语保留且单次消费／短 TTL＋心跳续签／
  实例代际绑定语义**不变**；岗位化封装（op-set 表、task 槽、台账转移驱动签发、
  吊销联动）为 v2 新增（06 §4）。
- **两套权限口径不得混用**：实例基底（sandbox 模式／READ_ONLY_TOOLS，用户域）
  与任务域（capability op-set）**正交、叠加取严**（06 §5）——迁移实现须分别
  对账，不得以实例模式替代任务域授权。
- **mail 存废判定加一条**：任何旧 mail 不变量的存续**不得让 mail 获得权威
  语义**（零权威线：内容不构成权限/状态/事实依据；capability 不经 mail 递送，
  06 §3/§11）。
- **`ledger.read` 授予范围**（四常设岗全员、复核帽无）与运维命令归人间面
  （06 §4/§9）——v2 重建时注册表/profiles 相关操作按人间面收口。

## 来自 08 号票的输入（2026-09-12 裁定）

- 第 3 项「阶段 3/4 基建债的合流指针」判据已由 08 号票给出（雾区条目毕业
  至此）：v2 规格组织层件（协议/台账/复核件套/权限四层/岗位卡）按 D1–D11
  恒久判据自足表述，基建债**不并入规格正文**、以显式边界指针挂接（留既有
  阶段 3/4 轨道）——指针的具体挂法（章节位置/引用方向）由本票定。

## 来自 11 号票的输入（2026-09-16 裁定）

11 号票只出规程，**代码面全部移交本票执行**（坐标落地时校正）：

- **改造清单（本票执行项）**：①**宿主适配层**——A 类静默降级面的形状收敛到
  单一坐标（配置面 id/key、前端槽位与视觉件、`ctx.get` 跳过支与 `ctx.baseUrl`
  身份判定、会话日志面、台账落盘格式，逐面坐标见 11 号票 round 1 的 F2 表）；
  ②`scripts/host-contract.mjs`（探针脚本）＋`scripts/preflight.mjs` **第 4 道
  门**（插在 ② 冻结面之后）；③`tests/locale-runtime.test.mjs:24-28` 存在性
  守卫修法——SKIP 必须与 PASS 可区分且计数可见；④`lib/client.js:3064`
  `[data-sidebar-collapsed]` 越界改造（红线＝禁读宿主私有 DOM/CSS 钩子）。
- **不得违背的语义**：探针三态 PASS/FAIL/**SKIP 视同 FAIL（运行面与部署面）**；
  FAIL 默认**面级降级**（照 07「失效无文件直写降级」三分支：错误回执/台账
  事件/进流程），**整层拒载仅限组织层身份面**（cordis 插件名与 `inject`／
  client bundle 协议／`dsh.client.inject` 清单）；失效以 class=duty 例程任务
  落台账承载处置、**不新增台账事件类型**（05 面不扩）；宿主版本号仅作诊断
  字段，**不入门**。
- **与本票题面的交错**：适配层代码的落地时点并入本票第 1 项「撤销与重建的
  顺序与切换点」同批判；台账 host 命令面与落盘格式适配（11 §1 组⑦）随 05
  台账形态同批落地。

## 来自 13 号票的输入（2026-09-16 裁定，切换批前置补记）

- **切换批前置判据加一条**：**A 组验收判据坐标无空缺**——13 号票规格验收的
  `V-A1`–`V-A7` 七域清单，每条须已有执行坐标（`tests/` 模块名或 preflight
  门号），缺一条即切换点判据不齐。本票 Q1 定的「切换点判据三条并行全绿」
  （preflight 四道门／编制就绪探针／用户点名）其余口径不变，此为并行全绿的
  第四条。
- 依据：13 号票 Answer §10（判据语义在规格定稿时冻结、落地坐标在实现批补齐，
  坐标齐备是切换前必须闭合的那一半）。

## Comments

### 2026-09-16 grilling round 1（八问，待用户裁定）

**前置事实（只读调查，坐标已回源核验）**

**F1 现役四席的存在形态**（`~/.dsh` 只读探测）

| 席 | 存在形态 | 坐标 |
|---|---|---|
| `lead`（领队） | **代码内置**：整表空时由 `createLeadBot` 写入，id 常量、port 3101、read-only、默认模型空串 | `lib/index.js:448-465`（工厂）、`226-227`（常量）、`3358-3362`（空表重建） |
| 同上：删除保护 | DELETE 对 `lead` 一律拒绝 | `lib/index.js:1064` |
| 同上：v1 专用注入/硬编码 | lead 提示段「双审试点门控」；`final-lead`／`recheck-final-lead` 工件作者硬编码 `reviewer-lead` | `lib/index.js:2386-2416`、`3080`、`3121` |
| `bot-mt0x6r0y`（研究员） | 仅注册表条目（随机 id、name=研究员、read-only、port 3102） | `~/.dsh/bots/bots.json` |
| `reviewer-lead`／`reviewer-second` | 仅注册表条目（**前者 `danger-full-access`**、后者 read-only、port 3103/3104） | 同上 |

要点：① 自动补回只在**整表空**时发生（非空表缺 `lead` 不补）② 注册表损坏走
`bots.json.corrupt-<ts>` 备份＋落入空表重建（`3348-3356`）③ 注册表**不在版本控制内**
（仓库无 `bots.json`，席位定义只活运行面）④ `instances.jsonl` 139 行，最近一轮
2026-09-10T06:48（host-911）。

**F2 运行面存量数据**（只读统计，2026-09-16）

| 面 | 存量 | 相关度 |
|---|---|---|
| mail | 5 席 42 条 inbox（127KB）／42 件 outbox；`mail-response` 16、`mail-discuss` 2；带 `replyTo` 17 | 中（05 定其退为投递通道） |
| mail 不变量反例 | `reviewer-second` inbox 有 1 条 `kind=mail-discuss` 而**无 `replyTo`**（T-2026-008-R）——`replyTo⟺kind` 今天已不成立 | 直接支撑存废判定 |
| 评审 store | `~/.dsh/bots/review/` 仅 12 文件：`audit.jsonl` **1 行**、`epoch.json`、`capabilities/` 2 件（**已过期**，2026-08-29 签发、无 job 绑定）、`migration/` 5 件；artifacts/results/jobs/invocations/routes/threads **均不存在** | 低 |
| 知识库 | `index.jsonl` 9 条／`reports/` 9 篇（53KB）：001–005「眼睛」系列、**006→007→009 双审规程 supersede 链**、008 试水轮总结；**009 索引字段全空**（`conclusions`/`sources`/`appliesTo`/`task` 空、正文 955B） | 高（容器协议＝v2 组织层件） |
| SSE | 4 类事件 `bots`/`mail`/`review`/`reload`；**无落盘**，内存 256 条 replay 窗口＋`Last-Event-ID` | 中（09 人间收件箱靠投影） |
| 任务台账 | **代码零实现、零 stub、零占位**（`lib/` 全 grep 零命中） | 05 的 v2 新形态从零建 |

**F3 冻结面与 PLAN P0.3**

- 冻结面＝0008 包 `sourceManifest` ９文件：`lib/evidence-packager.js`、`lib/parity-manifest.js`、
  **`lib/review-enforcement.js`**、`lib/sentinel-provenance.js`、`lib/sentinel-runner.js`、
  `lib/sentinel-safety.js`、`scripts/evidence-packager.mjs`、`scripts/evidence-runner.mjs`、
  `scripts/review-enforcement-probe.cjs`。
- `PLAN-expanded-engineering.md`、`CONTEXT.md`、`README.md`、`lib/review-protocol.js` **均不在**
  冻结面；但 `PLAN` P0.3 逐字表（`:195-209`）是 README:89 口径的「P0 **冻结决策**小节」，
  `:192-193` 要求「实现常量和测试必须逐字钉住，不得在实现时自由增删 stage」。
- 成文依据：AGENTS.md §2（触碰冻结面→新 runId 重采集、出新序号增量包）、README §6.2
  （证据链产物禁止覆盖旧件）、PLAN:541（0008 之后批不在冻结面）。

**F4 评审面模块引用闭包**（全 `lib/` 扫描）

- **A＝只被评审面引用（可整体删）**：16 个 `review-*` 模块共 **7114 行＝`lib/` 18230 行的 39%**
  （store 1030／orchestrator 801／jobs 788／capability 756／job-tools 610／evidence 514／
  flow 476／relay 436／results 409／discussion 331／migration 204（生产零引用＝已死代码）／
  http-api 203／protocol 183／intake 143／envelopes 125／report 105）。
- **B＝保留**：`mail-plane`／`mail-seq-lock`／`knowledge`／`session-driver`／`spawn-env`／
  `pid-bind`／`fs-hygiene`／`shared.cjs`／`api-security`／`bot-autostart`／`bot-supervisor`／
  `stats`／sentinel 系／evidence-packager／parity-manifest／`client.js`（含评审子面须摘）。
  **反向依赖确认：`mail-plane`／`knowledge`／`client.js` 均不 import 任何 `review-*`。**
- **C＝跨面共用**：`review-enforcement.js`（**冻结面**；`sentinel-runner:26`／
  `sentinel-provenance:19` 取 `canonicalJsonString`／`SHADOW_LAYOUT_MANIFEST`，构成
  sentinel↔review-enforcement 环）、`sentinel-safety.js`（review 侧只用 `ProbeError`）、
  `session-driver.js`（评审/普通两 adapter 各一）、`lib/index.js`（评审面约
  **710 行／3588 ≈ 20%**，最大一块＝2788–3297 主机泵 510 行）、`lib/client.js`
  （评审 API `713-729`／通知 `1034-1049`／SSE `3141-3148`／i18n）。
- 附带事实：`review-intake` 生成的任务号是 `T-<base36>-<seq>-<8hex>`（`:25`），与文档/提示层
  所写 `T-2026-00N` 形态**不一致**（后者只出现在测试与知识库文本里）。

**F5 迁移工程面现状**

- 门态：PLAN 头部收口段＝**全门 READY／放行**（2026-09-04），无未开门；`PLAN:84` 记
  「编码方实例：未创建」。
- `scripts/preflight.mjs`＝**三道门**（①回归 56 文件 ②冻结面 sha ③Status 词表 lint）；
  `scripts/host-contract.mjs` 尚不存在（11 号票第 4 道门＝待建）。包 0008 记当次回归
  45/45（历史值，与现 56 文件有漂移）。
- 部署先例：`artifacts/archive/deploy-pre-*` 共 7 个目录；规则成文于
  `.scratch/deploy-b3-session-driver/spec.md`：备份带时戳、回滚＝回拷旧件＋重启链重走、
  **决定权在用户**、不演练；部署同步与重启各需用户逐项点名（AGENTS.md §2）。
  **deploy-b3「8 文件部署批」已于 2026-09-08 收口**（票 resolved＋live smoke 通过）——
  本图 out of scope 记的「仅时间交错」已消解。

---

❓ **Q1** - **重建批次与切换点：一批式切换，不设双轨期**

候选：(a) **一批式**——仓库侧全部就位 → 用户点名 → 单窗口内撤旧席＋建 v2 编制＋就绪验收；
(b) **并行双轨**——v2 与旧四席并存一段，逐票迁移；(c) **两段式**——先建 v2 增补岗与旧席并存
验证，再撤旧。

➡️ 推荐 **(a)**。理由：① 03 已裁「现役四席无保留义务、直接重建」；② 双轨会让 CONTEXT
「值守线／项目线归属必须显式」的不变量失去可判定性（旧四席同时活着，谁属哪条线判不了）；
③ 在产数据面几乎为空（评审面零工件、台账零实现、mail 已终局），平滑过渡买不到东西。
**切换点判据三条并行全绿**：① `preflight` **四道门**（含待建 `host-contract`）PASS；
② v2 编制就绪探针 PASS；③ 用户逐项点名授权（部署同步、重启链各一次点名，沿 deploy-b3 先例）。

---

❓ **Q2** - **旧四席 id 与 bootstrap 锚点的处置**

候选：(a) **复用旧 id** 改判 home 岗位（零代码改动，代价＝v1 岗位名永久留在组织层）；
(b) **新建 v2 语义 id**（`duty-coordinator`…）＋撤销旧条目，内置锚点与删除保护泛化为
「bootstrap 锚点席位」；(c) 保留 `lead` 这个 id 只换语义（登记为「锚点实例历史 id」）。

➡️ 推荐 **(b)**。理由：v2 岗位词表不含「领队」；id 承载旧岗位名会让「岗位＝契约单位」
（CONTEXT 岗位条）长期含混；而改动面本就在本批——一个 id 常量＋`1064` 的保护条件＋
`3358-3362` 空表重建目标＋删 `2386-2416`/`3080`/`3121` 三处 v1 注入与硬编码；旧 id 只留
历史日志（`instances.jsonl` append-only，不追改）。研究员席同理改用语义 id `researcher`：
现 id `bot-mt0x6r0y` 是随机名，承载不了 v2 语义。

---

❓ **Q3** - **最小起步编制与就绪判据（雾区「最小起步编制与 bootstrap」毕业）**

候选：(a) **锚点起步**（只建 `duty-coordinator`，其余全按需拉起）；(b) **双席起步**
（`duty-coordinator`＋`implementer`）；(c) **四岗各一**。

➡️ 推荐 **(b)**：双席即可跑通「收单→派单→实施→复核帽→结算」最小闭环（同时压到台账与
复核件套两条主链），`project-lead`／`researcher` 按需拉起（03 裁「实例按需」）；
**就绪判据**＝门绿＋就绪探针 PASS＋一次最小闭环 smoke（照 deploy-b3 live smoke 先例：真任务
走完全链、台账事件投影可核）。13 号票的验收实验按需扩编，不抬升起步编制。此雾条由本票
**收口消解**，不另立票。

---

❓ **Q4** - **mail 面的存续：保数据不保形态**

候选：(a) **保数据不保形态**；(b) 形态与不变量全保（mail 继续当协作主面）；(c) 通道实现重写。

➡️ 推荐 **(a)**：**保** at-least-once＋幂等回复＋`nextSeq` 锁三件实现（05 §9b④ 硬要求）；
**废** `kind` 枚举与 `replyTo⟺kind` 约束（其语义是评审 stage，且 F2 已证今天就有反例）；
关联键改 **taskId**（v2 provenance 根）；存量 42/42 条**原地只读留存**（不迁移、不改写）；
零权威线（06）不动；SSE 的 `mail` 通知保留、来源改台账投影（见 Q6）；`T-` 前缀随形态退役，
v2 用 `TK-`（05 §1 注）。

---

❓ **Q5** - **评审面代码、PLAN P0.3 表、capability 与 store 的处置**

候选：(a) 非冻结评审模块删净＋冻结件原样留存＋PLAN 表加废止标注＋通用原语拆出保留；
(b) 代码与表全删（含冻结件）；(c) 评审面整体保留待用。

➡️ 推荐 **(a)**，六条：① **删** A 类 16 个非冻结 `review-*` 模块及其测试（7114 行；
`review-migration` 已是生产死代码）；② **拆**通用基座——`review-capability` 的 HMAC/nonce/ledger
原语与 `review-store` 的锁／原子写／audit／幂等键迁入组织层共用件（04 定 capability＝通用权限
原语、06 定其保留并 op-set 化）；③ **冻结面 9 文件零触碰**——`lib/review-enforcement.js` 的
enforcement 矩阵随形态废弃，但**文件原样留存**（动它须新 runId 出 0009 系增量包，成本换不来
收益；其 `canonicalJsonString`／`SHADOW_LAYOUT_MANIFEST` 仍被 sentinel 系使用）；④ `PLAN` P0.3 表
**加废止标注、不删表**（P0 冻结决策小节＝历史可追溯件；PLAN 非证据包冻结面，改动按落档规范
登记，不需新增量包）；⑤ `lib/index.js` 评审段（约 710 行）与 `lib/client.js` 评审子面按 F4 清单
摘除；⑥ 评审 store 存量 12 文件原地只读留存，v2 台账**另立根目录**（不复用其目录语义）。

---

❓ **Q6** - **SSE 事件面与知识库条目的存续**

候选：(a) SSE 保形态、事件集改 `bots`/`mail`/`ledger`/`reload`，知识库原样保留＋双审规程条目
显式 supersede；(b) 全原样保留（人间收件箱另走轮询）；(c) 通知面重建。

➡️ 推荐 **(a)**：SSE 端点／内存 replay／`bots`·`reload` 保留（宿主适配面，11 已登记）；`review`
事件随形态退役；**新增 `ledger` 事件**承载台账投影（09 人间收件箱的数据源）——11 Q3 的「不新增
台账事件类型」约束的是**台账**事件类型，不含 SSE 通道类型，两者不冲突。知识库：`R-2026-*` 9 条
**原样保留**（容器协议是 v2 组织层件，条目是运行时资产）；006→007→009 双审规程链随形态废弃
**再登记一条废止 009**（10 票：失效唯一机制＝显式 supersede、append 不删），009 索引空字段的
信息由新条目承载（不改写 009 正文）；008 试水轮总结＝历史事实记录保留；001–005 与 v2 无关保留。

---

❓ **Q7** - **回退面与旧实例数据的处置**

候选：(a) 备份＋git 提交点、回滚权在用户、旧实例数据原地留存零写入；(b) 演练回滚；
(c) 清理旧实例数据。

➡️ 推荐 **(a)**：切换批前置备份 `artifacts/archive/deploy-pre-org-v2-<date>/`（沿
`deploy-pre-b3-sd` 先例：带时戳、`wx` 排他、逐文件 sha 对账）；回退＝备份回拷＋重启链重走、
**决定权在用户、不演练**（deploy-b3 spec 口径原样沿用）；旧实例的 `profiles/<id>`、
`bot-workspaces/<id>`、mail 与 review 存量**原地留存零写入**——10 票已定岗位私有记忆无迁移
义务（既不迁也不删），删除属运行面写入、本批不申请；`instances.jsonl` 139 行历史不追改，
切换批新行按既有归因规则记账。

---

❓ **Q8** - **阶段 3/4 基建债指针挂法**

候选：(a) **单向指针**（规格→PLAN）；(b) 双向互引；(c) 不挂指针。

➡️ 推荐 **(a)**：v2 规格正文设「边界指针」小节，一行指向 PLAN 阶段 3/4 条目（08 规则：不并入
规格正文）；**反向不引**——PLAN 是工程设计权威且含冻结决策小节，双向会让冻结面随规格演进
摆动；v2 存在本身按落档规范登记（CHANGELOG＋README 文档地图）。8 文件部署批已收口（F5），
交错已消解；v2 切换部署另起一批、同受 AGENTS.md §2 逐项点名约束。

### 2026-09-16 grilling round 2（三问：Q5／Q7 复问＋新增 Q9）

round 1 结果：Q1 一批式、Q2 新建语义 id、Q3 双席起步、Q4 保数据不保形态、Q6 保形态＋
supersede、Q8 单向指针——六问按推荐；**Q5「冻结件留存的价值是什么」与 Q7「架构未投入使用，
原地留存的意义是什么」用户要求再讨论**。两问都指向「留存」的正当性，补采事实如下（只读）。

**F6 进程面：四席当前全部不在运行**（关键新事实）

- 唯一存活进程＝宿主 `node /usr/bin/dsh web`（pid 946，etime 2:28:12）。
- 注册表四 pid 的现实：`965`／`1007`／`1028` **已不存在**；`939` **已被 snapd 复用**
  （`/proc/939/cmdline` = snapd）——正是 `lib/pid-bind.js` 代际绑定要防的用例。
- 故：撤销旧席**无停机窗口问题、无在产回合被打断**；`instances.jsonl` 最新一轮
  （2026-09-10）那批进程已退出。

**F7 旧席数据面的真实内容与体量**（只读 `du`/`ls`）

| 面 | 体量 | 内容 |
|---|---|---|
| `bot-workspaces/<席>`（5 席） | 8K／席 | **每席仅 1 文件**：`.dsh-bot-session.json`（66 字节会话指针）——**岗位私有记忆为零** |
| `profiles/<席>`（4 席） | 36K／席 | `cordis.yml`／`cordis.patch.yml`／`settings.yaml`／`package.json`／`pnpm-workspace.yaml`（配置件，`scripts/create-bot.cjs` 可再生）；`profiles/node_modules` 2.3M 为共享面 |
| mail inbox／outbox | 252K／192K | 42 条消息（含双审试水轮 T-2026-008 原始往来） |
| review | 68K | `audit.jsonl` 1 行＋`migration/` 5 件＋过期 capability 2 件（P7-3/P7-4 迁移包预备与 dry-run 记录） |
| knowledge | 112K | **v2 原样保留面**（不在清理讨论内） |

**F8 冻结面的机械约束**（门②行为已回源）

`scripts/preflight.mjs:38-57` `verifyFrozenFace`：取**最大序号包**（`:22-35` `latestPackage`）→
对 sourceManifest 逐文件核 sha256＋byteLength，任一不符/缺失即进 failures。**故动 9 文件中
任一个 ⇒ 门②立即红 ⇒ 必须新 runId 重采集、出新序号增量包**（AGENTS.md §2 成文纪律）。
9 文件中只有 `lib/review-enforcement.js` 属评审面（另 8 个＝sentinel/evidence 工具链），
且它**不是孤儿**：`sentinel-runner:26`／`sentinel-provenance:19` 取 `canonicalJsonString`／
`SHADOW_LAYOUT_MANIFEST`。

---

❓ **Q5'** - **冻结件 `review-enforcement.js` 的处置时机**（Q5 复问：留存的价值是什么）

先答「价值」：① **机械价值**——门②按终版包逐文件复验，动它即红，动它就必须配一次新包 run；
② **证据价值**——0008 包是「当时实现状态」的可核验认证，其中 enforcement 矩阵（8 条
DENY_PATH 全 `pending`）是 v1 机械面的最后一份 attestation；v1 形态废弃后，这份认证只对
**未废弃的 sentinel/evidence 工具链**仍有活值。故真问题不是「删 vs 留」，而是**由哪一次证据
run 承载这次触碰**：

候选：(a) **并入 v2 实现批的证据包**——v2 实现批改 `lib/` 大面（删 7114 行＋建台账＋拆通用
基座），本就要出该批的包，enforcement 矩阵的删除并入该批 runId，边际成本≈0、不外开包；
(b) **现在单开 0009** 只为一个文件（成本＝一次完整证据 run）；
(c) **永不动**（树里长期留一个文件名与形态不符的文件＝误导面）。

➡️ 推荐 **(a)**：与 Q1「一批式」同构——触碰与它所属的批同行，不为一个文件单开包。

---

❓ **Q9** - **（新增，由 Q5' 派生）证据包链与 preflight 门② 在 v2 下的存续**

事实：9 文件冻结面＝sentinel/evidence 工具链自身（`evidence-packager`／`sentinel-*`／
`parity-manifest`／两个 `scripts/*.mjs`／probe），包链由它产出；门② 按「最大序号包」复验。
04 的废弃清单不含 sentinel/evidence 工具链，11 号票亦未列它。

候选：(a) **存续**——证据包链是**仓库级工程纪律装置**（AGENTS.md §2「定稿→实现→测试→证据
生成→账实核验→冻结」），与组织层评审形态解耦；v2 实现批照旧出包，门②沿用，冻结面随每批
增量包滚动；(b) **随评审形态退休**——包链冻结在 0008（门② 转为历史复验或移除），v2 的复核
件套成为新的证据面；(c) 现在就给包链收口出新包。

➡️ 推荐 **(a)**：§2 是长期纪律而非 v1 评审形态的附属；sentinel/evidence 工具链是 v2「可执行
判据」的既有承载（07 号票 runProbe 改接台账 acceptance，仍走这套探针面）。此项也决定 Q5'(a)
是否成立——两者同答。

---

❓ **Q7'** - **旧席数据处置**（Q7 复问：架构未投入使用，原地留存的意义是什么）

先答「留存的意义」：F7 显示 **workspace 记忆面为零**（每席仅 1 个 66B 会话指针）、`profiles`
配置件可再生——原「既迁又留」的理由基本消失；真正值得留的只有 mail 试水轮原始往来与
review `migration/` 记录，且它们要的是**可核验**、不是**占运行面**。又 F6 显示四席已死、
无在产依赖。

候选：(a) **归档后清运行面**——旧席配置件（去 `node_modules`）＋workspaces＋mail/review 数据面
搬入仓库 `artifacts/archive/org-v1-runtime-<date>/`（先例 `artifacts/archive/profiles-pre-resync/`），
运行面归零、可逆、需用户点名授权（AGENTS.md §2）；(b) **原地留存不动**（成本 <1MB，但新语义
id 下留 `profiles/lead` 等孤儿目录，巡检/诊断含混）；(c) **直接删除**不归档（运行面干净，
不可逆，且丢 R-2026-008 的原始痕迹）。

➡️ 推荐 **(a)**：清理与证据保留各得其所——运行面归零换取 v2 语义的干净起点，旧数据入仓库存证。

## Answer

2026-09-16 用户 `/wayfinder` 逐票工作批收口：round 1 六问（Q1–Q4、Q6、Q8）＋ round 2 三问
（Q5'、Q7'、Q9）**全部按推荐**＝按推荐授权。本票只产决策不产代码（终点＝规格）。

### 1. 重建批次与切换点（Q1）

**形态＝一批式切换，不设双轨期**，分三段：

- **前置段（仓库侧，可 AFK）**：v2 组织层件落地（岗位卡／协议／台账／权限／工具／人间接口）
  ＋11 号票移交的四项代码改造＋本票第 9 节工作清单。
- **点名段（运行面，逐项授权）**：部署同步 → 重启链（各一次点名，AGENTS.md §2；沿
  deploy-b3 先例）。
- **切换段（单窗口内）**：撤销旧四席 → 建 v2 双席 → 就绪探针 → 最小闭环 smoke。

**切换点判据三条并行全绿**：① `preflight` **四道门** PASS（现有①②③＋待建第 4 道
`host-contract`）② 编制就绪探针 PASS ③ 用户逐项点名授权到手。

**不设双轨期的理由**：03 已裁「无保留义务、直接重建」；双轨会让「值守线／项目线归属必须
显式」不变量失去可判定性；在产面为空（评审零工件、台账零实现、mail 已终局）＋四席进程已死
（F6）——平滑过渡无对象，双轨只买复杂度。回退面见第 7 节。

### 2. 旧四席与 bootstrap 锚点（Q2）

- **新建 v2 语义 id**：锚点 `duty-coordinator`、`implementer`，按需 `project-lead`／
  `researcher`；研究员席不再沿用随机 id `bot-mt0x6r0y`；`reviewer-lead`／`reviewer-second`
  随形态废弃撤销（v2 无常驻评审岗，04）。
- **锚点泛化**：`createLeadBot`（`lib/index.js:448-465`）改为建 v2 锚点；`lib/index.js:1064`
  的删除保护从「钉死 `lead` 字符串」改为「**bootstrap 锚点席位不可删**」；空表重建目标
  （`3358-3362`）同步改为 v2 锚点；损坏表重命名备份分支（`3348-3356`）保留原样。
- **v1 专有注入／硬编码删除**：`2386-2416`（`dsh-bots:review` 军规段＋lead「双审试点门控」）、
  `3080`／`3121`（`final-lead` 工件作者硬编码 `reviewer-lead`）随形态废弃删除；提示段一律由
  岗位卡派生（07）。
- 旧 id 只留历史：`instances.jsonl` append-only 不追改；注册表条目撤销，**不留空壳条目**。
- 不变量：非空注册表必有锚点在场（由「锚点不可删」保证）；「一实例一 home 岗位」（03）在
  重建后成立。

### 3. 最小起步编制与就绪判据（Q3——雾条毕业消解）

**双席起步＝`duty-coordinator`＋`implementer`**。就绪判据＝门绿（preflight 四道门）＋就绪
探针 PASS＋一次最小闭环 smoke（收单→派单→实施→复核帽→结束，台账事件投影可核）。
`project-lead`／`researcher` 按需拉起（03「实例按需」）；13 号票的验收实验按需扩编，**不抬升
起步编制**。雾区条目「最小起步编制与 bootstrap」＝**本票收口消解，不另立票**。

### 4. mail 面存续（Q4）

**保数据不保形态**：**保** at-least-once（receipts／cursor／responses 三件）＋幂等回复
（`outboxHasReply` 配对）＋`nextSeq` 锁（`lib/mail-seq-lock.js`）；**废** `kind` 枚举与
`replyTo⟺kind` 约束（F2 在产反例：`reviewer-second` 一条 `mail-discuss` 无 `replyTo`）；
**关联键改 `taskId`**；mail 退为投递通道（05），零权威线（06）不动——不变量存续不得让 mail
获得权威语义。存量 42/42 条随第 7 节归档（不迁移、不改写）。`T-`／`J-` 前缀随形态退役，
v2 用 `TK-`（05 §1 注）。

### 5. 评审面代码、PLAN P0.3、capability 与 store（Q5／Q5'／Q9）

- **删**：A 类 16 个非冻结 `review-*` 模块及其测试（7114 行＝`lib/` 39%；`review-migration`
  已是生产死代码），含 `lib/index.js` 评审段（约 710 行）与 `lib/client.js` 评审子面
  （`713-729`／`1034-1049`／`3141-3148`／i18n 键）。
- **拆**：`review-capability` 的 HMAC／nonce／ledger 原语与 `review-store` 的锁／原子写／
  audit／幂等键迁入**组织层共用件**（04 定 capability＝通用权限原语、06 定保留并 op-set 化；
  单次消费／短 TTL＋心跳续签／实例代际绑定语义不变）。
- **冻结面**：`lib/review-enforcement.js` 的 enforcement 矩阵随形态废弃，其删除**并入 v2 实现
  批的证据包**（Q5'——不单开 0009，边际成本≈0）；`canonicalJsonString`／
  `SHADOW_LAYOUT_MANIFEST`（sentinel 系在用）保留或迁 sentinel 侧。**证据包链与 preflight
  门② 存续**（Q9）：AGENTS.md §2 是长期纪律而非 v1 评审形态附属，v2 实现批照旧出包、门②
  沿用、冻结面随每批增量包滚动。
- **PLAN P0.3 表**：**加废止标注、不删表**（P0 冻结决策小节＝历史可追溯件；PLAN 非证据包
  冻结面，改动按落档规范登记，无需新增量包）。
- **评审 store 存量**：12 文件随第 7 节归档；v2 台账**另立根目录**，不复用评审目录语义。

### 6. SSE 与知识库（Q6）

- **SSE**：端点／内存 replay 窗口（256 条）／`bots`·`reload` 保留（宿主适配面，11 登记）；
  `review` 事件随形态退役；**新增 `ledger` 事件**承载台账投影（09 人间收件箱的数据源）——
  11 Q3「不新增台账事件类型」约束的是**台账**事件类型，不含 SSE 通道类型，两者不冲突。
- **知识库**：`R-2026-*` 9 条**原样保留**（容器协议＝v2 组织层件、条目＝运行时资产）；双审
  规程 006→007→009 链随形态废弃，**新登记一条废止 009**（10：失效唯一机制＝显式 supersede、
  append 不删），009 索引空字段的信息由新条目承载（**不改写 009 正文**）；008 试水轮总结＝
  历史事实记录保留；001–005 与 v2 无关保留。

### 7. 旧席数据与回退面（Q7'）

- **归档后清运行面**：旧席 `profiles` 配置件（去 `node_modules`）＋`bot-workspaces`（每席
  1 个 66B 会话指针）＋mail／review 数据面 → 仓库 `artifacts/archive/org-v1-runtime-<date>/`
  （先例 `artifacts/archive/profiles-pre-resync/`）；运行面归零，**需用户点名授权**
  （AGENTS.md §2）。knowledge 面不在清理内。
- **回退面**：切换批前置备份库外部署件至 `artifacts/archive/deploy-pre-org-v2-<date>/`
  （带时戳、`wx` 排他、逐文件 sha 对账，沿 `deploy-pre-b3-sd`）；回退＝回拷旧件＋重启链重走、
  **决定权在用户、不演练**（deploy-b3 spec 口径原样沿用）。

### 8. 阶段 3/4 指针与 out of scope 交错（Q8）

- v2 规格正文设「**边界指针**」小节，**单向**指向 PLAN 阶段 3/4 条目（08 规则：不并入规格
  正文）；**反向不引**——避免 PLAN 的冻结决策小节随规格演进摆动。v2 存在本身按落档规范登记
  （CHANGELOG＋README 文档地图）。
- 「8 文件部署批」已于 2026-09-08 收口（F5），交错消解；v2 切换部署另起一批、同受 §2 逐项
  点名约束。

### 9. 迁移工作清单（移交 `/to-spec` 的代码面；落地时按当时坐标校正）

1. **锚点泛化**：`createLeadBot` → v2 锚点；`lib/index.js:1064` 保护条件；`3358-3362` 空表
   重建目标。
2. **删 v1 注入／硬编码**：`lib/index.js:2386-2416`、`3080`、`3121`。
3. **删评审面**：16 个非冻结 `review-*` 模块＋其测试；摘 `lib/index.js` 评审段（约 710 行）
   与 `lib/client.js` 评审子面。
4. **拆通用基座**：capability 原语＋store 基座（锁／原子写／audit／幂等键）→ 组织层共用件；
   `review-enforcement` 的 sentinel 能力随实现批证据包一并处置。
5. **台账新面**：host 侧 append-only 事件日志＋单一写者＋命令面＋落盘格式（05／11 组⑦）
   ＋`ledger` SSE 事件。
6. **mail 形态改造**：废 kind 语义、关联键改 taskId、保三件不变量。
7. **知识库收口**：新条目废止 `R-2026-009`。
8. **11 号票四项**：宿主适配层、`scripts/host-contract.mjs`＋preflight 第 4 道门、
   `tests/locale-runtime.test.mjs:24-28` 守卫修法、`lib/client.js:3064` 越界改造。
9. **切换批运行面动作（逐项点名）**：部署同步 → 重启链 → 撤销旧四席 → 建 v2 双席 → 归档旧
   数据 → 就绪 smoke。

### 10. 同步与归位

- `map.md`：Decisions-so-far 回写本票；雾区「最小起步编制与 bootstrap」消解；frontier 收为
  「13」。
- `CONTEXT.md`：新增词条「bootstrap 锚点席位」与「重建切换批」。
- 13 号票：补「来自 12 号票的输入」（起步编制与验收实验扩编口径）。
- **验证**：本票零代码改动（仅 `.scratch/`＋`CONTEXT.md`＋`CHANGELOG.md` 文档面）；
  `TMPDIR=/dev/shm npm run preflight` 当次实跑 ＝ ①回归 56/56 ✅ ②冻结面（0008 包）
  9/9 ✅ ③status-lint 0 违例（扫 35 md）✅。
