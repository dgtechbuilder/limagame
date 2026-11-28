import { expect, test, type Page } from '@playwright/test';
import { boot, state } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { routeTo } from '../src/route';
import { COMMON_PLAN, checkKey, hazardFor, newTrial, setChoice, type Trial } from '../src/trials/model';
import { FULL, emptyField, needOf, type Field } from '../src/world/field';
import { TREATMENTS } from '../src/care/treatments';
import { coverQuote, farmsUse, tankOf } from '../src/water/model';
import { walletOf } from '../src/wallet/model';
import { achOfSave } from '../src/achievements/model';
import { PRACTICES, CSA_IDS } from '../src/csa/data';
import { CSA, clockNow, coverOff, csaOf, drillOf, finishRun, skillOf, waterCut } from '../src/csa/model';
import {
  HM,
  PP_CELLS,
  bestOf,
  canDig,
  ppKind,
  rainRun,
  scoreClock,
  scoreFmnr,
  scoreHalfMoon,
  scorePushPull,
  scoreSeason,
  scoreWater,
  scoreZai,
  starsOf,
  stumpsFor,
  waterDay,
  newPits,
  type Moon,
  type PpPlant,
} from '../src/csa/rules';

/* Climate Smart Agriculture (src/csa): the eight practice games' rules, the skills and the daily drill, what the
   skills do on the farm, the field clock, and the module played through the Climate page and the farm's chip. */

let day = '2026-11-22';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 10_000, ...patch });

/* ---------------- the games' rules ---------------- */

test('half-moons: only the open side uphill holds the rain; staggered rows hold it all', () => {
  const row = (r: number, cols: number[], open: Moon['open'] = 'up') => cols.map(col => ({ row: r, col, open }));
  // staggered: the second row under the gaps of the first
  const staggered = [...row(0, [0, 2, 4, 6, 8]), ...row(1, [1, 3, 5, 7])];
  expect(staggered).toHaveLength(HM.budget);
  expect(rainRun(staggered).share).toBe(1);
  // straight rows let the water through the gaps
  const straight = [...row(0, [0, 2, 4, 6, 8]), ...row(1, [0, 2, 4, 6])];
  expect(rainRun(straight).share).toBeLessThan(0.85);
  expect(starsOf(scoreHalfMoon(straight.map(m => ({ ...m, manure: true, seed: true }))).score)).toBeLessThan(3);
  // the wrong way round: the water runs round the back
  const wrong = [...row(0, [0, 2, 4, 6, 8], 'down'), ...row(1, [1, 3, 5, 7], 'down')];
  expect(rainRun(wrong).caught).toBe(0);
  expect(rainRun(wrong).ends.every(e => e.spilled.length > 0)).toBe(true);
  // fed and sown: three stars
  expect(scoreHalfMoon(staggered.map(m => ({ ...m, manure: true, seed: true }))).score).toBe(1);
  // two side by side would overlap; nine is the day's labour
  expect(canDig(staggered, 2, 0)).toBe('budget');
  expect(canDig([{ row: 0, col: 3, open: 'up' }], 0, 4)).toBe('close');
});

test('saving water: bare soil and midday lose it to the sun; mulch, drip and the early morning keep a plant alive on 2 L', () => {
  const best = scoreWater({ mulch: true, how: 'drip', when: 6, litres: 2 });
  expect(best.day.alive).toBe(true);
  expect(best.score).toBe(1);
  // the same water on bare soil wilts it
  expect(waterDay({ mulch: false, how: 'drip', when: 6, litres: 2 }).alive).toBe(false);
  // more water reaches the roots at dawn than at 1 pm, and at the roots than over the leaves
  expect(waterDay({ mulch: true, how: 'roots', when: 6, litres: 4 }).toAir).toBeLessThan(waterDay({ mulch: true, how: 'roots', when: 13, litres: 4 }).toAir);
  expect(waterDay({ mulch: true, how: 'roots', when: 6, litres: 4 }).eff).toBeGreaterThan(waterDay({ mulch: true, how: 'leaves', when: 6, litres: 4 }).eff);
  // leaves wet all night: fungus
  expect(waterDay({ mulch: true, how: 'leaves', when: 17, litres: 6 }).fungus).toBe(true);
  // a wilted plant is at most one star
  expect(starsOf(scoreWater({ mulch: false, how: 'leaves', when: 13, litres: 10 }).score)).toBeLessThanOrEqual(1);
});

test('the right time of day: water and weed in the cool, rest at midday, harvest dry grain once the dew is off', () => {
  expect(scoreClock([{ job: 'water', hour: 7 }])).toBe(1);
  expect(scoreClock([{ job: 'water', hour: 13 }])).toBeLessThan(0.2);
  expect(scoreClock([{ job: 'dig', hour: 13 }])).toBe(0);
  expect(scoreClock([{ job: 'transplant', hour: 17 }])).toBe(1);
  expect(scoreClock([{ job: 'spray', hour: 12 }])).toBe(0);
  expect(scoreClock([{ job: 'grain', hour: 6 }])).toBeLessThan(scoreClock([{ job: 'grain', hour: 11 }]));
  // the farm's field clock says the same
  expect(clockNow(7).work).toBe('good');
  expect(clockNow(13).work).toBe('hot');
  expect(clockNow(22).work).toBe('dark');
});

test('zaï pits: dug and fed in the dry, sown after the rain; seed in a dry pit is lost', () => {
  const pits = newPits().map(() => ({ dug: true, manure: true, seed: 'good' as const }));
  expect(scoreZai(pits).score).toBe(1);
  const early = newPits().map(() => ({ dug: true, manure: true, seed: 'early' as const }));
  expect(scoreZai(early).score).toBeCloseTo(0.7, 5);
  expect(scoreZai(early).early).toBe(early.length);
  expect(scoreZai(newPits()).score).toBe(0);
});

test('push-pull: grass round the edge and desmodium between the rows work best together', () => {
  const plant = (border?: PpPlant, gap?: PpPlant) => {
    const p: Record<number, PpPlant> = {};
    for (const i of PP_CELLS) {
      if (ppKind(i) === 'border' && border) p[i] = border;
      if (ppKind(i) === 'gap' && gap) p[i] = gap;
    }
    return p;
  };
  for (const seed of [1, 7, 42]) {
    const both = scorePushPull(plant('grass', 'desmodium'), seed);
    expect(both.score).toBe(1);
    expect(both.moths.every(m => m.fate !== 'eggs')).toBe(true);
    expect(both.striga).toBe(0);
    // one without the other leaves moths or striga through
    expect(scorePushPull(plant('grass'), seed).score).toBeLessThan(0.6);
    expect(scorePushPull(plant(undefined, 'desmodium'), seed).score).toBeLessThan(0.85);
    // the wrong way round: grass inside pulls moths in among the maize
    expect(scorePushPull(plant('desmodium', 'grass'), seed).wrong).toBeGreaterThan(0);
    expect(scorePushPull(plant('desmodium', 'grass'), seed).score).toBeLessThan(0.3);
  }
});

test('kisiki hai: keep the 3 to 5 strong stems on each stump, cut the rest', () => {
  const stumps = stumpsFor(11);
  for (const s of stumps) {
    const strong = s.filter(x => x.kind === 'strong').length;
    expect(strong).toBeGreaterThanOrEqual(3);
    expect(strong).toBeLessThanOrEqual(5);
  }
  const right = stumps.map(s => s.map(x => x.kind !== 'strong'));
  expect(scoreFmnr(stumps, right).score).toBe(1);
  // cutting nothing: crowded, weak stems kept
  expect(scoreFmnr(stumps, stumps.map(s => s.map(() => false))).score).toBeLessThan(0.5);
});

test('seed and intercropping: the best choice follows the forecast; seed in dry soil dies in a false start', () => {
  expect(bestOf('long').choice).toMatchObject({ crop: 'hybrid', when: 'onset' });
  expect(bestOf('short').choice).toMatchObject({ crop: 'dtmaize', when: 'onset' });
  expect(bestOf('false').choice).toMatchObject({ crop: 'dtmaize', when: 'onset' });
  for (const s of ['short', 'long', 'false'] as const) expect(bestOf(s).choice.partner).not.toBe('none');
  // planting into dry soil before a false start: the seed dies
  const dry = scoreSeason('false', { crop: 'dtmaize', partner: 'cowpea', when: 'dry' });
  expect(dry.result.failed).toBe(true);
  expect(dry.score).toBeLessThan(0.4);
  // three weeks late costs harvest
  expect(scoreSeason('short', { crop: 'dtmaize', partner: 'cowpea', when: 'late' }).score).toBeLessThan(0.6);
});

/* ---------------- skills, the daily drill, and the farm ---------------- */

test('a practice played: first-time pay, a better best, skill points (a few a day); the drill pays once a day', () => {
  day = '2026-11-22';
  const id = drillOf(day);
  let r = finishRun(undefined, id, 0.9, day, false);
  expect(r.first).toBe(true);
  expect(r.coins).toBe(CSA.first.coins);
  expect(r.points).toBe(CSA.first.points + 3 * CSA.starPoints);
  expect(r.drill).toBe(false);
  expect(r.csa.xp[id]).toBe(3);
  // the day's skill points are used up; the drill still pays
  r = finishRun(r.csa, id, 0.9, day, true);
  expect(r.drill).toBe(true);
  expect(r.coins).toBe(CSA.drill.coins);
  expect(r.credits).toBe(3 * CSA.drill.creditsPerStar);
  expect(r.csa.xp[id]).toBe(3);
  expect(r.csa.drill).toMatchObject({ date: day, days: 1, streak: 1 });
  // only once a day
  const again = finishRun(r.csa, id, 1, day, true);
  expect(again.drill).toBe(false);
  expect(again.coins).toBe(0);
  // the next day's drill is another practice, and the streak goes on
  const next = '2026-11-23';
  const id2 = drillOf(next);
  expect(id2).not.toBe(id);
  const r2 = finishRun(r.csa, id2, 0.7, next, true);
  expect(r2.drill).toBe(true);
  expect(r2.csa.drill.streak).toBe(2);
  // skills grow to Expert with practice
  expect(skillOf(csaOf({ xp: { water: 10 } }), 'water').name).toBe('Expert');
  expect(CSA_IDS).toHaveLength(8);
  expect(PRACTICES.every(p => p.kenya && p.westAfrica && p.steps.length >= 5)).toBe(true);
});

/** Six farms planted on the fast clock, every farm dug, sown and fed. */
function planted(cycle = 2): { t: Trial; f: Field } {
  const plan = setChoice(COMMON_PLAN, 'pest', 'scout');
  const t: Trial = { ...newTrial(cycle, false, plan), phase: 'growing', clock: 'fast', planted: 0, day: 1 };
  const f = emptyField(cycle);
  t.plans.forEach((_, i) => {
    f.marks[`${i}:prep`] = FULL;
    f.marks[`${i}:sow`] = FULL;
    const feed = needOf('setupFeed', t, i);
    if (feed) f.marks[`${i}:setupFeed`] = feed;
  });
  return { t, f };
}

test('skills help the farm: the rows draw less from the tank, and crop cover costs less', () => {
  const { t, f } = planted();
  const s = game({ trial: t, field: f });
  const before = farmsUse(s);
  expect(before).toBeGreaterThan(0);
  const skilled = { ...s, csa: { xp: { water: 10, clock: 10 } } };
  expect(waterCut(skilled.csa)).toBeCloseTo(0.25, 5);
  expect(Math.abs(farmsUse(skilled) - before * 0.75)).toBeLessThanOrEqual(1);
  // half-moons and zaï pits at Skilled: crop cover's price comes down
  const q0 = coverQuote(s);
  const smart = { ...s, csa: { xp: { halfmoon: 6, zai: 6 } } };
  expect(coverOff(smart.csa).off).toBeCloseTo(2 * CSA.coverOff.each, 5);
  const q1 = coverQuote(smart);
  expect(q1.lines.some(l => /Climate-smart skills/.test(l.label))).toBe(true);
  expect(q1.premium).toBeLessThan(q0.premium);
});

test('the field clock: a dry farm watered by hand at midday loses more water to the sun; in the cool it earns points', () => {
  // a farm that shows a drought, its fix picked, ready to water by hand
  let found: { tr: Trial; d: number } | null = null;
  for (let cycle = 2; cycle < 400 && !found; cycle++) {
    const { t } = planted(cycle);
    for (const d of [3, 4]) {
      const checks: Trial['checks'] = {};
      for (let dd = 1; dd < d; dd++) t.plans.forEach((_, i) => (checks[checkKey(i, dd)] = { right: true, tries: 1, treated: true }));
      const tr: Trial = { ...t, day: d, checks };
      if (hazardFor(tr, 0, d) === 'drought') {
        found = { tr: { ...tr, checks: { ...checks, [checkKey(0, d)]: { right: true, tries: 1, treated: false, fix: 'water' } } }, d };
        break;
      }
    }
  }
  expect(found).toBeTruthy();
  const { tr, d } = found!;
  const { f } = planted(tr.cycle);
  const full = 30_000;
  const s0 = game({ trial: tr, field: f, tank: { ...tankOf(undefined), level: full } });
  const litres = TREATMENTS.drought![0].water!;
  // no hour (the six farms screen, the older play-tests): as before
  const plain = reducer(s0, { type: 'fieldMark', farm: 0, job: `t${d}`, bits: FULL });
  expect(tankOf(plain.tank).level).toBe(full - litres);
  // at 1 pm: more lost to the sun, and said so
  const hot = reducer(s0, { type: 'fieldMark', farm: 0, job: `t${d}`, bits: FULL, hour: 13 });
  expect(hot.trial!.checks[checkKey(0, d)].treated).toBe(true);
  expect(tankOf(hot.tank).level).toBe(full - litres - Math.round(litres * CSA.hotLoss));
  expect(hot.toast?.text).toMatch(/lost to the sun/);
  expect(csaOf(hot.csa).clock.hot).toBe(1);
  // at 7 am: the water it needs, and points for the cool hours
  const cool = reducer(s0, { type: 'fieldMark', farm: 0, job: `t${d}`, bits: FULL, hour: 7 });
  expect(tankOf(cool.tank).level).toBe(full - litres);
  expect(cool.points).toBe(plain.points + CSA.coolPoints);
  expect(csaOf(cool.csa).clock.good).toBe(1);
});

test('the drill through the reducer: money, points, climate credits in the ledger, the wallet, and a badge', () => {
  day = '2026-11-22';
  const id = drillOf(day);
  const s0 = game();
  const s1 = reducer(s0, { type: 'csaDone', id, score: 1, daily: true });
  expect(s1.coins).toBe(s0.coins + CSA.first.coins + CSA.drill.coins);
  expect(csaOf(s1.csa).drill.days).toBe(1);
  expect(s1.climate.credits).toBeCloseTo(s0.climate.credits + 3 * CSA.drill.creditsPerStar, 5);
  expect(s1.climate.log[0]).toMatchObject({ where: 'csa' });
  expect(walletOf(s1.wallet).entries[0]).toMatchObject({ kind: 'reward', amount: CSA.first.coins + CSA.drill.coins });
  expect(achOfSave(s1.ach).won['first-csa']).toBeTruthy();
  expect(s1.sfx?.kind).toBe('flow');
  // again the same day: no more drill pay
  const s2 = reducer(s1, { type: 'csaDone', id, score: 1, daily: true });
  expect(s2.coins).toBe(s1.coins);
  expect(s2.climate.credits).toBe(s1.climate.credits);
});

/* ---------------- in the browser ---------------- */

type Lima = { __lima: { dispatch: (a: unknown) => void; jump: (s: Record<string, unknown>) => void; fieldHour: (h: number | null) => void } };
const jump = (page: Page, s: Record<string, unknown>) => page.evaluate(x => (window as unknown as Lima).__lima.jump(x), s);
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Climate' });

test('Climate › Climate Smart Agriculture: the eight practices, a lesson learned and the half-moons played to three stars', async ({ page }) => {
  await boot(page);
  await jump(page, { view: 'classic', coins: 5000 });
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/farm');
  await page.evaluate(() => (location.hash = '#/climate/climate-smart-agriculture'));
  await expect(dialog(page).getByRole('button', { name: 'Climate Smart Agriculture' })).toBeVisible();
  for (const p of PRACTICES) await expect(dialog(page).getByRole('button', { name: new RegExp(`^${p.name}:`) })).toBeVisible();
  await dialog(page).getByRole('button', { name: /^Half-moons:/ }).click();
  await expect(page).toHaveURL(/#\/climate\/climate-smart-agriculture\/half-moons$/);
  // learn: where it is used, and how
  await expect(dialog(page).getByText('Kajiado, Laikipia, Makueni', { exact: false })).toBeVisible();
  await expect(dialog(page).getByText('The open side faces UPHILL', { exact: false })).toBeVisible();
  await dialog(page).getByRole('button', { name: /Practise it/ }).click();
  // dig two staggered rows with the open side uphill
  for (const c of [1, 3, 5, 7, 9]) await dialog(page).getByRole('button', { name: `Contour row 1, spot ${c}: dig` }).click();
  for (const c of [2, 4, 6, 8]) await dialog(page).getByRole('button', { name: `Contour row 2, spot ${c}: dig` }).click();
  await dialog(page).getByRole('button', { name: /Let it rain/ }).click();
  await expect(dialog(page).getByText(/19 of 19 streams soaked in/)).toBeVisible();
  const moons = dialog(page).locator('.csa-moon');
  for (let i = 0; i < 9; i++) await moons.nth(i).click();
  await dialog(page).getByRole('button', { name: /Seed/ }).click();
  for (let i = 0; i < 9; i++) await moons.nth(i).click();
  await dialog(page).getByRole('button', { name: /Grow the season/ }).click();
  await dialog(page).getByRole('button', { name: 'Finish' }).click();
  await expect(dialog(page).getByLabel('3 of 3 stars')).toBeVisible();
  await expect(dialog(page).getByText('Remember:')).toBeVisible();
  const s = await state(page);
  expect(s.csa.best.halfmoon).toBe(1);
  expect(s.coins).toBe(5000 + CSA.first.coins);
  // back to the practices: the card shows its stars
  await dialog(page).getByRole('button', { name: 'All practices', exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: /^Half-moons:.*Best 3 stars/ })).toBeVisible();
});

test('every practice has an address, and opens its lesson', async ({ page }) => {
  await boot(page);
  await jump(page, { view: 'classic' });
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/farm');
  for (const p of PRACTICES) {
    expect(routeTo(game(), `/climate/climate-smart-agriculture/${p.slug}`)).toContainEqual(expect.objectContaining({ type: 'open', modal: expect.objectContaining({ kind: 'climate', tab: 'csa', practice: p.id }) }));
    await page.evaluate(h => (location.hash = h), `#/climate/climate-smart-agriculture/${p.slug}`);
    await expect(dialog(page).getByLabel(`${p.name} lesson`)).toBeVisible();
    await dialog(page).getByRole('button', { name: /Practise it/ }).click();
    await expect(dialog(page).locator('.csa-game')).toBeVisible();
  }
  // an address that is not a practice opens nothing
  expect(routeTo(game(), '/climate/climate-smart-agriculture/no-such-practice')).not.toContainEqual(expect.objectContaining({ type: 'open' }));
  expect(routeTo(game(), '/climate/emissions/half-moons')).not.toContainEqual(expect.objectContaining({ type: 'open' }));
});

test('the farm’s CLIMATE-SMART chip: the field clock, and today’s drill played from it pays once', async ({ page }) => {
  await boot(page);
  await jump(page, { view: 'world', coins: 5000 });
  await page.waitForFunction(() => !!(window as unknown as { __limaWorld?: unknown }).__limaWorld);
  await page.evaluate(() => (window as unknown as Lima).__lima.fieldHour(13));
  const chip = page.locator('.hud-csa');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('rest in shade');
  await page.evaluate(() => (window as unknown as Lima).__lima.fieldHour(7));
  await expect(chip).toContainText('water & weed');
  await chip.click();
  await expect(dialog(page).getByText('Today’s drill', { exact: true })).toBeVisible();
  // played through the reducer (the games themselves are played above): the drill is done and the chip says so
  const id = await page.evaluate(() => {
    const m = (window as unknown as { __lima: { state: GameState } }).__lima.state.modal;
    return m && m.kind === 'climate' ? m.practice : null;
  });
  expect(id).toBeTruthy();
  await page.evaluate(x => (window as unknown as Lima).__lima.dispatch({ type: 'csaDone', id: x, score: 0.9, daily: true }), id);
  await expect.poll(async () => (await state(page)).csa?.drill?.days, { timeout: 30_000 }).toBe(1);
  await page.evaluate(() => (window as unknown as Lima).__lima.dispatch({ type: 'close' }));
  await expect(chip).toContainText('✓ Climate-smart');
});
