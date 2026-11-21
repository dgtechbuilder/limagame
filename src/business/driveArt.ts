/* The drawing for the business day's drive (DayDrive.tsx): the farms from above with their crop rows, the murram road
   between them, the tractor and its implements, and the dust and smoke. Nothing here changes the game (drive.ts);
   it only paints it. Everything is drawn in game pixels on canvases K times as sharp.

   The look follows a top-down farm illustration: bright grass, crop rows as bushy green hedges and brown furrows,
   round trees and palms, a pond, a barn roof, and a red-brown murram road. Each field is painted twice up front —
   as it is, and as it will be once worked — and the implement reveals the second as it passes, so the worked strip
   follows the tractor's real path. */

import type { BizTool } from './model';
import { HAUL_X, LANES, LANE_H, ROAD_TOP, VIEW_H, VIEW_W, implementBar, laneY, seeded, type FieldDrive, type HaulDrive, type Hole, type Obstacle, type Pt } from './drive';

/** canvas pixels per game pixel: sharp on phones and when the stage is scaled up */
export const K = 2;

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

function layer(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * K);
  cv.height = Math.ceil(h * K);
  const c = cv.getContext('2d')!;
  c.setTransform(K, 0, 0, K, 0, 0);
  return [cv, c];
}

const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];
function dots(c: Ctx, r: Rng, w: number, h: number, n: number, colors: string[], s0: number, s1: number) {
  // one colour at a time: far fewer state changes than a colour per speck
  const each = Math.ceil(n / colors.length);
  for (const color of colors) {
    c.fillStyle = color;
    for (let i = 0; i < each; i++) {
      const s = s0 + r() * (s1 - s0);
      c.fillRect(r() * w, r() * h, s, s * (0.6 + r() * 0.6));
    }
  }
}
function blob(c: Ctx, x: number, y: number, rx: number, ry: number, color: string, rot = 0) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fill();
}

/* ---------------- field textures: the rows before and after the work ---------------- */

type Tex = 'stubble' | 'furrow' | 'clods' | 'tilth' | 'tilled' | 'ridges' | 'seeded' | 'green' | 'fert' | 'gold' | 'cut';
/** what each tool's field looks like before it, and after it */
const LOOK: Record<BizTool, [Tex, Tex]> = {
  plough: ['stubble', 'furrow'],
  harrow: ['clods', 'tilth'],
  ridger: ['tilled', 'ridges'],
  planter: ['tilled', 'seeded'],
  spreader: ['green', 'fert'],
  harvester: ['gold', 'cut'],
  combine: ['gold', 'cut'],
  trailer: ['tilled', 'tilth'],
};
/** the soil's colour under each look, for the dust */
export const DUST: Record<BizTool, string> = { plough: '#8a5d38', harrow: '#b08458', ridger: '#8d6240', planter: '#a27a52', spreader: '#e9e4cf', harvester: '#d8c38a', combine: '#d8c38a', trailer: '#c79c63' };

/** a wobbly line along a row, so the rows look hand-drawn rather than ruled */
function rowLine(c: Ctx, r: Rng, w: number, y: number, amp: number) {
  c.beginPath();
  c.moveTo(-2, y);
  for (let x = 10; x <= w + 12; x += 10) c.lineTo(x, y + (r() - 0.5) * amp);
  c.stroke();
}

/** A bushy hedge of crop along a row, as in the illustration: scalloped edges, leaf highlights. */
function hedgeRow(c: Ctx, r: Rng, w: number, y: number, hh: number, base: string, dark: string, light: string) {
  c.fillStyle = base;
  c.fillRect(0, y - hh / 2, w, hh);
  for (let x = 0; x < w + 4; x += 3 + r() * 2) {
    blob(c, x, y - hh / 2 + 0.5, 2 + r() * 1.4, 1.8 + r(), base);
    blob(c, x + 1.5, y + hh / 2 - 0.5, 2 + r() * 1.4, 1.8 + r(), base);
  }
  for (let x = 0; x < w; x += 2.2) {
    if (r() < 0.55) blob(c, x + r() * 2, y + (r() - 0.5) * (hh - 1), 0.9 + r() * 0.6, 0.7, light);
    if (r() < 0.35) blob(c, x + r() * 2, y + (r() - 0.5) * hh, 0.8, 0.6, dark);
  }
}

function paintTex(c: Ctx, tex: Tex, w: number, h: number, seed: string) {
  const r = seeded(`tex:${tex}:${seed}`);
  c.lineCap = 'round';
  switch (tex) {
    case 'stubble': {
      c.fillStyle = '#c8a974';
      c.fillRect(0, 0, w, h);
      dots(c, r, w, h, w * h * 0.05, ['#b9996a', '#d4b884', '#bfa070'], 1, 2.4);
      for (let y = 4; y < h; y += 8) {
        c.strokeStyle = 'rgba(140,108,62,0.35)';
        c.lineWidth = 1;
        rowLine(c, r, w, y, 0.8);
        for (let x = r() * 4; x < w; x += 3 + r() * 3) {
          c.fillStyle = r() < 0.5 ? '#e6d29a' : '#a88a55';
          c.fillRect(x, y - 1.2 + r(), 0.9, 1.8);
        }
      }
      for (let i = 0; i < w * h * 0.004; i++) {
        const x = r() * w;
        const y = r() * h;
        for (let k = 0; k < 4; k++) blob(c, x + (r() - 0.5) * 3, y + (r() - 0.5) * 2, 1, 0.7, r() < 0.5 ? '#8fae4a' : '#a6c25a');
      }
      break;
    }
    case 'furrow': {
      c.fillStyle = '#6a4226';
      c.fillRect(0, 0, w, h);
      for (let y = 1; y < h; y += 5) {
        c.strokeStyle = '#4b2c16';
        c.lineWidth = 1.6;
        rowLine(c, r, w, y, 0.9);
        c.strokeStyle = '#8b5a36';
        c.lineWidth = 1.1;
        rowLine(c, r, w, y + 2.5, 0.9);
      }
      for (let i = 0; i < w * h * 0.02; i++) blob(c, r() * w, r() * h, 0.8 + r() * 1.3, 0.6 + r() * 0.8, r() < 0.6 ? '#573419' : '#9a6a42', r());
      break;
    }
    case 'clods': {
      c.fillStyle = '#7a4f30';
      c.fillRect(0, 0, w, h);
      for (let y = 2; y < h; y += 6) {
        c.strokeStyle = 'rgba(70,40,20,0.6)';
        c.lineWidth = 1.4;
        rowLine(c, r, w, y, 1.4);
      }
      for (let i = 0; i < w * h * 0.022; i++) {
        const x = r() * w;
        const y = r() * h;
        const s = 1 + r() * 2.4;
        blob(c, x + 0.5, y + 0.6, s, s * 0.75, '#4f3019', r());
        blob(c, x, y, s, s * 0.75, r() < 0.5 ? '#8e5f3a' : '#6f4629', r());
        blob(c, x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.3, '#a8784e');
      }
      break;
    }
    case 'tilth': {
      c.fillStyle = '#a77b4f';
      c.fillRect(0, 0, w, h);
      dots(c, r, w, h, w * h * 0.14, ['#97693f', '#b98d5e', '#9e7246', '#c29766'], 0.6, 1.3);
      c.strokeStyle = 'rgba(120,84,48,0.35)';
      c.lineWidth = 0.8;
      for (let y = 1.5; y < h; y += 3.5) rowLine(c, r, w, y, 0.5);
      break;
    }
    case 'tilled': {
      c.fillStyle = '#9b6f48';
      c.fillRect(0, 0, w, h);
      dots(c, r, w, h, w * h * 0.09, ['#8a603c', '#ab7f55', '#93683f'], 0.7, 1.6);
      c.strokeStyle = 'rgba(95,62,34,0.45)';
      c.lineWidth = 1.1;
      for (let y = 3; y < h; y += 7) rowLine(c, r, w, y, 0.8);
      break;
    }
    case 'ridges': {
      c.fillStyle = '#6e4628';
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 10) {
        const g = c.createLinearGradient(0, y, 0, y + 10);
        g.addColorStop(0, '#5a381e');
        g.addColorStop(0.3, '#b58457');
        g.addColorStop(0.55, '#9a6d44');
        g.addColorStop(1, '#4f311a');
        c.fillStyle = g;
        c.fillRect(0, y, w, 10);
      }
      dots(c, r, w, h, w * h * 0.06, ['#7c5331', '#c0935f'], 0.6, 1.2);
      break;
    }
    case 'seeded': {
      paintTex(c, 'tilth', w, h, seed);
      c.fillStyle = 'rgba(80,50,25,0.25)';
      c.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 8) {
        c.strokeStyle = '#6f4a2b';
        c.lineWidth = 1.4;
        rowLine(c, r, w, y, 0.4);
        for (let x = r() * 5; x < w; x += 4.5 + r() * 1.5) {
          blob(c, x - 0.9, y - 0.4, 1.1, 0.6, '#5aa838', -0.5);
          blob(c, x + 0.9, y - 0.4, 1.1, 0.6, '#86cf55', 0.5);
        }
      }
      break;
    }
    case 'green':
    case 'fert': {
      c.fillStyle = '#7b5433';
      c.fillRect(0, 0, w, h);
      dots(c, r, w, h, w * h * 0.06, ['#6b4729', '#8e6440'], 0.7, 1.4);
      for (let y = 6; y < h + 6; y += 12) hedgeRow(c, r, w, y, 7, '#4b9a2e', '#2f6d1d', '#79c447');
      if (tex === 'fert') {
        c.fillStyle = 'rgba(255,255,240,0.1)';
        c.fillRect(0, 0, w, h);
        dots(c, r, w, h, w * h * 0.14, ['#f4f2e4', '#e3dfcd', '#ffffff'], 0.5, 1);
      }
      break;
    }
    case 'gold': {
      c.fillStyle = '#a7803f';
      c.fillRect(0, 0, w, h);
      for (let y = 5; y < h + 5; y += 10) {
        hedgeRow(c, r, w, y, 7, '#d6ac45', '#a8812c', '#f1d77a');
        for (let x = r() * 3; x < w; x += 2.5 + r() * 2) {
          c.strokeStyle = r() < 0.5 ? '#b48b2f' : '#e8c55a';
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(x, y - 3);
          c.lineTo(x + 0.8, y + 3);
          c.stroke();
        }
      }
      break;
    }
    case 'cut': {
      c.fillStyle = '#d8c48b';
      c.fillRect(0, 0, w, h);
      dots(c, r, w, h, w * h * 0.12, ['#c9b277', '#e4d3a0', '#bfa86c'], 0.6, 1.3);
      for (let y = 5; y < h; y += 10) {
        for (let x = r() * 3; x < w; x += 2.6) {
          c.fillStyle = r() < 0.5 ? '#a8904f' : '#c2a965';
          c.fillRect(x, y - 1.5 + r() * 3, 1, 1);
        }
        if ((y / 10) % 2 < 1) {
          c.strokeStyle = 'rgba(240,226,176,0.9)';
          c.lineWidth = 2.2;
          rowLine(c, r, w, y + 5, 1.6);
        }
      }
      break;
    }
  }
}

/* ---------------- trees, palms, stones and the farm's bits ---------------- */

/** A round, bushy tree from above: a cluster of leafy lobes, darker underneath. Its shadow is drawn separately. */
export function treeCanopy(c: Ctx, x: number, y: number, rad: number, seed: number, sway = 0) {
  const r = seeded(`tree:${seed}`);
  const dark = pick(r, ['#2f6a24', '#356f28', '#2c5f22']);
  const mid = pick(r, ['#4a8d33', '#4f9636', '#46852f']);
  const light = pick(r, ['#78b84a', '#83c255', '#6fae43']);
  c.save();
  c.translate(x + sway, y);
  const lobes = 6 + Math.floor(r() * 3);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + r() * 0.4;
    blob(c, Math.cos(a) * rad * 0.5, Math.sin(a) * rad * 0.5, rad * 0.55, rad * 0.55, dark);
  }
  blob(c, 0, 0, rad * 0.8, rad * 0.8, mid);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + r() * 0.4;
    blob(c, Math.cos(a) * rad * 0.42 - rad * 0.08, Math.sin(a) * rad * 0.42 - rad * 0.1, rad * 0.36, rad * 0.33, mid);
  }
  for (let i = 0; i < rad * 3; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * rad * 0.8;
    blob(c, Math.cos(a) * d - rad * 0.12, Math.sin(a) * d - rad * 0.15, 1 + r() * 1.2, 0.8 + r() * 0.7, r() < 0.7 ? light : dark, r() * 3);
  }
  c.restore();
}

/** A palm from above: fronds in a star, as in the illustration. */
function palm(c: Ctx, x: number, y: number, rad: number, seed: number) {
  const r = seeded(`palm:${seed}`);
  c.save();
  c.translate(x, y);
  const n = 7 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    c.save();
    c.rotate(a);
    c.fillStyle = i % 2 ? '#3f8a2c' : '#55a338';
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(rad * 0.5, -rad * 0.28, rad, 0);
    c.quadraticCurveTo(rad * 0.5, rad * 0.28, 0, 0);
    c.fill();
    c.strokeStyle = '#2d6a1f';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(rad, 0);
    c.stroke();
    c.restore();
  }
  blob(c, 0, 0, 1.6, 1.6, '#6b4a2a');
  c.restore();
}

function shadow(c: Ctx, x: number, y: number, rx: number, ry: number) {
  blob(c, x + rx * 0.25, y + ry * 0.3, rx, ry, 'rgba(20,40,10,0.22)');
}

/** A rock: an irregular stone with a lit face and a crack. */
export function rock(c: Ctx, x: number, y: number, rad: number, seed: number, flash = 0) {
  const r = seeded(`rock:${seed}`);
  const n = 8;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = rad * (0.78 + r() * 0.3);
    pts.push([Math.cos(a) * d, Math.sin(a) * d * 0.85]);
  }
  c.save();
  c.translate(x, y);
  blob(c, rad * 0.25, rad * 0.35, rad * 1.05, rad * 0.8, 'rgba(0,0,0,0.25)');
  c.fillStyle = '#6f6c66';
  c.beginPath();
  pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath();
  c.fill();
  c.save();
  c.clip();
  blob(c, -rad * 0.25, -rad * 0.3, rad * 0.75, rad * 0.55, '#9d9a92');
  blob(c, -rad * 0.35, -rad * 0.4, rad * 0.35, rad * 0.22, '#c3c0b8');
  c.restore();
  c.strokeStyle = 'rgba(40,38,34,0.6)';
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(-rad * 0.1, -rad * 0.6);
  c.lineTo(rad * 0.1, -rad * 0.1);
  c.lineTo(rad * 0.35, rad * 0.2);
  c.stroke();
  if (flash > 0) {
    c.fillStyle = `rgba(255,255,255,${Math.min(0.6, flash)})`;
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.fill();
  }
  c.restore();
}

/** A small stone: a pebble the implement can kick aside. */
export function stone(c: Ctx, x: number, y: number, rad: number, seed: number) {
  const r = seeded(`stone:${seed}`);
  c.save();
  c.translate(x, y);
  const rot = r() * 3;
  blob(c, rad * 0.35, rad * 0.45, rad, rad * 0.75, 'rgba(0,0,0,0.25)', rot);
  blob(c, 0, 0, rad, rad * 0.78, pick(r, ['#8b8780', '#7d7a74', '#9a958c', '#a59d8f']), rot);
  blob(c, -rad * 0.3, -rad * 0.3, rad * 0.45, rad * 0.3, 'rgba(255,255,255,0.35)', rot);
  c.restore();
}

function stump(c: Ctx, x: number, y: number, rad: number, seed: number, flash = 0) {
  const r = seeded(`stump:${seed}`);
  c.save();
  c.translate(x, y);
  blob(c, rad * 0.25, rad * 0.35, rad * 1.1, rad * 0.85, 'rgba(0,0,0,0.25)');
  // roots
  c.strokeStyle = '#5a3a1e';
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.cos(a) * rad * 0.6, Math.sin(a) * rad * 0.6);
    c.lineTo(Math.cos(a) * rad * 1.25, Math.sin(a) * rad * 1.2);
    c.stroke();
  }
  blob(c, 0, 0, rad, rad * 0.92, '#5a3a1e');
  blob(c, 0, 0, rad * 0.78, rad * 0.72, '#c99a62');
  c.strokeStyle = '#9c7040';
  c.lineWidth = 0.7;
  for (const k of [0.55, 0.32]) {
    c.beginPath();
    c.ellipse(0, 0, rad * k, rad * k * 0.92, 0, 0, Math.PI * 2);
    c.stroke();
  }
  if (flash > 0) blob(c, 0, 0, rad, rad * 0.92, `rgba(255,255,255,${Math.min(0.5, flash)})`);
  c.restore();
}

/** A thing in the field: drawn every frame, as stones roll and trees sway when they are hit. */
export function drawObstacle(c: Ctx, o: Obstacle, now: number) {
  if (o.kind === 'stone') return stone(c, o.x, o.y, o.r, o.seed);
  if (o.kind === 'rock') return rock(c, o.x, o.y, o.r, o.seed, o.wob);
  if (o.kind === 'stump') return stump(c, o.x, o.y, o.r, o.seed, o.wob);
  const sway = o.wob > 0 ? Math.sin(now / 30) * o.wob * 4 : 0;
  shadow(c, o.x, o.y, o.r + 4, o.r + 1);
  treeCanopy(c, o.x, o.y, o.r + 5, o.seed, sway);
}

function pebbles(c: Ctx, r: Rng, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) stone(c, x + (r() - 0.5) * 12, y + (r() - 0.5) * 8, 0.9 + r() * 1.5, Math.floor(r() * 1e6));
}

function tufts(c: Ctx, r: Rng, w: number, h: number, n: number, avoid?: (x: number, y: number) => boolean) {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    if (avoid?.(x, y)) continue;
    c.strokeStyle = r() < 0.5 ? '#6f9f2c' : '#a9d65a';
    c.lineWidth = 0.7;
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + k * 1.2, y - 2 - r() * 1.4);
      c.stroke();
    }
  }
}

/** A barn's corrugated roof from above, with its red gable end. */
function barn(c: Ctx, x: number, y: number, w: number, h: number) {
  blob(c, x + w / 2 + 3, y + h / 2 + 3, w / 2 + 2, h / 2 + 2, 'rgba(0,0,0,0.2)');
  c.fillStyle = '#c9ced2';
  c.fillRect(x, y, w / 2, h);
  c.fillStyle = '#8e959b';
  c.fillRect(x + w / 2, y, w / 2, h);
  c.strokeStyle = 'rgba(80,86,92,0.45)';
  c.lineWidth = 0.5;
  for (let yy = y + 1.5; yy < y + h; yy += 1.6) {
    c.beginPath();
    c.moveTo(x, yy);
    c.lineTo(x + w, yy);
    c.stroke();
  }
  c.fillStyle = '#b8352c';
  c.fillRect(x - 1, y + h, w + 2, 4);
  c.fillStyle = '#fff';
  c.fillRect(x + w / 2 - 3, y + h + 1, 6, 2);
}

function pond(c: Ctx, r: Rng, x: number, y: number, w: number, h: number) {
  c.fillStyle = '#c08a4a';
  c.beginPath();
  c.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, 3);
  c.fill();
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#6ec4ef');
  g.addColorStop(1, '#3d9bd6');
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(x, y, w, h, 2);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = 0.6;
  for (let i = 0; i < 6; i++) {
    const px = x + 3 + r() * (w - 8);
    const py = y + 3 + r() * (h - 6);
    c.beginPath();
    c.moveTo(px, py);
    c.quadraticCurveTo(px + 2, py - 1, px + 4, py);
    c.stroke();
  }
}

/* ---------------- a field scene ---------------- */

export interface FieldScene {
  bg: HTMLCanvasElement;
  /** the field as it will be once worked */
  done: HTMLCanvasElement;
  /** what the implement has worked so far, painted from `done` as it passes */
  work: HTMLCanvasElement;
  wc: Ctx;
  /** where the field sits in the view */
  fx: number;
  fy: number;
  last: [Pt, Pt] | null;
  tool: BizTool;
}

/** A farm from above: grass, the farm's trees and bits round the field, the gate and the track in from the road. */
export function makeField(d: FieldDrive, farm: string, seed: string): FieldScene {
  const fx = Math.round((VIEW_W - d.w) / 2);
  const fy = Math.round((VIEW_H - d.h) / 2);
  const r = seeded(`farm:${seed}`);
  const [bg, c] = layer(VIEW_W, VIEW_H);
  c.lineCap = 'round';
  // grass
  c.fillStyle = '#93c544';
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  dots(c, r, VIEW_W, VIEW_H, 900, ['#86b93a', '#a2d150', '#7fb035', '#9fcb4a'], 0.8, 2.2);
  const inField = (x: number, y: number) => x > fx - 4 && x < fx + d.w + 4 && y > fy - 4 && y < fy + d.h + 4;
  tufts(c, r, VIEW_W, VIEW_H, 160, inField);
  // the track in from the road, through the gate on the left
  const gy = fy + d.swath / 2;
  c.fillStyle = '#c69a62';
  c.fillRect(0, gy - 8, fx + 4, 16);
  c.fillStyle = 'rgba(120,80,40,0.35)';
  c.fillRect(0, gy - 5, fx + 4, 2);
  c.fillRect(0, gy + 3, fx + 4, 2);
  // the field: its earth bank, then the rows as they are now
  c.fillStyle = '#6b4a2b';
  c.beginPath();
  c.roundRect(fx - 3, fy - 3, d.w + 6, d.h + 6, 4);
  c.fill();
  const [now, nc] = layer(d.w, d.h);
  const [look, after] = LOOK[d.tool] ?? LOOK.plough;
  paintTex(nc, look, d.w, d.h, seed);
  c.drawImage(now, fx, fy, d.w, d.h);
  // a grassy lip round the field
  for (let x = fx - 3; x < fx + d.w + 3; x += 2.5) {
    blob(c, x, fy - 3.5, 1.8, 1.2, '#7fb236');
    blob(c, x, fy + d.h + 3.5, 1.8, 1.2, '#7fb236');
  }
  for (let y = fy; y < fy + d.h; y += 2.5) {
    if (Math.abs(y - gy) > 9) blob(c, fx - 3.5, y, 1.2, 1.8, '#7fb236');
    blob(c, fx + d.w + 3.5, y, 1.2, 1.8, '#7fb236');
  }
  // the farm's things round the field: a barn roof or a pond, palms and round trees, pebbles
  const left = fx - 6;
  const right = fx + d.w + 6;
  if (r() < 0.55) barn(c, 3, fy + d.h - 36, 26, 30);
  else pond(c, r, 4, fy + d.h - 40, 26, 34);
  if (r() < 0.5) pond(c, r, right + 3, fy + 8, VIEW_W - right - 7, 30);
  const spots: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 'r' : 'l';
    const x = side === 'l' ? 6 + r() * (left - 12) : right + 6 + r() * (VIEW_W - right - 12);
    const y = 10 + r() * (VIEW_H - 20);
    if (side === 'l' && Math.abs(y - gy) < 18) continue;
    if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 22)) continue;
    spots.push([x, y, 9 + r() * 6]);
  }
  for (const [x, y, rad] of spots) shadow(c, x, y, rad, rad * 0.8);
  for (const [x, y, rad] of spots) (r() < 0.35 ? palm(c, x, y, rad + 2, Math.floor(r() * 1e6)) : treeCanopy(c, x, y, rad, Math.floor(r() * 1e6)));
  for (let i = 0; i < 7; i++) {
    const x = r() < 0.5 ? 4 + r() * (left - 8) : right + 4 + r() * (VIEW_W - right - 8);
    pebbles(c, r, x, 6 + r() * (VIEW_H - 12), 3 + Math.floor(r() * 4));
  }
  // bushes along the top and bottom margins, kept off the field
  for (let x = fx + 8; x < fx + d.w; x += 30 + r() * 40) {
    for (const y of [fy - 9, fy + d.h + 9]) {
      if (y < 3 || y > VIEW_H - 3) continue;
      blob(c, x + 1.5, y + 1.5, 5, 3.4, 'rgba(20,40,10,0.2)');
      blob(c, x, y, 5, 3.4, '#4a8a30');
      blob(c, x - 1.5, y - 1, 2.2, 1.6, '#76b548');
    }
  }
  // the gate posts and the farm's sign
  c.fillStyle = '#6b4a2a';
  c.fillRect(fx - 6, gy - 11, 3, 3);
  c.fillRect(fx - 6, gy + 8, 3, 3);
  c.fillStyle = '#5a3a1e';
  c.fillRect(8, gy - 21, 2, 6);
  c.fillStyle = '#f3e3b8';
  c.strokeStyle = '#6b4a2a';
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(2, gy - 28, Math.max(30, fx - 6), 9, 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#4a2f18';
  c.font = '800 5.6px Manrope, system-ui, sans-serif';
  c.textBaseline = 'middle';
  c.fillText(farm.replace('Mama ', '').slice(0, 9), 5, gy - 23.4, Math.max(26, fx - 12));

  const [done, dc] = layer(d.w, d.h);
  paintTex(dc, after, d.w, d.h, seed);
  const [work, wc] = layer(d.w, d.h);
  return { bg, done, work, wc, fx, fy, last: null, tool: d.tool };
}

/** The implement reveals the worked field along the strip it covered since the last frame. */
export function paintWork(s: FieldScene, d: FieldDrive) {
  const bar = implementBar(d);
  if (!d.working || !s.last) {
    s.last = d.working ? bar : null;
    return;
  }
  const [a0, b0] = s.last;
  const [a1, b1] = bar;
  const c = s.wc;
  c.save();
  c.beginPath();
  c.moveTo(a0[0], a0[1]);
  c.lineTo(b0[0], b0[1]);
  c.lineTo(b1[0], b1[1]);
  c.lineTo(a1[0], a1[1]);
  c.closePath();
  // a hair wider than the strip, so neighbouring frames leave no seams
  c.lineWidth = 1.2;
  c.lineJoin = 'round';
  c.clip();
  c.drawImage(s.done, 0, 0, d.w, d.h);
  c.restore();
  s.last = bar;
}

/* ---------------- the road ---------------- */

export interface RoadScene {
  strip: HTMLCanvasElement;
  sw: number;
}

/** A stretch of countryside along the murram road, as one strip that repeats: farms with their rows on either side,
    trees and palms, a homestead, and the road with its wheel tracks. */
export function makeRoad(seed: string): RoadScene {
  const sw = 1040;
  const r = seeded(`road:${seed}`);
  const [strip, c] = layer(sw, VIEW_H);
  c.lineCap = 'round';
  c.fillStyle = '#93c544';
  c.fillRect(0, 0, sw, VIEW_H);
  dots(c, r, sw, VIEW_H, 1600, ['#86b93a', '#a2d150', '#7fb035'], 0.8, 2.2);
  const top = ROAD_TOP;
  const bot = ROAD_TOP + LANES * LANE_H;
  // farms either side: blocks of rows across the road's line (green hedges, brown furrows, gold)
  for (const [y0, y1] of [
    [6, top - 12],
    [bot + 12, VIEW_H - 6],
  ] as const) {
    let x = 0;
    while (x < sw - 60) {
      const bw = 70 + Math.floor(r() * 90);
      const end = Math.min(sw - 10, x + bw);
      const kind = pick(r, ['green', 'furrow', 'gold', 'green', 'grass']);
      if (kind !== 'grass') {
        c.fillStyle = kind === 'green' ? '#7b5433' : kind === 'gold' ? '#a7803f' : '#6a4226';
        c.fillRect(x, y0, end - x, y1 - y0);
        for (let rx = x + 4; rx < end - 3; rx += 9) {
          if (kind === 'furrow') {
            c.strokeStyle = '#4b2c16';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(rx, y0 + 1);
            c.lineTo(rx, y1 - 1);
            c.stroke();
            c.strokeStyle = '#8b5a36';
            c.lineWidth = 1.2;
            c.beginPath();
            c.moveTo(rx + 3, y0 + 1);
            c.lineTo(rx + 3, y1 - 1);
            c.stroke();
          } else {
            const base = kind === 'green' ? '#4b9a2e' : '#d6ac45';
            const light = kind === 'green' ? '#79c447' : '#f1d77a';
            c.fillStyle = base;
            c.fillRect(rx - 3, y0, 6, y1 - y0);
            for (let yy = y0; yy < y1; yy += 3) {
              blob(c, rx - 3, yy, 1.4, 2, base);
              blob(c, rx + 3, yy + 1.5, 1.4, 2, base);
              if (r() < 0.6) blob(c, rx + (r() - 0.5) * 4, yy, 0.9, 0.7, light);
            }
          }
        }
      } else {
        tufts(c, r, end - x, y1 - y0, 20);
      }
      x = end + 10 + Math.floor(r() * 18);
    }
  }
  // the road: murram with darker edges, worn wheel tracks and a few stones in the dust
  c.fillStyle = '#7fae3a';
  c.fillRect(0, top - 6, sw, 6);
  c.fillRect(0, bot, sw, 6);
  c.fillStyle = '#c79c63';
  c.fillRect(0, top, sw, bot - top);
  dots(c, r, sw, bot - top, 1800, ['#b88c55', '#d4ab74', '#be925a'], 0.6, 1.8);
  c.fillStyle = 'rgba(140,96,52,0.5)';
  c.fillRect(0, top, sw, 2.5);
  c.fillRect(0, bot - 2.5, sw, 2.5);
  for (let l = 0; l < LANES; l++) {
    const y = laneY(l);
    c.strokeStyle = 'rgba(150,104,58,0.35)';
    c.lineWidth = 2.4;
    for (const off of [-8, 8]) rowLine(c, r, sw, y + off, 0.8);
  }
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 1.2;
  c.setLineDash([14, 16]);
  for (let l = 1; l < LANES; l++) {
    c.beginPath();
    c.moveTo(0, top + l * LANE_H);
    c.lineTo(sw, top + l * LANE_H);
    c.stroke();
  }
  c.setLineDash([]);
  for (let i = 0; i < 40; i++) stone(c, r() * sw, top + 3 + r() * (bot - top - 6), 0.8 + r() * 1.2, Math.floor(r() * 1e6));
  // trees, palms and a homestead on the verges (wrapped, so the strip repeats without a seam)
  const things: [number, number, number, string][] = [];
  for (let i = 0; i < 26; i++) {
    const up = r() < 0.5;
    const y = up ? 4 + r() * (top - 16) : bot + 12 + r() * (VIEW_H - bot - 16);
    things.push([r() * sw, y, 7 + r() * 7, pick(r, ['tree', 'tree', 'palm', 'bush'])]);
  }
  const hut = (x: number, y: number) => {
    blob(c, x + 2, y + 2, 8, 8, 'rgba(0,0,0,0.2)');
    blob(c, x, y, 8, 8, '#c9a25a');
    c.strokeStyle = '#9c7838';
    c.lineWidth = 0.6;
    for (let a = 0; a < Math.PI * 2; a += 0.35) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
      c.stroke();
    }
    blob(c, x, y, 1.5, 1.5, '#7a5a2a');
  };
  for (const off of [0, -sw, sw]) {
    hut(300 + off, VIEW_H - 22);
    hut(318 + off, VIEW_H - 30);
    for (const [x, y, rad, kind] of things) {
      const xx = x + off;
      if (xx < -30 || xx > sw + 30) continue;
      shadow(c, xx, y, rad, rad * 0.8);
      if (kind === 'palm') palm(c, xx, y, rad + 2, Math.floor(x));
      else if (kind === 'bush') {
        blob(c, xx, y, rad * 0.6, rad * 0.45, '#4a8a30');
        blob(c, xx - 1.5, y - 1, rad * 0.3, rad * 0.22, '#76b548');
      } else treeCanopy(c, xx, y, rad, Math.floor(x));
    }
  }
  return { strip, sw };
}

/** A hole on the road, wherever the road has rolled it to. */
export function drawHole(c: Ctx, h: Hole) {
  const x = h.x;
  const y = laneY(h.lane);
  c.save();
  c.translate(x, y);
  if (h.kind === 'puddle') {
    blob(c, 0, 0, 15, 9, '#8a6a42');
    const g = c.createLinearGradient(-12, -8, 12, 8);
    g.addColorStop(0, '#8fd0f0');
    g.addColorStop(1, '#4e9ccc');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, 13, 7.5, 0, 0, Math.PI * 2);
    c.fill();
    blob(c, -4, -2.5, 5, 1.6, 'rgba(255,255,255,0.45)');
  } else if (h.kind === 'pothole') {
    blob(c, 0, 0, 13, 9, '#9c7346');
    blob(c, 0.5, 0.5, 10.5, 7, '#4f3219');
    blob(c, 2, 2, 7, 4.5, '#3a2311');
    blob(c, -4, -3, 3, 1.4, 'rgba(255,230,190,0.25)');
  } else if (h.kind === 'rut') {
    c.strokeStyle = '#6f4a26';
    c.lineWidth = 4;
    c.lineCap = 'round';
    for (const dy of [-6, 6]) {
      c.beginPath();
      c.moveTo(-15, dy);
      c.quadraticCurveTo(0, dy + 2, 15, dy - 1);
      c.stroke();
    }
    c.strokeStyle = '#4b2f16';
    c.lineWidth = 2;
    for (const dy of [-6, 6]) {
      c.beginPath();
      c.moveTo(-13, dy + 0.5);
      c.quadraticCurveTo(0, dy + 2.5, 13, dy - 0.5);
      c.stroke();
    }
  } else {
    const r = seeded(`rubble:${h.lane}`);
    for (let i = 0; i < 7; i++) stone(c, (r() - 0.5) * 20, (r() - 0.5) * 12, 1.8 + r() * 2.2, i * 97 + h.lane);
  }
  c.restore();
}

/** The road this frame: the strip rolled along, the holes, then the tractor. */
export function drawRoad(c: Ctx, s: RoadScene, d: HaulDrive) {
  const off = d.rolled % s.sw;
  c.drawImage(s.strip, -off, 0, s.sw, VIEW_H);
  c.drawImage(s.strip, s.sw - off, 0, s.sw, VIEW_H);
  for (const h of d.holes) if (h.x > -30 && h.x < VIEW_W + 30) drawHole(c, h);
}

/* ---------------- the tractor ---------------- */

export interface TractorLook {
  size: number;
  tool: BizTool;
  swath: number;
  /** front wheels' angle, radians */
  steer: number;
  /** distance rolled: the tyres' tread moves with it */
  roll: number;
  now: number;
  /** a trailer, and the bags on it (the haulage run) */
  bags?: number;
  /** the implement raised for the road */
  raised?: boolean;
  /** the drive is underway (a spreader's disc spins, a header's reel turns) */
  busy?: boolean;
}

const TRACTOR_GREEN = '#3e8e3a';
const TRACTOR_DARK = '#2c6a29';

/** A tyre from above, its tread bars moving as it rolls. */
function tyre(c: Ctx, x: number, y: number, len: number, wid: number, roll: number) {
  c.fillStyle = '#1d1d1d';
  c.beginPath();
  c.roundRect(x - len / 2, y - wid / 2, len, wid, 1.5);
  c.fill();
  c.save();
  c.beginPath();
  c.rect(x - len / 2, y - wid / 2, len, wid);
  c.clip();
  c.strokeStyle = '#3d3d3d';
  c.lineWidth = 1;
  const step = 2.4;
  const o = ((roll % step) + step) % step;
  for (let t = -len / 2 - step + o; t < len / 2 + step; t += step) {
    c.beginPath();
    c.moveTo(x + t, y - wid / 2);
    c.lineTo(x + t + 1.2, y);
    c.lineTo(x + t, y + wid / 2);
    c.stroke();
  }
  c.restore();
}

function implement(c: Ctx, k: TractorLook) {
  const hw = k.swath / 2;
  const x0 = -15;
  c.strokeStyle = '#3b3b3b';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-10, 0);
  c.lineTo(x0, 0);
  c.stroke();
  if (k.raised) {
    // folded for the road: a narrow bundle on the linkage
    c.fillStyle = k.tool === 'harvester' || k.tool === 'combine' ? '#c0392b' : '#5f6468';
    c.beginPath();
    c.roundRect(x0 - 7, -8, 7, 16, 1.5);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fillRect(x0 - 6, -7, 2, 14);
    return;
  }
  switch (k.tool) {
    case 'plough': {
      c.fillStyle = '#55595d';
      c.fillRect(x0 - 3, -hw, 3, hw * 2);
      const n = Math.max(3, Math.round(k.swath / 9));
      for (let i = 0; i < n; i++) {
        const y = -hw + 4 + (i * (k.swath - 8)) / (n - 1);
        c.save();
        c.translate(x0 - 4 - i * 0.8, y);
        c.rotate(-0.5);
        blob(c, 0, 0, 1.6, 3.6, '#c4c9cd');
        blob(c, 0.4, 0, 0.8, 2.2, '#7f868c');
        c.restore();
      }
      break;
    }
    case 'harrow': {
      c.fillStyle = '#5f6468';
      c.fillRect(x0 - 10, -hw, 1.6, hw * 2);
      c.fillRect(x0 - 4, -hw, 1.6, hw * 2);
      c.fillRect(x0 - 10, -hw, 7.6, 1.4);
      c.fillRect(x0 - 10, hw - 1.4, 7.6, 1.4);
      c.fillStyle = '#2f3336';
      for (let y = -hw + 2; y < hw - 1; y += 3) {
        c.fillRect(x0 - 9.6, y, 1, 1);
        c.fillRect(x0 - 3.6, y + 1.5, 1, 1);
      }
      break;
    }
    case 'ridger': {
      c.fillStyle = '#55595d';
      c.fillRect(x0 - 3, -hw, 3, hw * 2);
      c.fillStyle = '#9aa1a6';
      for (let y = -hw + 5; y < hw; y += 10) {
        c.beginPath();
        c.moveTo(x0 - 2, y - 3.5);
        c.lineTo(x0 - 9, y);
        c.lineTo(x0 - 2, y + 3.5);
        c.fill();
      }
      break;
    }
    case 'planter': {
      c.fillStyle = '#55595d';
      c.fillRect(x0 - 3, -hw, 3, hw * 2);
      for (let y = -hw + 5; y < hw; y += 10) {
        c.fillStyle = '#2f6fb5';
        c.beginPath();
        c.roundRect(x0 - 9, y - 3, 6, 6, 1);
        c.fill();
        c.fillStyle = '#9cc6f0';
        c.fillRect(x0 - 8, y - 2, 2, 4);
      }
      break;
    }
    case 'spreader': {
      blob(c, x0 - 7, 0, 7.5, 7.5, '#d35a1a');
      blob(c, x0 - 7, 0, 5.5, 5.5, '#f08a3a');
      c.save();
      c.translate(x0 - 7, 0);
      c.rotate(k.busy ? k.now / 60 : 0);
      c.strokeStyle = '#7a3410';
      c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(4.5, 0);
        c.stroke();
      }
      c.restore();
      break;
    }
    case 'harvester':
    case 'combine': {
      c.fillStyle = '#c0392b';
      c.fillRect(x0 - 7, -hw, 7, hw * 2);
      c.strokeStyle = '#f2d7d0';
      c.lineWidth = 0.8;
      const o = k.busy ? (k.now / 40) % 3 : 0;
      for (let y = -hw + o; y < hw; y += 3) {
        c.beginPath();
        c.moveTo(x0 - 6.5, y);
        c.lineTo(x0 - 0.5, y);
        c.stroke();
      }
      break;
    }
    default:
      break;
  }
}

function trailer(c: Ctx, bags: number, roll: number) {
  c.strokeStyle = '#3b3b3b';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-10, 0);
  c.lineTo(-20, 0);
  c.stroke();
  tyre(c, -34, -14, 8, 4, roll);
  tyre(c, -34, 14, 8, 4, roll);
  c.fillStyle = '#6b4424';
  c.beginPath();
  c.roundRect(-48, -13, 28, 26, 2);
  c.fill();
  c.fillStyle = '#8a5a32';
  c.fillRect(-46, -11, 24, 22);
  c.strokeStyle = 'rgba(60,35,15,0.5)';
  c.lineWidth = 0.6;
  for (let y = -9; y < 11; y += 4) {
    c.beginPath();
    c.moveTo(-46, y);
    c.lineTo(-22, y);
    c.stroke();
  }
  for (let i = 0; i < bags; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = -45 + row * 4.6;
    const y = -10 + col * 10.5;
    c.fillStyle = '#efe0b4';
    c.beginPath();
    c.roundRect(x, y, 4.2, 9.5, 1.6);
    c.fill();
    c.fillStyle = '#c9b27a';
    c.fillRect(x + 1.6, y, 1, 9.5);
  }
}

/** The tractor from above, heading along +x: big rear tyres, steering front tyres, the bonnet with its exhaust stack,
    the cab roof, and the implement (or the trailer) behind. */
export function drawTractor(c: Ctx, x: number, y: number, hdg: number, k: TractorLook) {
  c.save();
  c.translate(x, y);
  c.rotate(hdg);
  c.scale(k.size, k.size);
  // shadow
  blob(c, 2, 2.5, 16, 12, 'rgba(0,0,0,0.22)');
  if (k.bags !== undefined) trailer(c, k.bags, k.roll);
  else implement(c, k);
  const combine = k.tool === 'combine';
  const body = combine ? '#d9a21b' : TRACTOR_GREEN;
  const dark = combine ? '#a87a0e' : TRACTOR_DARK;
  // rear tyres, then the front ones turned by the steering
  tyre(c, -5, -10.5, 13, 5.5, k.roll);
  tyre(c, -5, 10.5, 13, 5.5, k.roll);
  for (const fy of [-7.5, 7.5]) {
    c.save();
    c.translate(10.5, fy);
    c.rotate(k.steer);
    tyre(c, 0, 0, 7, 3.4, k.roll * 1.6);
    c.restore();
  }
  // the front axle and the bonnet
  c.fillStyle = '#2b2b2b';
  c.fillRect(9.8, -6, 1.4, 12);
  c.fillStyle = dark;
  c.beginPath();
  c.roundRect(-3, -5.6, 20, 11.2, 3);
  c.fill();
  c.fillStyle = body;
  c.beginPath();
  c.roundRect(-3, -4.8, 19.4, 9.6, 3);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.22)';
  c.fillRect(0, -3.6, 14, 1.6);
  // grille and lights
  c.fillStyle = '#222';
  c.fillRect(16, -3.2, 1.4, 6.4);
  c.fillStyle = '#ffe28a';
  c.fillRect(15.6, -4.6, 1.6, 1.6);
  c.fillRect(15.6, 3, 1.6, 1.6);
  // mudguards over the rear tyres
  c.fillStyle = body;
  c.beginPath();
  c.roundRect(-12, -13.6, 14, 3.4, 1.5);
  c.fill();
  c.beginPath();
  c.roundRect(-12, 10.2, 14, 3.4, 1.5);
  c.fill();
  // the cab: frame, glass and the white roof
  c.fillStyle = '#1f2a33';
  c.beginPath();
  c.roundRect(-12.5, -8.6, 13, 17.2, 2.2);
  c.fill();
  c.fillStyle = '#eef1f3';
  c.beginPath();
  c.roundRect(-11.5, -7.6, 11, 15.2, 2);
  c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(-11.5, 4.6, 11, 3);
  c.fillStyle = 'rgba(150,200,230,0.8)';
  c.fillRect(-0.6, -6.4, 1.2, 12.8);
  // the exhaust stack, beside the bonnet
  blob(c, 6, -4.2, 1.7, 1.7, '#2a2a2a');
  blob(c, 6, -4.2, 0.9, 0.9, '#555');
  c.restore();
}

/** Where the exhaust stack is, in the view, for the smoke. */
export const stackAt = (x: number, y: number, hdg: number, size: number): Pt => [x + (Math.cos(hdg) * 6 + Math.sin(hdg) * 4.2) * size, y + (Math.sin(hdg) * 6 - Math.cos(hdg) * 4.2) * size];

/** The view x of the tractor's middle on the road. */
export const ROAD_TRACTOR_X = HAUL_X - 14;

/* ---------------- dust and smoke ---------------- */

type PKind = 'smoke' | 'dust' | 'chip' | 'spark' | 'leaf' | 'drop' | 'ring' | 'text' | 'star';
interface P {
  k: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  rot: number;
  vr: number;
  drag: number;
  alpha: number;
  text?: string;
}

/** The particles: exhaust smoke, dust from the implement and the wheels, and the bursts when something is hit. */
export class Fx {
  list: P[] = [];
  /** Settings → Tractor → Effects: 0 is none, 1 is lots */
  mul = 1;
  private add(p: Partial<P> & { k: PKind; x: number; y: number }) {
    if (this.list.length > 360) this.list.shift();
    const max = p.max ?? 1;
    this.list.push({ vx: 0, vy: 0, size: 2, grow: 0, color: '#fff', rot: 0, vr: 0, drag: 1.5, alpha: 1, ...p, life: max, max });
  }
  private n(base: number) {
    const v = base * this.mul;
    return Math.floor(v) + (Math.random() < v % 1 ? 1 : 0);
  }
  /** a puff from the exhaust stack; darker and bigger when the engine labours */
  exhaust(x: number, y: number, rpm: number, dt: number, black = false) {
    const rate = (6 + rpm * 16) * dt * this.mul;
    for (let i = 0; i < Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0); i++) {
      const g = black ? 40 + Math.random() * 30 : 110 + Math.random() * 60;
      this.add({ k: 'smoke', x, y, vx: 8 + Math.random() * 10, vy: -10 - Math.random() * 10, max: 0.9 + Math.random() * 0.7, size: 1.4, grow: black ? 9 : 6, color: `rgb(${g},${g},${g})`, alpha: black ? 0.6 : 0.42, drag: 0.6 });
    }
  }
  smoke(x: number, y: number, count: number, dark = true) {
    for (let i = 0; i < this.n(count); i++) {
      const g = dark ? 35 + Math.random() * 40 : 150 + Math.random() * 60;
      const a = Math.random() * Math.PI * 2;
      const s = 8 + Math.random() * 18;
      this.add({ k: 'smoke', x, y, vx: Math.cos(a) * s + 6, vy: Math.sin(a) * s - 12, max: 1 + Math.random() * 0.8, size: 2.5, grow: 10, color: `rgb(${g},${g},${g})`, alpha: 0.55, drag: 0.8 });
    }
  }
  dust(x: number, y: number, color: string, count: number, speed = 20, size = 2) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      this.add({ k: 'dust', x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 0.7 + Math.random() * 0.8, size, grow: 7 + Math.random() * 5, color, alpha: 0.5, drag: 2.2 });
    }
  }
  chips(x: number, y: number, colors: string[], count: number, speed = 90) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random());
      this.add({ k: 'chip', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 0.5 + Math.random() * 0.5, size: 0.8 + Math.random() * 1.6, color: colors[Math.floor(Math.random() * colors.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20, drag: 3.5 });
    }
  }
  sparks(x: number, y: number, count: number) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 120;
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 0.18 + Math.random() * 0.2, size: 1, color: Math.random() < 0.5 ? '#ffe066' : '#ff9a2e', drag: 4 });
    }
  }
  leaves(x: number, y: number, count: number) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 25 + Math.random() * 45;
      this.add({ k: 'leaf', x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 1.2 + Math.random() * 0.9, size: 1.4 + Math.random(), color: ['#4a8d33', '#6fae43', '#83c255', '#3a7a28', '#a7c94a'][Math.floor(Math.random() * 5)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, drag: 2.4 });
    }
  }
  splash(x: number, y: number, count: number) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 70;
      this.add({ k: 'drop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 0.35 + Math.random() * 0.3, size: 0.8 + Math.random() * 1.2, color: Math.random() < 0.5 ? '#9fd8f5' : '#5fb0e0', drag: 3 });
    }
  }
  ring(x: number, y: number, color: string, size = 14) {
    if (this.mul <= 0) return;
    this.add({ k: 'ring', x, y, max: 0.4, size: 3, grow: size * 2.5, color, alpha: 0.8 });
  }
  stars(x: number, y: number, count: number) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 80;
      this.add({ k: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, max: 0.7 + Math.random() * 0.6, size: 1.5 + Math.random() * 1.5, color: ['#ffd84a', '#ffffff', '#8fe36a', '#ff8fb0'][Math.floor(Math.random() * 4)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, drag: 1.6 });
    }
  }
  /** a word that pops up where something was hit (it shows whatever the effects setting) */
  text(x: number, y: number, text: string, color: string) {
    this.add({ k: 'text', x, y, vy: -26, max: 0.9, size: 8, color, text, drag: 1.5 });
  }
  step(dt: number) {
    const out: P[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const f = Math.exp(-p.drag * dt);
      p.vx *= f;
      p.vy *= f;
      if (p.k === 'leaf') p.vx += Math.sin((p.max - p.life) * 9 + p.rot) * 30 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
      out.push(p);
    }
    this.list = out;
  }
  draw(c: Ctx) {
    for (const p of this.list) {
      const t = p.life / p.max;
      c.globalAlpha = Math.max(0, p.alpha * (p.k === 'smoke' || p.k === 'dust' ? Math.min(1, t * 1.6) * Math.min(1, (1 - t) * 6 + 0.3) : Math.min(1, t * 2.5)));
      switch (p.k) {
        case 'smoke':
        case 'dust':
          blob(c, p.x, p.y, p.size, p.size * 0.9, p.color);
          break;
        case 'chip':
        case 'star':
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.fillStyle = p.color;
          if (p.k === 'star') {
            c.beginPath();
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              c.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size);
              c.lineTo(Math.cos(a + 0.63) * p.size * 0.45, Math.sin(a + 0.63) * p.size * 0.45);
            }
            c.fill();
          } else c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          c.restore();
          break;
        case 'spark':
          c.strokeStyle = p.color;
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          c.stroke();
          break;
        case 'leaf':
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          blob(c, 0, 0, p.size, p.size * 0.5, p.color);
          c.restore();
          break;
        case 'drop':
          blob(c, p.x, p.y, p.size, p.size, p.color);
          break;
        case 'ring':
          c.strokeStyle = p.color;
          c.lineWidth = 1.6;
          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          c.stroke();
          break;
        case 'text': {
          const pop = 1 + Math.max(0, (t - 0.8) * 2.5);
          c.save();
          c.translate(p.x, p.y);
          c.scale(pop, pop);
          c.font = `900 ${p.size}px Manrope, system-ui, sans-serif`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.lineWidth = 2.6;
          c.strokeStyle = '#2b1a0c';
          c.strokeText(p.text!, 0, 0);
          c.fillStyle = p.color;
          c.fillText(p.text!, 0, 0);
          c.restore();
          break;
        }
      }
    }
    c.globalAlpha = 1;
  }
}

/** Faint lines between the passes, where each pass of the implement should go. */
export function drawGuides(c: Ctx, s: FieldScene, d: FieldDrive) {
  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.28)';
  c.lineWidth = 0.8;
  c.setLineDash([5, 6]);
  for (let y = d.swath; y < d.h - 1; y += d.swath) {
    c.beginPath();
    c.moveTo(s.fx + 2, s.fy + y);
    c.lineTo(s.fx + d.w - 2, s.fy + y);
    c.stroke();
  }
  c.restore();
}
