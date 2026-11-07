import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const {
  allowedDimension,
  classifyUserAgent,
  safePath,
} = require("../lib/server-agent-telemetry.cjs");

test("middleware and server classify documented retrieval and training tokens consistently", () => {
  const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const start = source.indexOf("function classifyUserAgent(");
  const end = source.indexOf("\nfunction surfaceAction(", start);
  const classifier = vm.runInNewContext(source.slice(start, end).replace("userAgent: string", "userAgent") + "\nclassifyUserAgent");
  const cases = [["kimi-searchbot/1.0","kimi-search"],["kimi-user/1.0","kimi-user"],["kimibot/1.0","kimi-training"],["meta-webindexer/1.0","meta-search"],["meta-externalfetcher/1.0","meta-user"],["facebookexternalhit/1.0","meta-preview"],["meta-externalagent/1.0","meta-training"],["applebot-extended/1.0","apple-training"],["applebot/1.0","apple-search"]];
  for (const [ua, expected] of cases) {
    assert.equal(classifyUserAgent(ua), expected);
    assert.equal(classifier(ua), expected);
    assert.equal(classifyUserAgent(ua + " Vested-Validation/1.0"), "validation-probe");
    assert.equal(classifier(ua + " Vested-Validation/1.0"), "validation-probe");
  }
});

test("agent telemetry classifies approved search and training crawlers separately", () => {
  assert.equal(classifyUserAgent("Vested-Validation/1.0"), "validation-probe");
  assert.equal(classifyUserAgent("OAI-SearchBot/1.0"), "openai-search");
  assert.equal(classifyUserAgent("GPTBot/1.2"), "openai-training");
  assert.equal(classifyUserAgent("Claude-SearchBot/1.0"), "anthropic-search");
  assert.equal(classifyUserAgent("ClaudeBot/1.0"), "anthropic-training");
  assert.equal(classifyUserAgent("Mozilla/5.0"), "browser-or-unknown");
});

test("agent telemetry only accepts allowlisted commercial dimensions", () => {
  assert.equal(allowedDimension("good_fit", new Set(["good_fit"])), "good_fit");
  assert.equal(allowedDimension("private.person@example.com", new Set(["good_fit"])), undefined);
});

test("agent telemetry strips query strings and origins from resource paths", () => {
  assert.equal(safePath("/llms.txt?token=secret"), "/llms.txt");
  assert.equal(safePath("https://other.example/data/company.json?email=private"), "/data/company.json");
});
