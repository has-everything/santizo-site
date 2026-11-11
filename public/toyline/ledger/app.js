// Shared app state: one small store every module reads and the integrator wires to the engine (docs/CONTRACTS.md).
import { rules, NO_UPGRADES } from './econ.js';

// Layers in the order the course switches them on (SPEC §4.2).
export const LAYER_ORDER = [
  ['cycle', 'L0'], ['prices', 'L1'], ['materials', 'L1'], ['minutes', 'L2'], ['wait', 'L3'], ['meter', 'L4'],
  ['scrap', 'L5'], ['deltas', 'L6'], ['ledger', 'L7'], ['volume', 'L8'], ['breakeven', 'L9'], ['markup', 'L10'],
  ['price', 'L11'], ['bank', 'L12']
];
const LESSON_N = id => (/^L(\d+)$/.exec(id || '') || [0, -1])[1] * 1;
// Every layer up to and including the lesson's own; null = none, 'all' = every layer.
export function layersUpTo(id) {
  const n = id === 'all' ? Infinity : id === null ? -1 : LESSON_N(id);
  return Object.fromEntries(LAYER_ORDER.map(([k, l]) => [k, LESSON_N(l) <= n]));
}
export const ALL_LAYERS = layersUpTo('all');
export const NO_LAYERS = layersUpTo(null);

function createStore(initial) {
  let state = Object.freeze({ ...initial });
  const subs = new Map();
  const emit = (evt, data) => { for (const fn of [...(subs.get(evt) || [])]) { try { fn(data); } catch (e) { console.error(e); } } };
  return {
    get state() { return state; },
    set(patch) {
      const keys = Object.keys(patch).filter(k => state[k] !== patch[k]);
      if (!keys.length) return;
      state = Object.freeze({ ...state, ...patch });
      emit('change', { keys, state });
    },
    on(evt, fn) { if (!subs.has(evt)) subs.set(evt, new Set()); subs.get(evt).add(fn); return () => subs.get(evt).delete(fn); },
    emit
  };
}

export const app = createStore({
  mode: 'course',
  tab: 'lesson',
  R: rules(),
  up: { ...NO_UPGRADES },
  price: rules().price,
  layers: layersUpTo('L0'),
  moneyOn: true,
  tagsOn: true,
  lesson: null,
  scenario: null,
  bank: null,
  unaided: false, // the capstone lesson is open and not finished: the order's figures stay hidden (HUD chip, price block)
  hideAnswers: false // a course lesson's checks are still open: the Ledger hides the answers it would otherwise print
});

// The layers that actually apply right now (the M key turns every money layer off in Factory floor).
export const effectiveLayers = s => s.moneyOn ? s.layers : { ...NO_LAYERS, cycle: s.layers.cycle };
