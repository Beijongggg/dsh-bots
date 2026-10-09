/**
 * 回归：L3 专用行——bash／文件改动 diff／read／search（pod 08 号票
 * [[08-tool-rows-specialized]]；判据坐标＝规格附录 A 的 `V-P5.6`（四类专用行齐备＋
 * 未识别工具回落通用行、无空白行／裸 JSON）与 `V-P5.7`（形状与官方同源：图标走官方
 * primitives 变体名、字号与令牌口径一致、无第二套视觉语言），判据号写进用例名）。
 *
 * 被测面＝`lib/client.js` 渲染层的**专用行分派与专用体**：
 *   - 分派：工具名 → 行类型（`TOOL_ROW_KINDS`／`toolRowKindOf`）；
 *   - 专用体：`ToolTerminalBlock`（终端形制）／`ToolDiffBlock`（diff 视图）／
 *     `ToolReadBlock`（行号窗口）／`ToolSearchBlock`（命中分组／路径列表）；
 *   - 缺口：未识别工具（含 `read_image`／`web_search` 等不在四类内的官方变体名）
 *     回落 07 的通用 IO 段，不得空白行或裸 JSON。
 *
 * 手法与 `tests/pod-tool-rows.test.mjs` 同源：捕获式 loader ＋无 DOM 迷你渲染器
 * （位置路径 hook 槽，支持嵌套组件展开态与数组型 children）。
 * 数据面契约（票 06 冻结，逐字依赖）：`record = { seq, time, callId, parentCallId?,
 * name, argsRaw, state, outputText?, isError, errorText?, turn, step, subCalls[] }`。
 *
 * 形制来源（官方 0.2.0-rc.1）：`dsh-client-ui-primitives` 的 `TerminalBlock`／
 * `DiffBlock`／`ReadBlock`／`SearchBlock` 与 `dsh-client-ui-tool` 的 `ToolRow` 分派
 * （见 `.tmp/pod-ctx/codebase-notes.md` §3.7）；官方组件本体不可复用，按形制用
 * 官方令牌复刻（字号／间距／着色口径逐项对齐）。
 */
import assert from "node:assert/strict";

// ---------- 装载：捕获型 loader（官方 client bundle 装载协议同形） ----------
let captured = null;
globalThis.window = {
	__ModuleLoader__: {
		load: (opts) => { captured = opts; }
	}
};
await import("../lib/client.js");

// ---------- 迷你渲染器（无 DOM）：函数组件调用＋useState 槽＋子树展开 ----------
function createMiniReact() {
	let current = null;
	let uidSeq = 0;
	const slots = new Map();
	const flatten = (list) => {
		const out = [];
		for (const item of list) {
			if (Array.isArray(item)) out.push(...flatten(item));
			else out.push(item);
		}
		return out;
	};
	const expand = (node, path) => {
		if (node === null || node === undefined || typeof node === "boolean") return null;
		if (Array.isArray(node)) {
			const out = [];
			node.forEach((child, index) => {
				const expanded = expand(child, path + "/" + index);
				if (expanded !== null) out.push(expanded);
			});
			return out;
		}
		if (typeof node !== "object") return node;
		if (typeof node.type === "function") {
			const previous = current;
			current = { path, cursor: 0 };
			const componentProps = node.children.length > 0
				? { ...node.props, children: node.children }
				: node.props;
			let out;
			try { out = node.type(componentProps); } finally { current = previous; }
			return expand(out, path);
		}
		return {
			type: node.type,
			props: node.props || {},
			children: flatten(node.children || [])
				.map((child, index) => expand(child, path + "/" + index))
				.filter((child) => child !== null)
		};
	};
	let renderTree = () => {};
	const react = {
		createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
		Fragment: Symbol("Fragment"),
		memo: (fn) => fn,
		useState(initial) {
			if (!slots.has(current.path)) slots.set(current.path, []);
			const hooks = slots.get(current.path);
			const at = current.cursor;
			current.cursor = at + 1;
			if (!(at in hooks)) hooks[at] = typeof initial === "function" ? initial() : initial;
			return [hooks[at], (next) => {
				hooks[at] = typeof next === "function" ? next(hooks[at]) : next;
				renderTree();
			}];
		},
		useMemo: (fn) => fn(),
		useRef: (value) => ({ current: value }),
		useEffect: () => {},
		useLayoutEffect: () => {},
		useId() {
			if (!slots.has(current.path + "#id")) slots.set(current.path + "#id", ["test-body-" + (uidSeq++)]);
			return slots.get(current.path + "#id")[0];
		},
		useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot()
	};
	return {
		react,
		mount(component, props) {
			slots.clear();
			const view = { tree: null };
			view.render = () => {
				const previous = current;
				current = { path: "root", cursor: 0 };
				let out;
				try { out = component(props); } finally { current = previous; }
				view.tree = expand(out, "root");
			};
			renderTree = view.render;
			view.render();
			return view;
		}
	};
}

const harness = createMiniReact();
const primitivesStub = new Proxy({}, {
	get: (_target, key) => (props) => ({ type: String(key), props: props || {}, children: [] })
});
const mod = captured.factory((id) => {
	if (id === "react") return harness.react;
	if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitivesStub;
	throw new Error("unexpected require: " + id);
});
const h = harness.react.createElement;

// ---------- 树走查助手 ----------
const walk = (node, fn) => {
	if (node === null || typeof node !== "object") return;
	fn(node);
	for (const child of node.children || []) walk(child, fn);
};
const findAll = (tree, predicate) => {
	const hits = [];
	for (const node of Array.isArray(tree) ? tree : [tree]) walk(node, (n) => { if (predicate(n)) hits.push(n); });
	return hits;
};
const findOne = (tree, predicate) => findAll(tree, predicate)[0] || null;
const hasClass = (node, cls) =>
	!!node && typeof node.props.className === "string" && node.props.className.split(/\s+/).includes(cls);
const byClass = (tree, cls) => findOne(tree, (node) => hasClass(node, cls));
const allByClass = (tree, cls) => findAll(tree, (node) => hasClass(node, cls));
const buttonsOf = (tree) => findAll(tree, (node) => node.type === "button");
const sectionsOf = (tree, cls) => findAll(tree, (node) => node.type === "section" && hasClass(node, cls));
const textOf = (node) => {
	if (node === null || node === undefined) return "";
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (typeof node !== "object") return String(node);
	return (node.children || []).map(textOf).join("");
};
const hiddenTextOf = (tree) => findAll(tree, (node) => hasClass(node, "dsh-bots-tool-sr")).map(textOf).join(" ");

// ---------- 夹具：票 06 记录形状 ----------
let seqCounter = 0;
const rec = (over = {}) => {
	seqCounter += 1;
	const out = {
		seq: over.seq ?? seqCounter,
		time: over.time ?? Date.parse("2026-10-09T06:00:00.000Z"),
		callId: over.callId ?? "c" + seqCounter,
		name: over.name ?? "bash",
		argsRaw: over.argsRaw ?? JSON.stringify({ description: "跑一下", command: "ls" }),
		state: over.state ?? "preparing",
		isError: over.isError ?? false,
		turn: over.turn ?? 1,
		step: over.step ?? 1,
		subCalls: over.subCalls ?? []
	};
	if (over.parentCallId !== undefined) out.parentCallId = over.parentCallId;
	if (over.outputText !== undefined) out.outputText = over.outputText;
	if (over.errorText !== undefined) out.errorText = over.errorText;
	return out;
};
const settled = (over = {}) => rec({ state: "ok", ...over });
/** 展开某棵树里第 n 个折叠头（默认第一个）。 */
const toggleHead = (tree, index = 0) => {
	const buttons = buttonsOf(tree);
	assert.ok(buttons[index], "树里缺第 " + index + " 个折叠头按钮");
	buttons[index].props.onClick();
};
/** 行根（`section.dsh-bots-tool-row`）快照：变体／工具名／状态三元组。 */
const rowSnapshot = (tree) => sectionsOf(tree, "dsh-bots-tool-row")
	.map((n) => n.props["data-tool"] + ":" + n.props["data-variant"] + ":" + n.props["data-state"]);

/** 挂载一条工具行并展开其披露体（默认展开根行自身）。 */
const mountRowExpanded = (record, t = (key, params) => (params ? key + ":" + params.n : key)) => {
	const view = harness.mount(mod.ToolRow, { record, t });
	toggleHead(view.tree, 0);
	return { view, body: byClass(view.tree, "dsh-bots-disclosure-body") };
};

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ═══════════════════════════════════════════════════════════════════════
// V-P5.6 分派：工具名 → 行类型
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.6 分派：bash／pwsh→terminal、write／edit→diff、read→read、grep／glob→search，其余回落 generic", () => {
	assert.equal(typeof mod.toolRowKindOf, "function", "导出面缺 toolRowKindOf");
	assert.equal(mod.toolRowKindOf("bash"), "terminal");
	assert.equal(mod.toolRowKindOf("pwsh"), "terminal");
	assert.equal(mod.toolRowKindOf("write"), "diff");
	assert.equal(mod.toolRowKindOf("edit"), "diff");
	assert.equal(mod.toolRowKindOf("read"), "read");
	assert.equal(mod.toolRowKindOf("grep"), "search");
	assert.equal(mod.toolRowKindOf("glob"), "search");
	// 不在四类内的官方变体名与未知工具一律回落（不得硬套专用形制）
	for (const name of ["read_image", "web_fetch", "web_search", "run_code", "todo_write", "some_unknown_tool_xyz", ""]) {
		assert.equal(mod.toolRowKindOf(name), "generic", "非四类工具须回落通用行：" + name);
	}
	assert.deepEqual(Object.keys(mod.TOOL_ROW_KINDS).sort(),
		["bash", "edit", "glob", "grep", "pwsh", "read", "write"], "分派表＝四类七名（形状冻结）");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.6 ① bash 行：命令摘要＋终端形制输出体
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.6 bash 行：命令摘要＋终端形制输出体（prompt 横幅＋输出区，投影快照）", () => {
	const record = settled({
		name: "bash",
		argsRaw: JSON.stringify({ description: "列目录", command: "ls -la" }),
		outputText: "total 12\ndrwxr-xr-x  3 user user",
		state: "ok"
	});
	const { view, body } = mountRowExpanded(record);
	assert.deepEqual(rowSnapshot(view.tree), ["bash:bash:ok"], "行根形状（工具名／变体／状态）不变");
	assert.ok(body, "bash 行须可展开");
	const term = byClass(body, "dsh-bots-tool-term");
	assert.ok(term, "bash 专用体须是终端形制");
	assert.equal(term.props["data-terminal"], true, "终端形制标记（官方同形）");
	// 命令横幅：prompt ＋ 命令原文
	const banner = byClass(term, "dsh-bots-tool-term-banner");
	assert.ok(banner, "终端形制须有命令横幅");
	assert.equal(textOf(byClass(banner, "dsh-bots-tool-term-prompt")), "$", "横幅 prompt 标记");
	assert.equal(textOf(byClass(banner, "dsh-bots-tool-term-command")), "ls -la", "横幅＝args.command 原文");
	// 输出区：原样文本
	const output = byClass(term, "dsh-bots-tool-term-output");
	assert.ok(output, "终端形制须有输出区");
	assert.ok(textOf(output).includes("drwxr-xr-x"), "输出体＝outputText 原样");
	// 专用体不吃通用 IO 段（同一行不得两套形状）
	assert.equal(byClass(term, "dsh-bots-tool-io"), null, "专用行不得再叠通用 IO 段");
	assert.equal(byClass(term, "dsh-bots-tool-input"), null);
	// 命令摘要仍在行头（description 优先，与官方 SUMMARY_KEYS 一致）
	const head = findOne(view.tree, (node) => node.type === "button");
	assert.ok(textOf(byClass(head, "dsh-bots-disclosure-meta")).includes("列目录"), "行头摘要不变");
});

test("V-P5.6 bash 行：running 无输出＝命令横幅＋「无输出」占位（不得空白）；无 command 的 bash 回落通用段", () => {
	// running：命令已下发、输出未到 → 占位文案，不得留白
	const running = rec({
		name: "bash",
		argsRaw: JSON.stringify({ command: "sleep 3" }),
		state: "running"
	});
	const open = mountRowExpanded(running);
	const term = byClass(open.body, "dsh-bots-tool-term");
	assert.ok(term, "running 的 bash 行仍是终端形制");
	const output = byClass(term, "dsh-bots-tool-term-output");
	assert.equal(textOf(output), "tool.noOutput", "无输出时给占位文案（走 locale 键）");
	assert.equal(output.props["data-empty"], true, "占位态有标记（样式走 label-tertiary）");
	// 无 command 可取（args 不可解析）→ 终端形制无从成立，回落通用 IO 段（仍有参数体，不得空白）
	const noCommand = settled({ name: "bash", argsRaw: "not-json-args", outputText: "boom" });
	const fallback = mountRowExpanded(noCommand);
	assert.equal(byClass(fallback.body, "dsh-bots-tool-term"), null, "无 command 不得渲染空终端");
	const io = byClass(fallback.body, "dsh-bots-tool-io");
	assert.ok(io, "无 command 的 bash 行回落通用 IO 段");
	assert.ok(textOf(io).includes("not-json-args"), "参数体仍原样可见（不得空白行）");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.7 样式：终端形制口径
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.7 终端形制样式：令牌化底色／边框／字数口径（官方 TerminalBlock＋官方工具行 224px 输出上限）", () => {
	const cssText = mod.toolRowCss;
	assert.match(cssText, /\.dsh-bots-tool-term\{[^}]*background:var\(--dsw-alias-markdown-code-block\)/, "终端体底色走官方代码块令牌");
	assert.match(cssText, /\.dsh-bots-tool-term\{[^}]*border:\.5px solid var\(--dsw-alias-border-l1\)/, "终端体边框 .5px l1（官方 terminalBody 口径）");
	assert.match(cssText, /\.dsh-bots-tool-term\{[^}]*font:var\(--dsw-font-markdown-code-block-small\)/, "终端字号＝官方 code block small");
	assert.match(cssText, /\.dsh-bots-tool-term-banner\{[^}]*background:var\(--dsw-alias-markdown-code-block-banner\)/, "横幅底色走官方 banner 令牌");
	assert.match(cssText, /\.dsh-bots-tool-term-banner\{[^}]*border-bottom:\.5px solid var\(--dsw-alias-border-l2\)/, "横幅与输出区之间 l2 分隔线（官方口径）");
	assert.match(cssText, /\.dsh-bots-tool-term-output\{[^}]*max-height:224px/, "输出区限高 224px（官方 --dsl-terminal-output-max-height）");
	assert.match(cssText, /\.dsh-bots-tool-term-output\{[^}]*overflow:auto/, "输出区可滚动");
	assert.match(cssText, /\.dsh-bots-tool-term-prompt\{[^}]*color:var\(--dsw-alias-label-tertiary\)/, "prompt 走 tertiary");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.6 ② 文件改动行：diff 视图
// ═══════════════════════════════════════════════════════════════════════
/** diff 行分类（类名后缀解析，避免依赖行文本形状）。 */
const diffKindOf = (node) => {
	const cls = (node.props.className || "").split(/\s+/).find((one) => one.startsWith("dsh-bots-tool-diff-") && one !== "dsh-bots-tool-diff-line");
	return cls ? cls.slice("dsh-bots-tool-diff-".length) : "";
};

test("V-P5.6 文件改动行：diff 视图＝路径行＋上下文／删除／新增行（投影快照）；行头带 +/- 统计", () => {
	const record = settled({
		name: "edit",
		argsRaw: JSON.stringify({
			file_path: "lib/client.js",
			old_string: "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;",
			new_string: "const a = 1;\nconst b = 2;\nconst B = 22;\nconst c = 3;\nconst d = 4;"
		}),
		state: "ok",
		outputText: "The file lib/client.js has been updated successfully."
	});
	const { view, body } = mountRowExpanded(record);
	const head = findOne(view.tree, (node) => node.type === "button");
	assert.ok(textOf(head).includes("lib/client.js"), "路径摘要（args.file_path）在行头");
	assert.ok(textOf(byClass(head, "dsh-bots-tool-diffstat")).includes("+1 -0"), "行头带 +新增 -删除 统计（官方 diffStat 口径）");
	const diff = byClass(body, "dsh-bots-tool-diff");
	assert.ok(diff, "文件改动专用体须是 diff 视图");
	assert.equal(diff.props["data-diff"], true, "diff 视图标记（官方同形）");
	const lines = allByClass(diff, "dsh-bots-tool-diff-line");
	assert.deepEqual(lines.map(diffKindOf), ["path", "context", "context", "add", "context", "context"],
		"diff 行分类快照：路径行＋公共前后缀作上下文（至多 3 行）＋中段新增");
	assert.equal(textOf(lines[0]), "lib/client.js", "路径行＝args.file_path");
	assert.equal(textOf(lines[3]), "const B = 22;", "新增行正文＝新文本行（前缀由 CSS ::before 画）");
	// 专用体不吃通用 IO 段（同一行不得两套形状）
	assert.equal(byClass(diff, "dsh-bots-tool-io"), null, "diff 行不得再叠通用 IO 段");
});

test("V-P5.6 文件改动行：write＝整文新增（无 old 侧）；超限折叠中段可展开（官方 head/tail 口径）", () => {
	// write：新建／整体覆写 → 全部作新增行
	const write = settled({
		name: "write",
		argsRaw: JSON.stringify({ file_path: "docs/new.md", content: "第一行\n第二行\n第三行" }),
		outputText: "<path>docs/new.md</path>\n<type>file</type>\n<content>\nCreated file\n</content>"
	});
	const written = mountRowExpanded(write);
	const writeLines = allByClass(written.body, "dsh-bots-tool-diff-line");
	assert.deepEqual(writeLines.map(diffKindOf), ["path", "add", "add", "add"], "write 全文＝新增行");
	assert.equal(textOf(writeLines[1]), "第一行");
	assert.ok(textOf(byClass(written.view.tree, "dsh-bots-tool-diffstat")).includes("+3 -0"));

	// 超限折叠：21 行（1 路径＋20 新增）→ 默认 9 行（head 5＋tail 4）＋折叠开关
	const longWrite = settled({
		name: "write",
		argsRaw: JSON.stringify({ file_path: "big.txt", content: Array.from({ length: 20 }, (_, i) => "L" + (i + 1)).join("\n") }),
		state: "ok"
	});
	const folded = mountRowExpanded(longWrite);
	assert.equal(allByClass(folded.body, "dsh-bots-tool-diff-line").length, 9, "默认折叠到 9 行（官方 diff maxLines）");
	const fold = byClass(folded.body, "dsh-bots-tool-fold");
	assert.ok(fold, "超限须有折叠开关");
	assert.equal(fold.type, "button", "折叠开关是原生 button（键盘可达）");
	assert.equal(fold.props["aria-expanded"], false);
	assert.equal(textOf(fold), "tool.foldExpand:12", "折叠文案带隐藏行数（走 locale 键）");
	fold.props.onClick();
	// 重渲染后重新取节点（不能拿旧树上的引用）
	assert.equal(allByClass(folded.view.tree, "dsh-bots-tool-diff-line").length, 21, "展开后全量呈现");
	assert.equal(textOf(byClass(folded.view.tree, "dsh-bots-tool-fold")), "tool.foldCollapse");

	// 无 diff 可取（无 old_string／new_string）→ 回落通用 IO 段（不得空 diff）
	const noArgs = settled({ name: "edit", argsRaw: JSON.stringify({ file_path: "x.md" }), outputText: "The file x.md has been updated successfully." });
	const fallback = mountRowExpanded(noArgs);
	assert.equal(byClass(fallback.body, "dsh-bots-tool-diff"), null, "无 old／new 不得渲染空 diff");
	assert.ok(byClass(fallback.body, "dsh-bots-tool-io"), "回落通用 IO 段（参数体仍可见）");
});

test("V-P5.7 diff 视图样式：增／删／上下文着色与边框走官方令牌（DiffBlock 口径）", () => {
	const cssText = mod.toolRowCss;
	assert.match(cssText, /\.dsh-bots-tool-diff-add\{[^}]*color:var\(--dsw-alias-state-success-primary\)/, "新增行文字＝官方 success 令牌");
	assert.match(cssText, /\.dsh-bots-tool-diff-add\{[^}]*background:var\(--dsw-alias-code-diff-added\)/, "新增行底色＝官方 diff 令牌");
	assert.match(cssText, /\.dsh-bots-tool-diff-del\{[^}]*color:var\(--dsw-alias-state-error-primary\)/, "删除行文字＝官方 error 令牌");
	assert.match(cssText, /\.dsh-bots-tool-diff-del\{[^}]*background:var\(--dsw-alias-code-diff-deleted\)/, "删除行底色＝官方 diff 令牌");
	assert.match(cssText, /\.dsh-bots-tool-diff-context\{[^}]*color:var\(--dsw-alias-label-secondary\)/, "上下文行＝label-secondary");
	assert.match(cssText, /\.dsh-bots-tool-diff-path\{[^}]*color:var\(--dsw-alias-label-secondary\)/, "路径行＝label-secondary（官方 path 行口径）");
	assert.match(cssText, /\.dsh-bots-tool-diff-body\{[^}]*font:var\(--dsw-font-markdown-code-block\)/, "diff 正文字号＝官方代码块字体");
	assert.match(cssText, /\.dsh-bots-tool-diff-add::before\{content:"\+ "\}/, "新增行前缀由 CSS 画（官方口径）");
	assert.match(cssText, /\.dsh-bots-tool-diff-del::before\{content:"- "\}/, "删除行前缀由 CSS 画（官方口径）");
	assert.match(cssText, /\.dsh-bots-tool-diff\{[^}]*border:\.5px solid var\(--dsw-alias-border-l1\)/, "diff 卡片边框 .5px l1");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.6 ③ read 行：路径摘要＋行号窗口明细
// ═══════════════════════════════════════════════════════════════════════
/** 官方 `formatReadOutput` 的文本形状（`<path>／<type>／<content>` 包裹＋`N: text` 行＋页脚）。 */
const readOutputText = (path, lines, footer) =>
	`<path>${path}</path>\n<type>file</type>\n<content>\n`
	+ lines.map((line) => `${line.number}: ${line.text}`).join("\n")
	+ `\n\n${footer}\n</content>`;

test("V-P5.6 read 行：路径摘要＋展开明细＝行号 gutter＋内容体＋窗口页脚（投影快照）", () => {
	const record = settled({
		name: "read",
		argsRaw: JSON.stringify({ file_path: "lib/trace-projection.js", offset: 1, limit: 3 }),
		state: "ok",
		outputText: readOutputText("lib/trace-projection.js", [
			{ number: 1, text: "/**" },
			{ number: 2, text: " * 投影入口。" },
			{ number: 3, text: " */" }
		], "(End of file - total 3 lines)")
	});
	const { view, body } = mountRowExpanded(record);
	const head = findOne(view.tree, (node) => node.type === "button");
	assert.ok(textOf(head).includes("lib/trace-projection.js"), "路径摘要（args.file_path）在行头");
	const read = byClass(body, "dsh-bots-tool-read");
	assert.ok(read, "read 专用体须是行号窗口");
	assert.equal(read.props["data-read"], true, "read 视图标记（官方同形）");
	const lines = allByClass(read, "dsh-bots-tool-read-line");
	assert.equal(lines.length, 3, "逐行渲染（行号＋内容）");
	assert.deepEqual(lines.map((line) => textOf(byClass(line, "dsh-bots-tool-read-gutter"))), ["1", "2", "3"], "gutter 行号＝官方 1 基行号");
	assert.deepEqual(lines.map((line) => textOf(byClass(line, "dsh-bots-tool-read-content"))),
		["/**", " * 投影入口。", " */"], "内容体＝去行号前缀后的原文");
	assert.equal(textOf(byClass(read, "dsh-bots-tool-read-note")), "(End of file - total 3 lines)", "窗口页脚原样呈现（读面自述）");
	assert.equal(byClass(read, "dsh-bots-tool-io"), null, "read 行不得再叠通用 IO 段");
	// 逐行结构与 aria：行号槽对读屏隐藏（行号是辅助信息，正文才是内容）
	assert.equal(byClass(lines[0], "dsh-bots-tool-read-gutter").props["aria-hidden"], true);
});

test("V-P5.6 read 行：长窗口折叠（官方 read maxLines: 8）；不可解析结果回落通用段（不得空白）", () => {
	const long = settled({
		name: "read",
		argsRaw: JSON.stringify({ file_path: "big.txt" }),
		state: "ok",
		outputText: readOutputText("big.txt", Array.from({ length: 12 }, (_, i) => ({ number: i + 1, text: "L" + (i + 1) })), "(Showing lines 1-12 of 12.)")
	});
	const folded = mountRowExpanded(long);
	assert.equal(allByClass(folded.body, "dsh-bots-tool-read-line").length, 8, "默认折叠到 8 行（官方 read maxLines）");
	const fold = byClass(folded.body, "dsh-bots-tool-fold");
	assert.ok(fold, "超限须有折叠开关");
	assert.equal(textOf(fold), "tool.foldExpand:4");
	fold.props.onClick();
	assert.equal(allByClass(folded.view.tree, "dsh-bots-tool-read-line").length, 12, "展开后全量呈现");

	// 结果文本不含官方包裹形状（如错误文本／未落定）→ 回落通用 IO 段
	const raw = settled({ name: "read", argsRaw: JSON.stringify({ file_path: "x.md" }), state: "error", isError: true, errorText: "ENOENT: no such file" });
	const fallback = mountRowExpanded(raw);
	assert.equal(byClass(fallback.body, "dsh-bots-tool-read"), null, "不可解析不得渲染空窗口");
	assert.ok(textOf(byClass(fallback.body, "dsh-bots-tool-output")).includes("ENOENT"), "错误文本仍可见（不得空白行）");
});

test("V-P5.7 read 视图样式：内容 pre-wrap＋行号 gutter 令牌＋卡片边框（ReadBlock 口径）", () => {
	const cssText = mod.toolRowCss;
	assert.match(cssText, /\.dsh-bots-tool-read-content\{[^}]*white-space:pre-wrap/, "read 内容体 pre-wrap（判据原文）");
	assert.match(cssText, /\.dsh-bots-tool-read-content\{[^}]*color:var\(--dsw-alias-label-primary\)/, "read 正文＝label-primary（官方 content 口径）");
	assert.match(cssText, /\.dsh-bots-tool-read-gutter\{[^}]*color:var\(--dsw-alias-label-tertiary\)/, "行号＝label-tertiary（官方 gutter 口径）");
	assert.match(cssText, /\.dsh-bots-tool-read-gutter\{[^}]*text-align:right/, "行号右对齐（官方口径）");
	assert.match(cssText, /\.dsh-bots-tool-read\{[^}]*font:var\(--dsw-font-markdown-code-block\)/, "read 视图字号＝官方代码块字体");
	assert.match(cssText, /\.dsh-bots-tool-read\{[^}]*background:var\(--dsw-alias-markdown-code-block\)/, "read 视图底色＝官方代码块令牌");
	// 限高／可滚由 03 基座的展开体承担（同一行骨架，不新造第二套滚动区）
	assert.match(mod.disclosureCss, /\.dsh-bots-disclosure-content\{[^}]*max-height:240px/, "展开体限高（03 基座）");
	assert.match(mod.disclosureCss, /\.dsh-bots-disclosure-content\{[^}]*overflow:auto/, "展开体可滚动（03 基座）");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.6 ④ search 行：命中摘要＋展开明细
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.6 search 行（grep）：命中摘要＋展开明细＝按文件分组的命中列表（投影快照），文件组可折叠", () => {
	const outputText = "Found 3 matches\n\n"
		+ "lib/client.js\nLine 12: const TOOL_VARIANTS = {\nLine 30: toolVariantOf(name)\n\n"
		+ "lib/stats.js\nLine 5: export function readStats\n\n"
		+ "(Full grep result stored at: spill.txt.)";
	const record = settled({
		name: "grep",
		argsRaw: JSON.stringify({ pattern: "TOOL_VARIANTS", path: "lib" }),
		state: "ok",
		outputText
	});
	const { view, body } = mountRowExpanded(record);
	const head = findOne(view.tree, (node) => node.type === "button");
	assert.ok(textOf(head).includes("TOOL_VARIANTS"), "命中摘要（args.pattern）在行头");
	const search = byClass(body, "dsh-bots-tool-search");
	assert.ok(search, "search 专用体须是命中列表");
	assert.equal(search.props["data-search"], "matches", "grep＝matches 视图（官方 SearchBlock 口径）");
	assert.equal(textOf(byClass(search, "dsh-bots-tool-search-summary")), "Found 3 matches", "首行计数摘要原样呈现");
	assert.equal(textOf(byClass(search, "dsh-bots-tool-search-note")), "(Full grep result stored at: spill.txt.)", "截断页脚原样呈现");
	const files = allByClass(search, "dsh-bots-tool-search-file");
	assert.deepEqual(files.map((node) => textOf(byClass(node, "dsh-bots-tool-search-path"))), ["lib/client.js", "lib/stats.js"], "按文件分组");
	assert.deepEqual(files.map((node) => textOf(byClass(node, "dsh-bots-tool-search-count"))), ["2", "1"], "文件组带命中数");
	assert.equal(files[0].type, "button", "文件组头是原生 button（官方可折叠组）");
	assert.equal(files[0].props["aria-expanded"], true);
	assert.deepEqual(allByClass(search, "dsh-bots-tool-search-line").map(textOf),
		["12: const TOOL_VARIANTS = {", "30: toolVariantOf(name)", "5: export function readStats"], "命中行＝行号＋命中原文");
	// 折叠文件组：列表明细随之收起（重渲染后重新取节点）
	files[0].props.onClick();
	assert.deepEqual(allByClass(view.tree, "dsh-bots-tool-search-line").map(textOf), ["5: export function readStats"], "折叠的组不渲染命中行");
	assert.equal(allByClass(view.tree, "dsh-bots-tool-search-file")[0].props["aria-expanded"], false, "折叠后 aria-expanded=false");
	assert.equal(byClass(view.tree, "dsh-bots-tool-io"), null, "search 行不得再叠通用 IO 段");
});

test("V-P5.6 search 行（glob）：命中摘要＋路径列表＋截断页脚；空结果给自述文案（不留白）", () => {
	const glob = settled({
		name: "glob",
		argsRaw: JSON.stringify({ pattern: "**/*.md" }),
		state: "ok",
		outputText: "docs/a.md\nREADME.md\n\n(Showing 2 of 2 paths.)"
	});
	const ran = mountRowExpanded(glob);
	const search = byClass(ran.body, "dsh-bots-tool-search");
	assert.equal(search.props["data-search"], "paths", "glob＝paths 视图（官方 SearchBlock 口径）");
	assert.deepEqual(allByClass(search, "dsh-bots-tool-search-line").map(textOf), ["docs/a.md", "README.md"], "路径列表逐行");
	assert.equal(textOf(byClass(search, "dsh-bots-tool-search-note")), "(Showing 2 of 2 paths.)");
	// 空结果：工具自述文案可见，不得留白
	const none = settled({ name: "glob", argsRaw: JSON.stringify({ pattern: "nope" }), state: "ok", outputText: "No files found" });
	const emptyView = mountRowExpanded(none);
	const emptySearch = byClass(emptyView.body, "dsh-bots-tool-search");
	assert.ok(emptySearch, "空结果仍是 search 形制（有自述行）");
	assert.equal(textOf(byClass(emptySearch, "dsh-bots-tool-search-summary")), "No files found");
	assert.equal(allByClass(emptySearch, "dsh-bots-tool-search-line").length, 0);
	const noMatch = settled({ name: "grep", argsRaw: JSON.stringify({ pattern: "zzz" }), state: "ok", outputText: "No matches found" });
	const noMatchView = mountRowExpanded(noMatch);
	assert.equal(textOf(byClass(noMatchView.body, "dsh-bots-tool-search-summary")), "No matches found", "grep 空结果给自述文案");
	// 结果文本不可解析（错误文本）→ 回落通用 IO 段（不得装假命中列表）
	const broken = settled({ name: "grep", argsRaw: JSON.stringify({ pattern: "x" }), state: "error", isError: true, errorText: "pattern invalid" });
	const fallback = mountRowExpanded(broken);
	assert.equal(byClass(fallback.body, "dsh-bots-tool-search"), null, "不可解析不得渲染假命中列表");
	assert.ok(textOf(byClass(fallback.body, "dsh-bots-tool-output")).includes("pattern invalid"), "错误文本仍可见（不得空白行）");
});

test("V-P5.7 search 视图样式：分组头／命中行／路径行走官方令牌（SearchBlock 口径）", () => {
	const cssText = mod.toolRowCss;
	assert.match(cssText, /\.dsh-bots-tool-search\{[^}]*background:var\(--dsw-alias-markdown-code-block\)/, "search 卡片底色＝官方代码块令牌");
	assert.match(cssText, /\.dsh-bots-tool-search\{[^}]*border:\.5px solid var\(--dsw-alias-border-l1\)/, "search 卡片边框 .5px l1");
	assert.match(cssText, /\.dsh-bots-tool-search-summary\{[^}]*background:var\(--dsw-alias-markdown-code-block-banner\)/, "计数摘要 banner 底色");
	assert.match(cssText, /\.dsh-bots-tool-search-summary\{[^}]*font:var\(--dsw-font-xs-13\)/, "计数摘要 13px（官方 summary 口径）");
	assert.match(cssText, /\.dsh-bots-tool-search-path\{[^}]*color:var\(--dsw-alias-label-primary\)/, "文件路径＝label-primary");
	assert.match(cssText, /\.dsh-bots-tool-search-path\{[^}]*font-weight:600/, "文件路径加粗（官方 filePath 口径）");
	assert.match(cssText, /\.dsh-bots-tool-search-count\{[^}]*color:var\(--dsw-alias-label-tertiary\)/, "命中数＝tertiary");
	assert.match(cssText, /\.dsh-bots-tool-search-lineno\{[^}]*color:var\(--dsw-alias-label-tertiary\)/, "行号＝tertiary（官方 lineNumber 口径）");
	assert.match(cssText, /\.dsh-bots-tool-search-body\{[^}]*font:var\(--dsw-font-markdown-code-block\)/, "命中列表字号＝官方代码块字体");
	assert.match(cssText, /\.dsh-bots-tool-search-line\{[^}]*white-space:pre/, "命中行不折行（官方口径）");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.6 回落（负例）：未识别工具与四类外的官方变体名一律通用行
// ═══════════════════════════════════════════════════════════════════════
/** 四类专用体的类名指纹（任一出现即「落进了专用形制」）。 */
const SPECIALIZED_CLASS = /dsh-bots-tool-(term|diff|read|search)\b/;

test("V-P5.6 回落：未识别工具与四类外的官方变体名一律走通用行——无空白行、无裸 JSON（负例）", () => {
	// 四类之外的名称：未识别工具＋官方 `read`／`search` 变体里不属四类的成员
	for (const name of ["some_unknown_tool_xyz", "read_image", "web_fetch", "web_search", "run_code", "todo_write", "ledger.read", ""]) {
		const record = settled({
			name,
			argsRaw: JSON.stringify({ foo: "bar", path: "a/b.md" }),
			outputText: "done"
		});
		const { view, body } = mountRowExpanded(record);
		assert.equal(findOne(body, (node) => SPECIALIZED_CLASS.test(node.props.className || "")), null,
			"四类外工具不得落入专用形制：" + name);
		assert.ok(byClass(body, "dsh-bots-tool-io"), "回落通用 IO 段：" + name);
		assert.ok(textOf(body).includes("bar"), "参数体可见（不得空白行）：" + name);
		// 行头不得空白：标题位必有文案（未识别＝通用标题），且工具名可追
		const head = findOne(view.tree, (node) => node.type === "button");
		assert.ok(textOf(byClass(head, "dsh-bots-disclosure-title")).length > 0, "标题位不得空：" + name);
	}
	// 裸 JSON 负例：展开体不得是 `argsRaw` 原文（须走官方 formatToolBody 的美化形态）
	const rawArgs = JSON.stringify({ foo: "bar" });
	const bare = settled({ name: "some_unknown_tool_xyz", argsRaw: rawArgs, outputText: "done" });
	const bareView = mountRowExpanded(bare);
	const bodyText = textOf(byClass(bareView.body, "dsh-bots-tool-input"));
	assert.notEqual(bodyText, rawArgs, "不得把 argsRaw 原文当正文（裸 JSON 负例）");
	assert.ok(bodyText.includes("\n"), "参数体须是美化 JSON（多行）");
	// 空 args＋无输出：行仍在、可展开，展开体不留白（要么有参数段、要么有输出段）
	const hollow = rec({ name: "some_unknown_tool_xyz", argsRaw: "", state: "ok" });
	const hollowView = mountRowExpanded(hollow);
	const hollowText = textOf(byClass(hollowView.view.tree, "dsh-bots-disclosure-body"));
	assert.ok(hollowView.body !== null, "空参数行仍可展开（折叠头不得因缺内容消失）");
	assert.equal(hollowText.trim(), "", "空参数＋空输出：展开体为空而不是占位空白行（行头本身有标题）");
	assert.ok(textOf(byClass(hollowView.view.tree, "dsh-bots-disclosure-title")).length > 0);
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.6 四类齐备：同一条回合数据流里的整投影快照（端到端）
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.6 四类齐备：同一回合数据流里 bash／diff／read／search＋未识别工具逐行呈现（整投影快照）", () => {
	const M = [{ id: "m1", text: "开始", from: "user", timestamp: "2026-10-09T06:00:00.000Z" }];
	const at = (minutes) => Date.parse("2026-10-09T06:0" + minutes + ":00.000Z");
	const R = [
		rec({ seq: 1, turn: 1, callId: "b1", name: "bash", state: "ok", time: at(1), argsRaw: JSON.stringify({ command: "ls -la" }), outputText: "total 0" }),
		rec({ seq: 2, turn: 1, callId: "d1", name: "edit", state: "ok", time: at(2), argsRaw: JSON.stringify({ file_path: "a.md", old_string: "旧", new_string: "新" }), outputText: "The file a.md has been updated successfully." }),
		rec({ seq: 3, turn: 1, callId: "r1", name: "read", state: "ok", time: at(3), argsRaw: JSON.stringify({ file_path: "a.md" }), outputText: readOutputText("a.md", [{ number: 1, text: "新" }], "(End of file - total 1 lines)") }),
		rec({ seq: 4, turn: 1, callId: "s1", name: "grep", state: "ok", time: at(4), argsRaw: JSON.stringify({ pattern: "新" }), outputText: "Found 1 match\n\na.md\nLine 1: 新" }),
		rec({ seq: 5, turn: 1, callId: "u1", name: "some_unknown_tool_xyz", state: "running", time: at(5), argsRaw: JSON.stringify({ foo: "bar" }) })
	];
	const group = mod.assemble(M, R).find((node) => node.kind === "toolGroup");
	assert.equal(group.closed, false, "未闭合回合＝逐行实时（本快照要看到全部行）");
	const view = harness.mount(mod.ToolCallGroup, { group, t: (key, params) => (params ? key + ":" + params.n : key) });
	const rows = sectionsOf(view.tree, "dsh-bots-tool-row");
	assert.deepEqual(rows.map((node) => node.props["data-tool"] + ":" + node.props["data-state"]),
		["bash:ok", "edit:ok", "read:ok", "grep:ok", "some_unknown_tool_xyz:running"], "五个行按记录序逐行呈现");
	assert.deepEqual(rows.map((node) => node.props["data-variant"]),
		["bash", "edit", "read", "search", "others"], "变体口径不变（others 回落）");
	// 逐行展开（每次点击后重新取节点）：四类专用体各就各位，未识别行回落通用段
	const wanted = ["dsh-bots-tool-term", "dsh-bots-tool-diff", "dsh-bots-tool-read", "dsh-bots-tool-search", "dsh-bots-tool-io"];
	for (let index = 0; index < wanted.length; index += 1) {
		const fresh = sectionsOf(view.tree, "dsh-bots-tool-row")[index];
		const button = findOne(fresh, (node) => node.type === "button");
		assert.ok(button, "第 " + index + " 行有折叠头");
		button.props.onClick();
		const expandedRow = sectionsOf(view.tree, "dsh-bots-tool-row").find((node) => hasClass(node, "dsh-bots-tool-row") && byClass(node, wanted[index]));
		assert.ok(expandedRow, "第 " + index + " 行展开后须有 " + wanted[index]);
	}
	// 整树零空白行：每个行折叠头的标题位有文案
	for (const node of sectionsOf(view.tree, "dsh-bots-tool-row")) {
		const title = byClass(node, "dsh-bots-disclosure-title");
		assert.ok(title && textOf(title).length > 0, "行标题不得空白");
	}
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.7 形状同源：图标变体名／令牌／字号口径（样式扫描）
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.7 形状同源：图标一律官方 primitives 变体名（14px）、专用体不自造图标；样式只引官方令牌、无硬编码色值、字号口径不越界", () => {
	// ① 图标：四类工具→官方变体图标（与官方 `VARIANT_ICONS` 逐项一致），专用体内零图标
	const cases = [
		["bash", "IconApiOutlineRegular"],
		["pwsh", "IconApiOutlineRegular"],
		["write", "IconEditOutlineRegular"],
		["edit", "IconEditOutlineRegular"],
		["read", "IconBrowseOutlineRegular"],
		["grep", "IconSearchOutlineRegular"],
		["glob", "IconSearchOutlineRegular"],
		["some_unknown_tool_xyz", "IconSparkleRegular"]
	];
	for (const [name, icon] of cases) {
		const record = settled({ name, argsRaw: JSON.stringify({ command: "x", file_path: "a", content: "b", pattern: "c" }) });
		const view = harness.mount(mod.ToolRow, { record, t: (key) => key });
		const iconNode = findOne(view.tree, (node) => typeof node.type === "string" && /^Icon/.test(node.type));
		assert.equal(iconNode.type, icon, "图标须走官方变体名：" + name);
		assert.match(iconNode.type, /^Icon[A-Za-z]+(?:OutlineRegular|Regular)$/, "官方变体命名（OutlineRegular／Regular）：" + name);
		assert.equal(iconNode.props.size, 14, "官方工具行图标 14px：" + name);
		// 专用体内不得另起一套图标语言
		toggleHead(view.tree, 0);
		const body = byClass(view.tree, "dsh-bots-disclosure-body");
		if (body !== null) {
			assert.equal(findAll(body, (node) => typeof node.type === "string" && /^Icon/.test(node.type)).length, 0,
				"专用体不得自造图标：" + name);
		}
	}
	// ② 样式：只引官方令牌、无硬编码色值、字号口径不越界（与 03／07 同一口径）
	const cssText = mod.toolRowCss;
	const vars = [...cssText.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]);
	assert.ok(vars.length >= 40, "令牌引用面异常：" + vars.length + " 处");
	for (const name of vars) assert.match(name, /^--(?:dsw|ds)-/, "toolRowCss 引用了非官方令牌：" + name);
	assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(cssText), "toolRowCss 不得含硬编码十六进制色值");
	assert.ok(!/\b(?:rgba?|hsla?)\(/.test(cssText), "toolRowCss 不得含硬编码 rgb/hsl 色值");
	const sizes = [...cssText.matchAll(/font-size:([^;}]+)/g)].map((match) => match[1].trim());
	for (const size of sizes) {
		assert.ok(size === "12px" || size === "13px" || /^var\(--dsw-/.test(size), "字号口径越界（官方 12／13px 或 --dsw-font-*）：" + size);
	}
	// 四类专用体的字号一律走官方字体令牌（代码块字体／小号代码块／xs-13）
	for (const cls of ["term", "diff-body", "read", "search-body"]) {
		assert.match(cssText, new RegExp("\\.dsh-bots-tool-" + cls + "\\{[^}]*font:var\\(--dsw-font-"), "专用体字号须走官方字体令牌：" + cls);
	}
	// ③ 类名映射防漂移：分派表与专用体类名前缀一一对应
	assert.deepEqual(Object.keys(mod.TOOL_ROW_KINDS).sort(), ["bash", "edit", "glob", "grep", "pwsh", "read", "write"]);
	const fixtures = {
		bash: { argsRaw: JSON.stringify({ command: "ls" }), outputText: "total 0" },
		pwsh: { argsRaw: JSON.stringify({ command: "Get-ChildItem" }), outputText: "a.ps1" },
		write: { argsRaw: JSON.stringify({ file_path: "a.md", content: "新" }) },
		edit: { argsRaw: JSON.stringify({ file_path: "a.md", old_string: "旧", new_string: "新" }) },
		read: { argsRaw: JSON.stringify({ file_path: "a.md" }), outputText: readOutputText("a.md", [{ number: 1, text: "新" }], "(End of file - total 1 lines)") },
		grep: { argsRaw: JSON.stringify({ pattern: "新" }), outputText: "Found 1 match\n\na.md\nLine 1: 新" },
		glob: { argsRaw: JSON.stringify({ pattern: "**/*.md" }), outputText: "a.md" }
	};
	for (const [name, kind] of Object.entries(mod.TOOL_ROW_KINDS)) {
		const record = settled({ name, state: "ok", ...fixtures[name] });
		const view = harness.mount(mod.ToolRow, { record, t: (key) => key });
		toggleHead(view.tree, 0);
		const body = byClass(view.tree, "dsh-bots-disclosure-body");
		assert.ok(body !== null, "专用行须可展开：" + name);
		const marker = kind === "terminal" ? "dsh-bots-tool-term" : "dsh-bots-tool-" + kind;
		assert.ok(byClass(body, marker), "分派类型与专用体一致：" + name + "→" + kind);
	}
});

// ---------- 运行 ----------
let failed = 0;
for (const [name, fn] of results) {
	try {
		await fn();
		console.log("✓", name);
	} catch (error) {
		failed += 1;
		console.error("✗", name, "—", error.message);
		if (process.env.POD_TEST_STACK) console.error(error.stack);
	}
}
process.exit(failed > 0 ? 1 : 0);
