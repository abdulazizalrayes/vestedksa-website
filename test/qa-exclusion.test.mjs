import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { summarizeTelemetry } from '../scripts/report-agent-funnel.mjs';
const require = createRequire(import.meta.url);
const { isQaRequest } = require('../lib/qa-traffic.cjs');
const { createDemandRecord } = require('../lib/demand-intelligence.cjs');

test('labelled Vested tests are excluded without a special user agent', () => {
  const fixtures = [
    { qaTest: true },
    { pageUrl: 'https://vestedksa.com/contact?utm_source=owner_qa' },
    { pageUrl: 'https://www.vestedksa.com/contact?utm_campaign=vested_attribution_20261111' },
    { message: 'SYNTHETIC OWNER-APPROVED TEST ONLY. formation' },
    { message: 'formation VES-QA-20261111-ATTRIBUTION-02' },
  ];
  for (const fields of fixtures) {
    assert.equal(isQaRequest(fields), true);
    const record = createDemandRecord({ synthetic: isQaRequest(fields), question: 'Saudi formation', fit: { classification: 'good_fit' } });
    assert.equal(record.eligible, false);
    assert.equal(record.classification, 'synthetic');
    assert.equal(record.record, undefined);
  }
  for (const fields of [
    { pageUrl: 'https://another.example/contact?utm_source=owner_qa' },
    { pageUrl: 'https://vestedksa.com.evil.example/?utm_source=owner_qa' },
    { pageUrl: 'https://vestedksa.com/contact?utm_source=google' },
    { message: 'We offer synthetic materials and need company formation.' },
    { message: 'We need software QA services for our Saudi company.' },
  ]) assert.equal(isQaRequest(fields), false);
});

test('agent funnel excludes explicit synthetic events by default', () => {
  const line = JSON.stringify({ type: 'agent_readiness_event', userAgentClass: 'browser-or-unknown', path: '/api/contact', event: { action: 'demand_learning_excluded', trafficType: 'synthetic' } });
  assert.equal(summarizeTelemetry(line).processedEvents, 0);
  assert.equal(summarizeTelemetry(line).excludedValidationEvents, 1);
  assert.equal(summarizeTelemetry(line, { includeValidation: true }).processedEvents, 1);
});
