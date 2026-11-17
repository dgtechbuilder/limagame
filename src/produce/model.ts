/* The farm's store of produce, and the market stall. Some of every harvest (the six farms' maize and sukuma wiki,
   and the new farms' spinach, tomatoes, fruit…) goes into the store; each day the farmer can sell up to 25 kg of it
   at the stall, a day's price a kg. No screens here (Market.tsx), so the saved game can use it. Money is stored money
   (src/money.ts: 1 = KSh 10). */

export type ProduceId = 'maize' | 'sukuma' | 'spinach' | 'tomatoes' | 'beans' | 'onions' | 'fruit' | 'watermelon';

export const PRODUCE: Record<ProduceId, { name: string; icon: string; price: number; fresh: boolean }> = {
  maize: { name: 'Maize (dry grain)', icon: '🌽', price: 4.5, fresh: false },
  sukuma: { name: 'Sukuma wiki', icon: '🥬', price: 4, fresh: true },
  spinach: { name: 'Spinach', icon: '🥬', price: 5, fresh: true },
  tomatoes: { name: 'Tomatoes', icon: '🍅', price: 8, fresh: true },
  beans: { name: 'French beans', icon: '🫛', price: 12, fresh: true },
  onions: { name: 'Onions', icon: '🧅', price: 9, fresh: false },
  fruit: { name: 'Avocados and mangoes', icon: '🥑', price: 10, fresh: true },
  watermelon: { name: 'Watermelon', icon: '🍉', price: 4, fresh: true },
};
export const PRODUCE_IDS = Object.keys(PRODUCE) as ProduceId[];

export const MARKET = {
  /** kg the stall sells a day, in all */
  dailyKg: 25,
  /** the share of each six-farm harvest kept back in the store for the stall (the rest is sold at harvest) */
  keepShare: 0.03,
  /** kg in a bag */
  bagKg: 90,
  /** fresh produce from the cold room (the power system's cooler) fetches this much more */
  coldPremium: 0.1,
  /** a fresh crop loses this share of its weight a day in the store without the cold room */
  wilt: 0.04,
  /** sales kept */
  keep: 60,
};

export interface Sale {
  day: number;
  date: string;
  items: Partial<Record<ProduceId, number>>;
  kg: number;
  earned: number;
}

export interface ProduceState {
  /** kg of each in the store */
  store: Partial<Record<ProduceId, number>>;
  /** the farm day the stall last sold on, and the kg sold that day */
  day: number;
  soldKg: number;
  /** newest first */
  sales: Sale[];
  totals: { kg: number; earned: number; stored: number };
}

export const newProduce = (): ProduceState => ({ store: {}, day: 0, soldKg: 0, sales: [], totals: { kg: 0, earned: 0, stored: 0 } });
export const produceOf = (p: Partial<ProduceState> | undefined): ProduceState => ({ ...newProduce(), ...(p ?? {}), totals: { ...newProduce().totals, ...(p?.totals ?? {}) } });

/** kg the stall can still sell today. */
export const leftToday = (p: ProduceState, day: number) => Math.max(0, MARKET.dailyKg - (p.day === day ? p.soldKg : 0));
export const storeKg = (p: ProduceState) => PRODUCE_IDS.reduce((n, id) => n + (p.store[id] ?? 0), 0);
/** A kg's price today. */
export const priceOf = (id: ProduceId, cold: boolean) => Math.round(PRODUCE[id].price * (cold && PRODUCE[id].fresh ? 1 + MARKET.coldPremium : 1) * 100) / 100;

/** Put some kg in the store. */
export function stock(p0: Partial<ProduceState> | undefined, add: Partial<Record<ProduceId, number>>): ProduceState {
  const p = produceOf(p0);
  const store = { ...p.store };
  let n = 0;
  for (const [k, v] of Object.entries(add) as [ProduceId, number][]) {
    if (!v) continue;
    store[k] = Math.round(((store[k] ?? 0) + v) * 10) / 10;
    n += v;
  }
  return { ...p, store, totals: { ...p.totals, stored: Math.round((p.totals.stored + n) * 10) / 10 } };
}

/** Sell at the stall: what can be sold (the day's limit, what is in store), and what it earns. */
export function sell(p0: Partial<ProduceState> | undefined, items: Partial<Record<ProduceId, number>>, day: number, date: string, cold: boolean): { p: ProduceState; kg: number; earned: number } | { error: string } {
  const p = produceOf(p0);
  let left = leftToday(p, day);
  if (left <= 0) return { error: `The stall has sold its ${MARKET.dailyKg} kg today: come back tomorrow` };
  const store = { ...p.store };
  const sold: Partial<Record<ProduceId, number>> = {};
  let kg = 0;
  let earned = 0;
  for (const [k, want] of Object.entries(items) as [ProduceId, number][]) {
    const n = Math.max(0, Math.min(want ?? 0, store[k] ?? 0, left));
    if (n <= 0) continue;
    store[k] = Math.round(((store[k] ?? 0) - n) * 10) / 10;
    sold[k] = n;
    kg += n;
    left -= n;
    earned += n * priceOf(k, cold);
  }
  if (kg <= 0) return { error: 'Nothing to sell: choose some produce from the store' };
  earned = Math.round(earned * 100) / 100;
  const soldKg = (p.day === day ? p.soldKg : 0) + kg;
  return {
    p: { ...p, store, day, soldKg, sales: [{ day, date, items: sold, kg, earned }, ...p.sales].slice(0, MARKET.keep), totals: { ...p.totals, kg: p.totals.kg + kg, earned: Math.round((p.totals.earned + earned) * 100) / 100 } },
    kg,
    earned,
  };
}

/** A night in the store: fresh produce wilts without the cold room. */
export function storeNight(p0: Partial<ProduceState> | undefined, cold: boolean): ProduceState {
  const p = produceOf(p0);
  if (cold) return p;
  const store = { ...p.store };
  for (const id of PRODUCE_IDS) if (PRODUCE[id].fresh && store[id]) store[id] = Math.max(0, Math.round(store[id]! * (1 - MARKET.wilt) * 10) / 10);
  return { ...p, store };
}
