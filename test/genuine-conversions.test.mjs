import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeConversions } from '../scripts/report-genuine-conversions.mjs';
const input = rows => ({ company: 'Vested KSA', propertyId: '529693438', period: { start: '2026-11-11', end: '2026-11-11' }, rows });
test('conversion report separates genuine, historical QA, new QA and uncertainty', () => {
  const result = summarizeConversions(input([
    { eventName: 'lead_form_submit', eventCount: 2, source: 'google' },
    { eventName: 'lead_form_submit', eventCount: 1, source: 'owner_qa' },
    { eventName: 'lead_form_submit', eventCount: 1, campaign: 'vested_attribution_20261111' },
    { eventName: 'qa_whatsapp_click', eventCount: 1 },
    { eventName: 'lead_form_submit', eventCount: 1, source: '(not set)' },
    { eventName: 'lead_form_submit', eventCount: 1 },
  ]));
  assert.deepEqual(result.genuineConversions, { lead_form_submit: 2 });
  assert.equal(result.qaExcluded, 3);
  assert.equal(result.unattributedUnverified, 2);
});
test('conversion report rejects another company and invalid counts', () => {
  assert.throws(() => summarizeConversions({ ...input([]), propertyId: '1' }), /identity/);
  assert.throws(() => summarizeConversions(input([{ eventCount: -1 }])), /count/);
});
