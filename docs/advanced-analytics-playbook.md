# Vested KSA Advanced Analytics Playbook

This is a non-visual operating playbook for Search Console, GA4, Vercel logs, and agent/API usage. It must stay dedicated to Vested KSA accounts and `vestedksa.com`.

## Event Contract

Use `/data/analytics-events.json` as the source of truth for event names, allowed parameters, funnel stages, and privacy rules.

Core GA4 key events:

- `lead_form_submit`
- `email_click`
- `phone_click`
- `whatsapp_click`
- `checklist_download_click`
- `language_switch_click`

Supporting events:

- `lead_form_start`
- `lead_cta_click`
- `view_key_page`
- `agent_resource_read`
- `mcp_tool_call`
- `mcp_resource_read`
- `openapi_read`
- `llms_read`
- `answer_asset_read`
- `markdown_representation_read`
- `crawler_visit`
- `inquiry_preparation`

Agent-surface events are emitted as privacy-safe JSON in Vercel runtime logs. When the Vested-only `GA4_API_SECRET` is configured, the same coarse events are also sent server-side to GA4 property `529693438` using measurement ID `G-7STG2HDV42`. The integration sends no cookies, IP addresses, full user agents, query strings, prompts, or inquiry content.

## Monthly Review

1. Search Console
   - Export queries and pages for the last 28 days.
   - Find high-impression, low-click queries.
   - Map each query to `/data/source-map.json`.
   - Improve the matching guide, answer block, or structured resource.

2. Bing Webmaster Tools and IndexNow
   - Confirm `https://vestedksa.com/sitemap.xml` is submitted in the Vested KSA Bing Webmaster Tools property.
   - Review IndexNow submission status for recent content updates.
   - Inspect the homepage, `/services`, `/insights`, and new guide URLs in Bing Webmaster Tools.
   - Use `/docs/bing-indexnow.md` for the repeatable submit and validation process.

3. GA4
   - Review traffic and leads by country, source, medium, landing page, and service interest.
   - Mark the six core conversion events as key events.
   - Segment traffic from GCC, United States, United Kingdom, China, India, Germany, and France.
   - Review language switch demand before adding more localized content.

4. Vercel Logs
   - Filter for `agent_readiness_event` and `agent_surface_event`.
   - Filter paths containing `/api/mcp`, `/llms.txt`, `/openapi.json`, `/data/`, and `/.well-known/`.
   - Count MCP tools by `event.tool`.
   - Watch for repeated non-fit traffic such as internships, vendor pitches, paid links, and spam.

5. Content Decisions
   - Create or improve one answer block per month.
   - Create or improve one guide per month from Search Console demand.
   - Add country or sector pages only after a repeatable signal appears in Search Console, GA4, or approved sales conversations.

## Privacy Rules

Do not log:

- names
- emails
- phone numbers
- ID/passport numbers
- bank data
- private inquiry messages
- confidential documents
- full user prompts

Allowed:

- page path
- broad country
- language
- service interest
- event name
- source/medium
- broad user-agent class
- MCP tool name
- route classification

## Vercel Log Filters

Use these filters in Vercel logs:

```text
agent_readiness_event
agent_surface_event
/api/mcp
/llms.txt
/openapi.json
/data/answer-engine.json
/data/source-map.json
/.well-known/
```

Useful log checks:

```text
"action":"crawler_visit"
"action":"markdown_representation_read"
"action":"llms_read"
"action":"openapi_read"
"action":"mcp_tool_call"
"action":"mcp_resource_read"
"action":"inquiry_preparation"
```

The optional `GA4_API_SECRET` must belong to the Vested KSA web stream only. Never store its value in this repository or reuse a secret from another company. Without it, Vercel runtime logging remains active and the public website behavior is unchanged.

## Search Console Checks

Inspect these URLs monthly:

- `https://vestedksa.com/`
- `https://vestedksa.com/services`
- `https://vestedksa.com/insights`
- `https://vestedksa.com/llms.txt`
- `https://vestedksa.com/openapi.json`
- `https://vestedksa.com/data/company.json`
- `https://vestedksa.com/data/answer-engine.json`
- `https://vestedksa.com/data/source-map.json`

## Bing And IndexNow Checks

Run after meaningful public content updates:

```bash
npm run indexnow:dry-run
npm run indexnow:submit
```

Then confirm receipt in Bing Webmaster Tools for the Vested KSA property only.

## Do Not Mix Accounts

Vested KSA analytics, Search Console, Vercel, GitHub, and data files must not be mixed with any other company workspace, property, or domain.
