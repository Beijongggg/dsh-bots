#!/usr/bin/env node
/**
 * create-bot.js — scaffold a standalone "bot mode" DSH profile.
 *
 * A bot is an independent DSH profile; launch it with:
 *   dsh --profile <botId> web --port <port> --no-open
 *
 * Usage:
 *   node create-bot.js \
 *     --root <target root> \
 *     --id <botId> \
 *     --name <display name> \
 *     --role <role description> \
 *     --model-provider <provider> \
 *     --model <model> \
 *     [--permission <mode>] [--port <port>] [--workspace <dir>]
 *
 * This script writes:
 *   <root>/profiles/<botId>/package.json       profile metadata + bundles
 *   <root>/profiles/<botId>/cordis.patch.yml   patch layer (model pin, persona, sandbox/approval, optional tool disables)
 *   <root>/bot-workspaces/<botId>/             bot workspace (or the --workspace path)
 *
 * Note: <root>/bots.json (the bot registry incl. id/port assignment) is owned
 * by the host plugin — this script never reads or writes it.
 *
 * Pure Node.js, no third-party dependencies (shared helpers come from
 * ../lib/shared.cjs, part of the same package). All filesystem access is
 * synchronous.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Shared pure helpers (yamlQuote / patch builder / llm-pi-ai sync / constants) —
// single source of truth in lib/shared.cjs, also used by the host plugin.
const {
  BUNDLES,
  PERMISSION_MODES,
  DEFAULT_PERMISSION,
  buildPatchYaml,
  syncPiAiSection
} = require("../lib/shared.cjs");

const BOT_ID_RE = /^[a-z0-9-]+$/;

const USAGE = `Usage:
  node create-bot.js --root <root> --id <botId> --name <name> --role <role> \\
    --model-provider <provider> --model <model> [--reasoning-effort <id>] \\
    [--permission <mode>] [--port <port>] [--workspace <dir>]`;

/** Print an error to stderr and exit 1. */
function fail(message) {
  process.stderr.write(`error: ${message}\n\n${USAGE}\n`);
  process.exit(1);
}

/** Expand a leading "~" to the current user's home directory. */
function expandTilde(p) {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Convert a --kebab-case flag name to camelCase (read-only -> readOnly). */
function camelize(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Parse "--key value" / "--key=value" pairs plus boolean flags into an object. */
function parseArgs(argv) {
  const valueOpts = new Set(["root", "id", "name", "role", "model-provider", "model", "reasoning-effort", "permission", "port", "workspace"]);
  const flagOpts = new Set(["read-only"]);
  const out = {
    root: null,
    id: null,
    name: null,
    role: null,
    modelProvider: null,
    model: null,
    reasoningEffort: null,
    permission: null,
    readOnly: false,
    port: null,
    workspace: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) fail(`unexpected argument "${raw}"`);
    const eq = raw.indexOf("=");
    const key = raw.slice(2, eq >= 0 ? eq : undefined);
    let value = eq >= 0 ? raw.slice(eq + 1) : null;
    if (flagOpts.has(key)) {
      if (value !== null) fail(`option --${key} does not take a value`);
      out[camelize(key)] = true;
      continue;
    }
    if (!valueOpts.has(key)) fail(`unknown option --${key}`);
    if (value === null) {
      if (i + 1 >= argv.length) fail(`option --${key} requires a value`);
      value = argv[++i];
    }
    out[camelize(key)] = value;
  }
  return out;
}

/** Build the <root>/profiles/<botId>/package.json document. */
function buildPackageJson(botId) {
  return (
    JSON.stringify(
      {
        name: `dsh-profile-${botId}`,
        private: true,
        dependencies: {},
        dsh: {
          profile: {
            bundles: BUNDLES,
          },
        },
      },
      null,
      2
    ) + "\n"
  );
}

// ---------------------------------------------------------------------------
// Parse & validate arguments.
// ---------------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));

const root = path.resolve(expandTilde(args.root ?? path.join(os.homedir(), ".dsh")));

const errors = [];
if (!args.id) errors.push("--id is required");
else if (!BOT_ID_RE.test(args.id))
  errors.push(`--id "${args.id}" is invalid: must match ^[a-z0-9-]+$ (lowercase letters, digits, hyphens only)`);
if (!args.name) errors.push("--name is required");
if (!args.role) errors.push("--role is required");
if (!args.modelProvider) errors.push("--model-provider is required");
if (!args.model) errors.push("--model is required");
const permission = args.permission ?? (args.readOnly ? "read-only" : DEFAULT_PERMISSION);
if (!PERMISSION_MODES.includes(permission)) {
  errors.push(`--permission "${permission}" is invalid: must be one of ${PERMISSION_MODES.join(", ")}`);
}
if (args.port !== null) {
  const port = Number(args.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    errors.push(`--port "${args.port}" is not a valid port number (1024-65535)`);
}
if (!fs.existsSync(root)) errors.push(`--root "${root}" does not exist`);
else if (!fs.statSync(root).isDirectory()) errors.push(`--root "${root}" is not a directory`);
if (errors.length > 0) {
  process.stderr.write(`error:\n${errors.map((e) => `  - ${e}`).join("\n")}\n\n${USAGE}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Resolve target paths.
// ---------------------------------------------------------------------------
const botId = args.id;
const profilesDir = path.join(root, "profiles", botId);
const pkgPath = path.join(profilesDir, "package.json");
const patchPath = path.join(profilesDir, "cordis.patch.yml");

// Workspace: an explicit --workspace wins (absolute as-is, relative resolved
// against cwd); otherwise <root>/bot-workspaces/<botId>.
let workspace;
if (args.workspace !== null) {
  const given = expandTilde(args.workspace);
  workspace = path.isAbsolute(given) ? path.resolve(given) : path.resolve(process.cwd(), given);
} else {
  workspace = path.join(root, "bot-workspaces", botId);
}

// ---------------------------------------------------------------------------
// Write everything (synchronous, idempotent).
// ---------------------------------------------------------------------------
try {
  const pkgExisted = fs.existsSync(pkgPath);
  const patchExisted = fs.existsSync(patchPath);

  fs.mkdirSync(profilesDir, { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });

  fs.writeFileSync(pkgPath, buildPackageJson(botId));
  // Ensure the per-bot settings file exists (idempotent; never overwrite user edits).
  // Older hosts use the patch's settings.path redirect; current hosts use Config.
  const botSettingsPath = path.join(profilesDir, "settings.yaml");
  if (!fs.existsSync(botSettingsPath)) {
    fs.writeFileSync(botSettingsPath, "agent-presets:\n  default: bot-nopersona\n", "utf8");
  }

  // Ensure pnpm-workspace.yaml exists (idempotent; same as the host plugin's
  // builtin scaffold fallback, so both scaffold paths stay equivalent).
  const workspaceYamlPath = path.join(profilesDir, "pnpm-workspace.yaml");
  if (!fs.existsSync(workspaceYamlPath)) {
    fs.writeFileSync(workspaceYamlPath, "packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n", "utf8");
  }

  // Sync the global llm-pi-ai settings section into this bot's settings.yaml
  // (idempotent; implementation shared in ../lib/shared.cjs).
  syncPiAiSection(root, botId);

  fs.writeFileSync(patchPath, buildPatchYaml({
    botId,
    role: args.role,
    provider: args.modelProvider,
    model: args.model,
    reasoningEffort: args.reasoningEffort,
    permission,
    workspace,
    settingsPath: botSettingsPath,
    settingsText: fs.readFileSync(botSettingsPath, "utf8"),
    previousPatch: patchExisted ? fs.readFileSync(patchPath, "utf8") : ""
  }));

  // Report.
  console.log(`Bot profile "${botId}" scaffolded under ${profilesDir}`);
  if (pkgExisted) console.log(`overwrite: ${pkgPath}`);
  if (patchExisted) console.log(`overwrite: ${patchPath}`);
  console.log("created:");
  console.log(`  ${pkgPath}`);
  console.log(`  ${patchPath}`);
  console.log(`  ${workspace}${path.sep}`);
  const runHint = args.port !== null ? `--port ${Number(args.port)}` : "--port <pick-a-port>";
  console.log(`run: dsh --profile ${botId} web ${runHint} --no-open`);
  process.exit(0);
} catch (err) {
  fail(`failed to write bot profile: ${err.message}`);
}
