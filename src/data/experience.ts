// Experience on Info, and the company line on the home page. From the owner's
// resume (Oct 2026): companies, titles and years as he lists them; the notes
// are condensed from his resume bullets. Never invent clients, numbers or titles.

export interface Job {
  company: string;
  role: string;
  years: string;
  note: string;
  /** Show in the home page's company line (employers, not his own projects) */
  home?: boolean;
}

export const experience: Job[] = [
  {
    company: 'HAS Tools',
    role: 'Creator · Independent',
    years: '2026 to now',
    note: 'Free creative tools that run in the browser. I designed the brand and every app, from the first idea to release.',
  },
  {
    company: 'Sonance',
    role: '3D Animator / Designer · Technology & Innovation Task Force',
    years: '2024 to now',
    note: 'Concepts, style frames, photoreal 3D and animation for architectural and commercial audio products, plus real-time Unreal Engine workflows for faster lighting and material reviews.',
    home: true,
  },
  {
    company: 'Intuit',
    role: 'XR, UX and 3D Motion Designer',
    years: '2023',
    note: 'Stylized 3D environments, characters and assets for real-time and immersive experiences, with product, engineering and research teams.',
    home: true,
  },
  {
    company: 'Neato Robotics',
    role: '3D Motion Designer',
    years: '2021 to 2022',
    note: 'Product animation for social media and the Neato app, with Marketing and UX.',
    home: true,
  },
  {
    company: 'Phillips Industries',
    role: 'Senior Motion Designer',
    years: '2019 to 2020',
    note: 'Motion concepts for new product lines and campaigns, with Marketing, Sales, Engineering and Product.',
    home: true,
  },
  {
    company: 'Universal Music Group',
    role: 'Director, Creative Services',
    years: '2007 to 2017',
    note: 'Led in-house creative teams and outside designers, from strategy through production, for global audiences.',
    home: true,
  },
  {
    company: '3M',
    role: 'Multimedia Designer',
    years: '2005 to 2007',
    note: 'Interactive, print, web and video for dental products.',
    home: true,
  },
];

/** The home page's company line, most recent first */
export const companies = experience.filter((j) => j.home).map((j) => j.company);
