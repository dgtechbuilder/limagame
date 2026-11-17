/* The credit ledger, for every kind of credit the farm earns. CO₂ credits (carbon stored or kept out of the air,
   src/climate) were the only kind; water credits (litres used under the expected baseline, src/water) are the second.
   A new kind is one more entry in CREDIT_TYPES and a call to earn(). Each credit is paid out in the player's money
   at the end of the day; the ledger keeps what was earned, what was paid, and every entry. */

export type CreditType = 'co2' | 'water';

export const CREDIT_TYPES: Record<CreditType, { label: string; unit: string; what: string; rate: number }> = {
  // CO₂ credits are paid by the climate payment (src/climate/land.ts payRate): its rate is kept there
  co2: { label: 'CO₂ credits', unit: '10 kg CO₂', what: 'Carbon stored in the soil, the forest and the grass, or kept out of the air.', rate: 0 },
  /** stored money a water credit pays (placeholder until the climate funders set it) */
  water: { label: 'Water credits', unit: '100 L saved', what: 'Litres a day used under the farm’s expected baseline.', rate: 8 },
};

export interface LedgerEntry {
  id: number;
  type: CreditType;
  /** credits */
  amount: number;
  /** stored money paid for them */
  coins: number;
  label: string;
  date: string;
}

export interface Ledger {
  earned: Record<CreditType, number>;
  paid: Record<CreditType, number>;
  coins: Record<CreditType, number>;
  /** newest first, the last 60 */
  entries: LedgerEntry[];
}

const zero = (): Record<CreditType, number> => ({ co2: 0, water: 0 });
export const emptyLedger = (): Ledger => ({ earned: zero(), paid: zero(), coins: zero(), entries: [] });
export const ledgerOf = (l: Partial<Ledger> | undefined): Ledger => {
  const e = emptyLedger();
  return { earned: { ...e.earned, ...(l?.earned ?? {}) }, paid: { ...e.paid, ...(l?.paid ?? {}) }, coins: { ...e.coins, ...(l?.coins ?? {}) }, entries: l?.entries ?? [] };
};

let entryId = 0;
/** Credits earned and paid at once (stored money `coins`). */
export function earn(l0: Ledger | undefined, type: CreditType, amount: number, coins: number, label: string, date: string): Ledger {
  const l = ledgerOf(l0);
  if (amount <= 0 && coins <= 0) return l;
  return {
    earned: { ...l.earned, [type]: l.earned[type] + amount },
    paid: { ...l.paid, [type]: l.paid[type] + amount },
    coins: { ...l.coins, [type]: l.coins[type] + coins },
    entries: [{ id: Date.now() + ++entryId, type, amount, coins, label, date }, ...l.entries].slice(0, 60),
  };
}
