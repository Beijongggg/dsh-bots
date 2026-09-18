/**
 * 探针 provenance 与 run-registry（v3.2.1 合同 O-4a）——lib/sentinel-provenance.js。
 * 设计权威：docs/TEMP-guidance-optimization-v3.2.1.md §6（provenance 合同、
 * 策略 A、三层绑定、篡改检出）与 §6.1（run-registry 独立合同）。
 *
 * 三层绑定：
 *   raw.json ↓ raw hash → capture-manifest.json ↓ capture manifest hash → package
 *   （下一轮 basePackage 完整 SHA-256，由 O-4b packager 消费）。
 * raw 不包含自身 hash；artifactWriteCompletedAt 由 capture manifest 持有，
 * raw 不记录自身写入完成时间（时间顺序不变量见合同 §3）。
 *
 * 本模块为纯库：文件写入由调用方按输出合同（approved root／逐组件 lstat／wx）
 * 执行；claim/ledger 的文件语义在本模块内实现（fail-closed）。
 */
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readdirSync, readFileSync, statSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { canonicalJsonString } from "./sentinel-shadow.js";

export const PROBE_RAW_SCHEMA_VERSION = "p6-5-probe-raw/3";
/** /3：探针 CLI 绑定字段退役（probeCliHash/probeRuntimeClosure/probeScriptHash 随
 *  v1 探针薄 CLI 退役，org-v2 15 号票）；/2 为历史格式（旧 raw 只读保留）。 */
export const CAPTURE_MANIFEST_SCHEMA_VERSION = "p6-5-capture-manifest/1";
/** /2：终态记录必须携带完整绑定（runId/sourceManifestSha256/rawSha256/
 *  captureManifestSha256/status/completedAt）；/1 为历史兼容（松校验）。 */
export const RUN_LEDGER_SCHEMA_VERSION = "p6-5-run-registry/2";
const SHA256_RE = /^[0-9a-f]{64}$/;

// ---------------- 策略 A：入口脚本＋显式 lib 清单的静态源解析 ----------------

/** 单个本地源文件条目：{path（仓库相对 POSIX）, sha256, byteLength}。 */
function sourceEntryOf(absPath, repoRoot) {
  const buf = readFileSync(absPath);
  return {
    path: relative(repoRoot, absPath).split(sep).join("/"),
    sha256: createHash("sha256").update(buf).digest("hex"),
    byteLength: buf.length
  };
}

/** 按.Node 解析规则尝试本地解析（扩展名/目录 index）。全部失败返回 null。 */
function resolveLocalSpecifier(specifier, importerAbs) {
  const base = isAbsolute(specifier) ? specifier : resolve(dirname(importerAbs), specifier);
  const candidates = [base];
  if (!/\.(cjs|mjs|js|json)$/.test(base)) {
    candidates.push(`${base}.js`, `${base}.cjs`, `${base}.mjs`, `${base}.json`);
  }
  candidates.push(join(base, "index.js"), join(base, "index.cjs"), join(base, "index.mjs"));
  for (const candidate of candidates) {
    try {
      const st = lstatSync(candidate);
      if (st.isFile()) return candidate;
    } catch { /* 试下一候选 */ }
  }
  return null;
}

/** 提取模块说明符（require/import/static from/export from）＋动态 import 非字面量检测。 */
function extractSpecifiers(sourceText) {
  const specifiers = [];
  const patterns = [
    /require\(\s*["']([^"']+)["']\s*\)/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /import\s+[^;]*?from\s*["']([^"']+)["']/g,
    /export\s+[^;]*?from\s*["']([^"']+)["']/g
  ];
  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) specifiers.push(match[1]);
  }
  // 非字符串字面量的动态 import（无法静态解析）→ provenance validation failure。
  const nonLiteralDynamic = /import\s*\(\s*[^"'`)\s]/.test(sourceText);
  return { specifiers, nonLiteralDynamic };
}

/**
 * 策略 A 源清单解析（合同 §6）：入口脚本＋递归本地依赖；静态解析 import/require
 * 与字符串字面量动态 import；相对路径按 Node 规则处理；排除 node: 与
 * node_modules（裸说明符）；无法静态解析的本地动态 import → 抛
 * ProvenanceValidationError。
 */
export class ProvenanceValidationError extends Error {}

export function resolveSourceManifest(entryScript, repoRoot) {
  const entryAbs = resolve(entryScript);
  const seen = new Map();
  const queue = [entryAbs];
  let sawNonLiteralDynamic = false;
  const unresolvable = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    let text;
    try {
      text = readFileSync(current, "utf8");
    } catch (error) {
      unresolvable.push(`${relative(repoRoot, current).split(sep).join("/")}（读取失败：${error.message}）`);
      continue;
    }
    seen.set(current, sourceEntryOf(current, repoRoot));
    const { specifiers, nonLiteralDynamic } = extractSpecifiers(text);
    if (nonLiteralDynamic) sawNonLiteralDynamic = true;
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) continue;
      if (!specifier.startsWith(".") && !isAbsolute(specifier)) continue; // 裸说明符＝node_modules，排除
      const resolved = resolveLocalSpecifier(specifier, current);
      if (resolved === null) {
        unresolvable.push(`${specifier}（自 ${relative(repoRoot, current).split(sep).join("/")}）`);
        continue;
      }
      if (!resolved.startsWith(resolve(repoRoot) + sep)) {
        unresolvable.push(`${specifier}（解析越出仓库根：${resolved}）`);
        continue;
      }
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  if (sawNonLiteralDynamic || unresolvable.length > 0) {
    throw new ProvenanceValidationError(
      `provenance validation failure：${sawNonLiteralDynamic ? "存在非字符串字面量动态 import；" : ""}${unresolvable.length > 0 ? `无法静态解析的本地依赖：${unresolvable.join("；")}` : ""}`
    );
  }
  const sourceManifest = [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
  return {
    sourceManifest,
    sourceManifestSha256: createHash("sha256").update(canonicalJsonString(sourceManifest)).digest("hex")
  };
}

/**
 * O-6.5：实际执行闭包清单——runner 的模块 import 闭包 ∪ spawn 目标运行时闭包
 * ∪ 消费方脚本（packager CLI）闭包的并集。裸说明符与 node: 排除规则同策略 A；
 * 无法静态解析的本地动态 import → provenance validation failure。
 */
export function buildExecutionSourceManifest({ repoRoot, runnerScript, spawnClosures = [], consumerScripts = [] }) {
  const union = new Map();
  const addAll = (entries) => {
    for (const entry of entries) if (!union.has(entry.path)) union.set(entry.path, entry);
  };
  const roots = [
    ["runner", runnerScript],
    ...spawnClosures.map((p) => ["spawn", p]),
    ...consumerScripts.map((p) => ["consumer", p])
  ];
  const perRoot = {};
  for (const [kind, rel] of roots) {
    const { sourceManifest } = resolveSourceManifest(resolve(repoRoot, rel), repoRoot);
    perRoot[rel] = sourceManifest;
    addAll(sourceManifest);
  }
  const sourceManifest = [...union.values()].sort((a, b) => a.path.localeCompare(b.path));
  return {
    sourceManifest,
    sourceManifestSha256: createHash("sha256").update(canonicalJsonString(sourceManifest)).digest("hex"),
    perRoot
  };
}

// ---------------- raw 构建（§6／O-6.5） ----------------

/**
 * 组装 probe raw（O-6.5 schema v3）：包装 probe payload＋实际执行闭包 provenance。
 * probe 块字段语义（O-6.5）：
 *   - evidenceRunnerHash：绑定 scripts/evidence-runner.mjs（本次运行入口）；
 *   - layoutManifestSha256：布局唯一来源绑定。
 * /2 时代的 probe CLI 绑定字段（probeCliHash/probeRuntimeClosure/probeScriptHash）
 * 已随 v1 探针薄 CLI 退役（org-v2 15 号票），/3 不再产出；spawnClosures 仍接受
 * 一般 spawn 目标参与闭包并集（/3 runner 无 spawn 目标，传空）。
 * timing 字段由调用方传入实测时刻；artifactWriteCompletedAt 不得出现在 raw。
 */
export function buildProbeRaw({ runId, argv, timing, payload, repoRoot, runnerScript, spawnClosures = [], consumerScripts = [] }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId ?? "")) {
    throw new ProvenanceValidationError(`runId 必须为 UUID：${String(runId)}`);
  }
  const { sourceManifest, sourceManifestSha256 } = buildExecutionSourceManifest({ repoRoot, runnerScript, spawnClosures, consumerScripts });
  const runnerRel = relative(resolve(repoRoot), resolve(runnerScript)).split(sep).join("/");
  const runnerEntry = sourceManifest.find((e) => e.path === runnerRel);
  if (!runnerEntry) {
    throw new ProvenanceValidationError("provenance validation failure：runner 不在执行闭包清单中");
  }
  if ("artifactWriteCompletedAt" in (timing ?? {})) {
    throw new ProvenanceValidationError("raw 不得记录 artifactWriteCompletedAt（由 capture manifest 持有）");
  }
  return {
    schemaVersion: PROBE_RAW_SCHEMA_VERSION,
    runId,
    probe: {
      sourceManifest,
      sourceManifestSha256,
      evidenceRunnerHash: runnerEntry.sha256,
      // 平铺键（runner 集成面）优先；嵌套形状（tests/既有调用方）兼容——两者等值（O-6 布局绑定修复）
      layoutManifestSha256: payload?.layoutManifestDigest ?? payload?.layoutManifest?.digest ?? null
    },
    argv: [...argv],
    nodeVersion: process.version,
    timing: {
      runStartedAt: timing.runStartedAt,
      probeObservedAt: timing.probeObservedAt,
      payloadGeneratedAt: timing.payloadGeneratedAt,
      artifactWriteStartedAt: timing.artifactWriteStartedAt
    },
    payload
  };
}

/** 时间顺序不变量（§3，raw 持有段）：runStartedAt ≤ probeObservedAt ≤
 *  payloadGeneratedAt ≤ artifactWriteStartedAt。返回 {ok, violations[]}。 */
export function checkRawTimingOrder(timing) {
  const chain = ["runStartedAt", "probeObservedAt", "payloadGeneratedAt", "artifactWriteStartedAt"];
  const violations = [];
  for (let i = 1; i < chain.length; i += 1) {
    const prev = timing?.[chain[i - 1]];
    const cur = timing?.[chain[i]];
    if (typeof prev !== "string" || typeof cur !== "string") {
      violations.push(`${chain[i]} 缺失或非字符串`);
      continue;
    }
    if (Date.parse(prev) > Date.parse(cur)) violations.push(`${chain[i - 1]} > ${chain[i]}（时间顺序违反）`);
  }
  return { ok: violations.length === 0, violations };
}

/** capture manifest 构建（§6）：raw path/sha256/byteLength/mtime ＋
 *  artifactWriteCompletedAt/capturedAt。rawBytes 必须与落盘字节一致；
 *  mtime 取自落盘文件实测（仅 ±2 秒容差辅助校验用，不要求字面相等）。 */
export function buildCaptureManifest({ rawPath, rawBytes, artifactWriteCompletedAt, capturedAt }) {
  let mtime = null;
  try {
    mtime = statSync(rawPath).mtimeMs;
  } catch { /* 文件尚未落盘时由调用方保证；mtime 仅辅助校验 */ }
  return {
    schemaVersion: CAPTURE_MANIFEST_SCHEMA_VERSION,
    raw: {
      path: rawPath,
      sha256: createHash("sha256").update(rawBytes).digest("hex"),
      byteLength: rawBytes.length,
      mtime
    },
    artifactWriteCompletedAt,
    capturedAt
  };
}

// ---------------- run-registry（§6.1） ----------------

const LEDGER_TERMINAL_STATUS = Object.freeze(["completed", "failed", "abandoned"]);

function sha256OfBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * claim：run-registry/<runId>.claim——父目录必须预先存在（逐组件 lstat 由调用方
 * 输出合同保证，此处校验注册根为真实目录）；最终组件必须不存在；O_CREAT|O_EXCL
 * （wx）创建成功即永久占用：不删除、不释放、不复用；重试必须新 runId。
 * 内容写入失败（部分写入语义）→ claim 保留（可能为 invalid tombstone），
 * runId 仍被占用。返回 {ok:true, claimPath} 或 {ok:false, reason}。
 */
export function claimRun(registryDir, { runId, argv = [], sourceManifestSha256, claimedAt = null }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId ?? "")) {
    return { ok: false, reason: `runId 必须为 UUID：${String(runId)}` };
  }
  // O-6.4：claim 必须绑定完整 64 位小写 hex 的 sourceManifestSha256——
  // null/缺失/省略号/截断/大写/非 hex/长度不符一律拒绝（永久占用前拦截）。
  if (typeof sourceManifestSha256 !== "string" || !SHA256_RE.test(sourceManifestSha256)) {
    return { ok: false, reason: `sourceManifestSha256 必须为完整 64 位小写 hex（拒绝 ${JSON.stringify(sourceManifestSha256 ?? null)}）` };
  }
  let rootStat = null;
  try {
    rootStat = lstatSync(registryDir);
  } catch {
    return { ok: false, reason: `run-registry 根不存在：${registryDir}（父目录须预先存在）` };
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return { ok: false, reason: `run-registry 根不是真实目录：${registryDir}` };
  }
  const claimPath = join(registryDir, `${runId}.claim`);
  const content = JSON.stringify({
    runId,
    claimedAt: claimedAt ?? new Date().toISOString(),
    pid: process.pid,
    argv: [...argv],
    sourceManifestSha256,
    status: "claimed"
  }, null, 2) + "\n";
  let fd;
  try {
    fd = openSync(claimPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      return { ok: false, reason: `runId 已被占用（claim 永久占用，重试必须新 runId）：${runId}` };
    }
    return { ok: false, reason: `claim 创建失败：${error.message}` };
  }
  // claim 创建成功＝永久占用；内容写入失败不回滚（部分写入语义）。
  let writeError = null;
  try {
    let written = 0;
    while (written < content.length) written += writeSync(fd, content, written);
    fsyncSync(fd);
  } catch (error) {
    writeError = error;
  } finally {
    closeSync(fd);
  }
  return { ok: true, claimPath, contentWriteError: writeError === null ? null : writeError.message };
}

/**
 * ledger：run-registry.jsonl——允许既有；必须为真实普通文件（拒绝 symlink、
 * 目录、危险 hardlink nlink>1）；以 O_APPEND 打开；禁止 truncate；每条记录
 * 单次追加（单 write 系统调用）；按 durability 合同 fsync。不得因 ledger 已存在
 * 而使用 wx 拒绝后续记录。
 * O-6.4：/2 终态记录必须携带完整绑定 {runId, sourceManifestSha256, rawSha256,
 * captureManifestSha256, status(终态), completedAt}——缺项即抛（不写残缺记录）。
 */
export function appendRunLedger(registryDir, record) {
  const required = ["runId", "sourceManifestSha256", "rawSha256", "captureManifestSha256", "status", "completedAt"];
  for (const key of required) {
    if (record?.[key] === undefined || record?.[key] === null) {
      throw new Error(`ledger /2 终态记录缺绑定字段 ${key}（O-6.4：不得写残缺终态）`);
    }
  }
  if (!SHA256_RE.test(String(record.sourceManifestSha256)) || !SHA256_RE.test(String(record.rawSha256)) || !SHA256_RE.test(String(record.captureManifestSha256))) {
    throw new Error("ledger /2 终态记录绑定 hash 必须为完整 64 位小写 hex");
  }
  if (!LEDGER_TERMINAL_STATUS.includes(record.status)) {
    throw new Error(`ledger /2 终态记录 status 非法：${String(record.status)}`);
  }
  const ledgerPath = join(registryDir, "run-registry.jsonl");
  let st = null;
  try {
    st = lstatSync(ledgerPath);
  } catch { /* 尚不存在 → 创建 */ }
  if (st !== null) {
    if (st.isSymbolicLink()) throw new Error(`ledger 为 symlink，拒绝：${ledgerPath}`);
    if (!st.isFile()) throw new Error(`ledger 不是普通文件，拒绝：${ledgerPath}`);
    if (st.nlink > 1) throw new Error(`ledger 为危险 hardlink（nlink=${st.nlink}），拒绝：${ledgerPath}`);
  }
  const line = JSON.stringify({ schemaVersion: RUN_LEDGER_SCHEMA_VERSION, ...record }) + "\n";
  let fd;
  try {
    fd = openSync(ledgerPath, st === null ? "wx" : "a", 0o600);
  } catch (error) {
    // 并发创建竞态：多个进程同时见 st===null 时，仅一者 wx 成功；
    // EEXIST 者必须回退到 O_APPEND 追加（不得因竞态拒绝合法追加）。
    if (st === null && error?.code === "EEXIST") {
      const raced = lstatSync(ledgerPath);
      if (raced.isSymbolicLink() || !raced.isFile() || raced.nlink > 1) {
        throw new Error(`ledger 竞态创建后发现非普通文件，拒绝：${ledgerPath}`);
      }
      try {
        fd = openSync(ledgerPath, "a", 0o600);
      } catch (retryError) {
        throw new Error(`ledger 打开失败（竞态回退）：${retryError.message}`);
      }
    } else {
      throw new Error(`ledger 打开失败：${error.message}`);
    }
  }
  try {
    // 单条记录＝单次 write 系统调用（O_APPEND 保证追加位一致）；部分写即失败。
    const written = writeSync(fd, line);
    if (written !== Buffer.byteLength(line)) throw new Error(`ledger 记录部分写入（${written}/${Buffer.byteLength(line)}）——记录不完整`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return ledgerPath;
}

/**
 * 校验器：claim 与 ledger 交叉核验（§6.1）。
 *   - claim 内容空/截断/非法 JSON/字段缺失 → invalid tombstone（claim 保留）；
 *   - claim 无终态 ledger 记录 → status=running/abandoned/registry-incomplete，
 *     不得判成功；
 *   - ledger 最多一个损坏尾行（显式标记 incomplete）；中间损坏 → 校验失败，
 *     不得静默忽略；
 *   - runId 重复（ledger 内）或 ledger 记录无对应 claim → 校验失败。
 */
export function validateRunRegistry(registryDir, { now = new Date().toISOString() } = {}) {
  const problems = [];
  let names = [];
  try {
    names = readdirSync(registryDir);
  } catch (error) {
    return { ok: false, problems: [`run-registry 根不可读：${error.message}`], incompleteTail: false, runs: [] };
  }
  const claimMap = new Map();
  for (const name of names) {
    const match = name.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.claim$/i);
    if (!match) continue;
    const runId = match[1].toLowerCase();
    const claimPath = join(registryDir, name);
    const entry = { runId, claimPath, status: "invalid", content: null, reason: null };
    try {
      const raw = readFileSync(claimPath, "utf8");
      if (raw.trim() === "") {
        entry.reason = "空内容（invalid tombstone）";
      } else {
        const parsed = JSON.parse(raw);
        if (parsed?.runId !== runId || typeof parsed?.claimedAt !== "string" || parsed?.status !== "claimed") {
          entry.reason = "claim 内容字段缺失或不一致（invalid tombstone）";
        } else {
          entry.status = "claimed";
          entry.content = parsed;
        }
      }
    } catch (error) {
      entry.reason = `claim 不可读/非法 JSON：${error.message}`;
    }
    claimMap.set(runId, entry);
  }
  // ledger 解析
  const ledgerPath = join(registryDir, "run-registry.jsonl");
  const records = [];
  let incompleteTail = false;
  if (existsSync(ledgerPath)) {
    const st = lstatSync(ledgerPath);
    if (st.isSymbolicLink() || !st.isFile()) {
      problems.push(`ledger 非普通文件：${ledgerPath}`);
    } else if (st.nlink > 1) {
      problems.push(`ledger 为危险 hardlink（nlink=${st.nlink}）：${ledgerPath}`);
    } else {
      const text = readFileSync(ledgerPath, "utf8");
      const lines = text.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();
      lines.forEach((line, index) => {
        if (line.trim() === "") {
          if (index === lines.length - 1) incompleteTail = true;
          else problems.push(`ledger 中间空行（第 ${index + 1} 行）`);
          return;
        }
        let parsed = null;
        try {
          parsed = JSON.parse(line);
        } catch {
          if (index === lines.length - 1) incompleteTail = true;
          else problems.push(`ledger 中间损坏记录（第 ${index + 1} 行），不得静默忽略`);
          return;
        }
        records.push(parsed);
      });
    }
  }
  const seenRunIds = new Set();
  for (const [index, record] of records.entries()) {
    const runId = typeof record?.runId === "string" ? record.runId.toLowerCase() : null;
    if (!runId || !/^[0-9a-f-]{36}$/.test(runId)) {
      problems.push(`ledger 第 ${index + 1} 条 runId 非法`);
      continue;
    }
    if (seenRunIds.has(runId)) problems.push(`ledger runId 重复：${runId}（第 ${index + 1} 条）`);
    seenRunIds.add(runId);
    if (!LEDGER_TERMINAL_STATUS.includes(record?.status)) {
      problems.push(`ledger 第 ${index + 1} 条 status 非终态：${String(record?.status)}`);
    }
    if (!claimMap.has(runId)) problems.push(`ledger 第 ${index + 1} 条无对应 claim（runId=${runId}）——流程违约`);
    // O-6.4：/2 记录强制完整绑定；/1 为历史兼容记录（legacy 标注，不溯及）。
    if (record?.schemaVersion === "p6-5-run-registry/2") {
      for (const key of ["sourceManifestSha256", "rawSha256", "captureManifestSha256"]) {
        if (!SHA256_RE.test(String(record?.[key] ?? ""))) {
          problems.push(`ledger 第 ${index + 1} 条（/2）绑定字段 ${key} 非完整 64 位小写 hex`);
        }
      }
      if (typeof record?.completedAt !== "string") {
        problems.push(`ledger 第 ${index + 1} 条（/2）缺 completedAt`);
      }
    }
  }
  const runs = [];
  for (const [runId, claim] of claimMap) {
    if (claim.status !== "claimed") {
      runs.push({ runId, status: "invalid", reason: claim.reason, claimRetained: true });
      continue;
    }
    if (seenRunIds.has(runId)) {
      runs.push({ runId, status: "complete", claimRetained: true });
    } else {
      const ageMs = Date.parse(now) - Date.parse(claim.content.claimedAt);
      const status = Number.isFinite(ageMs) && ageMs > 60_000 ? "abandoned" : "running";
      runs.push({ runId, status, reason: "claim 无终态 ledger 记录——不得判成功", claimRetained: true, ageMs });
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    incompleteTail,
    runs: runs.sort((a, b) => a.runId.localeCompare(b.runId))
  };
}
