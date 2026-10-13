/**
 * 17 号票①：组织通道挂载竞态与重挂路径。
 *
 * 竞态实况：交付条目只在 spawn 时挂（`lib/index.js` spawnBot），而 bot 自写实例行
 * （五字段代际行）在 spawn 后 ≈1.8s 才落盘，值守拍 5s——两拍之间 `live()` 判假即
 * 回收条目并摘掉 ready 监听 ⇒ 该 bot 的组织通道**永久缺失**，须人工重启才恢复。
 *
 * 本文件把装具限定在「进程替换」这一层：假子进程＝EventEmitter（照真 IPC 事件面
 * 派发 message/exit/disconnect），实例行用 `tests/helpers/capability-fixture.mjs`
 * 写**真实**五字段行——「行未落盘」＝最新行仍指上一代 pid，即真实竞态下的表况。
 * 签发/条目/读取面全部走实现本体，不 mock 内部协作件。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCapabilityDelivery } from "../lib/org/capability-delivery.js";
import { createCapabilityIssuer } from "../lib/org/capability-issue.js";
import { createTaskLedger } from "../lib/org/task-ledger.js";
import { writeInstanceRow } from "./helpers/capability-fixture.mjs";

const BOT_ID = "implementer";
const SOURCE_DIGEST = "d".repeat(64);

/**
 * 夹具：一个 bot、一个假子进程、一条**上一代**实例行（pid 已死）。
 * `landSelfRow()` ＝该 bot 进程自写本代行（真实窗口的结束点）。
 */
function rig({ post = "implementer" } = {}) {
  const home = mkdtempSync(join(tmpdir(), "dsh-channel-reattach-"));
  const sent = [];
  const child = new EventEmitter();
  Object.assign(child, {
    pid: process.pid,
    connected: true,
    send(message) { sent.push(message); }
  });
  const registry = { [BOT_ID]: { id: BOT_ID, post, pid: child.pid } };
  const staleRow = writeInstanceRow(home, BOT_ID, { alive: false, hostInstanceId: "host-previous-generation" });
  const now = () => Date.now();
  const issuer = createCapabilityIssuer({ dshHome: home, now });
  const ledger = createTaskLedger({ dshHome: home, now });
  issuer.bindLedger(ledger);
  const delivery = createCapabilityDelivery({
    host: { issuer, ledger, now, broadcastProjection() {} },
    readRegistry: () => registry
  });
  return {
    home, child, registry, staleRow, delivery,
    /** 该 bot 进程自写本代实例行（竞态窗口的结束）。返回写入的代际 id。 */
    landSelfRow() {
      const gen = `host-${child.pid}`;
      writeInstanceRow(home, BOT_ID, { pid: child.pid, hostInstanceId: gen });
      return gen;
    },
    emitReady() { child.emit("message", { type: "pod:org-ready", botId: BOT_ID, sourceDigest: SOURCE_DIGEST }); },
    credential() { return sent.find((message) => message.type === "pod:org-credential")?.credential; },
    channels() { return delivery.status().filter((row) => row.botId === BOT_ID); },
    close() { delivery.close(); ledger.close(); rmSync(home, { recursive: true, force: true }); }
  };
}

test("① 竞态拍：自注册行未落盘的过渡态不回收条目，行落盘后 ready 即挂上通道", () => {
  const r = rig();
  try {
    r.delivery.attach(BOT_ID, r.child);
    r.delivery.tick(); // 值守拍落在 spawn→自注册行落盘的窗口内（修前：条目在此被回收）
    assert.equal(r.channels().length, 1, "过渡态不得回收条目（回收即摘掉 ready 监听＝永久缺失）");
    assert.equal(r.credential(), undefined, "实例行未落盘：此刻不得签发实例凭据");

    const gen = r.landSelfRow();
    r.emitReady();
    const credential = r.credential();
    assert.ok(credential, "ready 到达后必须回执实例凭据");
    assert.equal(credential.botId, BOT_ID);
    assert.equal(credential.gen, gen, "凭据代际＝该 bot 自写实例行的 hostInstanceId");
    assert.match(credential.token, /^[a-f0-9]{64}$/);

    const [channel] = r.channels();
    assert.deepEqual(
      { connected: channel.connected, roleReady: channel.roleReady, sourceDigest: channel.sourceDigest },
      { connected: true, roleReady: true, sourceDigest: SOURCE_DIGEST },
      "通道三态：连上、角色能力在手、代码摘要随 ready 上报"
    );
    const delivered = r.delivery.read({ ...credential }, BOT_ID);
    assert.equal(delivered.ok, true, JSON.stringify(delivered));
    assert.deepEqual(delivered.capabilities.map((envelope) => envelope.payload.kind), ["role"],
      "重挂后的通道必须真能领到能力（不止回执形状对）");
  } finally { r.close(); }
});

test("① 变体：ready 先于自注册行到达——宣告不丢，行落盘后由值守拍补发凭据", () => {
  const r = rig();
  try {
    r.delivery.attach(BOT_ID, r.child);
    r.emitReady(); // 行未落盘：live() 判假，此刻不能签发
    assert.equal(r.credential(), undefined);
    r.delivery.tick();
    assert.equal(r.channels().length, 1, "宣告待补发期间条目不得被回收");

    const gen = r.landSelfRow();
    r.delivery.tick();
    assert.equal(r.credential()?.gen, gen, "实例行落盘后的第一拍补发凭据");
    assert.equal(r.channels()[0].connected, true);
  } finally { r.close(); }
});

test("① 路线 A：宿主仍持有子进程句柄时，ready 可重挂被摘除的条目", () => {
  const r = rig();
  try {
    const dispose = r.delivery.attach(BOT_ID, r.child);
    dispose();
    assert.equal(r.channels().length, 0, "摘除后条目不在册");
    const gen = r.landSelfRow();
    r.emitReady();
    assert.equal(r.credential()?.gen, gen, "回收不再等于永久缺失：宿主仍持句柄即可重挂");
    assert.equal(r.delivery.read({ ...r.credential() }, BOT_ID).ok, true);
  } finally { r.close(); }
});

test("① 反例：子进程已断开即回收，其后到达的 ready 不重建通道", () => {
  const r = rig();
  try {
    r.delivery.attach(BOT_ID, r.child);
    r.child.connected = false;
    r.delivery.tick();
    assert.equal(r.channels().length, 0, "断开的子进程必须回收");
    r.landSelfRow();
    r.emitReady();
    assert.equal(r.credential(), undefined, "已断开的子进程不得借 ready 重建通道");
  } finally { r.close(); }
});

test("① 反例：注册表已换到别的进程名下时回收，旧子进程的 ready 不抢回条目", () => {
  const r = rig();
  try {
    r.delivery.attach(BOT_ID, r.child);
    r.registry[BOT_ID].pid = process.pid + 1; // 该 bot 已被别的进程接管
    r.delivery.tick();
    assert.equal(r.channels().length, 0, "注册表换人即回收旧条目");
    r.landSelfRow();
    r.emitReady();
    assert.equal(r.credential(), undefined, "旧子进程不得把条目抢回来");
  } finally { r.close(); }
});

test("① 反例：常驻岗位之外的条目照旧不引导（不变式未被放宽）", () => {
  const r = rig({ post: "verifier" }); // 复核帽无常驻席位（role-cards：常设岗四词表之外）
  try {
    r.delivery.attach(BOT_ID, r.child);
    r.landSelfRow();
    r.emitReady();
    assert.equal(r.credential(), undefined, "非常驻岗位不引导组织通道");
  } finally { r.close(); }
});
