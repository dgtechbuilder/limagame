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
  type Trial,
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
