/**
 * P-CLIENT-SLOTS 增补面（我方 client ↔ 宿主面）的**红/绿证据**重放脚本。
 *
 * 把我方 client 的三种形态喂给门内三查，打印判定：
 *   1. 修复前形态（`b5932d2:lib/client.js`＝槽名独立 `conversation` ＋ `Icon*16/14` 图标名）；
 *   2. 中间态（只修槽名与图标名、未补 `MarkdownText.labels`）；
 *   3. 当前工作树（三处全修）。
 *
 * 期望：1 三查红（槽注册＋引用面）；2 引用面红（labels 必需 props）；3 全绿。
 *
 * 用法：node .scratch/org-v2-build/attachments/18-gate-guard-2026-10-07/red-check.mjs
 * 依赖：本机安装的宿主包（`discoverPackageRoots()`）——载体缺失时脚本直接报错退出。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  checkPrimitivesReferences, discoverPackageRoots, makeClientReactStub,
  readPrimitivesExportNames, verifyClientSlotRegistrations, withDomStubs
} from "../../../../scripts/host-contract-probe.mjs";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const work = mkdtempSync(join(tmpdir(), "dsh-guard-red-"));
const PREFIX_COMMIT = "b5932d2";

/** 宿主声明树形（与安装内 layout/sidebar bundle 的声明一致；门内由真实 apply 取得，这里静态复述）。 */
const DECLARED = {
  rootChildren: {
    sidebar: { kind: "single" }, main: { kind: "keyed" }, rightbar: { kind: "single" },
    "shell.overlay": { kind: "list" }, "shell.leading": { kind: "single" }
  },
  sidebarChildren: { "sidebar.footer.action": { kind: "list" } }
};

function primitivesExportNames(roots) {
  const parsed = readPrimitivesExportNames(roots);   // 与门内同一实现（不复制扫描逻辑）
  if (!parsed) throw new Error("官方 primitives 实体包不在本机");
  return parsed.names;
}

async function loadClient(file, exportNames) {
  return withDomStubs(async () => {
    let captured = null;
    globalThis.window.__ModuleLoader__ = { load: (opts) => { captured = opts; } };
    await import(pathToFileURL(file).href + "?v=" + Date.now());
    const { react } = makeClientReactStub();
    const unknown = [];
    const primitivesStub = new Proxy({}, {
      get: (_target, key) => {
        if (!exportNames.has(String(key))) unknown.push(String(key));
        return () => ({ type: key, props: {}, children: [] });
      }
    });
    return {
      moduleExports: captured.factory((id) => (id === "react" ? react
        : id === "@deepseek-ai/dsh-client-ui-primitives" ? primitivesStub : {})),
      unknown
    };
  });
}

async function evaluate(label, file, { SlotCore, exportNames }) {
  const client = await loadClient(file, exportNames);
  const core = new SlotCore();
  core.register({ name: "root", children: DECLARED.rootChildren }, () => null);
  core.register({ name: "sidebar", children: DECLARED.sidebarChildren }, () => null);
  const verdict = await verifyClientSlotRegistrations({ core, apply: client.moduleExports.apply });
  const references = checkPrimitivesReferences(readFileSync(file, "utf8"), exportNames);
  console.log(`\n== ${label} ==`);
  console.log("槽注册查：", verdict.ok ? "PASS" : `FAIL → ${verdict.violations.join("；")}`);
  console.log("引用面查：", references.ok ? `PASS（引用 ${references.referencedNames} 名）` : `FAIL → ${references.violations.join("；")}`);
  console.log("入口实跑未导出名：", client.unknown.length > 0 ? [...new Set(client.unknown)].join("／") : "（无）");
}

const roots = discoverPackageRoots();
const { SlotCore } = await import(pathToFileURL(roots.map((root) => join(root, "dsh-client-ui-slots", "lib", "index.js")).find(existsSync)).href);
const exportNames = primitivesExportNames(roots);

try {
  // 1) 修复前形态
  const prefix = join(work, "client-prefix.js");
  writeFileSync(prefix, execFileSync("git", ["show", `${PREFIX_COMMIT}:lib/client.js`], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 }));
  // 2) 中间态：去掉 markdownLabels 函数与两处 labels 传参
  const current = readFileSync(join(repoRoot, "lib", "client.js"), "utf8");
  const start = current.indexOf("\t\tfunction markdownLabels(t) {");
  const end = current.indexOf("\n\t\t}\n", start) + "\n\t\t}\n".length;
  const mid = join(work, "client-ab-only.js");
  writeFileSync(mid, (current.slice(0, start) + current.slice(end)).replaceAll(", labels }", " }"));
  // 3) 当前工作树
  await evaluate(`修复前（${PREFIX_COMMIT}：独立 conversation 槽 ＋ Icon*16/14）`, prefix, { SlotCore, exportNames });
  await evaluate("中间态（修槽名与图标名，未补 MarkdownText.labels）", mid, { SlotCore, exportNames });
  await evaluate("当前工作树（三处全修）", join(repoRoot, "lib", "client.js"), { SlotCore, exportNames });
} finally {
  rmSync(work, { recursive: true, force: true });
}
