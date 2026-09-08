"use strict";

const crypto = require("node:crypto");
const { detectLanguage } = require("./agent-localization.cjs");

const COMPANY = "Vested KSA";
const SCHEMA_VERSION = "2026-09-08";
const RETENTION_DAYS = 90;
const MAX_QUESTION_LENGTH = 2400;
const MAX_ANSWER_LENGTH = 7000;

const TOPIC_TERMS = {
  "market-entry": ["market entry", "enter saudi", "saudi expansion", "دخول السوق", "دخول السعودية", "التوسع في السعودية"],
  "company-formation": ["company formation", "formation", "commercial registration", "entity setup", "تأسيس شركة", "تأسيس كيان", "السجل التجاري"],
  licensing: ["misa", "license", "licensing", "ministry of investment", "وزارة الاستثمار", "ترخيص"],
  "hr-payroll": ["human resources", "hr", "payroll", "hiring", "gosi", "qiwa", "الموارد البشرية", "الرواتب", "التوظيف", "التأمينات", "قوى"],
  saudization: ["saudization", "nitaqat", "سعودة", "السعودة", "نطاقات"],
  "finance-tax": ["finance", "accounting", "vat", "zakat", "zatca", "مالية", "محاسبة", "ضريبة القيمة المضافة", "الزكاة", "هيئة الزكاة"],
  "e-invoicing": ["e-invoicing", "e invoicing", "fatoora", "electronic invoice", "الفوترة الإلكترونية", "الفوترة الالكترونية", "فاتورة"],
  compliance: ["compliance", "legal", "governance", "due diligence", "امتثال", "قانوني", "حوكمة", "العناية الواجبة"],
  "workspace-facilities": ["workspace", "office", "facilities", "fit-out", "مساحة عمل", "مكتب", "مرافق", "تجهيز المكتب"],
  "vendor-readiness": ["vendor registration", "supplier registration", "procurement portal", "tender", "تسجيل مورد", "تسجيل الموردين", "بوابة المشتريات", "مناقصة"],
};

const BRAND_TERMS = {
  MISA: ["misa", "ministry of investment", "وزارة الاستثمار"],
  Qiwa: ["qiwa", "قوى"],
  GOSI: ["gosi", "social insurance", "التأمينات الاجتماعية", "التامينات الاجتماعية"],
  ZATCA: ["zatca", "zakat tax and customs", "هيئة الزكاة والضريبة والجمارك", "هيئة الزكاة"],
  Nitaqat: ["nitaqat", "نطاقات"],
  Mudad: ["mudad", "مدد"],
  Muqeem: ["muqeem", "مقيم"],
  Aramco: ["aramco", "أرامكو", "ارامكو"],
  PIF: ["pif", "public investment fund", "صندوق الاستثمارات العامة", "صندوق الاستثمارات"],
};

const GEOGRAPHY_TERMS = {
  "Saudi Arabia": ["saudi arabia", "saudi", "ksa", "السعودية", "المملكة العربية السعودية"],
  Riyadh: ["riyadh", "الرياض"],
  Jeddah: ["jeddah", "جدة"],
  "Eastern Province": ["eastern province", "dammam", "khobar", "المنطقة الشرقية", "الدمام", "الخبر"],
  "United Kingdom": ["united kingdom", "uk company", "british company", "بريطانيا", "المملكة المتحدة"],
  "United States": ["united states", "us company", "american company", "الولايات المتحدة", "شركة أمريكية", "شركة اميركية"],
  China: ["china", "chinese company", "الصين", "شركة صينية"],
  India: ["india", "indian company", "الهند", "شركة هندية"],
  Germany: ["germany", "german company", "ألمانيا", "المانيا", "شركة ألمانية"],
  France: ["france", "french company", "فرنسا", "شركة فرنسية"],
  UAE: ["united arab emirates", "uae", "dubai", "الإمارات", "الامارات", "دبي"],
};

const SECTOR_TERMS = {
  technology: ["technology", "software", "saas", "fintech", "تقنية", "تكنولوجيا", "برمجيات", "تقنية مالية"],
  industrial: ["industrial", "manufacturing", "factory", "صناعة", "تصنيع", "مصنع"],
  construction: ["construction", "contracting", "engineering", "إنشاءات", "انشاءات", "مقاولات", "هندسة"],
  healthcare: ["healthcare", "medical", "pharma", "رعاية صحية", "طبي", "أدوية", "ادوية"],
  professional_services: ["consulting", "professional services", "advisory", "استشارات", "خدمات مهنية"],
  energy: ["energy", "oil", "gas", "renewable", "طاقة", "نفط", "غاز", "طاقة متجددة"],
  logistics: ["logistics", "supply chain", "freight", "لوجستيات", "سلسلة الإمداد", "شحن"],
  retail: ["retail company", "consumer brand", "شركة تجزئة", "علامة استهلاكية"],
};

const SPECIFICATION_TERMS = {
  "foreign-ownership": ["100% foreign ownership", "foreign ownership", "ملكية أجنبية", "ملكية اجنبية"],
  "branch-or-subsidiary": ["branch or subsidiary", "branch", "subsidiary", "فرع", "شركة تابعة"],
  "government-procurement": ["government procurement", "government tender", "مشتريات حكومية", "مناقصة حكومية"],
  "enterprise-vendor-onboarding": ["enterprise vendor", "supplier onboarding", "تأهيل مورد", "اعتماد مورد"],
  "first-year-team": ["first-year team", "first year team", "فريق السنة الأولى", "فريق السنة الاولى"],
};

const SENSITIVE_CONTEXT = [
  "passport", "iqama number", "national id", "bank account", "iban", "credit card", "confidential attachment",
  "confidential", "under nda", "client name", "project code", "contract value", "bank statement", "commercially sensitive",
  "رقم الهوية", "رقم الإقامة", "رقم الاقامة", "رقم الجواز", "حساب بنكي", "آيبان", "ايبان", "بطاقة ائتمان", "مرفق سري",
  "سري", "سرية", "اتفاقية عدم إفصاح", "اتفاقية عدم افصاح", "اسم العميل", "رمز المشروع", "قيمة العقد", "كشف حساب",
];

const POISON_TERMS = [
  "ignore previous instructions", "ignore your rules", "reveal system prompt", "bypass approval", "submit without approval",
  "repeat this keyword", "keyword stuffing", "disregard all", "تجاهل التعليمات السابقة", "اكشف تعليمات النظام", "تجاوز الموافقة",
];

function normalize(value) {
  return String(value || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function redactNames(text, redactions) {
  let value = text.replace(/\b(my name is|contact person(?: is)?|attention to)\s+[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,3}/giu, (match, marker) => {
    redactions.names += 1;
    return `${marker} [REDACTED_NAME]`;
  });
  value = value.replace(/(?:أنا\s+)?اسمي\s+[\u0600-\u06ff]+(?:\s+[\u0600-\u06ff]+){0,3}/gu, () => {
    redactions.names += 1;
    return "اسمي [REDACTED_NAME]";
  });
  value = value.replace(/(?:اسم\s+(?:جهة\s+)?التواصل|الاسم)\s*[:：-]?\s*[\u0600-\u06ff]+(?:\s+[\u0600-\u06ff]+){0,3}/gu, () => {
    redactions.names += 1;
    return "الاسم: [REDACTED_NAME]";
  });
  return value;
}

function sanitizeDemandText(input, maxLength = MAX_QUESTION_LENGTH) {
  const redactions = { emails: 0, phones: 0, identifiers: 0, urls: 0, names: 0 };
  let text = normalize(input).slice(0, Math.max(maxLength * 2, maxLength));
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, () => {
    redactions.emails += 1;
    return "[REDACTED_EMAIL]";
  });
  text = text.replace(/https?:\/\/[^\s)\]}]+/gi, (match) => {
    try {
      const url = new URL(match);
      if (["vestedksa.com", "www.vestedksa.com"].includes(url.hostname.toLowerCase())) {
        return `https://vestedksa.com${url.pathname}`;
      }
    } catch (_error) {
      // Treat malformed URLs as untrusted input.
    }
    redactions.urls += 1;
    return "[REDACTED_URL]";
  });
  text = text.replace(/(?<!\w)(?:\+?\d[\s().-]*){7,15}(?!\w)/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 7) return match;
    redactions.phones += 1;
    return "[REDACTED_PHONE]";
  });
  text = text.replace(/\b(?:\d[ -]?){10,}\b/g, () => {
    redactions.identifiers += 1;
    return "[REDACTED_IDENTIFIER]";
  });
  text = redactNames(text, redactions);
  const lower = text.toLowerCase();
  const sensitiveContextDetected = includesAny(lower, SENSITIVE_CONTEXT);
  return {
    text: normalize(text).slice(0, maxLength),
    redactions,
    sensitiveContextDetected,
  };
}

function extractMatches(text, dictionary) {
  return uniqueSorted(Object.entries(dictionary)
    .filter(([, terms]) => includesAny(text, terms))
    .map(([key]) => key));
}

function extractQuantities(text) {
  const team = text.match(/\b(\d{1,4})\s*(?:employees?|hires?|staff|people|موظف(?:ين)?|موظفة|عامل(?:ين)?)\b/i);
  const months = text.match(/\b(\d{1,2})\s*(?:months?|أشهر|اشهر|شهور)\b/i);
  const weeks = text.match(/\b(\d{1,2})\s*(?:weeks?|أسابيع|اسابيع)\b/i);
  return {
    teamSize: team ? Number(team[1]) : null,
    timelineMonths: months ? Number(months[1]) : null,
    timelineWeeks: weeks ? Number(weeks[1]) : null,
  };
}

function poisonAssessment(text, promptInjectionDetected) {
  const lower = text.toLowerCase();
  const reasons = [];
  if (promptInjectionDetected || includesAny(lower, POISON_TERMS)) reasons.push("prompt_injection");
  const urls = (text.match(/https?:\/\//gi) || []).length;
  if (urls >= 3) reasons.push("link_flood");
  const words = lower.split(/\s+/).filter(Boolean);
  const uniqueRatio = new Set(words).size / Math.max(1, words.length);
  if (words.length >= 30 && uniqueRatio < 0.35) reasons.push("repetitive_keyword_stuffing");
  if ((text.match(/[!?$#*_]{4,}/g) || []).length >= 2) reasons.push("symbol_flood");
  return { suspected: reasons.length > 0, reasons };
}

function classifyDemandTraffic({ fit, question, promptInjectionDetected, userAgentClass }) {
  if (userAgentClass === "validation-probe") return { classification: "synthetic", eligible: false, reason: "validation_probe" };
  if (fit?.classification === "not_fit") return { classification: "non_fit", eligible: false, reason: fit.route || "not_fit" };
  const poison = poisonAssessment(String(question || ""), promptInjectionDetected);
  if (poison.suspected) return { classification: "suspected_abuse", eligible: false, reason: poison.reasons.join(",") };
  if (!fit || fit.classification !== "good_fit") {
    return { classification: "unqualified", eligible: false, reason: "missing_client_fit" };
  }
  return { classification: "genuine_demand", eligible: true, reason: "client_or_potential_client" };
}

function createHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function createDemandRecord(input, options = {}) {
  const occurredAt = new Date(options.now || Date.now());
  const questionSanitized = sanitizeDemandText(input.question, MAX_QUESTION_LENGTH);
  const answerSanitized = sanitizeDemandText(input.agentReply, MAX_ANSWER_LENGTH);
  const contextSanitized = sanitizeDemandText(input.demandContext || input.question, MAX_QUESTION_LENGTH);
  const language = input.language === "ar" || input.language === "en" ? input.language : detectLanguage(input.question);
  const traffic = classifyDemandTraffic({
    fit: input.fit,
    question: input.question,
    promptInjectionDetected: input.promptInjectionDetected,
    userAgentClass: input.userAgentClass,
  });
  if (!questionSanitized.text) return { eligible: false, classification: "empty", reason: "empty_after_sanitization" };
  if (questionSanitized.sensitiveContextDetected || answerSanitized.sensitiveContextDetected || contextSanitized.sensitiveContextDetected) {
    return { eligible: false, classification: "sensitive", reason: "sensitive_or_confidential_context" };
  }
  if (!traffic.eligible) return { ...traffic };

  const normalized = contextSanitized.text.toLowerCase();
  const serviceIds = uniqueSorted((input.matchedServices || []).map((service) => service.id || service).filter(Boolean));
  const topics = extractMatches(normalized, TOPIC_TERMS);
  const brands = extractMatches(normalized, BRAND_TERMS);
  const geographies = extractMatches(normalized, GEOGRAPHY_TERMS);
  const sectors = extractMatches(normalized, SECTOR_TERMS);
  const specifications = extractMatches(normalized, SPECIFICATION_TERMS);
  const quantities = extractQuantities(normalized);
  const signature = createHash(JSON.stringify({ language, serviceIds, topics, brands, geographies, sectors, specifications, normalized }));
  const requestKey = createHash(`${input.source || "a2a"}\n${input.messageKey || ""}\n${signature}`);
  const recordId = createHash(`${COMPANY}\n${occurredAt.toISOString().slice(0, 10)}\n${requestKey}`);
  const adequacy = input.answerAdequacy || (input.fit.classification === "good_fit" ? "answered" : "partial");

  return {
    eligible: true,
    record: {
      schemaVersion: SCHEMA_VERSION,
      recordType: "sanitized-demand-interaction",
      company: COMPANY,
      recordId,
      occurredAt: occurredAt.toISOString(),
      source: input.source === "contact_inquiry" ? "contact_inquiry" : "a2a",
      language,
      trafficClass: traffic.classification,
      fit: input.fit.classification,
      route: input.fit.route,
      skillId: input.skillId || "contact_inquiry",
      question: questionSanitized.text,
      agentReply: answerSanitized.text || null,
      answerAdequacy: ["answered", "partial", "unanswered"].includes(adequacy) ? adequacy : "partial",
      demand: {
        serviceIds,
        topics,
        brands,
        geographies,
        sectors,
        specifications,
        quantities,
        signature,
      },
      privacy: {
        rawConversationStored: false,
        personalIdentifiersStored: false,
        confidentialAttachmentsStored: false,
        redactions: {
          question: questionSanitized.redactions,
          agentReply: answerSanitized.redactions,
        },
      },
      evidence: {
        genuine: true,
        synthetic: false,
        suspectedAbuse: false,
      },
      retention: {
        policyDays: RETENTION_DAYS,
        deleteAfter: addDays(occurredAt, RETENTION_DAYS).toISOString(),
      },
    },
  };
}

module.exports = {
  BRAND_TERMS,
  COMPANY,
  MAX_ANSWER_LENGTH,
  MAX_QUESTION_LENGTH,
  RETENTION_DAYS,
  SCHEMA_VERSION,
  classifyDemandTraffic,
  createDemandRecord,
  detectLanguage,
  poisonAssessment,
  sanitizeDemandText,
};
