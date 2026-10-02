# tests/ 惯例

## 入口与跑法

- 全量：`node tests/run.mjs`（或 `npm test`）。入口顺序 spawn `tests/*.test.mjs`
  逐个执行，任一失败即非零退出。**禁止 `node --test <目录>`**——目录参数
  语义不同，会扫入依赖与非本仓测试（入口头注的卫生①口径）。
- 单文件：`node:test` 风格的文件用 `node --test tests/<file>.test.mjs`；
  裸脚本风格（自打印 `✓`、退出码即判定）用 `node tests/<file>.test.mjs`。
  两种风格并存，看文件头 import 即可分辨。
- preflight 四门：`npm run preflight > /tmp/pf.log 2>&1; echo EXIT=$?`——
  退出码即判定（`process.exit(pass ? 0 : 1)`）。不要接 `| tail` 管道，管道
  会把退出码换成 tail 的。
- **`/tmp` 只读时**（WSL 等环境，症状是成片 EROFS）：所有测试命令前缀
  `TMPDIR=/dev/shm`。`tests/run.mjs` 的 `tmpdirHint` 会给出定向提示。

## 书写惯例

- 新测试优先落在既有文件的同类用例旁；夹具复用 `tests/helpers/`：
  `brief-fixture.mjs`（简报）、`capability-fixture.mjs`（能力签发）、
  `criterion-fixture.mjs`（判据注入）、`dead-pid-fixture.mjs`（死进程行）。
- 需要触 `lib/index.js` 内部面时，走其末尾 `internals` 导出块（测试插槽），
  不要复制实现逻辑。
- 依赖外部载体（如真实宿主包）的文件，载体缺失时打印一行
  `⤼ SKIP: <原因>` 后以 0 退出——入口分列计数，与真 PASS 不同形；
  真宿主面由 preflight ④门的三态探针把守。
- 改动文件后先 `node --check <file>` 再跑 scoped，最后全量一次。

## 既有总口径

组织层测试的坐标与判据映射见 `docs/agents/codebase-map.md` 与
`.scratch/org-v2/spec.md` 附录 A；A 组常驻判据的测试落点以
`lib/org/acceptance-coordinates.js` 的坐标表为准（preflight ②门校验封闭）。
