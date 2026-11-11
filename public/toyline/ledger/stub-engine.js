// A stand-in engine with the factory's API (docs/CONTRACTS.md) for harness pages: no 3D, but a real-timed line that
// moves cars through the seven stations, posts their tabs from econ.js and fires the same events. Positions come
// from a flat projection of the factory's world coordinates onto the stage element.
import * as econ from './econ.js';

const SX = [-20, -13.5, -7, -.5, 6, 12.5, 19], EXIT_X = 25.5, PACK_X = 57.8, TRUCK_X = 64.8;
const MOVE_T = 1.5, WORK_T = 2.6;

export function createStubEngine({ stage = document.querySelector('#stage') } = {}) {
  const subs = new Map();
  const emit = (type, data) => { for (const fn of [...(subs.get(type) || [])]) { try { fn(data); } catch (e) { console.error(e); } } };
  let R = econ.rules(), up = { ...econ.NO_UPGRADES }, layers = {}, wo = 0, qcCount = 0, qcSeed = null, stopped = false, bank = null;
  let cfg = { ...econ.DEFAULT_CAR };
  const queue = [], line = [], after = [], all = new Set();
  const clock = { lineMin: 0, day: 1, minOfDay: 0, running: false };
  const actuals = { lineMinRun: 0, linePaid: 0, chargedToCars: 0, broughtForward: 0, idleLine: 0, started: 0, scrapped: 0, scrapLost: 0, parked: 0, packed: 0, shipped: 0, invoiced: 0 };
  const cyc = { phase: 'idle', t: 0, mMax: 0, cycle: 0, W: 0, p: Array(7).fill(0), m: Array(7).fill(0), bottleneck: [] };
  const stamp = () => 'WO-' + String(++wo).padStart(4, '0');
  const makeCar = (c, place) => { const car = { wo: stamp(), cfg: { ...c }, status: 'Queued', place, cost: econ.carCost(c, R, up), tab: { total: 0, lines: [] }, broughtForward: 0, scrapped: false, x: -26.5, z: 0 }; all.add(car); return car; };
  const post = (car, id, label, value, station, kind, fwd) => {
    car.tab.lines.push({ id, label, value, station, kind }); car.tab.total += value;
    if (fwd) car.broughtForward += value; else if (kind === 'crew' || kind === 'qc' || kind === 'power') actuals.chargedToCars += value;
  };
  const postStation = (car, k, fwd) => {
    const c = car.cost;
    c.parts[k].forEach(p => post(car, p.id, p.label, p.value, k, 'material', fwd));
    post(car, 'crew.' + k, econ.STATIONS[k] + ' operator', c.crewByStation[k], k, 'crew', fwd);
    if (c.consByStation[k]) post(car, 'cons.' + k, 'Consumables', c.consByStation[k], k, 'consumable', fwd);
  };
  const W = 600, H = 400; // world to stage: x -36..80 across, z -12..12 down, y lifts
  const api = {
    on(type, fn) { if (!subs.has(type)) subs.set(type, new Set()); subs.get(type).add(fn); return () => subs.get(type).delete(fn); },
    get cfg() { return { ...cfg }; },
    cars: () => [...all],
    lineUnits: () => line.map(u => ({ wo: u.car.wo, car: u.car, slot: u.slot })),
    queueLength: () => queue.length,
    tracked: null,
    get clock() { return { ...clock }; },
    get cycleInfo() { return { phase: cyc.phase, t: cyc.t, mMax: cyc.mMax, cycle: cyc.cycle, p: [...cyc.p], m: [...cyc.m], bottleneck: [...cyc.bottleneck] }; },
    get actuals() { return { ...actuals, idleLine: actuals.linePaid - actuals.chargedToCars }; },
    project(x, y, z) {
      const r = stage.getBoundingClientRect();
      const px = (x + 36) / 116 * r.width, py = r.height * .55 + z / 24 * r.height * .5 - y * r.height * .045;
      return { x: px, y: py, visible: px >= 0 && px <= r.width && py >= 0 && py <= r.height };
    },
    anchor(kind, ref) {
      if (kind === 'station') return [SX[ref], 4.2, -3.4];
      if (kind === 'car') return [ref.x ?? 0, 2.4, ref.z ?? 0];
      if (kind === 'pack') return [PACK_X, 3, 0];
      if (kind === 'truck') return [TRUCK_X, 4, 0];
      if (kind === 'scrap') return [EXIT_X + 2, 1.5, 3.6];
      return [0, 0, 0];
    },
    stageEl: stage, speed: 1, cameraMode: 'overview',
    configure(o) { if (o.R) R = o.R; if (o.up) up = o.up; if (o.layers) layers = o.layers; },
    setCfg(c) { cfg = { ...c }; emit('optionChanged', { cfg: { ...cfg }, key: 'all' }); },
    send(c = cfg) { const car = makeCar(c, 'queue'); queue.push(car); emit('sent', { wo: car.wo, cfg: car.cfg }); return car.wo; },
    batch(n = 5) { const w = [api.send()]; for (let i = 1; i < n; i++) w.push(api.send({ ...econ.SAMPLE_CARS[i % 7].cfg })); return w; },
    fillLine(c = cfg, { count = 7 } = {}) {
      const w = [];
      for (let s = count - 1; s >= 0; s--) {
        const car = makeCar(c, 'line'); car.x = SX[s]; car.status = `At station 0${s + 1} · ${econ.STATIONS[s]}`;
        for (let k = 0; k < s; k++) postStation(car, k, true);
        actuals.broughtForward += car.broughtForward; line.push({ car, slot: s }); w.push(car.wo);
      }
      line.sort((a, b) => b.slot - a.slot);
      if (cyc.phase === 'idle') startWork();
      return w.reverse();
    },
    emptyLine() { for (const u of line) all.delete(u.car); line.length = 0; for (const c of queue) all.delete(c); queue.length = 0; cyc.phase = 'idle'; clock.running = false; emit('lineIdle', {}); },
    setStopped(b) { stopped = !!b; },
    setQcSeed(n) { qcSeed = qcCount + n; },
    setSpeed(s) { api.speed = s; },
    setCamera(m, car) { api.cameraMode = m; api.tracked = m === 'overview' ? null : (car || line[0]?.car || null); emit('followed', { car: api.tracked }); },
    followWo(w) { const car = [...all].find(c => c.wo === w); if (car) api.setCamera('follow', car); },
    flyToStation() { },
    setBank(v) { bank = v; },
    toast(h) { const t = document.querySelector('#toast'); if (!t) return; t.innerHTML = h; t.classList.add('on'); clearTimeout(api._tt); api._tt = setTimeout(() => t.classList.remove('on'), 1600); },
    note(t) { console.log('[note]', t); },
    tapStation(i, source = 'api') { emit('stationTap', { station: i, source }); },
    // harness helpers
    tapCar(car) { emit('carTap', { car }); },
    emit
  };
  function startMove() {
    cyc.phase = 'move'; cyc.t = 0;
    for (const u of line) u.slot++;
    if (queue.length) { const car = queue.shift(); car.place = 'line'; actuals.started++; line.push({ car, slot: 0 }); emit('enter', { wo: car.wo, car }); }
    emit('cycle', { phase: 'move', mMax: 0, cycle: R.moveMin, units: line.map(u => ({ wo: u.car.wo, slot: u.slot })) });
  }
  function startWork() {
    // cars past ST-07 go through QC
    for (const u of [...line]) if (u.slot >= 7) {
      line.splice(line.indexOf(u), 1);
      const c = u.car, k = c.cost;
      post(c, 'qc', 'QC & pack', k.qcPack, 7, 'qc'); post(c, 'power', 'Power', k.power, 7, 'power');
      emit('exit', { wo: c.wo, car: c, post: { qc: k.qcPack, power: k.power }, tab: c.tab.total });
      qcCount++;
      const fail = qcSeed !== null ? (qcCount >= qcSeed && (qcCount - qcSeed) % R.scrapEvery === 0) : qcCount % R.scrapEvery === 0;
      emit('qc', { wo: c.wo, car: c, pass: !fail, count: qcCount });
      if (fail) { c.scrapped = true; c.place = 'scrap'; actuals.scrapped++; actuals.scrapLost += c.tab.total; emit('scrapped', { wo: c.wo, car: c, lost: c.tab.total }); continue; }
      post(c, 'scrap', 'Share of scrap', k.scrapShare, 7, 'scrap'); emit('scrapShare', { wo: c.wo, car: c, post: k.scrapShare, tab: c.tab.total });
      c.place = 'lot'; c.x = 40; c.z = 6; c.status = 'Parked in lot A1'; actuals.parked++; emit('parked', { wo: c.wo, car: c, stall: 0 });
      after.push({ car: c, t: 0, stage: 0 });
    }
    const occ = line.filter(u => u.slot < 7);
    cyc.m = Array(7).fill(0); for (const u of occ) cyc.m[u.slot] = u.car.cost.m[u.slot];
    cyc.mMax = Math.max(0, ...cyc.m); cyc.cycle = R.moveMin + cyc.mMax; cyc.W = WORK_T * cyc.mMax / 3;
    cyc.bottleneck = cyc.m.map((x, i) => x === cyc.mMax && x > 0 ? i : -1).filter(i => i >= 0);
    cyc.p = cyc.m.map(x => x > 0 ? 0 : 1); cyc.posted = Array(7).fill(false);
    cyc.phase = 'work'; cyc.t = 0;
    for (const u of occ) { u.car.x = SX[u.slot]; u.car.status = `At station 0${u.slot + 1} · ${econ.STATIONS[u.slot]}`; }
    emit('cycle', { phase: 'work', mMax: cyc.mMax, cycle: cyc.cycle, units: occ.map(u => ({ wo: u.car.wo, slot: u.slot })) });
    if (!line.length && !queue.length) { cyc.phase = 'idle'; clock.running = false; emit('lineIdle', {}); }
  }
  let last = performance.now();
  function tick(now) {
    const raw = Math.min(.05, (now - last) / 1000); last = now;
    const dt = raw * api.speed;
    if (!stopped) {
      if (cyc.phase === 'idle' && queue.length) startMove();
      if (cyc.phase !== 'idle') {
        clock.running = true;
        const lineRate = (econ.stationCrew(up).reduce((a, b) => a + b, 0) + R.crewQcPack) * R.labourPerMin + R.powerPerLineMin;
        let dMin = 0;
        cyc.t += dt;
        if (cyc.phase === 'move') {
          dMin = R.moveMin * dt / MOVE_T;
          for (const u of line) { const to = u.slot < 7 ? SX[u.slot] : EXIT_X, from = u.slot > 0 ? SX[u.slot - 1] : -26.5; u.car.x = from + (to - from) * Math.min(1, cyc.t / MOVE_T); }
          if (cyc.t >= MOVE_T) startWork();
        } else if (cyc.phase === 'work') {
          dMin = cyc.W > 0 ? cyc.mMax * dt / cyc.W : 0;
          for (const u of line) {
            const k = u.slot; if (k > 6) continue;
            cyc.p[k] = Math.min(1, cyc.t / Math.max(1e-6, cyc.W * cyc.m[k] / Math.max(1e-6, cyc.mMax)));
            if (cyc.p[k] >= 1 && !cyc.posted[k]) {
              cyc.posted[k] = true; postStation(u.car, k, false);
              const c = u.car.cost;
              emit('stationDone', { wo: u.car.wo, car: u.car, station: k, post: c.stationPost[k], parts: c.parts[k], crew: c.crewByStation[k], consumables: c.consByStation[k], minutes: c.m[k], tab: u.car.tab.total });
            }
          }
          if (cyc.t >= cyc.W) startMove();
        }
        clock.lineMin += dMin; clock.minOfDay += dMin;
        if (clock.minOfDay >= R.shiftMin) { clock.minOfDay -= R.shiftMin; clock.day++; }
        actuals.lineMinRun += dMin; actuals.linePaid += dMin * lineRate;
      }
    }
    for (const a of [...after]) {
      a.t += dt;
      if (a.stage === 0 && a.t > 4) { a.stage = 1; a.car.place = 'carton'; a.car.x = PACK_X; post(a.car, 'carton', 'Carton', R.carton, 8, 'carton'); actuals.packed++; emit('packed', { wo: a.car.wo, car: a.car, post: R.carton, tab: a.car.tab.total }); }
      if (a.stage === 1 && a.t > 7) { a.stage = 2; a.car.place = 'truck'; a.car.x = TRUCK_X; post(a.car, 'freight', 'Freight', R.freight, 9, 'freight'); actuals.shipped++; actuals.invoiced += R.price; emit('shipped', { wo: a.car.wo, car: a.car, post: R.freight, tab: a.car.tab.total, invoice: R.price }); after.splice(after.indexOf(a), 1); }
    }
    emit('frame', { dt, raw });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  api.emitDemo = () => { api.fillLine(econ.DEFAULT_CAR); api.send(); api.send(); };
  return api;
}
