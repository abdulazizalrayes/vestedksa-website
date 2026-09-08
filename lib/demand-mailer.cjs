"use strict";

const DEFAULT_MAILBOX = "hello@vestedksa.com";

function clean(value, max = 500) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

function email(value) {
  return clean(value, 254).toLowerCase();
}

function responseComplete(value) {
  return /^\d{3} /m.test(String(value || "").split(/\r?\n/).filter(Boolean).at(-1) || "");
}

async function readResponse(socket) {
  let response = "";
  while (!responseComplete(response)) {
    response += await new Promise((resolve, reject) => {
      socket.once("data", (chunk) => resolve(chunk.toString("utf8")));
      socket.once("error", reject);
    });
  }
  return response;
}

async function command(socket, value, expected) {
  if (value) socket.write(`${value}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) throw new Error(`SMTP command failed with ${code || "unknown status"}`);
}

function dataBlock(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((line) => line.startsWith(".") ? `.${line}` : line).join("\r\n");
}

async function sendPrivateReportEmail({ subject, body }) {
  const smtpUser = email(process.env.VESTED_SMTP_USER || process.env.SMTP_USER || process.env.PRIVATE_EMAIL_USERNAME);
  const smtpPass = clean(process.env.VESTED_SMTP_PASS || process.env.SMTP_PASS || process.env.PRIVATE_EMAIL_PASSWORD, 255);
  const smtpHost = clean(process.env.VESTED_SMTP_HOST || process.env.SMTP_HOST || process.env.PRIVATE_EMAIL_SMTP_HOST || "mail.privateemail.com", 255);
  const smtpPort = Number(clean(process.env.VESTED_SMTP_PORT || process.env.SMTP_PORT || process.env.PRIVATE_EMAIL_SMTP_PORT || 465, 16));
  const from = email(process.env.VESTED_BUSINESS_MAILBOX || process.env.CONTACT_FROM || DEFAULT_MAILBOX);
  const recipients = String(process.env.VESTED_DEMAND_REPORT_TO || process.env.VESTED_LEAD_ALERT_TO || process.env.CONTACT_DESTINATION || from)
    .split(",").map(email).filter(Boolean).slice(0, 5);
  if (!smtpUser || !smtpPass || !smtpHost || !smtpPort || !recipients.length) throw new Error("smtp_not_configured");
  if (smtpUser !== from) throw new Error("smtp_sender_mismatch");

  const tls = await import("node:tls");
  const socket = tls.connect({ host: smtpHost, port: smtpPort, servername: smtpHost, rejectUnauthorized: true });
  socket.setTimeout(10000);
  socket.on("timeout", () => socket.destroy(new Error("SMTP timeout")));
  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });
  const message = [
    `From: Vested KSA Demand Learning <${from}>`,
    `To: ${recipients.join(", ")}`,
    `Reply-To: ${from}`,
    `Subject: ${clean(subject, 180)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "X-Vested-Data-Classification: private-sanitized-demand-report",
    "",
    String(body || "").slice(0, 120000),
    "",
  ].join("\r\n");
  try {
    await command(socket, null, [220]);
    await command(socket, "EHLO vestedksa.com", [250]);
    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, Buffer.from(smtpUser).toString("base64"), [334]);
    await command(socket, Buffer.from(smtpPass).toString("base64"), [235]);
    await command(socket, `MAIL FROM:<${from}>`, [250]);
    for (const recipient of recipients) await command(socket, `RCPT TO:<${recipient}>`, [250, 251]);
    await command(socket, "DATA", [354]);
    socket.write(`${dataBlock(message)}\r\n.\r\n`);
    await command(socket, null, [250]);
    await command(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
  return { delivered: true, recipients: recipients.length };
}

module.exports = { sendPrivateReportEmail };
