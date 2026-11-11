// Toyline Ledger overlay (docs/CONTRACTS.md "Overlay", SPEC §4.3-4.4).
// 3D-anchored HTML in #overlay: station tags (7 stations + Pack + Truck), car $ pills, "+$x" floats, invoice chips
// and QC FAIL tags. Anchors come from engine.anchor(), are projected with engine.project() on every 'frame' and are
// written as translate3d only when they moved more than 0.5 px. The running-tab receipt lives in #card (phone: a
// one-line card that opens a slide-up sheet). Every figure is read from econ.js (car.cost = econ.carCost, costLines,
// month) or from the tab lines the engine posted; nothing here is typed by hand.
import { effectiveLayers } from './app.js';

const STEM = 7;          // px between a compact tag and its anchor
const ROW_GAP = 4;       // px between the two tag rows
const FLOAT_MS = 1150, CHIP_MS = 2600, FAIL_MS = 3200;

// What each station does (copy, no figures).
const STATION_DO = [
  'Drops a birch block onto the pallet.',
  'Cuts the body shape out of the block.',
  'Sands the body smooth.',
  'Paints the body and adds the top coat, or wipes on oil.',
  'Prints the stripes and the race number.',
  'Presses in the axles and fits the wheels.',
  'Fits lights, grille, plate, bumpers and roof.'
];
// Which layer shows which kind of tab line (SPEC §4.2: materials L1, crew/power/consumables L4, scrap/carton/freight L5).
const KIND_LAYER = { material: 'materials', crew: 'meter', consumable: 'meter', qc: 'meter', power: 'meter', scrap: 'scrap', carton: 'scrap', freight: 'scrap' };
const KIND_SHORT = { crew: 'operator', consumable: 'consumables', qc: 'QC & pack', power: 'power', scrap: 'Scrap share', carton: 'Carton', freight: 'Freight' };
const PLACE_WHERE = { exit: 'at QC', lot: 'in the lot', crane: 'on the crane', carton: 'being boxed', truck: 'on the truck', scrap: 'scrapped', queue: 'queued', preview: 'not started', stock: 'in stock' };

const CSS = `
#overlay .ov-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.app.bare #overlay{display:none}
.ov-tag{position:absolute;left:0;top:0;box-sizing:border-box;pointer-events:auto;cursor:pointer;font:500 10.5px/1.3 var(--f-mono);font-variant-numeric:tabular-nums;letter-spacing:.02em;color:var(--ink);background:var(--glass);border:1px solid var(--line);border-radius:6px;padding:4px 7px;white-space:nowrap;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 1px 3px color-mix(in srgb,var(--ink) 16%,transparent);user-select:none;-webkit-user-select:none;will-change:transform;text-align:left}
.ov-tag::after{content:"";position:absolute;left:var(--ov-sx,50%);top:100%;width:1px;height:var(--ov-stem,${STEM}px);background:color-mix(in srgb,var(--ink) 45%,transparent);pointer-events:none}
.ov-tag:not(.ov-open):hover{border-color:var(--ink)}
.ov-tag .ov-n{display:block;font-weight:600;letter-spacing:.06em}
.ov-tag .ov-m,.ov-tag .ov-d{display:block;color:var(--muted)}
.ov-tag .ov-d{color:var(--ink)}
.ov-tag .ov-sep{display:none}
.ov-tag .ov-pace{display:block;font-size:8.5px;font-weight:600;letter-spacing:.14em;margin-bottom:1px}
.ov-tag.ov-empty{opacity:.4}
.ov-tag.ov-bott{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ov-tag.ov-bott .ov-m,.ov-tag.ov-bott .ov-d{color:var(--on-accent)}
.ov-tag.ov-wait .ov-n::before{content:"";display:inline-block;width:8px;height:8px;margin-right:5px;vertical-align:-1px;border-radius:2px;background:repeating-linear-gradient(135deg,var(--accent) 0 2px,transparent 2px 4px);box-shadow:inset 0 0 0 1px var(--wait)}
.ov-tag.ov-dot{width:10px;height:10px;padding:0;border-radius:50%;overflow:visible;background:var(--ink);border:2px solid var(--glass);box-shadow:none}
.ov-tag.ov-dot>*{display:none}
.ov-tag.ov-dot::after{display:none}
.ov-tag.ov-dot.ov-bott{background:var(--accent);border-color:var(--ink)}
.ov-tag.ov-open{white-space:normal;width:288px;max-width:calc(100% - 8px);cursor:default;padding:0;background:var(--surface);color:var(--ink);-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:0 4px 18px color-mix(in srgb,var(--ink) 20%,transparent);z-index:2}
.ov-tag.ov-open .ov-th{padding:7px 10px 6px;cursor:pointer;border-bottom:1px dashed var(--line);border-radius:5px 5px 0 0}
.ov-tag.ov-open .ov-n,.ov-tag.ov-open .ov-m,.ov-tag.ov-open .ov-d,.ov-tag.ov-open .ov-sep{display:inline;color:inherit}
.ov-tag.ov-open .ov-pace{display:block}
.ov-tag.ov-open.ov-bott{background:var(--surface);border-color:var(--accent);color:var(--ink)}
.ov-tag.ov-open.ov-bott .ov-th{background:var(--accent);color:var(--on-accent);border-bottom-color:var(--accent)}
.ov-tag.ov-open.ov-empty{opacity:1}
.ov-tag.ov-open.ov-empty .ov-th{color:var(--muted)}
.ov-tb{padding:6px 10px 9px;display:grid;gap:2px}
.ov-do{font:12px/1.35 var(--f-display);color:var(--muted);margin-bottom:3px;letter-spacing:0}
.ov-sec{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:5px}
.ov-row{display:grid;grid-template-columns:auto minmax(10px,1fr) auto;align-items:baseline;column-gap:5px}
.ov-row::before{content:"";grid-column:2;grid-row:1;border-bottom:1px dotted var(--line);transform:translateY(-3px)}
.ov-row>:first-child{grid-column:1;grid-row:1;min-width:0}
.ov-row>:last-child{grid-column:3;grid-row:1;text-align:right;white-space:nowrap}
.ov-row em{font-style:normal;color:var(--muted)}
.ov-row.ov-sum{border-top:1px solid var(--line);padding-top:3px;margin-top:2px;font-weight:600}
.ov-row.ov-sum::before{border-bottom-color:transparent}
.ov-note{font:11.5px/1.4 var(--f-display);color:var(--muted);margin-top:4px;letter-spacing:0}
.ov-acts{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
.ov-btn{font:600 12px/1 var(--f-display);letter-spacing:0;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:6px;padding:0 10px;min-height:32px;cursor:pointer}
.ov-btn:hover{border-color:var(--ink)}
.ov-btn[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.ov-work{margin-top:6px;padding:7px 8px;border-radius:6px;background:var(--bg);display:grid;gap:4px;font-size:10.5px;line-height:1.4;overflow-wrap:anywhere}
.ov-bubble{padding:0 10px 9px;font:12.5px/1.45 var(--f-display);letter-spacing:0;white-space:normal}
.ov-bubble:empty{display:none}
.ov-a{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}
.ov-a>i{position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:600 10.5px/1 var(--f-mono);font-style:normal;font-variant-numeric:tabular-nums;white-space:nowrap}
.ov-pill{color:var(--bg);background:var(--ink);border-radius:999px;padding:3px 7px}
.ov-pill.ov-me{background:var(--accent);color:var(--on-accent);box-shadow:0 0 0 2px var(--ink)}
.ov-float>i{color:var(--ink);background:var(--glass);border:1px solid var(--line);border-radius:4px;padding:3px 5px;animation:ov-rise ${FLOAT_MS}ms ease-out forwards}
.ov-chip>i{font-weight:500;color:var(--invoice);background:var(--glass);border:1px dashed var(--invoice);border-radius:5px;padding:4px 7px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:ov-chip ${CHIP_MS}ms ease-out forwards}
.ov-fail>i{color:var(--surface);background:var(--loss);border-radius:4px;padding:4px 7px;letter-spacing:.12em;animation:ov-fail ${FAIL_MS}ms ease-out forwards}
@keyframes ov-rise{0%{opacity:0;transform:translate(-50%,-100%)}15%{opacity:1}100%{opacity:0;transform:translate(-50%,calc(-100% - 30px))}}
@keyframes ov-chip{0%{opacity:0;transform:translate(-50%,-100%)}12%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translate(-50%,calc(-100% - 34px))}}
@keyframes ov-fail{0%{opacity:0}8%{opacity:1}85%{opacity:1}100%{opacity:0}}
#card.ov-card{display:block;padding:0;gap:0;width:300px;max-width:calc(100% - 24px);max-height:calc(100% - 150px);overflow:auto;overscroll-behavior:contain;background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:0 3px 14px color-mix(in srgb,var(--ink) 16%,transparent)}
.app.bare #card.ov-card{display:none}
#card.ov-card.ov-lostc{border-color:var(--loss)}
#card .ov-legacy{display:none}
.ov-rc{font:11px/1.45 var(--f-mono);font-variant-numeric:tabular-nums;color:var(--ink);padding:9px 12px 10px}
.ov-rc-top{display:flex;justify-content:space-between;gap:8px;font-size:10px;letter-spacing:.12em;color:var(--muted)}
.ov-rc-nm{font:800 14px/1.25 var(--f-display);font-stretch:112%;margin-top:3px;text-wrap:balance}
.ov-rc-st{font:12px/1.3 var(--f-display);color:var(--muted)}
.ov-rule{border-top:1px dashed var(--line);margin:6px 0 5px}
.ov-rs{border-radius:3px;margin:0 -4px;padding:0 4px}
.ov-rc-sub{font-size:10px;line-height:1.35;color:var(--muted);padding-left:3ch;margin-bottom:2px}
.ov-rc-sub>span{white-space:nowrap}
.ov-more{display:block;margin:3px 0 0 auto;padding:0 2px;min-height:24px;border:0;background:transparent;color:var(--muted);font:500 10.5px var(--f-mono);text-decoration:underline dotted;text-underline-offset:3px;cursor:pointer}
.ov-more:hover{color:var(--ink)}
.ov-more:focus-visible{outline:2px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 4px var(--accent)}
.ov-rc-tot{font-weight:600;font-size:13px}
.ov-rc-note{font:11.5px/1.35 var(--f-display);color:var(--muted);margin-top:4px}
.ov-rc-foot{font-size:10.5px;line-height:1.5;color:var(--muted)}
.ov-rc-foot b{color:var(--ink);font-weight:600}
.ov-rc-foot b.ov-gain{color:var(--gain-ink, var(--gain))}
.ov-rc-foot b.ov-loss,.ov-rc-lost{color:var(--loss-ink, var(--loss))}
.ov-rc-lost{font-weight:600;font-size:11.5px;line-height:1.4}
.ov-rc.ov-lost .ov-rs,.ov-rc.ov-lost .ov-rs .ov-rc-sub{color:var(--loss-ink, var(--loss))}
.ov-new{animation:ov-flash 1.4s ease-out}
@keyframes ov-flash{from{background:color-mix(in srgb,var(--accent) 50%,transparent)}to{background:transparent}}
.ov-line{display:none}
#card.ov-card.ov-ph{width:auto;right:8px;max-width:none;max-height:none;overflow:visible;border-radius:10px}
#card.ov-ph .ov-rcwrap{display:none}
#card.ov-ph .ov-line{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:0 12px;border:0;background:transparent;color:var(--ink);font:500 12px/1.2 var(--f-mono);font-variant-numeric:tabular-nums;text-align:left;cursor:pointer;border-radius:10px}
#card.ov-ph .ov-line>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#card.ov-ph .ov-line>i{flex:none;width:7px;height:7px;border-left:2px solid var(--muted);border-top:2px solid var(--muted);transform:translateY(2px) rotate(45deg)}
#card.ov-ph.ov-lostc .ov-line{color:var(--loss-ink, var(--loss))}
.ov-scrim{position:fixed;inset:0;z-index:39;background:color-mix(in srgb,var(--ink) 30%,transparent);opacity:0;transition:opacity .26s}
.ov-sheet{position:fixed;left:0;right:0;bottom:0;z-index:40;max-height:80vh;overflow:auto;overscroll-behavior:contain;background:var(--surface);color:var(--ink);border-top:1px solid var(--line);border-radius:14px 14px 0 0;box-shadow:0 -6px 24px color-mix(in srgb,var(--ink) 22%,transparent);transform:translateY(100%);transition:transform .26s ease-out;padding-bottom:env(safe-area-inset-bottom,0px)}
.ov-scrim.ov-on{opacity:1}
.ov-sheet.ov-on{transform:none}
.ov-sheet-bar{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px 4px max(16px,env(safe-area-inset-left,0px));background:var(--surface);border-bottom:1px dashed var(--line)}
.ov-sheet-bar b{font:800 16px/1.2 var(--f-display);font-stretch:112%}
.ov-x{min-width:64px;min-height:44px;border:0;background:transparent;color:var(--ink);font:600 13.5px var(--f-display);cursor:pointer;border-radius:8px}
.ov-sheet .ov-rc{font-size:12.5px;padding:10px max(16px,env(safe-area-inset-right,0px)) 18px max(16px,env(safe-area-inset-left,0px))}
.ov-sheet .ov-rc-sub{font-size:11px}
.ov-sheet .ov-rc-foot{font-size:11.5px}
.ov-sheet .ov-rc-top{display:none}
@media (pointer:coarse){.ov-btn,.ov-more{min-height:44px}.ov-tag:not(.ov-open)::before{content:"";position:absolute;inset:-8px -4px}.ov-tag.ov-dot::before{inset:-17px}}
@media (max-width:820px){.ov-tag{font-size:10px}}
@media (prefers-reduced-motion:reduce){.ov-a>i,.ov-new{animation:none!important}.ov-sheet,.ov-scrim{transition:none!important}}
`;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const safe = (fn, dflt = null) => { try { return fn(); } catch { return dflt; } };
const hit = (a, b) => a.x0 < b.x1 + 2 && b.x0 < a.x1 + 2 && a.y0 < b.y1 + 2 && b.y0 < a.y1 + 2;

export function mountOverlay({ engine, app, econ, tutor } = {}) {
  const doc = document;
  const stage = engine?.stageEl || doc.getElementById('stage');
  if (!engine || !app || !econ || !stage) throw new Error('mountOverlay needs { engine, app, econ } and a #stage');
  const tu = tutor || { available: () => false, ask: () => ({ stop() { } }), onChange() { }, snapshot: () => ({}) };
  const { fmt, STATIONS } = econ;
  const NS = STATIONS.length, PACK = NS, TRUCK = NS + 1;
  const $ = x => fmt.money2(x), mn = x => fmt.min(x);
  const plus = x => (econ.r2(x) < 0 ? '' : '+') + fmt.money2(x);
  const now = () => performance.now();
  const offs = [];
  let alive = true;

  /* ---------- DOM ---------- */
  let style = doc.getElementById('css-overlay'), ownStyle = false;
  if (!style) { style = doc.createElement('style'); style.id = 'css-overlay'; style.textContent = CSS; doc.head.appendChild(style); ownStyle = true; }
  let host = doc.getElementById('overlay'), ownHost = false;
  if (!host) { host = doc.createElement('div'); host.id = 'overlay'; host.className = 'overlay'; host.setAttribute('aria-hidden', 'true'); stage.appendChild(host); ownHost = true; }
  const mk = (tag, cls) => { const e = doc.createElement(tag); if (cls) e.className = cls; return e; };
  const pillLayer = mk('div', 'ov-layer ov-pills'), tagLayer = mk('div', 'ov-layer ov-tags'), fxLayer = mk('div', 'ov-layer ov-fx');
  host.append(pillLayer, tagLayer, fxLayer);

  // #card: overlay-owned (CONTRACTS). Keep the original children (#cWo, #cName, #cSub) inside a hidden wrapper so
  // anything still holding them keeps working, and restore them on destroy.
  const card = doc.getElementById('card');
  const cardOrig = card ? { cls: card.className, hidden: card.hidden, role: card.getAttribute('role'), label: card.getAttribute('aria-label'), kids: [...card.childNodes] } : null;
  let rcWrap = null, lineBtn = null, lineTxt = null;
  if (card) {
    const legacy = mk('div', 'ov-legacy'); legacy.hidden = true; legacy.append(...cardOrig.kids);
    rcWrap = mk('div', 'ov-rcwrap');
    lineBtn = mk('button', 'ov-line'); lineBtn.type = 'button';
    lineBtn.setAttribute('aria-haspopup', 'dialog'); lineBtn.setAttribute('aria-controls', 'ovSheet'); lineBtn.setAttribute('aria-expanded', 'false');
    lineTxt = mk('span'); lineBtn.append(lineTxt, mk('i'));
    lineBtn.lastChild.setAttribute('aria-hidden', 'true');
    card.replaceChildren(legacy, rcWrap, lineBtn);
    card.classList.add('ov-card');
    card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Running tab');
    card.hidden = true;
  }
  const scrim = mk('div', 'ov-scrim'); scrim.hidden = true;
  const sheet = mk('div', 'ov-sheet'); sheet.id = 'ovSheet'; sheet.hidden = true;
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'ovSheetT');
  sheet.innerHTML = '<div class="ov-sheet-bar"><b id="ovSheetT">Running tab</b><button type="button" class="ov-x" data-act="close">Close</button></div><div class="ov-sheet-body"></div>';
  const sheetBody = sheet.lastChild, sheetClose = sheet.querySelector('.ov-x'), sheetTitle = sheet.querySelector('#ovSheetT');
  doc.body.append(scrim, sheet);

  /* ---------- environment ---------- */
  const mqPhone = matchMedia('(max-width: 820px)'), mqRM = matchMedia('(prefers-reduced-motion: reduce)');
  let phone = mqPhone.matches, rm = mqRM.matches;
  const onMq = () => { phone = mqPhone.matches; rm = mqRM.matches; for (const t of tags) { t.needMeasure = true; } if (rm) clearFx('ov-float'); if (!phone && sheetOpen) closeSheet(); dirty = true; cardKey = ''; };
  mqPhone.addEventListener('change', onMq); mqRM.addEventListener('change', onMq);
  offs.push(() => { mqPhone.removeEventListener('change', onMq); mqRM.removeEventListener('change', onMq); });
  // tags stay below the HUD chip row (engine-owned #hud; it wraps to two rows on narrow stages)
  const hud = doc.getElementById('hud');
  let W = stage.clientWidth, H = stage.clientHeight, hudBottom = -1;
  const measureStage = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    hudBottom = hud && stage.contains(hud) && hud.offsetParent ? hud.offsetTop + hud.offsetHeight : -1;
    for (const t of tags) t.lx = NaN;
  };
  const ro = new ResizeObserver(measureStage);
  ro.observe(stage); if (hud) ro.observe(hud);
  // a tag whose size changes on its own (the tutor bubble streaming in) is re-measured
  const tagRO = new ResizeObserver(es => { for (const e of es) { const t = tags[+e.target.dataset.i]; if (t && t.shown && !t.el.classList.contains('ov-dot')) { const b = e.borderBoxSize?.[0]; if (b) { t.w = b.inlineSize; t.h = b.blockSize; } else t.needMeasure = true; } } });
  offs.push(() => { ro.disconnect(); tagRO.disconnect(); });

  /* ---------- model helpers ---------- */
  let L = effectiveLayers(app.state);
  let rVer = 0;
  const price = () => app.state.price ?? app.state.R?.price ?? econ.R0.price;
  const costCache = new Map();
  const cfgCost = (cfg, up = app.state.up) => {
    if (!cfg) return null;
    const R = app.state.R, key = safe(() => econ.carKey(cfg, up), JSON.stringify(cfg));
    const e = costCache.get(key);
    if (e && e.R === R) return e.c;
    const c = safe(() => econ.carCost(cfg, R, up));
    costCache.set(key, { R, c });
    return c;
  };
  const costOf = car => car?.cost || cfgCost(car?.cfg);
  const visible = l => !!L[KIND_LAYER[l.kind] || 'meter'];
  const visLines = car => (car?.tab?.lines || []).filter(visible);
  const visTotal = car => visLines(car).reduce((a, l) => a + l.value, 0);
  const isLost = car => !!(car && (car.scrapped || car.place === 'scrap'));
  const lostBy = new Map();
  const lostOf = car => lostBy.get(car.wo) ?? car.tab?.total ?? 0;
  const carName = cfg => {
    const C = econ.CATALOG; if (!cfg) return '';
    const b = C.body[cfg.body], l = C.livery[cfg.livery], w = C.wheels[cfg.wheels], f = C.finish[cfg.finish];
    const num = cfg.number !== undefined && cfg.number !== null && String(cfg.number).trim() !== '' ? 'No. ' + String(cfg.number).trim() : null;
    return [b?.label, l && cfg.livery !== 'plain' ? l.label : null, num, w ? w.label + ' wheels' : null, f?.label].filter(Boolean).join(' · ');
  };
  const reveal = () => !(app.state.mode === 'course' && app.state.lesson);

  /* ---------- the line right now ---------- */
  // Read from engine.lineUnits(): the car at each station, its minutes there, the actual cycle (move + slowest
  // occupied station) and the bottleneck. With nothing on the line, the order form's car stands in (dimmed).
  let ls = { units: [], at: Array(NS).fill(null), m: Array(NS).fill(0), mMax: 0, cycle: 0, bott: [], occupied: false, idleCost: null };
  function readLine() {
    // During a move the engine has already bumped every slot; until the next work phase starts a station still
    // shows the car it just worked on, like the strip, the HMI and the car's own status line.
    const moving = safe(() => engine.cycleInfo.phase) === 'move';
    const units = (safe(() => engine.lineUnits(), []) || []).map(u => u && moving ? { ...u, slot: u.slot - 1 } : u);
    const at = Array(NS).fill(null);
    for (const u of units) if (u && u.car && u.slot >= 0 && u.slot < NS) at[u.slot] = u.car;
    const occupied = at.some(Boolean), R = app.state.R;
    let m, mMax, cycle, bott, idleCost = null;
    if (occupied) {
      m = at.map((car, k) => { const c = car && costOf(car); return c ? c.m[k] : 0; });
      mMax = Math.max(...m); cycle = R.moveMin + mMax;
      bott = m.map((x, k) => at[k] && Math.abs(x - mMax) < 1e-9 ? k : -1).filter(k => k >= 0);
    } else {
      idleCost = cfgCost(safe(() => engine.cfg) || econ.DEFAULT_CAR);
      m = idleCost ? idleCost.m.slice() : Array(NS).fill(0);
      mMax = idleCost ? idleCost.bott : 0; cycle = idleCost ? idleCost.cycle : 0; bott = idleCost ? idleCost.bottAll.slice() : [];
    }
    return { units, at, m, mMax, cycle, bott, occupied, idleCost };
  }
  const slotOf = car => { const u = car && ls.units.find(x => x.car === car); return u ? u.slot : -1; };
  // the tag that belongs to where the tracked car is: its station, Pack while being boxed, Truck once loaded
  const tagOfCar = car => {
    if (!car) return -1;
    const k = slotOf(car); if (k >= 0 && k < NS) return k;
    if (car.place === 'carton' || car.place === 'crane') return PACK;
    if (car.place === 'truck') return TRUCK;
    return -1;
  };

  /* ---------- station tags ---------- */
  const tags = Array.from({ length: NS + 2 }, (_, i) => {
    const el = mk('div', 'ov-tag'); el.hidden = true; el.dataset.i = i;
    const th = mk('div', 'ov-th'), tb = mk('div', 'ov-tb'), bub = mk('div', 'ov-bubble');
    tb.hidden = true; el.append(th, tb, bub); tagLayer.appendChild(el); tagRO.observe(el);
    return { i, el, th, tb, bub, want: false, shown: false, open: false, head: '', body: '', cls: '', label: '', mode: '', w: 0, h: 0, needMeasure: true, lx: NaN, ly: NaN, stem: STEM, px: 0, py: 0, working: false, ask: null };
  });
  let userOpen = null;          // a tag the learner opened (tap on a tag, or a strip cell via 'stationTap')
  let autoClosed = null;        // in Follow, the learner closed the auto-opened tag: keep it closed at this station
  const doneThisCycle = new Set();
  let cycleNo = 0;

  function stationParts(k) {
    const car = ls.at[k], c = car ? costOf(car) : (ls.occupied ? null : ls.idleCost);
    return { car, c, empty: !car };
  }
  function headOf(t) {
    const k = t.i, R = app.state.R;
    if (t.i === PACK || t.i === TRUCK) {
      const n = t.i === PACK ? 'PACK' : 'TRUCK';
      const d = L.scrap ? (t.i === PACK ? `carton ${plus(R.carton)}` : `freight ${plus(R.freight)}`) : '';
      return { html: `<span class="ov-n">${n}</span>` + (d ? `<span class="ov-sep"> · </span><span class="ov-d">${d}</span>` : ''), label: n + (d ? ' · ' + d : ''), cls: '' };
    }
    const { car, c, empty } = stationParts(k);
    const name = `${pad2(k + 1)} ${STATIONS[k].toUpperCase()}`;
    let m = '', d = '';
    if (empty && ls.occupied) m = 'empty';
    else if (c) {
      if (L.minutes) m = L.wait ? `${mn(c.m[k])}/${mn(ls.cycle)} min` : `${mn(c.m[k])} min`;
      if (L.materials) d = plus(L.meter ? c.stationPost[k] : c.matByStation[k]);
    }
    const pace = L.wait && ls.bott.includes(k) && !!c;
    const bits = [m, d].filter(Boolean);
    const html = (pace ? '<span class="ov-pace">SETS THE PACE</span>' : '') + `<span class="ov-n">${name}</span>` +
      (m ? `<span class="ov-sep"> · </span><span class="ov-m">${m}</span>` : '') + (d ? `<span class="ov-sep"> · </span><span class="ov-d">${d}</span>` : '');
    const cls = (pace ? ' ov-bott' : '') + (empty ? ' ov-empty' : '') + (L.wait && car && doneThisCycle.has(k) && !pace ? ' ov-wait' : '');
    return { html, label: [name, ...bits].join(' · '), cls, car };
  }

  const row = (a, b, v, cls = '') => `<div class="ov-row${cls ? ' ' + cls : ''}"><span>${a}${b ? ` <em>${b}</em>` : ''}</span><span>${v}</span></div>`;
  const sec = s => `<div class="ov-sec">${s}</div>`;
  const acts = (t, canWork) => {
    const work = canWork ? `<button type="button" class="ov-btn" data-act="work" tabindex="-1" aria-pressed="${t.working}">${t.working ? 'Hide working' : 'Show working'}</button>` : '';
    const why = safe(() => tu.available()) ? '<button type="button" class="ov-btn" data-act="why" tabindex="-1">Why?</button>' : '';
    return work || why ? `<div class="ov-acts">${work}${why}</div>` : '';
  };

  function stationBody(t) {
    const k = t.i, R = app.state.R, { car, c } = stationParts(k);
    let h = `<div class="ov-do">${STATION_DO[k] || ''}</div>`;
    if (!c) {
      const opsHere = econ.stationCrew(app.state.up)[k];
      h += `<div class="ov-note">No car here this cycle.${L.meter && opsHere ? ` The operator is still paid: ${fmt.rate(R.labourPerMin)} a minute while the line runs.` : ''}</div>`;
      return h + acts(t, false);
    }
    if (L.materials) {
      h += sec(car ? `Adds to ${esc(car.wo)}` : 'Adds to each car of this order');
      const parts = c.parts[k] || [];
      if (!parts.length) h += row('No parts here', '', '–');
      for (const p of parts) h += row(esc(p.label), '', $(p.value));
      if (L.meter) {
        h += row('Operator', c.crewAt[k] ? `${c.crewAt[k]} × ${mn(c.cycle)} min` : 'none', $(c.crewByStation[k]));
        if (c.consByStation[k]) h += row('Consumables', '', $(c.consByStation[k]));
      }
      h += row('Adds', '', $(L.meter ? c.stationPost[k] : c.matByStation[k]), 'ov-sum');
    }
    if (L.minutes) {
      h += sec(car ? 'This cycle' : 'Each cycle');
      const work = c.m[k], cyc = ls.cycle;
      h += row('Work', '', `${mn(work)} min`);
      if (L.wait) {
        const ops = c.crewAt[k], rate = c.rate, wB = Math.max(0, ls.mMax - work), mv = R.moveMin;
        const bName = STATIONS[ls.bott[0] ?? c.bottIdx];
        h += row('Crew', ops ? `${ops} × ${mn(cyc)} min` : 'no operator', L.meter ? $(ops * cyc * rate) : `${mn(ops * cyc)} min`);
        h += row('Wait', wB > 1e-9 ? `${mn(wB)} for ${bName} + ${mn(mv)} move` : `${mn(mv)} move`, L.meter ? $(ops * (wB + mv) * rate) : `${mn(wB + mv)} min`);
      }
    }
    if (car && L.wait && Math.abs(c.cycle - ls.cycle) > 1e-9)
      h += `<div class="ov-note">${esc(car.wo)}’s tab uses its own ${mn(c.cycle)}-min cycle. The line runs at ${mn(ls.cycle)} min this cycle; the difference goes to Idle line.</div>`;
    h += acts(t, L.materials || L.minutes);
    if (t.working) h += stationWorking(k, c);
    return h;
  }
  function stationWorking(k, c) {
    const R = app.state.R, out = [];
    const parts = c.parts[k] || [], mat = c.matByStation[k], crew = c.crewByStation[k], cons = c.consByStation[k], post = c.stationPost[k];
    if (L.materials) out.push(parts.length ? `Parts: ${parts.map(p => `${p.label} ${$(p.value)}`).join(' + ')} = ${$(mat)}` : `Parts: none at ${STATIONS[k]}`);
    if (L.minutes && !L.meter) out.push(`Hands-on work: ${mn(c.m[k])} min × ${fmt.rate(c.rate)} = ${$(c.m[k] * c.rate)}`);
    if (L.wait) {
      out.push(`Cycle: ${mn(R.moveMin)} move + ${mn(c.bott)} at ${STATIONS[c.bottIdx]}, the slowest = ${mn(c.cycle)} min`);
      out.push(`Paid but waiting here: ${mn(c.cycle)} − ${mn(c.m[k])} = ${mn(c.cycle - c.m[k])} min`);
    }
    if (L.meter) {
      out.push(`Operator: ${c.crewAt[k]} × ${mn(c.cycle)} min × ${fmt.rate(c.rate)} = ${$(crew)}`);
      out.push(`Adds: ${[mat, crew].concat(cons ? [cons] : []).map($).join(' + ')} = ${$(post)}`);
      if (c.tab) out.push(`Tab: ${$(k ? c.tab[k - 1] : 0)} + ${$(post)} = ${$(c.tab[k])}`);
      const cl = safe(() => econ.costLines(c.cfg, R, c.up || app.state.up, { price: price() }).byId);
      if (cl) for (const id of ['labour.stations', 'started']) { const l = cl[id]; if (l) out.push(`${l.label} (whole car): ${l.how} = ${$(l.value)}`); }
    }
    return `<div class="ov-work">${out.map(s => `<div>${esc(s)}</div>`).join('')}</div>`;
  }
  function endBody(t) {
    const R = app.state.R, a = safe(() => engine.actuals, {}) || {}, pack = t.i === PACK;
    let h = `<div class="ov-do">${pack ? 'Boxes each good car in a printed carton.' : 'Takes the boxed cars to the toy shops.'}</div>`;
    if (L.scrap) {
      h += sec('Adds to each good car');
      h += pack ? row('Carton', '', $(R.carton)) : row('Freight', '', $(R.freight));
      h += sec('This session');
      if (pack) h += row('Boxed', '', fmt.count(a.packed || 0));
      else {
        h += row('Shipped', '', fmt.count(a.shipped || 0));
        h += row('Invoiced', '', fmt.money(a.invoiced || 0));
        h += '<div class="ov-note">An invoice is money a shop owes. The bank moves only when the shop pays.</div>';
      }
    }
    h += acts(t, L.scrap);
    if (t.working) {
      const cl = safe(() => econ.costLines(econ.DEFAULT_CAR, R, app.state.up, { price: price() }).byId) || {};
      const l = cl[pack ? 'carton' : 'freight'];
      const out = [l ? `${l.label}: ${$(l.value)} ${l.how}` : ''];
      if (pack) out.push('A scrapped car never reaches packing, so it never gets a carton.');
      else out.push(`Invoice: ${$(price())} per car, ${termsText(R)}`);
      h += `<div class="ov-work">${out.filter(Boolean).map(s => `<div>${esc(s)}</div>`).join('')}</div>`;
    }
    return h;
  }
  const termsText = R => {
    if (R.shopTerms === 'early') return `${$(econ.netPrice(price(), R))} if paid early`;
    const n = /(\d+)/.exec(R.shopTerms || '');
    return n ? `due in ${n[1]} days` : 'paid later';
  };

  function stopAsk(t) { if (t.ask) { safe(() => t.ask.stop()); t.ask = null; } t.bub.replaceChildren(); }
  function askWhy(t) {
    stopAsk(t);
    const s = app.state, R = s.R;
    let question, station = null, cfg = safe(() => engine.cfg) || econ.DEFAULT_CAR, up = s.up;
    if (t.i < NS) {
      const { car, c } = stationParts(t.i), k = t.i, name = STATIONS[k];
      if (car) { cfg = car.cfg; up = c?.up || up; }
      const pace = ls.bott.includes(k) && !!c;
      if (!c) question = `What does an empty ${name} station cost while the line runs?`;
      else if (pace && L.wait) question = `Why does ${name} set the pace for the whole line?`;
      else question = `Why does ${name} add ${$(L.meter ? c.stationPost[k] : c.matByStation[k])} to this car?`;
      if (c) station = {
        station: `${pad2(k + 1)} ${name}`, workMin: c.m[k], cycleMin: econ.r1(ls.cycle), bottleneck: ls.bott.map(i => STATIONS[i]).join(' & '),
        adds: econ.r2(c.stationPost[k]), materials: econ.r2(c.matByStation[k]), operator: econ.r2(c.crewByStation[k]), consumables: econ.r2(c.consByStation[k]),
        parts: (c.parts[k] || []).map(p => ({ label: p.label, value: econ.r2(p.value) })), car: car ? car.wo : null
      };
    } else if (t.i === PACK) question = 'Why does only a good car pay for a carton?';
    else question = 'Why doesn’t the bank go up when the truck leaves?';
    const base = safe(() => tu.snapshot({ cfg, R, up, price: price() })) || {};
    try { t.ask = tu.ask(t.bub, { kind: 'why', question, data: station ? { ...base, station } : base, reveal: reveal() }); }
    catch (e) { console.error('[overlay] tutor.ask failed', e); }
  }

  /* ---------- what shows where ---------- */
  function wanted() {
    const s = app.state, want = Array(NS + 2).fill(false);
    const mode = engine.cameraMode || 'overview', tr = engine.tracked || null;
    if (!s.tagsOn || !L.cycle || mode === 'inspect') return { want, open: null };
    const trTag = mode === 'follow' ? tagOfCar(tr) : -1;
    if (trTag !== autoClosed?.tag) autoClosed = null;
    let auto = null;
    if (phone) {
      if (L.wait) for (const k of ls.bott) want[k] = true;
      if (trTag >= 0) want[trTag] = true;
    } else if (mode === 'follow') {
      if (trTag >= 0) {
        want[trTag] = true; auto = autoClosed ? null : trTag;
        if (trTag < NS) { if (trTag > 0) want[trTag - 1] = true; if (trTag < NS - 1) want[trTag + 1] = true; }
      }
    } else want.fill(true);
    if (userOpen !== null) want[userOpen] = true;
    return { want, open: userOpen !== null ? userOpen : auto };
  }

  let dirty = true, frameN = 0;
  function refresh() {
    ls = readLine();
    const { want, open } = wanted();
    for (const t of tags) {
      t.want = want[t.i];
      const isOpen = t.want && open === t.i;
      if (!t.want && !t.open) continue; // hidden tags refresh when they come back
      const hd = headOf(t);
      if (hd.html !== t.head) { t.th.innerHTML = hd.html; t.head = hd.html; t.needMeasure = true; }
      if (hd.label !== t.label) { t.label = hd.label; t.el.dataset.label = hd.label; }
      const cls = 'ov-tag' + hd.cls + (isOpen ? ' ov-open' : '') + (t.mode === 'dot' && !isOpen ? ' ov-dot' : '');
      if (cls !== t.cls) { t.el.className = cls; t.cls = cls; t.needMeasure = true; }
      if (isOpen) {
        const body = t.i < NS ? stationBody(t) : endBody(t);
        if (body !== t.body) { t.tb.innerHTML = body; t.body = body; t.needMeasure = true; }
        if (t.tb.hidden) { t.tb.hidden = false; t.needMeasure = true; }
      } else if (t.open) {
        t.tb.hidden = true; t.body = ''; t.working = false; stopAsk(t); t.needMeasure = true;
      }
      t.open = isOpen;
    }
    pillWant = pillCars();
  }

  function setShown(t, on) {
    if (t.shown === on) return;
    t.shown = on; t.el.hidden = !on;
    if (on) { t.lx = NaN; t.needMeasure = true; }
  }
  function setMode(t, mode) {
    if (t.mode === mode) return;
    t.mode = mode;
    t.el.classList.toggle('ov-dot', mode === 'dot');
    t.cls = t.el.className;
  }
  const stats = { writes: 0, refreshes: 0, floats: 0, chips: 0, fails: 0 };
  function write(o, x, y) {
    if (Math.abs(x - o.lx) <= 0.5 && Math.abs(y - o.ly) <= 0.5) return;
    o.lx = x; o.ly = y; stats.writes++;
    o.el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  const anchorOf = t => safe(() => t.i < NS ? engine.anchor('station', t.i) : engine.anchor(t.i === PACK ? 'pack' : 'truck'));
  const project = a => a ? safe(() => engine.project(a[0], a[1], a[2])) : null;

  function positionTags() {
    const order = [];
    for (const t of tags) {
      if (!t.want) { setShown(t, false); continue; }
      const p = project(anchorOf(t));
      if (!p || !p.visible) { setShown(t, false); continue; }
      setShown(t, true); t.px = p.x; t.py = p.y; order.push(t);
    }
    // measure after every class/content write of this frame: one layout at most, and only when content changed
    for (const t of order) if (t.needMeasure) {
      const dot = t.el.classList.contains('ov-dot');
      if (dot) t.el.classList.remove('ov-dot');
      t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; t.needMeasure = false;
      if (dot) t.el.classList.add('ov-dot');
    }
    order.sort((a, b) => (b.open - a.open) || (a.i - b.i)); // the open tag claims its space first; then later tags give way
    const placed = [], topSafe = hudBottom > 0 && hudBottom < H / 3 ? hudBottom + 4 : phone ? 30 : 42;
    for (const t of order) {
      let x, y, mode;
      if (t.open) {
        x = clamp(t.px - t.w / 2, 4, Math.max(4, W - t.w - 4));
        y = clamp(t.py - STEM - t.h, H - t.h - 4 >= topSafe ? topSafe : 4, Math.max(4, H - t.h - 4)); // keep the HUD chips clear when it fits
        mode = 'open';
      } else {
        // 1) row 0 above the anchor, 2) one row up, 3) row 0 slid sideways past the tag in the way (its stem still
        // drops to the anchor), 4) a dot at the anchor
        const xc = clamp(t.px - t.w / 2, 2, Math.max(2, W - t.w - 2));
        const y0 = Math.max(topSafe, t.py - STEM - t.h), y1 = t.py - STEM - t.h - (t.h + ROW_GAP);
        const blocker = (bx, by) => placed.find(q => hit(q, { x0: bx, y0: by, x1: bx + t.w, y1: by + t.h }));
        const cands = [[xc, y0, 'r0']];
        if (y1 >= topSafe) cands.push([xc, y1, 'r1']);
        const q = blocker(xc, y0);
        if (q) for (const sx of [q.x1 + ROW_GAP, q.x0 - t.w - ROW_GAP])
          if (sx >= 2 && sx + t.w <= W - 2 && t.px >= sx + 6 && t.px <= sx + t.w - 6) cands.push([sx, y0, 's0']);
        mode = 'dot';
        for (const [cx, cy, m] of cands) if (!blocker(cx, cy)) { x = cx; y = cy; mode = m; break; }
        if (mode === 'dot') { x = t.px - 5; y = t.py - 5; }
      }
      if (mode !== 'dot') placed.push({ x0: x, y0: y, x1: x + t.w, y1: y + t.h });
      setMode(t, mode);
      const stem = mode === 'r1' ? STEM + t.h + ROW_GAP : STEM;
      if (stem !== t.stem) { t.stem = stem; t.el.style.setProperty('--ov-stem', stem + 'px'); }
      const sx = mode === 'open' || mode === 'dot' ? -1 : Math.round(clamp(t.px - x, 6, t.w - 6));
      if (sx !== t.sx) { t.sx = sx; if (sx < 0 || Math.abs(sx - t.w / 2) < 1) t.el.style.removeProperty('--ov-sx'); else t.el.style.setProperty('--ov-sx', sx + 'px'); }
      write(t, x, y);
    }
  }

  /* ---------- car $ pills ---------- */
  const pills = new Map();
  let pillWant = [];
  function pillCars() {
    const s = app.state, mode = engine.cameraMode || 'overview', tr = engine.tracked || null;
    if (!s.tagsOn || !L.meter || mode === 'inspect') return [];
    const offLine = c => c && !isLost(c) && ['exit', 'lot', 'crane', 'carton', 'truck'].includes(c.place);
    if (phone) return tr && !isLost(tr) && (slotOf(tr) >= 0 || offLine(tr)) ? [tr] : [];
    const cars = ls.units.map(u => u.car).filter(c => c && !isLost(c));
    if (tr && !cars.includes(tr) && offLine(tr)) cars.push(tr);
    return cars;
  }
  function positionPills() {
    const want = new Set(pillWant), tr = engine.tracked || null;
    for (const [car, p] of pills) if (!want.has(car)) { p.el.remove(); pills.delete(car); }
    for (const car of want) {
      let p = pills.get(car);
      if (!p) { p = { el: mk('div', 'ov-a ov-pa'), i: mk('i', 'ov-pill'), key: '', lx: NaN, ly: NaN, shown: true }; p.el.appendChild(p.i); pillLayer.appendChild(p.el); pills.set(car, p); }
      const n = car.tab?.lines?.length || 0, key = n + '|' + (car === tr) + '|' + rVer + '|' + (car.tab?.total ?? 0);
      if (key !== p.key) { p.key = key; p.i.textContent = $(visTotal(car)); p.i.classList.toggle('ov-me', car === tr); }
      const pr = project(safe(() => engine.anchor('car', car)));
      const vis = !!pr?.visible;
      if (vis !== p.shown) { p.el.hidden = !vis; p.shown = vis; if (vis) p.lx = NaN; }
      if (vis) write(p, pr.x, pr.y);
    }
  }

  /* ---------- floats, invoice chips, QC FAIL ---------- */
  const fx = [];
  function spawn(kind, text, where, life) {
    const el = mk('div', 'ov-a ' + kind), i = mk('i'); i.textContent = text; el.appendChild(i); fxLayer.appendChild(el);
    const f = { el, kind, where, born: now(), life, lx: NaN, ly: NaN, shown: true };
    fx.push(f); placeFx(f); return f;
  }
  function clearFx(kind) { for (let j = fx.length - 1; j >= 0; j--) if (!kind || fx[j].kind === kind) { fx[j].el.remove(); fx.splice(j, 1); } }
  function placeFx(f) {
    let p = null;
    if (f.where.tag) { const t = f.where.tag; if (t.shown && Number.isFinite(t.lx)) p = { x: t.lx + (t.mode === 'dot' ? 5 : t.w / 2), y: t.ly - 2, visible: true }; }
    else p = project(safe(f.where.world) || safe(f.where.fallback));
    const vis = !!p?.visible;
    if (vis !== f.shown) { f.shown = vis; f.el.hidden = !vis; }
    if (vis) write(f, p.x, p.y);
  }
  function positionFx() {
    const t = now();
    for (let j = fx.length - 1; j >= 0; j--) { const f = fx[j]; if (t - f.born > f.life) { f.el.remove(); fx.splice(j, 1); } else placeFx(f); }
  }
  const cap = (kind, max) => { const list = fx.filter(f => f.kind === kind); while (list.length >= max) { const f = list.shift(); f.el.remove(); fx.splice(fx.indexOf(f), 1); } };

  function onStationDone(d) {
    if (!d) return;
    doneThisCycle.add(d.station); dirty = true;
    if (rm || (engine.speed ?? 1) >= 4 || !app.state.tagsOn || !L.meter || engine.cameraMode === 'inspect') return;
    const k = d.station, t = tags[k];
    if (!t || !t.want || !t.shown) return;              // phone: only from the tags that show
    if (t.floated === cycleNo) return;                  // at most one per station per cycle
    t.floated = cycleNo;
    const v = d.post ?? costOf(d.car)?.stationPost?.[k];
    if (!(v >= 0)) return;
    cap('ov-float', NS); stats.floats++;
    spawn('ov-float', plus(v), { tag: t }, FLOAT_MS);
  }
  function onShipped(d) {
    dirty = true;
    if (!app.state.tagsOn || !L.scrap) return;
    const R = app.state.R, inv = d?.invoice ?? price();
    cap('ov-chip', phone ? 1 : 3); stats.chips++;
    spawn('ov-chip', `Invoice ${$(inv)} · ${termsText(R)}`, { world: () => engine.anchor('truck') }, CHIP_MS);
  }
  function onScrapped(d) {
    if (d?.wo) lostBy.set(d.wo, d.lost ?? d.car?.tab?.total ?? 0);
    dirty = true; cardKey = '';
    if (!app.state.tagsOn || !L.cycle || !d?.car) return;
    cap('ov-fail', 3); stats.fails++;
    spawn('ov-fail', 'QC FAIL', { world: () => engine.anchor('car', d.car), fallback: () => engine.anchor('scrap') }, FAIL_MS);
  }

  /* ---------- the running tab: receipt in #card, phone line + sheet ---------- */
  let cardKey = '', sheetOpen = false, lastWo = null, lastCar = null, lastCount = 0, flashFrom = Infinity, allParts = false;
  // One line per station (SPEC §4.4). `all` adds every station's parts under its line; otherwise only the station
  // that posted last (while the car is on the line) shows what it added.
  function receiptHTML(car, { all = false, toggle = false } = {}) {
    const R = app.state.R, c = costOf(car), lines = car.tab?.lines || [], lost = isLost(car);
    let h = `<div class="ov-rc${lost ? ' ov-lost' : ''}">`;
    h += `<div class="ov-rc-top"><span>${L.materials ? 'RUNNING TAB' : 'WORK ORDER'}</span><span>${esc(car.wo || '')}</span></div>`;
    h += `<div class="ov-rc-nm">${esc(carName(car.cfg))}</div>`;
    h += `<div class="ov-rc-st">${esc(lost ? 'Failed the final check · in the scrap crate' : car.status || PLACE_WHERE[car.place] || '')}</div>`;
    if (!L.materials) return h + '</div>';
    if (car.stock) h += '<div class="ov-rc-note">Parked before you arrived: its stations were costed in advance.</div>';
    else if (car.broughtForward > 0) h += '<div class="ov-rc-note">Earlier stations were brought forward by Fill line.</div>';
    if (!lines.length) {
      h += '<div class="ov-rule"></div><div class="ov-rc-note">Not on the line yet.</div>';
      if (c) h += L.meter ? row('Started cost when made', '', $(c.started)) : row('Materials it will use', '', $(c.materials));
      return h + '</div>';
    }
    const byStation = Array.from({ length: NS }, () => []), exitL = [], afterL = [];
    lines.forEach((l, idx) => {
      const x = { l, idx };
      if (l.kind === 'qc' || l.kind === 'power') exitL.push(x);
      else if (l.kind === 'scrap' || l.kind === 'carton' || l.kind === 'freight') afterL.push(x);
      else if (l.station >= 0 && l.station < NS) byStation[l.station].push(x);
      else exitL.push(x);
    });
    const sumOf = xs => xs.reduce((a, x) => a + x.l.value, 0);
    const lab = l => KIND_SHORT[l.kind] || l.label;
    const isNew = xs => !rm && xs.some(x => x.idx >= flashFrom);
    const items = xs => xs.map(x => `<span>${esc(lab(x.l))} ${$(x.l.value)}</span>`).join(' · ');
    const onLine = car.place === 'line' || car.place === 'exit';
    let last = -1, lastIdx = -1;
    byStation.forEach((g, k) => g.forEach(x => { if (x.idx > lastIdx) { lastIdx = x.idx; last = k; } }));
    if (exitL.some(x => x.idx > lastIdx) || !onLine) last = -1;
    h += '<div class="ov-rule"></div>';
    for (let k = 0; k < NS; k++) {
      const g = byStation[k]; if (!g.length) continue;
      const v = g.filter(x => visible(x.l));
      h += `<div class="ov-rs${isNew(v) ? ' ov-new' : ''}">` + row(`${pad2(k + 1)} ${STATIONS[k]}`, '', v.length ? $(sumOf(v)) : '–');
      if (all || k === last) h += `<div class="ov-rc-sub">${v.length ? items(v) : 'no parts here'}</div>`;
      h += '</div>';
    }
    if (toggle && byStation.some(g => g.length)) h += `<button type="button" class="ov-more" data-act="parts" aria-pressed="${all}">${all ? 'Hide the parts' : 'Show every part'}</button>`;
    const ex = exitL.filter(x => visible(x.l));
    if (ex.length) h += `<div class="ov-rule"></div><div class="ov-rs${isNew(ex) ? ' ov-new' : ''}">` + row('Line exit', '', $(sumOf(ex))) +
      `<div class="ov-rc-sub">${items(ex)}</div></div>`;
    const af = afterL.filter(x => visible(x.l));
    if (af.length) { h += '<div class="ov-rule"></div>'; for (const x of af) h += `<div class="ov-rs${isNew([x]) ? ' ov-new' : ''}">` + row(esc(lab(x.l)), '', $(x.l.value)) + '</div>'; }
    h += '<div class="ov-rule"></div>';
    const tot = lines.filter(visible).reduce((a, l) => a + l.value, 0);
    if (lost) {
      h += L.scrap ? `<div class="ov-rc-lost">Scrapped · ${$(lostOf(car))} lost · covered by the scrap allowance every good car carries</div>`
        : `<div class="ov-rc-lost">Failed the final check · ${$(tot)} spent</div>`;
    } else {
      const lbl = car.place === 'line' || car.place === 'exit' ? 'Tab so far' : car.place === 'truck' && L.scrap ? 'To the door' : 'Tab';
      h += row(lbl, '', $(tot), 'ov-rc-tot');
    }
    if (L.volume && !lost && c) h += `<div class="ov-rule"></div><div class="ov-rc-foot">${footer(c)}</div>`;
    return h + '</div>';
  }
  function footer(c) {
    const mo = safe(() => econ.month(c.cfg, app.state.R, c.up || app.state.up, { price: price() }));
    if (!mo) return '';
    if (!(mo.sold > 0)) return `At ${$(mo.price)} the shops order no cars, so no car shares the ${fmt.money(mo.F)} of fixed bills.`;
    const pr = mo.perCar.profit, early = Math.abs(mo.netPrice - mo.price) > 1e-9;
    return `Fixed share at ${fmt.count(mo.sold)}/mo <b>${$(mo.perCar.fixedPerCar)}</b> → full <b>${$(mo.perCar.fullCost)}</b> · ` +
      `price <b>${$(early ? mo.netPrice : mo.price)}</b>${early ? ' after early pay' : ''} → ${pr < 0 ? 'loss' : 'profit'} <b class="${pr < 0 ? 'ov-loss' : 'ov-gain'}">${$(Math.abs(pr))}</b>`;
  }
  function phoneLine(car) {
    const parts = [car.wo];
    if (L.materials) parts.push(isLost(car) ? `${$(lostOf(car))} lost` : `${$(visTotal(car))} so far`);
    const k = slotOf(car);
    parts.push(k >= 0 && k < NS ? `at ${STATIONS[k]}` : k >= NS ? 'at QC' : (PLACE_WHERE[car.place] || car.place || ''));
    return parts.filter(Boolean).join(' · ');
  }
  function renderCard() {
    if (!card) return;
    const tr = engine.tracked || null, mode = engine.cameraMode || 'overview';
    if (!tr || mode === 'overview') {
      if (!card.hidden) card.hidden = true;
      if (sheetOpen) closeSheet();
      cardKey = ''; return;
    }
    // the order preview is rebuilt as a new car under the same work order number (a new model, a mode's own order),
    // and nothing else in the key changes then: a new car object always redraws, or the card keeps the old car's name
    if (tr !== lastCar) { lastCar = tr; cardKey = ''; }
    const n = tr.tab?.lines?.length || 0;
    const key = [tr.wo, n, tr.tab?.total, tr.place, tr.status, isLost(tr), rVer, phone, sheetOpen, slotOf(tr), tr.broughtForward, allParts].join('|');
    if (key === cardKey) return;
    cardKey = key;
    if (tr.wo !== lastWo) { lastWo = tr.wo; lastCount = n; flashFrom = Infinity; }
    else if (n > lastCount) { flashFrom = lastCount; lastCount = n; }
    else flashFrom = Infinity;
    card.hidden = false;
    card.classList.toggle('ov-ph', phone);
    card.classList.toggle('ov-lostc', isLost(tr) && L.cycle);
    if (phone) {
      lineTxt.textContent = phoneLine(tr);
      lineBtn.setAttribute('aria-expanded', String(sheetOpen));
      rcWrap.replaceChildren();
      if (sheetOpen) { sheetBody.innerHTML = receiptHTML(tr, { all: true }); sheetTitle.textContent = 'Running tab · ' + (tr.wo || ''); }
    } else {
      const refocus = rcWrap.contains(doc.activeElement) && doc.activeElement.dataset.act === 'parts';
      rcWrap.innerHTML = receiptHTML(tr, { all: allParts, toggle: true });
      if (refocus) rcWrap.querySelector('[data-act="parts"]')?.focus({ preventScroll: true });
    }
  }
  let sheetTimer = 0, sheetReturn = null;
  function openSheet() {
    const tr = engine.tracked; if (!tr || sheetOpen) return;
    sheetOpen = true; clearTimeout(sheetTimer);
    sheetReturn = doc.activeElement;
    scrim.hidden = false; sheet.hidden = false;
    sheetBody.innerHTML = receiptHTML(tr, { all: true }); sheetTitle.textContent = 'Running tab · ' + (tr.wo || ''); cardKey = '';
    lineBtn.setAttribute('aria-expanded', 'true');
    if (rm) { sheet.classList.add('ov-on'); scrim.classList.add('ov-on'); }
    else requestAnimationFrame(() => requestAnimationFrame(() => { if (sheetOpen) { sheet.classList.add('ov-on'); scrim.classList.add('ov-on'); } }));
    sheetClose.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false; cardKey = '';
    sheet.classList.remove('ov-on'); scrim.classList.remove('ov-on');
    lineBtn?.setAttribute('aria-expanded', 'false');
    const done = () => { if (!sheetOpen) { sheet.hidden = true; scrim.hidden = true; sheetBody.replaceChildren(); } };
    if (rm) done(); else sheetTimer = setTimeout(done, 280);
    if (sheet.contains(doc.activeElement)) (sheetReturn && sheetReturn.isConnected && !card.hidden ? sheetReturn : lineBtn)?.focus?.({ preventScroll: true });
    sheetReturn = null;
  }

  /* ---------- input ---------- */
  const onTagClick = e => {
    const el = e.target.closest('.ov-tag'); if (!el) return;
    const t = tags[+el.dataset.i]; if (!t) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'work') { t.working = !t.working; t.body = ''; refresh(); return; }
    if (act === 'why') { askWhy(t); return; }
    if (t.open) {
      if (!e.target.closest('.ov-th')) return;           // clicks inside the open sheet do nothing
      if (userOpen === t.i) userOpen = null; else autoClosed = { tag: t.i };
    } else { userOpen = t.i; autoClosed = null; }
    // a tag tap counts as tapping that station (tap-a-station checks listen on the engine's 'stationTap')
    if (!t.open && t.i < NS) app.emit('stationTap', { station: t.i, source: 'tag' }); // CONTRACT-GAP: the engine has no public emit
    refresh();
  };
  tagLayer.addEventListener('click', onTagClick);
  const onLine = () => (sheetOpen ? closeSheet() : openSheet());
  lineBtn?.addEventListener('click', onLine);
  const onSheetClick = e => { if (e.target.closest('[data-act="close"]')) closeSheet(); };
  const onCardClick = e => { if (e.target.closest('[data-act="parts"]')) { allParts = !allParts; cardKey = ''; renderCard(); } };
  rcWrap?.addEventListener('click', onCardClick);
  sheet.addEventListener('click', onSheetClick);
  scrim.addEventListener('click', closeSheet);
  const onKey = e => {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      if (sheetOpen) { closeSheet(); e.preventDefault(); return; }
      const open = tags.find(t => t.open);
      if (open && !e.target.closest?.('input, textarea, select, [contenteditable]')) { if (userOpen === open.i) userOpen = null; else autoClosed = { tag: open.i }; refresh(); }
    } else if (e.key === 'Tab' && sheetOpen && sheet.contains(doc.activeElement)) {
      const f = [...sheet.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled);
      if (f.length) { const i = f.indexOf(doc.activeElement), n = f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length]; n.focus(); e.preventDefault(); }
    }
  };
  doc.addEventListener('keydown', onKey);
  offs.push(() => {
    tagLayer.removeEventListener('click', onTagClick); lineBtn?.removeEventListener('click', onLine);
    sheet.removeEventListener('click', onSheetClick); rcWrap?.removeEventListener('click', onCardClick); scrim.removeEventListener('click', closeSheet); doc.removeEventListener('keydown', onKey);
  });

  /* ---------- events ---------- */
  const on = (type, fn) => { const off = safe(() => engine.on(type, d => { if (alive) fn(d); })); if (typeof off === 'function') offs.push(off); };
  const mark = () => { dirty = true; };
  on('cycle', d => { if (d?.phase === 'work') cycleNo++; if (d?.phase === 'move') doneThisCycle.clear(); dirty = true; });
  for (const ev of ['enter', 'exit', 'qc', 'parked', 'scrapShare', 'packed', 'lineIdle', 'optionChanged', 'followed', 'sent']) on(ev, mark);
  on('stationDone', onStationDone);
  on('scrapped', onScrapped);
  on('shipped', onShipped);
  on('stationTap', d => { if (engine.cameraMode === 'inspect' || !(d?.station >= 0 && d.station < NS)) return; userOpen = d.station; autoClosed = null; dirty = true; });
  let lastMode = engine.cameraMode, lastTracked = engine.tracked;
  on('frame', () => {
    frameN++;
    const mode = engine.cameraMode, tr = engine.tracked;
    if (mode !== lastMode) { lastMode = mode; userOpen = null; autoClosed = null; dirty = true; }
    if (tr !== lastTracked) { lastTracked = tr; dirty = true; }
    if (dirty || frameN % 12 === 0) { dirty = false; stats.refreshes++; refresh(); }
    positionTags();
    positionPills();
    positionFx();
    renderCard();
  });
  offs.push(app.on('change', ({ keys }) => {
    if (!keys.some(k => ['layers', 'moneyOn', 'tagsOn', 'R', 'up', 'price', 'mode', 'lesson'].includes(k))) return;
    if (keys.includes('lesson') || keys.includes('mode')) { userOpen = null; autoClosed = null; }
    L = effectiveLayers(app.state); rVer++; cardKey = '';
    if (keys.includes('R') || keys.includes('up')) costCache.clear();
    for (const t of tags) t.body = '';
    if (!app.state.tagsOn) clearFx();
    if (!L.meter) clearFx('ov-float');
    dirty = true;
  }));
  const offTutor = safe(() => tu.onChange?.(() => { if (!alive) return; for (const t of tags) t.body = ''; dirty = true; }));
  if (typeof offTutor === 'function') offs.push(offTutor);

  /* ---------- api ---------- */
  return {
    stats,
    // a plain snapshot for scripted checks
    debug: () => ({
      tags: tags.map(t => ({ i: t.i, label: t.label, want: t.want, shown: t.shown, open: t.open, mode: t.mode, cls: t.el.className, x: t.lx, y: t.ly, w: t.w, h: t.h })),
      pills: [...pills.entries()].map(([car, p]) => ({ wo: car.wo, text: p.i.textContent, shown: p.shown })),
      fx: fx.map(f => ({ kind: f.kind, text: f.el.textContent })),
      card: card ? { hidden: card.hidden, phone: card.classList.contains('ov-ph'), text: phone ? lineTxt.textContent : rcWrap.textContent } : null,
      sheetOpen
    }),
    destroy() {
      if (!alive) return;
      alive = false;
      for (const off of offs.splice(0)) safe(off);
      for (const t of tags) stopAsk(t);
      clearFx(); clearTimeout(sheetTimer);
      pillLayer.remove(); tagLayer.remove(); fxLayer.remove();
      if (ownHost) host.remove();
      scrim.remove(); sheet.remove();
      if (ownStyle) style.remove();
      if (card && cardOrig) {
        card.replaceChildren(...cardOrig.kids);
        card.className = cardOrig.cls; card.hidden = cardOrig.hidden;
        if (cardOrig.role === null) card.removeAttribute('role'); else card.setAttribute('role', cardOrig.role);
        if (cardOrig.label === null) card.removeAttribute('aria-label'); else card.setAttribute('aria-label', cardOrig.label);
      }
    }
  };
}
