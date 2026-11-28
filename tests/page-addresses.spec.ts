import { expect, test, type Page } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* Every page has its own address (src/route.ts), and Back goes somewhere sensible: to the page it was opened from, or,
   for one thing inside a page reached by its address, up to that page's list. */

const hash = (page: Page) => page.evaluate(() => window.location.hash);
const type = (page: Page, path: string) => page.evaluate(p => (window.location.hash = p), path);
const open = (page: Page, modal: unknown) => page.evaluate(m => (window as unknown as Win).__lima.dispatch({ type: 'open', modal: m } as never), modal);
const back = (page: Page) => page.locator('.navbar').last().getByRole('button', { name: 'Back', exact: true }).click();

async function farm(page: Page) {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic', coins: 20000 }));
  await expect.poll(() => hash(page)).toBe('#/farm');
}

test('a farm check has its own address; Back goes up to Farm checks, then to the farm', async ({ page }) => {
  await farm(page);
  await type(page, '#/farm-checks/water');
  await expect(page.getByRole('dialog', { name: 'Examine the water setup' })).toBeVisible();
  expect((await state(page)).modal).toEqual({ kind: 'checks', subject: 'water' });

  // a reload keeps the check open
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  await expect(page.getByRole('dialog', { name: 'Examine the water setup' })).toBeVisible();

  // Back from the check: the list of checks, then the farm
  await page.keyboard.press('Escape');
  await expect.poll(() => hash(page)).toBe('#/farm-checks');
  await expect(page.getByRole('dialog', { name: 'Farm checks' })).toBeVisible();
  await back(page);
  await expect.poll(() => hash(page)).toBe('#/farm');

  // a check opened from the list: Back returns to the list
  await type(page, '#/farm-checks');
  await page.getByRole('button', { name: /Examine the plant/ }).click();
  await expect.poll(() => hash(page)).toBe('#/farm-checks/plant');
  await page.keyboard.press('Escape');
  await expect.poll(() => hash(page)).toBe('#/farm-checks');
});

test('a page opened from another page: Back returns to that page, and the browser Back agrees', async ({ page }) => {
  await farm(page);
  await type(page, '#/animals/water');
  await expect.poll(async () => (await state(page)).modal?.kind).toBe('animals');
  // the water check, as the Animals page's own link opens it
  await open(page, { kind: 'checks', subject: 'water' });
  await expect.poll(() => hash(page)).toBe('#/farm-checks/water');
  await expect(page.getByRole('dialog', { name: 'Examine the water setup' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => hash(page)).toBe('#/animals/water');
  await back(page);
  await expect.poll(() => hash(page)).toBe('#/farm');

  // the same trip, back with the browser: the in-game Back then leaves Animals for the farm (no loop)
  await type(page, '#/animals/water');
  await open(page, { kind: 'checks', subject: 'water' });
  await expect.poll(() => hash(page)).toBe('#/farm-checks/water');
  await page.goBack();
  await expect.poll(() => hash(page)).toBe('#/animals/water');
  await back(page);
  await expect.poll(() => hash(page)).toBe('#/farm');

  // the Market page → the stall played: Back returns to the market
  await type(page, '#/market');
  await open(page, { kind: 'serve', shop: 'market' });
  await expect.poll(() => hash(page)).toBe('#/serve/market');
  await page.locator('.sf-back').click();
  await expect.poll(() => hash(page)).toBe('#/market');

  // a region reached by its address from the farm: Back goes up to the list of regions
  await type(page, '#/farm');
  await expect.poll(() => hash(page)).toBe('#/farm');
  await type(page, '#/events/regions/southern-africa');
  await expect.poll(async () => (await state(page)).modal?.region).toBe('southern');
  await back(page);
  await expect.poll(() => hash(page)).toBe('#/events/regions');
});

test('Mission and the tractor business keep their sections in the address', async ({ page }) => {
  await farm(page);

  // Mission's sustainability section
  await type(page, '#/mission/sustainability');
  await expect.poll(async () => (await state(page)).trialsTab).toBe('sustain');
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  await expect.poll(async () => (await state(page)).trialsTab).toBe('sustain');
  await back(page);
  await expect.poll(() => hash(page)).toBe('#/mission');
  await type(page, '#/farm');
  await expect.poll(() => hash(page)).toBe('#/farm');

  // the tractor business's sections
  await type(page, '#/tractor-business/hub');
  await expect.poll(async () => (await state(page)).bizTab).toBe('hub');
  // Sasha's welcome, the first time
  await page.getByRole('button', { name: "Let's go", exact: true }).click();
  await page.locator('.set-tab', { hasText: 'Calendar' }).click();
  await expect.poll(() => hash(page)).toBe('#/tractor-business/calendar');
  await page.goBack();
  await expect.poll(async () => (await state(page)).bizTab).toBe('hub');
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  await expect.poll(async () => (await state(page)).bizTab).toBe('hub');

  // a section that is not there
  await type(page, '#/tractor-business/garage');
  await expect(page.locator('.toast')).toContainText('no page at that address');
  await expect.poll(() => hash(page)).toBe('#/tractor-business/hub');
});
