import { expect, test } from '@playwright/test';
import { boot, scenario, state, tapTask, workFarm, type Win } from './helpers';

/* Plots a day apart (from the second cycle in the farm world): Plot A of each farm is planted on day 1, the next plot
   each day after, and each plot then has its own care (weeding and the top-dress the day after planting, a spray
   against stalk borer the day after that). So each day the four plots of a farm are at different stages. */

/** The tiles of one plot (a column of the farm's 4 × 5 tiles). */
const plotMask = (p: number) => [0, 1, 2, 3, 4].reduce((m, r) => m | (1 << (r * 4 + p)), 0);
const plots = (...ps: number[]) => ps.reduce((m, p) => m | plotMask(p), 0);

test('day 1 plants Plot A only; a later day asks for each plot’s own care', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await scenario(page, 'stagger');

  // day 1: dig Plot A of Farm 1, and only Plot A
  await expect(page.locator('.hud-task')).toContainText('Plot A today');
  await tapTask(page, 'Dig Farm 1');
  await workFarm(page, 0, async () => (((await state(page)).field.marks['0:prep'] ?? 0) & plotMask(0)) === plotMask(0));
  await page.waitForTimeout(600);
  expect((await state(page)).field.marks['0:prep']).toBe(plotMask(0));

  // day 3: Plots A and B are in (B with DAP + CAN at planting), Plot C is planted today
  const s = await state(page);
  const day3 = {
    ...s.trial,
    day: 3,
    checks: { '0:3': { right: true, tries: 1, treated: true }, '1:3': { right: true, tries: 1, treated: true } },
  };
  const ab = plots(0, 1);
  const marks: Record<string, number> = {};
  for (const f of [0, 1]) Object.assign(marks, { [`${f}:prep`]: ab, [`${f}:sow`]: ab, [`${f}:setupFeed`]: plotMask(1) });
  await page.evaluate(([trial, marks]) => (window as unknown as Win).__lima.jump({ view: 'world', trial, field: { cycle: trial.cycle, marks, carry: null, hired: false }, coins: 5000 }), [day3, marks] as const);
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await expect(page.locator('.hud-task')).toContainText('Plot C today');

  // with Plot C planted on both farms (manure at planting), the care of the older plots is next: Plot B is weeded the day after planting
  // (Plot A was weeded yesterday, on its day)
  for (const f of [0, 1]) Object.assign(marks, { [`${f}:prep`]: plots(0, 1, 2), [`${f}:sow`]: plots(0, 1, 2), [`${f}:setupFeed`]: plots(1, 2), [`${f}:weeding`]: plotMask(0) });
  day3.plots = day3.plots.map((rows: { care?: object }[]) => rows.map((r, p) => (p === 0 ? { ...r, care: { weeding: true } } : r)));
  await page.evaluate(([trial, marks]) => (window as unknown as Win).__lima.jump({ view: 'world', trial, field: { cycle: trial.cycle, marks, carry: null, hired: false }, coins: 5000 }), [day3, marks] as const);
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  await expect(page.locator('.hud-task')).toContainText('Weed Farm 1');
  await expect(page.locator('.hud-task')).toContainText('Plot B · plot care');
  const before = (await state(page)).points;
  await page.locator('.hud-task').click();
  await workFarm(page, 0, async () => !!(await state(page)).trial.plots[0][1].care?.weeding);
  const after = await state(page);
  expect(after.field.marks['0:weeding'] & plotMask(1)).toBe(plotMask(1));
  // Plot C is weeded tomorrow, Plot D after it
  expect(after.field.marks['0:weeding'] & plots(2, 3)).toBe(0);
  expect(after.points).toBeGreaterThanOrEqual(before + 5);
});
