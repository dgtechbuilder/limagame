/* The shop floor: the market stall and the restaurant played as a game. Customers walk in and queue at the counter;
   each one orders. At the stall the farmer packs the order from the store into one bag or two, as the customer asks,
   and hands it over; at the restaurant the farmer takes the order, gathers the food from the store, chops and cooks it
   at the kitchen's stations (the chopping board, the jiko, the stove, the oven, the blender), plates it or boxes it
   to take away, and serves it. A customer pays for what they asked for and got, and tips for a good, quick job; one
   kept waiting too long walks out.

   The stall's 25 kg a day and the restaurant's 30 plates a day hold here too, and every order is made from what is
   in the store, so the game sells the farm's own harvest. No screens here (Shop.tsx draws it, scene.ts is the 3D
   room), so it can be tested on its own. Times are in seconds of play. */

import type { Look } from '../first/data';
import { MARKET, PRODUCE, leftToday, priceOf, produceOf, type ProduceId, type ProduceState } from '../produce/model';
import { DISHES, dishOf, platesLeft, type DishId } from '../produce/restaurant';

export type ShopKind = 'market' | 'restaurant';

/* ---------------- the people ---------------- */

/** Something that makes a customer look like themselves, on top of the farmer's build. */
export type Extra = 'glasses' | 'shades' | 'backpack' | 'headphones' | 'beanie' | 'bucket' | 'bow' | 'scarf' | 'none';

const NAMES = ['Amani', 'Wanjiru', 'Otieno', 'Achieng', 'Baraka', 'Zawadi', 'Kamau', 'Nyokabi', 'Juma', 'Neema', 'Mutua', 'Akinyi', 'Kibet', 'Halima', 'Tumaini', 'Wekesa', 'Makena', 'Omondi', 'Imani', 'Chebet'];
const SKINS = ['#8a5634', '#6e4127', '#a46a43', '#5a3420', '#7b4a2d', '#4a2a18', '#b27a4f', '#94603a'];
const OUTFITS = ['#2f8f4e', '#2b6cb0', '#b8432f', '#7a4fa0', '#e0a21b', '#1f8a70', '#d9572b', '#3b3b3b', '#e85d9a', '#3fa0e0', '#f2c14e', '#5c6b73'];
const TRIMS = ['#f2c14e', '#f4f1e8', '#2c2c2c', '#e84a3a', '#3aa856'];
const HEADS: Look['head'][] = ['wrap', 'cap', 'none'];
const HEAD_COLORS = ['#d9572b', '#3b3b3b', '#1d1d1d', '#1f8a70', '#e6b844', '#7a3f8f', '#2b6cb0', '#c0392b', '#5a3a22'];
const EXTRAS: Extra[] = ['glasses', 'shades', 'backpack', 'headphones', 'beanie', 'bucket', 'bow', 'scarf', 'none', 'none'];

export interface Patron {
  id: number;
  name: string;
  look: Look;
  extra: Extra;
  /** a child, drawn smaller */
  kid: boolean;
  phase: 'enter' | 'queue' | 'order' | 'wait' | 'pickup' | 'eat' | 'leave' | 'gone';
  /** seconds in this phase */
  t: number;
  /** their place in the queue (0: at the counter) */
  slot: number;
  /** the table seat they wait at (the restaurant) */
  seat: number | null;
  /** seconds of patience left, and the most they had */
  patience: number;
  max: number;
  order: MarketOrder | MealOrder;
  /** what they say at the counter */
  line: string;
  mood: 'happy' | 'ok' | 'upset' | null;
  /** what they said as they left */
  said: string;
  /** what they carry out: bags from the stall, a box or a plate from the restaurant */
  carry: 'bag' | 'bags' | 'box' | 'plate' | null;
  paid: number;
}

export interface MarketOrder {
  kind: 'market';
  /** what goes in each bag: one bag, or two */
  bags: Partial<Record<ProduceId, number>>[];
}

export interface MealOrder {
  kind: 'restaurant';
  dishes: DishId[];
  /** eat here (on a plate) or take away (in a box) */
  to: 'here' | 'away';
  /** the farmer has taken the order */
  taken: boolean;
}

/* ---------------- the kitchen ---------------- */

export type StationId = 'board' | 'pot' | 'pan' | 'oven' | 'blender';

export const STATIONS: Record<StationId, { name: string; short: string; icon: string; verb: string; kind: 'chop' | 'cook' | 'blend' }> = {
  board: { name: 'Chopping board', short: 'Board', icon: '🔪', verb: 'Chop', kind: 'chop' },
  pot: { name: 'Jiko and sufuria', short: 'Jiko', icon: '🍲', verb: 'Boil', kind: 'cook' },
  pan: { name: 'Stove and pan', short: 'Stove', icon: '🍳', verb: 'Fry', kind: 'cook' },
  oven: { name: 'Oven', short: 'Oven', icon: '♨️', verb: 'Bake', kind: 'cook' },
  blender: { name: 'Blender', short: 'Blender', icon: '🥤', verb: 'Blend', kind: 'blend' },
};
export const STATION_IDS = Object.keys(STATIONS) as StationId[];

export interface Step {
  at: StationId;
  /** taps on the board */
  chops?: number;
  /** seconds on the fire (or in the blender) until it is done */
  secs?: number;
}

/** How each dish is made, after its food is gathered from the store. */
export const RECIPES: Record<DishId, Step[]> = {
  'ugali-sukuma': [{ at: 'board', chops: 4 }, { at: 'pan', secs: 5 }, { at: 'pot', secs: 6 }],
  githeri: [{ at: 'board', chops: 3 }, { at: 'pot', secs: 8 }],
  'beans-ugali': [{ at: 'pot', secs: 7 }, { at: 'pan', secs: 4 }],
  'pepper-stew': [{ at: 'board', chops: 4 }, { at: 'pan', secs: 6 }],
  kachumbari: [{ at: 'board', chops: 6 }],
  'strawberry-cup': [{ at: 'board', chops: 3 }],
  juice: [{ at: 'board', chops: 2 }, { at: 'blender', secs: 4 }],
  'stuffed-capsicum': [{ at: 'board', chops: 3 }, { at: 'oven', secs: 8 }],
  'maize-bread': [{ at: 'oven', secs: 9 }],
};

export const SHOP = {
  /** seconds between customers walking in: the stall, and the restaurant (a meal takes longer than packing bags) */
  every: 8,
  mealEvery: 13,
  /** people in the queue at most */
  queue: 4,
  /** seats at the restaurant's tables */
  seats: 4,
  /** patience at the stall: a base, and more for each thing on the order */
  marketPatience: 40,
  marketPerItem: 10,
  /** patience at the restaurant, from the moment the order is taken: a base, and more for each dish */
  mealPatience: 45,
  mealPerDish: 30,
  /** seconds a customer waits at the counter for the order to be taken */
  takePatience: 25,
  /** a cooked dish is just right from `secs` to this many times it; burnt after `burnAt` times */
  doneUntil: 1.7,
  burnAt: 2.2,
  /** the most a customer tips, as a share of the bill */
  tip: 0.15,
  /** seconds a customer sits and eats */
  eatSecs: 5,
};

export interface Job {
  id: number;
  patron: number;
  dish: DishId;
  /** the food gathered from the store so far */
  got: ProduceId[];
  /** 0: gathering; 1..n: the recipe's steps still to do (step i is RECIPES[dish][i - 1]); n + 1: ready to pack */
  step: number;
  where: 'ticket' | 'hands' | StationId | 'pass';
  /** 1 when everything went right; a burn or the wrong pack takes some off */
  quality: number;
  pack: 'plate' | 'box' | null;
  /** notes for the ticket: "burnt", "boxed, not plated" */
  notes: string[];
}

export interface StationState {
  job: number | null;
  /** seconds on the fire, or taps on the board */
  t: number;
  chops: number;
}

export interface Shift {
  kind: ShopKind;
  /** seconds since the shop opened */
  time: number;
  patrons: Patron[];
  nextId: number;
  /** seconds to the next customer */
  spawnIn: number;
  /** the stall: the bags on the counter, and the one the farmer is filling */
  bags: Partial<Record<ProduceId, number>>[];
  bag: number;
  /** the restaurant */
  jobs: Job[];
  hands: number | null;
  stations: Record<StationId, StationState>;
  /** what happened, for the shift's end */
  served: number;
  walked: number;
  earned: number;
  tips: number;
  happy: number;
  /** the shop is shutting: no one else comes in */
  closing: boolean;
  /** a short message for the farmer */
  flash: { id: number; text: string; bad?: boolean } | null;
}

/** A random number from 0 to 1 (Math.random, or a seeded one in the tests). */
export type Rng = () => number;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];

/** Food is packed and gathered a unit at a time: half a kilo of the dear things, a kilo of the rest. */
export const unitOf = (id: ProduceId) => (PRODUCE[id].price >= 15 ? 0.5 : 1);
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function newShift(kind: ShopKind): Shift {
  return {
    kind,
    time: 0,
    patrons: [],
    nextId: 1,
    spawnIn: 0.8,
    bags: [{}],
    bag: 0,
    jobs: [],
    hands: null,
    stations: Object.fromEntries(STATION_IDS.map(id => [id, { job: null, t: 0, chops: 0 }])) as Record<StationId, StationState>,
    served: 0,
    walked: 0,
    earned: 0,
    tips: 0,
    happy: 0,
    closing: false,
    flash: null,
  };
}

const flash = (sh: Shift, text: string, bad = false) => {
  sh.flash = { id: (sh.flash?.id ?? 0) + 1, text, bad };
};

/** The customers still in the shop (not walked out). */
const inShop = (sh: Shift) => sh.patrons.filter(p => p.phase !== 'gone');
/** Those still to be served (their food is held for them). */
const waiting = (sh: Shift) => sh.patrons.filter(p => p.phase !== 'gone' && p.phase !== 'leave' && p.phase !== 'eat' && p.phase !== 'pickup');

/** kg of everything on a market order. */
export const orderItems = (o: MarketOrder): Partial<Record<ProduceId, number>> => {
  const out: Partial<Record<ProduceId, number>> = {};
  for (const b of o.bags) for (const [id, kg] of Object.entries(b) as [ProduceId, number][]) out[id] = round1((out[id] ?? 0) + kg);
  return out;
};
export const kgOf = (items: Partial<Record<ProduceId, number>>) => round1(Object.values(items).reduce((n, v) => n + (v ?? 0), 0));
export const billOf = (o: MarketOrder, cold: boolean) => round2((Object.entries(orderItems(o)) as [ProduceId, number][]).reduce((n, [id, kg]) => n + kg * priceOf(id, cold), 0));

/** What the store has left once the waiting customers' orders are set aside, and what the day still allows. */
export function free(sh: Shift, p0: Partial<ProduceState> | undefined, day: number) {
  const p = produceOf(p0);
  const store = { ...p.store };
  let kg = leftToday(p, day);
  let plates = platesLeft(p, day);
  for (const c of waiting(sh)) {
    if (c.order.kind === 'market') {
      for (const [id, n] of Object.entries(orderItems(c.order)) as [ProduceId, number][]) store[id] = round2((store[id] ?? 0) - n);
      kg -= kgOf(orderItems(c.order));
    } else {
      for (const d of c.order.dishes) {
        for (const [id, n] of Object.entries(dishOf(d).plate) as [ProduceId, number][]) store[id] = round2((store[id] ?? 0) - n);
        plates -= 1;
      }
    }
  }
  return { store, kg: round1(kg), plates };
}

/** A new market order from what is free: one to three things, in one bag or two. Null when nothing can be sold. */
export function marketOrder(store: Partial<Record<ProduceId, number>>, kgLeft: number, rng: Rng): MarketOrder | null {
  const can = (Object.keys(PRODUCE) as ProduceId[]).filter(id => (store[id] ?? 0) >= unitOf(id) && unitOf(id) <= kgLeft);
  if (!can.length || kgLeft < 0.5) return null;
  const want = 1 + Math.floor(rng() * Math.min(3, can.length));
  const items: Partial<Record<ProduceId, number>> = {};
  let room = Math.min(kgLeft, 6);
  const pool = [...can];
  for (let i = 0; i < want && pool.length; i++) {
    const id = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
    const u = unitOf(id);
    const most = Math.min(Math.floor((store[id] ?? 0) / u), Math.floor(room / u), u < 1 ? 2 : 3);
    if (most < 1) continue;
    const n = round1(u * (1 + Math.floor(rng() * most)));
    items[id] = n;
    room = round1(room - n);
  }
  const ids = Object.keys(items) as ProduceId[];
  if (!ids.length) return null;
  // two bags: the fresh things kept apart from the dry ones (or, without both, one thing on its own)
  if (ids.length >= 2 && rng() < 0.5) {
    const fresh = ids.filter(id => PRODUCE[id].fresh);
    const dry = ids.filter(id => !PRODUCE[id].fresh);
    const [a, b] = fresh.length && dry.length ? [fresh, dry] : [ids.slice(0, 1), ids.slice(1)];
    return { kind: 'market', bags: [Object.fromEntries(a.map(id => [id, items[id]!])), Object.fromEntries(b.map(id => [id, items[id]!]))] };
  }
  return { kind: 'market', bags: [items] };
}

/** A new meal order from what is free: one dish or two the store can make. Null when the kitchen cannot cook any. */
export function mealOrder(store: Partial<Record<ProduceId, number>>, platesFree: number, rng: Rng): MealOrder | null {
  const makes = (d: (typeof DISHES)[number], n: number) => (Object.entries(d.plate) as [ProduceId, number][]).every(([id, kg]) => (store[id] ?? 0) >= kg * n - 1e-6);
  const can = DISHES.filter(d => makes(d, 1));
  if (!can.length || platesFree < 1) return null;
  const first = pick(rng, can);
  const dishes: DishId[] = [first.id];
  if (platesFree >= 2 && rng() < 0.4) {
    const left = { ...store };
    for (const [id, kg] of Object.entries(first.plate) as [ProduceId, number][]) left[id] = (left[id] ?? 0) - kg;
    const more = DISHES.filter(d => (Object.entries(d.plate) as [ProduceId, number][]).every(([id, kg]) => (left[id] ?? 0) >= kg - 1e-6));
    if (more.length) dishes.push(pick(rng, more).id);
  }
  return { kind: 'restaurant', dishes, to: rng() < 0.5 ? 'here' : 'away', taken: false };
}

const words = (items: Partial<Record<ProduceId, number>>) =>
  (Object.entries(items) as [ProduceId, number][]).map(([id, kg]) => `${kg} kg of ${PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, '')}`).join(' and ');

export function lineFor(o: MarketOrder | MealOrder, name: string): string {
  if (o.kind === 'market') {
    if (o.bags.length === 1) return `Habari! ${words(o.bags[0])}, please. One bag is fine.`;
    return `Hi, I'm ${name}. ${words(o.bags[0])} in one bag, and ${words(o.bags[1])} in another, please.`;
  }
  const ds = o.dishes.map(d => dishOf(d).name.toLowerCase());
  const what = ds.length === 2 ? `${ds[0]} and ${ds[1]}` : ds[0];
  return o.to === 'here' ? `Habari! ${what}, to eat here please.` : `${what} to take away, please. I'm in a hurry!`;
}

/** A new customer at the door, with an order from what the store can spare. Null when there is nothing left to sell. */
export function newPatron(sh: Shift, p0: Partial<ProduceState> | undefined, day: number, rng: Rng): Patron | null {
  const f = free(sh, p0, day);
  const order = sh.kind === 'market' ? marketOrder(f.store, f.kg, rng) : mealOrder(f.store, f.plates, rng);
  if (!order) return null;
  // a name no one in the shop has
  const taken = new Set(inShop(sh).map(p => p.name));
  const name = pick(rng, NAMES.filter(n => !taken.has(n)).length ? NAMES.filter(n => !taken.has(n)) : NAMES);
  const look: Look = { skin: pick(rng, SKINS), outfit: pick(rng, OUTFITS), trim: pick(rng, TRIMS), head: pick(rng, HEADS), headColor: pick(rng, HEAD_COLORS) };
  const max = order.kind === 'market' ? SHOP.marketPatience + SHOP.marketPerItem * Object.keys(orderItems(order)).length : SHOP.takePatience;
  const slot = inShop(sh).filter(p => p.phase === 'enter' || p.phase === 'queue' || p.phase === 'order').length;
  return { id: sh.nextId, name, look, extra: pick(rng, EXTRAS), kid: rng() < 0.15, phase: 'enter', t: 0, slot, seat: null, patience: max, max, order, line: lineFor(order, name), mood: null, said: '', carry: null, paid: 0 };
}

/** The customer at the counter now (ordering, or waiting for their bags). */
export const atCounter = (sh: Shift) => sh.patrons.find(p => p.phase === 'order' && p.slot === 0) ?? null;

/** Seconds a walk takes in the room (the scene walks them; the game only needs to know when they arrive). */
export const WALK = { enter: 2.6, step: 0.9, seat: 2.0, pickup: 1.6, leave: 2.6 };

export interface World {
  produce: Partial<ProduceState> | undefined;
  day: number;
  rng: Rng;
}

/** Time passes in the shop: customers walk in, queue, lose patience; the food on the fire cooks (and burns). */
export function tick(sh: Shift, dt: number, w: World) {
  sh.time += dt;
  // a new customer at the door
  sh.spawnIn -= dt;
  const queued = sh.patrons.filter(p => p.phase === 'enter' || p.phase === 'queue' || p.phase === 'order').length;
  if (!sh.closing && sh.spawnIn <= 0 && queued < SHOP.queue) {
    const p = newPatron(sh, w.produce, w.day, w.rng);
    sh.spawnIn = (sh.kind === 'market' ? SHOP.every : SHOP.mealEvery) * (0.75 + w.rng() * 0.5);
    if (p) {
      sh.patrons.push(p);
      sh.nextId++;
    } else if (!waiting(sh).length) sh.closing = true;
  }
  for (const p of sh.patrons) {
    if (p.phase === 'gone') continue;
    p.t += dt;
    if (p.phase === 'enter' && p.t >= WALK.enter) to(p, 'queue');
    if (p.phase === 'queue' && p.slot === 0 && p.t >= WALK.step) to(p, 'order');
    if (p.phase === 'order' || p.phase === 'wait') {
      p.patience -= dt;
      if (p.patience <= 0) walkOut(sh, p);
    }
    if (p.phase === 'pickup' && p.t >= WALK.pickup) {
      if (p.order.kind === 'restaurant' && p.order.to === 'here' && p.seat !== null) to(p, 'eat');
      else to(p, 'leave');
    }
    if (p.phase === 'eat' && p.t >= SHOP.eatSecs) {
      p.carry = null;
      to(p, 'leave');
    }
    if (p.phase === 'leave' && p.t >= WALK.leave) to(p, 'gone');
  }
  // the restaurant's stations
  for (const id of STATION_IDS) {
    const st = sh.stations[id];
    if (st.job !== null && STATIONS[id].kind !== 'chop') st.t += dt;
  }
  // nothing left to sell, and no one waiting: the shift is over
  if (!sh.closing && sh.spawnIn > 0 && !waiting(sh).length && !newPatron({ ...sh, patrons: sh.patrons }, w.produce, w.day, () => 0.5)) sh.closing = true;
}

function to(p: Patron, phase: Patron['phase']) {
  p.phase = phase;
  p.t = 0;
}

/** Moves everyone in the queue up when the counter frees. */
function shuffleUp(sh: Shift, from: number) {
  for (const q of sh.patrons) if ((q.phase === 'queue' || q.phase === 'enter' || q.phase === 'order') && q.slot > from) {
    q.slot -= 1;
    if (q.phase === 'order') to(q, 'queue');
    else if (q.phase === 'queue') q.t = 0;
  }
}

function walkOut(sh: Shift, p: Patron) {
  const was = p.slot;
  const counter = p.phase === 'order';
  p.mood = 'upset';
  p.said = p.order.kind === 'restaurant' && p.order.taken ? 'I waited too long. Never mind!' : 'Too slow! I’ll shop somewhere else.';
  p.carry = null;
  to(p, 'leave');
  sh.walked++;
  // their food goes back: the jobs for them are dropped
  if (p.order.kind === 'restaurant') dropJobs(sh, p.id);
  if (counter) {
    p.slot = -1;
    shuffleUp(sh, was);
    if (sh.kind === 'market') {
      sh.bags = [{}];
      sh.bag = 0;
    }
  }
  if (p.seat !== null) p.seat = null;
  flash(sh, `${p.name} walked out: they waited too long`, true);
}

function dropJobs(sh: Shift, patron: number) {
  const gone = new Set(sh.jobs.filter(j => j.patron === patron).map(j => j.id));
  if (sh.hands !== null && gone.has(sh.hands)) sh.hands = null;
  for (const id of STATION_IDS) if (sh.stations[id].job !== null && gone.has(sh.stations[id].job!)) sh.stations[id] = { job: null, t: 0, chops: 0 };
  sh.jobs = sh.jobs.filter(j => !gone.has(j.id));
}

/* ---------------- the stall ---------------- */

/** Pack a unit of something into the bag being filled. */
export function packItem(sh: Shift, id: ProduceId, store: Partial<Record<ProduceId, number>>): boolean {
  const c = atCounter(sh);
  if (!c) {
    flash(sh, 'No one at the counter yet', true);
    return false;
  }
  const inBags = sh.bags.reduce((n, b) => n + (b[id] ?? 0), 0);
  const u = unitOf(id);
  if (inBags + u > (store[id] ?? 0) + 1e-6) {
    flash(sh, `No more ${PRODUCE[id].name.toLowerCase()} in the store`, true);
    return false;
  }
  const b = sh.bags[sh.bag];
  b[id] = round1((b[id] ?? 0) + u);
  return true;
}

/** Take a unit of something back out of a bag. */
export function unpackItem(sh: Shift, bag: number, id: ProduceId) {
  const b = sh.bags[bag];
  if (!b?.[id]) return;
  const n = round1(b[id]! - unitOf(id));
  if (n <= 0) delete b[id];
  else b[id] = n;
}

/** A second bag on the counter (or back to one: what was in the second goes in the first). */
export function setBags(sh: Shift, n: 1 | 2) {
  if (n === 2 && sh.bags.length === 1) {
    sh.bags.push({});
    sh.bag = 1;
  } else if (n === 1 && sh.bags.length === 2) {
    const [a, b] = sh.bags;
    for (const [id, kg] of Object.entries(b) as [ProduceId, number][]) a[id] = round1((a[id] ?? 0) + kg);
    sh.bags = [a];
    sh.bag = 0;
  }
}

/** How well the bags match the order: 1 when every kg is right and in the right bag. */
export function packScore(o: MarketOrder, bags: Partial<Record<ProduceId, number>>[]) {
  const asked = orderItems(o);
  const given: Partial<Record<ProduceId, number>> = {};
  for (const b of bags) for (const [id, kg] of Object.entries(b) as [ProduceId, number][]) given[id] = round1((given[id] ?? 0) + kg);
  const ids = new Set([...Object.keys(asked), ...Object.keys(given)] as ProduceId[]);
  let off = 0;
  for (const id of ids) off += Math.abs((asked[id] ?? 0) - (given[id] ?? 0));
  const total = kgOf(asked);
  const amounts = Math.max(0, 1 - off / Math.max(total, 1));
  // the bags: one bag asked for one, or the two in either order
  const used = bags.filter(b => kgOf(b) > 0);
  const same = (a: Partial<Record<ProduceId, number>>, b: Partial<Record<ProduceId, number>>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every(k => Object.keys(a).includes(k) === Object.keys(b).includes(k));
  };
  let bagsRight: boolean;
  if (o.bags.length === 1) bagsRight = used.length === 1;
  else bagsRight = used.length === 2 && ((same(used[0], o.bags[0]) && same(used[1], o.bags[1])) || (same(used[0], o.bags[1]) && same(used[1], o.bags[0])));
  return { amounts, bagsRight, given, asked, score: round2(amounts * (bagsRight ? 1 : 0.7)) };
}

export interface Paid {
  patron: Patron;
  /** what they paid for the food */
  bill: number;
  tip: number;
  mood: 'happy' | 'ok' | 'upset';
  said: string;
}

/** Hand the bags to the customer at the counter: they pay for what they asked for and got, and tip a good, quick job.
    The caller sells the food (the game's sellTo) with `given` and `asked`. */
export function handOver(sh: Shift, cold: boolean): (Paid & { given: Partial<Record<ProduceId, number>>; asked: Partial<Record<ProduceId, number>> }) | null {
  const c = atCounter(sh);
  if (!c || c.order.kind !== 'market') return null;
  if (!sh.bags.some(b => kgOf(b) > 0)) {
    flash(sh, 'The bags are empty: tap the food to pack it', true);
    return null;
  }
  const r = packScore(c.order, sh.bags);
  const bill = round2((Object.entries(r.given) as [ProduceId, number][]).reduce((n, [id, kg]) => n + Math.min(kg, r.asked[id] ?? 0) * priceOf(id, cold), 0));
  const quick = Math.max(0, c.patience / c.max);
  const tip = r.score >= 0.99 ? round2(bill * SHOP.tip * (0.5 + 0.5 * quick)) : 0;
  const mood = r.score >= 0.99 ? 'happy' : r.score >= 0.6 ? 'ok' : 'upset';
  const said = mood === 'happy' ? (tip > 0 ? 'Perfect, asante sana! Keep the change.' : 'Perfect, asante!') : !r.bagsRight && r.amounts >= 0.99 ? 'Everything is there, but I asked for the bags another way.' : mood === 'ok' ? 'Hmm, not quite what I asked for.' : 'That is not my order at all!';
  finishPatron(sh, c, mood, said, sh.bags.filter(b => kgOf(b) > 0).length > 1 ? 'bags' : 'bag', bill + tip);
  sh.bags = [{}];
  sh.bag = 0;
  return { patron: c, bill, tip, mood, said, given: r.given, asked: r.asked };
}

function finishPatron(sh: Shift, c: Patron, mood: Patron['mood'] & string, said: string, carry: Patron['carry'], paid: number) {
  c.mood = mood;
  c.said = said;
  c.carry = carry;
  c.paid = paid;
  sh.served++;
  if (mood === 'happy') sh.happy++;
  if (c.phase === 'order') {
    const was = c.slot;
    c.slot = -1;
    to(c, sh.kind === 'market' ? 'leave' : 'pickup');
    shuffleUp(sh, was);
  } else to(c, 'pickup');
}

/* ---------------- the restaurant ---------------- */

/** Take the order of the customer at the counter: their dishes go on the kitchen's board, and they sit and wait. */
export function takeOrder(sh: Shift): Patron | null {
  const c = atCounter(sh);
  if (!c || c.order.kind !== 'restaurant' || c.order.taken) return null;
  c.order.taken = true;
  for (const d of c.order.dishes) sh.jobs.push({ id: sh.jobs.reduce((n, j) => Math.max(n, j.id), 0) + 1, patron: c.id, dish: d, got: [], step: 0, where: 'ticket', quality: 1, pack: null, notes: [] });
  const used = new Set(sh.patrons.filter(p => p.phase !== 'gone' && p.seat !== null).map(p => p.seat));
  const seat = Array.from({ length: SHOP.seats }, (_, i) => i).find(i => !used.has(i)) ?? null;
  c.seat = seat;
  c.max = SHOP.mealPatience + SHOP.mealPerDish * c.order.dishes.length;
  c.patience = c.max;
  const was = c.slot;
  c.slot = -1;
  to(c, 'wait');
  shuffleUp(sh, was);
  return c;
}

export const jobOf = (sh: Shift, id: number | null) => (id === null ? null : (sh.jobs.find(j => j.id === id) ?? null));
const stepsOf = (j: Job) => RECIPES[j.dish];
/** The station the job goes to next, or null (gathering, or ready to pack). */
export const nextStation = (j: Job): StationId | null => (j.step >= 1 && j.step <= stepsOf(j).length ? stepsOf(j)[j.step - 1].at : null);
export const needsFood = (j: Job): ProduceId[] => (Object.keys(dishOf(j.dish).plate) as ProduceId[]).filter(id => !j.got.includes(id));
export const readyToPack = (j: Job) => j.step > stepsOf(j).length && j.where === 'hands';

/** Pick a dish off the board to start it (hands must be free). */
export function startJob(sh: Shift, id: number): boolean {
  const j = jobOf(sh, id);
  if (!j || j.where !== 'ticket') return false;
  if (sh.hands !== null) {
    flash(sh, 'Your hands are full: finish or set down what you hold', true);
    return false;
  }
  j.where = 'hands';
  sh.hands = j.id;
  return true;
}

/** Take some food from the store for the dish in hand. */
export function gather(sh: Shift, food: ProduceId): 'ok' | 'wrong' | 'none' | 'done' {
  const j = jobOf(sh, sh.hands);
  if (!j || j.step !== 0) {
    flash(sh, j ? 'This dish has all its food: take it to the next station' : 'Pick a dish off the orders first', true);
    return 'none';
  }
  if (!(food in dishOf(j.dish).plate)) {
    flash(sh, `${PRODUCE[food].name} is not in ${dishOf(j.dish).name.toLowerCase()}`, true);
    return 'wrong';
  }
  if (!j.got.includes(food)) j.got.push(food);
  if (!needsFood(j).length) {
    j.step = 1;
    return 'done';
  }
  return 'ok';
}

/** Tap a station: put the dish in hand on it, chop on the board, or take what is done off the fire. */
export function atStation(sh: Shift, id: StationId): 'placed' | 'chop' | 'chopped' | 'taken' | 'notyet' | 'busy' | 'wrong' | 'none' {
  const st = sh.stations[id];
  const kind = STATIONS[id].kind;
  const onIt = jobOf(sh, st.job);
  if (onIt) {
    const step = stepsOf(onIt)[onIt.step - 1];
    if (kind === 'chop') {
      st.chops++;
      if (st.chops >= (step.chops ?? 3)) {
        if (sh.hands !== null) {
          flash(sh, 'Chopped! Free your hands to pick it up', false);
          return 'chop';
        }
        onIt.step++;
        onIt.where = 'hands';
        sh.hands = onIt.id;
        sh.stations[id] = { job: null, t: 0, chops: 0 };
        return 'chopped';
      }
      return 'chop';
    }
    const secs = step.secs ?? 5;
    if (st.t < secs) {
      flash(sh, `${dishOf(onIt.dish).name} is not ready yet`, true);
      return 'notyet';
    }
    if (sh.hands !== null) {
      flash(sh, 'Your hands are full', true);
      return 'busy';
    }
    if (kind === 'cook' && st.t > secs * SHOP.burnAt) {
      onIt.quality = round2(onIt.quality - 0.5);
      onIt.notes.push('burnt');
    } else if (kind === 'cook' && st.t > secs * SHOP.doneUntil) {
      onIt.quality = round2(onIt.quality - 0.2);
      onIt.notes.push('overcooked');
    }
    onIt.step++;
    onIt.where = 'hands';
    sh.hands = onIt.id;
    sh.stations[id] = { job: null, t: 0, chops: 0 };
    return 'taken';
  }
  const j = jobOf(sh, sh.hands);
  if (!j) {
    flash(sh, `The ${STATIONS[id].name.toLowerCase()} is empty`, true);
    return 'none';
  }
  if (j.step === 0) {
    flash(sh, `Gather the food first: ${needsFood(j).map(f => PRODUCE[f].name.toLowerCase()).join(', ')}`, true);
    return 'wrong';
  }
  const want = nextStation(j);
  if (want !== id) {
    flash(sh, want ? `${dishOf(j.dish).name} goes to the ${STATIONS[want].name.toLowerCase()} next` : `${dishOf(j.dish).name} is ready: plate it or box it`, true);
    return 'wrong';
  }
  st.job = j.id;
  st.t = 0;
  st.chops = kind === 'chop' ? 1 : 0;
  j.where = id;
  sh.hands = null;
  return 'placed';
}

/** How a dish on a station is getting on: 0 to 1 until done, then done, then overcooked or burnt. */
export function stationStatus(sh: Shift, id: StationId): { job: Job | null; progress: number; state: 'empty' | 'working' | 'done' | 'over' | 'burnt' } {
  const st = sh.stations[id];
  const j = jobOf(sh, st.job);
  if (!j) return { job: null, progress: 0, state: 'empty' };
  const step = stepsOf(j)[j.step - 1];
  if (STATIONS[id].kind === 'chop') return { job: j, progress: st.chops / (step.chops ?? 3), state: 'working' };
  const secs = step.secs ?? 5;
  const progress = Math.min(1, st.t / secs);
  if (st.t < secs) return { job: j, progress, state: 'working' };
  if (STATIONS[id].kind === 'blend') return { job: j, progress: 1, state: 'done' };
  return { job: j, progress: 1, state: st.t > secs * SHOP.burnAt ? 'burnt' : st.t > secs * SHOP.doneUntil ? 'over' : 'done' };
}

/** Put the dish in hand on a plate or in a takeaway box; it waits on the pass to be served. */
export function packDish(sh: Shift, pack: 'plate' | 'box'): boolean {
  const j = jobOf(sh, sh.hands);
  if (!j || !readyToPack(j)) {
    flash(sh, j ? `${dishOf(j.dish).name} is not cooked yet` : 'Nothing in your hands to pack', true);
    return false;
  }
  const c = sh.patrons.find(p => p.id === j.patron);
  const want = c && c.order.kind === 'restaurant' ? (c.order.to === 'here' ? 'plate' : 'box') : pack;
  if (pack !== want) {
    j.quality = round2(j.quality - 0.3);
    j.notes.push(pack === 'box' ? 'boxed, not plated' : 'plated, not boxed');
  }
  j.pack = pack;
  j.where = 'pass';
  sh.hands = null;
  return true;
}

/** Throw away the dish in hand and start it again from the board (the food is only used when it is served). */
export function binDish(sh: Shift) {
  const j = jobOf(sh, sh.hands);
  if (!j) return;
  j.got = [];
  j.step = 0;
  j.quality = 1;
  j.notes = [];
  j.where = 'ticket';
  sh.hands = null;
}

/** Every dish for this customer is on the pass. */
export const mealReady = (sh: Shift, patron: number) => {
  const js = sh.jobs.filter(j => j.patron === patron);
  return js.length > 0 && js.every(j => j.where === 'pass');
};

/** Serve a customer their meal: they pay for it (the caller cooks it from the store with the game's restaurant), and
    tip good food served quickly; burnt food is half price. */
export function serveMeal(sh: Shift, patron: number): (Paid & { dishes: DishId[]; discount: number }) | null {
  const c = sh.patrons.find(p => p.id === patron);
  if (!c || c.order.kind !== 'restaurant' || !mealReady(sh, patron) || c.phase !== 'wait') return null;
  const js = sh.jobs.filter(j => j.patron === patron);
  const q = js.reduce((n, j) => n + j.quality, 0) / js.length;
  const bill = round2(js.reduce((n, j) => n + dishOf(j.dish).price, 0));
  const discount = round2(js.filter(j => j.quality < 0.6).reduce((n, j) => n + dishOf(j.dish).price / 2, 0));
  const quick = Math.max(0, c.patience / c.max);
  const tip = q >= 0.95 ? round2(bill * SHOP.tip * (0.5 + 0.5 * quick)) : 0;
  const mood = q >= 0.95 ? 'happy' : q >= 0.6 ? 'ok' : 'upset';
  const notes = [...new Set(js.flatMap(j => j.notes))];
  const said = mood === 'happy' ? (c.order.to === 'here' ? 'Tamu sana! Delicious.' : 'Just right, asante! See you tomorrow.') : notes.includes('burnt') ? 'This is burnt! I’ll only pay half for it.' : notes.length ? `Hmm: ${notes.join(', ')}.` : 'It is fine, I suppose.';
  sh.jobs = sh.jobs.filter(j => j.patron !== patron);
  const dishes = c.order.dishes;
  finishPatron(sh, c, mood, said, c.order.to === 'here' ? 'plate' : 'box', round2(bill - discount + tip));
  return { patron: c, bill: round2(bill - discount), tip, mood, said, dishes, discount };
}

/** The money taken, once the game has sold the food (Shop.tsx adds it here). */
export function booked(sh: Shift, earned: number, tip: number) {
  sh.earned = round2(sh.earned + earned);
  sh.tips = round2(sh.tips + tip);
}

/** The shift is over: no one left in the shop, and no one else coming. */
export const shiftOver = (sh: Shift) => sh.closing && !inShop(sh).some(p => p.phase !== 'leave');

/** Close the shop: no one else comes in (those inside are still served). */
export function closeShop(sh: Shift) {
  sh.closing = true;
}

/** What the store has of the things the stall sells, for the food cards (the most a card can pack). */
export const stockOf = (p0: Partial<ProduceState> | undefined) => {
  const p = produceOf(p0);
  return (Object.keys(PRODUCE) as ProduceId[]).filter(id => (p.store[id] ?? 0) > 0).map(id => ({ id, kg: p.store[id]! }));
};

/** A dish's recipe as station icons, for the menu cards. */
export const recipeIcons = (d: DishId) => RECIPES[d].map(st => STATIONS[st.at].icon).join(' → ');

/** The shop's clock: the tests run it faster. */
export const shopClock = { scale: 1 };

export { MARKET };
