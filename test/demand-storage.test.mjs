import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  enforceRetention,
  listDemandRecords,
  persistDemandRecord,
  persistOwnerFeedback,
} = require("../lib/demand-storage.cjs");

function memoryAdapter() {
  const values = new Map();
  return {
    values,
    async put(pathname, value, options = {}) {
      if (values.has(pathname) && !options.allowOverwrite) throw Object.assign(new Error("already exists"), { status: 409 });
      values.set(pathname, structuredClone(value));
      return { pathname, url: `memory://${pathname}` };
    },
    async list({ prefix }) {
      const blobs = [...values.keys()].filter((pathname) => pathname.startsWith(prefix)).sort().map((pathname) => ({ pathname, url: `memory://${pathname}` }));
      return { blobs, hasMore: false };
    },
    async read(value) {
      return structuredClone(values.get(String(value).replace("memory://", "")) || null);
    },
    async remove(urls) {
      for (const value of urls) values.delete(String(value).replace("memory://", ""));
    },
  };
}

function record(id, date, company = "Vested KSA") {
  return {
    company,
    recordId: id.repeat(64).slice(0, 64),
    occurredAt: date,
    evidence: { genuine: true, synthetic: false, suspectedAbuse: false },
    retention: { policyDays: 90 },
  };
}

test("private storage uses deterministic paths and suppresses duplicate writes", async () => {
  const adapter = memoryAdapter();
  const value = record("a", "2026-09-08T08:00:00.000Z");
  assert.equal((await persistDemandRecord(value, { adapter })).status, "stored");
  assert.equal((await persistDemandRecord(value, { adapter })).status, "duplicate");
  assert.equal(adapter.values.size, 1);
});

test("record listing is period-bound and enforces Vested company isolation", async () => {
  const adapter = memoryAdapter();
  await persistDemandRecord(record("a", "2026-09-08T08:00:00.000Z"), { adapter });
  await persistDemandRecord(record("b", "2026-09-08T09:00:00.000Z", "Another Company"), { adapter });
  const listed = await listDemandRecords("2026-09-08T00:00:00.000Z", "2026-09-09T00:00:00.000Z", { adapter });
  assert.equal(listed.records.length, 1);
  assert.equal(listed.records[0].company, "Vested KSA");
});

test("retention deletes expired events and feedback but keeps current records", async () => {
  const adapter = memoryAdapter();
  await persistDemandRecord(record("a", "2026-01-01T08:00:00.000Z"), { adapter });
  await persistDemandRecord(record("b", "2026-09-01T08:00:00.000Z"), { adapter });
  await persistOwnerFeedback({ company: "Vested KSA", recordId: "c".repeat(64), occurredAt: "2026-01-01T08:00:00.000Z" }, { adapter });
  const result = await enforceRetention(new Date("2026-09-08T12:00:00.000Z"), { adapter });
  assert.equal(result.deleted, 2);
  assert.equal(adapter.values.size, 1);
});
