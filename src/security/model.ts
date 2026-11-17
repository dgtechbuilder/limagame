/* Theft across the game: what is exposed tonight, how much each measure cuts its chance, a night's thefts (and the
   hens' predators), what is found again, and the share of the six farms' harvest and of the classic season's store
   that thieves took. No screens here (the page is Security.tsx); every number is in ./config.ts. */

import { SHOP_TABS } from '../data';
import type { Biz } from '../business/model';
import { CHECK_DAYS, type Trial } from '../trials/model';
import { tankOf, type TankState } from '../water/model';
import { LIFE } from '../livestock/config';
import { coopOption } from '../livestock/config';
import { lifeOf, type LifeEvent, type LifeState } from '../livestock/model';
import { roll, rollInt } from '../livestock/rand';
import { LATE_HARVEST, MAX_CUT, MEASURES, STORE_THEFT, TAKES, TARGETS, measureOf, type MeasureId, type Target } from './config';

export interface NightReport {
  /** the farm day the night ended */
  day: number;
  date: string;
  events: LifeEvent[];
  /** paid for the night's watch (a watchman, the dog's food) */
  paid: number;
}

export interface SecurityState {
  /** measures bought (kept for good) */
  owned: MeasureId[];
  /** nightly measures switched on (the watchman) */
  hired: MeasureId[];
  /** the share of each farm's harvest taken this cycle, from the field */
  crops: { cycle: number; share: number[] };
  /** money from a sale kept at home tonight */
  cash: number;
  /** newest first, the last 14 nights */
  reports: NightReport[];
  totals: { nights: number; thefts: number; lost: number; recovered: number; paid: number; spent: number };
}

export const newSecurity = (): SecurityState => ({ owned: [], hired: [], crops: { cycle: 0, share: [] }, cash: 0, reports: [], totals: { nights: 0, thefts: 0, lost: 0, recovered: 0, paid: 0, spent: 0 } });
export const securityOf = (x: Partial<SecurityState> | undefined): SecurityState => {
  const base = newSecurity();
  return { ...base, ...(x ?? {}), totals: { ...base.totals, ...(x?.totals ?? {}) }, crops: x?.crops ?? base.crops };
};

/** What theft needs from the game state. */
export interface SecurityHost {
  security?: Partial<SecurityState>;
  life?: Partial<LifeState>;
  tank?: Partial<TankState>;
  trial: Trial | null;
  biz?: Biz;
  inventory: string[];
  coins: number;
  /** the classic season (Farm Moja): its harvest, where it is stored */
  stage: number;
  harvested: { bags: number; quality: number } | null;
  storage: string;
}

/** Equipment from the Shop, which is kept in the shed. */
const EQUIPMENT = SHOP_TABS.find(t => t.id === 'equipment')!.items;
export const toolsIn = (s: Pick<SecurityHost, 'inventory'>) => s.inventory.filter(id => EQUIPMENT.some(e => e.id === id));
const toolOf = (id: string) => EQUIPMENT.find(e => e.id === id)!;

/** The measures working tonight (a nightly one only when switched on). */
export function activeMeasures(s: SecurityHost): MeasureId[] {
  const sec = securityOf(s.security);
  return MEASURES.filter(m => (m.kind === 'once' ? sec.owned.includes(m.id) : sec.hired.includes(m.id))).map(m => m.id);
}
export const hasMeasure = (s: SecurityHost, id: MeasureId) => activeMeasures(s).includes(id);

/** The share of a target's chance the measures in place cut off (they multiply), capped. */
export function cutFor(target: Target, ids: MeasureId[]): number {
  const keep = ids.reduce((k, id) => k * (1 - (measureOf(id).cut[target] ?? 0)), 1);
  return Math.min(MAX_CUT, 1 - keep);
}
/** The chance a stolen thing is found again. */
export function recoverFor(target: Target, ids: MeasureId[]): number {
  return 1 - ids.reduce((k, id) => k * (1 - (measureOf(id).recover?.[target] ?? 0)), 1);
}
/** What the measures in place cost each night. */
export const nightlyCost = (s: SecurityHost) => activeMeasures(s).reduce((n, id) => n + (measureOf(id).nightly ?? 0), 0);

/** Theft is part of the farm from the day the animals are (day 2). */
export const theftOpen = (s: Pick<SecurityHost, 'life'>) => lifeOf(s.life).day >= LIFE.startDay;

export interface Exposure {
  target: Target;
  label: string;
  /** what is out there tonight, in a few words; null when there is nothing to take */
  at: string | null;
  /** tonight's chance before the measures, and after */
  base: number;
  cut: number;
  chance: number;
  /** what raises or lowers it, besides the measures */
  why: string[];
}

/** The day of the six farms' cycle (1 to 6, 7 when ripe and waiting for the harvest), as a night starts. */
export type CycleDay = number;

/** Every target, and its chance tonight. */
export function exposure(s: SecurityHost, cycleDay: CycleDay): Exposure[] {
  const ids = activeMeasures(s);
  const life = lifeOf(s.life);
  const tank = tankOf(s.tank);
  const herd = tank.herd;
  const coop = coopOption(life.coop);
  const shut = !!coop && life.done.closeCoop === life.day;
  const rows: Exposure[] = [];
  const row = (target: Target, at: string | null, mult: number, why: string[], extraCut = 0) => {
    const base = Math.min(0.9, TARGETS[target].base * mult);
    const cut = 1 - (1 - cutFor(target, ids)) * (1 - extraCut);
    rows.push({ target, label: TARGETS[target].label, at, base: at ? base : 0, cut, chance: at ? base * (1 - cut) : 0, why });
  };
  const t = s.trial;
  const ripe = !!t && t.phase === 'growing' && cycleDay >= 5;
  row('crops', ripe ? `${t!.plans.length} farm${t!.plans.length === 1 ? '' : 's'} of ripening maize` : null, cycleDay > CHECK_DAYS ? LATE_HARVEST : 1, cycleDay > CHECK_DAYS ? ['ripe and not yet harvested'] : []);
  const henWhy = coop ? (shut ? [`in the ${coop.name.toLowerCase()}, door shut`] : ['the coop door is open']) : ['no coop: they roost in the trees'];
  row('hens', herd.hens > 0 ? `${herd.hens} hens` : null, coop ? 1 : 1.8, henWhy, shut ? coop!.theft : 0);
  row('predators', herd.hens > 0 ? `${herd.hens} hens` : null, coop ? 1 : 1.5, henWhy, shut ? coop!.predators : 0);
  row('cows', herd.cows > 0 ? `${herd.cows} cow${herd.cows === 1 ? '' : 's'}` : null, 1, []);
  const tools = toolsIn(s);
  row('tools', tools.length ? `${tools.length} tool${tools.length === 1 ? '' : 's'} in the shed` : null, 1, []);
  const stored = s.stage === 6 && !!s.harvested;
  row('store', stored ? `${s.harvested!.bags} bags in ${s.storage === 'home' ? 'home storage' : s.storage === 'coop' ? 'the co-op warehouse' : 'cold storage'}` : null, stored ? (STORE_THEFT[s.storage] ?? 0.06) / STORE_THEFT.home : 1, stored && s.storage !== 'home' ? ['a guarded warehouse'] : []);
  const sec = securityOf(s.security);
  row('cash', sec.cash > 0 ? 'money from today’s sale' : null, 1, []);
  const dry = t?.forecast === 'dry';
  row('water', tank.level > 1500 ? `${Math.round(tank.level).toLocaleString('en-US')} L in the tank` : null, dry ? 2.5 : 1, dry ? ['a dry season: water is short for everyone'] : []);
  row('diesel', s.biz ? 'the business tractor’s tank' : null, 1, []);
  return rows;
}

/** The strongest measure not yet in place against a target: the tip after a theft. */
export function bestAgainst(s: SecurityHost, target: Target): string | undefined {
  const ids = activeMeasures(s);
  const best = MEASURES.filter(m => !ids.includes(m.id) && (m.cut[target] ?? 0) > 0 && (!m.needs || s.biz)).sort((a, b) => (b.cut[target] ?? 0) - (a.cut[target] ?? 0))[0];
  if (target === 'hens' || target === 'predators') {
    const l = lifeOf(s.life);
    if (!l.coop) return 'Build a coop and shut its door every night (Animals › Coop).';
    if (l.done.closeCoop !== l.day) return 'Shut the coop door every night (Animals › Today).';
  }
  if (target === 'crops') return `Harvest on time${best ? `, and a ${best.name.toLowerCase()} cuts the risk by ${Math.round((best.cut.crops ?? 0) * 100)}%` : ''}.`;
  if (target === 'store') return 'Store the harvest in the co-op warehouse, and lock the store.';
  return best ? `${best.name} cuts this risk by ${Math.round((best.cut[target] ?? 0) * 100)}%.` : undefined;
}

/** The share of the classic season's stored maize thieves take, where it is kept and with the measures in place. */
export const storeTheftShare = (s: SecurityHost) => (theftOpen(s) ? (STORE_THEFT[s.storage] ?? STORE_THEFT.home) * (1 - cutFor('store', activeMeasures(s))) : 0);

/** The share of each farm's harvest taken from the field this cycle. */
export const cropsTaken = (s: SecurityHost, cycle: number): number[] => {
  const c = securityOf(s.security).crops;
  return c.cycle === cycle ? c.share : [];
};

/** One night's thefts (and predators). Pays the night's watch first. */
export function theftNight<S extends SecurityHost>(s: S, seed: string, cycleDay: CycleDay, date: string): { state: S; events: LifeEvent[]; paid: number } {
  if (!theftOpen(s)) return { state: s, events: [], paid: 0 };
  let sec = securityOf(s.security);
  const events: LifeEvent[] = [];
  let coins = s.coins;
  // the night's watch is paid first: a watchman who cannot be paid does not come
  let paid = 0;
  for (const id of [...sec.owned, ...sec.hired]) {
    const m = measureOf(id);
    if (!m.nightly) continue;
    if (m.kind === 'nightly' && !sec.hired.includes(id)) continue;
    if (coins >= m.nightly) {
      coins -= m.nightly;
      paid += m.nightly;
    } else if (m.kind === 'nightly') {
      sec = { ...sec, hired: sec.hired.filter(x => x !== id) };
      events.push({ kind: 'cost', text: `There was no money to pay the ${m.name.toLowerCase()}: he did not come.` });
    }
  }
  let next = { ...s, coins, security: sec } as S;
  const ids = activeMeasures(next);
  let tank = tankOf(next.tank);
  const herd = { ...tank.herd };
  let inventory = next.inventory;
  let crops = sec.crops.cycle === (next.trial?.cycle ?? -1) ? [...sec.crops.share] : [];
  let lost = 0;
  let recovered = 0;
  let thefts = 0;
  for (const x of exposure(next, cycleDay)) {
    if (!x.at || x.chance <= 0 || x.target === 'store') continue;
    if (roll(`${seed}:theft:${x.target}`) >= x.chance) continue;
    const tip = bestAgainst(next, x.target);
    const back = x.target !== 'predators' && x.target !== 'cash' && x.target !== 'water' && roll(`${seed}:back:${x.target}`) < recoverFor(x.target, ids);
    const take = (n: readonly [number, number]) => rollInt(`${seed}:take:${x.target}`, n[0], n[1]);
    let text = '';
    let value = 0;
    switch (x.target) {
      case 'crops': {
        const t = next.trial!;
        const farm = rollInt(`${seed}:farm`, 0, t.plans.length - 1);
        const pct = take(TAKES.crops);
        if (!back) {
          while (crops.length < t.plans.length) crops.push(0);
          crops[farm] = Math.min(0.5, crops[farm] + pct / 100);
        }
        text = `Thieves cut ${pct}% of the cobs on Farm ${farm + 1} in the night.`;
        value = 0;
        break;
      }
      case 'hens':
      case 'predators': {
        const n = Math.min(herd.hens, take(x.target === 'hens' ? TAKES.hens : TAKES.predators));
        if (!back) herd.hens -= n;
        value = n * LIFE.price.hen;
        text = x.target === 'hens' ? `${n} hen${n === 1 ? ' was' : 's were'} stolen in the night.` : `A mongoose got into the hens: ${n} lost.`;
        break;
      }
      case 'cows': {
        if (!back) herd.cows -= 1;
        value = LIFE.price.cow;
        text = 'A cow was led away from the pen in the night.';
        break;
      }
      case 'tools': {
        const have = toolsIn(next);
        const id = have[rollInt(`${seed}:tool`, 0, have.length - 1)];
        if (!back) {
          const i = inventory.indexOf(id);
          inventory = inventory.filter((_, k) => k !== i);
        }
        value = toolOf(id).price;
        text = `Someone broke into the shed: the ${toolOf(id).name.toLowerCase()} is gone.`;
        break;
      }
      case 'cash': {
        const pct = take(TAKES.cash);
        value = Math.round((sec.cash * pct) / 100);
        coins = next.coins - value;
        next = { ...next, coins };
        text = `Thieves broke into the house and took ${value} of the sale’s cash.`;
        break;
      }
      case 'water': {
        const litres = Math.min(Math.round(tank.level), take(TAKES.water));
        tank = { ...tank, level: tank.level - litres };
        text = `${litres.toLocaleString('en-US')} L were drawn off the tank in the night.`;
        value = 0;
        break;
      }
      case 'diesel': {
        value = take(TAKES.diesel);
        if (!back) next = { ...next, coins: Math.max(0, next.coins - value) };
        text = 'Diesel was siphoned from the business tractor.';
        break;
      }
    }
    thefts += 1;
    if (back) {
      recovered += value;
      events.push({ kind: 'recovered', text: `${text} ${x.target === 'cows' ? 'Her brand and ear tag were known at the market: she is back.' : 'The community watch found it: it is back.'}` });
    } else {
      lost += value;
      events.push({ kind: x.target === 'predators' ? 'predator' : 'theft', text, value: value || undefined, tip });
    }
  }
  const t = next.trial;
  sec = securityOf(next.security);
  sec = {
    ...sec,
    cash: 0,
    crops: t ? { cycle: t.cycle, share: crops } : sec.crops,
    totals: { ...sec.totals, nights: sec.totals.nights + 1, thefts: sec.totals.thefts + thefts, lost: sec.totals.lost + lost, recovered: sec.totals.recovered + recovered, paid: sec.totals.paid + paid },
  };
  void date;
  return { state: { ...next, inventory, security: sec, tank: { ...tank, herd } }, events, paid };
}

/** At the six farms' harvest: each farm's bags, income and profit, less what thieves took from the field. */
export function harvestLessTheft<R extends { bags: number; income: number; profit: number }>(results: R[], share: number[]): { results: (R & { stolen?: number })[]; bags: number; value: number } {
  let bags = 0;
  let value = 0;
  const out = results.map((r, i) => {
    const k = share[i] ?? 0;
    if (!k) return r;
    const b = Math.round(r.bags * k);
    const v = Math.round(r.income * k);
    bags += b;
    value += v;
    return { ...r, bags: r.bags - b, income: r.income - v, profit: r.profit - v, stolen: k };
  });
  return { results: out, bags, value };
}
