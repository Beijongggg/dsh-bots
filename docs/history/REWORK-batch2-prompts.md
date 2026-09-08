# 批 2 预起草规格（批 1 落定后立即照抄发出；代理内部顺序执行，消除模块间竞态）

## B1：R2-08 relay 重做 → R2-04 orchestrator 重做（一个代理，顺序执行）

工作目录 /home/beijong/project/dsh-bots。评审门控项目；权威 = PLAN-expanded-engineering.md
（P0.4 行 193-224、P0.6/P0.7 行 243-302、P0.8 行 304-333、P0.3 行 100-189、第十节 R2-08/R2-04 行）。
你唯一可修改：`lib/review-relay.js`、`lib/review-orchestrator.js`、
`tests/review-relay.test.mjs`、`tests/review-invocation.test.mjs`。
不得运行 tests/run.mjs 全量；不得改其他文件；不得部署/重启/改配置。

### 第一步 R2-08 relay（lib/review-relay.js；tests/review-relay.test.mjs）
1. `ROUTE_STATUS = ["prepared", "committed", "failed", "quarantined"]`（去掉 pending 或保留为内部初态；
   intent 创建即 prepared——按 P0.8 行 309：pending→prepared→committed，prepared 为 recipient 预置态）。
2. 目标正文副本：reviewer 投递必须在 recipient delivery 目录写入**不可变正文副本**
   （`<dshHome>/bots/review/deliveries/<recipient>/<artifactId>/body.md` + meta json 含 sha256/byteLength），
   不得再携带源件绝对 bodyPath 引用（F-P9-08 项 2）。
3. committed 后 reconcile 必须复核目标存在且 hash 仍匹配；不匹配 → recipient 与 route 隔离
   （F-P9-08 项 3、P0.8 行 326-329）。
4. route 状态写入纳入 host 单写锁 + writerEpoch（用 lib/review-store.js 的 acquireStoreLock）：
   状态变更改事件折叠（route 事件文件 `routes/<artifactId>//events/<seq>-<id>.json`）或等价受锁追加，
   不得原地覆写同一 JSON（F-P9-08 项 4/5）。
5. `resetFailedRoute` 改为标记 failed 并保留失败历史（审计），不得删除状态文件（F-P9-08 项 7）。
6. `createRouteIntent`：required = `validateStageCombination` 计算的**固定全集**（显式 recipients 必须
   等于全集或省略；子集/超集拒绝——配合 R2-01 的新协议模块，子集已被协议层拒绝，relay 不得再接受）。
7. 保留导出名与形状：routesDir/routeDirFor/routeFileFor/ROUTE_STATUS/recipientKind/
   createRouteIntent/readRoute/readRoutes/deliverRoute/quarantineRoute/reconcileRoutes/resetFailedRoute。
8. 测试：扩展 review-relay.test.mjs；F-P9-08 反例回归：①prepared 状态存在断言；②目标正文副本断言
   （deliveries/<recipient>/<artifactId>/body.md 存在且 sha256==源 hash）；③committed 后人为破坏目标 →
   reconcile 检出并隔离；④resetFailedRoute 保留历史（不删除）；⑤route 事件 seq 折叠断言。

### 第二步 R2-04 orchestrator（lib/review-orchestrator.js；tests/review-invocation.test.mjs）
1. **fencing 到最终提交**：claim 时记录 claimEpoch（store 的 writerEpoch）+ lease generation（lease.json 含
   generation/claimEpoch/claimOwner/hostInstanceId/pid/startedAt）；runInvocation 在 runner 前后都校验：
   最终提交前必须证明 (a) lease 仍属本 host（同 hostInstanceId+pid，用 store 锁 + assertEpochCurrent，
   epoch 未推进）且 (b) claim 时记录的 writerEpoch == 当前 epoch；被接管/过期（expireStaleLeases 已回收）
   → **stale 输出拒绝**：不写 completed，落审计（F-P9-05 项 1、P0.6 行 249-250：旧 epoch 的延迟 RPC 输出、
   heartbeat、落盘一律拒绝并审计）。heartbeat 同样 fencing。
2. **completed 绑定唯一 outputArtifactId**：runner 返回文本必须持久化为唯一 output artifact
   （`<dshHome>/bots/review/artifacts/<outputArtifactId>/{body.md,manifest.json}`，manifest 与
   review-store 布局一致并经 verifyArtifactIntegrity 可验；authorBotId=host，stage 按 invocation manifest 的
   stage 原样记录）；completed 事件携带 outputArtifactId+outputHash+byteLength；同 invocation 已存在不同
   输出 hash → quarantine（F-P9-05 项 2/3、P0.4 行 223）。
3. 状态机/claim/requeue/dead-letter 语义按 P0.4 行 195-224（字段至少含 outputArtifactId/requeueGeneration）；
   3 次失败 dead-letter，仅 authenticated user 显式 requeue 追加 generation（保留既有失败事件与输入集，
   不创建同 stage 第二逻辑 invocation）。
4. 保留导出名与形状：reviewDir/reviewInboxFor/invocationManifestFile/invocationPartsFile/
   invocationEventsFile/invocationLeaseFile/INVOCATION_EVENT_TYPES/INVOCATION_MANIFEST_KEYS/
   INVOCATION_CREATORS/DEAD_LETTER_MAX_ATTEMPTS/LEASE_DEFAULTS/invocationInputHashes/
   readInvocationManifest/readInvocationParts/foldInvocationEvents/readInvocationState/nextInvocationId/
   createInvocation（含 sourceSnapshotId 字段）/claimInvocation/heartbeatInvocation/runInvocation/
   requeueInvocation/expireStaleLeases。createInvocation 的 {…} 参数形状对调用方（lib/review-flow.js /
   review-discussion.js，并行协议层已按此形状实现）保持不变；新增 sourceSnapshotId 为可选字段。
5. 测试：扩展 review-invocation.test.mjs；F-P9-05 反例回归：双 host 慢 runner 复现——
   HOST-A claim 后慢 runner、lease 过期、HOST-B 回收执行输出 NEW、HOST-A 迟返 OLD →
   OLD 被 fencing 拒绝（无第二 completed 事件、无第二 output artifact、审计留痕）；
   正常路径 completed 事件 outputArtifactId 唯一且正文落盘断言。

确定性命令：
```
node --check lib/review-relay.js && node --check lib/review-orchestrator.js
TMPDIR=/dev/shm node tests/review-relay.test.mjs
TMPDIR=/dev/shm node tests/review-invocation.test.mjs
```
全部通过。报告 JSON：{filesChanged, testsRun:[{cmd,passed,window}], counterexamples, deviations, summary}。

## B2：R2-06 decision 授权链 → R2-07 job 授权链（一个代理，顺序执行）

工作目录 /home/beijong/project/dsh-bots。权威 = PLAN-expanded-engineering.md（P0.9 行 335-355、
P0.3 行 139-160（user-decision 行与 engineering-job 段落）、行 167-172、第十节 R2-06/R2-07 行）。
你唯一可修改：`lib/review-results.js`、`lib/review-jobs.js`、
`tests/review-results-api.test.mjs`、`tests/review-engineering-job.test.mjs`。
不得运行 tests/run.mjs 全量；不得改其他文件；不得部署/重启/改配置。

### 第一步 R2-06 results/decision（lib/review-results.js；tests/review-results-api.test.mjs）
1. `writeUserDecision` **不可绕过**：
   - 签名改为 `writeUserDecision(dshHome, { taskId, artifactId, revision, choice, findingIds, scope,
     acceptanceCriteria, author })`——author 参数仅接受 "user"（传入其他值 → 拒绝，不再有默认值）；
     authenticator 结果作为必传前置：`{ principal: { role: "user" } }` 或 `null`（null → 拒写，fail closed）。
   - 写入前校验：① task 存在（有已发布结果索引条目）；② artifactId 是已 committed 的 user-facing
     final-lead/recheck-final-lead 结果（查 result index 条目且存在正文副本）；③ revision 严格顺序递增
     （同 task 已存在 revision ≥ 本次 → 幂等仅当同内容，否则拒绝）；④ 同 revision 的 artifact/scope 一致。
   - 决策记录字段固定：{taskId, artifactId, revision, choice, findingIds[], scope, acceptanceCriteria,
     author:"user", at, hash}。choice 机械枚举：DECISION_CHOICES = ["authorize-repair","close","rollout"]？
     按冻结语义 choice 至少含「明确授权修复」值；导出 DECISION_CHOICES 常量并只接受枚举值。
2. `publishResult` 的 stage 默认值与校验改为新协议 stage（final-lead/recheck-final-lead 才可 user-facing）；
   result body 副本写入 `<dshHome>/bots/review/results/<taskId>/<artifactId>/body.md`（既有布局），
   元数据条目含 stage/status/sha256/byteLength；index 读取保持 readIndexEntries。
3. 保留导出名与形状：resultsDir/resultIndexFile/resultBodyFile/decisionsDir/decisionsFileFor/
   NOTIFY_KEYS/DECISION_WRITERS/publishResult/readIndexEntries/isSafeLogicalId/getResultByArtifact/
   getResultsByTask/notifyPayloadFor/assertNotifyKeys/assertDecisionWriter/writeUserDecision/readDecisions。
   （lib/review-jobs.js 下一步将用 readDecisions 读 {taskId,artifactId,revision,choice,findingIds,scope,
   acceptanceCriteria,author,at,hash} 形态——你在本步落定该形态。）
4. 测试：扩展 review-results-api.test.mjs；**F-P9-07 反例回归**：①无 principal 直写拒绝；②author 注入
   "reviewer-lead" 拒绝；③artifactId 非已发布结果拒绝；④revision 乱序拒绝；⑤同 revision 内容不同拒绝；
   ⑥合法 user principal 写入成功且 author=user、记录含 findingIds/scope/acceptanceCriteria。

### 第二步 R2-07 jobs（lib/review-jobs.js；tests/review-engineering-job.test.mjs）
1. `createEngineeringJob` **机械读取 decisions 存储**（用 review-results.js 的 readDecisions）：
   - 必须存在 decisionRevision 对应记录且 choice === "authorize-repair"；
   - authorizedFindingIds ⊆ decision.findingIds（超集/越权拒绝）；
   - scope 与 acceptanceCriteria 必须与 decision 记录完全一致；
   - 不满足任一 → 拒绝 + 审计（F-P9-07 项 2）。job 字段：{jobId, taskId, decisionRevision,
     finalArtifactId, decisionId, engineeringBotId, authorizedFindingIds, scope, acceptanceCriteria,
     repairCycle, createdAt}（P0.3 行 167）。
2. `claimJob`：capability 必须经 `checkCapability(dshHome, {botId, operation:"job.claim", capability})`
   （lib/review-capability.js 已重做为 HMAC 签名验证——直接调用，不要弱化）且 payload.jobId === jobId；
   非签名/伪造/过期/重放 nonce → 拒绝。lease 字段：{claimOwner/claimAt/leaseUntil/heartbeatAt/attempt/
   maxAttempts/reportArtifactId}（P0.3 行 168-170）；同一 job 最多一个有效 claim；过期 host 单写回收。
3. `reportFix`：changedPaths 必须按 **job.scope**（授权路径前缀集合，非硬编码项目根）逐条判定：
   scope 内的前缀 + realpath 规范化后以某前缀为界；越界 → 拒绝+审计；findingIds ⊆ authorizedFindingIds。
   fix-reported 为终态之一，不再可 re-claim（P0.3：只有新 decision revision 才能创建新 job，不复活旧 job）。
4. heartbeat/三次失败 dead-letter/requeue generation 闭环（P0.3 行 170-172）。
5. 保留导出名与形状：jobsDir/jobFileFor/jobEventsFileFor/jobLeaseFileFor/JOB_EVENT_TYPES/JOB_DEFAULTS/
   nextJobId/readJobState/readJob/createEngineeringJob/claimJob/heartbeatJob/reportFix/expireStaleJobLeases。
   新增导出：jobIdOfDecision（如需要）。
6. 测试：扩展 review-engineering-job.test.mjs；**F-P9-07 反例回归**：①无 decision 记录创建拒绝；
   ②choice≠authorize-repair 拒绝；③findingIds 越权拒绝；④scope/acceptanceCriteria 与 decision 不一致拒绝；
   ⑤伪造/无签名 capability claim 拒绝；⑥越 scope 的 changedPath 报告拒绝；⑦fix-reported 后 re-claim 拒绝；
   ⑧三次失败 dead-letter 且仅新 decision revision 的新 job 才可继续（旧 job 不复活）。

确定性命令：
```
node --check lib/review-results.js && node --check lib/review-jobs.js
TMPDIR=/dev/shm node tests/review-results-api.test.mjs
TMPDIR=/dev/shm node tests/review-engineering-job.test.mjs
```
全部通过。报告 JSON：{filesChanged, testsRun:[{cmd,passed,window}], counterexamples, deviations, summary}。