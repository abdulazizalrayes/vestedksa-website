import fs from "node:fs";
import { pathToFileURL } from "node:url";

const TELEMETRY_TYPES = new Set(["agent_readiness_event", "agent_surface_event"]);

function increment(counts, key) {
  if (!key) return;
  counts[key] = (counts[key] || 0) + 1;
}

function sortedCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function parseTelemetryLine(line) {
  const value = String(line || "").trim();
  if (!value.startsWith("{")) return null;
  try {
    const envelope = JSON.parse(value);
    let record = envelope;
    if (typeof envelope.message === "string" && envelope.message.trim().startsWith("{")) {
      record = JSON.parse(envelope.message);
    }
    return TELEMETRY_TYPES.has(record?.type) ? record : null;
  } catch (_error) {
    return null;
  }
}

export function summarizeTelemetry(input, options = {}) {
  const includeValidation = options.includeValidation === true;
  const counts = {
    actions: {},
    agentClasses: {},
    outcomes: {},
    paths: {},
    routes: {},
    tools: {},
    messageOutcomes: {},
  };
  let processedEvents = 0;
  let excludedValidationEvents = 0;
  let ignoredLines = 0;
  let firstSeen = "";
  let lastSeen = "";

  for (const line of String(input || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const record = parseTelemetryLine(line);
    if (!record) {
      ignoredLines += 1;
      continue;
    }
    if (record.userAgentClass === "validation-probe" && !includeValidation) {
      excludedValidationEvents += 1;
      continue;
    }
    const event = record.event || {};
    const action = event.action || record.action;
    processedEvents += 1;
    increment(counts.actions, action);
    increment(counts.agentClasses, record.userAgentClass);
    increment(counts.outcomes, event.outcome);
    increment(counts.paths, record.path);
    increment(counts.routes, event.route);
    increment(counts.tools, event.tool);
    if (action === "a2a_message_send") increment(counts.messageOutcomes, event.outcome);
    if (record.timestamp && (!firstSeen || record.timestamp < firstSeen)) firstSeen = record.timestamp;
    if (record.timestamp && (!lastSeen || record.timestamp > lastSeen)) lastSeen = record.timestamp;
  }

  const messageSends = counts.actions.a2a_message_send || 0;
  const goodFit = counts.messageOutcomes.good_fit || 0;
  const maybeFit = counts.messageOutcomes.maybe_fit || 0;
  const notFit = counts.messageOutcomes.not_fit || 0;
  return {
    company: "Vested KSA",
    report: "agent-concierge-funnel",
    period: { firstSeen: firstSeen || null, lastSeen: lastSeen || null },
    processedEvents,
    excludedValidationEvents,
    ignoredLines,
    funnel: {
      metadataReads: counts.actions.a2a_metadata_read || 0,
      messageSends,
      goodFit,
      maybeFit,
      notFit,
      inquiryPrepared: counts.actions.a2a_inquiry_prepared || 0,
      nonFitRouted: counts.actions.a2a_non_fit_routed || 0,
      errors: counts.actions.a2a_error || 0,
      qualifiedShare: messageSends ? Number(((goodFit + maybeFit) / messageSends).toFixed(4)) : 0,
      inquiryPreparationShare: messageSends
        ? Number(((counts.actions.a2a_inquiry_prepared || 0) / messageSends).toFixed(4))
        : 0,
    },
    breakdowns: {
      actions: sortedCounts(counts.actions),
      agentClasses: sortedCounts(counts.agentClasses),
      outcomes: sortedCounts(counts.outcomes),
      paths: sortedCounts(counts.paths),
      routes: sortedCounts(counts.routes),
      tools: sortedCounts(counts.tools),
    },
    privacy: {
      includesPrompts: false,
      includesPersonalData: false,
      includesIpAddresses: false,
      includesFullUserAgents: false,
      validationExcludedByDefault: !includeValidation,
    },
  };
}

function renderBreakdown(title, counts) {
  const rows = Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  if (!rows.length) return `## ${title}\n\nNo events.\n`;
  return `## ${title}\n\n| Value | Events |\n| --- | ---: |\n${rows.map(([key, count]) => `| ${key} | ${count} |`).join("\n")}\n`;
}

export function renderMarkdown(summary) {
  const period = summary.period.firstSeen
    ? `${summary.period.firstSeen} to ${summary.period.lastSeen}`
    : "No matching events";
  return [
    "# Vested KSA Agent Concierge Funnel",
    "",
    `Period: ${period}`,
    "",
    `- Processed privacy-safe events: ${summary.processedEvents}`,
    `- Excluded validation-probe events: ${summary.excludedValidationEvents}`,
    `- A2A messages: ${summary.funnel.messageSends}`,
    `- Good fit: ${summary.funnel.goodFit}`,
    `- Maybe fit: ${summary.funnel.maybeFit}`,
    `- Not fit: ${summary.funnel.notFit}`,
    `- Inquiry preparations: ${summary.funnel.inquiryPrepared}`,
    `- Errors: ${summary.funnel.errors}`,
    `- Qualified share: ${(summary.funnel.qualifiedShare * 100).toFixed(1)}%`,
    `- Inquiry-preparation share: ${(summary.funnel.inquiryPreparationShare * 100).toFixed(1)}%`,
    "",
    renderBreakdown("Skills", summary.breakdowns.tools).trimEnd(),
    "",
    renderBreakdown("Agent Classes", summary.breakdowns.agentClasses).trimEnd(),
    "",
    "This aggregate report excludes prompts, personal information, IP addresses, full user agents, and validation probes by default.",
    "",
  ].join("\n");
}

function parseArguments(args) {
  const options = { file: "", format: "markdown", includeValidation: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--file") options.file = args[++index] || "";
    else if (args[index] === "--json") options.format = "json";
    else if (args[index] === "--include-validation") options.includeValidation = true;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const input = options.file ? fs.readFileSync(options.file, "utf8") : fs.readFileSync(0, "utf8");
  const summary = summarizeTelemetry(input, options);
  process.stdout.write(options.format === "json"
    ? `${JSON.stringify(summary, null, 2)}\n`
    : renderMarkdown(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
