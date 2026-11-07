import test from "node:test";
import assert from "node:assert/strict";
import { citationBarriers } from "../scripts/lib/crawler-access-checks.mjs";

test("canonical public pages retain indexing and snippet eligibility", () => {
  assert.deepEqual(citationBarriers('<meta name="robots" content="index, follow, max-snippet:-1">'), []);
  assert.equal(citationBarriers('<META CONTENT="NoIndex, NoSnippet" NAME="ROBOTS">').length, 2);
  assert.equal(citationBarriers("<meta name='googlebot' content='max-snippet: 0'>").length, 1);
  assert.equal(citationBarriers('<meta name="bingbot" content="none">').length, 1);
  assert.equal(citationBarriers("", "noindex, nosnippet").length, 2);
});

test("training-specific controls do not trigger false search failures", () => {
  assert.deepEqual(citationBarriers('<meta name="GPTBot" content="noindex">', "GPTBot: noindex, nofollow"), []);
  assert.equal(citationBarriers("", "GPTBot: noindex, Googlebot: nosnippet, max-snippet:0").length, 2);
  assert.deepEqual(citationBarriers('<script>const x = \'<meta name="robots" content="noindex">\';</script>'), []);
});
