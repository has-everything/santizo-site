// Copies HAS Toyline (the app) into public/toyline, where the site serves it at /toyline.
//
//   node tools/toyline/sync.mjs [path to the HAS Toyline project]
//
// The project lives on the owner's T7 drive (the default path below; its repo is has-everything/has-toyline).
// Run this after any change to the app, then build and push as usual.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.argv[2] || '/Volumes/T7/HAS_Toyline');
const OUT = path.resolve(import.meta.dirname, '../../public/toyline');

// What the app ships: its page and these modules (SHIPPED in its tools/publish-prep.mjs). Keep the two lists the same.
const MODULES = ['main.js', 'factory.js', ...['app', 'econ', 'glossary', 'overlay', 'ledger', 'course', 'course-a', 'course-b', 'platform', 'tutor', 'stub-engine'].map((n) => `ledger/${n}.js`)];

if (!fs.existsSync(path.join(SRC, 'index.html'))) throw new Error(`No HAS Toyline project at ${SRC} (is the T7 drive plugged in?)`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'ledger'), { recursive: true });

// The page loads its entry script by a path relative to the page. The site answers at /toyline and at /toyline/, and
// without the slash "main.js" would mean /main.js. So the copy names it in full. Everything else the app loads is
// relative to main.js itself, or comes from a CDN.
const RELATIVE = '<script type="module" src="main.js"></script>';
const page = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
if (!page.includes(RELATIVE)) throw new Error('index.html no longer loads main.js the way this script expects: check how it loads its entry script');
fs.writeFileSync(path.join(OUT, 'index.html'), page.replace(RELATIVE, '<script type="module" src="/toyline/main.js"></script>'));

let bytes = fs.statSync(path.join(OUT, 'index.html')).size;
for (const f of MODULES) {
  fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
  bytes += fs.statSync(path.join(OUT, f)).size;
}
console.log(`public/toyline: index.html and ${MODULES.length} modules from ${SRC}, ${Math.round(bytes / 1024)} KB`);
