import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const ROOT = process.cwd();
const BASE_URL = String(process.env.BASE_URL || "https://vestedksa.com").replace(/\/+$/, "");
const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes";
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

async function checkCanonicalEntry(entry) {
  const pagePath = entry.path;
  const expectedCanonical = `${BASE_URL}${pagePath === "/" ? "/" : pagePath}`;
  const htmlResponse = await fetchChecked(pagePath, { headers: { Accept: "text/html" } });
  const markdownResponse = await fetchChecked(pagePath, { headers: { Accept: "text/markdown" } });
  const qZeroResponse = await fetchChecked(pagePath, { headers: { Accept: "text/markdown;q=0, text/html" } });
  const sidecarResponse = await fetchChecked(entry.sidecar);
  if (!htmlResponse || !markdownResponse || !qZeroResponse || !sidecarResponse) return;

  const html = await htmlResponse.text();
  const markdown = await markdownResponse.text();
  htmlBytes += Buffer.byteLength(html);
  markdownBytes += Buffer.byteLength(markdown);

  if (htmlResponse.status !== 200 || !htmlResponse.headers.get("content-type")?.includes("text/html")) {
    fail(`${pagePath}: ordinary request did not return 200 HTML`);
  }
  if (!/<html[\s>]/i.test(html)) fail(`${pagePath}: ordinary response does not contain an HTML document`);

  if (markdownResponse.status !== 200 || !markdownResponse.headers.get("content-type")?.includes("text/markdown")) {
    fail(`${pagePath}: Markdown negotiation did not return 200 text/markdown`);
  }
  if (markdownResponse.headers.get("content-location") !== entry.sidecar) {
    fail(`${pagePath}: incorrect Content-Location`);
  }
  if (markdownResponse.headers.get("content-language") !== entry.language) {
    fail(`${pagePath}: incorrect Content-Language`);
  }
  if (!markdownResponse.headers.get("link")?.includes(`<${expectedCanonical}>; rel="canonical"`)) {
    fail(`${pagePath}: missing canonical Link header`);
  }
  if (markdownResponse.headers.get("content-signal") !== CONTENT_SIGNAL) {
    fail(`${pagePath}: incorrect Content-Signal`);
  }
  if (!markdown.includes(`canonical: ${JSON.stringify(expectedCanonical)}`)) {
    fail(`${pagePath}: Markdown canonical metadata mismatch`);
  }

  if (qZeroResponse.status !== 200 || !qZeroResponse.headers.get("content-type")?.includes("text/html")) {
    fail(`${pagePath}: q=0 Markdown request did not fall back to HTML`);
  }
  await qZeroResponse.arrayBuffer();

  if (sidecarResponse.status !== 200 || !sidecarResponse.headers.get("content-type")?.includes("text/markdown")) {
    fail(`${entry.sidecar}: direct sidecar did not return 200 text/markdown`);
  }
  if (sidecarResponse.headers.get("x-robots-tag") !== "noindex, follow") {
    fail(`${entry.sidecar}: direct sidecar missing noindex, follow`);
  }
  if (sidecarResponse.headers.get("content-signal") !== CONTENT_SIGNAL) {
    fail(`${entry.sidecar}: direct sidecar has incorrect Content-Signal`);
  }
  await sidecarResponse.arrayBuffer();
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

const sitemapXml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const sitemap = new XMLParser({ ignoreAttributes: false }).parse(sitemapXml);
const sitemapUrls = new Set([].concat(sitemap?.urlset?.url || []).map((entry) => entry.loc));
for (const entry of manifest.entries) {
  if (!sitemapUrls.has(entry.canonical)) fail(`${entry.canonical}: canonical page missing from sitemap`);
}

await Promise.all(manifest.entries.map(checkCanonicalEntry));

const canonicalDataFiles = fs.readdirSync(path.join(ROOT, "data"))
  .filter((file) => file.endsWith(".json") && !/ \d+\.json$/i.test(file))
  .map((file) => `/data/${file}`);
const discoveryJson = [
  "/openapi.json",
  "/markdown/manifest.json",
  "/.well-known/agent-card.json",
  "/.well-known/api-catalog",
  "/.well-known/mcp.json",
  "/.well-known/mcp/server-card.json",
  "/.well-known/mcp/server-cards.json",
  "/.well-known/agent-skills/index.json",
];
await Promise.all([...canonicalDataFiles, ...discoveryJson].map(checkJson));
await checkMcp();

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
  `0 failures, ${reduction}% aggregate Markdown size reduction.`
);
