import type { WorkItem } from './work';

// Apps from has.tools. Card images are the has.tools card captures
// (has-tools-website/img/<slug>-card.png, 800x500) saved as WebP in public/img/apps.
const tool = (slug: string) => `https://has.tools/tools/${slug}.html`;
const img = (slug: string) => ({ img: `/img/apps/${slug}.webp` });

// The /apps page: a 3x3 grid, in this order.
export const tools: WorkItem[] = [
  { title: 'Splay', blurb: 'Exploded views of 3D models, animated on a timeline', tag: 'Animation', href: tool('splay'), media: img('splay') },
  { title: 'HAS Lathe', blurb: 'A potter’s wheel for 3D models', tag: 'Modeling', href: '/apps/has-lathe', media: img('lathe') },
  { title: 'HAS Sculpt', blurb: 'Digital clay, right in the browser', tag: 'Sculpting', href: tool('sculpt'), media: img('sculpt') },
  { title: 'PLAT', blurb: 'Drop in rooms and the floor plan builds itself in 3D', tag: 'Architecture', href: tool('plat'), media: img('plat') },
  { title: 'HAS Truss', blurb: 'Draw a curve, get a truss rig', tag: 'Modeling', href: tool('truss'), media: img('truss') },
  { title: 'HAS Gallery', blurb: 'Draw a gallery, walk it, hang the art', tag: 'Spaces', href: tool('gallery'), media: img('gallery') },
  { title: 'HAS Cabinet', blurb: 'Parametric cabinets, with a cut list', tag: 'Furniture', href: tool('cabinet'), media: img('cabinet') },
  { title: 'HAS Dither', blurb: 'Node-based image dithering', tag: 'Image', href: tool('dither'), media: img('dither') },
  { title: 'HAS Books', blurb: 'Shelves and piles of book props for any scene', tag: 'Props', href: tool('books'), media: img('books') },
];

// (03) Apps on the home page: a short ruled list that points to /apps.
export const apps = {
  items: [
    { name: 'HAS Lathe', blurb: 'A potter’s wheel for 3D models', href: '/apps/has-lathe', cta: 'View →' },
    { name: 'HAS.TOOLS', blurb: 'Free creative tools that run in your browser', href: 'https://has.tools', cta: 'has.tools ↗' },
  ],
};
