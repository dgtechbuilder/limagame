import { expect, test, type Page } from '@playwright/test';
import { boot, eventNames, lookAtAll, state, type Win } from './helpers';

/* Regression: the first session, read right first time and with a wrong call, and saving and resetting. None of
   this changed with the Wakala Agent work; these tests keep it that way. */

async function createFarmer(page: Page, readStory = true) {
  await page.locator('.name-chip', { hasText: 'Wanjiku' }).click();
  await page.getByRole('button', { name: "Twende! Let's go", exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('story');
  if (!readStory) return;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Start with my maize', exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walk1');
}

async function walkToBed(page: Page) {
  await page.locator('.goal-hit').dispatchEvent('pointerdown');
  await expect(page.locator('.review-steps')).toBeVisible({ timeout: 30_000 });
}

/** Look at every part, spot a problem row, and make a call. */
async function review(page: Page, shamba: string, right: boolean) {
  const sh = await page.evaluate(id => (window as unknown as Win).__lima.shamba(id), shamba);
  await lookAtAll(page, 'Next part');
  await page.getByRole('button', { name: 'Spot the problem', exact: true }).click();
  await page.getByRole('button', { name: `Row ${sh.problemRows[0] + 1} from the front` }).click();
  await expect(page.locator('.calls')).toBeVisible();
  const labels: Record<string, string> = { healthy: 'Healthy', water: 'Needs water', pests: 'Pests', fertiliser: 'Needs fertiliser' };
  const call = right ? labels[sh.correct] : Object.entries(labels).find(([id]) => id !== sh.correct)![1];
  await page.locator('.calls .call-btn', { hasText: new RegExp(`^${call}$`) }).click();
}

test('the story so far: three pages, back, skip, and the Back button', async ({ page }) => {
  await boot(page);
  await createFarmer(page, false);
  const card = page.locator('.story-card');
  await expect(card.locator('.story-title')).toHaveText('A farm of my own');
  await expect(card).toContainText('Wanjiku saved from a job in town');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(card.locator('.story-title')).toHaveText('The harvest that failed');
  await expect(card.locator('.story-ledger .is-lost')).toContainText('KSh 23,500');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(card.locator('.story-title')).toHaveText('A farm of my own');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(card.locator('.story-title')).toHaveText('What went wrong');
  await expect(card.locator('.story-mistakes li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Start with my maize', exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walk1');
  // Back from the walk returns to the story; Skip goes straight to the walk
  await page.locator('.nav-btn[aria-label="Back"]').click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('story');
  await page.getByRole('button', { name: 'Skip story', exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walk1');
  expect(await eventNames(page)).toEqual(expect.arrayContaining(['story_page', 'story_done', 'story_skipped']));
});

test('first session, read right first time', async ({ page }) => {
  await boot(page);
  await createFarmer(page);
  await walkToBed(page);
  await review(page, 'first', true);
  await page.getByRole('button', { name: 'Check the next crop', exact: true }).click({ timeout: 20_000 });
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walk2');
  expect((await state(page)).onboarded).toBe(true);
});

test('first session, a wrong call, then the back maize', async ({ page }) => {
  await boot(page);
  await createFarmer(page);
  await walkToBed(page);
  await review(page, 'first', false);
  await page.getByRole('button', { name: 'Try the back maize', exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('walkRetry');
  await walkToBed(page);
  await review(page, 'lower', true);
  await page.getByRole('button', { name: 'Check the next crop', exact: true }).click({ timeout: 20_000 });
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

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Help & data', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, erase', exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('create');
  await boot(page, false);
  expect((await state(page)).farmer).toBeNull();
});
