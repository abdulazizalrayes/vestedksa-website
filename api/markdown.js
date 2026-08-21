"use strict";

const MARKDOWN_ASSETS = require("../lib/markdown-assets.cjs");
const { recordAgentEvent } = require("../lib/server-agent-telemetry.cjs");
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

module.exports = function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const requestPath = String(req.query.path || "/");
  const entry = MARKDOWN_ASSETS[requestPath];
  const directRequest = String(req.query.direct || "") === "1";

  if (!entry) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Markdown companion unavailable" }));
    return;
  }

  recordAgentEvent(req, {
    action: "markdown_representation_read",
    resource: entry.path,
  });

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Vary", "Accept");
  res.setHeader("Content-Location", entry.direct);
  res.setHeader("Content-Language", entry.language);
  res.setHeader("Link", `<${entry.canonical}>; rel="canonical"`);
  res.setHeader("Content-Signal", CONTENT_SIGNAL);
  if (directRequest) {
    res.setHeader("X-Robots-Tag", "noindex, follow");
  }
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(entry.content);
};
