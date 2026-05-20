"use strict";

const ALLOWED_ORIGINS = new Set([
  "https://vestedksa.com",
  "https://www.vestedksa.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...String(process.env.VESTED_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

const DEFAULT_BUSINESS_MAILBOX = "hello@vestedksa.com";
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const RATE_LIMIT_MAX_KEYS = 1000;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sanitizeText(value, maxLength) {
  const text = String(value || "").trim();
  const unwrapped =
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
      ? text.slice(1, -1)
      : text;
  return unwrapped.replace(/\\n/g, "").replace(/\\r/g, "").trim().slice(0, maxLength);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 254).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAllowedOrigin(req) {
  const origin = sanitizeText(req.headers.origin, 255);
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function getClientIp(req) {
  const forwarded = sanitizeText(req.headers["x-forwarded-for"], 500).split(",")[0].trim();
  return forwarded || sanitizeText(req.socket && req.socket.remoteAddress, 64) || "unknown";
}

function applyRateLimit(req) {
  const key = getClientIp(req);
  const now = Date.now();
  if (!global.__vestedContactRateLimit) global.__vestedContactRateLimit = new Map();
  const limits = global.__vestedContactRateLimit;

  if (limits.size > RATE_LIMIT_MAX_KEYS) {
    for (const [storedKey, value] of limits.entries()) {
      if (now - value.start >= RATE_LIMIT_WINDOW_MS) limits.delete(storedKey);
    }
    if (limits.size > RATE_LIMIT_MAX_KEYS) limits.clear();
  }

  const current = limits.get(key);
  if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) {
    limits.set(key, { count: 1, start: now });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT_MAX_REQUESTS;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 20);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseBody(raw, contentType) {
  if (!raw) return {};
  if (contentType.includes("application/json")) {
    return JSON.parse(raw);
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return {};
}

function cleanLead(fields) {
  return {
    name: sanitizeText(fields.name, 120),
    email: sanitizeEmail(fields.email),
    company: sanitizeText(fields.company, 160),
    country: sanitizeText(fields.country, 120),
    service: sanitizeText(fields.service, 80),
    message: sanitizeText(fields.message, 4000),
    phone: normalizePhone(fields.phone || ""),
    pageUrl: sanitizeText(fields.pageUrl || fields.page_url, 500),
    referrer: sanitizeText(fields.referrer, 500),
    userAgent: sanitizeText(fields.userAgent || fields.user_agent, 500),
  };
}

function formatValue(value) {
  return value ? String(value) : "-";
}

function escapeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function toBase64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function formatSmtpDataBlock(message) {
  return String(message || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

async function readSmtpResponse(socket) {
  const chunks = [];
  while (true) {
    const chunk = await new Promise((resolve, reject) => {
      socket.once("data", resolve);
      socket.once("error", reject);
    });
    const text = chunk.toString("utf8");
    chunks.push(text);
    const lines = text.split(/\r?\n/).filter(Boolean);
    const lastLine = lines[lines.length - 1] || "";
    if (/^\d{3} /.test(lastLine)) {
      return chunks.join("");
    }
  }
}

async function sendSmtpCommand(socket, command, expectedCodes) {
  if (command) {
    socket.write(`${command}\r\n`);
  }
  const response = await readSmtpResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP command failed: ${command || "greeting"} -> ${response.trim()}`);
  }
  return response;
}

async function sendLeadAlertEmail(record) {
  const smtpUser = sanitizeEmail(
    process.env.VESTED_SMTP_USER ||
    process.env.SMTP_USER ||
    process.env.PRIVATE_EMAIL_USERNAME
  );
  const smtpPass = sanitizeText(
    process.env.VESTED_SMTP_PASS ||
    process.env.SMTP_PASS ||
    process.env.PRIVATE_EMAIL_PASSWORD,
    255
  );
  const smtpHost = sanitizeText(
    process.env.VESTED_SMTP_HOST ||
    process.env.SMTP_HOST ||
    process.env.PRIVATE_EMAIL_SMTP_HOST ||
    "mail.privateemail.com",
    255
  );
  const smtpPort = Number(
    sanitizeText(
      process.env.VESTED_SMTP_PORT ||
      process.env.SMTP_PORT ||
      process.env.PRIVATE_EMAIL_SMTP_PORT ||
      465,
      16
    )
  );
  const fromEmail = sanitizeEmail(
    process.env.VESTED_BUSINESS_MAILBOX ||
    process.env.CONTACT_FROM ||
    DEFAULT_BUSINESS_MAILBOX
  );
  const alertRecipients = String(
    process.env.VESTED_LEAD_ALERT_TO ||
    process.env.CONTACT_DESTINATION ||
    fromEmail
  )
    .split(",")
    .map((item) => sanitizeEmail(item))
    .filter(Boolean)
    .slice(0, 5);

  if (!smtpUser || !smtpPass || !smtpHost || !smtpPort || alertRecipients.length === 0) {
    throw new Error("smtp_not_configured");
  }

  if (smtpUser !== fromEmail) {
    throw new Error("smtp_sender_mismatch");
  }

  const tls = await import("node:tls");
  const socket = tls.connect({
    host: smtpHost,
    port: smtpPort,
    servername: smtpHost,
    rejectUnauthorized: true,
  });
  socket.setTimeout(10000);
  socket.on("timeout", () => {
    socket.destroy(new Error("SMTP timeout"));
  });

  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });

  const subject = `New Vested KSA inquiry: ${record.company || record.name}`;
  const bodyLines = [
    "New Vested KSA inquiry received.",
    "",
    "Lead",
    `- Name: ${formatValue(record.name)}`,
    `- Email: ${formatValue(record.email)}`,
    `- Company: ${formatValue(record.company)}`,
    `- Country: ${formatValue(record.country)}`,
    `- Service interest: ${formatValue(record.service)}`,
    `- Phone: ${formatValue(record.phone)}`,
    "",
    "Message",
    record.message || "-",
    "",
    "Attribution",
    `- Page URL: ${formatValue(record.pageUrl)}`,
    `- Referrer: ${formatValue(record.referrer)}`,
    `- User Agent: ${formatValue(record.userAgent)}`,
  ];

  const message = [
    `From: Vested KSA <${fromEmail}>`,
    `To: ${alertRecipients.join(", ")}`,
    `Reply-To: ${escapeHeader(record.email)}`,
    `Subject: ${escapeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyLines.join("\n"),
    "",
  ].join("\r\n");

  try {
    await sendSmtpCommand(socket, null, [220]);
    await sendSmtpCommand(socket, "EHLO vestedksa.com", [250]);
    await sendSmtpCommand(socket, "AUTH LOGIN", [334]);
    await sendSmtpCommand(socket, toBase64(smtpUser), [334]);
    await sendSmtpCommand(socket, toBase64(smtpPass), [235]);
    await sendSmtpCommand(socket, `MAIL FROM:<${fromEmail}>`, [250]);
    for (const recipient of alertRecipients) {
      await sendSmtpCommand(socket, `RCPT TO:<${recipient}>`, [250, 251]);
    }
    await sendSmtpCommand(socket, "DATA", [354]);
    socket.write(`${formatSmtpDataBlock(message)}\r\n.\r\n`);
    await sendSmtpCommand(socket, null, [250]);
    await sendSmtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, {
      ok: false,
      error: "Method not allowed.",
    });
    return;
  }

  try {
    if (!isAllowedOrigin(req)) {
      json(res, 403, {
        ok: false,
        error: "Origin not allowed.",
      });
      return;
    }

    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > MAX_BODY_BYTES) {
      json(res, 413, {
        ok: false,
        error: "Request body too large.",
      });
      return;
    }

    if (!applyRateLimit(req)) {
      json(res, 429, {
        ok: false,
        error: "Too many requests. Please try again later.",
      });
      return;
    }

    const raw = await readBody(req);
    let fields;
    try {
      fields = parseBody(raw, req.headers["content-type"] || "");
    } catch (_err) {
      json(res, 400, {
        ok: false,
        error: "Invalid request body.",
      });
      return;
    }
    const lead = cleanLead(fields);

    if (!lead.name || !lead.email || !lead.company || !lead.country || !lead.service || !lead.message) {
      json(res, 400, {
        ok: false,
        error: "Please complete all required fields.",
      });
      return;
    }

    if (!isValidEmail(lead.email)) {
      json(res, 400, {
        ok: false,
        error: "Please provide a valid email address.",
      });
      return;
    }

    await sendLeadAlertEmail(lead);

    json(res, 200, {
      ok: true,
      message: "Thank you for reaching out. We'll be in touch within 24 hours.",
    });
  } catch (error) {
    json(res, 500, {
      ok: false,
      error: "Vested contact delivery is temporarily unavailable.",
      reason: process.env.NODE_ENV === "development" ? String(error && error.message ? error.message : error) : undefined,
    });
  }
};
