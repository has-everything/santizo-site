import type { Media } from './media';
import { tools } from './apps';

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
  group: 'motion' | 'interactive' | 'xr';
  video: Video;
  /** What its tile shows (home, /work, Related, the XR strip). Without it, the video as a muted Vimeo loop. */
  tile?: Media;
  // Optional, for the owner to fill in. Each shows on the page only when set.
  year?: string;
  tagline?: string;     // the owner's one-liner under the title (else the blurb shows)
  story?: StoryBlock[]; // the owner's case study; shows only when set
}

export const groups = {
  motion: { num: '01', label: 'Motion and animation' },
  interactive: { num: '02', label: 'Interactive and real-time' },
  xr: { num: '03', label: 'XR and interaction' },
} as const;

// Order within each group = order on /work (and the fallback for "Related", see related.ts).
// Titles, tags and videos come from SantizoOS (santizo-os js/site-data.js).
/** A tile loop served from this site: a short cut of the project's video at
 * 1280x720, no sound, in public/video/<slug>-tile.mp4 with its first frame as
 * public/img/work/<slug>/tile-poster.webp. It starts faster than a Vimeo embed,
 * which loads a player in every tile (owner's call, Oct 2026). */
const loop = (slug: string): Media => ({ video: `/video/${slug}-tile.mp4`, poster: `/img/work/${slug}/tile-poster.webp` });

export const projects: Project[] = [
  // Motion and animation
  { slug: 'santizo-reel-2026', title: 'Santizo Reel 2026', blurb: 'The 2026 reel', tag: 'Reel', focus: ['Direction', 'Design', 'Animation'], group: 'motion', video: { vimeo: '1216889002' }, tile: loop('santizo-reel-2026') },
  {
    slug: 'has-lp-19', title: 'HAS LP-19', blurb: 'Music printed as ridgelines', tag: 'Product design · 3D', focus: ['Product design', '3D'], group: 'motion', video: { vimeo: '1233222591' }, tile: loop('has-lp-19'),
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
  { slug: 'star-trails', title: 'Star trails', blurb: 'Concept, art and animation', tag: 'Animation', focus: ['Concept', 'Art', 'Animation'], group: 'motion', video: { vimeo: '269102770' }, tile: loop('star-trails') },
  { slug: 'evidence-of-existence', title: 'Evidence of Existence', blurb: '360 VR with particles', tag: '360 VR', focus: ['360 VR', 'Particles'], group: 'motion', video: { vimeo: '207575582' }, tile: loop('evidence-of-existence') },
  { slug: 'visual-alternatives', title: 'Visual Alternatives', blurb: 'Audio-visual, in Unity', tag: 'Unity', focus: ['Audio-visual', 'Unity'], group: 'motion', video: { youtube: 'FrM8C7vHTow' } },
  { slug: 'real-time-interactive-app', title: 'Real-time interactive app', blurb: 'Unity, running live', tag: 'Unity', focus: ['Unity', 'Real-time'], group: 'motion', video: { vimeo: '548921641' }, tile: loop('real-time-interactive-app') },
  { slug: 'roboto', title: 'Roboto', blurb: 'Plasticity, Unity and C#', tag: 'Plasticity · Unity', focus: ['Plasticity', 'Unity', 'C#'], group: 'motion', video: { vimeo: '1056096066' }, tile: loop('roboto') },
  // Interactive and real-time (with the one-off pages HAS Toyline, HAS Records
  // and HAS Space, spliced in around it by work/index.astro)
  {
    slug: 'van-gogh-the-bedroom', title: 'Van Gogh · The Bedroom', blurb: 'Interactive, in Unreal Engine', tag: 'Unreal Engine', focus: ['Unreal Engine', 'Interactive'], group: 'interactive', video: { vimeo: '1230984635' }, tile: loop('van-gogh-the-bedroom'),
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
  // XR and interaction
  {
    slug: 'has-photo-booth', title: 'HAS Photo Booth', blurb: 'MediaPipe, in the browser', focus: ['MediaPipe', 'Browser'], group: 'xr', video: { youtube: '1L2anMG2k-8' },
    // The owner's own write-up (Oct 2026), in story sections; his list as paragraphs
    story: [
      { title: 'Vision', paras: [
        'One possible future of user interaction is intuitive, accessible, and touch-free.',
        'To explore this, I built HAS Photo Booth. It reimagines the camera by turning your hands into the frame itself. You physically shape the shot you want with your fingers, hold it steady for a moment to capture, and then point to drag the results.',
      ] },
      { title: 'The Experiment', paras: [
        'This isn’t just a photo booth.',
        'It’s a functional experiment in Human-Computer Interaction (HCI) that asks: How intuitive and engaging can a web experience be when you remove traditional inputs?',
      ] },
      { title: 'Opportunities', paras: [
        'The prototype highlights opportunities for:',
        'User engagement: designing interactions that are playful and memorable.',
        'Accessibility: expanding possibilities for users with motor limitations.',
        'Future platforms: rapidly prototyping mechanics for AR and VR.',
      ] },
      { title: 'What I Learned', paras: [
        'Building this was as much about learning as it was about testing possibilities.',
        'I explored firsthand how accessible tools like Google’s MediaPipe can open doors to new interaction models.',
      ] },
      { title: 'The Bigger Picture', paras: [
        'I believe creativity and strategy go hand in hand.',
        'Innovation comes from experimenting, learning, and connecting those insights to the bigger picture.',
      ] },
    ],
  },
  {
    slug: 'hand-tracker', title: 'Hand Tracker', blurb: 'MediaPipe and JavaScript', focus: ['MediaPipe', 'JavaScript'], group: 'xr', video: { youtube: '2WZzjRuMJU0' },
    // The owner's own write-up (Oct 2026), in story sections; his gesture list as sentences
    story: [
      { title: 'Vision', paras: [
        'Flip mood boards, product shots, and slides without touching a trackpad.',
        'I built a browser-based, webcam-only, gesture-controlled gallery using JavaScript.',
      ] },
      { title: 'How It Works', paras: [
        'Pinch for next. Hang loose to switch the layout.',
        'Four layouts: horizontal, vertical, diagonal, and circular. Upload and reorder your own images. Tuned for reliable far-hand detection.',
      ] },
      { title: 'Why It Matters', paras: [
        'More natural, accessible, and expressive UI.',
        'Present without breaking eye contact or flow.',
      ] },
    ],
  },
  { slug: 'wrist-interaction', title: 'Wrist Interaction', blurb: 'Tracked transforms', focus: ['Tracked transforms'], group: 'xr', video: { vimeo: '989005478' }, tile: loop('wrist-interaction') },
  { slug: '3d-calculator', title: '3D Calculator', blurb: 'Gesture math', focus: ['Gesture math'], group: 'xr', video: { vimeo: '1001763153' }, tile: loop('3d-calculator') },
  { slug: 'gauge-control', title: 'Gauge Control', blurb: 'VR/AR dials', focus: ['VR/AR dials'], group: 'xr', video: { vimeo: '982232014' }, tile: loop('gauge-control') },
  { slug: 'arrow-grid-system', title: 'Arrow Grid System', blurb: 'VR interaction', focus: ['VR interaction'], group: 'xr', video: { vimeo: '990364072' }, tile: loop('arrow-grid-system') },
  { slug: 'pinch-twist', title: 'Pinch Twist', blurb: 'Hand gesture', focus: ['Hand gesture'], group: 'xr', video: { vimeo: '990453573' }, tile: loop('pinch-twist') },
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
  media: p.tile ?? p.video,
});

// ---------- Home page ----------

// (02) Featured work: `featured`, at the end of this file (it uses the one-off tiles defined below).

// (03) XR and interaction: three wide clips in a row (all of them are on /work).
export const xr = {
  statement: 'Hands as the controller: gesture, pinch and twist.',
  clips: ['wrist-interaction', '3d-calculator', 'pinch-twist'].map((s) => tile(project(s), { withTag: false })),
};

// ---------- XR intro (/work, XR and interaction) ----------

// The intro of the XR section on /work. It opened the XR page, which became
// that section in Oct 2026 (/xr redirects to /work#xr). Written from the
// owner's placeholder (AR, VR, mixed reality, code); his tools list is verbatim.
export const xrIntro = {
  lead: 'My lab for augmented, virtual and mixed reality, and the code behind them.',
  body: 'It starts with one question: what if your hands were the controller? Everything here is a working prototype, from pinch and twist gestures to dials, grids and a calculator you reach out and use.',
  covers: 'AR · VR · Mixed reality',
  tools: 'Unity · Unreal Engine · Cinema 4D · C# · Python · Xcode',
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
  status: 'In development, not public yet',
  focus: ['three.js', 'Real-time 3D', 'Interactive'],
  group: 'interactive' as const,
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
      'One factory, three tabs.',
      'Order, where you spec a car and watch the line build it; Lesson, 15 short lessons and 3 challenges in what a toy costs to make and sell; and Ledger, a month you can run to watch the bank. It runs in the browser. Not public yet.',
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

/** HAS Toyline as a tile (the /work grid). Not the 10 MB film, which starts
 * downloading as soon as /work opens: an 8 s cut of it at 1280 px (1.5 MB), from
 * 8 s in, where the bare birch car is painted, printed and gets its wheels. */
export const toylineTile: WorkItem = {
  title: toyline.title,
  blurb: toyline.blurb,
  tag: 'three.js',
  href: `/work/${toyline.slug}`,
  media: { video: '/video/has-toyline-tile.mp4', poster: '/img/work/has-toyline/tile-poster.webp' },
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
  group: 'interactive' as const,
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

// ---------- HAS Records (/work/has-records) ----------

// A one-off page, like HAS Toyline: HAS Records is a desktop app (Unreal Engine,
// Mac and Windows), so the page adds stills and features to its video.
// A Rega Planar 6 RS modeled in Blender from published dimensions and played in
// Unreal Engine: drop the needle anywhere on side A and hear that moment of the
// song. Copy and stills from the project's case study package. The page plays the
// owner's newer Vimeo cut (`video`); its tiles and the home page keep the earlier
// 15 s cut (`tile`, served from this site, whole), on the owner's call (Oct 2026).
export const records = {
  slug: 'has-records',
  title: 'HAS Records',
  blurb: 'A turntable you can play, in Unreal Engine',
  role: 'Concept, Creative Direction, 3D Design, Development',
  focus: ['Unreal Engine', 'Blender', 'Interactive'],
  runsOn: 'Mac and Windows',
  group: 'interactive' as const,
  year: '2026',
  tagline: 'A turntable you can actually play.',
  video: { vimeo: '1237152596' },
  tile: loop('has-records'), // Vimeo 1237080035
  story: [
    { title: 'Vision', paras: [
      'I wanted to play a record, not just look at one.',
      'Most 3D turntables are props: a perfect render that never moves. I wanted one that works. Lift the arm, set the needle in a groove, and hear that exact moment of the song. So I modeled a Rega Planar 6 RS, gave it a HAS Records pressing, and built a listening room around it.',
    ] },
    { title: 'How It Grew', paras: [
      'First it had to look right. Then it had to work right.',
      'It started as a Blender model, built part by part from Rega’s published numbers: a 447 × 360 mm plinth, 222 mm from spindle to pivot, a 236.5 mm effective arm length. Once it looked right, it had to behave right. The platter had to turn at 33⅓, the arm had to swing on its own pivot, and every groove had to mean a moment in a song.',
    ] },
    { title: 'Creative Direction', paras: [
      'Quiet hardware, a warm label, and nothing that breaks the spell.',
      'A cool studio, a silver plinth and a black pressing, so the colour comes from the label: a sunset over the HAS Records wordmark on cream paper. The interface sits to one side and disappears when you want it to. The small things carry the feeling: the motor eases up to speed, the arm lifts before it travels, and a green light on the cartridge glows whenever the record turns.',
    ] },
    { title: 'Execution', paras: [
      'Modeled in Blender, played in Unreal Engine.',
      'The Blender scene is the source. Every part, pivot and material exports to a compact geometry file that Unreal assembles at startup, so the platter, tonearm and dustcover each move on their own axes. Six bands hold six songs, which makes the needle’s radius a timestamp: set it down a third of the way across band two, and band two plays from a third of the way in. Hardware ray-traced shadows keep the cartridge and platter edges soft and steady, and a built-in self-test runs 44 checks, from the stylus meeting the vinyl to the platter’s measured speed.',
    ] },
    { title: 'Outcome', paras: [
      'A Mac and Windows app, and a side that plays all the way through.',
      'HAS Records is an Unreal Engine app for Mac and Windows. Side A plays six songs end to end, the needle following the grooves inward without lifting, and the arm returns to rest when the side is done. The turntable is a reference-based reconstruction for the experience, not an official Rega product.',
    ] },
  ] as StoryBlock[],
  features: [
    { title: 'Drop the needle', body: 'Drag the head up to lift it and sideways to cue, from any angle. Let go over a groove and it plays from there.' },
    { title: 'Six songs, one side', body: 'Six bands on the pressing, six full songs. The needle’s position is the playback position, and it stays down from one song to the next.' },
    { title: '33⅓ rpm', body: 'The motor eases up to speed, the platter turns clockwise at 200° a second, and it coasts down when you pause.' },
    { title: 'A light at the stylus', body: 'A green LED on the cartridge lights while the record turns and casts a soft glow on the groove beneath it.' },
    { title: 'Lid, lift and return', body: 'The dustcover swings on its hinge pins, the cueing lift raises the arm, and Return parks it on its rest.' },
    { title: 'Your view', body: 'Orbit, zoom in close to the label, or hide the interface and just listen. The keyboard shortcuts keep working.' },
  ],
  // Figures in page order: close up, the Blender source, at the turntable, the app, taken apart.
  // The stills are rendered by the app itself; Figs. 03 and 07 by Blender.
  squares: [
    { src: '/img/work/has-records/label.webp', w: 1360, h: 1360, alt: 'Close-up of the HAS Records centre label: a sunset disc above the navy HAS Records wordmark on cream paper, on a black LP', caption: 'The HAS Records label, on cream paper.' },
    { src: '/img/work/has-records/stylus.webp', w: 1360, h: 1360, alt: 'The Nd9 cartridge in the groove, with a small green light glowing on its front and a faint green glow on the vinyl below', caption: 'The stylus light, on while the record turns.' },
  ] as Still[],
  model: { src: '/img/work/has-records/model.webp', w: 2400, h: 1350, alt: 'Blender render of the Rega Planar 6 RS with a HAS Records LP, its smoked dustcover raised and the Neo power supply beside it', caption: 'The Blender source: a Planar 6 RS, RB880 arm and Nd9 cartridge, 243 parts modeled from published dimensions.' } as Still,
  pair: [
    { src: '/img/work/has-records/cue.webp', w: 2400, h: 1350, alt: 'Low close-up of the tonearm lifted above the record, the stylus hovering over the grooves with its green light on', caption: 'Lifted for a hand cue, the platter still turning.' },
    { src: '/img/work/has-records/lid.webp', w: 2400, h: 1350, alt: 'The turntable with its smoked dustcover closed over the spinning HAS Records LP', caption: 'Dustcover down, side A still playing.' },
  ] as Still[],
  app: { src: '/img/work/has-records/app.webp', w: 2400, h: 1350, alt: 'HAS Records running: a Rega Planar 6 RS with its dustcover raised and a HAS Records LP playing, with the side A track list, transport buttons and volume in the panel on the right', caption: 'The listening room: side A in the panel, the record playing beside it.' } as Still,
  exploded: { src: '/img/work/has-records/exploded.webp', w: 2400, h: 1350, alt: 'Exploded Blender render: the dustcover, record, felt mat and glass platter floating in a stack above the bearing, the perforated brace and the plinth, with the tonearm and power supply in place', caption: 'Taken apart: dustcover, record and felt mat, glass platter, main bearing, brace and plinth.' } as Still,
  og: { src: '/img/og/has-records.jpg', alt: 'HAS Records: a Rega Planar 6 RS playing a HAS Records LP, its stylus light glowing green' },
};

/** HAS Records as a tile (home, /work, Related): its tile loop, like the other projects */
export const recordsTile: WorkItem = {
  title: records.title,
  blurb: records.blurb,
  tag: 'Unreal Engine',
  href: `/work/${records.slug}`,
  media: records.tile,
};

// ---------- Home page: featured work ----------

// (02) Featured work. Order is layout: the first item runs full width, the
// rest pair up in rows that alternate wide/narrow and narrow/wide, and a last
// one on its own runs full width. Here, after the one-off pages, because it uses
// their tiles (owner's order, Oct 2026: HAS Toyline, HAS Records, Splay,
// HAS Space, Van Gogh · The Bedroom, HAS LP-19, HAS Lathe).
const app = (title: string): WorkItem => {
  const t = tools.find((x) => x.title === title);
  if (!t) throw new Error(`No app "${title}" in tools (src/data/apps.ts)`);
  return { ...t, tag: 'Free app', note: undefined };
};

export const featured: WorkItem[] = [
  // The tile's subtitle is the page's, without the full stop, like the other captions
  { ...toylineTile, blurb: toyline.tagline.replace(/\.$/, '') },
  recordsTile,
  app('Splay'),
  spaceTile,
  ...['van-gogh-the-bedroom', 'has-lp-19'].map((s) => tile(project(s))),
  // An 8 s loop instead of its line drawing: a vessel on the wheel, turning from
  // vase (celadon glaze) to bottle (terracotta) to bowl (brass), rendered in the app
  { ...app('HAS Lathe'), media: { video: '/video/has-lathe-tile.mp4', poster: '/img/apps/lathe/tile-poster.webp' } },
];
