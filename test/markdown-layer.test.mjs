import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  htmlRepresentationHeaders,
  parseAcceptHeader,
  resolveDirectMarkdownEntry,
  resolveMarkdownEntry,
  resolveSidecarEntry,
  selectRepresentation,
} from "../lib/markdown-negotiation.mjs";
import manifest from "../markdown/manifest.json" with { type: "json" };

const require = createRequire(import.meta.url);
const markdownHandler = require("../api/markdown.js");
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

test("Accept parsing validates q-values", () => {
  assert.deepEqual(parseAcceptHeader("text/html, text/markdown;q=0.8")[1], {
    type: "text/markdown",
    q: 0.8,
  });
  assert.equal(parseAcceptHeader("text/markdown;q=1.5")[0].q, 0);
  assert.equal(parseAcceptHeader("text/markdown;q=invalid")[0].q, 0);
});

test("representation selection follows quality, specificity, and HTML tie rules", () => {
  const cases = [
    ["text/markdown", "markdown"],
    ["text/html", "html"],
    ["text/html;q=1, text/markdown;q=0.2", "html"],
    ["text/html;q=0.2, text/markdown;q=1", "markdown"],
    ["text/html, text/markdown", "html"],
    ["text/markdown;q=0, text/html", "html"],
    ["text/markdown;q=0", "not-acceptable"],
    ["text/*", "html"],
    ["*/*", "html"],
    ["text/*;q=1, text/html;q=1", "html"],
    ["text/*;q=1, text/markdown;q=1", "markdown"],
    ["text/*;q=1, text/html;q=0.5", "markdown"],
    ["*/*;q=1, text/html;q=0.5", "markdown"],
    ["text/markdown;q=0, text/*;q=1", "html"],
    ["text/html;q=0, text/markdown;q=0", "not-acceptable"],
    ["application/json", "html"],
    ["", "html"],
  ];
  for (const [header, expected] of cases) {
    assert.equal(selectRepresentation(header), expected, header || "(missing)");
  }
});

test("canonical, clean direct, and legacy sidecar routes resolve to one entry", () => {
  const canonical = resolveMarkdownEntry("/services", manifest);
  const direct = resolveDirectMarkdownEntry("/services.md", manifest);
  const sidecar = resolveSidecarEntry("/markdown/services.md", manifest);
  assert.equal(canonical?.path, "/services");
  assert.equal(direct?.path, "/services");
  assert.equal(sidecar?.path, "/services");
  assert.equal(resolveDirectMarkdownEntry("/missing.md", manifest), null);
});

test("HTML and HEAD metadata advertise the page-specific clean Markdown URL", () => {
  const services = resolveMarkdownEntry("/services", manifest);
  const headers = htmlRepresentationHeaders(services);
  assert.equal(
    headers.Link,
    '<https://vestedksa.com/services.md>; rel="alternate"; type="text/markdown"',
  );
  assert.equal(headers.Vary, "Accept");
  assert.equal(headers["Content-Signal"], CONTENT_SIGNAL);
  assert.match(headers["Content-Security-Policy-Report-Only"], /report-uri \/api\/csp-report/);
  assert.equal(
    headers["Reporting-Endpoints"],
    'csp-endpoint="https://vestedksa.com/api/csp-report"',
  );

  const home = resolveMarkdownEntry("/", manifest);
  const rootHeaders = htmlRepresentationHeaders(home, [
    '</llms.txt>; rel="alternate"; type="text/markdown"',
  ]);
  assert.match(rootHeaders.Link, /<https:\/\/vestedksa\.com\/index\.md>/);
  assert.match(rootHeaders.Link, /<\/llms\.txt>/);
});

function invokeHandler({ method = "GET", path = "/services", direct = "" } = {}) {
  return new Promise((resolve) => {
    const headers = new Map();
    const chunks = [];
    const req = { method, query: { path, direct } };
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        headers.set(String(name).toLowerCase(), String(value));
      },
      end(value) {
        if (value) chunks.push(Buffer.from(value));
        resolve({
          status: this.statusCode,
          headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      },
    };
    markdownHandler(req, res);
  });
}

test("Markdown handler returns complete negotiated headers", async () => {
  const response = await invokeHandler();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.equal(response.headers.get("content-location"), "/services.md");
  assert.equal(response.headers.get("content-language"), "en");
  assert.equal(response.headers.get("vary"), "Accept");
  assert.equal(response.headers.get("link"), '<https://vestedksa.com/services>; rel="canonical"');
  assert.equal(response.headers.get("content-signal"), CONTENT_SIGNAL);
  assert.equal(response.headers.has("x-robots-tag"), false);
  assert.match(response.body, /canonical: "https:\/\/vestedksa\.com\/services"/);
});

test("direct Markdown is noindex and HEAD has no body", async () => {
  const direct = await invokeHandler({ direct: "1" });
  assert.equal(direct.headers.get("x-robots-tag"), "noindex, follow");

  const head = await invokeHandler({ method: "HEAD", direct: "1" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("x-robots-tag"), "noindex, follow");
  assert.equal(head.body, "");
});

test("Markdown handler rejects unsupported methods", async () => {
  const response = await invokeHandler({ method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});
