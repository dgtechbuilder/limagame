import { expect, test, type Page } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* Every farm is 20 plots (its 4 × 5 tiles), cleared and planted one plot at a time: stand on a plot, press Clear or
   Plant, and a 3-second timer does the work. The first planting period grows maize on Farm 1 (to clear first) and
   sukuma wiki on Farm 2 (cleared already, ready to plant). Seed, fertilizer and sprayer are one set per farm. */

const FULL = (1 << 20) - 1;
type D = { dispatch: (a: unknown) => void };
const task = (page: Page) => page.locator('.hud-task b').innerText();

/** Open the farm world on a new player's first cycle. */
async function firstCycle(page: Page) {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', trial: null, trialHistory: [], coins: 5000 }));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld && !!(window as unknown as Win).__lima.state.trial);
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 6));
}

/** Walk to the plot the task card points at (tap the card), then press its button and wait for the timer. */
async function workNextPlot(page: Page) {
  await page.locator('.hud-task').click();
  await page.locator('.hud-plot').click({ timeout: 20_000 });
  await expect(page.locator('.hud-timer')).toBeHidden({ timeout: 10_000 });
}

test('the first planting period: maize on Farm 1 to clear, sukuma wiki on Farm 2 to plant; the timer takes 3 seconds', async ({ page }) => {
  test.setTimeout(240_000);
  await firstCycle(page);
  const s0 = await state(page);
  expect(s0.trial.phase).toBe('growing');
  expect(s0.trial.crops).toEqual(['maize', 'kale']);
  expect(s0.trial.cleared).toEqual([1]);
  expect(s0.trial.plots[0]).toHaveLength(1);
  await expect(page.locator('.hud-task')).toContainText('Clear Farm 1 for maize');
  await expect(page.locator('.hud-task')).toContainText('20 of 20 plots left');

  // the first plot at the real speed: a button on the plot, then a 3-second timer
  await page.locator('.hud-task').click();
  const button = page.locator('.hud-plot');
  await expect(button).toContainText('Clear');
  await expect(button).toContainText('Plot 1');
  await button.click();
  const timer = page.getByRole('timer');
  await expect(timer).toContainText('Clearing Plot 1');
  await page.waitForTimeout(1500);
  expect((await state(page)).field.marks['0:prep'] ?? 0).toBe(0);
  await expect(timer).toBeHidden({ timeout: 4000 });
  await expect.poll(async () => (await state(page)).field.marks['0:prep']).toBe(1);
  await expect(page.locator('.hud-hint')).toContainText('Plot 1 cleared · 19 to go on Farm 1');

  // walking off the plot stops the work, and the plot stays as it was
  await page.locator('.hud-task').click();
  await button.click({ timeout: 20_000 });
  await page.evaluate(() => {
    const w = (window as unknown as Win).__limaWorld!;
    const at = w.farmerAt();
    w.walkTo(at.x, at.z + 8);
  });
  await expect(page.locator('.hud-hint')).toContainText('Stay on the plot', { timeout: 5000 });
  expect((await state(page)).field.marks['0:prep']).toBe(1);

  // the rest quickly: every plot of Farm 1 cleared, then the sukuma wiki planted, then the maize
  await page.evaluate(() => ((window as unknown as Win).__limaWorld as unknown as { workScale: number }).workScale = 0.05);
  const order: string[] = [];
  for (let n = 0; n < 70; n++) {
    const t = await task(page);
    if (!order.includes(t)) order.push(t);
    if (!/^(Clear|Plant)/.test(t)) break;
    await workNextPlot(page);
  }
  expect(order).toEqual(['Clear Farm 1 for maize', 'Plant sukuma wiki on Farm 2', 'Plant maize on Farm 1', 'Get fertilizer']);
  const s1 = await state(page);
  expect(s1.field.marks).toMatchObject({ '0:prep': FULL, '1:sow': FULL, '0:sow': FULL });
  // Farm 2 was never cleared by hand: it started cleared
  expect(s1.field.marks['1:prep']).toBeUndefined();
});

test('the plan: one set of inputs per farm, and the results by input', async ({ page }) => {
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
  await expect(page.locator('.pb-head')).toHaveText('All 20 plots');
  await expect(page.locator('.pb-grid .pb-cell')).toHaveCount(3);
  // Farm 3's fertilizer: farmyard manure, for the whole farm
  await page.locator('.pb-grid .pb-cell').nth(1).click();
  await page.locator('.pb-opt', { hasText: 'Farmyard manure' }).click();
  const s = await state(page);
  expect(s.trial.plots[2]).toHaveLength(1);
  expect(s.trial.plots[2][0].fert).toBe('manure');
  expect(s.trial.plots[1][0].fert).toBe('basal');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.tr-plots').nth(2)).toContainText('Long-season hybrid');

  // grow and harvest at once, then the results by input
  await page.evaluate(() => {
    const d = (window as unknown as Win).__lima as unknown as D;
    d.dispatch({ type: 'trialSuggest' });
    d.dispatch({ type: 'trialPlant', clock: 'fast' });
  });
  await expect.poll(async () => (await state(page)).trial.phase).toBe('growing');
  await page.evaluate(() => {
    const l = (window as unknown as Win).__lima;
    l.jump({ trial: { ...l.state.trial, day: 7 }, trialHistory: l.state.trialHistory, coins: l.state.coins, trialsOpen: true });
  });
  await page.evaluate(() => ((window as unknown as Win).__lima as unknown as D).dispatch({ type: 'trialHarvest' }));
  await page.getByRole('tab', { name: 'By input', exact: true }).click();
  await expect(page.locator('.pt-cell')).toHaveCount(6);
  await expect(page.locator('.pt-cell').nth(2)).toContainText('Manure');
  await expect(page.locator('.tr-lessons')).toContainText('Fertilizer.');
  const r = await state(page);
  expect(r.trial.results[0].plots).toHaveLength(1);
});
