/* The mini restaurant beside the market stall: the farmer packages food from the store as meals (ugali na sukuma
   wiki, githeri, kachumbari, strawberries…), cooks a few plates and sells them to the stall's customers. A plate fetches more than
   its food would raw, after the cooking costs (fuel, oil, salt, labour), and every dish shows what a plate gives the
   person who eats it (src/nutrition). No screens here (Market.tsx), so the saved game can use it. Money is stored money
   (src/money.ts: 1 = KSh 10). */

import { FOODS, nutritionOf, type FoodGroup, type Nutrition } from '../nutrition/data';
import { MARKET, PRODUCE, growCost, produceOf, rawValue, type MealSale, type ProduceId, type ProduceState } from './model';

export type DishId = 'ugali-sukuma' | 'githeri' | 'bean-stew' | 'beans-ugali' | 'pepper-stew' | 'kachumbari' | 'strawberry-cup' | 'juice' | 'stuffed-capsicum' | 'maize-bread';

export interface Dish {
  id: DishId;
  name: string;
  icon: string;
  /** what it is, in a few words */
  what: string;
  /** kg of each food in one plate */
  plate: Partial<Record<ProduceId, number>>;
  /** a plate's price */
  price: number;
  /** cooking a plate: fuel, oil, salt, the cook's time */
  cooking: number;
}

export const DISHES: Dish[] = [
  { id: 'ugali-sukuma', name: 'Ugali na sukuma wiki', icon: '🍽️', what: 'Maize ugali with sukuma wiki fried with tomato: energy plus vitamins A and C.', plate: { maize: 0.2, sukuma: 0.15, tomatoes: 0.03 }, price: 9, cooking: 3 },
  { id: 'githeri', name: 'Githeri', icon: '🍲', what: 'Maize and beans boiled together with a little tomato: a complete protein in one pot.', plate: { maize: 0.15, drybeans: 0.1, tomatoes: 0.05 }, price: 10, cooking: 3 },
  { id: 'bean-stew', name: 'Bean stew', icon: '🫘', what: 'Beans stewed in fresh tomatoes: protein and iron to build the body, vitamin C to take the iron in.', plate: { drybeans: 0.12, tomatoes: 0.08 }, price: 9, cooking: 2 },
  { id: 'beans-ugali', name: 'Ugali and bean stew', icon: '🫘', what: 'Ugali from the storehouse’s flour with a bean stew in tomato sauce: protein, iron and fibre.', plate: { flour: 0.2, drybeans: 0.1, sauce: 0.03 }, price: 11, cooking: 2.5 },
  { id: 'pepper-stew', name: 'Capsicum and tomato stew', icon: '🥘', what: 'Capsicum and tomatoes stewed with sukuma wiki and a little chilli, with ugali: the most vitamin C of any plate.', plate: { maize: 0.2, capsicum: 0.08, tomatoes: 0.06, sukuma: 0.05, chillies: 0.005 }, price: 10, cooking: 3 },
  { id: 'kachumbari', name: 'Kachumbari', icon: '🍅', what: 'Fresh tomato and cucumber salad: vitamin C beside any meal.', plate: { tomatoes: 0.1, cucumber: 0.05 }, price: 4, cooking: 1 },
  { id: 'strawberry-cup', name: 'Strawberry cup', icon: '🍓', what: 'Fresh strawberries in a cup: most of a day’s vitamin C.', plate: { strawberries: 0.15 }, price: 6, cooking: 0.5 },
  { id: 'juice', name: 'Strawberry and cucumber juice', icon: '🧃', what: 'A big cup of fresh strawberry juice, made longer with cucumber.', plate: { strawberries: 0.1, cucumber: 0.2 }, price: 6, cooking: 1 },
  { id: 'stuffed-capsicum', name: 'Baked stuffed capsicum', icon: '🫑', what: 'Capsicum filled with beans and tomato, baked in the oven: protein, iron and vitamin C.', plate: { capsicum: 0.1, drybeans: 0.05, tomatoes: 0.04 }, price: 9, cooking: 2.5 },
  { id: 'maize-bread', name: 'Baked maize bread', icon: '🍞', what: 'A loaf of the storehouse’s maize flour, baked in the oven: energy for the day.', plate: { flour: 0.12 }, price: 5, cooking: 1.5 },
];
export const dishOf = (id: DishId) => DISHES.find(d => d.id === id)!;

/* ---------------- what a plate does for the body ---------------- */

/** The three kinds of food (as Kenyan schools teach them): energy-giving, body-building and protective. A restaurant
    customer can ask for one of them instead of a dish, and the farmer picks a dish that fits. */
export type Need = 'energy' | 'body' | 'protect';
export const NEEDS: Record<Need, { name: string; short: string; icon: string; does: string; asks: string[] }> = {
  energy: {
    name: 'Energy-giving food',
    short: 'Energy',
    icon: '⚡',
    does: 'Starch for work and play: maize, and the ugali made from it.',
    asks: ['I’m ploughing all afternoon. Something for energy, please!', 'I have a long walk home. Give me something with energy.'],
  },
  body: {
    name: 'Body-building food',
    short: 'Body-building',
    icon: '💪',
    does: 'Protein for muscles and growing children: beans are the farm’s best.',
    asks: ['My children are growing fast. Something body-building, with protein?', 'I train for football: I need protein, please.'],
  },
  protect: {
    name: 'Protective food',
    short: 'Protective',
    icon: '🛡️',
    does: 'Vitamins that fight sickness: sukuma wiki, tomatoes, cucumbers and fruit.',
    asks: ['I keep catching colds. Something protective, full of vitamins?', 'Something fresh with vitamins, please: I want to stay well.'],
  },
};
export const NEED_IDS = Object.keys(NEEDS) as Need[];
const GROUP_NEED: Record<FoodGroup, Need> = { staple: 'energy', legume: 'body', leafy: 'protect', vegetable: 'protect', fruit: 'protect' };
/** The kind of food each farm food is (flour and the storehouse's other makes count as what they are made from). */
export const needOfFood = (id: ProduceId): Need => (id === 'flour' ? 'energy' : GROUP_NEED[FOODS[id]?.group ?? 'vegetable']);
/** What a plate is: the kinds of food that make up at least a quarter of it. */
export function needsOf(d: Dish): Need[] {
  const total = Object.values(d.plate).reduce((n, kg) => n + (kg ?? 0), 0);
  const out = new Set<Need>();
  for (const [id, kg] of Object.entries(d.plate) as [ProduceId, number][]) if (kg >= total * 0.25) out.add(needOfFood(id));
  return NEED_IDS.filter(n => out.has(n));
}
/** One line on what a dish is made of, and what each food does: githeri = maize (energy) + beans (body-building)… */
export const lessonOf = (d: Dish) =>
  `${d.name} = ${(Object.keys(d.plate) as ProduceId[]).map(id => `${PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, '')} (${NEEDS[needOfFood(id)].short.toLowerCase()})`).join(' + ')}`;

/** The restaurant's menu when it is played (src/shop): five simple dishes from the farm's own crops, two or three foods
    each, that between them cover the three kinds of food. */
export const MENU: DishId[] = ['githeri', 'ugali-sukuma', 'bean-stew', 'kachumbari', 'strawberry-cup'];

export const RESTAURANT = {
  /** plates the restaurant serves a day, in all */
  dailyPlates: 30,
  /** plates cooked at a time (the stepper) */
  step: 5,
  /** points for each batch cooked */
  points: 10,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The food for some plates. */
export const foodFor = (d: Dish, plates: number): Partial<Record<ProduceId, number>> => Object.fromEntries(Object.entries(d.plate).map(([id, kg]) => [id, Math.round((kg ?? 0) * plates * 100) / 100]));
/** What one plate gives the person who eats it. */
export const plateNutrition = (d: Dish): Nutrition => nutritionOf(d.plate);
/** The plates the store has food for. */
export const platesInStore = (p: Partial<ProduceState> | undefined, d: Dish) => {
  const store = produceOf(p).store;
  return Math.floor(Math.min(...(Object.entries(d.plate) as [ProduceId, number][]).map(([id, kg]) => (store[id] ?? 0) / kg)) + 1e-6);
};
/** Plates the restaurant can still serve today. */
export const platesLeft = (p: Partial<ProduceState> | undefined, day: number) => {
  const k = produceOf(p).kitchen;
  return Math.max(0, RESTAURANT.dailyPlates - (k.day === day ? k.plates : 0));
};

/** A batch of plates, in money: what they sell for, what the food and the cooking cost, what the food would fetch raw. */
export function quote(d: Dish, plates: number, cold: boolean) {
  const food = foodFor(d, plates);
  const earned = round2(d.price * plates);
  const foodCost = growCost(food);
  const cooking = round2(d.cooking * plates);
  const raw = rawValue(food, cold);
  return { food, earned, foodCost, cooking, cost: round2(foodCost + cooking), raw, profit: round2(earned - foodCost - cooking), extra: round2(earned - cooking - raw) };
}

/** Cook some plates from the store and sell them. */
export function cook(p0: Partial<ProduceState> | undefined, id: DishId, plates: number, day: number, date: string, cold: boolean): { p: ProduceState; plates: number; earned: number; profit: number; extra: number } | { error: string } {
  const p = produceOf(p0);
  const d = DISHES.find(x => x.id === id);
  if (!d) return { error: 'There is no such dish' };
  const left = platesLeft(p, day);
  if (left <= 0) return { error: `The restaurant has served its ${RESTAURANT.dailyPlates} plates today: come back tomorrow` };
  const n = Math.min(Math.floor(plates), left, platesInStore(p, d));
  if (n <= 0) {
    const short = (Object.keys(d.plate) as ProduceId[]).filter(f => (p.store[f] ?? 0) < (d.plate[f] ?? 0)).map(f => PRODUCE[f].name.toLowerCase().replace(/ \(.*\)/, ''));
    return { error: `Not enough in the store for ${d.name.toLowerCase()}: you need ${short.join(' and ')}` };
  }
  const q = quote(d, n, cold);
  const store = { ...p.store };
  for (const [f, kg] of Object.entries(q.food) as [ProduceId, number][]) store[f] = Math.max(0, Math.round(((store[f] ?? 0) - kg) * 10) / 10);
  const meal: MealSale = { day, date, dish: d.id, plates: n, earned: q.earned, cost: q.cost, raw: q.raw };
  const k = p.kitchen.day === day ? p.kitchen.plates : 0;
  return {
    p: {
      ...p,
      store,
      kitchen: { day, plates: k + n },
      meals: [meal, ...p.meals].slice(0, MARKET.keep),
      mealTotals: { plates: p.mealTotals.plates + n, earned: round2(p.mealTotals.earned + q.earned), cost: round2(p.mealTotals.cost + q.cost) },
    },
    plates: n,
    earned: q.earned,
    profit: q.profit,
    extra: q.extra,
  };
}
