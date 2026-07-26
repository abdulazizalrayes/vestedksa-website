"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  "/": {
    sidecar: "/markdown/index.md",
    language: "en",
    canonical: "https://vestedksa.com/",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "index.md"), "utf8"),
  },
  "/ar": {
    sidecar: "/markdown/ar.md",
    language: "ar",
    canonical: "https://vestedksa.com/ar",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "ar.md"), "utf8"),
  },
  "/zh": {
    sidecar: "/markdown/zh.md",
    language: "zh-Hans",
    canonical: "https://vestedksa.com/zh",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "zh.md"), "utf8"),
  },
  "/about": {
    sidecar: "/markdown/about.md",
    language: "en",
    canonical: "https://vestedksa.com/about",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "about.md"), "utf8"),
  },
  "/services": {
    sidecar: "/markdown/services.md",
    language: "en",
    canonical: "https://vestedksa.com/services",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "services.md"), "utf8"),
  },
  "/why-saudi": {
    sidecar: "/markdown/why-saudi.md",
    language: "en",
    canonical: "https://vestedksa.com/why-saudi",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "why-saudi.md"), "utf8"),
  },
  "/ethics": {
    sidecar: "/markdown/ethics.md",
    language: "en",
    canonical: "https://vestedksa.com/ethics",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "ethics.md"), "utf8"),
  },
  "/insights": {
    sidecar: "/markdown/insights.md",
    language: "en",
    canonical: "https://vestedksa.com/insights",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights.md"), "utf8"),
  },
  "/insights/ksa-market-entry-guide-2026": {
    sidecar: "/markdown/insights/ksa-market-entry-guide-2026.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/ksa-market-entry-guide-2026",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "ksa-market-entry-guide-2026.md"), "utf8"),
  },
  "/insights/foreign-ownership-saudi-arabia": {
    sidecar: "/markdown/insights/foreign-ownership-saudi-arabia.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/foreign-ownership-saudi-arabia",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "foreign-ownership-saudi-arabia.md"), "utf8"),
  },
  "/insights/misa-licensing-commercial-registration-saudi-arabia": {
    sidecar: "/markdown/insights/misa-licensing-commercial-registration-saudi-arabia.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/misa-licensing-commercial-registration-saudi-arabia",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "misa-licensing-commercial-registration-saudi-arabia.md"), "utf8"),
  },
  "/insights/vat-zakat-saudi-arabia": {
    sidecar: "/markdown/insights/vat-zakat-saudi-arabia.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/vat-zakat-saudi-arabia",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "vat-zakat-saudi-arabia.md"), "utf8"),
  },
  "/insights/saudi-e-invoicing-operating-controls": {
    sidecar: "/markdown/insights/saudi-e-invoicing-operating-controls.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/saudi-e-invoicing-operating-controls",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "saudi-e-invoicing-operating-controls.md"), "utf8"),
  },
  "/insights/regional-headquarters-rhq-saudi-arabia": {
    sidecar: "/markdown/insights/regional-headquarters-rhq-saudi-arabia.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/regional-headquarters-rhq-saudi-arabia",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "regional-headquarters-rhq-saudi-arabia.md"), "utf8"),
  },
  "/insights/saudi-vendor-registration-aramco-pif": {
    sidecar: "/markdown/insights/saudi-vendor-registration-aramco-pif.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/saudi-vendor-registration-aramco-pif",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "saudi-vendor-registration-aramco-pif.md"), "utf8"),
  },
  "/insights/saudization-nitaqat-hr-saudi-arabia": {
    sidecar: "/markdown/insights/saudization-nitaqat-hr-saudi-arabia.md",
    language: "en",
    canonical: "https://vestedksa.com/insights/saudization-nitaqat-hr-saudi-arabia",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "insights", "saudization-nitaqat-hr-saudi-arabia.md"), "utf8"),
  },
  "/faq": {
    sidecar: "/markdown/faq.md",
    language: "en",
    canonical: "https://vestedksa.com/faq",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "faq.md"), "utf8"),
  },
  "/contact": {
    sidecar: "/markdown/contact.md",
    language: "en",
    canonical: "https://vestedksa.com/contact",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "contact.md"), "utf8"),
  },
  "/privacy": {
    sidecar: "/markdown/privacy.md",
    language: "en",
    canonical: "https://vestedksa.com/privacy",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "privacy.md"), "utf8"),
  },
  "/terms": {
    sidecar: "/markdown/terms.md",
    language: "en",
    canonical: "https://vestedksa.com/terms",
    content: fs.readFileSync(path.join(__dirname, "..", "markdown", "terms.md"), "utf8"),
  },
};
