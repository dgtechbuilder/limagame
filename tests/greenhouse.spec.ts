import { expect, test } from '@playwright/test';
import { boot, optIn, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { lifeOf, type LifeState } from '../src/livestock/model';
import { GH_CROPS, GREENHOUSE, ghCropOf, greenhouseNight, greenhouseOf } from '../src/greenhouse/model';
import { RECIPES, STOREHOUSE, quoteMake, recipeOf, storehouseOf } from '../src/storehouse/model';
import { MARKET, PRODUCE, produceOf, storeNight } from '../src/produce/model';
import { FOODS } from '../src/nutrition/data';
import { walletOf } from '../src/wallet/model';
import { routeTo } from '../src/route';
import { BUSH_SPOTS, ROCK_SPOTS } from '../src/tidy/model';
import { GREENHOUSE_AT, STORAGE_AT, STOREHOUSE_AT } from '../src/world/field';
import { tankOf } from '../src/water/model';

/* The greenhouse (four beds under glass, where Farm 7 was) and the storehouse (the store, the greenhouse's picks
   brought in, and food made from the harvest, where Farm 8 was). Played through the reducer, then on the farm. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 100_000, ...patch });
const onDay = (d: number, life: Partial<LifeState> = {}, patch: Partial<GameState> = {}) => game({ life: { day: d, started: d >= 2 ? 2 : null, date: day, ...life }, ...patch });
const act = (s: GameState, ...as: Parameters<typeof reducer>[1][]) => as.reduce(reducer, s);

test('four beds of different greenhouse crops; a bed is picked again and again until its plants are spent', () => {
  expect(GREENHOUSE.beds).toBe(4);
  expect(GH_CROPS.map(c => c.id)).toEqual(['tomatoes', 'capsicum', 'cucumber', 'strawberries', 'chillies']);
  // every crop the greenhouse grows sells at the stall and has its nutrition
  for (const c of GH_CROPS) {
    expect(PRODUCE[c.produce]).toBeTruthy();
    expect(FOODS[c.produce]).toBeTruthy();
  }
  let s = onDay(GREENHOUSE.openDay);
  const crops = ['tomatoes', 'capsicum', 'cucumber', 'strawberries'] as const;
  crops.forEach((crop, bed) => (s = act(s, { type: 'ghPlant', bed, crop, score: 1 })));
  const g = greenhouseOf(s.greenhouse);
  expect(g.beds.map(b => b.crop)).toEqual(crops);
  expect(s.coins).toBe(100_000 - crops.reduce((n, c) => n + ghCropOf(c).cost, 0));
  // a planted bed cannot be planted again
  s = act(s, { type: 'ghPlant', bed: 0, crop: 'chillies', score: 1 });
  expect(s.toast?.text).toMatch(/already grows tomatoes/);
  // cucumbers: four picks, two days apart, then the bed is empty again
  const c = ghCropOf('cucumber');
  let d = GREENHOUSE.openDay + c.grow;
  for (let i = 0; i < c.picks; i++) {
    s = act({ ...s, life: { ...lifeOf(s.life), day: d } }, { type: 'ghHarvest', bed: 2, score: 1 });
    d += c.regrow;
  }
  expect(s.toast?.text).toMatch(/plants are spent/);
  expect(greenhouseOf(s.greenhouse).beds[2].crop).toBeNull();
  expect(greenhouseOf(s.greenhouse).log.filter(x => x.bed === 2)).toHaveLength(c.picks);
  expect(walletOf(s.wallet).entries.some(x => x.label === 'Planted greenhouse bed 3')).toBe(true);
});

test('Water all waters every thirsty bed from the tank; a night unwatered costs health, the drip waters them', () => {
  let s = onDay(GREENHOUSE.openDay);
  s = act(s, { type: 'ghPlant', bed: 0, crop: 'tomatoes', score: 1 }, { type: 'ghPlant', bed: 3, crop: 'chillies', score: 1 });
  s = { ...s, life: { ...lifeOf(s.life), day: GREENHOUSE.openDay + 1 } };
  const before = tankOf(s.tank).level;
  s = act(s, { type: 'ghWater', bed: -1 });
  expect(tankOf(s.tank).level).toBe(before - ghCropOf('tomatoes').water - ghCropOf('chillies').water);
  expect(greenhouseOf(s.greenhouse).beds.filter(b => b.watered === GREENHOUSE.openDay + 1)).toHaveLength(2);
  s = act(s, { type: 'ghWater', bed: -1 });
  expect(s.toast?.text).toMatch(/Every bed is watered/);
  // a dry night, and a night on the drip
  const dry = greenhouseNight({ beds: [{ crop: 'tomatoes', planted: 4, watered: 4, ready: 9, health: 100, score: 1, harvests: 0 }] }, 5, false, 0.6);
  expect(dry.g.beds[0].health).toBe(100 - GREENHOUSE.dry);
  const drip = greenhouseNight({ beds: [{ crop: 'tomatoes', planted: 4, watered: 4, ready: 9, health: 100, score: 1, harvests: 0 }] }, 5, true, 0.6);
  expect(drip.g.beds[0]).toMatchObject({ health: 100, watered: 6 });
  expect(drip.litres).toBe(Math.round(ghCropOf('tomatoes').water * 0.6));
});

test('the storehouse makes sauce, jam, pickles and flour from the store: worth more than the food raw, 4 batches a day', () => {
  // every product is worth more made than its food raw, after the making
  for (const r of RECIPES) expect(quoteMake(r, 1, false).extra).toBeGreaterThan(0);
  // a product's cost a kg is the food that went in and the making
  for (const r of RECIPES) {
    const food = Object.entries(r.input).reduce((n, [id, kg]) => n + (kg ?? 0) * PRODUCE[id as keyof typeof PRODUCE].cost, 0);
    expect(PRODUCE[r.out].cost).toBeCloseTo((food + r.making) / r.yield, 0);
    expect(PRODUCE[r.out].fresh).toBe(false);
  }
  let s = onDay(3, {}, { produce: { store: { tomatoes: 35, maize: 60 } } });
  s = act(s, { type: 'storeMake', recipe: 'sauce', batches: 1, score: 1 });
  expect(s.toast?.text).toMatch(/opens on day 4/);
  s = { ...s, life: { ...lifeOf(s.life), day: GREENHOUSE.openDay } };
  const coins = s.coins;
  s = act(s, { type: 'storeMake', recipe: 'sauce', batches: 3, score: 1 });
  let p = produceOf(s.produce);
  expect(p.store.tomatoes).toBe(5);
  expect(p.store.sauce).toBe(recipeOf('sauce').yield * 3);
  expect(s.coins).toBe(coins - recipeOf('sauce').making * 3);
  expect(s.toast?.text).toMatch(/kg of tomato sauce made and stored · worth .* more than selling the food raw/);
  expect(walletOf(s.wallet).entries[0].label).toBe('Storehouse: jars, sugar and milling');
  // not enough tomatoes for another batch
  s = act(s, { type: 'storeMake', recipe: 'sauce', batches: 1, score: 1 });
  expect(s.toast?.text).toMatch(/a batch needs 10 kg tomatoes/);
  // the fourth batch of the day, then no more today
  s = act(s, { type: 'storeMake', recipe: 'flour', batches: 2, score: 0 });
  p = produceOf(s.produce);
  expect(p.store.maize).toBe(40);
  expect(p.store.flour).toBeCloseTo(recipeOf('flour').yield * 0.85, 1);
  expect(storehouseOf(s.storehouse).batches).toBe(STOREHOUSE.dailyBatches);
  s = act(s, { type: 'storeMake', recipe: 'flour', batches: 1, score: 1 });
  expect(s.toast?.text).toMatch(/come back tomorrow/);
  // made food keeps; fresh food wilts, half as fast in the storehouse's shade
  const night = storeNight({ store: { sauce: 10, tomatoes: 100 } }, false, true);
  expect(night.store.sauce).toBe(10);
  expect(night.store.tomatoes).toBe(100 * (1 - MARKET.wilt * MARKET.shadeWilt));
  expect(storeNight({ store: { tomatoes: 100 } }, false, false).store.tomatoes).toBe(100 * (1 - MARKET.wilt));
});

test('an old save with Farms 7 and 8 crops loads, and their addresses open the greenhouse and the storehouse', () => {
  const p = produceOf({ store: { maize: 10, spinach: 20, watermelon: 5 } as never });
  expect(p.store).toEqual({ maize: 10 });
  const s = onDay(5);
  expect(routeTo(s, '#/new-farms/7')).toContainEqual({ type: 'open', modal: { kind: 'greenhouse', bed: 0 } });
  expect(routeTo(s, '#/new-farms/8')).toContainEqual({ type: 'open', modal: { kind: 'storehouse', tab: 'store' } });
  expect(routeTo(s, '#/greenhouse/bed-4')).toContainEqual({ type: 'open', modal: { kind: 'greenhouse', bed: 3 } });
  expect(routeTo(s, '#/storehouse/produce')).toContainEqual({ type: 'open', modal: { kind: 'storehouse', tab: 'produce' } });
});

test('the daily tidy-up never puts a bush or a rock inside the greenhouse, the storehouse or its storage annex', () => {
  for (const [x, z] of [...BUSH_SPOTS, ...ROCK_SPOTS])
    for (const b of [GREENHOUSE_AT, STOREHOUSE_AT, STORAGE_AT]) expect(Math.abs(x - b.x) < b.w / 2 + 0.6 && Math.abs(z - b.z) < b.d / 2 + 0.6, `${x},${z} in a building`).toBe(false);
});

test('on the farm: the greenhouse door opens its beds, the storehouse door its shelves; plant, pick and make', async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({
      view: 'world',
      coins: 50_000,
      life: { day: 6, date: null, started: 2 },
      produce: { store: { maize: 40, tomatoes: 12 } },
      greenhouse: { beds: [null, { crop: 'strawberries', planted: 4, watered: 6, ready: 6, health: 100, score: 1, harvests: 0 }, null, null].map(b => b ?? { crop: null, planted: 0, watered: 0, ready: 0, health: 100, score: 0, harvests: 0 }) },
    } as never),
  );
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  // the walks are long: a quick farmer, as in the other farm tests (helpers.ts scenario), so a slow machine keeps up
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  const walkTo = (p: string) =>
    page.evaluate(place => {
      const at = (window as unknown as Win).__lima.places[place];
      (window as unknown as Win).__limaWorld!.walkTo(at.x, at.z);
    }, p);
  // the greenhouse door: the button says what the beds need, and opens the bed to pick
  await walkTo('greenhouse');
  // the walk across the farm takes about 9 seconds here and two or three times that on a slow CI runner
  await expect(page.locator('.hud-place .is-enter')).toContainText('Open the greenhouse', { timeout: 60_000 });
  await expect(page.locator('.hud-place .is-enter')).toContainText('1 to pick');
  await optIn(page);
  const gh = page.getByRole('dialog', { name: 'Greenhouse', exact: true });
  await expect(gh).toBeVisible();
  await expect(page).toHaveURL(/#\/greenhouse\/bed-2$/);
  await gh.getByRole('button', { name: 'Pick', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let i = 1; i <= 6; i++) await page.getByRole('button', { name: `Ripe strawberries ${i}`, exact: true }).click();
  await page.getByRole('button', { name: 'Into the storehouse' }).click();
  await expect.poll(async () => (await state(page)).produce.store.strawberries).toBeGreaterThan(5);
  // plant another bed: capsicum, the crop bed 2 is laid out for, comes first
  await gh.getByRole('button', { name: /^Bed 1/ }).click();
  await gh.getByRole('button', { name: /Plant Tomatoes in greenhouse bed 1/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let i = 1; i <= 8; i++) await page.getByRole('button', { name: `Planting hole ${i}`, exact: true }).click();
  await page.getByRole('button', { name: 'Done planting' }).click();
  await expect.poll(async () => (await state(page)).greenhouse.beds[0].crop).toBe('tomatoes');
  await page.evaluate(() => (window.location.hash = '#/farm'));
  // the storehouse door: its shelves, then make jam from the strawberries
  await walkTo('storehouse');
  await expect(page.locator('.hud-place .is-enter')).toContainText('Open the storehouse');
  await optIn(page);
  const sh = page.getByRole('dialog', { name: 'Storehouse', exact: true });
  await expect(sh).toBeVisible();
  await expect(sh.getByLabel('Strawberries in the store')).toBeVisible();
  await sh.getByRole('button', { name: /Produce/ }).click();
  await expect(page).toHaveURL(/#\/storehouse\/produce$/);
  await sh.getByRole('button', { name: 'Make 1 batch of Strawberry jam' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (const step of recipeOf('jam').steps) await page.getByRole('button', { name: step, exact: true }).click();
  await page.getByRole('button', { name: 'Onto the shelves' }).click();
  await expect.poll(async () => (await state(page)).produce.store.jam).toBeGreaterThan(3);
  await expect.poll(async () => (await state(page)).storehouse.batches).toBe(1);
});

test('the storage annex stands against the storehouse, built like a freezer, its own door opening the store', async ({ page }) => {
  // the annex is a second building on the storehouse's right-hand wall, and its door is not the storehouse's
  expect(STORAGE_AT.x - STORAGE_AT.w / 2).toBeCloseTo(STOREHOUSE_AT.x + STOREHOUSE_AT.w / 2, 5);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', coins: 50_000, life: { day: 6, date: null, started: 2 }, produce: { store: { tomatoes: 12 } } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  const places = await page.evaluate(() => (window as unknown as Win).__lima.places);
  expect(places.storage).toBeTruthy();
  expect(Math.hypot(places.storage.x - places.storehouse.x, places.storage.z - places.storehouse.z)).toBeGreaterThan(places.storage.r + places.storehouse.r);
  // its door is in the front wall: from the storehouse's door on the lane, the farmer walks round the annex to it
  await page.evaluate(at => (window as unknown as Win).__limaWorld!.spawn(at.x, at.z), places.storehouse);
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
  const side = STORAGE_AT.x + STORAGE_AT.w / 2 + 0.7;
  for (const to of [{ x: side, z: places.storehouse.z }, { x: side, z: places.storage.z }, places.storage]) {
    await page.evaluate(at => (window as unknown as Win).__limaWorld!.walkTo(at.x, at.z), to);
    await expect.poll(async () => page.evaluate(at => { const f = (window as unknown as Win).__limaWorld!.farmerAt(); return Math.hypot(f.x - at.x, f.z - at.z); }, to), { timeout: 60_000 }).toBeLessThan(0.3);
  }
  await expect(page.locator('.hud-place .is-enter')).toContainText('Open the storage', { timeout: 60_000 });
  await optIn(page);
  const sh = page.getByRole('dialog', { name: 'Storehouse', exact: true });
  await expect(sh).toBeVisible();
  await expect(page).toHaveURL(/#\/storehouse\/store$/);
});
