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
  // the lesson is hands-on (src/minigames/workshop): each question is a job done on a working tractor
  const ctl = (id: string) => page.locator(`.ws [data-ctl="${id}"]`);
  const drive = async () => {
    for (let i = 0; i < 12 && !(await page.locator('.ws-why').isVisible()); i++) {
      const box = (await ctl('drive').boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();
    }
  };
  // fit the PTO shaft, switch the PTO on and mow
  await page.locator('.ws [data-part="shaft"]').click();
  await ctl('pto').click();
  await drive();
  await page.locator('.ws-why .mg-go').click();
  // hitch the plough with the linkage arms, lift it and carry it to the field
  await page.locator('.ws [data-part="arms"]').click();
  await ctl('lift').fill('100');
  await drive();
  await page.locator('.ws-why .mg-go').click();
  // fit the radiator, start the engine and rub the chaff off its fins
  await page.locator('.ws [data-part="radiator"]').click();
  await ctl('engine').click();
  for (const k of [0, 1, 2]) for (let i = 0; i < 3 && (await page.locator(`[data-clump="${k}"]`).count()); i++) await page.locator(`[data-clump="${k}"]`).click();
  await expect(page.locator('.ws-why')).toBeVisible({ timeout: 20_000 });
  await page.locator('.ws-why .mg-go').click();
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
