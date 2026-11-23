import { expect, test, type Page } from '@playwright/test';
import { boot, state, type Win } from './helpers';

/* The tractor's Learn lessons are hands-on (src/minigames/workshop): every question is a job on a working tractor,
   done by dragging parts in and out, working the switches and levers and holding a pedal to drive. A wrong try shows
   what really happens and is counted; the job done answers the question. */

const SHOTS = process.env.LIMA_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const ctl = (page: Page, id: string) => page.locator(`.ws [data-ctl="${id}"]`);
const part = (page: Page, id: string) => page.locator(`.ws [data-part="${id}"]`);
const won = (page: Page) => page.locator('.ws-why');

/** Hold a pedal down for a while. */
async function hold(page: Page, id: string, ms: number) {
  const box = (await ctl(page, id).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
/** Hold a pedal until the job is done. */
async function driveUntilWon(page: Page, id = 'drive', max = 12) {
  for (let i = 0; i < max && !(await won(page).isVisible()); i++) await hold(page, id, 600);
  await expect(won(page)).toBeVisible();
}
/** Drag a part from the tray onto a point of the drawing (in the drawing's own 360 × 220 units). */
async function dragTo(page: Page, from: string, x: number, y: number) {
  const a = (await page.locator(from).boundingBox())!;
  const svg = (await page.locator('.ws-svg').boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 - 20, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(svg.x + (x / 360) * svg.width, svg.y + (y / 220) * svg.height, { steps: 8 });
  await page.mouse.up();
}
const next = (page: Page) => page.locator('.ws-why .mg-go').click();

async function openLesson(page: Page, title: string) {
  const hub = page.getByRole('dialog', { name: 'Tractor' });
  await hub.locator('[data-station="learn"]').click();
  await expect(hub.getByRole('button', { name: '← Back to the yard' })).toBeVisible({ timeout: 10_000 });
  await hub.getByRole('button', { name: title, exact: true }).click();
  await hub.getByRole('button', { name: new RegExp(`^Start: ${title}`) }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.mg-card.is-wide .ws')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.getByRole('button', { name: /Walk to the tractor|Drive the tractor/ }).click();
  await expect(page.getByRole('dialog', { name: 'Tractor' }).locator('.ty-yard')).toBeVisible();
});

test('Know your tractor, by hand: fit the PTO shaft, hitch and lift the plough, cool the engine', async ({ page }) => {
  await openLesson(page, 'Know your tractor');

  // 1. the PTO: a wrong part does nothing when the PTO goes on (a wrong try); the shaft turns the mower
  await expect(page.locator('.ws[data-question="pto"]')).toBeVisible();
  await shot(page, '1-pto-start');
  await dragTo(page, '.ws [data-part="steering"]', 290, 165);
  await expect(part(page, 'steering')).toHaveAttribute('aria-pressed', 'true');
  await ctl(page, 'pto').click();
  await expect(page.locator('.ws-say.is-bad')).toContainText('steering wheel');
  await expect(page.locator('.ws-tries')).toHaveText('1 wrong try');
  await shot(page, '1-pto-wrong');
  await ctl(page, 'pto').click();
  await part(page, 'shaft').click(); // a tap swaps it in
  await expect(part(page, 'shaft')).toHaveAttribute('aria-pressed', 'true');
  await expect(part(page, 'steering')).toHaveAttribute('aria-pressed', 'false');
  await ctl(page, 'pto').click();
  await expect(page.locator('.ws-say.is-good')).toContainText('PTO shaft spins');
  // reaching for the turning shaft is a wrong try too
  await part(page, 'shaft').click();
  await expect(page.locator('.ws-tries')).toHaveText('2 wrong tries');
  await driveUntilWon(page);
  await shot(page, '1-pto-won');
  await expect(won(page)).toContainText('The PTO shaft');
  await next(page);

  // 2. the linkage: a pump lifts nothing; the arms lift the plough, carried to the field
  await expect(page.locator('.ws[data-question="linkage"]')).toBeVisible();
  await part(page, 'pump').click();
  await ctl(page, 'lift').fill('100');
  await expect(page.locator('.ws-say.is-bad')).toContainText('tyre pump');
  await part(page, 'arms').click();
  await ctl(page, 'lift').fill('20');
  await ctl(page, 'lift').fill('100');
  await shot(page, '2-linkage-lifted');
  await driveUntilWon(page);
  await expect(won(page)).toContainText('Lift and hold the tool');
  await next(page);

  // 3. the radiator: no tries wasted; fit it, start the engine, rub the chaff off the fins
  await expect(page.locator('.ws[data-question="radiator"]')).toBeVisible();
  await dragTo(page, '.ws [data-part="radiator"]', 78, 84);
  await ctl(page, 'engine').click();
  await shot(page, '3-radiator-chaff');
  for (const k of [0, 1, 2]) for (let i = 0; i < 3 && (await page.locator(`[data-clump="${k}"]`).count()); i++) await page.locator(`[data-clump="${k}"]`).click();
  await expect(won(page)).toBeVisible({ timeout: 20_000 });
  await shot(page, '3-radiator-won');
  await page.locator('.ws-why .mg-go').click();

  // two wrong tries in the first question: 1/3 + 1 + 1 over three: two stars, passed
  await expect(page.locator('.mg-stars .is-on')).toHaveCount(2);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await state(page)).hub.lessons).toContain('parts');
});

test('Working safely, by hand: up the slope, off the tractor safely, only the driver rides', async ({ page }) => {
  await openLesson(page, 'Working safely');

  // 4. the slope: turn straight uphill (the lean falls), then drive to the shed
  await expect(page.locator('.ws[data-question="slope"]')).toBeVisible();
  await shot(page, '4-slope-start');
  await hold(page, 'left', 500);
  await expect(page.locator('.ws-svg')).toContainText(/Leans [0-9]°/);
  await driveUntilWon(page, 'drive', 10);
  await shot(page, '4-slope-won');
  await next(page);

  // 5. getting off: stepping down with the engine running is a wrong try; made safe, it is done
  await expect(page.locator('.ws[data-question="getoff"]')).toBeVisible();
  await page.locator('.ws [data-person="farmer"]').click();
  await expect(page.locator('.ws-say.is-bad')).toContainText('hand brake');
  await shot(page, '5-getoff-unsafe');
  await expect(page.locator('g[data-person="farmer"]')).toBeVisible({ timeout: 6_000 });
  for (const c of ['tool', 'pto', 'brake', 'engine']) await ctl(page, c).click();
  await page.locator('.ws [data-person="farmer"]').click();
  await expect(won(page)).toBeVisible();
  await next(page);

  // 6. riders: off with the passengers, then drive to the gate
  await expect(page.locator('.ws[data-question="rider"]')).toBeVisible();
  await shot(page, '6-rider-start');
  for (const p of ['friend', 'friend2', 'child']) await part(page, p).click();
  await driveUntilWon(page);
  await next(page);
  await expect(page.locator('.mg-stars .is-on')).toHaveCount(3);
});

test('Look after the soil, by hand: wait for dry soil, plough shallow, soften the tyres', async ({ page }) => {
  await openLesson(page, 'Look after the soil');

  // 7. wet soil: driving on it now packs it (a wrong try); after the sun dries it, the tractor crosses
  await expect(page.locator('.ws[data-question="wetsoil"]')).toBeVisible();
  await hold(page, 'drive', 400);
  await expect(page.locator('.ws-say.is-bad')).toContainText('sank');
  await expect(page.locator('[data-cell="packed"]').first()).toBeVisible();
  await shot(page, '7-wet-packed');
  await expect(ctl(page, 'drive')).toBeEnabled({ timeout: 5_000 });
  for (let i = 0; i < 3; i++) await ctl(page, 'wait').click();
  await driveUntilWon(page);
  await next(page);

  // 8. ploughing: shallow does it in one pass
  await expect(page.locator('.ws[data-question="deep"]')).toBeVisible();
  await ctl(page, 'depth').fill('15');
  await driveUntilWon(page, 'drive', 14);
  await shot(page, '8-deep-won');
  await next(page);

  // 9. tyres: down from road pressure to the field band, then across
  await expect(page.locator('.ws[data-question="tyre"]')).toBeVisible();
  for (let i = 0; i < 8; i++) await ctl(page, 'vent').click();
  await shot(page, '9-tyre-field');
  await driveUntilWon(page);
  await next(page);
  await expect(page.locator('.mg-stars .is-on')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await state(page)).hub.lessons).toContain('soil');
});
