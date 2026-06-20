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
- `/auth.md`

MCP/API:

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

`/openapi.json` documents public data endpoints, MCP, and the contact endpoint.

`/auth.md` explains that public read-only endpoints require no auth, while contact submission requires explicit user approval.

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

- Vercel logs filtered by `/api/mcp`.
- Vercel logs filtered by `/llms.txt`, `/openapi.json`, and `/data/`.
- GA4 referrals containing AI tools or assistant browsers.
- Search Console pages for `/llms.txt`, `/openapi.json`, `/data/`, and guide URLs.

## Testing Commands

Run local validation:

```bash
node scripts/validate-agent-readiness.js
```

Check JSON and build:

```bash
node -e "['openapi.json','data/company.json','data/services.json','data/capabilities.json','data/service-areas.json','data/project-inquiry-schema.json','data/agent-routing.json','.well-known/agent-card.json','.well-known/mcp.json','.well-known/mcp/server-card.json'].forEach(f=>JSON.parse(require('fs').readFileSync(f,'utf8')))"
vercel build
```

Live endpoint checks after deploy:

```bash
curl -I https://vestedksa.com/data/company.json
curl -I https://vestedksa.com/openapi.json
curl -I https://vestedksa.com/.well-known/api-catalog
curl -I https://vestedksa.com/.well-known/mcp.json
curl -I https://vestedksa.com/api/mcp
curl -s https://vestedksa.com/api/mcp
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
```

## What To Copy To Other Companies

Copy the structure, not the facts:

- `/data/*.json`
- `/.well-known/mcp*`
- `/.well-known/agent-card.json`
- `/.well-known/agent-skills/index.json`
- `/openapi.json`
- `/auth.md`
- `/api/mcp.js`
- `scripts/validate-agent-readiness.js`
- this documentation structure

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
