import { expect, test } from '@playwright/test';
import { SELLING, initialState, qualityPrice, reducer, saleQuote, today, type GameState } from '../src/state';
import { STORAGE_OPTIONS } from '../src/data';
import { rewardFor } from '../src/tractor/sim';
import { TRACTOR_BONUS, TRACTOR_REWARD } from '../src/tractor/data';
import { treatLeft, treatCost } from '../src/world/field';
import { wakalaCase } from '../src/trials/samples';
import { COUNTY_DAY, DRIVER_WAGE, HUB_SHARE, PAYG, hireOutDay, newBiz } from '../src/business/model';

/* Where coins come from and where they go, without a browser: every earning is paid once, every cost is charged once
   and counted in the costs it belongs to. */

const selling = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  stage: SELLING,
  harvested: { bags: 100, quality: 5 },
  stepScores: { landprep: 1, planting: 1, fertilizer: 1, pesticides: 1, water: 1, harvest: 1 },
  ...patch,
});

test('the sale: storage is paid on every bag stored, the grade sets the price, the gate is used when it pays more', () => {
  const coop = STORAGE_OPTIONS.find(o => o.id === 'coop')!;
  const q = saleQuote(selling({ storage: 'coop' }), null);
  // storage is paid on all 100 bags put in store, not only the bags that came out
  expect(q.costs).toBe(100 * coop.costPerBag);
  expect(q.bagsSold).toBeLessThan(100);
  expect(q.revenue).toBe(Math.round(q.bagsSold * q.price - q.costs));

  // a lower grade fetches less a bag
  const low = saleQuote(selling({ harvested: { bags: 100, quality: 3 } }), null);
  const top = saleQuote(selling(), null);
  expect(low.price).toBeCloseTo(top.price * qualityPrice(3), 6);
  expect(low.revenue).toBeLessThan(top.revenue);

  // when the gate pays more than the market after transport and storage, the harvest sells at the gate
  const gate = saleQuote(selling({ prices: { farmgate: 30, market: 24, transport: 24, storage: 24 } }), null);
  expect(gate.at).toBe('gate');
  expect(gate.price).toBe(30);
  expect(saleQuote(selling(), null).at).toBe('market');
});

test('a shop item used in a farming step counts in the season’s costs', () => {
  let s: GameState = { ...initialState, coins: 1000, stage: 2 };
  s = reducer(s, { type: 'buy', id: 'nitrogen', price: 40, name: 'Nitrogen' });
  expect(s.coins).toBe(960);
  s = reducer(s, { type: 'task', step: 'fertilizer', id: 'f-nitrogen', price: 40, name: 'Nitrogen' });
  // no second charge, but the 40 coins it cost in the shop are this season's spending
  expect(s.coins).toBe(960);
  expect(s.inventory).not.toContain('nitrogen');
  expect(s.seasonSpend).toBe(40);
});

test('equipment is bought once; milk and eggs pay once a day', () => {
  let s: GameState = { ...initialState, coins: 1000 };
  s = reducer(s, { type: 'buy', id: 'hoe', price: 50, name: 'Hoe' });
  const again = reducer(s, { type: 'buy', id: 'hoe', price: 50, name: 'Hoe' });
  expect(again.coins).toBe(s.coins);
  expect(again.inventory.filter(i => i === 'hoe')).toHaveLength(1);
  // fertilizer and tanks can be bought again
  const two = reducer(reducer(s, { type: 'buy', id: 'tank-s', price: 250, name: 'Small' }), { type: 'buy', id: 'tank-s', price: 250, name: 'Small' });
  expect(two.inventory.filter(i => i === 'tank-s')).toHaveLength(2);

  const milk = reducer(s, { type: 'collect', id: 'milk', coins: 30, text: 'milk' });
  expect(milk.coins).toBe(s.coins + 30);
  expect(milk.collectedDay.milk).toBe(today());
  expect(reducer(milk, { type: 'collect', id: 'milk', coins: 30, text: 'milk' })).toBe(milk);
});

test('a tractor drive pays in full once; a retry pays only for beating the best', () => {
  expect(TRACTOR_REWARD.retryPays).toBe('improvement');
  const c = wakalaCase('tractor');
  const base: GameState = { ...initialState, trial: c.trial, coins: 1000, points: 0 };
  const first = reducer(base, { type: 'tractorDone', farm: 0, score: 80, stars: 2, Q: 0.8 });
  expect(first.coins).toBe(1000 + Math.round(TRACTOR_REWARD.coinsPerScore * 80));
  expect(first.points).toBe(2 * TRACTOR_REWARD.pointsPerStar + TRACTOR_BONUS.perDrive);
  // the same drive again pays nothing, whatever the screen claimed
  const same = reducer(first, { type: 'tractorDone', farm: 0, score: 80, stars: 2, Q: 0.8, coins: 999, points: 999 });
  expect(same.coins).toBe(first.coins);
  expect(same.points).toBe(first.points);
  // a better one pays the difference
  const better = reducer(same, { type: 'tractorDone', farm: 0, score: 90, stars: 3, Q: 0.9 });
  expect(better.coins).toBe(first.coins + Math.round(TRACTOR_REWARD.coinsPerScore * 10));
  expect(better.points).toBe(first.points + TRACTOR_REWARD.pointsPerStar);
  expect(rewardFor({ score: 70, stars: 2 }, { score: 90, stars: 3 }).coins).toBe(0);
});

test('a treatment that can’t be paid leaves its last work to do, and is paid once it is done', () => {
  const c = wakalaCase('spray');
  const pending = treatLeft(c.field, c.trial, 0, c.day)!;
  expect(pending).not.toBeNull();
  const cost = treatCost(pending.hazard);
  const poor: GameState = { ...initialState, trial: c.trial, field: c.field, coins: cost - 1 };
  const refused = reducer(poor, { type: 'fieldMark', farm: 0, job: pending.key, bits: pending.need });
  expect(refused.coins).toBe(cost - 1);
  expect(refused.toast?.text).toContain('You need');
  // the work is still there to finish
  expect(treatLeft(refused.field, refused.trial!, 0, c.day)).not.toBeNull();
  // with the coins, the same work treats the farm, and the cost goes on the farm's costs
  const paid = reducer({ ...refused, coins: cost + 10 }, { type: 'fieldMark', farm: 0, job: pending.key, bits: pending.need });
  expect(paid.coins).toBe(10);
  expect(paid.trial!.treatments[0]).toBe(c.trial.treatments[0] + cost);
});

test('a county day pays the hub its share of the hub tractor, and an owned tractor its PAYG instalment', () => {
  const b = { ...newBiz(), partners: ['kimani', 'county'] as const } as unknown as ReturnType<typeof newBiz>;
  const hub = hireOutDay(b, 0);
  expect(hub.result.hubFee).toBe(Math.round(COUNTY_DAY * HUB_SHARE));
  expect(hub.result.profit).toBe(COUNTY_DAY - DRIVER_WAGE - hub.result.hubFee);
  expect(hub.biz.cash).toBe(b.cash + hub.result.profit);

  const tier = PAYG.tiers[0];
  const owned = { ...b, owned: [{ hp: tier.hp as 45, price: tier.price, paid: 0, since: 1, warn: 0 }], tractor: tier.tractor };
  const mine = hireOutDay(owned, 0);
  expect(mine.result.hubFee).toBe(0);
  expect(mine.result.instalment).toBe(Math.round(COUNTY_DAY * PAYG.share));
  expect(mine.biz.owned[0].paid).toBe(mine.result.instalment);
  expect(mine.biz.cash).toBe(owned.cash + mine.result.profit - mine.result.instalment);
});
