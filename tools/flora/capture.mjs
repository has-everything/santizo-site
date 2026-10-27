// HAS Flora's stills, captured from the app itself (has-flora_V3.html, one HTML file) in a
// headless Chrome (Playwright, `channel: 'chrome'`), set through its own URL parameters
// (?species=&seed=&place=) and its `window.flora.state`. Not part of the site build. The
// Playwright import path points at a local install (HAS_Video_Editor); change it to yours.
//
// Usage: node capture.mjs <path to has-flora_V3.html> <out dir> [name prefix]
// The wind shots use the live weather at that moment, and print it for their caption.
//
// Then, in <out dir> (cells cropped 6 px a side, 12 px white gaps, as in HAS Toyline's models):
//   ffmpeg -i wind-reykjavik.png -i wind-los-angeles.png -i wind-punta-arenas.png -i wind-oslo.png -filter_complex "[0]crop=1194:669[a];[1]crop=1194:669[b];[2]crop=1194:669[c];[3]crop=1194:669[d];[a][b][c][d]xstack=inputs=4:layout=0_0|1206_0|0_681|1206_681:fill=white" -c:v libwebp -quality 82 wind.webp
//   ffmpeg -i sp-poppy-777.png -i sp-lily-1234.png -i sp-sunflower-1234.png -i sp-orchid-1234.png -i sp-cosmos-777.png -i sp-peony-1234.png -filter_complex "[0]crop=792:669[a];[1]crop=792:669[b];[2]crop=792:669[c];[3]crop=792:669[d];[4]crop=792:669[e];[5]crop=792:669[f];[a][b][c][d][e][f]xstack=inputs=6:layout=0_0|804_0|1608_0|0_681|804_681|1608_681:fill=white" -c:v libwebp -quality 80 flowers.webp
//   ffmpeg -i bloom-closed.png -c:v libwebp -quality 80 closed.webp   (and bloom-open.png as open.webp, app.png as app.webp at -quality 82)
import { mkdirSync } from 'node:fs';
import { chromium } from '/Users/augustosantizo/Desktop/DesktopProjects/HAS_Video_Editor/node_modules/playwright-core/index.mjs';

const [app, out, only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

// One shot: a w x h viewport at scale s. `mode` is the app's own: 'bare' hides both panels (H),
// 'solo' only the controls (Shift-H), '' shows both. `state` is merged into window.flora.state.
async function shot(name, { w, h, s = 1.5, species, seed, place, mode = 'bare', state = {}, wait = 6000 }) {
  if (only && !name.startsWith(only)) return;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: s });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  const q = new URLSearchParams({ species, seed: String(seed), ...(place ? { place } : {}) });
  await page.goto(`file://${app}?${q}`, { waitUntil: 'load' });
  await page.evaluate(({ mode, state }) => { if (mode) document.body.classList.add(mode); Object.assign(window.flora.state, state); }, { mode, state });
  if (place) await page.waitForFunction(() => window.flora.state.weather, null, { timeout: 15000 });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  const wx = await page.evaluate(() => window.flora.state.weather);
  console.log('saved', name, wx ? `· ${wx.name}: wind ${wx.speed} m/s, gusts ${wx.gusts}, ${wx.time} ${wx.tzName}` : '');
  await ctx.close();
}

// Fig. 01: one California poppy (seed 1234), held open, moved only by each place's measured
// wind through the app's physical stem ("Location drives motion"), the data panel showing (cells 1200 x 675)
// A strong wind swings the flower around, in and out of view: for Punta Arenas the page uses one of
// several frames taken about 10 s in, where it is bent over but still in frame.
for (const [slug, place] of [['reykjavik', 'Reykjavik, Iceland'], ['los-angeles', 'Los Angeles, California'], ['punta-arenas', 'Punta Arenas, Chile'], ['oslo', 'Oslo, Norway']]) {
  await shot(`wind-${slug}`, { w: 960, h: 540, s: 1.25, species: 'calpoppy', seed: 1234, place, mode: 'solo', state: { auto: false, bloom: 1, literal: true, live: true }, wait: 12000 });
}
// Figs. 02 and 03 (1360 square): a lily (seed 1234) closed and open, in the built-in breeze
await shot('bloom-closed', { w: 680, h: 680, s: 2, species: 'lily', seed: 1234, state: { auto: false, bloom: 0 } });
await shot('bloom-open', { w: 680, h: 680, s: 2, species: 'lily', seed: 1234, state: { auto: false, bloom: 1 } });
// Fig. 04: six species, held open (cells 801 x 675)
for (const [sp, seed] of [['poppy', 777], ['lily', 1234], ['sunflower', 1234], ['orchid', 1234], ['cosmos', 777], ['peony', 1234]]) {
  await shot(`sp-${sp}-${seed}`, { w: 534, h: 450, species: sp, seed, state: { auto: false, bloom: 1 } });
}
// Fig. 07: the app as it opens, both panels showing, on live weather in Los Angeles, caught at the
// top of its own 24 s bloom cycle (fully open 12 s after the flower is made)
await shot('app', { w: 1600, h: 900, species: 'peony', seed: 1234, place: 'Los Angeles, California', mode: '', wait: 11200 });

await browser.close();
