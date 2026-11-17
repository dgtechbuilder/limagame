import { expect, test, type Page } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { SLOTS } from '../src/partners/data';
import { AREAS, WAYS, shortlistText } from '../src/partners/catalogue';
import { pathOf, routeTo } from '../src/route';
import { boot, scenario, state, type Win } from './helpers';

/* Partners › Partner with us and Shortlist (src/partners/catalogue.ts, src/screens/Partners.tsx), and the PARTNERS
   button on the farm. */

const farm = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  ...patch,
});
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Partners' });
const hash = (page: Page) => page.evaluate(() => window.location.hash);
const type = (page: Page, path: string) => page.evaluate(p => (window.location.hash = p), path);

test('the catalogue: every area has ways, every placement is real, every See it opens a screen', () => {
  for (const a of AREAS) expect(WAYS.filter(w => w.area === a.id).length).toBeGreaterThanOrEqual(3);
  expect(new Set(WAYS.map(w => w.id)).size).toBe(WAYS.length);
  // the ways asked for
  for (const name of ['Seed brand', 'Fertilizer brand', 'Truck brand', 'Training courses', 'Hardware brand', 'Equipment brand']) expect(WAYS.some(w => w.name === name)).toBe(true);
  for (const w of WAYS) {
    for (const id of w.slots ?? []) expect(SLOTS.some(x => x.id === id), `${w.id}: ${id}`).toBe(true);
    if (w.see) {
      const go = routeTo(farm(), w.see.to);
      expect(go.length, w.see.to).toBeGreaterThan(0);
      expect(go.some(a => a.type === 'toast'), w.see.to).toBe(false);
    }
  }
  expect(shortlistText(['seed', 'truck'])).toContain('Truck brand');
});

test('addresses and the shortlist in the game state', () => {
  const s = farm();
  expect(routeTo(s, '#/partners/partner-with-us')).toEqual([{ type: 'open', modal: { kind: 'partners', tab: 'join' } }]);
  expect(routeTo(s, '#/partners/shortlist')).toEqual([{ type: 'open', modal: { kind: 'partners', tab: 'shortlist' } }]);
  expect(routeTo(s, '#/partners/partner-with-us/rutuba')[0]).toMatchObject({ type: 'toast' });
  expect(pathOf({ ...s, modal: { kind: 'partners', tab: 'join' } })).toBe('/partners/partner-with-us');
  // a partner can open the page before the farm opens
  expect(routeTo(initialState, '#/partners/partner-with-us')).toEqual([{ type: 'open', modal: { kind: 'partners', tab: 'join' } }]);
  // Interested, then again: on and off the shortlist
  const one = reducer(s, { type: 'partnerPick', id: 'seed' });
  expect(one.partnerPicks).toEqual(['seed']);
  expect(reducer(one, { type: 'partnerPick', id: 'seed' }).partnerPicks).toEqual([]);
  // an older save with no shortlist
  expect(reducer({ ...s, partnerPicks: undefined }, { type: 'partnerPick', id: 'truck' }).partnerPicks).toEqual(['truck']);
});

test('PARTNERS on the farm opens Partners; a way to partner goes on the shortlist, is saved, and is copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page);
  await scenario(page, 'tractor');
  // left of WATER, under PROGRESS
  const btn = page.locator('.hud-partners');
  const [b, water, progress] = [await btn.boundingBox(), await page.locator('.hud-water').boundingBox(), await page.locator('.hud-progress').boundingBox()];
  expect(Math.abs(b!.y - water!.y)).toBeLessThan(6);
  expect(water!.x).toBeGreaterThan(b!.x + b!.width - 4);
  expect(Math.abs(b!.x - progress!.x)).toBeLessThan(6);
  await btn.click();
  await expect(dialog(page)).toBeVisible();
  expect(await hash(page)).toBe('#/partners/offers');

  await dialog(page).locator('.set-tab', { hasText: 'Partner with us' }).click();
  await expect.poll(() => hash(page)).toBe('#/partners/partner-with-us');
  await expect(dialog(page).locator('.pj-card')).toHaveCount(WAYS.length);
  // an area narrows the list
  await dialog(page).getByRole('button', { name: 'Transport & market' }).click();
  await expect(dialog(page).locator('.pj-card')).toHaveCount(WAYS.filter(w => w.area === 'market').length);

  // a card opens its details; Interested puts it on the shortlist
  await dialog(page).locator('.pj-card', { hasText: 'Truck brand' }).click();
  const sheet = page.getByRole('dialog', { name: 'Truck brand' });
  await expect(sheet.getByText('Where players meet it')).toBeVisible();
  await sheet.getByRole('button', { name: '+ Interested' }).click();
  await expect(sheet.getByRole('button', { name: '✓ On my shortlist' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(dialog(page)).toBeVisible();
  expect((await state(page)).partnerPicks).toEqual(['truck']);

  // saved: a reload keeps it
  await dialog(page).locator('.set-tab', { hasText: 'Shortlist' }).click();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(dialog(page).locator('.pj-list li')).toHaveCount(1);
  await dialog(page).getByRole('button', { name: 'Copy the shortlist' }).click();
  await expect(dialog(page).getByRole('status')).toHaveText(/Copied/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Truck brand');
  await dialog(page).getByRole('button', { name: 'Take Truck brand off the shortlist' }).click();
  await expect(dialog(page).getByText('Your shortlist is empty')).toBeVisible();
});

test('See it in the game opens the screen a way to partner is about', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic' }));
  await page.getByRole('button', { name: /^Partners:/ }).click();
  await type(page, '#/partners/partner-with-us');
  await dialog(page).locator('.pj-card', { hasText: 'Fertilizer brand' }).click();
  const sheet = page.getByRole('dialog', { name: 'Fertilizer brand' });
  await expect(sheet.getByText(/Held today by Rutuba Gold/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Open the fertilizer shop ›' }).click();
  await expect.poll(() => hash(page)).toBe('#/shop/fertilizer');
});

test('before the farm opens, a partner can read the ways to partner, without links into the game', async ({ page }) => {
  await boot(page);
  expect((await state(page)).fs.phase).toBe('create');
  await type(page, '#/partners/partner-with-us');
  await expect(dialog(page)).toBeVisible();
  await dialog(page).locator('.pj-card', { hasText: 'Fertilizer brand' }).click();
  await expect(page.getByRole('dialog', { name: 'Fertilizer brand' }).getByRole('button', { name: '+ Interested' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Fertilizer brand' }).getByRole('button', { name: /fertilizer shop/ })).toHaveCount(0);
});
