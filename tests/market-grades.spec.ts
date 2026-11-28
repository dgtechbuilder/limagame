import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { MARKET, PRODUCE, START_STORE, atRisk, gradesOf, lotsOf, produceOf, qualityNight, stock } from '../src/produce/model';
import { GRADED, GRADE_FLOOR, QUALITY, STORAGE, START_Q, UNKNOWN_Q, gradeOf, lossOf, methodOf, nightsLeft } from '../src/produce/quality';
import { TERMS } from '../src/learn/glossary';
import { lifeOf, type LifeState } from '../src/livestock/model';
import { walletOf } from '../src/wallet/model';
import { storeCtx } from '../src/systems/track';

/* The daily produce market (Dean, 2026-11-28): the store split into food types, each sold by grade at its own price
   a kg; storage decides how fast each food and grade loses quality, so value drops night by night; a reminder each
   morning to sell before it drops; and ⓘ words on storage and grades. Played through the reducer, then the pages. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 100_000, ...patch });
const onDay = (d: number, life: Partial<LifeState> = {}, patch: Partial<GameState> = {}) => game({ life: { day: d, started: d >= 2 ? 2 : null, date: day, ...life }, ...patch });
const act = (s: GameState, ...as: Parameters<typeof reducer>[1][]) => as.reduce(reducer, s);
const ctx = { storehouse: false, coldRoom: false, owned: [] };

test('the store starts with five kinds of food, each split into three grades with their own price a kg', () => {
  const p = produceOf(undefined);
  expect(Object.keys(START_STORE).sort()).toEqual(['cucumber', 'drybeans', 'maize', 'spinach', 'sukuma', 'tomatoes']);
  for (const id of Object.keys(START_STORE) as (keyof typeof START_STORE)[]) {
    const g = gradesOf(p, id);
    expect(g[0] + g[1] + g[2]).toBeCloseTo(START_STORE[id]!, 5);
    expect(g.every(kg => kg > 0), id).toBe(true);
  }
  for (const id of GRADED) {
    const [a, b, c] = QUALITY[id]!.grades;
    // Grade 1 fetches more than Grade 2 (the stall's old price), Grade 3 less
    expect(a.price, id).toBeGreaterThan(b.price);
    expect(b.price, id).toBe(PRODUCE[id].price);
    expect(c.price, id).toBeLessThan(b.price);
    // every food's storage words are on an info card
    expect(TERMS[QUALITY[id]!.term], id).toBeTruthy();
  }
  for (const m of Object.values(STORAGE)) expect(TERMS[m.term], m.id).toBeTruthy();
  // a store from an old save, without grades, is fair average quality at the old price
  const old = produceOf({ store: { maize: 30 } });
  expect(lotsOf(old, 'maize')).toEqual([{ kg: 30, q: UNKNOWN_Q }]);
  expect(gradeOf(UNKNOWN_Q)).toBe(1);
});

test('storage decides how fast food drops a grade: leaves fastest, grain slowest, better storage slower', () => {
  // spinach on the floor loses Grade 1 in a night or two; maize in hermetic bags keeps it for weeks
  expect(nightsLeft('spinach', START_Q[0], 'floor')).toBeLessThanOrEqual(2);
  expect(nightsLeft('maize', START_Q[0], 'hermetic')).toBeGreaterThan(20);
  for (const id of GRADED) {
    const ways = Object.keys(QUALITY[id]!.decay) as (keyof typeof STORAGE)[];
    const worst = nightsLeft(id, START_Q[0], 'floor');
    for (const m of ways) expect(nightsLeft(id, START_Q[0], m), `${id} ${m}`).toBeGreaterThanOrEqual(worst);
  }
  // a damaged grade spoils faster than a good one loses its grade
  for (const id of GRADED) expect(lossOf(id, START_Q[2], 'floor'), id).toBeGreaterThan(lossOf(id, START_Q[0], 'floor'));
  // a night: quality drops, a grade can fall, and what falls below Grade 3 is spoiled and leaves the store
  let p = produceOf({ store: {}, lots: {} });
  p = stock(p, { spinach: 10 });
  let spoiled = 0;
  for (let n = 0; n < 6; n++) {
    const r = qualityNight(p, ctx);
    p = r.p;
    spoiled += r.spoiled.spinach ?? 0;
  }
  expect(spoiled).toBeGreaterThan(0);
  expect(p.store.spinach ?? 0).toBeCloseTo(10 - spoiled, 5);
  expect(p.totals.spoiled).toBeCloseTo(spoiled, 5);
  expect(lotsOf(p, 'spinach').every(l => l.q >= GRADE_FLOOR[2])).toBe(true);
  // with the cold room on, fresh food goes in it by itself
  expect(methodOf('tomatoes', undefined, { ...ctx, coldRoom: true })).toBe('cold');
  expect(methodOf('maize', undefined, ctx)).toBe('pallets');
});

test('sell grade by grade at each grade’s price; the day’s 25 kg still holds', () => {
  let s = onDay(5, {}, { produce: stock({ store: {}, lots: {} }, { maize: 100, tomatoes: 20 }) });
  const g0 = gradesOf(produceOf(s.produce), 'maize');
  const coins = s.coins;
  s = act(s, { type: 'produceSellGrades', picks: { maize: [10, 0, 5], tomatoes: [0, 5, 0] } });
  const p = produceOf(s.produce);
  expect(p.soldKg).toBe(20);
  expect(gradesOf(p, 'maize')).toEqual([g0[0] - 10, g0[1], g0[2] - 5]);
  const earned = 10 * QUALITY.maize!.grades[0].price + 5 * QUALITY.maize!.grades[2].price + 5 * QUALITY.tomatoes!.grades[1].price;
  expect(s.coins - coins).toBeCloseTo(earned, 5);
  expect(p.sales[0].grades).toEqual({ maize: [10, 0, 5], tomatoes: [0, 5, 0] });
  expect(walletOf(s.wallet).entries[0].kind).toBe('produce');
  // only 5 kg are left today
  s = act(s, { type: 'produceSellGrades', picks: { maize: [20, 0, 0] } });
  expect(produceOf(s.produce).soldKg).toBe(MARKET.dailyKg);
  s = act(s, { type: 'produceSellGrades', picks: { maize: [1, 0, 0] } });
  expect(s.toast?.text).toMatch(/come back tomorrow/);
});

test('storage is chosen per crop; hermetic bags and the charcoal cooler are bought once', () => {
  let s = onDay(5, {}, { coins: 1000, produce: stock({ store: {}, lots: {} }, { maize: 40, tomatoes: 20 }) });
  s = act(s, { type: 'storageSet', food: 'maize', method: 'hermetic' });
  expect(s.coins).toBe(1000 - STORAGE.hermetic.buy!);
  expect(produceOf(s.produce).storage?.maize).toBe('hermetic');
  // bought once: beans use the same bags for nothing more
  s = act({ ...s, produce: stock(s.produce, { drybeans: 10 }) }, { type: 'storageSet', food: 'drybeans', method: 'hermetic' });
  expect(s.coins).toBe(1000 - STORAGE.hermetic.buy!);
  // grain can't go in the cooler, and the cold room needs power
  const refused = act(s, { type: 'storageSet', food: 'maize', method: 'cooler' });
  expect(produceOf(refused.produce).storage?.maize).toBe('hermetic');
  const noPower = act(s, { type: 'storageSet', food: 'tomatoes', method: 'cold' });
  expect(noPower.toast?.text).toMatch(/cold room/i);
  // the storehouse's crates from the day it opens
  s = act(s, { type: 'storageSet', food: 'tomatoes', method: 'crates' });
  expect(methodOf('tomatoes', produceOf(s.produce).storage, storeCtx(s))).toBe('crates');
});

test('each morning the news says what drops a grade tonight, and the stall sells what is closest to dropping first', () => {
  day = '2026-11-15';
  let s = onDay(5, { date: '2026-11-14' }, { produce: { ...stock({ store: {}, lots: {} }, { spinach: 10, maize: 40 }), auto: false } });
  s = act(s, { type: 'toast', text: 'morning' });
  expect(atRisk(s.produce, storeCtx(s)).length).toBeGreaterThan(0);
  expect(lifeOf(s.life).day).toBe(6);
  // on the morning's news, or a message when the night's own news (a theft, a storm) took the morning
  const lines = s.success?.kind === 'morning' ? s.success.lines : [];
  const line = lines.find(l => l.title === 'Sell before prices drop');
  if (line) expect(line.go).toEqual({ kind: 'market', tab: 'sell' });
  expect(line?.text ?? s.toast?.text).toMatch(/spinach/);
  // a sale by the kg takes the lowest quality first (first expired, first out)
  const before = lotsOf(produceOf(s.produce), 'maize');
  s = act({ ...s, success: null }, { type: 'produceSell', items: { maize: before[before.length - 1].kg } });
  const after = lotsOf(produceOf(s.produce), 'maize');
  expect(after.length).toBe(before.length - 1);
  expect(after[0]).toEqual(before[0]);
  // the reminder can be turned on
  s = act(s, { type: 'produceRemind', on: true });
  expect(produceOf(s.produce).remind).toBe(true);
});

test('the stall by grade, the storehouse’s storage and their info cards, in the browser', async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({ view: 'world', coins: 50_000, life: { day: 5, date: null, started: 2 }, produce: { store: { maize: 40, drybeans: 16, spinach: 8, sukuma: 8, tomatoes: 12, cucumber: 8, sauce: 4 } } } as never),
  );
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => (window.location.hash = '#/market/sell'));
  const market = page.getByRole('dialog', { name: 'Market stall', exact: true });
  await expect(market).toBeVisible();
  const maize = market.getByRole('listitem', { name: 'Maize (dry grain)' });
  await expect(maize.getByRole('listitem', { name: 'Maize Grade 1' })).toBeVisible();
  await expect(maize.getByRole('listitem', { name: 'Maize Grade 3' })).toBeVisible();
  // Grade 2 of an old store is the old price
  await expect(maize.getByRole('listitem', { name: 'Maize Grade 2' })).toContainText('kg');
  await maize.getByRole('button', { name: '5 kg more Maize Grade 2' }).click();
  await maize.getByRole('button', { name: '5 kg more Maize Grade 2' }).click();
  await expect(maize.getByLabel('Maize Grade 2 to sell', { exact: true })).toHaveText('10 kg');
  await market.getByRole('button', { name: /^Sell 10 kg/ }).click();
  await expect.poll(async () => (await state(page)).produce.sales?.[0]?.grades?.maize).toEqual([0, 10, 0]);
  // an info word on the grades
  await market.getByRole('button', { name: 'What is Quality grades?' }).first().click();
  const card = page.getByRole('dialog', { name: /Quality grades: what it is/ });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Got it' }).click();
  // the storehouse: pick how a crop is stored
  await page.evaluate(() => (window.location.hash = '#/storehouse/store'));
  const sh = page.getByRole('dialog', { name: 'Storehouse', exact: true });
  await expect(sh).toBeVisible();
  const ways = sh.getByRole('group', { name: 'How Tomatoes is stored' });
  await expect(ways.getByRole('button', { name: /Store Tomatoes: Crates in the shade/ })).toHaveAttribute('aria-pressed', 'true');
  await ways.getByRole('button', { name: /Store Tomatoes: Charcoal cooler, buy/ }).click();
  await expect.poll(async () => (await state(page)).produce.storage?.tomatoes).toBe('cooler');
  await sh.getByRole('button', { name: 'What is Charcoal cooler?' }).first().click();
  await expect(page.getByRole('dialog', { name: /Charcoal cooler: what it is/ })).toBeVisible();
});
