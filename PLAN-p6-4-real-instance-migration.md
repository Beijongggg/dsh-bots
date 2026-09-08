# P6-4 真实实例注册/迁移 · 设计冻结稿（2026-08-29 用户批准）

**状态：已批准冻结。本文件为 P6-4 执行与验收的唯一依据；任何修订须经双席归一。**
**边界：本冻结稿阶段零运行时写入；运行时部分（部署/重启）属 P7-5 授权批。**

## 一、现状基线（2026-08-29 read-only 实测）

- bots.json（用户侧已准备）：lead（leadership）、bot-mt0x6r0y（research）、
  reviewer-lead（review, niko/gpt-5.6-sol）、reviewer-second（review, opencode-go/deepseek-v4-flash）。
- 真实 instances.jsonl：append-only，全部 legacy 三字段行；无 reviewer 行（双席 bot
  尚未以新代码运行）。
- 部署目录：08-25 旧代码（其 apply 仍写三字段行）——迁移实际阻断点。
- 五字段自写路径在库完整：每个 dsh 进程 apply 自写一行
  `{botId, pid, startedAt=Date.now()-uptime, hostInstanceId=host-<pid>, at}`，
  值全部写入进程自算、不接受外部传入（F-RV-17/F-RV-23 冻结语义）。
- 注册表无 engineering 组 bot：F-RV-19 真实 job 链无主体，**不在 P6-4 范围**，另行提请。

## 二、迁移设计（批准方案 A：零数据迁移）

**不做任何 legacy 行改写/转换。** instances.jsonl 保持 append-only；P7-5 授权后部署
新代码并重启全部进程，每个进程 apply 自写五字段行；`currentInstanceRow` 取每 bot
最新行即新格式 → capability 签发/校验面自动解锁。legacy 旧行天然沉底（读侧只认
最新行；注册表 JSON 损坏才 fail closed）。

- 理由：零 fabricated 身份（不违反"值均进程自算"语义）、零迁移脚本、与在库实现同构；
  回滚 = 换回旧部署（可逆）。
- 方案 B（host 从 /proc 反推身份代写）**否决**：违反"不接受外部传入"冻结语义。

## 三、验收断言（P7-5 后执行；scripts/p6-4-verify.mjs）

1. **①格式**：每个预期存活进程（host/lead/reviewer-lead/reviewer-second）的最新行
   均为五字段且 pid 存活；
2. **②签发（--issue-test 显式开启）**：默认注册表读路径 `issueCapability` 对目标 bot
   签发 `evidence.read` 成功、`checkCapability` 消费通过（写 capability 台账/槽/nonce，
   属 P6-4 验收工件，可审计）；
3. **③身份轮换**：凡持有 active slot 的 bot，其 slot payload 身份与最新行不一致
   （重启后旧 capability 失效为正确状态）；一致则报告"未重启"提示；
4. **④对称**：reviewer-second 与 reviewer-lead 同样执行 ①③（②按 flag）。

验收通过 + 双席复核 → 关闭 P6-4。

## 四、P6-4 设计冻结裁定项（随本稿一并冻结）

1. **L2 host-authenticated proof**：与 F-RV-19 dispatch 同构——宿主为 invocation
   claim 写入 HMAC 签名 claim-token（落盘同 `jobs/<id>.dispatch.json` 款），claim 面
   凭签名建立 lease；secret 复用 capability secret。定位：lease 建立来源由宿主身份
   认证级升级为密码学证明；OS 级隔离仍为登记残留。
2. **bot-wide 镜像共存（裁定：方案 Ⅰ）**：镜像降级为纯诊断视图，P6-4 后从签发路径
   移除 job capability 的镜像写入（bot-wide capability 保留镜像）；"镜像不参与授权
   判定"不变式不变。
3. **capability 单锁分片（裁定：采纳）**：锁目录分片为 `capability/lock/<botId>/`
   （store 锁已参数化 lockDir，改动一行级）；随 P6-4 批实施。
4. **housekeeping 族（裁定：登记规划）**：nonce 目录按 issuedAt+ttl 清理（pump 每
   tick 分摊上限）；ledger 撤销后按 bot 归档；reconcile O(ledger) 重放成本上限登记
   （ledger 分段前有界）。

## 五、执行切分与门态

```text
本批（零运行时）：本冻结稿落盘 + 验收断言脚本化 + 配套测试（工作区内）
P7-5 授权批    ：规程登记 → 部署 → 重启（运行时；P9-5+P9-6 授权）
P6-4 验收批    ：断言执行 + 双席复核 → 关闭
其后           ：P6-5 真实 sentinel（另授权）
```

门态不变：R-3 NOT READY / BLOCKED；P6-4/P6-5/P7-5/P9 直至各自验收。
