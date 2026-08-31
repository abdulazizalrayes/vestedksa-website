"use strict";

const crypto = require("node:crypto");

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_KEYS = 2000;

function state() {
  if (!global.__vestedAgentAbuseGuard) {
    global.__vestedAgentAbuseGuard = {
      salt: crypto.randomBytes(24).toString("hex"),
      records: new Map(),
    };
  }
  return global.__vestedAgentAbuseGuard;
}

function clientFingerprint(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const source = forwarded || String(req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "").trim();
  if (!source) return "";
  const current = state();
  return crypto.createHash("sha256").update(`${current.salt}:${source}`).digest("hex");
}

function prune(now) {
  const current = state();
  if (current.records.size <= MAX_KEYS) return;
  for (const [key, record] of current.records) {
    if (record.blockedUntil <= now && record.windowStart + WINDOW_MS <= now) current.records.delete(key);
  }
  if (current.records.size > MAX_KEYS) current.records.clear();
}

function blockedForMs(req, now = Date.now()) {
  const key = clientFingerprint(req);
  if (!key) return 0;
  const record = state().records.get(key);
  if (!record) return 0;
  if (record.blockedUntil > now) return record.blockedUntil - now;
  if (record.windowStart + WINDOW_MS <= now) state().records.delete(key);
  return 0;
}

function recordAbuse(req, now = Date.now()) {
  const key = clientFingerprint(req);
  if (!key) return 0;
  prune(now);
  const records = state().records;
  const existing = records.get(key);
  const record = !existing || existing.windowStart + WINDOW_MS <= now
    ? { failures: 0, windowStart: now, blockedUntil: 0 }
    : existing;
  record.failures += 1;
  if (record.failures >= MAX_FAILURES) record.blockedUntil = now + BLOCK_MS;
  records.set(key, record);
  return Math.max(0, record.blockedUntil - now);
}

function resetForTests() {
  delete global.__vestedAgentAbuseGuard;
}

module.exports = {
  BLOCK_MS,
  MAX_FAILURES,
  blockedForMs,
  clientFingerprint,
  recordAbuse,
  resetForTests,
};
