import { expect, test, type Page } from '@playwright/test';
import { boot, type Win } from './helpers';
import { GARAGE_AT, GREENHOUSE_AT, HOUSE_AT, STOREHOUSE_AT, TOOL_SHED_AT } from '../src/world/field';
import { RESTAURANT_AT } from '../src/world/restaurant';

/* Walk-in buildings: the farmer walks into the farmhouse, the tool shed, the tractor's garage, the greenhouse, the
   restaurant and the storehouse, under see-through roofs, and back out. A tap on a spot inside a building from
   outside walks the farmer round to its door and in. The garage stands right behind the tractor. */

const at = (page: Page) => page.evaluate(() => (window as unknown as Win).__limaWorld!.farmerAt());

async function farm(page: Page) {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', coins: 50_000, life: { day: 6, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => ((window as unknown as Win).__limaWorld!.speedScale = 4));
}

async function walk(page: Page, from: { x: number; z: number }, to: { x: number; z: number }) {
  await page.evaluate(p => (window as unknown as Win).__limaWorld!.spawn(p.x, p.z), from);
  await page.evaluate(p => (window as unknown as Win).__limaWorld!.walkTo(p.x, p.z), to);
  await expect.poll(async () => { const f = await at(page); return Math.hypot(f.x - to.x, f.z - to.z); }, { timeout: 30_000 }).toBeLessThan(0.3);
}

test('the garage stands right behind the tractor, its open front towards it', () => {
  // the tractor waits at x -17.4, z 6.4 facing +x: behind it is the west, between it and the fence
  expect(GARAGE_AT.z).toBeCloseTo(6.4, 5);
  expect(GARAGE_AT.x).toBeLessThan(-17.4 - 2);
  expect(GARAGE_AT.x).toBeGreaterThan(-22.4 + 1.4);
});

test('the farmer walks into the buildings and back out, round to the door from any side', async ({ page }) => {
  await farm(page);
  const visits: [string, { x: number; z: number }, { x: number; z: number }][] = [
    // from beside the house (no door on that side): round to the front door, in, and to the table
    ['house', { x: HOUSE_AT.x + 5, z: HOUSE_AT.z }, { x: HOUSE_AT.x - 0.6, z: HOUSE_AT.z + 1.2 }],
    ['tool shed', { x: -14.2, z: 3.4 }, { x: TOOL_SHED_AT.x + 0.4, z: TOOL_SHED_AT.z }],
    ['garage', { x: -17.4, z: 8.8 }, { x: GARAGE_AT.x + 0.3, z: GARAGE_AT.z + 0.2 }],
    // from the market path, in by the door facing it, down the aisle between the beds
    ['greenhouse', { x: GREENHOUSE_AT.x + 4, z: GREENHOUSE_AT.z - 2.6 }, { x: GREENHOUSE_AT.x, z: GREENHOUSE_AT.z }],
    // into the aisle in front of the tables
    ['restaurant', { x: RESTAURANT_AT.x + 6, z: RESTAURANT_AT.z }, { x: RESTAURANT_AT.x - 1.5, z: RESTAURANT_AT.z - 0.2 }],
    // from the front, round to the door in the back wall and in
    ['storehouse', { x: STOREHOUSE_AT.x - 1, z: STOREHOUSE_AT.z + 3.4 }, { x: STOREHOUSE_AT.x + 1.6, z: STOREHOUSE_AT.z - 0.3 }],
  ];
  for (const [, from, inside] of visits) {
    await walk(page, from, inside);
    // and back out to where they came from
    await page.evaluate(p => (window as unknown as Win).__limaWorld!.walkTo(p.x, p.z), from);
    await expect.poll(async () => { const f = await at(page); return Math.hypot(f.x - from.x, f.z - from.z); }, { timeout: 30_000 }).toBeLessThan(0.3);
  }
});

test('the walls still stop the farmer: no walking through the glass', async ({ page }) => {
  await farm(page);
  // straight at the house's side wall with the joystick: the farmer stops outside it
  await page.evaluate(p => (window as unknown as Win).__limaWorld!.spawn(p.x, p.z), { x: HOUSE_AT.x + 5, z: HOUSE_AT.z });
  await page.evaluate(() => (window as unknown as { __limaWorld: { setJoystick: (x: number, y: number) => void } }).__limaWorld.setJoystick(-1, 0));
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as unknown as { __limaWorld: { setJoystick: (x: number, y: number) => void } }).__limaWorld.setJoystick(0, 0));
  const f = await at(page);
  expect(f.x).toBeGreaterThan(HOUSE_AT.x + 3.2);
});
