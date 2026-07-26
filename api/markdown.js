"use strict";

const MARKDOWN_ASSETS = require("../lib/markdown-assets.cjs");
const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes";

module.exports = function handler(req, res) {
  const requestPath = String(req.query.path || "/");
  const entry = MARKDOWN_ASSETS[requestPath];

  if (!entry) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Markdown companion unavailable" }));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Vary", "Accept");
  res.setHeader("Content-Location", entry.sidecar);
  res.setHeader("Content-Language", entry.language);
  res.setHeader("Link", `<${entry.canonical}>; rel="canonical"`);
  res.setHeader("Content-Signal", CONTENT_SIGNAL);
  res.end(entry.content);
};
