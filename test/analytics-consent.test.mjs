import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../analytics-loader.js", import.meta.url), "utf8");

function runLoader(initialConsent = "") {
  const storage = new Map();
  if (initialConsent) storage.set("vested-ksa-cookie-consent", initialConsent);
  const appendedScripts = [];
  const listeners = new Map();
  const dispatchedEvents = [];
  const localStorage = {
    getItem(key) {
      return storage.get(key) || null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  };
  const window = {
    dataLayer: [],
    localStorage,
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    dispatchEvent(event) {
      dispatchedEvents.push(event);
    },
  };
  const document = {
    createElement() {
      return {};
    },
    head: {
      appendChild(node) {
        appendedScripts.push(node.src);
      },
    },
  };
  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  vm.runInNewContext(source, { window, document, localStorage, CustomEvent, Date });
  return { window, storage, appendedScripts, dispatchedEvents };
}

test("unknown consent defaults denied and does not load analytics", () => {
  const state = runLoader();
  assert.deepEqual(state.appendedScripts, []);
  assert.equal(state.window.VestedConsent.getStatus(), "");
  assert.equal(state.window.dataLayer[0][0], "consent");
  assert.equal(state.window.dataLayer[0][1], "default");
  assert.equal(state.window.dataLayer[0][2].analytics_storage, "denied");
});

test("accept grants analytics storage and loads GA4 and GTM once", () => {
  const state = runLoader();
  state.window.VestedConsent.accept();
  state.window.VestedConsent.accept();
  assert.equal(state.storage.get("vested-ksa-cookie-consent"), "accepted");
  assert.equal(state.storage.get("cookieConsent"), "accepted");
  assert.equal(state.appendedScripts.length, 2);
  assert.match(state.appendedScripts[0], /gtag\/js\?id=G-7STG2HDV42/);
  assert.match(state.appendedScripts[1], /gtm\.js\?id=GTM-WL2FN4PR/);
  assert.equal(state.dispatchedEvents.at(-1).detail.status, "accepted");
});

test("declined consent remains denied and never loads analytics", () => {
  const state = runLoader("declined");
  state.window.VestedConsent.decline();
  assert.deepEqual(state.appendedScripts, []);
  assert.equal(state.window.VestedConsent.hasAnalyticsConsent(), false);
  assert.equal(state.dispatchedEvents.at(-1).detail.status, "declined");
});

test("stored acceptance restores analytics without waiting for interaction", () => {
  const state = runLoader("accepted");
  assert.equal(state.appendedScripts.length, 2);
  assert.equal(state.window.VestedConsent.hasAnalyticsConsent(), true);
});
