import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
// GLTFExporter and fflate are loaded only when "Save GLB" is pressed, so they never hold up (or break) the boot
import * as econ from './ledger/econ.js';

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const pick = a => a[Math.floor(Math.random() * a.length)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- catalog ---------- */
const PALETTE = [
  ['Signal red', '#D7322B'], ['Tangerine', '#EE7A2B'], ['Mustard', '#E8B53A'], ['Mint', '#8FCBB5'],
  ['Teal', '#1E7F86'], ['Sky', '#7FB3D9'], ['Navy', '#23395B'], ['Forest', '#2F5D46'],
  ['Blush', '#E99AA8'], ['Cream', '#EFE6D2'], ['Graphite', '#2A2C30'], ['Chalk', '#F4F3EF']
];
const colorName = hex => (PALETTE.find(p => p[1] === hex) || ['Custom'])[0];
const LIVERIES = [['plain', 'Plain'], ['stripe', 'Side stripe'], ['gt', 'GT stripes'], ['twotone', 'Two-tone'], ['pinstripe', 'Pinstripe'], ['checker', 'Checker band']];
const WHEELS = [['classic', 'Classic'], ['whitewall', 'Whitewall'], ['racing', 'Racing'], ['wood', 'All wood']];
const BUMPERS = [['none', 'None'], ['wood', 'Wood dowel'], ['chrome', 'Chrome']];
const ROOFS = [['none', 'None'], ['rack', 'Roof rack'], ['spoiler', 'Spoiler'], ['beacon', 'Light bar'], ['luggage', 'Luggage'], ['surf', 'Surfboard']];
const FINISHES = [['gloss', 'Gloss lacquer'], ['satin', 'Satin'], ['raw', 'Oiled wood']];
const nameOf = (list, k) => (list.find(o => o[0] === k) || ['', k])[1];

// Side profiles in model units: [x, y, cornerRadius], rear-bottom over the roof to front-bottom.
const BODIES = {
  coupe: { name: 'Coupe', wheels: [-1.35, 1.40],
    pts: [[-2.2, .3, .12], [-2.25, .95, .25], [-1.55, 1.18, .35], [-.55, 1.78, .45], [.35, 1.8, .35], [1.05, 1.2, .25], [2.2, 1.02, .35], [2.25, .3, .12]],
    windows: [[[-1.2, 1.27], [-.55, 1.64], [-.22, 1.66], [-.22, 1.27]], [[-.1, 1.27], [-.1, 1.66], [.3, 1.66], [.84, 1.27]]],
    belt: 1.2, roof: { x0: -.5, x1: .3, y: 1.8 }, spoiler: { x: -1.85, y: 1.15 }, lightY: .72 },
  hatch: { name: 'Hatch', wheels: [-1.2, 1.22],
    pts: [[-1.9, .3, .1], [-1.93, 1.1, .2], [-1.78, 1.82, .3], [.45, 1.86, .3], [1.05, 1.15, .22], [1.9, 1.0, .3], [1.92, .3, .1]],
    windows: [[[-1.62, 1.22], [-1.55, 1.68], [-.45, 1.7], [-.45, 1.22]], [[-.34, 1.22], [-.34, 1.7], [.4, 1.7], [.86, 1.22]]],
    belt: 1.17, roof: { x0: -1.5, x1: .3, y: 1.86 }, spoiler: { x: -1.62, y: 1.84 }, lightY: .7 },
  wagon: { name: 'Wagon', wheels: [-1.5, 1.5],
    pts: [[-2.3, .3, .1], [-2.32, 1.15, .2], [-2.2, 1.82, .3], [.5, 1.84, .3], [1.15, 1.2, .22], [2.3, 1.02, .3], [2.32, .3, .1]],
    windows: [[[-2.03, 1.25], [-1.98, 1.68], [-1.1, 1.7], [-1.1, 1.25]], [[-1.0, 1.25], [-1.0, 1.7], [-.1, 1.7], [-.1, 1.25]], [[0, 1.25], [0, 1.7], [.46, 1.7], [.96, 1.25]]],
    belt: 1.22, roof: { x0: -2.0, x1: .35, y: 1.84 }, spoiler: { x: -2.05, y: 1.82 }, lightY: .72 },
  van: { name: 'Van', wheels: [-1.3, 1.35],
    pts: [[-2.1, .3, .1], [-2.13, 2.25, .4], [1.25, 2.28, .5], [2.0, 1.3, .3], [2.12, 1.05, .25], [2.14, .3, .1]],
    windows: [[[-1.85, 1.56], [-1.85, 2.0], [-1.0, 2.0], [-1.0, 1.56]], [[-.9, 1.56], [-.9, 2.0], [-.05, 2.0], [-.05, 1.56]], [[.15, 1.56], [.15, 2.0], [1.3, 2.0], [1.62, 1.56]]],
    belt: 1.5, roof: { x0: -1.85, x1: .9, y: 2.28 }, spoiler: { x: -1.85, y: 2.25 }, lightY: .76 },
  pickup: { name: 'Pickup', wheels: [-1.45, 1.45],
    pts: [[-2.3, .3, .1], [-2.32, 1.2, .12], [-.6, 1.2, .05], [-.55, 1.86, .25], [.45, 1.88, .3], [1.05, 1.25, .22], [2.3, 1.08, .3], [2.32, .3, .1]],
    windows: [[[-.38, 1.3], [-.38, 1.73], [.4, 1.75], [.86, 1.3]]],
    belt: 1.25, roof: { x0: -.4, x1: .35, y: 1.88 }, spoiler: { x: -2.12, y: 1.2 }, lightY: .74, bed: { x0: -2.18, x1: -.72, y: 1.2 } },
  racer: { name: 'Racer', wheels: [-1.45, 1.45],
    pts: [[-2.25, .3, .1], [-2.27, 1.0, .2], [-1.0, 1.1, .3], [-.6, 1.48, .25], [-.1, 1.48, .2], [.35, 1.1, .2], [2.25, .84, .35], [2.27, .3, .1]],
    windows: [[[-.5, 1.16], [-.47, 1.36], [-.12, 1.36], [.2, 1.16]]],
    belt: 1.05, roof: null, spoiler: { x: -1.95, y: 1.03 }, lightY: .58, roofs: ['none', 'spoiler'] }
};
const BODY_KEYS = Object.keys(BODIES);
const roofOk = (body, r) => !BODIES[body].roofs || BODIES[body].roofs.includes(r);

/* ---------- constants ---------- */
const W = 1.9, BT = .12, BV = .1, YB = .3, WR = .44, WCY = .44, AR = .62;
const BELT_Y = .9, PALLET_H = .08;
const SX = [-20, -13.5, -7, -.5, 6, 12.5, 19];
const STATIONS = ['Blank', 'Cut', 'Sand', 'Paint', 'Livery', 'Wheels', 'Detail'];
const ENTRY_X = -26.5, EXIT_X = 25.5;
const MOVE_T = 1.5, WORK_T = 2.6; // WORK_T is the work phase for mMax 3.0 min (SPEC §2.1): W = WORK_T × mMax / 3
const PREVIEW_X = -33;

/* ---------- ledger engine state (docs/CONTRACTS.md, SPEC §2.1, §2.6) ---------- */
let R = econ.rules(), UP = { ...econ.NO_UPGRADES };
let LAYERS = Object.fromEntries(['cycle', 'prices', 'materials', 'minutes', 'wait', 'meter', 'scrap', 'deltas', 'ledger', 'volume', 'breakeven', 'markup', 'price', 'bank'].map(k => [k, true]));
let unaided = false; // the capstone: the learner works the order's figures out alone, so the HUD and price block keep them hidden
let moneyOn = true, tagsOn = true, fillButton = false, stopped = false, bankValue = null, planPrice = null;
let sceneReady = false, engineReady = false;
const pending = []; // engine actions called before the boot finished (fonts, scene, sample cars): run in order after it
const whenReady = fn => { if (engineReady) fn(); else pending.push(fn); };
// what the frame loop must redraw: set by events, consumed once per frame
const dirty = { hud: true, strip: true, hmi: true, ring: true, order: true, crate: true };
const lay = id => !!LAYERS[id];
const fmt = econ.fmt;
// session actuals: what the running line paid against what the cars carried away on their tabs
const ACT0 = { lineMinRun: 0, linePaid: 0, chargedToCars: 0, broughtForward: 0, started: 0, scrapped: 0, scrapLost: 0, parked: 0, packed: 0, shipped: 0, invoiced: 0 };
const ACT = { ...ACT0 };
const lclock = { lineMin: 0, day: 1, minOfDay: 0 };
let qcCount = 0, qcSeed = null;
const subs = new Map();
function emitE(type, data) { const s = subs.get(type); if (!s) return; for (const fn of [...s]) { try { fn(data); } catch (e) { console.error('[engine] ' + type + ' handler:', e); } } }
const lineRate = () => (econ.stationCrew(UP).reduce((a, b) => a + b, 0) + R.crewQcPack) * R.labourPerMin + R.powerPerLineMin;
const CONS_LABEL = { 2: 'Sandpaper', 3: 'Masking & thinners', 6: 'Glue' };

/* ---------- renderer & scene ---------- */
const canvas = $('#c'), stageEl = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  // say so on the stage, then fail the module: main.js catches the failed import and runs the stand-in engine, so the
  // lessons and the Ledger keep working (main.js adds that to this message)
  if (!stageEl.querySelector('.fail')) stageEl.insertAdjacentHTML('beforeend', '<div class="fail">This browser could not start WebGL, so the 3D factory cannot show here.</div>');
  const err = new Error('Toyline: WebGL is not available', { cause: e });
  err.code = 'no-webgl';
  throw err;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const BG = new THREE.Color('#B9BFC3'); // a shade under the old haze so the far floor fades without washing out
scene.background = BG;
scene.fog = new THREE.Fog(BG, 90, 260);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .5;

const camera = new THREE.PerspectiveCamera(35, 1, .1, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !reduceMotion;
controls.dampingFactor = .08;
controls.maxPolarAngle = 1.48;
controls.minDistance = 3;
controls.maxDistance = 260;

scene.add(new THREE.HemisphereLight('#FFFFFF', '#A39C90', .62));
const sun = new THREE.DirectionalLight('#FFF3E2', 2.65);
sun.position.set(36, 38, 26);
sun.target.position.set(22, 0, 0);
sun.castShadow = true;
const bigShadow = !matchMedia('(pointer: coarse)').matches;
sun.shadow.mapSize.set(bigShadow ? 4096 : 2048, bigShadow ? 4096 : 2048);
Object.assign(sun.shadow.camera, { left: -64, right: 64, top: 36, bottom: -36, near: 1, far: 130 });
sun.shadow.bias = -.0003;
sun.shadow.normalBias = .025;
scene.add(sun, sun.target);
// touch devices redraw the shadow map every other frame: the shadow pass costs as many draw calls as the main pass
renderer.shadowMap.autoUpdate = bigShadow;
let shadowTick = 0;
// cool, shadowless fill from the front left keeps the machine faces readable
const fill = new THREE.DirectionalLight('#DCE5F0', .38); fill.position.set(-40, 22, 34); scene.add(fill);

/* ---------- textures ---------- */
function canvasTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function drawWood(ctx, w, h, vertical, tone) {
  const light = tone !== 'dark';
  ctx.fillStyle = light ? '#E1BF8F' : '#9C6E45';
  ctx.fillRect(0, 0, w, h);
  const rgb = light ? '150,100,55' : '60,34,16';
  const span = vertical ? h : w, across = vertical ? w : h;
  const n = Math.round(across / 6) + 20;
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = `rgba(${rgb},${(.04 + Math.random() * .13).toFixed(3)})`;
    ctx.lineWidth = .6 + Math.random() * 2.4;
    const amp = 1.5 + Math.random() * 5, f = .004 + Math.random() * .01, ph = Math.random() * 6, o0 = Math.random() * across;
    ctx.beginPath();
    for (let s = 0; s <= span + 8; s += 8) {
      const o = o0 + Math.sin(s * f + ph) * amp + Math.sin(s * f * 3.1 + ph * 2) * amp * .3;
      const [x, y] = vertical ? [o, s] : [s, o];
      s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
}
function woodCanvas(w, h, vertical, tone) { const c = document.createElement('canvas'); c.width = w; c.height = h; drawWood(c.getContext('2d'), w, h, vertical, tone); return c; }
const TEX = {
  woodLid: canvasTex(woodCanvas(1024, 512, false, 'light')),
  woodWall: canvasTex(woodCanvas(128, 512, true, 'light')),
  woodDark: canvasTex(woodCanvas(256, 256, true, 'dark')),
  woodPlain: canvasTex(woodCanvas(512, 512, false, 'light'))
};

/* ---------- shared materials ---------- */
const M = {
  rubber: new THREE.MeshStandardMaterial({ color: '#1B1C1E', roughness: .82 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#E8EAEC', metalness: 1, roughness: .18 }),
  wood: new THREE.MeshPhysicalMaterial({ map: TEX.woodPlain, roughness: .6, clearcoat: .4, clearcoatRoughness: .4 }),
  woodDark: new THREE.MeshPhysicalMaterial({ map: TEX.woodDark, roughness: .6, clearcoat: .3, clearcoatRoughness: .4 }),
  walnut: new THREE.MeshPhysicalMaterial({ map: TEX.woodPlain, color: '#9C6239', roughness: .5, clearcoat: .5, clearcoatRoughness: .3 }),
  chalk: new THREE.MeshPhysicalMaterial({ color: '#F4F3EF', roughness: .4, clearcoat: .6 }),
  graphite: new THREE.MeshStandardMaterial({ color: '#2A2C30', roughness: .45, metalness: .3 }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#FFF3D2', emissive: '#FFE7A8', emissiveIntensity: .35, roughness: .15, clearcoat: 1 }),
  tail: new THREE.MeshPhysicalMaterial({ color: '#B8221E', emissive: '#7A0E0B', emissiveIntensity: .3, roughness: .2, clearcoat: 1 }),
  // headlamp glass: lathe uv runs rim (v 0) to centre (v 1), so rows paint fresnel rings
  glass: new THREE.MeshPhysicalMaterial({ roughness: .06, clearcoat: 1, emissive: '#FFE3A6', emissiveIntensity: .28, map: patTex(32, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FFFDF6'); g.addColorStop(.45, '#F3EAD3'); g.addColorStop(.9, '#CFC8B8'); g.addColorStop(1, '#8E8A82');
    x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(110,92,58,.2)'; for (let y = 22; y < h - 10; y += 11) x.fillRect(0, y, w, 2.5);
    x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < w; i += 8) x.fillRect(i, 18, 2, h - 30);
  }) }),
  lamp: new THREE.MeshPhysicalMaterial({ roughness: .14, clearcoat: 1, emissive: '#6E0C09', emissiveIntensity: .5, map: patTex(128, 64, (x, w, h) => {
    x.fillStyle = '#6F100E'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 8, 0, h - 8); g.addColorStop(0, '#F25A44'); g.addColorStop(1, '#B11E18');
    x.fillStyle = g; x.fillRect(9, 9, w - 18, h - 18); x.fillStyle = 'rgba(255,255,255,.15)'; for (let y = 14; y < h - 10; y += 7) x.fillRect(9, y, w - 18, 2); for (let i = 16; i < w - 10; i += 12) x.fillRect(i, 9, 2, h - 18);
  }) }),
  red: new THREE.MeshStandardMaterial({ color: '#E03B2F', emissive: '#E03B2F', emissiveIntensity: .7, roughness: .3 }),
  blue: new THREE.MeshStandardMaterial({ color: '#2F6BE0', emissive: '#2F6BE0', emissiveIntensity: .7, roughness: .3 }),
  tan: new THREE.MeshPhysicalMaterial({ color: '#B07A47', roughness: .55, clearcoat: .2 }),
  strap: new THREE.MeshStandardMaterial({ color: '#4A3020', roughness: .7 }),
  cut: new THREE.MeshStandardMaterial({ map: TEX.woodPlain, color: '#E7CFA8', roughness: .9, side: THREE.DoubleSide })
};
function finishMat(map, finish) {
  const p = finish === 'gloss' ? { roughness: .3, clearcoat: 1, clearcoatRoughness: .06 }
    : finish === 'satin' ? { roughness: .55, clearcoat: .25, clearcoatRoughness: .45 }
      : { roughness: .62, clearcoat: .55, clearcoatRoughness: .3 };
  return new THREE.MeshPhysicalMaterial({ map, ...p });
}
function paintMat(color, finish) { const m = finishMat(null, finish); m.color.set(color); return m; }

/* ---------- body geometry ---------- */
function roundedContour(path, pts) {
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy, r] = pts[i], [nx, ny] = pts[i + 1];
    const d1 = Math.hypot(cx - px, cy - py), d2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r || 0, d1 * .48, d2 * .48);
    if (rr <= .001) { path.lineTo(cx, cy); continue; }
    path.lineTo(cx + (px - cx) / d1 * rr, cy + (py - cy) / d1 * rr);
    path.quadraticCurveTo(cx, cy, cx + (nx - cx) / d2 * rr, cy + (ny - cy) / d2 * rr);
  }
  const l = pts[pts.length - 1];
  path.lineTo(l[0], l[1]);
}
function buildShape(def) {
  const [w0, w1] = def.wheels;
  const dx = Math.sqrt(AR * AR - (WCY - YB) ** 2), a0 = Math.atan2(YB - WCY, dx);
  const rb = def.pts[0], fb = def.pts[def.pts.length - 1];
  const start = [(rb[0] + (w0 - dx)) / 2, YB, 0], end = [(fb[0] + (w1 + dx)) / 2, YB, 0];
  const s = new THREE.Shape();
  roundedContour(s, [start, ...def.pts, end]);
  s.lineTo(w1 + dx, YB);
  s.absarc(w1, WCY, AR, a0, Math.PI - a0, false);
  s.lineTo(w0 + dx, YB);
  s.absarc(w0, WCY, AR, a0, Math.PI - a0, false);
  s.lineTo(start[0], start[1]);
  return s;
}
const geoCache = {};
function bodyGeo(key) {
  if (geoCache[key]) return geoCache[key];
  const def = BODIES[key], shape = buildShape(def), poly = shape.getPoints(10);
  let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
  for (const p of poly) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
  const B = { xmin: xmin - BV, xmax: xmax + BV, ymin: ymin - BV, ymax: ymax + BV };
  const LX = B.xmax - B.xmin, LY = B.ymax - B.ymin;
  const UV = {
    generateTopUV(g, v, a, b, c) { return [a, b, c].map(i => new THREE.Vector2((v[i * 3] - B.xmin) / LX, (v[i * 3 + 1] - B.ymin) / LY)); },
    generateSideWallUV(g, v, a, b, c, d) { return [a, b, c, d].map(i => new THREE.Vector2((v[i * 3 + 2] + BT) / W, (v[i * 3 + 1] - B.ymin) / LY)); }
  };
  const depth = W - 2 * BT;
  // extrusions shade flat per facet; creased normals keep the lacquer smooth over curves and crisp at real corners
  const geo = BGU.toCreasedNormals(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: BT, bevelSize: BV, bevelSegments: 6, curveSegments: 18, UVGenerator: UV }), .62);
  geo.translate(0, 0, -depth / 2);
  const n = poly.length;
  const ysAt = x => { const r = []; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) r.push(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)); } return r; };
  const xsAt = y => { const r = []; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) r.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)); } return r; };
  const topY = x => { const ys = ysAt(clamp(x, xmin + .02, xmax - .02)); return ys.length ? Math.max(...ys) : YB; };
  const frontX = y => Math.max(...xsAt(y));
  const rearX = y => Math.min(...xsAt(y));
  const blockH = B.ymax - (YB - BV) + .06;
  const block = new RoundedBoxGeometry(LX + .2, blockH, W + .16, 2, .04);
  block.translate((B.xmin + B.xmax) / 2, (YB - BV) + blockH / 2, 0);
  return geoCache[key] = { geo, poly, B, xmin, xmax, ymax, topY, frontX, rearX, block, blockH };
}

/* ---------- livery painting ---------- */
const lum = hex => { const c = new THREE.Color(hex); return .2126 * c.r + .7152 * c.g + .0722 * c.b; };
const contrastOf = hex => lum(hex) > .45 ? '#1E1F22' : '#F4F3EF';
function sideCanvas(def, B, cfg, mode, kind) {
  const LX = B.xmax - B.xmin, LY = B.ymax - B.ymin;
  const cw = kind === 'lid' ? 1024 : 256, ch = kind === 'lid' ? Math.round(1024 * LY / LX) : 512;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  const Y = y => (B.ymax - y) / LY * ch;
  const X = kind === 'lid' ? x => (x - B.xmin) / LX * cw : z => (z + W / 2) / W * cw;
  if (cfg.finish === 'raw') drawWood(ctx, cw, ch, kind === 'wall', 'light');
  else { ctx.fillStyle = cfg.color; ctx.fillRect(0, 0, cw, ch); }
  if (mode !== 'full') return c;
  const A = cfg.accent;
  const band = (y0, y1, col = A) => { ctx.fillStyle = col; ctx.fillRect(0, Y(y1), cw, Y(y0) - Y(y1)); };
  switch (cfg.livery) {
    case 'stripe': band(.6, .78); band(.53, .555); break;
    case 'twotone': band(def.belt, B.ymax + 1); break;
    case 'pinstripe': band(def.belt - .095, def.belt - .07); band(def.belt - .14, def.belt - .115); break;
    case 'checker': {
      const sz = .12, alt = contrastOf(A);
      const from = kind === 'lid' ? B.xmin : -W / 2, to = kind === 'lid' ? B.xmax : W / 2;
      for (let r = 0; r < 2; r++) for (let i = 0, x = from; x < to; i++, x += sz) {
        ctx.fillStyle = (i + r) % 2 ? A : alt;
        const y0 = .56 + r * sz;
        ctx.fillRect(X(x), Y(y0 + sz), X(x + sz) - X(x) + 1, Y(y0) - Y(y0 + sz) + 1);
      }
      break;
    }
    case 'gt':
      if (kind === 'wall') { ctx.fillStyle = A; ctx.fillRect(X(-.34), 0, X(-.11) - X(-.34), ch); ctx.fillRect(X(.11), 0, X(.34) - X(.11), ch); }
      else band(.34, .41);
      break;
  }
  // the wall texture maps every contour face by height, so one glass pane between belt line and roof glazes the windscreen,
  // the rear window, a van's back doors, the pickup's cab back and the racer's canopy: tinted glass with rounded corners,
  // set in a slim dark rubber seal with a fine bright bead, and a soft sky reflection with two streaks across it
  if (kind === 'wall') {
    const ex = cw / W, ey = ch / LY, top = Y((def.roof ? def.roof.y : B.ymax - BV) - .11), bot = Y(def.belt + .1), x0 = X(-W / 2 + .26), x1 = X(W / 2 - .26);
    const pane = (d, r = .1) => { ctx.beginPath(); ctx.roundRect(x0 - d * ex, top - d * ey, x1 - x0 + 2 * d * ex, bot - top + 2 * d * ey, { x: (r + d) * ex, y: (r + d) * ey * .7 }); };
    pane(.034); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill();
    pane(.026); ctx.fillStyle = '#16191D'; ctx.fill();
    pane(.012); ctx.fillStyle = 'rgba(214,220,226,.55)'; ctx.fill();
    pane(.006); ctx.fillStyle = '#1B2027'; ctx.fill();
    pane(0);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, '#6B7E92'); g.addColorStop(.38, '#2E3C4C'); g.addColorStop(1, '#151C25');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    const h = bot - top, w = x1 - x0, streak = (a, b, alpha) => {
      ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.beginPath();
      ctx.moveTo(x0 + w * a, top); ctx.lineTo(x0 + w * b, top); ctx.lineTo(x0 + w * (b - .16), bot); ctx.lineTo(x0 + w * (a - .16), bot); ctx.fill();
    };
    streak(.56, .68, .13); streak(.72, .76, .1);
    const sky = ctx.createLinearGradient(0, top, 0, top + h * .35); sky.addColorStop(0, 'rgba(255,255,255,.16)'); sky.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sky; ctx.fillRect(x0, top, w, h * .35);
    ctx.restore();
  }
  if (kind === 'lid') {
    const k = cw / LX, path = (P, o = 0) => { ctx.beginPath(); P.forEach(([x, y], i) => i ? ctx.lineTo(X(x) + o, Y(y) + o) : ctx.moveTo(X(x) + o, Y(y) + o)); ctx.closePath(); };
    ctx.lineJoin = 'round';
    // door shut lines round the door windows: a dark groove with a light lip
    for (const [rb, rt, ft, fb] of def.windows.slice(def.windows.length > 2 ? -2 : -1)) {
      const d = .07, ys = YB + .15, P = [[rb[0] - d, ys], [rt[0] - d, rt[1] + d], [ft[0] + d * .5, ft[1] + d], [fb[0] + d * 1.6, fb[1]], [fb[0] + d * 1.6, ys]];
      ctx.lineWidth = k * .016;
      path(P, 1.6); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke();
      path(P); ctx.strokeStyle = 'rgba(0,0,0,.34)'; ctx.stroke();
    }
    for (const poly of def.windows) {
      const ys = poly.map(p => Y(p[1]));
      const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
      g.addColorStop(0, '#3D4C5E'); g.addColorStop(1, '#131A23');
      // bright window trim with a fine dark edge, then the glass
      const t = ctx.createLinearGradient(0, Math.min(...ys) - k * .06, 0, Math.max(...ys) + k * .06);
      t.addColorStop(0, '#FBFCFD'); t.addColorStop(.5, '#AEB5BC'); t.addColorStop(1, '#E4E8EB');
      path(poly); ctx.lineWidth = k * .15; ctx.strokeStyle = 'rgba(20,24,28,.4)'; ctx.stroke();
      ctx.lineWidth = k * .125; ctx.strokeStyle = t; ctx.stroke();
      ctx.fillStyle = g; ctx.strokeStyle = g; ctx.lineWidth = k * .08;
      ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.globalAlpha = .14; ctx.fillStyle = '#FFFFFF';
      const x0 = X(Math.min(...poly.map(p => p[0]))), top = Math.min(...ys), bot = Math.max(...ys);
      ctx.beginPath(); ctx.moveTo(x0 + k * .25, top); ctx.lineTo(x0 + k * .45, top); ctx.lineTo(x0 + k * .15, bot); ctx.lineTo(x0 - k * .05, bot); ctx.fill();
      ctx.restore();
    }
  }
  return c;
}
function roundelCanvas(cfg) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const bg = cfg.finish === 'raw' ? cfg.color : (lum(cfg.color) > .8 ? '#1E1F22' : '#F4F3EF');
  x.fillStyle = bg;
  x.fillRect(0, 0, 256, 256);
  x.lineWidth = 14; x.strokeStyle = cfg.accent; x.beginPath(); x.arc(128, 128, 114, 0, Math.PI * 2); x.stroke();
  x.fillStyle = contrastOf(bg);
  x.font = `900 ${cfg.number.length > 1 ? 128 : 150}px Archivo, "Arial Black", sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(cfg.number, 128, 138);
  return c;
}

function plateCanvas(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 80;
  const x = c.getContext('2d');
  x.fillStyle = '#1E1F22'; x.fillRect(0, 0, 256, 80);
  x.fillStyle = '#F2EEE3'; x.beginPath(); x.roundRect(8, 8, 240, 64, 7); x.fill();
  x.fillStyle = '#1E1F22'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '600 11px "IBM Plex Mono", monospace'; x.fillText('HAS WHEELS', 128, 19);
  x.font = '600 38px "IBM Plex Mono", monospace'; x.fillText(text, 128, 47);
  return c;
}

/* ---------- shared part geometry ---------- */
// lathe a [radius, height] profile round z (height -> +z); latheX points it along +x
const latheZ = (pts, n = 48) => { const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), n); g.rotateX(Math.PI / 2); return g; };
const latheX = (pts, n = 28) => latheZ(pts, n).rotateY(Math.PI / 2);
const mergeN = gs => mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g));
const squircle = (a, b, n = 20) => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); return [a * Math.sign(c) * Math.abs(c) ** .6, b * Math.sign(s) * Math.abs(s) ** .6]; });
// sweep a closed section [out, up] along a plan path of [x, z, scale]
function sweep(path, sec) {
  const pos = [], uv = [], idx = [], n = sec.length, m = path.length;
  let len = 0;
  path.forEach(([x, z, s = 1], i) => {
    const [ax, az] = path[Math.max(0, i - 1)], [bx, bz] = path[Math.min(m - 1, i + 1)], l = Math.hypot(bx - ax, bz - az);
    if (i) len += Math.hypot(x - path[i - 1][0], z - path[i - 1][1]);
    sec.forEach(([u, v], j) => { pos.push(x + (bz - az) / l * u * s, v * s, z - (bx - ax) / l * u * s); uv.push(len * 2, j / n); });
  });
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n; idx.push(a, b, a + n, b, b + n, a + n); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// bumper centreline in plan: across the nose at x = 0, round the bevelled corners at offset o, back along the flanks by tail, ends rounded off
function bumperPath(o, tail, e) {
  const ax = BV + o, az = BT + o, zc = W / 2 - BT, P = [];
  for (let k = 4; k > 0; k--) P.push([-ax - tail - e * Math.sin(k * Math.PI / 8), -(zc + az), Math.cos(k * Math.PI / 8)]);
  if (tail > 0) P.push([-ax - tail, -(zc + az)]);
  for (let k = 8; k >= 0; k--) P.push([ax * (Math.cos(k * Math.PI / 16) - 1), -(zc + az * Math.sin(k * Math.PI / 16))]);
  for (let k = 0; k <= 8; k++) P.push([ax * (Math.cos(k * Math.PI / 16) - 1), zc + az * Math.sin(k * Math.PI / 16)]);
  if (tail > 0) P.push([-ax - tail, zc + az]);
  for (let k = 1; k <= 4; k++) P.push([-ax - tail - e * Math.sin(k * Math.PI / 8), zc + az, Math.cos(k * Math.PI / 8)]);
  return P;
}
const PART = {}, partGeo = (k, f) => PART[k] || (PART[k] = f());
const GEO = (() => {
  // tire: rounded shoulders, two tread grooves and a bead on the outer wall
  const tire = latheZ([[.288, -.15], [.3, -.166], [.36, -.17], [.408, -.152], [.434, -.115], [.44, -.07], [.44, -.046], [.432, -.035], [.44, -.024], [.44, .024], [.432, .035], [.44, .046], [.44, .07], [.434, .115], [.408, .152], [.374, .168], [.369, .176], [.36, .176], [.355, .169], [.305, .168], [.288, .15]], 40);
  // turned hub: dished face, a turned ring, and a countersunk bore that seats the axle peg
  const bore = [[.12, .135], [.075, .095], [.056, .095], [.056, .03], [0, .03]];
  const hub = latheZ([[0, -.14], [.29, -.14], [.29, .105], [.282, .128], [.266, .136], [.236, .134], [.228, .124], [.22, .134], [.13, .131], ...bore], 32);
  const hubcap = latheZ([[0, -.14], [.29, -.14], [.29, .1], [.284, .122], [.27, .131], [.252, .127], [.2, .111], [.165, .117], [.14, .131], ...bore], 32);
  const wall = latheZ([[.31, .165], [.356, .165], [.356, .171], [.351, .175], [.315, .175], [.31, .171], [.31, .165]], 40);
  // racing hub: five spokes over a dark well
  const arc = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)); });
  const rs = new THREE.Shape(arc(.285, 0, Math.PI * 2, 40).slice(1));
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * .4 + Math.PI / 2; rs.holes.push(new THREE.Path([...arc(.242, a - .42, a + .42, 6), ...arc(.112, a + .3, a - .3, 4)])); }
  const spokes = new THREE.ExtrudeGeometry(rs, { depth: .2, bevelEnabled: true, bevelThickness: .016, bevelSize: .012, bevelSegments: 2, curveSegments: 1 }); spokes.translate(0, 0, -.081);
  const well = latheZ([[0, -.12], [.28, -.12], [.28, -.04], [0, -.04]], 32);
  // axle peg: a domed head on a shank that sits in the bore
  const peg = latheZ([[0, .04], [.05, .04], [.05, .125], [.094, .125], [.102, .133], [.1, .15], [.088, .178], [.064, .198], [.034, .211], [0, .215]], 20);
  // axle dowel with a turned collar against each hub
  const axle = mergeN([latheZ([[0, -.82], [.05, -.82], [.05, .82], [0, .82]], 16), ...[-1, 1].map(s => latheZ([[0, -.016], [.07, -.016], [.076, -.008], [.076, .008], [.07, .016], [0, .016]], 16).translate(0, 0, s * .695))]);
  // lamps face +x: chrome bezel round a domed lens; tail lens in a chrome surround
  const bezel = latheX([[.096, -.06], [.13, -.06], [.13, .022], [.124, .042], [.11, .05], [.1, .046], [.096, .03], [.096, -.06]]);
  const lens = latheX([[.1, 0], [.096, .016], [.084, .03], [.064, .04], [.036, .046], [0, .048]]);
  const tailLens = new RoundedBoxGeometry(.05, .13, .3, 2, .02).translate(.015, 0, 0);
  const tailBezel = new RoundedBoxGeometry(.04, .16, .34, 1, .018).translate(-.008, 0, 0);
  const plate = new RoundedBoxGeometry(.024, .135, .44, 2, .01);
  // grille: chrome surround and three bars over a dark well
  const rect = (p, w, h, r) => { roundedContour(p, [[0, -h], [w, -h, r], [w, h, r], [-w, h, r], [-w, -h, r], [0, -h]]); return p; };
  const gs = rect(new THREE.Shape(), .34, .095, .05); gs.holes.push(rect(new THREE.Path(), .31, .066, .028));
  const frame = new THREE.ExtrudeGeometry(gs, { depth: .022, bevelEnabled: true, bevelThickness: .008, bevelSize: .006, bevelSegments: 2, curveSegments: 6 }).rotateY(Math.PI / 2);
  const grille = mergeN([frame, ...[-.036, 0, .036].map(y => new THREE.CylinderGeometry(.012, .012, .63, 12).rotateX(Math.PI / 2).translate(.012, y, 0))]);
  const grilleWell = new RoundedBoxGeometry(.03, .17, .66, 2, .03).translate(-.01, 0, 0);
  const exhaust = latheX([[.025, -.24], [.035, -.24], [.035, -.004], [.031, .004], [.025, 0], [.025, -.24]], 20);
  // side trim, mounted at the origin facing +z: door pull, mirror on a stalk, filler cap
  const handle = new RoundedBoxGeometry(.15, .03, .03, 1, .012);
  const mirror = mergeN([new RoundedBoxGeometry(.09, .055, .03, 1, .012), new THREE.CylinderGeometry(.016, .02, .08, 10).rotateX(Math.PI / 2).translate(0, .005, .05), new THREE.CapsuleGeometry(.04, .036, 3, 12).rotateX(Math.PI / 2).scale(.8, 1, 1).translate(0, .022, .13)]);
  const fuel = latheZ([[0, -.012], [.055, -.012], [.055, .006], [.047, .013], [0, .015]], 20);
  // bumper fixings: brackets behind a chrome bar, dowel pins through a wooden one
  const brackets = mergeN([-.45, .45].map(z => new THREE.BoxGeometry(.07, .035, .05).translate(-.072, 0, z)));
  const pins = mergeN([-.5, .5].map(z => new THREE.CylinderGeometry(.02, .02, .03, 14).rotateZ(Math.PI / 2).translate(.045, 0, z)));
  const roundel = new THREE.CircleGeometry(.3, 48);
  const dome = new THREE.SphereGeometry(.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  return { tire, hub, hubcap, wall, spokes, well, peg, axle, bezel, lens, tailLens, tailBezel, plate, grille, grilleWell, exhaust, handle, mirror, fuel, brackets, pins, roundel, dome };
})();
// bumper bars by style and flank length: a chrome blade with rubber strip and over-riders, or a sculpted wooden bar
const bumperGeo = (style, tail) => partGeo(style + tail, () => {
  if (style !== 'chrome') return { bar: sweep(bumperPath(.051, tail, .07), squircle(.055, .068, 16)) };
  const P = bumperPath(.077, tail, .05);
  return { bar: mergeN([sweep(P, squircle(.042, .055, 16)), ...[-.4, .4].map(z => new THREE.CapsuleGeometry(.03, .1, 3, 10).translate(.036, 0, z))]), strip: sweep(P, squircle(.012, .017, 8).map(([u, v]) => [u + .036, v])) };
});
// chrome side trim per body: mirrors at the foot of the A-pillar, a pull on each door, a filler cap over the rear wheel
const sideTrim = key => partGeo('side' + key, () => {
  const def = BODIES[key], G = bodyGeo(key), ws = def.windows, fb = ws[ws.length - 1][3], z0 = W / 2;
  const mx = fb[0] - .06, my = Math.min(fb[1] + .07, G.topY(mx) - .09);
  const gs = [GEO.mirror.clone().translate(mx, my, z0), GEO.mirror.clone().rotateY(Math.PI).translate(mx, my, -z0)];
  for (const w of ws.slice(ws.length > 2 ? -2 : -1)) for (const s of [1, -1]) gs.push(GEO.handle.clone().translate(w[0][0] + .15, w[0][1] - .1, s * (z0 + .004)));
  if (key !== 'racer') { const x = def.wheels[0] - .05; gs.push(GEO.fuel.clone().translate(x, Math.min((WCY + AR + ws[0][0][1]) / 2, G.topY(x) - .085), z0)); }
  return mergeN(gs);
});

/* ---------- car builder ---------- */
// One wheel, centred on its axle, outer face towards +z. Shared by the cars and the wheel magazines.
// A loose wheel shows its bore; the car caps it with the axle peg (maker.peg) once it is pressed on.
function wheelKit(kind, cfg = null, own = x => x) {
  let hub = GEO.hub, hubMat = M.wood, tireMat = M.rubber, pegMat = M.walnut, extra = null;
  if (kind === 'whitewall') { hub = GEO.hubcap; hubMat = pegMat = M.chrome; extra = [GEO.wall, M.chalk]; }
  if (kind === 'racing') { hub = GEO.spokes; hubMat = own(paintMat(cfg.accent, 'gloss')); pegMat = own(paintMat(cfg.finish === 'raw' ? '#1E1F22' : cfg.color, 'gloss')); extra = [GEO.well, M.graphite]; }
  if (kind === 'wood') tireMat = M.woodDark;
  const make = () => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(GEO.tire, tireMat); tire.castShadow = tire.receiveShadow = true;
    w.add(tire, new THREE.Mesh(hub, hubMat));
    if (extra) w.add(new THREE.Mesh(...extra));
    return w;
  };
  make.peg = () => new THREE.Mesh(GEO.peg, pegMat);
  return make;
}
const allCars = new Set();
let woCounter = 0;
// `into`: the ledger record of a queued order (docs/CONTRACTS.md car object), so the 3D car keeps its identity and tab
function buildCar(cfg, full, into = null) {
  const def = BODIES[cfg.body], G = bodyGeo(cfg.body);
  const root = new THREE.Group();
  const car = Object.assign(into || { place: 'preview', cost: null, tab: { total: 0, lines: [] }, broughtForward: 0, scrapped: false }, { cfg, def, G, root, own: [], planes: {}, layers: {}, parts: {}, wo: cfg.wo, status: '' });
  const own = x => (car.own.push(x), x);
  for (const k of ['block', 'raw', 'paint', 'livery']) car.planes[k] = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e5);
  const shadowed = m => { m.castShadow = true; m.receiveShadow = true; return m; };

  // finished body with livery
  const lm = own(finishMat(own(canvasTex(sideCanvas(def, G.B, cfg, 'full', 'lid'))), cfg.finish));
  const wm = own(finishMat(own(canvasTex(sideCanvas(def, G.B, cfg, 'full', 'wall'))), cfg.finish));
  // clipShadows: a coat's shadow is cut with the coat, or the uncut block would shade the car carved inside it
  lm.clippingPlanes = wm.clippingPlanes = [car.planes.livery]; lm.clipShadows = wm.clipShadows = true;
  const liv = new THREE.Group();
  liv.add(shadowed(new THREE.Mesh(G.geo, [lm, wm])));
  if (cfg.number) {
    const rm = own(finishMat(own(canvasTex(roundelCanvas(cfg))), cfg.finish));
    Object.assign(rm, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    rm.clippingPlanes = [car.planes.livery];
    const nx = (def.wheels[0] + def.wheels[1]) / 2;
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(GEO.roundel, rm);
      m.position.set(nx, .69, s * (W / 2 + .004));
      if (s < 0) m.rotation.y = Math.PI;
      liv.add(m);
    }
  }
  if (def.bed) {
    const len = def.bed.x1 - def.bed.x0;
    const ins = new THREE.Mesh(own(new RoundedBoxGeometry(len, .05, W - .36, 2, .02)), M.woodDark);
    ins.position.set((def.bed.x0 + def.bed.x1) / 2, def.bed.y + BV + .015, 0);
    ins.receiveShadow = true;
    liv.add(ins);
  }
  root.add(liv); car.layers.livery = liv;

  if (full) {
    const rawA = own(new THREE.MeshPhysicalMaterial({ map: TEX.woodLid, roughness: .9, color: '#E9D3AE' }));
    const rawB = own(new THREE.MeshPhysicalMaterial({ map: TEX.woodWall, roughness: .9, color: '#E9D3AE' }));
    rawA.clippingPlanes = rawB.clippingPlanes = [car.planes.raw]; rawA.clipShadows = rawB.clipShadows = true;
    car.rawMats = [rawA, rawB];
    car.layers.raw = shadowed(new THREE.Mesh(G.geo, [rawA, rawB]));
    let pa, pb;
    if (cfg.finish === 'raw') { pa = own(finishMat(TEX.woodLid, 'raw')); pb = own(finishMat(TEX.woodWall, 'raw')); }
    else { pa = own(finishMat(own(canvasTex(sideCanvas(def, G.B, cfg, 'plain', 'lid'))), cfg.finish)); pb = own(finishMat(own(canvasTex(sideCanvas(def, G.B, cfg, 'plain', 'wall'))), cfg.finish)); }
    pa.clippingPlanes = pb.clippingPlanes = [car.planes.paint]; pa.clipShadows = pb.clipShadows = true;
    car.layers.paint = shadowed(new THREE.Mesh(G.geo, [pa, pb]));
    const bm = own(new THREE.MeshPhysicalMaterial({ map: TEX.woodLid, roughness: .9, color: '#E9D3AE', side: THREE.DoubleSide }));
    bm.clippingPlanes = [car.planes.block]; bm.clipShadows = true;
    car.layers.block = shadowed(new THREE.Mesh(G.block, bm));
    const capGeo = own(new THREE.PlaneGeometry(W + .16, G.blockH));
    const cap = new THREE.Mesh(capGeo, M.cut);
    cap.rotation.y = Math.PI / 2; cap.position.y = (YB - BV) + G.blockH / 2; cap.visible = false;
    car.layers.cap = cap;
    root.add(car.layers.raw, car.layers.paint, car.layers.block, cap);
  }

  // wheels on wooden axles: the dowel shows in the arches, a peg caps each wheel
  const wg = new THREE.Group(); car.parts.wheels = []; car.parts.axles = [];
  const makeWheel = wheelKit(cfg.wheels, cfg, own);
  for (const wx of def.wheels) {
    const ax = new THREE.Mesh(GEO.axle, M.wood); ax.position.set(wx, WCY, 0); wg.add(ax); car.parts.axles.push(ax);
    for (const s of [1, -1]) {
      const w = makeWheel(), peg = makeWheel.peg();
      const z = s * (W / 2 - .1);
      for (const o of [w, peg]) { o.position.set(wx, WCY, z); if (s < 0) o.rotation.y = Math.PI; }
      wg.add(w, peg);
      car.parts.wheels.push({ g: w, s, z, peg });
    }
  }
  root.add(wg); car.layers.wheels = wg;

  // details: lamps, grille, plate, exhaust, side trim, bumpers, roof
  const det = new THREE.Group();
  const ly = def.lightY, fx = G.frontX(ly) + BV, rx = G.rearX(ly + .06) - BV, by = Math.min(.42, ly - .23);
  // seat a part on the nose (side 1) or tail (side -1), leaning back with the face it sits on
  const put = (o, x, y, z, side, lean = true) => {
    const f = side > 0 ? G.frontX : G.rearX;
    o.position.set(x, y, z); o.rotation.set(0, side > 0 ? 0 : Math.PI, lean ? Math.atan2(side * (f(y - .05) - f(y + .05)), .1) : 0);
    det.add(o); return o;
  };
  const pair = (a, ma, b, mb) => { const g = new THREE.Group(); g.add(new THREE.Mesh(a, ma), new THREE.Mesh(b, mb)); return g; };
  car.parts.lights = [];
  for (const z of [-.58, .58]) {
    car.parts.lights.push(put(pair(GEO.bezel, M.chrome, GEO.lens, M.glass), fx, ly, z, 1));
    car.parts.lights.push(put(pair(GEO.tailBezel, M.chrome, GEO.tailLens, M.lamp), rx, ly + .06, z * 1.02, -1));
  }
  car.parts.lx = { fx, rx, ly };
  const pm = own(new THREE.MeshStandardMaterial({ map: own(canvasTex(plateCanvas(cfg.wo || 'HAS'))), roughness: .4 }));
  const st = new THREE.Mesh(sideTrim(cfg.body), M.chrome); st.userData.pop = 'z'; det.add(st);
  car.parts.trim = [
    put(pair(GEO.grilleWell, M.graphite, GEO.grille, M.chrome), fx, ly, 0, 1),
    put(new THREE.Mesh(GEO.plate, pm), G.rearX(ly + .02) - BV, ly + .02, 0, -1),
    put(new THREE.Mesh(GEO.exhaust, M.chrome), G.rearX(by) - BV - .07, by - .11, -.45, -1, false),
    st
  ];
  car.parts.bumpers = [];
  if (cfg.bumper !== 'none') {
    const chrome = cfg.bumper === 'chrome', o = chrome ? .077 : .051, arch = Math.sqrt(AR * AR - (by - WCY) ** 2);
    for (const side of [1, -1]) {
      const F = side > 0 ? G.frontX(by) : -G.rearX(by), tail = Math.round(clamp(F - side * def.wheels[side > 0 ? 1 : 0] - arch - .08, 0, .16) * 50) / 50;
      const geo = bumperGeo(cfg.bumper, tail), b = new THREE.Group();
      b.add(shadowed(new THREE.Mesh(geo.bar, chrome ? M.chrome : M.wood)));
      if (chrome) b.add(new THREE.Mesh(geo.strip, M.rubber), new THREE.Mesh(GEO.brackets, M.graphite));
      else b.add(new THREE.Mesh(GEO.pins, M.woodDark));
      const x = side * (F + BV + o);
      b.position.set(x, by, 0); b.rotation.y = side > 0 ? 0 : Math.PI;
      Object.assign(b.userData, { x0: x, side, y: by });
      det.add(b); car.parts.bumpers.push(b);
    }
  }
  const roofKind = roofOk(cfg.body, cfg.roof) ? cfg.roof : 'none';
  if (roofKind !== 'none') {
    const r = buildRoof(roofKind, def, cfg, own);
    r.traverse(o => { if (o.isMesh) o.castShadow = true; });
    det.add(r); car.parts.roof = r;
  }
  root.add(det); car.layers.details = det;

  // non-enumerable, so clones (GLB export) skip the circular link back to the car
  root.traverse(o => { Object.defineProperty(o.userData, 'car', { value: car, configurable: true }); });
  allCars.add(car);
  return car;
}
function buildRoof(kind, def, cfg, own) {
  const g = new THREE.Group(), G = bodyGeo(cfg.body), B = cfg.body;
  const accent = own(paintMat(cfg.accent, 'gloss'));
  const mesh = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
  // body surface under x, in group space
  const floor = x => G.topY(g.position.x + x) + BV - g.position.y;
  if (kind === 'spoiler') {
    const s = def.spoiler;
    g.position.set(s.x, G.topY(s.x) + BV, 0);
    // a cambered aerofoil, nose down, between end plates, on two swept struts
    mesh(partGeo('wing', () => {
      const c = .52, L = W * .9, n = 14, F = [];
      for (let i = 0; i <= n; i++) { const u = (1 - Math.cos(i / n * Math.PI)) / 2; F.push([c / 2 - u * c, -.048 * u * (1 - u), .312 * (.2969 * Math.sqrt(u) - .126 * u - .3516 * u * u + .2843 * u ** 3 - .1036 * u ** 4)]); }
      const s = new THREE.Shape(); F.forEach(([x, y, t], i) => i ? s.lineTo(x, y + t) : s.moveTo(x, y + t)); for (let i = n - 1; i > 0; i--) s.lineTo(F[i][0], F[i][1] - F[i][2]); s.closePath();
      const foil = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: true, bevelThickness: .006, bevelSize: .004, bevelSegments: 2, curveSegments: 1 }).translate(0, 0, -L / 2).rotateZ(-.12).translate(0, .37, 0);
      return mergeN([foil, ...[-1, 1].map(z => new RoundedBoxGeometry(.44, .17, .022, 2, .01).translate(-.03, .365, z * (L / 2 + .014)))]);
    }), accent);
    mesh(partGeo('struts' + B, () => { const k = Math.atan2(floor(.06) - floor(-.06), .12); return mergeN([-.42, .42].flatMap(z => [new RoundedBoxGeometry(.08, .42, .035, 1, .014).rotateZ(.18).translate(-.02, .15, z), new RoundedBoxGeometry(.18, .025, .08, 1, .01).rotateZ(k).translate(0, .006, z)])); }), M.graphite);
  } else {
    const r = def.roof, len = Math.max(.7, r.x1 - r.x0);
    g.position.set((r.x0 + r.x1) / 2, r.y + BV, 0);
    if (kind === 'beacon') {
      const y0 = floor(0);
      mesh(partGeo('bar', () => new RoundedBoxGeometry(.3, .09, 1.1, 2, .04).translate(0, .045, 0)), M.graphite, y0);
      mesh(GEO.dome, M.red, y0 + .09).position.z = -.3;
      mesh(GEO.dome, M.blue, y0 + .09).position.z = .3;
      mesh(partGeo('barTrim', () => mergeN([...[-.3, .3].map(z => new THREE.TorusGeometry(.13, .014, 6, 24).rotateX(Math.PI / 2).translate(0, .095, z)), new THREE.CylinderGeometry(.065, .075, .05, 20).translate(0, .115, 0)])), M.chrome, y0);
    } else {
      // roof rack: rails on feet that reach down to the roof, three cross bars on top
      mesh(partGeo('rack' + B, () => {
        const gs = [], h = .15;
        for (const z of [-.6, .6]) {
          gs.push(new THREE.CapsuleGeometry(.03, len, 4, 12).rotateZ(Math.PI / 2).translate(0, h, z));
          for (const x of [-len / 2 + .06, len / 2 - .06]) { const b = floor(x) - .012; gs.push(new THREE.CylinderGeometry(.026, .042, h - b, 14).translate(x, (h + b) / 2, z)); }
        }
        for (const x of [-len / 2 + .12, 0, len / 2 - .12]) gs.push(new THREE.CapsuleGeometry(.025, 1.3, 4, 10).rotateX(Math.PI / 2).translate(x, h + .045, 0));
        return mergeN(gs);
      }), M.graphite);
      if (kind === 'luggage') {
        const bl = Math.min(1.1, len);
        mesh(partGeo('bag' + B, () => new RoundedBoxGeometry(bl, .38, .86, 3, .07).translate(0, .41, 0)), M.tan);
        mesh(partGeo('straps' + B, () => mergeN([...[-.23, .23].map(x => new RoundedBoxGeometry(.07, .4, .9, 2, .08).translate(x * bl, .41, 0)), new THREE.TorusGeometry(.085, .018, 6, 18, Math.PI).scale(1, 1, 2).translate(0, .6, 0), ...[-.085, .085].map(x => new RoundedBoxGeometry(.06, .025, .07, 1, .01).translate(x, .605, 0))])), M.strap);
      }
      if (kind === 'surf') {
        const bl = len + 1.3;
        mesh(partGeo('board' + B, () => { const b = new THREE.CapsuleGeometry(.31, bl - .62, 8, 24).rotateZ(Math.PI / 2); b.scale(1, .13, 1); return b.translate(0, .265, 0); }), accent);
        mesh(partGeo('stringer' + B, () => mergeN([new THREE.BoxGeometry(bl * .86, .012, .05).translate(0, .304, 0), new RoundedBoxGeometry(.2, .14, .02, 2, .008).translate(-bl / 2 + .3, .19, 0)])), M.chalk);
        mesh(partGeo('ties' + B, () => mergeN([-len / 2 + .12, len / 2 - .12].map(x => new RoundedBoxGeometry(.05, .1, .68, 2, .03).translate(x, .265, 0)))), M.strap);
      }
    }
  }
  g.userData.y0 = g.position.y;
  g.userData.h = new THREE.Box3().setFromObject(g).max.y - g.position.y;
  return g;
}
function disposeCar(car, layersOnly) {
  const kill = layersOnly ? ['raw', 'paint', 'block', 'cap'] : null;
  if (kill) {
    // the spent process layers leave with the pallet: free the plain paint canvases, materials and cut cap only they used
    for (const k of kill) {
      const o = car.layers[k]; car.layers[k] = null; if (!o) continue;
      o.removeFromParent();
      for (const m of [].concat(o.material)) { if (car.own.includes(m.map)) m.map.dispose(); if (car.own.includes(m)) m.dispose(); }
      if (car.own.includes(o.geometry)) o.geometry.dispose();
    }
    return;
  }
  car.root.removeFromParent();
  for (const x of car.own) x.dispose && x.dispose();
  allCars.delete(car);
}
function setFinal(car) {
  for (const k of ['raw', 'paint', 'block', 'cap']) if (car.layers[k]) car.layers[k].visible = false;
  car.layers.livery.visible = car.layers.wheels.visible = car.layers.details.visible = true;
  for (const p of Object.values(car.planes)) p.constant = 1e5;
}
const clip = (plane, nx, ny, c) => { plane.normal.set(nx, ny, 0); plane.constant = c; };
const unclip = plane => { plane.constant = 1e5; };

/* ---------- factory floor ---------- */
// power-trowelled concrete, one 6.5 slab per station pitch, saw cuts between stations
function floorTex() { // per-slab detail only (speckle, hairline cracks, saw cut): the splotches live in world space, see mottleTex
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'), R = Math.random;
  x.fillStyle = '#7D7E7F'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) { x.fillStyle = R() < .6 ? `rgba(0,0,0,${(R() * .08).toFixed(3)})` : `rgba(255,255,255,${(R() * .08).toFixed(3)})`; x.fillRect(R() * 512, R() * 512, 1 + R(), 1 + R()); }
  x.strokeStyle = 'rgba(0,0,0,.04)'; x.lineWidth = 1;
  for (let i = 0; i < 10; i++) { let px = R() * 512, py = R() * 512; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 5; k++) x.lineTo(px += (R() - .5) * 70, py += (R() - .5) * 70); x.stroke(); }
  x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, 0, 512, 2); x.fillRect(0, 0, 2, 512);
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 2, 512, 1); x.fillRect(2, 0, 1, 512);
  const t = canvasTex(c), FT = 6.5; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(600 / FT, 400 / FT);
  t.offset.set(-((-23.25 + 278) / FT % 1), -((200 - 3.25) / FT % 1)); return t;
}
function mottleTex() { // soft splotches on a seamless (wrapped) canvas, mid grey = no change
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'), R = Math.random;
  x.fillStyle = '#808080'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 150; i++) {
    const px = R() * 512, py = R() * 512, r = 16 + R() * 80, k = R() < .5 ? '0,0,0,' : '255,255,255,', a = (.05 + R() * .11).toFixed(3);
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, `rgba(${k}${a})`); g.addColorStop(1, `rgba(${k}0)`); x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, 2 * r, 2 * r); }
  }
  const t = canvasTex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex(), roughness: .9 }), mottle = mottleTex();
floorMat.onBeforeCompile = s => { // world-space mottling at three unrelated scales and angles never lines up with the slabs, so no slab copies its neighbour
  s.uniforms.mottle = { value: mottle };
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.)).xz;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vW; uniform sampler2D mottle;').replace('#include <map_fragment>', `#include <map_fragment>
    float m = texture2D(mottle, mat2(.82, -.57, .57, .82) * vW / 29.3).r * .25 + texture2D(mottle, mat2(.26, .97, -.97, .26) * vW / 8.7 + .31).r * .4 + texture2D(mottle, mat2(-.71, .7, -.7, -.71) * vW / 4.9 + .67).r * .35;
    diffuseColor.rgb *= 2.4 * m - .2;`);
};
const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.x = 22; floor.receiveShadow = true; scene.add(floor);
function floorMarks() { // painted markings: walkway along the front, cabinet line behind, station numbers between (after the fonts load)
  const X0 = -31, X1 = 25.5, Z0 = -9, Z1 = 9, S = 36, c = document.createElement('canvas');
  c.width = Math.round((X1 - X0) * S); c.height = Math.round((Z1 - Z0) * S);
  const x = c.getContext('2d'), px = v => (v - X0) * S, pz = v => (v - Z0) * S, wz0 = 6.3, wz1 = 8.1, wx0 = -30, wx1 = 24.5;
  x.fillStyle = 'rgba(70,112,98,.15)'; x.fillRect(px(wx0), pz(wz0), (wx1 - wx0) * S, (wz1 - wz0) * S);
  x.fillStyle = 'rgba(233,177,0,.95)'; for (const z of [wz0, wz1]) x.fillRect(px(wx0), pz(z) - 2.5, (wx1 - wx0) * S, 5);
  x.fillRect(px(wx0), pz(-6.75) - 2, (wx1 - wx0) * S, 4);
  x.strokeStyle = x.fillStyle = 'rgba(255,255,255,.85)'; x.lineCap = 'round'; x.lineWidth = 4;
  for (const wx of [-23.25, -10.25, 2.75, 15.75]) { // walking figure
    const X = px(wx), Z = pz((wz0 + wz1) / 2) + 4;
    x.beginPath(); x.arc(X + 3, Z - 22, 4.5, 0, 7); x.fill();
    x.beginPath(); x.moveTo(X + 1, Z - 14); x.lineTo(X - 2, Z + 1); x.moveTo(X - 2, Z + 1); x.lineTo(X - 9, Z + 14); x.moveTo(X - 2, Z + 1); x.lineTo(X + 6, Z + 14);
    x.moveTo(X + 1, Z - 12); x.lineTo(X + 10, Z - 4); x.moveTo(X + 1, Z - 12); x.lineTo(X - 8, Z - 5); x.stroke();
    x.beginPath(); x.moveTo(X + 22, Z - 8); x.lineTo(X + 34, Z); x.lineTo(X + 22, Z + 8); x.stroke();
  }
  x.fillStyle = 'rgba(30,34,38,.4)'; x.font = '800 40px Archivo, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  SX.forEach((sx, i) => x.fillText('0' + (i + 1), px(sx), pz(4.75)));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, alphaTest: .02, roughness: .85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  m.rotation.x = -Math.PI / 2; m.position.set((X0 + X1) / 2, .004, (Z0 + Z1) / 2); m.receiveShadow = true; scene.add(m);
}

/* ---------- machine kit ---------- */
const yellow = new THREE.MeshStandardMaterial({ color: '#E9B100', roughness: .42 });
const steel = new THREE.MeshStandardMaterial({ color: '#4A525C', roughness: .45, metalness: .55 });
const steelDark = new THREE.MeshStandardMaterial({ color: '#2E343B', roughness: .5, metalness: .4 });
function patTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
}
const hazardTex = patTex(128, 32, (x, w, h) => {
  x.fillStyle = '#E9B100'; x.fillRect(0, 0, w, h); x.fillStyle = '#1E1F22';
  for (let i = -h; i < w + h; i += 32) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 16, h); x.lineTo(i + 16 + h, 0); x.lineTo(i + h, 0); x.fill(); }
}, 6, 1);
const plateTex = patTex(128, 128, (x, w, h) => {
  x.fillStyle = '#8F969D'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.save(); x.translate(i * 16 + 8, j * 16 + 8); x.rotate((i + j) % 2 ? .78 : -.78);
    x.fillStyle = 'rgba(255,255,255,.24)'; x.fillRect(-6, -1.5, 12, 3); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(-6, 1.5, 12, 1.2); x.restore();
  }
}, 8, 8);
const gridTex = (bg, line, n, r = 1) => patTex(128, 128, (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = line; x.lineWidth = 3;
  for (let i = 0; i <= w; i += w / n) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
}, r, r);
// brushed aluminium: fine streaks along v, i.e. along every extrusion
const brushTex = patTex(256, 64, (x, w, h) => {
  x.fillStyle = '#E4E6E8'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 420; i++) { x.fillStyle = Math.random() < .5 ? `rgba(0,0,0,${(.01 + Math.random() * .03).toFixed(3)})` : `rgba(255,255,255,${(.03 + Math.random() * .09).toFixed(3)})`; x.fillRect(Math.random() * w, 0, .6 + Math.random() * 1.4, h); }
}, 3, 1);
const MK = {
  alu: new THREE.MeshStandardMaterial({ color: '#DCE1E6', map: brushTex, roughnessMap: brushTex, metalness: .68, roughness: .42 }),
  aluDark: new THREE.MeshStandardMaterial({ color: '#5D656E', metalness: .55, roughness: .38 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#25272B', roughness: .55 }),
  cabinet: new THREE.MeshStandardMaterial({ color: '#D7DBDE', roughness: .5, metalness: .1 }),
  booth: new THREE.MeshStandardMaterial({ color: '#C3CAD0', roughness: .7 }),
  white: new THREE.MeshStandardMaterial({ color: '#EEF0F2', roughness: .38 }),
  orange: new THREE.MeshStandardMaterial({ color: '#E8762D', roughness: .45, side: THREE.DoubleSide }),
  blue: new THREE.MeshStandardMaterial({ color: '#2F5577', roughness: .4, metalness: .3 }),
  poly: new THREE.MeshStandardMaterial({ color: '#E1EEF5', transparent: true, opacity: .13, roughness: .05, depthWrite: false, side: THREE.DoubleSide }),
  hose: new THREE.MeshStandardMaterial({ color: '#39414A', roughness: .55 }),
  hazard: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: .6 }),
  plate: new THREE.MeshStandardMaterial({ map: plateTex, metalness: .45, roughness: .45 }),
  red: new THREE.MeshStandardMaterial({ color: '#D52B23', roughness: .35 }),
  green: new THREE.MeshStandardMaterial({ color: '#2FA36B', roughness: .35 }),
  zinc: new THREE.MeshStandardMaterial({ color: '#A9B0B7', metalness: .8, roughness: .32 })
};
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m); return m;
}
const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const RB = (w, h, d, r = .04) => new RoundedBoxGeometry(w, h, d, 2, r);
const CY = (rt, rb, h, seg = 24) => new THREE.CylinderGeometry(rt, rb, h, seg);
const CYX = (r, h, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.rotateZ(Math.PI / 2); return g; };
const CYZ = (r, h, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.rotateX(Math.PI / 2); return g; };
const box = (w, h, d, mat, x, y, z, shadow = true) => add(scene, BX(w, h, d), mat, x, y, z, shadow);
// T-slot aluminium extrusion, 1 unit long, scaled per use
const PROF = (() => {
  const h = .1, a = .024, d = .034, c = .008, s = new THREE.Shape();
  const P = [[-h + c, -h], [-a, -h], [-a, -h + d], [a, -h + d], [a, -h], [h - c, -h], [h, -h + c], [h, -a], [h - d, -a], [h - d, a], [h, a], [h, h - c], [h - c, h], [a, h], [a, h - d], [-a, h - d], [-a, h], [-h + c, h], [-h, h - c], [-h, a], [-h + d, a], [-h + d, -a], [-h, -a], [-h, -h + c]];
  P.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
  s.holes.push(new THREE.Path().absarc(0, 0, .021, 0, Math.PI * 2, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -.5); return g;
})();
function prof(parent, axis, len, x, y, z, size = .2, mat = MK.alu) {
  const m = new THREE.Mesh(PROF, mat); m.scale.set(size / .2, size / .2, Math.max(.01, len));
  if (axis === 'x') m.rotation.y = Math.PI / 2; else if (axis === 'y') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
// placed copy of a geometry (non-indexed, ready to merge), merge, and one InstancedMesh for many small repeats
const PG = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => (geo.index ? geo.toNonIndexed() : geo.clone()).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);
const MG = list => BGU.mergeGeometries(list);
const _iq = new THREE.Quaternion(), _ie = new THREE.Euler(), _iv = new THREE.Vector3(), _is = new THREE.Vector3(), _im = new THREE.Matrix4();
function inst(parent, geo, mat, list, shadow = true) { // list of [x, y, z, ry, sx, sy, sz]
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((p, i) => im.setMatrixAt(i, _im.compose(_iv.set(p[0], p[1], p[2]), _iq.setFromEuler(_ie.set(0, p[3] || 0, 0)), _is.set(p[4] || 1, p[5] || p[4] || 1, p[6] || p[4] || 1))));
  im.castShadow = shadow; im.receiveShadow = true; parent.add(im); return im;
}
// levelling foot (pad, nut, stud; a leg starts at y .1), die-cast corner bracket, hex bolt head
const FOOT = MG([PG(CY(.1, .115, .035, 20), 0, .0175), PG(CY(.055, .055, .04, 6), 0, .055), PG(CY(.022, .022, .1, 10), 0, .12)]);
const GUSSET = (() => { const s = new THREE.Shape().moveTo(0, 0).lineTo(.13, 0).lineTo(0, -.13).lineTo(0, 0); const g = new THREE.ExtrudeGeometry(s, { depth: .07, bevelEnabled: false }); g.translate(0, 0, -.035); return g; })();
const BOLT = CY(.022, .022, .018, 6);
// suction cup (roof placer, pallet jib)
const CUP = new THREE.LatheGeometry([[.03, 0], [.1, 0], [.1, .018], [.07, .032], [.088, .048], [.062, .064], [.072, .08], [.04, .1]].map(([r, h]) => new THREE.Vector2(r, h)), 20);
// give a box's six faces (px nx py ny pz nz) material indices, merging neighbours that share one so each costs one draw
const faces = (geo, idx) => { const out = []; geo.groups.forEach((q, i) => { const l = out[out.length - 1]; if (l && l.materialIndex === idx[i]) l.count += q.count; else out.push({ start: q.start, count: q.count, materialIndex: idx[i] }); }); geo.groups = out; return geo; };

/* ---------- conveyor ---------- */
const BELT_X0 = -29.1, BELT_X1 = 25.6, BELT_LEN = BELT_X1 - BELT_X0, BELT_CX = (BELT_X0 + BELT_X1) / 2;
const DR = .15, BZ = 1.5, FZ = 1.66, DY = BELT_Y - DR; // belt wraps the end drums: radius, belt half width, side frames, drum axis
const beltC = document.createElement('canvas'); beltC.width = beltC.height = 256;
{ // modular plastic belt: 8 rows of staggered modules per 1.2, hinge rods between rows
  const x = beltC.getContext('2d'); x.fillStyle = '#2C3035'; x.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) {
    const u = r * 32; x.fillStyle = 'rgba(255,255,255,.025)'; x.fillRect(u + 5, 0, 18, 256);
    x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(u, 0, 2, 256); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(u + 2, 0, 1, 256);
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let k = r % 2 ? 32 : 0; k < 256; k += 64) x.fillRect(u, k, 32, 1);
  }
  x.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 400; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 2, 1);
  x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(3, 0, 26, 256); x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(29, 0, 3, 256); // splice row with a low cleat edge, once per 1.2
}
const beltTex = canvasTex(beltC); beltTex.wrapS = THREE.RepeatWrapping; beltTex.repeat.set((BELT_LEN - 2 * DR) / 1.2, 1);
{
  const bm = new THREE.MeshStandardMaterial({ map: beltTex, roughness: .7 }), wm = new THREE.MeshStandardMaterial({ color: '#2C3035', roughness: .7 }), rl = BELT_LEN - 2 * DR;
  box(rl, .04, 2 * BZ, bm, BELT_CX, BELT_Y - .02, 0);
  box(rl, .04, 2 * BZ, bm, BELT_CX, DY - DR + .02, 0).rotation.z = Math.PI; // return run, flipped so it runs backwards
  for (const [x, a] of [[BELT_X0 + DR, Math.PI], [BELT_X1 - DR, 0]]) {
    const g = new THREE.CylinderGeometry(DR, DR, 2 * BZ, 20, 1, true, a, Math.PI); g.rotateX(Math.PI / 2);
    add(scene, g, wm, x, DY, 0);
    add(scene, CYZ(DR - .045, 2 * BZ + .1, 24), steel, x, DY, 0);
  }
  // side frames: two stacked T-slot profiles, UHMW guide strip on top, flange bearings at the drums
  for (const z of [-FZ, FZ]) {
    for (const y of [DY + .07, DY - .13]) prof(scene, 'x', BELT_LEN, BELT_CX, y, z, .2);
    add(scene, BX(BELT_LEN, .035, .07), MK.white, BELT_CX, DY + .1875, z * (BZ + .045) / FZ, false);
    add(scene, BX(.02, .4, .2), MK.plastic, BELT_X0 - .01, DY - .03, z);
  }
  const fl = MG([PG(RB(.2, .2, .03, .01), 0, 0, 0), PG(CYZ(.075, .07, 20), 0, 0, .05), PG(CYZ(.045, .04, 16), 0, 0, .1)]);
  const fb = [];
  for (const x of [BELT_X0 + DR, BELT_X1 - DR]) for (const s of [-1, 1]) {
    add(scene, fl, MK.aluDark, x, DY, s * (FZ + .115)).rotation.y = s < 0 ? Math.PI : 0;
    for (const dx of [-.07, .07]) for (const dy of [-.07, .07]) fb.push([x + dx, DY + dy, s * (FZ + .14)]);
  }
  const bl = inst(scene, CYZ(.018, .02, 6), MK.zinc, fb, false);
  // legs between the stations: levelling feet, corner brackets, cross brace
  const LX = [BELT_X0 + .55, ...SX.map(x => x - 3.25), SX[6] + 3.25], ft = [], gs = [];
  for (const x of LX) {
    for (const z of [-FZ, FZ]) {
      prof(scene, 'y', DY - .23 - .1, x, (DY - .23 + .1) / 2, z, .16);
      ft.push([x, 0, z]); gs.push([x + .08, DY - .23, z], [x - .08, DY - .23, z, Math.PI]);
    }
    prof(scene, 'z', 2 * FZ - .16, x, .3, 0, .12);
  }
  inst(scene, FOOT, MK.zinc, ft); inst(scene, GUSSET, MK.aluDark, gs);
}
{ // drive: right-angle gear motor on a floor base, chain up to the infeed drum behind a yellow guard
  const xd = BELT_X0 + DR, xm = xd + .78, ym = .3, zg = FZ + .33, r = .19, phi = Math.atan2(ym - DY, xm - xd);
  const sh = new THREE.Shape(); sh.absarc(xm - xd, ym - DY, r, phi - Math.PI / 2, phi + Math.PI / 2, false); sh.absarc(0, 0, r, phi + Math.PI / 2, phi + Math.PI * 1.5, false);
  const gg = new THREE.ExtrudeGeometry(sh, { depth: .12, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2, curveSegments: 12 });
  add(scene, gg, yellow, xd, DY, zg - .06);
  add(scene, RB(.5, .13, .39, .02), steelDark, xm + .15, .065, zg + .285);
  add(scene, RB(.34, .34, .3, .04), MK.blue, xm, ym, zg + .24);
  add(scene, MG([PG(CYX(.15, .5, 28), xm + .42, ym, zg + .24), ...[0, 1, 2, 3, 4].map(k => PG(CYX(.162, .025, 28), xm + .27 + k * .08, ym, zg + .24))]), MK.blue);
  add(scene, CYX(.155, .09, 28), MK.plastic, xm + .71, ym, zg + .24);
  add(scene, RB(.16, .1, .16, .02), MK.blue, xm + .38, ym + .19, zg + .24);
}
for (const z of [-3.45, 3.45]) add(scene, BX(54, .012, .22), MK.hazard, -1, .006, z, false).receiveShadow = true;

{ const t = hazardTex.clone(), hm = new THREE.MeshStandardMaterial({ map: t, roughness: .7 }); t.repeat.set(54 / .88, 1); t.needsUpdate = true; for (const m of scene.children) if (m.material === MK.hazard && m.geometry.parameters.width === 54) m.material = hm; } // floor strips: true-scale stripes

// photo-eye on the near frame at each station, its reflector across the belt
const eyeOn = new THREE.MeshBasicMaterial({ color: '#4CFF9A', toneMapped: false });
const eyeOff = new THREE.MeshStandardMaterial({ color: '#3B2220', roughness: .4 });
inst(scene, RB(.11, .17, .12, .02), MK.plastic, SX.map(x => [x - 2.8, DY + .255, FZ + .02]));
inst(scene, CYZ(.034, .02, 16), new THREE.MeshStandardMaterial({ color: '#0E1216', roughness: .1, metalness: .5 }), SX.map(x => [x - 2.8, DY + .27, FZ - .048]), false);
inst(scene, RB(.11, .15, .05, .015), MK.plastic, SX.map(x => [x - 2.8, DY + .245, -FZ - .03]));
inst(scene, BX(.08, .1, .012), MK.red, SX.map(x => [x - 2.8, DY + .245, -FZ - .001]), false);
const eyes = SX.map(x => add(scene, new THREE.SphereGeometry(.026, 12, 8), eyeOff, x - 2.8, DY + .3, FZ + .08, false));

/* ---------- signs, screens, lights ---------- */
function signCanvas(num, label) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1D2126'; x.fillRect(0, 0, 1024, 256);
  x.fillStyle = '#E9B100'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(256, 0, 768, 6);
  x.fillStyle = '#1D2126'; x.font = '600 116px "IBM Plex Mono", Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(num, 128, 136);
  x.fillStyle = '#F2F3F4'; x.font = '800 124px Archivo, "Arial Black", sans-serif'; x.textAlign = 'left';
  x.fillText(label.toUpperCase(), 312, 140);
  return c;
}
function floorLabel(text, w, h, size, color = 'rgba(30,34,38,.55)') {
  // w is the plate's minimum length: it grows to fit the words in whatever font loaded, so no letter runs off its ends
  const font = `800 ${size}px Archivo, "Arial Black", sans-serif`, k = 1024 / w, c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = font; w = Math.max(w, (x.measureText(text).width + size * .6) / k);
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  x.fillStyle = color; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, c.height / 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, roughness: .9 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); return m;
}
const HMI = [
  ['STOCK  BIRCH', 'BLANK  470 × 225 × 206 MM', 'PICK  VACUUM 4 × Ø60'],
  ['CUTTER  DIAMOND WIRE Ø0.6', 'PROFILE  CAD · ±0.2 MM', 'FEED  2.4 M/MIN'],
  ['FLAP WHEEL  P240', 'SIDE BRUSHES  P320', 'EXTRACT  1 200 M³/H'],
  ['LACQUER  2 COATS', 'GUN  HVLP 1.3 MM', 'BOOTH  23 °C · 55 %RH'],
  ['UV INK  CMYK + W', 'RES  720 × 1440 DPI', 'CURE  395 NM LED'],
  ['PRESS  1.2 KN', 'AXLE  Ø8 MM DOWEL', 'FIT  INTERFERENCE'],
  ['QC  14 POINTS', 'LIGHTS · BUMPERS · ROOF', 'SCAN  0.1 MM'],
  ['BOX  HAS WHEELS RETAIL', 'WINDOW  PET 0.2 MM', 'DOCK  OUTBOUND 01']
];
// 640 × 400 touch panel; the cycle bar mesh lies over the outline at 32..608 × 332..368
// o: { status, dot, foot (right of CYCLE), big (one centred message instead of rows) }; redraws into `c` when given
function hmiCanvas(code, title, lines, o = {}, c = document.createElement('canvas')) {
  c.width = 640; c.height = 400;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, '#132330'); g.addColorStop(1, '#0A141B'); x.fillStyle = g; x.fillRect(0, 0, 640, 400);
  x.fillStyle = '#E9B100'; x.fillRect(0, 0, 640, 66);
  x.fillStyle = '#15181B'; x.font = '600 32px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
  x.fillText(`ST-${code}  ${title.toUpperCase()}`, 26, 35);
  x.beginPath(); x.roundRect(486, 15, 130, 38, 7); x.fill();
  x.fillStyle = o.dot || '#4CFF9A'; x.beginPath(); x.arc(510, 34, 7, 0, 7); x.fill();
  x.fillStyle = '#E9B100'; x.font = '600 24px "IBM Plex Mono", monospace'; x.fillText(o.status || 'AUTO', 528, 35);
  if (o.big) {
    x.textAlign = 'center'; x.fillStyle = '#FF7A6E'; x.font = '600 44px "IBM Plex Mono", monospace'; x.fillText(o.big, 320, 190);
    x.fillStyle = '#6E8A99'; x.font = '500 22px "IBM Plex Mono", monospace'; x.fillText(o.bigSub || '', 320, 244);
  }
  const dy = lines.length > 3 ? 48 : 52, y0 = lines.length > 3 ? 100 : 112;
  if (!o.big) lines.forEach((l, i) => {
    const y = y0 + i * dy, k = l.indexOf('  ');
    x.fillStyle = 'rgba(159,211,199,.12)'; x.fillRect(26, y + dy / 2, 588, 2);
    x.font = '500 25px "IBM Plex Mono", monospace'; x.textAlign = 'left';
    if (k < 0) { x.fillStyle = '#CFEDE6'; x.fillText(l, 26, y); return; }
    x.fillStyle = '#6E8A99'; x.fillText(l.slice(0, k), 26, y);
    x.fillStyle = '#CFEDE6'; x.textAlign = 'right'; x.fillText(l.slice(k + 2), 614, y);
  });
  x.textAlign = 'left'; x.fillStyle = '#6E8A99'; x.font = '500 21px "IBM Plex Mono", monospace'; x.fillText('CYCLE', 32, 308);
  x.textAlign = 'right'; x.fillText(o.foot || '4.1 S', 608, 308);
  x.strokeStyle = '#3A5566'; x.lineWidth = 3; x.strokeRect(30, 330, 580, 40);
  return c;
}
const SLG = { seg: CY(.085, .085, .125, 24), body: MG([PG(CY(.05, .062, .04, 20), 0, .02), PG(CY(.025, .025, .5, 10), 0, .29), PG(CY(.087, .087, .016, 24), 0, .5), ...[1, 2].map(k => PG(CY(.087, .087, .012, 24), 0, .508 + k * .13))]), cap: CY(.06, .086, .05, 24) };
function stackLight(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  add(g, SLG.body, MK.plastic);
  const mats = ['#2FB86A', '#F2A71B', '#E5352B'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .05, roughness: .25, transparent: true, opacity: .92 }));
  mats.forEach((m, i) => add(g, SLG.seg, m, 0, .574 + i * .13, 0, false));
  add(g, SLG.cap, MK.plastic, 0, .574 + 2 * .13 + .088, 0, false);
  let last = '';
  return { set(s) { if (s === last) return; last = s; mats[0].emissiveIntensity = s === 'run' ? 2.4 : .05; mats[1].emissiveIntensity = s === 'wait' ? 1.5 : .05; mats[2].emissiveIntensity = s === 'stop' ? 2 : .05; } };
}
const BAR_GEO = new THREE.PlaneGeometry(1, .026); BAR_GEO.translate(.5, 0, 0);
// control cabinet, shared geometry merged per material: front door at z .298, HMI, buttons, e-stop, louvres, fan filter, glands
const CABG = (() => {
  const z0 = .298, slats = (w, n, y0, dy, z, rx) => [...Array(n).keys()].map(k => PG(BX(w, .012, .03), 0, y0 + k * dy, z, rx));
  const decal = document.createElement('canvas'); decal.width = decal.height = 128;
  { const x = decal.getContext('2d'); x.fillStyle = '#E9B100'; x.strokeStyle = '#15181B'; x.lineWidth = 9; x.lineJoin = 'round'; x.beginPath(); x.moveTo(64, 12); x.lineTo(120, 112); x.lineTo(8, 112); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#15181B'; x.beginPath(); x.moveTo(70, 38); x.lineTo(50, 78); x.lineTo(64, 78); x.lineTo(56, 102); x.lineTo(80, 64); x.lineTo(66, 64); x.lineTo(74, 38); x.fill(); }
  return {
    body: MG([PG(RB(1.05, 1.76, .55, .025), 0, 1.0), PG(RB(.97, 1.68, .03, .012), 0, 1.0, .283)]),
    dark: MG([PG(BX(1.15, .12, .62), 0, .06), PG(RB(.68, .47, .04, .015), -.1, 1.42, z0 + .02), PG(BX(.4, .22, .012), 0, .4, z0 + .006), ...slats(.36, 6, .32, .032, z0 + .018, -.6),
      PG(BX(.012, .3, .3), .531, .72, 0), ...[...Array(7).keys()].map(k => PG(BX(.02, .012, .26), .54, .6 + k * .04, 0)), PG(RB(.06, .24, .025, .01), .4, .95, z0 + .012),
      PG(CYZ(.032, .03, 16), -.08, 1.08, z0 + .015), ...[-.25, -.12, .01].map(gx => PG(CY(.03, .034, .05, 12), gx, 1.905, -.12))]),
    zinc: MG([PG(BX(.035, .16, .03), .4, .93, z0 + .04), PG(CY(.018, .018, .16, 10), -.5, .5, z0 - .005), PG(CY(.018, .018, .16, 10), -.5, 1.5, z0 - .005), PG(BX(.16, .08, .006), .28, .2, z0 + .003), PG(BX(.008, .036, .01), -.08, 1.08, z0 + .034)]),
    yellow: RB(.17, .17, .08, .02), red: MG([PG(CYZ(.062, .04, 24), .33, 1.42, z0 + .1), PG(CYZ(.032, .03, 16), -.2, 1.08, z0 + .015)]), green: PG(CYZ(.032, .03, 16), -.32, 1.08, z0 + .015),
    decal: new THREE.MeshStandardMaterial({ map: canvasTex(decal), transparent: true, alphaTest: .5, roughness: .5 }), decalGeo: new THREE.PlaneGeometry(.13, .13),
    pole: 3.72, board: RB(2.5, .68, .06, .02), z0
  };
})();
function cabinet(i, x, z, code, title) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const C = CABG, z0 = C.z0;
  add(g, C.body, MK.cabinet); add(g, C.dark, MK.plastic); add(g, C.zinc, MK.zinc, 0, 0, 0, false);
  add(g, C.yellow, yellow, .33, 1.42, z0 + .04); add(g, C.red, MK.red, 0, 0, 0, false); add(g, C.green, MK.green, 0, 0, 0, false);
  add(g, C.decalGeo, C.decal, .28, .74, z0 + .002, false);
  const hc = hmiCanvas(code, title, HMI[i] || []), ht = canvasTex(hc);
  add(g, new THREE.PlaneGeometry(.56, .35), new THREE.MeshBasicMaterial({ map: ht, toneMapped: false }), -.1, 1.42, z0 + .041, false);
  const bar = add(g, BAR_GEO, new THREE.MeshBasicMaterial({ color: '#F2B705', toneMapped: false }), -.1 - .252, 1.42 - .133, z0 + .043, false);
  bar.scale.x = .001;
  const light = stackLight(g, .28, 1.88, .1);
  if (i !== 3) { // the paint booth carries its own sign
    prof(g, 'y', C.pole, .42, 1.88 + C.pole / 2, -.15, .12);
    add(g, C.board, MK.aluDark, .42, 5.22, -.06);
    add(g, new THREE.PlaneGeometry(2.4, .6), new THREE.MeshBasicMaterial({ map: canvasTex(signCanvas(code, title)), toneMapped: false }), .42, 5.22, -.028, false);
  }
  return { bar, light, hmi: { c: hc, t: ht, code, title, i, sig: '' } };
}

/* ---------- moving-machine helpers ---------- */
// chain link: two side plates bridged by crossbars, open in the middle where the cables run
const LINKX = MG([...[-1, 1].map(s => PG(RB(.11, .09, .026, .012), 0, 0, s * .067)), PG(BX(.03, .014, .11), 0, .038, 0), PG(BX(.03, .014, .11), 0, -.038, 0)]), LINKZ = LINKX.clone().rotateY(Math.PI / 2);
function dragChain(parent, axis, xa, y, c, r, L) {
  const n = Math.ceil(L / .115);
  const im = new THREE.InstancedMesh(axis === 'x' ? LINKX : LINKZ, MK.plastic, n);
  im.castShadow = true; im.frustumCulled = false; parent.add(im);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let last = NaN;
  const api = {
    update(xc) {
      if (Math.abs(xc - last) < 1e-4) return; last = xc;
      const xb = (L - Math.PI * r + xa + xc) / 2, lo = xb - xa;
      for (let i = 0; i < n; i++) {
        const d = (i + .5) * L / n; let u, v, a;
        if (d < lo) { u = xa + d; v = y; a = 0; }
        else if (d < lo + Math.PI * r) { const f = (d - lo) / r; u = xb + r * Math.sin(f); v = y + r - r * Math.cos(f); a = f; }
        else { u = xb - (d - lo - Math.PI * r); v = y + 2 * r; a = Math.PI; }
        if (axis === 'x') { p.set(u, v, c); e.set(0, 0, a); } else { p.set(c, v, u); e.set(-a, 0, 0); }
        q.setFromEuler(e); m.compose(p, q, one); im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  };
  api.update(xa);
  return api;
}
function hose(parent, r = .06, mat = MK.hose) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.castShadow = true; parent.add(m);
  let key = '';
  return {
    set(pts) {
      const k = pts.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2) + ',' + p.z.toFixed(2)).join('|');
      if (k === key) return; key = k;
      // refill the one tube in place: same segment counts, so the GPU buffers are reused instead of reallocated every frame
      const t = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8, false), g = m.geometry;
      if (!g.index) { m.geometry = t; return; }
      for (const a of ['position', 'normal']) { g.attributes[a].array.set(t.attributes[a].array); g.attributes[a].needsUpdate = true; }
      g.boundingBox = null; g.computeBoundingSphere(); t.dispose();
    }
  };
}
const RT = BELT_Y + .32, RZ = 2.55;
// gantry rails beside the belt: profile beam on three legs, ground linear rail, end stops with rubber buffers
function sideRails(cx, half) {
  const ft = [], bf = [];
  for (const z of [-RZ, RZ]) {
    prof(scene, 'x', half * 2, cx, RT - .14, z, .24);
    add(scene, BX(half * 2 - .04, .05, .1), M.chrome, cx, RT - .005, z);
    for (const lx of [cx - half + .15, cx, cx + half - .15]) { prof(scene, 'y', RT - .26 - .1, lx, (RT - .26 + .1) / 2, z, .18); ft.push([lx, 0, z, 0, 1.15]); }
    for (const s of [-1, 1]) { add(scene, RB(.12, .16, .2, .02), yellow, cx + s * (half - .08), RT + .1, z); bf.push([cx + s * (half - .17), RT + .1, z]); }
  }
  inst(scene, FOOT, MK.zinc, ft); inst(scene, CYX(.05, .06, 14), MK.plastic, bf);
}
function bridge(H) {
  const g = new THREE.Group(); scene.add(g);
  for (const z of [-RZ, RZ]) {
    add(g, RB(.56, .18, .3, .03), MK.aluDark, 0, RT + .11, z);
    add(g, RB(.7, .22, .5, .04), yellow, 0, RT + .3, z);
    prof(g, 'y', H - RT - .4, 0, (H + RT + .4) / 2, z, .26);
    add(g, RB(.4, .05, .44, .015), MK.aluDark, 0, RT + .435, z);
  }
  add(g, RB(.42, .5, 2 * RZ + .6, .05), yellow, 0, H, 0);
  add(g, BX(.05, .05, 2 * RZ), M.chrome, .23, H + .1, 0, false);
  add(g, BX(.05, .05, 2 * RZ), M.chrome, .23, H - .1, 0, false);
  add(g, RB(.22, .22, .36, .03), MK.plastic, .04, H + .37, RZ + .05);
  add(g, CYZ(.03, .06, 10), MK.aluDark, .04, H + .42, RZ + .26);
  add(g, RB(.24, .2, .24, .03), MK.aluDark, .04, H + .35, RZ - .27);
  add(g, BX(.44, .06, 2 * RZ + .5), MK.hazard, 0, H - .28, 0, false);
  return g;
}
function chainTray(x0, x1, z) { const l = x1 - x0, c = (x0 + x1) / 2; add(scene, BX(l, .03, .26), MK.aluDark, c, RT, z); for (const s of [-1, 1]) add(scene, BX(l, .1, .02), MK.aluDark, c, RT + .05, z + s * .13, false); }
// drag chain sized to a bridge travel [c0, c1]: fixed end mid-travel, the loop never passes c1 + r
const bridgeChain = (c0, c1, z) => (chainTray(c0 - .15, c1 + .4, z), dragChain(scene, 'x', (c0 + c1) / 2, RT + .07, z, .26, Math.PI * .26 + (c1 - c0) / 2 + .05));
// polycarbonate guard: posts at xs on levelling feet, top and kick rails per bay, open ends for the belt
function guard(xs, hz, h) {
  const ft = [];
  for (const x of xs) for (const dz of [-hz, hz]) { prof(scene, 'y', h - .1, x, (h + .1) / 2, dz, .16); ft.push([x, 0, dz]); }
  inst(scene, FOOT, MK.zinc, ft);
  for (const dz of [-hz, hz]) for (let k = 1; k < xs.length; k++) {
    const a = xs[k - 1] + .08, b = xs[k] - .08, c = (a + b) / 2;
    prof(scene, 'x', b - a, c, h - .07, dz, .14); prof(scene, 'x', b - a, c, .4, dz, .14);
    add(scene, new THREE.PlaneGeometry(b - a, h - .61), MK.poly, c, (h + .33) / 2, dz, false);
  }
}
const curtainMat = new THREE.MeshBasicMaterial({ color: '#FF4A3D', toneMapped: false });
function lightCurtain(x) {
  for (const s of [-1, 1]) {
    add(scene, RB(.1, BELT_Y + 1.9, .1, .02), MK.plastic, x, (BELT_Y + 1.9) / 2 + .04, s * 2.1);
    add(scene, BX(.022, 1.7, .02), curtainMat, x, BELT_Y + 1.0, s * 2.05, false);
    add(scene, RB(.12, .06, .12, .02), yellow, x, BELT_Y + 1.97, s * 2.1);
    add(scene, RB(.26, .04, .26, .01), MK.aluDark, x, .02, s * 2.1);
  }
}
function dustCollector(x, z) {
  const ft = [];
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + .5, px = x + Math.cos(a) * .67, pz = z + Math.sin(a) * .67; prof(scene, 'y', 1.75, px, .975, pz, .1); ft.push([px, 0, pz, 0, .8]); }
  inst(scene, FOOT, MK.zinc, ft);
  add(scene, CY(.6, .18, .7, 32), MK.blue, x, 1.25, z);
  add(scene, CY(.6, .6, 1.3, 32), MK.blue, x, 2.25, z);
  for (const y of [1.62, 2.9]) add(scene, CY(.64, .64, .06, 32), MK.aluDark, x, y, z);
  add(scene, CY(.56, .56, .9, 32), MK.white, x, 3.35, z);
  add(scene, CY(.36, .56, .14, 32), MK.white, x, 3.87, z);
  add(scene, CY(.2, .2, .3, 20), MK.blue, x, 4.08, z);
  add(scene, CY(.09, .09, .4, 14), MK.hose, x, .7, z);
  add(scene, CY(.26, .24, .42, 24), MK.aluDark, x, .27, z);
  add(scene, CYZ(.16, .6, 20), MK.alu, x, 2.6, z + .7);
  add(scene, CYZ(.2, .05, 20), MK.aluDark, x, 2.6, z + .99);
}
// six-axis robots: shoulder offset RA1, J2 at RHS above the J1 turret, forearm axis RC above J3, J4 roll from RJ4, flange RJ6 past J5
const RA1 = .14, RHS = .62, RTY = .32, RC = .16, RJ4 = .46, RJ6 = .15, RZA = .37;
const RM4 = new THREE.Matrix4(), REU = new THREE.Euler(), RGEO = {};
// one geometry per material from [geo, x, y, z, rx, ry, rz] parts
function bake(parts) {
  const gs = parts.map(([g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(RM4.makeRotationFromEuler(REU.set(rx, ry, rz)).setPosition(x, y, z)));
  const n = gs.reduce((s, g) => s + g.attributes.position.array.length, 0), P = new Float32Array(n), N = new Float32Array(n);
  let o = 0; for (const g of gs) { P.set(g.attributes.position.array, o); N.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return out;
}
// bevelled extrusion of a side profile, centred on z, smooth across soft edges like a casting
function casting(shape, depth, bev = .04) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 20 });
  g.translate(0, 0, bev - depth / 2);
  const p = g.attributes.position.array, nr = g.attributes.normal.array, F = [], at = new Map(), A = V3(), B = V3(), C = V3();
  const key = i => Math.round(p[i] * 1e3) + ',' + Math.round(p[i + 1] * 1e3) + ',' + Math.round(p[i + 2] * 1e3);
  for (let i = 0; i < p.length; i += 9) {
    const f = B.fromArray(p, i + 3).sub(A.fromArray(p, i)).cross(C.fromArray(p, i + 6).sub(A)).clone(); F.push(f);
    for (let k = i; k < i + 9; k += 3) { const s = key(k); at.has(s) ? at.get(s).push(f) : at.set(s, [f]); }
  }
  for (let i = 0; i < p.length; i += 3) {
    const f = F[i / 9 | 0], s = A.set(0, 0, 0);
    for (const o of at.get(key(i))) if (o.dot(f) > .5 * o.length() * f.length()) s.add(o);
    s.normalize().toArray(nr, i);
  }
  return g;
}
// tapered link between hubs r0 at x=0 and r1 at x=L
function linkShape(L, r0, r1) {
  const s = new THREE.Shape(), t = Math.PI / 2 - Math.asin((r0 - r1) / L);
  s.absarc(L, 0, r1, -t, t, false); s.absarc(0, 0, r0, t, 2 * Math.PI - t, false); return s;
}
const around = (n, f) => Array.from({ length: n }, (_, i) => f(i / n * Math.PI * 2));
const RBOLT = CY(.018, .018, .022, 6), BOLTS = CY(.011, .011, .014, 6);
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const DECAL = new THREE.MeshStandardMaterial({ roughness: .45, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, map: canvasTex((() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#E9B100'; x.beginPath(); x.roundRect(4, 14, 168, 100, 14); x.fill();
  x.fillStyle = '#1D2126'; x.font = '800 74px Archivo, "Arial Black", sans-serif'; x.textBaseline = 'middle'; x.fillText('HAS', 18, 68);
  x.fillStyle = '#2E343B'; x.font = '600 58px "IBM Plex Mono", Menlo, monospace'; x.fillText('R-2100', 196, 70);
  x.lineJoin = 'round'; x.lineWidth = 9; x.strokeStyle = '#1D2126'; x.fillStyle = '#E9B100';
  x.beginPath(); x.moveTo(470, 22); x.lineTo(508, 104); x.lineTo(432, 104); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#1D2126'; x.fillRect(466, 50, 8, 30); x.fillRect(466, 87, 8, 8);
  return c;
})()) });
const DECAL_GEO = new THREE.PlaneGeometry(.64, .16);
const DRESS = new THREE.MeshStandardMaterial({ roughness: .6, map: patTex(64, 8, (x, w, h) => { x.fillStyle = '#2A3036'; x.fillRect(0, 0, w, h); x.fillStyle = '#41484F'; for (let i = 0; i < w; i += 8) x.fillRect(i, 0, 3, h); }, 40, 1) });
function robotGeo(L1, L2, kind) {
  const key = L1 + '|' + L2 + '|' + kind; if (RGEO[key]) return RGEO[key];
  const Lw = L2 - RJ4, R0 = .27, R1 = .21, rAt = f => R0 + (R1 - R0) * f, G = {};
  // cast base: square foot, lathed body, bolt ring, connector box at the rear (-x)
  G.base = {
    body: bake([[RB(.84, .07, .84, .03), 0, .035], [lathe([[.37, .07], [.37, .09], [.345, .11], [.325, .16], [.318, .24], [.31, .28], [.3, .3]])], [RB(.16, .17, .32, .03), -.37, .16]]),
    dark: bake([[CY(.322, .322, .03, 40), 0, .315], ...around(16, a => [RBOLT, Math.cos(a) * .395, .081, Math.sin(a) * .395]),
      ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].flatMap(([i, j]) => [[CY(.05, .05, .01, 16), i * .34, .075, j * .34], [CY(.034, .034, .03, 6), i * .34, .095, j * .34]]),
      ...[-1, 1].flatMap(s => [[CYX(.05, .035, 16), -.515, .17, s * .075], [BX(.012, .12, .26), -.455, .16, 0]])]),
    alu: bake([-1, 1].map(s => [CYX(.042, .06, 16), -.47, .17, s * .075])),
    hose: bake([-1, 1].map(s => [new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-.545, .17, s * .075), V3(-.62, .12, s * .08), V3(-.63, -.1, s * .09), V3(-.5, -.3, s * .09), V3(-.351, -.36, s * .09)]), 24, .032, 8)]))
  };
  // J1 turret: plinth, cast housing up to the J2 hub, J2 motor on the far side, J1 motor at the back
  const hs = new THREE.Shape(); hs.moveTo(-.3, .16); hs.lineTo(.28, .16); hs.quadraticCurveTo(.37, .16, .37, .3); hs.lineTo(.37, RHS);
  hs.absarc(RA1, RHS, .23, 0, Math.PI * .8, false); hs.lineTo(-.2, .68); hs.quadraticCurveTo(-.3, .66, -.3, .54); hs.lineTo(-.3, .16);
  G.turret = {
    body: bake([[CY(.31, .32, .12, 40), 0, .07], [casting(hs, .42, .04), 0, 0, -.01], [CYZ(.2, .05, 32), RA1, RHS, -.245], [CYZ(.165, .07, 32), RA1, RHS, -.3], [RB(.18, .2, .16, .04), -.3, .42, -.06]]),
    dark: bake([[CYZ(.12, .22, 28), RA1 - .02, RHS + .02, -.43], ...[-.38, -.44, -.5].map(z => [CYZ(.126, .012, 28), RA1 - .02, RHS + .02, z]),
      [RB(.11, .07, .12, .02), RA1 - .02, RHS + .16, -.43], [CYZ(.255, .03, 40), RA1, RHS, .215], [CY(.085, .085, .26, 24), -.32, .62, -.06],
      [CYX(.05, .07, 16), -.36, .46, .1], ...around(8, a => [BOLTS, RA1 + Math.cos(a) * .165, RHS + Math.sin(a) * .165, -.272, Math.PI / 2])]),
    acc: bake([[CYZ(.128, .035, 28), RA1 - .02, RHS + .02, -.555], [CY(.092, .092, .035, 24), -.32, .765, -.06], [CY(.326, .326, .025, 40), 0, .1425]])
  };
  // upper arm: tapered cast link beside the column, bosses on its outer face, dress-pack clamps on top
  G.sh = {
    body: bake([[casting(linkShape(L1, R0 - .04, R1 - .04), .28, .04), 0, 0, RZA], [CYZ(.2, .04, 36), 0, 0, .53], [CYZ(.15, .04, 32), L1, 0, .53]]),
    dark: bake([...around(8, a => [RBOLT, Math.cos(a) * .165, Math.sin(a) * .165, .56, Math.PI / 2]), ...around(6, a => [BOLTS, L1 + Math.cos(a) * .118, Math.sin(a) * .118, .555, Math.PI / 2]),
      ...[.3, .66].map(f => [RB(.1, .08, .2, .02), L1 * f, rAt(f) + .02, RZA])]),
    acc: bake([[CYZ(.13, .03, 32), 0, 0, .565], [CYZ(.09, .03, 28), L1, 0, .565]])
  };
  // J3 casting: wraps the elbow hub, carries the wrist motors at the back and the J3 motor on the far side; forearm collar in front
  const es = new THREE.Shape(); es.moveTo(.31, RC - .1); es.lineTo(.31, RC + .09); es.quadraticCurveTo(.31, RC + .15, .24, RC + .15); es.lineTo(-.28, RC + .15);
  es.quadraticCurveTo(-.39, RC + .15, -.39, RC + .05); es.lineTo(-.39, .03); es.quadraticCurveTo(-.39, -.045, -.26, -.05); es.absarc(0, 0, .165, Math.PI * 1.1, Math.PI * 1.86, false); es.lineTo(.31, RC - .1);
  G.el = {
    body: bake([[casting(es, .4, .05)], [CYZ(.16, .04, 32), -.04, .02, -.22], [CYX(.165, .1, 32), .4, RC]]),
    dark: bake([[CYZ(.215, .03, 40), 0, 0, .215], [CYZ(.1, .2, 28), -.04, .02, -.34], ...[-.29, -.36].map(z => [CYZ(.104, .01, 28), -.04, .02, z]),
      [RB(.03, .2, .26, .012), -.448, RC - .01], [CYX(.168, .02, 32), .455, RC], [CY(.06, .068, .1, 16), -.12, RC + .25]]),
    acc: bake([[CYZ(.105, .03, 28), -.04, .02, -.455], ...[-1, 1].map(s => [CYX(.028, .05, 16), -.47, RC + .1, s * .07])])
  };
  // rolling forearm with the wrist fork, then the J5 hub; the tool changer doubles as the J6 flange
  const pr = new THREE.Shape(); pr.moveTo(Lw - .33, -.085); pr.lineTo(Lw, -.085); pr.absarc(Lw, 0, .085, -Math.PI / 2, Math.PI / 2, false); pr.lineTo(Lw - .33, .085);
  G.j4 = {
    body: bake([[CY(.115, .15, Lw - .3, 36), (Lw - .3) / 2, 0, 0, 0, 0, -Math.PI / 2], [CYX(.122, .06, 32), Lw - .3], ...[-1, 1].map(s => [casting(pr, .06, .015), 0, 0, s * .105])]),
    dark: bake([[CYX(.124, .015, 32), Lw - .265], [CYX(.152, .012, 32), .02]]),
    acc: bake([-1, 1].map(s => [CYZ(.06, .02, 24), Lw, 0, s * .145]))
  };
  G.j5 = { body: bake([[CYZ(.082, .148, 32), 0, 0, 0], [CYX(.068, .14, 28), .08]]), dark: bake([[CYX(.071, .025, 28), .125]]) };
  if (kind === 'gun') { // right-angle rotary bell: body along the flange axis, turbine head, shaping-air ring, bell cup facing +y
    const hemi = new THREE.SphereGeometry(.1, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    G.tool = {
      body: bake([[CYX(.088, .27, 32), .18], [CY(.1, .1, .2, 36), .38, .01], [hemi, .38, -.09]]),
      dark: bake([[CYX(.07, .05, 28), .025], [CYX(.092, .014, 32), .085], [CYX(.092, .014, 32), .26], [RB(.17, .07, .12, .02), .17, -.1], [CY(.102, .102, .016, 36), .38, .075]]),
      alu: bake([[CY(.106, .1, .035, 36), .38, .126], ...[-1, 1].map(s => [CY(.022, .022, .03, 12), .13, -.15, s * .035])]),
      chrome: bake([[lathe([[.03, .14], [.05, .15], [.078, .168], [.1, .186], [.099, .197], [.072, .192], [.036, .18]], 36), .38]])
    };
    G.tip = V3(.38, .197, 0); G.inlet = [[.13, -.165, -.035], [.13, -.165, .035]].map(p => V3(...p)); G.inDir = V3(0, -1, 0);
  } else { // parallel pneumatic gripper: changer, body, jaw guide, two jaws closing vertically, fingers with rubber pads
    G.tool = {
      dark: bake([[CYX(.075, .05, 28), .025], [BX(.03, .37, .066), .23]]),
      alu: bake([[CYX(.083, .014, 28), .057], ...[-1, 1].map(s => [RB(.1, .22, .012, .004), .15, 0, s * .086])]),
      gray: bake([[RB(.16, .34, .16, .03), .14], [RB(.05, .06, .05, .01), .11, .09, -.1]]),
      blue: bake([-1, 1].map(s => [CY(.017, .017, .04, 12), .11, .188, s * .04]))
    };
    G.finger = bake([[BX(.07, .07, .11), .28], [RB(.22, .04, .075, .012), .395]]);
    G.pad = bake([[RB(.1, .016, .08, .005), .455, -.027]]);
    G.tip = V3(.5, 0, 0); G.inlet = [[.11, .208, -.04], [.11, .208, .04]].map(p => V3(...p)); G.inDir = V3(0, 1, 0);
  }
  return RGEO[key] = G;
}
// steel riser of height h: anchored floor plate, gusseted column, hazard collar, top plate, cable gland at the back (-x)
function riser(g, h) {
  const k = 'riser' + h, y0 = .013, H = h - .002;
  const R = RGEO[k] || (RGEO[k] = (() => {
    const t = new THREE.Shape(); t.moveTo(.28, y0 + .04); t.lineTo(.42, y0 + .04); t.lineTo(.28, y0 + .3);
    const gus = new THREE.ExtrudeGeometry(t, { depth: .03, bevelEnabled: false }); gus.translate(0, 0, -.015);
    const c = [[-.37, -.37], [-.37, .37], [.37, -.37], [.37, .37]];
    return {
      plate: bake([[RB(.9, .04, .9, .012), 0, y0 + .02], [RB(.88, .05, .88, .012), 0, H - .025], [RB(.07, .14, .3, .02), -.315, H - .36]]),
      col: bake([[RB(.56, H - y0 - .09, .56, .03), 0, (H + y0 - .01) / 2], ...[0, 1, 2, 3].map(i => [gus, 0, 0, 0, 0, i * Math.PI / 2])]),
      bolt: bake(c.flatMap(([i, j]) => [[CY(.06, .06, .01, 20), i, y0 + .045, j], [CY(.04, .04, .035, 6), i, y0 + .0675, j], [CY(.016, .016, .03, 10), i, y0 + .1, j]]))
    };
  })());
  add(g, R.plate, steelDark); add(g, R.col, steel); add(g, R.bolt, MK.alu);
  add(g, BX(.585, .1, .585), MK.hazard, 0, H - .1);
}
function robotArm(x, y, z, bodyMat, L1, L2, kind) {
  const G = robotGeo(L1, L2, kind), Lw = L2 - RJ4, L2e = Math.hypot(L2, RC), B3 = Math.atan2(RC, L2), T6 = G.tip, bent = T6.y > 0;
  const mats = { body: bodyMat, dark: steelDark, acc: bodyMat === MK.white ? yellow : MK.plastic, alu: MK.alu, chrome: M.chrome, gray: MK.aluDark, blue: MK.blue, hose: MK.hose };
  const part = (parent, set, px = 0, py = 0, pz = 0) => { const g = new THREE.Group(); g.position.set(px, py, pz); parent.add(g); for (const m in set) add(g, set[m], mats[m]); return g; };
  const top = new THREE.Group(); scene.add(top); // one root: riser, robot and hoses are one assembly
  const cell = part(top, {}, x, 0, z); cell.rotation.y = z > 0 ? Math.PI / 2 : -Math.PI / 2; riser(cell, y);
  const base = part(cell, G.base, 0, y);
  const turret = part(base, G.turret, 0, RTY), sh = part(turret, G.sh, RA1, RHS), el = part(sh, G.el, L1);
  add(sh, DECAL_GEO, DECAL, L1 * .5, -.01, RZA + .142, false);
  const j4 = part(el, G.j4, RJ4, RC), j5 = part(j4, G.j5, Lw), j6 = part(j5, {}, RJ6);
  part(j6, G.tool);
  const fingers = G.finger ? [1, -1].map(s => { const f = new THREE.Group(); f.scale.y = s; j6.add(f); add(f, G.finger, MK.alu); add(f, G.pad, MK.plastic); return f; }) : null;
  // dress pack from the turret along the upper arm, looping high over the elbow and dropping straight into the gland on the J3 casting
  const P = (o, x, y, z) => [o, V3(x, y, z), V3()];
  const dress = [P(turret, -.4, .46, .1), P(turret, -.55, .8, .26), P(sh, .3, rAt(.3) + .07, RZA), P(sh, L1 * .66, rAt(.66) + .07, RZA), P(sh, L1 - .14, .33, .3), P(sh, L1 + .04, .48, .27), P(el, 0, RC + .44, .13), P(el, -.12, RC + .38, .02), P(el, -.12, RC + .27, 0)];
  function rAt(f) { return .27 - .06 * f; }
  const dressH = hose(top, .045, DRESS), at = pts => pts.map(([o, v, w]) => o.localToWorld(w.copy(v)));
  // tool lines: out of the J3 casing, along the upper side of the rolling forearm, over the wrist, into the tool inlets
  const lineH = [0, 1].map(i => hose(top, .018, bent ? (i ? yellow : MK.hose) : MK.blue)), LP = [0, 1].map(() => Array.from({ length: 6 }, () => V3()));
  const nUp = V3(0, 1, 0), X4 = V3(), S4 = V3(), O4 = V3(), O5 = V3(), X6 = V3(), tv = V3();
  function routeLines() {
    const m = j4.matrixWorld.elements, m6 = j6.matrixWorld.elements; X4.set(m[0], m[1], m[2]); O4.set(m[12], m[13], m[14]); O5.setFromMatrixPosition(j5.matrixWorld); X6.set(m6[0], m6[1], m6[2]);
    tv.set(0, 1, 0).addScaledVector(X4, -X4.y); if (tv.lengthSq() > .02) nUp.copy(tv).normalize(); else nUp.addScaledVector(X4, -nUp.dot(X4)).normalize();
    S4.crossVectors(X4, nUp);
    LP.forEach((p, i) => {
      const o = (i ? 1 : -1) * .032;
      el.localToWorld(p[0].set(.26, RC + .228, o));
      p[1].copy(O4).addScaledVector(X4, Lw * .3).addScaledVector(nUp, .175).addScaledVector(S4, o);
      p[2].copy(O4).addScaledVector(X4, Lw - .42).addScaledVector(nUp, .16).addScaledVector(S4, o);
      p[3].copy(O5).addScaledVector(nUp, .17).addScaledVector(X6, .05).addScaledVector(S4, o);
      j6.localToWorld(p[4].copy(G.inDir).multiplyScalar(.075).add(G.inlet[i])); j6.localToWorld(p[5].copy(G.inlet[i]));
      lineH[i].set(p);
    });
  }
  const Fv = V3(), Uv = V3(), Hv = V3(), Wc = V3(), dir = V3();
  const cur = { tip: V3(x, y + 2.4, z * .55), aim: V3(x, y + 2.1, 0), lift: 0 }, Tp = V3(), Ap = V3();
  let gc = 0;
  const api = {
    tipWorld(out) { return j6.localToWorld(out.copy(T6)); },
    grip(g, dt) { if (!fingers) return; gc += (g - gc) * (1 - Math.exp(-26 * dt)); fingers.forEach((f, i) => { f.position.y = (i ? -1 : 1) * (.115 - gc * .055); }); },
    reach(tip, aim, k) {
      // long moves arc up and out, away from the belt, short tracking moves stay on the surface
      cur.lift += (clamp((cur.tip.distanceTo(tip) - .5) * .5, 0, .3) - cur.lift) * k;
      cur.tip.lerp(tip, k); cur.aim.lerp(aim, k); Hv.set(0, cur.lift, Math.sign(z) * cur.lift); Tp.copy(cur.tip).add(Hv); Ap.copy(cur.aim).add(Hv);
      dir.copy(Ap).sub(Tp); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); dir.normalize();
      // flange axis: along the spray for a straight tool, 90° below it for the right-angle bell
      const hl = Math.hypot(dir.x, dir.z);
      if (bent && hl > 1e-3) Fv.set(dir.x / hl * dir.y, -hl, dir.z / hl * dir.y); else Fv.copy(dir);
      Wc.copy(Tp).addScaledVector(Fv, -(RJ6 + T6.x)).addScaledVector(dir, -T6.y);
      const yaw = Math.atan2(z - Wc.z, Wc.x - x), cy = Math.cos(yaw), sy = Math.sin(yaw);
      turret.rotation.y = yaw - cell.rotation.y;
      const r = Math.hypot(Wc.x - x, Wc.z - z) - RA1, h = Wc.y - y - RTY - RHS, D = clamp(Math.hypot(r, h), Math.abs(L1 - L2e) + .05, L1 + L2e - .02);
      const a = Math.atan2(h, r) + Math.acos(clamp((L1 * L1 + D * D - L2e * L2e) / (2 * L1 * D), -1, 1));
      const e = Math.acos(clamp((L1 * L1 + L2e * L2e - D * D) / (2 * L1 * L2e), -1, 1)) - Math.PI - B3;
      sh.rotation.z = a; el.rotation.z = e;
      // flange axis in the forearm frame: J4 rolls it into the J5 bend plane (nearest of the two solutions), J5 bends
      const fx = Fv.x * cy - Fv.z * sy, cp = Math.cos(a + e), sp = Math.sin(a + e), lx = fx * cp + Fv.y * sp, ly = Fv.y * cp - fx * sp, lz = Fv.x * sy + Fv.z * cy;
      if (Math.hypot(ly, lz) > .03) { const w = Math.atan2(lz, ly) - j4.rotation.x; j4.rotation.x += w - Math.round(w / Math.PI) * Math.PI; }
      j5.rotation.z = Math.atan2(ly * Math.cos(j4.rotation.x) + lz * Math.sin(j4.rotation.x), lx);
      // J6 turns the tool's +y to the spray (bell) or to world up (gripper)
      cell.updateMatrixWorld(true);
      if (bent) Uv.copy(dir); else Uv.set(0, 1, 0).addScaledVector(Fv, -Fv.y).addScaledVector(Hv.set(cy, 0, -sy), .04);
      const m = j6.matrixWorld.elements;
      j6.rotation.x += Math.atan2(Uv.x * m[8] + Uv.y * m[9] + Uv.z * m[10], Uv.x * m[4] + Uv.y * m[5] + Uv.z * m[6]);
      j6.updateMatrixWorld(true);
      dressH.set(at(dress)); routeLines();
    }
  };
  api.reach(cur.tip, cur.aim, 0); api.grip(0, 0);
  return api;
}

/* ---------- particles ---------- */
const PN = 2000;
const pPos = new Float32Array(PN * 3).fill(-999), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .075, vertexColors: true, transparent: true, opacity: .9, depthWrite: false }));
particles.frustumCulled = false; scene.add(particles);
let pIdx = 0;
const tmpC = new THREE.Color();
function emitDir(x, y, z, dx, dy, dz, color, n, spd, spread, life = 1) {
  tmpC.set(color);
  for (let k = 0; k < n; k++) {
    const i = pIdx = (pIdx + 1) % PN, s = spd * (.5 + Math.random() * .7);
    pPos[i * 3] = x + (Math.random() - .5) * .08; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z + (Math.random() - .5) * .08;
    pVel[i * 3] = dx * s + (Math.random() - .5) * spread; pVel[i * 3 + 1] = dy * s + (Math.random() - .5) * spread; pVel[i * 3 + 2] = dz * s + (Math.random() - .5) * spread;
    const j = .85 + Math.random() * .3;
    pCol[i * 3] = tmpC.r * j; pCol[i * 3 + 1] = tmpC.g * j; pCol[i * 3 + 2] = tmpC.b * j;
    pLife[i] = life * (.6 + Math.random() * .6);
  }
  pGeo.attributes.color.needsUpdate = true;
}
const emit = (x, y, z, color, n, spread, vy, life = 1) => emitDir(x, y, z, 0, 1, 0, color, n, vy, spread, life);
function updateParticles(dt) {
  let live = false;
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt; live = true;
    if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
    pVel[i * 3 + 1] -= 6 * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    if (pPos[i * 3 + 1] < .02) { pPos[i * 3 + 1] = .02; pVel[i * 3] *= .5; pVel[i * 3 + 1] = 0; pVel[i * 3 + 2] *= .5; }
  }
  // upload only while particles live; colours change only when emitted
  if (live) pGeo.attributes.position.needsUpdate = true;
}

/* ---------- stations ---------- */
const ST = [];
const CAB_X = [SX[0] + 2.2, SX[1], SX[2], SX[3], SX[4], SX[5], SX[6]];
function station(i, tool) { ST[i] = { tool, cab: cabinet(i, CAB_X[i], -5.75, '0' + (i + 1), STATIONS[i]), eye: eyes[i] }; }
const INZ = -3.95, IT = 1.0;
function blankHead(p, u) {
  const bh = u.car.G.blockH, ry = u.root.position.y;
  const pick = IT + bh, place = ry + .2 + bh, high = Math.max(pick, place) + .9;
  let z = INZ, y = high;
  if (p < .14) y = lerp(high, pick, ease(p / .14));
  else if (p < .2) y = pick;
  else if (p < .32) y = lerp(pick, high, ease(seg(p, .2, .32)));
  else if (p < .55) { z = lerp(INZ, 0, ease(seg(p, .32, .55))); }
  else if (p < .7) { z = 0; y = lerp(high, place, ease(seg(p, .55, .7))); }
  else if (p < .78) { z = 0; y = place; }
  else if (p < .88) { z = 0; y = lerp(place, high, ease(seg(p, .78, .88))); }
  else z = lerp(0, INZ, ease(seg(p, .88, 1)));
  return { z, y };
}
const VA = new THREE.Vector3(), VB = new THREE.Vector3(), VC = new THREE.Vector3(), VD = new THREE.Vector3();
// the car rolling into station i while the belt moves, so a head can glide over to where its pass starts
const incoming = i => line.phase === 'move' ? line.units.find(v => v.slot === i && v.toX === SX[i]) : null;

function buildTools() {
  // floor plates under every machine
  floorMarks();
  for (let i = 0; i < 7; i++) { if (i === 3) continue; const pl = add(scene, new THREE.PlaneGeometry(6.4, 6.6), MK.plate, SX[i], .008, 0, false); pl.rotation.x = -Math.PI / 2; pl.receiveShadow = true; }

  // 01 BLANK: blank feeder over a roller infeed, stock pallet behind, vacuum pick-and-place gantry
  {
    const x = SX[0], mx0 = x - 7.8, mx1 = x - 2.6, mcx = (mx0 + mx1) / 2, MH = IT + 2.75;
    const ix0 = mx0 + .1, ix1 = x + 2.6, il = ix1 - ix0, icx = (ix0 + ix1) / 2, ft = [];
    for (const z of [INZ - 1.22, INZ + 1.22]) {
      prof(scene, 'x', il, icx, IT - .14, z, .2);
      for (const lx of [ix0 + .25, icx, ix1 - .25]) { prof(scene, 'y', IT - .24 - .1, lx, (IT - .24 + .1) / 2, z, .16); ft.push([lx, 0, z]); }
    }
    const nR = Math.floor(il / .4);
    inst(scene, CYZ(.075, 2.22, 16), M.chrome, [...Array(nR).keys()].map(k => [ix0 + .2 + k * .4, IT - .075, INZ]), false);
    // feeder housing: the waiting blank sits fully inside, the next one leaves through the portal
    for (const px of [mx0 + .08, mx1 - .08]) for (const s of [-1, 1]) { prof(scene, 'y', MH - .2, px, MH / 2, INZ + s * 1.51, .16); ft.push([px, 0, INZ + s * 1.51]); }
    inst(scene, FOOT, MK.zinc, ft);
    for (const s of [-1, 1]) { add(scene, BX(mx1 - mx0, MH - .4, .06), MK.cabinet, mcx, (MH + .2) / 2, INZ + s * 1.4); add(scene, BX(mx1 - mx0 - .12, MH - .5, .01), MK.plastic, mcx, (MH + .2) / 2, INZ + s * 1.364, false); }
    add(scene, BX(.06, MH - .4, 2.74), MK.cabinet, mx0 + .03, (MH + .2) / 2, INZ);
    add(scene, BX(.01, MH - .5, 2.7), MK.plastic, mx0 + .066, (MH + .2) / 2, INZ, false);
    add(scene, RB(mx1 - mx0 + .15, .14, 3.34, .04), MK.cabinet, mcx - .075, MH + .03, INZ);
    add(scene, BX(.06, MH - .1 - IT - 2.38, 2.74), MK.cabinet, mx1 - .03, (MH - .1 + IT + 2.38) / 2, INZ);
    add(scene, BX(.012, .22, 2.62), MK.hazard, mx1 + .006, IT + 2.52, INZ, false);
    for (const s of [-1, 1]) add(scene, BX(.06, 2.36, .25), MK.cabinet, mx1 - .03, IT + 1.2, INZ + s * 1.245);
    add(scene, RB(1.3, 1.7, .03, .012), MK.cabinet, mcx - 1.1, 1.75, INZ + 1.445);
    add(scene, MG([PG(BX(.05, .22, .03), mcx - .58, 1.75, INZ + 1.475), PG(CY(.016, .016, .14, 8), mcx - 1.75, 1.2, INZ + 1.46), PG(CY(.016, .016, .14, 8), mcx - 1.75, 2.3, INZ + 1.46)]), MK.zinc, 0, 0, 0, false);
    add(scene, new THREE.PlaneGeometry(1.6, .4), new THREE.MeshBasicMaterial({ map: canvasTex(signCanvas('01', 'Feeder')), toneMapped: false }), mcx - 1.1, 3.22, INZ + 1.432, false);
    add(scene, MG([PG(BX(.5, .3, .012), mcx + 1.2, 2.9, INZ + 1.436), ...[0, 1, 2, 3, 4].map(k => PG(BX(.44, .014, .03), mcx + 1.2, 2.79 + k * .055, INZ + 1.45, -.6))]), MK.plastic, 0, 0, 0, false);
    const bMat = new THREE.MeshPhysicalMaterial({ map: TEX.woodLid, color: '#E9D3AE', roughness: .9 });
    const GEN = new RoundedBoxGeometry(4.7, 2.25, 2.06, 2, .04);
    const bA = add(scene, GEN, bMat, x, IT + 1.125, INZ), bB = add(scene, GEN, bMat, x - 5.2, IT + 1.125, INZ);
    const setA = geo => { if (bA.geometry === geo) return; bA.geometry = geo; bA.position.y = geo === GEN ? IT + 1.125 : IT - .2; };
    { // stock: two strapped blanks on a wooden pallet behind the feeder
      const px = x - 5.2, pz = -8.1;
      inst(scene, BX(4.9, .1, .14), M.woodDark, [-1, 0, 1].map(k => [px, .05, pz + k * 1.05]));
      inst(scene, BX(.22, .03, 2.38), M.wood, [...Array(10).keys()].map(k => [px - 2.34 + k * .52, .115, pz]));
      for (const k of [0, 1]) add(scene, GEN, bMat, px, .13 + 1.125 + k * 2.26, pz);
      add(scene, MG([-1.2, 1.2].flatMap(dx => [PG(BX(.06, .012, 2.1), px + dx, 4.65, pz), PG(BX(.06, 4.5, .012), px + dx, 2.4, pz - 1.046), PG(BX(.06, 4.5, .012), px + dx, 2.4, pz + 1.046)])), steelDark);
    }
    // gantry: four posts on base plates, two beams with ground rails, carriage on bearing blocks, vertical slide head
    const PH = 6.1, za = INZ - 1.75, zb = 2.8, bp = [], gu = [];
    for (const z of [za, zb]) for (const dx of [-.95, .95]) {
      prof(scene, 'y', PH, x + dx, PH / 2 + .04, z, .24); add(scene, RB(.5, .04, .5, .01), MK.aluDark, x + dx, .02, z);
      for (const a of [-.17, .17]) for (const b of [-.17, .17]) bp.push([x + dx + a, .05, z + b]);
      gu.push([x + dx, PH + .04, z + (z < 0 ? .12 : -.12), z < 0 ? -Math.PI / 2 : Math.PI / 2, 2.2, 2.2, 1.6]);
    }
    inst(scene, BOLT, MK.zinc, bp, false); inst(scene, GUSSET, MK.aluDark, gu);
    for (const dx of [-.95, .95]) { prof(scene, 'z', zb - za + .3, x + dx, PH + .17, (za + zb) / 2, .26); add(scene, BX(.05, .05, zb - za), M.chrome, x + dx * .86, PH + .325, (za + zb) / 2, false); }
    add(scene, BX(.26, .03, 4.9), MK.aluDark, x + 1.3, PH + .12, -1.9);
    for (const z of [-3.9, -1.9, .1]) add(scene, BX(.12, .1, .1), MK.aluDark, x + 1.13, PH + .17, z, false);
    const cg = new THREE.Group(); cg.position.x = x; scene.add(cg);
    for (const dx of [-.817, .817]) for (const dz of [-.25, .25]) add(cg, RB(.2, .08, .26, .02), MK.aluDark, dx, PH + .39, dz);
    add(cg, RB(2.3, .3, .8, .04), yellow, 0, PH + .58, 0);
    add(cg, RB(.34, .3, .34, .03), MK.aluDark, 0, PH + .88, 0);
    add(cg, RB(.5, .5, .5, .05), MK.aluDark, .55, PH + .98, 0);
    add(cg, MG([PG(CYX(.14, .44, 24), .99, PH + .98, 0), PG(CYZ(.04, .08, 10), .95, PH + 1.1, .14)]), MK.plastic);
    add(cg, BX(.3, .16, .16), MK.aluDark, 1.25, PH + .62, 0);
    const hg = new THREE.Group(); cg.add(hg);
    prof(hg, 'y', 3.2, 0, 1.9, 0, .2);
    add(hg, RB(3.7, .12, 1.6, .03), MK.aluDark, 0, .24, 0);
    add(hg, RB(.5, .22, .5, .03), MK.aluDark, 0, .41, 0);
    const cups = [];
    for (const dx of [-1.4, 1.4]) for (const dz of [-.55, .55]) cups.push(PG(CY(.17, .12, .12, 20), dx, .06, dz), PG(CY(.05, .05, .08, 10), dx, .14, dz));
    add(hg, MG(cups), MK.plastic);
    add(hg, MG([-1.4, 1.4].flatMap(dx => [-.55, .55].map(dz => PG(CY(.03, .03, .22, 8), dx, .39, dz)))), M.chrome, 0, 0, 0, false);
    add(hg, RB(.45, .2, .35, .03), MK.blue, 0, .4, .45);
    const chain = dragChain(scene, 'z', INZ / 2, PH + .18, x + 1.3, .22, Math.PI * .22 + 2.5);
    let hz = INZ, hy = IT + 3.3;
    station(0, {
      update(dt, u, p) {
        let tz = INZ, ty = IT + 3.3, k = Math.min(1, 6 * dt);
        if (u) {
          const h = blankHead(p, u); tz = h.z; ty = h.y; k = 1;
          if (p < .17) setA(u.car.G.block); else if (p >= .75) setA(GEN);
          bA.visible = p < .17 || p >= .75;
          bB.position.x = p < .4 || p >= .75 ? x - 5.2 : lerp(x - 5.2, x, ease(seg(p, .4, .75)));
        }
        hz += (tz - hz) * k; hy += (ty - hy) * k;
        cg.position.z = hz; hg.position.y = hy;
        chain.update(hz);
      }
    });
  }

  // 02 CUT: wire profile cutter; the yoke's uprights pass outside the blank, only the wire runs through the wood
  {
    const x = SX[1], H = 5.0, OFF = .66, YK = 2.55, ZK = 1.32, c0 = x - 3.38, c1 = x + 2.1, cx = (c0 + c1) / 2;
    sideRails(cx, (c1 - c0) / 2 + .5);
    const br = bridge(H);
    add(br, RB(.12, 3.2, .74, .03), MK.aluDark, .3, 5.1, 0);
    for (const z of [-.24, .24]) add(br, BX(.04, 3.0, .05), M.chrome, .38, 5.1, z, false);
    const sp = new THREE.Group(); sp.position.x = OFF; br.add(sp);
    add(sp, RB(.18, .5, .62, .03), MK.aluDark, -.17, YK + .12, 0);
    add(sp, RB(.24, .26, 2 * ZK + .3, .05), yellow, 0, YK + .12, 0);
    add(sp, BX(.25, .04, 2 * ZK + .1), MK.hazard, 0, YK - .03, 0, false);
    for (const s of [-1, 1]) {
      prof(sp, 'y', YK - .1, 0, YK / 2 + .05, s * ZK, .14);
      add(sp, RB(.22, .32, .16, .03), MK.plastic, 0, .04, s * ZK);
      add(sp, CYX(.1, .025, 20), M.chrome, .12, .02, s * ZK);
    }
    const wire = add(sp, CYZ(.02, 2 * ZK - .14, 8), M.chrome, 0, 0, 0, false);
    const hs = hose(br, .07);
    add(br, BX(.16, .1, .5), MK.aluDark, 0, RT + .59, -RZ - .25);
    const chain = bridgeChain(c0, c1, -RZ - .45);
    dustCollector(x + 2.1, -5.9);
    let bx = c1, ty = 3.6;
    const glide = { u: null, x0: 0 };
    station(1, {
      update(dt, u, p) {
        let tx = c1, tyT = 3.6, cutting = false, k = Math.min(1, 1.8 * dt);
        const inc = !u && incoming(1);
        if (inc) {
          if (glide.u !== inc) Object.assign(glide, { u: inc, x0: bx });
          tx = lerp(glide.x0, inc.toX + inc.car.G.xmax + BV + .3 - OFF, ease(Math.min(1, line.t / MOVE_T)));
          bx = tx; k = Math.min(1, 8 * dt);
        } else if (u) {
          const G = u.car.G, ry = u.root.position.y;
          const lx0 = G.xmax + BV + .3, lx1 = G.xmin - BV - .3;
          const appr = ry + G.ymax + BV + .25, cutY = lx => ry + G.topY(lx) + BV - .02;
          let lx;
          if (p < .1) { lx = lx0; tyT = lerp(3.6, cutY(lx0), ease(seg(p, .02, .1))); }
          else if (p > .9) { lx = lx1; tyT = lerp(cutY(lx1), appr, ease(seg(p, .9, .98))); }
          else { lx = lerp(lx0, lx1, ease(seg(p, .1, .9))); tyT = cutY(lx); cutting = true; }
          tx = u.root.position.x + lx - OFF; k = p < .1 ? Math.min(1, 12 * dt) : 1;
          if (cutting) emit(tx + OFF, tyT + .03, (Math.random() - .5) * 1.8, '#E3C08C', 3, 2.6, 2.2, .9);
        }
        bx += (tx - bx) * k; ty += (tyT - ty) * k;
        br.position.x = bx; sp.position.y = ty; wire.rotation.z = cutting ? (Math.random() - .5) * .01 : 0;
        chain.update(bx);
        hs.set([V3(OFF + .02, ty + YK + .25, .45), V3(OFF - .05, ty + YK + .75, .6), V3(.25, H + 1.0, .5), V3(0, H + .7, .35), V3(0, H + .28, .3)]);
      }
    });
  }

  // 03 SAND: flap wheel rides the roof line, brush drums on both sides
  {
    const x = SX[2], H = 4.55, OFF = .9, R = .335, c0 = x - 3.17, c1 = x + 1.4, cx = (c0 + c1) / 2;
    sideRails(cx, (c1 - c0) / 2 + .5);
    const br = bridge(H);
    add(br, RB(.39, .56, .42, .03), MK.aluDark, .405, H, 0);
    const flapTex = patTex(256, 64, (c, w, h) => { c.fillStyle = '#7A2A1B'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < w; i += 8) c.fillRect(i, 0, 2, h); c.fillStyle = 'rgba(255,220,180,.14)'; for (let i = 0; i < 400; i++) c.fillRect(Math.random() * w, Math.random() * h, 1, 1); });
    const brushTex = patTex(128, 64, (c, w, h) => { c.fillStyle = '#2F3A44'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < w; i += 4) c.fillRect(i, 0, 1, h); });
    const hd = new THREE.Group(); hd.position.x = OFF; br.add(hd);
    const wheel = add(hd, CYZ(.34, 1.86, 40), new THREE.MeshStandardMaterial({ map: flapTex, roughness: .95 }), 0, 0, 0);
    for (const s of [-1, 1]) add(hd, CYZ(.21, .06, 24), MK.aluDark, 0, 0, s * .96);
    // hood covers the top 150° only, so its edges stay clear of steep bodywork
    const HA = .26, hoodGeo = new THREE.CylinderGeometry(.47, .47, 2.08, 32, 1, true, Math.PI / 2 + HA, Math.PI - 2 * HA); hoodGeo.rotateX(Math.PI / 2);
    add(hd, hoodGeo, MK.orange, 0, 0, 0);
    for (const s of [-1, 1]) add(hd, new THREE.CircleGeometry(.47, 24, HA, Math.PI - 2 * HA), MK.orange, 0, 0, s * 1.04);
    add(hd, RB(.16, .55, .62, .03), MK.aluDark, -.43, .5, 0);
    prof(hd, 'y', 2.4, -.43, 1.95, 0, .14); add(hd, RB(.2, .06, .2, .02), yellow, -.43, 3.18, 0);
    add(hd, RB(.36, .62, .1, .03), MK.orange, 0, .2, 1.1);
    add(hd, MG([PG(CYZ(.13, .42, 24), 0, .38, 1.36), ...[0, 1, 2].map(k => PG(CYZ(.14, .02, 24), 0, .38, 1.24 + k * .1))]), MK.blue);
    add(hd, CYZ(.135, .05, 24), MK.plastic, 0, .38, 1.595);
    add(hd, CY(.12, .12, .3, 16), MK.aluDark, .05, .58, 0);
    const brushMat = new THREE.MeshStandardMaterial({ map: brushTex, roughness: .95 });
    const drums = [];
    for (const s of [-1, 1]) {
      // the drum's inner face (|z| .96) brushes the body's flank (|z| .95)
      drums.push(add(br, CY(.22, .22, 1.35, 28), brushMat, -.1, 2.0, s * 1.18));
      add(br, CY(.1, .1, .22, 16), MK.blue, -.1, 2.8, s * 1.18);
      prof(br, 'y', H - .25 - 2.91, -.1, (H - .25 + 2.91) / 2, s * 1.18, .14);
    }
    const hs = hose(br, .08);
    add(br, CY(.1, .1, .6, 16), MK.alu, 0, H + .55, -.55);
    add(br, BX(.16, .1, .5), MK.aluDark, 0, RT + .59, -RZ - .25);
    const chain = bridgeChain(c0, c1, -RZ - .45);
    // centre height so the drum just kisses the body and the hood edges clear it, sampled across the hood width;
    // the bevel grows the profile like a disk of radius BV, which matters on steep walls
    const BE = [-.1, -.07, 0, .07, .1].map(e => [e, Math.sqrt(BV * BV - e * e)]);
    const ride = (G, ry, lx) => { let y = -9; for (let d = -.52; d < .49; d += .02) { let t = -9; for (const [e, h] of BE) t = Math.max(t, ry + G.topY(lx + d + e) + h); const a = Math.abs(d); y = Math.max(y, a < R ? t + Math.sqrt(R * R - d * d) : a < .47 ? t + .04 - Math.sqrt(Math.max(.0144, .2209 - d * d)) : d < 0 ? t - .19 : -9); } return y; };
    let bx = c1, wy = 3.95;
    const glide = { u: null, x0: 0 };
    station(2, {
      update(dt, u, p) {
        let tx = c1, tyT = 3.95, active = false, k = Math.min(1, 1.8 * dt);
        const inc = !u && incoming(2);
        if (inc) { // while the belt brings the car in, glide over its tail at clearance height
          if (glide.u !== inc) Object.assign(glide, { u: inc, x0: bx });
          tx = lerp(glide.x0, inc.toX + inc.car.G.xmin - BV + .15 - OFF, ease(Math.min(1, line.t / MOVE_T)));
          bx = tx; k = Math.min(1, 8 * dt);
        } else if (u) {
          const G = u.car.G, ry = u.root.position.y;
          const lx0 = G.xmin - BV + .15, lx1 = G.xmax + BV - .15;
          const appr = ry + G.ymax + BV + .55;
          let lx;
          if (p < .12) { lx = lx0; tyT = lerp(3.95, ride(G, ry, lx0), ease(seg(p, .02, .12))); } // already over the tail: lower onto it
          else if (p > .9) { lx = lx1; tyT = lerp(ride(G, ry, lx1), appr, ease(seg(p, .9, .98))); }
          else { lx = lerp(lx0, lx1, ease(seg(p, .12, .9))); tyT = ride(G, ry, lx); active = true; }
          tx = u.root.position.x + lx - OFF; k = p < .12 ? Math.min(1, 10 * dt) : 1;
          if (active) {
            emit(tx + OFF, tyT - .34, (Math.random() - .5) * 1.6, '#EFE0C6', 2, 3, 1.2, .8);
            emit(tx - .1, ry + .5 + Math.random() * 1.3, (Math.random() < .5 ? -1 : 1) * .97, '#EFE0C6', 1, 2, .6, .7);
          }
        }
        bx += (tx - bx) * k; wy += (tyT - wy) * k;
        br.position.x = bx; hd.position.y = wy;
        wheel.rotation.z -= dt * (active ? 40 : 3);
        drums.forEach((d, i) => { d.rotation.y += dt * (active ? 30 : 2) * (i ? 1 : -1); });
        chain.update(bx);
        hs.set([V3(OFF + .05, wy + .72, 0), V3(OFF + .05, wy + 1.25, -.1), V3(.6, H + 1.0, -.35), V3(.1, H + 1.05, -.5), V3(0, H + .86, -.55)]);
      }
    });
    guard([SX[1] - 3.75, x - 3.66, x + 2.2], 3.15, 2.4); lightCurtain(SX[1] - 3.8); lightCurtain(x + 2.45);
  }

  // 04 PAINT: booth with two paint robots
  {
    const x = SX[3], hx = 3.3, hz = 3.95, BH = 4.9, OZ = 2.05, OH = 3.77, ft = [];
    const grate = add(scene, new THREE.PlaneGeometry(2 * hx, 2 * hz), new THREE.MeshStandardMaterial({ map: gridTex('#3A4048', '#22262B', 12, 4), roughness: .8, metalness: .3 }), x, .016, 0, false);
    grate.rotation.x = -Math.PI / 2; grate.receiveShadow = true;
    for (const dx of [-hx, hx]) for (const dz of [-hz, hz]) { prof(scene, 'y', BH - .1, x + dx, (BH + .1) / 2, dz, .24); ft.push([x + dx, 0, dz, 0, 1.4]); }
    for (const dx of [-hx, hx]) for (const s of [-1, 1]) { prof(scene, 'y', OH - .1, x + dx, (OH + .1) / 2, s * (OZ + .06), .12); ft.push([x + dx, 0, s * (OZ + .06), 0, .8]); }
    inst(scene, FOOT, MK.zinc, ft);
    for (const dz of [-hz, hz]) prof(scene, 'x', 2 * hx, x, BH, dz, .22);
    for (const dx of [-hx, hx]) prof(scene, 'z', 2 * hz, x + dx, BH, 0, .22);
    // plenum roof: quilted supply filter ceiling, light boxes along both sides, fascia sign
    add(scene, RB(2 * hx + .5, .55, 2 * hz + .5, .05), MK.cabinet, x, BH + .38, 0);
    const filt = add(scene, new THREE.PlaneGeometry(2 * hx - .2, 2 * hz - .2), new THREE.MeshStandardMaterial({ map: gridTex('#F4F5F6', '#C7CED4', 8, 3), roughness: .9 }), x, BH + .09, 0, false);
    filt.rotation.x = Math.PI / 2;
    const lamp = new THREE.MeshBasicMaterial({ color: '#FFF6E4', toneMapped: false });
    for (const dz of [-2.3, 2.3]) { add(scene, RB(2 * hx - .7, .1, .36, .02), MK.white, x, BH + .035, dz); add(scene, BX(2 * hx - .8, .02, .26), lamp, x, BH - .02, dz, false); }
    add(scene, new THREE.PlaneGeometry(2.0, .5), new THREE.MeshBasicMaterial({ map: canvasTex(signCanvas('04', STATIONS[3])), toneMapped: false }), x, BH + .38, hz + .256, false);
    // walls: solid back with a pleated exhaust filter wall, clear front over a kick plate, side portals for the belt
    add(scene, BX(2 * hx - .24, BH - .2, .06), MK.booth, x, BH / 2, -hz);
    const pleat = patTex(256, 128, (c, w, h) => {
      c.fillStyle = '#E8DFC9'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 8) { const g = c.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, 'rgba(0,0,0,.14)'); g.addColorStop(.5, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); c.fillStyle = g; c.fillRect(i, 0, 8, h); }
      for (let i = 0; i < 260; i++) { c.fillStyle = ['rgba(215,50,43,.12)', 'rgba(30,127,134,.12)', 'rgba(120,90,60,.1)'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }, 4, 2);
    add(scene, new THREE.PlaneGeometry(2 * hx - .8, 3.2), new THREE.MeshStandardMaterial({ map: pleat, roughness: .95 }), x, 2.2, -hz + .035, false);
    const FL = 2 * hx - .8;
    add(scene, MG([PG(BX(FL + .1, .06, .04), x, .57, -hz + .05), PG(BX(FL + .1, .06, .04), x, 2.2, -hz + .05), PG(BX(FL + .1, .06, .04), x, 3.83, -hz + .05), ...[-.5, -1 / 6, 1 / 6, .5].map(f => PG(BX(.06, 3.32, .04), x + f * FL, 2.2, -hz + .05))]), MK.aluDark);
    add(scene, new THREE.PlaneGeometry(2 * hx - .24, BH - .31), MK.poly, x, (BH - .11 + .2) / 2, hz, false);
    add(scene, BX(2 * hx - .44, .18, .04), MK.aluDark, x, .11, hz);
    for (const dx of [-hx, hx]) {
      for (const s of [-1, 1]) { const w = hz - .12 - OZ - .12; const m = add(scene, new THREE.PlaneGeometry(w, BH - .31), MK.poly, x + dx, (BH - .11 + .2) / 2, s * (OZ + .12 + w / 2), false); m.rotation.y = Math.PI / 2; }
      const top = add(scene, new THREE.PlaneGeometry(2 * OZ + .24, BH - .11 - 3.95), MK.poly, x + dx, (BH - .11 + 3.95) / 2, 0, false); top.rotation.y = Math.PI / 2;
      add(scene, BX(.08, .18, 2 * OZ + .24), MK.hazard, x + dx, 3.86, 0, false);
    }
    // roof plant: exhaust fan and stack with rain cap, air make-up unit with louvred intake
    const ex = x + 2.0, ez = -2.6, RY = BH + .655;
    add(scene, CY(.62, .62, .5, 32), MK.blue, ex, RY + .25, ez);
    add(scene, CY(.42, .42, 2.2, 32), MK.alu, ex, RY + .5 + 1.1, ez);
    add(scene, MG([PG(CY(.47, .47, .06, 32), ex, RY + .53, ez), PG(CY(.47, .47, .06, 32), ex, RY + 1.6, ez), ...[0, 2.1, 4.2].map(a => PG(BX(.03, .1, .03), ex + Math.cos(a) * .38, RY + 2.74, ez + Math.sin(a) * .38))]), MK.aluDark);
    add(scene, CY(.06, .66, .26, 32), MK.alu, ex, RY + 2.92, ez);
    add(scene, MG([PG(BX(.02, .46, .82), x - 2.61, BH + .95, -2.6), ...[0, 1, 2, 3, 4].map(k => PG(BX(.06, .015, .76), x - 2.63, BH + .77 + k * .09, -2.6, 0, 0, .5))]), MK.aluDark, 0, 0, 0, false);
    add(scene, RB(.5, .4, .02, .01), MK.blue, x - 1.85, BH + .95, -2.09);
    add(scene, RB(1.2, .6, 1.0, .05), MK.blue, x - 2.0, BH + .95, -2.6);
    const robots = [];
    for (const s of [1, -1]) {
      const r = robotArm(x, .9, s * 3.05, MK.white, 2.1, 1.5, 'gun'); r.side = s; robots.push(r);
    }
    station(3, {
      update(dt, u, p) {
        for (const r of robots) {
          let k = Math.min(1, 5 * dt);
          if (u) {
            const G = u.car.G, ry = u.root.position.y, q = seg(p, .06, .92);
            const sy = ry + lerp(G.ymax + BV + .15, -.05, ease(q)), yT = Math.max(sy, ry + .3) + .05;
            const half = (G.xmax - G.xmin) / 2 - .2, mid = u.root.position.x + (G.xmin + G.xmax) / 2;
            const xt = mid + Math.sin(line.t * 2.8 + (r.side > 0 ? 0 : Math.PI)) * half;
            VA.set(xt, yT + .15, r.side * (W / 2 + .62)); VB.set(xt, yT - .3, 0);
            k = Math.min(1, 14 * dt);
            r.reach(VA, VB, k);
            if (q > 0 && q < 1) {
              r.tipWorld(VC); VD.copy(VB).sub(VC).normalize();
              emitDir(VC.x, VC.y, VC.z, VD.x, VD.y, VD.z, u.car.cfg.finish === 'raw' ? '#F3E3C2' : u.car.cfg.color, 3, 4.5, .5, .4);
            }
          } else {
            VA.set(x + .3 * r.side, 3.15, r.side * 1.3); VB.set(x + .3 * r.side, 2.75, 0);
            r.reach(VA, VB, k);
          }
        }
      }
    });
  }

  // 05 LIVERY: UV inkjet bridge; the head hangs on guide rods that slide in bushings on the beam, never below it
  {
    const x = SX[4], H = 4.6, c0 = x - 2.67, c1 = x + 2.67, IDLE = 3.75;
    sideRails(x, (c1 - c0) / 2 + .5);
    const br = bridge(H);
    const glow = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0, roughness: .3 });
    const uv = new THREE.MeshBasicMaterial({ color: '#8A5CFF', toneMapped: false, transparent: true, opacity: .25 });
    const bush = new THREE.CylinderGeometry(.045, .045, .16, 16, 1, true);
    for (const z of [-.75, .75]) { add(br, bush, MK.aluDark, .29, H - .1, z); add(br, BX(.06, .1, .1), MK.aluDark, .24, H - .1, z); }
    const ph = new THREE.Group(); br.add(ph);
    add(ph, RB(.62, .32, 2.4, .04), MK.aluDark, 0, 0, 0);
    add(ph, BX(.1, .02, 2.1), glow, .05, -.17, 0, false);
    add(ph, RB(.26, .2, 2.3, .03), MK.plastic, -.5, -.12, 0);
    add(ph, BX(.18, .02, 2.1), uv, -.5, -.23, 0, false);
    for (const s of [-1, 1]) {
      add(ph, RB(.5, 1.6, .18, .03), MK.aluDark, 0, -.96, s * 1.34);
      add(ph, BX(.08, 1.4, .02), glow, .05, -.96, s * 1.24, false);
      add(ph, RB(.24, 1.5, .14, .03), MK.plastic, -.5, -1.0, s * 1.34);
      add(ph, BX(.16, 1.3, .02), uv, -.5, -1.0, s * 1.26, false);
    }
    add(ph, RB(.66, .16, 1.7, .03), yellow, 0, .24, 0);
    add(ph, MG([PG(CY(.025, .025, 1.0, 12), .29, .82, -.75), PG(CY(.025, .025, 1.0, 12), .29, .82, .75)]), M.chrome);
    add(ph, MG([PG(CY(.05, .05, .04, 16), .29, 1.34, -.75), PG(CY(.05, .05, .04, 16), .29, 1.34, .75)]), MK.aluDark);
    const inks = ['#00A3D9', '#D8137A', '#F5D10A', '#1B1B1B', '#F4F4F4'];
    const tubes = inks.map((c, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: c, roughness: .35 });
      add(br, RB(.24, .36, .28, .03), mat, -.05, H + .43, -1.0 + i * .5);
      return { h: hose(br, .028, mat), z: -1.0 + i * .5 };
    });
    add(br, BX(.16, .1, .5), MK.aluDark, 0, RT + .59, -RZ - .25);
    const chain = bridgeChain(c0, c1, -RZ - .45);
    guard([2.98, c1 + .63], 3.15, 2.4);
    lightCurtain(c1 + .88);
    let bx = x - 2.4, hy = IDLE;
    station(4, {
      update(dt, u, p) {
        let tx = x - 2.4, ty = IDLE, k = Math.min(1, 4 * dt);
        glow.emissiveIntensity *= Math.exp(-6.3 * dt); uv.opacity += (.25 - uv.opacity) * (1 - Math.exp(-6.3 * dt));
        if (u) {
          const G = u.car.G, q = seg(p, .08, .92);
          tx = u.root.position.x + lerp(G.xmin - BV - .25, G.xmax + BV + .25, ease(q));
          ty = u.root.position.y + G.ymax + BV + .4; k = 1;
          if (q > 0 && q < 1) { glow.color.set(u.car.cfg.accent); glow.emissive.set(u.car.cfg.accent); glow.emissiveIntensity = 1.6; uv.opacity = .9; }
        }
        bx += (tx - bx) * k; hy += (ty - hy) * Math.min(1, (u ? 10 : 6) * dt);
        br.position.x = bx; ph.position.y = hy;
        chain.update(bx);
        for (const t of tubes) t.h.set([V3(-.17, H + .4, t.z), V3(-.34, H + .15, t.z), V3(-.34, H - .4, t.z * .9), V3(-.15, hy + .6, t.z * .6), V3(-.05, hy + .33, t.z * .5)]);
      }
    });
  }

  // 06 WHEELS: four gravity-feed wheel magazines, each over a guided pneumatic press on a format slide
  {
    const x = SX[5], WY = BELT_Y + PALLET_H + WCY, c = W / 2 + 1.3; // wheel axis height, feed slot |z|
    const FF = W / 2 + .08, FH = c + .18, FB = c + .37; // press face: wheel seated, home on the feed wheel, backed off
    const SY = [WY, WY + .923, WY + 1.853]; // feed slot, spare on the escapement, refill inside the hood
    const T = (g, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) => (g.index ? g.toNonIndexed() : g).rotateX(rx).rotateY(ry).rotateZ(rz).translate(px, py, pz);
    // merge non-indexed parts into one geometry, dropping the zero-area slivers that closing points leave behind
    const bake = gs => {
      const P = [], N = [], U = [], a = V3(), b = V3(), e = V3(), out = new THREE.BufferGeometry();
      for (const g of gs) {
        const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv.array;
        for (let i = 0; i < p.length; i += 9) {
          a.fromArray(p, i + 3).sub(e.fromArray(p, i)); b.fromArray(p, i + 6).sub(e);
          if (a.cross(b).lengthSq() < 1e-14) continue;
          for (let k = 0; k < 9; k++) { P.push(p[i + k]); N.push(n[i + k]); }
          for (let k = 0; k < 6; k++) U.push(uv[i / 3 * 2 + k]);
        }
      }
      return out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)).setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    };
    const PFG = (axis, len, size) => { const g = PROF.clone().scale(size / .2, size / .2, len); return axis === 'y' ? g.rotateX(Math.PI / 2) : axis === 'x' ? g.rotateY(Math.PI / 2) : g; };
    const rr = (p, w, h, r, cx = 0, cy = 0) => (roundedContour(p, [[cx, cy - h / 2], [cx + w / 2, cy - h / 2, r], [cx + w / 2, cy + h / 2, r], [cx - w / 2, cy + h / 2, r], [cx - w / 2, cy - h / 2, r], [cx, cy - h / 2]]), p);
    // rounded slab extruded along z, with holes [w, h, r, cx, cy] (round when r = w / 2)
    const slab = (w, h, r, d, holes = [], bev = 0, cy = 0) => {
      const s = rr(new THREE.Shape(), w, h, r, 0, cy);
      for (const [hw, hh, hr, hx = 0, hy = 0] of holes) s.holes.push(hr * 2 >= hw ? new THREE.Path().absarc(hx, hy, hr, 0, Math.PI * 2, true) : rr(new THREE.Path(), hw, hh, hr, hx, hy));
      return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -d / 2);
    };
    const lathe = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), n);
    const lz = (pts, n) => lathe(pts, n).rotateX(Math.PI / 2);
    const washer = (r0, r1, t) => lz([[r0, -t / 2], [r1, -t / 2], [r1, t / 2], [r0, t / 2], [r0, -t / 2]], 24);
    const tube = pts => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), 24, .025, 8);
    const carriage = new THREE.ExtrudeGeometry(new THREE.Shape([[-.08, .12], [-.034, .12], [-.034, .153], [.034, .153], [.034, .12], [.08, .12], [.08, .2], [-.08, .2]].map(([a, b]) => new THREE.Vector2(a, b))), { depth: .32, bevelEnabled: false }).translate(0, 0, -.16).rotateY(Math.PI / 2);
    // hood over the refill wheel: an arched band and two end plates, open underneath
    const hb = new THREE.Shape(); hb.moveTo(.55, -.465); hb.lineTo(.58, -.465); hb.absarc(0, 0, .58, 0, Math.PI, false); hb.lineTo(-.58, -.465); hb.lineTo(-.55, -.465); hb.absarc(0, 0, .55, Math.PI, 0, true); hb.closePath();
    const hp = new THREE.Shape(); hp.moveTo(-.55, -.465); hp.lineTo(.55, -.465); hp.absarc(0, 0, .55, 0, Math.PI, false); hp.closePath();
    // one press module about its own x = 0, +z pointing away from the belt: chute and hood up front, guided cylinder behind, all on a sled
    const SM = {
      alu: bake([
        ...[-1, 1].map(k => T(BX(.03, 2.388, .12), k * .51, 2.156, c)),
        ...[-1, 1].map(k => T(PFG('y', .654, .1), k * .42, .591, c)),
        ...[-1, 1].map(k => T(PFG('y', .934, .12), k * .18, .731, 3.02)),
        T(PFG('y', .964, .1), 0, .746, 4.9),
        T(new THREE.CylinderGeometry(.17, .17, 1.676, 32, 1, true), 0, WY, 4.01, Math.PI / 2)
      ]),
      dark: bake([
        T(RB(1.2, .04, .6, .015), 0, .94, c),
        T(slab(1.68, .56, .03, .03, [[1.06, .49, .02]]), 0, 2.018, c, Math.PI / 2),
        T(RB(.96, .06, 3.02, .02), 0, .232, 3.48),
        T(slab(.6, .64, .04, .3, [[.1, .1, .05], [.08, .08, .04, .2, .3], [.08, .08, .04, -.2, .3]], 0, .1), 0, WY, 3.02),
        T(RB(.38, .38, .1, .02), 0, WY, 4.9)
      ]),
      chrome: bake([
        ...[-1, 1].map(k => T(CYZ(.025, .5, 16), k * .2, .987, c)),
        ...[-1, 1].flatMap(k => [-1, 1].map(j => T(CY(.016, .016, 1.567, 12), k * .3, 2.8165, c + j * .223))),
        ...[-1, 1].flatMap(k => [-1, 1].map(j => T(CYZ(.014, 1.676, 10), k * .155, WY + j * .155, 4.01))),
        ...[-1, 1].flatMap(k => [-1, 1].map(j => T(CYZ(.03, .03, 6), k * .155, WY + j * .155, 4.967))),
        T(washer(.056, .085, .028), 0, WY, 2.852),
        ...[-1, 1].map(k => T(washer(.046, .065, .02), k * .2, WY + .3, 2.856)),
        T(CY(.024, .024, .1, 12), .38, 1.012, c - .2),
        ...[-1, 1].flatMap(k => [2.06, 4.9].map(z => T(CY(.022, .022, .014, 6), k * .4, .27, z))),
        ...[-1, 1].flatMap(k => [-1, 1].map(j => T(CY(.02, .02, .012, 6), k * .76, 2.04, c + j * .22)))
      ]),
      plastic: bake([
        ...[-1, 1].flatMap(k => [-1, 1].map(j => T(lathe([[.001, .18], [.022, .18], [.022, 0], [.035, 0], [.035, .2], [.001, .2]], 16), k * .62, 2.075, c + j * .12, 0, 0, -k * Math.PI / 2))),
        T(CYX(.03, .06, 12), .332, WY + .25, 3.02),
        T(CYX(.03, .06, 12), .222, WY, 4.9),
        ...[3.88, 4.02].map(z => T(CY(.03, .03, .04, 12), .3, .4665, z))
      ]),
      steel: bake([2.6, 4.6].map(z => T(carriage.clone(), 0, 0, z))),
      yellow: bake([T(new THREE.ExtrudeGeometry(hb, { depth: .56, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2, curveSegments: 24 }).translate(0, 0, -.28), 0, SY[2], c), ...[-1, 1].map(j => T(new THREE.ExtrudeGeometry(hp, { depth: .03, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, -.015), 0, SY[2], c + j * .265))]),
      blue: T(RB(.18, .18, .32, .02), .3, .355, 3.95),
      hose: bake([
        T(tube([[.364, 1.67, 3.02], [.42, 1.67, 3.02], [.5, 1.3, 3.3], [.42, .8, 3.7], [.3, .6, 3.88], [.3, .4885, 3.88]])),
        T(tube([[.254, WY, 4.9], [.31, WY, 4.9], [.42, 1.1, 4.7], [.4, .75, 4.3], [.3, .6, 4.02], [.3, .4885, 4.02]]))
      ])
    };
    // the moving ram, built with its pad face at z = 0: urethane nest, yellow yoke and tail bar, chrome piston and guide rods
    const RAM = {
      nest: lz([[.001, .07], [.25, .07], [.29, 0], [.385, 0], [.395, .012], [.395, .1], [.001, .1]], 40),
      yoke: bake([T(RB(.62, .66, .078, .02), 0, WY + .09, .141), T(RB(.52, .12, .06, .02), 0, WY + .3, 2.194)]),
      rods: bake([T(CYZ(.045, 1.98, 16), 0, WY, 1.172), ...[-1, 1].map(k => T(CYZ(.035, 1.98, 14), k * .2, WY + .3, 1.172))])
    };
    const PIN = [1, -1].map(k => bake([-1, 1].map(j => T(CYX(.016, .3, 10), k * .51, 2.075, c + j * .12))));
    const RAIL = { // format slide rails, one pair per side
      alu: bake([2.6, 4.6].map(z => T(PFG('x', 4.4, .1), 0, .05, z))),
      steel: bake([2.6, 4.6].map(z => T(BX(4.3, .05, .06), 0, .126, z))),
      dark: bake([2.6, 4.6].flatMap(z => [-2.18, 2.18].map(dx => T(RB(.04, .08, .12, .01), dx, .141, z))))
    };
    const kits = new WeakMap(), classic = wheelKit('classic');
    const kitOf = cf => cf ? kits.get(cf) || kits.set(cf, wheelKit(cf.wheels, cf)).get(cf) : classic;
    const wheelGroup = (h, cf) => { h.clear(); const w = kitOf(cf)(); w.traverse(o => { o.castShadow = o.receiveShadow = true; }); h.add(w); h.userData.cf = cf; };
    const mods = [];
    for (const s of [1, -1]) {
      const rails = new THREE.Group(); rails.position.x = x; rails.rotation.y = s < 0 ? Math.PI : 0; scene.add(rails);
      add(rails, RAIL.alu, MK.alu); add(rails, RAIL.steel, steel); add(rails, RAIL.dark, MK.aluDark);
      for (const w of [0, 1]) {
        const g = new THREE.Group(); g.position.x = x + (w ? 1.4 : -1.4); g.rotation.y = s < 0 ? Math.PI : 0; scene.add(g);
        for (const [geo, mat] of [[SM.alu, MK.alu], [SM.dark, MK.aluDark], [SM.chrome, M.chrome], [SM.plastic, MK.plastic], [SM.steel, steelDark], [SM.yellow, yellow], [SM.blue, MK.blue], [SM.hose, MK.hose]]) add(g, geo, mat);
        const ram = new THREE.Group(); ram.position.z = FH; g.add(ram);
        add(ram, RAM.nest, MK.plastic, 0, WY, 0); add(ram, RAM.yoke, yellow); add(ram, RAM.rods, M.chrome);
        const pins = PIN.map(geo => add(g, geo, M.chrome));
        const hs = SY.map(y => { const h = new THREE.Group(); h.position.set(0, y, c); g.add(h); wheelGroup(h, null); return h; });
        mods.push({ g, ram, pins, hs, w, o: 0 });
      }
    }
    station(5, {
      update(dt, u, p) {
        // the magazines are kitted in serve order: cars still heading for the press, then the queue
        const A = [...line.units.filter(v => v.slot <= 5).sort((a, b) => b.slot - a.slot).map(v => v.car.cfg), ...queue.map(r => r.cfg)];
        // press the wheel home, back off past the chute, drop the stack one wheel through the escapement, nest the new one
        const o = u && p >= .8 ? 1 : 0, d = o ? seg(p, .8, .9) ** 2 : 0, pin = u ? Math.min(seg(p, .78, .8), 1 - seg(p, .885, .9)) : 0;
        const F = !u ? FH : p < .58 ? FF + 1.4 * (1 - easeOut(seg(p, 0, .55))) : p < .8 ? lerp(FF, FB, ease(seg(p, .58, .78))) : lerp(FB, FH, ease(seg(p, .9, .98)));
        for (const m of mods) {
          if (o && !m.o) m.hs.push(m.hs.shift());
          m.o = o;
          const cf = A[o], tx = x + (cf ? BODIES[cf.body].wheels[m.w] : m.w ? 1.4 : -1.4);
          m.g.position.x += (tx - m.g.position.x) * (u && !o ? 1 : Math.min(1, 5 * dt));
          m.ram.position.z += (F - m.ram.position.z) * (u ? 1 : Math.min(1, 6 * dt));
          m.pins[0].position.x = .12 * pin; m.pins[1].position.x = -.12 * pin;
          m.hs.forEach((h, k) => {
            const cf = A[k + o] || null;
            if (h.userData.cf !== cf) wheelGroup(h, cf);
            h.position.y = o ? lerp(SY[k + 1] || SY[k] + .9, SY[k], d) : SY[k];
            h.visible = !(u && !o && !k) && !(o && d < 1 && k === SY.length - 1);
          });
        }
      }
    });
  }

  // 07 DETAIL: two gripper robots, a roof placer and the QC scan portal
  {
    const x = SX[6], AX0 = x - 3.75;
    for (const s of [-1, 1]) { prof(scene, 'x', 7.9, x - .35, .05, s * 2.4, .1); add(scene, BX(7.9, .012, .03), M.chrome, x - .35, .106, s * 2.4, false); }
    // QC portal: a slim white arch on two rail carriages, lit liner on the inside, scanner heads and a red laser sheet;
    // stretched 12% so the tallest load (van with luggage, top 4.06) clears the crown liner (4.14)
    const arch = new THREE.Group(); arch.position.x = AX0; arch.scale.y = 1.12; scene.add(arch);
    const uPath = (s, hw, top, r, y0, back) => {
      if (!back) { s.lineTo(-hw, top - r); s.absarc(-hw + r, top - r, r, Math.PI, Math.PI / 2, true); s.lineTo(hw - r, top); s.absarc(hw - r, top - r, r, Math.PI / 2, 0, true); s.lineTo(hw, y0); }
      else { s.lineTo(hw, top - r); s.absarc(hw - r, top - r, r, 0, Math.PI / 2, false); s.lineTo(-hw + r, top); s.absarc(-hw + r, top - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-hw, y0); }
      return s;
    };
    const band = (o, i, y0, depth, bevel) => {
      const s = new THREE.Shape(); s.moveTo(-o[0], y0); uPath(s, ...o, y0); s.lineTo(i[0], y0); uPath(s, ...i, y0, true);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 14 });
      g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2); return g;
    };
    // legs and crown are separate pieces, joined where the corner arcs begin
    const scanMat = new THREE.MeshStandardMaterial({ color: '#E4F7F0', emissive: '#4FD3A9', emissiveIntensity: .25, roughness: .3 });
    add(arch, band([2.49, 3.84, .75], [2.26, 3.75, .5], 3.09, .3, .03), [MK.white, MK.aluDark]);
    add(arch, band([2.228, 3.718, .468], [2.205, 3.70, .445], 3.24, .3, 0), scanMat, 0, 0, 0, false);
    for (const s of [-1, 1]) { add(arch, faces(RB(.36, 2.79, .29, .03), [0, 0, 1, 1, 1, 1]), [MK.white, MK.aluDark], 0, 1.665, s * 2.375); add(arch, BX(.3, 2.94, .022), scanMat, 0, 1.77, s * 2.217, false); }
    for (const s of [-1, 1]) { add(arch, RB(.62, .16, .3, .04), yellow, 0, .18, s * 2.4); add(arch, RB(.3, .1, .26, .02), MK.plastic, s * .46, .15, s * 2.4); }
    const laserMat = new THREE.MeshBasicMaterial({ color: '#FF3B30', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const sh = new THREE.Shape(); sh.moveTo(-2.07, 1.16); uPath(sh, 2.07, 3.48, .55, 1.16); sh.closePath();
    const sheetGeo = new THREE.ShapeGeometry(sh, 14); sheetGeo.rotateY(Math.PI / 2);
    add(arch, sheetGeo, laserMat, 0, 0, 0, false);
    { // scanner heads with lit lenses on the liner
      const heads = [[1.55, 1], [2.65, 1], [1.55, -1], [2.65, -1], [3.517, 1, .785], [3.517, -1, .785]];
      const hm = new THREE.InstancedMesh(RB(.2, .22, .12, .03), MK.plastic, heads.length), lm = new THREE.InstancedMesh(BX(.1, .14, .012), scanMat, heads.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V3(1, 1, 1);
      heads.forEach(([y, s, a = 0], i) => {
        const z = a ? s * 2.02 : s * 2.144; q.setFromEuler(e.set(-s * a, 0, 0));
        hm.setMatrixAt(i, m4.compose(V3(0, y, z), q, one));
        lm.setMatrixAt(i, m4.compose(V3(0, y, z).add(V3(0, 0, -s * .066).applyQuaternion(q)), q, one));
      });
      hm.castShadow = true; arch.add(hm, lm);
    }
    const robMat = new THREE.MeshStandardMaterial({ color: '#E9B100', roughness: .4 });
    // long-forearm grippers; B stands mid-station so it reaches back through the parked arch, never across its ring
    const robA = robotArm(x + 1.5, .5, 3.6, robMat, 1.95, 2.3, 'grip');
    const robB = robotArm(x - .2, .5, -3.6, robMat, 1.95, 2.3, 'grip');
    const bowl = (px, pz) => {
      add(scene, CY(.35, .45, .8, 20), MK.cabinet, px, .4, pz);
      add(scene, CY(.62, .45, .35, 28), MK.alu, px, .98, pz);
      const t = add(scene, new THREE.TorusGeometry(.59, .03, 6, 40), M.chrome, px, 1.185, pz, false); t.rotation.x = Math.PI / 2;
      for (let k = 0; k < 6; k++) { const a = k * 1.05; add(scene, CY(.07, .07, .05, 12), M.lens, px + Math.cos(a) * .3, 1.18, pz + Math.sin(a) * .3, false); }
    };
    bowl(x + 2.9, 4.75); bowl(x - 2.9, -4.75);
    // roof placer: x beams seated on the z beams, carriage on four bearing blocks, Z mast sliding through its guides
    const feet = new THREE.InstancedMesh(RB(.46, .04, .46, .01), MK.aluDark, 4);
    [-3.75, 3.75].forEach((dx, i) => [-4.75, 4.75].forEach((dz, j) => { prof(scene, 'y', 6.13, x + dx, 3.105, dz, .24); feet.setMatrixAt(2 * i + j, new THREE.Matrix4().makeTranslation(x + dx, .02, dz)); }));
    feet.receiveShadow = true; scene.add(feet);
    for (const dx of [-3.75, 3.75]) prof(scene, 'z', 9.76, x + dx, 6.3, 0, .26);
    for (const dz of [-.45, .45]) prof(scene, 'x', 7.76, x, 6.55, dz, .24);
    const rg = new THREE.Group(); rg.position.x = x; scene.add(rg);
    for (const dz of [-.45, .45]) { for (const dx of [-.24, .24]) add(rg, RB(.28, .1, .22, .02), MK.aluDark, dx, 6.732, dz); add(rg, RB(.86, .12, .39, .03), yellow, 0, 6.842, dz * .867); }
    for (const dx of [-.27, .27]) add(rg, BX(.1, .12, .38), yellow, dx, 6.842, 0);
    add(rg, CY(.09, .09, .3, 18), MK.blue, .2, 7.052, .39); add(rg, CY(.05, .05, .06, 12), MK.plastic, .2, 7.232, .39);
    add(rg, CYX(.09, .34, 18), MK.blue, -.12, 6.992, -.39); add(rg, RB(.16, .16, .16, .02), MK.aluDark, .13, 6.982, -.39);
    const rh = new THREE.Group(); rg.add(rh);
    prof(rh, 'y', 4.4, 0, 2.45, 0, .16);
    add(rh, RB(.22, .08, .22, .02), yellow, 0, 4.69, 0);
    add(rh, RB(.26, .07, .26, .02), MK.aluDark, 0, .215, 0);
    add(rh, RB(.9, .08, .9, .03), MK.aluDark, 0, .14, 0);
    add(rh, RB(.2, .08, .12, .02), MK.blue, .3, .22, 0);
    for (const dx of [-.3, .3]) for (const dz of [-.3, .3]) add(rh, CUP, MK.plastic, dx, 0, dz);
    // parked side-on, facing downstream, grippers hanging clear of the arch's path
    const restA = { t: V3(x + 3.6, 2.85, 3.8), a: V3(x + 3.6, 1.85, 3.8) }, restB = { t: V3(x + 1.9, 2.85, -3.8), a: V3(x + 1.9, 1.85, -3.8) };
    let rhy = 5.6;
    station(6, {
      update(dt, u, p) {
        const k = Math.min(1, (u ? 12 : 5) * dt);
        let ax = AX0, laser = 0;
        let ta = restA.t, aa = restA.a, tb = restB.t, ab = restB.a, ga = 0, gb = 0, hx = x, hyT = 5.6, hk = k;
        if (u) {
          const c = u.car, X = u.root.position.x, Y = u.root.position.y, P = c.parts.lx, G = c.G;
          const q = seg(p, .74, .98);
          if (p > .62) ax = X + lerp(G.xmin - .7, G.xmax + .7, ease(q));
          if (q > 0 && q < 1) laser = .35;
          if (p < .26) { VA.set(X + P.fx + .5, Y + P.ly, .58); VB.set(X + P.fx, Y + P.ly, .58); ta = VA; aa = VB; ga = p > .08 && p < .22 ? 1 : 0; }
          else if (p < .5 && c.parts.bumpers.length) { const bp = c.parts.bumpers[0], b = X + bp.position.x, by = Y + bp.userData.y; VA.set(b + .5, by, .6); VB.set(b, by, .6); ta = VA; aa = VB; ga = 1; }
          if (p < .26) { VC.set(X + P.rx - .5, Y + P.ly + .06, -.6); VD.set(X + P.rx, Y + P.ly + .06, -.6); tb = VC; ab = VD; gb = p > .04 && p < .2 ? 1 : 0; }
          else if (p < .5 && c.parts.bumpers.length > 1) { const bp = c.parts.bumpers[1], b = X + bp.position.x, by = Y + bp.userData.y; VC.set(b - .5, by, -.6); VD.set(b, by, -.6); tb = VC; ab = VD; gb = 1; }
          const r = c.parts.roof;
          if (r) {
            hx = X + r.position.x;
            if (p > .2 && p < .74) { hyT = Y + r.position.y + r.userData.h + .02; if (p > .3) hk = 1; }
            else if (p >= .74) hk = Math.min(1, 25 * dt);
          }
        }
        arch.position.x += (ax - arch.position.x) * Math.min(1, (u ? 20 : 4) * dt);
        laserMat.opacity += (laser - laserMat.opacity) * (1 - Math.exp(-17 * dt));
        scanMat.emissiveIntensity = laser ? 1.8 : .25;
        robA.reach(ta, aa, k); robA.grip(ga, dt);
        robB.reach(tb, ab, k); robB.grip(gb, dt);
        rg.position.x += (hx - rg.position.x) * Math.min(1, 8 * dt);
        rhy += (hyT - rhy) * hk; rh.position.y = rhy;
      }
    });
  }
}

/* ---------- lot, crane and shipping ---------- */
const STALL_X0 = 37.6, STALL_DX = 3.0, STALL_Z = 5.7, AISLE_R = 2.5, N_STALLS = 12;
// exit: a roller module carries the pallet one full pitch to its end stop (EXIT_END), then a lip, a landing and a
// cosine S-curve down to the floor, gentle enough for every wheelbase and overhang
const EXIT_END = EXIT_X + 2.5, DECK_Y = BELT_Y + PALLET_H - .007, RAMP_TOP = EXIT_END + .5, RAMP_LEN = 5.4, RAMP_END = RAMP_TOP + RAMP_LEN;
const rampY = x => x <= RAMP_TOP ? DECK_Y : x >= RAMP_END ? 0 : DECK_Y * (1 + Math.cos(Math.PI * (x - RAMP_TOP) / RAMP_LEN)) / 2;
const stall = i => ({ x: STALL_X0 + Math.floor(i / 2) * STALL_DX, side: i % 2 === 0 ? 1 : -1 });
const stallPose = i => { const s = stall(i); return { x: s.x, z: s.side * STALL_Z, yaw: -s.side * Math.PI / 2 }; };
const PACK_X = 57.8, ROLL_Y = 1.0, FEED_Z = -4.8, TRUCK_X = 64.8;
const CR_Y = 9.2, CABLE_TOP = CR_Y + 1.72, HY_PARK = 7.9, SPR = .85;
const BOX_W = 3.0, BOX_BASE = .16;
let shipped = 0, packCab = null;
const M4 = new THREE.Matrix4();

function buildLot() {
  // finished lot: stalls on both sides of a one-way aisle
  const X0 = 35.9, X1 = 54.3, Z0 = -9, Z1 = 9;
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * (Z1 - Z0) / (X1 - X0));
  const x = c.getContext('2d');
  const px = v => (v - X0) / (X1 - X0) * c.width, pz = v => (v - Z0) / (Z1 - Z0) * c.height;
  x.lineCap = 'square';
  for (let i = 0; i < N_STALLS; i++) {
    const s = stall(i), zA = s.side * 2.9, zB = s.side * 8.5, h = STALL_DX / 2;
    x.strokeStyle = 'rgba(232,177,0,.95)'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(px(s.x - h), pz(zA)); x.lineTo(px(s.x - h), pz(zB)); x.lineTo(px(s.x + h), pz(zB)); x.lineTo(px(s.x + h), pz(zA)); x.stroke();
    x.fillStyle = 'rgba(40,44,48,.55)'; x.font = '600 22px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('A' + (i + 1), px(s.x), pz(s.side * 3.2));
  }
  x.fillStyle = 'rgba(255,255,255,.75)';
  for (let ax = 36.6; ax < 53; ax += 5.4) {
    const X = px(ax), Z = pz(0), L = 40;
    x.beginPath(); x.moveTo(X - L, Z - 7); x.lineTo(X + 4, Z - 7); x.lineTo(X + 4, Z - 18); x.lineTo(X + L, Z); x.lineTo(X + 4, Z + 18); x.lineTo(X + 4, Z + 7); x.lineTo(X - L, Z + 7); x.fill();
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: canvasTex(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set((X0 + X1) / 2, .012, 0); m.receiveShadow = true; scene.add(m);
  floorLabel('FINISHED LOT A', 10, 1.4, 120).position.set(53, .014, 9.8); // between the crane's middle and end legs
  // wheel stops, bollards at the ramp foot, two lamp posts
  const stopTex = patTex(64, 16, (g, w, h) => { g.fillStyle = '#2A2D31'; g.fillRect(0, 0, w, h); g.fillStyle = '#E9B100'; g.fillRect(6, 0, 10, h); g.fillRect(w - 16, 0, 10, h); });
  const stops = new THREE.InstancedMesh(RB(1.5, .1, .2, .03), new THREE.MeshStandardMaterial({ map: stopTex, roughness: .8 }), N_STALLS);
  for (let i = 0; i < N_STALLS; i++) { const s = stall(i); stops.setMatrixAt(i, M4.makeTranslation(s.x, .05, s.side * 7.78)); }
  stops.castShadow = stops.receiveShadow = true; scene.add(stops);
  const bol = [[RAMP_END - .1, 1.75], [RAMP_END - .1, -1.75]];
  const bb = new THREE.InstancedMesh(new THREE.LatheGeometry([[.001, 0], [.13, 0], [.13, .8], [.1, .9], [.001, .93]].map(([r, h]) => new THREE.Vector2(r, h)), 20), yellow, bol.length);
  const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(.133, .133, .07, 20, 1, true), MK.plastic, bol.length * 2);
  bol.forEach(([bx, bz], i) => { bb.setMatrixAt(i, M4.makeTranslation(bx, 0, bz)); bands.setMatrixAt(2 * i, M4.makeTranslation(bx, .52, bz)); bands.setMatrixAt(2 * i + 1, M4.makeTranslation(bx, .68, bz)); });
  bb.castShadow = true; scene.add(bb, bands);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#FFF1D0', toneMapped: false });
  for (const s of [-1, 1]) {
    const lx = 35.4, lz = s * 9.4, lp = add(scene, new THREE.PlaneGeometry(.66, .24), lampMat, lx + 1.3, 4.979, lz, false);
    lp.rotation.x = Math.PI / 2;
    fadePole(lx + .6, lz, 5.2, 1.1, [lp, add(scene, RB(.44, .06, .44, .02), MK.aluDark, lx, .03, lz), add(scene, CY(.06, .08, 5.1, 14), MK.aluDark, lx, 2.61, lz),
      add(scene, BX(.84, .07, .07), MK.aluDark, lx + .48, 5.06, lz), add(scene, RB(.8, .12, .34, .04), MK.plastic, lx + 1.3, 5.04, lz)]);
  }

  // order preview turntable: bevelled plinth, wooden top, LED ring
  add(scene, new THREE.LatheGeometry([[3.4, 0], [3.45, .03], [3.45, .12], [3.37, .19], [3.3, .2], [.001, .2]].map(([r, h]) => new THREE.Vector2(r, h)), 96), M.graphite, PREVIEW_X, 0, 0);
  add(scene, CY(3.2, 3.22, .1, 96), M.wood, PREVIEW_X, .25, 0);
  const led = add(scene, new THREE.RingGeometry(3.235, 3.285, 120), new THREE.MeshBasicMaterial({ color: '#FFD45C', toneMapped: false }), PREVIEW_X, .2015, 0, false); led.rotation.x = -Math.PI / 2;
  floorLabel('ORDER PREVIEW', 7, 1, 120).position.set(PREVIEW_X, .014, 4.2);

  buildRamp();
  buildPalletReturn();
  buildCrane();
  buildPacking();
  buildTruck();
}

function buildRamp() {
  // exit roller module: same frame as the belt, chrome rollers, rubber end stops that catch the pallet's front corners
  const mx0 = BELT_X1 + .2, mx1 = EXIT_END + .1, ml = mx1 - mx0, mc = (mx0 + mx1) / 2;
  for (const z of [-1.72, 1.72]) {
    prof(scene, 'x', ml, mc, BELT_Y - .05, z, .24);
    add(scene, BX(ml, .03, .06), MK.white, mc, BELT_Y + .085, z * .985, false);
    prof(scene, 'y', BELT_Y - .24, EXIT_END - .15, (BELT_Y - .24) / 2 + .05, z * .9, .16); add(scene, CY(.1, .12, .05, 14), MK.plastic, EXIT_END - .15, .025, z * .9);
    add(scene, BX(.12, .1, .35), yellow, EXIT_END + .06, BELT_Y + .05, Math.sign(z) * 1.425);
    add(scene, BX(.04, .1, .1), M.rubber, EXIT_END + .02, BELT_Y + .06, Math.sign(z) * 1.2);
  }
  prof(scene, 'z', 2.94, EXIT_END - .15, .32, 0, .14);
  const nr = 9, rl = new THREE.InstancedMesh(CYZ(.07, 3.0, 16), M.chrome, nr);
  for (let k = 0; k < nr; k++) rl.setMatrixAt(k, M4.makeTranslation(BELT_X1 + .35 + k * .25, BELT_Y - .07, 0));
  rl.castShadow = rl.receiveShadow = true; scene.add(rl);
  // a lip plate at pallet-top height, a short landing, then the S-curve; hazard-striped curbs keep the wheels true
  const x0 = EXIT_END + .01, xh = EXIT_END + .26, xe = RAMP_END - .4, N = 40, pts = [];
  for (let i = 0; i <= N; i++) { const X = RAMP_TOP + (xe - RAMP_TOP) * i / N; pts.push([X, rampY(X)]); }
  const ext = (s, depth, z) => { const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, z); return g; };
  const deck = new THREE.Shape(); deck.moveTo(xh, DECK_Y); pts.forEach(([X, Y]) => deck.lineTo(X, Y)); deck.lineTo(xe, 0); deck.lineTo(xh, 0);
  const lip = hazardTex.clone(); lip.repeat.set(1, 6); lip.needsUpdate = true;
  add(scene, faces(BX(xh - x0, .03, 2.26), [0, 0, 1, 0, 0, 0]), [steel, new THREE.MeshStandardMaterial({ map: lip, roughness: .6 })], (x0 + xh) / 2, DECK_Y - .015, 0);
  const plate = plateTex.clone(); plate.repeat.set(1.2, 1.2); plate.needsUpdate = true;
  add(scene, ext(deck, 2.54, -1.27), [MK.alu, new THREE.MeshStandardMaterial({ map: plate, metalness: .45, roughness: .45 })]); // brushed side walls like the module frames
  const curb = new THREE.Shape(); curb.moveTo(xh, DECK_Y + .002); curb.lineTo(xh, DECK_Y + .1); pts.forEach(([X, Y]) => curb.lineTo(X, Y + .1)); [...pts].reverse().forEach(([X, Y]) => curb.lineTo(X, Y + .002));
  const hz = hazardTex.clone(); hz.repeat.set(.6, 1); hz.needsUpdate = true;
  const curbMat = [yellow, new THREE.MeshStandardMaterial({ map: hz, roughness: .6 })];
  for (const s of [-1, 1]) add(scene, ext(curb, .14, s > 0 ? 1.13 : -1.27), curbMat);
}

// pallet return: a slewing jib lifts the empty pallet off the belt end and drops it into the return magazine
const JIB_X = 24.0, JIB_Z = -3.2, JIB_R = Math.hypot(EXIT_X - JIB_X, JIB_Z), TH_PICK = Math.atan2(JIB_Z, EXIT_X - JIB_X), TH_PARK = TH_PICK + Math.PI / 2;
const MAG_X = JIB_X + JIB_R * Math.cos(TH_PARK), MAG_Z = JIB_Z - JIB_R * Math.sin(TH_PARK);
const YG = [DECK_Y + .34, DECK_Y + .86, 1.13 + .34], STACK_Y = .85, PITCH = PALLET_H + .2;
// [time after the pallet stops, 0 park / 1 pick, gripper height index]
const JIB_K = [[0, 0, 1], [1.45, 0, 1], [1.85, 1, 1], [1.97, 1, 0], [2.05, 1, 0], [2.2, 1, 1], [2.65, 0, 1], [2.8, 0, 2], [2.9, 0, 2], [3.1, 0, 1]];
let jb, jgr, stk;
function buildPalletReturn() {
  add(scene, RB(.9, .08, .9, .02), steelDark, JIB_X, .053, JIB_Z);
  add(scene, CY(.2, .24, 1.987, 24), yellow, JIB_X, 1.0865, JIB_Z);
  jb = new THREE.Group(); jb.position.set(JIB_X, 0, JIB_Z); jb.rotation.y = TH_PARK; scene.add(jb);
  const R = JIB_R;
  add(jb, CY(.3, .3, .16, 28), MK.aluDark, 0, 2.16, 0);
  add(jb, RB(R + .21, .24, .24, .05), yellow, (R - .49) / 2, 2.36, 0);
  add(jb, RB(.42, .36, .36, .05), steelDark, -.56, 2.36, 0);
  add(jb, CY(.09, .09, .28, 16), MK.blue, 0, 2.38, -.25);
  add(jb, BX(.07, .2, .14), MK.aluDark, R - .105, 2.36, 0);
  add(jb, new THREE.CylinderGeometry(.07, .07, .75, 16, 1, true), MK.alu, R, 2.425, 0);
  add(jb, CY(.075, .075, .05, 16), MK.aluDark, R, 2.825, 0);
  jgr = new THREE.Group(); jgr.position.set(R, YG[1], 0); jgr.rotation.y = -TH_PICK; jb.add(jgr);
  add(jgr, CY(.035, .035, .7, 12), M.chrome, 0, .51, 0);
  add(jgr, RB(.36, .1, .28, .02), MK.aluDark, 0, .11, 0);
  prof(jgr, 'x', 3.6, 0, 0, 0, .12);
  const cups = new THREE.InstancedMesh(CUP, MK.plastic, 4), stems = new THREE.InstancedMesh(CY(.025, .025, .06, 8), MK.aluDark, 4);
  for (const s of [-1, 1]) {
    prof(jgr, 'z', 1.8, s * 1.7, -.12, 0, .12);
    for (const dz of [-.75, .75]) { const k = (s + 1) + (dz > 0 ? 1 : 0); cups.setMatrixAt(k, M4.makeTranslation(s * 1.7, -.34, dz)); stems.setMatrixAt(k, M4.makeTranslation(s * 1.7, -.21, dz)); }
  }
  cups.castShadow = true; jgr.add(cups, stems);
  // return magazine: pallets sink one pitch per drop, the stack keeps its top at the rim
  const hx = 1.3, hz = 2.55, H = 1.05;
  const wm = [MK.cabinet, yellow], wf = g => faces(g, [0, 0, 1, 0, 0, 0]);
  const guides = new THREE.InstancedMesh(PROF, MK.aluDark, 4), feet = new THREE.InstancedMesh(CY(.07, .09, .06, 12), MK.plastic, 4), q = new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), Math.PI / 2);
  for (const s of [-1, 1]) {
    add(scene, wf(BX(.06, H - .06, 2 * hz + .12)), wm, MAG_X + s * (hx + .03), .06 + (H - .06) / 2, MAG_Z);
    add(scene, wf(BX(2 * hx, H - .06, .06)), wm, MAG_X, .06 + (H - .06) / 2, MAG_Z + s * (hz + .03));
    for (const t of [-1, 1]) { const k = s + 1 + (t + 1) / 2; guides.setMatrixAt(k, M4.compose(V3(MAG_X + s * (hx + .03), H + .15, MAG_Z + t * (hz + .03)), q, V3(.5, .5, .3))); feet.setMatrixAt(k, M4.makeTranslation(MAG_X + s * 1.2, .03, MAG_Z + t * 2.45)); }
  }
  guides.castShadow = true; scene.add(guides, feet);
  add(scene, BX(2 * hx, .04, 2 * hz), MK.aluDark, MAG_X, .08, MAG_Z);
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128;
  { const g = lc.getContext('2d'); g.fillStyle = '#1D2126'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#E9B100'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1D2126'; g.font = '600 44px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('07R', 64, 66); g.fillStyle = '#F2F3F4'; g.font = '800 40px Archivo, "Arial Black", sans-serif'; g.fillText('PALLET RETURN', 320, 68, 360); }
  // sign board on the front wall's top edge, above the exit module's frame, under the swinging pallet (its underside at 1.42)
  add(scene, BX(1.2, .32, .03), MK.plastic, MAG_X, H + .16, MAG_Z + hz + .03);
  add(scene, new THREE.PlaneGeometry(1.12, .28), new THREE.MeshBasicMaterial({ map: canvasTex(lc), toneMapped: false }), MAG_X, H + .16, MAG_Z + hz + .046, false);
  stk = new THREE.Group(); stk.position.set(MAG_X, 0, MAG_Z); stk.userData.y = 0; scene.add(stk);
  for (let k = 0; k < 3; k++) { const p = makePallet(); p.rotation.y = Math.PI / 2; p.position.y = STACK_Y - k * PITCH; stk.add(p); }
}
function updateJib(dt) {
  const pl = pallets[0];
  let th = 0, yg = YG[1];
  if (pl) {
    pl.t += dt;
    const K = JIB_K, t = Math.min(pl.t, K[K.length - 1][0]);
    let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], f = ease(seg(t, a[0], b[0]));
    th = lerp(a[1], b[1], f); yg = lerp(YG[a[2]], YG[b[2]], f);
    if (!pl.st && pl.t >= 2.01) { jgr.attach(pl.g); pl.st = 1; }
    if (pl.st === 1 && pl.t >= 2.85) { stk.attach(pl.g); pl.st = 2; stk.userData.y -= PITCH; }
    if (pl.t >= K[K.length - 1][0]) pallets.shift();
  }
  jb.rotation.y = lerp(TH_PARK, TH_PICK, th); jgr.position.y = yg;
  stk.position.y += (stk.userData.y - stk.position.y) * Math.min(1, 5 * dt);
  for (const p of [...stk.children]) if (stk.position.y + p.position.y < .4) p.removeFromParent();
}

// poles the Follow camera fades out when they stand close to it or in front of the car (updatePoles); each gets its own
// transparent copies of its materials so the fade never touches the shared ones; at opacity 1 they draw like the originals
const poles = [];
function fadePole(x, z, top, r, meshes) {
  const own = new Map();
  for (const m of meshes) { if (!own.has(m.material)) own.set(m.material, Object.assign(m.material.clone(), { transparent: true })); m.material = own.get(m.material); }
  poles.push({ x, z, top, r, o: 1, h: false, mats: [...own.values()] });
}
// overhead lot crane
const crane = { x: 46, z: 0, top: HY_PARK, yaw: 0, grip: 0, w0: -1.5, w1: 1.5, len: 2.2, task: null };
let crB, trG, spr, cables = [], armsCr = [], trolleysCr = [];
function buildCrane() {
  const X0 = 27.6, X1 = 60.0, Z = 11.2, L = X1 - X0, cxm = (X0 + X1) / 2;
  for (const cx of [X0, cxm, X1]) for (const s of [-1, 1]) fadePole(cx, s * Z, CR_Y - .6, .45, [
    prof(scene, 'y', CR_Y - .7, cx, .08 + (CR_Y - .7) / 2, s * Z, .42, MK.aluDark),
    add(scene, BX(.9, .08, .9), MK.aluDark, cx, .04, s * Z),
    add(scene, BX(.42, 1.6, .06), MK.hazard, cx, .88, s * Z - s * .24, false)]);
  for (const s of [-1, 1]) {
    add(scene, BX(L + .6, .06, .42), steelDark, cxm, CR_Y - .59, s * Z);
    add(scene, BX(L + .6, .5, .08), steelDark, cxm, CR_Y - .31, s * Z);
    add(scene, BX(L + .6, .06, .42), steelDark, cxm, CR_Y - .03, s * Z);
    add(scene, BX(L + .6, .06, .08), M.chrome, cxm, CR_Y + .03, s * Z, false);
  }
  crB = new THREE.Group(); scene.add(crB);
  for (const s of [-1, 1]) {
    for (const wx of [-.6, .6]) add(crB, CYZ(.16, .14, 16), MK.plastic, wx, CR_Y + .22, s * Z);
    add(crB, RB(1.7, .4, .7, .05), yellow, 0, CR_Y + .58, s * Z);
    add(crB, BX(.9, .1, .03), MK.hazard, 0, CR_Y + .58, s * (Z + .366), false);
  }
  for (const gx of [-.42, .42]) add(crB, BX(.36, .7, 2 * Z + .7), yellow, gx, CR_Y + 1.13, 0);
  trG = new THREE.Group(); trG.position.y = CR_Y + 1.48; crB.add(trG);
  for (const s of [-1, 1]) for (const wz of [-.5, .5]) add(trG, CYX(.12, .1, 14), MK.plastic, s * .42, .12, wz);
  add(trG, RB(1.45, .46, 1.3, .05), MK.aluDark, 0, .47, 0);
  add(trG, CYX(.3, 1.0, 24), MK.plastic, 0, 1.0, 0);
  add(trG, CYX(.2, .55, 18), MK.blue, .78, 1.0, 0);
  for (let k = 0; k < 2; k++) cables.push(add(scene, CY(.025, .025, 1, 6), MK.plastic, 0, 0, 0, false));
  // spreader: a yellow frame, two wheelbase trolleys, each with a pair of arms whose rubber pads grip the axle peg heads
  spr = new THREE.Group(); scene.add(spr);
  for (const s of [-1, 1]) { add(spr, BX(4.6, .16, .14), yellow, 0, 0, s * .95); add(spr, BX(.16, .16, 1.76), yellow, s * 2.22, 0, 0); }
  add(spr, BX(.16, .14, 1.76), yellow, 0, 0, 0);
  add(spr, RB(.5, .36, .44, .05), MK.aluDark, 0, .26, 0);
  add(spr, CYZ(.18, .12, 20), M.chrome, 0, .62, 0);
  for (let w = 0; w < 2; w++) {
    const tw = new THREE.Group(); spr.add(tw); trolleysCr.push(tw);
    add(tw, BX(.16, .12, 3.6), MK.aluDark, 0, -.16, 0);
    for (const s of [-1, 1]) add(tw, BX(.2, .02, .16), MK.plastic, 0, -.09, s * .95);
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); tw.add(g);
      add(g, RB(.22, .14, .22, .03), yellow, 0, -.29, 0);
      const bar = add(g, BX(.1, 1, .1), MK.aluDark, 0, -.86, 0);
      const jaw = new THREE.Group(); g.add(jaw);
      add(jaw, RB(.3, .34, .08, .02), yellow, 0, 0, -s * .09);
      add(jaw, CYZ(.13, .04, 20), M.rubber, 0, 0, -s * .15);
      armsCr.push({ g, bar, jaw, s });
    }
  }
  cranePose();
}
function cranePose() {
  crB.position.x = crane.x; trG.position.z = crane.z;
  spr.position.set(crane.x, crane.top, crane.z); spr.rotation.y = crane.yaw;
  const top = crane.top + .81, len = Math.max(.1, CABLE_TOP - top);
  cables.forEach((c, i) => { c.position.set(crane.x + (i ? .1 : -.1), top + len / 2, crane.z); c.scale.y = len; });
  trolleysCr[0].position.x = crane.w0; trolleysCr[1].position.x = crane.w1;
  const zg = lerp(1.66, 1.31, crane.grip);
  for (const a of armsCr) { a.g.position.z = a.s * zg; a.bar.scale.y = crane.len; a.bar.position.y = -.36 - crane.len / 2; a.jaw.position.y = -.36 - crane.len; }
}
function computeDims(car) {
  const r = car.root, p = r.position.clone(), q = r.quaternion.clone(), s = r.scale.clone();
  r.position.set(0, 0, 0); r.quaternion.identity(); r.scale.set(1, 1, 1); r.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(r);
  r.position.copy(p); r.quaternion.copy(q); r.scale.copy(s); r.updateMatrixWorld(true);
  car.dims = { top: b.max.y, x0: b.min.x, x1: b.max.x };
}
function carryCar(car) {
  car.root.position.set(crane.x, crane.top - (car.dims.top + SPR), crane.z);
  car.root.rotation.set(0, crane.yaw, 0);
}
const boxDims = car => ({ L: car.dims.x1 - car.dims.x0 + .5, H: BOX_BASE + car.dims.top + .25, c: (car.dims.x0 + car.dims.x1) / 2 });
function startShipping() {
  // the car that just came off the line ships next; the stock cars parked at boot only go when the lot is nearly full
  const oldest = ok => { let b = -1; lot.forEach((s, i) => { if (s && s.car && !s.ship && ok(s) && (b < 0 || s.seq < lot[b].seq)) b = i; }); return b; };
  let best = oldest(s => !s.stock);
  if (best < 0 && lot.filter(Boolean).length >= N_STALLS - 1) best = oldest(() => true);
  if (best < 0) return;
  const entry = lot[best]; entry.ship = true;
  const car = entry.car, st = stallPose(best), top = car.dims.top, B = boxDims(car);
  const grab = top + SPR, high = Math.max(3.75, ROLL_Y + B.H + .25) + top + SPR, drop = ROLL_Y + BOX_BASE + top + SPR;
  car.status = 'Waiting for the lot crane';
  const T = { car, i: 0, t: 0, carton: null };
  T.phases = [
    { to: { x: st.x, z: st.z, top: Math.max(high, crane.top), yaw: st.yaw, grip: 0, w0: car.def.wheels[0], w1: car.def.wheels[1], len: top + SPR - WCY - .36 } },
    { to: { top: grab }, dur: .45 },
    { to: { grip: 1 }, dur: .22, onEnd: () => { car.status = 'Lifted by the lot crane'; car.place = 'crane'; } },
    { to: { top: high }, dur: .5, carry: true, onStart: () => { T.carton = spawnCarton(car); }, onEnd: () => { if (lot[best] === entry) lot[best] = null; } },
    { to: { x: PACK_X, z: 0, yaw: 0 }, carry: true },
    { to: { top: drop }, dur: .5, carry: true, until: () => T.carton && T.carton.state === 'wait' },
    { to: { grip: .8 }, dur: .16, carry: true, onEnd: () => packCar(T) },
    { to: { top: HY_PARK }, dur: .45 },
    { to: { grip: 0 }, dur: .15 }
  ];
  crane.task = T;
}
function updateCrane(dt) {
  const T = crane.task;
  if (!T) {
    startShipping();
    if (!crane.task) { crane.x += (46 - crane.x) * Math.min(1, dt * .8); crane.top += (HY_PARK - crane.top) * Math.min(1, dt * 2); cranePose(); return; }
  }
  const t = crane.task, ph = t.phases[t.i];
  if (!ph.from && ph.until && !ph.until()) { if (ph.carry) carryCar(t.car); cranePose(); return; }
  if (!ph.from) {
    ph.from = {}; for (const key in ph.to) ph.from[key] = crane[key];
    if (!ph.dur) ph.dur = .35 + Math.hypot((ph.to.x ?? crane.x) - crane.x, (ph.to.z ?? crane.z) - crane.z) / 22;
    ph.onStart && ph.onStart();
  }
  t.t += dt / ph.dur;
  const k = ease(Math.min(1, t.t));
  for (const key in ph.to) crane[key] = lerp(ph.from[key], ph.to[key], k);
  if (ph.carry) carryCar(t.car);
  if (t.t >= 1) { ph.onEnd && ph.onEnd(); t.i++; t.t = 0; if (t.i >= t.phases.length) crane.task = null; }
  cranePose();
}

// retail window boxes: printed card, cellophane window, a road-printed tray; the lid swings over and its tuck flap folds in
const cartons = [];
// the truck's rear barn doors: o = 0 shut, 1 swung all the way round flat against the body
const truckDoors = { o: 0, pivots: [] };
let BOXK = null;
const rrect = (x, X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
function brandMark(x, X, Y, s, ink = '#F4F3EF') {
  x.save(); x.textBaseline = 'middle'; x.textAlign = 'left';
  x.font = `600 ${Math.round(s * .56)}px "IBM Plex Mono", Menlo, monospace`;
  const w = x.measureText('HAS').width + s * .34, h = s * .84;
  x.fillStyle = '#E9B100'; rrect(x, X, Y - h / 2, w, h, s * .12); x.fill();
  x.fillStyle = '#15181B'; x.fillText('HAS', X + s * .17, Y + s * .03);
  x.font = `850 ${Math.round(s)}px Archivo, "Arial Black", sans-serif`; x.fillStyle = ink; x.fillText('Wheels', X + w + s * .16, Y + s * .04);
  const end = X + w + s * .16 + x.measureText('Wheels').width; x.restore(); return end;
}
function barcode(x, X, Y, w, h, seed) {
  let r = seed * 9301 + 49297;
  x.fillStyle = '#FFFFFF'; x.fillRect(X - 6, Y - 6, w + 12, h + 22); x.fillStyle = '#15181B';
  for (let p = X; p < X + w;) { r = (r * 9301 + 49297) % 233280; const b = 1 + (r % 3); if ((r >> 3) % 2) x.fillRect(p, Y, b * 1.6, h); p += b * 1.6 + 1.6; }
  x.font = '500 11px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText(String(400000000000 + seed * 7919).slice(0, 12), X + w / 2, Y + h + 2);
}
function boxKit() {
  if (BOXK) return BOXK;
  const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return canvasTex(c); };
  const backdrop = mk(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9FD0E8'); g.addColorStop(.7, '#E8F4F6'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#FFE6A3'; x.beginPath(); x.arc(w * .78, h * .3, 46, 0, 7); x.fill();
    const hill = (y, a, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 32; i++) x.lineTo(i * w / 32, y + Math.sin(i * a) * 22 + Math.sin(i * a * 2.3) * 9); x.lineTo(w, h); x.fill(); };
    hill(h * .58, .45, '#8FCBB5'); hill(h * .7, .7, '#2F7D6A');
    x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '850 150px Archivo, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Wheels', w / 2, h * .32);
  });
  const back = mk(1024, 512, (x, w, h) => {
    x.fillStyle = '#F7F6F2'; x.fillRect(0, 0, w, h); x.fillStyle = '#1D2126'; x.fillRect(0, h * .72, w, h * .28);
    brandMark(x, 40, h * .86, 64);
    x.fillStyle = '#1D2126'; x.font = '500 22px "IBM Plex Mono", monospace'; x.textBaseline = 'top';
    ['Solid birch body, turned beech wheels.', 'Water-based lacquer, sanded by hand on the line.', 'Built to order in the HAS toy works.'].forEach((l, i) => x.fillText(l, 40, 60 + i * 34));
    barcode(x, w - 250, 60, 200, 90, 7);
  });
  const end = mk(256, 512, (x, w, h) => {
    x.fillStyle = '#1D2126'; x.fillRect(0, 0, w, h); x.fillStyle = '#E9B100'; x.fillRect(0, h * .78, w, 14);
    x.save(); x.translate(w * .55, h * .4); x.rotate(-Math.PI / 2); brandMark(x, -150, 0, 46); x.restore();
    x.fillStyle = '#F4F3EF'; x.font = '600 22px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.fillText('AGES 3+', w / 2, h * .88);
  });
  const tab = mk(128, 64, (x, w, h) => { x.fillStyle = '#F7F6F2'; x.fillRect(0, 0, w, h); x.fillStyle = '#E9B100'; x.fillRect(0, 0, w, 6); x.fillRect(0, h - 6, w, 6); x.globalCompositeOperation = 'destination-out'; rrect(x, w / 2 - 22, h / 2 - 7, 44, 14, 7); x.fill(); });
  const road = mk(512, 128, (x, w, h) => {
    x.fillStyle = '#4A5058'; x.fillRect(0, 0, w, h); x.fillStyle = '#F4F3EF'; x.fillRect(0, 10, w, 4); x.fillRect(0, h - 14, w, 4);
    for (let i = 0; i < w; i += 64) x.fillRect(i + 8, h / 2 - 3, 36, 6);
  });
  const card = new THREE.MeshStandardMaterial({ color: '#F4F2EC', roughness: .8 }), inner = new THREE.MeshStandardMaterial({ color: '#E2DCCF', roughness: .9 });
  const std = map => new THREE.MeshStandardMaterial({ map, roughness: .6 });
  return BOXK = { card, inner, back: [card, std(backdrop), std(back)], end: std(end), tray: [card, std(road)], tab: [card, new THREE.MeshStandardMaterial({ map: tab, alphaTest: .5, roughness: .6 })],
    cello: new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', transparent: true, opacity: .14, roughness: .04, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }) };
}
function boxPrint(car, L, H) {
  const cw = 1024, k = cw / L, ch = Math.round(H * k), cfg = car.cfg, name = BODIES[cfg.body].name;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.fillStyle = '#F7F6F2'; x.fillRect(0, 0, cw, ch);
  const bandH = .46 * k, wy0 = .3 * k, wy1 = ch - bandH - .12 * k;
  x.fillStyle = '#1D2126'; x.fillRect(0, ch - bandH, cw, bandH);
  x.fillStyle = cfg.color; x.fillRect(0, ch - bandH - .085 * k, cw, .06 * k);
  x.fillStyle = cfg.accent; x.fillRect(0, ch - bandH - .025 * k, cw, .025 * k);
  const logoEnd = brandMark(x, .24 * k, ch - bandH / 2, .26 * k);
  x.fillStyle = '#F4F3EF'; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
  x.font = `800 ${Math.round(.2 * k)}px Archivo, "Arial Black", sans-serif`; x.fillText(name.toUpperCase(), cw - .78 * k, ch - bandH / 2 + .02 * k);
  // spec line: drop whole ' · ' items from the end until it fits beside the logo, never a word cut in half
  x.font = `500 ${Math.round(.085 * k)}px "IBM Plex Mono", monospace`; x.fillStyle = '#9AA3AB';
  let spec = `${car.wo || ''} · ${describe(cfg)}`;
  while (x.measureText(spec).width > cw - .9 * k - logoEnd && spec.includes(' · ')) spec = spec.slice(0, spec.lastIndexOf(' · '));
  x.fillText(spec, cw - .78 * k, ch - bandH / 2 + .15 * k);
  x.strokeStyle = '#E9B100'; x.lineWidth = .025 * k; x.beginPath(); x.arc(cw - .45 * k, ch - bandH / 2, .17 * k, 0, 7); x.stroke();
  x.fillStyle = '#E9B100'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${Math.round(.14 * k)}px Archivo, sans-serif`; x.fillText('3+', cw - .45 * k, ch - bandH / 2 + .01 * k);
  x.fillStyle = '#1D2126'; x.textAlign = 'left'; x.font = `600 ${Math.round(.1 * k)}px "IBM Plex Mono", monospace`; x.fillText('WOODEN TOY CAR', .24 * k, wy0 / 2);
  x.textAlign = 'right'; x.fillStyle = '#59616A'; x.fillText('AGES 3+ · SOLID BIRCH', cw - .24 * k, wy0 / 2);
  x.strokeStyle = '#1D2126'; x.lineWidth = 6; rrect(x, .2 * k, wy0, cw - .4 * k, wy1 - wy0, .14 * k); x.stroke();
  x.globalCompositeOperation = 'destination-out'; rrect(x, .2 * k, wy0, cw - .4 * k, wy1 - wy0, .14 * k); x.fill(); x.globalCompositeOperation = 'source-over';
  const inner = document.createElement('canvas'); inner.width = 256; inner.height = Math.max(32, Math.round(256 * H / L));
  const y = inner.getContext('2d'), s = 256 / cw; y.fillStyle = '#F4F2EC'; y.fillRect(0, 0, 256, inner.height);
  y.globalCompositeOperation = 'destination-out'; rrect(y, .2 * k * s, wy0 * s, (cw - .4 * k) * s, (wy1 - wy0) * s, .14 * k * s); y.fill();
  return { c, inner, win: [(.2 * k) / k, wy0 / k, (cw - .4 * k) / k, (wy1 - wy0) / k] };
}
function lidPrint(car, L) {
  const cw = 1024, k = cw / L, ch = Math.round(BOX_W * k);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.fillStyle = '#F7F6F2'; x.fillRect(0, 0, cw, ch);
  x.fillStyle = car.cfg.color; x.fillRect(0, ch - .3 * k, cw, .3 * k); x.fillStyle = '#1D2126'; x.fillRect(0, ch - .34 * k, cw, .04 * k);
  const w = brandMark(document.createElement('canvas').getContext('2d'), 0, 0, .5 * k);
  x.save(); x.translate((cw - w) / 2, ch * .42); brandMark(x, 0, 0, .5 * k, '#1D2126'); x.restore();
  x.fillStyle = '#59616A'; x.font = `500 ${Math.round(.11 * k)}px "IBM Plex Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(`${BODIES[car.cfg.body].name.toUpperCase()} · ${car.wo || ''}`, cw / 2, ch * .42 + .42 * k);
  return c;
}
function spawnCarton(car) {
  const K = boxKit(), B = boxDims(car), L = B.L, H = B.H, Wb = BOX_W, cx = B.c, t = .03;
  const g = new THREE.Group(); scene.add(g);
  const own = [], mine = o => (own.push(o), o);
  const mk = (geo, mat, px, py, pz, parent = g, shadow = true) => add(parent, mine(geo), mat, px, py, pz, shadow);
  const P = boxPrint(car, L, H);
  const front = mine(new THREE.MeshStandardMaterial({ map: mine(canvasTex(P.c)), alphaTest: .5, roughness: .55 }));
  const inner = mine(new THREE.MeshStandardMaterial({ color: '#F4F2EC', map: mine(canvasTex(P.inner)), alphaTest: .5, roughness: .8 }));
  const lidMat = mine(new THREE.MeshStandardMaterial({ map: mine(canvasTex(lidPrint(car, L))), roughness: .55 }));
  mk(BX(L, .04, Wb), K.card, cx, .02, 0);
  mk(faces(BX(L, H - .04, t), [0, 0, 0, 0, 1, 2]), K.back, cx, .04 + (H - .04) / 2, -Wb / 2 + t / 2);
  for (const s of [-1, 1]) mk(BX(t, H - .04, Wb - 2 * t), K.end, cx + s * (L / 2 - t / 2), .04 + (H - .04) / 2, 0);
  const fp = mk(new THREE.PlaneGeometry(L, H), front, cx, H / 2, Wb / 2 + .001, g, false); fp.castShadow = true;
  mk(new THREE.PlaneGeometry(L, H), inner, cx, H / 2, Wb / 2 - .004, g, false).rotation.y = Math.PI;
  const [wx, wy, ww, wh] = P.win;
  mk(new THREE.PlaneGeometry(ww, wh), K.cello, cx - L / 2 + wx + ww / 2, H - wy - wh / 2, Wb / 2 - .02, g, false);
  mk(faces(BX(L - .3, .12, 2.3), [0, 0, 1, 0, 0, 0]), K.tray, cx, .1, 0);
  // lid hinged on the back edge, hanging open behind the box; its tuck flap folds in behind the window panel
  const lid = new THREE.Group(); lid.position.set(cx, H, -Wb / 2); g.add(lid);
  mk(faces(BX(L, t, Wb - t), [0, 0, 1, 2, 0, 0]), [K.card, lidMat, K.inner], 0, t / 2, (Wb - t) / 2, lid);
  const flap = new THREE.Group(); flap.position.set(0, t / 2, Wb - t - .02); lid.add(flap);
  mk(BX(L - .1, .02, .26), K.inner, 0, 0, .13, flap);
  // euro-slot hang tab: lies on the lid while it swings, stands up once the box is shut
  const hang = new THREE.Group(); hang.position.set(0, t, .015); lid.add(hang);
  mk(faces(BX(1.0, .015, .28), [0, 0, 1, 1, 0, 0]), K.tab, 0, .0075, .14, hang);
  lid.rotation.x = -(Math.PI + .3);
  g.position.set(PACK_X, ROLL_Y, FEED_Z);
  const c = { g, car, state: 'feed', t: 0, lid, flap, hang, own, L, cx };
  cartons.push(c);
  return c;
}
function packCar(T) {
  const c = T.carton; if (!c) return;
  c.g.attach(T.car.root);
  c.state = 'close'; c.t = 0;
  T.car.status = 'Packed in its HAS Wheels box';
  // only good cars get a carton (SPEC §2.6): it goes on the tab as the box starts to close
  const car = T.car; car.place = 'carton';
  post(car, 'carton', 'Carton', R.carton, 8, 'carton'); ACT.packed++;
  emitE('packed', { wo: car.wo, car, post: R.carton, tab: car.tab.total });
}
function updateCartons(dt) {
  for (const c of [...cartons]) {
    c.t += dt;
    if (c.state === 'feed') {
      // hold the new box on the infeed until the previous one has cleared the pack station
      if (cartons.some(o => o !== c && o.state !== 'feed' && o.g.position.x + o.cx - o.L / 2 < PACK_X + c.cx + c.L / 2 + .3)) c.t = 0;
      c.g.position.z = lerp(FEED_Z, 0, ease(Math.min(1, c.t / .8))); if (c.t >= .8) c.state = 'wait';
    }
    else if (c.state === 'close') {
      const a = ease(seg(c.t, 1.1, 1.65));
      c.lid.rotation.x = -(Math.PI + .3) * (1 - a);
      c.flap.rotation.x = (Math.PI / 2 + .3) * ease(seg(c.t, 1.0, 1.2)) - .3 * ease(seg(c.t, 1.65, 1.8));
      c.hang.rotation.x = -Math.PI / 2 * easeBack(seg(c.t, 1.8, 2.05));
      // the box loaded last stays in the truck until this one rides in after it
      if (c.t >= 2.1) { c.state = 'ride'; c.t = 0; c.x0 = c.g.position.x; c.car.status = 'Boxed, riding to the outbound truck'; for (const o of [...cartons]) if (o.state === 'loaded') unload(o); }
    } else if (c.state === 'ride') {
      c.g.position.x = lerp(c.x0, TRUCK_X + 6, ease(Math.min(1, c.t / 2.6)));
      if (c.t >= 2.6) {
        c.state = 'loaded'; c.car.status = 'Loaded on the HAS Wheels truck'; c.car.loadedFor = 0; shipped++; updateHud();
        // freight goes on the tab and the shop now owes the price: an invoice, not cash (the Bank does not move)
        const car = c.car, price = planPrice ?? R.price; car.place = 'truck';
        post(car, 'freight', 'Freight', R.freight, 9, 'freight'); ACT.shipped++; ACT.invoiced += price;
        emitE('shipped', { wo: car.wo, car, post: R.freight, tab: car.tab.total, invoice: price });
      }
    } else if (c.state === 'loaded') c.car.loadedFor += dt;
  }
  // doors open while the next box is being packed, stay open for its ride, and swing shut once it is loaded
  const want = cartons.some(c => c.state === 'close' || c.state === 'ride') ? 1 : 0;
  if (truckDoors.o !== want) { truckDoors.o = want ? Math.min(1, truckDoors.o + dt / 1.8) : Math.max(0, truckDoors.o - dt / 1.8); poseDoors(); }
  if (truckDoors.o === 0) for (const c of [...cartons]) if (c.state === 'loaded' && c.car.loadedFor > 2.6) unload(c);
}
function poseDoors() {
  for (const pv of truckDoors.pivots) {
    const s = pv.userData.s, o = ease(clamp(truckDoors.o * 1.12 - (s > 0 ? 0 : .12), 0, 1)); // one door leads the other a touch
    pv.rotation.y = s * (Math.PI / 2 + o * Math.PI * 1.5);
  }
}
function unload(c) {
  disposeCar(c.car); c.g.removeFromParent(); c.own.forEach(o => o.dispose && o.dispose());
  cartons.splice(cartons.indexOf(c), 1);
}
function buildPacking() {
  const x0 = PACK_X - 3.4, x1 = TRUCK_X - .3, L = x1 - x0, cx = (x0 + x1) / 2;
  for (const s of [-1, 1]) {
    prof(scene, 'x', L, cx, ROLL_Y - .14, s * 1.5, .2);
    for (let lx = x0 + .2; lx < x1; lx += 2.6) { prof(scene, 'y', ROLL_Y - .29, lx, (ROLL_Y - .29) / 2 + .05, s * 1.5, .16); add(scene, CY(.1, .12, .05, 14), MK.plastic, lx, .025, s * 1.5); }
  }
  const n = Math.floor(L / .42), rl = new THREE.InstancedMesh(CYZ(.085, 2.78, 14), M.chrome, n);
  for (let k = 0; k < n; k++) rl.setMatrixAt(k, M4.makeTranslation(x0 + .2 + k * .42, ROLL_Y - .085, 0));
  rl.receiveShadow = true; scene.add(rl);
  const z0 = FEED_Z - 1.7, z1 = -1.6, zl = z1 - z0, zc = (z0 + z1) / 2;
  for (const s of [-1, 1]) { prof(scene, 'z', zl, PACK_X + s * 2.95, ROLL_Y - .14, zc, .2); for (const lz of [z0 + .2, z1 - .2]) { prof(scene, 'y', ROLL_Y - .29, PACK_X + s * 2.95, (ROLL_Y - .29) / 2 + .05, lz, .16); add(scene, CY(.1, .12, .05, 14), MK.plastic, PACK_X + s * 2.95, .025, lz); } }
  const nz = Math.floor(zl / .42), rz = new THREE.InstancedMesh(CYX(.085, 5.68, 14), M.chrome, nz);
  for (let k = 0; k < nz; k++) rz.setMatrixAt(k, M4.makeTranslation(PACK_X, ROLL_Y - .085, z0 + .2 + k * .42));
  rz.receiveShadow = true; scene.add(rz);
  // flat retail blanks waiting on a wood pallet
  add(scene, BX(5.6, .18, 2.9), M.wood, PACK_X, .09, FEED_Z - 3.6);
  const stackTex = patTex(64, 64, (x, w, h) => { for (let i = 0; i < h; i += 4) { x.fillStyle = (i / 4) % 3 === 0 ? '#1D2126' : (i / 4) % 3 === 1 ? '#F4F2EC' : '#E9B100'; x.fillRect(0, i, w, 4); } }, 1, 3);
  add(scene, faces(BX(5.3, 1.1, 2.75), [0, 0, 1, 0, 0, 0]), [new THREE.MeshStandardMaterial({ map: stackTex, roughness: .8 }), new THREE.MeshStandardMaterial({ color: '#F4F2EC', roughness: .7 })], PACK_X, .18 + .55, FEED_Z - 3.6);
  add(scene, BX(.4, .05, 2.9), MK.plate, TRUCK_X - .2, ROLL_Y - .025, 0);
  packCab = cabinet(7, PACK_X + 4.9, -3.3, '08', 'Pack');
}

// outbound box truck: liveried body with rear barn doors that open for each box, yellow cab with glass, grille, lamps and mirrors
function buildTruck() {
  const X0 = TRUCK_X, L = 10.0, X1 = X0 + L, Wt = 3.3, F = ROLL_Y, Y1 = 5.0, hw = Wt / 2, WY = (1.1 + Y1 - .1) / 2, WH = Y1 - 1.2;
  const white = new THREE.MeshStandardMaterial({ color: '#F1F2F2', roughness: .45 });
  const lining = new THREE.MeshStandardMaterial({ color: '#3A4047', roughness: .8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1A222B', roughness: .08, metalness: .2, clearcoat: 1 });
  const amber = new THREE.MeshStandardMaterial({ color: '#F2A71B', emissive: '#F2A71B', emissiveIntensity: .35, roughness: .3 });
  // livery: HAS Wheels mark and three toy-car silhouettes over the yellow band
  const lc = document.createElement('canvas'); lc.width = 2048; lc.height = 800;
  const x = lc.getContext('2d'), cw = lc.width, ch = lc.height;
  x.fillStyle = '#F1F2F2'; x.fillRect(0, 0, cw, ch);
  x.fillStyle = '#E9B100'; x.fillRect(0, ch - 120, cw, 70); x.fillStyle = '#1D2126'; x.fillRect(0, ch - 50, cw, 50);
  brandMark(x, 420, 260, 190, '#1D2126');
  [['coupe', '#D7322B', 1180], ['van', '#1E7F86', 1540], ['racer', '#E8B53A', 1850]].forEach(([k, col, ox]) => {
    const G = bodyGeo(k), sc = 70, base = ch - 150, def = BODIES[k];
    x.fillStyle = col; x.beginPath(); G.poly.forEach((p, i) => { const X = ox + p.x * sc, Y = base - p.y * sc; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); x.fill();
    for (const wx of def.wheels) { x.fillStyle = '#1D2126'; x.beginPath(); x.arc(ox + wx * sc, base - WCY * sc, WR * sc, 0, 7); x.fill(); x.fillStyle = '#E1BF8F'; x.beginPath(); x.arc(ox + wx * sc, base - WCY * sc, WR * sc * .55, 0, 7); x.fill(); }
  });
  const sideMat = new THREE.MeshStandardMaterial({ map: canvasTex(lc), roughness: .45 });
  // box body: plate floor, rub rails, liveried walls with a dark lining, rear frame
  add(scene, BX(L - .14, .06, Wt - .2), MK.plate, X0 + .14 + (L - .14) / 2, F - .03, 0);
  add(scene, BX(.14, .06, Wt - .2), M.chrome, X0 + .07, F - .03, 0);
  for (const s of [-1, 1]) {
    add(scene, faces(BX(L - .14, WH, .06), [0, 0, 0, 0, 1, 2]), [white, s > 0 ? sideMat : lining, s > 0 ? lining : sideMat], X0 + .14 + (L - .14) / 2, WY, s * (hw - .07));
    add(scene, BX(L, .2, .08), MK.alu, X0 + L / 2, F, s * (hw - .06));
    add(scene, BX(L, .15, .08), MK.alu, X0 + L / 2, Y1 - .025, s * (hw - .06));
    add(scene, BX(.14, WH, .1), MK.aluDark, X0 + .07, WY, s * (hw - .07));
  }
  add(scene, BX(L, .06, Wt - .2), white, X0 + L / 2, Y1 + .08, 0);
  add(scene, BX(.06, Y1 + .05 - F, Wt - .2), white, X1 - .03, (F + Y1 + .05) / 2, 0);
  add(scene, BX(.14, .15, Wt - .32), MK.aluDark, X0 + .07, Y1 - .175, 0);
  const doorTex = patTex(256, 512, (g, w, h) => { g.fillStyle = '#ECEEEF'; g.fillRect(0, 0, w, h); g.fillStyle = '#9AA1A8'; for (const y of [.12, .5, .88]) g.fillRect(0, y * h - 6, w * .55, 12); g.fillStyle = '#C5CBD1'; for (const xx of [.3, .7]) g.fillRect(xx * w - 4, 0, 8, h); g.fillStyle = '#E9B100'; g.fillRect(0, h - 26, w, 14); });
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: .5 });
  // each door hangs on three hinges at the rear corner and swings 270 degrees: shut across the opening, round past the
  // straight-back position, to lie flat against the side, the way a real box truck is opened at a dock
  const latch = new THREE.MeshStandardMaterial({ color: '#AEB5BC', roughness: .3, metalness: .8 });
  for (const s of [-1, 1]) {
    // the hinge line stands off the corner so an open door clears the rub rails, its lock bars facing the body
    const pv = new THREE.Group(); pv.position.set(X0 - .16, WY - .075, s * (hw + .16)); pv.userData.s = s; scene.add(pv);
    const lz = -.03 * s, H = WH - .15;
    add(pv, BX(1.62, H, .05), doorMat, .99, 0, lz);
    // lock bars with their keepers and a handle on the outer face, a rubber seal on the meeting edge
    for (const bx of [.55, 1.35]) {
      add(pv, CY(.022, .022, H - .3, 10), latch, bx, 0, lz - .045 * s);
      for (const by of [-(H - .3) / 2, (H - .3) / 2]) add(pv, BX(.1, .06, .05), latch, bx, by, lz - .045 * s);
    }
    add(pv, BX(.24, .05, .05), latch, 1.35 - .12, -.35, lz - .085 * s);
    add(pv, BX(.04, H - .05, .07), M.rubber, 1.78, 0, lz);
    for (const hy of [-1.4, 0, 1.4]) {
      add(pv, CY(.04, .04, .22, 12), latch, 0, hy, 0);
      add(pv, BX(.2, .12, .03), latch, .1, hy, lz);
      add(scene, BX(.15, .16, .14), MK.aluDark, X0 - .055, WY - .075 + hy, s * (hw + .03));
    }
    truckDoors.pivots.push(pv);
  }
  poseDoors();
  // chassis, rear guard, lamps, mudflaps, tank, wheels on axles
  for (const s of [-1, 1]) add(scene, BX(X1 + 3.2 - X0 - .15, .24, .12), steelDark, (X0 + .15 + X1 + 3.2) / 2, .66, s * .55);
  add(scene, BX(.12, .16, Wt - .3), steelDark, X0 + .08, .86, 0);
  add(scene, BX(.12, .12, 2.6), MK.aluDark, X0 + .06, .36, 0);
  for (const s of [-1, 1]) {
    add(scene, BX(.1, .12, .12), MK.aluDark, X0 + .17, .48, s * .55);
    add(scene, RB(.04, .14, .36, .015), M.tail, X0 + .0, .86, s * 1.2);
    add(scene, BX(.03, .52, .46), M.rubber, X0 + 1.86, .62, s * 1.2);
    add(scene, BX(.06, .06, .2), MK.aluDark, X0 + 1.86, .91, s * 1.2);
  }
  const markers = new THREE.InstancedMesh(BX(.12, .06, .02), amber, 8);
  [0, 1, 2, 3].forEach(i => { for (const s of [0, 1]) markers.setMatrixAt(i * 2 + s, M4.makeTranslation(X0 + 1.2 + i * 2.6, F, (s ? 1 : -1) * (hw - .01))); });
  scene.add(markers);
  add(scene, CYX(.32, 1.4, 24), MK.alu, X1 - 1.6, .55, .97);
  for (const s of [-1, 1]) add(scene, BX(.08, .3, .04), MK.aluDark, X1 - 1.6 + s * .5, .62, .63);
  const tire = new THREE.LatheGeometry([[.3, -.16], [.42, -.16], [.455, -.12], [.46, 0], [.455, .12], [.42, .16], [.3, .16]].map(([r, h]) => new THREE.Vector2(r, h)), 32); tire.rotateX(Math.PI / 2);
  const rim = CYZ(.295, .28, 24), hub = CYZ(.12, .04, 16), axle = CYZ(.07, 2.16, 12);
  const cabX = X1 + .2, axF = cabX + 1.95;
  const axles = [X0 + 2.6, X0 + 3.62, axF], at = axles.flatMap(ax => [[ax, -1], [ax, 1]]);
  const inst = (geo, mat, list, f) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((p, i) => im.setMatrixAt(i, M4.makeTranslation(...f(p)))); im.castShadow = im.receiveShadow = true; scene.add(im); };
  inst(axle, steelDark, axles, ax => [ax, .46, 0]);
  inst(tire, M.rubber, at, ([ax, s]) => [ax, .46, s * 1.22]); inst(rim, MK.alu, at, ([ax, s]) => [ax, .46, s * 1.22]); inst(hub, MK.aluDark, at, ([ax, s]) => [ax, .46, s * 1.38]);
  // cab: an extruded side profile with a wheel arch, rounded by its bevel
  const s0 = new THREE.Shape(), da = Math.sqrt(.62 * .62 - .16);
  roundedContour(s0, [[0, .86, 0], [0, 3.75, .25], [2.15, 3.75, .35], [2.55, 2.55, .18], [3.2, 2.22, .3], [3.2, .86, 0]]);
  s0.lineTo(axF - cabX + da, .86); s0.absarc(axF - cabX, .46, .62, Math.asin(.4 / .62), Math.PI - Math.asin(.4 / .62), false); s0.lineTo(0, .86);
  const cg = new THREE.ExtrudeGeometry(s0, { depth: 2.84, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 4, curveSegments: 16 });
  cg.translate(0, 0, -1.42);
  add(scene, cg, yellow, cabX, 0, 0);
  const win = new THREE.Shape(); roundedContour(win, [[.28, 2.5, 0], [.28, 3.5, .12], [2.02, 3.5, .14], [2.36, 2.5, 0]]); win.closePath();
  const wg = new THREE.ShapeGeometry(win, 8);
  for (const s of [-1, 1]) add(scene, wg, glass, cabX, 0, s * 1.502, false).scale.z = s;
  const ws = add(scene, new THREE.PlaneGeometry(2.6, .95), glass, cabX + 2.35 + .949 * .085, 3.15 + .316 * .085, 0, false); ws.rotation.set(0, Math.PI / 2, .3217, 'ZYX');
  const gc = document.createElement('canvas'); gc.width = 256; gc.height = 96;
  { const g = gc.getContext('2d'); g.fillStyle = '#1D2126'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#8F969D'; for (let i = 8; i < 90; i += 12) g.fillRect(8, i, 240, 4); g.fillStyle = '#E9B100'; rrect(g, 98, 34, 60, 28, 6); g.fill(); g.fillStyle = '#15181B'; g.font = '600 18px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HAS', 128, 49); }
  add(scene, new THREE.PlaneGeometry(1.9, .7), new THREE.MeshStandardMaterial({ map: canvasTex(gc), roughness: .4, metalness: .3 }), cabX + 3.282, 1.5, 0, false).rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    add(scene, CYX(.2, .04, 24), M.chrome, cabX + 3.28, 1.45, s * 1.18);
    add(scene, CYX(.16, .03, 24), M.lens, cabX + 3.315, 1.45, s * 1.18, false);
    add(scene, RB(.04, .1, .22, .015), amber, cabX + 3.3, 1.12, s * 1.18, false);
    add(scene, BX(.05, .05, .36), MK.plastic, cabX + 2.2, 2.4, s * 1.68);
    add(scene, RB(.1, .52, .24, .04), MK.plastic, cabX + 2.2, 2.6, s * 1.98);
    add(scene, BX(.2, .05, .03), M.chrome, cabX + .5, 2.25, s * 1.516, false);
  }
  add(scene, RB(.4, .28, 3.0, .06), M.graphite, cabX + 3.2, .64, 0);
  const tops = new THREE.InstancedMesh(RB(.08, .06, .16, .02), amber, 3);
  [-.5, 0, .5].forEach((z, i) => tops.setMatrixAt(i, M4.makeTranslation(cabX + 1.9, 3.86, z))); scene.add(tops);
}

/* ---------- the line ---------- */
const lot = new Array(N_STALLS).fill(null);
let lotSeq = 0;
const leaving = [];
function reserveSlot() {
  let i = lot.findIndex(s => s === null);
  if (i < 0) {
    let o = -1;
    lot.forEach((s, k) => { if (s && s.car && !s.ship && (o < 0 || s.seq < lot[o].seq)) o = k; });
    if (o < 0) o = Math.max(0, lot.findIndex(s => s && !s.ship));
    if (lot[o] && lot[o].car) leaving.push({ car: lot[o].car, t: 0 });
    i = o;
  }
  lot[i] = { car: null, seq: ++lotSeq, ship: false };
  return i;
}
// m/p/done/occ: this work phase's minutes, progress, finished flags and occupancy per station; bott: its bottleneck(s)
const line = { phase: 'idle', t: 0, units: [], m: Array(7).fill(0), p: Array(7).fill(1), done: Array(7).fill(true), occ: Array(7).fill(false), mMax: 0, W: 0, cycle: 0, bott: [] };
const queue = [], exiting = [], pallets = [];
let built = 0, speed = 1;
const palletMat = new THREE.MeshStandardMaterial({ color: '#3C4652', roughness: .6, metalness: .2 });
const PALLET_GEO = new RoundedBoxGeometry(5, PALLET_H - .01, 2.5, 2, .03), JIG_GEO = new RoundedBoxGeometry(1.6, YB - BV + .01, 1.1, 2, .025), TAG_GEO = new RoundedBoxGeometry(.02, .05, .36, 1, .008);
// one shared-geometry pallet: steel plate (a hair under pallet height so tyres sit on it), birch locating jig, RFID tag
function makePallet() {
  const pallet = new THREE.Group();
  const plate = new THREE.Mesh(PALLET_GEO, palletMat); plate.position.y = -PALLET_H / 2 - .005; plate.receiveShadow = true; plate.castShadow = true;
  const jig = new THREE.Mesh(JIG_GEO, M.woodDark); jig.position.y = (YB - BV) / 2 - .005; jig.castShadow = true;
  const tag = new THREE.Mesh(TAG_GEO, MK.plastic); tag.position.set(-2.51, -PALLET_H / 2 - .005, 0);
  pallet.add(plate, jig, tag);
  return pallet;
}
// a queued order record (the contract car object) becomes a 3D car on a pallet; its standard cost is cached as it enters
function makeUnit(rec) {
  const car = buildCar(rec.cfg, true, rec);
  car.place = 'line';
  car.cost = econ.carCost(car.cfg, R, UP);
  const root = car.root;
  root.position.set(ENTRY_X, BELT_Y + PALLET_H, 0);
  const pallet = makePallet(); root.add(pallet);
  for (const k of ['block', 'raw', 'paint', 'livery', 'wheels', 'details']) car.layers[k].visible = false;
  car.status = 'Waiting at the line entry';
  scene.add(root);
  return { car, root, pallet, slot: 0, fromX: ENTRY_X, toX: SX[0] };
}
const unitsOut = () => line.units.map(u => ({ wo: u.car.wo, slot: u.slot }));
function startMove() {
  line.phase = 'move'; line.t = 0;
  for (const u of line.units) { u.fromX = u.root.position.x; u.slot++; u.toX = u.slot < 7 ? SX[u.slot] : EXIT_X; }
  let entered = null;
  if (queue.length) {
    const u = entered = makeUnit(queue.shift());
    line.units.push(u); ACT.started++;
    if (mode === 'follow' && followWanted === u.car.wo) {
      tracked = u.car; const off = offsetFor('follow');
      flyTo(() => focusOf(tracked).add(off), () => focusOf(tracked), 1);
    }
  }
  if (entered) emitE('enter', { wo: entered.car.wo, car: entered.car });
  emitE('cycle', { phase: 'move', mMax: 0, cycle: R.moveMin, units: unitsOut() });
  updateHud(); dirty.strip = dirty.order = true;
}
// park path: roll off the pallet, over the lip and down the ramp, along the aisle, quarter turn, nose into the stall
function makeParkPath(slot, x0, def) {
  const st = stall(slot), R = AISLE_R, segs = [];
  segs.push({ k: 'ramp', x0, x1: st.x - R, wr: def.wheels[0], wf: def.wheels[1], len: st.x - R - x0 });
  segs.push({ k: 'arc', cx: st.x - R, cz: st.side * R, R, side: st.side, len: Math.PI / 2 * R });
  segs.push({ k: 'line', ax: st.x, az: st.side * R, bx: st.x, bz: st.side * STALL_Z, len: STALL_Z - R });
  return segs;
}
function evalSeg(s, t) {
  if (s.k === 'ramp') {
    // both axles ride the deck: wheel centres sit one tyre radius off the surface, the body pitches between them
    const x = lerp(s.x0, s.x1, t), wb = s.wf - s.wr, hub = cx => rampY(cx) + .447 * Math.hypot(1, (rampY(cx + .01) - rampY(cx - .01)) / .02);
    let th = 0, yr = 0;
    for (let i = 0; i < 3; i++) {
      const c = Math.cos(th), sn = Math.sin(th);
      yr = hub(x + s.wr * c - WCY * sn);
      th = Math.asin(clamp((hub(x + s.wf * c - WCY * sn) - yr) / wb, -.5, .5));
    }
    return { x, y: yr - s.wr * Math.sin(th) - WCY * Math.cos(th), z: 0, yaw: 0, pitch: th };
  }
  if (s.k === 'line') return { x: lerp(s.ax, s.bx, t), y: 0, z: lerp(s.az, s.bz, t), yaw: Math.atan2(-(s.bz - s.az), s.bx - s.ax), pitch: 0 };
  const th = t * Math.PI / 2;
  return { x: s.cx + s.R * Math.sin(th), y: 0, z: s.cz - s.side * s.R * Math.cos(th), yaw: -s.side * th, pitch: 0 };
}
function evalPath(segs, d) {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (d <= s.len || i === segs.length - 1) return evalSeg(s, s.len ? clamp(d / s.len, 0, 1) : 1);
    d -= s.len;
  }
}
function endMove() {
  for (const u of [...line.units]) {
    if (u.slot >= 7) {
      line.units.splice(line.units.indexOf(u), 1);
      const wp = u.pallet.getWorldPosition(new THREE.Vector3());
      u.pallet.removeFromParent(); u.pallet.position.copy(wp); scene.add(u.pallet); pallets.push({ g: u.pallet, t: 0 });
      disposeCar(u.car, true);
      setFinal(u.car);
      // the line exit: QC & pack and power go on the tab, then the seeded QC gate decides (SPEC §2.6)
      if (!qcGate(u.car)) { scrapCar(u.car); continue; }
      const slot = reserveSlot();
      u.car.place = 'exit';
      u.car.status = `Driving off to lot A${slot + 1}`;
      const segs = makeParkPath(slot, u.root.position.x, u.car.def), L = segs.reduce((a, s) => a + s.len, 0);
      exiting.push({ car: u.car, t: 0, slot, segs, L, d: 0 });
    }
  }
  beginWork();
}
// the work phase: W = WORK_T × mMax / 3 from the cars at the stations now; each station runs on its own p_k (SPEC §2.1)
function beginWork() {
  line.phase = 'work'; line.t = 0;
  const m = Array(7).fill(0);
  for (const u of line.units) if (u.slot < 7) m[u.slot] = u.car.cost.m[u.slot];
  const mMax = Math.max(0, ...m);
  Object.assign(line, { m, mMax, W: WORK_T * mMax / 3, cycle: R.moveMin + mMax, p: m.map(x => x > 0 ? 0 : 1), done: Array(7).fill(false), occ: Array(7).fill(false), cars: Array(7).fill(null) });
  line.bott = mMax > 0 ? m.map((x, i) => Math.abs(x - mMax) < 1e-9 ? i : -1).filter(i => i >= 0) : [];
  for (const u of line.units) { line.occ[u.slot] = true; line.cars[u.slot] = u.car; u.car.status = `At station 0${u.slot + 1} · ${STATIONS[u.slot]}`; startWork(u, u.slot); }
  for (let i = 0; i < 7; i++) if (!line.occ[i]) line.done[i] = true; // an empty station waits the whole cycle from the start
  emitE('cycle', { phase: 'work', mMax, cycle: line.cycle, units: unitsOut() });
  // a station with nothing to do for this car (plain livery) is done from the start
  for (const u of line.units) if (!(m[u.slot] > 0)) stationFinish(u, u.slot);
  updateHud(); dirty.strip = dirty.hmi = dirty.ring = true;
}
function stationFinish(u, k) {
  if (line.done[k]) return;
  line.done[k] = true; line.p[k] = 1;
  finishWork(u, k);
  postStation(u.car, k, false);
  const c = u.car.cost;
  emitE('stationDone', { wo: u.car.wo, car: u.car, station: k, post: c.stationPost[k], parts: c.parts[k], crew: c.crewByStation[k], consumables: c.consByStation[k], minutes: c.m[k], tab: u.car.tab.total });
  dirty.strip = true;
}
function endWork() {
  for (const u of line.units) if (u.slot < 7) stationFinish(u, u.slot);
  if (!line.units.length && !queue.length) { goIdle(); return; }
  startMove();
}
function goIdle() {
  const was = line.phase;
  line.phase = 'idle'; line.t = 0;
  updateHud(); dirty.strip = dirty.hmi = dirty.ring = dirty.order = true;
  if (was !== 'idle') emitE('lineIdle', {});
}
function startWork(u, k) {
  const L = u.car.layers;
  if (k === 0) { L.block.visible = false; L.block.position.set(0, 0, 0); }
  if (k === 1) L.raw.visible = true;
  if (k === 3) L.paint.visible = true;
  if (k === 4) L.livery.visible = true;
  if (k === 5) L.wheels.visible = true;
  if (k === 6) L.details.visible = true;
  work(u, k, 0); // clip planes and poses are set before the layer is first drawn, so no coat flashes on ahead of its tool
}
function work(u, k, p) {
  const car = u.car, L = car.layers, G = car.G, P = car.planes, rx = u.root.position.x, ry = u.root.position.y;
  if (k === 0) {
    const h = blankHead(p, u);
    L.block.visible = p >= .17;
    if (p >= .17 && p < .74) L.block.position.set(0, h.y - (ry + .2 + G.blockH), h.z - u.root.position.z);
    else if (p >= .74) L.block.position.set(0, 0, 0);
  } else if (k === 1) {
    const s = rx + lerp(G.xmax + BV + .3, G.xmin - BV - .3, ease(seg(p, .1, .9)));
    clip(P.block, -1, 0, s); clip(P.raw, 1, 0, -s);
    L.cap.position.x = s - rx; L.cap.visible = s - rx > G.B.xmin - .08 && s - rx < G.B.xmax + .08; // only while the wire is in the wood
  } else if (k === 2) {
    const q = seg(p, .1, .9);
    car.rawMats.forEach(m => { m.roughness = lerp(.9, .7, q); m.color.set('#E9D3AE').lerp(new THREE.Color('#FFFFFF'), q); });
  } else if (k === 3) {
    const s = ry + lerp(G.ymax + BV + .15, -.05, ease(seg(p, .06, .92)));
    clip(P.paint, 0, 1, -s); clip(P.raw, 0, -1, s);
  } else if (k === 4) {
    const s = rx + lerp(G.xmin - BV - .25, G.xmax + BV + .25, ease(seg(p, .08, .92)));
    clip(P.livery, -1, 0, s); clip(P.paint, 1, 0, -s);
  } else if (k === 5) {
    const q = easeOut(seg(p, 0, .55));
    for (const w of car.parts.wheels) w.g.position.z = w.z + w.s * (1 - q) * 1.4;
    const spin = seg(p, .6, 1) * 14;
    for (const w of car.parts.wheels) w.g.rotation.z = -w.s * spin;
    // the axle dowels push through first, then the wheels press onto them; once the press heads back off, a peg caps each hub
    for (const a of car.parts.axles) a.scale.z = Math.max(.001, easeOut(seg(p, 0, .16)));
    for (const w of car.parts.wheels) { w.peg.scale.setScalar(Math.max(.001, easeBack(seg(p, .72, .84)))); w.peg.position.z = w.z + w.s * .22 * (1 - easeOut(seg(p, .8, .94))); }
  } else if (k === 6) {
    car.parts.lights.forEach((o, i) => o.scale.setScalar(Math.max(.001, easeBack(seg(p, .04 + i * .04, .2 + i * .04)))));
    // grille, plate and exhaust pop in place; the side trim grows out of the flanks
    car.parts.trim.forEach((o, i) => { const s = Math.max(.001, easeBack(seg(p, .14 + i * .07, .3 + i * .07))), a = o.userData.pop; if (a) o.scale[a] = s; else o.scale.setScalar(s); });
    // bumpers appear as the grippers arrive, 1.1 out so the rear one stays clear of the next car's nose, then slide home
    for (const b of car.parts.bumpers) { b.scale.setScalar(Math.max(.001, easeOut(seg(p, .23, .29)))); b.position.x = b.userData.x0 + b.userData.side * 1.1 * (1 - easeOut(seg(p, .3, .48))); }
    const r = car.parts.roof;
    if (r) {
      r.visible = p > .32;
      const off = p < .54 ? lerp(2.2, 1.0, ease(seg(p, .4, .54))) : lerp(1.0, 0, ease(seg(p, .54, .74)));
      r.position.y = r.userData.y0 + off;
    }
  }
}
function finishWork(u, k) {
  const L = u.car.layers, P = u.car.planes;
  work(u, k, 1);
  if (k === 0) { L.block.visible = true; L.block.position.set(0, 0, 0); }
  if (k === 1) { L.block.visible = false; L.cap.visible = false; unclip(P.raw); unclip(P.block); }
  if (k === 3) { L.raw.visible = false; unclip(P.paint); unclip(P.raw); }
  if (k === 4) { L.paint.visible = false; unclip(P.livery); unclip(P.paint); }
  if (k === 5) for (const w of u.car.parts.wheels) w.g.position.z = w.z;
}
// the line clock and the line's pay run on model minutes only (SPEC §2.1): 0.5 per move, mMax per work phase
function accrue(dMin) {
  if (!(dMin > 0)) return;
  lclock.lineMin += dMin; lclock.minOfDay += dMin;
  while (lclock.minOfDay >= R.shiftMin - 1e-7) { lclock.minOfDay = Math.max(0, lclock.minOfDay - R.shiftMin); lclock.day++; }
  ACT.lineMinRun += dMin; ACT.linePaid += dMin * lineRate();
}
function stepLine(dt) {
  if (stopped) return;
  if (line.phase === 'idle') { if (queue.length) startMove(); else return; }
  const t0 = line.t;
  line.t += dt;
  if (line.phase === 'move') {
    const k = ease(Math.min(1, line.t / MOVE_T));
    for (const u of line.units) {
      u.root.position.x = lerp(u.fromX, u.toX, k); // the car rides its pallet: wheels only turn once it drives off on its own
    }
    if (line.units.length) beltTex.offset.x -= (6.5 * (ease(Math.min(1, line.t / MOVE_T)) - ease(Math.min(1, (line.t - dt) / MOVE_T)))) / 1.2;
    accrue(R.moveMin * (Math.min(line.t, MOVE_T) - Math.min(t0, MOVE_T)) / MOVE_T);
    if (line.t >= MOVE_T) endMove();
  } else if (line.phase === 'work') {
    const W = line.W;
    if (W > 0) accrue(line.mMax * (Math.min(line.t, W) - Math.min(t0, W)) / W);
    for (const u of line.units) {
      const k = u.slot; if (k > 6 || line.done[k]) continue;
      const pk = line.m[k] > 0 && W > 0 ? clamp(line.t / (W * line.m[k] / line.mMax), 0, 1) : 1;
      line.p[k] = pk;
      work(u, k, pk);
      if (pk >= 1) stationFinish(u, k);
    }
    if (line.t >= W) endWork();
  }
}
function updateTools(dt) {
  const working = line.phase === 'work' && !stopped;
  for (let i = 0; i < 7; i++) {
    const u = working ? line.units.find(v => v.slot === i) : null;
    const done = !!u && line.done[i];
    const st = ST[i];
    // each tool runs on its own p_k, then parks; the wheel press holds its finished pose so the magazines stay kitted right
    if (u && !done) st.tool.update(dt, u, line.p[i]);
    else if (u && i === 5) st.tool.update(dt, u, 1);
    else st.tool.update(dt, null, 0);
    const present = line.units.some(v => v.slot === i);
    st.cab.light.set(stopped || line.phase === 'idle' ? 'off' : speed === 0 ? (present ? 'stop' : 'off') : u && !done ? 'run' : 'wait');
    st.cab.bar.scale.x = stopped ? .001 : u ? Math.max(.001, .504 * line.p[i]) : line.phase === 'move' && line.occ && line.occ[i] ? .504 : .001;
    st.eye.material = present ? eyeOn : eyeOff;
  }
  if (packCab) {
    packCab.light.set(crane.task || cartons.some(c => c.state !== 'loaded') ? (speed === 0 ? 'stop' : 'run') : 'wait');
    packCab.bar.scale.x = crane.task ? Math.max(.001, .504 * (crane.task.i + crane.task.t) / crane.task.phases.length) : .001;
  }
}
// drive-off: a soft smoothstep launch to cruise, then braking into the stall
const DRIVE_V = 7.5, DRIVE_T = 1.0, DRIVE_B = 4.5;
function updateExits(dt) {
  for (const e of [...exiting]) {
    e.t += dt;
    const s = Math.min(1, e.t / DRIVE_T);
    let v = Math.min(DRIVE_V * s * s * (3 - 2 * s), Math.sqrt(2 * DRIVE_B * Math.max(0, e.L - e.d)));
    if (e.d > e.L / 2) v = Math.max(v, .35);
    const d = Math.min(e.L, e.d + v * dt), dd = d - e.d; e.d = d;
    const P = evalPath(e.segs, d), r = e.car.root;
    r.position.set(P.x, P.y, P.z); r.rotation.set(0, P.yaw, P.pitch);
    for (const w of e.car.parts.wheels) w.g.rotation.z -= w.s * dd / WR;
    if (d >= e.L) {
      exiting.splice(exiting.indexOf(e), 1);
      const st = stallPose(e.slot); r.position.set(st.x, 0, st.z); r.rotation.set(0, st.yaw, 0);
      computeDims(e.car);
      if (lot[e.slot]) lot[e.slot].car = e.car;
      e.car.status = `Parked in lot A${e.slot + 1}`;
      e.car.place = 'lot'; ACT.parked++;
      built++; updateHud();
      emitE('parked', { wo: e.car.wo, car: e.car, stall: e.slot });
    }
  }
  updateScrap(dt);
  updateJib(dt);
  for (const l of [...leaving]) {
    l.t += dt / .6;
    l.car.root.scale.setScalar(Math.max(.001, 1 - easeOut(Math.min(1, l.t))));
    if (l.t >= 1) { if (tracked === l.car) tracked = null; disposeCar(l.car); leaving.splice(leaving.indexOf(l), 1); }
  }
  updateCrane(dt);
  updateCartons(dt);
}

/* ---------- order form ---------- */
const cfg = { body: 'coupe', color: '#D7322B', accent: '#F4F3EF', livery: 'stripe', number: '7', wheels: 'classic', bumper: 'chrome', roof: 'none', finish: 'gloss' };
function randomCfg() {
  const body = pick(BODY_KEYS);
  const color = pick(PALETTE)[1];
  let accent = pick(PALETTE)[1];
  for (let i = 0; i < 12 && Math.abs(lum(accent) - lum(color)) < .25; i++) accent = pick(PALETTE)[1];
  const roofs = ROOFS.map(r => r[0]).filter(r => roofOk(body, r));
  return {
    body, color, accent, livery: pick(LIVERIES)[0], number: Math.random() < .7 ? String(1 + Math.floor(Math.random() * 99)) : '',
    wheels: pick(WHEELS)[0], bumper: pick(BUMPERS)[0], roof: Math.random() < .45 ? 'none' : pick(roofs),
    finish: Math.random() < .5 ? 'gloss' : Math.random() < .6 ? 'satin' : 'raw'
  };
}
const nextWo = () => 'WO-' + String(woCounter + 1).padStart(4, '0');
function stamp(c) { woCounter++; return { ...c, wo: 'WO-' + String(woCounter).padStart(4, '0') }; }
// an order from any caller (lesson, challenge, form): known keys only, valid options, number as a string of 0-2 digits
const CFG_KEYS = ['body', 'color', 'accent', 'livery', 'number', 'wheels', 'bumper', 'roof', 'finish'];
function normCfg(c = {}) {
  const C = econ.CATALOG, o = {};
  for (const k of CFG_KEYS) o[k] = c[k] !== undefined && c[k] !== null ? c[k] : cfg[k];
  o.number = String(o.number).replace(/\D/g, '').slice(0, 2);
  if (!BODIES[o.body]) o.body = cfg.body;
  for (const k of ['livery', 'wheels', 'bumper', 'roof', 'finish']) if (!C[k][o[k]]) o[k] = C[k][cfg[k]] ? cfg[k] : Object.keys(C[k])[0];
  if (!roofOk(o.body, o.roof)) o.roof = 'none';
  return o;
}
// the ledger record of one order: the contract car object (docs/CONTRACTS.md); buildCar fills in the 3D parts later
function order(c, place = 'queue') {
  const s = stamp(normCfg(c));
  return { wo: s.wo, cfg: s, def: BODIES[s.body], status: 'Queued for the line', place, cost: econ.carCost(s, R, UP), tab: { total: 0, lines: [] }, broughtForward: 0, scrapped: false };
}
function describe(c) {
  const bits = [c.finish === 'raw' ? 'Oiled wood' : colorName(c.color)];
  if (c.livery !== 'plain') bits.push(nameOf(LIVERIES, c.livery).toLowerCase() + ' in ' + colorName(c.accent).toLowerCase());
  if (c.number) bits.push('No. ' + c.number);
  bits.push(nameOf(WHEELS, c.wheels).toLowerCase() + ' wheels');
  if (roofOk(c.body, c.roof) && c.roof !== 'none') bits.push(nameOf(ROOFS, c.roof).toLowerCase());
  return bits.join(' · ');
}
function thumb(key) {
  const c = document.createElement('canvas'); c.width = 140; c.height = 64;
  const x = c.getContext('2d'), G = bodyGeo(key), def = BODIES[key];
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#15181B';
  const sc = 128 / (G.B.xmax - G.B.xmin), ox = 6 - G.B.xmin * sc, base = 58;
  x.fillStyle = ink; x.beginPath();
  G.poly.forEach((p, i) => { const X = ox + p.x * sc, Y = base - p.y * sc; i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
  x.fill();
  x.globalCompositeOperation = 'destination-out';
  for (const w of def.windows) { x.beginPath(); w.forEach(([a, b], i) => i ? x.lineTo(ox + a * sc, base - b * sc) : x.moveTo(ox + a * sc, base - b * sc)); x.fill(); }
  x.globalCompositeOperation = 'source-over';
  for (const wx of def.wheels) { x.beginPath(); x.arc(ox + wx * sc, base - WCY * sc, WR * sc, 0, Math.PI * 2); x.fill(); }
  return c;
}
// a form pick: the order changes, the preview rebuilds, everyone hears optionChanged
function pickOpt(key, k) {
  cfg[key] = k;
  if (key === 'body' && !roofOk(k, cfg.roof)) cfg.roof = 'none';
  sync();
  emitE('optionChanged', { cfg: { ...cfg }, key });
}
function opts(id, list, key) {
  const el = $(id); el.innerHTML = '';
  for (const [k, label] of list) {
    const b = document.createElement('button'); b.className = 'opt'; b.type = 'button';
    b.dataset.key = key; b.dataset.k = k;
    const l = document.createElement('span'); l.className = 'ol'; l.textContent = label;
    const m = document.createElement('span'); m.className = 'om';
    b.append(l, m);
    b.onclick = () => pickOpt(key, k);
    el.appendChild(b);
  }
}
function swatches(id, key) {
  const el = $(id); el.innerHTML = '';
  for (const [name, hex] of PALETTE) {
    const b = document.createElement('button'); b.className = 'sw'; b.type = 'button'; b.style.background = hex; b.dataset.k = hex;
    b.setAttribute('aria-label', name); b.title = name;
    b.onclick = () => pickOpt(key, hex);
    el.appendChild(b);
  }
}
function drawThumbs() {
  const el = $('#fModel'); el.innerHTML = '';
  for (const k of BODY_KEYS) {
    const b = document.createElement('button'); b.className = 'model'; b.type = 'button'; b.dataset.k = k; b.dataset.key = 'body';
    b.append(thumb(k)); const s = document.createElement('span'); s.textContent = BODIES[k].name; b.append(s);
    const m = document.createElement('span'); m.className = 'om'; b.append(m);
    b.onclick = () => pickOpt('body', k);
    el.appendChild(b);
  }
}
function buildForm() {
  drawThumbs();
  swatches('#fColor', 'color'); swatches('#fAccent', 'accent');
  opts('#fLivery', LIVERIES, 'livery'); opts('#fWheels', WHEELS, 'wheels'); opts('#fBumper', BUMPERS, 'bumper');
  opts('#fRoof', ROOFS, 'roof'); opts('#fFinish', FINISHES, 'finish');
  const num = $('#fNumber');
  num.setAttribute('inputmode', 'numeric');
  num.addEventListener('input', () => { num.value = num.value.replace(/\D/g, '').slice(0, 2); pickOpt('number', num.value); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawThumbs(); sync(); });
  new MutationObserver(() => { drawThumbs(); sync(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
/* the Order tab's money: a mono line under each option (layer prices; minutes with layer minutes), deltas against the
   current order (layer deltas) with an accent dot when the option would change the cycle, the sticky price tag (SPEC §4.5) */
const signedMin = x => (econ.roundTo(x, 1) > 0 ? '+' : econ.roundTo(x, 1) < 0 ? '−' : '') + fmt.min(Math.abs(x));
const minutesText = (key, info) => {
  if (key === 'body') return info.minutes.map(([s, v]) => `${STATIONS[s]} ${fmt.min(v)}`).join(' · ');
  const [[, v] = [0, 0], ...extra] = info.minutes;
  return `${fmt.min(v)} min` + extra.map(([s, x]) => ` · ${STATIONS[s]} +${fmt.min(x)}`).join('');
};
function optionLine(key, k) {
  if (!lay('prices') || (key === 'roof' && !roofOk(cfg.body, k))) return { text: '', dot: false, label: '' };
  const info = econ.optionInfo(key, k, cfg, R);
  const abs = fmt.money2(info.price) + (lay('minutes') && info.minutes.length ? ' · ' + minutesText(key, info) : '');
  const cur = key === 'number' ? !!cfg.number === !!k : cfg[key] === k;
  if (!lay('deltas') || cur) return { text: abs, dot: false, label: abs };
  const d = econ.optionDelta(cfg, key, k, R, UP);
  const text = fmt.signed(d.dMaterials) + (lay('minutes') ? ' · ' + signedMin(d.dWork) + ' min' : '');
  return { text, dot: d.changesCycle, label: `${text}${d.changesCycle ? `, changes the cycle to ${fmt.min(d.after.cycle)} min` : ''}` };
}
function setLine(el, o) {
  if (!el) return;
  const sig = o.text + (o.dot ? '•' : '');
  if (el.dataset.sig === sig) return; el.dataset.sig = sig;
  el.textContent = o.text;
  if (o.dot) { const d = document.createElement('i'); d.className = 'acc'; d.title = 'Changes the cycle'; el.prepend(d); }
  el.hidden = !o.text;
}
function refreshOrder() {
  document.querySelectorAll('#paneOrder .opt, #fModel .model').forEach(b => {
    const o = optionLine(b.dataset.key, b.dataset.k), m = b.querySelector('.om');
    setLine(m, o);
    const base = b.querySelector('.ol, span:not(.om)')?.textContent || '';
    if (o.label) b.setAttribute('aria-label', `${base}, ${o.label}`); else b.removeAttribute('aria-label');
  });
  const pr = lay('prices'), F = econ.CATALOG.finish[cfg.finish];
  // the paint is priced once, inside the finish (Finish shows paint + top coat), so this note must not read as a second price to add
  setLine($('#colorNote'), { text: pr ? (F.paint ? `Every colour costs the same. Its ${fmt.money2(F.paint)} of paint is counted under Finish` : 'Oiled wood: no paint, so colour is free') : '' });
  setLine($('#accentNote'), { text: pr ? 'Accent: free, the livery ink price covers it' : '' });
  const nOn = optionLine('number', cfg.number ? '' : '7');
  const nAbs = optionLine('number', '7');
  setLine($('#numNote'), { text: pr ? (lay('deltas') ? `${cfg.number ? 'Without' : 'With'} a number: ${nOn.text}` : `Roundel ${nAbs.text}`) : '', dot: nOn.dot });
  // sticky price tag: generated from econ.carCost, each part behind its layer
  const k = econ.carCost(cfg, R, UP), parts = [];
  if (lay('materials') || pr) parts.push(['Materials', fmt.money2(k.materials)]);
  if (lay('cycle')) parts.push(['Cycle', `${fmt.min(k.cycle)} min (${stationList(k.bottAll)})`]);
  if (lay('meter')) parts.push(['Started', fmt.money2(k.started)]);
  if (lay('scrap')) parts.push(['To the door', fmt.money2(k.variable)]);
  if (unaided) parts.length = 0;
  const tag = $('#priceTag'), html = parts.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  if (tag && tag.dataset.sig !== html) { tag.dataset.sig = html; tag.innerHTML = html; tag.hidden = !parts.length; tag.setAttribute('aria-label', parts.map(p => p.join(' ')).join(', ')); }
  const belt = line.units.filter(u => u.slot < 7).length, bn = $('#beltNote');
  if (bn) bn.textContent = `${fmt.count(belt)} on belt · ${fmt.count(queue.length)} queued`;
  const fb = $('#bFill'); if (fb) fb.hidden = !fillButton;
}
let previewTimer = 0;
function sync() {
  document.querySelectorAll('#fModel .model').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cfg.body));
  document.querySelectorAll('#fColor .sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cfg.color));
  document.querySelectorAll('#fAccent .sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cfg.accent));
  const mark = (id, key) => document.querySelectorAll(id + ' .opt').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cfg[key]));
  mark('#fLivery', 'livery'); mark('#fWheels', 'wheels'); mark('#fBumper', 'bumper'); mark('#fRoof', 'roof'); mark('#fFinish', 'finish');
  document.querySelectorAll('#fRoof .opt').forEach(b => { b.disabled = !roofOk(cfg.body, b.dataset.k); });
  if ($('#fNumber').value !== cfg.number) $('#fNumber').value = cfg.number;
  $('#lModel').textContent = BODIES[cfg.body].name;
  $('#lColor').textContent = colorName(cfg.color);
  $('#lAccent').textContent = colorName(cfg.accent);
  $('#woNext').textContent = nextWo();
  $('#summary').textContent = `${BODIES[cfg.body].name}: ${describe(cfg)}.`;
  refreshOrder(); dirty.hud = dirty.strip = dirty.hmi = dirty.ring = true;
  clearTimeout(previewTimer); previewTimer = setTimeout(rebuildPreview, 60);
}
let preview = null;
function rebuildPreview() {
  if (!sceneReady) return; // boot builds the first preview once the fonts are in
  const rot = preview ? preview.root.rotation.y : -.6;
  const wasTracked = preview && tracked === preview;
  if (preview) disposeCar(preview);
  preview = buildCar({ ...cfg, wo: nextWo() }, false);
  preview.cost = econ.carCost(preview.cfg, R, UP);
  preview.status = 'Order preview, not built yet';
  preview.root.position.set(PREVIEW_X, .3, 0);
  preview.root.rotation.y = rot;
  scene.add(preview.root);
  if (wasTracked) tracked = preview;
  checkFollowed();
}

/* ---------- camera ---------- */
let mode = 'overview', tracked = null, followWanted = null, ovPose = null;
let anim = null;
const lastFocus = new THREE.Vector3();
// three-quarter view down the line (steeper along it on portrait screens), pulled back until the whole works, order preview
// to truck cab and crane tops, fits between the HUD chips and the station strip, then centred
const OV_PTS = [[-36.6, 0, 0], [-33, 0, -3.6], [-33, 0, 4.8], [-29, 4.6, -7], [-29, 0, 8.2], [27.4, 12, -11.4], [27.4, 12, 11.4], [27.4, 0, 11.4], [60.2, 12, -11.4], [60.2, 12, 11.4], [60.2, 0, 11.4], [55, 1.3, -9.9], [78.6, 0, 1.7], [78.6, 5.3, -1.7], [64.8, 5.3, -1.7]].map(p => new THREE.Vector3(...p));
function overviewPose() {
  const narrow = camera.aspect < 1.2, dir = (narrow ? new THREE.Vector3(-.88, .42, .22) : new THREE.Vector3(-.66, .46, .6)).normalize();
  const r = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), up = new THREE.Vector3().crossVectors(dir, r), q = new THREE.Vector3(), tgt = new THREE.Vector3(20, 0, 0);
  // fit the band between the HUD chips and the yamazumi strip (their heights change with the layers and the width)
  const H = Math.max(1, stageEl.clientHeight), hud = $('#hud'), st = $('#strip');
  const ft = hud && hud.offsetParent ? clamp((hud.offsetTop + hud.offsetHeight + 6) / H, 0, .4) : .06;
  const fb = st && st.offsetParent ? clamp((H - st.offsetTop + 6) / H, 0, .45) : .06;
  const T = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), ty = T * Math.max(.3, 1 - ft - fb) * .96, tx = T * .95 * camera.aspect, yc = (fb - ft) * T;
  const fit = () => OV_PTS.reduce((d, p) => { q.subVectors(p, tgt); const z = q.dot(dir); return Math.max(d, z + Math.abs(q.dot(r)) / tx, z + Math.abs(q.dot(up)) / ty); }, 0);
  for (let it = 0; it < 3; it++) {
    const d = fit(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of OV_PTS) { q.subVectors(p, tgt); const k = d - q.dot(dir), x = q.dot(r) / k, y = q.dot(up) / k; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    // recentre in the image plane, then slide along the view ray back down to the floor
    tgt.addScaledVector(r, (x0 + x1) / 2 * d).addScaledVector(up, ((y0 + y1) / 2 - yc) * d); tgt.addScaledVector(dir, -tgt.y / dir.y);
  }
  return { pos: tgt.clone().addScaledVector(dir, fit()), tgt };
}
function focusOf(car) { return car.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.0, 0)); }
function offsetFor(m) {
  const k = camera.aspect < 1 ? 1.55 : 1;
  return m === 'follow' ? new THREE.Vector3(5.5, 5.2, 11.5).multiplyScalar(k) : new THREE.Vector3(5.2, 2.8, 7.4).multiplyScalar(k);
}
// reduced motion: camera moves become cuts
function flyTo(getPos, getTgt, dur = 1.1) { anim = { t: 0, dur: reduceMotion ? 1e-3 : dur, p0: camera.position.clone(), t0: controls.target.clone(), getPos, getTgt }; }
function setMode(m, car) {
  mode = m;
  document.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  if (m === 'overview') { tracked = null; const p = ovPose = overviewPose(); flyTo(() => p.pos, () => p.tgt); }
  else {
    tracked = car || (m === 'follow' ? pickFollow() : (tracked || preview));
    if (tracked) { const off = offsetFor(m); flyTo(() => focusOf(tracked).add(off), () => focusOf(tracked)); lastFocus.copy(focusOf(tracked)); }
  }
  controls.autoRotate = false;
  checkFollowed();
}
// strip tap / lessons: a close three-quarter view of one station (overview mode, nothing tracked)
function flyToStation(i) {
  i = clamp(Math.round(i), 0, 6);
  mode = 'overview'; tracked = null;
  document.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === 'overview'));
  // low enough to look through the paint booth's clear front, far enough to see the cabinet and its HMI behind the line
  const narrow = camera.aspect < 1.2, tgt = new THREE.Vector3(SX[i], 1.6, -1.2);
  const pos = tgt.clone().add(new THREE.Vector3(narrow ? -3 : -5, 4.6, 17).multiplyScalar(narrow ? 1.45 : 1));
  flyTo(() => pos, () => tgt, 1.0); anim.station = i;
  checkFollowed();
}
function pickFollow() {
  // one car from order to truck: the one you ordered if it's still on its way, else the newest car on the line
  const live = c => c && c !== preview && allCars.has(c) && c.loadedFor === undefined;
  const want = [...allCars].find(c => c.wo === followWanted && live(c)); if (want) return want;
  const w = line.units[line.units.length - 1]; if (w) return w.car;
  const ex = exiting[exiting.length - 1]; if (ex) return ex.car;
  if (crane.task && live(crane.task.car)) return crane.task.car;
  const box = cartons.find(c => live(c.car)); if (box) return box.car;
  let best = null; lot.forEach(s => { if (s && live(s.car) && !s.stock && (!best || s.seq < best.seq)) best = s; });
  return best ? best.car : preview;
}
function updateCamera(dt) {
  if (mode === 'follow' && (!tracked || !allCars.has(tracked) || tracked.loadedFor > 2.4)) { tracked = pickFollow(); if (tracked) { const off = offsetFor('follow'); flyTo(() => focusOf(tracked).add(off), () => focusOf(tracked), .9); } }
  if (mode === 'inspect' && (!tracked || !allCars.has(tracked))) setMode('inspect', preview);
  if (anim) {
    anim.t += dt / anim.dur;
    const k = ease(Math.min(1, anim.t));
    camera.position.lerpVectors(anim.p0, anim.getPos(), k);
    controls.target.lerpVectors(anim.t0, anim.getTgt(), k);
    if (anim.t >= 1) { anim = null; if (tracked) lastFocus.copy(focusOf(tracked)); }
  } else if (tracked && mode !== 'overview') {
    const f = focusOf(tracked), d = f.clone().sub(lastFocus);
    camera.position.add(d); controls.target.add(d); lastFocus.copy(f);
  }
  const dist = camera.position.distanceTo(controls.target);
  scene.fog.near = dist * 1.1; scene.fog.far = dist * 3.2 + 40;
  updatePoles(dt);
}
// Follow: a pole within reach of the lens, or standing in the cone to the car, fades out (.3 s) instead of sweeping
// across the frame; it keeps casting its shadow (it is still there, we just see past it). Other modes: all solid.
let polesSolid = true;
function updatePoles(dt) {
  const on = mode === 'follow' && !!tracked;
  if (!on && polesSolid) return;
  const c = camera.position, f = controls.target, fx = f.x - c.x, fz = f.z - c.z, L = Math.hypot(fx, fz) + 1e-6;
  polesSolid = true;
  for (const p of poles) {
    if (on) {
      const m = p.h ? .7 : 0, vx = p.x - c.x, vz = p.z - c.z, s = (vx * fx + vz * fz) / (L * L);
      const near = Math.hypot(vx, vz, Math.max(0, c.y - p.top)) < 4.5 + p.r + m;
      // in front of the car: inside the cone from the lens to a car-sized disc, and tall enough to reach the sight line to its wheels
      const front = s > 0 && s < 1 && Math.abs(vx * fz - vz * fx) / L < p.r + 2.6 * s + .4 + m && p.top > c.y + s * (f.y - 1 - c.y);
      p.h = near || front;
    } else p.h = false;
    const o = clamp(p.o + (p.h ? -dt : dt) / .3, 0, 1);
    if (o < 1) polesSolid = false;
    if (o === p.o) continue;
    p.o = o; for (const mt of p.mats) { mt.opacity = o; mt.depthWrite = o === 1; }
  }
}

/* ---------- the running tab (SPEC §2.6): standard cost, posted where the work happens ---------- */
// kinds: material crew consumable qc power scrap carton freight. `bf` marks amounts brought forward (fillLine, boot stock)
function post(car, id, label, value, station, kind, bf = false) {
  const l = { id, label, value, station, kind }; if (bf) l.bf = true;
  car.tab.lines.push(l); car.tab.total += value;
  if (bf) car.broughtForward += value;
  else if (kind === 'crew' || kind === 'qc' || kind === 'power') ACT.chargedToCars += value;
}
// station k: its parts, one cycle of its operator(s) at the car's own standard cycle, its consumables
function postStation(car, k, bf = false) {
  const c = car.cost;
  for (const p of c.parts[k]) post(car, p.id, p.label, p.value, k, 'material', bf);
  if (c.crewByStation[k] > 0) post(car, 'crew.' + k, `${STATIONS[k]} operator${c.crewAt[k] > 1 ? 's' : ''}`, c.crewByStation[k], k, 'crew', bf);
  if (c.consByStation[k] > 0) post(car, 'cons.' + k, CONS_LABEL[k] || 'Consumables', c.consByStation[k], k, 'consumable', bf);
}
const postExit = (car, bf) => { const c = car.cost; post(car, 'qc', 'QC & pack', c.qcPack, 7, 'qc', bf); post(car, 'power', 'Power', c.power, 7, 'power', bf); };
const postScrapShare = (car, bf) => post(car, 'scrap', 'Share of scrap', car.cost.scrapShare, 7, 'scrap', bf);
// the line exit: QC & pack and power, then the seeded gate (every R.scrapEvery-th car, or as setQcSeed placed it)
function qcGate(car) {
  postExit(car, false);
  emitE('exit', { wo: car.wo, car, post: { qc: car.cost.qcPack, power: car.cost.power }, tab: car.tab.total });
  qcCount++;
  const n = Math.max(1, R.scrapEvery | 0);
  const fail = qcSeed !== null ? qcCount >= qcSeed && (qcCount - qcSeed) % n === 0 : qcCount % n === 0;
  emitE('qc', { wo: car.wo, car, pass: !fail, count: qcCount });
  if (fail) return false;
  postScrapShare(car, false);
  emitE('scrapShare', { wo: car.wo, car, post: car.cost.scrapShare, tab: car.tab.total });
  return true;
}

/* ---------- scrap crate: beside the exit ramp, clear of the drive-off path (ramp curbs |z| 1.27, bollards |z| 1.75) ---------- */
const CRATE = { x: 30.3, z: 3.85, L: 5.5, D: 2.75, H: 1.05 };
const scrapping = [];
let crate = null, crateLost = 0;
function buildCrate() {
  const g = new THREE.Group(); g.position.set(CRATE.x, 0, CRATE.z); scene.add(g);
  const { L, D, H } = CRATE, t = .08, body = new THREE.MeshStandardMaterial({ color: '#3E464E', roughness: .55, metalness: .35 });
  add(g, BX(L, .08, D), body, 0, .04, 0);
  for (const s of [-1, 1]) {
    add(g, BX(L, H, t), body, 0, H / 2, s * (D / 2 - t / 2));
    add(g, BX(t, H, D - 2 * t), body, s * (L / 2 - t / 2), H / 2, 0);
    add(g, BX(L + .06, .07, t + .05), yellow, 0, H + .02, s * (D / 2 - t / 2), false);
    add(g, BX(t + .05, .07, D + .06), yellow, s * (L / 2 - t / 2), H + .02, 0, false);
    for (const e of [-1, 1]) add(g, BX(.16, H + .1, .16), steelDark, s * (L / 2 - .02), (H + .1) / 2, e * (D / 2 - .02));
  }
  add(g, BX(L - .3, .14, .02), MK.hazard, 0, .2, D / 2 + .012, false);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const tex = canvasTex(c), mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const front = add(g, new THREE.PlaneGeometry(L - .5, (L - .5) * 160 / 1024), mat, 0, H * .58, D / 2 + .008, false);
  const end = add(g, new THREE.PlaneGeometry(D - .3, (D - .3) * 160 / 1024), mat, -L / 2 - .008, H * .58, 0, false); end.rotation.y = -Math.PI / 2;
  front.receiveShadow = end.receiveShadow = true;
  crate = { g, c, tex, sig: '' };
  drawCrate();
}
function drawCrate() {
  if (!crate) return;
  const money = lay('scrap') ? ` · ${fmt.money2(crateLost)} lost` : '', sig = money;
  if (crate.sig === sig) return; crate.sig = sig;
  const x = crate.c.getContext('2d'); x.clearRect(0, 0, 1024, 160);
  x.fillStyle = 'rgba(236,238,240,.92)'; x.textBaseline = 'middle';
  x.font = '800 92px Archivo, "Arial Black", sans-serif';
  const w1 = x.measureText('SCRAP').width; x.font = '600 66px "IBM Plex Mono", monospace';
  const w2 = money ? x.measureText(money).width : 0, x0 = Math.max(16, (1024 - w1 - w2) / 2);
  x.font = '800 92px Archivo, "Arial Black", sans-serif'; x.fillText('SCRAP', x0, 86);
  if (money) { x.font = '600 66px "IBM Plex Mono", monospace'; x.fillText(money, x0 + w1, 88, 1024 - x0 - w1 - 8); }
  crate.tex.needsUpdate = true;
}
// a failed car: red tag (overlay), up off its pallet and over the crate wall, down into the crate, then the lot's shrink
function scrapCar(car) {
  const lost = car.tab.total;
  car.scrapped = true; car.place = 'scrap';
  car.status = 'Failed the final check · in the scrap crate';
  ACT.scrapped++; ACT.scrapLost += lost; crateLost += lost; dirty.crate = true;
  const r = car.root;
  scrapping.push({ car, t: 0, x0: r.position.x, y0: r.position.y, z0: r.position.z });
  emitE('scrapped', { wo: car.wo, car, lost });
}
function updateScrap(dt) {
  for (const s of [...scrapping]) {
    s.t += dt;
    const r = s.car.root, a = ease(clamp(s.t / .75, 0, 1)), b = clamp((s.t - .75) / .4, 0, 1), top = CRATE.H + 1.0;
    r.position.set(lerp(s.x0, CRATE.x - .1, a), b > 0 ? lerp(top, .1, b * b) : lerp(s.y0, top, Math.sin(a * Math.PI / 2)), lerp(s.z0, CRATE.z, a));
    r.rotation.set(-.2 * b, 0, .06 * b);
    if (s.t >= 3.4) { scrapping.splice(scrapping.indexOf(s), 1); leaving.push({ car: s.car, t: 0 }); }
  }
}

/* ---------- bottleneck floor ring (layer wait): accent ring on the slowest station's floor, pulsing .35-.8 ---------- */
const rings = [];
let ringMat = null;
function buildRings() {
  ringMat = new THREE.MeshBasicMaterial({ color: '#F2B705', transparent: true, opacity: .6, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  const geo = new THREE.RingGeometry(2.72, 3.12, 96); geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(geo, ringMat); m.position.set(SX[i], i === 3 ? .032 : .022, 0); m.visible = false; m.renderOrder = 2; scene.add(m); rings.push(m); }
}
let ringT = 0;
function updateRings(raw) {
  if (!ringMat) return;
  const b = lay('wait') && !stopped ? (line.phase === 'idle' ? stdCost().bottAll : line.bott) : [];
  rings.forEach((m, i) => { m.visible = b.includes(i); });
  ringT += raw;
  ringMat.opacity = reduceMotion ? .6 : .575 + .225 * Math.sin(ringT * Math.PI * 2 / 1.6);
}

/* ---------- HMI ledger variant (SPEC §4.3): WORK / WAIT + MOVE / CREW / ADDS, footer CYCLE x MIN ---------- */
let stdMemo = { key: '', R: null, k: null };
function stdCost() { // the order form's car on a full line of identical cars
  const key = econ.carKey(cfg, UP);
  if (stdMemo.key !== key || stdMemo.R !== R) stdMemo = { key, R, k: econ.carCost(cfg, R, UP) };
  return stdMemo.k;
}
function refreshHmi() {
  if (!ST.length) return;
  const idle = line.phase === 'idle' || !(line.cycle > 0), std = stdCost(), crewAt = econ.stationCrew(UP), rate = R.labourPerMin;
  const cyc = idle ? std.cycle : line.cycle, mMax = idle ? std.bott : line.mMax;
  for (let i = 0; i < 7; i++) {
    const h = ST[i].cab.hmi; if (!h) continue;
    let lines, o;
    if (stopped) { lines = []; o = { big: 'LINE STOPPED', bigSub: lay('meter') ? `LINE ${fmt.rate(0)}/MIN` : 'NO CARS THIS MONTH', status: 'STOP', dot: '#FF5A4E', foot: '—' }; }
    else {
      const foot = lay('cycle') ? `${fmt.min(cyc)} MIN` : `${(MOVE_T + WORK_T * mMax / 3).toFixed(1)} S`;
      o = { foot, status: idle ? 'IDLE' : 'AUTO', dot: idle ? '#6E8A99' : undefined };
      const rows = [];
      if (lay('minutes')) {
        const car = idle ? null : line.cars?.[i], occ = idle || line.occ[i];
        const m = idle ? std.m[i] : line.m[i], wait = occ ? mMax - m : mMax;
        rows.push(`WORK  ${fmt.min(m)} MIN`);
        if (lay('wait')) rows.push(`WAIT  ${fmt.min(wait)} + MOVE ${fmt.min(R.moveMin)}`);
        if (lay('meter')) {
          rows.push(`CREW  ${fmt.money2(crewAt[i] * cyc * rate)} / CYCLE`);
          const adds = idle ? std.stationPost[i] : car ? car.cost.stationPost[i] : null;
          rows.push(`ADDS  ${adds === null ? 'NO CAR' : fmt.money2(adds)}`);
        }
      }
      lines = rows.concat(HMI[i]).slice(0, Math.max(3, rows.length));
    }
    const sig = JSON.stringify([lines, o]);
    if (sig === h.sig) continue;
    h.sig = sig; hmiCanvas(h.code, h.title, lines, o, h.c); h.t.needsUpdate = true;
  }
}

/* ---------- HUD chips (SPEC §4.4) ---------- */
const stationList = idx => { const n = idx.map(i => STATIONS[i]); return n.length > 1 ? n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1] : n[0] || ''; };
const hudCache = {};
function setText(id, v) { if (hudCache[id] === v) return; hudCache[id] = v; const el = document.getElementById(id); if (el) el.textContent = v; }
function showEl(id, on) { const el = document.getElementById(id); if (el && el.hidden === !!on) el.hidden = !on; }
// what the tab chip may show: the kinds whose layer is on
const kindOn = k => k === 'material' ? lay('materials') : k === 'crew' || k === 'consumable' || k === 'qc' || k === 'power' ? lay('meter') : lay('scrap');
const tabShown = car => car.tab.lines.reduce((s, l) => s + (kindOn(l.kind) ? l.value : 0), 0);
function cycleNow() {
  if (line.phase !== 'idle' && line.cycle > 0 && !stopped) return { cycle: line.cycle, bott: line.bott, mMax: line.mMax, live: true };
  const k = stdCost(); return { cycle: k.cycle, bott: k.bottAll, mMax: k.bott, live: false };
}
function updateHud() { dirty.hud = true; }
function drawHud() {
  dirty.hud = false;
  const running = line.phase !== 'idle' && speed > 0 && !stopped;
  $('#hRun').classList.toggle('run', running);
  setText('hState', stopped ? 'Stopped' : speed === 0 ? 'Paused' : line.phase === 'idle' ? 'Idle' : 'Running');
  const c = cycleNow(), names = stationList(c.bott);
  showEl('hCycle', lay('cycle'));
  setText('hCyc', `${fmt.min(c.cycle)} min${names ? ' · ' + names : ''}`);
  const secs = `${(MOVE_T + WORK_T * c.mMax / 3).toFixed(1)} s at 1×`;
  if (hudCache.cycT !== secs) { hudCache.cycT = secs; $('#hCycle').title = `${c.live ? 'This cycle' : 'This order on a full line'}: ${secs}`; }
  showEl('hMeter', lay('meter'));
  setText('hRate', `${fmt.rate(line.phase !== 'idle' && !stopped ? lineRate() : 0)}/min`);
  const fol = tracked && tracked.place !== 'preview' && mode !== 'overview' && tracked.tab;
  showEl('hCar', lay('materials') && !unaided);
  // name the figure by what it holds: the parts alone until the line meter is taught, then the started cost
  setText('hCarK', fol ? 'Tab' : lay('meter') ? 'Started' : 'Parts');
  const std = stdCost();
  setText('hCarV', fmt.money2(fol ? tabShown(tracked) : lay('meter') ? std.started : std.materials));
  setText('hBuilt', fmt.count(built)); setText('hShip', fmt.count(shipped));
  showEl('hDay', lay('cycle'));
  const m = lclock.minOfDay, hh = 8 + Math.floor(m / 60), mm = Math.floor(m % 60);
  const t = `Day ${lclock.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  setText('hClock', line.phase === 'idle' || stopped ? 'Line stopped' : t);
  if (hudCache.dayT !== t) { hudCache.dayT = t; $('#hDay').title = `Line clock: ${t} · ${fmt.min(lclock.lineMin)} line-min run`; }
  showEl('hBank', lay('bank'));
  const bank = bankValue ?? R.openingCash;
  setText('hBankV', fmt.money(bank));
  const bk = $('#hBank'); bk.classList.toggle('low', bank >= 0 && bank < 5000); bk.classList.toggle('neg', bank < 0);
}

/* ---------- yamazumi strip (SPEC §4.4): work fill, hatched wait, grey move band, dashed cycle line ---------- */
const strip = $('#strip');
const YSCALE = 4.75; // bar height = 4.75 min: room for the longest possible cycle (0.5 + 4.0)
strip.innerHTML = '<div class="scap" aria-hidden="true"><span id="sCyc"></span><span id="sBal"></span></div>';
const cells = STATIONS.map((s, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'st'; b.dataset.i = i;
  b.innerHTML = `<span class="yb" aria-hidden="true"><span class="yw"></span><span class="yh"></span><span class="ym"></span><span class="yc"></span></span><i></i><span class="sn">${s}</span><span class="smin"></span><em>ST-0${i + 1}</em>`;
  b.onclick = () => { flyToStation(i); emitE('stationTap', { station: i }); };
  strip.appendChild(b);
  return { b, w: b.querySelector('.yw'), h: b.querySelector('.yh'), m: b.querySelector('.ym'), c: b.querySelector('.yc'), min: b.querySelector('.smin'), s: {} };
});
// the strip's height moves the card above it and the overview framing (resize re-fits the overview when it is on pose)
new ResizeObserver(() => { stageEl.style.setProperty('--strip-h', strip.offsetHeight + 'px'); if (sceneReady) resize(); }).observe(strip);
const pc = x => (Math.max(0, x) / YSCALE * 100).toFixed(2) + '%';
function setStyle(cell, key, prop, el, v) { if (cell.s[key] === v) return; cell.s[key] = v; el.style[prop] = v; }
function drawStrip() {
  const live = line.phase !== 'idle', std = stdCost(), wait = lay('wait'), bars = lay('cycle');
  const working = live && line.phase === 'work';
  const mMax = live ? line.mMax : std.bott, cyc = mMax + R.moveMin;
  const bott = stopped ? [] : live ? line.bott : std.bottAll;
  const fol = tracked && line.units.find(u => u.car === tracked && u.slot < 7);
  strip.classList.toggle('bars', bars); strip.classList.toggle('waits', wait);
  cells.forEach((cell, i) => {
    const occ = live ? line.occ[i] : true, m = live ? line.m[i] : std.m[i];
    const p = working ? line.p[i] : 1, done = !working || line.done[i];
    setStyle(cell, 'wh', 'height', cell.w, pc(m * p));
    setStyle(cell, 'hb', 'bottom', cell.h, pc(occ ? m : 0));
    setStyle(cell, 'hh', 'height', cell.h, pc(done ? (occ ? mMax - m : mMax) : 0));
    setStyle(cell, 'mb', 'bottom', cell.m, pc(mMax));
    setStyle(cell, 'mh', 'height', cell.m, pc(mMax > 0 || live ? R.moveMin : 0));
    setStyle(cell, 'cb', 'bottom', cell.c, pc(cyc));
    const busy = live && occ, f = !!fol && fol.slot === i, bn = wait && bott.includes(i);
    if (cell.s.cls !== `${busy}${f}${bn}`) { cell.s.cls = `${busy}${f}${bn}`; cell.b.classList.toggle('busy', busy); cell.b.classList.toggle('follow', f); cell.b.classList.toggle('bn', bn); }
    const lab = lay('minutes') ? `${fmt.min(occ ? m : 0)}/${fmt.min(cyc)}` : '';
    if (cell.s.lab !== lab) {
      cell.s.lab = lab; cell.min.textContent = lab;
      cell.b.setAttribute('aria-label', `Station 0${i + 1} ${STATIONS[i]}${lab ? `, ${fmt.min(occ ? m : 0)} of ${fmt.min(cyc)} minutes` : ''}${bn ? ', sets the pace' : ''}. Show this station.`);
    }
  });
  const sumM = live ? line.m.reduce((a, b) => a + b, 0) : std.work, bal = cyc > 0 ? sumM / (7 * cyc) : 0;
  setText('sCyc', wait ? `Cycle ${fmt.min(cyc)} min` : '');
  setText('sBal', wait ? `Line balance ${fmt.pct(bal)}` : '');
  const title = wait ? `Line balance ${fmt.pct(bal)}: minutes worked ÷ minutes paid at the stations` : 'Stations';
  if (hudCache.stripT !== title) { hudCache.stripT = title; strip.title = title; }
}

/* ---------- interaction ---------- */
document.querySelectorAll('#modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
document.querySelectorAll('#speeds button').forEach(b => b.onclick = () => {
  speed = +b.dataset.speed; if (speed) lastSpeed = speed;
  document.querySelectorAll('#speeds button').forEach(x => x.setAttribute('aria-pressed', x === b));
  updateHud();
});
// keyboard: Space plays and pauses the line (back to the speed it had), F follows a car (again: back to the overview),
// H hides every control so the factory fills the window
let lastSpeed = 1, scrollKeep = 0;
function toast(html) {
  const t = $('#toast'), hud = $('.hud-top');
  t.style.top = (hud.offsetParent ? hud.offsetTop + hud.offsetHeight + 10 : 16) + 'px'; // under the chips, however many rows they wrap to
  t.innerHTML = html; t.classList.add('on'); clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.classList.remove('on'); toast.h = setTimeout(() => { t.textContent = ''; }, 300); }, 1500); // faded notes leave the status region
}
// the shortcuts never take a key from a focused control: Space presses the focused button, switch or summary, and
// letters type into fields. They work when focus is on the page itself (body, canvas, stage, a heading focused by a
// lesson). The list matches main.js's M/T guard, plus anything put in the tab order on purpose (a scroll box takes Space).
const CONTROLS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), button, a[href], summary, [tabindex]:not([tabindex="-1"]), '
  + '[role=button], [role=switch], [role=tab], [role=slider], [role=radio], [role=checkbox], [role=option], [role=menuitem], [role=link], [role=textbox], [role=spinbutton], [role=combobox], [role=listbox]';
const typing = e => e.ctrlKey || e.metaKey || e.altKey || !e.target.closest || !!e.target.closest(CONTROLS);
const isKey = (e, c) => e.key.toLowerCase() === c || (!/^[a-z]$/i.test(e.key) && e.code === 'Key' + c.toUpperCase()); // the letter's key on any layout
document.addEventListener('keydown', e => {
  if (typing(e)) return;
  if (e.code === 'Space') {
    e.preventDefault(); if (e.repeat) return;
    document.querySelector(`#speeds button[data-speed="${speed ? 0 : lastSpeed}"]`).click();
    toast(speed ? `Playing ${speed}×` : 'Paused · <kbd>Space</kbd> to play');
  } else if (isKey(e, 'f') && !e.repeat) {
    setMode(mode === 'follow' ? 'overview' : 'follow');
    toast(mode === 'follow' ? 'Following a car · <kbd>F</kbd> for the overview' : 'Overview · <kbd>F</kbd> to follow a car');
  } else if (isKey(e, 'h') && !e.repeat) {
    if (!$('.app').classList.contains('bare')) scrollKeep = scrollY;
    const bare = $('.app').classList.toggle('bare');
    if (!bare) scrollTo(0, scrollKeep);
    toast(bare ? 'Press <kbd>H</kbd> to show the controls' : 'Controls back · <kbd>H</kbd> hides them');
  }
});
// off a control, Space belongs to the shortcut on key-up too (no page scroll); on a control its native press stands
document.addEventListener('keyup', e => { if (e.code === 'Space' && !typing(e)) e.preventDefault(); });
function note(t) { $('#note').textContent = t; clearTimeout(note.h); note.h = setTimeout(() => { $('#note').textContent = ''; }, 3200); }
// queue one order record; the form's buttons and the API share this
function enqueue(rec, follow = true) {
  whenReady(() => {
    queue.push(rec); if (follow) followWanted = rec.wo;
    emitE('sent', { wo: rec.wo, cfg: rec.cfg });
    sync(); updateHud();
  });
  return rec.wo;
}
$('#bSend').onclick = () => {
  const wo = enqueue(order(cfg));
  note(`${wo} queued for the line.`);
  if (mode === 'overview' && camera.aspect < 1.2) setMode('follow');
};
$('#bRandom').onclick = () => { Object.assign(cfg, normCfg(randomCfg())); sync(); emitE('optionChanged', { cfg: { ...cfg }, key: 'all' }); };
$('#bBatch').onclick = () => { const w = engine.batch(5); note(`Five orders queued, starting with ${w[0]}.`); };
$('#bFill').onclick = () => { const w = engine.fillLine(cfg); note(`${fmt.count(w.length)} cars of this order placed on the line. Their earlier stations are brought forward.`); };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _hit = new THREE.Vector3();
let downAt = null;
// a station's footprint, for taps on the 3D machines (stationTap)
const ST_BOX = SX.map(x => new THREE.Box3(new THREE.Vector3(x - 3.2, 0, -7), new THREE.Vector3(x + 3.2, 6.6, 3.4)));
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const roots = [...allCars].map(c => c.root);
  const hit = ray.intersectObjects(roots, true).find(h => { for (let o = h.object; o; o = o.parent) if (!o.visible) return false; return !!h.object.userData.car; });
  if (hit) {
    const car = hit.object.userData.car;
    emitE('carTap', { car });
    setMode('inspect', car); $('#hint').hidden = true;
    return;
  }
  let best = -1, bd = Infinity;
  ST_BOX.forEach((b, i) => { if (ray.ray.intersectBox(b, _hit)) { const d = _hit.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = i; } } });
  if (best >= 0) emitE('stationTap', { station: best });
});

/* ---------- export ---------- */
let downloads = null;
(async () => {
  try { downloads = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch { downloads = null; }
  $('#exportRow').hidden = !downloads;
})();
async function save(filename, data) {
  if (!downloads) return;
  try { await downloads.save({ filename, data }); note(`Saved ${filename}.`); }
  catch (err) {
    const c = err && err.code;
    if (c === 'declined') note('Save cancelled.');
    else if (c === 'rate_limited') note('A save prompt is already open. Try again in a moment.');
    else { note('Saving is not available in this view.'); if (c === 'unavailable' || c === 'not_granted') $('#exportRow').hidden = true; }
  }
}
$('#bPng').onclick = () => {
  renderer.render(scene, camera);
  canvas.toBlob(b => b && save(`has-toyline-${(tracked && tracked.wo) || 'line'}.png`, b), 'image/png');
};
$('#bGlb').onclick = async () => {
  const car = (mode !== 'overview' && tracked && tracked.layers) || preview;
  const c0 = car.layers ? car : preview;
  const g = new THREE.Group();
  for (const k of ['livery', 'wheels', 'details']) { const c = c0.layers[k].clone(true); c.visible = true; g.add(c); }
  let GLTFExporter, zipSync;
  try {
    [{ GLTFExporter }, { zipSync }] = await Promise.all([import('three/addons/exporters/GLTFExporter.js'), import('fflate')]);
  } catch (e) { console.warn('[engine] GLB export libraries did not load:', e); note('The export tools could not load. Reload the page and try again.'); return; }
  try {
    const buf = await new GLTFExporter().parseAsync(g, { binary: true, onlyVisible: true });
    const name = `has-toyline-${c0.wo || nextWo()}-${c0.cfg.body}`;
    const zip = zipSync({ [name + '.glb']: new Uint8Array(buf) });
    await save(name + '.zip', zip);
  } catch (e) { note('Export failed. Try again with the car parked.'); }
};

/* ---------- resize & loop ---------- */
let booted = false;
function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight; // inside the border, so the drawing buffer matches the canvas box
  renderer.setPixelRatio(Math.min(devicePixelRatio, bigShadow ? 2 : 1.5));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  // a rotated phone, resized window or H gets the overview framed for its new shape, unless the user has orbited away from it
  const onPose = !ovPose || (camera.position.distanceTo(ovPose.pos) < 1e-3 && controls.target.distanceTo(ovPose.tgt) < 1e-3);
  if (mode === 'overview' && ((anim && anim.station === undefined) || (!anim && onPose))) { const p = ovPose = overviewPose(); if (anim) { anim.getPos = () => p.pos; anim.getTgt = () => p.tgt; } else { camera.position.copy(p.pos); controls.target.copy(p.tgt); } }
  if (booted) { controls.update(); renderer.render(scene, camera); } // setSize clears the canvas: draw now, or the frame shows it blank
}
new ResizeObserver(resize).observe(stageEl);

// the tracked (followed or inspected) car changed: tell the overlay; it renders #card now
let lastFollowed;
function checkFollowed() {
  const t = tracked || null;
  if (t === lastFollowed) return;
  lastFollowed = t; dirty.hud = dirty.strip = true;
  emitE('followed', { car: t });
}
let uiErr = 0;
function ledgerFrame(raw) {
  try {
    updateRings(raw);
    drawStrip();
    if (dirty.hud || (hudTick += raw) > .1) { hudTick = 0; drawHud(); }
    if (dirty.hmi) { dirty.hmi = false; refreshHmi(); }
    if (dirty.order) { dirty.order = false; refreshOrder(); }
    if (dirty.crate) { dirty.crate = false; drawCrate(); }
    checkFollowed();
  } catch (e) { if (uiErr++ < 3) console.error('[engine] ledger UI:', e); }
}
let hudTick = 0;
const clock = new THREE.Clock();
function frame() {
  const raw = Math.min(.05, clock.getDelta());
  const dt = raw * speed;
  stepLine(dt);
  updateTools(dt);
  updateExits(dt);
  updateParticles(dt);
  if (preview) preview.root.rotation.y += raw * (reduceMotion ? .05 : .25);
  updateCamera(raw);
  controls.update();
  camera.updateMatrixWorld(); // project() in frame handlers sees this frame's camera
  ledgerFrame(raw);
  emitE('frame', { dt, raw });
  if (!bigShadow) renderer.shadowMap.needsUpdate = (++shadowTick & 1) === 1;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
// the work-order numbers of the parked sample cars and the first order are taken now, so lesson calls made before the
// boot finishes (fillLine, send) number after them, exactly as the original numbered WO-0001..0008
const BOOT_SAMPLES = econ.SAMPLE_CARS.map(s => order(s.cfg, 'lot'));
const BOOT_FIRST = order(cfg);
(async () => {
  try { await Promise.race([Promise.all([document.fonts.load('800 60px Archivo'), document.fonts.load('600 40px "IBM Plex Mono"')]), new Promise(r => setTimeout(r, 1500))]); } catch { }
  resize();
  buildTools();
  buildLot();
  buildCrate();
  buildRings();
  buildForm();
  sceneReady = true;
  sync();
  rebuildPreview();
  // a few finished cars already parked: stock, their standard started cost and scrap share brought forward on the tab
  BOOT_SAMPLES.forEach(rec => {
    const c = buildCar(rec.cfg, false, rec);
    const i = reserveSlot(); lot[i].car = c; lot[i].stock = true; c.stock = true; c.place = 'lot';
    for (let k = 0; k < 7; k++) postStation(c, k, true);
    postExit(c, true); postScrapShare(c, true);
    const p = stallPose(i); c.root.position.set(p.x, 0, p.z); c.root.rotation.y = p.yaw;
    c.status = `Parked in lot A${i + 1}`;
    scene.add(c.root); computeDims(c); built++;
  });
  // put the line in motion with the configured order
  queue.push(BOOT_FIRST); followWanted = BOOT_FIRST.wo;
  emitE('sent', { wo: BOOT_FIRST.wo, cfg: BOOT_FIRST.cfg });
  sync(); updateHud();
  const start = camera.aspect < 1.2 ? 'follow' : 'overview';
  const ov = overviewPose(); camera.position.copy(ov.pos); controls.target.copy(ov.tgt);
  setMode(start);
  booted = true; engineReady = true;
  for (const fn of pending.splice(0)) { try { fn(); } catch (e) { console.error('[engine] deferred call failed:', e); } }
  requestAnimationFrame(frame);
})();

/* ---------- engine API (docs/CONTRACTS.md) ---------- */
// CONTRACT-GAP: the contract has no place for a car taken off the line by emptyLine/fillLine; such cars get place 'gone'
// and leave engine.cars(). Both calls also start a new actuals session (lesson measurements start from zero).
function clearLine() {
  for (const u of line.units) { if (tracked === u.car) tracked = null; u.car.place = 'gone'; disposeCar(u.car); }
  line.units.length = 0;
  for (const r of queue) r.place = 'gone';
  queue.length = 0;
  Object.assign(line, { phase: 'idle', t: 0, mMax: 0, W: 0, cycle: 0, bott: [], cars: [] });
  line.m.fill(0); line.p.fill(1); line.done.fill(true); line.occ.fill(false);
  for (const k in dirty) dirty[k] = true;
}
const resetActuals = () => Object.assign(ACT, ACT0);
const _pv = new THREE.Vector3(), _wp = new THREE.Vector3();
export const engine = {
  on(type, fn) { if (!subs.has(type)) subs.set(type, new Set()); subs.get(type).add(fn); return () => { subs.get(type)?.delete(fn); }; },
  /* readers */
  get cfg() { return { ...cfg }; },
  cars: () => [...allCars, ...queue],
  lineUnits: () => line.units.map(u => ({ wo: u.car.wo, car: u.car, slot: u.slot })),
  queueLength: () => queue.length,
  get tracked() { return tracked; },
  get clock() { return { lineMin: lclock.lineMin, day: lclock.day, minOfDay: lclock.minOfDay, running: line.phase !== 'idle' && !stopped }; },
  get cycleInfo() {
    if (line.phase === 'idle') { const k = stdCost(); return { phase: 'idle', t: 0, mMax: 0, cycle: k.cycle, p: Array(7).fill(1), m: Array(7).fill(0), bottleneck: [...k.bottAll], W: 0, stopped }; }
    return { phase: line.phase, t: line.t, mMax: line.mMax, cycle: line.cycle || R.moveMin, p: [...line.p], m: [...line.m], bottleneck: [...line.bott], W: line.W, stopped };
  },
  get actuals() { return { ...ACT, idleLine: ACT.linePaid - ACT.chargedToCars }; },
  project(x, y, z) {
    _pv.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, px = (_pv.x + 1) / 2 * w, py = (1 - _pv.y) / 2 * h;
    return { x: px, y: py, visible: _pv.z > -1 && _pv.z < 1 && px >= 0 && px <= w && py >= 0 && py <= h };
  },
  anchor(kind, ref) {
    if (kind === 'station') return [SX[clamp(ref | 0, 0, 6)], 4.2, -3.4];
    if (kind === 'car') {
      if (!ref || !ref.root) return [ENTRY_X, BELT_Y + 2.6, 0];
      ref.root.getWorldPosition(_wp);
      return [_wp.x, _wp.y + ((ref.G && ref.G.ymax) || 1.9) * ref.root.scale.y + .7, _wp.z];
    }
    if (kind === 'pack') return [PACK_X, ROLL_Y + 3.4, 0];
    if (kind === 'truck') return [TRUCK_X + 5, 5.8, 0];
    if (kind === 'scrap') return [CRATE.x, CRATE.H + 1.2, CRATE.z];
    return [0, 0, 0];
  },
  stageEl,
  get speed() { return speed; },
  get cameraMode() { return mode; },
  /* actions */
  configure(o = {}) {
    if (o.R) R = o.R;
    if (o.up) UP = { ...econ.NO_UPGRADES, ...o.up };
    if (o.layers) LAYERS = { ...o.layers };
    if ('moneyOn' in o) moneyOn = !!o.moneyOn;
    if ('tagsOn' in o) tagsOn = !!o.tagsOn;
    if ('fillButton' in o) fillButton = !!o.fillButton;
    if ('unaided' in o) unaided = !!o.unaided;
    if ('price' in o) planPrice = o.price ?? null; // CONTRACT-GAP: main.js passes no price; invoices use R.price unless one is given here
    if (preview) preview.cost = econ.carCost(preview.cfg, R, UP);
    for (const r of queue) r.cost = econ.carCost(r.cfg, R, UP);
    for (const k in dirty) dirty[k] = true;
    refreshOrder();
  },
  setCfg(c) { Object.assign(cfg, normCfg(c)); sync(); emitE('optionChanged', { cfg: { ...cfg }, key: 'all' }); },
  send(c, { follow = true } = {}) { return enqueue(order(c || cfg), follow); }, // follow:false keeps the camera on the car being followed
  batch(n = 5) {
    const recs = [order(cfg)]; for (let i = 1; i < n; i++) recs.push(order(randomCfg()));
    recs.forEach((r, i) => enqueue(r, i === 0));
    return recs.map(r => r.wo);
  },
  fillLine(c = cfg, { count = 7, follow = false } = {}) {
    const n = clamp(Math.round(count), 0, 7), base = normCfg(c || cfg), recs = [];
    for (let s = n - 1; s >= 0; s--) recs[s] = order(base, 'line'); // the car nearest the exit was started first
    whenReady(() => {
      clearLine(); resetActuals();
      for (let s = n - 1; s >= 0; s--) {
        const u = makeUnit(recs[s]);
        u.slot = s; u.fromX = u.toX = SX[s]; u.root.position.x = SX[s];
        // the stations it has passed: their visual layers done, their posts on the tab as brought forward
        for (let k = 0; k < s; k++) { startWork(u, k); finishWork(u, k); postStation(u.car, k, true); }
        ACT.broughtForward += u.car.broughtForward;
        line.units.push(u);
      }
      if (n) beginWork(); else goIdle();
      if (follow && line.units.length) { const car = line.units[0].car; followWanted = car.wo; setMode('follow', car); }
      sync(); updateHud();
    });
    return recs.map(r => r.wo);
  },
  emptyLine() {
    whenReady(() => { clearLine(); resetActuals(); updateHud(); refreshOrder(); emitE('lineIdle', {}); });
  },
  setStopped(b) { stopped = !!b; for (const k in dirty) dirty[k] = true; },
  setQcSeed(n) { qcSeed = qcCount + Math.max(1, Math.round(+n || 1)); },
  setSpeed(s) { const b = document.querySelector(`#speeds button[data-speed="${[0, 1, 2, 4].includes(+s) ? +s : 1}"]`); if (b) b.click(); },
  setCamera(m, car) { if (['overview', 'follow', 'inspect'].includes(m)) whenReady(() => setMode(m, car && car.root ? car : undefined)); },
  followWo(wo) {
    whenReady(() => {
      followWanted = wo;
      const car = [...allCars].find(c => c.wo === wo && c !== preview);
      setMode('follow', car);
    });
  },
  flyToStation(i) { whenReady(() => flyToStation(i)); },
  // a station picked somewhere other than the strip or the scene (a 3D tag, a lesson list): tell every listener
  tapStation(i, source = 'api') { emitE('stationTap', { station: clamp(i | 0, 0, 6), source }); },
  setBank(v) { bankValue = v === null || v === undefined || !Number.isFinite(+v) ? null : +v; dirty.hud = true; },
  toast(html) { toast(html); },
  note(text) { note(text); },
  // not in the contract: for scripted checks and the integrator's debugging only
  get __debug() { return { THREE, scene, camera, controls, ST, line, queue, lot, CRATE, rings, refreshHmi, stdCost }; }
};
