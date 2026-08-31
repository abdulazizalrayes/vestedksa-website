import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import test from "node:test";

const require = createRequire(import.meta.url);
const handler = require("../api/mcp.js");
const { resetForTests } = require("../lib/agent-abuse-guard.cjs");

function invoke(method, payload = "", headers = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = "/api/mcp";
    req.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
    const responseHeaders = new Map();
    let body = "";
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        responseHeaders.set(String(name).toLowerCase(), String(value));
      },
      end(chunk = "") {
        body += chunk || "";
        resolve({ status: this.statusCode, headers: responseHeaders, body });
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
    queueMicrotask(() => {
      if (payload) req.emit("data", payload);
      req.emit("end");
    });
  });
}

test("MCP requires JSON and rejects request bodies above 32 KiB", async () => {
  resetForTests();
  const wrongType = await invoke("POST", "{}", { "content-type": "text/plain" });
  assert.equal(wrongType.status, 415);

  const oversized = await invoke(
    "POST",
    JSON.stringify({ value: "x".repeat(33 * 1024) }),
    { "content-type": "application/json" },
  );
  assert.equal(oversized.status, 413);
});

test("MCP temporarily rejects a source after repeated malformed requests", async () => {
  resetForTests();
  const headers = {
    "content-type": "application/json",
    "x-forwarded-for": "192.0.2.30",
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const malformed = await invoke("POST", "{", headers);
    assert.equal(malformed.status, 400);
  }

  const blocked = await invoke(
    "POST",
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    headers,
  );
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});
