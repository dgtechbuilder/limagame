/* Sample cycles for design review (?screen=Six farms · …). They never touch a saved game. */

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

export const TRIAL_SAMPLES = { guidedPlan, guidedGrowing, guidedDone, sixPlan, sixGrowing, sixDone, history };
