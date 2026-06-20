#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "data/company.json",
  "data/services.json",
  "data/capabilities.json",
  "data/service-areas.json",
  "data/project-inquiry-schema.json",
  "data/agent-routing.json",
  "llms.txt",
  "llms-full.txt",
  "llms-full.md",
  ".well-known/agent-card.json",
  ".well-known/api-catalog.json",
  ".well-known/mcp.json",
  ".well-known/mcp/server-card.json",
  ".well-known/mcp/server-cards.json",
  ".well-known/agent-skills/index.json",
  "openapi.json",
  "auth.md",
  "robots.txt",
  "sitemap.xml",
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
[
  "https://vestedksa.com/data/company.json",
  "https://vestedksa.com/data/services.json",
  "https://vestedksa.com/data/capabilities.json",
  "https://vestedksa.com/data/service-areas.json",
  "https://vestedksa.com/data/project-inquiry-schema.json",
  "https://vestedksa.com/data/agent-routing.json",
  "https://vestedksa.com/openapi.json",
  "https://vestedksa.com/.well-known/mcp.json",
].forEach((url) => {
  if (!sitemap.includes(url)) fail(`sitemap missing ${url}`);
});
ok("sitemap includes agent-readiness resources");

const robots = read("robots.txt");
["GPTBot", "ClaudeBot", "PerplexityBot", "/api/contact"].forEach((token) => {
  if (!robots.includes(token)) fail(`robots.txt missing ${token}`);
});
ok("robots includes crawler and private/contact guidance");

const llms = read("llms.txt");
[
  "/data/company.json",
  "/data/services.json",
  "/data/agent-routing.json",
  "/openapi.json",
  "/api/mcp",
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
  "/api/mcp",
  "/api/contact",
].forEach((apiPath) => {
  if (!openapi.paths || !openapi.paths[apiPath]) fail(`openapi missing ${apiPath}`);
});
ok("OpenAPI includes data, MCP, and contact endpoints");

const mcpCard = JSON.parse(read(".well-known/mcp/server-card.json"));
[
  "get_company_overview",
  "list_services",
  "match_project_scope",
  "prepare_project_inquiry",
  "list_service_areas",
  "read_public_resource",
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

const vercel = read("vercel.json");
["/api/mcp", "/.well-known/api-catalog"].forEach((route) => {
  if (!vercel.includes(route)) fail(`vercel.json missing route ${route}`);
});
ok("Vercel routes expose MCP and API catalog");

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Agent readiness validation passed.");
