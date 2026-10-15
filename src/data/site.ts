// Site-wide content: identity, navigation, reel, intro copy, footer links.
// Copy rule: no em dashes. Use commas, colons, or the middot ( · ).

export const site = {
  name: 'Santizo',
  person: 'Hector Augusto Santizo',
  title: 'Santizo · Hector Augusto Santizo',
  description: 'Hector Augusto Santizo, 3D motion designer and creative technologist in Los Angeles.',
  role: '3D motion designer',
  city: 'Los Angeles',
  email: 'hector@santizo.com',
  practice: 'Santizo LLC',
  region: 'Los Angeles, California',

  // While this is version B (not yet on santizo.com), keep search engines out
  // so it never competes with the live site. Flip to true at launch.
  indexable: false,
};

// Top bar links, left to right. Keep it short: four links fit on a phone.
// "Contact" jumps to the footer of the current page.
export const nav = [
  { label: 'Work', href: '/#work' },
  { label: 'XR', href: '/#xr' },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: '#contact' },
];

export const reel = {
  vimeo: '1216889002',
  title: 'Santizo Reel 2026',
  credits: 'Art direction · Sim · Lighting',
  href: 'https://vimeo.com/1216889002',
};

export const intro = {
  headline: 'Moving images, in three dimensions.',
  lead: 'I’m Hector Augusto Santizo, a 3D motion designer and creative technologist in Los Angeles. Fifteen years where design, animation and 3D overlap, including a decade leading creative services at a major music company.',
  body: 'Teams bring me ideas they can’t quite see yet. I make them visible, then I make them work: 3D animation, real-time and XR.',
  cta: { label: 'Start a project →', href: '#contact' },
};

export interface FooterLink { label: string; href: string }

export const footer = {
  headline: 'Have something that should move?',
  elsewhere: [
    { label: 'Instagram ↗', href: 'https://www.instagram.com/has_projects/' },
    { label: 'YouTube ↗', href: 'https://www.youtube.com/@has.studio' },
    { label: 'LinkedIn ↗', href: 'https://www.linkedin.com/in/santizo/' },
  ] as FooterLink[],
  tools: [
    { label: 'has.tools ↗', href: 'https://www.has.tools' },
    { label: 'HAS Lathe', href: '/apps/has-lathe' },
  ] as FooterLink[],
  // Boring mode lives on the current site (version A).
  boring: { label: 'Boring mode', href: 'https://santizo.com/boring.html' },
};
