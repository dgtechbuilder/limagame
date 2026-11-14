import { expect, test, type Page } from '@playwright/test';
import { SELLING, initialState, reducer, saleQuote, type GameState } from '../src/state';
import { pathOf, routeTo } from '../src/route';
import { DEFAULT_LOAN, loanQuote, monthlyPayment } from '../src/finance/loan';
import { COURSES } from '../src/training/data';
import { boot } from './helpers';

/* The dialogs after something worked (a sale, a training booked, a storage upgrade), the loan calculator and its
   quote, and the ✕ on every dialog. */

const done: Partial<GameState> = { fs: { phase: 'done', at: 'first', opened: true }, onboarded: true, farmer: { name: 'Wanjiku', look: 0 } };
const selling = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  ...done,
  stage: SELLING,
  harvested: { bags: 100, quality: 5 },
  stepScores: { landprep: 1, planting: 1, fertilizer: 1, pesticides: 1, water: 1, harvest: 1 },
  ...patch,
});

test('a sale opens the Sale Success dialog instead of a passing message; a second sale adds to it', () => {
  let s: GameState = { ...initialState, ...done, coins: 100 };
  s = reducer(s, { type: 'sell', id: 'maize', price: 40, name: 'Maize' });
  expect(s.success).toMatchObject({ kind: 'sale', from: 'shop', qty: 1, earned: 40, left: 2 });
  expect(s.toast).toBeNull();
  s = reducer(s, { type: 'sell', id: 'maize', price: 40, name: 'Maize' });
  expect(s.success).toMatchObject({ qty: 2, earned: 80, left: 1 });
  expect(s.coins).toBe(180);
  expect(reducer(s, { type: 'dismissSuccess' }).success).toBeNull();

  // the season's sale: the dialog says what was earned, over the season results
  const q = saleQuote(selling(), null);
  const sold = reducer(selling(), { type: 'completeSale', processId: null });
  expect(sold.modal).toEqual({ kind: 'outcome' });
  expect(sold.success).toMatchObject({ kind: 'sale', from: 'season', qty: q.bagsSold, earned: q.revenue, points: q.bagsSold * 5 });
});

test('a storage upgrade opens its dialog, unless it was turned off; a downgrade does not', () => {
  const up = reducer(selling({ storage: 'home' }), { type: 'storage', id: 'cold' });
  expect(up.storage).toBe('cold');
  expect(up.success).toMatchObject({ kind: 'storage', from: 'home', to: 'cold' });
  expect((up.success as { saved: number }).saved).toBeGreaterThan(0);
  expect(reducer(selling({ storage: 'cold' }), { type: 'storage', id: 'home' }).success).toBeNull();
  const off = selling({ storage: 'home', settings: { ...initialState.settings, upgradeNotes: false } });
  expect(reducer(off, { type: 'storage', id: 'cold' }).success).toBeNull();
});

test('booking a training: a seat, a reminder in Messages and the Booking Success dialog; paid once', () => {
  const paid = COURSES.find(c => c.price > 0)!;
  let s: GameState = { ...initialState, ...done, coins: 1000 };
  s = reducer(s, { type: 'bookTraining', id: paid.id });
  expect(s.coins).toBe(1000 - paid.price);
  expect(s.trainings).toHaveLength(1);
  expect(s.success).toMatchObject({ kind: 'training', course: paid.id, ref: s.trainings![0].ref });
  expect(s.note).toContain(paid.title);
  const again = reducer(s, { type: 'bookTraining', id: paid.id });
  expect(again.coins).toBe(s.coins);
  expect(again.trainings).toHaveLength(1);
  // not enough coins: a message, no seat
  const poor = reducer({ ...initialState, ...done, coins: 0 }, { type: 'bookTraining', id: paid.id });
  expect(poor.trainings).toHaveLength(0);
  expect(poor.toast?.text).toContain('You need');
});

test('the loan quote: a steady repayment, the voucher lowers the rate, and the verdict follows income', () => {
  // 12,000 over 12 months at 12% a year: about 1,066 a month
  expect(monthlyPayment(12000, 12, 12)).toBeCloseTo(1066.19, 1);
  const q = loanQuote({ purpose: 'irrigation', amount: 12000, months: 12 }, 10000, false);
  expect(q.schedule.reduce((n, m) => n + m.principal, 0)).toBeCloseTo(12000, 4);
  expect(q.total).toBeCloseTo(12000 + q.interest + q.fee, 6);
  expect(q.verdict).toBe('comfortable');
  expect(loanQuote(q.ask, 1500, false).verdict).toBe('risky');
  expect(loanQuote(q.ask, 10000, true).rate).toBeLessThan(q.rate);
  // the quote has its own address
  const s: GameState = { ...initialState, ...done, modal: { kind: 'loan', view: 'quote' } };
  expect(pathOf(s)).toBe('/loan-calculator/quote');
  expect(routeTo({ ...s, modal: null }, '#/loan-calculator/quote')).toEqual([{ type: 'open', modal: { kind: 'loan', view: 'quote' } }]);
  expect(DEFAULT_LOAN.amount).toBeGreaterThan(0);
});

/* ---------------- in the game ---------------- */

const jump = (page: Page, s: Record<string, unknown>) =>
  page.evaluate(st => (window as unknown as { __lima: { jump: (s: Record<string, unknown>) => void } }).__lima.jump(st), { ...done, view: 'classic', ...s });

test('loan calculator → Get my quote → the Loan Quote Result; the ✕ closes it', async ({ page }) => {
  await boot(page);
  await jump(page, { modal: { kind: 'menu' } });
  await page.getByRole('dialog', { name: 'Main menu' }).getByRole('button', { name: 'Loan calculator', exact: true }).click();
  const calc = page.getByRole('dialog', { name: 'Loan calculator' });
  await expect(calc).toBeVisible();
  await calc.getByRole('radio', { name: /Irrigation/ }).click();
  await calc.getByRole('button', { name: 'Borrow more' }).click();
  await calc.getByRole('radio', { name: '12', exact: true }).click();
  await calc.getByRole('button', { name: 'Get my quote' }).click();
  const quote = page.getByRole('dialog', { name: 'Your loan quote' });
  await expect(quote).toBeVisible();
  await expect(quote).toContainText('You would pay');
  await expect(quote).toContainText('for 12 months at 12% a year');
  await expect(quote.locator('.loan-verdict')).toHaveText(/Comfortable|Tight|Risky/);
  await quote.getByRole('button', { name: /Change the amounts/ }).click();
  await expect(calc).toBeVisible();
  await calc.getByRole('button', { name: 'Get my quote' }).click();
  await quote.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(quote).toBeHidden();
});

test('training: book a seat, the Booking Success dialog, then the course shows as booked', async ({ page }) => {
  await boot(page);
  await jump(page, { modal: { kind: 'training' } });
  const list = page.getByRole('dialog', { name: 'Farmer training' });
  await list.getByRole('button', { name: /^Book Healthy soil/ }).click();
  const ok = page.getByRole('dialog', { name: 'Booking confirmed' });
  await expect(ok).toBeVisible();
  await expect(ok).toContainText('You’re booked, Wanjiku!');
  await expect(ok.locator('.success-ref')).toHaveText(/^LIMA-SOIL-\d{4}$/);
  await ok.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(ok).toBeHidden();
  await expect(list.getByRole('button', { name: /Healthy soil, bigger harvests: booked/ })).toBeVisible();
});

test('selling food in the shop opens the Sale Success dialog; Escape closes only the dialog', async ({ page }) => {
  await boot(page);
  await jump(page, { modal: { kind: 'shop', tab: 'food' } });
  await page.getByRole('button', { name: /^Sell Maize/ }).click();
  const ok = page.getByRole('dialog', { name: /Sale complete/ });
  await expect(ok).toBeVisible();
  await expect(ok).toContainText('Sold 1 bag of Maize');
  await ok.getByRole('button', { name: 'Sell another maize' }).click();
  await expect(ok).toContainText('Sold 2 bags of Maize');
  await page.keyboard.press('Escape');
  await expect(ok).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Shop' })).toBeVisible();
});

test('the storage upgrade dialog, and "Don’t show this" turns it off', async ({ page }) => {
  await boot(page);
  await jump(page, { stage: SELLING, harvested: { bags: 120, quality: 4 }, storage: 'home', modal: { kind: 'storage' } });
  await page.getByRole('button', { name: 'Select Cold storage' }).click();
  const ok = page.getByRole('dialog', { name: 'Storage upgraded' });
  await expect(ok).toBeVisible();
  await ok.getByRole('checkbox').check();
  await ok.getByRole('button', { name: 'Stay here' }).click();
  await expect(ok).toBeHidden();
  await page.getByRole('button', { name: 'Select Home Storage' }).click();
  await page.getByRole('button', { name: 'Select Cooperative warehouse' }).click();
  await expect(ok).toBeHidden();
});

test('full pages have a ✕ in the top-right corner', async ({ page }) => {
  await boot(page);
  for (const [modal, name] of [
    [{ kind: 'settings', tab: 'game' }, 'Settings'],
    [{ kind: 'climate', tab: 'overview' }, 'Climate'],
    [{ kind: 'achievements', tab: 'today' }, 'Achievements'],
  ] as const) {
    await jump(page, { modal });
    const d = page.getByRole('dialog', { name, exact: true });
    const x = d.getByRole('button', { name: 'Close', exact: true });
    await expect(x).toBeVisible();
    const box = (await x.boundingBox())!;
    expect(box.x).toBeGreaterThan(800);
    expect(box.y).toBeLessThan(40);
    await x.click();
    await expect(d).toBeHidden();
  }
});
