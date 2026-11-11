// Toyline Ledger: the Ledger tab (#paneLedger), the chart and table widgets that lessons and challenges reuse,
// "Run the month" (the #ribbon replay, the #statement card, the Bank tween), CSV building and the Factory floor rules
// editor. Interfaces: docs/CONTRACTS.md. Behaviour: docs/SPEC.md §4.5-4.7 and §4.11. Every figure a learner sees is
// computed by econ.js and formatted with its fmt helpers; nothing here types a number into copy by hand.
import * as E from './econ.js';
import { effectiveLayers } from './app.js';
import { GLOSSARY } from './glossary.js';

const { fmt, roundTo } = E;
const $2 = fmt.money2, $m = fmt.money;
const EPS = 1e-9;
const DAY_MS = 200;          // replay speed: 0.2 s per working day (SPEC §4.7)
const BANK_AMBER = 5000;     // the Bank chip turns amber under this (SPEC §4.4); cells use the same rule

/* ---------- small helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let UID = 0;
const uid = p => `lg-${p}-${++UID}`;
const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
const reduced = () => mq('(prefers-reduced-motion: reduce)');
const phone = () => mq('(max-width: 820px)');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = v => typeof v === 'number' && Number.isFinite(v);
const priceLabel = p => Math.abs(p - Math.round(p)) < EPS ? $2(p, 0) : $2(p);
const kMoney = v => { const a = Math.abs(v); if (a < 1000) return $2(v, 0); const k = roundTo(v / 1000, 1); return $2(k, Number.isInteger(k) ? 0 : 1) + 'k'; };
const plural = (n, one, many) => `${fmt.count(n)} ${Math.abs(n - 1) < EPS ? one : many}`;
const joinAnd = a => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1];
const valText = (v, unit) => unit === '%' ? (fin(v) ? fmt.pct(v / 100) : '–') : unit === 'cars' ? (fin(v) ? fmt.count(v) : 'never') : (fin(v) ? $2(v) : '–');
const dayName = at => at ? `day ${at.day} of month ${at.month}` : '';
const signCls = v => v < -EPS ? 'lg-neg' : v > EPS ? 'lg-pos' : '';
const noUpgrades = u => !u || (!u.lamp && !u.autofeed && (u.helper === null || u.helper === undefined));
const validCfg = c => { if (!c || typeof c !== 'object' || !E.CATALOG.body[c.body]) return false; try { E.carCost(c); return true; } catch { return false; } };
// a control the learner is typing in keeps its focus (the replay pause must not pull focus out of a field)
const typingIn = el => !!el && el !== document.body && !!el.closest?.('input:not([type=range]):not([type=checkbox]), textarea, select, [contenteditable]');

// Fill in the usual inputs: the order, the rules (derived values filled), upgrades, price, and an optional volume.
function norm(o = {}) {
  const R = o.R ? (o.R.labourPerMin !== undefined ? o.R : E.rules(o.R)) : E.R0;
  let cfg = o.cfg || E.DEFAULT_CAR;
  try { E.carCost(cfg, R, o.up || E.NO_UPGRADES); } catch { cfg = E.DEFAULT_CAR; }
  return { cfg, R, up: o.up || E.NO_UPGRADES, price: fin(o.price) ? o.price : R.price, sold: fin(o.sold) ? o.sold : undefined };
}
const carLabel = cfg => {
  const C = E.CATALOG, n = cfg.number !== undefined && cfg.number !== null && String(cfg.number).trim() !== '';
  const roof = E.roofOk(cfg.body, cfg.roof) ? cfg.roof : 'none';
  return [C.body[cfg.body]?.label, (C.livery[cfg.livery]?.label || '') + (n ? ` No. ${String(cfg.number).trim()}` : ''),
    (C.wheels[cfg.wheels]?.label || '') + ' wheels', cfg.bumper !== 'none' ? `${C.bumper[cfg.bumper]?.label} bumpers` : 'no bumpers',
    roof !== 'none' ? C.roof[roof]?.label : '', C.finish[cfg.finish]?.label].filter(Boolean).join(' · ');
};
const stationNames = idx => joinAnd(idx.map(i => E.STATIONS[i]));

// profitWindow scans every cent, so keep its answers per car and per the rules it depends on (not the price,
// opening cash or months, which change while a learner drags a slider).
const winCache = new Map();
function profitWindowCached(cfg, R, up) {
  const key = E.carKey(cfg, up) + JSON.stringify(up) + JSON.stringify({ ...R, price: 0, openingCash: 0, months: 0 });
  if (!winCache.has(key)) { if (winCache.size > 40) winCache.delete(winCache.keys().next().value); winCache.set(key, E.profitWindow(cfg, R, up)); }
  return winCache.get(key);
}

/* ---------- SVG primitives (labels sized for 10 px IBM Plex Mono, 0.6 em per character) ---------- */
const n1 = v => Math.round(v * 10) / 10;
const CW = 6.1;
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
const niceStep = (span, n) => { if (!(span > 0)) return 1; const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const LN = (x1, y1, x2, y2, c) => `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" class="${c}"/>`;
const PATH = (pts, c) => `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + n1(p[0]) + ' ' + n1(p[1])).join('')}" class="${c}"/>`;
const POLY = (pts, c, extra = '') => `<polygon points="${pts.map(p => n1(p[0]) + ',' + n1(p[1])).join(' ')}" class="${c}" ${extra}/>`;
const DOT = (x, y, r, c) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${r}" class="${c}"/>`;
// Text, nudged sideways so its estimated box stays inside [x0, x1].
function TX(x, y, s, cls = '', anchor = 'start', box = null) {
  const tw = String(s).length * CW;
  if (box) {
    let a = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2;
    a = Math.max(box[0], Math.min(box[1] - tw, a));
    x = anchor === 'start' ? a : anchor === 'end' ? a + tw : a + tw / 2;
  }
  return `<text x="${n1(x)}" y="${n1(y)}" text-anchor="${anchor}" class="${cls}">${esc(s)}</text>`;
}
const SVG = (w, h, body, label, extra = '') => `<svg class="lg-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" ${extra}>${body}</svg>`;

/* ---------- CSS (one style element, injected once) ---------- */
const LEDGER_CSS = `
.lg-w { min-width: 0; }
.lg-vh { display: inline-block; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
caption.lg-vh { display: table-caption; }
.lg-w [hidden], .lg-pane [hidden] { display: none !important; }
.lg-num { font-family: var(--f-mono); font-variant-numeric: tabular-nums; }
.lg-pos { color: var(--gain-ink); } .lg-neg { color: var(--loss-ink); }
.lg-note { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--muted); }
.lg-btn { border: 1px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 8px; padding: 8px 12px; min-height: 40px; cursor: pointer; font-family: var(--f-display); font-weight: 700; font-size: 13px; line-height: 1.2; }
.lg-btn:hover { border-color: color-mix(in srgb, var(--ink) 40%, var(--line)); }
.lg-btn.lg-primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 800; font-stretch: 112%; font-size: 14px; }
.lg-btn.lg-small { padding: 5px 10px; min-height: 32px; font-size: 12px; font-weight: 650; }
.lg-btn:disabled { opacity: .45; cursor: not-allowed; }
/* the standard focus ring: dark ring plus a yellow halo, readable on any background in both themes */
.lg-btn:focus-visible, .lg-w button:focus-visible, .lg-pane button:focus-visible, .lg-pane summary:focus-visible, .lg-w [tabindex]:focus-visible, .lg-pane input:focus-visible, .lg-pane select:focus-visible,
#ribbon button:focus-visible, #ribbon summary:focus-visible, #statement button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; box-shadow: 0 0 0 4px var(--accent); }
#statement h3:focus { outline: none; }
.lg-row { display: flex; flex-wrap: wrap; gap: 8px; }
.lg-row > .lg-btn { flex: 1 1 auto; }
.lg-seg { display: inline-flex; flex-wrap: wrap; background: var(--bg); border: 1px solid var(--line-strong); border-radius: 999px; padding: 3px; gap: 2px; }
.lg-seg button { border: 0; background: transparent; border-radius: 999px; padding: 6px 12px; min-height: 32px; cursor: pointer; font-family: var(--f-display); font-weight: 650; font-size: 12.5px; color: var(--muted); }
.lg-seg button[aria-pressed="true"], .lg-seg button[aria-selected="true"] { background: var(--ink); color: var(--bg); }
.lg-seg button:disabled { cursor: not-allowed; }
.lg-in { box-sizing: border-box; width: 100%; min-height: 40px; font-family: var(--f-mono); font-size: 14px; font-variant-numeric: tabular-nums; padding: 7px 9px; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--bg); color: var(--ink); }
.lg-in:disabled { opacity: .55; }
select.lg-in { font-family: var(--f-display); font-size: 13px; }
.lg-range { width: 100%; height: 32px; margin: 0; accent-color: var(--ink); cursor: pointer; }
.lg-range:disabled { cursor: not-allowed; opacity: .55; }
.lg-bub:empty { display: none; }
.lg-lock { margin: 0; font-size: 12px; line-height: 1.45; color: var(--ink); padding: 6px 10px; border-left: 3px solid var(--accent); background: var(--bg); border-radius: 0 6px 6px 0; }

/* sliders */
.lg-slider { display: grid; gap: 2px; }
.lg-sl-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.lg-sl-top label { font-size: 13px; font-weight: 650; }
.lg-sl-top output { font-size: 15px; font-weight: 600; }
.lg-sl-read { font-size: 12px; color: var(--muted); line-height: 1.4; }

/* where the money goes */
.lg-where { display: grid; gap: 6px; }
.lg-wh-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.lg-wh-top h3 { margin: 0; font-size: 14.5px; font-weight: 800; font-stretch: 112%; }
.lg-wh-top span { font-size: 11.5px; color: var(--muted); }
.lg-wh-bar { position: relative; display: flex; height: 26px; border-radius: 6px; overflow: hidden; border: 1px solid var(--line); background: var(--bg); }
.lg-wh-bar button { border: 0; padding: 0; margin: 0; min-width: 0; height: 100%; cursor: pointer; font-family: var(--f-mono); font-size: 10px; font-variant-numeric: tabular-nums; overflow: hidden; white-space: nowrap; color: var(--ink); box-shadow: inset -1px 0 0 var(--surface); }
.lg-wh-bar button[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--accent); }
.lg-wh-bar button:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; box-shadow: inset 0 0 0 4px var(--accent); }
.lg-wh-price { position: absolute; top: -2px; bottom: -2px; width: 0; border-left: 2px solid var(--ink); pointer-events: none; }
.lg-wh-lossmask { position: absolute; top: 0; bottom: 0; right: 0; pointer-events: none; background: repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in srgb, var(--loss) 75%, transparent) 3px 5px); }
.lg-wh-read { font-size: 12px; color: var(--muted); min-height: 1.3em; }
.lg-wh-read b { color: var(--ink); font-weight: 600; }
.lg-key { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 12px; margin: 0; padding: 0; list-style: none; font-size: 12px; }
.lg-key li { display: flex; align-items: center; gap: 6px; min-width: 0; }
.lg-key li span:nth-child(2) { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lg-key i { flex: none; width: 10px; height: 10px; border-radius: 2px; border: 1px solid var(--line); }
.lg-s-mat { background: var(--wood); color: var(--on-accent) !important; } /* dark label on wood in both themes */
.lg-s-touch { background: var(--ink); color: var(--bg) !important; }
.lg-s-wait { background: repeating-linear-gradient(135deg, var(--ink) 0 2px, var(--wait) 2px 5px); color: var(--ink) !important; font-weight: 600; text-shadow: 0 0 2px var(--surface), 0 0 2px var(--surface), 0 0 4px var(--surface); }
/* segment fills and their label colours: every pair reads at 4.5:1 or better in both themes */
.lg-s-qc { background: color-mix(in srgb, var(--ink) 70%, var(--surface)); color: var(--bg) !important; }
.lg-s-pow { background: color-mix(in srgb, var(--muted) 45%, var(--surface)); }
.lg-s-scrap { background: color-mix(in srgb, var(--loss) 55%, var(--surface)); }
.lg-s-ship { background: color-mix(in srgb, var(--wood) 45%, var(--muted)); color: var(--on-accent) !important; }
.lg-s-fixed { background: var(--muted); color: var(--surface) !important; }
.lg-s-disc { background: color-mix(in srgb, var(--accent) 80%, var(--surface)); color: var(--on-accent) !important; }
.lg-s-profit { background: var(--gain); color: var(--on-accent) !important; }
.lg-s-loss { background: repeating-linear-gradient(135deg, var(--loss) 0 3px, transparent 3px 5px); }

/* cost sheet */
.lg-cs { display: grid; gap: 10px; }
.lg-cs h4 { margin: 0 0 2px; font-family: var(--f-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); font-weight: 500; }
.lg-cs ul { list-style: none; margin: 0; padding: 0; }
.lg-cl-b { width: 100%; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; border: 0; border-bottom: 1px dotted var(--line); background: none; padding: 6px 0; min-height: 34px; text-align: left; cursor: pointer; font-family: var(--f-display); font-size: 13px; color: var(--ink); }
.lg-cl-b .lg-num { font-size: 13px; white-space: nowrap; }
.lg-cl-b[aria-expanded="true"] { border-bottom-style: solid; }
.lg-ind .lg-cl-b { padding-left: 12px; color: var(--muted); font-size: 12.5px; }
.lg-ind .lg-cl-b .lg-num { color: var(--ink); font-size: 12.5px; }
.lg-sub .lg-cl-b { font-weight: 750; border-bottom: 1px solid var(--line); }
.lg-how { padding: 6px 0 8px 12px; font-family: var(--f-mono); font-size: 12px; line-height: 1.5; color: var(--ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; display: grid; gap: 6px; }
.lg-how .lg-btn { justify-self: start; }

/* tables */
.lg-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.lg-tbl th, .lg-tbl td { padding: 5px 4px; text-align: right; border-bottom: 1px solid var(--line); font-family: var(--f-mono); font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 400; }
.lg-tbl thead th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); position: sticky; top: 0; background: var(--surface); }
.lg-tbl th:first-child, .lg-tbl td:first-child { text-align: left; }
.lg-tbl tr.lg-hl td, .lg-tbl tr.lg-hl th { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.lg-tblwrap { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 8px; }
.lg-pl .lg-tbl th { font-family: var(--f-display); font-size: 13px; padding: 0; }
.lg-pl .lg-tbl td { font-size: 13px; vertical-align: middle; }
.lg-pl .lg-tbl th { vertical-align: middle; }
.lg-rowb { width: 100%; border: 0; background: none; padding: 7px 0; min-height: 34px; text-align: left; cursor: pointer; font: inherit; color: var(--ink); }
.lg-pl tr.lg-ind .lg-rowb { padding-left: 12px; color: var(--muted); }
.lg-pl tr.lg-tot th, .lg-pl tr.lg-tot td { font-weight: 750; border-bottom-color: var(--ink); }
.lg-pl tr.lg-hrow td { white-space: normal; text-align: left; font-size: 12px; padding: 4px 0 8px 12px; color: var(--ink); }
.lg-pl .lg-memo td, .lg-pl .lg-memo th { color: var(--muted); font-style: italic; border-bottom: 0; }
.lg-pl .lg-memo th { white-space: normal; padding-right: 8px; } /* the long memo label wraps so the table fits 360 px */
.lg-pl-head { margin: 0 0 4px; font-size: 12px; color: var(--muted); }

/* charts */
.lg-chart { display: grid; gap: 6px; }
.lg-ch-box { width: 100%; min-width: 0; overflow: hidden; border-radius: 6px; }
.lg-ch-box.lg-drag { touch-action: none; cursor: ew-resize; }
.lg-ch-box:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; box-shadow: 0 0 0 4px var(--accent); }
.lg-ch-foot { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.lg-ch-read { font-size: 11.5px; color: var(--muted); line-height: 1.45; }
.lg-ch-read b { color: var(--ink); font-weight: 600; }
.lg-tbtn { flex: none; border: 1px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 6px; padding: 4px 10px; min-height: 30px; cursor: pointer; font-family: var(--f-mono); font-size: 11px; }
.lg-tbtn[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.lg-svg { display: block; width: 100%; height: auto; overflow: hidden; }
.lg-svg text { font-family: var(--f-mono); font-size: 10px; fill: var(--muted); font-variant-numeric: tabular-nums; }
.lg-svg text.lg-t-ink { fill: var(--ink); font-weight: 600; }
.lg-svg text.lg-t-gain { fill: var(--gain-ink); font-weight: 600; }
.lg-svg text.lg-t-loss { fill: var(--loss-ink); font-weight: 600; }
.lg-svg text.lg-t-cell { font-size: 7.5px; fill: var(--ink); opacity: .75; }
.lg-svg text.lg-halo, .lg-svg .lg-halo text { paint-order: stroke; stroke: var(--surface); stroke-width: 3px; stroke-linejoin: round; }
.lg-svg .lg-grid { stroke: var(--line); stroke-width: 1; }
.lg-svg .lg-axis { stroke: var(--muted); stroke-width: 1; }
.lg-svg .lg-zero { stroke: var(--muted); stroke-width: 1.25; stroke-dasharray: 4 3; }
.lg-svg .lg-l-rev { stroke: var(--gain); stroke-width: 2.25; fill: none; }
.lg-svg .lg-l-cost { stroke: var(--ink); stroke-width: 2.25; fill: none; }
.lg-svg .lg-l-fixed { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 6 4; fill: none; }
.lg-svg .lg-l-profit, .lg-svg .lg-l-cash { stroke: var(--ink); stroke-width: 2.25; fill: none; stroke-linejoin: round; }
.lg-svg .lg-l-util { stroke: var(--muted); stroke-width: 2; stroke-dasharray: 5 3; fill: none; stroke-linejoin: round; }
.lg-svg .lg-a-gain { fill: var(--gain); fill-opacity: .14; stroke: none; }
.lg-svg .lg-a-loss { fill: var(--loss); fill-opacity: .13; stroke: none; }
.lg-svg .lg-kink { stroke: var(--muted); stroke-width: 1.25; stroke-dasharray: 2 3; }
.lg-svg .lg-gap-g { stroke: var(--gain); stroke-width: 3; }
.lg-svg .lg-gap-l { stroke: var(--loss); stroke-width: 3; }
.lg-svg .lg-cur { stroke: var(--ink); stroke-width: 1; stroke-dasharray: 3 3; opacity: .7; }
.lg-svg .lg-dot { fill: var(--accent); stroke: var(--ink); stroke-width: 1.5; }
.lg-svg .lg-dot-s { fill: var(--surface); stroke: var(--ink); stroke-width: 1.5; }
.lg-svg .lg-mk { stroke: var(--accent); stroke-width: 3; }
.lg-svg .lg-mk-h { fill: var(--accent); stroke: var(--ink); stroke-width: 1.5; }
.lg-svg .lg-mk-ghost { stroke: var(--muted); stroke-width: 2; stroke-dasharray: 4 3; }
.lg-svg .lg-sep { stroke: var(--line); stroke-width: 1; }
.lg-svg .lg-cell { stroke: var(--line); stroke-width: 1; }
.lg-svg .lg-c-off { fill: none; }
.lg-svg .lg-c-pos { fill: color-mix(in srgb, var(--gain) 55%, var(--surface)); stroke: none; }
.lg-svg .lg-c-low { fill: color-mix(in srgb, var(--accent) 70%, var(--surface)); stroke: none; }
.lg-svg .lg-c-neg { fill: color-mix(in srgb, var(--loss) 60%, var(--surface)); stroke: none; }
.lg-svg .lg-c-first { stroke: var(--ink); stroke-width: 1.5; }

/* capacity meter */
.lg-cap { display: grid; gap: 4px; }
.lg-cap-bar { position: relative; height: 14px; border-radius: 4px; background: var(--bg); border: 1px solid var(--line); overflow: hidden; }
.lg-cap-bar span { position: absolute; top: 0; bottom: 0; left: 0; }
.lg-cap-sold { background: var(--ink); }
.lg-cap-lost { background: repeating-linear-gradient(135deg, var(--loss) 0 3px, transparent 3px 6px); }
.lg-cap-tick { position: absolute; top: -3px; bottom: -3px; width: 0; border-left: 2px dashed var(--accent); }
.lg-cap-txt { font-size: 12px; color: var(--muted); line-height: 1.4; }
.lg-cap-txt b { color: var(--ink); font-weight: 600; }

/* fixed bills, markup, mix, waterfall */
.lg-list { list-style: none; margin: 0; padding: 0; display: grid; }
.lg-list li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px dotted var(--line); font-size: 13px; }
.lg-list li.lg-tot { font-weight: 750; border-bottom: 1px solid var(--ink); }
.lg-list li .lg-num { white-space: nowrap; }
.lg-h4 { margin: 0; font-family: var(--f-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); font-weight: 500; }
.lg-mkc { display: grid; gap: 10px; padding: 12px; border: 1px dashed var(--line); border-radius: 10px; background: var(--bg); }
.lg-mk-tag { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.lg-mk-tag b { font-family: var(--f-mono); font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lg-mk-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lg-mix .lg-tbl td:first-child, .lg-mix .lg-tbl th:first-child { white-space: normal; }
.lg-mix .lg-rowb { padding: 5px 0; font-family: var(--f-display); font-size: 12.5px; font-weight: 650; }
.lg-mix .lg-rowb small { display: block; font-weight: 400; color: var(--muted); font-size: 11px; }
.lg-mix .lg-cbar { display: block; height: 4px; margin-top: 3px; border-radius: 2px; background: var(--gain); margin-left: auto; }
.lg-mix .lg-cbar.lg-neg { background: var(--loss); }
.lg-mix tr.lg-det td { white-space: normal; text-align: left; font-size: 11.5px; color: var(--ink); padding: 2px 0 8px; line-height: 1.5; }
.lg-wf { display: grid; gap: 5px; }
.lg-wf-r { display: grid; grid-template-columns: minmax(0, 9.5em) minmax(0, 1fr) 4.8em; gap: 8px; align-items: center; font-size: 12.5px; }
.lg-wf-r .lg-num { text-align: right; white-space: nowrap; }
.lg-wf-t { position: relative; height: 12px; }
.lg-wf-t span { position: absolute; top: 0; bottom: 0; border-radius: 2px; background: color-mix(in srgb, var(--ink) 55%, var(--surface)); }
.lg-wf-r.lg-tot { font-weight: 750; }
.lg-wf-r.lg-tot .lg-wf-t span { background: var(--ink); }
.lg-wf-r.lg-pr .lg-wf-t span { background: var(--wood); }
.lg-wf-r.lg-gainr .lg-wf-t span { background: var(--gain); }
.lg-wf-r.lg-lossr .lg-wf-t span { background: var(--loss); }

/* the Ledger pane */
.lg-pane { display: block !important; position: relative; padding-bottom: 12px; }
.lg-pane[hidden] { display: none !important; }
.lg-pin { position: sticky; top: var(--lg-tabs-h, 50px); z-index: 2; background: var(--surface); padding: 10px 16px 6px; border-bottom: 1px solid var(--line); }
.lg-pinkey { padding: 8px 16px 10px; }
.lg-sec { border-top: 1px dashed var(--line); scroll-margin-top: calc(var(--lg-tabs-h, 50px) + 96px); }
.lg-sec:first-of-type { border-top: 0; }
.lg-sec > summary { list-style: none; cursor: pointer; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 6px 16px; }
.lg-sec > summary::-webkit-details-marker { display: none; }
.lg-sec > summary h3 { margin: 0; font-size: 15px; font-weight: 800; font-stretch: 112%; white-space: nowrap; }
.lg-sec > summary .lg-sum { margin-left: auto; font-family: var(--f-mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.lg-sec > summary::after { content: ""; flex: none; width: 7px; height: 7px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg); margin: -4px 2px 0 4px; }
.lg-sec[open] > summary::after { transform: rotate(225deg); margin-top: 4px; }
.lg-body { padding: 2px 16px 16px; display: grid; gap: 14px; min-width: 0; }
.lg-body > *, .lg-st > *, .lg-rb > * { min-width: 0; }
.lg-sub2 > summary { cursor: pointer; font-size: 13px; font-weight: 700; min-height: 36px; display: flex; align-items: center; }
.lg-sub2 > div { padding-top: 8px; }
.lg-car { margin: 0; font-size: 12.5px; color: var(--muted); }
.lg-car b { color: var(--ink); }
.lg-field { display: grid; gap: 4px; }
.lg-field > span, .lg-field > label { font-size: 12.5px; font-weight: 650; }
.lg-field > .lg-seg { justify-self: start; }
.lg-check { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; cursor: pointer; min-height: 36px; }
.lg-check input { width: 20px; height: 20px; margin: 1px 0 0; accent-color: var(--ink); flex: none; }
.lg-check small { display: block; color: var(--muted); font-size: 11.5px; }
.lg-plan { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
.lg-plan .lg-wide { grid-column: 1 / -1; }
.lg-mini { margin: 0; font-size: 12.5px; line-height: 1.5; padding: 8px 10px; border-radius: 8px; background: var(--bg); }
.lg-mini b { font-family: var(--f-mono); font-weight: 600; font-variant-numeric: tabular-nums; }
.lg-rules { display: grid; gap: 10px; }
.lg-rule { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 8.5em) auto; gap: 8px; align-items: center; }
.lg-rule label { font-size: 13px; font-weight: 650; }
.lg-rule label small { display: block; font-weight: 400; color: var(--muted); font-size: 11px; font-family: var(--f-mono); }
.lg-rule.lg-edited label { color: var(--ink); }
.lg-rule.lg-edited label::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-right: 6px; vertical-align: 2px; }
.lg-rule .lg-check { min-height: 40px; align-items: center; }
.lg-gloss { display: grid; gap: 10px; }
.lg-gloss dl { margin: 0; display: grid; gap: 8px; }
.lg-gloss dt { font-weight: 750; font-size: 13px; }
.lg-gloss dfn { font-style: normal; }
.lg-gloss dd { margin: 1px 0 0; font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.lg-act { display: grid; gap: 6px; }
.lg-msg { font-size: 12px; color: var(--muted); min-height: 1.2em; margin: 0; }
.lg-ask { display: flex; gap: 8px; }
.lg-ask .lg-in { flex: 1 1 auto; }

/* Run the month: ribbon over the stage, statement card */
#ribbon.lg-rbon { top: 92px; z-index: 4; }
.lg-rb { box-sizing: border-box; max-width: 760px; margin: 0 auto; background: var(--glass); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; backdrop-filter: blur(6px); display: grid; gap: 5px; color: var(--ink); }
.lg-rb-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lg-rb-head b { font-size: 13px; font-weight: 750; }
.lg-rb-bank { font-size: 13px; font-weight: 600; margin-right: auto; }
.lg-rb-row { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 6px; align-items: center; }
.lg-rb-row > span { font-family: var(--f-mono); font-size: 10px; color: var(--muted); }
.lg-rb-cells { display: grid; grid-template-columns: repeat(21, minmax(0, 1fr)); gap: 2px; }
.lg-rb-cells i { height: 11px; border-radius: 2px; border: 1px solid var(--line); box-sizing: border-box; }
.lg-rb-cells i.lg-c-pos { background: color-mix(in srgb, var(--gain) 60%, var(--surface)); border-color: transparent; }
.lg-rb-cells i.lg-c-low { background: color-mix(in srgb, var(--accent) 75%, var(--surface)); border-color: transparent; }
.lg-rb-cells i.lg-c-neg { background: color-mix(in srgb, var(--loss) 65%, var(--surface)); border-color: transparent; }
.lg-rb-cells i.lg-c-now { border: 2px solid var(--ink); }
.lg-rb-out { display: grid; gap: 8px; padding: 8px 2px 2px; border-top: 1px solid var(--line); font-size: 13px; line-height: 1.45; }
.lg-rb-out b { color: var(--loss-ink); }
.lg-rb-why { font-size: 12px; }
.lg-rb-why summary { cursor: pointer; font-weight: 650; min-height: 30px; display: flex; align-items: center; }
.lg-rb-why ul { margin: 4px 0 0; padding-left: 18px; font-family: var(--f-mono); font-size: 11.5px; font-variant-numeric: tabular-nums; }
#statement .lg-st { padding: 14px 16px 16px; display: grid; gap: 12px; color: var(--ink); }
.lg-st-head { display: flex; align-items: center; gap: 8px; }
.lg-st-head h3 { margin: 0; font-size: 17px; font-weight: 800; font-stretch: 112%; }
.lg-x { margin-left: auto; width: 36px; min-height: 36px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); cursor: pointer; font-size: 18px; line-height: 1; }
.lg-st-lede { margin: 0; font-size: 13.5px; line-height: 1.5; }
.lg-st-lede b { font-family: var(--f-mono); font-weight: 600; font-variant-numeric: tabular-nums; }
.lg-st-tabs { justify-self: start; }
.lg-st-acts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
#statement .lg-msg:empty { display: none; }
.lg-st-cash li.lg-lowrow { display: block; }
.lg-st-cash .lg-rowb { display: flex; justify-content: space-between; gap: 10px; padding: 0; min-height: 0; }
.lg-lowhow { margin: 6px 0 2px; font-size: 12px; line-height: 1.5; color: var(--ink); }
@media (max-width: 820px) {
  .lg-st-head { order: -4; } .lg-st-lede { order: -3; } .lg-st-acts { order: -2; } #statement .lg-msg { order: -1; }
  #ribbon.lg-rbon { top: 86px; left: 8px; right: 8px; }
  .lg-plan { grid-template-columns: minmax(0, 1fr); }
  .lg-rule { grid-template-columns: minmax(0, 1fr) minmax(0, 7.5em) auto; }
}
@media (max-width: 380px) {
  .lg-tbl th, .lg-tbl td { padding-left: 2px; padding-right: 2px; }
}
/* phones and touch screens: 44 px targets and 16 px inputs (no zoom on focus). Kept LAST so it beats the base rules above. */
@media (max-width: 820px), (pointer: coarse) {
  .lg-btn, .lg-btn.lg-small, .lg-seg button, .lg-cl-b, .lg-rowb, .lg-tbtn, .lg-x, .lg-st-cash .lg-rowb { min-height: 44px; }
  .lg-seg button { min-width: 44px; }
  .lg-x { width: 44px; }
  .lg-sub2 > summary, .lg-rb-why summary, .lg-check, .lg-rule .lg-check { min-height: 44px; }
  .lg-range { height: 44px; }
  .lg-in, select.lg-in { font-size: 16px; min-height: 44px; }
}
@media (pointer: coarse) {
  .lg-wh-bar { height: 44px; }
}
`;
function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('css-ledger')) return;
  const s = document.createElement('style'); s.id = 'css-ledger'; s.textContent = LEDGER_CSS; document.head.appendChild(s);
}
// Each widget renders into its own root inside `el`, so destroy() removes it and every listener on it.
function mountW(el, cls) { ensureCss(); const root = document.createElement('div'); root.className = 'lg-w ' + cls; el.appendChild(root); return root; }

/* ======================================================================================================== */
/* ---------- widgets ---------- */

// "Where the $32 goes": a horizontal stacked bar of SPEC §2.7. o: { cfg, R, up, price, sold?, legendEl?, legend? }
const SEG = { materials: 'mat', touch: 'touch', waiting: 'wait', qc: 'qc', powerCons: 'pow', scrap: 'scrap', shipping: 'ship', fixed: 'fixed', discount: 'disc', profit: 'profit' };
function whereBar(el, o = {}) {
  const root = mountW(el, 'lg-where');
  let st = { legend: true, ...o }, sel = null, last = '', info = null, ro = null, w = 0;
  const readHtml = () => {
    if (!info) return '';
    const { segs, price, sold, F, noSales } = info;
    if (noSales) return `No cars sold at ${esc($2(price))}, so there are no cars to share the ${esc($m(F))} of fixed bills.`;
    const s = segs.find(x => x.id === sel); if (!s) return '';
    return `<b>${esc(s.label)} ${esc($2(s.value))}</b> · ${esc(fmt.pct(s.value / price))} of the price${s.id === 'fixed' ? ` (${esc($m(F))} ÷ ${esc(fmt.count(sold))} cars)` : ''}`;
  };
  const select = id => {
    sel = id;
    root.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', b.dataset.seg === id));
    const r = root.querySelector('.lg-wh-read'); if (r) r.innerHTML = readHtml();
  };
  root.addEventListener('click', e => { const b = e.target.closest('[data-seg]'); if (b) select(b.dataset.seg); });
  root.addEventListener('focusin', e => { const b = e.target.closest('[data-seg]'); if (b && b.dataset.seg !== sel) select(b.dataset.seg); });
  try { ro = new ResizeObserver(() => { const nw = root.clientWidth; if (nw && Math.abs(nw - w) > 1) { w = nw; paint(); } }); ro.observe(root); } catch { }
  function paint() {
    const { cfg, R, up, price, sold } = norm(st);
    const wh = E.whereTheMoneyGoes(cfg, R, up, { price, sold });
    const noSales = !(wh.sold > 0);
    const segs = wh.segments.filter(s => fin(s.value));
    const costs = segs.filter(s => s.id !== 'profit'), prof = segs.find(s => s.id === 'profit');
    const costSum = costs.reduce((a, s) => a + s.value, 0);
    const total = Math.max(price, costSum) || 1;
    const loss = prof && prof.value < -EPS;
    info = { segs, price, sold: wh.sold, F: E.fixedTotal(R, up), noSales };
    if (!segs.some(s => s.id === sel)) sel = prof && !noSales ? 'profit' : segs[0]?.id;
    const W = root.clientWidth || 300;
    const bars = costs.map(s => ({ ...s, pct: s.value / total * 100 }));
    if (prof && !loss && !noSales) bars.push({ ...prof, pct: prof.value / total * 100 });
    const key = JSON.stringify([bars.map(b => [b.id, b.label, roundTo(b.value, 4)]), price, W, wh.sold, st.legend, !!st.legendEl]);
    if (key === last) { select(sel); return; }
    last = key;
    const segBtn = b => {
      const px = b.pct / 100 * W, txt = px >= 44 ? $2(b.value) : px >= 30 ? $2(b.value).replace(/^\$/, '') : '';
      return `<button type="button" data-seg="${b.id}" class="lg-s-${SEG[b.id] || 'fixed'}" style="flex:0 0 ${n1(b.pct)}%" aria-pressed="false" aria-label="${esc(b.label)} ${esc($2(b.value))}" title="${esc(b.label)} ${esc($2(b.value))}">${esc(txt)}</button>`;
    };
    const keyHtml = () => `<ul class="lg-key">${segs.map(x => `<li><i class="lg-s-${x.id === 'profit' && x.value < 0 ? 'loss' : SEG[x.id] || 'fixed'}"></i><span>${esc(x.label)}</span><span class="lg-num ${x.id === 'profit' ? signCls(x.value) : ''}">${esc($2(x.value))}</span></li>`).join('')}</ul>`;
    const pp = n1(price / total * 100);
    root.innerHTML = `
      <div class="lg-wh-top"><h3>Where the ${esc(priceLabel(price))} goes</h3><span class="lg-num">at ${esc(fmt.count(wh.sold))} cars a month</span></div>
      <div class="lg-wh-bar" role="group" aria-label="Where the price of one car goes">${bars.map(segBtn).join('')}${loss ? `<span class="lg-wh-lossmask" style="left:${pp}%"></span><span class="lg-wh-price" style="left:${pp}%"></span>` : ''}</div>
      <div class="lg-wh-read"></div>
      ${st.legend && !st.legendEl ? keyHtml() : ''}`;
    if (st.legendEl) st.legendEl.innerHTML = st.legend === false ? '' : keyHtml();
    select(sel);
  }
  paint();
  return { update(p) { Object.assign(st, p); paint(); }, destroy() { ro?.disconnect(); root.remove(); if (st.legendEl) st.legendEl.innerHTML = ''; } };
}

// Every cost line with its formula and values (econ.costLines). o: { cfg, R, up, price, sold?, only?, onExplain?(id, host, line) }
const CS_TITLE = { materials: 'Materials', labour: 'Labour', line: 'Running the line', car: 'Per car sold', pl: 'The month' };
const CS_SUB = new Set(['materials', 'labour.crew', 'started', 'variable', 'full', 'profitPerCar', 'breakEven']);
const CS_IND = id => id.startsWith('mat.') || id === 'labour.touch' || id === 'labour.waitBott' || id === 'labour.waitMove' || id.startsWith('pl.') && !['pl.sales', 'pl.variable', 'pl.contribution', 'pl.fixed', 'pl.profit'].includes(id);
function costSheet(el, o = {}) {
  const root = mountW(el, 'lg-cs');
  let st = { ...o }, last = '', lines = [];
  const open = new Set();
  root.addEventListener('click', e => {
    const ex = e.target.closest('[data-explain]');
    if (ex) { const l = lines.find(x => x.id === ex.dataset.explain); const host = ex.parentElement.querySelector('.lg-bub'); st.onExplain?.(l.id, host, l); return; }
    const b = e.target.closest('.lg-cl-b'); if (!b) return;
    const id = b.dataset.id, on = b.getAttribute('aria-expanded') !== 'true';
    on ? open.add(id) : open.delete(id);
    b.setAttribute('aria-expanded', on); b.nextElementSibling.hidden = !on;
  });
  function paint() {
    const { cfg, R, up, price, sold } = norm(st);
    const cl = E.costLines(cfg, R, up, { price, sold });
    const only = st.only ? new Set(st.only) : null;
    lines = cl.lines.filter(l => only ? only.has(l.id) : l.section !== 'pl');
    const sections = [];
    for (const l of lines) { let s = sections.find(x => x.id === l.section); if (!s) sections.push(s = { id: l.section, lines: [] }); s.lines.push(l); }
    const title = id => id === 'month' ? `At ${fmt.count(cl.month.sold)} cars a month` : CS_TITLE[id] || id;
    const ex = !!st.onExplain && st.explain !== false;
    const key = JSON.stringify([lines.map(l => [l.id, l.label, roundTo(l.value, 6), l.how]), ex]);
    if (key === last) return; last = key;
    root.innerHTML = sections.map(s => `<section><h4>${esc(title(s.id))}</h4><ul>${s.lines.map(l => {
      const v = valText(l.value, l.unit), on = open.has(l.id);
      const cls = (CS_SUB.has(l.id) ? 'lg-sub' : '') + (CS_IND(l.id) ? ' lg-ind' : '');
      const neg = (l.id === 'profitPerCar' || l.id === 'contribution' || l.id === 'margin' || l.id === 'markup' || l.id === 'pl.profit') ? signCls(l.value) : '';
      return `<li class="${cls}"><button type="button" class="lg-cl-b" data-id="${esc(l.id)}" aria-expanded="${on}"><span>${esc(l.label)}</span><span class="lg-num ${neg}">${esc(v)}</span></button>
        <div class="lg-how" ${on ? '' : 'hidden'}><span>${esc(l.how)} = <b>${esc(v)}</b></span>${ex ? `<button type="button" class="lg-btn lg-small" data-explain="${esc(l.id)}">Explain</button><div class="lg-bub"></div>` : ''}</div></li>`;
    }).join('')}</ul></section>`).join('');
  }
  paint();
  return { update(p) { Object.assign(st, p); paint(); }, destroy() { root.remove(); } };
}

// A range input with a mono readout. o: { min, max, value, step, label, unit?, onInput(n) }
function volumeSlider(el, o = {}) {
  const root = mountW(el, 'lg-slider'), id = uid('vol');
  let st = { min: 0, max: 100, step: 1, value: 0, label: 'Cars sold a month', unit: 'cars', ...o };
  root.innerHTML = `<div class="lg-sl-top"><label for="${id}"></label><output class="lg-num" for="${id}"></output></div><input id="${id}" class="lg-range" type="range">`;
  const inp = root.querySelector('input'), out = root.querySelector('output'), lab = root.querySelector('label');
  const show = v => { out.textContent = `${fmt.count(v)}${st.unit ? ' ' + st.unit : ''}`; inp.setAttribute('aria-valuetext', out.textContent); };
  const sync = () => { lab.textContent = st.label; inp.min = st.min; inp.max = st.max; inp.step = st.step; inp.value = st.value; show(+inp.value); };
  inp.addEventListener('input', () => { st.value = +inp.value; show(st.value); st.onInput?.(st.value); });
  sync();
  return { set(n) { st.value = n; sync(); }, update(p) { Object.assign(st, p); sync(); }, destroy() { root.remove(); } };
}

// The price slider: "Shops will order 1,900. The line can make 2,394." o: { value, from, to, step, onInput(p), readout, cfg?, R?, up? }
function priceSlider(el, o = {}) {
  const root = mountW(el, 'lg-slider'), id = uid('price');
  let st = { from: 24, to: 46, step: 0.5, readout: true, label: 'Price per car', ...o };
  if (!fin(st.value)) st.value = norm(st).R.price;
  // no live region: the readout rides on the slider's own aria-valuetext, so a screen reader hears it once per step
  root.innerHTML = `<div class="lg-sl-top"><label for="${id}"></label><output class="lg-num" for="${id}"></output></div><input id="${id}" class="lg-range" type="range"><div class="lg-sl-read"></div>`;
  const inp = root.querySelector('input'), out = root.querySelector('output'), lab = root.querySelector('label'), rd = root.querySelector('.lg-sl-read');
  const show = p => {
    out.textContent = $2(p);
    if (!st.readout) { rd.textContent = ''; inp.setAttribute('aria-valuetext', $2(p)); return; }
    const { cfg, R, up } = norm(st), mo = E.month(cfg, R, up, { price: p });
    rd.textContent = `Shops will order ${fmt.count(mo.Q)}. The line can make ${fmt.count(mo.capGood)}.` + (mo.lostSales > EPS ? ` ${fmt.count(mo.lostSales)} orders are lost.` : '');
    inp.setAttribute('aria-valuetext', `${$2(p)}: shops order ${fmt.count(mo.Q)}, the line can make ${fmt.count(mo.capGood)}`);
  };
  const sync = () => { lab.textContent = st.label; inp.min = Math.min(st.from, st.value); inp.max = Math.max(st.to, st.value); inp.step = st.step; inp.value = st.value; inp.disabled = !!st.disabled; show(st.value); };
  inp.addEventListener('input', () => { st.value = +inp.value; show(st.value); st.onInput?.(st.value); });
  sync();
  return { set(p) { st.value = p; sync(); }, update(p) { Object.assign(st, p); sync(); }, destroy() { root.remove(); } };
}

// The month P&L (SPEC §2.8), each line tappable for its formula. o: { cfg, R, up, price, sold? }
const PL_TOT = new Set(['pl.variable', 'pl.contribution', 'pl.profit']);
function plTable(el, o = {}) {
  const root = mountW(el, 'lg-pl');
  let st = { ...o }, last = '';
  const open = new Set();
  root.addEventListener('click', e => {
    const b = e.target.closest('.lg-rowb'); if (!b) return;
    const id = b.dataset.id, on = b.getAttribute('aria-expanded') !== 'true';
    on ? open.add(id) : open.delete(id);
    b.setAttribute('aria-expanded', on);
    const how = root.querySelector(`tr[data-how="${CSS.escape(id)}"]`); if (how) how.hidden = !on;
  });
  function paint() {
    const { cfg, R, up, price, sold } = norm(st);
    const cl = E.costLines(cfg, R, up, { price, sold }), mo = cl.month;
    const rows = cl.lines.filter(l => l.section === 'pl');
    const key = JSON.stringify(rows.map(l => [l.id, roundTo(l.value, 4), l.how]));
    if (key === last) return; last = key;
    const memoHow = `${fmt.count(mo.scrapped)} × ${$2(mo.car.started)}`;
    root.innerHTML = `<p class="lg-pl-head lg-num">${esc(fmt.count(mo.sold))} sold · ${esc(fmt.count(mo.startedN))} started · ${esc(fmt.count(mo.scrapped))} scrapped · at ${esc($2(mo.price))}</p>
      <table class="lg-tbl"><caption class="lg-vh">Monthly profit and loss</caption><tbody>${rows.map(l => {
      const on = open.has(l.id), v = $m(l.value);
      const cls = (PL_TOT.has(l.id) ? 'lg-tot' : '') + (CS_IND(l.id) ? ' lg-ind' : '');
      const label = l.id === 'pl.profit' ? `${l.label}` : l.label;
      return `<tr class="${cls}"><th scope="row"><button type="button" class="lg-rowb" data-id="${esc(l.id)}" aria-expanded="${on}">${esc(label)}</button></th><td class="${l.id === 'pl.profit' || l.id === 'pl.contribution' ? signCls(l.value) : ''}">${esc(v)}</td></tr>
        <tr class="lg-hrow" data-how="${esc(l.id)}" ${on ? '' : 'hidden'}><td colspan="2">${esc(l.how)} = <b>${esc(v)}</b></td></tr>`;
    }).join('')}
      <tr class="lg-memo"><th scope="row">Memo: scrap, already inside the lines above</th><td title="${esc(memoHow)}">${esc($m(mo.pl.scrapMemo))}</td></tr></tbody></table>
      <p class="lg-note">Operating profit is before the owner's pay, interest and tax.</p>`;
  }
  paint();
  return { update(p) { Object.assign(st, p); paint(); }, destroy() { root.remove(); } };
}

// A chart: an SVG drawn to the box's own width (so it can never spill), a readout line and a Table toggle.
function chartShell(el, cls, o, draw, table, hOf = null) {
  const root = mountW(el, 'lg-chart ' + cls);
  const tid = uid('tbl');
  root.innerHTML = `<div class="lg-ch-box"></div><div class="lg-ch-foot"><span class="lg-ch-read"></span><button type="button" class="lg-tbtn" aria-pressed="false" aria-controls="${tid}">Table</button></div><div class="lg-tblwrap" id="${tid}" hidden></div>`;
  const box = root.querySelector('.lg-ch-box'), read = root.querySelector('.lg-ch-read'), tbtn = root.querySelector('.lg-tbtn'), twrap = root.querySelector('.lg-tblwrap');
  const self = { st: { ...o }, ex: {}, box, root, w: 0 };
  let showT = !!o.showTable, ro = null;
  const paint = () => {
    const w = Math.floor(box.clientWidth); if (!w) return; self.w = w;
    const h = self.st.height || hOf?.(self.st) || (phone() ? 180 : 200);
    const r = draw(w, h, self.st, self.ex);
    box.innerHTML = r.svg; read.innerHTML = r.read || '';
    if (showT) twrap.innerHTML = table(self.st, self.ex);
  };
  const setT = on => { showT = on; tbtn.setAttribute('aria-pressed', on); tbtn.textContent = on ? 'Hide table' : 'Table'; twrap.hidden = !on; if (on) twrap.innerHTML = table(self.st, self.ex); };
  tbtn.addEventListener('click', () => setT(!showT));
  try { ro = new ResizeObserver(() => { const w = Math.floor(box.clientWidth); if (w && w !== self.w) paint(); }); ro.observe(box); } catch { }
  setT(showT); paint();
  self.paint = paint;
  self.api = { update(p) { Object.assign(self.st, p); paint(); }, destroy() { ro?.disconnect(); root.remove(); } };
  return self;
}
const tableHtml = (head, rows, hl = () => false) => `<table class="lg-tbl"><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${hl(r, i) ? 'lg-hl' : ''}">${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

// Break-even: fixed, total cost and revenue against cars sold, 0 to capacity. o: { cfg, R, up, price, sold?, marker?: { onPlace(cars) }, showTable? }
function breakEvenData(st) {
  const { cfg, R, up, price, sold } = norm(st);
  const mo = E.month(cfg, R, up, { price, sold });
  return { mo, F: mo.F, v: mo.car.variable, np: mo.netPrice, cap: mo.capGood, be: mo.breakEven };
}
function drawBreakEven(w, h, st, ex) {
  const { mo, F, v, np, cap, be } = breakEvenData(st), has = fin(be);
  const xMax = has && be > cap ? Math.ceil(be * 1.12 / 100) * 100 : cap;
  const yTop = Math.max(np * xMax, F + v * xMax, F) * 1.03;
  const ys = niceStep(yTop, 4), yMax = Math.ceil(yTop / ys - EPS) * ys;
  const P = { l: 40, r: 6, t: 12, b: 20 }, box = [2, w - 2];
  const X = lin(0, xMax, P.l, w - P.r), Y = lin(0, yMax, h - P.b, P.t);
  let g = '';
  for (let y = 0; y <= yMax + EPS; y += ys) g += LN(P.l, Y(y), w - P.r, Y(y), 'lg-grid') + TX(P.l - 4, Y(y) + 3.5, kMoney(y), '', 'end');
  const xs = niceStep(xMax, w < 380 ? 3 : 4);
  let lastTick = 0;
  const capW = fmt.count(xMax).length * CW;
  for (let x = 0; x <= xMax + EPS; x += xs) { if (x > 0 && X(xMax) - X(x) < capW + fmt.count(x).length * CW / 2 + 8) break; g += TX(X(x), h - 6, fmt.count(x), '', x === 0 ? 'start' : 'middle', box); lastTick = x; }
  if (X(xMax) - X(lastTick) >= capW + 4) g += TX(X(xMax), h - 6, fmt.count(xMax), '', 'end', box);
  if (xMax > cap + EPS) g += LN(X(cap), P.t, X(cap), h - P.b, 'lg-kink') + TX(X(cap) - 3, P.t + 9, 'capacity', '', 'end', box);
  // profit and loss areas between the revenue and total-cost lines
  const xc = np - v > EPS ? F / (np - v) : Infinity;
  if (fin(xc) && xc <= xMax) {
    g += POLY([[X(0), Y(F)], [X(xc), Y(F + v * xc)], [X(0), Y(0)]], 'lg-a-loss');
    g += POLY([[X(xc), Y(F + v * xc)], [X(xMax), Y(np * xMax)], [X(xMax), Y(F + v * xMax)]], 'lg-a-gain');
  } else g += POLY([[X(0), Y(F)], [X(xMax), Y(F + v * xMax)], [X(xMax), Y(np * xMax)], [X(0), Y(0)]], 'lg-a-loss');
  g += LN(P.l, Y(0), w - P.r, Y(0), 'lg-axis');
  g += LN(X(0), Y(F), X(xMax), Y(F), 'lg-l-fixed');
  g += LN(X(0), Y(F), X(xMax), Y(F + v * xMax), 'lg-l-cost');
  g += LN(X(0), Y(0), X(xMax), Y(np * xMax), 'lg-l-rev');
  // labels at the line ends
  const yr = Y(np * xMax), yc = Y(F + v * xMax), yf = Y(F), close = Math.abs(yr - yc) < 15;
  const xr = w - P.r - 2;
  g += `<g class="lg-halo">${TX(xr, close && yr > yc ? yr + 13 : yr - 5, 'Revenue', 'lg-t-gain', 'end')}${TX(xr, close && yr <= yc ? yc + 13 : yc - 5, 'Total cost', 'lg-t-ink', 'end')}${Math.abs(yf - yc) > 14 ? TX(xr, yf - 5, `Fixed ${$m(F)}`, '', 'end') : ''}</g>`;
  // where they cross (hidden while the learner is placing a marker, or while a lesson's checks ask for it: hideCross)
  const hide = beHidden(st);
  if (has && !hide) {
    const cx = X(be), cy = Y(np * be), right = cx < w * 0.62;
    g += DOT(cx, cy, 4.5, 'lg-dot') + `<g class="lg-halo">${TX(right ? cx + 8 : cx - 8, cy + 15, `${fmt.count(be)} · ${$m(be * np)}`, 'lg-t-ink', right ? 'start' : 'end', box)}</g>`;
  }
  // the volume the plan sells: the profit (or loss) gap between the two lines, no label (the readout says it)
  if (!st.marker && fin(mo.sold) && mo.sold > 0 && mo.sold <= xMax) {
    const sx = X(mo.sold), yR = Y(np * mo.sold), yC = Y(F + v * mo.sold);
    g += `<line x1="${n1(sx)}" y1="${n1(yC)}" x2="${n1(sx)}" y2="${n1(yR)}" class="${yR <= yC ? 'lg-gap-g' : 'lg-gap-l'}"/>` + DOT(sx, yR, 3, 'lg-dot-s') + DOT(sx, yC, 3, 'lg-dot-s');
  }
  // the learner's marker
  if (st.marker) {
    const m = ex.marker;
    if (m !== undefined && m !== null) g += LN(X(m), P.t - 4, X(m), h - P.b, 'lg-mk') + `<circle cx="${n1(X(m))}" cy="${n1(h - P.b)}" r="6" class="lg-mk-h"/><g class="lg-halo">${TX(X(m) + 8, P.t + 10, `${fmt.count(m)} cars`, 'lg-t-ink', X(m) > w * 0.65 ? 'end' : 'start', box)}</g>`;
  }
  const label = hide ? 'Break-even chart: revenue, total cost and fixed bills against cars sold.'
    : has ? `Break-even chart: revenue crosses total cost at ${fmt.count(be)} cars, ${$m(be * np)} of sales.` : 'Break-even chart: revenue never covers total cost at this price.';
  const gap = mo.sold > 0 ? ` At ${esc(fmt.count(mo.sold))} cars the gap is a ${mo.pl.profit >= 0 ? 'profit' : 'loss'} of <b class="${signCls(mo.pl.profit)}">${esc($m(Math.abs(mo.pl.profit)))}</b>.` : '';
  let read;
  if (st.marker) read = ex.marker !== undefined && ex.marker !== null ? `Marker at <b>${esc(fmt.count(ex.marker))} cars</b>. Drag it or use the arrow keys, then let go (or press Enter).` : 'Drag the marker to where revenue meets total cost.';
  else if (hide) read = 'Where the lines cross stays hidden until you answer the lesson\'s questions.' + gap;
  else if (!has) read = `Each car sold brings ${esc($2(np))} but costs ${esc($2(v))} to make, so no number of cars covers the ${esc($m(F))} of fixed bills.`;
  else read = `Break-even at <b>${esc(fmt.count(be))} cars</b> (${esc($m(be * np))} of sales): ${esc($m(F))} ÷ ${esc($2(np - v))} a car.` + (be > cap ? ` That is more than the line can make (${esc(fmt.count(cap))}).` : '') + gap;
  return { svg: SVG(w, h, g, label), read };
}
const beHidden = st => (!!st.marker || !!st.hideCross) && !st.reveal;
function breakEvenTable(st) {
  const { F, v, np, cap, be } = breakEvenData(st), hide = beHidden(st);
  const rows = [];
  const add = n => rows.push([fmt.count(n), $m(np * n), $m(F + v * n), $m(np * n - F - v * n)]);
  for (let n = 0; n <= cap + EPS; n += 100) add(n);
  if (cap % 100) add(cap);
  if (!hide && fin(be) && be <= cap && be % 100) { add(be); rows.sort((a, b) => E.parseNumber(a[0]) - E.parseNumber(b[0])); }
  return tableHtml(['Cars', 'Revenue', 'Total cost', 'Profit'], rows, r => !hide && fin(be) && E.parseNumber(r[0]) === be);
}
function breakEvenChart(el, o = {}) {
  const c = chartShell(el, 'lg-be', o, drawBreakEven, breakEvenTable);
  const xOf = clientX => {
    const r = c.box.getBoundingClientRect(), w = r.width || 1, { cap, be } = breakEvenData(c.st);
    const xMax = fin(be) && be > cap ? Math.ceil(be * 1.12 / 100) * 100 : cap;
    const px = (clientX - r.left) * (c.w / w);
    return clamp(Math.round((px - 40) / (c.w - 46) * xMax / 10) * 10, 0, Math.floor(xMax));
  };
  const snap = m => { const { be } = breakEvenData(c.st); return fin(be) && Math.abs(m - be) <= 20 ? be : m; };
  let drag = false;
  const place = () => { c.ex.marker = snap(c.ex.marker); c.paint(); c.st.marker?.onPlace?.(c.ex.marker); };
  const setMode = () => {
    const on = !!c.st.marker;
    c.box.classList.toggle('lg-drag', on);
    if (on) { c.box.tabIndex = 0; c.box.setAttribute('role', 'slider'); c.box.setAttribute('aria-label', 'Break-even marker, cars sold'); c.box.setAttribute('aria-valuemin', 0); c.box.setAttribute('aria-valuemax', Math.floor(breakEvenData(c.st).cap)); }
    else { c.box.removeAttribute('tabindex'); c.box.removeAttribute('role'); c.box.removeAttribute('aria-label'); }
    if (on) c.box.setAttribute('aria-valuenow', c.ex.marker ?? 0);
  };
  c.box.addEventListener('pointerdown', e => { if (!c.st.marker) return; drag = true; try { c.box.setPointerCapture(e.pointerId); } catch { } c.ex.marker = xOf(e.clientX); c.paint(); e.preventDefault(); });
  c.box.addEventListener('pointermove', e => { if (!drag) return; c.ex.marker = xOf(e.clientX); c.paint(); });
  const up = () => { if (!drag) return; drag = false; place(); setMode(); };
  c.box.addEventListener('pointerup', up); c.box.addEventListener('pointercancel', up);
  c.box.addEventListener('keydown', e => {
    if (!c.st.marker) return;
    const d = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10 }[e.key];
    if (d) { const { cap } = breakEvenData(c.st); c.ex.marker = clamp((c.ex.marker ?? 1000) + d * (e.shiftKey ? 10 : 1), 0, Math.floor(cap)); c.paint(); setMode(); e.preventDefault(); }
    else if ((e.key === 'Enter' || e.key === ' ') && c.ex.marker !== undefined) { place(); setMode(); e.preventDefault(); }
  });
  setMode();
  return { update(p) { Object.assign(c.st, p); if ('marker' in p && !p.marker) c.ex.marker = undefined; setMode(); c.paint(); }, destroy: c.api.destroy };
}

// Price -> profit with capacity applied: the kink, the peak, the profitable window. o: { cfg, R, up, price, from, to, step,
// onPrice?, place?: { onPlace(p) }, hidePeak?, series?: ['profit', 'revenue', 'util'] }. `series` adds revenue (pl.sales) on
// the same money axis and the share of line time used (0-100 %) on a right-hand axis, each with an end label and a table column.
function ppRange(st) { const { price } = norm(st); let a = st.from ?? 24, b = st.to ?? 46; if (price < a) a = Math.floor(price); if (price > b) b = Math.ceil(price); return [a, b, st.step ?? 0.5]; }
const ppSeries = st => { const s = Array.isArray(st.series) && st.series.length ? st.series : ['profit']; return { profit: true, revenue: s.includes('revenue'), util: s.includes('util') }; };
// end labels at the right edge, pushed apart so they never overlap: items [{ y, text, cls }]
function endLabels(items, x, top, bot) {
  const s = items.map(it => ({ ...it, ty: clamp(it.y, top + 9, bot - 3) })).sort((p, q) => p.ty - q.ty);
  for (let i = 1; i < s.length; i++) if (s[i].ty - s[i - 1].ty < 12) s[i].ty = s[i - 1].ty + 12;
  for (let i = s.length - 1; i >= 0; i--) { if (s[i].ty > bot - 3) s[i].ty = bot - 3; if (i && s[i].ty - s[i - 1].ty < 12) s[i - 1].ty = s[i].ty - 12; }
  return `<g class="lg-halo">${s.map(it => TX(x, it.ty, it.text, it.cls, 'end')).join('')}</g>`;
}
function drawPriceProfit(w, h, st, ex) {
  const { cfg, R, up, price } = norm(st), [a, b, step] = ppRange(st), ser = ppSeries(st);
  const win = profitWindowCached(cfg, R, up), best = E.bestPrice(cfg, R, up, { from: a, to: b, step });
  const N = clamp(Math.round(w), 60, 360), ps = [];
  for (let i = 0; i <= N; i++) ps.push(a + (b - a) * i / N);
  if (win.kink > a && win.kink < b) ps.push(win.kink);
  if (fin(best.price)) ps.push(best.price);
  ps.sort((x, y) => x - y);
  const mos = ps.map(p => E.month(cfg, R, up, { price: p }));
  const pts = mos.map((mo, i) => [ps[i], mo.pl.profit]);
  const money = pts.map(p => p[1]).concat(ser.revenue ? mos.map(mo => mo.pl.sales) : []);
  let lo = Math.min(0, ...money), hi = Math.max(0, ...money);
  const span = (hi - lo) || 1; hi += span * (ser.revenue ? 0.12 : 0.22); lo -= span * 0.1;
  const P = { l: 42, r: ser.util ? 36 : 8, t: 8, b: 20 }, box = [2, w - 2];
  const X = lin(a, b, P.l, w - P.r), Y = lin(lo, hi, h - P.b, P.t), YU = lin(0, 1, h - P.b, P.t);
  const prof = p => E.profitAt(cfg, p, R, up);
  let g = '';
  const ys = niceStep(hi - lo, 5);
  for (let y = Math.ceil(lo / ys) * ys; y <= hi + EPS; y += ys) if (Math.abs(y) > EPS) g += LN(P.l, Y(y), w - P.r, Y(y), 'lg-grid') + TX(P.l - 4, Y(y) + 3.5, kMoney(y), '', 'end');
  g += TX(P.l - 4, Y(0) + 3.5, $2(0, 0), '', 'end');
  const xs = niceStep(b - a, 5);
  for (let x = Math.ceil(a / xs) * xs; x <= b + EPS; x += xs) g += TX(X(x), h - 6, $2(x, 0), '', 'middle', box);
  // the right-hand axis for the line-busy share
  if (ser.util) {
    g += LN(w - P.r, P.t, w - P.r, h - P.b, 'lg-axis');
    for (const u of [0, 0.5, 1]) g += LN(w - P.r, YU(u), w - P.r + 3, YU(u), 'lg-axis') + TX(w - 2, YU(u) + 3.5, fmt.pct(u, 0), '', 'end');
  }
  // the profitable window
  const hidePeak = (!!st.place || !!st.hidePeak) && !st.reveal; // hidePeak: a lesson asks for the best price later
  if (win.lo !== null) {
    const x0 = X(Math.max(a, win.lo)), x1 = X(Math.min(b, win.hi));
    g += `<rect x="${n1(x0)}" y="${P.t}" width="${n1(Math.max(0, x1 - x0))}" height="${n1(h - P.b - P.t)}" class="lg-a-gain"/>`;
    g += `<g class="lg-halo">${TX((x0 + x1) / 2, h - P.b - 5, `Profitable ${$2(win.lo)}–${$2(win.hi)}`, 'lg-t-gain', 'middle', [P.l + 2, w - P.r - 2])}</g>`;
  }
  g += LN(P.l, Y(0), w - P.r, Y(0), 'lg-axis');
  // the kink where capacity stops binding
  if (win.kink > a && win.kink < b) {
    const kx = X(win.kink), ky = Y(prof(win.kink)), below = ky + 15 < h - P.b - 16;
    g += LN(kx, P.t, kx, h - P.b, 'lg-kink') + DOT(kx, ky, 3, 'lg-dot-s');
    g += `<g class="lg-halo">${TX(kx + 5, below ? ky + 15 : ky - 8, `Line full below ${$2(win.kink)}`, '', 'start', box)}</g>`;
  }
  if (ser.revenue) g += PATH(mos.map((mo, i) => [X(ps[i]), Y(mo.pl.sales)]), 'lg-l-rev');
  if (ser.util) g += PATH(mos.map((mo, i) => [X(ps[i]), YU(clamp(mo.util, 0, 1))]), 'lg-l-util');
  g += PATH(pts.map(([p, y]) => [X(p), Y(y)]), 'lg-l-profit');
  const endMo = mos[mos.length - 1];
  const ends = [{ y: Y(endMo.pl.profit) - 7, text: 'Profit', cls: 'lg-t-ink' }];
  if (ser.revenue) ends.push({ y: Y(endMo.pl.sales) - 7, text: 'Revenue', cls: 'lg-t-gain' });
  if (ser.util) ends.push({ y: YU(clamp(endMo.util, 0, 1)) - 7, text: 'Line busy', cls: '' });
  g += endLabels(ends, w - P.r - 2, P.t, h - P.b);
  // the peak
  if (fin(best.price) && !hidePeak) {
    const bx = X(best.price), by = Y(best.profit);
    g += DOT(bx, by, 4.5, 'lg-dot') + `<g class="lg-halo">${TX(bx, by - 9, `${$2(best.price)} · ${$m(best.profit)}`, 'lg-t-ink', 'middle', box)}</g>`;
  }
  // the plan's price, or the learner's placed price
  const at = st.place ? ex.placed : price;
  if (fin(at)) {
    const cx = X(at), cy = Y(prof(at));
    g += st.place ? LN(cx, P.t - 4, cx, h - P.b, 'lg-mk') + `<circle cx="${n1(cx)}" cy="${n1(h - P.b)}" r="6" class="lg-mk-h"/>` + DOT(cx, cy, 4, 'lg-dot-s')
      : LN(cx, P.t, cx, h - P.b, 'lg-cur') + DOT(cx, cy, 4, 'lg-dot-s');
  }
  let read = '';
  if (fin(at)) {
    const mo = E.month(cfg, R, up, { price: at });
    read = `At <b>${esc($2(at))}</b>: ${esc(fmt.count(mo.sold))} sold · revenue ${esc($m(mo.pl.sales))} · profit <b class="${signCls(mo.pl.profit)}">${esc($m(mo.pl.profit))}</b> · line busy ${esc(fmt.pct(mo.util))}` + (mo.lostSales > EPS ? ` · ${esc(fmt.count(mo.lostSales))} orders lost` : '');
  } else if (st.place) read = 'Tap the chart to place your price.';
  const curves = ['profit', ser.revenue ? 'revenue' : '', ser.util ? 'how busy the line is (right axis, 0 to 100%)' : ''].filter(Boolean);
  const label = `Price chart from ${$2(a, 0)} to ${$2(b, 0)} showing ${joinAnd(curves).replace(' & ', ' and ')}.` + (fin(best.price) && !hidePeak ? ` Profit peaks at ${$2(best.price)} with ${$m(best.profit)}.` : '') + (win.lo !== null ? ` Profitable from ${$2(win.lo)} to ${$2(win.hi)}.` : ' No price makes a profit.');
  return { svg: SVG(w, h, g, label), read };
}
function priceProfitTable(st) {
  const { cfg, R, up, price } = norm(st), [a, b, step] = ppRange(st), ser = ppSeries(st);
  const sw = E.priceSweep(cfg, R, up, { from: a, to: b, step }), best = E.bestPrice(cfg, R, up, { from: a, to: b, step });
  const hidePeak = (!!st.place || !!st.hidePeak) && !st.reveal; // hidePeak: a lesson asks for the best price later
  return tableHtml(['Price', 'Sold', 'Revenue', 'Profit', ...(ser.util ? ['Line busy'] : []), 'Lost'],
    sw.map(r => [$2(r.price), fmt.count(r.sold), $m(r.revenue), $m(r.profit), ...(ser.util ? [fmt.pct(r.util)] : []), r.lostSales > EPS ? fmt.count(r.lostSales) : '–']),
    (r, i) => Math.abs(sw[i].price - price) < EPS || (!hidePeak && Math.abs(sw[i].price - best.price) < EPS));
}
function priceProfitChart(el, o = {}) {
  // revenue shares the money axis, so give the profit curve more height to stay readable
  const c = chartShell(el, 'lg-pp', o, drawPriceProfit, priceProfitTable, st => ppSeries(st).revenue ? (phone() ? 230 : 250) : 0);
  const pOf = clientX => {
    const r = c.box.getBoundingClientRect(), [a, b, step] = ppRange(c.st), pr = ppSeries(c.st).util ? 36 : 8; // the plot's padding, as drawPriceProfit
    const px = (clientX - r.left) * (c.w / (r.width || 1));
    return clamp(Math.round((a + (px - 42) / (c.w - 42 - pr) * (b - a)) / step) * step, a, b);
  };
  let drag = false;
  const act = () => !!(c.st.onPrice || c.st.place);
  const setP = (p, final) => {
    p = roundTo(p, 2);
    if (c.st.place) { c.ex.placed = p; c.paint(); if (final) c.st.place.onPlace?.(p); }
    else if (c.st.onPrice) {
      // the chart is an input here: it follows the pointer itself, then tells the host
      const was = norm(c.st).price;
      if (Math.abs(p - was) > EPS) { c.st.price = p; c.paint(); }
      if (final || Math.abs(p - was) > EPS) c.st.onPrice(p);
    }
    c.box.setAttribute('aria-valuenow', p); c.box.setAttribute('aria-valuetext', $2(p));
  };
  const setMode = () => {
    const on = act(); c.box.classList.toggle('lg-drag', on);
    if (on) { const [a, b] = ppRange(c.st); c.box.tabIndex = 0; c.box.setAttribute('role', 'slider'); c.box.setAttribute('aria-label', c.st.place ? 'Place your price on the chart' : 'Price'); c.box.setAttribute('aria-valuemin', a); c.box.setAttribute('aria-valuemax', b); }
    else { for (const k of ['tabindex', 'role', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) c.box.removeAttribute(k); }
  };
  c.box.addEventListener('pointerdown', e => { if (!act()) return; drag = true; try { c.box.setPointerCapture(e.pointerId); } catch { } setP(pOf(e.clientX), false); e.preventDefault(); });
  c.box.addEventListener('pointermove', e => { if (drag) setP(pOf(e.clientX), false); });
  const up = e => { if (!drag) return; drag = false; setP(pOf(e.clientX), true); };
  c.box.addEventListener('pointerup', up); c.box.addEventListener('pointercancel', () => { drag = false; });
  c.box.addEventListener('keydown', e => {
    if (!act()) return;
    const [a, b, step] = ppRange(c.st), cur = c.st.place ? (c.ex.placed ?? norm(c.st).price) : norm(c.st).price;
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d) { setP(clamp(cur + d * step, a, b), !c.st.place); e.preventDefault(); }
    else if ((e.key === 'Enter' || e.key === ' ') && c.st.place && fin(c.ex.placed)) { setP(c.ex.placed, true); e.preventDefault(); }
  });
  setMode();
  return { update(p) { Object.assign(c.st, p); if ('place' in p && !p.place) c.ex.placed = undefined; setMode(); c.paint(); }, destroy: c.api.destroy };
}

// Cash: a 21-cell ribbon per month plus the daily balance line, the zero line and the low point. o: { calendar, upTo? }
function cashCls(bal) { return bal < -EPS ? 'lg-c-neg' : bal < BANK_AMBER ? 'lg-c-low' : 'lg-c-pos'; }
function drawCash(w, h, st) {
  const cal = st.calendar;
  if (!cal || !cal.days?.length) return { svg: '', read: '' };
  const days = cal.days, N = days.length, M = cal.months || 1, D = Math.round(N / M) || 21;
  const upTo = clamp(st.upTo ?? N - 1, -1, N - 1), done = upTo >= N - 1;
  const P = { l: 44, r: 8 }, rowH = 13, rowG = 3, ribH = M * (rowH + rowG), H = h + ribH, box = [2, w - 2];
  const cw = (w - P.l - P.r) / D;
  let g = '';
  for (let m = 0; m < M; m++) {
    const y = m * (rowH + rowG);
    g += TX(P.l - 6, y + rowH - 3, 'M' + (m + 1), '', 'end');
    for (let d = 0; d < D; d++) {
      const i = m * D + d, dd = days[i]; if (!dd) continue;
      const x = P.l + d * cw, cls = i > upTo ? 'lg-c-off' : cashCls(dd.balance);
      g += `<rect x="${n1(x)}" y="${y}" width="${n1(Math.max(1, cw - 1.5))}" height="${rowH}" rx="2" class="lg-cell ${cls}${cal.firstNeg && i === cal.firstNeg.index && i <= upTo ? ' lg-c-first' : ''}"><title>${esc(`Day ${dd.day} of month ${dd.month}: ${$m(dd.balance)}`)}</title></rect>`;
      if (cw >= 13) g += TX(x + (cw - 1.5) / 2, y + rowH - 3.5, String(dd.day), 'lg-t-cell', 'middle');
    }
  }
  const top = ribH + 10, bot = H - 18;
  const bals = days.map(d => d.balance);
  let lo = Math.min(0, cal.open, ...bals), hi = Math.max(0, cal.open, ...bals);
  const span = (hi - lo) || 1; hi += span * 0.1; lo -= span * 0.16;
  const X = lin(-1, N - 1, P.l, w - P.r), Y = lin(lo, hi, bot, top);
  const ys = niceStep(hi - lo, 3);
  for (let y = Math.ceil(lo / ys) * ys; y <= hi + EPS; y += ys) if (Math.abs(y) > EPS) g += LN(P.l, Y(y), w - P.r, Y(y), 'lg-grid') + TX(P.l - 4, Y(y) + 3.5, kMoney(y), '', 'end');
  for (let m = 1; m < M; m++) g += LN(X(m * D - 0.5), top, X(m * D - 0.5), bot, 'lg-sep');
  if (M === 1) g += TX(X(0), H - 5, 'day 1', '', 'start', box) + TX(X(N - 1), H - 5, `day ${D}`, '', 'end', box);
  else for (let m = 0; m < M; m++) g += TX(X(m * D + (D - 1) / 2), H - 5, `month ${m + 1}`, '', 'middle', box);
  const pts = [[-1, cal.open], ...days.slice(0, upTo + 1).map(d => [d.index, d.balance])].map(([i, v]) => [X(i), Y(v)]);
  const y0 = Y(0), idA = uid('ca'), idB = uid('cb');
  g += `<defs><clipPath id="${idA}"><rect x="0" y="0" width="${w}" height="${n1(Math.max(0, y0))}"/></clipPath><clipPath id="${idB}"><rect x="0" y="${n1(y0)}" width="${w}" height="${n1(Math.max(0, H - y0))}"/></clipPath></defs>`;
  if (pts.length > 1) {
    const area = [[pts[0][0], y0], ...pts, [pts[pts.length - 1][0], y0]];
    g += POLY(area, 'lg-a-gain', `clip-path="url(#${idA})"`) + POLY(area, 'lg-a-loss', `clip-path="url(#${idB})"`);
  }
  g += LN(P.l, y0, w - P.r, y0, 'lg-zero') + TX(P.l - 4, y0 + 3.5, $2(0, 0), '', 'end');
  g += PATH(pts, 'lg-l-cash');
  let lowBox = null;
  if (cal.lowAt && cal.lowAt.index <= upTo) {
    const lx = X(cal.lowAt.index), ly = Y(cal.low), txt = `Low ${$m(cal.low)} · ${dayName(cal.lowAt)}`;
    const anchor = lx < w * 0.36 ? 'start' : lx > w * 0.64 ? 'end' : 'middle', below = ly + 15 <= bot + 4;
    const ty = below ? ly + 15 : ly - 8;
    g += DOT(lx, ly, 4.5, 'lg-dot') + `<g class="lg-halo">${TX(anchor === 'start' ? lx - 4 : anchor === 'end' ? lx + 4 : lx, ty, txt, cal.low < -EPS ? 'lg-t-loss' : 'lg-t-ink', anchor, box)}</g>`;
    const tw = txt.length * CW, x0 = anchor === 'start' ? lx - 4 : anchor === 'end' ? lx + 4 - tw : lx - tw / 2;
    lowBox = [x0, ty - 10, x0 + tw, ty + 2];
  }
  const lastP = pts[pts.length - 1], lastV = upTo >= 0 ? days[upTo].balance : cal.open;
  if (pts.length > 1) {
    const txt = `${done ? 'End' : 'Now'} ${$m(lastV)}`, tw = txt.length * CW;
    const ty = lastP[1] - 7 < top + 4 ? lastP[1] + 14 : lastP[1] - 7;
    const bx = [w - P.r - 2 - tw, ty - 10, w - P.r - 2, ty + 2];
    const hit = lowBox && !(bx[2] < lowBox[0] || bx[0] > lowBox[2] || bx[3] < lowBox[1] || bx[1] > lowBox[3]);
    if (!hit && cal.lowAt?.index !== upTo && !(lowBox && Math.abs(lastV - cal.low) < 0.5)) g += `<g class="lg-halo">${TX(w - P.r - 2, ty, txt, lastV < -EPS ? 'lg-t-loss' : 'lg-t-ink', 'end')}</g>`;
  }
  const end = days[N - 1].balance;
  // while a replay is still drawing, say only what has happened so far
  if (!done) {
    const now = upTo >= 0 ? days[upTo] : null;
    const read = `Opening <b>${esc($m(cal.open))}</b>` + (now ? ` · day ${esc(fmt.count(now.day))} of month ${esc(fmt.count(now.month))}: bank <b class="${signCls(now.balance)}">${esc($m(now.balance))}</b>` : '');
    return { svg: SVG(w, H, g, `Cash calendar, opening ${$m(cal.open)}` + (now ? `, ${dayName(now)}: ${$m(now.balance)}` : '')), read };
  }
  const read = `Opening <b>${esc($m(cal.open))}</b> · lowest <b class="${signCls(cal.low)}">${esc($m(cal.low))}</b>${cal.lowAt ? ` (${esc(dayName(cal.lowAt))})` : ''} · end <b class="${signCls(end)}">${esc($m(end))}</b>` + (cal.firstNeg ? ` · out of cash on ${esc(dayName(cal.firstNeg))}` : ` · never below ${esc($2(0, 0))}`);
  const label = `Cash calendar over ${plural(M, 'month', 'months')}: opening ${$m(cal.open)}, lowest ${$m(cal.low)}${cal.lowAt ? ' on ' + dayName(cal.lowAt) : ''}, end ${$m(end)}.`;
  return { svg: SVG(w, H, g, label), read };
}
function cashTable(st) {
  const cal = st.calendar; if (!cal) return '';
  const upTo = st.upTo ?? cal.days.length - 1;
  const rows = cal.days.filter(d => d.index <= upTo).map(d => {
    const inn = d.items.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0), out = d.items.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0);
    return [fmt.count(d.month), fmt.count(d.day), inn ? $m(inn) : '–', out ? $m(out) : '–', $m(d.balance)];
  });
  const done = upTo >= cal.days.length - 1;
  return tableHtml(['Month', 'Day', 'In', 'Out', 'Balance'], rows, (r, i) => done && (cal.firstNeg?.index === i || cal.lowAt?.index === i));
}
function cashChart(el, o = {}) {
  const c = chartShell(el, 'lg-cash', o, drawCash, cashTable);
  return { update: c.api.update, destroy: c.api.destroy };
}

// The parked sample cars (SPEC §2.10). o: { R, up, price, cars?, onPick?(row) }
function orderMixTable(el, o = {}) {
  const root = mountW(el, 'lg-mix');
  let st = { ...o }, rows = [], last = '';
  const open = new Set();
  root.addEventListener('click', e => {
    const b = e.target.closest('.lg-rowb'); if (!b) return;
    const i = +b.dataset.i, on = b.getAttribute('aria-expanded') !== 'true';
    on ? open.add(i) : open.delete(i);
    b.setAttribute('aria-expanded', on); root.querySelector(`tr[data-det="${i}"]`).hidden = !on;
    if (on) st.onPick?.(rows[i]);
  });
  function paint() {
    const { R, up, price } = norm(st);
    rows = E.orderMix(st.cars || undefined, R, up, price);
    const key = JSON.stringify([rows.map(r => [r.name, roundTo(r.contribution, 4), roundTo(r.started, 4)]), price]);
    if (key === last) return; last = key;
    const max = Math.max(...rows.map(r => Math.abs(r.contribution)), EPS);
    root.innerHTML = `<div class="lg-tblwrap" style="max-height:none"><table class="lg-tbl"><caption class="lg-vh">Order mix at ${esc($2(price))}</caption>
      <thead><tr><th scope="col">Car</th><th scope="col">Cycle</th><th scope="col">Started</th><th scope="col">Contrib.</th></tr></thead><tbody>${rows.map((r, i) => `
      <tr><th scope="row"><button type="button" class="lg-rowb" data-i="${i}" aria-expanded="${open.has(i)}">${esc(r.name)}<small>${esc(carLabel(r.cfg))}</small></button></th>
        <td>${esc(fmt.min(r.cycle))}</td><td>${esc($2(r.started))}</td><td class="${signCls(r.contribution)}">${esc($2(r.contribution))}<span class="lg-cbar ${r.contribution < 0 ? 'lg-neg' : ''}" style="width:${n1(Math.abs(r.contribution) / max * 100)}%"></span></td></tr>
      <tr class="lg-det" data-det="${i}" ${open.has(i) ? '' : 'hidden'}><td colspan="4">Materials ${esc($2(r.materials))} · minutes ${esc(r.m.map(x => fmt.min(x)).join(' / '))} · bottleneck ${esc(stationNames(r.bottAll))} ${esc(fmt.min(r.bott))} · cycle ${esc(fmt.min(r.cycle))} · variable ${esc($2(r.variable))} · contribution ${esc($2(r.contribution))} at ${esc($2(price))}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  paint();
  return { update(p) { Object.assign(st, p); paint(); }, destroy() { root.remove(); } };
}

// The fixed bills. o: { R, up }
function fixedCosts(el, o = {}) {
  const root = mountW(el, 'lg-fixed');
  let st = { ...o };
  function paint() {
    const { R, up } = norm(st);
    const items = E.FIXED_ITEMS.map(([id, label]) => [label, R.fixed[id]]);
    if (up.lamp) items.push([E.UPGRADES.lamp.label, E.UPGRADES.lamp.fixed]);
    if (up.autofeed) items.push([E.UPGRADES.autofeed.label + ' lease', E.UPGRADES.autofeed.fixed]);
    root.innerHTML = `<p class="lg-h4">Fixed bills · due on day 1 of each month</p><ul class="lg-list">${items.map(([l, v]) => `<li><span>${esc(l)}</span><span class="lg-num">${esc($2(v, 0))}</span></li>`).join('')}
      <li class="lg-tot"><span>Total a month</span><span class="lg-num">${esc($2(E.fixedTotal(R, up), 0))}</span></li></ul>`;
  }
  paint();
  return { update(p) { Object.assign(st, p); paint(); }, destroy() { root.remove(); } };
}

// Markup and margin side by side on one price tag. o: { cost, value? (start price), onChange({ markup, margin, price, moved }) }
function markupCalc(el, o = {}) {
  const root = mountW(el, 'lg-mkc'), ida = uid('mu'), idb = uid('mg');
  let st = { ...o };
  let price = fin(o.value) ? o.value : E.r2(st.cost * 1.25);
  root.innerHTML = `<div class="lg-mk-tag"><span>Full cost <b class="lg-cost"></b></span><span>Price <b class="lg-price"></b></span></div>
    <div class="lg-mk-two"><div class="lg-slider"><div class="lg-sl-top"><label for="${ida}">Markup</label><output class="lg-num" for="${ida}"></output></div><input id="${ida}" class="lg-range" type="range" min="0" max="100" step="1"><div class="lg-sl-read">profit ÷ cost</div></div>
    <div class="lg-slider"><div class="lg-sl-top"><label for="${idb}">Margin</label><output class="lg-num" for="${idb}"></output></div><input id="${idb}" class="lg-range" type="range" min="0" max="50" step="1"><div class="lg-sl-read">profit ÷ price</div></div></div>
    <p class="lg-note lg-mk-read"></p>`;
  const [ia, ib] = root.querySelectorAll('input'), [oa, ob] = root.querySelectorAll('output');
  const show = moved => {
    const cost = st.cost, mu = E.markupOf(price, cost), mg = E.marginOf(price, cost);
    root.querySelector('.lg-cost').textContent = $2(cost); root.querySelector('.lg-price').textContent = $2(price);
    oa.textContent = fmt.pct(mu); ob.textContent = fmt.pct(mg);
    if (moved !== 'markup') ia.value = roundTo(mu * 100, 0);
    if (moved !== 'margin') ib.value = roundTo(mg * 100, 0);
    // no live region: each slider says its value and the price it makes
    ia.setAttribute('aria-valuetext', `${fmt.pct(mu)} markup: price ${$2(price)}, margin ${fmt.pct(mg)}`);
    ib.setAttribute('aria-valuetext', `${fmt.pct(mg)} margin: price ${$2(price)}, markup ${fmt.pct(mu)}`);
    root.querySelector('.lg-mk-read').textContent = `Profit ${$2(price - cost)} a car: ${fmt.pct(mu)} of the cost, but only ${fmt.pct(mg)} of the price.`;
    return { markup: mu, margin: mg };
  };
  ia.addEventListener('input', () => { price = st.cost * (1 + ia.value / 100); const r = show('markup'); st.onChange?.({ ...r, price, moved: 'markup' }); });
  ib.addEventListener('input', () => { price = E.priceForMargin(st.cost, ib.value / 100); const r = show('margin'); st.onChange?.({ ...r, price, moved: 'margin' }); });
  show();
  return {
    update(p) { const keep = fin(st.cost) && fin(p.cost) && st.cost > 0 ? E.markupOf(price, st.cost) : null; Object.assign(st, p); if (fin(p.value)) price = p.value; else if (keep !== null) price = st.cost * (1 + keep); show(); },
    destroy() { root.remove(); }
  };
}

export const widgets = {
  costSheet, whereBar, volumeSlider, plTable, breakEvenChart, priceProfitChart, priceSlider, markupCalc, cashChart, orderMixTable, fixedCosts
};

/* ======================================================================================================== */
/* ---------- CSV (SPEC §4.11): section,item,value,unit,how; the cash calendar is month,day,item,in,out,balance ---------- */
const csvCell = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const csvNum = (v, unit) => !fin(v) ? '' : unit === '%' ? roundTo(v, 1).toFixed(1) : unit === 'cars' ? String(roundTo(v, 1)) : roundTo(v, 2).toFixed(2);
export function buildCsv(kind, o = {}) {
  const { cfg, R, up, price, sold } = norm(o);
  const head = ['section', 'item', 'value', 'unit', 'how'];
  if (kind === 'costSheet') {
    const cl = E.costLines(cfg, R, up, { price, sold });
    const rows = [head, ['order', 'Car', '', '', carLabel(cfg)]];
    for (const l of cl.lines) if (l.section !== 'pl') rows.push([l.section, l.label, csvNum(l.value, l.unit), l.unit, l.how]);
    return { filename: o.wo ? `toyline-cost-sheet-${o.wo}.csv` : 'toyline-cost-sheet.csv', text: csv(rows), mime: 'text/csv' };
  }
  if (kind === 'month') {
    const cl = E.costLines(cfg, R, up, { price, sold }), mo = cl.month;
    const rows = [head, ['order', 'Car', '', '', carLabel(cfg)],
      ['month', 'Price', csvNum(mo.price, '$'), '$', 'set by you'],
      ['month', 'Shops order', csvNum(mo.Q, 'cars'), 'cars', `${fmt.count(R.demandIntercept)} − ${fmt.count(R.demandSlope)} × ${$2(mo.price)}`],
      ['month', 'Capacity (good cars)', csvNum(mo.capGood, 'cars'), 'cars', `${fmt.count(R.available)} min ÷ ${fmt.min(mo.car.cycle)} min × ${R.scrapEvery - 1} ÷ ${R.scrapEvery}`],
      ['month', 'Cars sold', csvNum(mo.sold, 'cars'), 'cars', sold !== undefined ? 'set by you' : 'the smaller of orders and capacity'],
      ['month', 'Cars started', csvNum(mo.startedN, 'cars'), 'cars', `${fmt.count(mo.sold)} × ${R.scrapEvery} ÷ ${R.scrapEvery - 1}`],
      ['month', 'Line minutes', csvNum(mo.lineMin, 'cars'), 'min', `${fmt.count(mo.startedN)} × ${fmt.min(mo.car.cycle)} min`]];
    for (const l of cl.lines) if (l.section === 'pl') rows.push(['pl', l.label, csvNum(l.value, l.unit), l.unit, l.how]);
    rows.push(['memo', 'Scrap, already inside the lines above', csvNum(mo.pl.scrapMemo, '$'), '$', `${fmt.count(mo.scrapped)} × ${$2(mo.car.started)}`]);
    rows.push(['month', 'Break-even', csvNum(mo.breakEven, 'cars'), 'cars', `${$2(mo.F, 0)} ÷ ${$2(mo.perCar.contribution)}, rounded up`]);
    return { filename: 'toyline-month-plan.csv', text: csv(rows), mime: 'text/csv' };
  }
  if (kind === 'cash') {
    const p = o.plan || {};
    const R2 = E.rules({ ...R, shopTerms: p.shopTerms ?? R.shopTerms, supplierCredit: p.supplierCredit ?? R.supplierCredit });
    const cal = o.calendar || E.cashCalendar(cfg, R2, up, { months: p.months ?? R.months ?? 1, open: p.open ?? R.openingCash, price });
    const rows = [['month', 'day', 'item', 'in', 'out', 'balance'], ['1', '0', 'Opening cash', '', '', csvNum(cal.open, '$')]];
    let bal = cal.open;
    for (const d of cal.days) {
      if (!d.items.length) { rows.push([d.month, d.day, 'No money moved', '', '', csvNum(bal, '$')]); continue; }
      for (const it of d.items) { bal += it.amount; rows.push([d.month, d.day, it.item, it.amount > 0 ? csvNum(it.amount, '$') : '', it.amount < 0 ? csvNum(-it.amount, '$') : '', csvNum(bal, '$')]); }
    }
    return { filename: 'toyline-cash-calendar.csv', text: csv(rows), mime: 'text/csv' };
  }
  if (kind === 'breakEven') {
    const mo = E.month(cfg, R, up, { price, sold }), F = mo.F, v = mo.car.variable, np = mo.netPrice;
    const rows = [head];
    const steps = []; for (let n = 0; n <= mo.capGood + EPS; n += 100) steps.push(n);
    for (const n of steps) {
      const c = fmt.count(n);
      rows.push([`${c} cars`, 'Revenue', csvNum(np * n, '$'), '$', `${c} × ${$2(np)}`]);
      rows.push([`${c} cars`, 'Total cost', csvNum(F + v * n, '$'), '$', `${$2(F, 0)} + ${c} × ${$2(v)}`]);
      rows.push([`${c} cars`, 'Profit', csvNum(np * n - F - v * n, '$'), '$', `${c} × ${$2(np - v)} − ${$2(F, 0)}`]);
    }
    rows.push(['breakEven', 'Break-even', csvNum(mo.breakEven, 'cars'), 'cars', `${$2(F, 0)} ÷ ${$2(np - v)}, rounded up`]);
    return { filename: 'toyline-break-even.csv', text: csv(rows), mime: 'text/csv' };
  }
  if (kind === 'orderMix') {
    const rows = [head];
    for (const r of E.orderMix(o.cars || undefined, R, up, price)) {
      rows.push([r.name, 'Options', '', '', carLabel(r.cfg)]);
      rows.push([r.name, 'Materials', csvNum(r.materials, '$'), '$', 'sum of its parts']);
      rows.push([r.name, 'Minutes B/C/S/P/L/W/D', r.m.map(x => fmt.min(x)).join('/'), 'min', 'station minutes']);
      rows.push([r.name, 'Bottleneck', fmt.min(r.bott), 'min', stationNames(r.bottAll)]);
      rows.push([r.name, 'Cycle', csvNum(r.cycle, 'cars'), 'min', `${fmt.min(R.moveMin)} + ${fmt.min(r.bott)}`]);
      rows.push([r.name, 'Started car', csvNum(r.started, '$'), '$', 'materials + crew + power + consumables']);
      rows.push([r.name, 'Variable cost per car sold', csvNum(r.variable, '$'), '$', `${$2(r.started)} × ${R.scrapEvery} ÷ ${R.scrapEvery - 1} + ${$2(R.carton)} + ${$2(R.freight)}`]);
      rows.push([r.name, 'Contribution', csvNum(r.contribution, '$'), '$', `${$2(E.netPrice(price, R))} − ${$2(r.variable)}`]);
    }
    return { filename: 'toyline-order-mix.csv', text: csv(rows), mime: 'text/csv' };
  }
  throw new Error('Unknown CSV kind ' + kind);
}

/* ======================================================================================================== */
/* ---------- the Ledger tab ---------- */
const D0 = E.rules();
// supplier credit defers every material and the cartons (econ.cashCalendar), so the copy names them all
const creditText = R => `All materials (birch, paint, ink, wheels, kits, trim) and cartons paid ${fmt.count(R.daysPerMonth)} working days after use`;
// Factory floor editable rules (SPEC §2.2). Values in the rules object; `ui`/`back` convert for the input.
const RULES = [
  { id: 'price', label: 'Price per car', note: '$ a car', step: 0.5, min: 1, max: 100, def: D0.price, show: v => $2(v) },
  { id: 'wageHourly', label: 'Operator wage', note: '$ an hour', step: 0.1, min: 1, max: 200, def: D0.wageHourly, show: v => $2(v) },
  { id: 'onCostRate', label: 'On-costs on the wage', note: '%', step: 1, min: 0, max: 200, def: D0.onCostRate, ui: v => roundTo(v * 100, 1), back: v => v / 100, show: v => fmt.pct(v, 0) },
  { id: 'birchFactor', label: 'Birch price', note: '± % on the catalogue', step: 5, min: -90, max: 400, def: 1, ui: v => roundTo((v - 1) * 100, 1), back: v => 1 + v / 100, show: v => (v >= 1 ? '+' : '') + fmt.pct(v - 1, 0) },
  { id: 'rent', label: 'Workshop rent', note: '$ a month', step: 100, min: 0, max: 100000, def: D0.fixed.rent, get: R => R.fixed.rent, show: v => $m(v) },
  { id: 'scrapEvery', label: 'Scrap: 1 car in', kind: 'select', options: [[10, '10'], [20, '20'], [25, '25'], [50, '50']], def: D0.scrapEvery, show: v => '1 in ' + v },
  { id: 'openingCash', label: 'Opening cash', note: '$', step: 1000, min: 0, max: 10000000, def: D0.openingCash, show: v => $m(v) },
  { id: 'shopTerms', label: 'Shop terms', kind: 'select', options: [['net30', 'Net 30'], ['early', '2% off, 10 days']], def: D0.shopTerms, show: v => v === 'early' ? '2% off, 10 days' : 'Net 30' },
  { id: 'supplierCredit', label: 'Supplier credit', kind: 'check', text: creditText(D0), def: D0.supplierCredit, show: v => v ? 'on' : 'off' },
  { id: 'months', label: 'Months to run', kind: 'select', options: [[1, '1'], [3, '3']], def: D0.months, show: v => String(v) }
];
const ruleVal = (r, R, price) => r.id === 'price' ? price : r.get ? r.get(R) : R[r.id];
const ovFromRule = (ov, r, v) => { const o = { ...ov, fixed: { ...(ov.fixed || {}) } }; if (r.id === 'rent') o.fixed.rent = v; else o[r.id] = v; if (r.id === 'rent' && v === r.def) delete o.fixed.rent; else if (r.id !== 'rent' && v === r.def) delete o[r.id]; if (!Object.keys(o.fixed).length) delete o.fixed; return o; };

export function mountLedger({ engine, app, econ, platform, tutor, pane } = {}) {
  ensureCss();
  pane = pane || document.getElementById('paneLedger');
  if (!pane) throw new Error('mountLedger: no pane');
  const tut = tutor || { available: () => false };
  const plat = platform || {};
  const subs = [];
  // factoryCfg: the Factory floor's own order (saved as progress.factory.cfg); cfgHold: ignore order changes made while
  // entering Factory floor (a lesson's teardown resets the form) so they are never saved as the learner's order
  const S = { sold: null, plan: null, factoryOv: {}, factoryCfg: null, cfgHold: false, cfgDirty: false, cfgT: 0, lastR: null, ask: null, raf: 0, actT: 0, exportMsg: '' };
  // in a challenge the challenge's levers own the price and the cash plan: the Ledger shows them read-only
  const challengeLock = () => app.state.mode === 'challenges' && !!app.state.scenario?.locked;
  const tutorOk = () => { try { return !!tut.available?.(); } catch { return false; } };
  const engineCfg = () => { try { const c = engine?.cfg; if (c && E.CATALOG.body[c.body]) { E.carCost(c); return c; } } catch { } return { ...E.DEFAULT_CAR }; };
  const ctx = () => { const s = app.state, R = s.R || E.R0; return { cfg: engineCfg(), R, up: s.up || E.NO_UPGRADES, price: fin(s.price) ? s.price : R.price }; };
  const snapshot = (c, extra = {}) => { let d = {}; try { d = tut.snapshot?.(c) || {}; } catch { } return { ...d, ...extra }; };
  const askInto = (host, req) => { if (!host) return; try { S.ask?.stop?.(); } catch { } try { S.ask = tut.ask?.(host, req) || null; } catch (e) { console.warn('[ledger] tutor.ask failed', e); } };

  pane.classList.add('lg-pane');
  pane.innerHTML = `
    <div class="lg-pin" data-layer="volume"><div data-part="where"></div></div>
    <div class="lg-pinkey" data-layer="volume" data-part="key"></div>
    <details class="lg-sec" data-part="rulesSec"><summary><h3>Factory floor rules</h3><span class="lg-sum" data-sum="rules"></span></summary><div class="lg-body"><div class="lg-rules" data-part="rules"></div></div></details>
    <details class="lg-sec" open data-layer="ledger" data-part="costSec"><summary><h3>Cost sheet</h3><span class="lg-sum" data-sum="cost"></span></summary><div class="lg-body">
      <p class="lg-car" data-part="car"></p><div data-part="cost"></div>
      <details class="lg-sub2" data-layer="markup"><summary>Markup and margin</summary><div data-part="markup"></div></details></div></details>
    <details class="lg-sec" open data-layer="ledger" data-part="monthSec"><summary><h3>Month</h3><span class="lg-sum" data-sum="month"></span></summary><div class="lg-body">
      <p class="lg-lock" data-part="priceLock" hidden>The challenge's own levers set the price. Change it on the Challenge tab.</p>
      <div data-layer="price" data-part="price"></div>
      <div data-layer="volume" class="lg-act"><div data-part="vol"></div><p class="lg-note" data-part="volNote"></p></div>
      <div data-layer="volume" data-part="pl"></div>
      <div data-layer="volume" data-part="cap"></div>
      <div data-part="fixed"></div>
      <details class="lg-sub2"><summary>Rules of this factory</summary><div class="lg-note" data-part="rulesCard"></div></details></div></details>
    <details class="lg-sec" open data-layer="breakeven" data-part="beSec"><summary><h3>Break-even</h3><span class="lg-sum" data-sum="be"></span></summary><div class="lg-body"><div data-part="be"></div></div></details>
    <details class="lg-sec" open data-layer="price" data-part="ppSec"><summary><h3>Price → profit</h3><span class="lg-sum" data-sum="pp"></span></summary><div class="lg-body"><div data-part="pp"></div></div></details>
    <details class="lg-sec" open data-layer="bank" data-part="cashSec"><summary><h3>Cash</h3><span class="lg-sum" data-sum="cash"></span></summary><div class="lg-body">
      <p class="lg-lock" data-part="planLock" hidden>The challenge's own levers set the price and the cash plan. Change them on the Challenge tab.</p>
      <div class="lg-plan" data-part="plan"></div>
      <div data-layer="price" data-part="cashPrice"></div>
      <p class="lg-mini" data-part="mini"></p>
      <div data-part="cash"></div>
      <p class="lg-note" data-part="least"></p>
      <button type="button" class="lg-btn lg-primary" data-act="run">Run the month</button></div></details>
    <details class="lg-sec" open data-layer="breakeven" data-part="mixSec"><summary><h3>Order mix</h3><span class="lg-sum" data-sum="mix"></span></summary><div class="lg-body"><p class="lg-note" data-part="mixNote"></p><div data-part="mix"></div></div></details>
    <details class="lg-sec" open data-layer="ledger" data-part="actSec"><summary><h3>Session actuals</h3><span class="lg-sum" data-sum="act"></span></summary><div class="lg-body" data-part="actuals"></div></details>
    <details class="lg-sec" data-part="askSec"><summary><h3>Ask the accountant</h3></summary><div class="lg-body">
      <form class="lg-ask" data-part="askForm"><label class="lg-vh" for="${uid('askq')}">Your question</label><input class="lg-in" type="text" maxlength="200" placeholder="Ask about any number here" data-part="askIn"><button type="submit" class="lg-btn">Ask</button></form>
      <div class="lg-bub" data-part="askBub"></div></div></details>
    <details class="lg-sec" data-part="glossSec"><summary><h3>Glossary</h3><span class="lg-sum" data-sum="gloss"></span></summary><div class="lg-body lg-gloss" data-part="gloss"></div></details>
    <details class="lg-sec" open data-layer="ledger" data-part="exportSec"><summary><h3>Export</h3><span class="lg-sum">CSV</span></summary><div class="lg-body" data-part="export"></div></details>`;
  const part = n => pane.querySelector(`[data-part="${n}"]`);
  const sum = (n, t) => { const e = pane.querySelector(`[data-sum="${n}"]`); if (e && e.textContent !== t) e.textContent = t; };
  { const lab = pane.querySelector('[data-part="askForm"] label'), inp = part('askIn'); inp.id = lab.htmlFor; }

  // keep the pinned bar under the sticky tab bar
  const tabsEl = document.getElementById('tabs');
  const setTabsH = () => { const h = tabsEl ? tabsEl.offsetHeight : 0; if (h) pane.style.setProperty('--lg-tabs-h', h + 'px'); };
  let tabsRO = null; try { if (tabsEl) { tabsRO = new ResizeObserver(setTabsH); tabsRO.observe(tabsEl); } } catch { }
  setTabsH();

  /* ----- widgets in the tab ----- */
  const c0 = ctx();
  const W = {};
  W.where = whereBar(part('where'), { ...c0, legendEl: part('key') });
  W.cost = costSheet(part('cost'), { ...c0, onExplain: (id, host, line) => {
    const c = ctx(); let line2 = null; try { line2 = E.explainLine(id, c.cfg, c.R, c.up, { price: c.price, sold: S.sold ?? undefined }); } catch { }
    askInto(host, { kind: 'explain', question: `Explain the "${line.label}" line: ${line.how} = ${valText(line.value, line.unit)}.`, data: snapshot(c, { line: line2 || line }), reveal: true });
  } });
  W.markup = markupCalc(part('markup'), { cost: E.month(c0.cfg, c0.R, c0.up, { price: c0.price }).perCar.fullCost });
  W.price = priceSlider(part('price'), { ...c0, value: c0.price, from: 20, to: 50, step: 0.5, readout: true, onInput: p => setPrice(p) });
  W.vol = volumeSlider(part('vol'), { min: 100, max: 2394, value: 1900, step: 1, label: 'Cars sold a month', onInput: n => { S.sold = n; schedule(); } });
  W.pl = plTable(part('pl'), c0);
  W.fixed = fixedCosts(part('fixed'), c0);
  W.be = breakEvenChart(part('be'), c0);
  W.pp = priceProfitChart(part('pp'), { ...c0, onPrice: p => setPrice(p) });
  W.cashPrice = priceSlider(part('cashPrice'), { ...c0, value: c0.price, from: 20, to: 50, step: 0.5, readout: true, onInput: p => setPrice(p) });
  W.cash = cashChart(part('cash'), { calendar: null });
  W.mix = orderMixTable(part('mix'), c0);

  /* ----- prices, volume, the plan ----- */
  function setPrice(p) {
    if (challengeLock()) { schedule(); return; } // the challenge's levers own the price
    p = roundTo(p, 2); S.sold = null;
    if (app.state.mode === 'factory') applyFactory({ ...S.factoryOv, price: p });
    else app.set({ price: p });
  }
  const seedPlan = () => { const s = app.state, R = s.R || E.R0, sc = s.scenario || {}; return { open: fin(sc.open) ? sc.open : R.openingCash, shopTerms: R.shopTerms, supplierCredit: !!R.supplierCredit, months: fin(sc.months) ? sc.months : (R.months || 1) }; };
  function getPlan() {
    const s = app.state, R = s.R || E.R0;
    if (s.mode === 'factory') return { open: R.openingCash, shopTerms: R.shopTerms, supplierCredit: !!R.supplierCredit, months: R.months || 1 };
    return S.plan || (S.plan = seedPlan());
  }
  function setPlan(patch) {
    if (challengeLock()) { schedule(); return; } // the challenge's levers own the cash plan
    if (app.state.mode === 'factory') {
      let ov = S.factoryOv;
      const map = { open: 'openingCash', shopTerms: 'shopTerms', supplierCredit: 'supplierCredit', months: 'months' };
      for (const [k, v] of Object.entries(patch)) ov = ovFromRule(ov, RULES.find(r => r.id === map[k]), v);
      applyFactory(ov);
    } else { S.plan = { ...getPlan(), ...patch }; schedule(); }
  }
  const planRules = (c, p) => E.rules({ ...c.R, shopTerms: p.shopTerms, supplierCredit: p.supplierCredit, openingCash: p.open, months: p.months });
  const planCalendar = (c, p) => E.cashCalendar(c.cfg, planRules(c, p), c.up, { months: p.months, open: p.open, price: c.price });

  /* ----- Factory floor rules editor ----- */
  // Factory floor runs on its own rules only: the saved overrides (or the defaults), the saved or default price, and no
  // upgrades (they belong to C3), so nothing a challenge or lesson set can leak in. Reset to defaults comes through here too.
  function applyFactory(ov, save = true) {
    S.factoryOv = ov || {};
    const R = E.rules(S.factoryOv), price = fin(S.factoryOv.price) ? S.factoryOv.price : D0.price;
    S.lastR = R; S.sold = null;
    const patch = { R, price };
    if (!noUpgrades(app.state.up)) patch.up = { ...E.NO_UPGRADES };
    app.set(patch);
    if (save) { try { plat.store?.save?.({ factory: { rules: S.factoryOv, updatedAt: Date.now() } }); } catch { } }
  }
  // the Factory floor's order: put the saved one (or the default car) back on the form once the mode switch has settled
  function restoreFactoryCfg() {
    S.cfgHold = true; clearTimeout(S.cfgT);
    S.cfgT = setTimeout(() => {
      S.cfgT = 0;
      if (app.state.mode === 'factory') { try { engine?.setCfg?.({ ...(S.factoryCfg || E.DEFAULT_CAR) }); } catch (e) { console.warn('[ledger] setCfg failed', e); } }
      S.cfgHold = false;
    }, 0);
  }
  function onOrderChanged(d) {
    schedule();
    if (app.state.mode !== 'factory' || S.cfgHold) return;
    const cfg = d?.cfg || engine?.cfg;
    if (!validCfg(cfg)) return;
    S.factoryCfg = { ...cfg }; S.cfgDirty = true;
    try { plat.store?.save?.({ factory: { cfg: { ...cfg }, updatedAt: Date.now() } }); } catch { }
  }
  function renderRules() {
    const host = part('rules'), s = app.state, R = s.R || E.R0, price = fin(s.price) ? s.price : R.price;
    if (!host.dataset.built) {
      host.dataset.built = '1';
      host.innerHTML = RULES.map(r => {
        const id = uid('rule');
        const ctl = r.kind === 'select' ? `<select class="lg-in" id="${id}" data-rule="${r.id}">${r.options.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select>`
          : r.kind === 'check' ? `<label class="lg-check"><input type="checkbox" id="${id}" data-rule="${r.id}"><span class="lg-vh">${esc(r.text)}</span></label>`
          : `<input class="lg-in" id="${id}" data-rule="${r.id}" type="number" inputmode="decimal" step="${r.step}" min="${r.min}" max="${r.max}">`;
        return `<div class="lg-rule" data-row="${r.id}"><label for="${id}">${esc(r.label)}<small data-def="${r.id}"></small></label>${ctl}<button type="button" class="lg-btn lg-small" data-reset="${r.id}" aria-label="Reset ${esc(r.label.toLowerCase())}">Reset</button></div>`;
      }).join('') + `<p class="lg-note" data-part="rulesDerived"></p><button type="button" class="lg-btn" data-act="resetAll">Reset to defaults</button>`;
      host.addEventListener('change', e => {
        const t = e.target.closest('[data-rule]'); if (!t) return;
        const r = RULES.find(x => x.id === t.dataset.rule);
        let v;
        if (r.kind === 'check') v = t.checked;
        else if (r.kind === 'select') v = typeof r.def === 'number' ? +t.value : t.value;
        else { const n = E.parseNumber(t.value); if (n === null) { renderRules(); return; } v = clamp(n, r.min, r.max); if (r.back) v = r.back(v); v = roundTo(v, 6); }
        applyFactory(ovFromRule(S.factoryOv, r, v));
      });
      host.addEventListener('click', e => {
        const b = e.target.closest('[data-reset]');
        if (b) { const r = RULES.find(x => x.id === b.dataset.reset); applyFactory(ovFromRule(S.factoryOv, r, r.def)); return; }
        if (e.target.closest('[data-act="resetAll"]')) applyFactory({});
      });
    }
    let edited = 0;
    for (const r of RULES) {
      const v = ruleVal(r, R, price), t = host.querySelector(`[data-rule="${r.id}"]`), row = host.querySelector(`[data-row="${r.id}"]`);
      const isDef = typeof r.def === 'number' ? Math.abs(v - r.def) < 1e-9 : v === r.def;
      if (!isDef) edited++;
      row.classList.toggle('lg-edited', !isDef);
      host.querySelector(`[data-reset="${r.id}"]`).disabled = isDef;
      host.querySelector(`[data-def="${r.id}"]`).textContent = isDef ? `${r.note ? r.note + ' · ' : ''}default` : `default ${r.show(r.def)}`;
      if (document.activeElement === t) continue;
      if (r.kind === 'check') t.checked = !!v; else t.value = r.ui ? r.ui(v) : v;
    }
    const k = E.carCost(engineCfg(), R, s.up || E.NO_UPGRADES);
    // fmt.rate keeps 4 decimals when a rate is not whole cents ($0.6250), so 8 × rate + power adds up to the line rate shown
    host.querySelector('[data-part="rulesDerived"]').textContent = `With these rules a worker costs ${$2(R.labourHourly)} an hour, ${fmt.rate(R.labourPerMin)} a minute; the running line costs ${fmt.rate(k.lineRate)} a minute; fixed bills come to ${$m(E.fixedTotal(R, s.up))} a month.`;
    sum('rules', edited ? `${fmt.count(edited)} changed` : 'defaults');
  }

  /* ----- section renderers ----- */
  function renderCapacity(mo, c) {
    const host = part('cap'), top = Math.max(mo.Q, mo.capGood, mo.sold) || 1;
    const lost = mo.lostSales;
    host.innerHTML = `<div class="lg-cap"><p class="lg-h4">Capacity</p>
      <div class="lg-cap-bar" role="img" aria-label="${esc(`${fmt.count(mo.sold)} of ${fmt.count(mo.capGood)} good cars the line can make`)}"><span class="lg-cap-sold" style="width:${n1(mo.sold / top * 100)}%"></span>${lost > EPS ? `<span class="lg-cap-lost" style="left:${n1(mo.capGood / top * 100)}%;width:${n1(lost / top * 100)}%"></span>` : ''}<span class="lg-cap-tick" style="left:calc(${n1(mo.capGood / top * 100)}% - 1px)"></span></div>
      <p class="lg-cap-txt">Selling <b>${esc(fmt.count(mo.sold))}</b> of the <b>${esc(fmt.count(mo.capGood))}</b> good cars the line can make. The line runs ${esc(fmt.min(mo.lineMin))} of ${esc(fmt.count(c.R.available))} minutes (${esc(fmt.pct(mo.util))}).${lost > EPS ? ` Shops want ${esc(fmt.count(mo.Q))}: <b class="lg-neg">${esc(fmt.count(lost))} lost sales</b>.` : ''}</p></div>`;
  }
  function renderRulesCard(c, mo) {
    part('rulesCard').innerHTML = `<p>The line crew are hourly. They clock on when the line starts and off when it stops, so their pay is a variable cost.</p>
      <p>At ${esc($2(mo.price))} the line runs ${esc(fmt.min(mo.lineMin))} of ${esc(fmt.count(c.R.available))} minutes (${esc(fmt.pct(mo.util))}), about ${esc(fmt.min(mo.days))} of ${esc(fmt.count(c.R.daysPerMonth))} days. The crew is sent home, unpaid, for the rest of the month. Real crews usually can't be sent home like this. If they were paid a salary, their pay would be a fixed cost and break-even would rise.</p>
      <p>The QC &amp; pack person inspects cars at the line exit and packs them later at the packing station. The model charges one cycle of their pay, ${esc($2(mo.car.qcPack))}, to each car as it leaves the line.</p>`;
  }
  function renderPlan(c, p) {
    // a lesson or challenge sets the opening cash and months; in a challenge its levers also set the terms and credit
    const host = part('plan'), locked = !!app.state.scenario?.locked && app.state.mode !== 'factory', chLock = challengeLock();
    if (!host.dataset.built) {
      host.dataset.built = '1';
      const ido = uid('open');
      host.innerHTML = `<div class="lg-field"><label for="${ido}">Opening cash</label><input class="lg-in" id="${ido}" data-plan="open" type="number" inputmode="decimal" step="1000" min="0"></div>
        <div class="lg-field"><span id="${ido}m">Months</span><div class="lg-seg" role="group" aria-labelledby="${ido}m"><button type="button" data-months="1">1</button><button type="button" data-months="3">3</button></div></div>
        <div class="lg-field lg-wide"><span id="${ido}t">Shop terms</span><div class="lg-seg" role="group" aria-labelledby="${ido}t"><button type="button" data-terms="net30">Net 30</button><button type="button" data-terms="early">2% off if paid in 10 days</button></div></div>
        <label class="lg-check lg-wide"><input type="checkbox" data-plan="credit"><span>Supplier credit<small data-plan="creditNote"></small></span></label>`;
      host.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.plan === 'open') { const n = E.parseNumber(t.value); if (n === null) { schedule(); return; } setPlan({ open: Math.max(0, roundTo(n, 2)) }); }
        if (t.dataset.plan === 'credit') setPlan({ supplierCredit: t.checked });
      });
      host.addEventListener('click', e => {
        const m = e.target.closest('[data-months]'), tm = e.target.closest('[data-terms]');
        if (m && !m.disabled) setPlan({ months: +m.dataset.months });
        if (tm && !tm.disabled) setPlan({ shopTerms: tm.dataset.terms });
      });
    }
    const open = host.querySelector('[data-plan="open"]'), credit = host.querySelector('[data-plan="credit"]');
    if (document.activeElement !== open) open.value = roundTo(p.open, 2);
    open.disabled = locked;
    host.querySelectorAll('[data-months]').forEach(b => { b.setAttribute('aria-pressed', +b.dataset.months === p.months); b.disabled = locked; });
    host.querySelectorAll('[data-terms]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.terms === p.shopTerms); b.disabled = chLock; });
    credit.checked = !!p.supplierCredit; credit.disabled = chLock;
    const note = host.querySelector('[data-plan="creditNote"]'), nt = creditText(c.R);
    if (note.textContent !== nt) note.textContent = nt;
    part('planLock').hidden = !chLock;
  }
  function renderActuals() {
    const host = part('actuals'); let a = null;
    try { a = engine?.actuals || null; } catch { }
    if (!a) { host.innerHTML = '<p class="lg-note">Run the line to see what it actually cost.</p>'; sum('act', ''); return; }
    const rows = [
      ['Line minutes run', `${fmt.min(a.lineMinRun || 0)} min`],
      ['Line paid', $2(a.linePaid || 0)],
      ['Charged to cars', $2(a.chargedToCars || 0)],
      ['Idle line', $2(a.idleLine || 0), 'lg-tot']
    ];
    if (a.broughtForward > EPS) rows.push(['Brought forward (left out)', $2(a.broughtForward)]);
    rows.push(['Cars started', fmt.count(a.started || 0)], ['Scrapped', `${fmt.count(a.scrapped || 0)}${a.scrapLost > EPS ? ` · ${$2(a.scrapLost)} lost` : ''}`], ['Shipped', `${fmt.count(a.shipped || 0)}${a.invoiced > EPS ? ` · invoiced ${$m(a.invoiced)}` : ''}`]);
    host.innerHTML = `<ul class="lg-list">${rows.map(([l, v, c]) => `<li class="${c || ''}"><span>${esc(l)}</span><span class="lg-num">${esc(v)}</span></li>`).join('')}</ul>
      <p class="lg-note">Idle line = line paid − charged to cars. It is running-line money no car carried: empty stations, and filling or emptying the line.${a.broughtForward > EPS ? ' Pre-filled cars brought their earlier stations with them; that amount is left out.' : ''}</p>`;
    sum('act', `idle ${$2(a.idleLine || 0)}`);
  }
  function renderGlossary() {
    const host = part('gloss');
    const terms = Object.entries(GLOSSARY).sort((a, b) => a[0].localeCompare(b[0]));
    const nice = t => t === 'bom' ? 'BOM' : t[0].toUpperCase() + t.slice(1);
    const id = uid('gq');
    host.innerHTML = `<label class="lg-vh" for="${id}">Find a term</label><input class="lg-in" id="${id}" type="search" placeholder="Find a term" autocomplete="off">
      <dl>${terms.map(([t, d]) => `<div data-term="${esc(t)}"><dt><dfn>${esc(nice(t))}</dfn></dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`;
    host.querySelector('input').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      host.querySelectorAll('[data-term]').forEach(r => { r.hidden = !!q && !r.textContent.toLowerCase().includes(q); });
    });
    sum('gloss', `${fmt.count(terms.length)} terms`);
  }
  const EXPORTS = [['costSheet', 'Cost sheet', 'ledger'], ['month', 'Month plan', 'volume'], ['breakEven', 'Break-even', 'breakeven'], ['orderMix', 'Order mix', 'breakeven'], ['cash', 'Cash calendar', 'bank']];
  function renderExport() {
    const host = part('export');
    host.innerHTML = `<p class="lg-note">Most files have the columns section, item, value, unit and how, so you can rebuild the sheet in a spreadsheet. The cash calendar has its own daily columns: month, day, item, in, out and balance.</p>
      <div class="lg-row">${EXPORTS.map(([k, l, layer]) => `<button type="button" class="lg-btn lg-small" data-csv="${k}" data-layer="${layer}">${esc(l)}</button>`).join('')}</div><p class="lg-msg" role="status" data-part="exportMsg"></p>`;
    host.addEventListener('click', e => { const b = e.target.closest('[data-csv]'); if (b) doExport(b.dataset.csv, part('exportMsg')); });
  }
  const currentWo = cfg => {
    try {
      if (engine?.tracked?.wo) return engine.tracked.wo;
      const key = E.carKey(cfg, app.state.up), cars = engine?.cars?.() || [];
      for (let i = cars.length - 1; i >= 0; i--) if (cars[i].cfg && E.carKey(cars[i].cfg, app.state.up) === key) return cars[i].wo;
    } catch { }
    return null;
  };
  async function doExport(kind, msgEl, extra = {}) {
    const c = ctx(), p = getPlan();
    let file;
    try {
      const cfg = kind === 'costSheet' && engine?.tracked?.cfg ? engine.tracked.cfg : c.cfg;
      file = buildCsv(kind, { ...c, cfg, sold: S.sold ?? undefined, wo: kind === 'costSheet' ? currentWo(cfg) : null, plan: p, ...extra });
    } catch (e) { console.error(e); if (msgEl) msgEl.textContent = 'Could not build the file.'; return; }
    if (msgEl) msgEl.textContent = `Preparing ${file.filename}…`;
    let res;
    try { res = await (plat.saveFile ? plat.saveFile(file) : Promise.resolve('unavailable')); } catch { res = 'error'; }
    const msg = { saved: `Saved ${file.filename}.`, declined: 'Save cancelled.', busy: 'A save prompt is already open.', copied: `Copied ${file.filename} to the clipboard.`, shown: `${file.filename} is shown as text: select it and copy.` }[res] || 'Saving is not available in this view.';
    if (msgEl) msgEl.textContent = msg;
  }

  /* ----- gating ----- */
  function gate() {
    const s = app.state, L = effectiveLayers(s);
    for (const n of pane.querySelectorAll('[data-layer]')) { const on = !!L[n.dataset.layer]; if (n.hidden === on) n.hidden = !on; }
    part('rulesSec').hidden = s.mode !== 'factory';
    part('askSec').hidden = !tutorOk();
    W.cost.update({ explain: tutorOk() });
    return L;
  }
  // hide: a course lesson's checks are open (app.state.hideAnswers), so the break-even line stays off the sheet
  const costOnly = (L, c, sold, hide) => {
    if (L.volume && L.breakeven && L.markup && !hide) return null;
    return E.costLines(c.cfg, c.R, c.up, { price: c.price, sold }).lines.filter(l => {
      if (l.section === 'pl') return false;
      if (l.id === 'breakEven' && hide) return false;
      if (['fixedShare', 'full', 'profitPerCar', 'price'].includes(l.id)) return !!L.volume;
      if (['contribution', 'breakEven'].includes(l.id)) return !!L.breakeven;
      if (['margin', 'markup'].includes(l.id)) return !!L.markup;
      return true;
    }).map(l => l.id);
  };

  /* ----- render everything from the state ----- */
  function render() {
    S.raf = 0;
    const L = gate(), c = ctx(), s = app.state;
    const hideA = !!s.hideAnswers, chLock = challengeLock();
    const mo0 = E.month(c.cfg, c.R, c.up, { price: c.price });
    const capMax = Math.max(100, Math.floor(mo0.capGood + EPS));
    if (S.sold !== null) S.sold = clamp(S.sold, 100, capMax);
    const sold = S.sold ?? undefined;
    const mo = E.month(c.cfg, c.R, c.up, { price: c.price, sold });
    const k = mo.car;
    W.where.update({ ...c, sold });
    part('car').innerHTML = `<b>${esc(E.CATALOG.body[c.cfg.body].label)}</b> · ${esc(carLabel(c.cfg).split(' · ').slice(1).join(' · '))}. Tap any line to see how it is worked out.`;
    W.cost.update({ ...c, sold, only: costOnly(L, c, sold, hideA) });
    sum('cost', L.volume ? `full ${$2(mo.perCar.fullCost)}` : `to the door ${$2(k.variable)}`);
    if (L.markup) W.markup.update({ cost: mo.perCar.fullCost });
    part('priceLock').hidden = !(chLock && L.price);
    W.price.update({ ...c, value: c.price, disabled: chLock });
    W.vol.update({ max: capMax, value: Math.round(mo.sold) });
    part('volNote').innerHTML = S.sold !== null
      ? `Showing ${esc(fmt.count(mo.sold))} cars. At ${esc($2(c.price))} shops would order ${esc(fmt.count(Math.min(mo.Q, mo.capGood)))}. <button type="button" class="lg-btn lg-small" data-act="demand">Back to demand</button>`
      : `Cars sold follow demand at ${esc($2(c.price))}. Drag to try another volume.`;
    W.pl.update({ ...c, sold });
    if (L.volume) renderCapacity(mo, c);
    W.fixed.update(c);
    renderRulesCard(c, mo0);
    sum('month', L.volume ? `profit ${$m(mo.pl.profit)}` : `fixed ${$m(mo.F)}`);
    // while a lesson's checks are open, the answers this tab would print stay hidden (crossing, peak, least cash)
    W.be.update({ ...c, sold, hideCross: hideA });
    sum('be', hideA ? '' : fin(mo.breakEven) ? `${fmt.count(mo.breakEven)} cars` : 'never');
    W.pp.update({ ...c, hidePeak: hideA, onPrice: chLock ? null : setPrice });
    const best = hideA ? null : E.bestPrice(c.cfg, c.R, c.up, { from: Math.min(24, c.price), to: Math.max(46, c.price), step: 0.5 });
    sum('pp', best && fin(best.price) ? `best ${$2(best.price)}` : '');
    // cash plan
    const p = getPlan();
    renderPlan(c, p);
    W.cashPrice.update({ ...c, value: c.price, disabled: chLock });
    const R2 = planRules(c, p), cal = planCalendar(c, p), pm = E.month(c.cfg, R2, c.up, { price: c.price });
    W.cash.update({ calendar: cal });
    part('mini').innerHTML = `Each month: sales <b>${esc($m(pm.pl.sales))}</b>${pm.pl.discounts > EPS ? ` − early-pay discounts <b>${esc($m(pm.pl.discounts))}</b>` : ''} − costs <b>${esc($m(pm.pl.variable + pm.pl.fixed))}</b> = profit <b class="${signCls(pm.pl.profit)}">${esc($m(pm.pl.profit))}</b>.`;
    const leastEl = part('least');
    leastEl.hidden = hideA;
    if (!hideA) {
      const least = E.leastOpeningCash(c.cfg, R2, c.up, { months: p.months, price: c.price });
      leastEl.textContent = `Least opening cash that never dips below ${$2(0, 0)} over ${plural(p.months, 'month', 'months')}: ${$m(least)}.`;
    } else leastEl.textContent = '';
    pane.querySelector('[data-act="run"]').textContent = p.months === 1 ? 'Run the month' : `Run ${fmt.count(p.months)} months`;
    sum('cash', cal.firstNeg ? `out on ${dayName(cal.firstNeg)}` : `low ${$m(cal.low)}`);
    // mix
    const isDefault = E.carKey(c.cfg, c.up) === E.carKey(E.DEFAULT_CAR, c.up);
    W.mix.update({ ...c, cars: [{ name: isDefault ? 'Default red Coupe (the order)' : 'Your order', cfg: c.cfg }, ...E.SAMPLE_CARS] });
    const mix = E.orderMix([{ name: 'order', cfg: c.cfg }, ...E.SAMPLE_CARS], c.R, c.up, c.price);
    const lo = mix.reduce((a, r) => r.contribution < a.contribution ? r : a), hiR = mix.reduce((a, r) => r.contribution > a.contribution ? r : a);
    part('mixNote').textContent = `At one price of ${$2(c.price)}, each parked car leaves a different amount toward the bills: from ${$2(lo.contribution)} to ${$2(hiR.contribution)} a car. Tap a car for its minutes.`;
    sum('mix', `${$2(lo.contribution)}–${$2(hiR.contribution)}`);
    renderActuals();
    if (s.mode === 'factory') renderRules();
  }
  const schedule = () => { if (!S.raf) S.raf = requestAnimationFrame(render); };
  pane.addEventListener('click', e => {
    if (e.target.closest('[data-act="demand"]')) { S.sold = null; schedule(); }
    if (e.target.closest('[data-act="run"]')) runner.start({});
  });
  part('askForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = part('askIn').value.trim().slice(0, 200); if (!q) return;
    const c = ctx(); askInto(part('askBub'), { kind: 'free', question: q, data: snapshot(c), reveal: true });
  });
  renderGlossary(); renderExport();

  /* ----- "Run the month" ----- */
  // "Change plan": go where the plan can be changed, and say so by moving there. A challenge's levers are on its own tab;
  // otherwise the Ledger's Cash section, if the Ledger tab is showing. If neither, the replay just closes (focus returns).
  const runner = createRunner({ engine, app, tut, tutorOk, snapshot, askInto, ctx, getPlan, planRules, doExport, onChangePlan: () => {
    const tabBtn = document.getElementById('tabLedger');
    const ledgerShown = tabBtn ? !tabBtn.hidden : (app.state.mode !== 'course' || !!effectiveLayers(app.state).ledger);
    if (challengeLock()) {
      app.set({ tab: 'lesson', bank: null });
      requestAnimationFrame(() => { try { document.getElementById('tabLesson')?.focus({ preventScroll: true }); } catch { } });
      return;
    }
    if (!ledgerShown) { app.set({ bank: null }); return; }
    app.set({ tab: 'ledger', bank: null });
    const sec = part('cashSec'); sec.open = true;
    requestAnimationFrame(() => {
      try { sec.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } catch { }
      pane.querySelector('[data-part="plan"] :is(input, button):not(:disabled)')?.focus({ preventScroll: true });
    });
  } });

  /* ----- subscriptions ----- */
  const on = (src, evt, fn) => { try { const u = src?.on?.(evt, fn); if (typeof u === 'function') subs.push(u); } catch { } };
  on(engine, 'optionChanged', onOrderChanged);
  const actuals = () => { const now = performance.now(); if (now - S.actT < 250) { if (!S.actP) S.actP = setTimeout(() => { S.actP = 0; actuals(); }, 260); return; } S.actT = now; if (!pane.hidden) renderActuals(); };
  for (const evt of ['enter', 'cycle', 'stationDone', 'exit', 'scrapped', 'shipped', 'lineIdle']) on(engine, evt, actuals);
  on(app, 'change', ({ keys }) => {
    // a replay belongs to the view it was started in: leaving it closes the ribbon and statement and frees the Bank chip
    if (keys.includes('mode') || keys.includes('lesson') || keys.includes('scenario')) runner.stop(true);
    if (keys.includes('mode')) onMode();
    // outside Factory floor the cash plan follows the lesson's or challenge's rules (C2's levers change R)
    if (keys.includes('scenario') || (keys.includes('R') && app.state.mode !== 'factory')) S.plan = null;
    if (keys.some(k => ['R', 'up', 'price', 'layers', 'moneyOn', 'mode', 'scenario', 'tab', 'hideAnswers'].includes(k))) schedule();
  });
  try { const u = tut.onChange?.(() => schedule()); if (typeof u === 'function') subs.push(u); } catch { }
  function onMode() {
    const m = app.state.mode;
    S.plan = null; S.sold = null;
    // Factory floor always gets its own saved rules (or the defaults), no upgrades, and its own order back
    if (m === 'factory') { applyFactory(S.factoryOv, false); restoreFactoryCfg(); }
    else { clearTimeout(S.cfgT); S.cfgT = 0; S.cfgHold = false; if (S.lastR && app.state.R === S.lastR) { S.lastR = null; app.set({ R: E.rules(), price: D0.price }); } }
  }
  // Factory floor rules and order saved earlier (progress.factory.rules / .cfg, SPEC §4.10)
  Promise.resolve().then(() => plat.store?.load?.()).then(p => {
    const ov = p?.factory?.rules, cfg = p?.factory?.cfg;
    if (validCfg(cfg) && !S.cfgDirty) S.factoryCfg = { ...cfg };
    if (ov && typeof ov === 'object' && !Object.keys(S.factoryOv).length) S.factoryOv = { ...ov };
    if (app.state.mode === 'factory') { applyFactory(S.factoryOv, false); if (!S.cfgDirty) restoreFactoryCfg(); }
  }).catch(() => { });

  render();
  return {
    runMonth: plan => runner.start(plan || {}),
    destroy() {
      runner.destroy();
      for (const u of subs) { try { u(); } catch { } }
      if (S.raf) cancelAnimationFrame(S.raf);
      clearTimeout(S.actP); clearTimeout(S.cfgT); tabsRO?.disconnect();
      try { S.ask?.stop?.(); } catch { }
      for (const w of Object.values(W)) w.destroy();
      pane.innerHTML = ''; pane.classList.remove('lg-pane');
    }
  };
}

/* ======================================================================================================== */
/* ---------- "Run the month" (SPEC §4.7) ---------- */
function createRunner({ engine, app, tut, tutorOk, snapshot, askInto, ctx, getPlan, planRules, doExport, onChangePlan }) {
  const ribbon = document.getElementById('ribbon'), stmt = document.getElementById('statement'), live = document.getElementById('live');
  let run = null, toastQ = [], toastBusy = 0, toastT = 0, bankT = 0;
  const say = t => { if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const toast = html => { toastQ.push(html); pump(); };
  function pump() {
    if (toastT || !toastQ.length) return;
    const now = performance.now(), wait = Math.max(0, toastBusy - now);
    toastT = setTimeout(() => { toastT = 0; const h = toastQ.shift(); if (!h) return; try { engine?.toast?.(h); } catch { } toastBusy = performance.now() + 1650; pump(); }, wait);
  }
  const setBank = (v, force) => { const now = performance.now(); if (!force && now - bankT < 45) return; bankT = now; app.set({ bank: Math.round(v) }); };

  // the view a replay was started in: if the mode, lesson or scenario changes under it, it stops instead of drawing on
  const viewKey = () => { const s = app.state; return `${s.mode}|${s.lesson ?? ''}|${s.scenario?.id ?? ''}`; };
  const stale = r => !r || r.view !== viewKey();
  const inReplay = el => !!el && (!!ribbon?.contains(el) || !!stmt?.contains(el));
  function start(plan) {
    // focus goes back here when the replay or statement closes ('Next month' keeps the original button)
    const ae = document.activeElement;
    const returnTo = plan.returnTo || (inReplay(ae) ? run?.returnTo : (ae && ae !== document.body ? ae : null)) || null;
    stop(false);
    const c = ctx(), base = getPlan();
    const p = {
      cfg: plan.cfg || c.cfg, up: plan.up || c.up, R: plan.R || c.R, price: fin(plan.price) ? plan.price : c.price,
      open: fin(plan.open) ? plan.open : base.open, shopTerms: plan.shopTerms ?? base.shopTerms,
      supplierCredit: plan.supplierCredit ?? base.supplierCredit, months: fin(plan.months) ? plan.months : base.months
    };
    const R2 = planRules({ R: p.R }, p);
    const cal = E.cashCalendar(p.cfg, R2, p.up, { months: p.months, open: p.open, price: p.price });
    const from = clamp(plan.from || 0, 0, cal.days.length - 1);
    let resolve; const done = new Promise(r => { resolve = r; });
    run = { p, R2, cal, from, i: from - 1, t0: 0, paused: false, finished: false, seen: {}, resolve, pauseShown: !!plan.from && cal.firstNeg && cal.firstNeg.index < from, view: viewKey(), returnTo };
    if (stmt) stmt.hidden = true;
    buildRibbon();
    app.emit('monthRun', { phase: 'start', calendar: cal, plan: p });
    say(`Running ${p.months === 1 ? 'the month' : `${p.months} months`} from ${$m(p.open)}.`);
    if (from === 0 && engine?.stageEl && phone()) { try { const r = engine.stageEl.getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight - 60) engine.stageEl.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } catch { } }
    if (reduced()) {
      // reduced motion: draw the ribbon complete, no tween; still stop on the out-of-cash day
      const r = run;
      for (let i = from; i < cal.days.length; i++) { r.i = i; markCell(i); }
      updateHead(cal.days.length - 1);
      setBank(cal.days[cal.days.length - 1].balance, true);
      if (cal.firstNeg && cal.firstNeg.index >= from) showOut(cal.firstNeg.index, true); else finish();
    } else {
      setBank(from > 0 ? cal.days[from - 1].balance : cal.open, true);
      run.t0 = performance.now();
      run.raf = requestAnimationFrame(frame);
    }
    return done;
  }
  function frame(now) {
    const r = run; if (!r || r.paused || r.finished) return;
    if (stale(r)) { stop(true); return; }
    const last = r.cal.days.length - 1, k = (now - r.t0) / DAY_MS;
    const doneTo = Math.min(last, r.from + Math.floor(k) - 1);
    while (r.i < doneTo) {
      r.i++; completeDay(r.i);
      if (r.paused) return;
    }
    if (r.i >= last) { finish(); return; }
    const j = r.i + 1, f = clamp(k - (j - r.from), 0, 1), e = f * f * (3 - 2 * f);
    const prev = j > 0 ? r.cal.days[j - 1].balance : r.cal.open;
    setBank(prev + (r.cal.days[j].balance - prev) * e);
    markNow(j);
    r.raf = requestAnimationFrame(frame);
  }
  function completeDay(i) {
    const r = run, d = r.cal.days[i];
    markCell(i); updateHead(i); setBank(d.balance, true);
    // toasts: day 1 bills, the first production day, the first supplier invoice, the first receipt
    for (const it of d.items) {
      if (it.item === 'Fixed bills' && !r.seen.fixed) { r.seen.fixed = 1; toast(`Rent &amp; bills ${esc($m(it.amount))}`); }
      else if (it.good && !r.seen.prod) { r.seen.prod = 1; toast(`${r.p.supplierCredit || r.R2.supplierCredit ? 'Crew, power, freight…' : 'Birch, crew, power…'} ${esc($m(it.amount))}`); }
      else if (it.item.startsWith('Supplier') && !r.seen.sup) { r.seen.sup = 1; toast(`Supplier invoices ${esc($m(it.amount))}`); }
      else if (it.amount > 0 && !r.seen.rec) { r.seen.rec = 1; toast(`Shops paid ${esc(fmt.signed(it.amount, Math.abs(it.amount) >= 1000 ? 0 : 2))}`); }
    }
    if (d.day === Math.round(r.cal.days.length / r.cal.months)) say(`End of month ${d.month}: bank ${$m(d.balance)}.`);
    if (r.cal.firstNeg && i === r.cal.firstNeg.index && !r.pauseShown) showOut(i, false);
  }
  function outReason(i) {
    const cal = run.cal, d = cal.days[i];
    const paidIn = cal.days.slice(0, i + 1).some(x => x.items.some(it => it.amount > 0));
    if (!paidIn) {
      const spent = -cal.days.slice(0, i + 1).reduce((a, x) => a + x.items.filter(it => it.amount < 0).reduce((s, it) => s + it.amount, 0), 0);
      return `you have spent ${$m(spent)} on bills and cars, and no shop has paid yet`;
    }
    if (d.day === 1 && d.month > 1) return `the month's bills are due before shops have paid for most of month ${d.month - 1}`;
    return 'more money is going out each day than the shops are paying in';
  }
  function dayItemsHtml(d) {
    return `<ul>${d.items.map(it => `<li>${esc(it.item)}: ${esc(it.amount > 0 ? fmt.signed(it.amount, Math.abs(it.amount) >= 1000 ? 0 : 2) : $m(it.amount))}</li>`).join('') || '<li>No money moved</li>'}<li>Bank at the end of the day: ${esc($m(d.balance))}</li></ul>`;
  }
  function showOut(i, still) {
    const r = run, d = r.cal.days[i];
    r.paused = true; r.pauseShown = true; cancelAnimationFrame(r.raf);
    setBank(d.balance, true);
    const head = `Out of cash on day ${d.day} of month ${d.month}:`, why = outReason(i);
    const box = ribbon?.querySelector('.lg-rb-out');
    if (box) {
      box.hidden = false;
      box.innerHTML = `<p style="margin:0"><b>${esc(head)}</b> ${esc(why)}.</p>
        <details class="lg-rb-why" data-rb="why"><summary>What went out and came in that day</summary>${dayItemsHtml(d)}</details>
        <div class="lg-row">${tutorOk() ? '<button type="button" class="lg-btn lg-small" data-rb="ask">Ask why</button>' : ''}<button type="button" class="lg-btn lg-small" data-rb="change">Change plan</button><button type="button" class="lg-btn lg-small lg-primary" data-rb="keep">Keep going</button></div>
        <div class="lg-bub" data-rb="bub"></div>`;
      // the pause card sits over the stage, far from the Run button in tab order: take focus to 'Keep going'
      const ae = document.activeElement;
      if (!typingIn(ae) || ae === r.returnTo) { try { box.querySelector('[data-rb="keep"]').focus({ preventScroll: !phone() }); } catch { } }
    }
    say(`${head} ${why}.`);
    app.emit('cashOut', { index: i, month: d.month, day: d.day, balance: d.balance, calendar: r.cal, reason: why });
    app.emit('monthRun', { phase: 'pause', calendar: r.cal, index: i });
  }
  function keepGoing() {
    const r = run; if (!r) return;
    const box = ribbon?.querySelector('.lg-rb-out');
    const had = !!box?.contains(document.activeElement);
    if (box) { box.hidden = true; box.innerHTML = ''; }
    // the pause card is gone: keep focus in the replay, on Skip
    if (had) { try { ribbon.querySelector('[data-rb="skip"]')?.focus({ preventScroll: true }); } catch { } }
    if (r.i >= r.cal.days.length - 1) { finish(); return; }
    r.paused = false; r.t0 = performance.now() - (r.i - r.from + 1) * DAY_MS;
    r.raf = requestAnimationFrame(frame);
  }
  function skip() {
    const r = run; if (!r || r.finished) return;
    cancelAnimationFrame(r.raf);
    for (let i = r.i + 1; i < r.cal.days.length; i++) markCell(i);
    r.i = r.cal.days.length - 1; updateHead(r.i);
    app.emit('monthRun', { phase: 'skip', calendar: r.cal });
    finish();
  }
  function finish() {
    const r = run; if (!r || r.finished) return;
    if (stale(r)) { stop(true); return; } // never open a statement over another view
    r.finished = true; r.paused = false; cancelAnimationFrame(r.raf);
    const last = r.cal.days[r.cal.days.length - 1];
    setBank(last.balance, true);
    const box = ribbon?.querySelector('.lg-rb-out'); if (box) { box.hidden = true; box.innerHTML = ''; }
    if (ribbon && stmt) { ribbon.hidden = true; ribbon.classList.remove('lg-rbon'); }
    showStatement();
    app.emit('monthRun', { phase: 'end', calendar: r.cal, plan: r.p });
    r.resolve?.({ calendar: r.cal, outcome: 'statement' });
  }
  function stop(resetBank = true) {
    const r = run; if (!r) return;
    const hadFocus = inReplay(document.activeElement);
    cancelAnimationFrame(r.raf); run = null;
    toastQ = []; clearTimeout(toastT); toastT = 0;
    for (const w of stW) w.destroy(); stW = [];
    if (ribbon) { ribbon.hidden = true; ribbon.classList.remove('lg-rbon'); ribbon.innerHTML = ''; }
    if (stmt) { stmt.hidden = true; stmt.innerHTML = ''; }
    if (resetBank) app.set({ bank: null });
    // focus was in the ribbon or statement, which are now gone: give it back to the button that started the replay
    if (hadFocus) { const t = r.returnTo; if (t?.isConnected && !t.disabled && t.getClientRects().length) { try { t.focus({ preventScroll: !phone() }); /* phones scroll back to it: it sits below the stage */ } catch { } } }
    r.resolve?.({ calendar: r.cal, outcome: 'stopped' });
  }

  /* ribbon */
  function buildRibbon() {
    if (!ribbon) return;
    const { cal } = run, M = cal.months, D = Math.round(cal.days.length / M), first = Math.max(1, M - 2);
    let rows = '';
    for (let m = first; m <= M; m++) rows += `<div class="lg-rb-row"><span>M${m}</span><div class="lg-rb-cells">${Array.from({ length: D }, (_, d) => `<i data-i="${(m - 1) * D + d}" title="Day ${d + 1} of month ${m}"></i>`).join('')}</div></div>`;
    ribbon.innerHTML = `<div class="lg-rb" role="group" aria-label="Cash calendar replay"><div class="lg-rb-head"><b data-rb="day"></b><span class="lg-rb-bank lg-num" data-rb="bank"></span><button type="button" class="lg-btn lg-small" data-rb="skip">Skip</button><button type="button" class="lg-x" data-rb="close" aria-label="Close the replay">×</button></div>${rows}<div class="lg-rb-out" hidden></div></div>`;
    ribbon.classList.add('lg-rbon'); ribbon.hidden = false;
    for (let i = 0; i < run.from; i++) markCell(i);
    updateHead(Math.max(run.from - 1, 0), run.from === 0);
  }
  function markCell(i) {
    const cell = ribbon?.querySelector(`[data-i="${i}"]`); if (!cell) return;
    cell.className = cashCls(run.cal.days[i].balance);
  }
  function markNow(j) {
    if (!ribbon) return;
    const prev = ribbon.querySelector('.lg-c-now'); if (prev && prev.dataset.i == j) return;
    prev?.classList.remove('lg-c-now'); ribbon.querySelector(`[data-i="${j}"]`)?.classList.add('lg-c-now');
  }
  function updateHead(i, before) {
    if (!ribbon) return;
    const d = run.cal.days[i], bal = before ? run.cal.open : d.balance;
    const day = ribbon.querySelector('[data-rb="day"]'), bank = ribbon.querySelector('[data-rb="bank"]');
    if (day) day.textContent = before ? `Month 1 · opening` : `Month ${d.month} · day ${d.day}`;
    if (bank) { bank.textContent = `Bank ${$m(bal)}`; bank.className = 'lg-rb-bank lg-num ' + signCls(bal); }
  }
  const onRibbon = e => {
    const b = e.target.closest('[data-rb]'); if (!b || !run) return;
    const a = b.dataset.rb;
    if (a === 'skip') skip();
    else if (a === 'close') stop(true);
    else if (a === 'keep') keepGoing();
    else if (a === 'change') { stop(true); onChangePlan(); }
    else if (a === 'ask') {
      const d = run.cal.days[run.i];
      app.emit('lowPoint', { calendar: run.cal, index: run.i, via: 'ask' });
      askInto(ribbon.querySelector('[data-rb="bub"]'), { kind: 'statement', question: `Why did I run out of cash on day ${d.day} of month ${d.month} when the month makes a profit?`, data: cashData(), reveal: true });
    }
  };
  const onRibbonToggle = e => { const t = e.target; if (t.matches?.('[data-rb="why"]') && t.open && run) app.emit('lowPoint', { calendar: run.cal, index: run.i, via: 'breakdown' }); };
  ribbon?.addEventListener('click', onRibbon);
  ribbon?.addEventListener('toggle', onRibbonToggle, true);

  function cashData() {
    const r = run, c = { cfg: r.p.cfg, R: r.R2, up: r.p.up, price: r.p.price };
    const cal = r.cal;
    return snapshot(c, { cash: { opening: cal.open, low: E.r2(cal.low), lowDay: cal.lowAt ? dayName(cal.lowAt) : null, outOfCash: cal.firstNeg ? dayName(cal.firstNeg) : null, end: E.r2(cal.days[cal.days.length - 1].balance), terms: r.R2.shopTerms, supplierCredit: !!r.R2.supplierCredit, months: cal.months, profitMonthly: E.r2(cal.profitMonthly) } });
  }

  /* statement card */
  let stTab = 'pl', stW = [];
  function showStatement() {
    if (!stmt) return;
    const r = run, { cal, p, R2 } = r, M = cal.months, last = cal.days[cal.days.length - 1];
    const profit = cal.profitMonthly * M;
    const title = M === 1 ? 'Statement · month 1' : `Statement · months 1–${M}`;
    const lede = `You made <b class="${signCls(profit)}">${esc($m(profit))}</b> profit${M > 1 ? ` (${esc($m(cal.profitMonthly))} a month)` : ''}, and the bank went from <b>${esc($m(cal.open))}</b> to <b class="${signCls(last.balance)}">${esc($m(last.balance))}</b>.` +
      (cal.firstNeg ? ` It ran out of cash on ${esc(dayName(cal.firstNeg))}.` : ` It never went below ${esc($2(0, 0))}.`);
    const hid = uid('sth');
    stmt.innerHTML = `<div class="lg-st" role="dialog" aria-labelledby="${hid}"><div class="lg-st-head"><h3 tabindex="-1" id="${hid}">${esc(title)}</h3><button type="button" class="lg-x" data-st="close" aria-label="Close the statement">×</button></div>
      <p class="lg-st-lede">${lede}</p>
      <div class="lg-seg lg-st-tabs" role="tablist" aria-label="Statement">${[['pl', 'P&L'], ['cash', 'Cash'], ['car', 'Per car']].map(([k, l]) => `<button type="button" role="tab" data-sttab="${k}" aria-selected="${k === stTab}">${esc(l)}</button>`).join('')}</div>
      <div data-st="body" role="tabpanel"></div>
      <div class="lg-bub" data-st="bub"></div>
      <div class="lg-st-acts">${tutorOk() ? '<button type="button" class="lg-btn" data-st="ask">Ask the accountant</button>' : ''}<button type="button" class="lg-btn" data-st="csv">Download CSV</button><button type="button" class="lg-btn lg-primary" data-st="next">Next month</button><button type="button" class="lg-btn" data-st="change">Change plan</button></div>
      <p class="lg-msg" role="status" data-st="msg"></p></div>`;
    stmt.hidden = false;
    paintTab();
    const ae = document.activeElement;
    if (!typingIn(ae) || inReplay(ae)) { try { stmt.querySelector('h3').focus({ preventScroll: true }); } catch { } }
    say(`${title}. ${stmt.querySelector('.lg-st-lede').textContent}`);
  }
  function paintTab() {
    const r = run; if (!r || !stmt) return;
    for (const w of stW) w.destroy(); stW = [];
    const body = stmt.querySelector('[data-st="body"]'), { cal, p, R2 } = r;
    stmt.querySelectorAll('[data-sttab]').forEach(b => b.setAttribute('aria-selected', b.dataset.sttab === stTab));
    body.innerHTML = '';
    const c = { cfg: p.cfg, R: R2, up: p.up, price: p.price };
    if (stTab === 'pl') {
      if (cal.months > 1) body.insertAdjacentHTML('beforeend', `<p class="lg-note" style="margin-bottom:6px">Every month is the same plan, so this is each month's P&amp;L.</p>`);
      const host = document.createElement('div'); body.appendChild(host); stW.push(plTable(host, c));
    } else if (stTab === 'cash') {
      const inn = cal.days.reduce((a, d) => a + d.items.filter(x => x.amount > 0).reduce((s, x) => s + x.amount, 0), 0);
      const out = cal.days.reduce((a, d) => a + d.items.filter(x => x.amount < 0).reduce((s, x) => s + x.amount, 0), 0);
      const end = cal.days[cal.days.length - 1].balance, low = cal.lowAt ? cal.days[cal.lowAt.index] : null;
      body.innerHTML = `<ul class="lg-list lg-st-cash"><li><span>Start</span><span class="lg-num">${esc($m(cal.open))}</span></li><li><span>In: shops paid</span><span class="lg-num lg-pos">${esc(fmt.signed(inn, 0))}</span></li><li><span>Out: bills and cars</span><span class="lg-num lg-neg">${esc($m(out))}</span></li><li class="lg-tot"><span>End</span><span class="lg-num ${signCls(end)}">${esc($m(end))}</span></li>
        ${low ? `<li class="lg-lowrow"><button type="button" class="lg-rowb" data-st="low" aria-expanded="false"><span>Low point · ${esc(dayName(cal.lowAt))}</span><span class="lg-num ${signCls(cal.low)}">${esc($m(cal.low))}</span></button><div class="lg-lowhow" hidden>That day: ${dayItemsHtml(low)}${low.items.some(x => x.amount > 0) ? '' : ''}</div></li>` : ''}</ul>`;
      const host = document.createElement('div'); body.appendChild(host); stW.push(cashChart(host, { calendar: cal, height: phone() ? 150 : 160 }));
    } else {
      body.innerHTML = waterfallHtml(c);
    }
  }
  function waterfallHtml(c) {
    const mo = E.month(c.cfg, c.R, c.up, { price: c.price }), k = mo.car, full = mo.perCar.fullCost, np = mo.netPrice;
    const top = Math.max(np, full) || 1, pct = v => n1(clamp(v / top * 100, 0, 100));
    const row = (label, a, b, cls = '') => `<div class="lg-wf-r ${cls}"><span>${esc(label)}</span><span class="lg-wf-t"><span style="left:${pct(Math.min(a, b))}%;width:${pct(Math.abs(b - a))}%"></span></span><span class="lg-num">${esc($2(b - a))}</span></div>`;
    return `<p class="lg-note" style="margin-bottom:8px">One car at ${esc(fmt.count(mo.sold))} cars a month, from the first station to profit.</p><div class="lg-wf">
      ${row('Started car', 0, k.started)}${row('+ scrap share', k.started, k.good)}${row('+ carton', k.good, k.good + k.carton)}${row('+ freight', k.good + k.carton, k.variable)}
      ${row('Variable cost', 0, k.variable, 'lg-tot')}${row(`+ fixed share at ${fmt.count(mo.sold)}`, k.variable, full)}${row('Full cost', 0, full, 'lg-tot')}
      ${row(c.R.shopTerms === 'early' ? 'Price after 2% off' : 'Price', 0, np, 'lg-pr')}
      <div class="lg-wf-r ${np - full >= 0 ? 'lg-gainr' : 'lg-lossr'} lg-tot"><span>${np - full >= 0 ? 'Profit per car' : 'Loss per car'}</span><span class="lg-wf-t"><span style="left:${pct(Math.min(full, np))}%;width:${pct(Math.abs(np - full))}%"></span></span><span class="lg-num ${signCls(np - full)}">${esc($2(np - full))}</span></div></div>`;
  }
  const onStmt = e => {
    const r = run; if (!r) return;
    const t = e.target.closest('[data-sttab]'); if (t) { stTab = t.dataset.sttab; paintTab(); return; }
    const b = e.target.closest('[data-st]'); if (!b) return;
    const a = b.dataset.st;
    if (a === 'close') stop(true);
    else if (a === 'change') { stop(true); onChangePlan(); }
    else if (a === 'next') { const p = r.p; start({ ...p, months: p.months + 1, from: p.months * Math.round(r.cal.days.length / r.cal.months) }); }
    else if (a === 'csv') doExport(stTab === 'pl' ? 'month' : stTab === 'cash' ? 'cash' : 'costSheet', stmt.querySelector('[data-st="msg"]'), { cfg: r.p.cfg, R: r.R2, up: r.p.up, price: r.p.price, plan: { open: r.p.open, shopTerms: r.p.shopTerms, supplierCredit: r.p.supplierCredit, months: r.cal.months }, calendar: r.cal });
    else if (a === 'low') {
      const on = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', on); b.nextElementSibling.hidden = !on;
      if (on) app.emit('lowPoint', { calendar: r.cal, index: r.cal.lowAt?.index, via: 'statement' });
    } else if (a === 'ask') {
      const last = r.cal.days[r.cal.days.length - 1].balance, profit = r.cal.profitMonthly;
      askInto(stmt.querySelector('[data-st="bub"]'), { kind: 'statement', question: profit > 0 && last < r.cal.open ? 'Why is my bank down when I made a profit?' : 'Explain this statement in plain words.', data: cashData(), reveal: true });
    }
  };
  const onStmtKey = e => { if (e.key === 'Escape' && run) { stop(true); } };
  stmt?.addEventListener('click', onStmt);
  stmt?.addEventListener('keydown', onStmtKey);

  return {
    start,
    stop,
    destroy() {
      stop(false); for (const w of stW) w.destroy();
      clearTimeout(toastT);
      ribbon?.removeEventListener('click', onRibbon); ribbon?.removeEventListener('toggle', onRibbonToggle, true);
      stmt?.removeEventListener('click', onStmt); stmt?.removeEventListener('keydown', onStmtKey);
    }
  };
}
