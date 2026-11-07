import { expect, test } from '@playwright/test';
import { COLS, FULL, PLOT_D, TILE, WORK_REACH, emptyField } from '../src/world/field';
import { RIDE_SPEED, TRACTORS, TRACTOR_BONUS, TRACTOR_EDGE, IMPL } from '../src/tractor/data';
import { TRACTOR_PLOT } from '../src/plots/data';
import { createJob, setupJob, stepJob, finishJob, rewardFor, type Controls } from '../src/tractor/sim';
import { initialState, reducer } from '../src/state';
import { wakalaCase } from '../src/trials/samples';

/* The tractor, without a browser: a plot per pass, the bonus points and fuel per plot, and a drive steered by hand
   (not autopilot) that has to be finishable. */

/** The tiles of one plot (a column of the farm's 4 × 5 tiles). */
const plotMask = (p: number) => [0, 1, 2, 3, 4].reduce((m, r) => m | (1 << (r * COLS + p)), 0);

test('a plot is one column of a farm: one pass of the tractor down it', () => {
  // the tractor works the column under it; a tile is worked when its centre is within reach of the tractor
  expect(TILE * 0.5).toBeLessThan(WORK_REACH * TRACTOR_EDGE);
  expect(PLOT_D / TILE).toBe(5);
  expect([0, 1, 2, 3].map(plotMask).reduce((a, b) => a | b, 0)).toBe(FULL);
  // each type has its own fuel, speed and soil packing
  expect(TRACTOR_PLOT.large.speed).toBeGreaterThan(TRACTOR_PLOT.compact.speed);
  expect(TRACTOR_PLOT.large.fuel).toBeGreaterThan(TRACTOR_PLOT.compact.fuel);
  expect(TRACTOR_PLOT.large.compaction).toBeLessThan(TRACTOR_PLOT.compact.compaction);
  expect(RIDE_SPEED).toBeGreaterThan(1);
});

test('the tractor bonus and fuel: once per plot and job, only from the seat, one plot per type and tool', () => {
  const c = wakalaCase('plots');
  const base = { ...initialState, trial: c.trial, field: { ...emptyField(c.trial.cycle) }, points: 0, coins: 1000 };
  const rig = { tractor: 'standard', tool: 'plough', job: 'prep' } as const;
  // half of Plot A from the seat: fuel paid, the plot is the standard tractor's now, no bonus yet
  const half = reducer(base, { type: 'fieldMark', farm: 0, job: 'prep', bits: plotMask(0) & 0x1ff, tractor: true, rig });
  expect(half.points).toBe(0);
  expect(half.coins).toBe(1000 - TRACTOR_PLOT.standard.fuel);
  expect(half.trial!.plots![0][0].tractor).toBe('standard');
  expect(half.trial!.plots![0][0].tools!.prep).toBe('plough');
  // only Plot A's tiles count, whatever else is under the tractor
  const done = reducer(half, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL, tractor: true, rig });
  expect(done.field.marks['0:prep']).toBe(plotMask(0));
  expect(done.points).toBe(TRACTOR_BONUS.perPlot);
  expect(done.field.bonus).toContain('0:prep:0');
  expect(done.toast?.text).toContain('Tractor bonus');
  expect(done.coins).toBe(1000 - TRACTOR_PLOT.standard.fuel);
  // the same type, or the same tool, on another plot of the farm: refused
  expect(reducer(done, { type: 'fieldMark', farm: 0, job: 'prep', bits: plotMask(1), tractor: true, rig })).toBe(done);
  expect(reducer(done, { type: 'fieldMark', farm: 0, job: 'prep', bits: plotMask(1), tractor: true, rig: { ...rig, tractor: 'large' } })).toBe(done);
  // another type with another tool works Plot B
  const b = reducer(done, { type: 'fieldMark', farm: 0, job: 'prep', bits: plotMask(1), tractor: true, rig: { tractor: 'large', tool: 'harrow', job: 'prep' } });
  expect(b.field.marks['0:prep']).toBe(plotMask(0) | plotMask(1));
  expect(b.trial!.plots![0][1].tractor).toBe('large');
  expect(b.coins).toBe(1000 - TRACTOR_PLOT.standard.fuel - TRACTOR_PLOT.large.fuel);
  // the same job on foot pays no bonus and no fuel
  const foot = reducer(base, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL });
  expect(foot.points).toBe(0);
  expect(foot.coins).toBe(1000);
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
  expect(Object.keys(IMPL).length).toBe(9);
});
