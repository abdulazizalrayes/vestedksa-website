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
  ".well-known/api-catalog.json",
  ".well-known/mcp.json",
  ".well-known/mcp/server-card.json",
  ".well-known/mcp/server-cards.json",
  ".well-known/agent-skills/index.json",
  "openapi.json",
  "auth.md",
  "docs/advanced-analytics-playbook.md",
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
  "https://vestedksa.com/data/answer-engine.json",
  "https://vestedksa.com/data/decision-trees.json",
  "https://vestedksa.com/data/entity-glossary.json",
  "https://vestedksa.com/data/source-map.json",
  "https://vestedksa.com/data/analytics-events.json",
  "https://vestedksa.com/data/agent-manifest.json",
  "https://vestedksa.com/data/schema-versions.json",
  "https://vestedksa.com/data/changelog.json",
  "https://vestedksa.com/data/procurement-routing.json",
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
  "/data/answer-engine.json",
  "/data/source-map.json",
  "/data/procurement-routing.json",
  "/data/agent-manifest.json",
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
  "/data/answer-engine.json",
  "/data/decision-trees.json",
  "/data/entity-glossary.json",
  "/data/source-map.json",
  "/data/analytics-events.json",
  "/data/agent-manifest.json",
  "/data/schema-versions.json",
  "/data/changelog.json",
  "/data/procurement-routing.json",
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

const vercel = read("vercel.json");
["/api/mcp", "/.well-known/api-catalog"].forEach((route) => {
  if (!vercel.includes(route)) fail(`vercel.json missing route ${route}`);
});
ok("Vercel routes expose MCP and API catalog");

function callMcp(payload) {
  return new Promise((resolve, reject) => {
    const handler = require(path.join(root, "api", "mcp.js"));
    const req = new EventEmitter();
    req.method = "POST";
    req.url = "/api/mcp";
    req.headers = { "content-type": "application/json", "user-agent": "agent-readiness-validator" };
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
