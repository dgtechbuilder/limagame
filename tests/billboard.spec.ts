import { expect, test, type Page } from '@playwright/test';
import { BILLBOARDS } from '../src/world/engine';
import { boot, scenario, type Win } from './helpers';

/* The offer tag over a partner billboard on the 3D farm (world/World.tsx billboardNear): it shows only while the
   farmer stands right under the board, within a metre (one world unit) of its pole. */

const tag = (page: Page) => page.locator('.hud-bill');
const spawn = (page: Page, x: number, z: number) => page.evaluate(([x, z]) => (window as unknown as Win).__limaWorld!.spawn(x, z), [x, z]);

test('the billboard tag shows only from right under the board', async ({ page }) => {
  await boot(page);
  await scenario(page, 'fix');
  const bb = BILLBOARDS.find(b => b.slot === 'world-billboard-west')!;
  // a few metres in front of it: no tag
  await spawn(page, bb.x, bb.z + 3);
  await page.waitForTimeout(600);
  await expect(tag(page)).toHaveCount(0);
  await spawn(page, bb.x, bb.z + 1.6);
  await page.waitForTimeout(600);
  await expect(tag(page)).toHaveCount(0);
  // right under it, beside the pole: the tag
  await spawn(page, bb.x, bb.z + 0.9);
  await expect(tag(page)).toBeVisible();
  // step back out: it goes
  await spawn(page, bb.x, bb.z + 3);
  await expect(tag(page)).toHaveCount(0);
});
