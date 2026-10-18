// Site-wide content: identity, navigation, reel, intro copy, footer links.
// Copy rule: no em dashes. Use commas, colons, or the middot ( · ).

export const site = {
  name: 'Santizo',
  person: 'Hector Augusto Santizo',
  title: 'Santizo · Hector Augusto Santizo',
  // Home page description in search results and link previews (other pages set their own)
  description: 'Hector Augusto Santizo, creative technologist in Los Angeles: creative direction, 3D animations that explain products, real-time and XR work, and free creative tools.',
  // Footer line and structured data (Oct 2026: creative technologist first,
  // creative direction and 3D motion as the disciplines, see intro.roles)
  role: 'Creative technologist',
  city: 'Los Angeles',
  email: 'hector@santizo.com',
  region: 'Los Angeles, California',

  // Live on santizo.com since October 2026: search engines may index it, and
  // every absolute URL (canonical, link previews, JSON-LD, sitemap) points at
  // www.santizo.com (`site` in astro.config.mjs). Set false to hide a copy of the site (noindex everywhere).
  indexable: true,
};

// Top bar links, left to right. Keep it short so it fits on a phone.
export const nav = [
  { label: 'Work', href: '/work' },
  { label: 'XR', href: '/xr' },
  { label: 'Apps', href: '/apps' },
  { label: 'Burning Man', href: '/burning-man' },
  { label: 'Info', href: '/info' },
];

export const reel = {
  vimeo: '1216889002',
  // Optional direct MP4 of the reel. In Vimeo: the video's settings, ⋯ menu,
  // Video file links, then Copy link on the 1080p version. When set, the hero
  // plays this file instead of the Vimeo loop, which lets Play reel have sound
  // on iPhones too. When empty, Play reel unmutes the Vimeo loop (desktop), and
  // iPhones and iPads open the reel's page instead (href below).
  file: '',
  poster: '', // optional still shown while the file loads, e.g. '/img/reel-poster.jpg'
  title: 'Santizo Reel 2026',
  credits: 'Direction · Design · Animation',
  // The reel's own page on this site (its project in src/data/work.ts), where it
  // plays with sound and controls. Play reel goes here on iPhones and iPads,
  // when a browser refuses sound on the hero, and without JavaScript.
  href: '/work/santizo-reel-2026',
};

// Home page About block. The owner's positioning (Oct 2026): creative
// technologist first, creative direction as a discipline rather than a title,
// leadership in the present tense with UMG as the track record.
export const intro = {
  headline: 'Moving images, in three dimensions.',
  roles: 'Creative Technologist · 3D & Motion',
  paras: [
    'I’m Hector Santizo. I make complex things simple to see and simple to use: 3D animations that explain products, real-time experiences, and tools for creative people.',
    'I lead each project from the first sketch to launch, combining creative direction with hands-on 3D, motion and prototyping. Previously Director of Creative Services at Universal Music Group.',
  ],
};

// Info's opening: the same positioning, a little fuller
export const about = {
  lead: 'I’m Hector Santizo, a creative technologist in Los Angeles. I make complex things simple to see and simple to use.',
  body: [
    'I make 3D animations that explain products, real-time experiences, and tools for creative people. I lead each project from the first sketch to launch, combining creative direction with hands-on 3D, motion and prototyping.',
    'Before this I spent a decade as Director of Creative Services at Universal Music Group, leading in-house teams and outside designers. Today I create 3D product animations and real-time visuals for Sonance, and HAS Tools, free creative tools that run in the browser.',
  ],
  education: 'BA Graphic Design, California State University, Northridge',
};

// The owner's five rules (manifesto.txt in SantizoOS), shown on Info under
// "How I work". The last line pairs with the Burning Man link below the list.
export const howIWork = [
  'Show a working prototype, it speaks for itself.',
  'Weird ideas welcome, shipped ideas better.',
  'Make tech inspire people, every frame on purpose.',
  'Clear beats clever, simple beats optimal.',
  'When in doubt, add dust: texture makes it real.',
];

export interface FooterLink { label: string; href: string }

export const footer = {
  headline: 'Got something complex? Let’s make it clear.',
  elsewhere: [
    { label: 'Instagram ↗', href: 'https://www.instagram.com/has_projects/' },
    { label: 'YouTube ↗', href: 'https://www.youtube.com/@has.studio' },
    { label: 'LinkedIn ↗', href: 'https://www.linkedin.com/in/santizo/' },
  ] as FooterLink[],
  tools: [
    { label: 'has.tools ↗', href: 'https://has.tools' },
    { label: 'All apps', href: '/apps' },
  ] as FooterLink[],
  // SantizoOS (the retro desktop site, version A) as an alternate mode. Its
  // vercel.app address keeps working after santizo.com moves to this site.
  os: { label: 'OS mode ↗', href: 'https://santizo-os.vercel.app' },
};
