import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  allowedDimension,
  classifyUserAgent,
  safePath,
} = require("../lib/server-agent-telemetry.cjs");

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
