import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { newTrial, COMMON_PLAN, plotsOf } from '../src/trials/model';
import { lifeOf, type LifeState } from '../src/livestock/model';
import { LIFE, shedOption } from '../src/livestock/config';
import { POWER, POWER_STEPS } from '../src/power/config';
import { powerOf, powerOn } from '../src/power/model';
import { hubOf, HUB } from '../src/tractor/hub';
import { MARKET, produceOf } from '../src/produce/model';
import { GREENHOUSE, ghCropOf, greenhouseOf } from '../src/greenhouse/model';
import { walletOf } from '../src/wallet/model';
import { tankOf } from '../src/water/model';
import { activeMeasures } from '../src/security/model';

/* The newer systems, played through the reducer: the wallet (every payment, climate payments with their credits),
   morning news that waits for an open page, the power system built over 7 days and run each day, the tractor
   screen's sections, the cow shed and the coop from day 1, the shed's options, the market stall's 25 kg a day, and
   the greenhouse and the storehouse where Farms 7 and 8 were. Then the pages in the browser. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 100_000, ...patch });
const onDay = (d: number, life: Partial<LifeState> = {}, patch: Partial<GameState> = {}) => game({ life: { day: d, started: d >= 2 ? 2 : null, date: day, ...life }, ...patch });
const act = (s: GameState, ...as: Parameters<typeof reducer>[1][]) => as.reduce(reducer, s);
const ALL_PARTS = Object.fromEntries(POWER_STEPS.filter(p => p.id !== 'switchOn').map(p => [p.id, { day: p.day, score: 1 }]));

test('the wallet keeps every payment in and out, and every climate payment with its credits', () => {
  day = '2026-11-15';
  let s = act(game({ coins: 1000 }), { type: 'climateTick' }, { type: 'buy', id: 'npk', price: 50, name: 'NPK' });
  let w = walletOf(s.wallet);
  if (s.coins < 1000) expect(w.entries[0]).toMatchObject({ amount: -50, balance: s.coins });
  // the day ends: the climate payment goes into the wallet with its own words and its credits
  day = '2026-11-16';
  s = act(s, { type: 'climateTick' });
  w = walletOf(s.wallet);
  const pay = w.entries.find(e => e.kind === 'climate')!;
  expect(pay).toBeTruthy();
  expect(pay.label).toMatch(/^Climate payment · /);
  expect(pay.credits).toBeGreaterThan(10);
  expect(pay.amount).toBeCloseTo(s.climate.pay.payments[0].coins, 6);
  // nothing paid twice: the sum of the wallet's entries is the change in money
  const sum = w.entries.reduce((n, e) => n + e.amount, 0);
  expect(s.coins - 1000).toBeCloseTo(sum, 6);
  expect(w.totals.climate?.in).toBeCloseTo(pay.amount, 6);
});

test('a morning’s news waits while a page is open, and shows once it closes', () => {
  day = '2026-11-15';
  let s = act(game(), { type: 'climateTick' }, { type: 'open', modal: { kind: 'climate', tab: 'land' } });
  day = '2026-11-16';
  s = act(s, { type: 'climateTick' });
  expect(s.success?.kind).toBe('day2');
  // switching section and closing keep it (it is shown on the farm)
  s = act(s, { type: 'open', modal: { kind: 'climate', tab: 'areas' } });
  expect(s.success?.kind).toBe('day2');
  s = act(s, { type: 'close' });
  expect(s.modal).toBeNull();
  expect(s.success?.kind).toBe('day2');
});

test('the power system goes in one part a day over 7 days, then runs every day for the farm', () => {
  let s = onDay(1, {}, { trial: newTrial(2, false, COMMON_PLAN) });
  // the inverter is for day 2
  s = act(s, { type: 'powerInstall', id: 'inverter', score: 1 });
  expect(s.toast?.text).toMatch(/day 2/);
  const coins = s.coins;
  s = act(s, { type: 'powerInstall', id: 'panels', score: 0.8 });
  expect(powerOf(s.power).parts.panels).toMatchObject({ day: 1, score: 0.8 });
  expect(s.coins).toBe(coins - POWER_STEPS[0].price);
  // the parts go in order
  s = act({ ...s, life: { ...lifeOf(s.life), day: 4 } }, { type: 'powerInstall', id: 'lights', score: 1 });
  expect(s.toast?.text).toMatch(/first$/i);
  s = act({ ...s, life: { ...lifeOf(s.life), day: 7 } }, ...(['inverter', 'battery', 'lights', 'generator', 'fuel'] as const).map(id => ({ type: 'powerInstall' as const, id, score: 1 })));
  expect(powerOf(s.power).fuel).toBe(POWER.firstFill);
  expect(powerOn(s)).toBe(false);
  s = act(s, { type: 'powerInstall', id: 'switchOn', score: 1, loads: ['pump', 'lights', 'cooler', 'house', 'workshop'] });
  expect(powerOn(s)).toBe(true);
  // the lights work as a security light
  expect(activeMeasures(s)).toContain('light');
  // a night passes: the system runs its day, pumps water and counts its clean power for the climate
  const tank = { ...tankOf(s.tank), level: 1000 };
  // (any action settles the nights that have passed)
  s = act({ ...s, tank, life: { ...lifeOf(s.life), date: '2026-11-14' } }, { type: 'toast', text: 'morning' });
  const p = powerOf(s.power);
  expect(p.history.length).toBeGreaterThan(0);
  expect(p.history[0].solar).toBeGreaterThan(5);
  expect(p.history[0].served).toBeGreaterThan(0.9);
  expect(p.totals.water).toBeGreaterThan(0);
  expect(s.climate.log.some(e => /^Power · farm day/.test(e.label))).toBe(true);
  // the milk cooler pays a premium on milk
  s = act(s, { type: 'animalCare', id: 'cowFeed' }, { type: 'animalCare', id: 'cowWater' });
  const before = s.coins;
  s = act(s, { type: 'animalCare', id: 'milk' });
  const w = walletOf(s.wallet);
  expect(w.entries[0].label).toMatch(/milk/i);
  expect(s.coins - before).toBeGreaterThan(0);
  expect(w.entries.find(e => e.kind === 'power')).toBeTruthy();
});

test('the tractor screen: training levels the driver, driving wears it, servicing and repairs bring it back', () => {
  let s = onDay(2);
  s = act(s, ...Array.from({ length: 2 }, () => ({ type: 'tractorHub' as const, section: 'train' as const, score: 1 })));
  expect(hubOf(s.hub).xp).toBe(60);
  expect(s.toast?.text).toMatch(/Driver level 1/);
  s = act(s, { type: 'tractorHub', section: 'learn', id: 'safety', score: 1 });
  expect(hubOf(s.hub).lessons).toContain('safety');
  // a worn tractor is repaired; a repair costs money
  s = { ...s, hub: { ...hubOf(s.hub), condition: 10, fuel: 5 } };
  const coins = s.coins;
  s = act(s, { type: 'tractorHub', section: 'repair', score: 1 });
  expect(hubOf(s.hub).condition).toBe(100);
  expect(s.coins).toBe(coins - HUB.repairCost);
  // refuel at the pump (no farm diesel tank yet)
  s = act(s, { type: 'tractorHub', section: 'refuel', score: 1 });
  expect(hubOf(s.hub).fuel).toBe(HUB.tankL);
});

test('the coop is upgraded from day 1 and the cow shed from day 3', () => {
  let s = onDay(1);
  s = act(s, { type: 'coopBuild', id: 'basic' });
  expect(lifeOf(s.life).coop).toBe('basic');
  s = act({ ...s, life: { ...lifeOf(s.life), day: 2 } }, { type: 'shedBuild', id: 'roofed' });
  expect(lifeOf(s.life).shed ?? null).toBeNull();
  expect(s.toast?.text).toMatch(new RegExp(`day ${LIFE.shedDay}`));
  s = act({ ...s, life: { ...lifeOf(s.life), day: 3 } }, { type: 'shedBuild', id: 'roofed' });
  expect(lifeOf(s.life).shed).toBe('roofed');
  const coins = s.coins;
  s = act(s, { type: 'shedBuild', id: 'zero' });
  expect(lifeOf(s.life).shed).toBe('zero');
  expect(s.coins).toBe(coins - (shedOption('zero')!.price - Math.round(shedOption('roofed')!.price * 0.6)));
});

test('at the shed: a seed chosen goes on every farm that can still take it, and is picked up', () => {
  let s = game({ trial: { ...newTrial(2, false, COMMON_PLAN), phase: 'plan' } });
  // saved seed is open on day 1 (drought-tolerant opens on day 2: src/unlock/model.ts)
  s = act(s, { type: 'shedChoose', kind: 'seed', id: 'saved' });
  expect(s.trial!.plans.every((_, i) => plotsOf(s.trial!, i)[0].seed === 'saved')).toBe(true);
  expect(s.field.carry).toBe('seeds');
  expect(s.prefs?.seed).toBe('saved');
});

test('the market stall sells 25 kg of the store a day; a harvest keeps some back for it', () => {
  let s = onDay(5, {}, { produce: { store: { maize: 100, tomatoes: 10 } } });
  const coins = s.coins;
  s = act(s, { type: 'produceSell', items: { maize: 20, tomatoes: 10 } });
  const p = produceOf(s.produce);
  expect(p.soldKg).toBe(MARKET.dailyKg);
  // 20 kg of maize, then the 5 kg of tomatoes the day's limit leaves
  expect(p.store.maize).toBe(80);
  expect(p.store.tomatoes).toBe(5);
  expect(s.coins).toBeGreaterThan(coins);
  expect(walletOf(s.wallet).entries[0].kind).toBe('produce');
  s = act(s, { type: 'produceSell', items: { maize: 5 } });
  expect(s.toast?.text).toMatch(/come back tomorrow/);
  // the next farm day sells again
  s = act({ ...s, life: { ...lifeOf(s.life), day: 6 } }, { type: 'produceSell', items: { maize: 5 } });
  expect(produceOf(s.produce).store.maize).toBe(75);
});

test('the greenhouse opens after day 3: plant a bed, water it, pick it into the storehouse', () => {
  let s = onDay(3);
  s = act(s, { type: 'ghPlant', bed: 0, crop: 'tomatoes', score: 1 });
  expect(greenhouseOf(s.greenhouse).beds[0].crop).toBeNull();
  s = act({ ...s, life: { ...lifeOf(s.life), day: GREENHOUSE.openDay } }, { type: 'ghPlant', bed: 0, crop: 'tomatoes', score: 1 });
  const b = greenhouseOf(s.greenhouse).beds[0];
  expect(b.crop).toBe('tomatoes');
  expect(b.ready).toBe(GREENHOUSE.openDay + ghCropOf('tomatoes').grow);
  s = act(s, { type: 'ghHarvest', bed: 0, score: 1 });
  expect(s.toast?.text).toMatch(/Not ready/);
  // ready: the pick goes into the store, and the vines fruit again
  s = act({ ...s, life: { ...lifeOf(s.life), day: b.ready } }, { type: 'ghWater', bed: 0 }, { type: 'ghHarvest', bed: 0, score: 1 });
  expect(produceOf(s.produce).store.tomatoes).toBeGreaterThan(30);
  expect(greenhouseOf(s.greenhouse).beds[0]).toMatchObject({ crop: 'tomatoes', harvests: 1, ready: b.ready + ghCropOf('tomatoes').regrow });
});

test('the new pages open by their addresses, and the TRACTOR button opens the tractor screen', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  for (const [hash, name] of [
    ['#/wallet/history', 'Wallet'],
    ['#/power/build', 'Power'],
    ['#/market', 'Market stall'],
    ['#/animals/cow-shed', 'Animals'],
    ['#/greenhouse/bed-1', 'Greenhouse'],
    ['#/storehouse/produce', 'Storehouse'],
    ['#/greenhouse', 'Greenhouse'],
  ] as const) {
    await page.evaluate(h => (window.location.hash = h), hash);
    await expect(page.getByRole('dialog', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('dialog', { name: 'Greenhouse' }).getByRole('button', { name: /Plant Tomatoes in greenhouse bed 1/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let i = 1; i <= 8; i++) await page.getByRole('button', { name: `Planting hole ${i}`, exact: true }).click();
  await page.getByRole('button', { name: 'Done planting' }).click();
  await expect.poll(async () => (await state(page)).greenhouse.beds[0].crop).toBe('tomatoes');
  // the tractor screen, and a safety check played through
  await page.evaluate(() => (window.location.hash = '#/farm'));
  await page.getByRole('button', { name: /Walk to the tractor|Drive the tractor/ }).click();
  const hub = page.getByRole('dialog', { name: 'Tractor' });
  await expect(hub).toBeVisible();
  await hub.getByRole('button', { name: 'Safety check' }).click();
  await hub.getByRole('button', { name: 'Start safety check' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const steps = ['Walk round: nobody near the tractor', 'Check the oil and the water', 'Check the tyres and the hitch pins', 'Sit down and put the belt on', 'Gear in neutral, PTO off', 'Start the engine'];
  for (const st of steps) await page.getByRole('button', { name: st, exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(async () => (await state(page)).hub?.done?.safety).toBe(1);
});
