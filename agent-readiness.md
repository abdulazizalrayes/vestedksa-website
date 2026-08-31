# Vested KSA Agent Readiness Layer

This document describes the non-visual agent, AI-crawlability, SEO/AEO/GEO, MCP, OpenAPI, and validation layer added for Vested KSA.

Do not mix this configuration with Strata Saudi, CMH, DesertScape, TICC, or any other company. Vested KSA uses `vestedksa.com`, the Vested KSA Google Analytics/Search Console properties, and Vested KSA public company/service data only.

## What Was Added

Public structured data:

- `/data/company.json`
- `/data/services.json`
- `/data/capabilities.json`
- `/data/service-areas.json`
- `/data/project-inquiry-schema.json`
- `/data/agent-routing.json`
- `/data/answer-engine.json`
- `/data/decision-trees.json`
- `/data/entity-glossary.json`
- `/data/source-map.json`
- `/data/analytics-events.json`
- `/data/agent-manifest.json`
- `/data/schema-versions.json`
- `/data/changelog.json`
- `/data/procurement-routing.json`
- `/data/agent-concierge.json`

Discovery:

- `/llms.txt`
- `/llms-full.txt`
- `/llms-full.md`
- `/.well-known/agent-card.json`
- `/.well-known/api-catalog`
- `/.well-known/api-catalog.json`
- `/.well-known/mcp.json`
- `/.well-known/mcp/server-card.json`
- `/.well-known/mcp/server-cards.json`
- `/.well-known/agent-skills/index.json`
- `/openapi.json`
- `/api/a2a`
- `/auth.md`
- `/docs/advanced-analytics-playbook.md`
- `/docs/bing-indexnow.md`

MCP/API:

- `/api/a2a` A2A 1.0 JSON-RPC endpoint for the Vested KSA Agent Concierge.
- `/api/mcp` read-only MCP-style JSON-RPC endpoint.
- `/api/contact` remains the contact endpoint, but OpenAPI and auth docs state that agents must not submit without explicit user approval.

Validation:

- `scripts/validate-agent-readiness.js`

## How The Layers Work Together

`llms.txt` is the first-page orientation file for LLM crawlers and AI assistants. It points agents to public pages, structured data, OpenAPI, MCP discovery, and routing rules.

`/data/*.json` contains stable, structured, Vested-specific facts. These files avoid unverified CR/VAT/license numbers, fake coordinates, certifications, client logos, testimonials, and case studies.

`/.well-known/agent-card.json` and `/.well-known/agent-skills/index.json` describe what agents can do with Vested KSA public information.

`/.well-known/mcp.json` and `/.well-known/mcp/server-card.json` advertise the read-only MCP endpoint.

`/api/mcp` exposes typed tools:

- `get_company_overview`
- `list_services`
- `match_project_scope`
- `prepare_project_inquiry`
- `list_service_areas`
- `read_public_resource`
- `get_answer_engine_assets`
- `get_market_entry_decision_trees`
- `get_entity_glossary`
- `get_agent_manifest`
- `match_procurement_scope`

`/api/a2a` exposes the public Vested KSA Agent Concierge using the A2A 1.0 JSON-RPC binding and the standard `SendMessage` operation. It returns a direct `ROLE_AGENT` message with cited text and/or structured JSON. The Concierge supports:

- `assess_market_entry_fit`
- `explain_vested_services`
- `compare_entry_paths`
- `build_90_day_launch_brief`
- `identify_misa_hr_tax_requirements`
- `prepare_vendor_readiness_plan`
- `prepare_project_inquiry`
- `explain_non_fit_routing`

The Concierge is deterministic and does not call a paid model. It is stateless, stores no conversation, and does not log prompts or personal information. It cannot submit forms, send email or WhatsApp, book meetings, write to CRM, or perform any contact action. Inquiry preparation produces an outline only; a later contact action remains separate and requires explicit approval of final content and destination.

## Agent Endpoint Security

Vested remains on Vercel DNS and edge hosting. Do not move the domain behind Cloudflare solely for agent rate limiting.

The Vested Vercel project has one active Hobby-compatible edge rule named `vested-agent-api-rate-limit`. It matches only `POST` requests to `/api/a2a` and `/api/mcp`, uses a fixed 60-second window keyed by source IP, permits 60 requests per window, and returns `429` after the limit. GET and HEAD discovery requests are not limited by this rule, so crawler discovery and public metadata remain available.

Both agent endpoints also enforce a 32 KiB body limit, reject non-JSON POST requests, and temporarily reject a source after five malformed, unsupported, or prompt-injection attempts within ten minutes. The application guard stores only an ephemeral salted source hash in a warm serverless instance; it does not log or persist IP addresses. Vercel's edge rule is the shared protection, while the application guard is a secondary safety brake.

Bot Protection and JavaScript challenges remain disabled because they would obstruct legitimate AI agents. The AI-bot policy remains Allow, aligned with `search=yes, ai-input=yes, ai-train=no`. Vercel's platform DDoS mitigation remains active. No Cloudflare proxy, paid WAF, database, Redis service, or managed Markdown provider is required for this deterministic read-only surface.

`/openapi.json` documents public data endpoints, MCP, and the contact endpoint.

`/auth.md` explains that public read-only endpoints require no auth, while contact submission requires explicit user approval.

## V2 Agent/API Layer

Version `2.0.0` adds:

- answer blocks and citation guidance for AEO/GEO through `/data/answer-engine.json`
- market-entry decision trees through `/data/decision-trees.json`
- canonical entity language through `/data/entity-glossary.json`
- topic-to-source mapping through `/data/source-map.json`
- privacy-safe analytics event taxonomy through `/data/analytics-events.json`
- a public agent manifest through `/data/agent-manifest.json`
- schema registry and changelog through `/data/schema-versions.json` and `/data/changelog.json`
- procurement and vendor-registration routing through `/data/procurement-routing.json`

V1 resources remain available. V2 is additive and should not break existing agents.

## MCP Safety Rules

The MCP endpoint is read-only. It does not submit forms or contact Vested KSA.

`prepare_project_inquiry` creates a draft inquiry package only. Agents must show the draft to the user and receive explicit approval before using `/api/contact` or sending email.

The routing layer must route these away from inquiry forms:

- careers
- internships
- training requests
- vendor pitches
- paid backlink offers
- retail shopping
- consumer visa requests
- spam
- unrelated requests

## Analytics And Logs

`/api/mcp` logs privacy-safe events to server logs:

- MCP metadata reads
- MCP tool lists
- MCP resource lists
- MCP resource reads
- MCP tool calls

The logs intentionally do not store names, emails, phone numbers, full prompts, or private inquiry details. They classify user agents at a broad level, such as `gptbot`, `googlebot`, `anthropic`, `perplexity`, `other-crawler`, or `browser-or-unknown`.

Static file reads such as `/llms.txt`, `/openapi.json`, and `/data/company.json` can be reviewed in Vercel access/log tooling and analytics referral reports. GA4 can be used for on-page events; server endpoint reads are best reviewed in Vercel logs unless a separate approved logging sink is added.

Suggested checks:

- Vercel logs filtered by `/api/a2a` and the coarse `a2a_*` event names.
- `npm run report:agent-funnel` for a prompt-free aggregate of fit outcomes, routes, inquiry preparation, and errors; validation probes are excluded by default.
- Vercel logs filtered by `/api/mcp`.
- Vercel logs filtered by `/llms.txt`, `/openapi.json`, and `/data/`.
- GA4 referrals containing AI tools or assistant browsers.
- Search Console pages for `/llms.txt`, `/openapi.json`, `/data/`, and guide URLs.
- `/docs/advanced-analytics-playbook.md` for the monthly operating process.
- `/docs/bing-indexnow.md` for Bing Webmaster Tools and IndexNow checks.

## Testing Commands

Run local validation:

```bash
node scripts/validate-agent-readiness.js
```

Check JSON and build:

```bash
node -e "['openapi.json','data/company.json','data/services.json','data/capabilities.json','data/service-areas.json','data/project-inquiry-schema.json','data/agent-routing.json','data/answer-engine.json','data/decision-trees.json','data/entity-glossary.json','data/source-map.json','data/analytics-events.json','data/agent-manifest.json','data/schema-versions.json','data/changelog.json','data/procurement-routing.json','.well-known/agent-card.json','.well-known/mcp.json','.well-known/mcp/server-card.json'].forEach(f=>JSON.parse(require('fs').readFileSync(f,'utf8')))"
vercel build
```

Live endpoint checks after deploy:

```bash
curl -I https://vestedksa.com/data/company.json
curl -I https://vestedksa.com/openapi.json
curl -I https://vestedksa.com/data/answer-engine.json
curl -I https://vestedksa.com/data/agent-manifest.json
curl -I https://vestedksa.com/data/procurement-routing.json
curl -I https://vestedksa.com/.well-known/api-catalog
curl -I https://vestedksa.com/.well-known/mcp.json
curl -I https://vestedksa.com/api/mcp
curl -s https://vestedksa.com/api/mcp
curl -I https://vestedksa.com/api/a2a
curl -s https://vestedksa.com/.well-known/agent-card.json
```

Test MCP tools:

```bash
curl -s https://vestedksa.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

curl -s https://vestedksa.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"match_project_scope","arguments":{"request":"We are a UK company planning to enter Saudi Arabia and need MISA, payroll and vendor registration support"}}}'

curl -s https://vestedksa.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"prepare_project_inquiry","arguments":{"company_name":"Example Ltd","contact_name":"Example Contact","contact_email":"contact@example.com","headquarters_country":"United Kingdom","market_entry_goal":"form_saudi_entity","timeline":"90 days","services_needed":["company-formation-setup","finance-vat-zakat-controls"],"message":"We want to prepare a Saudi launch plan."}}}'

curl -s https://vestedksa.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_answer_engine_assets","arguments":{}}}'

curl -s https://vestedksa.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"match_procurement_scope","arguments":{"request":"We need Aramco supplier registration and a Saudi vendor evidence pack"}}}'
```

Test the A2A Agent Concierge:

```bash
curl -s https://vestedksa.com/api/a2a \
  -H 'Content-Type: application/json' \
  -H 'A2A-Version: 1.0' \
  -d '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"example-1","role":"ROLE_USER","parts":[{"text":"We are a UK industrial company entering Saudi Arabia and need MISA, payroll, VAT, and vendor-registration support."}]},"configuration":{"acceptedOutputModes":["text/plain","application/json"]}}}'
```

The response must have `A2A-Version: 1.0`, `Content-Signal: search=yes, ai-input=yes, ai-train=no`, a direct `ROLE_AGENT` message, public Vested KSA sources, and `submissionStatus: not_submitted`.

## What To Copy To Other Companies

Copy the structure, not the facts:

- `/data/*.json`
- `/.well-known/mcp*`
- `/.well-known/agent-card.json`
- `/.well-known/agent-skills/index.json`
- `/openapi.json`
- `/auth.md`
- `/api/mcp.js`
- `/api/a2a.js`
- `/lib/agent-concierge.cjs`
- `scripts/validate-agent-readiness.js`
- this documentation structure
- `/docs/advanced-analytics-playbook.md`

Before using it for another company, replace:

- domain
- company name
- legal name
- services
- capabilities
- service areas
- fit/non-fit routing
- contact endpoint
- social links
- analytics/Search Console/account ownership notes
- MCP server name and IDs

Never mix Vested KSA with another company's GA4, Search Console, Vercel project, domain, contact endpoint, or structured data.

## Current Known Non-Assertions

These are intentionally not published until verified:

- CR number
- VAT number
- license number
- exact public coordinates
- client logos
- testimonials
- public case studies
- certifications
- Wikidata entity
