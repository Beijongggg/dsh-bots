import { test } from "node:test";
import assert from "node:assert/strict";

import { internals } from "../lib/index.js";

const { resolveTurnTimeoutMs } = internals;

test("缺省（env 未设）＝600s", () => {
  assert.equal(resolveTurnTimeoutMs({}), 10 * 60 * 1000);
  assert.equal(resolveTurnTimeoutMs(undefined), 10 * 60 * 1000);
});

test("正整数覆盖缺省", () => {
  assert.equal(resolveTurnTimeoutMs({ DSH_BOTS_TURN_TIMEOUT_MS: "1800000" }), 1_800_000);
  assert.equal(resolveTurnTimeoutMs({ DSH_BOTS_TURN_TIMEOUT_MS: "600000" }), 600_000);
  assert.equal(resolveTurnTimeoutMs({ DSH_BOTS_TURN_TIMEOUT_MS: "1e9" }), 1_000_000_000);
});

test("非正整数／非整数／垃圾值一律回落缺省（fail closed）", () => {
  for (const bad of ["0", "-5", "12.5", "abc", "", Number.NaN, null]) {
    assert.equal(resolveTurnTimeoutMs({ DSH_BOTS_TURN_TIMEOUT_MS: bad }), 10 * 60 * 1000, `bad=${String(bad)}`);
  }
});
