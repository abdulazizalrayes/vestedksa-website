import { next, rewrite } from '@vercel/functions';
import { acceptsMarkdown, resolveMarkdownEntry } from './lib/markdown-negotiation.mjs';
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
  ],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const entry = resolveMarkdownEntry(url.pathname, manifest);

  if (!entry || !acceptsMarkdown(request.headers.get('accept'))) {
    return next();
  }

  const destination = new URL('/api/markdown', request.url);
  destination.searchParams.set('path', entry.path);
  return rewrite(destination);
}
