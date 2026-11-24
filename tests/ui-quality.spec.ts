import { expect, test } from '@playwright/test';
import { boot, scenario } from './helpers';

/* The spacing and layout plan (docs/ui-spacing-plan.md), Phase 1: a pop-up never shares the stage with the farm's HUD
   buttons, and the gold buttons are readable (dark text on gold, 8px at least). */

const POPUPS = ['/shop/fertilizer', '/shop/equipment', '/rewards', '/sale', '/storage', '/harvest-timing', '/results', '/value-addition', '/farm-info', '/steps/planting', '/menu'];

test('pop-ups over the 3D farm hide its HUD, and every gold button has dark text of 8px or more', async ({ page }) => {
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
      expect(g.size, `${path}: "${g.text}"`).toBeGreaterThanOrEqual(8);
    }
  }
  // back on the farm, the HUD returns
  await page.evaluate(() => (window.location.hash = '/farm'));
  await expect(page.locator('.hud-round').first()).toBeVisible();
});

/* Phase 2: the older pop-ups on the wooden frames. Navigation sits in the top bar (Back · Menu · Farm, top right) with
   no ✕ outside the frame, no text under 8px, and at most one gold button in view. */
const PHASE2 = [
  'Shop · Fertilizer',
  'Shop · Sell Food',
  'Farming Steps · Land Prep',
  'Farming Steps · Water',
  'Storage',
  'Harvest timing',
  'Value Addition',
  'Select Process',
  'Harvest Info',
  'Sale of produce',
  'Outcome comparison',
  'Rewards & Discounts Hub',
  'Farmer training',
];

test('the older pop-ups: navigation in the top bar, text 8px and up, one gold button at most', async ({ page }) => {
  test.setTimeout(180_000);
  for (const screen of PHASE2) {
    await page.goto(`./?review=1&screen=${encodeURIComponent(screen)}`);
    const dialog = page.getByRole('dialog').first();
    await expect(dialog, screen).toBeVisible();
    // Back, Menu and Farm in a row at the top right; the old ✕ beside the frame is gone
    const nav = dialog.locator('.navbar.is-row');
    await expect(nav, screen).toBeVisible();
    const box = (await nav.boundingBox())!;
    expect(box.y, screen).toBeLessThan(40);
    expect(box.x + box.width, screen).toBeGreaterThan(780);
    await expect(dialog.locator('.close-btn'), screen).toHaveCount(0);
    const found = await dialog.evaluate(root => {
      const small: string[] = [];
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const text = walk.currentNode.textContent!.trim();
        const el = walk.currentNode.parentElement!;
        // letters only: emoji brand marks are pictures
        if (!/[a-z0-9]/i.test(text) || el.offsetParent === null) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 8) small.push(`${size}px "${text.slice(0, 30)}"`);
      }
      const gold = [...root.querySelectorAll<HTMLElement>('.gold-btn')].filter(e => e.offsetParent !== null).length;
      return { small, gold };
    });
    expect(found.small, screen).toEqual([]);
    expect(found.gold, screen).toBeLessThanOrEqual(1);
  }
});
