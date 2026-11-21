/* The tractor minigame of the business day, without any drawing. Once the day starts the player drives the whole
   route without a break: the road from the yard to each farm, the job at each farm, and the road home, while a green
   line at the top of the screen shows the tractor moving from farm to farm (DayDrive.tsx draws it all).

   · A field job (plough, harrow, ridge, plant, spread, harvest) is a field from above with its crop rows: the
     implement works a swath behind the tractor, round a tree or a rock and a scatter of small stones. The field
     efficiency is the share of the field worked before the time is up. Stones are kicked aside (they slow the
     tractor); trees, rocks and stumps stop it dead.
   · A transport job is a haulage run along the murram road: the loaded trailer rolls on, the player changes lane to
     miss potholes, puddles, ruts and stones, and every one hit loses a bag.
   · The road between farms is the same road without a load: nothing to lose, but the bumps are felt.

   Each job comes to one number, the field efficiency e (0 to 1), which model.ts turns into how much of the job got
   done (BASELINE, the hub driver's 70%, is the whole job). Speed and steering follow Settings → Tractor (DriveTune);
   the time a field allows grows when the tractor is slower, so every speed is a fair game. The numbers here are game
   tuning. */

import type { BizTool, BizTractor } from './model';

/** The drive's view, game pixels: the map box less the route strip and the clock's bar at its top. */
export const VIEW_W = 520;
export const VIEW_H = 202;
/** Seconds a haulage run lasts. */
export const HAUL_SECS = 12;
/** (kept for older callers: the shortest a job can last) */
export const DRIVE_SECS = 10;
/** Game seconds pass this much faster than real ones (automated play-tests only). */
export const driveClock = { scale: 1 };

export type Pt = [number, number];

/** How the player likes the tractor to handle (Settings → Tractor): multipliers on the standard tractor. */
export interface DriveTune {
  /** driving speed: 1 is the standard tractor's working pace */
  speed: number;
  /** steering: how fast the tractor turns and changes lane */
  steer: number;
}
export const DEFAULT_TUNE: DriveTune = { speed: 1, steer: 1 };

export interface DriveResult {
  /** field efficiency, 0 to 1 */
  e: number;
  secs: number;
  hits: number;
  /** one line for the screen */
  detail: string;
  reason: 'time' | 'done' | 'driver';
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
export { rand as seeded };
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Something the tractor ran into this frame, for the sound and the dust. */
export interface DriveHit {
  kind: ObstacleKind | HoleKind;
  x: number;
  y: number;
  /** a hard stop (a tree, a rock, a stump) rather than a bump */
  hard: boolean;
}

/* ---------------- the field drive ---------------- */

export const FIELD_W = 440;
/** The field is as tall as this many passes of the implement. */
export const PASSES = 4;
/** The working width of each tool, game pixels. */
export const SWATH: Record<BizTool, number> = { plough: 36, harrow: 44, ridger: 32, planter: 40, spreader: 48, harvester: 40, combine: 46, trailer: 0 };
/** Pixels a second, and radians a second of turning, for a standard tractor at the standard speed: a steady working
    pace. The large one is a little faster and turns a little wider. */
export const FIELD_SPEED: Record<BizTractor, { v: number; w: number }> = { standard: { v: 160, w: 2.9 }, large: { v: 185, w: 2.6 } };
export const CELL = 4;

export type ObstacleKind = 'rock' | 'tree' | 'stump' | 'stone';
export interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: ObstacleKind;
  /** a stone kicked by the implement rolls: its speed, pixels a second */
  vx: number;
  vy: number;
  /** a knock just now (seconds left), for a tree's sway and a rock's flash */
  wob: number;
  /** the shape: a seed for the screen */
  seed: number;
}
export const OBSTACLE_NAME: Record<ObstacleKind, string> = { rock: 'a rock', tree: 'a tree', stump: 'a stump', stone: 'a stone' };

export interface FieldDrive {
  kind: 'field';
  tool: BizTool;
  w: number;
  h: number;
  swath: number;
  speed: number;
  turn: number;
  size: number;
  /** seconds this field allows */
  secs: number;
  obs: Obstacle[];
  // the tractor
  x: number;
  y: number;
  hdg: number;
  v: number;
  t: number;
  hits: number;
  stones: number;
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
  /** the implement is in the ground this frame (moving forward) */
  working: boolean;
  done: DriveResult | null;
}

export interface FieldControls {
  /** a point to drive to (tap, or hold to keep steering) */
  target: Pt | null;
  hold: boolean;
  keys: { up?: boolean; down?: boolean; left?: boolean; right?: boolean };
}

/** The seconds a field allows: room for a tidy serpentine at this speed, its turns and a knock or two. A slow
    steering setting turns wider, so it is given a little longer too. */
export function fieldSecs(swath: number, speed: number, steer = 1) {
  const path = PASSES * (FIELD_W - 28) + (PASSES - 1) * ((Math.PI * swath) / 2);
  const wide = Math.pow(Math.max(1, 1 / steer), 0.8);
  return Math.max(DRIVE_SECS, Math.round((path / speed) * 2.2 * wide * 2) / 2);
}

/** A field for a job: four passes tall, a tree, rock or stump or two and a scatter of small stones (the same for the
    same farm and day). */
export function newFieldDrive(seed: string, tool: BizTool, tractor: BizTractor, tune: DriveTune = DEFAULT_TUNE): FieldDrive {
  const r = rand(`field:${seed}`);
  // (capped so the field fits the view with a margin of grass round it)
  const swath = Math.min(48, SWATH[tool] * (tractor === 'large' ? 1.1 : 1));
  const h = Math.floor(PASSES * swath);
  const obs: Obstacle[] = [];
  const mk = (x: number, y: number, rad: number, kind: ObstacleKind): Obstacle => ({ x, y, r: rad, kind, vx: 0, vy: 0, wob: 0, seed: Math.floor(r() * 1e6) });
  const n = r() < 0.5 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const o = mk(90 + r() * (FIELD_W - 140), 24 + r() * (h - 48), 9 + r() * 6, (['rock', 'tree', 'stump'] as ObstacleKind[])[Math.floor(r() * 3)]);
      if (obs.every(p => Math.hypot(p.x - o.x, p.y - o.y) > 90)) {
        obs.push(o);
        break;
      }
    }
  }
  // small stones, away from the bigger things and the gate
  const big = obs.length;
  const stones = 5 + Math.floor(r() * 4);
  for (let i = 0; i < stones; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const o = mk(60 + r() * (FIELD_W - 80), 8 + r() * (h - 16), 3 + r() * 2.2, 'stone');
      if (obs.every((p, k) => Math.hypot(p.x - o.x, p.y - o.y) > (k < big ? p.r + 26 : 30))) {
        obs.push(o);
        break;
      }
    }
  }
  const gw = Math.ceil(FIELD_W / CELL);
  const gh = Math.ceil(h / CELL);
  const base = FIELD_SPEED[tractor];
  const speed = base.v * tune.speed;
  const d: FieldDrive = {
    kind: 'field',
    tool,
    w: FIELD_W,
    h,
    swath,
    speed,
    // turning keeps pace with the speed, so the turning circle is the same at every speed; steering tightens it
    turn: base.w * tune.speed * tune.steer,
    size: tractor === 'large' ? 1.12 : 1,
    secs: fieldSecs(swath, speed, tune.steer),
    obs,
    x: 18,
    y: swath / 2,
    hdg: 0,
    v: 0,
    t: 0,
    hits: 0,
    stones: 0,
    hitCd: 0,
    gw,
    gh,
    cnt: new Uint8Array(gw * gh),
    last: new Float32Array(gw * gh).fill(-9),
    total: 0,
    covered: 0,
    overlap: 0,
    working: false,
    done: null,
  };
  // the cells to work: the field less what stands in it (stones are kicked aside, so they do not count)
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * CELL + CELL / 2;
      const y = gy * CELL + CELL / 2;
      if (obs.some(o => o.kind !== 'stone' && Math.hypot(o.x - x, o.y - y) < o.r + 3)) d.cnt[gy * gw + gx] = 255;
      else d.total++;
    }
  return d;
}

/** One frame of the field drive. Returns what was hit, if anything. */
export function stepField(d: FieldDrive, dtReal: number, c: FieldControls): DriveHit | null {
  if (d.done) return null;
  const dt = Math.min(0.05, dtReal) * driveClock.scale;
  d.t += dt;
  d.hitCd = Math.max(0, d.hitCd - dt);
  for (const o of d.obs) {
    o.wob = Math.max(0, o.wob - dt);
    if (o.vx || o.vy) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      const f = Math.exp(-5 * dt);
      o.vx *= f;
      o.vy *= f;
      if (Math.hypot(o.vx, o.vy) < 4) o.vx = o.vy = 0;
    }
  }
  if (d.t >= d.secs) {
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
      want = c.hold && dist < 10 ? 0 : sharp ? (dist < 24 ? d.speed * 0.12 : d.speed * 0.35) : d.speed * (Math.abs(diff) > 0.6 ? 0.65 : 1);
    }
  }
  d.hdg = wrapA(d.hdg + rot);
  // a tractor gathers speed and slows gently (the brakes bite harder than the throttle pulls)
  d.v += Math.max(-d.speed * 2.6 * dt, Math.min(d.speed * 2 * dt, want - d.v));
  const dist = d.v * dt;
  const n = Math.max(1, Math.ceil(Math.abs(dist) / 3));
  const cs = Math.cos(d.hdg);
  const sn = Math.sin(d.hdg);
  const rad = 10 * d.size;
  let hit: DriveHit | null = null;
  d.working = false;
  for (let i = 0; i < n; i++) {
    const nx = Math.max(8, Math.min(d.w - 8, d.x + (cs * dist) / n));
    const ny = Math.max(8, Math.min(d.h - 8, d.y + (sn * dist) / n));
    // a stone in front of the wheels or under the implement is kicked aside, and slows the tractor
    for (const o of d.obs) {
      if (o.kind !== 'stone' || o.vx || o.vy) continue;
      if (o.x < 0 || o.y < 0 || o.x > d.w || o.y > d.h) continue;
      if (Math.hypot(o.x - nx, o.y - ny) < o.r + rad * 0.9) {
        // away to the side the stone is on, and a little forward
        const side = (o.x - nx) * -sn + (o.y - ny) * cs >= 0 ? 1 : -1;
        const sp = 110 + (o.seed % 60);
        o.vx = -sn * side * sp + cs * sp * 0.4 * Math.sign(dist || 1);
        o.vy = cs * side * sp + sn * sp * 0.4 * Math.sign(dist || 1);
        o.wob = 0.4;
        d.v *= 0.45;
        d.stones++;
        hit ??= { kind: 'stone', x: o.x, y: o.y, hard: false };
      }
    }
    // the body, and going forward the nose of the bonnet, stop at a tree, a rock or a stump
    const nose: Pt = [nx + cs * 12 * d.size, ny + sn * 12 * d.size];
    const o = d.obs.find(o => o.kind !== 'stone' && (Math.hypot(o.x - nx, o.y - ny) < o.r + rad || (dist > 0 && Math.hypot(o.x - nose[0], o.y - nose[1]) < o.r + 4)));
    if (o) {
      d.v = 0;
      if (d.hitCd <= 0) {
        d.hits++;
        d.hitCd = 1;
        o.wob = 0.7;
        hit = { kind: o.kind, x: (o.x + d.x) / 2, y: (o.y + d.y) / 2, hard: true };
      }
      const a = Math.atan2(d.y - o.y, d.x - o.x);
      d.x = Math.max(8, Math.min(d.w - 8, d.x + Math.cos(a) * 3));
      d.y = Math.max(8, Math.min(d.h - 8, d.y + Math.sin(a) * 3));
      break;
    }
    d.x = nx;
    d.y = ny;
    if (dist > 0) {
      d.working = true;
      markField(d);
    }
  }
  if (d.covered >= d.total * 0.97) finishField(d, 'done');
  return hit;
}

/** Where the implement's bar is: its two ends, a little behind the tractor. */
export function implementBar(d: FieldDrive): [Pt, Pt] {
  const c = Math.cos(d.hdg);
  const s = Math.sin(d.hdg);
  const tx = d.x - c * 14;
  const ty = d.y - s * 14;
  const half = d.swath / 2;
  return [
    [tx + s * half, ty - c * half],
    [tx - s * half, ty + c * half],
  ];
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
      if (was === 0) d.covered++;
      else if (was === 1) d.overlap++;
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
  const knocks = [d.hits ? `${d.hits} knock${d.hits === 1 ? '' : 's'}` : '', d.stones ? `${d.stones} stone${d.stones === 1 ? '' : 's'} kicked` : ''].filter(Boolean).join(', ');
  const detail = `${pct}% of the field worked${over > 0.25 ? `, ${Math.round(over * 100)}% of it twice` : over > 0.1 ? ', a little overlap' : pct >= 90 ? ', clean rows' : ''}${knocks ? `, ${knocks}` : ''}.`;
  d.done = { e, secs: Math.round(d.t * 10) / 10, hits: d.hits, detail, reason };
  return d.done;
}

/* ---------------- the road: haulage runs, and the way between farms ---------------- */

export const ROAD_W = VIEW_W;
export const ROAD_H = VIEW_H;
export const LANES = 3;
export const BAGS = 10;
/** The road's band across the view (y), and each lane's height. */
export const ROAD_TOP = 50;
export const LANE_H = 34;
/** How fast the road rolls by at the standard speed, pixels a second. */
export const HAUL_SPEED: Record<BizTractor, number> = { standard: 150, large: 172 };
/** Where the tractor's front sits on the road (x), and how fast it changes lane at the standard steering. */
export const HAUL_X = 190;
export const LANE_CHANGE = 190;
export const laneY = (lane: number) => ROAD_TOP + LANE_H * (lane + 0.5);

export type HoleKind = 'pothole' | 'puddle' | 'rut' | 'rubble';
export interface Hole {
  x: number;
  lane: number;
  kind: HoleKind;
  hit: boolean;
}
export const HOLE_NAME: Record<HoleKind, string> = { pothole: 'a pothole', puddle: 'a puddle', rut: 'a rut', rubble: 'some stones' };

export interface HaulDrive {
  kind: 'haul';
  tool: 'trailer';
  /** a loaded run (a transport job, scored by the bags) or the empty road between farms */
  load: boolean;
  w: number;
  h: number;
  speed: number;
  steer: number;
  size: number;
  secs: number;
  /** the lane the player wants, and where the tractor is on its way there (y) */
  lane: number;
  y: number;
  t: number;
  bags: number;
  hits: number;
  /** a bump just now, for the screen (seconds left) */
  jolt: number;
  holes: Hole[];
  /** road pixels rolled so far (the scenery) */
  rolled: number;
  done: DriveResult | null;
}

/** A road: holes the whole way, never two abreast, the same for the same seed. The empty road between farms has
    fewer, and none in its first and last second (the field slides in then). */
export function newHaulDrive(seed: string, tractor: BizTractor, tune: DriveTune = DEFAULT_TUNE, opts: { load?: boolean; secs?: number } = {}): HaulDrive {
  const load = opts.load ?? true;
  const secs = opts.secs ?? HAUL_SECS;
  const r = rand(`haul:${seed}`);
  const speed = HAUL_SPEED[tractor] * tune.speed;
  const holes: Hole[] = [];
  let lane = 1;
  const first = load ? 1.1 : 1;
  const lastX = HAUL_X + (secs - (load ? 0.3 : 1.2)) * speed;
  for (let x = HAUL_X + first * speed; x < lastX; x += (load ? 1 : 1.6) * speed * (0.5 + r() * 0.3)) {
    // the next hole is in a lane near the last, so the road reads as one line to steer along
    lane = Math.max(0, Math.min(LANES - 1, lane + (r() < 0.5 ? -1 : 1) * (r() < 0.75 ? 1 : 2)));
    holes.push({ x, lane, kind: (['pothole', 'puddle', 'rut', 'rubble'] as HoleKind[])[Math.floor(r() * 4)], hit: false });
  }
  return { kind: 'haul', tool: 'trailer', load, w: ROAD_W, h: ROAD_H, speed, steer: LANE_CHANGE * tune.steer * Math.max(0.8, tune.speed), size: tractor === 'large' ? 1.12 : 1, secs, lane: 1, y: laneY(1), t: 0, bags: BAGS, hits: 0, jolt: 0, holes, rolled: 0, done: null };
}

/** One frame of the road: it rolls by, the tractor eases to its lane, a hole under it is a bump (and, loaded, a bag). */
export function stepHaul(d: HaulDrive, dtReal: number): DriveHit | null {
  if (d.done) return null;
  const dt = Math.min(0.05, dtReal) * driveClock.scale;
  d.t += dt;
  d.jolt = Math.max(0, d.jolt - dt);
  if (d.t >= d.secs) {
    finishHaul(d);
    return null;
  }
  const move = d.speed * dt;
  d.rolled += move;
  const ty = laneY(d.lane);
  d.y += Math.max(-d.steer * dt, Math.min(d.steer * dt, ty - d.y));
  let hit: DriveHit | null = null;
  for (const h of d.holes) {
    const was = h.x;
    h.x -= move;
    // under the wheels when it passes the middle of the tractor (however far the road rolled this frame)
    if (!h.hit && was >= HAUL_X - 12 && h.x < HAUL_X - 12 && Math.abs(laneY(h.lane) - d.y) < LANE_H / 2 + 2) {
      h.hit = true;
      d.hits++;
      if (d.load) d.bags = Math.max(0, d.bags - 1);
      d.jolt = 0.35;
      hit = { kind: h.kind, x: h.x, y: laneY(h.lane), hard: false };
    }
  }
  return hit;
}

export function finishHaul(d: HaulDrive): DriveResult {
  if (d.done) return d.done;
  const e = d.load ? d.bags / BAGS : 1;
  d.done = {
    e,
    secs: d.secs,
    hits: d.hits,
    detail: d.load ? `${d.bags} of ${BAGS} bags delivered${d.hits ? `: ${d.hits} pothole${d.hits === 1 ? '' : 's'} hit` : ', not one lost'}.` : d.hits ? `${d.hits} bump${d.hits === 1 ? '' : 's'} on the road.` : 'A smooth ride.',
    reason: 'time',
  };
  return d.done;
}

export type Drive = FieldDrive | HaulDrive;

/** The drive for a job: the haulage run for transport, the field for everything else. */
export const newDrive = (seed: string, tool: BizTool, tractor: BizTractor, tune: DriveTune = DEFAULT_TUNE): Drive => (tool === 'trailer' ? newHaulDrive(seed, tractor, tune) : newFieldDrive(seed, tool, tractor, tune));

/** The seconds the road between two places takes, from its length on the map (pixels). */
export const travelSecs = (px: number) => Math.max(3, Math.min(7, 2 + px / 70));
