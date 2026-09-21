/**
 * 关闭前置「验收判据现跑」的测试共用件（org-v2 25 号票）。
 *
 * 两类注入面（**别把两者混起来**——混起来＝把判据门测没了）：
 *   1. **已有夹具**（只测别的判据、判据门不是本用例的对象）：假执行面直接放行。
 *      `ACCEPTANCE_RUNNER` 对任何判据都给 `{ok: true}`——照「台账本体不直接依赖
 *      repo 路径与 mail 面」的注入缝形态，夹具显式声明「本用例的判据面已接线」。
 *   2. **判据门自身的用例**（`tests/acceptance-records.test.mjs`／烟测）：接**真件**
 *      （`lib/org/criterion-runner.js`＋`probe.js`），判据真跑；需要固定「负结论」
 *      时用 `runnerWith` 预置结论——判据与执行面的机械面（白名单、参数键逐字一致、
 *      快照摘要）由探针模块自身的用例把守（`tests/org-probe.test.mjs`，`V-A4.6`
 *      坐标），本件只把「哪一条过／哪一条不过」做成可读的用例输入，不重造探针桩。
 */

/** 判据执行面的缺省 dshHome 相对坐标（判据落在临时数据根内，不触真实运行面）。 */
export const ACCEPTANCE_FILE = "bots/knowledge/reports/R-2026-001.md";

/**
 * 一条真能跑过的验收判据：临时数据根内某个坐标含指定文本。
 * 夹具把该文件造出来即判据成立——与「任务自己产出的坐标」同形。
 */
export function passCriterion(text = "验收通过") {
  return { probe: "fs.contains", args: { location: ACCEPTANCE_FILE, text } };
}

/** 一条真跑不过的判据（坐标不存在＝probe-read 负结论）。 */
export function failCriterion(location = "bots/knowledge/reports/不存在.md") {
  return { probe: "fs.contains", args: { location, text: "随便" } };
}

/** 白名单外命令的判据（形状合法，但探针 fail closed 拒——用来测「拒也要点名」）。 */
export function offWhitelistCriterion() {
  return { probe: "shell.exec", args: { cmd: "true" } };
}

/** 假执行面：任何判据都过（已有夹具专用；判据门本身不得用）。 */
export const ACCEPTANCE_RUNNER = () => ({ ok: true, output: "夹具：判据面已接线（本用例不测判据门）", snapshotSha256: null });

/** 台账门面的注入件：`createTaskLedger({ ...criterionInjection(fn), dshHome })`。 */
export function criterionInjection(fn = ACCEPTANCE_RUNNER) {
  return { criterionRunnerFor: () => fn, criterionRunCtx: { cwd: process.cwd() } };
}

/**
 * 预置结论的执行面（判据门用例的输入侧）：返回 `{ runner, calls }`——
 * 按**执行序**取预置结论，未命中回落 `fallback`；`calls` 记录每次被执行的判据
 * （可断言「跑到第几条就短路，后面的没跑」）。
 */
export function runnerWith(byIndex, { fallback = { ok: true, snapshotSha256: null } } = {}) {
  const calls = [];
  const runner = (criterion) => {
    const index = calls.length;
    calls.push(criterion);
    return byIndex[String(index)] ?? fallback;
  };
  return { runner, calls };
}

/** 台账门面 ctx 里的执行面需要 dshHome——由台账本体补，测试侧只补 cwd。 */
export const CRITERION_CTX = Object.freeze({ cwd: process.cwd() });
