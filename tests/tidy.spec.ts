import { expect, test } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { achOfSave, initialAch } from '../src/achievements/model';
import { achClock } from '../src/achievements/track';
import { BUSH_SPOTS, ROCK_SPOTS, TIDY, TIDY_TOTAL, tidyItems, tidyStreak } from '../src/tidy/model';
import { PLACES } from '../src/world/engine';
import { PLOTS, PLOT_D, PLOT_W } from '../src/world/field';
import { boot, state, type Win } from './helpers';

/* The daily tidy-up: every day 3 bushes and 5 rocks turn up around the farm; the farmer clears them by hand for a few
   points each and a bonus for the lot, and a tidy streak for doing it day after day. */

let day = '2026-11-13';
achClock.today = () => day;

const farm = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  coins: 1000,
  points: 0,
  ach: { ...initialAch, won: { welcome: { date: '2026-11-01', claimed: true } } },
  ...patch,
});

/** Clear every piece of today's tidy-up. */
const clearAll = (s: GameState) => tidyItems(day).reduce((st, i) => reducer(st, { type: 'tidyClear', id: i.id }), s);

test("each day has 3 bushes and 5 rocks, the same all day, others the next day, never on a farm or a place", () => {
  const a = tidyItems('2026-11-13');
  expect(a.filter(i => i.kind === 'bush')).toHaveLength(3);
  expect(a.filter(i => i.kind === 'rock')).toHaveLength(5);
  expect(tidyItems('2026-11-13')).toEqual(a);
  // over a week, the spots move around
  const week = ['14', '15', '16', '17', '18', '19'].map(d => tidyItems(`2026-11-${d}`).map(i => `${i.x},${i.z}`).join('|'));
  expect(new Set(week).size).toBeGreaterThan(1);
  // spots far enough apart that the button by one never belongs to another
  const all = [...BUSH_SPOTS, ...ROCK_SPOTS];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1])).toBeGreaterThan(2.5);
  // every spot is off the farms' plots and clear of the places the farmer walks to
  for (const [x, z] of [...BUSH_SPOTS, ...ROCK_SPOTS]) {
    for (const p of PLOTS) expect(Math.abs(x - p.x) < PLOT_W / 2 + 0.6 && Math.abs(z - p.z) < PLOT_D / 2 + 0.6, `${x},${z} on a farm`).toBe(false);
    for (const [name, p] of Object.entries(PLACES)) expect(Math.hypot(x - p.x, z - p.z), `${x},${z} at ${name}`).toBeGreaterThan(p.r + TIDY.reach);
  }
});

test('the farm opens on a new day: a new tidy-up; clearing it pays each piece, then a bonus, once', () => {
  day = '2026-11-13';
  let s = reducer(farm(), { type: 'tidyDay' });
  expect(s.tidy).toMatchObject({ date: day, cleared: [] });
  expect(s.toast?.text).toContain('3 bushes and 5 rocks');
  // the same day again changes nothing
  expect(reducer(s, { type: 'tidyDay' })).toBe(s);

  const [first, ...rest] = tidyItems(day);
  s = reducer(s, { type: 'tidyClear', id: first.id });
  expect(s.points).toBe(TIDY.pointsEach);
  expect(s.coins).toBe(1000);
  // a piece cleared twice, or one that isn't today's, pays nothing
  expect(reducer(s, { type: 'tidyClear', id: first.id })).toBe(s);
  expect(reducer(s, { type: 'tidyClear', id: 'rock-9' })).toBe(s);

  s = rest.reduce((st, i) => reducer(st, { type: 'tidyClear', id: i.id }), s);
  expect(s.tidy).toMatchObject({ days: 1, streak: 1, last: day });
  expect(s.tidy!.cleared).toHaveLength(TIDY_TOTAL);
  expect(s.points).toBe(TIDY_TOTAL * TIDY.pointsEach + TIDY.bonusPoints);
  expect(s.coins).toBe(1000 + TIDY.bonusCoins);
  expect(s.toast?.text).toContain('Farm tidy!');
  // the whole tidy-up is a flow (its sound), counts the day as played, and wins the day-one badge
  expect(s.sfx?.kind).toBe('flow');
  const a = achOfSave(s.ach);
  expect(a.stats.tidyDays).toBe(1);
  expect(a.streak.last).toBe(day);
  expect(a.won['first-tidy']).toEqual({ date: day, claimed: false });
});

test('the tidy streak: on with each tidy day, held through the next day, gone after a day missed', () => {
  day = '2026-11-13';
  let s = clearAll(reducer(farm(), { type: 'tidyDay' }));
  day = '2026-11-14';
  expect(tidyStreak(s.tidy, day)).toBe(1);
  s = reducer(s, { type: 'tidyDay' });
  // a new day: everything to clear again, the days and streak kept
  expect(s.tidy).toMatchObject({ date: day, cleared: [], days: 1, streak: 1 });
  s = clearAll(s);
  expect(s.tidy).toMatchObject({ days: 2, streak: 2 });
  expect(s.toast?.text).toContain('2-day tidy streak');
  // a day missed
  day = '2026-11-16';
  expect(tidyStreak(s.tidy, day)).toBe(0);
  s = clearAll(reducer(s, { type: 'tidyDay' }));
  expect(s.tidy).toMatchObject({ days: 3, streak: 1 });
  expect(achOfSave(s.ach).won['tidy-bronze']).toBeTruthy();
});

test('in the farm world: walk up to a bush or rock, press the button, the timer clears it; the chip counts', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world' }));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  const chip = page.locator('.hud-tidy');
  await expect(chip).toContainText('Daily tidy-up');
  await expect(chip).toContainText('0/3');
  await expect(chip).toContainText('0/5');

  const items = await page.evaluate(() => (window as unknown as Win & { __lima: { tidy: () => { id: string; kind: string; x: number; z: number }[] } }).__lima.tidy());
  expect(items).toHaveLength(8);
  await page.evaluate(() => {
    const w = (window as unknown as Win).__limaWorld! as unknown as { workScale: number };
    w.workScale = 0.25;
  });
  const before = (await state(page)).points;

  // walking off before the timer is done leaves the bush where it is
  const bush = items.find(i => i.kind === 'bush')!;
  await page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.spawn(x + 0.8, z + 0.4), [bush.x, bush.z]);
  await page.getByRole('button', { name: /Clear the bush/ }).click();
  await page.evaluate(() => (window as unknown as Win).__limaWorld!.spawn(0, -13.4));
  await expect(page.locator('.hud-hint')).toContainText('Stay by the bush');
  expect((await state(page)).tidy.cleared).toEqual([]);

  for (const it of items) {
    await page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.spawn(x + 0.8, z + 0.4), [it.x, it.z]);
    await page.getByRole('button', { name: it.kind === 'bush' ? /Clear the bush/ : /Move the rock/ }).click();
    await expect.poll(async () => (await state(page)).tidy.cleared).toContain(it.id);
  }
  const s = await state(page);
  expect(s.points - before).toBe(8 * 5 + 40);
  await expect(chip).toContainText('Farm tidy');
  await expect(chip).toContainText('3/3');
  await expect(chip).toContainText('5/5');
  // nothing left to clear: no button anywhere
  await expect(page.locator('.hud-plot.is-tidy')).toHaveCount(0);
});
