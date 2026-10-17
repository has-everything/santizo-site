import type { WorkItem } from './work';

// Apps from has.tools. Images are the has.tools stage captures
// (has-tools-website/img/<slug>-stage.png, 2400x1350) saved as 2000px WebP in
// public/img/apps (sharp on retina screens).
// The "why" copy is condensed from the owner's own words: the About and Learn
// sections of has.tools and the opening paragraph of each tool's showcase page.
const img = (slug: string) => ({ img: `/img/apps/${slug}.webp` });

// Top of the /apps page: why the tools exist (the owner's text, Oct 2026,
// merged with the earlier has.tools wording).
export const appsIntro = {
  lead: 'Creative tools, built from real problems.',
  body: 'Most of them start with a simple frustration on a real job: why is this harder than it needs to be? When a workflow gets in the way, I design and build a simpler one, from the first idea and the interface to the 3D technology underneath.',
  aside: 'They’re free and run in your browser at has.tools, with nothing to install. Some people use the tools; others take the idea and build their own. Both are welcome.',
};

// The /apps grid, in this order (three across on wide screens, so six fill two
// rows). `note` is the problem each app answers. Each card opens the app's page
// on this site (src/data/app-pages.ts), which links on to the app on has.tools.
export const tools: WorkItem[] = [
  {
    title: 'Splay', blurb: 'Exploded views of 3D models, animated on a timeline', tag: 'Animation',
    note: 'Exploded views usually mean hand-rigging offsets, then redoing them every time the model changes.',
    href: '/apps/splay', media: img('splay'),
  },
  {
    title: 'HAS Lathe', blurb: 'A potter’s wheel for 3D models', tag: 'Modeling',
    note: 'Modeling a simple vase should not mean opening a full 3D package.',
    href: '/apps/has-lathe', media: img('lathe'),
  },
  {
    title: 'HAS Sculpt', blurb: 'Digital clay, right in the browser', tag: 'Sculpting',
    note: 'Blocking out a head or a rock shouldn’t start with installing a sculpting app and waiting for it to open.',
    href: '/apps/has-sculpt', media: img('sculpt'),
  },
  {
    title: 'HAS Truss', blurb: 'Draw a curve, get a truss rig', tag: 'Modeling',
    note: 'Truss is in every stage and exhibition render, and tedious to model by hand. Along a curve it gets worse.',
    href: '/apps/has-truss', media: img('truss'),
  },
  {
    title: 'HAS Gallery', blurb: 'Draw a gallery, walk it, hang the art', tag: 'Spaces',
    note: 'Planning a show usually means graph paper or a full 3D package. This sits in between.',
    href: '/apps/has-gallery', media: img('gallery'),
  },
];

// (03) Apps on the home page: a short ruled list that points to /apps. Rows
// are picked by title from `tools` above (same blurb and link), then has.tools.
const row = (title: string) => {
  const t = tools.find((x) => x.title === title);
  if (!t) throw new Error(`No app "${title}" in tools (src/data/apps.ts)`);
  return { name: t.title, blurb: t.blurb, href: t.href, cta: t.href.startsWith('/') ? 'View →' : 'View ↗' };
};

export const apps = {
  items: [
    ...['HAS Lathe', 'Splay', 'HAS Gallery', 'HAS Sculpt', 'HAS Truss'].map(row),
    { name: 'HAS.TOOLS', blurb: 'Free creative tools that run in your browser', href: 'https://has.tools', cta: 'has.tools ↗' },
  ],
};
