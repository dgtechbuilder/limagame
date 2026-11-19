import { expect, test, type Page } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { SLOTS } from '../src/partners/data';
import { AREAS, WAYS, applicationText, shortlistText } from '../src/partners/catalogue';
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
  // Funding comes first, and NIEs first in it; insurance & credit and fintech are their own categories
  expect(AREAS.map(a => a.label).slice(0, 3)).toEqual(['Funding', 'Insurance & credit', 'Fintech']);
  expect(WAYS[0].name).toBe('National Implementing Entities (NIEs)');
  expect(WAYS.filter(w => w.area === 'credit').map(w => w.id)).toEqual(expect.arrayContaining(['finance', 'insurance']));
  expect(WAYS.filter(w => w.area === 'fintech').map(w => w.id)).toEqual(['stablecoin', 'payments', 'transfer']);
  for (const w of WAYS) {
    for (const id of w.slots ?? []) expect(SLOTS.some(x => x.id === id), `${w.id}: ${id}`).toBe(true);
    if (w.see) {
      const go = routeTo(farm(), w.see.to);
      expect(go.length, w.see.to).toBeGreaterThan(0);
      expect(go.some(a => a.type === 'toast'), w.see.to).toBe(false);
    }
  }
  expect(shortlistText(['seed', 'truck'])).toContain('Truck brand');
  const text = applicationText({ t: 0, org: 'Shamba Pay', name: 'Amina', role: '', email: 'a@shambapay.example', phone: '', country: 'Kenya', website: '', area: 'fintech', ways: ['stablecoin'], message: 'Hello' });
  expect(text).toContain('Category: Fintech');
  expect(text).toContain('Ways to partner: Stablecoin wallets');
  expect(text).not.toContain('Phone:');
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
  // an application is kept, also in an older save with none
  const app = { t: 1, org: 'A', name: 'B', role: '', email: 'b@a.example', phone: '', country: 'Kenya', website: '', area: 'funding' as const, ways: ['nie'], message: 'Hi' };
  expect(reducer(s, { type: 'partnerApply', app }).partnerApps).toEqual([app]);
});

test('no status chips; Open to partner opens a form that checks its fields, then keeps the application', async ({ page }) => {
  await boot(page);
  await type(page, '#/partners/partner-with-us');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText(/in the game now/i)).toHaveCount(0);
  await expect(dialog(page).locator('.pj-status')).toHaveCount(0);
  // a category narrows the list
  await dialog(page).getByRole('button', { name: 'Fintech', exact: true }).click();
  await expect(dialog(page).locator('.pj-card')).toHaveCount(3);
  await expect(dialog(page).locator('.pj-card', { hasText: 'Stablecoin wallets' })).toBeVisible();

  // from a card's details: the form starts on its category and way
  await dialog(page).locator('.pj-card', { hasText: 'Stablecoin wallets' }).click();
  await page.getByRole('dialog', { name: 'Stablecoin wallets' }).getByRole('button', { name: 'Open to partner' }).click();
  const form = page.getByRole('dialog', { name: 'Open to partner' });
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Partnership category')).toHaveValue('fintech');
  await expect(form.getByRole('checkbox', { name: /Stablecoin wallets/ })).toBeChecked();
  // nothing filled in: it is not sent
  await form.getByRole('button', { name: 'Send application' }).click();
  await expect(form.getByText('Fill in the fields marked *')).toBeVisible();
  expect((await state(page)).partnerApps ?? []).toEqual([]);

  await form.getByLabel('Organisation').fill('Shamba Pay');
  await form.getByLabel('Your name').fill('Amina Otieno');
  await form.getByLabel('Email').fill('not-an-email');
  await form.getByLabel('Country').fill('Kenya');
  await form.getByRole('checkbox', { name: /Money transfer/ }).check();
  await form.getByLabel(/About you/).fill('We run a stablecoin wallet for smallholder farmers.');
  await form.getByRole('button', { name: 'Send application' }).click();
  await expect(form.getByText('Not an email address')).toBeVisible();
  await form.getByLabel('Email').fill('amina@shambapay.example');
  await form.getByRole('button', { name: 'Send application' }).click();
  await expect(form.getByText('Thank you, Shamba Pay')).toBeVisible();
  await expect(form.locator('.pj-summary')).toContainText('Ways to partner: Stablecoin wallets, Money transfer and remittances');
  const apps = (await state(page)).partnerApps!;
  expect(apps).toHaveLength(1);
  expect(apps[0]).toMatchObject({ org: 'Shamba Pay', email: 'amina@shambapay.example', area: 'fintech', ways: ['stablecoin', 'transfer'] });
  await form.getByRole('button', { name: 'Done' }).click();
  await expect(form).toBeHidden();
  // back on the way's details, then the list
  const way = page.getByRole('dialog', { name: 'Stablecoin wallets' });
  await expect(way).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(way).toBeHidden();
  await expect(dialog(page)).toBeVisible();

  // the button at the top opens it too, on the category shown
  await dialog(page).getByRole('button', { name: 'Funding', exact: true }).click();
  await expect(dialog(page).locator('.pj-card').first()).toContainText('National Implementing Entities');
  await dialog(page).getByRole('button', { name: 'Open to partner' }).click();
  await expect(form.getByLabel('Partnership category')).toHaveValue('funding');
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();
  await expect(dialog(page)).toBeVisible();
});

test('PARTNERS on the farm opens Partners; a way to partner goes on the shortlist, is saved, and is copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page);
  await scenario(page, 'tractor');
  // on the left, under TRACTOR
  const btn = page.locator('.hud-partners');
  const [b, tractor] = [await btn.boundingBox(), await page.locator('.hud-tractor').boundingBox()];
  expect(Math.abs(b!.x - tractor!.x)).toBeLessThan(6);
  expect(b!.y).toBeGreaterThan(tractor!.y + tractor!.height - 4);
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
