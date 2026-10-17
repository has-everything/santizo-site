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
        'What if you could step inside a painting rather than simply look at it?',
        'I wanted to reimagine Vincent van Gogh’s *The Bedroom* as an interactive experience, transforming a familiar work of art into a space where curiosity leads to discovery.',
      ] },
      { title: 'Creative Direction', paras: [
        'The goal wasn’t simply to reproduce a painting in 3D. It was to create a more personal way to experience the artwork and the stories behind it.',
        'Every detail offered an opportunity for discovery. Paintings reveal their stories, everyday objects provide glimpses into Van Gogh’s life, and a drawer opens to reveal a collection of his letters. Visitors can also explore different versions of the original painting.',
      ] },
      { title: 'Execution', paras: [
        'I developed the experience in Unreal Engine, bringing together 3D environment design, lighting, interaction, and storytelling.',
        'The room becomes a navigable space where visitors can explore objects, uncover information, and experience the artwork at their own pace.',
      ] },
      { title: 'Outcome', paras: [
        'An interactive exploration of how technology can create new ways to experience art.',
        'Rather than simply viewing an image, visitors become participants, turning observation into discovery.',
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
        'LP-19 explores the idea of transforming sound into a physical visual artifact, translating music into patterns printed on paper.',
      ] },
      { title: 'Creative Direction', paras: [
        'I envisioned a minimal, beautifully considered object that makes an invisible experience tangible.',
        'The design follows a restrained industrial aesthetic, with simple geometric forms, clean surfaces, and an emphasis on function. The intention was to create a product where the interaction between sound, movement, and paper becomes the visual centerpiece.',
      ] },
      { title: 'Execution', paras: [
        'I developed the product concept through 3D design and visualization, exploring its proportions, materials, and mechanical expression.',
        'The project considers how audio could be translated into graphic patterns, with the movement of paper and the emerging visualization communicating the relationship between sound and physical output.',
      ] },
      { title: 'Outcome', paras: [
        'A product design exploration that connects industrial design, motion, and creative technology.',
        'LP-19 imagines a different relationship with music, where something fleeting can become something physical and lasting.',
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
