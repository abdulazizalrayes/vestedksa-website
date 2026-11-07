# Vested KSA crawler policy

Reviewed 2026-11-07. Company: Vested KSA; domain https://vestedksa.com;
repository abdulazizalrayes/vestedksa-website; Vercel project
prj_Qf4Ef3S8n0cNveCoRoqw2br1SAmC. No visual, DNS, WAF or account changes.

Owner policy: search=yes, ai-input=yes, ai-train=no. It remains published in
robots.txt and response headers. Training permission is not granted.

## Retrieval and training separation

- OpenAI: OAI-SearchBot and ChatGPT-User allowed; GPTBot blocked.
- Anthropic: Claude-SearchBot and Claude-User allowed; ClaudeBot blocked.
- Google: Googlebot allowed. Google-Extended remains blocked: its control
  combines future Gemini training with some Gemini/Vertex grounding uses.
  Google Search inclusion is not disabled by this opt-out.
- Kimi: Kimi-SearchBot and Kimi-User allowed; KimiBot blocked.
- Meta: meta-webindexer and meta-externalfetcher allowed, as are link previews
  through facebookexternalhit; meta-externalagent blocked because it includes
  foundation-model training. Muse is a product name, not an invented bot token.
- Apple: Applebot allowed; Applebot-Extended training use blocked.
- Bing and Perplexity retrieval remain allowed.
- DeepSeek: official Search/Fetch documentation reviewed, but no separate
  search-only crawler token was verified. Public requests remain allowed by
  the wildcard, subject to the no-training policy. Do not invent bot identities
  or claim a request from our test runner proves a real DeepSeek crawl.
- Jev: TypeSafe's model is not itself a verified standalone crawler. Likewise,
  do not invent a Dot user agent for OpenAI dots. Their actual retrieval clients
  can use the public wildcard or documented provider retrieval identities.

Every specific retrieval group repeats all private exclusions; it does not
inherit restrictions from the wildcard group. Private routes still require
real authentication. robots.txt is not access control.

## Limitations

These directives express permissions to compliant providers, not a technical
guarantee against copying, spoofing or unauthorized training. Content-Signal
support varies. Meta documents that user-triggered fetches may bypass robots
and may support evaluation/improvement of agentic capabilities. Therefore we
cannot promise that all allowed retrieval content has no downstream reuse.
No firewall allowlist based only on a spoofable User-Agent was added.
Access permission is not proof of indexing, citations, ranking or real visits.

## Verification and rollback

Run npm run validate:release and npm run validate:live. The crawler-policy unit
tests use robots-parser against every sitemap URL, private paths, and training
controls, including the Applebot/Applebot-Extended specificity case.
The live validator checks the deployed robots policy for 14 documented
retrieval identities and nine training controls, runs 42 simulated crawler
requests, and checks all canonical HTML pages for noindex, nosnippet, none and
max-snippet:0 barriers in parsed meta tags and response headers. Training-only
scoped restrictions are not treated as search failures. Requests have bounded
timeouts and are labelled Vested-Validation. This runs on demand, not a new
scheduled service; unit regressions run in the existing release CI.
HTTP smoke checks using crawler User-Agent strings test this network vantage
only, not provider-origin connectivity. Verify the deployed robots bytes and
Content-Signal after deployment. Revert the crawler-policy release commit or
restore the prior Vercel deployment to roll back. Public HTML is unchanged.

## Primary references

- https://developers.openai.com/api/docs/bots
- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
- https://www.kimi.ai/policies/kimi-crawlers
- https://developers.facebook.com/docs/sharing/webmasters/crawler
- https://support.apple.com/en-us/119829
- https://api-docs.deepseek.com/guides/search/
- https://typesafe.ai/
- https://openai.com/index/introducing-dots/
