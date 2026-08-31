import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  BLOCK_MS,
  MAX_FAILURES,
  blockedForMs,
  clientFingerprint,
  recordAbuse,
  resetForTests,
} = require("../lib/agent-abuse-guard.cjs");

test("agent abuse guard hashes an observed source and ignores missing source data", () => {
  resetForTests();
  assert.equal(clientFingerprint({ headers: {} }), "");
  const fingerprint = clientFingerprint({ headers: { "x-forwarded-for": "192.0.2.10, 10.0.0.1" } });
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint.includes("192.0.2.10"), false);
});

test("agent abuse guard temporarily blocks only after repeated invalid requests", () => {
  resetForTests();
  const first = { headers: { "x-forwarded-for": "192.0.2.20" } };
  const second = { headers: { "x-forwarded-for": "192.0.2.21" } };
  const now = 1_000_000;

  for (let count = 1; count < MAX_FAILURES; count += 1) {
    assert.equal(recordAbuse(first, now + count), 0);
  }
  assert.equal(recordAbuse(first, now + MAX_FAILURES), BLOCK_MS);
  assert.ok(blockedForMs(first, now + MAX_FAILURES + 1) > 0);
  assert.equal(blockedForMs(second, now + MAX_FAILURES + 1), 0);
});
