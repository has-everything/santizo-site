// Render a seamless explode loop from the HAS Explode harness (localhost:5177),
// one PNG per frame, from a fixed camera that sways gently.
// Usage: node splay-frames.mjs <config.json> <test|full>
// config: { model, axis, spacing, preset, orbit, sway, elevation, zoom, seconds, fps, prefix }
// Timeline (fractions of the loop): hold assembled, explode, hold exploded, collapse, hold.
// The camera orbit is orbit + sway * sin(2πt), so the last frame meets the first.
import { readFileSync } from 'node:fs';
import { chromium } from '/Users/augustosantizo/Desktop/DesktopProjects/HAS_Video_Editor/node_modules/playwright-core/index.mjs';

const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const mode = process.argv[3] ?? 'test';
const call = async (name, args) => {
  const r = await fetch('http://localhost:5177/call', { method: 'POST', body: JSON.stringify({ name, arguments: args }) });
  return r.text();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const [h0, e1, h1, c1] = cfg.timeline ?? [0.08, 0.42, 0.62, 0.94];
const amountAt = (t) => {
  if (t < h0) return 0;
  if (t < e1) return ease((t - h0) / (e1 - h0));
  if (t < h1) return 1;
  if (t < c1) return 1 - ease((t - h1) / (c1 - h1));
  return 0;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5177/');
await sleep(3000);
console.log((await call('explode_open', { path: cfg.model })).slice(0, 80));
await sleep(4000);
await call('explode_style', { labels: false, look: 'original', background: 'ink', edges: false });
await call('explode_set', { amount: 0, axis: cfg.axis, spacing: cfg.spacing });

const fps = cfg.fps ?? 30;
const total = Math.round((cfg.seconds ?? 8) * fps);
const frames = mode === 'test'
  ? [0, Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75)]
  : [...Array(total).keys()];
const t0 = Date.now();
for (const i of frames) {
  const t = i / total;
  await call('explode_set', { amount: Number(amountAt(t).toFixed(4)) });
  await call('explode_view', { preset: cfg.preset, orbit_deg: cfg.orbit + cfg.sway * Math.sin(2 * Math.PI * t), elevation_deg: cfg.elevation, zoom: cfg.zoom });
  await sleep(cfg.settle ?? 150);
  const out = await call('explode_export', { format: 'png', resolution: '1080', file_name: `${cfg.prefix}${String(i).padStart(4, '0')}` });
  if (!out.includes('Saved PNG')) console.log('frame', i, out.slice(0, 200));
  if (i % 30 === 0) console.log(`frame ${i}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
