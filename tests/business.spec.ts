import { expect, test } from '@playwright/test';
import {
  CLIENTS,
  DAY_HOURS,
  PARTNER_CUT,
  bestRoute,
  farmsToday,
  hireOf,
  levelOf,
  newBiz,
  partOf,
  partnerBlock,
  planDay,
  requestsFor,
  routeKm,
  runDay,
  shopBlock,
  type Bookings,
  type ReqKey,
} from '../src/business/model';
import { initialState, reducer } from '../src/state';
import { boot, state, type Win } from './helpers';

/* The tractor business: book farms' jobs, plan the route, run the day; partners and the fleet. The rules first, without
   a browser, then a day played through the screen. */

const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));

test('the shortest route is no longer than any other order, and a round trip from the yard', () => {
  const stops = ['wanjiru', 'mutua', 'chebet', 'kiprop', 'njeri'];
  const best = routeKm(bestRoute(stops));
  for (const p of perms(stops)) expect(best).toBeLessThanOrEqual(routeKm(p) + 1e-9);
  expect(bestRoute(stops).sort()).toEqual([...stops].sort());
  // there and back is the same both ways
  expect(routeKm(['otieno', 'kamau'])).toBeCloseTo(routeKm(['kamau', 'otieno']), 9);
  expect(routeKm([])).toBe(0);
});

test('a day: hire, diesel, driver, partner share, farmers helped; what stops a day', () => {
  const b = newBiz();
  const req = requestsFor(b);
  expect(req).toEqual(requestsFor(b)); // the same farms on a reload
  expect(new Set(req.map(k => k.split(':')[0])).size).toBe(farmsToday(b));
  // book every plough and harrow job for the tractor, the rest to the partner
  const bookings: Bookings = {};
  for (const k of req) bookings[k] = b.tools.includes(partOf(k).part.tool) ? 'me' : 'partner';
  const route = [...new Set(req.filter(k => bookings[k] === 'me').map(k => k.split(':')[0]))];
  const plan = planDay(b, req, bookings, route);
  const mine = req.filter(k => bookings[k] === 'me').map(partOf);
  expect(plan.revenue).toBe(mine.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres), 0));
  expect(plan.commission).toBe(req.filter(k => bookings[k] === 'partner').map(partOf).reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres * PARTNER_CUT), 0));
  expect(plan.profit).toBe(plan.revenue + plan.commission - plan.diesel - plan.wage);
  expect(plan.missed).toBe(0);
  expect(plan.efficiency).toBeLessThanOrEqual(1);
  if (plan.hours <= DAY_HOURS) {
    expect(plan.problem).toBeNull();
    const { biz, result } = runDay(b, plan);
    expect(biz.day).toBe(2);
    expect(biz.cash).toBe(b.cash + plan.profit);
    expect(biz.helped).toBe(plan.farmers + plan.partnerFarmers);
    expect(result.missed).toBe(0);
    expect(result.stars).toBeGreaterThanOrEqual(2);
  }
  // a job without its implement can't go on the player's tractor
  const ridge = CLIENTS.find(c => c.parts.some(p => p.tool === 'ridger'))!;
  const k = `${ridge.id}:${ridge.parts.find(p => p.tool === 'ridger')!.id}` as ReqKey;
  expect(planDay(b, [k], { [k]: 'me' }, [ridge.id]).problem).toContain('no ridger');
  expect(planDay(b, [k], { [k]: 'partner' }, []).problem).toBeNull();
  // too much for one day
  const big = CLIENTS.flatMap(c => c.parts.filter(p => b.tools.includes(p.tool)).map(p => `${c.id}:${p.id}` as ReqKey));
  const all = Object.fromEntries(big.map(q => [q, 'me'])) as Bookings;
  expect(planDay(b, big, all, CLIENTS.map(c => c.id)).problem).toContain('hours');
  // nothing booked
  expect(planDay(b, req, {}, []).problem).toContain('Book at least one job');
});

test('levels, partners and the fleet open as the business grows', () => {
  const b = newBiz();
  expect(levelOf(0).level).toBe(1);
  expect(levelOf(8).level).toBe(2);
  expect(levelOf(80).level).toBe(5);
  expect(partnerBlock(b, 'kimani')).toBe('Signed');
  expect(partnerBlock(b, 'coop')).toBe('Opens at level 2');
  expect(shopBlock(b, 'ridger')).toBe('Needs KSh 25,000');
  const grown = { ...b, helped: 8, cash: 50000 };
  expect(partnerBlock(grown, 'coop')).toBeNull();
  expect(farmsToday({ ...grown, partners: [...grown.partners, 'coop'] })).toBe(farmsToday(grown) + 2);
  // signing and buying through the game's reducer
  const s0 = { ...initialState, biz: grown };
  const s1 = reducer(s0, { type: 'bizPartner', id: 'coop' });
  expect(s1.biz!.partners).toContain('coop');
  expect(s1.biz!.cash).toBe(45000);
  const s2 = reducer(s1, { type: 'bizBuy', item: 'ridger' });
  expect(s2.biz!.tools).toContain('ridger');
  expect(s2.biz!.cash).toBe(20000);
  // not enough money: refused, with a message
  const s3 = reducer(s2, { type: 'bizBuy', item: 'planter' });
  expect(s3.biz!.tools).not.toContain('planter');
  expect(s3.toast?.text).toBe('Maize planter: needs KSh 35,000');
  // a day hired out to the county
  const s4 = reducer({ ...s2, biz: { ...s2.biz!, partners: [...s2.biz!.partners, 'county'] } }, { type: 'bizHireOut' });
  expect(s4.biz!.day).toBe(s2.biz!.day + 1);
  expect(s4.biz!.cash).toBe(s2.biz!.cash + 11000);
});

test('the tractor business screen: book farms, order the route, run the day', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic' }));
  // from the main menu
  await page.getByRole('button', { name: 'Main menu' }).first().click();
  await page.getByRole('button', { name: 'Tractor business', exact: true }).click();
  await expect(page.locator('.biz-map')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/tractor-business');
  const before = await state(page);

  // book two farms' jobs for the tractor (or the partner when there's no implement)
  const pins = page.locator('.biz-pin.is-on');
  for (let i = 0; i < 2; i++) {
    await pins.nth(i).click();
    const parts = page.locator('.biz-part');
    for (let k = 0; k < (await parts.count()); k++) {
      const mine = parts.nth(k).locator('.biz-seg button').first();
      if (await mine.isEnabled()) await mine.click();
      else await parts.nth(k).getByRole('button', { name: /Partner/ }).click();
    }
  }
  // the route: move the second stop first, and the efficiency meter follows
  const stops = page.locator('.biz-route li:not(.is-yard)');
  if ((await stops.count()) > 1) {
    const first = await stops.first().innerText();
    await stops.nth(1).getByRole('button').click();
    await expect(stops.nth(1)).toContainText(first.replace(/^\d+\s*/, '').trim());
  }
  await expect(page.locator('.biz-meter').nth(1)).toContainText('shortest');

  await page.getByRole('button', { name: 'Start the day', exact: true }).click();
  await expect(page.locator('.biz-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.biz-result')).toContainText('Day 1 done');
  await expect(page.locator('.biz-sheet')).toContainText('Profit');
  const after = await state(page);
  expect(after.biz.day).toBe(2);
  expect(after.biz.helped).toBeGreaterThan(0);
  expect(after.points).toBe(before.points + after.biz.helped * 20);
  await page.getByRole('button', { name: 'Next day', exact: true }).click();

  // partners and fleet
  await page.getByRole('tab', { name: 'Partners' }).click();
  await expect(page.locator('.biz-card', { hasText: 'Kimani Tractor Hire' })).toContainText('Signed');
  await expect(page.locator('.biz-card', { hasText: 'Lake Farmers' })).toContainText('Opens at level 2');
  await page.getByRole('tab', { name: 'Fleet' }).click();
  await expect(page.locator('.biz-card', { hasText: 'Standard tractor' })).toContainText('Disc plough');

  // the business is saved; Back returns to the farm
  await page.locator('.nav-btn[aria-label="Back"]').click();
  await expect.poll(async () => (await state(page)).bizOpen).toBe(false);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  expect((await state(page)).biz.day).toBe(2);
});
