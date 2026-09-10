# Research: agent 工程恒久原则（模型更迭不腐）

Type: research
Status: resolved

## Question

context engineering（上下文预算与分层）、handoff/移交契约设计、组织记忆
设计（岗位记忆 vs 团队共享上下文 vs 知识库）、以及「组织形式脱离模型智能」
的已有实践：哪些设计被证明模型更迭不腐、判据是什么。一手来源优先
（Anthropic/OpenAI 工程博客、论文、高质量工程实践）。产出：可进 v2 规格
的判据清单＋反例（哪些做法被证明随模型过时、为什么）。

## Answer

试金石：编码「任务/环境/组织事实」的设计模型更迭不腐，编码「某代模型行为假设」
的设计必腐。八条已核验判据进报告 §5（D1–D10 条款式）：上下文恒稀缺故预算分层、
契约外置（MCP/A2A/AGENTS.md）、最小充分指令随升级做减法、移交四要素契约＋
全轨迹共享、单线程默认并行须上下文独立、记忆三层（岗位笔记＋技能库/团队仓库文件/
按需知识库）、验证外置、组织形式增益＝token 放大而非集体智能（Anthropic 实测
token 量解释 80% 方差）。反例 §4：edit-apply 模型、咒语式提示（"Take a deep
breath"）、按标称窗口设计、框架抽象层、指令膨胀、滥用并行、摘要式移交等——
共同病理是绑定模型代次假设。

**暂定稿——网络受限，待补充调研轮复核**（盲区 8 项见报告 §6，含 Claude 4
best practices 原文、MAST 正文细节等未核验点）。

研究报告：[../research/enduring-principles.md](../research/enduring-principles.md)
