// /sitemap.xml: every page worth finding in search. A new page file in
// src/pages needs a line here; project pages come from src/data/work.ts.
import type { APIRoute } from 'astro';
import { projects } from '../data/work';
import { abs } from '../lib/seo';

const paths = [
  '/',
  '/work',
  ...projects.map((p) => `/work/${p.slug}`),
  '/apps',
  '/apps/has-lathe',
  '/burning-man',
  '/info',
];

export const GET: APIRoute = () => {
  const urls = paths.map((p) => `  <url><loc>${abs(p)}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
