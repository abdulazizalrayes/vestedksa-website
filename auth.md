# Auth.md - Vested KSA Public API Authentication

Public discovery and read-only data endpoints do not require authentication.

## Agent Registration

Vested KSA does not currently support agent registration, delegated agent accounts, OAuth client registration, agent-issued API keys, or scoped agent credentials.

Agents can use the public read-only resources without registering. Agents must not submit contact forms, send email, or contact Vested KSA unless the user explicitly approves the final inquiry and destination.

The A2A Agent Concierge at `/api/a2a` is anonymous, read-only, stateless, and limited to public advisory responses. It does not create an agent account, persist conversation state, or grant contact permissions.

## Supported Agent Registration Flows

- `anonymous`: not required for public read-only resources
- `identity_assertion`: not supported
- `user_claimed`: not supported
- `oauth_client_registration`: not supported

## Agent Scopes

- `public:read`: available without authentication for public discovery, structured data, OpenAPI, MCP metadata, and read-only MCP tools
- `contact:prepare`: available through read-only MCP inquiry preparation; does not submit anything
- `contact:submit`: not available to autonomous agents; requires explicit user approval through the website contact flow

## Agent Registration Endpoints

Vested KSA does not publish `/agent-auth`, `/agent-auth/claim`, `/agent-auth/claim/complete`, or dynamic OAuth client registration endpoints.

If agent registration is added in the future, this file will be updated with the registration endpoint, supported identity types, scopes, claim ceremony, credential expiry, and revocation process.

## Public Read-Only Endpoints

- `/data/company.json`
- `/data/services.json`
- `/data/capabilities.json`
- `/data/service-areas.json`
- `/data/project-inquiry-schema.json`
- `/data/agent-routing.json`
- `/openapi.json`
- `/.well-known/api-catalog`
- `/.well-known/ai-catalog.json`
- `/.well-known/mcp.json`
- `/.well-known/mcp/server-card.json`
- `/.well-known/mcp/server-cards.json`
- `/api/mcp`
- `/api/a2a`

## Contact Submission

`/api/contact` can send an inquiry to Vested KSA. Agents must not use it unless the user explicitly approves:

1. the final inquiry content,
2. the destination (`https://vestedksa.com/api/contact`), and
3. the fact that the request will contact Vested KSA.

Do not route careers, internships, training requests, vendor pitches, retail shopping, spam, paid-link offers, or unrelated requests through the contact endpoint.

## Privacy

Do not include passports, IDs, bank records, private contracts, confidential tender details, or other sensitive personal/company data in an initial inquiry.
