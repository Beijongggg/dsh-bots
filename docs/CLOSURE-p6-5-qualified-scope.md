# P6-5 限定式关闭注记（O-1 收口，v3.2.1 合同）

> 依据：docs/TEMP-guidance-optimization-v3.2.1.md（SHA-256
> fba63f5fecfb42ff0c8523a026a021503630820f82af3a6e0010b1c1851f699a）第三节
> O-1 收口注记合同。本文档只记录语义，不扩大既有关闭范围，不构成任何
> 新执行授权；O-1 定稿后旧包不得被覆盖。

## 一、P6-5 关闭声明（限定式）

P6-5 的关闭范围**限定为** real-sentinel 模式下普通非竞态条件的以下七项：

```text
- sentinel 写入边界；
- 既有目标拒绝；
- symlink/hardlink 负例；
- protected-root 拒绝；
- 布局空前置；
- 排他创建；
- 终树差异核验。
```

**明确排除**（不在 P6-5 关闭范围内，不得引用 P6-5 关闭来宣称）：

```text
- shadow --out 的完整安全合同；
- 后置失败统一清理；
- 用户态路径 TOCTOU；
- formal raw provenance；
- 证据包事实字段自动推导。
```

## 二、证据包当前定位

```text
证据包＝有文件账实校验的声明包；
手工事实字段必须如实标注（不得描述为自动推导或不可篡改证明）。
```

## 三、时间顺序不变量

```text
runStartedAt
≤ probeObservedAt
≤ payloadGeneratedAt
≤ artifactWriteStartedAt
≤ artifactWriteCompletedAt
≤ captureManifestAt
```

- `artifactWriteCompletedAt` 由 capture manifest 持有；raw 不记录自身写入完成时间。
- mtime 仅作 ±2 秒容差的辅助校验，不要求字面相等。

## 四、版本化包链策略（自 O-1 定稿起生效）

- 旧包不得被覆盖；新包必须使用版本化路径或显式 immutable archive。
- 以完整 SHA-256 建立 `packageScope=incremental` 的 `basePackage` 链
  （完整 64 位小写 SHA-256 + 可读取路径；禁止省略号、循环引用和仅用
  CHANGELOG 文本引用）。
- 本仓归档约定：`artifacts/packages/review-evidence-package-<序号>-<sha8>.json`，
  归档后不再修改。

## 五、基线核验记录（2026-08-30，编码方 O-1 执行时点）

合同第 1 节载明冻结基线包为
`a21b6f0da0b82a4c2fc75ddc9fefccd9d4a684621305c998b3907fc97e297e7c`。
经核验：**该包在盘且即当前 `artifacts/review-evidence-package.json` 本身**
（generatedAt 2026-08-30T01:09:25Z，lead 席阶段收官终版 D-prime-R8-03，
40/40）。编码方上一批（2026-08-29 P6-5）生成的 `3ca8990d…` 包已在该收官
批次链中被取代——属本会话之外的外部演进，按 W-RV-1 惯例记录，不归因于
本批次，不回填、不重算。

处置：

1. basePackage 链自 `a21b6f0d…` 起链（归档序号 0001，
   `artifacts/packages/review-evidence-package-0001-a21b6f0d.json`，
   与基线文件逐字节一致）；
3. 自 O-1 起所有包重生成走版本化路径（`artifacts/packages/`），基线路径
   `artifacts/review-evidence-package.json` 冻结于 `a21b6f0d…` 不再覆盖。
