/**
 * 回归：L3 工具显示——回合级拼装＋通用行＋回合折叠头（pod 07 号票
 * [[07-tool-rows-generic]]；判据坐标＝规格附录 A 的 `V-P6.1…V-P6.6` 与
 * `V-P5.1…V-P5.5`，判据号写进用例名）。
 *
 * 被测面是 `lib/client.js` 里**渲染层**的两层：
 *   ① 纯函数拼装层 `assemble(M, R)`／`assembleDiagnostics(M, R)`（规格 §E2 R1–R6）——
 *      无 DOM、无 React，直接喂消息流与轨迹记录，断言输出序列；
 *   ② 组件的**渲染形状**——经票 03 的捕获式 loader＋无 DOM 迷你渲染器（手法同
 *      `tests/client-disclosure.test.mjs`），把组件树渲成 `createElement` 同形对象后断言。
 *
 * 数据面契约（票 06 冻结，逐字依赖）：`record =
 * { seq, time, callId, parentCallId?, name, argsRaw, state, outputText?, isError,
 *   errorText?, turn, step, subCalls[] }`、`state ∈
 * preparing|running|ok|error|stopped`；`turn` 是拼装锚定键、`seq` 是排序键；
 * `since` 只过滤顶层信封（子调用随信封整体到达）。
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
/**
 * 与 `client-disclosure.test.mjs` 的迷你渲染器同源，两处关键增强（本票需要）：
 *   - **位置路径身份**：hook 槽按组件在树中的位置路径归属（`root/1/1/0`…），
 *     故**嵌套**组件（工具行里的 `DisclosureRow`）的展开态也能跨重渲染保持；
 *   - **数组型 children 深展开**：`props.children` 传数组时按元素展开（同级）。
 * 任一 `setState` 触发整棵树重渲染；`useEffect`／`useLayoutEffect` 为空实现
 *（本票组件在渲染期无副作用）。
 */
function createMiniReact() {
	let current = null;
	let uidSeq = 0;
	const slots = new Map();        // 位置路径 → hook 槽
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
			// 与 React 同语义：元素的子节点并入 `props.children` 后交给组件
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
			// setState 只重渲染**当前挂载**的那棵树（闭包不得跨 mount 串台）
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
		/** 挂载（每次挂载前清空 hook 槽：不同挂载＝不同组件实例，展开态不得跨挂载串台）。 */
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
const buttonsOf = (tree) => findAll(tree, (node) => node.type === "button");
const sectionsOf = (tree, cls) => findAll(tree, (node) => node.type === "section" && hasClass(node, cls));
const textOf = (node) => {
	if (node === null || node === undefined) return "";
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (typeof node !== "object") return String(node);
	return (node.children || []).map(textOf).join("");
};
/** 屏幕阅读器文本：整棵树里全部 `dsh-bots-tool-sr` 槽拼接（状态文案走该槽）。 */
const hiddenTextOf = (tree) => findAll(tree, (node) => hasClass(node, "dsh-bots-tool-sr")).map(textOf).join(" ");

// ---------- 夹具：消息流 M 与轨迹记录 R（票 06 记录形状） ----------
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
/** 终态记录（用于「可判闭合」的场景）。 */
const settled = (over = {}) => rec({ state: "ok", outputText: "done", ...over });
const msg = (id, from, timestamp, text = "text") => ({ id, text, from, timestamp });
/** 展开某棵树里第 n 个折叠头（默认第一个）。 */
const toggleHead = (tree, index = 0) => {
	const buttons = buttonsOf(tree);
	assert.ok(buttons[index], "树里缺第 " + index + " 个折叠头按钮");
	buttons[index].props.onClick();
};

const results = [];
const test = (name, fn) => results.push([name, fn]);

// ═══════════════════════════════════════════════════════════════════════
// V-P6.1 锚定规则 R1
// ═══════════════════════════════════════════════════════════════════════
test("V-P6.1 锚定：工具行组挂在 A(t)（timestamp <= t0 的合并序下标最大者）之后；同拍取下标最大者；多回合同锚按 turn 升序", () => {
	assert.equal(typeof mod.assemble, "function", "导出面缺 assemble");
	const M = [
		msg("m1", "user", "2026-10-09T06:00:00.000Z"),   // 下标 0
		msg("m2", "user", "2026-10-09T06:05:00.000Z"),   // 下标 1（同拍两条）
		msg("m3", "bot", "2026-10-09T06:05:00.000Z")     // 下标 2（同拍，下标最大 → 锚点）
	];
	const R = [settled({ seq: 1, time: Date.parse("2026-10-09T06:05:00.000Z"), turn: 1, callId: "t1" })];
	const stream = mod.assemble(M, R);
	const group = stream.find((node) => node.kind === "toolGroup");
	assert.equal(group.anchor, "m3", "同拍消息须取合并序下标最大者为锚点");
	assert.ok(stream.findIndex((node) => node.kind === "toolGroup") > stream.findIndex((node) => node.kind === "message" && node.message.id === "m3"),
		"工具行组须渲染在锚点消息之后");
	assert.equal(group.closed, true, "全终态回合须判闭合");

	// 多回合同锚：按 turn 升序依次排列
	const R2 = [
		settled({ seq: 11, time: Date.parse("2026-10-09T06:05:00.000Z"), turn: 3, callId: "c-turn3" }),
		settled({ seq: 12, time: Date.parse("2026-10-09T06:05:00.000Z"), turn: 2, callId: "c-turn2" })
	];
	const groups = mod.assemble([M[0], M[1]], R2).filter((node) => node.kind === "toolGroup");
	assert.deepEqual(groups.map((g) => g.turn), [2, 3], "同锚点多条回合须按 turn 升序");
	assert.deepEqual(groups.map((g) => g.anchor), ["m2", "m2"]);

	// R4 分侧稳定排序键：消息侧＝数组顺序（合并序）；记录侧＝(turn, seq)
	assert.deepEqual(stream.filter((n) => n.kind === "message").map((n) => n.message.id), ["m1", "m2", "m3"],
		"消息侧顺序不得被拼装打乱");
	const turn1 = mod.assemble([], [
		settled({ seq: 30, time: 10, turn: 1, callId: "late" }),
		settled({ seq: 20, time: 10, turn: 1, callId: "early" })
	]).find((n) => n.kind === "toolGroup");
	assert.deepEqual(turn1.records.map((r) => r.seq), [20, 30], "记录侧排序键＝(turn, seq)");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P6.2 无锚点／不可解析的确定性回落＋诊断计数
// ═══════════════════════════════════════════════════════════════════════
test("V-P6.2 无锚点：回合早于任何消息时置于流首并计 anchorless；时间戳不可解析的消息不参与锚定（确定性回落）", () => {
	assert.equal(typeof mod.assembleDiagnostics, "function", "导出面缺 assembleDiagnostics");
	const R = [settled({ seq: 1, time: Date.parse("2026-10-09T06:00:00.000Z"), turn: 1, callId: "a1" })];
	// 唯一一条消息的时间晚于回合起点 → 无锚点
	const M = [msg("m1", "user", "2026-10-09T07:00:00.000Z")];
	const stream = mod.assemble(M, R);
	assert.equal(stream[0].kind, "toolGroup", "无锚点回合须置于流首");
	assert.equal(stream[0].anchor, null);
	const diag = mod.assembleDiagnostics(M, R);
	assert.deepEqual(Object.keys(diag).sort(), ["anchorless", "projectionGaps"], "诊断输出键集＝{anchorless, projectionGaps}");
	assert.equal(diag.anchorless, 1, "无锚点次数须计一次");

	// 时间戳不可解析：不得当作锚点（NaN 比较恒假），按 R1／R5 确定性回落并分解为可观测项
	const bad = [msg("m9", "user", "not-a-timestamp"), msg("m1", "user", "2026-10-09T07:00:00.000Z")];
	const streamBad = mod.assemble(bad, R);
	assert.equal(streamBad[0].kind, "toolGroup", "不可解析时间戳不得成为锚点（确定性回落到流首）");
	assert.equal(streamBad[0].anchor, null);
	assert.equal(mod.assembleDiagnostics(bad, R).anchorless, 1, "不可解析即无锚点的可观测计数");
	assert.deepEqual(streamBad.filter((n) => n.kind === "message").map((n) => n.message.id), ["m9", "m1"],
		"不可解析时间戳的消息仍按合并序呈现，不得丢序");
	// 缺时间戳的消息同样不入锚（无 timestamp 即无比较依据）
	const noTs = [{ id: "n1", text: "t", from: "user" }, msg("m1", "user", "2026-10-09T07:00:00.000Z")];
	assert.equal(mod.assemble(noTs, R)[0].kind, "toolGroup", "缺 timestamp 的消息不得成为锚点");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P6.3 未闭合回合：增量实时追加、不显示计数头；闭合判定；晚到消息重锚
// ═══════════════════════════════════════════════════════════════════════
test("V-P6.3 未闭合：增量 since 逐条追加且不闭合（无计数头）；turn 全终态或回合回复消息落盘即闭合；晚到消息按 R2 重锚（重锚优先）", () => {
	const M = [
		msg("m1", "user", "2026-10-09T06:00:00.000Z"),
		msg("m2", "user", "2026-10-09T06:20:00.000Z")
	];
	const r1 = rec({ seq: 1, time: Date.parse("2026-10-09T06:05:00.000Z"), turn: 1, callId: "c1", state: "running" });
	// 第一次轮询（since=0）→ 只有 c1
	const a = mod.assemble(M, [r1]).find((n) => n.kind === "toolGroup");
	assert.equal(a.closed, false, "有 running 记录即未闭合");
	assert.deepEqual(a.records.map((r) => r.seq), [1]);
	// 第二次轮询（since=1）→ 追加 c2，仍未闭合
	const r2 = rec({ seq: 2, time: Date.parse("2026-10-09T06:06:00.000Z"), turn: 1, callId: "c2", state: "preparing" });
	const b = mod.assemble(M, [r1, r2]).find((n) => n.kind === "toolGroup");
	assert.equal(b.closed, false, "仍有 preparing 记录即未闭合");
	assert.deepEqual(b.records.map((r) => r.seq), [1, 2], "未闭合回合按 since 增量追加");
	// 第三次轮询（since=2）→ 出现回合回复消息 → 闭合
	const M3 = [...M, msg("m3", "bot", new Date(Date.parse("2026-10-09T06:07:00.000Z")).toISOString())];
	const c = mod.assemble(M3, [r1, r2]).find((n) => n.kind === "toolGroup");
	assert.equal(c.closed, true, "回合回复消息（from 为该 bot、timestamp >= 最后一条记录）即闭合");
	assert.equal(c.anchor, "m1", "回复消息晚于 t0，不得成为锚点");

	// 闭合判据二：全终态（无回复消息也闭合；stopped 亦算落定）
	const d = mod.assemble(M, [rec({ seq: 4, turn: 2, callId: "d1", state: "stopped", time: Date.parse("2026-10-09T06:10:00.000Z") })])
		.find((n) => n.kind === "toolGroup");
	assert.equal(d.closed, true, "全终态（stopped 亦算落定）即闭合");

	// 晚到消息重锚：新消息 timestamp <= t0 进入 M 后，G(t) 随 A(t) 位移（重锚优先）
	const late = msg("m0", "user", "2026-10-09T06:04:00.000Z");
	assert.equal(a.anchor, "m1");
	const reflowed = mod.assemble([M[0], late, M[1]], [r1]).find((n) => n.kind === "toolGroup");
	assert.equal(reflowed.anchor, "m0", "晚到消息（timestamp <= t0）进入后应当重锚");
	const groupIndexIn = (stream) => stream.findIndex((n) => n.kind === "toolGroup");
	assert.notEqual(groupIndexIn(mod.assemble([M[0], late, M[1]], [r1])), groupIndexIn(mod.assemble(M, [r1])),
		"重锚后工具行组的流内位置须随锚点位移（重锚优先）");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P6.4 闭合后收为计数头；N＝顶层记录数、子调用不重复计入
// ═══════════════════════════════════════════════════════════════════════
test("V-P6.4 计数头：闭合回合 N＝顶层记录数（run_code 信封计 1、subCalls 不重复计入）", () => {
	const envelope = settled({
		seq: 5, turn: 1, callId: "env1", name: "run_code", time: Date.parse("2026-10-09T06:01:00.000Z"),
		argsRaw: JSON.stringify({ code: "await tools.bash({})" }),
		subCalls: [
			rec({ seq: 5, parentCallId: "env1", callId: "sub1", name: "bash", state: "ok", turn: 1, time: Date.parse("2026-10-09T06:01:00.000Z") }),
			rec({ seq: 5, parentCallId: "env1", callId: "sub2", name: "ledger.read", state: "error", isError: true, turn: 1, time: Date.parse("2026-10-09T06:01:00.000Z") })
		]
	});
	const single = settled({ seq: 9, turn: 1, callId: "c9", time: Date.parse("2026-10-09T06:02:00.000Z") });
	const M = [msg("m1", "user", "2026-10-09T06:00:00.000Z")];
	const group = mod.assemble(M, [envelope, single]).find((n) => n.kind === "toolGroup");
	assert.equal(group.closed, true);
	assert.equal(group.count, 2, "N＝顶层记录数（信封 1＋普通 1；两条子调用不重复计入）");
	assert.deepEqual(group.records.map((r) => r.callId), ["env1", "c9"]);
	assert.equal(group.records[0].subCalls.length, 2, "子调用随信封整体到达、不改写");
	// 未闭合时没有计数头（N 不该拿未落定的记录去数）
	const open = mod.assemble(M, [rec({ seq: 1, turn: 1, callId: "o1", state: "running" })]).find((n) => n.kind === "toolGroup");
	assert.equal(open.closed, false);
	assert.equal(open.count, 1);
});

// ═══════════════════════════════════════════════════════════════════════
// V-P6.5 幂等／可重放：同一数据全集内增量与全量产出同一序列
// ═══════════════════════════════════════════════════════════════════════
test("V-P6.5 幂等：同一数据全集内增量拼接与全量重放产出同一序列；零重复、零丢序", () => {
	const M = [
		msg("m1", "user", "2026-10-09T06:00:00.000Z"),
		msg("m2", "bot", "2026-10-09T06:10:00.000Z"),
		msg("m3", "user", "2026-10-09T06:20:00.000Z")
	];
	const R = [
		settled({ seq: 3, turn: 1, callId: "a", time: Date.parse("2026-10-09T06:01:00.000Z") }),
		settled({ seq: 1, turn: 2, callId: "b", time: Date.parse("2026-10-09T06:21:00.000Z") }),
		settled({ seq: 2, turn: 2, callId: "c", time: Date.parse("2026-10-09T06:22:00.000Z") }),
		rec({ seq: 4, turn: 3, callId: "d", state: "running", time: Date.parse("2026-10-09T06:23:00.000Z") })
	];
	const key = (node) => node.kind === "message"
		? "M:" + node.message.id
		: "G:" + node.turn + ":" + (node.closed ? "C" : "O") + ":" + node.records.map((r) => r.seq).join(",");
	// 全量
	const full = mod.assemble(M, R);
	// 增量：逐条 since 追加（每步只喂 new seq；轮询水位只增不减）
	const bySeq = R.slice().sort((x, y) => x.seq - y.seq);
	const incremental = [];
	const seen = [];
	for (const record of bySeq) {
		seen.push(record);
		incremental.push(mod.assemble(M, seen));
	}
	assert.deepEqual(incremental[incremental.length - 1].map(key), full.map(key),
		"同一数据全集内增量与全量必须产出同一序列");
	// 幂等：同一输入重复调用结果稳定
	assert.deepEqual(mod.assemble(M, R).map(key), full.map(key));
	assert.deepEqual(mod.assemble(M, R.slice().reverse()).map(key), full.map(key), "输入记录顺序不影响结果（分侧排序键）");
	// 零重复：每条顶层记录恰出现一次
	const allRecords = full.filter((n) => n.kind === "toolGroup").flatMap((g) => g.records.map((r) => r.callId));
	assert.equal(new Set(allRecords).size, allRecords.length, "顶层记录不得重复");
	assert.deepEqual([...allRecords].sort(), ["a", "b", "c", "d"], "顶层记录不得丢序或丢失");
	// 工具行与邮件消息零重复、零丢序
	assert.deepEqual(full.filter((n) => n.kind === "message").map((n) => n.message.id), ["m1", "m2", "m3"]);
	// 增量过程不变量：回合组内 seq 升序、每个回合的已知记录数只增不减
	for (const step of incremental) {
		for (const group of step.filter((n) => n.kind === "toolGroup")) {
			const seqs = group.records.map((r) => r.seq);
			assert.deepEqual(seqs, [...seqs].sort((x, y) => x - y), "回合组内记录须保持 seq 升序");
		}
	}
	const counts = incremental.map((step) => step.filter((n) => n.kind === "toolGroup")
		.flatMap((g) => g.records.map((r) => r.callId)).length);
	for (let i = 1; i < counts.length; i += 1) {
		assert.ok(counts[i] > counts[i - 1], "增量轮询每步只追加（记录数严格递增）");
	}
});

// ═══════════════════════════════════════════════════════════════════════
// V-P6.6 不可执行时的上浮口径（分解为可观测项，不新立第二事实源）
// ═══════════════════════════════════════════════════════════════════════
test("V-P6.6 上浮口径：不可执行输入分解为可观测诊断（锚点／缺口计数），needs-user 白名单类别由既有坐标件 fail-closed 把守", async () => {
	const { HUMAN_CRITERION_CATEGORIES } = await import("../lib/org/acceptance-coordinates.js");
	assert.ok(Array.isArray(HUMAN_CRITERION_CATEGORIES) && HUMAN_CRITERION_CATEGORIES.length >= 2,
		"人工判据类别白名单须来自既有坐标件（不新立第二事实源）");
	for (const entry of HUMAN_CRITERION_CATEGORIES) {
		assert.equal(typeof entry.id, "string");
		assert.ok(entry.id.length > 0, "白名单类别 id 不得为空（fail-closed 读取前提）");
	}
	// 分解为可观测项：坏输入不得留白，也不得抛
	const broken = [
		{ id: "m1", text: "t", from: "user", timestamp: "garbage" },
		{ id: "m2", text: "t", from: "user" }
	];
	const R = [
		rec({ seq: 1, turn: 1, callId: "x", state: "running", time: Number.NaN }),
		{ seq: 2, time: Number.NaN, callId: "y", name: "", argsRaw: "", state: "bogus", isError: false, turn: 1, step: 0, subCalls: [] }
	];
	const stream = mod.assemble(broken, R);
	const diag = mod.assembleDiagnostics(broken, R);
	assert.ok(diag.anchorless >= 1, "无法锚定须计入 anchorless（可观测项）");
	assert.ok(diag.projectionGaps >= 1, "记录不可解析（state 不在枚举）须计入 projectionGaps");
	for (const node of stream) {
		if (node.kind !== "toolGroup") continue;
		for (const row of node.records) {
			assert.equal(typeof row.callId, "string");
			assert.ok(row.callId.length > 0, "任何记录都须有可渲染的 callId（不得造空白行）");
			assert.equal(typeof row.name, "string");
		}
	}
	// 空数据不抛、不产出行（零回归的另一面）
	assert.deepEqual(mod.assemble([], []), []);
	assert.deepEqual(mod.assembleDiagnostics([], []), { anchorless: 0, projectionGaps: 0 });
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.1 通用行字段齐备
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.1 通用行：图标＋工具名＋参数摘要＋状态（五态）＋时间＋chevron；展开看参数体与输出体（pre-wrap、限高、可滚动）", () => {
	assert.equal(typeof mod.ToolRow, "function", "导出面缺 ToolRow");
	// 夹具走**通用行**（08 号票起 bash／write／edit／read／grep／glob 走专用形制，
	// 通用行的字段齐备改由仍在通用面的 `read_image` 举证；判据 V-P5.1 语义不变）。
	const record = settled({
		callId: "c1", name: "read_image", state: "ok", outputText: "total 12\ndrwxr-xr-x",
		argsRaw: JSON.stringify({ path: "a/b.png", description: "列目录" }),
		time: Date.parse("2026-10-09T06:03:00.000Z")
	});
	const view = harness.mount(mod.ToolRow, { record, t: (key) => key });
	const root = view.tree;
	assert.equal(root.type, "section", "通用行复用 03 的 DisclosureRow 基座（section 根）");
	assert.ok(hasClass(root, "dsh-bots-tool-row"), "行级类名供状态色／间距");
	assert.equal(root.props["data-variant"], "read", "变体落 data-variant（08 的专用行按此派生）");
	assert.equal(root.props["data-state"], "ok", "状态落 data-state");

	const head = findOne(root, (node) => node.type === "button");
	assert.ok(head, "行头须是原生 button（可聚焦、可展开）");
	assert.equal(head.props.type, "button");
	assert.equal(typeof head.props["aria-expanded"], "boolean");
	assert.equal(typeof head.props["aria-controls"], "string");
	assert.ok(hiddenTextOf(root).includes("tool.state.ok"), "状态须有读屏文本（tool.state.*）");
	const iconSlot = byClass(head, "dsh-bots-disclosure-icon");
	assert.ok(iconSlot, "须有图标槽（走 03 基座）");
	const icon = findOne(iconSlot, (n) => typeof n.type === "string" && /^Icon/.test(n.type));
	assert.ok(icon, "图标须走官方 primitives 变体名");
	assert.equal(icon.props.size, 14, "官方工具行图标 14px");
	assert.equal(textOf(byClass(head, "dsh-bots-disclosure-title")), "tool.title.readImage", "工具名走变体标题键");
	const meta = textOf(byClass(head, "dsh-bots-disclosure-meta"));
	assert.ok(meta.includes("a/b.png"), "参数摘要取自 argsRaw（官方 SUMMARY_KEYS 口径：path 优先）：" + meta);
	assert.equal(meta.includes("列目录"), false, "摘要只取键偏好里的第一个键（不把其它参数拼进来）");
	assert.equal(mod.toolSummaryLabel("bash", JSON.stringify({ command: "ls -la" })), "ls -la",
		"无 description 时摘要回退链须覆盖 command");
	assert.equal(mod.toolSummaryLabel("read", JSON.stringify({ file_path: "a/b.md" })), "a/b.md",
		"read 变体摘要取 file_path");
	assert.equal(mod.toolSummaryLabel("grep", JSON.stringify({ pattern: "foo\\d+" })), "foo\\d+",
		"search 变体摘要取 pattern");
	const time = findOne(head, (node) => node.type === "time");
	assert.equal(time.props.dateTime, new Date(Date.parse("2026-10-09T06:03:00.000Z")).toISOString(), "time 带机器可读 dateTime");
	assert.ok(byClass(head, "dsh-bots-disclosure-chevron"), "chevron 在头部");

	// 展开体：参数体＋输出体，pre-wrap 限高可滚
	toggleHead(view.tree);
	const body = byClass(view.tree, "dsh-bots-disclosure-body");
	assert.ok(body, "展开后渲染参数体与输出体");
	assert.equal(body.props.id, head.props["aria-controls"], "aria-controls 指向展开体");
	assert.ok(textOf(byClass(body, "dsh-bots-tool-input")).includes("a/b.png"), "参数体须显示原样参数");
	assert.ok(textOf(byClass(body, "dsh-bots-tool-output")).includes("drwxr-xr-x"), "输出体须显示输出文本");
	const cssText = mod.toolRowCss;
	assert.match(cssText, /\.dsh-bots-tool-io-text\{[^}]*white-space:pre-wrap/, "参数／输出体须 pre-wrap");
	assert.match(cssText, /\.dsh-bots-tool-io-text\{[^}]*max-height:150px/, "参数／输出体须限高（官方 150px）");
	assert.match(cssText, /\.dsh-bots-tool-io-text\{[^}]*overflow:auto/, "参数／输出体须可滚动");
	// 五态都可有文案且复用同一形状
	for (const state of ["preparing", "running", "ok", "error", "stopped"]) {
		const one = harness.mount(mod.ToolRow, { record: rec({ callId: "s-" + state, state, isError: state === "error" }), t: (key) => key });
		assert.equal(one.tree.props["data-state"], state, "五态须落到 data-state：" + state);
		assert.ok(hiddenTextOf(one.tree).includes("tool.state."), "五态须有读屏文案：" + state);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.2 回合折叠头
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.2 回合折叠头：闭合回合收为「N 次工具调用」可展开头；展开后见各顶层行", () => {
	assert.equal(typeof mod.ToolCallGroup, "function", "导出面缺 ToolCallGroup");
	const records = [
		settled({ seq: 1, turn: 1, callId: "c1", name: "bash", time: 1000 }),
		settled({ seq: 2, turn: 1, callId: "c2", name: "read", time: 2000 })
	];
	const group = mod.assemble([msg("m1", "user", "2026-10-09T00:00:00.000Z")], records).find((n) => n.kind === "toolGroup");
	const view = harness.mount(mod.ToolCallGroup, { group, t: (key, params) => (params ? key + ":" + params.n : key) });
	const root = view.tree;
	assert.ok(hasClass(root, "dsh-bots-tool-group"), "折叠头根类名");
	assert.equal(root.props["data-turn"], 1);
	const head = findOne(root, (node) => node.type === "button");
	assert.equal(head.props["aria-expanded"], false, "默认折叠");
	assert.equal(typeof head.props["aria-controls"], "string");
	assert.equal(textOf(byClass(head, "dsh-bots-disclosure-title")), "tool.calls:2", "计数头文案 N＝顶层记录数");
	assert.ok(byClass(head, "dsh-bots-disclosure-icon"), "头部含图标槽");
	assert.equal(sectionsOf(root, "dsh-bots-tool-row").length, 0, "折叠态不渲染工具行");
	toggleHead(view.tree);
	const body = byClass(view.tree, "dsh-bots-disclosure-body");
	assert.ok(body, "折叠头可展开");
	assert.equal(sectionsOf(body, "dsh-bots-tool-row").length, 2, "展开后每条顶层记录一行（子调用不另计）");
	assert.deepEqual(sectionsOf(body, "dsh-bots-tool-row").map((n) => n.props["data-tool"]), ["bash", "read"]);

	// 未闭合回合不吃折叠头：逐行实时
	const openGroup = mod.assemble([msg("m1", "user", "2026-10-09T00:00:00.000Z")],
		[rec({ seq: 1, turn: 1, callId: "o1", state: "running", time: 1000 })]).find((n) => n.kind === "toolGroup");
	const openView = harness.mount(mod.ToolCallGroup, { group: openGroup, t: (key, params) => (params ? key + ":" + params.n : key) });
	assert.equal(openView.tree.type, "div", "未闭合时逐行实时呈现（容器非折叠头）");
	assert.equal(sectionsOf(openView.tree, "dsh-bots-tool-row").length, 1);
	assert.equal(openView.tree.props["data-open"], true);
	assert.equal(findOne(openView.tree, (node) => hasClass(node, "dsh-bots-disclosure-body")), null,
		"未闭合容器自身不得有折叠头（展开体只属于工具行自身）");
	assert.equal(textOf(openView.tree).includes("tool.calls"), false, "未闭合容器不得出现计数头文案");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.3 PTC 信封：外层 run_code 行下挂内层子调用行（真实名不别名化）
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.3 PTC 信封：外层 run_code 行下挂 subCalls 子调用行，内层真实名不别名化（投影快照）", () => {
	const envelope = settled({
		seq: 1, turn: 1, callId: "env1", name: "run_code", time: 5000,
		argsRaw: JSON.stringify({ code: "const r = await tools.bash({command:'ls'});" }),
		outputText: "ok",
		subCalls: [
			rec({ seq: 2, parentCallId: "env1", callId: "s1", name: "bash", state: "ok", outputText: "a\nb", argsRaw: JSON.stringify({ command: "ls" }), turn: 1, time: 5000 }),
			rec({ seq: 3, parentCallId: "env1", callId: "s2", name: "ledger.read", state: "error", isError: true, errorText: "boom", argsRaw: JSON.stringify({ path: "x" }), turn: 1, time: 5001 })
		]
	});
	const view = harness.mount(mod.ToolRow, { record: envelope, t: (key) => key });
	const root = view.tree;
	assert.equal(root.props["data-variant"], "code", "run_code 的官方变体＝code");
	assert.equal(root.props["data-tool"], "run_code");
	const head = findOne(root, (node) => node.type === "button");
	assert.equal(textOf(byClass(head, "dsh-bots-disclosure-title")), "tool.title.code", "外层标题走 code 变体键");
	assert.equal(textOf(byClass(head, "dsh-bots-tool-subs")), "tool.subCalls", "行头可见子调用条数（信封语义）");
	toggleHead(view.tree);
	const body = byClass(view.tree, "dsh-bots-disclosure-body");
	const subWrap = findOne(view.tree, (node) => hasClass(node, "dsh-bots-tool-subcalls"));
	assert.ok(subWrap, "外层展开体须有子调用容器");
	assert.equal(subWrap.props["data-subcalls"], true, "与官方同形：data-subcalls");
	const subRows = sectionsOf(subWrap, "dsh-bots-tool-row");
	assert.equal(subRows.length, 2, "每条子调用一行");
	assert.deepEqual(subRows.map((n) => n.props["data-tool"]), ["bash", "ledger.read"], "子调用 data-tool＝内层真实名（不别名化）");
	assert.equal(subRows[1].props["data-state"], "error", "子调用状态各自独立");
	assert.equal(textOf(byClass(subRows[1], "dsh-bots-tool-sr")), "tool.state.error");
	// 标题：外层在行头（折叠态已断言）；展开体内逐条子调用的变体键
	//（带点真实名 `ledger.read` 走通用行标题——真实名不丢：见下 data-tool 快照）
	const titles = findAll(body, (n) => hasClass(n, "dsh-bots-disclosure-title")).map(textOf);
	assert.deepEqual(titles, ["tool.title.bash", "tool.title.generic"], "两条子调用行标题依次呈现");
	// 快照：内层真实名不丢失（防别名化回归）
	// 快照：整棵展开树里的工具行（外层信封＋两条子调用），真实名逐字保留
	assert.deepEqual(findAll(view.tree, (n) => hasClass(n, "dsh-bots-tool-row")).map((n) => n.props["data-tool"]),
		["run_code", "bash", "ledger.read"], "内层真实名快照（不别名化）");
	assert.equal(sectionsOf(subWrap, "dsh-bots-tool-row").length, 2, "子调用行须挂在外层信封的展开体里（官方同形）");
	// 子调用行可独立展开（重渲染后重新取节点：不能拿旧树上的引用）
	findOne(sectionsOf(subWrap, "dsh-bots-tool-row")[1], (node) => node.type === "button").props.onClick();
	const expandedSub = sectionsOf(view.tree, "dsh-bots-tool-row").find((n) => n.props["data-tool"] === "ledger.read");
	assert.ok(expandedSub, "重渲染后子调用行仍在树中");
	assert.ok(byClass(expandedSub, "dsh-bots-disclosure-body"), "子调用行自身可展开（独立于外层信封）");
	assert.ok(textOf(byClass(expandedSub, "dsh-bots-tool-output")).includes("boom")
		|| textOf(byClass(expandedSub, "dsh-bots-tool-input")).includes("x"),
		"子调用展开体显示其参数／输出");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.4 同流不打架：零重复、零丢序；刷新与事后回看呈现一致
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.4 同流不打架：邮件消息与工具行同流零重复零丢序；刷新（全量 since=0）与增量轮询呈现一致", () => {
	assert.equal(typeof mod.MsgList, "function", "导出面缺 MsgList");
	const M = [
		msg("m1", "user", "2026-10-09T06:00:00.000Z", "帮我看看"),
		msg("m2", "bot", "2026-10-09T06:10:00.000Z", "好了")
	];
	const R = [
		// 两个回合都**未闭合**（running）：按 R2 逐行实时呈现，故消息流里直接可见工具行
		rec({ seq: 1, turn: 1, callId: "c1", name: "bash", state: "running", time: Date.parse("2026-10-09T06:01:00.000Z") }),
		rec({ seq: 2, turn: 2, callId: "c2", name: "read", state: "running", time: Date.parse("2026-10-09T06:11:00.000Z") })
	];
	const props = { messages: M, botId: "b1", botName: "调研员", bots: [], toolGroups: mod.assemble(M, R), t: (key) => key };
	const msgView = harness.mount(mod.MsgList, props);
	assert.equal(msgView.tree.length, 4, "两条消息＋两组工具行，共 4 个顶层节点（零重复零丢序）");
	assert.ok(msgView.tree[0].props.className.includes("dsh-bots-msg"));
	assert.ok(msgView.tree[2].props.className.includes("dsh-bots-msg"), "第二条消息仍在第 3 位（工具行插在其后）");
	assert.equal(findAll(msgView.tree, (n) => hasClass(n, "dsh-bots-tool-group")).length, 2, "两条回合各一个工具行组");
	// 回合 1 已闭合 → 收为计数头（行不在树中）；回合 2 未闭合 → 逐行实时（read 可见）
	assert.deepEqual(sectionsOf(msgView.tree, "dsh-bots-tool-row").map((n) => n.props["data-tool"]), ["read"],
		"未闭合回合的行与消息同流实时呈现；闭合回合收为计数头（不重复渲染行）");
	// 刷新 vs 增量：同一数据全集的两种到达路径呈现一致（幂等）
	const shape = (list) => list.map((n) => n.kind === "message" ? "M:" + n.message.id : "G:" + n.turn + ":" + (n.closed ? "C" : "O") + ":" + n.records.length);
	const viaSince = mod.assemble(M, [...R.slice(0, 1), ...R.slice(1)]);
	assert.deepEqual(shape(viaSince), shape(mod.assemble(M, R)), "增量 vs 全量呈现一致");
	// 空轨迹 / 缺省 toolGroups：渲染与今日消息流一致（零回归；两次挂载分别断言）
	const bare = { messages: M, botId: "b1", botName: "调研员", bots: [], t: (key) => key };
	const plain = harness.mount(mod.MsgList, { ...bare, toolGroups: mod.assemble(M, []) });
	assert.equal(plain.tree.length, 2, "无工具调用：只有两条消息（零回归）");
	assert.equal(findAll(plain.tree, (n) => hasClass(n, "dsh-bots-tool-group")).length, 0);
	const legacy = harness.mount(mod.MsgList, bare);
	assert.deepEqual(legacy.tree.map((n) => n.props.className), plain.tree.map((n) => n.props.className),
		"缺省 toolGroups＝既有渲染（零回归）");
	// 闭合回合收为计数头（R3）：展开后才逐行可见——与未闭合回合同流不打架
	const expanded = harness.mount(mod.MsgList, props);
	const groupHead = findOne(expanded.tree[1], (n) => n.type === "button");
	assert.equal(groupHead.props["aria-expanded"], false, "闭合回合默认收为计数头（行不可见）");
	groupHead.props.onClick();
	assert.equal(groupHead === buttonsOf(expanded.tree[1])[0], false, "展开后重渲染：计数头按钮已被展开体取代（引用不再同一节点）");
	assert.deepEqual(sectionsOf(expanded.tree, "dsh-bots-tool-row").map((n) => n.props["data-tool"]), ["bash", "read"],
		"展开计数头后：闭合回合的行与未闭合回合的行按回合顺序依次呈现（零重复零丢序）");
	// 原树与展开后的树是两份独立快照：同一次挂载的旧树不受重渲染影响（React 同流不打架）
	assert.equal(findAll(msgView.tree, (n) => hasClass(n, "dsh-bots-tool-row")).length, 1,
		"旧快照仍是展开前的形状（旧树不被后续重渲染改写）");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.5 零回归
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.5 零回归：无工具调用的回合不渲染工具行组、不渲染计数头；未识别工具回落通用行（无空白行／裸 JSON）", () => {
	// ① 无记录 → 消息流形状与今日一致
	const M = [msg("m1", "user", "2026-10-09T06:00:00.000Z"), msg("m2", "bot", "2026-10-09T06:10:00.000Z")];
	assert.deepEqual(mod.assemble(M, []), [
		{ kind: "message", message: M[0], messageIndex: 0 },
		{ kind: "message", message: M[1], messageIndex: 1 }
	], "无工具调用时序列＝纯消息（零回归）");
	const view = harness.mount(mod.MsgList, { messages: M, botId: "b1", botName: "x", bots: [], toolGroups: mod.assemble(M, []), t: (key) => key });
	assert.equal(view.tree.length, 2);
	assert.equal(sectionsOf(view.tree, "dsh-bots-tool-row").length, 0, "不得凭空渲染工具行");
	// ② 未识别工具回落通用行，不得空白行或裸 JSON
	const unknown = settled({ seq: 1, turn: 1, callId: "u1", name: "some_unknown_tool_xyz", argsRaw: JSON.stringify({ foo: "bar" }), time: 1000 });
	const row = harness.mount(mod.ToolRow, { record: unknown, t: (key) => key });
	assert.equal(row.tree.props["data-variant"], "others", "未识别工具＝others 变体");
	const rowHead = findOne(row.tree, (node) => node.type === "button");
	assert.equal(textOf(byClass(rowHead, "dsh-bots-disclosure-title")), "tool.title.generic", "回落通用标题");
	assert.ok(textOf(rowHead).includes("some_unknown_tool_xyz"), "通用行须能追到真实工具名（不得只剩泛称）");
	assert.ok(textOf(rowHead).includes("bar"), "参数摘要来自 argsRaw");
	toggleHead(row.tree);
	const bodyText = textOf(byClass(row.tree, "dsh-bots-disclosure-body"));
	assert.ok(bodyText.includes("{") && bodyText.includes("foo"), "展开体显示原样参数");
	assert.ok(textOf(byClass(row.tree, "dsh-bots-disclosure-title")).length > 0, "不得空白行");
});

// ═══════════════════════════════════════════════════════════════════════
// V-P5.4（数据获取面）：trace 增量拉取按 `since=<已见最大 seq>` 左开、与消息流合并
// ═══════════════════════════════════════════════════════════════════════
test("V-P5.4 数据获取：trace 走增量拉取（since＝已见最大 seq，左开），与消息流合并后呈现幂等（刷新＝since 0 全量）", async () => {
	assert.equal(typeof mod.fetchTraceSince, "function", "导出面缺 fetchTraceSince");
	assert.equal(typeof mod.mergeBotTrace, "function", "导出面缺 mergeBotTrace");
	const calls = [];
	const realFetch = globalThis.fetch;
	globalThis.fetch = async (url, options) => {
		calls.push(String(url));
		const since = Number((String(url).match(/since=(\d+)/) || [])[1] || 0);
		const body = since === 0
			? { trace: [settled({ seq: 1, callId: "a", name: "bash", time: 1000 })], counters: { gap: 0 } }
			: { trace: [settled({ seq: 2, callId: "b", name: "read", time: 2000 })], counters: { gap: 1 } };
		return {
			ok: true,
			status: 200,
			json: async () => body,
			text: async () => JSON.stringify(body)
		};
	};
	try {
		// 首屏（水位 0）＝全量；随后按已见最大 seq 增量
		const first = await mod.fetchTraceSince("b1", 0);
		assert.deepEqual(first.records.map((r) => r.seq), [1], "since=0 即全量（首屏／刷新同路）");
		assert.equal(first.gap, 0);
		assert.equal(calls[0], "/api/bots/b1/trace", "水位 0 不带 since 参数");
		const second = await mod.fetchTraceSince("b1", 1);
		assert.deepEqual(second.records.map((r) => r.seq), [2]);
		assert.equal(calls[1], "/api/bots/b1/trace?since=1", "增量带 since＝已见最大 seq（左开）");
		assert.equal(second.gap, 1, "counters.gap 取服务端最新值");

		// 合并进 store：去重 + 追加；重复喂同一批不重复计
		mod.mergeBotTrace("b1", first.records, first.gap);
		mod.mergeBotTrace("b1", second.records, second.gap);
		mod.mergeBotTrace("b1", first.records, first.gap);
		mod.mergeBotTrace("b1", second.records, second.gap);
		const state = mod.getBotState();
		assert.deepEqual(state.traceByBot.b1.map((r) => r.seq), [1, 2], "按 seq 去重后追加（多次 since 与全量等价）");
		assert.equal(state.traceGapByBot.b1, 1, "投影缺口计数写回 store");
		// 与消息流合并后的呈现：刷新（全量 since=0）与增量同序同形
		const M = [msg("m1", "user", "2026-10-09T00:00:00.000Z"), msg("m2", "bot", "2026-10-09T00:30:00.000Z")];
		const key = (stream) => stream.map((n) => n.kind === "message" ? "M:" + n.message.id : "G:" + n.turn + ":" + (n.closed ? "C" : "O") + ":" + n.records.map((r) => r.seq).join(","));
		assert.deepEqual(key(mod.assemble(M, state.traceByBot.b1)), key(mod.assemble(M, [ ...first.records, ...second.records ])),
			"增量拼接与全量结果呈现一致（幂等）");
		// 消息字段未被工具面改写（R5 ④）
		assert.deepEqual(Object.keys(M[0]).sort(), ["from", "id", "text", "timestamp"], "拼装只消费既有消息字段，不新增字段");
	} finally {
		globalThis.fetch = realFetch;
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
