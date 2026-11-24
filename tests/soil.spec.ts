import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';
import { initialState, reducer, REST_POINTS, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { COMMON_PLAN, checkKey, explain, farmCost, harvestFarm, hazardFor, newTrial, planProblem, setChoice, trialCost, type Trial } from '../src/trials/model';
import { emptyField, nextTask, setupLeft } from '../src/world/field';
import { landOf } from '../src/climate/land';
import { farmsUse } from '../src/water/model';
import { REST, SOIL, cropChange, restAdvice, soilAfter, soilFactor, soilOf } from '../src/soil/model';
import { ROT, rotRefs, rotSeason, rotStart, scoreRot, starsOf, type RotPick } from '../src/csa/rules';
import { soilCare } from '../src/csa/model';
import { PRACTICES } from '../src/csa/data';

/* Resting the land (src/soil): each farm's soil, worn by every crop and brought back by a rest; resting a farm in
   the cycle's plan (no cost or a cover crop's seed, no work, no checks, no harvest, carbon stored every day); the
   soil setting a share of the next harvest; the Resting the land practice and its rotation game (src/csa). */

let day = '2026-11-23';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  coins: 500_000,
  // one cycle already played: the next is six farms, planned
  trialHistory: [{ cycle: 1, farms: 2, best: 0, bags: [1, 1], profit: [0, 0] }],
  ...patch,
});

/* ---------------- the soil model ---------------- */

test('soil: a crop wears it out, climate-smart farming and rest bring it back; the harvest follows it', () => {
  // the starting soil grows the plan's harvest; rich soil more, worn-out soil less
  expect(soilFactor(SOIL.start)).toBeCloseTo(1, 5);
  expect(soilFactor(100)).toBeGreaterThan(1);
  expect(soilFactor(30)).toBeLessThan(0.8);
  expect(soilFactor(undefined)).toBe(1);
  // a plain crop takes 10; mulch, manure and beans give back more than that; slash and burn takes more
  const plain = cropChange(COMMON_PLAN, { seed: 'certified', fert: 'basal' } as never, 0).change;
  expect(plain).toBe(SOIL.cropped);
  expect(cropChange({ ...COMMON_PLAN, land: 'mulch' }, { seed: 'intercrop', fert: 'manure' } as never, 0).change).toBeGreaterThan(0);
  expect(cropChange({ ...COMMON_PLAN, land: 'slash' }, { seed: 'certified', fert: 'none' } as never, 0).change).toBeLessThan(plain);
  // cropped many cycles in a row: it loses more
  expect(cropChange(COMMON_PLAN, { seed: 'certified', fert: 'basal' } as never, 5).change).toBe(plain - SOIL.streakLoss);
  // a cycle: farm 1 cropped, farm 2 under cover, farm 3 fallow
  const t = { plans: [COMMON_PLAN, COMMON_PLAN, COMMON_PLAN], plots: undefined, rest: [null, 'cover', 'fallow'] as Trial['rest'] };
  const after = soilAfter(soilOf({ health: [80, 50, 50], streak: [2, 4, 4] }), t);
  expect(after.health.slice(0, 3)).toEqual([80 + SOIL.cropped - SOIL.streakLoss, 50 + REST.cover.soil, 50 + REST.fallow.soil]);
  expect(after.streak.slice(0, 3)).toEqual([3, 0, 0]);
  expect(after.rested.slice(0, 3)).toEqual([0, 1, 1]);
  // the advice: the worn-out and the long-cropped first, never more than half the farms
  const advice = restAdvice({ health: [40, 90, 52, 80, 80, 80], streak: [1, 1, 1, 5, 0, 0] });
  expect(advice.map(a => a.farm)).toEqual([0, 2, 3]);
  expect(restAdvice({ health: [20, 20, 20, 20, 20, 20] })).toHaveLength(3);
});

/* ---------------- resting a farm in the plan ---------------- */

const planned = (patch: Partial<GameState> = {}) => reducer(game(patch), { type: 'trialNew' });

test('the plan: rest a farm for free or under a cover crop; it costs only its seed and at least one farm is planted', () => {
  let s = planned();
  const t0 = s.trial!;
  expect(t0.phase).toBe('plan');
  const full = farmCost(t0, 2);
  s = reducer(s, { type: 'trialRest', farm: 2, rest: 'fallow' });
  s = reducer(s, { type: 'trialRest', farm: 4, rest: 'cover' });
  expect(s.trial!.rest).toEqual([null, null, 'fallow', null, 'cover', null]);
  expect(farmCost(s.trial!, 2)).toBe(0);
  expect(farmCost(s.trial!, 4)).toBe(REST.cover.cost);
  expect(trialCost(s.trial!)).toBe(trialCost(t0) - full - farmCost(t0, 4) + REST.cover.cost);
  // resting farms never count as twins of a planted farm
  expect(planProblem({ ...s.trial!, plans: s.trial!.plans.map((p, i) => (i === 2 ? p : setChoice(p, 'water', String(10 * (i % 6))))) }, s.coins)).toBeNull();
  // every farm resting: refused
  for (const f of [0, 1, 3]) s = reducer(s, { type: 'trialRest', farm: f, rest: 'fallow' });
  const last = reducer(s, { type: 'trialRest', farm: 5, rest: 'fallow' });
  expect(last.trial!.rest?.[5]).toBeNull();
  expect(last.toast?.text).toMatch(/at least one farm/);
  // plant a farm again
  s = reducer(s, { type: 'trialRest', farm: 2, rest: null });
  expect(s.trial!.rest?.[2]).toBeNull();
});

/** A cycle with Farms 3 and 5 resting, every planted farm's plan made different, planted on the fast clock. */
function plantedWithRest(soil?: GameState['soil']) {
  let s = planned({ view: 'world', ...(soil ? { soil } : {}) });
  s = { ...s, trial: { ...s.trial!, plans: s.trial!.plans.map((p, i) => setChoice(p, 'water', String(10 * (i % 6)))) } };
  s = reducer(s, { type: 'trialRest', farm: 2, rest: 'cover' });
  s = reducer(s, { type: 'trialRest', farm: 4, rest: 'fallow' });
  const coins = s.coins;
  const cost = trialCost(s.trial!);
  s = reducer(s, { type: 'trialPlant', clock: 'fast' });
  expect(s.trial!.phase).toBe('growing');
  expect(s.coins).toBe(coins - cost);
  expect(s.toast?.text).toMatch(/2 resting/);
  return s;
}

test('a resting farm: no work, no checks, no water, no problems; it stores carbon every day', () => {
  const s = plantedWithRest();
  const t = s.trial!;
  expect(t.soil).toEqual(soilOf(undefined).health);
  // nothing to clear or sow, and the task card never sends the farmer there
  expect(setupLeft(emptyField(t.cycle), t, 2)).toBeNull();
  expect(setupLeft(emptyField(t.cycle), t, 0)).toBe('prep');
  for (let d = 1; d <= 6; d++) expect(hazardFor(t, 2, d)).toBe('healthy');
  // every planted farm checked: the next day starts, with the resting farms unchecked
  let g = { ...s, trial: { ...t, checks: Object.fromEntries([0, 1, 3, 5].map(f => [checkKey(f, 1), { right: true, tries: 1, treated: false }])) } };
  expect(nextTask(emptyField(t.cycle), g.trial!, 0, g.coins).target).not.toEqual({ farm: 2, at: 'sign' });
  g = reducer(g, { type: 'trialNextDay' });
  expect(g.trial!.day).toBe(2);
  // the land: 40 plots resting, storing carbon (more under the cover crop); no water from the tank
  const land = landOf(g);
  expect(land.resting).toBe(40);
  expect(land.farms[2].rate).toBe(REST.cover.carbon);
  expect(land.farms[4].rate).toBe(REST.fallow.carbon);
  expect(land.stored).toBeGreaterThan(0);
  expect(farmsUse({ ...g, field: emptyField(t.cycle) })).toBe(0);
});

test('the harvest: resting farms grow nothing and are left out of the comparison; the soil moves; it pays rest points', () => {
  const s = plantedWithRest();
  const t: Trial = { ...s.trial!, day: 7 };
  const r2 = harvestFarm(t, 2);
  expect(r2).toMatchObject({ bags: 0, income: 0, costs: REST.cover.cost, rested: 'cover' });
  expect(harvestFarm(t, 4).costs).toBe(0);
  const results = t.plans.map((_, i) => harvestFarm(t, i));
  const why = explain(t, results);
  expect([2, 4]).not.toContain(why.best);
  expect([2, 4]).not.toContain(why.worst);
  const points = s.points;
  const h = reducer({ ...s, trial: t }, { type: 'trialHarvest' });
  expect(h.trial!.phase).toBe('done');
  expect(h.points).toBe(points + 50 * 4 + REST_POINTS * 2);
  const soil = soilOf(h.soil);
  expect(soil.health[2]).toBe(Math.min(SOIL.max, SOIL.start + REST.cover.soil));
  expect(soil.health[4]).toBe(SOIL.start + REST.fallow.soil);
  expect(soil.health[0]).toBeLessThan(SOIL.start);
  expect(soil.last).toHaveLength(6);
  // the next cycle plants on that soil: the rested farm grows more than it would have on the starting soil
  expect(soilFactor(soil.health[2])).toBeGreaterThan(soilFactor(SOIL.start));
});

test('the soil sets a share of the harvest: the same farm on worn-out soil grows less', () => {
  const t0 = { ...newTrial(2, false, COMMON_PLAN), phase: 'growing' as const, clock: 'fast' as const, planted: 0, day: 7 };
  const rich = harvestFarm({ ...t0, soil: [95, 95, 95, 95, 95, 95] }, 0);
  const poor = harvestFarm({ ...t0, soil: [25, 25, 25, 25, 25, 25] }, 0);
  expect(poor.bags).toBeLessThan(rich.bags * 0.8);
  expect(poor.soilFactor).toBeCloseTo(soilFactor(25), 5);
  // two farms the same but for the soil: TemoLima AI names the soil
  const t = { ...t0, plans: t0.plans.map((p, i) => (i === 1 ? setChoice(p, 'water', '0') : p)), soil: [95, 25, 80, 80, 80, 80] };
  const why = explain(t, t.plans.map((_, i) => harvestFarm(t, i)));
  expect(why.lines.join(' ')).toMatch(/Soil:/);
});

/* ---------------- the practice, and its game ---------------- */

test('Resting the land: the rotation game rewards resting in turns, not never resting or resting too much', () => {
  for (const seed of [1, 7, 42, 99, 2026]) {
    const start = rotStart(seed);
    const never: RotPick[][] = Array.from({ length: ROT.seasons }, () => start.map(() => null));
    expect(starsOf(scoreRot(start, never).score)).toBe(1);
    // the poorest two under cover, each season: three stars
    let farms = start;
    const turns: RotPick[][] = [];
    for (let k = 0; k < ROT.seasons; k++) {
      const order = farms.map((_, i) => i).sort((a, b) => farms[a].soil - farms[b].soil || farms[b].streak - farms[a].streak);
      const picks = farms.map((_, i) => (order.slice(0, 2).includes(i) ? 'cover' : null)) as RotPick[];
      turns.push(picks);
      farms = rotSeason(farms, picks).farms;
    }
    const ref = rotRefs(start, ROT.seasons);
    expect(ref.best).toBeGreaterThan(ref.never);
    expect(scoreRot(start, turns).score).toBeGreaterThan(scoreRot(start, never).score);
  }
  // a season with too few farms planted leaves the family short
  const start = rotStart(5);
  expect(rotSeason(start, start.map((_, i) => (i < 3 ? 'cover' : null))).short).toBeGreaterThan(0);
  expect(PRACTICES.find(p => p.id === 'rest')?.slug).toBe('resting-the-land');
  // the skill helps the farms' soil
  expect(soilCare({ xp: { rest: 10, zai: 6 } })).toEqual({ crop: 1, rest: 4 });
});

/* ---------------- on screen ---------------- */

type Lima = { __lima: { jump: (s: Record<string, unknown>) => void } };
const jump = (page: Page, s: Record<string, unknown>) => page.evaluate(x => (window as unknown as Lima).__lima.jump(x), s);
const climate = (page: Page) => page.getByRole('dialog', { name: 'Climate' });

test('Climate Smart Agriculture shows the farms’ soil and rests the advised farms in the plan; the plan’s Use row', async ({ page }) => {
  await boot(page);
  const t = newTrial(3, false, COMMON_PLAN);
  await jump(page, { view: 'classic', coins: 500_000, trial: t, trialHistory: [{ cycle: 2, farms: 6, best: 0, bags: [], profit: [] }], soil: { health: [40, 85, 50, 80, 80, 80], streak: [4, 1, 3, 1, 1, 1] } });
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/farm');
  await page.evaluate(() => (location.hash = '#/climate/climate-smart-agriculture'));
  const panel = climate(page).getByLabel('Your six farms\' soil');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.soil-advice p')).toContainText('Worth resting next: Farm 1');
  await panel.getByRole('button', { name: /Rest Farm 1 and Farm 3 under a cover crop/ }).click();
  // the plan opens with both farms resting
  await expect(page.getByRole('button', { name: /Farm 1: Rest: green-manure cover crop/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Farm 3: Rest: green-manure cover crop/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plant 4 · rest 2' })).toBeVisible();
  // put Farm 3 back to a crop from its Use cell
  await page.getByRole('button', { name: /Farm 3: Rest: green-manure cover crop/ }).click();
  await page.getByRole('dialog', { name: 'Farm 3: plant or rest' }).getByRole('button', { name: /Plant maize/ }).click();
  await expect(page.getByRole('button', { name: 'Plant 5 · rest 1' })).toBeVisible();
});

test('Resting the land: the lesson and its rotation game played to the end', async ({ page }) => {
  await boot(page);
  await jump(page, { view: 'classic', coins: 5000 });
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/farm');
  await page.evaluate(() => (location.hash = '#/climate/climate-smart-agriculture/resting-the-land'));
  await expect(climate(page).getByText('Rest in turns', { exact: false }).first()).toBeVisible();
  await climate(page).getByRole('button', { name: /Practise it/ }).click();
  for (let k = 0; k < ROT.seasons; k++) {
    // rest the first farm under a cover crop, then grow the season
    await climate(page).getByRole('button', { name: /^Farm 1: soil/ }).click();
    await climate(page).getByRole('button', { name: /Grow the season/ }).click();
    if (k < ROT.seasons - 1) await climate(page).getByRole('button', { name: /Plan season/ }).click();
  }
  await climate(page).getByRole('button', { name: 'Finish' }).click();
  await expect(climate(page).getByText(/bags grown over 4 seasons/)).toBeVisible();
});
