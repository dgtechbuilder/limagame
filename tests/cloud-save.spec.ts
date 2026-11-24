import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

/* Cloud save (src/net/cloud.ts): the progress saved on the phone is also sent to Supabase under the player code, with
   its tables' lists (src/net/cloudRecords.ts). The play-tests point it at the dev server (playwright.config.ts), caught
   here. */

interface Call {
  apikey: string | undefined;
  body: { p_player: string; p_state: Record<string, any>; p_saved_at: string; p_records: Record<string, any> | null };
}

const cloudOn = (page: Page) => page.evaluate(async () => (await import('/src/net/cloud.ts' as string)).cloudEnabled() as boolean);
const lima = (page: Page, a: Record<string, unknown>) => page.evaluate(x => (window as any).__lima.dispatch(x), a);

test('progress is saved to the cloud under the player code, with its tables, and waits through an outage', async ({ page }) => {
  const calls: Call[] = [];
  let fail = false;
  await page.route('**/rest/v1/rpc/temolima_save', async route => {
    if (fail) return route.fulfill({ status: 503 });
    const r = route.request();
    calls.push({ apikey: r.headers()['apikey'], body: JSON.parse(r.postData() ?? 'null') });
    await route.fulfill({ status: 204 });
  });
  await boot(page);
  test.skip(!(await cloudOn(page)), 'cloud save is off for this server (no VITE_SUPABASE_URL)');

  // a named farmer, an offer saved and a reward: saved on the phone, then sent with the lists
  await page.evaluate(() => (window as any).__lima.jump({ farmer: { name: 'Cloud Tester', look: 1 }, offers: ['rutuba'], redeemed: ['seed'], basics: [0], points: 900 }));
  await expect.poll(() => calls.length, { timeout: 20_000 }).toBeGreaterThan(0);
  const first = calls.at(-1)!;
  expect(first.apikey).toBe('test-publishable-key');
  expect(first.body.p_player).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(first.body).not.toHaveProperty('p_key');
  expect(first.body.p_state.farmer).toEqual({ name: 'Cloud Tester', look: 1 });
  expect(first.body.p_state).not.toHaveProperty('toast');
  const rec = first.body.p_records!;
  expect(rec.player.farmer_name).toBe('Cloud Tester');
  expect(rec.partnerCodes).toEqual([expect.objectContaining({ brand_id: 'rutuba', code: expect.stringMatching(/^[A-Z]+-[0-9A-Z]{4}$/) })]);
  expect(rec.rewards).toEqual([expect.objectContaining({ reward_id: 'seed', name: 'Seed discount' })]);
  expect(rec.learning).toContainEqual(expect.objectContaining({ kind: 'lesson', item_id: 'three' }));
  expect(rec.modules.length).toBeGreaterThan(5);
  // the player code is kept on the phone
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('lima-cloud-id') ?? 'null'));
  expect(kept).toEqual({ id: first.body.p_player });

  // the server is down: the newest state waits, and goes when the game is hidden; the lists go again, changed
  fail = true;
  await lima(page, { type: 'farmer', name: 'Second Name', look: 2 });
  await page.waitForTimeout(1_500);
  fail = false;
  const before = calls.length;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => calls.length).toBeGreaterThan(before);
  const last = calls.at(-1)!;
  expect(last.body.p_player).toBe(first.body.p_player);
  expect(last.body.p_state.farmer.name).toBe('Second Name');
  expect(last.body.p_records?.player.farmer_name).toBe('Second Name');
});

test('Settings shows the player code, and another phone opens the same farm with it', async ({ page }) => {
  const code = '0b9c3d7e-2a41-4f6b-9c1d-5e8f7a6b4c3d';
  await page.route('**/rest/v1/rpc/temolima_save', route => route.fulfill({ status: 204 }));
  await page.route('**/rest/v1/rpc/temolima_restore', async route => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    if (body.p_player !== code) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: { onboarded: true, farmer: { name: 'Amani', look: 2 }, fs: { phase: 'done', at: 'first', opened: true }, coins: 4321 }, saved_at: '2026-11-24T20:00:00Z', farmer_name: 'Amani' }),
    });
  });
  await boot(page);
  test.skip(!(await cloudOn(page)), 'cloud save is off for this server (no VITE_SUPABASE_URL)');

  await lima(page, { type: 'open', modal: { kind: 'settings', tab: 'help' } });
  const mine = await page.getByTestId('player-code').textContent();
  expect(mine).toMatch(/^[0-9a-f-]{36}$/);

  const input = page.getByRole('textbox', { name: 'Player code' });
  // not a code
  await input.fill('hello');
  await page.getByRole('button', { name: 'Find farm' }).click();
  await expect(page.getByText('Type the player code from your other phone.')).toBeVisible();
  // a code with no farm
  await input.fill('11111111-2222-4333-8444-555555555555');
  await page.getByRole('button', { name: 'Find farm' }).click();
  await expect(page.getByText('No farm is saved under that code yet.')).toBeVisible();
  // the right code, typed in capitals without dashes: found, then opened here
  await input.fill(code.toUpperCase().replace(/-/g, ''));
  await page.getByRole('button', { name: 'Find farm' }).click();
  await expect(page.getByText('Amani', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open this farm here' }).click();
  await page.waitForFunction(() => (window as any).__lima?.state?.farmer?.name === 'Amani');
  expect(await page.evaluate(() => (window as any).__lima.state.coins)).toBe(4321);
  // this phone now saves under that code
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lima-cloud-id') ?? 'null'))).toEqual({ id: code });
});

test('design-review links never send a save', async ({ page }) => {
  await page.goto('./?review');
  expect(await cloudOn(page)).toBe(false);
});
