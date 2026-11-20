/* What the farm's food does for the people who eat it: the nutrients in 100 g of every crop the farm grows (as it is
   sold: dry maize grain and dry beans, fresh leaves, fruit and vegetables), and an adult's daily need of each. The
   small nutrition markers on the seeds, the growing farms, the harvests, the market stall and the restaurant all come
   from here.

   Numbers are rounded from public food composition tables (the Kenya Food Composition Tables 2018, FAO/Government of
   Kenya, and USDA FoodData Central), for teaching, not for diets: an agronomist or nutritionist can review them here
   without touching code. The daily needs are common reference values for an adult. No screens here (Nutri.tsx). */

import type { ProduceId } from '../produce/model';

export type NutrientId = 'energy' | 'protein' | 'fibre' | 'iron' | 'calcium' | 'vitA' | 'vitC';

export const NUTRIENTS: Record<NutrientId, { name: string; short: string; unit: string; icon: string; color: string; does: string }> = {
  energy: { name: 'Energy', short: 'Energy', unit: 'kcal', icon: '⚡', color: '#e0a21b', does: 'Fuel for work, play and growing. Mostly from starch (maize) and fat (avocado).' },
  protein: { name: 'Protein', short: 'Protein', unit: 'g', icon: '💪', color: '#b4572e', does: 'Builds muscle and helps children grow. Beans are the farm’s richest source.' },
  fibre: { name: 'Fibre', short: 'Fibre', unit: 'g', icon: '🌾', color: '#8a6d3b', does: 'Keeps the gut healthy and makes a meal last longer.' },
  iron: { name: 'Iron', short: 'Iron', unit: 'mg', icon: '🩸', color: '#a8323a', does: 'Carries oxygen in the blood: too little makes people tired (anaemia).' },
  calcium: { name: 'Calcium', short: 'Calcium', unit: 'mg', icon: '🦴', color: '#6f7f99', does: 'Strong bones and teeth. Dark leaves like sukuma wiki have plenty.' },
  vitA: { name: 'Vitamin A', short: 'Vit A', unit: 'µg', icon: '🥕', color: '#e2741b', does: 'Healthy eyes and skin, and fights infection. Dark green leaves are full of it.' },
  vitC: { name: 'Vitamin C', short: 'Vit C', unit: 'mg', icon: '🍊', color: '#d9a400', does: 'Fights infection, heals wounds and helps the body take in iron from beans and leaves.' },
};
export const NUTRIENT_IDS = Object.keys(NUTRIENTS) as NutrientId[];

/** An adult's need in a day. */
export const DAILY: Record<NutrientId, number> = { energy: 2000, protein: 50, fibre: 25, iron: 18, calcium: 1000, vitA: 700, vitC: 75 };

export type FoodGroup = 'staple' | 'legume' | 'leafy' | 'vegetable' | 'fruit';
export const GROUPS: Record<FoodGroup, { name: string; role: string; color: string }> = {
  staple: { name: 'Staple grain', role: 'Energy food', color: '#e0a21b' },
  legume: { name: 'Legume', role: 'Body-building food', color: '#b4572e' },
  leafy: { name: 'Dark leafy green', role: 'Protective food', color: '#2f8a3a' },
  vegetable: { name: 'Vegetable', role: 'Protective food', color: '#6aa336' },
  fruit: { name: 'Fruit', role: 'Protective food', color: '#d9432f' },
};

export interface Food {
  group: FoodGroup;
  /** in 100 g */
  per100: Record<NutrientId, number> & { carbs: number; fat: number };
  /** what it is best for, as markers (strongest first) */
  strong: NutrientId[];
  /** one line the player learns from */
  note: string;
}

export const FOODS: Record<ProduceId, Food> = {
  maize: {
    group: 'staple',
    per100: { energy: 365, protein: 9.4, carbs: 74, fat: 4.7, fibre: 7.3, iron: 2.7, calcium: 7, vitA: 0, vitC: 0 },
    strong: ['energy', 'fibre', 'protein'],
    note: 'The energy in ugali: cheap and filling. White maize has almost no vitamin A or C, so eat it with leaves and beans.',
  },
  drybeans: {
    group: 'legume',
    per100: { energy: 333, protein: 23.6, carbs: 45, fat: 0.8, fibre: 15.2, iron: 8.2, calcium: 143, vitA: 0, vitC: 4.5 },
    strong: ['protein', 'iron', 'fibre'],
    note: 'Two and a half times the protein of maize, and plenty of iron. Maize and beans together (githeri) make a complete protein.',
  },
  sukuma: {
    group: 'leafy',
    per100: { energy: 45, protein: 3.3, carbs: 4.9, fat: 0.7, fibre: 4, iron: 1.6, calcium: 210, vitA: 400, vitC: 93 },
    strong: ['vitC', 'vitA', 'calcium'],
    note: 'Little energy, but 100 g gives a whole day’s vitamin C, over half the vitamin A, and calcium for bones.',
  },
  cabbage: {
    group: 'leafy',
    per100: { energy: 25, protein: 1.3, carbs: 3.3, fat: 0.1, fibre: 2.5, iron: 0.5, calcium: 40, vitA: 5, vitC: 37 },
    strong: ['vitC', 'fibre'],
    note: 'Pale leaves: half a day’s vitamin C, but far less vitamin A, calcium and iron than dark sukuma wiki or spinach.',
  },
  spinach: {
    group: 'leafy',
    per100: { energy: 23, protein: 2.9, carbs: 1.4, fat: 0.4, fibre: 2.2, iron: 2.7, calcium: 99, vitA: 469, vitC: 28 },
    strong: ['vitA', 'iron', 'vitC'],
    note: 'The most vitamin A on the farm, and as much iron as maize from a fraction of the calories.',
  },
  tomatoes: {
    group: 'vegetable',
    per100: { energy: 18, protein: 0.9, carbs: 2.7, fat: 0.2, fibre: 1.2, iron: 0.3, calcium: 10, vitA: 42, vitC: 14 },
    strong: ['vitC', 'vitA'],
    note: 'Vitamin C and colour for every stew: the vitamin C helps the body take in iron from the beans and leaves.',
  },
  beans: {
    group: 'vegetable',
    per100: { energy: 31, protein: 1.8, carbs: 4.3, fat: 0.2, fibre: 2.7, iron: 1, calcium: 37, vitA: 35, vitC: 12 },
    strong: ['vitC', 'fibre', 'iron'],
    note: 'Fresh green pods: a vegetable, not a protein food. Dry beans have thirteen times the protein.',
  },
  onions: {
    group: 'vegetable',
    per100: { energy: 40, protein: 1.1, carbs: 7.6, fat: 0.1, fibre: 1.7, iron: 0.2, calcium: 23, vitA: 0, vitC: 7.4 },
    strong: ['vitC', 'fibre'],
    note: 'Flavour more than nutrients: a little vitamin C, and they keep for weeks.',
  },
  fruit: {
    group: 'fruit',
    per100: { energy: 110, protein: 1.4, carbs: 10, fat: 7.6, fibre: 4.2, iron: 0.4, calcium: 12, vitA: 30, vitC: 23 },
    strong: ['vitC', 'fibre', 'energy'],
    note: 'Avocado brings healthy fat and energy, mango brings vitamins A and C.',
  },
  watermelon: {
    group: 'fruit',
    per100: { energy: 30, protein: 0.6, carbs: 7.2, fat: 0.2, fibre: 0.4, iron: 0.2, calcium: 7, vitA: 28, vitC: 8.1 },
    strong: ['vitC', 'vitA'],
    note: 'Mostly water: refreshing and sweet, with some vitamin C, but little else a kg.',
  },
};

export type Nutrition = Record<NutrientId, number>;
const zero = (): Nutrition => ({ energy: 0, protein: 0, fibre: 0, iron: 0, calcium: 0, vitA: 0, vitC: 0 });

/** The share of a day's need (0 to 1+) in 100 g of a food. */
export const dayShare = (food: ProduceId, n: NutrientId) => FOODS[food].per100[n] / DAILY[n];

/** What some kg of foods hold, in all. */
export function nutritionOf(kg: Partial<Record<ProduceId, number>>): Nutrition {
  const out = zero();
  for (const [id, k] of Object.entries(kg) as [ProduceId, number][]) {
    if (!k || !FOODS[id]) continue;
    for (const n of NUTRIENT_IDS) out[n] += FOODS[id].per100[n] * k * 10;
  }
  return out;
}

/** How many adults the food would meet the day's need of, for each nutrient (person-days). */
export const peopleDays = (t: Nutrition): Nutrition => Object.fromEntries(NUTRIENT_IDS.map(n => [n, t[n] / DAILY[n]])) as Nutrition;

/** A total in words: 12,400 kcal, 1.2 kg protein, 340 mg iron… */
export function amount(n: NutrientId, v: number): string {
  const u = NUTRIENTS[n].unit;
  if (u === 'g' && v >= 1000) return `${fmt(v / 1000)} kg`;
  if (u === 'mg' && v >= 1000) return `${fmt(v / 1000)} g`;
  if (u === 'µg' && v >= 1000) return `${fmt(v / 1000)} mg`;
  return `${fmt(v)} ${u}`;
}
export const fmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString('en-GB') : v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

/** A day's need as a percentage, in words: "57%". */
export const pct = (share: number) => `${Math.round(share * 100)}%`;

/** The nutrients a mix of foods is best for (the most of a day's need), strongest first. */
export function strongestOf(t: Nutrition, top = 3): NutrientId[] {
  const d = peopleDays(t);
  return [...NUTRIENT_IDS].sort((a, b) => d[b] - d[a]).slice(0, top);
}

/** A harvest in words, by what it is best for: "a day's vitamin C for 400 people, vitamin A for 171". */
export function harvestLine(items: Partial<Record<ProduceId, number>>): string {
  const t = nutritionOf(items);
  const d = peopleDays(t);
  const [a, b] = strongestOf(t, 2);
  const n = (v: number) => Math.round(v).toLocaleString('en-GB');
  return `a day’s ${NUTRIENTS[a].name.toLowerCase()} for ${n(d[a])} ${Math.round(d[a]) === 1 ? 'person' : 'people'}${b ? `, ${NUTRIENTS[b].name.toLowerCase()} for ${n(d[b])}` : ''}`;
}
