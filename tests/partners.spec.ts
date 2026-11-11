import { expect, test, type Page } from '@playwright/test';
import { boot, scenario, state, type Win } from './helpers';

/* Partnerships (src/partners): the PARTNERS button on the farm opens a page of ways to partner with Lima, by area.
   A partner taps Interested to build a shortlist, opens the moment in the game, and every section has an address. */

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Partnerships' });
const hash = (page: Page) => page.evaluate(() => window.location.hash);
const type = (page: Page, path: string) => page.evaluate(p => (window.location.hash = p), path);
const AREAS = ['Farm inputs', 'Tools & machines', 'Transport & market', 'Learning', 'Money & climate'];

test('the PARTNERS button sits beside SHOP on the farm and opens the page; every area has its options', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  const btn = page.getByRole('button', { name: /^Partnerships:/ });
  const shop = page.locator('.hud-shop');
  await expect(btn).toBeVisible();
  // beside Shop: same row, just to its left, and under Climate
  const [b, sh, cl] = [await btn.boundingBox(), await shop.boundingBox(), await page.locator('.hud-climate').boundingBox()];
  expect(Math.abs(b!.y - sh!.y)).toBeLessThan(4);
  expect(sh!.x - (b!.x + b!.width)).toBeLessThan(12);
  expect(Math.abs(b!.x - cl!.x)).toBeLessThan(4);

  await btn.click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading', { name: 'Partner with Lima' })).toBeVisible();
  expect(await hash(page)).toBe('#/partners/overview');

  // the ways asked for, each in its area
  const asked: [string, string][] = [
    ['Farm inputs', 'Your seed brand'],
    ['Farm inputs', 'Your fertilizer brand'],
    ['Transport & market', 'Your truck brand'],
    ['Learning', 'Your training class'],
    ['Tools & machines', 'Your hardware brand'],
    ['Tools & machines', 'Your equipment brand'],
  ];
  for (const [area, name] of asked) {
    await dialog(page).locator('.set-tab', { hasText: area }).click();
    await expect(dialog(page).getByRole('article', { name })).toBeVisible();
  }
  // every area has options, each with where players meet it and what the partner gets
  for (const area of AREAS) {
    await dialog(page).locator('.set-tab', { hasText: area }).click();
    const cards = dialog(page).locator('.pt-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    await expect(cards.first().locator('.pt-where li').first()).toBeVisible();
    await expect(cards.first().locator('.pt-gets')).not.toBeEmpty();
  }

  for (const nav of ['Back', 'Main menu', 'Back to my farm']) await expect(dialog(page).getByRole('button', { name: nav, exact: true })).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog(page)).toBeHidden();

  // the main menu has it too, and Back goes back to the menu
  await page.locator('.hud-menu').click();
  await page.getByRole('dialog', { name: 'Main menu' }).getByRole('button', { name: 'Partnerships', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Main menu' })).toBeVisible();
});

test('Interested builds a shortlist that is saved, can be taken off, and copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic' }));
  await page.getByRole('button', { name: /^Partnerships:/ }).click();

  // an empty shortlist points to the first area
  await dialog(page).locator('.set-tab', { hasText: 'Shortlist' }).click();
  await expect(dialog(page).getByText('Your shortlist is empty.')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Start with Farm inputs →' }).click();

  const seed = dialog(page).getByRole('article', { name: 'Your seed brand' });
  await seed.getByRole('button', { name: '+ Interested' }).click();
  await expect(seed.getByRole('button', { name: '✓ On my shortlist' })).toHaveAttribute('aria-pressed', 'true');
  await dialog(page).locator('.set-tab', { hasText: 'Transport & market' }).click();
  await dialog(page).getByRole('article', { name: 'Your truck brand' }).getByRole('button', { name: '+ Interested' }).click();
  await expect(dialog(page).locator('.pt-count')).toHaveText('2');
  expect((await state(page)).partnerPicks).toEqual(['seed', 'truck']);

  // saved: a reload keeps the shortlist and the section
  await dialog(page).locator('.set-tab', { hasText: 'Shortlist' }).click();
  await expect.poll(() => hash(page)).toBe('#/partners/shortlist');
  await page.waitForTimeout(800);
  await page.reload();
  await expect(dialog(page).locator('.pt-list li')).toHaveCount(2);

  await dialog(page).getByRole('button', { name: 'Copy the shortlist' }).click();
  await expect(dialog(page).getByRole('status')).toHaveText(/Copied/);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Your seed brand');
  expect(text).toContain('Your truck brand');

  await dialog(page).getByRole('button', { name: 'Take Your truck brand off the shortlist' }).click();
  await expect(dialog(page).locator('.pt-list li')).toHaveCount(1);
  expect((await state(page)).partnerPicks).toEqual(['seed']);
});

test('See it in the game opens the moment, and Back comes back to the same area', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic' }));
  await type(page, '#/partners/farm-inputs');
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'See it in the game: Your fertilizer brand' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect.poll(async () => (await state(page)).modal).toEqual({ kind: 'shop', tab: 'fertilizer' });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.set-tab.is-on')).toHaveText(/Farm inputs/);
  // and Back again closes Partnerships to the farm
  await dialog(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(async () => (await state(page)).modal).toBeNull();
});

test('every area has an address, also before the farm opens', async ({ page }) => {
  await boot(page);
  // a new player, still naming their farmer: a partner can still open the page
  expect((await state(page)).fs.phase).toBe('create');
  const areas: [string, string][] = [
    ['#/partners', 'Overview'],
    ['#/partners/farm-inputs', 'Farm inputs'],
    ['#/partners/tools-and-machines', 'Tools & machines'],
    ['#/partners/transport-and-market', 'Transport & market'],
    ['#/partners/learning', 'Learning'],
    ['#/partners/money-and-climate', 'Money & climate'],
    ['#/partners/shortlist', 'Shortlist'],
  ];
  for (const [path, tab] of areas) {
    await type(page, path);
    await expect(dialog(page).locator('.set-tab.is-on')).toHaveText(new RegExp(tab));
  }
  // the game's other screens wait for the farm
  await type(page, '#/partners/farm-inputs');
  await expect(dialog(page).getByText('Finish the first crop checks to open these screens in the game.')).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: /^See it in the game/ })).toHaveCount(0);
  // a section that does not exist leaves the player where they were
  await type(page, '#/partners/nowhere');
  await expect.poll(() => hash(page)).toBe('#/partners/farm-inputs');
});
