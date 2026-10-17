// One page per app at /apps/<slug>, all built by src/pages/apps/[slug].astro.
// `story` (Vision, Creative Direction, Execution, Outcome), `tagline` and
// `role` are the owner's own case-study copy (Oct 2026): keep them as written.
// Apps without a story yet show `lead` and `copy`, condensed from each app's
// has.tools showcase page (tools/<slug>.html). Images are real app output in public/img/apps/<app>/:
// a wide hero (7:3), the app at work (16:9) and two square stills.
import type { Media } from './media';
import type { StoryBlock } from './work';
import type { OgImage } from '../lib/seo';

export interface Still { src: string; w: number; h: number; alt: string; caption: string }

export interface AppPage {
  slug: string;        // URL: /apps/<slug>
  name: string;
  tagline: string;     // under the big title
  description: string; // search results and link previews
  appUrl: string;      // the app itself, on has.tools
  hero: Media;         // wide band at the top: a Vimeo loop or a still
  role?: string;       // "My role", shown first in the specs
  specs: [string, string][];
  story?: StoryBlock[];   // the case study, in the owner's words
  lead?: string;          // without a story: one big line...
  copy?: [string, string]; // ...why it exists (first person), then a muted line
  demo: Still;            // Fig. 01, the app at work (16:9)
  features: { title: string; body: string }[]; // six cards
  stills: [Still, Still]; // Fig. 02 and 03, square
  details: { title: string; lines: (string | [string, string])[] }[]; // three columns
  og: OgImage;            // 1200x630 link preview
}

const credits = {
  title: 'credits',
  lines: [['Design and direction', 'Hector Augusto Santizo'], ['Collection', 'HAS Tools'], ['Price', 'Free']] as [string, string][],
};

export const appPages: AppPage[] = [
  {
    slug: 'splay',
    name: 'Splay',
    tagline: 'Making complexity visible.',
    description: 'Splay: a free exploded-view studio in your browser. Import a STEP, GLB or OBJ model, choreograph how it comes apart on a timeline, and export an animated GLB.',
    appUrl: 'https://has.tools/apps/splay/',
    hero: { img: '/img/apps/splay/hero.webp' },
    role: 'Concept, Creative Direction, Interaction Design, Software Development',
    specs: [
      ['Type', 'Free browser app'],
      ['Version', 'v0.1 · prototype'],
      ['Imports', 'STEP · GLB · OBJ'],
      ['Exports', 'Animated GLB · PNG · MP4'],
      ['Part of', 'HAS Tools'],
    ],
    story: [
      { title: 'Vision', paras: [
        'Exploded views are one of the clearest ways to explain how a product works, but creating them can be surprisingly time-consuming.',
        'I wanted to simplify that process, giving designers a faster and more intuitive way to turn complex 3D assemblies into animated visual stories.',
      ] },
      { title: 'Creative Direction', paras: [
        'I approached Splay as a motion design tool rather than a traditional CAD application.',
        'The focus was on clarity, composition, and movement. How do parts separate? In what order? How can animation reveal the relationships between components without overwhelming the viewer?',
      ] },
      { title: 'Execution', paras: [
        'I designed and developed a browser-based application that imports STEP, GLB, and OBJ models and transforms them into editable exploded-view animations.',
        'Users can control individual parts, adjust their movement, create animation sequences on a timeline, add annotations, and export animated GLB files.',
      ] },
      { title: 'Outcome', paras: [
        'A working creative software prototype that makes technical visualization more accessible, connecting product design, animation, and interactive technology in one streamlined workflow.',
      ] },
    ],
    demo: { src: '/img/apps/splay/app.webp', w: 1600, h: 900, alt: 'Splay: the scene tree on the left, an exploded camera drone in the viewport, the inspector on the right and the timeline below', caption: 'The studio: the parts on the left, the exploded drone in the middle, the timeline below.' },
    features: [
      { title: 'Auto-explode', body: 'One click gives every part a starting direction. Refine any part’s vector and distance in the inspector.' },
      { title: 'Choreograph on a timeline', body: 'Stagger the parts, then add keyframes with easing where you want finer control.' },
      { title: 'Real CAD files', body: 'Reads STEP as well as GLB and OBJ, and groups the parts for you.' },
      { title: 'Labels and camera bookmarks', body: 'Label parts and bookmark camera angles for the money shot.' },
      { title: 'Take the animation anywhere', body: 'Export an animated GLB, or render the view as a PNG, an MP4 or a PNG sequence.' },
      { title: 'Stays on your machine', body: 'Everything runs in your browser. Projects save as .expl files, and autosave has your back between sessions.' },
    ],
    stills: [
      { src: '/img/apps/splay/assembled.webp', w: 1360, h: 1360, alt: 'A white camera drone with four propellers, assembled', caption: 'The demo drone, assembled.' },
      { src: '/img/apps/splay/exploding.webp', w: 1360, h: 1360, alt: 'The same drone coming apart: shell, propellers, motors, camera and circuit board separating in layers', caption: 'The same drone, a third of the way apart.' },
    ],
    details: [
      credits,
      { title: 'made for', lines: ['Product explainers', 'Any 3D pipeline', 'Web 3D viewers'] },
      { title: 'formats', lines: [['In', 'STEP, GLB, OBJ'], ['Out', 'animated GLB'], ['Renders', 'PNG, MP4, PNG sequence']] },
    ],
    og: { src: '/img/og/splay.jpg', alt: 'Splay: an exploded camera drone, its parts floating apart' },
  },
  {
    slug: 'has-lathe',
    name: 'HAS Lathe',
    tagline: 'A potter’s wheel for 3D models.',
    description: 'HAS Lathe: a free browser app that turns one section profile into a revolved 3D vessel.',
    appUrl: 'https://has.tools/apps/lathe/',
    hero: { vimeo: '1213074336' },
    specs: [
      ['Type', 'Free browser app'],
      ['Version', 'v2.0'],
      ['Runs', 'In your browser, on your machine'],
      ['Exports', 'GLB · glTF · OBJ'],
      ['Part of', 'HAS Tools'],
    ],
    lead: 'Draw one section profile and get a live, revolved vessel: vases, bowls, bottles and turned props, ready for your scene.',
    copy: [
      'I made HAS Lathe because modeling a simple vase should not mean opening a full 3D package. You shape one curve, and the app turns it into a clean, crease-aware mesh with real wall thickness.',
      'It is made for set dressing, turned props and product mockups. Take the result straight into Cinema 4D, Blender or Unreal.',
    ],
    demo: { src: '/img/apps/lathe/editor.webp', w: 1600, h: 900, alt: 'HAS Lathe: the section profile editor on the left, the revolved vase on the right, presets and settings in the side panel', caption: 'The editor: shape the profile on the left, the revolved vessel updates on the right.' },
    features: [
      { title: 'Shape the profile', body: 'Points can be smooth, sharp or filleted. Double-click a point to cycle it, then give it its own fillet radius.' },
      { title: 'Real walls, real rims', body: 'Walls are hollow with true thickness. Finish the rim square, flat, round or beveled.' },
      { title: 'Start from a preset', body: 'Vase, bowl, cup, bottle, plate and base get you most of the way in one click.' },
      { title: 'Real-world scale', body: 'Export GLB, glTF or OBJ in meters, centimeters or millimeters, with PBR material settings.' },
      { title: 'Stays on your machine', body: 'Everything runs in your browser. Your shapes never leave your computer.' },
      { title: 'Share a link', body: 'Send a link and it opens HAS Lathe with your exact design.' },
    ],
    stills: [
      { src: '/img/apps/lathe/vase-render.webp', w: 832, h: 832, alt: 'A pale celadon vase with a long narrow neck on a stone plinth', caption: 'A vase made in HAS Lathe, rendered.' },
      { src: '/img/apps/lathe/presets.webp', w: 1600, h: 1600, alt: 'Four HAS Lathe presets in celadon: a bowl, a cup, a bottle and a plate', caption: 'Bowl, cup, bottle and plate presets.' },
    ],
    details: [
      credits,
      { title: 'works with', lines: ['Cinema 4D', 'Blender', 'Unreal Engine', 'Product mockups'] },
      { title: 'formats', lines: ['GLB, glTF, OBJ', ['Units', 'm, cm, mm'], ['Materials', 'PBR settings']] },
    ],
    og: { src: '/img/og/has-lathe.jpg', alt: 'HAS Lathe: the section profile editor and the revolved vase it makes' },
  },
  {
    slug: 'has-sculpt',
    name: 'HAS Sculpt',
    tagline: 'Digital clay, without the complexity.',
    description: 'HAS Sculpt: free digital clay in your browser. Push, pull, crease and smooth a sphere into a character or a form study, then export a GLB.',
    appUrl: 'https://has.tools/apps/sculpt/',
    hero: { img: '/img/apps/sculpt/hero.webp' },
    role: 'Concept, Creative Direction, Interface Design, 3D Development',
    specs: [
      ['Type', 'Free browser app'],
      ['Version', 'v2.0'],
      ['Runs', 'In your browser, on your machine'],
      ['Exports', 'GLB'],
      ['Part of', 'HAS Tools'],
    ],
    story: [
      { title: 'Vision', paras: [
        'Sometimes a creative idea begins with nothing more than a shape.',
        'I wanted to make digital sculpting immediate and approachable, removing the setup and interface complexity that can interrupt the early stages of experimentation.',
      ] },
      { title: 'Creative Direction', paras: [
        'Inspired by the simplicity of working with physical clay, I designed the experience around direct interaction.',
        'The goal was to let the form take center stage, with tools that feel accessible while providing the control needed to develop more detailed shapes.',
      ] },
      { title: 'Execution', paras: [
        'I developed a browser-based sculpting application with interactive brushes, symmetry, masking, dynamic mesh detail, and remeshing.',
        'Users can push, pull, smooth, and reshape geometry, combine primitive forms, and export their creations as GLB models for further development in other 3D applications.',
      ] },
      { title: 'Outcome', paras: [
        'A lightweight creative environment for exploring characters, objects, and organic forms, demonstrating how sophisticated 3D technology can be presented through a simple, approachable interface.',
      ] },
    ],
    demo: { src: '/img/apps/sculpt/app.webp', w: 1600, h: 900, alt: 'HAS Sculpt: a terracotta clay head in the middle, the brushes on the left, size, strength and mirror settings on the right', caption: 'The studio: brushes on the left, the clay in the middle, size, strength and mirror on the right.' },
    features: [
      { title: 'Nine brushes', body: 'Clay, brush, inflate, smooth, flatten, pinch, crease, drag and scale, on the keys 1 to 9.' },
      { title: 'Mirror symmetry', body: 'On by default, on any axis. Or copy one half of the model onto the other.' },
      { title: 'Detail where you work', body: 'Dynamic detail adds triangles only where you sculpt. Remesh when the surface gets stretched.' },
      { title: 'Masks and shapes', body: 'Paint a mask to protect an area. Place spheres, boxes, cylinders, capsules or tori and weld them in.' },
      { title: 'Nothing gets lost', body: 'Your work autosaves in the browser, with earlier versions you can recover, and every step can be undone.' },
      { title: 'Stays on your machine', body: 'Everything runs in your browser. Save a project file to carry a sculpture between machines.' },
    ],
    stills: [
      { src: '/img/apps/sculpt/front.webp', w: 1200, h: 1200, alt: 'A terracotta clay head sculpted from a sphere: brow, closed eyes, nose, lips and chin', caption: 'A head sculpted from the starting sphere, in terracotta.' },
      { src: '/img/apps/sculpt/plaster.webp', w: 1200, h: 1200, alt: 'The same clay head in white plaster, turned to a three-quarter view', caption: 'The same head in plaster, turned three-quarters.' },
    ],
    details: [
      credits,
      { title: 'works with', lines: ['Cinema 4D', 'Blender', 'Unreal Engine'] },
      { title: 'formats', lines: [['Out', 'GLB'], ['In', 'GLB'], ['Projects', 'project file, autosave']] },
    ],
    og: { src: '/img/og/has-sculpt.jpg', alt: 'HAS Sculpt: a clay head sculpted in the browser' },
  },
  {
    slug: 'has-truss',
    name: 'HAS Truss',
    tagline: 'From a line to a structure.',
    description: 'HAS Truss: a free 3D truss generator in your browser. Draw a curve, pick a profile, and export a tubed truss as GLB, glTF or OBJ.',
    appUrl: 'https://has.tools/apps/truss/',
    hero: { img: '/img/apps/truss/hero.webp' },
    role: 'Concept, Creative Direction, Procedural Design, Software Development',
    specs: [
      ['Type', 'Free browser app'],
      ['Version', 'v1.2'],
      ['Profiles', 'Square · Triangle · Ladder'],
      ['Exports', 'GLB · glTF · OBJ'],
      ['Part of', 'HAS Tools'],
    ],
    story: [
      { title: 'Vision', paras: [
        'Complex structures often begin with simple lines.',
        'I wanted to explore how a single curve could become a complete 3D truss system, eliminating the repetitive modeling traditionally required for stage, event, and exhibition visualization.',
      ] },
      { title: 'Creative Direction', paras: [
        'The guiding idea was to make structure generation feel more like drawing than engineering.',
        'Rather than building every component individually, users define the overall shape while the application handles the repeating geometric elements.',
      ] },
      { title: 'Execution', paras: [
        'I developed a procedural 3D generator that transforms editable curves into detailed truss geometry.',
        'Users can create straight runs, arches, and custom paths, select different structural profiles, adjust dimensions and materials, and export models for visualization in other 3D environments.',
      ] },
      { title: 'Outcome', paras: [
        'A practical tool for rapid concept development and visualization, demonstrating how procedural modeling can simplify repetitive production tasks while preserving creative control.',
      ] },
    ],
    demo: { src: '/img/apps/truss/app.webp', w: 1600, h: 900, alt: 'HAS Truss: the path editor and profile settings on the left, an arched square truss in the viewport', caption: 'The studio: draw the path on the left, the truss builds along it on the right.' },
    features: [
      { title: 'Draw the path', body: 'Start from a preset (straight, arch, S-curve, L, U or circle) or draw your own bezier path.' },
      { title: 'Three profiles', body: 'Square, triangle or ladder. Chords, diagonals, braces and end caps are built bay by bay along the curve.' },
      { title: 'Live dimensions', body: 'Width, height, bay density, curve resolution and tube diameters are live sliders, in meters.' },
      { title: 'Six finishes', body: 'Aluminum, raw steel, galvanized, matte black, Corten and white, previewed in a lit viewport.' },
      { title: 'Share a link', body: 'Send a link and it opens your exact truss on any device. The design lives in the link itself.' },
      { title: 'Stays on your machine', body: 'Everything runs in your browser. Exports carry a time stamp, so re-exports never overwrite each other.' },
    ],
    stills: [
      { src: '/img/apps/truss/s-curve.webp', w: 1360, h: 1360, alt: 'An S-shaped truss with a triangle profile in rust-colored Corten steel', caption: 'An S-curve with a triangle profile, in Corten.' },
      { src: '/img/apps/truss/ring.webp', w: 1360, h: 1360, alt: 'A full ring of square truss in white', caption: 'A full ring, square profile, in white.' },
    ],
    details: [
      credits,
      { title: 'works with', lines: ['Cinema 4D', 'Blender', 'Unreal Engine', 'Unity'] },
      { title: 'formats', lines: ['GLB, glTF, OBJ', ['Units', 'meters, real scale'], ['Made for', 'stage design, previs, set dressing']] },
    ],
    og: { src: '/img/og/has-truss.jpg', alt: 'HAS Truss: an aluminum truss arch' },
  },
  {
    slug: 'has-gallery',
    name: 'HAS Gallery',
    tagline: 'From floor plan to experience.',
    description: 'HAS Gallery: draw a floor plan in 2D, hang artwork on the walls, walk through at eye level, and export the gallery as a GLB. Free, in your browser.',
    appUrl: 'https://has.tools/apps/gallery/',
    hero: { img: '/img/apps/gallery/hero.webp' },
    role: 'Concept, Creative Direction, UX Design, 3D Development',
    specs: [
      ['Type', 'Free browser app'],
      ['Version', 'v1.0'],
      ['Runs', 'In your browser, on your machine'],
      ['Exports', 'GLB · glTF · PNG · JSON'],
      ['Part of', 'HAS Tools'],
    ],
    story: [
      { title: 'Vision', paras: [
        'Designing an exhibition should be as intuitive as imagining the space itself.',
        'I wanted to create a tool that allows artists, designers, and curators to explore spatial ideas without the complexity of traditional architectural software.',
      ] },
      { title: 'Creative Direction', paras: [
        'The concept was simple: draw in two dimensions, experience in three.',
        'I focused on making the transition between planning and visualization feel immediate. Walls, openings, artwork, and lighting become part of a space that can be explored as it takes shape.',
      ] },
      { title: 'Execution', paras: [
        'I developed an interactive browser application that translates 2D floor plans into navigable 3D environments.',
        'Users can create walls, add doors and windows, position artwork, explore the gallery at eye level, and export their designs for use in other 3D applications.',
      ] },
      { title: 'Outcome', paras: [
        'A creative tool that brings spatial planning and real-time visualization together, making it easier to explore, communicate, and refine exhibition concepts before they exist physically.',
      ] },
    ],
    demo: { src: '/img/apps/gallery/app.webp', w: 1600, h: 900, alt: 'HAS Gallery: the floor plan on the left, the same room in 3D in the middle with photographs on the walls, properties on the right', caption: 'The studio: the 2D plan on the left, the 3D gallery builds itself beside it.' },
    features: [
      { title: 'Draw the plan', body: 'Walls with W, doors with D, windows with G. Snap keeps the corners tight.' },
      { title: 'A live 3D preview', body: 'The space builds itself beside the plan, with real wall heights, doors, windows and a sun angle.' },
      { title: 'Hang art by dropping it', body: 'Drop an image near a wall and it hangs there at real-world scale, on the side you dropped it.' },
      { title: 'Walk through it', body: 'Drop a hotspot, then move through the gallery at eye level.' },
      { title: 'Export the space', body: 'GLB or glTF for 3D apps and the web, a PNG of the plan, or JSON to keep working later.' },
      { title: 'Stays on your machine', body: 'Everything runs in your browser. Your plans and images never leave your computer.' },
    ],
    stills: [
      { src: '/img/apps/gallery/overview.webp', w: 936, h: 936, alt: 'A white gallery room seen from above, Burning Man photographs hung on the walls and on a partition in the middle', caption: 'A gallery hung with my Burning Man photos, ceiling off.' },
      { src: '/img/apps/gallery/walk.webp', w: 936, h: 936, alt: 'Eye-level view of a framed photograph of a sculpted face and fist rising from the playa, hung on a white wall', caption: 'Walk mode, at eye level.' },
    ],
    details: [
      credits,
      { title: 'works with', lines: ['Cinema 4D', 'Blender', 'Unreal Engine', 'The web'] },
      { title: 'formats', lines: [['3D', 'GLB, glTF'], ['Plan', 'PNG'], ['Project', 'JSON']] },
    ],
    og: { src: '/img/og/has-gallery.jpg', alt: 'HAS Gallery: walking through a white gallery hung with Burning Man photographs' },
  },
];

export const appPage = (slug: string) => {
  const p = appPages.find((x) => x.slug === slug);
  if (!p) throw new Error(`No app page "${slug}" in src/data/app-pages.ts`);
  return p;
};
