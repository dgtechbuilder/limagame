import { expect, test } from '@playwright/test';
import { boot, eventNames, scenario, state, tapTask, type Win } from './helpers';

/* From Wakala Agent: the tractor drive before planting, on a farm whose plan says Tractor hire. */

test('hire the tractor: choose it and the implement, drive on autopilot, see the summary', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  await tapTask(page, 'Hire the tractor');
  await expect(page.locator('.tc-side')).toContainText('Mama Achieng');
  await page.getByRole('button', { name: 'Choose a tractor' }).click();
  await page.locator('.tc-card', { hasText: 'Compact' }).click();
  await page.getByRole('button', { name: 'Next: the implement' }).click();
  const tool = await page.evaluate(() => (window as unknown as Win).__lima.tractorTool(0));
  const name = { plough: 'Disc plough', harrow: 'Disc harrow', ridger: 'Ridger' }[tool as 'plough'];
  await page.locator('.tc-card', { hasText: name }).click();
  await page.getByRole('button', { name: 'Next: get ready' }).click();
  await page.locator('.care-opt', { hasText: 'Hitch' }).click();
  await page.locator('.care-opt', { hasText: 'Fill up' }).click();
  await page.evaluate(() => (window as unknown as Win).__lima.tractorClock(10));
  await page.getByRole('button', { name: /Start the engine/ }).click();
  await page.getByRole('button', { name: 'Autopilot' }).click();

  // the summary: the score, the four parts, the shillings as information
  await expect(page.locator('.tc-score')).toBeVisible({ timeout: 60_000 });
  const score = Number((await page.locator('.tc-score > b').textContent())?.replace('/100', ''));
  expect(score).toBeGreaterThan(0);
  for (const part of ['Job done', 'Efficiency', 'Climate', 'Cost saving']) await expect(page.locator('.tc-scorebar', { hasText: part })).toBeVisible();
  await expect(page.locator('.tc-ksh')).toContainText('KSh');
  // autopilot earns at most 2 stars
  await expect(page.locator('.tc-stars .is-on')).not.toHaveCount(3);

  await page.getByRole('button', { name: 'Done' }).click();
  const s = await state(page);
  expect(s.trial.tractor['0'].score).toBe(score);
  expect(s.field.hired).toBe(true);
  // the 3D tractor ploughs the farm: its prep is marked
  await expect.poll(async () => (await state(page)).field.marks['0:prep'] ?? 0, { timeout: 30_000 }).toBe((1 << 20) - 1);
  expect(await eventNames(page)).toEqual(expect.arrayContaining(['tractor_open', 'tractor_pick', 'tractor_done']));
});
