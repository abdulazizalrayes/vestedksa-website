# Vested KSA Markdown-for-Agents Layer

## Identity Lock

- Company: Vested KSA
- Legal or operating name: Vest KSA Co.
- Workspace: `/Users/abdulazizalrayes/Documents/New project/vestedksa-website`
- Repository: `https://github.com/abdulazizalrayes/vestedksa-website.git`
- Canonical domain: `https://vestedksa.com`
- Vercel project: `project-ivd9v`
- Vercel project ID: `prj_Qf4Ef3S8n0cNveCoRoqw2br1SAmC`
- Vercel team ID: `team_AnOdxEeUwCwUtPdqTk5I1Dkt`
- Excluded accounts: all non-Vested company workspaces, repositories, domains, analytics properties, Vercel projects, Paperclip spaces, and credentials.

## Owner Policy

The owner confirmed this Vested KSA public content policy on 2026-07-20 and reconfirmed it on 2026-08-21:

```text
search=yes, ai-input=yes, ai-train=no
```

The equivalent live HTTP header and `robots.txt` crawler guidance are:

```text
Content-Signal: search=yes, ai-input=yes, ai-train=no
```

This means public search crawling is allowed, AI assistants may use public page content as input for answering and citation, and AI training use is not approved.

## What Was Added

- `markdown/*.md`: deterministic Markdown companions for canonical, indexable HTML sitemap pages.
- `markdown/manifest.json`: canonical URL to Markdown sidecar inventory.
- `markdown-routes.ts`: generated route map consumed by Vercel Routing Middleware.
- `middleware.ts`: performs standards-correct `Accept` negotiation, advertises clean Markdown alternates, and rewrites eligible requests.
- `api/markdown.js`: serves Markdown with canonical, language, location, vary, and content policy headers.
- `lib/markdown-negotiation.mjs`: shared Accept-header parsing and route resolution.
- `.well-known/ai-catalog.json`: static Agentic Resource Discovery catalog for the public MCP, OpenAPI, agent skills, and API catalog.
- `scripts/generate-markdown-companions.mjs`: structured parser generator with `--check` mode.
- `scripts/validate-markdown-layer.mjs`: repeatable local validation.
- Discovery updates in `llms.txt`, `llms-full.txt`, `.well-known/*`, `openapi.json`, and `vercel.json`.

The ARD catalog is a non-executable discovery document. It does not add authentication, browser-side tools, commerce, agent registration, or permission to contact Vested KSA. OAuth metadata is intentionally absent because Vested KSA has no protected public API or OAuth issuer. WebMCP and DNS-AID are intentionally not enabled while the public read-only MCP and HTTPS discovery layer already cover the business need and those additional surfaces would add unnecessary runtime or DNS obligations.

## How It Works

Canonical browser URLs remain the source of truth. A normal browser request receives the existing HTML. An agent can request the same URL with:

```bash
curl -H 'Accept: text/markdown' https://vestedksa.com/services
```

If a generated Markdown companion exists, middleware rewrites the request to `/api/markdown?path=/services`. The API reads the sidecar and returns:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept`
- `Content-Location: /services.md`
- `Content-Language: en`
- `Link: <https://vestedksa.com/services>; rel="canonical"`
- `Content-Signal: search=yes, ai-input=yes, ai-train=no`

Canonical HTML and HEAD responses advertise the page-specific companion:

```text
Link: <https://vestedksa.com/services.md>; rel="alternate"; type="text/markdown"
Vary: Accept
```

Clean direct companions such as `/services.md` are public and return `X-Robots-Tag: noindex, follow` so they do not compete with canonical HTML pages in search. Legacy `/markdown/services.md` URLs remain available with the same noindex policy for compatibility.

### Accept Negotiation

- Missing, unknown, or ambiguous `Accept` headers default to HTML.
- `text/markdown`, `text/html`, `text/*`, and `*/*` are supported.
- The higher effective `q` value wins.
- A more specific media range determines the effective quality for a representation.
- Equal explicit HTML and Markdown preferences default to HTML.
- A representation with effective `q=0` is never selected.
- If both HTML and Markdown are explicitly unacceptable, the canonical URL returns `406 Not Acceptable`.
- If a Markdown companion is unavailable, the request continues to ordinary HTML.

## Generation Rules

The generator reads `sitemap.xml` and includes only URLs that:

- Resolve to a local HTML file.
- Have a matching canonical URL.
- Are not marked `noindex`.

The HTML conversion uses `parse5`, a structured HTML parser. It extracts public main content, preferring `<main>` when available. It excludes navigation, footers, forms, scripts, styles, hidden content, cookie notices, skip links, admin material, and internal notes.

Preserved fields include page title, description, canonical URL, language, public links, meaningful image alt text, headings, lists, tables, details, and relevant public JSON-LD.

## Enhanced Markdown Shape

Each companion now includes:

- YAML-style front matter with `title`, `description`, `canonical`, `language`, `content_signal`, `source_html`, `direct_markdown`, `markdown_sidecar`, and `alternate_languages`.
- A `Page Metadata` section for canonical URL, language, source HTML, clean Markdown URL, legacy sidecar path, and hreflang alternates.
- A `Main Content` section with body headings shifted below the generated page title.
- A `Public Page Resources` section with visible public links and meaningful images extracted from the page content.
- A `Public Structured Data` section with valid JSON-LD blocks.

The generator drops decorative navigation, mobile menus, eyebrow labels, cookie/skip elements, forms, scripts, styles, and visual-only counters such as card numbers. Standalone CTA anchors are rendered as Markdown links, while direct sidecars remain `noindex, follow`.

## Testing Commands

```bash
npm run generate:markdown
npm test
npm run check:markdown
npm run validate:markdown-layer
npm run validate:agent-readiness
npm audit
vercel build --prod
npm run validate:deployment-output
npm run validate:live
```

The deployment-output check must run after the Vercel build. It rejects Finder-style suffixed copies, private key/environment files, internal repository files in the public static tree, missing canonical public data, and incomplete Markdown sidecar coverage. The live check runs after deployment and audits every canonical HTML/Markdown representation, sidecar, multilingual header, discovery resource, MCP safeguard, and known duplicate-file path.

Live production checks after deployment:

```bash
curl -sSI https://vestedksa.com/services
curl -sSI -H 'Accept: text/markdown' https://vestedksa.com/services
curl -sSI -H 'Accept: text/html;q=1, text/markdown;q=0.2' https://vestedksa.com/services
curl -sSI -H 'Accept: text/html;q=0.2, text/markdown;q=1' https://vestedksa.com/services
curl -sSI -H 'Accept: text/html, text/markdown' https://vestedksa.com/services
curl -sSI -H 'Accept: text/markdown;q=0, text/html' https://vestedksa.com/services
curl -sSI https://vestedksa.com/services.md
curl -sSI https://vestedksa.com/markdown/services.md
curl -sS https://vestedksa.com/markdown/manifest.json
```

## Copying to Other Companies

Copy the generator, middleware/API pattern, validation script, and documentation structure only after replacing:

- Company identity.
- Canonical domain.
- Repository and hosting IDs.
- Content-Signal policy.
- Sitemap and canonical URL rules.
- Discovery URLs.
- Account ownership notes.

Never copy Vested KSA legal names, social profiles, analytics IDs, proof claims, routing rules, or content policy into another company.

## Cost

The layer uses the existing Vercel project, static files, one lightweight middleware, and one serverless read endpoint. No paid provider or paid backlink/tool was introduced.

## Rollback

Rollback can be done by reverting the Markdown-layer commit and redeploying the previous production commit, or by removing `middleware.ts` from the deployment. Direct sidecars are noindex and safe to leave temporarily during rollback, but removing middleware immediately restores all canonical URL behavior to HTML-only.

## Release Record

- Implemented: 2026-07-20
- Branch: `codex/vested-markdown-agents-layer`
- Source commits: `08b647b`, `a2d4bab`, `0e1e357`
- Production deployment: `dpl_D39UvUiKSYw1zJ624tcawY7ZQVTd`
- Production alias: `https://vestedksa.com`
- Vercel project: `project-ivd9v`
- Cost: free, using the existing Vercel project and no paid provider.
- Visual impact: none. HTML source hashes for canonical HTML pages were unchanged before deployment.

### 2026-07-29 Negotiation Hardening

- Implementation commits: `a2d728e`, `5e58ea2`
- Validated production deployment: `dpl_87FMyqfXKRBA32kxRhSnQZ1hFjgY`
- Authenticated preview deployment: `dpl_Hwz7BKMNAYDS1A3Y7S8xx3LDytKn`
- Production alias: `https://vestedksa.com`
- Content policy: `search=yes, ai-input=yes, ai-train=no`
- Scope: standards-correct Accept negotiation, clean direct `.md` URLs, canonical HTML/HEAD alternate links, complete direct response headers, and expanded regression tests.
- Rollback target: `dpl_3r4HXdSiKhfxtDMQswe31GT8Euyc`
- Cost: free, using the existing Vercel Hobby project and no managed Markdown provider.
- Visual impact: none. All 20 canonical HTML source files remained byte-identical.

Production evidence:

- Canonical HTML: 20/20.
- Negotiated Markdown: 20/20.
- Clean direct Markdown: 20/20.
- Legacy sidecar compatibility: 20/20.
- HTML and Markdown HEAD behavior: 20/20.
- Data resources: 15/15.
- Discovery resources: 8/8.
- Accept matrix: exact types, stronger quality values, equal explicit preference, q=0 exclusion, wildcard ties, wildcard specificity, and 406 handling passed.
- Multilingual headers: English, Arabic, and Simplified Chinese passed.
- Failures: 0.
- Aggregate response bytes: 459,913 HTML; 166,273 Markdown.
- Aggregate Markdown response-size reduction: 63.8%.

## Verification Evidence

Pre-deployment checks:

- `npm run validate:markdown-layer` passed for 20 canonical HTML sitemap pages.
- `npm run validate:agent-readiness` passed.
- `npm audit` passed with 0 vulnerabilities.
- `vercel build --prod` completed successfully.
- Vercel build inventory contained 20 Markdown sidecars and no suffixed duplicate, README, CLAUDE, script, preview, or `node_modules` files.

Production checks after deployment:

- Canonical HTML coverage: 20/20 pages returned HTML for ordinary `text/html` requests.
- Negotiated Markdown coverage: 20/20 pages returned Markdown for `Accept: text/markdown`.
- `q=0` fallback: 20/20 pages returned HTML for `Accept: text/markdown;q=0`.
- Direct sidecars: 20/20 returned `Content-Type: text/markdown; charset=utf-8`.
- Direct sidecars: 20/20 returned `X-Robots-Tag: noindex, follow`.
- Multilingual headers: `/ar` returned `Content-Language: ar`; `/zh` returned `Content-Language: zh-Hans`.
- Total HTML bytes tested: 459,534.
- Total Markdown bytes tested: 143,740.
- Aggregate Markdown size reduction: 68.7%.
- Failures: 0.

## Paperclip Record Status

- Verified through the authenticated Vested KSA (`VES`) workspace on 2026-07-20.
- Paperclip version: `v2026.707.0+1.git.37ce78cba`.
- OpenCode models visible in the live selector: `opencode/big-pickle`, `opencode/deepseek-v4-flash-free`, `opencode/hy3-free`, `opencode/mimo-v2.5-free`, `opencode/nemotron-3-ultra-free`, and `opencode/north-mini-code-free`.
- Vested CEO configuration: `opencode/big-pickle` primary with `opencode/deepseek-v4-flash-free` as the cheap-model fallback. No model change was required.
- Durable Paperclip task: `VES-406` (`Markdown-for-agents production release 2026-07-20`), status `Done`.
- No non-Vested Paperclip company, issue, agent, run, or workspace was changed.
