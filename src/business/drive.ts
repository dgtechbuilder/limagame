/* The tractor minigame of the business day, without any drawing: at each farm the tractor stops at, the player
   drives it for ten seconds. A field job (plough, harrow, ridge, plant, spread, harvest) is a field seen from above:
   the implement works a swath behind the tractor, and the field efficiency is the share of the field worked before
   the time is up. A transport job is a haulage run: the loaded trailer rolls down a murram road with potholes, the
   player changes lane to miss them, and every pothole hit loses a bag. Both come to one number, the field efficiency
   e (0 to 1), which model.ts turns into how much of the job got done (BASELINE, the hub driver's 70%, is the whole
   job). The numbers here are game tuning. */

import type { BizTool, BizTractor } from './model';

/** Seconds a drive lasts. */
export const DRIVE_SECS = 10;
/** Game seconds pass this much faster than real ones (automated play-tests only). */
export const driveClock = { scale: 1 };

export type Pt = [number, number];

export interface DriveResult {
  /** field efficiency, 0 to 1 */
  e: number;
  secs: number;
  hits: number;
  /** one line for the screen */
  detail: string;
  reason: 'time' | 'done';
}

function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
}
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------------- the field drive ---------------- */

export const FIELD_W = 420;
/** The field is as tall as this many passes of the implement: a tidy serpentine takes about eight seconds. */
export const PASSES = 4;
/** The working width of each tool, game pixels. */
export const SWATH: Record<BizTool, number> = { plough: 36, harrow: 46, ridger: 30, planter: 40, spreader: 54, harvester: 42, combine: 50, trailer: 0 };
/** Pixels a second, and radians a second of turning, for a standard tractor; the large one is faster, turns wider. */
export const FIELD_SPEED: Record<BizTractor, { v: number; w: number }> = { standard: { v: 340, w: 6 }, large: { v: 400, w: 5 } };
export const CELL = 4;

export type ObstacleKind = 'rock' | 'tree' | 'stump';
export interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: ObstacleKind;
}
export const OBSTACLE_NAME: Record<ObstacleKind, string> = { rock: 'a rock', tree: 'a tree', stump: 'a stump' };

export interface FieldDrive {
  kind: 'field';
  tool: BizTool;
  w: number;
  h: number;
  swath: number;
  speed: number;
  turn: number;
  size: number;
  obs: Obstacle[];
  // the tractor
  x: number;
  y: number;
  hdg: number;
  v: number;
  t: number;
  hits: number;
  hitCd: number;
  // the grid of cells, and how often each was worked
  gw: number;
  gh: number;
  cnt: Uint8Array;
  /** when each cell was last worked: a pass over the same cell counts once */
  last: Float32Array;
  total: number;
  covered: number;
  overlap: number;
  /** cells newly worked since the screen last drew them */
  fresh: number[];
  done: DriveResult | null;
}

export interface FieldControls {
  /** a point to drive to (tap, or hold to keep steering) */
  target: Pt | null;
  hold: boolean;
  keys: { up?: boolean; down?: boolean; left?: boolean; right?: boolean };
}

/** A field for a job: five passes tall, one or two things in the way (the same for the same farm and day). */
export function newFieldDrive(seed: string, tool: BizTool, tractor: BizTractor): FieldDrive {
  const r = rand(`field:${seed}`);
  // (capped so the field fits the map box on the stage)
  const swath = Math.min(56, SWATH[tool] * (tractor === 'large' ? 1.15 : 1));
  const h = Math.floor(PASSES * swath);
  const obs: Obstacle[] = [];
  const n = r() < 0.5 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const o: Obstacle = { x: 90 + r() * (FIELD_W - 140), y: 24 + r() * (h - 48), r: 9 + r() * 6, kind: (['rock', 'tree', 'stump'] as ObstacleKind[])[Math.floor(r() * 3)] };
      if (obs.every(p => Math.hypot(p.x - o.x, p.y - o.y) > 90)) {
        obs.push(o);
        break;
      }
    }
  }
  const gw = Math.ceil(FIELD_W / CELL);
  const gh = Math.ceil(h / CELL);
  const d: FieldDrive = {
    kind: 'field',
    tool,
    w: FIELD_W,
    h,
    swath,
    speed: FIELD_SPEED[tractor].v,
    turn: FIELD_SPEED[tractor].w,
    size: tractor === 'large' ? 1.15 : 1,
    obs,
    x: 18,
    y: swath / 2,
    hdg: 0,
    v: 0,
    t: 0,
    hits: 0,
    hitCd: 0,
    gw,
    gh,
    cnt: new Uint8Array(gw * gh),
    last: new Float32Array(gw * gh).fill(-9),
    total: 0,
    covered: 0,
    overlap: 0,
    fresh: [],
    done: null,
  };
  // the cells to work: the field less what is in the way
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * CELL + CELL / 2;
      const y = gy * CELL + CELL / 2;
      if (obs.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 3)) d.cnt[gy * gw + gx] = 255;
      else d.total++;
    }
  return d;
}

/** One frame of the field drive. Returns the thing hit, if one was. */
export function stepField(d: FieldDrive, dtReal: number, c: FieldControls): ObstacleKind | null {
  if (d.done) return null;
  const dt = Math.min(0.05, dtReal) * driveClock.scale;
  d.t += dt;
  d.hitCd = Math.max(0, d.hitCd - dt);
  if (d.t >= DRIVE_SECS) {
    finishField(d, 'time');
    return null;
  }
  const k = c.keys;
  let want = 0;
  let rot = 0;
  if (k.up || k.left || k.right || k.down) {
    rot = ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * d.turn * dt;
    want = k.up ? d.speed : k.down ? -d.speed * 0.5 : 0;
  } else if (c.target) {
    const dx = c.target[0] - d.x;
    const dy = c.target[1] - d.y;
    const dist = Math.hypot(dx, dy);
    const diff = wrapA(Math.atan2(dy, dx) - d.hdg);
    if (!(dist < 8 && !c.hold)) {
      rot = Math.max(-d.turn * dt, Math.min(d.turn * dt, diff));
      const sharp = Math.abs(diff) > 1.2;
      want = c.hold && dist < 10 ? 0 : sharp ? (dist < 24 ? 24 : d.speed * 0.35) : d.speed * (Math.abs(diff) > 0.6 ? 0.65 : 1);
    }
  }
  d.hdg = wrapA(d.hdg + rot);
  d.v += Math.max(-900 * dt, Math.min(700 * dt, want - d.v));
  const dist = d.v * dt;
  const n = Math.max(1, Math.ceil(Math.abs(dist) / 3));
  const cs = Math.cos(d.hdg);
  const sn = Math.sin(d.hdg);
  const rad = 10 * d.size;
  let hit: ObstacleKind | null = null;
  for (let i = 0; i < n; i++) {
    const nx = Math.max(8, Math.min(d.w - 8, d.x + (cs * dist) / n));
    const ny = Math.max(8, Math.min(d.h - 8, d.y + (sn * dist) / n));
    const o = d.obs.find(o => Math.hypot(o.x - nx, o.y - ny) < o.r + rad);
    if (o) {
      d.v = 0;
      if (d.hitCd <= 0) {
        d.hits++;
        d.hitCd = 1;
        hit = o.kind;
      }
      const a = Math.atan2(d.y - o.y, d.x - o.x);
      d.x = Math.max(8, Math.min(d.w - 8, d.x + Math.cos(a) * 3));
      d.y = Math.max(8, Math.min(d.h - 8, d.y + Math.sin(a) * 3));
      break;
    }
    d.x = nx;
    d.y = ny;
    if (dist > 0) markField(d);
  }
  if (d.covered >= d.total * 0.97) finishField(d, 'done');
  return hit;
}

/** The implement works the cells across its swath, a little behind the tractor. */
function markField(d: FieldDrive) {
  const c = Math.cos(d.hdg);
  const s = Math.sin(d.hdg);
  const tx = d.x - c * 14;
  const ty = d.y - s * 14;
  const half = d.swath / 2;
  for (let o = -half + 1; o <= half - 1; o += CELL * 0.75) {
    const px = tx - s * o;
    const py = ty + c * o;
    if (px < 0 || py < 0 || px >= d.w || py >= d.h) continue;
    const i = Math.floor(py / CELL) * d.gw + Math.floor(px / CELL);
    const was = d.cnt[i];
    if (was === 255) continue;
    if (d.t - d.last[i] > 0.6) {
      if (was === 0) {
        d.covered++;
        d.fresh.push(i);
      } else if (was === 1) {
        d.overlap++;
        d.fresh.push(i);
      }
      if (was < 200) d.cnt[i] = was + 1;
    }
    d.last[i] = d.t;
  }
}

export function finishField(d: FieldDrive, reason: DriveResult['reason']): DriveResult {
  if (d.done) return d.done;
  const e = Math.min(1, d.covered / Math.max(1, d.total));
  const over = d.covered ? d.overlap / d.covered : 0;
  const pct = Math.round(e * 100);
  const detail = `${pct}% of the field worked${over > 0.25 ? `, ${Math.round(over * 100)}% of it twice` : over > 0.1 ? ', a little overlap' : pct >= 90 ? ', clean rows' : ''}${d.hits ? `, ${d.hits} knock${d.hits === 1 ? '' : 's'}` : ''}.`;
  d.done = { e, secs: Math.round(d.t * 10) / 10, hits: d.hits, detail, reason };
  return d.done;
}

/* ---------------- the haulage run ---------------- */

export const ROAD_W = 420;
/** (the road fits the map box on the stage under the drive's HUD) */
export const ROAD_H = 200;
export const LANES = 3;
export const BAGS = 10;
/** How fast the road rolls by, pixels a second. */
export const HAUL_SPEED: Record<BizTractor, number> = { standard: 250, large: 290 };
/** Where the tractor sits on the road (y), and how fast it changes lane (pixels a second). */
export const HAUL_Y = ROAD_H - 56;
export const LANE_CHANGE = 620;
export const laneX = (lane: number) => (ROAD_W / LANES) * (lane + 0.5);

export type HoleKind = 'pothole' | 'puddle' | 'rut';
export interface Hole {
  y: number;
  lane: number;
  kind: HoleKind;
  hit: boolean;
}
export const HOLE_NAME: Record<HoleKind, string> = { pothole: 'a pothole', puddle: 'a puddle', rut: 'a rut' };

export interface HaulDrive {
  kind: 'haul';
  tool: 'trailer';
  w: number;
  h: number;
  speed: number;
  size: number;
  /** the lane the player wants, and where the tractor is on its way there */
  lane: number;
  x: number;
  t: number;
  bags: number;
  hits: number;
  /** a bump just now, for the screen (seconds left) */
  jolt: number;
  holes: Hole[];
  /** road pixels rolled so far (the stripes) */
  rolled: number;
  done: DriveResult | null;
}

/** A road for the run: potholes the whole way, never two abreast, the same for the same farm and day. */
export function newHaulDrive(seed: string, tractor: BizTractor): HaulDrive {
  const r = rand(`haul:${seed}`);
  const speed = HAUL_SPEED[tractor];
  const holes: Hole[] = [];
  let lane = 1;
  for (let y = -160; y > -(DRIVE_SECS + 1) * speed; y -= 60 + r() * 50) {
    // the next hole is in a lane near the last, so the road reads as one line to steer along
    lane = Math.max(0, Math.min(LANES - 1, lane + (r() < 0.5 ? -1 : 1) * (r() < 0.75 ? 1 : 2)));
    holes.push({ y, lane, kind: (['pothole', 'puddle', 'rut'] as HoleKind[])[Math.floor(r() * 3)], hit: false });
  }
  return { kind: 'haul', tool: 'trailer', w: ROAD_W, h: ROAD_H, speed, size: tractor === 'large' ? 1.15 : 1, lane: 1, x: laneX(1), t: 0, bags: BAGS, hits: 0, jolt: 0, holes, rolled: 0, done: null };
}

/** One frame of the run: the road rolls down, the tractor eases to its lane, a hole under it costs a bag. */
export function stepHaul(d: HaulDrive, dtReal: number): HoleKind | null {
  if (d.done) return null;
  const dt = Math.min(0.05, dtReal) * driveClock.scale;
  d.t += dt;
  d.jolt = Math.max(0, d.jolt - dt);
  if (d.t >= DRIVE_SECS) {
    finishHaul(d);
    return null;
  }
  const move = d.speed * dt;
  d.rolled += move;
  const tx = laneX(d.lane);
  d.x += Math.max(-LANE_CHANGE * dt, Math.min(LANE_CHANGE * dt, tx - d.x));
  let hit: HoleKind | null = null;
  for (const h of d.holes) {
    h.y += move;
    if (!h.hit && h.y > HAUL_Y - 16 && h.y < HAUL_Y + 16 && Math.abs(laneX(h.lane) - d.x) < ROAD_W / LANES / 2 - 8) {
      h.hit = true;
      d.hits++;
      d.bags = Math.max(0, d.bags - 1);
      d.jolt = 0.35;
      hit = h.kind;
    }
  }
  return hit;
}

export function finishHaul(d: HaulDrive): DriveResult {
  if (d.done) return d.done;
  const e = d.bags / BAGS;
  d.done = { e, secs: DRIVE_SECS, hits: d.hits, detail: `${d.bags} of ${BAGS} bags delivered${d.hits ? `: ${d.hits} pothole${d.hits === 1 ? '' : 's'} hit` : ', not one lost'}.`, reason: 'time' };
  return d.done;
}

export type Drive = FieldDrive | HaulDrive;

/** The drive for a job: the haulage run for transport, the field for everything else. */
export const newDrive = (seed: string, tool: BizTool, tractor: BizTractor): Drive => (tool === 'trailer' ? newHaulDrive(seed, tractor) : newFieldDrive(seed, tool, tractor));
