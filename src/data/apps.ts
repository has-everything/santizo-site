import type { WorkItem } from './work';

// Apps from has.tools. Images are the has.tools stage captures
// (has-tools-website/img/<slug>-stage.png, 2400x1350) saved as 2000px WebP in
// public/img/apps, sharp enough for the full-width first tile on /apps.
// The "why" copy is condensed from the owner's own words: the About and Learn
// sections of has.tools and the opening paragraph of each tool's showcase page.
const tool = (slug: string) => `https://has.tools/tools/${slug}.html`;
const img = (slug: string) => ({ img: `/img/apps/${slug}.webp` });

// Top of the /apps page: why the tools exist.
export const appsIntro = {
  lead: 'Every tool here started as a problem I had on a real deadline.',
  body: 'These tools are built on deadline, not in theory. When a job needs something that a full 3D package makes slow, I build the small tool I wish existed and publish it, free, at has.tools.',
  aside: 'They run in the browser, with nothing to install. Some people use the tools; others take the idea and build their own. Both are welcome.',
};

// The /apps page, in this order: the first runs full width, the rest two per
// row, so keep the count odd. `note` is the problem each app answers.
export const tools: WorkItem[] = [
  {
    title: 'Splay', blurb: 'Exploded views of 3D models, animated on a timeline', tag: 'Animation',
    note: 'Exploded views usually mean hand-rigging offsets, then redoing them every time the model changes.',
    href: tool('splay'), media: img('splay'),
  },
  {
    title: 'HAS Lathe', blurb: 'A potter’s wheel for 3D models', tag: 'Modeling',
    note: 'Modeling a simple vase should not mean opening a full 3D package.',
    href: '/apps/has-lathe', media: img('lathe'),
  },
  {
    title: 'HAS Sculpt', blurb: 'Digital clay, right in the browser', tag: 'Sculpting',
    note: 'Blocking out a head or a rock shouldn’t start with installing a sculpting app and waiting for it to open.',
    href: tool('sculpt'), media: img('sculpt'),
  },
  {
    title: 'HAS Truss', blurb: 'Draw a curve, get a truss rig', tag: 'Modeling',
    note: 'Truss is in every stage and exhibition render, and tedious to model by hand. Along a curve it gets worse.',
    href: tool('truss'), media: img('truss'),
  },
  {
    title: 'HAS Gallery', blurb: 'Draw a gallery, walk it, hang the art', tag: 'Spaces',
    note: 'Planning a show usually means graph paper or a full 3D package. This sits in between.',
    href: tool('gallery'), media: img('gallery'),
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
