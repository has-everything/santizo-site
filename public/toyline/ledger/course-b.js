// Toyline Ledger course data, Unit B "One month": lessons L7-L12, the course-end L13 "Price your own car", the warm-up
// pool W1-W11 and the challenges C1-C3
// (docs/SPEC.md §3.3-3.5), written in the lesson DSL of docs/CONTRACTS.md for the runner in ledger/course.js.
// Every figure a learner sees is computed from econ.js with the locked default rules. The only numbers typed here are
// a question's own givens (a $500 rent rise, a $27 full cost, a 300-car order...). Nothing touches the DOM at import,
// so the module loads in Node (tools/check-course-b.mjs); widgets and challenge renders use the DOM only when called.
import * as econ from './econ.js';

const { fmt, roundTo, near, parseNumber, STATIONS, FIXED_ITEMS, NO_UPGRADES, DEFAULT_CAR, SAMPLE_CARS, RACER_ORDER, DELIVERY_VAN, UPGRADES } = econ;

/* ---------- formatting (all through econ.fmt) ---------- */
const $ = x => fmt.money2(x);                       // $22.00
const $0 = x => fmt.money2(x, 0);                   // $11,400
const $s = x => Number.isInteger(roundTo(x, 2)) ? fmt.money2(x, 0) : fmt.money2(x); // $32, $36.50
const sgn0 = x => fmt.signed(x, 0);                 // +$3,648, −$11,400
const n = x => fmt.count(x);                        // 1,900
const mn = x => fmt.min(x);                         // 3.5, 7,000
const pc = (f, d = 1) => fmt.pct(f, d);             // fraction -> 23.1%
const NUM = s => `<span class="cs-b-num">${s}</span>`;
const BN = s => `<b class="cs-b-num">${s}</b>`;
const G = (t, s = t) => `<g t="${t}">${s}</g>`;     // glossary mark (ledger/glossary.js)
const BLANK = '<b class="cs-b-blank">?</b>';            // the one blank of a step-2 hint (as in course-a)
// A glossary term inside a widget this module renders itself: the runner's popover opens on any .cs-g in the pane.
// CONTRACT-GAP: the contract only defines <g t> in lesson copy; widget HTML is not passed through the runner, so this
// writes the runner's own .cs-g button (course.js setHtml output). Without the runner it is a dotted-underlined label.
const GW = (t, s = t) => `<button type="button" class="cs-g" data-t="${t}" aria-expanded="false">${s}</button>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap1 = s => s[0].toUpperCase() + s.slice(1);

// Answers are given at the precision the spec rounds to (§2.12: tolerances apply to the rounded value).
const DP = { '$': 2, '$m': 2, min: 1, '%': 1, cars: 0, h: 1 };
const ans = (unit, x) => roundTo(x, DP[unit] ?? 2);
const A = (unit, x) => () => ans(unit, x);
const EPS = 1e-6;

/* ---------- the locked default month (every lesson number starts here) ---------- */
const D = (() => {
  const R = econ.rules(), up = { ...NO_UPGRADES }, cfg = { ...DEFAULT_CAR };
  const k = econ.carCost(cfg, R, up), mo = econ.month(cfg, R, up);
  return {
    R, up, cfg, k, mo, F: mo.F, V: k.variable, P: mo.price, sold: mo.sold, fixedPer: mo.perCar.fixedPerCar,
    full: mo.perCar.fullCost, contrib: mo.perCar.contribution, profitPer: mo.perCar.profit, be: mo.breakEven,
    cap: Math.floor(mo.capGood + EPS), lineRate: k.lineRate, scrapMul: R.scrapEvery / (R.scrapEvery - 1)
  };
})();
const fixedSum = (R = D.R) => FIXED_ITEMS.map(([id]) => $0(R.fixed[id])).join(' + ');
const lazy = f => { let v; return () => (v ??= f()); };

/* ---------- small runtime helpers (DOM only inside functions) ---------- */
const mem = ctx => ctx.mem || (ctx.mem = {});
const complete = (ctx, id) => { try { ctx.complete?.(id); } catch (e) { console.warn('[course-b] complete', e); } };
const call = (obj, fn, ...a) => { try { return typeof obj?.[fn] === 'function' ? obj[fn](...a) : undefined; } catch (e) { console.warn('[course-b]', fn, e); } };
const q = (el, s) => el.querySelector(s);
const reduced = () => { try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const rowsHtml = rows => rows.map(([l, v, cls = '']) => `<div class="cs-b-row ${cls}"><span>${l}</span><b class="cs-b-num">${v}</b></div>`).join('');
const sign = x => (x >= 0 ? 'cs-b-gain' : 'cs-b-loss');

const CSS = `
.cs-b{display:grid;gap:10px;font-size:13.5px;line-height:1.45;color:var(--ink);min-width:0}
.cs-b *,.cs-b *::before,.cs-b *::after{box-sizing:border-box}
.cs-b-num{font-family:var(--f-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.cs-b .cs-g{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;border-bottom:1.5px dotted currentColor;cursor:help}
.cs-b-lab{font-family:var(--f-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.cs-b-card{border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:10px 12px;display:grid;gap:8px;min-width:0}
.cs-b-card.is-good{border-color:var(--gain)}
.cs-b-card.is-bad{border-color:var(--loss)}
.cs-b-p{margin:0}
.cs-b-muted{color:var(--muted);font-size:12.5px}
.cs-b-btn{min-height:44px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer;touch-action:manipulation;text-align:center}
.cs-b-btn[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.cs-b-btn.cs-b-primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent);font-weight:800}
.cs-b-btn:disabled{opacity:.4;cursor:not-allowed}
.cs-b-btn:focus-visible,.cs-b-switch:focus-visible,.cs-b-card:focus-visible,.cs-b input:focus-visible,.cs-b select:focus-visible,.cs-b textarea:focus-visible,.cs-b .cs-g:focus-visible,.cs-b-table button:focus-visible{outline:2px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 4px var(--accent)}
.cs-b-seg{display:flex;flex-wrap:wrap;gap:6px}
.cs-b-seg>.cs-b-btn{flex:1 1 0;min-width:0}
.cs-b-field{display:grid;gap:4px;min-width:0}
.cs-b-field>span:first-child{font-size:12.5px;color:var(--muted)}
.cs-b-input{display:flex;align-items:center;gap:6px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);padding:0 10px;min-height:44px}
.cs-b-input:focus-within{outline:2px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 4px var(--accent)}
.cs-b-input input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font-family:var(--f-mono);font-size:15px;font-variant-numeric:tabular-nums;padding:8px 0;outline:none}
.cs-b-input input:focus-visible{outline:none;box-shadow:none}
.cs-b-card:focus:not(:focus-visible){outline:none}
.cs-b-unit{font-family:var(--f-mono);color:var(--muted);font-size:13px}
.cs-b-fb{font-size:12.5px;margin:0}
.cs-b-fb:empty{display:none}
.cs-b-fb.ok{color:var(--gain-ink)}
.cs-b-fb.bad{color:var(--loss-ink)}
.cs-b-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.cs-b-rows{display:grid}
.cs-b-row{display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:4px 0;border-bottom:1px dashed var(--line);font-size:12.5px;min-width:0}
.cs-b-row:last-child{border-bottom:0}
.cs-b-row>span{flex:1 1 auto;min-width:0}
.cs-b-row>b{flex:0 0 auto;font-weight:600;text-align:right}
.cs-b-row.wrapv>b{flex:0 1 auto;min-width:0;white-space:normal}
.cs-b-sub{display:block;font-family:var(--f-display);font-size:11.5px;font-weight:400;color:var(--muted);white-space:normal}
.cs-b-row.total{font-weight:700;font-size:13.5px}
.cs-b-row.total>b{font-weight:700}
.cs-b-gain{color:var(--gain-ink)}
.cs-b-loss{color:var(--loss-ink)}
.cs-b-range{width:100%;min-height:44px;margin:0;accent-color:var(--accent);touch-action:pan-y}
.cs-b-select{min-height:44px;width:100%;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;padding:0 10px}
.cs-b-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:48px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);padding:8px 12px;font:inherit;font-weight:700;cursor:pointer;text-align:left}
.cs-b-switch small{display:block;font-weight:400;color:var(--muted);font-size:12px}
.cs-b-knob{flex:none;width:44px;height:26px;border-radius:13px;background:var(--line-strong);position:relative}
.cs-b-knob::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--surface);box-shadow:0 1px 2px color-mix(in srgb,var(--ink) 30%,transparent);transition:left .15s}
.cs-b-switch[aria-checked="true"] .cs-b-knob{background:var(--ink)}
.cs-b-switch.stop[aria-checked="true"] .cs-b-knob{background:var(--loss)}
.cs-b-switch[aria-checked="true"] .cs-b-knob::after{left:21px}
.cs-b-sort{display:grid}
.cs-b-sortrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--line)}
.cs-b-sortrow:last-child{border-bottom:0}
.cs-b-sortrow .cs-b-seg{flex-wrap:nowrap}
.cs-b-sortrow .cs-b-btn{min-width:80px;padding:6px 8px;font-size:12.5px}
.cs-b-sortwhy{grid-column:1/-1;font-size:12px;color:var(--muted)}
.cs-b-sortwhy:empty{display:none}
.cs-b-sortrow.ok .cs-b-sortwhy{color:var(--gain-ink)}
.cs-b-sortrow.bad .cs-b-sortwhy{color:var(--loss-ink)}
.cs-b-stackwrap{position:relative;padding-top:4px}
.cs-b-stack{display:flex;height:22px;border-radius:5px;overflow:hidden;background:var(--surface);border:1px solid var(--line)}
.cs-b-stack i{display:block;height:100%;min-width:1px}
.cs-b-tick{position:absolute;top:0;bottom:-4px;width:2px;margin-left:-1px;background:var(--ink)}
.cs-b-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 12px;margin:0;padding:0;list-style:none;font-size:12px}
.cs-b-legend li{display:flex;align-items:center;gap:6px;min-width:0}
.cs-b-legend li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-b-legend i{flex:none;width:10px;height:10px;border-radius:2px}
.cs-b-bars{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;align-items:end}
.cs-b-bar{display:grid;gap:3px;justify-items:center;min-width:0}
.cs-b-bar .col{width:100%;max-width:34px;height:72px;display:flex;flex-direction:column;justify-content:flex-end;border-bottom:1px solid var(--line)}
.cs-b-bar .col i{display:block;width:100%;background:color-mix(in srgb,var(--ink) 55%,transparent);border-radius:3px 3px 0 0}
.cs-b-bar.bn .col i{background:var(--accent)}
.cs-b-bar b{font-family:var(--f-mono);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
.cs-b-bar span{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);max-width:100%;overflow:hidden;text-overflow:ellipsis}
.cs-b-rib{display:grid;grid-template-columns:auto repeat(21,minmax(0,1fr));gap:2px;align-items:center}
.cs-b-rib>span{font-family:var(--f-mono);font-size:10px;color:var(--muted);padding-right:4px}
.cs-b-rib i{display:block;height:18px;border-radius:2px;background:color-mix(in srgb,var(--ink) 7%,transparent)}
.cs-b-rib i.ok{background:color-mix(in srgb,var(--gain) 55%,transparent)}
.cs-b-rib i.low{background:var(--accent)}
.cs-b-rib i.neg{background:var(--loss)}
.cs-b-rib i.now{outline:2px solid var(--ink);outline-offset:0}
.cs-b-replay[data-done="false"] .lg-ch-foot,.cs-b-replay[data-done="false"] .lg-tblwrap{display:none}
.cs-b-pause{border:1px solid var(--loss);border-radius:10px;padding:10px 12px;display:grid;gap:8px;background:color-mix(in srgb,var(--loss) 8%,var(--bg))}
.cs-b-tablewrap{overflow-x:auto;max-width:100%}
.cs-b-table{border-collapse:collapse;width:100%;font-size:12px}
.cs-b-table th,.cs-b-table td{padding:5px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;vertical-align:top}
.cs-b-table th{font-family:var(--f-mono);font-size:10px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.cs-b-table th:first-child,.cs-b-table td:first-child{text-align:left;white-space:normal;min-width:120px}
.cs-b-table td{font-family:var(--f-mono);font-variant-numeric:tabular-nums}
.cs-b-table td:first-child{font-family:var(--f-display)}
.cs-b-table tr.is-pick td{font-weight:700}
.cs-b-table button{all:unset;cursor:pointer;text-decoration:underline dotted}
.cs-b-svg{display:block;width:100%;height:auto;overflow:visible}
.cs-b-svg.drag{touch-action:none;cursor:ew-resize}
.cs-b-svg text{font-family:var(--f-mono);font-size:9.5px;fill:var(--muted)}
.cs-b-svg .ax{stroke:var(--line);stroke-width:1}
.cs-b-svg .zero{stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3}
.cs-b-svg .fixed{stroke:var(--muted);stroke-width:1.5;stroke-dasharray:5 3;fill:none}
.cs-b-svg .cost,.cs-b-svg .profit,.cs-b-svg .bal{stroke:var(--ink);stroke-width:2;fill:none}
.cs-b-svg .rev{stroke:var(--gain);stroke-width:2;fill:none}
.cs-b-svg .util{stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 3;fill:none}
.cs-b-svg .mark{stroke:var(--accent);stroke-width:2.5}
.cs-b-svg .knob{fill:var(--accent);stroke:var(--ink);stroke-width:1}
.cs-b-svg .lowdot{fill:var(--loss)}
.cs-b-svg .negzone{fill:color-mix(in srgb,var(--loss) 12%,transparent)}
.cs-b-svg text.t-rev{fill:var(--gain-ink)}
.cs-b-svg text.t-ink{fill:var(--ink)}
.cs-b-svg text.t-loss{fill:var(--loss-ink)}
.cs-b-hintlist{margin:0;padding-left:18px;display:grid;gap:4px}
.cs-b-debrief{display:grid;gap:8px}
.cs-b-debrief p{margin:0}
.cs-b-wait{margin:0;font-size:12.5px;color:var(--muted);font-style:italic}
.cs-b-pick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.cs-b-pick>.cs-b-btn{display:grid;gap:2px;justify-items:start;text-align:left;font-weight:700;min-width:0}
.cs-b-pick>.cs-b-btn small{font-weight:400;font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
.cs-b-pick>.cs-b-btn[aria-pressed="true"] small{color:inherit;opacity:.85}
.cs-b-pick>.cs-b-btn.wide{grid-column:1/-1}
.cs-b-spec{border-collapse:collapse;width:100%;font-size:12px}
.cs-b-spec th,.cs-b-spec td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.cs-b-spec th{font-family:var(--f-mono);font-size:10px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.cs-b-spec td.n,.cs-b-spec th.n{text-align:right;font-family:var(--f-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.cs-b-spec tr.bn td{font-weight:700}
.cs-b-givens{margin:0;padding-left:18px;display:grid;gap:2px;font-size:12.5px;color:var(--muted)}
.cs-b-blanks{display:grid;gap:6px}
.cs-b-brow{display:grid;grid-template-columns:minmax(0,1fr) auto 18px;gap:8px;align-items:center;padding:4px 0;border-bottom:1px dashed var(--line);font-size:12.5px}
.cs-b-brow.total{font-weight:700}
.cs-b-brow .cs-b-input{min-width:0;width:136px;padding:0 8px}
.cs-b-brow .cs-b-input input{width:100%}
.cs-b-brow .cs-b-input.ok{border-color:var(--gain)}
.cs-b-brow .cs-b-input.bad{border-color:var(--loss)}
.cs-b-brow>b{font-family:var(--f-mono);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.cs-b-mark{font-family:var(--f-mono);font-weight:700;text-align:center}
.cs-b-mark.ok{color:var(--gain-ink)}
.cs-b-mark.bad{color:var(--loss-ink)}
.cs-b-how{grid-column:1/-1;font-size:12px;color:var(--muted)}
.cs-b-ta{width:100%;min-height:140px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);color:var(--ink);font-family:var(--f-mono);font-size:12px;padding:8px}
@media (max-width:820px),(pointer:coarse){.cs-b-input input,.cs-b-select,.cs-b-ta{font-size:16px}}
@media (max-width:420px){.cs-b-brow{gap:6px}.cs-b-brow .cs-b-input{width:128px}}
@media (max-width:359px){.cs-b-pick{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion: reduce){.cs-b-knob::after{transition:none}}
`;
function ensureCss(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById('css-course-b')) return;
  const s = doc.createElement('style'); s.id = 'css-course-b'; s.textContent = CSS; doc.head.appendChild(s);
}

/* ---------- widgets: the ledger's when present, simple stand-ins when not ---------- */
// Segment fills of "Where the $ goes" (cost categories per SPEC §4.13: materials wood, labour ink, overhead muted).
const SEG_FILL = {
  materials: 'var(--wood)',
  touch: 'var(--ink)',
  waiting: 'repeating-linear-gradient(135deg,var(--ink) 0 2px,color-mix(in srgb,var(--ink) 30%,transparent) 2px 5px)',
  qc: 'color-mix(in srgb,var(--ink) 60%,var(--surface))',
  powerCons: 'color-mix(in srgb,var(--muted) 55%,var(--surface))',
  scrap: 'var(--loss)',
  shipping: 'color-mix(in srgb,var(--wood) 50%,var(--muted))',
  fixed: 'var(--muted)',
  discount: 'var(--invoice)',
  profit: 'var(--gain)'
};
const scale = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
const f1 = x => Math.round(x * 10) / 10;
function svgPoint(svg, evt, vbW) { const r = svg.getBoundingClientRect(); return (evt.clientX - r.left) / (r.width || 1) * vbW; }
const niceStep = (span, n = 3) => { const r = span / n, p = 10 ** Math.floor(Math.log10(r || 1)), m = r / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
const kfmt = v => Math.abs(v) >= 1000 ? (v < 0 ? '−' : '') + '$' + n(Math.abs(v) / 1000) + 'k' : $0(v);

const FB = {
  whereBar(el, o) {
    let cur = { ...o };
    const draw = () => {
      const w = econ.whereTheMoneyGoes(cur.cfg, cur.R, cur.up, { price: cur.price, sold: cur.sold });
      const costs = w.segments.filter(s => s.id !== 'profit'), pr = w.segments.find(s => s.id === 'profit');
      const total = costs.reduce((a, s) => a + s.value, 0), span = Math.max(w.price, total);
      const parts = pr.value > 0 ? [...costs, pr] : costs;
      el.innerHTML = `<div class="cs-b" data-fallback="whereBar">
        <div class="cs-b-row"><span>Where the ${BN($(w.price))} goes</span><span class="cs-b-num">${n(w.sold)} cars</span></div>
        <div class="cs-b-stackwrap"><div class="cs-b-stack" role="img" aria-label="${esc(parts.map(s => s.label + ' ' + $(s.value)).join(', '))}">${parts.map(s => `<i style="width:${(s.value / span * 100).toFixed(2)}%;background:${SEG_FILL[s.id] || 'var(--muted)'}"></i>`).join('')}</div>${total > w.price ? `<span class="cs-b-tick" style="left:${(w.price / span * 100).toFixed(2)}%" title="price"></span>` : ''}</div>
        <ul class="cs-b-legend">${w.segments.map(s => `<li><i style="background:${SEG_FILL[s.id] || 'var(--muted)'}"></i><span>${s.label}</span><b class="cs-b-num ${s.id === 'profit' ? sign(s.value) : ''}">${$(s.value)}</b></li>`).join('')}</ul>
      </div>`;
    };
    draw();
    return { update(p) { Object.assign(cur, p); draw(); }, destroy() { el.innerHTML = ''; } };
  },
  volumeSlider(el, o) {
    const fmtv = o.format || (v => `${n(v)} cars`);
    // no live region: the slider announces its own value (aria-valuetext); the readout below it is for the eye
    el.innerHTML = `<div class="cs-b-field" data-fallback="volumeSlider"><div class="cs-b-row"><span>${esc(o.label || 'Cars sold')}</span><b class="cs-b-num" data-ro></b></div>
      <input class="cs-b-range" type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${o.value}" aria-label="${esc(o.label || 'Cars sold')}"><span class="cs-b-muted" data-read></span></div>`;
    const inp = q(el, 'input'), ro = q(el, '[data-ro]'), rd = q(el, '[data-read]');
    const show = () => { ro.textContent = fmtv(+inp.value); inp.setAttribute('aria-valuetext', fmtv(+inp.value)); rd.textContent = o.read ? o.read(+inp.value) : ''; };
    inp.addEventListener('input', () => { show(); o.onInput?.(+inp.value); });
    show();
    return { set(v) { inp.value = v; show(); }, destroy() { el.innerHTML = ''; } };
  },
  priceSlider(el, o) {
    // with the ledger's readout: "Shops will order 1,900. The line can make 2,394."
    const cur = { ...o };
    const read = p => {
      if (cur.readout === false) return '';
      const R = cur.R ? (cur.R.labourPerMin !== undefined ? cur.R : econ.rules(cur.R)) : D.R, mo = econ.month(cur.cfg || D.cfg, R, cur.up || D.up, { price: p });
      return `Shops will order ${n(mo.Q)}. The line can make ${n(Math.floor(mo.capGood + EPS))}.` + (mo.lostSales > EPS ? ` ${n(mo.lostSales)} orders are lost.` : '');
    };
    const w = FB.volumeSlider(el, { min: o.from ?? 24, max: o.to ?? 46, step: o.step ?? 0.5, value: o.value, label: o.label || 'Price per car', format: v => $(v), onInput: o.onInput, read });
    return { set: w.set, update(p) { Object.assign(cur, p); w.set(p.value ?? +q(el, 'input').value); }, destroy: w.destroy };
  },
  breakEvenChart(el, o) {
    let cur = { ...o }, at = null;
    const VW = 320, VH = 180, L = 44, RP = 62, T = 10, B = 22;
    el.innerHTML = `<div class="cs-b" data-fallback="breakEvenChart"><svg class="cs-b-svg${o.marker ? ' drag' : ''}" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Break-even chart"></svg>
      ${o.marker ? `<div class="cs-b-row"><span>Marker</span><b class="cs-b-num" data-ro></b></div>
      <input class="cs-b-range" type="range" step="10" aria-label="Marker position in cars sold">
      <button type="button" class="cs-b-btn" data-place>Place the marker here</button>` : ''}</div>`;
    const svg = q(el, 'svg'), rng = q(el, 'input'), ro = q(el, '[data-ro]');
    let g = null;
    const draw = () => {
      const mo = econ.month(cur.cfg, cur.R, cur.up, { price: cur.price });
      const cap = Math.floor(mo.capGood + EPS), F = mo.F, V = mo.car.variable, P = mo.netPrice;
      const yMax = Math.max(P * cap, F + V * cap) * 1.06;
      const X = scale(0, cap, L, VW - RP), Y = scale(0, yMax, VH - B, T);
      g = { cap, F, V, P, X, Y };
      if (at === null) at = Math.round(cap / 4 / 10) * 10;
      const ln = (x0, y0, x1, y1, c) => `<line x1="${f1(X(x0))}" y1="${f1(Y(y0))}" x2="${f1(X(x1))}" y2="${f1(Y(y1))}" class="${c}"/>`;
      svg.innerHTML = `${ln(0, 0, cap, 0, 'ax')}${ln(0, 0, 0, yMax / 1.06, 'ax')}
        ${(st => Array.from({ length: Math.floor(yMax / 1.06 / st) + 1 }, (_, i) => `<text x="${L - 4}" y="${f1(Y(i * st)) + 3}" text-anchor="end">${kfmt(i * st)}</text>`).join(''))(niceStep(yMax / 1.06))}
        <text x="${L}" y="${VH - 6}">0</text><text x="${f1(X(cap))}" y="${VH - 6}" text-anchor="end">${n(cap)} cars</text>
        ${ln(0, F, cap, F, 'fixed')}${ln(0, F, cap, F + V * cap, 'cost')}${ln(0, 0, cap, P * cap, 'rev')}
        <text x="${f1(X(cap)) + 4}" y="${f1(Y(P * cap)) + 3}" class="t-rev">Revenue</text>
        <text x="${f1(X(cap)) + 4}" y="${f1(Y(F + V * cap)) + 3}" class="t-ink">Total cost</text>
        <text x="${f1(X(cap)) + 4}" y="${f1(Y(F)) + 3}">Fixed</text>
        ${cur.marker ? `<line class="mark" data-m y1="${T}" y2="${VH - B}"/><circle class="knob" data-k r="6" cy="${T + 6}"/>` : ''}`;
      if (rng) { rng.min = 0; rng.max = cap; }
      paint();
    };
    const paint = () => {
      if (!cur.marker || !g) return;
      const x = f1(g.X(at));
      q(svg, '[data-m]').setAttribute('x1', x); q(svg, '[data-m]').setAttribute('x2', x); q(svg, '[data-k]').setAttribute('cx', x);
      rng.value = at;
      ro.textContent = `${n(at)} cars · in ${$0(at * g.P)} · cost ${$0(g.F + g.V * at)}`;
      rng.setAttribute('aria-valuetext', `${n(at)} cars`);
    };
    // snaps to break-even within 20 cars, as the ledger's chart does
    const place = () => { const be = econ.month(cur.cfg, cur.R, cur.up, { price: cur.price }).breakEven; if (Number.isFinite(be) && Math.abs(at - be) <= 20) { at = be; paint(); } cur.marker?.onPlace?.(at); };
    if (o.marker) {
      rng.addEventListener('input', () => { at = +rng.value; paint(); });
      rng.addEventListener('change', place);
      q(el, '[data-place]').addEventListener('click', place);
      let dragging = false;
      const move = e => { const x = svgPoint(svg, e, VW); at = Math.max(0, Math.min(g.cap, Math.round((x - L) / (VW - RP - L) * g.cap / 10) * 10)); paint(); };
      svg.addEventListener('pointerdown', e => { dragging = true; try { svg.setPointerCapture(e.pointerId); } catch { } move(e); });
      svg.addEventListener('pointermove', e => { if (dragging) move(e); });
      svg.addEventListener('pointerup', () => { if (dragging) { dragging = false; place(); } });
      svg.addEventListener('pointercancel', () => { dragging = false; });
    }
    draw();
    return { update(p) { Object.assign(cur, p); draw(); }, destroy() { el.innerHTML = ''; } };
  },
  priceProfitChart(el, o) {
    // o.series: ['profit', 'revenue', 'util'] adds revenue on the money axis and the share of line time used (0-100%)
    // on a right-hand axis, as the ledger's chart does (L11 and L13 pass it)
    let cur = { from: 24, to: 46, step: 0.5, ...o };
    const VW = 320, VH = 180, L = 46, T = 12, B = 22;
    el.innerHTML = `<div class="cs-b" data-fallback="priceProfitChart"><svg class="cs-b-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Profit at each price"></svg>
      <p class="cs-b-p cs-b-muted" data-read></p>
      ${o.place ? `<button type="button" class="cs-b-btn" data-place>Place the best price here</button>` : ''}</div>`;
    const svg = q(el, 'svg'), rd = q(el, '[data-read]');
    let g = null;
    const draw = () => {
      const ser = Array.isArray(cur.series) ? cur.series : ['profit'], rev = ser.includes('revenue'), util = ser.includes('util');
      const p = cur.price ?? cur.R.price, a = Math.min(cur.from, Math.floor(p)), b = Math.max(cur.to, Math.ceil(p)), RP = util ? 34 : 12;
      const sw = econ.priceSweep(cur.cfg, cur.R, cur.up, { from: a, to: b, step: cur.step });
      const money = [...sw.map(r => r.profit), ...(rev ? sw.map(r => r.revenue) : [])], lo = Math.min(0, ...money), hi = Math.max(0, ...money);
      const X = scale(a, b, L, VW - RP), Y = scale(lo, hi + (hi - lo) * 0.08, VH - B, T), YU = scale(0, 1, VH - B, T);
      g = { X, sw, a, b, RP };
      const line = (key, f = Y) => sw.map(r => `${f1(X(r.price))},${f1(f(r[key]))}`).join(' ');
      const last = sw[sw.length - 1], mo = econ.month(cur.cfg, cur.R, cur.up, { price: p });
      svg.innerHTML = `<line class="ax" x1="${L}" x2="${L}" y1="${T}" y2="${VH - B}"/><line class="zero" x1="${L}" x2="${VW - RP}" y1="${f1(Y(0))}" y2="${f1(Y(0))}"/>
        <text x="${L - 4}" y="${f1(Y(0)) + 3}" text-anchor="end">$0</text><text x="${L - 4}" y="${f1(Y(hi)) + 3}" text-anchor="end">${kfmt(hi)}</text>
        ${lo < 0 ? `<text x="${L - 4}" y="${f1(Y(lo)) + 3}" text-anchor="end">${kfmt(lo)}</text>` : ''}
        <text x="${L}" y="${VH - 6}">${$s(a)}</text><text x="${VW - RP}" y="${VH - 6}" text-anchor="end">${$s(b)}</text>
        ${util ? `<line class="ax" x1="${VW - RP}" x2="${VW - RP}" y1="${T}" y2="${VH - B}"/>${[0, 0.5, 1].map(u => `<text x="${VW - 2}" y="${f1(YU(u)) + 3}" text-anchor="end">${pc(u, 0)}</text>`).join('')}
          <polyline class="util" points="${line('util', YU)}"/><text x="${VW - RP - 3}" y="${f1(YU(last.util)) - 4}" text-anchor="end">Line busy</text>` : ''}
        ${rev ? `<polyline class="rev" points="${line('revenue')}"/><text class="t-rev" x="${VW - RP - 3}" y="${f1(Y(last.revenue)) - 4}" text-anchor="end">Revenue</text>` : ''}
        <polyline class="profit" points="${line('profit')}"/><text class="t-ink" x="${VW - RP - 3}" y="${f1(Y(last.profit)) + 12}" text-anchor="end">Profit</text>
        <line class="mark" x1="${f1(X(p))}" x2="${f1(X(p))}" y1="${T}" y2="${VH - B}"/><circle class="knob" r="5" cx="${f1(X(p))}" cy="${f1(Y(mo.pl.profit))}"/>
        <text x="${f1(X(p))}" y="${T - 2}" text-anchor="${X(p) > VW * 0.7 ? 'end' : X(p) < VW * 0.3 ? 'start' : 'middle'}" class="t-ink">${$(p)} · ${$0(mo.pl.profit)}</text>`;
      rd.innerHTML = `At ${BN($(p))}: ${n(mo.sold)} sold · revenue ${NUM($0(mo.pl.sales))} · profit <b class="cs-b-num ${sign(mo.pl.profit)}">${$0(mo.pl.profit)}</b> · line busy ${NUM(pc(mo.util))}` + (mo.lostSales > EPS ? ` · ${n(mo.lostSales)} orders lost` : '');
    };
    svg.addEventListener('click', e => {
      if (!g) return;
      const x = svgPoint(svg, e, VW), raw = g.a + (x - L) / (VW - g.RP - L) * (g.b - g.a);
      const p = Math.max(g.a, Math.min(g.b, Math.round(raw / cur.step) * cur.step));
      cur.price = p; draw(); cur.onPrice?.(p);
    });
    if (o.place) q(el, '[data-place]').addEventListener('click', () => cur.place.onPlace?.(cur.price ?? cur.R.price));
    draw();
    return { update(p) { Object.assign(cur, p); draw(); }, destroy() { el.innerHTML = ''; } };
  },
  markupCalc(el, o) {
    const cost = o.cost;
    el.innerHTML = `<div class="cs-b" data-fallback="markupCalc">
      <div class="cs-b-field"><div class="cs-b-row"><span>Markup (profit ÷ cost)</span><b class="cs-b-num" data-mk></b></div><input class="cs-b-range" data-in="markup" type="range" min="0" max="100" step="1" aria-label="Markup percent"></div>
      <div class="cs-b-field"><div class="cs-b-row"><span>Margin (profit ÷ price)</span><b class="cs-b-num" data-mg></b></div><input class="cs-b-range" data-in="margin" type="range" min="0" max="50" step="1" aria-label="Margin percent"></div>
      <div class="cs-b-rows" data-out></div></div>`;
    const mk = q(el, '[data-in=markup]'), mg = q(el, '[data-in=margin]');
    let price = cost * 1.3;
    const show = () => {
      const m1 = econ.markupOf(price, cost), m2 = econ.marginOf(price, cost);
      q(el, '[data-mk]').textContent = pc(m1); q(el, '[data-mg]').textContent = pc(m2);
      mk.value = Math.round(m1 * 100); mg.value = Math.round(m2 * 100);
      mk.setAttribute('aria-valuetext', pc(m1)); mg.setAttribute('aria-valuetext', pc(m2));
      q(el, '[data-out]').innerHTML = rowsHtml([['Full cost', $(cost)], ['Profit per car', $(price - cost)], ['Price on the tag', $(price), 'total']]);
      return { markup: m1, margin: m2, price };
    };
    mk.addEventListener('input', () => { price = cost * (1 + mk.value / 100); o.onChange?.({ ...show(), source: 'markup' }); });
    mg.addEventListener('input', () => { price = econ.priceForMargin(cost, mg.value / 100); o.onChange?.({ ...show(), source: 'margin' }); });
    show();
    return { destroy() { el.innerHTML = ''; } };
  },
  cashChart(el, o) {
    let cur = { ...o };
    const VW = 320, VH = 150, L = 48, RP = 10, T = 14, B = 22;
    el.innerHTML = `<div class="cs-b" data-fallback="cashChart"><div class="cs-b-rib" data-rib aria-hidden="true"></div><svg class="cs-b-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Bank balance each working day"></svg><p class="cs-b-p cs-b-muted" data-read></p></div>`;
    const svg = q(el, 'svg'), rib = q(el, '[data-rib]'), rd = q(el, '[data-read]');
    const cls = b => b < -EPS ? 'neg' : b < 5000 ? 'low' : 'ok';
    const draw = () => {
      const c = cur.calendar; if (!c) return;
      const days = c.days, N = days.length, M = c.months || 1, D0 = Math.round(N / M) || 21;
      const upTo = Math.max(-1, Math.min(cur.upTo ?? N - 1, N - 1));
      rib.innerHTML = Array.from({ length: M }, (_, m) => `<span>M${m + 1}</span>${Array.from({ length: D0 }, (_, d) => { const i = m * D0 + d, dd = days[i]; return `<i class="${!dd || i > upTo ? '' : cls(dd.balance)}${i === upTo && upTo < N - 1 ? ' now' : ''}" title="Month ${m + 1} day ${d + 1}${dd && i <= upTo ? ': ' + $0(dd.balance) : ''}"></i>`; }).join('')}`).join('');
      const bal = [c.open, ...days.map(d => d.balance)];
      const lo0 = Math.min(0, ...bal), hi = Math.max(0, ...bal), lo = lo0 - (hi - lo0) * 0.16;
      const X = scale(0, N, L, VW - RP), Y = scale(lo, hi + (hi - lo0) * 0.06, VH - B, T);
      const pts = bal.slice(0, upTo + 2).map((b, i) => `${f1(X(i))},${f1(Y(b))}`).join(' ');
      const low = c.lowAt && c.lowAt.index <= upTo ? c.lowAt : null;
      svg.innerHTML = `${lo0 < 0 ? `<rect class="negzone" x="${L}" y="${f1(Y(0))}" width="${VW - RP - L}" height="${f1(Y(lo) - Y(0))}"/>` : ''}
        <line class="zero" x1="${L}" x2="${VW - RP}" y1="${f1(Y(0))}" y2="${f1(Y(0))}"/>
        ${Array.from({ length: M }, (_, m) => `<line class="ax" x1="${f1(X(m * D0))}" x2="${f1(X(m * D0))}" y1="${T}" y2="${VH - B}"/><text x="${f1(X(m * D0 + D0 / 2))}" y="${VH - 6}" text-anchor="middle">month ${m + 1}</text>`).join('')}
        <text x="${L - 4}" y="${f1(Y(0)) + 3}" text-anchor="end">$0</text><text x="${L - 4}" y="${f1(Y(hi)) + 3}" text-anchor="end">${kfmt(hi)}</text>
        ${lo0 < 0 && Y(lo0) - Y(0) > 14 ? `<text x="${L - 4}" y="${f1(Y(lo0)) + 3}" text-anchor="end">${kfmt(lo0)}</text>` : ''}
        <polyline class="bal" points="${pts}"/>
        ${low ? `<circle class="lowdot" r="4" cx="${f1(X(low.index + 1))}" cy="${f1(Y(c.low))}"/><text class="${c.low < 0 ? 't-loss' : 't-ink'}" x="${f1(X(low.index + 1)) + (X(low.index + 1) > VW * 0.6 ? -6 : 6)}" text-anchor="${X(low.index + 1) > VW * 0.6 ? 'end' : 'start'}" y="${f1(Y(c.low)) + 13}">Low ${$0(c.low)} · day ${low.day} of month ${low.month}</text>` : ''}`;
      rd.innerHTML = upTo >= N - 1 ? `Opening ${NUM($0(c.open))} · lowest <b class="cs-b-num ${sign(c.low)}">${$0(c.low)}</b>${c.lowAt ? ` (day ${c.lowAt.day} of month ${c.lowAt.month})` : ''} · end ${NUM($0(days[N - 1].balance))}` : '';
    };
    draw();
    return { update(p) { Object.assign(cur, p); draw(); }, destroy() { el.innerHTML = ''; } };
  },
  orderMixTable(el, o) {
    let cur = { ...o };
    const draw = () => {
      const rows = econ.orderMix(undefined, cur.R, cur.up, cur.price ?? cur.R.price);
      el.innerHTML = `<div class="cs-b-tablewrap" data-fallback="orderMixTable"><table class="cs-b-table"><thead><tr><th>Car</th><th>Bottleneck</th><th>Cycle</th><th>Variable</th><th>Contribution</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr data-i="${i}"><td>${cur.onPick ? `<button type="button">${esc(r.name)}</button>` : esc(r.name)}</td><td>${r.bottAll.map(b => STATIONS[b]).join(' & ')} ${mn(r.bott)}</td><td>${mn(r.cycle)}</td><td>${$(r.variable)}</td><td>${$(r.contribution)}</td></tr>`).join('')}</tbody></table></div>`;
      if (cur.onPick) el.querySelectorAll('tbody tr').forEach(tr => q(tr, 'button').addEventListener('click', () => cur.onPick(rows[+tr.dataset.i])));
    };
    draw();
    return { update(p) { Object.assign(cur, p); draw(); }, destroy() { el.innerHTML = ''; } };
  },
  costSheet(el, o) {
    let cur = { ...o };
    const draw = () => {
      const cl = econ.costLines(cur.cfg, cur.R, cur.up, { price: cur.price, sold: cur.sold });
      const lines = cur.only ? cur.only.map(id => cl.byId[id]).filter(Boolean) : cl.lines.filter(l => l.section !== 'pl');
      const v = l => l.unit === '%' ? fmt.pct(l.value / 100) : l.unit === 'cars' ? n(l.value) : $(l.value);
      el.innerHTML = `<div class="cs-b-rows" data-fallback="costSheet">${lines.map(l => `<div class="cs-b-row"><span>${esc(l.label)}<br><small class="cs-b-muted">${esc(l.how)}</small></span><b class="cs-b-num">${v(l)}</b></div>`).join('')}</div>`;
    };
    draw();
    return { update(p) { Object.assign(cur, p); draw(); }, destroy() { el.innerHTML = ''; } };
  }
};
// Use the ledger's widget when it exists and mounts; otherwise the simple stand-in above.
function widget(ctx, name, el, o) {
  const real = ctx?.widgets?.[name];
  if (typeof real === 'function') {
    try { const w = real(el, o); if (w) { el.dataset.csbWidget = 'ledger'; return w; } }
    catch (e) { console.warn(`[course-b] widgets.${name} failed; using the simple version`, e); el.innerHTML = ''; }
  }
  el.dataset.csbWidget = 'fallback';
  return FB[name](el, o);
}

/* ---------- shared bits ---------- */
// Tap-sort: each card gets a button per bin; wrong picks say why, retries allowed; onDone once all are right.
function sortWidget(el, { cards, bins, onDone, label = 'Sort the cards' }) {
  ensureCss(el.ownerDocument);
  const pick = cards.map(() => null);
  el.innerHTML = `<div class="cs-b"><div class="cs-b-row"><span class="cs-b-lab">${esc(label)}</span><b class="cs-b-num" data-tally aria-live="polite"></b></div>
    <div class="cs-b-sort">${cards.map((c, i) => `<div class="cs-b-sortrow" data-i="${i}"><span>${esc(c.text)}</span>
      <span class="cs-b-seg" role="group" aria-label="${esc(c.text)}">${bins.map(b => `<button type="button" class="cs-b-btn" data-bin="${esc(b)}" aria-pressed="false">${esc(b)}</button>`).join('')}</span>
      <span class="cs-b-sortwhy" role="status"></span></div>`).join('')}</div></div>`;
  let fired = false;
  const tally = () => {
    const right = pick.filter((p, i) => p === cards[i].bin).length;
    q(el, '[data-tally]').textContent = `${right} of ${cards.length} right`;
    if (right === cards.length && !fired) { fired = true; onDone?.(); }
  };
  el.querySelectorAll('.cs-b-sortrow').forEach(row => {
    const i = +row.dataset.i, c = cards[i];
    row.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      pick[i] = b.dataset.bin;
      row.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      const ok = pick[i] === c.bin;
      row.classList.toggle('ok', ok); row.classList.toggle('bad', !ok);
      q(row, '.cs-b-sortwhy').textContent = ok ? c.why : (c.nudge || 'Not quite. Would this bill change if the factory made no cars?');
      tally();
    }));
  });
  tally();
  return () => { el.innerHTML = ''; };
}
// A field for a number with its unit; feedback line under it.
const fieldHtml = (key, label, unit) => `<label class="cs-b-field"><span>${label}</span>
  <span class="cs-b-input">${unit === '$' ? '<span class="cs-b-unit">$</span>' : ''}<input data-in="${key}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${esc(label.replace(/<[^>]+>/g, ''))}">${unit !== '$' ? `<span class="cs-b-unit">${unit}</span>` : ''}</span>
  <span class="cs-b-fb" data-fb="${key}" aria-live="polite"></span></label>`;
const setFb = (el, key, ok, msg) => { const f = q(el, `[data-fb="${key}"]`); if (!f) return; f.className = 'cs-b-fb ' + (ok === null ? '' : ok ? 'ok' : 'bad'); f.innerHTML = msg || ''; };
const switchHtml = (key, label, note, on = false, cls = '') => `<button type="button" role="switch" class="cs-b-switch ${cls}" data-sw="${key}" aria-checked="${on}"><span>${label}${note ? `<small>${note}</small>` : ''}</span><span class="cs-b-knob" aria-hidden="true"></span></button>`;

/* =====================================================================================================
   L7 · Bills that come anyway
   ===================================================================================================== */
const L7d = (() => {
  const zero = econ.month(D.cfg, D.R, D.up, { sold: 0 });
  const rise = { rent: 500, insurance: 100 };
  const Rt = econ.rules({ fixed: { rent: D.R.fixed.rent + rise.rent, insurance: D.R.fixed.insurance + rise.insurance } });
  // the worked example works the method on another set of bills (marketing paused for a month), so it never prints
  // the check's $11,400 or the twin's $12,000
  const Rw = econ.rules({ fixed: { marketing: 0 } }), zeroW = econ.month(D.cfg, Rw, D.up, { sold: 0 });
  return { zero, rise, Rt, twin: Rt.fixedTotal, Rw, zeroW };
})();
// `nudge` answers the wrong pick the lesson targets (labour depends on the deal); other cards get the generic question
const L7_CARDS = [
  ['Workshop rent', 'Fixed', `${$0(D.R.fixed.rent)} on the 1st of every month, cars or no cars.`],
  ['Birch blanks', 'Variable', `${$(D.k.parts[0][0].value)} of birch for every car started.`],
  ['Machine lease', 'Fixed', `${$0(D.R.fixed.machineLease)} a month for the router, booth, conveyor and presses.`],
  ['Line crew', 'Variable', `Here the crew are paid by the hour, only while the line runs: ${fmt.rate(D.R.labourPerMin)} a minute each.`, 'Read the Rules card: here the crew are paid by the hour, only while the line runs.'],
  ['Supervisor salary', 'Fixed', `A salary: ${$0(D.R.fixed.supervisor)} a month however many cars are made.`, 'A salary is paid whether or not the line runs.'],
  ['Power', 'Variable', `${$(D.R.powerPerLineMin)} for every minute the line runs.`],
  ['Insurance', 'Fixed', `${$0(D.R.fixed.insurance)} a month.`],
  ['Cartons', 'Variable', `${$(D.R.carton)} for each good car.`],
  ['Maintenance', 'Fixed', `${$0(D.R.fixed.maintenance)} a month, booked ahead.`],
  ['Freight', 'Variable', `${$(D.R.freight)} for each car on the truck.`]
].map(([text, bin, why, nudge]) => ({ text, bin, why, ...(nudge ? { nudge } : {}) }));

function stopWidget(el, ctx) {
  ensureCss(el.ownerDocument);
  const mo = D.mo, z = L7d.zero;
  el.innerHTML = `<div class="cs-b">
    <div class="cs-b-card"><div class="cs-b-lab">Rules of this factory</div>
      <p class="cs-b-p">The line crew are hourly. They clock on when the line starts and off when it stops, so their pay is a ${GW('variable cost')}.</p>
      <p class="cs-b-p cs-b-muted">At ${n(D.sold)} cars a month the line runs ${NUM(mn(mo.lineMin))} of ${NUM(mn(D.R.available))} minutes (${NUM(pc(mo.util))}), ${NUM(mn(mo.days))} of ${D.R.daysPerMonth} days. The crew is sent home, unpaid, for the rest of the month. Real crews usually can’t be sent home like this.</p>
      <p class="cs-b-p cs-b-muted">The QC &amp; pack person inspects cars at the line exit and packs them later; each car pays one cycle of their time.</p></div>
    ${switchHtml('stop', 'Line stopped all month', 'No cars are made. Which bills still come?', false, 'stop')}
    <div class="cs-b-card"><div class="cs-b-lab" data-head></div><div class="cs-b-rows" data-out aria-live="polite"></div></div></div>`;
  const sw = q(el, '[data-sw=stop]'), out = q(el, '[data-out]');
  // CONTRACT-GAP: ctx.rulesCard(el) is a course.js extra; used when present (one source of truth), else the copy above
  if (typeof ctx.rulesCard === 'function') {
    const card = q(el, '.cs-b-card');
    try { const host = el.ownerDocument.createElement('div'); ctx.rulesCard(host); if (host.childNodes.length) { card.replaceChildren(...host.childNodes); card.dataset.rules = 'runner'; } }
    catch (e) { console.warn('[course-b] rulesCard', e); }
  }
  const show = stopped => {
    const m = stopped ? z : mo;
    q(el, '[data-head]').textContent = stopped ? 'This month, line stopped' : `This month, ${n(D.sold)} cars at ${$s(D.P)}`;
    out.innerHTML = rowsHtml([
      ['Line meter', `${$(stopped ? 0 : D.lineRate)}/min`],
      ['Sales', $0(m.pl.sales)],
      ['Variable costs (birch, crew, power, cartons…)', $0(m.pl.variable)],
      ['Fixed bills', $0(m.pl.fixed)],
      [stopped ? 'The month' : 'Operating profit', `<span class="${sign(m.pl.profit)}">${sgn0(m.pl.profit)}</span>`, 'total']
    ]);
  };
  sw.addEventListener('click', () => {
    const on = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', on);
    call(ctx.engine, 'setStopped', on);
    show(on);
    const m = mem(ctx);
    if (!m.flipped) { m.flipped = true; complete(ctx, 'stop'); }
  });
  show(false);
  return () => { call(ctx.engine, 'setStopped', false); el.innerHTML = ''; };
}

const L7 = {
  id: 'L7', unit: 'B', title: 'Bills that come anyway', minutes: 6, scored: true,
  goal: 'Sort costs into fixed and variable; work out a month with no production.',
  explain: () => `Some bills arrive every month whatever you make: rent, the machine lease, the supervisor’s salary, insurance, software, maintenance and marketing come to ${BN($0(D.F))}. Others rise and fall with the cars you make: birch, paint, cartons, freight, power and, in this factory, the line crew, who are paid by the hour only while the line runs. The first kind are ${G('fixed cost', 'fixed costs')}; the second are ${G('variable cost', 'variable costs')}.`,
  setup: async ctx => {
    ensureCss();
    const e = ctx.engine;
    call(e, 'setStopped', false);
    call(e, 'setCfg', { ...DEFAULT_CAR });
    if (!(call(e, 'lineUnits') || []).length) call(e, 'fillLine', { ...DEFAULT_CAR }, { count: 7 });
  },
  teardown: ctx => { call(ctx.engine, 'setStopped', false); },
  hook: {
    text: () => 'Picture a month when the line never starts: no birch, no paint, no cars.',
    predict: {
      id: 'p7', kind: 'choice', scored: false, prompt: 'Would that month cost the factory anything?', options: [
        { text: 'No: no cars, no costs', correct: false, why: `Rent and the other monthly bills still come: ${$0(D.F)}.` },
        { text: 'Yes: some bills come anyway', correct: true, why: `Rent and the other monthly bills come to ${$0(D.F)}, cars or no cars.` }
      ]
    }
  },
  worked: () => [
    { label: 'Fixed bills in a month with the marketing paused', value: $0(L7d.Rw.fixedTotal), how: `rent, lease, supervisor, insurance, software, maintenance, marketing: ${fixedSum(L7d.Rw)}` },
    { label: 'Variable cost per car sold', value: $(D.V), how: `started car ${$(D.k.started)} + scrap share ${$(D.k.scrapShare)} + carton ${$(D.k.carton)} + freight ${$(D.k.freight)}` },
    { label: `Variable costs at ${n(D.sold)} cars`, value: $0(D.mo.pl.variable), how: `${n(D.sold)} × ${$(D.V)}` },
    { label: 'Variable costs at 0 cars', value: $0(L7d.zeroW.pl.variable), how: `0 × ${$(D.V)}` },
    { label: 'That month, with no cars made', value: sgn0(L7d.zeroW.pl.profit), how: `${$0(0)} of sales − ${$0(0)} variable − ${$0(L7d.Rw.fixedTotal)} fixed` }
  ],
  steps: [
    {
      id: 'sort', on: [], done: ctx => !!mem(ctx).sorted,
      text: () => 'Sort the ten bills. For each one, tap Fixed or Variable.',
      widget: (el, ctx) => sortWidget(el, { cards: L7_CARDS, bins: ['Fixed', 'Variable'], label: 'Ten bills', onDone: () => { mem(ctx).sorted = true; complete(ctx, 'sort'); } })
    },
    {
      id: 'stop', on: [], done: ctx => !!mem(ctx).flipped,
      text: () => 'Read the Rules card, then flip <b>Line stopped all month</b>.',
      widget: (el, ctx) => stopWidget(el, ctx)
    }
  ],
  checks: [{
    id: 'c1', kind: 'number', unit: '$m', prompt: 'A month with zero cars: what do you pay?',
    answer: A('$m', D.F),
    distractors: [
      { id: 'nothing', value: A('$m', 0), msg: 'Rent still comes.' },
      { id: 'allCostsFixed', value: A('$m', D.F + D.mo.pl.variable), msg: 'Birch and cartons only cost money when you make cars.' },
      { id: 'crewFixed', value: A('$m', D.F + D.mo.pl.crew), msg: 'The crew are paid only while the line runs.' }
    ],
    step2: () => `Variable costs with no cars: 0 × ${$(D.V)} = ${$0(0)}. Fixed bills: ${fixedSum()} = ${BLANK}.`,
    solution: () => `Only the fixed bills come: ${fixedSum()} = ${BN($0(D.F))}. Variable costs are 0 × ${$(D.V)} = ${$0(0)}.`,
    hint: 'Ask: would this bill change if we made no cars?'
  }],
  twin: {
    id: 't1', kind: 'number', unit: '$m',
    prompt: `Rent goes up by ${$0(L7d.rise.rent)} and insurance by ${$0(L7d.rise.insurance)}. A month with zero cars: what do you pay?`,
    answer: A('$m', L7d.twin),
    distractors: [
      { id: 'oldBills', value: A('$m', D.F), msg: 'The rent and insurance went up: add both rises to the old bills.' },
      { id: 'rentOnly', value: A('$m', D.F + L7d.rise.rent), msg: 'Add the insurance rise too.' },
      { id: 'insuranceOnly', value: A('$m', D.F + L7d.rise.insurance), msg: 'Add the rent rise too.' },
      { id: 'nothing', value: A('$m', 0), msg: 'Rent still comes.' }
    ],
    step2: () => `${$0(D.F)} + ${$0(L7d.rise.rent)} + ${$0(L7d.rise.insurance)} = ${BLANK}`,
    solution: () => `${$0(D.F)} + ${$0(L7d.rise.rent)} + ${$0(L7d.rise.insurance)} = ${BN($0(L7d.twin))}. With no cars, only the fixed bills come.`,
    hint: 'Only the fixed bills come in a month with no cars.'
  },
  explainBack: {
    prompt: 'Why is crew pay variable here?',
    model: 'Here the crew are paid by the hour, and only while the line runs, so their pay rises and falls with the cars we make.',
    ideas: [{ id: 'hourly', text: 'They are paid by the hour' }, { id: 'whileRunning', text: 'Only while the line runs' }]
  },
  rule: 'Fixed costs come every month; variable costs come with each car.',
  hint: 'Ask: would this bill change if we made no cars?',
  misconceptions: ['A fixed cost is a fixed amount per car.', 'Labour is always fixed (or always variable): it depends on the deal, which the Rules card names.']
};

/* =====================================================================================================
   L8 · Spread thin
   ===================================================================================================== */
const L8d = (() => {
  const half = D.sold / 2, moHalf = econ.month(D.cfg, D.R, D.up, { sold: half });
  // the hook and the worked example use other volumes than the check (1,900) and the twin (950)
  const at = sold => econ.month(D.cfg, D.R, D.up, { sold });
  const hook = 1200, w1 = 1520, w2 = 2280;
  return { half, moHalf, lo: 1000, hi: D.sold, min: 100, hook, moHook: at(hook), w1, mo1: at(w1), w2, mo2: at(w2) };
})();
function volumeStep(el, ctx) {
  ensureCss(el.ownerDocument);
  el.innerHTML = `<div class="cs-b"><div data-w="where"></div><div data-w="vol"></div><div class="cs-b-card"><div class="cs-b-rows" data-out></div></div></div>`;
  const base = { cfg: D.cfg, R: D.R, up: D.up, price: D.P };
  const where = widget(ctx, 'whereBar', q(el, '[data-w=where]'), { ...base, sold: D.sold });
  const out = q(el, '[data-out]');
  const show = v => {
    const mo = econ.month(D.cfg, D.R, D.up, { sold: v });
    out.innerHTML = rowsHtml([
      [`Fixed share: ${NUM($0(mo.F))} ÷ ${NUM(n(v))} cars`, $(mo.perCar.fixedPerCar)],
      [`Full cost: ${NUM($(D.V))} + ${NUM($(mo.perCar.fixedPerCar))}`, $(mo.perCar.fullCost), 'total'],
      [`Profit per car at ${NUM($s(D.P))}`, `<span class="${sign(mo.perCar.profit)}">${$(mo.perCar.profit)}</span>`]
    ]);
  };
  const m = mem(ctx);
  const vol = widget(ctx, 'volumeSlider', q(el, '[data-w=vol]'), {
    min: L8d.min, max: D.cap, value: D.sold, step: 1, label: 'Cars sold this month',
    onInput: raw => {
      const v = Math.round(+raw);
      if (!Number.isFinite(v)) return;
      where.update?.({ sold: v }); show(v);
      // the readout is not a live region (it changes on every step); the slider itself says the key figure
      const mo = econ.month(D.cfg, D.R, D.up, { sold: v });
      q(el, '[data-w=vol] input[type=range]')?.setAttribute('aria-valuetext', `${n(v)} cars, full cost ${$(mo.perCar.fullCost)} a car`);
      if (v <= L8d.lo) m.lo = true;
      if (v >= L8d.hi) m.hi = true;
      if (m.lo && m.hi && !m.volDone) { m.volDone = true; complete(ctx, 'volume'); }
    }
  });
  show(D.sold);
  return () => { where.destroy?.(); vol.destroy?.(); el.innerHTML = ''; };
}
const L8 = {
  id: 'L8', unit: 'B', title: 'Spread thin', minutes: 5, scored: true,
  goal: 'Fixed cost per car depends on volume; full cost per car.',
  explain: () => `Fixed costs don’t change with volume, but their share per car does: ${$0(D.F)} over ${n(D.sold)} cars is ${BN($(D.fixedPer))} each, over ${n(L8d.half)} cars it’s ${BN($(L8d.moHalf.perCar.fixedPerCar))}. ${G('full cost', 'Full cost')} per car is the variable cost plus that share. So full cost is a fact about a month, not about a car.`,
  setup: async ctx => { ensureCss(); call(ctx.engine, 'setCfg', { ...DEFAULT_CAR }); },
  hook: {
    text: () => `Last month the works sold ${n(D.sold)} cars. This month a big shop cancels, and you sell only ${n(L8d.hook)}.`,
    predict: { id: 'p8', kind: 'number', scored: false, unit: '$', prompt: 'Guess the full cost of one car this month.', answer: A('$', L8d.moHook.perCar.fullCost) }
  },
  worked: () => [
    { label: 'Variable cost per car sold', value: $(D.V), how: `started ${$(D.k.started)} + scrap ${$(D.k.scrapShare)} + carton ${$(D.k.carton)} + freight ${$(D.k.freight)}` },
    { label: `Fixed share at ${n(L8d.w1)} cars`, value: $(L8d.mo1.perCar.fixedPerCar), how: `${$0(D.F)} ÷ ${n(L8d.w1)}` },
    { label: `Full cost at ${n(L8d.w1)} cars`, value: $(L8d.mo1.perCar.fullCost), how: `${$(D.V)} + ${$(L8d.mo1.perCar.fixedPerCar)}` },
    { label: `Fixed share at ${n(L8d.w2)} cars`, value: $(L8d.mo2.perCar.fixedPerCar), how: `${$0(D.F)} ÷ ${n(L8d.w2)}` },
    { label: `Full cost at ${n(L8d.w2)} cars`, value: $(L8d.mo2.perCar.fullCost), how: `${$(D.V)} + ${$(L8d.mo2.perCar.fixedPerCar)}` }
  ],
  steps: [{
    id: 'volume', on: [], done: ctx => !!mem(ctx).volDone,
    text: () => `Drag the volume slider down to ${n(L8d.lo)} cars or fewer, then up to ${n(L8d.hi)} or more. Watch the fixed segment.`,
    widget: (el, ctx) => volumeStep(el, ctx)
  }],
  checks: [{
    id: 'c1', kind: 'numbers', prompt: `You sell ${n(D.sold)} cars. Fixed cost per car? Full cost per car?`,
    fields: [
      { label: 'Fixed cost per car', unit: '$', answer: A('$', D.fixedPer), distractors: [
        { id: 'perStarted', value: A('$', D.F / D.mo.startedN), msg: 'Share the bills over the cars you sell, not the cars you start.' }] },
      { label: 'Full cost per car', unit: '$', answer: A('$', D.full), distractors: [
        { id: 'fixedOnly', value: A('$', D.fixedPer), msg: 'That’s only the fixed share; add the variable cost.' },
        { id: 'startedPlusFixed', value: A('$', D.k.started + D.fixedPer), msg: `A car sold also carries scrap, a carton and freight: start from the ${$(D.V)} variable cost, not the started cost.` }] }
    ],
    step2: () => `Fixed share = ${$0(D.F)} ÷ ${n(D.sold)} = ${BLANK}. Full cost = ${$(D.V)} + the fixed share.`,
    solution: () => `Fixed share = ${$0(D.F)} ÷ ${n(D.sold)} = ${BN($(D.fixedPer))}. Full cost = ${$(D.V)} + ${$(D.fixedPer)} = ${BN($(D.full))}.`,
    hint: `Full cost = ${$(D.V)} + ${$0(D.F)} ÷ cars.`
  }],
  twin: {
    id: 't1', kind: 'number', unit: '$', prompt: `Sales halve to ${n(L8d.half)}: full cost per car?`,
    answer: A('$', L8d.moHalf.perCar.fullCost),
    distractors: [
      { id: 'keptShare', value: A('$', D.full), msg: `You kept ${$(D.fixedPer)}, but the rent didn’t halve.` },
      { id: 'doubledAll', value: A('$', D.full * 2), msg: 'Only the fixed part doubles.' }
    ],
    step2: () => `Fixed share = ${$0(D.F)} ÷ ${n(L8d.half)} = ${$(L8d.moHalf.perCar.fixedPerCar)}. Full cost = ${$(D.V)} + ${$(L8d.moHalf.perCar.fixedPerCar)} = ${BLANK}.`,
    solution: () => `${$(D.V)} + ${$0(D.F)} ÷ ${n(L8d.half)} = ${$(D.V)} + ${$(L8d.moHalf.perCar.fixedPerCar)} = ${BN($(L8d.moHalf.perCar.fullCost))}.`,
    hint: `Full cost = ${$(D.V)} + ${$0(D.F)} ÷ cars.`
  },
  explainBack: {
    prompt: 'Why did the full cost rise when sales fell?',
    model: 'The fixed bills stayed the same, so fewer cars had to share them, and each car carried a bigger slice.',
    ideas: [{ id: 'sameBills', text: 'The same bills' }, { id: 'fewerCars', text: 'Fewer cars to share them' }]
  },
  rule: 'Full cost per car = variable cost + fixed costs ÷ cars sold.',
  hint: `Full cost = ${$(D.V)} + ${$0(D.F)} ÷ cars.`,
  misconceptions: ['Full cost is a fact about the car.']
};

/* =====================================================================================================
   L9 · Break-even
   ===================================================================================================== */
const SNAP = 20;
const L9d = (() => {
  const rise = 900, beTwin = econ.breakEven(D.F + rise, D.contrib);
  const startedBE = D.be * D.scrapMul, minBE = startedBE * D.k.cycle;
  const mix = econ.orderMix(SAMPLE_CARS, D.R, D.up, D.P);
  const worst = mix.reduce((a, b) => b.contribution < a.contribution ? b : a);
  const worstK = econ.carCost(worst.cfg, D.R, D.up);
  const why = `The tangerine Hatch. Its checker band and No. 4 make Livery ${mn(worstK.bott)} min, so its cycle is ${mn(worstK.cycle)} and each one sold costs ${$(worstK.variable)}. At ${$s(D.P)} it leaves only ${$(D.P - worstK.variable)}, about half of the default car’s ${$(D.contrib)}.`;
  // the worked example works break-even at another price, so it never prints the check's 1,140 or the twin's 1,230
  const wP = 30, wContrib = wP - D.V, wBE = econ.breakEven(D.F, wContrib);
  return { rise, beTwin, startedBE, minBE, hours: minBE / 60, mix, worst, worstK, worstKey: econ.carKey(worst.cfg), why, wP, wContrib, wBE };
})();
// The order mix (SPEC §2.10) as a table string for a check's feedback (the runner shows HTML there, not widgets).
function mixTableHtml() {
  ensureCss();
  const rows = econ.orderMix(undefined, D.R, D.up, D.P), worst = rows.reduce((a, b) => b.contribution < a.contribution ? b : a);
  return `<span class="cs-b-tablewrap" style="display:block;margin-top:8px"><table class="cs-b-table"><caption class="cs-b-lab" style="text-align:left;padding-bottom:4px">Order mix at ${$s(D.P)}</caption>
    <thead><tr><th>Car</th><th>Variable</th><th>Leaves</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="${r === worst ? 'is-pick' : ''}"><td>${esc(r.name.replace(' (the order)', ''))}<span class="cs-b-sub">slowest ${r.bottAll.map(b => STATIONS[b]).join(' & ')} ${mn(r.bott)} · cycle ${mn(r.cycle)}</span></td><td>${$(r.variable)}</td><td>${$(r.contribution)}</td></tr>`).join('')}
    </tbody></table></span>`;
}
function markerStep(el, ctx) {
  ensureCss(el.ownerDocument);
  el.innerHTML = `<div class="cs-b"><div data-w="be"></div><p class="cs-b-fb" data-fb aria-live="polite"></p></div>`;
  const fb = q(el, '[data-fb]'), m = mem(ctx);
  const chart = widget(ctx, 'breakEvenChart', q(el, '[data-w=be]'), {
    cfg: D.cfg, R: D.R, up: D.up, price: D.P, showTable: false,
    marker: {
      onPlace: raw => {
        const cars = Math.round(+raw);
        if (!Number.isFinite(cars)) return;
        if (Math.abs(cars - D.be) <= SNAP) {
          fb.className = 'cs-b-fb ok';
          fb.innerHTML = `${BN(n(D.be))} cars: revenue and total cost are both ${NUM($0(D.be * D.P))}. ${n(D.be)} to cover the month.`;
          if (!m.marker) { m.marker = true; call(ctx.engine, 'toast', `${n(D.be)} to cover the month`); complete(ctx, 'marker'); }
        } else {
          const rev = cars * D.P, cost = D.F + D.V * cars;
          fb.className = 'cs-b-fb bad';
          fb.innerHTML = `At ${NUM(n(cars))} cars, money in is ${NUM($0(rev))} and total cost is ${NUM($0(cost))}: ${rev < cost ? 'still a loss. Move the marker right.' : 'already a profit. Move it left.'}`;
        }
      }
    }
  });
  return () => { chart.destroy?.(); el.innerHTML = ''; };
}
const L9 = {
  id: 'L9', unit: 'B', title: 'Break-even', minutes: 7, scored: true,
  goal: 'Contribution per car and break-even volume.',
  explain: () => `Each car sold brings in its price and costs its variable cost; what’s left is its ${G('contribution')} toward the fixed bills. At ${$s(D.P)} with a ${$s(D.V)} variable cost, each car contributes ${BN($s(D.contrib))}. ${G('break-even', 'Break-even')} is the number of cars whose contributions just pay the ${$0(D.F)}.`,
  setup: async ctx => { ensureCss(); call(ctx.engine, 'setCfg', { ...DEFAULT_CAR }); call(ctx.engine, 'setCamera', 'overview'); },
  hook: {
    text: () => `Each car sold at ${$s(D.P)} costs ${$s(D.V)} to make and deliver, and the month’s bills are ${$0(D.F)}.`,
    predict: { id: 'p9', kind: 'number', scored: false, unit: 'cars', prompt: 'Guess: how many cars must you sell before the month stops losing money?', answer: A('cars', D.be) }
  },
  worked: () => { const d = L9d; return [
    { label: `Say the price were ${$s(d.wP)}. Contribution per car`, value: $(d.wContrib), how: `${$(d.wP)} − ${$(D.V)}` },
    { label: `Break-even at ${$s(d.wP)}`, value: `${n(d.wBE)} cars`, how: `${$0(D.F)} ÷ ${$(d.wContrib)}, rounded up` },
    { label: 'Sales at that break-even', value: $0(d.wBE * d.wP), how: `${n(d.wBE)} × ${$(d.wP)}` },
    { label: 'Total cost at that break-even', value: $0(D.F + d.wBE * D.V), how: `${$0(D.F)} + ${n(d.wBE)} × ${$(D.V)}` },
    { label: `Profit if you sold ${n(D.sold)} at ${$s(d.wP)}`, value: $0((D.sold - d.wBE) * d.wContrib), how: `(${n(D.sold)} − ${n(d.wBE)}) × ${$(d.wContrib)}: each car past break-even adds its contribution` }
  ]; },
  steps: [{
    id: 'marker', on: [], done: ctx => !!mem(ctx).marker,
    text: () => 'Drag the marker to where the revenue line crosses the total-cost line, then let go.',
    widget: (el, ctx) => markerStep(el, ctx)
  }],
  checks: [
    {
      id: 'c1', kind: 'number', unit: 'cars', prompt: `Price ${$s(D.P)}, variable cost ${$s(D.V)}, fixed ${$0(D.F)}. How many cars to break even?`,
      answer: A('cars', D.be),
      distractors: [
        { id: 'dividedByPrice', value: A('cars', Math.ceil(D.F / D.P)), msg: 'You divided by the price.' },
        { id: 'dividedByPrice', value: A('cars', Math.floor(D.F / D.P)), msg: 'You divided by the price.' },
        { id: 'dividedByProfit', value: A('cars', D.F / D.profitPer), msg: `You divided by the ${$s(D.profitPer)} profit after fixed costs; fixed costs can’t pay themselves.` },
        { id: 'whatYouSell', value: A('cars', D.sold), msg: 'That’s what you sell; break-even is fewer.' }
      ],
      step2: () => `Contribution = ${$(D.P)} − ${$(D.V)} = ${$(D.contrib)}. Break-even = ${$0(D.F)} ÷ ${$(D.contrib)} = ${BLANK} cars.`,
      solution: () => `${$0(D.F)} ÷ (${$(D.P)} − ${$(D.V)}) = ${$0(D.F)} ÷ ${$(D.contrib)} = ${BN(n(D.be))} cars.`,
      hint: 'Fixed costs ÷ contribution per car.'
    },
    {
      id: 'c2', kind: 'number', unit: 'h', bonus: true, prompt: 'Bonus: how many line hours does it take to start the cars for break-even?',
      answer: A('h', L9d.hours),
      distractors: [
        { id: 'soldNotStarted', value: A('h', D.be * D.k.cycle / 60), msg: `You used the cars sold. One in ${D.R.scrapEvery} is scrapped, so start ${n(D.be)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} = ${n(L9d.startedBE)}.` },
        { id: 'minutes', value: A('h', L9d.minBE), msg: 'That’s minutes; divide by 60 for hours.' }
      ],
      step2: () => `Started = ${n(D.be)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} = ${n(L9d.startedBE)}. Hours = ${n(L9d.startedBE)} × ${mn(D.k.cycle)} min ÷ 60 = ${BLANK}.`,
      solution: () => `${n(D.be)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} = ${n(L9d.startedBE)} started × ${mn(D.k.cycle)} min = ${mn(L9d.minBE)} min ÷ 60 = ${BN(mn(L9d.hours) + ' h')}.`,
      hint: 'Cars started × cycle minutes ÷ 60.'
    },
    {
      id: 'c3', kind: 'car', prompt: `At ${$s(D.P)}, which parked car leaves the least toward the bills? Tap it in the lot.`,
      answer: () => car => !!car?.cfg && econ.carKey(car.cfg) === L9d.worstKey,
      why: L9d.why,
      // a wrong pick: what that car leaves (the runner would otherwise show `why`, which names the answer)
      diagnose: (ctx, car) => {
        try { const k = econ.carCost(car.cfg, D.R, D.up); return `That car costs ${$(k.variable)} to make and deliver, so at ${$s(D.P)} it leaves ${$(D.P - k.variable)}. One parked car leaves less: look for the slowest station of all.`; }
        catch { return 'Not that one. Look for the car with the slowest station.'; }
      },
      // SPEC §3.3 L9: "The order-mix table (§2.10) then appears" — shown with the answer, right or revealed.
      // CONTRACT-GAP: a check has no widget slot after the answer, so the table is an HTML string in `after`/`solution`.
      after: () => L9d.why + mixTableHtml(),
      solution: () => L9d.why + mixTableHtml(),
      hint: 'Contribution = price − variable cost. Which car has the slowest station of all?'
    }
  ],
  twin: {
    id: 't1', kind: 'number', unit: 'cars', prompt: `The fixed bills rise by ${$0(L9d.rise)}. How many cars to break even now?`,
    answer: A('cars', L9d.beTwin),
    distractors: [
      { id: 'oldBills', value: A('cars', D.be), msg: `The bills went up: divide the new ${$0(D.F + L9d.rise)}.` },
      { id: 'riseOnly', value: A('cars', L9d.rise / D.contrib), msg: `That’s only the extra ${$0(L9d.rise)} ÷ ${$(D.contrib)}; the old bills still need paying.` },
      { id: 'dividedByPrice', value: A('cars', Math.ceil((D.F + L9d.rise) / D.P)), msg: 'You divided by the price.' }
    ],
    step2: () => `(${$0(D.F)} + ${$0(L9d.rise)}) ÷ ${$(D.contrib)} = ${$0(D.F + L9d.rise)} ÷ ${$(D.contrib)} = ${BLANK} cars.`,
    solution: () => `${$0(D.F + L9d.rise)} ÷ ${$(D.contrib)} = ${BN(n(L9d.beTwin))} cars.`,
    hint: 'Fixed costs ÷ contribution per car.'
  },
  explainBack: {
    prompt: `Why divide by ${$s(D.contrib)} and not by ${$s(D.profitPer)}?`,
    model: `The ${$s(D.profitPer)} profit per car already has a share of the fixed bills taken out. Each car’s ${$s(D.contrib)} contribution is what pays the bills, so the bills ÷ ${$s(D.contrib)} gives the cars needed.`,
    ideas: [{ id: 'alreadyOut', text: `${$s(D.profitPer)} already has the fixed costs taken out` }, { id: 'paysBills', text: `Each car’s ${$s(D.contrib)} pays the bills` }]
  },
  rule: 'Break-even cars = fixed costs ÷ contribution per car.',
  hint: 'Fixed costs ÷ contribution per car.',
  misconceptions: ['If the price beats the full cost, I profit at any volume.']
};

/* =====================================================================================================
   L10 · Markup is not margin
   ===================================================================================================== */
const L10d = (() => {
  const cost = D.full, mk = 0.30, mg = 0.30;
  const pMk = cost * (1 + mk), pMg = econ.priceForMargin(cost, mg);
  const twinCost = 27, twinMg = 0.25;
  // the hook and the worked example use other costs and percentages than the checks ($28 at 30%) and the twin ($27 at 25%)
  const hookCost = 35, hookPMk = hookCost * (1 + mk), hookPMg = econ.priceForMargin(hookCost, mg);
  const wCost = 24, wPct = 0.25, wPMk = wCost * (1 + wPct), wPMg = econ.priceForMargin(wCost, wPct);
  return {
    cost, mk, mg, pMk, pMg, marginAtMk: econ.marginOf(pMk, cost), markupAtMg: econ.markupOf(pMg, cost), twinCost, twinMg, twin: econ.priceForMargin(twinCost, twinMg),
    hookCost, hookPMk, hookPMg, wCost, wPct, wPMk, wPMg, wMarginAtMk: econ.marginOf(wPMk, wCost), wMarkupAtMg: econ.markupOf(wPMg, wCost)
  };
})();
function markupStep(el, ctx) {
  ensureCss(el.ownerDocument);
  // the feedback line is not a live region (it changes on every slider step); the runner announces the step when done
  el.innerHTML = `<div class="cs-b"><div class="cs-b-lab">Price tag on the carton</div><div data-w="calc"></div><p class="cs-b-fb" data-fb></p></div>`;
  const m = mem(ctx), fb = q(el, '[data-fb]');
  m.moved ||= {};
  // the margin shown on the tag rounds to 30.0%: anything further off is not "a 30% margin"
  const at30 = p => Number.isFinite(p) && Math.abs(econ.marginOf(p, L10d.cost) - L10d.mg) < 0.0005;
  const both = () => (m.moved.markup && m.moved.margin) || m.moves >= 2;
  const say = () => {
    const ok = at30(m.price);
    fb.className = 'cs-b-fb' + (ok ? ' ok' : '');
    fb.innerHTML = ok ? `A ${pc(L10d.mg, 0)} margin on a ${$(L10d.cost)} cost needs a ${BN($(L10d.pMg))} price. As a markup that is ${pc(L10d.markupAtMg)}.`
      : m.calcDone ? '' : !both() ? `Now move the ${m.moved.markup ? 'margin' : 'markup'} slider and watch the other one.` : `Now set the margin to ${pc(L10d.mg, 0)}.`;
  };
  const calc = widget(ctx, 'markupCalc', q(el, '[data-w=calc]'), {
    cost: L10d.cost,
    onChange: ({ price, moved, source } = {}) => {
      // CONTRACT-GAP: the contract's onChange({ markup, margin, price }) does not say which slider moved; ledger.js adds
      // `moved` ('markup' | 'margin'). Without it, any two changes count as both moved. Margin is recomputed from the price.
      const p = +price; if (!Number.isFinite(p) || p <= 0) return;
      m.price = p;
      const src = moved || source;
      if (src === 'markup' || src === 'margin') m.moved[src] = true; else m.moves = (m.moves || 0) + 1;
      say();
    }
  });
  // The step completes on a resting value: when a slider is let go (its 'change' event, also sent by arrow keys), the
  // margin then on the tag is 30% and both sliders have moved. A drag that only passes through 30% does not count.
  const onRelease = e => {
    if (!e.target?.matches?.('input[type=range]') || m.calcDone) return;
    if (both() && at30(m.price)) { m.calcDone = true; say(); complete(ctx, 'calc'); }
  };
  el.addEventListener('change', onRelease);
  return () => { el.removeEventListener('change', onRelease); calc.destroy?.(); el.innerHTML = ''; };
}
const L10 = {
  id: 'L10', unit: 'B', title: 'Markup is not margin', minutes: 5, scored: true,
  goal: 'Convert between markup (on cost) and margin (on price).',
  explain: () => `${G('markup', 'Markup')} is profit as a share of cost; ${G('margin')} is profit as a share of price. Because the price is bigger than the cost, the same dollars of profit are always a smaller percentage of the price. A ${pc(L10d.mk, 0)} markup gives only a ${BN(pc(L10d.marginAtMk))} margin.`,
  setup: async ctx => { ensureCss(); call(ctx?.engine, 'setCamera', 'overview'); },
  hook: {
    text: () => `Two friends price a car whose full cost is ${$s(L10d.hookCost)}. One adds ${pc(L10d.mk, 0)} to the cost. The other wants profit to be ${pc(L10d.mg, 0)} of the price.`,
    predict: {
      id: 'p10', kind: 'choice', scored: false, prompt: 'Do they get the same price?', options: [
        { text: 'Yes, the same price', correct: false, why: `${pc(L10d.mk, 0)} of the cost is ${$(L10d.hookCost * L10d.mk)}; ${pc(L10d.mg, 0)} of a bigger number is more.` },
        { text: 'The first price is higher', correct: false, why: `Adding ${pc(L10d.mk, 0)} gives ${$(L10d.hookPMk)}; the margin price is ${$(L10d.hookPMg)}.` },
        { text: 'The second price is higher', correct: true, why: `${$(L10d.hookPMg)} against ${$(L10d.hookPMk)}: a ${pc(L10d.mg, 0)} share of the price needs a bigger profit.` }
      ]
    }
  },
  worked: () => { const d = L10d; return [
    { label: 'Full cost of another car', value: $(d.wCost), how: 'given, to show the method on new numbers' },
    { label: `Price with a ${pc(d.wPct, 0)} markup`, value: $(d.wPMk), how: `${$(d.wCost)} × ${1 + d.wPct}` },
    { label: 'Profit per car', value: $(d.wPMk - d.wCost), how: `${$(d.wPMk)} − ${$(d.wCost)}` },
    { label: 'Margin at that price', value: pc(d.wMarginAtMk), how: `${$(d.wPMk - d.wCost)} ÷ ${$(d.wPMk)}` },
    { label: `Price for a ${pc(d.wPct, 0)} margin`, value: $(d.wPMg), how: `${$(d.wCost)} ÷ (1 − ${d.wPct.toFixed(2)})` },
    { label: 'Markup at that price', value: pc(d.wMarkupAtMg), how: `${$(d.wPMg - d.wCost)} ÷ ${$(d.wCost)}` }
  ]; },
  steps: [{
    id: 'calc', on: [], done: ctx => !!mem(ctx).calcDone,
    text: () => `Move the markup slider and the margin slider. Then set a ${pc(L10d.mg, 0)} margin.`,
    widget: (el, ctx) => markupStep(el, ctx)
  }],
  checks: [
    {
      id: 'c1', kind: 'number', unit: '$', prompt: `Full cost ${$s(L10d.cost)}. What price makes profit ${pc(L10d.mg, 0)} of the price?`,
      answer: A('$', L10d.pMg),
      distractors: [
        { id: 'markupInstead', value: A('$', L10d.pMk), msg: `You added ${pc(L10d.mk, 0)} to cost; that’s markup.` },
        { id: 'profitOnly', value: A('$', L10d.pMg - L10d.cost), msg: 'That’s the profit in dollars; the question asks for the price.' },
        { id: 'shareOfCost', value: A('$', L10d.cost * L10d.mg), msg: `That’s ${pc(L10d.mg, 0)} of the cost. Price = cost ÷ (1 − margin).` }
      ],
      step2: () => `Price = ${$(L10d.cost)} ÷ (1 − ${L10d.mg.toFixed(2)}) = ${$(L10d.cost)} ÷ ${(1 - L10d.mg).toFixed(2)} = ${BLANK}`,
      solution: () => `${$(L10d.cost)} ÷ ${(1 - L10d.mg).toFixed(2)} = ${BN($(L10d.pMg))}. Check: profit ${$(L10d.pMg - L10d.cost)} ÷ price ${$(L10d.pMg)} = ${pc(L10d.mg)}.`,
      hint: 'Price = cost ÷ (1 − margin).'
    },
    {
      id: 'c2', kind: 'number', unit: '%', prompt: `At ${$(L10d.pMk)}, what share of the price is profit?`,
      answer: A('%', L10d.marginAtMk * 100),
      distractors: [
        { id: 'markupAgain', value: A('%', L10d.mk * 100), msg: 'That’s the markup: profit ÷ cost. Margin divides the same profit by the price.' }
      ],
      step2: () => `Profit = ${$(L10d.pMk)} − ${$(L10d.cost)} = ${$(L10d.pMk - L10d.cost)}. Margin = ${$(L10d.pMk - L10d.cost)} ÷ ${$(L10d.pMk)} = ${BLANK}`,
      solution: () => `${$(L10d.pMk - L10d.cost)} ÷ ${$(L10d.pMk)} = ${BN(pc(L10d.marginAtMk))}.`,
      hint: 'Margin = profit ÷ price.'
    }
  ],
  twin: {
    id: 't1', kind: 'number', unit: '$', prompt: `Full cost ${$s(L10d.twinCost)}. What price gives a ${pc(L10d.twinMg, 0)} margin?`,
    answer: A('$', L10d.twin),
    distractors: [{ id: 'markupInstead', value: A('$', L10d.twinCost * (1 + L10d.twinMg)), msg: `That’s a ${pc(L10d.twinMg, 0)} markup.` }],
    step2: () => `Price = ${$(L10d.twinCost)} ÷ (1 − ${L10d.twinMg.toFixed(2)}) = ${$(L10d.twinCost)} ÷ ${(1 - L10d.twinMg).toFixed(2)} = ${BLANK}`,
    solution: () => `${$(L10d.twinCost)} ÷ ${(1 - L10d.twinMg).toFixed(2)} = ${BN($(L10d.twin))}.`,
    hint: 'Price = cost ÷ (1 − margin).'
  },
  explainBack: {
    prompt: 'Why is the margin smaller than the markup?',
    model: 'Both use the same dollars of profit, but margin divides them by the price, which is bigger than the cost, so the percentage comes out smaller.',
    ideas: [{ id: 'sameProfit', text: 'The same profit' }, { id: 'biggerNumber', text: 'Divided by a bigger number' }]
  },
  rule: 'Price for a margin = cost ÷ (1 − margin).',
  hint: 'Price = cost ÷ (1 − margin).',
  misconceptions: ['Markup and margin are the same thing.']
};

/* =====================================================================================================
   L11 · Price moves demand
   ===================================================================================================== */
const L11d = (() => {
  const at = p => econ.month(D.cfg, D.R, D.up, { price: p });
  const range = { from: 24, to: 46, step: 0.5 };
  const best = econ.bestPrice(D.cfg, D.R, D.up, range);
  const accepted = econ.priceSweep(D.cfg, D.R, D.up, range).filter(r => Math.abs(r.price - best.price) <= range.step + EPS).map(r => r.price);
  const w = econ.profitWindow(D.cfg, D.R, D.up);
  // the worked example works another price than Check 1 ($36) and the twin ($38); $35 would print the twin's profit and
  // $34 is warm-up W11's, so it uses $33
  const wP = 33;
  return { at, range, best, accepted, kink: w.kink, lo: 28, hi: 40, m28: at(28), m32: D.mo, m36: at(36), m38: at(38), m40: at(L10d.pMg), p40: L10d.pMg, wP, mW: at(wP) };
})();
function sweepStep(el, ctx) {
  ensureCss(el.ownerDocument);
  el.innerHTML = `<div class="cs-b"><div data-w="slider"></div><div data-w="chart"></div><div class="cs-b-card"><div class="cs-b-rows" data-out></div></div></div>`;
  const m = mem(ctx), out = q(el, '[data-out]'), r = L11d.range;
  let slider = null, chart = null;
  const show = p => {
    const mo = econ.month(D.cfg, D.R, D.up, { price: p });
    // revenue, profit, line busy and lost sales are on the chart's own read line; this adds where the volume comes from
    out.innerHTML = rowsHtml([
      [`Shops order ${NUM(n(D.R.demandIntercept))} − ${NUM(n(D.R.demandSlope))} × ${NUM($s(p))}`, n(mo.Q)],
      ['The line can make', n(D.cap)],
      [`Sold at ${NUM($(p))}`, `${n(mo.sold)}${mo.lostSales > 0.5 ? ` <span class="cs-b-loss">(${n(mo.lostSales)} lost)</span>` : ''}`, 'total']
    ]);
  };
  const setP = (raw, from) => {
    const p = +raw; if (!Number.isFinite(p)) return;
    if (from !== 'chart') chart?.update?.({ price: p });
    if (from !== 'slider') slider?.set?.(p);
    show(p);
    // not a live region: the slider says the key figures itself
    const mo = econ.month(D.cfg, D.R, D.up, { price: p });
    q(el, '[data-w=slider] input[type=range]')?.setAttribute('aria-valuetext', `${$(p)}: ${n(mo.sold)} sold, revenue ${$0(mo.pl.sales)}, profit ${$0(mo.pl.profit)}`);
    if (p <= L11d.lo + EPS) m.lo = true;
    if (p >= L11d.hi - EPS) m.hi = true;
    if (m.lo && m.hi && !m.sweepDone) { m.sweepDone = true; complete(ctx, 'sweep'); }
  };
  slider = widget(ctx, 'priceSlider', q(el, '[data-w=slider]'), { value: D.P, from: r.from, to: r.to, step: r.step, readout: false, cfg: D.cfg, R: D.R, up: D.up, onInput: p => setP(p, 'slider') });
  // profit, revenue and line-busy curves (SPEC §3.3 L11); the peak stays hidden because Check 3 asks for it
  chart = widget(ctx, 'priceProfitChart', q(el, '[data-w=chart]'), { cfg: D.cfg, R: D.R, up: D.up, price: D.P, ...r, series: ['profit', 'revenue', 'util'], hidePeak: true, onPrice: p => setP(p, 'chart') });
  show(D.P);
  return () => { slider?.destroy?.(); chart?.destroy?.(); el.innerHTML = ''; };
}
const L11 = {
  id: 'L11', unit: 'B', title: 'Price moves demand', minutes: 8, scored: true,
  goal: 'Profit = contribution × volume − fixed; demand; capacity; revenue is not profit.',
  explain: () => `Shops buy fewer cars when the price goes up: ${n(D.sold)} a month at ${$s(D.P)}, and ${n(D.R.demandSlope)} fewer for every ${$s(1)} more. That is ${G('demand')}. A higher price earns more per car but sells fewer cars, so ${G('profit')} peaks somewhere in the middle. The line also has a ceiling, its ${G('capacity')}: ${BN(n(D.cap))} good cars a month.`,
  setup: async ctx => { ensureCss(); call(ctx.engine, 'setCamera', 'overview'); call(ctx.engine, 'setCfg', { ...DEFAULT_CAR }); },
  hook: {
    text: () => `A shop says: drop the price to ${$s(L11d.lo)} and the shops will take ${n(L11d.m28.Q)} a month instead of ${n(D.sold)}.`,
    predict: {
      id: 'p11', kind: 'choice', scored: false, prompt: `Would you make more profit at ${$s(L11d.lo)}?`, options: [
        { text: 'Yes: more cars, more profit', correct: false, why: `Each car would leave only ${$(L11d.lo - D.V)}: profit ${$0(L11d.m28.pl.profit)}.` },
        { text: `No: ${$s(D.P)} makes more`, correct: true, why: `${$0(D.mo.pl.profit)} at ${$s(D.P)} against ${$0(L11d.m28.pl.profit)} at ${$s(L11d.lo)}.` }
      ]
    }
  },
  worked: () => [
    { label: `Cars at ${$s(D.P)}`, value: n(D.sold), how: `${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × ${$s(D.P)}` },
    { label: `Profit at ${$s(D.P)}`, value: $0(D.mo.pl.profit), how: `${n(D.sold)} × ${$(D.contrib)} − ${$0(D.F)}` },
    { label: `Cars at ${$s(L11d.wP)}`, value: n(L11d.mW.sold), how: `${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × ${$s(L11d.wP)}` },
    { label: `Profit at ${$s(L11d.wP)}`, value: $0(L11d.mW.pl.profit), how: `${n(L11d.mW.sold)} × ${$(L11d.wP - D.V)} − ${$0(D.F)}` },
    { label: 'Capacity', value: `${n(D.cap)} cars`, how: `${n(D.R.available)} min ÷ ${mn(D.k.cycle)} × ${D.R.scrapEvery - 1} ÷ ${D.R.scrapEvery}` },
    { label: 'Below this price shops want more than the line makes', value: $(L11d.kink), how: `(${n(D.R.demandIntercept)} − ${n(D.cap)}) ÷ ${n(D.R.demandSlope)}` }
  ],
  steps: [{
    id: 'sweep', on: [], done: ctx => !!mem(ctx).sweepDone,
    text: () => `Slide the price down to ${$s(L11d.lo)} or less, then up to ${$s(L11d.hi)} or more. Watch revenue and profit.`,
    widget: (el, ctx) => sweepStep(el, ctx)
  }],
  checks: [
    {
      id: 'c1', kind: 'number', unit: '$m', prompt: `What is the monthly profit at ${$s(36)}?`,
      answer: A('$m', L11d.m36.pl.profit),
      distractors: [
        { id: 'keptVolume', value: A('$m', (36 - D.V) * D.sold - D.F), msg: `You kept selling ${n(D.sold)}.` },
        { id: 'noFixed', value: A('$m', L11d.m36.pl.contribution), msg: `Take off the ${$0(D.F)} of fixed bills.` },
        { id: 'revenueIsProfit', value: A('$m', L11d.m36.pl.sales), msg: 'That’s the money coming in (revenue), not the profit.' }
      ],
      step2: () => `At ${$s(36)} shops order ${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × 36 = ${n(L11d.m36.sold)} cars. Profit = (${$s(36)} − ${$s(D.V)}) × ${n(L11d.m36.sold)} − ${$0(D.F)} = ${BLANK}`,
      solution: () => `${n(L11d.m36.sold)} × ${$(36 - D.V)} − ${$0(D.F)} = ${$0(L11d.m36.pl.contribution)} − ${$0(D.F)} = ${BN($0(L11d.m36.pl.profit))}.`,
      hint: `Cars = ${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × price, then (price − ${$s(D.V)}) × cars − ${$0(D.F)}.`
    },
    {
      id: 'c2', kind: 'choice', prompt: `${$s(L11d.lo)} or ${$s(D.P)}: which brings in more money, and which makes more profit?`,
      options: [
        { text: `${$s(L11d.lo)} brings in more money; ${$s(D.P)} makes more profit`, correct: true, why: `${$0(L11d.m28.pl.sales)} against ${$0(D.mo.pl.sales)} in, but ${$0(L11d.m28.pl.profit)} against ${$0(D.mo.pl.profit)} profit.` },
        { text: `${$s(L11d.lo)} brings in more money and makes more profit`, correct: false, why: `More money comes in at ${$s(L11d.lo)}, but each car leaves only ${$(L11d.lo - D.V)} toward ${$0(D.F)} of bills: profit ${$0(L11d.m28.pl.profit)}.` },
        { text: `${$s(D.P)} brings in more money and makes more profit`, correct: false, why: `Fewer cars sell at ${$s(D.P)}: ${$0(D.mo.pl.sales)} in, against ${$0(L11d.m28.pl.sales)} at ${$s(L11d.lo)}.` },
        { text: `${$s(D.P)} brings in more money; ${$s(L11d.lo)} makes more profit`, correct: false, why: `It’s the other way round: ${$s(L11d.lo)} brings in ${$0(L11d.m28.pl.sales)} but makes only ${$0(L11d.m28.pl.profit)}.` }
      ],
      hint: 'Revenue = price × cars. Profit = contribution × cars − fixed bills.'
    },
    {
      id: 'c3', kind: 'price', prompt: 'Place the best price on the price → profit chart.',
      accepted: L11d.accepted, widget: 'priceProfitChart', best: L11d.best.price,
      solution: () => `The peak is ${BN($(L11d.best.price))} → ${BN($0(L11d.best.profit))}. Half a dollar either side, profit is ${$0(econ.profitAt(D.cfg, L11d.accepted[0], D.R, D.up))}.`,
      hint: 'Find the top of the profit curve, not the revenue curve.'
    },
    {
      id: 'c4', kind: 'number', unit: '%', prompt: `Your ${$s(L11d.p40)} price for a ${pc(L10d.mg, 0)} margin from L10 (worked out at ${n(D.sold)} cars): what’s the real margin?`,
      answer: A('%', L11d.m40.perCar.margin * 100),
      distractors: [
        { id: 'plannedMargin', value: A('%', L10d.mg * 100), msg: `That’s the margin you planned at ${n(D.sold)} cars. At ${$s(L11d.p40)} only ${n(L11d.m40.sold)} sell, so each car carries ${$(L11d.m40.perCar.fixedPerCar)} of fixed bills.` },
        { id: 'markupNotMargin', value: A('%', L11d.m40.perCar.markup * 100), msg: 'That’s profit ÷ cost (markup). Margin divides by the price.' }
      ],
      step2: () => `At ${$s(L11d.p40)} shops order ${n(L11d.m40.sold)}. Fixed per car = ${$0(D.F)} ÷ ${n(L11d.m40.sold)} = ${$(L11d.m40.perCar.fixedPerCar)}. Full cost ${$(L11d.m40.perCar.fullCost)}, profit ${$(L11d.m40.perCar.profit)} per car. Margin = ${$(L11d.m40.perCar.profit)} ÷ ${$(L11d.p40)} = ${BLANK}`,
      solution: () => `At ${$s(L11d.p40)} only ${n(L11d.m40.sold)} cars sell, so fixed cost per car is ${$(L11d.m40.perCar.fixedPerCar)}: full cost ${$(L11d.m40.perCar.fullCost)}, profit ${$(L11d.m40.perCar.profit)} per car, and ${$(L11d.m40.perCar.profit)} ÷ ${$(L11d.p40)} = ${BN(pc(L11d.m40.perCar.margin))}.`,
      hint: 'A new price means a new volume, so a new fixed share per car.'
    }
  ],
  twin: {
    id: 't1', kind: 'number', unit: '$m', twinOf: 'c1', prompt: `What is the monthly profit at ${$s(38)}?`,
    answer: A('$m', L11d.m38.pl.profit),
    distractors: [
      { id: 'keptVolume', value: A('$m', (38 - D.V) * D.sold - D.F), msg: `You kept selling ${n(D.sold)}.` },
      { id: 'noFixed', value: A('$m', L11d.m38.pl.contribution), msg: `Take off the ${$0(D.F)} of fixed bills.` }
    ],
    step2: () => `At ${$s(38)} shops order ${n(L11d.m38.sold)} cars. Profit = (${$s(38)} − ${$s(D.V)}) × ${n(L11d.m38.sold)} − ${$0(D.F)} = ${BLANK}`,
    solution: () => `${n(L11d.m38.sold)} × ${$(38 - D.V)} − ${$0(D.F)} = ${BN($0(L11d.m38.pl.profit))}.`,
    hint: `Cars = ${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × price, then (price − ${$s(D.V)}) × cars − ${$0(D.F)}.`
  },
  explainBack: {
    prompt: `Why does ${$s(L11d.lo)} bring in more money but less profit?`,
    model: `At ${$s(L11d.lo)} the shops buy ${n(L11d.m28.sold)} cars, so more money comes in, but each car leaves only ${$s(L11d.lo - D.V)} instead of ${$s(D.contrib)}, and the ${$0(D.F)} of fixed bills stay the same.`,
    ideas: [{ id: 'moreCars', text: 'More cars' }, { id: 'lessPerCar', text: 'Much less per car' }, { id: 'sameBills', text: 'Fixed bills unchanged' }]
  },
  rule: 'Profit = contribution × cars sold − fixed costs, and cars sold depends on price.',
  hint: `Cars = ${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × price, then (price − ${$s(D.V)}) × cars − ${$0(D.F)}.`,
  misconceptions: ['Cut the price, sell more, make more.', 'More revenue means more profit.', 'A price set from cost locks in the margin.']
};

/* =====================================================================================================
   L12 · Profit is not cash
   ===================================================================================================== */
const L12d = (() => {
  // wOpen: the worked example opens with other cash than Check 1 ($60,000) and the twin ($55,000)
  const open = 60000, months = 3, twinOpen = 55000, wOpen = 65000;
  const cal = econ.cashCalendar(D.cfg, D.R, D.up, { open, months });
  const wEom1 = econ.cashCalendar(D.cfg, D.R, D.up, { open: wOpen, months: 1 }).eom[0];
  const cal0 = econ.cashCalendar(D.cfg, D.R, D.up, { open: 0, months: 24 });
  const least = econ.leastOpeningCash(D.cfg, D.R, D.up, { months });
  const backMonth = cal0.eom.findIndex(b => b >= -0.5) + 1;
  const twin = econ.cashCalendar(D.cfg, D.R, D.up, { open: twinOpen, months: 1 }).eom[0];
  const DPM = D.R.daysPerMonth;
  const d0 = cal0.days, low = cal0.days[cal0.lowAt.index];
  const it = (day, re) => (day.items.find(x => re.test(x.item)) || { amount: 0 }).amount;
  const prodDays = d0.slice(0, DPM).filter(d => d.good > EPS);
  const fullDays = prodDays.filter(d => Math.abs(d.good - cal0.goodPerDay) < 1e-6).length;
  const part = prodDays.find(d => Math.abs(d.good - cal0.goodPerDay) >= 1e-6);
  return {
    open, months, twinOpen, wOpen, wEom1, cal, cal0, least, backMonth, twin, DPM,
    m1Out: -cal0.eom[0], fixedIn: it(low, /Fixed/), prodIn: it(low, /Materials|Crew/), recvIn: it(low, /Shops/), lowNet: low.net,
    day1: d0[0], fullDays, part, dayVar: it(d0[1], /Materials/), afterLow: d0[cal0.lowAt.index + 1].net
  };
})();
/// The cash calendar replayed day by day (0.2 s a day) through the ledger's cashChart (its `upTo` draws the ribbon and the
// balance line so far). CONTRACT-GAP: `upTo` is a ledger.js extra, not in the contract, and ledger.runMonth(plan) has no
// plan shape or pause callback in the contract, so the replay runs here; the fallback chart supports `upTo` too. Pauses on
// the first day below zero; Skip draws the rest. The Bank chip follows via app.bank. The Ledger's own "Run 3 months"
// also counts (its app events tick the step, see L12.steps).
// Screen readers hear month ends, the pause and the finish (one status line), not every day.
const replayBus = ctx => { const m = mem(ctx); return (m.replayBus ||= { subs: new Set(), on(f) { this.subs.add(f); return () => this.subs.delete(f); }, emit() { this.subs.forEach(f => { try { f(); } catch { } }); } }); };
const markReplay = ctx => { const m = mem(ctx); if (m.replayDone) return false; m.replayDone = true; replayBus(ctx).emit(); return true; };
function replayWidget(el, ctx) {
  ensureCss(el.ownerDocument);
  const d = L12d, cal = d.cal, days = cal.days, fn = cal.firstNeg;
  el.innerHTML = `<div class="cs-b cs-b-replay" data-done="false">
    <div class="cs-b-row"><span class="cs-b-lab">Cash calendar · months 1 to ${d.months}</span><span class="cs-b-num">open ${$0(d.open)}</span></div>
    <div data-w="chart"></div>
    <div class="cs-b-row"><span data-today>Press Run to start on day 1.</span><b class="cs-b-num" data-bank>${$0(d.open)}</b></div>
    <p class="cs-b-sr" role="status" data-say></p>
    <div class="cs-b-pause" data-pause hidden role="status"></div>
    <div class="cs-b-seg"><button type="button" class="cs-b-btn cs-b-primary" data-act="run">Run the cash calendar</button><button type="button" class="cs-b-btn" data-act="skip">Skip</button></div>
    <div class="cs-b-rows" data-sum hidden></div></div>`;
  const m = mem(ctx), box = q(el, '.cs-b-replay'), sayEl = q(el, '[data-say]');
  const chart = widget(ctx, 'cashChart', q(el, '[data-w=chart]'), { calendar: cal, upTo: -1 });
  let timer = null, sayT = null, paidToast = false;
  const mark = () => { markReplay(ctx); complete(ctx, 'replay'); };
  const sayIt = t => { clearTimeout(sayT); sayEl.textContent = ''; sayT = setTimeout(() => { sayEl.textContent = t; }, 30); };
  const show = (k, quiet = false) => {
    const day = days[k];
    q(el, '[data-today]').textContent = `Month ${day.month} · day ${day.day} · ${day.net === 0 ? 'nothing moves' : sgn0(day.net)}`;
    const bk = q(el, '[data-bank]'); bk.textContent = $0(day.balance); bk.className = 'cs-b-num ' + (day.balance < 0 ? 'cs-b-loss' : '');
    try { ctx.app?.set?.({ bank: day.balance }); } catch { }
    if (day.day === d.DPM && k < days.length - 1 && !quiet) sayIt(`End of month ${day.month}: bank ${$0(day.balance)}.`);
    if (quiet || reduced()) return;
    // the three toasts of SPEC §4.7
    const fixed = day.items.find(x => /Fixed/.test(x.item)), prod = day.items.find(x => x.good), paid = day.items.find(x => /Shops/.test(x.item));
    if (k === 0 && fixed && prod) call(ctx.engine, 'toast', `Rent &amp; bills ${sgn0(fixed.amount)} · Birch, crew, power… ${sgn0(prod.amount)}`);
    else if (paid && !paidToast) { paidToast = true; call(ctx.engine, 'toast', `Shops paid ${sgn0(paid.amount)}`); }
  };
  const draw = k => { chart.update?.({ upTo: k }); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const finish = () => {
    stop(); draw(days.length - 1); show(days.length - 1, true);
    q(el, '[data-pause]').hidden = true; box.dataset.done = 'true';
    const sum = q(el, '[data-sum]'); sum.hidden = false;
    sum.innerHTML = rowsHtml([
      ...cal.eom.map((b, k) => [`Bank at the end of month ${k + 1}`, `<span class="${sign(b)}">${$0(b)}</span>`]),
      ['Lowest point', `${NUM(`<span class="${sign(cal.low)}">${$0(cal.low)}</span>`)} · day ${cal.lowAt.day} of month ${cal.lowAt.month}`, 'total wrapv']
    ]);
    sayIt(`Months 1 to ${d.months} done. Bank at the end: ${$0(cal.eom[cal.eom.length - 1])}. Lowest point ${$0(cal.low)}, day ${cal.lowAt.day} of month ${cal.lowAt.month}.`);
    q(el, '[data-act=run]').disabled = true; q(el, '[data-act=skip]').disabled = true;
    mark();
  };
  const pauseAt = k => {
    stop();
    const day = days[k], p = q(el, '[data-pause]');
    p.hidden = false;
    p.innerHTML = `<p class="cs-b-p"><b>Out of cash on day ${day.day} of month ${day.month}</b>${day.month > 1 ? `: the month’s bills are due before the shops have paid for most of month ${day.month - 1}.` : ': the bills and the wages come before any shop has paid.'}</p>
      <div class="cs-b-seg"><button type="button" class="cs-b-btn" data-act="go">Keep going</button></div>`;
    q(p, '[data-act=go]').addEventListener('click', () => { p.hidden = true; play(k + 1, false); });
    mark();
  };
  const play = (from, stopAtNeg) => {
    stop();
    const pauseK = stopAtNeg && fn ? fn.index : -1;
    if (reduced()) { // drawn at once, no tween
      const end = pauseK >= 0 ? pauseK : days.length - 1;
      draw(end); show(end, true);
      return pauseK >= 0 ? pauseAt(pauseK) : finish();
    }
    let k = from - 1;
    timer = setInterval(() => {
      k++;
      if (k >= days.length - 1) return finish();
      draw(k); show(k);
      if (k === pauseK) pauseAt(k);
    }, 200);
  };
  q(el, '[data-act=run]').addEventListener('click', () => { q(el, '[data-act=run]').disabled = true; play(0, true); });
  q(el, '[data-act=skip]').addEventListener('click', finish);
  return () => { stop(); clearTimeout(sayT); chart.destroy?.(); try { ctx.app?.set?.({ bank: null }); } catch { } el.innerHTML = ''; };
}
function lowPointWidget(el, ctx) {
  ensureCss(el.ownerDocument);
  const d = L12d, cal = d.cal, lo = cal.lowAt, day = cal.days[lo.index], prev = cal.days[lo.index - 1].balance;
  el.innerHTML = `<div class="cs-b"><button type="button" class="cs-b-btn" aria-expanded="false" data-act="why"></button><div class="cs-b-card" data-body hidden></div></div>`;
  const btn = q(el, '[data-act=why]'), body = q(el, '[data-body]');
  // the button names the day only once the replay has shown it (Run to the pause, Skip, or the Ledger's own run)
  const label = () => { btn.textContent = mem(ctx).replayDone ? `Why is day ${lo.day} of month ${lo.month} the low point?` : 'Why is the low point where it is?'; };
  label();
  const off = replayBus(ctx).on(label);
  btn.addEventListener('click', () => {
    const open = body.hidden; body.hidden = !open; btn.setAttribute('aria-expanded', open);
    if (!open) return;
    body.innerHTML = `<p class="cs-b-p">Three things land on day ${lo.day} of month ${lo.month}:</p>
      <div class="cs-b-rows">${rowsHtml([
        ['The month’s fixed bills', sgn0(d.fixedIn)],
        ['A day of birch, crew, power and cartons', sgn0(d.prodIn)],
        [`Shops pay for day 1 of month ${lo.month - 1} only`, `<span class="cs-b-gain">${sgn0(d.recvIn)}</span>`],
        ['That day', sgn0(day.net), 'total'],
        ['Bank', `${NUM($0(prev))} → ${NUM(`<span class="${sign(day.balance)}">${$0(day.balance)}</span>`)}`, 'wrapv']
      ])}</div>
      <p class="cs-b-p cs-b-muted">The month’s fixed bills (${$0(-d.fixedIn)}) fall due at once, while the shops are only starting to pay for last month. From the next day each day brings in more than it costs (${sgn0(d.afterLow)} a day), so the balance climbs back.</p>`;
    const m = mem(ctx);
    if (!m.lowOpened) { m.lowOpened = true; complete(ctx, 'low'); }
  });
  return () => { off(); el.innerHTML = ''; };
}
let L12R = null; // the rules L12 set (teardown restores the defaults only over these)
const L12 = {
  id: 'L12', unit: 'B', title: 'Profit is not cash', minutes: 7, scored: true,
  goal: 'When cash moves, and the lowest cash point.',
  explain: () => `${G('profit', 'Profit')} counts a sale when the car is delivered; ${G('cash')} counts it when the shop pays, 30 days later. Your own bills don’t wait: rent is due on the 1st, and birch, wages and power are paid as you use them. So a profitable factory can run out of money while it waits to be paid.`,
  setup: async ctx => {
    ensureCss();
    const d = L12d;
    // the lesson's rules carry its opening cash too, so the Bank chip and the Ledger read $60,000 whenever no replay is
    // moving the bank (main.js shows bank ?? scenario.open; the Ledger reads R.openingCash)
    L12R = econ.rules({ openingCash: d.open, months: d.months });
    try { ctx.app?.set?.({ scenario: { id: 'L12', cfg: { ...DEFAULT_CAR }, open: d.open, months: d.months, locked: true }, R: L12R, bank: null }); } catch (e) { console.warn('[course-b] L12 scenario', e); }
    const e = ctx.engine;
    call(e, 'setCamera', 'overview');
    call(e, 'setCfg', { ...DEFAULT_CAR });
    if (!(call(e, 'lineUnits') || []).length) call(e, 'fillLine', { ...DEFAULT_CAR }, { count: 7 });
  },
  teardown: ctx => {
    try {
      // put the default rules back only if nobody has replaced the lesson's own since (the Factory floor applies its own)
      const back = ctx.app?.state?.R === L12R && L12R ? { R: econ.rules() } : {};
      ctx.app?.set?.({ scenario: null, bank: null, ...back });
    } catch { }
    L12R = null;
  },
  hook: {
    text: () => `A carton rolls onto the truck and prints an ${G('invoice')}: “Invoice ${$(D.P)} · due in 30 days”.`,
    predict: {
      id: 'p12', kind: 'choice', scored: false, prompt: 'Does the bank go up when the truck leaves?', options: [
        { text: `Yes, by ${$(D.P)}`, correct: false, why: 'The invoice is money owed to you. The bank moves when the shop pays, 30 days later.' },
        { text: 'No, not until the shop pays', correct: true, why: 'The invoice is money owed to you; the bank moves when the shop pays.' }
      ]
    }
  },
  worked: () => {
    const d = L12d, c = d.cal0;
    return [
      { label: 'Month 1, day 1', value: sgn0(d.day1.net), how: `rent & bills ${sgn0(-D.F)} and a day of production ${sgn0(-c.goodPerDay * D.V)} (${n(c.goodPerDay)} cars × ${$(D.V)})` },
      { label: `Days 2 to ${d.fullDays}`, value: `${sgn0(-c.goodPerDay * D.V)} a day`, how: `${n(c.goodPerDay)} good cars × ${$(D.V)}, paid the same day` },
      ...(d.part ? [{ label: `Day ${d.part.day}`, value: sgn0(d.part.net), how: `the last ${n(d.part.good)} cars of the month × ${$(D.V)}` }] : []),
      { label: 'Cash out in month 1', value: sgn0(-d.m1Out), how: `${$0(D.F)} + ${n(D.sold)} × ${$(D.V)}; nothing comes in yet` },
      { label: 'Profit in month 1', value: sgn0(D.mo.pl.profit), how: `counted when the cars are delivered: ${n(D.sold)} × ${$(D.contrib)} − ${$0(D.F)}` },
      { label: `Bank at the end of month 1 if you open with ${$0(d.wOpen)}`, value: $0(d.wEom1), how: `${$0(d.wOpen)} − ${$0(d.m1Out)}` }
    ];
  },
  steps: [
    {
      // the card's own replay completes it directly; the Ledger's "Run 3 months" counts too, through its app events
      id: 'replay', on: ['monthRun', 'cashOut'],
      done: (ctx, evt) => { if (evt && (evt.type === 'cashOut' || ['pause', 'skip', 'end'].includes(evt.phase))) markReplay(ctx); return !!mem(ctx).replayDone; },
      text: () => `Run the cash calendar for months 1 to ${L12d.months}, opening with ${$0(L12d.open)}. Each loaded carton prints an invoice; the bank moves only when shops pay.`,
      widget: (el, ctx) => replayWidget(el, ctx)
    },
    {
      // the card's button, or the Ledger run's "What went out and came in that day" / its statement
      id: 'low', on: ['lowPoint'],
      done: (ctx, evt) => { const m = mem(ctx); if (evt?.type === 'lowPoint') m.lowOpened = true; return !!m.lowOpened; },
      text: () => 'Open the low-point explanation.',
      widget: (el, ctx) => lowPointWidget(el, ctx)
    }
  ],
  checks: (d => [
      {
        id: 'c1', kind: 'number', unit: '$m', prompt: `Month 1 shows ${$0(D.mo.pl.profit)} profit. You opened with ${$0(d.open)}. Bank at the end of month 1?`,
        answer: A('$m', d.cal.eom[0]),
        distractors: [
          { id: 'profitNotCash', value: A('$m', d.open + D.mo.pl.profit), msg: 'That’s profit, not cash.' },
          { id: 'fixedOnly', value: A('$m', d.open - D.F), msg: 'You counted only the fixed bills.' },
          { id: 'noOpening', value: A('$m', -d.m1Out), msg: `Start from the ${$0(d.open)}.` }
        ],
        step2: () => `Month 1: nothing comes in. Out go the bills ${$0(D.F)} and ${n(D.sold)} cars × ${$(D.V)} = ${$0(D.mo.pl.variable)}. Bank = ${$0(d.open)} − ${$0(d.m1Out)} = ${BLANK}`,
        solution: () => `${$0(d.open)} − ${$0(D.F)} − ${$0(D.mo.pl.variable)} = ${BN($0(d.cal.eom[0]))}.`,
        hint: 'Month 1: nothing comes in; everything you spent goes out.'
      },
      {
        id: 'c2', kind: 'number', unit: '$m', prompt: 'What is the least opening cash that never goes below zero?',
        answer: A('$m', d.least),
        distractors: [
          { id: 'monthOneOnly', value: A('$m', d.m1Out), msg: 'That covers month 1, but on day 1 of month 2 rent is due before the shops have paid for most of month 1.' },
          { id: 'dipOnly', value: A('$m', -d.cal.low), msg: `That’s how far a ${$0(d.open)} start falls below zero. The least opening cash is ${$0(d.open)} plus that.` }
        ],
        step2: () => `From ${$0(0)}, month 1 ends at ${sgn0(-d.m1Out)}. Day 1 of month 2: ${sgn0(d.fixedIn)} ${sgn0(d.prodIn)} ${sgn0(d.recvIn)}. The lowest balance is ${BLANK}, and you need that much to start.`,
        solution: () => `${$0(d.m1Out)} + ${$0(-d.fixedIn)} + ${$0(-d.prodIn)} − ${$0(d.recvIn)} = ${BN($0(d.least))}.`,
        hint: 'Find the lowest end-of-day balance when you start from $0.'
      },
      {
        id: 'c3', kind: 'choice', prompt: `Starting from ${$0(0)}, when is the end-of-month balance back to zero?`,
        options: [
          { text: 'End of month 2', correct: false, why: `Shops start paying in month 2, but month 2’s own bills come too: the balance is still ${$0(d.cal0.eom[1])}.` },
          { text: `End of month ${d.backMonth - 1}`, correct: false, why: `Count month 1 too: month 1 makes the ${$0(d.m1Out)} hole, then each later month adds ${$0(D.mo.pl.profit)}.` },
          { text: `End of month ${d.backMonth}`, correct: true, why: `Each month after the first adds ${$0(D.mo.pl.profit)}: ${$0(-d.m1Out)} + ${n(d.backMonth - 1)} × ${$0(D.mo.pl.profit)} = ${$0(0)}.` },
          { text: 'Never', correct: false, why: `Each month after the first adds ${$0(D.mo.pl.profit)}, so it does climb back.` }
        ],
        hint: `After month 1 the balance rises by the monthly profit, ${$0(D.mo.pl.profit)}.`
      }
    ])(L12d),
  twin: (d => ({
      id: 't1', kind: 'number', unit: '$m', twinOf: 'c1', prompt: `Open with ${$0(d.twinOpen)}: bank at the end of month 1?`,
      answer: A('$m', d.twin),
      distractors: [
        { id: 'profitNotCash', value: A('$m', d.twinOpen + D.mo.pl.profit), msg: 'That’s profit, not cash.' },
        { id: 'fixedOnly', value: A('$m', d.twinOpen - D.F), msg: 'You counted only the fixed bills.' },
        { id: 'noOpening', value: A('$m', -d.m1Out), msg: `Start from the ${$0(d.twinOpen)}.` }
      ],
      step2: () => `${$0(d.twinOpen)} − ${$0(D.F)} − ${$0(D.mo.pl.variable)} = ${BLANK}`,
      solution: () => `${$0(d.twinOpen)} − ${$0(d.m1Out)} = ${BN($0(d.twin))}.`,
      hint: 'Month 1: nothing comes in; everything you spent goes out.'
    }))(L12d),
  explainBack: {
    prompt: `How can you make ${$0(D.mo.pl.profit)} profit and still run out of cash?`,
    model: 'The shops pay 30 days after delivery, but birch, wages and power are paid as you use them and rent is due on the 1st, so the money goes out long before it comes back in.',
    ideas: [{ id: 'shopsLater', text: 'Shops pay later' }, { id: 'billsNow', text: 'Bills are paid now' }, { id: 'rentFirst', text: 'Rent is due first' }]
  },
  rule: 'Cash arrives when customers pay, not when you deliver.',
  hint: 'Month 1: nothing comes in; everything you spent goes out.',
  misconceptions: ['A profitable business can’t run out of money.']
};

/* =====================================================================================================
   L13 · Price your own car (the course end; SPEC appendix "changes decided after the build review")
   The learner picks any car, fills a blank sheet for it (every line checked against econ.js for THAT car), puts its price
   on its own price → profit chart, works out break-even, reads the demand check and saves the sheet. No scored checks:
   each step completes from the learner's own actions.
   ===================================================================================================== */
const L13_PRICE = { from: 24, to: 46, step: 0.5 }, L13_MARGIN = { min: 5, max: 45, value: 25 };
const SHEET_TOL = { '$': 0.01, '$m': 1, min: 0.05, cars: 0, '%': 0.1, h: 0.05 };
const plainText = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const carSpec = cfg => {
  const C = econ.CATALOG, roof = econ.roofOk(cfg.body, cfg.roof) ? cfg.roof : 'none', num = String(cfg.number ?? '').trim();
  return [C.body[cfg.body]?.label, C.finish[cfg.finish]?.label, C.livery[cfg.livery]?.label + (cfg.livery === 'plain' ? ' livery' : ''), num ? `No. ${num}` : '',
    `${C.wheels[cfg.wheels]?.label} wheels`, cfg.bumper !== 'none' ? `${C.bumper[cfg.bumper]?.label} bumpers` : 'no bumpers', roof !== 'none' ? C.roof[roof]?.label : ''].filter(Boolean).join(' · ');
};
const carName = cfg => {
  const key = econ.carKey(cfg);
  if (key === econ.carKey(DEFAULT_CAR)) return 'The red Coupe (the default car)';
  const s = SAMPLE_CARS.find(x => econ.carKey(x.cfg) === key);
  return s ? s.name : `Your ${econ.CATALOG.body[cfg.body]?.label || 'car'}`;
};
// Everything the sheet checks, for one car and one plan. Two values per line where rounding matters: the sheet's own
// (each line rounded to the cent, as an accountant writes it) and the exact one (a calculator's); both are right.
function l13Figures(cfg, plan = null) {
  const R = D.R, up = D.up, k = econ.carCost(cfg, R, up), mo = econ.month(cfg, R, up);
  const cap = Math.floor(mo.capGood + EPS);
  // plan prices where the shops order no more than the line makes, so "cars sold" is the shops' order (a whole number)
  const minP = Math.max(L13_PRICE.from, Math.ceil((R.demandIntercept - cap) / R.demandSlope / L13_PRICE.step - EPS) * L13_PRICE.step);
  const f = {
    cfg, k, R, up, cap, minP, F: econ.fixedTotal(R, up),
    crewPower: k.crewCost + k.power, goodSheet: econ.r2(k.good), doorSheet: econ.r2(k.good) + k.carton + k.freight
  };
  if (plan) {
    const m = plan.margin / 100, Q = econ.month(cfg, R, up, { price: plan.price }).sold;
    const shareSheet = econ.r2(f.F / Q), fullSheet = f.doorSheet + shareSheet, fullExact = k.variable + f.F / Q;
    Object.assign(f, { plan, m, Q, share: f.F / Q, shareSheet, fullSheet, fullExact, priceSheet: econ.r2(fullSheet / (1 - m)), priceExact: fullExact / (1 - m) });
  }
  return f;
}
const l13Bus = ctx => { const m = mem(ctx); return (m.l13Bus ||= { subs: new Set(), on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }, emit() { [...this.subs].forEach(fn => { try { fn(); } catch (e) { console.warn('[course-b] L13', e); } }); } }); };
const waitNote = (el, text) => { el.innerHTML = `<div class="cs-b"><p class="cs-b-wait">${text}</p></div>`; };

// A sheet of blanks: the runner's ctx.ui.blanks when there is one (it looks like Unit A's receipts), else a small stand-in.
// Rows: { label, value?, unit, total?, how?, accept?: () => [values] }. A row with `accept` is a blank: the learner's figure
// counts when it is within the unit's tolerance of any listed value; the first value is the one "Show this line" fills in.
function sheetBlanks(el, ctx, { rows, onDone }) {
  const doc = el.ownerDocument, host = doc.createElement('div');
  host.className = 'cs-b-blanks'; el.append(host);
  const inputs = [], blanks = rows.filter(r => r.accept);
  const tol = u => SHEET_TOL[u] ?? 0.01;
  const mapped = rows.map(r => {
    if (!r.accept) return { ...r };
    const i = blanks.indexOf(r);
    // the runner calls `answer` when it checks a line: give back the learner's own figure when it is one of the right ones
    return { ...r, answer: () => { const vals = r.accept(), v = parseNumber(inputs[i]?.value); return v !== null && vals.some(a => Math.abs(v - a) <= tol(r.unit) + 1e-9) ? v : vals[0]; } };
  });
  let cleanup;
  if (typeof ctx.ui?.blanks === 'function') cleanup = ctx.ui.blanks(host, { rows: mapped, onDone, reveal: true });
  else cleanup = fbBlanks(host, { rows: mapped, onDone });
  inputs.push(...host.querySelectorAll('input'));
  // name the unit of each box for screen readers (the runner's boxes say "dollars" for every unit but minutes)
  const word = { '$': 'dollars', '$m': 'dollars', min: 'minutes', cars: 'cars', '%': 'percent', h: 'hours' };
  blanks.forEach((r, i) => inputs[i]?.setAttribute('aria-label', `${plainText(r.label)}, ${word[r.unit] || 'dollars'}`));
  return { inputs, destroy() { try { cleanup?.(); } catch { } host.remove(); } };
}
// The stand-in sheet (harness, or a runner without ctx.ui): same rules as the runner's, simple markup.
function fbBlanks(el, { rows, onDone }) {
  const fmtV = (u, x) => typeof x !== 'number' ? String(x ?? '') : u === 'min' ? mn(x) + ' min' : u === 'cars' ? n(x) + ' cars' : u === '%' ? pc(x / 100) : $(x);
  el.innerHTML = rows.map((r, i) => `<div class="cs-b-brow${r.total ? ' total' : ''}" data-r="${i}"><span>${r.label}</span>${r.answer === undefined ? `<b>${fmtV(r.unit, r.value)}</b>`
    : `<span class="cs-b-input">${r.unit === '$' ? '<span class="cs-b-unit">$</span>' : ''}<input type="text" inputmode="decimal" autocomplete="off" spellcheck="false">${r.unit && r.unit !== '$' ? `<span class="cs-b-unit">${r.unit === 'cars' ? 'cars' : r.unit}</span>` : ''}</span>`}<span class="cs-b-mark" aria-hidden="true"></span></div>`).join('')
    + `<div class="cs-b-seg"><button type="button" class="cs-b-btn" data-act="check">Check these</button></div><p class="cs-b-fb" role="status" data-msg></p>`;
  const st = rows.map((r, i) => r.answer === undefined ? null : { r, row: q(el, `[data-r="${i}"]`), inp: q(el, `[data-r="${i}"] input`), ok: false, wrong: 0 }).filter(Boolean);
  let fired = false;
  const one = (s, counting) => {
    if (s.ok) return true;
    const v = parseNumber(s.inp.value), mark = q(s.row, '.cs-b-mark'), box = q(s.row, '.cs-b-input');
    if (v === null) { mark.textContent = ''; box.classList.remove('bad'); return false; }
    const t = s.r.answer(), unit = s.r.unit || '$';
    if (Math.abs(v - t) <= (SHEET_TOL[unit] ?? 0.01) + 1e-9) {
      s.ok = true; s.inp.readOnly = true; box.classList.remove('bad'); box.classList.add('ok'); mark.textContent = '✓'; mark.className = 'cs-b-mark ok'; s.inp.removeAttribute('aria-invalid');
      return true;
    }
    if (counting) s.wrong++;
    box.classList.add('bad'); mark.textContent = '×'; mark.className = 'cs-b-mark bad'; s.inp.setAttribute('aria-invalid', 'true');
    if (s.wrong >= 2 && !s.show) {
      s.show = el.ownerDocument.createElement('div'); s.show.className = 'cs-b-how';
      s.show.innerHTML = `<button type="button" class="cs-b-btn">Show this line</button>`;
      q(s.show, 'button').addEventListener('click', () => {
        s.inp.value = String(econ.r2(s.r.answer())); one(s, false);
        s.show.innerHTML = s.r.how ? (typeof s.r.how === 'function' ? s.r.how() : s.r.how) : ''; done();
      });
      s.row.append(s.show);
    }
    return false;
  };
  const msg = q(el, '[data-msg]');
  const done = () => { if (!fired && st.every(s => s.ok)) { fired = true; msg.className = 'cs-b-fb ok'; msg.textContent = 'All lines right.'; q(el, '[data-act=check]').hidden = true; onDone?.(); } };
  const all = () => {
    let wrong = 0, empty = 0;
    for (const s of st) { if (s.ok) continue; if (parseNumber(s.inp.value) === null) { empty++; continue; } if (!one(s, true)) wrong++; }
    msg.className = 'cs-b-fb' + (wrong ? ' bad' : ''); msg.textContent = wrong ? `${wrong} line${wrong > 1 ? 's' : ''} not right yet.` : empty ? 'Fill in the empty lines.' : '';
    done();
  };
  st.forEach(s => {
    s.inp.setAttribute('aria-label', plainText(s.r.label));
    s.inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); all(); } });
    s.inp.addEventListener('change', () => { one(s, false); done(); });
  });
  q(el, '[data-act=check]').addEventListener('click', all);
  return () => { el.innerHTML = ''; };
}

// Step 1: pick a car (the order form's, the default car or a parked sample car)
function l13Pick(el, ctx) {
  ensureCss(el.ownerDocument);
  const m = mem(ctx), bus = l13Bus(ctx);
  const formCfg = () => { const c = ctx.engine?.cfg; return c && econ.CATALOG.body[c.body] ? { ...c } : null; };
  const options = () => [
    ...(formCfg() ? [{ key: 'form', name: 'The car on your order form', cfg: formCfg(), wide: true }] : []),
    { key: 'default', name: 'The red Coupe (the default car)', cfg: { ...DEFAULT_CAR } },
    ...SAMPLE_CARS.map((s, i) => ({ key: 's' + i, name: s.name, cfg: { ...s.cfg } }))
  ];
  let sel = null;
  const render = () => {
    if (m.car) {
      el.innerHTML = `<div class="cs-b"><div class="cs-b-card" tabindex="-1" data-summary><div class="cs-b-lab">Your car</div><p class="cs-b-p"><b>${esc(m.car.name)}</b></p><p class="cs-b-p cs-b-muted">${esc(carSpec(m.car.cfg))}</p>
        ${m.carDone ? '' : '<div class="cs-b-seg"><button type="button" class="cs-b-btn" data-act="again">Pick another car</button></div>'}</div></div>`;
      q(el, '[data-act=again]')?.addEventListener('click', () => { m.car = null; m.carDone = false; sel = null; render(); bus.emit(); q(el, '[data-car]')?.focus(); });
      return;
    }
    const opts = options();
    el.innerHTML = `<div class="cs-b">
      <div class="cs-b-pick" role="group" aria-label="Cars to price">${opts.map(o => `<button type="button" class="cs-b-btn${o.wide ? ' wide' : ''}" data-car="${o.key}" aria-pressed="${o.key === sel}">${esc(o.name)}<small>${esc(carSpec(o.cfg))}</small></button>`).join('')}</div>
      <div class="cs-b-seg">${formCfg() ? '<button type="button" class="cs-b-btn" data-act="order">Build one on the Order tab</button>' : ''}<button type="button" class="cs-b-btn cs-b-primary" data-act="go"${sel ? '' : ' disabled'}>Price this car</button></div></div>`;
    el.querySelectorAll('[data-car]').forEach(b => b.addEventListener('click', () => {
      sel = b.dataset.car; el.querySelectorAll('[data-car]').forEach(x => x.setAttribute('aria-pressed', x === b)); q(el, '[data-act=go]').disabled = false;
    }));
    q(el, '[data-act=order]')?.addEventListener('click', () => { sel = 'form'; try { ctx.app?.set?.({ tab: 'order' }); } catch { } render(); });
    q(el, '[data-act=go]').addEventListener('click', () => {
      const o = options().find(x => x.key === sel); if (!o) return;
      m.car = { cfg: o.cfg, name: o.key === 'form' ? carName(o.cfg).replace(/^The red Coupe.*$/, 'The red Coupe (your order form)') : o.name };
      // the order form is left as it is: put there, a parked car's own figures (the HUD's "Started" chip, the Order tab's
      // price block) would fill in the sheet for the learner
      render(); bus.emit(); complete(ctx, 'pick');
      q(el, '[data-summary]')?.focus(); // the pressed button is gone: keep focus on what replaced it
    });
  };
  // the order-form option follows the Order tab while the learner is still choosing
  const off = call(ctx.engine, 'on', 'optionChanged', () => { if (!m.car) { const f = q(el, '[data-car=form] small'); if (f && formCfg()) f.textContent = carSpec(formCfg()); } });
  render();
  return () => { try { off?.(); } catch { } el.innerHTML = ''; };
}

// Step 2: the car's own cost, from its parts to the shop's door
function l13Car(el, ctx) {
  ensureCss(el.ownerDocument);
  const m = mem(ctx), bus = l13Bus(ctx);
  let sheet = null, shownFor = null;
  const render = () => {
    if (m.car && shownFor === m.car) return;
    sheet?.destroy(); sheet = null; shownFor = m.car;
    if (!m.car) return waitNote(el, 'Pick your car in step 1 first.');
    const f = l13Figures(m.car.cfg), k = f.k, R = f.R;
    el.innerHTML = `<div class="cs-b"><div class="cs-b-card"><div class="cs-b-lab">${esc(m.car.name)}: parts and station minutes</div>
      <div class="cs-b-tablewrap"><table class="cs-b-spec"><thead><tr><th>Station</th><th>Parts</th><th class="n">Min</th></tr></thead><tbody>
      ${STATIONS.map((s, i) => `<tr><td>${s}</td><td>${k.parts[i].length ? k.parts[i].map(p => `${esc(p.label)} <span class="cs-b-num">${$(p.value)}</span>`).join(', ') : '<span class="cs-b-muted">none</span>'}</td><td class="n">${mn(k.m[i])}</td></tr>`).join('')}
      </tbody></table></div>
      <ul class="cs-b-givens"><li>The line moves for ${mn(R.moveMin)} min each cycle.</li>
        <li>Line meter: ${k.crew} people × ${fmt.rate(k.rate)} + power ${$(R.powerPerLineMin)} = ${$(k.lineRate)} for every minute of cycle.</li>
        <li>Consumables (sandpaper, masking, glue): ${$(k.consumables)} a car.</li>
        <li>1 in ${R.scrapEvery} cars started fails the final check. Carton ${$(R.carton)} and freight ${$(R.freight)} for each good car.</li></ul></div>
      <div data-sheet></div></div>`;
    sheet = sheetBlanks(q(el, '[data-sheet]'), ctx, {
      rows: [
        { label: 'Materials: add up the parts', unit: '$', accept: () => [k.materials], how: `${k.parts.flat().map(p => $(p.value)).join(' + ')} = ${$(k.materials)}` },
        { label: `Cycle: slowest station + ${mn(R.moveMin)} min`, unit: 'min', accept: () => [k.cycle], how: `${STATIONS[k.bottIdx]} ${mn(k.bott)} + ${mn(R.moveMin)} = ${mn(k.cycle)} min` },
        { label: `Crew and power: cycle × ${$(k.lineRate)}`, unit: '$', accept: () => [f.crewPower], how: `${mn(k.cycle)} × ${$(k.lineRate)} = ${$(f.crewPower)}` },
        { label: 'Consumables', unit: '$', value: k.consumables },
        { label: 'Started car', unit: '$', accept: () => [k.started], how: `${$(k.materials)} + ${$(f.crewPower)} + ${$(k.consumables)} = ${$(k.started)}` },
        { label: `Good car: started × ${R.scrapEvery} ÷ ${R.scrapEvery - 1}`, unit: '$', accept: () => [f.goodSheet, k.good], how: `${$(k.started)} × ${R.scrapEvery} ÷ ${R.scrapEvery - 1} = ${$(k.good)}` },
        { label: 'Carton + freight', unit: '$', value: k.carton + k.freight },
        { label: 'At the shop’s door: the cost of one car sold', unit: '$', total: true, accept: () => [f.doorSheet, k.variable], how: `${$(f.goodSheet)} + ${$(k.carton + k.freight)} = ${$(f.doorSheet)}` }
      ],
      onDone: () => { m.carDone = true; m.door = f.doorSheet; bus.emit(); complete(ctx, 'car'); }
    });
  };
  const off = bus.on(render);
  render();
  return () => { off(); sheet?.destroy(); el.innerHTML = ''; };
}

// Step 3: a price to plan with and a margin, then the month lines (volume, fixed share, full cost, price)
function l13Price(el, ctx) {
  ensureCss(el.ownerDocument);
  const m = mem(ctx), bus = l13Bus(ctx);
  let sheet = null, slider = null, state = null;
  const clear = () => { sheet?.destroy(); sheet = null; slider?.destroy?.(); slider = null; };
  const render = () => {
    const key = !m.carDone ? 'wait' : !m.plan ? 'choose' : 'sheet';
    if (key === state && key !== 'choose') return;
    if (key === 'choose' && state === 'choose' && slider) return;
    clear(); state = key;
    if (key === 'wait') return waitNote(el, 'Finish your car’s cost in step 2 first.');
    const f0 = l13Figures(m.car.cfg), R = f0.R;
    if (key === 'choose') {
      const p0 = Math.max(f0.minP, Math.min(L13_PRICE.to, D.P)), pick = { price: p0, margin: L13_MARGIN.value };
      el.innerHTML = `<div class="cs-b"><div class="cs-b-card">
        <p class="cs-b-p cs-b-muted">Shops order ${n(R.demandIntercept)} − ${n(R.demandSlope)} × the price, each month. Your line can make up to ${n(f0.cap)} of this car a month, so at these prices you sell what the shops order. The fixed bills are ${$0(f0.F)} a month.</p>
        <div data-w="price"></div>
        <div class="cs-b-field"><div class="cs-b-row"><span>The ${GW('margin')} you want</span><b class="cs-b-num" data-mg></b></div>
          <input class="cs-b-range" type="range" min="${L13_MARGIN.min}" max="${L13_MARGIN.max}" step="1" value="${pick.margin}" aria-label="The margin you want, percent" data-margin></div>
        <div class="cs-b-seg"><button type="button" class="cs-b-btn cs-b-primary" data-act="use">Fill in the month lines</button></div></div></div>`;
      const mg = q(el, '[data-margin]'), showMg = () => { q(el, '[data-mg]').textContent = `${mg.value}%`; mg.setAttribute('aria-valuetext', `${mg.value}%`); };
      mg.addEventListener('input', () => { pick.margin = +mg.value; showMg(); }); showMg();
      slider = widget(ctx, 'priceSlider', q(el, '[data-w=price]'), { value: p0, from: f0.minP, to: L13_PRICE.to, step: L13_PRICE.step, readout: false, label: 'Price to plan with', cfg: m.car.cfg, R, up: D.up, onInput: p => { const v = +p; if (Number.isFinite(v)) pick.price = v; } });
      q(el, '[data-act=use]').addEventListener('click', () => { m.plan = { price: pick.price, margin: pick.margin }; render(); q(el, '[data-sheet] input')?.focus(); });
      return;
    }
    const f = l13Figures(m.car.cfg, m.plan), P = m.plan.price, M = m.plan.margin;
    el.innerHTML = `<div class="cs-b"><div class="cs-b-row"><span>Your plan: price ${BN($(P))} · margin ${BN(M + '%')}</span>${m.priceDone ? '' : '<button type="button" class="cs-b-btn" data-act="change">Change</button>'}</div><div data-sheet></div></div>`;
    q(el, '[data-act=change]')?.addEventListener('click', () => { m.plan = null; render(); q(el, '[data-w=price] input')?.focus(); });
    sheet = sheetBlanks(q(el, '[data-sheet]'), ctx, {
      rows: [
        { label: `Cars sold at ${$(P)}: ${n(R.demandIntercept)} − ${n(R.demandSlope)} × ${$s(P)}`, unit: 'cars', accept: () => [f.Q], how: `${n(R.demandIntercept)} − ${n(R.demandSlope)} × ${$s(P)} = ${n(f.Q)} cars` },
        { label: `Fixed share: ${$0(f.F)} ÷ cars sold`, unit: '$', accept: () => [f.shareSheet, f.share], how: `${$0(f.F)} ÷ ${n(f.Q)} = ${$(f.share)}` },
        { label: 'At the shop’s door (step 2)', unit: '$', value: f.doorSheet },
        { label: 'Full cost per car', unit: '$', total: true, accept: () => [f.fullSheet, f.fullExact], how: `${$(f.doorSheet)} + ${$(f.shareSheet)} = ${$(f.fullSheet)}` },
        { label: `Price for a ${M}% margin: full cost ÷ (1 − ${f.m.toFixed(2)})`, unit: '$', total: true, accept: () => [f.priceSheet, f.priceExact], how: `${$(f.fullSheet)} ÷ ${(1 - f.m).toFixed(2)} = ${$(f.priceSheet)}` }
      ],
      onDone: () => {
        // "your price" is the learner's own last figure (within a cent of the sheet's)
        const typed = parseNumber(sheet?.inputs?.at(-1)?.value);
        m.price = typed !== null && Math.abs(typed - f.priceSheet) <= 0.011 ? econ.r2(typed) : f.priceSheet;
        m.priceDone = true; m.fig = f; q(el, '[data-act=change]')?.remove(); bus.emit(); complete(ctx, 'price');
      }
    });
  };
  const off = bus.on(render);
  render();
  return () => { off(); clear(); el.innerHTML = ''; };
}

// The demand check at a price: what the shops order there, the real full cost and margin, break-even and the month.
function l13Facts(f, p) {
  const mo = econ.month(f.cfg, f.R, f.up, { price: p }), best = econ.bestPrice(f.cfg, f.R, f.up, { from: L13_PRICE.from, to: Math.max(L13_PRICE.to, Math.ceil(p)), step: L13_PRICE.step });
  const sold = mo.sold, rows = [[`Shops order at ${$(p)}`, `${n(mo.Q)} cars${mo.lostSales > EPS ? ` (the line makes ${n(f.cap)})` : ''}`], ['You planned on', `${n(f.Q)} cars at ${$(f.plan.price)}`]];
  if (sold > EPS) rows.push(['Fixed share now', $(mo.perCar.fixedPerCar)], ['Full cost now', $(mo.perCar.fullCost)], ['Real margin', `<span class="${sign(mo.perCar.margin)}">${pc(mo.perCar.margin)}</span> (you wanted ${f.plan.margin}%)`, 'wrapv']);
  // break-even from the learner's own sheet figures (cent-rounded cost to the door), so it matches the answer they gave
  const be = econ.breakEven(f.F, (f.R.shopTerms === 'early' ? p * 0.98 : p) - f.doorSheet);
  rows.push([`Break-even at ${$(p)}`, Number.isFinite(be) ? `${n(be)} cars` : 'never'], ['Profit a month', `<span class="${sign(mo.pl.profit)}">${sgn0(mo.pl.profit)}</span>`, 'total'], ['Most profit for this car', `${$(best.price)} → ${$0(best.profit)}`, 'wrapv']);
  const note = sold <= EPS ? `At ${$(p)} the shops order no cars at all. Pick a lower margin or a lower price.`
    : sold < be ? `The shops order fewer cars than break-even, so the month loses money. A lower price sells more.`
      : Math.abs(sold - f.Q) < 0.5 ? `The shops order the cars you planned on, so the margin holds.`
        : `The shops order ${n(sold)}, not the ${n(f.Q)} you planned on, so each car carries ${$(mo.perCar.fixedPerCar)} of the bills, not ${$(f.share)}. Check a price against demand before you print it.`;
  return { mo, best, html: `<div class="cs-b-rows">${rowsHtml(rows)}</div><p class="cs-b-p">${note}</p>` };
}

// Step 4: the car's own price → profit chart, the price on it, and its break-even
function l13Chart(el, ctx) {
  ensureCss(el.ownerDocument);
  const m = mem(ctx), bus = l13Bus(ctx);
  let chart = null, sheet = null, state = null;
  const clear = () => { chart?.destroy?.(); chart = null; sheet?.destroy(); sheet = null; };
  const render = () => {
    const key = m.priceDone ? 'chart' : 'wait';
    if (key === state) return;
    clear(); state = key;
    if (key === 'wait') return waitNote(el, 'Work out your price in step 3 first.');
    const f = m.fig, P = m.price;
    el.innerHTML = `<div class="cs-b"><div data-w="chart"></div>
      <div class="cs-b-seg"><button type="button" class="cs-b-btn cs-b-primary" data-act="place">Put my price on the chart (${$(P)})</button></div>
      <div data-be hidden></div><div class="cs-b-card" data-facts hidden><div class="cs-b-lab">Check it against demand</div><div class="cs-b-debrief" data-out></div></div></div>`;
    const facts = () => { if (!m.chartDone) return; const p = m.chartP ?? P; q(el, '[data-out]').innerHTML = l13Facts(f, p).html; };
    chart = widget(ctx, 'priceProfitChart', q(el, '[data-w=chart]'), {
      cfg: f.cfg, R: f.R, up: f.up, price: f.plan.price, ...L13_PRICE, series: ['profit', 'revenue', 'util'],
      onPrice: p => { const v = +p; if (!Number.isFinite(v)) return; m.chartP = v; facts(); bus.emit(); }
    });
    q(el, '[data-act=place]').addEventListener('click', () => {
      m.chartP = P; m.placed = true; chart.update?.({ price: P }); bus.emit();
      const be = q(el, '[data-be]');
      if (sheet) return;
      be.hidden = false;
      const door = f.doorSheet, beA = econ.breakEven(f.F, P - door), beB = econ.breakEven(f.F, P - f.k.variable);
      sheet = sheetBlanks(be, ctx, {
        rows: [{ label: `Break-even at ${$(P)}`, unit: 'cars', total: true, accept: () => [beA, beB], how: `${$0(f.F)} ÷ ${$(P - door)} = ${n(f.F / (P - door))}, so ${n(beA)} cars` }],
        onDone: () => { m.chartDone = true; q(el, '[data-facts]').hidden = false; facts(); bus.emit(); complete(ctx, 'chart'); }
      });
      q(be, 'input')?.focus();
    });
  };
  const off = bus.on(render);
  render();
  return () => { off(); clear(); el.innerHTML = ''; };
}

// The cost sheet as CSV: the ledger's builder when the runner passes it (ctx.buildCsv), else the same columns from econ.
// CONTRACT-GAP: ctx has no buildCsv in the contract; main.js has it as deps.buildCsv. Both write section,item,value,unit,how.
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csvNum = (x, u) => !Number.isFinite(x) ? '' : u === 'cars' ? String(Math.round(x * 10) / 10) : u === '%' ? x.toFixed(1) : u === 'min' ? String(econ.r1(x)) : x.toFixed(2);
function l13Csv(ctx, f, price, name) {
  const plan = [
    ['plan', 'Car', '', '', `${name}: ${carSpec(f.cfg)}`],
    ['plan', 'Price I planned with', csvNum(f.plan.price, '$'), '$', 'set by you'],
    ['plan', 'Cars the shops order at that price', csvNum(f.Q, 'cars'), 'cars', `${n(f.R.demandIntercept)} − ${n(f.R.demandSlope)} × ${$(f.plan.price)}`],
    ['plan', 'Full cost at that volume', csvNum(f.fullSheet, '$'), '$', `${$(f.doorSheet)} + ${$0(f.F)} ÷ ${n(f.Q)}`],
    ['plan', 'Margin I want', csvNum(f.plan.margin, '%'), '%', 'set by you'],
    ['plan', 'Price for that margin', csvNum(f.priceSheet, '$'), '$', `${$(f.fullSheet)} ÷ (1 − ${f.m.toFixed(2)})`]
  ];
  let file = null;
  if (typeof ctx.buildCsv === 'function') { try { file = ctx.buildCsv('costSheet', { cfg: f.cfg, R: f.R, up: f.up, price, wo: 'my-car' }); } catch (e) { console.warn('[course-b] buildCsv', e); } }
  if (!file?.text) {
    const cl = econ.costLines(f.cfg, f.R, f.up, { price });
    const rows = [['section', 'item', 'value', 'unit', 'how'], ...cl.lines.filter(l => l.section !== 'pl').map(l => [l.section, l.label, csvNum(l.value, l.unit), l.unit, l.how])];
    file = { filename: 'toyline-cost-sheet-my-car.csv', text: rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n', mime: 'text/csv' };
  }
  const extra = plan.map(r => r.map(csvCell).join(',')).join('\n');
  return { ...file, filename: 'toyline-cost-sheet-my-car.csv', text: file.text.replace(/\n?$/, '\n') + extra + '\n' };
}

// Step 5: save the sheet (platform.saveFile: a download, or its own Copy CSV box; without it, a read-only box here)
function l13Export(el, ctx) {
  ensureCss(el.ownerDocument);
  const m = mem(ctx), bus = l13Bus(ctx);
  let state = null, busy = false;
  const render = () => {
    const key = m.chartDone ? 'go' : 'wait';
    if (key === 'go' && state === 'go') { const p = q(el, '[data-p]'); if (p) p.textContent = $(m.chartP ?? m.price); return; }
    state = key;
    if (key === 'wait') return waitNote(el, 'Put your price on the chart in step 4 first.');
    el.innerHTML = `<div class="cs-b"><p class="cs-b-p">The sheet has every line for ${esc(m.car.name)} at <b class="cs-b-num" data-p>${$(m.chartP ?? m.price)}</b>, the price now on your chart (move the chart to save another), plus your plan.</p>
      <div class="cs-b-seg"><button type="button" class="cs-b-btn cs-b-primary" data-act="save">Save my cost sheet (CSV)</button></div>
      <p class="cs-b-fb" role="status" data-msg></p><div data-box></div></div>`;
    q(el, '[data-act=save]').addEventListener('click', async () => {
      if (busy) return; busy = true;
      const msg = q(el, '[data-msg]'), price = m.chartP ?? m.price;
      let file;
      try { file = l13Csv(ctx, m.fig, price, m.car.name); } catch (e) { console.warn('[course-b] L13 csv', e); msg.textContent = 'Could not build the file.'; busy = false; return; }
      let res = 'shown';
      if (typeof ctx.platform?.saveFile === 'function') { msg.textContent = `Preparing ${file.filename}…`; try { res = await ctx.platform.saveFile(file); } catch { res = 'error'; } }
      else {
        const box = q(el, '[data-box]');
        box.innerHTML = `<label class="cs-b-field"><span>${esc(file.filename)}: select the text and copy it</span><textarea class="cs-b-ta" readonly spellcheck="false"></textarea></label>`;
        q(box, 'textarea').value = file.text;
      }
      busy = false;
      if (!el.isConnected) return;
      msg.className = 'cs-b-fb' + (['saved', 'copied', 'shown'].includes(res) ? ' ok' : '');
      msg.textContent = { saved: `Saved ${file.filename}.`, declined: 'Save cancelled.', busy: 'A save prompt is already open.', copied: `Copied ${file.filename} to the clipboard.`, shown: `${file.filename} is shown as text: select it and copy.` }[res] || 'Saving is not available in this view.';
      if (['saved', 'copied', 'shown'].includes(res) && !m.exported) { m.exported = true; complete(ctx, 'export'); }
    });
  };
  const off = bus.on(render);
  render();
  return () => { off(); el.innerHTML = ''; };
}

const L13 = {
  id: 'L13', unit: 'B', title: 'Price your own car', minutes: 8, scored: false, capstone: true, layers: 'L2', // prices and minutes to read; nothing that works it out for you
  figures: l13Figures, // (cfg, { price, margin }) -> every figure the sheet checks; tools/check-course-b.mjs reads it
  goal: 'Price any car you like, from its parts to a price that leaves your margin, and check it against demand.',
  explain: () => `Time to price a car on your own. Work out its cost line by line: its parts, the minutes the line pays for, the ${G('scrap allowance')}, the carton and the truck. That is what one car costs at the shop’s door. Add its share of the month’s ${G('fixed cost', 'fixed bills')} at the number you expect to sell, and you have its ${G('full cost')}. Divide by (1 − the ${G('margin')} you want) to get a price. Then check that the shops still buy enough cars at that price.`,
  setup: async ctx => { ensureCss(); call(ctx.engine, 'setCamera', 'overview'); call(ctx.engine, 'setStopped', false); },
  hook: { text: () => 'Every lesson so far priced the red Coupe. Now you choose the car, and nobody works it out for you.' },
  worked: () => [],
  steps: [
    { id: 'pick', on: [], done: ctx => !!mem(ctx).car, text: () => 'Pick a car to price: one you built on the Order tab, or one of these. Then press <b>Price this car</b>.', widget: (el, ctx) => l13Pick(el, ctx) },
    { id: 'car', on: [], done: ctx => !!mem(ctx).carDone, text: () => 'Fill in what one of your cars costs, from its parts to the shop’s door.', widget: (el, ctx) => l13Car(el, ctx) },
    { id: 'price', on: [], done: ctx => !!mem(ctx).priceDone, text: () => 'Choose a price to plan with and the margin you want, then fill in the month lines.', widget: (el, ctx) => l13Price(el, ctx) },
    { id: 'chart', on: [], done: ctx => !!mem(ctx).chartDone, text: () => 'Put your price on your car’s price → profit chart and work out its break-even.', widget: (el, ctx) => l13Chart(el, ctx) },
    { id: 'export', on: [], done: ctx => !!mem(ctx).exported, text: () => 'Save your cost sheet.', widget: (el, ctx) => l13Export(el, ctx) }
  ],
  checks: [],
  twin: null,
  explainBack: {
    prompt: 'How do you work out what a car must sell for?',
    model: 'Add up what one car costs to make and deliver, add its share of the fixed bills at the number you expect to sell, divide by (1 − the margin you want), then check that the shops still order that many at the new price.',
    ideas: [{ id: 'door', text: 'What one car costs at the shop’s door' }, { id: 'share', text: 'Its share of the fixed bills' }, { id: 'demand', text: 'Check the volume at that price' }]
  },
  rule: 'Price = full cost ÷ (1 − margin), and check it against demand.',
  hint: `Materials → + crew and power (cycle × ${$(D.lineRate)}) + consumables = started → × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} → + carton and freight → + ${$0(D.F)} ÷ cars sold = full cost → ÷ (1 − margin).`,
  misconceptions: ['A price worked out from cost is right at any volume.']
};

// L13 is the course end: what "Course complete" points to
export const LESSONS_B = [L7, L8, L9, L10, L11, L12, L13];

/* =====================================================================================================
   Warm-up pool (SPEC §3.4). `from` is the lesson each item practises.
   ===================================================================================================== */
const W = (() => {
  const w1cfg = { body: 'hatch', color: DEFAULT_CAR.color, accent: DEFAULT_CAR.accent, livery: 'plain', number: '', wheels: 'wood', bumper: 'none', roof: 'none', finish: 'satin' };
  const w1 = econ.carCost(w1cfg, D.R);
  const w3m = [1.0, 2.5, 3.0, 2.0, 2.5, 2.0, 1.5], w3b = Math.max(...w3m);
  const w6 = econ.optionDelta(DEFAULT_CAR, 'roof', 'luggage', D.R);
  const w8 = econ.month(D.cfg, D.R, D.up, { sold: 1425 });
  const w11 = econ.month(D.cfg, D.R, D.up, { price: 34 });
  return { w1cfg, w1, w2: 14.5, w3m, w3b, w3: w3b + D.R.moveMin, w4c: 4.0, w5s: 17.10, w6, w8, w9p: 34, w10c: 20, w10p: 25, w11 };
})();
const satin = econ.CATALOG.finish.satin;
export const WARMUPS = [
  {
    id: 'W1', from: 'L1', kind: 'number', unit: '$', prompt: 'A Hatch: plain livery, no number, all-wood wheels, no bumpers, no roof, satin finish. What do its materials cost?',
    answer: A('$', W.w1.materials),
    distractors: [
      { id: 'noKit', value: A('$', W.w1.materials - econ.CATALOG.kit.price), msg: `You left out the ${$(econ.CATALOG.kit.price)} detail kit: lights, grille and plate are parts too.` },
      { id: 'noCoat', value: A('$', W.w1.materials - satin.coat), msg: `Satin is paint ${$(satin.paint)} plus a satin coat ${$(satin.coat)}.` },
      { id: 'woodOnly', value: A('$', econ.CATALOG.body.hatch.birch), msg: 'That’s only the wood.' }
    ],
    step2: () => `${W.w1.parts.flat().filter(p => p.id !== 'mat.kit').map(p => `${p.label.toLowerCase()} ${$(p.value)}`).join(' + ')} + detail kit ${BLANK}`,
    solution: () => `${W.w1.parts.flat().map(p => `${p.label.toLowerCase()} ${$(p.value)}`).join(' + ')} = ${BN($(W.w1.materials))}.`,
    hint: 'Go station by station: Blank, Paint, Livery, Wheels, Detail.'
  },
  {
    id: 'W2', from: 'L2', kind: 'number', unit: '$', prompt: `${mn(W.w2)} work minutes at ${fmt.rate(D.R.labourPerMin)} a minute: what do they cost?`,
    answer: A('$', W.w2 * D.R.labourPerMin),
    distractors: [
      { id: 'wageOnly', value: A('$', W.w2 * D.R.wageHourly / 60), msg: `That’s the wage alone; with on-costs a minute costs ${fmt.rate(D.R.labourPerMin)}.` },
      { id: 'per100', value: A('$', W.w2 * D.R.labourHourly / 100), msg: 'An hour has 60 minutes, not 100.' }
    ],
    step2: () => `${mn(W.w2)} × ${fmt.rate(D.R.labourPerMin)} = ${BLANK}`,
    solution: () => `${mn(W.w2)} × ${fmt.rate(D.R.labourPerMin)} = ${BN($(W.w2 * D.R.labourPerMin))}.`,
    hint: 'Minutes × cost per minute.'
  },
  {
    id: 'W3', from: 'L3', kind: 'number', unit: 'min', prompt: `Station minutes ${W.w3m.map(mn).join('/')}: what is the cycle?`,
    answer: A('min', W.w3),
    distractors: [
      { id: 'noMove', value: A('min', W.w3b), msg: `Add the ${mn(D.R.moveMin)} minute the line takes to move.` },
      { id: 'sumOfWork', value: A('min', W.w3m.reduce((a, b) => a + b, 0)), msg: 'That’s all the work added up. The line moves on when the slowest station is done.' }
    ],
    step2: () => `Slowest station: ${STATIONS[W.w3m.indexOf(W.w3b)]} ${mn(W.w3b)}. Cycle = ${mn(W.w3b)} + ${mn(D.R.moveMin)} = ${BLANK}`,
    solution: () => `The slowest station is ${STATIONS[W.w3m.indexOf(W.w3b)]} at ${mn(W.w3b)} min, plus the ${mn(D.R.moveMin)} move: ${BN(mn(W.w3) + ' min')}.`,
    hint: 'Slowest station + the half-minute move.'
  },
  {
    id: 'W4', from: 'L4', kind: 'number', unit: '$', prompt: `The cycle is ${mn(W.w4c)} min. What do crew and power cost per car?`,
    answer: A('$', W.w4c * D.lineRate),
    distractors: [
      { id: 'noPower', value: A('$', W.w4c * D.k.crew * D.R.labourPerMin), msg: `Add power: ${$(D.R.powerPerLineMin)} a minute while the line runs.` },
      { id: 'stationsOnly', value: A('$', W.w4c * D.R.crewStations * D.R.labourPerMin), msg: 'Add the QC & pack person and the power.' }
    ],
    step2: () => `Line meter = ${D.k.crew} × ${fmt.rate(D.R.labourPerMin)} + ${$(D.R.powerPerLineMin)} = ${$(D.lineRate)} a minute. × ${mn(W.w4c)} min = ${BLANK}`,
    solution: () => `${mn(W.w4c)} × ${$(D.lineRate)} = ${BN($(W.w4c * D.lineRate))}.`,
    hint: `Every cycle minute costs the whole meter: ${D.k.crew} × ${fmt.rate(D.R.labourPerMin)} + ${$(D.R.powerPerLineMin)}.`
  },
  {
    id: 'W5', from: 'L5', kind: 'number', unit: '$', prompt: `1 in ${D.R.scrapEvery} started cars is scrapped, and a started car costs ${$(W.w5s)}. What must each good car carry?`,
    answer: A('$', W.w5s * D.scrapMul),
    distractors: [
      { id: 'addPercent', value: A('$', W.w5s * (1 + 1 / D.R.scrapEvery)), msg: `You added ${pc(1 / D.R.scrapEvery, 0)}. Scrapped cars don’t come back: you make ${D.R.scrapEvery} to sell ${D.R.scrapEvery - 1}.` },
      { id: 'shareOnly', value: A('$', W.w5s / (D.R.scrapEvery - 1)), msg: 'That’s the share; the question asks for the total.' }
    ],
    step2: () => `${$(W.w5s)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} = ${BLANK}`,
    solution: () => `${$(W.w5s)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} = ${BN($(W.w5s * D.scrapMul))}.`,
    hint: `Make ${D.R.scrapEvery}, sell ${D.R.scrapEvery - 1}: the cost of ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1}.`
  },
  {
    id: 'W6', from: 'L6', kind: 'number', unit: '$', prompt: `A Luggage roof (+${$(econ.CATALOG.roof.luggage.price)} of parts, +${mn(econ.CATALOG.roof.luggage.min)} min at Detail) on the default car: extra cost per started car?`,
    answer: A('$', W.w6.dStarted),
    distractors: [
      { id: 'partsOnly', value: A('$', W.w6.dMaterials), msg: `Parts alone are the whole cost only when the cycle stays the same. Here Detail becomes ${mn(W.w6.after.m[6])} min, slower than ${STATIONS[D.k.bottIdx]}’s ${mn(D.k.bott)}, so the cycle changes.` },
      { id: 'oneOperator', value: A('$', W.w6.dMaterials + econ.CATALOG.roof.luggage.min * D.R.labourPerMin), msg: 'You charged only the Detail operator’s extra minute. When the cycle grows, the whole line meter pays for the extra cycle minutes.' },
      { id: 'wholeMinute', value: A('$', W.w6.dMaterials + econ.CATALOG.roof.luggage.min * D.lineRate), msg: `Only the minutes added to the cycle count. Detail works ${mn(econ.CATALOG.roof.luggage.min)} min more, but it had ${mn(D.k.bott - D.k.m[6])} min of waiting to spare, so the cycle grows by less.` }
    ],
    step2: () => `Detail: ${mn(D.k.m[6])} → ${mn(W.w6.after.m[6])} min, so the cycle goes ${mn(D.k.cycle)} → ${mn(W.w6.after.cycle)}. Extra = ${$(W.w6.dMaterials)} + ${mn(W.w6.dCycle)} × ${$(D.lineRate)} = ${BLANK}`,
    solution: () => `${$(W.w6.dMaterials)} + ${mn(W.w6.dCycle)} × ${$(D.lineRate)} = ${BN($(W.w6.dStarted))}.`,
    hint: 'Does the cycle change? If not, only the parts count. If it does, the meter pays for the extra cycle minutes.'
  },
  {
    id: 'W7', from: 'L7', kind: 'sort', prompt: 'Sort each cost: fixed or variable?', bins: ['Fixed', 'Variable'],
    cards: [{ text: 'Glue', bin: 'Variable' }, { text: 'Accountant’s monthly fee', bin: 'Fixed' }, { text: 'Shipping cartons', bin: 'Variable' }],
    solution: () => 'Glue: variable (used on every car). The accountant’s fee: fixed (every month). Shipping cartons: variable (one per car).',
    hint: 'Ask: would this bill change if we made no cars?'
  },
  {
    id: 'W8', from: 'L8', kind: 'numbers', prompt: `You sell ${n(W.w8.sold)} cars. Fixed cost per car? Full cost per car?`,
    fields: [
      { label: 'Fixed cost per car', unit: '$', answer: A('$', W.w8.perCar.fixedPerCar) },
      { label: 'Full cost per car', unit: '$', answer: A('$', W.w8.perCar.fullCost), distractors: [
        { id: 'fixedOnly', value: A('$', W.w8.perCar.fixedPerCar), msg: 'That’s only the fixed share; add the variable cost.' },
        { id: 'keptShare', value: A('$', D.full), msg: `That’s the full cost at ${n(D.sold)} cars; the bills are shared by ${n(W.w8.sold)} now.` }] }
    ],
    step2: () => `Fixed share = ${$0(D.F)} ÷ ${n(W.w8.sold)} = ${BLANK}. Full cost = ${$(D.V)} + the share.`,
    solution: () => `${$0(D.F)} ÷ ${n(W.w8.sold)} = ${BN($(W.w8.perCar.fixedPerCar))}; ${$(D.V)} + ${$(W.w8.perCar.fixedPerCar)} = ${BN($(W.w8.perCar.fullCost))}.`,
    hint: `Full cost = ${$(D.V)} + ${$0(D.F)} ÷ cars.`
  },
  {
    id: 'W9', from: 'L9', kind: 'number', unit: 'cars', prompt: `Price ${$s(W.w9p)}, variable cost ${$s(D.V)}, fixed ${$0(D.F)}: break-even?`,
    answer: A('cars', econ.breakEven(D.F, W.w9p - D.V)),
    distractors: [
      { id: 'dividedByPrice', value: A('cars', Math.ceil(D.F / W.w9p)), msg: 'You divided by the price.' },
      { id: 'oldPrice', value: A('cars', D.be), msg: `That’s break-even at ${$s(D.P)}. At ${$s(W.w9p)} each car contributes ${$(W.w9p - D.V)}.` }
    ],
    step2: () => `Contribution = ${$(W.w9p)} − ${$(D.V)} = ${$(W.w9p - D.V)}. ${$0(D.F)} ÷ ${$(W.w9p - D.V)} = ${BLANK}`,
    solution: () => `${$0(D.F)} ÷ ${$(W.w9p - D.V)} = ${BN(n(econ.breakEven(D.F, W.w9p - D.V)))} cars.`,
    hint: 'Fixed costs ÷ contribution per car.'
  },
  {
    id: 'W10', from: 'L10', kind: 'numbers', prompt: `Cost ${$s(W.w10c)}, price ${$s(W.w10p)}. Markup? Margin?`,
    fields: [
      { label: 'Markup', unit: '%', answer: A('%', econ.markupOf(W.w10p, W.w10c) * 100), distractors: [
        { id: 'swapped', value: A('%', econ.marginOf(W.w10p, W.w10c) * 100), msg: 'That’s the margin: profit ÷ price. Markup divides by the cost.' }] },
      { label: 'Margin', unit: '%', answer: A('%', econ.marginOf(W.w10p, W.w10c) * 100), distractors: [
        { id: 'swapped', value: A('%', econ.markupOf(W.w10p, W.w10c) * 100), msg: 'That’s the markup: profit ÷ cost. Margin divides by the price.' }] }
    ],
    step2: () => `Profit = ${$(W.w10p)} − ${$(W.w10c)} = ${$(W.w10p - W.w10c)}. Markup = ${$(W.w10p - W.w10c)} ÷ ${$(W.w10c)}; margin = ${$(W.w10p - W.w10c)} ÷ ${BLANK}`,
    solution: () => `Markup ${$(W.w10p - W.w10c)} ÷ ${$(W.w10c)} = ${BN(pc(econ.markupOf(W.w10p, W.w10c)))}; margin ${$(W.w10p - W.w10c)} ÷ ${$(W.w10p)} = ${BN(pc(econ.marginOf(W.w10p, W.w10c)))}.`,
    hint: 'Markup divides the profit by the cost; margin divides it by the price.'
  },
  {
    id: 'W11', from: 'L11', kind: 'numbers', prompt: `At ${$s(W.w11.price)}: how many cars do the shops order, and what is the month’s profit?`,
    fields: [
      { label: 'Cars sold', unit: 'cars', answer: A('cars', W.w11.sold), distractors: [
        { id: 'keptVolume', value: A('cars', D.sold), msg: `${n(D.R.demandSlope)} fewer cars sell for every ${$s(1)} on the price.` }] },
      { label: 'Profit', unit: '$m', answer: A('$m', W.w11.pl.profit), distractors: [
        { id: 'keptVolume', value: A('$m', (W.w11.price - D.V) * D.sold - D.F), msg: `You kept selling ${n(D.sold)}.` },
        { id: 'noFixed', value: A('$m', W.w11.pl.contribution), msg: `Take off the ${$0(D.F)} of fixed bills.` }] }
    ],
    step2: () => `Cars = ${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × ${n(W.w11.price)} = ${n(W.w11.sold)}. Profit = (${$s(W.w11.price)} − ${$s(D.V)}) × ${n(W.w11.sold)} − ${$0(D.F)} = ${BLANK}`,
    solution: () => `${n(W.w11.sold)} cars; ${n(W.w11.sold)} × ${$(W.w11.price - D.V)} − ${$0(D.F)} = ${BN($0(W.w11.pl.profit))}.`,
    hint: `Cars = ${n(D.R.demandIntercept)} − ${n(D.R.demandSlope)} × price, then (price − ${$s(D.V)}) × cars − ${$0(D.F)}.`
  }
];

/* =====================================================================================================
   Challenges (SPEC §3.5)
   ===================================================================================================== */
// ---- C1 · The Racer order ----
const C1d = lazy(() => {
  const offer = { price: 30, qty: 300, payDays: 60, deposit: 0.5 };
  const rk = econ.carCost(RACER_ORDER, D.R, D.up);
  const contrib = offer.price - rk.variable, extra = offer.qty * contrib;
  const started = offer.qty * D.scrapMul, minutes = started * rk.cycle;
  const spare = D.R.available - D.mo.lineMin;
  const tied = offer.qty * rk.variable, dep = offer.deposit * offer.qty * offer.price, tiedDep = tied - dep;
  const maxOrder = Math.floor(spare / rk.cycle / D.scrapMul + EPS);
  const chrome = econ.carCost({ ...RACER_ORDER, bumper: 'chrome' }, D.R, D.up);
  return { offer, rk, contrib, extra, started, minutes, spare, tied, dep, tiedDep, maxOrder, fullAt: rk.variable + D.fixedPer, chrome };
});
function c1Evaluate(plan = {}) {
  const d = C1d(), v = k => parseNumber(plan[k]);
  const pick = (x, list, generic) => { for (const [val, tol, msg] of list) if (near(x, val, tol)) return msg; return generic; };
  const res = {};
  res.decision = plan.decision === 'accept' ? { ok: true, msg: `Accept: each Racer adds ${$(d.contrib)} toward the bills.` }
    : plan.decision === 'reject' ? { ok: false, msg: `Full cost includes ${$(D.fixedPer)} of fixed bills you pay anyway. Each Racer brings ${$(d.offer.price)} and costs ${$(d.rk.variable)} more: ${fmt.signed(d.contrib)}.` }
      : { ok: false, msg: 'Choose Accept or Reject.' };
  const p = v('profit');
  res.profit = p === null ? { ok: false, msg: 'Enter the extra profit this month.' } : near(p, d.extra, 1) ? { ok: true, msg: `${n(d.offer.qty)} × ${$(d.contrib)} = ${$(d.extra)}.` } : {
    ok: false, msg: pick(p, [
      [d.offer.qty * (d.offer.price - d.fullAt), 1, `That uses the full cost. The ${$(D.fixedPer)} of fixed bills per car are paid anyway: count only what the Racers add.`],
      [d.offer.qty * d.offer.price, 1, 'That’s the sales. Take off what each Racer costs to make and deliver (its variable cost).'],
      [d.offer.qty * (d.offer.price - d.rk.started), 1, `Use the cost per car sold (${$(d.rk.variable)}): it adds scrap, a carton and freight to the started cost.`],
      [d.offer.qty * (d.offer.price - D.V), 1, `That’s the default car’s variable cost. The Racer’s cycle is ${mn(d.rk.cycle)} min, so it costs more.`],
      [d.contrib, 0.01, `That’s per Racer; the order is for ${n(d.offer.qty)}.`]
    ], 'Not yet. Extra profit = Racers × (price − the Racer’s variable cost).')
  };
  const mi = v('minutes');
  res.minutes = mi === null ? { ok: false, msg: 'Enter the line minutes.' } : near(mi, d.minutes, 1) ? { ok: true, msg: `${n(d.offer.qty)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} = ${n(d.started)} started × ${mn(d.rk.cycle)} min = ${mn(d.minutes)} min.` } : {
    ok: false, msg: pick(mi, [
      [d.offer.qty * d.rk.cycle, 1, `Some Racers fail QC: to sell ${n(d.offer.qty)} you start ${n(d.offer.qty)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1}.`],
      [d.started * D.k.cycle, 1, `The Racer’s cycle is ${mn(d.rk.cycle)} min: Livery takes ${mn(d.rk.bott)}.`],
      [d.started * d.rk.bott, 1, `Add the ${mn(D.R.moveMin)} minute move: cycle = slowest station + ${mn(D.R.moveMin)}.`],
      [d.minutes / 60, 0.1, 'That’s hours; the question asks for minutes.']
    ], 'Not yet. Line minutes = cars started × the Racer’s cycle.')
  };
  res.fits = plan.fits === 'yes' ? (d.minutes <= d.spare ? { ok: true, msg: `${mn(d.minutes)} of the ${mn(d.spare)} spare minutes.` } : { ok: false, msg: 'Check the minutes again.' })
    : plan.fits === 'no' ? { ok: false, msg: `Compare your line minutes with the spare time, ${mn(D.R.available)} − ${mn(D.mo.lineMin)}.` }
      : { ok: false, msg: 'Say whether it fits.' };
  const c = v('cash');
  res.cash = c === null ? { ok: false, msg: 'Enter the cash tied up.' } : near(c, d.tiedDep, 1) ? { ok: true, msg: `${n(d.offer.qty)} × ${$(d.rk.variable)} − ${$0(d.dep)} deposit = ${$(d.tiedDep)}.` } : {
    ok: false, msg: pick(c, [
      [d.tied, 1, `That’s without the deposit. Take off the ${$0(d.dep)} the chain pays with the order.`],
      [d.dep, 1, `The deposit is ${$0(d.dep)}. What’s tied up is what you spend making the Racers, less the deposit.`],
      [d.offer.qty * d.rk.started - d.dep, 1, `Use the cost per car sold, ${$(d.rk.variable)}: scrap, cartons and freight are paid before the chain pays too.`],
      [d.offer.qty * d.offer.price - d.dep, 1, 'That’s what the chain still owes you. Cash tied up is what you have paid out and not yet got back.']
    ], 'Not yet. Cash tied up = what the Racers cost you − the deposit.')
  };
  res.won = ['decision', 'profit', 'minutes', 'fits', 'cash'].every(k => res[k].ok);
  return res;
}
function c1Render(el, ctx, done) {
  ensureCss(el.ownerDocument);
  const d = C1d(), st = { decision: null, fits: null };
  el.innerHTML = `<div class="cs-b">
    <div class="cs-b-card"><div class="cs-b-lab">The order</div><div class="cs-b-rows">${rowsHtml([
      ['Racers', n(d.offer.qty)],
      ['Price offered', `${$(d.offer.price)} each`],
      ['Racer station minutes', d.rk.m.map(mn).join('/')],
      ['Your month now', `${NUM(n(D.sold) + ' cars')} at ${NUM($s(D.P))}`, 'wrapv'],
      ['Line minutes used', `${NUM(mn(D.mo.lineMin))} of ${NUM(mn(D.R.available))}`, 'wrapv'],
      ['The chain pays', `${d.offer.payDays} days after delivery`, 'wrapv']
    ])}</div>
      <button type="button" class="cs-b-btn" data-act="sheet" aria-expanded="false">Show the Racer’s cost sheet</button><div data-w="sheet" hidden></div></div>
    <div class="cs-b-card"><div class="cs-b-lab">1 · Your decision</div>
      <div class="cs-b-seg" role="group" aria-label="Decision"><button type="button" class="cs-b-btn" data-dec="accept" aria-pressed="false">Accept</button><button type="button" class="cs-b-btn" data-dec="reject" aria-pressed="false">Reject</button></div>
      <p class="cs-b-fb" data-fb="decision" aria-live="polite"></p></div>
    <div class="cs-b-card"><div class="cs-b-lab">2 · What the order adds</div>
      ${fieldHtml('profit', 'Extra profit this month from the order', '$')}
      ${fieldHtml('minutes', 'Line minutes to make the order', 'min')}
      <div class="cs-b-field"><span>Your cars use ${NUM(mn(D.mo.lineMin))} of the ${NUM(mn(D.R.available))} line minutes. Does the order fit in what’s left?</span>
        <div class="cs-b-seg" role="group" aria-label="Does it fit"><button type="button" class="cs-b-btn" data-fit="yes" aria-pressed="false">Yes, it fits</button><button type="button" class="cs-b-btn" data-fit="no" aria-pressed="false">No, it doesn’t</button></div>
        <span class="cs-b-fb" data-fb="fits" aria-live="polite"></span></div></div>
    <div class="cs-b-card"><div class="cs-b-lab">3 · Cash</div>
      <p class="cs-b-p">The chain pays ${d.offer.payDays} days after delivery, so you pay for the Racers long before you are paid. You ask for a ${pc(d.offer.deposit, 0)} ${GW('deposit')} with the order.</p>
      ${fieldHtml('cash', 'Your own cash tied up in the order', '$')}</div>
    <button type="button" class="cs-b-btn cs-b-primary" data-act="check">Check my plan</button>
    <div class="cs-b-card" data-result hidden aria-live="polite"></div>
    <div class="cs-b-card" data-ext hidden><div class="cs-b-lab">Extension (not required)</div>${fieldHtml('ext', 'The largest order that fits the spare time', 'cars')}<button type="button" class="cs-b-btn" data-act="ext">Check</button></div>
  </div>`;
  let sheet = null, won = false;
  q(el, '[data-act=sheet]').addEventListener('click', e => {
    const box = q(el, '[data-w=sheet]'), open = box.hidden;
    box.hidden = !open; e.currentTarget.setAttribute('aria-expanded', open);
    e.currentTarget.textContent = open ? 'Hide the Racer’s cost sheet' : 'Show the Racer’s cost sheet';
    if (open && !sheet) sheet = widget(ctx, 'costSheet', box, { cfg: RACER_ORDER, R: D.R, up: D.up, price: d.offer.price, sold: d.offer.qty, only: ['materials', 'labour.crew', 'power', 'consumables', 'started', 'scrap', 'good', 'carton', 'freight', 'variable'] });
  });
  const press = (sel, key, val) => { el.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', b.dataset[key] === val)); };
  el.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => {
    st.decision = b.dataset.dec; press('[data-dec]', 'dec', st.decision);
    const r = c1Evaluate({ decision: st.decision });
    setFb(el, 'decision', st.decision === 'reject' ? false : null, st.decision === 'reject' ? r.decision.msg : '');
  }));
  el.querySelectorAll('[data-fit]').forEach(b => b.addEventListener('click', () => { st.fits = b.dataset.fit; press('[data-fit]', 'fit', st.fits); setFb(el, 'fits', null, ''); }));
  const val = k => q(el, `[data-in=${k}]`).value;
  q(el, '[data-act=check]').addEventListener('click', () => {
    const plan = { decision: st.decision, fits: st.fits, profit: val('profit'), minutes: val('minutes'), cash: val('cash') };
    const r = c1Evaluate(plan);
    for (const k of ['decision', 'profit', 'minutes', 'fits', 'cash']) setFb(el, k, r[k].ok, r[k].msg);
    const box = q(el, '[data-result]'); box.hidden = false;
    box.className = 'cs-b-card ' + (r.won ? 'is-good' : 'is-bad');
    const left = ['decision', 'profit', 'minutes', 'fits', 'cash'].filter(k => !r[k].ok).length;
    box.innerHTML = r.won
      ? `<p class="cs-b-p"><b>Order accepted.</b> ${fmt.signed(d.extra)} this month, ${mn(d.minutes)} of ${mn(d.spare)} spare minutes, ${$(d.tiedDep)} of cash tied up until the chain pays.</p>`
      : `<p class="cs-b-p">${left} of 5 still to fix. Read the notes under each answer.</p>`;
    if (r.won && !won) {
      won = true; q(el, '[data-ext]').hidden = false;
      done?.({ won: true, summary: `Accepted ${n(d.offer.qty)} Racers at ${$(d.offer.price)}: ${fmt.signed(d.extra)} this month, ${mn(d.minutes)} of ${mn(d.spare)} spare line minutes, ${$(d.tiedDep)} of cash tied up.`, best: { profit: r2c(d.extra) } });
    }
  });
  // the extension's answer appears only once it has been tried: right, or on the second wrong try
  let extWrong = 0;
  q(el, '[data-act=ext]').addEventListener('click', () => {
    const x = parseNumber(val('ext'));
    if (x === null) { setFb(el, 'ext', false, 'Enter a number of Racers.'); return; }
    mem(ctx).c1ExtTried = true;
    const ok = Math.round(x) === d.maxOrder;
    if (!ok) extWrong++;
    const working = `${n(d.maxOrder)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1} × ${mn(d.rk.cycle)} = ${mn(d.maxOrder * D.scrapMul * d.rk.cycle)} min, inside ${mn(d.spare)}`;
    setFb(el, 'ext', ok, ok ? `${n(d.maxOrder)} Racers: ${working}.`
      : extWrong < 2 ? `Not yet. Spare minutes ÷ ${mn(d.rk.cycle)} gives cars started; × ${D.R.scrapEvery - 1} ÷ ${D.R.scrapEvery} gives cars sold. Round down.`
        : `The largest order that fits is ${BN(n(d.maxOrder))} Racers: ${working}. One more would not fit.`);
  });
  return () => { sheet?.destroy?.(); el.innerHTML = ''; };
}
const r2c = x => roundTo(x, 2);

// ---- C2 · Open with $40,000 ----
const C2_OPEN = 40000, C2_MONTHS = 3, C2_TARGET = 8000, C2_RANGE = { from: 24, to: 46, step: 0.5 };
function c2Evaluate({ price, shopTerms = 'net30', supplierCredit = false } = {}) {
  const p = +price;
  const R = econ.rules({ openingCash: C2_OPEN, months: C2_MONTHS, shopTerms, supplierCredit: !!supplierCredit });
  const mo = econ.month(D.cfg, R, D.up, { price: p });
  const cal = econ.cashCalendar(D.cfg, R, D.up, { open: C2_OPEN, months: C2_MONTHS, price: p });
  const cashOk = cal.low >= -EPS, profitOk = mo.pl.profit >= C2_TARGET - EPS;
  return { R, mo, cal, price: p, shopTerms, supplierCredit: !!supplierCredit, profit: mo.pl.profit, low: cal.low, lowAt: cal.lowAt, firstNeg: cal.firstNeg, cashOk, profitOk, won: Number.isFinite(p) && cashOk && profitOk };
}
const C2d = lazy(() => {
  const def = c2Evaluate({ price: D.P });
  const groups = [];
  for (const shopTerms of ['early', 'net30']) for (const supplierCredit of [false, true]) {
    const wins = [];
    for (let p = C2_RANGE.from; p <= C2_RANGE.to + EPS; p += C2_RANGE.step) { const e = c2Evaluate({ price: p, shopTerms, supplierCredit }); if (e.won) wins.push(e); }
    groups.push({ shopTerms, supplierCredit, wins });
  }
  const all = groups.flatMap(g => g.wins), best = all.reduce((a, b) => b.profit > a.profit + EPS ? b : a);
  const safeNet30 = [];
  for (let p = C2_RANGE.from; p <= C2_RANGE.to + EPS; p += C2_RANGE.step) { const e = c2Evaluate({ price: p }); if (e.cashOk) safeNet30.push(e); }
  const bestSafeNet30 = safeNet30.reduce((a, b) => (!a || b.profit > a.profit) ? b : a, null);
  const creditAt32 = c2Evaluate({ price: D.P, supplierCredit: true });
  return { def, groups, best, bestSafeNet30, creditAt32 };
});
const termsLabel = t => t === 'early' ? '2% off, paid in 10 days' : 'Net 30';
const planLabel = e => `${$s(e.price)} · ${e.shopTerms === 'early' ? 'early pay' : 'net 30'}${e.supplierCredit ? ' · supplier credit' : ''}`;
function c2Render(el, ctx, done) {
  ensureCss(el.ownerDocument);
  const st = { price: D.P, shopTerms: 'net30', supplierCredit: false }, runs = [];
  el.innerHTML = `<div class="cs-b">
    <div class="cs-b-card"><div class="cs-b-lab">Your plan · opening cash ${NUM($0(C2_OPEN))} · months 1 to ${C2_MONTHS}</div>
      <div data-w="price"></div>
      <div class="cs-b-field"><span>Shop ${GW('payment terms')}</span><div class="cs-b-seg" role="group" aria-label="Shop terms">
        <button type="button" class="cs-b-btn" data-terms="net30" aria-pressed="true">Net 30</button><button type="button" class="cs-b-btn" data-terms="early" aria-pressed="false">2% off in 10 days</button></div></div>
      ${switchHtml('credit', 'Supplier credit', 'All materials (birch, paint, ink, wheels, kits, trim) and cartons paid 21 working days after use. Crew, power, consumables and freight are still paid the same day.')}
    </div>
    <div class="cs-b-card"><div class="cs-b-lab">A month on this plan</div><div class="cs-b-rows" data-pl></div></div>
    <div class="cs-b-seg"><button type="button" class="cs-b-btn cs-b-primary" data-act="run">Run months 1 to ${C2_MONTHS}</button></div>
    <div class="cs-b-card" data-result hidden><div class="cs-b-rows" data-res aria-live="polite"></div><div data-w="chart"></div></div>
    <div class="cs-b-card" data-runs hidden><div class="cs-b-lab">Runs so far</div><div class="cs-b-tablewrap"><table class="cs-b-table"><thead><tr><th>Plan</th><th>Profit</th><th>Lowest cash</th></tr></thead><tbody></tbody></table></div></div>
  </div>`;
  let chart = null;
  const sync = () => {
    try { ctx.app?.set?.({ price: st.price, R: econ.rules({ openingCash: C2_OPEN, months: C2_MONTHS, shopTerms: st.shopTerms, supplierCredit: st.supplierCredit }) }); } catch (e) { console.warn('[course-b] C2 sync', e); }
  };
  const showPlan = () => {
    const e = c2Evaluate(st), mo = e.mo;
    q(el, '[data-pl]').innerHTML = rowsHtml([
      ['Sales', $0(mo.pl.sales)],
      ...(mo.pl.discounts > 0 ? [['Early-pay discounts', sgn0(-mo.pl.discounts)]] : []),
      ['Variable costs', sgn0(-mo.pl.variable)],
      ['Fixed bills', sgn0(-mo.pl.fixed)],
      [`Profit (need ${$0(C2_TARGET)})`, `<span class="${e.profitOk ? 'cs-b-gain' : 'cs-b-loss'}">${$s(r2c(mo.pl.profit))}</span>`, 'total']
    ]);
    // the plan rows are not a live region (they change on every slider step): the slider says the profit itself
    q(el, '[data-w=price] input[type=range]')?.setAttribute('aria-valuetext', `${$(e.price)}, profit ${$s(r2c(mo.pl.profit))} a month`);
  };
  const priceW = widget(ctx, 'priceSlider', q(el, '[data-w=price]'), { value: st.price, from: C2_RANGE.from, to: C2_RANGE.to, step: C2_RANGE.step, readout: true, cfg: D.cfg, R: c2Evaluate(st).R, up: D.up, onInput: p => { const v = +p; if (!Number.isFinite(v)) return; st.price = v; showPlan(); sync(); } });
  el.querySelectorAll('[data-terms]').forEach(b => b.addEventListener('click', () => {
    st.shopTerms = b.dataset.terms; el.querySelectorAll('[data-terms]').forEach(x => x.setAttribute('aria-pressed', x === b)); showPlan(); sync();
  }));
  q(el, '[data-sw=credit]').addEventListener('click', e => { st.supplierCredit = !st.supplierCredit; e.currentTarget.setAttribute('aria-checked', st.supplierCredit); showPlan(); sync(); });
  q(el, '[data-act=run]').addEventListener('click', () => {
    const e = c2Evaluate(st);
    const box = q(el, '[data-result]'); box.hidden = false; box.className = 'cs-b-card ' + (e.won ? 'is-good' : 'is-bad');
    q(el, '[data-res]').innerHTML = rowsHtml([
      ['Plan', planLabel(e), 'wrapv'],
      ['Lowest cash', `${NUM(`<span class="${sign(e.low)}">${$0(e.low)}</span>`)} · day ${e.lowAt.day} of month ${e.lowAt.month}`, 'wrapv'],
      ...(e.firstNeg ? [['Out of cash', `<span class="cs-b-loss">day ${e.firstNeg.day} of month ${e.firstNeg.month}</span>`, 'wrapv']] : []),
      ['Bank at the end of each month', e.cal.eom.map(b => NUM($0(b))).join(' · '), 'wrapv'],
      ['Cash never below $0', e.cashOk ? '<span class="cs-b-gain">Yes</span>' : '<span class="cs-b-loss">No</span>'],
      [`Profit at least ${$0(C2_TARGET)} a month`, e.profitOk ? `<span class="cs-b-gain">Yes, ${$s(r2c(e.profit))}</span>` : `<span class="cs-b-loss">No, ${$s(r2c(e.profit))}</span>`],
      [e.won ? 'This plan works' : 'Not yet', e.won ? '<span class="cs-b-gain">Both hold</span>' : '<span class="cs-b-loss">Change the plan</span>', 'total']
    ]);
    if (!chart) chart = widget(ctx, 'cashChart', q(el, '[data-w=chart]'), { calendar: e.cal }); else chart.update?.({ calendar: e.cal });
    runs.unshift(e);
    const t = q(el, '[data-runs]'); t.hidden = false;
    q(t, 'tbody').innerHTML = runs.slice(0, 8).map(r => `<tr class="${r.won ? 'is-pick' : ''}"><td>${planLabel(r)}${r.won ? ' <span class="cs-b-gain">works</span>' : ''}</td><td class="${r.won ? 'cs-b-gain' : ''}">${$s(r2c(r.profit))}</td><td class="${r.low < 0 ? 'cs-b-loss' : ''}">${$0(r.low)}</td></tr>`).join('');
    if (e.won) done?.({ won: true, summary: `${planLabel(e)}: profit ${$s(r2c(e.profit))} a month, lowest cash ${$s(r2c(e.low))} on day ${e.lowAt.day} of month ${e.lowAt.month}.`, best: { profit: r2c(e.profit), low: r2c(e.low) }, plan: { price: e.price, shopTerms: e.shopTerms, supplierCredit: e.supplierCredit } });
  });
  showPlan();
  return () => { priceW?.destroy?.(); chart?.destroy?.(); el.innerHTML = ''; };
}

// ---- C3 · Turn it around ----
const C3_TARGET = 12200, C3_RANGE = { from: 20, to: 50, step: 0.5 };
const C3_FINISHES = ['gloss', 'satin', 'raw'];
const c3Up = ({ lamp = false, helper = null, autofeed = false } = {}) => ({ lamp: !!lamp, helper: helper === '' || helper === undefined ? null : helper === null ? null : +helper, autofeed: !!autofeed });
function c3Evaluate(plan = {}) {
  const up = c3Up(plan), finish = plan.finish || 'gloss', p = +plan.price;
  const valid = C3_FINISHES.includes(finish) && !(up.autofeed && up.helper === 0) && (up.helper === null || (Number.isInteger(up.helper) && up.helper >= 0 && up.helper < 7));
  const cfg = { ...DELIVERY_VAN, finish };
  if (!valid) return { valid, won: false, cfg, up, price: p };
  const k = econ.carCost(cfg, D.R, up), mo = econ.month(cfg, D.R, up, { price: p });
  return { valid, cfg, up, price: p, k, mo, F: econ.fixedTotal(D.R, up), profit: mo.pl.profit, won: Number.isFinite(p) && mo.pl.profit >= C3_TARGET - EPS };
}
const C3d = lazy(() => {
  const vk = econ.carCost(DELIVERY_VAN, D.R, D.up), asFound = roundTo(4 * vk.materials, 2);
  const moAs = econ.month(DELIVERY_VAN, D.R, D.up, { price: asFound });
  const satinK = econ.carCost({ ...DELIVERY_VAN, finish: 'satin' }, D.R, D.up), satinAF = econ.carCost({ ...DELIVERY_VAN, finish: 'satin' }, D.R, { ...NO_UPGRADES, autofeed: true });
  const saving = satinK.started - satinAF.started, payback = UPGRADES.autofeed.fixed / saving;
  const plans = [
    ['Gloss, price only', 'gloss', {}], ['Oiled', 'raw', {}], ['Satin', 'satin', {}], ['Satin + lamp', 'satin', { lamp: true }],
    ['Gloss + lamp', 'gloss', { lamp: true }], ['Gloss + extra operator at Paint', 'gloss', { helper: 3 }], ['Satin + extra operator at Wheels', 'satin', { helper: 5 }],
    ['Gloss + auto-feed', 'gloss', { autofeed: true }], ['Satin + auto-feed', 'satin', { autofeed: true }], ['Satin + lamp + auto-feed', 'satin', { lamp: true, autofeed: true }],
    ['Gloss + lamp + auto-feed', 'gloss', { lamp: true, autofeed: true }]
  ].map(([label, finish, u]) => {
    const up = { ...NO_UPGRADES, ...u }, cfg = { ...DELIVERY_VAN, finish }, k = econ.carCost(cfg, D.R, up), b = econ.bestPrice(cfg, D.R, up, C3_RANGE);
    return { label, finish, up, k, F: econ.fixedTotal(D.R, up), best: b.price, profit: b.profit };
  });
  plans.unshift({ label: 'As found', finish: 'gloss', up: { ...NO_UPGRADES }, k: vk, F: D.F, best: asFound, profit: moAs.pl.profit });
  const wins = [];
  for (let p = C3_RANGE.from; p <= C3_RANGE.to + EPS; p += C3_RANGE.step) { const e = c3Evaluate({ finish: 'satin', autofeed: true, price: p }); if (e.won) wins.push(e); }
  return { vk, asFound, moAs, satinK, satinAF, saving, payback, plans, wins };
});
const upLabel = (finish, up) => [econ.CATALOG.finish[finish].label, up.lamp && 'lamp', up.helper !== null && up.helper !== undefined && `extra operator at ${STATIONS[up.helper]}`, up.autofeed && 'auto-feed'].filter(Boolean).join(' + ');
function c3Render(el, ctx, done) {
  ensureCss(el.ownerDocument);
  const d = C3d(), st = { finish: 'gloss', price: d.asFound, lamp: false, helper: null, autofeed: false }, runs = [];
  let priceW = null;
  el.innerHTML = `<div class="cs-b">
    <div class="cs-b-card"><div class="cs-b-lab">Levers · nothing else on the order may change</div>
      <div class="cs-b-field"><span>Finish (the shops accept any)</span><div class="cs-b-seg" role="group" aria-label="Finish">${C3_FINISHES.map(f => `<button type="button" class="cs-b-btn" data-fin="${f}" aria-pressed="${f === st.finish}">${econ.CATALOG.finish[f].label}</button>`).join('')}</div></div>
      <div data-w="price"></div>
      ${switchHtml('lamp', `${UPGRADES.lamp.label} <span class="cs-b-num">+${$0(UPGRADES.lamp.fixed)}/month</span>`, UPGRADES.lamp.note)}
      <label class="cs-b-field"><span>${UPGRADES.helper.label} (hourly, no fixed cost): ${UPGRADES.helper.note}</span>
        <select class="cs-b-select" data-helper><option value="">None</option>${STATIONS.map((s, i) => `<option value="${i}">${s}</option>`).join('')}</select></label>
      ${switchHtml('autofeed', `${UPGRADES.autofeed.label} <span class="cs-b-num">+${$0(UPGRADES.autofeed.fixed)}/month</span>`, `${UPGRADES.autofeed.note}. Blank minutes unchanged.`)}
    </div>
    <div class="cs-b-card"><div class="cs-b-lab">The van on the line</div><div class="cs-b-bars" data-bars aria-hidden="true"></div><div class="cs-b-rows" data-facts></div></div>
    <div class="cs-b-seg"><button type="button" class="cs-b-btn cs-b-primary" data-act="run">Run the month</button></div>
    <div class="cs-b-card" data-result hidden><div class="cs-b-rows" data-res aria-live="polite"></div></div>
    <div class="cs-b-card" data-runs hidden><div class="cs-b-lab">Runs so far</div><div class="cs-b-tablewrap"><table class="cs-b-table"><thead><tr><th>Plan</th><th>Price</th><th>Profit</th></tr></thead><tbody></tbody></table></div></div>
  </div>`;
  const sync = () => {
    try { call(ctx.engine, 'setCfg', { ...DELIVERY_VAN, finish: st.finish }); ctx.app?.set?.({ up: c3Up(st), price: st.price }); } catch (e) { console.warn('[course-b] C3 sync', e); }
  };
  const show = () => {
    const e = c3Evaluate(st);
    const sel = q(el, '[data-helper]');
    sel.querySelector('option[value="0"]').disabled = st.autofeed;
    if (!e.valid) return;
    const k = e.k, mx = 4.5;
    q(el, '[data-bars]').innerHTML = k.m.map((x, i) => `<div class="cs-b-bar ${k.bottAll.includes(i) ? 'bn' : ''}"><div class="col"><i style="height:${Math.max(2, x / mx * 100).toFixed(1)}%"></i></div><b>${mn(x)}</b><span>${STATIONS[i]}</span></div>`).join('');
    q(el, '[data-facts]').innerHTML = rowsHtml([
      ['Cycle · crew', `${NUM(mn(k.cycle) + ' min')} · ${k.crew} people`, 'wrapv'],
      ['Started cost per van', $(k.started)],
      ['Variable cost per van sold', $(k.variable)],
      ['Fixed bills a month', $0(e.F)]
    ]);
    priceW?.update?.({ cfg: e.cfg, up: e.up, R: D.R });
  };
  el.querySelectorAll('[data-fin]').forEach(b => b.addEventListener('click', () => {
    st.finish = b.dataset.fin; el.querySelectorAll('[data-fin]').forEach(x => x.setAttribute('aria-pressed', x === b)); show(); sync();
  }));
  priceW = widget(ctx, 'priceSlider', q(el, '[data-w=price]'), { value: st.price, from: C3_RANGE.from, to: C3_RANGE.to, step: C3_RANGE.step, readout: true, cfg: { ...DELIVERY_VAN }, R: D.R, up: c3Up(st), onInput: p => { const v = +p; if (!Number.isFinite(v)) return; st.price = v; show(); sync(); } });
  q(el, '[data-sw=lamp]').addEventListener('click', e => { st.lamp = !st.lamp; e.currentTarget.setAttribute('aria-checked', st.lamp); show(); sync(); });
  q(el, '[data-sw=autofeed]').addEventListener('click', e => {
    st.autofeed = !st.autofeed; e.currentTarget.setAttribute('aria-checked', st.autofeed);
    if (st.autofeed && st.helper === 0) { st.helper = null; q(el, '[data-helper]').value = ''; }
    show(); sync();
  });
  q(el, '[data-helper]').addEventListener('change', e => { st.helper = e.target.value === '' ? null : +e.target.value; show(); sync(); });
  q(el, '[data-act=run]').addEventListener('click', () => {
    const e = c3Evaluate(st);
    if (!e.valid) return;
    const mo = e.mo, box = q(el, '[data-result]');
    box.hidden = false; box.className = 'cs-b-card ' + (e.won ? 'is-good' : 'is-bad');
    q(el, '[data-res]').innerHTML = rowsHtml([
      ['Plan', `${upLabel(st.finish, e.up)} at ${NUM($(e.price))}`, 'wrapv'],
      ['Vans sold', `${n(mo.sold)}${mo.lostSales > 0.5 ? ` <span class="cs-b-loss">(${n(mo.lostSales)} lost)</span>` : ''}`],
      ['Sales', $0(mo.pl.sales)],
      ['Variable costs', sgn0(-mo.pl.variable)],
      ['Fixed bills', sgn0(-mo.pl.fixed)],
      [`Profit (need ${$0(C3_TARGET)})`, `<span class="${e.won ? 'cs-b-gain' : 'cs-b-loss'}">${$(mo.pl.profit)}</span>`, 'total']
    ]);
    runs.unshift({ label: upLabel(st.finish, e.up), price: e.price, profit: e.profit, won: e.won });
    const t = q(el, '[data-runs]'); t.hidden = false;
    q(t, 'tbody').innerHTML = runs.slice(0, 8).map(r => `<tr class="${r.won ? 'is-pick' : ''}"><td>${esc(r.label)}${r.won ? ' <span class="cs-b-gain">works</span>' : ''}</td><td>${$(r.price)}</td><td class="${r.won ? 'cs-b-gain' : r.profit < 0 ? 'cs-b-loss' : ''}">${$(r.profit)}</td></tr>`).join('');
    if (e.won) done?.({ won: true, summary: `${upLabel(st.finish, e.up)} at ${$(e.price)}: ${$(e.profit)} a month.`, best: { profit: r2c(e.profit) }, plan: { finish: st.finish, ...e.up, price: e.price } });
  });
  show();
  return () => { priceW?.destroy?.(); el.innerHTML = ''; };
}

export const CHALLENGES = [
  {
    id: 'C1', title: 'The Racer order', topic: 'Special order and contribution',
    situation: () => { const d = C1d(); return `A toy chain offers ${BN($s(d.offer.price))} each for ${BN(n(d.offer.qty))} Racers this month: chalk paint, checker band in red, No. 12, racing wheels, <b>no bumpers</b>, spoiler, gloss. You’re selling ${n(D.sold)} default cars a month at ${$s(D.P)}, and the line has spare time. Do you take the order?`; },
    scenario: { cfg: { ...RACER_ORDER }, R: {}, up: { ...NO_UPGRADES }, open: econ.DEFAULT_RULES.openingCash, months: 1 },
    render: (el, ctx, done) => c1Render(el, ctx, done),
    evaluate: c1Evaluate,
    win: plan => c1Evaluate(plan).won,
    hints: (d => [
        'The fixed bills come whether or not you take the order. What does one Racer add on top?',
        `Each Racer brings ${$(d.offer.price)} and costs its variable cost (the cost per car sold). Open the Racer’s cost sheet: Livery takes ${mn(d.rk.bott)} min, so its cycle is ${mn(d.rk.cycle)}.`,
        `Line minutes = cars started × cycle, and cars started = ${n(d.offer.qty)} × ${D.R.scrapEvery} ÷ ${D.R.scrapEvery - 1}. Cash tied up = Racers × variable cost − the deposit.`
      ])(C1d()),
    // the extension's answer (the largest order) is named only once the extension has been tried (ctx.mem.c1ExtTried)
    debrief: ctx => {
      const d = C1d(), tried = !!ctx?.mem?.c1ExtTried;
      return `<div class="cs-b-debrief"><p>Judge a special order on its ${G('contribution')}, not its full cost. The Racer’s full cost at ${n(D.sold)} cars is ${$(d.fullAt)}, more than the ${$(d.offer.price)} offered, which looks like “reject”. But ${$(D.fixedPer)} of that is fixed bills you pay anyway. Each Racer brings ${$(d.offer.price)} and costs ${$(d.rk.variable)} more, so it adds ${$(d.contrib)}: ${fmt.signed(d.extra)} this month, using ${mn(d.minutes)} of the ${mn(d.spare)} spare line minutes.</p>
        <p>Cash is the catch: with payment ${d.offer.payDays} days after delivery, ${$(d.tied)} is tied up; the ${pc(d.offer.deposit, 0)} deposit (${$0(d.dep)}) cuts that to ${$(d.tiedDep)}.</p>
        <p>The spec matters. With chrome bumpers the Racer would cost ${$(d.chrome.started)} started, ${$(d.chrome.variable + D.fixedPer)} full, and contribute only ${$(d.offer.price - d.chrome.variable)}.${tried ? ` The largest order that fits the spare time is ${n(d.maxOrder)}.` : ' How big an order would still fit? Try the extension.'}</p></div>`;
    }
  },
  {
    id: 'C2', title: `Open with ${$0(C2_OPEN)}`, topic: 'Cash planning',
    situation: () => { const d = C2d(); return `A new business: opening cash ${BN($0(C2_OPEN))}, the default car, months 1 to ${C2_MONTHS}. The plan as it stands (${$s(D.P)}, 30-day shop terms, suppliers paid on use) runs <b>out of cash on day ${d.def.firstNeg.day} of month ${d.def.firstNeg.month}</b>, and its lowest point is ${$0(d.def.low)} on day ${d.def.lowAt.day} of month ${d.def.lowAt.month}. Find a plan that never goes below ${$0(0)} and still makes at least ${$0(C2_TARGET)} a month.`; },
    scenario: { cfg: { ...DEFAULT_CAR }, R: { openingCash: C2_OPEN, months: C2_MONTHS }, up: { ...NO_UPGRADES }, open: C2_OPEN, months: C2_MONTHS },
    render: (el, ctx, done) => c2Render(el, ctx, done),
    evaluate: c2Evaluate,
    win: plan => c2Evaluate(plan).won,
    hints: [
      'Run the plan as it stands and find the first red day. What goes out before anything comes in?',
      'Two levers bring the cash days closer together: shops paying in 10 days, or paying your suppliers 21 days later. One of them costs 2% of every sale.',
      `A higher price sells fewer cars, so less cash is tied up each day. Try early pay somewhere above ${$s(34)}.`
    ],
    debrief: () => {
      const d = C2d(), name = g => `${g.shopTerms === 'early' ? 'Early pay' : 'Net 30'}${g.supplierCredit ? ' with supplier credit' : ', no supplier credit'}`;
      const rows = d.groups.map(g => [name(g), g.wins.length ? `${$(g.wins[0].price)} to ${$(g.wins[g.wins.length - 1].price)}` : 'none']);
      const b = d.best;
      return `<div class="cs-b-debrief"><p>Growing eats cash. A higher price sells fewer cars and ties up less money. An ${G('early-payment discount')} costs profit but buys safety.</p>
        <div class="cs-b-rows">${rowsHtml(rows)}</div>
        <p>The best plan is ${planLabel(b)}: ${$s(r2c(b.profit))} a month, but its lowest point is only ${$s(r2c(b.low))} on day ${b.lowAt.day} of month ${b.lowAt.month}. Net 30 without supplier credit never reaches ${$0(C2_TARGET)} while staying above ${$0(0)}: its best safe plan is ${$(d.bestSafeNet30.price)} → ${$0(d.bestSafeNet30.profit)}. Supplier credit at ${$s(D.P)} still dips to ${$0(d.creditAt32.low)} on day ${d.creditAt32.lowAt.day} of month ${d.creditAt32.lowAt.month}.</p></div>`;
    }
  },
  {
    id: 'C3', title: 'Turn it around', topic: 'Final challenge', final: true,
    situation: () => {
      const d = C3d();
      return `You’ve taken over the works. The shops’ standard order is the delivery van: Van in Signal red, side stripe in chalk, No. 7, classic wheels, chrome bumpers, no roof, gloss. The previous owner priced it at 4 × materials = 4 × ${$(d.vk.materials)} = ${BN($(d.asFound))}. The line runs flat out: shops want ${n(d.moAs.Q)} a month, it can make only ${n(Math.floor(d.moAs.capGood + EPS))}, and you lose ${BN($(-d.moAs.pl.profit))} a month. Make at least ${$0(C3_TARGET)} a month.`;
    },
    scenario: { cfg: { ...DELIVERY_VAN }, R: { price: roundTo(4 * econ.carCost(DELIVERY_VAN, D.R).materials, 2) }, up: { ...NO_UPGRADES }, open: econ.DEFAULT_RULES.openingCash, months: 1 },
    render: (el, ctx, done) => c3Render(el, ctx, done),
    evaluate: c3Evaluate,
    win: plan => c3Evaluate(plan).won,
    hints: [
      'What sets the van’s pace? Look at the strip.',
      'Satin brings Paint to 2.5, and four other stations are already at 2.5. Speeding up one station now does nothing.',
      'One upgrade saves money on every car without touching the pace. Who could you do without at Blank?'
    ],
    debrief: () => {
      const d = C3d(), w = d.wins, best = w.reduce((a, b) => b.profit > a.profit ? b : a, w[0]);
      return `<div class="cs-b-debrief"><p>The only plan that wins is <b>satin + hopper auto-feed</b>, with no lamp and no extra operator, at ${$(w[0].price)} to ${$(w[w.length - 1].price)}. The best is ${$(best.price)} → ${$(best.profit)}.</p>
        <p>Satin takes the van’s cycle from ${mn(d.vk.cycle)} to ${mn(d.satinK.cycle)} min, but then ${n(d.satinK.bottAll.length)} stations sit at ${mn(d.satinK.bott)}, so a faster station changes nothing. Auto-feed doesn’t touch the pace: it takes one operator off every cycle, ${$(d.saving)} per started satin van, and pays for itself above ${n(d.payback)} started satin vans a month (${$0(UPGRADES.autofeed.fixed)} ÷ ${$(d.saving)}).</p>
        <div class="cs-b-tablewrap"><table class="cs-b-table"><thead><tr><th>Plan</th><th>Best price</th><th>Profit</th></tr></thead><tbody>
        ${d.plans.map(p => `<tr class="${p.profit >= C3_TARGET - EPS ? 'is-pick' : ''}"><td>${esc(p.label)}<span class="cs-b-sub">cycle ${mn(p.k.cycle)} min · crew ${p.k.crew} · variable ${$(p.k.variable)} · fixed ${$0(p.F)}</span></td><td>${$(p.best)}</td><td class="${p.profit >= C3_TARGET - EPS ? 'cs-b-gain' : p.profit < 0 ? 'cs-b-loss' : ''}">${$(p.profit)}</td></tr>`).join('')}
        </tbody></table></div></div>`;
    }
  }
];

// After a right answer the runner shows a check's `after`: give every scored check its worked answer (SPEC §3.1,
// "Worked answer shows…"); a choice shows why the right option is right.
for (const c of [...LESSONS_B.flatMap(l => [...l.checks, l.twin]).filter(Boolean), ...WARMUPS]) {
  if (c.after || c.scored === false) continue;
  if (c.solution) c.after = c.solution;
  else if (c.kind === 'choice') { const o = c.options.find(x => x.correct); if (o?.why) c.after = () => o.why; }
}
