# 21: capability 续签、读面 gate 与岗位 op 集合同口径

**What to build:** 权限面三收口＋一裁定。
①续签断链修正：授权通过但命令被拒（cas-mismatch 等常态拒绝，§D「不符即拒」）
当前即烧掉信封且不续签，授权链需 host 干预才能恢复——续签条件从「命令成功」修正
为「授权有效且信封已消费」或等价口径，短 TTL＋链式续签意图（§D 359–361）自洽。
②读面 gate 补第二腿：authorizeLedgerRead 只验信封有效性、不校验
ledger.read ∈ availableOps——补齐后 §E「工具面裁剪＝权限裁剪」在读面成立。
③对账独立消费面：issued.jsonl 审计链当前仅测试内对账（V-A3.3 证据列＝「对账
脚本｜回归记录」两项，前者缺）——补巡检脚本或接线。
④合同口径裁定（需用户明示，冻结纪律）：实现按 §B 责任表推导扩了 §D 封闭列举外
的五 op（task.close/cancel/unblock/resume/requeue＋task.exception）；续签点从
「转移点」加宽到「每成功 post 命令」。修订冻结合同 or 推导注记升格，二选一落档。

规格出处：`.scratch/org-v2/spec.md` §D（350–366 行）＋§E（386 行）；06 号票复审
Spec 轴 (a)3/(b)1/(b)2/(c)1/(c)2（CHANGELOG 对应条目）。

**Blocked by:** None（can start immediately）

**Status:** ready-for-agent

- [ ] cas-mismatch 后授权链可续（不依赖 host 干预重签），行为有测试锁定
- [ ] 读面 gate 套腿二（ledger.read ∈ availableOps）
- [ ] issued.jsonl 对账有独立消费面（脚本/巡检接线）
- [ ] 岗位 op 集与续签点的合同口径经用户裁定并落档（修合同 or 注记升格）
- [ ] 全量回归 PASS

## Comments
