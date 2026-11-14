/* The loan calculator: what a farm loan would cost, month by month, before the player takes one anywhere.
   It is a calculator only: no coins change hands. Rates are game figures for learning, in the range of Kenyan
   agricultural loans (about 12–18% a year on a reducing balance, plus a one-off processing fee). Amounts are kept
   like every other value in the game (src/money.ts) and shown 10 times larger. */

export type LoanPurpose = 'inputs' | 'irrigation' | 'storage' | 'equipment';

export interface LoanAsk {
  purpose: LoanPurpose;
  /** coins, as stored (shown 10 times larger) */
  amount: number;
  months: number;
}

export const LOAN_PURPOSES: { id: LoanPurpose; label: string; icon: string; rate: number; note: string }[] = [
  { id: 'inputs', label: 'Seed & fertilizer', icon: '🌱', rate: 14, note: 'Paid back from the next harvest' },
  { id: 'irrigation', label: 'Irrigation', icon: '💧', rate: 12, note: 'A green loan: a lower rate' },
  { id: 'storage', label: 'Storage upgrade', icon: '🏚️', rate: 12, note: 'Less grain lost after harvest' },
  { id: 'equipment', label: 'Tools & equipment', icon: '🛠️', rate: 16, note: 'The tool is the security' },
];

export const LOAN_MONTHS = [3, 6, 9, 12, 18];
export const LOAN_MIN = 500;
export const LOAN_MAX = 50000;
export const LOAN_STEP = 500;
/** one-off processing fee, as a share of the amount */
export const LOAN_FEE = 0.015;
/** the Phone Loan Discount voucher (Rewards) takes this share off the interest rate */
export const VOUCHER_OFF = 0.1;
/** a season of maize, planting to sale, in months: the harvest pays for this many months of repayments */
export const SEASON_MONTHS = 4;

export const DEFAULT_LOAN: LoanAsk = { purpose: 'inputs', amount: 1000, months: 6 };

export const purposeOf = (id: LoanPurpose) => LOAN_PURPOSES.find(p => p.id === id) ?? LOAN_PURPOSES[0];

/** The repayment on a reducing balance: the same amount every month. */
export function monthlyPayment(amount: number, yearRate: number, months: number) {
  const r = yearRate / 100 / 12;
  if (r === 0) return amount / months;
  return (amount * r) / (1 - (1 + r) ** -months);
}

/** The most that can be borrowed for a given monthly repayment. */
export function principalFor(monthly: number, yearRate: number, months: number) {
  const r = yearRate / 100 / 12;
  if (r === 0) return monthly * months;
  return (monthly * (1 - (1 + r) ** -months)) / r;
}

export type Affordability = 'comfortable' | 'tight' | 'risky';

export interface LoanQuote {
  ask: LoanAsk;
  /** interest a year, in percent, after the voucher */
  rate: number;
  baseRate: number;
  voucher: boolean;
  monthly: number;
  interest: number;
  fee: number;
  /** everything paid back: the amount, the interest and the fee */
  total: number;
  /** each month: how much of the repayment is the loan and how much is interest */
  schedule: { month: number; principal: number; interest: number }[];
  /** coins a month the farm earns, the best estimate the game has */
  income: number;
  /** the repayment as a share of that income */
  share: number;
  verdict: Affordability;
  /** the most that can be borrowed over the same months with the repayment at 30% of income */
  safeAmount: number;
}

export function loanQuote(ask: LoanAsk, income: number, voucher: boolean): LoanQuote {
  const baseRate = purposeOf(ask.purpose).rate;
  const rate = voucher ? Math.round(baseRate * (1 - VOUCHER_OFF) * 10) / 10 : baseRate;
  const monthly = monthlyPayment(ask.amount, rate, ask.months);
  const r = rate / 100 / 12;
  let balance = ask.amount;
  const schedule = Array.from({ length: ask.months }, (_, i) => {
    const interest = balance * r;
    const principal = monthly - interest;
    balance -= principal;
    return { month: i + 1, principal, interest };
  });
  const interest = monthly * ask.months - ask.amount;
  const fee = ask.amount * LOAN_FEE;
  const share = income > 0 ? monthly / income : Infinity;
  const verdict: Affordability = share <= 0.3 ? 'comfortable' : share <= 0.5 ? 'tight' : 'risky';
  const safeAmount = Math.max(0, Math.floor(principalFor(income * 0.3, rate, ask.months) / LOAN_STEP) * LOAN_STEP);
  return { ask, rate, baseRate, voucher, monthly, interest, fee, total: ask.amount + interest + fee, schedule, income, share, verdict, safeAmount };
}

export const VERDICT_TEXT: Record<Affordability, { label: string; line: string }> = {
  comfortable: { label: 'Comfortable', line: 'The repayment takes under a third of what the farm earns a month.' },
  tight: { label: 'Tight', line: 'The repayment takes up to half of what the farm earns a month: one poor harvest and it hurts.' },
  risky: { label: 'Risky', line: 'The repayment takes more than half of what the farm earns a month. Borrow less, or over more months.' },
};
