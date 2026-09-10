# 岗位工具配置（MCP/skill）

Type: grilling
Blocked by: 03, 06

## Question

MCP/skill 怎么给岗位配：哪些岗位配什么工具、bot 进程侧如何装载与调用
skill（现 skill 机制在 host/会话侧，bot 侧没有）、工具清单与权限的耦合
（06 号票的边）、工具失效/降级语义。

## 来自 04 号票的输入（2026-09-10 裁定）

- runProbe（`lib/review-evidence.js:414-505`：bwrap 沙箱、命令白名单
  `node/git/grep/sha256sum/wc`、exit code 判据）**保为所有岗位「可执行检查」的
  共同底座**；其工具装载与权限耦合（06 号票的边）归本票。
- 提示层双审注入段（`lib/index.js:2394-2416`）已判**废弃**；岗位卡其余提示装载面
  （岗位卡↔提示层的生成/校验与漂移检测）归本票。
