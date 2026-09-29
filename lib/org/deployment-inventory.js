/** Cutover deployment bindings. Runtime code and test resources are listed separately. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const binding = (path) => {
  if (!lstatSync(path).isFile()) throw new Error(`部署路径不是普通文件：${path}`);
  const bytes = readFileSync(path);
  return { sha256: digest(bytes), byteLength: bytes.length };
};

function filesBelow(root, rel) {
  const path = join(root, rel);
  const stat = lstatSync(path);
  if (stat.isFile()) return [rel];
  if (!stat.isDirectory()) throw new Error(`部署清单不接受符号链接：${path}`);
  return readdirSync(path).sort().flatMap((name) => filesBelow(root, `${rel}/${name}`));
}

const codePaths = (root) => ["package.json", ...filesBelow(root, "lib"), ...filesBelow(root, "scripts")].sort();
const sourceBinding = (root, path) => ({ path, ...binding(join(root, path)) });

/** Captured once by each process while loading the plugin; copying files cannot refresh it. */
export function sourceCodeDigest(root) {
  return digest(JSON.stringify(codePaths(root).map((path) => sourceBinding(root, path))));
}

/** Resources cover duty-probe-failure, model-upgrade eval and the cutover smoke tests.
 * All test coordinates accompany the source spec; full preflight still runs in the repository. */
export function deploymentInventory(repoRoot, deployRoot = null) {
  const runtime = codePaths(repoRoot);
  const support = [...filesBelow(repoRoot, "tests"), ...filesBelow(repoRoot, ".scratch/org-v2")].sort();
  const paths = [...runtime, ...support];
  const files = paths.map((path) => {
    const source = binding(join(repoRoot, path));
    const destination = deployRoot === null ? null : join(deployRoot, path);
    const deployed = destination !== null && existsSync(destination) ? binding(destination) : null;
    return { path, purpose: runtime.includes(path) ? "runtime" : "test-resource", source, deployed,
      state: deployed === null ? "missing" : source.sha256 === deployed.sha256 ? "same" : "changed" };
  });
  const deploymentOnly = deployRoot === null ? [] : ["lib", "scripts", "tests", ".scratch/org-v2"]
    .flatMap((rel) => existsSync(join(deployRoot, rel)) ? filesBelow(deployRoot, rel) : [])
    .filter((path) => !paths.includes(path));
  const sourceDigest = digest(JSON.stringify(files.filter((row) => row.purpose === "runtime")
    .map(({ path, source }) => ({ path, ...source }))));
  return { ok: files.every((row) => row.state === "same") && deploymentOnly.length === 0,
    sourceDigest, files, deploymentOnly };
}
