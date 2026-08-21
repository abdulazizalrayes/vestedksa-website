import { next, rewrite, waitUntil } from '@vercel/functions';
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
    '/llms.txt',
    '/llms-full.txt',
    '/llms-full.md',
    '/openapi.json',
    '/data/:path*',
    '/.well-known/:path*',
  ],
};

const ROOT_DISCOVERY_LINKS = [
  '</llms.txt>; rel="alternate"; type="text/markdown"',
  '</llms-full.md>; rel="alternate"; type="text/markdown"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</.well-known/api-catalog>; rel="service-desc"; type="application/linkset+json"',
  '</.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/ai-catalog+json"',
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

function classifyUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes('oai-searchbot')) return 'openai-search';
  if (ua.includes('chatgpt-user')) return 'openai-user';
  if (ua.includes('gptbot')) return 'openai-training';
  if (ua.includes('claude-searchbot')) return 'anthropic-search';
  if (ua.includes('claude-user')) return 'anthropic-user';
  if (ua.includes('claudebot') || ua.includes('anthropic-ai')) return 'anthropic-training';
  if (ua.includes('perplexity')) return 'perplexity';
  if (ua.includes('googlebot')) return 'googlebot';
  if (ua.includes('bingbot')) return 'bingbot';
  if (ua.includes('ccbot')) return 'common-crawl';
  if (ua.includes('bytespider')) return 'bytespider';
  if (/(?:bot|crawler|spider)/.test(ua)) return 'other-crawler';
  return 'browser-or-unknown';
}

function surfaceAction(pathname: string, userAgentClass: string) {
  if (pathname === '/llms.txt' || pathname === '/llms-full.txt' || pathname === '/llms-full.md') return 'llms_read';
  if (pathname === '/openapi.json') return 'openapi_read';
  if (pathname.startsWith('/data/') || pathname.startsWith('/.well-known/')) return 'agent_resource_read';
  if (userAgentClass !== 'browser-or-unknown') return 'crawler_visit';
  return '';
}

function recordTelemetry(request: Request, action: string) {
  if (!action) return;
  const url = new URL(request.url);
  const userAgentClass = classifyUserAgent(request.headers.get('user-agent') || '');
  const record = {
    type: 'agent_surface_event',
    timestamp: new Date().toISOString(),
    path: url.pathname.slice(0, 160),
    method: request.method,
    userAgentClass,
    action,
    storesPersonalData: false,
  };
  console.log(JSON.stringify(record));

  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const secret = runtime.process?.env?.GA4_API_SECRET;
  if (!secret) return;
  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=G-7STG2HDV42&api_secret=${encodeURIComponent(secret)}`;
  waitUntil(fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: `agent.${userAgentClass}`,
      non_personalized_ads: true,
      events: [{
        name: action,
        params: {
          engagement_time_msec: 1,
          agent_class: userAgentClass,
          resource_path: record.path,
        },
      }],
    }),
  }).catch(() => undefined));
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return next();

  const entry = resolveMarkdownEntry(url.pathname, manifest);
  const directEntry = resolveDirectMarkdownEntry(url.pathname, manifest);
  const sidecarEntry = resolveSidecarEntry(url.pathname, manifest);

  if (directEntry) {
    recordTelemetry(request, 'markdown_representation_read');
    return markdownRewrite(request, directEntry, true);
  }
  if (sidecarEntry) {
    recordTelemetry(request, 'markdown_representation_read');
    return markdownRewrite(request, sidecarEntry, true);
  }
  if (!entry) {
    const userAgentClass = classifyUserAgent(request.headers.get('user-agent') || '');
    recordTelemetry(request, surfaceAction(url.pathname, userAgentClass));
    return next();
  }

  const selected = selectRepresentation(request.headers.get('accept'));
  if (selected === 'markdown') {
    recordTelemetry(request, 'markdown_representation_read');
    return markdownRewrite(request, entry, false);
  }
  const userAgentClass = classifyUserAgent(request.headers.get('user-agent') || '');
  recordTelemetry(request, surfaceAction(url.pathname, userAgentClass));
  if (selected === 'not-acceptable') {
    return new Response(null, { status: 406, headers: htmlHeaders(entry) });
  }
  return next({ headers: htmlHeaders(entry) });
}
