import { expect, test } from '@playwright/test';
import { boot, scenario, state, tapTask, type Win } from './helpers';

/* Four mini plots on every farm (A to D): each seed, fertilizer and sprayer goes on one plot of a farm, chosen on the
   plot board (at the shed and in the plan), and the results show every plot's harvest and what each choice did. */

const FULL = (1 << 20) - 1;
type D = { dispatch: (a: unknown) => void };

test('at the seed shed, the plot board puts a seed on each plot (one seed per plot)', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await scenario(page, 'plots');
  // both farms dug: next, the seed
  await page.evaluate(F => {
    const d = (window as unknown as Win).__lima as unknown as D;
    d.dispatch({ type: 'fieldMark', farm: 0, job: 'prep', bits: F });
    d.dispatch({ type: 'fieldMark', farm: 1, job: 'prep', bits: F });
  }, FULL);
  const before = await state(page);
  await tapTask(page, 'Get seeds');
  await expect(page.locator('.pb-grid')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.pb-grid .pb-cell')).toHaveCount(4);
  // every choice says what it is for and what it costs
  await expect(page.locator('.pb-opt')).toHaveCount(6);
  await expect(page.locator('.pb-opt', { hasText: 'Saved seed' })).toContainText('coins');
  // Plot A takes the saved seed; the plot that had it (D) gets Plot A's seed: each seed stays on one plot
  await page.locator('.pb-grid .pb-cell').first().click();
  await page.locator('.pb-opt', { hasText: 'Saved seed' }).click();
  await expect(page.locator('.pb-grid .pb-cell').first()).toContainText('Saved seed');
  const s1 = await state(page);
  expect(s1.trial.plots[0].map((r: { seed: string }) => r.seed)).toEqual(['saved', 'dt', 'opv', 'certified']);
  // a swap costs nothing: the same four seeds
  expect(s1.coins).toBe(before.coins);
  await page.getByRole('button', { name: 'Take the seed', exact: true }).click();
  await expect.poll(async () => (await state(page)).field.carry).toBe('seeds');
});

test('the plan: each farm has a plot board, and the results compare every plot', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  // a six-farm plan
  await page.evaluate(() => {
    const l = (window as unknown as Win).__lima;
    l.jump({ trialHistory: [{ cycle: 1, farms: 2, best: 1, bags: [5, 6], profit: [0, 0] }], trialsOpen: true });
  });
  await page.evaluate(() => ((window as unknown as Win).__lima as unknown as D).dispatch({ type: 'trialNew' }));
  await expect(page.locator('.tr-plots')).toHaveCount(6);
  await page.locator('.tr-plots').nth(2).click();
  await expect(page.locator('.pb-tabs [aria-selected="true"]')).toHaveText('Farm 3');
  // Farm 3, Plot B's fertilizer: farmyard manure (it swaps with Plot C)
  await page.locator('.pb-grid .pb-cell').nth(5).click();
  await page.locator('.pb-opt', { hasText: 'Farmyard manure' }).click();
  const s = await state(page);
  expect(s.trial.plots[2][1].fert).toBe('manure');
  expect(s.trial.plots[2][2].fert).toBe('basalTop');
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  // grow and harvest at once, then the results by plot
  await page.evaluate(() => {
    const l = (window as unknown as Win).__lima;
    const d = l as unknown as D;
    d.dispatch({ type: 'trialSuggest' });
    d.dispatch({ type: 'trialPlant', clock: 'fast' });
  });
  await expect.poll(async () => (await state(page)).trial.phase).toBe('growing');
  await page.evaluate(() => {
    const l = (window as unknown as Win).__lima;
    l.jump({ trial: { ...l.state.trial, day: 7 }, trialHistory: l.state.trialHistory, coins: l.state.coins, trialsOpen: true });
  });
  await page.evaluate(() => ((window as unknown as Win).__lima as unknown as D).dispatch({ type: 'trialHarvest' }));
  await page.getByRole('tab', { name: 'By plot', exact: true }).click();
  await expect(page.locator('.pt-cell')).toHaveCount(24);
  await expect(page.locator('.tr-lessons')).toContainText('Seed.');
  await expect(page.locator('.tr-lessons')).toContainText('Fertilizer.');
  const r = await state(page);
  expect(r.trial.results[0].plots).toHaveLength(4);
});
