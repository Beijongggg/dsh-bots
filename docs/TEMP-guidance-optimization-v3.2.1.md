# 临时指导文档：收敛重构优化方案 v3.2.1

> 状态：临时指导，不是执行授权。
>
> 用途：防止方案在后续上下文中发生时基线、范围、失败语义、证据来源和部署边界漂移。
>
> 本文记录 v3.2.1 实施合同。除用户另行点名授权外，不得据此修改代码、文档、证据、部署，不得重启实例，不得触碰真实运行面。

## 1. 当前基线与不可改变的边界

当前冻结基线：

```text
review-evidence-package.json：
a21b6f0da0b82a4c2fc75ddc9fefccd9d4a684621305c998b3907fc97e297e7c
```

当前门态：

```text
P6-4：限定式关闭保持
P6-5：real-sentinel 狭义写入边界限定式关闭保持
P7-5/C：关闭保持
R-3：NOT READY / BLOCKED
P9：不得启动
```

不可改变的边界：

```text
真实 DSH_HOME、真实部署目录、真实注册表和真实配置零触碰；
四个 bot 实例是否重启仍由用户单独裁定；
四源重建、F-S15、P9、R-3 不属于本方案；
O-1～O-5 是既有关闭后的收敛增强，不自动推翻三门关闭；
若 O-2/O-3 改变已关闭范围内行为，只对变化部分做增量验收。
```

## 2. 执行顺序与批次

```text
O-1（纯文档收口注记）
→ O-2a+b+c（一次代码＋测试批）
→ C2-1
→ O-3（manifest＋职责收敛）
→ C2-2
→ O-4a（probe provenance）
→ O-4b（证据包 v2）
→ C2-3
→ O-5（最后可选架构分层）
→ C2-4（如执行）
```

O-1 可单独授权。O-2a+b+c 合并为一个代码、测试和 C2-1 批次。O-4a 与 O-4b 可属于同一大批，但必须先固定 raw schema，再由 packager 消费。

每次 C2 必须附：

```text
repo/deploy pre-sync 与 post-sync SHA-256；
byteLength；
deploy-side node --check；
文件使用者和加载方式（CLI 按次／host 内存态）；
restartNeeded 及依据；
真实面前后无非预期差异。
```

## 3. O-1 收口注记合同

O-1 仅记录文档语义，不扩大既有关闭范围。

P6-5 关闭声明必须限定为：

```text
real-sentinel 模式下普通非竞态条件的：
- sentinel 写入边界；
- 既有目标拒绝；
- symlink/hardlink 负例；
- protected-root 拒绝；
- 布局空前置；
- 排他创建；
- 终树差异核验。
```

明确排除：

```text
shadow --out 的完整安全合同；
后置失败统一清理；
用户态路径 TOCTOU；
formal raw provenance；
证据包事实字段自动推导。
```

证据包当前定位为：

```text
有文件账实校验的声明包；
手工事实字段必须如实标注。
```

时间顺序不变量：

```text
runStartedAt
≤ probeObservedAt
≤ payloadGeneratedAt
≤ artifactWriteStartedAt
≤ artifactWriteCompletedAt
≤ captureManifestAt
```

其中 `artifactWriteCompletedAt` 由 capture manifest 持有，raw 不记录自身写入完成时间；mtime 仅作 ±2 秒容差的辅助校验，不要求字面相等。

O-1 定稿后不得覆盖旧包。旧包 `a21…` 必须保留，新包必须使用版本化路径或显式 immutable archive，并以完整 SHA-256 建立 `packageScope=incremental` 的 `basePackage` 链。

## 4. O-2a+b+c 契约

### 4.1 输出 profile

```text
--out-profile evidence（默认）：--out 只能位于 approvedEvidenceOutputRoots；
当前 approved root 为 <repoRoot>/artifacts。

--out-profile ephemeral（显式）：必须同时给 --ephemeral-out-root <abs>；
该根必须在全部保护区之外、不在仓库内、逐组件 lstat 通过；--out 必须位于该根之下。

任意 /tmp 不自动合法；无 --out 走 stdout，零目录零文件。
```

受保护区包括：

```text
DSH_HOME；部署目录；shadowRoot；受保护的仓库路径（代码、部署映射、配置区）。
```

`artifacts/` 是显式 approved evidence output root，不等同于仓库任意路径放行。approved root 自身仍适用逐组件 lstat、非 symlink 祖先、最终组件不存在和 `wx`。

### 4.2 shadow 完整输出合同

shadow 和 real-sentinel 的输出合同均须覆盖：

```text
最终组件不存在；
最终写入使用 wx；
已有祖先逐组件 lstat；
祖先必须是真实目录；
拒绝 symlink、dangling symlink、非目录和不可读路径；
拒绝 DSH_HOME、部署目录、shadowRoot 和受保护仓库路径；
检查失败不运行探针、不落盘。
```

shadow `--out` 位于 shadowRoot 内的三种情形（直接、已有子目录、别名路径）均为 `exit 2`。

输出父目录不自动创建：

```text
不存在 → PRECONDITION_FAILED / exit 2；
symlink、普通文件或不可读 → OUTPUT_CONTRACT_VIOLATION / exit 2；
父目录必须预先存在且逐组件校验通过。
```

### 4.3 错误对象与阶段策略

错误对象强制包含：

```json
{
  "code": "...",
  "phase": "...",
  "details": {},
  "exitCode": 2,
  "scenePolicy": "..."
}
```

错误码：

```text
OUTPUT_CONTRACT_VIOLATION / PRECONDITION_FAILED / SENTINEL_CONTRACT_VIOLATION
  → exit 2

UNEXPECTED_IO / PROBE_EXECUTION_FAILURE / EVIDENCE_EMIT_FAILURE
  → exit 1（INCONCLUSIVE 语义）
```

Phase 0～4：

```text
Phase 0 前置校验失败：无布局写入；
Phase 1 布局创建失败：回滚本轮已创建项，best-effort；
Phase 2 探针执行失败：按 mode 保全或清理现场；
Phase 3 后置校验失败：按 mode 保全或清理现场；
Phase 4 证据输出失败：不虚报成功，按 mode 处理现场。
```

### 4.4 scenePolicy

```text
real-sentinel：Phase 2/3/4 失败 → preserve-for-caller；
shadow：默认 auto-clean；显式 --preserve-failure-scene 才保留失败现场。
```

shadow 顺序冻结为：

```text
创建 shadowRoot
→ 校验 out 边界
→ 探针
→ payload
→ emit
→ 删除 shadowRoot
```

### 4.5 probe suite API

```js
prepare: "overwrite-shadow" | "none"
```

默认行为保持兼容：无 opts 等价于 `overwrite-shadow`。

`overwrite-shadow` 仅允许 shadow 开发路径并可覆盖 fixture；`none` 不创建、不覆盖、不删除，所需目标缺失或类型错误即 `PRECONDITION_FAILED`。

real-sentinel runner 只接受 `runShadowProbeCells`，不暴露可传入 `prepare` 的路径；通过调用图静态检查和专项测试双重保证。

## 5. O-3 manifest 与运行面不变量

唯一布局来源：

```js
SHADOW_LAYOUT_MANIFEST
```

要求：

```text
数组和逐元素双层 freeze；
path 唯一、相对 POSIX、非绝对、无 ..、非空；
content 类型和 fileMode 明确；
lib、real-sentinel、测试三方均从同一 manifest 派生；
脚本禁止重新声明第二份布局字面量；
manifest 使用稳定 canonical JSON 计算 digest；
派生侧仍执行路径安全校验，不因来源内部而豁免。
```

兼容字段：

```json
{
  "clean": true,
  "cleanSemantics": "legacy probe-residue check only",
  "treeIntegrity": {
    "value": true,
    "source": "snapshotTree/treeDiff/layoutIntegrity"
  }
}
```

I1～I4：

```text
I1：sentinel 写入路径不可逃逸；
I2：既有文件不可覆盖；
I3：脚本输出不可进入真实运行面；
I4：运行后终树仅允许批准的新增。
```

E1～E5 为独立证据不变量，不进入 guardChain：

```text
E1：运行工件绑定具体代码版本；
E2：运行工件绑定唯一 runId；
E3：运行时间顺序可验证；
E4：包内摘要只能引用已存在产物；
E5：历史审查结论不得伪装成单次运行事实。
```

## 6. O-4a provenance 合同

raw 必须包含：

```text
runId；
probe.sourceManifest[]（本次执行实际参与的全部本地源码文件及 sha256）；
probe.sourceManifestSha256；
兼容摘要 probeScriptHash/libSha256；
argv[]；
nodeVersion；
timing 运行时间字段。
```

当前阶段使用策略 A：

```text
入口脚本＋显式 lib 清单；
静态解析 import/require 和字符串字面量动态 import；
相对路径解析；extensionless 按 Node 规则处理；排除 node: 与 node_modules；
无法静态解析的本地动态 import → provenance validation failure。
```

O-5 拆分后升级策略 C：构建期生成冻结 source manifest，runner 加载前逐文件比对；不匹配即拒绝运行。不得使用运行时 hook 追踪策略 B。

三层绑定：

```text
raw.json
  ↓ raw hash
capture-manifest.json
  ↓ capture manifest hash
package
  ↓ 下一轮 basePackage 完整 SHA-256
```

raw 不包含自身 hash。capture manifest 至少记录 raw path、sha256、byteLength、mtime、artifactWriteCompletedAt、capturedAt。

篡改检出至少包括：

```text
raw 改一字节；capture manifest 改一字节；script 改一字节；lib 改一字节；runId 重复。
```

### 6.1 run-registry 独立合同

位置：

```text
<repoRoot>/artifacts/run-registry/
```

该目录是独立 `approvedEvidenceControlRoot`，不套用普通 evidence output 的最终组件 `wx` 规则。

claim：

```text
run-registry/<runId>.claim；
runId 固定 UUID；父目录预先存在并逐组件 lstat；最终组件不存在；O_CREAT|O_EXCL；
创建成功即永久占用；不删除、不释放、不复用；重试必须新 runId。
```

claim 内容至少：

```json
{
  "runId": "...",
  "claimedAt": "...",
  "pid": 0,
  "argv": [],
  "sourceManifestSha256": "...",
  "status": "claimed"
}
```

部分写入语义：

```text
O_EXCL 最终 claim 创建成功后，即使内容写入失败，runId 仍永久占用；
空、截断或非法内容为 invalid tombstone；本次不得启动；validator 标 invalid/abandoned；claim 不删除。
```

ledger：

```text
run-registry.jsonl 允许既有；必须为真实普通文件；拒绝 symlink、目录和危险 hardlink；
以 O_APPEND 打开；禁止 truncate；每条记录单次追加；按 durability 合同 fsync；
不得因 ledger 已存在而使用 wx 拒绝后续记录。
```

claim 与 ledger：

```text
claim 成功＋终态追加成功 → 记录完整；
claim 成功＋ledger 追加失败 → registry-incomplete，claim 不删，runId 不复用；
claim 无终态记录 → running/abandoned/registry-incomplete，不得直接判成功；
崩溃残留 claim → abandoned/invalid，claim 保留。
```

JSONL：

```text
最多允许一个损坏尾行，但必须显式标记 incomplete；
中间损坏记录直接 validator 失败；不得静默忽略。
```

并发验收：

```text
同 runId 竞争：恰一成功；
不同 runId 并发：记录数正确、无撕裂行；
崩溃后 claim 保留并不可复用；
ledger 追加失败不得生成完整证据包。
```

## 7. O-4b 证据包 v2

职责分离：

```text
evidence-runner：隔离执行测试、probe、parity，产生原始产物；
evidence-packager：只读产物、校验 hash/格式/来源并生成摘要；不得执行测试。
```

packager 四禁：

```text
不改 raw；
不修补缺失字段；
provenance 不完整即失败；
humanReviewNotes 不写入 executionEvidence。
```

人工字段仅限：

```text
authorizationBasis；pendingItems；humanReviewNotes；scope。
```

以下必须来自结构化产物：

```text
fullRegression；concurrencyStress；deploymentImpact；probe verdict；tree diff。
```

`deploymentImpact` 至少包含：

```json
{
  "deploySyncNeeded": true,
  "restartNeeded": false,
  "basis": [],
  "manualOverride": null
}
```

如有人工 override，必须包含：

```text
value；reason；authorizedBy；timestamp。
```

版本包合同：

```text
packageScope：incremental 或 cumulative；
basePackage：完整 64 位小写 SHA-256 和可读取路径；
禁止省略号、循环引用和仅用 CHANGELOG 文本引用；
旧包不得被覆盖；新包使用版本化路径或 immutable archive；
packager 输出自身也必须遵守 approved root、预存父目录、逐组件校验和 wx。
```

## 8. O-5 可选架构分层

O-5 最后执行，不作为下一门类验收前置。

建议层次：

```text
lib/sentinel-safety.js：路径、快照、输出和安全 helper；
lib/sentinel-runner.js：Phase 0～4、结构化错误、模式化 scenePolicy；
lib/review-enforcement.js：布局 manifest 和纯 probe API；
scripts/review-enforcement-probe.cjs：CLI parse→dispatch→emit→exit。
```

O-5 前先冻结 payload contract：

```text
字段名、字段类型、失败码、phase、invariants、provenance、treeDiff、clean/cleanSemantics、scenePolicy。
```

重构前后只允许差异：

```text
runId、时间、临时路径、新增结构化错误字段。
```

不得改变：

```text
布局内容、允许新增集合、失败码、clean 语义、既有成功/失败行为。
```

验收：

```text
行为不变；错误分类统一；清理责任明确；TOCTOU 如实保留；
real-sentinel preserve-for-caller；shadow 默认 auto-clean。
```

## 9. 部署与重启规则

```text
CLI 脚本按次加载：同步后新进程可见；
host 静态导入并已加载内存模块：同步不等于内存态更新。
```

```text
修改 validateWorkspaceTriple 或 host 调用路径：需重启裁定；
修改模块顶层初始化、间接依赖或静态导入图：重新判断 host 影响；
纯新增且不被 host 当前调用路径使用的导出：新 CLI/新进程可见，通常无需重启，但不得据此声称既有 host 已加载新导出。
```

未经用户单独授权：

```text
不重启四 bot 实例。
```

## 10. 执行前后通用纪律

每一批均执行：

```text
定稿→实现/文档变更→专项测试→全量回归→证据生成→账实核验→双席复核→（获授权后）C2 同步→冻结。
```

不得：

```text
将旧 raw 回填新字段后冒充新运行；
将 payload 自填字段描述为不可篡改证明；
将 guardChain 数量描述为安全强度；
将增量包误写成累计包；
将 repo↔deploy 平价误写成长驻 host 已更新；
将 R-3/P9 或真实面操作并入本方案。
```

## 11. 授权状态

本临时指导文档的录入本身不构成任何批次执行授权。

```text
O-1：待用户点名授权；
O-2：待 O-1 后单独或合并点名授权；
O-3/O-4/O-5：按顺序逐批点名授权；
C2：每批单独执行，不能由本指导文档默认为授权；
部署、重启、正式 provenance 证据重采集：均需在相应批次授权和验收范围内执行。
```
