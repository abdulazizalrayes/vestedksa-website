#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import * as parse5 from "parse5";

const ROOT = process.cwd();
const BASE_URL = "https://vestedksa.com";
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "markdown/manifest.json"), "utf8"));
const company = JSON.parse(fs.readFileSync(path.join(ROOT, "data/company.json"), "utf8"));

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function htmlFileForPath(route) {
  if (route === "/") return "index.html";
  if (route === "/ar") return "ar/index.html";
  if (route === "/zh") return "zh/index.html";
  return `${route.replace(/^\//, "")}.html`;
}

function attr(node, name) {
  return (node.attrs || []).find((item) => item.name === name)?.value || "";
}

function textContent(node) {
  if (node.nodeName === "#text") return node.value || "";
  return (node.childNodes || []).map(textContent).join("");
}

function walk(node, callback) {
  callback(node);
  (node.childNodes || []).forEach((child) => walk(child, callback));
}

function walkJson(value, callback) {
  if (!value || typeof value !== "object") return;
  callback(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, callback));
    return;
  }
  Object.values(value).forEach((item) => walkJson(item, callback));
}

const sitemap = new XMLParser({ ignoreAttributes: false }).parse(read("sitemap.xml"));
const sitemapEntries = Array.isArray(sitemap.urlset.url) ? sitemap.urlset.url : [sitemap.urlset.url];
const sitemapUrls = sitemapEntries.map((entry) => entry.loc).sort();
const canonicalUrls = manifest.entries.map((entry) => entry.canonical).sort();
assert.deepEqual(sitemapUrls, canonicalUrls, "sitemap must exactly match the canonical Markdown/HTML manifest");
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "sitemap contains duplicate URLs");
assert.ok(sitemapEntries.every((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry.lastmod))), "every sitemap page needs a valid lastmod date");

const entityFacts = [];
for (const entry of manifest.entries) {
  const file = htmlFileForPath(entry.path);
  const html = read(file);
  const document = parse5.parse(html);
  const canonicals = [];
  const analyticsLoaders = [];
  const jsonLd = [];

  walk(document, (node) => {
    if (node.tagName === "link" && attr(node, "rel") === "canonical") canonicals.push(attr(node, "href"));
    if (node.tagName !== "script") return;
    const src = attr(node, "src");
    if (src === "/analytics-loader.js") analyticsLoaders.push(src);
    if (src.includes("googletagmanager.com")) assert.fail(`${file} directly loads Google analytics outside the consent gate`);
    const scriptText = textContent(node);
    if (scriptText.includes("googletagmanager.com/gtag") || scriptText.includes("googletagmanager.com/gtm")) {
      assert.fail(`${file} contains an inline analytics consent bypass`);
    }
    if (attr(node, "type") === "application/ld+json") {
      assert.doesNotThrow(() => JSON.parse(scriptText), `${file} contains invalid JSON-LD`);
      jsonLd.push(JSON.parse(scriptText));
    }
  });

  assert.deepEqual(canonicals, [entry.canonical], `${file} must have one exact canonical URL`);
  assert.deepEqual(analyticsLoaders, ["/analytics-loader.js"], `${file} must have one consent-aware analytics loader`);
  assert.ok(!html.includes("https://twitter.com/vestedksa"), `${file} contains the retired X profile`);
  assert.ok(!html.includes("https://misa.gov.sa/faq/"), `${file} contains the retired MISA FAQ URL`);

  jsonLd.forEach((block) => {
    walkJson(block, (node) => {
      if (node["@id"] !== `${BASE_URL}/#organization` || Object.keys(node).length === 1) return;
      assert.ok([node["@type"]].flat().includes("Organization"), `${file} organization node must include Organization type`);
      entityFacts.push({ file, node });
    });
  });
}

assert.ok(entityFacts.length >= 4, "authoritative organization node is missing from key pages");
const expectedEntity = {
  name: company.name,
  legalName: company.legalName,
  alternateName: company.alternateNames,
  description: company.description,
  url: company.url,
  image: `${BASE_URL}/og-image.png`,
  logo: `${BASE_URL}/favicon.svg`,
  email: company.contact.email,
  address: {
    "@type": "PostalAddress",
    addressLocality: company.operatingBase.city,
    addressCountry: company.operatingBase.countryCode,
  },
  areaServed: { "@type": "Country", name: "Saudi Arabia" },
  knowsLanguage: company.availableLanguages,
  sameAs: company.sameAs,
};
for (const { file, node } of entityFacts) {
  for (const [key, expected] of Object.entries(expectedEntity)) {
    assert.deepEqual(node[key], expected, `${file} organization ${key} conflicts with data/company.json`);
  }
}

const robots = read("robots.txt");
assert.ok(!/^Content-Signal:/m.test(robots), "robots.txt must not use the unsupported Content-Signal directive");
for (const bot of ["GPTBot", "Google-Extended", "ClaudeBot", "CCBot", "Bytespider"]) {
  assert.match(robots, new RegExp(`User-agent: ${bot}\\nDisallow: /(?:\\n|$)`), `${bot} must be blocked under ai-train=no`);
}
for (const bot of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot"]) {
  assert.match(robots, new RegExp(`User-agent: ${bot}\\nAllow: /`), `${bot} must remain available for search or user-directed retrieval`);
}

const vercel = JSON.parse(read("vercel.json"));
const globalHeaders = vercel.headers.find((entry) => entry.source === "/:path*")?.headers || [];
const globalHeaderMap = Object.fromEntries(globalHeaders.map((header) => [header.key.toLowerCase(), header.value]));
assert.equal(globalHeaderMap["content-signal"], "search=yes, ai-input=yes, ai-train=no");
assert.match(globalHeaderMap["content-security-policy-report-only"] || "", /report-uri \/api\/csp-report/);
assert.equal(globalHeaderMap["reporting-endpoints"], 'csp-endpoint="https://vestedksa.com/api/csp-report"');
assert.ok(fs.existsSync(path.join(ROOT, "api/csp-report.js")), "CSP reporting endpoint is missing");
const aiCatalogHeaders = vercel.headers.find((entry) => entry.source === "/.well-known/ai-catalog.json")?.headers || [];
const aiCatalogHeaderMap = Object.fromEntries(aiCatalogHeaders.map((header) => [header.key.toLowerCase(), header.value]));
assert.equal(aiCatalogHeaderMap["content-type"], "application/json; charset=utf-8");
assert.equal(aiCatalogHeaderMap["access-control-allow-origin"], "*");

const middleware = read("middleware.ts");
for (const route of ["/llms.txt", "/openapi.json", "/data/:path*", "/.well-known/:path*"]) {
  assert.ok(middleware.includes(`'${route}'`), `middleware telemetry coverage is missing ${route}`);
}
for (const event of ["crawler_visit", "markdown_representation_read", "llms_read", "openapi_read", "agent_resource_read"]) {
  assert.ok(middleware.includes(`'${event}'`), `middleware telemetry event is missing ${event}`);
}
const telemetry = read("lib/server-agent-telemetry.cjs");
assert.ok(telemetry.includes("GA4_API_SECRET"), "server-side agent telemetry delivery is missing");
assert.ok(!telemetry.includes('headers["x-forwarded-for"]'), "agent telemetry must not record IP addresses");
assert.ok(!telemetry.includes("req.socket"), "agent telemetry must not inspect client sockets");

const heroBytes = fs.statSync(path.join(ROOT, "assets/hero-market-entry-2026.jpg")).size;
assert.ok(heroBytes <= 170 * 1024, `hero image exceeds 170 KiB budget: ${heroBytes} bytes`);

console.log(
  `Site integrity validation passed: ${sitemapUrls.length} canonical pages, ` +
  `${entityFacts.length} consistent organization nodes, consent gate on every page, ` +
  `crawler policy aligned, hero ${heroBytes} bytes.`
);
