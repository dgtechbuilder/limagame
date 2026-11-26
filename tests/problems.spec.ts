import { expect, test } from '@playwright/test';
import { boot, eventNames, lookAndCall, optIn, state, tapTask, workFarm, type Win } from './helpers';
import { NEW_HAZARDS, COMMON_PLAN, HAZARD_WORDS, DAMAGE, baseHazard, newTrial, extraWeightsFor, type Plan, type Trial, type TrialHazard } from '../src/trials/model';
import { PRESCRIBE, PRODUCTS, FOLLOW_UP } from '../src/care/data';
import { TREATMENTS } from '../src/care/treatments';
import { CALL_GROUPS, HAZARDS } from '../src/rounds/hazards';
import { TREAT_JOB, jobOf, problemTiles } from '../src/world/field';
import { termFor } from '../src/learn/glossary';
import { existsSync, readFileSync } from 'node:fs';

/* The newer problems on the six farms: wind, maize lethal necrosis (a virus), striga, soil erosion, and rats and mole
   rats. Each is read on the farm like the others, has a right fix and believable wrong ones, two or three ways to do
   it (one climate-smart), and its own work by hand on the farm. The fix screen buys the way chosen and the farmer
   walks straight off to do the work. */

const NEW = NEW_HAZARDS as readonly TrialHazard[];

test('every newer problem is whole: a call to read it, three fixes, ways to do it, and its own work by hand', () => {
  for (const h of NEW) {
    // read on the farm: a check situation with a call on the judge screen
    const hz = HAZARDS[h as keyof typeof HAZARDS];
    expect(hz, h).toBeTruthy();
    expect(CALL_GROUPS.some(g => g.calls.some(c => c.id === hz.call)), h).toBe(true);
    expect(HAZARD_WORDS[h]).toBeTruthy();
    expect(DAMAGE[h].missed).toBeGreaterThan(DAMAGE[h].caught);
    expect(DAMAGE[h].treat).toBeGreaterThan(0);
    // three fixes, one right, each with its lesson
    const fixes = PRESCRIBE[h];
    expect(fixes, h).toHaveLength(3);
    expect(fixes.filter(f => f.right)).toHaveLength(1);
    for (const f of fixes) expect(f.lesson.length).toBeGreaterThan(10);
    // at least two ways to do it, the standard one first, and a climate-smart one
    const ways = TREATMENTS[h]!;
    expect(ways.length, h).toBeGreaterThanOrEqual(2);
    expect(ways[0].costX).toBe(1);
    expect(ways.some(w => w.smart), h).toBe(true);
    // the work by hand, on the tiles where the problem shows
    expect(TREAT_JOB[h], h).toBeTruthy();
    const t = { cycle: 3 };
    expect(problemTiles(h, t, 0, 2)).toBeGreaterThan(0);
    // the right fix and the problem have a farm word (its ⓘ card)
    expect(termFor(HAZARD_WORDS[h]) ?? termFor(fixes.find(f => f.right)!.label), h).toBeTruthy();
  }
  // the clue pictures of the virus, striga, erosion and rats are real photos
  const credits = JSON.parse(readFileSync('src/rounds/photos/credits.json', 'utf8')) as Record<string, { author: string }>;
  for (const key of ['virus/maize/pests', 'striga/maize/pests', 'erosion/soil', 'rodents/soil']) {
    expect(existsSync(`src/rounds/photos/${key}.webp`), key).toBe(true);
    expect(existsSync(`src/rounds/photos-lite/${key}.webp`), key).toBe(true);
    expect(credits[key]?.author, key).toBeTruthy();
  }
  // follow-ups: the virus and striga come back on new plants
  expect(FOLLOW_UP.virus?.job).toBe('uproot');
  expect(FOLLOW_UP.striga?.job).toBe('pull');
  // weeding with a herbicide is a spray job, with its own product question; weed then mulch lays mulch
  expect(jobOf('weeds', 'herbicide')).toBe('spray');
  expect(jobOf('weeds', 'mulch')).toBe('mulch');
  expect(jobOf('weeds', 'hand')).toBe('weed');
  expect(jobOf('erosion', 'mulch')).toBe('mulch');
  expect(PRODUCTS.weeds.filter(p => p.right)).toHaveLength(1);
});

test('the newer problems show from the second cycle, never in the guided first planting, and follow the plan', () => {
  const count = (guided: boolean, plans: Plan[], cycles: number) => {
    const n: Partial<Record<TrialHazard, number>> = {};
    for (let cycle = 1; cycle <= cycles; cycle++) {
      const t: Trial = { ...newTrial(cycle, guided, plans[0]), plans, guided };
      for (let farm = 0; farm < plans.length; farm++)
        for (let day = 1; day <= 6; day++) {
          const h = baseHazard(t, farm, day);
          n[h] = (n[h] ?? 0) + 1;
        }
    }
    return n;
  };
  const guided = count(true, [COMMON_PLAN, COMMON_PLAN], 300);
  for (const h of NEW) expect(guided[h] ?? 0, h).toBe(0);
  const six = count(false, [COMMON_PLAN, COMMON_PLAN, COMMON_PLAN], 400);
  for (const h of NEW) expect(six[h] ?? 0, h).toBeGreaterThan(0);
  // the plan sets the odds: no fertilizer feeds striga, mulch keeps the soil from washing away
  const hungry: Plan = { ...COMMON_PLAN, fert: 'none' };
  expect(extraWeightsFor(hungry, 'normal', 3).striga!).toBeGreaterThan(extraWeightsFor(COMMON_PLAN, 'normal', 3).striga!);
  const mulched: Plan = { ...COMMON_PLAN, land: 'mulch' };
  expect(extraWeightsFor(mulched, 'wet', 3).erosion!).toBeLessThan(extraWeightsFor(COMMON_PLAN, 'wet', 3).erosion!);
  // sukuma wiki gets no striga, virus or lodging
  const kale: Trial = { ...newTrial(5, false, COMMON_PLAN), plans: [COMMON_PLAN], crops: ['kale'] };
  for (let day = 1; day <= 6; day++) expect(['striga', 'virus', 'wind']).not.toContain(baseHazard(kale, 0, day));
});

/** Pick the right fix, then a way of doing it, on the fix screen. */
async function chooseFix(page: import('@playwright/test').Page, h: string, way: string) {
  await expect(page.getByRole('button', { name: 'Choose the fix', exact: true }).or(page.locator('.care-opts'))).toBeVisible();
  const fixes = await page.evaluate(x => (window as unknown as Win).__lima.fixes(x), h);
  await page.locator('.care-opt', { hasText: fixes.find(f => f.right)!.label }).click();
  await page.getByRole('group', { name: 'How to do it' }).getByRole('button', { name: new RegExp(`^${way}`) }).click();
}

for (const [h, way] of [
  ['wind', 'Earth up, then a windbreak'],
  ['virus', 'Pull out, then beans in the gaps'],
  ['striga', 'Pull, then desmodium'],
  ['erosion', 'Trenches and grass strips'],
  ['rodents', 'Traps and owl perches'],
] as const) {
  test(`${h}: read on the farm, the climate-smart way bought, then the work by hand`, async ({ page }) => {
    await boot(page);
    const c = await page.evaluate(x => (window as unknown as Win).__lima.problem(x as never) as unknown as { day: number; hazard: string }, h);
    expect(c.hazard).toBe(h);
    await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
    await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
    const key = `0:${c.day}`;

    // the task card leads to Farm 1's sign, where the fix is chosen
    await tapTask(page, 'Choose the fix for Farm 1');
    await expect(page.locator('.care-screen')).toBeVisible();
    await expect(page.locator('.rr-cropnote')).toContainText(HAZARD_WORDS[h]);
    await chooseFix(page, h, way);
    expect((await state(page)).trial.checks[key].treatment).toBe(TREATMENTS[h]!.find(w => w.label === way)!.id);

    // buy it: paid at once, and the farmer sets off for the farm
    const before = (await state(page)).coins;
    await page.getByRole('button', { name: new RegExp(`^Buy ${way}`) }).click();
    await expect.poll(async () => (await state(page)).trial.checks[key]?.paid ?? 0).toBeGreaterThan(0);
    const s1 = await state(page);
    expect(s1.coins).toBe(before - s1.trial.checks[key].paid);
    await expect(page.locator('.care-screen')).toHaveCount(0);

    // the work by hand on the problem's tiles
    await workFarm(page, 0, async () => !!(await state(page)).trial.checks[key]?.treated);
    const s2 = await state(page);
    // nothing more to pay once the work is done
    expect(s2.coins).toBe(s1.coins);
    expect(await eventNames(page)).toEqual(expect.arrayContaining(['prescribe', 'treatment_choice', 'treatment_buy', 'care_started', 'care_done']));
  });
}

test('weeds with a selective herbicide: bought, then the sprayer, the product, and spraying the weeds', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(() => (window as unknown as Win).__lima.problem('weeds' as never) as unknown as { day: number });
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  const key = `0:${c.day}`;
  await tapTask(page, 'Choose the fix for Farm 1');
  await chooseFix(page, 'weeds', 'Selective herbicide');
  await page.getByRole('button', { name: /^Buy Selective herbicide/ }).click();
  await expect.poll(async () => (await state(page)).trial.checks[key]?.paid ?? 0).toBeGreaterThan(0);
  // a spray job: the farmer walks to the shed for the sprayer first
  await expect(page.locator('.hud-task')).toContainText('Get the sprayer');
  await optIn(page);
  for (const kit of ['Gloves', 'Face mask', 'Boots']) await page.locator('.care-opt', { hasText: kit }).click();
  await page.locator('.care-opt', { hasText: 'Nicosulfuron' }).click();
  await page.getByRole('button', { name: 'Pick up the sprayer', exact: true }).click();
  // the farm's sprayer, then it is picked up
  await expect(page.locator('.pb-grid')).toBeVisible();
  await page.getByRole('button', { name: 'Pick up the sprayer', exact: true }).click();
  await expect.poll(async () => (await state(page)).field.carry).toBe('sprayer');
  await workFarm(page, 0, async () => !!(await state(page)).trial.checks[key]?.treated);
  expect((await state(page)).trial.checks[key].treatment).toBe('herbicide');
});

test('a newer problem read on the farm: its check, its call in two taps, then the fix', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(() => (window as unknown as Win).__lima.problem('wind' as never, false) as unknown as { day: number; hazard: string });
  expect(c.hazard).toBe('wind');
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  await tapTask(page, 'Check Farm 1');
  const call = await page.evaluate(x => (window as unknown as Win).__lima.callFor(x), 'wind');
  expect(call).toMatchObject({ group: 'Animals & weather', label: 'Wind flattened it', single: false });
  await lookAndCall(page, call);
  await page.getByRole('button', { name: 'Choose the fix', exact: true }).click();
  await expect(page.locator('.care-opt')).toHaveCount(3);
  for (const h of NEW) expect((await page.evaluate(x => (window as unknown as Win).__lima.callFor(x), h)).single, h).toBe(false);
});
