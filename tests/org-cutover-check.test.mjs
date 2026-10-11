/** 16 号票：切换检查 CLI 接缝。数据根全为临时夹具，子进程不得更改注册表。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deploymentInventory } from "../lib/org/deployment-inventory.js";
import { createCutoverReadiness } from "../lib/org/cutover-readiness.js";
import { createTaskLedger } from "../lib/org/task-ledger.js";
import { createCapabilityIssuer } from "../lib/org/capability-issue.js";
import { createCapabilityDelivery } from "../lib/org/capability-delivery.js";
import { createLedgerHost } from "../lib/org/ledger-host.js";
import { createPostChannel } from "../lib/org/post-channel.js";
import { internals } from "../lib/index.js";
import { writeInstanceRow } from "./helpers/capability-fixture.mjs";
import { deployProbeRows, twoSeatRegistry } from "./helpers/readiness-fixture.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = (args) => new Promise((resolve) => execFile(process.execPath,
  [join(root, "scripts", "org-cutover-check.mjs"), ...args],
  { maxBuffer: 4 * 1024 * 1024 },
  (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));

test("旧四席或未部署状态返回非零，报告准确列出缺口且运行面零写入", async () => {
  const home = await mkdtemp(join(tmpdir(), "dsh-cutover-"));
  const original = JSON.stringify({ lead: { id: "lead", port: 3101 } });
  try {
    await mkdir(join(home, "pod"));
    await writeFile(join(home, "pod", "bots.json"), original);
    const result = await run(["--dsh-home", home]);
    assert.equal(result.code, 1, result.stderr);
    assert.ok(result.stdout.length > 0, JSON.stringify(result));
    const report = JSON.parse(result.stdout);
    assert.equal(report.ready, false);
    assert.equal(report.coordinates.ok, true);
    assert.equal(report.coordinates.scanned, 60);
    assert.equal(report.roster.minimalComplete, false);
    assert.deepEqual(report.roster.missing, ["duty-coordinator", "implementer"]);
    assert.ok(report.deployment.files.some((row) => row.path === "lib/index.js" && row.state === "missing"));
    assert.equal(report.runtime.ok, false, "未给运行宿主不得算就绪");
    assert.equal(await readFile(join(home, "pod", "bots.json"), "utf8"), original);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("切换 CLI 只在部署、双席代际通道与近期 deploy 探针全齐时就绪；缺测试资源或多旧席都阻断", async () => {
  const home = await mkdtemp(join(tmpdir(), "dsh-cutover-ready-"));
  const inventory = deploymentInventory(root);
  const registry = twoSeatRegistry();
  const issuer = createCapabilityIssuer({ dshHome: home });
  const ledger = createTaskLedger({ dshHome: home });
  issuer.bindLedger(ledger);
  const rows = deployProbeRows();
  const host = createLedgerHost({ ledger, issuer, probeHostContract: async () => ({
    face: "deploy", results: rows, counts: { pass: rows.length, fail: 0, skip: 0 }, gatePass: true
  }) });
  host.delivery = createCapabilityDelivery({ host, readRegistry: () => registry });
  host.readiness = createCutoverReadiness({ host, readRegistry: () => registry, sourceDigest: inventory.sourceDigest });
  const server = createServer((req, res) => {
    if (req.url === "/api/pod/_csrf") { res.end(JSON.stringify({ token: "test" })); return; }
    internals.handleApi(req, res, { ledgerHost: host });
  });
  try {
    for (const { path } of inventory.files) {
      await mkdir(dirname(join(home, "plugins/pod", path)), { recursive: true });
      await copyFile(join(root, path), join(home, "plugins/pod", path));
    }
    await mkdir(join(home, "pod"), { recursive: true });
    await writeFile(join(home, "pod/bots.json"), JSON.stringify(registry));
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const botId of Object.keys(registry)) {
      writeInstanceRow(home, botId);
      const child = new EventEmitter();
      Object.assign(child, { pid: process.pid, connected: true });
      let credential;
      child.send = (message) => { credential = message.credential; };
      host.delivery.attach(botId, child);
      child.emit("message", { type: "pod:org-ready", botId, sourceDigest: inventory.sourceDigest });
      const post = createPostChannel({ origin, botId, credential: () => credential });
      assert.equal((await post.ready()).ok, true);
    }
    const args = ["--dsh-home", home, "--host-url", origin];
    const beforeProbe = await run(args);
    assert.equal(beforeProbe.code, 1, beforeProbe.stderr);
    await host.tick();
    const ready = await run(args);
    assert.equal(ready.code, 0, ready.stderr || ready.stdout);
    const report = JSON.parse(ready.stdout);
    assert.equal(report.ready, true);
    assert.equal(report.runtime.channels.length, 2);
    assert.equal(JSON.stringify(report.runtime).includes("token"), false);
    const actualReadiness = host.readiness;
    host.readiness = () => ({ schema: report.runtime.schema, sourceDigest: inventory.sourceDigest, ok: true });
    assert.equal((await run(args)).code, 1, "不采信缺少运行证据的自报就绪");
    host.readiness = () => ({ ...actualReadiness(), capturedAt: "2020-01-01T00:00:00.000Z" });
    assert.equal((await run(args)).code, 1, "旧就绪回执不可重放为当前就绪");
    host.readiness = () => ({ ...actualReadiness(), sourceDigest: "0".repeat(64) });
    assert.equal((await run(args)).code, 1, "复制代码但未重启宿主不可就绪");
    host.readiness = actualReadiness;
    delete registry.implementer.model;
    await writeFile(join(home, "pod/bots.json"), JSON.stringify(registry));
    assert.equal((await run(args)).code, 1, "模型指派未填的实例不得就绪");
    registry.implementer.model = "fixture-model";
    await writeFile(join(home, "pod/bots.json"), JSON.stringify(registry));
    const resource = "tests/host-contract-gate.test.mjs";
    assert.ok(report.deployment.files.some((row) => row.path === resource), "探针失效处置所需资源纳入部署清单");
    await rm(join(home, "plugins/pod", resource));
    assert.equal((await run(args)).code, 1, "缺测试资源不得就绪");
    await copyFile(join(root, resource), join(home, "plugins/pod", resource));
    registry.legacy = { id: "legacy", post: "researcher", pid: process.pid };
    await writeFile(join(home, "pod/bots.json"), JSON.stringify(registry));
    assert.equal((await run(args)).code, 1, "切换编制必须恰为双席，不把残留旧席当成可选增席");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    host.delivery.close();
    ledger.close();
    await rm(home, { recursive: true, force: true });
  }
});
