/* The evidence layer: what partners need to show that playing changes behaviour.

   - Every meaningful decision is logged with a timestamp: how often each farm is checked, the inputs and row
     strategies chosen, the way each treatment is done (per farm and the plots it covered), watering time, water used
     and bought, the money-at-risk taps and how long a risk took to fix, harvests.
   - Each player can carry cohort / programme tags (Settings › Help & data, or ?cohort=CODE in the address), added to
     every decision and event.
   - Now and then, after a practice, the game asks "Have you tried this on your own farm?" and keeps the answer.
   Everything stays on the device (inside the saved game) and can be downloaded as JSON from Settings; the events also go
   to VITE_EVENTS_URL when one is set (src/first/track.ts). No names are logged. */

import type { Action, GameState } from '../state';
import { checkKey, hazardFor } from '../trials/model';
import { treatmentOf } from '../care/treatments';
import { optionIn } from '../strategy/data';
import { popcount, treatLeft, emptyField } from '../world/field';
import { tankOf } from '../water/model';
import { track } from '../first/track';

export interface Decision {
  /** ms since epoch */
  t: number;
  /** what kind of decision */
  k: string;
  [field: string]: unknown;
}

export type Answer = 'yes' | 'planning' | 'no' | 'no-farm' | 'skip';

export interface PromptAnswer {
  practice: string;
  answer: Answer;
  t: number;
  /** what the player had just done in the game */
  context: string;
}

export interface EvidenceState {
  tags: string[];
  log: Decision[];
  answers: PromptAnswer[];
  /** the question waiting to be shown */
  pending: { practice: string; label: string; context: string } | null;
  /** when the last question was asked (ms) */
  askedAt: number;
}

export const EVIDENCE = {
  /** decisions kept on the device */
  keep: 600,
  /** at most one question a day */
  gapMs: 20 * 60 * 60 * 1000,
  /** ask again after "planning to" or a skip */
  askAgainMs: 7 * 24 * 60 * 60 * 1000,
};

/** The practices the game asks about, in the farmer's words. A new one is one more entry and a trigger below. */
export const PRACTICES: Record<string, string> = {
  ash: 'a pinch of ash in the maize funnels against armyworm',
  neem: 'a neem-leaf spray against pests',
  soap: 'soapy water against aphids',
  remove: 'removing and burning sick leaves',
  manure: 'manure and compost instead of a top-dress',
  mulch: 'mulching to keep water in the soil',
  residue: 'a crop-residue mulch between the rows',
  drip: 'a drip line from the tank',
  organic: 'organic compost instead of DAP',
  microdose: 'micro-dosing fertilizer in each planting hole',
  minimum: 'minimum tillage',
  zai: 'zai pits',
  ridges: 'tied ridges',
  intercrop: 'beans between the maize',
  legume: 'rotating maize after beans',
  cover: 'a cover crop between seasons',
  walk: 'walking your rows every morning to check them',
  morning: 'watering early in the morning',
  split: 'splitting fertilizer between planting and knee-high',
  dt: 'drought-tolerant seed',
  hedge: 'a live hedge to keep animals out',
  tins: 'tins and tape to scare birds',
  'daily-check': 'checking your crop every day and fixing problems the same day',
  'fair-share': 'sharing water fairly with your neighbours when it runs low',
};

export const emptyEvidence = (): EvidenceState => ({ tags: [], log: [], answers: [], pending: null, askedAt: 0 });
export const evidenceOf = (e: Partial<EvidenceState> | undefined): EvidenceState => ({ ...emptyEvidence(), ...(e ?? {}) });

/** A cohort or programme tag as typed: lower case, letters, digits and dashes. */
export const cleanTag = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

/** Whether a practice may be asked about now. */
function mayAsk(e: EvidenceState, practice: string, now: number): boolean {
  if (e.pending || now - e.askedAt < EVIDENCE.gapMs) return false;
  const last = [...e.answers].reverse().find(x => x.practice === practice);
  if (!last) return true;
  return (last.answer === 'planning' || last.answer === 'skip') && now - last.t > EVIDENCE.askAgainMs;
}

/** The decisions an action makes, for the log. */
function decisionsOf(prev: GameState, s: GameState, a: Action, now: number): { list: Decision[]; practices: { id: string; context: string }[] } {
  const list: Decision[] = [];
  const practices: { id: string; context: string }[] = [];
  const add = (k: string, data: Record<string, unknown> = {}) => list.push({ t: now, k, cycle: s.trial?.cycle ?? null, ...data });
  const t0 = prev.trial;
  const t = s.trial;
  switch (a.type) {
    case 'trialCheck': {
      if (!t || t === t0) break;
      const ev = evidenceOf(prev.evidence);
      const last = [...ev.log].reverse().find(d => d.k === 'check' && d.farm === a.farm);
      add('check', { farm: a.farm, day: a.day, right: a.right, tries: a.tries, hoursSinceLast: last ? Math.round(((now - last.t) / 3_600_000) * 10) / 10 : null });
      break;
    }
    case 'prescribe':
      if (t !== t0) add('fix', { farm: a.farm, day: a.day, pick: a.pick, right: a.right });
      break;
    case 'treatChoose':
      if (t !== t0) add('treatment-choice', { farm: a.farm, day: a.day, way: a.id });
      break;
    case 'fieldMark': {
      if (!t || !t0 || !/^t\d$/.test(a.job)) break;
      const day = Number(a.job.slice(1));
      const ck = checkKey(a.farm, day);
      if (t0.checks[ck]?.treated || !t.checks[ck]?.treated) break;
      const h = hazardFor(t0, a.farm, day);
      const way = treatmentOf(h, t.checks[ck]?.treatment);
      const f0 = prev.field.cycle === t0.cycle ? prev.field : emptyField(t0.cycle);
      const pend = treatLeft(f0, t0, a.farm, day);
      add('treated', { farm: a.farm, day, hazard: h, way: way?.id ?? null, plots: pend ? popcount(pend.need) : 20, watering: h === 'drought' ? way?.id : undefined });
      if (way?.smart && PRACTICES[way.id]) practices.push({ id: way.id, context: `treated Farm ${a.farm + 1} with ${way.label.toLowerCase()}` });
      break;
    }
    case 'plotSet':
      if (t !== t0) add('input', { farm: a.farm, plot: a.plot, kind: a.kind, value: a.value });
      break;
    case 'trialPlan':
      if (t !== t0) add('plan', { farm: a.farm, step: a.key, value: a.value });
      break;
    case 'strategySet': {
      if (t === t0) break;
      add(a.dim === 'watering' ? 'watering-time' : 'strategy', { farm: a.farm, row: a.row, dimension: a.dim, option: a.option });
      const o = optionIn(a.dim, a.option);
      if (o?.smart && PRACTICES[o.id]) practices.push({ id: o.id, context: `chose ${o.label.toLowerCase()} for a row of Farm ${a.farm + 1}` });
      break;
    }
    case 'waterBuy':
      if (s.tank !== prev.tank) add('water-buy', { kind: a.kind, level: Math.round(tankOf(s.tank).level) });
      break;
    case 'herdSet':
      if (s.tank !== prev.tank) add('herd', { cows: a.cows, hens: a.hens });
      break;
    case 'drawPolicy':
      if (s.tank !== prev.tank) {
        add('water-policy', { policy: a.policy });
        if (a.policy === 'fair') practices.push({ id: 'fair-share', context: 'chose to take a fair share of the dam' });
      }
      break;
    case 'coverBuy':
      if (s.tank !== prev.tank) add('cover', { premium: tankOf(s.tank).cover?.premium ?? null });
      break;
    case 'riskTap':
      add('risk-tap', { row: a.row, total: prev.risk?.snap?.total ?? null });
      break;
    case 'riskFixed': {
      if (s.risk === prev.risk) break;
      const fix = s.risk?.fixed[s.risk.fixed.length - 1];
      add('risk-fixed', { farm: a.fix.farm, amount: a.fix.amount, daysOpen: a.fix.daysOpen, msFromSeen: fix?.seenAt ? a.fix.fixedAt - fix.seenAt : null });
      if (a.fix.daysOpen === 0) practices.push({ id: 'daily-check', context: 'fixed a problem the day it showed' });
      break;
    }
    case 'trialHarvest':
      if (t?.results && t0?.phase === 'growing') add('harvest', { bags: t.results.map(r => r.bags), profit: t.results.map(r => r.profit) });
      break;
    case 'bizRun':
      if (s.biz && s.biz !== prev.biz) {
        const r = s.biz.history[s.biz.history.length - 1];
        if (r) add('tractor-day', { day: r.day, efficiency: r.efficiency ?? null, value: r.value ?? null, km: r.km, farmers: r.farmers });
      }
      break;
  }
  // a day of water ended: what the farm used
  const d0 = tankOf(prev.tank).days[0];
  const d1 = tankOf(s.tank).days[0];
  if (d1 && d1 !== d0) add('water-use', { litres: d1.house + d1.animals + d1.farms - d1.short, short: d1.short, credits: d1.credits, irrigation: d1.irrigationGot });
  return { list, practices };
}

/** Logs the decisions an action made, and queues a question when one of them is a practice worth asking about. */
export function trackEvidence(prev: GameState, s: GameState, a: Action, now = Date.now()): GameState {
  if (a.type === 'reset' || a.type === 'evidenceAnswer' || a.type === 'evidenceTag') return s;
  const { list, practices } = decisionsOf(prev, s, a, now);
  if (!list.length && !practices.length) return s;
  const e = evidenceOf(s.evidence);
  for (const d of list) track(`decision_${d.k}`, Object.fromEntries(Object.entries(d).filter(([k]) => k !== 't' && k !== 'k')));
  const ask = practices.find(p => mayAsk(e, p.id, now));
  return {
    ...s,
    evidence: {
      ...e,
      log: [...e.log, ...list].slice(-EVIDENCE.keep),
      pending: ask ? { practice: ask.id, label: PRACTICES[ask.id], context: ask.context } : e.pending,
      askedAt: ask ? now : e.askedAt,
    },
  };
}

export type EvidenceAction = { type: 'evidenceAnswer'; answer: Answer } | { type: 'evidenceTag'; tag: string; on: boolean };

export function evidenceReduce(e0: Partial<EvidenceState> | undefined, a: EvidenceAction, now = Date.now()): EvidenceState {
  const e = evidenceOf(e0);
  if (a.type === 'evidenceTag') {
    const tag = cleanTag(a.tag);
    if (!tag) return e;
    const has = e.tags.includes(tag);
    if (a.on === has) return e;
    return { ...e, tags: a.on ? [...e.tags, tag].slice(0, 8) : e.tags.filter(x => x !== tag) };
  }
  if (!e.pending) return e;
  track('practice_answer', { practice: e.pending.practice, answer: a.answer });
  return { ...e, pending: null, answers: [...e.answers, { practice: e.pending.practice, answer: a.answer, t: now, context: e.pending.context }].slice(-200) };
}

/** A short read of the evidence, for the export and Settings. */
export function evidenceSummary(s: GameState) {
  const e = evidenceOf(s.evidence);
  const checks = e.log.filter(d => d.k === 'check');
  const days = new Set(checks.map(d => new Date(d.t).toISOString().slice(0, 10))).size;
  const fixes = (s.risk?.fixed ?? []).filter(f => f.seenAt).map(f => f.fixedAt - (f.seenAt ?? f.fixedAt)).sort((x, y) => x - y);
  const median = fixes.length ? fixes[Math.floor(fixes.length / 2)] : null;
  const ways = e.log.filter(d => d.k === 'treated');
  const smartWays = ways.filter(d => {
    const w = d.way as string | null;
    return !!w && ['ash', 'neem', 'soap', 'remove', 'manure', 'drip', 'mulch', 'hedge', 'tins'].includes(w);
  }).length;
  const tried = e.answers.filter(x => x.answer === 'yes').length;
  return {
    decisions: e.log.length,
    checks: checks.length,
    checkDays: days,
    checksPerDay: days ? Math.round((checks.length / days) * 10) / 10 : 0,
    medianMinutesToFix: median === null ? null : Math.round(median / 60_000),
    treatments: ways.length,
    climateSmartTreatments: smartWays,
    answers: e.answers.length,
    triedOnOwnFarm: tried,
  };
}

/** Everything, as a file to download. */
export function evidenceExport(s: GameState) {
  const e = evidenceOf(s.evidence);
  return {
    game: 'lima-farming-game',
    exported: new Date().toISOString(),
    tags: e.tags,
    summary: evidenceSummary(s),
    decisions: e.log,
    answers: e.answers,
    risk: { taps: s.risk?.taps ?? 0, rowTaps: s.risk?.rowTaps ?? 0, fixed: s.risk?.fixed ?? [] },
    tractor: (s.biz?.history ?? []).map(r => ({ day: r.day, efficiency: r.efficiency ?? null, value: r.value ?? null, km: r.km, bestKm: r.bestKm, farmers: r.farmers })),
  };
}
