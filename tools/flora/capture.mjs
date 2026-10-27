// HAS Flora's stills, captured from the app itself (its one HTML file) in a headless
// Chrome (Playwright, `channel: 'chrome'`), set with the app's own menus and sliders.
// Not part of the site build. The Playwright import path points at a local install
// (HAS_Video_Editor); change it to yours.
//
// Usage: node capture.mjs <path to saffron-crocus-weather.html> <out dir> [name prefix]
//
// Then, in <out dir> (cells cropped 6 px a side, 12 px white gaps, as in HAS Toyline's models):
//   ffmpeg -i wx-clear-noon.png -i wx-clear-golden.png -i wx-rain-noon.png -i wx-clear-night.png -filter_complex "[0]crop=1194:669[a];[1]crop=1194:669[b];[2]crop=1194:669[c];[3]crop=1194:669[d];[a][b][c][d]xstack=inputs=4:layout=0_0|1206_0|0_681|1206_681:fill=white" -c:v libwebp -quality 80 weather.webp
//   ffmpeg -i fl-sakura.png -i fl-tsubaki.png -i fl-bleuet.png -i fl-calpoppy.png -i fl-mugunghwa.png -i fl-cantuta.png -filter_complex "[0]crop=792:669[a];[1]crop=792:669[b];[2]crop=792:669[c];[3]crop=792:669[d];[4]crop=792:669[e];[5]crop=792:669[f];[a][b][c][d][e][f]xstack=inputs=6:layout=0_0|804_0|1608_0|0_681|804_681|1608_681:fill=white" -c:v libwebp -quality 80 flowers.webp
//   ffmpeg -i sq-rain.png -c:v libwebp -quality 80 rain.webp   (and sq-snow.png as snow.webp, app.png as app.webp at -quality 82)
import { mkdirSync } from 'node:fs';
import { chromium } from '/Users/augustosantizo/Desktop/DesktopProjects/HAS_Video_Editor/node_modules/playwright-core/index.mjs';

const [app, out, only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

// Set a menu ('change') or a slider ('input') the way the app's own controls do, hidden or not.
const set = (page, id, v, ev) => page.evaluate(([id, v, ev]) => {
  const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true }));
}, [id, String(v), ev]);
const input = (page, id, v) => set(page, id, v, 'input');

// One shot: a w x h viewport at scale s, the app's own menus. Softness 0.15 and Glass 0.3 (not the
// app's 0.5 and 0.85) read closer to the owner's Unreal clips. `drag` lowers the lens to look across
// the flower instead of down into it (negative = lower); `zoomOut` wheel steps move it back.
async function shot(name, { w, h, s = 1.5, species, place = 'home', sky = 'clear', tod = 'noon', drag = -110, zoomOut = 4, bare = true }) {
  if (only && !name.startsWith(only)) return;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: s });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  await page.goto('file://' + app, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  // hide the interface first, so the controls never catch the drag or the wheel
  if (bare) await page.evaluate(() => document.documentElement.classList.add('bare'));
  for (const [id, v] of [['species', species], ['place', place], ['sky', sky], ['tod', tod]]) await set(page, id, v, 'change');
  for (const [id, v] of [['spin', 0], ['soft', 0.15], ['glass', 0.3], ['tempo', 4]]) await input(page, id, v);
  await page.mouse.move(w / 2, h / 2);
  if (drag) { await page.mouse.down(); await page.mouse.move(w / 2, h / 2 + drag, { steps: 12 }); await page.mouse.up(); }
  for (let i = 0; i < zoomOut; i++) await page.mouse.wheel(0, 100);
  // the bloom (28 s at tempo 1) and the weather easing in
  await page.waitForTimeout(16000);
  await input(page, 'tempo', 1);
  if (!bare) await page.mouse.move(w / 2, h - 40);   // wake the dock, which fades when idle
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
  await ctx.close();
}

// Fig. 01: one California poppy, four skies (cells 1200 x 675)
for (const [sky, tod] of [['clear', 'noon'], ['clear', 'golden'], ['rain', 'noon'], ['clear', 'night']]) {
  await shot(`wx-${sky}-${tod}`, { w: 800, h: 450, species: 'calpoppy', sky, tod });
}
// Figs. 02 and 03 (1360 square): a camellia in the rain, forsythia in snow
await shot('sq-rain', { w: 680, h: 680, s: 2, species: 'tsubaki', sky: 'rain', tod: 'noon', drag: -60, zoomOut: 0 });
await shot('sq-snow', { w: 680, h: 680, s: 2, species: 'gaenari', sky: 'snow', tod: 'morning', drag: -60, zoomOut: 0 });
// Fig. 04: one flower per place, face-on, in studio light (cells 801 x 675)
for (const sp of ['sakura', 'tsubaki', 'bleuet', 'calpoppy', 'mugunghwa', 'cantuta']) {
  await shot(`fl-${sp}`, { w: 534, h: 450, species: sp, sky: 'studio', drag: 0, zoomOut: 0 });
}
// Fig. 07: the app with its interface, the California poppy on live weather at local time where it grows
await shot('app', { w: 1600, h: 900, species: 'calpoppy', sky: 'live', tod: 'now', bare: false });

await browser.close();
