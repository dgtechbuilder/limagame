/* Harvest estimate: the button beside the farmer's portrait. What the farms' harvest is likely to bring in if it
   goes well, the way the player is farming now (their plans, their plots' inputs, the care done or missed, and every
   problem so far as it was dealt with), and what they are likely to lose if the problems on the farms now are not put
   right. No screens here, so the play-tests can use it. What a problem costs is the same number the check and the
   at-risk list show (src/risk/model.ts statedCost). */

import { CHECK_DAYS, checkKey, harvestFarm, resolvedOn, shownOn, type Trial } from '../trials/model';
import type { RiskSummary } from './model';

export interface HarvestFarm {
  farm: number;
  /** what this farm's harvest brings in if every problem on it now is dealt with */
  income: number;
  bags: number;
  /** what it has cost so far: plan, inputs, treatments and fuel */
  costs: number;
  /** what it loses if the problems on it now are left alone */
  atRisk: number;
}

export interface HarvestEstimate {
  /** 'growing': an estimate, 'done': what the last harvest brought in */
  kind: 'growing' | 'done';
  farms: HarvestFarm[];
  /** what the harvest is likely to bring in, if it goes well */
  income: number;
  costs: number;
  /** income less costs */
  profit: number;
  bags: number;
  /** what the player is likely to lose if they do not put right the problems on the farms now: every open problem at
      its full cost (what the check shows: "Will cost you about … if it is left alone") */
  atRisk: number;
  /** the harvest if nothing is put right */
  ifLeft: number;
}

/** The trial with every problem on the farms today dealt with: read right, and the fix done. */
export function withTodayFixed(t: Trial, day: number): Trial {
  if (day < 1 || day > CHECK_DAYS) return t;
  const checks = { ...t.checks };
  t.plans.forEach((_, farm) => {
    const h = shownOn(t, farm, day).hazard;
    if (resolvedOn(t, farm, day, h)) return;
    checks[checkKey(farm, day)] = { ...(checks[checkKey(farm, day)] ?? { tries: 1 }), right: true, treated: true };
  });
  return { ...t, checks };
}

/** The harvest estimate for the save's trial, or null with nothing growing (and no harvest yet). */
export function harvestEstimate(t: Trial | null | undefined, risk: RiskSummary): HarvestEstimate | null {
  if (!t) return null;
  if (t.phase === 'done' && t.results?.length) {
    const farms = t.results.map((r, farm) => ({ farm, income: r.income, bags: r.bags, costs: r.costs, atRisk: 0 }));
    return sum('done', farms);
  }
  if (t.phase !== 'growing') return null;
  // the checks so far (and today's, put right): the harvest the player is on course for if it goes well from here
  const day = Math.min(risk.day, CHECK_DAYS);
  // at harvest time nothing more can be put right: the harvest is what the checks made it
  const fixed = risk.day > CHECK_DAYS ? t : withTodayFixed(t, day);
  const farms = t.plans.map((_, farm) => {
    const r = harvestFarm(fixed, farm, day);
    const atRisk = risk.items.filter(x => x.farm === farm).reduce((n, x) => n + x.stated, 0);
    return { farm, income: r.income, bags: r.bags, costs: r.costs, atRisk: Math.min(r.income, atRisk) };
  });
  return sum('growing', farms);
}

function sum(kind: HarvestEstimate['kind'], farms: HarvestFarm[]): HarvestEstimate {
  const income = farms.reduce((n, x) => n + x.income, 0);
  const costs = farms.reduce((n, x) => n + x.costs, 0);
  const atRisk = farms.reduce((n, x) => n + x.atRisk, 0);
  const bags = Math.round(farms.reduce((n, x) => n + x.bags, 0) * 10) / 10;
  return { kind, farms, income, costs, profit: income - costs, bags, atRisk, ifLeft: Math.max(0, income - atRisk) };
}
