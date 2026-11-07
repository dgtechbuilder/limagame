import { expect, test } from '@playwright/test';
import { COLS, FULL, PLOT_D, TILE, WORK_REACH, emptyField } from '../src/world/field';
import { RIDE_SPEED, TRACTORS, TRACTOR_BONUS, TRACTOR_EDGE, TRACTOR_JOBS, IMPL } from '../src/tractor/data';
import { createJob, setupJob, stepJob, finishJob, rewardFor, type Controls } from '../src/tractor/sim';
import { initialState, reducer } from '../src/state';
import { wakalaCase } from '../src/trials/samples';

/* The tractor, without a browser: the numbers (3× the ground of walking), the bonus points, and a drive steered by
   hand (not autopilot) that has to be finishable. */

const WALK_SPEED = 4.6;

/** Straight passes down a farm needed to bring every column within reach (greedy: each pass as far over as it can be). */
function passesFor(reach: number) {
  const cols = Array.from({ length: COLS }, (_, c) => (c - (COLS - 1) / 2) * TILE);
  let n = 0;
  let i = 0;
  while (i < cols.length) {
    const lineX = cols[i] + reach * 0.95;
    while (i < cols.length && Math.abs(cols[i] - lineX) < reach) i++;
    n++;
  }
  return n;
}

test('a tractor covers a farm in at most a third of the time a farmer on foot needs', () => {
  const walk = passesFor(WORK_REACH);
  const ride = passesFor(WORK_REACH * TRACTOR_EDGE);
  expect(walk).toBe(2);
  expect(ride).toBe(1);
  // the path: every pass down the farm, plus the step across between passes
  const walkSeconds = (walk * PLOT_D + (walk - 1) * 2 * TILE) / WALK_SPEED;
  const rideSeconds = (ride * PLOT_D + (ride - 1) * 2 * TILE) / (WALK_SPEED * RIDE_SPEED);
  expect(walkSeconds / rideSeconds).toBeGreaterThanOrEqual(TRACTOR_EDGE);
  // the tractor does the big jobs only
  expect([...TRACTOR_JOBS]).toEqual(['prep', 'sow', 'setupFeed', 'harvest']);
});

test('the tractor bonus: once per farm job, only from the seat, only when the job is finished', () => {
  const c = wakalaCase('tractor');
  const base = { ...initialState, trial: c.trial, field: { ...emptyField(c.trial.cycle) }, points: 0 };
  // half a farm from the seat: nothing yet
  const half = reducer(base, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL & 0x3ff, tractor: true });
  expect(half.points).toBe(0);
  // the rest from the seat: the bonus, with a toast
  const done = reducer(half, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL, tractor: true });
  expect(done.points).toBe(TRACTOR_BONUS.perJob);
  expect(done.field.bonus).toContain('0:prep');
  expect(done.toast?.text).toContain('Tractor bonus');
  // doing it again pays nothing more
  const again = reducer(done, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL, tractor: true });
  expect(again.points).toBe(TRACTOR_BONUS.perJob);
  // the same job on foot pays no bonus
  const foot = reducer(base, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL });
  expect(foot.points).toBe(0);
  // a small job from the seat pays no bonus either
  const small = reducer(base, { type: 'fieldMark', farm: 0, job: 't1', bits: FULL, tractor: true });
  expect(small.points).toBe(0);
});

test('a scored drive earns the bonus the first time on a farm, and a retry does not', () => {
  const r = { score: 80, stars: 2 };
  expect(rewardFor(r, null).bonus).toBe(TRACTOR_BONUS.perDrive);
  expect(rewardFor(r, null).points).toBe(100 + TRACTOR_BONUS.perDrive);
  expect(rewardFor(r, { score: 70, stars: 2 }).bonus).toBe(0);
});

test('the drive can be played by steering: tap-and-hold towards each row, no autopilot', () => {
  for (const farm of [0, 1, 2, 3]) {
    const job = createJob(farm);
    setupJob(job, 'standard', job.right);
    const C: Controls = { target: null, hold: false, keys: {}, fast: false, auto: false };
    // a player who steers along the route the field asks for, a waypoint at a time
    for (let w = 0; w < job.wps.length && !job.done; w++) {
      C.target = job.wps[w];
      for (let n = 0; n < 60 * 120 && !job.done; n++) {
        stepJob(job, 1 / 60, C);
        // a player taps the next spot ahead before the tractor gets all the way to the last one
        if (Math.hypot(job.wps[w][0] - job.x, job.wps[w][1] - job.y) < 12) break;
      }
    }
    const r = job.done ?? finishJob(job, 'done');
    expect(r.usedAuto).toBe(false);
    expect(r.cov, `farm ${farm + 1} coverage`).toBeGreaterThan(0.6);
    expect(r.score, `farm ${farm + 1} score`).toBeGreaterThan(40);
  }
  expect(TRACTORS.length).toBe(3);
  expect(Object.keys(IMPL).length).toBe(8);
});
