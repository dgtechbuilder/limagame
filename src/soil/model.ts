/* The six farms' soil, and resting a farm: the land side of Climate Smart Agriculture.

   Every farm has a soil health from 0 to 100. A cycle of crop takes nutrients and organic matter out of it; the way
   the farm is worked takes out more (slash and burn, tractor tillage, no fertilizer or too much, a spray every week)
   or puts some back (mulch, manure, beans between the rows). The same farm cropped cycle after cycle loses more
   still: the same pests and the same nutrients, year after year.

   A farm can be RESTED for a cycle instead of planted (the plan's Use row, src/trials/Trials.tsx):
   · natural fallow: free; grass and bush grow back and the soil recovers slowly;
   · a green-manure cover crop (lablab, mucuna, desmodium): a little seed, and the soil recovers fast; the legume
     fixes nitrogen and is dug in before the next crop.
   A resting farm grows no harvest that cycle and needs no work, but its plants store carbon every day (paid with the
   climate payment, src/climate/land.ts), and the farm comes back the next cycle with better soil, so a bigger harvest.

   The soil health a farm had at planting sets a share of its harvest (soilFactor): 80 is as the plan's numbers
   assume, 100 grows about 9% more, 40 about 18% less. Climate-smart skills (src/csa) help the soil too.

   Like the six farms' other numbers, these are illustrative until an agronomist reviews them (README › Assumptions).
   No pictures or screens here, so the saved game can use it. */

import type { Plan, Trial } from '../trials/model';
import type { PlotRecord } from '../plots/data';

export type RestKind = 'fallow' | 'cover';

export const REST: Record<RestKind, { label: string; short: string; icon: string; does: string; why: string; cost: number; soil: number; carbon: number }> = {
  fallow: {
    label: 'Rest: natural fallow',
    short: 'Natural fallow',
    icon: '🌾',
    does: 'Leave the farm to grass and bush for one cycle. No work and no cost.',
    why: 'Roots and leaf litter slowly bring the soil back; the grass keeps it covered.',
    cost: 0,
    soil: 12,
    carbon: 0.8,
  },
  cover: {
    label: 'Rest: green-manure cover crop',
    short: 'Cover crop',
    icon: '🍀',
    does: 'Sow lablab or mucuna over the whole farm, and dig it in before the next crop.',
    why: 'The legume fixes nitrogen and feeds the soil fast; it covers every bit of ground.',
    // coins for one farm (4 acres of cover seed)
    cost: 1200,
    soil: 22,
    carbon: 2,
  },
};
export const REST_KINDS = Object.keys(REST) as RestKind[];

/** Every number a designer might tune. */
export const SOIL = {
  /** a farm's soil health when the game starts (and in saves from before soil) */
  start: 80,
  min: 5,
  max: 100,
  /** a cycle of crop, before the way it was farmed */
  cropped: -10,
  /** what the way a farm is farmed adds to (or takes from) a cycle of crop */
  land: { slash: -6, hoe: 0, ox: -1, tractor: -3, mulch: 6 } as Record<Plan['land'], number>,
  fert: { manure: 6, none: -3, double: -3 } as Partial<Record<PlotRecord['fert'], number>>,
  seed: { intercrop: 4, dense: -2 } as Partial<Record<PlotRecord['seed'], number>>,
  pest: { spray: -2 } as Partial<Record<Plan['pest'], number>>,
  /** cropped this many cycles in a row (this one too): it loses more each cycle */
  streakFrom: 3,
  streakLoss: 3,
  /** the harvest share soil health gives: base + span × health / 100 (80 → 1) */
  yield: { base: 0.64, span: 0.45 },
  /** a farm worth resting: soil below this, or cropped this many cycles in a row */
  restBelow: 55,
  restStreak: 4,
};

export interface SoilState {
  /** each farm's soil health, 0 to 100, Farm 1 first */
  health: number[];
  /** cycles each farm has been cropped in a row (0 once it rests) */
  streak: number[];
  /** cycles each farm has rested, all time */
  rested: number[];
  /** what the last harvest did to each farm's soil */
  last?: SoilChange[];
}

export interface SoilChange {
  farm: number;
  from: number;
  to: number;
  rest: RestKind | null;
  /** what moved it, in a few words each */
  why: string[];
}

const FARMS = 6;
export const initialSoil: SoilState = { health: Array(FARMS).fill(SOIL.start), streak: Array(FARMS).fill(0), rested: Array(FARMS).fill(0) };
export const soilOf = (s: Partial<SoilState> | undefined): SoilState => ({
  health: Array.from({ length: FARMS }, (_, i) => s?.health?.[i] ?? SOIL.start),
  streak: Array.from({ length: FARMS }, (_, i) => s?.streak?.[i] ?? 0),
  rested: Array.from({ length: FARMS }, (_, i) => s?.rested?.[i] ?? 0),
  ...(s?.last ? { last: s.last } : {}),
});

const clamp = (x: number) => Math.round(Math.max(SOIL.min, Math.min(SOIL.max, x)));

/** The share of a harvest a farm's soil health gives (1 at the starting soil). */
export const soilFactor = (health: number | undefined) => (health === undefined ? 1 : SOIL.yield.base + (SOIL.yield.span * Math.max(0, Math.min(100, health))) / 100);
/** The soil's effect on the harvest as a percentage: "+5%", "−12%" or "±0%". */
export const soilEffect = (health: number | undefined) => {
  const x = Math.round((soilFactor(health) - 1) * 100);
  return x === 0 ? '±0%' : `${x > 0 ? '+' : '−'}${Math.abs(x)}%`;
};

export type SoilTone = 'good' | 'ok' | 'poor';
export const soilTone = (h: number): SoilTone => (h >= 70 ? 'good' : h >= SOIL.restBelow ? 'ok' : 'poor');
export const SOIL_WORD: Record<SoilTone, string> = { good: 'Rich', ok: 'Tired', poor: 'Worn out' };

/** What a cycle of crop does to a farm's soil: the change, and why. `streak`: cycles cropped in a row before this one. */
export function cropChange(p: Plan, r: PlotRecord | undefined, streak: number, care = 0): { change: number; why: string[] } {
  const why: string[] = ['A crop takes nutrients out'];
  let change = SOIL.cropped;
  const add = (n: number | undefined, line: string) => {
    if (!n) return;
    change += n;
    why.push(`${line} ${n > 0 ? '+' : '−'}${Math.abs(n)}`);
  };
  add(SOIL.land[p.land], ({ slash: 'Slash and burn', hoe: '', ox: 'Ox ploughing', tractor: 'Tractor tillage', mulch: 'Mulch, no dig' } as Record<Plan['land'], string>)[p.land]);
  if (r) {
    add(SOIL.fert[r.fert], r.fert === 'manure' ? 'Manure' : r.fert === 'none' ? 'No fertilizer: the soil was mined' : 'A double dose: the soil turns acid');
    add(SOIL.seed[r.seed], r.seed === 'intercrop' ? 'Beans between the rows' : 'Planted too close');
  }
  add(SOIL.pest[p.pest], 'A spray every week kills soil life');
  if (streak + 1 >= SOIL.streakFrom) add(-SOIL.streakLoss, `Cropped ${streak + 1} cycles in a row`);
  add(care, 'Climate-smart skills');
  why[0] = `A crop takes nutrients out −${Math.abs(SOIL.cropped)}`;
  return { change, why };
}

/** What a cycle of rest does to a farm's soil. `care`: extra recovery from the farmer's skill at resting land (src/csa). */
export function restChange(kind: RestKind, care = 0): { change: number; why: string[] } {
  const why = [`${REST[kind].short} +${REST[kind].soil}`];
  if (care) why.push(`Rested with skill +${care}`);
  return { change: REST[kind].soil + care, why };
}

/** The soil after a cycle's harvest: every farm in the cycle cropped or rested. `care`: what the farmer's
    climate-smart skills add (src/csa/model.ts soilCare). */
export function soilAfter(prev: Partial<SoilState> | undefined, t: Pick<Trial, 'plans' | 'plots' | 'rest'>, care: { crop: number; rest: number } = { crop: 0, rest: 0 }): SoilState {
  const s = soilOf(prev);
  const health = [...s.health];
  const streak = [...s.streak];
  const rested = [...s.rested];
  const last: SoilChange[] = [];
  t.plans.forEach((p, farm) => {
    const rest = t.rest?.[farm] ?? null;
    const from = health[farm];
    const c = rest ? restChange(rest, care.rest) : cropChange(p, t.plots?.[farm]?.[0], streak[farm], care.crop);
    health[farm] = clamp(from + c.change);
    streak[farm] = rest ? 0 : streak[farm] + 1;
    if (rest) rested[farm] += 1;
    last.push({ farm, from, to: health[farm], rest, why: c.why });
  });
  return { health, streak, rested, last };
}

/** What the soil would be after this plan, without the harvest: for the plan screen. */
export const soilForecast = (prev: Partial<SoilState> | undefined, t: Pick<Trial, 'plans' | 'plots' | 'rest'>, care?: { crop: number; rest: number }) => soilAfter(prev, t, care).health;

/** The farms worth resting this cycle, most in need first: worn-out soil, or cropped many cycles in a row. Never more
    than half the farms, and never a farm already resting. */
export function restAdvice(prev: Partial<SoilState> | undefined, farms = FARMS): { farm: number; why: string }[] {
  const s = soilOf(prev);
  return Array.from({ length: farms }, (_, farm) => farm)
    .filter(farm => s.health[farm] < SOIL.restBelow || s.streak[farm] >= SOIL.restStreak)
    .sort((a, b) => s.health[a] - s.health[b] || s.streak[b] - s.streak[a])
    .slice(0, Math.floor(farms / 2))
    .map(farm => ({
      farm,
      why: s.health[farm] < SOIL.restBelow ? `soil ${s.health[farm]}: ${SOIL_WORD[soilTone(s.health[farm])].toLowerCase()}` : `cropped ${s.streak[farm]} cycles in a row`,
    }));
}

/** A day's kg CO₂ a resting acre stores (src/climate/land.ts). */
export const restCarbon = (kind: RestKind) => REST[kind].carbon;
