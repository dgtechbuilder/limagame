import { expect, test, type Page } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* Regression: the first session, read right first time and with a wrong call, and saving and resetting. None of
   this changed with the Wakala Agent work; these tests keep it that way. */

async function createFarmer(page: Page) {
  await page.locator('.name-chip', { hasText: 'Wanjiku' }).click();
  await page.getByRole('button', { name: "Twende! Let's go" }).click();
}

async function walkToBed(page: Page) {
  await page.locator('.goal-hit').dispatchEvent('pointerdown');
  await expect(page.locator('.review-steps')).toBeVisible({ timeout: 30_000 });
}

/** Look at every part, spot a problem row, and make a call. */
async function review(page: Page, shamba: string, right: boolean) {
  const sh = await page.evaluate(id => (window as unknown as Win).__lima.shamba(id), shamba);
  const tiles = page.locator('.part-row .part-tile');
  const n = await tiles.count();
  for (let i = 0; i < n; i++) {
    await tiles.nth(i).click();
    await page.locator('.zoom').click({ position: { x: 6, y: 6 } });
  }
  await page.getByRole('button', { name: 'Spot the problem' }).click();
  await page.getByRole('button', { name: `Row ${sh.problemRows[0] + 1} from the front` }).click();
  await expect(page.locator('.calls')).toBeVisible();
  const labels: Record<string, string> = { healthy: 'Healthy', water: 'Needs water', pests: 'Pests', fertiliser: 'Needs fertiliser' };
  const call = right ? labels[sh.correct] : Object.entries(labels).find(([id]) => id !== sh.correct)![1];
  await page.locator('.calls .call-btn', { hasText: new RegExp(`^${call}$`) }).click();
}

test('first session, read right first time', async ({ page }) => {
  await boot(page);
  await createFarmer(page);
  await walkToBed(page);
  await review(page, 'first', true);
  await page.getByRole('button', { name: 'Check the next crop' }).click({ timeout: 20_000 });
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walk2');
  expect((await state(page)).onboarded).toBe(true);
});

test('first session, a wrong call, then the back maize', async ({ page }) => {
  await boot(page);
  await createFarmer(page);
  await walkToBed(page);
  await review(page, 'first', false);
  await page.getByRole('button', { name: 'Try the back maize' }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walkRetry');
  await walkToBed(page);
  await review(page, 'lower', true);
  await page.getByRole('button', { name: 'Check the next crop' }).click({ timeout: 20_000 });
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walk2');
});

test('the game saves, and Reset progress starts again', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.scenario('followUp'));
  const before = await state(page);
  await boot(page, false);
  const after = await state(page);
  expect(after.trial.cycle).toBe(before.trial.cycle);
  expect(after.trial.followUps).toEqual(before.trial.followUps);
  expect(after.fs.phase).toBe('done');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('button', { name: 'Yes, erase' }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('create');
  await boot(page, false);
  expect((await state(page)).farmer).toBeNull();
});
