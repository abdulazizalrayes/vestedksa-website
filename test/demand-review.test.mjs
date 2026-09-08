import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const review = require("../api/demand-review.js");

function invoke(method = "GET", requestHeaders = {}, payload = "") {
  return new Promise((resolve, reject) => {
    const headers = new Map();
    let body = "";
    const req = new EventEmitter();
    req.method = method;
    req.url = "/api/demand-review";
    req.headers = requestHeaders;
    const res = {
      statusCode: 200,
      setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
      end(chunk = "") { body += chunk; resolve({ status: this.statusCode, headers, body }); },
    };
    Promise.resolve(review(req, res)).catch(reject);
    queueMicrotask(() => {
      if (payload) req.emit("data", payload);
      req.emit("end");
    });
  });
}

test("Riyadh reporting periods use completed local days", () => {
  const daily = review.reportPeriod("daily", new Date("2026-09-08T05:00:00.000Z"));
  assert.deepEqual(daily, { start: "2026-09-06T21:00:00.000Z", end: "2026-09-07T21:00:00.000Z" });
  const weekly = review.reportPeriod("weekly", new Date("2026-09-07T05:00:00.000Z"));
  assert.equal(weekly.start, "2026-08-30T21:00:00.000Z");
  assert.equal(weekly.end, "2026-09-06T21:00:00.000Z");
  assert.equal(review.isRiyadhMonday(new Date("2026-09-07T05:00:00.000Z")), true);
});

test("private review authorization accepts only exact configured bearer tokens", () => {
  const previousCron = process.env.CRON_SECRET;
  const previousOwner = process.env.DEMAND_REVIEW_TOKEN;
  process.env.CRON_SECRET = "cron-test-secret";
  process.env.DEMAND_REVIEW_TOKEN = "owner-test-secret";
  try {
    assert.equal(review.authorize({ headers: { authorization: "Bearer cron-test-secret" } }), "cron");
    assert.equal(review.authorize({ headers: { authorization: "Bearer owner-test-secret" } }), "owner");
    assert.equal(review.authorize({ headers: { authorization: "Bearer owner-test" } }), "none");
    assert.equal(review.authorize({ headers: {} }), "none");
  } finally {
    if (previousCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previousCron;
    if (previousOwner === undefined) delete process.env.DEMAND_REVIEW_TOKEN; else process.env.DEMAND_REVIEW_TOKEN = previousOwner;
  }
});

test("private review is noindex, no-store and inaccessible without a bearer secret", async () => {
  const response = await invoke();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(JSON.parse(response.body).error, "Unauthorized");
});

test("malformed owner feedback never echoes private input into responses or logs", async () => {
  const previousOwner = process.env.DEMAND_REVIEW_TOKEN;
  const originalWarn = console.warn;
  const logs = [];
  process.env.DEMAND_REVIEW_TOKEN = "owner-test-secret";
  console.warn = (value) => logs.push(String(value));
  try {
    const privateFragment = "person@example.com";
    const response = await invoke("POST", {
      authorization: "Bearer owner-test-secret",
      "content-type": "application/json",
    }, `{\"ownerReply\":\"${privateFragment}\"`);
    assert.equal(response.status, 400);
    assert.equal(response.body.includes(privateFragment), false);
    assert.equal(logs.join("\n").includes(privateFragment), false);
    assert.match(response.body, /valid JSON/);
  } finally {
    console.warn = originalWarn;
    if (previousOwner === undefined) delete process.env.DEMAND_REVIEW_TOKEN; else process.env.DEMAND_REVIEW_TOKEN = previousOwner;
  }
});

test("owner feedback is sanitized, private and never approves publication or training", () => {
  const feedback = review.createFeedback({
    recordId: "a".repeat(64),
    ownerReply: "My name is Jane Smith; improve the answer and email jane@example.com.",
    approvedImprovedReply: "Give a clearer English and Arabic dependency sequence.",
  }, new Date("2026-09-08T10:00:00.000Z"));
  assert.equal(feedback.ownerReply.includes("Jane Smith"), false);
  assert.equal(feedback.ownerReply.includes("jane@example.com"), false);
  assert.equal(feedback.publishApproved, false);
  assert.equal(feedback.publicAgentTrainingApproved, false);
  assert.equal(feedback.company, "Vested KSA");
});
