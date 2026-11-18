import { expect, test, type Page } from '@playwright/test';
import { boot, type Win } from './helpers';

/* The tractor game in the browser: opened from the main menu at #/tractor-game, a brief with the rocks, trees and
   holes, then the 30-second clock; running out of time, driving into a hole and ploughing the farm each end it. */

type Thing = { x: number; y: number; r: number; kind: string };
type MiniWin = Win & { __limaMini: { things: Thing[]; x: number; y: number; hdg: number; total: number; ploughed: number; t: number; done: unknown } };

const mini = (page: Page) => page.getByRole('dialog', { name: 'Tractor game: the mini farm' });

async function openFromMenu(page: Page) {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.getByRole('button', { name: 'Main menu' }).first().click();
  await page.getByRole('dialog', { name: 'Main menu' }).getByRole('button', { name: 'Tractor game', exact: true }).click();
  await expect(mini(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/tractor-game');
}

test('the tractor game: a brief, a 30-second clock, and the time running out', async ({ page }) => {
  await openFromMenu(page);
  const card = mini(page).getByRole('group', { name: 'How to play' });
  await expect(card).toContainText('5 rocks');
  await expect(card).toContainText('3 trees');
  await expect(card).toContainText('4 holes');
  await expect(mini(page).getByLabel('Time left')).toHaveText('30.0 s');
  // five rocks, three trees and four holes on the farm itself
  const kinds = await page.evaluate(() => (window as unknown as MiniWin).__limaMini.things.map(t => t.kind).sort());
  expect(kinds).toEqual([...Array(4).fill('hole'), ...Array(5).fill('rock'), ...Array(3).fill('tree')]);

  await page.evaluate(() => (window as unknown as Win).__lima.miniClock(10));
  await mini(page).getByRole('button', { name: 'Start', exact: true }).click();
  await expect(mini(page).getByRole('alertdialog', { name: 'Time’s up!' })).toBeVisible();
  await expect(mini(page).getByLabel('0 of 3 stars')).toBeVisible();
  await page.evaluate(() => (window as unknown as Win).__lima.miniClock(1));
  await page.screenshot({ path: 'test-results/minifarm-time.png' });
});

test('the tractor game: a hole ends it, and ploughing the farm wins', async ({ page }) => {
  await openFromMenu(page);
  await mini(page).getByRole('button', { name: 'Start', exact: true }).click();
  // put the tractor just left of a hole, facing it, and drive on
  await page.evaluate(() => {
    const d = (window as unknown as MiniWin).__limaMini;
    const h = d.things.find(t => t.kind === 'hole')!;
    d.things = [h];
    d.x = h.x - h.r - 12;
    d.y = h.y;
    d.hdg = 0;
  });
  await page.keyboard.down('ArrowUp');
  await expect(mini(page).getByRole('alertdialog', { name: 'Stuck in a hole!' })).toBeVisible();
  await page.keyboard.up('ArrowUp');

  // a new farm: almost all of it ploughed already, a short drive finishes it
  await mini(page).getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(mini(page).getByLabel('Time left')).toBeVisible();
  await page.evaluate(() => {
    const d = (window as unknown as MiniWin).__limaMini;
    d.things = [];
    d.ploughed = Math.floor(d.total * 0.8) - 5;
    d.x = 60;
    d.y = 20;
    d.hdg = 0;
  });
  await page.keyboard.down('ArrowUp');
  await expect(mini(page).getByRole('alertdialog', { name: 'Farm ploughed!' })).toBeVisible();
  await page.keyboard.up('ArrowUp');
  await expect(mini(page).getByLabel('3 of 3 stars')).toBeVisible();
  await expect(mini(page)).toContainText('Best:');
  expect(await page.evaluate(() => (window as unknown as Win).__lima.sfx())).toContain('flow');

  // Done closes it
  await mini(page).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(mini(page)).toBeHidden();
});
