import { expect, test, type Page } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* The stage is drawn as a phone with rounded corners (src/styles.css .stage, a 50px radius). Nothing a player reads
   or taps may sit in those corners, where the frame cuts it off: every bordered or filled box, button and link on a
   screen stays a few pixels inside the rounded edge. Content scrolled out of its box is not counted. */

/** Boxes that cross the stage's rounded frame, kept `margin` px inside it, as "class [x0,y0 – x1,y1] text". */
const outside = (page: Page, margin = 3) =>
  page.evaluate(m => {
    const W = 874, H = 402, R = 50;
    const st = document.querySelector('.stage')!;
    const sr = st.getBoundingClientRect();
    const k = sr.width / W;
    const inside = (x: number, y: number) => {
      if (x < m || y < m || x > W - m || y > H - m) return false;
      const cx = x < R ? R : x > W - R ? W - R : null;
      const cy = y < R ? R : y > H - R ? H - R : null;
      return cx === null || cy === null || Math.hypot(x - cx, y - cy) <= R - m;
    };
    const out: string[] = [];
    for (const el of st.querySelectorAll<HTMLElement>('*')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"]')) continue;
      const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
      if (!filled && el.tagName !== 'BUTTON' && el.tagName !== 'A') continue;
      // the part of the box that shows: clipped by every scrolling or clipping box it is in
      let r = el.getBoundingClientRect();
      let [l, t, rt, b] = [r.left, r.top, r.right, r.bottom];
      for (let p = el.parentElement; p && p !== st; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
        const pr = p.getBoundingClientRect();
        [l, t, rt, b] = [Math.max(l, pr.left), Math.max(t, pr.top), Math.min(rt, pr.right), Math.min(b, pr.bottom)];
      }
      if (rt - l < 4 || b - t < 4) continue;
      const [x0, y0, x1, y1] = [(l - sr.left) / k, (t - sr.top) / k, (rt - sr.left) / k, (b - sr.top) / k];
      if (x1 - x0 > W - 8 && y1 - y0 > H - 8) continue; // a backdrop filling the stage
      // a rounded box's corner is tested where its curve is, not at its bounding corner
      const er = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, (x1 - x0) / 2, (y1 - y0) / 2) * 0.29;
      const pts = [[x0 + er, y0 + er], [x1 - er, y0 + er], [x0 + er, y1 - er], [x1 - er, y1 - er]];
      if (pts.every(([x, y]) => inside(x, y))) continue;
      r = el.getBoundingClientRect();
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(x0)},${Math.round(y0)} – ${Math.round(x1)},${Math.round(y1)}] ${(el.innerText || el.getAttribute('aria-label') || '').slice(0, 30).replace(/\n/g, ' ')}`);
    }
    return out;
  }, margin);

const SCREENS = [
  '/farm', '/menu', '/mission', '/rounds',
  ...['my-farmer', 'game', 'display', 'help'].map(t => `/settings/${t}`),
  ...['overview', 'land-and-pay', 'shocks', 'activity'].map(t => `/climate/${t}`),
  ...['journey', 'modules', 'today', 'badges', 'certificates'].map(t => `/progress/${t}`),
  '/partners/offers', '/partners/placements',
  ...['food', 'fertilizer', 'water-tanks', 'equipment'].map(t => `/shop/${t}`),
  '/steps/planting', '/loan-calculator', '/loan-calculator/quote', '/sale', '/storage', '/farm-info', '/results', '/rewards', '/training',
];

test('every screen keeps its boxes and buttons inside the stage’s rounded frame', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ coins: 30000, level: 9 }));
  await expect.poll(async () => (await state(page)).fs.phase).toBe('done');
  for (const path of SCREENS) {
    await page.evaluate(p => (window.location.hash = p), path);
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#${path}`);
    await page.waitForTimeout(400); // the pop-in animation
    expect(await outside(page), path).toEqual([]);
  }
  // the tractor business, past its welcome
  await page.evaluate(() => (window.location.hash = '/tractor-business'));
  await page.getByRole('dialog', { name: 'Welcome to the Narok hub' }).getByRole('button', { name: /^Let.s go$/ }).click();
  await page.waitForTimeout(400);
  expect(await outside(page), 'tractor business').toEqual([]);
  // an offer's sheet on the Partners page
  await page.evaluate(() => (window.location.hash = '/partners/offers'));
  await page.getByRole('button', { name: 'Get the Rutuba Gold offer' }).click();
  await page.waitForTimeout(400);
  expect(await outside(page), 'offer sheet').toEqual([]);
});
