/* Land under farming vs idle land, and the farmer's daily climate payment.

   Every day, each plot of the six farms (6 farms × 20 plots = 120) is one of three things:

   - Farmed: a crop is in the ground. Living roots and leaf litter feed carbon into the soil every day, and more
     with climate-smart practices: mulch (no dig), beans between the rows, manure. Tillage by tractor, and slash
     and burn, take some of it back.
   - Bare: cleared or ploughed, but not planted yet. Bare soil dries, blows and washes away, and loses its carbon
     to the air (counted as an emission, source "Bare soil").
   - Idle: not worked this cycle, or already harvested. Weeds and grass hold a little carbon, but nothing new is
     counted or paid, and it grows no food. Carbon programmes pay for practices on farmed land, not for land left
     alone.

   When a day ends (the farmer's own midnight, or a night slept on the fast clock of the first cycle), the day's
   land carbon is recorded on the Climate page, and every credit earned since the last payment, from the land and
   from the work (manure, mulch, hand weeding, clean tractor drives…), is paid to the farmer in coins. A higher
   climate level pays more a credit, as buyers pay a premium for farms with a record. Up to a week of days away
   is counted.

   The numbers are illustrative, like the rest of climate/model.ts, until an agronomist reviews them. No pictures
   or screens here, so the saved game can use it. */

import type { Plan, Trial } from '../trials/model';
import type { Field } from '../world/field';
import { FULL, PLOTS, TILES, doneMask } from '../world/field';
import { FACTORS, LEVELS, type Delta, type Factor } from './model';

export type LandUse = 'farmed' | 'bare' | 'idle';

export const LAND_FARMS = PLOTS.length;
export const LAND_PLOTS = LAND_FARMS * TILES;

/** The land's daily rates, a plot (a twentieth of a farm, about 34 m²) a day. */
export const LAND_FACTORS = {
  farmed: { value: 0.05, unit: 'kg CO₂ stored a plot a day', what: 'A growing crop: living roots and leaf litter feed carbon into the soil', estimate: true },
  bare: { value: 0.06, unit: 'kg CO₂ lost a plot a day', what: 'Cleared ground left unplanted: the soil dries and washes away and its carbon goes into the air', estimate: true },
  bareSoil: { value: 0.01, unit: 'soil points lost a plot a day', what: 'Bare soil wears out', estimate: true },
  idle: { value: 0, unit: 'kg CO₂ a plot a day', what: 'Land not farmed: nothing new is counted or paid' },
  floor: { value: 0.01, unit: 'kg CO₂ stored a plot a day', what: 'The least a crop in the ground stores, whatever the practice' },
} satisfies Record<string, Factor>;

/** Practices that change what a farmed plot stores a day: kg CO₂ a plot a day, added to the crop's own. */
export const PRACTICES: { id: string; label: string; add: number; on: (p: Plan) => boolean }[] = [
  { id: 'mulch', label: 'Mulch, no dig', add: 0.05, on: p => p.land === 'mulch' },
  { id: 'beans', label: 'Beans between the rows', add: 0.04, on: p => p.seed === 'intercrop' },
  { id: 'manure', label: 'Manure', add: 0.03, on: p => p.fert === 'manure' },
  { id: 'ox', label: 'Ox plough: light tillage', add: 0.01, on: p => p.land === 'ox' },
  { id: 'tractor', label: 'Tractor tillage', add: -0.01, on: p => p.land === 'tractor' },
  { id: 'slash', label: 'Slash and burn', add: -0.03, on: p => p.land === 'slash' },
];

/** kg CO₂ a farmed plot of this plan stores a day, and the practices that set it. */
export function farmedRate(p: Plan): { rate: number; practices: typeof PRACTICES } {
  const practices = PRACTICES.filter(x => x.on(p));
  const rate = Math.max(LAND_FACTORS.floor.value, LAND_FACTORS.farmed.value + practices.reduce((n, x) => n + x.add, 0));
  return { rate, practices };
}

/** The daily payment: coins a credit, the premium a climate level earns, and how many days away are counted. */
export const PAY = {
  perCredit: 5,
  premium: [1, 1.1, 1.2, 1.35, 1.5] as readonly number[],
  catchUpDays: 7,
};
export const payRate = (level: number) => Math.round(PAY.perCredit * (PAY.premium[level] ?? 1) * 100) / 100;
/** Coins for some credits, to a tenth (the player sees whole coins: money.ts). */
export const coinsFor = (credits: number, level: number) => Math.max(0, Math.round(credits * payRate(level) * 10) / 10);

export interface FarmLand {
  farm: number;
  /** each plot's use, Plot 1 first */
  uses: LandUse[];
  /** kg CO₂ a farmed plot stores a day here (0 when nothing is planted) */
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
  /** a day's net credits from the land */
  credits: number;
}

type LandSource = { trial: Trial | null; field: Field; view: 'world' | 'classic' };

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
  const stored = farms.reduce((n, f) => n + f.uses.filter(x => x === 'farmed').length * f.rate, 0);
  const bare = count('bare');
  const lost = bare * LAND_FACTORS.bare.value;
  return { farms, farmed: count('farmed'), bare, idle: count('idle'), stored, lost, credits: Math.max(0, stored - lost) / FACTORS.credit.value };
}

/** What some days of this land do to the climate: carbon stored, carbon lost from bare soil (it takes credits back),
    the soil worn by bare ground. */
export function landDelta(l: LandNow, days: number): Delta {
  if (days <= 0) return {};
  const d: Delta = {};
  if (l.stored > 0) d.stored = l.stored * days;
  if (l.lost > 0) {
    d.emit = { soil: l.lost * days };
    d.soil = -l.bare * LAND_FACTORS.bareSoil.value * days;
    d.credits = -(l.lost * days) / FACTORS.credit.value;
  }
  return d;
}

/** The land in a few words: "40 farmed · 20 bare · 60 idle". */
export const landWords = (l: Pick<LandNow, 'farmed' | 'bare' | 'idle'>) =>
  [`${l.farmed} farmed`, l.bare ? `${l.bare} bare` : '', `${l.idle} idle`].filter(Boolean).join(' · ');

/** The share of the land farmed, 0 to 1. */
export const farmedShare = (l: Pick<LandNow, 'farmed'>) => l.farmed / LAND_PLOTS;

export const levelName = (level: number) => LEVELS[level]?.name ?? LEVELS[0].name;
