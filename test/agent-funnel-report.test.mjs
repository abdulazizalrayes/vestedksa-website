import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTelemetryLine,
  renderMarkdown,
  summarizeTelemetry,
} from "../scripts/report-agent-funnel.mjs";

function vercelLine(record) {
  return JSON.stringify({ deploymentId: "dpl_test", message: JSON.stringify(record), requestPath: record.path });
}

test("agent funnel report parses Vercel envelopes and raw telemetry", () => {
  const record = {
    type: "agent_readiness_event",
    timestamp: "2026-08-31T10:00:00.000Z",
    path: "/api/a2a",
    userAgentClass: "openai-user",
    event: { action: "a2a_message_send", tool: "assess_market_entry_fit", outcome: "good_fit" },
  };
  assert.deepEqual(parseTelemetryLine(vercelLine(record)), record);
  assert.deepEqual(parseTelemetryLine(JSON.stringify(record)), record);
  assert.equal(parseTelemetryLine("Fetching logs..."), null);
});

test("agent funnel report excludes validation probes and aggregates only coarse dimensions", () => {
  const input = [
    vercelLine({
      type: "agent_readiness_event",
      timestamp: "2026-08-31T10:00:00.000Z",
      path: "/api/a2a",
      userAgentClass: "openai-user",
      event: {
        action: "a2a_message_send",
        tool: "prepare_project_inquiry",
        outcome: "good_fit",
        route: "prepare_market_entry_inquiry",
      },
      prompt: "Contact private.person@example.com",
    }),
    vercelLine({
      type: "agent_readiness_event",
      timestamp: "2026-08-31T10:01:00.000Z",
      path: "/api/a2a",
      userAgentClass: "openai-user",
      event: {
        action: "a2a_inquiry_prepared",
        tool: "prepare_project_inquiry",
        outcome: "good_fit",
        route: "prepare_market_entry_inquiry",
      },
    }),
    vercelLine({
      type: "agent_readiness_event",
      timestamp: "2026-08-31T10:02:00.000Z",
      path: "/api/a2a",
      userAgentClass: "validation-probe",
      event: { action: "a2a_message_send", outcome: "good_fit" },
    }),
  ].join("\n");

  const summary = summarizeTelemetry(input);
  assert.equal(summary.processedEvents, 2);
  assert.equal(summary.excludedValidationEvents, 1);
  assert.equal(summary.funnel.messageSends, 1);
  assert.equal(summary.funnel.goodFit, 1);
  assert.equal(summary.funnel.inquiryPrepared, 1);
  assert.equal(summary.funnel.qualifiedShare, 1);
  assert.equal(summary.privacy.includesPersonalData, false);
  assert.equal(JSON.stringify(summary).includes("private.person@example.com"), false);
  assert.equal(renderMarkdown(summary).includes("private.person@example.com"), false);
});
