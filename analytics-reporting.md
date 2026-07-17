# Vested KSA Analytics Reporting

Monthly review owner: Vested KSA marketing/operations

## Primary Business Questions

1. Which countries are sending qualified market-entry traffic?
2. Which service pages and guide topics create contact intent?
3. Which languages are being used or requested?
4. Where do visitors leave before contacting Vested KSA?

## GA4 Key Events

Mark these events as key events in GA4 Admin:

- `lead_form_submit`
- `email_click`
- `checklist_download_click`
- `language_switch_click`

Track as supporting events:

- `lead_form_start`
- `lead_cta_click`
- `view_key_page`
- `cookie_consent_update`

## Monthly Dashboard Views

Review these dimensions and metrics every month:

- Traffic by country, city, source, medium, and landing page.
- Leads by country, service interest, source, medium, and landing page.
- Language switch clicks by `from_locale`, `to_locale`, and `page_path`.
- Checklist downloads by page path and source.
- Email clicks and contact-form starts compared with successful submissions.
- Search Console queries, impressions, clicks, average position, and indexed pages.
- Vercel log hits for `/llms.txt`, `/openapi.json`, `/data/`, `/.well-known/`, and `/api/mcp`.
- MCP tool-call counts by tool name from privacy-safe server logs.

## Recommended Segments

- Saudi market-entry intent: visitors landing on `/services`, `/why-saudi`, `/faq`, or any `/insights/` guide.
- Conversion intent: visitors with `lead_cta_click`, `lead_form_start`, `email_click`, or `checklist_download_click`.
- Language demand: visitors with `language_switch_click`, grouped by destination language and country.
- High-value geography: traffic and leads from GCC, United States, United Kingdom, China, India, Germany, and France.

## Monthly Actions

- Add or improve one guide for a high-impression, low-click Search Console query.
- Improve one page with high contact-form starts but low submissions.
- Review country and language demand before adding more localized content.
- Check that the sitemap is submitted and key pages remain indexed in Search Console.
- Confirm the top lead sources are represented in next month's content and outreach plan.
- Review Vercel logs for AI crawler/resource reads and MCP usage.
- Run `node scripts/validate-agent-readiness.js` after major content or routing updates.
- Review `/data/analytics-events.json` for the approved event taxonomy before adding or renaming events.
- Review `/docs/advanced-analytics-playbook.md` during monthly Search Console and GA4 reporting.

## Agent And AI Referral Checks

Use these operational checks until a dedicated approved logging sink is added:

- Vercel logs containing `agent_readiness_event`.
- Vercel logs where path contains `/api/mcp`.
- Vercel logs where path contains `/llms.txt`, `/openapi.json`, `/data/`, or `/.well-known/`.
- Vercel logs where path contains `/data/answer-engine.json`, `/data/source-map.json`, `/data/agent-manifest.json`, or `/data/procurement-routing.json`.
- GA4 referral/source reports for AI assistants and agent browsers.
- Search Console URL inspection for `llms.txt`, `openapi.json`, `/data/company.json`, and guide pages.

Do not log full prompts, personal information, private inquiry details, IDs, bank data, passports, or confidential documents.
