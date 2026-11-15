import { expect, test } from '@playwright/test';
import { COUNTRIES, countryOf, money, moneyIn, moneyShort, setCountry } from '../src/money';
import { fitScale } from '../src/fit';
import { boot, state } from './helpers';

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
