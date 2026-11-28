/* The farm's restaurant on the 3D farm: a big dining hall in the bottom-left corner of the yard, cream walls up to the
   waist and glass above them and over the roof, so the camera sees in. Inside: the kitchen along the back wall (a jiko
   with its sufuria, a stove with a pan, the fridge that hums as the farmer walks up), the menu board, and three tables
   with two stools each. Customers from the village walk up the path, in at the door, sit at a table, order (a bubble
   with the dish over their head), eat and walk out again, all day. Walking to the door opens the restaurant game
   (src/shop). Built from three.js primitives in the storybook palette (src/art/storybook.tsx), as the farm is. */

import * as THREE from 'three';
import { SB } from '../art/storybook';
import { G, at, glassHouse, makeFarmer, type Farmer, type Part } from './models';

/** The hall: its centre in the world, its size, and its door in the right-hand (east) wall, facing the yard. */
export const RESTAURANT_AT = { x: -16.7, z: 13.4, w: 7.4, d: 5.4, h: 1.9 };
/** Where the fridge stands in the hall (from its centre): the back right corner of the kitchen. */
export const RESTAURANT_FRIDGE = { x: 2.9, z: -2.15 };
/** The door, in the hall's own x and z (the middle of the east wall). */
const DOOR_AT = 0.2;

/** The tables (hall x, z), and their seats: one each side, facing the table. */
const TABLES = [
  { x: -2.4, z: 0.9 },
  { x: -0.4, z: 0.9 },
  { x: 1.6, z: 0.9 },
];
const SEATS = TABLES.flatMap(t => [
  { x: t.x - 0.62, z: t.z, face: Math.PI / 2, table: t },
  { x: t.x + 0.62, z: t.z, face: -Math.PI / 2, table: t },
]);

/** The hall in world units: a point in the hall's own x and z. */
const world = (x: number, z: number) => ({ x: RESTAURANT_AT.x + x, z: RESTAURANT_AT.z + z });

/** The floor, the kitchen and the tables (they cast shadows, under the glass). */
export function restaurantInside(): Part[] {
  const { w, d } = RESTAURANT_AT;
  const wood = SB.woodDark;
  const out: Part[] = [
    // a terracotta tiled floor on a footing, a lighter rug under the tables
    { geo: G.box, color: '#b9b2a4', m: at(0, 0.04, 0, { sx: w + 0.2, sy: 0.08, sz: d + 0.2 }) },
    { geo: G.box, color: '#e0a57a', m: at(0, 0.085, 0, { sx: w - 0.1, sy: 0.02, sz: d - 0.1 }) },
    { geo: G.box, color: SB.wall, m: at(-0.4, 0.1, 0.9, { sx: 5.6, sy: 0.01, sz: 1.5 }) },
    // the kitchen counter along the back wall, its worktop, and the serving pass in front of it
    { geo: G.box, color: wood, m: at(-0.6, 0.5, -2.15, { sx: 5.4, sy: 0.85, sz: 0.62 }) },
    { geo: G.box, color: SB.woodLight, m: at(-0.6, 0.95, -2.15, { sx: 5.5, sy: 0.06, sz: 0.7 }) },
    { geo: G.box, color: SB.wood, m: at(-0.9, 0.5, -1.05, { sx: 3.6, sy: 0.9, sz: 0.36 }) },
    { geo: G.box, color: SB.woodLight, m: at(-0.9, 0.97, -1.05, { sx: 3.7, sy: 0.06, sz: 0.46 }) },
    // the jiko and its sufuria, the stove and its pan, a chopping board with tomatoes and sukuma
    { geo: G.cyl, color: '#3b3b3b', m: at(-2.6, 1.08, -2.15, { sx: 0.5, sy: 0.18, sz: 0.5 }) },
    { geo: G.cyl, color: '#9aa3a9', m: at(-2.6, 1.3, -2.15, { sx: 0.44, sy: 0.3, sz: 0.44 }) },
    { geo: G.cyl, color: '#f3dc8a', m: at(-2.6, 1.46, -2.15, { sx: 0.38, sy: 0.02, sz: 0.38 }) },
    { geo: G.box, color: '#e9e3d6', m: at(-1.3, 1.03, -2.15, { sx: 0.9, sy: 0.1, sz: 0.55 }) },
    { geo: G.cyl, color: '#2f2f2f', m: at(-1.3, 1.12, -2.15, { sx: 0.4, sy: 0.04, sz: 0.4 }) },
    { geo: G.sphere, color: '#3f8a2a', m: at(-1.3, 1.16, -2.15, { sx: 0.26, sy: 0.06, sz: 0.26 }) },
    { geo: G.box, color: SB.woodLight, m: at(0.2, 1.0, -2.15, { sx: 0.6, sy: 0.04, sz: 0.4 }) },
    { geo: G.sphere, color: '#e0362b', m: at(0.05, 1.08, -2.12, { s: 0.14 }) },
    { geo: G.sphere, color: '#e0362b', m: at(0.22, 1.08, -2.2, { s: 0.13 }) },
    { geo: G.sphere, color: '#2f7d1f', m: at(0.4, 1.07, -2.1, { sx: 0.22, sy: 0.08, sz: 0.16 }) },
    // sacks of maize and beans at the end of the counter
    { geo: G.sphere, color: '#e8d9b0', m: at(1.45, 0.4, -2.2, { sx: 0.5, sy: 0.7, sz: 0.45 }) },
    { geo: G.sphere, color: '#c9a77a', m: at(1.95, 0.35, -2.15, { sx: 0.45, sy: 0.6, sz: 0.4 }) },
    // the menu board on the back wall: a slate with chalk lines
    { geo: G.box, color: '#2b3a2f', m: at(-0.9, 1.55, -2.62, { sx: 1.4, sy: 0.55, sz: 0.05 }) },
    { geo: G.box, color: '#e9e3c9', m: at(-0.95, 1.66, -2.59, { sx: 1.0, sy: 0.05, sz: 0.02 }) },
    { geo: G.box, color: '#e9e3c9', m: at(-1.05, 1.54, -2.59, { sx: 0.8, sy: 0.05, sz: 0.02 }) },
    { geo: G.box, color: '#e9e3c9', m: at(-0.9, 1.42, -2.59, { sx: 1.1, sy: 0.05, sz: 0.02 }) },
    // the fridge: a white upright with a freezer door on top, a seam, two handles and a grille at its foot
    { geo: G.box, color: '#f4f6f7', m: at(RESTAURANT_FRIDGE.x, 0.82, RESTAURANT_FRIDGE.z, { sx: 0.6, sy: 1.5, sz: 0.55 }) },
    { geo: G.box, color: '#b9c2c8', m: at(RESTAURANT_FRIDGE.x, 1.18, RESTAURANT_FRIDGE.z + 0.28, { sx: 0.58, sy: 0.02, sz: 0.01 }) },
    { geo: G.box, color: '#8d969c', m: at(RESTAURANT_FRIDGE.x - 0.22, 1.34, RESTAURANT_FRIDGE.z + 0.29, { sx: 0.03, sy: 0.18, sz: 0.02 }) },
    { geo: G.box, color: '#8d969c', m: at(RESTAURANT_FRIDGE.x - 0.22, 0.86, RESTAURANT_FRIDGE.z + 0.29, { sx: 0.03, sy: 0.34, sz: 0.02 }) },
    { geo: G.box, color: '#4a5258', m: at(RESTAURANT_FRIDGE.x, 0.13, RESTAURANT_FRIDGE.z + 0.28, { sx: 0.5, sy: 0.06, sz: 0.01 }) },
    // pot plants either side of the door
    { geo: G.cyl, color: SB.roof, m: at(3.3, 0.3, -0.75, { sx: 0.34, sy: 0.4, sz: 0.34 }) },
    { geo: G.sphere, color: SB.leafMid, m: at(3.3, 0.7, -0.75, { s: 0.55 }) },
    { geo: G.cyl, color: SB.roof, m: at(3.3, 0.3, 1.2, { sx: 0.34, sy: 0.4, sz: 0.34 }) },
    { geo: G.sphere, color: SB.leafMid, m: at(3.3, 0.7, 1.2, { s: 0.55 }) },
  ];
  for (const t of TABLES) {
    out.push({ geo: G.cyl, color: SB.woodLight, m: at(t.x, 0.74, t.z, { sx: 0.95, sy: 0.06, sz: 0.95 }) });
    out.push({ geo: G.cyl, color: SB.roof, m: at(t.x, 0.775, t.z, { sx: 0.6, sy: 0.01, sz: 0.6 }) });
    out.push({ geo: G.cyl6, color: wood, m: at(t.x, 0.37, t.z, { sx: 0.12, sy: 0.72, sz: 0.12 }) });
  }
  for (const s of SEATS) {
    out.push({ geo: G.cyl, color: SB.shed, m: at(s.x, 0.42, s.z, { sx: 0.36, sy: 0.06, sz: 0.36 }) });
    out.push({ geo: G.cyl6, color: wood, m: at(s.x, 0.21, s.z, { sx: 0.08, sy: 0.4, sz: 0.08 }) });
  }
  return out;
}

/** The walls and the roof: cream walls to the waist, glass above them and over the roof, terracotta frames. */
export const restaurantShell = () =>
  glassHouse({ w: RESTAURANT_AT.w, d: RESTAURANT_AT.d, h: RESTAURANT_AT.h, rise: 0.7, frame: SB.roof, glass: '#d6ecef', door: { side: 'x+', at: DOOR_AT, width: 1.1 }, plinth: { h: 0.75, color: SB.wall } });

/** The way in: outside the door, and just inside it. */
export const RESTAURANT_DOOR = world(RESTAURANT_AT.w / 2 + 0.9, DOOR_AT);
const INSIDE = world(RESTAURANT_AT.w / 2 - 0.6, DOOR_AT);
/** The aisle in front of the tables, between the pass and the stools. */
const AISLE_Z = -0.25;
/** Where customers come from and go to: the yard's corner up the path. */
const LANE = { x: -11.4, z: 9.2 };

/* ---------------- the customers ---------------- */

type Phase = 'away' | 'walk' | 'order' | 'wait' | 'eat' | 'leave';
interface Diner {
  f: Farmer;
  seat: number;
  phase: Phase;
  t: number;
  /** how long this phase lasts (away, order, wait, eat) */
  until: number;
  path: { x: number; z: number }[];
  pos: THREE.Vector2;
  heading: number;
  walking: number;
  dish: number;
  bubble: THREE.Sprite;
  bowl: THREE.Mesh;
}

const LOOKS = [
  { skin: '#8a5634', outfit: '#2b6cb0', trim: '#f2c14e', head: 'wrap' as const, headColor: '#d9572b' },
  { skin: '#6e4127', outfit: '#e0a21b', trim: '#3b3b3b', head: 'cap' as const, headColor: '#1f8a70' },
  { skin: '#a46a43', outfit: '#7a4fa0', trim: '#f4f1e8', head: 'none' as const, headColor: '#1d1d1d' },
  { skin: '#5a3420', outfit: '#1f8a70', trim: '#e84a3a', head: 'wrap' as const, headColor: '#e6b844' },
  { skin: '#b27a4f', outfit: '#e85d9a', trim: '#f2c14e', head: 'none' as const, headColor: '#3b3b3b' },
];

/** The dishes the bubbles show (the restaurant game's menu): a bowl in each one's colours. */
const BOWLS = [
  { food: '#f2c230', top: '#8a3b2a' }, // githeri: maize and beans
  { food: '#f6efe0', top: '#2f7d1f' }, // ugali na sukuma wiki
  { food: '#8a3b2a', top: '#e0362b' }, // bean stew
  { food: '#e0362b', top: '#5c9e3a' }, // kachumbari
  { food: '#e0364a', top: '#3f8a2a' }, // strawberry cup
];

function bubbleTexture(i: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  // a cream speech bubble with a tail
  g.fillStyle = '#fffaf0';
  g.strokeStyle = '#c8553d';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(8, 8, 80, 62, 18);
  g.moveTo(40, 69);
  g.lineTo(48, 88);
  g.lineTo(58, 69);
  g.fill();
  g.stroke();
  g.fillStyle = '#fffaf0';
  g.fillRect(41, 64, 16, 7);
  // the bowl, its food heaped up, and a sprig on top
  const b = BOWLS[i % BOWLS.length];
  g.fillStyle = b.food;
  g.beginPath();
  g.ellipse(48, 40, 22, 12, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = b.top;
  for (const [x, y] of [[38, 34], [50, 30], [58, 36], [45, 38]]) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#8b5a2b';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(22, 40);
  g.quadraticCurveTo(48, 70, 74, 40);
  g.closePath();
  g.fill();
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The restaurant's customers on the farm: each walks in, sits, orders, eats and leaves, then comes back later. */
export class Diners {
  private list: Diner[] = [];
  private textures: THREE.Texture[] = [];

  constructor(private scene: THREE.Scene, count = 4) {
    this.textures = BOWLS.map((_, i) => bubbleTexture(i));
    for (let i = 0; i < count; i++) {
      const f = makeFarmer(LOOKS[i % LOOKS.length]);
      for (const o of [...Object.values(f.tools), ...Object.values(f.loads)]) o.visible = false;
      f.root.visible = false;
      scene.add(f.root);
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures[i % this.textures.length], depthTest: false, transparent: true }));
      bubble.scale.set(0.75, 0.75, 1);
      bubble.renderOrder = 6;
      bubble.visible = false;
      scene.add(bubble);
      const bowl = new THREE.Mesh(G.sphere, new THREE.MeshLambertMaterial({ color: BOWLS[i % BOWLS.length].food }));
      bowl.scale.set(0.24, 0.1, 0.24);
      bowl.visible = false;
      scene.add(bowl);
      // the first ones are already at their tables; the rest come up the path in turn
      const seat = (i * 2 + (i % 2)) % SEATS.length;
      const d: Diner = { f, seat, phase: 'away', t: 0, until: i * 6, path: [], pos: new THREE.Vector2(LANE.x, LANE.z), heading: 0, walking: 0, dish: i, bubble, bowl };
      if (i < 2) this.sitAt(d, i === 0 ? 'eat' : 'order');
      this.list.push(d);
    }
  }

  private sitAt(d: Diner, phase: Phase) {
    const s = SEATS[d.seat];
    const p = world(s.x, s.z);
    d.pos.set(p.x, p.z);
    d.heading = s.face;
    d.f.root.visible = true;
    this.to(d, phase);
  }

  private to(d: Diner, phase: Phase) {
    d.phase = phase;
    d.t = 0;
    d.until = phase === 'away' ? 4 + Math.random() * 8 : phase === 'order' ? 4 : phase === 'wait' ? 4 + Math.random() * 3 : phase === 'eat' ? 9 + Math.random() * 5 : 0;
    const s = SEATS[d.seat];
    if (phase === 'walk') d.path = [world(LANE.x - RESTAURANT_AT.x, LANE.z - RESTAURANT_AT.z), RESTAURANT_DOOR, INSIDE, world(s.x, AISLE_Z), world(s.x, s.z)];
    if (phase === 'leave') d.path = [world(s.x, AISLE_Z), INSIDE, RESTAURANT_DOOR, LANE];
  }

  /** A seat no one else is heading for or sitting on. */
  private freeSeat(d: Diner) {
    const used = new Set(this.list.filter(o => o !== d && o.phase !== 'away').map(o => o.seat));
    const free = SEATS.map((_, i) => i).filter(i => !used.has(i));
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  update(dt: number, time: number) {
    for (const d of this.list) {
      d.t += dt;
      if (d.phase === 'away') {
        if (d.t < d.until) continue;
        const seat = this.freeSeat(d);
        if (seat === null) {
          d.t = 0;
          continue;
        }
        d.seat = seat;
        d.dish = Math.floor(Math.random() * BOWLS.length);
        (d.bubble.material as THREE.SpriteMaterial).map = this.textures[d.dish];
        (d.bowl.material as THREE.MeshLambertMaterial).color.set(BOWLS[d.dish].food);
        d.pos.set(LANE.x, LANE.z);
        d.f.root.visible = true;
        this.to(d, 'walk');
      }
      if (d.phase === 'walk' || d.phase === 'leave') {
        const aim = d.path[0];
        if (aim) {
          const dx = aim.x - d.pos.x;
          const dz = aim.z - d.pos.y;
          const dist = Math.hypot(dx, dz);
          const step = Math.min(dist, 1.6 * dt);
          if (dist > 0.04) {
            d.pos.x += (dx / dist) * step;
            d.pos.y += (dz / dist) * step;
            d.heading = Math.atan2(dx, dz);
          } else d.path.shift();
          d.walking = Math.min(1, d.walking + dt * 6);
        } else if (d.phase === 'walk') {
          d.heading = SEATS[d.seat].face;
          this.to(d, 'order');
        } else {
          d.f.root.visible = false;
          this.to(d, 'away');
        }
      } else {
        d.walking = Math.max(0, d.walking - dt * 6);
        if (d.t >= d.until) this.to(d, d.phase === 'order' ? 'wait' : d.phase === 'wait' ? 'eat' : 'leave');
      }
      this.pose(d, dt, time);
    }
  }

  private pose(d: Diner, dt: number, t: number) {
    const F = d.f;
    // up on the hall's floor indoors
    const indoors = Math.abs(d.pos.x - RESTAURANT_AT.x) < RESTAURANT_AT.w / 2 && Math.abs(d.pos.y - RESTAURANT_AT.z) < RESTAURANT_AT.d / 2;
    F.root.position.set(d.pos.x, indoors ? 0.1 : 0, d.pos.y);
    let r = d.heading - F.root.rotation.y;
    while (r > Math.PI) r -= Math.PI * 2;
    while (r < -Math.PI) r += Math.PI * 2;
    F.root.rotation.y += r * Math.min(1, dt * 10);
    const sitting = d.phase === 'order' || d.phase === 'wait' || d.phase === 'eat';
    const sw = Math.sin(t * 10 + d.seat) * 0.7 * d.walking;
    F.legL.rotation.x = sitting ? -1.45 : sw;
    F.legR.rotation.x = sitting ? -1.45 : -sw;
    F.armL.rotation.x = -sw * 0.8;
    F.armR.rotation.x = sw * 0.8;
    F.body.position.y = sitting ? -0.2 : Math.abs(Math.sin(t * 10 + d.seat)) * 0.05 * d.walking;
    // ordering: a hand up to call the cook; eating: a spoon to the mouth
    if (d.phase === 'order') F.armR.rotation.x = -2.4 + Math.sin(t * 5) * 0.15;
    if (d.phase === 'eat') F.armR.rotation.x = -1.4 + Math.sin(t * 5 + d.seat) * 0.45;
    d.bubble.visible = d.phase === 'order' || d.phase === 'wait';
    if (d.bubble.visible) d.bubble.position.set(d.pos.x, 2.35 + Math.sin(t * 3 + d.seat) * 0.05, d.pos.y);
    d.bowl.visible = d.phase === 'eat';
    if (d.bowl.visible) {
      const s = SEATS[d.seat];
      const p = world(s.table.x + (s.x < s.table.x ? -0.22 : 0.22), s.table.z);
      d.bowl.position.set(p.x, 0.86, p.z);
    }
  }

  /** The play-tests read where everyone is. */
  phases() {
    return this.list.map(d => d.phase);
  }

  dispose() {
    for (const tex of this.textures) tex.dispose();
    for (const d of this.list) {
      this.scene.remove(d.f.root, d.bubble, d.bowl);
      (d.bubble.material as THREE.SpriteMaterial).dispose();
      (d.bowl.material as THREE.Material).dispose();
    }
  }
}
