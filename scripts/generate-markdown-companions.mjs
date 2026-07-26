import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import * as parse5 from "parse5";

const ROOT = process.cwd();
const BASE_URL = "https://vestedksa.com";
const OUT_DIR = path.join(ROOT, "markdown");
const CHECK_MODE = process.argv.includes("--check");
const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes";

const BLOCK_TAGS = new Set([
  "article", "aside", "blockquote", "br", "details", "div", "dl", "figure", "h1", "h2", "h3",
  "h4", "h5", "h6", "hr", "li", "main", "ol", "p", "section", "summary", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "ul"
]);
const DROP_TAGS = new Set(["nav", "header", "footer", "form", "script", "style", "noscript", "template", "svg", "iframe", "button", "input", "select", "textarea", "label"]);
const DROP_CLASSES = new Set([
  "breadcrumb",
  "breadcrumbs",
  "cookie-banner",
  "cookie-consent",
  "cookie-notice",
  "eyebrow",
  "form-honeypot",
  "hero-eyebrow",
  "mobile-menu",
  "nav-container",
  "nav-cta",
  "nav-links",
  "nav-wordmark",
  "skip-link",
  "sr-only",
  "entry-path-number",
  "step-number",
  "visually-hidden",
]);

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function attr(node, name) {
  if (!node) return "";
  return (node.attrs || []).find((item) => item.name === name)?.value || "";
}

function hasClass(node, className) {
  return attr(node, "class").split(/\s+/).includes(className);
}

function textContent(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value || "";
  return (node.childNodes || []).map(textContent).join("");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isStandaloneVisualCounter(value) {
  return /^[0-9]{1,2}$/.test(normalizeText(value));
}

function findAll(node, predicate, results = []) {
  if (predicate(node)) results.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, results);
  return results;
}

function findFirst(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.childNodes || []) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }
  return null;
}

function isHidden(node) {
  const style = attr(node, "style").toLowerCase();
  const id = attr(node, "id").toLowerCase();
  const classes = attr(node, "class").toLowerCase().split(/\s+/);
  return (
    attr(node, "hidden") !== "" ||
    attr(node, "aria-hidden").toLowerCase() === "true" ||
    style.includes("display:none") ||
    style.includes("visibility:hidden") ||
    id.includes("cookie") ||
    classes.some((className) => DROP_CLASSES.has(className))
  );
}

function shouldDrop(node) {
  return DROP_TAGS.has(node.tagName) || isHidden(node);
}

function escapeMarkdown(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_");
}

function absoluteUrl(href, canonical) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return href;
  try {
    return new URL(href, canonical).toString();
  } catch {
    return href;
  }
}

function renderInline(node, canonical) {
  if (!node) return "";
  if (node.nodeName === "#text") return escapeMarkdown(normalizeText(node.value));
  if (shouldDrop(node)) return "";

  const children = (node.childNodes || []).map((child) => renderInline(child, canonical)).filter(Boolean).join(" ");
  const text = normalizeText(children);

  if (node.tagName === "a") {
    const href = absoluteUrl(attr(node, "href"), canonical);
    return text && href ? `[${text}](${href})` : text;
  }
  if (node.tagName === "strong" || node.tagName === "b") return text ? `**${text}**` : "";
  if (node.tagName === "em" || node.tagName === "i") return text ? `_${text}_` : "";
  if (node.tagName === "code") return text ? `\`${text.replace(/`/g, "\\`")}\`` : "";
  if (node.tagName === "img") {
    const alt = normalizeText(attr(node, "alt"));
    const src = absoluteUrl(attr(node, "src"), canonical);
    return alt && src ? `![${escapeMarkdown(alt)}](${src})` : "";
  }
  return text;
}

function renderTable(node, canonical) {
  const rows = findAll(node, (item) => item.tagName === "tr").map((row) => {
    return (row.childNodes || [])
      .filter((cell) => cell.tagName === "th" || cell.tagName === "td")
      .map((cell) => normalizeText(renderInline(cell, canonical)).replace(/\|/g, "\\|"));
  }).filter((row) => row.length);

  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
  const header = normalizedRows[0];
  const separator = Array(width).fill("---");
  const body = normalizedRows.slice(1);
  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function renderInlineWithoutNestedLists(node, canonical) {
  if (!node || shouldDrop(node)) return "";
  return (node.childNodes || [])
    .filter((child) => child.tagName !== "ul" && child.tagName !== "ol")
    .map((child) => renderInline(child, canonical))
    .filter(Boolean)
    .join(" ");
}

function renderListItem(item, canonical, depth) {
  const text = normalizeText(renderInlineWithoutNestedLists(item, canonical));
  const nestedLists = (item.childNodes || [])
    .filter((child) => child.tagName === "ul" || child.tagName === "ol")
    .flatMap((child) => renderBlocks(child, canonical, depth + 1));
  return { text, nestedLists };
}

function renderBlocks(node, canonical, depth = 0) {
  if (!node || shouldDrop(node)) return [];
  if (node.nodeName === "#text") {
    const text = normalizeText(node.value);
    return text && !isStandaloneVisualCounter(text) ? [escapeMarkdown(text)] : [];
  }

  const tag = node.tagName;
  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(Number(tag.slice(1)) + 1, 6);
    const text = normalizeText(renderInline(node, canonical));
    return text && !isStandaloneVisualCounter(text) ? [`${"#".repeat(level)} ${text}`] : [];
  }
  if (tag === "p") {
    const text = normalizeText(renderInline(node, canonical));
    return text && !isStandaloneVisualCounter(text) ? [text] : [];
  }
  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    const items = (node.childNodes || []).filter((child) => child.tagName === "li");
    return items.flatMap((item, index) => {
      const { text, nestedLists } = renderListItem(item, canonical, depth);
      const prefix = ordered ? `${index + 1}. ` : "- ";
      return text ? [`${"  ".repeat(depth)}${prefix}${text}`, ...nestedLists] : nestedLists;
    }).filter(Boolean);
  }
  if (tag === "table") {
    const table = renderTable(node, canonical);
    return table ? [table] : [];
  }
  if (tag === "details") {
    const summary = findFirst(node, (item) => item.tagName === "summary");
    const summaryText = normalizeText(renderInline(summary, canonical));
    const children = (node.childNodes || []).filter((child) => child !== summary).flatMap((child) => renderBlocks(child, canonical, depth));
    return [summaryText ? `### ${summaryText}` : "", ...children].filter(Boolean);
  }
  if (tag === "img") {
    const image = renderInline(node, canonical);
    return image ? [image] : [];
  }
  if (tag === "a") {
    const link = normalizeText(renderInline(node, canonical));
    return link ? [link] : [];
  }

  const childBlocks = (node.childNodes || []).flatMap((child) => renderBlocks(child, canonical, depth));
  if (childBlocks.length) return childBlocks;

  if (BLOCK_TAGS.has(tag)) {
    const text = normalizeText(renderInline(node, canonical));
    return text && !isStandaloneVisualCounter(text) ? [text] : [];
  }
  return [];
}

function findAllVisible(node, predicate, results = []) {
  if (!node || shouldDrop(node)) return results;
  if (predicate(node)) results.push(node);
  for (const child of node.childNodes || []) findAllVisible(child, predicate, results);
  return results;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractAlternates(document) {
  return findAll(document, (node) => node.tagName === "link" && attr(node, "rel").toLowerCase() === "alternate")
    .map((node) => ({
      hreflang: attr(node, "hreflang"),
      href: attr(node, "href"),
    }))
    .filter((item) => item.hreflang && item.href);
}

function extractPublicLinks(main, canonical) {
  return uniqueBy(
    findAllVisible(main, (node) => node.tagName === "a")
      .map((node) => ({
        text: normalizeText(textContent(node)),
        href: absoluteUrl(attr(node, "href"), canonical),
      }))
      .filter((item) => item.text && item.href && !item.href.startsWith("#") && !item.href.startsWith("javascript:")),
    (item) => `${item.text}\n${item.href}`
  );
}

function extractPublicImages(main, canonical) {
  return uniqueBy(
    findAllVisible(main, (node) => node.tagName === "img")
      .map((node) => ({
        alt: normalizeText(attr(node, "alt")),
        src: absoluteUrl(attr(node, "src"), canonical),
      }))
      .filter((item) => item.alt && item.src),
    (item) => `${item.alt}\n${item.src}`
  );
}

function extractJsonLd(document) {
  return findAll(document, (node) => node.tagName === "script" && attr(node, "type").toLowerCase() === "application/ld+json")
    .map((node) => textContent(node).trim())
    .filter(Boolean)
    .map((raw) => {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function localFileForUrl(url) {
  const parsed = new URL(url);
  if (parsed.origin !== BASE_URL) return "";
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return "index.html";
  if (pathname === "/ar") return "ar/index.html";
  if (pathname === "/zh") return "zh/index.html";
  return `${pathname.slice(1)}.html`;
}

function sidecarForPath(pagePath) {
  if (pagePath === "/") return "/markdown/index.md";
  return `/markdown${pagePath}.md`;
}

function parseSitemap() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(read("sitemap.xml"));
  const urls = parsed.urlset?.url || [];
  return (Array.isArray(urls) ? urls : [urls]).map((item) => item.loc).filter(Boolean);
}

function buildMarkdownForPage(url) {
  const localFile = localFileForUrl(url);
  if (!localFile || !fs.existsSync(path.join(ROOT, localFile))) return null;

  const html = read(localFile);
  const document = parse5.parse(html, { sourceCodeLocationInfo: false });
  const htmlNode = findFirst(document, (node) => node.tagName === "html");
  const language = attr(htmlNode, "lang") || "en";
  const title = normalizeText(textContent(findFirst(document, (node) => node.tagName === "title")));
  const description = attr(findFirst(document, (node) => node.tagName === "meta" && attr(node, "name").toLowerCase() === "description"), "content");
  const canonical = attr(findFirst(document, (node) => node.tagName === "link" && attr(node, "rel").toLowerCase() === "canonical"), "href");
  const robots = attr(findFirst(document, (node) => node.tagName === "meta" && attr(node, "name").toLowerCase() === "robots"), "content").toLowerCase();

  if (!canonical || canonical.replace(/\/$/, "") !== url.replace(/\/$/, "") || robots.includes("noindex")) return null;

  const main = findFirst(document, (node) => node.tagName === "main") || findFirst(document, (node) => node.tagName === "body");
  const blocks = renderBlocks(main, canonical).filter(Boolean);
  const jsonLd = extractJsonLd(document);
  const alternates = extractAlternates(document);
  const publicLinks = extractPublicLinks(main, canonical);
  const publicImages = extractPublicImages(main, canonical);
  const pagePath = new URL(canonical).pathname.replace(/\/+$/, "") || "/";
  const sidecar = sidecarForPath(pagePath);

  const frontMatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `canonical: ${JSON.stringify(canonical)}`,
    `language: ${JSON.stringify(language)}`,
    `content_signal: ${JSON.stringify(CONTENT_SIGNAL)}`,
    `source_html: ${JSON.stringify(`/${localFile}`)}`,
    `markdown_sidecar: ${JSON.stringify(sidecar)}`,
    `alternate_languages: ${JSON.stringify(alternates)}`,
    "---",
    "",
  ].join("\n");

  const sections = [
    frontMatter,
    `# ${title}`,
    "",
    description ? `> ${description}` : "",
    "",
    "## Page Metadata",
    "",
    `- Canonical: ${canonical}`,
    `- Language: ${language}`,
    `- Source HTML: /${localFile}`,
    `- Markdown sidecar: ${sidecar}`,
    alternates.length ? `- Alternate languages: ${alternates.map((item) => `${item.hreflang} (${item.href})`).join(", ")}` : "",
    "",
    "## Main Content",
    "",
    ...blocks,
  ].filter((item) => item !== "");

  if (publicLinks.length || publicImages.length) {
    sections.push("", "## Public Page Resources", "");
    if (publicLinks.length) {
      sections.push("### Links", "");
      publicLinks.forEach((link) => sections.push(`- [${escapeMarkdown(link.text)}](${link.href})`));
    }
    if (publicImages.length) {
      sections.push("", "### Images", "");
      publicImages.forEach((image) => sections.push(`- ![${escapeMarkdown(image.alt)}](${image.src})`));
    }
  }

  if (jsonLd.length) {
    sections.push("", "## Public Structured Data", "");
    jsonLd.forEach((json, index) => {
      sections.push(`### JSON-LD ${index + 1}`, "", "```json", json, "```", "");
    });
  }

  return {
    entry: {
      path: pagePath,
      canonical,
      source: `/${localFile}`,
      sidecar,
      language,
      title,
      description,
      alternates,
      publicLinkCount: publicLinks.length,
      publicImageCount: publicImages.length,
    },
    markdown: `${sections.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`,
  };
}

function writeIfChanged(file, content) {
  const absolute = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  if (fs.existsSync(absolute) && fs.readFileSync(absolute, "utf8") === content) return false;
  fs.writeFileSync(absolute, content);
  return true;
}

function buildRuntimeAssets(entries) {
  const records = entries.map((entry) => {
    const segments = entry.sidecar.split("/").filter(Boolean).map((segment) => JSON.stringify(segment)).join(", ");
    return [
      `  ${JSON.stringify(entry.path)}: {`,
      `    sidecar: ${JSON.stringify(entry.sidecar)},`,
      `    language: ${JSON.stringify(entry.language)},`,
      `    canonical: ${JSON.stringify(entry.canonical)},`,
      `    content: fs.readFileSync(path.join(__dirname, "..", ${segments}), "utf8"),`,
      "  },",
    ].join("\n");
  });

  return [
    '"use strict";',
    "",
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    "",
    "module.exports = {",
    ...records,
    "};",
    "",
  ].join("\n");
}

function run() {
  const generated = parseSitemap().map(buildMarkdownForPage).filter(Boolean);
  const manifest = {
    schemaVersion: "2026-07-20",
    company: "Vested KSA",
    canonicalHost: BASE_URL,
    contentSignal: CONTENT_SIGNAL,
    generatedFrom: "/sitemap.xml",
    coverageScope: "canonical indexable HTML pages in sitemap.xml",
    entries: generated.map((item) => item.entry),
  };

  const outputs = new Map();
  generated.forEach((item) => outputs.set(item.entry.sidecar.slice(1), item.markdown));
  outputs.set("markdown/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  outputs.set("markdown-routes.ts", `export const MARKDOWN_ROUTES = ${JSON.stringify(manifest.entries.map(({ path, sidecar, language, canonical }) => ({ path, sidecar, language, canonical })), null, 2)} as const;\n`);
  outputs.set("lib/markdown-assets.cjs", buildRuntimeAssets(manifest.entries));

  if (CHECK_MODE) {
    const failures = [];
    for (const [file, content] of outputs) {
      const absolute = path.join(ROOT, file);
      if (!fs.existsSync(absolute)) {
        failures.push(`${file} missing`);
      } else if (fs.readFileSync(absolute, "utf8") !== content) {
        failures.push(`${file} is stale`);
      }
    }
    if (failures.length) {
      console.error(failures.join("\n"));
      process.exit(1);
    }
    console.log(`Markdown companions are deterministic and current (${generated.length} pages).`);
    return;
  }

  let changed = 0;
  for (const [file, content] of outputs) {
    if (writeIfChanged(file, content)) changed += 1;
  }
  console.log(`Generated ${generated.length} Markdown companions (${changed} files changed).`);
}

run();
