/**
 * 岗位卡契约面回归（org-v2 04 号票；规格 §A 与附录 A 执行坐标）。
 *
 * 判据落点：
 *   - `V-A1.1` 五类角色类别各有岗位卡、八字段齐备、「放大机制」非空 → 本模块（回归记录）
 *   - `V-A1.2` slug 英文契约主键稳定：改显示名后工具与权限命名空间不变 → 本模块（负例）
 *   - `V-A4.2` 岗位卡是唯一源、提示段是派生物；构建期漂移校验在漂移时失败
 *     → scripts/role-card-drift-check.mjs（本模块以子进程调它，取退出码）
 *
 * 只测外部行为：卡面数据形状与校验结论、渲染派生物、命名空间派生、漂移脚本的
 * 退出码与负例判定；不触真实注册表、不写真实 ~/.dsh。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROLE_CARDS,
  ROLE_CARD_FIELDS,
  ROLE_CARD_FIELD_LABELS,
  NOT_STANDALONE_ASSIGNMENTS,
  STANDING_POST_SLUGS,
  deriveNamespaces,
  isRoleSlug,
  isStandingPost,
  normalizePostField,
  permissionNamespace,
  renderAllPostSegments,
  renderPostPromptSegment,
  roleSlugs,
  roleCardBySlug,
  toolNamespace,
  validateHostFaceRefs,
  validateNotStandalone,
  validateRoleCards,
} from "../lib/org/role-cards.js";
import { HOST_FACES } from "../lib/host-faces.js";
import { computeDrift, readReference, runDriftCheck } from "../scripts/role-card-drift-check.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_SLUGS = [
  "duty-coordinator",
  "project-lead",
  "researcher",
  "implementer",
  "verifier",
];

test("V-A1.1a 五类角色类别各有岗位卡：slug 集齐、八字段齐备、放大机制非空", () => {
  assert.deepEqual([...roleSlugs()].sort(), [...EXPECTED_SLUGS].sort());
  assert.equal(ROLE_CARD_FIELDS.length, 8, "岗位卡字段集＝八字段");
  for (const label of Object.values(ROLE_CARD_FIELD_LABELS)) {
    assert.equal(typeof label, "string");
    assert.notEqual(label.trim(), "");
  }
  assert.deepEqual(Object.keys(ROLE_CARD_FIELD_LABELS).sort(), [...ROLE_CARD_FIELDS].sort());

  const result = validateRoleCards();
  assert.deepEqual(result.violations, [], "在册岗位卡自校验零违例");
  assert.equal(result.ok, true);

  for (const card of ROLE_CARDS) {
    for (const field of ROLE_CARD_FIELDS) {
      assert.ok(field in card, `${card.slug} 缺字段 ${field}`);
      if (field === "modelTier") continue; // 用户域留空，另断
      const value = card[field];
      const text = Array.isArray(value) ? value.join("") : String(value ?? "");
      assert.notEqual(text.trim(), "", `${card.slug}.${field} 不得为空`);
    }
    assert.notEqual(card.amplification.trim(), "", `${card.slug} 放大机制必填（填不出即不设该岗）`);
    assert.match(card.slug, /^[a-z][a-z0-9-]*$/, "slug 为英文契约主键");
    assert.notEqual(card.displayName.trim(), "", `${card.slug} 需有中文显示名`);
    assert.equal(card.modelTier, "", `${card.slug} 模型档位属用户域，契约面留空`);
    assert.ok(Array.isArray(card.hostDependency), `${card.slug} 第 8 字段为面 id 引用数组`);
  }
});

test("V-A1.2 改显示名后工具与权限命名空间不变（负例）", () => {
  for (const slug of EXPECTED_SLUGS) {
    const card = roleCardBySlug(slug);
    assert.deepEqual(
      deriveNamespaces({ ...card, displayName: `改名后-${slug}` }),
      deriveNamespaces(card),
      `${slug}: 改显示名不得动命名空间`
    );
    assert.ok(!JSON.stringify(deriveNamespaces(card)).includes(card.displayName));
  }
  assert.equal(toolNamespace("researcher"), "tool:researcher");
  assert.equal(permissionNamespace("researcher"), "perm:researcher");
  // 反向：命名空间确由 slug 派生（改 slug 即改命名空间）
  assert.notEqual(toolNamespace("researcher"), toolNamespace("implementer"));
  assert.throws(() => toolNamespace("研究员"), /slug/);
  assert.throws(() => permissionNamespace(""), /slug/);
});

test("提示段是卡的派生物：字段进段、改字段即改段、面 id 只引不抄坐标", () => {
  const card = roleCardBySlug("researcher");
  const text = renderPostPromptSegment(card);

  assert.ok(text.includes(card.displayName), "段内需有显示名");
  assert.ok(text.includes(card.slug), "段内需有契约主键");
  for (const field of ["responsibility", "trigger", "ioContract", "boundaries", "rationale", "amplification"]) {
    assert.ok(text.includes(card[field]), `段内应含 ${field} 的卡文本`);
    assert.ok(text.includes(ROLE_CARD_FIELD_LABELS[field]), `段内应有 ${field} 的中文字段名`);
  }
  for (const faceId of card.hostDependency) {
    assert.ok(text.includes(faceId), `段内应含面 id ${faceId}`);
  }
  assert.ok(!/模型档位/.test(text), "模型档位留空时不出现在段内");

  // 派生性：任一字段变动 → 段随之变（防退化成硬编码文案）
  for (const field of ROLE_CARD_FIELDS) {
    const mutated = field === "hostDependency"
      ? { ...card, hostDependency: [...card.hostDependency, "HF-SESSION-LOG"] }
      : { ...card, [field]: field === "modelTier" ? "opus" : `${card[field]}（改）` };
    assert.notEqual(renderPostPromptSegment(mutated), text, `${field} 变动应体现在段内`);
  }
  assert.ok(renderPostPromptSegment({ ...card, displayName: "改名后的研究员" }).includes("改名后的研究员"));

  // 不重复坐标：第 8 字段只引面 id，段内不出现宿主坐标文本
  const depLine = text.split("\n").find((line) => line.includes(ROLE_CARD_FIELD_LABELS.hostDependency));
  const ids = depLine.match(/HF-[A-Z0-9-]+/g) ?? [];
  assert.deepEqual(ids, card.hostDependency);
  assert.ok(!/ctx\.get|cordis|dsh-client-/.test(depLine), "依赖面行不得抄宿主坐标");

  const all = renderAllPostSegments();
  assert.deepEqual(Object.keys(all).sort(), [...EXPECTED_SLUGS].sort());
  assert.equal(all["verifier"], renderPostPromptSegment(roleCardBySlug("verifier")));
  assert.throws(() => renderPostPromptSegment({ ...card, slug: "研究员" }), /slug/);
});

test("不单设岗裁定落实：五条职责的归属岗位与卡面一致", () => {
  assert.deepEqual(
    NOT_STANDALONE_ASSIGNMENTS.map((a) => a.duty),
    ["分诊与验收初审", "知识维护与规程维护", "调度与派单", "模型升级评测", "设计"]
  );
  for (const a of NOT_STANDALONE_ASSIGNMENTS) {
    assert.notEqual(a.note.trim(), "", `${a.duty} 需注明裁定依据`);
    assert.ok(a.posts.length > 0, `${a.duty} 需有归属岗位`);
    for (const slug of a.posts) assert.equal(isRoleSlug(slug), true, `${a.duty} → 未知岗位 ${slug}`);
  }
  const r = validateNotStandalone();
  assert.deepEqual(r.violations, [], "在册卡面与不单设岗裁定一致");

  // 机械性：卡面丢掉该职责口径 → 违例可见（不是只靠人读）
  const stripped = ROLE_CARDS.map((c) =>
    c.slug === "implementer" ? { ...c, responsibility: "实施：按简报改工件。" } : c
  );
  const bad = validateNotStandalone(stripped);
  assert.equal(bad.ok, false);
  assert.ok(bad.violations.some((v) => /设计/.test(v)), `应报「设计」归属违例，实得 ${JSON.stringify(bad.violations)}`);
});

test("第 8 字段只引登记在册的宿主面：A/B 类可引、C 类非宿主面不可引", () => {
  const r = validateHostFaceRefs();
  assert.deepEqual(r.violations, [], "在册卡面的面引用全部可解析");
  const cFace = HOST_FACES.find((f) => f.category === "C");
  assert.ok(cFace !== undefined, "登记表应有 C 类非宿主面（负例前提）");

  const withBogus = ROLE_CARDS.map((c) =>
    c.slug === "researcher" ? { ...c, hostDependency: ["HF-NOPE", ...c.hostDependency] } : c
  );
  const rBogus = validateHostFaceRefs(withBogus);
  assert.equal(rBogus.ok, false);
  assert.ok(rBogus.violations.some((v) => v.includes("HF-NOPE")));

  const withC = ROLE_CARDS.map((c) =>
    c.slug === "researcher" ? { ...c, hostDependency: [cFace.id] } : c
  );
  const rC = validateHostFaceRefs(withC);
  assert.equal(rC.ok, false);
  assert.ok(rC.violations.some((v) => /C 类/.test(v)), `应报 C 类引用违例，实得 ${JSON.stringify(rC.violations)}`);

  const dup = ROLE_CARDS.map((c) =>
    c.slug === "researcher" ? { ...c, hostDependency: [c.hostDependency[0], c.hostDependency[0]] } : c
  );
  assert.equal(validateHostFaceRefs(dup).ok, false);
});

test("V-A4.2 构建期漂移校验：在册无漂移、改卡即报漂移、脚本退出码即结论", () => {
  const reference = readReference();
  assert.deepEqual(computeDrift(ROLE_CARDS, reference).violations, [], "在册卡面与渲染产物无漂移");

  const drifted = ROLE_CARDS.map((c) =>
    c.slug === "verifier" ? { ...c, amplification: `${c.amplification}（漂移）` } : c
  );
  const d = computeDrift(drifted, reference);
  assert.equal(d.ok, false);
  assert.ok(d.violations.some((v) => v.includes("verifier")), `应点名漂移岗位，实得 ${JSON.stringify(d.violations)}`);
  assert.equal(computeDrift(ROLE_CARDS.slice(0, -1), reference).ok, false, "少一张卡即漂移");
  assert.equal(
    computeDrift([...ROLE_CARDS, { ...ROLE_CARDS[0], slug: "extra-post" }], reference).ok,
    false,
    "多一张卡即漂移"
  );
  assert.equal(computeDrift(ROLE_CARDS, { ...reference, aggregate: "0".repeat(64) }).ok, false, "汇总哈希不符即漂移");

  const script = join(repoRoot, "scripts", "role-card-drift-check.mjs");
  const run = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(run.status, 0, `漂移脚本应零退出：${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /role-card-drift: OK（5\/5 卡，aggregate [0-9a-f]{12}）/);

  const dir = mkdtempSync(join(tmpdir(), "role-card-drift-"));
  try {
    const tampered = join(dir, "tampered.json");
    writeFileSync(tampered, `${JSON.stringify({ ...reference, aggregate: "0".repeat(64) }, null, 2)}\n`);
    const bad = spawnSync(process.execPath, [script, "--reference", tampered], { encoding: "utf8" });
    assert.equal(bad.status, 1, "参考件被改 → 脚本必须非零退出");
    assert.match(bad.stdout, /role-card-drift: FAIL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("V-A1.1b 岗位卡校验器：缺字段／空放大机制／重复 slug 各成违例", () => {
  const base = roleCardBySlug("researcher");
  const cases = [
    [{ ...base, slug: "x1", amplification: undefined }, /amplification/],
    [{ ...base, slug: "x2", amplification: "   " }, /放大机制/],
    [{ ...base, slug: "x3", trigger: "" }, /trigger/],
    [{ slug: "", displayName: "无 slug" }, /slug/],
  ];
  for (const [card, pattern] of cases) {
    const r = validateRoleCards([card]);
    assert.equal(r.ok, false, `应判违例：${JSON.stringify(pattern)}`);
    assert.ok(
      r.violations.some((v) => pattern.test(v)),
      `违例文本应含 ${pattern}，实得 ${JSON.stringify(r.violations)}`
    );
  }
  const dup = validateRoleCards([base, { ...base, displayName: "另一个显示名" }]);
  assert.equal(dup.ok, false);
  assert.ok(dup.violations.some((v) => /重复/.test(v)), "重复 slug 应报违例");
});

test("提示段由卡渲染派生（插件接线）：home 岗位决定岗位段，未知 slug 响亮告警", async () => {
  const { internals } = await import("../lib/index.js");
  const makeHarness = (entry) => {
    const captured = { sections: [], variables: [], warnings: [] };
    const systemPrompt = {
      variable: (name, fn) => { captured.variables.push({ name, fn }); return () => {}; },
      section: (e) => { captured.sections.push(e); return () => {}; }
    };
    const ctx = {
      get: (k) => (k === "systemPrompt" ? systemPrompt : undefined),
      logger: { warn: (m) => captured.warnings.push(m) }
    };
    internals.registerTeamPromptSection(ctx, { readRegistry: () => ({ bot: entry }) }, "bot");
    return captured;
  };

  const withPost = makeHarness({ id: "bot", name: "研究员", role: "调研", post: "researcher", createdAt: "2026-09-16" });
  const seg = withPost.sections.find((s) => s.name === "pod:post");
  assert.ok(seg !== undefined, "有 home 岗位时应注册岗位段");
  assert.equal(seg.text, renderPostPromptSegment(roleCardBySlug("researcher")), "段文本＝卡渲染产物（逐字）");
  assert.equal(seg.order, 19, "岗位段在团队段（order 20）之前");
  assert.deepEqual(withPost.warnings, []);

  const noPost = makeHarness({ id: "bot", name: "研究员", role: "调研", createdAt: "2026-09-16" });
  assert.equal(noPost.sections.some((s) => s.name === "pod:post"), false, "无 home 岗位不注册岗位段");

  const badPost = makeHarness({ id: "bot", name: "研究员", post: "chief-vibes-officer", createdAt: "2026-09-16" });
  assert.equal(badPost.sections.some((s) => s.name === "pod:post"), false, "未知 slug 不注册岗位段");
  assert.equal(badPost.warnings.length, 1, "未知 slug 必须响亮（不留静默失败）");
  assert.ok(badPost.warnings[0].includes("chief-vibes-officer"));
});

test("home 岗位字段入口校验：留空＝未绑岗位、未知 slug fail closed", () => {
  assert.deepEqual(normalizePostField(undefined), { ok: true, post: "" });
  assert.deepEqual(normalizePostField(null), { ok: true, post: "" });
  assert.deepEqual(normalizePostField("   "), { ok: true, post: "" });
  assert.deepEqual(normalizePostField(" researcher "), { ok: true, post: "researcher" });
  for (const bad of ["研究员", "chief-vibes-officer", "Verifier"]) {
    const r = normalizePostField(bad);
    assert.equal(r.ok, false, `${bad} 应被拒`);
    assert.ok(/不在岗位卡契约面/.test(r.error), `拒绝理由应点名契约面，实得 ${r.error}`);
  }
  assert.equal(normalizePostField(42).ok, false);
  assert.match(normalizePostField(42).error, /字符串/);
});

test("home 岗位写入口：patch 校验 fail closed、落表与解绑", async () => {
  const { internals } = await import("../lib/index.js");
  const home = mkdtempSync(join(tmpdir(), "dsh-role-post-"));
  try {
    internals.writeRegistryAtomic(home, {
      bot: {
        id: "bot", name: "研究员", role: "调研", permission: "workspace-write",
        readOnly: false, port: 3105, createdAt: "2026-09-16T00:00:00.000Z"
      }
    });
    const api = new internals.BotsApi({ logger: { warn() {}, info() {} } }, home, null);

    const bound = await api.patch("bot", { post: "researcher" });
    assert.equal(bound.bot.post, "researcher", "响应带回 home 岗位");
    assert.equal(internals.readRegistry(home).bot.post, "researcher", "并落注册表");

    await assert.rejects(
      () => api.patch("bot", { post: "chief-vibes-officer" }),
      (error) => error.status === 400 && /不在岗位卡契约面/.test(error.message)
    );
    assert.equal(internals.readRegistry(home).bot.post, "researcher", "被拒的改动不得落表");

    const unbound = await api.patch("bot", { post: "" });
    assert.equal(unbound.bot.post, "", "空串＝解绑 home 岗位");
    assert.equal(internals.readRegistry(home).bot.post, "");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("V-A4.2 卡面不合规时拒绝生成基准（违规不得被冻成新基准）", () => {
  const dir = mkdtempSync(join(tmpdir(), "role-card-update-"));
  const target = join(dir, "reference.json");
  try {
    const rogue = ROLE_CARDS.map((c) =>
      c.slug === "researcher" ? { ...c, modelTier: "opus" } : c
    );
    const refused = runDriftCheck({ cards: rogue, referencePath: target, update: true });
    assert.equal(refused.ok, false);
    assert.equal(refused.updated, false);
    assert.ok(refused.output[0].includes("拒绝重生成参考件"), refused.output[0]);
    assert.throws(() => readFileSync(target), "被拒的 --update 不得写出参考件");

    const written = runDriftCheck({ cards: ROLE_CARDS, referencePath: target, update: true });
    assert.equal(written.ok, true);
    assert.equal(written.updated, true);
    const roundtrip = runDriftCheck({ cards: ROLE_CARDS, referencePath: target });
    assert.equal(roundtrip.ok, true, roundtrip.output.join("\n"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("V-A1.2 命名空间漂移即报（构建期把守，不只靠单元测试）", () => {
  const reference = readReference();
  const drifted = reference.cards.map((c) =>
    c.slug === "researcher" ? { ...c, toolNamespace: "tool:renamed" } : c
  );
  const r = computeDrift(ROLE_CARDS, { ...reference, cards: drifted });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => /工具命名空间漂移/.test(v)), JSON.stringify(r.violations));
});

test("home 岗位只许常设岗：复核帽不入常驻编制（V-A1.3）", () => {
  assert.deepEqual(STANDING_POST_SLUGS, ["duty-coordinator", "project-lead", "researcher", "implementer"]);
  for (const slug of STANDING_POST_SLUGS) {
    assert.equal(isStandingPost(slug), true);
    assert.deepEqual(normalizePostField(slug), { ok: true, post: slug });
  }
  assert.equal(isStandingPost("verifier"), false);
  const verifier = normalizePostField("verifier");
  assert.equal(verifier.ok, false);
  assert.ok(/常设岗/.test(verifier.error) && /V-A1\.3/.test(verifier.error), verifier.error);
});

test("检索引导只进调研承载岗：「开工先 search」在研究员卡面（派生段）且不在全员共享段（10 号票 §G 检索引导）", () => {
  // 卡面：研究员承载检索引导（提示段是派生物，故断言卡面即断言段）
  const researcher = ROLE_CARDS.find((card) => card.slug === "researcher");
  const researchSegment = renderPostPromptSegment(researcher);
  assert.ok(researchSegment.includes("开工前先 knowledge_search"),
    "研究员岗位段须带「开工先 search」引导（§G：只写进调研承载岗）");

  // 其余岗位卡不得带——引导不全员灌
  for (const card of ROLE_CARDS) {
    if (card.slug === "researcher") continue;
    const segment = renderPostPromptSegment(card);
    assert.ok(!segment.includes("开工前先 knowledge_search"),
      `${card.slug} 岗位段不得带检索引导（只进调研承载岗）`);
  }

  // 全员共享的团队协作段也不得带（引导下沉到岗位段）
  const source = readFileSync(new URL("../lib/index.js", import.meta.url), "utf8");
  assert.ok(!source.includes("调研类任务开工前先 knowledge_search"),
    "团队协作提示段不得再全员灌「开工先 search」");
});
