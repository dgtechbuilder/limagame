import { expect, test } from '@playwright/test';
import { boot, optIn, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { lifeOf } from '../src/livestock/model';
import { areasOf } from '../src/climate/land';
import { FACTORS, payOf } from '../src/climate/model';
import { ledgerOf } from '../src/credits/ledger';
import { FOREST, FOREST_FULL, PLANTS, SOURCES, forestOf, forestRate, fromBiomass, fromCarbon, plantOf, quoteSale, standRate } from '../src/forest/model';
import { TERMS } from '../src/learn/glossary';
import { pathOf, routeTo } from '../src/route';

/* The mini forest (src/forest): native trees, bushes and grasses, each with its climate card and its harvests, and the
   "Before you sell" card that weighs the money against the CO₂, the credits and the land lost. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 10_000, ...patch });
const onDay = (d: number, patch: Partial<GameState> = {}) => game({ life: { ...lifeOf(undefined), day: d, started: 2 }, ...patch });
const act = (s: GameState, ...as: Parameters<typeof reducer>[1][]) => as.reduce(reducer, s);

test('the forest is ten acres of plants native to Africa, each with a sourced climate figure and a Farm words card', () => {
  expect(PLANTS.reduce((n, p) => n + p.acres, 0)).toBeCloseTo(FOREST.acres, 6);
  expect(new Set(PLANTS.map(p => p.kind))).toEqual(new Set(['tree', 'bush', 'grass']));
  for (const id of ['croton', 'markhamia', 'acacia', 'baobab', 'napier', 'rhodes']) expect(PLANTS.some(p => p.id === id)).toBe(true);
  // the rates are the published figures, turned into kg CO₂ an acre a day
  expect(fromBiomass(7.6)).toBeCloseTo(14.5, 6); // young African forest, 7.6 t biomass a hectare a year
  expect(fromCarbon(3.1)).toBeCloseTo(12.6, 6); // trees on African farms, 3.1 t C a hectare a year
  expect(fromCarbon(1)).toBeCloseTo(4.1, 6); // East African grassland soils, 1 t C a hectare a year
  for (const p of PLANTS) {
    expect(SOURCES[p.source].url).toMatch(/^https:\/\//);
    expect(p.kgDay).toBeGreaterThan(0);
    expect(TERMS[p.term], p.id).toBeTruthy();
    expect(TERMS[p.term].does).toContain('kg of CO₂ an acre a day');
  }
  expect(TERMS.reversal).toBeTruthy();
  // grown, the forest stores the sum of its stands: the Climate page's forest area
  const s = onDay(5);
  expect(forestRate(s.forest, 5)).toBeCloseTo(FOREST_FULL, 6);
  expect(areasOf(s).find(a => a.id === 'forest')!.stored).toBeCloseTo(FOREST_FULL, 6);
});

test('a crop is sold and the plant lives on: no credits lost; a cut grass stores less until it grows back', () => {
  let s = onDay(5, { climate: { ...initialState.climate, credits: 50 } });
  const napier = plantOf('napier');
  const q = quoteSale(s.forest, 'napier', 'crop', 5, FACTORS.credit.value, 1);
  expect(q).toMatchObject({ ok: true, coins: napier.crop.price, co2: 0, credits: 0, days: napier.crop.every });
  expect(q.after).toBeCloseTo(q.before * napier.crop.drop, 6);
  s = act(s, { type: 'forestSell', id: 'napier', kind: 'crop' });
  expect(s.coins).toBe(10_000 + napier.crop.price);
  expect(s.climate.credits).toBe(50);
  const st = forestOf(s.forest).stands.napier;
  expect(st.cropAt).toBe(5 + napier.crop.every);
  expect(standRate(st, 5)).toBeCloseTo(napier.kgDay * napier.acres * napier.crop.drop, 6);
  // not again until it grows back
  s = act(s, { type: 'forestSell', id: 'napier', kind: 'crop' });
  expect(s.toast?.text).toMatch(/Grows back on day/);
  expect(s.coins).toBe(10_000 + napier.crop.price);
  // grown back: the full rate again
  expect(standRate(st, 5 + napier.crop.every)).toBeCloseTo(napier.kgDay * napier.acres, 6);
});

test('felling: the money, the CO₂ back in the air, the credits cancelled, and the stand grows again from seedlings', () => {
  let s = onDay(5, { climate: { ...initialState.climate, credits: 80, level: 2 } });
  const croton = plantOf('croton');
  const q = quoteSale(s.forest, 'croton', 'fell', 5, FACTORS.credit.value, 1);
  expect(q.ok).toBe(true);
  expect(q.held).toBe(Math.round(croton.kgDay * croton.acres * croton.grow));
  // poles keep 40% of the carbon locked up; the rest goes back into the air
  expect(q.co2).toBe(Math.round(q.held * 0.6));
  expect(q.credits).toBeCloseTo(q.co2 / 10, 1);
  expect(q.after).toBeLessThan(q.before);
  expect(q.losses.length).toBeGreaterThan(0);
  s = act(s, { type: 'forestSell', id: 'croton', kind: 'fell' });
  expect(s.coins).toBe(10_000 + croton.fell!.price);
  expect(s.climate.credits).toBeCloseTo(80 - q.credits, 6);
  expect(s.climate.co2By.trees).toBe(q.co2);
  expect(ledgerOf(s.ledger).entries[0]).toMatchObject({ type: 'co2', label: 'Mini forest: Croton felled' });
  expect(ledgerOf(s.ledger).entries[0].amount).toBeCloseTo(-q.credits, 6);
  // seedlings: a fraction of the rate, not fellable until grown again
  const st = forestOf(s.forest).stands.croton;
  expect(standRate(st, 5)).toBeCloseTo(croton.kgDay * croton.acres * FOREST.seedling, 6);
  expect(quoteSale(s.forest, 'croton', 'fell', 6, 10, 1)).toMatchObject({ ok: false });
  expect(quoteSale(s.forest, 'croton', 'fell', 5 + croton.grow, 10, 1)).toMatchObject({ ok: true });
  // the baobab and the grasses are never felled
  expect(quoteSale(s.forest, 'baobab', 'fell', 5, 10, 1).ok).toBe(false);
  expect(quoteSale(s.forest, 'rhodes', 'fell', 5, 10, 1).ok).toBe(false);
  // kept standing after seeing what felling does: points once a day
  const kept = act(s, { type: 'forestKeep', id: 'markhamia' });
  expect(kept.points).toBe(s.points + FOREST.keepPoints);
  expect(act(kept, { type: 'forestKeep', id: 'markhamia' }).points).toBe(kept.points);
});

test('the daily payment credits each stand, and a felled forest pays less until it regrows', () => {
  day = '2026-11-15';
  let s = reducer(onDay(5), { type: 'climateTick' });
  day = '2026-11-16';
  s = reducer(s, { type: 'climateTick' });
  const f = forestOf(s.forest);
  expect(f.stands.croton.credited).toBeCloseTo(plantOf('croton').kgDay * plantOf('croton').acres, 6);
  expect(PLANTS.reduce((n, p) => n + f.stands[p.id].credited, 0)).toBeCloseTo(FOREST_FULL, 6);
  expect(payOf(s.climate).areas?.forest.stored).toBeCloseTo(FOREST_FULL, 6);
  // felled: the forest area stores less
  const felled = act(s, { type: 'forestSell', id: 'markhamia', kind: 'fell' });
  expect(areasOf(felled).find(a => a.id === 'forest')!.stored).toBeLessThan(FOREST_FULL);
  expect(areasOf(felled).find(a => a.id === 'forest')!.use).toMatch(/growing back/);
});

test('mini forest addresses', () => {
  expect(pathOf({ ...initialState, modal: { kind: 'forest', tab: 'grass' } } as GameState)).toBe('/mini-forest/grasses');
  expect(pathOf({ ...initialState, modal: { kind: 'forest', tab: 'tree', plant: 'baobab' } } as GameState)).toBe('/mini-forest/trees/baobab');
  const r = routeTo(game(), '/mini-forest/trees/baobab');
  expect(JSON.stringify(r)).toContain('baobab');
});

test('on the farm: the forest sign opens the mini forest; before felling, the money is weighed against the climate', async ({ page }) => {
  await boot(page);
  const climate = { ...initialState.climate, credits: 120, level: 3 };
  await page.evaluate(c => (window as unknown as Win).__lima.jump({ view: 'world', coins: 20_000, life: { day: 6, date: null, started: 2 }, climate: c } as never), climate);
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  const places = await page.evaluate(() => (window as unknown as Win).__lima.places);
  expect(places.forest).toBeTruthy();
  await page.evaluate(at => (window as unknown as Win).__limaWorld!.spawn(at.x, at.z), places.forest);
  await expect(page.locator('.hud-place .is-enter')).toContainText('Visit the mini forest', { timeout: 60_000 });
  await optIn(page);
  const fo = page.getByRole('dialog', { name: 'Mini forest', exact: true });
  await expect(fo).toBeVisible();
  await expect(page).toHaveURL(/#\/mini-forest\/trees$/);
  for (const name of ['Croton', 'Nile tulip', 'Umbrella thorn acacia', 'Baobab']) await expect(fo.getByRole('button', { name: new RegExp(`^${name}:`) })).toBeVisible();
  await fo.getByRole('button', { name: /^Croton:/ }).click();
  await expect(page).toHaveURL(/#\/mini-forest\/trees\/croton$/);
  await expect(fo.getByText('What it does for the climate')).toBeVisible();
  await expect(fo.getByRole('link', { name: /Requena Suarez/ })).toBeVisible();
  await fo.getByRole('button', { name: /^Fell for poles/ }).click();
  const ask = page.getByRole('dialog', { name: 'Before you sell: Croton' });
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('CO₂ back into the air');
  await expect(ask).toContainText('credits cancelled');
  await expect(ask).toContainText('In real life');
  // keep it standing first, then sell
  await ask.getByRole('button', { name: 'Keep it standing' }).click();
  await expect(ask).toBeHidden();
  let s = await page.evaluate(() => (window as unknown as Win).__lima.state);
  expect(s.forest.log[0]).toMatchObject({ kind: 'keep', id: 'croton' });
  const before = s.coins;
  await fo.getByRole('button', { name: /^Fell for poles/ }).click();
  await page.getByRole('dialog', { name: 'Before you sell: Croton' }).getByRole('button', { name: /^Sell for/ }).click();
  s = await page.evaluate(() => (window as unknown as Win).__lima.state);
  expect(s.forest.log[0]).toMatchObject({ kind: 'fell', id: 'croton' });
  expect(s.coins).toBe(before + plantOf('croton').fell!.price);
  expect(s.climate.credits).toBeLessThan(120);
  await expect(fo.getByText(/Growing back from seedlings/)).toBeVisible();
});
