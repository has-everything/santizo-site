// Toyline Ledger course runner (docs/CONTRACTS.md "Course", docs/SPEC.md §3.1, §4.5, §4.10).
// Renders the Lesson pane: the course map, the lesson card (warm-up, hook + prediction, worked example, "Do this"
// steps that tick themselves from engine/app events, checks with the three-rung feedback ladder, the twin,
// explain-back, the rule card), the Notebook, the "Rules of this factory" card, the phone coach bar in #coach and,
// in Challenges mode, the challenge cards from course-b.js. Progress goes through platform.store.
import * as E from './econ.js';
import { layersUpTo } from './app.js';
import { defineTerm } from './glossary.js';
import { LESSONS_A } from './course-a.js';

const UNIT_NAMES = { A: 'One car', B: 'One month' };
const TOL = { '$': 0.01, '$m': 1, min: 0.05, '%': 0.1, cars: 0, h: 0.05 };
const ENGINE_EVENTS = new Set(['sent', 'enter', 'cycle', 'stationDone', 'exit', 'qc', 'scrapped', 'scrapShare', 'parked', 'packed', 'shipped', 'lineIdle', 'optionChanged', 'followed', 'stationTap', 'carTap', 'frame']);
const DEFAULT_PROMPT = { station: 'Tap the station.', car: 'Tap the car.', sort: 'Sort the cards.', price: 'Place the price.', marker: 'Place the marker.' };
const ST = E.STATIONS;

/* ---------------------------------------------------------------- small helpers */
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const isPhone = () => { try { return matchMedia('(max-width: 820px)').matches; } catch { return false; } };
function val(x, ctx, ...a) {
  if (typeof x !== 'function') return x;
  try { return x(ctx, ...a); } catch (e) { console.warn('[course] content function failed', e); return ''; }
}
const num = x => (typeof x === 'number' ? x : E.parseNumber(x));
const lessonNum = id => { const m = /^L(\d+)$/.exec(id || ''); return m ? +m[1] : (id === 'UA' ? 6.5 : -1); };
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const plain = html => { const d = document.createElement('div'); d.innerHTML = String(html ?? ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
const TICK = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'cs-ticksvg'); s.innerHTML = '<path d="M3.2 8.6l3 3 6.6-7.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'; return s; };
// Money, minutes and percentages inside prose are set in mono tabular figures (CONTRACTS: money and minutes always mono).
const NUM_RE = /([+−-]?\$\d[\d,]*(?:\.\d+)?(?:\/(?:h|min))?|\b\d[\d,]*(?:\.\d+)?(?:\s?min\b|%| h\b)|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+\.\d+\b)/g;
function monoize(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement?.closest('.cs-num, input, textarea, svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const t of nodes) {
    const s = t.nodeValue; NUM_RE.lastIndex = 0; if (!NUM_RE.test(s)) continue; NUM_RE.lastIndex = 0;
    const frag = document.createDocumentFragment(); let i = 0, m;
    while ((m = NUM_RE.exec(s))) { if (m.index > i) frag.append(s.slice(i, m.index)); frag.append(h('span', { class: 'cs-num' }, m[0])); i = m.index + m[0].length; }
    if (i < s.length) frag.append(s.slice(i));
    t.replaceWith(frag);
  }
}
// <g t="term">text</g> -> a dotted-underlined button that opens the definition popover
function setHtml(el, html) {
  el.innerHTML = html ?? '';
  el.querySelectorAll('g[t]').forEach(g => {
    const t = g.getAttribute('t');
    if (!defineTerm(t)) { g.replaceWith(...g.childNodes); return; }
    const b = h('button', { type: 'button', class: 'cs-g', 'data-t': t, 'aria-expanded': 'false' });
    b.append(...g.childNodes); g.replaceWith(b);
  });
  monoize(el);
  return el;
}
const html = (tag, attrs, content) => setHtml(h(tag, attrs), content);
function rng(seedStr) { let a = 0; for (const c of String(seedStr)) a = (a * 31 + c.charCodeAt(0)) | 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clone = o => { try { return structuredClone(o); } catch { return JSON.parse(JSON.stringify(o ?? null)); } };
// Choice options are shuffled per learner (stable across re-renders) so the right one is never given away by its place.
// Lists the author ordered on purpose keep their order: `ordered: true`, or options that read as rising numbers
// ("End of month 2 / 7 / 8 / Never").
const shuffled = (a, r) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function keepOrder(chk, opts) {
  if (chk.ordered) return true;
  if (chk.ordered === false || opts.length < 3) return false;
  const nums = opts.map(x => { const m = /[+−-]?\$?\d[\d,]*(?:\.\d+)?/.exec(plain(x.text)); return m ? E.parseNumber(m[0]) : null; });
  const body = nums[nums.length - 1] === null ? nums.slice(0, -1) : nums;
  return body.length >= 2 && body.every(v => v !== null) && body.every((v, i) => i === 0 || v > body[i - 1]);
}
const arr = x => Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : [];

/* ---------------------------------------------------------------- answers (SPEC §2.12) */
const roundFor = (u, x) => u === '$' ? E.r2(x) : u === '$m' ? E.roundTo(x, 0) : (u === 'min' || u === 'h' || u === '%') ? E.r1(x) : x;
function pctTarget(u, v, x) { return u === '%' && Math.abs(x) <= 1.5 && Math.abs(v) > 1.5 ? x * 100 : x; } // fraction answers
function matches(u, v, target, tol) {
  if (v === null || !Number.isFinite(v) || target === null || target === undefined || !Number.isFinite(+target)) return false;
  const t = tol ?? TOL[u] ?? 1e-6, x = roundFor(u, pctTarget(u, v, +target));
  return Math.abs(v - x) <= t + 1e-9;
}
function fmtU(u, x) {
  if (x === null || x === undefined || !Number.isFinite(+x)) return String(x ?? '');
  if (u === '$') return E.fmt.money2(x);
  if (u === '$m') return E.fmt.money2(x, 0);
  if (u === 'min') return E.fmt.min(x) + ' min';
  if (u === 'h') return E.fmt.min(x) + ' h';
  if (u === '%') return E.r1(Math.abs(x) <= 1.5 ? x * 100 : x).toFixed(1) + '%';
  if (u === 'cars') return E.fmt.count(x) + ' cars';
  return String(E.r2(x));
}
const unitPrefix = u => (u === '$' || u === '$m') ? '$' : '';
const unitSuffix = u => ({ min: 'min', '%': '%', cars: 'cars', h: 'h' }[u] || '');

/* ---------------------------------------------------------------- CSS */
const CSS = `
.cs-root{display:flex;flex-direction:column;min-width:0;flex:1 0 auto}
.cs-sec{padding:14px 16px;border-top:1px dashed var(--line);display:grid;gap:10px;min-width:0}
.cs-root>.cs-sec:first-child,.cs-card>.cs-sec:first-child{border-top:0}
.cs-lab{margin:0;font-weight:400;font-family:var(--f-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.cs-lab b{font-weight:500;color:var(--ink);letter-spacing:.04em}
.cs-h2{margin:0;font-size:21px;line-height:1.12;font-weight:850;font-stretch:112%;letter-spacing:-.005em;text-wrap:balance}
.cs-h3{margin:0;font-size:15px;line-height:1.25;font-weight:800;font-stretch:106%}
.cs-goal{margin:0;color:var(--muted);font-size:13px;line-height:1.45}
.cs-p{margin:0;font-size:14px;line-height:1.55;overflow-wrap:anywhere}
.cs-p p{margin:0 0 6px}.cs-p p:last-child{margin:0}
.cs-num{font-family:var(--f-mono);font-variant-numeric:tabular-nums;font-size:.93em;letter-spacing:-.01em;white-space:nowrap}
.cs-muted{color:var(--muted)}
.cs-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cs-btn{font:inherit;font-weight:700;font-size:13.5px;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-height:40px;cursor:pointer;line-height:1.2;text-align:center}
.cs-btn:hover:not(:disabled){border-color:var(--muted)}
.cs-btn.cs-primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent);font-weight:800;font-stretch:108%}
.cs-btn.cs-ghost{background:transparent;border-color:transparent;color:var(--muted);text-decoration:underline;text-underline-offset:3px;padding-inline:4px}
.cs-btn.cs-small{font-size:12.5px;font-weight:600;padding:6px 10px;min-height:34px}
.cs-btn:disabled{opacity:.45;cursor:default}
/* one focus ring for every control: an ink outline on an accent halo reads on any background, both themes */
.cs-btn:focus-visible,.cs-tile:focus-visible,.cs-opt:focus-visible,.cs-wrow:focus-visible,.cs-g:focus-visible,.cs-in:focus-visible,.cs-ta:focus-visible,.cs-wv:focus-visible,.cs-ideas input:focus-visible,.cs-mapbox>summary:focus-visible,details.cs-fold>summary:focus-visible{outline:2px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 4px var(--accent)}
.cs-fb:focus,.cs-model:focus,.cs-h2:focus,.cs-diff:focus,.cs-rhow:focus{outline:none}
.cs-fb:focus-visible,.cs-model:focus-visible,.cs-h2:focus-visible,.cs-diff:focus-visible,.cs-rhow:focus-visible{outline:2px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 4px var(--accent)}
.cs-in{font-family:var(--f-mono);font-variant-numeric:tabular-nums;font-size:15px;width:7.2em;padding:7px 9px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--ink);min-height:40px;box-sizing:border-box}
.cs-in[aria-invalid="true"]{border-color:var(--loss-ink)}
.cs-in.ok{border-color:var(--gain-ink)}
.cs-in:read-only{opacity:.9}
.cs-field{display:inline-flex;align-items:center;gap:6px}
.cs-unit{font-family:var(--f-mono);font-size:13px;color:var(--muted)}
.cs-g{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;border-bottom:1.5px dotted currentColor;cursor:help;text-align:inherit;line-height:inherit}
.cs-g[aria-expanded="true"]{background:color-mix(in srgb,var(--accent) 30%,transparent)}
.cs-pop{position:fixed;z-index:60;max-width:min(300px,calc(100vw - 32px));background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.45;box-shadow:0 8px 28px color-mix(in srgb,var(--ink) 20%,transparent)}
.cs-pop b{display:block;font-family:var(--f-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:500;margin-bottom:3px}
/* intro + map */
.cs-intro p{margin:0}
.cs-units{display:grid;gap:12px}
.cs-unitrow{display:grid;gap:6px}
.cs-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px}
.cs-tile{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:3px;align-content:start;min-height:64px;padding:8px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.cs-tile:hover{border-color:var(--muted)}
.cs-tile[aria-current="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink);background:var(--surface)}
.cs-tid{font-family:var(--f-mono);font-size:10.5px;color:var(--muted);display:flex;justify-content:space-between;align-items:center;letter-spacing:.04em}
.cs-ttl{font-size:12.5px;font-weight:700;line-height:1.2}
.cs-ticksvg{width:14px;height:14px;color:var(--gain-ink);flex:none}
.cs-tile.done .cs-tid{color:var(--ink)}
.cs-mapbox>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:32px;font-family:var(--f-mono);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.cs-mapbox>summary::-webkit-details-marker{display:none}
.cs-mapbox>summary::after{content:"Show";font-family:var(--f-display);text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:600;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:4px 9px;background:var(--bg)}
.cs-mapbox[open]>summary::after{content:"Hide"}
.cs-mapbox[open]>summary{margin-bottom:10px}
/* lesson card */
.cs-card{display:flex;flex-direction:column;min-width:0;border-top:1px solid var(--line);scroll-margin-top:64px}
.cs-check,.cs-step,.cs-sec{scroll-margin-top:64px;scroll-margin-bottom:84px}
.cs-head{display:grid;gap:6px;padding-top:16px}
.cs-worked{display:grid;border:1px solid var(--line);border-radius:8px;background:var(--bg);overflow:hidden}
.cs-wrow{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:8px 10px;border-top:1px dashed var(--line);align-items:baseline;cursor:pointer;min-height:38px;font-size:13px;line-height:1.35}
.cs-wrow:first-child{border-top:0}
.cs-wrow:hover{background:var(--surface)}
.cs-wv{font:inherit;font-family:var(--f-mono);font-variant-numeric:tabular-nums;font-weight:600;white-space:normal;text-align:right;color:var(--ink);background:none;border:0;border-bottom:1px dotted var(--muted);padding:2px 0;cursor:pointer;justify-self:end}
.cs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cs-wh{grid-column:1/-1;font-family:var(--f-mono);font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--muted);line-height:1.45}
.cs-steps{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.cs-step{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start}
.cs-mark{width:22px;height:22px;border-radius:50%;border:2px solid var(--line);box-sizing:border-box;display:grid;place-items:center;font-family:var(--f-mono);font-size:10.5px;color:var(--muted);background:var(--surface)}
.cs-step.current .cs-mark{border-color:var(--accent);color:var(--ink);background:color-mix(in srgb,var(--accent) 26%,var(--surface))}
.cs-step.done .cs-mark{background:var(--gain);border-color:var(--gain);color:var(--surface)}
.cs-step.done .cs-mark .cs-ticksvg{color:var(--surface);width:12px;height:12px}
.cs-sbody{display:grid;gap:8px;min-width:0}
.cs-stext{font-size:14px;line-height:1.5;overflow-wrap:anywhere}
.cs-step.done .cs-stext{color:var(--muted)}
.cs-nudge{font-size:13px;line-height:1.45;border-left:3px solid var(--accent);padding:4px 10px;background:var(--bg);border-radius:0 6px 6px 0}
.cs-step.done .cs-nudge{border-left-color:var(--line-strong);color:var(--ink)}
.cs-widget:empty{display:none}
.cs-widget{display:grid;gap:8px;min-width:0}
.cs-note{font-size:13px;line-height:1.5;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;overflow-wrap:anywhere}
/* receipts */
.cs-rcpt{font-family:var(--f-mono);font-variant-numeric:tabular-nums;font-size:12.5px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:4px 10px;display:grid;min-width:0}
.cs-rrow{display:grid;grid-template-columns:minmax(0,1fr) auto 16px;gap:8px;align-items:center;padding:5px 0;border-top:1px dashed var(--line);min-height:34px}
.cs-rrow:first-child{border-top:0}
.cs-rrow.total{border-top:1px solid var(--ink);font-weight:600}
.cs-rrow .cs-rl{min-width:0;overflow-wrap:anywhere;line-height:1.3}
.cs-rrow .cs-rv{display:inline-flex;align-items:center;justify-content:flex-end;gap:4px;white-space:nowrap}
.cs-rrow .cs-in{width:6.4em;font-size:13.5px;padding:4px 8px;min-height:34px;text-align:right}
.cs-rrow .cs-rm{display:grid;place-items:center}
.cs-rrow .cs-rx{color:var(--loss-ink);font-weight:700}
.cs-rhow{grid-column:1/-1;color:var(--muted);font-size:11.5px;margin-top:-2px}
.cs-rslip{font-family:var(--f-display);font-size:12.5px;line-height:1.4;color:var(--ink);border-left:3px solid var(--loss-ink);padding:2px 8px;margin:0 0 4px}
.cs-ab{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cs-ab .cs-rcpt{font-size:11.5px;padding:4px 8px}
.cs-ab .cs-rrow{grid-template-columns:minmax(0,1fr) auto;min-height:26px;padding:3px 0;gap:6px;align-items:baseline} /* the label wraps, the sum does not */
.cs-ab .cs-rrow>:first-child{min-width:0;overflow-wrap:break-word}
@media (max-width:380px){.cs-ab{grid-template-columns:minmax(0,1fr)}}
.cs-ab .cs-rv{display:block;white-space:nowrap;text-align:right} /* never split a sum of money across lines */
.cs-mapsec:empty,.cs-side:empty{display:none}
.cs-abh{font-family:var(--f-display);font-weight:800;font-size:12.5px;padding:6px 0 4px}
.cs-diff{font-size:13.5px;line-height:1.5}
/* checks */
.cs-check{display:grid;gap:10px;min-width:0}
.cs-check+.cs-check{border-top:1px dashed var(--line);padding-top:12px}
.cs-prompt{font-size:14.5px;line-height:1.5;font-weight:600;overflow-wrap:anywhere}
.cs-cbody{display:grid;gap:8px;min-width:0}
.cs-fields{display:grid;gap:8px}
.cs-frow{display:grid;grid-template-columns:minmax(0,1fr) auto 18px;gap:8px;align-items:center}
.cs-frow label{font-size:13px;line-height:1.3}
.cs-fm{display:grid;place-items:center;font-weight:700;color:var(--loss-ink)}
.cs-opts{display:grid;gap:6px}
.cs-opt{all:unset;box-sizing:border-box;display:flex;gap:10px;align-items:center;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);cursor:pointer;font-size:14px;line-height:1.35;min-height:42px;color:var(--ink)}
.cs-opt:hover:not([aria-disabled="true"]){border-color:var(--muted)}
.cs-opt[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.cs-opt.right{border-color:var(--gain-ink);box-shadow:inset 0 0 0 1px var(--gain-ink)}
.cs-opt.wrong{border-color:var(--loss-ink);opacity:.75}
.cs-opt.wrong .cs-ot{text-decoration:line-through}
.cs-opt[aria-disabled="true"]{cursor:default}
.cs-ob{flex:none;width:16px;height:16px;border-radius:50%;border:2px solid var(--line-strong);box-sizing:border-box;display:grid;place-items:center}
.cs-opt[aria-pressed="true"] .cs-ob{border-color:var(--ink);background:var(--ink)}
.cs-opt.right .cs-ob{border-color:var(--gain-ink);background:var(--gain-ink)}
.cs-opt.wrong .cs-ob{border-color:var(--loss-ink);background:var(--loss-ink)}
.cs-stations{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.cs-stations .cs-btn{padding:6px 2px;min-height:44px;font-size:10.5px;font-weight:600;display:grid;gap:1px;line-height:1.1;overflow:hidden}
.cs-stations .cs-btn span{font-family:var(--f-mono);font-size:10px;color:var(--muted)}
.cs-stations .cs-btn.right{border-color:var(--gain-ink);box-shadow:inset 0 0 0 1px var(--gain-ink)}
.cs-stations .cs-btn.wrong{border-color:var(--loss-ink)}
.cs-cars{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.cs-cars .cs-btn{text-align:left;font-weight:600;font-size:12.5px;display:flex;gap:8px;align-items:center}
.cs-swatch{flex:none;width:14px;height:14px;border-radius:50%;border:1px solid color-mix(in srgb,var(--ink) 30%,transparent)}
.cs-cars .cs-btn.right{border-color:var(--gain-ink);box-shadow:inset 0 0 0 1px var(--gain-ink)}
.cs-cars .cs-btn.wrong{border-color:var(--loss-ink)}
.cs-sort{display:grid;gap:6px}
.cs-srow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:4px 0;border-top:1px dashed var(--line)}
.cs-srow:first-child{border-top:0}
.cs-srow .cs-stt{font-size:13.5px;line-height:1.35;display:flex;gap:6px;align-items:center}
.cs-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--bg)}
.cs-seg button{all:unset;cursor:pointer;padding:6px 10px;font-size:12.5px;font-weight:600;min-height:32px;display:grid;place-items:center;color:var(--muted)}
.cs-seg button+button{border-left:1px solid var(--line)}
.cs-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.cs-seg button:focus-visible{outline:2px solid var(--ink);outline-offset:-2px;box-shadow:inset 0 0 0 4px var(--accent)}
.cs-srow.wrong .cs-seg{border-color:var(--loss-ink)}
.cs-srow .cs-sx{color:var(--loss-ink);font-weight:700}
.cs-chart{min-width:0}
.cs-fb{border-left:3px solid var(--line);background:var(--bg);border-radius:0 8px 8px 0;padding:9px 12px;font-size:13.5px;line-height:1.5;display:grid;gap:6px;overflow-wrap:anywhere}
.cs-fb p{margin:0}
.cs-fbt{font-family:var(--f-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.cs-fb-right{border-left-color:var(--gain)}.cs-fb-right .cs-fbt{color:var(--gain-ink)}
.cs-fb-wrong{border-left-color:var(--loss)}.cs-fb-wrong .cs-fbt{color:var(--loss-ink)}
.cs-fb .cs-need{font-weight:600}
.cs-fb-solution{border-left-color:var(--accent)}.cs-fb-solution .cs-fbt{color:var(--ink)}
.cs-fb-info{border-left-color:var(--muted)}.cs-fb-info .cs-fbt{color:var(--muted)}
.cs-hintbox{font-size:13px;line-height:1.5;color:var(--ink);padding:8px 10px;border:1px dashed var(--line);border-radius:8px}
.cs-bubble{font-size:13px;line-height:1.5}
.cs-warm{display:grid;gap:12px}
/* explain-back, rule, notebook */
.cs-ta{font:inherit;font-size:14px;line-height:1.45;width:100%;box-sizing:border-box;min-height:64px;resize:vertical;padding:8px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--bg);color:var(--ink)}
.cs-ideas{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.cs-ideas label{display:flex;gap:8px;align-items:center;font-size:13.5px;min-height:32px;cursor:pointer}
.cs-ideas input{width:18px;height:18px;accent-color:var(--ink);margin:0}
.cs-ideas .cs-ii{display:flex;gap:8px;align-items:center;font-size:13.5px;min-height:28px}
.cs-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--line);box-sizing:border-box;flex:none}
.cs-model{font-size:14px;line-height:1.5;margin:0;padding:8px 12px;border-left:3px solid var(--ink);background:var(--bg);border-radius:0 8px 8px 0}
.cs-rule{border:1px solid color-mix(in srgb,var(--accent) 60%,var(--line));background:color-mix(in srgb,var(--accent) 13%,var(--surface));border-radius:10px;padding:12px 14px;display:grid;gap:6px}
.cs-rule p{margin:0;font-size:15px;line-height:1.4;font-weight:750;font-stretch:104%}
.cs-take{margin:0;padding-left:18px;display:grid;gap:6px;font-size:13.5px;line-height:1.5}
.cs-nb{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.cs-nb li{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;font-size:13.5px;line-height:1.45}
.cs-nb .cs-nid{font-family:var(--f-mono);font-size:11px;color:var(--muted);padding-top:2px}
.cs-rules ul{margin:0;padding-left:18px;display:grid;gap:6px;font-size:13.5px;line-height:1.5}
.cs-rules .cs-foot{font-size:12.5px;color:var(--muted)}
details.cs-fold>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;min-height:32px}
details.cs-fold>summary::-webkit-details-marker{display:none}
details.cs-fold>summary::after{content:"+";font-family:var(--f-mono);font-size:16px;color:var(--muted)}
details.cs-fold[open]>summary::after{content:"−"}
details.cs-fold[open]>summary{margin-bottom:8px}
/* challenges */
.cs-chs{display:grid;gap:8px}
.cs-ch{display:grid;gap:6px;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--bg)}
.cs-ch p{margin:0;font-size:13px;line-height:1.45;color:var(--muted)}
/* coach (phone) */
.cs-coach{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 0}
.cs-coach-t{flex:1 1 auto;min-width:0;font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cs-coach-t .cs-lab{display:block;margin-bottom:1px;font-size:10px}
.cs-coach .cs-btn{flex:none;min-height:44px;min-width:76px}
.cs-spacer{height:0}
@media (pointer:coarse),(max-width:820px){
  .cs-btn,.cs-btn.cs-small,.cs-tile,.cs-opt,.cs-in,.cs-wrow{min-height:44px}
  .cs-rrow .cs-in{min-height:44px}
  /* 16 px fields: iOS zooms the page when a smaller field takes focus */
  .cs-in,.cs-rrow .cs-in,.cs-ta{font-size:16px}
  .cs-seg button{min-height:44px;padding:6px 12px}
  .cs-ideas label{min-height:44px}
  .cs-mapbox>summary{min-height:44px}
  details.cs-fold>summary{min-height:44px}
}
@media (max-width:820px){
  .cs-spacer{height:76px}
  .cs-h2{font-size:20px}
  .cs-tiles{grid-template-columns:repeat(auto-fill,minmax(84px,1fr))}
  .cs-ab .cs-rcpt{font-size:11px}
}
@media (max-width:380px){
  .cs-stations{grid-template-columns:repeat(4,minmax(0,1fr))}
  .cs-stations .cs-btn{font-size:11.5px}
}
`;

/* ================================================================================================= mount */
// extraLessons and loadB are test hooks for harness pages (a hidden test lesson; a stand-in for the course-b import).
export function mountCourse({ engine = null, app, econ = E, ledger = null, widgets = {}, platform = null, tutor = null, pane, coach = null, extraLessons = [], loadB: loadBFn = () => import('./course-b.js') } = {}) {
  if (!pane) throw new Error('mountCourse needs a pane');
  if (!document.getElementById('css-course')) document.head.append(h('style', { id: 'css-course' }, CSS));
  const live = document.getElementById('live');
  const say = t => { if (!live || !t) return; live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const toast = t => { try { engine?.toast?.(t); } catch { } };
  const W = widgets || {};

  /* ------------------------------------------------ progress (SPEC §4.10) */
  let P = { v: 1, lessons: {}, misses: {}, notebook: [], review: [], challenges: {}, warm: {}, seed: Math.floor(Math.random() * 1e6) };
  const lp = id => (P.lessons[id] ||= { done: false, steps: [], attempts: {}, firstTry: {} });
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { platform?.store?.save?.({ v: 1, lessons: clone(P.lessons), misses: clone(P.misses), notebook: [...P.notebook], review: [...P.review], challenges: clone(P.challenges), warm: clone(P.warm), seed: P.seed }); }
      catch (e) { console.warn('[course] progress save failed', e); }
    }, 50); // platform.store.save debounces (1 s) and keeps one write in flight
  }
  function mergeLoaded(p) {
    if (!p || typeof p !== 'object') return;
    for (const [id, a] of Object.entries(p.lessons || {})) {
      const b = lp(id);
      b.done = !!(a.done || b.done);
      b.steps = [...new Set([...(a.steps || []), ...(b.steps || [])])];
      for (const [k, v] of Object.entries(a.attempts || {})) b.attempts[k] = Math.max(v || 0, b.attempts[k] || 0);
      b.firstTry = { ...(b.firstTry || {}), ...(a.firstTry || {}) };
      for (const k of ['prediction', 'predictions', 'mastered', 'solved']) if (a[k] !== undefined && b[k] === undefined) b[k] = clone(a[k]);
    }
    for (const [k, v] of Object.entries(p.misses || {})) P.misses[k] = [...(v || []), ...(P.misses[k] || [])];
    P.notebook = [...new Set([...(p.notebook || []), ...P.notebook])];
    P.review = [...new Set([...(p.review || []), ...P.review])];
    for (const [k, v] of Object.entries(p.challenges || {})) { const c = (P.challenges[k] ||= {}); c.done = !!(c.done || v?.done); if (v?.best && (!c.best || (v.best.profit ?? -Infinity) > (c.best.profit ?? -Infinity))) c.best = clone(v.best); }
    for (const [k, v] of Object.entries(p.warm || {})) P.warm[k] = { ...(v || {}), ...(P.warm[k] || {}) };
    if (Number.isFinite(p.seed)) P.seed = p.seed;
  }

  /* ------------------------------------------------ content */
  let lessonsB = [], WARM = [], CHAL = [], bStatus = 'loading';
  const TEST = arr(extraLessons);
  const allLessons = () => [...LESSONS_A, ...lessonsB];
  const byId = id => allLessons().find(l => l.id === id) || TEST.find(l => l.id === id) || null;
  const nextOf = id => { const L = allLessons(); const i = L.findIndex(l => l.id === id); return i >= 0 ? L[i + 1] || null : null; };
  const valid = l => l && typeof l === 'object' && typeof l.id === 'string' && l.title;

  /* ------------------------------------------------ DOM skeleton */
  const root = h('div', { class: 'cs-root' });
  const mapEl = h('div', { class: 'cs-sec cs-mapsec' });
  const lessonHost = h('div', { class: 'cs-lessonhost' });
  const sideEl = h('div', { class: 'cs-side' });
  root.append(mapEl, lessonHost, sideEl, h('div', { class: 'cs-spacer', 'aria-hidden': 'true' }));
  pane.append(root);

  /* glossary popover (one, fixed) */
  const pop = h('div', { class: 'cs-pop', role: 'tooltip', id: 'cs-pop', hidden: true });
  document.body.append(pop);
  let popFor = null;
  function closePop(focus) { if (!popFor) return; popFor.setAttribute('aria-expanded', 'false'); popFor.removeAttribute('aria-describedby'); if (focus) popFor.focus(); popFor = null; pop.hidden = true; }
  function openPop(b) {
    if (popFor === b) { closePop(); return; }
    closePop();
    const t = b.dataset.t, d = defineTerm(t); if (!d) return;
    pop.replaceChildren(h('b', null, t), document.createTextNode(d));
    pop.hidden = false; popFor = b; b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-describedby', 'cs-pop');
    say(`${t}: ${d}`); // the definition is read out, not only described
    const r = b.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
    const left = Math.max(16, Math.min(vw - pw - 16, r.left + r.width / 2 - pw / 2));
    const top = r.bottom + 8 + ph > vh - 8 ? Math.max(8, r.top - ph - 8) : r.bottom + 8;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  const onDocClick = e => { const g = e.target.closest?.('.cs-g'); if (g && root.contains(g) || g && coach?.contains(g)) { e.preventDefault(); openPop(g); return; } if (popFor && !pop.contains(e.target)) closePop(); };
  const onKey = e => { if (e.key === 'Escape' && popFor) closePop(true); };
  const onScroll = () => closePop();
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
  addEventListener('scroll', onScroll, true);
  addEventListener('resize', onScroll);

  /* ------------------------------------------------ shared lesson widgets (ctx.ui) */
  function makeUi(ctx) {
    const ui = {};
    ui.buttons = (el, defs) => {
      const row = h('div', { class: 'cs-row' });
      for (const d of defs) row.append(h('button', { type: 'button', class: 'cs-btn cs-small' + (d.primary ? ' cs-primary' : ''), onclick: () => { try { d.onClick?.(); } catch (e) { console.warn(e); } } }, d.label));
      el.append(row);
      return () => { };
    };
    ui.note = (el, content) => { const n = html('div', { class: 'cs-note' }, content); n.set = c => setHtml(n, c); el.append(n); return n; };
    ui.html = (el, content) => setHtml(el, content);
    // a receipt with blanks: rows { label, value?, answer?, unit, total?, how?, slips?: [{ value, msg }] }.
    // The feedback ladder of a check, line by line: a wrong line gets its slip message when it matches a known slip,
    // and after two wrong tries a "Show this line" that fills it in with its working (`how`).
    ui.blanks = (el, { rows = [], onDone, reveal = true } = {}) => {
      const box = h('div', { class: 'cs-rcpt' }), state = [];
      let fired = false;
      rows.forEach((r, i) => {
        const label = val(r.label, ctx);
        const row = h('div', { class: 'cs-rrow' + (r.total ? ' total' : '') });
        const lab = html('span', { class: 'cs-rl' }, label);
        const mark = h('span', { class: 'cs-rm', 'aria-hidden': 'true' });
        if (r.answer === undefined) { row.append(lab, h('span', { class: 'cs-rv' }, typeof r.value === 'number' ? fmtU(r.unit || '$', r.value) : String(r.value ?? '')), mark); box.append(row); return; }
        const inp = h('input', { class: 'cs-in', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': plain(label) + (r.unit === 'min' ? ', minutes' : ', dollars') });
        const s = { r, inp, mark, ok: false, wrong: 0, row, slip: null };
        state.push(s);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkAll(); } });
        inp.addEventListener('change', () => { checkOne(s, false); finish(); });
        row.append(lab, h('span', { class: 'cs-rv' }, unitPrefix(r.unit || '$') ? h('span', { class: 'cs-unit' }, '$ ') : null, inp, unitSuffix(r.unit) ? h('span', { class: 'cs-unit' }, ' ' + unitSuffix(r.unit)) : null), mark);
        box.append(row);
      });
      const btnRow = h('div', { class: 'cs-row' }, h('button', { type: 'button', class: 'cs-btn cs-small', onclick: () => checkAll() }, 'Check these'));
      const msg = h('div', { class: 'cs-muted', style: 'font-size:12.5px' });
      const setSlip = (s, text) => {
        if (!text) { s.slip?.remove(); s.slip = null; return; }
        if (!s.slip) { s.slip = html('div', { class: 'cs-rslip' }, ''); s.row.after(s.slip); }   // under its line, above Show this line
        setHtml(s.slip, text);
      };
      function checkOne(s, counting = true) {
        if (s.ok) return true;
        const v = E.parseNumber(s.inp.value);
        if (v === null) { s.mark.replaceChildren(); s.inp.removeAttribute('aria-invalid'); return false; }
        const u = s.r.unit || '$', target = num(val(s.r.answer, ctx));
        if (matches(u, v, target)) {
          s.ok = true; s.inp.readOnly = true; s.inp.classList.add('ok'); s.inp.removeAttribute('aria-invalid'); s.mark.replaceChildren(TICK()); setSlip(s, null);
          return true;
        }
        if (counting) s.wrong++;
        s.inp.setAttribute('aria-invalid', 'true'); s.mark.replaceChildren(h('span', { class: 'cs-rx' }, '×'));
        const slip = arr(s.r.slips).find(x => matches(u, v, num(val(x.value, ctx))));
        setSlip(s, slip ? val(slip.msg, ctx, v) : null);
        if (reveal && s.wrong >= 2 && !s.showBtn) {
          s.showBtn = h('button', { type: 'button', class: 'cs-btn cs-ghost cs-small', onclick: () => {
            s.inp.value = fmtU(u, target).replace(/[$ ]|min|h$/g, '').trim(); s.ok = true; s.inp.readOnly = true; s.inp.classList.add('ok'); s.inp.removeAttribute('aria-invalid'); s.mark.replaceChildren(TICK()); setSlip(s, null);
            const how = html('div', { class: 'cs-rhow', tabindex: '-1' }, val(s.r.how, ctx) || `The answer is ${fmtU(u, target)}.`);
            s.showBtn.replaceWith(how); how.focus({ preventScroll: true }); say(plain(label(s)) + ': ' + plain(how.innerHTML)); finish();
          } }, 'Show this line');
          (s.slip || s.row).after(s.showBtn);
        }
        return false;
      }
      const label = s => val(s.r.label, ctx);
      function checkAll() {
        let wrong = 0, empty = 0, bad = 0;
        for (const s of state) {
          if (s.ok) continue;
          if (E.parseNumber(s.inp.value) === null) { if (s.inp.value.trim()) { bad++; s.inp.setAttribute('aria-invalid', 'true'); } else empty++; continue; }
          if (!checkOne(s)) wrong++;
        }
        const parts = [];
        if (wrong) parts.push(`${wrong} line${wrong > 1 ? 's' : ''} not right yet.`);
        if (bad) parts.push(`Type just the number on ${bad === 1 ? '1 line' : bad + ' lines'}, like ${state.find(s => !s.ok && (s.r.unit || '$') === 'min') ? '2.5' : '1.40'}.`);
        if (!wrong && !bad && empty) parts.push('Fill in the empty lines.');
        if (wrong && reveal && state.some(s => s.showBtn && !s.ok)) parts.push('Stuck on a line? Tap Show this line.');
        msg.textContent = parts.join(' ');
        if (wrong || bad) say(msg.textContent + ' ' + state.filter(s => s.slip).map(s => plain(s.slip.innerHTML)).join(' '));
        finish();
      }
      function finish() { if (!fired && state.every(s => s.ok)) { fired = true; msg.textContent = 'All lines right.'; btnRow.hidden = true; say('All lines right.'); try { onDone?.(); } catch (e) { console.warn(e); } } }
      el.append(box, btnRow, msg);
      return () => { };
    };
    // two receipts side by side, after the learner predicts the difference
    ui.ab = (el, { a, b, prompt = 'Your guess: how much more does B cost?', onDone } = {}) => {
      const inp = h('input', { class: 'cs-in', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': plain(prompt) + ', dollars' });
      const go = h('button', { type: 'button', class: 'cs-btn cs-small cs-primary', disabled: true }, 'Compare');
      const out = h('div', { class: 'cs-abox', hidden: true });
      inp.addEventListener('input', () => { go.disabled = E.parseNumber(inp.value) === null; });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !go.disabled) { e.preventDefault(); go.click(); } });
      const rc = (side) => {
        const k = E.carCost(side.cfg, ctx.R, ctx.up);
        const slow = k.bottAll.length > 2 ? `${k.bottAll.length} stations tie at ${E.fmt.min(k.bott)}` : k.bottAll.map(i => ST[i]).join(' & ') + ' ' + E.fmt.min(k.bott);
        const rows = [['Materials', E.fmt.money2(k.materials)], ['Slowest', slow], ['Cycle', E.fmt.min(k.cycle) + ' min'], ['Crew + power', E.fmt.money2(k.crewCost + k.power)], ['Consumables', E.fmt.money2(k.consumables)]];
        const box = h('div', { class: 'cs-rcpt' }, h('div', { class: 'cs-abh' }, side.label));
        for (const [l, v] of rows) box.append(h('div', { class: 'cs-rrow' }, h('span', { class: 'cs-rl' }, l), h('span', { class: 'cs-rv' }, v)));
        box.append(h('div', { class: 'cs-rrow total' }, h('span', { class: 'cs-rl' }, 'Started'), h('span', { class: 'cs-rv' }, E.fmt.money2(k.started))));
        return { box, k };
      };
      go.addEventListener('click', () => {
        const guess = E.parseNumber(inp.value); if (guess === null) return;
        const A = rc(a), B = rc(b), d = B.k.started - A.k.started, cyc = B.k.cycle - A.k.cycle, added = B.k.work - A.k.work;
        const mn = E.fmt.min, meter = E.fmt.money2(B.k.lineRate);
        // the cycle test (SPEC appendix, L6): only the minutes the option adds to the cycle cost the whole line meter
        const why = Math.abs(cyc) < 1e-9
          ? (added > 1e-9 ? `B adds ${mn(added)} min of work, but the cycle stays ${mn(A.k.cycle)} min: the extra work fits in time people already wait, so only the parts count.` : `The cycle stays ${mn(A.k.cycle)} min, so only the parts count.`)
          : cyc > 0 && added - cyc > 1e-9
            ? `B adds ${mn(added)} min of work, but only ${mn(cyc)} of it is past the old slowest station (${mn(A.k.bott)} min). So the cycle goes ${mn(A.k.cycle)} → ${mn(B.k.cycle)} min, and the whole line meter pays for ${mn(cyc)} more minutes at ${meter}.`
            : `The cycle goes ${mn(A.k.cycle)} → ${mn(B.k.cycle)} min, so the whole line meter pays for ${mn(cyc)} more minutes at ${meter}.`;
        const had = el.contains(document.activeElement);
        const diff = html('p', { class: 'cs-diff', tabindex: '-1' }, `B − A = <b>${E.fmt.signed(d)}</b> per started car. You guessed ${E.fmt.money2(guess)}. ${why}`);
        out.replaceChildren(h('div', { class: 'cs-ab' }, A.box, B.box), diff);
        out.hidden = false; inp.readOnly = true; go.disabled = true;
        if (had) diff.focus({ preventScroll: true });
        say(`B minus A is ${E.fmt.signed(d)}. You guessed ${E.fmt.money2(guess)}.`);
        try { onDone?.(); } catch (e) { console.warn(e); }
      });
      el.append(h('div', { class: 'cs-row' }, h('label', { class: 'cs-field' }, h('span', { style: 'font-size:13px' }, plain(prompt)), h('span', { class: 'cs-unit' }, '$'), inp), go), out);
      return () => { };
    };
    return ui;
  }

  /* ------------------------------------------------ the course ctx */
  function makeCtx(lesson, mem, over = {}) {
    const R = over.R || E.rules(), up = over.up || { ...E.NO_UPGRADES }, cfg = { ...(over.cfg || lesson?.cfg || E.DEFAULT_CAR) };
    let car = null, month = null;
    try { car = E.carCost(cfg, R, up); month = E.month(cfg, R, up, over.price ? { price: over.price } : {}); } catch (e) { console.warn('[course] ctx car', e); }
    const ctx = {
      engine, app, econ, widgets: W, ledger, platform, tutor, R, up, cfg, car, month,
      $: E.fmt.money2, $m: E.fmt.money, min: E.fmt.min, n: E.fmt.count, pct: E.fmt.pct, rate: E.fmt.rate,
      mem, lesson, scenario: over.scenario || null,
      complete: id => { if (cur && cur.ctx === ctx) completeStep(id); },
      progress: P, prediction: lid => P.lessons?.[lid]?.prediction ?? null, seed: P.seed,
      rulesCard: el => renderRulesCard(el),
      keepLine: src => keepLine(ctx, src)
    };
    ctx.ui = makeUi(ctx);
    return ctx;
  }

  // ctx.keepLine(cfg) -> stop(): keep the line fed while the lesson is open, so a live demo never drains while the
  // learner reads. One car always waits in the queue: whenever a queued car enters (or the line goes idle or is
  // refilled) and the queue is empty, another car of `cfg` is sent. `cfg` may be a function (e.g. () => engine.cfg).
  // Stopped by the returned function, and always when the lesson closes.
  function keepLine(ctx, src) {
    const e = engine;
    if (!e?.send || !e?.on) return () => { };
    let stopped = false;
    const cfgNow = () => { let c = null; try { c = typeof src === 'function' ? src() : src; } catch { } return { ...(c || ctx.cfg) }; };
    const feed = () => {
      if (stopped || (cur && cur.ctx !== ctx)) return;
      try {
        if ((e.queueLength?.() ?? 1) > 0) return;
        // follow:false: a refill never takes the camera off the car the learner is following (or re-flies it)
        e.send(cfgNow(), { follow: false });
      } catch (err) { console.warn('[course] keepLine', err); }
    };
    const offs = ['enter', 'cycle', 'lineIdle'].map(n => { try { return e.on(n, feed); } catch { return null; } });
    feed();
    const stop = () => { if (stopped) return; stopped = true; offs.forEach(f => { try { f?.(); } catch { } }); };
    if (cur && cur.ctx === ctx) cur.cleanups.push(stop);
    return stop;
  }

  /* ------------------------------------------------ a check, any kind (CONTRACTS "Check kinds") */
  const tutorRefreshers = new Set();
  const tutorOff = tutor?.onChange?.(() => tutorRefreshers.forEach(f => { try { f(); } catch { } }));
  function mountCheck(host, chk, ctx, o = {}) {
    const kind = chk.kind || 'number';
    const scored = chk.scored !== false;
    const st = { attempts: 0, resolved: null, offs: [], cleanups: [], asks: [], last: null, miss: null };
    const rootEl = h('div', { class: 'cs-check', 'data-kind': kind, 'data-key': o.key || chk.id || '' });
    if (o.label) rootEl.append(h('div', { class: 'cs-lab' }, o.label));
    const promptHtml = val(chk.prompt, ctx) || DEFAULT_PROMPT[kind] || '';
    const promptEl = html('div', { class: 'cs-prompt' }, promptHtml);
    const body = h('div', { class: 'cs-cbody' });
    const act = h('div', { class: 'cs-row' });
    const fb = h('div', { class: 'cs-fb', hidden: true });
    const hintBox = h('div', { class: 'cs-hintbox', hidden: true });
    const bubble = h('div', { class: 'cs-bubble', hidden: true });
    rootEl.append(promptEl, body, act, fb, hintBox, bubble);
    host.append(rootEl);
    const hintText = () => val(chk.hint, ctx) || val(ctx.lesson?.hint, ctx) || '';
    let checkBtn = null;
    const addCheckBtn = (label, fn) => { checkBtn = h('button', { type: 'button', class: 'cs-btn cs-primary', onclick: fn }, label); act.prepend(checkBtn); return checkBtn; };
    let hintBtn = null;
    if (scored && hintText()) {
      hintBtn = h('button', { type: 'button', class: 'cs-btn cs-ghost cs-small', 'aria-expanded': 'false', onclick: () => { setHtml(hintBox, hintText()); hintBox.hidden = !hintBox.hidden; hintBtn.setAttribute('aria-expanded', String(!hintBox.hidden)); } }, 'Hint');
      act.append(hintBtn);
    }
    const askBtn = h('button', { type: 'button', class: 'cs-btn cs-small', hidden: true, onclick: () => ask() }, 'Ask the accountant');
    act.append(askBtn);
    const refreshAsk = () => { askBtn.hidden = !(st.attempts > 0 && tutor?.available?.()); };
    tutorRefreshers.add(refreshAsk);
    function ask() {
      bubble.hidden = false;
      let data = {};
      try { data = tutor?.snapshot?.(ctx) || {}; } catch (e) { console.warn(e); }
      data = { ...data, step: o.key || chk.id, question: { id: chk.id, text: plain(promptHtml), kind, unit: chk.unit || null }, learnerAnswer: st.last, attempts: st.attempts, diagnosis: st.miss, reveal: !!st.resolved };
      try { const hd = tutor?.ask?.(bubble, { kind: 'why', question: `I answered ${st.last ?? '…'} to: ${plain(promptHtml)} What went wrong?`, data, reveal: !!st.resolved }); if (hd) st.asks.push(hd); } catch (e) { console.warn(e); }
    }
    function feedback(type, tag, parts) {
      fb.hidden = false; fb.className = 'cs-fb cs-fb-' + type;
      fb.replaceChildren(h('div', { class: 'cs-fbt' }, tag), ...parts.filter(Boolean).map(p => html('p', null, p)));
      say(tag + '. ' + plain(parts.filter(Boolean).join(' ')));
    }
    function lock() { body.querySelectorAll('input, button, textarea').forEach(x => { if (x.tagName === 'INPUT' || x.tagName === 'TEXTAREA') x.readOnly = true; else if (!x.classList.contains('cs-keep')) { x.disabled = true; x.setAttribute('aria-disabled', 'true'); } }); if (checkBtn) checkBtn.hidden = true; }
    function resolve(r) {
      // the control the learner used is about to be disabled or hidden: keep their place by moving focus to the result
      const had = rootEl.contains(document.activeElement);
      st.resolved = r; lock(); st.offs.forEach(f => { try { f?.(); } catch { } }); st.offs = [];
      if (had && !fb.hidden) { fb.tabIndex = -1; try { fb.focus({ preventScroll: true }); } catch { } }
      try { o.onResolve?.({ result: r, attempts: st.attempts }); } catch (e) { console.warn(e); }
    }
    function answerText() {
      if (kind === 'number') return fmtU(chk.unit, num(val(chk.answer, ctx)));
      if (kind === 'numbers') return (chk.fields || []).map(f => `${plain(val(f.label, ctx))} ${fmtU(f.unit || chk.unit, num(val(f.answer, ctx)))}`).join(', ');
      if (kind === 'station') return arr(val(chk.answer, ctx)).map(i => ST[i]).join(' or ');
      if (kind === 'price') return arr(val(chk.accepted, ctx)).map(p => E.fmt.money2(p)).join(', ');
      if (kind === 'marker') { const a = val(chk.accepted, ctx) || {}; return E.fmt.count(a.at); }
      if (kind === 'choice') return (opts || []).filter(x => x.correct).map(x => plain(x.text)).join('; ');
      return '';
    }
    // g: { correct, dist?, diag?, value }
    function submit(g) {
      if (st.resolved) return;
      st.last = g.shown ?? g.value;
      if (!scored) {
        try { o.onAnswer?.({ correct: null, noted: true, value: g.value, text: g.text }); } catch (e) { console.warn(e); }
        feedback('info', 'Saved', [val(chk.after, ctx, g.value) || (kind === 'choice' ? 'Noted.' : 'Keep it in mind: the lesson tests it below.')]);
        resolve('noted'); return;
      }
      const missId = g.correct ? null : (g.dist?.id || 'other');
      st.miss = missId;
      try { o.onAnswer?.({ correct: !!g.correct, missId, value: g.value }); } catch (e) { console.warn(e); }
      if (g.correct) {
        const after = val(chk.after, ctx, g.value);
        feedback('right', 'Right', [after || g.note || null]);
        resolve('right'); refreshAsk(); return;
      }
      st.attempts++;
      const specific = (g.dist ? val(g.dist.msg, ctx, g.value) : null) || g.diag || null;
      const diag = specific || 'Not quite. Go through it one step at a time.';
      if (st.attempts === 1) feedback('wrong', 'Not yet · try again', [diag]);
      else if (st.attempts === 2) feedback('wrong', 'Not yet · here’s the worked step', [diag, val(chk.step2, ctx) || hintText() || null]);
      else {
        // the full solution; a generic "go through it" line would only get in its way
        feedback('solution', 'Here’s the answer', [specific, val(chk.solution, ctx) || `The answer is <b>${answerText()}</b>.`, o.review ? 'This one comes back in the next warm-up.' : null]);
        try { o.onShown?.(); } catch (e) { console.warn(e); }
        g.reveal?.();
        resolve('shown');
      }
      refreshAsk();
    }
    const distFor = (list, u, v, tol) => arr(list).find(d => matches(u, v, num(val(d.value, ctx)), tol));
    function genericNum(u, v, x) {
      const a = roundFor(u, pctTarget(u, v, x));
      if ([10, 100].some(f => Math.abs(v * f - a) < 1e-6 || Math.abs(v - a * f) < 1e-6)) return 'Check the decimal point.';
      if (Math.abs(v - a) <= Math.max((TOL[u] ?? 0.01) * 6, Math.abs(a) * 0.004)) return 'Close. Check your rounding.';
      return null;
    }
    const numInput = (label, u) => h('input', { class: 'cs-in', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': label });
    const fieldWrap = (inp, u) => h('span', { class: 'cs-field' }, unitPrefix(u) ? h('span', { class: 'cs-unit' }, '$') : null, inp, unitSuffix(u) ? h('span', { class: 'cs-unit' }, unitSuffix(u)) : null);
    // a box that is empty or holds something that is not a number. Under feedback the learner is still reading, the note
    // is added below it (the diagnosis stays); otherwise it is the feedback.
    const EXAMPLE = { '$': '12.50', '$m': '9,600', min: '2.5', h: '1.5', '%': '25', cars: '1,140' };
    const addNote = (tag, t) => {
      if (!fb.hidden && !fb.classList.contains('cs-fb-info')) {
        let n = fb.querySelector('.cs-need'); if (!n) { n = h('p', { class: 'cs-need' }); fb.append(n); }
        n.textContent = t; say(t); return;
      }
      feedback('info', tag, [t]);
    };
    const needNumber = (raw, u) => addNote('Type a number', String(raw ?? '').trim() ? `Type just the number, like ${EXAMPLE[u] || '12.50'}.` : `Type a number first, like ${EXAMPLE[u] || '12.50'}.`);
    let opts = null;

    /* -------- kinds */
    if (kind === 'number') {
      const u = chk.unit || '$';
      const inp = numInput(plain(promptHtml), u);
      body.append(fieldWrap(inp, u));
      const go = () => {
        const v = E.parseNumber(inp.value); if (v === null) return needNumber(inp.value, u);
        const x = num(val(chk.answer, ctx));
        if (!scored) return submit({ value: v });
        const ok = matches(u, v, x, chk.tol);
        inp.setAttribute('aria-invalid', String(!ok)); if (ok) inp.classList.add('ok');
        submit({ correct: ok, value: v, dist: ok ? null : distFor(chk.distractors, u, v, chk.tol), diag: ok ? null : (val(chk.diagnose, ctx, v) || genericNum(u, v, x)) });
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      addCheckBtn(scored ? 'Check' : 'Save my guess', go);
    } else if (kind === 'numbers') {
      const fields = arr(chk.fields);
      const wrap = h('div', { class: 'cs-fields' });
      const F = fields.map((f, i) => {
        const u = f.unit || chk.unit || '$', label = plain(val(f.label, ctx) || `Answer ${i + 1}`);
        const inp = numInput(label, u), id = 'cs-f-' + Math.random().toString(36).slice(2, 8);
        inp.id = id;
        const mark = h('span', { class: 'cs-fm', 'aria-hidden': 'true' });
        wrap.append(h('div', { class: 'cs-frow' }, h('label', { for: id }, label), fieldWrap(inp, u), mark));
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        return { f, u, inp, mark, ok: false };
      });
      body.append(wrap);
      const go = () => {
        const vals = F.map(x => E.parseNumber(x.inp.value));
        if (vals.some(v => v === null)) {
          const bad = F.find((x, i) => vals[i] === null && x.inp.value.trim());
          if (bad) return needNumber(bad.inp.value, bad.u);
          if (!fb.hidden && !fb.classList.contains('cs-fb-info')) return needNumber('', F.find((x, i) => vals[i] === null)?.u);
          return feedback('info', 'Fill every box', ['Fill in every box, then check.']);
        }
        if (!scored) return submit({ value: vals });
        let dist = null, diag = null, wrong = 0;
        F.forEach((x, i) => {
          const ans = num(val(x.f.answer, ctx));
          x.ok = matches(x.u, vals[i], ans, x.f.tol ?? chk.tol);
          x.inp.setAttribute('aria-invalid', String(!x.ok)); x.inp.classList.toggle('ok', x.ok);
          x.mark.replaceChildren(x.ok ? TICK() : document.createTextNode('×'));
          if (!x.ok) { wrong++; if (!dist) dist = distFor(x.f.distractors, x.u, vals[i], x.f.tol ?? chk.tol); if (!diag) diag = genericNum(x.u, vals[i], ans); }
        });
        const ok = wrong === 0;
        if (!ok && !dist) diag = (diag ? diag + ' ' : '') + (F.length > 1 ? `${wrong} of ${F.length} answers ${wrong > 1 ? 'are' : 'is'} not right yet.` : '');
        submit({ correct: ok, value: vals, dist, diag });
      };
      addCheckBtn(scored ? 'Check' : 'Save my guess', go);
    } else if (kind === 'choice') {
      opts = arr(val(chk.options, ctx)).map(x => ({ ...x, text: val(x.text, ctx), why: x.why }));
      if (scored && !keepOrder(chk, opts)) opts = shuffled(opts, rng(`${ctx.lesson?.id || ''}:${chk.id || o.key || ''}:${P.seed}`));
      const multi = !!chk.multi;
      const list = h('div', { class: 'cs-opts', role: 'group', 'aria-label': plain(promptHtml) });
      const B = opts.map((x, i) => {
        const b = h('button', { type: 'button', class: 'cs-opt', 'aria-pressed': 'false' }, h('span', { class: 'cs-ob', 'aria-hidden': 'true' }), html('span', { class: 'cs-ot' }, x.text));
        b.addEventListener('click', () => {
          if (st.resolved || b.getAttribute('aria-disabled') === 'true') return;
          if (multi) { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); return; }
          B.forEach(o2 => o2.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
          if (!scored) return submit({ value: i, text: plain(x.text) });
          if (x.correct) { b.classList.add('right'); return submit({ correct: true, value: i, note: val(x.why, ctx) || null }); }
          b.classList.add('wrong'); b.setAttribute('aria-disabled', 'true');
          submit({ correct: false, value: i, dist: { id: 'opt' + i, msg: val(x.why, ctx) || null }, reveal: () => B.forEach((o2, j) => opts[j].correct && o2.classList.add('right')) });
        });
        list.append(b); return b;
      });
      body.append(list);
      if (multi) addCheckBtn('Check', () => {
        const picked = B.map(b => b.getAttribute('aria-pressed') === 'true');
        if (!picked.some(Boolean)) return feedback('info', 'Pick one', ['Pick at least one.']);
        if (!scored) return submit({ value: picked });
        const ok = opts.every((x, i) => !!x.correct === picked[i]);
        const wrongPick = opts.findIndex((x, i) => picked[i] && !x.correct);
        B.forEach((b, i) => b.classList.toggle('wrong', picked[i] && !opts[i].correct));
        submit({ correct: ok, value: picked, dist: wrongPick >= 0 ? { id: 'opt' + wrongPick, msg: val(opts[wrongPick].why, ctx) } : null, diag: ok ? null : 'One you need is missing.', reveal: () => B.forEach((b, j) => { b.classList.toggle('right', !!opts[j].correct); b.setAttribute('aria-pressed', String(!!opts[j].correct)); }) });
      });
    } else if (kind === 'station') {
      const ans = () => arr(val(chk.answer, ctx)).map(Number);
      const grid = h('div', { class: 'cs-stations', role: 'group', 'aria-label': 'Stations' });
      const B = ST.map((s, i) => { const b = h('button', { type: 'button', class: 'cs-btn', onclick: () => pick(i, 'list') }, h('span', null, String(i + 1).padStart(2, '0')), s); grid.append(b); return b; });
      body.append(h('div', { class: 'cs-muted', style: 'font-size:12.5px' }, 'Tap it in the strip or the 3D factory, or pick it here:'), grid);
      function pick(i) {
        if (st.resolved || !(i >= 0 && i < ST.length)) return;
        if (!scored) return submit({ value: i, text: ST[i] });
        const ok = ans().includes(i);
        B[i].classList.add(ok ? 'right' : 'wrong');
        submit({ correct: ok, value: i, shown: ST[i], diag: ok ? null : (val(chk.diagnose, ctx, i) || `Not ${ST[i]}.`), reveal: () => ans().forEach(j => B[j]?.classList.add('right')) });
      }
      const off = engine?.on?.('stationTap', e => pick(+e?.station));
      st.offs.push(off);
    } else if (kind === 'car') {
      const test = val(chk.answer, ctx);
      const grid = h('div', { class: 'cs-cars', role: 'group', 'aria-label': 'Parked cars' });
      const nameOf = car => { const s = E.SAMPLE_CARS.find(x => E.carKey(x.cfg) === E.carKey(car.cfg || {}) && (x.cfg.color || '').toUpperCase() === (car.cfg?.color || '').toUpperCase()); return car.name || s?.name || (E.CATALOG.body[car.cfg?.body]?.label || 'Car') + (car.wo ? ' ' + car.wo : ''); };
      let cars = [];
      try { cars = (engine?.cars?.() || []).filter(c => c && (c.place === 'lot' || c.place === 'stock') && c.cfg); } catch { }
      if (!cars.length) cars = E.SAMPLE_CARS.map(s => ({ wo: null, name: s.name, cfg: { ...s.cfg }, place: 'lot' }));
      const B = new Map();
      for (const c of cars) { const b = h('button', { type: 'button', class: 'cs-btn', onclick: () => pick(c) }, h('span', { class: 'cs-swatch', style: `background:${c.cfg.color || 'var(--wood)'}`, 'aria-hidden': 'true' }), nameOf(c)); B.set(c, b); grid.append(b); }
      body.append(h('div', { class: 'cs-muted', style: 'font-size:12.5px' }, 'Tap it in the lot, or pick it here:'), grid);
      function pick(car) {
        if (st.resolved || !car) return;
        let ok = false; try { ok = typeof test === 'function' ? !!test(car) : false; } catch { }
        const b = [...B.entries()].find(([c]) => c === car || (c.wo && c.wo === car.wo) || (!c.wo && E.carKey(c.cfg) === E.carKey(car.cfg || {}) && c.cfg.color === car.cfg?.color))?.[1];
        b?.classList.add(ok ? 'right' : 'wrong');
        if (!scored) return submit({ value: nameOf(car), text: nameOf(car) });
        submit({ correct: ok, value: nameOf(car), diag: ok ? null : (val(chk.diagnose, ctx, car) || val(chk.why, ctx) || 'Not that one.'), reveal: () => { for (const [c, bb] of B) { let r = false; try { r = !!test(c); } catch { } if (r) bb.classList.add('right'); } } });
        if (ok && chk.why && !chk.after) { const w = val(chk.why, ctx); if (w) fb.append(html('p', null, w)); }
      }
      st.offs.push(engine?.on?.('carTap', e => pick(e?.car)));
    } else if (kind === 'sort') {
      const bins = arr(val(chk.bins, ctx)), cards = arr(val(chk.cards, ctx));
      const placed = cards.map(() => null), rows = [];
      const list = h('div', { class: 'cs-sort' });
      cards.forEach((c, i) => {
        const seg = h('div', { class: 'cs-seg', role: 'group', 'aria-label': plain(val(c.text, ctx)) });
        const bb = bins.map((bin, j) => { const b = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { if (st.resolved) return; placed[i] = j; bb.forEach((x, k) => x.setAttribute('aria-pressed', String(k === j))); rows[i].row.classList.remove('wrong'); rows[i].x.textContent = ''; } }, bin); seg.append(b); return b; });
        const x = h('span', { class: 'cs-sx', 'aria-hidden': 'true' });
        const row = h('div', { class: 'cs-srow' }, html('span', { class: 'cs-stt' }, val(c.text, ctx)).appendChild(x).parentNode, seg);
        rows.push({ row, bb, x }); list.append(row);
      });
      body.append(list);
      const binIndex = c => { const b = c.bin; return typeof b === 'number' ? b : bins.findIndex(x => String(x).toLowerCase() === String(b).toLowerCase()); };
      addCheckBtn('Check', () => {
        if (placed.some(p => p === null)) return feedback('info', 'Sort every card', [`${placed.filter(p => p === null).length} card${placed.filter(p => p === null).length > 1 ? 's are' : ' is'} not sorted yet.`]);
        if (!scored) return submit({ value: [...placed] });
        const wrong = cards.map((c, i) => placed[i] !== binIndex(c));
        wrong.forEach((w, i) => { rows[i].row.classList.toggle('wrong', w); rows[i].x.textContent = w ? '×' : ''; });
        const n = wrong.filter(Boolean).length, first = wrong.indexOf(true);
        submit({ correct: n === 0, value: [...placed], dist: first >= 0 && cards[first].why ? { id: 'card' + first, msg: `${n} card${n > 1 ? 's are' : ' is'} in the wrong bin. ${val(cards[first].why, ctx)}` } : null, diag: `${n} card${n > 1 ? 's are' : ' is'} in the wrong bin.`, reveal: () => cards.forEach((c, i) => { placed[i] = binIndex(c); rows[i].bb.forEach((x, k) => x.setAttribute('aria-pressed', String(k === placed[i]))); rows[i].row.classList.remove('wrong'); rows[i].x.textContent = ''; }) });
      });
    } else if (kind === 'price' || kind === 'marker') {
      const isPrice = kind === 'price', u = isPrice ? '$' : 'cars';
      const accepted = () => val(chk.accepted, ctx);
      const ok = v => {
        if (isPrice) return arr(accepted()).some(a => Math.abs(v - num(a)) < 0.005);
        const a = accepted() || {}; return Math.abs(v - num(a.at)) <= (num(a.within) ?? 0) + 1e-9;
      };
      const diagFor = v => {
        try {
          if (isPrice) { const m = E.month(ctx.cfg, ctx.R, ctx.up, { price: v }); return `At ${E.fmt.money2(v)} the shops order ${E.fmt.count(m.sold)} cars and the month makes ${E.fmt.money(m.pl.profit)}.`; }
          const price = ctx.app?.state?.price ?? ctx.R.price, m = E.month(ctx.cfg, ctx.R, ctx.up, { price, sold: v });
          return `At ${E.fmt.count(v)} cars, sales are ${E.fmt.money(m.pl.sales)} and total cost is ${E.fmt.money(m.pl.variable + m.pl.fixed)}.`;
        } catch { return null; }
      };
      const place = v => {
        v = num(v); if (v === null || !Number.isFinite(v)) return;
        if (!scored) return submit({ value: v });
        const good = ok(v);
        submit({ correct: good, value: v, shown: isPrice ? E.fmt.money2(v) : E.fmt.count(v), dist: good ? null : distFor(chk.distractors, u, v, chk.tol), diag: good ? null : diagFor(v) });
      };
      const wname = chk.widget || (isPrice ? 'priceProfitChart' : 'breakEvenChart');
      const wfn = W?.[wname];
      if (typeof wfn === 'function') {
        const host2 = h('div', { class: 'cs-chart' }); body.append(host2);
        try {
          const price = ctx.app?.state?.price ?? ctx.R.price;
          const o2 = isPrice ? { cfg: ctx.cfg, R: ctx.R, up: ctx.up, price, place: { onPlace: p => place(p) } } : { cfg: ctx.cfg, R: ctx.R, up: ctx.up, price, marker: { onPlace: c => place(c) } };
          const w = wfn(host2, { ...o2, ...(chk.widgetOptions || {}) });
          st.cleanups.push(() => w?.destroy?.());
        } catch (e) { console.warn('[course] widget ' + wname + ' failed; using the number box', e); host2.remove(); }
      }
      const inp = numInput(isPrice ? 'Price in dollars' : 'Cars', u);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); goNum(); } });
      // a typed price off the chart's $0.50 grid is not graded (no rung used): the accepted set lives on the grid
      const step = num(chk.step ?? chk.widgetOptions?.step ?? 0.5) || 0.5;
      const goNum = () => {
        const v = E.parseNumber(inp.value); if (v === null) return needNumber(inp.value, u);
        if (isPrice && scored && !st.resolved && Math.abs(v / step - Math.round(v / step)) > 1e-6) {
          const lo = Math.floor(v / step) * step, hi = lo + step;
          return addNote(`${E.fmt.money2(step)} steps`, `Prices move in ${E.fmt.money2(step)} steps: try the nearest one, ${E.fmt.money2(lo)} or ${E.fmt.money2(hi)}.`);
        }
        place(v);
      };
      body.append(h('div', { class: 'cs-row' }, h('span', { class: 'cs-muted', style: 'font-size:12.5px' }, typeof wfn === 'function' ? 'Or type it:' : (isPrice ? 'Type the price:' : 'Type the number of cars:')), fieldWrap(inp, u)));
      addCheckBtn('Check', goNum);
    } else if (kind === 'custom') {
      const host2 = h('div', { class: 'cs-custom' }); body.append(host2);
      try {
        const c = chk.render?.(host2, ctx, (r = {}) => submit({ correct: !!r.correct, value: r.value, diag: r.msg || null, dist: r.id ? { id: r.id, msg: r.msg } : null }));
        if (typeof c === 'function') st.cleanups.push(c);
      } catch (e) { console.warn('[course] custom check failed', e); body.append(h('p', { class: 'cs-muted' }, 'This check could not load.')); }
    } else {
      body.append(h('p', { class: 'cs-muted' }, `Unknown check kind “${kind}”.`));
    }
    return {
      el: rootEl,
      get resolved() { return st.resolved; },
      focus() { const f = body.querySelector('input:not([readonly]), button:not(:disabled)'); (f || rootEl).focus?.({ preventScroll: true }); },
      destroy() { st.offs.forEach(f => { try { f?.(); } catch { } }); st.cleanups.forEach(f => { try { f?.(); } catch { } }); st.asks.forEach(a => { try { a?.stop?.(); } catch { } }); tutorRefreshers.delete(refreshAsk); }
    };
  }

  /* ------------------------------------------------ course map */
  let cur = null, lastId = null, chCur = null, io = null, cardInView = false;
  const doneCount = () => allLessons().filter(l => P.lessons[l.id]?.done).length;
  function renderMap() {
    const s = app.state;
    if (s.mode !== 'course') return;
    const L = allLessons();
    const firstOpen = L.find(l => !P.lessons[l.id]?.done) || null;
    const units = [...new Set(L.map(l => l.unit || 'A'))];
    const tiles = h('div', { class: 'cs-units' });
    for (const u of units) {
      const ls = L.filter(l => (l.unit || 'A') === u);
      const t = h('div', { class: 'cs-tiles' });
      for (const l of ls) {
        const done = !!P.lessons[l.id]?.done;
        const b = h('button', { type: 'button', class: 'cs-tile' + (done ? ' done' : ''), 'aria-current': cur?.lesson.id === l.id ? 'true' : 'false', onclick: () => openLesson(l.id, { focus: true }), 'aria-label': `${l.short || l.id}: ${l.title}${done ? ', done' : ''}` },
          h('span', { class: 'cs-tid' }, h('span', null, l.short || l.id), done ? TICK() : h('span', null, (l.minutes ? l.minutes + ' min' : ''))), h('span', { class: 'cs-ttl' }, l.title));
        t.append(b);
      }
      tiles.append(h('div', { class: 'cs-unitrow' }, h('div', { class: 'cs-lab' }, h('span', null, UNIT_NAMES[u] ? `Unit ${u} · ${UNIT_NAMES[u]}` : `Unit ${u}`), h('b', null, `${ls.filter(l => P.lessons[l.id]?.done).length}/${ls.length}`)), t));
    }
    if (bStatus === 'missing') tiles.append(h('p', { class: 'cs-muted', style: 'margin:0;font-size:12.5px' }, 'Unit B could not load in this view.'));
    if (cur) {
      const det = h('details', { class: 'cs-mapbox' }, h('summary', null, h('span', null, `Course map · ${doneCount()} of ${L.length} done`)), tiles);
      mapEl.replaceChildren(det);
    } else {
      const nextL = (lastId && byId(lastId) && !P.lessons[lastId]?.done) ? byId(lastId) : firstOpen;
      // the short way in, for someone with two minutes: the Order tab with the camera on their car (no lesson needed).
      // Not offered when the 3D factory could not load, since the order form lives in it (main.js hides its tab then).
      const build = document.getElementById('tabOrder')?.hidden ? null
        : h('button', { type: 'button', class: 'cs-btn cs-ghost', onclick: () => { app.set({ tab: 'order' }); engine?.setCamera?.('follow'); } }, 'Or just build a car');
      const intro = h('div', { class: 'cs-intro', style: 'display:grid;gap:8px' },
        h('div', { class: 'cs-lab' }, h('span', null, 'Course'), h('b', null, `${doneCount()} of ${L.length} done`)),
        h('h2', { class: 'cs-h2' }, 'Learn what a toy car really costs'),
        html('p', { class: 'cs-goal' }, 'Short lessons, one idea each. Unit A prices one car; Unit B runs a month. Predict first, then watch the factory prove you right or wrong. Nothing is scored.'),
        nextL ? h('div', { class: 'cs-row' }, h('button', { type: 'button', class: 'cs-btn cs-primary', onclick: () => openLesson(nextL.id, { focus: true }) }, `${doneCount() ? 'Continue' : 'Start'} · ${nextL.short || nextL.id} ${nextL.title}`), build) : h('p', { class: 'cs-goal' }, 'You’ve finished every lesson. Try the Challenges.'));
      mapEl.replaceChildren(intro, tiles);
    }
  }

  /* ------------------------------------------------ side: notebook + rules card */
  // "Rules of this factory": built from the rules in force (app.state.R). In the course they are the locked defaults and
  // the default car; on the Factory floor they are the learner's own rules, plan price and order.
  function renderRulesCard(el) {
    const s = app.state, factory = s.mode === 'factory';
    const R = s.R || E.rules(), up = factory ? (s.up || E.NO_UPGRADES) : E.NO_UPGRADES;
    let cfg = E.DEFAULT_CAR; if (factory) { try { cfg = engine?.cfg || cfg; } catch { } }
    let mo = null; try { mo = E.month(cfg, R, up, { price: s.price ?? R.price }); } catch (e) { console.warn('[course] rules card', e); }
    const k = mo?.car || E.carCost(cfg, R, up);
    const box = h('div', { class: 'cs-rules', style: 'display:grid;gap:8px' });
    const items = [`<li>The line crew are hourly. They clock on when the line starts and off when it stops, so their pay is a <g t="variable cost">variable cost</g>.</li>`];
    const when = factory ? 'With these rules, this order and this price,' : 'At default';
    let run;
    if (!mo || !(mo.lineMin > 0)) run = `${when} the line doesn’t run this month.`;
    else {
      const days = mo.lineMin / R.shiftMin, full = Math.floor(days + 1e-9), frac = days - full;
      const fw = Math.abs(frac - 2 / 3) < 0.01 ? 'two-thirds' : Math.abs(frac - 1 / 3) < 0.01 ? 'a third' : Math.abs(frac - 0.5) < 0.01 ? 'half' : E.fmt.pct(frac, 0);
      const dayText = frac < 0.01 ? `${full} full day${full === 1 ? '' : 's'}` : full ? `${full} full day${full === 1 ? '' : 's'} and ${fw} of day ${full + 1}` : `${fw} of day 1`;
      run = `${when} the line runs ${E.fmt.count(mo.lineMin)} of ${E.fmt.count(R.available)} minutes (${E.fmt.pct(mo.util)}): ${dayText}.`;
    }
    items.push(`<li class="cs-foot">${run} The crew is sent home, unpaid, for the rest of the month. Real crews usually can’t be sent home like this. If they were salaried, their pay would be a <g t="fixed cost">fixed cost</g> and <g t="break-even">break-even</g> would rise.</li>`);
    items.push(`<li class="cs-foot">QC &amp; pack: this person inspects cars at the line exit and packs them later at the packing station. The model charges one cycle of their pay (${E.fmt.money2(k.qcPack)}: ${E.fmt.min(k.cycle)} min × ${E.fmt.rate(R.labourPerMin)}) to each car as it leaves the line.</li>`);
    box.append(h('h3', { class: 'cs-h3' }, 'Rules of this factory'), html('ul', null, items.join('')));
    el.append(box); return box;
  }
  // the Notebook's rules are worked on the course defaults; say so when the Factory floor runs other rules
  const RULE_KEYS = ['wageHourly', 'onCostRate', 'crewStations', 'crewQcPack', 'powerPerLineMin', 'moveMin', 'blankMin', 'birchFactor', 'consumables', 'scrapEvery', 'carton', 'freight', 'fixed', 'price', 'demandIntercept', 'demandSlope', 'shiftMin', 'daysPerMonth', 'shopTerms', 'supplierCredit', 'openingCash'];
  const rulesDiffer = R => { if (!R) return false; const D = E.rules(); return RULE_KEYS.some(k => JSON.stringify(R[k] ?? null) !== JSON.stringify(D[k] ?? null)); };
  function renderSide() {
    const s = app.state;
    const parts = [];
    if (s.mode === 'course' || s.mode === 'factory') {
      const nbIds = allLessons().filter(l => P.notebook.includes(l.id) && l.rule).map(l => l.id);
      const nb = h('section', { class: 'cs-sec cs-nbsec' });
      const defaults = s.mode === 'factory' && nbIds.length && rulesDiffer(s.R);
      nb.append(h('h3', { class: 'cs-lab' }, h('span', null, 'Notebook'), h('b', null, nbIds.length ? `${nbIds.length} rule${nbIds.length > 1 ? 's' : ''}${defaults ? ' (course defaults)' : ''}` : '')));
      if (defaults) nb.append(h('p', { class: 'cs-goal' }, 'These figures use the course defaults, not the rules you set here. The Ledger shows yours.'));
      if (!nbIds.length) nb.append(h('p', { class: 'cs-goal' }, 'Every lesson ends with one rule. The rules you earn collect here.'));
      else {
        const ul = h('ul', { class: 'cs-nb' });
        for (const id of nbIds) { const l = byId(id); ul.append(h('li', null, h('span', { class: 'cs-nid' }, id), html('span', null, val(l.rule, makeCtx(l, {}))))); }
        nb.append(ul);
      }
      parts.push(nb);
    }
    // L7 draws the Rules card inside the lesson itself, so the side copy waits until another lesson is open
    if (s.mode === 'factory' || (s.mode === 'course' && s.layers?.ledger && s.lesson !== 'L7')) {
      const sec = h('section', { class: 'cs-sec' }); renderRulesCard(sec); parts.push(sec);
    }
    sideEl.replaceChildren(...parts);
  }

  /* ------------------------------------------------ warm-ups (SPEC §3.1, §3.4) */
  const lessonOfWarm = w => w.lesson || w.from || w.after || w.unitLesson || (/^W(\d+)$/.exec(w.id || '') ? 'L' + /^W(\d+)$/.exec(w.id)[1] : null);
  function findItem(key) {
    const w = WARM.find(x => x.id === key);
    if (w) { const src = byId(lessonOfWarm(w)); return { key, check: w, src, srcId: lessonOfWarm(w) }; }
    const [lid, cid] = String(key).split('.'); const l = byId(lid); if (!l) return null;
    const check = cid === 'twin' ? l.twin : arr(l.checks).find(c => c.id === cid);
    return check ? { key, check, src: l, srcId: lid } : null;
  }
  // Missed items first. Then the pool, W-items before twins and new items before ones already answered right. An item
  // answered right in the last two lessons (as a warm-up, or as the lesson's own twin on the first try) is never re-asked.
  function pickWarmups(lesson) {
    const n = lessonNum(lesson.id);
    if (n < 1 || lesson.scored === false) return [];
    const eligible = it => it && lessonNum(it.srcId) >= 0 && lessonNum(it.srcId) < n;
    const recent = key => { const w = P.warm[key]; if (!w?.rightIn) return false; const d = n - lessonNum(w.rightIn); return d >= 0 && d <= 2; };
    const out = [];
    for (const k of P.review) { const it = findItem(k); if (eligible(it) && !recent(k) && !out.some(o => o.key === k)) out.push(it); if (out.length >= 2) return out; }
    const pool = [];
    for (const l of allLessons()) if (l.twin && lessonNum(l.id) >= 0 && lessonNum(l.id) < n - 1) pool.push({ key: l.id + '.twin', check: l.twin, src: l, srcId: l.id, w: false });
    for (const w of WARM) { const it = { key: w.id, check: w, src: byId(lessonOfWarm(w)), srcId: lessonOfWarm(w), w: true }; if (eligible(it)) pool.push(it); }
    const r = rng(lesson.id + ':' + P.seed);
    const rest = pool.filter(p => !recent(p.key) && !out.some(o => o.key === p.key))
      .map(p => ({ p, s: r() + (p.w ? 0 : 1) + (P.warm[p.key]?.right ? 2 : 0) })).sort((a, b) => a.s - b.s).map(x => x.p);
    return [...out, ...rest].slice(0, 2);
  }
  const noteRight = (key, lessonId) => { const w = (P.warm[key] ||= { attempts: 0 }); w.right = true; w.rightIn = lessonId; };

  /* ------------------------------------------------ the lesson card */
  // a lesson that still has checks (or a twin) to answer: the Ledger hides the answers it would print (app.state.hideAnswers)
  const hasQuestions = L => !!L.capstone || arr(L.checks).some(c => !c.bonus) || !!L.twin;
  function answersOpen(c) {
    if (!c || !hasQuestions(c.lesson)) return false;
    if (c.lesson.capstone) return !c.done; // unaided until the sheet is finished
    const checksDone = arr(c.lesson.checks).every((chk, i) => chk.bonus || c.checkRes[chk.id || i]);
    return !(checksDone && (!c.lesson.twin || !!c.twinRes));
  }
  const syncHide = () => {
    const v = app.state.mode === 'course' && answersOpen(cur), u = v && !!cur?.lesson?.capstone;
    if (!!app.state.hideAnswers !== v || !!app.state.unaided !== u) app.set({ hideAnswers: v, unaided: u });
  };

  function openLesson(id, opts = {}) {
    const lesson = byId(id);
    if (!lesson) { if (bStatus === 'loading') pendingOpen = id; return; }
    if (app.state.mode !== 'course') { app.set({ mode: 'course', tab: 'lesson', scenario: null, moneyOn: true }); app.emit('mode', { mode: 'course' }); }
    closeLesson();
    const mem = {};
    const ctx = makeCtx(lesson, mem);
    cur = { lesson, ctx, mem, unsubs: [], cleanups: [], checks: [], els: {}, steps: new Set(lp(lesson.id).steps || []), checkRes: {}, twinRes: null, ebDone: false, predDone: !lesson.hook?.predict, skip: false, shown: {}, done: false };
    const R = E.rules();
    // a clean factory for every lesson: overview camera (no car still inspected from the last one), no replay balance
    try { engine?.setCamera?.('overview'); } catch { }
    app.set({ lesson: lesson.id, layers: layersUpTo(lesson.layers || lesson.id), tab: 'lesson', scenario: null, R, up: { ...E.NO_UPGRADES }, price: R.price, moneyOn: true, bank: null, hideAnswers: hasQuestions(lesson), unaided: !!lesson.capstone });
    try { buildCard(); }
    catch (e) {
      console.warn('[course] lesson ' + lesson.id + ' could not be built', e);
      lessonHost.replaceChildren(h('section', { class: 'cs-sec' }, h('h2', { class: 'cs-h2' }, lesson.title || lesson.id), h('p', { class: 'cs-p cs-muted' }, 'This lesson could not load. Pick another one from the course map.')));
      cur.els.card = lessonHost.firstChild;
    }
    renderMap(); renderSide();
    // events that tick steps
    let names = new Set();
    try { names = new Set(arr(lesson.steps).flatMap(s => arr(s?.on))); } catch (e) { console.warn('[course] steps of ' + lesson.id, e); }
    for (const name of names) {
      const fn = payload => onEvent(name, payload);
      try { const u = engine?.on?.(name, fn); if (u) cur.unsubs.push(u); } catch { }
      if (!ENGINE_EVENTS.has(name)) cur.unsubs.push(app.on(name, fn));
    }
    const c = cur;
    Promise.resolve().then(() => lesson.setup?.(ctx)).catch(e => { console.warn('[course] setup failed for ' + lesson.id, e); if (cur === c) c.els.card.prepend(h('p', { class: 'cs-sec cs-muted' }, 'The factory could not be set up for this lesson. You can still read and answer it.')); });
    requestAnimationFrame(() => {
      if (cur !== c) return;
      if (!isPhone()) c.els.card?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
      // opened from the map, Start/Continue, Next or the coach: the control that opened it is gone, so focus the title
      if (opts.focus) { const t = c.els.card?.querySelector('#cs-title'); try { t?.focus({ preventScroll: !isPhone() }); } catch { } }
    });
    say(`Lesson ${lesson.id}: ${lesson.title}`);
  }
  let pendingOpen = null;

  function closeLesson() {
    if (!cur) return;
    const c = cur; cur = null; lastId = c.lesson.id;
    c.unsubs.forEach(u => { try { u?.(); } catch { } });
    c.cleanups.forEach(f => { try { f?.(); } catch { } });
    c.checks.forEach(k => { try { k.destroy(); } catch { } });
    try { c.lesson.teardown?.(c.ctx); } catch (e) { console.warn(e); }
    io?.disconnect(); io = null; cardInView = false;
    lessonHost.replaceChildren();
    closePop();
    if (app.state.hideAnswers || app.state.unaided) app.set({ hideAnswers: false, unaided: false });
    updateCoach();
  }

  // section labels are headings (h3 under the lesson's h2), so screen readers can move part to part
  function sec(label, extra) { const s = h('section', { class: 'cs-sec' }); if (label) s.append(h('h3', { class: 'cs-lab' }, h('span', null, label), extra ? h('b', null, extra) : null)); return s; }

  function buildCard() {
    const L = cur.lesson, ctx = cur.ctx, c = cur;
    const card = h('article', { class: 'cs-card', 'aria-labelledby': 'cs-title' });
    c.els.card = card;
    // head
    const head = h('section', { class: 'cs-sec cs-head' },
      h('div', { class: 'cs-lab' }, h('span', null, `Unit ${L.unit || 'A'} · ${L.short || L.id}`), h('b', null, L.minutes ? `${L.minutes} min` : '')),
      h('h2', { class: 'cs-h2', id: 'cs-title', tabindex: '-1' }, L.title),
      L.goal ? html('p', { class: 'cs-goal' }, val(L.goal, ctx)) : null);
    card.append(head);
    // warm-up
    const warm = pickWarmups(L);
    if (warm.length) {
      const s = sec('Warm-up', `${warm.length} from earlier`);
      const box = h('div', { class: 'cs-warm' }); s.append(box);
      for (const it of warm) {
        const wctx = makeCtx(it.src || L, {});
        const k = mountCheck(box, it.check, wctx, {
          key: 'warm:' + it.key, review: true,
          onAnswer: ({ correct }) => { const w = (P.warm[it.key] ||= { attempts: 0 }); w.attempts++; if (correct) w.right = true; if (!correct) (P.misses[it.key] ||= []).push('warm'); save(); },
          onShown: () => { if (!P.review.includes(it.key)) P.review.push(it.key); save(); },
          onResolve: ({ result }) => { if (result === 'right') { P.review = P.review.filter(k2 => k2 !== it.key); noteRight(it.key, L.id); save(); } updateCoach(); }
        });
        c.checks.push(k);
      }
      card.append(s);
    }
    // explanation
    if (L.explain) { const s = sec('The idea'); s.append(html('div', { class: 'cs-p' }, val(L.explain, ctx))); card.append(s); }
    // hook + prediction
    if (L.hook) {
      const s = sec(L.hook.predict ? 'Predict first' : 'Look');
      const t = val(L.hook.text, ctx); if (t) s.append(html('p', { class: 'cs-p' }, t));
      if (L.hook.predict) {
        const pr = L.hook.predict;
        const saved = P.lessons[L.id]?.prediction;
        if (saved !== undefined && pr.save === 'prediction') { s.append(html('div', { class: 'cs-fb cs-fb-info' }, `<div class="cs-fbt">Your guess</div><p>${String(saved).replace(/[<&]/g, '')}. ${val(pr.after, ctx) || ''}</p>`)); c.predDone = true; }
        else {
          const k = mountCheck(s, { ...pr, scored: false }, ctx, {
            key: 'predict',
            onAnswer: ({ value, text }) => { const lpp = lp(L.id); const v = text ?? value; (lpp.predictions ||= {})[pr.id || 'predict'] = v; if (pr.save === 'prediction' || !('prediction' in lpp)) lpp.prediction = v; save(); },
            onResolve: () => { c.predDone = true; advance(); }
          });
          c.checks.push(k); c.els.predict = k;
        }
      }
      card.append(s);
    }
    // worked example
    const rows = arr(val(L.worked, ctx));
    if (rows.length) {
      const s = sec('Worked example', 'tap a figure');
      const box = h('div', { class: 'cs-worked' });
      for (const r of rows) {
        const how = html('span', { class: 'cs-wh', hidden: true }, val(r.how, ctx) || '');
        const v = typeof r.value === 'number' ? E.fmt.money2(r.value) : String(val(r.value, ctx) ?? '');
        // the whole row toggles on a tap; the figure itself is the keyboard control (no button nested in a button)
        const vb = h('button', { type: 'button', class: 'cs-wv', 'aria-expanded': 'false' }, v);
        const row = h('div', { class: 'cs-wrow' }, html('span', null, val(r.label, ctx)), vb, how);
        const toggle = () => { how.hidden = !how.hidden; vb.setAttribute('aria-expanded', String(!how.hidden)); };
        vb.addEventListener('click', e => { e.stopPropagation(); toggle(); });
        row.addEventListener('click', e => { if (!e.target.closest('.cs-g')) toggle(); });
        box.append(row);
      }
      s.append(box); card.append(s);
      // predict first: the worked example (and the Do steps below) wait until the prediction is in
      c.els.worked = s; s.hidden = !c.predDone;
    }
    // steps
    const steps = arr(L.steps);
    if (steps.length) {
      const s = sec('Do this', '');
      c.els.stepsLab = s.querySelector('b');
      const ol = h('ol', { class: 'cs-steps' });
      c.els.steps = {};
      steps.forEach((stp, i) => {
        const mark = h('span', { class: 'cs-mark', 'aria-hidden': 'true' }, String(i + 1));
        const txt = h('div', { class: 'cs-stext' });
        const nudge = h('div', { class: 'cs-nudge', hidden: true, role: 'note' });
        const w = h('div', { class: 'cs-widget' });
        const li = h('li', { class: 'cs-step', 'data-step': stp.id }, mark, h('div', { class: 'cs-sbody' }, txt, nudge, w));
        ol.append(li);
        c.els.steps[stp.id] = { li, mark, txt, nudge, w, html: null };
        if (stp.check) {
          const k = mountCheck(w, stp.check, ctx, {
            key: 'step:' + stp.id,
            onAnswer: info => recordAnswer(L, stp.check.id || stp.id, info),
            onShown: () => queueReview(L, stp.check.id || stp.id),
            onResolve: () => completeStep(stp.id)
          });
          c.checks.push(k); c.els.steps[stp.id].check = k;
        }
        if (typeof stp.widget === 'function') {
          try { const cl = stp.widget(w, ctx); if (typeof cl === 'function') c.cleanups.push(cl); }
          catch (e) { console.warn('[course] step widget failed', L.id, stp.id, e); }
        }
      });
      s.append(ol);
      const hint = val(L.hint, ctx);
      const tools = h('div', { class: 'cs-row' });
      if (hint) { const hb = html('div', { class: 'cs-hintbox', hidden: true }, hint); const b = h('button', { type: 'button', class: 'cs-btn cs-ghost cs-small', 'aria-expanded': 'false', onclick: () => { hb.hidden = !hb.hidden; b.setAttribute('aria-expanded', String(!hb.hidden)); } }, 'Stuck? Hint'); tools.append(b); s.append(tools, hb); }
      if (arr(L.checks).length) { c.els.skip = h('button', { type: 'button', class: 'cs-btn cs-ghost cs-small', onclick: () => { c.skip = true; advance(); c.els.checks?.querySelector('.cs-check')?.scrollIntoView?.({ block: 'nearest' }); c.checkCtl?.find(k => !k.resolved)?.focus(); } }, 'Skip to the questions'); tools.append(c.els.skip); if (!hint) s.append(tools); }
      card.append(s);
      c.els.do = s; s.hidden = !c.predDone;
    }
    // the gated sections
    c.els.checks = sec(arr(L.checks).length > 1 ? 'Check' : 'Check'); c.els.checks.hidden = true;
    c.els.twin = sec('One more, new numbers'); c.els.twin.hidden = true;
    c.els.take = sec('Takeaways'); c.els.take.hidden = true;
    c.els.eb = sec('Explain it back'); c.els.eb.hidden = true;
    c.els.rule = h('section', { class: 'cs-sec', hidden: true });
    c.els.next = h('section', { class: 'cs-sec', hidden: true });
    card.append(c.els.checks, c.els.twin, c.els.take, c.els.eb, c.els.rule, c.els.next);
    lessonHost.replaceChildren(card);
    updateSteps();
    advance();
    // coach bar visibility: hide while the card is in view
    io?.disconnect();
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(es => { for (const e of es) cardInView = e.isIntersecting && e.intersectionRect.height >= Math.min(140, e.boundingClientRect.height * 0.5); updateCoach(); }, { threshold: [0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1] });
      io.observe(card);
    }
    updateCoach();
  }

  function recordAnswer(L, cid, { correct, missId, noted, value }) {
    if (noted) return;
    const LP = lp(L.id);
    LP.attempts[cid] = (LP.attempts[cid] || 0) + 1;
    if (!(cid in LP.firstTry)) LP.firstTry[cid] = !!correct;
    if (!correct && missId) (P.misses[`${L.id}.${cid}`] ||= []).push(missId);
    if (correct) (LP.solved ||= {})[cid] = 'right';
    save();
  }
  function queueReview(L, cid) {
    const key = L.twin ? `${L.id}.twin` : `${L.id}.${cid}`;
    if (!P.review.includes(key)) P.review.push(key);
    (lp(L.id).solved ||= {})[cid] = 'shown';
    save();
  }

  function onEvent(name, payload) {
    const c = cur; if (!c) return;
    const evt = { ...(payload || {}), type: name };
    for (const s of arr(c.lesson.steps)) {
      if (c.steps.has(s.id) || !arr(s.on).includes(name) || typeof s.done !== 'function') continue;
      let ok = false;
      try { ok = !!s.done(c.ctx, evt); } catch (e) { console.warn('[course] step done() failed', s.id, e); }
      if (cur !== c) return;
      if (ok) completeStep(s.id);
      else if (typeof s.nudge === 'function') {
        // a nudge is html, or { html, toast?, keep? }: `toast` is a short line for the stage toast when the learner is
        // on another tab (the Order tab, where a lever task sends them); `keep` leaves it showing after the step is done
        let m = null; try { m = s.nudge(c.ctx, evt); } catch { }
        const mh = m && typeof m === 'object' ? m.html : m;
        if (mh) {
          const e = c.els.steps?.[s.id];
          if (e?.nudge) { setHtml(e.nudge, mh); e.nudge.hidden = false; e.kept = m.keep ? mh : (e.kept || null); }
          say(plain(mh));
          if (app.state.tab !== 'lesson') { const p = plain(mh), t = (typeof m === 'object' && m.toast) || (p.length > 44 ? p.slice(0, 42) + '…' : p); toast(t); }
        }
      }
    }
    if (name !== 'frame') updateSteps();
  }

  function completeStep(id) {
    const c = cur; if (!c || c.steps.has(id) || !arr(c.lesson.steps).some(s => s.id === id)) return;
    c.steps.add(id);
    const LP = lp(c.lesson.id); LP.steps = [...new Set([...(LP.steps || []), id])]; save();
    // a nudge that explains a trap the learner fell into stays, as a note under the done step; others go
    const e = c.els.steps?.[id];
    if (e?.nudge) { if (e.kept) { setHtml(e.nudge, e.kept); e.nudge.hidden = false; } else e.nudge.hidden = true; }
    updateSteps();
    const steps = arr(c.lesson.steps), i = steps.findIndex(s => s.id === id), stp = steps[i];
    const t = plain(val(stp?.text, c.ctx)).slice(0, 80);
    say('Step done. ' + t);
    // the stage toast is one short line (it must fit a phone); the full step text went to the live region above
    if (app.state.tab !== 'lesson') toast(steps.length > 1 ? `Step ${i + 1} of ${steps.length} done` : 'Step done');
    advance();
  }

  function updateSteps() {
    const c = cur; if (!c?.els.steps) return;
    const steps = arr(c.lesson.steps);
    const firstOpen = steps.find(s => !c.steps.has(s.id));
    steps.forEach((s, i) => {
      const e = c.els.steps[s.id]; if (!e) return;
      const done = c.steps.has(s.id);
      const t = val(s.text, c.ctx) || '';
      if (t !== e.html) { setHtml(e.txt, t); e.html = t; }
      e.li.classList.toggle('done', done); e.li.classList.toggle('current', s === firstOpen);
      if (done && !e.ticked) { e.mark.replaceChildren(TICK()); e.ticked = true; e.txt.before(h('span', { class: 'cs-sr' }, 'Done: ')); }
    });
    if (c.els.stepsLab) c.els.stepsLab.textContent = `${steps.filter(s => c.steps.has(s.id)).length} of ${steps.length} done`;
    updateCoach();
  }

  // un-hide the next part of the lesson when the one before is done
  function advance() {
    const c = cur; if (!c) return;
    const L = c.lesson, ctx = c.ctx;
    const steps = arr(L.steps), checks = arr(L.checks);
    // predict first: nothing after the prediction shows until it is in (the worked example would give it away)
    if (c.predDone) { if (c.els.worked) c.els.worked.hidden = false; if (c.els.do) c.els.do.hidden = false; }
    const stepsDone = steps.every(s => c.steps.has(s.id));
    const showChecks = (stepsDone || c.skip) && c.predDone;
    if (c.els.skip) c.els.skip.hidden = showChecks;
    if (showChecks && checks.length && !c.shown.checks) {
      c.shown.checks = true; c.els.checks.hidden = false;
      // lesson.beforeChecks(ctx): put the factory back for the questions (e.g. L3's default car); a returned line is shown
      if (typeof L.beforeChecks === 'function') {
        let note = null; try { note = L.beforeChecks(ctx); } catch (e) { console.warn('[course] beforeChecks', L.id, e); }
        if (note && typeof note === 'string') { c.els.checks.append(html('p', { class: 'cs-note' }, note)); say(plain(note)); }
      }
      c.checkCtl = checks.map((chk, i) => {
        const k = mountCheck(c.els.checks, chk, ctx, {
          key: chk.id || 'c' + (i + 1), label: checks.length > 1 ? `Question ${i + 1} of ${checks.length}` : null, review: true,
          onAnswer: info => recordAnswer(L, chk.id || 'c' + (i + 1), info),
          onShown: () => queueReview(L, chk.id || 'c' + (i + 1)),
          onResolve: ({ result }) => { c.checkRes[chk.id || i] = result; advance(); updateCoach(); }
        });
        c.checks.push(k); return k;
      });
    }
    const checksDone = showChecks && checks.every((chk, i) => chk.bonus || c.checkRes[chk.id || i]); // a bonus question never holds the lesson up
    if (checksDone && L.twin && !c.shown.twin) {
      c.shown.twin = true; c.els.twin.hidden = false;
      const k = mountCheck(c.els.twin, L.twin, ctx, {
        key: 'twin', review: true,
        onAnswer: info => recordAnswer(L, 'twin', info),
        onShown: () => queueReview(L, 'twin'),
        onResolve: ({ result, attempts }) => {
          c.twinRes = result;
          if (result === 'right') {
            lp(L.id).mastered = true;
            // right on the first try: the twin is known now, so it does not come back in the next warm-ups
            if (!attempts) { P.review = P.review.filter(k2 => k2 !== `${L.id}.twin`); noteRight(`${L.id}.twin`, L.id); }
            save();
          }
          advance(); updateCoach();
        }
      });
      c.checks.push(k); c.twinCtl = k;
    }
    const twinDone = checksDone && (!L.twin || !!c.twinRes);
    if (twinDone && L.takeaways && !c.shown.take) {
      c.shown.take = true; c.els.take.hidden = false;
      const ul = h('ul', { class: 'cs-take' }); for (const t of arr(val(L.takeaways, ctx))) ul.append(html('li', null, t));
      c.els.take.append(ul);
    }
    if (twinDone && L.explainBack && !c.shown.eb) { c.shown.eb = true; c.els.eb.hidden = false; buildExplainBack(); }
    const ebDone = !L.explainBack || c.ebDone;
    const allDone = twinDone && ebDone && c.predDone && (showChecks && (stepsDone || checks.length > 0));
    if (allDone && L.rule && !c.shown.rule) {
      c.shown.rule = true; c.els.rule.hidden = false;
      c.els.rule.append(h('div', { class: 'cs-rule' }, h('div', { class: 'cs-lab' }, h('span', null, 'Rule'), h('b', null, 'added to your Notebook')), html('p', null, val(L.rule, ctx))));
    }
    if (allDone && !c.done) markDone();
    syncHide();
    updateCoach();
  }

  function buildExplainBack() {
    const c = cur, L = c.lesson, ctx = c.ctx, eb = L.explainBack, s = c.els.eb;
    const prompt = val(eb.prompt, ctx), ideas = arr(val(eb.ideas, ctx));
    const taId = 'cs-eb-' + L.id;
    s.append(html('label', { class: 'cs-prompt', for: taId }, prompt));
    const needId = 'cs-ebneed-' + L.id;
    const ta = h('textarea', { class: 'cs-ta', id: taId, rows: '2', maxlength: '200', placeholder: 'One sentence, in your own words' });
    const out = h('div', { style: 'display:grid;gap:8px' });
    const gradeBtn = h('button', { type: 'button', class: 'cs-btn cs-small', hidden: !tutor?.available?.() }, 'Check my sentence');
    // the model answer is a comparison, so the learner writes their own sentence first. The escape is there from the
    // start (it waited 30 s until Nov 2026): someone only looking around must never be held at a text box
    const MIN_CHARS = 10;
    const modelBtn = h('button', { type: 'button', class: 'cs-btn cs-small cs-primary', disabled: true, 'aria-describedby': needId }, 'Show the model answer');
    const need = h('p', { class: 'cs-muted', id: needId, style: 'margin:0;font-size:12.5px' }, 'Write your sentence first, then compare it with the model answer.');
    const stuck = h('button', { type: 'button', class: 'cs-btn cs-ghost cs-small' }, 'Skip, show me the answer');
    const written = () => ta.value.trim().length >= MIN_CHARS;
    ta.addEventListener('input', () => { modelBtn.disabled = !written(); need.hidden = written(); });
    const refresh = () => { gradeBtn.hidden = !tutor?.available?.() || c.ebDone; };
    tutorRefreshers.add(refresh); c.cleanups.push(() => tutorRefreshers.delete(refresh));
    const showModel = (present) => {
      if (c.ebShown) return; c.ebShown = true;
      const list = h('ul', { class: 'cs-ideas' });
      for (const it of ideas) {
        if (present) list.append(h('li', { class: 'cs-ii' }, present.includes(it.id) ? TICK() : h('span', { class: 'cs-dot', 'aria-hidden': 'true' }), h('span', null, `${it.text}${present.includes(it.id) ? '' : ' (missing)'}`)));
        else { const cb = h('input', { type: 'checkbox' }); list.append(h('li', null, h('label', null, cb, h('span', null, it.text)))); }
      }
      const model = html('p', { class: 'cs-model', tabindex: '-1' }, val(eb.model, ctx));
      out.append(h('div', { class: 'cs-lab' }, 'Model answer'), model, h('div', { class: 'cs-lab' }, present ? 'What the accountant found' : 'Does yours say…'), list);
      modelBtn.hidden = true; gradeBtn.hidden = true; need.hidden = true; stuck.hidden = true;
      c.ebDone = true; say('Model answer: ' + plain(model.innerHTML)); advance();
      try { model.focus({ preventScroll: true }); } catch { }
    };
    modelBtn.addEventListener('click', () => { if (written()) showModel(null); else { ta.focus(); say(need.textContent); } });
    stuck.addEventListener('click', () => showModel(null));
    gradeBtn.addEventListener('click', async () => {
      const sentence = ta.value.trim();
      if (!written()) { ta.focus(); say(need.textContent); return; }
      gradeBtn.disabled = true; gradeBtn.textContent = 'Checking…';
      let r = null;
      try { r = await tutor.grade({ prompt: plain(prompt), ideas, sentence }); } catch (e) { console.warn(e); }
      if (cur !== c) return;
      gradeBtn.disabled = false; gradeBtn.textContent = 'Check my sentence';
      if (r && Array.isArray(r.present)) { if (r.note) out.append(html('p', { class: 'cs-fb cs-fb-info' }, r.note)); showModel(r.present); }
      else showModel(null);
    });
    s.append(ta, need, h('div', { class: 'cs-row' }, gradeBtn, modelBtn, stuck), out);
  }

  function markDone() {
    const c = cur; c.done = true;
    const L = c.lesson, LP = lp(L.id);
    LP.done = true;
    if (L.rule && !P.notebook.includes(L.id)) P.notebook.push(L.id);
    save(); renderMap(); renderSide();
    const nx = nextOf(L.id);
    const s = c.els.next; s.hidden = false; s.replaceChildren();
    const all = allLessons(), undone = all.filter(l => !P.lessons[l.id]?.done);
    s.append(h('div', { class: 'cs-lab' }, h('span', null, 'Lesson done'), h('b', null, `${doneCount()} of ${all.length}`)));
    const chalBtn = (primary) => h('button', { type: 'button', class: 'cs-btn' + (primary ? ' cs-primary' : ''), onclick: () => switchMode('challenges') }, 'Try the Challenges');
    if (nx) s.append(h('div', { class: 'cs-row' }, h('button', { type: 'button', class: 'cs-btn cs-primary', onclick: () => openLesson(nx.id, { focus: true }) }, `Next · ${nx.short || nx.id} ${nx.title}`)));
    else if ((L.unit || 'A') === 'A' && bStatus !== 'ok') s.append(html('p', { class: 'cs-p' }, bStatus === 'loading' ? 'That’s the end of Unit A. Unit B is still loading: open it from the course map in a moment.' : 'That’s the end of Unit A. Unit B could not load in this view.'));
    else if (!undone.length) {
      // only when every lesson, the last one included, is done
      s.append(html('p', { class: 'cs-p' }, 'Course complete: you can price any car now. Try the Challenges, or build your own car on the Factory floor and run its month.'));
      s.append(h('div', { class: 'cs-row' }, chalBtn(true), h('button', { type: 'button', class: 'cs-btn', onclick: () => switchMode('factory') }, 'Open the Factory floor')));
    } else {
      const first = undone[0];
      s.append(html('p', { class: 'cs-p' }, `That’s the end of Unit ${L.unit || 'B'}. ${undone.length === 1 ? 'One lesson is' : `${undone.length} lessons are`} still open; the course is complete when every lesson is done. The Challenges are open too.`));
      s.append(h('div', { class: 'cs-row' }, h('button', { type: 'button', class: 'cs-btn cs-primary', onclick: () => openLesson(first.id, { focus: true }) }, `Open · ${first.short || first.id} ${first.title}`), chalBtn(false)));
    }
    say(`Lesson ${L.id} done.`);
  }
  // the header's mode switch does the full change (main.js setMode resets upgrades, bank and the Factory floor's state)
  function switchMode(mode) {
    const b = document.querySelector(`#appModes [data-app="${mode}"]`);
    if (b) { b.click(); return; }
    const patch = { mode, lesson: null, moneyOn: true, hideAnswers: false, unaided: false, bank: null };
    if (mode === 'challenges') Object.assign(patch, { tab: 'lesson', layers: layersUpTo('all') });
    if (mode === 'factory') Object.assign(patch, { tab: 'order', layers: layersUpTo('all'), scenario: null });
    if (mode === 'course') Object.assign(patch, { tab: 'lesson', scenario: null, layers: layersUpTo('L0') });
    app.set(patch); app.emit('mode', { mode });
  }

  /* ------------------------------------------------ coach bar (phone) */
  // The button says what it does for the current item: Answer (a prediction, question or explain-back), Go to step,
  // Next lesson. A step the learner does in the factory (a strip or 3D tap, an event with nothing to press in the card)
  // scrolls the stage into view instead of the card.
  let coachText = null, coachBtn = null;
  const reach = (el, block = 'center') => el?.scrollIntoView?.({ block, behavior: reduced() ? 'auto' : 'smooth' });
  if (coach) {
    coachText = h('div', { class: 'cs-coach-t' });
    coachBtn = h('button', { type: 'button', class: 'cs-btn cs-primary' }, 'Go to step');
    coach.replaceChildren(h('div', { class: 'cs-coach' }, coachText, coachBtn));
    coachBtn.addEventListener('click', () => {
      const it0 = currentItem(); if (!it0) return;
      if (it0.kind === 'done' && it0.next) { openLesson(it0.next.id, { focus: true }); return; }
      if (it0.stage) {
        const st = engine?.stageEl || document.getElementById('stage');
        reach(st, 'start');
        setTimeout(() => { const b = document.querySelector('#strip button, #hstrip button'); try { b?.focus({ preventScroll: true }); } catch { } }, reduced() ? 0 : 350);
        return;
      }
      if (app.state.tab !== 'lesson') app.set({ tab: 'lesson' });
      requestAnimationFrame(() => { const it = currentItem(); reach(it?.el); setTimeout(() => it?.focus?.(), reduced() ? 0 : 350); });
    });
  }
  // a step done out in the factory: it listens for engine events and has nothing to press in the card
  const FACTORY_ACTS = new Set(['stationTap', 'carTap']);
  const stageStep = (stp, e) => { const on = arr(stp.on); if (on.some(n => FACTORY_ACTS.has(n))) return true; return on.some(n => ENGINE_EVENTS.has(n)) && !stp.check && !e?.w?.querySelector('button:not(:disabled), input:not([readonly])'); };
  function currentItem() {
    const c = cur; if (!c || !c.els.card) return null;
    const steps = arr(c.lesson.steps);
    const open = steps.find(s => !c.steps.has(s.id));
    if (c.els.predict && !c.predDone) return { kind: 'answer', lab: 'Predict', text: plain(val(c.lesson.hook.predict.prompt, c.ctx)), el: c.els.predict.el, focus: () => c.els.predict.focus() };
    if (open && !c.skip) { const i = steps.indexOf(open); const e = c.els.steps[open.id]; return { kind: 'step', stage: stageStep(open, e), lab: `Step ${i + 1} of ${steps.length}`, text: plain(val(open.text, c.ctx)), el: e.li, focus: () => (e.w.querySelector('input:not([readonly]), button:not(:disabled)') || null)?.focus({ preventScroll: true }) }; }
    const pend = (c.checkCtl || []).find(k => !k.resolved);
    if (pend) { const i = c.checkCtl.indexOf(pend); return { kind: 'answer', lab: `Question ${i + 1} of ${c.checkCtl.length}`, text: plain(pend.el.querySelector('.cs-prompt')?.innerHTML), el: pend.el, focus: () => pend.focus() }; }
    if (c.twinCtl && !c.twinCtl.resolved) return { kind: 'answer', lab: 'One more', text: plain(c.twinCtl.el.querySelector('.cs-prompt')?.innerHTML), el: c.twinCtl.el, focus: () => c.twinCtl.focus() };
    if (c.lesson.explainBack && !c.ebDone && c.shown.eb) return { kind: 'answer', lab: 'Explain it back', text: plain(val(c.lesson.explainBack.prompt, c.ctx)), el: c.els.eb, focus: () => c.els.eb.querySelector('textarea')?.focus({ preventScroll: true }) };
    if (c.done) { const nx = nextOf(c.lesson.id); return { kind: 'done', next: nx, lab: 'Lesson done', text: nx ? `Next: ${nx.short || nx.id} ${nx.title}` : c.lesson.title, el: c.els.next, focus: () => c.els.next.querySelector('button')?.focus({ preventScroll: true }) }; }
    return { kind: 'lesson', lab: c.lesson.id, text: c.lesson.title, el: c.els.card, focus: () => c.els.card.querySelector('h2')?.focus({ preventScroll: true }) };
  }
  const coachLabel = it => it.kind === 'answer' ? 'Answer' : it.kind === 'step' ? 'Go to step' : it.kind === 'done' ? (it.next ? 'Next lesson' : 'What’s next') : 'Go to lesson';
  function updateCoach() {
    if (!coach) return;
    const show = app.state.mode === 'course' && !!cur && !cardInView;
    coach.hidden = !show;
    if (!show) return;
    let it = null; try { it = currentItem(); } catch (e) { console.warn('[course] coach', e); }
    if (!it) { coach.hidden = true; return; }
    coachText.replaceChildren(h('span', { class: 'cs-lab' }, `${cur.lesson.id} · ${it.lab}`), document.createTextNode(it.text));
    const lab = coachLabel(it); if (coachBtn.textContent !== lab) coachBtn.textContent = lab;
  }

  /* ------------------------------------------------ challenges mode */
  function renderChallenges() {
    mapEl.replaceChildren(); lessonHost.replaceChildren(); sideEl.replaceChildren();
    const s = mapEl;
    s.append(h('div', { class: 'cs-lab' }, h('span', null, 'Challenges'), h('b', null, CHAL.length ? `${CHAL.filter(x => P.challenges[x.id]?.done).length} of ${CHAL.length} done` : '')),
      h('h2', { class: 'cs-h2' }, 'Run the business'),
      html('p', { class: 'cs-goal' }, 'Three open problems that use everything from the course. Open any of them at any time; nothing is scored.'));
    if (!CHAL.length) { s.append(h('p', { class: 'cs-p cs-muted' }, bStatus === 'loading' ? 'Loading the challenges…' : 'The challenges could not load in this view.')); return; }
    const list = h('div', { class: 'cs-chs' });
    for (const ch of CHAL) {
      const done = !!P.challenges[ch.id]?.done;
      const ctx = chCtx(ch);
      const sit = plain(val(ch.situation, ctx));
      list.append(h('div', { class: 'cs-ch' },
        h('div', { class: 'cs-lab' }, h('span', null, ch.id), done ? h('b', { style: 'display:flex;gap:4px;align-items:center' }, TICK(), 'done') : null),
        h('h3', { class: 'cs-h3' }, ch.title || ch.id),
        sit ? h('p', null, sit.length > 150 ? sit.slice(0, 147).replace(/\s+\S*$/, '') + '…' : sit) : null,
        h('div', { class: 'cs-row' }, h('button', { type: 'button', class: 'cs-btn' + (done ? '' : ' cs-primary'), onclick: () => openChallenge(ch.id) }, done ? 'Open again' : 'Open'))));
    }
    s.append(list);
  }
  function chCtx(ch, mem = {}) {
    const sc = ch.scenario || {};
    const R = E.rules(sc.R || {}), up = { ...E.NO_UPGRADES, ...(sc.up || {}) };
    return makeCtx({ id: ch.id, title: ch.title, hint: arr(ch.hints)[0] }, mem, { R, up, cfg: sc.cfg || E.DEFAULT_CAR, price: sc.price, scenario: sc });
  }
  function openChallenge(id) {
    const ch = CHAL.find(x => x.id === id); if (!ch) { if (bStatus === 'loading') pendingOpen = id; return; }
    if (app.state.mode !== 'challenges') { app.set({ mode: 'challenges', tab: 'lesson', lesson: null, moneyOn: true, layers: layersUpTo('all') }); app.emit('mode', { mode: 'challenges' }); }
    closeChallenge(false);
    const sc = ch.scenario || {};
    const ctx = chCtx(ch);
    try { engine?.setCamera?.('overview'); } catch { }
    app.set({ scenario: { id: ch.id, cfg: { ...ctx.cfg }, open: sc.open ?? ctx.R.openingCash, months: sc.months ?? 3, locked: true }, R: ctx.R, up: ctx.up, price: sc.price ?? ctx.R.price, tab: 'lesson', bank: null, hideAnswers: false });
    // the challenge's own car on the order form and on the line, so the 3D tags and receipts match the problem
    try { engine?.setCfg?.({ ...ctx.cfg }); engine?.fillLine?.({ ...ctx.cfg }, { count: 7 }); } catch { }
    chCur = { ch, ctx, cleanup: null };
    mapEl.replaceChildren(); sideEl.replaceChildren();
    const card = h('article', { class: 'cs-card', 'aria-labelledby': 'cs-ctitle' });
    card.append(h('section', { class: 'cs-sec cs-head' },
      h('div', { class: 'cs-row', style: 'justify-content:space-between' }, h('button', { type: 'button', class: 'cs-btn cs-small', onclick: () => { closeChallenge(true); renderChallenges(); } }, '← All challenges'), h('span', { class: 'cs-lab' }, ch.id)),
      h('h2', { class: 'cs-h2', id: 'cs-ctitle', tabindex: '-1' }, ch.title || ch.id)));
    const sit = sec('The situation'); sit.append(html('div', { class: 'cs-p' }, val(ch.situation, ctx))); card.append(sit);
    const work = sec('Your plan'); const host = h('div', { class: 'cs-widget' }); work.append(host); card.append(work);
    const result = h('section', { class: 'cs-sec', hidden: true }); card.append(result);
    const hints = arr(ch.hints);
    if (hints.length) {
      const hs = sec('Hints'); let shown = 0;
      const box = h('div', { style: 'display:grid;gap:6px' });
      const b = h('button', { type: 'button', class: 'cs-btn cs-small' }, `Show hint 1 of ${hints.length}`);
      b.addEventListener('click', () => { box.append(html('p', { class: 'cs-hintbox' }, val(hints[shown], ctx))); shown++; if (shown >= hints.length) b.hidden = true; else b.textContent = `Show hint ${shown + 1} of ${hints.length}`; });
      hs.append(box, h('div', { class: 'cs-row' }, b)); card.append(hs);
    }
    lessonHost.replaceChildren(card);
    const done = (r = {}) => {
      if (!chCur || chCur.ch !== ch) return;
      result.hidden = false; result.replaceChildren();
      result.append(h('div', { class: 'cs-lab' }, h('span', null, r.won ? 'Challenge met' : 'Not yet'), r.won ? h('b', null, 'saved') : null));
      if (r.summary) result.append(html('div', { class: 'cs-fb ' + (r.won ? 'cs-fb-right' : 'cs-fb-info') }, `<p>${r.summary}</p>`));
      if (r.won) {
        const d = val(ch.debrief, ctx); if (d) result.append(html('div', { class: 'cs-p' }, d));
        const pc = (P.challenges[ch.id] ||= {}); pc.done = true;
        if (r.best && (!pc.best || (r.best.profit ?? -Infinity) > (pc.best.profit ?? -Infinity))) pc.best = clone(r.best);
        save();
      }
      say(plain((r.won ? 'Challenge met. ' : '') + (r.summary || '')));
    };
    try { const cl = ch.render?.(host, ctx, done); if (typeof cl === 'function') chCur.cleanup = cl; }
    catch (e) { console.warn('[course] challenge render failed', ch.id, e); host.append(h('p', { class: 'cs-muted' }, 'This challenge could not load.')); }
  }
  function closeChallenge(resetRules) {
    if (!chCur) return;
    const c = chCur; chCur = null;
    try { c.cleanup?.(); } catch (e) { console.warn(e); }
    if (resetRules) { const R = E.rules(); app.set({ scenario: null, R, up: { ...E.NO_UPGRADES }, price: R.price, bank: null }); }
  }

  /* ------------------------------------------------ factory mode */
  function renderFactory() {
    mapEl.replaceChildren(h('div', { class: 'cs-lab' }, h('span', null, 'Factory floor')), h('h2', { class: 'cs-h2' }, 'Every money layer is on'),
      html('p', { class: 'cs-goal' }, 'Change the order, send cars and watch the receipts. The Ledger tab has the cost sheet, the month and the cash. Press <kbd>M</kbd> to hide the money layers.'),
      h('div', { class: 'cs-row' }, h('button', { type: 'button', class: 'cs-btn', onclick: () => switchMode('course') }, 'Back to the course')));
    lessonHost.replaceChildren();
    renderSide();
  }

  /* ------------------------------------------------ render by mode */
  function render() {
    const m = app.state.mode;
    if (m === 'challenges') { if (!chCur) renderChallenges(); }
    else if (m === 'factory') renderFactory();
    else { renderMap(); renderSide(); }
    updateCoach();
  }
  const offApp = app.on('change', ({ keys, state }) => {
    if (keys.includes('mode')) {
      if (state.mode !== 'course' && cur) closeLesson();
      if (state.mode !== 'challenges' && chCur) closeChallenge(state.mode !== 'factory');
      render();
    } else if (keys.includes('layers')) { if (state.mode === 'course') renderSide(); }
    // the Factory floor's Rules card and Notebook note follow the rules, plan price and order the learner sets there
    if (state.mode === 'factory' && !keys.includes('mode') && keys.some(k => k === 'R' || k === 'up' || k === 'price')) renderSide();
    if (keys.includes('mode') && state.mode !== 'course' && (state.hideAnswers || state.unaided)) app.set({ hideAnswers: false, unaided: false });
    if (keys.includes('tab') || keys.includes('mode')) updateCoach();
  });
  let sideT = 0;
  const offOpt = engine?.on?.('optionChanged', () => { if (app.state.mode !== 'factory') return; clearTimeout(sideT); sideT = setTimeout(() => { if (app.state.mode === 'factory') renderSide(); }, 120); });

  /* ------------------------------------------------ boot: render now, then merge saved progress and course-b */
  render();
  const loadB = Promise.resolve().then(loadBFn).then(m => {
    lessonsB = arr(m.LESSONS_B).filter(valid);
    WARM = arr(m.WARMUPS).filter(w => w && w.id);
    CHAL = arr(m.CHALLENGES).filter(c => c && c.id);
    bStatus = 'ok';
  }).catch(e => { bStatus = 'missing'; console.warn('[course] course-b.js did not load; Unit B and the challenges are hidden.', e?.message || e); });
  const loadP = Promise.resolve().then(() => platform?.store?.load?.()).then(p => mergeLoaded(p)).catch(e => console.warn('[course] progress load failed', e));
  loadB.then(() => {
    if (destroyed) return;
    if (app.state.mode === 'challenges' && !chCur) renderChallenges(); else if (!cur) render(); else { renderMap(); renderSide(); }
    if (pendingOpen) { const id = pendingOpen; pendingOpen = null; api.open(id); }
  });
  loadP.then(() => { if (destroyed) return; if (cur) { renderMap(); renderSide(); } else render(); });

  let destroyed = false;
  const api = {
    open(id) {
      if (/^C\d+$/.test(id)) return openChallenge(id);
      if (byId(id)) return openLesson(id);
      if (bStatus === 'loading') pendingOpen = id;
    },
    ready: Promise.all([loadB, loadP]).then(() => true),
    destroy() {
      destroyed = true;
      closeLesson(); closeChallenge(false);
      offApp?.(); tutorOff?.(); offOpt?.(); clearTimeout(sideT);
      document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey);
      removeEventListener('scroll', onScroll, true); removeEventListener('resize', onScroll);
      pop.remove(); root.remove(); if (coach) { coach.hidden = true; coach.replaceChildren(); }
      clearTimeout(saveTimer);
    },
    // for harness pages and scripted checks
    get state() { return { lesson: cur?.lesson.id || null, steps: cur ? [...cur.steps] : [], challenge: chCur?.ch.id || null, progress: P, bStatus }; }
  };
  return api;
}
