// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Final home of this site. Used for canonical URLs once site.indexable is true.
  site: 'https://santizo.com',
  // Old address of the Burning Man page
  redirects: { '/photos': '/burning-man' },
});
