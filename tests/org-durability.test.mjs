/**
 * 组织恒久性与模型更迭面回归（org-v2 12 号票；规格 §J 与附录 A `V-A7.1`–`V-A7.4`）。
 *
 * 判据落点：
 *   - `V-A7.1` 组织层件白名单**封闭枚举**齐备（协议、台账、复核件套、权限四层、
 *     岗位卡 1–6/8 字段、知识库容器协议、宿主适配面登记表容器协议），逐条过换模型
 *     试金石 → 「白名单扫描模块」＝本文件驱动的 `scanDurabilityFace`（常驻）。
 *   - `V-A7.2` 岗位细节只住三处；组织层件内无模型特定假设，**可由扫描检查** →
 *     `scanModelAssumptions`（含负例注入：注入模型名即转红，注释豁免）。
 *   - `V-A7.3` D1–D11 在规格中逐条有对应表述；被覆写的 D5／D8 注明出处 →
 *     「文档扫描模块」＝`scanDurabilitySpec`（对 `.scratch/org-v2/spec.md`）。
 *   - `V-A7.4` 升级例程四步可执行（①改指派→台账自动登记 class=duty 评测任务；
 *     ②新模型跑岗位评测集；③做减法；④用户终裁）；每岗至少一可执行评测项 →
 *     `ROLE_EVAL_SET` 形状校验 ＋ 派单配置例程登记项 ＋ host 登记腿 ＋
 *     `BotsApi.patch` 改模型指派的端到端腿（真台账，临时 dshHome）。
 *
 * 只测外部行为：扫描结论、登记项形状、台账投影；不触真实 `~/.dsh`（夹具全在临时
 * 目录，`patch` 腿走内置脚手架回退路径）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ACCEPTANCE_RUNNER, criterionInjection } from "./helpers/criterion-fixture.mjs";

/** 已有夹具的判据执行面：本组用例测的不是判据门，显式声明「判据面已接线」（25 号票）。 */
const CRITERION_INJECTION = Object.freeze(criterionInjection(ACCEPTANCE_RUNNER));

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  ORG_LAYER_WHITELIST,
  REQUIRED_WHITELIST_IDS,
  TOUCHSTONE_QUESTION,
  MODEL_ASSUMPTION_TOKENS,
  ROLE_DETAIL_HOMES,
  SPEC_PATH,
  collectOrgLayerSources,
  scanModelAssumptions,
  validateOrgLayerWhitelist,
  validateRoleDetailHomes,
  scanDurabilityFace
} = await import("../lib/org/durability.js");

const { ROLE_CARD_FIELDS } = await import("../lib/org/role-cards.js");

const specPath = join(repoRoot, SPEC_PATH);
const specText = readFileSync(specPath, "utf8");

// ===================== 缝① 白名单封闭枚举（V-A7.1） =====================

test("V-A7.1 白名单封闭枚举齐备：七类组织层件逐条在册、id 唯一且与冻结类别一一对应", () => {
  assert.deepEqual(
    ORG_LAYER_WHITELIST.map((entry) => entry.id),
    [...REQUIRED_WHITELIST_IDS],
    "白名单条目顺序集＝冻结类别清单（少一条或多一条都即枚举破口）"
  );
  const seen = new Set();
  for (const entry of ORG_LAYER_WHITELIST) {
    assert.ok(!seen.has(entry.id), `白名单 id 重复：${entry.id}`);
    seen.add(entry.id);
    assert.equal(typeof entry.label, "string", `${entry.id}: 缺人读名`);
    assert.ok(entry.label.trim() !== "", `${entry.id}: 人读名不得为空`);
    assert.ok(Array.isArray(entry.modules) && entry.modules.length > 0, `${entry.id}: 须点明容器模块坐标`);
  }
});

test("V-A7.1 逐条过换模型试金石：每条都有试金石问答记录与「存活理由」", () => {
  assert.match(TOUCHSTONE_QUESTION, /更强模型/, "试金石问题须是换更强模型这一问");
  for (const entry of ORG_LAYER_WHITELIST) {
    assert.equal(entry.touchstone?.verdict, "pass", `${entry.id}: 未过试金石即不得留在组织层白名单`);
    assert.ok(
      typeof entry.touchstone?.survivesBecause === "string" && entry.touchstone.survivesBecause.trim() !== "",
      `${entry.id}: 须记录存活理由（换模型后为何不是废话或障碍）`
    );
  }
});

test("V-A7.1 白名单条目的规格锚与容器坐标可解析（锚串在规格 §J 内、模块文件在仓内）", () => {
  const verdict = validateOrgLayerWhitelist({ specText, repoRoot });
  assert.deepEqual(verdict.violations, [], `白名单坐标须全部解析成功：${JSON.stringify(verdict.violations)}`);
  assert.equal(verdict.ok, true);
  for (const entry of ORG_LAYER_WHITELIST) {
    for (const module of entry.modules) {
      assert.ok(existsSync(join(repoRoot, module)), `${entry.id}: 容器模块不在仓内：${module}`);
    }
  }
});

test("V-A7.1 白名单坐标校验为负例可辨：锚串消失或模块缺位即报违例（不静默通过）", () => {
  const missingAnchor = ORG_LAYER_WHITELIST.map((entry, index) =>
    index === 0 ? { ...entry, specAnchor: "本串不会出现在规格里-负例" } : entry
  );
  const anchorVerdict = validateOrgLayerWhitelist({ specText, repoRoot, whitelist: missingAnchor });
  assert.equal(anchorVerdict.ok, false, "锚串消失必须报违例");
  assert.ok(anchorVerdict.violations.some((item) => item.includes("规格锚")));

  const missingModule = ORG_LAYER_WHITELIST.map((entry, index) =>
    index === 0 ? { ...entry, modules: ["lib/org/no-such-module.js"] } : entry
  );
  const moduleVerdict = validateOrgLayerWhitelist({ specText, repoRoot, whitelist: missingModule });
  assert.equal(moduleVerdict.ok, false, "容器模块缺位必须报违例");
  assert.ok(moduleVerdict.violations.some((item) => item.includes("容器模块")));
});

test("V-A7.1／V-A7.2 扫描当前树：白名单齐备、组织层件内零模型特定假设", () => {
  const scanned = scanDurabilityFace(repoRoot);
  assert.deepEqual(scanned.violations, [], `当前树应为零违例：${JSON.stringify(scanned.violations)}`);
  assert.equal(scanned.ok, true);
  assert.ok(scanned.scanned >= ORG_LAYER_WHITELIST.length, "扫描覆盖面须达到全部白名单条目");
  assert.deepEqual(scanned.hits, [], "正例下不得有命中件");
});

test("V-A7.2 模型假设扫描可判：注入模型名即报违例、注释行豁免（说明≠假设）", () => {
  const injected = scanModelAssumptions([
    {
      path: "lib/org/fake-org-layer.js",
      text: [
        "// 注释里提到 gpt-4o 不构成组织层假设（说明豁免）",
        "const model = \"gpt-4o\";",
        "const ctx = 128k;"
      ].join("\n")
    }
  ]);
  assert.equal(injected.ok, false, "注入模型名的组织层件必须转红");
  assert.deepEqual(injected.hits, ["lib/org/fake-org-layer.js"]);
  assert.equal(injected.violations.length, 2, `注释行豁免、非注释两行各一违例：${JSON.stringify(injected.violations)}`);
  assert.ok(injected.violations.some((item) => item.includes("gpt")));
  assert.ok(injected.violations.some((item) => item.includes("128k")));

  const clean = scanModelAssumptions([
    { path: "lib/org/clean.js", text: "// claude-3 只是注释\nconst s = \"岗位卡派生\";" }
  ]);
  assert.deepEqual(clean, { ok: true, scanned: 1, violations: [], hits: [] });
  assert.ok(MODEL_ASSUMPTION_TOKENS.length > 0, "禁记号表不得为空");
});

test("V-A7.2 词元表覆盖国产模型族名（doubao／ernie／hunyuan／minimax 及中文通称）", () => {
  const injected = scanModelAssumptions([
    {
      path: "lib/org/fake-domestic.js",
      text: [
        "const a = \"doubao\";",
        "const b = \"ernie\";",
        "const c = \"hunyuan\";",
        "const d = \"minimax\";",
        "const e = \"通义\";"
      ].join("\n")
    }
  ]);
  assert.equal(injected.ok, false, "国产模型族名写进组织层件必须转红");
  assert.equal(injected.violations.length, 5, `五行各一违例：${JSON.stringify(injected.violations)}`);
});

test("V-A7.1 宿主适配面只扫**容器协议**区（条目内容＝运行时资产，模型 pin 不属假设）", () => {
  const entry = ORG_LAYER_WHITELIST.find((item) => item.id === "host-face-registry-container");
  assert.ok(entry, "宿主适配面登记表容器协议须在白名单内");
  assert.ok(entry.region?.untilMarker, "该条须声明容器协议区上界（条目内容不在扫描面内）");
  const sources = collectOrgLayerSources(repoRoot).filter((source) => source.path === "lib/host-faces.js");
  assert.equal(sources.length, 1, "宿主适配面文件须被采集一次");
  assert.ok(
    !sources[0].text.includes("HF-CONFIG-IDS"),
    "容器协议区不得包含条目内容（HOST_FACES 条目在标记之后被截断）"
  );
});

test("V-A7.1 知识库容器协议扫描面含共享面写者审计件（D6 判据坐标已点名）", () => {
  const entry = ORG_LAYER_WHITELIST.find((item) => item.id === "knowledge-container");
  assert.ok(entry, "知识库容器协议条目须在白名单内");
  assert.ok(entry.modules.includes("lib/org/knowledge-shared-face.js"),
    "knowledge-shared-face.js（共享面写者审计）是知识库容器协议的组织层件之一，须入白名单与扫描面");
  assert.ok(collectOrgLayerSources(repoRoot).some((source) => source.path === "lib/org/knowledge-shared-face.js"),
    "扫描采集面须实际覆盖该件");
});

// ===================== 缝① 岗位细节只住三处（V-A7.2） =====================

test("V-A7.2 岗位细节三处封闭枚举齐备，且各自坐标可解析", () => {
  const verdict = validateRoleDetailHomes({ repoRoot });
  assert.deepEqual(verdict.violations, [], `三处坐标须全解析：${JSON.stringify(verdict.violations)}`);
  assert.deepEqual(
    ROLE_DETAIL_HOMES.map((home) => home.id),
    ["role-card-tier-field", "prompt-segment", "instance-config"],
    "三处＝岗位卡第 7 字段／提示段／实例配置（多一处即分界面破口）"
  );
  const tier = ROLE_DETAIL_HOMES.find((home) => home.id === "role-card-tier-field");
  assert.ok(ROLE_CARD_FIELDS.includes(tier.fieldKey), "第 7 字段须是岗位卡字段集成员");
});

test("V-A7.2 岗位卡第 7 字段在契约面留空（用户域）——模型档位不写进组织层件", () => {
  const verdict = validateRoleDetailHomes({ repoRoot });
  assert.equal(verdict.cardsWithTier.length, 0, "契约面任何卡填了档位即违例（V-A7.2 的机械面）");
});

test("V-A7.2 提示段是派生物：卡面档位非空时入段、为空时不出段（同一渲染器）", async () => {
  const { ROLE_CARDS, renderPostPromptSegment } = await import("../lib/org/role-cards.js");
  const card = ROLE_CARDS.find((item) => item.slug === "researcher");
  assert.ok(!renderPostPromptSegment(card).includes("模型档位"), "留空即不入段");
  const withTier = { ...card, modelTier: "用户域档位样例" };
  assert.ok(renderPostPromptSegment(withTier).includes("用户域档位样例"), "档位派生自卡面（无第二份提示文本）");
});

// ===================== 缝② D1–D11 表述与覆写出处（V-A7.3） =====================

const {
  DURABILITY_CRITERIA,
  OVERRIDDEN_CRITERIA_IDS,
  VALUE_STATEMENT_REQUIRED_PHRASES,
  AMPLIFICATION_DESIGN_REQUIRED_PHRASES,
  scanDurabilitySpec
} = await import("../lib/org/durability.js");

test("V-A7.3 D1–D11 逐条在册：每条有表述、规格锚与落地坐标；被覆写的 D5／D8 记覆写出处", () => {
  assert.deepEqual(
    DURABILITY_CRITERIA.map((item) => item.id),
    ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11"],
    "恒久判据清单＝D1–D11（多一条或少一条即清单破口）"
  );
  for (const criterion of DURABILITY_CRITERIA) {
    assert.ok(/^D(1[01]|[1-9])$/.test(criterion.id), `${criterion.id}: 判据 id 形状`);
    assert.ok(criterion.statement.trim() !== "", `${criterion.id}: 缺表述（表述本身即规格锚：须在 §J 逐字在册）`);
    assert.ok(Array.isArray(criterion.coordinates) && criterion.coordinates.length > 0, `${criterion.id}: 须有落地坐标`);
  }
  assert.deepEqual([...OVERRIDDEN_CRITERIA_IDS], ["D5", "D8"], "被覆写判据恰为 D5／D8");
});

test("V-A7.3 文档扫描：规格 §J 逐条有对应表述、覆写出处注明、无表外判据号", () => {
  const verdict = scanDurabilitySpec(specText);
  assert.deepEqual(verdict.violations, [], `规格扫描应零违例：${JSON.stringify(verdict.violations)}`);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.checked, DURABILITY_CRITERIA.length);
  assert.deepEqual(verdict.criteriaIds, ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11"]);
});

test("V-A7.3 文档扫描为负例可辨：表述消失／覆写出处缺失／表外判据号各报违例", () => {
  const dropped = specText.replace("D10＝复杂度递增", "复杂度递增");
  const droppedVerdict = scanDurabilitySpec(dropped);
  assert.equal(droppedVerdict.ok, false);
  assert.ok(droppedVerdict.violations.some((item) => item.includes("D10")), "表述消失须点名判据号");

  const noOverride = specText.replace("覆写出处＝07 号票", "覆写出处＝工具面票");
  const overrideVerdict = scanDurabilitySpec(noOverride);
  assert.equal(overrideVerdict.ok, false);
  assert.ok(overrideVerdict.violations.some((item) => item.includes("覆写出处")));

  const rogue = specText.replace("D11＝无岗位以 danger-full-access", "D12＝无岗位以 danger-full-access");
  const rogueVerdict = scanDurabilitySpec(rogue);
  assert.equal(rogueVerdict.ok, false);
  assert.ok(rogueVerdict.violations.some((item) => item.includes("D12")), "表外判据号即清单破口");
});

test("价值表述与放大验证设计在规格 §J 中可核（裸实例＝同基础工具面、无组织命令）", () => {
  assert.ok(VALUE_STATEMENT_REQUIRED_PHRASES.includes("同基础工具面"));
  assert.ok(VALUE_STATEMENT_REQUIRED_PHRASES.includes("无组织命令"));
  assert.ok(AMPLIFICATION_DESIGN_REQUIRED_PHRASES.length > 0);
  const section = scanDurabilitySpec(specText).section;
  for (const phrase of [...VALUE_STATEMENT_REQUIRED_PHRASES, ...AMPLIFICATION_DESIGN_REQUIRED_PHRASES]) {
    assert.ok(section.includes(phrase), `规格 §J 须含「${phrase}」`);
  }
  const withoutValue = specText.replace("同基础工具面", "同工具面");
  const verdict = scanDurabilitySpec(withoutValue);
  assert.equal(verdict.ok, false, "价值表述要件缺失即违例（不许退化成口号）");
  assert.ok(verdict.violations.some((item) => item.includes("同基础工具面")));
});

// ===================== 缝③ 岗位评测集形状（V-A7.4） =====================

const {
  ROLE_EVAL_SET,
  EVAL_OUTPUT_FORMATS,
  EVAL_SET_VERSION,
  FOUR_ELEMENT_KEYS,
  sampleTouchstone,
  validateRoleEvalSet,
  evalSamplesForPost,
  evalRoutineIdFor
} = await import("../lib/org/durability.js");

const { ROLE_CARDS } = await import("../lib/org/role-cards.js");
const { PROBE_COMMAND_NAMES, probeCommand, argsMatchArgKeys } = await import("../lib/org/probe.js");
const { validateBrief, BRIEF_KEYS } = await import("../lib/org/brief.js");
const { REPORT_KEYS } = await import("../lib/org/review-kit.js");
const { PACKET_PIECES } = await import("../lib/org/human-inbox.js");
const { ROUTINE_REGISTRY, expandRoutine } = await import("../lib/org/dispatch-config.js");

test("V-A7.4 岗位评测集形状成立：五类角色类别各有 1–3 个冻结样本、id 唯一、版本在档", () => {
  const verdict = validateRoleEvalSet({});
  assert.deepEqual(verdict.violations, [], `评测集形状应零违例：${JSON.stringify(verdict.violations)}`);
  assert.ok(EVAL_SET_VERSION.startsWith("org-v2/role-eval-set@"), "评测集须带版本号（冻结件换形即换号）");
  const seen = new Set();
  for (const sample of ROLE_EVAL_SET) {
    assert.ok(!seen.has(sample.id), `样本 id 重复：${sample.id}`);
    seen.add(sample.id);
    assert.ok(!Number.isNaN(Date.parse(sample.frozenAt)), `${sample.id}: frozenAt 须可解析（冻结时点）`);
  }
  for (const card of ROLE_CARDS) {
    const samples = evalSamplesForPost(card.slug);
    assert.ok(samples.length >= 1 && samples.length <= 3, `${card.slug}: 样本数须 1–3，实得 ${samples.length}`);
    for (const sample of samples) assert.equal(sample.post, card.slug);
  }
  assert.deepEqual(verdict.coverage.map((entry) => entry.post), ROLE_CARDS.map((card) => card.slug));
});

test("V-A7.4 每岗至少一个可执行评测项：判据在白名单内、参数键逐字一致、样本派生于岗位卡契约", () => {
  const byPost = new Map();
  for (const sample of ROLE_EVAL_SET) {
    byPost.set(sample.post, (byPost.get(sample.post) ?? 0) + 1);
    const verdict = validateBrief(sample.brief);
    assert.equal(verdict.ok, true, `${sample.id}: 样本简报须合法（判据可执行）：${JSON.stringify(verdict)}`);
    assert.ok(sample.brief.acceptance.length >= 1, `${sample.id}: 判据不得为空`);
    for (const criterion of sample.brief.acceptance) {
      assert.ok(PROBE_COMMAND_NAMES.includes(criterion.probe), `${sample.id}: probe 须在白名单内`);
      assert.ok(argsMatchArgKeys(criterion.args, probeCommand(criterion.probe)), `${sample.id}: 参数键须逐字一致`);
    }
    assert.match(sample.derivedFrom, /^role-card:[a-z-]+#ioContract$/, `${sample.id}: 样本须声明派生于岗位卡契约`);
    assert.equal(sample.derivedFrom, `role-card:${sample.post}#ioContract`, `${sample.id}: 派生来源须是其 home 岗的卡面`);
  }
  assert.equal(byPost.size, ROLE_CARDS.length, "每类角色类别都要有评测项");
});

test("样本本身过换模型试金石：模型记号／散文式判据／缺试金石记录各报违例", () => {
  const clean = ROLE_EVAL_SET[0];
  assert.equal(sampleTouchstone(clean).ok, true);
  assert.match(clean.touchstone.survivesBecause, /.+/);

  const withModel = sampleTouchstone({ ...clean, brief: { ...clean.brief, goal: "在 gpt-4o 下跑样本" } });
  assert.equal(withModel.ok, false, "样本含模型记号即未过试金石（样本不得依赖特定模型）");
  assert.ok(withModel.violations.some((item) => item.includes("模型记号")));

  const proseCriterion = {
    ...clean,
    brief: {
      ...clean.brief,
      acceptance: [{ probe: "fs.contains", args: { location: "pod-workspaces/{{botId}}/x.json", text: "报告须完整引用全部来源。" } }]
    }
  };
  const prose = sampleTouchstone(proseCriterion);
  assert.equal(prose.ok, false, "散文式判据＝依赖特定模型输出风格，须报违例");
  assert.ok(prose.violations.some((item) => item.includes("输出风格")));

  const noReason = sampleTouchstone({ ...clean, touchstone: { verdict: "pass", survivesBecause: "" } });
  assert.equal(noReason.ok, false, "缺试金石理由即未过（不得空壳声明）");
});

test("判据与输出格式单源：fs.contains 文本恰为声明格式的结构记号（未登记记号即违例）", () => {
  for (const sample of ROLE_EVAL_SET) {
    const format = EVAL_OUTPUT_FORMATS.find((entry) => entry.id === sample.format);
    assert.ok(format, `${sample.id}: 输出格式须在册`);
    assert.ok(format.prescribedBy.trim() !== "", `${sample.format}: 格式须点名其契约来源`);
    assert.ok(Array.isArray(format.markers) && format.markers.length > 0, `${sample.format}: 格式须有结构记号集`);
    for (const criterion of sample.brief.acceptance) {
      if (criterion.probe !== "fs.contains") continue;
      assert.ok(format.markers.includes(criterion.args.text),
        `${sample.id}: 判据文本「${criterion.args.text}」须是该格式的结构记号（不得是自由散文）`);
    }
  }
  const rogue = sampleTouchstone({
    ...ROLE_EVAL_SET[0],
    brief: {
      ...ROLE_EVAL_SET[0].brief,
      acceptance: [{ probe: "fs.contains", args: { location: "pod-workspaces/{{botId}}/x.json", text: "未登记记号" } }]
    }
  });
  assert.equal(rogue.ok, false, "表外记号即违例");
  assert.ok(rogue.violations.some((item) => item.includes("结构记号")));
});

test("评测集样本的判据记号派生自真源枚举（四要素／裁定包五件／复核报告键）", () => {
  assert.deepEqual([...FOUR_ELEMENT_KEYS], ["goal", "deliverables", "sources", "boundaries", "acceptance"]);
  for (const key of FOUR_ELEMENT_KEYS) assert.ok(BRIEF_KEYS.includes(key), `四要素记号 ${key} 须是简报契约键`);
  const packet = EVAL_OUTPUT_FORMATS.find((entry) => entry.id === "decision-packet");
  assert.deepEqual([...packet.markers], [...PACKET_PIECES], "裁定包记号＝裁定包五件（同一枚举）");
  const report = EVAL_OUTPUT_FORMATS.find((entry) => entry.id === "review-report");
  assert.deepEqual([...report.markers], [...REPORT_KEYS], "复核报告记号＝复核报告键（同一枚举）");
});

test("V-A7.4 评测例程登记项齐备：每样本一例程、触发源＝模型指派变更、展开产物过简报校验", () => {
  for (const sample of ROLE_EVAL_SET) {
    const routineId = evalRoutineIdFor(sample);
    const entry = ROUTINE_REGISTRY.find((item) => item.routineId === routineId);
    assert.ok(entry, `${sample.id}: 评测例程未登记（${routineId}）`);
    assert.equal(entry.trigger.kind, "event");
    assert.equal(entry.trigger.source, "registry:model-assignment-changed", "触发源＝注册表模型指派变更");
    assert.equal(entry.budget, null, "预算缝显式登记（数值属用户域）");
    const brief = expandRoutine(routineId, { botId: "bot-x", model: "样例模型档位" });
    const verdict = validateBrief(brief);
    assert.equal(verdict.ok, true, `${routineId}: 展开产物须为合法简报：${JSON.stringify(verdict)}`);
    assert.ok(brief.goal.includes("样例模型档位"), "展开产物须点名新模型（评测在新模型下跑）");
    const artifact = brief.deliverables[0].location;
    assert.ok(artifact.includes("bot-x"), "交付物坐标须代入受影响实例（工件落该实例 workspace）");
    assert.ok(!artifact.includes("{{"), "展开后不得残留占位符");
  }
});

// ===================== 缝④ 升级例程四步可执行（V-A7.4） =====================

const {
  UPGRADE_ROUTINE_STEPS,
  MODEL_UPGRADE_TRIGGER_SOURCE,
  assignmentKeyOf,
  planModelUpgradeEval
} = await import("../lib/org/durability.js");

const { createTaskLedger } = await import("../lib/org/task-ledger.js");
const { createLedgerHost } = await import("../lib/org/ledger-host.js");
const { internals } = await import("../lib/index.js");

const BEFORE = Object.freeze({ provider: "样例厂商", model: "样例模型一", reasoningEffort: "" });
const AFTER = Object.freeze({ provider: "样例厂商", model: "样例模型二", reasoningEffort: "high" });

function mkHome(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("升级例程四步在案：①触发登记 ②新模型跑评测集 ③做减法（只动三处）④用户终裁，每步有落地坐标", () => {
  assert.deepEqual(UPGRADE_ROUTINE_STEPS.map((step) => step.id), ["trigger", "execute", "subtract", "final-ruling"]);
  for (const step of UPGRADE_ROUTINE_STEPS) {
    assert.ok(step.statement.trim() !== "", `${step.id}: 缺步骤表述`);
    assert.ok(Array.isArray(step.coordinates) && step.coordinates.length > 0, `${step.id}: 缺落地坐标`);
  }
  const subtract = UPGRADE_ROUTINE_STEPS.find((step) => step.id === "subtract");
  assert.ok(subtract.statement.includes("只许动岗位细节三处"), "③做减法须锁「只动岗位细节三处」");
  const ruling = UPGRADE_ROUTINE_STEPS.find((step) => step.id === "final-ruling");
  assert.ok(ruling.statement.includes("用户终裁"), "④须是用户终裁（评测不自动生效）");
  assert.equal(MODEL_UPGRADE_TRIGGER_SOURCE, "registry:model-assignment-changed");
});

test("①触发计划：该岗位全部评测样本各开一张 duty 任务，幂等窗＝实例×样本×目标指派", () => {
  const plan = planModelUpgradeEval({ botId: "bot-a", post: "researcher", before: BEFORE, after: AFTER });
  assert.equal(plan.action, "register");
  const samples = evalSamplesForPost("researcher");
  assert.equal(plan.assignments.length, samples.length, "样本各一例程任务");
  // 期望值独立于实现：指派串与窗按**字面量**写死（不由被测助手回推——否则断言自我满足）
  assert.equal(assignmentKeyOf(AFTER), "样例厂商/样例模型二@high", "指派身份串＝provider/model@effort");
  assert.equal(assignmentKeyOf(BEFORE), "样例厂商/样例模型一", "无推理等级时无 @ 分量");
  assert.equal(assignmentKeyOf({ provider: "", model: "", reasoningEffort: "" }), "unassigned");
  for (const assignment of plan.assignments) {
    assert.equal(assignment.routineId, `eval-${assignment.sampleId}`);
    assert.equal(assignment.window, `bot-a:${assignment.sampleId}:样例厂商/样例模型二@high`);
    assert.equal(assignment.vars.botId, "bot-a");
    assert.ok(assignment.vars.model.includes("样例模型二"), "展开变量须点名目标模型");
  }
  assert.equal(plan.to, "样例厂商/样例模型二@high");
  assert.equal(plan.from, "样例厂商/样例模型一");
});

test("①触发负例：未绑岗位／目标指派为空／缺实例 id 一律显式 skip（不静默、不产生任务）", () => {
  const unbound = planModelUpgradeEval({ botId: "bot-v1", post: "", before: BEFORE, after: AFTER });
  assert.equal(unbound.action, "skip");
  assert.deepEqual(unbound.assignments, []);
  assert.ok(unbound.reason.includes("未绑 home 岗位"), `理由须点名未绑岗位：${unbound.reason}`);

  const cleared = planModelUpgradeEval({ botId: "bot-a", post: "researcher", before: BEFORE, after: { provider: "", model: "", reasoningEffort: "" } });
  assert.equal(cleared.action, "skip", "解绑模型不属升级（不登记评测）");
  assert.ok(cleared.reason.includes("指派为空"));

  const noId = planModelUpgradeEval({ botId: "", post: "researcher", before: BEFORE, after: AFTER });
  assert.equal(noId.action, "skip");
  assert.ok(noId.reason.includes("实例 id"));

  const unknownPost = planModelUpgradeEval({ botId: "bot-a", post: "no-such-post", before: BEFORE, after: AFTER });
  assert.equal(unknownPost.action, "skip", "未知岗位无评测样本（fail closed，不静默登记）");
});

test("V-A7.4 ④用户终裁必审钩：评测样本简报 reviewPoints 含 before-external-visibility", () => {
  for (const sample of ROLE_EVAL_SET) {
    assert.deepEqual(sample.brief.reviewPoints, ["before-external-visibility"],
      `样本 ${sample.id}：评测结论在投递用户终裁（对外可见）前必须经复核件套——reviewPoints 不得为空`);
  }
});

test("plan 跳过理由逐前提列名：多前提同缺不合并成单条（reasons 全列、reason 取首条兼容）", () => {
  const multi = planModelUpgradeEval({ botId: "", post: "", before: BEFORE, after: AFTER });
  assert.equal(multi.action, "skip");
  assert.ok(Array.isArray(multi.reasons), "跳过结论须携带 reasons 全列");
  assert.ok(multi.reasons.length >= 2, `缺实例 id＋未绑岗位两前提同缺须逐一列名：${JSON.stringify(multi.reasons)}`);
  assert.ok(multi.reasons.some((item) => item.includes("实例 id")));
  assert.ok(multi.reasons.some((item) => item.includes("home 岗位")));
  assert.equal(multi.reason, multi.reasons[0], "reason＝首条（日志摘要兼容面）");
});

test("①触发：host 登记腿把评测任务落成 class=duty 任务；同窗重放不产生第二张（V-A2.10 幂等）", async () => {
  const home = mkHome("dsh-durability-host-");
  try {
    const ledger = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home });
    const host = createLedgerHost({ ledger, logger: { warn() {} } });
    const first = await host.registerModelUpgradeEval({ botId: "bot-a", post: "researcher", before: BEFORE, after: AFTER });
    assert.equal(first.action, "register");
    assert.equal(first.registered.length, 1);
    assert.equal(first.registered[0].ok, true);
    const task = ledger.tasks().find((item) => item.taskId === first.registered[0].taskId);
    assert.equal(task.class, "duty", "评测任务＝class duty");
    assert.equal(task.routineId, "eval-researcher-report");
    assert.ok(task.brief.goal.includes("样例模型二"), "任务目标点名新模型");
    assert.ok(task.brief.acceptance[0].args.location.startsWith("pod-workspaces/bot-a/eval/"), "判据坐标落受影响实例 workspace");
    // ②步绑定：任务与受影响实例的绑定写在台账事件里（routineId＋window 幂等窗含实例 id
    // 与目标指派），不只写在目标文案里——「新模型下由谁跑」可事后从台账投影回核
    const intake = ledger.taskEvents(task.taskId).find((event) => event.type === "intake");
    assert.equal(intake.routineId, "eval-researcher-report");
    assert.equal(intake.window, "bot-a:researcher-report:样例厂商/样例模型二@high", "幂等窗即实例×样本×目标指派的绑定面");
    assert.equal(intake.class, "duty");

    const again = await host.registerModelUpgradeEval({ botId: "bot-a", post: "researcher", before: BEFORE, after: AFTER });
    assert.equal(again.registered[0].replayed, true, "同窗重放＝既有任务（不产生第二张）");
    assert.equal(ledger.tasks().length, 1, "台账任务数不变");

    const other = await host.registerModelUpgradeEval({ botId: "bot-a", post: "researcher", before: AFTER, after: { provider: "样例厂商", model: "样例模型三", reasoningEffort: "" } });
    assert.equal(ledger.tasks().length, 2, "换目标指派＝新窗，另开一张评测任务");
    assert.equal(other.registered[0].replayed, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("①触发：登记失败也广播投影——失败留痕不等下一拍（人间收件箱即时可见）", async () => {
  const home = mkHome("dsh-durability-broadcast-");
  try {
    const real = createTaskLedger({ ...CRITERION_INJECTION, dshHome: home });
    const failing = { ...real, triggerRoutine: () => ({ ok: false, code: "injected-failure", reason: "注入的登记失败" }) };
    let broadcasts = 0;
    const host = createLedgerHost({ ledger: failing, broadcast: () => { broadcasts += 1; }, logger: { warn() {} } });
    const result = await host.registerModelUpgradeEval({ botId: "bot-a", post: "researcher", before: BEFORE, after: AFTER });
    assert.equal(result.registered[0].ok, false, "注入的失败须如实回传");
    assert.equal(broadcasts, 1, "登记失败（前置门通过、落台账失败）也须广播投影——人间收件箱不等下一拍");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("V-A7.4 端到端：patch 改实例模型指派 → 台账自动登记 duty 评测任务（不依赖用户记得手动跑）", async () => {
  const home = mkHome("dsh-durability-patch-");
  try {
    internals.writeRegistryAtomic(home, {
      bot: {
        id: "bot", name: "", role: "", permission: "workspace-write", readOnly: false,
        port: 3131, createdAt: "2026-09-20T00:00:00.000Z", post: "researcher",
        modelProvider: "", model: ""
      },
      unbound: {
        id: "unbound", name: "", role: "", permission: "workspace-write", readOnly: false,
        port: 3132, createdAt: "2026-09-20T00:00:00.000Z", post: "",
        modelProvider: "", model: ""
      }
    });
    const api = new internals.BotsApi({ logger: { warn() {}, info() {} } }, home, null);
    api.ledgerHost = internals.createLedgerHost({
      ledger: internals.createTaskLedger({ ...CRITERION_INJECTION, dshHome: home }),
      logger: { warn() {} }
    });

    const changed = await api.patch("bot", { modelProvider: "样例厂商", model: "样例模型二" });
    assert.equal(changed.modelUpgradeEval.action, "register");
    assert.equal(changed.modelUpgradeEval.registered[0].ok, true, "变更指派即自动登记评测任务");
    const tasks = api.ledgerHost.ledger.tasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].class, "duty");
    assert.equal(tasks[0].routineId, "eval-researcher-report");
    assert.equal(tasks[0].owner, null, "自动登记＝进队列待派（不代替派单）");
    assert.ok(tasks[0].brief.goal.includes("样例模型二"));

    // 未绑 home 岗位的实例：显式 skip（不静默、不虚构评测面）
    const skipped = await api.patch("unbound", { modelProvider: "样例厂商", model: "样例模型二" });
    assert.equal(skipped.modelUpgradeEval.action, "skip");
    assert.ok(skipped.modelUpgradeEval.reason.includes("未绑 home 岗位"));
    assert.equal(api.ledgerHost.ledger.tasks().length, 1, "未绑岗位不得产生评测任务");

    // 台账未接线（bot 实例进程）：显式告警＋结论带实况，patch 本身不失败
    const unwired = new internals.BotsApi({ logger: { warn() {}, info() {} } }, home, null);
    const result = await unwired.patch("bot", { model: "样例模型三" });
    assert.equal(result.modelUpgradeEval.wired, false, "未接线须在结论件里可见（不假装登记成功）");
    assert.deepEqual(result.modelUpgradeEval.registered, []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ===================== 评审加固：闭包／扫描区／派生真源／坐标／出处（各带负例） =====================

const {
  validateCriteriaCoordinates,
  validateOverrideProvenance,
  checkEvalRoutineTrigger,
  formatMarkers,
  DERIVATION_ENUMS
} = await import("../lib/org/durability.js");

test("V-A7.1 封闭枚举带负例：删一类即报「缺类别」（清单是冻结字面量，不是自我派生）", () => {
  const withoutOne = ORG_LAYER_WHITELIST.filter((entry) => entry.id !== "role-card-fields");
  const verdict = validateOrgLayerWhitelist({ specText, repoRoot, whitelist: withoutOne });
  assert.equal(verdict.ok, false, "少一类必须报违例（此前的自我派生版会静默通过）");
  assert.ok(verdict.violations.some((item) => item.includes("缺类别 role-card-fields")), JSON.stringify(verdict.violations));

  const extra = [...ORG_LAYER_WHITELIST, { ...ORG_LAYER_WHITELIST[0], id: "rogue-category" }];
  const extraVerdict = validateOrgLayerWhitelist({ specText, repoRoot, whitelist: extra });
  assert.ok(extraVerdict.violations.some((item) => item.includes("未登记类别")), "多一类同样即枚举破口");
});

test("V-A7.1 扫描区 fail closed：容器协议区标记消失即报违例，且该件不与 PASS 同形", () => {
  const rogue = ORG_LAYER_WHITELIST.map((entry) => (entry.id === "host-face-registry-container"
    ? { ...entry, region: { ...entry.region, untilMarker: "export const NO_SUCH_MARKER" } }
    : entry));
  const verdict = validateOrgLayerWhitelist({ specText, repoRoot, whitelist: rogue });
  assert.equal(verdict.ok, false, "标记消失必须 fail closed（不许静默退回全文件扫）");
  assert.ok(verdict.violations.some((item) => item.includes("上界标记不在册")), JSON.stringify(verdict.violations));
  const sources = collectOrgLayerSources(repoRoot, rogue).filter((item) => item.path === "lib/host-faces.js");
  assert.equal(sources[0].text, "", "收集面对标记缺失件给空文本（结论不静默放行）");
});

test("V-A7.4 记号真源可解析带负例：锚不在册／枚举被另抄一份各报违例", () => {
  const formats = EVAL_OUTPUT_FORMATS;
  const rogueAnchor = formats.map((format) => (format.id === "markdown-report"
    ? { ...format, derivation: { ...format.derivation, anchor: "不存在的契约锚" } }
    : format));
  const anchorVerdict = validateRoleEvalSet({ formats: rogueAnchor });
  assert.equal(anchorVerdict.ok, false);
  assert.ok(anchorVerdict.violations.some((item) => item.includes("派生锚")), JSON.stringify(anchorVerdict.violations));

  const rogueCopy = formats.map((format) => (format.id === "review-report"
    ? { ...format, markers: ["verdict", "gaps"] }
    : format));
  const copyVerdict = validateRoleEvalSet({ formats: rogueCopy });
  assert.equal(copyVerdict.ok, false, "记号另抄一份（不再是真源枚举）即违例");
  assert.ok(copyVerdict.violations.some((item) => item.includes("不等")), JSON.stringify(copyVerdict.violations));

  assert.deepEqual([...formatMarkers("decision-packet")], [...DERIVATION_ENUMS.PACKET_PIECES]);
  assert.throws(() => formatMarkers("no-such-format"), /未知评测输出格式/);
});

test("V-A7.4 派生声明须落到真在册卡面（不再只正则查形状）", () => {
  const rogue = ROLE_EVAL_SET.map((sample, index) => (index === 0
    ? { ...sample, derivedFrom: "role-card:no-such-post#ioContract" }
    : sample));
  const verdict = validateRoleEvalSet({ evalSet: rogue });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.violations.some((item) => item.includes("不在册")), JSON.stringify(verdict.violations));
});

test("V-A7.3 判据坐标可解析带负例：坐标模块不在仓内即违例（坐标不再只查非空）", () => {
  assert.deepEqual(validateCriteriaCoordinates({ repoRoot }).violations, []);
  const rogue = DURABILITY_CRITERIA.map((criterion) => (criterion.id === "D1"
    ? { ...criterion, coordinates: ["lib/org/no-such-module.js（负例）"] }
    : criterion));
  const verdict = validateCriteriaCoordinates({ repoRoot, criteria: rogue });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.violations.some((item) => item.includes("不在仓内")), JSON.stringify(verdict.violations));
});

test("V-A7.3 覆写出处可回核到裁定件带负例：裁定件不在册／锚不在裁定正文即违例", () => {
  assert.deepEqual(validateOverrideProvenance({ repoRoot }).violations, [], "D5／D8 的覆写出处须能回核 07 号票裁定件");
  const rogueTicket = DURABILITY_CRITERIA.map((criterion) => (criterion.id === "D5"
    ? { ...criterion, overrideSource: { ...criterion.overrideSource, ticket: "99" } }
    : criterion));
  const ticketVerdict = validateOverrideProvenance({ repoRoot, criteria: rogueTicket });
  assert.equal(ticketVerdict.ok, false);
  assert.ok(ticketVerdict.violations.some((item) => item.includes("裁定件不在册")), JSON.stringify(ticketVerdict.violations));

  const rogueAnchor = DURABILITY_CRITERIA.map((criterion) => (criterion.id === "D8"
    ? { ...criterion, overrideSource: { ...criterion.overrideSource, rulingAnchor: "不存在的裁定锚" } }
    : criterion));
  const anchorVerdict = validateOverrideProvenance({ repoRoot, criteria: rogueAnchor });
  assert.equal(anchorVerdict.ok, false);
  assert.ok(anchorVerdict.violations.some((item) => item.includes("裁定锚")), JSON.stringify(anchorVerdict.violations));
});

test("V-A7.4 触发源声明是承重的（登记腿前置门）：来源不符／非事件型即拒", () => {
  const real = ROUTINE_REGISTRY.find((entry) => entry.routineId === "eval-researcher-report");
  assert.equal(checkEvalRoutineTrigger(real).ok, true, "在册评测例程须过触发源核验");
  const wrongSource = checkEvalRoutineTrigger({ trigger: { kind: "event", source: "mail-plane:whatever" } });
  assert.equal(wrongSource.ok, false);
  assert.equal(wrongSource.code, "eval-routine-trigger-mismatch");
  const wrongKind = checkEvalRoutineTrigger({ trigger: { kind: "periodic", source: MODEL_UPGRADE_TRIGGER_SOURCE } });
  assert.equal(wrongKind.ok, false);
  assert.equal(wrongKind.code, "eval-routine-trigger-kind");
});

test("V-A7.4 评测集版本与覆盖面在结论件里可读（冻结件版本有消费面，不是自说自话）", () => {
  const verdict = validateRoleEvalSet({});
  assert.equal(verdict.version, EVAL_SET_VERSION);
  assert.ok(verdict.version.startsWith("org-v2/role-eval-set@"), "版本串形状");
  assert.equal(verdict.coverage.reduce((sum, entry) => sum + entry.samples, 0), ROLE_EVAL_SET.length);
  for (const entry of verdict.coverage) {
    assert.ok(entry.executableItems >= 1, `${entry.post}: 每岗至少一个可执行评测项`);
  }
});
