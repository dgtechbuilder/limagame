import { expect, test, type Page } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* Web addresses (src/route.ts): every page has its own address after the #. Typing one goes there if the player may,
   the browser's Back and Forward step through pages, and a reload keeps the page. */

const hash = (page: Page) => page.evaluate(() => window.location.hash);
const type = (page: Page, path: string) => page.evaluate(p => (window.location.hash = p), path);
const toast = (page: Page) => page.locator('.toast');

test('first session: each step and story page has an address, and later steps cannot be skipped to', async ({ page }) => {
  await boot(page);
  await expect.poll(() => hash(page)).toBe('#/start');

  // the farm is not open yet
  await type(page, '#/farm');
  await expect(toast(page)).toContainText('Finish checking your first crops');
  await expect.poll(() => hash(page)).toBe('#/start');

  await page.locator('.name-chip', { hasText: 'Chebet' }).click();
  await page.getByRole('button', { name: "Twende! Let's go", exact: true }).click();
  await expect.poll(() => hash(page)).toBe('#/story/1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => hash(page)).toBe('#/story/2');
  await expect(page.locator('.story-title')).toHaveText('The harvest that failed');

  // the browser's Back and Forward turn the pages
  await page.goBack();
  await expect(page.locator('.story-title')).toHaveText('A farm of my own');
  await page.goForward();
  await expect(page.locator('.story-title')).toHaveText('The harvest that failed');

  // typing a page number goes to it
  await type(page, '#/story/3');
  await expect(page.locator('.story-title')).toHaveText('What went wrong');
  await type(page, '#/story/9');
  await expect(toast(page)).toContainText('no page at that address');
  await expect.poll(() => hash(page)).toBe('#/story/3');

  await page.getByRole('button', { name: 'Start with my maize', exact: true }).click();
  await expect.poll(() => hash(page)).toBe('#/walk/maize');

  // the check comes after the walk: it cannot be typed to
  await type(page, '#/check/maize');
  await expect.poll(() => hash(page)).toBe('#/walk/maize');
  expect((await state(page)).fs.phase).toBe('walk1');

  // back to the story by address, as the Back button can
  await type(page, '#/story/1');
  await expect(page.locator('.story-title')).toHaveText('A farm of my own');

  // Settings is open during the first session, its tab is in the address, and a reload keeps the page
  await type(page, '#/settings/display');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('.set-tab.is-on')).toHaveText(/Display/);
  await page.reload();
  await expect(page.locator('.set-tab.is-on')).toHaveText(/Display/);
  await page.locator('.set-tab', { hasText: 'Help' }).click();
  await expect.poll(() => hash(page)).toBe('#/settings/help');
  await page.goBack();
  await expect(page.locator('.set-tab.is-on')).toHaveText(/Display/);
});

test('the farm: every page by address, with Back, Forward and reload', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic' }));
  await expect.poll(() => hash(page)).toBe('#/farm');

  const pages: [string, (s: any) => boolean][] = [
    ['#/menu', s => s.modal?.kind === 'menu'],
    ['#/shop/water-tanks', s => s.modal?.kind === 'shop' && s.modal.tab === 'tank'],
    ['#/steps/harvest', s => s.modal?.kind === 'steps' && s.modal.step === 'harvest'],
    ['#/climate/emissions', s => s.modal?.kind === 'climate' && s.modal.tab === 'emissions'],
    ['#/settings/my-farmer', s => s.modal?.kind === 'settings' && s.modal.tab === 'farmer'],
    ['#/rewards', s => s.modal?.kind === 'rewards'],
    ['#/results', s => s.modal?.kind === 'outcome'],
    ['#/harvest-timing', s => s.modal?.kind === 'timing'],
    ['#/rounds', s => s.roundsOpen && !s.modal],
    ['#/mission', s => s.trialsOpen && !s.roundsOpen],
    ['#/farm', s => !s.modal && !s.roundsOpen && !s.trialsOpen],
  ];
  for (const [path, shows] of pages) {
    await type(page, path);
    await expect.poll(async () => shows(await state(page)), { message: path }).toBe(true);
    expect(await hash(page)).toBe(path);
  }

  // Back steps through the pages just visited
  await page.goBack();
  await expect.poll(async () => (await state(page)).trialsOpen).toBe(true);
  await page.goBack();
  await expect.poll(async () => (await state(page)).roundsOpen).toBe(true);
  await page.goForward();
  await expect.poll(async () => (await state(page)).trialsOpen).toBe(true);

  // an address is tidied: any case, extra slashes
  await type(page, '#//Climate/ACTIVITY/');
  await expect.poll(() => hash(page)).toBe('#/climate/activity');

  // a reload keeps the page
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  expect((await state(page)).modal).toEqual({ kind: 'climate', tab: 'activity' });

  // tapping a tab changes the address
  await page.locator('.set-tab', { hasText: 'Emissions' }).click();
  await expect.poll(() => hash(page)).toBe('#/climate/emissions');

  // no such page, the finished first session, six-farm checks with nothing planted: the player stays put
  for (const [path, says] of [
    ['#/barn', 'no page at that address'],
    ['#/story/1', 'finished your first crop checks'],
    ['#/rounds/six-farms', 'no checks today'],
  ]) {
    await type(page, path);
    await expect(toast(page)).toContainText(says);
    await expect.poll(() => hash(page)).toBe('#/climate/emissions');
  }
});
