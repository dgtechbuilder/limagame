/* The mini farm tractor game, without any drawing: a small farm seen from above, with five rocks, three trees and
   four holes on it. The player drives the tractor and plough over the farm and has 30 seconds to plough it.
   · Plough MINI_FARM.goal (80%) of the land before the clock runs out to win.
   · A rock or a tree stops the tractor and costs MINI_FARM.bumpCost seconds off the clock.
   · A hole swallows the tractor: the game is lost on the spot.
   The numbers here are game tuning. MiniFarm.tsx draws it. */

export const MINI_FARM = {
  /** seconds on the clock */
  secs: 30,
  /** the farm, game pixels */
  w: 640,
  h: 300,
  /** share of the land to plough to win */
  goal: 0.8,
  /** seconds a knock on a rock or a tree costs */
  bumpCost: 3,
  /** how many of each thing are on the farm */
  count: { rock: 5, tree: 3, hole: 4 },
  /** the plough's working width, pixels */
  swath: 40,
  /** pixels a second, and radians a second of turning */
  speed: 240,
  turn: 6,
  /** win with this many seconds left (or more) for 3 or 2 stars */
  stars: [10, 5],
} as const;

/** Game seconds pass this much faster than real ones (automated play-tests only). */
export const miniClock = { scale: 1 };

export type Pt = [number, number];
export type ThingKind = 'rock' | 'tree' | 'hole';
export interface Thing {
  x: number;
  y: number;
  r: number;
  kind: ThingKind;
}
export const THING_NAME: Record<ThingKind, string> = { rock: 'a rock', tree: 'a tree', hole: 'a hole' };

export const CELL = 4;
/** Where the tractor starts: the farm gate, bottom left, heading right. */
export const START: Pt = [26, MINI_FARM.h - 22];
/** The tractor's own radius, for knocks. */
export const TRACTOR_R = 10;

export type Outcome = 'win' | 'time' | 'hole';
export interface MiniResult {
  outcome: Outcome;
  /** share of the land ploughed, 0 to 1 */
  share: number;
  /** seconds left on the clock (0 unless won) */
  left: number;
  /** seconds driven */
  secs: number;
  bumps: number;
  stars: 0 | 1 | 2 | 3;
}

export interface MiniFarm {
  w: number;
  h: number;
  things: Thing[];
  // the tractor
  x: number;
  y: number;
  hdg: number;
  v: number;
  /** seconds driven, and seconds lost to knocks */
  t: number;
  lost: number;
  bumps: number;
  bumpCd: number;
  /** the hole the tractor fell into, if it did */
  fell: Thing | null;
  // the grid of cells: 255 = not land (under a rock, tree or hole), 1 = ploughed
  gw: number;
  gh: number;
  cell: Uint8Array;
  total: number;
  ploughed: number;
  /** cells newly ploughed since the screen last drew them */
  fresh: number[];
  done: MiniResult | null;
}

export interface MiniControls {
  /** a point to drive to (tap, or hold to keep steering) */
  target: Pt | null;
  hold: boolean;
  keys: { up?: boolean; down?: boolean; left?: boolean; right?: boolean };
}

export function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
}
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const RADIUS: Record<ThingKind, [number, number]> = { rock: [10, 14], tree: [15, 18], hole: [12, 15] };
/** Space kept between two things (edge to edge) and between a thing and the fence, so the tractor fits round. */
const GAP = 2 * TRACTOR_R + 12;

/** A new farm: the same for the same seed. Things never touch each other, the fence or the gate. */
export function newMiniFarm(seed: string): MiniFarm {
  const { w, h } = MINI_FARM;
  const r = rand(`minifarm:${seed}`);
  const things: Thing[] = [];
  const kinds: ThingKind[] = [];
  for (const k of ['tree', 'rock', 'hole'] as ThingKind[]) for (let i = 0; i < MINI_FARM.count[k]; i++) kinds.push(k);
  for (const kind of kinds) {
    const [lo, hi] = RADIUS[kind];
    for (let tries = 0; tries < 400; tries++) {
      const rr = lo + r() * (hi - lo);
      const m = rr + GAP;
      const t: Thing = { x: m + r() * (w - 2 * m), y: m + r() * (h - 2 * m), r: rr, kind };
      if (Math.hypot(t.x - START[0], t.y - START[1]) < 90) continue;
      if (things.every(o => Math.hypot(o.x - t.x, o.y - t.y) > o.r + t.r + GAP)) {
        things.push(t);
        break;
      }
    }
  }
  // (400 tries always fit twelve things on this farm; a missing one would fail the tests)
  const gw = Math.ceil(w / CELL);
  const gh = Math.ceil(h / CELL);
  const d: MiniFarm = {
    w,
    h,
    things,
    x: START[0],
    y: START[1],
    hdg: 0,
    v: 0,
    t: 0,
    lost: 0,
    bumps: 0,
    bumpCd: 0,
    fell: null,
    gw,
    gh,
    cell: new Uint8Array(gw * gh),
    total: 0,
    ploughed: 0,
    fresh: [],
    done: null,
  };
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * CELL + CELL / 2;
      const y = gy * CELL + CELL / 2;
      if (things.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 4)) d.cell[gy * gw + gx] = 255;
      else d.total++;
    }
  return d;
}

/** Seconds left on the clock. */
export const timeLeft = (d: MiniFarm) => Math.max(0, MINI_FARM.secs - d.t - d.lost);
/** Share of the land ploughed so far. */
export const shareOf = (d: MiniFarm) => Math.min(1, d.ploughed / Math.max(1, d.total));

export type StepEvent = { kind: 'bump'; thing: ThingKind } | { kind: 'hole' } | null;

/** One frame of the game. Returns what happened, if anything did. */
export function stepMini(d: MiniFarm, dtReal: number, c: MiniControls): StepEvent {
  if (d.done) return null;
  const dt = Math.min(0.05, dtReal) * miniClock.scale;
  d.t += dt;
  d.bumpCd = Math.max(0, d.bumpCd - dt);
  if (timeLeft(d) <= 0) {
    finishMini(d, 'time');
    return null;
  }
  const k = c.keys;
  let want = 0;
  let rot = 0;
  if (k.up || k.left || k.right || k.down) {
    rot = ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * MINI_FARM.turn * dt;
    want = k.up ? MINI_FARM.speed : k.down ? -MINI_FARM.speed * 0.5 : 0;
  } else if (c.target) {
    const dx = c.target[0] - d.x;
    const dy = c.target[1] - d.y;
    const dist = Math.hypot(dx, dy);
    const diff = wrapA(Math.atan2(dy, dx) - d.hdg);
    if (!(dist < 8 && !c.hold)) {
      rot = Math.max(-MINI_FARM.turn * dt, Math.min(MINI_FARM.turn * dt, diff));
      const sharp = Math.abs(diff) > 1.2;
      want = c.hold && dist < 10 ? 0 : sharp ? (dist < 24 ? 24 : MINI_FARM.speed * 0.35) : MINI_FARM.speed * (Math.abs(diff) > 0.6 ? 0.65 : 1);
    }
  }
  d.hdg = wrapA(d.hdg + rot);
  d.v += Math.max(-900 * dt, Math.min(700 * dt, want - d.v));
  const dist = d.v * dt;
  const n = Math.max(1, Math.ceil(Math.abs(dist) / 3));
  const cs = Math.cos(d.hdg);
  const sn = Math.sin(d.hdg);
  let ev: StepEvent = null;
  for (let i = 0; i < n; i++) {
    const nx = Math.max(8, Math.min(d.w - 8, d.x + (cs * dist) / n));
    const ny = Math.max(8, Math.min(d.h - 8, d.y + (sn * dist) / n));
    // a hole takes the tractor when its middle is over the hole; a rock or a tree when it touches
    const o = d.things.find(o => Math.hypot(o.x - nx, o.y - ny) < (o.kind === 'hole' ? o.r : o.r + TRACTOR_R));
    if (o?.kind === 'hole') {
      d.x = nx;
      d.y = ny;
      d.v = 0;
      d.fell = o;
      finishMini(d, 'hole');
      return { kind: 'hole' };
    }
    if (o) {
      d.v = 0;
      if (d.bumpCd <= 0) {
        d.bumps++;
        d.bumpCd = 0.8;
        d.lost += MINI_FARM.bumpCost;
        ev = { kind: 'bump', thing: o.kind };
      }
      const a = Math.atan2(d.y - o.y, d.x - o.x);
      d.x = Math.max(8, Math.min(d.w - 8, d.x + Math.cos(a) * 4));
      d.y = Math.max(8, Math.min(d.h - 8, d.y + Math.sin(a) * 4));
      break;
    }
    d.x = nx;
    d.y = ny;
    if (dist > 0) plough(d);
  }
  if (shareOf(d) >= MINI_FARM.goal) finishMini(d, 'win');
  else if (timeLeft(d) <= 0) finishMini(d, 'time');
  return ev;
}

/** The plough turns the cells across its width, a little behind the tractor. */
function plough(d: MiniFarm) {
  const c = Math.cos(d.hdg);
  const s = Math.sin(d.hdg);
  const tx = d.x - c * 14;
  const ty = d.y - s * 14;
  const half = MINI_FARM.swath / 2;
  for (let o = -half + 1; o <= half - 1; o += CELL * 0.75) {
    const px = tx - s * o;
    const py = ty + c * o;
    if (px < 0 || py < 0 || px >= d.w || py >= d.h) continue;
    const i = Math.floor(py / CELL) * d.gw + Math.floor(px / CELL);
    if (d.cell[i] !== 0) continue;
    d.cell[i] = 1;
    d.ploughed++;
    d.fresh.push(i);
  }
}

export function starsFor(outcome: Outcome, left: number): MiniResult['stars'] {
  if (outcome !== 'win') return 0;
  return left >= MINI_FARM.stars[0] ? 3 : left >= MINI_FARM.stars[1] ? 2 : 1;
}

export function finishMini(d: MiniFarm, outcome: Outcome): MiniResult {
  if (d.done) return d.done;
  const left = outcome === 'win' ? Math.round(timeLeft(d) * 10) / 10 : 0;
  d.done = { outcome, share: shareOf(d), left, secs: Math.round(d.t * 10) / 10, bumps: d.bumps, stars: starsFor(outcome, left) };
  return d.done;
}
