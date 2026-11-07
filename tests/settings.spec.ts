import { expect, test, type Page } from '@playwright/test';
import { boot, scenario, state } from './helpers';

/* Settings: a full page whose every control changes the game at once and is kept on this device. */

const page$ = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await expect(page$(page)).toBeVisible();
};
const section = async (page: Page, name: string) => page$(page).getByRole('button', { name, exact: true }).click();
const choose = (page: Page, group: string, option: string) => page$(page).getByRole('radiogroup', { name: group }).getByRole('radio', { name: option, exact: true }).click();

test('Settings: four sections with Back, Menu and Farm; Back returns to the farm', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  await openSettings(page);
  for (const s of ['My farmer', 'Game', 'Display', 'Help & data']) await expect(page$(page).getByRole('button', { name: s, exact: true })).toBeVisible();
  for (const nav of ['Back', 'Main menu', 'Back to my farm']) await expect(page$(page).getByRole('button', { name: nav, exact: true })).toBeVisible();
  await page$(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page$(page)).toBeHidden();
  await expect(page.locator('.hud-task')).toBeVisible();
});

test('Character style: retro anime by default, Original brings back the old art, and it is saved', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  expect((await state(page)).settings.art).toBe('anime');
  // the HUD portrait is the anime bust
  await expect(page.locator('.hud-avatar .anime-art, .anime-art').first()).toBeVisible();

  await openSettings(page);
  await section(page, 'Game');
  await choose(page, 'Character style', 'Original');
  await expect.poll(async () => (await state(page)).settings.art).toBe('original');
  await expect(page$(page).getByRole('radio', { name: 'Original', exact: true })).toHaveAttribute('aria-checked', 'true');

  // kept after a reload, and the farm comes back in the original style (no anime art on the farm)
  await boot(page, false);
  expect((await state(page)).settings.art).toBe('original');
  await page.waitForFunction(() => !!(window as unknown as { __limaWorld?: unknown }).__limaWorld);
  await expect(page.locator('.anime-art')).toHaveCount(0);

  await openSettings(page);
  await section(page, 'Game');
  await choose(page, 'Character style', 'Retro anime');
  await expect.poll(async () => (await state(page)).settings.art).toBe('anime');
});

test('My farmer: rename and change look, shown at once', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  await openSettings(page);
  await section(page, 'My farmer');
  const name = page$(page).getByLabel('Name', { exact: true });
  await name.fill('Juma');
  await page$(page).getByRole('button', { name: 'Save name', exact: true }).click();
  await expect.poll(async () => (await state(page)).farmer.name).toBe('Juma');
  await page$(page).getByRole('radio', { name: 'Look 3', exact: true }).click();
  await expect.poll(async () => (await state(page)).farmer.look).toBe(2);
  await expect(page$(page).getByRole('radio', { name: 'Look 3', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('Display: graphics, reduce motion; Game: farm view stays in Settings', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  await openSettings(page);
  await section(page, 'Display');
  await choose(page, 'Graphics', 'Low');
  await expect.poll(async () => (await state(page)).settings.graphics).toBe('low');
  await choose(page, 'Reduce motion', 'On');
  await expect.poll(async () => (await state(page)).settings.reduceMotion).toBe(true);
  await expect(page.locator('.stage')).toHaveClass(/reduce-motion/);

  await section(page, 'Game');
  await choose(page, 'Farm view', 'Classic');
  await expect.poll(async () => (await state(page)).view).toBe('classic');
  await expect(page$(page)).toBeVisible();
  await choose(page, 'Farm view', '3D farm');
  await expect.poll(async () => (await state(page)).view).toBe('world');
});

test('Read aloud can be switched on and off', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  await openSettings(page);
  await section(page, 'Game');
  await choose(page, 'Read aloud', 'On');
  await expect.poll(async () => (await state(page)).settings.voice).toBe(true);
  await choose(page, 'Read aloud', 'Off');
  await expect.poll(async () => (await state(page)).settings.voice).toBe(false);
});

test('Reset progress starts again but keeps the settings', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  await openSettings(page);
  await section(page, 'Game');
  await choose(page, 'Character style', 'Original');
  await section(page, 'Help & data');
  await page$(page).getByRole('button', { name: 'Reset', exact: true }).click();
  await page$(page).getByRole('button', { name: 'Yes, erase', exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('create');
  const s = await state(page);
  expect(s.farmer).toBeNull();
  expect(s.settings.art).toBe('original');
});
