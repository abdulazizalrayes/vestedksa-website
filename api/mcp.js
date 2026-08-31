"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { recordAgentEvent } = require("../lib/server-agent-telemetry.cjs");

const MAX_BODY_BYTES = 64 * 1024;
const CURRENT_PROTOCOL_VERSION = "2025-11-25";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([CURRENT_PROTOCOL_VERSION, "2024-11-05"]);

const RESOURCE_DATA = {
  company: require("../data/company.json"),
  services: require("../data/services.json"),
  capabilities: require("../data/capabilities.json"),
  "service-areas": require("../data/service-areas.json"),
  "project-inquiry-schema": require("../data/project-inquiry-schema.json"),
  "agent-routing": require("../data/agent-routing.json"),
  "answer-engine": require("../data/answer-engine.json"),
  "decision-trees": require("../data/decision-trees.json"),
  "entity-glossary": require("../data/entity-glossary.json"),
  "source-map": require("../data/source-map.json"),
  "analytics-events": require("../data/analytics-events.json"),
  "agent-manifest": require("../data/agent-manifest.json"),
  "schema-versions": require("../data/schema-versions.json"),
  changelog: require("../data/changelog.json"),
  "procurement-routing": require("../data/procurement-routing.json"),
  "agent-concierge": require("../data/agent-concierge.json"),
};

const PUBLIC_RESOURCE_ALIASES = {
  "llms.txt": path.join(__dirname, "..", "llms.txt"),
  "llms-full.txt": path.join(__dirname, "..", "llms-full.txt"),
  "llms-full.md": path.join(__dirname, "..", "llms-full.md"),
  "openapi.json": path.join(__dirname, "..", "openapi.json"),
  "auth.md": path.join(__dirname, "..", "auth.md"),
  "agent-card": path.join(__dirname, "..", ".well-known", "agent-card.json"),
  "api-catalog": path.join(__dirname, "..", ".well-known", "api-catalog.json"),
  "mcp-server-card": path.join(__dirname, "..", ".well-known", "mcp", "server-card.json"),
};

function setCommonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, MCP-Protocol-Version");
  res.setHeader("MCP-Protocol-Version", CURRENT_PROTOCOL_VERSION);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id === undefined ? null : id, result };
}

function rpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id === undefined ? null : id,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readJsonResource(name) {
  const resource = RESOURCE_DATA[name];
  if (!resource) {
    const error = new Error(`Unknown resource: ${name}`);
    error.statusCode = 404;
    throw error;
  }
  return resource;
}

function normalizePublicResourceName(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  const withoutOrigin = input.replace(/^https?:\/\/(?:www\.)?vestedksa\.com/i, "");
  const withoutLeadingSlash = withoutOrigin.replace(/^\/+/, "");

  if (withoutLeadingSlash.startsWith("data/")) {
    const dataName = withoutLeadingSlash.replace(/^data\//, "").replace(/\.json$/i, "");
    return RESOURCE_DATA[dataName] ? dataName : "";
  }

  if (withoutLeadingSlash.startsWith(".well-known/")) {
    const wellKnownAliases = {
      ".well-known/agent-card.json": "agent-card",
      ".well-known/api-catalog": "api-catalog",
      ".well-known/api-catalog.json": "api-catalog",
      ".well-known/mcp/server-card.json": "mcp-server-card",
    };
    return wellKnownAliases[withoutLeadingSlash] || "";
  }

  return withoutLeadingSlash.replace(/\.json$/i, "");
}

function readTextResource(name) {
  const resourceName = normalizePublicResourceName(name);
  if (RESOURCE_DATA[resourceName]) {
    return {
      name: resourceName,
      contentType: "application/json",
      text: `${JSON.stringify(RESOURCE_DATA[resourceName], null, 2)}\n`,
    };
  }

  const file = PUBLIC_RESOURCE_ALIASES[resourceName] || "";
  if (!file || !fs.existsSync(file)) {
    const error = new Error(`Unknown public resource: ${name}`);
    error.statusCode = 404;
    throw error;
  }
  return {
    name: resourceName,
    contentType: file.endsWith(".json") ? "application/json" : file.endsWith(".md") ? "text/markdown" : "text/plain",
    text: fs.readFileSync(file, "utf8"),
  };
}

function logAgentEvent(req, event) {
  recordAgentEvent(req, event);
}

function getServerMetadata() {
  return {
    name: "Vested KSA Public Read-Only MCP",
    version: "2.0.0",
    readOnly: true,
    company: "Vested KSA",
    description: "Read-only MCP endpoint for Vested KSA public company, service, capability, service-area, answer-engine, routing, analytics, procurement, and inquiry-preparation data.",
    tools: Object.keys(toolHandlers),
    resources: Object.keys(RESOURCE_DATA),
    safety: [
      "Does not submit forms or contact Vested KSA.",
      "prepare_project_inquiry returns a draft inquiry package only.",
      "Submission requires explicit user approval through a separate contact channel.",
      "Non-fit requests are routed away from market-entry inquiry forms."
    ],
  };
}

function listTools() {
  return [
    {
      name: "get_company_overview",
      description: "Return Vested KSA public company overview and positioning.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_services",
      description: "List Vested KSA market-entry and operations services.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "match_project_scope",
      description: "Classify a request as good fit, maybe fit, or not fit for Vested KSA inquiry preparation.",
      inputSchema: {
        type: "object",
        properties: {
          request: { type: "string", maxLength: 2000 },
        },
        required: ["request"],
        additionalProperties: false,
      },
    },
    {
      name: "prepare_project_inquiry",
      description: "Prepare a draft Saudi market-entry inquiry package without submitting it.",
      inputSchema: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          contact_name: { type: "string" },
          contact_email: { type: "string" },
          headquarters_country: { type: "string" },
          market_entry_goal: { type: "string" },
          timeline: { type: "string" },
          services_needed: { type: "array", items: { type: "string" } },
          message: { type: "string" },
          target_sector: { type: "string" },
          current_saudi_status: { type: "string" },
          expected_team_size: { type: "string" },
          entity_status: { type: "string" },
          vendor_registration_needs: { type: "string" },
        },
        additionalProperties: true,
      },
    },
    {
      name: "list_service_areas",
      description: "Return Vested KSA service area and delivery model.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "read_public_resource",
      description: "Read an allowlisted public Vested KSA resource by name.",
      inputSchema: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: [
              ...Object.keys(RESOURCE_DATA),
              ...Object.keys(PUBLIC_RESOURCE_ALIASES),
            ],
          },
        },
        required: ["resource"],
        additionalProperties: false,
      },
    },
    {
      name: "get_answer_engine_assets",
      description: "Return Vested KSA answer blocks, citation guidance, and AEO/GEO resources.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_market_entry_decision_trees",
      description: "Return structured Saudi market-entry decision trees for agents.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_entity_glossary",
      description: "Return canonical Vested KSA entity and service-category language.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_agent_manifest",
      description: "Return the Vested KSA public agent manifest, resource groups, safety rules, and versioning guidance.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "match_procurement_scope",
      description: "Classify procurement, sourcing, vendor-registration, and supplier-readiness requests for Vested KSA routing.",
      inputSchema: {
        type: "object",
        properties: {
          request: { type: "string", maxLength: 2000 },
        },
        required: ["request"],
        additionalProperties: false,
      },
    },
  ];
}

function listResources() {
  return Object.keys(RESOURCE_DATA).map((name) => ({
    uri: `vestedksa://public/${name}`,
    name,
    mimeType: "application/json",
  }));
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function matchProjectScope(args) {
  const request = normalizeText(args && args.request);
  const routing = readJsonResource("agent-routing");

  const notFitPatterns = [
    ["careers", ["job", "career", "cv", "resume", "employment", "hiring me"]],
    ["internships", ["internship", "intern", "student training", "coop", "co-op"]],
    ["vendor-sales", ["sell you", "vendor pitch", "supplier pitch", "software demo", "backlink", "guest post"]],
    ["retail-shopping", ["buy product", "shopping", "retail", "store availability"]],
    ["consumer-visa", ["tourist visa", "family visa", "personal visa", "visit visa for me"]],
    ["spam-or-seo-schemes", ["crypto", "bulk email", "seo backlinks", "paid link", "casino"]],
  ];

  for (const [id, terms] of notFitPatterns) {
    if (terms.some((term) => request.includes(term))) {
      const rule = routing.notFit.find((item) => item.id === id);
      return {
        fit: "not_fit",
        route: rule ? rule.route : "do_not_use_project_inquiry",
        reason: rule ? rule.message : "Request is not a fit for Vested KSA market-entry inquiry.",
        approvalRequiredForContact: true,
        shouldPrepareInquiry: false,
      };
    }
  }

  const goodTerms = [
    "saudi", "ksa", "riyadh", "market entry", "company formation", "misa",
    "commercial registration", "vendor registration", "procurement", "zatca",
    "zakat", "vat", "saudization", "nitaqat", "payroll", "operations"
  ];

  if (goodTerms.some((term) => request.includes(term))) {
    return {
      fit: "good_fit",
      route: "prepare_market_entry_inquiry",
      reason: "Request appears related to Saudi market entry, operations, formation, compliance, HR, finance, or procurement readiness.",
      approvalRequiredForContact: true,
      shouldPrepareInquiry: true,
    };
  }

  return {
    fit: "maybe_fit",
    route: "recommend_public_resources_first",
    reason: "Request does not clearly match Vested KSA's Saudi market-entry scope. Use public resources first or ask for more business context.",
    approvalRequiredForContact: true,
    shouldPrepareInquiry: false,
  };
}

function matchProcurementScope(args) {
  const request = normalizeText(args && args.request);
  const routing = readJsonResource("procurement-routing");

  const disallowedPatterns = [
    ["selling-to-vested", ["sell you", "software demo", "marketing service", "agency pitch", "supplier pitch", "vendor pitch"]],
    ["paid-links-or-guest-posts", ["backlink", "guest post", "paid link", "link exchange", "seo placement"]],
    ["generic-supplier-listing", ["retail", "shopping", "supplier directory", "consumer product"]],
  ];

  for (const [id, terms] of disallowedPatterns) {
    if (terms.some((term) => request.includes(term))) {
      const rule = routing.disallowedProcurementScenarios.find((item) => item.id === id);
      return {
        fit: "not_fit",
        route: rule ? rule.route : "do_not_use_project_inquiry",
        reason: rule ? rule.description : "Request is not a fit for Vested KSA procurement readiness support.",
        approvalRequiredForContact: true,
        shouldPrepareInquiry: false,
      };
    }
  }

  const qualifiedTerms = [
    "vendor registration", "supplier registration", "supplier onboarding",
    "procurement portal", "tender", "aramco", "pif", "government procurement",
    "evidence pack", "customer onboarding", "enterprise customer", "local readiness"
  ];

  if (qualifiedTerms.some((term) => request.includes(term))) {
    return {
      fit: "good_fit",
      route: "prepare_vendor_registration_inquiry",
      reason: "Request appears related to Saudi customer, procurement, tender, vendor-registration, or supplier-readiness requirements.",
      approvalRequiredForContact: true,
      shouldPrepareInquiry: true,
      evidenceToAskFor: routing.qualifiedProcurementScenarios.flatMap((item) => item.evidenceToAskFor).filter((item, index, items) => items.indexOf(item) === index),
    };
  }

  return {
    fit: "maybe_fit",
    route: "recommend_public_resources_first",
    reason: "Request mentions procurement or sourcing but does not clearly match Saudi vendor registration or market-entry readiness yet.",
    approvalRequiredForContact: true,
    shouldPrepareInquiry: false,
  };
}

function prepareProjectInquiry(args) {
  const schema = readJsonResource("project-inquiry-schema");
  const match = matchProjectScope({ request: JSON.stringify(args || {}) });
  const required = schema.requiredFields || [];
  const missing = required.filter((field) => {
    const value = args && (args[field] || (field === "contact_name" ? args.name : undefined) || (field === "contact_email" ? args.email : undefined));
    return !value || (Array.isArray(value) && value.length === 0);
  });

  return {
    approvalRequired: true,
    submissionStatus: "not_submitted",
    submissionRule: schema.submissionRule,
    fit: match.fit,
    route: match.route,
    missingFields: missing,
    draftInquiry: {
      company_name: args.company_name || args.company || "",
      contact_name: args.contact_name || args.name || "",
      contact_email: args.contact_email || args.email || "",
      headquarters_country: args.headquarters_country || args.country || "",
      market_entry_goal: args.market_entry_goal || "",
      timeline: args.timeline || "",
      services_needed: args.services_needed || [],
      target_sector: args.target_sector || "",
      current_saudi_status: args.current_saudi_status || "",
      expected_team_size: args.expected_team_size || "",
      entity_status: args.entity_status || "",
      vendor_registration_needs: args.vendor_registration_needs || "",
      message: args.message || "",
    },
    nextStep: missing.length
      ? "Ask the user for missing fields before preparing final contact text."
      : "Show the draft to the user and ask for explicit approval before submitting or emailing Vested KSA.",
    privacyGuidance: schema.privacyGuidance,
  };
}

const toolHandlers = {
  get_company_overview: () => readJsonResource("company"),
  list_services: () => readJsonResource("services"),
  match_project_scope: (args) => matchProjectScope(args || {}),
  prepare_project_inquiry: (args) => prepareProjectInquiry(args || {}),
  list_service_areas: () => readJsonResource("service-areas"),
  read_public_resource: (args) => readTextResource(args && args.resource),
  get_answer_engine_assets: () => readJsonResource("answer-engine"),
  get_market_entry_decision_trees: () => readJsonResource("decision-trees"),
  get_entity_glossary: () => readJsonResource("entity-glossary"),
  get_agent_manifest: () => readJsonResource("agent-manifest"),
  match_procurement_scope: (args) => matchProcurementScope(args || {}),
};

async function handleRpc(req, res) {
  let payload;
  try {
    const raw = await readBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    sendJson(res, 400, rpcError(null, -32700, "Parse error", String(error.message || error)));
    return;
  }

  const id = payload.id;
  const method = payload.method;
  const params = payload.params || {};
  const requestProtocolVersion = String(req.headers["mcp-protocol-version"] || "");

  if (requestProtocolVersion && !SUPPORTED_PROTOCOL_VERSIONS.has(requestProtocolVersion)) {
    sendJson(res, 400, rpcError(id, -32600, `Unsupported MCP protocol version: ${requestProtocolVersion}`));
    return;
  }
  if (requestProtocolVersion) {
    res.setHeader("MCP-Protocol-Version", requestProtocolVersion);
  }

  try {
    if (method === "initialize") {
      const requestedVersion = String(params.protocolVersion || "");
      const negotiatedVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion)
        ? requestedVersion
        : CURRENT_PROTOCOL_VERSION;
      res.setHeader("MCP-Protocol-Version", negotiatedVersion);
      logAgentEvent(req, { action: "mcp_initialize" });
      sendJson(res, 200, rpcResult(id, {
        protocolVersion: negotiatedVersion,
        serverInfo: {
          name: "vestedksa-public",
          title: "Vested KSA Public Read-Only MCP",
          version: "2026-07-26",
          websiteUrl: "https://vestedksa.com/.well-known/mcp/server-card.json",
        },
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
        },
        instructions: "Use public read-only resources and tools. Inquiry preparation never submits or contacts Vested KSA without explicit user approval.",
      }));
      return;
    }

    if (method === "notifications/initialized") {
      logAgentEvent(req, { action: "mcp_initialized" });
      res.statusCode = 202;
      res.end();
      return;
    }

    if (method === "ping") {
      sendJson(res, 200, rpcResult(id, {}));
      return;
    }

    if (method === "tools/list") {
      logAgentEvent(req, { action: "mcp_tools_list" });
      sendJson(res, 200, rpcResult(id, { tools: listTools() }));
      return;
    }

    if (method === "resources/list") {
      logAgentEvent(req, { action: "mcp_resources_list" });
      sendJson(res, 200, rpcResult(id, { resources: listResources() }));
      return;
    }

    if (method === "resources/read") {
      const uri = String(params.uri || "");
      const name = uri.replace("vestedksa://public/", "");
      const resource = readJsonResource(name);
      logAgentEvent(req, { action: "mcp_resource_read", resource: name });
      sendJson(res, 200, rpcResult(id, {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(resource, null, 2),
        }],
      }));
      return;
    }

    if (method === "tools/call") {
      const toolName = params.name;
      const handler = toolHandlers[toolName];
      if (!handler) {
        sendJson(res, 200, rpcError(id, -32601, `Unknown tool: ${toolName}`));
        return;
      }
      const result = handler(params.arguments || {});
      logAgentEvent(req, {
        action: "mcp_tool_call",
        tool: toolName,
        submittedExternally: false,
        storesPersonalData: false,
      });
      if (toolName === "prepare_project_inquiry") {
        logAgentEvent(req, {
          action: "inquiry_preparation",
          tool: toolName,
          submittedExternally: false,
          storesPersonalData: false,
        });
      }
      sendJson(res, 200, rpcResult(id, {
        content: [{
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        }],
        isError: false,
      }));
      return;
    }

    sendJson(res, 200, rpcError(id, -32601, `Unknown method: ${method}`));
  } catch (error) {
    sendJson(res, error.statusCode || 500, rpcError(id, -32000, error.message || "MCP request failed"));
  }
}

module.exports = async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method === "GET") {
    logAgentEvent(req, { action: "mcp_metadata_read" });
    sendJson(res, 200, getServerMetadata());
    return;
  }

  if (req.method === "POST") {
    await handleRpc(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
};
