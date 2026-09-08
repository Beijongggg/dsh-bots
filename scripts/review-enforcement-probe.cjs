#!/usr/bin/env node
/**
 * 编码方权限安全探针（v3 计划 P6-3；O-2/O-5 收敛后薄 CLI）——
 * scripts/review-enforcement-probe.cjs。
 * 设计权威：PLAN-expanded-engineering.md（P6-2/P6-3）；第十节 R2-11；
 * docs/TEMP-guidance-optimization-v3.2.1.md §4/§8。
 *
 * 职责（O-5 分层）：CLI parse → dispatch → emit → exit。全部守卫链、Phase 0～4、
 * 结构化错误与 scenePolicy 位于 lib/sentinel-runner.js（管线）与
 * lib/sentinel-safety.js（路径/输出/安全 helper）；布局唯一来源位于
 * lib/review-enforcement.js（SHADOW_LAYOUT_MANIFEST）。
 *
 * 用法：
 *   node scripts/review-enforcement-probe.cjs --shadow [--out <file>]
 *        [--out-profile evidence|ephemeral] [--ephemeral-out-root <abs>]
 *        [--preserve-failure-scene]
 *   node scripts/review-enforcement-probe.cjs --real-sentinel <dir> [--out <file>] [同上选项]
 *
 * 输出合同（§4.1/§4.2，两模式同一合同，由 sentinel-safety 承载）：
 *   - --out-profile evidence（默认）：--out 仅限 <repoRoot>/artifacts；
 *   - --out-profile ephemeral：显式根（保护区/仓库外、逐组件 lstat），out 在根下；
 *   - 任意 /tmp 不自动合法；无 --out 走 stdout（零目录零文件）；
 *   - 父目录不自动创建；最终写入一律 wx；最终组件必须不存在；
 *   - 检查失败不运行探针、不落盘（Phase 0 先于一切写入）。
 *
 * 阶段与 scenePolicy（§4.3/§4.4，由 sentinel-runner 承载）：
 *   Phase 0 前置校验失败：无布局写入；Phase 1 布局创建失败：回滚本轮创建项；
 *   Phase 2 探针执行失败；Phase 3 后置校验失败；Phase 4 证据输出失败（不虚报成功）。
 *   real-sentinel 失败 → preserve-for-caller；shadow 默认 auto-clean，
 *   显式 --preserve-failure-scene 才保留失败现场；shadow 顺序冻结＝创建
 *   shadowRoot → 校验 out → 探针 → payload → emit → 删场（emit 先于删场）。
 *
 * 退出码（§4.3）：0＝成功；2＝OUTPUT_CONTRACT_VIOLATION/PRECONDITION_FAILED/
 * SENTINEL_CONTRACT_VIOLATION；1＝UNEXPECTED_IO/PROBE_EXECUTION_FAILURE/
 * EVIDENCE_EMIT_FAILURE（INCONCLUSIVE 语义）。不得悄悄降级 real-sentinel 为 shadow。
 */
const { join, resolve } = require("node:path");

const USAGE = `用法：
  node scripts/review-enforcement-probe.cjs --shadow [--out <file>]
       [--out-profile evidence|ephemeral] [--ephemeral-out-root <abs>] [--preserve-failure-scene]
  node scripts/review-enforcement-probe.cjs --real-sentinel <dir> [--out <file>] [同上选项]

--shadow                     只读 shadow 探针（默认动作）：一次性临时目录内运行全套矩阵探针
--real-sentinel <dir>        在调用方自建 sentinel 副本目录内运行（需 DSH_BOTS_PROBE_REAL_AUTHORIZED=1）
--out <file>                 结果 JSON 落盘（默认 stdout；无 --out 零目录零文件）
--out-profile <p>            evidence（默认：--out 仅限 <repoRoot>/artifacts）| ephemeral
--ephemeral-out-root <abs>   ephemeral profile 的输出根（保护区外、仓库外、逐组件 lstat）
--preserve-failure-scene     shadow 失败现场保留（默认 auto-clean；real-sentinel 恒 preserve-for-caller）`;

function parseArgs(argv) {
  const args = {
    mode: "shadow", out: null, sentinelDir: null,
    outProfile: "evidence", ephemeralOutRoot: null, preserveFailureScene: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--shadow") {
      args.mode = "shadow";
    } else if (a === "--real-sentinel") {
      args.mode = "real-sentinel";
      const dir = argv[i + 1];
      if (!dir || dir.startsWith("--")) {
        console.error(USAGE);
        process.exit(2);
      }
      args.sentinelDir = dir;
      i += 1;
    } else if (a === "--out") {
      const file = argv[i + 1];
      if (!file || file.startsWith("--")) {
        console.error(USAGE);
        process.exit(2);
      }
      args.out = file;
      i += 1;
    } else if (a === "--out-profile") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        console.error(USAGE);
        process.exit(2);
      }
      args.outProfile = value;
      i += 1;
    } else if (a === "--ephemeral-out-root") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        console.error(USAGE);
        process.exit(2);
      }
      args.ephemeralOutRoot = value;
      i += 1;
    } else if (a === "--preserve-failure-scene") {
      args.preserveFailureScene = true;
    } else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`未知参数：${a}`);
      console.error(USAGE);
      process.exit(2);
    }
  }
  return args;
}

/** 结构化失败出口（§4.3）：人读行 + JSON 错误对象行 → exit(exitCode)。 */
function failWith(contextLabel, error) {
  const e = error?.probeError ?? {
    code: "UNEXPECTED_IO", phase: "2",
    details: { message: error instanceof Error ? error.message : String(error) },
    exitCode: 1, scenePolicy: "preserve-for-caller"
  };
  console.error(`[review-enforcement-probe] ${contextLabel}失败：${e.code}（phase=${e.phase}，scenePolicy=${e.scenePolicy}）—— exit ${e.exitCode}`);
  console.error(JSON.stringify(e));
  process.exit(e.exitCode);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(join(__dirname, ".."));

  // 动态 import ESM 库（本仓 package.json type=module；.cjs 脚本用 import() 加载）。
  // O-5 分层：管线＝sentinel-runner；安全/输出 helper＝sentinel-safety；布局
  // 唯一来源＝review-enforcement（SHADOW_LAYOUT_MANIFEST）。
  const [{ executeRealSentinel, executeShadow }, { emitEvidence, ProbeError }, { validateLayoutManifest, SHADOW_LAYOUT_MANIFEST }] = await Promise.all([
    import("../lib/sentinel-runner.js"),
    import("../lib/sentinel-safety.js"),
    import("../lib/review-enforcement.js")
  ]);

  // O-3：布局唯一来源校验（派生侧路径安全校验，不因来源内部而豁免）——
  // manifest 非法即任何模式都 fail closed（先于一切写入）。
  const manifestCheck = validateLayoutManifest(SHADOW_LAYOUT_MANIFEST);
  if (!manifestCheck.ok) {
    failWith("Phase 0", new ProbeError("UNEXPECTED_IO", "0", {
      message: `布局 manifest 非法（唯一来源失效）：${manifestCheck.reason}`
    }, args.mode === "real-sentinel" ? "preserve-for-caller" : "auto-clean"));
  }

  const outArgs = {
    out: args.out,
    profile: args.outProfile,
    repoRoot,
    ephemeralRoot: args.ephemeralOutRoot,
    scenePolicy: args.mode === "real-sentinel" ? "preserve-for-caller"
      : (args.preserveFailureScene ? "preserve-failure-scene" : "auto-clean")
  };
  // emit 回调：Phase 3 诊断与 Phase 4 最终输出共用同一 wx 出口。
  const emit = (payload, outAbs) => emitEvidence(payload, outAbs, { scenePolicy: outArgs.scenePolicy });

  try {
    if (args.mode === "real-sentinel") {
      executeRealSentinel({ sentinelDir: args.sentinelDir, outArgs, emit });
    } else {
      executeShadow({ outArgs, preserveFailureScene: args.preserveFailureScene, emit });
    }
    process.exit(0);
  } catch (error) {
    failWith(`Phase ${error?.probeError?.phase ?? "?"}`, error);
  }
}

main().catch((error) => {
  failWith("未捕获", error);
});
