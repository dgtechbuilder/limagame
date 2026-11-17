import { expect, test } from '@playwright/test';
import { boot, scenario } from './helpers';

/* The spacing and layout plan (docs/ui-spacing-plan.md), Phase 1: a pop-up never shares the stage with the farm's HUD
   buttons, and the gold buttons are readable (dark text on gold, 10px at least). */

const POPUPS = ['/shop/fertilizer', '/shop/equipment', '/rewards', '/sale', '/storage', '/harvest-timing', '/results', '/value-addition', '/farm-info', '/steps/planting', '/menu'];

test('pop-ups over the 3D farm hide its HUD, and every gold button has dark text of 10px or more', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await scenario(page, 'tractor');
  // the HUD is there on the farm itself
  await expect(page.locator('.hud-round').first()).toBeVisible();
  for (const path of POPUPS) {
    await page.evaluate(p => (window.location.hash = p), path);
    await expect.poll(() => page.evaluate(() => window.location.hash), { message: path }).toBe(`#${path}`);
    await expect(page.getByRole('dialog').first(), path).toBeVisible();
    // no HUD button, task card or coin pill under the pop-up
    for (const sel of ['.hud-round', '.hud-task', '.hud-pills']) await expect(page.locator(sel), `${path}: ${sel}`).toHaveCount(0);
    const gold = await page.locator('.gold-btn').evaluateAll(els =>
      els
        .filter(e => (e as HTMLElement).offsetParent !== null)
        .map(e => {
          const cs = getComputedStyle(e);
          return { text: (e as HTMLElement).innerText.trim(), color: cs.color, size: parseFloat(cs.fontSize) };
        }),
    );
    for (const g of gold) {
      expect(g.color, `${path}: "${g.text}"`).toBe('rgb(74, 42, 16)');
      expect(g.size, `${path}: "${g.text}"`).toBeGreaterThanOrEqual(10);
    }
  }
  // back on the farm, the HUD returns
  await page.evaluate(() => (window.location.hash = '/farm'));
  await expect(page.locator('.hud-round').first()).toBeVisible();
});
