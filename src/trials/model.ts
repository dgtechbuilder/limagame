/* The six farms: one crop on up to six farms, each grown to a different plan, then compared at harvest.

   This file is the whole model and has no pictures or screens, so the saved game can use it. Every number that
   teaches something (what each choice costs, how much yield it gives, which problems it invites, how much a
   problem costs when it is caught or missed) is in the tables below, so an agronomist can review and tune them
   without touching any code. The numbers are illustrative until that review is done. */

import {
  CARE_MISSED,
  FERTS,
  MISFIT_COST,
  STALK_BORER,
  careApplies,
  careDay,
  plotStart,
  PLOT_SHARE,
  SEEDS,
  TRACTOR_LAND_FACTOR,
  TRACTOR_PLOT,
  defaultPlots,
  fertOf,
  legacyPlots,
  plotCost,
  plotName,
  prepNeed,
  seedOf,
  sprayerOf,
  toolFit,
  toolName,
  type CareJob,
  type FertId,
  type PlotJob,
  type PlotRecord,
  type SeedId,
} from '../plots/data';
import type { ImplId } from '../tractor/data';

/* ---------------- the plan ---------------- */

export type StepKey = 'land' | 'seed' | 'date' | 'fert' | 'pest' | 'water' | 'harvest';

export interface Plan {
  land: 'slash' | 'hoe' | 'ox' | 'tractor' | 'mulch';
  /** each plot's own seed is in Trial.plots; this one only sets the farm's odds (new plans keep 'certified') */
  seed: SeedId;
  date: 'early' | 'rains' | 'late';
  /** each plot's own fertilizer is in Trial.plots; this one only sets the farm's odds (new plans keep 'basal') */
  fert: FertId;
  pest: 'none' | 'scout' | 'spray';
  /** litres per m² per week on top of the rain */
  water: 0 | 10 | 20 | 30 | 40 | 50;
  harvest: 'early' | 'ready' | 'late';
}

export interface PlanOption {
  id: string;
  /** a few words: fits a cell of the plan table */
  label: string;
  /** what the farmer actually does; says nothing about how well it works */
  does: string;
  /** coins for one farm */
  cost: number;
  /** yield multiplier (water's depends on the rain, see waterFactor) */
  factor: number;
}

export interface PlanStep {
  key: StepKey;
  /** the farming step it belongs to (the six steps of the season) */
  label: string;
  options: PlanOption[];
}

const o = (id: string, label: string, does: string, cost: number, factor: number): PlanOption => ({ id, label, does, cost, factor });

/** Coins per L/m² per week of watering, for one farm over the whole cycle. */
export const WATER_COST_PER_L = 4;
export const WATER_LEVELS = [0, 10, 20, 30, 40, 50] as const;

export const PLAN_STEPS: PlanStep[] = [
  {
    key: 'land',
    label: 'Land prep',
    options: [
      o('slash', 'Slash and clear', 'Cut the bush and weeds down and clear them away. No digging.', 40, 0.85),
      o('hoe', 'Hand hoe', 'Dig the whole farm with a hoe.', 80, 0.95),
      o('ox', 'Ox plough', 'Hire oxen to plough the farm.', 120, 1),
      o('tractor', 'Tractor hire', 'Hire a tractor to plough and harrow. Fastest, and the deepest tillage.', 180, 1.03),
      o('mulch', 'Mulch, no dig', 'Dig only the planting holes and cover the ground with dry grass.', 110, 1),
    ],
  },
  {
    key: 'seed',
    label: 'Planting',
    // chosen for each plot (plots/data.ts SEEDS)
    options: SEEDS.map(x => o(x.id, x.label, x.does, x.cost, x.factor.normal)),
  },
  {
    key: 'date',
    label: 'Planting date',
    options: [
      o('early', 'Before the rains', 'Plant two weeks before the rains are due, to be first.', 0, 0.8),
      o('rains', 'With the rains', 'Plant once the first good rain has soaked the soil.', 0, 1),
      o('late', '3 weeks late', 'Plant three weeks after the rains start.', 0, 0.78),
    ],
  },
  {
    key: 'fert',
    label: 'Fertilizer',
    // chosen for each plot (plots/data.ts FERTS)
    options: FERTS.map(x => o(x.id, x.label, x.does, x.cost, x.factor)),
  },
  {
    key: 'pest',
    label: 'Pest control',
    options: [
      o('none', 'None', 'Leave the crop to itself.', 0, 1),
      o('scout', 'Check and treat', 'Check the crop and treat a pest or disease when you find one.', 30, 1),
      o('spray', 'Spray every week', 'Spray insecticide every week, whether or not there are pests.', 300, 1),
    ],
  },
  {
    key: 'water',
    label: 'Water',
    options: WATER_LEVELS.map(l => o(String(l), l === 0 ? 'Rain only' : `${l} L a week`, l === 0 ? 'No watering: the crop gets the rain only.' : `Water ${l} L per m² every week, on top of the rain.`, l * WATER_COST_PER_L, 1)),
  },
  {
    key: 'harvest',
    label: 'Harvest',
    options: [
      o('early', 'Early', 'Pick the cobs while the husks are still green.', 0, 0.82),
      o('ready', 'When ready', 'Pick when the husks are dry and the grain is hard.', 0, 1),
      o('late', '2 weeks late', 'Leave the dry cobs standing two more weeks before picking.', 0, 0.88),
    ],
  },
];

/** The steps planned for a whole farm. Seed and fertilizer are chosen for each of its four plots instead. */
export const FARM_STEP_KEYS: StepKey[] = ['land', 'date', 'pest', 'water', 'harvest'];
export const FARM_STEPS = PLAN_STEPS.filter(s => FARM_STEP_KEYS.includes(s.key));

export const stepOf = (key: StepKey) => PLAN_STEPS.find(s => s.key === key)!;
export const optionOf = (key: StepKey, plan: Plan) => stepOf(key).options.find(x => x.id === String(plan[key]))!;
/** A choice's words inside a sentence: only the first letter lowered, so units like L stay as they are. */
export const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
export const setChoice = (plan: Plan, key: StepKey, id: string): Plan => ({ ...plan, [key]: key === 'water' ? Number(id) : id }) as Plan;

/** A common way to grow maize, used for Farm 1 in the first, guided cycle. */
export const COMMON_PLAN: Plan = { land: 'hoe', seed: 'certified', date: 'rains', fert: 'basal', pest: 'none', water: 0, harvest: 'ready' };

/** What a farm's farm-wide steps cost (its plots' seed and fertilizer are on top: see farmCost). */
export const planCost = (p: Plan) => FARM_STEPS.reduce((n, s) => n + optionOf(s.key, p).cost, 0);
export const samePlan = (a: Plan, b: Plan) => FARM_STEPS.every(s => String(a[s.key]) === String(b[s.key]));
export const differences = (a: Plan, b: Plan) => FARM_STEPS.filter(s => String(a[s.key]) !== String(b[s.key])).map(s => s.key);

/** A farm's plan for odds and recipes: seed and fertilizer live on its plots, so they are kept neutral here. */
export const farmPlan = (p: Plan): Plan => ({ ...p, seed: 'certified', fert: 'basal' });

/* ---------------- the four plots of a farm ---------------- */

/** A farm's four plots (saves from before plots: all four follow the farm plan). */
export const plotsOf = (t: Pick<Trial, 'plots' | 'plans'>, farm: number): PlotRecord[] => t.plots?.[farm] ?? legacyPlots(t.plans[farm].seed, t.plans[farm].fert);

/** Seed and fertilizer for a farm's four plots. */
export const plotsCost = (rows: PlotRecord[]) => rows.reduce((n, r) => n + plotCost('seed', r.seed) + plotCost('fert', r.fert), 0);
/** Everything a farm costs to plant: its farm-wide steps and its plots' seed and fertilizer. */
export const farmCost = (t: Pick<Trial, 'plots' | 'plans'>, farm: number) => planCost(t.plans[farm]) + plotsCost(plotsOf(t, farm));
export const trialCost = (t: Pick<Trial, 'plots' | 'plans'>) => t.plans.reduce((n, _, i) => n + farmCost(t, i), 0);

/* ---------------- the season's rain ---------------- */

export type Forecast = 'dry' | 'normal' | 'wet';
/** L/m² of rain a week, and how the forecast reads */
export const FORECASTS: Record<Forecast, { rain: number; label: string }> = {
  dry: { rain: 8, label: 'A dry season: about 8 L/m² of rain a week' },
  normal: { rain: 15, label: 'Normal rains: about 15 L/m² of rain a week' },
  wet: { rain: 28, label: 'A wet season: about 28 L/m² of rain a week' },
};
/** What maize needs, rain and watering together, in L/m² a week. */
export const WATER_NEED = 35;
/** Above this much water a week the soil stays waterlogged. */
export const WATER_TOO_MUCH = 50;

export const waterTotal = (p: Plan, f: Forecast) => p.water + FORECASTS[f].rain;
export const waterFactor = (p: Plan, f: Forecast) => Math.max(0.5, Math.min(1, 1 - 0.012 * Math.abs(waterTotal(p, f) - WATER_NEED)));

/** The yield multiplier of one step of a plan. */
export const stepFactor = (key: StepKey, p: Plan, f: Forecast) => (key === 'water' ? waterFactor(p, f) : optionOf(key, p).factor);

/* ---------------- what can go wrong ---------------- */

/** The problems a maize farm can meet in this model (the same ids as the field checks). */
export type TrialHazard =
  | 'healthy'
  | 'drought'
  | 'flood'
  | 'nitrogen'
  | 'armyworm'
  | 'disease'
  | 'weeds'
  | 'livestock'
  | 'wildlife'
  | 'hail'
  | 'plantEarly'
  | 'plantLate'
  | 'harvestEarly'
  | 'harvestLate';

export type TrialStage = 'young' | 'grow' | 'harvest';

/** A cycle has six days of checks: two of seedlings, two of growing, two at harvest time. Harvest follows. */
export const CHECK_DAYS = 6;
export const stageOfDay = (day: number): TrialStage => (day <= 2 ? 'young' : day <= 4 ? 'grow' : 'harvest');

/** How likely each problem is on a day, before the plan changes it. Only problems the field checks can show at that stage. */
const BASE: Record<TrialStage, Partial<Record<TrialHazard, number>>> = {
  young: { healthy: 3, flood: 0.05, weeds: 0.1, livestock: 0.12 },
  grow: { healthy: 3, drought: 0.1, flood: 0.05, nitrogen: 0.05, armyworm: 0.9, disease: 0.35, weeds: 0.1, livestock: 0.12, hail: 0.08 },
  harvest: { healthy: 3, flood: 0.05, disease: 0.25, livestock: 0.12, wildlife: 0.25, hail: 0.08 },
};

const LAND_WEEDS: Record<Plan['land'], number> = { slash: 1.2, hoe: 0.6, ox: 0.5, tractor: 0.5, mulch: 0.2 };
const FERT_HUNGER: Record<Plan['fert'], number> = { none: 2, manure: 0.8, basal: 1, basalTop: 0.1, double: 0.1 };

/** How likely each problem is on a given day of a farm, after its plan and the season's rain. */
export function weightsFor(p: Plan, f: Forecast, day: number): Partial<Record<TrialHazard, number>> {
  const stage = stageOfDay(day);
  const w: Partial<Record<TrialHazard, number>> = { ...BASE[stage] };
  const add = (h: TrialHazard, n: number) => {
    if (w[h] !== undefined) w[h] = Math.max(0, (w[h] ?? 0) + n);
  };
  const total = waterTotal(p, f);
  add('drought', Math.max(0, WATER_NEED - total) * 0.08);
  add('flood', Math.max(0, total - WATER_TOO_MUCH) * 0.1);
  add('weeds', LAND_WEEDS[p.land]);
  add('nitrogen', FERT_HUNGER[p.fert] - (p.seed === 'intercrop' ? 0.3 : 0) + (p.seed === 'dense' ? 0.4 : 0));
  if (p.pest === 'spray') w.armyworm = 0;
  add('disease', (p.seed === 'dense' ? 0.4 : 0) + (f === 'wet' ? 0.3 : 0));
  add('wildlife', p.harvest === 'late' ? 0.9 : 0);
  return w;
}

/** What a problem costs. `missed`: share of the yield lost when it is not caught that day. `caught`: lost when it is
    read right and treated. `treat`: coins the treatment costs. Weather can't be treated, only recovered from. */
export const DAMAGE: Record<TrialHazard, { missed: number; caught: number; treat: number; fix: string }> = {
  healthy: { missed: 0, caught: 0, treat: 0, fix: '' },
  drought: { missed: 0.13, caught: 0.04, treat: 40, fix: 'Emergency watering' },
  flood: { missed: 0.1, caught: 0.04, treat: 30, fix: 'A drain dug' },
  nitrogen: { missed: 0.1, caught: 0.03, treat: 60, fix: 'A top-dress' },
  armyworm: { missed: 0.2, caught: 0.03, treat: 50, fix: 'The funnels treated' },
  disease: { missed: 0.14, caught: 0.04, treat: 50, fix: 'The worst leaves removed and the crop sprayed' },
  weeds: { missed: 0.1, caught: 0.02, treat: 30, fix: 'Weeded' },
  livestock: { missed: 0.15, caught: 0.04, treat: 40, fix: 'The animals driven out and the fence mended' },
  wildlife: { missed: 0.12, caught: 0.04, treat: 30, fix: 'Birds scared off and the cobs guarded' },
  hail: { missed: 0.08, caught: 0.06, treat: 0, fix: '' },
  // timing problems come from the plan itself: their cost is already in the yield
  plantEarly: { missed: 0, caught: 0, treat: 0, fix: '' },
  plantLate: { missed: 0, caught: 0, treat: 0, fix: '' },
  harvestEarly: { missed: 0, caught: 0, treat: 0, fix: '' },
  harvestLate: { missed: 0, caught: 0, treat: 0, fix: '' },
};

/** Pests and disease are only treated on a farm whose plan includes pest control. */
export const PEST_HAZARDS: TrialHazard[] = ['armyworm', 'disease'];
export const canTreat = (h: TrialHazard, p: Plan) => DAMAGE[h].treat > 0 && !(PEST_HAZARDS.includes(h) && p.pest === 'none');

/* ---------------- from Wakala Agent: numbers waiting for the agronomist ---------------- */

/** Coins a wrong fix costs in the farm world (the player is told why it was wrong and picks again). The same as the
    right treatment costs: the money is spent, the problem stays. */
export const WRONG_FIX_COST: Partial<Record<TrialHazard, number>> = Object.fromEntries(
  (Object.keys(DAMAGE) as TrialHazard[]).filter(h => DAMAGE[h].treat > 0).map(h => [h, DAMAGE[h].treat]),
);

/** Off until the agronomist has reviewed the numbers below (Gate A). While off, how well the tractor ploughed and
    whether follow-up care was done are shown to the player and saved, but they change no bags at harvest. */
export const WAKALA_YIELD_EFFECTS = false;

/** Proposed, behind WAKALA_YIELD_EFFECTS: a tractor-hire farm's land-prep factor is multiplied by
    base + span × Q, where Q (0 to 1) is how well the before-planting drive did the job. Q = 1 keeps the plan's
    factor; Q = 0 (the wrong implement, or nothing done) takes 12% off it. */
export const TRACTOR_Q_FACTOR = { base: 0.88, span: 0.12 };

/** Proposed, behind WAKALA_YIELD_EFFECTS: a missed follow-up brings the problem back the next day. With the flag
    on, that returned problem costs harvest like any other (DAMAGE), unless it is read right and treated again. */
export const MISSED_FOLLOW_UP_RETURNS = true;

/* ---------------- one cycle ---------------- */

export interface CheckRecord {
  right: boolean;
  tries: number;
  /** treated after a right call (and coins paid) */
  treated: boolean;
  /** farm world: the id of the right fix, once the player has picked it (care/data.ts PRESCRIBE) */
  fix?: string;
  /** farm world: how many wrong fixes were picked before the right one */
  wrongFixes?: number;
}

/** Care that has to be done again a day or two after a treatment (care/data.ts FOLLOW_UP). */
export interface FollowUp {
  farm: number;
  /** the check day it is due on */
  day: number;
  /** the work by hand (a TreatJob in world/field.ts: water, spray, weed, feed…) */
  job: string;
  /** the problem it follows up */
  hazard: TrialHazard;
  done: boolean;
  /** the day ended with it undone (logged once) */
  missed?: boolean;
}

/** The best before-planting tractor drive on a farm this cycle. */
export interface TractorRecord {
  stars: number;
  score: number;
  /** 0 to 1: how much of the field got the right work */
  Q: number;
  tries: number;
}

/** One plot's harvest. */
export interface PlotResult {
  bags: number;
  beans: number;
  quality: number;
  income: number;
  /** what the plot's own inputs did to its yield (1 = no change); care: its weeding and top-dress (staggered cycles) */
  factors: { land: number; seed: number; fert: number; tools: number; care?: number };
  /** share of the plot's yield lost to problems */
  lost: number;
  inputs: PlotRecord;
}

export interface FarmResult {
  bags: number;
  beans: number;
  quality: number;
  income: number;
  costs: number;
  profit: number;
  /** what each step's choice did to the yield */
  factors: Record<StepKey, number>;
  /** share of the yield lost to problems, in total */
  lost: number;
  /** problems that cost yield, worst first */
  problems: { hazard: TrialHazard; day: number; caught: boolean; loss: number }[];
  /** the four plots, A to D (missing in results from before plots) */
  plots?: PlotResult[];
  /** what the plots' own inputs did to the farm's yield, together (1 = as planned) */
  plotFactor?: number;
}

export interface Trial {
  cycle: number;
  /** the first cycle: two farms, a fast clock and a guide */
  guided: boolean;
  forecast: Forecast;
  plans: Plan[];
  phase: 'plan' | 'growing' | 'done';
  /** fast: the next day starts once every farm is checked; daily: one day per real day */
  clock: 'fast' | 'daily';
  /** the real day (dayNumber) the farms were planted */
  planted: number | null;
  /** the day being played, on the fast clock */
  day: number;
  /** by `${farm}:${day}`, farm counted from 0 */
  checks: Record<string, CheckRecord>;
  /** coins spent on treatments, by farm */
  treatments: number[];
  results: FarmResult[] | null;
  /** farm world: care due again after a treatment (missing in saves from before it existed) */
  followUps?: FollowUp[];
  /** farm world: the best tractor drive on each tractor-hire farm, by farm index */
  tractor?: Record<string, TractorRecord>;
  /** each farm's four plots A to D: seed, fertilizer, sprayer, tractor and tools (missing in saves from before plots) */
  plots?: PlotRecord[][];
  /** coins spent on tractor fuel, by farm */
  fuel?: number[];
  /** farm world, from the second cycle: the plots are planted a day apart, each with its own care (plots/data.ts) */
  stagger?: boolean;
}

export interface TrialSummary {
  cycle: number;
  farms: number;
  best: number;
  bags: number[];
  profit: number[];
}

export const POTENTIAL_BAGS = 6; // 90 kg bags of maize from one farm (a sixth of an acre) when everything goes right
export const BEANS_BAGS = 0.8;
export const BEANS_PRICE = 350;
export const PRICE_BY_QUALITY = [0, 220, 260, 300, 340, 360];
export const farmName = (i: number) => `Farm ${i + 1}`;
export const checkKey = (farm: number, day: number) => `${farm}:${day}`;

/** Which day of checks the cycle is on: 1 to 6, or 7 once every day has passed and the farms are ready to harvest. */
export function currentDay(t: Trial, today: number): number {
  if (t.phase !== 'growing') return 0;
  if (t.clock === 'fast' || t.planted === null) return Math.min(CHECK_DAYS + 1, Math.max(1, t.day));
  return Math.min(CHECK_DAYS + 1, Math.max(1, today - t.planted + 1));
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rand01(seed: string) {
  let a = hash(seed) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A follow-up due the day before that was not done: its problem is back on this farm today. */
export function returnedProblem(t: Pick<Trial, 'followUps'>, farm: number, day: number): FollowUp | null {
  return t.followUps?.find(u => u.farm === farm && u.day === day - 1 && !u.done) ?? null;
}

/** What a farm shows on a day of the cycle: what its plan and luck drew (baseHazard), unless follow-up care was
    missed the day before, which brings that problem back. */
export function hazardFor(t: Pick<Trial, 'cycle' | 'forecast' | 'plans' | 'guided' | 'followUps'>, farm: number, day: number): TrialHazard {
  const back = returnedProblem(t, farm, day);
  return back ? back.hazard : baseHazard(t, farm, day);
}

/** What a farm shows on a day of the cycle. The plan's timing shows on fixed days; the rest is drawn from its odds. */
export function baseHazard(t: Pick<Trial, 'cycle' | 'forecast' | 'plans' | 'guided'>, farm: number, day: number): TrialHazard {
  const p = t.plans[farm];
  if (day === 1 && p.date === 'early') return 'plantEarly';
  if (day === 3 && p.date === 'late') return 'plantLate';
  if (day === CHECK_DAYS && p.harvest === 'early') return 'harvestEarly';
  if (day === CHECK_DAYS && p.harvest === 'late') return 'harvestLate';
  const w = weightsFor(p, t.forecast, day);
  const list = (Object.entries(w) as [TrialHazard, number][]).filter(([, n]) => n > 0);
  const total = list.reduce((n, [, x]) => n + x, 0);
  // In the guided cycle both farms share each day's luck, so they differ only where their plans differ. With six
  // farms each farm has its own luck, as real fields do; the plans still set the odds.
  let r = rand01(t.guided ? `${t.cycle}:${day}` : `${t.cycle}:${farm}:${day}`) * total;
  for (const [h, n] of list) {
    r -= n;
    if (r < 0) return h;
  }
  return 'healthy';
}

/** The day's problems on a farm and how well each was caught (the same for all four plots; what each plot loses
    differs with its seed, fertilizer and sprayer: plotLoss). */
function farmProblems(t: Trial, farm: number, lastDay: number) {
  const p = t.plans[farm];
  const problemOn = (day: number) => (WAKALA_YIELD_EFFECTS && MISSED_FOLLOW_UP_RETURNS ? hazardFor(t, farm, day) : baseHazard(t, farm, day));
  const out: { hazard: TrialHazard; day: number; caught: boolean; treated: boolean }[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const h = problemOn(day);
    if (!DAMAGE[h].missed) continue;
    const rec = t.checks[checkKey(farm, day)];
    // with the effects off, a day whose problem came back is judged by how the player dealt with what they were shown
    const shown = WAKALA_YIELD_EFFECTS ? null : returnedProblem(t, farm, day);
    const caught = shown
      ? !!rec?.right && (rec.treated || !canTreat(shown.hazard, p))
      : !!rec?.right && (rec.treated || !canTreat(h, p)) && (h === 'hail' || canTreat(h, p));
    out.push({ hazard: h, day, caught, treated: !!rec?.treated });
  }
  return out;
}

/** What one problem costs one plot: the farm's loss, changed by the plot's seed, fertilizer and sprayer. */
export function plotLoss(h: TrialHazard, caught: boolean, treated: boolean, r: PlotRecord): number {
  const d = DAMAGE[h];
  let loss = caught ? d.caught : d.missed;
  // a pest or disease treated by spraying: each plot is saved as well as its sprayer covers it
  if ((h === 'armyworm' || h === 'disease') && caught && treated && r.sprayer) {
    const cover = sprayerOf(r.sprayer).cover[h];
    loss = d.caught + (d.missed - d.caught) * (1 - cover);
  }
  const seed = seedOf(r.seed);
  if (h === 'drought') loss *= seed.drought;
  if (h === 'disease') loss *= seed.rust;
  if (h === 'nitrogen') loss *= fertOf(r.fert).hunger;
  return Math.min(0.6, loss);
}

/** What a plot's tools and tractor did to its yield: a tool that does not suit the job takes some off, and heavy
    tractors pack the soil. */
export function toolsFactor(r: PlotRecord, farm: number): number {
  let k = 1;
  for (const [job, tool] of Object.entries(r.tools ?? {}) as [PlotJob, NonNullable<PlotRecord['tools']>[PlotJob]][]) {
    if (tool) k *= 1 - MISFIT_COST[job] * (1 - toolFit(job, tool, farm));
  }
  if (r.tractor) k *= TRACTOR_PLOT[r.tractor].compaction;
  if (r.sprayer && r.tools?.spray === 'sprayer') k *= sprayerOf('boom').damage;
  return k;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** A plot's care missed by this day (staggered cycles only): care due on a later day does not count yet. */
export function careMissed(t: Pick<Trial, 'stagger'>, r: PlotRecord, plot: number, day = CHECK_DAYS + 1): CareJob[] {
  if (!t.stagger) return [];
  return (['weeding', 'topdress', 'borer'] as CareJob[]).filter(j => {
    const d = careDay(plot, j, true);
    return d <= CHECK_DAYS && d < day && careApplies(j, r) && !r.care?.[j];
  });
}

/** What a plot's weeding and top-dress did to its yield (1 = all done, or not a staggered cycle). */
export function careFactor(t: Pick<Trial, 'stagger'>, r: PlotRecord, plot: number, day = CHECK_DAYS + 1): number {
  const missed = careMissed(t, r, plot, day);
  return (missed.includes('weeding') ? 1 - CARE_MISSED.weeding : 1) * (missed.includes('topdress') ? 1 - CARE_MISSED.topdress : 1);
}

/** The share of a plot's yield stalk borer takes (staggered cycles): all of STALK_BORER unless the plot was sprayed
    on its day, and then what its sprayer misses. The check strip always shows the full loss. */
export function borerLoss(t: Pick<Trial, 'stagger'>, r: PlotRecord, plot: number, day = CHECK_DAYS + 1): number {
  if (!t.stagger || careDay(plot, 'borer', true) >= day) return 0;
  if (r.care?.borer && r.sprayer && r.sprayer !== 'none') return STALK_BORER * (1 - sprayerOf(r.sprayer).cover.armyworm);
  return STALK_BORER;
}

/** What the farm plan and the farm's problems give each plot (the same for all four plots). */
function farmContext(t: Trial, farm: number, lastDay: number) {
  const p = t.plans[farm];
  const factors = Object.fromEntries(PLAN_STEPS.map(s => [s.key, stepFactor(s.key, p, t.forecast)])) as Record<StepKey, number>;
  // proposed effects from Wakala Agent, off until the agronomist's review (see WAKALA_YIELD_EFFECTS)
  const drive = t.tractor?.[farm];
  if (WAKALA_YIELD_EFFECTS && p.land === 'tractor' && drive) factors.land *= TRACTOR_Q_FACTOR.base + TRACTOR_Q_FACTOR.span * drive.Q;
  const farmShare = FARM_STEP_KEYS.reduce((n, k) => n * factors[k], 1);
  return { p, factors, farmShare, found: farmProblems(t, farm, lastDay) };
}

/** One plot's harvest from its inputs, before rounding. In a staggered cycle, problems before the plot was planted
    pass it by, and its care counts (`day`: care due from this day on does not count yet). */
function growPlot(t: Trial, farm: number, r: PlotRecord, ctx: ReturnType<typeof farmContext>, plot: number, day = CHECK_DAYS + 1) {
  const seed = seedOf(r.seed);
  // land turned by the tractor from the seat gets the tractor's land prep instead of the plan's
  const land = r.tractor && r.tools?.prep ? TRACTOR_LAND_FACTOR / ctx.factors.land : 1;
  const own = { land, seed: seed.factor[t.forecast], fert: fertOf(r.fert).factor, tools: toolsFactor(r, farm), care: careFactor(t, r, plot, day) };
  const start = plotStart(plot, t.stagger);
  const keep = ctx.found.filter(q => q.day >= start).reduce((n, q) => n * (1 - plotLoss(q.hazard, q.caught, q.treated, r)), 1) * (1 - borerLoss(t, r, plot, day));
  const bags = POTENTIAL_BAGS * PLOT_SHARE * ctx.farmShare * own.land * own.seed * own.fert * own.tools * own.care * keep;
  return { bags, keep, own, seed };
}

/** How each plot of a farm is growing so far, as a share of the best possible plot (1 = as good as it gets), for the
    crop's height and colour on the field. Problems seen so far count. */
export function plotGrowth(t: Trial, farm: number, lastDay = CHECK_DAYS, day = CHECK_DAYS + 1): number[] {
  if (farm >= t.plans.length) return [1, 1, 1, 1];
  const ctx = farmContext(t, farm, lastDay);
  return plotsOf(t, farm).map((r, p) => {
    const g = growPlot(t, farm, r, ctx, p, day);
    return Math.max(0.2, Math.min(1.2, (g.own.land * g.own.seed * g.own.fert * g.own.tools * g.own.care * g.keep) / 1.05));
  });
}

/** What a farm's harvest comes to: its four plots, each from the farm plan, its own inputs, and the farm's
    problems as that plot suffered them. */
export function harvestFarm(t: Trial, farm: number, lastDay = CHECK_DAYS): FarmResult {
  const ctx = farmContext(t, farm, lastDay);
  const { p, factors, found } = ctx;
  const rows = plotsOf(t, farm);
  const plots: PlotResult[] = rows.map((r, plot) => {
    // care and stalk borer count once their day is past (all of them at harvest)
    const g = growPlot(t, farm, r, ctx, plot, lastDay + 1);
    const bags = round1(g.bags);
    const beans = g.seed.beans ? round1(BEANS_BAGS * PLOT_SHARE * g.keep) : 0;
    const lost = 1 - g.keep;
    let quality = 5 - Math.round(lost * 10) + g.seed.quality;
    if (p.harvest === 'early') quality = Math.min(quality, 3);
    if (p.harvest === 'late') quality -= 1;
    quality = Math.max(1, Math.min(5, quality));
    return { bags, beans, quality, income: Math.round(bags * PRICE_BY_QUALITY[quality] + beans * BEANS_PRICE), factors: g.own, lost, inputs: r };
  });
  const bags = round1(plots.reduce((n, x) => n + x.bags, 0));
  const beans = round1(plots.reduce((n, x) => n + x.beans, 0));
  const income = plots.reduce((n, x) => n + x.income, 0);
  const quality = bags > 0 ? Math.max(1, Math.min(5, Math.round(plots.reduce((n, x) => n + x.quality * x.bags, 0) / bags))) : 1;
  const lost = plots.reduce((n, x) => n + x.lost, 0) / plots.length;
  // the plots' own inputs together, and the farm-level seed and fertilizer as their average (for the comparison)
  const geo = (f: (x: PlotResult) => number) => Math.exp(plots.reduce((n, x) => n + Math.log(Math.max(1e-6, f(x))), 0) / plots.length);
  const plotFactor = geo(x => x.factors.land * x.factors.seed * x.factors.fert * x.factors.tools * (x.factors.care ?? 1));
  const out = { ...factors, seed: geo(x => x.factors.seed), fert: geo(x => x.factors.fert) };
  const costs = farmCost(t, farm) + (t.treatments[farm] ?? 0) + (t.fuel?.[farm] ?? 0);
  const problems = found
    .map(q => ({ hazard: q.hazard, day: q.day, caught: q.caught, loss: plots.reduce((n, x) => n + plotLoss(q.hazard, q.caught, q.treated, x.inputs), 0) / plots.length }))
    .sort((a, b) => b.loss - a.loss);
  return { bags, beans, quality, income, costs, profit: income - costs, factors: out, lost, problems, plots, plotFactor };
}

/* ---------------- what the plots showed ---------------- */

export interface PlotLesson {
  topic: 'Seed' | 'Fertilizer' | 'Tractor' | 'Land tool' | 'Sprayer';
  line: string;
  /** each choice tried, best first: its name and how much more (or less) a plot grew with it than with the reference */
  options: { name: string; change: number; plots: number }[];
}

/** Lower the first letter, unless the word is an abbreviation (DAP, CAN). */
const soft = (x: string) => (/^[A-Z]{2}/.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1));

/** Lima AI: what the player's plots showed, other things equal. For every plot, its harvest is set against the same
    plot (same farm, weather, problems and care) with just one input changed to a reference: long-season hybrid
    seed, no fertilizer, no tractor, no spray. The changes are averaged over the plots that had each choice. */
export function plotLessons(t: Trial): PlotLesson[] {
  const topics: { topic: PlotLesson['topic']; ref: string; refName: string; get: (r: PlotRecord) => string | undefined; set: (r: PlotRecord) => PlotRecord; name: (k: string) => string }[] = [
    { topic: 'Seed', ref: 'certified', refName: 'long-season hybrid', get: r => r.seed, set: r => ({ ...r, seed: 'certified' }), name: k => seedOf(k as SeedId).label.toLowerCase() },
    { topic: 'Fertilizer', ref: 'none', refName: 'no fertilizer', get: r => r.fert, set: r => ({ ...r, fert: 'none' }), name: k => (k === 'none' ? 'no fertilizer' : soft(fertOf(k as FertId).label)) },
    { topic: 'Tractor', ref: 'hand', refName: 'work by hand', get: r => r.tractor ?? 'hand', set: r => ({ ...r, tractor: undefined, tools: undefined }), name: k => (k === 'hand' ? 'by hand' : `${k} tractor`) },
    {
      topic: 'Land tool',
      ref: 'right',
      refName: 'the tool each farm needed',
      get: r => (r.tools?.prep ? r.tools.prep : undefined),
      set: r => r,
      name: k => toolName(k as ImplId).toLowerCase(),
    },
    { topic: 'Sprayer', ref: 'none', refName: 'no spray', get: r => r.sprayer, set: r => ({ ...r, sprayer: 'none' }), name: k => sprayerOf(k as never).label.toLowerCase() },
  ];
  const out: PlotLesson[] = [];
  const ctxs = t.plans.map((_, farm) => farmContext(t, farm, CHECK_DAYS));
  for (const tp of topics) {
    const by = new Map<string, number[]>();
    t.plans.forEach((_, farm) => {
      plotsOf(t, farm).forEach((r, p) => {
        const k = tp.get(r);
        if (k === undefined) return;
        const real = growPlot(t, farm, r, ctxs[farm], p).bags;
        const swap = tp.topic === 'Land tool' ? { ...r, tools: { ...r.tools, prep: prepNeed(farm).tool } } : tp.set(r);
        const ref = growPlot(t, farm, swap, ctxs[farm], p).bags;
        by.set(k, [...(by.get(k) ?? []), ref > 0 ? real / ref - 1 : 0]);
      });
    });
    if (by.size < 2 && tp.topic !== 'Land tool') continue;
    if (!by.size) continue;
    const options = [...by.entries()]
      .map(([k, v]) => ({ k, name: tp.name(k), change: v.reduce((x, y) => x + y, 0) / v.length, plots: v.length }))
      .sort((x, y) => y.change - x.change);
    const pc = (x: number) => (Math.abs(x) < 0.005 ? '±0%' : `${x > 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`);
    if (tp.topic === 'Sprayer' && options.every(o => Math.abs(o.change) < 0.005)) {
      out.push({ topic: tp.topic, line: 'Sprayers made no difference this cycle: no plot needed spraying.', options: [] });
      continue;
    }
    const body = options.map(o => `${o.name} ${o.k === tp.ref ? '(the yardstick)' : pc(o.change)}`).join(', ');
    out.push({ topic: tp.topic, line: `${tp.topic}, against ${tp.refName} on the same plot: ${body}.`, options: options.map(({ name, change, plots }) => ({ name, change, plots })) });
  }
  return out;
}

/* ---------------- why one farm beat another ---------------- */

export const HAZARD_WORDS: Record<TrialHazard, string> = {
  healthy: 'nothing',
  drought: 'drought',
  flood: 'waterlogging',
  nitrogen: 'hunger for plant food',
  armyworm: 'fall armyworm',
  disease: 'leaf rust',
  weeds: 'weeds',
  livestock: 'goats',
  wildlife: 'birds',
  hail: 'hail',
  plantEarly: 'planting too early',
  plantLate: 'planting too late',
  harvestEarly: 'harvesting too early',
  harvestLate: 'harvesting too late',
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const bagsText = (x: number) => `${Math.abs(Math.round(x * 10) / 10)} bag${Math.abs(Math.round(x * 10) / 10) === 1 ? '' : 's'}`;

/** Lima AI: the reasons the farm that grew the most beat the farm that grew the least, from the player's own numbers. */
export function explain(t: Trial, results: FarmResult[]): { best: number; worst: number; lines: string[] } {
  const order = results.map((_, i) => i).sort((a, b) => results[b].bags - results[a].bags || results[b].profit - results[a].profit);
  const best = order[0];
  const worst = order[order.length - 1];
  const B = results[best];
  const W = results[worst];
  const lines: string[] = [];
  const gap = B.bags - W.bags;
  if (gap < 0.05) {
    lines.push(`${farmName(best)} and ${farmName(worst)} grew the same: what you changed made no difference to the harvest this time.`);
    return { best, worst, lines };
  }
  lines.push(`${farmName(best)} grew ${B.bags} bags of maize; ${farmName(worst)} grew ${W.bags}. That is ${bagsText(gap)} more.`);
  // split the gap between the steps (and the problems) by their share of the difference in log-yield
  const parts: { what: string; ln: number }[] = FARM_STEPS.map(s => ({
    what: s.key,
    ln: Math.log(B.factors[s.key]) - Math.log(W.factors[s.key]),
  }));
  parts.push({ what: 'plots', ln: Math.log(B.plotFactor ?? B.factors.seed * B.factors.fert) - Math.log(W.plotFactor ?? W.factors.seed * W.factors.fert) });
  parts.push({ what: 'problems', ln: Math.log(1 - B.lost) - Math.log(1 - W.lost) });
  const lnGap = parts.reduce((n, x) => n + x.ln, 0);
  const pb = t.plans[best];
  const pw = t.plans[worst];
  const top = parts
    .map(x => ({ ...x, bags: lnGap ? (gap * x.ln) / lnGap : 0 }))
    .filter(x => x.bags > 0.05)
    .sort((a, b) => b.bags - a.bags)
    .slice(0, 2);
  for (const x of top) {
    if (x.what === 'plots') {
      lines.push(`Plots: the seeds, fertilizer and machines on ${farmName(best)}'s four plots gave ${bagsText(x.bags)} more than ${farmName(worst)}'s.`);
    } else if (x.what === 'problems') {
      const worstProblems = [...new Set(W.problems.filter(q => q.loss >= 0.05).map(q => HAZARD_WORDS[q.hazard]))].slice(0, 2);
      lines.push(
        `Problems: ${farmName(worst)} lost ${pct(W.lost)} of its crop${worstProblems.length ? ` (${worstProblems.join(' and ')})` : ''}, ${farmName(best)} ${pct(B.lost)}. That is ${bagsText(x.bags)}.`,
      );
    } else {
      const key = x.what as StepKey;
      const step = stepOf(key);
      lines.push(`${step.label}: ${lower(optionOf(key, pb).label)} instead of ${lower(optionOf(key, pw).label)} gave ${bagsText(x.bags)} more.`);
      if (key === 'water') lines.push(`Maize needs about ${WATER_NEED} L/m² a week; the rain gave about ${FORECASTS[t.forecast].rain}.`);
    }
  }
  // the farm that grew most is not always the one that made most
  const rich = results.map((_, i) => i).sort((a, b) => results[b].profit - results[a].profit)[0];
  if (rich !== best) {
    lines.push(`But ${farmName(rich)} made the most money: ${results[rich].profit.toLocaleString('en-US')} coins against ${B.profit.toLocaleString('en-US')}, because it cost less to grow.`);
  }
  return { best, worst, lines };
}

/** Why a farm shows this problem, from its own plan and its plots (shown after a call, so the player links the sign
    to the cause). */
export function causeOf(h: TrialHazard, p: Plan, f: Forecast, rows?: PlotRecord[]): string {
  const plotWith = (test: (r: PlotRecord) => boolean) => (rows ?? []).map((r, i) => (test(r) ? plotName(i) : '')).filter(Boolean);
  if (rows && h === 'nitrogen') {
    const bare = plotWith(r => r.fert === 'none' || r.fert === 'manure');
    const fed = plotWith(r => r.fert === 'basalTop' || r.fert === 'double');
    return [bare.length ? `${bare.join(' and ')} got no fertilizer or only manure, so ${bare.length > 1 ? 'they are' : 'it is'} hungriest.` : 'The plants are short of food this week.', fed.length ? `${fed.join(' and ')} had a CAN top-dress and hardly suffer${fed.length > 1 ? '' : 's'}.` : ''].filter(Boolean).join(' ');
  }
  if (rows && h === 'drought') {
    const dt = plotWith(r => r.seed === 'dt');
    const base = causeOf(h, p, f);
    return dt.length ? `${base} The drought-tolerant seed on ${dt.join(' and ')} copes best.` : base;
  }
  if (rows && h === 'disease' && p.pest !== 'none') {
    const close = plotWith(r => r.seed === 'dense' || r.seed === 'saved');
    return close.length ? `${close.join(' and ')} (close spacing or saved seed) catch rust worst.` : '';
  }
  const total = waterTotal(p, f);
  switch (h) {
    case 'drought':
      return total < WATER_NEED
        ? `This farm gets ${p.water ? `${p.water} L/m² of water a week plus about ${FORECASTS[f].rain} of rain` : `only the rain, about ${FORECASTS[f].rain} L/m² a week`}. Maize needs about ${WATER_NEED}.`
        : 'A dry spell came even with the watering.';
    case 'flood':
      return total > WATER_TOO_MUCH ? `This farm gets about ${total} L/m² of water a week with the rain: more than maize can use.` : 'Heavy rain came this week.';
    case 'nitrogen':
      return p.fert === 'none'
        ? 'This farm got no fertilizer.'
        : p.fert === 'manure'
          ? 'Manure alone does not feed maize all season.'
          : p.fert === 'basal'
            ? 'Planting fertilizer runs out mid-season. Maize needs a top-dress at knee height.'
            : p.seed === 'dense'
              ? 'Planted close, the plants share the food between too many.'
              : 'The plants are short of food this week.';
    case 'weeds':
      return p.land === 'slash' ? 'Slashing leaves weed roots in the ground, and they grow back.' : p.land === 'mulch' ? 'A few weeds came through the mulch.' : 'Weeds grow back after the first rains.';
    case 'armyworm':
    case 'disease':
      return p.pest === 'none' ? "This farm's plan has no pest control." : p.seed === 'dense' && h === 'disease' ? 'Planted close, the leaves stay wet and disease spreads.' : '';
    case 'wildlife':
      return p.harvest === 'late' ? 'Dry cobs left standing feed the birds.' : '';
    case 'plantEarly':
      return 'This farm was planted before the rains: that was its plan.';
    case 'plantLate':
      return 'This farm was planted three weeks after the rains began: that was its plan.';
    case 'harvestEarly':
      return 'This farm was picked while the husks were green: that was its plan.';
    case 'harvestLate':
      return 'This farm was left two weeks past ready: that was its plan.';
    default:
      return '';
  }
}

/* ---------------- planning help ---------------- */

/** One change per farm, each on a different step, so every farm tests one thing against Farm 1. */
export function suggestPlans(base: Plan, count: number, salt = 0): Plan[] {
  const out: Plan[] = [base];
  const steps = FARM_STEP_KEYS;
  let k = salt;
  for (let i = 1; i < count; i++) {
    let plan = base;
    for (let tries = 0; tries < 40; tries++) {
      const key = steps[(k + tries) % steps.length];
      const opts = stepOf(key).options.filter(x => x.id !== String(base[key]));
      const pick = opts[(i + salt + tries) % opts.length];
      const candidate = setChoice(base, key, pick.id);
      if (!out.some(q => samePlan(q, candidate))) {
        plan = candidate;
        k = (k + tries + 1) % steps.length;
        break;
      }
    }
    out.push(plan);
  }
  return out;
}

/** What stops the farms being planted, or null when they can be. */
export function planProblem(t: Pick<Trial, 'plans' | 'plots'>, coins: number): string | null {
  const plans = t.plans;
  for (let i = 1; i < plans.length; i++) {
    const key = (k: number) => JSON.stringify(plotsOf(t, k).map(r => [r.seed, r.fert, r.sprayer]));
    const twin = plans.findIndex((q, j) => j < i && samePlan(q, plans[i]) && key(j) === key(i));
    if (twin >= 0) return `${farmName(i)} has the same plan and plots as ${farmName(twin)}. Change at least one thing.`;
  }
  const cost = trialCost(t);
  if (cost > coins) return `These plans cost ${cost.toLocaleString('en-US')} coins and you have ${coins.toLocaleString('en-US')}.`;
  return null;
}

export function newTrial(cycle: number, guided: boolean, base: Plan): Trial {
  const forecasts: Forecast[] = ['normal', 'dry', 'normal', 'wet'];
  return {
    cycle,
    guided,
    forecast: guided ? 'normal' : forecasts[(cycle - 1) % forecasts.length],
    plans: guided ? [COMMON_PLAN, COMMON_PLAN] : Array.from({ length: 6 }, () => farmPlan(base)),
    plots: Array.from({ length: guided ? 2 : 6 }, () => defaultPlots()),
    phase: 'plan',
    clock: guided ? 'fast' : 'daily',
    planted: null,
    day: 1,
    checks: {},
    treatments: guided ? [0, 0] : [0, 0, 0, 0, 0, 0],
    results: null,
  };
}
