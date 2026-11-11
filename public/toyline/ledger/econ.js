// Toyline Ledger cost model. Pure functions, no DOM: the factory, the ledger, the course and the tutor all read
// their numbers from here (docs/SPEC.md §2). Money in US dollars at full precision, time in factory minutes.

/* ---------- stations ---------- */
export const STATIONS = ['Blank', 'Cut', 'Sand', 'Paint', 'Livery', 'Wheels', 'Detail'];
export const N_ST = 7;

/* ---------- rules (parameters) ---------- */
export const FIXED_ITEMS = [
  ['rent', 'Workshop rent'], ['machineLease', 'Machine lease'], ['supervisor', 'Supervisor salary'],
  ['insurance', 'Insurance'], ['softwarePhone', 'Software & phone'], ['maintenance', 'Maintenance'], ['marketing', 'Marketing']
];
export const DEFAULT_RULES = Object.freeze({
  wageHourly: 19.20,        // an operator's wage, $/h
  onCostRate: 0.25,         // payroll tax, insurance, holiday pay on top of the wage
  crewStations: 7,          // one operator per station
  crewQcPack: 1,            // inspects at the line exit, packs at packing
  powerPerLineMin: 0.40,    // $ per minute the line runs
  moveMin: 0.5,             // one index of the line
  blankMin: 1.0,
  birchFactor: 1,           // Factory floor lever: birch price ×(1 ± %)
  consumables: Object.freeze({ sand: 0.30, paint: 0.20, detail: 0.10 }),
  scrapEvery: 20,           // 1 in N started cars fails the final check
  carton: 1.00,             // per good car, at packing
  freight: 1.00,            // per good car, the shared truck
  fixed: Object.freeze({ rent: 3200, machineLease: 1800, supervisor: 4500, insurance: 400, softwarePhone: 300, maintenance: 600, marketing: 600 }),
  price: 32.00,             // wholesale price to shops
  demandIntercept: 5100,    // Q = max(0, intercept − slope × price)
  demandSlope: 100,
  shiftMin: 420,            // paid line minutes a day (08:00-15:00)
  daysPerMonth: 21,
  shopTerms: 'net30',       // 'net30' (paid 21 working days after delivery) | 'early' (2% off, paid in 7 working days)
  supplierCredit: false,    // materials and cartons paid 21 working days after use
  openingCash: 70000,
  months: 1
});
export const UPGRADES = Object.freeze({
  lamp: { label: 'Flash-off lamp at Paint', fixed: 300, note: 'Paint −0.5 min (gloss and satin)' },
  helper: { label: 'Extra operator at one station', fixed: 0, note: 'crew +1, that station’s minutes halved' },
  autofeed: { label: 'Hopper auto-feed', fixed: 1200, note: 'Blank needs no operator: crew −1' }
});
export const NO_UPGRADES = Object.freeze({ lamp: false, helper: null, autofeed: false });

const q6 = x => Math.round(x * 1e6) / 1e6; // derived rates: 19.2 × 1.25 ÷ 60 must be exactly 0.4

// Fill in a rules object (defaults + overrides) and its derived values. Overrides may be partial; `fixed` and
// `consumables` merge key by key.
export function rules(over = {}) {
  const R = { ...DEFAULT_RULES, ...over };
  R.fixed = { ...DEFAULT_RULES.fixed, ...(over.fixed || {}) };
  R.consumables = { ...DEFAULT_RULES.consumables, ...(over.consumables || {}) };
  R.labourHourly = q6(R.wageHourly * (1 + R.onCostRate));
  R.labourPerMin = q6(R.labourHourly / 60);
  R.fixedTotal = Object.values(R.fixed).reduce((a, b) => a + b, 0);
  R.consumablesTotal = q6(R.consumables.sand + R.consumables.paint + R.consumables.detail);
  R.available = R.shiftMin * R.daysPerMonth;
  return R;
}
export const R0 = rules();

/* ---------- catalogue (§2.3) ---------- */
// Keys match the factory's option keys (BODIES, LIVERIES, WHEELS, BUMPERS, ROOFS, FINISHES in factory.js).
export const CATALOG = Object.freeze({
  body: {
    coupe: { label: 'Coupe', birch: 1.80, cut: 2.5, sand: 2.0 },
    hatch: { label: 'Hatch', birch: 1.60, cut: 2.0, sand: 2.0 },
    wagon: { label: 'Wagon', birch: 1.90, cut: 2.5, sand: 2.0 },
    van: { label: 'Van', birch: 2.40, cut: 2.0, sand: 2.5 },
    pickup: { label: 'Pickup', birch: 1.90, cut: 3.0, sand: 2.0 },
    racer: { label: 'Racer', birch: 1.70, cut: 3.0, sand: 2.0 }
  },
  finish: {
    gloss: { label: 'Gloss lacquer', paint: 0.40, coat: 0.50, coatLabel: 'lacquer', min: 3.0, sandExtra: 0 },
    satin: { label: 'Satin', paint: 0.40, coat: 0.40, coatLabel: 'satin coat', min: 2.5, sandExtra: 0 },
    raw: { label: 'Oiled wood', paint: 0, coat: 0.15, coatLabel: 'oil', min: 1.5, sandExtra: 1.0 }
  },
  livery: {
    plain: { label: 'Plain', price: 0, min: 0 },
    stripe: { label: 'Side stripe', price: 0.30, min: 2.0 },
    gt: { label: 'GT stripes', price: 0.40, min: 2.5 },
    twotone: { label: 'Two-tone', price: 0.60, min: 3.0 },
    pinstripe: { label: 'Pinstripe', price: 0.35, min: 2.5 },
    checker: { label: 'Checker band', price: 0.70, min: 3.5 }
  },
  number: { label: 'Race number roundel', price: 0.20, min: 0.5 },
  wheels: {
    classic: { label: 'Classic', price: 1.20, min: 2.5 },
    whitewall: { label: 'Whitewall', price: 1.60, min: 3.0 },
    racing: { label: 'Racing', price: 1.40, min: 2.5 },
    wood: { label: 'All wood', price: 0.80, min: 2.0 }
  },
  kit: { label: 'Detail kit', price: 0.50, min: 1.5 },
  bumper: {
    none: { label: 'None', price: 0, min: 0 },
    wood: { label: 'Wood dowel', price: 0.20, min: 0.5 },
    chrome: { label: 'Chrome', price: 0.90, min: 1.0 }
  },
  roof: {
    none: { label: 'None', price: 0, min: 0 },
    rack: { label: 'Roof rack', price: 0.60, min: 1.0 },
    spoiler: { label: 'Spoiler', price: 0.40, min: 0.5 },
    beacon: { label: 'Light bar', price: 0.70, min: 0.5 },
    luggage: { label: 'Luggage', price: 0.80, min: 1.0 },
    surf: { label: 'Surfboard', price: 0.70, min: 1.0 }
  }
});
// The Racer only takes None or Spoiler (as in the factory); any other roof on a Racer counts as None.
export const roofOk = (body, roof) => body !== 'racer' || roof === 'none' || roof === 'spoiler';
// Which station an order option is worked at (for "+$0.90 · +1.0 min" lines and tags).
export const OPTION_STATION = { body: [0, 1, 2], finish: [3], livery: [4], number: [4], wheels: [5], bumper: [6], roof: [6], color: [], accent: [] };

/* ---------- cars ---------- */
export const DEFAULT_CAR = Object.freeze({ body: 'coupe', color: '#D7322B', accent: '#F4F3EF', livery: 'stripe', number: '7', wheels: 'classic', bumper: 'chrome', roof: 'none', finish: 'gloss' });
// The seven parked sample cars of the factory, in boot order (§2.10).
export const SAMPLE_CARS = Object.freeze([
  { name: 'Teal Coupe', cfg: { body: 'coupe', color: '#1E7F86', accent: '#F4F3EF', livery: 'gt', number: '', wheels: 'whitewall', bumper: 'chrome', roof: 'none', finish: 'gloss' } },
  { name: 'Mustard Van', cfg: { body: 'van', color: '#E8B53A', accent: '#23395B', livery: 'twotone', number: '', wheels: 'classic', bumper: 'wood', roof: 'surf', finish: 'gloss' } },
  { name: 'Chalk Racer', cfg: { body: 'racer', color: '#F4F3EF', accent: '#D7322B', livery: 'stripe', number: '12', wheels: 'racing', bumper: 'none', roof: 'spoiler', finish: 'gloss' } },
  { name: 'Forest Pickup', cfg: { body: 'pickup', color: '#2F5D46', accent: '#EFE6D2', livery: 'pinstripe', number: '', wheels: 'wood', bumper: 'wood', roof: 'beacon', finish: 'satin' } },
  { name: 'Sky Wagon', cfg: { body: 'wagon', color: '#7FB3D9', accent: '#F4F3EF', livery: 'plain', number: '', wheels: 'whitewall', bumper: 'chrome', roof: 'luggage', finish: 'gloss' } },
  { name: 'Tangerine Hatch', cfg: { body: 'hatch', color: '#EE7A2B', accent: '#1E1F22', livery: 'checker', number: '4', wheels: 'racing', bumper: 'chrome', roof: 'rack', finish: 'gloss' } },
  { name: 'Blush Coupe', cfg: { body: 'coupe', color: '#E99AA8', accent: '#23395B', livery: 'pinstripe', number: '', wheels: 'wood', bumper: 'wood', roof: 'none', finish: 'raw' } }
]);
// Challenge cars (§3.5).
export const RACER_ORDER = Object.freeze({ body: 'racer', color: '#F4F3EF', accent: '#D7322B', livery: 'checker', number: '12', wheels: 'racing', bumper: 'none', roof: 'spoiler', finish: 'gloss' });
export const DELIVERY_VAN = Object.freeze({ body: 'van', color: '#D7322B', accent: '#F4F3EF', livery: 'stripe', number: '7', wheels: 'classic', bumper: 'chrome', roof: 'none', finish: 'gloss' });

const hasNumber = cfg => cfg.number !== undefined && cfg.number !== null && String(cfg.number).trim() !== '';
export const carKey = (cfg, up = NO_UPGRADES) => [cfg.body, cfg.finish, cfg.livery, hasNumber(cfg) ? 'n' : '-', cfg.wheels, cfg.bumper, roofOk(cfg.body, cfg.roof) ? cfg.roof : 'none', up.lamp ? 'L' : '', up.helper ?? '', up.autofeed ? 'A' : ''].join('|');

// Station minutes for an order (§2.3), with any C3 upgrades applied.
export function stationMinutes(cfg, up = NO_UPGRADES, R = R0) {
  up = normUp(up);
  const b = CATALOG.body[cfg.body], f = CATALOG.finish[cfg.finish], l = CATALOG.livery[cfg.livery];
  const w = CATALOG.wheels[cfg.wheels], bu = CATALOG.bumper[cfg.bumper], ro = CATALOG.roof[roofOk(cfg.body, cfg.roof) ? cfg.roof : 'none'];
  if (!b || !f || !l || !w || !bu || !ro) throw new Error('Unknown option in ' + JSON.stringify(cfg));
  let paint = f.min;
  if (up.lamp && cfg.finish !== 'raw') paint -= 0.5;
  const m = [R.blankMin, b.cut, b.sand + f.sandExtra, paint, l.min + (hasNumber(cfg) ? CATALOG.number.min : 0), w.min, CATALOG.kit.min + bu.min + ro.min];
  if (up.helper !== null && up.helper !== undefined) m[up.helper] = m[up.helper] / 2;
  return m;
}

// Materials worked at each station, as labelled parts.
export function stationMaterials(cfg, R = R0) {
  const b = CATALOG.body[cfg.body], f = CATALOG.finish[cfg.finish], l = CATALOG.livery[cfg.livery];
  const w = CATALOG.wheels[cfg.wheels], bu = CATALOG.bumper[cfg.bumper], roofK = roofOk(cfg.body, cfg.roof) ? cfg.roof : 'none', ro = CATALOG.roof[roofK];
  const P = [[], [], [], [], [], [], []];
  P[0].push({ id: 'mat.birch', label: 'Birch blank', value: b.birch * R.birchFactor });
  if (f.paint) P[3].push({ id: 'mat.paint', label: 'Paint', value: f.paint });
  P[3].push({ id: 'mat.coat', label: f.coatLabel[0].toUpperCase() + f.coatLabel.slice(1), value: f.coat });
  if (l.price) P[4].push({ id: 'mat.livery', label: l.label + ' ink', value: l.price });
  if (hasNumber(cfg)) P[4].push({ id: 'mat.number', label: 'No. ' + String(cfg.number).trim() + ' roundel', value: CATALOG.number.price });
  P[5].push({ id: 'mat.wheels', label: w.label + ' wheels', value: w.price });
  P[6].push({ id: 'mat.kit', label: 'Detail kit', value: CATALOG.kit.price });
  if (bu.price) P[6].push({ id: 'mat.bumper', label: bu.label + ' bumpers', value: bu.price });
  if (ro.price) P[6].push({ id: 'mat.roof', label: ro.label, value: ro.price });
  return P;
}

// Operators at each station (helper adds one, auto-feed removes Blank's).
// No extra operator at Blank once auto-feed has taken that job (§2.11).
export const normUp = (up = NO_UPGRADES) => ({ ...NO_UPGRADES, ...up, helper: up.autofeed && up.helper === 0 ? null : (up.helper ?? null) });
export function stationCrew(up = NO_UPGRADES) {
  up = normUp(up);
  const c = [1, 1, 1, 1, 1, 1, 1];
  if (up.autofeed) c[0] = 0;
  if (up.helper !== null && up.helper !== undefined) c[up.helper] += 1;
  return c;
}
const CONS_AT = { 2: 'sand', 3: 'paint', 6: 'detail' };

const sum = a => a.reduce((s, x) => s + x, 0);
const EPS = 1e-9;
const bottlenecks = m => { const B = Math.max(...m); return m.map((x, i) => Math.abs(x - B) < EPS ? i : -1).filter(i => i >= 0); };

// Everything about one car on a line full of identical cars (§2.4, §2.6, §2.7).
export function carCost(cfg, R = R0, up = NO_UPGRADES) {
  up = normUp(up);
  const m = stationMinutes(cfg, up, R);
  const parts = stationMaterials(cfg, R);
  const crewAt = stationCrew(up);
  const work = sum(m);
  const bott = Math.max(...m), bottAll = bottlenecks(m), bottIdx = bottAll[0];
  const cycle = R.moveMin + bott;
  const rate = R.labourPerMin;
  const crew = sum(crewAt) + R.crewQcPack;
  const lineRate = crew * rate + R.powerPerLineMin;
  const matByStation = parts.map(p => sum(p.map(x => x.value)));
  const consByStation = m.map((_, k) => CONS_AT[k] ? R.consumables[CONS_AT[k]] : 0);
  const crewByStation = crewAt.map(c => c * cycle * rate);
  const stationPost = m.map((_, k) => matByStation[k] + crewByStation[k] + consByStation[k]);
  const materials = sum(matByStation);
  const consumables = sum(consByStation);
  const qcPack = R.crewQcPack * cycle * rate;
  const power = cycle * R.powerPerLineMin;
  const crewCost = crew * cycle * rate;
  const started = materials + crewCost + power + consumables;
  const good = started * R.scrapEvery / (R.scrapEvery - 1);
  const scrapShare = good - started;
  const variable = good + R.carton + R.freight;
  const stationsPaid = sum(crewAt) * cycle * rate;
  const touch = sum(m.map((x, k) => x * crewAt[k])) * rate;
  const waitBott = sum(m.map((x, k) => (bott - x) * crewAt[k])) * rate;
  const waitMove = sum(crewAt) * R.moveMin * rate;
  // tab after each station, then the exit (QC & pack + power)
  const tab = []; let t = 0;
  for (let k = 0; k < N_ST; k++) { t += stationPost[k]; tab.push(t); }
  tab.push(t + qcPack + power);
  return {
    cfg: { ...cfg }, up: { ...NO_UPGRADES, ...up }, m, work, bott, bottIdx, bottAll, cycle, crew, crewAt, rate, lineRate,
    parts, matByStation, consByStation, crewByStation, stationPost, exitPost: { qc: qcPack, power }, tab,
    materials, consumables, crewCost, power, qcPack, stationsPaid, touch, waiting: waitBott + waitMove, waitBott, waitMove,
    started, scrapShare, good, carton: R.carton, freight: R.freight, variable,
    balance: work / (N_ST * cycle)
  };
}

/* ---------- option prices for the Order form ---------- */
// What one option is, alone: "Chrome $0.90 · 1.0 min" (the station it lands on and its own price/minutes).
export function optionInfo(key, value, cfg = DEFAULT_CAR, R = R0) {
  const C = CATALOG;
  if (key === 'body') { const b = C.body[value]; return { price: b.birch * R.birchFactor, minutes: [[1, b.cut], [2, b.sand]], station: 0 }; }
  if (key === 'finish') { const f = C.finish[value]; return { price: f.paint + f.coat, minutes: [[3, f.min]].concat(f.sandExtra ? [[2, f.sandExtra]] : []), station: 3 }; }
  if (key === 'livery') { const l = C.livery[value]; return { price: l.price, minutes: [[4, l.min]], station: 4 }; }
  if (key === 'number') { const on = hasNumber({ number: value }); return { price: on ? C.number.price : 0, minutes: [[4, on ? C.number.min : 0]], station: 4 }; }
  if (key === 'wheels') { const w = C.wheels[value]; return { price: w.price, minutes: [[5, w.min]], station: 5 }; }
  if (key === 'bumper') { const b = C.bumper[value]; return { price: b.price, minutes: [[6, b.min]], station: 6 }; }
  if (key === 'roof') { const r = C.roof[roofOk(cfg.body, value) ? value : 'none']; return { price: r.price, minutes: [[6, r.min]], station: 6 }; }
  return { price: 0, minutes: [], station: -1 }; // colours: every paint costs the same
}
// What switching the current order to this option would change (L6 deltas, accent dot on bottleneck movers).
export function optionDelta(cfg, key, value, R = R0, up = NO_UPGRADES) {
  const a = carCost(cfg, R, up);
  const next = { ...cfg, [key]: value };
  if (key === 'body' && !roofOk(value, next.roof)) next.roof = 'none';
  const b = carCost(next, R, up);
  return {
    dMaterials: b.materials - a.materials, dWork: b.work - a.work, dCycle: b.cycle - a.cycle, dStarted: b.started - a.started,
    dVariable: b.variable - a.variable, movesBottleneck: Math.abs(b.cycle - a.cycle) > EPS || b.bottAll.join() !== a.bottAll.join(),
    changesCycle: Math.abs(b.cycle - a.cycle) > EPS, after: b
  };
}

/* ---------- a month (§2.4) ---------- */
export const fixedTotal = (R = R0, up = NO_UPGRADES) => R.fixedTotal + (up.lamp ? UPGRADES.lamp.fixed : 0) + (up.autofeed ? UPGRADES.autofeed.fixed : 0);
export const demand = (price, R = R0) => Math.max(0, R.demandIntercept - R.demandSlope * price);
export const netPrice = (price, R = R0) => R.shopTerms === 'early' ? price * 0.98 : price;

// opts: { price, sold (override volume, e.g. the L8 slider), fixedExtra }
export function month(cfg, R = R0, up = NO_UPGRADES, opts = {}) {
  const k = carCost(cfg, R, up);
  const price = opts.price ?? R.price;
  const F = fixedTotal(R, up) + (opts.fixedExtra || 0);
  const capStarted = R.available / k.cycle;
  const capGood = capStarted * (R.scrapEvery - 1) / R.scrapEvery;
  const Q = demand(price, R);
  const fixedSold = opts.sold !== undefined && opts.sold !== null;
  const sold = fixedSold ? Math.min(Math.max(0, opts.sold), capGood) : Math.min(Q, capGood);
  const startedN = sold * R.scrapEvery / (R.scrapEvery - 1);
  const scrapped = startedN - sold;
  const lineMin = startedN * k.cycle;
  const np = netPrice(price, R);
  const pl = {
    sales: sold * price,
    discounts: sold * (price - np),
    materials: startedN * k.materials,
    crew: lineMin * k.crew * k.rate,
    power: lineMin * R.powerPerLineMin,
    consumables: startedN * k.consumables,
    cartons: sold * R.carton,
    freight: sold * R.freight
  };
  pl.netSales = pl.sales - pl.discounts;
  pl.variable = pl.materials + pl.crew + pl.power + pl.consumables + pl.cartons + pl.freight;
  pl.contribution = pl.netSales - pl.variable;
  pl.fixed = F;
  pl.profit = pl.contribution - F;
  pl.scrapMemo = scrapped * k.started;
  const contribution = np - k.variable;
  const fixedPerCar = sold > 0 ? F / sold : Infinity;
  const fullCost = k.variable + fixedPerCar;
  return {
    car: k, price, netPrice: np, F, Q, sold, capGood, capStarted, startedN, scrapped, lineMin,
    lostSales: fixedSold ? 0 : Math.max(0, Q - capGood), util: lineMin / R.available,
    days: lineMin / R.shiftMin, takt: sold > 0 ? R.available / sold : Infinity,
    pl,
    perCar: { variable: k.variable, fixedPerCar, fullCost, contribution, profit: np - fullCost, margin: (np - fullCost) / np, markup: (np - fullCost) / fullCost },
    breakEven: breakEven(F, contribution)
  };
}
export const breakEven = (F, contribution) => contribution > EPS ? Math.ceil(F / contribution - 1e-9) : Infinity;
export const priceForMargin = (cost, m) => cost / (1 - m);
export const markupOf = (price, cost) => (price - cost) / cost;
export const marginOf = (price, cost) => (price - cost) / price;
export const profitAt = (cfg, price, R = R0, up = NO_UPGRADES) => month(cfg, R, up, { price }).pl.profit;

// Price sweep with capacity applied (L11 chart, §2.8 table).
export function priceSweep(cfg, R = R0, up = NO_UPGRADES, { from = 24, to = 46, step = 0.5 } = {}) {
  const out = [];
  for (let i = 0; from + i * step <= to + EPS; i++) {
    const p = Math.round((from + i * step) * 100) / 100, mo = month(cfg, R, up, { price: p });
    out.push({ price: p, Q: mo.Q, sold: mo.sold, revenue: mo.pl.sales, netSales: mo.pl.netSales, profit: mo.pl.profit, lostSales: mo.lostSales, util: mo.util });
  }
  return out;
}
export function bestPrice(cfg, R = R0, up = NO_UPGRADES, range = {}) {
  return priceSweep(cfg, R, up, range).reduce((b, r) => r.profit > b.profit + EPS ? r : b, { profit: -Infinity });
}
// The profitable price window to the cent, and the kink where capacity stops binding (§2.8: $26.77, $46.31, $27.06).
export function profitWindow(cfg, R = R0, up = NO_UPGRADES) {
  const k = carCost(cfg, R, up), capGood = R.available / k.cycle * (R.scrapEvery - 1) / R.scrapEvery;
  const kink = (R.demandIntercept - capGood) / R.demandSlope;
  let lo = null, hi = null;
  for (let c = 1; c <= Math.ceil(R.demandIntercept / R.demandSlope * 100); c++) {
    const p = c / 100;
    if (month(cfg, R, up, { price: p }).pl.profit >= -EPS) { if (lo === null) lo = p; hi = p; }
  }
  return { lo, hi, kink, capGood };
}

/* ---------- the cash calendar (§2.5) ---------- */
// Daily flows over `months` months of 21 working days. Receipts arrive 21 working days after delivery (the same day
// number next month), or 7 with early pay at 98%. Supplier credit defers materials (×20/19) and cartons 21 days.
// Returns days[] with end-of-day balances, the low point, the first day below zero and end-of-month balances.
export function cashCalendar(cfg, R = R0, up = NO_UPGRADES, opts = {}) {
  const months = opts.months ?? R.months ?? 1, open = opts.open ?? R.openingCash, price = opts.price ?? R.price;
  const mo = month(cfg, R, up, { price, sold: opts.sold });
  const k = mo.car, F = mo.F, D = R.daysPerMonth;
  const goodPerDay = R.shiftMin / k.cycle * (R.scrapEvery - 1) / R.scrapEvery;
  const early = R.shopTerms === 'early';
  const lag = early ? 7 : D, np = netPrice(price, R);
  const supLag = R.supplierCredit ? D : 0;
  const deferred = R.supplierCredit ? k.materials * R.scrapEvery / (R.scrapEvery - 1) + R.carton : 0;
  const total = months * D;
  const items = Array.from({ length: total + 2 * D }, () => []);
  for (let mth = 0; mth < months; mth++) {
    const d0 = mth * D;
    items[d0].push({ item: 'Fixed bills', amount: -F });
    let left = mo.sold;
    for (let d = 0; d < D && left > EPS; d++) {
      const g = Math.min(goodPerDay, left); left -= g;
      items[d0 + d].push({ item: R.supplierCredit ? 'Crew, power, consumables, freight' : 'Materials, crew, power, cartons, freight', amount: -g * (k.variable - deferred), good: g });
      if (deferred) items[d0 + d + supLag].push({ item: 'Supplier invoices (materials, cartons)', amount: -g * deferred });
      items[d0 + d + lag].push({ item: early ? 'Shops paid (2% early-pay discount)' : 'Shops paid', amount: g * np });
    }
  }
  let bal = open, low = Infinity, lowAt = -1, firstNeg = -1;
  const days = [], eom = [];
  for (let i = 0; i < total; i++) {
    const net = items[i].reduce((a, x) => a + x.amount, 0);
    bal += net;
    if (bal < low - EPS) { low = bal; lowAt = i; }
    if (firstNeg < 0 && bal < -EPS) firstNeg = i;
    days.push({ index: i, month: Math.floor(i / D) + 1, day: i % D + 1, items: items[i], net, balance: bal, good: items[i].reduce((a, x) => a + (x.good || 0), 0) });
    if (i % D === D - 1) eom.push(bal);
  }
  const at = i => i < 0 ? null : { index: i, month: Math.floor(i / D) + 1, day: i % D + 1 };
  return { open, months, price, days, eom, low, lowAt: at(lowAt), firstNeg: at(firstNeg), goodPerDay, profitMonthly: mo.pl.profit, month: mo };
}
// The least opening cash that keeps every end-of-day balance at or above zero.
export function leastOpeningCash(cfg, R = R0, up = NO_UPGRADES, opts = {}) {
  const c = cashCalendar(cfg, R, up, { ...opts, open: 0 });
  return Math.max(0, -c.low);
}

/* ---------- "where the $32 goes" (§2.7) ---------- */
export function whereTheMoneyGoes(cfg, R = R0, up = NO_UPGRADES, opts = {}) {
  const mo = month(cfg, R, up, opts), k = mo.car;
  const seg = [
    ['materials', 'Materials', k.materials],
    ['touch', 'Labour, working', k.touch],
    ['waiting', 'Labour, waiting', k.waiting],
    ['qc', 'QC & pack', k.qcPack],
    ['powerCons', 'Power + consumables', k.power + k.consumables],
    ['scrap', 'Scrap', k.scrapShare],
    ['shipping', 'Carton + freight', k.carton + k.freight],
    ['fixed', 'Fixed overhead', mo.perCar.fixedPerCar]
  ];
  if (R.shopTerms === 'early') seg.push(['discount', 'Early-pay discount', mo.price - mo.netPrice]);
  seg.push(['profit', mo.perCar.profit >= 0 ? 'Profit' : 'Loss', mo.perCar.profit]);
  return { price: mo.price, sold: mo.sold, segments: seg.map(([id, label, value]) => ({ id, label, value })) };
}

/* ---------- order mix (§2.10) ---------- */
export function orderMix(cars = [{ name: 'Default red Coupe (the order)', cfg: DEFAULT_CAR }, ...SAMPLE_CARS], R = R0, up = NO_UPGRADES, price = R.price) {
  return cars.map(({ name, cfg }) => {
    const k = carCost(cfg, R, up);
    return { name, cfg, materials: k.materials, m: k.m, bottAll: k.bottAll, bott: k.bott, cycle: k.cycle, started: k.started, variable: k.variable, contribution: netPrice(price, R) - k.variable };
  });
}

/* ---------- the cost sheet: every line with its formula (§4.5, tutor explain_line, CSV) ---------- */
export function costLines(cfg, R = R0, up = NO_UPGRADES, opts = {}) {
  const mo = month(cfg, R, up, opts), k = mo.car, r = k.rate;
  const $ = fmt.money2, mn = fmt.min;
  // a labour rate that is not a whole cent a minute ($20/h -> $0.3333) shows 4 decimals so the working adds up
  const rt = x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? $(x) : '$' + x.toFixed(4);
  const crewN = k.crew, ops = k.crewAt.reduce((a, b) => a + b, 0);
  const L = [];
  const add = (section, id, label, value, how, unit = '$') => L.push({ section, id, label, value, unit, how });
  k.parts.forEach((p, s) => p.forEach(x => add('materials', x.id, `${x.label} (${STATIONS[s]})`, x.value,
    x.id === 'mat.birch' && R.birchFactor !== 1 ? `${$(CATALOG.body[cfg.body].birch)} × ${R.birchFactor}` : 'catalogue price')));
  add('materials', 'materials', 'Materials', k.materials, k.parts.flat().map(x => $(x.value)).join(' + '));
  const worked = k.m.reduce((a, x, s) => a + x * k.crewAt[s], 0); // person-minutes: an extra operator or auto-feed changes it
  add('labour', 'labour.touch', 'Touch labour', k.touch, `${mn(worked)} min worked × ${rt(r)}`);
  add('labour', 'labour.waitBott', `Waiting for ${STATIONS[k.bottIdx]}`, k.waitBott, `(${ops} × ${mn(k.bott)} − ${mn(worked)}) min × ${rt(r)}`);
  add('labour', 'labour.waitMove', 'Waiting while the line moves', k.waitMove, `${ops} × ${mn(R.moveMin)} min × ${rt(r)}`);
  add('labour', 'labour.stations', 'Station operators', k.stationsPaid, `${ops} people × ${mn(k.cycle)} min × ${rt(r)}`);
  add('labour', 'labour.qc', 'QC & pack', k.qcPack, `${R.crewQcPack} × ${mn(k.cycle)} min × ${rt(r)}`);
  add('labour', 'labour.crew', 'Crew', k.crewCost, `${crewN} people × ${mn(k.cycle)} min × ${rt(r)}`);
  add('line', 'power', 'Power', k.power, `${mn(k.cycle)} min × ${$(R.powerPerLineMin)}`);
  add('line', 'consumables', 'Consumables', k.consumables, `sand ${$(R.consumables.sand)} + paint ${$(R.consumables.paint)} + detail ${$(R.consumables.detail)}`);
  add('car', 'started', 'Started car', k.started, `${$(k.materials)} + ${$(k.crewCost)} + ${$(k.power)} + ${$(k.consumables)}`);
  add('car', 'scrap', 'Scrap share', k.scrapShare, `${$(k.started)} ÷ ${R.scrapEvery - 1}`);
  add('car', 'good', 'Good car', k.good, `${$(k.started)} × ${R.scrapEvery} ÷ ${R.scrapEvery - 1}`);
  add('car', 'carton', 'Carton', k.carton, 'per good car');
  add('car', 'freight', 'Freight', k.freight, 'per good car');
  add('car', 'variable', 'Variable cost per car sold', k.variable, `${$(k.good)} + ${$(k.carton)} + ${$(k.freight)}`);
  add('month', 'fixedShare', `Fixed share at ${fmt.count(mo.sold)} cars`, mo.perCar.fixedPerCar, `${$(mo.F, 0)} ÷ ${fmt.count(mo.sold)}`);
  add('month', 'full', 'Full cost per car', mo.perCar.fullCost, `${$(k.variable)} + ${$(mo.perCar.fixedPerCar)}`);
  add('month', 'price', R.shopTerms === 'early' ? 'Price after 2% early-pay discount' : 'Price', mo.netPrice, R.shopTerms === 'early' ? `${$(mo.price)} × 0.98` : 'set by you');
  add('month', 'contribution', 'Contribution per car', mo.perCar.contribution, `${$(mo.netPrice)} − ${$(k.variable)}`);
  add('month', 'profitPerCar', 'Profit per car', mo.perCar.profit, `${$(mo.netPrice)} − ${$(mo.perCar.fullCost)}`);
  add('month', 'margin', 'Margin', mo.perCar.margin * 100, `${$(mo.perCar.profit)} ÷ ${$(mo.netPrice)}`, '%');
  add('month', 'markup', 'Markup', mo.perCar.markup * 100, `${$(mo.perCar.profit)} ÷ ${$(mo.perCar.fullCost)}`, '%');
  add('month', 'breakEven', 'Break-even', mo.breakEven, `${$(mo.F, 0)} ÷ ${$(mo.perCar.contribution)}, rounded up`, 'cars');
  // the month P&L
  const p = mo.pl;
  add('pl', 'pl.sales', 'Sales', p.sales, `${fmt.count(mo.sold)} × ${$(mo.price)}`);
  if (p.discounts) add('pl', 'pl.discounts', 'Early-pay discounts', -p.discounts, `${fmt.count(mo.sold)} × ${$(mo.price)} × 2%`);
  add('pl', 'pl.materials', 'Materials', p.materials, `${fmt.count(mo.startedN)} started × ${$(k.materials)}`);
  add('pl', 'pl.crew', 'Line crew', p.crew, `${fmt.min(mo.lineMin)} line-min × ${crewN} × ${rt(r)}`);
  add('pl', 'pl.power', 'Power', p.power, `${fmt.min(mo.lineMin)} line-min × ${$(R.powerPerLineMin)}`);
  add('pl', 'pl.consumables', 'Consumables', p.consumables, `${fmt.count(mo.startedN)} started × ${$(k.consumables)}`);
  add('pl', 'pl.cartons', 'Cartons', p.cartons, `${fmt.count(mo.sold)} × ${$(R.carton)}`);
  add('pl', 'pl.freight', 'Freight', p.freight, `${fmt.count(mo.sold)} × ${$(R.freight)}`);
  add('pl', 'pl.variable', 'Variable costs', p.variable, `${fmt.count(mo.sold)} × ${$(k.variable)}`);
  add('pl', 'pl.contribution', 'Contribution', p.contribution, `${fmt.count(mo.sold)} × ${$(mo.perCar.contribution)}`);
  add('pl', 'pl.fixed', 'Fixed overhead', p.fixed, FIXED_ITEMS.map(([id]) => $(R.fixed[id], 0)).join(' + ') + (up.lamp ? ' + lamp $300' : '') + (up.autofeed ? ' + auto-feed $1,200' : ''));
  add('pl', 'pl.profit', 'Operating profit', p.profit, `${$(p.contribution, 0)} − ${$(p.fixed, 0)}`);
  return { lines: L, month: mo, byId: Object.fromEntries(L.map(l => [l.id, l])) };
}
export function explainLine(id, cfg, R = R0, up = NO_UPGRADES, opts = {}) {
  const l = costLines(cfg, R, up, opts).byId[id];
  if (!l) throw new Error('No cost line called ' + id);
  return { label: l.label, formula: l.how, result: l.value, unit: l.unit };
}

/* ---------- one-call summary (tutor what_if, challenge scoring) ---------- */
export function summary(cfg, R = R0, up = NO_UPGRADES, opts = {}) {
  const mo = month(cfg, R, up, opts), k = mo.car;
  const c = cashCalendar(cfg, R, up, { months: opts.months ?? 3, open: opts.open ?? R.openingCash, price: mo.price });
  return {
    cycle: k.cycle, bottleneck: k.bottAll.map(i => STATIONS[i]).join(' & '), stationMinutes: k.m, materials: r2(k.materials),
    started: r2(k.started), variable: r2(k.variable), price: mo.price, contribution: r2(mo.perCar.contribution),
    sold: Math.round(mo.sold * 10) / 10, capacity: Math.round(mo.capGood * 10) / 10, lostSales: Math.round(mo.lostSales * 10) / 10,
    profit: r2(mo.pl.profit), breakEven: mo.breakEven, fullCost: r2(mo.perCar.fullCost),
    lowCash: r2(c.low), lowDay: c.lowAt ? `month ${c.lowAt.month} day ${c.lowAt.day}` : null,
    outOfCash: c.firstNeg ? `month ${c.firstNeg.month} day ${c.firstNeg.day}` : null
  };
}

/* ---------- rounding, formatting, answer checking (§2.12) ---------- */
// half-up to n decimals, symmetric for negatives; the 1e-9 nudge keeps 1.005-style floats from rounding down
export const roundTo = (x, n = 2) => { const f = 10 ** n; return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-7) / f; };
export const r2 = x => roundTo(x, 2);
export const r1 = x => roundTo(x, 1);
const grp = (x, d) => Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmt = {
  // $1,234.56; monthly figures pass d = 0 for whole dollars
  money2: (x, d = 2) => !Number.isFinite(x) ? '—' : (roundTo(x, d) < 0 ? '−$' : '$') + grp(roundTo(x, d), d),
  // whole dollars over $1,000, cents below
  money: x => fmt.money2(x, Math.abs(roundTo(x, 2)) >= 1000 ? 0 : 2),
  signed: (x, d = 2) => (roundTo(x, d) > 0 ? '+' : '') + fmt.money2(x, d),
  min: x => { if (!Number.isFinite(x)) return '—'; const v = roundTo(x, 1); return (v < 0 ? '−' : '') + grp(v, Number.isInteger(v) && Math.abs(v) >= 100 ? 0 : 1); },
  count: x => { if (!Number.isFinite(x)) return '—'; const d = Math.abs(x - Math.round(x)) < 0.05 ? 0 : 1, v = roundTo(x, d); return (v < 0 ? '−' : '') + grp(v, d); },
  // a per-minute labour rate: cents when it is whole cents ($0.40), else 4 decimals ($0.6250) so the working adds up
  rate: x => !Number.isFinite(x) ? '—' : Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? fmt.money2(x) : '$' + x.toFixed(4),
  pct: (x, d = 1) => !Number.isFinite(x) ? '—' : (roundTo(x * 100, d) < 0 ? '−' : '') + Math.abs(roundTo(x * 100, d)).toFixed(d) + '%'
};
export const TOL = { car$: 0.01, month$: 1, min: 0.05, pct: 0.1, count: 0 };
// "$1,140.00", "1 140", "23.1%", "−$3.40", "-3.4" → number (percent sign kept off; caller knows the unit). null if not a number.
// Learners also type units: "5.30 dollars", "2.5 min", "40c", "3.0/3.5" (copied from the strip) read as numbers too,
// and a decimal comma: "5,30" is 5.30.
export function parseNumber(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t = String(s ?? '').trim().toLowerCase().replace(/[−–]/g, '-');
  t = t.replace(/\s*\/\s*[\d.]+\s*(min(ute)?s?)?\.?$/, ''); // "3.0/3.5 min" -> "3.0"
  t = t.replace(/\s*(dollars?|usd|bucks|min(ute)?s?|hrs?|hours?|cars?|per\s*cent|percent)\.?$/, '');
  const cents = /^-?\d+\s*(c|cents?)\.?$/.test(t);
  if (cents) t = t.replace(/\s*(c|cents?)\.?$/, '');
  // a decimal comma ("5,30", "12,5%"): one comma, no point, one or two digits after it. Three digits stay thousands ("1,900").
  t = t.replace(/^([^.,]*\d),(\d{1,2})(\s*%?)$/, '$1.$2$3');
  t = t.replace(/[$,\s%]/g, '').replace(/^\+/, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return cents ? parseFloat(t) / 100 : parseFloat(t);
}
export const near = (a, b, tol) => a !== null && Number.isFinite(a) && Math.abs(a - b) <= tol + 1e-9;
