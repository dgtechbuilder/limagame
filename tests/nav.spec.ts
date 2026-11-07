import { expect, test } from '@playwright/test';
import { boot, scenario } from './helpers';

/* Navigation: the main menu reaches every part of the game, and every screen has Back, Menu and Farm. */

const menu = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Main menu' });

test('main menu: open it, go to the Shop and Back to the menu, then Farm closes everything', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await scenario(page, 'tractor');
  await page.locator('.hud-menu').click();
  await expect(menu(page)).toBeVisible();
  for (const item of ['My farm', 'Mission', 'Field rounds', 'Tractor', 'Shop', 'Rewards', 'Farming steps', 'Settings']) await expect(menu(page).getByRole('button', { name: item, exact: true })).toBeVisible();

  // Shop from the menu: Back returns to the menu, not the farm
  await menu(page).getByRole('button', { name: 'Shop', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop).toBeVisible();
  for (const nav of ['Back', 'Main menu', 'Back to my farm']) await expect(shop.getByRole('button', { name: nav, exact: true })).toBeVisible();
  await shop.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(menu(page)).toBeVisible();

  // Field rounds from the menu: three ways out, and Back returns to the menu
  await menu(page).getByRole('button', { name: 'Field rounds', exact: true }).click();
  await expect(menu(page)).toBeHidden();
  const nav = page.locator('.navbar');
  await expect(nav.getByRole('button', { name: 'Main menu' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Back to my farm' })).toBeVisible();
  await nav.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(menu(page)).toBeVisible();

  // Farm closes the menu and lands on the farm
  await menu(page).getByRole('button', { name: 'Back to my farm', exact: true }).click();
  await expect(page.locator('dialog, [role=dialog]')).toHaveCount(0);
  await expect(page.locator('.hud-task')).toBeVisible();
});

test('Mission (six farms) has Back, Menu and Farm; Menu opens over it and Farm closes both', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await scenario(page, 'tractor');
  await page.locator('.hud-mission').click();
  const nav = page.locator('.navbar');
  await expect(nav.getByRole('button')).toHaveCount(3);
  await nav.getByRole('button', { name: 'Main menu' }).click();
  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole('button', { name: 'Back to my farm', exact: true }).click();
  await expect(page.locator('.navbar')).toHaveCount(0);
  await expect(page.locator('.hud-task')).toBeVisible();
});

test('the menu pauses a tractor drive and Farm closes it', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await scenario(page, 'tractor');
  await page.locator('.hud-task').click();
  await expect(page.locator('.tc-side')).toBeVisible();
  const nav = page.locator('.navbar');
  await expect(nav.getByRole('button')).toHaveCount(3);
  await nav.getByRole('button', { name: 'Main menu' }).click();
  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.tc-side')).toBeVisible();
  await page.locator('.tc .navbar').getByRole('button', { name: 'Back to my farm' }).click();
  await expect(page.locator('.tc-side')).toHaveCount(0);
});
