import { next, rewrite } from '@vercel/functions';
import {
  htmlRepresentationHeaders,
  resolveDirectMarkdownEntry,
  resolveMarkdownEntry,
  resolveSidecarEntry,
  selectRepresentation,
} from './lib/markdown-negotiation.mjs';
import { MARKDOWN_ROUTES } from './markdown-routes';

const manifest = {
  entries: MARKDOWN_ROUTES,
};

export const config = {
  matcher: [
    '/',
    '/ar',
    '/zh',
    '/about',
    '/services',
    '/why-saudi',
    '/ethics',
    '/insights',
    '/insights/:path*',
    '/faq',
    '/contact',
    '/privacy',
    '/terms',
    '/index.md',
    '/ar.md',
    '/zh.md',
    '/about.md',
    '/services.md',
    '/why-saudi.md',
    '/ethics.md',
    '/insights.md',
    '/faq.md',
    '/contact.md',
    '/privacy.md',
    '/terms.md',
    '/markdown/:path*',
  ],
};

const ROOT_DISCOVERY_LINKS = [
  '</llms.txt>; rel="alternate"; type="text/markdown"',
  '</llms-full.md>; rel="alternate"; type="text/markdown"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</.well-known/api-catalog>; rel="service-desc"; type="application/linkset+json"',
  '</.well-known/mcp.json>; rel="mcp-discovery"; type="application/json"',
  '</.well-known/agent-card.json>; rel="agent-card"; type="application/json"',
  '</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"',
];

function htmlHeaders(entry: (typeof MARKDOWN_ROUTES)[number]) {
  return htmlRepresentationHeaders(
    entry,
    entry.path === "/" ? ROOT_DISCOVERY_LINKS : [],
  );
}

function markdownRewrite(request: Request, entry: (typeof MARKDOWN_ROUTES)[number], direct: boolean) {
  const destination = new URL('/api/markdown', request.url);
  destination.searchParams.set('path', entry.path);
  if (direct) destination.searchParams.set('direct', '1');
  return rewrite(destination);
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return next();

  const entry = resolveMarkdownEntry(url.pathname, manifest);
  const directEntry = resolveDirectMarkdownEntry(url.pathname, manifest);
  const sidecarEntry = resolveSidecarEntry(url.pathname, manifest);

  if (directEntry) return markdownRewrite(request, directEntry, true);
  if (sidecarEntry) return markdownRewrite(request, sidecarEntry, true);
  if (!entry) return next();

  const selected = selectRepresentation(request.headers.get('accept'));
  if (selected === 'markdown') return markdownRewrite(request, entry, false);
  if (selected === 'not-acceptable') {
    return new Response(null, { status: 406, headers: htmlHeaders(entry) });
  }
  return next({ headers: htmlHeaders(entry) });
}
