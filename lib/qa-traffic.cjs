"use strict";

function isQaCampaign(value) {
  return /^(?:vested_(?:delivery|attribution)_\d{8}|VES-E2E-\d{8})$/i.test(String(value || ""));
}

function isQaRequest(fields = {}) {
  if (fields.qaTest === true) return true;
  if (/\bsynthetic owner-approved test\b|\bVES-QA-\d{8}-/i.test(String(fields.message || ""))) return true;
  try {
    const url = new URL(fields.pageUrl || fields.page_url);
    if (url.protocol !== "https:" || !["vestedksa.com", "www.vestedksa.com"].includes(url.hostname)) return false;
    return url.searchParams.getAll("utm_source").some(value => value.toLowerCase() === "owner_qa") ||
      url.searchParams.getAll("utm_campaign").some(isQaCampaign);
  } catch (_error) { return false; }
}

module.exports = { isQaCampaign, isQaRequest };
