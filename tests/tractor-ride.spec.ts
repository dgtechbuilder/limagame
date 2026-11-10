import { expect, test, type Page } from '@playwright/test';
import { boot, scenario, state, type Win } from './helpers';

/* The tractor in the farm world: at the tractor the farmer picks its type and tool, then drives over a farm's plots.
   The tool decides the job; the plots under the tractor get it. Fuel is paid once per farm and job; a farm whose 20
   plots are all done from the seat pays bonus points. */

/** The plots in one column of a farm (a pass of the tractor down it): 5 of its 20. */
const columnMask = (c: number) => [0, 1, 2, 3, 4].reduce((m, r) => m | (1 << (r * 4 + c)), 0);
const FULL = (1 << 20) - 1;
const TILE = 1.2;

async function pick(page: Page, tractor: string, tool: string) {
  await expect(page.locator('.tp-card').first()).toBeVisible();
  await page.locator('.tp-card', { hasText: tractor }).click();
  await page.getByRole('button', { name: 'Next: the tool', exact: true }).click();
  await page.locator('.tp-tool', { hasText: tool }).click();
  await page.getByRole('button', { name: 'Start the engine', exact: true }).click();
}

/** Drive straight down one column of a farm's plots and back up. */
async function drivePlot(page: Page, farm: number, plot: number) {
  const p = await page.evaluate(f => (window as unknown as Win).__lima.plots[f], farm);
  const x = p.x + (plot - 1.5) * TILE;
  const w = (x: number, z: number) => page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.walkTo(x, z), [x, z]);
  await w(x, p.z - 3.9);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt().z), { timeout: 60_000 }).toBeLessThan(p.z - 3.5);
  await w(x, p.z + 3.9);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt().z), { timeout: 60_000 }).toBeGreaterThan(p.z + 3.5);
}

test('pick a tractor and a tool, then work a farm\'s plots from the seat', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await scenario(page, 'plots');
  const before = await state(page);

  // beside the tractor, the button offers to drive it: first the type and the tool, with what each is for
  await page.evaluate(() => (window as unknown as Win).__limaWorld!.spawn(-17.4, 8.6));
  const button = page.locator('.hud-tractor');
  await expect(button).toHaveAttribute('aria-label', 'Drive the tractor');
  await button.click();
  await expect(page.locator('.tp-card', { hasText: 'Large' })).toContainText('Fuel');
  await page.locator('.tp-card', { hasText: 'Standard' }).click();
  await page.getByRole('button', { name: 'Next: the tool', exact: true }).click();
  await expect(page.locator('.tp-job.is-due')).toContainText('Prepare the land');
  await expect(page.locator('.tp-tool', { hasText: 'Disc harrow' })).toContainText('clods');
  await page.locator('.tp-tool', { hasText: 'Disc plough' }).click();
  await page.getByRole('button', { name: 'Start the engine', exact: true }).click();
  await expect(page.locator('.hud-status')).toContainText('Standard · Disc plough');
  expect(await page.evaluate(() => (window as unknown as Win).__limaWorld!.isRiding())).toBe(true);

  // down the first column of Farm 1: those 5 plots are ploughed; the standard tractor's fuel is paid, once
  await drivePlot(page, 0, 0);
  await expect.poll(async () => ((await state(page)).field.marks['0:prep'] ?? 0) & columnMask(0), { timeout: 60_000 }).toBe(columnMask(0));
  const s1 = await state(page);
  // (driving to the column's start can clip a plot of the next one; the far columns stay untouched)
  expect(s1.field.marks['0:prep'] & (columnMask(2) | columnMask(3))).toBe(0);
  expect(s1.trial.plots[0][0].tractor).toBe('standard');
  expect(s1.trial.plots[0][0].tools.prep).toBe('plough');
  expect(s1.coins).toBe(before.coins - 36);
  expect(s1.points).toBe(before.points);

  // another tractor and tool work the next column: no more fuel for this farm's ploughing
  await page.locator('.hud-rig').click();
  await pick(page, 'Large', 'Disc harrow');
  await expect(page.locator('.hud-status')).toContainText('Large · Disc harrow');
  await drivePlot(page, 0, 1);
  await expect.poll(async () => ((await state(page)).field.marks['0:prep'] ?? 0) & columnMask(1), { timeout: 60_000 }).toBe(columnMask(1));
  expect((await state(page)).coins).toBe(before.coins - 36);

  // the last two columns: all 20 plots from the seat, so the bonus is paid
  await drivePlot(page, 0, 2);
  await drivePlot(page, 0, 3);
  await expect.poll(async () => (await state(page)).field.marks['0:prep'], { timeout: 60_000 }).toBe(FULL);
  const s2 = await state(page);
  expect(s2.points).toBe(before.points + 30);
  expect(s2.field.bonus).toContain('0:prep');
  expect(s2.trial.plots[0][0].tractor).toBe('standard');

  // get off: back on foot
  await button.click();
  await expect(button).toHaveAttribute('aria-label', /tractor/);
  expect(await page.evaluate(() => (window as unknown as Win).__limaWorld!.isRiding())).toBe(false);
});

test('far from the tractor, the button walks to it, then asks for the type and tool', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await scenario(page, 'plots');
  await page.evaluate(() => (window as unknown as Win).__limaWorld!.spawn(10, 0));
  const button = page.locator('.hud-tractor');
  await expect(button).toHaveAttribute('aria-label', 'Walk to the tractor');
  await button.click();
  await expect(page.locator('.tp-card').first()).toBeVisible({ timeout: 60_000 });
  await pick(page, 'Compact', 'Maize planter');
  await expect(page.locator('.hud-status')).toContainText('On the tractor · Compact · Maize planter');
});

test('the hired tractor ploughs a whole farm in one pass', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await scenario(page, 'tractor');
  // the drive (its own test) is skipped: a scored drive is on file, so the Hire spot sends the 3D tractor out
  await page.evaluate(() => {
    const d = (window as unknown as Win).__lima as unknown as { dispatch: (a: unknown) => void };
    d.dispatch({ type: 'tractorDone', farm: 0, score: 80, stars: 2, Q: 0.8, coins: 0, points: 0 });
    d.dispatch({ type: 'fieldHire' });
  });
  const t0 = Date.now();
  await expect.poll(async () => (await state(page)).field.marks['0:prep'] ?? 0, { timeout: 90_000 }).toBe(FULL);
  // the hire tractor does not need a farmer on it, and the farmer got nothing for it
  const s = await state(page);
  expect(s.field.bonus ?? []).not.toContain('0:prep');
  console.log(`hired tractor ploughed Farm 1 in ${Math.round((Date.now() - t0) / 100) / 10}s`);
});
