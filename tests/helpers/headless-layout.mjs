/**
 * headless 布局探针共享件（retro R1①，EV-20261011-retro-pod-impl）：用真实布局
 * 引擎（headless Chrome `--dump-dom` 回读）复算一段 HTML＋CSS 的几何与计算样式。
 * 先例：pod 批 04 号票同一几何缺陷域两轮返修（复核 B1 半宽 → 真机走查席位列
 * 0 宽），四门计数全绿而几何形制无机械守面——本件把 pod-overlay 内联探针抽为
 * 共享底座；几何形制类判据的立票规则见 docs/agents/issue-tracker.md。
 *
 * 约定：
 *  - 唯一导出 `measureBoxes(title, { bodyHtml, css, boxes, styles })`：
 *    `boxes`＝指标名→CSS 选择器（量 getBoundingClientRect 的 left/right/width），
 *    `styles`＝指标名→{ selector, prop }（读 getComputedStyle 单属性）；
 *    返回值＝两组合并＋`viewportWidth`，调用方按原指标名取用；元素不存在→该指标 null。
 *  - 本机无无头浏览器 → 返回 null：调用方按「⤼ SKIP 分列可见」跳过协议处置，
 *    **不得当绿**（pod 批 04 复核裁定：载体缺失＝跳过，纯声明级判据仍生效）。
 *  - 浏览器已跑但未回读测量 → 断言红（探针自身失效不是跳过）。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const METRICS_ID = "agent-layout-metrics";

/** 无头浏览器候选（真实布局复算的载体；缺失时调用方按跳过协议处置）。 */
function findHeadlessBrowser() {
	for (const candidate of ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

export function measureBoxes(title, { bodyHtml, css, boxes, styles = {} }) {
	const binary = findHeadlessBrowser();
	if (!binary) return null;
	const dir = mkdtempSync(join(tmpdir(), "headless-layout-"));
	try {
		const measure = `
const box = (selector) => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
const style = (selector, prop) => { const el = document.querySelector(selector); return el ? getComputedStyle(el)[prop] : null; };
const out = document.createElement("pre");
out.id = ${JSON.stringify(METRICS_ID)};
out.textContent = JSON.stringify({
  boxes: Object.fromEntries(Object.entries(${JSON.stringify(boxes)}).map(([k, sel]) => [k, box(sel)])),
  styles: Object.fromEntries(Object.entries(${JSON.stringify(styles)}).map(([k, s]) => [k, style(s.selector, s.prop)])),
  viewportWidth: window.innerWidth
});
document.body.appendChild(out);
`;
		const html = `<!doctype html><html><head><style>
body{margin:0}
${css}
</style></head><body>${bodyHtml}
<script>${measure}</script></body></html>`;
		const file = join(dir, "fixture.html");
		writeFileSync(file, html);
		const run = spawnSync(binary, [
			"--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
			`--user-data-dir=${join(dir, "profile")}`,
			"--virtual-time-budget=2000", "--dump-dom", "file://" + file
		], { encoding: "utf8", timeout: 60_000, env: { ...process.env, HOME: dir } });
		const dom = run.stdout ?? "";
		const match = dom.match(new RegExp(`<pre id="${METRICS_ID}">([\\s\\S]*?)</pre>`));
		assert.ok(match, `${title}：无头浏览器未回读几何（stderr：${(run.stderr ?? "").split("\n").slice(-2).join(" / ")}）`);
		const parsed = JSON.parse(match[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
		return { ...parsed.boxes, ...parsed.styles, viewportWidth: parsed.viewportWidth };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
