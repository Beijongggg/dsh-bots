#!/usr/bin/env node
/**
 * 编码方权限安全探针（v3 计划 P6-3）——scripts/review-enforcement-probe.cjs。
 * 设计权威：PLAN-expanded-engineering.md（P6-2 enforcement 矩阵、P6-3 探针三态；
 * 第十节 R2-11：独立探针脚本，仅 shadow 模式与受守卫的 sentinel）。
 *
 * 用法：
 *   node scripts/review-enforcement-probe.cjs --shadow [--out <file>]   # 默认动作
 *   node scripts/review-enforcement-probe.cjs --real-sentinel <dir> [--out <file>]
 *
 * 纪律（fail-closed）：
 *   - shadow 模式：只在一次性临时目录（os.tmpdir 下）运行，绝不接触真实
 *     DSH_HOME / 部署副本 / 注册表 / 其他 workspace；结束后清理并断言无探针残留；
 *   - real-sentinel 模式：P6-5 的守卫壳——必须同时满足
 *     (1) CLI 显式给出 --real-sentinel <dir>（调用方自建的 sentinel 副本目录）
 *     (2) 环境变量 DSH_BOTS_PROBE_REAL_AUTHORIZED=1（另行授权的机械门）
 *     (3) sentinel 树内任何子路径不得为 symlink/特殊文件（含 marker 与全部
 *         布局目录；运行前后两次全树快照遇非常规条目同样 fail closed）
 *     (4) 保护根（真实 DSH_HOME/部署目录/仓库根）与 sentinel 根同一 canonical
 *         口径比较＋lexical 双口径任一重叠即拒（DSH_HOME symlink 别名不可绕过）；
 *         --out 证据输出不得位于 sentinel 根内或真实运行面；路径任何已存在组件
 *         不得为 symlink，最终组件还必须不存在（排除 hardlink/覆盖写）（脚本自身
 *         写路径，先于一切写入校验）——第七轮补强
 *     (5) 五个 synthetic 布局目录必须不存在或为空（布局空前置——既有文件
 *         零覆盖：覆盖从未发生，而非事后报告）
 *     (6) 初始布局经排他创建契约建立（逐级 lstat 祖先校验 + 目标必须不存在 +
 *         wx 排他创建 + 失败回滚）；执行面＝runShadowProbeCells（纯 probe、
 *         零覆盖写——旧 runShadowProbeSuite 含覆盖型 prepare，real-sentinel
 *         禁用）；布局完整性以 bigint ino/mtimeNs 前后复核（同内容二次覆盖
 *         亦可检）；残余窗口＝单次同步写入期间的祖先换链，由创建后重走与
 *         运行后快照 fail-closed 检出（Node 用户态无 openat2，不可绝对消除
 *         ——不得宣称绝对机械保证）
 *     任一不满足 → 直接 exit 2（不得悄悄降级为 shadow）；
 *   - 探针自身失败只能是 INCONCLUSIVE；结果统一结构
 *     {botId,pid,workspaceRoot,action,result,reason,observedAt}。
 */
const { createHash } = require("node:crypto");
const {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  realpathSync, rmSync, statSync, writeFileSync
} = require("node:fs");
const { tmpdir, homedir } = require("node:os");
const { basename, dirname, join, relative, resolve, sep } = require("node:path");

const USAGE = `用法：
  node scripts/review-enforcement-probe.cjs --shadow [--out <file>]   # 默认动作
  node scripts/review-enforcement-probe.cjs --real-sentinel <dir> [--out <file>]

--shadow              只读 shadow 探针（默认动作）：一次性临时目录内运行全套矩阵探针
--real-sentinel <dir> 在调用方自建 sentinel 副本目录内运行（需 DSH_BOTS_PROBE_REAL_AUTHORIZED=1）
--out <file>          结果 JSON 落盘（默认 stdout）`;

function parseArgs(argv) {
  const args = { mode: "shadow", out: null, sentinelDir: null };
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

function emit(payload, out, { exclusive = false } = {}) {
  const text = JSON.stringify(payload, null, 2) + "\n";
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text, exclusive ? { flag: "wx", mode: 0o600 } : undefined);
  } else {
    process.stdout.write(text);
  }
}

/** 执行环境自我描述（P6-4/P6-5 证据结构化要求）：
 *  PID namespace 描述 + 宿主进程可见性样本探测（/proc/<pid> 存在性——
 *  双席争议教训：ns 比较在 /proc/1 不可读时不可靠，可见性以样本实证为准）。 */
function executionEnvironment(samplePids = []) {
  const readNs = (pid) => {
    try { return realpathSync(`/proc/${pid}/ns/pid`); } catch { return null; }
  };
  const hostProcessSample = samplePids.slice(0, 10).map((pid) => ({
    pid, visible: existsSync(`/proc/${pid}`)
  }));
  return {
    pidNamespace: readNs("self"),
    initPidNamespace: readNs("1") ?? "unreadable",
    hostProcessVisibleBySample: hostProcessSample.some((s) => s.visible),
    hostProcessSample,
    pid: process.pid,
    nodeVersion: process.version
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // 动态 import ESM 库（本仓 package.json type=module；.cjs 脚本用 import() 加载）
  const enforcement = await import("../lib/review-enforcement.js");
  const { runShadowProbeSuite, runShadowProbeCells, assertShadowClean } = enforcement;

  // ---- real-sentinel 守卫链（fail-closed；P6-5 返修：写面约束于副本内——空前置＋
  // 排他创建＋前后全树校验；残余祖先换链窗口由后置重走检出，不作绝对机械保证宣称） ----
  if (args.mode === "real-sentinel") {
    const root = resolve(args.sentinelDir);
    if (process.env.DSH_BOTS_PROBE_REAL_AUTHORIZED !== "1") {
      console.error(
        `[review-enforcement-probe] real-sentinel 未获机械授权（需要 DSH_BOTS_PROBE_REAL_AUTHORIZED=1）：拒绝执行，exit 2（root=${root}）`
      );
      process.exit(2);
    }
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      console.error(`[review-enforcement-probe] sentinel 目录不存在或不是目录：${root} —— fail closed，exit 2`);
      process.exit(2);
    }
    // 守卫 ③：根路径不得含 symlink——realpath 归一后必须与 resolve 结果一致，
    // 否则 root 可经 symlink 指向任意目录（含真实 DSH_HOME/部署目录）。
    let sentinelRoot = null;
    try { sentinelRoot = realpathSync(root); } catch { sentinelRoot = null; }
    if (sentinelRoot === null || sentinelRoot !== root) {
      console.error(`[review-enforcement-probe] sentinel 根路径含 symlink（resolve=${root}，realpath=${String(sentinelRoot)}）——fail closed，exit 2`);
      process.exit(2);
    }
    // 守卫 ④：拒绝真实运行面（DSH_HOME、部署目录、本仓库根）——双向包含均拒。
    // 第六轮返修：保护根与 sentinel 根必须同一 canonical 口径比较——lexical 的
    // DSH_HOME 若为 symlink 别名，包含关系漏判（副审复现：别名下 exit 0 且布局
    // 写入真实子树）。canonicalize＝realpath 既有祖先＋lexical 尾段（逐级回退）；
    // canonical＋lexical 双口径任一重叠即拒。
    const canonicalize = (p) => {
      let cur = resolve(p);
      const tail = [];
      for (;;) {
        try { return join(realpathSync(cur), ...tail); }
        catch {
          const parent = dirname(cur);
          if (parent === cur) return resolve(p);
          tail.unshift(basename(cur));
          cur = parent;
        }
      }
    };
    const dshHomeLexical = resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
    const deployLexical = join(dshHomeLexical, "plugins", "dsh-bots");
    const repoLexical = resolve(__dirname, "..");
    const protectedRoots = [
      { label: "真实 DSH_HOME", path: canonicalize(dshHomeLexical), lexical: dshHomeLexical },
      { label: "真实部署目录", path: canonicalize(deployLexical), lexical: deployLexical },
      { label: "本仓库根", path: canonicalize(repoLexical), lexical: repoLexical }
    ];
    const overlaps = (a, b) => a === b || a.startsWith(b + sep) || b.startsWith(a + sep);
    for (const { label, path: guarded, lexical } of protectedRoots) {
      if (overlaps(sentinelRoot, guarded) || overlaps(sentinelRoot, lexical)) {
        console.error(`[review-enforcement-probe] sentinel 根与${label}重叠（canonical=${guarded}，lexical=${lexical}）—— fail closed，exit 2`);
        process.exit(2);
      }
    }
    // 守卫 ④b：证据输出边界（第六轮返修）——--out 是脚本自身写路径，必须纳入写面
    // 契约且先于一切写入校验：不得位于 sentinel 根内（treeDiff 完成后写入会绕过
    // addedUnexpected——副审复现），不得落入真实运行面（DSH_HOME/部署目录），且
    // 路径上任何已存在组件不得是 symlink。最后组件还必须不存在，禁止 hardlink 或
    // 其他既有 inode 被 writeFileSync 截断；实际 emit 也使用 wx，拒绝检查后竞争创建
    // 的普通文件、目录、symlink 或 hardlink。symlink 检查覆盖 dangling final symlink
    // （canonicalize 只能归一化到最后一个已存在祖先，无法预知 dangling link 目标），
    // 也禁止父目录 symlink 在检查后被 writeFileSync 跟随。
    // 合法目的地＝副本外证据路径（本仓 artifacts/ 等；仓库根允许＝证据常规目的地）。
    const existingSymlinkInPath = (p) => {
      let cursor = resolve(p).startsWith(sep) ? sep : "";
      const components = resolve(p).split(sep).filter(Boolean);
      for (let index = 0; index < components.length; index += 1) {
        cursor = join(cursor, components[index]);
        try {
          const st = lstatSync(cursor);
          if (st.isSymbolicLink()) return { path: cursor, kind: "symlink" };
          if (index < components.length - 1 && !st.isDirectory()) {
            return { path: cursor, kind: "non-directory" };
          }
        } catch (error) {
          if (error?.code === "ENOENT") return null;
          return { path: cursor, kind: "unreadable" };
        }
      }
      return null;
    };
    if (args.out !== null) {
      const outLexical = resolve(args.out);
      const outCanonical = canonicalize(outLexical);
      const outViolations = [];
      const outPathIssue = existingSymlinkInPath(outLexical);
      if (outPathIssue !== null) {
        outViolations.push(`路径含${outPathIssue.kind}（${outPathIssue.path}）`);
      }
      // 最终输出组件也必须不存在：仅拒绝 symlink 仍允许 hardlink 指向受保护 inode，
      // writeFileSync 会通过 hardlink 截断真实运行面文件。排他输出要求在任何布局写入前
      // 拒绝所有已存在最终组件（普通文件、目录、symlink、hardlink 均拒）。
      try {
        const outStat = lstatSync(outLexical);
        outViolations.push(`输出目标已存在（排他创建，拒绝普通文件/目录/symlink/hardlink）：${outLexical}（mode=${outStat.mode.toString(8)}）`);
      } catch (error) {
        if (error?.code !== "ENOENT") outViolations.push(`输出目标不可检查（${outLexical}：${error.message}）`);
      }
      if (overlaps(outCanonical, sentinelRoot) || overlaps(outLexical, sentinelRoot)) {
        outViolations.push("sentinel 根内（快照后写入绕过 treeDiff）");
      }
      for (const { label, path: guarded, lexical } of protectedRoots.slice(0, 2)) {
        if (overlaps(outCanonical, guarded) || overlaps(outLexical, lexical)) outViolations.push(`${label}（真实运行面）`);
      }
      if (outViolations.length > 0) {
        console.error(`[review-enforcement-probe] --out 边界违规：${args.out}（canonical=${outCanonical}）——${outViolations.join("；")} —— fail closed，exit 2`);
        process.exit(2);
      }
    }
    // 守卫 ⑤：全树子路径 lstat 预检——sentinel 树内任何位置（含五个 synthetic
    // 布局目录、marker 本身、任意深层）出现 symlink 或非常规条目 → fail closed。
    // realpath 守卫 ③ 只覆盖根路径自身；子路径 symlink 可把探针写入引到副本外
    //（副审第三轮阻断项）。readdir+Dirent 即 lstat 语义（不跟随链接）。
    const findIrregularEntry = (base) => {
      for (const entry of readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = join(base, entry.name);
        if (entry.isSymbolicLink()) return { path: full, kind: "symlink" };
        if (!entry.isDirectory() && !entry.isFile()) return { path: full, kind: "special" };
        if (entry.isDirectory()) {
          const nested = findIrregularEntry(full);
          if (nested) return nested;
        }
      }
      return null;
    };
    const irregular = findIrregularEntry(sentinelRoot);
    if (irregular !== null) {
      console.error(`[review-enforcement-probe] sentinel 子路径含 ${irregular.kind}（${irregular.path}）——写入可逃逸副本，fail closed，exit 2`);
      process.exit(2);
    }
    // 守卫 ⑥：专用 sentinel 目录标记——调用方自建副本时写入 sentinel.marker.json
    // （{"purpose":"p6-5-sentinel"}），证明该目录为一次性专用副本而非随手指定。
    const markerFile = join(sentinelRoot, "sentinel.marker.json");
    let markerOk = false;
    try {
      markerOk = JSON.parse(readFileSync(markerFile, "utf8"))?.purpose === "p6-5-sentinel";
    } catch { markerOk = false; }
    if (!markerOk) {
      console.error(`[review-enforcement-probe] 缺专用标记 sentinel.marker.json（purpose=p6-5-sentinel）：非调用方自建专用副本，fail closed，exit 2`);
      process.exit(2);
    }
    // 守卫 ⑦：布局空前置（第四轮返修 A1）——五个 synthetic 布局目录必须不存在或为空。
    // prepareShadowTargets 的 writeFileSync 是无条件覆盖语义（副审第四轮复现：预置
    // dsh-home/bots/bots.json 会被覆盖为 {} 后 treeDiff 才报 modified）。空前置使
    // 「覆盖从未发生」成立：非空 → 在任何写入之前 exit 2，既有内容零触碰。
    const layoutDirNames = ["dsh-home", "project", "deploy-copy", "other-bot-workspaces", "system-config"];
    for (const dirName of layoutDirNames) {
      const full = join(sentinelRoot, dirName);
      if (!existsSync(full)) continue;
      let st = null;
      try { st = lstatSync(full); } catch { st = null; }
      if (st === null || !st.isDirectory() || st.isSymbolicLink()) {
        console.error(`[review-enforcement-probe] 布局路径 ${dirName}/ 非真实目录（lstat=${st === null ? "不可读" : `isDirectory=${st.isDirectory()} isSymlink=${st.isSymbolicLink()}`}）——fail closed，exit 2`);
        process.exit(2);
      }
      const existing = readdirSync(full);
      if (existing.length > 0) {
        console.error(`[review-enforcement-probe] 布局目录 ${dirName}/ 非空（${existing.length} 项：${existing.slice(0, 5).join("、")}${existing.length > 5 ? "…" : ""}）——既有文件可能被写入覆盖，fail closed，exit 2（写入前拦截，非事后报告）`);
        process.exit(2);
      }
    }
    // 守卫 ⑨：全树前后快照断言（P6-5 返修）——运行前记录 sentinel 树逐文件 hash，
    // 布局创建+probe 后重录：原有文件必须逐项不变、无删除；新增条目必须全部落在
    // shadowLayout 的 synthetic 布局目录内；任何白名单外新增/修改/删除 → exit 2
    //（检测层——既有文件零覆盖由守卫 ⑦ 空前置在写入前保证，本层为纵深防御与
    // 运行面完整性断言）。快照途中遇 symlink/特殊条目直接 fail closed。
    const snapshotTree = (base) => {
      const entries = {};
      const walk = (dir, prefix) => {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
          const full = join(dir, entry.name);
          if (entry.isDirectory()) walk(full, rel);
          else if (entry.isFile()) entries[rel] = createHash("sha256").update(readFileSync(full)).digest("hex");
          else throw new Error(`非常规条目（${entry.isSymbolicLink() ? "symlink" : "special"}）：${full}`);
        }
      };
      walk(base, "");
      return entries;
    };
    const snapshotOrFail = (label) => {
      try {
        return snapshotTree(sentinelRoot);
      } catch (error) {
        console.error(`[review-enforcement-probe] ${label}树快照发现 symlink/特殊条目：${error.message} —— fail closed，exit 2`);
        process.exit(2);
      }
    };
    // synthetic 允许列表 = prepareShadowTargets 创建的全部布局目录（含探针目标
    // dsh-home/project 与三个外沿目录）；调用方 real-copy/marker 必须前后不变。
    const syntheticPrefixes = [
      "dsh-home/", "project/", "deploy-copy/", "other-bot-workspaces/", "system-config/"
    ];
    const treeBefore = snapshotOrFail("运行前");
    // 宿主进程可见性样本：取自副本内 started/instances.jsonl 的最新实例行。
    const samplePids = [];
    try {
      const rows = readFileSync(join(sentinelRoot, "started", "instances.jsonl"), "utf8")
        .split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
      const latest = new Map();
      for (const row of rows) if (typeof row?.botId === "string") latest.set(row.botId, row);
      for (const row of latest.values()) if (Number.isInteger(row.pid)) samplePids.push(row.pid);
    } catch { /* 副本无注册表拷贝则样本为空 */ }
    // 守卫 ⑧：一次性排他创建契约（第四轮返修 A2）——real-sentinel 不用 lib 的
    // prepareShadowTargets 做初始布局（其 writeFileSync 为无条件覆盖语义）；
    // 本契约：逐级 lstat 校验祖先链（每级真实目录、非 symlink）→ 目标必须
    // lstat ENOENT → writeFileSync flag:"wx" 排他创建（最终组件为 symlink 时
    // O_CREAT|O_EXCL 同样 EEXIST 拒绝）→ 任何失败回滚本轮已创建路径 + exit 2。
    // runShadowProbeSuite 内部会再次 prepareShadowTargets：经空前置保证其写面
    // 仅含本轮 probe 自有文件，不违「既有文件不可覆盖」契约。
    const createdByGuard = [];
    // 布局完整性基线：wx 创建时逐文件记 ino+mtimeNs（bigint），执行面跑完后复核——
    // 任何移动（含同内容二次覆盖，hash 不可见）→ fail closed（第五轮返修检测层）。
    const layoutIntegrityBaseline = new Map();
    const rollbackGuard = () => {
      for (const created of createdByGuard.reverse()) {
        try { rmSync(created, { recursive: true, force: true }); } catch { /* 回滚尽力而为 */ }
      }
    };
    const guardedFail = (message) => {
      rollbackGuard();
      console.error(`[review-enforcement-probe] 排他创建失败：${message} —— 已回滚本轮创建项（${createdByGuard.length} 项），fail closed，exit 2`);
      process.exit(2);
    };
    const isRealDir = (p) => {
      try { const s = lstatSync(p); return s.isDirectory() && !s.isSymbolicLink(); } catch { return false; }
    };
    const guardedCreateFile = (target, content) => {
      const rel = relative(sentinelRoot, target);
      if (rel === "" || rel.startsWith("..")) guardedFail(`目标越出副本：${target}`);
      const parts = rel.split(sep);
      let cur = sentinelRoot;
      for (let i = 0; i < parts.length - 1; i += 1) {
        cur = join(cur, parts[i]);
        if (existsSync(cur)) {
          if (!isRealDir(cur)) guardedFail(`祖先路径非真实目录：${cur}`);
        } else {
          try { mkdirSync(cur); createdByGuard.push(cur); }
          catch (error) { guardedFail(`祖先目录创建失败 ${cur}：${error.message}`); }
        }
      }
      try {
        const st = lstatSync(target);
        guardedFail(`布局目标已存在（不可覆盖契约）：${target}（lstat=${st.isDirectory() ? "dir" : st.isSymbolicLink() ? "symlink" : "file"}）`);
      } catch (error) {
        if (error.code !== "ENOENT") guardedFail(`布局目标 lstat 异常 ${target}：${error.message}`);
      }
      try {
        writeFileSync(target, content, { flag: "wx", mode: 0o600 });
        createdByGuard.push(target);
        const st = statSync(target, { bigint: true });
        layoutIntegrityBaseline.set(rel, { ino: st.ino.toString(), mtimeNs: st.mtimeNs.toString() });
      } catch (error) {
        guardedFail(`wx 排他创建失败 ${target}：${error.message}`);
      }
    };
    // 布局清单与 lib prepareShadowTargets 的写面一一对应（内容一致）；
    // 如 lib 布局变更，本清单须同步（测试有正例树 diff 兜底）。
    const layoutFiles = [
      ["dsh-home/bots/bots.json", "{}"],
      ["dsh-home/bots/inbox/probe.txt", "probe"],
      ["dsh-home/bots/outbox/probe.txt", "probe"],
      ["dsh-home/bots/started/probe.txt", "probe"],
      ["dsh-home/profiles/probe.txt", "probe"],
      ["deploy-copy/index.js", "// deploy copy"],
      ["system-config/settings.yaml", "llm-pi-ai: {}"],
      ["other-bot-workspaces/probe.txt", "probe"],
      ["project/allowed.txt", "ok"]
    ];
    for (const [relPath, content] of layoutFiles) guardedCreateFile(join(sentinelRoot, relPath), content);
    // 创建后立即全树重走：检出创建期间祖先换链（若发生 → fail closed）。
    // 运行后的对应校验由 snapshotOrFail("运行后") 承载（快照遇非常规条目即 exit 2）。
    const irregularAfterCreate = findIrregularEntry(sentinelRoot);
    if (irregularAfterCreate !== null) {
      rollbackGuard();
      console.error(`[review-enforcement-probe] 创建后重走发现 ${irregularAfterCreate.kind}（${irregularAfterCreate.path}）——疑似祖先换链，已回滚本轮创建项（${createdByGuard.length} 项），fail closed，exit 2`);
      process.exit(2);
    }
    // 套件执行面＝runShadowProbeCells（纯 probe：零 prepare、零覆盖写）——第五轮返修：
    // 旧 runShadowProbeSuite 内部无条件调覆盖型 prepareShadowTargets，会把守卫 ⑧ wx
    // 创建的九个布局文件重写一遍（同内容覆盖 treeDiff 不可见、bigint mtimeNs 实测移动）。
    // 结构性保证：排他创建后不存在任何覆盖型写路径。
    const results = runShadowProbeCells(root, {
      botId: "coder-probe",
      workspaceRoot: join(root, "project")
    });
    const clean = assertShadowClean(root);
    // 布局完整性复核：ino/mtimeNs 逐文件比对（同内容二次覆盖亦可检）。
    const layoutIntegrityFiles = [];
    let layoutAllUnchanged = true;
    for (const [relPath, base] of layoutIntegrityBaseline) {
      const st = statSync(join(sentinelRoot, relPath), { bigint: true });
      const unchanged = st.ino.toString() === base.ino && st.mtimeNs.toString() === base.mtimeNs;
      if (!unchanged) layoutAllUnchanged = false;
      layoutIntegrityFiles.push({
        file: relPath, unchanged,
        ino: base.ino,
        mtimeNsAtCreation: base.mtimeNs,
        mtimeNsAfterExecution: st.mtimeNs.toString()
      });
    }
    const layoutIntegrity = {
      files: layoutIntegrityFiles,
      allUnchanged: layoutAllUnchanged,
      method: "bigint stat ino+mtimeNs 前后一致性（wx 创建时基线 vs 执行面跑完后复核；同内容二次覆盖亦可检）"
    };
    const treeAfter = snapshotOrFail("运行后");
    const modified = Object.keys(treeBefore).filter((k) => treeAfter[k] !== undefined && treeAfter[k] !== treeBefore[k]);
    const removed = Object.keys(treeBefore).filter((k) => treeAfter[k] === undefined);
    const added = Object.keys(treeAfter).filter((k) => treeBefore[k] === undefined);
    const addedUnexpected = added.filter((k) => !syntheticPrefixes.some((prefix) => k.startsWith(prefix)));
    const treeDiff = {
      unchanged: Object.keys(treeBefore).length - modified.length - removed.length,
      modified, removed, added,
      addedUnexpected,
      syntheticPrefixes: [...syntheticPrefixes]
    };
    const treeOk = modified.length === 0 && removed.length === 0 && addedUnexpected.length === 0;
    const payload = {
      mode: "real-sentinel",
      sentinelRoot,
      guardChain: [
        "env-authorize", "dir-exists", "no-symlink", "not-protected-root", "evidence-out-boundary",
        "no-subpath-symlink", "sentinel-marker", "layout-empty-precondition", "guarded-exclusive-create", "tree-snapshot-diff"
      ],
      writeContract: {
        protectedRootComparison: "canonical（realpath 既有祖先＋lexical 尾段）＋lexical 双口径任一重叠即拒（DSH_HOME symlink 别名不可绕过）",
        evidenceOutputBoundary: "--out 不得位于 sentinel 根内（treeDiff 后写入绕过 addedUnexpected）或真实运行面（DSH_HOME/部署目录）；路径任何已存在组件不得为 symlink（含 dangling 最终组件），最终输出组件必须不存在（拒绝普通文件/目录/hardlink 覆盖）；合法目的地＝副本外证据路径（本仓 artifacts/ 等）；校验先于一切布局写入与证据落盘", 
        layoutEmptyPrecondition: "五个 synthetic 布局目录不存在或为空（写入前拦截，非事后报告）",
        exclusiveCreate: "wx（O_CREAT|O_EXCL；最终组件为 symlink 同样 EEXIST 拒绝）",
        ancestorValidation: "逐级 lstat 祖先链（每级真实目录、非 symlink；创建后全树重走）",
        suiteExecution: "runShadowProbeCells（纯执行面：零 prepare、零覆盖写；旧 runShadowProbeSuite 含覆盖型 prepare，仅限 shadow 模式）",
        layoutIntegrityRecheck: "wx 创建时 bigint ino+mtimeNs 基线 → 执行面跑完后逐文件复核；任何移动（含同内容二次覆盖）→ exit 2",
        rollbackOnFailure: true,
        residualWindow: "单次同步写入期间的祖先目录换链——Node 用户态无 openat2/RESOLVE_BENEATH 不可绝对消除；发生后由创建后重走/运行后快照 fail-closed 检出"
      },
      clean,
      layoutIntegrity,
      treeDiff,
      executionEnvironment: executionEnvironment(samplePids),
      results,
      observedAt: new Date().toISOString(),
      note: "real-sentinel 仅在调用方自建专用副本内运行：保护根 canonical 双口径拒绝＋--out 证据输出边界（不在副本内、不在真实运行面）＋空前置＋排他创建（wx＋逐级 lstat 祖先校验＋失败回滚）＋执行面＝runShadowProbeCells（零覆盖写）＋布局完整性复核（bigint ino/mtimeNs，同内容二次覆盖亦可检）＋创建后重走＋运行前后全树快照校验；残余窗口＝同步写入期间祖先换链（不可绝对消除、由后置校验检出），不作绝对机械保证宣称。矩阵格子在 P6-5 人工验收前保持 pending"
    };
    if (!clean || !treeOk || !layoutIntegrity.allUnchanged) {
      emit(payload, args.out, { exclusive: true });
      console.error(`[review-enforcement-probe] sentinel 断言失败（clean=${clean}，treeOk=${treeOk}，layoutAllUnchanged=${layoutIntegrity.allUnchanged}）：treeDiff=${JSON.stringify(treeDiff)}；integrity=${JSON.stringify(layoutIntegrity.files.filter((f) => !f.unchanged))} —— exit 2`);
      process.exit(2);
    }
    emit(payload, args.out, { exclusive: true });
    process.exit(0);
    return;
  }

  // ---- shadow 模式（默认）：一次性临时目录，结束即清理 ----
  const shadowRoot = mkdtempSync(join(tmpdir(), "dsh-enforcement-shadow-"));
  let payload;
  try {
    const results = runShadowProbeSuite(shadowRoot, {
      botId: "coder-probe",
      workspaceRoot: join(shadowRoot, "project")
    });
    payload = {
      mode: "shadow",
      shadowRoot,
      clean: assertShadowClean(shadowRoot),
      results,
      observedAt: new Date().toISOString(),
      note: "shadow 环境写入通常畅通——ALLOWED 表示「未受阻」的真实观测；矩阵格子在 P6-3 实测前保持 pending，不得据此改写为「已实现默认拒绝」"
    };
  } finally {
    try { rmSync(shadowRoot, { recursive: true, force: true }); } catch { /* 清理失败不致命 */ }
  }
  if (!payload.clean) {
    console.error("[review-enforcement-probe] shadow 探针残留未清理干净：exit 2");
    process.exit(2);
  }
  emit(payload, args.out);
}

main().catch((error) => {
  console.error(`[review-enforcement-probe] 探针失败（只能是 INCONCLUSIVE）：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});