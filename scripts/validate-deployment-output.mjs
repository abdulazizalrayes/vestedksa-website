import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, ".vercel", "output");
const STATIC_ROOT = path.join(OUTPUT_ROOT, "static");
const DUPLICATE_SUFFIX = /(?:^|\/)[^/]+ \d+\.[^/]+$/;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relativeToOutput(file) {
  return path.relative(OUTPUT_ROOT, file).split(path.sep).join("/");
}

assert.ok(fs.existsSync(OUTPUT_ROOT), "Vercel output is missing; run `vercel build --prod` first");
assert.ok(fs.existsSync(STATIC_ROOT), "Vercel static output is missing");

const outputFiles = walk(OUTPUT_ROOT).map(relativeToOutput);
const duplicateFiles = outputFiles.filter((file) => DUPLICATE_SUFFIX.test(file));
assert.deepEqual(duplicateFiles, [], `deployment contains suffixed duplicate files:\n${duplicateFiles.join("\n")}`);

const forbiddenStaticFiles = outputFiles.filter((file) => (
  file.startsWith("static/scripts/") ||
  file.startsWith("static/test/") ||
  file.startsWith("static/previews/") ||
  file.startsWith("static/node_modules/") ||
  file === "static/README.md" ||
  file === "static/CLAUDE.md" ||
  /(?:^|\/)\.env(?:\.|$)/.test(file) ||
  /\.(?:key|pem)$/.test(file)
));
assert.deepEqual(forbiddenStaticFiles, [], `deployment exposes internal or secret files:\n${forbiddenStaticFiles.join("\n")}`);

const canonicalDataFiles = fs.readdirSync(path.join(ROOT, "data"))
  .filter((file) => file.endsWith(".json") && !/ \d+\.json$/i.test(file))
  .map((file) => `static/data/${file}`);
for (const file of canonicalDataFiles) {
  assert.ok(outputFiles.includes(file), `deployment is missing ${file}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "markdown", "manifest.json"), "utf8"));
for (const entry of manifest.entries) {
  const sidecar = `static/${entry.sidecar.replace(/^\/+/, "")}`;
  assert.ok(outputFiles.includes(sidecar), `deployment is missing ${sidecar}`);
}

assert.ok(outputFiles.includes("functions/api/mcp.func/api/mcp.js"), "deployment is missing the MCP function");
assert.ok(outputFiles.includes("functions/api/markdown.func/api/markdown.js"), "deployment is missing the Markdown function");

console.log(
  `Deployment output validation passed: ${outputFiles.length} files, ` +
  `${canonicalDataFiles.length} canonical data resources, ${manifest.entries.length} Markdown sidecars, 0 duplicate artifacts.`
);
