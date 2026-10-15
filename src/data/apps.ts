import type { WorkItem } from './work';

// Apps from has.tools. Card images are the has.tools card captures
// (has-tools-website/img/<slug>-card.png, 800x500) saved as WebP in public/img/apps.
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

// The /apps grid, in this order. `note` is the problem each app answers.
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
    title: 'PLAT', blurb: 'Drop in rooms and the floor plan builds itself in 3D', tag: 'Architecture',
    note: 'Real CAD is overkill when you just want to block out a space.',
    href: tool('plat'), media: img('plat'),
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
  {
    title: 'HAS Cabinet', blurb: 'Parametric cabinets, with a cut list', tag: 'Furniture',
    note: 'Modeling apps know nothing about millimeters, and CAD fights you on the fun part.',
    href: tool('cabinet'), media: img('cabinet'),
  },
  {
    title: 'HAS Dither', blurb: 'Node-based image dithering', tag: 'Image',
    note: 'Most dithering tools do their math in raw 8-bit, which is why their output looks muddy.',
    href: tool('dither'), media: img('dither'),
  },
  {
    title: 'HAS Books', blurb: 'Shelves and piles of book props for any scene', tag: 'Props',
    note: 'Every archviz render needs a bookshelf, and dressing one by hand takes an afternoon.',
    href: tool('books'), media: img('books'),
  },
];

// (03) Apps on the home page: a short ruled list that points to /apps.
export const apps = {
  items: [
    { name: 'HAS Lathe', blurb: 'A potter’s wheel for 3D models', href: '/apps/has-lathe', cta: 'View →' },
    { name: 'HAS.TOOLS', blurb: 'Free creative tools that run in your browser', href: 'https://has.tools', cta: 'has.tools ↗' },
  ],
};
