import { expect, test, type Page } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { pathOf, routeTo } from '../src/route';
import { DAYS, daysOn, isOn, nextDate } from '../src/events/days';
import { MET_BONUS, REGIONS, focusRegion, givingOf } from '../src/events/regions';
import { ORGS } from '../src/events/orgs';
import { walletOf } from '../src/wallet/model';
import { boot, state, type Win } from './helpers';

/* Special events (src/events): Happening now, Special days, Regions (gifts from the game's money) and Donate (links to
   real organisations' own sites). */

const farm = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  ...patch,
});
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Special events' });
const hash = (page: Page) => page.evaluate(() => window.location.hash);
const type = (page: Page, path: string) => page.evaluate(p => (window.location.hash = p), path);

test('the data: regions, packs, special days and organisations are sound', () => {
  expect(REGIONS.length).toBeGreaterThanOrEqual(6);
  for (const r of REGIONS) {
    expect(r.packs.length).toBe(3);
    expect(r.packs.map(p => p.price)).toEqual([...r.packs.map(p => p.price)].sort((a, b) => a - b));
    expect(r.goal).toBeGreaterThan(r.packs[2].price);
  }
  // every special day's job opens a real page
  for (const d of DAYS) {
    const go = routeTo(farm({ modal: { kind: 'events', tab: 'days' } }), d.go);
    expect(go.length, d.go).toBeGreaterThan(0);
    expect(go.some(a => a.type === 'toast'), d.go).toBe(false);
  }
  // a day is on for a week around its date, and the dates are worked out across the new year
  expect(isOn(DAYS.find(d => d.id === 'soil')!, '2026-12-03')).toBe(true);
  expect(isOn(DAYS.find(d => d.id === 'soil')!, '2026-11-20')).toBe(false);
  expect(nextDate(DAYS.find(d => d.id === 'wetlands')!, '2026-12-20')).toBe('2027-02-02');
  expect(daysOn('2026-10-16').map(d => d.id)).toEqual(expect.arrayContaining(['food', 'rural']));
  // the Kakuma event (src/events/model.ts) opens from Happening now
  expect(routeTo(farm({ modal: { kind: 'events', tab: 'now' } }), '/kakuma')).toEqual([{ type: 'open', modal: { kind: 'kakuma', tab: 'about' } }]);
  expect(ORGS.map(o => o.name)).toContain('World Food Programme');
  for (const o of ORGS) expect(o.url).toMatch(/^https:\/\/[a-z0-9.-]+\/$/);
});

test('addresses: every section and region has one', () => {
  const s = farm();
  expect(routeTo(s, '#/events')).toEqual([{ type: 'open', modal: { kind: 'events', tab: 'now' } }]);
  expect(routeTo(s, '#/events/special-days')).toEqual([{ type: 'open', modal: { kind: 'events', tab: 'days' } }]);
  expect(routeTo(s, '#/donate')).toEqual([{ type: 'open', modal: { kind: 'events', tab: 'donate' } }]);
  expect(routeTo(s, '#/regions/sahel')).toEqual([{ type: 'open', modal: { kind: 'events', tab: 'regions', region: 'sahel' } }]);
  expect(pathOf({ ...s, modal: { kind: 'events', tab: 'regions', region: 'horn' } })).toBe('/events/regions/horn-of-africa');
  expect(routeTo(s, '#/events/regions/atlantis')[0].type).toBe('toast');
  // before the farm opens only Donate can be reached
  const first = { ...initialState, farmer: { name: 'A', look: 0 } };
  expect(routeTo(first, '#/donate')).toEqual([{ type: 'open', modal: { kind: 'events', tab: 'donate' } }]);
  expect(routeTo(first, '#/events/regions')[0].type).toBe('toast');
});

test('a gift: paid from the game’s money, in the wallet, points earned, the appeal met once', () => {
  const r = REGIONS.find(x => x.id !== focusRegion().id)!;
  let s = farm({ coins: 20000 });
  const big = r.packs[2];
  s = reducer(s, { type: 'give', region: r.id, pack: big.id });
  expect(s.coins).toBe(20000 - big.price);
  expect(givingOf(s.giving).totals[r.id]).toBe(big.price);
  expect(walletOf(s.wallet).entries[0]).toMatchObject({ kind: 'giving', amount: -big.price });
  const pts = s.points;
  expect(pts).toBeGreaterThanOrEqual(big.price / 10);
  while ((givingOf(s.giving).totals[r.id] ?? 0) < r.goal) s = reducer(s, { type: 'give', region: r.id, pack: big.id });
  expect(givingOf(s.giving).met).toEqual([r.id]);
  expect(s.toast?.text).toContain('appeal met');
  expect(givingOf(s.giving).gifts[0].points).toBeGreaterThanOrEqual(MET_BONUS);
  // not enough money: nothing changes but a message
  const poor = reducer(farm({ coins: 10 }), { type: 'give', region: r.id, pack: r.packs[0].id });
  expect(poor.coins).toBe(10);
  expect(poor.toast?.text).toMatch(/You need/);
});

test('on the farm: the menu opens Special events, a region takes a gift, Donate links out', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic', coins: 20000 }));
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'open', modal: { kind: 'menu' } }));
  await page.getByRole('button', { name: /^Special events/ }).click();
  await expect(dialog(page)).toBeVisible();
  await expect.poll(() => hash(page)).toBe('#/events/happening-now');
  await expect(page.locator('.ev-row[data-event="appeal"]')).toBeVisible();
  await expect(page.locator('.ev-row[data-event="tidy"]')).toBeVisible();

  // Special days
  await page.locator('.set-tab', { hasText: 'Special days' }).click();
  await expect(page.locator('.ev-day')).toHaveCount(DAYS.length);

  // Regions: open one and give
  await page.locator('.set-tab', { hasText: 'Regions' }).click();
  await expect(page.locator('.ev-region')).toHaveCount(REGIONS.length);
  await page.getByRole('button', { name: 'Give to Southern Africa' }).click();
  await expect.poll(() => hash(page)).toBe('#/events/regions/southern-africa');
  const pack = REGIONS.find(r => r.id === 'southern')!.packs[0];
  await page.locator(`.ev-pack[data-pack="${pack.id}"] .ach-claim`).click();
  await expect(page.locator('.toast')).toContainText('Thank you');
  const s = await state(page);
  expect(s.coins).toBe(20000 - pack.price);
  expect(s.giving.totals.southern).toBe(pack.price);

  // Donate: real organisations, each a link to its own site in a new tab
  await page.locator('.set-tab', { hasText: 'Donate' }).click();
  await expect.poll(() => hash(page)).toBe('#/events/donate');
  const wfp = page.locator('.ev-org[data-org="wfp"] a.ev-donate');
  await expect(wfp).toHaveAttribute('href', 'https://www.wfp.org/');
  await expect(wfp).toHaveAttribute('target', '_blank');
  await expect(page.locator('.ev-org')).toHaveCount(ORGS.length);
  await page.screenshot({ path: 'test-results/events-donate.png' });
});
