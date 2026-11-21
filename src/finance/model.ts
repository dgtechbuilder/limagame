/* The farmer's finances: a savings account, investments, and profit tracking. No screens here (Finance.tsx), so the
   saved game and the tests can use it.

   Money is stored money (src/money.ts: 1 = KSh 10). Interest and returns are settled each time a farm day ends: a
   farm day counts as one week of interest, so a yearly rate is paid a 52nd at a time (the game's 30 farm days are
   about seven months of saving). Rates are game figures in the range of Kenyan products in 2026: SACCO savings,
   money market funds, the 91-day Treasury bill and shares on the Nairobi Securities Exchange; they are for learning,
   not advice.

   Moving money between the wallet and savings or an investment is not income or spending: the wallet writes it under
   "Savings & investments" (kind 'savings'), and profit tracking leaves it out. What the money earns (interest, a
   share price going up or down) is counted in `earned`. */

import type { WalletKind, WalletState } from '../wallet/model';

export type ProductId = 'savings' | 'mmf' | 'tbill' | 'shares';

export interface Product {
  id: ProductId;
  name: string;
  icon: string;
  does: string;
  /** a year, as a share (0.1 = 10%) */
  rate: number;
  risk: 'none' | 'low' | 'medium';
  /** farm days the money is locked in (0: take it out any time) */
  lockDays: number;
  /** the least that can go in (stored money) */
  min: number;
  /** a share of the amount taken when it comes out (shares: the broker's fee) */
  exitFee: number;
  /** shares: the most a day's price can move, up or down, as a share */
  swing: number;
}

/** A farm day is a week of interest. */
export const WEEKS_A_DAY = 1;
export const WEEKS_A_YEAR = 52;

export const PRODUCTS: Record<ProductId, Product> = {
  savings: {
    id: 'savings',
    name: 'SACCO savings',
    icon: '🏦',
    does: 'Money in the farmers’ SACCO: safe, paid in and taken out any time, and it earns a little every day.',
    rate: 0.06,
    risk: 'none',
    lockDays: 0,
    min: 10,
    exitFee: 0,
    swing: 0,
  },
  mmf: {
    id: 'mmf',
    name: 'Money market fund',
    icon: '📈',
    does: 'A fund that lends to banks and the government: more than savings, out in a day, a very small risk.',
    rate: 0.1,
    risk: 'low',
    lockDays: 0,
    min: 100,
    exitFee: 0,
    swing: 0,
  },
  tbill: {
    id: 'tbill',
    name: '91-day Treasury bill',
    icon: '🏛️',
    does: 'Lend to the government for 91 days (13 farm days): a fixed rate, paid back with interest into your wallet. Out early and the interest is lost.',
    rate: 0.13,
    risk: 'none',
    lockDays: 13,
    min: 1000,
    exitFee: 0,
    swing: 0,
  },
  shares: {
    id: 'shares',
    name: 'Agribusiness shares',
    icon: '🌾',
    does: 'Shares in farm companies on the stock exchange: the most over time, but the price goes down as well as up. Selling costs 1.5%.',
    rate: 0.15,
    risk: 'medium',
    lockDays: 0,
    min: 500,
    exitFee: 0.015,
    swing: 0.04,
  },
};
export const PRODUCT_ORDER: ProductId[] = ['savings', 'mmf', 'tbill', 'shares'];
/** The investments (savings is its own account). */
export const INVESTMENTS: ProductId[] = ['mmf', 'tbill', 'shares'];

/** A day's interest, as a share, at a yearly rate. */
export const dayRate = (yearRate: number) => (yearRate * WEEKS_A_DAY) / WEEKS_A_YEAR;

export interface Holding {
  id: number;
  product: Exclude<ProductId, 'savings'>;
  /** what went in */
  principal: number;
  /** what it is worth now */
  value: number;
  /** the farm day it went in, and (a T-bill) the farm day it is paid back */
  since: number;
  matures?: number;
}

export interface Goal {
  name: string;
  target: number;
}

export interface FinanceState {
  /** the SACCO savings balance */
  savings: number;
  holdings: Holding[];
  /** the farm day returns were last settled up to */
  settled: number;
  /** all time: interest and gains (and losses) the savings and investments made */
  earned: number;
  /** all time, by product */
  earnedBy: Partial<Record<ProductId, number>>;
  goal: Goal | null;
  /** newest last: what was saved and invested at the end of each farm day (the last DAYS_KEPT) */
  days: { day: number; savings: number; invested: number; earned: number }[];
  /** newest first: what happened (the last 40) */
  log: { day: number; text: string }[];
}

export const DAYS_KEPT = 60;

export const emptyFinance = (): FinanceState => ({ savings: 0, holdings: [], settled: 1, earned: 0, earnedBy: {}, goal: null, days: [], log: [] });
export const financeOf = (f: Partial<FinanceState> | undefined): FinanceState => ({ ...emptyFinance(), ...(f ?? {}), holdings: f?.holdings ?? [], earnedBy: { ...(f?.earnedBy ?? {}) }, days: f?.days ?? [], log: f?.log ?? [] });

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What the investments are worth now. */
export const investedValue = (f: FinanceState) => f.holdings.reduce((n, h) => n + h.value, 0);
/** What went into the investments still held. */
export const investedPrincipal = (f: FinanceState) => f.holdings.reduce((n, h) => n + h.principal, 0);

/** A share price's move on a farm day, the same for every player on that day: an even spread round the average. */
export function sharesMove(day: number, p: Product = PRODUCTS.shares): number {
  let h = 2166136261 ^ (day * 2654435761);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  const u = (((h ^ (h >>> 15)) >>> 0) / 4294967296) * 2 - 1;
  return dayRate(p.rate) + u * p.swing;
}

/** What taking a holding out pays into the wallet now: a T-bill out before it matures gets its principal back only;
    shares pay the broker's fee. */
export function payoutOf(h: Holding, day: number): { pay: number; fee: number; early: boolean } {
  const p = PRODUCTS[h.product];
  const early = h.product === 'tbill' && (h.matures ?? 0) > day;
  const gross = early ? h.principal : h.value;
  const fee = r2(gross * p.exitFee);
  return { pay: r2(gross - fee), fee, early };
}

/** Why money can't go in (or come out), or null. */
export function depositBlock(product: ProductId, amount: number, coins: number): string | null {
  if (!(amount > 0)) return 'Pick an amount';
  if (amount < PRODUCTS[product].min) return `The least is ${PRODUCTS[product].min}`;
  if (amount > coins) return 'Not enough in your wallet';
  return null;
}

/** The days from `f.settled` to `day` are settled: savings and the money market fund earn their day's interest, a
    T-bill grows towards its fixed return, shares move with the market, and a T-bill whose day has come is paid back
    (paid: what goes into the wallet). */
export function settle(f: FinanceState, day: number): { f: FinanceState; paid: { label: string; amount: number }[] } {
  if (day <= f.settled) return { f, paid: [] };
  let savings = f.savings;
  let holdings = f.holdings.map(h => ({ ...h }));
  let earned = f.earned;
  const earnedBy = { ...f.earnedBy };
  const days = [...f.days];
  const log = [...f.log];
  const paid: { label: string; amount: number }[] = [];
  const gain = (id: ProductId, n: number) => {
    earned = r2(earned + n);
    earnedBy[id] = r2((earnedBy[id] ?? 0) + n);
  };
  for (let d = f.settled + 1; d <= day; d++) {
    const si = r2(savings * dayRate(PRODUCTS.savings.rate));
    savings = r2(savings + si);
    if (si) gain('savings', si);
    for (const h of holdings) {
      const p = PRODUCTS[h.product];
      const move = h.product === 'shares' ? sharesMove(d) : dayRate(p.rate);
      const n = r2(h.value * move);
      h.value = r2(h.value + n);
      gain(h.product, n);
    }
    // T-bills that have reached their day are paid back
    const due = holdings.filter(h => h.product === 'tbill' && (h.matures ?? 0) <= d);
    for (const h of due) {
      paid.push({ label: 'Treasury bill paid back with interest', amount: h.value });
      log.unshift({ day: d, text: `A Treasury bill was paid back with interest.` });
    }
    holdings = holdings.filter(h => !due.includes(h));
    days.push({ day: d, savings, invested: investedValue({ ...f, holdings }), earned });
  }
  return { f: { ...f, savings, holdings, earned, earnedBy, settled: day, days: days.slice(-DAYS_KEPT), log: log.slice(0, 40) }, paid };
}

/* ---------------- profit tracking ---------------- */

/** The parts of the farm that earn and spend: each a group of the wallet's kinds. Savings moves are left out. */
export type Enterprise = 'crops' | 'stall' | 'animals' | 'tractor' | 'climate' | 'overheads' | 'other';

export const ENTERPRISES: { id: Enterprise; label: string; icon: string; kinds: WalletKind[]; note: string }[] = [
  { id: 'crops', label: 'Crops and the six farms', icon: '🌽', kinds: ['harvest', 'farm', 'shop', 'water'], note: 'Seed, inputs, treatments and water against the harvests sold' },
  { id: 'stall', label: 'Market stall and restaurant', icon: '🧺', kinds: ['produce'], note: 'Food sold raw and as meals' },
  { id: 'animals', label: 'Animals', icon: '🐄', kinds: ['animals'], note: 'Milk and eggs against feed, care and the herd' },
  { id: 'tractor', label: 'Tractor', icon: '🚜', kinds: ['tractor', 'business'], note: 'Drives, diesel, service and repairs' },
  { id: 'climate', label: 'Climate payments', icon: '🌍', kinds: ['climate'], note: 'Paid for the carbon the farm keeps' },
  { id: 'overheads', label: 'Power and security', icon: '⚡', kinds: ['power', 'security'], note: 'Costs that keep the farm running' },
  { id: 'other', label: 'Rewards, gifts and other', icon: '🏅', kinds: ['reward', 'giving', 'other'], note: 'Rewards claimed, gifts given, overnight wages' },
];

export interface Line {
  in: number;
  out: number;
}
export const profitOf = (l: Line) => l.in - l.out;
/** Profit as a share of what came in (null with nothing in). */
export const marginOf = (l: Line) => (l.in > 0 ? (l.in - l.out) / l.in : null);

const sumKinds = (by: Partial<Record<WalletKind, Line>>, kinds: WalletKind[]): Line =>
  kinds.reduce((t, k) => ({ in: t.in + (by[k]?.in ?? 0), out: t.out + (by[k]?.out ?? 0) }), { in: 0, out: 0 });

/** Each enterprise's money in and out, all time (from the wallet's totals, which are never trimmed). */
export function enterprises(w: WalletState): { id: Enterprise; line: Line }[] {
  return ENTERPRISES.map(e => ({ id: e.id, line: sumKinds(w.totals, e.kinds) }));
}

/** Money in and out on each farm day (savings moves left out), oldest first, the last `n` days that had any. */
export function dailyProfit(w: WalletState, n = 14): { day: number; line: Line; by: Partial<Record<Enterprise, Line>> }[] {
  const days = Object.keys(w.days ?? {})
    .map(Number)
    .sort((a, b) => a - b)
    .slice(-n);
  return days.map(day => {
    const k = w.days![day];
    const by: Partial<Record<Enterprise, Line>> = {};
    for (const e of ENTERPRISES) {
      const l = sumKinds(k, e.kinds);
      if (l.in || l.out) by[e.id] = l;
    }
    const line = Object.values(by).reduce((t, l) => ({ in: t.in + l.in, out: t.out + l.out }), { in: 0, out: 0 });
    return { day, line, by };
  });
}

/** The farm's profit, all time: every enterprise together, with the savings' and investments' earnings. */
export function farmProfit(w: WalletState, f: FinanceState) {
  const lines = enterprises(w);
  const total = lines.reduce((t, e) => ({ in: t.in + e.line.in, out: t.out + e.line.out }), { in: 0, out: 0 });
  return { lines, total, earned: f.earned, profit: profitOf(total) + f.earned };
}
