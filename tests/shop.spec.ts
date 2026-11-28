import { expect, test } from '@playwright/test';
import { boot, optIn, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { MARKET, PRODUCE, produceOf } from '../src/produce/model';
import { MENU, dishOf, lessonOf, needsOf, RESTAURANT, type Need } from '../src/produce/restaurant';
import { walletOf } from '../src/wallet/model';
import {
  SHOP,
  atCounter,
  canMake,
  cookFor,
  free,
  handOver,
  marketOrder,
  mealOrder,
  newShift,
  ordering,
  packItem,
  packScore,
  serveMeal,
  setBags,
  shiftOver,
  stationStatus,
  tick,
  type MarketOrder,
  type Shift,
} from '../src/shop/model';

/* The shop floor (src/shop): the market stall and the restaurant played. Customers walk in, queue and order from
   what the store holds; the farmer packs bags at the stall. At the restaurant they sit and order a dish or a kind of
   food; the farmer picks a dish off the menu that fits, it cooks, and the farmer serves it. Played through the rules, the reducer, then the browser. */

const day = '2026-11-21';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 1000, life: { day: 5, started: 2, date: day }, ...patch });
const act = (s: GameState, ...as: Parameters<typeof reducer>[1][]) => as.reduce(reducer, s);

/** A seeded random number, so the customers are the same every run. */
const seeded = (seed = 7) => {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
};

/** Time passes until a customer stands at the counter. */
function untilCounter(sh: Shift, produce: GameState['produce'], rng = seeded()) {
  for (let i = 0; i < 400 && !atCounter(sh); i++) tick(sh, 0.1, { produce, day: 5, rng });
  return atCounter(sh)!;
}

test('market orders come from the store: what it holds, the day’s kg left, and two bags keep fresh food apart', () => {
  const rng = seeded(3);
  for (let i = 0; i < 200; i++) {
    const o = marketOrder({ maize: 10, sukuma: 2, tomatoes: 1 }, 25, rng)!;
    const all: Record<string, number> = {};
    for (const b of o.bags) for (const [id, kg] of Object.entries(b)) all[id] = (all[id] ?? 0) + kg!;
    // never more than the store holds
    expect(all.sukuma ?? 0).toBeLessThanOrEqual(2);
    expect(all.tomatoes ?? 0).toBeLessThanOrEqual(1);
    expect(o.bags.length).toBeLessThanOrEqual(2);
    if (o.bags.length === 2 && all.maize && (all.sukuma || all.tomatoes)) {
      // the dry maize in one bag, the fresh food in the other
      const fresh = o.bags.find(b => !('maize' in b))!;
      expect(Object.keys(fresh).every(id => PRODUCE[id as keyof typeof PRODUCE].fresh)).toBe(true);
    }
  }
  // the day's 25 kg: an order fits what is left
  for (let i = 0; i < 50; i++) {
    const o = marketOrder({ maize: 50 }, 2, rng)!;
    expect(o.bags[0].maize).toBeLessThanOrEqual(2);
  }
  // nothing in the store, or the day sold out: no order
  expect(marketOrder({}, 25, rng)).toBeNull();
  expect(marketOrder({ maize: 10 }, 0, rng)).toBeNull();
  // a waiting customer's food is set aside: the next one cannot order it too
  const sh = newShift('market');
  sh.patrons.push({ ...untilCounter(newShift('market'), { store: { maize: 3 } }), order: { kind: 'market', bags: [{ maize: 3 }] } });
  expect(free(sh, { store: { maize: 3 } }, 5).store.maize).toBe(0);
});

test('packing: the right kg in the right bags is perfect; the wrong bags or kg cost the tip', () => {
  const order: MarketOrder = { kind: 'market', bags: [{ tomatoes: 2, sukuma: 1 }, { maize: 3 }] };
  expect(packScore(order, [{ tomatoes: 2, sukuma: 1 }, { maize: 3 }]).score).toBe(1);
  // the bags the other way round are just as good
  expect(packScore(order, [{ maize: 3 }, { tomatoes: 2, sukuma: 1 }]).score).toBe(1);
  // all in one bag: every kg right, but not the bags asked for
  const one = packScore(order, [{ tomatoes: 2, sukuma: 1, maize: 3 }]);
  expect(one.amounts).toBe(1);
  expect(one.bagsRight).toBe(false);
  expect(one.score).toBeLessThan(1);
  // a kg short
  expect(packScore(order, [{ tomatoes: 1, sukuma: 1 }, { maize: 3 }]).score).toBeLessThan(1);
});

test('at the stall: pack the order, hand it over, and the customer pays and tips; the store and the day’s kg go down', () => {
  const store = { maize: 30, drybeans: 10, sukuma: 8, tomatoes: 6 };
  let s = game({ produce: { store } });
  const sh = newShift('market');
  const c = untilCounter(sh, s.produce);
  expect(c.line).toMatch(/kg of/);
  const order = c.order as MarketOrder;
  // pack it, bag by bag, a kg at a time
  order.bags.forEach((b, i) => {
    if (i === 1) setBags(sh, 2);
    for (const [id, kg] of Object.entries(b) as [keyof typeof store, number][]) for (let k = 0; k < kg; k++) expect(packItem(sh, id, store)).toBe(true);
  });
  const r = handOver(sh, false)!;
  expect(r.mood).toBe('happy');
  expect(r.tip).toBeGreaterThan(0);
  expect(r.tip).toBeLessThanOrEqual(r.bill * SHOP.tip + 1e-9);
  expect(c.phase).toBe('leave');
  expect(c.carry).toBe(order.bags.length === 2 ? 'bags' : 'bag');
  // the game sells the food: coins for the bill and the tip, the store less what was packed
  const coins = s.coins;
  s = act(s, { type: 'shopSell', given: r.given, asked: r.asked, tip: r.tip, name: c.name });
  expect(s.coins).toBeCloseTo(coins + r.bill + r.tip, 5);
  const p = produceOf(s.produce);
  const kg = Object.values(r.asked).reduce((n, v) => n + v!, 0);
  expect(p.soldKg).toBeCloseTo(kg, 5);
  for (const [id, n] of Object.entries(r.asked) as [keyof typeof store, number][]) expect(p.store[id]).toBeCloseTo(store[id] - n, 5);
  // it is in the wallet, by name
  expect(walletOf(s.wallet).entries[0].label).toContain(`${c.name}'s order`);
  // packed too much: the extra is given away, not paid for
  const s2 = act(game({ produce: { store } }), { type: 'shopSell', given: { maize: 3 }, asked: { maize: 2 }, tip: 0, name: 'Juma' });
  expect(s2.coins).toBeCloseTo(1000 + 2 * PRODUCE.maize.price, 5);
  expect(produceOf(s2.produce).store.maize).toBe(27);
});

test('a customer kept waiting walks out, and the queue moves up', () => {
  const produce = { store: { maize: 60, drybeans: 20 } };
  const sh = newShift('market');
  const rng = seeded(11);
  const c = untilCounter(sh, produce, rng);
  for (let t = 0; t < c.max + 1; t += 0.5) tick(sh, 0.5, { produce, day: 5, rng });
  expect(c.phase === 'leave' || c.phase === 'gone').toBe(true);
  expect(c.mood).toBe('upset');
  expect(sh.walked).toBe(1);
  // someone else came up to the counter
  const next = untilCounter(sh, produce, rng);
  expect(next.id).not.toBe(c.id);
});

test('the shop closes when the store has nothing left to sell, once everyone has gone', () => {
  const sh = newShift('market');
  const rng = seeded(5);
  for (let i = 0; i < 100; i++) tick(sh, 0.1, { produce: { store: {} }, day: 5, rng });
  expect(sh.patrons).toHaveLength(0);
  expect(sh.closing).toBe(true);
  expect(shiftOver(sh)).toBe(true);
  // the day's 25 kg sold: the same
  const sold = newShift('market');
  for (let i = 0; i < 100; i++) tick(sold, 0.1, { produce: { store: { maize: 50 }, day: 5, soldKg: MARKET.dailyKg }, day: 5, rng });
  expect(shiftOver(sold)).toBe(true);
});

test('meal orders are a dish off the menu the store can cook, or a kind of food one of them is', () => {
  const rng = seeded(9);
  const asked = { dish: 0, need: 0 };
  for (let i = 0; i < 200; i++) {
    // maize and beans make githeri only: energy-giving and body-building
    const o = mealOrder({ maize: 1, drybeans: 1, tomatoes: 1 }, 30, rng)!;
    if ('dish' in o.ask) {
      asked.dish++;
      expect(MENU).toContain(o.ask.dish);
      expect(canMake({ maize: 1, drybeans: 1, tomatoes: 1 })).toContain(o.ask.dish);
    } else {
      asked.need++;
      // a kind of food some dish the store can make is
      expect(canMake({ maize: 1, drybeans: 1, tomatoes: 1 }).some(d => needsOf(dishOf(d)).includes((o.ask as { need: Need }).need))).toBe(true);
    }
    expect(o.dish).toBeNull();
  }
  expect(asked.dish).toBeGreaterThan(50);
  expect(asked.need).toBeGreaterThan(50);
  expect(mealOrder({ maize: 1 }, 30, rng)).toBeNull();
  expect(mealOrder({ maize: 1, drybeans: 1, tomatoes: 1 }, 0, rng)).toBeNull();
});

test('the menu: five simple dishes from the farm’s crops, between them every kind of food', () => {
  expect(MENU).toHaveLength(5);
  for (const id of MENU) expect(Object.keys(dishOf(id).plate).length).toBeLessThanOrEqual(3);
  expect(needsOf(dishOf('githeri'))).toEqual(['energy', 'body']);
  expect(needsOf(dishOf('ugali-sukuma'))).toEqual(['energy', 'protect']);
  expect(needsOf(dishOf('bean-stew'))).toEqual(['body', 'protect']);
  expect(needsOf(dishOf('kachumbari'))).toEqual(['protect']);
  expect(lessonOf(dishOf('githeri'))).toBe('Githeri = maize (energy) + dry beans (body-building) + tomatoes (protective)');
});

/** Time passes until a restaurant customer has walked in, sat down and ordered. */
function untilSeated(sh: Shift, produce: GameState['produce'], rng = seeded()) {
  for (let i = 0; i < 400 && !ordering(sh).length; i++) tick(sh, 0.1, { produce, day: 5, rng });
  return ordering(sh)[0];
}

test('in the restaurant: a customer sits and orders, the farmer cooks a dish that fits, and serves it', () => {
  const store = { maize: 1, drybeans: 1, tomatoes: 1, sukuma: 1 };
  let s = game({ produce: { store } });
  const sh = newShift('restaurant');
  const rng = seeded(2);
  const c = untilSeated(sh, s.produce, rng);
  if (c.order.kind !== 'restaurant') throw new Error('a meal order');
  // they walked straight to a table: no queue at a counter
  expect(c.seat).toBe(0);
  expect(atCounter(sh)).toBeNull();
  c.order.ask = { need: 'body' };
  // githeri is body-building (beans): it cooks on the jiko by itself
  expect(cookFor(sh, c.id, 'githeri', s.produce, 5)).toBe(true);
  expect(c.phase).toBe('wait');
  expect(stationStatus(sh, 'pot').state).toBe('working');
  expect(serveMeal(sh, c.id)).toBeNull();
  for (let t = 0; t < 7.2; t += 0.1) tick(sh, 0.1, { produce: s.produce, day: 5, rng });
  expect(stationStatus(sh, 'pot').state).toBe('done');
  const r = serveMeal(sh, c.id)!;
  expect(r.fit).toBe(true);
  expect(r.mood).toBe('happy');
  expect(r.bill).toBe(dishOf('githeri').price);
  expect(r.tip).toBeGreaterThan(0);
  expect(r.lesson).toContain('dry beans (body-building)');
  // they eat at their table, then go
  expect(c.phase).toBe('eat');
  const coins = s.coins;
  const points = s.points;
  s = act(s, { type: 'shopMeal', dishes: r.dishes, discount: r.discount, tip: r.tip, name: c.name, ask: r.ask, fit: r.fit });
  expect(s.coins).toBeCloseTo(coins + r.bill + r.tip, 5);
  expect(s.points).toBeGreaterThan(points);
  const p = produceOf(s.produce);
  expect(p.meals[0]).toMatchObject({ dish: 'githeri', plates: 1 });
  expect(p.kitchen.plates).toBe(1);
  expect(p.store.maize).toBeCloseTo(0.9, 5);
  expect(walletOf(s.wallet).entries[0].label).toContain(`${c.name}'s meal`);
});

test('the wrong food: no tip for a dish of the wrong kind, half price for a dish they did not ask for', () => {
  const store = { maize: 5, drybeans: 5, tomatoes: 5, cucumber: 5 };
  const sh = newShift('restaurant');
  const rng = seeded(4);
  const c = untilSeated(sh, { store }, rng);
  if (c.order.kind !== 'restaurant') throw new Error('a meal order');
  c.patience = c.max = 999;
  // asked for energy, given a salad
  c.order.ask = { need: 'energy' };
  expect(cookFor(sh, c.id, 'kachumbari', { store }, 5)).toBe(true);
  for (let t = 0; t < 4; t += 0.5) tick(sh, 0.5, { produce: { store }, day: 5, rng });
  const r = serveMeal(sh, c.id)!;
  expect(r.fit).toBe(false);
  expect(r.mood).toBe('ok');
  expect(r.tip).toBe(0);
  expect(r.discount).toBe(0);
  expect(sh.flash?.text).toMatch(/^Energy-giving food/);
  // asked for githeri by name, given bean stew
  const d = untilSeated(sh, { store }, rng);
  if (d.order.kind !== 'restaurant') throw new Error('a meal order');
  d.order.ask = { dish: 'githeri' };
  d.patience = d.max = 999;
  expect(cookFor(sh, d.id, 'bean-stew', { store }, 5)).toBe(true);
  for (let t = 0; t < 7; t += 0.5) tick(sh, 0.5, { produce: { store }, day: 5, rng });
  const r2 = serveMeal(sh, d.id)!;
  expect(r2.mood).toBe('upset');
  expect(r2.discount).toBe(dishOf('bean-stew').price / 2);
  const s = act(game({ produce: { store } }), { type: 'shopMeal', dishes: r2.dishes, discount: r2.discount, tip: r2.tip, name: d.name });
  expect(s.coins).toBeCloseTo(1000 + dishOf('bean-stew').price / 2, 5);
  // the store must have the food: no strawberries, no strawberry cup
  const e = untilSeated(sh, { store }, rng);
  expect(cookFor(sh, e.id, 'strawberry-cup', { store }, 5)).toBe(false);
  expect(produceOf(s.produce).kitchen.plates).toBeLessThanOrEqual(RESTAURANT.dailyPlates);
});

test('Open the market on the farm opens the shop floor: a customer walks in, the bags are packed and paid for', async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({ view: 'world', coins: 1000, life: { day: 5, date: null, started: 2 }, produce: { store: { maize: 40, drybeans: 12, sukuma: 10, tomatoes: 6 } } } as never),
  );
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  await page.evaluate(() => {
    const at = (window as unknown as Win).__lima.places.market;
    (window as unknown as Win).__limaWorld!.walkTo(at.x, at.z);
  });
  await expect(page.locator('.hud-place .is-enter')).toContainText('Open the market', { timeout: 60_000 });
  await optIn(page);
  const shop = page.getByRole('dialog', { name: 'Market stall: serving customers' });
  await expect(shop).toBeVisible();
  await expect(page).toHaveURL(/#\/serve\/market$/);
  // a mini card for every food in the store
  await expect(shop.getByRole('button', { name: /^Pack 1 kg / })).toHaveCount(4);
  await shop.getByRole('button', { name: 'Open the shop' }).click();
  // the first customer reaches the counter and orders
  const ticket = shop.getByLabel(/'s order$/);
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  const order = await page.evaluate(() => {
    const sh = (window as unknown as { __limaShop: { shift: Shift } }).__limaShop.shift;
    const c = sh.patrons.find(x => x.phase === 'order' && x.slot === 0)!;
    // all the time in the world (a slow test machine)
    c.patience = c.max = 999;
    return (c.order as MarketOrder).bags;
  });
  const names: Record<string, string> = { maize: 'Maize', drybeans: 'Dry beans', sukuma: 'Sukuma wiki', tomatoes: 'Tomatoes' };
  for (let i = 0; i < order.length; i++) {
    if (i === 1) await shop.getByRole('button', { name: '+ A second bag' }).click();
    for (const [id, kg] of Object.entries(order[i])) for (let k = 0; k < kg!; k++) await shop.getByRole('button', { name: `Pack 1 kg ${names[id]}` }).click();
  }
  const coins = (await state(page)).coins;
  await shop.getByRole('button', { name: 'Hand over the bags' }).click();
  await expect.poll(async () => (await state(page)).coins).toBeGreaterThan(coins);
  const sold = (await state(page)).produce.sales[0];
  expect(sold.kg).toBe(order.reduce((n, b) => n + Object.values(b).reduce((m, v) => m + v!, 0), 0));
  await expect(shop.getByLabel('Served 1')).toBeVisible();
  // the stall's book: the market page
  await shop.getByRole('button', { name: 'Stall book' }).click();
  await expect(page.getByRole('dialog', { name: 'Market stall', exact: true })).toBeVisible();
});

test('the restaurant’s shop floor: a customer sits and orders, a dish off the menu cooks, and is served', async ({ page }) => {
  await boot(page);
  // githeri is the only dish the store can make
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({ view: 'world', coins: 1000, life: { day: 5, date: null, started: 2 }, produce: { store: { maize: 2, drybeans: 1, tomatoes: 1 } }, modal: { kind: 'serve', shop: 'restaurant' } } as never),
  );
  const shop = page.getByRole('dialog', { name: 'Restaurant: serving customers' });
  await expect(shop).toBeVisible();
  await expect(page).toHaveURL(/#\/serve\/restaurant$/);
  // the menu: five dishes, only githeri cookable, each marked with the kinds of food it is
  await expect(shop.getByRole('button', { name: /^Cook / })).toHaveCount(5);
  await expect(shop.getByRole('button', { name: /^Cook Githeri/ })).toContainText('Body-building');
  await expect(shop.getByRole('button', { name: /^Cook Kachumbari/ })).toBeDisabled();
  await shop.getByRole('button', { name: 'Open the shop' }).click();
  const ticket = shop.getByLabel(/'s order$/);
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => (window as unknown as { __limaShop: { shift: Shift } }).__limaShop.shift.patrons.forEach(c => (c.patience = c.max = 999)));
  await shop.getByRole('button', { name: /^Cook Githeri for / }).click();
  await expect(shop.getByLabel(/^Jiko and sufuria: Githeri/)).toBeVisible();
  const coins = (await state(page)).coins;
  await shop.getByRole('button', { name: /^Serve / }).click({ timeout: 30_000 });
  await expect.poll(async () => (await state(page)).coins).toBeGreaterThan(coins);
  await expect(shop.getByRole('status').filter({ hasText: 'Githeri = maize (energy)' })).toBeVisible();
  await expect(shop.getByLabel('Served 1')).toBeVisible();
});

test('the restaurant on the farm: a glass-roofed hall bottom left, its customers coming and going, and its door opens the game', async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({ view: 'world', coins: 1000, life: { day: 5, date: null, started: 2 }, produce: { store: { maize: 2, drybeans: 1, tomatoes: 1 } } } as never),
  );
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  // bottom left of the farm: left of the yard, toward the camera
  const at = await page.evaluate(() => (window as unknown as Win).__lima.places.restaurant);
  expect(at.x).toBeLessThan(-10);
  expect(at.z).toBeGreaterThan(10);
  // customers are at the tables already
  const phases = () => page.evaluate(() => (window as unknown as { __limaWorld: { diners: () => string[] } }).__limaWorld.diners());
  expect(await phases()).toEqual(expect.arrayContaining(['eat', 'order']));
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  await page.evaluate(p => (window as unknown as Win).__limaWorld!.walkTo(p.x, p.z), at);
  await expect(page.locator('.hud-place .is-enter')).toContainText('Open the restaurant', { timeout: 60_000 });
  await optIn(page);
  await expect(page.getByRole('dialog', { name: 'Restaurant: serving customers' })).toBeVisible();
});
