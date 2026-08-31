"use strict";

const { waitUntil } = require("@vercel/functions");

const GA4_ID = "G-7STG2HDV42";
const ALLOWED_OUTCOMES = new Set(["good_fit", "maybe_fit", "not_fit"]);
const ALLOWED_ROUTES = new Set([
  "prepare_market_entry_inquiry",
  "recommend_public_resources_first",
  "do_not_use_project_inquiry",
  "block_or_ignore",
]);

function classifyUserAgent(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("vested-validation")) return "validation-probe";
  if (ua.includes("oai-searchbot")) return "openai-search";
  if (ua.includes("chatgpt-user")) return "openai-user";
  if (ua.includes("gptbot")) return "openai-training";
  if (ua.includes("claude-searchbot")) return "anthropic-search";
  if (ua.includes("claude-user")) return "anthropic-user";
  if (ua.includes("claudebot") || ua.includes("anthropic-ai")) return "anthropic-training";
  if (ua.includes("perplexity")) return "perplexity";
  if (ua.includes("googlebot")) return "googlebot";
  if (ua.includes("bingbot")) return "bingbot";
  if (ua.includes("ccbot")) return "common-crawl";
  if (ua.includes("bytespider")) return "bytespider";
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) return "other-crawler";
  return "browser-or-unknown";
}

function allowedDimension(value, allowedValues) {
  const token = safeToken(value, "");
  return allowedValues.has(token) ? token : undefined;
}

function safeToken(value, fallback = "unknown") {
  const token = String(value || "").toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").slice(0, 80);
  return token || fallback;
}

function safePath(value) {
  try {
    return new URL(String(value || "/"), "https://vestedksa.com").pathname.slice(0, 160);
  } catch (_error) {
    return "/";
  }
}

function sendToGa4(record) {
  const secret = process.env.GA4_API_SECRET;
  if (!secret) return Promise.resolve();
  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_ID}&api_secret=${encodeURIComponent(secret)}`;
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: `agent.${record.userAgentClass}`,
      non_personalized_ads: true,
      events: [{
        name: record.event.action,
        params: {
          engagement_time_msec: 1,
          agent_class: record.userAgentClass,
          resource_path: record.path,
          tool_name: record.event.tool || "none",
          resource_name: record.event.resource || "none",
          fit_outcome: record.event.outcome || "none",
          route_name: record.event.route || "none",
        },
      }],
    }),
    signal: AbortSignal.timeout(1500),
  }).then((response) => {
    if (!response.ok) throw new Error(`GA4 telemetry returned ${response.status}`);
  });
}

function recordAgentEvent(req, event) {
  const record = {
    type: "agent_readiness_event",
    timestamp: new Date().toISOString(),
    path: safePath(req.url),
    method: String(req.method || "GET").toUpperCase(),
    userAgentClass: classifyUserAgent(req.headers && req.headers["user-agent"]),
    event: {
      action: safeToken(event.action, "agent_resource_read"),
      tool: event.tool ? safeToken(event.tool) : undefined,
      resource: event.resource ? safeToken(event.resource) : undefined,
      outcome: allowedDimension(event.outcome, ALLOWED_OUTCOMES),
      route: allowedDimension(event.route, ALLOWED_ROUTES),
      submittedExternally: false,
      storesPersonalData: false,
    },
  };
  console.log(JSON.stringify(record));
  waitUntil(sendToGa4(record).catch((error) => {
    console.warn(JSON.stringify({
      type: "agent_telemetry_delivery_error",
      timestamp: new Date().toISOString(),
      action: record.event.action,
      reason: String(error.message || error).slice(0, 120),
    }));
  }));
}

module.exports = {
  allowedDimension,
  classifyUserAgent,
  recordAgentEvent,
  safePath,
};
