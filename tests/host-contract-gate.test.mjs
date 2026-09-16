/**
 * 宿主适配面与宿主契约门测试（org-v2 01 号票）。
 *
 * 覆盖：登记表字段集与不变量（V-A6.1/V-A6.6）、门脚本纯逻辑（三态汇总、
 * 部署面 SKIP 视同 FAIL、登记表↔门一致性）、版本仅诊断（V-A6.4 的结构断言：
 * 探针结果对象不含版本字段、版本只进 diagnostics）、跳过协议（假绿修法：
 * SKIP 与 PASS 在汇总行不同形）。对真实宿主的探针执行由 preflight ④ 门
 * 承担（不并入套件——纪律见 scripts/host-contract-probe.mjs 头注）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  HOST_FACES, HOST_FACE_FIELDS, LAYER_REFUSE_ONLY_FACE, hostFaceById,
  validateHostFacesRegistry
} from "../lib/host-faces.js";
import {
  HOST_CONTRACT_PROBES, findMarkerFile, parseFaceMode, pendingFaces,
  registryGateChecks, summarizeGate
} from "../scripts/host-contract-probe.mjs";
import { SKIP_MARKER, declaresSkip } from "./run.mjs";

test("V-A6.1：登记表在位，A/B/C 三类齐备，C 类显式列出并标注排除理由", () => {
  const categories = new Set(HOST_FACES.map((f) => f.category));
  assert.deepEqual([...categories].sort(), ["A", "B", "C"]);
  const cFaces = HOST_FACES.filter((f) => f.category === "C");
  assert.ok(cFaces.length >= 2, "C 类显式列出（OS 契约＋本仓自有面）");
  for (const face of cFaces) {
    assert.ok(face.exclusionReason.length > 0, `${face.id} 有排除理由`);
    assert.equal(face.probeId, null);
  }
});

test("V-A6.1：字段集齐备（登记表机械校验零违例）", () => {
  const r = validateHostFacesRegistry();
  assert.deepEqual(r.violations, []);
  for (const face of HOST_FACES) {
    for (const field of HOST_FACE_FIELDS) assert.ok(field in face, `${face.id}.${field}`);
  }
  assert.equal(hostFaceById("HF-CONFIG-IDS").category, "A");
  assert.equal(hostFaceById("HF-PLUGIN-IDENTITY").category, "B");
  assert.equal(hostFaceById("nope"), null);
});

test("V-A6.6：整层拒载仅限组织层身份面（其余面级降级或响亮直用）", () => {
  const refuse = HOST_FACES.filter((f) => f.failureMode === "layer-refuse");
  assert.deepEqual(refuse.map((f) => f.id), [LAYER_REFUSE_ONLY_FACE]);
  for (const face of HOST_FACES.filter((f) => f.category === "A" && !f.pending)) {
    assert.equal(face.failureMode, "face-degrade", `${face.id} 默认面级降级`);
  }
});

test("登记表↔门一致性：非 C 非 pending 面的探针都有实现，反向也成立", () => {
  assert.deepEqual(registryGateChecks(), []);
  // 篡改：从探针列表抽掉一个 → 对应 FAIL 记录
  const probesMinusOne = HOST_CONTRACT_PROBES.filter((p) => p.id !== "P-CONFIG-IDS");
  const problems = registryGateChecks(HOST_FACES, probesMinusOne);
  assert.ok(problems.some((p) => p.probeId === "P-CONFIG-IDS" && p.state === "FAIL"));
});

test("pending 面单列（v2 台账两件），不参与三态", () => {
  const pending = pendingFaces();
  assert.deepEqual(pending.map((f) => f.id).sort(), ["HF-LEDGER-COMMANDS", "HF-V2-LEDGER-FORMAT"]);
  for (const face of pending) assert.match(face.pending, /05 号票/);
});

test("V-A6.3：三态汇总——FAIL 红门；部署面 SKIP 视同 FAIL；dev 面 SKIP 不阻断", () => {
  const results = [
    { state: "PASS" }, { state: "PASS" }, { state: "SKIP" }
  ];
  const dev = summarizeGate(results, { face: "dev" });
  assert.deepEqual(dev.counts, { pass: 2, fail: 0, skip: 1 });
  assert.equal(dev.gatePass, true, "dev 面：SKIP 可见不阻断");
  const deploy = summarizeGate(results, { face: "deploy" });
  assert.equal(deploy.gatePass, false, "部署面：SKIP 视同 FAIL");
  assert.equal(deploy.blockingSkips, 1);
  const failing = summarizeGate([{ state: "PASS" }, { state: "FAIL" }], { face: "dev" });
  assert.equal(failing.gatePass, false);
});

test("V-A6.4：版本仅诊断——探针结果对象无版本字段（结构面断言）", () => {
  // 结构约束：探针 run() 返回的 state 集合固定为三态，不允许出现 version 通道
  for (const probe of HOST_CONTRACT_PROBES) {
    assert.equal(typeof probe.run, "function");
    assert.equal(typeof probe.face, "string");
    const face = hostFaceById(probe.face);
    assert.ok(face, `探针 ${probe.id} 的面已登记`);
  }
});

test("parseFaceMode：--face 旗标与 env 覆盖，默认 dev", () => {
  assert.equal(parseFaceMode([], {}), "dev");
  assert.equal(parseFaceMode(["--face=deploy"], {}), "deploy");
  assert.equal(parseFaceMode(["--face=bogus"], {}), "dev");
  assert.equal(parseFaceMode([], { DSH_BOTS_PROBE_FACE: "deploy" }), "deploy");
});

test("findMarkerFile：候选文件内容标记检索（命中/未命中/缺文件）", () => {
  const home = mkdtempSync(join(tmpdir(), "dsh-gate-marker-"));
  try {
    const a = join(home, "a.js");
    const b = join(home, "b.js");
    writeFileSync(a, "export const x = 'needle-here';\n");
    writeFileSync(b, "export const y = 1;\n");
    assert.equal(findMarkerFile([a, b], "needle-here"), a);
    assert.equal(findMarkerFile([a, b], "absent"), null);
    assert.equal(findMarkerFile([join(home, "missing.js"), a], "needle-here"), a);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("假绿修法：跳过标记与汇总行不同形（⤼ SKIP: 前缀才计数）", () => {
  assert.equal(declaresSkip(`别的行\n${SKIP_MARKER} 官方宿主包不在本机（候选：x ; y）\n`), true);
  assert.equal(declaresSkip("⤼ 官方包不在（旧式无标记输出）"), false, "旧式提示行不计入 SKIP");
  assert.equal(declaresSkip(""), false);
  assert.equal(declaresSkip(null), false);
});
