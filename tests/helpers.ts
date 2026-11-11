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
    sfx: () => ('action' | 'flow')[];
    clearEvents: () => void;
    tractorClock: (scale: number) => void;
    driveClock: (scale: number) => void;
    plots: { x: number; z: number }[];
  };
  __limaWorld?: {
    speedScale: number;
    walkTo: (x: number, z: number) => void;
    spawn: (x: number, z: number) => void;
    nextTile: (farm: number) => { x: number; z: number };
    farmerAt: () => { x: number; z: number };
    isRiding: () => boolean;
    nearTractor: () => boolean;
    mount: () => string;
    dismount: () => void;
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
  await finishLooking(page, next);
}

/** With a picture open: step through the rest, then close it. */
export async function finishLooking(page: Page, next: string) {
  const done = page.getByRole('button', { name: 'Done looking', exact: true });
  for (let i = 0; i < 8 && !(await done.isVisible()); i++) await page.getByRole('button', { name: next, exact: true }).click();
  await done.click();
}

/** On the judge screen: the group, then (if the group has more than one) the call. */
export async function makeCall(page: Page, call: { group: string; label: string; single: boolean }) {
  await page.locator('.calls .call-btn', { hasText: call.group }).first().click();
  if (!call.single) await page.locator('.calls .call-btn', { hasText: call.label }).click();
}

/** Look at all five pictures of a check, then make a call. */
export async function lookAndCall(page: Page, call: { group: string; label: string; single: boolean }) {
  await lookAtAll(page, 'Next picture');
  await page.getByRole('button', { name: 'Make your call', exact: true }).click();
  await makeCall(page, call);
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

/** The story's page 1: sign for the farm (Next shows once signed). */
export async function signStory(page: Page) {
  await page.getByRole('button', { name: /Sign for my farm/ }).click();
  await expect(page.locator('.story-deed-done')).toBeVisible();
  await closeCheer(page, 'Congratulations!');
}

/** Each story action ends with a pop-up: check its title, then Continue. */
export async function closeCheer(page: Page, title: string | RegExp) {
  const pop = page.locator('.story-cheer');
  await expect(pop.locator('.story-cheer-title')).toHaveText(title, { timeout: 10_000 });
  await pop.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(pop).toBeHidden();
}

/** Planting by hand on the story's page 2: tap each bunch of seeds, then its bed. */
export async function plantByHand(page: Page) {
  for (const [seed, bed] of [
    ['Maize seeds', 'Maize bed'],
    ['Sukuma seeds', 'Sukuma bed'],
  ]) {
    await page.getByRole('button', { name: seed, exact: true }).click();
    await page.getByRole('button', { name: `${bed}: tap to sow` }).click();
    await expect(page.getByRole('button', { name: `${bed}: sown` })).toBeVisible();
  }
}

/** The story's page 2: play last season a step at a time (planting by hand, then two short timers), then press = to see
    the loss. */
export async function playLastSeason(page: Page) {
  const cheers: [string, RegExp][] = [
    ['Plant the season', /^Well done/],
    ['Weed the farm', /^Good job/],
    ['Harvest', /^Congratulations/],
  ];
  for (const [step, cheer] of cheers) {
    const button = page.locator('.story-step', { hasText: step });
    // a step played already (by the test before calling this) is skipped
    if (/is-done/.test((await button.getAttribute('class')) ?? '')) continue;
    await expect(button).toBeEnabled({ timeout: 10_000 });
    await button.click();
    if (step === 'Plant the season') await plantByHand(page);
    await expect(button).toHaveClass(/is-done/, { timeout: 10_000 });
    await closeCheer(page, cheer);
  }
  await expect(page.locator('.story-sum-title')).toHaveText('Your first harvest: here is the financial result');
  await page.getByRole('button', { name: 'Equals: see how the season went' }).click();
  await expect(page.locator('.story-sum .is-lost')).toContainText('KSh 235,000');
}

/** The story's page 3: turn over each mistake to see what to do instead. */
export async function flipMistakes(page: Page) {
  const flips = page.locator('.story-flip');
  for (let k = 0; k < (await flips.count()); k++) await flips.nth(k).click();
}

/** Play the whole story, ending on the walk to the maize. */
export async function readStory(page: Page) {
  await signStory(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await playLastSeason(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await flipMistakes(page);
  await page.getByRole('button', { name: 'Start with my maize', exact: true }).click();
}

export type { Win };
