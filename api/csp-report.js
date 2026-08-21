"use strict";

const MAX_REPORT_BYTES = 16 * 1024;

function safePath(value) {
  try {
    const url = new URL(String(value || ""), "https://vestedksa.com");
    return url.origin === "https://vestedksa.com" ? url.pathname : url.origin;
  } catch (_error) {
    return "invalid";
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_REPORT_BYTES) {
        const error = new Error("CSP report too large");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Access-Control-Allow-Origin", "https://vestedksa.com");
  res.setHeader("Allow", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }

  try {
    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    const report = payload["csp-report"] || payload.body || payload;
    console.log(JSON.stringify({
      type: "csp_violation",
      timestamp: new Date().toISOString(),
      documentPath: safePath(report["document-uri"] || report.documentURL),
      blockedResource: safePath(report["blocked-uri"] || report.blockedURL),
      effectiveDirective: String(report["effective-directive"] || report.effectiveDirective || "unknown").slice(0, 80),
      disposition: String(report.disposition || "report").slice(0, 20),
    }));
    res.statusCode = 204;
    res.end();
  } catch (error) {
    res.statusCode = error.statusCode || 400;
    res.end();
  }
};
