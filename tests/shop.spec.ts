import { expect, test } from '@playwright/test';
import { boot, optIn, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { MARKET, PRODUCE, produceOf } from '../src/produce/model';
import { dishOf, RESTAURANT } from '../src/produce/restaurant';
import { walletOf } from '../src/wallet/model';
import {
  SHOP,
  atCounter,
  atStation,
  free,
  gather,
  handOver,
  marketOrder,
  mealOrder,
  newShift,
  packDish,
  packItem,
  packScore,
  serveMeal,
  setBags,
  shiftOver,
  startJob,
  stationStatus,
  takeOrder,
  tick,
  type MarketOrder,
  type Shift,
} from '../src/shop/model';

/* The shop floor (src/shop): the market stall and the restaurant played. Customers walk in, queue and order from
   what the store holds; the farmer packs bags at the stall, or takes the order, cooks it at the kitchen's stations,
   plates or boxes it and serves it at the restaurant. Played through the rules, the reducer, then the browser. */

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

test('meal orders are dishes the store can cook, to eat here or to take away', () => {
  const rng = seeded(9);
  for (let i = 0; i < 100; i++) {
    const o = mealOrder({ maize: 1, drybeans: 1, tomatoes: 1, capsicum: 1 }, 30, rng)!;
    // only githeri, pepper stew and the stuffed capsicum need nothing else
    for (const d of o.dishes) expect(['githeri', 'pepper-stew', 'stuffed-capsicum']).toContain(d);
    expect(['here', 'away']).toContain(o.to);
  }
  expect(mealOrder({ maize: 1 }, 30, rng)).toBeNull();
  expect(mealOrder({ maize: 1, drybeans: 1, tomatoes: 1, capsicum: 1 }, 0, rng)).toBeNull();
});

test('in the kitchen: take the order, gather the food, chop, cook (not too long), plate or box it, and serve', () => {
  // githeri only: maize, beans, tomatoes, capsicum
  const store = { maize: 1, drybeans: 1, tomatoes: 1, capsicum: 0.05 };
  let s = game({ produce: { store } });
  const sh = newShift('restaurant');
  const rng = seeded(2);
  const c = untilCounter(sh, s.produce, rng);
  if (c.order.kind !== 'restaurant') throw new Error('a meal order');
  c.order.dishes = ['githeri'];
  expect(takeOrder(sh)).toBe(c);
  expect(c.phase).toBe('wait');
  expect(c.seat).toBe(0);
  const job = sh.jobs[0];
  expect(startJob(sh, job.id)).toBe(true);
  // the wrong food, then the right ones
  expect(gather(sh, 'sukuma')).toBe('wrong');
  for (const f of ['maize', 'drybeans', 'tomatoes'] as const) expect(gather(sh, f)).toBe('ok');
  expect(gather(sh, 'capsicum')).toBe('done');
  // the pot first? no: githeri is chopped first
  expect(atStation(sh, 'pot')).toBe('wrong');
  expect(atStation(sh, 'board')).toBe('placed');
  expect(atStation(sh, 'board')).toBe('chop');
  expect(atStation(sh, 'board')).toBe('chopped');
  expect(sh.hands).toBe(job.id);
  // on the jiko: not ready at first, ready after its time
  expect(atStation(sh, 'pot')).toBe('placed');
  expect(atStation(sh, 'pot')).toBe('notyet');
  for (let t = 0; t < 8.2; t += 0.1) tick(sh, 0.1, { produce: s.produce, day: 5, rng });
  expect(stationStatus(sh, 'pot').state).toBe('done');
  expect(atStation(sh, 'pot')).toBe('taken');
  expect(job.quality).toBe(1);
  // packed as they asked, it waits on the pass; served, they pay and tip
  expect(packDish(sh, c.order.to === 'here' ? 'plate' : 'box')).toBe(true);
  const r = serveMeal(sh, c.id)!;
  expect(r.mood).toBe('happy');
  expect(r.bill).toBe(dishOf('githeri').price);
  expect(r.tip).toBeGreaterThan(0);
  expect(c.phase).toBe('pickup');
  const coins = s.coins;
  const points = s.points;
  s = act(s, { type: 'shopMeal', dishes: r.dishes, discount: r.discount, tip: r.tip, name: c.name });
  expect(s.coins).toBeCloseTo(coins + r.bill + r.tip, 5);
  expect(s.points).toBeGreaterThan(points);
  const p = produceOf(s.produce);
  expect(p.meals[0]).toMatchObject({ dish: 'githeri', plates: 1 });
  expect(p.kitchen.plates).toBe(1);
  expect(p.store.maize).toBeCloseTo(0.9, 5);
  expect(walletOf(s.wallet).entries[0].label).toContain(`${c.name}'s meal`);
});

test('burnt food and the wrong pack: no tip, and a burnt dish is half price', () => {
  const store = { flour: 1 };
  const sh = newShift('restaurant');
  const rng = seeded(4);
  const c = untilCounter(sh, { store }, rng);
  if (c.order.kind !== 'restaurant') throw new Error('a meal order');
  c.order.dishes = ['maize-bread'];
  c.order.to = 'here';
  takeOrder(sh);
  c.patience = c.max = 999;
  startJob(sh, sh.jobs[0].id);
  expect(gather(sh, 'flour')).toBe('done');
  // straight into the oven, and left far too long
  expect(atStation(sh, 'oven')).toBe('placed');
  for (let t = 0; t < 9 * SHOP.burnAt + 1; t += 0.5) tick(sh, 0.5, { produce: { store }, day: 5, rng });
  expect(stationStatus(sh, 'oven').state).toBe('burnt');
  expect(atStation(sh, 'oven')).toBe('taken');
  // boxed, though they eat here
  expect(packDish(sh, 'box')).toBe(true);
  const r = serveMeal(sh, c.id)!;
  expect(r.mood).toBe('upset');
  expect(r.tip).toBe(0);
  expect(r.discount).toBe(dishOf('maize-bread').price / 2);
  expect(r.said).toMatch(/burnt/i);
  // the game takes the half off
  const s = act(game({ produce: { store } }), { type: 'shopMeal', dishes: r.dishes, discount: r.discount, tip: r.tip, name: c.name });
  expect(s.coins).toBeCloseTo(1000 + dishOf('maize-bread').price / 2, 5);
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

test('the restaurant’s shop floor: take an order and cook it at the stations', async ({ page }) => {
  await boot(page);
  // githeri is the only dish the store can make
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({ view: 'world', coins: 1000, life: { day: 5, date: null, started: 2 }, produce: { store: { maize: 2, drybeans: 1, tomatoes: 1, capsicum: 0.05 } }, modal: { kind: 'serve', shop: 'restaurant' } } as never),
  );
  const shop = page.getByRole('dialog', { name: 'Restaurant: serving customers' });
  await expect(shop).toBeVisible();
  await expect(page).toHaveURL(/#\/serve\/restaurant$/);
  await shop.getByRole('button', { name: 'Open the shop' }).click();
  const take = shop.getByRole('button', { name: /^Take .*'s order$/ });
  await expect(take).toBeVisible({ timeout: 30_000 });
  await take.click();
  await page.evaluate(() => (window as unknown as { __limaShop: { shift: Shift } }).__limaShop.shift.patrons.forEach(c => (c.patience = c.max = 999)));
  await shop.getByRole('button', { name: /^Start Githeri/ }).first().click();
  for (const f of ['Maize', 'Dry beans', 'Tomatoes', 'Capsicum']) await shop.getByRole('button', { name: `Take ${f} from the store` }).click();
  await expect(shop.getByRole('button', { name: 'Chopping board' })).toHaveClass(/is-want/);
  for (let i = 0; i < 3; i++) await shop.getByRole('button', { name: /^Chopping board/ }).click();
  await shop.getByRole('button', { name: /^Jiko and sufuria/ }).click();
  await expect(shop.getByRole('button', { name: /^Jiko and sufuria: Githeri, Boiling/ })).toBeVisible();
  await expect(shop.getByRole('button', { name: /^Jiko and sufuria: Githeri, Take it out/ })).toBeVisible({ timeout: 30_000 });
  await shop.getByRole('button', { name: /^Jiko and sufuria: Githeri, Take it out/ }).click();
  await expect(shop.getByRole('button', { name: 'Plate it (eat here)' })).toBeEnabled();
});
