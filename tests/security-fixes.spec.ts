import { expect, test } from '@playwright/test';
import { boot, type Win } from './helpers';
import { initialState, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { COMMON_PLAN, newTrial, type Trial } from '../src/trials/model';
import { tankOf } from '../src/water/model';
import type { Biz } from '../src/business/model';
import type { LifeEvent } from '../src/livestock/model';
import { activeMeasures, exposure, lightCovered, securityOf, theftNight } from '../src/security/model';

/* Security fixes: the farm's lights stand in for the solar light (not sold twice), the cash theft's text and floor,
   who found a stolen thing, the dog's food, crop and water thefts priced, and a theft shown on the PROGRESS button. */

const day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  coins: 50_000,
  life: { day: 2, started: 2, date: day },
  ...patch,
});
/** Lights that stand alone on their own panels, switched on: they count as the security light. */
const LIT = { parts: { lights: { day: 1, score: 1, option: 'own' }, switchOn: { day: 1, score: 1 } }, loads: ['lights'] } as GameState['power'];

/** The first night (of many seeds) on which this target is hit, and its events. */
function firstHit(s: GameState, target: LifeEvent['kind'] | 'any', match: RegExp, cycleDay = 0) {
  for (let n = 0; n < 2000; n++) {
    const r = theftNight(s, `seed:${n}`, cycleDay, day);
    const e = r.events.find(x => (target === 'any' || x.kind === target) && match.test(x.text));
    if (e) return { ...r, event: e };
  }
  throw new Error(`no night with ${match}`);
}

test('the farm’s lights count as the solar security light, so the light is not offered for sale', () => {
  const s = game({ power: LIT });
  expect(lightCovered(s)).toBe(true);
  expect(activeMeasures(s)).toContain('light');
  expect(lightCovered(game())).toBe(false);
});

test('a cash theft says its share (not a raw number) and never takes more than the farmer has', () => {
  const s = game({ coins: 40, security: { cash: 5000 } });
  const r = firstHit(s, 'theft', /sale’s cash/);
  expect(r.event.text).toMatch(/took \d+% of the sale’s cash/);
  expect(r.event.value).toBeLessThanOrEqual(40);
  expect(r.state.coins).toBeGreaterThanOrEqual(0);
});

test('a stolen thing found again names what found it: the GPS tracker for the diesel', () => {
  const s = game({ biz: {} as Biz, security: { owned: ['gps'] } });
  const r = firstHit(s, 'recovered', /Diesel/);
  expect(r.event.text).toMatch(/GPS tracker/);
  expect(r.event.text).not.toMatch(/community watch/);
  const cow = firstHit(game({ tank: { ...tankOf(undefined), herd: { cows: 3, hens: 0 } }, security: { owned: ['tags'] } }), 'recovered', /cow/);
  expect(cow.event.text).toMatch(/brand and ear tag/);
});

test('a guard dog whose food cannot be paid does not watch the farm that night', () => {
  const s = game({ coins: 0, tank: { ...tankOf(undefined), herd: { cows: 2, hens: 20 } }, security: { owned: ['dog'] } });
  const r = theftNight(s, 'n', 0, day);
  expect(r.paid).toBe(0);
  expect(r.events.some(e => e.kind === 'cost' && /guard dog’s food/.test(e.text))).toBe(true);
  // with the dog off tonight, the risk is what it is with no dog at all
  const fed = exposure(s, 0).find(x => x.target === 'cows')!.chance;
  const unfed = exposure(s, 0, ['dog']).find(x => x.target === 'cows')!.chance;
  expect(unfed).toBeGreaterThan(fed);
  expect(unfed).toBeCloseTo(exposure(game({ tank: s.tank }), 0).find(x => x.target === 'cows')!.chance, 9);
  // the dog stays owned: she watches again once she is fed
  expect(securityOf(r.state.security).owned).toContain('dog');
});

test('crops and water stolen are priced, so the losses add up', () => {
  const t: Trial = { ...newTrial(2, false, COMMON_PLAN), phase: 'growing', clock: 'fast', planted: 0, day: 7 };
  const crops = firstHit(game({ trial: t }), 'theft', /cobs on Farm/, 7);
  expect(crops.event.value).toBeGreaterThan(0);
  expect(securityOf(crops.state.security).totals.lost).toBeGreaterThanOrEqual(crops.event.value!);
  const water = firstHit(game({ tank: { ...tankOf(undefined), level: 9000 } }), 'theft', /drawn off the tank/);
  expect(water.event.value).toBeGreaterThan(0);
});

test('in the game: a theft last night shows on PROGRESS, and Security shows the lights doing the light’s job', async ({ page }) => {
  await boot(page);
  await page.evaluate(
    ([power]) => {
      const L = (window as unknown as Win).__lima;
      L.jump({
        view: 'classic',
        coins: 20000,
        power,
        life: { day: 3, started: 2, date: new Date().toISOString().slice(0, 10) },
        security: { reports: [{ day: 3, date: '', paid: 0, events: [{ kind: 'theft', text: '3 hens were stolen in the night.', value: 210 }] }] },
      });
    },
    [LIT] as const,
  );
  await expect(page.getByRole('button', { name: /^My Progress:.*A theft last night: see Security/ })).toBeVisible();
  await expect(page.locator('.theft-dot')).toBeVisible();
  await page.evaluate(
    ([power]) => {
      const L = (window as unknown as Win).__lima;
      L.jump({ view: 'classic', coins: 20000, power, life: { day: 9, started: 2, date: new Date().toISOString().slice(0, 10) }, modal: { kind: 'security', tab: 'protect' } });
    },
    [LIT] as const,
  );
  const light = page.locator('[data-option="light"]');
  await expect(light).toContainText('Your farm lights do this');
  await expect(light.getByRole('button')).toHaveCount(0);
});

test('Protect shows each measure as a card with a real photo of what is bought, and its credit', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', coins: 20000, life: { day: 9, started: 2, date: new Date().toISOString().slice(0, 10) }, modal: { kind: 'security', tab: 'protect' } });
  });
  const cards = page.locator('.sc-card');
  await expect(cards).toHaveCount(9); // the GPS tracker shows only with the tractor business
  for (const id of ['watch', 'locks', 'watchman', 'mpesa', 'taplock', 'tags', 'dog', 'light', 'fence']) {
    const card = page.locator(`.sc-card[data-option="${id}"]`);
    await expect(card.locator('img.rr-photo')).toHaveCount(1);
    await expect(card.locator('.rr-credit')).toContainText(/Photo: .+ · (CC|Public domain)/);
  }
  // three to a row
  const [a, b, c, d] = await Promise.all([0, 1, 2, 3].map(i => cards.nth(i).boundingBox()));
  expect(a!.y).toBeCloseTo(b!.y, 0);
  expect(b!.y).toBeCloseTo(c!.y, 0);
  expect(d!.y).toBeGreaterThan(a!.y + a!.height - 1);
  await expect(page.locator('.sc-card[data-option="watch"] .sc-cuts li')).toHaveCount(7);
});
