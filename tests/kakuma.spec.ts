import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* The Kakuma special event (src/events): a pop-up on the farm's bottom left opens the event's page, which teaches
   about Kakuma refugee camp and its food, and takes gifts of money, food and produce from the store, with the World
   Food Programme. The pop-up tucks into a round button and is gone after the event. */

async function farm(page: import('@playwright/test').Page, when: string) {
  await page.clock.setFixedTime(new Date(when));
  await boot(page);
  await page.evaluate(() =>
    (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 }, produce: { store: { maize: 42 } } } as never),
  );
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
}

test('the Kakuma pop-up opens the event page; gifts of money and produce are recorded', async ({ page }) => {
  test.setTimeout(120_000);
  await farm(page, '2026-11-20T10:00:00');

  const pop = page.getByRole('region', { name: 'Kakuma special event' });
  await expect(pop).toContainText('27–30 November');
  await expect(pop).toContainText('World Food Programme');
  await expect(pop).toContainText('Starts in 7 days');
  // bottom left, clear of the Partners button above it
  const [box, partners] = await Promise.all([pop.boundingBox(), page.locator('.hud-partners').boundingBox()]);
  expect(box!.x).toBeLessThan(20);
  expect(box!.y + box!.height).toBeGreaterThan(380);
  expect(box!.y).toBeGreaterThanOrEqual(partners!.y + partners!.height);

  await pop.getByRole('button', { name: 'Join the event' }).click();
  const dlg = page.getByRole('dialog', { name: 'Kakuma special event' });
  await expect(dlg).toContainText('In partnership with');
  await expect(page).toHaveURL(/#\/kakuma\/about$/);
  await dlg.getByRole('button', { name: /Foods grown/ }).click();
  await expect(dlg.getByRole('article', { name: 'Sukuma wiki (kale)' })).toBeVisible();
  await dlg.getByRole('button', { name: /Food and life/ }).click();
  await expect(dlg).toContainText('Bamba Chakula');
  await dlg.getByRole('button', { name: /^.*Donate/ }).first().click();
  await expect(page).toHaveURL(/#\/kakuma\/donate$/);

  const before = await state(page);
  await dlg.getByRole('button', { name: /^Give food basket/ }).click();
  await dlg.getByRole('button', { name: /^Give 10 kg of maize/ }).click();
  const after = await state(page);
  expect(after.coins).toBe(before.coins - 150);
  expect(after.produce.store.maize).toBe(32);
  expect(after.kakuma.totals).toMatchObject({ money: 150, kg: 10, count: 2, meals: 50 });
  // ten points a gift before the event's days
  expect(after.points).toBe(before.points + 20);
  await expect(dlg.getByRole('link', { name: /Give at wfp.org/ })).toHaveAttribute('href', /wfp\.org/);
  // the gift is in the wallet, as giving
  expect(after.wallet.entries[0]).toMatchObject({ kind: 'giving', amount: -150 });

  // tucked away: a round button under Partners brings it back
  await page.keyboard.press('Escape');
  await pop.getByRole('button', { name: 'Tuck the Kakuma event away' }).click();
  await expect(pop).toHaveCount(0);
  await page.getByRole('button', { name: /Kakuma special event, 27–30 November: show/ }).click();
  await expect(pop).toBeVisible();
});

test('on the event days gifts earn double points; after the event the pop-up is gone', async ({ page }) => {
  test.setTimeout(120_000);
  await farm(page, '2026-11-28T10:00:00');
  const pop = page.getByRole('region', { name: 'Kakuma special event' });
  await expect(pop).toContainText('on now');
  await page.goto('./?dev#/kakuma/donate');
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  const before = await state(page);
  await page.getByRole('button', { name: /^Give a small gift/ }).click();
  expect((await state(page)).points).toBe(before.points + 20);

  await page.clock.setFixedTime(new Date('2026-12-01T10:00:00'));
  await page.goto('./?dev#/farm');
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await expect(page.locator('.hud-round').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Kakuma special event' })).toHaveCount(0);
  await expect(page.locator('.hud-kakuma')).toHaveCount(0);
});
