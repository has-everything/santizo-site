// /robots.txt. Crawlers may read every page (each one carries its own noindex
// until launch). The sitemap is announced only once site.indexable is true.
import type { APIRoute } from 'astro';
import { site } from '../data/site';
import { abs } from '../lib/seo';

export const GET: APIRoute = () => {
  const lines = ['User-agent: *', 'Allow: /'];
  if (site.indexable) lines.push('', `Sitemap: ${abs('/sitemap.xml')}`);
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
