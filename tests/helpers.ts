import { expect, type Page } from '@playwright/test';

/* Helpers for the play-tests: the game is driven through its real screens; window.__lima (src/dev/hook.ts) sets up
   a moment and reads the state, and window.__limaWorld (world/World.tsx) walks the farmer in the 3D farm. */

type Win = Window & {
  __lima: {
    state: any;
    scenario: (kind: string) => { day: number; hazard: string; cycle: number };
    jump: (s: Record<string, unknown>) => void;
    callFor: (h: string) => { group: string; label: string; single: boolean };
    wrongCallFor: (h: string) => { group: string; label: string; single: boolean };
    fixes: (h: string) => { id: string; label: string; right: boolean; lesson: string }[];
    products: (h: string) => { id: string; name: string; right: boolean; lesson: string }[];
    tractorTool: (farm: number) => string;
    shamba: (id: string) => { correct: string; problemRows: number[] };
    sign: (farm: number) => { x: number; z: number };
    events: () => { name: string; [k: string]: unknown }[];
    clearEvents: () => void;
    tractorClock: (scale: number) => void;
  };
  __limaWorld?: {
    speedScale: number;
    walkTo: (x: number, z: number) => void;
    spawn: (x: number, z: number) => void;
    nextTile: (farm: number) => { x: number; z: number };
    farmerAt: () => { x: number; z: number };
  };
};

/** Open the game with the play-test hook, starting from an empty save. */
export async function boot(page: Page, fresh = true) {
  if (fresh) {
    await page.goto('./?dev');
    await page.evaluate(() => window.localStorage.clear());
  }
  await page.goto('./?dev');
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
}

export const state = (page: Page) => page.evaluate(() => (window as unknown as Win).__lima.state);
export const eventNames = (page: Page) => page.evaluate(() => (window as unknown as Win).__lima.events().map(e => e.name));

/** Set up a farm-world moment (trials/samples.ts wakalaCase) and wait for the 3D farm. */
export async function scenario(page: Page, kind: string) {
  const info = await page.evaluate(k => (window as unknown as Win).__lima.scenario(k), kind);
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => {
    const w = (window as unknown as Win).__limaWorld!;
    w.speedScale = 4;
  });
  return info;
}

/** Tap the task card, which walks the farmer to the next job (and opens a check on arrival at a sign). */
export async function tapTask(page: Page, title: RegExp | string) {
  const card = page.locator('.hud-task');
  await expect(card).toContainText(title);
  await card.click();
}

/** Open the first picture, then step through the rest with the guide line's button, and close the last. */
export async function lookAtAll(page: Page, next: string) {
  await page.locator('.part-row .part-tile').first().click();
  const done = page.getByRole('button', { name: 'Done looking' });
  for (let i = 0; i < 8 && !(await done.isVisible()); i++) await page.getByRole('button', { name: next }).click();
  await done.click();
}

/** Look at all five pictures of a check, then make a call. */
export async function lookAndCall(page: Page, call: { group: string; label: string; single: boolean }) {
  await lookAtAll(page, 'Next picture');
  await page.getByRole('button', { name: 'Make your call' }).click();
  await page.locator('.calls .call-btn', { hasText: call.group }).first().click();
  if (!call.single) await page.locator('.calls .call-btn', { hasText: call.label }).click();
}

/** Walk over a farm's tiles until `done` holds (the task card has moved on, a job is marked…). */
export async function workFarm(page: Page, farm: number, done: () => Promise<boolean>, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await done()) return;
    await page.evaluate(f => {
      const w = (window as unknown as Win).__limaWorld!;
      const t = w.nextTile(f);
      w.walkTo(t.x, t.z);
    }, farm);
    await page.waitForTimeout(350);
  }
  expect(await done()).toBe(true);
}

export type { Win };
