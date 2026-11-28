/* The shop floor: the market stall and the restaurant played as a game. At the stall customers walk in and queue at
   the counter; the farmer packs each order from the store into one bag or two, as the customer asks, and hands it
   over. At the restaurant customers walk in, sit down at a table and order, either a dish by name or a kind of food
   ("something for energy", "something body-building", "something protective"); the farmer picks a dish off the menu
   that fits, it cooks by itself at its station, and the farmer serves it. The menu is five simple dishes from the
   farm's own crops (MENU in src/produce/restaurant.ts), so the game teaches what each food does for the body. A
   customer pays for what they got, and tips for the right food served quickly; one kept waiting too long walks out.

   The stall's 25 kg a day and the restaurant's 30 plates a day hold here too, and every order is made from what is
   in the store, so the game sells the farm's own harvest. No screens here (Shop.tsx draws it, scene.ts is the 3D
   room), so it can be tested on its own. Times are in seconds of play. */

import type { Look } from '../first/data';
import { MARKET, PRODUCE, leftToday, priceOf, produceOf, type ProduceId, type ProduceState } from '../produce/model';
import { MENU, NEEDS, NEED_IDS, dishOf, lessonOf, needsOf, platesLeft, type DishId, type Need } from '../produce/restaurant';

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
  /** what they asked for: a dish by name, or a kind of food (any dish that is that kind fits) */
  ask: { dish: DishId } | { need: Need };
  /** the dish the farmer is cooking for them (null until one is picked off the menu) */
  dish: DishId | null;
}

/** The dish a meal order holds back from the store: the one cooking, or the one asked for. */
const heldDish = (o: MealOrder): DishId | null => o.dish ?? ('dish' in o.ask ? o.ask.dish : null);
/** Does a dish fit what the customer asked for? */
export const fits = (o: MealOrder, d: DishId) => ('dish' in o.ask ? o.ask.dish === d : needsOf(dishOf(d)).includes(o.ask.need));

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

/** Where each dish cooks, and how long it takes (seconds): it cooks by itself once it is picked off the menu. */
export const COOK: Record<DishId, { at: StationId; secs: number }> = {
  githeri: { at: 'pot', secs: 7 },
  'ugali-sukuma': { at: 'pan', secs: 6 },
  'bean-stew': { at: 'pot', secs: 6 },
  kachumbari: { at: 'board', secs: 3 },
  'strawberry-cup': { at: 'board', secs: 2 },
  'beans-ugali': { at: 'pot', secs: 7 },
  'pepper-stew': { at: 'pan', secs: 6 },
  juice: { at: 'blender', secs: 4 },
  'stuffed-capsicum': { at: 'oven', secs: 8 },
  'maize-bread': { at: 'oven', secs: 9 },
};

export const SHOP = {
  /** seconds between customers walking in: the stall, and the restaurant (a meal takes longer than packing bags) */
  every: 8,
  mealEvery: 13,
  /** people in the queue at most */
  queue: 4,
  /** seats at the restaurant's tables */
  seats: 6,
  /** patience at the stall: a base, and more for each thing on the order */
  marketPatience: 40,
  marketPerItem: 10,
  /** patience at the restaurant, from the moment a customer sits down to order until their food comes */
  mealPatience: 60,
  /** the most a customer tips, as a share of the bill */
  tip: 0.15,
  /** seconds a customer sits and eats */
  eatSecs: 5,
};

/** A dish cooking for a customer. */
export interface Job {
  id: number;
  patron: number;
  dish: DishId;
  /** seconds it has cooked */
  t: number;
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
  /** the restaurant: the dishes cooking or ready to serve */
  jobs: Job[];
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
export function free(sh: Shift, p0: Partial<ProduceState> | undefined, day: number, except?: number) {
  const p = produceOf(p0);
  const store = { ...p.store };
  let kg = leftToday(p, day);
  let plates = platesLeft(p, day);
  for (const c of waiting(sh)) {
    if (c.id === except) continue;
    if (c.order.kind === 'market') {
      for (const [id, n] of Object.entries(orderItems(c.order)) as [ProduceId, number][]) store[id] = round2((store[id] ?? 0) - n);
      kg -= kgOf(orderItems(c.order));
    } else {
      const d = heldDish(c.order);
      if (d) for (const [id, n] of Object.entries(dishOf(d).plate) as [ProduceId, number][]) store[id] = round2((store[id] ?? 0) - n);
      plates -= 1;
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

/** The menu's dishes the store has the food for. */
export const canMake = (store: Partial<Record<ProduceId, number>>) => MENU.filter(d => (Object.entries(dishOf(d).plate) as [ProduceId, number][]).every(([id, kg]) => (store[id] ?? 0) >= kg - 1e-6));

/** A new meal order from what is free: a dish off the menu the store can make, or (about half the time) a kind of
    food that one of those dishes is. Null when the kitchen cannot cook any. */
export function mealOrder(store: Partial<Record<ProduceId, number>>, platesFree: number, rng: Rng): MealOrder | null {
  const can = canMake(store);
  if (!can.length || platesFree < 1) return null;
  if (rng() < 0.5) {
    const needs = NEED_IDS.filter(n => can.some(d => needsOf(dishOf(d)).includes(n)));
    if (needs.length) return { kind: 'restaurant', ask: { need: pick(rng, needs) }, dish: null };
  }
  return { kind: 'restaurant', ask: { dish: pick(rng, can) }, dish: null };
}

const words = (items: Partial<Record<ProduceId, number>>) =>
  (Object.entries(items) as [ProduceId, number][]).map(([id, kg]) => `${kg} kg of ${PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, '')}`).join(' and ');

export function lineFor(o: MarketOrder | MealOrder, name: string): string {
  if (o.kind === 'market') {
    if (o.bags.length === 1) return `Habari! ${words(o.bags[0])}, please. One bag is fine.`;
    return `Hi, I'm ${name}. ${words(o.bags[0])} in one bag, and ${words(o.bags[1])} in another, please.`;
  }
  if ('need' in o.ask) {
    const asks = NEEDS[o.ask.need].asks;
    return asks[name.length % asks.length];
  }
  return `Habari! ${dishOf(o.ask.dish).name}, please.`;
}

/** A new customer at the door, with an order from what the store can spare. Null when there is nothing left to sell. */
export function newPatron(sh: Shift, p0: Partial<ProduceState> | undefined, day: number, rng: Rng): Patron | null {
  // the restaurant: a customer comes in only when there is a seat for them
  const seat = sh.kind === 'restaurant' ? freeSeat(sh) : null;
  if (sh.kind === 'restaurant' && seat === null) return null;
  const f = free(sh, p0, day);
  const order = sh.kind === 'market' ? marketOrder(f.store, f.kg, rng) : mealOrder(f.store, f.plates, rng);
  if (!order) return null;
  // a name no one in the shop has
  const taken = new Set(inShop(sh).map(p => p.name));
  const name = pick(rng, NAMES.filter(n => !taken.has(n)).length ? NAMES.filter(n => !taken.has(n)) : NAMES);
  const look: Look = { skin: pick(rng, SKINS), outfit: pick(rng, OUTFITS), trim: pick(rng, TRIMS), head: pick(rng, HEADS), headColor: pick(rng, HEAD_COLORS) };
  const max = order.kind === 'market' ? SHOP.marketPatience + SHOP.marketPerItem * Object.keys(orderItems(order)).length : SHOP.mealPatience;
  const slot = order.kind === 'market' ? inShop(sh).filter(p => p.phase === 'enter' || p.phase === 'queue' || p.phase === 'order').length : -1;
  return { id: sh.nextId, name, look, extra: pick(rng, EXTRAS), kid: rng() < 0.15, phase: 'enter', t: 0, slot, seat, patience: max, max, order, line: lineFor(order, name), mood: null, said: '', carry: null, paid: 0 };
}

/** A seat no one in the restaurant has. */
function freeSeat(sh: Shift): number | null {
  const used = new Set(sh.patrons.filter(p => p.phase !== 'gone' && p.phase !== 'leave' && p.seat !== null).map(p => p.seat));
  return Array.from({ length: SHOP.seats }, (_, i) => i).find(i => !used.has(i)) ?? null;
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
  if (!sh.closing && sh.spawnIn <= 0 && (sh.kind === 'restaurant' || queued < SHOP.queue)) {
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
    // at the restaurant they walk in to a table, sit and order; at the stall they join the queue
    if (p.phase === 'enter' && p.order.kind === 'restaurant' && p.t >= WALK.enter + WALK.seat) to(p, 'order');
    if (p.phase === 'enter' && p.order.kind === 'market' && p.t >= WALK.enter) to(p, 'queue');
    if (p.phase === 'queue' && p.slot === 0 && p.t >= WALK.step) to(p, 'order');
    if (p.phase === 'order' || p.phase === 'wait') {
      p.patience -= dt;
      if (p.patience <= 0) walkOut(sh, p);
    }
    if (p.phase === 'pickup' && p.t >= WALK.pickup) to(p, 'leave');
    if (p.phase === 'eat' && p.t >= SHOP.eatSecs) {
      p.carry = null;
      to(p, 'leave');
    }
    if (p.phase === 'leave' && p.t >= WALK.leave) to(p, 'gone');
  }
  // the restaurant's dishes cook
  for (const j of sh.jobs) j.t += dt;
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
  const counter = p.phase === 'order' && p.order.kind === 'market';
  p.mood = 'upset';
  p.said = p.order.kind === 'restaurant' ? 'I waited too long. Never mind!' : 'Too slow! I’ll shop somewhere else.';
  p.carry = null;
  to(p, 'leave');
  sh.walked++;
  // their food goes back: the jobs for them are dropped
  if (p.order.kind === 'restaurant') sh.jobs = sh.jobs.filter(j => j.patron !== p.id);
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

export const jobOf = (sh: Shift, patron: number) => sh.jobs.find(j => j.patron === patron) ?? null;
/** How far a dish has cooked, 0 to 1. */
export const progressOf = (j: Job) => Math.min(1, j.t / COOK[j.dish].secs);
export const isReady = (j: Job) => j.t >= COOK[j.dish].secs;

/** The customers sitting at the tables who have ordered and have no dish cooking yet. */
export const ordering = (sh: Shift) => sh.patrons.filter(p => p.phase === 'order' && p.order.kind === 'restaurant');

/** Cook a dish off the menu for a seated customer: it goes on its station and cooks by itself. The store must have the
    food for it (counting what the other orders hold back). Any dish can be cooked; the customer says if it fits. */
export function cookFor(sh: Shift, patron: number, dish: DishId, p0: Partial<ProduceState> | undefined, day: number): boolean {
  const c = sh.patrons.find(p => p.id === patron);
  if (!c || c.order.kind !== 'restaurant' || c.phase !== 'order') return false;
  // what is free once everyone else's food is held back
  const o = c.order;
  const f = free(sh, p0, day, patron);
  if (!canMake(f.store).includes(dish)) {
    const d = dishOf(dish);
    const short = (Object.entries(d.plate) as [ProduceId, number][]).filter(([id, kg]) => (f.store[id] ?? 0) < kg - 1e-6).map(([id]) => PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, ''));
    flash(sh, `Not enough in the store for ${d.name.toLowerCase()}: you need ${short.join(' and ')}`, true);
    return false;
  }
  o.dish = dish;
  sh.jobs.push({ id: sh.jobs.reduce((n, j) => Math.max(n, j.id), 0) + 1, patron, dish, t: 0 });
  to(c, 'wait');
  // they wait a little longer now that their food is on the fire
  c.patience = Math.max(c.patience, COOK[dish].secs + 20);
  return true;
}

/** A station: what is cooking on it (the first dish not yet ready), or the last one ready. */
export function stationStatus(sh: Shift, id: StationId): { job: Job | null; progress: number; state: 'empty' | 'working' | 'done' } {
  const here = sh.jobs.filter(j => COOK[j.dish].at === id);
  const cooking = here.find(j => !isReady(j));
  if (cooking) return { job: cooking, progress: progressOf(cooking), state: 'working' };
  if (here.length) return { job: here[0], progress: 1, state: 'done' };
  return { job: null, progress: 0, state: 'empty' };
}

/** Serve a customer the dish cooked for them: they pay for it (the caller cooks it from the store with the game's
    restaurant) and eat at their table. The right food quickly earns a tip; a kind of food that does not fit what they
    needed earns none, and a different dish from the one they named is half price. Every plate says what it is. */
export function serveMeal(sh: Shift, patron: number): (Paid & { dishes: DishId[]; discount: number; fit: boolean; lesson: string; ask: string }) | null {
  const c = sh.patrons.find(p => p.id === patron);
  const j = jobOf(sh, patron);
  if (!c || c.order.kind !== 'restaurant' || c.phase !== 'wait' || !j || !isReady(j)) return null;
  const o = c.order;
  const d = dishOf(j.dish);
  const fit = fits(o, j.dish);
  const named = 'dish' in o.ask;
  const discount = !fit && named ? round2(d.price / 2) : 0;
  const quick = Math.max(0, c.patience / c.max);
  const tip = fit ? round2(d.price * SHOP.tip * (0.5 + 0.5 * quick)) : 0;
  const mood = fit ? 'happy' : named ? 'upset' : 'ok';
  const want = 'need' in o.ask ? NEEDS[o.ask.need] : null;
  const said = fit
    ? want
      ? `Just what I needed: ${want.short.toLowerCase()} food. Asante!`
      : 'Tamu sana! Delicious.'
    : want
      ? `Tasty, but it isn’t ${want.short.toLowerCase()} food.`
      : `I asked for ${dishOf((o.ask as { dish: DishId }).dish).name.toLowerCase()}! Half price.`;
  sh.jobs = sh.jobs.filter(x => x !== j);
  finishPatron(sh, c, mood, said, 'plate', round2(d.price - discount + tip));
  // they sit and eat at their table before they go
  to(c, 'eat');
  if (!fit) flash(sh, want ? `${want.name}: ${want.does}` : `${c.name} asked for ${dishOf((o.ask as { dish: DishId }).dish).name}`, true);
  return { patron: c, bill: round2(d.price - discount), tip, mood, said, dishes: [j.dish], discount, fit, lesson: lessonOf(d), ask: 'need' in o.ask ? o.ask.need : o.ask.dish };
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

/** Where a dish cooks, for the menu cards. */
export const recipeIcons = (d: DishId) => `${STATIONS[COOK[d].at].icon} ${STATIONS[COOK[d].at].name}`;

/** The shop's clock: the tests run it faster. */
export const shopClock = { scale: 1 };

export { MARKET };
