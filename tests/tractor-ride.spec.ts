import { expect, test } from '@playwright/test';
import { boot, scenario, state, type Win } from './helpers';

/* The tractor in the farm world: hop on at the shed, one pass down a farm does the whole job (a farmer on foot needs
   two), and finishing a big job from the seat pays bonus points. */

const FULL = (1 << 20) - 1;

test('ride the tractor: one pass ploughs a whole farm and pays the bonus', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await scenario(page, 'tractor');
  const plot = await page.evaluate(() => (window as unknown as Win).__lima.plots[0]);
  const before = (await state(page)).points;

  // beside the tractor, the button offers to drive it
  await page.evaluate(() => (window as unknown as Win).__limaWorld!.spawn(-17.4, 8.6));
  const button = page.locator('.hud-tractor');
  await expect(button).toHaveAttribute('aria-label', 'Drive the tractor');
  await button.click();
  await expect(page.locator('.hud-status')).toContainText('On the tractor');
  await expect(button).toHaveAttribute('aria-label', 'Get off the tractor');
  expect(await page.evaluate(() => (window as unknown as Win).__limaWorld!.isRiding())).toBe(true);

  // one straight pass down the middle of Farm 1
  await page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.walkTo(x, z), [plot.x, plot.z - 3.8]);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt().z), { timeout: 60_000 }).toBeLessThan(plot.z - 3.5);
  await page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.walkTo(x, z), [plot.x, plot.z + 3.8]);
  await expect.poll(async () => (await state(page)).field.marks['0:prep'] ?? 0, { timeout: 60_000 }).toBe(FULL);

  const after = await state(page);
  expect(after.field.bonus).toContain('0:prep');
  expect(after.points).toBe(before + 30);
  // the farm is still unplanted by hand: the job was the tractor's, from the seat
  expect(after.field.byTractor['0:prep']).toBe(FULL);

  // get off: back on foot
  await button.click();
  await expect(button).toHaveAttribute('aria-label', /tractor/);
  expect(await page.evaluate(() => (window as unknown as Win).__limaWorld!.isRiding())).toBe(false);
});

test('far from the tractor, the button walks to it and hops on', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await scenario(page, 'tractor');
  await page.evaluate(() => (window as unknown as Win).__limaWorld!.spawn(10, 0));
  const button = page.locator('.hud-tractor');
  await expect(button).toHaveAttribute('aria-label', 'Walk to the tractor');
  await button.click();
  await expect(page.locator('.hud-status')).toContainText('On the tractor', { timeout: 60_000 });
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
