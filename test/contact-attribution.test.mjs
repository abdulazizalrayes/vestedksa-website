import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from 'parse5';

const tree = parse(fs.readFileSync(new URL('../contact.html', import.meta.url), 'utf8'));
function scripts(node) {
  return [
    ...(node.tagName === 'script' ? [node.childNodes.map(child => child.value || '').join('')] : []),
    ...(node.childNodes || []).flatMap(scripts),
  ];
}
const source = scripts(tree).find(text => text.includes('function pushDataLayerEvent'));
function run(search) {
  const commands = [];
  const window = { location: { search }, addEventListener() {}, VestedConsent: { getStatus: () => 'accepted' },
    gtag(...args) { commands.push(args); } };
  const document = { querySelectorAll: () => [], addEventListener() {}, readyState: 'loading',
    head: { appendChild() {} }, createElement: () => ({}) };
  const context = vm.createContext({ window, document, URLSearchParams,
    localStorage: { getItem: () => 'accepted' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  vm.runInContext(fs.readFileSync(new URL('../analytics-loader.js', import.meta.url), 'utf8'), context);
  commands.length = 0;
  vm.runInContext(source, context);
  return { context, window, commands };
}

test('existing approved QA URL supplies campaign fields without sending a request', () => {
  const state = run('?utm_source=owner_qa&utm_medium=verification&utm_campaign=vested_delivery_20261111');
  for (const event of ['lead_form_start', 'lead_form_submit']) {
    state.context.pushDataLayerEvent(event, { form_name: 'contact' });
    const [command, name, payload] = state.commands.at(-1);
    assert.equal(command, 'event');
    assert.equal(name, `qa_${event}`);
    assert.equal(payload.campaign_source, 'owner_qa');
    assert.equal(payload.campaign_medium, 'verification');
    assert.equal(payload.campaign_name, 'vested_delivery_20261111');
    assert.equal(payload.send_to, 'G-7STG2HDV42');
    assert.equal(state.window.dataLayer.at(-1).campaign_name, payload.campaign_name);
  }
  assert.equal(state.commands.length, 2);
});

test('missing, duplicate, personal and malformed campaign values are not forwarded', () => {
  for (const query of ['', '?utm_campaign=a&utm_campaign=b', '?utm_campaign=user%40example.com',
    '?utm_campaign=phone966500067865', '?utm_campaign=%3Cscript%3E', '?utm_campaign=' + 'a'.repeat(101)]) {
    const state = run(query);
    state.context.pushDataLayerEvent('lead_form_submit', { form_name: 'contact' });
    assert.equal(state.commands[0][2].campaign_name, undefined);
    assert.equal(state.commands[0][2].send_to, 'G-7STG2HDV42');
  }
});

test('genuine analytics events remain unchanged', () => {
  const state = run('?utm_source=google');
  state.context.pushDataLayerEvent('view_key_page', { page_type: 'contact' });
  assert.deepEqual(JSON.parse(JSON.stringify(state.commands[0])),
    ['event', 'view_key_page', { page_type: 'contact' }]);
});
