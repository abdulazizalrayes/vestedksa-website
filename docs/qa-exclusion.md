# Vested QA isolation

Only Vested KSA / GA4 property 529693438 / measurement G-7STG2HDV42.

## Automatic exclusions

- `utm_source=owner_qa` and the dated Vested delivery/attribution and VES-E2E
  campaign labels classify a browser visit as QA. Explicit synthetic
  owner-approved test messages and `VES-QA-YYYYMMDD-` references also mark a
  contact submission. Do not use these reserved labels for commercial campaigns.
- Client event helpers rename QA activity to `qa_...` before BOTH dataLayer
  and Google tag dispatch. Thus `qa_lead_form_submit`, `qa_whatsapp_click`, etc.
  remain diagnostic events, not the configured business key events. Never mark
  QA events as key events or include them in commercial conversion totals.
- After analytics consent, one Vested-scoped sessionStorage expiry timestamp
  preserves QA status across same-tab navigation for 30 minutes of activity.
  It contains no identity, URL or form content. Decline removes it. Without
  storage/consent, classification works on the current labelled page only.
- The server independently recognizes the current Vested URL, explicit test
  labels and a strict boolean `qaTest`. QA classification changes measurement
  only; it does not bypass origin checks, validation, rate limits or SMTP.
- QA email subjects start `[QA TEST - NOT A LEAD]`, with a no-follow-up notice.
  Private demand storage rejects synthetic submissions before persistence.
  A2A questions with the same explicit test labels are excluded too.
- Daily/weekly demand reporting also rechecks explicit QA labels on older
  sanitized records, even if their original evidence flag said genuine. Old
  report files already generated are historical snapshots, not rewritten.
- Server synthetic exclusions carry a coarse traffic type; funnel reports
  exclude them by default. No new database, provider, secret or paid service.

## Genuine conversion reporting

Use `npm run report:genuine-conversions` with a privacy-safe aggregate JSON
export on stdin. This applies QA exclusions automatically, including historical
labelled events. Only this filtered result should be called genuine conversion
reporting; GA4's unfiltered All Users cards are raw diagnostics. These are
non-QA conversion signals, not independently sales-qualified customers.

Input contract (no individual users, personal details or raw requests):

```json
{
  "company": "Vested KSA",
  "propertyId": "529693438",
  "period": { "start": "2026-11-11", "end": "2026-11-11" },
  "rows": [
    { "eventName": "lead_form_submit", "eventCount": 1,
      "source": "owner_qa", "medium": "verification",
      "campaign": "vested_attribution_20261111" }
  ]
}
```

The result excludes that row. Fields `sessionSource`, `firstUserSource`,
`sessionCampaign`, `synthetic`, and `agentClass` are optional additional
exclusion evidence. Unknown/missing source attribution is reported separately
as `unattributedUnverified`, not silently counted as genuine or discarded.
Source fields must be event-scoped where available; do not relabel a session
campaign as an event campaign. Reports must state export coverage and freshness.

This script filters supplied exports; it does not configure a new GA4 API
credential or scheduled export. The existing weekly review must use these
exclusions. Old raw GA4 events are preserved, not deleted or retrospectively
rewritten. The prior unlabelled/unattributed test cannot be conclusively tied
to a specific historical conversion and remains unverified.

## Verification and rollback

Run `npm test`, `npm run validate:release`, and `npm run check:markdown`.
Tests cover browser consent, QA navigation/expiry, all six conversion names,
genuine-traffic preservation, server exclusions, company boundaries, historical
aggregate filtering and unknown-attribution handling. No live form submission
is required or authorized by these tests. Existing submission evidence is in
PR 27. Future live QA must keep using the reserved labels.

Revert this release commit and deploy the revert to roll back. No secrets,
permissions, database or AI-training controls need rollback.
