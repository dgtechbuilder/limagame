import { expect, test, type Page } from '@playwright/test';
import { createPartnerTracker, memorySink, partnerReport, regionOf, storageSink, type KeyValueStore, type PartnerContext } from '../packages/partner-tracking/src';
import { boot, type Win } from './helpers';

/* Partner data tracking: the package on its own (packages/partner-tracking: events, sinks, the report of the ten
   partner metrics), then the game wired to it (src/partners/tracking.ts). */

function setup(ctx: PartnerContext = { playerId: 'p1', country: 'KE', region: 'East Africa', experience: 'new' }) {
  const mem = memorySink();
  let at = 1000;
  const c = { ...ctx };
  const t = createPartnerTracker({ context: () => c, sinks: [mem], now: () => at++ });
  return { t, mem, c };
}

test.describe('the package', () => {
  test('each call records one event with the time and the player', () => {
    const { t, mem } = setup();
    t.impression('rutuba', 'world-billboard-west');
    t.tap('rutuba', 'world-billboard-west');
    t.product('rutuba', 'rutuba-npk', 'bought');
    t.lead('rutuba', 'offer_code', 'FERT-ABCD');
    t.credits('tangi', 'water', 0, 'rain'); // nothing earned: nothing recorded
    expect(mem.events.map(e => e.type)).toEqual(['impression', 'tap', 'product', 'lead']);
    expect(mem.events[0]).toMatchObject({ at: 1000, brand: 'rutuba', slot: 'world-billboard-west', ctx: { playerId: 'p1', country: 'KE' } });
  });

  test('a failing sink and a disabled tracker never throw', () => {
    const mem = memorySink();
    let on = true;
    const t = createPartnerTracker({
      context: () => ({ playerId: 'x' }),
      enabled: () => on,
      sinks: [
        () => {
          throw new Error('storage full');
        },
        mem,
      ],
    });
    t.tap('pesa', 'loan');
    on = false;
    t.tap('pesa', 'loan');
    expect(mem.events).toHaveLength(1);
  });

  test('the storage sink keeps the last events', () => {
    const data = new Map<string, string>();
    const storage: KeyValueStore = { getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) };
    const store = storageSink({ key: 'k', limit: 2, storage });
    const t = createPartnerTracker({ context: () => ({ playerId: 'x' }), sinks: [store] });
    t.tap('a', 's1');
    t.tap('a', 's2');
    t.tap('a', 's3');
    expect(store.read().map(e => (e as { slot: string }).slot)).toEqual(['s2', 's3']);
  });

  test('regions', () => {
    expect(regionOf('KE')).toBe('East Africa');
    expect(regionOf('ng')).toBe('West Africa');
    expect(regionOf('')).toBe('Unknown');
    expect(regionOf('FR')).toBe('Other');
  });

  test('the report gives the ten partner metrics', () => {
    const { t, mem, c } = setup();
    // player 1 (new, Kenya): sees, taps, buys and uses the product, takes the code, reads a lesson
    t.impression('rutuba', 'world-billboard-west');
    t.impression('rutuba', 'world-billboard-west');
    t.tap('rutuba', 'world-billboard-west');
    t.product('rutuba', 'rutuba-npk', 'bought', 2);
    t.product('rutuba', 'rutuba-npk', 'used');
    t.learning('rutuba', 'basics-1', 'lesson');
    t.lead('rutuba', 'offer_code', 'FERT-1');
    t.outcome({ kind: 'season', yield: 12, profit: 300, partners: ['rutuba'] });
    // player 2 (experienced, Ghana): only sees it, and harvests without it
    Object.assign(c, { playerId: 'p2', country: 'GH', region: 'West Africa', experience: 'experienced' });
    t.impression('rutuba', 'classic-billboard');
    t.outcome({ kind: 'season', yield: 10, profit: 200, partners: [] });
    t.outcome({ kind: 'trial-farm', yield: 30, partners: [] });
    t.credits('tangi', 'water', 4, 'rainwater stored');
    const r = partnerReport(mem.events, { brands: ['hello-tractor'], campaigns: [{ brand: 'rutuba', spend: 100, currency: 'USD' }] });
    expect(r.brands.map(b => b.brand)).toEqual(['hello-tractor', 'rutuba', 'tangi']);
    const b = r.brands.find(x => x.brand === 'rutuba')!;
    expect(b.impressions).toBe(3); // 21
    expect(b.viewers).toBe(2);
    expect(b.taps).toBe(1); // 22
    expect(b.tapRate).toBeCloseTo(1 / 3, 3);
    expect(b.products).toMatchObject({ bought: 2, used: 1 }); // 23
    expect(b.lift).toEqual([{ kind: 'season', with: { n: 1, yield: 12, profit: 300 }, without: { n: 1, yield: 10, profit: 200 }, yieldLiftPct: 20, profitLift: 100 }]); // 24
    expect(b.reach).toEqual({ players: 2, byCountry: { KE: 1, GH: 1 }, byRegion: { 'East Africa': 1, 'West Africa': 1 } }); // 25
    expect(b.engagers).toEqual({ players: 1, byExperience: { new: 1 }, byAgeBand: { 'not collected': 1 } }); // 26
    expect(b.learning).toMatchObject({ completions: 1, players: 1, byKind: { lesson: 1 } }); // 27
    expect(r.brands.find(x => x.brand === 'tangi')!.credits).toEqual({ total: 4, byCredit: { water: 4 }, byPractice: { 'rainwater stored': 4 } }); // 28
    expect(b.leads).toEqual({ total: 1, players: 1, byKind: { offer_code: 1 } }); // 29
    expect(b.campaigns).toEqual([{ name: 'rutuba', spend: 100, currency: 'USD', engagedPlayers: 1, costPerEngaged: 100 }]); // 30
  });
});

const partnerEvents = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('lima-partner-events') ?? '[]') as { type: string; brand: string; [k: string]: unknown }[]);

test('the game records partner leads, products and learning', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ coins: 5000, settings: { ...(window as unknown as Win).__lima.state.settings, country: 'KE' } }));
  await page.evaluate(() => window.localStorage.removeItem('lima-partner-events'));
  const d = (a: Record<string, unknown>) => page.evaluate(x => (window as unknown as Win).__lima.dispatch(x), a);
  await d({ type: 'partnerSave', id: 'rutuba' });
  await d({ type: 'buy', id: 'rutuba-npk', name: 'Lima NPK', price: 315 });
  await d({ type: 'basicsRead', lesson: 0 });
  await expect.poll(async () => (await partnerEvents(page)).map(e => `${e.type}:${e.brand}`)).toEqual(['lead:rutuba', 'product:rutuba', 'learning:ujuzi']);
  const [lead, product] = await partnerEvents(page);
  expect(lead).toMatchObject({ kind: 'offer_code', ctx: { country: 'KE', region: 'East Africa', experience: 'new' } });
  expect(product).toMatchObject({ product: 'rutuba-npk', stage: 'bought', qty: 1 });
  // the game's own event log gets them too (sent on through the outbox when an events address is set)
  const names = await page.evaluate(() => (window as unknown as Win).__lima.events().map(e => e.name));
  expect(names).toEqual(expect.arrayContaining(['partner_lead', 'partner_product', 'partner_learning']));
});
