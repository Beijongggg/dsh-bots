# 宿主/插件面更迭的隔离与升级

Type: grilling
Blocked by: 03, 08

## Question

用户 2026-09-10 追加约束：组织规格不得依赖会被 DSH 更新代换的内部面（插件兼容面
会被更新代换；「前端与 DSH 统一」会不断出问题）。03 号票已把它落为岗位卡第 8 字段
「依赖面／更迭敏感性」与常设裁定，本票定规程与验证：

1. **依赖面清单与判定规则**：逐一列出组织层今天依赖的宿主面（cordis 槽位与 client
   bundle 结构、host HTTP API 形状与鉴权面、注册表/模型解析链、spawn/env 白名单、
   SSE 事件面），标出哪些**必须**经可替换适配层、哪些可直用；「会被代换」的判定
   规则（版本探测？契约测试？）。
2. **升级验证**：宿主升级时如何验证组织仍工作——回归探针／就绪门／契约测试与既有
   preflight（scripts/preflight.mjs）和 tests/run.mjs 的关系；失败时的 fail-closed 语义。
3. **维护责任归属**：适配层维护归哪个岗位（03 号票口径：实施者承担、值班统筹组织
   例行评测？），演化与回退面（适配层坏了回退到什么形态）。
4. **前端口径落地**：Q4(b)「原生一致优先、功能可用兜底」下的适配成本归属与验收
   方式（UI 形态本身 out of scope，本票只管适配边界与成本）。

研究性内容按 map 网络声明标「待补充轮复核」；本票不产出代码，只产出规程决策。

## Comments

### 2026-09-10 现场证据（本票成立当日即撞上的一例）

03 号票批前门 `TMPDIR=/dev/shm npm run preflight` ①回归 **55/56 ❌**，唯一失败件
`tests/locale-runtime.test.mjs`：

- **现象**：`Error: unexpected official require: @deepseek-ai/dsh-client-store`
  （`tests/locale-runtime.test.mjs:37` 的 require 桩抛出）。
- **归因（机器证据三元组）**：宿主安装件
  `/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js`
  的 mtime ＝ **2026-09-10 18:49:10 +0800**（观测时刻 2026-09-10 20:55 CST）；
  该版本 factory 新增 `require("@deepseek-ai/dsh-client-store")`（grep 命中），
  测试桩白名单未含此 id，且该包在宿主 `node_modules/@deepseek-ai/` 下 **不存在**
  （`ls` 查无）。
- **归因边界**：本批为纯文档批（`git status --short` 仅 `CHANGELOG.md` /
  `CONTEXT.md` 改动 ＋ `.scratch/org-v2/` 未跟踪），无 `lib/`、`tests/` 改动——
  失败**先于且独立于**本批。
- **未验证项（不得声称）**：产品运行面（浏览器 boot 图是否提供该模块、真实
  locale 注册是否受影响）**未验证**；本票第 2 项「升级验证」正需覆盖此类失败面
  的判定规则与 fail-closed 语义。
- **处置**：本票（wayfinder）只产决策、不动手修；修复属代码批，修复前①回归
  维持 55/56 红。
