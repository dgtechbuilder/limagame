import { expect, test } from '@playwright/test';
import { boot, finishLooking, makeCall, scenario, tapTask, type Win } from './helpers';

/* A play-through of the new moments on a small touch screen (740 × 340, a phone held sideways), saving a screenshot
   of each to test-results/tour/ (kept with the CI run). It also checks that each screen opens at that size. */

test.use({ viewport: { width: 740, height: 340 }, hasTouch: true });

const shot = (name: string) => `test-results/tour/${name}.png`;
/** Let the screen's entrance animation finish before the picture. */
const settle = (page: import('@playwright/test').Page) => page.waitForTimeout(500);

test('tour of the Wakala moments on a phone-sized screen', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);

  // a check with Mama Achieng, then the fix
  const c = await scenario(page, 'voice');
  await page.waitForTimeout(800);
  await settle(page);
  await page.screenshot({ path: shot('01-world') });
  await tapTask(page, 'Check Farm 1');
  await expect(page.locator('.voice-bubble.is-top')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('02-check-mama-achieng') });
  await page.locator('.part-row .part-tile').first().click();
  await expect(page.locator('.voice-bubble.is-side')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('03-check-remark') });
  await finishLooking(page, 'Next picture');
  await page.getByRole('button', { name: 'Make your call', exact: true }).click();
  await makeCall(page, await page.evaluate(h => (window as unknown as Win).__lima.callFor(h), c.hazard));
  await page.getByRole('button', { name: 'Choose the fix', exact: true }).click();
  const fixes = await page.evaluate(h => (window as unknown as Win).__lima.fixes(h), c.hazard);
  await page.locator('.care-opt', { hasText: fixes.find(f => !f.right)!.label }).click();
  await settle(page);
  await page.screenshot({ path: shot('04-wrong-fix') });
  await page.locator('.care-opt', { hasText: fixes.find(f => f.right)!.label }).click();
  await settle(page);
  await page.screenshot({ path: shot('05-right-fix') });
  await page.getByRole('button', { name: 'Back to the farm', exact: true }).click();

  // follow-up due, and the problem back after a missed one
  await scenario(page, 'followUp');
  await page.waitForTimeout(800);
  await settle(page);
  await page.screenshot({ path: shot('06-follow-up-due') });
  await scenario(page, 'cameBack');
  await tapTask(page, 'Check Farm 1');
  await expect(page.locator('.voice-bubble.is-top')).toContainText('came back');
  await settle(page);
  await page.screenshot({ path: shot('07-problem-came-back') });
  await page.getByRole('button', { name: 'Back to my farm', exact: true }).click();

  // the safety kit and the product
  await scenario(page, 'spray');
  await tapTask(page, 'Get the sprayer');
  await page.locator('.care-opt', { hasText: 'Gloves' }).click();
  await settle(page);
  await page.screenshot({ path: shot('08-safety-kit') });
  await page.locator('.care-opt', { hasText: 'Face mask' }).click();
  await page.locator('.care-opt', { hasText: 'Boots' }).click();
  await settle(page);
  await page.screenshot({ path: shot('09-product') });
  await page.getByRole('button', { name: 'Back to my farm', exact: true }).click();

  // the tractor
  await scenario(page, 'tractor');
  await tapTask(page, 'Hire the tractor');
  await expect(page.locator('.tc-side')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('10-tractor-brief') });
  await page.getByRole('button', { name: 'Choose a tractor', exact: true }).click();
  await page.locator('.tc-card', { hasText: 'Compact' }).click();
  await settle(page);
  await page.screenshot({ path: shot('11-tractor-choose') });
  await page.getByRole('button', { name: 'Next: the implement', exact: true }).click();
  await page.locator('.tc-card', { hasText: 'Disc plough' }).click();
  await settle(page);
  await page.screenshot({ path: shot('12-implement') });
  await page.getByRole('button', { name: 'Next: get ready', exact: true }).click();
  await page.locator('.care-opt', { hasText: 'Hitch' }).click();
  await page.locator('.care-opt', { hasText: 'Fill up' }).click();
  await page.getByRole('button', { name: /Start the engine/ }).click();
  // drive by hand for a moment: tap and hold on the field
  const field = page.locator('.tc-canvas');
  const box = (await field.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.evaluate(() => (window as unknown as Win).__lima.tractorClock(10));
  await page.getByRole('button', { name: 'Autopilot', exact: true }).click();
  await page.waitForTimeout(1500);
  await settle(page);
  await page.screenshot({ path: shot('13-tractor-drive') });
  await expect(page.locator('.tc-score')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(600);
  await settle(page);
  await page.screenshot({ path: shot('14-tractor-summary') });
  await page.getByRole('button', { name: 'Sources', exact: true }).click();
  await settle(page);
  await page.screenshot({ path: shot('15-shilling-sources') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.waitForTimeout(2500);
  await settle(page);
  await page.screenshot({ path: shot('16-3d-tractor-ploughs') });

  // the tractor's type and tool, then a column of Farm 1's plots from the seat
  await scenario(page, 'plots');
  // the hired tractor from the last moment finishes its job and comes home first
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as unknown as Win).__limaWorld!.spawn(-17.4, 8.6));
        await page.waitForTimeout(300);
        return page.locator('.hud-tractor').getAttribute('aria-label');
      },
      { timeout: 120_000, intervals: [2000] },
    )
    .toBe('Drive the tractor');
  await page.locator('.hud-tractor').click();
  await expect(page.locator('.tp-card').first()).toBeVisible();
  await page.locator('.tp-card', { hasText: 'Compact' }).click();
  await settle(page);
  await page.screenshot({ path: shot('17-tractor-type') });
  await page.getByRole('button', { name: 'Next: the tool', exact: true }).click();
  await page.locator('.tp-tool', { hasText: 'Disc plough' }).click();
  await settle(page);
  await page.screenshot({ path: shot('18-tractor-tool') });
  await page.getByRole('button', { name: 'Start the engine', exact: true }).click();
  const farm1 = await page.evaluate(() => (window as unknown as Win).__lima.plots[0]);
  await page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.walkTo(x, z), [farm1.x - 1.8, farm1.z - 3.9]);
  await page.waitForTimeout(4000);
  await page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.walkTo(x, z), [farm1.x - 1.8, farm1.z + 3.9]);
  await page.waitForTimeout(4000);
  await settle(page);
  await page.screenshot({ path: shot('19-tractor-plots') });
  await page.locator('.hud-tractor').click();

  // clearing by hand: the button on the next plot, then its 3-second timer
  await tapTask(page, 'Clear Farm 1');
  await expect(page.locator('.hud-plot')).toBeVisible({ timeout: 60_000 });
  await settle(page);
  await page.screenshot({ path: shot('20-plot-button') });
  await page.locator('.hud-plot').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot('21-plot-timer') });
});
