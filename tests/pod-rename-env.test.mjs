/**
 * pod 改名批 13 号票「B 组 env 双读」的机械面（规格附录 A V-P8.3 预留坐标）：
 * `POD_*` 优先、`DSH_BOTS_*` 回落，兼容一个窗口（规格 §F5）。
 *
 * 断言三层：
 *   ① helper 单元（lib/env-aliases.js）：新名优先（含显式空串）、旧名回落、
 *      双缺即 undefined、非 POD_ 前缀名原样直读（映射规则唯一：`POD_X` ↔
 *      `DSH_BOTS_X`，新增 POD_* 名自动获得回落）；
 *   ② 单源常量行为：`buildSpawnEnv` 逃生阀（ENV_EXTRA_VAR）与宿主环境缝
 *      （checkHostEnvSeam）在只设旧名时仍工作（回落语义落到真实读点）；
 *   ③ 缺省行为不变：双名皆缺时与旧实现同值（不凭空产出、不误回落）。
 *
 * 本件内的 `DSH_BOTS_*` 字面量是**双读回落测试夹具**（兼容窗口的故意残留，
 * pod-spec-face 的 `IDENTITY_ALLOW_TOKENS` 逐条登记）；全窗关闭（票 15）时
 * 本件与该许可同批收缩。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSpawnEnv } from "../lib/spawn-env.js";
import { checkHostEnvSeam, HOST_URL_SEAM_VAR } from "../lib/org/host-env-seam.js";
import { readEnvValue, legacyEnvName, POD_ENV_PREFIX } from "../lib/env-aliases.js";

/** 逃生阀名（对外运维合同；spawn-env 未导出常量，测试以字面名锁定——本仓惯例）。 */
const ENV_EXTRA_VAR = "POD_ENV_EXTRA";

test("V-P8.3 env 双读·helper 单元：POD_* 优先、DSH_BOTS_* 回落、双缺 undefined", () => {
  // 新名优先：双名都设时取新名（即使新名为显式空串——显式设置即优先）
  assert.equal(readEnvValue({ POD_HOST_URL: "http://n:1", DSH_BOTS_HOST_URL: "http://o:2" }, "POD_HOST_URL"), "http://n:1");
  assert.equal(readEnvValue({ POD_HOST_URL: "", DSH_BOTS_HOST_URL: "http://o:2" }, "POD_HOST_URL"), "");
  // 回落：只设旧名时取旧名
  assert.equal(readEnvValue({ DSH_BOTS_HOST_URL: "http://o:2" }, "POD_HOST_URL"), "http://o:2");
  // 双缺：undefined（缺省行为不变）
  assert.equal(readEnvValue({}, "POD_HOST_URL"), undefined);
  assert.equal(readEnvValue({ DSH_BOTS_OTHER: "x" }, "POD_HOST_URL"), undefined);
  // 显式 undefined 的新名键不算「在位」——等同未设，照常回落
  assert.equal(readEnvValue({ POD_HOST_URL: undefined, DSH_BOTS_HOST_URL: "http://o:2" }, "POD_HOST_URL"), "http://o:2");
});

test("V-P8.3 env 双读·映射规则唯一：POD_X ↔ DSH_BOTS_X（非 POD_ 前缀名直读）", () => {
  assert.equal(POD_ENV_PREFIX, "POD_");
  assert.equal(legacyEnvName("POD_HOST_URL"), "DSH_BOTS_HOST_URL");
  assert.equal(legacyEnvName("POD_TURN_TIMEOUT_MS"), "DSH_BOTS_TURN_TIMEOUT_MS");
  // 非 POD_ 前缀名（DSH_HOME／DSH_WEB_URL 等宿主自有名）无回落语义
  assert.equal(legacyEnvName("DSH_HOME"), "DSH_HOME");
  assert.equal(readEnvValue({ DSH_HOME: "/dsh" }, "DSH_HOME"), "/dsh");
  assert.equal(readEnvValue({}, "DSH_HOME"), undefined);
});

test("V-P8.3 env 双读·buildSpawnEnv 逃生阀：只设旧名时回落仍放行（真实读点回落语义）", () => {
  const base = { PATH: "/usr/bin" };
  // 新名优先
  const viaNew = buildSpawnEnv({ ...base, [ENV_EXTRA_VAR]: "FOO", FOO: "new" });
  assert.equal(viaNew.FOO, "new");
  // 只设旧名 → 回落
  const viaLegacy = buildSpawnEnv({ ...base, DSH_BOTS_ENV_EXTRA: "BAR", BAR: "legacy" });
  assert.equal(viaLegacy.BAR, "legacy");
  // 双缺 → 逃生阀不生效
  const none = buildSpawnEnv({ ...base, BAZ: "quiet" });
  assert.equal(none.BAZ, undefined);
});

test("V-P8.3 env 双读·宿主环境缝：只设旧名时缝判定仍 ok（真实读点回落语义）", () => {
  const origin = "http://127.0.0.1:3080";
  // 新名在位
  assert.equal(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: origin }).state, "ok");
  assert.equal(checkHostEnvSeam({ [HOST_URL_SEAM_VAR]: origin }).var, HOST_URL_SEAM_VAR);
  // 只设旧名 → 回落判定 ok（旧名仅作读侧兼容，判定产物的 var 字段仍是新名＝对外合同名）
  const legacyVerdict = checkHostEnvSeam({ DSH_BOTS_HOST_URL: origin });
  assert.equal(legacyVerdict.state, "ok");
  assert.equal(legacyVerdict.var, HOST_URL_SEAM_VAR);
  // 双缺 → missing（缺省行为不变）
  assert.equal(checkHostEnvSeam({}).state, "missing");
});
