import { expect, test, type Page } from '@playwright/test';

/* Performance on a phone-sized screen: how fast the game starts (what it downloads and when it first paints), and in
   the farm world the draw calls, triangles, pixel ratio, the main-thread cost of a frame and long tasks, while the
   farmer walks and while it stands still. It uses the design-review screens, so it runs on a production build too
   (LIMA_URL). The numbers are printed (PERF …) for the record; the checks are loose ceilings. Rendering here is in
   software (no GPU), so the times are far slower than a phone's. */

test.use({ viewport: { width: 740, height: 340 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });

type W = Window & {
  __limaWorld?: { walkTo: (x: number, z: number) => void; speedScale: number; perf: () => Record<string, number | boolean>; resetPerf: () => void };
  __long: number[];
};

/** Farm centres (src/world/field.ts PLOTS). */
const FARMS = [
  { x: -8, z: -4.6 },
  { x: 8, z: -4.6 },
  { x: 8, z: 4.6 },
  { x: -8, z: 4.6 },
];

async function startCost(page: Page) {
  return page.evaluate(() => {
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const js = res.filter(r => r.initiatorType === 'script' || r.name.endsWith('.js'));
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    return {
      fcpMs: Math.round(fcp),
      domReadyMs: Math.round(nav.domContentLoadedEventEnd),
      jsFiles: js.length,
      jsKB: Math.round(js.reduce((n, r) => n + (r.decodedBodySize || 0), 0) / 1024),
      allKB: Math.round(res.reduce((n, r) => n + (r.decodedBodySize || 0), 0) / 1024),
    };
  });
}

test('starting the game on a phone', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('./');
  await page.waitForTimeout(3000);
  const first = await startCost(page);
  console.log(`PERF start-new ${JSON.stringify(first)}`);
  // a returning player opens straight into the farm world
  await page.goto('./?review=1&screen=' + encodeURIComponent('Plots · Farm world'));
  await page.waitForFunction(() => !!(window as unknown as W).__limaWorld, null, { timeout: 60_000 });
  await page.waitForTimeout(2000);
  console.log(`PERF start-world ${JSON.stringify(await startCost(page))}`);
  expect(first.fcpMs).toBeGreaterThan(0);
});

test('the farm world on a phone: frame cost and draw calls', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./?review=1&screen=' + encodeURIComponent('Plots · Farm world'));
  await page.waitForFunction(() => !!(window as unknown as W).__limaWorld, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__limaWorld!.speedScale = 2;
    w.__long = [];
    new PerformanceObserver(l => l.getEntries().forEach(e => w.__long.push(e.duration))).observe({ type: 'longtask' });
  });
  await page.waitForTimeout(4000);

  const sample = async (label: string, walk: boolean) => {
    await page.evaluate(() => {
      (window as unknown as W).__limaWorld!.resetPerf();
      (window as unknown as W).__long = [];
    });
    if (walk) {
      for (const p of FARMS) {
        await page.evaluate(([x, z]) => (window as unknown as W).__limaWorld!.walkTo(x, z), [p.x, p.z + 4]);
        await page.waitForTimeout(1500);
      }
    } else await page.waitForTimeout(6000);
    const r = await page.evaluate(() => ({ ...(window as unknown as W).__limaWorld!.perf(), long: (window as unknown as W).__long }));
    const long = r.long as unknown as number[];
    const out = { ...r, long: long.length, longMs: Math.round(long.reduce((a, b) => a + b, 0)) };
    console.log(`PERF ${label} ${JSON.stringify(out)}`);
    return out;
  };

  const idle = await sample('idle', false);
  const walk = await sample('walk', true);
  const heap = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  console.log(`PERF heap ${JSON.stringify({ heapMB: Math.round(heap / 1e5) / 10 })}`);

  // a phone gets the lighter picture: at most 1.5× pixels and a smaller shadow map, and only the tiles that show
  expect(walk.level as number).toBeGreaterThanOrEqual(1);
  expect(walk.pixelRatio as number).toBeLessThanOrEqual(1.5);
  expect(walk.calls as number).toBeLessThan(200);
  expect(walk.triangles as number).toBeLessThan(250_000);
  // a still farm is drawn about 30 times a second, not 60 (here, in software, both are far slower)
  expect(idle.drawn as number).toBeLessThanOrEqual(6 * 32);
  expect(idle.frames as number).toBeGreaterThan(0);
});

/* The tractor business on a phone: the map while the tractor drives a leg (its transform set each frame, no React
   re-render), and the ten-second drive minigame (one small canvas, only changed cells repainted), with the CPU slowed
   4× as a low-cost phone would be. The numbers are printed; the checks are loose ceilings. Dev server only (?dev). */
test('the tractor business and its drive minigame on a slow phone', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./?dev');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('./?dev');
  type L = Window & { __lima: { jump: (s: Record<string, unknown>) => void; dispatch: (a: unknown) => void; driveClock: (n: number) => void } };
  await page.waitForFunction(() => !!(window as unknown as L).__lima);
  await page.evaluate(() => (window as unknown as L).__lima.jump({ view: 'classic' }));
  await page.evaluate(() => (window as unknown as L).__lima.dispatch({ type: 'biz', open: true }));
  await page.waitForSelector('.biz-map');
  const biz = await startCost(page);
  console.log(`PERF business-open ${JSON.stringify(biz)}`);
  await page.getByRole('button', { name: "Let's go", exact: true }).click();
  // book three farms for the tractor and plan the route
  const pins = page.locator('.biz-pin.is-on');
  let onTractor = 0;
  for (let i = 0; i < (await pins.count()) && onTractor < 3; i++) {
    await pins.nth(i).click();
    const parts = page.locator('.biz-part');
    let mine = false;
    for (let k = 0; k < (await parts.count()); k++) {
      const me = parts.nth(k).locator('.biz-seg button').first();
      if ((await me.isEnabled()) && !mine) {
        await me.click();
        mine = true;
      } else await parts.nth(k).getByRole('button', { name: /Partner/ }).click();
    }
    if (mine) onTractor++;
  }
  await page.getByRole('button', { name: 'Next: plan the route', exact: true }).click();
  const next = page.locator('.biz-pin.is-next');
  while (await next.count()) await next.first().click();

  // a slow phone from here: the CPU 4× slower. Every frame's time is kept, with marks for when the road leg and the
  // drive are on screen, so each gets its own rate (a leg is short: under a second).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const w = window as unknown as W & { __ft: number[]; __marks: [string, number][] };
    w.__ft = [];
    w.__marks = [];
    w.__long = [];
    const tick = (t: number) => {
      w.__ft.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new MutationObserver(() => {
      const state = document.querySelector('.drv') ? 'drive' : document.querySelector('.biz-tractor') ? 'leg' : 'none';
      const last = w.__marks[w.__marks.length - 1];
      if (!last || last[0] !== state) w.__marks.push([state, performance.now()]);
    }).observe(document.body, { childList: true, subtree: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => w.__long.push(e.duration))).observe({ type: 'longtask' });
  });
  await page.getByRole('button', { name: 'Start the day', exact: true }).click();
  await page.waitForSelector('.drv', { timeout: 30_000 });
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowUp');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const r = await page.evaluate(() => {
    const w = window as unknown as W & { __ft: number[]; __marks: [string, number][] };
    const rate = (state: string) => {
      const i = w.__marks.findIndex(m => m[0] === state);
      if (i < 0) return { ms: 0, fps: 0, maxGap: 0 };
      const t0 = w.__marks[i][1];
      const t1 = w.__marks[i + 1]?.[1] ?? w.__ft[w.__ft.length - 1];
      const ft = w.__ft.filter(t => t >= t0 && t < t1);
      const gaps = ft.map((t, k) => (k ? t - ft[k - 1] : 0));
      return { ms: Math.round(t1 - t0), fps: Math.round(ft.length / ((t1 - t0) / 1000)), maxGap: Math.round(Math.max(0, ...gaps)) };
    };
    return { leg: rate('leg'), drive: rate('drive'), long: w.__long.length, longMs: Math.round(w.__long.reduce((a, b) => a + b, 0)) };
  });
  console.log(`PERF biz-leg ${JSON.stringify(r.leg)}`);
  console.log(`PERF biz-drive ${JSON.stringify({ ...r.drive, long: r.long, longMs: r.longMs })}`);
  // a slow phone, drawn in software here, still gets a playable minigame, and the main thread is not held for long:
  // the leg is a short React render then a composited move; the drive repaints one small canvas a frame
  expect(r.leg.fps).toBeGreaterThan(6);
  expect(r.drive.fps).toBeGreaterThan(12);
  expect(r.drive.maxGap).toBeLessThan(600);
  expect(r.longMs).toBeLessThan(r.drive.ms * 0.3);
});
