"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "markdown", "manifest.json");
const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes";

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function safeSidecarPath(sidecar) {
  const normalized = String(sidecar || "").replace(/^\/+/, "");
  const absolute = path.join(ROOT, normalized);
  if (!absolute.startsWith(path.join(ROOT, "markdown") + path.sep) || !absolute.endsWith(".md")) {
    return "";
  }
  return absolute;
}

module.exports = function handler(req, res) {
  const requestPath = String(req.query.path || "/");
  const manifest = readManifest();
  const entry = manifest.entries.find((item) => item.path === requestPath);

  if (!entry) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Markdown companion unavailable" }));
    return;
  }

  const file = safeSidecarPath(entry.sidecar);
  if (!file || !fs.existsSync(file)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Markdown companion file unavailable" }));
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
  res.end(fs.readFileSync(file, "utf8"));
};
