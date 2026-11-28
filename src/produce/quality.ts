/* Quality and storage for the food in the store (Dean, 2026-11-28). Every crop the farm keeps is sold by grade: three
   grades a food, each with its own price a kg. A harvest comes in as a mix of grades, and from then on how it is
   stored decides how fast it loses quality: each kg lot carries a quality score (0 to 100) that drops every night by a
   rate set by the food, its grade (bruised or broken produce spoils faster) and the way it is stored. When the score
   falls below a grade's floor the lot sells as the grade below; below the last floor it is spoiled and thrown out.
   So the player comes back each day to sell what is about to drop, and picks better storage to slow it.

   Rates and prices are typical Kenyan smallholder figures, rounded for play, for an agronomist to review. Money is
   stored money (src/money.ts: 1 = KSh 10). No screens here, and no game state: the produce model (model.ts) keeps the
   lots in step with the store. */

import type { ProduceId } from './model';

export type Grade = 0 | 1 | 2;
export const GRADES: Grade[] = [0, 1, 2];

/** A grade is the quality score at or above its floor; below the last floor the food is spoiled. */
export const GRADE_FLOOR: Record<Grade, number> = { 0: 80, 1: 60, 2: 30 };
/** Where a harvest's grades start (fresh off the field, sorted). */
export const START_Q: Record<Grade, number> = { 0: 95, 1: 74, 2: 50 };
/** Food in a save from before grades: graded as fair average quality (Grade 2), sold at the old price. */
export const UNKNOWN_Q = 70;
/** Damaged produce spoils faster: a grade's nightly loss is the food's rate times this. */
export const GRADE_DECAY: Record<Grade, number> = { 0: 1, 1: 1.25, 2: 1.6 };

/** A lot: some kg of one food at one quality score. */
export interface Lot {
  kg: number;
  /** quality, 0 to 100 */
  q: number;
}

export const gradeOf = (q: number): Grade | null => (q >= GRADE_FLOOR[0] ? 0 : q >= GRADE_FLOOR[1] ? 1 : q >= GRADE_FLOOR[2] ? 2 : null);
export const gradeName = (g: Grade) => `Grade ${g + 1}`;

/* ---------------- storage ---------------- */

export type StorageId = 'floor' | 'pallets' | 'hermetic' | 'crates' | 'cooler' | 'cold';

export interface Storage {
  id: StorageId;
  name: string;
  /** one line on the card */
  line: string;
  /** dry: grain and beans; fresh: leaves, fruit and vegetables */
  for: 'dry' | 'fresh' | 'both';
  /** bought once, then used for every food that suits it */
  buy?: number;
  /** what it needs before it can be used */
  needs?: 'storehouse' | 'coldRoom';
  /** the word on its info card (src/learn/glossary.ts) */
  term: string;
}

export const STORAGE: Record<StorageId, Storage> = {
  floor: { id: 'floor', name: 'On the floor', line: 'Free, but damp, heat, rats and insects get at it.', for: 'both', term: 'homeStore' },
  pallets: { id: 'pallets', name: 'Sacks on pallets', line: 'Off the floor, aired, away from the wall: half the loss.', for: 'dry', term: 'pallets' },
  hermetic: { id: 'hermetic', name: 'Hermetic bags', line: 'Airtight: weevils die without air, so dry grain keeps for months.', for: 'dry', buy: 25, term: 'hermetic' },
  crates: { id: 'crates', name: 'Crates in the shade', line: 'Shallow crates in the storehouse’s shade and airflow.', for: 'fresh', needs: 'storehouse', term: 'crates' },
  cooler: { id: 'cooler', name: 'Charcoal cooler', line: 'Wet charcoal walls cool the air by evaporation, with no power.', for: 'fresh', buy: 60, term: 'charcoalCooler' },
  cold: { id: 'cold', name: 'Cold room', line: 'The solar-powered cooler: the slowest loss of all.', for: 'fresh', needs: 'coldRoom', term: 'cold' },
};
export const STORAGE_IDS = Object.keys(STORAGE) as StorageId[];

/* ---------------- each food: its grades, prices and how fast it loses quality ---------------- */

export interface GradeInfo {
  /** what a buyer sees in this grade */
  name: string;
  /** a kg at the stall */
  price: number;
}

export interface FoodQuality {
  dry: boolean;
  grades: [GradeInfo, GradeInfo, GradeInfo];
  /** a harvest's share in each grade */
  split: [number, number, number];
  /** quality points lost a night, for Grade 1, in each way of storing it that suits the food */
  decay: Partial<Record<StorageId, number>>;
  /** the word on its info card: how to store it */
  term: string;
}

const dry = (floor: number, pallets: number, hermetic: number) => ({ floor, pallets, hermetic });
const fresh = (floor: number, crates: number, cooler: number, cold: number) => ({ floor, crates, cooler, cold });

/** Grade 2 is the price the stall always had; Grade 1 fetches more, Grade 3 less. */
export const QUALITY: Partial<Record<ProduceId, FoodQuality>> = {
  maize: {
    dry: true,
    grades: [
      { name: 'Clean, dry, whole grain', price: 5.4 },
      { name: 'Fair average quality', price: 4.5 },
      { name: 'Broken or discoloured', price: 2.8 },
    ],
    split: [0.45, 0.4, 0.15],
    decay: dry(3, 1.5, 0.4),
    term: 'storeMaize',
  },
  drybeans: {
    dry: true,
    grades: [
      { name: 'Sorted, whole and clean', price: 14.5 },
      { name: 'Mixed sizes', price: 12 },
      { name: 'Split or weevil-holed', price: 7 },
    ],
    split: [0.4, 0.45, 0.15],
    decay: dry(2.5, 1.2, 0.3),
    term: 'storeBeans',
  },
  sukuma: {
    dry: false,
    grades: [
      { name: 'Crisp, dark leaves', price: 5 },
      { name: 'Softening', price: 4 },
      { name: 'Wilted or yellowing', price: 2.2 },
    ],
    split: [0.5, 0.35, 0.15],
    decay: fresh(13, 9, 5, 2.5),
    term: 'storeLeaves',
  },
  spinach: {
    dry: false,
    grades: [
      { name: 'Crisp, tender leaves', price: 6 },
      { name: 'Softening', price: 5 },
      { name: 'Wilted or slimy', price: 2.5 },
    ],
    split: [0.5, 0.35, 0.15],
    decay: fresh(16, 11, 6, 3),
    term: 'storeLeaves',
  },
  tomatoes: {
    dry: false,
    grades: [
      { name: 'Firm, even, unmarked', price: 10 },
      { name: 'Small or soft', price: 8 },
      { name: 'Over-ripe: for sauce', price: 4.5 },
    ],
    split: [0.45, 0.4, 0.15],
    decay: fresh(9, 6, 3.5, 2),
    term: 'storeTomatoes',
  },
  capsicum: {
    dry: false,
    grades: [
      { name: 'Glossy and firm', price: 14 },
      { name: 'Small or marked', price: 12 },
      { name: 'Wrinkled', price: 6.5 },
    ],
    split: [0.45, 0.4, 0.15],
    decay: fresh(7, 5, 3, 1.5),
    term: 'storeFruitVeg',
  },
  cucumber: {
    dry: false,
    grades: [
      { name: 'Straight, firm, dark green', price: 7.5 },
      { name: 'Bent or small', price: 6 },
      { name: 'Soft or yellowing', price: 3.2 },
    ],
    split: [0.45, 0.4, 0.15],
    decay: fresh(8, 5.5, 3, 2),
    term: 'storeCucumber',
  },
  strawberries: {
    dry: false,
    grades: [
      { name: 'Bright, whole, dry', price: 38 },
      { name: 'Soft or small', price: 30 },
      { name: 'Bruised: for jam', price: 15 },
    ],
    split: [0.4, 0.4, 0.2],
    decay: fresh(20, 14, 8, 3),
    term: 'storeFruitVeg',
  },
  chillies: {
    dry: false,
    grades: [
      { name: 'Glossy, whole', price: 24 },
      { name: 'Mixed sizes', price: 20 },
      { name: 'Shrivelled', price: 11 },
    ],
    split: [0.45, 0.4, 0.15],
    decay: fresh(6, 4, 2.5, 1.5),
    term: 'storeFruitVeg',
  },
};
export const GRADED = Object.keys(QUALITY) as ProduceId[];
export const isGraded = (id: string): boolean => id in QUALITY;
export const qualityOf = (id: ProduceId) => QUALITY[id]!;

/** A kg's price at the stall for a grade (fresh food from the cold room fetches the cold premium on top). */
export const gradePrice = (id: ProduceId, g: Grade, coldPremium = 0) => Math.round(qualityOf(id).grades[g].price * (1 + coldPremium) * 100) / 100;

/* ---------------- the store's context, and which storage each food uses ---------------- */

export interface StoreCtx {
  /** the storehouse is open (its shade and crates) */
  storehouse: boolean;
  /** the cold room (the power system's cooler) is on */
  coldRoom: boolean;
  /** storage bought (hermetic bags, the charcoal cooler) */
  owned: StorageId[];
}

const suits = (id: ProduceId, m: StorageId) => qualityOf(id).decay[m] !== undefined;
/** Whether a way of storing can be used now (bought, and what it needs is there). */
export const canUse = (m: StorageId, ctx: StoreCtx) => {
  const x = STORAGE[m];
  if (x.buy && !ctx.owned.includes(m)) return false;
  if (x.needs === 'storehouse' && !ctx.storehouse) return false;
  if (x.needs === 'coldRoom' && !ctx.coldRoom) return false;
  return true;
};
/** The ways a food can be stored. */
export const methodsFor = (id: ProduceId) => STORAGE_IDS.filter(m => suits(id, m));
/** Free storage the farm has for a food, best first (what it uses when the farmer has not chosen). */
export function defaultMethod(id: ProduceId, ctx: StoreCtx): StorageId {
  const q = qualityOf(id);
  const usable = methodsFor(id).filter(m => canUse(m, ctx));
  return usable.sort((a, b) => q.decay[a]! - q.decay[b]!)[0] ?? 'floor';
}
/** The storage a food is in tonight: the farmer's choice when it can be used, otherwise the best free one there is. */
export function methodOf(id: ProduceId, chosen: Partial<Record<ProduceId, StorageId>> | undefined, ctx: StoreCtx): StorageId {
  const c = chosen?.[id];
  if (c && suits(id, c) && canUse(c, ctx)) return c;
  return defaultMethod(id, ctx);
}

/** Quality points a lot loses tonight. */
export const lossOf = (id: ProduceId, q: number, m: StorageId) => {
  const g = gradeOf(q) ?? 2;
  return (qualityOf(id).decay[m] ?? qualityOf(id).decay.floor!) * GRADE_DECAY[g];
};
/** Nights until a lot drops to the grade below (or spoils), stored the same way. */
export function nightsLeft(id: ProduceId, q: number, m: StorageId): number {
  const g = gradeOf(q);
  if (g === null) return 0;
  let n = 0;
  let x = q;
  while (gradeOf(x) === g && n < 999) {
    x -= lossOf(id, x, m);
    n++;
  }
  return n;
}

/* ---------------- lots ---------------- */

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (l: Lot[]) => r1(l.reduce((n, x) => n + x.kg, 0));
/** Lots best first. */
const tidy = (l: Lot[]) => l.filter(x => x.kg > 0.04).sort((a, b) => b.q - a.q);

/** A harvest's lots: its kg split into the food's grades. */
export function harvestLots(id: ProduceId, kg: number): Lot[] {
  const q = qualityOf(id);
  const lots: Lot[] = [];
  let left = r1(kg);
  GRADES.forEach((g, i) => {
    const n = i === GRADES.length - 1 ? left : r1(kg * q.split[g]);
    if (n > 0) lots.push({ kg: n, q: START_Q[g] });
    left = r1(left - n);
  });
  return tidy(lots);
}

/** Merge lots of the same quality. */
export function addLots(a: Lot[], b: Lot[]): Lot[] {
  const out = a.map(x => ({ ...x }));
  for (const x of b) {
    const same = out.find(y => Math.abs(y.q - x.q) < 0.01);
    if (same) same.kg = r1(same.kg + x.kg);
    else out.push({ ...x });
  }
  return tidy(out);
}

/** Take some kg out, first the lots closest to dropping (first expired, first out). */
export function takeFefo(lots: Lot[], kg: number): { lots: Lot[]; taken: Lot[] } {
  const out = [...lots].map(x => ({ ...x })).sort((a, b) => a.q - b.q);
  const taken: Lot[] = [];
  let left = r1(kg);
  for (const x of out) {
    if (left <= 0) break;
    const n = r1(Math.min(x.kg, left));
    if (n <= 0) continue;
    x.kg = r1(x.kg - n);
    taken.push({ kg: n, q: x.q });
    left = r1(left - n);
  }
  return { lots: tidy(out), taken };
}

/** Take some kg of one grade out (the lots of that grade closest to dropping first). */
export function takeGrade(lots: Lot[], g: Grade, kg: number): { lots: Lot[]; taken: Lot[] } {
  const of = lots.filter(x => gradeOf(x.q) === g);
  const rest = lots.filter(x => gradeOf(x.q) !== g);
  const t = takeFefo(of, kg);
  return { lots: tidy([...rest, ...t.lots]), taken: t.taken };
}

/** kg in each grade. */
export const byGrade = (lots: Lot[] | undefined): [number, number, number] => {
  const out: [number, number, number] = [0, 0, 0];
  for (const x of lots ?? []) {
    const g = gradeOf(x.q);
    if (g !== null) out[g] = r1(out[g] + x.kg);
  }
  return out;
};

/** What some lots fetch at the stall. */
export const lotsValue = (id: ProduceId, lots: Lot[], coldPremium = 0) => r2(lots.reduce((n, x) => n + x.kg * gradePrice(id, gradeOf(x.q) ?? 2, coldPremium), 0));

/** Keep a food's lots in step with its kg in the store: food taken out some other way (the restaurant, the storehouse,
    a gift, wilting) leaves from the lots closest to dropping; food put in without lots (an old save) is fair average
    quality. */
export function reconcileLots(kg: number, lots: Lot[] | undefined): Lot[] {
  const want = r1(Math.max(0, kg));
  let l = tidy((lots ?? []).map(x => ({ kg: r1(x.kg), q: x.q })));
  const have = sum(l);
  if (have > want + 0.04) l = takeFefo(l, r1(have - want)).lots;
  else if (want > have + 0.04) l = addLots(l, [{ kg: r1(want - have), q: UNKNOWN_Q }]);
  return l;
}

/* ---------------- a night in the store ---------------- */

export interface GradeDrop {
  id: ProduceId;
  kg: number;
  from: Grade;
  /** the grade it drops to, or null: spoiled */
  to: Grade | null;
  /** what the drop costs at the stall */
  loss: number;
}

/** One food's lots after a night: every lot loses quality by its storage; what falls below the last floor is spoiled. */
export function nightLots(id: ProduceId, lots: Lot[], m: StorageId): { lots: Lot[]; spoiled: number; drops: GradeDrop[] } {
  const out: Lot[] = [];
  const drops: GradeDrop[] = [];
  let spoiled = 0;
  for (const x of lots) {
    const q = r1(x.q - lossOf(id, x.q, m));
    const from = gradeOf(x.q);
    const to = gradeOf(q);
    if (from !== null && to !== from) drops.push({ id, kg: x.kg, from, to, loss: r2(x.kg * (gradePrice(id, from) - (to === null ? 0 : gradePrice(id, to)))) });
    if (to === null) spoiled = r1(spoiled + x.kg);
    else out.push({ kg: x.kg, q });
  }
  return { lots: addLots([], out), spoiled, drops };
}

/** What drops a grade (or spoils) tonight if it is not sold today: the morning reminder and the stall's warnings. */
export function dropsTonight(id: ProduceId, lots: Lot[], m: StorageId): GradeDrop[] {
  return nightLots(id, lots, m).drops;
}
