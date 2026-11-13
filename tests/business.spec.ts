import { expect, test } from '@playwright/test';
import {
  ACRES_AN_HOUR,
  BASELINE,
  CLIENTS,
  CROPS,
  DAY_HOURS,
  FULFILLED_SHARE,
  HUB_SHARE,
  MIN_STOPS,
  PARTNER_CUT,
  PAYG,
  SER,
  TOOLS,
  YARD,
  acceptChance,
  activitiesDone,
  bestRoute,
  bizOf,
  contractDay,
  effScore,
  farmsToday,
  fulfilment,
  graduation,
  hireOf,
  inWindow,
  leaderboard,
  levelOf,
  mapFor,
  monthOf,
  myFarms,
  newBiz,
  offersFor,
  partOf,
  partnerBlock,
  planDay,
  requestsFor,
  routeKm,
  runDay,
  scanFarm,
  shopBlock,
  stopsNeeded,
  tractorOf,
  yearOf,
  type Bookings,
  type Crop,
  type ReqKey,
} from '../src/business/model';
import { BAGS, DRIVE_SECS, FIELD_W, HAUL_Y, newFieldDrive, newHaulDrive, stepField, stepHaul } from '../src/business/drive';
import { initialState, reducer } from '../src/state';
import { boot, state, type Win } from './helpers';

/* The tractor business, to Hello Tractor's brief: scout farms with Campbell, book farms' jobs (at least three farms on
   the tractor), plan the route by tapping the farms in order, drive the tractor at each stop, run the day, and get an
   efficiency score and the two numbers (SER and fulfilment); counted acres, PAYG graduation, the Marketplace; partners
   and the fleet. The rules first, without a browser, then a day played through the screen. */

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
  expect(top.hubFee).toBe(Math.round(top.revenue * HUB_SHARE)); // the hub's tractor, until the agent owns one
  expect(top.profit).toBe(top.revenue + top.commission - top.diesel - top.wage - top.hubFee);
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
  // with only a plough, a harrow and a trailer, a good third of the year's days still ask for the full three farms;
  // the rest want tools the business has not bought yet (planting, fertilizer and harvest follow Narok's calendar)
  expect(full).toBeGreaterThan(15);
  let allTools = 0;
  for (let day = 1; day <= 60; day++) {
    const b = { ...newBiz(), day, tools: Object.keys(TOOLS) as (keyof typeof TOOLS)[] };
    if (stopsNeeded(b, requestsFor(b)) === MIN_STOPS) allTools++;
  }
  expect(allTools).toBeGreaterThan(45);
});

test('Narok’s calendar: three days a month from February, and every job booked is in window for its crop', () => {
  expect(monthOf(1)).toBe(2);
  expect(monthOf(3)).toBe(2);
  expect(monthOf(4)).toBe(3);
  expect(monthOf(33)).toBe(12);
  expect(monthOf(36)).toBe(1);
  expect(yearOf(33)).toBe(1);
  expect(yearOf(34)).toBe(2);
  for (let day = 1; day <= 72; day++) {
    const b = { ...newBiz(), day };
    for (const k of requestsFor(b)) {
      const { crop, activity } = partOf(k);
      expect(inWindow(crop, activity, monthOf(day)), `${k} on day ${day}`).toBe(true);
    }
  }
  // every crop has every field activity somewhere in the year, and every month has field work for some crop
  for (const c of Object.keys(CROPS) as Crop[]) for (const a of ['landprep', 'planting', 'fertilizer', 'harvest'] as const) expect(CROPS[c].window[a].length).toBeGreaterThan(0);
  for (let m = 1; m <= 12; m++) expect((Object.keys(CROPS) as Crop[]).some(c => ['landprep', 'planting', 'fertilizer', 'harvest'].some(a => inWindow(c, a as 'landprep', m)))).toBe(true);
});

test('Campbell: a flag and an in-window recommendation; the territory, a demo plot and CX lift acceptance', () => {
  const b = newBiz();
  const req = requestsFor(b);
  const farms = [...new Set(req.map(k => k.split(':')[0]))];
  for (const f of farms) {
    const scan = scanFarm(b, f, req);
    if (scan.rec) {
      expect(inWindow(scan.crop, scan.rec.activity, monthOf(b.day))).toBe(true);
      expect(req).not.toContain(scan.rec.key);
    }
  }
  const inside = CLIENTS.find(c => c.inside)!;
  const outside = CLIENTS.find(c => !c.inside)!;
  const plain = acceptChance(b, inside, 'maize').chance;
  expect(plain).toBeCloseTo(0.7, 9);
  expect(acceptChance({ demos: ['maize'] }, inside, 'maize').chance).toBeCloseTo(0.95, 9);
  expect(acceptChance({ demos: ['maize'] }, outside, 'maize').chance).toBeCloseTo(0.25, 9);
  // through the reducer: the farmer's answer is the same every time, and a yes adds the job to today's list
  const s0 = { ...initialState, biz: { ...b, demos: ['maize', 'wheat', 'barley', 'beans', 'potatoes'] as Crop[] } };
  const f = farms.find(id => clientOfId(id).inside && scanFarm(s0.biz, id, req).rec)!;
  const s1 = reducer(s0, { type: 'bizAdvise', client: f });
  expect(f in s1.biz!.advised).toBe(true);
  if (s1.biz!.advised[f]) {
    expect(requestsFor(s1.biz!).length).toBe(req.length + 1);
    expect(requestsFor(s1.biz!)).toContain(scanFarm(s0.biz, f, req).rec!.key);
  } else expect(requestsFor(s1.biz!).length).toBe(req.length);
  expect(reducer(s1, { type: 'bizAdvise', client: f })).toBe(s1); // one recommendation a farm a day
});
const clientOfId = (id: string) => CLIENTS.find(c => c.id === id)!;

test('the two numbers: SER drops the sparsest stop; the drive decides what closed; counted acres multiply by activity', () => {
  const b = newBiz();
  const m = mapFor(b.day);
  const req = requestsFor(b);
  const { bookings, farms } = bookDay(b, 3);
  const best = bestRoute(m, farms);
  const plan = planDay(b, req, bookings, best);
  expect(plan.ser).toBeCloseTo(plan.acres / plan.km, 9);
  expect(plan.booked).toBe(req.length);
  expect(plan.fulfilled).toBe(req.length); // the partner took the rest
  // counted acres: every job today is the first activity on its part this year
  const all = req.map(partOf).reduce((n, x) => n + x.part.acres, 0);
  expect(plan.counted).toBeCloseTo(all, 9);
  // a poor drive at one farm leaves its job unfinished: not closed, no hire for the part not done
  const poor = planDay(b, req, bookings, best, { [farms[0]]: BASELINE * 0.5 });
  expect(poor.unfinished.map(k => k.split(':')[0])).toEqual([farms[0]]);
  expect(poor.fulfilled).toBe(plan.fulfilled - 1);
  expect(poor.revenue).toBeLessThan(plan.revenue);
  expect(poor.counted).toBeLessThan(plan.counted);
  // a clean drive closes it, with less diesel; the baseline is the planned job exactly
  const clean = planDay(b, req, bookings, best, { [farms[0]]: 1 });
  expect(clean.unfinished).toEqual([]);
  expect(clean.workDiesel).toBeLessThan(plan.workDiesel);
  expect(clean.cleanFarms).toBe(1);
  expect(planDay(b, req, bookings, best, { [farms[0]]: BASELINE }).profit).toBe(plan.profit);
  expect(FULFILLED_SHARE).toBeLessThan(1);
  // the same activity on the same part a second time this year counts nothing more
  const run1 = runDay(b, plan, activitiesDone(req, bookings, plan));
  expect(run1.biz.counted).toBeCloseTo(all, 9);
  expect(run1.biz.booked).toBe(req.length);
  expect(fulfilment(run1.biz)).toBe(1);
  const again = planDay({ ...run1.biz, day: b.day }, req, bookings, best);
  expect(again.counted).toBe(0);
  // SER below the floor: the stop that helps least is dropped as unserviceable, and counted acres are halved. The
  // sparsest three-farm day in the first month: the smallest job on each of three far-apart farms.
  let sparse: { day: number; bookings: Bookings; farms: string[]; ser: number } | null = null;
  for (let day = 1; day <= 60 && !sparse; day++) {
    const bd = { ...b, day };
    const rq = requestsFor(bd);
    const ids = [...new Set(rq.map(k => k.split(':')[0]))];
    // every pair and triple of today's farms (a day with fewer than three farms for the tractor's tools happens too)
    const combos: string[][] = [];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        combos.push([ids[i], ids[j]]);
        for (let k = j + 1; k < ids.length; k++) combos.push([ids[i], ids[j], ids[k]]);
      }
    for (const farms of combos) {
      const bk: Bookings = {};
      for (const f of farms) {
        const ks = rq.filter(k => k.startsWith(`${f}:`) && b.tools.includes(partOf(k).part.tool)).sort((p, q) => partOf(p).part.acres - partOf(q).part.acres);
        if (ks.length) bk[ks[0]] = 'me';
      }
      if (Object.keys(bk).length < farms.length) continue;
      const acres = Object.keys(bk).reduce((n, k) => n + partOf(k as ReqKey).part.acres, 0);
      const ser = acres / routeKm(mapFor(day), bestRoute(mapFor(day), farms));
      if (ser < SER.floor && (!sparse || ser < sparse.ser)) sparse = { day, bookings: bk, farms, ser };
    }
  }
  expect(sparse).not.toBeNull();
  const far = { ...b, day: sparse!.day };
  const p4 = planDay(far, requestsFor(far), sparse!.bookings, bestRoute(mapFor(far.day), sparse!.farms));
  expect(p4.dropped.length).toBeGreaterThan(0);
  // the rest clear the floor, or one lone stop is left (the tractor still goes to one farm)
  expect(p4.ser >= SER.floor || p4.stops.length === 1).toBe(true);
  expect(p4.stops.length).toBeLessThan(sparse!.farms.length);
  expect(p4.counted).toBeLessThan(Object.keys(sparse!.bookings).reduce((n, k) => n + partOf(k as ReqKey).part.acres, 0));
});

test('graduation into a PAYG tractor: counted acres and fulfilment, then capacity, instalments and repossession', () => {
  const b = newBiz();
  expect(graduation(b)!.due).toBe(false);
  expect(graduation(b)!.why).toContain('counted acres');
  const ready = { ...b, counted: 700, booked: 20, fulfilled: 17 };
  expect(graduation(ready)!.due).toBe(true);
  expect(graduation({ ...ready, fulfilled: 10 })!.why).toContain('fulfilment');
  const s1 = reducer({ ...initialState, biz: ready }, { type: 'bizGraduate' });
  const own = s1.biz!;
  expect(own.owned).toHaveLength(1);
  expect(own.owned[0].hp).toBe(45);
  expect(tractorOf(own).capacity).toBe(PAYG.tiers[0].capacity);
  expect(graduation(own)!.tier.hp).toBe(75);
  // a day: no hub share now, an instalment from the hire, and the capacity rule
  const req = requestsFor(own);
  const { bookings, farms } = bookDay(own, stopsNeeded(own, req));
  const plan = planDay(own, req, bookings, bestRoute(mapFor(own.day), farms));
  expect(plan.hubFee).toBe(0);
  expect(plan.instalment).toBe(Math.round(plan.revenue * PAYG.share));
  const big = CLIENTS.flatMap(c => c.parts.filter(p => own.tools.includes(p.prep)).map(p => `${c.id}:${p.id}` as ReqKey)).slice(0, 4);
  const over = planDay(own, big, Object.fromEntries(big.map(q => [q, 'me'])) as Bookings, big.map(k => k.split(':')[0]));
  expect(over.problem).toMatch(/hours|acres of field work/);
  const after = runDay(own, plan).biz;
  expect(after.owned[0].paid).toBe(plan.instalment);
  expect(after.cash).toBe(own.cash + plan.profit - plan.instalment);
  // idle days in a row: warnings, then the tractor is taken back
  let idle = { ...own, history: [] as typeof own.history };
  let taken = false;
  for (let i = 0; i < 12 && !taken; i++) {
    const r = runDay(idle, planDay(idle, requestsFor(idle), {}, []));
    idle = r.biz;
    taken = !!r.result.payg?.repossessed;
    if (!taken && i >= 2) expect(r.result.payg?.warn).toBeGreaterThan(0);
  }
  expect(taken).toBe(true);
  expect(idle.owned).toHaveLength(0);
  expect(idle.requalify).toBeGreaterThan(idle.day);
  expect(graduation({ ...idle, booked: 10, fulfilled: 10 })!.why).toContain('repossession');
  // the marketplace: only an owner sees offers, and a contract day keeps the tractor busy
  expect(offersFor(b)).toEqual([]);
  const offers = offersFor({ ...own, day: 7 });
  expect(offers.length).toBeGreaterThan(0);
  const c = contractDay({ ...own, day: 7 }, offers[0], requestsFor({ ...own, day: 7 }), {});
  expect(c.result.kind).toBe('contract');
  expect(c.result.acres).toBe(offers[0].acres);
  expect(c.biz.contracts).toContain(offers[0].id);
  // the leaderboard ranks the player among the other agents
  const board = leaderboard(own);
  expect(board.some(r => r.you)).toBe(true);
  expect(board.map(r => r.rate)).toEqual([...board.map(r => r.rate)].sort((p, q) => q - p));
  // an old save gains the new fields
  const old = bizOf({ day: 3, cash: 100, tools: ['plough', 'sprayer' as 'plough'] });
  expect(old.counted).toBe(0);
  expect(old.tools).toEqual(['plough', 'trailer']);
});

test('the ten-second drive: a tidy serpentine beats the hub driver, a lazy one does not; the haulage run loses a bag a pothole', () => {
  const tidy = newFieldDrive('test', 'plough', 'standard');
  const rows = Math.round(tidy.h / tidy.swath);
  // a serpentine down the rows, stepping round whatever is in the way
  const wps: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const y = tidy.swath / 2 + r * tidy.swath;
    const dir = r % 2 ? -1 : 1;
    const x0 = dir > 0 ? 14 : FIELD_W - 14;
    const x1 = dir > 0 ? FIELD_W - 14 : 14;
    wps.push([x0, y]);
    const inRow = tidy.obs.filter(o => Math.abs(o.y - y) < o.r + 16).sort((a, b) => (a.x - b.x) * dir);
    for (const o of inRow) {
      // step to whichever side has room, far enough out for the tractor's turning circle
      const up = o.y - (o.r + 30);
      const side = up >= 10 ? up : o.y + (o.r + 30);
      const gap = o.r + 52;
      wps.push([o.x - gap * dir, y], [o.x - gap * dir, side], [o.x + gap * dir, side], [o.x + gap * dir, y]);
    }
    wps.push([x1, y]);
  }
  for (let wi = 0; !tidy.done; ) {
    const t = wps[Math.min(wi, wps.length - 1)];
    if (Math.hypot(t[0] - tidy.x, t[1] - tidy.y) < 12) wi++;
    if (wi >= wps.length) break;
    stepField(tidy, 1 / 60, { target: t, hold: true, keys: {} });
  }
  if (!tidy.done) stepField(tidy, DRIVE_SECS, { target: null, hold: false, keys: {} });
  expect(tidy.hits).toBe(0);
  expect(tidy.done!.e).toBeGreaterThan(BASELINE);
  expect(tidy.done!.secs).toBeLessThanOrEqual(DRIVE_SECS);
  const lazy = newFieldDrive('test', 'plough', 'standard');
  while (!lazy.done) stepField(lazy, 1 / 60, { target: null, hold: false, keys: {} });
  expect(lazy.done!.e).toBe(0);
  expect(lazy.done!.reason).toBe('time');
  const idle = newHaulDrive('test', 'standard');
  while (!idle.done) stepHaul(idle, 1 / 60);
  expect(idle.done!.e).toBeLessThan(1);
  expect(idle.bags).toBe(BAGS - idle.hits);
  const dodge = newHaulDrive('test', 'standard');
  // a driver who leaves a lane when a hole is close enough ahead to be hit, for a free lane beside it
  while (!dodge.done) {
    const blocked = new Set(dodge.holes.filter(h => !h.hit && h.y < HAUL_Y + 16 && h.y > HAUL_Y - 100).map(h => h.lane));
    if (blocked.has(dodge.lane)) {
      const free = [dodge.lane - 1, dodge.lane + 1, 0, 1, 2].filter(l => l >= 0 && l < 3 && !blocked.has(l));
      if (free.length) dodge.lane = free[0];
    }
    stepHaul(dodge, 1 / 60);
  }
  // a driver who looks ahead keeps far more of the load than one who does not, and beats the hub driver
  expect(dodge.done!.e).toBeGreaterThan(idle.done!.e);
  expect(dodge.done!.e).toBeGreaterThanOrEqual(BASELINE);
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
  // a day hired out to the county: the fee, less the driver and the hub's share of its own tractor
  const s4 = reducer({ ...s2, biz: { ...s2.biz!, partners: [...s2.biz!.partners, 'county'] } }, { type: 'bizHireOut' });
  expect(s4.biz!.day).toBe(s2.biz!.day + 1);
  expect(s4.biz!.cash).toBe(s2.biz!.cash + 12000 - 1000 - 12000 * HUB_SHARE);
});

test('the tractor business screen: book farms, order the route, run the day', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic' }));
  // from the main menu
  await page.getByRole('button', { name: 'Main menu' }).first().click();
  await page.getByRole('button', { name: 'Tractor business', exact: true }).click();
  await expect(page.locator('.biz-map')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/tractor-business');
  // Sasha's welcome, once
  await page.getByRole('button', { name: "Let's go", exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to the Narok hub' })).toHaveCount(0);
  const before = await state(page);

  // the map: the territory, roads between the farms, and no route line or distances while planning
  await expect(page.locator('.biz-map .ht-territory')).toContainText('Narok hub territory');
  await expect(page.locator('.biz-map path[stroke="#e6cc9e"]').first()).toBeAttached();
  await expect(page.locator('.biz-map polyline')).toHaveCount(0);
  await expect(page.locator('.biz-side')).not.toContainText('km');

  // book farms' jobs for the tractor (or the partner when there's no implement) until three farms are on it
  const pins = page.locator('.biz-pin.is-on');
  let onTractor = 0;
  for (let i = 0; i < (await pins.count()) && onTractor < 3; i++) {
    await pins.nth(i).click();
    // Campbell's scan on the farm panel, and the advice delivered where there is some
    await expect(page.locator('.ht-campbell')).toContainText('Campbell');
    const deliver = page.locator('.ht-deliver');
    if (await deliver.count()) {
      await deliver.click();
      await expect(page.locator('.ht-answer')).toBeVisible();
    }
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
  // at each of the three stops the tractor can be driven for ten seconds; here the hub driver takes two and the
  // player drives one with the keyboard (the clock sped up), then the day's result
  const driver = page.getByRole('button', { name: 'Let the driver do it', exact: true });
  await expect(driver).toBeVisible({ timeout: 20_000 });
  await driver.click();
  await expect(page.locator('.drv')).toHaveCount(0);
  await expect(page.locator('.drv')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (window as unknown as Win).__lima.driveClock(4));
  await page.locator('.drv-canvas').focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(900);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('.drv-stat')).not.toHaveText(/^0%|^10 of 10/);
  await expect(page.locator('.drv')).toHaveCount(0, { timeout: 20_000 });
  await page.evaluate(() => (window as unknown as Win).__lima.driveClock(1));
  await expect(driver).toBeVisible({ timeout: 20_000 });
  await driver.click();
  await expect(page.locator('.biz-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.biz-result')).toContainText('Day 1 done');
  await expect(page.locator('.biz-eff')).toContainText('Efficiency score');
  await expect(page.locator('.biz-eff')).toContainText(/most efficient route/);
  await expect(page.locator('.biz-eff .ht-ser')).toContainText('SER');
  await expect(page.locator('.biz-sheet')).toContainText('Profit');
  await expect(page.locator('.biz-result')).toContainText(/Fulfilment today \d+ of \d+; \+\d+ counted acres/);
  // the day is a whole flow: it ends with the fanfare
  expect(await page.evaluate(() => (window as unknown as Win).__lima.sfx().at(-1))).toBe('flow');
  const after = await state(page);
  expect(after.biz.day).toBe(2);
  expect(after.biz.helped).toBeGreaterThan(0);
  expect(after.points).toBeGreaterThanOrEqual(before.points + after.biz.helped * 20);
  expect(after.biz.counted).toBeGreaterThan(0);
  expect(after.biz.booked).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(page.locator('.biz-counted')).toContainText(String(Math.floor(after.biz.counted)));

  // the hub: demo plots and the leaderboard; the calendar
  await page.getByRole('tab', { name: 'Hub' }).click();
  await page.getByRole('button', { name: 'Ask for a maize demo plot' }).click();
  await expect(page.getByRole('button', { name: 'Maize demo plot running' })).toBeVisible();
  await expect(page.locator('.ht-rank li.is-you')).toContainText('You');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await expect(page.locator('.ht-months thead th.is-now')).toHaveText('Feb');

  // partners and fleet
  await page.getByRole('tab', { name: 'Partners' }).click();
  await expect(page.locator('.biz-card', { hasText: 'Kimani Tractor Hire' })).toContainText('Signed');
  await expect(page.locator('.biz-card', { hasText: 'Narok Farmers' })).toContainText('Opens at level 2');
  await page.getByRole('tab', { name: 'Fleet' }).click();
  await expect(page.locator('.biz-card', { hasText: 'Hub tractor' })).toContainText('Disc plough');

  // the business is saved; Back returns to the farm
  await page.locator('.nav-btn[aria-label="Back"]').click();
  await expect.poll(async () => (await state(page)).bizOpen).toBe(false);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  expect((await state(page)).biz.day).toBe(2);
});
