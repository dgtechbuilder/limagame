/* The storehouse, where Farm 8 was: a glass-walled store at the bottom of the farm, right of the market path, open
   from farm day 4 with the greenhouse. Everything the farm keeps back from its harvests lives here (the store the
   market stall sells from, src/produce), and its shade and airflow halve how fast fresh produce wilts. The farmer
   brings the greenhouse's picks in here (Harvest), and makes some of the store into food that keeps and sells for more
   (Produce): tomato sauce, strawberry jam, chilli sauce, cucumber pickles and maize flour. That is value addition:
   the same harvest, worth more, and lasting months instead of days.

   No screens here (Storehouse.tsx), so the saved game can use it. Money is stored money (src/money.ts: 1 = KSh 10). */

import { money } from '../money';
import { PRODUCE, priceOf, produceOf, rawValue, stock, type ProduceId, type ProduceState } from '../produce/model';

export type RecipeId = 'sauce' | 'jam' | 'chillisauce' | 'pickles' | 'flour';

export interface Recipe {
  id: RecipeId;
  /** what it makes (a product in the store) */
  out: ProduceId;
  /** what goes in, a batch (kg from the store) */
  input: Partial<Record<ProduceId, number>>;
  /** kg it makes, a batch, made well */
  yield: number;
  /** what a batch costs besides the food: jars, sugar, vinegar, salt, fuel, the mill */
  making: number;
  /** the steps, in order (the making mini-game) */
  steps: string[];
  what: string;
}

export const RECIPES: Recipe[] = [
  { id: 'sauce', out: 'sauce', input: { tomatoes: 10 }, yield: 4, making: 6, steps: ['Wash the tomatoes', 'Chop them', 'Cook them down', 'Fill the hot jars', 'Seal and label'], what: 'Ripe tomatoes cooked down and sealed hot in jars: it keeps for months, where fresh tomatoes wilt in days.' },
  { id: 'jam', out: 'jam', input: { strawberries: 5 }, yield: 4, making: 20, steps: ['Hull the strawberries', 'Add the sugar', 'Boil to setting point', 'Fill the hot jars', 'Seal and label'], what: 'Strawberries boiled with sugar: the farm’s dearest product, and it keeps for a year.' },
  { id: 'chillisauce', out: 'chillisauce', input: { chillies: 3 }, yield: 3, making: 10, steps: ['Wash the chillies', 'Blend with vinegar', 'Simmer with salt', 'Fill the bottles', 'Seal and label'], what: 'Chillies blended with vinegar and salt: a little goes a long way, and every restaurant wants it.' },
  { id: 'pickles', out: 'pickles', input: { cucumber: 8 }, yield: 6, making: 8, steps: ['Wash the cucumbers', 'Slice them', 'Boil the brine', 'Pack the jars', 'Seal and label'], what: 'Cucumbers packed in vinegar brine: they last months instead of days, and sell for more.' },
  { id: 'flour', out: 'flour', input: { maize: 20 }, yield: 16, making: 8, steps: ['Sort out bad grain', 'Clean the maize', 'Mill it', 'Sift the flour', 'Pack the bags'], what: 'Dry maize milled into flour for ugali: ready to cook, so it fetches more than the grain.' },
];
export const recipeOf = (id: RecipeId) => RECIPES.find(r => r.id === id)!;

export const STOREHOUSE = {
  /** batches the storehouse can make a day, in all */
  dailyBatches: 4,
  /** points for each batch made */
  points: 15,
  /** the made batches kept in the log */
  keep: 30,
};

export interface MadeBatch {
  day: number;
  recipe: RecipeId;
  batches: number;
  kg: number;
  /** what the food would have fetched raw at the stall, and what it fetches made */
  raw: number;
  value: number;
  making: number;
}

export interface StorehouseState {
  /** the farm day it last made on, and the batches made that day */
  day: number;
  batches: number;
  made: MadeBatch[];
  totals: { batches: number; kg: number; extra: number };
}

export const newStorehouse = (): StorehouseState => ({ day: 0, batches: 0, made: [], totals: { batches: 0, kg: 0, extra: 0 } });
export const storehouseOf = (h: Partial<StorehouseState> | undefined): StorehouseState => {
  const base = newStorehouse();
  return { ...base, ...(h ?? {}), totals: { ...base.totals, ...(h?.totals ?? {}) }, made: h?.made ?? [] };
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Batches the storehouse can still make today. */
export const batchesLeft = (h: Partial<StorehouseState> | undefined, day: number) => {
  const x = storehouseOf(h);
  return Math.max(0, STOREHOUSE.dailyBatches - (x.day === day ? x.batches : 0));
};
/** Batches the store has the food for. */
export const batchesInStore = (p: Partial<ProduceState> | undefined, r: Recipe) => {
  const store = produceOf(p).store;
  return Math.floor(Math.min(...(Object.entries(r.input) as [ProduceId, number][]).map(([id, kg]) => (store[id] ?? 0) / kg)) + 1e-6);
};
/** kg a batch makes, from how well it was made (the mini-game's score, 0 to 1). */
export const yieldOf = (r: Recipe, score: number) => round1(r.yield * (0.85 + 0.15 * Math.max(0, Math.min(1, score))));

/** Some batches, in money: what the food fetches raw at the stall today, what the product fetches, the making, and
    what the farmer gains by making it. */
export function quoteMake(r: Recipe, batches: number, cold: boolean, score = 1) {
  const food = Object.fromEntries((Object.entries(r.input) as [ProduceId, number][]).map(([id, kg]) => [id, round1(kg * batches)])) as Partial<Record<ProduceId, number>>;
  const kg = round1(yieldOf(r, score) * batches);
  const raw = rawValue(food, cold);
  const value = round2(kg * priceOf(r.out, cold));
  const making = round2(r.making * batches);
  return { food, kg, raw, value, making, extra: round2(value - making - raw) };
}

/** Make some batches from the store: the food comes out, the product goes in. The making is paid from the wallet. */
export function make(
  p0: Partial<ProduceState> | undefined,
  h0: Partial<StorehouseState> | undefined,
  id: RecipeId,
  batches: number,
  score: number,
  day: number,
  coins: number,
  cold: boolean,
): { p: ProduceState; h: StorehouseState; kg: number; making: number; extra: number; batches: number } | { error: string } {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return { error: 'The storehouse cannot make that' };
  const left = batchesLeft(h0, day);
  if (left <= 0) return { error: `The storehouse has made its ${STOREHOUSE.dailyBatches} batches today: come back tomorrow` };
  const n = Math.min(Math.floor(batches), left, batchesInStore(p0, r));
  if (n <= 0) {
    const short = (Object.keys(r.input) as ProduceId[]).map(f => PRODUCE[f].name.toLowerCase().replace(/ \(.*\)/, ''));
    return { error: `Not enough in the store for ${PRODUCE[r.out].name.toLowerCase().replace(/ \(.*\)/, '')}: a batch needs ${(Object.entries(r.input) as [ProduceId, number][]).map(([, kg], i) => `${kg} kg ${short[i]}`).join(' and ')}` };
  }
  const q = quoteMake(r, n, cold, score);
  if (coins < q.making) return { error: `Making ${n} batch${n === 1 ? '' : 'es'} costs ${money(q.making)} for jars and the rest: not enough in the wallet` };
  const p = produceOf(p0);
  const store = { ...p.store };
  for (const [f, kg] of Object.entries(q.food) as [ProduceId, number][]) store[f] = Math.max(0, round1((store[f] ?? 0) - kg));
  const after = stock({ ...p, store }, { [r.out]: q.kg });
  const h = storehouseOf(h0);
  const batch: MadeBatch = { day, recipe: r.id, batches: n, kg: q.kg, raw: q.raw, value: q.value, making: q.making };
  return {
    // what is made is not a new harvest: the store's "stored" total counts harvests only
    p: { ...after, totals: p.totals },
    h: {
      day,
      batches: (h.day === day ? h.batches : 0) + n,
      made: [batch, ...h.made].slice(0, STOREHOUSE.keep),
      totals: { batches: h.totals.batches + n, kg: round1(h.totals.kg + q.kg), extra: round2(h.totals.extra + q.extra) },
    },
    kg: q.kg,
    making: q.making,
    extra: q.extra,
    batches: n,
  };
}
