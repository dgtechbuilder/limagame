import { expect, test, type Page } from '@playwright/test';
import { boot, scenario, state } from './helpers';

/* Game controllers (src/input/gamepad.ts, src/input/pad.ts): any controller plays the game. The tests plug in pretend
   controllers (the browser's navigator.getGamepads gives them back) and press their buttons and sticks. */

type FakePad = { id: string; mapping: '' | 'standard'; axes?: number; buttons?: number; rest?: Record<number, number> };

const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const PLAYSTATION = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const NINTENDO = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';
const UNBRANDED = 'USB Gamepad (Vendor: 0079 Product: 0011)';

/** Plug in controllers before the game opens. */
async function plugIn(page: Page, pads: FakePad[]) {
  await page.addInitScript(list => {
    const live = list.map((p, i) => ({
      id: p.id,
      index: i,
      mapping: p.mapping,
      connected: true,
      timestamp: 0,
      axes: Array.from({ length: p.axes ?? 4 }, (_, k) => p.rest?.[k] ?? 0),
      buttons: Array.from({ length: p.buttons ?? 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: null,
    }));
    (window as unknown as { __pads: typeof live }).__pads = live;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => live.map(p => ({ ...p, axes: [...p.axes], buttons: p.buttons.map(b => ({ ...b })) })) });
  }, pads);
}

const frames = (page: Page, n = 3) => page.evaluate(n => new Promise<void>(r => {
  const step = (k: number) => (k ? requestAnimationFrame(() => step(k - 1)) : r());
  step(n);
}), n);

async function hold(page: Page, button: number, on: boolean, pad = 0) {
  await page.evaluate(([b, v, i]) => {
    const p = (window as unknown as { __pads: { buttons: { pressed: boolean; value: number }[] }[] }).__pads[i as number];
    p.buttons[b as number] = { ...p.buttons[b as number], pressed: !!v, value: v ? 1 : 0 };
  }, [button, on ? 1 : 0, pad]);
  await frames(page);
}

/** Press and let go of a button. */
async function press(page: Page, button: number, pad = 0) {
  await hold(page, button, true, pad);
  await hold(page, button, false, pad);
}

async function axis(page: Page, a: number, v: number, pad = 0) {
  await page.evaluate(([a, v, i]) => {
    (window as unknown as { __pads: { axes: number[] }[] }).__pads[i].axes[a] = v;
  }, [a, v, pad]);
  await frames(page);
}

const settings = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const focused = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '');
const openController = (page: Page) => page.evaluate(() => (window as unknown as { __lima: { dispatch: (a: object) => void } }).__lima.dispatch({ type: 'open', modal: { kind: 'settings', tab: 'controller' } }));

// standard layout button numbers
const A = 0, B = 1, Y = 3, RB = 5, RT = 7, VIEW = 8, START = 9, UP = 12, DOWN = 13;

test('an Xbox controller: announced, named in Settings → Controller with its own button names', async ({ page }) => {
  await plugIn(page, [{ id: XBOX, mapping: 'standard' }]);
  await boot(page);
  await expect(page.locator('.toast')).toContainText('Xbox controller connected');
  await scenario(page, 'tractor');
  await openController(page);
  await expect(settings(page).getByRole('button', { name: 'Controller', exact: true })).toBeVisible();
  await expect(settings(page)).toContainText('Xbox Wireless Controller');
  const legend = settings(page).getByRole('list', { name: 'Controller buttons' });
  await expect(legend.locator('[data-key="confirm"]')).toHaveText('A');
  await expect(legend.locator('[data-key="back"]')).toHaveText('B');
  await expect(legend.locator('[data-key="start"]')).toHaveText('Menu');
  // a button held lights up
  await hold(page, A, true);
  await expect(legend.locator('[data-key="confirm"]')).toHaveClass(/is-held/);
  await hold(page, A, false);
  await expect(legend.locator('[data-key="confirm"]')).not.toHaveClass(/is-held/);
  // the address of the section
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/settings/controller');
});

test('PlayStation and Nintendo controllers are told apart, and show their own button names', async ({ page }) => {
  await plugIn(page, [{ id: PLAYSTATION, mapping: 'standard' }, { id: NINTENDO, mapping: 'standard' }]);
  await boot(page);
  await scenario(page, 'tractor');
  await openController(page);
  await expect(settings(page)).toContainText('DualSense Wireless Controller');
  await expect(settings(page)).toContainText('Pro Controller');
  const legend = settings(page).getByRole('list', { name: 'Controller buttons' });
  // the first controller names the buttons until another is played
  await expect(legend.locator('[data-key="confirm"]')).toHaveText('✕');
  await expect(legend.locator('[data-key="y"]')).toHaveText('△');
  await press(page, DOWN, 1);
  await expect(legend.locator('[data-key="confirm"]')).toHaveText('B');
  await expect(legend.locator('[data-key="start"]')).toHaveText('+');
  // or always one make's names
  await settings(page).getByRole('radiogroup', { name: 'Button names' }).getByRole('radio', { name: 'PlayStation', exact: true }).click();
  await expect(legend.locator('[data-key="confirm"]')).toHaveText('✕');
  expect((await state(page)).settings.pad.glyphs).toBe('playstation');
});

test('menus with a controller: View opens Settings, the triggers change section, the D-pad and A choose, B closes', async ({ page }) => {
  await plugIn(page, [{ id: XBOX, mapping: 'standard' }]);
  await boot(page);
  await scenario(page, 'tractor');
  await press(page, VIEW);
  await expect(settings(page)).toBeVisible();
  const tab0 = (await state(page)).modal.tab;
  await press(page, RT);
  await expect.poll(async () => (await state(page)).modal.tab).not.toBe(tab0);
  // walk the focus to the Display section's Graphics choice and pick Low with A
  await openController(page);
  await page.evaluate(() => (window as unknown as { __lima: { dispatch: (a: object) => void } }).__lima.dispatch({ type: 'open', modal: { kind: 'settings', tab: 'display' } }));
  await expect(settings(page).getByRole('radiogroup', { name: 'Graphics' })).toBeVisible();
  await settings(page).getByRole('radiogroup', { name: 'Graphics' }).getByRole('radio', { name: 'Auto', exact: true }).focus();
  await press(page, 15); // D-pad right: High
  await press(page, 15); // D-pad right: Low
  expect(await focused(page)).toBe('Low');
  await press(page, A);
  await expect.poll(async () => (await state(page)).settings.graphics).toBe('low');
  // down leaves the row for the next one
  await press(page, DOWN);
  expect(await focused(page)).not.toBe('Low');
  // RB steps to the next button
  const before = await focused(page);
  await press(page, RB);
  expect(await focused(page)).not.toBe(before);
  await press(page, B);
  await expect(settings(page)).toBeHidden();
  await expect(page.locator('.hud-task')).toBeVisible();
});

test('Start opens the main menu and B closes it; Y walks to the next task', async ({ page }) => {
  await plugIn(page, [{ id: PLAYSTATION, mapping: 'standard' }]);
  await boot(page);
  await scenario(page, 'tractor');
  await press(page, START);
  const menu = page.getByRole('dialog', { name: 'Main menu' });
  await expect(menu).toBeVisible();
  // the D-pad brings the focus onto the menu
  await press(page, DOWN);
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await press(page, B);
  await expect(menu).toBeHidden();
  const from = await page.evaluate(() => (window as unknown as { __limaWorld: { farmerAt: () => { x: number; z: number } } }).__limaWorld.farmerAt());
  await press(page, Y);
  await expect.poll(async () => {
    const at = await page.evaluate(() => (window as unknown as { __limaWorld: { farmerAt: () => { x: number; z: number } } }).__limaWorld.farmerAt());
    return Math.hypot(at.x - from.x, at.z - from.z);
  }).toBeGreaterThan(0.5);
});

test('the left stick walks the farmer on the 3D farm, and the D-pad does too', async ({ page }) => {
  await plugIn(page, [{ id: XBOX, mapping: 'standard' }]);
  await boot(page);
  await scenario(page, 'tractor');
  const at = () => page.evaluate(() => (window as unknown as { __limaWorld: { farmerAt: () => { x: number; z: number } } }).__limaWorld.farmerAt());
  const a = await at();
  await axis(page, 0, 1);
  await page.waitForTimeout(500);
  await axis(page, 0, 0);
  const b = await at();
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.5);
  // a stick resting just off centre (a worn stick) does not walk
  await axis(page, 0, 0.1);
  await page.waitForTimeout(300);
  const c = await at();
  expect(Math.hypot(c.x - b.x, c.z - b.z)).toBeLessThan(0.05);
  await axis(page, 0, 0);
  await hold(page, UP, true);
  await page.waitForTimeout(400);
  await hold(page, UP, false);
  const d = await at();
  expect(Math.hypot(d.x - c.x, d.z - c.z)).toBeGreaterThan(0.5);
});

test('an unbranded controller the browser does not map: its hat D-pad and buttons work, and it can be set up', async ({ page }) => {
  // DirectInput pads: no "standard" layout, the D-pad on a hat axis (9) resting above 1
  await plugIn(page, [{ id: UNBRANDED, mapping: '', axes: 10, buttons: 12, rest: { 9: 3.2857 } }]);
  await boot(page);
  await expect(page.locator('.toast')).toContainText('Controller connected');
  await scenario(page, 'tractor');
  await openController(page);
  await expect(settings(page)).toContainText('buttons guessed');
  // the hat: down moves the focus
  await settings(page).getByRole('radiogroup', { name: 'Use a controller' }).getByRole('radio', { name: 'On', exact: true }).focus();
  await axis(page, 9, 0.1429); // the hat pressed down
  await axis(page, 9, 3.2857);
  expect(await focused(page)).not.toBe('On');

  // Set up buttons: button 6 confirms and button 7 goes back on this pad, the rest are skipped
  await settings(page).getByRole('button', { name: 'Set up buttons' }).click();
  await expect(settings(page)).toContainText('Confirm (choose');
  await press(page, 6);
  await expect(settings(page)).toContainText('Back (close');
  await press(page, 7);
  for (let i = 2; i < 14; i++) await settings(page).getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(settings(page).getByRole('list', { name: 'Controller buttons' })).toBeVisible();
  await expect.poll(async () => Object.values((await state(page)).settings.pad.maps as Record<string, Record<string, unknown>>)[0]).toMatchObject({ confirm: { b: 6 }, back: { b: 7 } });
  await expect(settings(page)).toContainText('your own buttons');
  // now button 7 is Back
  await press(page, 7);
  await expect(settings(page)).toBeHidden();
});

test('Confirm on the right (Nintendo style), and a controller turned off does nothing', async ({ page }) => {
  await plugIn(page, [{ id: XBOX, mapping: 'standard' }]);
  await boot(page);
  await scenario(page, 'tractor');
  await openController(page);
  await settings(page).getByRole('radiogroup', { name: 'Confirm button' }).getByRole('radio', { name: 'Right', exact: true }).click();
  const legend = settings(page).getByRole('list', { name: 'Controller buttons' });
  await expect(legend.locator('[data-key="confirm"]')).toHaveText('B');
  await expect(legend.locator('[data-key="back"]')).toHaveText('A');
  // the bottom button now goes back
  await press(page, A);
  await expect(settings(page)).toBeHidden();
  await openController(page);
  await settings(page).getByRole('radiogroup', { name: 'Use a controller' }).getByRole('radio', { name: 'Off', exact: true }).click();
  await press(page, A);
  await press(page, B);
  await expect(settings(page)).toBeVisible();
  // kept after a reload
  await boot(page, false);
  expect((await state(page)).settings.pad).toMatchObject({ on: false, swap: true });
});

test('the tractor yard with a controller: X goes to the tractor, the D-pad walks, A plays the station underfoot', async ({ page }) => {
  test.setTimeout(180_000);
  await plugIn(page, [{ id: PLAYSTATION, mapping: 'standard' }]);
  await boot(page);
  await page.evaluate(() => (window as unknown as { __lima: { jump: (s: object) => void } }).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } }));
  await page.waitForFunction(() => !!(window as unknown as { __limaWorld?: unknown }).__limaWorld);
  await press(page, 2); // □ / X: the tractor
  const hub = page.getByRole('dialog', { name: 'Tractor' });
  await expect(hub.locator('.ty-yard')).toBeVisible({ timeout: 15_000 });
  // the D-pad walks the farmer round the yard (and does not move the focus meanwhile)
  await hold(page, DOWN, true);
  await expect(hub.locator('.ty-farmer.is-walking')).toBeVisible();
  await page.waitForTimeout(400);
  await hold(page, DOWN, false);
  await expect(hub.locator('.ty-farmer.is-walking')).toHaveCount(0, { timeout: 5_000 });
  // walk onto a station (a tap sends the farmer there), then A plays it
  await hub.locator('[data-station="learn"]').click();
  await expect(hub.getByRole('button', { name: '← Back to the yard' })).toBeVisible({ timeout: 10_000 });
  await hub.getByRole('button', { name: '← Back to the yard' }).click();
  await expect(hub.getByRole('button', { name: 'Play Learn' })).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await press(page, A);
  await expect(hub.getByRole('button', { name: '← Back to the yard' })).toBeVisible();
});
