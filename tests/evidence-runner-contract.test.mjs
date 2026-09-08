/**
 * O-6.1/O-6.2/O-6.3 evidence-runner 合同回归——tests/evidence-runner-contract.test.mjs。
 * 覆盖：
 *   - O-6.1 输出根合同：evidence（approved root 限定）／ephemeral（显式根）；
 *     负例五项（DSH_HOME／部署目录／仓库代码区／symlink 路径／别名路径）＋
 *     approved 内缺失根 PRECONDITION（不自动创建）；失败先于一切产物写入
 *     （registry 零 claim、无 probe 执行、既有文件零改动）；
 *   - O-6.2 registry 责任边界：普通运行路径不自动建根（唯一建根路径
 *     --init-registry）；--init-registry 幂等且不得与其他参数混用；
 *   - O-6.3 真实运行面污染核验：snapshotProtectedSurface 只读；豁免清单生效；
 *     前后 diff 捕获新增/修改/删除/新增异常条目；扫描失败 INCONCLUSIVE。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(repoRoot, "scripts", "evidence-runner.mjs");

const {
  validateRunnerOutRoot, snapshotProtectedSurface, diffProtectedSnapshots, PROTECTED_SNAPSHOT_EXCLUSIONS
} = await import("../scripts/evidence-runner.mjs");

const results = [];
const test = (name, fn) => results.push([name, fn]);
const tmpDirs = [];
function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-o6-runner-"));
  tmpDirs.push(dir);
  return dir;
}
const home = path.resolve(process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"));
const errObj = (res) => {
  const lines = (res.stderr ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith("{")) {
      try { return JSON.parse(lines[i]); } catch { /* 继续 */ }
    }
  }
  return null;
};

// ---------------- O-6.1 输出根合同（lib 级） ----------------

test("O-6.1 evidence：approved root 内已存在根 → ok", () => {
  const r = validateRunnerOutRoot(path.join(repoRoot, "artifacts", "runs"), { profile: "evidence" });
  assert.equal(r.ok, true, r.ok ? "" : r.error.message);
});

test("O-6.1 负例①：--out-root 指向 DSH_HOME → OUTPUT_CONTRACT_VIOLATION", () => {
  const r = validateRunnerOutRoot(home, { profile: "evidence" });
  assert.equal(r.ok, false);
  assert.equal(r.error.probeError.exitCode, 2);
  assert.equal(r.error.probeError.phase, "0");
});

test("O-6.1 负例②：--out-root 指向部署目录 → 拒绝", () => {
  const r = validateRunnerOutRoot(path.join(home, "plugins", "dsh-bots"), { profile: "evidence" });
  assert.equal(r.ok, false);
});

test("O-6.1 负例③：--out-root 指向仓库代码区（lib/）→ 拒绝（approved root ≠ 仓库任意路径）", () => {
  const r = validateRunnerOutRoot(path.join(repoRoot, "lib"), { profile: "evidence" });
  assert.equal(r.ok, false);
  assert.match(r.error.probeError.details.reasons.join("；"), /approved root/);
});

test("O-6.1 负例④：--out-root 路径含 symlink 组件 → 拒绝（逐组件 lstat；ephemeral 根合法时到达该层）", () => {
  const base = mkTmp();
  const real = path.join(base, "real");
  fs.mkdirSync(real);
  fs.symlinkSync(real, path.join(base, "link"), "dir");
  const r = validateRunnerOutRoot(path.join(base, "link", "sub"), { profile: "ephemeral", ephemeralRoot: base });
  assert.equal(r.ok, false);
  assert.match(r.error.probeError.details.reasons.join("；"), /symlink/);
});

test("O-6.1 负例⑤：受保护路径的别名路径（symlink 别名指向 DSH_HOME）→ canonical 双口径拒绝", () => {
  const base = mkTmp();
  const alias = path.join(base, "dsh-alias");
  fs.symlinkSync(home, alias, "dir");
  // ephemeral 根＝别名（别名在仓库外，但 canonical 落入 DSH_HOME）
  const r = validateRunnerOutRoot(path.join(base, "sub"), { profile: "ephemeral", ephemeralRoot: alias });
  assert.equal(r.ok, false);
  assert.match(r.error.probeError.details.reasons.join("；"), /DSH_HOME/);
});

test("O-6.1 ephemeral：显式根在仓库外/保护区外且已存在 → ok；根＝DSH_HOME → 拒绝", () => {
  const base = mkTmp();
  fs.mkdirSync(path.join(base, "runs"));
  const ok = validateRunnerOutRoot(path.join(base, "runs"), { profile: "ephemeral", ephemeralRoot: base });
  assert.equal(ok.ok, true, ok.ok ? "" : ok.error.message);
  const bad = validateRunnerOutRoot(path.join(home, "runs"), { profile: "ephemeral", ephemeralRoot: home });
  assert.equal(bad.ok, false);
});

test("O-6.1 approved 内缺失根 → PRECONDITION_FAILED（不自动创建）", () => {
  const missing = path.join(repoRoot, "artifacts", "runs", ".o6-not-created");
  const r = validateRunnerOutRoot(missing, { profile: "evidence" });
  assert.equal(r.ok, false);
  assert.equal(r.error.probeError.code, "PRECONDITION_FAILED");
  assert.equal(fs.existsSync(missing), false, "校验失败不得创建目录");
});

test("O-6.1 packages 包区不得作为运行产物写面 → 拒绝（approved-root 归属规则先行拦截）", () => {
  const r = validateRunnerOutRoot(path.join(repoRoot, "artifacts", "packages"), { profile: "evidence" });
  assert.equal(r.ok, false);
  assert.equal(r.error.probeError.code, "OUTPUT_CONTRACT_VIOLATION");
  assert.match(r.error.probeError.details.reasons.join("；"), /approved root/);
});

// ---------------- O-6.1 失败先于一切产物写入（spawn 级） ----------------

test("O-6.1 spawn：非法 --out-root → exit 2 结构化错误；registry 零新增 claim；不执行 probe", () => {
  const registryDir = path.join(repoRoot, "artifacts", "run-registry");
  const claimsBefore = fs.readdirSync(registryDir).filter((n) => n.endsWith(".claim")).length;
  const res = spawnSync(process.execPath, [runner, "--out-root", "/dev/shm/o6-negative"], { encoding: "utf8" });
  assert.equal(res.status, 2);
  const e = errObj(res);
  assert.equal(e.code, "OUTPUT_CONTRACT_VIOLATION");
  assert.equal(e.phase, "0");
  assert.equal(e.exitCode, 2);
  assert.equal(e.scenePolicy, "preserve-for-caller");
  const claimsAfter = fs.readdirSync(registryDir).filter((n) => n.endsWith(".claim")).length;
  assert.equal(claimsAfter, claimsBefore, "失败不得产生 claim（先于一切产物写入）");
  assert.equal((res.stderr ?? "").includes("probe"), false, "无 probe 执行痕迹");
});

test("O-6.2 普通运行路径不自动建根：--out-root 指向不存在目录 → exit 2 且目录未创建", () => {
  const base = mkTmp();
  const target = path.join(base, "not-created");
  const res = spawnSync(process.execPath, [runner, "--out-root", target, "--out-profile", "ephemeral", "--ephemeral-out-root", base], { encoding: "utf8" });
  assert.equal(res.status, 2);
  assert.equal(fs.existsSync(target), false, "runner 不得自动创建输出根");
});

test("O-6.2 --init-registry：幂等（真实根已存在 → exit 0 零改动）；与其他参数混用 → exit 2", () => {
  const registryDir = path.join(repoRoot, "artifacts", "run-registry");
  const before = fs.readdirSync(registryDir).sort().join(",");
  const res = spawnSync(process.execPath, [runner, "--init-registry"], { encoding: "utf8" });
  assert.equal(res.status, 0, `stderr=${res.stderr}`);
  assert.equal(fs.readdirSync(registryDir).sort().join(","), before, "init 对既有根零改动（幂等）");
  const bad = spawnSync(process.execPath, [runner, "--init-registry", "--skip-tests"], { encoding: "utf8" });
  assert.equal(bad.status, 2, "init 不得与运行参数混用");
});

// ---------------- O-6.3 真实运行面污染核验（lib 级） ----------------

test("O-6.3 snapshotProtectedSurface：只读；豁免清单生效（epoch/nonces/leases/日志）", () => {
  const fakeHome = mkTmp();
  fs.mkdirSync(path.join(fakeHome, "bots", "review", "capability", "nonces"), { recursive: true });
  fs.mkdirSync(path.join(fakeHome, "bots", "review", "capabilities"), { recursive: true });
  fs.writeFileSync(path.join(fakeHome, "bots", "bots.json"), "{}");
  fs.writeFileSync(path.join(fakeHome, "bots", "review", "epoch.json"), '{"writerEpoch":1}');
  fs.writeFileSync(path.join(fakeHome, "bots", "review", "capability", "epoch.json"), "{}");
  fs.writeFileSync(path.join(fakeHome, "bots", "review", "capability", "nonces", "n.json"), "{}");
  fs.writeFileSync(path.join(fakeHome, "bots", "review", "capabilities", "lease.json"), "{}");
  fs.writeFileSync(path.join(fakeHome, "host.log"), "log");
  const before = snapshotProtectedSurface(fakeHome);
  // 真实写入（探针自身运行期不得做的事）——此处仅验证快照与豁免逻辑
  fs.writeFileSync(path.join(fakeHome, "bots", "bots.json"), "{}"); // 同内容写（无变化）
  const after = snapshotProtectedSurface(fakeHome);
  const d = diffProtectedSnapshots(before, after);
  assert.deepEqual({ m: d.modified, r: d.removed, a: d.added, i: d.addedIrregular.length }, { m: [], r: [], a: [], i: 0 }, "同内容重写与豁免路径不得计为污染");
  // 豁免面不在快照内
  const keys = Object.keys(before.files);
  assert.equal(keys.some((k) => k.includes("epoch.json") || k.includes("nonces") || k.includes("capabilities/") || k.endsWith(".log")), false, "豁免清单必须生效");
  assert.ok(keys.includes(path.join("bots", "bots.json").split(path.sep).join("/")), "非豁免文件必须入快照");
});

test("O-6.3 前后 diff：新增/修改/删除/新增 symlink 全部捕获", () => {
  const base = mkTmp();
  fs.writeFileSync(path.join(base, "a.json"), "A");
  fs.writeFileSync(path.join(base, "b.json"), "B");
  fs.writeFileSync(path.join(base, "c.json"), "C");
  const before = snapshotProtectedSurface(base);
  fs.writeFileSync(path.join(base, "a.json"), "A2");                       // 修改
  fs.writeFileSync(path.join(base, "d.json"), "D");                        // 新增
  fs.rmSync(path.join(base, "b.json"));                                    // 删除
  fs.symlinkSync("/etc", path.join(base, "link"), "dir");                  // 新增异常条目
  const after = snapshotProtectedSurface(base);
  const d = diffProtectedSnapshots(before, after);
  assert.deepEqual(d.modified, ["a.json"]);
  assert.deepEqual(d.added, ["d.json"]);
  assert.deepEqual(d.removed, ["b.json"]);
  assert.equal(d.addedIrregular.length, 1);
  assert.equal(after.irregular.some((e) => e.path === "link"), true);
  // clean 判定：任一非零即不 clean
  const clean = d.modified.length === 0 && d.removed.length === 0 && d.added.length === 0 && d.addedIrregular.length === 0;
  assert.equal(clean, false);
});

test("O-6.3 扫描失败 → ok=false（INCONCLUSIVE 依据），scanFailures 留痕", () => {
  const r = snapshotProtectedSurface(path.join(mkTmp(), "missing"));
  assert.equal(r.ok, false);
  assert.match(r.reason, /不存在/);
});

test("O-6.3 excluded 字段与实际生效的豁免清单一致（自定义豁免时不得误报默认清单）", () => {
  const base = mkTmp();
  fs.writeFileSync(path.join(base, "keep.json"), "K");
  fs.writeFileSync(path.join(base, "churn.json"), "C");
  const custom = [/^churn\.json$/];
  const snap = snapshotProtectedSurface(base, custom);
  assert.equal(Object.keys(snap.files).includes("churn.json"), false, "自定义豁免必须生效");
  assert.deepEqual(snap.excluded, ["^churn\\.json$"], "excluded 必须报告实际生效清单而非默认清单");
});

test("O-6.3 真实面快照（真实 DSH_HOME）：只读核验可运行且零 scanFailures", () => {
  const before = snapshotProtectedSurface(home);
  const after = snapshotProtectedSurface(home);
  assert.equal(before.ok, true);
  const d = diffProtectedSnapshots(before, after);
  assert.equal(d.modified.length, 0, "连续两次只读快照不得有差异");
});

// ---------------- 运行 ----------------
let failed = 0;
try {
  for (const [name, fn] of results) {
    try { await fn(); console.log("✓", name); }
    catch (error) { failed += 1; console.error("✗", name, "—", error.message); }
  }
} finally {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(failed > 0 ? 1 : 0);
