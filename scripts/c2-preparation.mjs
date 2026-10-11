#!/usr/bin/env node
// C2 同步预备数据生成（仅预备，不执行任何同步——合同 §2/§11：C2 每批单独授权）。
// O-6.10：文件清单与 parity 单源（lib/parity-manifest.js）派生；loadMethod
// 三分类——host 静态加载／CLI 按次加载／文档证据材料（不属于 runtime load graph）。
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { PARITY_MANIFEST, verifyParityManifestEntries } from "../lib/parity-manifest.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
// 与 evidence-runner/探针同口径：DSH_HOME 显式覆盖优先，缺省回落真实 HOME/.dsh
const dshHome = resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
const deployDir = join(dshHome, "plugins", "pod");

// O-6.10：runtime 同步面 = parity 单源清单（lib＋scripts 工具面，8 文件）
// ＋ host 静态面（lib/index.js——host 内存态载体，需重启裁定项单独标注）；
// 文档/证据材料不属于 runtime load graph，单列为 evidence 材料。
const hostStaticFiles = ["lib/index.js"];
const evidenceMaterialFiles = [
  "docs/CLOSURE-p6-5-qualified-scope.md",
  "docs/TEMP-guidance-optimization-v3.2.1.md",
  "CHANGELOG.md",
  "package.json"
];
const parityEntries = verifyParityManifestEntries(PARITY_MANIFEST, repoRoot);

const loadMethodOf = (rel) => {
  if (hostStaticFiles.includes(rel)) return "host 静态加载（lib/index.js 静态导入图；同步≠内存态更新，重启须用户裁定）";
  if (PARITY_MANIFEST.includes(rel)) return "CLI 按次加载（新进程可见；host 当前调用路径不使用）";
  return "文档/证据材料（不属于 runtime load graph；无加载语义）";
};

const manifest = [
  ...parityEntries.map((e) => e.file),
  ...hostStaticFiles.filter((f) => !PARITY_MANIFEST.includes(f)),
  ...evidenceMaterialFiles
].map((rel) => {
  const abs = join(repoRoot, rel);
  const buf = readFileSync(abs);
  const dAbs = join(deployDir, rel);
  const deployExists = existsSync(dAbs);
  return {
    file: rel,
    category: PARITY_MANIFEST.includes(rel) ? "runtime（parity 单源清单成员）" : hostStaticFiles.includes(rel) ? "runtime（host 静态入口）" : "evidence-material（非 runtime）",
    repoSha256: createHash("sha256").update(buf).digest("hex"),
    repoByteLength: buf.length,
    loadMethod: loadMethodOf(rel),
    restartRequiredIfSynced: hostStaticFiles.includes(rel),
    deployPreSync: deployExists ? { exists: true, sha256: sha(dAbs), byteLength: statSync(dAbs).size } : { exists: false },
    deployPostSync: null,
    deploySideNodeCheck: null
  };
});
const parityDrift = parityEntries.filter((e) => {
  const dAbs = join(deployDir, e.file);
  return !existsSync(dAbs) || sha(dAbs) !== e.sha256;
});
const payload = {
  packageType: "c2-sync-preparation",
  status: "prepared-not-executed（合同 §2/§11：C2 每批单独授权；本文件仅为预备数据，不含任何执行）",
  schemaNote: "O-6.10：文件清单派生自 lib/parity-manifest.js 单源；loadMethod 三分类（host 静态／CLI 按次／文档证据材料）",
  generatedAt: new Date().toISOString(),
  generatedBy: "coding-side (encoder)",
  coversBatches: "O-1..O-6（C2-1..C2-4 因全程未同步而合并为一份清单预备）",
  restartNeeded: false,
  restartBasis: [
    "probe/runner/packager 为 CLI 按次加载，同步后新进程可见",
    "lib/index.js（host 静态入口）O 批次零修改、当前 hash 与 deploy 侧一致（无重启诱因）；如未来该文件漂移，restartRequiredIfSynced=true 由清单机械标注",
    "四 bot 实例重启由用户单独裁定（合同 §9）"
  ],
  paritySummary: {
    manifest: [...PARITY_MANIFEST],
    checked: parityEntries.length,
    drift: parityDrift.length,
    hashDiff: parityDrift.filter((e) => existsSync(join(deployDir, e.file))).length,
    missingInDeploy: parityDrift.filter((e) => !existsSync(join(deployDir, e.file))).length,
    identical: parityEntries.length - parityDrift.length
  },
  files: manifest,
  postSyncChecklist: [
    "deploy 侧逐文件 sha256 复核（deployPostSync 字段回填）",
    "deploy 侧 node --check（cjs/mjs 各自语法口径）",
    "真实面前后无非预期差异：~/.dsh 目录树 hash 快照前后比对（排除活进程 epoch/ledger/lease 正常写入，豁免清单见 evidence-runner PROTECTED_SNAPSHOT_EXCLUSIONS）",
    "5 进程 PID/启动时间不变断言"
  ]
};
writeFileSync(join(repoRoot, "artifacts", "c2-sync-preparation.json"), JSON.stringify(payload, null, 2) + "\n");
console.log(`[c2-prep] 已重出 artifacts/c2-sync-preparation.json（${manifest.length} 文件；parity 漂移 ${parityDrift.length}/${parityEntries.length}；仅预备未执行）`);
