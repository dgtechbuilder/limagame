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
  return canvasTex(256, 256, g => {
    g.clearRect(0, 0, 256, 256);
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
  return canvasTex(128, 128, g => {
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
export function signTexture(n: number) {
  return canvasTex(128, 128, g => {
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

/** A fence from (x0, z0) to (x1, z1), a post every ~1.8 units. */
export function fence(x0: number, z0: number, x1: number, z1: number): Part[] {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.8));
  const ry = -Math.atan2(z1 - z0, x1 - x0);
  const out: Part[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const z = z0 + ((z1 - z0) * i) / n;
    out.push(...place(fencePost(), at(x, 0, z)));
    if (i < n) out.push(...place(fenceRail(len / n), at(x + (x1 - x0) / n / 2, 0, z + (z1 - z0) / n / 2, { ry })));
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

export function trough(): Part[] {
  return [
    { geo: G.box, color: '#8b5a2b', m: at(0, 0.3, 0, { sx: 1.8, sy: 0.5, sz: 0.6 }) },
    { geo: G.box, color: C.hay, m: at(0, 0.52, 0, { sx: 1.6, sy: 0.1, sz: 0.45 }) },
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
  tools: Record<'hoe' | 'sickle' | 'can' | 'wand', THREE.Object3D>;
  loads: Record<'seeds' | 'fertilizer' | 'sprayer', THREE.Object3D>;
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
  const tools = { hoe, sickle, can, wand };
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
  const loads = { seeds: sack('#d8bd8a'), fertilizer: sack('#f5f5f0', '#3aa856'), sprayer: tank };
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

export function makeTractor() {
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
