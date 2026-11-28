/* The farm's store of produce, and the market stall. Some of every harvest (the six farms' maize, sukuma wiki and the
   beans between the maize rows, and the greenhouse's tomatoes, capsicum, cucumbers, strawberries and chillies) goes
   into the store (the storehouse, src/storehouse), where some of it can be made into sauce, jam, pickles or flour; each day
   the stall sells up to 25 kg of it, a day's price a kg. The farmer can choose what to sell; whatever of the day's
   25 kg is left is sold for them when the day ends (the daily sales cycle), so every day shows what the farm's
   harvests earn, and the profit over what the food cost to grow. The restaurant (restaurant.ts)
   cooks some of the store into meals instead. No screens here (Market.tsx), so the saved game can use it. Money is
   stored money (src/money.ts: 1 = KSh 10). */

export type ProduceId =
  | 'maize'
  | 'drybeans'
  | 'sukuma'
  | 'tomatoes'
  | 'capsicum'
  | 'cucumber'
  | 'strawberries'
  | 'chillies'
  | 'sauce'
  | 'jam'
  | 'chillisauce'
  | 'pickles'
  | 'flour';

/** price: a kg at the stall; cost: what a kg cost to grow (seed, fertilizer, water, labour), for the profit; made: made
    in the storehouse from a harvest (src/storehouse), its cost the food that went in and the making. */
export const PRODUCE: Record<ProduceId, { name: string; icon: string; price: number; cost: number; fresh: boolean; made?: boolean }> = {
  maize: { name: 'Maize (dry grain)', icon: '🌽', price: 4.5, cost: 2.4, fresh: false },
  drybeans: { name: 'Dry beans', icon: '🫘', price: 12, cost: 6, fresh: false },
  sukuma: { name: 'Sukuma wiki', icon: '🥬', price: 4, cost: 1.6, fresh: true },
  tomatoes: { name: 'Tomatoes', icon: '🍅', price: 8, cost: 3.6, fresh: true },
  capsicum: { name: 'Capsicum', icon: '🫑', price: 12, cost: 5, fresh: true },
  cucumber: { name: 'Cucumbers', icon: '🥒', price: 6, cost: 2.4, fresh: true },
  strawberries: { name: 'Strawberries', icon: '🍓', price: 30, cost: 12, fresh: true },
  chillies: { name: 'Chillies', icon: '🌶️', price: 20, cost: 8, fresh: true },
  sauce: { name: 'Tomato sauce', icon: '🥫', price: 28, cost: 10.5, fresh: false, made: true },
  jam: { name: 'Strawberry jam', icon: '🍯', price: 60, cost: 20, fresh: false, made: true },
  chillisauce: { name: 'Chilli sauce', icon: '🌶️', price: 40, cost: 11.3, fresh: false, made: true },
  pickles: { name: 'Cucumber pickles', icon: '🫙', price: 16, cost: 4.5, fresh: false, made: true },
  flour: { name: 'Maize flour (unga)', icon: '🌾', price: 7, cost: 3.5, fresh: false, made: true },
};
export const PRODUCE_IDS = Object.keys(PRODUCE) as ProduceId[];
/** What the farm grows (the rest is made from it in the storehouse). */
export const CROP_IDS = PRODUCE_IDS.filter(id => !PRODUCE[id].made);
/** A name for something in an old save that the farm no longer grows. */
export const produceName = (id: string) => (PRODUCE as Record<string, { name: string } | undefined>)[id]?.name ?? id;

export const MARKET = {
  /** kg the stall sells a day, in all */
  dailyKg: 25,
  /** the share of each six-farm harvest kept back in the store for the stall (the rest is sold at harvest) */
  keepShare: 0.03,
  /** the share of the beans grown between the maize rows kept back in the store */
  beanShare: 0.25,
  /** kg in a bag */
  bagKg: 90,
  /** fresh produce from the cold room (the power system's cooler) fetches this much more */
  coldPremium: 0.1,
  /** a fresh crop loses this share of its weight a day in the store without the cold room */
  wilt: 0.04,
  /** the storehouse's shade and airflow (from the day it opens) halve that */
  shadeWilt: 0.5,
  /** sales kept */
  keep: 60,
};

export interface Sale {
  day: number;
  date: string;
  items: Partial<Record<ProduceId, number>>;
  kg: number;
  earned: number;
  /** what the food sold cost to grow (missing in older saves) */
  cost?: number;
  /** sold for the farmer when the day ended (the daily sales cycle) */
  auto?: boolean;
}

export interface ProduceState {
  /** kg of each in the store */
  store: Partial<Record<ProduceId, number>>;
  /** the farm day the stall last sold on, and the kg sold that day */
  day: number;
  soldKg: number;
  /** newest first */
  sales: Sale[];
  totals: { kg: number; earned: number; stored: number; cost: number };
  /** the stall sells what is left of the day's 25 kg when the day ends (on unless the farmer turns it off) */
  auto: boolean;
  /** the restaurant (restaurant.ts): the farm day it last cooked on, the plates served that day, its meals */
  kitchen: { day: number; plates: number };
  meals: MealSale[];
  mealTotals: { plates: number; earned: number; cost: number };
}

export interface MealSale {
  day: number;
  date: string;
  dish: string;
  plates: number;
  earned: number;
  /** the food (what it cost to grow) and the cooking (fuel, oil, salt, labour) */
  cost: number;
  /** what the same food would have fetched raw at the stall */
  raw: number;
}

/** Last season's harvest, in the store when the game starts: the stall sells from the first day. */
export const START_STORE: Partial<Record<ProduceId, number>> = { maize: 60, drybeans: 20, sukuma: 12 };

export const newProduce = (): ProduceState => ({
  store: { ...START_STORE },
  day: 0,
  soldKg: 0,
  sales: [],
  totals: { kg: 0, earned: 0, stored: 0, cost: 0 },
  auto: true,
  kitchen: { day: 0, plates: 0 },
  meals: [],
  mealTotals: { plates: 0, earned: 0, cost: 0 },
});
export const produceOf = (p: Partial<ProduceState> | undefined): ProduceState => {
  const base = newProduce();
  // a save from before the greenhouse can hold crops the farm no longer grows (spinach, onions…): they are left out
  const store = p?.store && Object.keys(p.store).some(k => !(k in PRODUCE)) ? (Object.fromEntries(Object.entries(p.store).filter(([k]) => k in PRODUCE)) as ProduceState['store']) : p?.store;
  return { ...base, ...(p ?? {}), ...(store ? { store } : {}), totals: { ...base.totals, ...(p?.totals ?? {}) }, kitchen: { ...base.kitchen, ...(p?.kitchen ?? {}) }, mealTotals: { ...base.mealTotals, ...(p?.mealTotals ?? {}) } };
};

/** kg the stall can still sell today. */
export const leftToday = (p: ProduceState, day: number) => Math.max(0, MARKET.dailyKg - (p.day === day ? p.soldKg : 0));
export const storeKg = (p: ProduceState) => PRODUCE_IDS.reduce((n, id) => n + (p.store[id] ?? 0), 0);
/** A kg's price today. */
export const priceOf = (id: ProduceId, cold: boolean) => Math.round(PRODUCE[id].price * (cold && PRODUCE[id].fresh ? 1 + MARKET.coldPremium : 1) * 100) / 100;
/** What some kg cost to grow. */
export const growCost = (items: Partial<Record<ProduceId, number>>) => round2((Object.entries(items) as [ProduceId, number][]).reduce((n, [id, kg]) => n + (kg ?? 0) * (PRODUCE[id]?.cost ?? 0), 0));
/** What some kg fetch at the stall today. */
export const rawValue = (items: Partial<Record<ProduceId, number>>, cold: boolean) => round2((Object.entries(items) as [ProduceId, number][]).reduce((n, [id, kg]) => n + (kg ?? 0) * priceOf(id, cold), 0));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
/** A sale's profit: what it earned less what the food cost to grow. */
export const profitOf = (x: { earned: number; cost?: number }) => round2(x.earned - (x.cost ?? 0));

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
export function sell(p0: Partial<ProduceState> | undefined, items: Partial<Record<ProduceId, number>>, day: number, date: string, cold: boolean): { p: ProduceState; kg: number; earned: number; cost: number } | { error: string } {
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
  return record(p, store, sold, kg, earned, day, date, false);
}

/** A customer served at the stall (src/shop): what was packed leaves the store and counts toward the day's kg; the
    customer pays for what they asked for and got (a kg packed over the order is given away). */
export function sellTo(p0: Partial<ProduceState> | undefined, given: Partial<Record<ProduceId, number>>, asked: Partial<Record<ProduceId, number>>, day: number, date: string, cold: boolean): { p: ProduceState; kg: number; earned: number; cost: number } | { error: string } {
  const p = produceOf(p0);
  let left = leftToday(p, day);
  if (left <= 0) return { error: `The stall has sold its ${MARKET.dailyKg} kg today: come back tomorrow` };
  const store = { ...p.store };
  const sold: Partial<Record<ProduceId, number>> = {};
  let kg = 0;
  let earned = 0;
  for (const [k, want] of Object.entries(given) as [ProduceId, number][]) {
    const n = round1(Math.max(0, Math.min(want ?? 0, store[k] ?? 0, left)));
    if (n <= 0) continue;
    store[k] = round1((store[k] ?? 0) - n);
    sold[k] = n;
    kg += n;
    left -= n;
    earned += Math.min(n, asked[k] ?? 0) * priceOf(k, cold);
  }
  if (kg <= 0) return { error: 'The bags are empty: pack the order first' };
  return record(p, store, sold, kg, earned, day, date, false);
}

function record(p: ProduceState, store: ProduceState['store'], sold: Partial<Record<ProduceId, number>>, kg0: number, earned0: number, day: number, date: string, auto: boolean): { p: ProduceState; kg: number; earned: number; cost: number; items: Partial<Record<ProduceId, number>> } {
  const kg = round1(kg0);
  const earned = round2(earned0);
  const cost = growCost(sold);
  const soldKg = round1((p.day === day ? p.soldKg : 0) + kg);
  const sale: Sale = { day, date, items: sold, kg, earned, cost, ...(auto ? { auto: true } : {}) };
  return {
    p: { ...p, store, day, soldKg, sales: [sale, ...p.sales].slice(0, MARKET.keep), totals: { ...p.totals, kg: round1(p.totals.kg + kg), earned: round2(p.totals.earned + earned), cost: round2(p.totals.cost + cost) } },
    kg,
    earned,
    cost,
    items: sold,
  };
}

/** The daily sales cycle: when a farm day ends, the stall sells what is left of its 25 kg, a share of everything in
    the store (so a day's sale is a mix: maize, beans, sukuma wiki…). Null when nothing was sold. */
export function daySale(p0: Partial<ProduceState> | undefined, day: number, date: string, cold: boolean): { p: ProduceState; kg: number; earned: number; cost: number; items: Partial<Record<ProduceId, number>> } | null {
  const p = produceOf(p0);
  if (!p.auto) return null;
  const left = leftToday(p, day);
  const total = storeKg(p);
  if (left <= 0 || total <= 0.05) return null;
  const take = Math.min(left, total);
  const store = { ...p.store };
  const sold: Partial<Record<ProduceId, number>> = {};
  let kg = 0;
  let earned = 0;
  const ids = PRODUCE_IDS.filter(id => (store[id] ?? 0) > 0);
  ids.forEach((id, i) => {
    const have = store[id] ?? 0;
    // the last one takes what rounding left, so the day sells its full share
    const want = i === ids.length - 1 ? take - kg : round1((have / total) * take);
    const n = round1(Math.max(0, Math.min(have, want)));
    if (n <= 0) return;
    store[id] = round1(have - n);
    sold[id] = n;
    kg += n;
    earned += n * priceOf(id, cold);
  });
  if (kg <= 0) return null;
  return record(p, store, sold, kg, earned, day, date, true);
}

/** A night in the store: fresh produce wilts without the cold room (half as much in the storehouse's shade). */
export function storeNight(p0: Partial<ProduceState> | undefined, cold: boolean, shaded = false): ProduceState {
  const p = produceOf(p0);
  if (cold) return p;
  const store = { ...p.store };
  const wilt = MARKET.wilt * (shaded ? MARKET.shadeWilt : 1);
  for (const id of PRODUCE_IDS) if (PRODUCE[id].fresh && store[id]) store[id] = Math.max(0, Math.round(store[id]! * (1 - wilt) * 10) / 10);
  return { ...p, store };
}
