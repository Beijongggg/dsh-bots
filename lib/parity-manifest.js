/**
 * parity 单源清单（v1.0 需求 O-6.10）——lib/parity-manifest.js。
 * 设计权威：O-6 证据收口批实施需求 v1.0 §O-6.10。
 *
 * 唯一清单来源：evidence-runner 与 c2-preparation 均从本清单派生；消费者不得
 * 私自增删成员。清单自身满足：唯一、相对 POSIX、非绝对、无 ..、无空段；
 * 文件 hash/byteLength 可核验（verifyParityManifestEntries）。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

/** repo↔deploy 平价清单（受控单源，双层冻结）。 */
export const PARITY_MANIFEST = Object.freeze([
  "lib/sentinel-provenance.js",
  "lib/sentinel-safety.js",
  "lib/sentinel-shadow.js",
  "lib/sentinel-runner.js",
  "lib/evidence-packager.js",
  "scripts/evidence-runner.mjs",
  "scripts/evidence-packager.mjs"
].map((p) => Object.freeze(p)));

/** 清单路径安全校验（消费者派生侧同样调用，不因来源内部而豁免）。 */
export function validateParityManifest(manifest = PARITY_MANIFEST) {
  if (!Array.isArray(manifest)) return { ok: false, reason: "manifest 必须为数组" };
  const seen = new Set();
  for (const p of manifest) {
    if (typeof p !== "string" || p === "") return { ok: false, reason: `清单项必须为非空字符串：${String(p)}` };
    if (isAbsolute(p) || p.includes("\\") || p.includes("..")) return { ok: false, reason: `清单项必须为相对 POSIX 路径且无 ..：${p}` };
    if (p.split("/").some((s) => s === "")) return { ok: false, reason: `清单项存在空段：${p}` };
    if (seen.has(p)) return { ok: false, reason: `清单项重复：${p}` };
    seen.add(p);
  }
  return { ok: true };
}

/** E4 口径：清单成员必须存在于 repo 侧且 hash/byteLength 可核验（返回逐项现状）。 */
export function verifyParityManifestEntries(manifest = PARITY_MANIFEST, repoRoot = process.cwd()) {
  const check = validateParityManifest(manifest);
  if (!check.ok) throw new Error(`parity manifest 非法：${check.reason}`);
  return manifest.map((rel) => {
    const abs = resolve(repoRoot, rel);
    if (!existsSync(abs)) return { file: rel, exists: false };
    const buf = readFileSync(abs);
    return {
      file: rel,
      exists: true,
      byteLength: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
      absolutePath: join(repoRoot, rel)
    };
  });
}
