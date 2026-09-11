# 协作协议与任务生命周期

Type: grilling
Blocked by: 03
Status: resolved

## Question

任务从哪来（用户目标/票据/常态触发）、怎么分解与派单、岗位间移交契约
（handoff 工件格式：什么字段、什么不变量）、完成验收链（便宜模型初审→
用户终裁）、怎么关闭与归档。现邮件协议（replyTo 不变量、at-least-once、
幂等回复）作参照——可演进可替换（Q8 裁定②）。

## 来自 04 号票的输入（2026-09-10 裁定）

复核**形式**已定（04-review-form.md）：必审清单三类判据命中即强制复核、必审产出
阻断性（连续两轮未闭合上浮用户终裁）、判据由派单方在四要素简报预登记且须可执行、
复核者＝契约帽子（fresh 会话、只读、同任务产出方不得自任）。本票据此定**位置与
顺序**：复核点在生命周期的哪个节点、超时／挂起语义、与派单／结算／关闭归档的
耦合；必审清单的条目枚举随复核点定义落地。

## Comments

### 2026-09-11 前置事实（只读代码调查，供 round 1 与 Answer 引用）

范围＝工作树 `/home/beijong/project/dsh-bots` 只读调查（零写入）。

**1. 今天没有一等「任务」对象**

- 普通协作面完整路由表 `lib/index.js:83-105` ＋ 唯一写入点 `appendMessage`
  字段集 `lib/mail-plane.js:79-105`：消息＝`{id, seq, from, text, at, kind?,
  replyTo?, discussRound?}`；**无 `to`／`role`**（收件人＝inbox 目录，
  `lib/mail-plane.js:18-24`），**无 assignee／status／deadline／完成字段**——
  「任务」只存在于正文散文里。唯一机器可读产出标记＝responses 的
  `replied | error-replied`（`lib/index.js:2006/2031/2042`）。
- 反向消息（outbox 回复）另有一形：`{id:"<botId>-<base36>-<n>", text,
  from:"bot", timestamp, replyToMessageId?}`（`lib/mail-plane.js:148-168`）。
- 工作项 id 的既有先例**仅在评审面**：`T-<base36 ts>-<seq>-<rand>`
  （`lib/review-intake.js:20-26`）；工程 job `J-…` 与其生命周期
  `created-pending→created→claimed→started→fix-reported|expired→failed→
  requeued|dead-lettered`（`lib/review-jobs.js:56-62,91-101,298-311`）——
  形态存在，但与普通协作面不连通。

**2. 投递保证（现状强于建图时的假设）**

- 三锚点：消费键 `messageId = id || "in-<botId>-<seq>"`（`mail-plane.js:189-195`）；
  durable receipt `inbox/<botId>/receipts/<messageId>.json`（`outcome ∈
  processed|skipped-stale`，watermark 只升不降，`mail-plane.js:222-291`）；
  逐消息响应标记 `responses/<messageId>.json`＝`none→claimed→finalized`
  （`mail-plane.js:321-350`；消费门 `lib/index.js:1987-1990`）。
- 回复幂等：同 `replyToMessageId` 复用既有 outbox 行（`mail-plane.js:151-153`）；
  同一 `seq` 不二次路由（`inboxHasResponseTo`，`mail-plane.js:357-365`）。
- 序号分配：`read max → +1 → append` 全在跨进程临界区 `.seq.lock/` 内，
  **超时抛错、不裸写**（`mail-plane.js:94-104`；`lib/mail-seq-lock.js:23-59`）。
- 与 05 直接相关的已知缺口：**backlog > 100 静默截断**（旧消息标
  `skipped-stale`、永不交给 agent，`index.js:2422-2423,2504-2517`）；
  **回合失败不重试**（回 `[bot error]`＋`error-replied`，`index.js:2011-2044`）；
  receipt 写失败 ⇒ 重启后至多一次重放（`index.js:2521-2528`）；host 重启
  baseline 语义（`mail-plane.js:303-313`）；SSE replay 账本仅内存
  （`index.js:1397-1400`）。

**3. 强一致基座与可复用原语（复核／证据／记忆面）**

- review store＝tmp+fsync+rename、`O_APPEND`、manifest/body hash、event
  seq/hash、lock owner＋PID 身份、epoch fencing、reservation/recovery/
  quarantine（`lib/review-store.js:94-136,205-340,368-485,678-703,855-1022`；
  GROK §5.5 判为「可复用的强一致基座」）。
- capability＝HMAC 单次、绑定实例的通用权限原语（`lib/review-capability.js`）；
  runProbe＝bwrap＋命令白名单 `node/git/grep/sha256sum/wc`＋exit code 判据
  （`lib/review-evidence.js:414-505`）；user-decision＝accept/reject/defer/
  authorize-repair，作者必须是 user、revision 严格 `max+1`
  （`lib/review-results.js:44-65,310-390`）。
- 知识库：`knowledge_register` 对**每个 bot** 开放、无授权/配额校验（`botId`
  记录但不校验，`lib/knowledge.js:239-246`）；索引级子串检索；写锁 `.lock/`。

### 2026-09-11 研究依据回读（01/02 报告 ＋ 03/04 约束）

- **四要素移交＝D3**（Anthropic 原文）：objective／output format／guidance on
  the tools and sources／clear task boundaries；含糊委派直接导致重复劳动、
  留白与信息缺失（EP §3.2）。配套：**全轨迹默认、裁剪显式**（Cognition
  「share full agent traces」；OpenAI SDK handoff 默认看全史，trim 须显式
  `input_filter`）——与 04 Q4「复核者只拿 diff＋判据」正交（复核面是例外）。
- **无 stage 机的代偿**：OP 对 MAST「跨 agent 失配」类给出的对策原文＝
  「任务简报四要素硬约束；**共享台账让状态可见**」——直接支持 Q1 的一等台账。
- **并行条件（D4）**：默认单线程线性；并行仅限真正独立的上下文，且并行方
  **只产信息**，**不可逆动作保持单线程**——与 Q5 复核点落在不可逆边界之前同向。
- **反例**：R4 反对自动编排的框架抽象层（obscure 底层 prompt）；R7 反对摘要式
  移交；R5 反对指令膨胀；R3 反对按标称窗口做预算。
- **成本结构**：agent≈4×chat、多 agent≈15×chat；tokens 解释 80% 性能方差；
  上下文隔离在多域任务省 ~67% token；协调税削减（last_message＋forward_message）
  ≈+50% 基准分（OP §4）。
- **盲区（本票须自造，报告不提供）**：任务接收、分解算法、派单引擎形态、
  状态/进度 schema、超时/挂起、关闭归档、移交工件字段表——01/02 只到原则层
  （EP §6、OP §8 自述）＝05 从零发明。
- **MAST 14 式**：两份报告只核到 3 类/14 式/κ=0.88 与部分式名，**未枚举全表**；
  2026-09-11 子代理另取论文 v3 附录 A 得全表（**报告外来源**），仅作反向映射
  参考，仍按 04 标记**待补充轮复核**。

## Answer

**2026-09-11 grilling：round 1 七问（Q1–Q7）＋ round 2 七问（Q8–Q13，含 Q9b）
用户逐项裁定「按推荐方向」——v2 协作协议与任务生命周期＝「任务台账＋四要素简报
＋边界事件式复核点」一件套，mail 退为投递/通知通道。**

### 1. 任务的存在形式（Q1＝①）

- **任务升格为一等对象：任务台账（task ledger）**——确定性存储、单一写者、
  append-only 事件日志，**状态是事件投影**；任务有稳定 id。
- mail 降级为**通知/投递通道**；人读工件（票据 md／报告／证据）由台账引用，
  不承载运行时状态。
- **taskId ＝ provenance 根**（GROK §7.3 口径）：task → brief → 产出工件 →
  复核报告 → 裁定 → 归档 全链可引用。
- 任务 id 形如 `TK-<base36 ts>-<seq>-<rand>`，避开评审面现行 `T-`/`J-`
  （`lib/review-intake.js:20-26`、`lib/review-jobs.js:56-62`）；12 号票若退役
  评审面，前缀可回收。
- 依据：OP 对 MAST 跨 agent 失配类的对策原文＝「四要素硬约束＋**共享台账让状态
  可见**」；现行 mail 无任务语义（Comments 前置事实 §1）。

### 2. 来源、分类与收单分诊（Q2）

- **同一任务对象＋`class: duty|project`**：duty＝可重复触发的常态例程；
  project＝目标态编组。三来源＝用户目标／外部事件（mail/SSE）／常态触发。
- **确定性规则表优先**：收单先匹配例程与常驻规则，命中即直办；未命中才把语义
  判断上浮 duty-coordinator，**上浮必须可归因**（03 Q2）。
- triage 产出四值：`routine-direct | project | clarify | reject`。
- `project` 触发编组：值班统筹生成 project-lead 实例并给简报；
  **立项判定与分解归 project-lead**，不回问同一件事。
- 单入口收单＋结论原文直通用户（03 Q4）不变。

### 3. 生命周期主干（Q3）

- **显式最小 FSM**，只保留「有义务挂在状态上」的节点：每个状态必须能回答
  "下一步谁负责、超时怎么办"，答不出即删——防 04 已废的 stage 机在组织层复活。
- 推进权威：**确定性台账只接受合法转移**（CAS＋前置条件）；LLM 岗位只提交判断
  输入（分诊结论、简报、计划、gaps、验收与结算结论），**不得直接写状态**。

### 4. 派单、接单与归属租约（Q4）

- **归属由台账持有**：`owner + lease + heartbeat deadline`；派单＝CAS 写 owner。
- 被派方须在 T 内 `accept`；**逾期未接自动释放回队列并通知派单方**（不静默丢失）。
- 可 `decline`，须带理由（作为判断上浮的可归因记录）。
- 租约到期／实例死亡 → 自动回收，重派封顶 N 次后上浮用户。
- **一实例同时只持一个进行中任务**，第二次归属由台账机械拒绝；冲突按 03
  「上抛用户」处理，不在本地排队。
- T/N 数值属**用户域**；组织层只要求"必须有 T 与封顶＋可配置的缝"。
- 收口雾区条目「自动派单/调度的引擎形态」：**派单＝确定性台账机制＋岗位职责
  分工**（常态归值班统筹、目标态归项目经理）。

### 5. 复核点位置、验收链顺序与必审清单（Q5）

- **复核点＝边界事件，不是流程阶段**。命中清单的产出在跨越任一"不可撤"边界前
  必须过复核：(a) 不可逆写入（真实运行面／冻结面）**之前**；(b) 对外可见
  （交付用户、跨组织提交）**之前**；(c) 作为下游实例关键输入被移交**之前**。
  **不在结算处另设一道**。
- 验收链顺序：产出方自证（可执行检查）→ 命中清单则复核（gaps→一次性修复→
  复检；两轮未闭合上浮）→ 交付/移交 → project-lead 结算（只核判据是否满足＋
  复核是否闭合，**不重审内容**）→ 关闭；清单外咨询性复核不阻断。
- **必审清单枚举**（三条判据下）：
  - 不可逆：写真实运行面（`~/.dsh`／部署目录／注册表）；写冻结证据包链；
    不可回滚的覆盖/删除。
  - 对外可见：交付用户；跨组织提交；外部 API 写入。
  - 跨实例关键产出：下游任务输入工件；判据工件；组织常量（岗位卡/规程文本）变更。
- 加审权归 project-lead（留归因）；"便宜模型初审"落为：机械汇总 runProbe 判据
  由确定性层做，语义初审可由值班统筹或复核者帽子承担，**终裁与投递面归 09**。

### 6. 结算、关闭与归档（Q6）

- 结算：project-lead（项目）/ duty-coordinator（例程）。
- 关闭前置：① 验收判据均有可执行检查的通过记录；② 命中的复核点已闭合；
  ③ 产出已按「谁产出谁登记」登记。
- 关闭即转**只读**（追加归档事件）；**不可重开**——要改则开新任务并以
  `supersedesTaskId` 引用旧 id。
- 取消权：用户终裁；project-lead 可取消但须归因并通知。失败不删档，事件链保留。
- 归档去向：台账事件（权威）＋按 README §6.2 落档＋知识库登记（**晋升规则归 10**）。

### 7. 异常、超时与挂起（Q7）

四类统一走台账、**不静默丢失**：

1. 实例死亡/失联 → 租约到期自动回收，状态回 `planned`，重派封顶；
2. 任务停滞（无进展心跳）→ 值班统筹可归因判定上浮或回收；
3. 等待用户裁定 → `waiting-user` 持久挂起，**不占实例租约、不烧 token**；
4. 等待外部依赖 → `blocked`＋依赖坐标，确定性组件在依赖事件到达时唤醒。

边界：05 定组织侧行为（挂起/回收/上浮触发）；**09 定如何到人与等待超时**。
本票同时回应现行两处静默丢失：backlog>100 截断（`lib/index.js:2504-2517`）、
回合失败不重试（`lib/index.js:2011-2044`）——v2 以台账事件替代。

### 8. 四要素简报字段表与冻结语义（Q8）

字段：`taskId, class(duty|project), objective, deliverable(输出格式＋存放坐标),
sources(工具面＋来源坐标，ID-only), boundaries(不做什么＋不预置语义决定),
acceptance(可执行判据，派单方预登记), reviewPoint(命中清单的边界枚举), owner?,
lease?, parentTaskId?`

不变量：

1. objective/deliverable/boundaries/acceptance **四非空**；
2. acceptance **必须可执行**（runProbe 可跑或给出用例坐标）；**不允许裸主观判据**
   ——不可执行即判**判据缺口**，须先分解为可观测项，否则标 `needs-user` 上浮；
3. 不预置产出方语义决定（方法论 #17）；
4. 给坐标不给转述、全轨迹由台账持有而非塞进简报（方法论 #16；D3 全轨迹默认、
   裁剪显式）；
5. 简报派出即**冻结**——修改走 `amend` 追加事件并显式通知承接方，不得静默改写。

### 9. 状态与转移表（Q9）＋台账承载（Q9b）

主干：`intake → triaged → planned → assigned → accepted → running → produced →
delivered → settled → closed`；旁路：`blocked / waiting-user / failed / cancelled`。

- 转移＝台账 append-only 事件（actor/at/reason）；合法转移表由确定性层校验；
  LLM 只发命令不改状态。
- `accepted` 保留为独立状态：接单前可重派，接单后仅租约到期可回收。
- `produced`＝自证完成；`delivered`＝跨界且复核点已闭合。
- 状态名英文作契约主键，中文作显示名。

台账承载：

1. 台账＝host 侧 append-only 事件日志、**单一写者**（bot 经 host 命令写，
   GROK §7.2 口径），状态是投影；
2. mail 退为**投递/通知通道**（复用 receipts/responses/幂等/seq 锁，不再承载
   任务语义）；
3. 恢复＝host 重启后从台账重建未闭合队列，不依赖内存态；
4. 生命周期对投递层的硬要求＝**at-least-once＋幂等**（12 判旧件存废时不得削掉）。

命令鉴权与串行化机制细节归 06/07。

### 10. 通知事件面（Q10）

通知必须是台账事件的投影——**无事件不通知**：

- 到用户：交付/回笼、上浮（两轮未闭合／冲突／重派封顶）、`waiting-user`
  裁定请求、取消/失败；
- 到派单方：接单超时、拒收、租约回收、咨询性 gaps、复核闭合；
- 到承接岗：派单、裁定结果、依赖唤醒。

形式（邮件/通知/SSE、等待与超时）归 09。

### 11. 值守例程（Q11）

- 例程＝声明式登记项（`routineId`、触发条件/周期、简报模板、预算缝），属
  **组织常量**，由值班统筹维护。
- 触发时幂等键＝`routineId+window`，重复触发不产生第二任务。
- 例程任务 acceptance 可自动生成（健康探针/回归结果）。
- 周期与预算数值属用户域。

### 12. 复核点的机械落点（Q12）

1. 必审清单载体＝组织常量文本（版本化，条目引用可执行判据）；
2. "当次空闲实例"机械判定＝台账中无进行中租约的实例，**排除本任务产出方**；
3. 复核者由派单方在简报中按角色类别指名候选，确定性层取第一个空闲者并记录
   模型身份；
4. 报告回填＝gaps＋严重度＋证据坐标，作为台账事件，阻断时挡住 `delivered`。

只读权限面归 06，runProbe 装载归 07。

### 归位（交由下游票）

| 事项 | 归位 |
|---|---|
| 台账写入权威的最小权限面（bot 经 host 命令写；复核者只读面） | 06 |
| 台账/复核工具化（bot 侧只有命令、不直写文件）；简报与岗位卡的装载 | 07 |
| `waiting-user` 挂起语义、通知事件面到人的形式与等待超时 | 09 |
| 关闭后工件→知识库的晋升规则；台账事件 vs 长期记忆边界 | 10 |
| 台账与 mail 投递层的分工落地；旧 mail 不变量存废（不得削 at-least-once＋幂等）；`T-`/`J-` 与 13 stage 代码处置 | 12 |
| v2 规格整体验收判据（含全低配压力测试） | **13**（本票新建） |

### 雾区毕业（map 已同步）

- 「自动派单/调度的引擎形态」→ Q4 已决，**移出雾区**；
- 「规格验收标准」→ 毕业为 13 号票（`Blocked by: 05, 08`），**移出雾区**；
- 其余雾区条目更新阻塞面：「最小起步编制与 bootstrap」等 06/07；
  「bot 侧执行承载细节」等 06/07；「岗位卡↔提示层同步机制」等 07；
  「与基建债合流指针」等 08；「补充调研轮」等用户网络声明。

**证据与限制**：

- 研究性依据（四要素／D1–D10、MAST 可预防性）出自 01/02 号**暂定稿**（网络受限）
  → 相关判断按 04 口径标**待补充轮复核**；MAST 全表式为**报告外来源**（论文 v3
  附录 A），仅作映射参考。
- 本票只产决策、不产代码；实现与迁移由规格 → /to-spec → /to-tickets → /implement
  承接（并存策略归 12 号票）。
- 前置事实＝2026-09-11 只读代码调查（坐标见 Comments §1–§3），生产面零写入。
