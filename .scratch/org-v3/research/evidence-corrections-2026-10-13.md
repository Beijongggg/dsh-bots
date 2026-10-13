# org-v3 研究关键引用纠正

采集时间为 2026-10-13 17:23 至 17:30，Asia/Shanghai。
本轮只核对 AdaptOrch、HAL 成本争议，以及公开分数与成本字段。
未重现实验，未逐篇复核原研究报告，也不据此关闭研究票或选定项目成本主判据。

结论强度分开记录。论文表格可确认作者报告了什么，不等于独立复现；
官网数据可确认当日公布了什么，不等于账单已审计；访问失败不证明材料不存在。

## 1. AdaptOrch 存在可定位的动态与固定形态对照

来源为 [arXiv:2602.16873v1](https://arxiv.org/abs/2602.16873v1)，
提交于 2026-02-18。直读 [HTML 全文](https://arxiv.org/html/2602.16873v1)。
摘要确实声称同底模、动态选形相对静态基线提升 12% 至 23%；
但全文将这一范围算在 Single Best 基线上，不能照搬成相对最强固定拓扑的增益。

[Table 2](https://arxiv.org/html/2602.16873v1#S5.T2) 给出以下数值。
相对增益按 `(AdaptOrch / Single Best - 1) × 100%` 复算。

| 任务与指标 | AdaptOrch | Single Best | 相对 Single Best | 表中作者标为 Best Static 的基线 | 对该基线的绝对差 |
|---|---:|---:|---:|---|---:|
| SWE-bench Verified，accuracy | 52.6 | 42.8 | 22.9% | MoA-3L，48.1 | +4.5 个百分点 |
| GPQA Diamond，accuracy | 53.1 | 46.2 | 14.9% | Static-Sequential，50.3 | +2.8 个百分点 |
| HotpotQA，F1 | 76.4 | 68.3 | 11.9% | Static-Parallel，72.8 | +3.6 个 F1 点 |

这里的 Best Static 是 Table 2 的作者标签，不是全文所有固定配置的最大值。
[Table 4](https://arxiv.org/html/2602.16873v1#S5.T4) 的 SWE-bench 固定 hybrid 消融
为 49.8，完整 AdaptOrch 为 52.6，差值是 +2.8 个百分点。
Table 2 另列预算匹配的 Self-MoA，三个任务分别为 51.5、52.3、75.5；
AdaptOrch 与它的差值仅为 +1.1、+0.8 个百分点和 +0.9 个 F1 点。
因此不能把 +4.5 个百分点或 12% 至 23% 写成相对所有固定基线的优势。

[附录 B.4](https://arxiv.org/html/2602.16873v1#A2.SS4) 说各方法使用同一五模型池，
并说明 Static-Parallel 向三个模型轮转分派，Static-Sequential 只用 GPT-4o-mini。
两者沿用 AdaptOrch 的分解与合成步骤，仅绕过拓扑路由。
这是作者报告的同模型池对照，不是每一实验臂都使用完全相同的模型分配和调用预算。

### 成本不能混为一项

摘要所给路由复杂度 `O(|V| + |E|)` 是图算法计算量，不是美元或任务内切换成本。

| 成本对象 | 一手定位与报告内容 | 仍不能推出什么 |
|---|---|---|
| 每任务拓扑路由计算 | [附录 B.2](https://arxiv.org/html/2602.16873v1#A2.SS2) 报告单 CPU 核 Python 路由小于 50ms/任务 | 不是整个组织推理延迟，也不是搜索或切换的完整美元成本 |
| 合成调用 | 同一节报告一次额外 LLM 调用，约 $0.01/实例 | 不是失败重路由的独立增量成本 |
| 实例内总 token | [§5.1](https://arxiv.org/html/2602.16873v1#S5.SS1) 声明按各 API 的 usage 汇总，包含分解、路由和合成；Table 2 给每实例均值 | 原始跨供应商 token 未归一化，不能当作完全可比的计算单位 |
| 离线阈值搜索 | [§5.5](https://arxiv.org/html/2602.16873v1#S5.SS5) 报告在 15% 开发子集上搜索六个阈值 | 本轮未定位独立的搜索成本账，不能写零成本或已全额摊销 |
| 任务内失败重路由 | Table 4 报告移除重路由后 52.6 降至 51.0 | 有效果消融不等于有切换成本账，本轮未定位其独立 token、延迟和美元增量 |

可保留的结论是，全文有动态选形及重路由的作者实验报告，且报告了部分运行开销。
原报告的“未见动态对照”和笼统“没有 search/switching cost figures”均须收窄。
完整切换账、离线搜索摊销与可复现性仍未核实。

引用还须保留两处限制。
§5.1 与 Table 4 标注 SWE-bench 为 500 实例，§5.5 却说 Tables 2 至 4
仅统计扣除 15% 开发集后的测试子集，准确分母需作者澄清。
论文指向的 [代码仓库](https://github.com/adaptorch/adaptorch)
在本次 GitHub API 读取中返回 404，未取得代码、实例清单和原始运行记录。
404 只说明本次不可访问，不用于判断仓库从未存在或论文结果真伪。

## 2. HAL 的嵌套 span 争议尚未完成一手核实

本次直接请求 [HAL 官网](https://hal.cs.princeton.edu/) 时连接超时，
没有取得当前榜单或 2026-10-05 已知问题公告。
原报告所谓“嵌套 trace span 重复计算 API 响应、恰为两倍、各行不均匀、尚未重算”，
本轮不能确认其适用 benchmark、运行日期、代码版本、榜单行或修复状态。
这条旧摘录只可作为待核线索，不能升级成 HAL 全表均为上界或全表均不可比较的事实。

能够定位的另一个一手修复是
[hal-harness PR #114](https://github.com/princeton-pli/hal-harness/pull/114)，
标题为 `Fix cached token double-counting by correctly parsing provider-specific usage fields`。
GitHub API 记录其于 2025-09-22T19:21:46Z 合并，
合并提交为 `713013160c0b4a9ab94c6671dd59c9f628042c41`。
它涉及 cached token 字段解释，不能代替对 2026-10-05 嵌套 span 问题的核实，
也不能由这个合并记录推断既有榜单行已重算。

[HAL 论文 v1](https://arxiv.org/html/2510.11977v1) 于 2025-10-13 提交，
确实描述跨模型、scaffold 与 benchmark 的成本追踪，但不能回答后来公告的影响范围。
本轮检索官方 `hal-harness` 仓库的公开 issue/PR 未定位到上述 2026-10-05 公告，
检索不到不等于公告不存在。

原成本报告所列 SciCode 两行是 o3 Medium Tool Calling 与 o4-mini Low Zero Shot，
模型、推理设置和 scaffold 都不同，原先称为“同模型、不同 scaffold 对照”本身就不成立。
`$111.11 / $1.74 ≈ 63.9` 只是旧摘录的算术比值，本轮未直接核对两行公布值，
也没有逐行重算数据，不能把它作为已核实效率结论继续引用。
恢复引用前至少需要当日榜单行、该成本问题的适用范围，以及受影响行的重算说明。

## 3. Terminal-Bench 4.0 可提供公开分数与成本的描述性对照

直读 [官方榜单](https://www.tbench.ai/leaderboard) HTML 内的
`self.__next_f.push` 数据，定位 `state.data.leaderboard` 与 `state.data.rows`。
页面对象为 `terminal-bench/terminal-bench`，版本 `4-0-0`，
leaderboard ID 为 `9f966760-00f1-424e-90f5-c964fb6f6091`，
dataset version ID 为 `1922072f-a433-429a-8929-350d5e1bcf02`。
榜单 `updated_at` 为 `2026-10-06T23:20:25.572485+00:00`。

| 配置 | accuracy | 95% CI 半宽 | n_trials / successes | total_cost_usd | 行 ID |
|---|---:|---:|---:|---:|---|
| Codex，GPT-6 Astra，max | 58.18% | 2.79 个百分点 | 330 / 192 | $3,267.18 | `5c537be4-7fc3-449b-8bfc-ceb9061c2535` |
| Codex，GPT-6.1 Sol，max | 58.18% | 3.11 个百分点 | 330 / 192 | $634.24 | `79aafc20-6776-4411-a5a5-0640562496d0` |

两行 `updated_at` 分别为 `2026-09-10T21:58:00.001022+00:00` 与
`2026-10-06T17:56:38.691746+00:00`。
公布总成本的算术比为 5.1513，约 5.15 倍。
可引用为“同一榜单版本中，两种不同模型配置取得相同公布分数，公布成本相差约 5.15 倍”。
不能写成组织编排的因果收益、同模型对照、已证明等效质量，或项目应采纳的门槛。
这提供了真实的一手分数与成本字段，不是组织对裸臂的受控实验。

token 明细也须限制使用。
Astra 行的 `uncached_input_tokens=1505789330` 加 `output_tokens=23988992`
恰等于 `total_tokens=1529778322`，却另列 `cached_input_tokens=1443351702`。
Sol 行也有相同字段关系。
因此 cached、uncached 与 output 不能按字面直接相加；
本轮未确认这些字段的实际包含关系、价格表或成本计算代码。
两行美元数只能称为榜单公布值，不能称为已按完整 token 账单独立复算的成本。

## 4. SWE-bench 官方也有成本字段

直读 [SWE-bench 官网](https://www.swebench.com/) 的
`<script type="application/json" id="leaderboard-data">`。
采集时 `Verified` 板共有 180 行，其中 45 行的 `cost` 非空，成本不是每行必填。
例如结果目录键 `20260217_mini-v2.0.0_claude-4-5-opus-high`，
使用 mini-SWE-agent 2.0.0、Claude 4.5 Opus high，发布日期字段为 2026-02-17，
公布 `resolved=76.8`、`cost=376.9539985`、`instance_cost=0.753907997`。
同一行还有 `per_instance_details` 内的 `cost` 与 `resolved`。

这足以否定“只有 Terminal-Bench 与 HAL 公开分数和成本”的全称断言。
不能据此认为所有 SWE-bench 提交均有成本，也不能把这些列当成跨版本、
跨计价日期或不同 scaffold 的因果对照。此处只确认字段存在及一个可定位实例。

## 5. 留给后续研究的事实缺口

- AdaptOrch 的分母冲突、代码与运行记录、搜索摊销和重路由独立成本尚未核实。
- HAL 后续公告、影响范围、两条 SciCode 行的重算状态尚未核实，63.9 倍不得当作已核实结论。
- Terminal-Bench 的 token 字段包含关系和美元计价过程尚未核实；公开对照保留公布值边界。
- 本轮没有扩大成基准套件穷举，也没有裁定主成本指标、预算门槛或研究票状态。
