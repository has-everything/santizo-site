// "Related": three tiles at the end of every project and app page, picked by
// hand for what they share with the page they sit on (tools, subject, craft).
// Keys and values are page paths. A page without an entry shows the next
// three in its own list (see `nextThree`), so a new project never breaks.
import { projects, tile, toyline, toylineTile, spaceTile, recordsTile, type WorkItem } from './work';
import { tools } from './apps';

// Every page that can appear as a related tile, by path. No tags (three across
// leaves no room for them), no notes; HAS Toyline shows its poster, not its
// 10 MB capture, so a page doesn't download it just for the last row.
const tiles = new Map<string, WorkItem>([
  ...projects.map((p) => tile(p, { withTag: false })).map((t) => [t.href, t] as const),
  [toylineTile.href, { ...toylineTile, tag: undefined, media: { img: toyline.film.poster } }],
  [recordsTile.href, { ...recordsTile, tag: undefined }],
  ...tools.map((t) => [t.href, { ...t, tag: undefined, note: undefined }] as const),
  // after `tools`, so HAS Space's tile shows its render, not its Apps card (the interface)
  [spaceTile.href, { ...spaceTile, tag: undefined }],
]);

const picks: Record<string, string[]> = {
  // Motion and animation
  '/work/santizo-reel-2026': ['/work/van-gogh-the-bedroom', '/work/has-lp-19', '/work/star-trails'],
  '/work/has-lp-19': ['/work/has-toyline', '/work/roboto', '/apps/has-lathe'],
  '/work/star-trails': ['/work/santizo-reel-2026', '/work/evidence-of-existence', '/work/visual-alternatives'],
  '/work/evidence-of-existence': ['/work/star-trails', '/work/van-gogh-the-bedroom', '/work/arrow-grid-system'],
  '/work/visual-alternatives': ['/work/real-time-interactive-app', '/work/roboto', '/work/star-trails'],
  '/work/real-time-interactive-app': ['/work/visual-alternatives', '/work/roboto', '/work/van-gogh-the-bedroom'],
  '/work/roboto': ['/work/has-toyline', '/work/real-time-interactive-app', '/work/visual-alternatives'],
  // Interactive and real-time
  '/work/has-toyline': ['/apps/splay', '/work/has-lp-19', '/work/roboto'],
  '/work/has-records': ['/work/van-gogh-the-bedroom', '/work/has-lp-19', '/apps/splay'],
  '/work/van-gogh-the-bedroom': ['/work/has-space', '/work/real-time-interactive-app', '/work/evidence-of-existence'],
  '/work/has-space': ['/apps/has-gallery', '/work/van-gogh-the-bedroom', '/work/has-toyline'],
  // XR and interaction
  '/work/has-photo-booth': ['/work/hand-tracker', '/work/wrist-interaction', '/work/pinch-twist'],
  '/work/hand-tracker': ['/work/has-photo-booth', '/work/pinch-twist', '/work/3d-calculator'],
  '/work/wrist-interaction': ['/work/pinch-twist', '/work/3d-calculator', '/work/hand-tracker'],
  '/work/3d-calculator': ['/work/gauge-control', '/work/pinch-twist', '/work/wrist-interaction'],
  '/work/gauge-control': ['/work/arrow-grid-system', '/work/3d-calculator', '/work/wrist-interaction'],
  '/work/arrow-grid-system': ['/work/gauge-control', '/work/evidence-of-existence', '/work/pinch-twist'],
  '/work/pinch-twist': ['/work/wrist-interaction', '/work/hand-tracker', '/work/3d-calculator'],
  // Apps
  '/apps/splay': ['/work/has-toyline', '/work/has-lp-19', '/apps/has-truss'],
  '/apps/has-lathe': ['/apps/has-sculpt', '/work/has-lp-19', '/apps/splay'],
  '/apps/has-sculpt': ['/apps/has-lathe', '/work/roboto', '/apps/splay'],
  '/apps/has-truss': ['/apps/has-gallery', '/apps/splay', '/apps/has-lathe'],
  '/apps/has-gallery': ['/work/has-space', '/work/van-gogh-the-bedroom', '/apps/has-truss'],
};

/** The next three paths after `path` in `list`, wrapping around (the fallback). */
export const nextThree = (list: string[], path: string) => {
  const i = list.indexOf(path);
  return [1, 2, 3].map((k) => list[(i + k) % list.length]).filter((p) => p !== path);
};

/** Three related tiles for the page at `path`. */
export function related(path: string, fallback: string[]): WorkItem[] {
  return (picks[path] ?? fallback).slice(0, 3).map((href) => {
    const t = tiles.get(href);
    if (!t) throw new Error(`related: no page "${href}" (src/data/related.ts)`);
    return t;
  });
}
