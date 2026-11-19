import { expect, test } from '@playwright/test';
import { boot, optIn, scenario, state, type Win } from './helpers';

/* Every place's white square (Train, Seeds, Fertilizer, Sprayer, Water, Sell…) waits for the player: walking onto it
   shows a button, and only that button starts the activity. */

const walkTo = (page: import('@playwright/test').Page, place: string) =>
  page.evaluate(p => {
    const at = (window as unknown as Win).__lima.places[p];
    (window as unknown as Win).__limaWorld!.walkTo(at.x, at.z);
  }, place);

test('walking onto a white square starts nothing until its button is pressed', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  const enter = page.locator('.hud-place .is-enter');

  // the seed shed: a button, and still nothing in hand
  await walkTo(page, 'shed-seeds');
  await expect(enter).toContainText('Pick up seeds');
  await page.waitForTimeout(600);
  expect((await state(page)).field.carry).toBeFalsy();
  await expect(page.locator('.hud-place .is-options')).toBeVisible();

  // the Train spot: no tractor screen until the player opts in
  await walkTo(page, 'hire');
  await expect(enter).toContainText('Start training');
  await page.waitForTimeout(600);
  await expect(page.getByRole('dialog', { name: 'Tractor' })).toHaveCount(0);
  await optIn(page);
  await expect(page.getByRole('dialog', { name: 'Tractor' })).toBeVisible();
});
