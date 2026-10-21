// Render a seamless HAS Lathe loop: the vessel morphs vase → bottle → bowl → vase
// while the camera circles it once, like a potter's wheel. Drives the app's own
// modules (Vite dev server on localhost:5191) in a headless Chrome and saves one
// PNG of the 3D view per frame.
// Usage: node lathe-frames.mjs <out dir> <test|full>
import { mkdirSync } from 'node:fs';
import { chromium } from '/Users/augustosantizo/Desktop/DesktopProjects/HAS_Video_Editor/node_modules/playwright-core/index.mjs';

const out = process.argv[2];
const mode = process.argv[3] ?? 'test';
mkdirSync(out, { recursive: true });
const SECONDS = 8, FPS = 30, TOTAL = SECONDS * FPS;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });
await page.goto('http://localhost:5191/');
await page.waitForFunction(() => document.getElementById('loading')?.offsetParent === null || document.getElementById('loading')?.style.display === 'none', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

// Only the 3D view, full window
await page.addStyleTag({ content: `
  body > *:not(#viewPane):not(.main):not(main) { visibility: hidden !important; }
  #viewPane { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 99999 !important; visibility: visible !important; border: 0 !important; border-radius: 0 !important; margin: 0 !important; }
  #viewPane > :not(canvas) { display: none !important; }
  #viewCanvas { width: 100% !important; height: 100% !important; }
` });

await page.evaluate(async ({ SECONDS }) => {
  const S = await import('/src/state.js');
  const C = await import('/src/config.js');
  const P = await import('/src/profile.js');
  const V = await import('/src/viewer3d.js');
  const E = await import('/src/events.js');
  V.resize3d();

  // Each preset's finished curve (the app's own smoothing), resampled to matching
  // points: the base (centre to foot) as 6 points, the wall (foot to rim) as 90.
  const resample = (pts, n) => {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = L[L.length - 1], res = [];
    for (let k = 0; k < n; k++) {
      const d = (total * k) / (n - 1);
      let i = 1; while (i < L.length - 1 && L[i] < d) i++;
      const t = L[i] === L[i - 1] ? 0 : (d - L[i - 1]) / (L[i] - L[i - 1]);
      res.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
    }
    return res;
  };
  const curveOf = (name) => {
    S.state.points = C.PRESETS[name].map(C.mkPoint);
    S.state.smoothing = 3;
    const c = P.smoothedProfile().map((p) => ({ x: p.x, y: p.y }));
    const foot = c.findIndex((p, i) => i > 0 && p.y > 0.01) - 1; // last point on the floor
    const base = resample(c.slice(0, foot + 1), 6);
    const wall = resample(c.slice(foot), 90);
    return [...base, ...wall.slice(1)];
  };
  const shapes = ['vase', 'bottle', 'bowl'].map(curveOf);
  S.state.smoothing = 0;
  const heights = shapes.map((s) => Math.max(...s.map((p) => p.y)));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const theta0 = V.orbit.theta;
  V.orbit.r = 400;
  // A material per shape, blended with the morph: celadon glaze, terracotta, brass
  const mats = ['glaze', 'clay', 'metal'].map((k) => C.MATERIALS[k]);
  const col = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lerp = (a, b, m) => a + (b - a) * m;

  window.__setFrame = (t) => {
    const seg = Math.floor(t * 3) % 3, local = t * 3 - Math.floor(t * 3);
    const hold = 0.35;
    const m = local < hold ? 0 : ease((local - hold) / (1 - hold));
    const a = shapes[seg], b = shapes[(seg + 1) % 3];
    S.state.points = a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * m, y: p.y + (b[i].y - p.y) * m, type: 'sharp', radius: 6 }));
    const h = heights[seg] + (heights[(seg + 1) % 3] - heights[seg]) * m;
    V.orbit.target.y = h * 0.5;
    V.orbit.theta = theta0 + 2 * Math.PI * t;
    const ma = mats[seg], mb = mats[(seg + 1) % 3], ca = col(ma.color), cb = col(mb.color);
    V.material.color.setRGB(lerp(ca[0], cb[0], m), lerp(ca[1], cb[1], m), lerp(ca[2], cb[2], m), 'srgb');
    V.material.roughness = lerp(ma.rough, mb.rough, m);
    V.material.metalness = lerp(ma.metal, mb.metal, m);
    V.material.clearcoat = lerp(ma.coat, mb.coat, m);
    S.dirty();
    E.emit('render');
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
}, { SECONDS });

const frames = mode === 'test' ? [0, 40, 80, 120, 160, 200] : [...Array(TOTAL).keys()];
const t0 = Date.now();
for (const i of frames) {
  await page.evaluate((t) => window.__setFrame(t), i / TOTAL);
  await page.screenshot({ path: `${out}/lt_${String(i).padStart(4, '0')}.png` });
  if (i % 60 === 0) console.log(`frame ${i}/${TOTAL} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
