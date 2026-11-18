import { expect, test } from '@playwright/test';
import { boot, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { newTrial, COMMON_PLAN, plotsOf } from '../src/trials/model';
import { lifeOf, type LifeState } from '../src/livestock/model';
import { COOPS, SHEDS } from '../src/livestock/config';
import { POWER_STEPS } from '../src/power/config';
import { forecastDay, powerOf } from '../src/power/model';
import { FERTS, SEEDS, SPRAYERS } from '../src/plots/data';
import { TRACTORS } from '../src/tractor/data';
import { WATER } from '../src/water/config';
import { tankOf } from '../src/water/model';
import { SHOP_TABS, STORAGE_OPTIONS } from '../src/data';
import { MEASURES } from '../src/security/config';
import { UNLOCK, isOpen, openCount, tierNow } from '../src/unlock/model';

/* Options that open as the farmer grows (src/unlock/model.ts): every buying decision offers several options, the
   first two on day 1, the third on day 2 (or at Level 2), every one on day 3 (or at Level 3). Played through the
   reducer, then the power yard's picker in the browser. */

const day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 100_000, ...patch });
const onDay = (d: number, life: Partial<LifeState> = {}, patch: Partial<GameState> = {}) => game({ life: { day: d, started: d >= 2 ? 2 : null, date: day, ...life }, ...patch });
const act = (s: GameState, ...as: Parameters<typeof reducer>[1][]) => as.reduce(reducer, s);

test('two options on day 1, three on day 2, five on day 3; a level reached sooner opens them sooner', () => {
  expect(UNLOCK.tiers.map(t => t.open)).toEqual([2, 3, 5]);
  expect(openCount(onDay(1), 5)).toBe(2);
  expect(openCount(onDay(2), 5)).toBe(3);
  expect(openCount(onDay(3), 5)).toBe(5);
  expect(openCount(onDay(9), 5)).toBe(5);
  // Level 3 on day 1 opens everything; Level 2 opens the third
  const lv = (n: number) => ({ ...initialState.ach!, levels: Object.fromEntries(Array.from({ length: n }, (_, i) => [`level-${i + 1}`, { date: day, claimed: true }])) });
  expect(tierNow(onDay(1, {}, { ach: lv(2) }))).toBe(1);
  expect(openCount(onDay(1, {}, { ach: lv(3) }), 5)).toBe(5);
  expect(isOpen(onDay(1), 1)).toBe(true);
  expect(isOpen(onDay(1), 2)).toBe(false);
});

test('every buying decision offers at least three options, and at most five where they are alternatives', () => {
  const lists: [string, number][] = [
    ...POWER_STEPS.filter(p => p.id !== 'switchOn').map(p => [p.name, p.options.length] as [string, number]),
    ['Coops', COOPS.length],
    ['Cow sheds', SHEDS.length],
    ['Fertilizers', FERTS.length],
    ['Sprayers', SPRAYERS.length],
    ['Tractors', TRACTORS.length],
    ['Water', WATER.buys.length],
    ['Crop cover', WATER.cover.plans.length],
    ['Storage', STORAGE_OPTIONS.length],
    ['Tanks', SHOP_TABS.find(t => t.id === 'tank')!.items.filter(i => !i.partner).length],
  ];
  for (const [name, n] of lists) {
    expect(n, name).toBeGreaterThanOrEqual(3);
    expect(n, name).toBeLessThanOrEqual(UNLOCK.max);
  }
  expect(SEEDS.length).toBeGreaterThanOrEqual(5);
  expect(MEASURES.length).toBeGreaterThanOrEqual(5);
  // the defaults a new game starts with are open on day 1
  expect(SEEDS.findIndex(x => x.id === 'certified')).toBeLessThan(2);
  expect(FERTS.findIndex(x => x.id === 'basal')).toBeLessThan(2);
  expect(SPRAYERS.findIndex(x => x.id === 'knapsack')).toBeLessThan(2);
});

test('the power parts: five options each, two to choose from on day 1, and the choice runs the system', () => {
  let s = onDay(1, {}, { trial: newTrial(2, false, COMMON_PLAN) });
  // the 5 kW array is for day 3
  s = act(s, { type: 'powerInstall', id: 'panels', score: 1, option: 'p5' });
  expect(powerOf(s.power).parts.panels).toBeUndefined();
  expect(s.toast?.text).toMatch(/day 3/);
  const coins = s.coins;
  s = act(s, { type: 'powerInstall', id: 'panels', score: 1, option: 'p15' });
  expect(powerOf(s.power).parts.panels).toMatchObject({ day: 1, option: 'p15' });
  expect(s.coins).toBe(coins - POWER_STEPS[0].options.find(o => o.id === 'p15')!.price);
  // with 1.5 kW of panels, a day makes half the sun of the 3 kW array
  s = act({ ...s, life: { ...lifeOf(s.life), day: 2 } }, { type: 'powerInstall', id: 'inverter', score: 1, option: 'psw' });
  const small = forecastDay(s).solar;
  const big = forecastDay({ ...s, power: { ...powerOf(s.power), parts: { ...powerOf(s.power).parts, panels: { day: 1, score: 1, option: 'p3' } } } }).solar;
  expect(small).toBeCloseTo(big / 2, 1);
  // 5 kW of panels on a 3 kW inverter: the inverter carries only 3 kW
  const clipped = forecastDay({ ...s, power: { ...powerOf(s.power), parts: { ...powerOf(s.power).parts, panels: { day: 1, score: 1, option: 'p5' } } } }).solar;
  expect(clipped).toBeCloseTo(big, 1);
  // a save from before the options keeps the part it had (the default)
  const old = forecastDay({ ...s, power: { ...powerOf(s.power), parts: { panels: { day: 1, score: 1 }, inverter: { day: 2, score: 1 } } } }).solar;
  expect(old).toBeCloseTo(big, 1);
});

test('the coop and the cow shed: five each, the dearer ones open later', () => {
  let s = onDay(1);
  s = act(s, { type: 'coopBuild', id: 'secure' });
  expect(lifeOf(s.life).coop ?? null).toBeNull();
  expect(s.toast?.text).toMatch(/opens on day 3/);
  s = act(s, { type: 'coopBuild', id: 'basic' });
  expect(lifeOf(s.life).coop).toBe('basic');
  s = act({ ...s, life: { ...lifeOf(s.life), day: 2 } }, { type: 'coopBuild', id: 'mobile' });
  expect(lifeOf(s.life).coop).toBe('mobile');
  s = act({ ...s, life: { ...lifeOf(s.life), day: 3 } }, { type: 'shedBuild', id: 'barn' });
  expect(lifeOf(s.life).shed).toBe('barn');
});

test('seed, fertilizer, the farm plan, water, the Shop, storage and security are locked the same way', () => {
  let s = onDay(1, {}, { trial: { ...newTrial(2, false, COMMON_PLAN), phase: 'plan' } });
  // a seed for day 3 is refused at the shed and on the inputs board
  s = act(s, { type: 'shedChoose', kind: 'seed', id: 'intercrop' });
  expect(s.toast?.text).toMatch(/opens on day 3/);
  s = act(s, { type: 'plotSet', farm: 1, plot: 0, kind: 'fert', value: 'double' });
  expect(plotsOf(s.trial!, 1)[0].fert).toBe('basal');
  s = act(s, { type: 'plotSet', farm: 1, plot: 0, kind: 'fert', value: 'basalTop' });
  expect(plotsOf(s.trial!, 1)[0].fert).toBe('basalTop');
  // tractor hire is a day 3 land prep; the hand hoe and slash-and-clear are open
  s = act(s, { type: 'trialPlan', farm: 1, key: 'land', value: 'tractor' });
  expect(s.trial!.plans[1].land).toBe('hoe');
  s = act(s, { type: 'trialPlan', farm: 1, key: 'land', value: 'slash' });
  expect(s.trial!.plans[1].land).toBe('slash');
  // a big bowser is for day 3; piped water is open
  const tank = { ...tankOf(s.tank), level: 0 };
  s = act({ ...s, tank }, { type: 'waterBuy', kind: 'bulk' });
  expect(tankOf(s.tank).level).toBe(0);
  s = act(s, { type: 'waterBuy', kind: 'piped' });
  expect(tankOf(s.tank).level).toBeGreaterThan(0);
  // the 20,000 L tank is for day 3; partners' products are never locked
  s = act(s, { type: 'buy', id: 'tank-xl', price: 18000, name: '20,000 L' });
  expect(s.inventory).not.toContain('tank-xl');
  s = act(s, { type: 'buy', id: 'tank-tangi', price: 5000, name: 'Tangi 5,000 L' });
  expect(s.inventory).toContain('tank-tangi');
  // on day 3 everything is open
  s = act({ ...s, life: { ...lifeOf(s.life), day: 3 } }, { type: 'buy', id: 'tank-xl', price: 18000, name: '20,000 L' }, { type: 'trialPlan', farm: 1, key: 'land', value: 'tractor' }, { type: 'securityBuy', id: 'fence' });
  expect(s.inventory).toContain('tank-xl');
  expect(s.trial!.plans[1].land).toBe('tractor');
  // the storage options: hermetic bags from day 1, the metal silo from day 3
  expect(STORAGE_OPTIONS.slice(0, 2).map(o => o.id)).toEqual(['home', 'hermetic']);
});

test('on screen: the power yard offers five panels, two open on day 1, the rest locked with the day', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', coins: 100_000, life: { day: 1, date: null, started: null } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => (window.location.hash = '#/power/build'));
  await page.getByRole('button', { name: 'Choose and install' }).first().click();
  const dialog = page.getByRole('dialog', { name: /Solar panels: choose one/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.pg-card')).toHaveCount(5);
  await expect(dialog.locator('.pg-card.is-gated')).toHaveCount(3);
  await expect(dialog.locator('.lock-tag').first()).toContainText(/day 2|day 3/);
  await expect(dialog.locator('.open-line')).toContainText('2 of 5 options open');
  await dialog.getByRole('button', { name: 'Install 1.5 kW kit' }).click();
  // the mini-game, then the part is in with its option
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.mg-card')).toBeVisible();
});
