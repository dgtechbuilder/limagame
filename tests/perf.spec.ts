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
      jsKB: Math.round(js.reduce((n, r) => n + (r.encodedBodySize || r.transferSize || 0), 0) / 1024),
      allKB: Math.round(res.reduce((n, r) => n + (r.encodedBodySize || r.transferSize || 0), 0) / 1024),
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

  expect(walk.calls as number).toBeLessThan(400);
  expect(walk.triangles as number).toBeLessThan(600_000);
  expect(idle.frames as number).toBeGreaterThan(0);
});
