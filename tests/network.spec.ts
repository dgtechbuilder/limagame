import { expect, test } from '@playwright/test';
import { boot, type Win } from './helpers';

/* A weak, slow or missing signal (src/net): an activity whose code cannot be downloaded shows the "not downloaded
   yet" card instead of a blank screen and opens on Try again (or by itself when the signal is back); going offline
   and coming back is said once; the outbox keeps what it sends through an outage and sends events in one batch; and
   Data saver picks the light pictures. The service worker itself is played on the built game (offline-sw.spec.ts). */

const animalsDay2 = () => {
  const L = (window as unknown as Win).__lima;
  L.jump({ view: 'classic', coins: 20000, life: { day: 2, started: 2, date: new Date().toISOString().slice(0, 10) } });
};

test('an activity that cannot download shows the card, and opens on Try again', async ({ page }) => {
  // the Animals page's code fails to download (as on a dropped signal), from the start, so the prefetch misses it too
  let block = true;
  await page.route(/\/src\/livestock\/Animals\.tsx/, route => (block ? route.abort('internetdisconnected') : route.continue()));
  await boot(page);
  await page.evaluate(animalsDay2);
  await page.getByRole('button', { name: /^Animals:/ }).click();
  // tried three times by itself, then the card: the farm is safe, try again, back to the farm
  const card = page.getByRole('alert').filter({ hasText: 'did not finish downloading' });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole('button', { name: 'Back to the farm' })).toBeVisible();
  // the signal is back: Try again opens the page
  block = false;
  await card.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('dialog', { name: 'Animals' })).toBeVisible({ timeout: 20_000 });
});

test('offline: the game says so once, the card waits for the signal and opens by itself', async ({ page, context }) => {
  let block = true;
  await page.route(/\/src\/power\/Power\.tsx/, route => (block ? route.abort('internetdisconnected') : route.continue()));
  await boot(page);
  await page.evaluate(animalsDay2);
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'No signal: the game keeps playing' })).toBeVisible();
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'open', modal: { kind: 'power', tab: 'build' } }));
  const card = page.getByRole('alert').filter({ hasText: 'No signal just now' });
  await expect(card).toBeVisible({ timeout: 20_000 });
  // back online: it opens without a tap
  block = false;
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: 'Back online.' })).toBeVisible();
  await expect(card).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.act-loading')).toHaveCount(0, { timeout: 20_000 });
});

test('the outbox: events wait through an outage, then go in one batch', async ({ page, context }) => {
  const bodies: unknown[] = [];
  await page.route('**/collect', async route => {
    bodies.push(JSON.parse(route.request().postData() ?? 'null'));
    await route.fulfill({ status: 204 });
  });
  await boot(page);
  await context.setOffline(true);
  await page.evaluate(async () => {
    const o = await import('/src/net/outbox.ts' as string);
    for (let i = 0; i < 3; i++) o.enqueue('/collect', { name: `e${i}` }, 'batch');
    await o.flush(true);
  });
  // offline: nothing sent, all three kept on the phone
  expect(bodies).toHaveLength(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lima-outbox') ?? '[]').length)).toBe(3);
  // back online: one request with all three
  await context.setOffline(false);
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toEqual([{ name: 'e0' }, { name: 'e1' }, { name: 'e2' }]);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lima-outbox') ?? '[]').length)).toBe(0);
});

test('the outbox: a failed send waits and is tried again; a form is sent alone', async ({ page }) => {
  let fail = true;
  const bodies: unknown[] = [];
  await page.route('**/form', async route => {
    if (fail) return route.fulfill({ status: 503 });
    bodies.push(JSON.parse(route.request().postData() ?? 'null'));
    await route.fulfill({ status: 200, body: '{}' });
  });
  await boot(page);
  const id = await page.evaluate(async () => {
    const o = await import('/src/net/outbox.ts' as string);
    const id = o.enqueue('/form', { org: 'Shamba Co' }, 'single');
    await o.flush(true);
    return id;
  });
  // the server was down: still kept
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lima-outbox') ?? '[]').length)).toBe(1);
  fail = false;
  const sent = await page.evaluate(async id => {
    const o = await import('/src/net/outbox.ts' as string);
    const heard = new Promise<boolean>(r => o.onSent(id, () => r(true)));
    await o.flush(true);
    return heard;
  }, id);
  expect(sent).toBe(true);
  expect(bodies).toEqual([{ org: 'Shamba Co' }]);
});

test('Data saver: Settings turns it on; the farm picture is 1× and the crop photos are the light copies', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', modal: { kind: 'settings', tab: 'display' } });
  });
  await expect(page.getByText('Play offline')).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Data saver' }).getByRole('radio', { name: 'On' }).click();
  expect((await page.evaluate(() => (window as unknown as Win).__lima.state.settings.data))).toBe('on');
  await expect(page.getByText(/Lighter pictures and photos/)).toBeVisible();
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'close' }));
  await expect(page.locator('img.farm-bg').first()).not.toHaveAttribute('srcset', /.+/);
  const lite = await page.evaluate(async () => {
    const p = await import('/src/rounds/photos.ts' as string);
    const photo = p.photoByKey('armyworm/maize/pests');
    return { src: p.photoSrc(photo), lite: photo.lite as string };
  });
  expect(lite.src).toBe(lite.lite);
  expect(lite.src).toMatch(/photos-lite/);
});
