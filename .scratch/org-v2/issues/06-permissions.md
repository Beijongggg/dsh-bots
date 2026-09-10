# 权限模型

Type: grilling
Blocked by: 03

## Question

每岗能碰什么：文件面（「真实运行面零写入」纪律的 bot 版映射）、工具面、
数据面（mail/knowledge/review）；最小权限与 capability 边界；与 host 侧
既有边界（CSRF/代际绑定/env 白名单）的关系——组织层权限是复用、加严还是
另起。

## 来自 04 号票的输入（2026-09-10 裁定）

- capability 机制（`lib/review-capability.js`：HMAC 单次、绑定实例的通用权限
  原语，覆盖面含 `job.*`／`evidence.*`／`artifact.*`）**保留为 v2 通用权限原语**；
  其岗位化封装归本票定。
- 复核者权限面＝**只读**（只看 diff＋判据、报 gaps，不得改工件）——本票须给出该
  只读面的机制，并说明与既有 read-only 模式／工具面禁用清单的关系。
