# Vested KSA Private Demand Learning

## Purpose

This layer learns from genuine client and potential-client questions without changing the public website, publishing private records, or retraining the public Agent Concierge. It supports better sales answers, service positioning, awareness content, FAQ proposals and opportunity discovery.

Identity lock:

- Company: Vested KSA
- Domain: `https://vestedksa.com`
- GitHub: `abdulazizalrayes/vestedksa-website`
- Vercel project: `project-ivd9v` / `prj_Qf4Ef3S8n0cNveCoRoqw2br1SAmC`
- Private Blob store: `vested-demand-intelligence` / `store_ZjYAmEOEFgdPRT3y`, `iad1`, production connection only
- Paperclip: Vested KSA / `VES`
- Content-Signal: `search=yes, ai-input=yes, ai-train=no`

Never reuse this store, its environment variables, reports or records for another company.

## Architecture

The existing deterministic A2A endpoint remains the public conversation layer. It answers in English or Arabic and remains read-only. After it prepares the response, a separate capture path:

1. Classifies the request as genuine demand, synthetic, non-fit or suspected abuse.
2. Rejects careers, internships, training, inbound supplier pitches, ambiguous supplier intent, spam, unrelated traffic and prompt injection from learning. Only confirmed good-fit client demand is eligible.
3. Removes direct names, email addresses, telephone numbers, identifiers and non-Vested URLs.
4. Extracts only approved demand attributes.
5. Writes one immutable JSON event to a private Vested-only Vercel Blob store.

Successful contact inquiries also contribute a sanitized demand record after SMTP delivery. Contact names, email addresses and telephone numbers are never copied to demand storage.

The production store is Vercel Private Blob within the existing Vested Vercel project. It is not a local server, local file, iCloud folder, public blob, public API, A2A resource, MCP resource or Markdown asset. Hobby use is free within Vercel's included limits. Hobby accounts do not incur automatic overage charges; storage becomes unavailable if the allowance is exhausted.

## Stored Data

For eligible activity only:

- Sanitized question.
- Sanitized deterministic agent reply, when the source is A2A.
- English or Arabic language.
- Fit, route and selected skill.
- Matched Vested services and demand topics.
- Allowlisted public platforms or buyer entities such as MISA, Qiwa, GOSI, ZATCA, Aramco and PIF.
- Broad geography and sector.
- Contextual team-size or timeline quantities.
- Answer adequacy: answered, partial or unanswered.
- Record timestamp, deterministic duplicate key and retention deadline.

Never stored:

- Raw conversations or request payloads.
- Names, email addresses or telephone numbers.
- IP addresses, source-agent identifiers or full user agents.
- Passports, national IDs, Iqama numbers, bank details or confidential documents.
- Contact-form personal fields.
- Private Paperclip, CRM or internal records.

Redaction is deterministic and deliberately conservative. It cannot guarantee recognition of every possible personal name in every language. Inputs with detected sensitive or confidential context are excluded entirely, even when no separate identifier is detected. This limitation must be reviewed before expanding the attribute allowlist.

## Retention And Deletion

- Sanitized demand events: 90 days.
- Private reports and owner feedback: 180 days.
- Raw conversation retention: zero days.
- A bounded cleanup runs with the daily report and deletes at most 100 expired objects per run.

Deleting the Blob store is the complete emergency purge. Individual objects can be removed with the authenticated Vercel Blob dashboard or CLI. Do not copy reports into the repository.

## Analysis

The daily and weekly statistical baseline reports:

- Service, topic, platform and specification frequency.
- Geography, sector and language demand.
- Team-size and timeline signals.
- Partial and unanswered questions.
- Daily changes and duplicate influence caps.
- Evidence-supported proposals with genuine and synthetic counts, subject-specific supporting days, analysis period and uncertainty.

At 20 or more clean records, a bounded unsupervised TF-IDF cosine similarity analysis groups recurring descriptions. A cluster must contain at least three records across at least two distinct days. Exact repeated demand signatures influence a day at most three times.

This is clustering, not persistent model training. No model is fitted, saved, fine-tuned or used to alter public answers. Counting is reported as statistical summarization, not machine learning.

## Daily And Weekly Review

Vercel Cron invokes `/api/demand-review` once daily at 03:15 UTC, 06:15 Riyadh time. The function:

- Produces and privately stores the previous completed Riyadh day's report.
- Emails the daily report when genuine demand exists.
- On Monday, also produces and emails a seven-day question-and-answer review.
- Applies retention cleanup.

The weekly report lists each sanitized question, the public agent's reply, answer adequacy, owner reply and any approved improved reply. The owner can reply to the private report email using the record ID. A later authorized operator records the response through the private owner endpoint. Owner feedback is never published and never retrains the public agent automatically.

The review endpoint is absent from OpenAPI, MCP, A2A, Markdown and llms discovery. It requires an exact bearer secret, returns `noindex`, disables caching and has no browser UI.

## Owner Feedback Contract

Authenticated `POST /api/demand-review` JSON:

```json
{
  "recordId": "64-character record identifier from the private weekly report",
  "ownerReply": "Owner assessment of the answer and opportunity",
  "approvedImprovedReply": "Optional improved English or Arabic wording"
}
```

Persistence never means publication approval. `publishApproved` and `publicAgentTrainingApproved` remain false. A separate owner-approved source and release change is required before public copy, services, availability, prices or agent answers change.

## Environment And Ownership

Production-only environment names:

- `BLOB_READ_WRITE_TOKEN`: automatically connected private Vested Blob store.
- `CRON_SECRET`: authenticates Vercel Cron.
- `DEMAND_REVIEW_TOKEN`: authenticates owner report reads and feedback writes.
- Existing Vested SMTP values deliver private reports.
- Optional `VESTED_DEMAND_REPORT_TO` overrides the existing Vested contact destination.

Never print, commit, download into the repository, or share these values across companies. No environment value is required for unit tests.

## Validation

```bash
npm test
npm run validate:demand-learning
npm run validate:release
npm audit --omit=dev
npx vercel build --prod
npm run validate:deployment-output
```

The tests cover:

- English and Arabic fit and non-fit routing.
- English supplier-intent ambiguity.
- Name, email, phone, URL and identifier redaction.
- Deterministic deduplication.
- Vested-only company isolation.
- Synthetic, spam and poisoned-input exclusion.
- Retention deletion.
- Statistical evidence and uncertainty.
- Clustering thresholds and multi-day support.
- Owner-feedback privacy and no automatic publication/training.

Before deployment, hash all canonical HTML files and prove the hashes are unchanged. After deployment, verify normal HTML and Markdown behavior, A2A English and Arabic responses, non-fit routing, private endpoint `401` without credentials, Cron health, private Blob writes, and report email delivery.

## First-Week Review

After seven complete days:

1. Confirm capture volume is within free Blob operations.
2. Inspect exclusions for false positives without restoring raw traffic.
3. Review every partial or unanswered client question in English and Arabic.
4. Compare recurring demand with GA4, Search Console and qualified inquiry evidence.
5. Record owner feedback by record ID.
6. Approve, reject or defer each proposed FAQ, service, sales or awareness improvement.
7. Keep clustering labelled `insufficient_data` unless the threshold is genuinely met.

Do not report improvement percentages until a pre-change baseline and post-change qualified-lead outcome have both been measured.

## Known Limitations

- Records represent only captured A2A and successful form activity, not the whole market.
- Deterministic redaction and Arabic routing can miss novel wording.
- Private Blob object-per-event storage is designed for low-volume pilot demand, not high-volume streaming analytics.
- Multi-source coordinated poisoning cannot be eliminated without stronger identity or reputation signals; duplicate caps, multi-day thresholds and owner approval reduce its influence.
- Owner email replies require an authorized operator to attach feedback to the record; inbound mailbox automation is intentionally not enabled.
