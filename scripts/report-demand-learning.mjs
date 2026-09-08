import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { renderDemandReport, summarizeDemand } = require("../lib/demand-reporting.cjs");

export function parseRecords(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  if (text.startsWith("[")) return JSON.parse(text);
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const file = fileIndex >= 0 ? args[fileIndex + 1] : "";
  const weekly = args.includes("--weekly");
  const json = args.includes("--json");
  const input = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
  const records = parseRecords(input);
  const summary = summarizeDemand(records, { reportKind: weekly ? "weekly" : "daily" });
  process.stdout.write(json ? `${JSON.stringify(summary, null, 2)}\n` : renderDemandReport(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
