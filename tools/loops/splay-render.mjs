// Render Splay's own demo (the quadcopter) with Splay's Render: an MP4 drawn
// frame by frame offscreen, no interface. Drives the app's modules on its Vite
// dev server (localhost:5178) in a headless Chrome and saves the download.
// Usage: node splay-render.mjs <out.mp4> [720p|1080p]
import { chromium } from '/Users/augustosantizo/Desktop/DesktopProjects/HAS_Video_Editor/node_modules/playwright-core/index.mjs';

const out = process.argv[2];
const size = process.argv[3] ?? '1080p';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text().slice(0, 200)); });
await page.goto('http://localhost:5178/');
await page.waitForTimeout(4000);

const info = await page.evaluate(async () => {
  const { useStore } = await import('/src/store/index.ts');
  const A = await import('/src/store/actions.ts');
  await A.loadDemo();
  for (let i = 0; i < 100 && !useStore.getState().scene.importedRoot; i++) await new Promise((r) => setTimeout(r, 100));
  // Forward only: the loop's hold and return are added after
  useStore.setState((s) => ({ timeline: { ...s.timeline, reverse: false, bounce: false } }));
  const s = useStore.getState();
  return { model: !!s.scene.importedRoot, duration: s.timeline.duration, theme: s.ui.theme, look: s.ui.look ?? null };
});
console.log('loaded:', JSON.stringify(info));
await page.waitForTimeout(2500); // let the viewport frame the model

const dl = page.waitForEvent('download', { timeout: 600000 });
const result = await page.evaluate(async (size) => {
  const R = await import('/src/io/renderAnimation.ts');
  const res = await R.renderAnimation(
    { format: 'mp4', size, fps: 30, range: 'whole', background: 'viewport', quality: 'high' },
    { signal: new AbortController().signal },
  );
  return res;
}, size);
console.log('render:', JSON.stringify(result));
const d = await dl;
await d.saveAs(out);
console.log('saved', out);
await browser.close();
