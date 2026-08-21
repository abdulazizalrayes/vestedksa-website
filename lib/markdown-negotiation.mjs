export function parseAcceptHeader(headerValue) {
  return String(headerValue || "")
    .split(",")
    .map((part) => {
      const [typePart, ...params] = part.trim().split(";").map((value) => value.trim());
      let q = 1;
      for (const param of params) {
        const [key, value] = param.split("=").map((item) => item && item.trim());
        if (key && key.toLowerCase() === "q") {
          const parsed = Number(value);
          q = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
        }
      }
      return { type: typePart.toLowerCase(), q };
    })
    .filter((item) => item.type);
}

function matchSpecificity(mediaRange, representation) {
  const [rangeType, rangeSubtype] = mediaRange.split("/");
  const [type, subtype] = representation.split("/");
  if (!rangeType || !rangeSubtype) return -1;
  if (rangeType === "*" && rangeSubtype === "*") return 0;
  if (rangeType === type && rangeSubtype === "*") return 1;
  if (rangeType === type && rangeSubtype === subtype) return 2;
  return -1;
}

function scoreRepresentation(items, representation) {
  let best = null;
  items.forEach((item, order) => {
    const specificity = matchSpecificity(item.type, representation);
    if (specificity < 0) return;
    if (
      !best ||
      specificity > best.specificity ||
      (specificity === best.specificity && item.q > best.q)
    ) {
      best = { q: item.q, specificity, order };
    }
  });
  return best;
}

export function selectRepresentation(headerValue) {
  const value = String(headerValue || "").trim();
  if (!value) return "html";

  const items = parseAcceptHeader(value);
  const html = scoreRepresentation(items, "text/html");
  const markdown = scoreRepresentation(items, "text/markdown");

  if (!html && !markdown) return "html";
  if ((!html || html.q <= 0) && (!markdown || markdown.q <= 0)) return "not-acceptable";
  if (!markdown || markdown.q <= 0) return "html";
  if (!html || html.q <= 0) return "markdown";
  if (markdown.q > html.q) return "markdown";
  if (html.q > markdown.q) return "html";
  if (markdown.specificity > html.specificity) return "markdown";
  return "html";
}

export function acceptsMarkdown(headerValue) {
  return selectRepresentation(headerValue) === "markdown";
}

export function normalizeRequestPath(pathname) {
  const value = String(pathname || "/").replace(/\/+$/, "") || "/";
  return value === "/index" ? "/" : value;
}

export function resolveMarkdownEntry(pathname, manifest) {
  const normalized = normalizeRequestPath(pathname);
  return manifest.entries.find((entry) => entry.path === normalized) || null;
}

export function resolveDirectMarkdownEntry(pathname, manifest) {
  const normalized = normalizeRequestPath(pathname);
  return manifest.entries.find((entry) => entry.direct === normalized) || null;
}

export function resolveSidecarEntry(pathname, manifest) {
  const normalized = normalizeRequestPath(pathname);
  return manifest.entries.find((entry) => entry.sidecar === normalized) || null;
}

export function markdownAlternateLink(entry) {
  return `<${new URL(entry.direct, entry.canonical).toString()}>; rel="alternate"; type="text/markdown"`;
}

const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";
const CSP_REPORT_ONLY = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com; frame-src https://www.googletagmanager.com; report-uri /api/csp-report; report-to csp-endpoint";

export function htmlRepresentationHeaders(entry, additionalLinks = []) {
  return {
    Link: [markdownAlternateLink(entry), ...additionalLinks].join(", "),
    Vary: "Accept",
    "Content-Signal": CONTENT_SIGNAL,
    "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY,
    "Reporting-Endpoints": 'csp-endpoint="https://vestedksa.com/api/csp-report"',
  };
}
