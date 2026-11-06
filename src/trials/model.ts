/* The six farms: one crop on up to six farms, each grown to a different plan, then compared at harvest.

   This file is the whole model and has no pictures or screens, so the saved game can use it. Every number that
   teaches something (what each choice costs, how much yield it gives, which problems it invites, how much a
   problem costs when it is caught or missed) is in the tables below, so an agronomist can review and tune them
   without touching any code. The numbers are illustrative until that review is done. */

/* ---------------- the plan ---------------- */

export type StepKey = 'land' | 'seed' | 'date' | 'fert' | 'pest' | 'water' | 'harvest';

export interface Plan {
  land: 'slash' | 'hoe' | 'ox' | 'tractor' | 'mulch';
  seed: 'saved' | 'certified' | 'intercrop' | 'dense';
  date: 'early' | 'rains' | 'late';
  fert: 'none' | 'manure' | 'basal' | 'basalTop' | 'double';
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
    options: [
      o('saved', 'Saved seed', 'Plant grain kept from the last harvest.', 10, 0.75),
      o('certified', 'Certified seed', 'Plant certified seed in rows, 75 cm apart and 25 cm between plants.', 90, 1),
      o('intercrop', 'Seed + beans', 'Certified seed in rows, with a row of beans between the maize rows.', 130, 0.95),
      o('dense', 'Close spacing', 'Certified seed planted twice as close, to fit more plants in.', 120, 0.9),
    ],
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
    options: [
      o('none', 'None', 'No fertilizer or manure.', 0, 0.55),
      o('manure', 'Manure only', 'Dig farmyard manure into the planting holes.', 60, 0.72),
      o('basal', 'At planting only', 'Planting fertilizer in each hole, nothing later.', 150, 0.75),
      o('basalTop', 'Planting + top-dress', 'Planting fertilizer, then a top-dress when the maize is knee high.', 250, 1),
      o('double', 'Double dose', 'Twice the planting fertilizer and twice the top-dress.', 480, 0.95),
    ],
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

export const stepOf = (key: StepKey) => PLAN_STEPS.find(s => s.key === key)!;
export const optionOf = (key: StepKey, plan: Plan) => stepOf(key).options.find(x => x.id === String(plan[key]))!;
/** A choice's words inside a sentence: only the first letter lowered, so units like L stay as they are. */
export const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
export const setChoice = (plan: Plan, key: StepKey, id: string): Plan => ({ ...plan, [key]: key === 'water' ? Number(id) : id }) as Plan;

/** A common way to grow maize, used for Farm 1 in the first, guided cycle. */
export const COMMON_PLAN: Plan = { land: 'hoe', seed: 'saved', date: 'rains', fert: 'basal', pest: 'none', water: 0, harvest: 'ready' };

export const planCost = (p: Plan) => PLAN_STEPS.reduce((n, s) => n + optionOf(s.key, p).cost, 0);
export const samePlan = (a: Plan, b: Plan) => PLAN_STEPS.every(s => String(a[s.key]) === String(b[s.key]));
export const differences = (a: Plan, b: Plan) => PLAN_STEPS.filter(s => String(a[s.key]) !== String(b[s.key])).map(s => s.key);

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

/** What a farm's harvest comes to, from its plan, its problems and how well they were caught. */
export function harvestFarm(t: Trial, farm: number, lastDay = CHECK_DAYS): FarmResult {
  const p = t.plans[farm];
  const factors = Object.fromEntries(PLAN_STEPS.map(s => [s.key, stepFactor(s.key, p, t.forecast)])) as Record<StepKey, number>;
  // proposed effects from Wakala Agent, off until the agronomist's review (see WAKALA_YIELD_EFFECTS)
  const drive = t.tractor?.[farm];
  if (WAKALA_YIELD_EFFECTS && p.land === 'tractor' && drive) factors.land *= TRACTOR_Q_FACTOR.base + TRACTOR_Q_FACTOR.span * drive.Q;
  const problemOn = (day: number) => (WAKALA_YIELD_EFFECTS && MISSED_FOLLOW_UP_RETURNS ? hazardFor(t, farm, day) : baseHazard(t, farm, day));
  const problems: FarmResult['problems'] = [];
  let keep = 1;
  for (let day = 1; day <= lastDay; day++) {
    const h = problemOn(day);
    const d = DAMAGE[h];
    if (!d.missed) continue;
    const rec = t.checks[checkKey(farm, day)];
    // with the effects off, a day whose problem came back is judged by how the player dealt with what they were shown
    const shown = WAKALA_YIELD_EFFECTS ? null : returnedProblem(t, farm, day);
    const caught = shown
      ? !!rec?.right && (rec.treated || !canTreat(shown.hazard, p))
      : !!rec?.right && (rec.treated || !canTreat(h, p)) && (h === 'hail' || canTreat(h, p));
    const loss = caught ? d.caught : d.missed;
    keep *= 1 - loss;
    problems.push({ hazard: h, day, caught, loss });
  }
  const yieldShare = Object.values(factors).reduce((a, b) => a * b, 1) * keep;
  const bags = Math.round(POTENTIAL_BAGS * yieldShare * 10) / 10;
  const beans = p.seed === 'intercrop' ? Math.round(BEANS_BAGS * keep * 10) / 10 : 0;
  const lost = 1 - keep;
  let quality = 5 - Math.round(lost * 10);
  if (p.harvest === 'early') quality = Math.min(quality, 3);
  if (p.harvest === 'late') quality -= 1;
  if (p.seed === 'saved') quality -= 1;
  quality = Math.max(1, Math.min(5, quality));
  const income = Math.round(bags * PRICE_BY_QUALITY[quality] + beans * BEANS_PRICE);
  const costs = planCost(p) + (t.treatments[farm] ?? 0);
  problems.sort((a, b) => b.loss - a.loss);
  return { bags, beans, quality, income, costs, profit: income - costs, factors, lost, problems };
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
  const parts: { what: string; ln: number }[] = PLAN_STEPS.map(s => ({
    what: s.key,
    ln: Math.log(B.factors[s.key]) - Math.log(W.factors[s.key]),
  }));
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
    if (x.what === 'problems') {
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

/** Why a farm shows this problem, from its own plan (shown after a call, so the player links the sign to the cause). */
export function causeOf(h: TrialHazard, p: Plan, f: Forecast): string {
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
  const steps = PLAN_STEPS.map(s => s.key);
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
export function planProblem(plans: Plan[], coins: number): string | null {
  for (let i = 1; i < plans.length; i++) {
    const twin = plans.findIndex((q, j) => j < i && samePlan(q, plans[i]));
    if (twin >= 0) return `${farmName(i)} has the same plan as ${farmName(twin)}. Change at least one thing.`;
  }
  const cost = plans.reduce((n, p) => n + planCost(p), 0);
  if (cost > coins) return `These plans cost ${cost.toLocaleString('en-US')} coins and you have ${coins.toLocaleString('en-US')}.`;
  return null;
}

export function newTrial(cycle: number, guided: boolean, base: Plan): Trial {
  const forecasts: Forecast[] = ['normal', 'dry', 'normal', 'wet'];
  return {
    cycle,
    guided,
    forecast: guided ? 'normal' : forecasts[(cycle - 1) % forecasts.length],
    plans: guided ? [COMMON_PLAN, COMMON_PLAN] : Array.from({ length: 6 }, () => base),
    phase: 'plan',
    clock: guided ? 'fast' : 'daily',
    planted: null,
    day: 1,
    checks: {},
    treatments: guided ? [0, 0] : [0, 0, 0, 0, 0, 0],
    results: null,
  };
}
