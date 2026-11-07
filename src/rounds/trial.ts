/* The field checks of the six farms: what each farm shows today comes from its own plan (see trials/model.ts),
   and the check uses the same pictures, photos and calls as the everyday rounds. */

import { FARMS, checkFor, type Round } from './data';
import {
  DAMAGE,
  FARM_STEPS,
  canTreat,
  causeOf,
  farmName,
  hazardFor,
  lower,
  optionOf,
  plotsOf,
  stageOfDay,
  type Trial,
  type TrialHazard,
} from '../trials/model';

/** Problems that come from outside the farm: the farmer's note tells what happened, not the plan. */
const OUTSIDE: TrialHazard[] = ['hail', 'livestock'];

export const planLine = (t: Trial, farm: number) =>
  'Plan: ' + FARM_STEPS.map(s => lower(optionOf(s.key, t.plans[farm]).label)).join(' · ') + ' · 4 plots';

export interface TrialRound extends Round {
  farmIndex: number;
  trialHazard: TrialHazard;
  /** shown beside the result: why this farm has this problem, and what was done about it */
  after: { right: string; wrong: string };
}

export function trialRounds(t: Trial, day: number): TrialRound[] {
  return t.plans.map((plan, i) => {
    const h = hazardFor(t, i, day);
    const stage = stageOfDay(day);
    const elapsed = stage === 'young' ? 3 : stage === 'grow' ? 10 : h === 'harvestLate' ? 19 : 15;
    const bed = FARMS[i];
    const round = checkFor({ ...bed, id: `t${i}`, n: i + 1, title: `{name}'s ${farmName(i)}`, short: farmName(i) }, elapsed, {
      hazard: h,
      crop: 'maize',
      stage,
    });
    const outside = OUTSIDE.includes(h) || (h === 'flood' && !causeOf(h, plan, t.forecast).startsWith('This farm'));
    const diary = outside ? round.diary : planLine(t, i);
    const cause = causeOf(h, plan, t.forecast, plotsOf(t, i));
    const d = DAMAGE[h];
    let treated = '';
    if (h === 'hail') treated = 'Nothing to treat: hail-damaged plants often recover.';
    else if (d.treat > 0 && canTreat(h, plan)) treated = `${d.fix} for ${d.treat} coins: most of the damage is stopped.`;
    else if (d.treat > 0) treated = 'It stays untreated, so the damage goes on.';
    return {
      ...round,
      diary,
      farmIndex: i,
      trialHazard: h,
      after: {
        right: [cause, h === 'healthy' ? '' : treated].filter(Boolean).join(' '),
        wrong: d.missed ? 'Until it is read right, this problem costs the farm part of its harvest.' : '',
      },
    };
  });
}
