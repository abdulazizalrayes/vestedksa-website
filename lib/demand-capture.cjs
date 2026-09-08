"use strict";

const { waitUntil } = require("@vercel/functions");
const { classifyUserAgent, recordAgentEvent } = require("./server-agent-telemetry.cjs");
const { createDemandRecord } = require("./demand-intelligence.cjs");
const { persistDemandRecord, storageConfigured } = require("./demand-storage.cjs");

function buildDemandCandidate(req, input, options = {}) {
  return createDemandRecord({
    ...input,
    userAgentClass: input.userAgentClass || classifyUserAgent(req?.headers?.["user-agent"]),
  }, options);
}

function scheduleDemandCapture(req, input) {
  const candidate = buildDemandCandidate(req, input);
  if (!candidate.eligible) {
    recordAgentEvent(req, {
      action: "demand_learning_excluded",
      outcome: input.fit?.classification,
      route: input.fit?.route,
    });
    return { status: "excluded", classification: candidate.classification, reason: candidate.reason };
  }
  if (!storageConfigured()) return { status: "storage_not_configured", recordId: candidate.record.recordId };

  waitUntil(persistDemandRecord(candidate.record).then((result) => {
    recordAgentEvent(req, {
      action: result.status === "duplicate" ? "demand_learning_duplicate" : "demand_learning_recorded",
      tool: input.skillId,
      outcome: input.fit?.classification,
      route: input.fit?.route,
    });
  }).catch((error) => {
    console.warn(JSON.stringify({
      type: "demand_learning_storage_error",
      timestamp: new Date().toISOString(),
      company: "Vested KSA",
      reason: String(error?.message || error || "storage error").slice(0, 120),
    }));
  }));
  return { status: "scheduled", recordId: candidate.record.recordId };
}

module.exports = {
  buildDemandCandidate,
  scheduleDemandCapture,
};
