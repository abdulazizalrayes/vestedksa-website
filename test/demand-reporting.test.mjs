import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { clusterDemand, renderDemandReport, summarizeDemand } = require("../lib/demand-reporting.cjs");

function record(index, overrides = {}) {
  const formation = index < 12;
  return {
    company: "Vested KSA",
    recordId: String(index).padStart(64, "0"),
    occurredAt: `2026-09-${String(1 + (index % 7)).padStart(2, "0")}T08:00:00.000Z`,
    source: "a2a",
    language: index % 3 === 0 ? "ar" : "en",
    fit: "good_fit",
    question: formation
      ? `International technology company needs Saudi formation MISA licensing requirement ${index}`
      : `Industrial company needs Aramco vendor registration evidence portal requirement ${index}`,
    agentReply: "A read-only answer grounded in Vested public sources.",
    answerAdequacy: index % 5 === 0 ? "partial" : "answered",
    demand: {
      signature: overrides.signature || `signature-${index}`,
      serviceIds: [formation ? "company-formation-setup" : "vendor-registration-procurement-readiness"],
      topics: [formation ? "company-formation" : "vendor-readiness"],
      brands: [formation ? "MISA" : "Aramco"],
      specifications: [],
      geographies: ["Saudi Arabia"],
      sectors: [formation ? "technology" : "industrial"],
      quantities: { teamSize: null, timelineMonths: null, timelineWeeks: null },
    },
    evidence: { genuine: true, synthetic: false, suspectedAbuse: false },
    ...overrides,
  };
}

test("statistical baseline excludes synthetic and cross-company records", () => {
  const records = [record(1), record(2), record(3, { company: "Another Company" }), record(4, { evidence: { genuine: true, synthetic: true, suspectedAbuse: false } })];
  const summary = summarizeDemand(records, { reportKind: "daily", periodStart: "2026-09-01", periodEnd: "2026-09-08" });
  assert.equal(summary.evidence.includedGenuineRecords, 2);
  assert.equal(summary.evidence.excludedNonGenuineOrWrongCompany, 2);
  assert.equal(summary.evidence.syntheticIncluded, 0);
  assert.equal(summary.governance.modelActuallyTrained, false);
});

test("duplicate influence is capped before recommendations", () => {
  const records = Array.from({ length: 8 }, (_, index) => record(index, {
    occurredAt: "2026-09-02T08:00:00.000Z",
    demand: { ...record(index).demand, signature: "coordinated-repeat" },
  }));
  const summary = summarizeDemand(records);
  assert.equal(summary.evidence.includedGenuineRecords, 3);
  assert.equal(summary.evidence.duplicateInfluenceCapped, 5);
});

test("unsupervised clustering activates only with enough multi-day clean evidence", () => {
  assert.equal(clusterDemand(Array.from({ length: 10 }, (_, index) => record(index))).status, "insufficient_data");
  const clusters = clusterDemand(Array.from({ length: 24 }, (_, index) => record(index)));
  assert.equal(clusters.modelTrained, false);
  assert.equal(clusters.status, "clusters_found");
  assert.ok(clusters.clusters.some((cluster) => cluster.count >= 3));
});

test("weekly report preserves sanitized question, agent reply and owner guidance", () => {
  const item = record(1);
  const summary = summarizeDemand([item, record(2)], {
    reportKind: "weekly",
    feedback: [{ recordId: item.recordId, ownerReply: "Make the timeline caveat clearer.", approvedImprovedReply: "State the dependency before the estimate." }],
  });
  assert.equal(summary.questionReview[0].ownerReply, "Make the timeline caveat clearer.");
  const markdown = renderDemandReport(summary);
  assert.match(markdown, /Question And Answer Review/);
  assert.match(markdown, /Make the timeline caveat clearer/);
  assert.match(markdown, /Model actually trained: no/);
  assert.match(markdown, /not the entire market/i);
  assert.match(markdown, /Changes Over Time/);
  assert.match(markdown, /0 synthetic records/);
  assert.match(markdown, /period .* to /);
});
