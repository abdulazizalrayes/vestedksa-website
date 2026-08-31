"use strict";

const crypto = require("node:crypto");

const servicesData = require("../data/services.json");
const routingData = require("../data/agent-routing.json");
const inquirySchema = require("../data/project-inquiry-schema.json");

const SKILLS = new Set([
  "assess_market_entry_fit",
  "explain_vested_services",
  "compare_entry_paths",
  "build_90_day_launch_brief",
  "identify_misa_hr_tax_requirements",
  "prepare_vendor_readiness_plan",
  "prepare_project_inquiry",
  "explain_non_fit_routing",
]);

const SOURCE_LIBRARY = {
  company: {
    title: "Vested KSA public company data",
    url: "https://vestedksa.com/data/company.json",
  },
  services: {
    title: "Vested KSA public service data",
    url: "https://vestedksa.com/data/services.json",
  },
  capabilities: {
    title: "Vested KSA public capabilities",
    url: "https://vestedksa.com/data/capabilities.json",
  },
  routing: {
    title: "Vested KSA agent routing rules",
    url: "https://vestedksa.com/data/agent-routing.json",
  },
  inquiry: {
    title: "Vested KSA project inquiry schema",
    url: "https://vestedksa.com/data/project-inquiry-schema.json",
  },
  decisionTrees: {
    title: "Saudi market-entry decision trees",
    url: "https://vestedksa.com/data/decision-trees.json",
  },
  marketEntryGuide: {
    title: "Saudi Market Entry Guide 2026",
    url: "https://vestedksa.com/insights/ksa-market-entry-guide-2026",
  },
  misa: {
    title: "MISA Licensing and Commercial Registration in Saudi Arabia",
    url: "https://vestedksa.com/insights/misa-licensing-commercial-registration-saudi-arabia",
  },
  vatZakat: {
    title: "VAT and Zakat in Saudi Arabia",
    url: "https://vestedksa.com/insights/vat-zakat-saudi-arabia",
  },
  nitaqat: {
    title: "Saudization and Nitaqat in Saudi Arabia",
    url: "https://vestedksa.com/insights/saudization-nitaqat-hr-saudi-arabia",
  },
  eInvoicing: {
    title: "Saudi E-Invoicing and Finance Controls",
    url: "https://vestedksa.com/insights/saudi-e-invoicing-operating-controls",
  },
  vendorGuide: {
    title: "Saudi Vendor Registration Readiness",
    url: "https://vestedksa.com/insights/saudi-vendor-registration-aramco-pif",
  },
  vendorPack: {
    title: "Saudi Vendor Registration Evidence Pack",
    url: "https://vestedksa.com/ksa-vendor-registration-pack.txt",
  },
  launchPlan: {
    title: "90-Day Saudi Launch Plan",
    url: "https://vestedksa.com/ksa-90-day-launch-plan.txt",
  },
};

const NON_FIT_PATTERNS = [
  ["careers", ["job", "career", "cv", "resume", "employment", "hire me", "work for vested"]],
  ["internships", ["internship", "intern role", "student training", "co-op placement", "coop placement"]],
  ["vendor-sales", ["sell you", "vendor pitch", "supplier pitch", "software demo", "agency services", "marketing services"]],
  ["spam-or-seo-schemes", ["backlink", "guest post", "paid link", "link exchange", "bulk email", "casino", "crypto scheme"]],
  ["retail-shopping", ["buy a product", "shopping", "retail availability", "online store"]],
  ["consumer-visa", ["tourist visa", "family visit visa", "personal visa", "visit visa for me"]],
  ["unrelated", ["restaurant booking", "hotel booking", "personal concierge", "local errands"]],
];

const SERVICE_TERMS = {
  "market-entry-planning": ["market entry", "entry path", "entry model", "launch plan", "saudi expansion"],
  "company-formation-setup": ["formation", "misa", "commercial registration", "saudi entity", "license", "licensing"],
  "managed-local-operations": ["local operations", "managed operations", "administration", "back office", "operating layer"],
  "hr-payroll-saudization": ["hr", "payroll", "hire", "hiring", "gosi", "qiwa", "saudization", "nitaqat"],
  "finance-vat-zakat-controls": ["finance", "accounting", "vat", "zakat", "zatca", "e-invoicing", "invoice"],
  "legal-compliance-coordination": ["legal", "compliance", "governance", "contract", "due diligence"],
  "workspace-facilities": ["office", "workspace", "facility", "facilities", "fit-out", "it setup"],
  "vendor-registration-procurement-readiness": ["vendor registration", "supplier registration", "procurement", "tender", "aramco", "pif", "evidence pack"],
};

function normalize(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(items) {
  return [...new Set(items)];
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function detectNonFit(text) {
  for (const [id, terms] of NON_FIT_PATTERNS) {
    if (!includesAny(text, terms)) continue;
    const rule = routingData.notFit.find((item) => item.id === id);
    return {
      id,
      route: rule?.route || "do_not_use_project_inquiry",
      reason: rule?.message || "This request is outside Vested KSA's market-entry inquiry scope.",
    };
  }
  return null;
}

function inferSkill(text, requestedSkill) {
  if (SKILLS.has(requestedSkill)) return requestedSkill;
  if (detectNonFit(text)) return "explain_non_fit_routing";
  if (includesAny(text, ["prepare inquiry", "inquiry draft", "contact vested", "proposal", "request a consultation"])) {
    return "prepare_project_inquiry";
  }
  if (includesAny(text, ["vendor registration", "supplier registration", "procurement portal", "tender", "aramco", "pif", "evidence pack"])) {
    return "prepare_vendor_readiness_plan";
  }
  if (includesAny(text, ["90 day", "90-day", "first three months", "launch brief", "launch plan"])) {
    return "build_90_day_launch_brief";
  }
  if (includesAny(text, ["misa", "commercial registration", "nitaqat", "saudization", "vat", "zakat", "zatca", "e-invoicing", "payroll requirements"])) {
    return "identify_misa_hr_tax_requirements";
  }
  if (includesAny(text, ["compare", "entry path", "entry model", "branch", "subsidiary", "entity or", "formation option"])) {
    return "compare_entry_paths";
  }
  if (includesAny(text, ["what does vested", "vested services", "which services", "how can vested", "company overview"])) {
    return "explain_vested_services";
  }
  return "assess_market_entry_fit";
}

function matchServices(text) {
  const matchedIds = Object.entries(SERVICE_TERMS)
    .filter(([, terms]) => includesAny(text, terms))
    .map(([id]) => id);

  const ids = matchedIds.length ? matchedIds : ["market-entry-planning"];
  return servicesData.services
    .filter((service) => ids.includes(service.id))
    .map((service) => ({ id: service.id, name: service.name, summary: service.summary, url: service.url }));
}

function assessFit(text) {
  const nonFit = detectNonFit(text);
  if (nonFit) {
    return {
      classification: "not_fit",
      confidence: "high",
      route: nonFit.route,
      reason: nonFit.reason,
      matchedSignals: [nonFit.id],
      shouldPrepareInquiry: false,
    };
  }

  const signals = [];
  for (const [serviceId, terms] of Object.entries(SERVICE_TERMS)) {
    if (includesAny(text, terms)) signals.push(serviceId);
  }
  if (includesAny(text, ["saudi", "ksa", "riyadh", "kingdom of saudi arabia"])) signals.push("saudi-market-context");
  if (includesAny(text, ["foreign company", "international company", "global company", "expand", "enter saudi"])) signals.push("international-expansion-context");
  if (includesAny(text, ["vested ksa", "vested services", "what does vested"])) signals.push("vested-information-request");

  const uniqueSignals = unique(signals);
  if (uniqueSignals.length) {
    return {
      classification: "good_fit",
      confidence: uniqueSignals.length >= 2 ? "high" : "medium",
      route: "prepare_market_entry_inquiry",
      reason: "The request matches Vested KSA's Saudi market-entry, operating-readiness, or procurement scope.",
      matchedSignals: uniqueSignals,
      shouldPrepareInquiry: true,
    };
  }

  return {
    classification: "maybe_fit",
    confidence: "medium",
    route: "recommend_public_resources_first",
    reason: "The request does not yet include enough Saudi market-entry context to confirm fit.",
    matchedSignals: [],
    shouldPrepareInquiry: false,
  };
}

function commonMissingInformation() {
  return [
    "Headquarters country and target Saudi business activity",
    "Sector and intended customers",
    "Current Saudi entity, licensing, hiring, and tax status",
    "Target launch date and key commercial deadline",
    "Expected first-year team size and vendor-registration needs",
  ];
}

function buildSkillContent(skillId, fit, matchedServices) {
  const commonRisks = [
    "Activity eligibility, ownership, licensing, tax, and workforce requirements must be verified against current official rules.",
    "Indicative sequences are not legal, tax, or regulatory advice and do not guarantee approval or timing.",
  ];

  if (skillId === "explain_non_fit_routing") {
    return {
      summary: fit.reason,
      recommendations: [
        "Do not use Vested KSA's project inquiry route for this request.",
        "Use the relevant careers, supplier-sales, consumer, or general support channel outside the market-entry flow.",
      ],
      assumptions: ["The request was classified only from the supplied public message text."],
      missingInformation: [],
      risks: ["Routing a non-fit request into the project inquiry flow creates noise and may delay legitimate market-entry inquiries."],
      nextSteps: ["End the Vested KSA project-inquiry path unless the user provides a genuine Saudi business market-entry requirement."],
      sourceKeys: ["routing"],
    };
  }

  if (skillId === "explain_vested_services") {
    return {
      summary: "Vested KSA is a Saudi market-entry and operations partner for international companies that need coordinated formation, people, finance, compliance, facilities, and procurement readiness.",
      recommendations: [
        "Start with market-entry planning when the structure, activity, dependencies, or first-90-day sequence is not yet settled.",
        "Use an integrated operating workstream when formation, HR, finance, and vendor readiness must move together under one accountable local rhythm.",
        "Match the engagement to the buyer's immediate blocker instead of assuming every company needs every service.",
      ],
      assumptions: ["The request is asking about Vested KSA's public service scope, not for a guaranteed regulatory outcome."],
      missingInformation: commonMissingInformation(),
      risks: commonRisks,
      nextSteps: ["Select the relevant service workstreams, then assess fit before preparing an inquiry draft."],
      sourceKeys: ["company", "services", "capabilities"],
    };
  }

  if (skillId === "compare_entry_paths") {
    return {
      summary: "The right Saudi entry path depends on activity eligibility, ownership, customer requirements, local hiring, tax exposure, procurement expectations, and the level of operating control required.",
      recommendations: [
        "Compare entry models against the intended activity and revenue model before selecting an entity sequence.",
        "Map formation, banking, workforce, tax, e-invoicing, and customer-vendor dependencies as one decision rather than separate checklists.",
        "Use a staged launch plan when commercial validation is still early, while verifying which local presence is required before transacting or hiring.",
      ],
      assumptions: ["No entity model has been selected and no activity eligibility has been independently verified."],
      missingInformation: commonMissingInformation(),
      risks: commonRisks,
      nextSteps: ["Build a decision table covering activity, ownership, customer, workforce, tax, timeline, and control requirements."],
      sourceKeys: ["marketEntryGuide", "decisionTrees", "misa"],
    };
  }

  if (skillId === "build_90_day_launch_brief") {
    return {
      summary: "A strong first 90 days aligns the entry decision, formation dependencies, finance controls, HR readiness, operating ownership, and customer or vendor-registration evidence.",
      recommendations: [
        "Days 1-30: confirm the activity, entry model, ownership, licensing dependencies, launch governance, and evidence gaps.",
        "Days 31-60: progress formation and registrations while designing payroll, finance, tax, document-control, and supplier workflows.",
        "Days 61-90: activate operating controls, reporting cadence, hiring readiness, facilities, and customer or procurement onboarding packs.",
      ],
      assumptions: ["The 90-day sequence is an operating brief and must be adapted to the company's verified regulatory path."],
      missingInformation: commonMissingInformation(),
      risks: commonRisks,
      nextSteps: ["Assign one owner, target date, dependency, evidence item, and escalation rule to every launch workstream."],
      sourceKeys: ["launchPlan", "capabilities", "marketEntryGuide"],
    };
  }

  if (skillId === "identify_misa_hr_tax_requirements") {
    return {
      summary: "Saudi launch readiness normally requires a connected view of foreign-investment and commercial registration, workforce platforms and Saudization, tax registration, VAT/Zakat, e-invoicing, and finance controls.",
      recommendations: [
        "Confirm the intended business activity and current MISA/Commercial Registration status first.",
        "Map Qiwa, GOSI, payroll, employment records, and Saudization/Nitaqat dependencies before hiring dates are committed.",
        "Define tax-calendar ownership, VAT/Zakat readiness, e-invoicing controls, approval workflows, and evidence retention before invoicing.",
      ],
      assumptions: ["The agent has not independently verified the company's legal activity, tax status, or workforce classification."],
      missingInformation: commonMissingInformation(),
      risks: commonRisks,
      nextSteps: ["Create a dependency register and verify each regulated requirement with current Saudi official sources or qualified advisers."],
      sourceKeys: ["misa", "nitaqat", "vatZakat", "eInvoicing"],
    };
  }

  if (skillId === "prepare_vendor_readiness_plan") {
    return {
      summary: "Saudi vendor readiness is an evidence and ownership discipline: the company needs current registrations, finance and tax records, banking and compliance evidence, capability language, portal ownership, and customer-specific documentation.",
      recommendations: [
        "Identify the target customer, procurement portal, category, tender deadline, and mandatory evidence before assembling the pack.",
        "Create one controlled evidence index with owners, issue dates, expiry dates, and update triggers.",
        "Align the capability profile and local operating facts with the exact buyer requirement; do not imply registrations or approvals that are not complete.",
      ],
      assumptions: ["No buyer-specific portal or evidence checklist has yet been validated."],
      missingInformation: [
        "Target customer, procurement portal, and category",
        "Tender or onboarding deadline",
        "Current Saudi entity and registration status",
        "Available finance, tax, banking, compliance, and capability evidence",
        "Named owner for portal and document updates",
      ],
      risks: [
        "Incomplete, expired, or inconsistent evidence can delay supplier onboarding.",
        "Customer-specific requirements can differ; generic evidence packs should not be treated as guaranteed acceptance.",
      ],
      nextSteps: ["Build a buyer-specific gap matrix, evidence index, and update calendar before preparing an inquiry."],
      sourceKeys: ["vendorGuide", "vendorPack", "services"],
    };
  }

  if (skillId === "prepare_project_inquiry") {
    const requiredFields = inquirySchema.requiredFields || [];
    return {
      summary: fit.classification === "not_fit"
        ? fit.reason
        : "The Concierge can prepare a structured Vested KSA market-entry inquiry outline, but it cannot submit or contact Vested KSA.",
      recommendations: fit.classification === "not_fit"
        ? ["Do not prepare or submit a Vested KSA project inquiry for this request."]
        : [
            "Confirm the business context and service workstreams before drafting final contact text.",
            "Keep the first inquiry concise and exclude passports, IDs, bank records, confidential contracts, and tender-sensitive documents.",
            "Show the completed draft and destination to the user, then obtain explicit approval before any separate contact action.",
          ],
      assumptions: ["No form, email, WhatsApp message, meeting, or CRM action has been performed."],
      missingInformation: fit.classification === "not_fit" ? [] : requiredFields.map((field) => field.replaceAll("_", " ")),
      risks: fit.classification === "not_fit" ? ["Non-fit traffic must remain outside the project inquiry flow."] : commonRisks,
      nextSteps: fit.classification === "not_fit"
        ? ["End the inquiry path."]
        : ["Collect the missing business fields and prepare a draft for explicit human approval."],
      sourceKeys: ["inquiry", "routing"],
    };
  }

  return {
    summary: fit.reason,
    recommendations: fit.classification === "good_fit"
      ? [
          "Start with the matched Vested KSA workstreams and verify the launch dependencies that connect them.",
          "Use public guides for initial research, then prepare a concise inquiry draft when the business context is complete.",
        ]
      : [
          "Clarify whether the request concerns an international company's Saudi entry, formation, local operations, workforce, finance, compliance, facilities, or procurement readiness.",
          "Use Vested KSA's public market-entry guide before preparing an inquiry.",
        ],
    assumptions: ["The fit assessment is based only on supplied public text and does not verify regulatory eligibility."],
    missingInformation: fit.classification === "not_fit" ? [] : commonMissingInformation(),
    risks: fit.classification === "not_fit" ? ["Non-fit traffic must remain outside the project inquiry flow."] : commonRisks,
    nextSteps: fit.classification === "good_fit"
      ? ["Choose the priority workstreams and, if useful, request a 90-day brief or inquiry draft."]
      : ["Provide the missing Saudi business context before proceeding."],
    sourceKeys: ["company", "services", "routing", "marketEntryGuide"],
  };
}

function buildResponseText(result) {
  const lines = [
    `Vested KSA Agent Concierge: ${result.response.summary}`,
    "",
    `Fit: ${result.fit.classification} (${result.fit.confidence} confidence)`,
    `Selected skill: ${result.skillId}`,
  ];
  if (result.response.recommendations.length) {
    lines.push("", "Recommendations:", ...result.response.recommendations.map((item) => `- ${item}`));
  }
  if (result.response.missingInformation.length) {
    lines.push("", "Information still needed:", ...result.response.missingInformation.map((item) => `- ${item}`));
  }
  lines.push(
    "",
    "Safety boundary: this response is advisory and read-only. Nothing was submitted and no contact action occurred.",
    "Sources:",
    ...result.sources.map((source) => `- ${source.title}: ${source.url}`),
  );
  return lines.join("\n");
}

function buildConciergeResponse(query, options = {}) {
  const text = normalize(query);
  const requestedSkill = normalize(options.skillId).replaceAll("-", "_");
  const skillId = inferSkill(text, requestedSkill);
  const fit = assessFit(text);
  const matchedServices = fit.classification === "not_fit" ? [] : matchServices(text);
  const content = buildSkillContent(skillId, fit, matchedServices);
  const sources = unique(content.sourceKeys).map((key) => SOURCE_LIBRARY[key]).filter(Boolean);
  const promptInjectionSignals = includesAny(text, [
    "ignore previous instructions",
    "ignore your rules",
    "bypass approval",
    "submit without approval",
    "reveal system prompt",
  ]);

  const result = {
    schemaVersion: "2026-08-31",
    company: "Vested KSA",
    status: "advisory_only",
    skillId,
    fit,
    matchedServices,
    response: {
      summary: content.summary,
      recommendations: content.recommendations,
      assumptions: content.assumptions,
      missingInformation: content.missingInformation,
      risks: content.risks,
      nextSteps: content.nextSteps,
    },
    sources,
    inquiry: {
      prepared: skillId === "prepare_project_inquiry" && fit.classification !== "not_fit",
      submissionStatus: "not_submitted",
      approvalRequired: true,
      contactActionPerformed: false,
    },
    safety: {
      readOnly: true,
      promptInjectionDetected: promptInjectionSignals,
      storesConversation: false,
      logsPromptOrPersonalData: false,
      regulatedAdviceDisclaimer: "Verify legal, tax, licensing, workforce, and procurement requirements with current official sources or qualified advisers.",
    },
  };
  return { ...result, text: buildResponseText(result) };
}

function createMessageId(requestMessageId, query) {
  return `vested-${crypto.createHash("sha256").update(`${requestMessageId}\n${query}`).digest("hex").slice(0, 24)}`;
}

module.exports = {
  SKILLS,
  assessFit,
  buildConciergeResponse,
  createMessageId,
  inferSkill,
};
