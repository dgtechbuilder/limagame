import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';

/* The service worker (public/sw.js) on the built game (npm run build first; skipped without dist/): the game opens
   with no signal on a second visit, the page comes from the phone when the network is slow, the rest of the game is
   kept on request (Settings → Display → Play offline) and then every activity opens offline. */

const DIST = resolve(process.cwd(), 'dist');
const PORT = 4199;
const URL = `http://localhost:${PORT}/`;
let server: PreviewServer | null = null;

test.skip(!existsSync(resolve(DIST, 'sw.js')), 'needs a production build (npm run build)');
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
});
test.afterAll(async () => {
  await server?.close();
});

/** Open the game and wait until the service worker controls it and has kept the core. */
async function install(page: Page) {
  await page.goto(URL);
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });
  await page.waitForFunction(
    async () => {
      const files = await caches.open('lima-files');
      return (await files.keys()).some(r => /\/assets\/World-[\w-]+\.js$/.test(r.url));
    },
    null,
    { timeout: 30_000, polling: 250 },
  );
}

test('a second visit opens with no signal at all', async ({ page, context }) => {
  await install(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.name-chip', { hasText: 'Wanjiku' })).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});

test('on a very slow network the page comes from the phone within a few seconds', async ({ page, context }) => {
  await install(page);
  // the page itself takes 20 s to arrive (a satellite or 2G link at its worst)
  await context.route(URL, async route => {
    await new Promise(r => setTimeout(r, 20_000));
    await route.continue().catch(() => {});
  });
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.name-chip', { hasText: 'Wanjiku' })).toBeVisible({ timeout: 15_000 });
  expect(Date.now() - t0).toBeLessThan(10_000);
  await context.unroute(URL);
});

test('Play offline keeps the whole game; then an activity opens offline', async ({ page, context }) => {
  await install(page);
  // keep everything (as the Download button does), and wait for it to finish
  const done = await page.evaluate(
    () =>
      new Promise<{ game: { kept: number; total: number } }>(resolve => {
        navigator.serviceWorker.addEventListener('message', e => e.data?.type === 'lima-warm-done' && resolve(e.data));
        navigator.serviceWorker.controller!.postMessage({ type: 'warm' });
      }),
  );
  expect(done.game.kept).toBe(done.game.total);
  // with no signal, every activity's code is on the phone
  await context.setOffline(true);
  const missing = await page.evaluate(async () => {
    const files = await caches.open('lima-files');
    const kept = new Set((await files.keys()).map(r => new URL(r.url).pathname.replace(/^.*\/assets\//, '')));
    const scripts = performance
      .getEntriesByType('resource')
      .map(r => r.name)
      .filter(n => /\/assets\/[\w-]+\.js$/.test(n))
      .map(n => n.replace(/^.*\/assets\//, ''));
    return scripts.filter(s => !kept.has(s));
  });
  expect(missing).toEqual([]);
  // a chunk not yet opened in this page, fetched with no signal, comes from the phone
  const ok = await page.evaluate(async () => {
    const files = await caches.open('lima-files');
    const power = (await files.keys()).map(r => r.url).find(u => /\/assets\/Power-[\w-]+\.js$/.test(u));
    if (!power) return 'no Power chunk kept';
    const r = await fetch(power);
    return r.ok ? 'ok' : `status ${r.status}`;
  });
  expect(ok).toBe('ok');
  await context.setOffline(false);
});
