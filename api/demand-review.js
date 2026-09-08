"use strict";

const crypto = require("node:crypto");
const { sanitizeDemandText } = require("../lib/demand-intelligence.cjs");
const { renderDemandReport, summarizeDemand } = require("../lib/demand-reporting.cjs");
const {
  enforceRetention,
  listDemandRecords,
  listOwnerFeedback,
  persistDemandReport,
  persistOwnerFeedback,
} = require("../lib/demand-storage.cjs");
const { sendPrivateReportEmail } = require("../lib/demand-mailer.cjs");

const MAX_BODY_BYTES = 16 * 1024;
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

function setPrivateHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.end(JSON.stringify(value));
}

function publicError(status, error) {
  if (status >= 500) return { code: "private_review_failed", message: "Private demand review failed" };
  if (error instanceof SyntaxError) return { code: "invalid_json", message: "Request body must be valid JSON" };
  if (status === 413) return { code: "body_too_large", message: "Request body too large" };
  if (String(error?.message) === "Invalid recordId") return { code: "invalid_record_id", message: "Invalid recordId" };
  if (String(error?.message) === "Owner feedback is required") return { code: "feedback_required", message: "Owner feedback is required" };
  if (String(error?.message).startsWith("Remove sensitive")) return { code: "sensitive_feedback", message: "Remove sensitive or confidential content before recording feedback" };
  return { code: "invalid_request", message: "Invalid request" };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const value = String(req.headers?.authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function authorize(req) {
  const token = bearer(req);
  if (safeEqual(token, process.env.CRON_SECRET)) return "cron";
  if (safeEqual(token, process.env.DEMAND_REVIEW_TOKEN)) return "owner";
  return "none";
}

function startOfRiyadhDay(now) {
  const shifted = new Date(new Date(now).getTime() + RIYADH_OFFSET_MS);
  const shiftedStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(shiftedStart - RIYADH_OFFSET_MS);
}

function reportPeriod(kind, now = new Date()) {
  const end = startOfRiyadhDay(now);
  const days = kind === "weekly" ? 7 : 1;
  const start = new Date(end.getTime() - days * 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isRiyadhMonday(now = new Date()) {
  return new Date(new Date(now).getTime() + RIYADH_OFFSET_MS).getUTCDay() === 1;
}

async function generateReport(kind, now = new Date(), options = {}) {
  const period = reportPeriod(kind, now);
  const storage = options.storage || { listDemandRecords, listOwnerFeedback, persistDemandReport };
  const listed = await storage.listDemandRecords(period.start, period.end, options);
  const feedback = await storage.listOwnerFeedback(listed.records.map((record) => record.recordId), options);
  const summary = summarizeDemand(listed.records, {
    reportKind: kind,
    periodStart: period.start,
    periodEnd: period.end,
    feedback,
    now,
  });
  summary.evidence.storageListingTruncated = listed.truncated;
  summary.retention = {
    eventDays: 90,
    reportAndFeedbackDays: 180,
    rawConversationRetentionDays: 0,
  };
  const reportText = renderDemandReport(summary);
  await storage.persistDemandReport({ ...summary, privateReportText: reportText }, options);
  return { summary, reportText };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        exceeded = true;
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
      }
    });
    req.on("end", () => { if (!exceeded) resolve(body); });
    req.on("error", reject);
  });
}

function createFeedback(payload, now = new Date()) {
  const recordId = String(payload?.recordId || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(recordId)) throw Object.assign(new Error("Invalid recordId"), { statusCode: 400 });
  const ownerReply = sanitizeDemandText(payload?.ownerReply, 2400);
  const improved = sanitizeDemandText(payload?.approvedImprovedReply, 5000);
  if (!ownerReply.text && !improved.text) throw Object.assign(new Error("Owner feedback is required"), { statusCode: 400 });
  if (ownerReply.sensitiveContextDetected || improved.sensitiveContextDetected) {
    throw Object.assign(new Error("Remove sensitive or confidential content before recording feedback"), { statusCode: 400 });
  }
  const occurredAt = new Date(now).toISOString();
  return {
    schemaVersion: "2026-09-08",
    recordType: "owner-demand-feedback",
    company: "Vested KSA",
    recordId,
    occurredAt,
    ownerReply: ownerReply.text || null,
    approvedImprovedReply: improved.text || null,
    publishApproved: false,
    publicAgentTrainingApproved: false,
    privacy: { personalIdentifiersStored: false, rawConversationStored: false },
    retention: { policyDays: 180, deleteAfter: new Date(new Date(now).getTime() + 180 * 86400000).toISOString() },
  };
}

async function handleCron(res, now = new Date()) {
  const daily = await generateReport("daily", now);
  const reports = [daily];
  if (isRiyadhMonday(now)) reports.push(await generateReport("weekly", now));
  for (const report of reports) {
    if (report.summary.evidence.includedGenuineRecords > 0 || report.summary.reportKind === "weekly" || process.env.DEMAND_EMAIL_EMPTY_REPORTS === "true") {
      await sendPrivateReportEmail({
        subject: `Vested KSA ${report.summary.reportKind} demand review: ${report.summary.period.end.slice(0, 10)}`,
        body: report.reportText,
      });
    }
  }
  const retention = await enforceRetention(now);
  sendJson(res, 200, {
    ok: true,
    company: "Vested KSA",
    reports: reports.map(({ summary }) => ({ kind: summary.reportKind, genuineRecords: summary.evidence.includedGenuineRecords, recommendations: summary.recommendations.length })),
    retention,
  });
}

module.exports = async function handler(req, res) {
  setPrivateHeaders(res);
  const role = authorize(req);
  if (role === "none") {
    res.setHeader("WWW-Authenticate", 'Bearer realm="Vested KSA private demand review"');
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  try {
    if (req.method === "GET" && role === "cron") {
      await handleCron(res);
      return;
    }
    if (req.method === "GET" && role === "owner") {
      const url = new URL(req.url || "/api/demand-review", "https://vestedksa.com");
      const kind = url.searchParams.get("kind") === "weekly" ? "weekly" : "daily";
      const report = await generateReport(kind);
      sendJson(res, 200, { ok: true, report: report.summary });
      return;
    }
    if (req.method === "POST" && role === "owner") {
      if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
        sendJson(res, 415, { ok: false, error: "Content-Type must be application/json" });
        return;
      }
      const raw = await readBody(req);
      const feedback = createFeedback(JSON.parse(raw));
      const stored = await persistOwnerFeedback(feedback);
      sendJson(res, 201, { ok: true, recordId: feedback.recordId, status: stored.status, publishApproved: false, publicAgentTrainingApproved: false });
      return;
    }
    res.setHeader("Allow", role === "owner" ? "GET, POST" : "GET");
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    const status = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
    const safeError = publicError(status, error);
    console.warn(JSON.stringify({ type: "demand_review_error", company: "Vested KSA", timestamp: new Date().toISOString(), status, reason: safeError.code }));
    sendJson(res, status, { ok: false, error: safeError.message });
  }
};

module.exports.authorize = authorize;
module.exports.createFeedback = createFeedback;
module.exports.generateReport = generateReport;
module.exports.isRiyadhMonday = isRiyadhMonday;
module.exports.reportPeriod = reportPeriod;
