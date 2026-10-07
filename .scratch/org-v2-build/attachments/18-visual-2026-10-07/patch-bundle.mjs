/**
 * 把现役部署面加载的 dsh-bots 包文本里的**我方 client 模块整体替换**为工作树版本，
 * 产出仅供本会话浏览器拦截使用的「修补件」（出仓库面零写入）。
 *
 * 依据：宿主 /plugins 打包把 lib/client.js 逐字节内嵌进 `/plugins/??…` 包
 * （2026-10-07 实测：偏移 675120 处 verbatim 命中），故整块替换等价于
 * 「宿主加载修复后的 client.js」，且不依赖逐条字符串替换。
 *
 * 用法：node patch-bundle.mjs <包文本> <旧版 client 源> <新版 client 源> <输出>
 */
import { readFileSync, writeFileSync } from "node:fs";

const [bundlePath, oldPath, newPath, outPath] = process.argv.slice(2);
if (!bundlePath || !oldPath || !newPath || !outPath) {
  console.error("用法：node patch-bundle.mjs <包文本> <旧版 client 源> <新版 client 源> <输出>");
  process.exit(2);
}

const bundle = readFileSync(bundlePath, "utf8");
const oldSource = readFileSync(oldPath, "utf8");
const newSource = readFileSync(newPath, "utf8");

const first = bundle.indexOf(oldSource);
if (first === -1) {
  console.error("旧版 client 源未在包文本内 verbatim 命中（部署面与基线不一致）");
  process.exit(1);
}
if (bundle.indexOf(oldSource, first + 1) !== -1) {
  console.error("旧版 client 源在包文本内命中多次——整块替换不安全");
  process.exit(1);
}

const patched = bundle.slice(0, first) + newSource + bundle.slice(first + oldSource.length);
const checks = {
  oldSlot: patched.includes('name: "conversation", id: "dsh-bots-main"'),
  newSlot: patched.includes('name: "main", key: "conversation"'),
  oldIcon: patched.includes("primitives.IconPanelLeftOutline16"),
  newIcon: patched.includes("primitives.IconPanelLeftOutlineRegular"),
  labels: patched.includes("function markdownLabels(t)")
};
writeFileSync(outPath, patched);
console.log(JSON.stringify({ bytes: patched.length, at: first, swapped: newSource.length, checks }, null, 1));
if (checks.oldSlot || checks.oldIcon) {
  console.error("替换后仍含旧形态——检查旧版源是否为部署面版本");
  process.exit(1);
}
