// Site-wide content: identity, navigation, reel, intro copy, footer links.
// Copy rule: no em dashes. Use commas, colons, or the middot ( · ).

export const site = {
  name: 'Santizo',
  person: 'Hector Augusto Santizo',
  title: 'Santizo · Hector Augusto Santizo',
  // Home page description in search results and link previews (other pages set their own)
  description: 'Hector Augusto Santizo, 3D motion designer and creative technologist in Los Angeles. 3D animation, real-time and XR work, and free tools for creative people.',
  role: '3D motion designer',
  city: 'Los Angeles',
  email: 'hector@santizo.com',
  region: 'Los Angeles, California',

  // While this is version B (not yet on santizo.com), keep search engines out
  // so it never competes with the live site. Flip to true at launch.
  indexable: false,
};

// Top bar links, left to right. Keep it short so it fits on a phone.
export const nav = [
  { label: 'Work', href: '/work' },
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
  credits: 'Art direction · Sim · Lighting',
  // The reel's own page on this site (its project in src/data/work.ts), where it
  // plays with sound and controls. Play reel goes here on iPhones and iPads,
  // when a browser refuses sound on the hero, and without JavaScript.
  href: '/work/santizo-reel-2026',
};

export const intro = {
  headline: 'Moving images, in three dimensions.',
  // Also the opening line on Info
  lead: 'I’m Hector Santizo, a 3D motion designer and creative technologist living in Los Angeles. I’ve spent fifteen years working where design, art, and technology meet, ten of them leading creative services at Universal Music Group.',
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
  headline: 'Have something that should move?',
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
