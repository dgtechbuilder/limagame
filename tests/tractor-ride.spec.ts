import { expect, test, type Page } from '@playwright/test';
import { boot, scenario, state, type Win } from './helpers';

/* The tractor in the farm world: at the tractor the farmer picks its type and tool, then drives onto a plot. There
   are four tractor types for a farm's four plots (A to D): each type works one plot of a farm, so a cycle compares
   them side by side, and every plot can be worked from the seat. A tool can work any plot. A plot finished from the
   seat pays bonus points; fuel is paid per plot. */

/** The tiles of one plot (a column of the farm's 4 × 5 tiles). */
const plotMask = (p: number) => [0, 1, 2, 3, 4].reduce((m, r) => m | (1 << (r * 4 + p)), 0);
const TILE = 1.2;

async function pick(page: Page, tractor: string, tool: string) {
  await expect(page.locator('.tp-card').first()).toBeVisible();
  await page.locator('.tp-card', { hasText: tractor }).click();
  await page.getByRole('button', { name: 'Next: the tool', exact: true }).click();
  await page.locator('.tp-tool', { hasText: tool }).click();
  await page.getByRole('button', { name: 'Start the engine', exact: true }).click();
}

/** Drive straight down one plot of a farm and back up. */
async function drivePlot(page: Page, farm: number, plot: number) {
  const p = await page.evaluate(f => (window as unknown as Win).__lima.plots[f], farm);
  const x = p.x + (plot - 1.5) * TILE;
  const w = (x: number, z: number) => page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.walkTo(x, z), [x, z]);
  await w(x, p.z - 3.9);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt().z), { timeout: 60_000 }).toBeLessThan(p.z - 3.5);
  await w(x, p.z + 3.9);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt().z), { timeout: 60_000 }).toBeGreaterThan(p.z + 3.5);
}

test('pick a tractor and a tool, then work one plot from the seat', async ({ page }) => {
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

  // down Plot A of Farm 1: that plot is ploughed, and it is the standard tractor's plot now
  await drivePlot(page, 0, 0);
  await expect.poll(async () => ((await state(page)).field.marks['0:prep'] ?? 0) & plotMask(0), { timeout: 60_000 }).toBe(plotMask(0));
  const s1 = await state(page);
  expect(s1.field.marks['0:prep'] & plotMask(1)).toBe(0);
  expect(s1.trial.plots[0][0].tractor).toBe('standard');
  expect(s1.trial.plots[0][0].tools.prep).toBe('plough');
  expect(s1.coins).toBe(before.coins - 9);
  expect(s1.points).toBe(before.points + 10);
  expect(s1.field.bonus).toContain('0:prep:0');

  // the same tractor may not take a second plot of the farm
  await drivePlot(page, 0, 1);
  await page.waitForTimeout(800);
  expect(((await state(page)).field.marks['0:prep'] ?? 0) & plotMask(1)).toBe(0);

  // another tractor with another tool does
  await page.locator('.hud-rig').click();
  await pick(page, 'Large', 'Disc harrow');
  await expect(page.locator('.hud-status')).toContainText('Large · Disc harrow');
  await drivePlot(page, 0, 1);
  await expect.poll(async () => ((await state(page)).field.marks['0:prep'] ?? 0) & plotMask(1), { timeout: 60_000 }).toBe(plotMask(1));
  const s2 = await state(page);
  expect(s2.trial.plots[0][1].tractor).toBe('large');
  expect(s2.trial.plots[0][1].tools.prep).toBe('harrow');

  // the compact and the two-wheel tractor take Plots C and D, with the same plough as Plot A: the whole farm is
  // ploughed from the seat (with three tractor types, the fourth plot could not be)
  await page.locator('.hud-rig').click();
  await pick(page, 'Compact', 'Disc plough');
  await drivePlot(page, 0, 2);
  await expect.poll(async () => ((await state(page)).field.marks['0:prep'] ?? 0) & plotMask(2), { timeout: 60_000 }).toBe(plotMask(2));
  await page.locator('.hud-rig').click();
  await pick(page, 'Two-wheel', 'Disc plough');
  await drivePlot(page, 0, 3);
  await expect.poll(async () => (await state(page)).field.marks['0:prep'] ?? 0, { timeout: 60_000 }).toBe((1 << 20) - 1);
  const s3 = await state(page);
  expect(s3.trial.plots[0].map((r: { tractor: string }) => r.tractor)).toEqual(['standard', 'large', 'compact', 'twoWheel']);

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
  const FULL = (1 << 20) - 1;
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
