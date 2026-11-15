import { expect, test, type Page } from '@playwright/test';
import { boot, scenario, state } from './helpers';

/* Climate tracking: every job records its climate effect, and the Climate page shows it. */

type Lima = { __lima: { dispatch: (a: unknown) => void; jump: (s: Record<string, unknown>) => void; state: any } };
const act = (page: Page, a: Record<string, unknown>) => page.evaluate(x => (window as unknown as Lima).__lima.dispatch(x), a);
const jump = (page: Page, s: Record<string, unknown>) => page.evaluate(x => (window as unknown as Lima).__lima.jump(x), s);
const climate = async (page: Page) => (await state(page)).climate;
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Climate' });

test('the CLIMATE button sits beside MISSION and opens the Climate page; Back, Menu and Farm work', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  const btn = page.getByRole('button', { name: /^Climate:/ });
  const mission = page.getByRole('button', { name: /^Mission:/ });
  await expect(btn).toBeVisible();
  // beside Mission: same row, just to its left
  const [b, m] = [await btn.boundingBox(), await mission.boundingBox()];
  expect(Math.abs(b!.y - m!.y)).toBeLessThan(4);
  expect(m!.x - (b!.x + b!.width)).toBeLessThan(12);
  expect(m!.x).toBeGreaterThan(b!.x);

  await btn.click();
  await expect(dialog(page)).toBeVisible();
  for (const t of ['Overview', 'Emissions', 'Water & soil', 'Climate shocks', 'Activity']) await expect(dialog(page).getByRole('button', { name: t, exact: true })).toBeVisible();
  for (const nav of ['Back', 'Main menu', 'Back to my farm']) await expect(dialog(page).getByRole('button', { name: nav, exact: true })).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog(page)).toBeHidden();

  // the main menu has it too, and Back goes back to the menu
  await page.locator('.hud-menu').click();
  await page.getByRole('dialog', { name: 'Main menu' }).getByRole('button', { name: 'Climate', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Main menu' })).toBeVisible();
});

test('a Farm Moja task is tracked: manure stores carbon, earns credits and shows in Activity', async ({ page }) => {
  await boot(page);
  await jump(page, { view: 'classic', modal: { kind: 'steps', step: 'landprep' } });
  await page.getByRole('button', { name: 'Organic Manure, 400 coins' }).click();
  await expect.poll(async () => (await climate(page)).total.stored).toBe(40);
  const c = await climate(page);
  expect(c.total.co2).toBeCloseTo(6, 5);
  expect(c.credits).toBeCloseTo(4, 5);
  expect(c.log[0].label).toContain('Organic Manure');

  // a chemical task pollutes
  await page.getByRole('button', { name: 'Herbicide, 400 coins' }).click();
  await expect.poll(async () => (await climate(page)).total.pollution).toBe(8);

  await act(page, { type: 'open', modal: { kind: 'climate', tab: 'activity' } });
  await expect(dialog(page).getByText('Farm Moja · Organic Manure')).toBeVisible();
  await expect(dialog(page).getByText('Farm Moja · Herbicide')).toBeVisible();
});

test('six farms: planting records each plan; tractor work and drives burn diesel; the harvest closes the cycle', async ({ page }) => {
  await boot(page);
  // a planned cycle (the first one plants itself: maize and sukuma wiki), so the plans can differ
  await jump(page, { view: 'classic', coins: 5000, trialHistory: [{ cycle: 1, farms: 2, best: 0, bags: [5, 5], profit: [0, 0] }] });
  await act(page, { type: 'trialNew' });
  // six farms may not share a plan: one change each, then Farm 2's own
  await act(page, { type: 'trialSuggest' });
  await act(page, { type: 'trialPlan', farm: 1, key: 'fert', value: 'double' });
  await act(page, { type: 'trialPlan', farm: 1, key: 'land', value: 'tractor' });
  await act(page, { type: 'trialPlant', clock: 'fast' });
  let c = await climate(page);
  const planted = c.log.filter((e: { label: string }) => /planted/.test(e.label));
  expect(planted.length).toBe((await state(page)).trial.plans.length);
  expect(c.total.fertN).toBeGreaterThanOrEqual(7);
  expect(c.co2By.fertilizer).toBeGreaterThanOrEqual(70);

  // ploughing Farm 2 from the tractor seat: a compact tractor over five of its 20 plots, a large one over five more
  const mask = (plot: number) => { let m = 0; for (let i = plot; i < 20; i += 4) m |= 1 << i; return m; };
  await act(page, { type: 'fieldMark', farm: 1, job: 'prep', bits: mask(0), tractor: true, rig: { tractor: 'compact', tool: 'plough', job: 'prep' } });
  await act(page, { type: 'fieldMark', farm: 1, job: 'prep', bits: mask(1), tractor: true, rig: { tractor: 'large', tool: 'harrow', job: 'prep' } });
  c = await climate(page);
  // five plots are a quarter of the farm; a compact tractor burns 6/9 of the standard's diesel, a large one 14/9
  const litres = (13 / 6) * 0.25 * (6 / 9 + 14 / 9);
  expect(c.total.diesel).toBeCloseTo(litres, 3);
  expect(c.co2By.fuel).toBeCloseTo(litres * 2.68, 3);

  // a tractor drive: the diesel it really burned, and a credit for a clean drive
  const credits = c.credits;
  await act(page, { type: 'tractorDone', farm: 1, score: 80, stars: 3, Q: 0.9, coins: 0, points: 0, diesel: 1.5, co2: 4.02, clim: 85 });
  c = await climate(page);
  expect(c.total.diesel).toBeCloseTo(litres + 1.5, 3);
  expect(c.drives.n).toBe(1);
  expect(c.credits).toBeCloseTo(credits + 1, 5);

  // the harvest: food grown, and the cycle joins the history
  const trial = (await state(page)).trial;
  await act(page, { type: 'reset', state: { trial: { ...trial, day: 7 } } });
  await act(page, { type: 'trialHarvest' });
  c = await climate(page);
  expect(c.total.yieldKg).toBeGreaterThan(0);
  expect(c.cycles.length).toBe(1);
  expect(c.cycles[0].label).toContain('Six farms');
  expect(c.season.co2).toBe(0);
});

test('selling Farm Moja: transport and storage, food lost, and the rating appears on the button', async ({ page }) => {
  await boot(page);
  await jump(page, { view: 'world', stage: 6, harvested: { bags: 120, quality: 4 }, storage: 'cold', stepScores: { landprep: 1, planting: 1, fertilizer: 1, pesticides: 1, water: 1, harvest: 1 } });
  await act(page, { type: 'completeSale', processId: 'processing' });
  const c = await climate(page);
  expect(c.co2By.transport).toBeGreaterThan(0);
  expect(c.co2By.storage).toBeGreaterThan(0);
  expect(c.total.yieldKg).toBe(120 * 90);
  expect(c.cycles[0].label).toContain('Farm Moja');
  await act(page, { type: 'close' });
  await expect(page.getByRole('button', { name: /^Climate: .*\(rating [A-E]\)/ })).toBeVisible();
});

test('credits past a climate level pay points once', async ({ page }) => {
  await boot(page);
  const base = (await state(page)).climate;
  await jump(page, { view: 'classic', points: 0, climate: { ...base, credits: 9.5 } });
  await act(page, { type: 'task', step: 'landprep', id: 'lp-manure', price: 40, name: 'Organic Manure' });
  const s = await state(page);
  expect(s.climate.level).toBe(1);
  expect(s.points).toBe(100);
  expect(s.toast.text).toContain('Grower');
});

test('Land & pay: the six farms plot by plot, and the day’s credits paid at midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T23:57:00') });
  await boot(page);
  await jump(page, { view: 'classic', coins: 1000 });
  // today's work: organic manure stores 40 kg (4 credits); the first action starts the day's count
  await act(page, { type: 'task', step: 'landprep', id: 'lp-manure', price: 40, name: 'Organic Manure' });
  let s = await state(page);
  expect(s.climate.pay.day).toBe('2026-11-15');
  expect(s.coins).toBe(960);

  await act(page, { type: 'open', modal: { kind: 'climate', tab: 'land' } });
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/climate/land-and-pay');
  await expect(dialog(page).getByRole('button', { name: 'Land & pay', exact: true })).toHaveAttribute('aria-current', 'page');
  // no crop yet: all 120 plots idle
  await expect(dialog(page).getByRole('img', { name: 'Land today: 0 plots farmed, 0 bare, 120 idle' })).toBeVisible();
  await expect(dialog(page).getByText('About 200 coins tonight')).toBeVisible();

  // past midnight: the game's minute check pays the day's 4 credits (5 coins each, 50 on screen)
  await page.clock.fastForward('05:00');
  await expect.poll(async () => (await state(page)).coins).toBe(980);
  s = await state(page);
  expect(s.climate.pay.payments[0]).toMatchObject({ label: 'Sun 15 Nov', credits: 4, coins: 20, idle: 120 });
  expect(s.climate.pay.day).toBe('2026-11-16');
  await expect(dialog(page).getByText('+200 coins')).toBeVisible();
  await expect(dialog(page).getByText('Paid in all')).toBeVisible();
});
