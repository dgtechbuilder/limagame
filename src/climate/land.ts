/* Every area of the farm, evaluated each day for the climate, and the farmer's daily climate payment.

   The farm's areas:

   - The six farms: 4 acres each (24 acres), 20 plots of a fifth of an acre. Each plot each day is
     · farmed: a crop in the ground; living roots and leaf litter feed carbon into the soil, more with climate-smart
       practices (mulch, beans between the rows, manure), less with tractor tillage or slash and burn;
     · bare: cleared or ploughed, not planted yet; bare soil dries and washes away, and loses its carbon to the air;
     · idle: not worked this cycle, or harvested; nothing new is counted or paid, and it grows no food.
   - Farm Moja: the 1-acre season farm, farmed, bare or idle the same way, from its season's tasks.
   - The mini forest: 10 acres of idle land left to grow as forest, top right of the farm above the pond. Young trees
     store far more carbon than any crop.
   - The grazing pen: grass, grazed by the cows.
   - The animals: 2 cows (methane from digestion, and their manure) and 4 hens; the water they drink.
   - The pond: the farm's water. What the animals and the house draw from it each day, and how clean it is (the
     fertilizer and sprays of the season wash into it).
   - The homestead: the house, coop and sheds; cooking on firewood, and the water the house uses.

   When a day ends (the farmer's own midnight, or a night slept on the fast clock of the first cycle), every area's
   day is recorded on the Climate page, and every credit earned since the last payment, from the land and from the
   work, is paid to the farmer in US dollars. A higher climate level pays more a credit. Up to a week away is counted.

   The numbers are illustrative, like the rest of climate/model.ts, until an agronomist reviews them; they are in
   the range of published figures where a source is named. No pictures or screens here, so the saved game can use
   it. */

import type { GameState } from '../state';
import type { Plan } from '../trials/model';
import { FULL, PLOTS, TILES, doneMask } from '../world/field';
import { FARM_ACRES, PLOT_ACRES } from '../farmSize';
import { fromUsd } from '../money';
import { FACTORS, LEVELS, type Delta, type Factor, type Source } from './model';

export type LandUse = 'farmed' | 'bare' | 'idle';

export const LAND_FARMS = PLOTS.length;
export const LAND_PLOTS = LAND_FARMS * TILES;

const IPCC_CATTLE = { name: 'IPCC 2006 Guidelines, Vol. 4 ch. 10: enteric methane, about 60 kg CH₄ a year for an African dairy cow', url: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol4.html' };

/** The land's and the animals' daily rates. kg CO₂ (or CO₂e) a day, an acre or an animal. */
export const LAND_FACTORS = {
  farmed: { value: 1, unit: 'kg CO₂ stored an acre a day', what: 'A growing crop: living roots and leaf litter feed carbon into the soil', estimate: true },
  bare: { value: 2, unit: 'kg CO₂ lost an acre a day', what: 'Cleared ground left unplanted: the soil dries and washes away and its carbon goes into the air', estimate: true },
  bareSoil: { value: 0.01, unit: 'soil points lost a plot a day', what: 'Bare soil wears out', estimate: true },
  idle: { value: 0, unit: 'kg CO₂ an acre a day', what: 'Land not farmed: nothing new is counted or paid' },
  floor: { value: 0.2, unit: 'kg CO₂ stored an acre a day', what: 'The least a crop in the ground stores, whatever the practice' },
  forest: { value: 11, unit: 'kg CO₂ stored an acre a day', what: 'A young mixed forest growing back (about 10 t CO₂ a hectare a year)', estimate: true },
  pasture: { value: 0.5, unit: 'kg CO₂ stored an acre a day', what: 'Grass that is grazed, not bare: roots build the soil', estimate: true },
  cowMethane: { value: 4.6, unit: 'kg CO₂e a cow a day', what: 'Methane from a cow’s digestion (60 kg CH₄ a year × 28)', source: IPCC_CATTLE },
  cowManure: { value: 0.6, unit: 'kg CO₂e a cow a day', what: 'Methane and N₂O from the cow’s manure in the pen', estimate: true },
  henManure: { value: 0.02, unit: 'kg CO₂e a hen a day', what: 'A hen’s manure', estimate: true },
  cowWater: { value: 50, unit: 'L a cow a day', what: 'What a dairy cow drinks', estimate: true },
  henWater: { value: 0.3, unit: 'L a hen a day', what: 'What a hen drinks', estimate: true },
  cooking: { value: 3, unit: 'kg CO₂e a day', what: 'Cooking on firewood in the house (an efficient stove or biogas halves it)', estimate: true },
  houseWater: { value: 100, unit: 'L a day', what: 'Water for the house: drinking, cooking, washing', estimate: true },
  credit: { value: 0.25, unit: 'US$ a credit', what: 'What a Lima climate credit (10 kg CO₂) pays: $25 a tonne, a nature-based carbon price', estimate: true },
} satisfies Record<string, Factor>;

/** The farm's areas: their size and what lives on them. */
export const AREA_SIZE = { farms: LAND_FARMS * FARM_ACRES, moja: 1, forest: 10, pasture: 2, pond: 0.5, homestead: 0.5, cows: 2, hens: 4 };

/** Practices that change what a farmed acre stores a day: kg CO₂ an acre a day, added to the crop's own. */
export const PRACTICES: { id: string; label: string; add: number; on: (p: Plan) => boolean }[] = [
  { id: 'mulch', label: 'Mulch, no dig', add: 1.5, on: p => p.land === 'mulch' },
  { id: 'beans', label: 'Beans between the rows', add: 1, on: p => p.seed === 'intercrop' },
  { id: 'manure', label: 'Manure', add: 1, on: p => p.fert === 'manure' },
  { id: 'ox', label: 'Ox plough: light tillage', add: 0.3, on: p => p.land === 'ox' },
  { id: 'tractor', label: 'Tractor tillage', add: -0.3, on: p => p.land === 'tractor' },
  { id: 'slash', label: 'Slash and burn', add: -1, on: p => p.land === 'slash' },
];

const rateOf = (adds: number[]) => Math.max(LAND_FACTORS.floor.value, LAND_FACTORS.farmed.value + adds.reduce((n, x) => n + x, 0));

/** kg CO₂ a farmed acre of this plan stores a day, and the practices that set it. */
export function farmedRate(p: Plan): { rate: number; practices: typeof PRACTICES } {
  const practices = PRACTICES.filter(x => x.on(p));
  return { rate: rateOf(practices.map(x => x.add)), practices };
}

/* ---------------- the daily payment ---------------- */

/** The daily payment: a credit's price (stored money: src/money.ts), the premium a climate level earns, and how many
    days away are counted. */
export const PAY = {
  perCredit: fromUsd(LAND_FACTORS.credit.value),
  premium: [1, 1.1, 1.2, 1.35, 1.5] as readonly number[],
  catchUpDays: 7,
};
/** Stored money a credit pays at a climate level. */
export const payRate = (level: number) => PAY.perCredit * (PAY.premium[level] ?? 1);
/** Stored money for some credits, to the cent. */
export const coinsFor = (credits: number, level: number) => Math.max(0, fromUsd(Math.round(credits * LAND_FACTORS.credit.value * (PAY.premium[level] ?? 1) * 100) / 100));

/* ---------------- the six farms, plot by plot ---------------- */

export interface FarmLand {
  farm: number;
  /** each plot's use, Plot 1 first */
  uses: LandUse[];
  /** kg CO₂ a farmed acre stores a day here (0 when nothing is planted) */
  rate: number;
  practices: string[];
}

export interface LandNow {
  farms: FarmLand[];
  farmed: number;
  bare: number;
  idle: number;
  /** a day's kg CO₂ stored by the farmed plots, and lost from the bare ones */
  stored: number;
  lost: number;
  /** a day's net credits from the six farms */
  credits: number;
}

type LandSource = Pick<GameState, 'trial' | 'field' | 'view'>;

/** One farm's plots today. In the farm world, a plot is planted when its row is planted; on the classic farm,
    the farms are planted with the plan. A harvested plot is idle again. */
function farmLand(s: LandSource, farm: number): FarmLand {
  const t = s.trial;
  const idle: FarmLand = { farm, uses: Array.from({ length: TILES }, () => 'idle'), rate: 0, practices: [] };
  if (!t || t.phase !== 'growing' || farm >= t.plans.length) return idle;
  const classic = s.view === 'classic';
  const sown = classic ? FULL : doneMask(s.field, t.cycle, farm, 'sow');
  const prepped = classic || t.cleared?.includes(farm) ? FULL : doneMask(s.field, t.cycle, farm, 'prep');
  const harvested = doneMask(s.field, t.cycle, farm, 'harvest');
  const uses = idle.uses.map((_, i): LandUse => {
    const b = 1 << i;
    if (harvested & b) return 'idle';
    if (sown & b) return 'farmed';
    if (prepped & b) return 'bare';
    return 'idle';
  });
  const { rate, practices } = farmedRate(t.plans[farm]);
  return { farm, uses, rate: uses.includes('farmed') ? rate : 0, practices: practices.map(x => x.label) };
}

/** The six farms' land as it stands. */
export function landOf(s: LandSource): LandNow {
  const farms = Array.from({ length: LAND_FARMS }, (_, i) => farmLand(s, i));
  const count = (u: LandUse) => farms.reduce((n, f) => n + f.uses.filter(x => x === u).length, 0);
  const stored = farms.reduce((n, f) => n + f.uses.filter(x => x === 'farmed').length * f.rate * PLOT_ACRES, 0);
  const bare = count('bare');
  const lost = bare * PLOT_ACRES * LAND_FACTORS.bare.value;
  return { farms, farmed: count('farmed'), bare, idle: count('idle'), stored, lost, credits: Math.max(0, stored - lost) / FACTORS.credit.value };
}

/* ---------------- every area of the farm ---------------- */

export type AreaId = 'farms' | 'moja' | 'forest' | 'pasture' | 'animals' | 'pond' | 'homestead';

export interface AreaNow {
  id: AreaId;
  name: string;
  icon: string;
  /** acres, or animals for the animals */
  size: string;
  /** what the area is doing today, in a few words */
  use: string;
  /** a day: kg CO₂ stored, kg CO₂e emitted by source, litres of water drawn, soil points */
  stored: number;
  emit: Partial<Record<Source, number>>;
  /** kg CO₂ lost from bare soil (it takes credits back) */
  lost: number;
  water: number;
  soil: number;
  /** a day's net credits */
  credits: number;
  /** the evaluation: how the area is doing for the climate, and what would help */
  note: string;
  tone: 'good' | 'bad' | 'none';
}

const emitted = (e: Partial<Record<Source, number>>) => Object.values(e).reduce((n, v) => n + (v ?? 0), 0);
const kg1 = (n: number) => `${Math.round(n * 10) / 10} kg`;

/** Farm Moja's acre today, from its season: planted once seeded, bare once cleared or tilled, idle after harvest. */
function mojaUse(s: Pick<GameState, 'doneTasks' | 'stage'>): { use: LandUse; adds: number[]; practices: string[] } {
  const done = (id: string) => s.doneTasks.includes(id);
  const harvested = s.stage >= 6;
  const practices: string[] = [];
  const adds: number[] = [];
  if (done('lp-manure') || done('pl-manure') || done('f-manure')) {
    practices.push('manure');
    adds.push(1);
  }
  if (done('intercropping')) {
    practices.push('beans');
    adds.push(1);
  }
  if (done('tilling')) {
    practices.push('tilled');
    adds.push(-0.3);
  }
  const use: LandUse = harvested ? 'idle' : done('seeding') ? 'farmed' : done('clearing') || done('tilling') ? 'bare' : 'idle';
  return { use, adds, practices };
}

/** A pond's health, 0 to 100: the season's runoff (fertilizer and sprays washed off the farms) muddies it. */
export const pondHealth = (seasonPollution: number) => Math.round(Math.max(0, Math.min(100, 100 - seasonPollution / 40)));

/** Every area of the farm today, evaluated. */
export function areasOf(s: GameState): AreaNow[] {
  const l = landOf(s);
  const solar = s.redeemed.includes('solar');
  const area = (a: Omit<AreaNow, 'credits' | 'tone'> & { tone?: AreaNow['tone'] }): AreaNow => ({
    ...a,
    credits: Math.max(0, a.stored - a.lost) / FACTORS.credit.value,
    tone: a.tone ?? (a.stored - a.lost - emitted(a.emit) > 0.05 ? 'good' : a.stored - a.lost - emitted(a.emit) < -0.05 ? 'bad' : 'none'),
  });

  // the six farms
  const practices = [...new Set(l.farms.flatMap(f => (f.uses.includes('farmed') ? f.practices : [])))];
  const farms = area({
    id: 'farms',
    name: 'Six farms',
    icon: '🌽',
    size: `${AREA_SIZE.farms} acres`,
    use: `${l.farmed} of ${LAND_PLOTS} plots farmed${l.bare ? `, ${l.bare} bare` : ''}`,
    stored: l.stored,
    emit: l.lost ? { soil: l.lost } : {},
    lost: l.lost,
    water: 0,
    soil: -l.bare * LAND_FACTORS.bareSoil.value,
    note: l.bare
      ? `${l.bare} bare plots losing ${kg1(l.lost)} CO₂ a day: plant them.`
      : !l.farmed
        ? 'Idle: plant to store carbon and earn credits.'
        : practices.length
          ? `Storing ${kg1(l.stored)} CO₂ a day, helped by ${practices.join(', ').toLowerCase()}.`
          : `Storing ${kg1(l.stored)} CO₂ a day. Mulch, beans or manure would store more.`,
  });

  // Farm Moja
  const m = mojaUse(s);
  const mRate = m.use === 'farmed' ? rateOf(m.adds) : 0;
  const mLost = m.use === 'bare' ? AREA_SIZE.moja * LAND_FACTORS.bare.value : 0;
  const moja = area({
    id: 'moja',
    name: 'Farm Moja',
    icon: '🌾',
    size: `${AREA_SIZE.moja} acre`,
    use: m.use === 'farmed' ? 'Crop growing' : m.use === 'bare' ? 'Cleared, not planted' : s.stage >= 6 ? 'Harvested' : 'Not planted yet',
    stored: mRate * AREA_SIZE.moja,
    emit: mLost ? { soil: mLost } : {},
    lost: mLost,
    water: 0,
    soil: m.use === 'bare' ? -AREA_SIZE.moja * 5 * LAND_FACTORS.bareSoil.value : 0,
    note:
      m.use === 'farmed'
        ? `Storing ${kg1(mRate)} CO₂ a day${m.practices.length ? ` (${m.practices.join(', ')})` : ''}.`
        : m.use === 'bare'
          ? 'Bare: seed it soon, or the soil loses carbon.'
          : 'Idle: seed it to start storing carbon.',
  });

  // the mini forest
  const fStored = AREA_SIZE.forest * LAND_FACTORS.forest.value;
  const forest = area({
    id: 'forest',
    name: 'Mini forest',
    icon: '🌳',
    size: `${AREA_SIZE.forest} acres`,
    use: 'Idle land, left to grow',
    stored: fStored,
    emit: {},
    lost: 0,
    water: 0,
    soil: 0,
    note: `Biggest carbon store: ${kg1(fStored)} CO₂ a day, and home to pest-eating birds.`,
  });

  // the grazing pen
  const pStored = AREA_SIZE.pasture * LAND_FACTORS.pasture.value;
  const pasture = area({
    id: 'pasture',
    name: 'Grazing pen',
    icon: '🌿',
    size: `${AREA_SIZE.pasture} acres`,
    use: 'Grass, grazed',
    stored: pStored,
    emit: {},
    lost: 0,
    water: 0,
    soil: 0,
    note: 'Grass roots hold the soil. Rotate the cows so it’s never bare.',
  });

  // the animals
  const cowCH4 = AREA_SIZE.cows * LAND_FACTORS.cowMethane.value;
  const manure = AREA_SIZE.cows * LAND_FACTORS.cowManure.value + AREA_SIZE.hens * LAND_FACTORS.henManure.value;
  const drink = AREA_SIZE.cows * LAND_FACTORS.cowWater.value + AREA_SIZE.hens * LAND_FACTORS.henWater.value;
  const animals = area({
    id: 'animals',
    name: 'Cows and hens',
    icon: '🐄',
    size: `${AREA_SIZE.cows} cows, ${AREA_SIZE.hens} hens`,
    use: 'Milk, eggs and manure',
    stored: 0,
    emit: { livestock: cowCH4 + manure },
    lost: 0,
    water: drink,
    soil: 0,
    tone: 'bad',
    note: `${kg1(cowCH4 + manure)} CO₂e a day, mostly cow methane. Good forage and spreading manure cut it.`,
  });

  // the pond
  const health = pondHealth(s.climate.season.pollution);
  const pond = area({
    id: 'pond',
    name: 'Pond',
    icon: '💧',
    size: `${AREA_SIZE.pond} acre`,
    use: `${Math.round(drink + LAND_FACTORS.houseWater.value)} L drawn a day`,
    stored: 0,
    emit: {},
    lost: 0,
    water: 0,
    soil: 0,
    tone: health >= 70 ? 'good' : health < 40 ? 'bad' : 'none',
    note:
      health >= 70
        ? `Clean (${health}/100): little fertilizer or spray has washed in this season.`
        : `${health < 40 ? 'Polluted' : 'Some runoff'} (${health}/100): farm runoff. Check and treat; never double-dose.`,
  });

  // the homestead
  const cook = LAND_FACTORS.cooking.value * (solar ? 0.8 : 1);
  const homestead = area({
    id: 'homestead',
    name: 'Homestead',
    icon: '🏠',
    size: `${AREA_SIZE.homestead} acre`,
    use: solar ? 'Solar power, firewood stove' : 'Firewood stove',
    stored: 0,
    emit: { cooking: cook },
    lost: 0,
    water: LAND_FACTORS.houseWater.value,
    soil: 0,
    tone: 'none',
    note: `Cooking: ${kg1(cook)} CO₂e a day. Biogas from manure would cut it.`,
  });

  return [farms, moja, forest, pasture, animals, pond, homestead];
}

/** What some days of these areas do to the climate: carbon stored, carbon lost from bare soil (it takes credits
    back), the animals' and the kitchen's emissions, the water drawn, the soil worn by bare ground. */
export function areasDelta(areas: AreaNow[], days: number): Delta {
  if (days <= 0) return {};
  const d: Delta = {};
  const emit: Partial<Record<Source, number>> = {};
  let stored = 0;
  let lost = 0;
  let water = 0;
  let soil = 0;
  for (const a of areas) {
    stored += a.stored;
    lost += a.lost;
    water += a.water;
    soil += a.soil;
    for (const [k, v] of Object.entries(a.emit)) emit[k as Source] = (emit[k as Source] ?? 0) + (v ?? 0) * days;
  }
  if (stored > 0) d.stored = stored * days;
  if (Object.keys(emit).length) d.emit = emit;
  if (lost > 0) d.credits = -(lost * days) / FACTORS.credit.value;
  if (water > 0) d.water = water * days;
  if (soil) d.soil = soil * days;
  return d;
}

/** The six farms' land in a few words: "40 farmed · 20 bare · 60 idle". */
export const landWords = (l: Pick<LandNow, 'farmed' | 'bare' | 'idle'>) =>
  [`${l.farmed} farmed`, l.bare ? `${l.bare} bare` : '', `${l.idle} idle`].filter(Boolean).join(' · ');

/** The share of the six farms' land farmed, 0 to 1. */
export const farmedShare = (l: Pick<LandNow, 'farmed'>) => l.farmed / LAND_PLOTS;

export const levelName = (level: number) => LEVELS[level]?.name ?? LEVELS[0].name;
