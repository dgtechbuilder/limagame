import { expect, test } from '@playwright/test';
import { COLS, FULL, PLOT_D, PLOT_WORK_S, TILE, TILES, WORK_REACH, emptyField, plotAt, tileCenter } from '../src/world/field';
import { RIDE_SPEED, TRACTORS, TRACTOR_BONUS, TRACTOR_EDGE, IMPL } from '../src/tractor/data';
import { PLOTS_PER_FARM, TRACTOR_PLOT, plotName } from '../src/plots/data';
import { createJob, setupJob, stepJob, finishJob, rewardFor, type Controls } from '../src/tractor/sim';
import { initialState, reducer } from '../src/state';
import { wakalaCase } from '../src/trials/samples';

/* Plots and the tractor, without a browser: a farm is 20 plots (one tile each), fuel is paid once per farm and job,
   the bonus once a farm's job is done from the seat, and a drive steered by hand (not autopilot) has to be finishable. */

/** The plots in one column of a farm (one pass of the tractor down it). */
const columnMask = (c: number) => [0, 1, 2, 3, 4].reduce((m, r) => m | (1 << (r * COLS + c)), 0);

test('a farm is 20 plots, one tile each, numbered from the back left', () => {
  expect(PLOTS_PER_FARM).toBe(20);
  expect(TILES).toBe(PLOTS_PER_FARM);
  expect(PLOT_D / TILE).toBe(5);
  expect(plotName(0)).toBe('Plot 1');
  expect(plotName(19)).toBe('Plot 20');
  // every tile's centre is on its own plot of its own farm
  for (const farm of [0, 3, 5])
    for (let p = 0; p < TILES; p++) {
      const c = tileCenter(farm, p);
      expect(plotAt(c.x, c.z)).toEqual({ farm, plot: p });
    }
  expect(plotAt(0, -20)).toBeNull();
  expect(PLOT_WORK_S).toBe(3);
  // the tractor works a column of plots as it drives; each type has its own fuel, speed and soil packing
  expect(TILE * 0.5).toBeLessThan(WORK_REACH * TRACTOR_EDGE);
  expect([0, 1, 2, 3].map(columnMask).reduce((a, b) => a | b, 0)).toBe(FULL);
  expect(TRACTOR_PLOT.large.speed).toBeGreaterThan(TRACTOR_PLOT.compact.speed);
  expect(TRACTOR_PLOT.large.fuel).toBeGreaterThan(TRACTOR_PLOT.compact.fuel);
  expect(TRACTOR_PLOT.large.compaction).toBeLessThan(TRACTOR_PLOT.compact.compaction);
  expect(RIDE_SPEED).toBeGreaterThan(1);
});

test('the tractor: fuel once per farm and job, the bonus once all 20 plots are done from the seat', () => {
  const c = wakalaCase('plots');
  const base = { ...initialState, trial: c.trial, field: { ...emptyField(c.trial.cycle) }, points: 0, coins: 1000 };
  const rig = { tractor: 'standard', tool: 'plough', job: 'prep' } as const;
  // one column from the seat: fuel paid, the tractor and tool noted on the farm, no bonus yet
  const one = reducer(base, { type: 'fieldMark', farm: 0, job: 'prep', bits: columnMask(0), tractor: true, rig });
  expect(one.points).toBe(0);
  expect(one.coins).toBe(1000 - TRACTOR_PLOT.standard.fuel);
  expect(one.trial!.plots![0]).toHaveLength(1);
  expect(one.trial!.plots![0][0].tractor).toBe('standard');
  expect(one.trial!.plots![0][0].tools!.prep).toBe('plough');
  // another type on the same farm and job: allowed, no more fuel, the first type stays on the record
  const two = reducer(one, { type: 'fieldMark', farm: 0, job: 'prep', bits: columnMask(1), tractor: true, rig: { tractor: 'large', tool: 'harrow', job: 'prep' } });
  expect(two.field.marks['0:prep']).toBe(columnMask(0) | columnMask(1));
  expect(two.coins).toBe(one.coins);
  expect(two.trial!.plots![0][0].tractor).toBe('standard');
  // the rest from the seat: all 20 plots, so the bonus is paid, once
  const done = reducer(two, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL, tractor: true, rig });
  expect(done.field.marks['0:prep']).toBe(FULL);
  expect(done.points).toBe(TRACTOR_BONUS.perJob);
  expect(done.field.bonus).toContain('0:prep');
  expect(done.toast?.text).toContain('Tractor bonus');
  expect(reducer(done, { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL, tractor: true, rig })).toBe(done);
  // a farm finished partly on foot pays no bonus
  const mixed = reducer(reducer(base, { type: 'fieldMark', farm: 0, job: 'prep', bits: columnMask(0) }), { type: 'fieldMark', farm: 0, job: 'prep', bits: FULL, tractor: true, rig });
  expect(mixed.field.marks['0:prep']).toBe(FULL);
  expect(mixed.points).toBe(0);
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
  // Wakala's eight, the fertilizer spreader and the inter-row cultivator (the drive offers the before-planting ones)
  expect(Object.keys(IMPL).length).toBe(10);
});
