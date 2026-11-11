// Toyline Ledger entry: boots the factory, wires the shared app state to it, then mounts the ledger modules.
// Each module is loaded on its own so one that fails to load or mount leaves the rest of the page working; if the
// 3D factory itself cannot load (a blocked CDN, no WebGL) a stand-in engine keeps the lessons and the Ledger going.
import * as econ from './ledger/econ.js';
import { app, layersUpTo, ALL_LAYERS, effectiveLayers } from './ledger/app.js';

const $ = s => document.querySelector(s);
if (!document.documentElement.lang) document.documentElement.lang = 'en';

/* ---------- the engine: the real factory, or the stand-in ---------- */
let engine, engineFailed = false;
try {
  ({ engine } = await import('./factory.js'));
} catch (e) {
  console.error('[toyline] the 3D factory could not load:', e);
  engineFailed = true;
  const { createStubEngine } = await import('./ledger/stub-engine.js');
  engine = createStubEngine({ stage: $('#stage') });
  if (!$('#stage .fail')) $('#stage').insertAdjacentHTML('beforeend', '<div class="fail">The 3D factory could not load here (a blocked network or no WebGL). The lessons and the Ledger still work.</div>');
  else $('#stage .fail').textContent += ' The lessons and the Ledger still work.';
  $('#tabOrder').hidden = true; // the order form lives in the 3D factory's code
}
window.__toyline = { engine, app, econ, engineFailed };

/* ---------- app state -> engine ---------- */
const pushToEngine = () => {
  const s = app.state;
  engine.configure?.({ R: s.R, up: s.up, price: s.price, layers: effectiveLayers(s), moneyOn: s.moneyOn, tagsOn: s.tagsOn, fillButton: s.mode === 'course', unaided: !!s.unaided && s.mode === 'course' });
};
// the Bank chip: a replay's balance, else the open lesson's or challenge's opening cash, else the rules' (engine default)
const pushBank = () => engine.setBank?.(app.state.bank ?? app.state.scenario?.open ?? null);

/* ---------- panel tabs ---------- */
const TABS = ['lesson', 'order', 'ledger'];
const cap = t => t[0].toUpperCase() + t.slice(1);
function renderTabs() {
  const s = app.state, L = effectiveLayers(s);
  const ledgerOn = s.mode !== 'course' || L.ledger;
  $('#tabLedger').hidden = !ledgerOn;
  const orderOn = !engineFailed;
  let tab = !ledgerOn && s.tab === 'ledger' ? 'lesson' : s.tab;
  if (!orderOn && tab === 'order') tab = 'lesson';
  for (const t of TABS) {
    const on = t === tab;
    $('#tab' + cap(t)).setAttribute('aria-selected', on);
    $('#tab' + cap(t)).tabIndex = on ? 0 : -1;
    $('#pane' + cap(t)).hidden = !on;
  }
  $('#tabLesson').textContent = s.mode === 'challenges' ? 'Challenge' : 'Lesson';
  $('#tabs').style.gridTemplateColumns = `repeat(${(ledgerOn ? 1 : 0) + (orderOn ? 1 : 0) + 1}, minmax(0, 1fr))`;
}
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => app.set({ tab: b.dataset.tab })));
// each tab keeps its own scroll place (desktop: the panel scrolls; phones scroll the page and keep theirs)
const scrollOf = {};
let shownTab = app.state.tab;
app.on('change', ({ keys, state }) => {
  if (!keys.includes('tab') || state.tab === shownTab) return;
  const p = $('#panel'), scrolls = getComputedStyle(p).overflowY !== 'visible';
  if (scrolls) scrollOf[shownTab] = p.scrollTop;
  shownTab = state.tab;
  if (scrolls) requestAnimationFrame(() => { p.scrollTop = scrollOf[state.tab] || 0; });
});
// arrow keys move between tabs (WAI-ARIA tabs pattern)
$('#tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const vis = [...document.querySelectorAll('#tabs button')].filter(b => !b.hidden);
  const i = vis.indexOf(document.activeElement); if (i < 0) return;
  const n = vis[(i + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length];
  n.focus(); n.click(); e.preventDefault();
});

/* ---------- header mode switch ---------- */
function renderMode() {
  const m = app.state.mode;
  document.querySelectorAll('#appModes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.app === m));
  $('#app').classList.toggle('course', m === 'course');
}
document.querySelectorAll('#appModes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.app)));
function setMode(mode) {
  if (mode === app.state.mode) return;
  const patch = { mode, bank: null, hideAnswers: false, unaided: false };
  // upgrades belong to C3 only; the ledger re-applies the Factory floor's own saved rules and order when it sees 'mode'
  if (mode === 'factory') Object.assign(patch, { layers: ALL_LAYERS, tab: 'order', scenario: null, lesson: null, up: { ...econ.NO_UPGRADES } });
  if (mode === 'challenges') Object.assign(patch, { layers: ALL_LAYERS, tab: 'lesson', lesson: null, moneyOn: true });
  if (mode === 'course') Object.assign(patch, { tab: 'lesson', scenario: null, moneyOn: true, layers: layersUpTo('L0'), up: { ...econ.NO_UPGRADES } });
  app.set(patch);
  app.emit('mode', { mode });
}

/* ---------- keys: M money layers, T tags (Space, F and H stay in factory.js) ---------- */
// single-key shortcuts never fire while a control has focus, so Space and letters keep their normal job there
const typing = e => e.ctrlKey || e.metaKey || e.altKey || !!e.target.closest?.('input, textarea, select, [contenteditable], button, a[href], summary, [role=button], [role=switch], [role=tab], [role=slider], [role=radio], [role=checkbox], [role=option]');
const isKey = (e, c) => e.key.toLowerCase() === c || (!/^[a-z]$/i.test(e.key) && e.code === 'Key' + c.toUpperCase());
document.addEventListener('keydown', e => {
  if (typing(e) || e.repeat) return;
  if (isKey(e, 'm') && app.state.mode === 'factory') {
    app.set({ moneyOn: !app.state.moneyOn });
    engine.toast?.(app.state.moneyOn ? 'Money layers on · <kbd>M</kbd> hides them' : 'Money layers off · <kbd>M</kbd> shows them');
  } else if (isKey(e, 't')) {
    app.set({ tagsOn: !app.state.tagsOn });
    engine.toast?.(app.state.tagsOn ? 'Station tags on · <kbd>T</kbd> hides them' : 'Station tags off · <kbd>T</kbd> shows them');
  }
});

app.on('change', ({ keys }) => {
  if (keys.some(k => ['R', 'up', 'price', 'layers', 'moneyOn', 'tagsOn', 'mode', 'unaided'].includes(k))) pushToEngine();
  if (keys.some(k => ['tab', 'layers', 'moneyOn', 'mode'].includes(k))) renderTabs();
  if (keys.includes('mode')) renderMode();
  if (keys.includes('bank') || keys.includes('scenario')) pushBank();
});
pushToEngine(); renderTabs(); renderMode(); pushBank();

// a 3D station tag (overlay.js) picks a station: route it through the engine so lessons hear it like a strip tap
app.on('stationTap', d => { if (d && d.source === 'tag') engine.tapStation?.(d.station, 'tag'); });

// the phone coach bar's real height, for the Order tab's sticky actions and the page's bottom room (index.html reads --coach-h)
const coachEl = $('#coach');
const setCoachH = () => document.documentElement.style.setProperty('--coach-h', (coachEl.hidden ? 0 : coachEl.offsetHeight) + 'px');
new ResizeObserver(setCoachH).observe(coachEl);
new MutationObserver(setCoachH).observe(coachEl, { attributes: true, attributeFilter: ['hidden'] });

/* ---------- modules ---------- */
const deps = { engine, app, econ };
async function load(path, mount, onFail) {
  try { const m = await import(path); return await mount(m); }
  catch (e) { console.error(`[toyline] ${path} failed:`, e); onFail?.(); return null; }
}
const failNote = (sel, text) => () => { const el = $(sel); if (el && !el.textContent.trim()) el.innerHTML = `<p class="summary" style="padding-top:16px">${text}</p>`; };
const platform = await load('./ledger/platform.js', m => m.platform);
const tutor = await load('./ledger/tutor.js', m => m.tutor);
deps.platform = platform || { ready: Promise.resolve(), caps: {}, store: { load: async () => ({}), save() { }, where: 'memory' }, saveFile: async () => 'shown', onReady() { } };
if (!platform) $('#saveNote').textContent = "Progress won't be kept in this view.";
deps.tutor = tutor || { available: () => false, onChange() { }, ask() { return { stop() { } }; }, grade: async () => null, snapshot: () => ({}) };
await load('./ledger/overlay.js', m => m.mountOverlay({ ...deps }));
const led = await load('./ledger/ledger.js', async m => ({ api: await m.mountLedger({ ...deps, pane: $('#paneLedger') }), widgets: m.widgets, buildCsv: m.buildCsv }),
  failNote('#paneLedger', 'The Ledger could not load in this view. Reload the page to try again.'));
deps.ledger = led?.api || null;
deps.widgets = led?.widgets || {};
deps.buildCsv = led?.buildCsv || null;
deps.course = await load('./ledger/course.js', m => m.mountCourse({ ...deps, pane: $('#paneLesson'), coach: $('#coach') }),
  failNote('#paneLesson', 'The lessons could not load in this view. Reload the page to try again.'));
window.__toyline = { ...window.__toyline, ...deps };
app.emit('ready', {});

/* ---------- a link can open a place directly ---------- */
// index.html#order opens the Order tab with the camera on the car (the short way in, for a link from another site);
// #factory and #challenges open those modes. Anything else, or no hash, opens the course as before.
const openAt = location.hash.slice(1).toLowerCase();
if (openAt === 'factory' || openAt === 'challenges') setMode(openAt);
else if (openAt === 'order' && !engineFailed) { app.set({ tab: 'order' }); engine.setCamera?.('follow'); }
