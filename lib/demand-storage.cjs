"use strict";

const EVENT_PREFIX = "vested-demand/v1/events/";
const REPORT_PREFIX = "vested-demand/v1/reports/";
const FEEDBACK_PREFIX = "vested-demand/v1/feedback/";
const MAX_LISTED_BLOBS = 1000;
const MAX_LIST_PAGES = 8;
const MAX_RETENTION_DELETES = 100;

function storageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)
  );
}

function datePath(isoDate) {
  return new Date(isoDate).toISOString().slice(0, 10).replaceAll("-", "/");
}

function eventPath(record) {
  return `${EVENT_PREFIX}${datePath(record.occurredAt)}/${record.recordId}.json`;
}

function reportPath(kind, periodEnd) {
  return `${REPORT_PREFIX}${datePath(periodEnd)}/${kind}.json`;
}

function feedbackPath(recordId, occurredAt) {
  const stamp = new Date(occurredAt).toISOString().replace(/[:.]/g, "-");
  return `${FEEDBACK_PREFIX}${datePath(occurredAt)}/${recordId}/${stamp}.json`;
}

async function defaultAdapter() {
  const blob = await import("@vercel/blob");
  return {
    async put(pathname, value, options = {}) {
      return blob.put(pathname, JSON.stringify(value), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: options.allowOverwrite === true,
        contentType: "application/json; charset=utf-8",
      });
    },
    async list(options) {
      return blob.list(options);
    },
    async read(pathname) {
      const result = await blob.get(pathname, { access: "private" });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return JSON.parse(await new Response(result.stream).text());
    },
    async remove(urls) {
      if (urls.length) await blob.del(urls);
    },
  };
}

function isDuplicateError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("already exists") || message.includes("conflict") || error?.status === 409 || error?.statusCode === 409;
}

async function resolveAdapter(adapter) {
  return adapter || defaultAdapter();
}

async function persistDemandRecord(record, options = {}) {
  if (!options.adapter && !storageConfigured()) return { status: "storage_not_configured" };
  const adapter = await resolveAdapter(options.adapter);
  const pathname = eventPath(record);
  try {
    await adapter.put(pathname, record, { allowOverwrite: false });
    return { status: "stored", pathname };
  } catch (error) {
    if (isDuplicateError(error)) return { status: "duplicate", pathname };
    throw error;
  }
}

async function persistDemandReport(report, options = {}) {
  if (!options.adapter && !storageConfigured()) return { status: "storage_not_configured" };
  const adapter = await resolveAdapter(options.adapter);
  const pathname = reportPath(report.reportKind, report.period.end);
  await adapter.put(pathname, report, { allowOverwrite: true });
  return { status: "stored", pathname };
}

async function persistOwnerFeedback(feedback, options = {}) {
  if (!options.adapter && !storageConfigured()) return { status: "storage_not_configured" };
  const adapter = await resolveAdapter(options.adapter);
  const pathname = feedbackPath(feedback.recordId, feedback.occurredAt);
  await adapter.put(pathname, feedback, { allowOverwrite: false });
  return { status: "stored", pathname };
}

async function listBlobsByPrefix(prefix, options = {}) {
  const adapter = await resolveAdapter(options.adapter);
  const blobs = [];
  let cursor;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const result = await adapter.list({ prefix, limit: MAX_LISTED_BLOBS, cursor });
    blobs.push(...(result.blobs || []));
    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }
  return { blobs, truncated: blobs.length >= MAX_LISTED_BLOBS * MAX_LIST_PAGES };
}

function eachUtcDate(start, end) {
  const values = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  const stop = new Date(end);
  while (cursor < stop && values.length < 32) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (new Date(end).getUTCHours() > 0) values.push(stop.toISOString().slice(0, 10));
  return [...new Set(values)];
}

async function listDemandRecords(start, end, options = {}) {
  if (!options.adapter && !storageConfigured()) return { records: [], storageConfigured: false, truncated: false };
  const adapter = await resolveAdapter(options.adapter);
  const records = [];
  let truncated = false;
  for (const day of eachUtcDate(start, end)) {
    const prefix = `${EVENT_PREFIX}${day.replaceAll("-", "/")}/`;
    const listed = await listBlobsByPrefix(prefix, { adapter });
    truncated ||= listed.truncated;
    for (const item of listed.blobs) {
      const value = await adapter.read(item.pathname || item.url);
      if (!value || value.company !== "Vested KSA") continue;
      const occurredAt = new Date(value.occurredAt);
      if (occurredAt >= new Date(start) && occurredAt < new Date(end)) records.push(value);
    }
  }
  return { records, storageConfigured: true, truncated };
}

async function listOwnerFeedback(recordIds, options = {}) {
  if (!recordIds.length || (!options.adapter && !storageConfigured())) return [];
  const adapter = await resolveAdapter(options.adapter);
  const feedback = [];
  const wanted = new Set(recordIds.slice(0, 100));
  const listed = await listBlobsByPrefix(FEEDBACK_PREFIX, { adapter });
  for (const item of listed.blobs) {
    const value = await adapter.read(item.pathname || item.url);
    if (value?.company === "Vested KSA" && wanted.has(value.recordId)) feedback.push(value);
  }
  return feedback;
}

function pathDate(pathname, prefix) {
  const match = String(pathname || "").slice(prefix.length).match(/^(\d{4})\/(\d{2})\/(\d{2})\//);
  return match ? new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`) : null;
}

async function enforceRetention(now = new Date(), options = {}) {
  if (!options.adapter && !storageConfigured()) return { status: "storage_not_configured", deleted: 0 };
  const adapter = await resolveAdapter(options.adapter);
  const eventCutoff = new Date(now.getTime() - 90 * 86400000);
  const reportCutoff = new Date(now.getTime() - 180 * 86400000);
  const candidates = [];
  for (const [prefix, cutoff] of [[EVENT_PREFIX, eventCutoff], [REPORT_PREFIX, reportCutoff], [FEEDBACK_PREFIX, reportCutoff]]) {
    const listed = await listBlobsByPrefix(prefix, { adapter });
    for (const item of listed.blobs) {
      const date = pathDate(item.pathname, prefix);
      if (date && date < cutoff) candidates.push(item.url || item.pathname);
    }
  }
  const deleting = candidates.slice(0, MAX_RETENTION_DELETES);
  await adapter.remove(deleting);
  return { status: "complete", deleted: deleting.length, remainingCandidates: Math.max(0, candidates.length - deleting.length) };
}

module.exports = {
  EVENT_PREFIX,
  FEEDBACK_PREFIX,
  REPORT_PREFIX,
  enforceRetention,
  eventPath,
  feedbackPath,
  listDemandRecords,
  listOwnerFeedback,
  persistDemandRecord,
  persistDemandReport,
  persistOwnerFeedback,
  reportPath,
  storageConfigured,
};
