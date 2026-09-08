# 扩大工程任务切片（F-R9-1 裁决落地计划 · v3 修订稿）

> 本文件是纯规划交付，不包含运行时代码、配置、部署、规程登记或重启授权。
> v1（A-01～A-18）与 v2（P1～P8、31 切片）均已因契约不完备而否决；其演进记录保留在
> CHANGELOG。本文 v3 是当前唯一候选切片。
>
> **当前门态（2026-09-04 收口）：P6-5 / P6-4 / P7-5 已关闭（第八轮双席会签＋用户确认）；R-3 已关闭（主审席验收 17/17 通过＋用户 2026-09-04 指令「忽略副审进行后续任务」豁免副审门态前置，副审补进转事后跟进）；P9 已执行并关闭（主审侧 P9-1/P9-4/P9-5/P9-7 全绿；P9-2/P9-3 副审半边按同指令豁免；P9-6 授权对象 P7-5 系 08-29 用户点名授权并已执行关闭）——**最终门态 READY／放行**；P3 遗留（索引 R-2026-007 supersede 标记）已于同日经用户点名授权补记完成（见 CHANGELOG 对应条目）。**
> 事实区分（截至 2026-08-28，见第十节 10.6/10.7）：
> - R-2 已获用户授权并已执行（R2-01～R2-12，自测 34/34），两席独立复审统一返回
>   F-RV-1～F-RV-17 + W-RV-1，**R-2 独立验收不通过**；
> - R-3 返修要求返回后**已获用户授权并全部执行**（R3-01～R3-10，全量回归 35/35，
>   并发 5/5，无结论证据包已重出）；**R-3 独立验收未发生**——门态判定权在双席与用户；
> - P6-4/P6-5/P7-5/P9 继续挂门；未部署、未重启、未登记规程、未改真实配置。
>   （历史快照：本行为 2026-08-28 时点表述；现态以下方「门态更新」与 CHANGELOG
>   最新条目为唯一事实源——P7-5 已执行、P6-4/P6-5 已执行待双席复核。）
>
> **门态更新（历史快照：2026-08-29 编码方执行时点表述，「三项待双席复核」已被下方门态收口段取代；详见 CHANGELOG）**：P7-5 已执行（R-2026-009
> 登记+指针迁移+全量部署+五进程重启）；P6-4 验收 PASS（p6-4-verify：5 bot 五字段
> +双席真实签发消费）；P6-5 已执行（real-sentinel 双守卫 fail-closed + 授权探针
> 8 格 ALLOWED 观测 + 非破坏性证明，artifacts/p6-5-sentinel-evidence.json）。
> 三项均待双席复核；P9 未启动；R-3 NOT READY / BLOCKED 维持。
>
> **文档状态声明（2026-08-29 归一）**：本正文中未加标记的「挂门/未部署/未执行」
> 字样均为对应条目**落笔时的历史快照**，不代表当前状态；当前真实门态以本门态更新
> 段及其引用的 CHANGELOG 最新条目为唯一事实源。P6-5 已按 2026-08-29 双席归一返修
> 重跑（守卫强化 + 结构化证据 + 方案 A 规格，见 CHANGELOG 最新条目）。
>
> **门态收口（2026-08-29 第八轮双席会签＋用户批准，详见 CHANGELOG 收尾条目）**：
> **P6-5 关闭**（七处缺口全部闭合＋翻转实证＋常驻负例 26 例；十重守卫链；方案 A
> 判定满足；残余 TOCTOU 如实留档）；**P6-4 关闭**（聚合器修复＋结构化只读证据，
> issueTestExecuted=false 口径如实）；**P7-5 关闭**（第八轮 C 项点名同步后四文件
> repo↔deploy 平价 4/4＋部署侧 node --check＋部署版黑盒复放通过；历史执行事实以
> 既有证据链为据）。冻结包 `b3bd65d0…` 为收口前基线、收尾包见 CHANGELOG 收尾条目。
> P9 未启动（仅点名指令启动）；R-3 NOT READY / BLOCKED 维持；挂账：四源重建、
> F-S15 处置、部署平价结构化字段（改进项）。
>
> **门态更新（2026-09-04 R-3 主审席独立验收；用户授权「授权处理」，见 CHANGELOG 对应条目）**：
> **R-3 主审席验收通过**——F-RV-1～F-RV-17 逐项独立核验闭合（返修落点代码定位＋
> 负例测试在列＋宿主端到端七段生产链复证；W-RV-1 系已归因环境项非代码验收面）；
> 机械复现：全量 45/45 测试文件全绿（隔离子进程、全新 TMPDIR）。验收对象与验收人
> 分离成立（R-3 返修本体为编码方 2026-08-28 交付；主审席本会话工程批次未触碰
> R-3 范围模块）。坐标登记：validateFixReport 现居 lib/review-report.js（R3-06
> 计划坐标 review-enforcement.js，后续受监督轮次模块拆分所致，语义未变）。
> **门态语义（历史快照：本块落笔时点表述，「待副审复核＋用户终判」已被下方
> 门态收口段取代——R-3 已按用户同日后续指令「忽略副审进行后续任务」关闭）**：
> R-3 由「双席验收未发生」更新为「主审席通过、待副审补进复核＋
> 用户终判」——按 10.6.2 第 11 步，双方交叉复核完成前不收口 R-3，P9 门控不变。
> 同段挂账销项：四源重建（09-04 完成 4/4）、F-S15（09-04 裁定保留观察）、部署平价
> 结构化字段（C2 批 parity 机械派生落地）。
>
> **门态收口（2026-09-04 P9 执行批＋最终门态判定；用户指令「忽略副审进行后续任务」，
> 见 CHANGELOG P9 批条目）**：
> **R-3 关闭**（依据＝主审席验收 17/17＋用户指令豁免副审门态前置；副审补进转为
> 事后跟进复核，如其提出新发现按新编号正常缺陷流程处理，不追溯推翻用户已生效
> 的推进决定，除非用户另行裁定）。**P9 执行记录（主审侧）**：P9-1＝R-3 批即主审
> 独立验收（F-RV-1~17 逐项＋45/45 复现）；P9-4＝源码证据独立复跑（0008
> sourceManifest 9/9 与当前文件一致；包链 0001→0008 自哈希＋基链全过；历史
> mail 面七模块全绿）；P9-5＝上线前专项（三处现行指针 repo/部署/测试均 R-2026-009；
> 规程登记 valid；权限矩阵四 bot 符冻结预期；user-facing API 200 结构化；
> 无 migration-pending 残留；**发现一项 P3**：知识库索引 R-2026-007 未标
> updated/supersededBy=R-2026-009——登记时未传 supersedes 字段、机械标记未触发
> （006→007 先例有标记；现行指针全部显式指向 009，无功能误解析；修复＝真实面
> 单行索引补记——**已于 2026-09-04 用户点名授权执行完成**）；P9-6＝授权对象 P7-5 已于 08-29 用户点名授权
> 执行并关闭（历史消费）；P9-7＝机械复核（parity 8/8 identical、部署侧
> node --check 8/8、ledger 8 行全 completed 且 8/8 runId 账实落位＝5 在
> artifacts/runs＋3 在抢救归档、五进程存活、host/review API 200）。
> **最终门态判定：READY／放行**（主审机械复核全绿＋用户指令推进；副审半边
> 豁免在案）。

## 一、准确状态与范围

```text
P0 契约文本：v3 已冻结（D1～D8）；两席复审未再提出契约级异议
v3 切片：48 切片已形成；P1～P8 实现已执行、被 F-P9 独立评审驳回（见第十节）
F-P9-01～F-P9-09：独立评审驳回项（7 CRITICAL + 2 HIGH）；R-2 返修已执行、反例入回归
F-RV-1～F-RV-17：R-2 独立复审驳回项（两席统一返回 2026-08-28）；R-3 返修已执行（10.6/10.7）
W-RV-1：环境归因项——用户授权给 reviewer-lead 的 danger-full-access，接受归因；
        台账补录已完成（见 CHANGELOG 台账条目）
F-S1～F-S15：已映射，待复审、实现和验收（F-S15 为普通邮局 nextSeq 观察项）
F-V3-1～F-V3-9：已按一致意见修订，待双席复证
运行时代码：P1～P8 接线与 R-2/R-3 返修已落地并自测全绿（35/35）；
            R-2 独立验收不通过；R-3 已关闭（2026-09-04 主审验收 17/17＋
            45/45 复现＋用户指令豁免副审门态前置，见顶部门态收口段）
编码方实例：未创建
新规程：已按 P7-5 既有证据链登记（R-2026-009，2026-08-29 执行）；四文件部署平价
        已恢复，P7-5 已关闭
返修 R-2：已执行，独立验收不通过；返修 R-3：已执行完毕并关闭（2026-09-04 主审验收＋用户豁免副审指令；副审补进转事后跟进）
P6-4/P6-5/P7-5：已关闭（2026-08-29 第八轮双席会签＋用户确认，见顶部「门态收口」段）；P9：继续门控，仅点名启动
实现/配置/部署/重启：P1～P8 与 R-2/R-3 已授权并执行；P7-5 已执行并于第八轮恢复
  四文件 repo↔deploy 平价（历史登记/迁移/重启事实以既有证据链为据）；此后收尾
  批次零代码/零配置/零重启（2026-08-30 宿主机重启为环境事件，非本仓操作）
```

本文现行内容为第一～第九节；附录只保留历史版本摘要，不可执行。

## 二、P0 v3 候选冻结决策（待双席复审）

### P0.1 对象、生产路径与普通入口兜底

生产路径唯一为：

```text
用户/host 创建评审任务
→ host review orchestrator 建立 invocation
→ host 通过 reviewer RPC 启动专用评审回合
→ host 收集该回合输出
→ host 单写者落 review-artifact
→ host 按固定状态机 relay / 创建下一个 invocation
```

协议对象：

```text
review-artifact
  不可变正文和 manifest；负责证据、运输与审计；本身不触发 agent 回合。

review-invocation
  host 管理的显式评审回合命令；绑定 task/cycle/stage/reviewer；不进入普通 inbox。

review-event
  host 单写者产生的追加事件；用于状态折叠，不是自由文本消息。

engineering-job
  用户授权修复后由 host 机械生成的执行任务；只含 taskId、授权 F-编号、范围、验收标准、
  禁止越权和报告 schema，不预填修复/通过结论；不是 review-invocation。

user-decision
  用户受信通道产生的独立决策记录；不属于终审正文，也不能由 bot 写入。

source-snapshot
  host 为某个 reviewCycle/repairCycle 固定的只读源码视图；保存根目录逻辑 ID、文件清单、
  每文件 hash/byteLength 与总 manifest hash，不把宿主绝对路径写入模型正文。
```

普通 `handleIncoming()` 不是生产路径。若普通 inbox 被误投 review-artifact 或
review-invocation，入口必须 fail closed：不调用 `runNativeAgentTurn`、不写 outbox、
不自动回信，只向 host 安全审计通道报告误投。P3 只实现此误投兜底，不承担正常 relay。

### P0.2 reviewer 回合唯一选型

采用 **host 侧 orchestrator + RPC 直推 reviewer session**，不采用 bot 侧 watcher 自唤：

- host 是 invocation、event、idempotency index 和 relay 状态的唯一写者；
- host 原子 claim invocation 后调用目标 reviewer 的 DSH RPC；
- 每个 invocation 必须 `session.create` 一个全新专用 session，只执行一次 prompt；cwd 使用该
  reviewer 已授权的 sessionWorkspace，prompt 仅注入 P0.3 允许读取的工件及其 hash，不复用
  普通 bot session、其他 task/cycle 或前一 stage 的隐式上下文；
- reviewer session 位于目标 reviewer 实例，真实 botId/PID/sessionId 与输入 artifactIds/hash
  记入事件；session.create/prompt/history 任一步失败均不得把其他 session 当回退；
- reviewer 输出由 host 按本 invocation 的 sessionId/turn boundary 读取 assistant message 的
  text parts；body 使用固定机械序列化 `textParts.map(String).join("\n")` 后 UTF-8 编码，记录
  parts 的 canonical JSON hash 与 body hash/byteLength。host 不摘要、不做语义改写，也不得
  冒称 DSH RPC 提供了不存在的原始 wire bytes；以 invocationId 为幂等来源落 artifact；
- bot 侧不得自行 claim、创建 invocation 或直接写 review spool；
- reviewer 离线时 invocation 保持 pending/retry，不回退普通 mail 路径；
- lead 永远不是 review invocation 的 targetReviewer；
- 每个 invocation 必须绑定该 cycle 的 `sourceSnapshotId`。reviewer 专用 session 只获得
  `review_read/review_search/review_probe` 三类 scope-bound capability：read/search 只能访问快照
  清单内路径并拒绝绝对路径、`..`、符号链接逃逸；probe 只能执行任务验收中已登记的命令，
  在一次性快照副本和可写临时目录中运行，记录命令、退出码、stdout/stderr hash、起止时间，
  不得写项目源、配置、部署目录或其他 bot 数据。若 scoped 读/探针能力不可用，invocation
  必须 fail closed，reviewer 不得把 host 转述或既有测试输出冒充“亲手复证”。

bot 工具若需 claim engineering-job 或提交返修报告，只能调用 host 内部接口；工具注册闭包
持有 host 签发的短期 HMAC capability，模型参数和日志均不得暴露 secret。capability 绑定
`botId + pid + startedAt + allowedOperation + jobId + issuedAt + expiresAt + nonce`，host 校验
当前注册表 PID/startedAt、过期时间、operation、job 归属和 nonce 单次消费；重启即失效并轮换。
capability 不允许创建 review-invocation、写 user-decision、扩大 job scope 或伪造 authorBotId。

### P0.3 stage、作者、可见性与转换表


reviewer RPC 输出必须是 stage 专用 JSON envelope，所有 schema 均
`additionalProperties=false`：

```text
共同字段：schemaVersion, body
`initial-lead|initial-second|recheck-lead|recheck-second`：body
`delta-lead|recheck-delta-lead`：body, nextAction(final|discussion),
                                      discussionFindingIds[], discussionBody（R1，仅 discussion 时必填）
`discussion-second|recheck-discussion-second`：body（R2）
`final-lead|recheck-final-lead`：body, decision, findingIds[]
```

host 对整个 envelope 的 canonical JSON、`body` UTF-8 bytes 和可选 `discussionBody` 分别计算
hash/byteLength。host 只做 schema/枚举/绑定校验，不从自然语言推断 nextAction/decision；
artifact 正文严格等于 `body`。delta 请求 discussion 时，host 在 delta artifact committed 后
以 `discussionBody` 原字节建立唯一 R1 artifact/thread，再投递副审；字段缺失、额外或 stage
不匹配均拒绝，不从普通 assistant 文本猜测。
`reviewCycle` 从 1 开始，只在用户显式开启新的完整评审时增加；`repairCycle` 在某个 final
revision 下从 1 开始，每个新的获授权返修增加；`decisionRevision` 对同一 final 工件顺序递增。
同一 task/对应 cycle/stage/target 至多一个逻辑 invocation。实现常量和测试必须逐字钉住下表，
不得在实现时自由增删 stage。

| stage | 合法作者/执行者 | 前置 | 可读取工件 | 合法输出/收件人 | 对象/动作上限 |
|---|---|---|---|---|---:|
| `task-spec` | authenticated user（host 仅封装） | 无 | 用户原始任务正文 + 初始 sourceSnapshotId | 仅 host 任务存储 | 每 task 1 |
| `initial-lead` | reviewer-lead | task-spec | task-spec、绑定 source-snapshot | host spool；副审永不可见 | 每 cycle 1 |
| `initial-second` | reviewer-second | task-spec | task-spec、绑定 source-snapshot | host spool；主审双齐前不可见 | 每 cycle 1 |
| `delta-lead` | reviewer-lead | 双初审均 completed | task-spec、主审初审、副审初审 | delta artifact；`nextAction=final|discussion`；discussion 时同时产 R1 | 每 cycle 1 |
| `discussion-second` | reviewer-second | delta committed 且 nextAction=discussion/R1 committed | task-spec、副审初审、delta、R1 | 严格一个 R2 mail-discuss artifact | 每 cycle 1 |
| `final-lead` | reviewer-lead | delta completed，且无需讨论或 R2 committed | task-spec、双初审、delta、R1/R2（如有） | reviewer-second + user-facing | 每 cycle 1 |
| `fix-report` | engineering bot | user-decision 明确授权修复 | 被授权 F-编号、范围、验收标准 | host spool；触发双席复检 | 每 repairCycle 1 |
| `recheck-lead` | reviewer-lead | fix-report completed | 原终审、授权、fix-report、repairCycle source-snapshot | host spool；副审初判不可见 | 每 repairCycle 1 |
| `recheck-second` | reviewer-second | fix-report completed | 同上 | host spool；主审双齐前不可见 | 每 repairCycle 1 |
| `recheck-delta-lead` | reviewer-lead | 双复检初判 completed | 双复检初判及原证据 | delta artifact；`nextAction=final|discussion`；discussion 时同时产 R1 | 每 repairCycle 1 |
| `recheck-discussion-second` | reviewer-second | recheck delta/R1 committed | 自身复检初判、delta、R1 | 严格一个 R2 mail-discuss artifact | 每 repairCycle 1 |
| `recheck-final-lead` | reviewer-lead | recheck delta completed，且无需讨论或 R2 committed | 全部复检证据和 R1/R2（如有） | reviewer-second + user-facing | 每 repairCycle 1 |
| `user-decision` | authenticated user principal | final/recheck-final user-facing 已 committed | 对应最终工件 | 独立 decision store | 每 decisionRevision 1，顺序追加 |

`task-spec` 正文作者唯一为用户；host 只能附加 taskId/createdAt/hash/byteLength 等结构字段，
不得生成任务摘要或改写正文。所有 reviewer 工件正文作者唯一为表中 reviewer；host 只按
P0.2 固定序列化保存该专用 session 单次 assistant 输出，并同时保存 parts/body 两级 hash。

固定可见性：

- 主审初审件任何阶段均不投递副审；副审只在终审时看到主审最终正文；
- 副审初审件仅双齐后对主审开放；
- 复检两席初判同样保持双齐前互盲；
- 未列出的 stage/author/recipient/transition 一律拒绝；
- authorBotId 从目标 reviewer 或实例 capability 注入，不接受模型自报；
- stage 决定 required recipients，提交方不得自由扩大或缩小。

修复执行不使用 reviewer invocation。`final-lead/recheck-final-lead` 产生 user-facing 工件后，
只有 authenticated user 的 decision 明确列出 `authorizedFindingIds/scope/acceptanceCriteria`，
host 才创建一个 engineering-job。engineering-job 固定生命周期：

```text
pending → delivered → claimed → report-submitted → closed
                    └→ failed/cancelled
```

job 绑定 `taskId/repairCycle/finalArtifactId/decisionId/engineeringBotId`；编码方只可 claim
分配给自身的 job，并提交一个 `fix-report`。job claim 采用与 invocation 分离的 lease：字段含
`claimOwner/claimAt/leaseUntil/heartbeatAt/attempt/maxAttempts/reportArtifactId`，同一 job 最多一个
有效 claim；过期后由 host 单写者回收，三次失败进入 failed，只有新的用户 decision revision
才能创建新 job，不能复活旧 job。job 不得包含 PASS/已修复结论，也不能自行扩大 F-编号或
scope；重新派发或第二次返修必须有新的用户 decision/revision 和 repairCycle。

固定主链（箭头表示唯一合法的 host transition）：

```text
task-spec
→ initial-lead || initial-second
→ delta-lead
→ [可选 R1 → discussion-second → R2]
→ final-lead
→ user-decision
→ [若授权修复] engineering-job → fix-report
→ recheck-lead || recheck-second
→ recheck-delta-lead
→ [可选 R1 → recheck-discussion-second → R2]
→ recheck-final-lead
→ user-decision ...
```

`||` 只表示可并行执行，不表示互相可见；可见性仍由上表和双齐闸控制。

### P0.4 invocation 生命周期、claim 与重试

状态机固定为：

```text
pending → claimed → completed
             └──→ retry-wait → pending
             └──→ dead-letter ──authenticated-user explicit requeue──→ pending
pending/claimed → cancelled（仅用户取消或任务 superseded）
```

字段至少为：

```text
invocationId, taskId, reviewCycle, stage, targetReviewer,
createdBy(host-event|user), artifactIds[], idempotencyKey,
status, claimOwner, claimAt, leaseUntil, heartbeatAt,
attempt, maxAttempts, requeueGeneration, outputArtifactId, completedAt, failureCode
```

规则：

- `createdBy` 只允许 host 确定性事件或 authenticated user；reviewer/lead/send_mail/模型文本
  均不能创建 invocation；
- host 以单写队列原子 claim；`claimOwner=hostInstanceId`；
- claim 后每 15 秒 heartbeat，lease 为 60 秒；有效 heartbeat 存在时不得二次 claim；
- 进程重启后，过期 lease 可由新 hostInstanceId 回收；输出落盘以 invocationId 幂等；
- `maxAttempts=3`（每个 requeueGeneration）；第三次失败进入 dead-letter，禁止自动继续；仅
  authenticated user 显式 requeue 可把**同一 invocationId** 追加新 generation 后送回 pending，
  保留既有失败事件与输入集，不创建同 stage 第二逻辑 invocation；
- completed 必须绑定唯一 `outputArtifactId`；同 invocation 出现不同输出 hash 时 quarantine；
- invocation 幂等键为 `(taskId, cycle, stage, targetReviewer)`；同键不同输入集拒绝。

### P0.5 讨论环与 invocation 的边界

- invocation 只负责机械唤醒合法 reviewer；双席交换的语义对象仍是 `mail-discuss` artifact；
- `delta-lead`/`recheck-delta-lead` 输出结构化 `nextAction`；只有主审可请求 discussion，并在
  同一 envelope 提供 R1 `discussionBody`；host 不另写 R1；
- R1 artifact 必须绑定 `taskId/cycle/discussionThreadId/discussRound=1/replyTo=deltaArtifactId`；
  host 只按固定 transition 创建一个 `discussion-second`/`recheck-discussion-second` invocation；
- 副审专用 session 只读自身初判、delta 和 R1，输出 envelope body 机械成为 R2 artifact，绑定
  `discussRound=2/replyTo=R1ArtifactId`；副审不能请求第二 thread 或 R3；
- R2 committed 即 `discussion-closed`，host 创建 final invocation；无需讨论则 delta 后直接创建；
- R1/R2 正文与 hash 均不可变，供 final invocation 读取；host 不生成、摘要或改写讨论正文；
- 普通 `send_mail` 不能创建/追加本协议 discussion thread；现有普通 mail-discuss 仍保留历史
  行为，但若携带 review task/cycle/thread 绑定则必须由 P2-4 arbiter 校验并拒绝旁路写入；
- final 阶段不得再开 discussion；未收敛时按现行规程 disagree-and-commit；
- reviewer 输出新 artifact 不能机械生成同阶段 invocation；只有上表 transition 可创建；
- 每 cycle 机械上限恒为 R1+R2，不能用新 artifact/invocation/send_mail 绕过。

### P0.6 host 单写者、存储与损坏处理

存储根：`<dshHome>/bots/review/`，与普通 inbox/outbox 分离。host 通过 lockdir 确保同一
DSH_HOME 只有一个 review writer；锁保存 hostInstanceId/PID/startedAt/writerEpoch。writerEpoch
单调增加并写入 reservation/event/claim。**lease 过期本身不足以接管**：只有能够证明原 PID 与
startedAt 对应进程已死亡时才允许接管；身份不明或旧进程仍活着时保持 fail-closed/不可用，
不得形成双写者。接管原子增加 writerEpoch；旧 epoch 的延迟 RPC 输出、heartbeat 和落盘请求
一律拒绝并审计。

```text
artifacts/<artifactId>/body.md
artifacts/<artifactId>/manifest.json
artifacts/<artifactId>/events/<seq>-<eventId>.json
invocations/<invocationId>/manifest.json
invocations/<invocationId>/events/<seq>-<eventId>.json
deliveries/<recipient>/<artifactId>/body.md
routes/<routeId>/manifest.json
results/<taskId>/<artifactId>/body.md
decisions/<taskId>/<decisionId>.json
reservations/<idempotencyKeyHash>.json
source-snapshots/<snapshotId>/manifest.json
source-snapshots/<snapshotId>/tree/...（只读物化副本；不含 review store/凭据/其他 bot 数据）
quarantine/<objectType>/<objectId>/...
```

- 正文和 manifest 不可变，使用同目录 tmp + fsync + rename；
- 事件不用共享 `events.jsonl`，改为一事件一文件；host 单写队列为每对象分配单调 seq，事件
  也用同目录 tmp+fsync+rename；seq 只在该事件 commit 后推进。崩溃残留 tmp 必须先 reconcile，
  在前序 seq 未提交/隔离前不得写后继事件；
- 所有状态只由合法事件折叠，不原地更新 manifest；
- 任何事件缺号、JSON 损坏、schema 不符、hash 不符或非法 transition 均 fail closed：对象
  逻辑状态进入 quarantined/corrupt，禁止 relay、claim、下游 invocation 和 completed 展示；
  不移动或改写不可变源件，另在 `quarantine/` 追加引用、原因、发现时间和证据 hash；
- 不再使用“损坏行跳过后继续折叠”；
- idempotency index 也仅由 host 写；同键同 hash 返回既有对象；同键异 hash 拒绝新请求并把
  冲突请求证据写安全审计/quarantine，但不污染已通过完整性校验的既有 committed 工件；
- 测试必须覆盖并发同键/异键提交、事件并发、半写、manifest 冲突、host 崩溃和锁接管。

### P0.7 artifact 提交与崩溃恢复

host 提交顺序：

```text
验证 principal/stage/schema
→ reserve idempotencyKey
→ 写 body.tmp + manifest.tmp
→ fsync/rename
→ 写 submitted event
→ commit idempotency record
→ 返回 artifactId
```

重启 reconciliation：

- reservation 已 durable，且 body/manifest 完整、hash 正确但 submitted 缺失：按同一 writerEpoch reservation 恢复 submitted；
- body 或 manifest 不完整：移入 quarantine，不静默删除；
- submitted 存在但 idempotency record 缺失：重建 index；
- 响应前崩溃后使用同 key 重试，返回同 artifactId；
- 同 artifactId 对应的已落盘正文/manifest 自身出现冲突时该 artifact quarantine；仅新请求
  复用已占用 key 且 hash 不同，则拒绝新请求、保留既有完整 committed artifact。

### P0.8 per-recipient relay 与可恢复多目标事务

每次路由先写 route intent，列出 required recipients。每个 recipient 独立状态：

```text
pending → prepared → committed
                    └→ failed/quarantined
```

幂等键为 `(artifactId, recipient)`；事件和 hash 均按 recipient 记录。流程：

```text
route-intent
→ recipient prepare（目标 tmp）
→ recipient commit（rename）
→ 读回目标 hash/byteLength
→ recipient committed
→ reconcile required recipients
→ 全部 committed 后 route completed
```

恢复规则：

- 目标存在且 hash/byteLength 相同：补记/确认 committed；
- 目标存在但 hash 不同：recipient 与 route quarantine；
- 目标不存在：从 pending/prepared 重试；
- 允许物理中间部分提交，但 route 在全部 required recipients committed 前不得对外显示
  completed；
- “无部分成功”只用于**校验拒绝**：非法 stage/author/recipient 必须在任何目标写入前整体
  拒绝。已接受的多目标 route 使用可观察、可恢复的中间态，不宣称跨目录物理原子。

### P0.9 user-facing 读取、通知和决策授权

host 提供同源 user-facing 接口（最终 URL 由实现常量冻结，测试使用同一常量）：

```text
GET  review metadata
GET  immutable review body
POST user decision
```

要求：

- GET 只返回 taskId/artifactId 匹配且 route 已 completed 的结果；正文只读；
- 通知只含 `taskId/artifactId/stage/status/createdAt/sha256/byteLength`，链接使用逻辑 ID，
  不暴露宿主绝对路径；
- POST decision 必须有 host 认可的 authenticated user principal + same-origin/CSRF 校验；
- CSRF/Fetch-Metadata 本身不构成用户身份。若宿主不能提供可绑定用户浏览器会话的 principal，
  decision 写接口必须 fail closed/禁用，不能退化为无鉴权本机 HTTP；
- bot 实例 capability 明确无 `decision.write` 权限；lead/reviewer/engineering 均不得写；
- taskId/artifactId、decision revision 和授权范围服务端校验；拒绝路径穿越和任意文件读取；
- user decision 与终审正文分离，host 不把决策改写成评审结论。

### P0.10 编码方权限和安全探针

三路径固定分离：

```text
sessionWorkspace：agent cwd
workspaceRoot：sandbox 写边界（目标为 /home/beijong/project/dsh-bots）
registry.workspace：展示/兼容路径，不得暗中替代前两者
```

编码方画像：`group=engineering, permission=workspace-write, readOnly=false`，不等于 full access。
模型/权限配置、运行时注册表、部署和重启仍需用户/运维显式授权。

探针结果三态：

```text
DENIED | ALLOWED | INCONCLUSIVE
```

原因至少区分：`sandbox-deny/plugin-not-registered/os-deny/approval-requested/target-missing/
rpc-failure/harness-failure/write-succeeded`。危险测试只在一次性 shadow DSH_HOME、临时
profile、部署副本镜像和受控 sentinel 中运行；记录前置/后置 hash、写后读回、清理和异常恢复。
未经专门授权不得对真实 bots.json、profiles、部署副本或他人 workspace 做破坏性探针。
探针自身失败只能是 INCONCLUSIVE。

### P0.11 返修报告 schema

返修报告固定十字段：任务号、输入 F-编号、修改坐标、实际修改、验证命令、验证结果、
观测窗口、未完成项、残留风险、是否需要部署/重启。JSON Schema 必须：

```json
{"type":"object","additionalProperties":false}
```

并为十字段定义 required/type/enum。`decision/approved/pass/riskFree/conclusion` 等额外键必须
拒绝；正文自然语言不做关键词扫描。编码方只能报告修复事实，不能提交评审判定。

### P0.12 新规程存活条款与活动指针迁移

新规程由系统登记时自动分配 ID；不得预写编号。新 body 必须逐项迁移 R-2026-007 的存活
条款：

```text
E 节埋缺陷试点机制与三口径度量预登记
任务号契约
mail-discuss 两轮上限
delta 与终审固定格式
分歧对照表
主审亲手复证要求
用户上诉/决策权
植入清单保密纪律
```

活动指针清单至少包括：

```text
lib/index.js send_mail 工具 schema（当前约 :2131）
lib/index.js reviewer prompt 注入（当前约 :2441）
tests/review-prompt.test.mjs 行为断言
tests/discuss-mail.test.mjs 工具 schema 断言
```

源码说明和历史 CHANGELOG 单独分类，不能用全局 `grep -c` 判迁移成败。验收直接读取实际
工具 schema、实际 reviewer prompt、新旧知识库状态及测试断言。迁移在维护状态进行：
review invocation 暂停；登记成功但任一活动指针/部署迁移失败时保持 `migration-pending`
并继续暂停，不静默以旧指针运行；全部行为断言和部署平价通过后再恢复。


### P0.13 稳定决策编号（D1～D14）

| 决策 | v3 唯一选择 | 归属 |
|---|---|---|
| D1 | 不可变正文/manifest＋一事件一文件＋事件折叠；损坏 fail closed | P1 |
| D2 | 独立 review store；普通 inbox 仅误投兜底 | P1/P3 |
| D3 | sessionWorkspace/workspaceRoot/registry.workspace 三路径分离 | P6 |
| D4 | enforcement 四主体矩阵；安全 shadow 探针三态 | P6 |
| D5 | 通知严格七字段，无摘要/正文/磁盘路径 | P5 |
| D6 | fix-report 十字段且 additionalProperties=false | P7-1 |
| D7 | 新规程系统分配 ID、迁移存活条款和全部活动指针 | P7-3..P7-5 |
| D8 | recheck final 只到副审/user-facing，lead 仅只读结构化状态 | P4-6/P5 |
| D9 | host 单写 orchestrator + 每 invocation 全新一次性 reviewer RPC session | P1/P2 |
| D10 | relay 按 artifactId+recipient prepare/commit/reconcile | P4 |
| D11 | authenticated-user decision 独立存储并机械生成 scope-bound engineering-job | P5-4..P5-7 |
| D12 | P8 编码方无结论证据包；P9 双席验收、用户 rollout 授权、部署后复核分离 | P8/P9 |
| D13 | cycle 绑定 immutable source-snapshot；reviewer 仅用 scope-bound read/search/probe 亲手复证 | P1/P2 |
| D14 | writerEpoch fail-stop 接管；engineering-job 使用独立 lease/heartbeat/失败终态 | P1/P5 |

D1～D8 保留原审计语义但按 v3 强化；D9～D14 记录本次一致意见新增的唯一选型。所有决策
仍是规划决策，不表示已实现，也不产生任何运行时授权。

## 三、F-S / F-V3 处理映射

| 编号 | v3 处置 | 当前状态 |
|---|---|---|
| F-S1/F-V3-2 | P0.1～P0.5 固定对象、stage、transition、invocation 生命周期与讨论边界 | 设计已覆盖，待复审/验收 |
| F-S2 | P0.3 固定双席可见性和默认拒绝 | 设计已覆盖，待复审/验收 |
| F-S3/F-V3-3 | P0.6 host 单写者、一事件一文件、损坏 fail closed | 设计已覆盖，待复审/验收 |
| F-S4 | P0.4/P0.7 固定幂等、claim、崩溃恢复 | 设计已覆盖，待复审/验收 |
| F-S5 | P0.3 固定 stage→author/recipient | 设计已覆盖，待复审/验收 |
| F-S6/F-S15 | 独立 review store；普通 messages.jsonl 竞态保留独立观察 | 新管道不复用；F-S15 已于 2026-09-04 修复销账（用户指令「解决并发小竞态」，升级原「保留观察」裁定）：lib/mail-seq-lock.js 跨进程 lockdir 写锁覆盖「读最大 seq→追加」整段，4 子进程×25 条真并发 0 丢失 0 撞号实证 |
| F-S7 | P0.10 三路径分离 | 设计已覆盖，待复审/验收 |
| F-S8/F-V3-6 | P0.10 隔离探针与三态结果 | 设计已覆盖，能力待实测 |
| F-S9 | v3 路由拆为 P4-1～P4-7 | 设计已覆盖，待复审/验收 |
| F-S10 | P0.9 七字段通知白名单 | 设计已覆盖，待复审/验收 |
| F-S11/F-V3-8 | P0.11 additionalProperties=false | 设计已覆盖，待复审/验收 |
| F-S12/F-V3-9 | 实现自测 P8 与独立门禁 P9 分离并整体换号 | 设计已覆盖，待复审/验收 |
| F-S13/F-V3-7 | P0.12 存活条款、活动指针和 migration-pending | 治理设计已覆盖，尚未登记 |
| F-S14 | 复检最终件只到副审和 user-facing；lead 仅结构化状态只读 | 设计已覆盖，待复审/验收 |
| F-V3-1 | 第一节统一状态和章节口径 | 文档已修订，待复审 |
| F-V3-4 | P0.8 per-recipient 可恢复事务 | 设计已覆盖，待复审/验收 |
| F-V3-5 | P0.9 + P5 完整读/通知/决策通道 | 设计已覆盖，待复审/验收 |

“设计已覆盖”不等于 CLOSED；只有实现、确定性测试和独立双席验收完成后才能销账。

### 外部评审回报登记（2026-09-05，F-RV-27～29）

用户转达的外部评审回报（五项断言）经主审席逐项独立核验**全部属实**；一项新发现
当轮处置销账，两项登记为长期观察，另两项为既档状态重述（体量观察已由质量评审
P3/观察项覆盖；0008 之后的批不在冻结面、触碰须新 runId 出 0009 系 AGENTS.md §2
成文纪律）。

| 编号 | 断言/发现 | 处置 |
|---|---|---|
| F-RV-27 | README §2 标题计数「12 个 md」过期（盘面实为 14；§2 表体本已逐行覆盖 14 件，仅标题数字漂移） | **当轮修复销账**（2026-09-05 用户「继续」）：标题 12→14；README §3 F-RV 行同步至 1~29 |
| F-RV-28 | `/api/bots` 管理 API 无身份认证，守卫仅 Sec-Fetch-Site CSRF 检查（lib/index.js:1391）＋本机部署假设（回环监听属 dsh core 宿主面）；评审写面 decision/intake 因 principal 不可用恒 403 fail-closed | **升级处置销账（2026-09-05 B1 批）**：lib/api-security.js 令牌门控＋principal 适配（decision/intake 解封）；GET 只读面不设令牌系文档化保留——宿主暴露策略变化（非回环/反代）时仍须整体重评 |
| F-RV-29 | bot 自启动仅在宿主 apply 时一次性扫描拉起，无 supervisor 崩溃自愈；bot 崩溃后需手动 start 或等宿主下次启动 | **升级处置销账（2026-09-05 B2 批）**：lib/bot-supervisor.js 崩溃退避自愈＋generation fencing＋crash-loop 熔断＋readiness 观测链＋enabled=false 自动停＋后裔清理；留限（崩溃路径后裔无预快照、RPC health 为预留缝）见 CHANGELOG 对应条目 |

## 四、v3 原子切片总览

每项预算约 200k；共 **48 切片 / 9 阶段 / 约 9.6M 上下文**。P1=5、P2=6、P3=2、
P4=7、P5=8、P6=5、P7=5、P8=3、P9=7。

| 阶段 | 切片 | 名称 | 前置 |
|---|---|---|---|
| P1 数据/状态平面 | P1-1 | review store 布局、不可变正文与 manifest | P0.6 |
| | P1-2 | host 单写锁、事件文件与 fail-closed 折叠 | P1-1 |
| | P1-3 | idempotency index 与实例身份提交接口 | P1-2 |
| | P1-4 | 崩溃 reconciliation 与 quarantine | P1-3 |
| | P1-5 | 并发、半写、锁接管和损坏注入测试 | P1-4 |
| P2 invocation/orchestrator | P2-1 | invocation schema、状态机、claim/lease | P1-3 |
| | P2-2 | host RPC orchestrator 唯一实现 | P2-1 |
| | P2-3 | 实例 capability 与 author 绑定 | P2-2 |
| | P2-4 | host 仲裁的 R1/R2 mail-discuss artifact 与 discussion invocation bridge | P2-2 |
| | P2-5 | 离线、超时、重启、dead-letter 恢复 | P2-1..P2-4 |
| | P2-6 | source-snapshot 与 scope-bound reviewer 读/search/probe 证据面 | P1-1/P2-3 |
| P3 普通入口兜底 | P3-1 | handleIncoming 误投 fail-closed guard | P1-2 |
| | P3-2 | 正常 review 路径与误投路径分离测试 | P3-1/P2-2 |
| P4 路由/relay | P4-1 | stage/author/transition/recipient 常量与验证器 | P0.3 |
| | P4-2 | route intent 与 per-recipient 状态 | P4-1 |
| | P4-3 | 单 recipient 写入、读回 hash 与幂等 | P4-2 |
| | P4-4 | 多目标 reconcile、quarantine 与 completed 门控 | P4-3 |
| | P4-5 | 主流程：双初审→delta→讨论→final | P2-4/P2-6/P4-4/P5-1 |
| | P4-6 | 返修流程：fix-report→双复检→recheck final | P2-6/P4-4/P5-1/P5-8/P7-1 |
| | P4-7 | 非法组合校验拒绝与安全审计 | P4-1 |
| P5 user-facing | P5-1 | immutable result store 与索引 | P4-3 |
| | P5-2 | metadata/body 只读 API 与路径防护 | P5-1 |
| | P5-3 | 七字段通知与 UI 定位 | P5-2 |
| | P5-4 | authenticated user principal/CSRF 门控 | P5-2 |
| | P5-5 | user-decision 写 API 与独立存储 | P5-4 |
| | P5-6 | lead/bot 拒写、task/artifact 绑定与授权测试 | P5-5 |
| | P5-7 | 用户授权→scope-bound engineering-job 生成与范围门控 | P5-5/P7-1 |
| | P5-8 | engineering-job claim lease、崩溃恢复与 fix-report 关闭 | P5-7/P2-3 |
| P6 编码方建制/权限 | P6-1 | 三路径 schema 与注册脚手架（不写真实注册表） | P0.10 |
| | P6-2 | 路径×enforcement 主体矩阵 | P6-1 |
| | P6-3 | shadow DSH_HOME 安全探针 harness | P6-2 |
| | P6-4 | 获授权后的真实实例注册（host/operator） | P6-1/P6-3/用户授权 |
| | P6-5 | 真实实例非破坏性 sentinel 验证 | P6-4 |
| P7 报告/规程 | P7-1 | fix-report 严格 schema 与校验 | P0.11 |
| | P7-2 | 轻量/增强复检分级门控 | P7-1 |
| | P7-3 | 新规程 body/存活条款/活动指针迁移包预备（不登记） | P2～P6 对应实现 |
| | P7-4 | 迁移 dry-run、行为断言与失败恢复测试（不登记/不部署） | P7-3 |
| | P7-5 | 获授权后的实际登记、指针替换、部署与 migration-pending 恢复 | P9-6 |
| P8 实现方自测/证据 | P8-1 | 单元与组件测试包 | P1～P6 + P7-1..P7-4 |
| | P8-2 | 全流程 E2E、崩溃/并发/权限测试包 | P8-1 |
| | P8-3 | 编码方证据包与未决风险；不得判 PASS | P8-2 |
| P9 独立验收/门禁 | P9-1 | 主审独立验收 | P8-3 |
| | P9-2 | 副审独立验收 | P8-3，且不读 P9-1 结论 |
| | P9-3 | 双席差异讨论与终审 | P9-1/P9-2 |
| | P9-4 | 历史 mail 回归和源码证据独立复跑（上线前） | P9-1/P9-2 |
| | P9-5 | 规程迁移包、权限和 user-facing 上线前专项门禁 | P9-3/P9-4 |
| | P9-6 | 用户上线授权门（只授权 P7-5，不解除门态） | P9-3/P9-5 |
| | P9-7 | P7-5 后双席机械复核与最终门态判定 | P7-5 |

## 五、切片交付契约

所有 P1～P9 切片（含实现、自测、独立验收和授权门）必须逐项包含：

```text
输入协议
输出协议
唯一责任方
前置依赖
禁止越权
确定性测试命令
坐标/单位/观测窗口
失败与恢复语义
```

责任方按动作固定：P1～P5、P6-1～P6-3、P7-1～P7-4、P8 由编码方实现/自测；P6-4
真实注册和 P6-5 sentinel 验证由获用户授权的 host/operator 执行；P7-5 由获上线授权的
host/operator 执行，编码方只能提供迁移包，不能调用注册/登记/部署/重启动作。P9-1 为
主审；P9-2 为副审；P9-3 为主审按现行讨论/终审规程收口；P9-4/P9-5/P9-7 由双席各自
复跑；P9-6 仅用户或用户授权的机械授权门。编码方不得代行 P9，也不得把 P8 证据包标为
PASS/READY；P9-6 只授权执行 P7-5，不能把未登记/未部署/未复核的系统标为 READY。

以下各切片在总览基础上的硬验收点不可删减。

### 逐切片输入/输出/坐标/失败恢复矩阵

> 责任方、前置和禁止越权分别以本节统一责任、第四节前置和 P0 默认拒绝为准；本矩阵补齐
> 每个切片的输入、输出、确定性命令、代码坐标及观测窗口。P1～P8 实现已按本表落名执行，
> 但被 F-P9 独立评审发现多处坐标/语义偏离（见第十节）；返修时若因模块边界继续调整坐标，
> 必须先修订本表并重新过切片复核，不得让文档与盘面失实。

| 切片 | 输入 → 输出 | 计划坐标；确定性命令 | 单位/窗口；失败恢复 |
|---|---|---|---|
| P1-1 | bytes+manifest fields → immutable artifact | `lib/review-store.js`; `review-store.test.mjs` | bytes/hash；单次提交；tmp 隔离 |
| P1-2 | artifact/events → folded state | `lib/review-store.js`; `review-events.test.mjs` | event seq；对象生命周期；corrupt→quarantine |
| P1-3 | principal+key+body → artifactId | `lib/review-service.js`; `review-submit.test.mjs` | key/hash；请求窗口；同键恢复/冲突隔离 |
| P1-4 | 残留磁盘状态 → reconcile 结果 | `lib/review-reconcile.js`; `review-crash.test.mjs` | 文件/事件数；重启窗口；补记或隔离 |
| P1-5 | 两进程故障注入 → 并发证据 | `tests/review-concurrency.test.mjs` | 进程/提交数；并发窗口；锁接管或响亮失败 |
| P2-1 | invocation request → durable lifecycle | `lib/review-orchestrator.js`; `review-invocation.test.mjs` | attempt/秒；invocation 生命周期；lease 回收 |
| P2-2 | claimed invocation → reviewer RPC result | `lib/review-orchestrator.js`; `review-orchestrator.test.mjs` | turn/PID/session；RPC 回合；离线 retry |
| P2-3 | bot instance/job → scoped capability | `lib/review-capability.js`; `review-capability.test.mjs` | nonce/秒；token 生命周期；过期/冒用拒绝 |
| P2-4 | delta+mail-discuss → discussion artifacts/final trigger | `lib/review-discussion.js`+`lib/index.js`; `review-discussion-bridge.test.mjs` | round/hash；R1→R2；R3/串线拒绝 |
| P2-5 | 超时/重启/冲突 → retry/dead-letter | `lib/review-orchestrator.js`; `review-recovery.test.mjs` | attempt/lease；故障窗口；三次后停机 |
| P2-6 | cycle+源码根 → immutable snapshot + scoped read/search/probe evidence | `lib/review-evidence.js`; `review-evidence.test.mjs` | file/hash/exit；单 invocation；逃逸/未登记命令拒绝 |
| P3-1 | 普通 inbox 误投 → audit reject | `lib/index.js` handleIncoming 前；`review-ingress-guard.test.mjs` | turn/outbox 增量；单次误投；零副作用 |
| P3-2 | 正常/误投两路径 → 分离证据 | `tests/review-ingress-guard.test.mjs` | turn/route 数；两次 E2E；失败保留夹具 |
| P4-1 | P0.3 表 → validators/constants | `lib/review-protocol.js`; `review-route-schema.test.mjs` | 组合数；全枚举窗口；未知即拒绝 |
| P4-2 | artifact+required recipients → route intent | `lib/review-relay.js`; `review-relay.test.mjs` | recipient 数；route 生命周期；intent 可重放 |
| P4-3 | intent recipient → committed delivery | `lib/review-relay.js`; `review-relay.test.mjs` | bytes/hash；单 recipient；同 hash 收敛 |
| P4-4 | 部分 route → reconciled route | `lib/review-reconcile.js`; `review-relay-reconcile.test.mjs` | committed/required；崩溃窗口；冲突隔离 |
| P4-5 | 双初审/delta/discussion → final route | `lib/review-flow.js`; `review-main-flow.test.mjs` | artifact/turn；单 reviewCycle；双齐前 pending |
| P4-6 | fix-report/双复检 → recheck final route | `lib/review-flow.js`; `review-recheck-flow.test.mjs` | repairCycle/artifact；复检周期；互盲/失败停住 |
| P4-7 | 非法组合 → rejected audit | `lib/review-protocol.js`; `review-route-schema.test.mjs` | 拒绝数；单请求；首写前终止 |
| P5-1 | completed final route → result index/body | `lib/review-results.js`; `review-results-api.test.mjs` | bytes/hash；生成窗口；失败可重放 |
| P5-2 | logical IDs → read-only response | `lib/index.js` review GET；`review-results-api.test.mjs` | HTTP/status/bytes；请求窗口；非法 ID 4xx |
| P5-3 | state event → 七字段通知/link | `lib/client.js`+host API；`review-notify.test.mjs` | key 数=7；通知窗口；失败重试不扩键 |
| P5-4 | browser request → authenticated principal/fail closed | host API auth adapter；`review-user-principal.test.mjs` | principal/status；请求窗口；无身份禁写 |
| P5-5 | principal+decision → immutable decision | `lib/review-decisions.js`; `review-decision.test.mjs` | revision/hash；提交窗口；同 revision 幂等 |
| P5-6 | 非用户/错绑定写入 → 403/audit | host review API；`review-decision.test.mjs` | actor/状态码；攻击矩阵；零写入 |
| P5-7 | 授权 decision → scope-bound engineering-job | `lib/review-jobs.js`; `review-engineering-job.test.mjs` | job/repairCycle；创建窗口；越界拒绝 |
| P5-8 | job claim/heartbeat + report → closed/failed | `lib/review-jobs.js`; `review-job-recovery.test.mjs` | attempt/lease；job 生命周期；过期回收/新 revision 重派 |
| P6-1 | bot profile → 三独立路径 | `lib/shared.cjs`+registry；`review-workspace.test.mjs` | 绝对路径；注册事务；不一致拒绝 |
| P6-2 | 路径×主体 → enforcement matrix | `lib/review-enforcement.js`; `review-enforcement-matrix.test.mjs` | cell 数；矩阵版本；未知保留待测 |
| P6-3 | shadow targets → 三态探针证据 | `scripts/review-enforcement-probe.cjs`; shadow 测试 | hash/action/time；探针期；清理/INCONCLUSIVE |
| P6-4 | 授权+脚手架 → 真实工程 bot 四源注册 | host/operator 注册命令表 | botId/PID/hash；授权窗口；失败回滚/不启动 |
| P6-5 | 已注册实例+sentinel → 非破坏性证据 | 同脚本 `--real-sentinel`; 人工授权守卫测试 | 前后 hash/PID；授权窗口；异常清理 |
| P7-1 | fix-report JSON → accepted/rejected report | `lib/review-report.js`; `review-report.test.mjs` | 字段数=10；校验窗口；缺项清单 |
| P7-2 | 六条件 → light/enhanced | `lib/review-level.js`; `review-level.test.mjs` | 64 组真值；纯函数；无副作用 |
| P7-3 | 现行 007+新协议 → migration package | `docs/generated/review-procedure-next.md`+patch；migration test | 条款/指针数；生成窗口；不登记 |
| P7-4 | 包+假 ID → dry-run 证据 | shadow 插件/知识库；`review-procedure-migration.test.mjs` | 指针/hash；dry-run；失败保持隔离 |
| P7-5 | 用户 rollout 授权+包 → 真实 ID/部署 | knowledge API+active pointers；迁移命令表 | ID/hash/时间；维护窗；migration-pending 恢复 |
| P8-1 | 已实现模块 → 单元/组件结果 | `node --check`+计划单测 | exit code；单模块窗口；失败不提交 P8-2 |
| P8-2 | 集成系统 → E2E/故障/权限结果 | `TMPDIR=/dev/shm node tests/run.mjs` | 模块/退出码；全量窗口；失败保留日志 |
| P8-3 | P8-1/2 → 无结论证据包 | `artifacts` 外部交付，不写运行目录 | 坐标/单位/起止；交付窗口；列未决风险 |
| P9-1 | 当前盘面+证据包 → 主审独立报告 | 主审独立命令表 | hash/exit/窗口；不改码，失败记 finding |
| P9-2 | 当前盘面+证据包 → 副审独立报告 | 副审独立命令表 | 同上；不读取 P9-1 结论 |
| P9-3 | 两初审报告 → 固定格式终审 | R-2026-007 当前规程，最多 R1/R2 | finding/round；终审窗口；分歧照表 |
| P9-4 | 当前源码 → 历史回归/全量报告 | mail 三测+全量（上线前无部署平价） | 模块/hash；独立复跑窗；不替实现修码 |
| P9-5 | migration 包/权限/user-facing → 上线前门禁 | 专项命令表+P7-4 dry-run | 条款/cell/API；专项窗口；任一失败 BLOCKED |
| P9-6 | 双席终审+用户决定 → rollout authorization | user-decision 受信通道 | scope/time；授权窗口；不解除门态 |
| P9-7 | P7-5 真实状态 → 双席机械复核/最终门态 | 实际 schema/prompt/test/parity 命令 | ID/hash/exit/PID；部署后窗口；任一失败 BLOCKED |


### P1 数据与状态平面

- **P1-1**：正文 byteLength 使用 UTF-8 字节，不用 JS `.length`；sha256 为 64 位小写 hex；
  tmp/fsync/rename 后读回；manifest `additionalProperties=false`。
- **P1-2**：host lock owner 可验证；writerEpoch 具 fencing；原 writer 存活/身份不明时禁止接管；
  事件一文件且 seq 在 commit 后推进；非法/缺号/损坏事件直接 quarantine。
- **P1-3**：reservation 先 durable；同 key+同 hash 返回既有对象；同 key+异 hash 拒绝/
  quarantine；capability 绑定实例。
- **P1-4**：覆盖正文后崩溃、manifest 后崩溃、submitted 后崩溃、响应前崩溃。
- **P1-5**：至少两个真实进程并发，测试同键、异键、事件写、锁主崩溃和接管。

计划测试：`review-store.test.mjs`、`review-events.test.mjs`、`review-submit.test.mjs`、
`review-crash.test.mjs`、`review-concurrency.test.mjs`。

### P2 invocation 与 orchestrator

- **P2-1**：状态机和字段逐项 schema 校验；claim 使用 host 单写事务。
- **P2-2**：只允许 host RPC 直推；每 invocation 新建一次性 session，记录 botId/PID/
  sessionId/hostInstanceId/input hashes；text parts 固定 join("\\n")，parts canonical JSON（UTF-8、
  数组顺序、无额外空白）与 body 两级 hash 钉住；无 bot watcher/旧 session 回退分支。
- **P2-3**：实例 capability 轮换、失效、跨 bot 冒用和越权 operation 全拒绝。
- **P2-4**：host 从 delta envelope 的 discussionBody 落 R1，创建唯一副审 discussion
  invocation；副审 envelope body 落 R2 后创建 final invocation。两工件强校验 taskId/cycle/
  threadId/round/replyTo；普通 send_mail 旁路、R3 和第二 thread 拒绝；final 不得再讨论。
- **P2-5**：lease heartbeat、过期回收、每 generation 3 次 dead-letter、显式同 ID requeue、
  重复输出 hash 冲突 quarantine；writerEpoch 变化后旧 host 延迟输出拒绝。
- **P2-6**：每 cycle 生成 immutable source-snapshot；read/search 做清单、realpath、符号链接
  逃逸校验；probe 仅执行预登记命令并在一次性副本/TMPDIR 中运行，输出命令/exit/hash/窗口；
  reviewer 无这些能力时 fail closed，不得声称亲手复证。

计划测试：`review-invocation.test.mjs`、`review-orchestrator.test.mjs`、
`review-capability.test.mjs`、`review-discussion-bridge.test.mjs`、`review-recovery.test.mjs`、
`review-evidence.test.mjs`。

### P3 普通入口兜底

- **P3-1**：误投在任何 `runNativeAgentTurn` 前拒绝；不写 outbox/mail-response。
- **P3-2**：分别断言正常生产路径成功和普通 inbox 误投失败；两者不得混为一个 E2E。

计划测试：`review-ingress-guard.test.mjs`；既有 `reply-route`/`discuss-mail` 保持绿色。

### P4 路由与 relay

- **P4-1**：直接由 P0.3 表生成/维护常量；未列组合拒绝。
- **P4-2/P4-3**：每 recipient 独立 prepare/commit/hash；不同 hash quarantine。
- **P4-4**：允许中间部分提交但整体不 completed；重启 reconcile 收敛。
- **P4-5**：双齐前零泄露；主审初审永不投副审；讨论不绕上限。
- **P4-6**：双复检互盲，最终件只到副审和 user-facing，不到 lead agent。
- **P4-7**：非法请求在首个目标写前拒绝，审计事件不含敏感正文。

计划测试：`review-route-schema.test.mjs`、`review-relay.test.mjs`、
`review-relay-reconcile.test.mjs`、`review-main-flow.test.mjs`、`review-recheck-flow.test.mjs`。

### P5 user-facing

- **P5-1/P5-2**：只显示 completed route；正文与源 hash/byteLength 一致；拒绝 `..`、编码穿越、
  task/artifact 不匹配和任意绝对路径。
- **P5-3**：通知键集严格为七字段，不含正文/摘要/磁盘路径。
- **P5-4**：明确“CSRF 不是身份”；无法取得 authenticated user principal 时 POST 禁用。
- **P5-5**：decision revision 幂等；用户范围与对应 final artifact 绑定。
- **P5-6**：机器 capability、lead、reviewer、engineering 写决策全部 403/等价拒绝。
- **P5-7**：只有带 authorizedFindingIds/scope/acceptanceCriteria 的 authenticated-user
  decision 可生成 job；job 只投指定 engineeringBotId；fix-report 的 findingIds 与坐标必须在
  授权范围内，否则拒绝。
- **P5-8**：claim capability 绑定 job/实例/nonce；job 使用独立 lease/heartbeat/attempt，过期
  由 host 回收，三次失败终止；旧 job 不得复活，重新派发必须有新 decision revision/repairCycle。

计划测试：`review-results-api.test.mjs`、`review-notify.test.mjs`、
`review-user-principal.test.mjs`、`review-decision.test.mjs`、`review-engineering-job.test.mjs`、
`review-job-recovery.test.mjs`。

### P6 编码方和权限

- **P6-1**：`sessionWorkspace/workspaceRoot/registry.workspace` 三字段不互相隐式回退；只改
  schema/脚手架，不写真实注册表。
- **P6-2**：每条路径标实际 enforcement 或待验证，提示规则不得冒充机械拒绝。
- **P6-3**：仅 shadow 目标；输出 `{botId,pid,workspaceRoot,action,result,reason,observedAt}`；
  result 为 DENIED/ALLOWED/INCONCLUSIVE。
- **P6-4**：需用户另行授权，由 host/operator 写四源并启动真实实例；任一源失败则不启动、
  回滚本次新条目，不触碰其他 bot。
- **P6-5**：真实验证只使用非破坏性 sentinel，执行前后 hash 相同；异常立即清理并保持 BLOCKED。
  **规格修订（2026-08-29，双席归一五项裁定 + 用户授权，方案 A）**：非破坏性判定标准改为
  ①探针所致差异 = 0（real-sentinel 十重守卫链（第六轮返修补入第五重＝保护根 canonical＋lexical
  双口径任一重叠即拒（DSH_HOME symlink 别名不可绕过）＋--out 证据输出边界（不得位于
  sentinel 根内或真实运行面，先于一切写入校验））：第六重＝子路径 symlink 全树 lstat 预检＋快照
  遇非常规条目 fail-closed（第三轮返修补入）；第七重＝布局空前置（五个 synthetic 布局目录不
  存在或为空——既有文件「覆盖从未发生」而非事后报告，第四轮返修补入）；第八重＝排他创建契约
  （逐级 lstat 祖先校验＋wx 排他创建＋失败回滚＋创建后全树重走，第四轮返修补入；执行面＝
  runShadowProbeCells 纯 probe 零覆盖写——旧 runShadowProbeSuite 内部覆盖型 prepare 会重写
  守卫创建的布局文件（同内容亦构成二次覆盖，treeDiff 不可见），第五轮返修补入；布局完整性以
  bigint ino/mtimeNs 前后复核，同内容二次覆盖亦可检）。写面以空前
  置＋排他创建约束于副本内；残余窗口＝单次同步写入期间的祖先换链，Node 用户态无 openat2/
  RESOLVE_BENEATH 不可绝对消除，发生后由创建后重走/运行后快照 fail-closed 检出——不作绝对
  机械保证宣称）②运行时自身漂移须穷举白名单逐项归因（本轮白名单：bots/review/epoch.json——运行中
  host 持锁必刷锁纪元，机制为既审代码）③白名单外差异 fail closed。不停机条件下原「执行前后
  hash 相同」不可满足（锁纪元必然刷新），故按方案 A 执行；绝对静态基线另择停机窗口（方案 B）。
  第七轮补强：`--out` 证据输出路径逐组件 `lstat`，任何已存在 symlink（含 dangling 最终组件、父目录）或不可读/非目录祖先均在一切布局写入前拒绝；最终组件必须不存在并以 `wx` 排他写入，拒绝普通文件/目录/hardlink 覆盖；输出路径用户态检查与写入之间的 TOCTOU 仍明确列为残余风险，不作绝对保证。
  **证据重跑操作注意（第七轮 --out 排他合同）**：重生成 artifacts/p6-5-probe-raw.json
  前须先删除旧文件（或指定全新不存在路径）——最终组件必须不存在并 wx 排他落盘，
  该语义属安全合同，不得回退为覆盖写（副审第七轮确认）。

计划测试：`review-workspace.test.mjs`、`review-enforcement-matrix.test.mjs`；探针脚本另列。

### P7 报告和规程

- **P7-1**：十字段 required/type/enum + `additionalProperties=false`；额外结论键全部拒绝。
- **P7-2**：只有六条件全真才轻量，否则增强；编码方不能自判。
- **P7-3**：生成不含预写 ID 的新规程 body、存活条款逐项核对表、活动指针 patch 模板和
  历史引用分类；只预备迁移包，不调用 registerReport、不改运行时指针。
- **P7-4**：用注入的假 ID 在隔离副本 dry-run；实际工具 schema/prompt/两个行为测试必须
  一致，历史旧 ID 保留；覆盖任一步失败进入 migration-pending 和恢复；不登记、不部署。
- **P7-5**：只有 P9-5 已独立通过且用户明确上线授权后执行：暂停 review invocation →
  registerReport 获取真实 ID → 只把已双席审过的唯一占位符替换为真实 ID → 原子应用活动
  指针 patch → 测试/部署平价 → 仅在 authorization scope 包含 restart 时重启必要进程并记新 PID → 恢复；除占位符外任何语义 diff 都立即终止并退回完整双席复审。
  任一步失败保持 migration-pending 和暂停。登记成功不能回滚 ID，只能恢复剩余指针/部署步骤。

计划测试：`review-report.test.mjs`、`review-level.test.mjs`、`review-procedure-migration.test.mjs`、
既有 `review-prompt.test.mjs` 和 `discuss-mail.test.mjs`。

### P8 编码方证据包

- **P8-1**：逐模块语法/单测，不伪造未执行命令；
- **P8-2**：`TMPDIR=/dev/shm node tests/run.mjs`，并发/崩溃/E2E/权限结果单列；
- **P8-3**：固定输出修改坐标、命令、退出码、单位、起止窗口、未完成项、残留风险、是否需
  部署/重启；结论只能是“提交独立验收”，不能是 PASS/READY。

### P9 独立验收与放行

- **P9-1/P9-2**：双席各自预登记判据、独立读当前盘面、独立复跑，不先读对方结论；
- **P9-3**：发现级差异仅走 mail-discuss R1/R2；主审终审固定格式；
- **P9-4**：上线前独立复跑既有 mail-response、mail-discuss R1/R2、普通任务邮件和全量
  源码测试；此时尚未部署，不虚构部署平价；真实部署平价只在 P9-7；
- **P9-5**：上线前专项检查 user principal、权限探针、规程迁移 dry-run、存活条款和植入
  保密纪律；只判迁移包可执行，不冒充实际登记/部署成功；
- **P9-6**：只接受双席终审和用户明确上线授权；首次 rollout 时尚未部署新 P5 API，授权来源
  必须是当前 host 已有的受信用户交互或用户本轮明确指令，由机械门记录 principal/原文 hash/
  时间，不得循环依赖未部署接口；输出只允许带 authorizationId、有效期和明确 scope 的
  `P7-5 authorized`；scope 必须逐项列出
  `register procedure / apply active-pointer patch / deploy copies / restart required processes`，未列动作
  不得执行，门态仍 `BLOCKED / rollout-pending`；
- **P9-7**：P7-5 后双席分别读取真实知识库新 ID/旧条目状态、活动工具 schema、实际 prompt、
  测试退出码、源码↔部署 sha256/byteLength 和进程观测窗口；二者均通过才可由机械门控标
  READY，否则保持 migration-pending/BLOCKED。

硬标准 11（双席可独立复跑）属于验收过程属性：实现侧只提供可复跑命令和材料，真实结果
分别由 P9-1/P9-2 产生，不再把同一切片同时写作实现侧和验收侧。

## 六、依赖主链

```text
P1 → P2（含 source-snapshot/evidence）→ P3
P1/P2/P3 → P4 → P5
P6-1 → P7-1 → P5-7 → P5-8 → P4-6；P6-1..P6-3 → P6-4 → P6-5
P2～P6 对应实现 → P7-3（迁移包）→ P7-4（隔离 dry-run）
P4/P5/P6/P7-1..P7-4 → P8
P8-3 → P9-1 与 P9-2（并行独立）→ P9-3/P9-4/P9-5
P9-5 → P9-6（用户只授权 rollout）→ P7-5（真实登记/部署）→ P9-7（最终门态）
```

P5 与 P4 不得形成循环：先由 P5-1 提供目标存储原语，再由 P4 route 调用；P5 API 只展示
P4 已 reconcile completed 的结果。

## 七、确定性验证口径

```text
语法：node --check <changed-runtime-file>
单测：TMPDIR=/dev/shm node tests/<name>.test.mjs
全量：TMPDIR=/dev/shm node tests/run.mjs（汇总器不计分母）
字节：Buffer.byteLength(utf8) / sha256 64 位小写 hex
时间：ISO-8601 UTC；证据同时列起止时间与窗口语义
部署：仅获授权后 cmp -s 项目与部署目标；不把源码 PASS 当部署 PASS
真实进程：记录 botId/PID/startedAt/sessionId/hostInstanceId
```

## 八、风险与条件门禁

1. 宿主是否提供可绑定浏览器用户会话的 authenticated principal 尚需 P5-4 验证；不可用则
   decision POST 保持禁用，不能以 CSRF 代替身份。
2. DSH sandbox 对各拒绝路径的真实能力待 P6-3/P6-5；未验证项不得写成已机械拒绝。
3. 编码方实例尚未创建；P6-4 创建和 P6-5 真实验证都需用户另行授权。
4. 新规程 ID 未生成；P7-3/P7-4 只可在获实现授权后预备/dry-run，不能登记或部署；真实
   P7-5 必须等待 P9-6 的用户 rollout 授权，且登记/部署/重启逐项受 authorization scope 限制。
5. 普通 `messages.jsonl` 的 `nextSeq=max+1` 跨进程竞态继续作为独立观察项；新 review
   管道不复用它，不代表旧缺陷已销账。
6. reviewer 模型/推理等级由用户控制，记录执行时事实，不自动改配，也不作为规划阻塞。
7. 本文 v3 尚待正式双席复审；用户已授权并执行 P1～P8 实现，经独立评审被 F-P9-01～09
   驳回（见第十节）；返修切片在用户授权前继续冻结。

## 九、交付与门态

本轮只允许把本文及 `PROJECT_UNDERSTANDING.md`、`CHANGELOG.md` 的规划口径提交双席复审。
双席一致之前：

```text
不得启动 P1～P9 中任何切片
不得创建编码方实例
不得登记/迁移新规程
不得修改配置或部署副本
不得启动/重启 bot/host
```

即使 v3 通过切片复审，也只表示“可由用户选择是否授权实现”，不自动产生实现授权。

> 历史演进注记：本节为实现授权前的冻结表述。用户「授权启动」仅覆盖 P1～P8 编码/自测；
> 独立评审 F-P9-01～09 驳回“P1～P8 完成”声明后，当前门态与返修要求见第十节。

## 十、F-P9 独立评审结论与返修计划（R-2）

### 10.1 撤回声明（编码方按要求撤回）

```text
P3 误投 guard 及若干离线核心模块/测试已形成；
P1/P2/P4/P5/P6 仍存在协议级阻塞项；
P8 证据包已提交但未通过独立验收。
```

编码方撤回先前“P1～P8 实现完成”表述。独立评审已核实：证据包 31 个 byteLength/sha256
账实一致、33/33 测试与 5/5 并发独立复跑通过、17 个 lib 语法检查 0 失败、真实状态文件
mtime 未变——但上述事实只证明“当前测试覆盖的实现行为全绿”，不能证明实现符合冻结的
v3 协议。证据包判定：**账实一致：是；足以证明 P1～P8 完成：否。**

### 10.2 F-P9 发现总表（独立评审，均已复核确认）

| 编号 | 级别 | 结论 | 涉及切片/模块 |
|---|---|---|---|
| F-P9-01 | CRITICAL | 新管道未接入 host 生产入口（仅 P3 guard；无 invocation/RPC/GET/POST/job API/通知接线） | P2-2、P5-2～P5-8、lib/index.js |
| F-P9-02 | CRITICAL | stage 表 9 项 ≠ 冻结 13 行表；required recipients 可被调用方缩小；无 stage 专用 envelope schema | P4-1/P4-5/P4-6/P4-7、lib/review-protocol.js、lib/review-flow.js、lib/review-discussion.js |
| F-P9-03 | CRITICAL | snapshot 非物化、同 cycle 可覆写；probe 不绑定 snapshot、cwd 校验恒真、可越界写 | P2-6、lib/review-evidence.js |
| F-P9-04 | CRITICAL | capability 可由调用方伪造（无签名/nonce/PID/startedAt/host 活态绑定） | P2-3、lib/review-capability.js |
| F-P9-05 | CRITICAL | lease 过期后旧 RPC 输出仍 completed（双 completed 无 quarantine）；输出未落 artifact | P2-1/P2-2/P2-5、lib/review-orchestrator.js |
| F-P9-06 | CRITICAL | 损坏事件读侧静默跳过；一事件一文件/quarantine 不移动/epoch 字段未落实 | P1-1～P1-4、lib/review-store.js |
| F-P9-07 | CRITICAL | user-decision 可直接绕过授权直写；engineering-job 无 decision 校验即可创建 | P5-4～P5-8、lib/review-results.js、lib/review-jobs.js |
| F-P9-08 | HIGH | relay 无 prepared 状态、目标无正文副本、committed 后不复核、原地覆写、无锁/epoch | P4-2～P4-4、lib/review-relay.js |
| F-P9-09 | HIGH | P6-1/P5 UI-API 坐标未落地（client.js/shared.cjs/scripts probe 未接线） | P5-2/P5-3、P6-1/P6-3 |

### 10.3 返修切片 R2-01～R2-12（每片约 200k 上下文，按用户切片约定标注）

统一规则（沿用第五节交付契约）：

```text
输入协议 / 输出协议 / 唯一责任方（编码方）/ 前置依赖 / 禁止越权 /
确定性测试命令 / 坐标与观测窗口 / 失败与恢复语义
```

| 切片 | 处置项 | 输入 → 输出 | 计划坐标；确定性命令 | 反例回归（必含） |
|---|---|---|---|---|
| R2-01 | 1/2/3 | 冻结 13 行 stage 表 + envelope schema → 逐字常量表 + `lib/review-envelopes.js`（additionalProperties=false），required recipients 由 host 固定计算、子集 → 拒绝；主流程/复检流程（`lib/review-flow.js`）与讨论桥（`lib/review-discussion.js`）按新表重写（delta-lead 携 nextAction/R1、discussion-second 唯一 R2、final-lead/recheck-final-lead 输出、复检双席互盲） | `lib/review-protocol.js`、`lib/review-envelopes.js`、`lib/review-flow.js`、`lib/review-discussion.js`；`TMPDIR=/dev/shm node tests/review-route-schema.test.mjs && node tests/review-main-flow.test.mjs && node tests/review-discussion-bridge.test.mjs` | F-P9-02（final 缩为 `[reviewer-second]` 拒绝；13 行 stage 全枚举逐字比对；main-flow 按新表全流程断言） |
| R2-02 | 4/5 | cycleId+源码根+任务验收命令表 → 只读物化 `tree/` 不可覆写 snapshot（总 manifest hash）+ probe 绑定 snapshot/登记命令/一次性快照副本内运行、绝对路径写出拒绝 | `lib/review-evidence.js`；`TMPDIR=/dev/shm node tests/review-evidence.test.mjs` | F-P9-03（无 snapshot 拒绝、同 cycle 覆写拒绝、越界写拒绝、tree 物化断言） |
| R2-03 | 6 | host secret → HMAC 签名 capability（botId+pid+startedAt+operation+jobId+issuedAt+expiresAt+nonce+hhostInstanceId），校验注册表 PID/startedAt、nonce 单次消费、重启轮换；删除“调用方直传对象”旁路 | `lib/review-capability.js`；`TMPDIR=/dev/shm node tests/review-capability.test.mjs` | F-P9-04（伪造对象/伪造签名/重放 nonce 拒绝） |
| R2-04 | 7/8 | claim epoch/lease generation → 最终提交 fencing（被接管/过期 → stale 拒绝）；输出持久化为唯一 output artifact（outputArtifactId 绑定事件），不同 hash → quarantine | `lib/review-orchestrator.js`；`TMPDIR=/dev/shm node tests/review-invocation.test.mjs && node tests/review-concurrency.test.mjs` | F-P9-05（双 host 慢 runner：stale 拒绝、单 completed、无第二 hash） |
| R2-05 | 9/10 | corrupt 行 → 所有读路径整体 fail closed（绝不只折叠 parsed）；一事件一文件；quarantine 追加引用不移动源件；lock 含 hostInstanceId/pid/startedAt/writerEpoch；epoch 写入 reservation/event/claim | `lib/review-store.js`；`TMPDIR=/dev/shm node tests/review-store.test.mjs && node tests/review-idem-crash.test.mjs` | F-P9-06（损坏尾行 → 读侧 failed → quarantine；源件不被移动；lock 字段断言） |
| R2-06 | 11 | 不可绕过的 decision 授权链：authenticator 注入强制、无 principal → 拒写；校验 task/artifact 为 committed user-facing final/recheck-final；revision 顺序递增且同 revision 一致；author 参数移除（恒 user） | `lib/review-results.js` + host review POST 适配；`TMPDIR=/dev/shm node tests/review-results-api.test.mjs` | F-P9-07（未认证直写/author 注入/未发布 artifact/乱序 revision 拒绝；principal 不可用 → POST 禁用 403） |
| R2-07 | 12 | job 创建机械读取 decisions 存储并验证 decisionRevision/findingIds/scope/acceptanceCriteria 一致；claimJob HMAC+nonce；reportFix 按 job.scope 判定；fix-reported 终态不可再 claim；heartbeat/三次失败/dead-letter/requeue generation 闭环 | `lib/review-jobs.js`；`TMPDIR=/dev/shm node tests/review-engineering-job.test.mjs` | F-P9-07（无 decision 创建拒绝、伪造 capability claim 拒绝、越 scope 报告拒绝、fix-reported 后 re-claim 拒绝） |
| R2-08 | 13 | relay prepare/commit/reconcile：ROUTE_STATUS 增 prepared；目标正文副本（非绝对路径引用）；committed 后 reconcile 复核目标存在+hash；状态纳入 host 单写锁/epoch；resetFailedRoute 保留失败历史 | `lib/review-relay.js`；`TMPDIR=/dev/shm node tests/review-relay.test.mjs` | F-P9-08（prepared 存在、副本断言、目标破坏 → reconcile 检出、reset 不删史） |
| R2-09 | 14 | host 生产接线（orchestrator/RPC 入口）：createInvocation/runInvocation 接入；每 invocation 全新一次性 reviewer RPC session；sourceSnapshotId 绑定强制；envelope 校验 + 输出落 artifact（R2-01/R2-04 复用） | `lib/index.js` + 注入式 host 接线测试 `tests/review-host-wiring.test.mjs` | F-P9-01（host 调用链 E2E：claim→session→prompt→artifact→relay） |
| R2-10 | 14 | review GET（metadata/body，isSafeLogicalId+hash fail-closed 500）；user-decision POST（principal+CSRF）；`lib/client.js` 前端 API 面；七字段通知 | `lib/index.js`、`lib/client.js`；`TMPDIR=/dev/shm node tests/run.mjs` | F-P9-01/F-P9-09（GET/POST 路径矩阵、通知七字段） |
| R2-11 | 14 | job API 受信宿主调用链（R2-07 改后接线）；`lib/shared.cjs`+registry 三路径 schema 接线；`scripts/review-enforcement-probe.cjs`（shadow 三态 + `--real-sentinel` 守卫，仅代码层面，不创建实例） | `lib/index.js`、`lib/shared.cjs`、`scripts/review-enforcement-probe.cjs`；`node scripts/review-enforcement-probe.cjs --shadow` | F-P9-09（三路径一致校验、probe 三态） |
| R2-12 | 15 | F-P9-01..09 全部反例入回归；坐标偏离先修订第五节矩阵再过复核；全量复跑；重新生成**无结论** P8 证据包（账实一致）；CHANGELOG/本计划同步 | 全量 `TMPDIR=/dev/shm node tests/run.mjs`；`artifacts/review-evidence-package.json`（结论固定“提交独立验收”） | 全部 F-P9 反例在列 |

### 10.4 授权边界与约束（返修期间不可逾越）

```text
覆盖范围：仅 P1～P8 范围内的协议级修正（R2-01～R2-12），等价于重做被驳回切片。
挂门不动：P6-4（真实实例四源注册）、P6-5（真实 sentinel）、P7-5（登记/部署/重启）、
          P9（双席独立复审）仍需用户另行授权。
禁止动作：不部署、不改配置、不重启 bot/host、不写 bots.json/profiles/部署副本；
          测试仅在项目副本与 /dev/shm 夹具中运行。
纪律：每个 R2 切片完成后先过坐标复核（与第五节矩阵一致）再进入下一切片；
      R2-12 证据包结论固定为「提交独立验收」，编码方不得自判 PASS/READY；
      返修完成后重新提交双席独立复审，不得由编码方自行收口门态。
```

### 10.5 R-2 执行记录（追加式，时间正序）

```text
2026-08-28 用户授权：全部 R2-01～R2-12（仅 P1～P8 范围；P6-4/P6-5/P7-5/P9 继续挂门）。
2026-08-28 批 1（并行）：R2-05 存储 / R2-01 协议与流程 / R2-02 证据 / R2-03 capability。
2026-08-28 批 2（并行，批 1 后）：R2-08 relay / R2-04 orchestrator / R2-06 decision。
2026-08-28 批 3：R2-07 job 授权链（依赖 R2-06 决策记录形态）。
2026-08-28 主机接线（编码方本人顺序执行）：R2-09 orchestrator/RPC 入口 →
           R2-10 review GET/POST/通知/client.js → R2-11 job API/shared.cjs 三路径/probe 脚本。
2026-08-28 收口：R2-12 全量回归 + 反例齐备 + 无结论证据包重出 → 重新提交双席独立复审。

2026-08-28（实际执行记录，追加）：
- 批 1 全部落定：R2-01 协议层（13 行 stage 逐字/envelope/主链/讨论桥）、R2-02 证据层
  （物化 tree/同 cycle 不可覆写/probe 绑定+登记命令+bwrap 隔离）、R2-03 capability
  （HMAC 签名/注册表三绑定/nonce 单次消费）、R2-05 存储（一事件一文件/quarantine 引用
  不移动/身份接管）——测试全绿。
- 批 2 落定：R2-08 relay（prepared 状态/目标正文副本/committed 复核/受锁事件折叠——
  编码方修复 per-recipient seq 缺号：事件目录按收件人拆分）、R2-04 orchestrator
  （claimEpoch/generation fencing/唯一 outputArtifactId/异 hash quarantine）、R2-06
  decision 授权链、R2-07 job 授权链——测试全绿。
- 主机接线（编码方本人）：R2-09 评审主机泵（一次性 reviewer session 不留状态文件、
  同 tick 闭环输出落工件/envelope 校验/流程推进）、R2-10 review GET/POST（principal
  无 → 恒 403）+ SSE review 七字段广播 + lib/client.js 通知面、R2-11 job 受信链
  （createJobFromDecision/engineering 工具）+ 三路径启动校验（坐标说明：三路径接线落在
  lib/index.js + lib/review-enforcement.js，shared.cjs 保持 CJS 助手层不变——按
  第五节 549-551 纪律记录此坐标调整）。
- 证据包重出：artifacts/review-evidence-package.json（结论固定「提交独立验收」；
  34/34 回归、并发 5/5、15 修改文件 + 17 测试模块 byteLength/sha256 账实一致、
  SHA-256=051c7cbb42bd3f11209eff30642194c50758c0ba5b4ba1feeafc9daa55a5e83d）。
- 门态：等待双席独立复审（P9）；P6-4/P6-5/P7-5 继续挂门；未部署、未重启、未登记。
```

### 10.6 R-3 返修要求（两席统一返回 2026-08-28；未授权）

两席已完成 R-2 独立复审的事实、定级、依赖与验收标准归一。固定口径：

```text
两席一致 = 对 R-2 缺陷、严重度、依赖关系和验收标准达成一致
不等于 R-3 已获授权；不等于允许修改代码、实例、配置、登记、部署或重启
门态：R-2 独立验收不通过；P9 不可放行；P6-4/P6-5/P7-5 继续挂门；NOT READY / BLOCKED
```

#### 10.6.1 固定编号（不得重编号）

```text
必须优先修复：F-RV-1（review invocation lease/heartbeat/并发守卫）
              F-RV-2（job heartbeat capability 与验证闭环）
              F-RV-3（fix-report 生产提交通道）
              F-RV-13（invocation admission 与 snapshot 全链绑定）
              F-RV-15（final/user-facing committed gate）
              F-RV-17（capability 与生产实例注册表字段统一）
应随批修复：F-RV-4（flow 损坏 fail-closed）
            F-RV-5（job lease 损坏 fail-closed）
            F-RV-6（requeue authenticated 默认拒绝并使用 host principal）
            F-RV-14（fix-report 十字段 schema 接入生产链）
            F-RV-16（规划文档状态镜像修正）
继续登记但不得遗漏：F-RV-7～F-RV-12
  （F-RV-11 副审 evidence capability 不对称属功能缺陷，不能仅以 nonce 清理覆盖）
已归因环境项：W-RV-1（接受用户授权归因；台账补录完成 → CHANGELOG 台账条目）
```

依赖关系（固定）：

```text
F-RV-17 → F-RV-2
F-RV-3  → F-RV-14
F-RV-13 → 主链/讨论链/终审链/复检链
F-RV-15 → user-decision
```

#### 10.6.2 固定验收顺序（编码方按序提交）

```text
1. F-RV-17 实例身份 schema 与 capability 语义冻结
2. F-RV-2  job heartbeat capability 闭环
3. F-RV-1  review invocation heartbeat 与 watcher 并发守卫
4. F-RV-13 invocation admission 和 snapshot 全链传播
5. F-RV-3  fix-report 生产提交通道
6. F-RV-14 fix-report schema 生产校验
7. F-RV-15 final/user-facing committed gate
8. F-RV-4～6 fail-closed 与认证默认拒绝
9. F-RV-7～12 登记项处置
10. F-RV-16 文档和证据包同步
11. 双方交叉复核（用户决定启动）
12. P9 正式双席复审（用户另行决定）
```

#### 10.6.3 R-3 切片表（R3-01～R3-10，每片约 200k 上下文）

| 切片 | F-RV | 输入 → 输出 | 计划坐标；确定性命令 | 反例/负向测试（必含） |
|---|---|---|---|---|
| R3-01 | 17 | 冻结唯一实例身份语义 → 生产实例行统一 {botId,pid,startedAt,hostInstanceId,at}；startedAt/hostInstanceId 生成者与语义冻结；签发与校验使用同一身份源；重启轮换、旧 capability 失效；最新行损坏/字段缺失/身份不一致 → fail closed 无回退；旧格式 55 行不隐式兼容、不猜测转换 | `lib/review-capability.js`（instancesFile/issueCapability/checkCapability）、`lib/index.js` 实例登记点；`TMPDIR=/dev/shm node tests/review-capability.test.mjs` | 迁移四例：旧行→签发/校验拒绝；新格式当前行→可签发可校验；最新行损坏→fail closed 不回退；实例重启/轮换→旧 capability 失效（不得写真实 instances.jsonl，不重启） |
| R3-02 | 2（依赖 17） | job.heartbeat 加入 CAPABILITY_OPERATIONS → heartbeat 工具 held() 失败即 rejected（无 hostInstanceId fallback）；heartbeatJob 全链自校验 HMAC/op/botId/jobId/hostInstanceId/活态/expiry/nonce 单次；禁止仅按 lease 内 hostInstanceId/claimOwner 比对续租 | `lib/review-capability.js`、`lib/review-jobs.js:372`、`lib/index.js:3544`；`TMPDIR=/dev/shm node tests/review-engineering-job.test.mjs` | 无 capability→拒；op 不匹配→拒；jobId 不匹配→拒；过期→拒；重复 nonce→拒；实例轮换后旧 cap→拒；合法新 cap→成功续租 |
| R3-03 | 1 | runner 执行期周期调用 heartbeatInvocation（周期 < leaseMs 并留调度/I/O 余量，须证明真实 runner 上限与 lease 关系，不得只改大常量）；heartbeat 失败 → 中止、不提交输出；watcher 防同一 invocation 多 tick 重叠；stale runner 由 claim epoch/generation fencing 拒绝（已具备，补显式守卫与测试）；过期/重试/dead-letter 确定性 | `lib/index.js` pump/buildReviewRunner、`lib/review-orchestrator.js:439`（heartbeatInvocation）/runInvocation；新增 heartbeat 专项测试模块 | lease<runner 时 heartbeat 可维持 claim；heartbeat 失败→输出不错误完成；同一 invocation 不被重叠 runner 执行；旧 runner 返回不产生第二 completed/第二 artifact；超时后重试次数与 dead-letter 状态正确 |
| R3-04 | 13 | createInvocation 成为可信创建边界 → 机械拒绝非法 stage/targetReviewer/stage-author-target 不匹配/非法 transition/空 sourceSnapshotId/不存在或损坏 snapshot；13-stage 冻结表与固定作者/recipient 复用 R2-01；同一 sourceSnapshotId 沿 initial→delta→discussion R1/R2→final→fix-report→recheck 四段 10 环节全链传递 | `lib/review-orchestrator.js`（createInvocation）、`lib/review-flow.js`、`lib/review-discussion.js`、`lib/review-evidence.js`；`TMPDIR=/dev/shm node tests/review-invocation.test.mjs && node tests/review-main-flow.test.mjs` | stage=not-a-stage→拒；targetReviewer=attacker→拒；sourceSnapshotId=null→拒；不存在 snapshot→拒；初审带 snapshot、自动 delta→保留同一 snapshot；discussion/final/recheck→不丢 snapshot |
| R3-05 | 3（依赖 13） | fix-report 生产提交通道（方向：decision→createJob 时同步创建 job-bound fix-report invocation + capability 保护提交工具）；绑定 jobId/taskId/engineeringBotId/capability/stage/authorBotId/findingIds/changedPaths/sourceSnapshotId；仅授权 bot/仅本 job/禁伪 reviewer/禁绕过 manifest-body 完整性；提交后 host 触发 reportFix→recheck invocation | `lib/review-jobs.js`、`lib/review-orchestrator.js`、`lib/index.js`（createJobFromDecision + fix-report 泵分支）；生产链测试入 wiring 模块 | 生产链七段：decision→job creation→job claim→heartbeat→fix-report submit→reportFix→recheck invocation（不得只测底层 submitReviewArtifact 直调） |
| R3-06 | 14（依赖 5） | 十字段 schema 接入生产接受路径：读正文→严格 JSON→validateFixReport→additionalProperties=false→十必填字段→拒任意额外结论字段→findingIds/changedPaths 逐项绑 job scope→task/author/stage/snapshot 绑 job/manifest | `lib/review-enforcement.js`、`lib/review-jobs.js`（reportFix）、`lib/index.js` 接受路径 | 普通字符串正文→拒；缺字段→拒；额外字段→拒；finding 越权→拒；changed file 越权→拒；合法十字段报告→接受 |
| R3-07 | 15 | final/recheck-final route committed 不可绕过发布门：handleCompletedInvocation 中 registerFinal().ok===false → 禁 publishResult/禁完成通知/禁 final-registered 步骤；writeUserDecision 复核 user-facing route committed；result index/route status/decision 前置绑定；user-facing copy 失败/隔离/未完成 → decision 拒绝 | `lib/index.js:3100-3180`、`lib/review-results.js`（writeUserDecision）、`lib/review-relay.js`（routeStatus） | user-facing copy 失败 → final 不发布 completed → 无完成通知 → user decision 被拒 |
| R3-08 | 4/5/6 | flow 损坏→明确错误/quarantine（禁 null 重建/覆盖/继续登记新 artifact；现 readFlow ?? emptyFlow 五处回退需改）；job lease 损坏→fail closed（禁解释为无 lease/继续 claim/覆盖，明确恢复/隔离路径）；requeueInvocation 默认 authenticated=false + host 注入 principal（禁信任调用方布尔） | `lib/review-flow.js`、`lib/review-jobs.js`、`lib/review-orchestrator.js:633` | 损坏 flow→quarantine/错误，不重建不覆盖不登记；损坏 job lease→拒绝 claim 有恢复路径；未认证 requeue→默认拒绝 |
| R3-09 | 7~12 | 7 dead-letter 非法分支修正/删除；8 tmp/prepared 失败重试/隔离语义明确；9 appendAudit 并发丢行（锁内/单写者论证或修复）；10 route intent/pending 崩溃恢复（reconcile 补 prepared→committed）；11 reviewer-lead/reviewer-second evidence capability 对称（签发侧同 ops）+ nonce 清理规划；12 lease 文件与事件折叠受控边界文档化 | `lib/review-orchestrator.js`、`lib/review-relay.js`、`lib/review-store.js:531`、`lib/index.js` 签发侧；测试可行则入，纯文档项销账登记 | 各登记项逐条处置记录；F-RV-11 必含副审 evidence capability 正例 |
| R3-10 | 16 | 五文档镜像 + 证据包重出：PLAN（本 10.6 与顶部状态）/CHANGELOG/PROJECT_UNDERSTANDING/docs/REWORK-status.md/artifacts 证据包（conclusion=提交独立验收，禁写 PASS/READY/P9 通过）；交付物六项（变更清单/新增测试/生产路径证明/负向测试报告/证据包/真实状态边界声明） | 全量 `TMPDIR=/dev/shm node tests/run.mjs`；`node scripts/generate-evidence-package.mjs` | 边界声明：未创建真实 engineering 实例、未执行 P6-4/P6-5、未登记/部署/重启 P7-5、未修改真实配置 |

#### 10.6.4 W-RV-1（台账补录已完成，见 CHANGELOG 台账条目）

```text
变更主体：用户授权；变更对象：reviewer-lead；变更内容：danger-full-access；
生效位置：部署侧 bots.json / reviewer-lead profile patch / spawn 参数（项目仓库无此变更痕迹）；
授权时间：用户侧操作（2026-08 期间，两席复审归因确认）；
用途：主审 evidence plane 外真实测试/调试；
边界：不扩展至编码方实例；不解除 P6-4/P6-5/P7-5 门禁。
```

#### 10.6.5 边界与纪律（R-3 期间）

```text
覆盖范围：仅两席返回的 F-RV 编号（P1～P8 协议范围）；P6-4/P6-5/P7-5/P9 仍挂门。
禁止动作：不部署、不改配置、不重启 bot/host、不写 bots.json/profiles/部署副本、
          不写真实 instances.jsonl（F-RV-17 迁移测试仅项目副本与 /dev/shm 夹具）；
          真实迁移、实例重启属 P6-4/P7-5 独立授权范围。
纪律：每个 R3 切片按固定顺序完成后先过坐标复核再进入下一项；编码方不自判 PASS/READY；
      证据包结论固定「提交独立验收」；返修完成提交双方交叉复核与 P9（用户决定）。
```

### 10.7 R-3 执行记录（追加式，时间正序）

```text
2026-08-28 用户授权：全部 R-3（R3-01～R3-10，按两席固定验收顺序；
          仅 F-RV 范围；P6-4/P6-5/P7-5/P9 继续挂门；无部署/重启/真实注册/配置改动）。
2026-08-28 顺序执行（依赖固定：F-RV-17→2→1→13→3→14→15→4/5/6→7~12→16）：
- R3-01（F-RV-17）：实例身份五字段冻结 {botId,pid,startedAt,hostInstanceId,at}——
  host 写入管理身份（apply 卫生路径；startedAt=进程启动时刻、hostInstanceId=`host-<pid>`）；
  issueCapability/checkCapability 同一身份源（currentInstanceRow）；旧格式/损坏/缺字段
  fail closed 不回退不猜测；index.js 实例行写入改新格式。迁移四例测试入
  tests/review-capability.test.mjs（F-RV-17 ①~⑤）。
- R3-02（F-RV-2）：job.heartbeat 入 CAPABILITY_OPERATIONS；heartbeatJob 全链自校验
  （HMAC/op/botId/jobId/hostInstanceId/活态/expiry/nonce 单次）；工具 held() 失败即
  rejected、无 hostInstanceId fallback（boundHostInstanceId 去 fallback）；七矩阵测试
  入 tests/review-engineering-job.test.mjs。
- R3-03（F-RV-1）：buildReviewRunner 执行期周期 heartbeatInvocation（REVIEW_HEARTBEAT_MS
  =20s < lease 60s，冻结关系注释于 index.js）；heartbeat 失败立即中止 runner；泵
  in-flight 跨 tick 守卫 + completed 持久 handled 标记（防重复推进/重复发布）；
  六测试入新模块 tests/review-heartbeat.test.mjs。
- R3-04（F-RV-13）：createInvocation 可信创建边界——冻结 13-stage 表/固定作者一致/
  targetReviewer 白名单/严格 flow-state 下一阶段断言（expectedNextStages 纯函数入
  review-protocol.js）/sourceSnapshotId 必填且必须为有效物化快照/flow 损坏 fail closed；
  snapshot 全链传播（flow/thread 锚定，initial→delta→R1/R2→final→recheck 全链同源，
  flow 三处“先持久化再创建”修正）；admission/传播断言入 invocation/main-flow 测试。
- R3-05（F-RV-3）：fix-report 生产提交通道——engineering_job.report 工具改 body 直提
  （宿主链内 submit fix-report 工件 + reportFix + advanceFixFlow 自动触发复检）；
  job 创建绑定 sourceSnapshotId（createJobFromDecision 从 flow 解析，调用方不得自由填参）；
  快照链一致性在 reportFix 复核；生产链七段测试入 wiring（decision→job→claim→
  heartbeat→submit→reportFix→recheck，复检 invocation 快照同源断言）。
- R3-06（F-RV-14）：reportFix 生产接受路径读正文→严格 JSON→validateFixReport（十字段
  additionalProperties=false）→taskId 绑定→正文 finding/changedFiles 与 job.scope 逐项
  绑定→与工具参数集相等；六矩阵测试入 engineering-job。
- R3-07（F-RV-15）：handleCompletedInvocation final/recheck-final 门——
  registerFinal/registerRecheckFinal ok=false → 禁 publishResult、禁完成通知、禁
  final-registered 步骤；writeUserDecision 复核 user-facing route committed（副本失败/
  隔离/未完成拒绝）；复现测试入 wiring（副本失败→不发布→无通知→decision 拒绝）。
- R3-08（F-RV-4/5/6）：readFlow 损坏即抛（不 null 重建不覆盖不登记）；job readLease
  损坏即抛（claim/heartbeat/report/回收各调用点 wrap 为明确拒绝，原文件不动）；
  requeueInvocation 默认 authenticated=false；负例入 main-flow/invocation/jobs 测试。
- R3-09（F-RV-7~12）：7 dead-letter 仅经 retry-wait（claimed 直跳=非法分支，折叠判损坏，
  转移矩阵测试入 invocation）；8 user-facing copy 瞬时失败 → failed 可重试（不隔离），
  reconcile 重投成功（测试入 relay）；9 appendJsonl 改 O_APPEND 原子行级追加+fsync
  （杜绝并发丢行）；10 intent/pending 崩溃恢复由 reconcile 补投（测试入 relay）；
  11 requireEvidenceCapability 去 reviewer-lead 硬编码（botId 按 targetReviewer 传入，
  主副审对称测试入 evidence；nonce 清理为规划项）；12 lease/事件折叠受控边界以模块
  头文档冻结（orchestrator/relay）。
- R3-10（F-RV-16）：本计划（10.6/10.7/顶部/附录 A）、CHANGELOG、PROJECT_UNDERSTANDING、
  docs/REWORK-status.md 五文档镜像 + 证据包重出（结论=提交独立验收）。

验证（编码方自测，TMPDIR=/dev/shm）：
- 全量回归 35/35 测试模块全绿（含新增 tests/review-heartbeat.test.mjs）；
- 并发压力 5/5；18 个 lib 模块 node --check 0 失败；
- 反例回归覆盖：F-RV-17×5、F-RV-2×7、F-RV-1×6、F-RV-13（admission 矩阵+全链传播断言）、
  F-RV-3（生产链七段+快照同源）、F-RV-14×6、F-RV-15（复现链）、F-RV-4、F-RV-5、F-RV-6、
  F-RV-7（转移矩阵）、F-RV-8、F-RV-10、F-RV-11（对称）；
- 证据包 artifacts/review-evidence-package.json（结论=提交独立验收；账实核对，SHA-256 见包内）。

边界声明（如实）：
- 未创建真实 engineering 实例；未执行 P6-4（真实实例四源注册）/P6-5（真实 sentinel）；
- 未登记/部署/重启（P7-5 挂门）；未修改真实配置；不写真实 instances.jsonl；
- 门态不自判——R-3 独立验收待两席（P9-1/P9-2）与用户决定。
```

## 十一、后续方向路线图（2026-09-05 用户确认「确认方案，落档并开始着手修改」）

来源：`docs/GROK-DSH-BOTS-COMPARISON.md`（08-30 时点）差距分析 × 09-05 盘面复核。
对照结论：报告三工作包中 **A（可验证基线）已由 O-6＋C2 批消化**、**B（评审生产
接线）已由 R-2/R-3 闭环（F-RV-1~26 全结）**、**C（普通 Bot 生产边界）余量大半**。
每批逐项点名授权＋落档；验收统一口径＝攻击/重放/并发/崩溃负例入回归套件＋
46/46 基线保持＋部署走 C2 既有流程；任何批触碰 9 文件冻结面（review-enforcement/
probe/evidence-runner/sentinel 系）则新 runId 出 0009。

| 批次 | 内容 | 状态 |
|---|---|---|
| B1 | principal 适配层＋`/api/bots` 变更面 CSRF 令牌＋统一错误码＋client apiText 修复 body 端点解析错配；F-RV-28 升级处置销账 | **2026-09-05 实施完成并部署上线**（47/47、门控生产实测五项全过、principal 解封实证、冻结面 9/9 零触碰；报告 deploy-b1-report-2026-09-05.json） |
| B2 | BotSupervisor：readiness 链（spawn→identity→port→ready，RPC 预留缝）、generation fencing、backoff/crash-loop guard、`enabled=false` 自动停、descendant 清理；以 bot-autostart.js 为种子；F-RV-29 升级处置 | **2026-09-05 实施完成并部署上线**（48/48、SIGKILL 崩溃自愈生产实测 ~5s 重生、有意停止不自愈实证；报告 deploy-b2-report-2026-09-05.json） |
| B3 | mailbox 消费面 at-least-once：不可猜测 messageId＋durable receipt＋幂等回复（写侧锁已由 F-S15 落位） | **2026-09-05 实施完成**（49/49；连带修复 09-04 抽取遗留缺陷 3 枚：会话缓存签名恒常量/readLastMessage 恒 null/PREVIEW_TAIL_BYTES 未随迁）；**已部署（2026-09-08 部署批整批收口，用户逐项点名）**：8 文件同步＋host 拉起＋4/4 bot 自启动跟随＋live smoke 全链通过（真实邮件回合：receipt/游标/session 落盘、自动回信恰一次、防环有界收敛），证据 `artifacts/deploy-b3-sd-report-2026-09-08.json`（规格 `.scratch/deploy-b3-session-driver/spec.md` 已消化） |
| B4 | 环境与文件边界：spawn env allowlist（替换 index.js 两处全量继承）、profile/settings/workspace 0600/0700、PID 绑定 /proc stat startTicks | **全三票已实施（2026-09-07）**：01 spawn env allowlist（lib/spawn-env.js＋两处 spawn 共用＋逃生阀）；02 权限收紧（lib/fs-hygiene.js：tightenPath/tightenBotTree＋scaffold/注册表接线，幂等收回存量）；03 PID 代际绑定（lib/pid-bind.js：三态判定＋spawn 记录/stop 先行分支/成对清理）。53/53×2、冻结面 9/9 零漂移；**已部署（2026-09-08 同 B3 部署批同链收口）**，生产行为实证随批：0600/0700 收紧＋pidStartTicks×4（spec：`.scratch/b4-spawn-env-hygiene/spec.md`） |
| B5 | SSE 可重放：单调 eventId＋Last-Event-ID＋有限窗口 ledger＋cursor/ack | **已实施（2026-09-07，副审独立复核通过）**：createSseHub 单调 eventId（帧前置 `id:` 行）＋`SSE_LEDGER_LIMIT=256` 有界 ledger＋`replayAfter` 窗口判定（lastId=起点−1 边界完整补发；非整数/未来 id/断层→null）；sseEndpoint 读 Last-Event-ID——窗口内先按序补发再订阅接实时，超窗/未知/缺省（首连）发 `reload` 兜底＝统一初始化路径；client.js 最小接线 `reload→refreshBots`。events ＋7 用例 14/14、全量 53/53×2、冻结面 9/9 零触碰；无持久 ack／落盘 ledger 不在本批（留界：首连 open＋reload 双刷新见 PROJECT_UNDERSTANDING 仍可选题）；**已部署（2026-09-08 同 B3 部署批同链收口；规格：`.scratch/b5-sse-replay/spec.md`）** |
| 结构债 | HTTP contract JSON schema（P2-3）、client.js 行数上限政策、index.js 按上限继续抽取、read-only 语义澄清（P2-5）、stats 版本化（P2-4）；storage 抽象统一（P2-2）后置至 B 批稳定 | 穿插低优先；**首件已落（2026-09-07 session-driver 批，架构评审候选 1）**：会话回合协议单一归属（lib/session-driver.js＋双 adapter 化），领域词入 CONTEXT.md；**候选 6 已实施（2026-09-07 受信链机械抽取批）**：lib/review-job-tools.js 610 行＋internals 回填，index.js 3,515 行（上限余量 785）、50/50×3、冻结面 9/9——两件（session-driver＋review-job-tools）随 2026-09-08 部署批同链生效；**候选 4 已实施（2026-09-08 client-fetch 批）**并同链部署；候选 2 工单待启动（`.scratch/arch-*`） |

暂缓维持（报告 §11.3 口径）：provider router、knowledge 全文检索、自动派单、
UI polish——在 B 系批完成前不启动。排序理由（报告一句话总结仍为准绳）：
dsh-bots 评审面已达显式边界级别，普通面未达；B1 居首系其同时为「评审写面
恒不可用＋管理面无认证」双重问题项，亦为 F-RV-28 登记的重评触发点。

## 附录 A：历史切片状态

```text
v1：A-01～A-18，18 切片；因对象/幂等/路由/权限/责任契约缺口否决。
v2：P1～P8，31 切片；因 F-V3-1～F-V3-9 与 watcher/规程迁移缺口否决。
v3：P1～P9，48 切片；本文候选，待双席独立复审。
v3 实现（P1～P8）：用户授权后已实现并自测全绿；2026-08-27 独立评审以 F-P9-01～09 驳回
    “完成”声明，门态 BLOCKED。
v3 返修（R-2，R2-01～R2-12）：用户授权后全部执行完成（2026-08-28）；全量 34/34 全绿、
    无结论证据包已重出；两席独立复审 2026-08-28 统一返回 F-RV-1～F-RV-17 + W-RV-1，
    **R-2 独立验收不通过**，门态 NOT READY / BLOCKED（编码方不自判）；R-3 返修
    （10.6，切片 R3-01～R3-10）未授权；P6-4/P6-5/P7-5/P9 继续挂门。
v3 返修（R-3，R3-01～R3-10）：2026-08-28 用户授权后按两席固定顺序全部执行完成；
    全量 35/35 全绿、并发 5/5、无结论证据包已重出（10.7）；**R-3 独立验收未发生**，
    门态：等待独立验收（编码方不自判）；P6-4/P6-5/P7-5/P9 继续挂门。
```
