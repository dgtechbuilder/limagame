/* From Wakala Agent: the tractor drive, without any drawing (ported from Wakala's planRoute, jobSetup, jobReset,
   jobStep, jobMark, jobWater and jobFinish). The field is a grid of 2.5-pixel cells in a 580 × 370 drive area: the
   implement marks cells as it passes, and every score is counted from the grid. Before-planting jobs only for now:
   no grain tank or trailer. */

import { FARM_ACRES, IMPL, LAYOUTS, MONEY, TRACTORS, TRACTOR_REWARD, fitOf, type FarmLayout, type ImplId, type Implement, type Obstacle, type TractorKind } from './data';

export const FW = 580;
export const FH = 370;
export const CELL = 2.5;
export const GW = Math.ceil(FW / CELL);
export const GH = Math.ceil(FH / CELL);

type Rect = [number, number, number, number];
type Pt = [number, number];

export const inRects = (rs: Rect[], x: number, y: number) => rs.some(r => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]);
const dRect = (r: Rect, x: number, y: number) => Math.hypot(Math.max(r[0] - x, 0, x - r[0] - r[2]), Math.max(r[1] - y, 0, y - r[1] - r[3]));
export const dObs = (o: Obstacle, x: number, y: number) => ('rect' in o ? dRect(o.rect, x, y) : Math.hypot(x - o.x, y - o.y) - o.r);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Autopilot's route (and the ideal one the time limit and fuel are measured against): serpentine rows, or down
    each furrow line. */
export function planRoute(field: Rect[], obs: Obstacle[], tw: number, strips: number[] | null, back: number): Pt[] {
  const wps: Pt[] = [];
  const xs = field.flatMap(r => [r[0], r[0] + r[2]]);
  const ys = field.flatMap(r => [r[1], r[1] + r[3]]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (strips) {
    strips.forEach((sx, i) => {
      const a: Pt = [sx, y0 - 10 - back];
      const b: Pt = [sx, y1 + 6 + back];
      if (i % 2 === 0) wps.push(a, [sx, y1 - 2], b);
      else wps.push(b, [sx, y0 + 2], a);
    });
    return wps;
  }
  const clear = (x: number, y: number) => inRects(field, x, y) && obs.every(o => dObs(o, x, y) >= tw / 2 + 10);
  const ext = (o: Obstacle): [number, number, number, number] => ('rect' in o ? [o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3] / 2, o.rect[2] / 2, o.rect[3] / 2] : [o.x, o.y, o.r, o.r]);
  let dir = 1;
  for (let y = y0 + tw * 0.46; y < y1 - tw * 0.15; y += tw * 0.92) {
    const segs: Pt[] = [];
    let st: number | null = null;
    for (let x = x0; x <= x1; x += 4) {
      const ok = clear(x, y);
      if (ok && st === null) st = x;
      if ((!ok || x + 4 > x1) && st !== null) {
        segs.push([st, ok ? x : x - 4]);
        st = null;
      }
    }
    if (!segs.length) continue;
    const order: Pt[] = dir > 0 ? segs : segs.slice().reverse().map(s => [s[1], s[0]] as Pt);
    order.forEach((s, i) => {
      if (i === 0) wps.push([s[0] - dir * 22, y]);
      else {
        // something blocks the row between two clear stretches: step sideways just past it, drive by, and step back
        const px = wps[wps.length - 1][0];
        const xa = Math.min(px, s[0]) - 6;
        const xb = Math.max(px, s[0]) + 6;
        const inSpan = (o: Obstacle) => {
          const [ox, , hx] = ext(o);
          return ox + hx > xa && ox - hx < xb;
        };
        const blocks = (o: Obstacle, yy: number) => {
          const [, oy, , hy] = ext(o);
          return inSpan(o) && Math.abs(oy - yy) < hy + tw / 2 + 12;
        };
        if (obs.some(o => blocks(o, y))) {
          // the detour lane must clear everything along this stretch: widen it until nothing blocks it, take the nearer side
          const lane = (sgn: number) => {
            let yy = y;
            for (let k = 0; k < 6; k++) {
              const hit = obs.filter(o => blocks(o, yy));
              if (!hit.length) return yy;
              yy = sgn < 0 ? Math.min(...hit.map(o => ext(o)[1] - ext(o)[3])) - tw / 2 - 14 : Math.max(...hit.map(o => ext(o)[1] + ext(o)[3])) + tw / 2 + 14;
            }
            return yy;
          };
          const up = lane(-1);
          const dn = lane(1);
          const yd = Math.abs(up - y) <= Math.abs(dn - y) ? up : dn;
          wps.push([px, yd], [s[0], yd]);
        }
      }
      wps.push([s[0], y], [s[1], y]);
    });
    wps.push([order[order.length - 1][1] + dir * 22, y]);
    dir = -dir;
  }
  const room = (p: Pt) => obs.every(o => dObs(o, p[0], p[1]) > 28);
  wps.forEach((p, i) => {
    if (room(p)) return;
    const fx = Math.max(x0, Math.min(x1, p[0]));
    const sx = Math.sign(fx - p[0]) || 0;
    for (let t = 4; t <= 30 && !room(p); t += 4) p[0] += sx * 4;
    if (!room(p)) wps[i] = [fx, p[1]];
  });
  return wps.map(p => [Math.max(14, Math.min(FW - 14, p[0])), Math.max(14, Math.min(FH - 14, p[1]))] as Pt);
}

export const routeLen = (wps: Pt[], from?: Pt) => {
  let len = from ? Math.hypot(wps[0][0] - from[0], wps[0][1] - from[1]) : 40;
  for (let i = 1; i < wps.length; i++) len += Math.hypot(wps[i][0] - wps[i - 1][0], wps[i][1] - wps[i - 1][1]);
  return len;
};

export interface Controls {
  /** a point to drive to (tap and hold to keep steering) */
  target: Pt | null;
  hold: boolean;
  keys: { up?: boolean; down?: boolean; left?: boolean; right?: boolean };
  fast: boolean;
  auto: boolean;
}

export interface JobResult {
  /** share of the field that got work, and of the job done (Q = coverage × how right the implement was) */
  cov: number;
  Q: number;
  over: number;
  along: number;
  eff: number;
  clim: number;
  money: number;
  /** KSh saved against doing the same work by hand (negative: it cost more) */
  saved: number;
  manual: number;
  tractor: number;
  usedL: number;
  co2: number;
  days: number;
  score: number;
  stars: number;
  reason: 'done' | 'time' | 'fuel' | 'auto';
  capped: boolean;
  hits: number;
  secs: number;
  usedAuto: boolean;
}

export interface Job {
  farm: number;
  lay: FarmLayout;
  acres: number;
  right: ImplId;
  strips: number[] | null;
  idealLen: number;
  idealTime: number;
  /** seconds */
  limit: number;
  /** litres of diesel the ideal job takes */
  idealL: number;
  // chosen
  tr: TractorKind | null;
  ik: ImplId | null;
  im: Implement | null;
  fit: number;
  wps: Pt[];
  a0: Pt;
  burn: number;
  tankL: number;
  // the grid
  cnt: Uint8Array;
  last: Float32Array;
  tgt: Uint8Array;
  fld: Uint8Array;
  nT: number;
  // the drive
  x: number;
  y: number;
  h: number;
  v: number;
  wi: number;
  fuelL: number;
  t: number;
  hits: number;
  hitCd: number;
  covT: number;
  ovT: number;
  waste: number;
  acr: number;
  usedAuto: boolean;
  moved: boolean;
  wOrder: number[] | null;
  /** cells newly worked since the screen last drew them */
  fresh: number[];
  done: JobResult | null;
}

/** A new drive for a farm's before-planting job. Nothing is chosen yet. */
export function createJob(farm: number): Job {
  const lay = LAYOUTS[farm % LAYOUTS.length];
  const right = lay.prep.tool;
  const strips = lay.prep.strips ?? null;
  const im = IMPL[right];
  const ideal = planRoute(lay.field, lay.obs, im.w, strips, im.front ? -16 : 16);
  const idealLen = routeLen(ideal);
  const idealTime = (idealLen / 80) * 1.15 + ideal.length * 0.35;
  const limit = Math.ceil((idealTime * 1.1) / 5) * 5;
  const acres = FARM_ACRES;
  const n = GW * GH;
  const job: Job = {
    farm,
    lay,
    acres,
    right,
    strips,
    idealLen,
    idealTime,
    limit,
    idealL: im.lpa * acres,
    tr: null,
    ik: null,
    im: null,
    fit: 0,
    wps: ideal,
    a0: ideal[0],
    burn: 0,
    tankL: 0,
    cnt: new Uint8Array(n),
    last: new Float32Array(n),
    tgt: new Uint8Array(n),
    fld: new Uint8Array(n),
    nT: 0,
    x: 0,
    y: 0,
    h: 0,
    v: 0,
    wi: 0,
    fuelL: 0,
    t: 0,
    hits: 0,
    hitCd: 0,
    covT: 0,
    ovT: 0,
    waste: 0,
    acr: 0,
    usedAuto: false,
    moved: false,
    wOrder: null,
    fresh: [],
    done: null,
  };
  resetJob(job);
  return job;
}

/** Diesel to fill up with for the chosen tractor. */
export const tankOf = (job: Job, tr: TractorKind | null) => Math.round(job.idealL * 2.2 * (tr ? tr.fuel : 1) * 100) / 100;

/** The drive starts: plan with the chosen tractor and implement, and reset the field. */
export function setupJob(job: Job, tractor: TractorKind['id'], impl: ImplId) {
  const tr = TRACTORS.find(t => t.id === tractor)!;
  const im = IMPL[impl];
  job.tr = tr;
  job.ik = impl;
  job.im = im;
  job.fit = fitOf(job.right, impl);
  job.wps = planRoute(job.lay.field, job.lay.obs, im.w, job.strips, im.front ? -16 : 16);
  job.a0 = job.wps[0];
  job.burn = (job.idealL / job.idealLen) * tr.fuel * (im.heavy && tr.id === 'compact' ? 1.2 : 1) * Math.sqrt(im.lpa / IMPL[job.right].lpa);
  job.tankL = tankOf(job, tr);
  resetJob(job);
}

export function resetJob(job: Job) {
  const lay = job.lay;
  job.cnt.fill(0);
  job.last.fill(-9);
  job.tgt.fill(0);
  job.fld.fill(0);
  job.nT = 0;
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      const x = gx * CELL + CELL / 2;
      const y = gy * CELL + CELL / 2;
      const i = gy * GW + gx;
      if (!inRects(lay.field, x, y) || lay.obs.some(o => dObs(o, x, y) < 0)) continue;
      job.fld[i] = 1;
      if (!job.strips || job.strips.some(sx => Math.abs(x - sx) <= 5)) {
        job.tgt[i] = 1;
        job.nT++;
      }
    }
  const w0 = job.wps[0];
  Object.assign(job, { x: Math.max(16, w0[0] - 40), y: w0[1], h: 0, v: 0, wi: 0, fuelL: job.tankL, t: 0, hits: 0, hitCd: 0, covT: 0, ovT: 0, waste: 0, acr: 0, usedAuto: false, moved: false, wOrder: null, done: null });
  job.fresh = [];
}

/** Something the screen should say (a hit), returned by stepJob. */
export interface StepEvent {
  hit?: Obstacle['k'];
}

/** Game seconds pass this much faster than real ones (automated play-tests only). */
export const simClock = { scale: 1 };

/** One frame of the drive. Returns events for the screen, and finishes the job on time or fuel. */
export function stepJob(job: Job, dtReal: number, c: Controls): StepEvent[] {
  if (job.done || !job.tr || !job.im) return [];
  const out: StepEvent[] = [];
  const dt = dtReal * simClock.scale;
  job.t += dt;
  job.hitCd = Math.max(0, job.hitCd - dt);
  if (c.auto) job.usedAuto = true;
  if (job.t >= job.limit) {
    finishJob(job, 'time');
    return out;
  }
  const tr = job.tr;
  const base = c.auto ? tr.slow * 1.1 : c.fast ? tr.fast : tr.slow;
  const W = tr.w;
  const k = c.keys;
  let want = 0;
  let rot = 0;
  let target = c.target;
  if (!c.auto && (k.up || k.left || k.right || k.down)) {
    target = null;
    rot = ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * W * dt;
    want = k.up ? base : 0;
    job.moved = true;
  } else {
    if (c.auto) {
      if (job.wi >= job.wps.length) {
        finishJob(job, 'auto');
        return out;
      }
      const B = job.wps[job.wi];
      const A = job.wi ? job.wps[job.wi - 1] : ([job.x, job.y] as Pt);
      const vx = B[0] - A[0];
      const vy = B[1] - A[1];
      const L = Math.hypot(vx, vy) || 1;
      const along = Math.max(0, Math.min(L, ((job.x - A[0]) * vx + (job.y - A[1]) * vy) / L));
      const la = Math.min(L, along + 14);
      if (Math.hypot(B[0] - job.x, B[1] - job.y) < 7) {
        job.wi++;
        return out;
      }
      target = [A[0] + (vx / L) * la, A[1] + (vy / L) * la];
    }
    if (target) {
      const dx = target[0] - job.x;
      const dy = target[1] - job.y;
      const dist = Math.hypot(dx, dy);
      const diff = wrapA(Math.atan2(dy, dx) - job.h);
      if (!(dist < 7 && !c.hold && !c.auto)) {
        rot = Math.max(-W * dt, Math.min(W * dt, diff));
        const sharp = Math.abs(diff) > 1.2;
        want = c.hold && dist < 10 ? 0 : sharp ? (dist < 22 ? 12 : base * 0.3) : base * (Math.abs(diff) > 0.6 ? 0.6 : 1);
      }
      if (!c.auto) job.moved = true;
    }
  }
  job.h = wrapA(job.h + rot);
  job.v += Math.max(-260 * dt, Math.min(180 * dt, want - job.v));
  const f = job.im.heavy && tr.id === 'compact' ? 0.8 : 1;
  const dist = job.v * f * dt;
  const n = Math.max(1, Math.ceil(dist / 2));
  const cs = Math.cos(job.h);
  const sn = Math.sin(job.h);
  const rad = 9 * tr.size;
  for (let i = 0; i < n; i++) {
    const nx = Math.max(10, Math.min(FW - 10, job.x + (cs * dist) / n));
    const ny = Math.max(10, Math.min(FH - 10, job.y + (sn * dist) / n));
    const hit = job.lay.obs.find(o => dObs(o, nx, ny) < rad);
    if (hit) {
      job.v = 0;
      if (job.hitCd <= 0) {
        job.hits++;
        job.hitCd = 1.2;
        out.push({ hit: hit.k });
      }
      const hx = 'rect' in hit ? hit.rect[0] + hit.rect[2] / 2 : hit.x;
      const hy = 'rect' in hit ? hit.rect[1] + hit.rect[3] / 2 : hit.y;
      const a = Math.atan2(job.y - hy, job.x - hx);
      job.x += Math.cos(a) * 3;
      job.y += Math.sin(a) * 3;
      if (c.auto) job.wi++;
      break;
    }
    job.x = nx;
    job.y = ny;
    markJob(job);
  }
  job.fuelL -= dist * job.burn * (c.fast && !c.auto ? 1.12 : 1);
  if (job.fuelL <= 0) {
    job.fuelL = 0;
    finishJob(job, 'fuel');
  }
  return out;
}

/** The implement works the cells it passes over (behind the tractor, or in front for a harvester). */
function markJob(job: Job) {
  const im = job.im!;
  const c = Math.cos(job.h);
  const s = Math.sin(job.h);
  const off = im.front ? 16 : -16;
  const tx = job.x + c * off;
  const ty = job.y + s * off;
  if (!inRects(job.lay.field, tx, ty)) return;
  const half = im.w / 2;
  const horiz = Math.abs(c) > 0.7;
  for (let o = -half; o <= half; o += 2) {
    const px = tx - s * o;
    const py = ty + c * o;
    if (px < 0 || py < 0 || px >= FW || py >= FH) continue;
    const i = Math.floor(py / CELL) * GW + Math.floor(px / CELL);
    if (!job.fld[i]) continue;
    if (job.t - job.last[i] > 0.9) {
      const first = !job.cnt[i];
      if (job.cnt[i] < 255) job.cnt[i]++;
      if (job.tgt[i]) {
        if (first) {
          job.covT++;
          if (horiz) job.acr++;
        } else if (job.cnt[i] === 2) job.ovT++;
      } else if (first) job.waste++;
      if (first) job.fresh.push(i);
    }
    job.last[i] = job.t;
  }
}

/** Water flows from the channel down through the dug furrows (down and sideways, never uphill). */
export function jobWater(job: Job) {
  const n = GW * GH;
  const wet = new Uint8Array(n);
  const q: number[] = [];
  const top = Math.min(...job.lay.field.map(r => r[1]));
  for (let i = 0; i < n; i++)
    if (job.cnt[i] && job.fld[i] && Math.floor(i / GW) * CELL + CELL / 2 < top + 8) {
      wet[i] = 1;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const gx = i % GW;
    for (const j of [gx > 0 ? i - 1 : -1, gx < GW - 1 ? i + 1 : -1, i + GW]) {
      if (j >= 0 && j < n && !wet[j] && job.cnt[j] && job.fld[j]) {
        wet[j] = 1;
        q.push(j);
      }
    }
  }
  job.wOrder = q;
  return q.filter(i => job.tgt[i]).length;
}

const pct = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100);
export { pct };

/** The end of the job: job done, efficiency, climate and money saved against doing it by hand (Wakala's jobFinish). */
export function finishJob(job: Job, reason: JobResult['reason']): JobResult {
  if (job.done) return job.done;
  const im = job.im!;
  const tr = job.tr!;
  const right = IMPL[job.right];
  const lay = job.lay;
  const cov = Math.min(1, (job.strips ? jobWater(job) : job.covT) / Math.max(1, job.nT));
  const along = job.covT ? job.acr / job.covT : 0;
  const over = Math.min(1, (job.ovT + (job.strips ? job.waste * 0.25 : 0)) / Math.max(1, job.covT));
  // some overlap is normal (the edges of neighbouring rows, turns at the ends): only overlap beyond 30% costs points
  const extra = Math.max(0, over - 0.3) / 0.7;
  let Q = cov * job.fit;
  if (lay.slope && !job.strips) Q *= 0.85 + 0.15 * along;
  const usedL = job.tankL - job.fuelL;
  const idealForWork = job.idealL * cov * tr.fuel;
  // efficiency: work done for the time used, and little driving over the same ground twice
  const timeEff = Math.min(1, (job.idealTime * cov) / Math.max(1, job.t));
  const eff = Math.round(100 * (0.5 * timeEff + 0.5 * (1 - extra) * Math.min(1, cov / 0.5)) * (job.fit ? 1 : 0.3));
  // climate: diesel burned against the ideal for the work done, minus soil packing and erosion
  const fuelEff = usedL > 0 ? Math.min(1, (idealForWork * (job.fit ? 1 : 0)) / usedL) : 0;
  let clim = 100 * fuelEff - tr.soil - (lay.slope && !job.strips ? (1 - along) * 25 : 0) - extra * 15;
  clim = Math.round(Math.max(0, Math.min(100, clim)));
  // money: by hand the work costs person-days × wage; by tractor, hire for the area driven plus any diesel wasted
  const workAcres = job.acres * Q;
  const manual = workAcres * right.manual.value * MONEY.wage.value;
  const tractor = job.acres * cov * im.hire.value * tr.hire + Math.max(0, usedL - idealForWork) * MONEY.diesel.value;
  const saved = manual - tractor;
  const bestSaved = job.acres * (right.manual.value * MONEY.wage.value - right.hire.value * TRACTORS[0].hire);
  const money = Math.round(Math.max(0, Math.min(100, (saved / bestSaved) * 100)));
  let score = Math.round(100 * (0.5 * Q + (0.2 * eff) / 100 + (0.15 * clim) / 100 + (0.15 * money) / 100)) - 5 * job.hits;
  score = Math.max(0, Math.min(100, score));
  let stars = score >= 85 ? 3 : score >= 65 ? 2 : score >= 40 ? 1 : 0;
  const capped = job.usedAuto && stars > TRACTOR_REWARD.autopilotStars;
  if (capped) {
    stars = TRACTOR_REWARD.autopilotStars;
    score = Math.min(score, 84);
  }
  job.done = { cov, Q, over, along, eff, clim, money, saved, manual, tractor, usedL, co2: usedL * MONEY.co2.value, days: workAcres * right.manual.value, score, stars, reason, capped, hits: job.hits, secs: Math.round(job.t), usedAuto: job.usedAuto };
  return job.done;
}

/** Coins and points for a finished drive, against the farm's best this cycle (TRACTOR_REWARD). */
export function rewardFor(r: Pick<JobResult, 'score' | 'stars'>, best: { score: number; stars: number } | null) {
  const paidFor = TRACTOR_REWARD.retryPays === 'full' || !best ? r.score : Math.max(0, r.score - best.score);
  return {
    coins: Math.round(TRACTOR_REWARD.coinsPerScore * paidFor),
    points: TRACTOR_REWARD.pointsPerStar * Math.max(0, r.stars - (best?.stars ?? 0)),
  };
}
