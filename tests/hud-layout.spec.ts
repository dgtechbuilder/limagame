import { expect, test, type Page } from '@playwright/test';
import { boot, type Win } from './helpers';

/* The farm's HUD: no Power, Business, Animals, Security or Progress buttons on the farm. The tractor business is a module
   of the tractor screen; Animals and Security sit in My Progress, which opens from the main menu; the day of the 30-day
   farming period sits beside the money. And no two HUD widgets touch: each keeps a 4px gap, labels and dots included. */

/** Every pair of HUD widgets closer than 4px, measured with their labels, badges and dots (art clipped inside a widget,
    like the farmer's portrait in its hexagon, counts only as far as the clip). */
async function hudCollisions(page: Page) {
  return page.evaluate(() => {
    const GAP = 4;
    const root = document.querySelector('.hud-avatar')!.parentElement!;
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const stacks = ['hud-dock', 'hud-daily', 'hud-pills', 'hud-status'];
    const widgets: Element[] = [];
    const walk = (el: Element) => {
      for (const c of el.children) {
        if (!vis(c)) continue;
        if (stacks.some(k => c.classList.contains(k))) walk(c);
        else if (c.closest('.hud-dock, .hud-daily, .hud-pills') || (getComputedStyle(c).position !== 'static' && !c.matches('canvas, .world-pad, .joy, .hud-hint, .hud-plot, .hud-place'))) widgets.push(c);
      }
    };
    walk(root);
    const clipped = (w: Element, e: Element) => {
      for (let a = e.parentElement; a && a !== w.parentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflow !== 'visible' || cs.clipPath !== 'none') return true;
      }
      return false;
    };
    const box = (w: Element) => {
      let x = Infinity, y = Infinity, r = -Infinity, b = -Infinity;
      for (const e of [w, ...w.querySelectorAll('*')]) {
        if (!vis(e) || (e !== w && clipped(w, e))) continue;
        const q = e.getBoundingClientRect();
        x = Math.min(x, q.x); y = Math.min(y, q.y); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
      }
      return { n: (w.getAttribute('aria-label') || w.className.toString()).slice(0, 40), x, y, r, b };
    };
    const all = widgets.map(box);
    const out: string[] = [];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const [a, c] = [all[i], all[j]];
        if (Math.max(a.x, c.x) - Math.min(a.r, c.r) < GAP && Math.max(a.y, c.y) - Math.min(a.b, c.b) < GAP) out.push(`${a.n} / ${c.n}`);
      }
    return out;
  });
}

test('the farm HUD: business in the tractor screen, animals and security in My Progress, the day out of 30', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);

  for (const gone of ['.hud-power', '.hud-biz', '.hud-animals', '.hud-security', '.hud-progress']) await expect(page.locator(gone)).toHaveCount(0);

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

  // My Progress (from the main menu) opens Animals and Security
  const myProgress = async () => {
    await page.locator('.hud-menu').click();
    await page.getByRole('button', { name: /^My Progress/ }).click();
  };
  await myProgress();
  const prog = page.getByRole('dialog', { name: 'My Progress' });
  await prog.getByRole('button', { name: /^Animals:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Animals' })).toBeVisible();
  await page.keyboard.press('Escape');
  await myProgress();
  await page.getByRole('dialog', { name: 'My Progress' }).getByRole('button', { name: /^Security:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Security' })).toBeVisible();
});

test('the farm HUD: no two widgets touch, with the special event card, the day, the load and the daily chips all showing', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.scenario('plots'));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ ...L.state, life: { day: 4, date: null, started: 2 } });
  });
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'carry', item: 'water' }));
  await expect(page.locator('.hud-status .is-carry')).toBeVisible();
  await expect(page.locator('.hud-tidy').first()).toBeVisible();
  await page.waitForTimeout(600); // the chips' pop-in
  expect(await hudCollisions(page)).toEqual([]);

  // at night the farm darkens but the HUD keeps the sustainability score beside the money (no night chip)
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ ...L.state, settings: { ...L.state.settings, night: 'night' } });
  });
  await expect(page.locator('.hud-sustain')).toBeVisible();
  await expect(page.locator('.hud-moon')).toHaveCount(0);
  await page.waitForTimeout(600);
  expect(await hudCollisions(page)).toEqual([]);
});
