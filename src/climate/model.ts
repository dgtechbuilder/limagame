/* Climate tracking: what every farming choice in Lima does to the climate, the water and the land.

   The game records a climate entry whenever work is actually done: a season task on Farm Moja, the inputs of a
   six-farm plan when it is planted, field work by hand or from the tractor seat, a tractor drive, a treatment, a
   wrong fix, and the trip to market. Each entry adds to the season's and the lifetime totals:

   - Emissions (kg CO₂e), by source: fuel, fertilizer, manure, chemicals, water pumping, seed, storage, transport
   - Carbon stored (kg CO₂): soil carbon from mulch and manure, nitrogen fixed by beans
   - Water used (litres) on top of the rain
   - Pollution (points): chemicals sprayed, fertilizer and runoff washed into water, exhaust
   - Soil health (points): up with mulch, manure and beans, down with bare soil, compaction and too much chemistry
   - Diesel (litres), synthetic nitrogen (kg), sprays, food lost (kg) and food grown (kg), for the efficiency figures
   - Climate shocks (drought, flood, hail) met and handled: adapting, not only cutting
   - Climate credits: 1 credit for every 10 kg of CO₂ stored or kept out of the air (a real carbon credit is 1,000 kg)

   Every number is in the tables below, so an agronomist can review them without touching code. Like the six farms'
   numbers, they are illustrative estimates until that review, except where a source is named. No pictures here. */

import type { Forecast, Plan, TrialHazard } from '../trials/model';
import { FORECASTS, WATER_TOO_MUCH } from '../trials/model';

/* ---------------- what is tracked ---------------- */

export type Source = 'fuel' | 'fertilizer' | 'manure' | 'chemicals' | 'water' | 'seed' | 'storage' | 'transport';

export const SOURCES: { id: Source; label: string; fix: string }[] = [
  { id: 'fertilizer', label: 'Fertilizer', fix: 'Use manure or beans for part of the nitrogen, and never a double dose.' },
  { id: 'fuel', label: 'Diesel', fix: 'Plough with oxen or mulch instead, choose the compact tractor and drive clean rows.' },
  { id: 'chemicals', label: 'Chemicals', fix: 'Check and treat instead of spraying every week.' },
  { id: 'water', label: 'Water pumping', fix: 'Water only what the rain does not give, mulch to keep it in, or pump with solar.' },
  { id: 'storage', label: 'Storage & milling', fix: 'Dry grain in the sun; cold storage and milling use power (solar cuts it).' },
  { id: 'transport', label: 'Transport', fix: 'Sell more bags in one trip, through the cooperative.' },
  { id: 'seed', label: 'Seed', fix: 'Certified seed costs a little carbon but grows more food per kg.' },
  { id: 'manure', label: 'Manure', fix: 'Manure gives off a little gas, but stores much more carbon in the soil.' },
];

export interface Footprint {
  /** kg CO₂e emitted */
  co2: number;
  /** kg CO₂ stored in the soil or kept out of the air by biology (beans fixing nitrogen) */
  stored: number;
  /** litres of water used on top of the rain */
  water: number;
  /** pollution points: chemicals, runoff, exhaust */
  pollution: number;
  /** soil health points, up or down */
  soil: number;
  /** litres of diesel burned */
  diesel: number;
  /** kg of synthetic nitrogen applied */
  fertN: number;
  /** chemical spray applications */
  sprays: number;
  /** kg of food grown and lost */
  yieldKg: number;
  foodLoss: number;
}

export const ZERO: Footprint = { co2: 0, stored: 0, water: 0, pollution: 0, soil: 0, diesel: 0, fertN: 0, sprays: 0, yieldKg: 0, foodLoss: 0 };

/** One recorded change: emissions by source, and the rest of the footprint. */
export type Delta = Partial<Omit<Footprint, 'co2'>> & { emit?: Partial<Record<Source, number>>; credits?: number };

export type Where = 'season' | 'farms' | 'field' | 'tractor' | 'market' | 'checks';

export interface ClimateEntry {
  id: number;
  label: string;
  where: Where;
  co2: number;
  d: Delta;
  credits: number;
}

export interface CycleRecord {
  label: string;
  f: Footprint;
  credits: number;
}

export interface ClimateState {
  total: Footprint;
  /** since the last harvest was sold */
  season: Footprint;
  /** lifetime kg CO₂e, by source */
  co2By: Record<Source, number>;
  credits: number;
  /** credits earned since the last harvest was sold */
  seasonCredits: number;
  /** drought, flood and hail met on a farm, read right (handled) or not */
  shocks: { met: number; handled: number };
  /** tractor drives: how many, and the sum of their climate scores (0 to 100) */
  drives: { n: number; clim: number };
  /** the latest entries, newest first */
  log: ClimateEntry[];
  /** finished seasons and cycles, oldest first */
  cycles: CycleRecord[];
  /** the climate level reached (index into LEVELS) */
  level: number;
}

const noSources = (): Record<Source, number> => ({ fuel: 0, fertilizer: 0, manure: 0, chemicals: 0, water: 0, seed: 0, storage: 0, transport: 0 });

export const initialClimate: ClimateState = {
  total: ZERO,
  season: ZERO,
  co2By: noSources(),
  credits: 0,
  seasonCredits: 0,
  shocks: { met: 0, handled: 0 },
  drives: { n: 0, clim: 0 },
  log: [],
  cycles: [],
  level: 0,
};

/* ---------------- the numbers ---------------- */

export interface Factor {
  value: number;
  unit: string;
  what: string;
  source?: { name: string; url: string };
  estimate?: true;
}

const IPCC = { name: 'IPCC 2006 Guidelines, Vol. 4 ch. 11: 1% of applied nitrogen lost as N₂O', url: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol4.html' };

export const FACTORS = {
  diesel: { value: 2.68, unit: 'kg CO₂ a litre', what: 'Burning diesel (the same figure as the tractor drive)', estimate: true },
  nitrogen: { value: 10, unit: 'kg CO₂e a kg of N', what: 'Making synthetic nitrogen (about 5) plus the N₂O it gives off in the field (about 4.7)', source: IPCC },
  pumping: { value: 0.25, unit: 'kg CO₂e per 1,000 L', what: 'Pumping water with a small petrol pump', estimate: true },
  solarPumping: { value: 0.02, unit: 'kg CO₂e per 1,000 L', what: 'Pumping with solar power', estimate: true },
  spray: { value: 2, unit: 'kg CO₂e a spray', what: 'Making and carrying one pesticide spray for a farm', estimate: true },
  transport: { value: 0.8, unit: 'kg CO₂e a bag', what: 'Taking a 90 kg bag to market by lorry or motorbike', estimate: true },
  bag: { value: 90, unit: 'kg a bag', what: 'A bag of maize' },
  farmM2: { value: 675, unit: 'm²', what: 'One of the six farms (a sixth of an acre)' },
  weeks: { value: 3, unit: 'weeks', what: 'A cycle of the six farms (21 days)' },
  credit: { value: 10, unit: 'kg CO₂e', what: 'One Lima climate credit (a real carbon credit is 1,000 kg)' },
} satisfies Record<string, Factor>;

const N = FACTORS.nitrogen.value;
const FARM_ACRES = 1 / 6;
/** litres of diesel an acre for each job a tractor can do (the tractor drive's implements: plough + harrow, planter, harvester) */
export const TRACTOR_LPA: Record<string, number> = { prep: 13, sow: 4, setupFeed: 4, weeding: 3, topdress: 2, borer: 3, spray: 3, harvest: 10 };
/** how much diesel each tractor type burns next to the standard one: its fuel cost a plot (4, 6, 9, 14) over the standard's 9 */
export const TRACTOR_FUEL: Record<string, number> = { twoWheel: 4 / 9, compact: 6 / 9, standard: 1, large: 14 / 9 };

/* ---------------- the six farms: a plan's inputs, at planting ---------------- */

const LAND: Record<Plan['land'], Delta> = {
  slash: { soil: -2 },
  hoe: {},
  ox: { soil: 0.5 },
  // the diesel is counted when the ground is actually worked (see tractorWork and contractorDiesel)
  tractor: { soil: -1 },
  mulch: { stored: 25, soil: 4 },
};
const SEED: Record<Plan['seed'], Delta> = {
  saved: {},
  certified: { emit: { seed: 2 } },
  // drought-tolerant hybrid: bought seed like any hybrid, grows a shorter season so it needs less water
  dt: { emit: { seed: 2 } },
  // open-pollinated: bought once, then re-sown for 2 to 3 seasons, so less new seed is made and carried
  opv: { emit: { seed: 1.2 } },
  intercrop: { emit: { seed: 2.5 }, stored: 15, soil: 2 },
  dense: { emit: { seed: 3 } },
};
const FERT: Record<Plan['fert'], Delta> = {
  none: { soil: -1 },
  manure: { emit: { manure: 3 }, stored: 20, soil: 3 },
  basal: { emit: { fertilizer: 1.5 * N }, fertN: 1.5, pollution: 2 },
  basalTop: { emit: { fertilizer: 3.5 * N }, fertN: 3.5, pollution: 4 },
  double: { emit: { fertilizer: 7 * N }, fertN: 7, pollution: 12, soil: -2 },
};
const PEST: Record<Plan['pest'], Delta> = {
  none: {},
  // checking first keeps chemicals off a healthy crop
  scout: { credits: 0.5 },
  spray: { emit: { chemicals: 3 * FACTORS.spray.value }, sprays: 3, pollution: 18, soil: -1 },
};

/** Litres a plan's watering uses on one farm over a cycle. */
export const planLitres = (p: Plan) => p.water * FACTORS.farmM2.value * FACTORS.weeks.value;

export const pumpCo2 = (litres: number, solar: boolean) => (litres / 1000) * (solar ? FACTORS.solarPumping.value : FACTORS.pumping.value);

function sum(...ds: Delta[]): Delta {
  const out: Delta = {};
  for (const d of ds) {
    for (const [k, v] of Object.entries(d)) {
      if (k === 'emit') {
        out.emit = { ...(out.emit ?? {}) };
        for (const [s, n] of Object.entries(v as Record<Source, number>)) out.emit[s as Source] = (out.emit[s as Source] ?? 0) + n;
      } else (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + (v as number);
    }
  }
  return out;
}

/** What one farm's plan puts in at planting: seed, fertilizer or manure, the pest programme, the watering, the land.
    (Tractor diesel is counted when the ground is worked.) */
export function planDelta(p: Plan, f: Forecast, solar: boolean): Delta {
  const litres = planLitres(p);
  const total = p.water + FORECASTS[f].rain;
  const water: Delta = { water: litres, emit: { water: pumpCo2(litres, solar) }, ...(total > WATER_TOO_MUCH ? { pollution: 6, soil: -1 } : {}) };
  return sum(LAND[p.land], SEED[p.seed], FERT[p.fert], PEST[p.pest], water);
}

/** Diesel for a tractor job on one farm, for the share of its tiles done from the seat. */
export function tractorWork(job: string, share: number, type = 'standard'): Delta {
  const l = FARM_ACRES * (TRACTOR_LPA[job] ?? 0) * share * (TRACTOR_FUEL[type] ?? 1);
  return l > 0 ? { diesel: l, emit: { fuel: l * FACTORS.diesel.value }, pollution: l * 0.5 } : {};
}

/** A tractor-hire farm the player never ploughed themselves: a contractor ploughed and harrowed it. */
export const contractorDiesel = (): Delta => tractorWork('prep', 1);

/* ---------------- a plot's own care (staggered cycles) ---------------- */

/** One plot's care done: weeding by hand keeps herbicide off, a stalk-borer spray is a quarter of a farm's spray. The
    top-dress's CAN is already counted with the plan's fertilizer at planting. */
export function careDelta(job: string): Delta {
  if (job === 'weeding') return { soil: 0.1 };
  if (job === 'borer') return { emit: { chemicals: FACTORS.spray.value / 4 }, sprays: 0.25, pollution: 1.5 };
  return {};
}

/* ---------------- treatments, follow-ups and wrong fixes ---------------- */

/** One treatment done on a farm, by the job it takes. */
export function treatDelta(job: string, solar: boolean): Delta {
  switch (job) {
    case 'water': {
      const litres = 5 * FACTORS.farmM2.value;
      return { water: litres, emit: { water: pumpCo2(litres, solar) } };
    }
    case 'spray':
      return { emit: { chemicals: FACTORS.spray.value }, sprays: 1, pollution: 6 };
    case 'feed':
      return { emit: { fertilizer: 1 * N }, fertN: 1, pollution: 1 };
    // by hand: no herbicide
    case 'weed':
      return { soil: 0.5, credits: 0.3 };
    case 'drain':
      return { soil: 1 };
    default:
      return {};
  }
}

/** A wrong fix that still went on the field. */
export function wrongFixDelta(pick: string): Delta | null {
  if (pick === 'glyphosate') return { emit: { chemicals: FACTORS.spray.value }, sprays: 1, pollution: 10, soil: -1 };
  if (['insecticide', 'fungicide', 'spray'].includes(pick)) return { emit: { chemicals: FACTORS.spray.value }, sprays: 1, pollution: 6 };
  if (pick === 'fertilizer' || pick === 'topdress') return { emit: { fertilizer: 0.5 * N }, fertN: 0.5, pollution: 2 };
  if (pick === 'water' || pick === 'wet') return { water: 2 * FACTORS.farmM2.value };
  return null;
}

/** Climate shocks: the weather problems a changing climate brings more of. */
export const SHOCKS: TrialHazard[] = ['drought', 'flood', 'hail'];

/* ---------------- Farm Moja's season (one acre) ---------------- */

/** Each farming-step task of the classic season. */
export const TASK_CLIMATE: Record<string, Delta> = {
  tilling: { soil: -1 },
  clearing: { soil: -0.5 },
  'lp-manure': { emit: { manure: 6 }, stored: 40, soil: 3 },
  herbicide: { emit: { chemicals: 4 }, sprays: 1, pollution: 8, soil: -1 },
  seeding: { emit: { seed: 6 } },
  intercropping: { stored: 30, soil: 2 },
  'pl-manure': { emit: { manure: 3 }, stored: 20, soil: 2 },
  'f-nitrogen': { emit: { fertilizer: 13 * N }, fertN: 13, pollution: 4 },
  'f-phosphorus': { emit: { fertilizer: 9 * N }, fertN: 9, pollution: 3 },
  'f-potassium': { emit: { fertilizer: 20 }, pollution: 1 },
  'f-npk': { emit: { fertilizer: 11 * N }, fertN: 11, pollution: 3 },
  'f-manure': { emit: { manure: 10 }, stored: 60, soil: 4 },
  herbicides: { emit: { chemicals: 4 }, sprays: 1, pollution: 8, soil: -1 },
  fungicides: { emit: { chemicals: 4 }, sprays: 1, pollution: 6 },
  nematicides: { emit: { chemicals: 5 }, sprays: 1, pollution: 15, soil: -2 },
  insecticides: { emit: { chemicals: 4 }, sprays: 1, pollution: 10 },
  packaging: { emit: { storage: 2 }, pollution: 1 },
};

/** Watering tasks: their litres. */
export const waterTask = (litres: number, solar: boolean): Delta => ({ water: litres, emit: { water: pumpCo2(litres, solar) } });

/** Selling: storage, processing, transport and the food lost on the way, per bag. */
export const STORAGE_CO2: Record<string, number> = { home: 0, coop: 0.4, cold: 2.5 };
export const PROCESS_CO2: Record<string, number> = { drying: 0, processing: 1.2, packaging: 0.4 };

export function marketDelta(o: { bagsHarvested: number; bagsSold: number; storage: string; processId: string | null; solar: boolean }): Delta {
  const power = o.solar ? 0.15 : 1;
  const storage = (STORAGE_CO2[o.storage] ?? 0) * o.bagsHarvested * (o.storage === 'cold' ? power : 1);
  const process = (o.processId ? PROCESS_CO2[o.processId] ?? 0 : 0) * o.bagsSold * (o.processId === 'processing' ? power : 1);
  const lost = Math.max(0, o.bagsHarvested - o.bagsSold);
  return {
    emit: { storage: storage + process, transport: o.bagsSold * FACTORS.transport.value },
    pollution: o.processId === 'packaging' ? o.bagsSold * 0.05 : 0,
    yieldKg: o.bagsHarvested * FACTORS.bag.value,
    foodLoss: lost * FACTORS.bag.value,
  };
}

/* ---------------- adding up ---------------- */

export const emitted = (d: Delta) => Object.values(d.emit ?? {}).reduce((n, v) => n + (v ?? 0), 0);

const add = (f: Footprint, d: Delta): Footprint => ({
  co2: f.co2 + emitted(d),
  stored: f.stored + (d.stored ?? 0),
  water: f.water + (d.water ?? 0),
  pollution: f.pollution + (d.pollution ?? 0),
  soil: f.soil + (d.soil ?? 0),
  diesel: f.diesel + (d.diesel ?? 0),
  fertN: f.fertN + (d.fertN ?? 0),
  sprays: f.sprays + (d.sprays ?? 0),
  yieldKg: f.yieldKg + (d.yieldKg ?? 0),
  foodLoss: f.foodLoss + (d.foodLoss ?? 0),
});

/** Credits a change earns: carbon stored, and the extras a practice earns on its own. */
export const creditsOf = (d: Delta) => Math.max(0, (d.stored ?? 0) / FACTORS.credit.value + (d.credits ?? 0));

let entryId = 0;

/** Records one change. Returns the new climate state, and the level reached if a new one was. */
export function record(c: ClimateState, label: string, where: Where, d: Delta): { c: ClimateState; levelUp: (typeof LEVELS)[number] | null } {
  const co2 = emitted(d);
  const credits = creditsOf(d);
  if (!co2 && !credits && !d.water && !d.pollution && !d.soil && !d.yieldKg && !d.foodLoss && !d.stored) return { c, levelUp: null };
  const co2By = { ...c.co2By };
  for (const [s, n] of Object.entries(d.emit ?? {})) co2By[s as Source] += n ?? 0;
  const total = c.credits + credits;
  const level = levelOf(total);
  const next: ClimateState = {
    ...c,
    total: add(c.total, d),
    season: add(c.season, d),
    co2By,
    credits: total,
    seasonCredits: c.seasonCredits + credits,
    level: Math.max(c.level, level),
    log: [{ id: Date.now() + ++entryId, label, where, co2, d, credits }, ...c.log].slice(0, 40),
  };
  return { c: next, levelUp: level > c.level ? LEVELS[level] : null };
}

/** Closes a season or cycle: its totals join the history and the season starts again. */
export function closeSeason(c: ClimateState, label: string): ClimateState {
  return { ...c, cycles: [...c.cycles, { label, f: c.season, credits: c.seasonCredits }].slice(-8), season: ZERO, seasonCredits: 0 };
}

/* ---------------- levels, rating, efficiency ---------------- */

/** Climate levels, by credits earned. Each new level pays points once. */
export const LEVELS = [
  { name: 'Seedling', credits: 0, points: 0 },
  { name: 'Grower', credits: 10, points: 100 },
  { name: 'Steward', credits: 30, points: 200 },
  { name: 'Champion', credits: 60, points: 300 },
  { name: 'Climate hero', credits: 100, points: 500 },
] as const;

export const levelOf = (credits: number) => LEVELS.reduce((n, l, i) => (credits >= l.credits ? i : n), 0);

/** Net emissions: what went into the air minus what the soil kept. */
export const net = (f: Footprint) => f.co2 - f.stored;

/** kg CO₂e (net) for every 90 kg bag grown: the headline efficiency figure. Null before the first harvest. */
export const perBag = (f: Footprint) => (f.yieldKg > 0 ? net(f) / (f.yieldKg / FACTORS.bag.value) : null);

/** kg of food grown for every 1,000 L of water used on top of the rain. */
export const waterProductivity = (f: Footprint) => (f.water > 0 && f.yieldKg > 0 ? f.yieldKg / (f.water / 1000) : null);

/** A climate rating from A (best) to E, like an appliance label: emissions per bag, pollution per bag, soil. */
export function rating(f: Footprint): { grade: 'A' | 'B' | 'C' | 'D' | 'E'; score: number } | null {
  const bags = f.yieldKg / FACTORS.bag.value;
  if (bags <= 0) return null;
  const co2 = Math.max(0, net(f)) / bags; // 0 is perfect; 15+ is poor
  const pol = f.pollution / bags; // 0 is perfect; 4+ is poor
  const lost = f.foodLoss / Math.max(1, f.yieldKg + f.foodLoss); // share of food lost
  let score = 100 - Math.min(45, co2 * 3) - Math.min(30, pol * 7.5) - Math.min(15, lost * 60) + Math.max(-10, Math.min(10, f.soil / 2));
  score = Math.round(Math.max(0, Math.min(100, score)));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'E';
  return { grade, score };
}

/** The biggest source of emissions so far, with what to change. */
export function biggestSource(c: ClimateState) {
  const top = SOURCES.map(s => ({ ...s, kg: c.co2By[s.id] })).sort((a, b) => b.kg - a.kg)[0];
  return top && top.kg > 0 ? top : null;
}

/* ---------------- tags shown where a choice is made ---------------- */

/** The climate effect of one option of a six-farm plan step, on one farm. */
export function optionDelta(key: string, id: string, f: Forecast, solar: boolean): Delta | null {
  switch (key) {
    case 'land':
      return id === 'tractor' ? sum(LAND.tractor, contractorDiesel()) : LAND[id as Plan['land']] ?? null;
    case 'seed':
      return SEED[id as Plan['seed']] ?? null;
    case 'fert':
      return FERT[id as Plan['fert']] ?? null;
    case 'pest':
      return PEST[id as Plan['pest']] ?? null;
    case 'water': {
      const w = Number(id) as Plan['water'];
      const total = w + FORECASTS[f].rain;
      const l = w * FACTORS.farmM2.value * FACTORS.weeks.value;
      return { water: l, emit: { water: pumpCo2(l, solar) }, ...(total > WATER_TOO_MUCH ? { pollution: 6, soil: -1 } : {}) };
    }
    default:
      return null;
  }
}

/** A few words on a choice's climate effect, and whether it helps or harms. */
export function climateTag(d: Delta | null | undefined, short = false): { text: string; tone: 'good' | 'bad' | 'none' } | null {
  if (!d) return null;
  if (short) {
    const full = climateTag(d);
    const co2s = emitted(d);
    const r1 = (n: number) => (Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n)).toLocaleString('en-US');
    const text = (d.stored ?? 0) > co2s ? `${r1(d.stored!)} kg stored` : co2s >= 0.05 ? `+${r1(co2s)} kg CO₂e` : d.water ? `${r1(d.water / 1000)}k L` : full?.text.split(' · ')[0] ?? '';
    return full && { text, tone: full.tone };
  }
  const co2 = emitted(d);
  const parts: string[] = [];
  const r = (n: number) => (Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n)).toLocaleString('en-US');
  if (co2 >= 0.05) parts.push(`+${r(co2)} kg CO₂e`);
  if (d.stored) parts.push(`${r(d.stored)} kg stored`);
  if (d.water) parts.push(d.water >= 1000 ? `${r(d.water / 1000)}k L water` : `${r(d.water)} L water`);
  if ((d.pollution ?? 0) >= 3) parts.push('pollutes');
  if ((d.soil ?? 0) < 0) parts.push('soil −');
  else if ((d.soil ?? 0) > 0 && !d.stored) parts.push('soil +');
  if (!parts.length) return d.credits ? { text: 'Low impact · credits', tone: 'good' } : { text: 'Low impact', tone: 'none' };
  const bad = co2 >= 10 || (d.pollution ?? 0) >= 8 || (d.soil ?? 0) < 0;
  const good = (d.stored ?? 0) > 0 || (d.credits ?? 0) > 0;
  return { text: parts.join(' · '), tone: bad ? 'bad' : good ? 'good' : 'none' };
}
