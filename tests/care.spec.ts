import { expect, test } from '@playwright/test';
import { boot, eventNames, lookAndCall, scenario, state, tapTask, workFarm, type Win } from './helpers';

/* From Wakala Agent, in the farm world: the fix after a right call, the work by hand, follow-up care, a missed
   follow-up, and the safety kit before spraying. */

test('a world check: right call, a wrong fix, the right fix, then the work by hand', async ({ page }) => {
  await boot(page);
  const c = await scenario(page, 'voice');
  expect(c.hazard).toBe('weeds');

  // walk to Farm 1's sign: Mama Achieng says what she noticed, then the check opens
  await tapTask(page, 'Check Farm 1');
  await expect(page.locator('.voice-bubble').first()).toContainText('Mama Achieng');
  const call = await page.evaluate(h => (window as unknown as Win).__lima.callFor(h), c.hazard);
  await lookAndCall(page, call);
  await expect(page.getByRole('button', { name: 'Choose the fix', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose the fix', exact: true }).click();

  // a wrong fix costs coins and says why
  const fixes = await page.evaluate(h => (window as unknown as Win).__lima.fixes(h), c.hazard);
  const wrong = fixes.find(f => !f.right)!;
  const right = fixes.find(f => f.right)!;
  const coins = (await state(page)).coins;
  await page.locator('.care-opt', { hasText: wrong.label }).click();
  await expect(page.locator('.guide-text')).toContainText(wrong.lesson);
  await expect.poll(async () => (await state(page)).coins).toBeLessThan(coins);
  await expect(page.locator('.care-opt.is-wrong')).toHaveCount(1);

  // the right one leads to the work by hand, unchanged
  await page.locator('.care-opt', { hasText: right.label }).click();
  await page.getByRole('button', { name: 'Back to the farm', exact: true }).click();
  await expect(page.locator('.hud-task')).toContainText('Cut the weeds on Farm 1');
  const key = `0:${c.day}`;
  await workFarm(page, 0, async () => !!(await state(page)).trial.checks[key]?.treated);

  const s = await state(page);
  expect(s.trial.checks[key].fix).toBe(right.id);
  expect(s.trial.checks[key].wrongFixes).toBe(1);
  // weeds come back: a follow-up is set two days on
  expect(s.trial.followUps.some((u: { farm: number; job: string }) => u.farm === 0 && u.job === 'weed')).toBe(true);
  const names = await eventNames(page);
  expect(names).toEqual(expect.arrayContaining(['prescribe', 'care_started', 'care_done']));
});

test('follow-up care done on its day', async ({ page }) => {
  await boot(page);
  await scenario(page, 'followUp');
  await tapTask(page, 'Weed Farm 1 again');
  await workFarm(page, 0, async () => (await state(page)).trial.followUps[0].done === true);
  await expect(page.locator('.hud-task')).not.toContainText('again');
  expect(await eventNames(page)).toEqual(expect.arrayContaining(['care_started', 'care_done']));
});

test('a missed follow-up: logged, and the problem is back on the next check', async ({ page }) => {
  await boot(page);
  const c = await scenario(page, 'cameBack');
  expect(c.hazard).toBe('weeds');
  await expect.poll(() => eventNames(page)).toContain('care_missed');
  expect((await state(page)).trial.followUps[0].missed).toBe(true);
  await tapTask(page, 'Check Farm 1');
  await expect(page.locator('.voice-bubble.is-top')).toContainText('The problem came back');
  // per D5, yield is not changed by the miss yet: the flag is off
  const call = await page.evaluate(h => (window as unknown as Win).__lima.callFor(h), c.hazard);
  await lookAndCall(page, call);
  await expect(page.getByRole('button', { name: 'Choose the fix', exact: true })).toBeVisible();
});

test('a spray job: the safety kit, then the product', async ({ page }) => {
  await boot(page);
  const c = await scenario(page, 'spray');
  expect(c.hazard).toBe('armyworm');
  await tapTask(page, 'Get the sprayer');
  for (const piece of ['Gloves', 'Face mask', 'Boots']) await page.locator('.care-opt', { hasText: piece }).click();
  const products = await page.evaluate(h => (window as unknown as Win).__lima.products(h), c.hazard);
  const wrong = products.find(p => !p.right)!;
  const right = products.find(p => p.right)!;
  const coins = (await state(page)).coins;
  await page.locator('.care-opt', { hasText: wrong.name }).click();
  await expect(page.locator('.guide-text')).toContainText(wrong.lesson);
  expect((await state(page)).coins).toBe(coins);
  await page.locator('.care-opt', { hasText: right.name }).click();
  await page.getByRole('button', { name: 'Pick up the sprayer', exact: true }).click();
  // the farm's sprayer (one for all its 20 plots), then the sprayer is picked up
  await expect(page.locator('.pb-grid')).toBeVisible();
  await expect(page.locator('.pb-head')).toHaveText('All 20 plots');
  await expect(page.locator('.pb-grid .pb-cell')).toHaveCount(1);
  await expect(page.locator('.pb-grid .pb-cell')).toContainText('Knapsack');
  await page.getByRole('button', { name: 'Pick up the sprayer', exact: true }).click();
  await expect.poll(async () => (await state(page)).field.carry).toBe('sprayer');
  // from the sprayer shed's door to Farm 1's first plot, the path crosses the fertilizer shed's door: walking through
  // on the way keeps the sprayer (it used to be swapped for fertilizer, and the spray never started)
  const sheds = await page.evaluate(() => (window as unknown as Win).__lima.places);
  await page.evaluate(at => {
    const w = (window as unknown as Win).__limaWorld!;
    w.spawn(at.x, at.z);
    const t = w.nextTile(0);
    w.walkTo(t.x, t.z);
  }, sheds['shed-sprayer']);
  // past the fertilizer shed's door and on the way into Farm 1
  await page.waitForFunction(z => (window as unknown as Win).__limaWorld!.farmerAt().z < z - 3, sheds['shed-fertilizer'].z);
  expect((await state(page)).field.carry).toBe('sprayer');
  await workFarm(page, 0, async () => !!(await state(page)).trial.checks[`0:${c.day}`]?.treated, 120);
  expect(await eventNames(page)).toEqual(expect.arrayContaining(['kit_on', 'product']));
  // walking to a shed on purpose still hands over its load
  await page.evaluate(p => (window as unknown as Win).__limaWorld!.walkTo(p.x, p.z), sheds['shed-fertilizer']);
  await expect(page.locator('.hud-hint')).toHaveText('Picked up: fertilizer bag');
});
