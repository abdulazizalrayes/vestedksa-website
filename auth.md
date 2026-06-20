# Vested KSA Public API Authentication

Public discovery and read-only data endpoints do not require authentication.

## Public Read-Only Endpoints

- `/data/company.json`
- `/data/services.json`
- `/data/capabilities.json`
- `/data/service-areas.json`
- `/data/project-inquiry-schema.json`
- `/data/agent-routing.json`
- `/openapi.json`
- `/.well-known/api-catalog`
- `/.well-known/mcp.json`
- `/.well-known/mcp/server-card.json`
- `/.well-known/mcp/server-cards.json`
- `/api/mcp`

## Contact Submission

`/api/contact` can send an inquiry to Vested KSA. Agents must not use it unless the user explicitly approves:

1. the final inquiry content,
2. the destination (`https://vestedksa.com/api/contact`), and
3. the fact that the request will contact Vested KSA.

Do not route careers, internships, training requests, vendor pitches, retail shopping, spam, paid-link offers, or unrelated requests through the contact endpoint.

## Privacy

Do not include passports, IDs, bank records, private contracts, confidential tender details, or other sensitive personal/company data in an initial inquiry.
