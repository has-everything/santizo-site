// Toyline Ledger tutor: "Ask the accountant" (SPEC §4.9) on the optional `sample` capability. Every call is made on a
// click, is memoryless, and sends the instruction + a DATA snapshot built from econ.js + the learner's question. When
// the view can run page tools, `what_if` and `explain_line` let Claude get new numbers from econ.js instead of doing
// its own arithmetic. Without `sample` every entry point stays hidden (callers listen to onChange) and the course
// keeps its local hints, so nothing here is required for the page to work.
import * as econ from './econ.js';
import { app } from './app.js';
import { platform } from './platform.js';

export const INSTRUCTION = 'You are the accountant at Toyline, a small wooden toy-car factory, helping a beginner learn costing. Use only numbers in DATA or returned by the tools; for any new arithmetic call what_if or explain_line instead of calculating yourself. Write plain language a 14-year-old can follow, at most 90 words (120 for a statement), with at most one formula line using the learner\'s numbers. If the learner gave an answer, name the specific step that went wrong. If reveal is false, do not state the final answer; point to the line or step to check. Never invent prices, rates or policies. No headings or lists.';
const NO_TOOLS_NOTE = 'No tools are available in this view; every number you need is in DATA.';
const KINDS = new Set(['why', 'explain', 'statement', 'free']);
const QUICK = new Set(['why', 'explain']);                       // hints and Explain: quick tier; free text, statements: default
const DEAD = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);
const PAGE_BUG = new Set(['invalid_request', 'prompt_too_large', 'transform_error', 'queue_overflow', 'images_unavailable', 'image_rejected', 'invalid_json']);
export const MAX_DATA = 6000;                                    // DATA JSON budget, characters (SPEC: about 6 KB)
const DEFAULT_Q = {
  why: 'Why is my answer wrong? Point me to the step to check.',
  explain: 'Explain this line in plain words.',
  statement: 'Why is my bank down when I made a profit?',
  free: 'Explain where the money goes for this car.'
};
export const COPY = Object.freeze({
  who: 'The accountant',
  thinking: 'Thinking...',
  stop: 'Stop',
  busy: "The accountant is busy; here's a hint:",
  busyNoHint: 'The accountant is busy. Try again in a minute.',
  interrupted: 'The answer was interrupted.',
  noAnswer: "The accountant couldn't answer just now.",
  retry: 'Try again',
  cut: 'The answer was cut short.',
  session: 'Sign in to Claude again to ask the accountant.',
  empty: 'The accountant had nothing to add. Try asking another way.',
  bug: "The accountant couldn't take this question.",
  hint: 'Hint'
});

/* ---------- helpers ---------- */
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isNum = x => typeof x === 'number' && Number.isFinite(x);
const jclone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const stripTags = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const r2 = x => isNum(x) ? econ.r2(x) : null;
const r1 = x => isNum(x) ? econ.r1(x) : null;
const cnt = x => isNum(x) ? Math.round(x * 10) / 10 : null;
const strOrNull = x => typeof x === 'string' && x.trim() ? stripTags(x) : null;
function okCfg(c) {
  if (!isObj(c)) return null;
  try { econ.carCost(c); return { ...econ.DEFAULT_CAR, ...c }; } catch { return null; }
}

/* ---------- availability ---------- */
let dead = false, lastAvail = false, toolsOff = false, limitsP = null;
const subs = new Set();
const available = () => !dead && typeof platform.caps.sample === 'function';
function notify() {
  const a = available();
  if (a === lastAvail) return;
  lastAvail = a;
  for (const fn of [...subs]) { try { fn(a); } catch (e) { console.error(e); } }
}
if (typeof platform.onChange === 'function') platform.onChange(({ what }) => { if (what === 'sample' || what === 'ready') notify(); });
platform.ready.then(notify);
function markDead() { if (!dead) { dead = true; notify(); } }
function limits(sample) {
  if (!limitsP) limitsP = Promise.resolve().then(() => typeof sample.limits === 'function' ? sample.limits() : null).catch(() => null);
  return limitsP;
}

/* ---------- live calls: abort when the learner leaves the lesson ---------- */
const active = new Set();
app.on('change', ({ keys, state }) => {
  if (!keys.includes('lesson') && !keys.includes('mode')) return;
  for (const j of [...active]) if (j.lesson !== state.lesson || j.mode !== state.mode) j.ctl?.abort();
});

/* ---------- the model context behind a DATA snapshot ---------- */
const ctxOf = new WeakMap();                                      // DATA object -> { cfg, R, up, price, ... } for the tools
function baseOf(opts = {}) {
  const s = app.state;
  const c = (isObj(opts.ctx) && opts.ctx) || (isObj(opts.data) && ctxOf.get(opts.data)) || {};
  const R = (isObj(c.R) && c.R) || s.R || econ.R0;
  const up = { ...econ.NO_UPGRADES, ...((isObj(c.up) && c.up) || s.up || {}) };
  const cfg = okCfg(c.cfg) || okCfg(c.car && c.car.cfg) || okCfg(opts.data && opts.data.car && opts.data.car.config)
    || okCfg(s.scenario && s.scenario.cfg) || { ...econ.DEFAULT_CAR };
  const sc = isObj(s.scenario) ? s.scenario : {};
  const price = [c.price, c.month && c.month.price, opts.data && opts.data.month && opts.data.month.price, s.price, R.price].find(isNum);
  const open = [c.open, sc.open, R.openingCash].find(isNum) ?? 0;
  const months = [c.months, sc.months, R.months].find(isNum) ?? 1;
  const sold = isNum(c.sold) ? c.sold : undefined;
  return { cfg, R, up, price, open, months, sold, lesson: isObj(c.lesson) ? c.lesson : null, step: c.step };
}
const describe = cfg => {
  const C = econ.CATALOG;
  const num = cfg.number !== undefined && cfg.number !== null && String(cfg.number).trim() !== '' ? `No. ${String(cfg.number).trim()}` : 'no race number';
  const roof = econ.roofOk(cfg.body, cfg.roof) ? cfg.roof : 'none';
  return [C.body[cfg.body].label, C.finish[cfg.finish].label, C.livery[cfg.livery].label + ' livery', num, C.wheels[cfg.wheels].label + ' wheels',
    C.bumper[cfg.bumper].label + ' bumpers', roof === 'none' ? 'no roof extra' : C.roof[roof].label].join(', ');
};
// one cost line for DATA: money lines carry no unit (dollars), plain catalogue prices carry no formula (saves bytes)
const lineOut = l => ({
  id: l.id, label: l.label, value: l.unit === '%' ? r1(l.value) : l.unit === 'cars' ? (isNum(l.value) ? l.value : null) : r2(l.value),
  ...(l.unit !== '$' ? { unit: l.unit } : {}), ...(l.how && l.how !== 'catalogue price' ? { formula: l.how } : {})
});

// The DATA object of SPEC §4.9: lesson, step, question, learnerAnswer, attempts, diagnosis, reveal, car, month, cash, rules.
function build(b) {
  const { cfg, R, up, price } = b;
  const L = econ.costLines(cfg, R, up, { price, sold: b.sold });
  const mo = L.month, k = mo.car;
  const lesson = b.lesson ? { id: b.lesson.id ?? null, title: strOrNull(b.lesson.title), goal: strOrNull(b.lesson.goal), concept: strOrNull(b.lesson.rule) } : null;
  let cash = null;
  try {
    const c = econ.cashCalendar(cfg, R, up, { price, months: Math.max(1, Math.round(b.months)), open: b.open, sold: b.sold });
    cash = {
      opening: r2(c.open), months: c.months,
      terms: R.shopTerms === 'early' ? 'shops take 2% off and pay 7 working days after delivery' : 'shops pay 21 working days (30 days) after delivery',
      supplierCredit: !!R.supplierCredit,
      low: r2(c.low), lowDay: c.lowAt ? `month ${c.lowAt.month} day ${c.lowAt.day}` : null,
      outOfCash: c.firstNeg ? `month ${c.firstNeg.month} day ${c.firstNeg.day}` : null,
      endOfMonth: c.eom.map(r2)
    };
  } catch { cash = null; }
  const crewStations = econ.stationCrew(up).reduce((a, x) => a + x, 0);
  const upgrades = Object.entries(up).filter(([, v]) => v !== false && v !== null && v !== undefined)
    .map(([id, v]) => id === 'helper' ? `${econ.UPGRADES.helper.label}: ${econ.STATIONS[v]}` : econ.UPGRADES[id].label);
  const data = {
    lesson,
    step: strOrNull(b.step),
    question: null,
    learnerAnswer: null,
    attempts: 0,
    diagnosis: null,
    reveal: !lesson,
    car: {
      config: { body: cfg.body, finish: cfg.finish, livery: cfg.livery, number: cfg.number ?? '', wheels: cfg.wheels, bumper: cfg.bumper, roof: cfg.roof },
      described: describe(cfg),
      stationMinutes: Object.fromEntries(econ.STATIONS.map((n, i) => [n, r1(k.m[i])])),
      bottleneck: k.bottAll.map(i => econ.STATIONS[i]).join(' & '),
      cycle: r1(k.cycle), workMinutes: r1(k.work), lineBalancePct: r1(k.balance * 100),
      lines: L.lines.filter(l => ['materials', 'labour', 'line', 'car'].includes(l.section)).map(lineOut)
    },
    month: {
      price: r2(mo.price), ...(mo.netPrice !== mo.price ? { priceAfterDiscount: r2(mo.netPrice) } : {}),
      demand: cnt(mo.Q), sold: cnt(mo.sold), capacity: cnt(mo.capGood), lostSales: cnt(mo.lostSales),
      started: cnt(mo.startedN), lineMinutes: r1(mo.lineMin), utilisationPct: r1(mo.util * 100), taktMin: r2(mo.takt),
      lines: L.lines.filter(l => l.section === 'month' || l.section === 'pl').map(lineOut)
    },
    cash,
    rules: {
      wageHourly: R.wageHourly, onCostRate: R.onCostRate, labourHourly: R.labourHourly, labourPerMin: R.labourPerMin,
      crew: k.crew, crewStations, crewQcPack: R.crewQcPack, powerPerLineMin: R.powerPerLineMin, lineRatePerMin: r2(k.lineRate),
      moveMin: R.moveMin, consumables: { ...R.consumables }, scrapEvery: R.scrapEvery, carton: R.carton, freight: R.freight,
      fixed: { ...R.fixed }, fixedTotal: econ.fixedTotal(R, up),
      demand: `cars a month = max(0, ${R.demandIntercept} - ${R.demandSlope} x price)`,
      shiftMin: R.shiftMin, daysPerMonth: R.daysPerMonth, availableLineMin: R.available,
      ...(R.birchFactor !== 1 ? { birchFactor: R.birchFactor } : {}),
      ...(upgrades.length ? { upgrades } : {})
    }
  };
  return data;
}

// Keep DATA under the budget: drop the least useful detail first.
const enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
const bytes = s => enc ? enc.encode(s).length : s.length;
function fit(d) {
  const size = () => bytes(JSON.stringify(d));
  if (size() <= MAX_DATA) return d;
  const lines = o => (o && Array.isArray(o.lines) ? o.lines : []);
  const steps = [
    () => lines(d.car).forEach(l => { if (/^mat\./.test(l.id)) delete l.formula; }),
    () => { if (isObj(d.cash)) delete d.cash.endOfMonth; },
    () => { if (isObj(d.rules)) { delete d.rules.fixed; delete d.rules.consumables; } },
    () => lines(d.month).forEach(l => { if (/^pl\./.test(l.id)) delete l.formula; }),
    () => lines(d.car).forEach(l => delete l.formula),
    () => lines(d.month).forEach(l => delete l.formula),
    () => { if (isObj(d.car) && Array.isArray(d.car.lines)) d.car.lines = d.car.lines.filter(l => !/^mat\./.test(l.id)); },
    () => { delete d.rules; },
    () => { if (isObj(d.month)) delete d.month.lines; },
    () => { for (const key of Object.keys(d)) if (typeof d[key] === 'string' && d[key].length > 300) d[key] = d[key].slice(0, 300); }
  ];
  for (const s of steps) { s(); if (size() <= MAX_DATA) return d; }
  const car = isObj(d.car) ? d.car : {};
  const core = { lesson: d.lesson, question: d.question, learnerAnswer: d.learnerAnswer, attempts: d.attempts, diagnosis: d.diagnosis, reveal: d.reveal, kind: d.kind,
    car: { described: car.described, bottleneck: car.bottleneck, cycle: car.cycle } };
  return bytes(JSON.stringify(core)) <= MAX_DATA ? core : { reveal: d.reveal, kind: d.kind, note: 'DATA was too large to send.' };
}

function buildData(opts, base, kind) {
  let given = {}, d;
  try { if (isObj(opts.data)) given = jclone(opts.data); }
  catch (e) { console.warn('[toyline] tutor: data is not plain JSON (a cycle?); sending the snapshot only', e); }
  try { d = given.car ? given : { ...build(base), ...given }; }
  catch (e) { console.warn('[toyline] tutor: could not build DATA', e); d = given; }
  if (typeof opts.reveal === 'boolean') d.reveal = opts.reveal;
  else if (typeof d.reveal !== 'boolean') d.reveal = !(app.state.mode === 'course' && app.state.lesson);
  if (opts.line) { try { d.line = lineInfo(String(opts.line), base); } catch { } }
  d.kind = kind;
  return fit(d);
}
function questionOf(opts, kind) {
  const q = typeof opts.question === 'string' ? opts.question : isObj(opts.question) ? opts.question.text : '';
  return (stripTags(q) || DEFAULT_Q[kind]).slice(0, kind === 'free' ? 200 : 400);
}
function buildInput(kind, data, question, useTools) {
  return [INSTRUCTION, ...(useTools ? [] : [NO_TOOLS_NOTE]), '', 'DATA:', JSON.stringify(data), '', `Question type: ${kind}.`, `Learner's question: ${question}`].join('\n');
}

/* ---------- tools backed by econ.js ---------- */
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIAS = {
  finish: { oiled: 'raw', oil: 'raw', lacquer: 'gloss', satincoat: 'satin' },
  roof: { lightbar: 'beacon', surfboard: 'surf', rack: 'rack' },
  livery: { stripe: 'stripe', checker: 'checker', gt: 'gt' },
  wheels: { wooden: 'wood', allwood: 'wood' },
  bumper: { dowel: 'wood', wooden: 'wood', chromebumpers: 'chrome' },
  body: {}
};
function optionKey(key, v) {
  const table = econ.CATALOG[key], n = norm(v);
  for (const [k, o] of Object.entries(table)) if (norm(k) === n || norm(o.label) === n) return k;
  if (ALIAS[key] && ALIAS[key][n]) return ALIAS[key][n];
  throw new Error(`Unknown ${key} "${v}". Choose one of: ${Object.entries(table).map(([k, o]) => `${k} (${o.label})`).join(', ')}.`);
}
const optLabel = (key, k) => econ.CATALOG[key][k] ? econ.CATALOG[key][k].label : String(k);
function stationIndex(v) {
  if (v === null || v === undefined || v === false || v === '' || norm(v) === 'none') return null;
  if (isNum(v) || /^\d+$/.test(String(v))) { const i = Number(v); if (i >= 0 && i <= 6 && Number.isInteger(i)) return i; }
  const i = econ.STATIONS.findIndex(s => norm(s) === norm(v));
  if (i >= 0) return i;
  throw new Error(`Unknown station "${v}". Use 0-6 or one of: ${econ.STATIONS.join(', ')}.`);
}

// what_if({changes}): the current car and plan with some changes, recomputed by econ.js. Throws on an invalid option.
export function whatIf(base, input) {
  const ch = isObj(input) && isObj(input.changes) ? input.changes : isObj(input) ? input : {};
  const cfg = { ...base.cfg }, up = { ...base.up };
  let R = base.R, price = base.price;
  const changed = [];
  for (const key of ['body', 'finish', 'livery', 'wheels', 'bumper', 'roof']) {
    if (ch[key] === undefined || ch[key] === null) continue;
    const v = optionKey(key, ch[key]);
    if (v !== cfg[key]) changed.push(`${key}: ${optLabel(key, cfg[key])} -> ${optLabel(key, v)}`);
    cfg[key] = v;
  }
  if (Object.prototype.hasOwnProperty.call(ch, 'number')) {
    const n = ch.number === null || ch.number === false ? '' : String(ch.number).trim();
    if (n && !/^\d{1,2}$/.test(n)) throw new Error('number must be 0-99, or "" for no race number.');
    if (n !== String(cfg.number ?? '')) changed.push(`race number: ${cfg.number || 'none'} -> ${n || 'none'}`);
    cfg.number = n;
  }
  if (!econ.roofOk(cfg.body, cfg.roof)) {
    if (ch.roof !== undefined && ch.roof !== null) throw new Error('The Racer takes only the None or Spoiler roof.');
    cfg.roof = 'none';
  }
  if (ch.price !== undefined && ch.price !== null) {
    const p = Number(ch.price);
    if (!Number.isFinite(p) || p <= 0 || p > 1000) throw new Error('price must be a positive number of dollars.');
    if (p !== price) changed.push(`price: ${econ.fmt.money2(price)} -> ${econ.fmt.money2(p)}`);
    price = p;
  }
  if (isObj(ch.upgrades)) {
    const u = ch.upgrades;
    if (u.lamp !== undefined) up.lamp = !!u.lamp;
    if (u.autofeed !== undefined) up.autofeed = !!u.autofeed;
    if (u.helper !== undefined) up.helper = stationIndex(u.helper);
    changed.push('upgrades: ' + JSON.stringify({ lamp: up.lamp, helper: up.helper === null ? null : econ.STATIONS[up.helper], autofeed: up.autofeed }));
  }
  if (up.autofeed && up.helper === 0) throw new Error('No extra operator at Blank when the hopper auto-feed is on.');
  const over = {};
  if (ch.shopTerms !== undefined && ch.shopTerms !== null) {
    const t = norm(ch.shopTerms);
    over.shopTerms = /early|2|discount|10/.test(t) ? 'early' : /net|30/.test(t) ? 'net30' : null;
    if (!over.shopTerms) throw new Error('shopTerms must be "net30" or "early".');
  }
  if (ch.supplierCredit !== undefined && ch.supplierCredit !== null) over.supplierCredit = !!ch.supplierCredit;
  if (Object.keys(over).length) { R = econ.rules({ ...R, ...over }); changed.push('plan: ' + JSON.stringify(over)); }
  const months = Math.max(3, Math.round(base.months) || 0);
  const s = econ.summary(cfg, R, up, { price, open: base.open, months });
  return {
    changed, cycle: s.cycle, bottleneck: s.bottleneck, materials: s.materials, started: s.started, variable: s.variable,
    price: s.price, contribution: s.contribution, sold: s.sold, capacity: s.capacity, lostSales: s.lostSales, fullCost: s.fullCost,
    profit: s.profit, breakEven: isNum(s.breakEven) ? s.breakEven : null, openingCash: base.open, cashMonths: months,
    lowCash: s.lowCash, lowDay: s.lowDay, outOfCash: s.outOfCash
  };
}
// explain_line({id}): one cost-sheet or P&L line with its formula written out with the learner's numbers.
// CONTRACT-GAP: econ.js keeps one "how" string per line (the formula with values filled in), so `formula` carries the
// values too; there is no separate symbolic formula to return.
export function lineInfo(id, base) {
  const L = econ.costLines(base.cfg, base.R, base.up, { price: base.price, sold: base.sold });
  const l = L.byId[id];
  if (!l) throw new Error(`No line called "${id}". Lines: ${L.lines.map(x => x.id).join(', ')}.`);
  const shown = l.unit === '%' ? `${econ.roundTo(l.value, 1).toFixed(1)}%` : l.unit === 'cars' ? (isNum(l.value) ? econ.fmt.count(l.value) + ' cars' : 'never') : econ.fmt.money(l.value);
  return { id: l.id, label: l.label, formula: l.how, values: shown, result: lineOut(l).value, unit: l.unit === '$' ? 'US dollars' : l.unit };
}
function makeTools(base) {
  let ids = [];
  try { ids = econ.costLines(base.cfg, base.R, base.up, { price: base.price, sold: base.sold }).lines.map(l => l.id); } catch { }
  const opt = key => ({ type: 'string', enum: Object.keys(econ.CATALOG[key]) });
  return [
    {
      name: 'what_if',
      description: 'Recompute the factory with some changes to the current car, price or plan, using the app\'s own cost model. Returns {changed, cycle (min), bottleneck, materials, started, variable, contribution, price, sold (cars a month), capacity, lostSales, fullCost, profit (a month), breakEven (cars), lowCash, lowDay, outOfCash}. Pass {"changes": {}} for the current numbers. Throws on an invalid option.',
      inputSchema: {
        type: 'object',
        properties: {
          changes: {
            type: 'object',
            properties: {
              body: opt('body'), finish: { ...opt('finish'), description: 'raw = oiled wood' }, livery: opt('livery'),
              number: { type: 'string', description: 'race number 0-99, or "" for none' }, wheels: opt('wheels'),
              bumper: opt('bumper'), roof: { ...opt('roof'), description: 'beacon = light bar; the Racer takes only none or spoiler' },
              price: { type: 'number', description: 'wholesale price in dollars' },
              upgrades: { type: 'object', properties: { lamp: { type: 'boolean' }, autofeed: { type: 'boolean' }, helper: { type: ['integer', 'null'], description: 'station 0-6 (0 Blank ... 6 Detail) for an extra operator, or null' } } },
              shopTerms: { type: 'string', enum: ['net30', 'early'] },
              supplierCredit: { type: 'boolean' }
            }
          }
        },
        required: ['changes']
      },
      execute: input => whatIf(base, input)
    },
    {
      name: 'explain_line',
      description: 'Look up one line of the cost sheet or the month P&L for the current car and plan. Returns {label, formula (written with the learner\'s numbers), values (the result as shown in the app), result, unit}.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', ...(ids.length ? { enum: ids } : {}), description: 'line id, e.g. labour.crew, started, variable, pl.profit' } }, required: ['id'] },
      execute: input => lineInfo(String(isObj(input) ? input.id : input ?? ''), base)
    }
  ];
}

/* ---------- the bubble ---------- */
function format(text) {
  const nodes = [];
  for (const para of String(text).split(/\n{2,}/)) {
    if (!para.trim()) continue;
    const p = document.createElement('p');
    para.split(/(\*\*[^*\n]+\*\*)/).forEach(part => {
      if (/^\*\*[^*\n]+\*\*$/.test(part)) { const b = document.createElement('b'); b.textContent = part.slice(2, -2); p.append(b); return; }
      part.split('\n').forEach((line, i) => { if (i) p.append(document.createElement('br')); if (line) p.append(line); });
    });
    nodes.push(p);
  }
  return nodes;
}
function makeBubble(el, job) {
  const b = document.createElement('div');
  b.className = 'tu-bubble';
  b.innerHTML = `<div class="tu-head"><span class="tu-who"></span><button type="button" class="tu-btn tu-stop"></button></div><div class="tu-text" aria-live="polite"></div><div class="tu-foot" hidden></div>`;
  b.querySelector('.tu-who').textContent = COPY.who;
  const stop = b.querySelector('.tu-stop');
  stop.textContent = COPY.stop;
  stop.addEventListener('click', () => { job.ctl?.abort(); });
  el.append(b);
  return b;
}
const parts = b => ({ text: b.querySelector('.tu-text'), foot: b.querySelector('.tu-foot'), stop: b.querySelector('.tu-stop') });
function setThinking(job) {
  const { text, foot, stop } = parts(job.bubble);
  job.bubble.dataset.state = 'thinking';
  text.setAttribute('aria-busy', 'true');
  text.classList.add('tu-thinking');
  text.textContent = COPY.thinking;
  foot.hidden = true; foot.replaceChildren();
  stop.hidden = false;
}
function paint(job, s) {
  const { text } = parts(job.bubble);
  text.classList.remove('tu-thinking');
  text.replaceChildren(...format(s));
  job.bubble.dataset.state = 'streaming';
}
function settle(job, state, footNodes = []) {
  const { text, foot, stop } = parts(job.bubble);
  job.bubble.dataset.state = state;
  text.classList.remove('tu-thinking');
  text.removeAttribute('aria-busy');
  stop.hidden = true;
  foot.replaceChildren(...footNodes);
  foot.hidden = !footNodes.length;
}
function addLine(job, msg, cls = 'tu-alt') {
  const { text } = parts(job.bubble);
  if (text.classList.contains('tu-thinking')) { text.classList.remove('tu-thinking'); text.replaceChildren(); }
  const p = document.createElement('p');
  p.className = cls;
  if (Array.isArray(msg)) p.append(...msg); else p.textContent = msg;
  text.append(p);
}
const span = (t, cls) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = t; return s; };
function renderHintOnly(el, hint) {
  const b = document.createElement('div');
  b.className = 'tu-bubble tu-hintonly';
  b.dataset.state = 'hint';
  b.innerHTML = '<div class="tu-head"><span class="tu-who"></span></div><div class="tu-text"><p></p></div>';
  b.querySelector('.tu-who').textContent = COPY.hint;
  b.querySelector('p').append(...hintNodes(hint));
  el.append(b);
}
// a local hint for busy/unavailable moments: the caller's, or the line's own formula from econ.js (money set in mono)
function hintOf(opts, base) {
  if (typeof opts.hint === 'string' && stripTags(opts.hint)) return { text: stripTags(opts.hint) };
  if (opts.line) {
    try { const l = lineInfo(String(opts.line), base || baseOf(opts)); return { label: l.label, math: `${l.formula} = ${l.values}` }; } catch { }
  }
  return null;
}
const hintNodes = h => h.text ? [h.text] : [h.label + ' = ', span(h.math, 'tu-num')];

/* ---------- ask ---------- */
function ask(el, opts = {}) {
  const job = { el, opts: { ...opts }, lesson: app.state.lesson, mode: app.state.mode, ctl: null, bubble: null, noTools: false, token: null };
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  job.finish = s => { job.state = s; resolveDone(s); };
  const handle = { stop: () => job.ctl?.abort(), done };
  if (!el || typeof el.append !== 'function') { job.finish('no-element'); return handle; }
  injectCss();
  for (const j of [...active]) if (j.el === el) { j.replaced = true; j.ctl?.abort(); }
  for (const b of el.querySelectorAll(':scope > .tu-bubble')) b.remove();
  if (!available()) {
    const h = hintOf(job.opts);
    if (h) renderHintOnly(el, h);
    job.finish('unavailable');
    return handle;
  }
  job.bubble = makeBubble(el, job);
  run(job);
  return handle;
}

async function run(job) {
  const sample = platform.caps.sample;
  const ctl = job.ctl = new AbortController();                  // a new controller for every call, retries included
  const token = job.token = {};
  active.add(job);
  setThinking(job);
  const kind = KINDS.has(job.opts.kind) ? job.opts.kind : 'free';
  try {
    if (typeof sample !== 'function') throw { code: 'capability_removed', message: 'sample went away' };
    const base = baseOf(job.opts);
    job.base = base;
    const data = buildData(job.opts, base, kind);
    const lim = (job.noTools || toolsOff) ? null : await limits(sample);
    if (ctl.signal.aborted) throw { code: 'cancelled', message: 'stopped before sending' };
    const useTools = !!(lim && isObj(lim.tools) && (lim.tools.maxCount ?? 2) >= 2) && !toolsOff && !job.noTools;
    const input = buildInput(kind, data, questionOf(job.opts, kind), useTools);
    const options = {
      signal: ctl.signal,
      modelTier: QUICK.has(kind) ? 'quick' : 'default',
      onText: ({ text }) => { if (!job.bubble.isConnected) { ctl.abort(); return; } paint(job, text); }
    };
    if (useTools) options.tools = makeTools(base);              // no `cache` with tools: such calls are never cached
    job.usedTools = useTools;
    job.sent = { kind, bytes: input.length, dataBytes: JSON.stringify(data).length };
    const r = await sample(input, options);
    if (job.token !== token) return;
    if (!job.bubble.isConnected) { job.finish('detached'); return; }
    paint(job, r && typeof r.text === 'string' ? r.text : '');
    settle(job, 'done', r && r.truncated ? [span(COPY.cut)] : []);
    job.finish('done');
  } catch (e) {
    if (job.token === token) onError(job, e);
  } finally {
    if (job.token === token) active.delete(job);
  }
}

function onError(job, e) {
  if (e instanceof Error) console.error('[toyline] tutor', e);    // a bug on this page, not a platform rejection
  const c = isObj(e) && typeof e.code === 'string' ? e.code : 'upstream_error';
  const partial = isObj(e) && typeof e.text === 'string' ? e.text : '';
  const b = job.bubble;
  if (c === 'cancelled') {                                        // Stop, leaving the lesson, a newer question: silent
    if (job.replaced || !b.isConnected) return job.finish('cancelled');
    if (partial) { paint(job, partial); settle(job, 'stopped'); } else b.remove();
    return job.finish('cancelled');
  }
  if (DEAD.has(c)) {                                              // hide the tutor for this view
    markDead();
    b.remove();
    const h = hintOf(job.opts, job.base);
    if (h) renderHintOnly(job.el, h);
    return job.finish(c);
  }
  if (c === 'tools_unavailable' && job.usedTools && !job.noTools) {   // once, without tools, still on the learner's click
    toolsOff = true; job.noTools = true;
    active.delete(job);
    run(job);
    return;
  }
  if (c === 'refused') { b.remove(); return job.finish('refused'); }
  if (c === 'rate_limited') {                                     // never retried by the page
    if (partial) paint(job, partial);
    const h = hintOf(job.opts, job.base);
    addLine(job, h ? [span(COPY.busy, 'tu-strong'), ' ', ...hintNodes(h)] : COPY.busyNoHint);
    settle(job, 'busy');
    return job.finish('rate_limited');
  }
  if (c === 'session_expired' || c === 'empty_completion' || PAGE_BUG.has(c)) {
    if (PAGE_BUG.has(c)) console.warn('[toyline] tutor call refused: ' + c + (isObj(e) && e.message ? ' (' + e.message + ')' : ''));
    if (partial) paint(job, partial);
    addLine(job, c === 'session_expired' ? COPY.session : c === 'empty_completion' ? COPY.empty : COPY.bug);
    settle(job, 'error');
    return job.finish(c);
  }
  // upstream_error and unknown codes: keep the partial answer, mark it interrupted, offer a retry the learner clicks
  if (partial) paint(job, partial); else addLine(job, COPY.noAnswer);
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'tu-btn'; retry.textContent = COPY.retry;
  retry.addEventListener('click', () => { if (available()) run(job); else { b.remove(); } });
  settle(job, 'interrupted', [span(partial ? COPY.interrupted : ''), retry].filter(n => n.textContent));
  job.finish(c === 'upstream_error' ? c : 'upstream_error');
}

/* ---------- explain-back grading (sample.json, quick tier, no tools) ---------- */
async function grade({ prompt, ideas, sentence, signal } = {}) {
  const sample = platform.caps.sample;
  if (!available() || typeof sample.json !== 'function') return null;
  const list = (Array.isArray(ideas) ? ideas : []).map(i => ({ id: String(i && i.id || '').trim(), text: stripTags(i && i.text) })).filter(i => i.id && i.text);
  const said = stripTags(sentence).slice(0, 400);
  if (!list.length || !said) return null;
  const input = [
    'You check one sentence a beginner wrote in a short course on costing a small wooden toy-car factory.',
    'Decide which of the listed ideas the sentence clearly expresses, in any words. Be fair to short or informal wording, but count an idea only if the sentence really says it.',
    'Reply with only a JSON object: {"present": [the ids of the ideas expressed], "missing": the id of the most important idea that is absent, or null, "note": "one friendly sentence of at most 20 words for the learner, with no numbers"}.',
    'Example reply: {"present":["a"],"missing":"b","note":"Good start. Now say who pays for the minutes spent waiting."}',
    '',
    'QUESTION: ' + stripTags(prompt).slice(0, 300),
    'IDEAS:',
    ...list.map(i => `- ${i.id}: ${i.text}`),
    'SENTENCE: "' + said.replace(/"/g, "'") + '"'
  ].join('\n');
  try {
    const r = await sample.json(input, { modelTier: 'quick', ...(signal ? { signal } : {}) });
    return normalGrade(r, list);
  } catch (e) {
    if (isObj(e) && DEAD.has(e.code)) markDead();
    return null;
  }
}
export function normalGrade(r, list) {
  if (!isObj(r)) return null;
  const ids = list.map(i => i.id);
  const present = [...new Set((Array.isArray(r.present) ? r.present : []).map(String).filter(id => ids.includes(id)))];
  let missing = typeof r.missing === 'string' && ids.includes(r.missing) && !present.includes(r.missing) ? r.missing : null;
  if (!missing) missing = ids.find(id => !present.includes(id)) ?? null;
  const words = stripTags(typeof r.note === 'string' ? r.note : '').split(' ').filter(Boolean);
  const note = words.slice(0, 20).join(' ') + (words.length > 20 ? '...' : '');
  return { present, missing, note };
}

/* ---------- snapshot ---------- */
// snapshot(ctx): the DATA object from a course ctx ({ lesson, cfg, R, up, month, step?, sold? ... }) or a plain
// { cfg, R, up, price }. Callers fill question / learnerAnswer / attempts / diagnosis / reveal before asking.
function snapshot(ctx = {}) {
  const base = baseOf({ ctx: isObj(ctx) ? ctx : {} });
  const data = build(base);
  ctxOf.set(data, base);
  return data;
}

/* ---------- styles (tokens from index.html only) ---------- */
function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('css-tutor')) return;
  const s = document.createElement('style');
  s.id = 'css-tutor';
  s.textContent = `
.tu-bubble { box-sizing: border-box; max-width: 100%; margin-top: 8px; display: grid; gap: 6px; padding: 8px 12px 10px;
  border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface)); color: var(--ink);
  font-family: var(--f-display); font-size: 13.5px; line-height: 1.5; overflow-wrap: anywhere; text-align: left; }
.tu-bubble.tu-hintonly { border-left-color: var(--muted); background: var(--surface); }
.tu-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; }
.tu-who { font-family: var(--f-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.tu-text p { margin: 0 0 6px; }
.tu-text p:last-child { margin-bottom: 0; }
.tu-text b { font-weight: 700; }
.tu-text .tu-alt { color: var(--ink); }
.tu-text .tu-strong { font-weight: 700; }
.tu-num { font-family: var(--f-mono); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.tu-thinking { color: var(--muted); font-style: italic; animation: tu-pulse 1.4s ease-in-out infinite; }
@keyframes tu-pulse { 50% { opacity: .55; } }
.tu-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.tu-btn { min-height: 32px; padding: 5px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink);
  font: 600 12.5px var(--f-display); cursor: pointer; }
.tu-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tu-bubble[data-state="busy"], .tu-bubble[data-state="interrupted"], .tu-bubble[data-state="error"] { border-left-color: var(--muted); }
@media (max-width: 820px), (pointer: coarse) { .tu-btn { min-height: 44px; padding: 8px 14px; } }
@media (prefers-reduced-motion: reduce) { .tu-thinking { animation: none; } }
`;
  document.head.append(s);
}

/* ---------- the export ---------- */
export const tutor = {
  available,
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  ask,
  grade,
  snapshot
};
