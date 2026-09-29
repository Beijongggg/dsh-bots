/** Bot profile generation is observable through the documents consumed by DSH. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { internals } from "../lib/index.js";

const logger = { info() {}, warn() {}, error() {} };

async function withProfile(mode, run) {
  const root = mkdtempSync(join(tmpdir(), "dsh-bot-profile-"));
  const previousScript = process.env.DSH_BOTS_CREATE_BOT_SCRIPT;
  process.env.DSH_BOTS_CREATE_BOT_SCRIPT = mode === "builtin"
    ? join(root, "missing-create-bot.cjs")
    : fileURLToPath(new URL("../scripts/create-bot.cjs", import.meta.url));
  const bot = { id: "worker", name: "Worker", role: "implementation", port: 3291,
    modelProvider: "local-route", model: "model-a", permission: "workspace-write" };
  const profile = join(root, "profiles", bot.id);
  mkdirSync(profile, { recursive: true });
  try { await run({ root, profile, bot, scaffold: () => internals.scaffoldBot({ logger }, root, bot) }); }
  finally {
    if (previousScript === undefined) delete process.env.DSH_BOTS_CREATE_BOT_SCRIPT;
    else process.env.DSH_BOTS_CREATE_BOT_SCRIPT = previousScript;
    rmSync(root, { recursive: true, force: true });
  }
}

test("两条 profile 生成路径把已有 provider 配置交给当前宿主，保留用户参数", async () => {
  for (const mode of ["script", "builtin"]) await withProfile(mode, async ({ profile, scaffold }) => {
    const settings = "agent-presets:\n  default: bot-nopersona\n"
      + "llm-pi-ai:\n  providers:\n    local-route:\n      api: openai-completions\n"
      + "      baseURL: https://example.invalid/v1\n      headers: {x-client: bot}\n"
      + "      models:\n        - id: model-a\n          contextWindow: 123456\n"
      + "unrelated:\n  keep: true\n";
    const settingsPath = join(profile, "settings.yaml");
    writeFileSync(settingsPath, settings);
    await scaffold();
    const patch = readFileSync(join(profile, "cordis.patch.yml"), "utf8");
    assert.ok(patch.includes("- id: llm-pi-ai\n  config:\n    providers:\n      local-route:\n"
      + "        api: openai-completions\n        baseURL: https://example.invalid/v1\n"
      + "        headers: {x-client: bot}\n        models:\n          - id: model-a\n"
      + "            contextWindow: 123456\n"), `${mode}: 当前 profile 缺少用户 provider`);
    assert.ok(!patch.includes("unrelated:"), `${mode}: 不迁移其他 settings 段`);
    assert.equal(readFileSync(settingsPath, "utf8"), settings, `${mode}: 旧文件保留`);
  });
});

test("重生成 profile 保留已迁移后的当前模型配置，不用旧 settings 覆盖用户修改", async () => {
  for (const mode of ["script", "builtin"]) await withProfile(mode, async ({ profile, bot, scaffold }) => {
    writeFileSync(join(profile, "settings.yaml"), "llm-pi-ai:\n  providers: {old-route: {models: [{id: old-model}]}}\n");
    const current = "- id: 'llm-pi-ai'\n  config:\n    providers:\n      changed-route:\n"
      + "        api: openai-completions\n        baseURL: https://changed.invalid/v2\n"
      + "        models: [{id: model-b, maxTokens: 5432}]\n        timeoutMs: 2468\n";
    writeFileSync(join(profile, "cordis.patch.yml"), current);
    bot.modelProvider = "changed-route";
    bot.model = "model-b";
    await scaffold();
    const patch = readFileSync(join(profile, "cordis.patch.yml"), "utf8");
    assert.ok(patch.includes(current), `${mode}: 当前模型配置必须保留`);
    assert.ok(!patch.includes("old-route"), `${mode}: 不重新套用旧配置`);
    assert.ok(patch.includes("provider: 'changed-route'\n    model: 'model-b'"));
    await scaffold();
    assert.equal(readFileSync(join(profile, "cordis.patch.yml"), "utf8"), patch,
      `${mode}: 重生成不改变当前配置`);
  });
});
