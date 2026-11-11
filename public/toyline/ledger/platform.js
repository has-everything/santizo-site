// Toyline Ledger platform layer (SPEC §4.10-4.12, docs/CONTRACTS.md): capability lookups, the progress store and
// file saving with a Copy-CSV fallback. Every capability is optional: the page is complete with none of them, and
// nothing here blocks first paint (lookups run in the background and settle within about ten seconds).
//
// Capability calls follow the artifact-capabilities type definitions: `window.claude.use(name)` resolves a frozen
// namespace or null; every failure is a rejected `{ code, message }` and we branch on `code` only.

const CAP_NAMES = ['sample', 'db', 'user', 'downloads'];
const LOOKUP_MS = 10000;                       // claude.use() itself gives up after 10 s on a host that never answers
const LS_KEY = 'toyline-ledger-progress-v1';
const DEBOUNCE_MS = 1000;
const DB_WRITE_MS = 15000;                     // a db write that hangs longer than this counts as failed
export const NOTES = Object.freeze({
  account: 'Saved to your account',
  device: 'Saved on this device',
  memory: "Progress won't be kept in this view."
});
export const SAVE_COPY = Object.freeze({
  declined: 'Save cancelled.',
  busy: 'A save prompt is already open.',
  copied: 'CSV copied. Paste it into a spreadsheet.',
  shown: 'Copy the CSV from the box.'
});

/* ---------- small helpers ---------- */
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));   // plain JSON: drops undefined, Infinity -> null
const sleep = ms => new Promise(r => setTimeout(r, ms));
const codeOf = e => (e && typeof e === 'object' && typeof e.code === 'string') ? e.code : 'unavailable';
const withTimeout = (p, ms, fallback) => Promise.race([p, sleep(ms).then(() => fallback)]);
const sameVal = (a, b) => a === b || (typeof a === 'object' && a !== null && JSON.stringify(a) === JSON.stringify(b));
function union(a, b) {
  const out = Array.isArray(a) ? [...a] : [];
  for (const x of (Array.isArray(b) ? b : [])) if (!out.some(y => sameVal(x, y))) out.push(x);
  return out;
}
const keysOf = (...objs) => [...new Set(objs.flatMap(o => isObj(o) ? Object.keys(o) : []))];

/* ---------- change events ---------- */
const subs = new Set();
function emit(what) {
  for (const fn of [...subs]) { try { fn({ what, caps, where: store.where }); } catch (e) { console.error(e); } }
}

/* ---------- capabilities ---------- */
const caps = { sample: null, db: null, user: null, downloads: null };
const dropped = new Set();                     // capabilities this view gave up on (e.g. downloads 'unavailable')
const hasClaude = () => typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';

// One lookup per capability. The race keeps `ready` bounded; a namespace that still arrives later is accepted.
function lookup(name) {
  if (!hasClaude()) return Promise.resolve(null);
  let p;
  try { p = Promise.resolve(window.claude.use(name)); } catch { return Promise.resolve(null); }
  p = p.then(ns => ns || null, () => null);
  p.then(ns => { if (ns && !caps[name] && !dropped.has(name)) { caps[name] = ns; emit(name); } });
  return Promise.race([p, sleep(LOOKUP_MS).then(() => null)]);
}
const lookups = Object.fromEntries(CAP_NAMES.map(n => [n, lookup(n)]));
const ready = Promise.all(CAP_NAMES.map(n => lookups[n])).then(() => { emit('ready'); return caps; }, () => caps);

function dropCap(name) {
  if (!caps[name] && dropped.has(name)) return;
  dropped.add(name); caps[name] = null; emit(name);
}

/* ---------- progress: shape and merge rules (SPEC §4.10) ---------- */
const emptyProgress = () => ({ v: 1, lessons: {}, misses: {}, notebook: [], challenges: {}, factory: {}, updatedAt: 0 });
function normal(p) {
  const e = emptyProgress();
  if (!isObj(p)) return e;
  const out = { ...e, ...clone(p) };
  for (const k of ['lessons', 'misses', 'challenges', 'factory']) if (!isObj(out[k])) out[k] = {};
  if (!Array.isArray(out.notebook)) out.notebook = [];
  if (typeof out.updatedAt !== 'number') out.updatedAt = 0;
  return out;
}
// Recursive merge where `newer` wins on every scalar or array it holds.
function mergeNewer(older, newer) {
  if (!isObj(older)) return clone(newer);
  if (!isObj(newer)) return newer === undefined ? clone(older) : clone(newer);
  const out = {};
  for (const k of keysOf(older, newer)) {
    if (newer[k] === undefined) out[k] = clone(older[k]);
    else if (isObj(older[k]) && isObj(newer[k])) out[k] = mergeNewer(older[k], newer[k]);
    else out[k] = clone(newer[k]);
  }
  return out;
}
const numOr = (x, d) => typeof x === 'number' && Number.isFinite(x) ? x : d;
function maxMap(a, b) {
  const out = {};
  for (const k of keysOf(a, b)) {
    const x = isObj(a) ? a[k] : undefined, y = isObj(b) ? b[k] : undefined;
    out[k] = (typeof x === 'number' && typeof y === 'number') ? Math.max(x, y) : (x !== undefined ? x : y);
  }
  return out;
}
// firstTry keeps the first value recorded. With no per-key timestamps, the account copy (a) counts as first.
function firstMap(a, b) {
  const out = {};
  for (const k of keysOf(a, b)) {
    const x = isObj(a) ? a[k] : undefined, y = isObj(b) ? b[k] : undefined;
    out[k] = x !== undefined && x !== null ? x : y;
  }
  return out;
}
function bestOf(x, y) {
  if (x === undefined || x === null) return clone(y);
  if (y === undefined || y === null) return clone(x);
  if (typeof x === 'number' && typeof y === 'number') return Math.max(x, y);
  if (isObj(x) && isObj(y)) {
    const px = numOr(x.profit, null), py = numOr(y.profit, null);
    if (px !== null && py !== null) {
      if (px !== py) return clone(px > py ? x : y);
      return clone(numOr(x.low, -Infinity) >= numOr(y.low, -Infinity) ? x : y);
    }
    return maxMap(x, y);
  }
  return clone(x);
}
// a = the account copy, b = the device copy. done and notebook are unions, attempts and best take the maximum,
// firstTry keeps the first value, factory takes the newer updatedAt; anything else: the newer document wins.
export function mergeProgress(a, b) {
  const A = normal(a), B = normal(b);
  const aNewer = A.updatedAt >= B.updatedAt;
  const out = mergeNewer(aNewer ? B : A, aNewer ? A : B);
  out.v = 1;
  out.lessons = {};
  for (const id of keysOf(A.lessons, B.lessons)) {
    const x = A.lessons[id], y = B.lessons[id];
    if (!isObj(x) || !isObj(y)) { out.lessons[id] = clone(isObj(x) ? x : y); continue; }
    const l = mergeNewer(aNewer ? y : x, aNewer ? x : y);
    l.done = x.done || y.done || false;
    if (x.steps !== undefined || y.steps !== undefined) l.steps = union(x.steps, y.steps);
    if (x.attempts !== undefined || y.attempts !== undefined) l.attempts = maxMap(x.attempts, y.attempts);
    if (x.firstTry !== undefined || y.firstTry !== undefined) l.firstTry = firstMap(x.firstTry, y.firstTry);
    if (x.prediction != null || y.prediction != null) l.prediction = x.prediction ?? y.prediction;
    out.lessons[id] = l;
  }
  out.misses = {};
  for (const k of keysOf(A.misses, B.misses)) out.misses[k] = union(A.misses[k], B.misses[k]);
  out.notebook = union(A.notebook, B.notebook);
  out.challenges = {};
  for (const id of keysOf(A.challenges, B.challenges)) {
    const x = A.challenges[id], y = B.challenges[id];
    if (!isObj(x) || !isObj(y)) { out.challenges[id] = clone(isObj(x) ? x : y); continue; }
    const c = mergeNewer(aNewer ? y : x, aNewer ? x : y);
    c.done = x.done || y.done || false;
    if (x.best !== undefined || y.best !== undefined) c.best = bestOf(x.best, y.best);
    out.challenges[id] = c;
  }
  const filled = f => isObj(f) && Object.keys(f).some(k => k !== 'updatedAt');
  const ta = numOr(A.factory.updatedAt, A.updatedAt), tb = numOr(B.factory.updatedAt, B.updatedAt);
  out.factory = !filled(B.factory) ? clone(A.factory) : !filled(A.factory) ? clone(B.factory) : clone(ta >= tb ? A.factory : B.factory);
  out.updatedAt = Math.max(A.updatedAt, B.updatedAt);
  return out;
}
// save(patch): objects merge key by key, so a patch may name only what changed; arrays and other values replace
// (the caller's array is the truth: course.js sends whole lists, and its review queue shrinks); a firstTry value
// already recorded is kept. The union / maximum rules apply only when two copies are merged on load.
function applyPatch(t, p, parentKey) {
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    if (parentKey === 'firstTry' && t[k] !== undefined && t[k] !== null) continue;
    // the Factory floor's rules and order replace as a whole, so a rule the learner reset is really gone (not merged back)
    if (parentKey === 'factory' && (k === 'rules' || k === 'cfg')) { t[k] = clone(v); continue; }
    if (isObj(v)) { if (!isObj(t[k])) t[k] = {}; applyPatch(t[k], v, k); }
    else t[k] = clone(v);
  }
}

/* ---------- progress: localStorage (every access in try/catch) ---------- */
function lsRead() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { ok: true, doc: null };
    try { return { ok: true, doc: JSON.parse(raw) }; } catch { return { ok: true, doc: null }; }  // corrupt copy: start fresh
  } catch { return { ok: false, doc: null }; }
}
function lsWrite(doc) {
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(doc)); return true; } catch { return false; }
}

/* ---------- progress: the store ---------- */
let progress = emptyProgress(), loaded = false, loadP = null, ref = null;
let early = [], dirty = false, timer = 0, inflight = null;

function showNote() {
  const el = typeof document !== 'undefined' && document.getElementById('saveNote');
  if (el) el.textContent = NOTES[store.where] || '';
}
function setWhere(w) {
  if (store.where === w && loaded) { showNote(); return; }
  store.where = w; showNote(); emit('where');
}
async function doLoad() {
  const local = lsRead();
  let where = local.ok ? 'device' : 'memory', remote = null;
  await Promise.all([lookups.db, lookups.user]);
  const db = caps.db, user = caps.user;
  if (db && user) {
    try {
      const uid = await withTimeout(Promise.resolve(user.id()).catch(() => null), LOOKUP_MS, null);
      if (typeof uid === 'string' && uid) {
        const r = db.doc('data/users/' + uid + '/progress');
        let snap;
        try { snap = await withTimeout(r.get(), LOOKUP_MS, null); }
        catch (e) { if (codeOf(e) !== 'unavailable') throw e; await sleep(300 + Math.random() * 700); snap = await withTimeout(r.get(), LOOKUP_MS, null); }
        if (snap === null) throw { code: 'unavailable', message: 'progress read timed out' };
        remote = snap.exists ? snap.data() : null;
        ref = r; where = 'account';
      }
    } catch (e) {
      console.warn('[toyline] progress: account copy unavailable (' + codeOf(e) + '); using this device.');
      ref = null;
    }
  }
  progress = mergeProgress(remote, local.doc);
  // Patches saved before the load finished were made without the stored progress (a caller that saves its whole,
  // still-empty state must not wipe it): merge them as an older copy, so unions and maxima apply and stored values win.
  for (const p of early) {
    const older = { ...p, updatedAt: 0 };
    if (isObj(older.factory)) older.factory = { ...older.factory, updatedAt: 0 };
    progress = mergeProgress(progress, older);
  }
  if (early.length) progress.updatedAt = Date.now();
  early = [];
  loaded = true;
  setWhere(where);
  emit('loaded');
  if (dirty) { clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS); }   // nothing is written on load itself
}
function load() {
  if (!loadP) loadP = doLoad().catch(e => { console.error('[toyline] progress load failed', e); loaded = true; setWhere(lsRead().ok ? 'device' : 'memory'); });
  return loadP.then(() => clone(progress));
}
function save(patch) {
  if (!isObj(patch)) return;
  const p = clone(patch);
  dirty = true;
  if (!loaded) { early.push(p); load(); return; }
  const t = Date.now();
  p.updatedAt = t;
  if (isObj(p.factory)) p.factory.updatedAt = t;
  applyPatch(progress, p);
  clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS);
}
async function dbSet(doc) {
  const r = await withTimeout(ref.set(doc).then(() => true), DB_WRITE_MS, false);
  if (!r) throw { code: 'unavailable', message: 'progress write timed out' };
}
async function write(doc) {
  if (store.where === 'account' && ref) {
    try { await dbSet(doc); return; }
    catch (e) {
      let err = e;
      if (codeOf(e) === 'unavailable') {                                 // transient: one retry after a short random wait
        await sleep(400 + Math.random() * 800);
        try { await dbSet(doc); return; } catch (e2) { err = e2; }
      }
      // view-only viewers cannot write their own subtree; any rejected write falls back to this device
      console.warn('[toyline] progress: account write refused (' + codeOf(err) + '); saving on this device instead.');
      ref = null;
      setWhere(lsWrite(doc) ? 'device' : 'memory');
      return;
    }
  }
  if (store.where === 'device' && !lsWrite(doc)) setWhere('memory');
}
function flush() {
  timer = 0;
  if (!loaded || inflight || !dirty) return;
  dirty = false;
  const doc = clone(progress);
  inflight = write(doc).catch(e => console.error('[toyline] progress write failed', e)).finally(() => {
    inflight = null;
    if (dirty && !timer) flush();                                       // saves made during the write: write once more
  });
}
function flushNow() { if (dirty && loaded) { clearTimeout(timer); flush(); } }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
}

const store = {
  where: lsRead().ok ? 'device' : 'memory',  // settled by load(): 'account' | 'device' | 'memory'
  load,
  save,
  get: () => loaded ? clone(progress) : null,     // the merged progress so far (null before load)
  flush: flushNow,                                // write a pending save now, skipping the debounce
  // Beyond the contract: start over (saves an empty progress document; the device copy is cleared too)
  reset() {
    progress = emptyProgress(); progress.updatedAt = Date.now(); early = []; dirty = true;
    try { window.localStorage.removeItem(LS_KEY); } catch { }
    if (loaded) { clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS); }
  },
  get pending() { return dirty || !!inflight; }
};
// Read progress in the background from the start (reading only: nothing is written until a save), so the footer can
// say where progress is kept in every mode. store.load() returns this same load.
if (typeof window !== 'undefined') Promise.resolve().then(load);

/* ---------- files: downloads.save, then Copy CSV, then a read-only box (SPEC §4.11-4.12) ---------- */
const EXT_OK = /\.(gif|png|jpe?g|webp|mp4|webm|mov|txt|json|md|docx|pptx|epub|csv|ttf|html|svg|pdf|xlsx|zip)$/i;
function safeName(filename, mime) {
  let n = String(filename || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!n) n = 'toyline';
  if (!EXT_OK.test(n)) n += /json/.test(mime || '') ? '.json' : /plain/.test(mime || '') ? '.txt' : '.csv';
  return n;
}
const say = (el, text) => { if (el && 'textContent' in el) el.textContent = text; };
const DL_GONE = new Set(['unavailable', 'not_granted', 'capability_disabled', 'capability_removed', 'extension_not_enabled']);
const DL_KNOWN = new Set([...DL_GONE, 'declined', 'rate_limited', 'too_large', 'bad_request', 'rejected_extension', 'transform_error', 'request_unknown', 'not_signed']);

async function saveFile({ filename, text, mime = 'text/csv', note } = {}) {
  const body = typeof text === 'string' ? text : String(text ?? '');
  if (!body) { console.warn('[toyline] saveFile: nothing to save'); return 'declined'; }
  const name = safeName(filename, mime);
  const dl = caps.downloads;
  let reason = 'none';
  if (dl && typeof dl.save === 'function') {
    // Excel reads a UTF-8 CSV correctly only with a byte-order mark (the "how" column has × and −).
    const data = /\.csv$/i.test(name) && !body.startsWith('﻿') ? '﻿' + body : body;
    try {
      await dl.save({ filename: name, data });
      say(note, 'Saved ' + name + '.');
      return 'saved';
    } catch (e) {
      const c = DL_KNOWN.has(codeOf(e)) ? codeOf(e) : 'unavailable';   // unknown codes count as unavailable
      if (c === 'declined') { say(note, SAVE_COPY.declined); return 'declined'; }
      if (c === 'rate_limited') { say(note, SAVE_COPY.busy); return 'busy'; }
      if (DL_GONE.has(c)) { dropCap('downloads'); reason = 'none'; }
      else { console.warn('[toyline] saveFile: downloads refused ' + name + ' (' + c + ')'); reason = 'failed'; }
    }
  }
  const r = await copyDialog({ filename: name, text: body, reason });
  say(note, r === 'copied' ? SAVE_COPY.copied : r === 'shown' ? SAVE_COPY.shown : '');
  return r;
}

/* ---------- the Copy CSV dialog (pf-) ---------- */
let dlg = null, settleOpen = null, returnFocus = null;
function ensureDialog() {
  if (dlg) return dlg;
  injectCss();
  dlg = document.createElement('dialog');
  dlg.className = 'pf-dialog';
  dlg.setAttribute('aria-labelledby', 'pfTitle');
  dlg.innerHTML = `<div class="pf-box">
    <h2 class="pf-title" id="pfTitle">Copy the CSV</h2>
    <p class="pf-file"></p>
    <p class="pf-lead"></p>
    <div class="pf-row"><button type="button" class="pf-btn pf-primary" data-act="copy">Copy CSV</button><button type="button" class="pf-btn" data-act="close">Close</button></div>
    <p class="pf-status" role="status" aria-live="polite"></p>
    <textarea class="pf-text" readonly spellcheck="false" aria-label="CSV text" hidden></textarea>
  </div>`;
  document.body.append(dlg);
  const ta = dlg.querySelector('.pf-text');
  ta.addEventListener('focus', () => selectAll(ta));
  ta.addEventListener('click', () => selectAll(ta));
  dlg.querySelector('[data-act="close"]').addEventListener('click', () => closeDialog());
  dlg.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });   // Esc
  dlg.addEventListener('click', e => {                                          // a tap on the backdrop (outside the box)
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
  });
  return dlg;
}
// the read-only box selects everything whenever it gets focus (iOS needs setSelectionRange as well as select)
function selectAll(ta) {
  try { ta.select(); ta.setSelectionRange(0, ta.value.length); } catch { }
}
function closeDialog() {
  if (!dlg) return;
  if (settleOpen) settleOpen('declined');
  if (dlg.open) { try { dlg.close(); } catch { dlg.removeAttribute('open'); } }
  if (returnFocus && returnFocus.isConnected) { try { returnFocus.focus({ preventScroll: true }); } catch { } }
  returnFocus = null;
}
function copyDialog({ filename, text, reason }) {
  if (typeof document === 'undefined') return Promise.resolve('shown');
  const d = ensureDialog();
  if (settleOpen) settleOpen('declined');          // a second request replaces the first
  if (!d.contains(document.activeElement)) returnFocus = document.activeElement;
  const csv = /\.csv$/i.test(filename);
  const ta = d.querySelector('.pf-text'), status = d.querySelector('.pf-status'), copyBtn = d.querySelector('[data-act="copy"]');
  d.querySelector('.pf-title').textContent = csv ? 'Copy the CSV' : 'Copy the file';
  d.querySelector('.pf-file').textContent = filename;
  d.querySelector('.pf-lead').textContent = (reason === 'failed' ? "This file couldn't be saved. " : "Saving files isn't available in this view. ")
    + (csv ? 'Copy the table instead, then paste it into a spreadsheet.' : 'Copy the text instead.');
  copyBtn.textContent = csv ? 'Copy CSV' : 'Copy';
  copyBtn.hidden = false; copyBtn.disabled = false;
  status.textContent = '';
  ta.hidden = true; ta.value = text;
  let settled = false, resolveP;
  const p = new Promise(r => { resolveP = r; });
  const settle = v => { if (settled) return; settled = true; settleOpen = null; resolveP(v); };
  settleOpen = settle;
  const showBox = msg => {
    copyBtn.hidden = true;
    ta.hidden = false;
    status.textContent = msg;
    requestAnimationFrame(() => { try { ta.focus({ preventScroll: true }); } catch { } selectAll(ta); });
    settle('shown');
  };
  // the clipboard write happens inside the click handler (the browser needs the click to allow it)
  copyBtn.onclick = () => {
    let w;
    try { w = navigator.clipboard && typeof navigator.clipboard.writeText === 'function' ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard')); }
    catch (e) { w = Promise.reject(e); }
    copyBtn.disabled = true;
    Promise.resolve(w).then(() => {
      copyBtn.textContent = 'Copied';
      status.textContent = 'Copied. Paste it into a spreadsheet: each line becomes a row.';
      settle('copied');
    }, () => showBox('Copying is blocked here. Select all the text in the box and copy it.'));
  };
  try { if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); }
  catch { d.setAttribute('open', ''); }
  const noClipboard = !(navigator.clipboard && typeof navigator.clipboard.writeText === 'function');
  if (noClipboard) showBox('Select all the text in the box and copy it.');
  else copyBtn.focus();
  return p;
}

/* ---------- styles (tokens from index.html only) ---------- */
function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('css-platform')) return;
  const s = document.createElement('style');
  s.id = 'css-platform';
  s.textContent = `
.pf-dialog { --pf-scrim: color-mix(in srgb, var(--ink) 32%, transparent); --pf-shadow: color-mix(in srgb, var(--ink) 22%, transparent);
  box-sizing: border-box; width: min(460px, calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 32px); padding: 0;
  border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); font-family: var(--f-display);
  box-shadow: 0 18px 50px var(--pf-shadow); overflow: auto; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .pf-dialog { --pf-scrim: color-mix(in srgb, var(--bg) 64%, transparent); --pf-shadow: color-mix(in srgb, var(--bg) 80%, transparent); }
}
:root[data-theme="dark"] .pf-dialog { --pf-scrim: color-mix(in srgb, var(--bg) 64%, transparent); --pf-shadow: color-mix(in srgb, var(--bg) 80%, transparent); }
.pf-dialog::backdrop { background: var(--pf-scrim); }
.pf-box { padding: 16px 16px 14px; display: grid; gap: 10px; }
.pf-title { margin: 0; font-size: 18px; font-weight: 800; font-stretch: 112%; line-height: 1.2; }
.pf-file { margin: 0; font-family: var(--f-mono); font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.pf-lead { margin: 0; font-size: 13.5px; line-height: 1.45; }
.pf-row { display: flex; gap: 8px; flex-wrap: wrap; }
.pf-btn { flex: 1 1 auto; min-height: 44px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 8px;
  padding: 10px 14px; cursor: pointer; font: 700 13.5px var(--f-display); }
.pf-btn.pf-primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 800; }
.pf-btn:disabled { opacity: .7; cursor: default; }
.pf-btn:focus-visible, .pf-text:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pf-status { margin: 0; font-size: 12.5px; color: var(--muted); min-height: 1em; }
.pf-status:empty { display: none; }
.pf-text { box-sizing: border-box; width: 100%; min-height: 180px; max-height: 46vh; resize: vertical; padding: 8px 10px;
  border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink);
  font: 12px/1.45 var(--f-mono); font-variant-numeric: tabular-nums; white-space: pre; overflow: auto; }
`;
  document.head.append(s);
}

/* ---------- the export ---------- */
export const platform = {
  ready,                                    // resolves (never rejects) once every lookup settled, with `caps`
  caps,                                     // { sample, db, user, downloads }: namespaces or null
  store,
  saveFile,
  onReady(fn) { ready.then(c => { try { fn(c); } catch (e) { console.error(e); } }); },
  // Beyond the contract: fires { what, caps, where } when a capability arrives or is dropped, or `where` changes.
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  canSave: () => !!caps.downloads           // false: saveFile will open the Copy CSV dialog instead
};
