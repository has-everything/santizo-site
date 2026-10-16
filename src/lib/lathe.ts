// The HAS Lathe vessel drawn on the home page's HAS Lathe tile. Edit RINGS
// to reshape it.

// [rx, ry] per ring, top to bottom: rx is the radius, ry the ellipse depth.
export const RINGS: readonly [number, number][] = [
  [110, 18], [95, 15], [84, 13], [80, 13], [92, 15], [120, 19], [152, 24],
  [180, 29], [200, 32], [213, 34], [222, 36], [226, 36], [224, 36], [218, 35],
  [207, 33], [192, 31], [176, 28], [160, 26], [148, 24], [140, 22], [136, 22],
];

export const STEP = 28;           // vertical distance between rings
export const LAST = RINGS.length - 1;

export interface Ring { cx: number; cy: number; rx: number; ry: number }

export function rings(cx: number, top: number): Ring[] {
  return RINGS.map(([rx, ry], i) => ({ cx, cy: top + i * STEP, rx, ry }));
}

/** Points along one side of the vessel: side 1 = right, -1 = left. */
export function side(cx: number, top: number, dir: 1 | -1, scale = 1): [number, number][] {
  return RINGS.map(([rx], i) => [Math.round(cx + dir * rx * scale), top + i * STEP]);
}

export function pathD(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
}
