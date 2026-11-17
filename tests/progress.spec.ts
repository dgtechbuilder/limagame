import { expect, test } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { achOfSave, initialAch, unclaimed } from '../src/achievements/model';
import { achClock, viewOf } from '../src/achievements/track';
import { LEVELS, MODULES, currentLevel, dueLevels, moduleCredits, moduleMax, totalCredits } from '../src/progress/model';
import { BRANDS, SLOTS, brandOf, offerCode, slotBrand } from '../src/partners/data';
import { pathOf, routeTo } from '../src/route';
import { boot, state, type Win } from './helpers';

/* My Progress (certification levels over the first days and weeks, learning credits by module) and the partner
   placements (branded products, offers, addresses), without a browser; then the PROGRESS button and the Partners
   page in the game. */

let day = '2026-11-13';
achClock.today = () => day;

const farm = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  coins: 5000,
  points: 0,
  ach: { ...initialAch, won: { welcome: { date: '2026-11-01', claimed: true } } },
  ...patch,
});
const view = (s: GameState) => {
  const a = achOfSave(s.ach);
  const v = viewOf(s, a, day);
  return { ach: a, v, courses: v.courses };
};
const task = (id: string): Parameters<typeof reducer>[1] => ({ type: 'task', step: 'landprep', id, price: 40, name: id });

test('credits: badges pay into their module, courses into Courses', () => {
  day = '2026-11-13';
  let s = farm();
  expect(moduleCredits('daily', view(s))).toBe(1); // the welcome badge
  s = reducer(s, task('clearing'));
  expect(moduleCredits('farm', view(s))).toBe(1);
  s = reducer(s, { type: 'bookTraining', id: 'soil' });
  expect(moduleCredits('courses', view(s))).toBe(5);
  expect(totalCredits(view(s))).toBe(7);
  // every module has credits to earn
  for (const m of MODULES) expect(moduleMax(m.id)).toBeGreaterThan(0);
});

test('Level 1 on day one: a certificate, and a reward that waits to be claimed once', () => {
  day = '2026-11-13';
  let s = reducer(farm(), task('clearing'));
  // the welcome and one day-one badge: 2 credits, short of the 3 Level 1 asks
  expect(currentLevel(achOfSave(s.ach)).level).toBeNull();
  s = reducer(s, { type: 'collect', id: 'milk', coins: 30, text: 'milk' });
  // two day-one badges and the welcome: 3 credits in two modules
  const a = achOfSave(s.ach);
  expect(a.levels['level-1']).toEqual({ date: day, claimed: false });
  expect(a.certs.find(c => c.id === 'level-1')?.kind).toBe('level');
  expect(s.award?.title).toContain('Level 1');
  expect(currentLevel(a).level?.n).toBe(1);
  // nothing paid until claimed
  const before = { coins: s.coins, points: s.points };
  expect(unclaimed(a, day)).toBeGreaterThan(0);
  const c = reducer(s, { type: 'levelClaim', id: 'level-1' });
  expect(c.coins).toBe(before.coins + LEVELS[0].coins);
  expect(c.points).toBe(before.points + LEVELS[0].points);
  expect(reducer(c, { type: 'levelClaim', id: 'level-1' })).toBe(c);
  // Claim all takes the level too
  const all = reducer(s, { type: 'achClaimAll' });
  expect(achOfSave(all.ach).levels['level-1'].claimed).toBe(true);
});

test('a level opens on its day: credits alone do not unlock it early, and levels come in order', () => {
  day = '2026-11-13';
  // plenty of credits on the very first day: many badges won across modules
  const won = Object.fromEntries(['first-task', 'first-buy', 'chores', 'first-read', 'first-plant', 'first-check', 'first-drive', 'first-biz', 'tasks-bronze', 'rounds-bronze', 'drives-bronze'].map(id => [id, { date: day, claimed: true }]));
  let s = farm({ ach: { ...initialAch, won: { ...won, welcome: { date: day, claimed: true } } } });
  s = reducer(s, task('clearing'));
  let a = achOfSave(s.ach);
  expect(a.days).toBe(1);
  expect(a.levels['level-1']).toBeTruthy();
  expect(a.levels['level-2']).toBeUndefined();
  expect(dueLevels(view(s))).toEqual([]);
  // the next day, Level 2 opens
  day = '2026-11-14';
  s = reducer(s, task('tilling'));
  a = achOfSave(s.ach);
  expect(a.levels['level-2']).toBeTruthy();
  // Level 3 waits for day 4
  expect(a.levels['level-3']).toBeUndefined();
});

test('branded fertilizer does the NPK job, and a saved offer goes to Messages', () => {
  day = '2026-11-13';
  let s = farm({ stage: 2 });
  s = reducer(s, { type: 'buy', id: 'rutuba-npk', price: 36, name: 'Rutuba Gold NPK' });
  expect(s.inventory).toContain('rutuba-npk');
  const coins = s.coins;
  s = reducer(s, { type: 'task', step: 'fertilizer', id: 'f-npk', price: 40, name: 'Balance NPK' });
  expect(s.coins).toBe(coins); // used from the shop: no second payment
  expect(s.inventory).not.toContain('rutuba-npk');
  const o = reducer(s, { type: 'partnerSave', id: 'rutuba' });
  expect(o.offers).toEqual(['rutuba']);
  expect(o.note).toContain('Rutuba Gold');
  // the code is the player's own, the same each time it is worked out, and kept in Messages
  const code = offerCode('rutuba', o.farmer?.name);
  expect(code).toMatch(/^RUTU-[2-9A-HJKMNP-Z]{4}$/);
  expect(offerCode('rutuba', o.farmer?.name)).toBe(code);
  expect(offerCode('rutuba', 'Someone else')).not.toBe(code);
  expect(o.note).toContain(code);
  expect(reducer(o, { type: 'partnerSave', id: 'rutuba' })).toBe(o);
});

test('partners: every slot names a real brand or is open, and every brand but the tractor partner is a sample', () => {
  for (const x of SLOTS) if (x.brand) expect(brandOf(x.brand)).toBeTruthy();
  expect(SLOTS.some(x => !x.brand)).toBe(true);
  expect(BRANDS.filter(b => !b.sample).map(b => b.id)).toEqual(['hello-tractor']);
  expect(slotBrand('world-tractor')?.name).toBe('Hello Tractor');
});

test('addresses: My Progress and Partners, and the old achievements address', () => {
  const s = farm();
  const go = (path: string) => routeTo(s, path);
  expect(go('#/progress')).toEqual([{ type: 'open', modal: { kind: 'achievements', tab: 'journey' } }]);
  expect(go('#/achievements/badges')).toEqual([{ type: 'open', modal: { kind: 'achievements', tab: 'badges' } }]);
  expect(go('#/partners/offers/rutuba')).toEqual([{ type: 'open', modal: { kind: 'partners', tab: 'offers', brand: 'rutuba' } }]);
  expect(go('#/partners/placements')).toEqual([{ type: 'open', modal: { kind: 'partners', tab: 'placements' } }]);
  expect(go('#/partners/offers/nobody')[0]).toMatchObject({ type: 'toast' });
  expect(pathOf({ ...s, modal: { kind: 'achievements' } })).toBe('/progress/journey');
  expect(pathOf({ ...s, modal: { kind: 'partners', tab: 'offers', brand: 'kinga' } })).toBe('/partners/offers/kinga');
});

test('the PROGRESS button opens the journey; a partner sign opens its offer', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic', coins: 5000, points: 0 }));
  await page.getByRole('button', { name: /^My Progress: / }).click();
  await expect(page.locator('.set-title-bar')).toContainText('My Progress · Journey');
  await expect(page.locator('.pg-step')).toHaveCount(LEVELS.length);
  await page.getByRole('button', { name: 'Modules', exact: true }).click();
  await expect(page.locator('.pg-module')).toHaveCount(MODULES.length);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  // the classic farm's partner sign
  await page.getByRole('button', { name: /^Partner sign: / }).click();
  await expect(page.locator('.set-title-bar')).toContainText('Partners · Offers');
  await expect(page).toHaveURL(/#\/partners\/offers\/[a-z-]+$/);
  // the sign opens its offer's sheet: what it gives, then the code once it is taken
  const sheet = page.getByRole('dialog', { name: / offer$/ });
  await expect(sheet).toContainText('What you get');
  await sheet.getByRole('button', { name: 'Get this offer', exact: true }).click();
  await expect.poll(async () => ((await state(page)).offers ?? []).length).toBe(1);
  await expect(sheet.locator('.pt-voucher')).toContainText('Saved to Messages');
  await sheet.getByRole('button', { name: 'Back to offers', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('.pt-card.is-focus .pt-code')).toBeVisible();
  await page.getByRole('button', { name: 'Placements', exact: true }).click();
  await expect(page.locator('.pt-table tbody tr').first()).toBeVisible();
  await expect(page.locator('.pt-open').first()).toHaveText('Available');
});

test('Get offer: the details, then the code, then Use it opens where the offer is used', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ coins: 5000 }));
  await expect.poll(async () => (await state(page)).fs.phase).toBe('done');
  await page.evaluate(() => (window.location.hash = '/partners/offers'));
  const card = page.locator('.pt-card[data-brand="tangi"]');
  await card.getByRole('button', { name: 'Get the Tangi Tanks offer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Tangi Tanks offer' });
  for (const line of brandOf('tangi')!.offer.get) await expect(sheet).toContainText(line);
  // Not now leaves it, and Escape closes only the sheet
  await sheet.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(sheet).toBeHidden();
  await card.getByRole('button', { name: 'Get the Tangi Tanks offer' }).click();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page.locator('.set-title-bar')).toContainText('Partners · Offers');
  expect((await state(page)).offers ?? []).toEqual([]);
  // taken: the code shows on the sheet and the card, and goes into Messages
  await card.getByRole('button', { name: 'Get the Tangi Tanks offer' }).click();
  await sheet.getByRole('button', { name: 'Get this offer', exact: true }).click();
  const s = await state(page);
  const code = offerCode('tangi', s.farmer?.name);
  expect(s.offers).toEqual(['tangi']);
  expect(s.note).toContain(code);
  await expect(sheet.locator('.pt-voucher b')).toHaveText(code);
  await expect(page.locator('.set-tab', { hasText: 'Offers' })).toContainText('1 got');
  // Use it goes where the offer is used: the Shop's water tanks
  await sheet.getByRole('button', { name: 'Open the water-tank shop ›' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/shop/water-tanks');
  // back on the page, the card has the code and Use it
  await page.evaluate(() => (window.location.hash = '/partners/offers'));
  await expect(card.locator('.pt-code')).toHaveText(`✓ ${code}`);
  await card.getByRole('button', { name: 'Use it ›' }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/shop/water-tanks');
});

test('every offer says what it gives and goes to an address the game has', () => {
  const s: GameState = { ...initialState, fs: { ...initialState.fs, phase: 'done' } } as GameState;
  for (const b of BRANDS) {
    expect(b.offer.get.length, b.id).toBeGreaterThan(0);
    const acts = routeTo(s, b.offer.use.to);
    expect(acts.length, b.id).toBeGreaterThan(0);
    expect(acts.some(a => a.type === 'toast'), `${b.id}: ${b.offer.use.to}`).toBe(false);
  }
});
