import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* Regressions for faults found by playing the whole game: a guide button that opened the season before the farm,
   and a load swapped by walking past a shed. */

test('first session: the guide in the menu goes back to the game, not into the farming steps', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Wanjiku' }).click();
  await page.getByRole('button', { name: /Twende/ }).click();
  await page.getByRole('button', { name: 'Main menu' }).click();
  await page.locator('.menu-item .gold-btn', { hasText: 'How the farm works' }).click();
  await page.getByRole('button', { name: 'Back to the game', exact: true }).click();
  const s = await state(page);
  expect(s.modal?.kind ?? null).not.toBe('steps');
  expect(s.onboarded).toBe(false);
  expect(s.fs.phase).toBe('story');
});

test('the farm world: a walk that only passes a shed picks nothing up', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.scenario('spray'));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  const world = <T>(f: (w: NonNullable<Win['__limaWorld']>) => T) => page.evaluate(`(${f})(window.__limaWorld)`) as Promise<T>;
  await world(w => ((w.speedScale = 4), w.spawn(-14.2, 4.5)));
  // carrying the sprayer north past the fertilizer and seed sheds, to a point beyond them
  await page.evaluate(() => (window as unknown as { __lima: { dispatch: (a: unknown) => void } }).__lima.dispatch({ type: 'carry', item: 'sprayer' }));
  await world(w => w.walkTo(-14.2, -5));
  await expect.poll(() => world(w => w.farmerAt().z)).toBeLessThan(-4.5);
  expect((await state(page)).field.carry).toBe('sprayer');
});
