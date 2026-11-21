import { expect, test } from '@playwright/test';
import { boot, type Win } from './helpers';

/* The farm's HUD: no Power, Business, Animals or Security buttons on the farm. The tractor business is a module of the
   tractor screen; Animals and Security sit in My Progress; the day of the 30-day farming period sits beside the money. */

test('the farm HUD: business in the tractor screen, animals and security in My Progress, the day out of 30', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);

  for (const gone of ['.hud-power', '.hud-biz', '.hud-animals', '.hud-security']) await expect(page.locator(gone)).toHaveCount(0);

  // the day out of the farming period, beside the money
  const day = page.getByRole('button', { name: 'Day 4 of the 30-day farming period' });
  await expect(day).toHaveText('Day\u00a04/30');
  const [d, cash] = await Promise.all([day.boundingBox(), page.locator('.hud-pill').first().boundingBox()]);
  expect(Math.abs(d!.y - cash!.y)).toBeLessThan(4);
  expect(d!.x + d!.width).toBeLessThan(cash!.x);

  // the tractor screen has the tractor business: its tab opens the business screen
  await page.getByRole('button', { name: /Walk to the tractor|Drive the tractor/ }).click();
  const hub = page.getByRole('dialog', { name: 'Tractor', exact: true });
  await hub.getByRole('button', { name: 'Tractor business', exact: true }).click();
  await expect(hub).toHaveCount(0);
  await expect(page.locator('.biz-page')).toBeVisible();
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', bizOpen: false } as never));

  // My Progress opens Animals and Security
  await page.locator('.hud-progress').click();
  const prog = page.getByRole('dialog', { name: 'My Progress' });
  await prog.getByRole('button', { name: /^Animals:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Animals' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.hud-progress').click();
  await page.getByRole('dialog', { name: 'My Progress' }).getByRole('button', { name: /^Security:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Security' })).toBeVisible();
});
