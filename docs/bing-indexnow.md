# Vested KSA Bing And IndexNow Operations

## Identity Lock

- Company: Vested KSA
- Domain: `https://vestedksa.com`
- Canonical host: `vestedksa.com`
- Sitemap: `https://vestedksa.com/sitemap.xml`
- Robots: `https://vestedksa.com/robots.txt`
- IndexNow key file: `https://vestedksa.com/29b92482-dc1f-4e7d-8184-cf3de5f9937e.txt`
- Do not mix this with another company's Bing Webmaster Tools account, sitemap, key, repository, or Vercel project.

## Current Public Setup

Vested KSA uses a root-hosted IndexNow key file. The file name matches the key value, and the file content is the same key:

```text
29b92482-dc1f-4e7d-8184-cf3de5f9937e
```

The root `robots.txt` allows normal crawling, blocks private/admin/internal paths, and points crawlers to the canonical sitemap.

## How To Submit Updated URLs

Preview the exact IndexNow payload without notifying search engines:

```bash
npm run indexnow:dry-run
```

Submit the canonical sitemap URLs to IndexNow:

```bash
npm run indexnow:submit
```

Run this after meaningful public content changes, new guide launches, sitemap updates, or redirect cleanup. Do not use it for private/admin URLs, form endpoints, drafts, duplicate Markdown sidecars, or unrelated company domains.

## Bing Webmaster Tools Checks

These checks require the owner-controlled Vested KSA Bing Webmaster Tools property:

- Verify `https://vestedksa.com` is added and verified.
- Submit `https://vestedksa.com/sitemap.xml`.
- Confirm IndexNow submissions appear in Bing Webmaster Tools.
- Inspect the homepage, `/services`, `/insights`, and new insight pages.
- Review crawl errors for blocked resources, unexpected redirects, duplicate pages, and pages excluded by `noindex`.

Public checks available without account access:

```bash
curl -I https://vestedksa.com/robots.txt
curl -I https://vestedksa.com/sitemap.xml
curl -I https://vestedksa.com/29b92482-dc1f-4e7d-8184-cf3de5f9937e.txt
```

## Policy

IndexNow helps participating search engines discover updated URLs faster. It does not guarantee crawling, indexing, ranking, or AI citation.

Do not use Google's Indexing API for ordinary Vested KSA webpages. Use Search Console sitemap submission and URL Inspection for Google.
