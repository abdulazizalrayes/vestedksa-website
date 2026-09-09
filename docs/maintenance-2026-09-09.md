# Vested maintenance verification

Company: Vested KSA. Repository: abdulazizalrayes/vestedksa-website. Vercel: project-ivd9v, prj_Qf4Ef3S8n0cNveCoRoqw2br1SAmC. Production: https://vestedksa.com.

## Completed checks

- Live Chrome checks at 1440 and 390 pixels on /, /contact, /ar and /zh: no CSP violations, broken images or horizontal overflow.
- Analytics scripts absent before consent and present after acceptance. Synthetic collection requests intercepted locally.
- Contact POST intercepted locally with a simulated 503; truthful error displayed and button re-enabled. No actual inquiry sent.
- WhatsApp destinations identify Vested KSA in all checked languages.
- 58 unit tests and full release validation passed.
- Vercel production build passed with Node middleware and CommonJS negotiation implementation. ESM consumers retain a small re-export wrapper.
- No HTML content changes.

## Production gate

Runtime migration is NOT deployed. Vercel rejected the preview with api-deployments-free-per-day: more than 100 deployments; retry after 24 hours. Do not merge until a preview proves runtime loading, HTML, Markdown, HEAD, q-values and API pass-through. Existing production remains dpl_4oCETKYSVz61B36rhRiQLVeCf9hr.

After quota resets: deploy this branch to preview, run endpoint checks, then merge and promote only the passing deployment. Run npm run validate:live against production. Roll back with vercel rollback dpl_4oCETKYSVz61B36rhRiQLVeCf9hr if necessary.

## Paperclip

Authenticated Vested dashboard inspected. Running branch deployment/v2026.831.1-cloud-models-20260904, commit 0a47a1a72af0e1a9092b85de708c06ad4454dae6. 28 idle agents, zero current agent errors, zero blocked tasks, 56 open tasks, one in progress, two pending approvals. These are operational counts, not proof that every agent can execute.

Live selector advertises big-pickle, ling-3.0-flash-fin-free, mimo-v2.5-free, muse-spark-1.2-contributor-free, muse-spark-1.3-contributor-free, nemotron-3-ultra-free and nemotron-3.5-lightning-free. Intended deepseek-v4-flash-free helper absent. No model substitutions made. Provider replacement requires owner choice under the standing policy.

Owner login authorization recorded in CLAUDE.md. Existing authenticated Chrome session used; no email code required or retained. Direct health navigation blocked by browser tooling; release verified through authenticated account menu and VES app surfaces.

No paid services or plan changes.
