/* The animals and theft through the nights, as the water does: each action first settles any calendar day (or farm
   day, on the fast clock) that has ended. A night runs the thefts (with tonight's coop door and watch), then the
   animals' health, and leaves a report for the morning. The first night brings day 2, when the animals come into the
   player's care and the coop can be built. */

import type { Action, GameState } from '../state';
import { payClock } from '../climate/track';
import { daysBetween } from '../achievements/model';
import { dayNumber } from '../rounds/farms';
import { currentDay } from '../trials/model';
import { LIFE } from './config';
import { animalNight, lifeOf, type LifeEvent } from './model';
import { securityOf, theftNight, type NightReport } from '../security/model';

let nightId = 0;

/** One night: the thefts, the animals, then the next farm day. */
function oneNight(s: GameState, date: string, cycleDay: number): { s: GameState; report: NightReport } {
  const l0 = lifeOf(s.life);
  const seed = `${s.farmer?.name ?? 'farm'}:${l0.day}:${date}`;
  const t = theftNight(s, seed, cycleDay, date);
  const a = animalNight(t.state, seed);
  let next = a.state;
  const l = lifeOf(next.life);
  const day = l.day + 1;
  next = { ...next, life: { ...l, day, started: l.started ?? (day >= LIFE.startDay ? day : null) } };
  const report: NightReport = { day, date, events: [...t.events, ...a.events], paid: t.paid };
  const sec = securityOf(next.security);
  if (l.day >= LIFE.startDay - 1) next = { ...next, security: { ...sec, reports: [report, ...sec.reports].slice(0, 14) } };
  return { s: next, report };
}

/** The nights that have passed. `farmDay`: the six farms' day before a night slept on the fast clock. */
export function settleNights(s: GameState, today = payClock.today(), farmDay?: number): GameState {
  if (s.fs.phase !== 'done') return s;
  const life = lifeOf(s.life);
  if (life.date === null) return { ...s, life: { ...life, date: today } };
  const gap = daysBetween(life.date, today);
  const nights = farmDay !== undefined ? 1 : Math.min(LIFE.catchUpNights, gap);
  if (nights <= 0) return s;
  let next = s;
  const events: LifeEvent[] = [];
  const before = life.day;
  for (let i = 0; i < nights; i++) {
    const cycleDay = farmDay ?? (next.trial ? currentDay(next.trial, dayNumber()) : 0);
    const r = oneNight(next, today, cycleDay);
    next = r.s;
    events.push(...r.report.events);
  }
  next = { ...next, life: { ...lifeOf(next.life), date: farmDay !== undefined ? life.date : today } };
  const after = lifeOf(next.life).day;
  // day 2: the animals and the farm's safety are the player's now
  // (a dialog already up stays: the night's report is kept in Security › Night reports)
  if (next.success) return next;
  if (before < LIFE.startDay && after >= LIFE.startDay) return { ...next, success: { kind: 'day2', id: ++nightId } };
  const told = events.filter(e => e.kind !== 'cost' || nights === 1);
  if (told.length) return { ...next, success: { kind: 'night', id: ++nightId, nights, day: after, events: told } };
  return next;
}

export function trackLife(prev: GameState, s: GameState, a: Action): GameState {
  if (a.type === 'reset') return s;
  let next = s;
  if (a.type === 'trialNextDay') {
    const day = prev.trial?.day ?? 0;
    if (s.trial && prev.trial && s.trial.day > day) next = settleNights(next, undefined, day);
  } else next = settleNights(next);
  // money from a harvest sale stays in the house tonight
  if ((a.type === 'trialHarvest' || a.type === 'completeSale') && next.coins > prev.coins) {
    const sec = securityOf(next.security);
    next = { ...next, security: { ...sec, cash: sec.cash + (next.coins - prev.coins) } };
  }
  return next;
}
