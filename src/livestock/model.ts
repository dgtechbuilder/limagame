/* The cows and the hens: their care through the day, their health, their diseases and problems, and what a night
   does to them. No screens here (the page is Animals.tsx); every number is in ./config.ts. The herd itself (how many
   cows and hens) stays where the water model keeps it (tank.herd), so the water they drink and their emissions
   follow it. */

import { WATER, type Herd } from '../water/config';
import { animalsUse, tankOf, type TankState } from '../water/model';
import type { Forecast, Trial } from '../trials/model';
import { roll } from './rand';
import {
  CARE,
  COOPS,
  DEWORM,
  ISSUES,
  LIFE,
  NO_COOP,
  careOf,
  coopOption,
  issueOf,
  preventOf,
  type CareId,
  type CoopId,
  type Group,
  type IssueId,
  type PreventId,
} from './config';

export interface ActiveIssue {
  id: IssueId;
  /** the farm day it showed */
  since: number;
}

/** Something a night (or a choice) did, for the morning's report and the page's log. */
export interface LifeEvent {
  kind: 'death' | 'issue' | 'thirst' | 'theft' | 'predator' | 'recovered' | 'cost' | 'fixed';
  text: string;
  /** what it cost, in stored money (a loss), when it has a price */
  value?: number;
  /** what would have helped */
  tip?: string;
}

export interface LifeState {
  /** the farm day: 1 the day the farm opened; a night slept on the fast clock, or a calendar day, adds one */
  day: number;
  /** the calendar day last counted (YYYY-MM-DD); null until the farm opens */
  date: string | null;
  /** the farm day care started (the day-2 dialog was shown), or null */
  started: number | null;
  health: Record<Group, number>;
  /** each job, and the farm day it was last done */
  done: Partial<Record<CareId, number>>;
  coop: CoopId | null;
  issues: ActiveIssue[];
  /** each prevention, and the last farm day it still covers */
  prevent: Partial<Record<PreventId, number>>;
  /** today's milk (litres) and eggs, and what they and today's care earned and cost */
  today: { milk: number; eggs: number; earned: number; spent: number };
  totals: { milk: number; eggs: number; earned: number; spent: number; deaths: number; fixed: number; wrong: number };
  /** the last fix picked for each problem showing: the lesson stays on screen */
  tried: Partial<Record<IssueId, string[]>>;
  /** newest first: what happened to the animals */
  log: { day: number; text: string }[];
}

export const newLife = (): LifeState => ({
  day: 1,
  date: null,
  started: null,
  health: { cows: LIFE.health.start, hens: LIFE.health.start },
  done: {},
  coop: null,
  issues: [],
  prevent: {},
  today: { milk: 0, eggs: 0, earned: 0, spent: 0 },
  totals: { milk: 0, eggs: 0, earned: 0, spent: 0, deaths: 0, fixed: 0, wrong: 0 },
  tried: {},
  log: [],
});

export const lifeOf = (l: Partial<LifeState> | undefined): LifeState => {
  const base = newLife();
  return { ...base, ...(l ?? {}), health: { ...base.health, ...(l?.health ?? {}) }, today: { ...base.today, ...(l?.today ?? {}) }, totals: { ...base.totals, ...(l?.totals ?? {}) } };
};

/** What the animals need from the game state. */
export interface LifeHost {
  life?: Partial<LifeState>;
  tank?: Partial<TankState>;
  trial: Trial | null;
  coins: number;
}

export const herdOf = (s: Pick<LifeHost, 'tank'>): Herd => tankOf(s.tank).herd;
export const countOf = (s: Pick<LifeHost, 'tank'>, g: Group) => herdOf(s)[g];
/** The animals are in the player's care (from day 2). */
export const careOpen = (s: Pick<LifeHost, 'life'>) => lifeOf(s.life).day >= LIFE.startDay;
const forecastOf = (s: Pick<LifeHost, 'trial'>): Forecast => s.trial?.forecast ?? 'normal';

/* ---------------- the coop ---------------- */

/** Hens the coop holds (with no coop, the trees hold a few). */
export const coopRoom = (coop: CoopId | null) => coopOption(coop)?.room ?? NO_COOP.room;
export const crowded = (s: LifeHost) => countOf(s, 'hens') > coopRoom(lifeOf(s.life).coop);
/** The price of building this coop now: an upgrade pays the difference (and the work of moving the hens). */
export function coopPrice(current: CoopId | null, to: CoopId): number | null {
  const want = coopOption(to)!;
  const have = coopOption(current);
  if (have && have.price >= want.price) return null;
  return have ? want.price - have.price + 300 : want.price;
}
export const COOP_ORDER = COOPS.map(c => c.id);

/* ---------------- care through the day ---------------- */

/** Days since a job was done (a job never done counts from the day care started). */
function since(l: LifeState, id: CareId) {
  const last = l.done[id] ?? (l.started ?? l.day) - (careOf(id).every === 1 ? 1 : 0);
  return l.day - last;
}
/** The job is waiting today. */
export function careDue(s: LifeHost, id: CareId): boolean {
  const l = lifeOf(s.life);
  const c = careOf(id);
  if (!careOpen(s) || countOf(s, c.group) <= 0) return false;
  if (id === 'closeCoop' && !l.coop) return false;
  return since(l, id) >= c.every;
}
export const careDoneToday = (s: LifeHost, id: CareId) => lifeOf(s.life).done[id] === lifeOf(s.life).day;
/** Every job waiting today. */
export const careLeft = (s: LifeHost) => CARE.filter(c => careDue(s, c.id));
/** A pen or coop left past its cleaning day. */
export const dirty = (s: LifeHost, g: Group) => {
  const l = lifeOf(s.life);
  return careOpen(s) && since(l, g === 'cows' ? 'pen' : 'coopClean') > LIFE.cleanEvery;
};

export const careCost = (s: LifeHost, id: CareId) => Math.round((careOf(id).costEach ?? 0) * countOf(s, careOf(id).group) * 10) / 10;

/** The share of a group's milk or eggs its problems leave. */
const issuesOutput = (l: LifeState, g: Group) => l.issues.filter(i => issueOf(i.id).group === g).reduce((k, i) => k * issueOf(i.id).output, 1);
/** Litres of milk the cows give today, as cared for so far. */
export function milkToday(s: LifeHost): number {
  const l = lifeOf(s.life);
  const n = countOf(s, 'cows');
  const fed = l.done.cowFeed === l.day ? 1 : 0.6;
  const watered = l.done.cowWater === l.day ? 1 : 0.5;
  return Math.round(n * LIFE.milk.perCow * (l.health.cows / 100) * fed * watered * issuesOutput(l, 'cows') * 10) / 10;
}
/** Eggs the hens lay today, as cared for so far. */
export function eggsToday(s: LifeHost): number {
  const l = lifeOf(s.life);
  const n = countOf(s, 'hens');
  const fed = l.done.henFeed === l.day ? 1 : 0.5;
  const watered = l.done.henWater === l.day ? 1 : 0.6;
  const coop = 1 + (coopOption(l.coop)?.eggs ?? NO_COOP.eggs);
  return Math.floor(n * LIFE.eggs.perHen * (l.health.hens / 100) * fed * watered * coop * issuesOutput(l, 'hens'));
}

/** Litres a day the animals need: what they drink (the water model's count), and what their problems waste. */
export function animalWater(s: LifeHost) {
  const l = lifeOf(s.life);
  const herd = herdOf(s);
  const drink = animalsUse(herd);
  const dry = forecastOf(s) === 'dry';
  // cows drink a fifth more in a dry season
  const heatDrink = dry ? Math.round(herd.cows * WATER.animals.cow.litres * 0.2) : 0;
  const extra = l.issues.reduce((n, i) => n + (issueOf(i.id).water ?? 0) * (issueOf(i.id).id === 'heat' ? herd.cows : 1), 0);
  return { drink, heatDrink, extra, total: drink + heatDrink + extra, trough: herd.cows * WATER.animals.cow.litres };
}

type Patch<S> = { state: S; text: string } | { error: string };

/** Do one of the day's jobs. */
export function doCare<S extends LifeHost>(s: S, id: CareId): Patch<S> {
  const l = lifeOf(s.life);
  const c = careOf(id);
  if (!careOpen(s)) return { error: `The animals are in your care from day ${LIFE.startDay}` };
  if (countOf(s, c.group) <= 0) return { error: `You have no ${c.group}` };
  if (l.done[id] === l.day) return { error: `${c.label}: done today` };
  if (!careDue(s, id)) return { error: id === 'closeCoop' ? 'Build a coop first' : `${c.label}: not needed again yet` };
  const cost = careCost(s, id);
  if (s.coins < cost) return { error: `You need ${cost} for ${c.label.toLowerCase()}` };
  let coins = s.coins - cost;
  let today = { ...l.today, spent: l.today.spent + cost };
  let totals = { ...l.totals, spent: l.totals.spent + cost };
  let text = c.label;
  if (id === 'cowWater') {
    const need = animalWater(s).trough;
    const t = tankOf(s.tank);
    if (t.level < need) return { error: `The tank has ${Math.round(t.level)} L: the cows need ${need} L. Buy water (Climate › Water)` };
    text = `Trough filled: ${need} L for ${countOf(s, 'cows')} cow${countOf(s, 'cows') === 1 ? '' : 's'}`;
  }
  const next = { ...l, done: { ...l.done, [id]: l.day } };
  if (id === 'milk') {
    const litres = milkToday(s);
    const earned = Math.round(litres * LIFE.milk.price);
    coins += earned;
    today = { ...today, milk: today.milk + litres, earned: today.earned + earned };
    totals = { ...totals, milk: totals.milk + litres, earned: totals.earned + earned };
    text = `${litres} L of milk to the dairy · +${earned}`;
  }
  if (id === 'eggs') {
    const eggs = eggsToday(s);
    const earned = Math.round(eggs * LIFE.eggs.price);
    coins += earned;
    today = { ...today, eggs: today.eggs + eggs, earned: today.earned + earned };
    totals = { ...totals, eggs: totals.eggs + eggs, earned: totals.earned + earned };
    text = `${eggs} egg${eggs === 1 ? '' : 's'} collected and sold · +${earned}`;
  }
  return { state: { ...s, coins, life: { ...next, today, totals } }, text };
}

/** Pick a fix for a problem showing: the right one clears it; a wrong one costs what it costs, and it stays. */
export function fixIssue<S extends LifeHost>(s: S, id: IssueId, fixId: string): Patch<S> & { right?: boolean } {
  const l = lifeOf(s.life);
  if (!l.issues.some(i => i.id === id)) return { error: 'That has cleared up already' };
  const issue = issueOf(id);
  const fix = issue.fixes.find(f => f.id === fixId);
  if (!fix) return { error: 'Pick a fix' };
  if (s.coins < fix.cost) return { error: `You need ${fix.cost} for that` };
  const tried = { ...l.tried, [id]: [...(l.tried[id] ?? []), fixId] };
  const base = { ...l, tried, today: { ...l.today, spent: l.today.spent + fix.cost }, totals: { ...l.totals, spent: l.totals.spent + fix.cost } };
  if (!fix.right) {
    return { state: { ...s, coins: s.coins - fix.cost, life: { ...base, totals: { ...base.totals, wrong: base.totals.wrong + 1 } } }, text: `Not that: ${fix.lesson}`, right: false };
  }
  const g = issue.group;
  const life: LifeState = {
    ...base,
    issues: l.issues.filter(i => i.id !== id),
    health: { ...l.health, [g]: Math.min(100, l.health[g] + 10) },
    totals: { ...base.totals, fixed: base.totals.fixed + 1 },
    log: [{ day: l.day, text: `${issue.name}: ${fix.label.toLowerCase()}` }, ...l.log].slice(0, 20),
  };
  return { state: { ...s, coins: s.coins - fix.cost, life }, text: `${issue.name} treated · ${fix.lesson}`, right: true };
}

/** What a prevention costs for the herd now. */
export function preventCost(s: LifeHost, id: PreventId): number {
  const h = herdOf(s);
  if (id === 'deworm') return Math.round(h.cows * DEWORM.cow + h.hens * DEWORM.hen);
  const p = preventOf(id);
  return Math.round(p.costEach * (p.group === 'hens' ? h.hens : h.cows));
}
export const preventLeft = (s: LifeHost, id: PreventId) => Math.max(0, (lifeOf(s.life).prevent[id] ?? 0) - lifeOf(s.life).day + 1);

export function doPrevent<S extends LifeHost>(s: S, id: PreventId): Patch<S> {
  const l = lifeOf(s.life);
  const p = preventOf(id);
  if (!careOpen(s)) return { error: `The animals are in your care from day ${LIFE.startDay}` };
  const n = p.group === 'both' ? countOf(s, 'cows') + countOf(s, 'hens') : countOf(s, p.group);
  if (n <= 0) return { error: `You have no ${p.group}` };
  if (preventLeft(s, id) > 2) return { error: `${p.label}: still covered for ${preventLeft(s, id)} days` };
  const cost = preventCost(s, id);
  if (s.coins < cost) return { error: `You need ${cost} for that` };
  const life = { ...l, prevent: { ...l.prevent, [id]: l.day + p.days - 1 }, today: { ...l.today, spent: l.today.spent + cost }, totals: { ...l.totals, spent: l.totals.spent + cost } };
  return { state: { ...s, coins: s.coins - cost, life }, text: `${p.label}: covered for ${p.days} days` };
}

export function buildCoop<S extends LifeHost>(s: S, id: CoopId): Patch<S> {
  const l = lifeOf(s.life);
  if (!careOpen(s)) return { error: `The coop is built from day ${LIFE.startDay}` };
  const price = coopPrice(l.coop, id);
  const o = coopOption(id)!;
  if (price === null) return { error: `You have a ${coopOption(l.coop)!.name.toLowerCase()} already` };
  if (s.coins < price) return { error: `You need ${price} for the ${o.name.toLowerCase()}` };
  const life = { ...l, coop: id, done: { ...l.done, coopClean: l.day }, totals: { ...l.totals, spent: l.totals.spent + price }, log: [{ day: l.day, text: `Built: ${o.name.toLowerCase()}` }, ...l.log].slice(0, 20) };
  return { state: { ...s, coins: s.coins - price, life }, text: `${o.name} built: room for ${o.room} hens` };
}

/* ---------------- a night ---------------- */

const issueWeight = (s: LifeHost, l: LifeState, id: IssueId) => {
  const i = issueOf(id);
  let w = i.weight;
  if (i.preventBy && (l.prevent[i.preventBy] ?? 0) >= l.day) w *= 0.08;
  if (id === 'heat') w *= forecastOf(s) === 'dry' ? 3 : forecastOf(s) === 'wet' ? 0.1 : 0.5;
  if ((id === 'cocci' || id === 'mastitis' || id === 'mites') && dirty(s, i.group)) w *= 2.2;
  if (id === 'eggEating' && crowded(s)) w *= 2;
  if (id === 'cocci') w *= 1 - (coopOption(l.coop)?.disease ?? 0);
  return w;
};

/** The chance a night brings a new problem to a group, with what raises and lowers it (for the page, too). */
export function issueRisk(s: LifeHost, g: Group): { chance: number; why: string[] } {
  const l = lifeOf(s.life);
  let p: number = LIFE.issueChance[g];
  const why: string[] = [];
  if (dirty(s, g)) (p *= 1.8), why.push(g === 'cows' ? 'the pen is dirty' : 'the coop is dirty');
  if (l.done[g === 'cows' ? 'cowFeed' : 'henFeed'] !== l.day) (p *= 1.3), why.push('not fed today');
  if (g === 'hens' && crowded(s)) (p *= LIFE.crowded), why.push(`${countOf(s, 'hens')} hens in room for ${coopRoom(l.coop)}`);
  if (g === 'hens' && l.coop) (p *= 1 - (coopOption(l.coop)!.disease * 0.5)), why.push('the coop keeps them dry');
  if ((l.prevent.deworm ?? 0) >= l.day) (p *= 0.85), why.push('dewormed');
  if (l.health[g] >= 85) (p *= 0.8), why.push('in good health');
  return { chance: Math.min(0.6, p), why };
}

/** The animals' night: their health from the day's care, the problems left untreated, deaths, and any new problem. */
export function animalNight<S extends LifeHost>(s: S, seed: string): { state: S; events: LifeEvent[] } {
  const l = lifeOf(s.life);
  if (!careOpen(s)) return { state: s, events: [] };
  const events: LifeEvent[] = [];
  let tank = tankOf(s.tank);
  const herd = { ...tank.herd };
  // what the animals' problems waste, and what a dry season makes them drink, comes out of the tank tonight
  const w = animalWater(s);
  const wasted = w.heatDrink + w.extra;
  const thirsty = (tank.days[0]?.short ?? 0) > 0 || tank.level < wasted;
  tank = { ...tank, level: Math.max(0, tank.level - wasted) };
  if (thirsty && herd.cows + herd.hens > 0) events.push({ kind: 'thirst', text: 'The tank ran dry in the night: the animals went thirsty. Buy water in Climate › Water.', tip: 'Keep the tank above what the animals drink in a day.' });
  const health = { ...l.health };
  let issues = [...l.issues];
  let deaths = 0;
  for (const g of ['cows', 'hens'] as Group[]) {
    if (herd[g] <= 0) continue;
    let h = health[g];
    let ok = true;
    const feed = g === 'cows' ? 'cowFeed' : 'henFeed';
    const water = g === 'cows' ? 'cowWater' : 'henWater';
    if (l.done[feed] !== l.day) (h -= LIFE.health.missFeed), (ok = false);
    if (l.done[water] !== l.day) (h -= LIFE.health.missWater), (ok = false);
    if (thirsty) (h -= LIFE.health.thirst), (ok = false);
    if (dirty(s, g)) (h -= LIFE.health.dirty), (ok = false);
    const mine = issues.filter(i => issueOf(i.id).group === g);
    for (const i of mine) {
      const def = issueOf(i.id);
      h -= def.health;
      ok = false;
      // left too long, some problems kill
      if (def.kills && l.day - i.since >= def.kills.after && herd[g] > 0) {
        const lost = Math.min(herd[g], Math.max(1, Math.round(herd[g] * def.kills.share)));
        herd[g] -= lost;
        deaths += lost;
        const value = lost * LIFE.price[g === 'cows' ? 'cow' : 'hen'];
        events.push({ kind: 'death', text: `${def.name} was left untreated: ${lost} ${g === 'cows' ? (lost === 1 ? 'cow' : 'cows') : lost === 1 ? 'hen' : 'hens'} died.`, value, tip: def.prevent });
      }
    }
    if (ok) h += LIFE.health.recover;
    h = Math.max(0, Math.min(100, h));
    if (h < LIFE.health.deathAt && herd[g] > 0) {
      const lost = g === 'cows' ? 1 : Math.max(1, Math.round(herd[g] * 0.1));
      herd[g] -= Math.min(herd[g], lost);
      deaths += lost;
      events.push({ kind: 'death', text: `Weak from missed care, ${lost} ${g === 'cows' ? (lost === 1 ? 'cow' : 'cows') : lost === 1 ? 'hen' : 'hens'} died in the night.`, value: lost * LIFE.price[g === 'cows' ? 'cow' : 'hen'], tip: 'Feed, water and clean every day: health comes back slowly.' });
      h = LIFE.health.afterDeath;
    }
    health[g] = h;
    if (herd[g] <= 0) issues = issues.filter(i => issueOf(i.id).group !== g);
  }
  // a new problem, by its signs, for the morning
  const fresh = { ...s, life: { ...l, health, issues }, tank: { ...tank, herd } } as S;
  for (const g of ['cows', 'hens'] as Group[]) {
    if (herd[g] <= 0) continue;
    const mine = issues.filter(i => issueOf(i.id).group === g);
    if (mine.length >= LIFE.maxIssues) continue;
    if (roll(`${seed}:issue:${g}`) >= issueRisk(fresh, g).chance) continue;
    const pool = ISSUES.filter(i => i.group === g && !mine.some(m => m.id === i.id)).map(i => ({ id: i.id, w: issueWeight(fresh, lifeOf(fresh.life), i.id) }));
    const sum = pool.reduce((n, x) => n + x.w, 0);
    let r = roll(`${seed}:which:${g}`) * sum;
    const pick = pool.find(x => (r -= x.w) < 0) ?? pool[pool.length - 1];
    if (!pick) continue;
    issues.push({ id: pick.id, since: l.day + 1 });
    events.push({ kind: 'issue', text: `In the morning, the ${g}: ${issueOf(pick.id).signs}`, tip: 'Open Animals › Health to choose what to do.' });
  }
  const life: LifeState = {
    ...l,
    health,
    issues,
    today: { milk: 0, eggs: 0, earned: 0, spent: 0 },
    totals: { ...l.totals, deaths: l.totals.deaths + deaths },
    log: [...events.filter(e => e.kind === 'death' || e.kind === 'issue').map(e => ({ day: l.day, text: e.text })), ...l.log].slice(0, 20),
  };
  return { state: { ...s, life, tank: { ...tank, herd } }, events };
}

/** Jobs waiting and problems showing: the number on the ANIMALS button. */
export const animalsBadge = (s: LifeHost) => (careOpen(s) ? careLeft(s).length + lifeOf(s.life).issues.length : 0);
