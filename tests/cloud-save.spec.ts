import { expect, test } from '@playwright/test';
import { boot } from './helpers';

/* Cloud save (src/net/cloud.ts): the progress saved on the phone is also sent to Supabase, keyed by this phone's
   player id and secret key. The play-tests point it at the dev server (playwright.config.ts), caught here. */

interface Call {
  url: string;
  apikey: string | undefined;
  body: { p_player: string; p_key: string; p_state: Record<string, unknown>; p_saved_at: string };
}

const cloudOn = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => (await import('/src/net/cloud.ts' as string)).cloudEnabled() as boolean);

test('progress is saved to the cloud under one player id, and waits through an outage', async ({ page, context }) => {
  const calls: Call[] = [];
  let fail = false;
  await page.route('**/rest/v1/rpc/temolima_save', async route => {
    if (fail) return route.fulfill({ status: 503 });
    const r = route.request();
    calls.push({ url: r.url(), apikey: r.headers()['apikey'], body: JSON.parse(r.postData() ?? 'null') });
    await route.fulfill({ status: 204 });
  });
  await boot(page);
  test.skip(!(await cloudOn(page)), 'cloud save is off for this server (no VITE_SUPABASE_URL)');

  // a named farmer: saved on the phone, then sent to the cloud
  await page.evaluate(() => (window as any).__lima.dispatch({ type: 'farmer', name: 'Cloud Tester', look: 1 }));
  await expect.poll(() => calls.length, { timeout: 20_000 }).toBeGreaterThan(0);
  const first = calls.at(-1)!;
  expect(first.apikey).toBe('test-publishable-key');
  expect(first.body.p_player).toMatch(/^[0-9a-f-]{36}$/);
  expect(first.body.p_key).toMatch(/^[0-9a-f]{64}$/);
  expect((first.body.p_state as any).farmer).toEqual({ name: 'Cloud Tester', look: 1 });
  // what lasts one visit is not saved
  expect(first.body.p_state).not.toHaveProperty('toast');
  // the identity is kept on the phone
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('lima-cloud-id') ?? 'null'));
  expect(id).toEqual({ id: first.body.p_player, key: first.body.p_key });

  // the server is down: the newest state waits, and goes when the game is hidden
  fail = true;
  await page.evaluate(() => (window as any).__lima.dispatch({ type: 'farmer', name: 'Second Name', look: 2 }));
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
  expect((last.body.p_state as any).farmer.name).toBe('Second Name');
  await context.close();
});

test('design-review links never send a save', async ({ page }) => {
  await page.goto('./?review');
  expect(await cloudOn(page)).toBe(false);
});
