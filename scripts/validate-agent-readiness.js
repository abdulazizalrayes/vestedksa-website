#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "data/company.json",
  "data/services.json",
  "data/capabilities.json",
  "data/service-areas.json",
  "data/project-inquiry-schema.json",
  "data/agent-routing.json",
  "data/answer-engine.json",
  "data/decision-trees.json",
  "data/entity-glossary.json",
  "data/source-map.json",
  "data/analytics-events.json",
  "data/agent-manifest.json",
  "data/schema-versions.json",
  "data/changelog.json",
  "data/procurement-routing.json",
  "llms.txt",
  "llms-full.txt",
  "llms-full.md",
  ".well-known/agent-card.json",
  ".well-known/ai-catalog.json",
  ".well-known/api-catalog.json",
  ".well-known/mcp.json",
  ".well-known/mcp/server-card.json",
  ".well-known/mcp/server-cards.json",
  ".well-known/agent-skills/index.json",
  "openapi.json",
  "auth.md",
  "docs/advanced-analytics-playbook.md",
  "docs/bing-indexnow.md",
  "docs/markdown-for-agents.md",
  "markdown/manifest.json",
  "middleware.ts",
  "api/markdown.js",
  "api/csp-report.js",
  "lib/markdown-assets.cjs",
  "lib/markdown-negotiation.mjs",
  "scripts/generate-markdown-companions.mjs",
  "scripts/validate-deployment-output.mjs",
  "scripts/validate-live-agent-surface.mjs",
  "scripts/validate-markdown-layer.mjs",
  "test/markdown-layer.test.mjs",
  "analytics-loader.js",
  "robots.txt",
  "sitemap.xml",
  "29b92482-dc1f-4e7d-8184-cf3de5f9937e.txt",
  "vercel.json",
  "api/mcp.js",
];

const jsonFiles = requiredFiles.filter((file) => file.endsWith(".json"));
const htmlFiles = [
  "index.html",
  "about.html",
  "services.html",
  "why-saudi.html",
  "ethics.html",
  "insights.html",
  "faq.html",
  "contact.html",
  "privacy.html",
  "terms.html",
];
const insightHtmlFiles = [
  "insights/foreign-ownership-saudi-arabia.html",
  "insights/ksa-market-entry-guide-2026.html",
  "insights/misa-licensing-commercial-registration-saudi-arabia.html",
  "insights/regional-headquarters-rhq-saudi-arabia.html",
  "insights/saudi-e-invoicing-operating-controls.html",
  "insights/saudi-vendor-registration-aramco-pif.html",
  "insights/saudization-nitaqat-hr-saudi-arabia.html",
  "insights/vat-zakat-saudi-arabia.html",
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`Missing required file ${file}`);
  }
}
ok("required files present");

for (const file of jsonFiles) {
  try {
    JSON.parse(read(file));
  } catch (error) {
    fail(`${file} is invalid JSON: ${error.message}`);
  }
}
ok("JSON files parse");

const sitemap = read("sitemap.xml");
const canonicalSitemapUrls = [
  "https://vestedksa.com/",
  "https://vestedksa.com/ar",
  "https://vestedksa.com/zh",
  "https://vestedksa.com/about",
  "https://vestedksa.com/services",
  "https://vestedksa.com/why-saudi",
  "https://vestedksa.com/ethics",
  "https://vestedksa.com/insights",
  ...insightHtmlFiles.map((file) => `https://vestedksa.com/${file.replace(/\.html$/, "")}`),
  "https://vestedksa.com/faq",
  "https://vestedksa.com/contact",
  "https://vestedksa.com/privacy",
  "https://vestedksa.com/terms",
];
canonicalSitemapUrls.forEach((url) => {
  if (!sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap missing canonical page ${url}`);
});
if (/https:\/\/vestedksa\.com\/(?:data\/|\.well-known\/|openapi\.json|docs\/|[^<]+\.txt)/.test(sitemap)) {
  fail("sitemap contains a non-HTML machine resource");
}
ok("sitemap contains only canonical indexable HTML pages");

const robots = read("robots.txt");
["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "/api/contact"].forEach((token) => {
  if (!robots.includes(token)) fail(`robots.txt missing ${token}`);
});
for (const trainingBot of ["GPTBot", "Google-Extended", "ClaudeBot", "CCBot", "Bytespider"]) {
  if (!robots.includes(`User-agent: ${trainingBot}\nDisallow: /`)) fail(`robots.txt does not block training bot ${trainingBot}`);
}
if (!/^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m.test(robots)) {
  fail("robots.txt missing owner-approved Content-Signal policy");
}
ok("robots separates search/input crawlers from model-training crawlers and publishes Content-Signal");

const indexNowKeyFile = "29b92482-dc1f-4e7d-8184-cf3de5f9937e.txt";
const indexNowKey = read(indexNowKeyFile).trim();
if (indexNowKeyFile !== `${indexNowKey}.txt`) {
  fail("IndexNow key file name must match the key value");
}
if (!/^[A-Za-z0-9-]{8,128}$/.test(indexNowKey)) {
  fail("IndexNow key must be 8-128 characters and contain only letters, numbers, or dashes");
}
const bingIndexNowDoc = read("docs/bing-indexnow.md");
[
  "https://vestedksa.com/sitemap.xml",
  `https://vestedksa.com/${indexNowKeyFile}`,
  "npm run indexnow:submit",
  "Bing Webmaster Tools",
].forEach((token) => {
  if (!bingIndexNowDoc.includes(token)) fail(`docs/bing-indexnow.md missing ${token}`);
});
ok("IndexNow key and Bing operations documentation are present");

const contactApi = read("api/contact.js");
if (!contactApi.includes("X-Robots-Tag") || !contactApi.includes("noindex")) {
  fail("api/contact.js missing X-Robots-Tag noindex guidance");
}
ok("contact API declares noindex for crawlers");

const llms = read("llms.txt");
[
  "/data/company.json",
  "/data/services.json",
  "/data/agent-routing.json",
  "/data/answer-engine.json",
  "/data/source-map.json",
  "/data/procurement-routing.json",
  "/data/agent-manifest.json",
  "/openapi.json",
  "/.well-known/ai-catalog.json",
  "/api/mcp",
  "/markdown/manifest.json",
  "/services.md",
  "/docs/bing-indexnow.md",
  "Agents must not submit contact forms",
].forEach((token) => {
  if (!llms.includes(token)) fail(`llms.txt missing ${token}`);
});
ok("llms.txt points to structured resources and safety rules");

const openapi = JSON.parse(read("openapi.json"));
[
  "/data/company.json",
  "/data/services.json",
  "/data/capabilities.json",
  "/data/service-areas.json",
  "/data/project-inquiry-schema.json",
  "/data/agent-routing.json",
  "/data/answer-engine.json",
  "/data/decision-trees.json",
  "/data/entity-glossary.json",
  "/data/source-map.json",
  "/data/analytics-events.json",
  "/data/agent-manifest.json",
  "/data/schema-versions.json",
  "/data/changelog.json",
  "/data/procurement-routing.json",
  "/.well-known/ai-catalog.json",
  "/api/mcp",
  "/api/contact",
  "/markdown/manifest.json",
  "/markdown/{sidecar}.md",
  "/api/markdown",
].forEach((apiPath) => {
  if (!openapi.paths || !openapi.paths[apiPath]) fail(`openapi missing ${apiPath}`);
});
ok("OpenAPI includes data, MCP, and contact endpoints");

const aiCatalog = JSON.parse(read(".well-known/ai-catalog.json"));
if (aiCatalog.specVersion !== "1.0" || !Array.isArray(aiCatalog.entries) || aiCatalog.entries.length === 0) {
  fail("ARD catalog must declare specVersion 1.0 and at least one entry");
}
for (const entry of aiCatalog.entries || []) {
  if (!/^urn:air:vestedksa\.com:/.test(entry.identifier || "")) fail(`ARD entry has invalid Vested identifier: ${entry.identifier}`);
  if (Boolean(entry.url) === Boolean(entry.data)) fail(`ARD entry ${entry.identifier} must contain exactly one of url or data`);
  if (!Array.isArray(entry.representativeQueries) || entry.representativeQueries.length < 2 || entry.representativeQueries.length > 5) {
    fail(`ARD entry ${entry.identifier} must contain 2-5 representativeQueries`);
  }
}
ok("ARD catalog is domain-anchored and query-ready");

const apiCatalog = JSON.parse(read(".well-known/api-catalog.json"));
if (!Array.isArray(apiCatalog.linkset) || apiCatalog.linkset.length === 0) {
  fail("API catalog missing RFC 9264 linkset array");
}
if (apiCatalog.agenticResourceDiscovery !== "https://vestedksa.com/.well-known/ai-catalog.json") {
  fail("API catalog missing ARD discovery URL");
}
ok("API catalog includes RFC 9264 linkset array");

const authMd = read("auth.md");
if (!/^#\s+Auth\.md\b/m.test(authMd)) {
  fail("auth.md missing Auth.md H1 heading");
}
if (!/Agent Registration/.test(authMd) || !/Supported Agent Registration Flows/.test(authMd)) {
  fail("auth.md missing agent registration guidance");
}
ok("auth.md has expected Auth.md heading");

const agentCard = JSON.parse(read(".well-known/agent-card.json"));
if (!Array.isArray(agentCard.supportedInterfaces) || agentCard.supportedInterfaces.length === 0) {
  fail("agent-card.json missing supportedInterfaces");
}
ok("agent card lists supported interfaces");

const mcpCard = JSON.parse(read(".well-known/mcp/server-card.json"));
if (mcpCard.protocolVersion !== "2025-11-25") {
  fail("MCP server card must advertise the current finalized protocol version");
}
[
  "get_company_overview",
  "list_services",
  "match_project_scope",
  "prepare_project_inquiry",
  "list_service_areas",
  "read_public_resource",
  "get_answer_engine_assets",
  "get_market_entry_decision_trees",
  "get_entity_glossary",
  "get_agent_manifest",
  "match_procurement_scope",
].forEach((tool) => {
  if (!mcpCard.tools || !mcpCard.tools.includes(tool)) fail(`MCP server card missing tool ${tool}`);
});
ok("MCP server card lists typed tools");

for (const file of htmlFiles) {
  const html = read(file);
  if (!/<link\s+rel=["']canonical["']/.test(html)) fail(`${file} missing canonical`);
  if (!/<meta\s+name=["']robots["']/.test(html)) fail(`${file} missing robots meta`);
}
ok("core HTML pages include canonical and robots meta");

const analyticsLoader = read("analytics-loader.js");
["G-7STG2HDV42", "GTM-WL2FN4PR", "analytics_storage", "VestedConsent"].forEach((identifier) => {
  if (!analyticsLoader.includes(identifier)) fail(`analytics-loader.js missing ${identifier}`);
});
for (const file of [...htmlFiles, "ar/index.html", "zh/index.html", ...insightHtmlFiles]) {
  if (!read(file).includes('<script src="/analytics-loader.js" defer></script>')) {
    fail(`${file} missing shared analytics loader`);
  }
  if (/googletagmanager\.com\/(?:gtag|gtm|ns\.html)/.test(read(file))) {
    fail(`${file} contains a direct analytics consent bypass`);
  }
}
ok("all canonical pages use consent-aware Vested analytics instrumentation");

const vercel = read("vercel.json");
let vercelConfig;
try {
  vercelConfig = JSON.parse(vercel);
} catch (error) {
  fail(`vercel.json is invalid JSON: ${error.message}`);
  vercelConfig = {};
}

if (Object.prototype.hasOwnProperty.call(vercelConfig, "builds")) {
  fail("vercel.json still uses legacy builds");
}
if (Object.prototype.hasOwnProperty.call(vercelConfig, "routes")) {
  fail("vercel.json still uses legacy routes");
}
if (vercelConfig.cleanUrls !== true) {
  fail("vercel.json must keep cleanUrls enabled for extensionless canonical URLs");
}
const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];
const headers = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [];
const redirects = Array.isArray(vercelConfig.redirects) ? vercelConfig.redirects : [];
if (!rewrites.some((rewrite) => rewrite.source === "/.well-known/api-catalog" && rewrite.destination === "/.well-known/api-catalog.json")) {
  fail("vercel.json missing API catalog rewrite");
}
if (!headers.some((header) => header.source === "/:path*" && header.headers.some((item) => item.key === "X-Content-Type-Options"))) {
  fail("vercel.json missing global security headers");
}
if (!headers.some((header) => header.source === "/:path*" && header.headers.some((item) => item.key === "Content-Signal" && item.value === "search=yes, ai-input=yes, ai-train=no"))) {
  fail("vercel.json missing global owner-approved Content-Signal header");
}
if (!headers.some((header) => header.source === "/:path*" && header.headers.some((item) => item.key === "Content-Security-Policy-Report-Only"))) {
  fail("vercel.json missing report-only Content Security Policy");
}
if (!headers.some((header) => header.source === "/" && header.headers.some((item) => item.key === "X-Content-Type-Options"))) {
  fail("vercel.json missing root-page security headers");
}
const middleware = read("middleware.ts");
const markdownNegotiation = read("lib/markdown-negotiation.mjs");
if (!middleware.includes("ROOT_DISCOVERY_LINKS") || !middleware.includes("/.well-known/mcp.json")) {
  fail("middleware.ts missing root agent-discovery Link header");
}
if (!headers.some((header) => header.source === "/markdown/(.*)\\.md" && header.headers.some((item) => item.key === "X-Robots-Tag" && item.value === "noindex, follow"))) {
  fail("vercel.json missing direct Markdown sidecar noindex header");
}
if (!middleware.includes("Accept") && !middleware.includes("selectRepresentation")) {
  fail("middleware.ts missing Accept-header Markdown negotiation");
}
if (
  !middleware.includes("htmlRepresentationHeaders") ||
  !markdownNegotiation.includes('rel="alternate"; type="text/markdown"') ||
  !markdownNegotiation.includes('Vary: "Accept"')
) {
  fail("Markdown negotiation layer missing page-specific alternate headers");
}
for (const directRoute of ["/index.md", "/insights.md", "/services.md"]) {
  if (!middleware.includes(`'${directRoute}'`)) {
    fail(`middleware.ts missing clean direct matcher ${directRoute}`);
  }
}
if (!read("api/markdown.js").includes("Content-Location") || !read("api/markdown.js").includes("Content-Signal")) {
  fail("api/markdown.js missing Markdown response headers");
}
if (!redirects.some((redirect) => redirect.source === "/:path*" && redirect.destination === "https://vestedksa.com/:path*" && redirect.permanent === true)) {
  fail("vercel.json missing permanent www-to-apex redirect");
}
ok("Vercel config uses modern redirects, rewrites, headers, and clean URLs");

const vercelIgnore = read(".vercelignore");
if (!/^CLAUDE\.md$/m.test(vercelIgnore)) {
  fail(".vercelignore must exclude CLAUDE.md from public deployments");
}
if (!/^test\/$/m.test(vercelIgnore)) {
  fail(".vercelignore must exclude local unit tests from public deployments");
}
if (!/^README\.md$/m.test(vercelIgnore)) {
  fail(".vercelignore must exclude README.md from public deployments");
}
if (!/^scripts\/$/m.test(vercelIgnore)) {
  fail(".vercelignore must exclude internal scripts from public deployments");
}
if (!/^\* \[0-9\]\.\*$/m.test(vercelIgnore)) {
  fail(".vercelignore must exclude Finder-style suffixed duplicate files");
}
ok("Vercel ignores internal instructions, repo README, and scripts");

function callMcp(payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const handler = require(path.join(root, "api", "mcp.js"));
    const req = new EventEmitter();
    req.method = "POST";
    req.url = "/api/mcp";
    req.headers = {
      "content-type": "application/json",
      "user-agent": "agent-readiness-validator",
      ...headers,
    };
    req.destroy = reject;

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      end(body) {
        try {
          resolve({
            statusCode: this.statusCode,
            body: body ? JSON.parse(body) : null,
          });
        } catch (error) {
          reject(error);
        }
      },
    };

    handler(req, res).catch(reject);
    process.nextTick(() => {
      req.emit("data", JSON.stringify(payload));
      req.emit("end");
    });
  });
}

async function validateMcpRuntime() {
  const initialize = await callMcp({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "agent-readiness-validator", version: "1.0.0" },
    },
  });
  if (initialize.body.result.protocolVersion !== "2025-11-25") {
    fail("MCP initialize does not negotiate protocol version 2025-11-25");
  }

  const initialized = await callMcp(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { "mcp-protocol-version": "2025-11-25" }
  );
  if (initialized.statusCode !== 202 || initialized.body !== null) {
    fail("MCP initialized notification must return 202 without a response body");
  }

  const unsupportedVersion = await callMcp(
    { jsonrpc: "2.0", id: 0.5, method: "ping" },
    { "mcp-protocol-version": "2020-01-01" }
  );
  if (unsupportedVersion.statusCode !== 400 || !unsupportedVersion.body.error) {
    fail("MCP must reject unsupported protocol versions");
  }

  const resourceRead = await callMcp({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "read_public_resource",
      arguments: { resource: "/data/company.json" },
    },
  });
  if (resourceRead.statusCode !== 200 || resourceRead.body.error) {
    fail("MCP read_public_resource failed for /data/company.json");
    return;
  }

  const readResult = JSON.parse(resourceRead.body.result.content[0].text);
  if (readResult.name !== "company" || !readResult.text.includes("Vested KSA")) {
    fail("MCP read_public_resource returned unexpected company content");
  }

  const nonFit = await callMcp({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "match_project_scope",
      arguments: { request: "I want to apply for an internship and send my CV" },
    },
  });
  const nonFitResult = JSON.parse(nonFit.body.result.content[0].text);
  if (nonFitResult.fit !== "not_fit" || nonFitResult.route !== "do_not_use_project_inquiry") {
    fail("MCP match_project_scope does not route internships away from project inquiry");
  }

  const inquiry = await callMcp({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "prepare_project_inquiry",
      arguments: {
        company_name: "Example Ltd",
        contact_name: "Example Contact",
        contact_email: "contact@example.com",
        headquarters_country: "United Kingdom",
        market_entry_goal: "form_saudi_entity",
        timeline: "90 days",
        services_needed: ["company-formation-setup"],
        message: "We want to prepare a Saudi launch plan.",
      },
    },
  });
  const inquiryResult = JSON.parse(inquiry.body.result.content[0].text);
  if (inquiryResult.approvalRequired !== true || inquiryResult.submissionStatus !== "not_submitted") {
    fail("MCP prepare_project_inquiry does not preserve approval/no-submit rule");
  }

  const answerAssets = await callMcp({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "get_answer_engine_assets",
      arguments: {},
    },
  });
  const answerResult = JSON.parse(answerAssets.body.result.content[0].text);
  if (!Array.isArray(answerResult.answerBlocks) || !answerResult.answerBlocks.length) {
    fail("MCP get_answer_engine_assets returned no answer blocks");
  }

  const procurement = await callMcp({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "match_procurement_scope",
      arguments: { request: "We need Aramco supplier registration and a Saudi vendor evidence pack" },
    },
  });
  const procurementResult = JSON.parse(procurement.body.result.content[0].text);
  if (procurementResult.fit !== "good_fit" || procurementResult.shouldPrepareInquiry !== true) {
    fail("MCP match_procurement_scope does not route Saudi vendor-registration requests correctly");
  }

  ok("MCP runtime tools route and read safely");
}

validateMcpRuntime()
  .then(() => {
    if (process.exitCode) {
      process.exit(process.exitCode);
    }
    console.log("Agent readiness validation passed.");
  })
  .catch((error) => {
    fail(`MCP runtime validation failed: ${error.message}`);
    process.exit(process.exitCode || 1);
  });
