"use strict";

const MAX_ANALYSIS_RECORDS = 500;
const MIN_CLUSTER_RECORDS = 20;
const MIN_CLUSTER_SIZE = 3;
const SIMILARITY_THRESHOLD = 0.38;
const MAX_DUPLICATE_INFLUENCE_PER_DAY = 3;

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "company", "could", "for", "from", "have", "help", "how", "into", "need", "our", "please", "saudi", "that", "the", "their", "this", "to", "want", "what", "when", "which", "with", "would", "ksa",
  "أريد", "اريد", "إلى", "الى", "التي", "الذي", "السعودية", "الشركة", "شركة", "على", "عن", "في", "كيف", "ما", "ماذا", "من", "نحن", "هل", "هذا", "هذه", "يمكن", "لدينا", "لنا",
]);

function increment(target, key, amount = 1) {
  if (!key) return;
  target[key] = (target[key] || 0) + amount;
}

function orderedCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function tokenise(value) {
  return String(value || "").toLowerCase().match(/[a-z\u0600-\u06ff][a-z0-9\u0600-\u06ff-]{2,}/g)
    ?.filter((token) => !STOP_WORDS.has(token)) || [];
}

function cosine(left, right) {
  let dot = 0;
  for (const [term, value] of left) dot += value * (right.get(term) || 0);
  return dot;
}

function buildVectors(records) {
  const tokenSets = records.map((record) => tokenise(record.question));
  const documentFrequency = new Map();
  for (const tokens of tokenSets) {
    for (const token of new Set(tokens)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
  return tokenSets.map((tokens) => {
    const counts = new Map();
    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
    const vector = new Map();
    let magnitude = 0;
    for (const [token, count] of counts) {
      const tf = 1 + Math.log(count);
      const idf = Math.log((records.length + 1) / ((documentFrequency.get(token) || 0) + 1)) + 1;
      const value = tf * idf;
      vector.set(token, value);
      magnitude += value * value;
    }
    magnitude = Math.sqrt(magnitude) || 1;
    return new Map([...vector].map(([token, value]) => [token, value / magnitude]));
  });
}

function clusterDemand(records) {
  if (records.length < MIN_CLUSTER_RECORDS) {
    return {
      method: "tf-idf cosine connected-components",
      status: "insufficient_data",
      minimumRecords: MIN_CLUSTER_RECORDS,
      recordsAvailable: records.length,
      clusters: [],
      modelTrained: false,
    };
  }
  const vectors = buildVectors(records);
  const parent = records.map((_, index) => index);
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  for (let left = 0; left < records.length; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      if (cosine(vectors[left], vectors[right]) >= SIMILARITY_THRESHOLD) union(left, right);
    }
  }
  const groups = new Map();
  records.forEach((record, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(record);
  });
  const clusters = [...groups.values()].filter((group) => {
    const days = new Set(group.map((record) => record.occurredAt.slice(0, 10)));
    return group.length >= MIN_CLUSTER_SIZE && days.size >= 2;
  }).map((group, index) => {
    const terms = {};
    for (const record of group) for (const token of new Set(tokenise(record.question))) increment(terms, token);
    return {
      id: `cluster-${index + 1}`,
      labelTerms: Object.keys(orderedCounts(terms)).slice(0, 5),
      count: group.length,
      distinctDays: new Set(group.map((record) => record.occurredAt.slice(0, 10))).size,
      languages: orderedCounts(group.reduce((counts, record) => (increment(counts, record.language), counts), {})),
      exampleRecordIds: group.slice(0, 3).map((record) => record.recordId),
    };
  }).sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
  return {
    method: "tf-idf cosine connected-components",
    status: clusters.length ? "clusters_found" : "no_stable_clusters",
    minimumRecords: MIN_CLUSTER_RECORDS,
    recordsAvailable: records.length,
    similarityThreshold: SIMILARITY_THRESHOLD,
    clusters,
    modelTrained: false,
  };
}

function capDuplicateInfluence(records) {
  const counts = new Map();
  const accepted = [];
  let capped = 0;
  for (const record of records) {
    const day = record.occurredAt.slice(0, 10);
    const key = `${day}:${record.demand?.signature || record.recordId}`;
    const count = counts.get(key) || 0;
    if (count >= MAX_DUPLICATE_INFLUENCE_PER_DAY) {
      capped += 1;
      continue;
    }
    counts.set(key, count + 1);
    accepted.push(record);
  }
  return { records: accepted, capped };
}

function uncertaintyFor(count, total, distinctDays) {
  if (total < 10 || count < 3 || distinctDays < 2) return "high";
  if (total < 30 || count < 6 || distinctDays < 3) return "medium";
  return "lower";
}

function distinctDaysFor(records, predicate) {
  return new Set(records.filter(predicate).map((record) => record.occurredAt.slice(0, 10))).size;
}

function buildRecommendations(summary, records) {
  const recommendations = [];
  const add = (type, subject, count, distinctDays, action) => {
    if (count < 2) return;
    recommendations.push({
      type,
      subject,
      action,
      supportingCount: count,
      supportingDistinctDays: distinctDays,
      analysisPeriod: summary.period,
      uncertainty: uncertaintyFor(count, summary.evidence.includedGenuineRecords, distinctDays),
      evidence: {
        source: "genuine_sanitized_activity",
        genuineCount: count,
        syntheticCount: 0,
      },
      automaticChangeAllowed: false,
    });
  };
  const topService = Object.entries(summary.frequencies.services)[0];
  if (topService) add("service-demand", topService[0], topService[1], distinctDaysFor(records, (record) => record.demand?.serviceIds?.includes(topService[0])), "Review whether the matching service and public explanation answer the recurring buying question clearly.");
  const topTopic = Object.entries(summary.frequencies.topics)[0];
  if (topTopic) add("answer-demand", topTopic[0], topTopic[1], distinctDaysFor(records, (record) => record.demand?.topics?.includes(topTopic[0])), "Review the related FAQ, guide, and agent response for a more direct, evidence-backed answer.");
  const topGeo = Object.entries(summary.frequencies.geographies)[0];
  if (topGeo) add("geographic-demand", topGeo[0], topGeo[1], distinctDaysFor(records, (record) => record.demand?.geographies?.includes(topGeo[0])), "Assess whether this geography needs a tailored sales or market-entry answer; do not publish a new page without owner approval.");
  const topBrand = Object.entries(summary.frequencies.brands)[0];
  if (topBrand) add("platform-or-buyer-demand", topBrand[0], topBrand[1], distinctDaysFor(records, (record) => record.demand?.brands?.includes(topBrand[0])), "Check whether the public guidance explains this platform or buyer dependency accurately and commercially.");
  if (summary.answerQuality.partial + summary.answerQuality.unanswered >= 2) {
    add("answer-gap", "partial-or-unanswered", summary.answerQuality.partial + summary.answerQuality.unanswered, distinctDaysFor(records, (record) => ["partial", "unanswered"].includes(record.answerAdequacy)), "Review the listed questions and approve a stronger bilingual answer or a new public FAQ only after source verification.");
  }
  for (const cluster of summary.clustering.clusters.slice(0, 3)) {
    add("emerging-cluster", cluster.labelTerms.join(", "), cluster.count, cluster.distinctDays, "Investigate this recurring need as a possible service, catalogue, procurement, or answer gap; clustering is exploratory evidence, not proof of market size.");
  }
  return recommendations.slice(0, 8);
}

function summarizeDemand(inputRecords, options = {}) {
  const feedbackByRecord = new Map((options.feedback || [])
    .slice()
    .sort((left, right) => String(left.occurredAt || "").localeCompare(String(right.occurredAt || "")))
    .map((item) => [item.recordId, item]));
  const eligible = inputRecords.filter((record) => record?.company === "Vested KSA" && record.evidence?.genuine === true && record.evidence?.synthetic !== true && record.evidence?.suspectedAbuse !== true);
  const latest = eligible.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)).slice(-MAX_ANALYSIS_RECORDS);
  const capped = capDuplicateInfluence(latest);
  const frequencies = { services: {}, topics: {}, brands: {}, specifications: {}, geographies: {}, sectors: {}, languages: {}, sources: {}, daily: {} };
  const answerQuality = { answered: 0, partial: 0, unanswered: 0 };
  for (const record of capped.records) {
    for (const key of ["serviceIds", "topics", "brands", "specifications", "geographies", "sectors"]) {
      const target = key === "serviceIds" ? frequencies.services : frequencies[key];
      for (const value of record.demand?.[key] || []) increment(target, value);
    }
    increment(frequencies.languages, record.language);
    increment(frequencies.sources, record.source);
    increment(frequencies.daily, record.occurredAt.slice(0, 10));
    increment(answerQuality, record.answerAdequacy);
  }
  for (const key of Object.keys(frequencies)) frequencies[key] = orderedCounts(frequencies[key]);
  const distinctDays = Object.keys(frequencies.daily).length;
  const period = {
    start: options.periodStart || capped.records[0]?.occurredAt || null,
    end: options.periodEnd || capped.records.at(-1)?.occurredAt || null,
  };
  const clustering = clusterDemand(capped.records);
  const questionReview = capped.records.map((record) => {
    const feedback = feedbackByRecord.get(record.recordId);
    return {
      recordId: record.recordId,
      occurredAt: record.occurredAt,
      language: record.language,
      fit: record.fit,
      question: record.question,
      agentReply: record.agentReply,
      answerAdequacy: record.answerAdequacy,
      ownerReply: feedback?.ownerReply || null,
      approvedImprovedReply: feedback?.approvedImprovedReply || null,
    };
  });
  const summary = {
    schemaVersion: "2026-09-08",
    company: "Vested KSA",
    reportKind: options.reportKind || "daily",
    generatedAt: new Date(options.now || Date.now()).toISOString(),
    period,
    evidence: {
      receivedRecords: inputRecords.length,
      includedGenuineRecords: capped.records.length,
      excludedNonGenuineOrWrongCompany: inputRecords.length - eligible.length,
      duplicateInfluenceCapped: capped.capped,
      distinctDays,
      syntheticIncluded: 0,
      coverage: "Only sanitized A2A questions and successful Vested contact inquiries captured during the analysis period; this is not the entire market.",
    },
    frequencies,
    answerQuality,
    quantities: {
      teamSizes: capped.records.map((record) => record.demand?.quantities?.teamSize).filter(Number.isFinite),
      timelineMonths: capped.records.map((record) => record.demand?.quantities?.timelineMonths).filter(Number.isFinite),
      timelineWeeks: capped.records.map((record) => record.demand?.quantities?.timelineWeeks).filter(Number.isFinite),
    },
    clustering,
    questionReview,
    recommendations: [],
    governance: {
      modelActuallyTrained: false,
      publicConversationalModelRetrained: false,
      automaticPublicationOrOfferChange: false,
      ownerApprovalRequired: true,
    },
  };
  summary.recommendations = buildRecommendations(summary, capped.records);
  return summary;
}

function tableRows(counts) {
  const rows = Object.entries(counts);
  return rows.length ? rows.map(([key, count]) => `| ${key} | ${count} |`).join("\n") : "| No evidence | 0 |";
}

function renderDemandReport(summary) {
  const lines = [
    `# Vested KSA ${summary.reportKind === "weekly" ? "Weekly" : "Daily"} Demand Learning Report`,
    "",
    `Period: ${summary.period.start || "no records"} to ${summary.period.end || "no records"}`,
    `Generated: ${summary.generatedAt}`,
    "",
    `- Genuine sanitized records: ${summary.evidence.includedGenuineRecords}`,
    `- ${summary.evidence.syntheticIncluded} synthetic records included`,
    `- Duplicate influence capped: ${summary.evidence.duplicateInfluenceCapped}`,
    `- Partial answers: ${summary.answerQuality.partial}`,
    `- Unanswered: ${summary.answerQuality.unanswered}`,
    `- Clustering status: ${summary.clustering.status}`,
    `- Model actually trained: no`,
    "",
    "## Most Requested Services",
    "",
    "| Service | Requests |",
    "| --- | ---: |",
    tableRows(summary.frequencies.services),
    "",
    "## Topics, Brands And Specifications",
    "",
    "| Signal | Requests |",
    "| --- | ---: |",
    tableRows({ ...summary.frequencies.topics, ...summary.frequencies.brands, ...summary.frequencies.specifications }),
    "",
    "## Geography And Sector",
    "",
    "| Signal | Requests |",
    "| --- | ---: |",
    tableRows({ ...summary.frequencies.geographies, ...summary.frequencies.sectors }),
    "",
    "## Quantities And Timing",
    "",
    `- Team sizes requested: ${summary.quantities.teamSizes.length ? summary.quantities.teamSizes.join(", ") : "No evidence"}`,
    `- Timelines in months: ${summary.quantities.timelineMonths.length ? summary.quantities.timelineMonths.join(", ") : "No evidence"}`,
    `- Timelines in weeks: ${summary.quantities.timelineWeeks.length ? summary.quantities.timelineWeeks.join(", ") : "No evidence"}`,
    "- Product dimensions: not applicable to Vested KSA's current service business; no product catalogue is inferred.",
    "",
    "## Changes Over Time",
    "",
    "| Date | Genuine requests |",
    "| --- | ---: |",
    tableRows(summary.frequencies.daily),
    "",
    "## Recommendations",
    "",
  ];
  if (!summary.recommendations.length) lines.push("No recommendation passed the minimum evidence threshold.");
  for (const item of summary.recommendations) {
    lines.push(`- ${item.action} Evidence: ${item.evidence.genuineCount} genuine and ${item.evidence.syntheticCount} synthetic records across ${item.supportingDistinctDays} day(s), period ${item.analysisPeriod.start} to ${item.analysisPeriod.end}; uncertainty: ${item.uncertainty}; automatic change: no.`);
  }
  if (summary.reportKind === "weekly") {
    lines.push("", "## Question And Answer Review", "");
    for (const item of summary.questionReview) {
      lines.push(
        `### ${item.recordId.slice(0, 12)} | ${item.language} | ${item.answerAdequacy}`,
        "",
        `Question: ${item.question}`,
        "",
        `Agent reply: ${item.agentReply || "No agent reply; source was a contact inquiry."}`,
        "",
        `Owner reply: ${item.ownerReply || "Awaiting owner guidance."}`,
        "",
        `Approved improved reply: ${item.approvedImprovedReply || "Not approved."}`,
        "",
      );
    }
  }
  lines.push(
    "## Limitations",
    "",
    summary.evidence.coverage,
    "Synthetic tests, spam, non-fit requests and suspected poisoned input are excluded before analysis. Small samples and deterministic extraction can miss nuance. Clusters are exploratory statistical groupings, not a trained model or proof of market demand.",
    "",
    "Reply to the private report with the record ID, your assessment, and how the answer should improve. No response is published or used to retrain the public agent automatically.",
    "",
  );
  return lines.join("\n");
}

module.exports = {
  MAX_DUPLICATE_INFLUENCE_PER_DAY,
  MIN_CLUSTER_RECORDS,
  clusterDemand,
  renderDemandReport,
  summarizeDemand,
};
