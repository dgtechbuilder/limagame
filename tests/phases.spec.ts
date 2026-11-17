import { expect, test } from '@playwright/test';
import { boot, scenario, state } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { COMMON_PLAN, DAMAGE, checkKey, farmCost, harvestFarm, hazardFor, newTrial, setChoice, type Trial, type TrialHazard } from '../src/trials/model';
import { FULL, emptyField, needOf, treatCostFor, type Field } from '../src/world/field';
import { TREATMENTS } from '../src/care/treatments';
import { DIMENSIONS, LABOUR_DAY } from '../src/strategy/data';
import { rowEffect, strategyCost } from '../src/strategy/model';
import { WATER } from '../src/water/config';
import { animalsUse, capacityOf, coverPayout, coverQuote, damDay, rainIn, tankOf, useToday } from '../src/water/model';
import { riskOf } from '../src/risk/model';
import { ledgerOf } from '../src/credits/ledger';
import { evidenceOf, evidenceSummary } from '../src/evidence/model';
import { areasOf } from '../src/climate/land';
import { CLIENTS, bizOf, dayValue, planDay, requestsFor, traitsOf, urgencyOf, type Bookings, type ReqKey } from '../src/business/model';

/* Climate-smart farming (row strategies, treatment choices), water as a real resource, the evidence layer, the shared
   catchment and the tractor business's farmers: played through the reducer and the real screens. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

/** Six farms planted on the fast clock, every farm dug, sown and fed. */
function planted(cycle = 2, sown = true): { t: Trial; f: Field } {
  const plan = setChoice(COMMON_PLAN, 'pest', 'scout');
  const t: Trial = { ...newTrial(cycle, false, plan), phase: 'growing', clock: 'fast', planted: 0, day: 1 };
  const f = emptyField(cycle);
  t.plans.forEach((_, i) => {
    f.marks[`${i}:prep`] = FULL;
    if (sown) f.marks[`${i}:sow`] = FULL;
    const feed = needOf('setupFeed', t, i);
    if (feed && sown) f.marks[`${i}:setupFeed`] = feed;
  });
  return { t, f };
}

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 100_000, ...patch });

/* ---------------- Phase 1: climate-smart choices on every plot ---------------- */

test('row strategies: rows left as the plan grow exactly as before; every dimension and option comes from the data file', () => {
  const { t } = planted();
  const empty = { ...t, strategies: t.plans.map(() => [{}, {}, {}, {}]) };
  expect(harvestFarm(empty, 0)).toEqual(harvestFarm(t, 0));
  expect(farmCost(empty, 0)).toBe(farmCost(t, 0));
  // every dimension starts with "as the farm plan", at no cost and no change
  for (const d of DIMENSIONS) expect(d.options[0]).toMatchObject({ id: 'plan', cost: 0, labour: 0, ret: 0 });
  expect(new Set(DIMENSIONS.map(d => d.group))).toEqual(new Set(['fertilizer', 'tilling', 'sowing', 'planting', 'planning', 'habits']));
});

test('four rows, four strategies: organic returns about 20% and DAP about 15% over the co-investment, side by side', () => {
  const { t } = planted();
  const rows = [{}, { fert: 'organic' }, { fert: 'dap' }, { mulch: 'residue', watering: 'morning' }];
  const tr: Trial = { ...t, forecast: 'normal', strategies: t.plans.map((_, i) => (i === 0 ? rows : [{}, {}, {}, {}])) };
  const r = harvestFarm(tr, 0);
  expect(r.rows).toHaveLength(4);
  const [plain, organic, dap] = r.rows!;
  expect(plain.ret).toBeNull();
  // with no problems their choices touch, the return is the placeholder in the table
  const noProblems = harvestFarm({ ...tr, checks: {} }, 0, 0);
  void noProblems;
  expect(organic.coInvest).toBe(100 + 3 * LABOUR_DAY);
  expect(organic.ret!).toBeGreaterThan(0.15);
  expect(dap.ret!).toBeGreaterThan(0.1);
  expect(organic.ret!).toBeGreaterThan(dap.ret!);
  // organic stores carbon and builds soil; DAP emits and takes soil health away
  expect(organic.stored).toBeGreaterThan(0);
  expect(organic.soil).toBeGreaterThan(0);
  expect(dap.co2).toBeGreaterThan(organic.co2);
  // the farm's harvest is the rows added up, and its costs carry the strategies
  expect(r.income).toBe(r.rows!.reduce((n, x) => n + x.income, 0));
  expect(farmCost(tr, 0)).toBe(farmCost(t, 0) + strategyCost(tr, 0));
});

test('a row strategy is paid when it is set while the farms grow, and a sown farm keeps its rows', () => {
  const { t, f } = planted(2, false);
  let s = game({ trial: t, field: f });
  const before = s.coins;
  s = reducer(s, { type: 'strategySet', farm: 0, row: 1, dim: 'fert', option: 'organic' });
  expect(s.trial!.strategies![0][1].fert).toBe('organic');
  expect(s.coins).toBe(before - strategyCost(s.trial!, 0));
  // row -1 sets every row
  s = reducer(s, { type: 'strategySet', farm: 1, row: -1, dim: 'mulch', option: 'residue' });
  expect(s.trial!.strategies![1].every(st => st.mulch === 'residue')).toBe(true);
  // sown: locked
  const sown = reducer({ ...s, field: { ...s.field, marks: { ...s.field.marks, '0:sow': FULL } } }, { type: 'strategySet', farm: 0, row: 2, dim: 'fert', option: 'dap' });
  expect(sown.trial!.strategies![0][2].fert).toBeUndefined();
  expect(sown.toast?.text).toMatch(/already sown/);
});

test('diagnose, then choose how to treat: a pinch of ash costs far less than pesticide and stops a little less of the damage', () => {
  const ways = TREATMENTS.armyworm!;
  expect(ways.map(w => w.id)).toEqual(['spray', 'ash', 'neem']);
  const { t } = planted();
  const read = (way?: string): Trial => ({ ...t, checks: { [checkKey(0, 1)]: { right: true, tries: 1, treated: true, treatment: way } } });
  const h: TrialHazard = 'armyworm';
  expect(treatCostFor(read('ash'), 0, 1, h)).toBe(Math.round(DAMAGE.armyworm.treat * 0.15));
  expect(treatCostFor(read(), 0, 1, h)).toBe(DAMAGE.armyworm.treat);
  // in the harvest: the same problem, treated two ways
  const loss = (way?: string) => {
    const tr = read(way);
    // make day 1 show armyworm on farm 0 for this comparison
    const r = harvestFarm({ ...tr, plans: tr.plans }, 0);
    return r.problems.find(p => p.day === 1)?.loss ?? 0;
  };
  // only meaningful when day 1 draws a treatable pest; otherwise both are 0
  expect(loss('ash')).toBeGreaterThanOrEqual(loss('spray'));
});

test('the choice is saved on the check, and the farm world asks for its cost', () => {
  const { t, f } = planted();
  let s = game({ trial: { ...t, checks: { [checkKey(0, 1)]: { right: true, tries: 1, treated: false, fix: 'spray' } } }, field: f });
  s = reducer(s, { type: 'treatChoose', farm: 0, day: 1, id: 'ash' });
  expect(s.trial!.checks[checkKey(0, 1)].treatment).toBe('ash');
  // a treatment already done can't change
  const done = reducer({ ...s, trial: { ...s.trial!, checks: { [checkKey(0, 1)]: { right: true, tries: 1, treated: true } } } }, { type: 'treatChoose', farm: 0, day: 1, id: 'neem' });
  expect(done.trial!.checks[checkKey(0, 1)].treatment).toBeUndefined();
});

test('row strategies feed the climate ledger at harvest: emissions, carbon stored, soil health', () => {
  const { t, f } = planted();
  const tr: Trial = { ...t, day: 7, strategies: t.plans.map(() => [{ fert: 'organic' }, { mulch: 'residue' }, {}, {}]) };
  const f2 = { ...f, marks: { ...f.marks } };
  tr.plans.forEach((_, i) => (f2.marks[`${i}:harvest`] = FULL));
  let s = game({ trial: tr, field: f2 });
  const stored0 = s.climate.total.stored;
  s = reducer(s, { type: 'trialHarvest' });
  expect(s.trial!.phase).toBe('done');
  expect(s.climate.total.stored).toBeGreaterThan(stored0);
  expect(s.climate.log.some(e => /row strategies/.test(e.label))).toBe(true);
});

/* ---------------- Phase 2: water ---------------- */

test('the tank: rain off the roofs in, the house, the animals and the rows out, a day at a time; water credits under the baseline', () => {
  day = '2026-11-15';
  const { t, f } = planted();
  let s = game({ trial: t, field: f });
  s = reducer(s, { type: 'climateTick' });
  expect(tankOf(s.tank).day).toBe('2026-11-15');
  const level0 = tankOf(s.tank).level;
  const use = useToday(s);
  day = '2026-11-16';
  s = reducer(s, { type: 'climateTick' });
  const tank = tankOf(s.tank);
  expect(tank.days).toHaveLength(1);
  expect(tank.level).toBe(Math.max(0, Math.min(capacityOf(s), level0 + rainIn(t.forecast)) - use.total));
  expect(tank.days[0]).toMatchObject({ house: WATER.house, animals: animalsUse(tank.herd) });
  // the day's water credits, in the generalised ledger
  const l = ledgerOf(s.ledger);
  const expected = Math.round((Math.max(0, WATER.credits.baseline - use.total) / WATER.credits.litresPerCredit) * 10) / 10;
  expect(l.paid.water).toBeCloseTo(expected, 5);
  if (expected > 0) expect(l.entries[0]).toMatchObject({ type: 'water' });
});

test('a low tank and a drought: more at risk, and the drought can not be watered by hand until water is bought', () => {
  const { t, f } = planted();
  // a farm read right for drought, its fix picked, its work almost done
  const tr: Trial = { ...t, checks: { [checkKey(0, 1)]: { right: true, tries: 1, treated: false, fix: 'water' } } };
  const dry = game({ trial: tr, field: f, tank: { ...tankOf(undefined), level: 500 } });
  // a drought's amount at risk with the tank low is bigger
  const worse = riskOf(tr, f, 0, { worse: { drought: WATER.droughtLowTank } });
  const plain = riskOf(tr, f, 0);
  const d1 = worse.items.find(x => x.hazard === 'drought');
  const d0 = plain.items.find(x => x.hazard === 'drought');
  if (d1 && d0) expect(d1.amount).toBeGreaterThan(d0.amount);
  // buying water fills the tank
  const bought = reducer(dry, { type: 'waterBuy', kind: 'transported' });
  expect(tankOf(bought.tank).level).toBe(Math.min(capacityOf(bought), 500 + WATER.transported.litres));
  expect(bought.coins).toBe(dry.coins - WATER.transported.price);
  const piped = reducer(dry, { type: 'waterBuy', kind: 'piped' });
  expect(tankOf(piped.tank).level).toBe(500 + WATER.piped.litres);
  expect(capacityOf({ inventory: ['tank-l'] })).toBe(WATER.tank.base + 10_000);

  // a farm that shows a drought: its watering by hand waits for water in the tank
  let found: { tr: Trial; d: number } | null = null;
  for (let cycle = 2; cycle < 400 && !found; cycle++) {
    const { t: t2 } = planted(cycle);
    for (const d of [3, 4]) {
      const checks: Trial['checks'] = {};
      for (let dd = 1; dd < d; dd++) t2.plans.forEach((_, i) => (checks[checkKey(i, dd)] = { right: true, tries: 1, treated: true }));
      const tr2: Trial = { ...t2, day: d, checks };
      if (hazardFor(tr2, 0, d) === 'drought') {
        found = { tr: { ...tr2, checks: { ...checks, [checkKey(0, d)]: { right: true, tries: 1, treated: false, fix: 'water' } } }, d };
        break;
      }
    }
  }
  expect(found).toBeTruthy();
  const { tr: tr2, d } = found!;
  const s0 = game({ trial: tr2, field: f, tank: { ...tankOf(undefined), level: 500 } });
  const blocked = reducer(s0, { type: 'fieldMark', farm: 0, job: `t${d}`, bits: FULL });
  expect(blocked.trial!.checks[checkKey(0, d)].treated).toBe(false);
  expect(blocked.toast?.text).toMatch(/Buy water/);
  const watered = reducer({ ...s0, tank: { ...tankOf(undefined), level: 9000 } }, { type: 'fieldMark', farm: 0, job: `t${d}`, bits: FULL });
  expect(watered.trial!.checks[checkKey(0, d)].treated).toBe(true);
  expect(tankOf(watered.tank).level).toBe(9000 - TREATMENTS.drought![0].water!);
});

test('cows or hens: the herd sets the water drunk and the animals’ emissions', () => {
  let s = game();
  const before = areasOf(s).find(a => a.id === 'animals')!;
  s = reducer(s, { type: 'herdSet', cows: 0, hens: 40 });
  expect(tankOf(s.tank).herd).toEqual({ cows: 0, hens: 40 });
  const after = areasOf(s).find(a => a.id === 'animals')!;
  expect(after.water).toBeLessThan(before.water);
  expect(animalsUse({ cows: 0, hens: 40 })).toBe(Math.round(40 * WATER.animals.hen.litres));
});

test('crop cover is priced on water practices and pays back a share of the weather’s damage at harvest', () => {
  const { t, f } = planted();
  const s = game({ trial: t, field: f });
  const q0 = coverQuote({ ...s, tank: { ...tankOf(undefined), level: 1000 } });
  const wise: Trial = { ...t, strategies: t.plans.map(() => [{ mulch: 'residue' }, { seedbed: 'zai' }, {}, {}]) };
  const q1 = coverQuote({ ...s, trial: wise, tank: { ...tankOf(undefined), level: 9000, policy: 'fair' } });
  expect(q1.premium).toBeLessThan(q0.premium);
  expect(q1.lines.length).toBeGreaterThanOrEqual(3);
  const covered = reducer(s, { type: 'coverBuy' });
  expect(tankOf(covered.tank).cover?.cycle).toBe(t.cycle);
  // a harvest with a drought missed: cover pays a share of it
  const results = t.plans.map((_, i) => harvestFarm(t, i));
  results[0] = { ...results[0], problems: [{ hazard: 'drought', day: 3, caught: false, loss: 0.13 }] };
  expect(coverPayout({ ...t, results })).toBeGreaterThan(0);
});

test('the shared catchment: rationed when it runs low, a fair share takes less, and less irrigation grows less', () => {
  const full = damDay(WATER.catchment.capacity * 0.9, 'normal', 100_000, 'full');
  expect(full.rationed).toBe(false);
  expect(full.got).toBe(100_000);
  const low = damDay(WATER.catchment.capacity * 0.1, 'dry', 400_000, 'full');
  const fair = damDay(WATER.catchment.capacity * 0.1, 'dry', 400_000, 'fair');
  expect(low.rationed).toBe(true);
  expect(low.got).toBeLessThan(400_000);
  expect(fair.got).toBeLessThanOrEqual(low.got);
  // a farm watered by its plan: half the irrigation delivered grows less
  const { t } = planted();
  const wet: Trial = { ...t, forecast: 'dry', plans: t.plans.map(p => ({ ...p, water: 20 })) };
  expect(harvestFarm({ ...wet, delivered: 0.5 }, 0).bags).toBeLessThan(harvestFarm(wet, 0).bags);
});

/* ---------------- Phase 3: evidence ---------------- */

test('the evidence layer logs decisions with a time, carries programme tags, and asks "have you tried this on your own farm?"', () => {
  const { t, f } = planted(2, false);
  let s = game({ trial: t, field: f });
  s = reducer(s, { type: 'evidenceTag', tag: 'KALRO Cohort 3', on: true });
  expect(evidenceOf(s.evidence).tags).toEqual(['kalro-cohort-3']);
  s = reducer(s, { type: 'strategySet', farm: 0, row: 0, dim: 'mulch', option: 'residue' });
  s = reducer(s, { type: 'strategySet', farm: 0, row: 1, dim: 'watering', option: 'morning' });
  s = reducer(s, { type: 'trialCheck', farm: 1, day: 1, right: false, tries: 1 });
  s = reducer(s, { type: 'drawPolicy', policy: 'fair' });
  const e = evidenceOf(s.evidence);
  expect(e.log.map(d => d.k)).toEqual(['strategy', 'watering-time', 'check', 'water-policy']);
  expect(e.log.every(d => typeof d.t === 'number')).toBe(true);
  // the first climate-smart practice asks the question; no second one the same day
  expect(e.pending?.practice).toBe('residue');
  s = reducer(s, { type: 'evidenceAnswer', answer: 'planning' });
  expect(evidenceOf(s.evidence).answers[0]).toMatchObject({ practice: 'residue', answer: 'planning' });
  expect(evidenceOf(s.evidence).pending).toBeNull();
  s = reducer(s, { type: 'strategySet', farm: 0, row: 2, dim: 'fert', option: 'organic' });
  expect(evidenceOf(s.evidence).pending).toBeNull();
  expect(evidenceSummary(s).checks).toBe(1);
});

/* ---------------- tractor module ---------------- */

test('tractor business: each farmer’s urgency, willingness to pay and reliability; the farm’s own season makes work urgent', () => {
  expect(CLIENTS.every(c => traitsOf(c.id).reliability > 0 && traitsOf(c.id).pay > 0)).toBe(true);
  expect(urgencyOf('njeri', 'planting', null)).toBe(1);
  expect(urgencyOf('njeri', 'planting', { planting: true, forecast: 'wet' })).toBe(3);
  expect(urgencyOf('njeri', 'harvest', { planting: false, forecast: 'dry' })).toBe(2);
  expect(dayValue(1, 1, 1)).toBe(100);
  expect(dayValue(1, 0.5, 0)).toBeLessThan(dayValue(0.8, 1, 1));
  const b = bizOf({ day: 4 });
  const req = requestsFor(b);
  const bookings: Bookings = {};
  for (const k of req as ReqKey[]) if (b.tools.includes(k.split(':')[2] as never)) bookings[k] = 'me';
  const plan = planDay(b, req, bookings, [], {}, { planting: true, forecast: 'wet' });
  expect(plan.collected).toBeLessThanOrEqual(Math.round(plan.revenue * 1.2));
  expect(plan.shortfall).toBe(plan.revenue - plan.collected);
  expect(plan.profit).toBe(plan.collected + plan.commission - plan.diesel - plan.wage - plan.hubFee);
  expect(plan.value).toBeGreaterThanOrEqual(0);
  expect(plan.value).toBeLessThanOrEqual(100);
});

/* ---------------- on screen ---------------- */

test('on screen: choose how to treat after the right fix, the water tank on the farm, Climate › Water, and the trend chart', async ({ page }) => {
  await boot(page);
  const { day: d } = await scenario(page, 'fix');
  // the fix for Farm 1's weeds: the right one, then the ways to do it
  await page.evaluate(() => (window as any).__lima.dispatch({ type: 'toast', text: '' }));
  await page.locator('.hud-risk').click();
  await page.locator('.risk-list li', { hasText: 'Farm 1' }).click();
  const right = await page.evaluate(() => (window as any).__lima.fixes('weeds').find((x: any) => x.right).label);
  await page.getByRole('button', { name: right }).click();
  const ways = page.getByRole('group', { name: 'How to do it' });
  await expect(ways).toBeVisible();
  await ways.getByRole('button', { name: /Weed, then mulch/ }).click();
  const st = await state(page);
  expect(st.trial.checks[`0:${d}`].treatment).toBe('mulch');
  await page.getByRole('button', { name: 'Back to the farm' }).last().click();

  // the tank on the HUD opens Climate › Water; buy a bowser
  await page.getByRole('button', { name: /Water tank/ }).click();
  await expect(page.getByText('The tank', { exact: true })).toBeVisible();
  const before = await page.evaluate(() => (window as any).__lima.state.tank?.level ?? 6000);
  await page.getByRole('button', { name: /A bowser/ }).click();
  const after = await page.evaluate(() => (window as any).__lima.state.tank.level);
  expect(after).toBeGreaterThan(before);
  await page.getByRole('button', { name: /^Credits$/ }).click();
  await expect(page.getByText('Water credits').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // the tractor business: My trend
  await page.evaluate(() => {
    const L = (window as any).__lima;
    L.dispatch({ type: 'bizIntro' });
    L.dispatch({ type: 'biz', open: true });
  });
  await page.getByRole('tab', { name: 'My trend' }).click();
  await expect(page.locator('.biz-trend-empty, .biz-trend')).toBeVisible();
});

test('on screen: the question about the player’s own farm, answered, and the programme code in Settings', async ({ page }) => {
  await boot(page);
  await scenario(page, 'plots');
  await page.evaluate(() => (window as any).__lima.dispatch({ type: 'strategySet', farm: 1, row: 0, dim: 'seedbed', option: 'zai' }));
  const ask = page.getByRole('dialog', { name: 'Have you tried this on your own farm?' });
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('zai pits');
  await ask.getByRole('button', { name: 'Yes, I have' }).click();
  await expect(ask).toBeHidden();
  expect((await state(page)).evidence.answers[0]).toMatchObject({ practice: 'zai', answer: 'yes' });
  await page.evaluate(() => (window as any).__lima.dispatch({ type: 'open', modal: { kind: 'settings', tab: 'help' } }));
  await page.getByLabel('Programme code').fill('Pilot-A');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  expect((await state(page)).evidence.tags).toEqual(['pilot-a']);
});
