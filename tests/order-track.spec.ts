import { expect, test, type Page } from '@playwright/test';
import { boot, type Win } from './helpers';

/* The order game (minigames/OrderTrack.tsx): the tractor's safety check. The steps sit in a list on the side; a big
   tractor fills the stage with a track round it, a checkpoint at the part each step is about. Tap a step or drag it
   onto the glowing checkpoint; the track zooms in to show each checkpoint's picture and clue. */

const SHOTS = process.env.LIMA_SHOTS;

async function openSafety(page: Page) {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.getByRole('button', { name: /Walk to the tractor|Drive the tractor/ }).click();
  const hub = page.getByRole('dialog', { name: 'Tractor' });
  await hub.locator('[data-station="safety"]').click();
  await hub.getByRole('button', { name: /^Start safety check/ }).click({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.mg-order')).toBeVisible();
}

/** Drag a step card by its words onto a checkpoint. */
async function dragTo(page: Page, step: string, cp: number) {
  // let a zoom finish moving the track first
  await page.waitForTimeout(500);
  const card = page.locator('.mg-order-list .mg-card-btn', { hasText: step });
  const a = (await card.boundingBox())!;
  const b = (await page.locator(`[data-cp="${cp}"] .mg-cp-dot`).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('the safety check: a big tractor, steps dragged or tapped onto the track, zoom to see the clues', async ({ page }) => {
  test.setTimeout(180_000);
  await openSafety(page);
  const stage = page.locator('.mg-stage-wrap');
  await expect(page.locator('.mg-bigtractor')).toBeVisible();
  await expect(page.locator('.mg-order-list .mg-card-btn')).toHaveCount(6);
  // the first checkpoint glows and says where to start; the others are not open yet
  await expect(page.locator('[data-cp="0"]')).toHaveClass(/is-next/);
  await expect(page.locator('.mg-cp.is-locked')).toHaveCount(5);
  await expect(stage.getByText('▶ Start here')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-1-start.png` });

  // zoom in: every checkpoint shows the picture of its step; tapping one shows its clue
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.mg-stage-wrap.is-zoomed')).toBeVisible();
  await page.getByRole('button', { name: 'Show the whole track' }).click();
  await page.locator('[data-cp="1"] .mg-cp-dot').click();
  await expect(stage.getByText('Under the bonnet')).toBeVisible();
  await page.waitForTimeout(500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-2-zoomed.png` });
  await page.getByRole('button', { name: 'Show the whole track' }).click();

  // dropping on a checkpoint that is not open yet costs nothing and says where to start
  await dragTo(page, 'Check the oil and the water', 1);
  await expect(stage.getByText(/not open yet: start at checkpoint 1/)).toBeVisible();
  await expect(page.locator('.mg-time.is-bad')).toHaveCount(0);

  // drag the first step onto the glowing checkpoint
  await dragTo(page, 'Walk round: nobody near the tractor', 0);
  await expect(page.locator('[data-cp="0"]')).toHaveClass(/is-done/);
  await expect(page.locator('[data-cp="1"]')).toHaveClass(/is-next/);

  // a wrong step counts
  await page.locator('.mg-order-list .mg-card-btn', { hasText: 'Start the engine' }).click();
  await expect(page.locator('.mg-time.is-bad')).toHaveText('1 wrong');

  // the rest, tapped (one dragged mid-way)
  await page.locator('.mg-order-list .mg-card-btn', { hasText: 'Check the oil and the water' }).click();
  await dragTo(page, 'Check the tyres and the hitch pins', 2);
  await expect(page.locator('[data-cp="2"]')).toHaveClass(/is-done/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-3-midway.png` });
  for (const step of ['Sit down and put the belt on', 'Gear in neutral, PTO off', 'Start the engine']) await page.locator('.mg-order-list .mg-card-btn', { hasText: step }).click();
  await expect(page.locator('.mg-stars')).toBeVisible();
  await expect(page.locator('.mg-score')).toContainText('83%');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.mg-order')).toHaveCount(0);
});
