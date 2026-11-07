import { parse } from "parse5";

export const retrievalBots = ["Googlebot", "bingbot", "Applebot", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Kimi-SearchBot", "Kimi-User", "meta-webindexer", "meta-externalfetcher", "facebookexternalhit"];
export const trainingBots = ["GPTBot", "Google-Extended", "ClaudeBot", "anthropic-ai", "CCBot", "Bytespider", "KimiBot", "meta-externalagent", "Applebot-Extended"];
export const privatePaths = ["/admin", "/private", "/internal", "/.vercel", "/api/contact", "/api/demand-review"];

// Training-only restrictions must not be mistaken for search restrictions.
const searchScopes = new Set(["robots", ...retrievalBots.map(bot => bot.toLowerCase())]);
function restrictions(value) {
  return String(value).toLowerCase().split(",").map(item => item.trim())
    .filter(item => /^(noindex|nosnippet|none)$/.test(item) || /^max-snippet\s*:\s*0$/.test(item));
}

export function citationBarriers(html, xRobotsTag = "") {
  const problems = [];
  let scope = "robots";
  for (const part of String(xRobotsTag).split(",")) {
    const scoped = part.trim().match(/^([a-z][a-z0-9_-]*):\s*(.*)$/i);
    let directive = part;
    if (scoped && !["max-snippet", "max-image-preview", "max-video-preview", "unavailable_after"].includes(scoped[1].toLowerCase())) {
      scope = scoped[1].toLowerCase();
      directive = scoped[2];
    }
    if (searchScopes.has(scope)) {
      problems.push(...restrictions(directive).map(rule => `X-Robots-Tag ${scope}: ${rule}`));
    }
  }
  function visit(node) {
    if (node.tagName === "meta") {
      const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
      const name = String(attrs.name || "").toLowerCase();
      if (searchScopes.has(name)) problems.push(...restrictions(attrs.content).map(rule => `meta ${name}: ${rule}`));
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(html));
  return problems;
}
