# 22: 探针沙箱快照形态

**What to build:** §E「沙箱快照与逐字一致校验形态照用」补全另一半。当前探针件只
实现了逐字一致校验；fs.contains/node.tests 均对活树直接执行——检查时刻与结论使用
时刻之间坐标内容可变（TOCTOU 缝），规格点名的快照形态缺失。本票补：探针执行前的
坐标快照采集步（形态照用逐字一致的快照纪律）、校验对快照执行而非活树直查、快照
与结论绑定可核验（结论报告引用其所核验的快照）。

规格出处：`.scratch/org-v2/spec.md` §E（401 行）；07 号票复审 Spec 轴 (a)2
（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** ready-for-agent

- [ ] 探针执行有快照采集步（沙箱快照形态照用）
- [ ] 校验对快照执行、非活树直查
- [ ] 快照与结论绑定可核验
- [ ] 隔离子进程纪律保持（AGENTS.md §2）
- [ ] 全量回归 PASS

## Comments
