// Toyline Ledger, Unit A "One car": lessons L0-L6 and the Unit A wrap-up (docs/SPEC.md §3.2), written in the lesson
// DSL of docs/CONTRACTS.md. Every figure is computed from econ.js through ctx (ctx.car, ctx.R, ctx.$ ...), never
// typed. No DOM access at module level: tools/check-course.mjs imports this file in Node and evaluates every answer.
//
// Extras this file uses on top of the contract (all provided by course.js, the same owner):
//   ctx.ui.buttons / blanks / ab / note  - small shared widgets (receipt with blanks, A/B receipts, buttons)
//   ctx.prediction(lessonId)             - a saved scored:false pick (L0's prediction, revealed in L3)
//   ctx.seed                             - a stable per-learner number (the wrap-up's seeded cost sheet)
//   step.check                           - a step completed by answering an embedded check (L4 lone car, wrap-up)
//   step.nudge(ctx, evt)                 - a message for an event that did not complete the step
//   check.after(ctx)                     - shown under a correct answer (and under the solution)
//   check.diagnose(ctx, value)           - generic first-rung message when no distractor matches
//   lesson.takeaways(ctx)                - lines shown after the twin (L6)
//   lesson.layers                        - layer set to switch on when it is not the lesson's own id (wrap-up)
//   lesson.beforeChecks(ctx)             - runs as the checks first show; a returned line is shown above them (L3)
//   ctx.keepLine(cfg | () => cfg)        - keeps a live demo line fed while the lesson is open; returns stop()
//   ctx.rate(x)                          - a per-minute labour rate, as econ fmt.rate prints it
//   blank rows' slips: [{ value, msg }]  - a known slip on a faded-practice line and what it means
//   step.nudge -> { html, toast, keep }  - a short stage toast for another tab, and a nudge that stays after the step
import { DEFAULT_CAR, CATALOG, STATIONS, N_ST, SAMPLE_CARS, carCost, carKey, rules } from './econ.js';

const D = DEFAULT_CAR;
const NAVY = '#23395B';                 // the factory's "Navy" body paint (factory.js colour list)
const SIGNAL_RED = 'Signal red', NAVY_NAME = 'Navy';
const L1_VAN = { body: 'van', wheels: 'wood', bumper: 'wood' };
const L2_TWIN = { wage: 28.80, minutes: 12.0 };              // twin inputs: a new wage and new work minutes
const L3_TWIN_M = [1.0, 2.0, 2.0, 2.5, 3.5, 2.0, 2.0];       // twin inputs: made-up station minutes
const L4_CHECKER = { livery: 'checker' };
const L4_TWIN_EXTRA = 0.5;                                   // twin input: minutes added to the bottleneck
const L5_QC_SEED = 3;                                        // the 3rd car to reach QC fails
const L5_TWIN = { every: 10, started: 22.50 };               // twin inputs: 1 in 10 scrapped, started cost
const L6_TWIN = { roof: 'rack' };
const L6_WORKED = { roof: 'beacon' };                       // the worked example: the Light bar ties Paint (parts only)
const L6_AB3 = { roof: 'surf' };                            // the third A/B: Detail passes Paint by half its extra minute

/* ---------- helpers (pure) ---------- */
const sum = a => a.reduce((s, x) => s + x, 0);
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const st2 = i => String(i + 1).padStart(2, '0');
const ordinal = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
const pct0 = x => Math.round(x * 100) + '%';
const rt = (ctx, x) => (ctx.rate || ctx.$)(x);              // a labour rate as shown: $0.40, or $0.6250 when not whole cents
const kc = (ctx, over = {}) => carCost({ ...ctx.cfg, ...over }, ctx.R, ctx.up);
const sameCar = (a, b) => !!a && !!b && carKey(a) === carKey(b);
const bottName = k => list(k.bottAll.map(i => STATIONS[i]));
const OPTION_KEYS = ['body', 'finish', 'livery', 'number', 'wheels', 'bumper', 'roof'];
const hasNum = c => String(c?.number ?? '').trim() !== '';
// Which order options differ between two cfgs (colours do not count; the roundel counts as present or not).
export function changedOptions(a, b) {
  return OPTION_KEYS.filter(key => key === 'number' ? hasNum(a) !== hasNum(b) : a[key] !== b[key]);
}
// Line figures for a made-up set of station minutes (one operator per station).
export function lineFromMinutes(m, R) {
  const B = Math.max(...m), cycle = R.moveMin + B, work = sum(m), ops = m.length, r = R.labourPerMin;
  return { B, cycle, work, ops, paid: ops * cycle * r, touch: work * r, waiting: (ops * cycle - work) * r, waitBott: (ops * B - work) * r, waitMove: ops * R.moveMin * r };
}
// Stations that add parts to the car, and the ones that add none.
const matStations = k => STATIONS.filter((_, i) => k.matByStation[i] > 1e-9);
const noMatStations = k => STATIONS.filter((_, i) => k.matByStation[i] <= 1e-9);
// minutes a lone car keeps the line running: one move in, a move between stations, one move out, plus its own work
const loneMinutes = (ctx) => (N_ST + 1) * ctx.R.moveMin + ctx.car.work;
const lineRate = ctx => ctx.car.lineRate;

// reset the factory to the lesson's car on an empty, running line
function resetLine(ctx, { speed = 1, fill = false } = {}) {
  const e = ctx.engine; if (!e) return;
  e.setStopped?.(false);
  e.emptyLine?.();
  e.setCfg?.({ ...ctx.cfg });
  e.setCamera?.('overview');
  e.setSpeed?.(speed);
  if (fill) e.fillLine?.({ ...ctx.cfg }, { count: N_ST });
}
// a fresh full line of `cfg` (whatever was on it goes); returns the work orders by station slot, 0 = Blank
function refill(ctx, cfg = ctx.cfg) {
  const e = ctx.engine; if (!e) return [];
  e.setStopped?.(false);
  e.emptyLine?.();
  return e.fillLine?.({ ...cfg }, { count: N_ST }) || [];
}
// send a car and follow it, so its receipt shows and grows (the overlay shows a receipt only for a followed car)
function sendAndFollow(ctx, cfg = ctx.cfg) {
  const e = ctx.engine; if (!e) return null;
  const wo = e.send?.({ ...cfg });
  if (wo) e.followWo?.(wo);
  return wo || null;
}

// worked example rows: the default car's parts station by station
function workedMaterials(ctx) {
  const k = ctx.car, rows = [];
  k.parts.forEach((p, s) => {
    if (!p.length) return;
    rows.push({ label: `${st2(s)} ${STATIONS[s]}: ${p.map(x => x.label.toLowerCase()).join(' + ')}`, value: ctx.$(sum(p.map(x => x.value))), how: p.map(x => `${x.label} ${ctx.$(x.value)}`).join(' + ') });
  });
  rows.push({ label: 'Materials, the whole BOM', value: ctx.$(k.materials), how: k.matByStation.filter(v => v > 1e-9).map(v => ctx.$(v)).join(' + ') + ' = ' + ctx.$(k.materials) });
  return rows;
}

/* ====================================================================================================== L0 */
const L0 = {
  id: 'L0', unit: 'A', title: 'Walk the line', minutes: 3, scored: false,
  goal: 'Know the seven stations and the route: order → line → lot → packing → truck.',
  explain: () => `Every Toyline car starts as a block of birch and visits seven stations in order: ${list(STATIONS)}. All the pallets move together, so a car moves one station along each <g t="cycle">cycle</g>. After ${STATIONS[N_ST - 1]} it is inspected, parks in the lot, gets boxed and rides the truck to a toy shop. In this course you’ll put a price on every step.`,
  // the car goes when the learner sends it (step 2), so nothing happens off-screen while they read
  setup: async ctx => resetLine(ctx, { speed: 2 }),
  hook: {
    text: () => 'Before you look closely, make a guess. You’ll find out in L3.',
    predict: {
      id: 'p0', kind: 'choice', scored: false, save: 'prediction',
      prompt: 'Which station do you think takes longest on this car?',
      options: STATIONS.map(s => ({ text: s })),
      after: () => 'L3 shows the answer.'
    }
  },
  steps: [
    {
      id: 'taps', on: ['stationTap'],
      text: ctx => `Tap each of the seven station cells in the strip along the bottom of the factory (${(ctx.mem.tapped?.size) || 0} of ${N_ST} so far).`,
      done: (ctx, e) => { (ctx.mem.tapped ||= new Set()).add(e.station); return ctx.mem.tapped.size >= N_ST; }
    },
    {
      id: 'parked', on: ['parked', 'scrapped', 'sent'],
      text: ctx => ctx.mem.wo ? `Follow ${ctx.mem.wo} at 2× until it leaves the line and parks in the lot.` : 'Press <b>Send my car</b>, then follow it at 2× until it leaves the line and parks in the lot.',
      done: (ctx, e) => {
        if (e.type === 'sent') { if (!ctx.mem.wo) ctx.mem.wo = e.wo; return false; }
        return !!ctx.mem.wo && e.wo === ctx.mem.wo;
      },
      widget: (el, ctx) => ctx.ui.buttons(el, [
        { label: 'Send my car', primary: true, onClick: () => { ctx.engine?.setQcSeed?.(ctx.R.scrapEvery); const wo = sendAndFollow(ctx); if (wo) ctx.mem.wo = wo; } },   // the seed keeps it clear of a QC fail
        { label: 'Follow my car', onClick: () => { if (ctx.mem.wo) ctx.engine?.followWo?.(ctx.mem.wo); } }
      ])
    }
  ],
  hint: 'Tap a station name in the strip along the bottom of the factory.',
  misconceptions: ['The fiddly detail work must be the slow part.']
};

/* ====================================================================================================== L1 */
const L1 = {
  id: 'L1', unit: 'A', title: 'What’s in the box', minutes: 5, scored: true,
  goal: 'List a car’s parts and add them up.',
  explain: () => `A car’s <g t="materials">materials</g> are every part it uses: the birch blank, paint and lacquer, the stripe ink, the wheels, and the small detail kit of lights, grille and number plate. Each option you pick on the work order adds its own parts. Add them all up and you have the <g t="bill of materials">bill of materials</g>, or BOM.`,
  setup: async ctx => resetLine(ctx, { speed: 2 }),
  teardown: ctx => ctx.engine?.setCfg?.({ ...ctx.cfg }),
  worked: workedMaterials,
  steps: [
    {
      id: 'send', on: ['sent', 'stationDone', 'exit'],
      text: ctx => `The Order tab now shows a price beside each option. Send the default car and follow it: as it passes ${list(matStations(ctx.car))}, its parts land on its receipt. Worked total: <b>${ctx.$(ctx.car.materials)}</b>.`,
      done: (ctx, e) => {
        const m = ctx.mem; m.sent ||= [];
        if (e.type === 'sent') { if (sameCar(e.cfg, ctx.cfg)) m.sent.push(e.wo); return false; }
        return m.sent.includes(e.wo) && (e.type === 'exit' || e.station === N_ST - 1);
      },
      widget: (el, ctx) => ctx.ui.buttons(el, [{ label: 'Send the default car', primary: true, onClick: () => { const wo = sendAndFollow(ctx); if (wo) (ctx.mem.sent ||= []).push(wo); } }])
    },
    {
      id: 'van',
      text: () => `Faded practice: switch the order preview to ${CATALOG.body.van.label}, then fill in its birch line and its new total.`,
      widget: (el, ctx) => {
        const van = kc(ctx, { body: 'van' }), V = CATALOG.body.van.label, C = CATALOG.body[ctx.cfg.body].label;
        ctx.ui.buttons(el, [{ label: `Show the ${V}`, onClick: () => ctx.engine?.setCfg?.({ ...ctx.cfg, body: 'van' }) }]);
        const rows = [{
          label: `Birch blank · ${V}`, answer: van.matByStation[0], unit: '$',
          how: `The ${V} blank is ${ctx.$(van.matByStation[0])}: the Order tab shows it beside ${V}.`,
          slips: [{ value: ctx.car.matByStation[0], msg: `That’s the ${C}’s blank. The ${V} is a bigger block of birch: look beside ${V} in the Order tab.` }]
        }];
        van.parts.forEach((p, s) => { if (s > 0 && p.length) rows.push({ label: `${STATIONS[s]}: ${p.map(x => x.label.toLowerCase()).join(' + ')}`, value: van.matByStation[s], unit: '$' }); });
        rows.push({
          label: `Materials · ${V}`, answer: van.materials, unit: '$', total: true,
          how: `${van.matByStation.filter(v => v > 1e-9).map(v => ctx.$(v)).join(' + ')} = ${ctx.$(van.materials)}`,
          slips: [{ value: ctx.car.materials, msg: `That’s the ${C}’s total. Swap in the ${V}’s blank.` }]
        });
        return ctx.ui.blanks(el, { rows, onDone: () => ctx.complete('van') });
      }
    }
  ],
  checks: [
    {
      id: 'c1', kind: 'number', unit: '$',
      prompt: () => `Same car, but a ${CATALOG.body.van.label} with ${CATALOG.wheels.wood.label} wheels and ${CATALOG.bumper.wood.label} bumpers. What do its materials cost?`,
      answer: ctx => kc(ctx, L1_VAN).materials,
      distractors: [
        { id: 'noKit', value: ctx => kc(ctx, L1_VAN).materials - CATALOG.kit.price, msg: ctx => `You left out the ${ctx.$(CATALOG.kit.price)} detail kit: lights, grille and plate are parts too.` },
        { id: 'keptWheels', value: ctx => kc(ctx, { ...L1_VAN, wheels: ctx.cfg.wheels }).materials, msg: ctx => `You kept the ${CATALOG.wheels[ctx.cfg.wheels].label} wheel price.` },
        { id: 'keptBumpers', value: ctx => kc(ctx, { ...L1_VAN, bumper: ctx.cfg.bumper }).materials, msg: ctx => `You kept the ${CATALOG.bumper[ctx.cfg.bumper].label.toLowerCase()} bumpers; ${CATALOG.bumper.wood.label.toLowerCase()}s are ${ctx.$(CATALOG.bumper.wood.price)}.` },
        { id: 'woodOnly', value: ctx => kc(ctx, L1_VAN).matByStation[0], msg: 'That’s only the wood.' }
      ],
      step2: ctx => { const p = kc(ctx, L1_VAN).parts.flat(); return `Add every part: ${p.map(x => `${x.label.toLowerCase()} ${ctx.$(x.value)}`).join(' + ')} = <b>?</b>`; },
      solution: ctx => { const k = kc(ctx, L1_VAN); return `${k.parts.flat().map(x => ctx.$(x.value)).join(' + ')} = <b>${ctx.$(k.materials)}</b>.`; }
    }
  ],
  twin: {
    id: 'twin', kind: 'choice',
    prompt: () => `Default car, ${SIGNAL_RED} → ${NAVY_NAME}: materials change by?`,
    options: ctx => {
      const d = kc(ctx, { color: NAVY }).materials - ctx.car.materials;
      const paint = CATALOG.finish[ctx.cfg.finish].paint;
      const same = `${NAVY_NAME} replaces ${SIGNAL_RED.toLowerCase()}; it doesn’t add a coat. All 12 colours cost the same.`;
      return [
        { text: ctx.$(Math.abs(d) < 1e-9 ? 0 : d), correct: true, why: 'Every body paint costs the same, so the colour is free to change.' },
        { text: '+' + ctx.$(0.10), correct: false, why: same },
        { text: '−' + ctx.$(0.10), correct: false, why: same },
        { text: '+' + ctx.$(paint), correct: false, why: `${ctx.$(paint)} is the price of the paint itself. ${same}` }
      ];
    },
    solution: ctx => `<b>${ctx.$(0)}</b>. Paint is ${ctx.$(CATALOG.finish[ctx.cfg.finish].paint)} in any of the 12 colours.`
  },
  explainBack: {
    prompt: ctx => `Why isn’t ${ctx.$(ctx.car.materials)} what the car costs?`,
    model: 'It’s only the parts; people, power and everything after the line cost money too.',
    ideas: [{ id: 'parts', text: 'It’s only the parts' }, { id: 'labour', text: 'People’s time costs money too' }, { id: 'after', text: 'Things after the line cost money too' }]
  },
  rule: 'Materials = every part the car uses, small ones included.',
  hint: ctx => `Go station by station: ${matStations(ctx.car).join(', ')}. ${list(noMatStations(ctx.car))} add no parts.`,
  misconceptions: ['A wooden toy’s cost is the wood.', 'Every choice costs money.']
};

/* ====================================================================================================== L2 */
const L2 = {
  id: 'L2', unit: 'A', title: 'Minutes cost money', minutes: 5, scored: true,
  goal: 'Turn work minutes into money using a worker’s full hourly cost.',
  explain: ctx => { const R = ctx.R; return `A worker costs more than their <g t="wage">wage</g>: the business also pays payroll tax, insurance and holiday pay, which here add ${pct0(R.onCostRate)}. These are <g t="on-costs">on-costs</g>. So ${ctx.$(R.wageHourly)} an hour becomes ${ctx.$(R.labourHourly)} an hour, and one minute costs ${ctx.$(R.labourHourly)} ÷ 60 = ${rt(ctx, R.labourPerMin)}. Multiply a car’s work minutes by ${rt(ctx, R.labourPerMin)} and you have the cost of the hands-on work, the <g t="touch labour">touch labour</g>.`; },
  // a full line that stays full while the lesson is open, so every strip label shows a car's minutes (never 0.0)
  setup: async ctx => { resetLine(ctx, { speed: 1, fill: true }); ctx.keepLine?.(ctx.cfg); },
  worked: ctx => {
    const R = ctx.R, k = ctx.car;
    return [
      { label: 'Wage', value: ctx.$(R.wageHourly) + '/h', how: 'what the operator is paid per hour' },
      { label: `On-costs, ${pct0(R.onCostRate)}`, value: ctx.$(R.wageHourly * R.onCostRate) + '/h', how: `${ctx.$(R.wageHourly)} × ${pct0(R.onCostRate)}` },
      { label: 'Full hourly cost', value: ctx.$(R.labourHourly) + '/h', how: `${ctx.$(R.wageHourly)} × ${1 + R.onCostRate}` },
      { label: 'One worker-minute', value: rt(ctx, R.labourPerMin), how: `${ctx.$(R.labourHourly)} ÷ 60` },
      { label: 'Work minutes on the default car', value: ctx.min(k.work) + ' min', how: k.m.map(x => ctx.min(x)).join(' + ') },
      { label: 'Touch labour', value: ctx.$(k.touch), how: `${ctx.min(k.work)} min × ${rt(ctx, R.labourPerMin)}` }
    ];
  },
  steps: [
    {
      id: 'minutes',
      text: () => `${list(STATIONS.slice(0, 3))} are filled in. Tap ${list(STATIONS.slice(3))} in the strip to read their minute labels, then enter them and the total.`,
      widget: (el, ctx) => {
        const m = ctx.car.m, cyc = ctx.min(ctx.car.cycle);
        const rows = STATIONS.map((s, i) => i < 3 ? { label: `${st2(i)} ${s}`, value: m[i], unit: 'min' } : {
          label: `${st2(i)} ${s}`, answer: m[i], unit: 'min',
          how: `${s}’s strip label reads ${ctx.min(m[i])}/${cyc}: ${ctx.min(m[i])} min of work in a ${cyc}-min cycle.`,
          slips: [
            { value: 0, msg: `${s} is empty right now, so its label reads 0.0. Use the order’s minutes: tap ${s} again when a car is there.` },
            { value: ctx.car.cycle, msg: `That’s the cycle, the second number on the label. ${s}’s own minutes are the first number.` }
          ]
        });
        rows.push({
          label: 'Total work', answer: ctx.car.work, unit: 'min', total: true,
          how: `${m.map(x => ctx.min(x)).join(' + ')} = ${ctx.min(ctx.car.work)}`,
          slips: [{ value: sum(m.slice(3)), msg: `That’s only the four you typed. Add ${list(STATIONS.slice(0, 3))} too.` }]
        });
        return ctx.ui.blanks(el, { rows, onDone: () => ctx.complete('minutes') });
      }
    }
  ],
  checks: [
    {
      id: 'c1', kind: 'number', unit: '$',
      prompt: ctx => `Wage ${ctx.$(ctx.R.wageHourly)}/h, on-costs add ${pct0(ctx.R.onCostRate)}. What does one minute cost?`,
      answer: ctx => ctx.R.labourPerMin,
      distractors: [
        { id: 'wageOnly', value: ctx => ctx.R.wageHourly / 60, msg: 'That’s the wage alone.' },
        { id: 'per100', value: ctx => ctx.R.labourHourly / 100, msg: 'An hour has 60 minutes, not 100.' },
        { id: 'perHour', value: ctx => ctx.R.labourHourly, msg: 'That’s per hour.' }
      ],
      step2: ctx => `Full hourly cost: ${ctx.$(ctx.R.wageHourly)} × ${1 + ctx.R.onCostRate} = ${ctx.$(ctx.R.labourHourly)}. One minute: ${ctx.$(ctx.R.labourHourly)} ÷ 60 = <b>?</b>`,
      solution: ctx => `${ctx.$(ctx.R.wageHourly)} × ${1 + ctx.R.onCostRate} = ${ctx.$(ctx.R.labourHourly)} an hour, and ${ctx.$(ctx.R.labourHourly)} ÷ 60 = <b>${rt(ctx, ctx.R.labourPerMin)}</b> a minute.`
    },
    {
      id: 'c2', kind: 'number', unit: '$',
      prompt: () => 'Touch labour for the default car?',
      answer: ctx => ctx.car.touch,
      distractors: [{ id: 'wageOnly', value: ctx => ctx.car.work * ctx.R.wageHourly / 60, msg: 'You used the wage alone.' }],
      step2: ctx => `${ctx.min(ctx.car.work)} work minutes × ${rt(ctx, ctx.R.labourPerMin)} = <b>?</b>`,
      solution: ctx => `${ctx.min(ctx.car.work)} min × ${rt(ctx, ctx.R.labourPerMin)} = <b>${ctx.$(ctx.car.touch)}</b>.`
    }
  ],
  twin: {
    id: 'twin', kind: 'numbers',
    prompt: ctx => `Wage ${ctx.$(L2_TWIN.wage)}/h + ${pct0(ctx.R.onCostRate)}: cost per minute, and for ${ctx.min(L2_TWIN.minutes)} work minutes?`,
    fields: [
      {
        label: 'Per minute', unit: '$', answer: ctx => rules({ ...ctx.R, wageHourly: L2_TWIN.wage }).labourPerMin,
        distractors: [{ id: 'wageOnly', value: () => L2_TWIN.wage / 60, msg: 'That’s the wage alone: add the on-costs first.' }, { id: 'per100', value: ctx => rules({ ...ctx.R, wageHourly: L2_TWIN.wage }).labourHourly / 100, msg: 'An hour has 60 minutes, not 100.' }]
      },
      {
        label: () => `For ${(L2_TWIN.minutes).toFixed(1)} min`, unit: '$', answer: ctx => L2_TWIN.minutes * rules({ ...ctx.R, wageHourly: L2_TWIN.wage }).labourPerMin,
        distractors: [{ id: 'wageOnly', value: () => L2_TWIN.minutes * L2_TWIN.wage / 60, msg: 'You used the wage alone.' }]
      }
    ],
    step2: ctx => { const r = rules({ ...ctx.R, wageHourly: L2_TWIN.wage }); return `${ctx.$(L2_TWIN.wage)} × ${1 + ctx.R.onCostRate} = ${ctx.$(r.labourHourly)} an hour; ÷ 60 = <b>?</b> a minute; × ${ctx.min(L2_TWIN.minutes)} = <b>?</b>`; },
    solution: ctx => { const r = rules({ ...ctx.R, wageHourly: L2_TWIN.wage }); return `${ctx.$(r.labourHourly)} ÷ 60 = <b>${rt(ctx, r.labourPerMin)}</b> a minute, and ${ctx.min(L2_TWIN.minutes)} × ${rt(ctx, r.labourPerMin)} = <b>${ctx.$(L2_TWIN.minutes * r.labourPerMin)}</b>.`; }
  },
  explainBack: {
    prompt: ctx => `Why use ${ctx.$(ctx.R.labourHourly)}, not ${ctx.$(ctx.R.wageHourly)}?`,
    model: ctx => `Because the business also pays on-costs (payroll tax, insurance and holiday pay) on top of the wage, so each hour of work costs it ${ctx.$(ctx.R.labourHourly)}.`,
    ideas: [{ id: 'oncosts', text: 'There are on-costs on top of the wage' }, { id: 'business', text: 'The business pays them' }]
  },
  rule: 'A worker-minute costs (wage + on-costs) ÷ 60.',
  hint: ctx => `Full hourly cost first (wage + ${pct0(ctx.R.onCostRate)}), then divide by 60.`,
  misconceptions: ['The wage is what a worker costs.', 'Dividing by 100.']
};

/* ====================================================================================================== L3 */
const L3 = {
  id: 'L3', unit: 'A', title: 'Everyone waits for the slowest', minutes: 6, scored: true,
  goal: 'Cycle time, the bottleneck, and time that is paid but idle.',
  explain: () => `All the pallets move together, so the line moves on only when the slowest station has finished. That station is the <g t="bottleneck">bottleneck</g>, and the <g t="cycle">cycle</g> is its minutes plus the half-minute the line takes to move. Every operator is paid for the whole cycle, including the minutes they spend waiting: their <g t="waiting time">waiting time</g>.`,
  // a full line of the default car, kept fed while the lesson is open: the strip always shows the car the steps and
  // checks are about, whatever the learner tries on the order form in the lever task
  setup: async ctx => { resetLine(ctx, { speed: 1, fill: true }); ctx.keepLine?.(ctx.cfg); },
  teardown: ctx => ctx.engine?.setCfg?.({ ...ctx.cfg }),
  // the checks are about the default car: put it back on the order form too, and say so
  beforeChecks: ctx => {
    ctx.engine?.setCfg?.({ ...ctx.cfg });
    return `Back to the default ${CATALOG.finish[ctx.cfg.finish].label.split(' ')[0].toLowerCase()} car for the questions: the order and the line are on it again.`;
  },
  hook: {
    text: ctx => {
      const p = ctx.prediction?.('L0'), b = bottName(ctx.car), mins = ctx.min(ctx.car.bott);
      const watch = `Each bar in the strip fills solid to its station’s work minutes, then turns hatched amber while it waits for the slowest station. At every move all ${N_ST} stack lights go amber, because everyone waits the ${ctx.min(ctx.R.moveMin)} min the line takes to move.`;
      if (!p) return `${watch} Which station’s bar never shows hatching?`;
      const right = ctx.car.bottAll.some(i => STATIONS[i] === p);
      const detail = p === STATIONS[N_ST - 1] && !right ? ` The fiddly detail work takes only ${ctx.min(ctx.car.m[N_ST - 1])} min here.` : '';
      return `In L0 you guessed <b>${p}</b> takes longest. ${right ? 'You were right' : `It’s <b>${b}</b>`}: ${mins} min of work.${detail} ${watch}`;
    }
  },
  worked: ctx => {
    const k = ctx.car, r = ctx.R.labourPerMin, ops = k.crewAt.reduce((a, b) => a + b, 0);
    return [
      { label: 'Slowest station', value: `${bottName(k)} ${ctx.min(k.bott)} min`, how: k.m.map((x, i) => `${STATIONS[i]} ${ctx.min(x)}`).join(' · ') },
      { label: 'Cycle', value: ctx.min(k.cycle) + ' min', how: `${ctx.min(k.bott)} + ${ctx.min(ctx.R.moveMin)} move` },
      { label: 'Station operators paid', value: ctx.$(k.stationsPaid), how: `${ops} × ${ctx.min(k.cycle)} min × ${rt(ctx, r)}` },
      { label: 'Touch labour (worked)', value: ctx.$(k.touch), how: `${ctx.min(k.work)} min × ${rt(ctx, r)}` },
      { label: 'Waiting', value: ctx.$(k.waiting), how: `${ctx.$(k.waitBott)} for ${bottName(k)} (${ops} × ${ctx.min(k.bott)} − ${ctx.min(k.work)} = ${ctx.min(ops * k.bott - k.work)} min) + ${ctx.$(k.waitMove)} while the line moves (${ctx.min(ops * ctx.R.moveMin)} min)` },
      { label: 'Line balance', value: ctx.pct(k.balance), how: `${ctx.min(k.work)} ÷ (${ops} × ${ctx.min(k.cycle)})` }
    ];
  },
  steps: [
    {
      id: 'tap', on: ['stationTap'],
      text: () => 'Tap the station that sets the pace (it never waits for another station).',
      done: (ctx, e) => ctx.car.bottAll.includes(e.station),
      nudge: (ctx, e) => ctx.car.bottAll.includes(e.station) ? null : `${STATIONS[e.station]} works ${ctx.min(ctx.car.m[e.station])} min, then waits ${ctx.min(ctx.car.bott - ctx.car.m[e.station])} for ${bottName(ctx.car)}.`
    },
    {
      id: 'lever', on: ['optionChanged'],
      text: ctx => `Lever task: change one option so the cycle drops to ${ctx.min(kc(ctx, { finish: 'satin' }).cycle)} min.`,
      done: (ctx, e) => {
        const cfg = e.cfg || ctx.engine?.cfg; if (!cfg) return false;
        let k; try { k = carCost(cfg, ctx.R, ctx.up); } catch { return false; }
        return changedOptions(ctx.cfg, cfg).length === 1 && Math.abs(k.cycle - kc(ctx, { finish: 'satin' }).cycle) < 1e-9;
      },
      nudge: (ctx, e) => {
        const cfg = e.cfg || ctx.engine?.cfg; if (!cfg) return null;
        let k; try { k = carCost(cfg, ctx.R, ctx.up); } catch { return null; }
        const ch = changedOptions(ctx.cfg, cfg), target = kc(ctx, { finish: 'satin' }).cycle;
        if (!ch.length) return null;
        if (ch.length > 1) return `That’s ${ch.length} options changed. Start from the default car and change just one.`;
        // the trap the explain-back asks about: toasted on the Order tab, and kept under the step once it is done
        if (ch[0] === 'finish' && cfg.finish === 'raw') return {
          html: `Paint is faster now, but oiled wood needs extra sanding: ${STATIONS[2]} is ${ctx.min(k.m[2])}, so the cycle stays ${ctx.min(k.cycle)}.`,
          toast: `Oiled: ${STATIONS[2]} ${ctx.min(k.m[2])}, cycle stays ${ctx.min(k.cycle)}`, keep: true
        };
        if (k.cycle > ctx.car.cycle + 1e-9) return `That made ${bottName(k)} slower: the cycle went up to ${ctx.min(k.cycle)} min.`;
        if (Math.abs(k.cycle - target) > 1e-9) return `The cycle is still ${ctx.min(k.cycle)} min: ${bottName(k)} still sets the pace.`;
        return null;
      },
      widget: (el, ctx) => {
        const out = ctx.ui.note(el, '');
        const show = () => {
          const cfg = ctx.engine?.cfg || ctx.cfg; let k; try { k = carCost(cfg, ctx.R, ctx.up); } catch { return; }
          const n = changedOptions(ctx.cfg, cfg).length;
          out.set(`Order now: cycle <b class="cs-num">${ctx.min(k.cycle)} min</b> · slowest ${bottName(k)} · ${n === 1 ? '1 option' : n + ' options'} changed`);
        };
        const off = ctx.engine?.on?.('optionChanged', show); show();
        ctx.ui.buttons(el, [
          { label: 'Open the Order tab', onClick: () => ctx.app?.set?.({ tab: 'order' }) },
          { label: 'Back to the default car', onClick: () => ctx.engine?.setCfg?.({ ...ctx.cfg }) }
        ]);
        return () => off?.();
      }
    }
  ],
  checks: [
    {
      id: 'c1', kind: 'station',
      prompt: () => 'Tap the bottleneck: the station that sets the pace.',
      answer: ctx => ctx.car.bottAll,
      diagnose: (ctx, s) => `${STATIONS[s]} works ${ctx.min(ctx.car.m[s])} min, then waits ${ctx.min(ctx.car.bott - ctx.car.m[s])} min for the slowest station.`,
      step2: ctx => `Work minutes: ${ctx.car.m.map((x, i) => `${STATIONS[i]} ${ctx.min(x)}`).join(' · ')}. The bottleneck is the station with the most: <b>?</b>`,
      solution: ctx => `<b>${bottName(ctx.car)}, ${ctx.min(ctx.car.bott)} min.</b> Cycle = ${ctx.min(ctx.car.bott)} + ${ctx.min(ctx.R.moveMin)} move = ${ctx.min(ctx.car.cycle)} min.`,
      after: ctx => `${bottName(ctx.car)}, ${ctx.min(ctx.car.bott)} min: cycle ${ctx.min(ctx.car.bott)} + ${ctx.min(ctx.R.moveMin)} = ${ctx.min(ctx.car.cycle)} min.`
    },
    {
      id: 'c2', kind: 'numbers',
      prompt: ctx => `Seven operators are each paid for the whole ${ctx.min(ctx.car.cycle)}-minute cycle. Station labour per car? How much of it is waiting?`,
      fields: [
        {
          label: 'Station labour', unit: '$', answer: ctx => ctx.car.stationsPaid,
          distractors: [
            { id: 'touchOnly', value: ctx => ctx.car.touch, msg: ctx => `You paid only for minutes worked. The ${STATIONS[0]} operator works ${ctx.min(ctx.car.m[0])} min, waits ${ctx.min(ctx.car.bott - ctx.car.m[0])} for ${bottName(ctx.car)} and ${ctx.min(ctx.R.moveMin)} while the line moves.` },
            { id: 'withQc', value: ctx => ctx.car.crewCost, msg: 'That includes the QC & pack person; this question is about the seven station operators.' },
            { id: 'oneOp', value: ctx => ctx.car.cycle * ctx.R.labourPerMin, msg: 'That’s one operator.' }
          ]
        },
        {
          label: 'Of which waiting', unit: '$', answer: ctx => ctx.car.waiting,
          distractors: [
            { id: 'bottOnly', value: ctx => ctx.car.waitBott, msg: ctx => `That’s only the wait for ${bottName(ctx.car)}. Everyone also waits ${ctx.min(ctx.R.moveMin)} min while the line moves.` },
            { id: 'moveOnly', value: ctx => ctx.car.waitMove, msg: ctx => `That’s only the move. Most stations also wait for ${bottName(ctx.car)}.` }
          ]
        }
      ],
      step2: ctx => { const k = ctx.car, ops = k.crewAt.reduce((a, b) => a + b, 0); return `Paid: ${ops} × ${ctx.min(k.cycle)} min × ${rt(ctx, ctx.R.labourPerMin)} = ${ctx.$(k.stationsPaid)}. Worked: ${ctx.min(k.work)} min × ${rt(ctx, ctx.R.labourPerMin)} = ${ctx.$(k.touch)}. Waiting = ${ctx.$(k.stationsPaid)} − ${ctx.$(k.touch)} = <b>?</b>`; },
      solution: ctx => { const k = ctx.car; return `Station labour <b>${ctx.$(k.stationsPaid)}</b>, of which <b>${ctx.$(k.waiting)}</b> is waiting: ${ctx.$(k.waitBott)} for ${bottName(k)} + ${ctx.$(k.waitMove)} for moving. Line balance ${ctx.pct(k.balance)}.`; },
      after: ctx => { const k = ctx.car; return `Waiting = ${ctx.$(k.waitBott)} for ${bottName(k)} + ${ctx.$(k.waitMove)} for moving; <g t="line balance">line balance</g> ${ctx.pct(k.balance)}.`; }
    }
  ],
  twin: {
    id: 'twin', kind: 'numbers',
    prompt: ctx => `Station minutes ${L3_TWIN_M.map(x => ctx.min(x)).join('/')} (${ctx.min(sum(L3_TWIN_M))} worked). Cycle? Station labour? Waiting?`,
    fields: [
      { label: 'Cycle', unit: 'min', answer: ctx => lineFromMinutes(L3_TWIN_M, ctx.R).cycle, distractors: [{ id: 'noMove', value: ctx => lineFromMinutes(L3_TWIN_M, ctx.R).B, msg: ctx => `Add the ${ctx.min(ctx.R.moveMin)} min the line takes to move.` }] },
      { label: 'Station labour', unit: '$', answer: ctx => lineFromMinutes(L3_TWIN_M, ctx.R).paid, distractors: [{ id: 'touchOnly', value: ctx => lineFromMinutes(L3_TWIN_M, ctx.R).touch, msg: 'You paid only for minutes worked.' }] },
      { label: 'Waiting', unit: '$', answer: ctx => lineFromMinutes(L3_TWIN_M, ctx.R).waiting, distractors: [{ id: 'bottOnly', value: ctx => lineFromMinutes(L3_TWIN_M, ctx.R).waitBott, msg: 'Add the minutes everyone waits while the line moves.' }] }
    ],
    step2: ctx => { const t = lineFromMinutes(L3_TWIN_M, ctx.R); return `Slowest ${ctx.min(t.B)} + ${ctx.min(ctx.R.moveMin)} = ${ctx.min(t.cycle)} min. Paid ${t.ops} × ${ctx.min(t.cycle)} × ${rt(ctx, ctx.R.labourPerMin)} = <b>?</b>. Waiting = paid − ${ctx.min(t.work)} × ${rt(ctx, ctx.R.labourPerMin)} = <b>?</b>`; },
    solution: ctx => { const t = lineFromMinutes(L3_TWIN_M, ctx.R); return `Cycle <b>${ctx.min(t.cycle)} min</b>. Paid ${t.ops} × ${ctx.min(t.cycle)} × ${rt(ctx, ctx.R.labourPerMin)} = <b>${ctx.$(t.paid)}</b>. Worked ${ctx.$(t.touch)}, so waiting <b>${ctx.$(t.waiting)}</b>.`; }
  },
  explainBack: {
    prompt: 'Why didn’t oiled wood speed up the line?',
    model: ctx => { const o = kc(ctx, { finish: 'raw' }); return `Oiled wood made ${STATIONS[3]} faster, but its extra sanding made ${STATIONS[2]} ${ctx.min(o.m[2])} min, so ${STATIONS[2]} became the slowest station and the cycle stayed ${ctx.min(o.cycle)}.`; },
    ideas: [{ id: 'paintFaster', text: 'Paint got faster' }, { id: 'sandSlower', text: 'Sand got slower' }, { id: 'sandSlowest', text: 'Sand became the slowest' }]
  },
  rule: 'The slowest station sets the pace, and everyone is paid for the pace.',
  hint: ctx => `Paid minutes = ${ctx.car.crewAt.reduce((a, b) => a + b, 0)} operators × the cycle. Waiting = paid − worked.`,
  misconceptions: ['You only pay for the minutes people work.', 'Speeding up any station speeds up the line.']
};

/* ====================================================================================================== L4 */
const L4 = {
  id: 'L4', unit: 'A', title: 'The meter runs', minutes: 7, scored: true,
  goal: 'Complete the cost of a started car.',
  explain: ctx => { const k = ctx.car, R = ctx.R; return `While the line runs it costs money every minute: ${k.crew === 8 ? 'eight' : k.crew} people (seven operators plus the QC & pack person) at ${rt(ctx, R.labourPerMin)} each, and ${ctx.$(R.powerPerLineMin)} of power for the saws, sanders, spray booth and extraction. That’s ${ctx.$(k.lineRate)} a minute, whether a station is busy, waiting or empty. Each car also uses sandpaper, masking and glue: its <g t="consumables">consumables</g>.`; },
  setup: async ctx => { resetLine(ctx, { speed: 1, fill: true }); ctx.engine?.setQcSeed?.(ctx.R.scrapEvery); },
  worked: ctx => {
    const k = ctx.car, R = ctx.R;
    return [
      { label: 'Line meter', value: ctx.$(k.lineRate) + '/min', how: `${k.crew} people × ${rt(ctx, R.labourPerMin)} + ${ctx.$(R.powerPerLineMin)} power` },
      { label: 'One cycle of the meter', value: ctx.$(k.cycle * k.lineRate), how: `${ctx.min(k.cycle)} min × ${ctx.$(k.lineRate)} = ${ctx.$(k.crewCost)} crew + ${ctx.$(k.power)} power` },
      { label: 'Materials', value: ctx.$(k.materials), how: 'from L1' },
      { label: 'Crew', value: ctx.$(k.crewCost), how: `${k.crew} × ${ctx.min(k.cycle)} min × ${rt(ctx, R.labourPerMin)}` },
      { label: 'Power', value: ctx.$(k.power), how: `${ctx.min(k.cycle)} min × ${ctx.$(R.powerPerLineMin)}` },
      { label: 'Consumables', value: ctx.$(k.consumables), how: `sand ${ctx.$(R.consumables.sand)} + paint ${ctx.$(R.consumables.paint)} + detail ${ctx.$(R.consumables.detail)}` },
      { label: '<g t="started cost">Started car</g>', value: ctx.$(k.started), how: `${ctx.$(k.materials)} + ${ctx.$(k.crewCost)} + ${ctx.$(k.power)} + ${ctx.$(k.consumables)}` }
    ];
  },
  steps: [
    {
      // counts only after the learner presses Time one cycle: one full cycle runs between two moves of the line
      id: 'meter', on: ['cycle'],
      text: ctx => { const k = ctx.car, c = ctx.R.consumables; return `The HUD now shows the Line meter. Press <b>Time one cycle</b> and watch the line clock: ${ctx.min(k.cycle)} × ${ctx.$(k.lineRate)} = ${ctx.$(k.cycle * k.lineRate)} (${ctx.$(k.crewCost)} crew + ${ctx.$(k.power)} power). Each station’s float is everything it adds: ${STATIONS[2]} +${ctx.$(k.stationPost[2])} includes ${ctx.$(c.sand)} of sandpaper, ${STATIONS[3]} +${ctx.$(k.stationPost[3])} includes ${ctx.$(c.paint)} of masking, ${STATIONS[6]} +${ctx.$(k.stationPost[6])} includes ${ctx.$(c.detail)} of glue.`; },
      done: (ctx, e) => { if (!ctx.mem.timing) return false; if (e.phase === 'move') ctx.mem.moves = (ctx.mem.moves || 0) + 1; return (ctx.mem.moves || 0) >= 2; },
      widget: (el, ctx) => ctx.ui.buttons(el, [{
        label: 'Time one cycle', primary: true,
        onClick: () => {
          const e = ctx.engine; ctx.mem.timing = true; ctx.mem.moves = 0;
          if (!e) return;
          // a full line again, following the car at Wheels: it leaves the line as the timed cycle ends, so its
          // receipt reaches the exit just as step 2 asks about it
          e.setQcSeed?.(ctx.R.scrapEvery);
          const wos = refill(ctx), wo = wos[N_ST - 2];
          if (wo) e.followWo?.(wo);
        }
      }])
    },
    {
      id: 'fill',
      text: ctx => `The receipt reaches the line exit at ${ctx.$(ctx.car.started)}. Fill in its Power and Consumables lines.`,
      widget: (el, ctx) => {
        const k = ctx.car;
        return ctx.ui.blanks(el, {
          rows: [
            { label: 'Materials', value: k.materials, unit: '$' },
            { label: `Crew · ${k.crew} × ${ctx.min(k.cycle)} min`, value: k.crewCost, unit: '$' },
            {
              label: `Power · ${ctx.min(k.cycle)} min`, answer: k.power, unit: '$',
              how: `${ctx.min(k.cycle)} min × ${ctx.$(ctx.R.powerPerLineMin)} a minute = ${ctx.$(k.power)}`,
              slips: [
                { value: k.cycle * k.lineRate, msg: `That’s crew + power for one cycle. Power alone is ${ctx.min(k.cycle)} min × ${ctx.$(ctx.R.powerPerLineMin)}.` },
                { value: ctx.R.powerPerLineMin, msg: `That’s one minute of power. The line runs ${ctx.min(k.cycle)} min for each car.` }
              ]
            },
            {
              label: 'Consumables', answer: k.consumables, unit: '$',
              how: `sandpaper ${ctx.$(ctx.R.consumables.sand)} + masking ${ctx.$(ctx.R.consumables.paint)} + glue ${ctx.$(ctx.R.consumables.detail)} = ${ctx.$(k.consumables)}`,
              slips: [{ value: ctx.R.consumables.sand, msg: `That’s only the sandpaper at ${STATIONS[2]}. Add the masking at ${STATIONS[3]} and the glue at ${STATIONS[6]}.` }]
            },
            { label: 'Started car', value: k.started, unit: '$', total: true }
          ],
          onDone: () => ctx.complete('fill')
        });
      }
    },
    {
      id: 'alone', on: ['sent', 'parked', 'scrapped', 'lineIdle'],
      text: () => 'Now empty the line and send one car alone. Watch it reach the lot with the line standing idle.',
      done: (ctx, e) => {
        const m = ctx.mem, eng = ctx.engine;
        if (e.type === 'sent') { if (m.emptied && !m.loneWo) m.loneWo = e.wo; return false; }
        if ((e.type === 'parked' || e.type === 'scrapped') && e.wo === m.loneWo) m.loneParked = true;
        const idle = !eng || ((eng.lineUnits?.().length ?? 0) === 0 && (eng.queueLength?.() ?? 0) === 0);
        return !!m.loneParked && idle;
      },
      widget: (el, ctx) => ctx.ui.buttons(el, [
        { label: 'Empty the line', onClick: () => { ctx.engine?.emptyLine?.(); ctx.mem.emptied = true; ctx.mem.loneWo = null; ctx.mem.loneParked = false; } },
        { label: 'Send one car', primary: true, onClick: () => { if (!ctx.mem.emptied) { ctx.engine?.emptyLine?.(); ctx.mem.emptied = true; } ctx.engine?.setQcSeed?.(ctx.R.scrapEvery); ctx.mem.loneWo = null; ctx.mem.loneParked = false; const wo = sendAndFollow(ctx); if (wo) ctx.mem.loneWo = wo; } }
      ])
    },
    {
      id: 'loneQ',
      text: () => 'The lone-car question.',
      check: {
        id: 'lone', kind: 'number', unit: '$',
        prompt: ctx => `The line ran ${ctx.min(loneMinutes(ctx))} minutes to make this one car. What did crew and power cost?`,
        answer: ctx => loneMinutes(ctx) * lineRate(ctx),
        distractors: [
          { id: 'fullLineShare', value: ctx => ctx.car.crewCost + ctx.car.power, msg: 'That’s this car’s share on a full line.' },
          { id: 'noPower', value: ctx => loneMinutes(ctx) * ctx.car.crew * ctx.R.labourPerMin, msg: 'Add the power.' },
          { id: 'onePerson', value: ctx => loneMinutes(ctx) * ctx.R.labourPerMin, msg: 'That’s one person.' }
        ],
        step2: ctx => `${ctx.min(loneMinutes(ctx))} min × the meter ${ctx.$(lineRate(ctx))} = <b>?</b>`,
        solution: ctx => { const share = ctx.car.crewCost + ctx.car.power, all = loneMinutes(ctx) * lineRate(ctx); return `${ctx.min(loneMinutes(ctx))} min × ${ctx.$(lineRate(ctx))} = <b>${ctx.$(all)}</b>. ${ctx.$(share)} went on the car’s tab; <b>${ctx.$(all - share)}</b> went to <g t="idle line">Idle line</g>.`; },
        after: ctx => { const share = ctx.car.crewCost + ctx.car.power, all = loneMinutes(ctx) * lineRate(ctx); return `${ctx.$(share)} went on the car’s tab; <b>${ctx.$(all - share)}</b> went to <g t="idle line">Idle line</g>.`; }
      }
    }
  ],
  checks: [
    {
      id: 'c1', kind: 'number', unit: '$',
      prompt: ctx => { const c = kc(ctx, L4_CHECKER); return `A ${CATALOG.livery.checker.label} with a race number makes ${STATIONS[4]} ${ctx.min(c.m[4])} min, so the cycle becomes ${ctx.min(c.cycle)}. How much more do crew and power cost per car?`; },
      answer: ctx => { const c = kc(ctx, L4_CHECKER); return (c.crewCost + c.power) - (ctx.car.crewCost + ctx.car.power); },
      distractors: [
        { id: 'oneOperator', value: ctx => (kc(ctx, L4_CHECKER).cycle - ctx.car.cycle) * ctx.R.labourPerMin, msg: ctx => `Only the ${STATIONS[4]} operator? All ${ctx.car.crew === 8 ? 'eight' : ctx.car.crew} people are held for that extra minute.` },
        { id: 'noPower', value: ctx => kc(ctx, L4_CHECKER).crewCost - ctx.car.crewCost, msg: 'The booth and extraction kept running: add power.' },
        { id: 'withInk', value: ctx => kc(ctx, L4_CHECKER).started - ctx.car.started, msg: ctx => `That includes ${ctx.$(kc(ctx, L4_CHECKER).materials - ctx.car.materials)} more ink; this asks about crew and power only.` }
      ],
      step2: ctx => { const c = kc(ctx, L4_CHECKER); return `The cycle grows ${ctx.min(c.cycle - ctx.car.cycle)} min. Each minute costs the whole meter, ${ctx.car.crew} × ${rt(ctx, ctx.R.labourPerMin)} + ${ctx.$(ctx.R.powerPerLineMin)} = ${ctx.$(lineRate(ctx))}. ${ctx.min(c.cycle - ctx.car.cycle)} × ${ctx.$(lineRate(ctx))} = <b>?</b>`; },
      solution: ctx => { const c = kc(ctx, L4_CHECKER); return `${ctx.min(c.cycle - ctx.car.cycle)} min × ${ctx.$(lineRate(ctx))} = <b>${ctx.$((c.cycle - ctx.car.cycle) * lineRate(ctx))}</b>: ${ctx.$(c.crewCost - ctx.car.crewCost)} crew + ${ctx.$(c.power - ctx.car.power)} power.`; }
    }
  ],
  twin: {
    id: 'twin', kind: 'number', unit: '$',
    prompt: ctx => `A change adds ${ctx.min(L4_TWIN_EXTRA)} min to the bottleneck. Extra crew and power per car?`,
    answer: ctx => L4_TWIN_EXTRA * lineRate(ctx),
    distractors: [
      { id: 'noPower', value: ctx => L4_TWIN_EXTRA * ctx.car.crew * ctx.R.labourPerMin, msg: 'Add the power.' },
      { id: 'oneOperator', value: ctx => L4_TWIN_EXTRA * ctx.R.labourPerMin, msg: 'Only one operator? The whole line waits for the bottleneck.' }
    ],
    step2: ctx => `${ctx.min(L4_TWIN_EXTRA)} min × ${ctx.$(lineRate(ctx))} = <b>?</b>`,
    solution: ctx => `${ctx.min(L4_TWIN_EXTRA)} min × ${ctx.$(lineRate(ctx))} = <b>${ctx.$(L4_TWIN_EXTRA * lineRate(ctx))}</b>.`
  },
  explainBack: {
    prompt: 'Why did one car alone cost so much?',
    model: ctx => `Everyone on the line is paid while it runs, and for most of those ${ctx.min(loneMinutes(ctx))} minutes the other stations stood empty, so the car’s tab carried only ${ctx.$(ctx.car.crewCost + ctx.car.power)} of the ${ctx.$(loneMinutes(ctx) * lineRate(ctx))}.`,
    ideas: [{ id: 'paidWhileRunning', text: 'Everyone is paid while the line runs' }, { id: 'emptyStations', text: 'Stations stood empty' }]
  },
  rule: ctx => `A running line costs ${ctx.$(ctx.car.lineRate)} a minute, full or empty.`,
  hint: ctx => `Every extra cycle minute costs the whole meter: ${ctx.car.crew} × ${rt(ctx, ctx.R.labourPerMin)} + ${ctx.$(ctx.R.powerPerLineMin)}.`,
  misconceptions: ['Forgetting overhead.', 'Power only counts while a machine is cutting.', 'An empty station costs nothing.']
};

/* ====================================================================================================== L5 */
// Start the line: the QC seed (the 3rd car to reach QC fails), a full line kept fed, and the camera on the car just
// behind the one that fails. It is the 4th to reach QC, so it passes and the learner can follow it to the truck.
function startL5(ctx) {
  const e = ctx.engine, m = ctx.mem; m.started = true;
  if (!e) return;
  e.setQcSeed?.(L5_QC_SEED);
  const wos = refill(ctx);
  m.keep ||= ctx.keepLine?.(ctx.cfg);
  const wo = wos[N_ST - 1 - L5_QC_SEED];
  if (wo) { (m.followed ||= new Set()).add(wo); m.followWo = wo; e.followWo?.(wo); }
}
// Follow a good car: one that passed QC and is still on its way to the truck; else the next car through QC; and on an
// idle line, a car sent now (clear of the next QC fail). The button always leads to a car the learner can follow.
function followGoodCar(ctx) {
  const e = ctx.engine, m = ctx.mem; if (!e) return;
  m.followed ||= new Set();
  let cars = []; try { cars = e.cars?.() || []; } catch { }
  const onWay = [...(m.passed || [])].reverse().map(wo => cars.find(c => c && c.wo === wo)).find(c => c && !c.scrapped && ['exit', 'lot', 'crane', 'carton'].includes(c.place));
  if (onWay) { m.followed.add(onWay.wo); m.followWo = onWay.wo; e.followWo?.(onWay.wo); return; }
  if ((e.lineUnits?.().length || 0) + (e.queueLength?.() || 0) > 0) { m.followNext = true; m.followWo = null; return; }
  e.setQcSeed?.(ctx.R.scrapEvery);
  const wo = sendAndFollow(ctx);
  if (wo) { m.followed.add(wo); m.followWo = wo; }
}
const L5 = {
  id: 'L5', unit: 'A', title: 'One in twenty', minutes: 6, scored: true,
  goal: 'The scrap allowance, and which costs land only on good cars.',
  explain: ctx => { const N = ctx.R.scrapEvery; return `One car in every ${N === 20 ? 'twenty' : N} fails the final check and goes in the <g t="scrap">scrap</g> crate, and everything spent on it is lost. So ${N - 1} good cars must pay for ${N} started: each good car carries its own cost × ${N} ÷ ${N - 1}. The extra is its <g t="scrap allowance">scrap allowance</g>. Cartons and freight are different, because only good cars get a box and a truck ride.`; },
  // an empty line: it starts when the learner presses Start the line (step 1), so the QC fail happens while they watch
  setup: async ctx => resetLine(ctx, { speed: 2 }),
  worked: ctx => {
    const k = ctx.car, N = ctx.R.scrapEvery;
    return [
      { label: 'Started car', value: ctx.$(k.started), how: 'from L4' },
      { label: 'Share of scrap', value: ctx.$(k.scrapShare), how: `${ctx.$(k.started)} ÷ ${N - 1}` },
      { label: 'Good car', value: ctx.$(k.good), how: `${ctx.$(k.started)} × ${N} ÷ ${N - 1}` },
      { label: 'Carton', value: ctx.$(k.carton), how: 'good cars only' },
      { label: 'Freight', value: ctx.$(k.freight), how: 'good cars only' },
      { label: 'To the door', value: ctx.$(k.variable), how: `${ctx.$(k.good)} + ${ctx.$(k.carton)} + ${ctx.$(k.freight)}` }
    ];
  },
  steps: [
    {
      id: 'fail', on: ['scrapped'],
      text: ctx => `Press <b>Start the line</b>. The QC check is set so the ${ordinal(L5_QC_SEED)} car to reach it fails. Watch for the red QC FAIL tag: the car rolls into the scrap crate, and its ${ctx.$(ctx.car.started)} shows in the crate’s SCRAP total.`,
      done: (ctx, e) => { if (!ctx.mem.started) return false; ctx.mem.failedWo = e.wo; return true; },
      widget: (el, ctx) => ctx.ui.buttons(el, [{ label: 'Start the line', primary: true, onClick: () => startL5(ctx) }])
    },
    {
      id: 'loaded', on: ['followed', 'scrapShare', 'shipped'],
      text: ctx => `Every good car carries a ${ctx.$(ctx.car.scrapShare)} scrap allowance, charged at QC, because on average 1 car in ${ctx.R.scrapEvery} fails. Follow a good car to packing (+${ctx.$(ctx.car.carton)} carton) and onto the truck (+${ctx.$(ctx.car.freight)} freight): <b>${ctx.$(ctx.car.variable)} to the door</b>.`,
      done: (ctx, e) => {
        const m = ctx.mem; m.followed ||= new Set();
        if (e.type === 'followed') { if (e.car && !e.car.scrapped) m.followed.add(e.car.wo); return false; }
        if (e.type === 'scrapShare') {
          (m.passed ||= []).push(e.wo);
          if (m.followNext && !m.followWo) { m.followNext = false; m.followWo = e.wo; m.followed.add(e.wo); ctx.engine?.followWo?.(e.wo); }
          return false;
        }
        return m.followed.has(e.wo);   // only a car followed during this lesson counts, not one still tracked from before
      },
      widget: (el, ctx) => ctx.ui.buttons(el, [{ label: 'Follow a good car', onClick: () => followGoodCar(ctx) }])
    }
  ],
  checks: [
    {
      id: 'c1', kind: 'number', unit: '$',
      prompt: ctx => `1 in ${ctx.R.scrapEvery} started cars is scrapped, and a started car costs ${ctx.$(ctx.car.started)}. What must each good car carry before boxing?`,
      answer: ctx => ctx.car.good,
      distractors: [
        { id: 'addPercent', value: ctx => ctx.car.started * (1 + 1 / ctx.R.scrapEvery), msg: ctx => `You added ${pct0(1 / ctx.R.scrapEvery)}. Scrapped cars don’t come back: you make ${ctx.R.scrapEvery} to sell ${ctx.R.scrapEvery - 1}.` },
        { id: 'partsOnly', value: ctx => ctx.car.started + ctx.car.materials / (ctx.R.scrapEvery - 1), msg: 'You counted only the scrapped car’s parts; it also used a full cycle of crew and power.' },
        { id: 'shareOnly', value: ctx => ctx.car.scrapShare, msg: 'That’s the share; the question asks for the total.' }
      ],
      step2: ctx => `Make ${ctx.R.scrapEvery}, sell ${ctx.R.scrapEvery - 1}: ${ctx.$(ctx.car.started)} × ${ctx.R.scrapEvery} ÷ ${ctx.R.scrapEvery - 1} = <b>?</b>`,
      solution: ctx => `${ctx.R.scrapEvery} started cars cost ${ctx.$(ctx.car.started * ctx.R.scrapEvery)}, shared by ${ctx.R.scrapEvery - 1} good ones: ÷ ${ctx.R.scrapEvery - 1} = <b>${ctx.$(ctx.car.good)}</b>. The share of scrap is ${ctx.$(ctx.car.scrapShare)}.`
    },
    {
      id: 'c2', kind: 'choice',
      prompt: () => 'Why isn’t the carton marked up for scrap?',
      options: ctx => [
        { text: 'A scrapped car never gets a carton.', correct: true, why: 'Cartons and freight are spent only on good cars.' },
        { text: 'Cartons are too cheap to matter.', correct: false, why: `Even ${ctx.$(ctx.car.carton)} a car adds up over a month. Think about which cars get one.` },
        { text: 'Cartons are a fixed cost.', correct: false, why: 'A carton comes with each good car, so it rises and falls with the cars you make.' },
        { text: 'The shop pays for the carton.', correct: false, why: 'The factory buys the cartons. Think about which cars get one.' }
      ],
      solution: () => '<b>A scrapped car never gets a carton.</b> The scrap crate is before packing, so only good cars use a carton and a truck ride.'
    }
  ],
  twin: {
    id: 'twin', kind: 'number', unit: '$',
    prompt: ctx => `1 in ${L5_TWIN.every} started cars is scrapped, and a started car costs ${ctx.$(L5_TWIN.started)}. What must each good car carry before boxing?`,
    answer: () => L5_TWIN.started * L5_TWIN.every / (L5_TWIN.every - 1),
    distractors: [
      { id: 'addPercent', value: () => L5_TWIN.started * (1 + 1 / L5_TWIN.every), msg: () => `You added ${pct0(1 / L5_TWIN.every)}.` },
      { id: 'shareOnly', value: () => L5_TWIN.started / (L5_TWIN.every - 1), msg: 'That’s the share; the question asks for the total.' }
    ],
    step2: ctx => `Make ${L5_TWIN.every}, sell ${L5_TWIN.every - 1}: ${ctx.$(L5_TWIN.started)} × ${L5_TWIN.every} ÷ ${L5_TWIN.every - 1} = <b>?</b>`,
    solution: ctx => `${ctx.$(L5_TWIN.started)} × ${L5_TWIN.every} ÷ ${L5_TWIN.every - 1} = <b>${ctx.$(L5_TWIN.started * L5_TWIN.every / (L5_TWIN.every - 1))}</b>.`
  },
  explainBack: {
    prompt: ctx => `Why × ${ctx.R.scrapEvery} ÷ ${ctx.R.scrapEvery - 1} and not + ${pct0(1 / ctx.R.scrapEvery)}?`,
    model: ctx => `Scrapped cars don’t come back: you make ${ctx.R.scrapEvery} to sell ${ctx.R.scrapEvery - 1}, and the whole cost of the failed car is lost, so the ${ctx.R.scrapEvery - 1} good cars share the cost of all ${ctx.R.scrapEvery}.`,
    ideas: [{ id: 'made', text: '20 made' }, { id: 'sold', text: '19 sold' }, { id: 'wholeCost', text: 'The whole cost is lost' }]
  },
  rule: ctx => `Good cars pay for the scrapped ones: started cost × ${ctx.R.scrapEvery} ÷ ${ctx.R.scrapEvery - 1}.`,
  hint: ctx => `Make ${ctx.R.scrapEvery}, sell ${ctx.R.scrapEvery - 1}: the cost of ${ctx.R.scrapEvery} ÷ ${ctx.R.scrapEvery - 1}.`,
  misconceptions: ['Scrap = add the percentage.', 'Scrap only wastes material.']
};

/* ====================================================================================================== L6 */
const L6 = {
  id: 'L6', unit: 'A', title: 'What does an option really cost?', minutes: 7, scored: true,
  goal: 'Price an option as its parts plus any minutes it adds to the cycle.',
  // the cycle test (SPEC appendix 2026-10-16): only the minutes an option adds to the cycle cost the line meter
  explain: ctx => `An option costs its parts plus the minutes it adds to the <g t="cycle">cycle</g>. If the cycle doesn’t change, the extra work fits in time people already spend waiting, so only the parts count. If it does, the whole line meter (${ctx.$(ctx.car.lineRate)} a minute) pays for the extra cycle minutes: only the minutes past the old slowest station.`,
  setup: async ctx => { resetLine(ctx, { speed: 1, fill: true }); ctx.keepLine?.(ctx.cfg); },
  // worked on an option no step, check or twin uses: the Light bar on the default car
  worked: ctx => {
    const lb = kc(ctx, L6_WORKED), k = ctx.car, r = CATALOG.roof[L6_WORKED.roof], none = CATALOG.roof[ctx.cfg.roof];
    return [
      { label: `${r.label} parts`, value: '+' + ctx.$(lb.materials - k.materials), how: `${ctx.$(r.price)} − no roof ${ctx.$(none.price)}` },
      { label: `${STATIONS[6]} minutes`, value: `${ctx.min(k.m[6])} → ${ctx.min(lb.m[6])}`, how: `+${ctx.min(lb.m[6] - k.m[6])} min at ${STATIONS[6]}` },
      { label: 'Cycle', value: `${ctx.min(k.cycle)} → ${ctx.min(lb.cycle)} (${r.label} ties ${bottName(k)})`, how: `slowest ${bottName(k)} ${ctx.min(k.bott)} → ${bottName(lb)} ${ctx.min(lb.bott)}, so the cycle stays ${ctx.min(lb.cycle)} min` },
      { label: 'Extra per started car', value: '+' + ctx.$(lb.started - k.started), how: `parts ${ctx.$(lb.materials - k.materials)} + ${ctx.min(lb.cycle - k.cycle)} min × ${ctx.$(k.lineRate)}` }
    ];
  },
  steps: [
    {
      id: 'ab1',
      text: ctx => { const w = CATALOG.wheels; return `Predict, then compare: the default car with ${w.classic.label} vs ${w.whitewall.label} wheels. ${w.whitewall.label} adds ${ctx.$(w.whitewall.price - w.classic.price)} of parts and ${ctx.min(w.whitewall.min - w.classic.min)} min at ${STATIONS[5]}.`; },
      widget: (el, ctx) => ctx.ui.ab(el, {
        a: { label: `Gloss · ${CATALOG.wheels.classic.label}`, cfg: { ...ctx.cfg, wheels: 'classic' } },
        b: { label: `Gloss · ${CATALOG.wheels.whitewall.label}`, cfg: { ...ctx.cfg, wheels: 'whitewall' } },
        prompt: 'Your guess: how much more does B cost to start?',
        onDone: () => ctx.complete('ab1')
      })
    },
    {
      id: 'ab2',
      text: ctx => `Now the satin car: ${CATALOG.wheels.classic.label} vs ${CATALOG.wheels.whitewall.label}.`,
      widget: (el, ctx) => ctx.ui.ab(el, {
        a: { label: `Satin · ${CATALOG.wheels.classic.label}`, cfg: { ...ctx.cfg, finish: 'satin', wheels: 'classic' } },
        b: { label: `Satin · ${CATALOG.wheels.whitewall.label}`, cfg: { ...ctx.cfg, finish: 'satin', wheels: 'whitewall' } },
        prompt: 'Your guess: how much more does B cost to start?',
        onDone: () => ctx.complete('ab2')
      })
    },
    {
      // the partial-minute case, met before the twin: Detail grows a full minute but passes Paint by only half of it
      id: 'ab3',
      text: ctx => { const r = CATALOG.roof[L6_AB3.roof]; return `One more: the default car with no roof vs a ${r.label} (+${ctx.$(r.price)} of parts, +${ctx.min(r.min)} min at ${STATIONS[6]}).`; },
      widget: (el, ctx) => ctx.ui.ab(el, {
        a: { label: `Gloss · no roof`, cfg: { ...ctx.cfg } },
        b: { label: `Gloss · ${CATALOG.roof[L6_AB3.roof].label}`, cfg: { ...ctx.cfg, ...L6_AB3 } },
        prompt: 'Your guess: how much more does B cost to start?',
        onDone: () => ctx.complete('ab3')
      })
    }
  ],
  checks: [
    {
      id: 'c1', kind: 'numbers',
      prompt: ctx => { const w = CATALOG.wheels; return `${w.whitewall.label} adds ${ctx.$(w.whitewall.price - w[ctx.cfg.wheels].price)} of parts and ${ctx.min(w.whitewall.min - w[ctx.cfg.wheels].min)} min at ${STATIONS[5]}. Extra cost per started car on (a) the gloss car, (b) the satin car?`; },
      fields: [
        {
          label: '(a) Gloss car', unit: '$', answer: ctx => kc(ctx, { wheels: 'whitewall' }).started - ctx.car.started,
          distractors: [{ id: 'chargedCycle', value: ctx => { const ww = CATALOG.wheels.whitewall, cl = CATALOG.wheels[ctx.cfg.wheels]; return ww.price - cl.price + (ww.min - cl.min) * ctx.car.lineRate; }, msg: ctx => `On the gloss car ${STATIONS[5]} only reaches ${ctx.min(kc(ctx, { wheels: 'whitewall' }).m[5])} and ties ${bottName(ctx.car)}: the cycle doesn’t change, so only the parts count.` }]
        },
        {
          label: '(b) Satin car', unit: '$', answer: ctx => kc(ctx, { finish: 'satin', wheels: 'whitewall' }).started - kc(ctx, { finish: 'satin' }).started,
          distractors: [
            { id: 'onePrice', value: ctx => CATALOG.wheels.whitewall.price - CATALOG.wheels[ctx.cfg.wheels].price, msg: 'One price per option? Not when it moves the bottleneck.' },
            { id: 'wheelOperator', value: ctx => { const ww = CATALOG.wheels.whitewall, cl = CATALOG.wheels[ctx.cfg.wheels]; return ww.price - cl.price + (ww.min - cl.min) * ctx.R.labourPerMin; }, msg: 'You charged only the wheel operator’s half minute.' }
          ]
        }
      ],
      step2: ctx => { const s = kc(ctx, { finish: 'satin' }), sw = kc(ctx, { finish: 'satin', wheels: 'whitewall' }); return `(a) Does the gloss car’s cycle change? ${ctx.min(ctx.car.cycle)} → ${ctx.min(kc(ctx, { wheels: 'whitewall' }).cycle)}. (b) The satin car’s cycle goes ${ctx.min(s.cycle)} → ${ctx.min(sw.cycle)}: ${ctx.$(sw.materials - s.materials)} + ${ctx.min(sw.cycle - s.cycle)} × ${ctx.$(s.lineRate)} = <b>?</b>`; },
      solution: ctx => { const ww = kc(ctx, { wheels: 'whitewall' }), s = kc(ctx, { finish: 'satin' }), sw = kc(ctx, { finish: 'satin', wheels: 'whitewall' }); return `(a) <b>${ctx.$(ww.started - ctx.car.started)}</b>: ${STATIONS[5]} reaches ${ctx.min(ww.m[5])} and ties ${bottName(ctx.car)}, so the cycle is unchanged. (b) <b>${ctx.$(sw.started - s.started)}</b>: the cycle goes ${ctx.min(s.cycle)} → ${ctx.min(sw.cycle)}, so ${ctx.$(sw.materials - s.materials)} + ${ctx.min(sw.cycle - s.cycle)} × ${ctx.$(s.lineRate)}.`; },
      after: ctx => { const ww = kc(ctx, { wheels: 'whitewall' }), s = kc(ctx, { finish: 'satin' }), sw = kc(ctx, { finish: 'satin', wheels: 'whitewall' }); return `(a) ${STATIONS[5]} reaches ${ctx.min(ww.m[5])} and ties ${bottName(ctx.car)}, so the cycle is unchanged. (b) The cycle goes ${ctx.min(s.cycle)} → ${ctx.min(sw.cycle)}: ${ctx.$(sw.materials - s.materials)} + ${ctx.min(sw.cycle - s.cycle)} × ${ctx.$(s.lineRate)}.`; }
    }
  ],
  twin: {
    id: 'twin', kind: 'number', unit: '$',
    prompt: ctx => { const r = CATALOG.roof.rack; return `${r.label}: +${ctx.$(r.price)} parts, +${ctx.min(r.min)} min at ${STATIONS[6]}, on the default car?`; },
    answer: ctx => kc(ctx, L6_TWIN).started - ctx.car.started,
    distractors: [
      { id: 'onePrice', value: () => CATALOG.roof.rack.price, msg: ctx => `${STATIONS[6]} grows to ${ctx.min(kc(ctx, L6_TWIN).m[6])} min, past ${bottName(ctx.car)}’s ${ctx.min(ctx.car.bott)}, so the cycle goes up too.` },
      { id: 'detailOperator', value: ctx => CATALOG.roof.rack.price + CATALOG.roof.rack.min * ctx.R.labourPerMin, msg: `You charged only the ${STATIONS[6]} operator. When the cycle grows, the whole line meter pays for the extra cycle minutes.` },
      { id: 'wholeMinute', value: ctx => CATALOG.roof.rack.price + CATALOG.roof.rack.min * ctx.car.lineRate, msg: ctx => { const r = kc(ctx, L6_TWIN); return `Only the cycle minutes count: ${STATIONS[6]} reaches ${ctx.min(r.m[6])}, just ${ctx.min(r.cycle - ctx.car.cycle)} past ${bottName(ctx.car)}’s ${ctx.min(ctx.car.bott)}, so the cycle goes ${ctx.min(ctx.car.cycle)} → ${ctx.min(r.cycle)}.`; } }
    ],
    step2: ctx => { const r = kc(ctx, L6_TWIN); return `${STATIONS[6]} ${ctx.min(ctx.car.m[6])} → ${ctx.min(r.m[6])}, so the cycle goes ${ctx.min(ctx.car.cycle)} → ${ctx.min(r.cycle)}. ${ctx.$(CATALOG.roof.rack.price)} + ${ctx.min(r.cycle - ctx.car.cycle)} × ${ctx.$(ctx.car.lineRate)} = <b>?</b>`; },
    solution: ctx => { const r = kc(ctx, L6_TWIN); return `${STATIONS[6]} reaches ${ctx.min(r.m[6])}, so the cycle goes ${ctx.min(ctx.car.cycle)} → ${ctx.min(r.cycle)}: ${ctx.$(CATALOG.roof.rack.price)} + ${ctx.min(r.cycle - ctx.car.cycle)} × ${ctx.$(ctx.car.lineRate)} = <b>${ctx.$(r.started - ctx.car.started)}</b>.`; },
    after: ctx => { const r = kc(ctx, L6_TWIN); return `${STATIONS[6]} reaches ${ctx.min(r.m[6])}, ${ctx.min(r.cycle - ctx.car.cycle)} past ${bottName(ctx.car)}, so the cycle goes ${ctx.min(ctx.car.cycle)} → ${ctx.min(r.cycle)}: ${ctx.$(CATALOG.roof.rack.price)} + ${ctx.min(r.cycle - ctx.car.cycle)} × ${ctx.$(ctx.car.lineRate)}.`; }
  },
  takeaways: ctx => {
    const s = kc(ctx, { finish: 'satin' }), c = kc(ctx, L4_CHECKER), f = CATALOG.finish;
    return [
      `${f.gloss.label.split(' ')[0]} → ${f.satin.label} saves <b>${ctx.$(ctx.car.started - s.started)}</b> per started car (${ctx.$(ctx.car.variable - s.variable)} per car sold), and only ${ctx.$(f.gloss.coat - f.satin.coat)} of that is lacquer.`,
      `A ${CATALOG.livery.checker.label} costs ${ctx.$(c.materials - ctx.car.materials)} more ink and ${ctx.$(c.started - ctx.car.started - (c.materials - ctx.car.materials))} more time.`
    ];
  },
  explainBack: {
    prompt: 'Why does the same wheel cost more on the satin car?',
    model: ctx => { const s = kc(ctx, { finish: 'satin' }), sw = kc(ctx, { finish: 'satin', wheels: 'whitewall' }); return `On the satin car the slowest stations take ${ctx.min(s.bott)} min, so ${CATALOG.wheels.whitewall.label}’s ${ctx.min(sw.m[5])} min at ${STATIONS[5]} becomes the slowest and the cycle grows ${ctx.min(sw.cycle - s.cycle)} min; the whole line meter pays for those extra cycle minutes.`; },
    ideas: [{ id: 'wheelsSlowest', text: 'On the satin car, Wheels becomes the slowest' }, { id: 'wholeLine', text: 'The whole line pays the extra half minute' }]
  },
  rule: 'An option costs its parts + extra cycle minutes × the line meter.',
  hint: 'Does the cycle change? If not, only the parts count. If it does, the meter pays for the extra cycle minutes.',
  misconceptions: ['Each option has one add-on price.', 'Cheap ink means a cheap option.']
};

/* ====================================================================================================== wrap-up */
const cheapestSample = ctx => SAMPLE_CARS.map(s => ({ ...s, k: carCost(s.cfg, ctx.R, ctx.up) })).reduce((a, b) => b.k.started < a.k.started - 1e-9 ? b : a);
const UA = {
  id: 'UA', unit: 'A', title: 'Unit A wrap-up', short: 'Wrap-up', minutes: 5, scored: false, layers: 'L6',
  goal: 'Find the cheapest parked car, then fill a cost sheet on your own.',
  explain: () => 'Seven sample cars are parked in the lot. Everything from Unit A works on any of them: parts, minutes, the slowest station, the meter and the consumables.',
  setup: async ctx => { const e = ctx.engine; e?.setStopped?.(false); e?.setCamera?.('overview'); e?.setCfg?.({ ...ctx.cfg }); },
  steps: [
    {
      id: 'pick', text: () => 'Pick the cheapest car to make.',
      check: {
        id: 'cheapest', kind: 'car',
        prompt: () => 'Which parked car is cheapest to make (<g t="started cost">started cost</g>)? Tap it in the lot.',
        answer: ctx => { const best = cheapestSample(ctx); return car => !!car?.cfg && sameCar(car.cfg, best.cfg) && (car.cfg.color || '').toUpperCase() === best.cfg.color.toUpperCase(); },
        diagnose: (ctx, car) => { if (!car?.cfg) return 'Tap one of the parked cars.'; let k; try { k = carCost(car.cfg, ctx.R, ctx.up); } catch { return 'Tap one of the parked cars.'; } return `That one costs ${ctx.$(k.started)} to start: ${ctx.$(k.materials)} of parts and a ${ctx.min(k.cycle)}-minute cycle. Look for fewer parts and a short cycle.`; },
        step2: ctx => `Started cost = parts + ${ctx.car.crew} people × cycle × ${rt(ctx, ctx.R.labourPerMin)} + power + consumables. Cheap parts and no slow station win. Which car has no paint at all?`,
        solution: ctx => { const b = cheapestSample(ctx); return `The <b>${b.name}</b>: ${ctx.$(b.k.started)} to start. ${CATALOG.finish.raw.label} needs no paint, and its ${list(['wheels', 'bumpers'])} are cheap wood, so its parts come to ${ctx.$(b.k.materials)} on a ${ctx.min(b.k.cycle)}-minute cycle.`; },
        after: ctx => { const b = cheapestSample(ctx); return `The ${b.name}: ${ctx.$(b.k.materials)} of parts, a ${ctx.min(b.k.cycle)}-minute cycle, ${ctx.$(b.k.started)} started.`; }
      }
    },
    {
      id: 'sheet',
      text: ctx => { const s = SAMPLE_CARS[(ctx.seed ?? 0) % SAMPLE_CARS.length]; return `Free practice: fill a blank cost sheet for the ${s.name}. Each line is checked on its own; nothing is scored.`; },
      widget: (el, ctx) => {
        const s = SAMPLE_CARS[(ctx.seed ?? 0) % SAMPLE_CARS.length], k = carCost(s.cfg, ctx.R, ctx.up), R = ctx.R;
        ctx.ui.note(el, `<b>${s.name}</b> parts: ${k.parts.flat().map(x => `${x.label.toLowerCase()} ${ctx.$(x.value)}`).join(', ')}. Minutes: ${k.m.map((x, i) => `${STATIONS[i]} ${ctx.min(x)}`).join(' · ')}.`);
        return ctx.ui.blanks(el, {
          reveal: true,
          rows: [
            { label: 'Materials', answer: k.materials, unit: '$', how: k.parts.flat().map(x => ctx.$(x.value)).join(' + ') },
            { label: 'Cycle', answer: k.cycle, unit: 'min', how: `slowest ${ctx.min(k.bott)} + ${ctx.min(R.moveMin)} move` },
            { label: 'Crew', answer: k.crewCost, unit: '$', how: `${k.crew} people × ${ctx.min(k.cycle)} min × ${rt(ctx, R.labourPerMin)}` },
            { label: 'Power', answer: k.power, unit: '$', how: `${ctx.min(k.cycle)} min × ${ctx.$(R.powerPerLineMin)}` },
            { label: 'Consumables', answer: k.consumables, unit: '$', how: `${ctx.$(R.consumables.sand)} + ${ctx.$(R.consumables.paint)} + ${ctx.$(R.consumables.detail)}` },
            { label: 'Started car', answer: k.started, unit: '$', total: true, how: `${ctx.$(k.materials)} + ${ctx.$(k.crewCost)} + ${ctx.$(k.power)} + ${ctx.$(k.consumables)}` }
          ],
          onDone: () => ctx.complete('sheet')
        });
      }
    }
  ],
  hint: 'Started cost = materials + crew + power + consumables. The slowest station sets the cycle.'
};

export const LESSONS_A = [L0, L1, L2, L3, L4, L5, L6, UA];
// for tools/check-course.mjs: the inputs the twins and setups use
export const _internals = { NAVY, L1_VAN, L2_TWIN, L3_TWIN_M, L4_CHECKER, L4_TWIN_EXTRA, L5_QC_SEED, L5_TWIN, L6_TWIN, L6_WORKED, L6_AB3, cheapestSample, loneMinutes };
