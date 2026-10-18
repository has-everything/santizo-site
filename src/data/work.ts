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

// Order within each group = order on /work (and the fallback for "Related", see related.ts).
// Titles, tags and videos come from SantizoOS (santizo-os js/site-data.js).
export const projects: Project[] = [
  // Motion and animation
  { slug: 'santizo-reel-2026', title: 'Santizo Reel 2026', blurb: 'The 2026 reel', tag: 'Reel', focus: ['Direction', 'Design', 'Animation'], group: 'motion', video: { vimeo: '1216889002' } },
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
        'The animation explores how audio could turn into graphic patterns. As the paper moves, the print emerges, and you can watch sound become an object.',
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
// Copy (Oct 2026): the owner's why, in his words (build a working line and watch
// a car get made; then ask if it could teach cost and profit; a factory is a
// spreadsheet you can see), shaped into the site's voice. DRAFT for him to edit;
// the role line is a proposal for him to confirm.
export interface Still { src: string; w: number; h: number; alt: string; caption: string }

export const toyline = {
  slug: 'has-toyline',
  title: 'HAS Toyline',
  blurb: 'A 3D assembly line, in three.js',
  tag: 'three.js · Interactive',
  role: 'Concept, Creative Direction, 3D Design, Development',
  focus: ['three.js', 'Real-time 3D', 'Interactive'],
  group: 'motion' as const,
  year: '2026',
  tagline: 'Watch a car get built, and see what it costs.',
  film: { video: '/video/has-toyline.mp4', poster: '/img/work/has-toyline/poster.webp' },
  story: [
    { title: 'Vision', paras: [
      'I wanted to build a working assembly line in 3D. And why not watch a car get made?',
      'You fill in a work order and the line builds that exact car: a block of birch drops from a hopper, then seven stations cut, sand, paint, print, fit wheels and finish it, until it parks, gets boxed and rides off on a truck.',
    ] },
    { title: 'The Turn', paras: [
      'Once the line worked, I asked a different question.',
      'After a few rounds of iteration it ran the way I wanted. Could it teach what a toy really costs: the birch, the minutes, the waiting, the carton, the truck, and what each car has to sell for to make a profit? A factory is a spreadsheet you can walk through. So I let you see it.',
    ] },
    { title: 'Creative Direction', paras: [
      'The world first, then the money inside it.',
      'Birch, safety yellow and machines that read as real at toy scale, down to a carton printed for the car inside. The numbers live in the scene, not in a table beside it: prices float over each station, a running tab rides on every car, and the minutes spent waiting for the slowest station show up as amber hatching.',
    ] },
    { title: 'Execution', paras: [
      'Built in three.js, with no model files.',
      'Every car, robot, machine and carton is made in code, with liveries, number roundels and wood grain painted in code too. Three cameras: an overview, one that rides along with a single car, and one that inspects any car you tap. On the money side, every figure on screen comes from one cost model, so tap any number and it shows how it was worked out.',
    ] },
    { title: 'Outcome', paras: [
      'Two apps from one factory.',
      'HAS Toyline, the line you order from, and Toyline Ledger, a course in what a toy costs to make and sell: 15 short lessons, 3 challenges, and a month you can run to watch the bank. Both run in the browser. Neither is public yet.',
    ] },
  ] as StoryBlock[],
  // Six cards, like "What it does" on the app pages
  features: [
    { title: 'Build to order', body: 'Six models, twelve paints, six liveries, a race number, wheels, bumpers, a roof extra and a finish. The line builds exactly the car you ordered.' },
    { title: 'Seven stations', body: 'Blank, cut, sand, paint, livery, wheels and detail, each with its own machine, robots that reach for every part, and stack lights that show what it is doing.' },
    { title: 'Follow one car', body: 'Ride along with your order from the block of birch to the truck, or tap any car on the floor to inspect it.' },
    { title: 'Boxed and shipped', body: 'Finished cars park in a numbered lot. A gantry crane takes them to packing, into a carton printed for that car, and onto the truck.' },
    { title: 'Made in code', body: 'No model files and no image files: the cars, robots, machines, cartons and textures are all built in three.js.' },
    { title: 'The money layer', body: 'A price over every station and a running tab on every car, then break-even and price charts, and a month you can run day by day.' },
  ],
  // Figures in story order: the order and its car, the build, the six models, the line, then the money layer.
  // order.webp and models.webp are real app renders (Oct 2026): the Order tab beside the car it built, and
  // the six models on the order-preview turntable, one render each at the same angle, set in a 3 x 2 grid.
  order: { src: '/img/work/has-toyline/order.webp', w: 2400, h: 1350, alt: 'HAS Toyline with the Order tab open for a teal wagon with GT stripes, No. 3 and luggage on the roof; beside it, that wagon built and parked in the lot, with its running tab', caption: 'The work order in the panel, the wagon the line built from it, and its running tab.' } as Still,
  squares: [
    { src: '/img/work/has-toyline/birch.webp', w: 1360, h: 1360, alt: 'Raw birch coupe bodies on the conveyor after the cut', caption: 'A block of birch, cut to a coupe.' },
    { src: '/img/work/has-toyline/carton.webp', w: 1360, h: 1360, alt: 'A red No. 7 coupe boxed in a windowed HAS Wheels carton', caption: 'Boxed in its HAS Wheels carton.' },
  ] as Still[],
  models: { src: '/img/work/has-toyline/models.webp', w: 2400, h: 1350, alt: 'The six models on the order-preview turntable: a red coupe, a mustard hatch, a teal wagon, a sky-blue van with a surfboard, a green pickup and a white racer with a red checker band', caption: 'Coupe, Hatch, Wagon, Van, Pickup and Racer, each with its own paint, livery, wheels and roof.' } as Still,
  pair: [
    { src: '/img/work/has-toyline/detail.webp', w: 2400, h: 1350, alt: 'Yellow robot arms fitting parts to a red coupe at the Detail station', caption: 'Wheels on, then lights, grille and bumpers at Detail.' },
    { src: '/img/work/has-toyline/truck.webp', w: 2400, h: 1350, alt: 'The HAS Wheels delivery truck at the end of the line', caption: 'On the truck, bound for the shops.' },
  ] as Still[],
  money: { src: '/img/work/has-toyline/line.webp', w: 2400, h: 1350, alt: 'The whole HAS Toyline factory from above, with cost tags over each station and a running tab on every car', caption: 'The money layer on: minutes and cost over every station, and the tab each car carries.' } as Still,
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

// ---------- HAS Space (/work/has-space) ----------

// A one-off page, like HAS Toyline: HAS Space is a desktop app in beta (repo
// has-everything/kata-studio), so the page shows renders made with it, not a film.
// Copy (Oct 2026): the owner's why, in his words (spaces to see artwork on the
// walls and walk through; then interiors, furniture and Blender renders, one need
// after another; an interface pleasant to look at and easy for anyone), shaped
// into the site's voice. His role line, his status ("still in beta").
export const space = {
  slug: 'has-space',
  title: 'HAS Space',
  blurb: 'Interiors, from floor plan to render',
  role: 'Creative Director, Builder',
  specs: [
    ['Status', 'Beta'],
    ['Runs on', 'Mac and Windows'],
    ['Built with', 'three.js · Blender · Python'],
  ] as [string, string][],
  group: 'motion' as const,
  tagline: 'Design. Material. Light.',
  hero: { src: '/img/work/has-space/hero.webp', w: 2400, h: 1029, alt: 'A HAS Space render: a limewash gallery room with a large framed Burning Man photograph centred over a stone plinth, a white ceramic vessel on the floor beside it, and a diagonal of sunlight', caption: '' } as Still,
  story: [
    { title: 'Vision', paras: [
      'I wanted to hang art on walls, and walk through the rooms.',
      'It started with artwork. I wanted to build spaces, see the work on their walls and walk through them, so my first prototype was a three.js app for walking around and experiencing the art.',
    ] },
    { title: 'How It Grew', paras: [
      'Every step asked for the next one.',
      'To show the art I needed interiors, so it learned to draw them: my own floor plans, little houses with doors and windows. Rooms needed furniture, so I built a catalog. Then I wanted it to look real, so Blender’s render engine makes the final image, with real light.',
    ] },
    { title: 'Creative Direction', paras: [
      'Pleasant to look at, and easy for anyone.',
      'Not only for architects, designers or animators: anyone should be able to open it, figure it out and start playing. A calm interface in warm neutrals, three modes, Model, Material and Light, and five looks for presenting a space: Materials, Clay, Outline, X-ray and Frosted Glass.',
    ] },
    { title: 'Execution', paras: [
      'A live 3D view for designing, Blender for the final image.',
      'You draw in 2D or 3D and see the room live in three.js, while Blender keeps the same scene in the background and renders it with Cycles. Built-in objects with editable dimensions, all made in code; sun, area and spot lights, skies and HDRI environments; saved camera views; and export to GLB, glTF and Blender files that open in Cinema 4D.',
    ] },
    { title: 'Outcome', paras: [
      'A desktop app for Mac and Windows, in beta.',
      'HAS Space 0.6 runs on your own computer, with Blender for the renders. Every image on this page came out of it.',
    ] },
  ] as StoryBlock[],
  features: [
    { title: 'Draw a room', body: 'A 2D plan, a 3D studio, or both side by side: walls, doors and windows, rulers and room areas.' },
    { title: 'Furnish it', body: 'Sofas, tables, beds, lamps, plants and more, each with editable dimensions, plus a flat screen that shows your own image.' },
    { title: 'Hang your art', body: 'Any image becomes artwork on a wall, sized to the picture, with an optional black frame.' },
    { title: 'Light it', body: 'Sun, area, spot and point lights, saved light rigs, a procedural sky or your own HDRI.' },
    { title: 'Five looks', body: 'Materials, Clay, Outline, X-ray and Frosted Glass, all from the same scene.' },
    { title: 'Render and export', body: 'Blender renders, transparent PNGs, and GLB, glTF or Blender files that open in Cinema 4D.' },
  ],
  // Figures in story order. All rendered in HAS Space 0.6 (Blender 5.2.1, Cycles) through its own
  // API, Oct 2026; the catalog sheet is its own catalog renders (web/assets/furnishings).
  app: { src: '/img/work/has-space/app.webp', w: 2400, h: 1350, alt: 'The HAS Space interface in Plan + 3D: the floor plan of a furnished room beside the live 3D view, with the scene list, the material library and the inspector', caption: 'Plan + 3D: the floor plan and the live room, side by side.' } as Still,
  spaces: { src: '/img/work/has-space/spaces.webp', w: 2400, h: 1176, alt: 'Three HAS Space renders of the same ceramic vessel on a plinth: a pale limewash gallery, a terracotta room and a dark room lit from above', caption: 'Gallery, Terracotta and Nocturne: one vessel, three spaces.' } as Still,
  looks: { src: '/img/work/has-space/looks.webp', w: 2400, h: 1339, alt: 'The same furnished room rendered five ways: with materials, as clay, in outline, as an X-ray outline and in frosted glass', caption: 'One room, five looks: Materials, Clay, Outline, X-ray and Frosted Glass.' } as Still,
  catalog: { src: '/img/work/has-space/catalog.webp', w: 2400, h: 789, alt: 'The built-in objects: sofa, armchair, tables, chairs, stool, desk, office chair, bookcase, credenza, closet, bed, nightstand, lamps, plant, carpet, artwork, screen, plinth and bathroom pieces', caption: 'Built-in objects, each with editable dimensions.' } as Still,
  og: { src: '/img/og/has-space.jpg', alt: 'HAS Space: a gallery room with a framed photograph and a ceramic vessel on a plinth' },
};

/** HAS Space as a tile (the /work grid) */
export const spaceTile: WorkItem = {
  title: space.title,
  blurb: space.blurb,
  tag: 'Blender · three.js',
  href: `/work/${space.slug}`,
  media: { img: space.hero.src },
};
