// What fills a tile or frame. Pick one per item:
//   { vimeo: '1216889002' }                          Vimeo clip as a muted background loop
//   { youtube: 'FrM8C7vHTow' }                       YouTube video, shown as its thumbnail
//   { video: '/video/clip.mp4', poster: '/img/p.jpg' } self-hosted clip (put files in public/)
//   { art: 'lathe' }                                  a line drawing from src/components/art
//   { img: '/img/apps/splay.webp' }                   a still image (put files in public/)

export type ArtName = 'lathe';

export type Media =
  | { vimeo: string }
  | { youtube: string }
  | { video: string; poster?: string }
  | { art: ArtName }
  | { img: string };
