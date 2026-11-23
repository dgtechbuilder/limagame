import { expect, test } from '@playwright/test';
import { boot, type Win } from './helpers';
import { sustainability, bandOf } from '../src/tracking/model';
import { initialClimate } from '../src/climate/model';

/* Tracking (src/tracking): the sustainability score out of 100 on the farm's home screen, in place of the night chip;
   the Tracking page with a section for each thing worth watching; and the Sustainability section of Mission. */

const base = { climate: initialClimate, trialHistory: [], inventory: [], coins: 0 };

test('the score: 0 to 100, parts with no data left out, and it rises with better farming', () => {
  const fresh = sustainability(base, '2026-11-23');
  expect(fresh.score).toBeGreaterThanOrEqual(0);
  expect(fresh.score).toBeLessThanOrEqual(100);
  expect(fresh.parts).toHaveLength(8);
  // no money moved and animals not in care yet: those parts wait
  expect(fresh.parts.find(p => p.id === 'money')!.score).toBeNull();
  expect(fresh.parts.find(p => p.id === 'animals')!.score).toBeNull();

  // a farm that keeps carbon, catches its rain and runs on the sun scores higher than one that burns diesel
  const good = sustainability(
    {
      ...base,
      climate: { ...initialClimate, total: { ...initialClimate.total, co2: 200, stored: 400, yieldKg: 900, soil: 10 } },
      tank: { days: [{ label: 'd', date: '2026-11-22', rain: 900, house: 300, animals: 200, farms: 300, short: 0, level: 500, credits: 5, dam: 0, irrigationWant: 0, irrigationGot: 0, rationed: false }] },
      power: { parts: { panels: { day: 1, score: 1 }, inverter: { day: 2, score: 1 }, battery: { day: 3, score: 1 } }, history: [{ day: 1, solar: 10, gen: 0, need: 10, used: 10, served: 1, fuelL: 0, water: 0, battery: 0, avoided: 5, emitted: 0, saved: 0 }], totals: { solar: 10, gen: 0, used: 10, fuelL: 0, water: 0, avoided: 5, emitted: 0, saved: 0, days: 1 } },
      wallet: { entries: [], totals: { harvest: { in: 5000, out: 0 }, farm: { in: 0, out: 2000 } } },
    },
    '2026-11-23',
  );
  const poor = sustainability(
    {
      ...base,
      climate: { ...initialClimate, total: { ...initialClimate.total, co2: 3000, stored: 0, yieldKg: 900, pollution: 40, sprays: 8, soil: -10 } },
      tank: { days: [{ label: 'd', date: '2026-11-22', rain: 50, house: 300, animals: 200, farms: 300, short: 400, level: 0, credits: 0, dam: 0, irrigationWant: 0, irrigationGot: 0, rationed: true }] },
      power: { history: [{ day: 1, solar: 0, gen: 10, need: 10, used: 5, served: 0.5, fuelL: 4, water: 0, battery: 0, avoided: 0, emitted: 10, saved: 0 }], totals: { solar: 0, gen: 10, used: 5, fuelL: 4, water: 0, avoided: 0, emitted: 10, saved: 0, days: 1 } },
      wallet: { entries: [], totals: { harvest: { in: 1000, out: 0 }, farm: { in: 0, out: 3000 } } },
    },
    '2026-11-23',
  );
  expect(good.score).toBeGreaterThan(poor.score + 25);
  expect(bandOf(good.score).tone).toBe('good');
  expect(bandOf(poor.score).tone).toBe('bad');
});

test('the farm shows the sustainability score (no night chip); it opens Tracking, and Mission has a Sustainability section', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.scenario('plots'));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ ...L.state, settings: { ...L.state.settings, night: 'night' } });
  });
  const chip = page.locator('.hud-sustain');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText(/\d+\/100/);
  await expect(page.locator('.hud-moon')).toHaveCount(0);

  // the chip opens Tracking at the score's breakdown
  await chip.click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/tracking/sustainability');
  await expect(page.locator('.sus-part')).toHaveCount(8);
  // each section has its own address
  for (const [tab, word] of [['Water', 'water'], ['Power', 'power'], ['Profit', 'profit-and-costs'], ['Harvests', 'harvests']] as const) {
    await page.locator('.set-tab', { hasText: tab }).click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#/tracking/${word}`);
    if (word === 'profit-and-costs') await expect(page.getByText('Expenses against the harvest')).toBeVisible();
  }

  // Mission: the switch opens the Sustainability section, and Back returns to the farms
  await page.evaluate(() => (window.location.hash = '#/mission'));
  await page.locator('.ms-switch').click();
  await expect(page.locator('.ms-sustain')).toBeVisible();
  await expect(page.locator('.ms-sustain .sus-part')).toHaveCount(8);
  await page.locator('.ms-switch').click();
  await expect(page.locator('.ms-sustain')).toHaveCount(0);

  // the score can be hidden from the farm (Settings → Home screen)
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ ...L.state, trialsOpen: false, modal: null, settings: { ...L.state.settings, hud: { ...(L.state.settings.hud ?? {}), sustain: false } } });
  });
  await expect(page.locator('.hud-avatar')).toBeVisible();
  await expect(page.locator('.hud-sustain')).toHaveCount(0);
});
