import type { Media } from './media';

export interface WorkItem {
  title: string;
  blurb: string; // muted text after the title
  tag?: string;  // small mono label on the right
  note?: string; // optional line under the caption (the Apps page uses it for why each app exists)
  href: string;
  media: Media;
}

// (01) Featured work. Order is layout: the first item runs full width, the
// rest pair up in rows that alternate wide/narrow and narrow/wide.
export const featured: WorkItem[] = [
  {
    title: 'Van Gogh · The Bedroom',
    blurb: 'Interactive, in Unreal Engine',
    tag: 'Unreal Engine',
    href: 'https://vimeo.com/1230984635',
    media: { vimeo: '1230984635' },
  },
  {
    title: 'HAS LP-19',
    blurb: 'Music printed as ridgelines',
    tag: 'Product design · 3D',
    href: 'https://vimeo.com/1233222591',
    media: { vimeo: '1233222591' },
  },
  {
    title: 'Roboto',
    blurb: 'Plasticity, Unity and C#',
    tag: 'Plasticity · Unity',
    href: 'https://vimeo.com/1056096066',
    media: { vimeo: '1056096066' },
  },
  {
    title: 'Evidence of Existence',
    blurb: '360 VR with particles',
    tag: '360 VR',
    href: 'https://vimeo.com/207575582',
    media: { vimeo: '207575582' },
  },
  {
    title: 'Real-time interactive app',
    blurb: 'Unity, running live',
    tag: 'Unity',
    href: 'https://vimeo.com/548921641',
    media: { vimeo: '548921641' },
  },
  {
    title: 'Star trails',
    blurb: 'Concept, art and animation',
    tag: 'Animation',
    href: 'https://vimeo.com/269102770',
    media: { vimeo: '269102770' },
  },
  {
    title: 'HAS Lathe',
    blurb: 'A potter’s wheel for 3D models',
    tag: 'Free app',
    href: '/apps/has-lathe',
    media: { art: 'lathe' },
  },
];

// (02) XR and interaction: portrait clips in a horizontal strip.
export const xr = {
  statement: 'Hands as the controller: gesture, pinch and twist.',
  clips: [
    { title: 'Wrist Interaction', blurb: 'Tracked transforms', href: 'https://vimeo.com/989005478', media: { vimeo: '989005478' } },
    { title: '3D Calculator', blurb: 'Gesture math', href: 'https://vimeo.com/1001763153', media: { vimeo: '1001763153' } },
    { title: 'Gauge Control', blurb: 'VR/AR dials', href: 'https://vimeo.com/982232014', media: { vimeo: '982232014' } },
    { title: 'Pinch Twist', blurb: 'Hand gesture', href: 'https://vimeo.com/990453573', media: { vimeo: '990453573' } },
  ] as WorkItem[],
};
