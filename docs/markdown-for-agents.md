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

The public content policy is the Vested KSA policy already declared in `robots.txt`:

```text
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

This means public search crawling is allowed, AI assistants may use public page content as input for answering and citation, and AI training use is not approved.

## What Was Added

- `markdown/*.md`: deterministic Markdown companions for canonical, indexable HTML sitemap pages.
- `markdown/manifest.json`: canonical URL to Markdown sidecar inventory.
- `markdown-routes.ts`: generated route map consumed by Vercel Routing Middleware.
- `middleware.ts`: checks `Accept` headers and rewrites eligible Markdown requests.
- `api/markdown.js`: serves Markdown with canonical, language, location, vary, and content policy headers.
- `lib/markdown-negotiation.mjs`: shared Accept-header parsing and route resolution.
- `scripts/generate-markdown-companions.mjs`: structured parser generator with `--check` mode.
- `scripts/validate-markdown-layer.mjs`: repeatable local validation.
- Discovery updates in `llms.txt`, `llms-full.txt`, `.well-known/*`, `openapi.json`, and `vercel.json`.

## How It Works

Canonical browser URLs remain the source of truth. A normal browser request receives the existing HTML. An agent can request the same URL with:

```bash
curl -H 'Accept: text/markdown' https://vestedksa.com/services
```

If a generated Markdown companion exists, middleware rewrites the request to `/api/markdown?path=/services`. The API reads the sidecar and returns:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept`
- `Content-Location: /markdown/services.md`
- `Content-Language: en`
- `Link: <https://vestedksa.com/services>; rel="canonical"`
- `Content-Signal: ai-train=no, search=yes, ai-input=yes`

Direct sidecars such as `/markdown/services.md` are also public, but return `X-Robots-Tag: noindex, follow` so they do not compete with canonical HTML pages in search.

## Generation Rules

The generator reads `sitemap.xml` and includes only URLs that:

- Resolve to a local HTML file.
- Have a matching canonical URL.
- Are not marked `noindex`.

The HTML conversion uses `parse5`, a structured HTML parser. It extracts public main content, preferring `<main>` when available. It excludes navigation, footers, forms, scripts, styles, hidden content, cookie notices, skip links, admin material, and internal notes.

Preserved fields include page title, description, canonical URL, language, public links, meaningful image alt text, headings, lists, tables, details, and relevant public JSON-LD.

## Testing Commands

```bash
npm run generate:markdown
npm run check:markdown
npm run validate:markdown-layer
npm run validate:agent-readiness
npm audit
vercel build
```

Live production checks after deployment:

```bash
curl -sSI https://vestedksa.com/services
curl -sSI -H 'Accept: text/markdown' https://vestedksa.com/services
curl -sSI -H 'Accept: text/markdown;q=0' https://vestedksa.com/services
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
- Source commit: `08b647b` (`Add Markdown-for-agents layer`)
- Production deployment: `dpl_H7JX4MEfdGh3hxosfZ2qgbzZ9ybP`
- Production alias: `https://vestedksa.com`
- Vercel project: `project-ivd9v`
- Cost: free, using the existing Vercel project and no paid provider.
- Visual impact: none. HTML source hashes for canonical HTML pages were unchanged before deployment.

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

Cloud Paperclip at `https://ai.eijarat.com/api/health` redirected to Cloudflare Access from the shell, so live Paperclip health, version, model inventory, and issue write access could not be verified without authenticated access. No Paperclip company, issue, agent, run, or workspace was changed. This file is the durable Vested-side release record until an authenticated Paperclip session is available.
