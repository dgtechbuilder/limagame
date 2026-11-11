import { expect, test } from '@playwright/test';
import {
  ACRES_AN_HOUR,
  CLIENTS,
  DAY_HOURS,
  MIN_STOPS,
  PARTNER_CUT,
  YARD,
  bestRoute,
  effScore,
  farmsToday,
  hireOf,
  levelOf,
  mapFor,
  myFarms,
  newBiz,
  partOf,
  partnerBlock,
  planDay,
  requestsFor,
  routeKm,
  runDay,
  shopBlock,
  stopsNeeded,
  type Bookings,
  type ReqKey,
} from '../src/business/model';
import { initialState, reducer } from '../src/state';
import { boot, state, type Win } from './helpers';

/* The tractor business: book farms' jobs (at least three farms on the tractor), plan the route by tapping the farms in
   order, run the day, and get an efficiency score; partners and the fleet. The rules first, without a browser, then a
   day played through the screen. */

const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));

test('each day has its own village: farms placed afresh, and roads joining every farm to every other', () => {
  const m1 = mapFor(1);
  const m2 = mapFor(2);
  expect(mapFor(1)).toBe(m1); // the same map for the same day
  expect(m1.at.mutua).not.toEqual(m2.at.mutua);
  const places = [YARD, ...CLIENTS.map(c => c.id)];
  for (const day of [1, 2, 3, 17, 40]) {
    const m = mapFor(day);
    for (const a of places) for (const b of places) expect(Number.isFinite(m.km[a][b])).toBe(true);
    // the road between two places is never shorter than the straight line
    for (const a of places)
      for (const b of places) {
        const line = Math.hypot(m.at[a].x - m.at[b].x, m.at[a].y - m.at[b].y) * 0.025;
        expect(m.km[a][b]).toBeGreaterThanOrEqual(line - 1e-9);
      }
  }
});

test('the shortest route is no longer than any other order, and a round trip from the yard', () => {
  const m = mapFor(3);
  const stops = ['wanjiru', 'mutua', 'chebet', 'kiprop', 'njeri'];
  const best = routeKm(m, bestRoute(m, stops));
  for (const p of perms(stops)) expect(best).toBeLessThanOrEqual(routeKm(m, p) + 1e-9);
  expect(bestRoute(m, stops).sort()).toEqual([...stops].sort());
  // there and back is the same both ways
  expect(routeKm(m, ['otieno', 'kamau'])).toBeCloseTo(routeKm(m, ['kamau', 'otieno']), 9);
  expect(routeKm(m, [])).toBe(0);
});

/** A day's bookings: the tractor takes the quickest job it can do on its `n` quickest farms, a partner takes the rest. */
function bookDay(b: ReturnType<typeof newBiz>, n: number) {
  const req = requestsFor(b);
  const hours = (k: ReqKey) => partOf(k).part.acres / ACRES_AN_HOUR[partOf(k).part.tool];
  const farms = [...new Set(req.filter(k => b.tools.includes(partOf(k).part.tool)).map(k => k.split(':')[0]))];
  const quick = farms
    .map(f => req.filter(k => k.startsWith(`${f}:`) && b.tools.includes(partOf(k).part.tool)).sort((x, y) => hours(x) - hours(y))[0])
    .sort((x, y) => hours(x) - hours(y))
    .slice(0, n);
  const bookings: Bookings = {};
  for (const k of req) bookings[k] = quick.includes(k) ? 'me' : 'partner';
  return { req, bookings, farms: quick.map(k => k.split(':')[0]) };
}

test('a day: at least three farms, a route through all of them, the efficiency score, hire, diesel, driver', () => {
  const b = newBiz();
  const m = mapFor(b.day);
  const req = requestsFor(b);
  expect(req).toEqual(requestsFor(b)); // the same farms on a reload
  expect(new Set(req.map(k => k.split(':')[0])).size).toBe(farmsToday(b));
  expect(stopsNeeded(b, req)).toBe(MIN_STOPS);

  // two farms are not enough
  const two = bookDay(b, 2);
  expect(planDay(b, two.req, two.bookings, two.farms).problem).toContain(`at least ${MIN_STOPS} farms`);

  // three farms, booked but not yet on the route: the route comes next
  const { bookings, farms } = bookDay(b, 3);
  expect(myFarms(bookings).sort()).toEqual([...farms].sort());
  expect(planDay(b, req, bookings, []).problem).toContain('Plan your route');
  expect(planDay(b, req, bookings, farms.slice(0, 2)).problem).toContain('2 of 3');

  // every order: the efficiency score is the shortest km against the route's
  const best = bestRoute(m, farms);
  let worst = best;
  for (const p of perms(farms)) if (routeKm(m, p) > routeKm(m, worst)) worst = p;
  const top = planDay(b, req, bookings, best);
  expect(top.problem).toBeNull();
  expect(effScore(top.efficiency)).toBe(100);
  const low = planDay(b, req, bookings, worst);
  expect(low.problem).toBeNull();
  expect(low.efficiency).toBeCloseTo(routeKm(m, best) / routeKm(m, worst), 9);
  expect(low.diesel).toBeGreaterThanOrEqual(top.diesel);

  // the money
  const mine = req.filter(k => bookings[k] === 'me').map(partOf);
  expect(top.revenue).toBe(mine.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres), 0));
  expect(top.commission).toBe(req.filter(k => bookings[k] === 'partner').map(partOf).reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres * PARTNER_CUT), 0));
  expect(top.profit).toBe(top.revenue + top.commission - top.diesel - top.wage);
  expect(top.missed).toBe(0);
  const { biz, result } = runDay(b, top);
  expect(biz.day).toBe(2);
  expect(biz.cash).toBe(b.cash + top.profit);
  expect(biz.helped).toBe(top.farmers + top.partnerFarmers);
  expect(result.stars).toBe(3); // work, the most efficient route, no farmer waiting
  expect(result.route).toEqual(best);
  if (low.efficiency < 0.995) expect(runDay(b, low).result.stars).toBe(2);

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

test('every day can be played: the farms the tractor must visit always fit in a day', () => {
  let full = 0;
  for (let day = 1; day <= 60; day++) {
    const b = { ...newBiz(), day };
    const n = stopsNeeded(b, requestsFor(b));
    const { req, bookings, farms } = bookDay(b, n);
    // a day with no job for the tractor's implements: everything goes to the partner
    if (!n) expect(farms).toEqual([]);
    const plan = planDay(b, req, bookings, bestRoute(mapFor(day), farms));
    expect(plan.problem, `day ${day}`).toBeNull();
    expect(plan.workH + plan.bestKm / 20).toBeLessThanOrEqual(DAY_HOURS + 1e-9);
    if (n === MIN_STOPS) full++;
  }
  // with only a plough and a harrow, most days still ask for the full three farms (fewer when the jobs need tools the
  // business has not bought yet)
  expect(full).toBeGreaterThan(30);
});

test('levels, partners and the fleet open as the business grows', () => {
  const b = newBiz();
  expect(levelOf(0).level).toBe(1);
  expect(levelOf(8).level).toBe(2);
  expect(levelOf(80).level).toBe(5);
  expect(partnerBlock(b, 'kimani')).toBe('Signed');
  expect(partnerBlock(b, 'coop')).toBe('Opens at level 2');
  expect(shopBlock(b, 'ridger')).toBe('Needs KSh 250,000');
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
  expect(s3.toast?.text).toBe('Maize planter: needs KSh 350,000');
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

  // the map: roads between the farms, and no route line or distances while planning
  await expect(page.locator('.biz-map path[stroke="#e6cc9e"]').first()).toBeAttached();
  await expect(page.locator('.biz-map polyline')).toHaveCount(0);
  await expect(page.locator('.biz-side')).not.toContainText('km');

  // book farms' jobs for the tractor (or the partner when there's no implement) until three farms are on it
  const pins = page.locator('.biz-pin.is-on');
  let onTractor = 0;
  for (let i = 0; i < (await pins.count()) && onTractor < 3; i++) {
    await pins.nth(i).click();
    const parts = page.locator('.biz-part');
    let mine = false;
    for (let k = 0; k < (await parts.count()); k++) {
      const me = parts.nth(k).locator('.biz-seg button').first();
      if ((await me.isEnabled()) && !mine) {
        await me.click();
        mine = true;
      } else await parts.nth(k).getByRole('button', { name: /Partner/ }).click();
    }
    if (mine) onTractor++;
    if (onTractor < 3) await expect(page.locator('.biz-meter').first()).toContainText(`${onTractor} of 3 needed`);
  }
  await expect(page.locator('.biz-meter').first()).toContainText('3 of 3 needed');

  // the route: tap the farms in order; Start waits until every farm is on it
  await page.getByRole('button', { name: 'Next: plan the route', exact: true }).click();
  await expect(page.locator('.biz-route li.is-todo')).toHaveCount(3);
  const next = page.locator('.biz-pin.is-next');
  await next.first().click();
  await expect(page.locator('.biz-route li.is-todo')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo last stop', exact: true }).click();
  await expect(page.locator('.biz-route li.is-todo')).toHaveCount(3);
  while (await next.count()) await next.first().click();
  await expect(page.locator('.biz-route li:not(.is-yard):not(.is-todo)')).toHaveCount(3);
  await expect(page.locator('.biz-map polyline')).toHaveCount(0);

  await page.getByRole('button', { name: 'Start the day', exact: true }).click();
  await expect(page.locator('.biz-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.biz-result')).toContainText('Day 1 done');
  await expect(page.locator('.biz-eff')).toContainText('Efficiency score');
  await expect(page.locator('.biz-eff')).toContainText(/most efficient route/);
  await expect(page.locator('.biz-sheet')).toContainText('Profit');
  // the day is a whole flow: it ends with the fanfare
  expect(await page.evaluate(() => (window as unknown as Win).__lima.sfx().at(-1))).toBe('flow');
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
