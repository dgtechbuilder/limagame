/* Water as a real resource: the tank, where its water comes from and goes, the shared catchment, water credits and
   crop cover. No screens here (the panel is WaterPanel.tsx). Every number is in ./config.ts. */

import { FORECASTS, CHECK_DAYS, harvestFarm, isResting, type Forecast, type Trial } from '../trials/model';
import { FACTORS } from '../climate/model';
import { emptyField, setupLeft, type Field } from '../world/field';
import { rowEffect, strategiesOf, chosen } from '../strategy/model';
import { WATER, coverPlanOf, type DrawPolicy, type Herd, type WaterBuyId } from './config';
import { coverOff, waterCut, type CsaState } from '../csa/model';

export interface WaterDay {
  label: string;
  date: string;
  /** litres in: rain off the roofs; out: the house, the animals, the farms' work by hand */
  rain: number;
  house: number;
  animals: number;
  farms: number;
  /** litres wanted but not there: the tank ran dry */
  short: number;
  level: number;
  /** water credits earned (litres under the baseline) */
  credits: number;
  /** the shared catchment: the dam's level after the day, the farm's irrigation wanted and got */
  dam: number;
  irrigationWant: number;
  irrigationGot: number;
  rationed: boolean;
}

export interface TankState {
  level: number;
  /** the calendar day last counted (YYYY-MM-DD); null until the farm opens */
  day: string | null;
  herd: Herd;
  /** how the farm draws on the shared catchment when it runs low */
  policy: DrawPolicy;
  /** litres in the shared dam */
  dam: number;
  /** newest first, the last 14 days */
  days: WaterDay[];
  /** litres bought, all time */
  bought: Partial<Record<WaterBuyId, number>> & { piped: number; transported: number };
  /** crop cover bought for a cycle, and its premium */
  cover: { cycle: number; premium: number; plan?: string } | null;
  /** crop cover paid out, all time (stored money) */
  paidOut: number;
  /** the irrigation each farm got this cycle, as a share of what its plan wanted: { cycle, want, got } */
  irrigation: { cycle: number; want: number; got: number };
}

export const newTank = (): TankState => ({
  level: WATER.tank.start,
  day: null,
  herd: { cows: WATER.herd.cows, hens: WATER.herd.hens },
  policy: 'full',
  dam: WATER.catchment.start,
  days: [],
  bought: { piped: 0, transported: 0 },
  cover: null,
  paidOut: 0,
  irrigation: { cycle: 0, want: 0, got: 0 },
});
export const tankOf = (t: Partial<TankState> | undefined): TankState => ({ ...newTank(), ...(t ?? {}) });

/** What a water host needs from the game state. */
export interface WaterHost {
  tank?: Partial<TankState>;
  inventory: string[];
  trial: Trial | null;
  field: Field;
  /** Climate Smart Agriculture skills (src/csa): saving water cuts the rows' use; soil-water practices cut crop cover */
  csa?: Partial<CsaState>;
}

/** The tank's size: the farm's own, and every tank bought in the Shop. */
export const capacityOf = (s: Pick<WaterHost, 'inventory'>) => WATER.tank.base + s.inventory.reduce((n, id) => n + (WATER.tank.adds[id] ?? 0), 0);
export const forecastOf = (s: Pick<WaterHost, 'trial'>): Forecast => s.trial?.forecast ?? 'normal';
export const isLow = (s: WaterHost) => tankOf(s.tank).level < capacityOf(s) * WATER.tank.low;

/** Litres a day of rain off the roofs, in this season. */
export const rainIn = (f: Forecast) => Math.round((FORECASTS[f].rain / 7) * WATER.rain.roofM2 * WATER.rain.catchEff);
/** Litres a day the animals drink. */
export const animalsUse = (h: Herd) => Math.round(h.cows * WATER.animals.cow.litres + h.hens * WATER.animals.hen.litres);

/** Litres a day the farms' rows use from the tank: their watering habits and mulches, over the cycle, on sown farms;
    less with the farmer's skill in saving water and the right time of day (src/csa). */
export function farmsUse(s: Pick<WaterHost, 'trial' | 'field' | 'csa'>): number {
  const t = s.trial;
  if (!t || t.phase !== 'growing') return 0;
  const f = s.field.cycle === t.cycle ? s.field : emptyField(t.cycle);
  let litres = 0;
  t.plans.forEach((_, farm) => {
    // a resting farm (src/soil) is not watered
    if (isResting(t, farm) || setupLeft(f, t, farm)) return;
    // a can of water a row a day by hand, and what the row's habits add or save over the cycle
    for (const st of strategiesOf(t, farm)) litres += Math.max(0, WATER.rowCan + rowEffect(st, t.forecast).water / CHECK_DAYS);
  });
  return Math.round(litres * (1 - waterCut(s.csa)));
}

/** The farm's use today, by what uses it. */
export function useToday(s: WaterHost) {
  const tank = tankOf(s.tank);
  const house = WATER.house;
  const animals = animalsUse(tank.herd);
  const farms = farmsUse(s);
  return { house, animals, farms, total: house + animals + farms };
}

/** Litres a day the six farms' plans want from the catchment: the plan's watering on top of the rain. */
export function irrigationWant(s: Pick<WaterHost, 'trial' | 'field'>): number {
  const t = s.trial;
  if (!t || t.phase !== 'growing') return 0;
  return Math.round(t.plans.reduce((n, p, i) => n + (isResting(t, i) ? 0 : (p.water * FACTORS.farmM2.value) / 7), 0));
}

/** The shared catchment over one day: rain in, every household's draw out, rationed when it runs low. */
export function damDay(dam0: number, f: Forecast, want: number, policy: DrawPolicy) {
  const c = WATER.catchment;
  const inflow = (FORECASTS[f].rain / 7) * c.areaM2 * c.runoff;
  const neighbours = c.neighbours.map(n => ({ name: n.name, want: n.litres[f] }));
  const available = Math.min(c.capacity, dam0 + inflow);
  const others = neighbours.reduce((n, x) => n + x.want, 0);
  const demand = others + want;
  const rationed = available < c.capacity * c.rationAt || demand > available;
  // rationed: every household gets the same share of what is wanted; a fair farm takes no more than one household's part
  const share = rationed ? Math.max(0, Math.min(1, (available - c.capacity * 0.05) / Math.max(1, demand))) : 1;
  let got = want * share;
  if (rationed && policy === 'fair') got = Math.min(got, Math.max(0, available - c.capacity * 0.05) / (neighbours.length + 1));
  const used = got + others * share;
  return { dam: Math.max(0, Math.round(available - used)), inflow: Math.round(inflow), got: Math.round(got), rationed, neighbours: neighbours.map(n => ({ ...n, got: Math.round(n.want * share) })) };
}

/** One day of water on the farm: the tank, the credits, the catchment. */
export function waterDay(s: WaterHost, tank: TankState, label: string, date: string): { tank: TankState; day: WaterDay } {
  const f = forecastOf(s);
  const cap = capacityOf(s);
  const rain = rainIn(f);
  const use = useToday({ ...s, tank });
  const before = Math.min(cap, tank.level + rain);
  const short = Math.max(0, use.total - before);
  const level = Math.max(0, before - use.total);
  const used = use.total - short;
  const want = irrigationWant(s);
  const d = damDay(tank.dam, f, want, tank.policy);
  let credits = Math.max(0, WATER.credits.baseline - used) / WATER.credits.litresPerCredit;
  if (d.rationed && tank.policy === 'fair' && want > 0) credits += WATER.catchment.fairBonus;
  credits = Math.round(credits * 10) / 10;
  const cycle = s.trial?.cycle ?? 0;
  const irr = tank.irrigation.cycle === cycle ? tank.irrigation : { cycle, want: 0, got: 0 };
  const day: WaterDay = { label, date, rain, house: use.house, animals: use.animals, farms: use.farms, short, level, credits, dam: d.dam, irrigationWant: want, irrigationGot: d.got, rationed: d.rationed };
  return {
    tank: { ...tank, level, dam: d.dam, days: [day, ...tank.days].slice(0, 14), irrigation: want ? { cycle, want: irr.want + want, got: irr.got + d.got } : irr },
    day,
  };
}

/** The share of its planned irrigation the farms got from the catchment this cycle (1: all of it). */
export function deliveredShare(tank: TankState, cycle: number): number {
  const i = tank.irrigation;
  return i.cycle === cycle && i.want > 0 ? Math.max(0, Math.min(1, i.got / i.want)) : 1;
}

/* ---------------- crop cover, priced on the farm's water practices ---------------- */

export function coverQuote(s: WaterHost, plan?: string) {
  const c = WATER.cover;
  const t = s.trial;
  const farms = t?.plans.length ?? 6;
  const f = forecastOf(s);
  const tank = tankOf(s.tank);
  const lines: { label: string; off: number }[] = [];
  if (tank.level >= capacityOf(s) * c.tankFull.share) lines.push({ label: 'The tank is at least half full', off: c.tankFull.off });
  // the share of rows running a water practice: mulch, zai pits, tied ridges, morning watering, drought-tolerant seed
  const WATER_WISE = new Set(['residue', 'zai', 'ridges', 'morning', 'dt', 'minimum']);
  if (t) {
    const rows = t.plans.flatMap((_, i) => strategiesOf(t, i));
    const wise = rows.filter(st => chosen(st).some(x => WATER_WISE.has(x.option.id))).length;
    if (wise) lines.push({ label: `${wise} of ${rows.length} rows keep water in the soil`, off: (c.smartRows.off * wise) / rows.length });
  }
  if (tank.policy === 'fair') lines.push({ label: 'Draws its fair share of the dam', off: c.fairShare.off });
  // Climate Smart Agriculture: skills that keep water in the soil (half-moons, zaï pits, drought-tolerant seed)
  const smart = coverOff(s.csa);
  if (smart.off) lines.push({ label: `Climate-smart skills: ${smart.names.join(', ')}`, off: smart.off });
  const off = Math.min(c.maxOff, lines.reduce((n, x) => n + x.off, 0));
  const base = Math.round(c.premiumPerFarm * farms * (c.forecast[f] ?? 1) * coverPlanOf(plan).price);
  return { base, off, premium: Math.round(base * (1 - off)), lines, forecast: f };
}

export const hasCover = (s: WaterHost) => {
  const c = tankOf(s.tank).cover;
  return !!c && !!s.trial && c.cycle === s.trial.cycle;
};

/** What crop cover pays at harvest: a share of what drought, flood and hail took off every farm. */
export function coverPayout(t: Trial, plan?: string): number {
  const cp = coverPlanOf(plan);
  if (!t.results) return 0;
  let lost = 0;
  t.results.forEach((r, farm) => {
    const gross = r.lost < 1 ? r.income / Math.max(0.05, 1 - r.lost) : r.income;
    for (const p of r.problems) if (cp.hazards.includes(p.hazard)) lost += p.loss * gross;
    void farm;
  });
  return Math.round(lost * cp.payout);
}

/** A farm's harvest value before problems (for the cover's sums). */
export const farmGross = (t: Trial, farm: number) => harvestFarm(t, farm, 0).income;
