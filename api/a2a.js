"use strict";

const { SKILLS, buildConciergeResponse, createMessageId } = require("../lib/agent-concierge.cjs");
const { recordAgentEvent } = require("../lib/server-agent-telemetry.cjs");

const MAX_BODY_BYTES = 64 * 1024;
const MAX_TEXT_LENGTH = 4000;
const PROTOCOL_VERSION = "1.0";

function setCommonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, A2A-Version");
  res.setHeader("A2A-Version", PROTOCOL_VERSION);
  res.setHeader("Content-Signal", "search=yes, ai-input=yes, ai-train=no");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Link", '<https://vestedksa.com/.well-known/agent-card.json>; rel="service-desc"; type="application/json"');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let exceeded = false;
    req.on("data", (chunk) => {
      if (exceeded) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        exceeded = true;
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
      }
    });
    req.on("end", () => {
      if (!exceeded) resolve(body);
    });
    req.on("error", reject);
  });
}

function extractText(message) {
  if (!message || message.role !== "ROLE_USER") {
    throw Object.assign(new Error("message.role must be ROLE_USER"), { rpcCode: -32602 });
  }
  if (typeof message.messageId !== "string" || !message.messageId.trim() || message.messageId.length > 200) {
    throw Object.assign(new Error("message.messageId is required and must be at most 200 characters"), { rpcCode: -32602 });
  }
  if (message.taskId) {
    throw Object.assign(new Error("This stateless direct-response agent does not accept taskId"), { rpcCode: -32602 });
  }
  if (!Array.isArray(message.parts) || message.parts.length < 1 || message.parts.length > 8) {
    throw Object.assign(new Error("message.parts must contain between 1 and 8 parts"), { rpcCode: -32602 });
  }

  const parts = message.parts.map((part) => {
    if (!part || typeof part.text !== "string" || Object.keys(part).some((key) => ["raw", "url", "data"].includes(key))) {
      throw Object.assign(new Error("Only text parts are supported"), { rpcCode: -32602 });
    }
    return part.text.trim();
  }).filter(Boolean);
  const text = parts.join("\n");
  if (!text) {
    throw Object.assign(new Error("At least one non-empty text part is required"), { rpcCode: -32602 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw Object.assign(new Error(`Combined message text must be at most ${MAX_TEXT_LENGTH} characters`), { rpcCode: -32602 });
  }
  return text;
}

function chooseOutputParts(result, configuration) {
  const accepted = Array.isArray(configuration?.acceptedOutputModes)
    ? configuration.acceptedOutputModes.map(String)
    : [];
  const acceptsText = !accepted.length || accepted.includes("text/plain") || accepted.includes("text/markdown") || accepted.includes("text/*") || accepted.includes("*/*");
  const acceptsData = !accepted.length || accepted.includes("application/json") || accepted.includes("application/*") || accepted.includes("*/*");
  if (!acceptsText && !acceptsData) {
    throw Object.assign(new Error("Requested output modes are not supported"), { rpcCode: -32005 });
  }
  const parts = [];
  if (acceptsText) {
    const textMediaType = accepted.includes("text/markdown") && !accepted.includes("text/plain")
      ? "text/markdown"
      : "text/plain";
    parts.push({ text: result.text, mediaType: textMediaType });
  }
  if (acceptsData) {
    const { text, ...data } = result;
    parts.push({ data, mediaType: "application/json" });
  }
  return parts;
}

function endpointMetadata() {
  return {
    name: "Vested KSA Agent Concierge",
    company: "Vested KSA",
    protocol: "A2A",
    protocolBinding: "JSONRPC",
    protocolVersion: PROTOCOL_VERSION,
    agentCard: "https://vestedksa.com/.well-known/agent-card.json",
    method: "SendMessage",
    readOnly: true,
    stateful: false,
    submissionAllowed: false,
    contentSignal: "search=yes, ai-input=yes, ai-train=no",
  };
}

async function handlePost(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const requestedVersion = String(req.headers["a2a-version"] || "");
  if (requestedVersion && requestedVersion !== PROTOCOL_VERSION) {
    res.setHeader("Content-Type", "application/problem+json; charset=utf-8");
    sendJson(res, 400, {
      type: "https://a2a-protocol.org/errors/version-not-supported",
      title: "Protocol Version Not Supported",
      status: 400,
      detail: `The requested A2A protocol version ${requestedVersion} is not supported by this agent`,
      supportedVersions: [PROTOCOL_VERSION],
    });
    return;
  }

  if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
    sendJson(res, 415, rpcError(null, -32600, "Content-Type must be application/json"));
    return;
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw);
  } catch (error) {
    const status = error.statusCode || 400;
    sendJson(res, status, rpcError(null, -32700, status === 413 ? "Request body too large" : "Invalid JSON payload"));
    return;
  }

  const id = payload?.id;
  if (!payload || payload.jsonrpc !== "2.0" || id === undefined || id === null || typeof payload.method !== "string") {
    sendJson(res, 400, rpcError(id, -32600, "Request payload validation error"));
    return;
  }
  if (payload.method !== "SendMessage") {
    sendJson(res, 200, rpcError(id, -32601, "Method not found"));
    return;
  }

  try {
    const params = payload.params || {};
    const text = extractText(params.message);
    const requestedSkill = typeof params.metadata?.skillId === "string" ? params.metadata.skillId : "";
    if (requestedSkill && !SKILLS.has(requestedSkill)) {
      throw Object.assign(new Error(`Unknown skillId: ${requestedSkill}`), { rpcCode: -32602 });
    }
    const result = buildConciergeResponse(text, { skillId: requestedSkill });
    const responseMessage = {
      messageId: createMessageId(params.message.messageId, text),
      contextId: params.message.contextId || `vested-context-${createMessageId(params.message.messageId, text).slice(-24)}`,
      role: "ROLE_AGENT",
      parts: chooseOutputParts(result, params.configuration),
      metadata: {
        company: "Vested KSA",
        skillId: result.skillId,
        fit: result.fit.classification,
        submissionStatus: "not_submitted",
        approvalRequiredForContact: true,
      },
    };

    const telemetryDimensions = {
      tool: result.skillId,
      outcome: result.fit.classification,
      route: result.fit.route,
    };
    recordAgentEvent(req, { action: "a2a_message_send", ...telemetryDimensions });
    if (result.fit.classification === "not_fit") {
      recordAgentEvent(req, { action: "a2a_non_fit_routed", ...telemetryDimensions });
    }
    if (result.inquiry.prepared) {
      recordAgentEvent(req, { action: "a2a_inquiry_prepared", ...telemetryDimensions });
    }
    sendJson(res, 200, rpcResult(id, { message: responseMessage }));
  } catch (error) {
    const code = error.rpcCode || -32603;
    const message = code === -32005 ? "Content type not supported" : code === -32602 ? "Invalid parameters" : "Internal error";
    recordAgentEvent(req, { action: "a2a_error" });
    sendJson(res, code === -32603 ? 500 : 200, rpcError(id, code, message, error.message));
  }
}

module.exports = async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.end();
    return;
  }
  if (req.method === "GET") {
    recordAgentEvent(req, { action: "a2a_metadata_read" });
    sendJson(res, 200, endpointMetadata());
    return;
  }
  if (req.method === "POST") {
    await handlePost(req, res);
    return;
  }

  res.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
  sendJson(res, 405, { error: "Method not allowed" });
};

module.exports.extractText = extractText;
module.exports.chooseOutputParts = chooseOutputParts;
