import { expect, test } from '@playwright/test';
import { boot, optIn, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { MARKET, START_STORE, daySale, produceOf, profitOf } from '../src/produce/model';
import { DISHES, RESTAURANT, dishOf, quote } from '../src/produce/restaurant';
import { FOODS, nutritionOf, peopleDays, harvestLine } from '../src/nutrition/data';
import { GREENHOUSE, greenhouseOf } from '../src/greenhouse/model';
import { lifeOf, type LifeState } from '../src/livestock/model';
import { walletOf } from '../src/wallet/model';
import { newTrial, COMMON_PLAN } from '../src/trials/model';
import { trackSystems } from '../src/systems/track';

/* Nutrition across the game (what each crop gives the people who eat it), the market stall's daily sales cycle (25 kg
   of the store sold every day, for a profit), and the restaurant beside the stall that cooks the store into meals.
   Played through the reducer, then the pages in the browser. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 100_000, ...patch });
const onDay = (d: number, life: Partial<LifeState> = {}, patch: Partial<GameState> = {}) => game({ life: { day: d, started: d >= 2 ? 2 : null, date: day, ...life }, ...patch });
const act = (s: GameState, ...as: Parameters<typeof reducer>[1][]) => as.reduce(reducer, s);

test('every crop has its nutrition: maize is energy, beans protein, dark leaves vitamins', () => {
  // dry beans have well over twice the protein of maize, and three times the iron
  expect(FOODS.drybeans.per100.protein).toBeGreaterThan(FOODS.maize.per100.protein * 2);
  expect(FOODS.drybeans.per100.iron).toBeGreaterThan(FOODS.maize.per100.iron * 3);
  // maize is the energy food; sukuma wiki has far more vitamin A and calcium than cucumber; chillies and capsicum
  // are the vitamin C crops of the greenhouse
  expect(FOODS.maize.per100.energy).toBeGreaterThan(FOODS.sukuma.per100.energy * 5);
  expect(FOODS.sukuma.per100.vitA).toBeGreaterThan(FOODS.cucumber.per100.vitA * 20);
  expect(FOODS.sukuma.per100.calcium).toBeGreaterThan(FOODS.cucumber.per100.calcium * 3);
  expect(FOODS.chillies.strong[0]).toBe('vitC');
  expect(FOODS.capsicum.per100.vitC).toBeGreaterThan(FOODS.tomatoes.per100.vitC * 5);
  expect(FOODS.maize.strong[0]).toBe('energy');
  expect(FOODS.drybeans.strong[0]).toBe('protein');
  // a kg of maize: 3,650 kcal, nearly two adults' energy for a day
  expect(nutritionOf({ maize: 1 }).energy).toBe(3650);
  expect(peopleDays(nutritionOf({ maize: 1 })).energy).toBeCloseTo(1.825, 3);
  expect(harvestLine({ sukuma: 30 })).toMatch(/vitamin c for 372 people/i);
});

test('the daily sales cycle: when a day ends the stall sells the day’s 25 kg, a mix of the store, for a profit', () => {
  day = '2026-11-15';
  // the game starts with last season's harvest in the store, so the stall sells from the first day
  expect(produceOf(undefined).store).toEqual(START_STORE);
  let s = onDay(5, { date: '2026-11-14' }, { produce: { store: { maize: 60, drybeans: 20, sukuma: 20 } } });
  const coins = s.coins;
  // (any action settles the night that passed)
  s = act(s, { type: 'toast', text: 'morning' });
  const p = produceOf(s.produce);
  expect(lifeOf(s.life).day).toBe(6);
  expect(p.sales[0]).toMatchObject({ day: 5, kg: MARKET.dailyKg, auto: true });
  // a share of everything in the store
  expect(Object.keys(p.sales[0].items).sort()).toEqual(['drybeans', 'maize', 'sukuma']);
  expect(p.sales[0].items.maize).toBe(15);
  expect(p.store.maize).toBe(45);
  expect(profitOf(p.sales[0])).toBeGreaterThan(0);
  expect(s.coins).toBeGreaterThan(coins);
  const e = walletOf(s.wallet).entries.find(x => /Market stall, farm day 5/.test(x.label));
  expect(e).toMatchObject({ kind: 'produce', amount: p.sales[0].earned });
  // the sale is on the morning's news (or a short message when there is no news)
  const words = s.success?.kind === 'morning' ? s.success.lines.map(l => `${l.title} ${l.text}`).join(' ') : (s.toast?.text ?? '');
  expect(words).toMatch(/(sold 25 kg on day 5|25 kg sold).*profit/);

  // the farmer sold 20 kg themselves: the evening sells only the 5 kg left
  s = act(s, { type: 'produceSell', items: { drybeans: 10, maize: 10 } });
  day = '2026-11-16';
  s = act(s, { type: 'toast', text: 'morning' });
  expect(produceOf(s.produce).sales[0]).toMatchObject({ day: 6, kg: 5, auto: true });
  expect(produceOf(s.produce).sales[1]).toMatchObject({ day: 6, kg: 20 });

  // turned off: only what the farmer chooses is sold
  s = act(s, { type: 'produceAuto', on: false });
  const n = produceOf(s.produce).sales.length;
  day = '2026-11-17';
  s = act(s, { type: 'toast', text: 'morning' });
  expect(lifeOf(s.life).day).toBe(8);
  expect(produceOf(s.produce).sales.length).toBe(n);
  // an empty store sells nothing
  expect(daySale({ store: {} }, 3, day, false)).toBeNull();
});

test('the restaurant cooks the store into meals: more money than selling the food raw, 30 plates a day', () => {
  day = '2026-11-15';
  let s = onDay(5, {}, { produce: { store: { maize: 10, drybeans: 3, tomatoes: 2, capsicum: 1 } } });
  const coins = s.coins;
  s = act(s, { type: 'restaurantCook', dish: 'githeri', plates: 10 });
  let p = produceOf(s.produce);
  expect(p.meals[0]).toMatchObject({ dish: 'githeri', plates: 10, day: 5 });
  expect(p.store.maize).toBe(8.5);
  expect(p.store.drybeans).toBe(2);
  expect(s.coins).toBeCloseTo(coins + dishOf('githeri').price * 10, 4);
  expect(s.toast?.text).toMatch(/protein for \d/);
  // as meals the food earns more than raw at the stall, after cooking
  for (const d of DISHES) expect(quote(d, 10, false).extra).toBeGreaterThan(0);
  // 30 plates a day: 20 more today
  s = act(s, { type: 'restaurantCook', dish: 'githeri', plates: 30 });
  p = produceOf(s.produce);
  expect(p.kitchen.plates).toBe(RESTAURANT.dailyPlates);
  expect(p.meals[0].plates).toBe(20);
  s = act(s, { type: 'restaurantCook', dish: 'kachumbari', plates: 5 });
  expect(s.toast?.text).toMatch(/come back tomorrow/);
  // food the store does not have
  s = act({ ...s, life: { ...lifeOf(s.life), day: 6 } }, { type: 'restaurantCook', dish: 'juice', plates: 5 });
  expect(s.toast?.text).toMatch(/Not enough in the store.*strawberries/);
  expect(walletOf(s.wallet).entries.some(x => x.kind === 'produce')).toBe(true);
});

test('a greenhouse pick says how many people it feeds', () => {
  let s = onDay(GREENHOUSE.openDay);
  s = act(s, { type: 'ghPlant', bed: 1, crop: 'capsicum', score: 1 });
  const b = greenhouseOf(s.greenhouse).beds[1];
  expect(b.crop).toBe('capsicum');
  s = act({ ...s, life: { ...lifeOf(s.life), day: b.ready } }, { type: 'ghWater', bed: 1 }, { type: 'ghHarvest', bed: 1, score: 1 });
  expect(s.toast?.text).toMatch(/kg of capsicum into the storehouse · a day’s vitamin c for [\d,]+ people/);
  expect(produceOf(s.produce).store.capsicum).toBeGreaterThan(20);
  expect(greenhouseOf(s.greenhouse).log[0]).toMatchObject({ bed: 1, crop: 'capsicum', day: b.ready });
});

test('the six farms’ harvest keeps maize, and the beans grown between the rows, in the store', () => {
  const t = newTrial(2, false, COMMON_PLAN);
  const prev = onDay(5, {}, { trial: { ...t, phase: 'growing' }, produce: { store: {} } });
  const next = { ...prev, trial: { ...t, phase: 'done' as const, results: [{ bags: 10, beans: 2 }, { bags: 8, beans: 0 }] as never } };
  const out = trackSystems(prev, next, { type: 'trialHarvest' } as never);
  expect(produceOf(out.produce).store).toEqual({ maize: 27 + 22, drybeans: 2 * MARKET.bagKg * MARKET.beanShare });
});

test('the restaurant beside the stall, the nutrition table and the markers on the seeds, in the browser', async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({ view: 'world', coins: 50_000, life: { day: 5, date: null, started: 2 }, produce: { store: { maize: 40, drybeans: 12, sukuma: 10, tomatoes: 5, capsicum: 3 } } } as never),
  );
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  // a quick farmer, as in the other farm tests (helpers.ts scenario), so a slow machine keeps up with the walk
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  // walk to the restaurant beside the stall and open it
  await page.evaluate(() => {
    const at = (window as unknown as Win).__lima.places.restaurant;
    (window as unknown as Win).__limaWorld!.walkTo(at.x, at.z);
  });
  // the walk across the farm takes about 9 seconds here and two or three times that on a slow CI runner
  await expect(page.locator('.hud-place .is-enter')).toContainText('Open the restaurant', { timeout: 60_000 });
  await optIn(page);
  const market = page.getByRole('dialog', { name: 'Market stall', exact: true });
  await expect(market).toBeVisible();
  await expect(page).toHaveURL(/#\/market\/restaurant$/);
  // a dish shows a plate's nutrition, and cooks from the store
  const githeri = market.getByLabel('Githeri', { exact: true });
  await expect(githeri.getByRole('list', { name: /One plate/ }).getByRole('listitem', { name: /^Protein/ })).toBeVisible();
  await githeri.getByRole('button', { name: 'Cook and sell 5 plates of Githeri' }).click();
  await expect.poll(async () => (await state(page)).produce.meals?.[0]?.dish).toBe('githeri');
  // the nutrition table: every crop side by side
  await market.getByRole('button', { name: /Nutrition/ }).click();
  await expect(page).toHaveURL(/#\/market\/nutrition$/);
  const table = market.getByRole('table', { name: /Nutrition in 100 g/ });
  await expect(table.getByRole('row')).toHaveCount(9);
  await table.getByRole('button', { name: /Dry beans/ }).click();
  await expect(market.locator('.nu-card').first()).toContainText('Dry beans');
  // the stall: the daily selling switch, and markers on every crop in the store
  await market.getByRole('button', { name: /Sell today/ }).click();
  await expect(market.getByRole('note', { name: /Maize \(dry grain\) nutrition/ })).toBeVisible();
  await market.getByRole('button', { name: 'On', exact: true }).click();
  await expect.poll(async () => (await state(page)).produce.auto).toBe(false);
  // the sales: the restaurant's meals are there
  await market.getByRole('button', { name: 'Sales', exact: true }).click();
  await expect(market.getByRole('table', { name: /Meals sold/ })).toContainText('Githeri');
  // the greenhouse's seedlings carry their markers
  await page.evaluate(() => (window.location.hash = '#/greenhouse/bed-3'));
  await expect(page.getByRole('dialog', { name: 'Greenhouse' }).getByRole('note', { name: /Cucumbers nutrition/ })).toBeVisible();
  // the addresses /restaurant and /nutrition open them too
  await page.evaluate(() => (window.location.hash = '#/nutrition'));
  await expect(page).toHaveURL(/#\/market\/nutrition$/);
});
