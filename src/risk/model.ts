/* Money at risk: what every unresolved problem on the six farms would cost if it is left, added up for the button
   on the farm. No screens here, so the play-tests and the saved game can use it. The numbers to tune are in
   ./config.ts; what a problem costs a harvest is in src/trials/model.ts (DAMAGE), as everywhere else in the game. */

import {
  CHECK_DAYS,
  canTreat,
  carriesOver,
  checkKey,
  currentDay,
  harvestFarm,
  plotLoss,
  plotsOf,
  resolvedOn,
  shownOn,
  type Forecast,
  type Trial,
  type TrialHazard,
} from '../trials/model';
import { fixLeft, popcount, setupLeft, treatLeft, type Field, emptyField } from '../world/field';
import { RISK, riskShare } from './config';

/** Where a problem stands, in words that never say what the problem is (the player still has to read it). */
export type RiskStatus = 'unchecked' | 'recheck' | 'fix' | 'work';

export interface RiskItem {
  /** `${cycle}:${farm}:${first day}`: the same problem keeps its key while it is carried from day to day */
  key: string;
  farm: number;
  /** the day of the cycle it first showed */
  start: number;
  /** whole days it has been left (0 on the day it showed) */
  daysOpen: number;
  /** what it costs the harvest if it is never dealt with (a stored amount: money() shows it) */
  stated: number;
  /** at risk now */
  amount: number;
  /** at risk tomorrow if it is still left (at the harvest, after the last day of checks); null once at its full cost */
  next: number | null;
  status: RiskStatus;
  /** plots of the farm that need the work: known only once it has been read right (status 'work') */
  plots: number | null;
  /** for the game's own use only: never shown on the list */
  hazard: TrialHazard;
}

export interface ShockRisk {
  shock: 'drought' | 'flood' | 'hail';
  amount: number;
}

export interface RiskSummary {
  /** at risk on the farms, biggest first */
  items: RiskItem[];
  /** forecast shocks (only with RISK.includeShocks) */
  shocks: ShockRisk[];
  total: number;
  /** the cycle's day of checks (1 to 6), 7 at harvest, 0 with nothing growing */
  day: number;
  cycle: number;
  /** some farm has shown a problem with a cost this cycle (the button stays once it has) */
  anyEver: boolean;
}

/** What a farm's harvest is worth as it is growing, before any problem. */
export function farmValue(t: Trial, farm: number): number {
  return harvestFarm(t, farm, 0).income;
}

/** What a problem takes off a farm's harvest if it is never dealt with: its stated cost. */
export function statedCost(t: Trial, farm: number, h: TrialHazard, value = farmValue(t, farm)): number {
  const rows = plotsOf(t, farm);
  const share = rows.reduce((n, r) => n + plotLoss(h, false, false, r), 0) / Math.max(1, rows.length);
  return Math.round(value * share);
}

export const riskKey = (cycle: number, farm: number, start: number) => `${cycle}:${farm}:${start}`;

const fieldFor = (f: Field | undefined, t: Trial) => (f && f.cycle === t.cycle ? f : emptyField(t.cycle));

/** Every unresolved problem with a cost on the six farms today, and their total. */
export function riskOf(t: Trial | null | undefined, field: Field | undefined, today: number, opts: { covered?: boolean } = {}): RiskSummary {
  const empty: RiskSummary = { items: [], shocks: [], total: 0, day: 0, cycle: t?.cycle ?? 0, anyEver: false };
  if (!t || t.phase !== 'growing') return empty;
  const day = currentDay(t, today);
  const f = fieldFor(field, t);
  const items: RiskItem[] = [];
  let anyEver = false;
  if (day >= 1 && day <= CHECK_DAYS) {
    t.plans.forEach((p, farm) => {
      // a farm shows its problems once it is planted
      if (setupLeft(f, t, farm)) return;
      const value = farmValue(t, farm);
      const ep = shownOn(t, farm, day);
      const h = ep.hazard;
      if (!statedCost(t, farm, h, value)) return;
      anyEver = true;
      const rec = t.checks[checkKey(farm, day)];
      if (resolvedOn(t, farm, day, h)) return;
      // read right but nothing more can be done (pests on a farm with no pest control): no longer at risk, lost
      if (rec?.right && !carriesOver(h, p)) return;
      const stated = statedCost(t, farm, h, value);
      const daysOpen = day - ep.start;
      const share = riskShare(daysOpen);
      const amount = Math.round(stated * share);
      const tomorrow = Math.round(stated * riskShare(daysOpen + 1));
      const tr = treatLeft(f, t, farm, day);
      const status: RiskStatus = !rec ? 'unchecked' : !rec.right ? 'recheck' : fixLeft(t, farm, day) ? 'fix' : 'work';
      items.push({
        key: riskKey(t.cycle, farm, ep.start),
        farm,
        start: ep.start,
        daysOpen,
        stated,
        amount,
        next: share < 1 && carriesOver(h, p) ? tomorrow : null,
        status,
        plots: status === 'work' && tr ? popcount(tr.need) : null,
        hazard: h,
      });
    });
  }
  // problems already dealt with earlier this cycle count as shown, so the button stays once it has appeared
  if (!anyEver)
    anyEver = Object.entries(t.checks).some(([k, rec]) => {
      const [farm, d] = k.split(':').map(Number);
      return d <= day && !!rec && farm < t.plans.length && !!statedCost(t, farm, shownOn(t, farm, d).hazard);
    });
  items.sort((a, b) => b.amount - a.amount || a.farm - b.farm);
  const shocks = RISK.includeShocks && day >= 1 && day <= CHECK_DAYS ? shockRisk(t, opts.covered ?? false) : [];
  const total = items.reduce((n, x) => n + x.amount, 0) + shocks.reduce((n, x) => n + x.amount, 0);
  return { items, shocks, total, day, cycle: t.cycle, anyEver: anyEver || items.length > 0 };
}

/** The season's forecast shocks: their odds times what each would cost every farm, less what crop cover pays. */
export function shockRisk(t: Trial, covered: boolean): ShockRisk[] {
  const odds = RISK.shockOdds[t.forecast as Forecast];
  const keep = covered ? 1 - RISK.coverCut : 1;
  return (['drought', 'flood', 'hail'] as const)
    .map(shock => ({
      shock,
      amount: Math.round(t.plans.reduce((n, _, farm) => n + statedCost(t, farm, shock) * odds[shock] * keep, 0)),
    }))
    .filter(x => x.amount > 0);
}

/** A problem that has left the list was dealt with (read right, and the fix done), rather than lost. */
export function wasResolved(t: Trial, farm: number, start: number, today: number): boolean {
  if (farm >= t.plans.length) return false;
  const last = Math.min(CHECK_DAYS, currentDay(t, today));
  const h = shownOn(t, farm, start).hazard;
  for (let d = start; d <= last; d++) {
    if (shownOn(t, farm, d).start !== start) break;
    if (resolvedOn(t, farm, d, h)) return canTreat(h, t.plans[farm]) || h === 'hail';
  }
  return false;
}

/** Status words for the list: where the player is with it, never what it is. */
export const STATUS_WORDS: Record<RiskStatus, string> = {
  unchecked: 'Not checked yet',
  recheck: 'Read wrong: look again',
  fix: 'Read right: choose the fix',
  work: 'Read right: the work is left',
};

/* ---------------- what is saved: the snapshot for "while you were away", and the evidence ---------------- */

export interface RiskFix {
  key: string;
  farm: number;
  /** at risk when it was dealt with */
  amount: number;
  /** when the player first saw it on the button (ms), if they did */
  seenAt: number | null;
  fixedAt: number;
  daysOpen: number;
}

export interface RiskState {
  /** the button as the player last saw it: for "while you were away" */
  snap: { total: number; at: number; day: number; cycle: number; amounts: Record<string, number> } | null;
  /** when each problem was first on the button in front of the player (ms) */
  seenAt: Record<string, number>;
  /** problems dealt with, newest last (the last 100): time from first seeing it at risk to the fix */
  fixed: RiskFix[];
  /** taps on the button, and on a problem in its list */
  taps: number;
  rowTaps: number;
}

export const emptyRisk = (): RiskState => ({ snap: null, seenAt: {}, fixed: [], taps: 0, rowTaps: 0 });
export const riskOfSave = (r: Partial<RiskState> | undefined): RiskState => ({ ...emptyRisk(), ...(r ?? {}) });

export type RiskAction =
  | { type: 'riskSnap'; total: number; day: number; cycle: number; amounts: Record<string, number>; at: number; seen: boolean }
  | { type: 'riskFixed'; fix: Omit<RiskFix, 'seenAt'> }
  | { type: 'riskTap'; row: boolean };

export function riskReduce(r0: RiskState | undefined, a: RiskAction): RiskState {
  const r = riskOfSave(r0);
  if (a.type === 'riskSnap') {
    const seenAt = { ...r.seenAt };
    if (a.seen) for (const k of Object.keys(a.amounts)) if (!seenAt[k]) seenAt[k] = a.at;
    // forget problems of earlier cycles
    for (const k of Object.keys(seenAt)) if (Number(k.split(':')[0]) < a.cycle) delete seenAt[k];
    return { ...r, seenAt, snap: { total: a.total, day: a.day, cycle: a.cycle, amounts: a.amounts, at: a.at } };
  }
  if (a.type === 'riskFixed') {
    if (r.fixed.some(x => x.key === a.fix.key)) return r;
    return { ...r, fixed: [...r.fixed, { ...a.fix, seenAt: r.seenAt[a.fix.key] ?? null }].slice(-100) };
  }
  return { ...r, taps: r.taps + (a.row ? 0 : 1), rowTaps: r.rowTaps + (a.row ? 1 : 0) };
}
