/* Low-poly models for the farm world, built from three.js primitives (no model files to download).
   Static scenery is merged into a few meshes with vertex colours, so the whole farm draws in a handful of calls. */

import * as THREE from 'three';
import type { Look } from '../first/data';
import { addOutlines, makeFace, toonMat } from './toon';

export type Part = { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; m?: THREE.Matrix4 };

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** A transform: position, then rotation (x, y, z in radians), then scale. */
export function at(x: number, y: number, z: number, o: { rx?: number; ry?: number; rz?: number; s?: number; sx?: number; sy?: number; sz?: number } = {}) {
  _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
  return new THREE.Matrix4().compose(_v, _q, _s);
}

/** Merges parts into one geometry with a colour per vertex. */
export function merge(parts: Part[], base?: THREE.Matrix4): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (p.m) g.applyMatrix4(p.m);
    if (base) g.applyMatrix4(base);
    c.set(p.color);
    const P = g.getAttribute('position');
    const N = g.getAttribute('normal');
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Parts transformed as a group (for placing a model built at the origin). */
export const place = (parts: Part[], m: THREE.Matrix4): Part[] => parts.map(p => ({ ...p, m: p.m ? m.clone().multiply(p.m) : m.clone() }));

export const vcMaterial = (flat = false) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat });

/* ---------------- shared shapes ---------------- */

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  cone6: new THREE.ConeGeometry(0.5, 1, 6),
  sphere: new THREE.SphereGeometry(0.5, 12, 8),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  ico1: new THREE.IcosahedronGeometry(0.5, 1),
  dodec: new THREE.DodecahedronGeometry(0.5, 0),
  disc: new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};

/** A flat rounded rectangle on the ground, from (x0, z0) to (x1, z1). */
export function roundRect(x0: number, z0: number, x1: number, z1: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  // shape space: x, y = -z (rotated flat below)
  const a = x0;
  const b = x1;
  const top = -z0;
  const bot = -z1;
  s.moveTo(a + r, bot);
  s.lineTo(b - r, bot);
  s.quadraticCurveTo(b, bot, b, bot + r);
  s.lineTo(b, top - r);
  s.quadraticCurveTo(b, top, b - r, top);
  s.lineTo(a + r, top);
  s.quadraticCurveTo(a, top, a, top - r);
  s.lineTo(a, bot + r);
  s.quadraticCurveTo(a, bot, a + r, bot);
  return new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI / 2);
}

/* ---------------- colours ---------------- */

export const C = {
  grass: '#a5d62c',
  grassLight: '#c2e655',
  grassDark: '#86bf22',
  path: '#eba45a',
  pathEdge: '#f7c98a',
  soil: '#9a5530',
  soilTilled: '#a8613a',
  soilDark: '#7e4425',
  soilWet: '#64351d',
  soilDry: '#c58a5c',
  mulch: '#d9b65e',
  wood: '#e0893a',
  woodDark: '#b9672a',
  woodPlank: '#c98a4a',
  roof: '#d9573c',
  roofDark: '#b8442d',
  wall: '#f6e6c6',
  window: '#7cc8f0',
  white: '#ffffff',
  leaf: '#4fa62b',
  leafLight: '#6ec237',
  leafYoung: '#7ccf3a',
  maizeLeaf: '#3f9d2e',
  maizeTassel: '#e9d27a',
  cob: '#f2c230',
  husk: '#d6c27a',
  dryLeaf: '#c9a85c',
  water: '#3fb4ef',
  waterLight: '#7fd2f7',
  sand: '#f1c37c',
  stone: '#a7a7a0',
  weed: '#2f7d1f',
  hay: '#e8c867',
};

/* ---------------- textures ---------------- */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** How many canvas pixels each unit of a text face is drawn with: text in the farm stays sharp up close. */
const TEXT_RES = 2;
/** The sharpest texture filtering the GPU offers (three.js caps it at the device's own limit): text on the ground and
    on tilted boards stays readable instead of smearing at a slant. */
const TEXT_ANISOTROPY = 16;

/** How far toward the sharper mipmap level text is sampled: a board seen small or at a slant reads crisp instead of
    soft (a little more than the GPU's own choice; the anisotropic filtering keeps it from shimmering). */
const TEXT_BIAS = -0.6;
const SHARP_MAP = THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', `texture2D( map, vMapUv, ${TEXT_BIAS.toFixed(2)} )`);

/** A material whose map is text: sampled with TEXT_BIAS so its words stay sharp. */
export function sharpText<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', SHARP_MAP);
  };
  m.customProgramCacheKey = () => 'sharp-text';
  return m;
}

/** A canvas texture that carries words: drawn at TEXT_RES times the size (the drawing code keeps its own units), with
    the sharpest filtering, and drawn again once the brand font has loaded (text drawn before it falls back to Arial). */
function textTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, res = TEXT_RES) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * res);
  cv.height = Math.round(h * res);
  const g = cv.getContext('2d')!;
  const paint = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(res, 0, 0, res, 0, 0);
    draw(g);
  };
  paint();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = TEXT_ANISOTROPY;
  whenBrandFontReady(() => {
    paint();
    t.needsUpdate = true;
  });
  return t;
}

export function plaid(color: string) {
  return canvasTex(64, 64, g => {
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let i = 0; i < 64; i += 16) {
      g.fillRect(i, 0, 6, 64);
      g.fillRect(0, i, 64, 6);
    }
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 8; i < 64; i += 16) {
      g.fillRect(i, 0, 2, 64);
      g.fillRect(0, i, 64, 2);
    }
  });
}

export function cowHide() {
  return canvasTex(128, 64, g => {
    g.fillStyle = '#fbfbf7';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#26221f';
    const spots: [number, number, number, number][] = [
      [20, 18, 14, 10],
      [62, 40, 18, 12],
      [100, 14, 12, 9],
      [40, 52, 9, 7],
      [110, 48, 10, 8],
    ];
    for (const [x, y, rx, ry] of spots) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** A ground marker like a game's interaction spot: dashed white corners, an icon and a label. */
export function zoneTexture(label: string, glyph: (g: CanvasRenderingContext2D) => void) {
  return textTex(256, 256, g => {
    g.clearRect(0, 0, 256, 256);
    // a soft dark pad inside the corners: the square reads as a spot to stand on, on the pale path as on the grass
    g.fillStyle = 'rgba(40,28,14,0.26)';
    g.beginPath();
    g.roundRect(26, 26, 204, 204, 22);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 12;
    g.lineCap = 'round';
    const k = 54;
    const corners: [number, number, number, number][] = [
      [20, 20, 1, 1],
      [236, 20, -1, 1],
      [20, 236, 1, -1],
      [236, 236, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      g.beginPath();
      g.moveTo(x + dx * k, y);
      g.lineTo(x, y);
      g.lineTo(x, y + dy * k);
      g.stroke();
    }
    g.save();
    g.translate(128, 110);
    glyph(g);
    g.restore();
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(60,40,20,0.55)';
    g.lineWidth = 6;
    g.font = 'bold 40px Poppins, Arial, sans-serif';
    g.textAlign = 'center';
    g.strokeText(label, 128, 214);
    g.fillText(label, 128, 214);
  });
}

/** A floating badge over a sign: a round bubble with a mark. */
export function badgeTexture(text: string, bg: string) {
  return textTex(128, 128, g => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.arc(64, 68, 50, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = bg;
    g.beginPath();
    g.arc(64, 62, 50, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 64px Poppins, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 66);
  });
}

/** A sign board face: a cyan frame with a maize cob, like a crop marker. */
/** The mini forest's sign: a wooden board. */
export function forestSignTexture() {
  return textTex(256, 128, g => {
    g.fillStyle = '#8b5a2b';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#c9925a';
    g.fillRect(8, 8, 240, 112);
    g.fillStyle = '#2f6b25';
    g.beginPath();
    g.moveTo(40, 22);
    g.lineTo(66, 70);
    g.lineTo(14, 70);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(40, 44);
    g.lineTo(70, 98);
    g.lineTo(10, 98);
    g.closePath();
    g.fill();
    g.fillStyle = '#5c3a20';
    g.fillRect(36, 98, 8, 14);
    g.fillStyle = '#3a2410';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 26px Poppins, Arial, sans-serif';
    g.fillText('MINI FOREST', 160, 48);
    g.font = 'bold 24px Poppins, Arial, sans-serif';
    g.fillText('10 acres', 158, 86);
  });
}

/** A short planted tree for the tree farm: a straight trunk and a compact round crown, about head height and a half. */
function farmTree(scale = 1, tint = 0): Part[] {
  const leaf = tint ? C.leafLight : C.leaf;
  return place(
    [
      { geo: G.cyl6, color: '#8b5a2b', m: at(0, 0.55, 0, { sx: 0.22, sy: 1.1, sz: 0.22 }) },
      { geo: G.ico, color: leaf, m: at(0, 1.45, 0, { s: 1.15, sy: 1.0 }) },
      { geo: G.ico, color: C.leafLight, m: at(0.2, 1.75, 0.12, { s: 0.7 }) },
    ],
    at(0, 0, 0, { s: scale }),
  );
}

/** A tall, skinny tree (like a young eucalyptus or cypress): a thin trunk and a narrow, pointed crown. */
function tallTree(scale = 1): Part[] {
  return place(
    [
      { geo: G.cyl6, color: '#7a4c24', m: at(0, 1.1, 0, { sx: 0.16, sy: 2.2, sz: 0.16 }) },
      { geo: G.cone6, color: C.leaf, m: at(0, 2.9, 0, { sx: 0.95, sy: 2.6, sz: 0.95 }) },
      { geo: G.cone6, color: C.leafLight, m: at(0, 3.9, 0, { sx: 0.6, sy: 1.4, sz: 0.6 }) },
    ],
    at(0, 0, 0, { s: scale }),
  );
}

/** The mini forest: a planted tree farm on a darker forest floor, filling the rectangle x0..x1, z0..z1. Short trees
    stand in straight rows with open lanes between them, so the farmer can run through; a few tall, skinny trees rise
    out of the rows. Grass tufts and small bushes grow at the foot of the trees. Placed the same way every time (no
    randomness). Returns the parts and where each trunk stands (the farmer walks round the trunks only). */
export function forest(x0: number, z0: number, x1: number, z1: number): { parts: Part[]; floor: Part[]; trunks: { x: number; z: number; r: number }[] } {
  const floor: Part[] = [
    { geo: roundRect(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, 1.4), color: '#4c9a3c', m: at(0, 0.006, 0) },
    { geo: roundRect(x0, z0, x1, z1, 1.1), color: '#3d8434', m: at(0, 0.011, 0) },
  ];
  const parts: Part[] = [];
  const trunks: { x: number; z: number; r: number }[] = [];
  const jit = (i: number, k: number) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;
  // a straight grid, centred in the rectangle: columns across x, rows down z
  const sx = 1.7;
  const sz = 1.85;
  const inset = 0.9;
  const cols = Math.floor((x1 - x0 - 2 * inset) / sx) + 1;
  const rows = Math.floor((z1 - z0 - 2 * inset) / sz) + 1;
  const ox = (x0 + x1) / 2 - ((cols - 1) * sx) / 2;
  const oz = (z0 + z1) / 2 - ((rows - 1) * sz) / 2;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      i++;
      const tx = ox + c * sx + jit(i, 1) * 0.12;
      const tz = oz + r * sz + jit(i, 2) * 0.12;
      const tall = (r * 3 + c * 5) % 7 === 2;
      if (tall) {
        const s = 0.95 + (jit(i, 3) + 0.5) * 0.2;
        parts.push(...place(tallTree(s), at(tx, 0, tz, { ry: jit(i, 4) * 6 })));
        trunks.push({ x: tx, z: tz, r: 0.12 * s });
      } else {
        const s = 0.88 + (jit(i, 3) + 0.5) * 0.18;
        parts.push(...place(farmTree(s, i % 3 === 0 ? 1 : 0), at(tx, 0, tz, { ry: jit(i, 4) * 6 })));
        trunks.push({ x: tx, z: tz, r: 0.16 * s });
      }
      // grass round the foot of the trunk
      const n = 3 + (i % 2);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + jit(i, 6 + k) * 0.8;
        const d = 0.36 + (jit(i, 9 + k) + 0.5) * 0.16;
        parts.push(...place(grassClump(0.48 + (jit(i, 12 + k) + 0.5) * 0.16, k % 2 ? C.grassLight : C.leafYoung), at(tx + Math.cos(a) * d, 0, tz + Math.sin(a) * d, { ry: a })));
      }
      // a small bush under most trees, tucked against the trunk
      if (i % 3 !== 1) {
        const a = jit(i, 15) * 6;
        parts.push(...place(bush(0.42 + (jit(i, 16) + 0.5) * 0.12), at(tx + Math.cos(a) * 0.46, 0, tz + Math.sin(a) * 0.46)));
      }
    }
  }
  return { parts, floor, trunks };
}

export function signTexture(n: number) {
  return textTex(128, 128, g => {
    g.fillStyle = '#3cc3dd';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#e9fbff';
    g.fillRect(12, 12, 104, 104);
    // cob
    g.fillStyle = '#f2c230';
    g.beginPath();
    g.ellipse(52, 64, 16, 34, -0.35, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5bb33a';
    g.beginPath();
    g.moveTo(40, 100);
    g.quadraticCurveTo(26, 64, 44, 34);
    g.quadraticCurveTo(40, 70, 56, 98);
    g.fill();
    g.fillStyle = '#1e5b78';
    g.font = 'bold 44px Poppins, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 92, 66);
  });
}

/** A colour mixed toward white (amt > 0) or black (amt < 0). */
function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  return '#' + c.lerp(new THREE.Color(amt > 0 ? '#ffffff' : '#000000'), Math.abs(amt)).getHexString();
}

/** A rounded rectangle path on a 2D canvas. */
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Text shrunk until it fits a width. */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, min: number, width: number) {
  g.font = `${weight} ${size}px Poppins, Arial, sans-serif`;
  while (g.measureText(text).width > width && size > min) g.font = `${weight} ${(size -= 2)}px Poppins, Arial, sans-serif`;
  return size;
}

/** Calls back once Poppins is ready (canvas text drawn before it loads falls back to Arial, so faces are redrawn). */
export function whenBrandFontReady(cb: () => void) {
  const f = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!f) return;
  Promise.all([f.load('700 40px Poppins'), f.load('600 40px Poppins')]).then(l => l.some(x => x.length) && cb(), () => {});
}

export type BillboardBrand = { name: string; tagline: string; color: string; accent: string; mark: string; category?: string; offer?: { title: string } };

/** A partner's billboard face (2:1): the brand's colours in a deep gradient with a sheen, its mark in a ringed
    medallion, the category, name and tagline, the offer in a pill, and a dark bar along the foot ("Official
    partner" and "Tap for the offer"). `redraw()` paints it again (once the brand font has loaded). */
export function billboardTexture(b: BillboardBrand) {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W * TEXT_RES;
  cv.height = H * TEXT_RES;
  const g = cv.getContext('2d')!;
  const draw = () => {
    // drawn at TEXT_RES times the size, so the words stay sharp
    g.setTransform(TEXT_RES, 0, 0, TEXT_RES, 0, 0);
    g.clearRect(0, 0, W, H);
    // the ground: a diagonal gradient from a lighter to a deeper brand colour
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, shade(b.color, 0.16));
    bg.addColorStop(0.55, b.color);
    bg.addColorStop(1, shade(b.color, -0.38));
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // fine diagonal pinstripes
    g.save();
    g.globalAlpha = 0.06;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    for (let x = -H; x < W; x += 22) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + H, 0);
      g.stroke();
    }
    g.restore();
    // a soft glow behind the medallion and a large faint ring to the right
    const glow = g.createRadialGradient(196, 214, 20, 196, 214, 300);
    glow.addColorStop(0, 'rgba(255,255,255,0.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = 0.08;
    g.strokeStyle = b.accent;
    g.lineWidth = 46;
    g.beginPath();
    g.arc(W + 40, -30, 330, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // the medallion: a white disc ringed in the accent, the mark inside
    const mx = 196;
    const my = 214;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 24;
    g.shadowOffsetY = 8;
    g.fillStyle = b.accent;
    g.beginPath();
    g.arc(mx, my, 132, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const disc = g.createLinearGradient(0, my - 118, 0, my + 118);
    disc.addColorStop(0, '#ffffff');
    disc.addColorStop(1, shade(b.accent, 0.55));
    g.fillStyle = disc;
    g.beginPath();
    g.arc(mx, my, 116, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(b.color, -0.1);
    g.lineWidth = 5;
    g.beginPath();
    g.arc(mx, my, 104, 0, Math.PI * 2);
    g.stroke();
    g.font = '128px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = b.color;
    g.fillText(b.mark, mx, my + 8);

    // the words: category, name, tagline, then the offer in a pill
    const tx = 372;
    const tw = W - tx - 54;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    if (b.category) {
      g.font = '700 30px Poppins, Arial, sans-serif';
      g.fillStyle = b.accent;
      const cat = b.category.toUpperCase().split('').join(String.fromCharCode(8202));
      g.fillText(cat, tx, 104);
      const cw = g.measureText(cat).width;
      g.fillRect(tx + cw + 16, 93, Math.min(120, tw - cw - 16), 4);
    }
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 4;
    g.fillStyle = '#ffffff';
    fit(g, b.name, 700, 100, 52, tw);
    g.fillText(b.name, tx - 4, 200);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.92)';
    fit(g, b.tagline, 600, 40, 24, tw);
    g.fillText(b.tagline, tx, 256);
    if (b.offer) {
      const label = b.offer.title;
      const size = fit(g, label, 700, 34, 20, tw - 92);
      const pw = Math.min(tw, g.measureText(label).width + 92);
      const py = 296;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.3)';
      g.shadowBlur = 12;
      g.shadowOffsetY = 5;
      const pill = g.createLinearGradient(0, py, 0, py + 70);
      pill.addColorStop(0, shade(b.accent, 0.25));
      pill.addColorStop(1, b.accent);
      g.fillStyle = pill;
      rr(g, tx, py, pw, 70, 35);
      g.fill();
      g.restore();
      g.fillStyle = shade(b.color, -0.45);
      g.textBaseline = 'middle';
      g.fillText(label, tx + 30, py + 36 + size * 0.02);
      g.font = '700 38px Poppins, Arial, sans-serif';
      g.fillText('›', tx + pw - 44, py + 33);
      g.textBaseline = 'alphabetic';
    }

    // the foot: a dark bar, "Official partner" and "Tap for the offer"
    g.fillStyle = 'rgba(8,10,14,0.55)';
    g.fillRect(0, H - 72, W, 72);
    g.fillStyle = b.accent;
    g.fillRect(0, H - 72, W, 4);
    g.font = '700 26px Poppins, Arial, sans-serif';
    g.fillStyle = '#e9c46a';
    g.textBaseline = 'middle';
    g.fillText('★  OFFICIAL TEMOLIMA PARTNER', 44, H - 34);
    g.textAlign = 'right';
    g.fillStyle = '#ffffff';
    g.fillText('TAP FOR THE OFFER  ›', W - 44, H - 34);
    g.textAlign = 'left';

    // a gloss over the top half, and a thin inner line in the accent
    const gloss = g.createLinearGradient(0, 0, 0, H * 0.55);
    gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, W, H * 0.55);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 3;
    rr(g, 14, 14, W - 28, H - 28 - 72, 10);
    g.stroke();
  };
  draw();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = TEXT_ANISOTROPY;
  return Object.assign(t, {
    redraw() {
      draw();
      t.needsUpdate = true;
    },
  });
}

/** The plaque on top of a billboard: "Partner" in gold on dark. */
function plaqueTexture() {
  return textTex(256, 64, g => {
    const bg = g.createLinearGradient(0, 0, 0, 64);
    bg.addColorStop(0, '#2a2e36');
    bg.addColorStop(1, '#121418');
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#e2b955';
    g.lineWidth = 4;
    g.strokeRect(5, 5, 246, 54);
    g.fillStyle = '#f1cf73';
    g.font = '700 26px Poppins, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('★ PARTNER ★', 128, 34);
  });
}

/** A soft diagonal band of light (transparent at the edges), slid across a billboard face now and then. */
let sweepTex: THREE.Texture | null = null;
function sweepTexture() {
  return (sweepTex ??= canvasTex(256, 64, g => {
    const gr = g.createLinearGradient(88, 0, 168, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.setTransform(1, 0, -0.5, 1, 16, 0);
    g.fillRect(0, 0, 256, 64);
  }));
}

/** A partner's name for the side of the tractor's bonnet. */
export function liveryTexture(name: string, color: string, accent: string, h = 80) {
  return textTex(256, h, g => {
    g.fillStyle = color;
    g.fillRect(0, 0, 256, h);
    g.fillStyle = accent;
    g.fillRect(0, h - 14, 256, 14);
    g.fillStyle = '#ffffff';
    let size = Math.round(h * 0.42);
    g.font = `bold ${size}px Poppins, Arial, sans-serif`;
    while (g.measureText(name).width > 236 && size > 16) g.font = `bold ${(size -= 2)}px Poppins, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, 128, (h - 14) / 2 + 2);
  });
}

/** The steel of a partner billboard, built at the origin facing +z: a concrete footing, a gunmetal monopole and
    braces, and the head (tilted back a little toward the camera above): the dark cabinet, a gold frame, a catwalk with
    a rail and three lamps, and the plaque's mount. The face, plaque and lamp lenses are separate (see makeBillboard). */
export const BILLBOARD_HEAD = { y: 1.62, tilt: -0.2, faceY: 0.86, faceW: 3.1, faceH: 1.55 };
function billboardSteel(): Part[] {
  const gun = '#3a3f48';
  const dark = '#22252b';
  const gold = '#d4a843';
  const goldHi = '#f0cd6e';
  const H = BILLBOARD_HEAD;
  const out: Part[] = [
    { geo: G.cyl, color: '#bdb8aa', m: at(0, 0.1, 0, { sx: 0.7, sy: 0.2, sz: 0.7 }) },
    { geo: G.cyl, color: '#a29d90', m: at(0, 0.21, 0, { sx: 0.5, sy: 0.04, sz: 0.5 }) },
    { geo: G.cyl, color: gun, m: at(0, 0.9, 0, { sx: 0.22, sy: 1.4, sz: 0.22 }) },
    { geo: G.cyl, color: dark, m: at(0, 0.3, 0, { sx: 0.3, sy: 0.14, sz: 0.3 }) },
    { geo: G.cyl, color: dark, m: at(0, 1.5, 0, { sx: 0.28, sy: 0.12, sz: 0.28 }) },
    // braces from the pole out to the ends of the yoke
    { geo: G.box, color: gun, m: at(-0.55, 1.42, -0.06, { rz: -0.55, sx: 1.2, sy: 0.07, sz: 0.07 }) },
    { geo: G.box, color: gun, m: at(0.55, 1.42, -0.06, { rz: 0.55, sx: 1.2, sy: 0.07, sz: 0.07 }) },
  ];
  const head: Part[] = [
    // the yoke the head sits on
    { geo: G.box, color: dark, m: at(0, 0, -0.06, { sx: 2.4, sy: 0.12, sz: 0.12 }) },
    // the cabinet, and a gold frame round the face
    { geo: G.box, color: dark, m: at(0, H.faceY, -0.06, { sx: 3.42, sy: 1.86, sz: 0.16 }) },
    { geo: G.box, color: goldHi, m: at(0, H.faceY + 0.9, 0.04, { sx: 3.42, sy: 0.07, sz: 0.06 }) },
    { geo: G.box, color: gold, m: at(0, H.faceY - 0.9, 0.04, { sx: 3.42, sy: 0.07, sz: 0.06 }) },
    { geo: G.box, color: gold, m: at(-1.675, H.faceY, 0.04, { sx: 0.07, sy: 1.86, sz: 0.06 }) },
    { geo: G.box, color: gold, m: at(1.675, H.faceY, 0.04, { sx: 0.07, sy: 1.86, sz: 0.06 }) },
    // the plaque's mount on top
    { geo: G.box, color: gold, m: at(0, H.faceY + 1.07, -0.02, { sx: 1.04, sy: 0.3, sz: 0.08 }) },
    // the catwalk and its rail
    { geo: G.box, color: '#4a505a', m: at(0, 0.02, 0.2, { sx: 3.2, sy: 0.04, sz: 0.36 }) },
    { geo: G.box, color: gun, m: at(0, 0.24, 0.37, { sx: 3.2, sy: 0.03, sz: 0.03 }) },
  ];
  for (const x of [-1.58, -0.79, 0, 0.79, 1.58]) head.push({ geo: G.box, color: gun, m: at(x, 0.13, 0.37, { sx: 0.03, sy: 0.22, sz: 0.03 }) });
  // three lamps on arms, leaning in to light the face
  for (const x of [-1.05, 0, 1.05]) {
    head.push({ geo: G.box, color: gun, m: at(x, 0.08, 0.5, { sx: 0.04, sy: 0.04, sz: 0.3 }) });
    head.push({ geo: G.box, color: dark, m: at(x, 0.12, 0.66, { rx: -0.7, sx: 0.24, sy: 0.1, sz: 0.14 }) });
  }
  out.push(...place(head, at(0, H.y, 0, { rx: H.tilt })));
  return out;
}

export type Billboard = { group: THREE.Group; face: THREE.MeshBasicMaterial; sweep: THREE.Mesh; lenses: THREE.MeshBasicMaterial };

/** A partner billboard: the steel (one merged mesh), and the face (the partner's texture), the plaque, the lamp
    lenses and a sweep of light, on a head tilted back toward the camera. */
export function makeBillboard(face: THREE.Texture): Billboard {
  const g = new THREE.Group();
  const steel = new THREE.Mesh(merge(billboardSteel()), vcMaterial(false));
  steel.castShadow = true;
  g.add(steel);
  const H = BILLBOARD_HEAD;
  const head = new THREE.Group();
  head.position.y = H.y;
  head.rotation.x = H.tilt;
  g.add(head);
  const faceMat = sharpText(new THREE.MeshBasicMaterial({ map: face }));
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(H.faceW, H.faceH), faceMat);
  plane.position.set(0, H.faceY, 0.025);
  head.add(plane);
  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(H.faceW, H.faceH),
    new THREE.MeshBasicMaterial({ map: sweepTexture().clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const st = (sweep.material as THREE.MeshBasicMaterial).map!;
  st.wrapS = THREE.ClampToEdgeWrapping;
  st.offset.x = 1;
  st.needsUpdate = true;
  sweep.position.set(0, H.faceY, 0.032);
  sweep.visible = false;
  head.add(sweep);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.235), sharpText(new THREE.MeshBasicMaterial({ map: plaqueTexture() })));
  plaque.position.set(0, H.faceY + 1.07, 0.025);
  head.add(plaque);
  const lenses = new THREE.MeshBasicMaterial({ color: '#9aa0a8' });
  for (const x of [-1.05, 0, 1.05]) {
    const l = new THREE.Mesh(G.box, lenses);
    l.position.set(x, 0.165, 0.69);
    l.rotation.x = -0.7;
    l.scale.set(0.2, 0.02, 0.1);
    head.add(l);
  }
  return { group: g, face: faceMat, sweep, lenses };
}

/* ---------------- scenery pieces (built at the origin) ---------------- */

export function fencePost(): Part[] {
  return [
    { geo: G.cyl, color: C.wood, m: at(0, 0.5, 0, { sx: 0.26, sy: 1, sz: 0.26 }) },
    { geo: G.sphere, color: C.wood, m: at(0, 1.0, 0, { s: 0.26 }) },
    { geo: G.disc, color: '#e9f39a', m: at(0, 0.015, 0, { s: 0.62 }) },
  ];
}

export function fenceRail(len: number): Part[] {
  return [
    { geo: G.box, color: C.wood, m: at(0, 0.78, 0, { sx: len, sy: 0.12, sz: 0.09 }) },
    { geo: G.box, color: C.wood, m: at(0, 0.48, 0, { sx: len, sy: 0.12, sz: 0.09 }) },
  ];
}

/** A fence from (x0, z0) to (x1, z1), a post every ~1.8 units. The bay numbered `open` (from the start) has no
    lower rail and a raised top rail: a feed barrier the cows reach under to the feeder. */
export function fence(x0: number, z0: number, x1: number, z1: number, open = -1): Part[] {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.8));
  const ry = -Math.atan2(z1 - z0, x1 - x0);
  const out: Part[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const z = z0 + ((z1 - z0) * i) / n;
    out.push(...place(fencePost(), at(x, 0, z)));
    if (i >= n) continue;
    const mid = at(x + (x1 - x0) / n / 2, 0, z + (z1 - z0) / n / 2, { ry });
    if (i === open) out.push(...place([{ geo: G.box, color: C.wood, m: at(0, 0.98, 0, { sx: len / n, sy: 0.12, sz: 0.09 }) }], mid));
    else out.push(...place(fenceRail(len / n), mid));
  }
  return out;
}

export function tree(scale = 1, tint = 0): Part[] {
  const leaf = tint ? C.leafLight : C.leaf;
  return place(
    [
      { geo: G.cyl6, color: '#8b5a2b', m: at(0, 0.7, 0, { sx: 0.4, sy: 1.4, sz: 0.4 }) },
      { geo: G.ico, color: leaf, m: at(0, 2.0, 0, { s: 2.3 }) },
      { geo: G.ico, color: C.leafLight, m: at(0.55, 2.5, 0.3, { s: 1.4 }) },
      { geo: G.ico, color: leaf, m: at(-0.5, 1.7, -0.4, { s: 1.5 }) },
    ],
    at(0, 0, 0, { s: scale }),
  );
}

/** A clump of long grass blades, like the screenshot's bright tufts. */
export function grassClump(scale = 1, color: string = C.grassLight): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    out.push({ geo: G.cone4, color: i % 2 ? color : C.grassDark, m: at(Math.cos(a) * 0.12, 0.45, Math.sin(a) * 0.12, { sx: 0.16, sy: 0.95 + (i % 3) * 0.2, sz: 0.06, rz: Math.cos(a) * 0.45, rx: -Math.sin(a) * 0.45, ry: a }) });
  }
  return place(out, at(0, 0, 0, { s: scale }));
}

export function bush(scale = 1): Part[] {
  return place(
    [
      { geo: G.ico1, color: C.leaf, m: at(0, 0.45, 0, { s: 1.0 }) },
      { geo: G.ico1, color: C.leafLight, m: at(0.45, 0.35, 0.15, { s: 0.75 }) },
      { geo: G.ico1, color: C.leaf, m: at(-0.4, 0.32, 0.1, { s: 0.7 }) },
    ],
    at(0, 0, 0, { s: scale }),
  );
}

export function rock(scale = 1): Part[] {
  return [{ geo: G.dodec, color: C.stone, m: at(0, 0.15 * scale, 0, { s: 0.6 * scale, sy: 0.4 * scale }) }];
}

/** An overgrown bush for the daily tidy-up: scruffy, a little dry, with bare twigs poking out (it reads as untidy next
    to the farm's own neat bushes). */
export function wildBush(scale = 1): Part[] {
  const out: Part[] = [
    { geo: G.ico1, color: C.weed, m: at(0, 0.42, 0, { s: 0.95, sy: 0.85 }) },
    { geo: G.ico1, color: C.leaf, m: at(0.42, 0.3, 0.18, { s: 0.7 }) },
    { geo: G.ico1, color: C.dryLeaf, m: at(-0.38, 0.28, 0.16, { s: 0.62 }) },
    { geo: G.ico1, color: C.leafLight, m: at(0.05, 0.62, -0.2, { s: 0.55 }) },
  ];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.4;
    out.push({ geo: G.cone4, color: C.woodDark, m: at(Math.cos(a) * 0.32, 0.72, Math.sin(a) * 0.32, { sx: 0.05, sy: 0.55, sz: 0.05, rz: Math.cos(a) * 0.7, rx: -Math.sin(a) * 0.7 }) });
  }
  // dry grass at its foot, on a patch of trampled, dry ground
  out.push(...place(grassClump(0.9, C.dryLeaf), at(0.55, 0, -0.3)));
  out.push({ geo: G.disc, color: C.soilDry, m: at(0, 0.02, 0, { sx: 1.9, sz: 1.6 }) });
  return place(out, at(0, 0, 0, { s: scale }));
}

/** A pile of rocks for the daily tidy-up: a big one and two small ones. */
export function rockPile(scale = 1): Part[] {
  return place(
    [
      { geo: G.dodec, color: C.stone, m: at(0, 0.2, 0, { s: 0.7, sy: 0.5, ry: 0.4 }) },
      { geo: G.dodec, color: '#8d8d86', m: at(0.45, 0.11, 0.22, { s: 0.36, sy: 0.28, ry: 1.1 }) },
      { geo: G.dodec, color: '#bdbdb5', m: at(-0.38, 0.09, 0.3, { s: 0.28, sy: 0.22, ry: 2.3 }) },
      { geo: G.dodec, color: '#9a9a92', m: at(0.1, 0.06, -0.48, { s: 0.2, sy: 0.16, ry: 0.7 }) },
      // the scuffed ground it rolled onto
      { geo: G.disc, color: C.soilDry, m: at(0, 0.02, 0, { sx: 1.7, sz: 1.4 }) },
    ],
    at(0, 0, 0, { s: scale }),
  );
}

export function flowers(): Part[] {
  const cols = ['#ffffff', '#ffe04a', '#ff8fb0'];
  const out: Part[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    out.push({ geo: G.sphere, color: cols[i % 3], m: at(Math.cos(a) * 0.35, 0.12, Math.sin(a) * 0.35, { s: 0.16 }) });
  }
  return out;
}

export function house(): Part[] {
  const roofL = new THREE.BoxGeometry(1, 1, 1);
  return [
    { geo: G.box, color: C.wall, m: at(0, 1.5, 0, { sx: 6.4, sy: 3, sz: 4.4 }) },
    { geo: roofL, color: C.roof, m: at(0, 3.55, 1.15, { sx: 7.2, sy: 0.3, sz: 3.0, rx: -0.62 }) },
    { geo: roofL, color: C.roofDark, m: at(0, 3.55, -1.15, { sx: 7.2, sy: 0.3, sz: 3.0, rx: 0.62 }) },
    { geo: G.box, color: C.wall, m: at(-3.15, 3.45, 0, { sx: 0.1, sy: 1.2, sz: 3.6 }) },
    { geo: G.box, color: C.wall, m: at(3.15, 3.45, 0, { sx: 0.1, sy: 1.2, sz: 3.6 }) },
    { geo: G.box, color: '#a25a3c', m: at(2.0, 4.2, -0.6, { sx: 0.6, sy: 1.4, sz: 0.6 }) },
    { geo: G.box, color: '#8b4f2e', m: at(0, 1.05, 2.22, { sx: 1.2, sy: 2.1, sz: 0.1 }) },
    { geo: G.sphere, color: '#f2c230', m: at(0.4, 1.05, 2.3, { s: 0.12 }) },
    { geo: G.box, color: C.white, m: at(-2.0, 1.7, 2.21, { sx: 1.3, sy: 1.1, sz: 0.08 }) },
    { geo: G.box, color: C.window, m: at(-2.0, 1.7, 2.26, { sx: 1.05, sy: 0.85, sz: 0.06 }) },
    { geo: G.box, color: C.white, m: at(2.0, 1.7, 2.21, { sx: 1.3, sy: 1.1, sz: 0.08 }) },
    { geo: G.box, color: C.window, m: at(2.0, 1.7, 2.26, { sx: 1.05, sy: 0.85, sz: 0.06 }) },
    { geo: G.box, color: C.woodPlank, m: at(0, 0.12, 2.75, { sx: 2.2, sy: 0.24, sz: 1.0 }) },
    { geo: G.box, color: '#f3a65a', m: at(-2.0, 1.12, 2.4, { sx: 1.4, sy: 0.18, sz: 0.3 }) },
    { geo: G.box, color: '#f3a65a', m: at(2.0, 1.12, 2.4, { sx: 1.4, sy: 0.18, sz: 0.3 }) },
  ];
}

export function shed(): Part[] {
  return [
    { geo: G.box, color: C.woodPlank, m: at(0, 1.4, -1.5, { sx: 5, sy: 2.8, sz: 0.25 }) },
    { geo: G.box, color: C.woodPlank, m: at(-2.4, 1.4, 0, { sx: 0.25, sy: 2.8, sz: 3.2 }) },
    { geo: G.box, color: C.woodPlank, m: at(2.4, 1.4, 0, { sx: 0.25, sy: 2.8, sz: 3.2 }) },
    { geo: G.box, color: '#8b5a2b', m: at(0, 3.0, 0, { sx: 5.6, sy: 0.25, sz: 4.0, rx: 0.12 }) },
    { geo: G.box, color: '#a8703a', m: at(-1.4, 0.45, -0.8, { sx: 0.9, sy: 0.9, sz: 0.9 }) },
    { geo: G.box, color: '#a8703a', m: at(1.5, 0.35, -0.9, { sx: 0.7, sy: 0.7, sz: 0.7 }) },
    { geo: G.box, color: '#7b4a22', m: at(0, 0.02, 0, { sx: 4.6, sy: 0.04, sz: 3.0 }) },
  ];
}

export function stall(): Part[] {
  const out: Part[] = [
    { geo: G.box, color: C.woodPlank, m: at(0, 0.9, 0, { sx: 4.2, sy: 0.18, sz: 1.4 }) },
    { geo: G.box, color: '#a8703a', m: at(0, 0.45, 0, { sx: 4.0, sy: 0.9, sz: 1.2 }) },
  ];
  for (const x of [-2, 2]) out.push({ geo: G.cyl6, color: '#8b5a2b', m: at(x, 1.4, -0.55, { sx: 0.16, sy: 2.8, sz: 0.16 }) });
  for (const x of [-2, 2]) out.push({ geo: G.cyl6, color: '#8b5a2b', m: at(x, 1.2, 0.55, { sx: 0.16, sy: 2.4, sz: 0.16 }) });
  for (let i = 0; i < 6; i++) out.push({ geo: G.box, color: i % 2 ? '#ffffff' : '#e84a3a', m: at(-1.875 + i * 0.75, 2.6, 0, { sx: 0.75, sy: 0.1, sz: 1.9, rx: 0.25 }) });
  for (let i = 0; i < 7; i++) out.push({ geo: G.cyl, color: C.cob, m: at(-1.5 + i * 0.5, 1.1, -0.1 + (i % 2) * 0.25, { sx: 0.18, sy: 0.45, sz: 0.18, rz: Math.PI / 2 }) });
  return out;
}

/** The mini restaurant beside the market stall: a small kiosk with a green roof, a serving counter with a cooking pot
    and plates, and a bench for customers in front. Centred at the origin, its counter toward +z. */
export function restaurant(): Part[] {
  const wood = '#8b5a2b';
  const out: Part[] = [
    // the floor and the back wall
    { geo: G.box, color: '#c9a77a', m: at(0, 0.04, 0, { sx: 2.3, sy: 0.08, sz: 1.7 }) },
    { geo: G.box, color: '#f2d29b', m: at(0, 1.1, -0.72, { sx: 2.2, sy: 2.2, sz: 0.12 }) },
    { geo: G.box, color: '#f2d29b', m: at(-1.06, 1.1, -0.1, { sx: 0.1, sy: 2.2, sz: 1.3 }) },
    { geo: G.box, color: '#f2d29b', m: at(1.06, 1.1, -0.1, { sx: 0.1, sy: 2.2, sz: 1.3 }) },
    // the roof under a green and yellow striped awning, sloping to the front
    // the counter
    { geo: G.box, color: wood, m: at(0, 0.5, 0.55, { sx: 2.1, sy: 1.0, sz: 0.35 }) },
    { geo: G.box, color: C.woodPlank, m: at(0, 1.03, 0.58, { sx: 2.25, sy: 0.08, sz: 0.5 }) },
    // a cooking pot and plates on the counter
    { geo: G.cyl, color: '#5a5f66', m: at(-0.6, 1.2, 0.55, { sx: 0.36, sy: 0.26, sz: 0.36 }) },
    { geo: G.cyl, color: '#f4f1e8', m: at(-0.6, 1.34, 0.55, { sx: 0.3, sy: 0.02, sz: 0.3 }) },
    // the menu board on the back wall
    { geo: G.box, color: '#2b3a2f', m: at(0, 1.6, -0.64, { sx: 1.1, sy: 0.6, sz: 0.04 }) },
    { geo: G.box, color: '#e9e3c9', m: at(0, 1.72, -0.61, { sx: 0.8, sy: 0.05, sz: 0.02 }) },
    { geo: G.box, color: '#e9e3c9', m: at(-0.1, 1.56, -0.61, { sx: 0.6, sy: 0.05, sz: 0.02 }) },
    { geo: G.box, color: '#e9e3c9', m: at(0.05, 1.42, -0.61, { sx: 0.7, sy: 0.05, sz: 0.02 }) },
    // a bench in front for customers
    { geo: G.box, color: C.woodPlank, m: at(0, 0.42, 1.3, { sx: 1.6, sy: 0.08, sz: 0.34 }) },
  ];
  for (const x of [0.15, 0.55]) {
    out.push({ geo: G.cyl, color: '#ffffff', m: at(x, 1.09, 0.6, { sx: 0.3, sy: 0.03, sz: 0.3 }) });
    out.push({ geo: G.sphere, color: x < 0.3 ? '#f3ead2' : '#3f8a2a', m: at(x, 1.13, 0.6, { sx: 0.16, sy: 0.07, sz: 0.16 }) });
  }
  for (const x of [-0.7, 0.7]) out.push({ geo: G.box, color: wood, m: at(x, 0.2, 1.3, { sx: 0.1, sy: 0.4, sz: 0.3 }) });
  // corner posts holding the roof at the front
  for (const x of [-1.2, 1.2]) out.push({ geo: G.cyl6, color: wood, m: at(x, 1.15, 0.85, { sx: 0.12, sy: 2.3, sz: 0.12 }) });
  for (let i = 0; i < 5; i++) out.push({ geo: G.box, color: i % 2 ? '#ffd23f' : '#2f9a4a', m: at(-1.08 + i * 0.54, 2.35, 0.05, { sx: 0.54, sy: 0.12, sz: 2.1, rx: 0.16 }) });
  // a round sign on the roof with a steaming bowl
  out.push({ geo: G.cyl6, color: wood, m: at(0, 2.75, -0.5, { sx: 0.08, sy: 0.7, sz: 0.08 }) });
  out.push({ geo: G.cyl, color: '#fff6dc', m: at(0, 3.25, -0.5, { sx: 0.7, sy: 0.08, sz: 0.7, rx: Math.PI / 2 }) });
  out.push({ geo: G.sphere, color: '#d9432f', m: at(0, 3.18, -0.43, { sx: 0.26, sy: 0.14, sz: 0.06 }) });
  return out;
}

export function board(): Part[] {
  return [
    { geo: G.cyl6, color: '#8b5a2b', m: at(-0.8, 0.9, 0, { sx: 0.14, sy: 1.8, sz: 0.14 }) },
    { geo: G.cyl6, color: '#8b5a2b', m: at(0.8, 0.9, 0, { sx: 0.14, sy: 1.8, sz: 0.14 }) },
    { geo: G.box, color: C.woodPlank, m: at(0, 1.35, 0.05, { sx: 2.0, sy: 1.1, sz: 0.12 }) },
    { geo: G.box, color: '#fff6dc', m: at(-0.4, 1.4, 0.12, { sx: 0.6, sy: 0.7, sz: 0.02 }) },
    { geo: G.box, color: '#fff6dc', m: at(0.4, 1.3, 0.12, { sx: 0.55, sy: 0.6, sz: 0.02 }) },
  ];
}

export function pond(): Part[] {
  const out: Part[] = [
    { geo: G.disc, color: C.sand, m: at(0, 0.02, 0, { sx: 7.4, sz: 5.6 }) },
    { geo: G.disc, color: C.water, m: at(0, 0.04, 0, { sx: 6.4, sz: 4.6 }) },
    { geo: G.disc, color: C.waterLight, m: at(-0.8, 0.05, -0.6, { sx: 3.2, sz: 2.0 }) },
    { geo: G.disc, color: '#4cae3a', m: at(1.6, 0.06, 0.8, { s: 0.6 }) },
    { geo: G.disc, color: '#4cae3a', m: at(1.1, 0.06, 1.3, { s: 0.45 }) },
  ];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    out.push(...place(rock(0.7 + (i % 3) * 0.2), at(Math.cos(a) * 3.6, 0, Math.sin(a) * 2.75)));
  }
  return out;
}

/** The farm's water tank beside the pond: a green plastic tank up on a timber stand, with a pump pipe down to the
    water and a tap underneath (the tank the Water page tracks, src/water). Centred at the origin; the pipe runs
    toward -z for `pipe` units to reach the pond's edge. */
export function waterTank(pipe = 1.8): Part[] {
  const wood = '#8b5a2b';
  const green = '#2f7d4a';
  const out: Part[] = [];
  // a concrete pad and four legs with cross braces
  out.push({ geo: G.box, color: '#bdb6a6', m: at(0, 0.04, 0, { sx: 2.0, sy: 0.08, sz: 2.0 }) });
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    out.push({ geo: G.box, color: wood, m: at(x, 0.85, z, { sx: 0.16, sy: 1.7, sz: 0.16 }) });
  }
  for (const z of [-0.7, 0.7]) out.push({ geo: G.box, color: wood, m: at(0, 0.8, z, { sx: 1.95, sy: 0.08, sz: 0.06, rz: 0.72 }) });
  for (const x of [-0.7, 0.7]) out.push({ geo: G.box, color: wood, m: at(x, 0.8, 0, { sx: 0.06, sy: 0.08, sz: 1.95, rx: -0.72 }) });
  // the platform
  out.push({ geo: G.box, color: C.woodPlank, m: at(0, 1.74, 0, { sx: 1.8, sy: 0.12, sz: 1.8 }) });
  // the tank: a ribbed cylinder, a domed top and a lid
  out.push({ geo: G.cyl, color: green, m: at(0, 2.5, 0, { sx: 1.5, sy: 1.4, sz: 1.5 }) });
  for (const y of [2.05, 2.5, 2.95]) out.push({ geo: G.cyl, color: '#276b3f', m: at(0, y, 0, { sx: 1.56, sy: 0.08, sz: 1.56 }) });
  out.push({ geo: G.sphere, color: green, m: at(0, 3.2, 0, { sx: 1.5, sy: 0.42, sz: 1.5 }) });
  out.push({ geo: G.cyl, color: '#1f5a34', m: at(0, 3.42, 0, { sx: 0.42, sy: 0.08, sz: 0.42 }) });
  // the pump pipe: up the side from the pond into the top of the tank
  const grey = '#9aa3a8';
  out.push({ geo: G.cyl6, color: grey, m: at(0, 1.75, -0.86, { sx: 0.09, sy: 3.3, sz: 0.09 }) });
  out.push({ geo: G.cyl6, color: grey, m: at(0, 3.38, -0.6, { sx: 0.09, sy: 0.6, sz: 0.09, rx: Math.PI / 2 }) });
  out.push({ geo: G.cyl6, color: grey, m: at(0, 0.12, -0.86 - pipe / 2, { sx: 0.09, sy: pipe, sz: 0.09, rx: Math.PI / 2 }) });
  out.push({ geo: G.box, color: '#2b2f33', m: at(0, 0.22, -0.86, { sx: 0.3, sy: 0.26, sz: 0.3 }) });
  // the outlet and tap under the platform, with a bucket
  out.push({ geo: G.cyl6, color: grey, m: at(0.3, 1.45, 0.3, { sx: 0.07, sy: 0.5, sz: 0.07 }) });
  out.push({ geo: G.box, color: '#c0392b', m: at(0.3, 1.18, 0.36, { sx: 0.1, sy: 0.08, sz: 0.16 }) });
  out.push({ geo: G.cyl, color: '#e0a312', m: at(0.3, 0.3, 0.3, { sx: 0.4, sy: 0.42, sz: 0.4 }) });
  return out;
}

/** The cow feeder: a timber box on short legs that sits right on the pen's front fence, half in, half out, so the
    farmer pours over it from outside and the cows eat from inside. Centred at the origin, 1.56 long (it fits one
    fence bay); the feed in it is the engine's own mesh, so it can rise as it is poured (FEEDER). */
export function trough(): Part[] {
  const wood = '#8b5a2b';
  const dark = '#5e3a1a';
  return [
    // legs
    { geo: G.box, color: dark, m: at(-0.66, 0.16, 0, { sx: 0.12, sy: 0.32, sz: 0.62 }) },
    { geo: G.box, color: dark, m: at(0.66, 0.16, 0, { sx: 0.12, sy: 0.32, sz: 0.62 }) },
    // the floor, the two long sides and the ends: an open box
    { geo: G.box, color: wood, m: at(0, 0.36, 0, { sx: 1.56, sy: 0.08, sz: 0.72 }) },
    { geo: G.box, color: wood, m: at(0, 0.5, 0.33, { sx: 1.56, sy: 0.3, sz: 0.07 }) },
    { geo: G.box, color: wood, m: at(0, 0.5, -0.33, { sx: 1.56, sy: 0.3, sz: 0.07 }) },
    { geo: G.box, color: wood, m: at(-0.75, 0.5, 0, { sx: 0.07, sy: 0.3, sz: 0.72 }) },
    { geo: G.box, color: wood, m: at(0.75, 0.5, 0, { sx: 0.07, sy: 0.3, sz: 0.72 }) },
    // a pale lip along the top so the box reads from the camera
    { geo: G.box, color: '#c08a52', m: at(0, 0.66, 0.33, { sx: 1.6, sy: 0.04, sz: 0.1 }) },
    { geo: G.box, color: '#c08a52', m: at(0, 0.66, -0.33, { sx: 1.6, sy: 0.04, sz: 0.1 }) },
  ];
}

/* ---------------- crops (one tile each; drawn as instances) ---------------- */

function leaf(len: number, color: string, ry: number, tilt: number, y: number): Part {
  return { geo: G.cone4, color, m: at(Math.sin(ry) * len * 0.35, y, Math.cos(ry) * len * 0.35, { sx: 0.16, sy: len, sz: 0.04, ry, rx: tilt }) };
}

/** Maize at a stage, for one tile (four plants in two rows). */
export function maizeTile(stage: 'sprout' | 'young' | 'tall' | 'ripe' | 'stubble'): THREE.BufferGeometry {
  const parts: Part[] = [];
  const spots = [
    [-0.25, -0.3],
    [0.25, -0.3],
    [-0.25, 0.3],
    [0.25, 0.3],
  ];
  for (const [x, z] of spots) {
    const plant: Part[] = [];
    if (stage === 'sprout') {
      plant.push(leaf(0.32, C.leafYoung, 0.6, 0.7, 0.13), leaf(0.3, C.leafYoung, -2.4, 0.7, 0.13));
    } else if (stage === 'young') {
      plant.push({ geo: G.cyl6, color: C.maizeLeaf, m: at(0, 0.25, 0, { sx: 0.06, sy: 0.5, sz: 0.06 }) });
      for (let i = 0; i < 4; i++) plant.push(leaf(0.5, i % 2 ? C.leafYoung : C.maizeLeaf, i * 1.7, 0.9, 0.2 + i * 0.08));
    } else if (stage === 'tall' || stage === 'ripe') {
      const leafC = stage === 'ripe' ? C.dryLeaf : C.maizeLeaf;
      plant.push({ geo: G.cyl6, color: stage === 'ripe' ? '#c9b36a' : '#4c9a2c', m: at(0, 0.6, 0, { sx: 0.07, sy: 1.2, sz: 0.07 }) });
      for (let i = 0; i < 5; i++) plant.push(leaf(0.6, i % 2 ? (stage === 'ripe' ? C.husk : C.leafLight) : leafC, i * 1.9, 1.0, 0.3 + i * 0.16));
      plant.push({ geo: G.cone4, color: C.maizeTassel, m: at(0, 1.3, 0, { sx: 0.12, sy: 0.3, sz: 0.12 }) });
      plant.push({ geo: G.cyl, color: stage === 'ripe' ? C.cob : '#9ccf4a', m: at(0.08, 0.65, 0.04, { sx: 0.11, sy: 0.3, sz: 0.11, rz: -0.35 }) });
    } else {
      plant.push({ geo: G.cyl6, color: '#c9a85c', m: at(0, 0.08, 0, { sx: 0.06, sy: 0.16, sz: 0.06 }) });
    }
    parts.push(...place(plant, at(x, 0.08, z, { ry: x * 7 + z * 3 })));
  }
  return merge(parts);
}

/** Sukuma wiki at a stage, for one tile (four plants): a low rosette of broad, blue-green leaves on a short stem.
    Ripe is the same plant at full size, ready for its lower leaves to be picked; stubble is the stem with a few left. */
export function kaleTile(stage: 'sprout' | 'young' | 'tall' | 'ripe' | 'stubble'): THREE.BufferGeometry {
  const parts: Part[] = [];
  const dark = '#2f6e45';
  const mid = '#4f8f5a';
  const light = '#7cb66c';
  const broad = (len: number, wide: number, color: string, ry: number, tilt: number, y: number): Part => ({
    geo: G.sphere,
    color,
    m: at(Math.sin(ry) * len * 0.42, y, Math.cos(ry) * len * 0.42, { sx: wide, sy: 0.05, sz: len, ry, rx: tilt }),
  });
  const spots = [
    [-0.27, -0.28],
    [0.27, -0.28],
    [-0.27, 0.28],
    [0.27, 0.28],
  ];
  for (const [x, z] of spots) {
    const plant: Part[] = [];
    if (stage === 'sprout') {
      plant.push(broad(0.16, 0.11, light, 0.5, -0.5, 0.06), broad(0.16, 0.11, light, 3.6, -0.5, 0.06));
    } else if (stage === 'young') {
      plant.push({ geo: G.cyl6, color: '#7a9a5a', m: at(0, 0.07, 0, { sx: 0.05, sy: 0.14, sz: 0.05 }) });
      for (let i = 0; i < 5; i++) plant.push(broad(0.26, 0.18, i % 2 ? mid : light, i * 1.26, -0.45, 0.12));
    } else if (stage === 'tall' || stage === 'ripe') {
      const s = stage === 'ripe' ? 1.15 : 1;
      plant.push({ geo: G.cyl6, color: '#6f8f55', m: at(0, 0.16 * s, 0, { sx: 0.07, sy: 0.32 * s, sz: 0.07 }) });
      for (let i = 0; i < 6; i++) plant.push(broad(0.38 * s, 0.27 * s, i % 2 ? dark : mid, i * 1.05, -0.55, 0.12 * s));
      for (let i = 0; i < 4; i++) plant.push(broad(0.26 * s, 0.2 * s, light, i * 1.57 + 0.5, -0.9, 0.3 * s));
    } else {
      plant.push({ geo: G.cyl6, color: '#7d8a55', m: at(0, 0.14, 0, { sx: 0.07, sy: 0.28, sz: 0.07 }) });
      for (let i = 0; i < 3; i++) plant.push(broad(0.2, 0.15, light, i * 2.1, -0.9, 0.28));
    }
    parts.push(...place(plant, at(x, 0.06, z, { ry: x * 7 + z * 3 })));
  }
  return merge(parts);
}

export function weedTile(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (const [x, z, s] of [
    [-0.2, -0.15, 1],
    [0.22, 0.2, 0.8],
    [0.05, 0.35, 0.7],
  ] as const) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push({ geo: G.cone4, color: i % 2 ? C.weed : '#4c9a2a', m: at(x + Math.cos(a) * 0.06, 0.18 * s + 0.08, z + Math.sin(a) * 0.06, { sx: 0.1 * s, sy: 0.42 * s, sz: 0.04, ry: a, rz: Math.cos(a) * 0.6, rx: -Math.sin(a) * 0.6 }) });
    }
  }
  return merge(parts);
}

/** Wild grass and bush on unprepared land. */
export function wildTile(): THREE.BufferGeometry {
  return merge([...place(grassClump(0.55, C.grassLight), at(-0.2, 0, -0.15)), ...place(grassClump(0.45), at(0.25, 0, 0.25))]);
}

export function puddleTile(): THREE.BufferGeometry {
  return merge([{ geo: G.disc, color: '#56b9e8', m: at(0, 0.17, 0, { sx: 0.95, sz: 0.8 }) }]);
}

export function hailTile(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 9; i++) parts.push({ geo: G.sphere, color: '#f4fbff', m: at(((i * 37) % 9) / 10 - 0.4, 0.2, ((i * 53) % 9) / 10 - 0.4, { s: 0.07 }) });
  return merge(parts);
}

/** Striga (witchweed): short stems of red-pink flowers at the foot of the maize. */
export function strigaTile(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (const [x, z, s] of [
    [-0.28, 0.12, 1],
    [0.3, -0.2, 0.85],
    [0.1, 0.36, 0.75],
  ] as const) {
    parts.push({ geo: G.cyl6, color: '#6f8a3a', m: at(x, 0.2 * s, z, { sx: 0.035, sy: 0.4 * s, sz: 0.035 }) });
    for (let i = 0; i < 5; i++) parts.push({ geo: G.ico, color: i % 2 ? '#ff2f6e' : '#ff5ab0', m: at(x + (i % 2 ? 0.05 : -0.05), (0.24 + i * 0.07) * s, z + (i > 2 ? 0.05 : -0.05), { s: 0.12 * s }) });
  }
  return merge(parts);
}

/** A rat's or mole rat's heap of fresh soil, with its hole. */
export function moundTile(): THREE.BufferGeometry {
  return merge([
    { geo: G.sphere, color: '#4a2c18', m: at(-0.15, 0.14, 0.1, { sx: 0.55, sy: 0.26, sz: 0.48 }) },
    { geo: G.sphere, color: '#5a3a22', m: at(0.27, 0.12, -0.24, { sx: 0.34, sy: 0.18, sz: 0.3 }) },
    { geo: G.disc, color: '#120a05', m: at(0.08, 0.19, 0.36, { sx: 0.16, sz: 0.13 }) },
  ]);
}

/** A gully the rain cut down the slope: a red-brown channel along the tile. */
export function gullyTile(): THREE.BufferGeometry {
  return merge([
    { geo: G.disc, color: '#5a2610', m: at(0, 0.18, 0, { sx: 0.5, sz: 1.18 }) },
    { geo: G.disc, color: '#8a3a18', m: at(0.03, 0.185, 0.05, { sx: 0.24, sz: 0.95 }) },
  ]);
}

/** A trench dug across the slope, its soil thrown uphill in a ridge (fanya juu). */
export function trenchTile(): THREE.BufferGeometry {
  return merge([
    { geo: G.box, color: '#3d2614', m: at(0, 0.15, 0.1, { sx: 1.0, sy: 0.04, sz: 0.16 }) },
    { geo: G.box, color: '#7a4a2a', m: at(0, 0.18, -0.08, { sx: 1.0, sy: 0.08, sz: 0.14 }) },
  ]);
}

/** Mulch laid over the soil: cut weeds and stalks. */
export function mulchTile(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 9; i++) parts.push({ geo: G.box, color: i % 2 ? '#c9a45a' : '#a8843e', m: at(((i * 37) % 9) / 10 - 0.4, 0.165, ((i * 53) % 9) / 10 - 0.4, { sx: 0.34, sy: 0.02, sz: 0.05, ry: i * 0.9 }) });
  return merge(parts);
}

export function pestTile(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 5; i++) parts.push({ geo: G.sphere, color: '#5a3b1e', m: at(((i * 31) % 7) / 8 - 0.35, 0.55 + (i % 3) * 0.15, ((i * 17) % 7) / 8 - 0.35, { sx: 0.12, sy: 0.06, sz: 0.06 }) });
  return merge(parts);
}

/* ---------------- characters ---------------- */

export interface Farmer {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  hand: THREE.Group;
  back: THREE.Group;
  tools: Record<'hoe' | 'sickle' | 'can' | 'wand' | 'hammer' | 'wrench' | 'bucket' | 'basket', THREE.Object3D>;
  loads: Record<'seeds' | 'fertilizer' | 'sprayer' | 'crate', THREE.Object3D>;
  cobs: THREE.Group;
}

/** Characters drawn in the retro anime style (Settings → Character style): toon shading and ink outlines.
   Set by the farm before it builds its models. */
let ANIME = false;
export function setCharacterStyle(anime: boolean) {
  ANIME = anime;
}

const lam = (color: THREE.ColorRepresentation, map?: THREE.Texture) =>
  ANIME ? toonMat(color, map) : new THREE.MeshLambertMaterial(map ? { color, map } : { color });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, shadow = true) {
  const o = new THREE.Mesh(geo, mat);
  o.applyMatrix4(m);
  o.castShadow = shadow;
  return o;
}

export type FarmerLook = Pick<Look, 'skin' | 'outfit'> & Partial<Look>;

export function makeFarmer(look: FarmerLook): Farmer {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = lam(look.skin);
  // retro anime: flat cel colours (the outfit and trim of the chosen look); original: the red check shirt and jeans
  const shirt = ANIME ? lam(look.outfit) : lam('#ffffff', plaid(look.outfit));
  const jeans = lam(ANIME ? '#34416b' : '#3b6fd1');
  const boot = lam(ANIME ? '#3a2418' : '#5a3a22');
  const hatM = lam('#f3dfa6');
  const band = lam('#c0392b');

  const leg = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0.62, 0);
    g.add(mesh(G.box, jeans, at(0, -0.28, 0, { sx: 0.2, sy: 0.56, sz: 0.22 })));
    g.add(mesh(G.box, boot, at(0, -0.56, 0.04, { sx: 0.22, sy: 0.12, sz: 0.3 })));
    body.add(g);
    return g;
  };
  const legL = leg(-0.12);
  const legR = leg(0.12);
  body.add(mesh(G.box, jeans, at(0, 0.66, 0, { sx: 0.5, sy: 0.14, sz: 0.28 })));
  body.add(mesh(new THREE.CapsuleGeometry(0.27, 0.26, 4, 10), shirt, at(0, 0.98, 0, { sz: 0.66 })));
  const arm = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 1.15, 0);
    g.add(mesh(new THREE.CapsuleGeometry(0.08, 0.32, 4, 8), shirt, at(0, -0.2, 0)));
    g.add(mesh(G.sphere, skin, at(0, -0.44, 0, { s: 0.15 })));
    body.add(g);
    return g;
  };
  const armL = arm(-0.34);
  const armR = arm(0.34);
  if (ANIME) animeHead(body, look, skin);
  else {
    body.add(mesh(G.sphere, skin, at(0, 1.42, 0, { s: 0.46 })));
    body.add(mesh(G.sphere, lam('#2a1d14'), at(-0.08, 1.45, 0.21, { s: 0.06 }), false));
    body.add(mesh(G.sphere, lam('#2a1d14'), at(0.08, 1.45, 0.21, { s: 0.06 }), false));
    body.add(mesh(G.cyl, hatM, at(0, 1.6, 0, { sx: 0.95, sy: 0.04, sz: 0.95 })));
    body.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.24, 14), hatM, at(0, 1.72, 0)));
    body.add(mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.06, 14), band, at(0, 1.64, 0)));
  }

  // tools held in the right hand
  const hand = new THREE.Group();
  hand.position.set(0, -0.44, 0.04);
  armR.add(hand);
  const wood = lam('#8b5a2b');
  const metal = lam('#c9d1d6');
  const hoe = new THREE.Group();
  hoe.add(mesh(G.cyl6, wood, at(0, 0.1, 0.25, { sx: 0.05, sy: 1.0, sz: 0.05, rx: 1.2 })));
  hoe.add(mesh(G.box, metal, at(0, -0.05, 0.72, { sx: 0.26, sy: 0.18, sz: 0.04 })));
  const sickle = new THREE.Group();
  sickle.add(mesh(G.cyl6, wood, at(0, 0, 0.1, { sx: 0.05, sy: 0.3, sz: 0.05, rx: 1.4 })));
  sickle.add(mesh(new THREE.TorusGeometry(0.18, 0.025, 4, 12, Math.PI * 1.2), metal, at(0, 0.02, 0.38, { rx: Math.PI / 2 })));
  const can = new THREE.Group();
  can.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.28, 12), lam('#3fa0e0'), at(0, -0.1, 0.12)));
  can.add(mesh(G.cyl6, lam('#3fa0e0'), at(0, -0.04, 0.38, { sx: 0.04, sy: 0.34, sz: 0.04, rx: 1.0 })));
  const wand = new THREE.Group();
  wand.add(mesh(G.cyl6, lam('#444'), at(0, 0, 0.3, { sx: 0.03, sy: 0.6, sz: 0.03, rx: 1.3 })));
  // for the jobs done by hand (src/onsite): building, fixing, feeding and milking, collecting eggs
  const hammer = new THREE.Group();
  hammer.add(mesh(G.cyl6, wood, at(0, 0, 0.18, { sx: 0.045, sy: 0.4, sz: 0.045, rx: 1.4 })));
  hammer.add(mesh(G.box, lam('#5c6b73'), at(0, 0.02, 0.4, { sx: 0.1, sy: 0.1, sz: 0.24, rx: -0.17 })));
  const wrench = new THREE.Group();
  wrench.add(mesh(G.box, metal, at(0, 0, 0.22, { sx: 0.06, sy: 0.03, sz: 0.42 })));
  wrench.add(mesh(new THREE.TorusGeometry(0.06, 0.022, 4, 10, Math.PI * 1.4), metal, at(0, 0, 0.45, { rx: Math.PI / 2 })));
  const bucket = new THREE.Group();
  bucket.add(mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 12), lam('#9aa3a8'), at(0, -0.18, 0.06)));
  bucket.add(mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 12, Math.PI), lam('#5c6b73'), at(0, -0.05, 0.06)));
  const basket = new THREE.Group();
  basket.add(mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.16, 10), lam('#c9a05a'), at(0, -0.16, 0.08)));
  for (const [x, z] of [[-0.06, 0.04], [0.05, 0.1], [0, 0.0]]) basket.add(mesh(G.sphere, lam('#f6efe0'), at(x, -0.06, 0.08 + z, { sx: 0.09, sy: 0.12, sz: 0.09 })));
  const tools = { hoe, sickle, can, wand, hammer, wrench, bucket, basket };
  for (const t of Object.values(tools)) {
    t.visible = false;
    hand.add(t);
  }
  // loads carried on the back
  const back = new THREE.Group();
  back.position.set(0, 1.0, -0.3);
  body.add(back);
  const sack = (color: string, bandColor?: string) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.28, 10, 8), lam(color), at(0, 0, -0.05, { sy: 1.25, sz: 0.8 })));
    if (bandColor) g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 10), lam(bandColor), at(0, 0.05, -0.05, { sz: 0.75 })));
    g.add(mesh(G.cone6, lam(color), at(0, 0.37, -0.05, { sx: 0.18, sy: 0.16, sz: 0.18, rx: Math.PI })));
    g.visible = false;
    back.add(g);
    return g;
  };
  const tank = new THREE.Group();
  tank.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 12), lam('#f2c230'), at(0, 0, -0.06)));
  tank.add(mesh(G.sphere, lam('#e0e0e0'), at(0, 0.3, -0.06, { s: 0.2 })));
  tank.visible = false;
  back.add(tank);
  // a part or a tool bought, carried to where it goes (src/onsite)
  const crate = new THREE.Group();
  crate.add(mesh(G.box, lam(C.woodPlank), at(0, 0, -0.12, { sx: 0.5, sy: 0.42, sz: 0.36 })));
  crate.add(mesh(G.box, lam(C.woodDark), at(0, 0, -0.12, { sx: 0.52, sy: 0.08, sz: 0.38 })));
  crate.visible = false;
  back.add(crate);
  const loads = { seeds: sack('#d8bd8a'), fertilizer: sack('#f5f5f0', '#3aa856'), sprayer: tank, crate };
  // the harvest, stacked on the back
  const cobs = new THREE.Group();
  cobs.position.set(0, 0.85, -0.42);
  body.add(cobs);
  const cobM = lam(C.cob);
  const huskM = lam('#8cc153');
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    c.add(mesh(G.cyl, cobM, at(0, 0, 0, { sx: 0.16, sy: 0.5, sz: 0.16, rz: Math.PI / 2 })));
    c.add(mesh(G.cone4, huskM, at(-0.3, 0, 0, { sx: 0.14, sy: 0.18, sz: 0.14, rz: Math.PI / 2 })));
    c.position.set((i % 2) * 0.06 - 0.03, Math.floor(i) * 0.15, 0);
    c.rotation.y = (i % 2 ? 0.25 : -0.2);
    c.visible = false;
    cobs.add(c);
  }
  root.traverse(o => {
    if ((o as THREE.Mesh).isMesh && !o.userData.noOutline) (o as THREE.Mesh).castShadow = true;
  });
  if (ANIME) addOutlines(root, 0.034);
  return { root, body, legL, legR, armL, armR, hand, back, tools, loads, cobs };
}

const HALF_SPHERE = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);

/** The anime farmer's head: a bigger head with a painted face, and the look's headwrap, cap or hi-top hair. */
function animeHead(body: THREE.Group, look: FarmerLook, skin: THREE.Material) {
  const full: Look = { trim: '#f2c14e', head: 'none', headColor: '#1d1410', ...look };
  const Y = 1.46;
  const R = 0.25;
  body.add(mesh(G.cyl, skin, at(0, 1.24, 0, { sx: 0.13, sy: 0.14, sz: 0.13 })));
  body.add(mesh(G.sphere, skin, at(0, Y, 0, { s: R * 2 })));
  const face = makeFace(full, R);
  face.position.set(0, Y, 0);
  face.castShadow = false;
  body.add(face);
  const hc = lam(full.headColor);
  if (full.head === 'wrap') {
    body.add(mesh(HALF_SPHERE, hc, at(0, Y + 0.1, -0.01, { sx: 0.56, sy: 0.56, sz: 0.56 })));
    body.add(mesh(new THREE.CylinderGeometry(0.282, 0.282, 0.05, 18), lam(full.trim), at(0, Y + 0.14, -0.01)));
    body.add(mesh(G.sphere, hc, at(0.1, Y + 0.33, -0.04, { sx: 0.22, sy: 0.18, sz: 0.2 })));
  } else if (full.head === 'cap') {
    body.add(mesh(G.sphere, lam('#1d1410'), at(0, Y + 0.01, -0.03, { s: 0.52 })));
    body.add(mesh(HALF_SPHERE, hc, at(0, Y + 0.09, 0, { sx: 0.54, sy: 0.5, sz: 0.54 })));
    body.add(mesh(G.box, hc, at(0, Y + 0.1, 0.28, { sx: 0.36, sy: 0.03, sz: 0.22, rx: 0.12 })));
    body.add(mesh(G.sphere, lam(full.trim), at(-0.08, Y + 0.24, 0.19, { s: 0.07 })));
  } else {
    // a 90s hi-top with spiky anime points on top
    const hair = lam(full.headColor);
    body.add(mesh(G.sphere, hair, at(0, Y + 0.01, -0.03, { s: 0.52 })));
    body.add(mesh(new THREE.CylinderGeometry(0.24, 0.255, 0.3, 14), hair, at(0, Y + 0.25, -0.01)));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      body.add(mesh(G.cone6, hair, at(Math.sin(a) * 0.15, Y + 0.44, Math.cos(a) * 0.15 - 0.01, { sx: 0.1, sy: 0.14, sz: 0.1, rx: Math.cos(a) * 0.35, rz: -Math.sin(a) * 0.35 })));
    }
  }
}

/** A four-legged animal (cow, goat, ox): a body, a head, four legs. */
export function makeQuadruped(kind: 'cow' | 'goat' | 'ox') {
  const g = new THREE.Group();
  const hide = kind === 'cow' ? (ANIME ? toonMat('#ffffff', cowHide()) : new THREE.MeshLambertMaterial({ map: cowHide() })) : lam(kind === 'goat' ? '#eae4da' : '#8a5a34');
  const dark = lam(kind === 'cow' ? '#26221f' : kind === 'goat' ? '#5b524a' : '#5c3a20');
  const pink = lam('#f2a7a0');
  const s = kind === 'goat' ? 0.55 : 1;
  const body = new THREE.Group();
  body.add(mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 10), hide, at(0, 0.85, 0, { rx: Math.PI / 2, sx: 1.05, sz: 0.95 })));
  const head = new THREE.Group();
  head.position.set(0, 1.15, 0.78);
  head.add(mesh(G.box, hide, at(0, 0, 0.1, { sx: 0.48, sy: 0.46, sz: 0.5 })));
  head.add(mesh(G.box, kind === 'cow' ? pink : dark, at(0, -0.1, 0.4, { sx: 0.42, sy: 0.24, sz: 0.16 })));
  head.add(mesh(G.sphere, lam('#1d1d1d'), at(-0.14, 0.08, 0.36, { s: 0.08 }), false));
  head.add(mesh(G.sphere, lam('#1d1d1d'), at(0.14, 0.08, 0.36, { s: 0.08 }), false));
  if (kind !== 'goat') {
    head.add(mesh(G.cone6, lam('#efe6cf'), at(-0.24, 0.3, 0.02, { sx: 0.08, sy: 0.24, sz: 0.08, rz: 0.6 })));
    head.add(mesh(G.cone6, lam('#efe6cf'), at(0.24, 0.3, 0.02, { sx: 0.08, sy: 0.24, sz: 0.08, rz: -0.6 })));
  } else {
    head.add(mesh(G.cone6, dark, at(-0.12, 0.34, -0.05, { sx: 0.07, sy: 0.3, sz: 0.07, rx: -0.5 })));
    head.add(mesh(G.cone6, dark, at(0.12, 0.34, -0.05, { sx: 0.07, sy: 0.3, sz: 0.07, rx: -0.5 })));
  }
  head.add(mesh(G.box, dark, at(-0.3, 0.12, 0, { sx: 0.18, sy: 0.08, sz: 0.12 })));
  head.add(mesh(G.box, dark, at(0.3, 0.12, 0, { sx: 0.18, sy: 0.08, sz: 0.12 })));
  body.add(head);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [-0.25, 0.42],
    [0.25, 0.42],
    [-0.25, -0.42],
    [0.25, -0.42],
  ]) {
    const l = new THREE.Group();
    l.position.set(x, 0.62, z);
    l.add(mesh(G.box, hide, at(0, -0.24, 0, { sx: 0.16, sy: 0.48, sz: 0.16 })));
    l.add(mesh(G.box, dark, at(0, -0.54, 0, { sx: 0.17, sy: 0.12, sz: 0.17 })));
    body.add(l);
    legs.push(l);
  }
  body.add(mesh(G.cyl6, dark, at(0, 0.95, -0.82, { sx: 0.05, sy: 0.5, sz: 0.05, rx: 0.5 })));
  g.add(body);
  g.scale.setScalar(s);
  g.traverse(o => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  if (ANIME) addOutlines(g, 0.045);
  return { root: g, head, legs };
}

export function makeChicken() {
  const g = new THREE.Group();
  const white = lam('#ffffff');
  g.add(mesh(G.sphere, white, at(0, 0.28, 0, { sx: 0.36, sy: 0.32, sz: 0.44 })));
  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.16);
  head.add(mesh(G.sphere, white, at(0, 0, 0, { s: 0.2 })));
  head.add(mesh(G.box, lam('#e8403a'), at(0, 0.11, 0, { sx: 0.04, sy: 0.08, sz: 0.1 })));
  head.add(mesh(G.cone4, lam('#f2a33a'), at(0, -0.01, 0.12, { sx: 0.06, sy: 0.08, sz: 0.06, rx: Math.PI / 2 })));
  g.add(head);
  g.add(mesh(G.box, lam('#f2a33a'), at(-0.06, 0.06, 0, { sx: 0.03, sy: 0.12, sz: 0.03 })));
  g.add(mesh(G.box, lam('#f2a33a'), at(0.06, 0.06, 0, { sx: 0.03, sy: 0.12, sz: 0.03 })));
  if (ANIME) addOutlines(g, 0.026);
  return { root: g, head };
}

export function makeBird() {
  const g = new THREE.Group();
  const brown = lam('#7a5232');
  g.add(mesh(G.sphere, brown, at(0, 0.15, 0, { sx: 0.16, sy: 0.14, sz: 0.24 })));
  g.add(mesh(G.sphere, brown, at(0, 0.24, 0.1, { s: 0.12 })));
  g.add(mesh(G.cone4, lam('#f2a33a'), at(0, 0.24, 0.18, { sx: 0.04, sy: 0.07, sz: 0.04, rx: Math.PI / 2 })));
  const wl = new THREE.Group();
  wl.position.set(-0.07, 0.18, 0);
  wl.add(mesh(G.box, lam('#5c3a20'), at(-0.1, 0, 0, { sx: 0.2, sy: 0.02, sz: 0.12 })));
  const wr = new THREE.Group();
  wr.position.set(0.07, 0.18, 0);
  wr.add(mesh(G.box, lam('#5c3a20'), at(0.1, 0, 0, { sx: 0.2, sy: 0.02, sz: 0.12 })));
  g.add(wl, wr);
  return { root: g, wl, wr };
}

/** The tractor; with a partner's livery, its name on both sides of the bonnet. */
export function makeTractor(livery?: { side: THREE.Texture; top: THREE.Texture }) {
  const g = new THREE.Group();
  const yellow = lam('#f5c21b');
  const teal = lam('#1f9d8f');
  const black = lam('#2a2a2a');
  g.add(mesh(G.box, yellow, at(0, 0.75, 0.25, { sx: 1.1, sy: 0.6, sz: 1.6 })));
  g.add(mesh(G.box, teal, at(0, 1.25, -0.35, { sx: 1.0, sy: 0.75, sz: 0.85 })));
  g.add(mesh(G.box, lam('#bfe7f2'), at(0, 1.35, -0.35, { sx: 0.9, sy: 0.4, sz: 0.88 })));
  g.add(mesh(G.cyl6, black, at(0.35, 1.3, 0.75, { sx: 0.08, sy: 0.6, sz: 0.08 })));
  for (const x of [-0.62, 0.62]) {
    g.add(mesh(G.cyl, black, at(x, 0.55, -0.45, { sx: 1.1, sy: 0.3, sz: 1.1, rz: Math.PI / 2 })));
    g.add(mesh(G.cyl, yellow, at(x * 1.04, 0.55, -0.45, { sx: 0.5, sy: 0.32, sz: 0.5, rz: Math.PI / 2 })));
    g.add(mesh(G.cyl, black, at(x, 0.35, 0.75, { sx: 0.7, sy: 0.25, sz: 0.7, rz: Math.PI / 2 })));
  }
  g.add(mesh(G.box, lam('#9aa3a8'), at(0, 0.3, -1.25, { sx: 1.4, sy: 0.25, sz: 0.4 })));
  if (livery) {
    const mat = sharpText(new THREE.MeshBasicMaterial({ map: livery.side }));
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), mat);
      plate.position.set(side * 0.56, 0.86, 0.58);
      plate.rotation.y = (side * Math.PI) / 2;
      g.add(plate);
    }
    // across the top of the bonnet, reading along the tractor (the farm's camera looks down on it)
    const top = new THREE.PlaneGeometry(0.94, 0.66);
    top.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
    const roof = new THREE.Mesh(top, sharpText(new THREE.MeshBasicMaterial({ map: livery.top })));
    roof.position.set(0, 1.056, 0.57);
    g.add(roof);
  }
  g.traverse(o => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return g;
}

/** Pickup items standing in the world (a sack, a bag, a sprayer, a watering can). */
export function makePickup(kind: 'seeds' | 'fertilizer' | 'sprayer' | 'water') {
  const g = new THREE.Group();
  if (kind === 'seeds' || kind === 'fertilizer') {
    const col = kind === 'seeds' ? '#d8bd8a' : '#f5f5f0';
    g.add(mesh(new THREE.SphereGeometry(0.42, 12, 10), lam(col), at(0, 0.45, 0, { sy: 1.15, sz: 0.85 })));
    g.add(mesh(G.cone6, lam(col), at(0, 0.98, 0, { sx: 0.28, sy: 0.22, sz: 0.28, rx: Math.PI })));
    if (kind === 'fertilizer') g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 12), lam('#3aa856'), at(0, 0.5, 0, { sz: 0.8 })));
    else for (let i = 0; i < 4; i++) g.add(mesh(G.sphere, lam('#f2c230'), at(-0.12 + (i % 2) * 0.24, 0.98, -0.05 + Math.floor(i / 2) * 0.1, { s: 0.09 })));
  } else if (kind === 'sprayer') {
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 14), lam('#f2c230'), at(0, 0.4, 0)));
    g.add(mesh(G.sphere, lam('#e0e0e0'), at(0, 0.82, 0, { s: 0.3 })));
    g.add(mesh(G.cyl6, lam('#444'), at(0.25, 0.7, 0.2, { sx: 0.04, sy: 0.8, sz: 0.04, rz: -0.7 })));
  } else {
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 14), lam('#3fa0e0'), at(0, 0.25, 0)));
    g.add(mesh(G.cyl6, lam('#3fa0e0'), at(0.32, 0.4, 0, { sx: 0.06, sy: 0.55, sz: 0.06, rz: -1.0 })));
    g.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12, Math.PI), lam('#2f86c4'), at(0, 0.52, 0)));
  }
  g.traverse(o => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return g;
}

/** The bouncing green arrow over the thing to pick up next. */
export function makeArrow() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#36d35b', emissive: '#1a7a2f' });
  g.add(mesh(G.box, m, at(0, 0.35, 0, { sx: 0.22, sy: 0.4, sz: 0.22 }), false));
  g.add(mesh(G.cone4, m, at(0, 0.0, 0, { sx: 0.6, sy: 0.35, sz: 0.6, rx: Math.PI, ry: Math.PI / 4 }), false));
  return g;
}

/* ---------------- the power yard (src/power) ---------------- */

/** One frame of three solar panels, tilted to the sun, centred at the origin (about 3.6 × 1.6). */
export function solarFrame(): Part[] {
  const out: Part[] = [];
  for (const x of [-1.6, 1.6]) out.push({ geo: G.box, color: '#8d9399', m: at(x, 0.45, 0.5, { sx: 0.1, sy: 0.9, sz: 0.1 }) }, { geo: G.box, color: '#8d9399', m: at(x, 0.85, -0.5, { sx: 0.1, sy: 1.7, sz: 0.1 }) });
  for (let i = 0; i < 3; i++) {
    out.push({ geo: G.box, color: '#c9d6e8', m: at(-1.2 + i * 1.2, 1.15, 0, { sx: 1.16, sy: 0.08, sz: 1.7, rx: -0.5 }) });
    out.push({ geo: G.box, color: '#22406e', m: at(-1.2 + i * 1.2, 1.2, 0.02, { sx: 1.04, sy: 0.04, sz: 1.56, rx: -0.5 }) });
  }
  return out;
}

/** The power hut: a small block room with the inverter on its wall. */
export function powerHut(): Part[] {
  return [
    { geo: G.box, color: '#e9e2d0', m: at(0, 1.0, 0, { sx: 2.2, sy: 2.0, sz: 1.8 }) },
    { geo: G.box, color: '#9aa3a8', m: at(0, 2.08, 0, { sx: 2.5, sy: 0.16, sz: 2.1, rx: 0.08 }) },
    { geo: G.box, color: '#6b7378', m: at(-0.45, 0.8, 0.91, { sx: 0.7, sy: 1.5, sz: 0.06 }) },
  ];
}
export function inverterBox(): Part[] {
  return [
    { geo: G.box, color: '#f5f5f0', m: at(0, 0, 0, { sx: 0.6, sy: 0.8, sz: 0.2 }) },
    { geo: G.box, color: '#2a6fd6', m: at(0, 0.18, 0.11, { sx: 0.4, sy: 0.16, sz: 0.02 }) },
    { geo: G.box, color: '#2e8b47', m: at(-0.14, -0.15, 0.11, { sx: 0.08, sy: 0.08, sz: 0.02 }) },
  ];
}
export function batteryBank(): Part[] {
  const out: Part[] = [{ geo: G.box, color: '#596066', m: at(0, 0.05, 0, { sx: 1.7, sy: 0.1, sz: 0.7 }) }];
  for (let i = 0; i < 4; i++) {
    out.push({ geo: G.box, color: '#2b2f33', m: at(-0.6 + i * 0.4, 0.45, 0, { sx: 0.34, sy: 0.7, sz: 0.55 }) });
    out.push({ geo: G.box, color: '#e2b23a', m: at(-0.6 + i * 0.4, 0.82, 0.1, { sx: 0.08, sy: 0.05, sz: 0.08 }) });
  }
  return out;
}
export function generatorSet(): Part[] {
  return [
    { geo: G.box, color: '#3a3f44', m: at(0, 0.08, 0, { sx: 1.9, sy: 0.16, sz: 1.0 }) },
    { geo: G.box, color: '#e0a312', m: at(0, 0.6, 0, { sx: 1.7, sy: 0.9, sz: 0.9 }) },
    { geo: G.box, color: '#2b2f33', m: at(-0.5, 0.62, 0.46, { sx: 0.5, sy: 0.5, sz: 0.04 }) },
    { geo: G.cyl, color: '#6b7378', m: at(0.6, 1.3, -0.2, { sx: 0.12, sy: 0.6, sz: 0.12 }) },
  ];
}
export function fuelTank(): Part[] {
  return [
    { geo: G.box, color: '#6b7378', m: at(-0.8, 0.3, 0, { sx: 0.12, sy: 0.6, sz: 0.9 }) },
    { geo: G.box, color: '#6b7378', m: at(0.8, 0.3, 0, { sx: 0.12, sy: 0.6, sz: 0.9 }) },
    { geo: G.cyl, color: '#c0392b', m: at(0, 0.95, 0, { sx: 1.0, sy: 2.2, sz: 1.0, rz: Math.PI / 2 }) },
    { geo: G.box, color: '#2b2f33', m: at(0.6, 1.5, 0, { sx: 0.2, sy: 0.15, sz: 0.2 }) },
  ];
}
/** A light pole: the bulb is drawn on its own (it glows at night). */
export function lampPole(): Part[] {
  return [
    { geo: G.cyl6, color: '#6b7378', m: at(0, 1.4, 0, { sx: 0.12, sy: 2.8, sz: 0.12 }) },
    { geo: G.box, color: '#6b7378', m: at(0, 2.8, 0.25, { sx: 0.08, sy: 0.08, sz: 0.6 }) },
    { geo: G.box, color: '#3a3f44', m: at(0, 2.76, 0.52, { sx: 0.3, sy: 0.1, sz: 0.24 }) },
  ];
}

/* ---------------- the cow shed (src/livestock) ---------------- */

/** The roofed shed: timber posts, an iron-sheet roof, a feed trough. Centred at the origin (about 5 × 3.4). */
export function roofedShed(): Part[] {
  const out: Part[] = [];
  for (const [x, z] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]]) out.push({ geo: G.cyl6, color: C.woodDark, m: at(x, 1.1, z, { sx: 0.18, sy: 2.2, sz: 0.18 }) });
  out.push({ geo: G.box, color: '#9aa3a8', m: at(0, 2.3, 0, { sx: 5.4, sy: 0.12, sz: 3.8, rx: 0.12 }) });
  out.push({ geo: G.box, color: C.woodPlank, m: at(0, 0.35, -1.5, { sx: 4.4, sy: 0.5, sz: 0.5 }) });
  out.push({ geo: G.box, color: C.hay, m: at(0, 0.62, -1.5, { sx: 4.2, sy: 0.08, sz: 0.4 }) });
  out.push({ geo: G.box, color: '#c9a85c', m: at(0, 0.04, 0.3, { sx: 4.6, sy: 0.06, sz: 2.4 }) });
  return out;
}
/** The zero-grazing unit: a concrete floor, block half-walls, troughs and a gutter into a tank. */
export function zeroGrazing(): Part[] {
  const out: Part[] = [{ geo: G.box, color: '#c8c6bf', m: at(0, 0.06, 0, { sx: 5.4, sy: 0.12, sz: 3.8 }) }];
  out.push({ geo: G.box, color: '#e3ddcf', m: at(0, 0.6, -1.8, { sx: 5.4, sy: 1.0, sz: 0.2 }) });
  out.push({ geo: G.box, color: '#e3ddcf', m: at(-2.6, 0.6, 0, { sx: 0.2, sy: 1.0, sz: 3.8 }) });
  out.push({ geo: G.box, color: '#e3ddcf', m: at(2.6, 0.6, 0, { sx: 0.2, sy: 1.0, sz: 3.8 }) });
  for (const [x, z] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]]) out.push({ geo: G.box, color: C.woodDark, m: at(x, 1.4, z, { sx: 0.22, sy: 2.8, sz: 0.22 }) });
  out.push({ geo: G.box, color: C.roofDark, m: at(0, 2.9, 0, { sx: 6.0, sy: 0.14, sz: 4.4, rx: 0.12 }) });
  out.push({ geo: G.box, color: '#9aa3a8', m: at(0, 2.55, 2.25, { sx: 6.0, sy: 0.14, sz: 0.2 }) });
  out.push({ geo: G.cyl, color: '#2a6fd6', m: at(3.3, 0.7, 2.0, { sx: 0.9, sy: 1.4, sz: 0.9 }) });
  out.push({ geo: G.box, color: '#8f9396', m: at(-1.0, 0.4, -1.4, { sx: 2.6, sy: 0.5, sz: 0.5 }) });
  out.push({ geo: G.box, color: C.water, m: at(1.7, 0.42, -1.4, { sx: 1.2, sy: 0.4, sz: 0.5 }) });
  return out;
}

/* ---------------- the greenhouse and the storehouse (src/greenhouse, src/storehouse) ---------------- */

/** A name board over a building's door: a title and a line under it. */
export function nameBoardTexture(title: string, sub: string, color: string) {
  return textTex(256, 96, g => {
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#fffaf0';
    g.fillRect(6, 6, 244, 84);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 34px Poppins, Arial, sans-serif';
    g.fillText(title, 128, 38);
    g.fillStyle = '#5a4a3a';
    g.font = 'bold 20px Poppins, Arial, sans-serif';
    g.fillText(sub, 128, 72);
  });
}

/** Glass: see-through panes, drawn after the solid things so the beds and shelves show through. */
export const glassMaterial = (opacity = 0.24) =>
  new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });

/** A gable end: a flat triangle in the y–z plane (base d wide, rise high), at x. */
function gable(x: number, y: number, d: number, rise: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2, 0);
  sh.lineTo(d / 2, 0);
  sh.lineTo(0, rise);
  sh.closePath();
  return new THREE.ShapeGeometry(sh).rotateY(Math.PI / 2).translate(x, y, 0);
}

/** A glass building's frame and panes, built at the origin: w along x, d along z, walls h high, a gable roof rising
    `rise` along x. `door`: the wall with the door (+x or -z) and where along it, left open. `plinth`: a solid low wall. */
export function glassHouse(o: { w: number; d: number; h: number; rise: number; frame: string; glass: string; door: { side: 'x+' | 'z-'; at: number; width: number }; plinth?: { h: number; color: string } }) {
  const { w, d, h, rise } = o;
  const frame: Part[] = [];
  const glass: Part[] = [];
  const post = (x: number, z: number, hh = h) => frame.push({ geo: G.box, color: o.frame, m: at(x, hh / 2, z, { sx: 0.07, sy: hh, sz: 0.07 }) });
  const p0 = o.plinth?.h ?? 0;
  const inDoor = (side: 'x+' | 'z-', t: number) => o.door.side === side && Math.abs(t - o.door.at) < o.door.width / 2;
  // walls: a pane between each pair of posts (about 1.25 apart), the door's gap left open
  const along = (len: number) => {
    const n = Math.max(2, Math.round(len / 1.25));
    return Array.from({ length: n + 1 }, (_, i) => -len / 2 + (i * len) / n);
  };
  const xs = along(w);
  const zs = along(d);
  for (const x of xs) {
    post(x, -d / 2);
    post(x, d / 2);
  }
  for (const z of zs.slice(1, -1)) {
    post(-w / 2, z);
    post(w / 2, z);
  }
  const wallY = p0 + (h - p0) / 2;
  const wallH = h - p0;
  const pane = (cx: number, cz: number, len: number, alongX: boolean) =>
    glass.push({ geo: G.box, color: o.glass, m: at(cx, wallY, cz, alongX ? { sx: len, sy: wallH, sz: 0.02 } : { sx: 0.02, sy: wallH, sz: len }) });
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    const len = xs[i + 1] - xs[i];
    pane(cx, d / 2, len, true);
    if (inDoor('z-', cx)) continue;
    pane(cx, -d / 2, len, true);
  }
  for (let i = 0; i < zs.length - 1; i++) {
    const cz = (zs[i] + zs[i + 1]) / 2;
    const len = zs[i + 1] - zs[i];
    pane(-w / 2, cz, len, false);
    if (inDoor('x+', cz)) continue;
    pane(w / 2, cz, len, false);
  }
  // the door: its frame, and the door itself swung open against the wall
  const dw = o.door.width;
  if (o.door.side === 'x+') {
    post(w / 2, o.door.at - dw / 2, h);
    post(w / 2, o.door.at + dw / 2, h);
    frame.push({ geo: G.box, color: o.frame, m: at(w / 2 + 0.35, h * 0.45, o.door.at + dw / 2 + 0.02, { sx: 0.7, sy: h * 0.9, sz: 0.04 }) });
    glass.push({ geo: G.box, color: o.glass, m: at(w / 2 + 0.35, h * 0.45, o.door.at + dw / 2 + 0.05, { sx: 0.6, sy: h * 0.8, sz: 0.02 }) });
  } else {
    post(o.door.at - dw / 2, -d / 2, h);
    post(o.door.at + dw / 2, -d / 2, h);
    frame.push({ geo: G.box, color: o.frame, m: at(o.door.at + dw / 2 + 0.02, h * 0.45, -d / 2 - 0.35, { sx: 0.04, sy: h * 0.9, sz: 0.7 }) });
  }
  // the plinth: a low solid wall, the door's gap left open
  if (o.plinth) {
    const pl = o.plinth;
    const run = (x0: number, x1: number, z0: number, z1: number) => frame.push({ geo: G.box, color: pl.color, m: at((x0 + x1) / 2, pl.h / 2, (z0 + z1) / 2, { sx: Math.max(0.12, x1 - x0), sy: pl.h, sz: Math.max(0.12, z1 - z0) }) });
    run(-w / 2, w / 2, d / 2, d / 2);
    run(-w / 2, -w / 2, -d / 2, d / 2);
    if (o.door.side === 'z-') {
      run(-w / 2, o.door.at - dw / 2, -d / 2, -d / 2);
      run(o.door.at + dw / 2, w / 2, -d / 2, -d / 2);
      run(w / 2, w / 2, -d / 2, d / 2);
    } else {
      run(-w / 2, w / 2, -d / 2, -d / 2);
      run(w / 2, w / 2, -d / 2, o.door.at - dw / 2);
      run(w / 2, w / 2, o.door.at + dw / 2, d / 2);
    }
  }
  // the eaves along the long sides, and the rails over the ends
  frame.push({ geo: G.box, color: o.frame, m: at(0, h, -d / 2, { sx: w + 0.08, sy: 0.07, sz: 0.07 }) });
  frame.push({ geo: G.box, color: o.frame, m: at(0, h, d / 2, { sx: w + 0.08, sy: 0.07, sz: 0.07 }) });
  frame.push({ geo: G.box, color: o.frame, m: at(-w / 2, h, 0, { sx: 0.07, sy: 0.07, sz: d }) });
  frame.push({ geo: G.box, color: o.frame, m: at(w / 2, h, 0, { sx: 0.07, sy: 0.07, sz: d }) });
  // the roof: two sloped panes meeting at a ridge along x, a rafter over every post
  const half = d / 2;
  const slope = Math.hypot(half, rise);
  const tilt = Math.atan2(rise, half);
  frame.push({ geo: G.box, color: o.frame, m: at(0, h + rise, 0, { sx: w + 0.1, sy: 0.07, sz: 0.07 }) });
  for (const x of xs) {
    frame.push({ geo: G.box, color: o.frame, m: at(x, h + rise / 2, -half / 2, { sx: 0.06, sy: 0.06, sz: slope, rx: tilt }) });
    frame.push({ geo: G.box, color: o.frame, m: at(x, h + rise / 2, half / 2, { sx: 0.06, sy: 0.06, sz: slope, rx: -tilt }) });
  }
  glass.push({ geo: G.box, color: o.glass, m: at(0, h + rise / 2, -half / 2, { sx: w, sy: 0.02, sz: slope, rx: tilt }) });
  glass.push({ geo: G.box, color: o.glass, m: at(0, h + rise / 2, half / 2, { sx: w, sy: 0.02, sz: slope, rx: -tilt }) });
  glass.push({ geo: gable(-w / 2, h, d, rise), color: o.glass });
  glass.push({ geo: gable(w / 2, h, d, rise), color: o.glass });
  return { frame, glass };
}

/** The storage annex beside the storehouse, built at the origin like a big upright freezer: w along x, d along z, h
    high. A white insulated cabinet with rounded corners and panel seams on a grey kick plate, a dark control strip
    across the top of the front (the name board and the display go on it), one big freezer door on the front (+z) with
    an ice-blue gasket, chrome hinges and a lever latch, frost along its foot, icicles under the lip, and the
    condenser on the roof (a fan in a grille, copper pipes down the side). */
export const FREEZER = { strip: 0.42, doorW: 1.5, doorH: 1.48 };
export function freezerAnnex(o: { w: number; d: number; h: number }): Part[] {
  const { w, d, h } = o;
  const r = 0.14;
  const white = '#f2f6f8';
  const seam = '#d3dde3';
  const chrome = '#c9d2d8';
  const chromeDark = '#8e9aa3';
  const ice = '#bfe7fb';
  const frost = '#e6f6ff';
  const kick = 0.14;
  const out: Part[] = [
    // a concrete pad, and the grey kick plate the cabinet stands on
    { geo: G.box, color: '#bdbdb6', m: at(0, 0.03, 0, { sx: w + 0.3, sy: 0.06, sz: d + 0.3 }) },
    { geo: G.box, color: '#9aa4ab', m: at(0, 0.06 + kick / 2, 0, { sx: w - 0.06, sy: kick, sz: d - 0.06 }) },
  ];
  // the cabinet: two crossed boxes and a post at each corner, so its vertical edges are round
  const y0 = 0.06 + kick;
  const bh = h - y0;
  out.push({ geo: G.box, color: white, m: at(0, y0 + bh / 2, 0, { sx: w - 2 * r, sy: bh, sz: d }) });
  out.push({ geo: G.box, color: white, m: at(0, y0 + bh / 2, 0, { sx: w, sy: bh, sz: d - 2 * r }) });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ geo: G.cyl, color: white, m: at(sx * (w / 2 - r), y0 + bh / 2, sz * (d / 2 - r), { sx: 2 * r, sy: bh, sz: 2 * r }) });
  // a lid a little proud of the walls, its edge rounded too
  out.push({ geo: G.box, color: '#e4ebef', m: at(0, h + 0.04, 0, { sx: w - 2 * r + 0.04, sy: 0.08, sz: d + 0.04 }) });
  out.push({ geo: G.box, color: '#e4ebef', m: at(0, h + 0.04, 0, { sx: w + 0.04, sy: 0.08, sz: d - 2 * r + 0.04 }) });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ geo: G.cyl, color: '#e4ebef', m: at(sx * (w / 2 - r), h + 0.04, sz * (d / 2 - r), { sx: 2 * r + 0.04, sy: 0.08, sz: 2 * r + 0.04 }) });
  // the insulated panels' seams on the sides and the back
  for (const z of [-d / 6, d / 6]) for (const sx of [-1, 1]) out.push({ geo: G.box, color: seam, m: at(sx * (w / 2 + 0.005), y0 + bh / 2, z, { sx: 0.01, sy: bh - 0.1, sz: 0.035 }) });
  for (const x of [-w / 4, 0, w / 4]) out.push({ geo: G.box, color: seam, m: at(x, y0 + bh / 2, -d / 2 - 0.005, { sx: 0.035, sy: bh - 0.1, sz: 0.01 }) });
  // the control strip across the top of the front
  const fz = d / 2;
  const st = FREEZER.strip;
  out.push({ geo: G.box, color: '#28394a', m: at(0, h - st / 2 - 0.04, fz + 0.01, { sx: w - 2 * r, sy: st, sz: 0.03 }) });
  out.push({ geo: G.box, color: chrome, m: at(0, h - st - 0.05, fz + 0.02, { sx: w - 2 * r, sy: 0.03, sz: 0.03 }) });
  // the freezer door: a slab proud of the front, an ice-blue gasket round it
  const dw = FREEZER.doorW;
  const dh = FREEZER.doorH;
  const dy = y0 + 0.04 + dh / 2;
  const dz = fz + 0.06;
  out.push({ geo: G.box, color: ice, m: at(0, dy, fz + 0.02, { sx: dw + 0.08, sy: dh + 0.08, sz: 0.04 }) });
  out.push({ geo: G.box, color: '#fbfdfe', m: at(0, dy, dz, { sx: dw, sy: dh, sz: 0.08 }) });
  // a raised panel on the door, and a window of frosted glass up top
  out.push({ geo: G.box, color: '#eef3f6', m: at(0, dy - 0.15, dz + 0.045, { sx: dw - 0.3, sy: dh - 0.75, sz: 0.01 }) });
  out.push({ geo: G.box, color: chromeDark, m: at(0, dy + dh / 2 - 0.3, dz + 0.045, { sx: 0.6, sy: 0.32, sz: 0.012 }) });
  out.push({ geo: G.box, color: '#a9dcf3', m: at(0, dy + dh / 2 - 0.3, dz + 0.05, { sx: 0.52, sy: 0.24, sz: 0.012 }) });
  // chrome hinges on the left edge, and the lever latch with its handle bar on the right
  for (const hy of [dy - dh / 2 + 0.3, dy + dh / 2 - 0.3]) {
    out.push({ geo: G.box, color: chrome, m: at(-dw / 2 + 0.06, hy, dz + 0.06, { sx: 0.22, sy: 0.16, sz: 0.05 }) });
    out.push({ geo: G.cyl, color: chromeDark, m: at(-dw / 2 - 0.02, hy, dz + 0.06, { sx: 0.07, sy: 0.2, sz: 0.07 }) });
  }
  const lx = dw / 2 - 0.22;
  out.push({ geo: G.box, color: chromeDark, m: at(lx, dy + 0.05, dz + 0.055, { sx: 0.16, sy: 0.3, sz: 0.04 }) });
  out.push({ geo: G.box, color: chrome, m: at(lx - 0.02, dy + 0.12, dz + 0.1, { sx: 0.07, sy: 0.07, sz: 0.1 }) });
  out.push({ geo: G.box, color: chrome, m: at(lx - 0.02, dy - 0.08, dz + 0.12, { sx: 0.06, sy: 0.42, sz: 0.05, rz: 0.2 }) });
  // a long pull bar beside the latch, on two stand-offs
  for (const by of [dy - 0.45, dy + 0.45]) out.push({ geo: G.box, color: chromeDark, m: at(dw / 2 - 0.08, by, dz + 0.08, { sx: 0.04, sy: 0.04, sz: 0.1 }) });
  out.push({ geo: G.cyl, color: chrome, m: at(dw / 2 - 0.08, dy, dz + 0.13, { sx: 0.06, sy: 1.0, sz: 0.06 }) });
  // a kick plate on the door's foot, frost along it, and frost on the door's top corners
  out.push({ geo: G.box, color: chrome, m: at(0, y0 + 0.14, dz + 0.045, { sx: dw - 0.06, sy: 0.18, sz: 0.012 }) });
  out.push({ geo: G.box, color: frost, m: at(0, 0.075, fz + 0.06, { sx: w - 0.2, sy: 0.03, sz: 0.1 }) });
  for (const x of [-w / 2 + 0.3, -dw / 2 - 0.05, dw / 2 + 0.1, w / 2 - 0.35]) out.push({ geo: G.sphere, color: '#f7fcff', m: at(x, 0.08, fz + 0.07, { sx: 0.22, sy: 0.06, sz: 0.1 }) });
  for (const sx of [-1, 1]) out.push({ geo: G.sphere, color: frost, m: at(sx * (dw / 2 - 0.05), dy + dh / 2 - 0.02, dz + 0.04, { sx: 0.28, sy: 0.1, sz: 0.06 }) });
  // icicles under the lid's front lip
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.2 + (i * (w - 0.4)) / 8;
    const len = 0.05 + ((i * 37) % 5) * 0.015;
    out.push({ geo: G.cone6, color: i % 2 ? ice : frost, m: at(x, h - len / 2, fz + 0.05, { sx: 0.06, sy: len, sz: 0.06, rx: Math.PI }) });
  }
  // the condenser on the roof: a grey box, its fan in a round grille, louvres along the side
  const cx = -w / 2 + 0.75;
  const cz = -d / 2 + 0.7;
  const cy = h + 0.08;
  out.push({ geo: G.box, color: '#a8b1b8', m: at(cx, cy + 0.3, cz, { sx: 1.1, sy: 0.6, sz: 0.9 }) });
  out.push({ geo: G.box, color: '#8d969d', m: at(cx, cy + 0.62, cz, { sx: 1.14, sy: 0.04, sz: 0.94 }) });
  out.push({ geo: G.cyl, color: '#3b4650', m: at(cx, cy + 0.65, cz, { sx: 0.66, sy: 0.03, sz: 0.66 }) });
  out.push({ geo: G.cyl, color: chrome, m: at(cx, cy + 0.67, cz, { sx: 0.14, sy: 0.03, sz: 0.14 }) });
  for (let i = 0; i < 3; i++) out.push({ geo: G.box, color: '#6c7780', m: at(cx, cy + 0.665, cz, { sx: 0.56, sy: 0.015, sz: 0.1, ry: (i * Math.PI) / 3 }) });
  for (const t of [-0.3, 0, 0.3]) out.push({ geo: G.box, color: chrome, m: at(cx, cy + 0.67, cz + t, { sx: 0.62, sy: 0.012, sz: 0.012 }) });
  for (let i = 0; i < 4; i++) out.push({ geo: G.box, color: '#7d878f', m: at(cx + 0.556, cy + 0.15 + i * 0.11, cz, { sx: 0.01, sy: 0.04, sz: 0.7 }) });
  // a second, smaller unit and a junction box beside it
  out.push({ geo: G.box, color: '#b8c0c6', m: at(w / 2 - 0.55, cy + 0.18, -d / 2 + 0.5, { sx: 0.6, sy: 0.36, sz: 0.5 }) });
  out.push({ geo: G.cyl, color: '#3b4650', m: at(w / 2 - 0.55, cy + 0.37, -d / 2 + 0.5, { sx: 0.36, sy: 0.02, sz: 0.36 }) });
  // copper pipes from the condenser over the edge and down the right-hand wall
  const copper = '#c47a3a';
  const px = w / 2 + 0.04;
  for (const pz of [-d / 2 + 0.35, -d / 2 + 0.5]) {
    out.push({ geo: G.cyl6, color: copper, m: at(px, (y0 + h) / 2, pz, { sx: 0.05, sy: h - y0, sz: 0.05 }) });
    out.push({ geo: G.cyl6, color: copper, m: at(px - 0.2, h + 0.12, pz, { sx: 0.05, sy: 0.45, sz: 0.05, rz: Math.PI / 2 }) });
  }
  out.push({ geo: G.box, color: '#e4ebef', m: at(px + 0.02, y0 + 0.5, -d / 2 + 0.42, { sx: 0.06, sy: 0.3, sz: 0.3 }) });
  return out;
}

/** The storage freezer's display: a blue screen with the temperature, and a green light. */
export function freezerDisplayTexture() {
  return textTex(256, 96, g => {
    g.fillStyle = '#0d1a26';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#0f3550';
    g.beginPath();
    g.roundRect(10, 12, 170, 72, 10);
    g.fill();
    g.fillStyle = '#7fe0ff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 46px Poppins, Arial, sans-serif';
    g.fillText('-18°C', 95, 50);
    g.fillStyle = '#41d96b';
    g.beginPath();
    g.arc(218, 34, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7fe0ff';
    g.beginPath();
    g.arc(218, 66, 9, 0, Math.PI * 2);
    g.fill();
  });
}

/** The greenhouse's raised bed: soil in a wooden edge, w × d. */
export function raisedBed(w: number, d: number): Part[] {
  return [
    { geo: G.box, color: '#a8794c', m: at(0, 0.11, 0, { sx: w, sy: 0.22, sz: d }) },
    { geo: G.box, color: C.soilDark, m: at(0, 0.2, 0, { sx: w - 0.12, sy: 0.06, sz: d - 0.12 }) },
  ];
}

/** One plant of a greenhouse crop at a stage (0 just planted … 3 ready), standing on a bed's soil. */
export function greenhousePlant(crop: string, stage: number, seed: number): Part[] {
  const g = 0.45 + 0.2 * stage;
  const out: Part[] = [];
  const ripe = stage === 3;
  const turn = seed * 1.7;
  if (crop === 'tomatoes' || crop === 'cucumber') {
    // a vine up its string: taller each stage
    const tall = 0.25 + stage * 0.28;
    const leaf = crop === 'tomatoes' ? '#4c8f2a' : '#5aa83a';
    out.push({ geo: G.cyl6, color: '#5e8f2c', m: at(0, tall / 2, 0, { sx: 0.035, sy: tall, sz: 0.035 }) });
    for (let i = 0; i < 2 + stage; i++) out.push({ geo: G.ico1, color: i % 2 ? leaf : '#3f7d22', m: at(Math.cos(turn + i * 2.3) * 0.08, 0.12 + (i * tall) / (2 + stage), Math.sin(turn + i * 2.3) * 0.08, { s: 0.16 + 0.03 * stage }) });
    if (stage >= 2)
      for (let i = 0; i < 3; i++) {
        const y = 0.2 + i * 0.18;
        if (crop === 'tomatoes') out.push({ geo: G.sphere, color: ripe ? '#e2382a' : '#9acd52', m: at(Math.cos(turn + i * 2.1) * 0.1, y, Math.sin(turn + i * 2.1) * 0.1, { s: 0.09 }) });
        else out.push({ geo: G.cyl6, color: ripe ? '#2f7a32' : '#7cbf5a', m: at(Math.cos(turn + i * 2.1) * 0.1, y, Math.sin(turn + i * 2.1) * 0.1, { sx: 0.06, sy: ripe ? 0.2 : 0.12, sz: 0.06 }) });
      }
    return out;
  }
  if (crop === 'strawberries') {
    for (let i = 0; i < 5; i++) out.push({ geo: G.sphere, color: i % 2 ? '#3f8a2a' : '#4fa03a', m: at(Math.sin(i * 1.26) * 0.08 * g, 0.05, Math.cos(i * 1.26) * 0.08 * g, { sx: 0.13 * g, sy: 0.05, sz: 0.18 * g, ry: i * 1.26 }) });
    if (stage >= 1) for (let i = 0; i < 2; i++) out.push({ geo: G.sphere, color: '#ffffff', m: at(Math.cos(turn + i * 3) * 0.1, 0.09, Math.sin(turn + i * 3) * 0.1, { s: 0.05 }) });
    if (stage >= 2) for (let i = 0; i < 3; i++) out.push({ geo: G.cone6, color: ripe ? '#e0364a' : '#c8e08a', m: at(Math.cos(turn + i * 2.1) * 0.15, 0.06, Math.sin(turn + i * 2.1) * 0.15, { s: 0.08, rx: Math.PI }) });
    return out;
  }
  // capsicum and chillies: a bushy plant, the fruit hanging under the leaves
  const leaf = crop === 'capsicum' ? '#3f9a3a' : '#4c8f2a';
  out.push({ geo: G.cyl6, color: '#5e8f2c', m: at(0, 0.12 * g, 0, { sx: 0.04, sy: 0.24 * g, sz: 0.04 }) });
  out.push({ geo: G.ico1, color: leaf, m: at(0, 0.3 * g, 0, { s: 0.34 * g }) });
  out.push({ geo: G.ico, color: '#5fae3a', m: at(0.06, 0.4 * g, 0.04, { s: 0.2 * g }) });
  if (stage >= 2)
    for (let i = 0; i < 3; i++) {
      const c = crop === 'capsicum' ? (ripe ? ['#e2382a', '#f2c230', '#3f9a3a'][i] : '#7cbf5a') : ripe ? '#d42a1e' : '#6aa336';
      const geo = crop === 'capsicum' ? G.sphere : G.cone6;
      const sz = crop === 'capsicum' ? { sx: 0.12, sy: 0.14, sz: 0.12 } : { sx: 0.04, sy: 0.14, sz: 0.04, rx: Math.PI };
      out.push({ geo, color: c, m: at(Math.cos(turn + i * 2.1) * 0.15 * g, 0.2 * g, Math.sin(turn + i * 2.1) * 0.15 * g, sz) });
    }
  return out;
}

/** The storehouse's shelves: a stepped rack w long (along x), a low tier in front (+z) and a high tier behind, so
    what stands on both shows from above. */
export const SHELF = { low: { y: 0.27, z: 0.13 }, high: { y: 0.57, z: -0.13 } };
export function shelfUnit(w: number): Part[] {
  const out: Part[] = [];
  for (const x of [-w / 2, w / 2]) {
    out.push({ geo: G.box, color: C.woodDark, m: at(x, SHELF.low.y / 2, SHELF.low.z + 0.1, { sx: 0.05, sy: SHELF.low.y, sz: 0.05 }) });
    out.push({ geo: G.box, color: C.woodDark, m: at(x, SHELF.high.y / 2, SHELF.high.z - 0.1, { sx: 0.05, sy: SHELF.high.y, sz: 0.05 }) });
  }
  out.push({ geo: G.box, color: C.woodPlank, m: at(0, SHELF.low.y - 0.02, SHELF.low.z, { sx: w, sy: 0.04, sz: 0.26 }) });
  out.push({ geo: G.box, color: C.woodPlank, m: at(0, SHELF.high.y - 0.02, SHELF.high.z, { sx: w, sy: 0.04, sz: 0.26 }) });
  return out;
}

/** A crate of produce (on a shelf or the floor): its slats, and the produce heaped in it. */
export function crate(fill: string): Part[] {
  return [
    { geo: G.box, color: '#c98a4a', m: at(0, 0.09, 0, { sx: 0.34, sy: 0.18, sz: 0.26 }) },
    { geo: G.box, color: '#a8682e', m: at(0, 0.13, 0, { sx: 0.36, sy: 0.03, sz: 0.28 }) },
    { geo: G.sphere, color: fill, m: at(0, 0.18, 0, { sx: 0.3, sy: 0.1, sz: 0.22 }) },
  ];
}

/** A sack of grain or beans. */
export const sack = (color: string): Part[] => [
  { geo: G.sphere, color, m: at(0, 0.16, 0, { sx: 0.3, sy: 0.34, sz: 0.24 }) },
  { geo: G.cyl6, color: '#8a6d3b', m: at(0, 0.34, 0, { sx: 0.08, sy: 0.06, sz: 0.08 }) },
];

/** A jar or bottle of what the storehouse makes: glass, the colour of what is inside, a lid. */
export const jar = (fill: string, tall = false): Part[] => [
  { geo: G.cyl, color: fill, m: at(0, tall ? 0.1 : 0.07, 0, { sx: 0.09, sy: tall ? 0.2 : 0.14, sz: 0.09 }) },
  { geo: G.cyl, color: '#d9d9d9', m: at(0, tall ? 0.21 : 0.15, 0, { sx: tall ? 0.04 : 0.1, sy: 0.03, sz: tall ? 0.04 : 0.1 }) },
];

/** The storehouse's work table: a pot on a burner, jars waiting, a chopping board. */
export function workTable(): Part[] {
  return [
    { geo: G.box, color: C.woodPlank, m: at(0, 0.5, 0, { sx: 1.2, sy: 0.06, sz: 0.6 }) },
    ...[-0.55, 0.55].flatMap(x => [-0.25, 0.25].map(z => ({ geo: G.box, color: C.woodDark, m: at(x, 0.25, z, { sx: 0.05, sy: 0.5, sz: 0.05 }) }))),
    { geo: G.cyl, color: '#4a4a4a', m: at(-0.3, 0.57, 0, { sx: 0.3, sy: 0.08, sz: 0.3 }) },
    { geo: G.cyl, color: '#9aa3a8', m: at(-0.3, 0.7, 0, { sx: 0.32, sy: 0.22, sz: 0.32 }) },
    { geo: G.cyl, color: '#c4302b', m: at(-0.3, 0.8, 0, { sx: 0.28, sy: 0.02, sz: 0.28 }) },
    { geo: G.box, color: '#e8c99a', m: at(0.3, 0.55, 0.1, { sx: 0.34, sy: 0.03, sz: 0.24 }) },
    ...place(jar('#c4302b'), at(0.3, 0.53, -0.15)),
    ...place(jar('#e0364a'), at(0.45, 0.53, -0.15)),
  ];
}
