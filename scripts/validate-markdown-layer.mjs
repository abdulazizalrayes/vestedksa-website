import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  parseAcceptHeader,
  resolveDirectMarkdownEntry,
  resolveMarkdownEntry,
  resolveSidecarEntry,
  selectRepresentation,
} from "../lib/markdown-negotiation.mjs";

const ROOT = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "markdown", "manifest.json"), "utf8"));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function localHtmlForPath(pathname) {
  if (pathname === "/") return "index.html";
  if (pathname === "/ar") return "ar/index.html";
  if (pathname === "/zh") return "zh/index.html";
  return `${pathname.slice(1)}.html`;
}

function validateJsonFiles() {
  for (const file of [
    "markdown/manifest.json",
    "openapi.json",
    ".well-known/agent-card.json",
    ".well-known/api-catalog.json",
    ".well-known/mcp.json",
    ".well-known/mcp/server-card.json",
    ".well-known/mcp/server-cards.json",
    ".well-known/agent-skills/index.json",
    ...fs.readdirSync(path.join(ROOT, "data")).filter((file) => file.endsWith(".json") && !/ \d+\.json$/i.test(file)).map((file) => `data/${file}`),
  ]) {
    JSON.parse(read(file));
  }
}

function validateAcceptParsing() {
  assert.deepEqual(parseAcceptHeader("text/html, text/markdown;q=0.8")[1], { type: "text/markdown", q: 0.8 });
  const cases = [
    ["text/markdown", "markdown"],
    ["text/html", "html"],
    ["text/html;q=1, text/markdown;q=0.2", "html"],
    ["text/html;q=0.2, text/markdown;q=1", "markdown"],
    ["text/html, text/markdown", "html"],
    ["text/markdown;q=0, text/html", "html"],
    ["text/markdown;q=0", "not-acceptable"],
    ["text/*", "html"],
    ["*/*", "html"],
    ["text/*;q=1, text/html;q=1", "html"],
    ["text/*;q=1, text/markdown;q=1", "markdown"],
    ["text/*;q=1, text/html;q=0.5", "markdown"],
    ["*/*;q=1, text/html;q=0.5", "markdown"],
    ["text/markdown;q=0, text/*;q=1", "html"],
    ["text/html;q=0, text/markdown;q=0", "not-acceptable"],
    ["", "html"],
  ];
  for (const [header, expected] of cases) {
    assert.equal(selectRepresentation(header), expected, header || "(missing)");
  }
}

function validateCoverageAndSidecars() {
  assert.ok(manifest.entries.length > 0, "manifest must contain pages");
  for (const entry of manifest.entries) {
    const htmlFile = localHtmlForPath(entry.path);
    assert.ok(fs.existsSync(path.join(ROOT, htmlFile)), `${entry.path} source HTML missing`);
    assert.ok(fs.existsSync(path.join(ROOT, entry.sidecar)), `${entry.path} sidecar missing`);
    const markdown = read(entry.sidecar.slice(1));
    assert.match(markdown, new RegExp(`canonical: ${JSON.stringify(entry.canonical).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(markdown, new RegExp(`language: ${JSON.stringify(entry.language).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(markdown, /^source_html: /m, `${entry.sidecar} missing source_html front matter`);
    assert.match(markdown, /^markdown_sidecar: /m, `${entry.sidecar} missing markdown_sidecar front matter`);
    assert.match(markdown, /^direct_markdown: /m, `${entry.sidecar} missing direct_markdown front matter`);
    assert.match(markdown, /^alternate_languages: /m, `${entry.sidecar} missing alternate_languages front matter`);
    assert.ok(markdown.includes("## Page Metadata"), `${entry.sidecar} missing Page Metadata section`);
    assert.ok(markdown.includes("## Main Content"), `${entry.sidecar} missing Main Content section`);
    assert.ok(!markdown.includes("<nav"), `${entry.sidecar} leaks nav markup`);
    assert.ok(!markdown.includes("<header"), `${entry.sidecar} leaks header markup`);
    assert.ok(!markdown.includes("<footer"), `${entry.sidecar} leaks footer markup`);
    assert.ok(!markdown.includes("<form"), `${entry.sidecar} leaks forms`);
    assert.ok(!/^Market entry guide$/m.test(markdown), `${entry.sidecar} leaks decorative eyebrow text`);
    assert.ok(!/^[0-9]{1,2}$/m.test(markdown), `${entry.sidecar} leaks standalone visual counters`);
    assert.ok(markdown.includes("## Public Structured Data"), `${entry.sidecar} missing JSON-LD section`);
    assert.ok(entry.direct.endsWith(".md"), `${entry.path} direct Markdown URL must end in .md`);
    assert.ok(!entry.direct.startsWith("/markdown/"), `${entry.path} direct Markdown URL must be clean`);
  }
}

function validateHeadersConfig() {
  const vercel = JSON.parse(read("vercel.json"));
  const markdownHeader = vercel.headers.find((item) => item.source === "/markdown/(.*)\\.md");
  assert.ok(markdownHeader, "direct markdown sidecar headers missing");
  const headers = Object.fromEntries(markdownHeader.headers.map((item) => [item.key.toLowerCase(), item.value]));
  assert.equal(headers["x-robots-tag"], "noindex, follow");
  assert.equal(headers["content-type"], "text/markdown; charset=utf-8");
  assert.equal(headers["content-signal"], manifest.contentSignal);
  assert.ok(!JSON.stringify(vercel.rewrites || []).includes("llms-full.md"), "old root markdown rewrite must be removed");
}

function validateMiddlewareRouting() {
  const root = resolveMarkdownEntry("/", manifest);
  const services = resolveMarkdownEntry("/services", manifest);
  const servicesDirect = resolveDirectMarkdownEntry("/services.md", manifest);
  const servicesSidecar = resolveSidecarEntry("/markdown/services.md", manifest);
  const unavailable = resolveMarkdownEntry("/data/company.json", manifest);
  assert.ok(root?.sidecar === "/markdown/index.md");
  assert.ok(root?.direct === "/index.md");
  assert.ok(services?.sidecar === "/markdown/services.md");
  assert.ok(servicesDirect?.path === "/services");
  assert.ok(servicesSidecar?.path === "/services");
  assert.equal(unavailable, null);
}

function validateHtmlUnchanged() {
  if (!fs.existsSync("/tmp/vested-before-tree.sha256")) return;
  const before = new Map(
    fs.readFileSync("/tmp/vested-before-tree.sha256", "utf8").trim().split("\n").map((line) => {
      const [hash, file] = line.trim().split(/\s+/, 2);
      return [file.replace(/^\.\//, ""), hash];
    })
  );
  const current = spawnSync("shasum", ["-a", "256", ...manifest.entries.map((entry) => localHtmlForPath(entry.path))], {
    cwd: ROOT,
    encoding: "utf8",
  }).stdout;
  for (const line of current.trim().split("\n")) {
    const [hash, file] = line.trim().split(/\s+/, 2);
    assert.equal(before.get(file), hash, `${file} HTML hash changed`);
  }
}

run("npm", ["run", "check:markdown"]);
run("npm", ["test"]);
validateJsonFiles();
validateAcceptParsing();
validateCoverageAndSidecars();
validateHeadersConfig();
validateMiddlewareRouting();
validateHtmlUnchanged();

console.log(`Markdown layer validation passed for ${manifest.entries.length} canonical HTML sitemap pages.`);
