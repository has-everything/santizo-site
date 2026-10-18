// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // The site's address: canonical URLs, link previews, JSON-LD and the sitemap.
  // www is the primary domain in Vercel; santizo.com 308-redirects to it.
  site: 'https://www.santizo.com',
  // Old addresses: the Burning Man page, and the XR page, now the XR section of /work
  redirects: { '/photos': '/burning-man', '/xr': '/work#xr' },
});
