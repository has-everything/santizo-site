// What fills a tile or frame. Pick one per item:
//   { vimeo: '1216889002' }                          Vimeo clip as a muted background loop
//   { video: '/video/clip.mp4', poster: '/img/p.jpg' } self-hosted clip (put files in public/)
//   { art: 'lathe' }                                  a line drawing from src/components/art

export type ArtName = 'lathe';

export type Media =
  | { vimeo: string }
  | { video: string; poster?: string }
  | { art: ArtName };
