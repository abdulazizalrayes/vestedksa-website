# Contact campaign attribution

Scope: Vested KSA only, GA4 property 529693438, measurement ID G-7STG2HDV42.

Contact `lead_form_start` and `lead_form_submit` now carry explicit event-level
`campaign_source`, `campaign_medium` and `campaign_name` from the current page's
UTM labels, and an explicit Vested `send_to`. Labels must be unique per key,
1-100 ASCII letters/digits/underscore/hyphen, start with a letter, and contain
no run of nine digits. Invalid or missing labels are omitted, not invented.
Do not put personal information in campaign labels. No arbitrary query string,
form text, new cookies or new storage is added by this change.

This is a forward-looking attribution hardening, not a proven root-cause repair
for the existing QA event. Google's session campaign can differ from event
campaign when a tagged URL is opened during an existing session. This change
does not reset sessions, override an existing session campaign, or backfill
historical GA4 records. It preserves native GA attribution for untagged pages.

## Evidence and limitations (11 November 2026)

- Cloud production inspected: dpl_GQBBNsTyafyQDz6KQnppdz8vmFGg, READY.
- Baseline source: 7849633a28fa4845d4421fca7d1d9552aeac9f2a.
- Existing test inbox delivery had already been verified exactly once.
- Exact GA4 property showed one `lead_form_submit` on 11 November; its session
  campaign was `(not set)`. This does not conclusively identify that event as
  the approved synthetic test or prove a website defect.
- The published GTM container had no tags, ruling out a duplicate GTM event tag
  in the inspected version. Browser consent and the measurement ID were unchanged.
- Offline tests reuse the existing test's non-personal campaign labels
  (`owner_qa`, `verification`, `vested_delivery_20261111`). Google calls are mocked;
  no form is posted, no inbox message is generated, and no GA event is replayed.
- Actual receipt of the new parameters remains untested until a future
  consented event. Do not call this offline test a production conversion.

Run `node --test test/contact-attribution.test.mjs` and `npm run validate:release`.
The live production check must compare the deployed contact script against the
tested source without submitting a form. No visible markup/CSS/copy, contact
delivery, robots or Content-Signal policy is changed.

Reference: https://support.google.com/analytics/answer/11242841
Configuration fields: https://developers.google.com/analytics/devguides/collection/ga4/reference/config

Rollback: revert this attribution commit and deploy the revert through the
existing Vested Git integration. Do not restore or replay analytics events.
