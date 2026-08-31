import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const ROOT = process.cwd();
const BASE_URL = String(process.env.BASE_URL || "https://vestedksa.com").replace(/\/+$/, "");
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "markdown", "manifest.json"), "utf8"));
const failures = [];
let htmlBytes = 0;
let markdownBytes = 0;

function fail(message) {
  failures.push(message);
}

async function fetchChecked(pathname, options = {}) {
  try {
    return await fetch(`${BASE_URL}${pathname}`, { redirect: "manual", ...options });
  } catch (error) {
    fail(`${pathname}: request failed (${error.message})`);
    return null;
  }
}

function hasHeaderToken(response, name, token) {
  return String(response.headers.get(name) || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(token.toLowerCase());
}

function hasMarkdownType(response) {
  return response.headers.get("content-type")?.includes("text/markdown");
}

function hasHtmlType(response) {
  return response.headers.get("content-type")?.includes("text/html");
}

function checkMarkdownHeaders(response, entry, expectedCanonical, label, direct) {
  if (response.status !== 200 || !hasMarkdownType(response)) {
    fail(`${label}: expected 200 text/markdown`);
  }
  if (response.headers.get("content-location") !== entry.direct) {
    fail(`${label}: incorrect Content-Location`);
  }
  if (response.headers.get("content-language") !== entry.language) {
    fail(`${label}: incorrect Content-Language`);
  }
  if (!response.headers.get("link")?.includes(`<${expectedCanonical}>; rel="canonical"`)) {
    fail(`${label}: missing canonical Link header`);
  }
  if (!hasHeaderToken(response, "vary", "accept")) {
    fail(`${label}: missing Vary: Accept`);
  }
  if (response.headers.get("content-signal") !== CONTENT_SIGNAL) {
    fail(`${label}: incorrect Content-Signal`);
  }
  if (direct && response.headers.get("x-robots-tag") !== "noindex, follow") {
    fail(`${label}: direct Markdown missing noindex, follow`);
  }
  if (!direct && response.headers.has("x-robots-tag")) {
    fail(`${label}: negotiated canonical Markdown must not be noindex`);
  }
}

async function checkCanonicalEntry(entry) {
  const pagePath = entry.path;
  const expectedCanonical = `${BASE_URL}${pagePath === "/" ? "/" : pagePath}`;
  const expectedAlternate = `<${BASE_URL}${entry.direct}>; rel="alternate"; type="text/markdown"`;
  const htmlResponse = await fetchChecked(pagePath, { headers: { Accept: "text/html" } });
  const htmlHeadResponse = await fetchChecked(pagePath, {
    method: "HEAD",
    headers: { Accept: "text/html" },
  });
  const markdownResponse = await fetchChecked(pagePath, { headers: { Accept: "text/markdown" } });
  const qZeroResponse = await fetchChecked(pagePath, { headers: { Accept: "text/markdown;q=0, text/html" } });
  const directResponse = await fetchChecked(entry.direct);
  const directHeadResponse = await fetchChecked(entry.direct, { method: "HEAD" });
  const legacyResponse = await fetchChecked(entry.sidecar);
  if (
    !htmlResponse ||
    !htmlHeadResponse ||
    !markdownResponse ||
    !qZeroResponse ||
    !directResponse ||
    !directHeadResponse ||
    !legacyResponse
  ) return;

  const html = await htmlResponse.text();
  const markdown = await markdownResponse.text();
  htmlBytes += Buffer.byteLength(html);
  markdownBytes += Buffer.byteLength(markdown);

  if (htmlResponse.status !== 200 || !htmlResponse.headers.get("content-type")?.includes("text/html")) {
    fail(`${pagePath}: ordinary request did not return 200 HTML`);
  }
  if (!/<html[\s>]/i.test(html)) fail(`${pagePath}: ordinary response does not contain an HTML document`);
  if (!htmlResponse.headers.get("link")?.includes(expectedAlternate)) {
    fail(`${pagePath}: HTML response missing page-specific Markdown alternate Link`);
  }
  if (!hasHeaderToken(htmlResponse, "vary", "accept")) {
    fail(`${pagePath}: HTML response missing Vary: Accept`);
  }
  if (htmlResponse.headers.get("content-signal") !== CONTENT_SIGNAL) {
    fail(`${pagePath}: HTML response has incorrect Content-Signal`);
  }
  if (!htmlResponse.headers.get("content-security-policy-report-only")?.includes("report-uri /api/csp-report")) {
    fail(`${pagePath}: HTML response missing report-only CSP`);
  }
  if (htmlHeadResponse.status !== 200 || !hasHtmlType(htmlHeadResponse)) {
    fail(`${pagePath}: HTML HEAD did not return 200 HTML headers`);
  }
  if (!htmlHeadResponse.headers.get("link")?.includes(expectedAlternate)) {
    fail(`${pagePath}: HTML HEAD missing page-specific Markdown alternate Link`);
  }
  if (!hasHeaderToken(htmlHeadResponse, "vary", "accept")) {
    fail(`${pagePath}: HTML HEAD missing Vary: Accept`);
  }
  if (htmlHeadResponse.headers.get("content-signal") !== CONTENT_SIGNAL) {
    fail(`${pagePath}: HTML HEAD has incorrect Content-Signal`);
  }
  if (!htmlHeadResponse.headers.get("content-security-policy-report-only")?.includes("report-uri /api/csp-report")) {
    fail(`${pagePath}: HTML HEAD missing report-only CSP`);
  }

  checkMarkdownHeaders(markdownResponse, entry, expectedCanonical, pagePath, false);
  if (!markdown.includes(`canonical: ${JSON.stringify(expectedCanonical)}`)) {
    fail(`${pagePath}: Markdown canonical metadata mismatch`);
  }

  if (qZeroResponse.status !== 200 || !qZeroResponse.headers.get("content-type")?.includes("text/html")) {
    fail(`${pagePath}: q=0 Markdown request did not fall back to HTML`);
  }
  await qZeroResponse.arrayBuffer();

  checkMarkdownHeaders(directResponse, entry, expectedCanonical, entry.direct, true);
  const directMarkdown = await directResponse.text();
  if (!directMarkdown.includes(`direct_markdown: ${JSON.stringify(entry.direct)}`)) {
    fail(`${entry.direct}: direct Markdown metadata mismatch`);
  }
  checkMarkdownHeaders(directHeadResponse, entry, expectedCanonical, `HEAD ${entry.direct}`, true);
  if ((await directHeadResponse.arrayBuffer()).byteLength !== 0) {
    fail(`HEAD ${entry.direct}: response body must be empty`);
  }

  checkMarkdownHeaders(legacyResponse, entry, expectedCanonical, entry.sidecar, true);
  await legacyResponse.arrayBuffer();
}

async function checkAcceptMatrix() {
  const cases = [
    ["exact HTML", "text/html", 200, "html"],
    ["exact Markdown", "text/markdown", 200, "markdown"],
    ["stronger HTML", "text/html;q=1, text/markdown;q=0.2", 200, "html"],
    ["stronger Markdown", "text/html;q=0.2, text/markdown;q=1", 200, "markdown"],
    ["equal explicit", "text/html, text/markdown", 200, "html"],
    ["Markdown q=0", "text/markdown;q=0, text/html", 200, "html"],
    ["text wildcard tie", "text/*", 200, "html"],
    ["global wildcard tie", "*/*", 200, "html"],
    ["equal q favors specific HTML", "text/*;q=1, text/html;q=1", 200, "html"],
    ["equal q favors specific Markdown", "text/*;q=1, text/markdown;q=1", 200, "markdown"],
    ["text wildcard favors Markdown", "text/*;q=1, text/html;q=0.5", 200, "markdown"],
    ["global wildcard favors Markdown", "*/*;q=1, text/html;q=0.5", 200, "markdown"],
    ["both q=0", "text/html;q=0, text/markdown;q=0", 406, "none"],
  ];

  for (const [label, accept, expectedStatus, expectedType] of cases) {
    const response = await fetchChecked("/services", { headers: { Accept: accept } });
    if (!response) continue;
    if (response.status !== expectedStatus) {
      fail(`Accept matrix ${label}: expected ${expectedStatus}, received ${response.status}`);
    } else if (expectedType === "html" && !hasHtmlType(response)) {
      fail(`Accept matrix ${label}: expected HTML`);
    } else if (expectedType === "markdown" && !hasMarkdownType(response)) {
      fail(`Accept matrix ${label}: expected Markdown`);
    }
    await response.arrayBuffer();
  }
}

async function checkJson(pathname) {
  const response = await fetchChecked(pathname, { headers: { Accept: "application/json" } });
  if (!response) return;
  if (response.status !== 200) {
    fail(`${pathname}: expected 200, received ${response.status}`);
    return;
  }
  try {
    JSON.parse(await response.text());
  } catch {
    fail(`${pathname}: response is not valid JSON`);
  }
}

async function checkMcp() {
  const response = await fetchChecked("/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "vested-live-validator", version: "1.0.0" },
      },
    }),
  });
  if (!response) return;
  const body = await response.json();
  if (response.status !== 200 || body.result?.protocolVersion !== "2025-11-25") {
    fail("/api/mcp: current protocol initialization failed");
  }
  if (response.headers.get("mcp-protocol-version") !== "2025-11-25") {
    fail("/api/mcp: current protocol response header missing");
  }
}

async function checkA2a() {
  const metadataResponse = await fetchChecked("/api/a2a", { headers: { Accept: "application/json" } });
  const headResponse = await fetchChecked("/api/a2a", { method: "HEAD" });
  if (!metadataResponse || !headResponse) return;
  const metadata = await metadataResponse.json();
  if (metadataResponse.status !== 200 || metadata.protocolVersion !== "1.0" || metadata.readOnly !== true || metadata.submissionAllowed !== false) {
    fail("/api/a2a: public endpoint metadata is invalid");
  }
  if (headResponse.status !== 200 || headResponse.headers.get("a2a-version") !== "1.0" || !headResponse.headers.get("link")?.includes("agent-card.json")) {
    fail("/api/a2a: HEAD discovery headers are invalid");
  }
  const response = await fetchChecked("/api/a2a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "A2A-Version": "1.0",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "SendMessage",
      params: {
        message: {
          messageId: "vested-live-validator",
          role: "ROLE_USER",
          parts: [{ text: "We are an international company entering Saudi Arabia and need a 90-day launch brief." }],
        },
        metadata: { skillId: "build_90_day_launch_brief" },
        configuration: { acceptedOutputModes: ["application/json"] },
      },
    }),
  });
  if (!response) return;
  const body = await response.json();
  const message = body.result?.message;
  const data = message?.parts?.find((part) => part.mediaType === "application/json")?.data;
  if (response.status !== 200 || message?.role !== "ROLE_AGENT") {
    fail("/api/a2a: A2A SendMessage failed");
  }
  if (response.headers.get("a2a-version") !== "1.0") {
    fail("/api/a2a: A2A-Version response header missing");
  }
  if (response.headers.get("content-signal") !== CONTENT_SIGNAL) {
    fail("/api/a2a: owner-approved Content-Signal missing");
  }
  if (data?.company !== "Vested KSA" || data?.inquiry?.submissionStatus !== "not_submitted" || data?.safety?.storesConversation !== false) {
    fail("/api/a2a: identity or read-only safety contract failed");
  }
}

const sitemapXml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const sitemap = new XMLParser({ ignoreAttributes: false }).parse(sitemapXml);
const sitemapUrls = new Set([].concat(sitemap?.urlset?.url || []).map((entry) => entry.loc));
for (const entry of manifest.entries) {
  if (!sitemapUrls.has(entry.canonical)) fail(`${entry.canonical}: canonical page missing from sitemap`);
}

await Promise.all(manifest.entries.map(checkCanonicalEntry));
await checkAcceptMatrix();

const canonicalDataFiles = fs.readdirSync(path.join(ROOT, "data"))
  .filter((file) => file.endsWith(".json") && !/ \d+\.json$/i.test(file))
  .map((file) => `/data/${file}`);
const discoveryJson = [
  "/openapi.json",
  "/markdown/manifest.json",
  "/.well-known/ai-catalog.json",
  "/.well-known/agent-card.json",
  "/.well-known/api-catalog",
  "/.well-known/mcp.json",
  "/.well-known/mcp/server-card.json",
  "/.well-known/mcp/server-cards.json",
  "/.well-known/agent-skills/index.json",
];
await Promise.all([...canonicalDataFiles, ...discoveryJson].map(checkJson));
await checkMcp();
await checkA2a();

for (const pathname of [
  "/data/company%202.json",
  "/data/source-map%203.json",
  "/markdown/manifest%202.json",
  "/docs/advanced-analytics-playbook%203.md",
]) {
  const response = await fetchChecked(pathname);
  if (response && response.status !== 404) fail(`${pathname}: stale duplicate path is publicly reachable`);
  if (response) await response.arrayBuffer();
}

if (failures.length) {
  console.error(failures.map((message) => `FAIL: ${message}`).join("\n"));
  process.exit(1);
}

const reduction = htmlBytes ? ((1 - markdownBytes / htmlBytes) * 100).toFixed(1) : "0.0";
console.log(
  `Live agent surface passed: ${manifest.entries.length}/${manifest.entries.length} canonical pages, ` +
  `${canonicalDataFiles.length} data resources, ${discoveryJson.length} discovery resources, ` +
  `0 failures, ${htmlBytes} HTML bytes, ${markdownBytes} Markdown bytes, ` +
  `${reduction}% aggregate Markdown size reduction.`
);
