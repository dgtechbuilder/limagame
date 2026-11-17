/* Each row's strategy, worked out: what it costs, the labour, what it does to the row's harvest, and its climate
   effects. No screens here. The table is ./data.ts. */

import type { Forecast, TrialHazard } from '../trials/model';
import { DIMENSIONS, FAMILY_LABOUR, LABOUR_DAY, ROWS_PER_FARM, optionIn, type RowStrategy, type StrategyOption } from './data';

/** What the strategies of a trial need to know (the trial, without importing its model here). */
export interface StrategyHost {
  plans: unknown[];
  forecast: Forecast;
  strategies?: RowStrategy[][];
}

export const retOf = (o: StrategyOption, f: Forecast) => (typeof o.ret === 'number' ? o.ret : (o.ret[f] ?? o.ret.normal ?? 0));

/** A farm's row strategies (4 rows; a missing row or dimension is "as the farm plan"). */
export const strategiesOf = (t: StrategyHost, farm: number): RowStrategy[] => Array.from({ length: ROWS_PER_FARM }, (_, r) => t.strategies?.[farm]?.[r] ?? {});

/** Every option a row has picked (the first option of a dimension, "as the farm plan", is left out). */
export function chosen(st: RowStrategy): { dim: string; option: StrategyOption }[] {
  return DIMENSIONS.map(d => ({ dim: d.id, option: optionIn(d.id, st[d.id])! })).filter(x => x.option !== DIMENSIONS.find(d => d.id === x.dim)!.options[0]);
}

export interface RowEffect {
  cost: number;
  labour: number;
  /** cash + labour at LABOUR_DAY */
  coInvest: number;
  /** extra harvest income, before problems: (1 + ret) × co-investment of each option */
  gain: number;
  co2: number;
  stored: number;
  water: number;
  soil: number;
  pollution: number;
  /** how much of each problem's damage the row still takes */
  risk: Partial<Record<TrialHazard, number>>;
  smart: number;
}

export function rowEffect(st: RowStrategy, f: Forecast): RowEffect {
  const e: RowEffect = { cost: 0, labour: 0, coInvest: 0, gain: 0, co2: 0, stored: 0, water: 0, soil: 0, pollution: 0, risk: {}, smart: 0 };
  for (const { option: o } of chosen(st)) {
    const co = o.cost + o.labour * LABOUR_DAY;
    e.cost += o.cost;
    e.labour += o.labour;
    e.coInvest += co;
    // an option that costs nothing still changes the harvest: its return is on the row's work as it was
    e.gain += co > 0 ? (1 + retOf(o, f)) * co : retOf(o, f) * NO_COST_BASE;
    e.co2 += o.co2 ?? 0;
    e.stored += o.stored ?? 0;
    e.water += o.water ?? 0;
    e.soil += o.soil ?? 0;
    e.pollution += o.pollution ?? 0;
    if (o.smart) e.smart++;
    for (const [h, m] of Object.entries(o.risk ?? {})) e.risk[h as TrialHazard] = (e.risk[h as TrialHazard] ?? 1) * (m as number);
  }
  return e;
}

/** What a no-cost option's return is taken on: about a row's ordinary inputs and work (stored money). Placeholder. */
export const NO_COST_BASE = 400;

/** The rows of a farm differ from the plan at all. */
export const hasStrategies = (t: StrategyHost, farm: number) => strategiesOf(t, farm).some(st => chosen(st).length > 0);

/** The cash a farm's row strategies cost, and the labour hired beyond the family's own. */
export function strategyCost(t: StrategyHost, farm: number): number {
  const rows = strategiesOf(t, farm).map(st => rowEffect(st, t.forecast));
  const cash = rows.reduce((n, r) => n + r.cost, 0);
  return Math.round(cash + hiredLabour(rows.reduce((n, r) => n + r.labour, 0)) * LABOUR_DAY);
}
/** Person-days beyond the family's own, hired. */
export const hiredLabour = (days: number) => Math.max(0, days - FAMILY_LABOUR);

export interface RowResult {
  row: number;
  bags: number;
  income: number;
  /** the row's share of the farm's costs, and its own strategy */
  costs: number;
  profit: number;
  /** extra income against the co-investment: (income − plain row) ÷ co-investment − 1; null with nothing invested */
  ret: number | null;
  labour: number;
  coInvest: number;
  co2: number;
  stored: number;
  water: number;
  soil: number;
  smart: number;
  options: string[];
}

/** The farm's harvest, row by row: the plain row (a quarter of the farm as planned), what each row's choices gained,
    and the damage its choices kept off (or let in). */
export function rowResults(
  t: StrategyHost,
  farm: number,
  base: { bags: number; income: number; costs: number; lost: number; problems: { hazard: TrialHazard; loss: number }[] },
  ownCost: number,
): RowResult[] {
  const sts = strategiesOf(t, farm);
  const plainIncome = base.income / ROWS_PER_FARM;
  const gross = base.lost < 1 ? plainIncome / Math.max(0.05, 1 - base.lost) : plainIncome;
  const perBag = base.bags > 0 ? base.income / base.bags : 0;
  const sharedCosts = (base.costs - ownCost) / ROWS_PER_FARM;
  const effects = sts.map(st => rowEffect(st, t.forecast));
  const hired = hiredLabour(effects.reduce((n, e) => n + e.labour, 0));
  const totalLabour = Math.max(1e-9, effects.reduce((n, e) => n + Math.max(0, e.labour), 0));
  return effects.map((e, row) => {
    // damage the row's choices kept off (risk < 1) or let in (risk > 1)
    const riskAdj = base.problems.reduce((n, p) => n + p.loss * (1 - (e.risk[p.hazard] ?? 1)) * gross, 0);
    const income = Math.max(0, Math.round(plainIncome + riskAdj + e.gain));
    const hiredShare = (hired * LABOUR_DAY * Math.max(0, e.labour)) / totalLabour;
    const own = Math.round(e.cost + hiredShare);
    const costs = Math.round(sharedCosts + own);
    const extra = income - plainIncome;
    return {
      row,
      bags: perBag > 0 ? Math.round((income / perBag) * 10) / 10 : Math.round((base.bags / ROWS_PER_FARM) * 10) / 10,
      income,
      costs,
      profit: income - costs,
      ret: e.coInvest > 0 ? extra / e.coInvest - 1 : null,
      labour: e.labour,
      coInvest: e.coInvest,
      co2: e.co2,
      stored: e.stored,
      water: e.water,
      soil: e.soil,
      smart: e.smart,
      options: chosen(sts[row]).map(x => x.option.label),
    };
  });
}

/** The climate effects of a farm's rows together, for the climate page (per cycle). */
export function farmStrategyClimate(t: StrategyHost, farm: number) {
  const e = strategiesOf(t, farm).map(st => rowEffect(st, t.forecast));
  const sum = (k: 'co2' | 'stored' | 'water' | 'soil' | 'pollution') => e.reduce((n, x) => n + x[k], 0);
  return { co2: sum('co2'), stored: sum('stored'), water: sum('water'), soil: sum('soil') / ROWS_PER_FARM, pollution: sum('pollution') };
}

/** Lima AI on the rows: which row paid best, and what it did differently from the worst. */
export function rowLesson(rows: RowResult[], farmLabel: string): string | null {
  if (rows.length < 2 || rows.every(r => r.options.length === 0)) return null;
  const best = rows.reduce((a, b) => (b.profit > a.profit ? b : a));
  const worst = rows.reduce((a, b) => (b.profit < a.profit ? b : a));
  if (best === worst) return null;
  const diff = best.options.filter(o => !worst.options.includes(o));
  const what = diff.length ? diff.join(', ').toLowerCase() : 'the plan as it was';
  return `${farmLabel}: Row ${best.row + 1} (${what}) made the most; Row ${worst.row + 1} the least.`;
}
