import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isQaCampaign } = require('../lib/qa-traffic.cjs');
const conversions = new Set(['lead_form_submit', 'email_click', 'phone_click', 'whatsapp_click', 'checklist_download_click', 'language_switch_click']);

// Accept aggregate export rows only, never raw GA requests or individual users.
export function summarizeConversions(input) {
  if (input.company !== 'Vested KSA' || String(input.propertyId) !== '529693438') throw new Error('Vested identity mismatch');
  if (![input.period?.start, input.period?.end].every(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) || input.period.start > input.period.end || !Array.isArray(input.rows)) throw new Error('Period and aggregate rows required');
  const result = { company: 'Vested KSA', propertyId: '529693438', period: { start: input.period.start, end: input.period.end }, genuineConversions: {}, qaExcluded: 0, unattributedUnverified: 0 };
  for (const row of input.rows) {
    const count = Number(row.eventCount);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid aggregate count');
    const name = String(row.eventName || '');
    const qa = name.startsWith('qa_') || row.synthetic === true || row.agentClass === 'validation-probe' ||
      [row.source, row.sessionSource, row.firstUserSource].some(value => String(value || '').toLowerCase() === 'owner_qa') ||
      [row.campaign, row.sessionCampaign].some(isQaCampaign);
    if (qa) { result.qaExcluded += count; continue; }
    if (!conversions.has(name)) continue;
    // Legacy records with no usable attribution cannot be asserted genuine.
    const source = String(row.source || row.sessionSource || '');
    if (!source || ['(not set)', '(data not available)'].includes(source)) {
      result.unattributedUnverified += count;
      continue;
    }
    result.genuineConversions[name] = (result.genuineConversions[name] || 0) + count;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(JSON.stringify(summarizeConversions(JSON.parse(fs.readFileSync(0, 'utf8'))), null, 2) + '\n');
}
