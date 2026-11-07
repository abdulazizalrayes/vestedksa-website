import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import robotsParser from "robots-parser";
import { XMLParser } from "fast-xml-parser";

const origin = "https://vestedksa.com";
const policy = robotsParser(origin + "/robots.txt", fs.readFileSync(new URL("../robots.txt", import.meta.url), "utf8"));
const retrieval = ["Googlebot","bingbot","Applebot","OAI-SearchBot","ChatGPT-User","Claude-SearchBot","Claude-User","PerplexityBot","Perplexity-User","Kimi-SearchBot","Kimi-User","meta-webindexer","meta-externalfetcher","facebookexternalhit"];
const training = ["GPTBot","Google-Extended","ClaudeBot","anthropic-ai","CCBot","Bytespider","KimiBot","meta-externalagent","Applebot-Extended"];
const privatePaths = ["/admin", "/private", "/internal", "/.vercel", "/api/contact", "/api/demand-review"];
const sitemap = fs.readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8");
const canonicalUrls = new XMLParser().parse(sitemap).urlset.url.map(entry => entry.loc);

test("documented retrieval bots and unknown user-directed clients can crawl every canonical page", () => {
  assert.equal(canonicalUrls.length, 20);
  for (const bot of [...retrieval, "UnknownUserDirectedClient"]) {
    for (const url of [...canonicalUrls, origin + "/llms.txt", origin + "/openapi.json", origin + "/services.md", origin + "/mcp"]) {
      assert.equal(policy.isAllowed(url, bot), true, bot + " " + url);
    }
  }
});

test("specific retrieval groups do not bypass private-path exclusions", () => {
  for (const bot of [...retrieval, "UnknownUserDirectedClient"]) {
    for (const path of privatePaths) {
      for (const suffix of ["", "/nested", "?test=1"]) {
        assert.equal(policy.isAllowed(origin + path + suffix, bot), false, bot + " " + path + suffix);
      }
    }
  }
});

test("training controls remain disallowed even when a shorter bot token is allowed", () => {
  for (const bot of training) {
    for (const url of canonicalUrls) {
      assert.equal(policy.isAllowed(url, bot), false, bot + " " + url);
    }
  }
  assert.equal(policy.isAllowed(origin + "/", "Meta-WebIndexer"), true);
  assert.equal(policy.isAllowed(origin + "/", "Meta-ExternalAgent"), false);
  assert.equal(policy.isAllowed(origin + "/", "Applebot-Extended"), false);
});
