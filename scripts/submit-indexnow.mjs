#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const ROOT = process.cwd();
const HOST = "vestedksa.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const dryRun = process.argv.includes("--dry-run");
const keyFile = fs.readdirSync(ROOT).find((file) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(file));

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!keyFile) fail("IndexNow key file missing from repository root.");

const key = fs.readFileSync(path.join(ROOT, keyFile), "utf8").trim();

if (keyFile !== `${key}.txt`) {
  fail(`IndexNow key file must be named ${key}.txt, found ${keyFile}.`);
}

if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  fail("IndexNow key must be 8-128 characters and contain only letters, numbers, or dashes.");
}

const sitemapXml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const sitemap = new XMLParser({ ignoreAttributes: false }).parse(sitemapXml);
const urls = []
  .concat(sitemap?.urlset?.url || [])
  .map((entry) => entry.loc)
  .filter((url) => typeof url === "string" && url.startsWith(`https://${HOST}/`));

if (!urls.length) fail("No IndexNow-eligible URLs found in sitemap.xml.");
if (urls.length > 10000) fail("IndexNow supports up to 10,000 URLs per request.");

const body = {
  host: HOST,
  key,
  keyLocation: `https://${HOST}/${keyFile}`,
  urlList: urls,
};

if (dryRun) {
  console.log(JSON.stringify({ endpoint: ENDPOINT, ...body }, null, 2));
  process.exit(0);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

if (![200, 202].includes(response.status)) {
  const text = await response.text();
  fail(`IndexNow submission failed with HTTP ${response.status}: ${text}`);
}

console.log(`IndexNow accepted ${urls.length} URL(s) for ${HOST} with HTTP ${response.status}.`);
