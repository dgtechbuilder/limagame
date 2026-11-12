import { expect, test, type Page } from '@playwright/test';
import { STALK_BORER, WEEDS_MISSED, fertOf, sprayerOf, toolFit, toolJobs } from '../src/plots/data';
import { initialState, reducer, type GameState } from '../src/state';
import { COMMON_PLAN, harvestFarm, routineApplies, suggestPlans, newTrial, type Trial } from '../src/trials/model';
import { wakalaCase } from '../src/trials/samples';
import { FULL, nextTask, routineLeft } from '../src/world/field';
import { boot, scenario, state, tapTask, workFarm, type Win } from './helpers';

/* Scheduled care after planting (plots/data.ts ROUTINE): every farm is weeded on day 2 or 3, maize is sprayed against
   stalk borer on day 3 or 4, and a DAP + CAN farm gets its CAN top-dress on day 4 or 5. By hand or from the tractor
   seat. Missing it costs the harvest. From the second cycle in the farm world only. */

const all = (t: Trial, done: string[]): Trial => ({ ...t, routine: done });

test('the harvest counts the care: missed weeding, a missed top-dress and stalk borer each cost grain', () => {
  const { trial } = wakalaCase('routine');
  const end: Trial = { ...trial, day: 7 };
  const done = harvestFarm(all(end, ['0:weeding', '0:borer', '0:topdress', '1:weeding', '1:borer']), 0);
  const missed = harvestFarm(all(end, []), 0);
  // Farm 1 (DAP + CAN) was due all three; Farm 2 (DAP) only weeding and the spray
  expect(done.care?.map(c => c.job)).toEqual(['weeding', 'borer', 'topdress']);
  expect(harvestFarm(all(end, []), 1).care?.map(c => c.job)).toEqual(['weeding', 'borer']);
  expect(missed.care?.every(c => !c.done)).toBe(true);
  // without its top-dress DAP + CAN grows like DAP alone; unweeded takes a tenth; unsprayed borer takes its share
  const fert = fertOf('basalTop');
  const sprayed = STALK_BORER * (1 - sprayerOf('knapsack').cover.armyworm);
  const want = (1 - WEEDS_MISSED) * (fert.withoutTop!.factor / fert.factor) * ((1 - STALK_BORER) / (1 - sprayed));
  // (the hungry-week losses also grow a little without the CAN, so the missed farm is at or below the plain product)
  expect(missed.bags / done.bags).toBeLessThanOrEqual(want + 0.02);
  expect(missed.bags / done.bags).toBeGreaterThan(want - 0.08);
  expect(missed.care?.find(c => c.job === 'weeding')?.loss).toBe(WEEDS_MISSED);
  expect(done.care?.find(c => c.job === 'borer')?.loss).toBeCloseTo(sprayed, 5);

  // before a job's last day nothing is missed yet
  const day3 = harvestFarm(all({ ...trial, day: 3 }, []), 0, 2);
  expect(day3.care).toEqual([]);

  // a farm with no sprayer is not sprayed, and stalk borer takes all its share (the check strip)
  const strip: Trial = { ...end, routine: [], plots: [[{ seed: 'certified', fert: 'basal', sprayer: 'none' }], end.plots![1]] };
  expect(routineApplies(strip, 0, 'borer')).toBe(false);
  expect(harvestFarm(strip, 0).care?.find(c => c.job === 'borer')).toEqual({ job: 'borer', done: false, loss: STALK_BORER });

  // cycles without scheduled care (the guided first cycle, old saves) are unchanged
  const old: Trial = { ...end, routine: undefined };
  expect(harvestFarm(old, 0).care).toBeUndefined();
  // …and grow as if every care job were done, less stalk borer (which only scheduled care brings)
  expect(harvestFarm(old, 0).bags).toBeGreaterThanOrEqual(done.bags);
  expect(routineLeft({ cycle: 2, marks: {}, carry: null, hired: false }, old, 0, 3)).toEqual([]);
});

test('scheduled care is due on its two days, then counts once every plot is done', () => {
  const c = wakalaCase('routine');
  const s: GameState = { ...initialState, trial: c.trial, field: c.field, points: 0, coins: 1000 };
  // day 3: weeding (last day) and the stalk-borer spray (first day) on both farms; the top-dress is tomorrow
  expect(routineLeft(c.field, c.trial, 0, 3).map(r => r.job)).toEqual(['weeding', 'borer']);
  expect(routineLeft(c.field, c.trial, 0, 4).map(r => r.job)).toEqual(['borer', 'topdress']);
  expect(routineLeft(c.field, c.trial, 1, 4).map(r => r.job)).toEqual(['borer']);
  const task = nextTask(c.field, c.trial, 0, 1000);
  expect(task.title).toBe('Weed Farm 1');
  expect(task.note).toBe('Last day: day 3');

  // half the plots: not yet; all of them: done, with points
  const half = reducer(s, { type: 'fieldMark', farm: 0, job: 'weeding', bits: 0b1111111111 });
  expect(half.trial?.routine).toEqual([]);
  const whole = reducer(half, { type: 'fieldMark', farm: 0, job: 'weeding', bits: FULL });
  expect(whole.trial?.routine).toEqual(['0:weeding']);
  expect(whole.points).toBe(40);
  expect(whole.toast?.text).toContain('Farm 1 weeded');
  // a job not due today is not recorded
  const early = reducer(whole, { type: 'fieldMark', farm: 0, job: 'topdress', bits: FULL });
  expect(early.trial?.routine).toEqual(['0:weeding']);
});

test('the tools for scheduled care: the cultivator weeds, the spreader top-dresses, the boom sprayer sprays borer', () => {
  expect(toolJobs('cultivator')).toEqual(['weeding']);
  expect(toolJobs('spreader')).toEqual(['setupFeed', 'topdress']);
  expect(toolJobs('sprayer')).toEqual(['spray', 'borer']);
  expect(toolFit('weeding', 'cultivator', 0)).toBe(1);
  expect(toolFit('topdress', 'spreader', 0)).toBe(1);
  expect(toolFit('weeding', 'plough', 0)).toBe(0);
});

test('planting in the farm world turns scheduled care on, from the second cycle', () => {
  const plans = suggestPlans(COMMON_PLAN, 6);
  const t: Trial = { ...newTrial(2, false, COMMON_PLAN), plans };
  const s: GameState = { ...initialState, coins: 1_000_000, trial: t };
  expect(reducer({ ...s, view: 'world' }, { type: 'trialPlant', clock: 'daily' }).trial?.routine).toEqual([]);
  // the classic farm screen has no field work: no scheduled care
  expect(reducer({ ...s, view: 'classic' }, { type: 'trialPlant', clock: 'daily' }).trial?.routine).toBeUndefined();
  // nor the guided first cycle
  const g = newTrial(1, true, COMMON_PLAN);
  const guided: GameState = { ...s, view: 'world', trial: { ...g, plans: [COMMON_PLAN, { ...COMMON_PLAN, pest: 'scout' }] } };
  expect(reducer(guided, { type: 'trialPlant', clock: 'fast' }).trial?.routine).toBeUndefined();
});

test('in the farm world: weed by hand, spray against stalk borer with the kit, then the top-dress', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await scenario(page, 'routine');
  const p0 = (await state(page)).points;

  // weeding needs nothing carried: walk over Farm 1's plots
  await expect(page.locator('.hud-task')).toContainText('Last day: day 3');
  await tapTask(page, 'Weed Farm 1');
  await workFarm(page, 0, async () => ((await state(page)).trial.routine as string[]).includes('0:weeding'), 120);
  expect((await state(page)).points).toBe(p0 + 40);

  // the stalk-borer spray: the safety kit, then the product for stem borers
  await tapTask(page, 'Get the sprayer');
  for (const piece of ['Gloves', 'Face mask', 'Boots']) await page.locator('.care-opt', { hasText: piece }).click();
  await expect(page.locator('.guide-text')).toContainText('stalk borer');
  const products = await page.evaluate(() => (window as unknown as Win).__lima.products('borer'));
  await page.locator('.care-opt', { hasText: products.find(p => p.right)!.name }).click();
  await page.getByRole('button', { name: 'Pick up the sprayer', exact: true }).click();
  await expect(page.locator('.pb-grid')).toBeVisible();
  await page.getByRole('button', { name: 'Pick up the sprayer', exact: true }).click();
  await expect.poll(async () => (await state(page)).field.carry).toBe('sprayer');
  await workFarm(page, 0, async () => ((await state(page)).trial.routine as string[]).includes('0:borer'), 120);
  // still carrying the sprayer: Farm 2's spray comes next, before its weeding
  await expect(page.locator('.hud-task')).toContainText('Spray against stalk borer Farm 2');
  await workFarm(page, 1, async () => ((await state(page)).trial.routine as string[]).includes('1:borer'), 120);

  // Farm 2 is left unweeded. Day 4: both farms checked (and treated at once), then Farm 1's top-dress
  await page.evaluate(() => {
    const l = (window as unknown as Win).__lima;
    l.dispatch({ type: 'trialNextDay' });
    for (const farm of [0, 1]) l.dispatch({ type: 'trialCheck', farm, day: 4, right: true, tries: 1 });
  });
  await tapTask(page, 'Get fertilizer');
  await expect.poll(async () => (await state(page)).field.carry, { timeout: 60_000 }).toBe('fertilizer');
  await expect(page.locator('.hud-task')).toContainText('Top-dress Farm 1');
  await workFarm(page, 0, async () => ((await state(page)).trial.routine as string[]).includes('0:topdress'), 120);

  // at harvest: Farm 1 did all its care, Farm 2 missed its weeding
  await page.evaluate(() => {
    const l = (window as unknown as Win).__lima;
    for (const day of [5, 6]) {
      l.dispatch({ type: 'trialNextDay' });
      for (const farm of [0, 1]) l.dispatch({ type: 'trialCheck', farm, day, right: true, tries: 1 });
    }
    l.dispatch({ type: 'trialNextDay' });
    l.dispatch({ type: 'trialHarvest' });
  });
  const s = await state(page);
  expect(s.trial.results[0].care.every((c: { done: boolean }) => c.done)).toBe(true);
  expect(s.trial.results[1].care).toEqual([
    { job: 'weeding', done: false, loss: WEEDS_MISSED },
    { job: 'borer', done: true, loss: expect.any(Number) },
  ]);
});

/** Drive straight down one column of a farm's plots and back up (as in tractor-ride.spec.ts). */
async function drivePlot(page: Page, farm: number, col: number) {
  const p = await page.evaluate(f => (window as unknown as Win).__lima.plots[f], farm);
  const x = p.x + (col - 1.5) * 1.2;
  const w = (x: number, z: number) => page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.walkTo(x, z), [x, z]);
  await w(x, p.z - 3.9);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt().z), { timeout: 60_000 }).toBeLessThan(p.z - 3.5);
  await w(x, p.z + 3.9);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt().z), { timeout: 60_000 }).toBeGreaterThan(p.z + 3.5);
}

test('from the tractor seat: the inter-row cultivator weeds a farm', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  await scenario(page, 'routine');
  await page.evaluate(() => (window as unknown as Win).__limaWorld!.spawn(-17.4, 8.6));
  await page.locator('.hud-tractor').click();
  await page.locator('.tp-card', { hasText: 'Standard' }).click();
  await page.getByRole('button', { name: 'Next: the tool', exact: true }).click();
  // today's scheduled care is due on both farms; the cultivator is the weeding tool
  await expect(page.locator('.tp-job.is-due', { hasText: 'Weed' })).toContainText('Due: Farm 1, Farm 2');
  await expect(page.locator('.tp-job.is-due', { hasText: 'Spray against stalk borer' })).toBeVisible();
  await page.screenshot({ path: 'test-results/routine/tool-picker.png' });
  await page.locator('.tp-tool', { hasText: 'Inter-row cultivator' }).click();
  await page.getByRole('button', { name: 'Start the engine', exact: true }).click();
  await expect(page.locator('.hud-status')).toContainText('Standard · Inter-row cultivator');
  for (const col of [0, 1, 2, 3]) await drivePlot(page, 1, col);
  await expect.poll(async () => (await state(page)).trial.routine as string[], { timeout: 60_000 }).toContain('1:weeding');
  const s = await state(page);
  expect(s.trial.plots[1][0].tools.weeding).toBe('cultivator');
  expect(s.field.bonus).toContain('1:weeding');
});
