/* Sample cycles for design review (?screen=Six farms · …). They never touch a saved game. */

import { FULL, emptyField, type Field } from '../world/field';
import {
  CHECK_DAYS,
  COMMON_PLAN,
  DAMAGE,
  canTreat,
  checkKey,
  explain,
  harvestFarm,
  hazardFor,
  newTrial,
  setChoice,
  suggestPlans,
  type Plan,
  type Trial,
  type TrialHazard,
  type TrialSummary,
} from './model';

/** Checks every farm up to a day, the way a player who reads every farm right would; `miss` farms are skipped on a day. */
function play(t: Trial, upto: number, miss: [number, number][] = []): Trial {
  const out: Trial = { ...t, checks: { ...t.checks }, treatments: [...t.treatments] };
  for (let d = 1; d <= upto; d++)
    for (let f = 0; f < t.plans.length; f++) {
      if (miss.some(([mf, md]) => mf === f && md === d)) continue;
      const h = hazardFor(t, f, d);
      const treat = canTreat(h, t.plans[f]);
      out.checks[checkKey(f, d)] = { right: true, tries: 1, treated: treat };
      if (treat) out.treatments[f] += DAMAGE[h].treat;
    }
  return out;
}

const finish = (t: Trial): Trial => ({ ...t, phase: 'done', results: t.plans.map((_, i) => harvestFarm(t, i)) });

const guidedPlan: Trial = { ...newTrial(1, true, COMMON_PLAN), plans: [COMMON_PLAN, setChoice(COMMON_PLAN, 'fert', 'basalTop')] };
const guidedGrowing = play({ ...guidedPlan, phase: 'growing', clock: 'fast', planted: 0, day: 4 }, 3);
const guidedDone = finish(play({ ...guidedGrowing, day: CHECK_DAYS + 1 }, CHECK_DAYS));

const recipe = guidedPlan.plans[1];
const sixPlan: Trial = { ...newTrial(2, false, recipe), plans: suggestPlans(recipe, 6, 0) };
const sixGrowing = play({ ...sixPlan, phase: 'growing', clock: 'fast', planted: 0, day: 3 }, 2, [[3, 2]]);
const sixDone = finish(play({ ...sixGrowing, day: CHECK_DAYS + 1 }, CHECK_DAYS, [[3, 2], [5, 4]]));

const res = guidedDone.results!;
const history: TrialSummary[] = [{ cycle: 1, farms: 2, best: explain(guidedDone, res).best, bags: res.map(r => r.bags), profit: res.map(r => r.profit) }];

/** Field work for a sample cycle: every farm dug, sown and fed, today's treatments not yet done; `harvested` farms picked. */
function fieldOf(t: Trial, opts: { setup?: number[]; harvested?: number[]; carry?: Field['carry'] } = {}): Field {
  const f = emptyField(t.cycle);
  const setup = opts.setup ?? t.plans.map((_, i) => i);
  for (const i of setup) {
    f.marks[`${i}:prep`] = FULL;
    f.marks[`${i}:sow`] = FULL;
    if (t.plans[i].fert !== 'none') f.marks[`${i}:setupFeed`] = FULL;
    // earlier days' treatments are done
    for (let d = 1; d < t.day; d++) f.marks[`${i}:t${d}`] = FULL;
  }
  for (const i of opts.harvested ?? []) f.marks[`${i}:harvest`] = FULL;
  f.carry = opts.carry ?? null;
  return f;
}

/** The farm world, planting: Farm 1 dug, Farm 2 half dug. */
const worldPlanting: Trial = { ...guidedPlan, phase: 'growing', clock: 'fast', planted: 0, day: 1 };
const worldPlantingField: Field = { ...emptyField(1), marks: { '0:prep': FULL, '0:sow': 0b1111_1111_0000_0000_0000 & FULL, '1:prep': 0b0000_0000_1111_1111_1111 }, carry: 'seeds' };
/** The farm world, day 3 of the guided cycle, checks to do. */
const worldGrowing = { ...guidedGrowing, day: 3, checks: Object.fromEntries(Object.entries(guidedGrowing.checks).filter(([k]) => Number(k.split(':')[1]) < 3)) };
const worldGrowingField = fieldOf(worldGrowing);
/** The farm world at harvest: Farm 1 picked, Farm 2 still standing. */
const worldHarvest = play({ ...guidedGrowing, day: CHECK_DAYS + 1 }, CHECK_DAYS);
const worldHarvestField = fieldOf(worldHarvest, { harvested: [0] });

/* ---------------- from Wakala Agent: cases for design review and the play-tests ---------------- */

/** Farm 1's plan in the cases below: pest control (so pests can be treated) and slashing (weeds come back). */
const CARE_PLAN: Plan = { ...COMMON_PLAN, land: 'slash', pest: 'scout' };
const OTHER_PLAN: Plan = { ...COMMON_PLAN, fert: 'basalTop' };

/** The first cycle (from 2) where Farm 1 shows `want` on a day after day 1, two farms, on the fast clock. */
function findCase(plans: Plan[], want: TrialHazard, minDay = 2): { trial: Trial; day: number } {
  for (let cycle = 2; cycle < 2000; cycle++) {
    const t: Trial = { ...newTrial(cycle, false, plans[0]), plans, treatments: plans.map(() => 0), phase: 'growing', clock: 'fast', planted: 0 };
    for (let day = minDay; day <= CHECK_DAYS - 1; day++) if (hazardFor(t, 0, day) === want) return { trial: { ...t, day }, day };
  }
  throw new Error(`No cycle shows ${want}`);
}

export type WakalaCase = 'fix' | 'spray' | 'followUp' | 'cameBack' | 'tractor' | 'voice';

/** A cycle set up for one of the new moments in the farm world: the trial, its field, the day and Farm 1's problem. */
export function wakalaCase(kind: WakalaCase): { trial: Trial; field: Field; day: number; hazard: TrialHazard } {
  if (kind === 'tractor') {
    const plans = [{ ...COMMON_PLAN, land: 'tractor' } as Plan, { ...OTHER_PLAN, land: 'ox' } as Plan];
    const trial: Trial = { ...newTrial(2, false, plans[0]), plans, treatments: [0, 0], phase: 'growing', clock: 'fast', planted: 0, day: 1 };
    return { trial, field: emptyField(2), day: 1, hazard: hazardFor(trial, 0, 1) };
  }
  const want: TrialHazard = kind === 'spray' ? 'armyworm' : 'weeds';
  const { trial: base, day } = findCase([CARE_PLAN, OTHER_PLAN], want);
  // every earlier day checked and treated; today's checks follow the case
  let trial = play(base, day - 1);
  const k = (f: number, d: number) => checkKey(f, d);
  if (kind === 'fix') trial = { ...trial, checks: { ...trial.checks, [k(0, day)]: { right: true, tries: 1, treated: false } } };
  if (kind === 'spray') trial = { ...trial, checks: { ...trial.checks, [k(0, day)]: { right: true, tries: 1, treated: false, fix: 'spray' } } };
  if (kind === 'followUp') {
    trial = play(base, day);
    trial = { ...trial, checks: { ...trial.checks, [k(0, day)]: { right: true, tries: 1, treated: true, fix: 'cut' } }, followUps: [{ farm: 0, day, job: 'weed', hazard: 'weeds', done: false }] };
  }
  if (kind === 'cameBack') {
    // the weeds were cut yesterday, and today's follow-up was skipped: tomorrow they are back
    trial = play(base, day);
    trial = { ...trial, day: day + 1, followUps: [{ farm: 0, day, job: 'weed', hazard: 'weeds', done: false }] };
  }
  const shown = kind === 'cameBack' ? day + 1 : day;
  return { trial, field: fieldOf(trial), day: shown, hazard: hazardFor(trial, 0, shown) };
}

export const TRIAL_SAMPLES = {
  guidedPlan,
  guidedGrowing,
  guidedDone,
  sixPlan,
  sixGrowing,
  sixDone,
  history,
  worldPlanting,
  worldPlantingField,
  worldGrowing,
  worldGrowingField,
  worldHarvest,
  worldHarvestField,
};
