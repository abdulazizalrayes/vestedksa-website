import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import test from "node:test";

const require = createRequire(import.meta.url);
const handler = require("../api/csp-report.js");

function invoke(method, payload = "") {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.setEncoding = () => {};
    req.destroy = () => {};
    const headers = new Map();
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        headers.set(String(name).toLowerCase(), String(value));
      },
      end() {
        resolve({ status: this.statusCode, headers });
      },
    };
    handler(req, res);
    queueMicrotask(() => {
      if (payload) req.emit("data", payload);
      req.emit("end");
    });
  });
}

test("CSP report endpoint accepts reports without persisting request identity", async () => {
  const originalLog = console.log;
  let record;
  console.log = (value) => {
    record = JSON.parse(value);
  };
  try {
    const response = await invoke("POST", JSON.stringify({
      "csp-report": {
        "document-uri": "https://vestedksa.com/services?private=value",
        "blocked-uri": "https://unexpected.example/script.js?token=secret",
        "effective-directive": "script-src-elem",
      },
    }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(record.documentPath, "/services");
    assert.equal(record.blockedResource, "https://unexpected.example");
    assert.equal(JSON.stringify(record).includes("private=value"), false);
    assert.equal(JSON.stringify(record).includes("token=secret"), false);
  } finally {
    console.log = originalLog;
  }
});

test("CSP report endpoint rejects non-reporting methods", async () => {
  const response = await invoke("GET");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST, OPTIONS");
});
