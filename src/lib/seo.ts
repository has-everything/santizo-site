// Absolute URLs and structured data (JSON-LD) for search engines and link
// previews. Base.astro writes the <head> tags; pages pass their own JSON-LD.
import { site, footer } from '../data/site';

// Where this site lives. Before launch: this Vercel project's production
// address (santizo-site.vercel.app), so link previews load their images. At
// launch (site.indexable = true): www.santizo.com, from `site` in astro.config.mjs.
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const origin = (site.indexable || !vercel ? import.meta.env.SITE : `https://${vercel}`).replace(/\/$/, '');

/** Absolute URL for a site path. Pages are linked without a trailing slash. */
export const abs = (path: string) => origin + (path === '/' ? '/' : path.replace(/\/$/, ''));

/** Link preview image (1200x630) */
export interface OgImage { src: string; alt: string }
export const defaultImage: OgImage = {
  src: '/img/og/santizo.png',
  alt: 'santizo: Complex products, made clear in 3D. Hector Augusto Santizo, creative technologist, Los Angeles.',
};

const personId = () => abs('/') + '#person';

/** The owner, in full on Home and Info; other pages point at it by @id. */
export function person() {
  return {
    '@type': 'Person',
    '@id': personId(),
    name: site.person,
    alternateName: 'HAS',
    jobTitle: 'Creative technologist',
    description: site.description,
    url: abs('/'),
    email: `mailto:${site.email}`,
    image: abs(defaultImage.src),
    address: { '@type': 'PostalAddress', addressLocality: 'Los Angeles', addressRegion: 'CA', addressCountry: 'US' },
    sameAs: [...footer.elsewhere.map((l) => l.href), 'https://has.tools'],
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'California State University, Northridge' },
    knowsAbout: ['Creative technology', 'Creative direction', 'Product visualization', '3D animation', 'Motion design', 'Unreal Engine', 'Unity', 'Cinema 4D', 'XR', 'Hand tracking'],
  };
}

export const author = () => ({ '@id': personId() });

export function website() {
  return {
    '@type': 'WebSite',
    '@id': abs('/') + '#website',
    name: site.name,
    url: abs('/'),
    inLanguage: 'en',
    author: author(),
  };
}

/** Breadcrumb trail, e.g. [['Work', '/work'], ['Roboto', '/work/roboto']]; Home is added first. */
export function breadcrumbs(trail: [string, string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'] as [string, string], ...trail].map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: abs(path),
    })),
  };
}

/** One <script type="application/ld+json"> body for a list of nodes. */
export function jsonLd(nodes: object[]) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}
