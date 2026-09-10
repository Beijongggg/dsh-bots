# Research: 多 agent 组织模式谱系与成本结构

Type: research
Status: resolved

## Question

工业与学界已验证的多 agent 组织形态——supervisor/层级/扁平/动态编组/矩阵
（AutoGen、CrewAI、MetaGPT、LangGraph、CAMEL、Anthropic/OpenAI 官方多代理
指南等）：各自的组织原则、适用规模、失败模式；token/成本实践（模型 routing、
cascade、降级链、按岗配档）。优先提取**不随模型更迭过时**的恒久内容（组织
原则、协议设计、成本结构），框架细节只作证据；一手来源优先（官方文档/论文/
工程博客）。产出：模式菜单（每模式：结构/优劣/成本形态/恒久度评估）＋对本
图的适用性初判（dsh-bots：小规模常驻 bot 团队、目标→自治主轴＋常态值守）。

## Answer

- 跨厂共识（Anthropic/OpenAI/LangChain）：单 agent 优先，多 agent 是用 token 换并行的溢价架构（官方实测约 15 倍 token），只在重并行/超单窗/多工具三要件满足时启用。
- 模式菜单七式（supervisor/层级/扁平对等/广播群聊/动态编组/并行投票/矩阵）各附结构、优劣、成本形态与恒久度评估；恒久的是组织原则与协议（handoff 语义、任务简报四要素、SOP 显式化、scaling rules、上下文隔离、按岗配档、级联降级），速朽的是框架 API。
- 失败模式有实证分类学（MAST：3 类 14 式），多数可由组织协议对策（简报四要素、共享台账、独立验证岗、直通转发）预防。
- 对 dsh-bots 初判：常态值守＝扁平对等无编排层；目标→团队自治＝supervisor/编排者-工人按需拉起（高档配协调评审岗、低档配执行值守岗，FrugalGPT 级联做省钱模式）；双形态叠加即矩阵组织（职能线＋项目线共享同一批 bot），该映射缺直接文献（盲区），已按推理标注。
- 研究报告：[../research/org-patterns.md](../research/org-patterns.md)（20 个一手来源＋盲区清单）。
- 暂定稿——网络受限，待补充调研轮复核。

