import type { Media } from './media';

// A linked tile: what the home page, the XR strip and the /work page show.
export interface WorkItem {
  title: string;
  blurb: string; // muted text after the title
  tag?: string;  // small mono label on the right
  note?: string; // optional line under the caption (the Apps page uses it for why each app exists)
  href: string;
  media: Media;
}

// ---------- Projects: every video, each with its own page at /work/<slug> ----------

export type Video = { vimeo: string } | { youtube: string };

/** One section of a case study (Vision, Creative Direction, Execution, Outcome) */
export interface StoryBlock { title: string; paras: string[] }

export interface Project {
  slug: string;    // URL: /work/<slug>
  title: string;
  blurb: string;   // one line under the title
  tag?: string;    // short label on tiles
  focus: string[]; // shown as "Focus" on the project page
  group: 'motion' | 'xr';
  video: Video;
  // Optional, for the owner to fill in. Each shows on the page only when set.
  year?: string;
  tagline?: string;     // the owner's one-liner under the title (else the blurb shows)
  story?: StoryBlock[]; // the owner's case study; shows only when set
}

export const groups = {
  motion: { num: '01', label: 'Motion and animation' },
  xr: { num: '02', label: 'XR and interaction' },
} as const;

// Order within each group = order on /work and the "Next" link on each page.
// Titles, tags and videos come from SantizoOS (santizo-os js/site-data.js).
export const projects: Project[] = [
  // Motion and animation
  { slug: 'santizo-reel-2026', title: 'Santizo Reel 2026', blurb: 'The 2026 reel', tag: 'Reel', focus: ['Art direction', 'Sim', 'Lighting'], group: 'motion', video: { vimeo: '1216889002' } },
  {
    slug: 'van-gogh-the-bedroom', title: 'Van Gogh · The Bedroom', blurb: 'Interactive, in Unreal Engine', tag: 'Unreal Engine', focus: ['Unreal Engine', 'Interactive'], group: 'motion', video: { vimeo: '1230984635' },
    // The owner's own write-up (Oct 2026)
    tagline: 'Turning a painting into a place to explore.',
    story: [
      { title: 'Vision', paras: [
        'What if you could step inside a painting instead of looking at it?',
        'I rebuilt Vincent van Gogh’s *The Bedroom* as a room you can walk into, where curiosity leads to discovery.',
      ] },
      { title: 'Creative Direction', paras: [
        'Not a copy of the painting in 3D, but a more personal way into it, and into the life behind it.',
        'Every object holds something. The paintings on the walls tell their stories, everyday things give glimpses of his life, and a drawer opens onto a collection of his letters. You can also explore different versions of the original painting.',
      ] },
      { title: 'Execution', paras: [
        'Built in Unreal Engine: the room, the light, the interactions and the storytelling.',
        'Visitors move through the room at their own pace, exploring objects and uncovering what each one holds.',
      ] },
      { title: 'Outcome', paras: [
        'Visitors stop looking at the painting and start exploring it.',
        'An experiment in how real-time technology can open new ways into art, turning observation into discovery.',
      ] },
    ],
  },
  {
    slug: 'has-lp-19', title: 'HAS LP-19', blurb: 'Music printed as ridgelines', tag: 'Product design · 3D', focus: ['Product design', '3D'], group: 'motion', video: { vimeo: '1233222591' },
    // The owner's own write-up (Oct 2026)
    tagline: 'Sound made physical.',
    story: [
      { title: 'Vision', paras: [
        'What if music could become something you could hold?',
        'LP-19 turns sound into a physical artifact: music, printed as patterns on paper.',
      ] },
      { title: 'Creative Direction', paras: [
        'A minimal object that makes an invisible experience tangible.',
        'Restrained industrial design: simple geometry, clean surfaces, everything there for a reason. The centerpiece is the moment sound, movement and paper meet.',
      ] },
      { title: 'Execution', paras: [
        'Designed and visualized in 3D: the proportions, the materials and the way the mechanism moves.',
        'The film explores how audio could turn into graphic patterns. As the paper moves, the print emerges, and you can watch sound become an object.',
      ] },
      { title: 'Outcome', paras: [
        'A product concept where industrial design, motion and creative technology meet.',
        'LP-19 imagines a different relationship with music, where something fleeting becomes something you can keep.',
      ] },
    ],
  },
  { slug: 'star-trails', title: 'Star trails', blurb: 'Concept, art and animation', tag: 'Animation', focus: ['Concept', 'Art', 'Animation'], group: 'motion', video: { vimeo: '269102770' } },
  { slug: 'evidence-of-existence', title: 'Evidence of Existence', blurb: '360 VR with particles', tag: '360 VR', focus: ['360 VR', 'Particles'], group: 'motion', video: { vimeo: '207575582' } },
  { slug: 'visual-alternatives', title: 'Visual Alternatives', blurb: 'Audio-visual, in Unity', tag: 'Unity', focus: ['Audio-visual', 'Unity'], group: 'motion', video: { youtube: 'FrM8C7vHTow' } },
  { slug: 'real-time-interactive-app', title: 'Real-time interactive app', blurb: 'Unity, running live', tag: 'Unity', focus: ['Unity', 'Real-time'], group: 'motion', video: { vimeo: '548921641' } },
  { slug: 'roboto', title: 'Roboto', blurb: 'Plasticity, Unity and C#', tag: 'Plasticity · Unity', focus: ['Plasticity', 'Unity', 'C#'], group: 'motion', video: { vimeo: '1056096066' } },
  // XR and interaction
  { slug: 'has-photo-booth', title: 'HAS Photo Booth', blurb: 'MediaPipe, in the browser', focus: ['MediaPipe', 'Browser'], group: 'xr', video: { youtube: '1L2anMG2k-8' } },
  { slug: 'hand-tracker', title: 'Hand Tracker', blurb: 'MediaPipe and JavaScript', focus: ['MediaPipe', 'JavaScript'], group: 'xr', video: { youtube: '2WZzjRuMJU0' } },
  { slug: 'wrist-interaction', title: 'Wrist Interaction', blurb: 'Tracked transforms', focus: ['Tracked transforms'], group: 'xr', video: { vimeo: '989005478' } },
  { slug: '3d-calculator', title: '3D Calculator', blurb: 'Gesture math', focus: ['Gesture math'], group: 'xr', video: { vimeo: '1001763153' } },
  { slug: 'gauge-control', title: 'Gauge Control', blurb: 'VR/AR dials', focus: ['VR/AR dials'], group: 'xr', video: { vimeo: '982232014' } },
  { slug: 'arrow-grid-system', title: 'Arrow Grid System', blurb: 'VR interaction', focus: ['VR interaction'], group: 'xr', video: { vimeo: '990364072' } },
  { slug: 'pinch-twist', title: 'Pinch Twist', blurb: 'Hand gesture', focus: ['Hand gesture'], group: 'xr', video: { vimeo: '990453573' } },
];

export const project = (slug: string) => {
  const p = projects.find((x) => x.slug === slug);
  if (!p) throw new Error(`No project "${slug}" in src/data/work.ts`);
  return p;
};

/** A project as a tile linking to its page. */
export const tile = (p: Project, { withTag = true } = {}): WorkItem => ({
  title: p.title,
  blurb: p.blurb,
  tag: withTag ? p.tag : undefined,
  href: `/work/${p.slug}`,
  media: p.video,
});

// ---------- Home page ----------

// (01) Featured work. Order is layout: the first item runs full width, the
// rest pair up in rows that alternate wide/narrow and narrow/wide.
export const featured: WorkItem[] = [
  ...['van-gogh-the-bedroom', 'has-lp-19', 'roboto', 'evidence-of-existence', 'real-time-interactive-app', 'star-trails'].map((s) => tile(project(s))),
  {
    title: 'HAS Lathe',
    blurb: 'A potter’s wheel for 3D models',
    tag: 'Free app',
    href: '/apps/has-lathe',
    media: { art: 'lathe' },
  },
];

// (02) XR and interaction: three wide clips in a row (all of them are on /xr).
export const xr = {
  statement: 'Hands as the controller: gesture, pinch and twist.',
  clips: ['wrist-interaction', '3d-calculator', 'pinch-twist'].map((s) => tile(project(s), { withTag: false })),
};

// ---------- XR page (/xr) ----------

// Intro written from the owner's placeholder (AR, VR, mixed reality, code,
// his tools). Order of `projects` is layout: the first runs full width, the
// rest two per row, so keep the count odd (1 + pairs).
export const xrPage = {
  lead: 'My lab for augmented, virtual and mixed reality, and the code behind them.',
  body: 'It starts with one question: what if your hands were the controller? Everything here is a working prototype, from pinch and twist gestures to dials, grids and a calculator you reach out and use.',
  covers: 'AR · VR · Mixed reality',
  tools: 'Unity · Unreal Engine · Cinema 4D · C# · Python · Xcode',
  projects: [
    'wrist-interaction',
    '3d-calculator', 'pinch-twist',
    'gauge-control', 'arrow-grid-system',
    'hand-tracker', 'has-photo-booth',
  ].map((s) => tile(project(s))),
};

// ---------- HAS Toyline (/work/has-toyline) ----------

// A one-off page, not in `projects`: there is no Vimeo or YouTube film yet, so
// the page loops a self-hosted capture of the app and adds stills. When the
// film is on Vimeo it can join `projects` like the others.
// DRAFT copy (Oct 2026), written in the site's voice for the owner to edit.
export interface Still { src: string; w: number; h: number; alt: string; caption: string }

export const toyline = {
  slug: 'has-toyline',
  title: 'HAS Toyline',
  blurb: 'A toy factory, in three.js',
  tag: 'three.js · Interactive',
  focus: ['three.js', 'Interactive'],
  group: 'motion' as const,
  year: '2026',
  tagline: 'A factory that shows what a toy costs.',
  film: { video: '/video/has-toyline.mp4', poster: '/img/work/has-toyline/poster.webp' },
  story: [
    { title: 'Vision', paras: [
      'What if a factory showed you what everything costs?',
      'HAS Toyline is a wooden toy-car factory you can orbit. I turned it into one you have to pay for, so you can see what it really takes to make a toy and sell it.',
    ] },
    { title: 'Creative Direction', paras: [
      'Money as part of the scene, not a spreadsheet beside it.',
      'Prices float over each station, a running tab rides on every car, and the minutes people spend waiting show up in hatched amber. The slowest station wears a yellow tag: it sets the pace for everyone.',
    ] },
    { title: 'Execution', paras: [
      'Built in three.js: the line, the cameras and one cost model behind every number.',
      'Short lessons switch the layers on one at a time, from a single block of birch to a month of running the business. Tap any figure and it shows how it was worked out.',
    ] },
    { title: 'Outcome', paras: [
      'People stop pricing by feel and start reading the line.',
      'An experiment in how real-time 3D can turn an abstract subject into something you can watch, and check.',
    ] },
  ] as StoryBlock[],
  // Six cards, like "What it does" on the app pages
  learns: [
    { title: 'Price one car', body: 'Birch, paint, wheels, the minutes at every station, the carton and the truck: what one car costs at the door.' },
    { title: 'Find the bottleneck', body: 'The whole line waits for its slowest station, and everyone is paid while they wait.' },
    { title: 'Break even', body: 'Rent, leases and salaries arrive every month, whatever you make. How many cars cover them?' },
    { title: 'Markup and margin', body: 'Two percentages that sound alike and are not. Mix them up and the price comes out too low.' },
    { title: 'Price against demand', body: 'A higher price earns more on each car and sells fewer of them. Find the price that earns most.' },
    { title: 'Profit is not cash', body: 'A month in the black can still empty the bank, because the shops pay thirty days later.' },
  ],
  line: { src: '/img/work/has-toyline/line.webp', w: 2400, h: 1350, alt: 'The whole HAS Toyline factory from above, with cost tags over each station and a running tab on every car', caption: 'The line with the money layer on: minutes and cost over every station, and the tab each car carries.' } as Still,
  squares: [
    { src: '/img/work/has-toyline/birch.webp', w: 1360, h: 1360, alt: 'Raw birch coupe bodies on the conveyor after the cut', caption: 'A block of birch, cut to a coupe.' },
    { src: '/img/work/has-toyline/carton.webp', w: 1360, h: 1360, alt: 'A red No. 7 coupe boxed in a windowed HAS Wheels carton', caption: 'Boxed in its HAS Wheels carton.' },
  ] as Still[],
  pair: [
    { src: '/img/work/has-toyline/detail.webp', w: 2400, h: 1350, alt: 'Yellow robot arms fitting parts to a red coupe at the Detail station', caption: 'Wheels on, then lights, grille and bumpers at Detail.' },
    { src: '/img/work/has-toyline/truck.webp', w: 2400, h: 1350, alt: 'The HAS Wheels delivery truck at the end of the line', caption: 'On the truck: freight is the last line on the tab.' },
  ] as Still[],
  og: { src: '/img/og/has-toyline.jpg', alt: 'HAS Toyline: a red wooden coupe boxed in a HAS Wheels carton' },
};

/** HAS Toyline as a tile (the /work grid) */
export const toylineTile: WorkItem = {
  title: toyline.title,
  blurb: toyline.blurb,
  tag: 'three.js',
  href: `/work/${toyline.slug}`,
  media: toyline.film,
};
