import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* The tractor yard: the tractor screen opens on a small place the farmer walks round, a station for each section. */

test('the tractor yard: tap a station, walk there, play its lesson; the stars show on its pad', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.getByRole('button', { name: /Walk to the tractor|Drive the tractor/ }).click();
  const hub = page.getByRole('dialog', { name: 'Tractor' });
  await expect(hub.locator('.ty-yard')).toBeVisible();
  // every section has a station; Learn and Safety need the farmer today
  for (const name of ['Train', 'Learn', 'Safety', 'Service', 'Repair', 'Refuel', 'Hire', 'Drive']) await expect(hub.locator(`[data-station] >> text=${name}`).first()).toBeVisible();
  await expect(hub.getByRole('button', { name: /^Learn: 3 lessons to pass/ })).toBeVisible();
  await expect(hub.getByRole('button', { name: 'Hop on', exact: true })).toBeVisible();

  // tapping a station walks the farmer there, then opens it
  await hub.locator('[data-station="learn"]').click();
  await expect(hub.locator('.ty-farmer.is-walking')).toBeVisible();
  await expect(hub.getByRole('button', { name: '← Back to the yard' })).toBeVisible({ timeout: 10_000 });
  await hub.getByRole('button', { name: /^Start: Know your tractor/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  // the right answers, wherever the shuffle put them; each question has a picture
  for (const right of ['The PTO shaft', 'Lift and hold the tool', 'The radiator']) {
    await expect(page.locator('.mg-quiz-art svg, .mg-quiz-art .fun-iconart').first()).toBeVisible();
    await page.locator('.mg-opt', { hasText: right }).click();
    await expect(page.locator('.mg-why.is-right')).toBeVisible();
    await page.locator('.mg-why .mg-go').click();
  }
  await expect(page.locator('.mg-stars .is-on')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  // back in the yard: the lesson passed, three stars on the Learn pad, standing on it shows Play
  await expect(hub.locator('.ty-yard')).toBeVisible();
  expect((await state(page)).hub.lessons).toContain('parts');
  expect((await state(page)).hub.best.learn).toBe(1);
  await expect(hub.getByRole('button', { name: 'Play Learn' })).toBeVisible();
  await expect(hub.getByRole('button', { name: /^Learn: 2 lessons to pass, best 3 of 3 stars/ })).toBeVisible();

  // walking with the keys moves the farmer off the pad
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowDown');
  await expect(hub.getByRole('button', { name: 'Play Learn' })).toHaveCount(0);
});
