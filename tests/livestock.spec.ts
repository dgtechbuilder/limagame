import { expect, test } from '@playwright/test';
import { boot, playTiming, state, type Win } from './helpers';
import { initialState, reducer, saleQuote, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { routeTo } from '../src/route';
import { COMMON_PLAN, harvestFarm, newTrial, type Trial } from '../src/trials/model';
import { tankOf } from '../src/water/model';
import { WATER } from '../src/water/config';
import { CARE, LIFE, coopOption, issueOf } from '../src/livestock/config';
import { animalNight, animalWater, careLeft, eggsToday, lifeOf, milkToday, type LifeState } from '../src/livestock/model';
import { MEASURES, STORE_THEFT, measureOf } from '../src/security/config';
import { cutFor, exposure, harvestLessTheft, securityOf, theftNight } from '../src/security/model';

/* The cows and the hens (src/livestock) and theft (src/security): care from day 2, the chicken coop, diseases by their
   signs, the water the animals use and waste, thefts at night and what stops them, played through the reducer, and
   the Animals and Security pages played in the browser. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 50_000, ...patch });
/** A game on day 2 or later: the animals are in the player's care. */
const inCare = (life: Partial<LifeState> = {}, patch: Partial<GameState> = {}): GameState => game({ life: { day: 2, started: 2, date: day, ...life }, ...patch });
const act = (s: GameState, a: Parameters<typeof reducer>[1]) => reducer(s, a);

test('the animals come into the player’s care on day 2, with the coop, and a dialog says so', () => {
  day = '2026-11-15';
  let s = act(game(), { type: 'climateTick' });
  expect(lifeOf(s.life).day).toBe(1);
  // before day 2: no care (the coop can be upgraded from day 1: see systems.spec.ts)
  expect(careLeft(s)).toHaveLength(0);
  s = act(s, { type: 'animalCare', id: 'cowFeed' });
  expect(s.toast?.text).toMatch(/from day 2/);
  // the night passes: day 2
  day = '2026-11-16';
  s = act(s, { type: 'climateTick' });
  expect(lifeOf(s.life).day).toBe(2);
  expect(s.success?.kind).toBe('day2');
  expect(careLeft(s).map(c => c.id)).toEqual(expect.arrayContaining(['cowFeed', 'cowWater', 'milk', 'henFeed', 'henWater', 'eggs']));
  // the coop can be built now
  const coins = s.coins;
  s = act(s, { type: 'coopBuild', id: 'basic' });
  expect(lifeOf(s.life).coop).toBe('basic');
  const basic = coopOption('basic')!.price;
  expect(s.coins).toBe(coins - basic);
  // the raised coop opens on day 3 (src/unlock/model.ts); the movable coop is open on day 2
  s = act(s, { type: 'coopBuild', id: 'secure' });
  expect(lifeOf(s.life).coop).toBe('basic');
  // an upgrade pays the difference and a little for the work
  s = act(s, { type: 'coopBuild', id: 'mobile' });
  expect(lifeOf(s.life).coop).toBe('mobile');
  expect(s.coins).toBe(coins - coopOption('mobile')!.price - 300);
  // shutting the coop is a job once it is built
  expect(careLeft(s).map(c => c.id)).toContain('closeCoop');
});

test('a day of care: feed and water first, then the milk and eggs pay; each job once a day', () => {
  let s = inCare();
  const unfed = milkToday(s);
  s = act(s, { type: 'animalCare', id: 'cowFeed' });
  expect(s.coins).toBe(50_000 - CARE.find(c => c.id === 'cowFeed')!.costEach! * 2);
  s = act(s, { type: 'animalCare', id: 'cowWater' });
  expect(milkToday(s)).toBeGreaterThan(unfed);
  const before = s.coins;
  const litres = milkToday(s);
  s = act(s, { type: 'animalCare', id: 'milk' });
  expect(s.coins).toBe(before + Math.round(litres * LIFE.milk.price));
  expect(lifeOf(s.life).today.milk).toBe(litres);
  // twice is refused
  const again = act(s, { type: 'animalCare', id: 'milk' });
  expect(again.coins).toBe(s.coins);
  expect(again.toast?.text).toMatch(/done today/);
  // the hens
  s = act(act(s, { type: 'animalCare', id: 'henFeed' }), { type: 'animalCare', id: 'henWater' });
  const eggs = eggsToday(s);
  s = act(s, { type: 'animalCare', id: 'eggs' });
  expect(lifeOf(s.life).today.eggs).toBe(eggs);
});

test('water: the trough needs water in the tank, and a leaking trough wastes it until fixed', () => {
  // a tank too low for the cows' trough
  let s = inCare({}, { tank: { ...tankOf(undefined), level: 40 } });
  s = act(s, { type: 'animalCare', id: 'cowWater' });
  expect(lifeOf(s.life).done.cowWater).toBeUndefined();
  expect(s.toast?.text).toMatch(/Buy water/);
  // a leak adds 300 L a day to what the animals use, and the night takes it from the tank
  const leaking = inCare({ issues: [{ id: 'leak', since: 2 }] }, { tank: { ...tankOf(undefined), level: 5000 } });
  expect(animalWater(leaking).extra).toBe(issueOf('leak').water);
  const night = animalNight(leaking, 'test');
  expect(tankOf(night.state.tank).level).toBe(5000 - issueOf('leak').water!);
  // the right fix stops it
  const fixed = act(leaking, { type: 'animalFix', issue: 'leak', fix: 'valve' });
  expect(lifeOf(fixed.life).issues).toHaveLength(0);
  expect(animalWater(fixed).extra).toBe(0);
});

test('diseases: a wrong fix costs and the problem stays; the right one clears it and pays points', () => {
  let s = inCare({ issues: [{ id: 'ecf', since: 2 }] });
  const wrong = issueOf('ecf').fixes.find(f => !f.right)!;
  s = act(s, { type: 'animalFix', issue: 'ecf', fix: wrong.id });
  expect(lifeOf(s.life).issues.map(i => i.id)).toEqual(['ecf']);
  expect(s.coins).toBe(50_000 - wrong.cost);
  expect(s.toast?.text).toMatch(/^Not that/);
  const right = issueOf('ecf').fixes.find(f => f.right)!;
  const points = s.points;
  s = act(s, { type: 'animalFix', issue: 'ecf', fix: right.id });
  expect(lifeOf(s.life).issues).toHaveLength(0);
  expect(s.points).toBe(points + 20);
  // left untreated, East Coast fever kills after three days
  const left = inCare({ day: 6, issues: [{ id: 'ecf', since: 2 }] });
  const night = animalNight(left, 'test');
  expect(tankOf(night.state.tank).herd.cows).toBe(1);
  expect(night.events.some(e => e.kind === 'death')).toBe(true);
});

test('missed care costs health at night; full care brings it back; prevention keeps a disease away', () => {
  const s = inCare();
  const missed = animalNight(s, 'a');
  const h0 = LIFE.health.start;
  expect(lifeOf(missed.state.life).health.cows).toBe(h0 - LIFE.health.missFeed - LIFE.health.missWater);
  let cared = s;
  for (const id of ['cowFeed', 'cowWater', 'milk', 'henFeed', 'henWater', 'eggs'] as const) cared = act(cared, { type: 'animalCare', id });
  expect(lifeOf(animalNight(cared, 'a').state.life).health.cows).toBe(Math.min(100, h0 + LIFE.health.recover));
  // the tick spray
  const sprayed = act(s, { type: 'animalPrevent', id: 'dip' });
  expect(lifeOf(sprayed.life).prevent.dip).toBe(2 + 7 - 1);
  expect(act(sprayed, { type: 'animalPrevent', id: 'dip' }).toast?.text).toMatch(/still covered/);
});

test('theft: protection cuts the chance (measures multiply), a shut coop keeps the hens, the watchman is paid each night', () => {
  // cuts multiply and never pass 95%
  expect(cutFor('cows', ['fence', 'tags'])).toBeCloseTo(1 - (1 - 0.4) * (1 - 0.45), 6);
  expect(cutFor('cows', MEASURES.map(m => m.id))).toBeLessThanOrEqual(0.95);
  const open = inCare({}, {});
  const hens0 = exposure(open, 0).find(x => x.target === 'hens')!;
  const shut = inCare({ coop: 'secure', done: { closeCoop: 2 } }, { security: { owned: ['dog', 'light'], hired: ['watchman'] } });
  const hens1 = exposure(shut, 0).find(x => x.target === 'hens')!;
  expect(hens1.chance).toBeLessThan(hens0.chance / 10);
  // the watchman's pay and the dog's food come off each night
  const r = theftNight(shut, 'n', 0, day);
  expect(r.paid).toBe(measureOf('watchman').nightly! + measureOf('dog').nightly!);
  expect(r.state.coins).toBe(shut.coins - r.paid);
  // no money: the watchman does not come
  const broke = theftNight({ ...shut, coins: 0 }, 'n', 0, day);
  expect(securityOf(broke.state.security).hired).not.toContain('watchman');
  // ripe maize is at risk from day 5 of a cycle only
  const t: Trial = { ...newTrial(2, false, COMMON_PLAN), phase: 'growing', clock: 'fast', planted: 0, day: 5 };
  const g = inCare({}, { trial: t });
  expect(exposure(g, 3).find(x => x.target === 'crops')!.at).toBeNull();
  expect(exposure(g, 5).find(x => x.target === 'crops')!.chance).toBeGreaterThan(0);
  expect(exposure(g, 7).find(x => x.target === 'crops')!.base).toBeGreaterThan(exposure(g, 5).find(x => x.target === 'crops')!.base);
});

test('theft happens: over many nights an unprotected farm loses hens, and a protected one far fewer', () => {
  let lostOpen = 0;
  let lostSafe = 0;
  for (let n = 0; n < 200; n++) {
    const a = theftNight(inCare({ day: 2 + n }, { tank: { ...tankOf(undefined), herd: { cows: 2, hens: 40 } } }), `x:${n}`, 0, day);
    lostOpen += 40 - tankOf(a.state.tank).herd.hens;
    const b = theftNight(inCare({ day: 2 + n, coop: 'secure', done: { closeCoop: 2 + n } }, { tank: { ...tankOf(undefined), herd: { cows: 2, hens: 40 } }, security: { owned: ['dog', 'fence', 'light', 'watch'] } }), `x:${n}`, 0, day);
    lostSafe += 40 - tankOf(b.state.tank).herd.hens;
  }
  expect(lostOpen).toBeGreaterThan(20);
  expect(lostSafe).toBeLessThan(lostOpen / 4);
});

test('theft across the game: the six farms’ harvest, the classic season’s store, cash and the shed', () => {
  // the share thieves cut from a farm comes off its bags and income at harvest
  const t: Trial = { ...newTrial(2, false, COMMON_PLAN), phase: 'growing', clock: 'fast', planted: 0, day: 7 };
  const results = t.plans.map((_, i) => harvestFarm(t, i));
  const less = harvestLessTheft(results, [0.1]);
  expect(less.results[0].income).toBe(results[0].income - Math.round(results[0].income * 0.1));
  expect(less.results[1].income).toBe(results[1].income);
  const robbed = act(inCare({}, { trial: t, security: { crops: { cycle: 2, share: [0.1] } } }), { type: 'trialHarvest' });
  const clean = act(inCare({}, { trial: t }), { type: 'trialHarvest' });
  expect(clean.coins - robbed.coins).toBe(less.value);
  expect(robbed.toast?.text).toMatch(/stolen from the field/);
  // the classic season: maize in home storage loses more to theft than in the co-op warehouse
  const stored = inCare({}, { stage: 6, harvested: { bags: 150, quality: 4 }, storage: 'home' });
  expect(saleQuote(stored, null).stolen).toBe(Math.round(150 * STORE_THEFT.home));
  expect(saleQuote({ ...stored, storage: 'coop' }, null).stolen).toBeLessThan(saleQuote(stored, null).stolen);
  expect(saleQuote({ ...stored, security: { owned: ['locks'] } }, null).stolen).toBeLessThan(saleQuote(stored, null).stolen);
  // money from a sale stays at home that night; mobile money keeps it safe
  const sold = act(inCare({}, { trial: t }), { type: 'trialHarvest' });
  expect(securityOf(sold.security).cash).toBeGreaterThan(0);
  expect(exposure(sold, 0).find(x => x.target === 'cash')!.chance).toBeGreaterThan(exposure({ ...sold, security: { ...securityOf(sold.security), owned: ['mpesa'] } }, 0).find(x => x.target === 'cash')!.chance * 5);
  // tools in the shed are at risk; padlocks cut it
  const tools = inCare({}, { inventory: ['hoe', 'spade'] });
  expect(exposure(tools, 0).find(x => x.target === 'tools')!.at).toMatch(/2 tools/);
  expect(cutFor('tools', ['locks'])).toBe(0.75);
});

test('the herd is bought and sold at a price; the night reports a theft in the morning', () => {
  let s = inCare();
  s = act(s, { type: 'herdBuy', group: 'cows', n: 1 });
  expect(tankOf(s.tank).herd.cows).toBe(3);
  expect(s.coins).toBe(50_000 - LIFE.price.cow);
  s = act(s, { type: 'herdBuy', group: 'cows', n: -1 });
  expect(s.coins).toBe(50_000 - LIFE.price.cow + Math.round(LIFE.price.cow * LIFE.price.sellShare));
  expect(act({ ...s, coins: 10 }, { type: 'herdBuy', group: 'cows', n: 1 }).toast?.text).toMatch(/costs/);
  expect(tankOf(s.tank).herd.cows).toBeLessThanOrEqual(WATER.herd.maxCows);
  // nights until a theft comes: the morning dialog lists it
  let g = inCare({ date: '2026-11-15' }, { tank: { ...tankOf(undefined), herd: { cows: 2, hens: 40 } } });
  let found = false;
  for (let n = 16; n < 60 && !found; n++) {
    day = `2026-11-${String(n % 30 || 30).padStart(2, '0')}`;
    if (n > 30) day = `2026-12-${String(n - 30).padStart(2, '0')}`;
    g = act({ ...g, success: null }, { type: 'climateTick' });
    found = g.success?.kind === 'night' && g.success.events.some(e => e.kind === 'theft' || e.kind === 'predator');
  }
  expect(found).toBe(true);
  expect(securityOf(g.security).reports.length).toBeGreaterThan(0);
  day = '2026-11-15';
});

test('addresses: the animals’ and security pages have their own', () => {
  const s = inCare();
  expect(routeTo(s, '#/animals/coop')).toEqual([{ type: 'open', modal: { kind: 'animals', tab: 'coop' } }]);
  expect(routeTo(s, '#/security/risks')).toEqual([{ type: 'open', modal: { kind: 'security', tab: 'risk' } }]);
  expect(routeTo(s, '#/security/nope')[0]).toMatchObject({ type: 'toast' });
});

test('in the game: ANIMALS opens the day’s jobs, a job is done, the coop is built; SECURITY hires a watchman', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', coins: 20000, life: { day: 2, started: 2, date: new Date().toISOString().slice(0, 10) } });
  });
  await page.getByRole('button', { name: /^Animals:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Animals' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/animals/today');
  await page.getByRole('button', { name: /^Feed the cows for/ }).click();
  await expect(page.getByLabel('Feed the cows: done today')).toBeVisible();
  // the coop
  await page.getByRole('button', { name: 'Coop', exact: true }).click();
  await page.getByRole('button', { name: /^Build the simple coop/ }).click();
  // built by hand: the hammer mini-game
  await playTiming(page, 'Finish the coop');
  await expect(page.locator('.lv-option.is-on')).toContainText('Simple coop');
  expect(lifeOf((await state(page)).life).coop).toBe('basic');
  // a problem by its signs, and the fix
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', coins: 20000, life: { day: 3, started: 2, date: new Date().toISOString().slice(0, 10), issues: [{ id: 'mastitis', since: 3 }] }, modal: { kind: 'animals', tab: 'health' } });
  });
  await expect(page.locator('.lv-signs')).toContainText('udder');
  await page.getByRole('button', { name: /tube of mastitis medicine/ }).click();
  await expect(page.locator('.lv-issue')).toHaveCount(0);
  // security: hire the watchman
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Security:/ }).click();
  await page.getByRole('button', { name: /^Hire a night watchman/ }).click();
  expect(securityOf((await state(page)).security).hired).toContain('watchman');
  await page.getByRole('button', { name: 'Risks tonight', exact: true }).click();
  await expect(page.locator('.lv-table')).toContainText('Cows');
});
