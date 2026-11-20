import { expect, test } from '@playwright/test';
import { COUNTRIES, countryOf, money, moneyIn, moneyShort, setCountry, withMoney } from '../src/money';
import { fitScale } from '../src/fit';
import { boot, closeCheer, plantByHand, signStory, state, type Win } from './helpers';

/* The country step: where the player farms sets the currency every amount is shown in. The stored amounts, and so
   the game's maths, do not change. And the stage fit: it fills the space the page has. */

test.afterEach(() => setCountry(''));

test('money is shown in the currency of the country picked; with none it is US dollars', () => {
  setCountry('');
  expect(money(30000)).toBe('$2,326');
  setCountry('KE');
  // a stored amount is 10 Kenyan shillings, so Kenya sees the game's own shilling prices
  expect(money(30000)).toBe('KSh 300,000');
  expect(money(40)).toBe('KSh 400');
  expect(money(-40)).toBe('−KSh 400');
  setCountry('NG');
  expect(money(129)).toBe('₦15,300');
  setCountry('ZA');
  expect(money(40)).toBe('R55.81');
  setCountry('UG');
  expect(moneyShort(30000)).toBe('USh 8.5M');
  setCountry('KE');
  expect(moneyShort(30000)).toBe('KSh 300k');
  expect(moneyShort(40)).toBe('KSh 400');
  // an unknown code is "somewhere else": US dollars
  expect(countryOf('XX').currency.code).toBe('USD');
  expect(moneyIn(129, countryOf('GH').currency)).toBe('GH₵ 120');
  expect(new Set(COUNTRIES.map(c => c.id)).size).toBe(COUNTRIES.length);
});

test('money written once in data is shown in the currency picked when it is drawn, not the one at load', () => {
  setCountry('');
  expect(withMoney('Earn {money:1000}')).toBe('Earn $77.52');
  setCountry('KE');
  expect(withMoney('Earn {money:1000}')).toBe('Earn KSh 10,000');
  expect(withMoney('From {money:300} to {money:500}, {name}')).toBe('From KSh 3,000 to KSh 5,000, {name}');
});

/** Every screen with an address (src/route.ts), for a player past the first session. */
const SCREENS = [
  '/farm', '/menu', '/mission', '/rounds',
  ...['my-farmer', 'game', 'display', 'help'].map(t => `/settings/${t}`),
  ...['overview', 'land-and-pay', 'farm-areas', 'emissions', 'water-and-soil', 'shocks', 'activity'].map(t => `/climate/${t}`),
  ...['journey', 'modules', 'today', 'badges', 'certificates'].map(t => `/progress/${t}`),
  '/partners/offers', '/partners/placements', '/partners/partner-with-us', '/partners/shortlist',
  ...['food', 'fertilizer', 'water-tanks', 'equipment'].map(t => `/shop/${t}`),
  ...['land-prep', 'planting', 'fertilizer', 'pesticides', 'water', 'harvest'].map(t => `/steps/${t}`),
  '/loan-calculator', '/loan-calculator/quote',
  ...['welcome', 'sale', 'storage', 'harvest-timing', 'value-addition', 'process', 'farm-info', 'results', 'rewards', 'training'].map(t => `/${t}`),
  ...['history', 'climate-payments', 'summary'].map(t => `/wallet/${t}`),
  ...['build', 'today', 'impact', 'history'].map(t => `/power/${t}`),
  '/market', '/greenhouse/bed-1', '/greenhouse/bed-4', '/storehouse/store', '/storehouse/harvest', '/storehouse/produce', '/animals/cow-shed',
];

/** The page's words, with its labels and tool tips, and any US dollar amount in them. */
const dollars = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const labels = [...document.querySelectorAll('[aria-label],[title]')].map(e => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`);
    return [document.body.innerText, ...labels].join(' ').match(/.{0,30}\$.{0,20}/g) ?? [];
  });

test('once Kenya is picked, no screen shows US dollars', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(() => {
    const lima = (window as unknown as Win).__lima;
    lima.jump({ coins: 30000, level: 9, settings: { ...lima.state.settings, country: 'KE' } });
  });
  await expect.poll(async () => (await state(page)).settings.country).toBe('KE');
  for (const path of SCREENS) {
    await page.evaluate(p => (window.location.hash = p), path);
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#${path}`);
    await page.waitForTimeout(300);
    expect(await dollars(page), path).toEqual([]);
  }
  // the badges' goals were written when the game loaded, before a country was picked
  await page.evaluate(() => (window.location.hash = '/progress/badges'));
  await expect(page.getByText('Earn KSh 10,000', { exact: true })).toBeVisible();
  // the tractor business, each tab (its partners' offers were written at load too)
  await page.evaluate(() => (window.location.hash = '/tractor-business'));
  await page.getByRole('dialog', { name: 'Welcome to the Narok hub' }).getByRole('button', { name: /^Let.s go$/ }).click();
  for (const tab of ['Today', 'Hub', 'Calendar', 'Partners', 'Fleet']) {
    await page.getByRole('tab', { name: tab }).click();
    expect(await dollars(page), tab).toEqual([]);
  }
  await page.getByRole('tab', { name: 'Partners' }).click();
  await expect(page.locator('.biz-card', { hasText: 'County Roads Office' })).toContainText('KSh 120,000');
});

test("the story's last season is told in the currency picked a step before", async ({ page }) => {
  await boot(page);
  await page.locator('.name-chip', { hasText: 'Otieno' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio', { name: /Kenya/ }).click();
  await page.getByRole('button', { name: "Twende! Let's go", exact: true }).click();
  await signStory(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('.story-step', { hasText: 'Plant the season' }).click();
  await plantByHand(page);
  await closeCheer(page, /^Well done/);
  await expect(page.locator('.story-caption')).toHaveText('Seed, fertiliser and labour went in: KSh 95,000 spent.');
  expect(await dollars(page)).toEqual([]);
});

test('the stage fills a phone held either way up and keeps a margin on a large screen', () => {
  // iPhone landscape with Safari's toolbars: the height is what limits it, edge to edge
  expect(fitScale(932, 366)).toBeCloseTo(366 / 402, 5);
  // a laptop: a small margin, not the stage at its drawn size
  expect(fitScale(1440, 820) * 874).toBeGreaterThan(1380);
  expect(fitScale(1440, 820) * 874).toBeLessThanOrEqual(1440);
  // the stage is never drawn at zero or less, however small the window
  expect(fitScale(0, 0)).toBeGreaterThan(0);
});

test('the country step sets the currency, and Settings can change it later', async ({ page }) => {
  await boot(page);
  await page.locator('.name-chip', { hasText: 'Otieno' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio', { name: /Kenya/ }).click();
  await expect(page.locator('.country-note')).toContainText('Kenyan shillings');
  await expect(page.locator('.country-note')).toContainText('KSh 300,000');
  // Back keeps the name; the step comes back with Kenya still picked
  await page.getByRole('button', { name: '‹ Back' }).click();
  await expect(page.locator('#farmer-name')).toHaveValue('Otieno');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('radio', { name: /Kenya/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: "Twende! Let's go", exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('story');
  expect((await state(page)).settings.country).toBe('KE');

  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.getByRole('button', { name: 'Game' }).click();
  await expect(page.getByText('Money is shown in Kenyan shillings: you have KSh 300,000.')).toBeVisible();
  await page.getByLabel('Country').selectOption('NG');
  await expect(page.getByText('Money is shown in Nigerian naira')).toBeVisible();
  expect((await state(page)).settings.country).toBe('NG');
});
